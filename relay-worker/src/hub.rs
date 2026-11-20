//! The relay's whole state machine, with no Worker types: it takes frames and a clock and returns the actions
//! (send, close, save an attachment) the Worker glue must carry out. That keeps every rule testable natively.
//! Nothing here sets a timer: every rule that involves time is checked when the next event arrives. That includes batching (`flush_due`).

use crate::interest::select_set;
use crate::proto::*;
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, PartialEq, Eq)]
pub enum Action {
    Send(u16, Vec<u8>),
    Close(u16, u16, &'static str),
    /// The connection's saved record changed: write it to the socket attachment.
    Persist(u16),
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Refuse {
    /// 503
    Full,
    /// 429
    PerAddress,
    /// 429: this address already used its frames for today.
    Budget,
}

/// One connection. The first group of fields is saved in the socket attachment (see `encode`) and survives
/// hibernation. The second group restarts on a wake-up, which at worst hands an idle player fresh buckets, a fresh idle
/// timer and an early next state from each neighbour.
#[derive(Debug, Clone)]
pub struct Conn {
    pub handle: u16,
    pub ip: String,
    pub helloed: bool,
    pub connected_ms: u64,
    pub info: Vec<u8>,
    pub pos: Option<(f32, f32)>,
    /// Who this player receives.
    pub set: Vec<u16>,

    /// The reverse of `set`: who receives this player. Rebuilt from the sets after a wake-up.
    watchers: Vec<u16>,
    /// When a state from each member of `set` was last forwarded here.
    last_fwd: Vec<(u16, u64)>,
    last_state: Option<Vec<u8>>,
    /// Protocol version this player said in HELLO (2 or 3) and how many players it receives (K for v2, what it asked for for v3). Saved in the attachment.
    pub ver: u8,
    pub k: usize,
    /// v3 only, memory only: the gaps the per receiver budget allows for each member, the states waiting to be sent as one frame (handle u16 + state, and when each
    /// came in), when the last frame of states went, and the audience band this player was last told (255: not yet).
    bgap: Vec<(u16, u64)>,
    box_full: Vec<u8>,
    box_t: Vec<u64>,
    last_flush: u64,
    aud_sent: u8,
    all: Bucket,
    say: Bucket,
    to: Bucket,
    last_info_ms: Option<u64>,
    malformed: u32,
    rate_strikes: u32,
    last_strike_ms: u64,
    last_recompute: Option<u64>,
    last_seen: u64,
    online_ms: u64,
    online_val: u16,
}

impl Conn {
    fn new(handle: u16, ip: &str, now: u64) -> Self {
        Conn {
            handle,
            ip: ip.to_string(),
            helloed: false,
            connected_ms: now,
            info: vec![],
            pos: None,
            set: vec![],
            watchers: vec![],
            last_fwd: vec![],
            last_state: None,
            ver: VERSION,
            k: K,
            bgap: vec![],
            box_full: vec![],
            box_t: vec![],
            last_flush: 0,
            aud_sent: 255,
            all: Bucket::full(RATE_ALL, now),
            say: Bucket::full(RATE_SAY, now),
            to: Bucket::full(RATE_TO, now),
            last_info_ms: None,
            malformed: 0,
            rate_strikes: 0,
            last_strike_ms: 0,
            last_recompute: None,
            last_seen: now,
            online_ms: now,
            online_val: 0,
        }
    }

    /// Compact bytes for the socket attachment (a 2 KiB limit; this stays under about 170 for a v2 player and about 310 for a v3 one holding 64).
    pub fn encode(&self) -> Vec<u8> {
        let mut o = vec![3u8];
        o.extend_from_slice(&self.handle.to_le_bytes());
        o.push(self.helloed as u8 | (self.pos.is_some() as u8) << 1);
        o.extend_from_slice(&self.connected_ms.to_le_bytes());
        o.push(self.ip.len() as u8);
        o.extend_from_slice(self.ip.as_bytes());
        o.push(self.info.len() as u8);
        o.extend_from_slice(&self.info);
        let (x, z) = self.pos.unwrap_or((0.0, 0.0));
        o.extend_from_slice(&x.to_le_bytes());
        o.extend_from_slice(&z.to_le_bytes());
        o.push(self.set.len() as u8);
        for m in &self.set {
            o.extend_from_slice(&m.to_le_bytes());
        }
        o.push(self.ver);
        o.push(self.k as u8);
        o
    }

    pub fn decode(b: &[u8], now: u64) -> Option<Conn> {
        struct R<'a>(&'a [u8]);
        impl<'a> R<'a> {
            fn take(&mut self, n: usize) -> Option<&'a [u8]> {
                if self.0.len() < n {
                    return None;
                }
                let (a, b) = self.0.split_at(n);
                self.0 = b;
                Some(a)
            }
            fn u8(&mut self) -> Option<u8> {
                self.take(1).map(|s| s[0])
            }
            fn u16(&mut self) -> Option<u16> {
                self.take(2).map(|s| u16::from_le_bytes([s[0], s[1]]))
            }
            fn u64(&mut self) -> Option<u64> {
                self.take(8).map(|s| u64::from_le_bytes(s.try_into().unwrap()))
            }
            fn f32(&mut self) -> Option<f32> {
                self.take(4).map(|s| f32::from_le_bytes(s.try_into().unwrap()))
            }
        }
        let mut r = R(b);
        let record = r.u8()?;
        if record != 2 && record != 3 {
            return None;
        }
        let handle = r.u16()?;
        let flags = r.u8()?;
        let connected_ms = r.u64()?;
        let n = r.u8()? as usize;
        let ip = String::from_utf8(r.take(n)?.to_vec()).ok()?;
        let n = r.u8()? as usize;
        let info = r.take(n)?.to_vec();
        let (x, z) = (r.f32()?, r.f32()?);
        let mut set = vec![];
        for _ in 0..r.u8()? {
            set.push(r.u16()?);
        }
        let mut c = Conn::new(handle, &ip, now);
        c.helloed = flags & 1 != 0;
        c.connected_ms = connected_ms;
        c.info = info;
        c.pos = (flags & 2 != 0).then_some((x, z));
        c.set = set;
        if record == 3 {
            c.ver = r.u8()?;
            c.k = r.u8()? as usize;
            if (c.ver != VERSION && c.ver != VERSION_3) || c.k == 0 || c.k > K_MAX {
                return None;
            }
        }
        Some(c)
    }
}

#[derive(Debug, Default)]
pub struct Stats {
    pub frames_in: u64,
    pub forwarded: u64,
    pub thinned: u64,
    pub bytes_in: u64,
    pub dropped: BTreeMap<&'static str, u64>,
    /// v3: frames of batched states sent, the states in them, and how long a state waited for its frame, by millisecond (the last counts 'this long or more').
    pub batches: u64,
    pub batched_states: u64,
    pub batch_wait: Vec<u64>,
    pub audience_sent: u64,
}

impl Stats {
    fn note_wait(&mut self, ms: u64) {
        if self.batch_wait.is_empty() {
            self.batch_wait = vec![0; 1001];
        }
        self.batch_wait[(ms as usize).min(1000)] += 1;
    }
}

/// What the experiments of docs/ONLINE-CROWD.md change without a rebuild: the shipped values are the constants of `proto.rs`.
#[derive(Debug, Clone)]
pub struct Tuning {
    pub radius: f32,
    pub far_slots: usize,
    pub far_gap_ms: u64,
    pub budget_above: usize,
    pub budget_rate: f32,
    pub batch_ms: u64,
    pub batch_min_held: usize,
    pub batch_max: usize,
    /// How many events in a row must have come less than batch_ms after the one before for the relay to count as busy (1: the last gap; more: a run of dense events).
    pub busy_gaps: usize,
}
impl Default for Tuning {
    fn default() -> Self {
        Tuning { radius: SET_RADIUS_M, far_slots: FAR_SLOTS, far_gap_ms: FAR_GAP_MS, budget_above: BUDGET_ABOVE, budget_rate: BUDGET_STATES_PER_S, batch_ms: BATCH_MS, batch_min_held: BATCH_MIN_HELD, batch_max: BATCH_MAX, busy_gaps: BUSY_GAPS }
    }
}

pub struct Hub {
    conns: BTreeMap<u16, Conn>,
    next: u16,
    last_sweep: u64,
    day: u64,
    per_address: HashMap<String, u32>,
    pub day_limit: u32,
    pub stats: Stats,
    /// Players a v2 player receives (the relay's `K`, 8; the crowd tools in `hubbench/` set it to measure what a bigger one would have cost).
    pub k: usize,
    /// Players a v3 player receives when it does not ask for a number.
    pub k3: usize,
    pub tune: Tuning,
    /// Receivers with states waiting in a box, and when the last incoming event of any player came (batching, see `flush_due`).
    pending: Vec<u16>,
    last_event: u64,
    short_run: usize,
    busy: bool,
}

impl Hub {
    /// `seed` picks where handle numbering starts, so a handle is not reused soon after a restart.
    pub fn new(seed: u16) -> Self {
        Hub { conns: BTreeMap::new(), next: seed.max(1), last_sweep: 0, day: 0, per_address: HashMap::new(), day_limit: FRAMES_PER_IP_PER_DAY, stats: Stats::default(), k: K, k3: K_V3, tune: Tuning::default(), pending: vec![], last_event: 0, short_run: 0, busy: false }
    }

    pub fn restore(&mut self, conns: Vec<Conn>) {
        for c in conns {
            self.next = self.next.max(c.handle.wrapping_add(1)).max(1);
            self.conns.insert(c.handle, c);
        }
        // A saved set may name a player that is gone: drop it, then rebuild the reverse lists.
        let live: Vec<u16> = self.conns.values().filter(|c| c.helloed).map(|c| c.handle).collect();
        let mut pairs = vec![];
        for c in self.conns.values_mut() {
            c.set.retain(|m| live.contains(m));
            pairs.extend(c.set.iter().map(|m| (*m, c.handle)));
        }
        for (m, w) in pairs {
            self.conns.get_mut(&m).unwrap().watchers.push(w);
        }
    }

    pub fn len(&self) -> usize {
        self.conns.len()
    }

    pub fn online(&self) -> u16 {
        self.conns.values().filter(|c| c.helloed).count() as u16
    }

    /// Has this address used its frames for today (an upgrade from it would be refused with 429)? For /status.
    pub fn budget_used(&mut self, ip: &str, now: u64) -> bool {
        let ip = address_key(ip);
        self.roll_day(now);
        self.per_address.get(&ip).is_some_and(|n| *n >= self.day_limit)
    }

    /// How many frames the address has been counted for today (for the logs).
    pub fn frames_today(&self, ip: &str) -> u32 {
        self.per_address.get(&address_key(ip)).copied().unwrap_or(0)
    }

    pub fn conn(&self, handle: u16) -> Option<&Conn> {
        self.conns.get(&handle)
    }

    pub fn count_drop(&mut self, reason: &'static str) {
        *self.stats.dropped.entry(reason).or_insert(0) += 1;
    }

    /// Admission check for a new socket: the new connection's handle, and the actions that make room for it.
    /// When the relay is full, one connection of the address holding the most places is closed for it, but only if
    /// that address holds at least two more than the newcomer's: a few addresses (or one /64) cannot sit on every place.
    pub fn accept(&mut self, ip: &str, now: u64) -> Result<(u16, Vec<Action>), Refuse> {
        let ip = address_key(ip);
        self.roll_day(now);
        if self.per_address.get(&ip).is_some_and(|n| *n >= self.day_limit) {
            return Err(Refuse::Budget);
        }
        let mine = self.conns.values().filter(|c| c.ip == ip).count();
        if mine >= MAX_PER_IP {
            return Err(Refuse::PerAddress);
        }
        let mut acts = vec![];
        if self.conns.len() >= MAX_CONNS {
            let Some(victim) = self.victim_for(mine) else { return Err(Refuse::Full) };
            self.kick(victim, CLOSE_TRY_AGAIN, "making room", now, &mut acts);
        }
        // At most 300 live handles out of 65535, so this loop ends at once.
        let mut h = self.next;
        while h == 0 || self.conns.contains_key(&h) {
            h = h.wrapping_add(1);
        }
        self.next = h.wrapping_add(1).max(1);
        self.conns.insert(h, Conn::new(h, &ip, now));
        Ok((h, acts))
    }

    /// The connection to close so that a newcomer holding `mine` places can come in: the one that has been silent
    /// longest (a socket that never said HELLO first) of the address with the most places.
    fn victim_for(&self, mine: usize) -> Option<u16> {
        let mut counts: HashMap<&str, usize> = HashMap::new();
        for c in self.conns.values() {
            *counts.entry(c.ip.as_str()).or_insert(0) += 1;
        }
        let (top, n) = counts.into_iter().max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(a.0)))?;
        if n < mine + 2 {
            return None;
        }
        self.conns.values().filter(|c| c.ip == top).min_by_key(|c| (c.helloed, c.last_seen, c.handle)).map(|c| c.handle)
    }

    /// Closes connections that never said HELLO in time or went silent. Called on every event but runs at most
    /// once a second; there is no alarm, because an alarm would keep an idle object awake.
    pub fn sweep(&mut self, now: u64) -> Vec<Action> {
        let mut acts = vec![];
        if now < self.last_sweep + 1000 {
            return acts;
        }
        self.last_sweep = now;
        let stale: Vec<(u16, &'static str, u16)> = self
            .conns
            .values()
            .filter_map(|c| {
                if !c.helloed && now.saturating_sub(c.connected_ms) > HELLO_DEADLINE_MS {
                    Some((c.handle, "no hello", CLOSE_POLICY))
                } else if now.saturating_sub(c.last_seen) > IDLE_MS {
                    Some((c.handle, "idle", CLOSE_GOING_AWAY))
                } else {
                    None
                }
            })
            .collect();
        for (h, why, code) in stale {
            self.kick(h, code, why, now, &mut acts);
        }
        acts
    }

    /// The socket is gone (closed by the peer or errored).
    pub fn on_close(&mut self, handle: u16, now: u64) -> Vec<Action> {
        let mut acts = vec![];
        self.remove(handle, now, &mut acts);
        acts
    }

    fn roll_day(&mut self, now: u64) {
        let day = now / 86_400_000;
        if day != self.day {
            self.day = day;
            self.per_address.clear();
        }
    }

    /// Counts one frame against the address's day. The table is keyed by what a network gives us, and a client
    /// with a whole IPv6 block can take on a new /64 for every frame, so it is emptied if it ever gets this big
    /// (which costs a flood that many addresses to reset the budgets and nothing to anybody else).
    fn address_allowed(&mut self, ip: &str, now: u64) -> bool {
        self.roll_day(now);
        if self.per_address.len() >= MAX_ADDRESSES && !self.per_address.contains_key(ip) {
            self.per_address.clear();
        }
        let n = self.per_address.entry(ip.to_string()).or_insert(0);
        *n = n.saturating_add(1);
        *n <= self.day_limit
    }

    /// A text frame: the protocol has none. Closed at once, since the runtime has already read and billed the whole
    /// message (up to its 1 MiB limit) and nothing else would ever count it.
    pub fn on_text(&mut self, handle: u16, now: u64) -> Vec<Action> {
        let mut acts = vec![];
        if self.conns.contains_key(&handle) {
            self.count_drop("text");
            self.kick(handle, CLOSE_UNSUPPORTED, "binary only", now, &mut acts);
        }
        acts
    }

    pub fn on_binary(&mut self, handle: u16, b: &[u8], now: u64) -> Vec<Action> {
        let mut acts = vec![];
        // Batching holds states only while the relay is busy: another event came less than batch_ms ago, so the next one is likely soon (see flush_due).
        self.short_run = if now.saturating_sub(self.last_event) < self.tune.batch_ms { self.short_run + 1 } else { 0 };
        self.busy = self.short_run >= self.tune.busy_gaps;
        self.last_event = now;
        let Some(c) = self.conns.get_mut(&handle) else { return acts };
        self.stats.frames_in += 1;
        self.stats.bytes_in += b.len() as u64;
        c.last_seen = now;
        if b.len() > MAX_FRAME {
            self.kick(handle, CLOSE_TOO_BIG, "frame too big", now, &mut acts);
            return acts;
        }
        let ip = c.ip.clone();
        let within_rate = c.all.take(now);
        let helloed = c.helloed;
        if !self.address_allowed(&ip, now) {
            // Closed rather than ignored: the day's request allowance is billed for every incoming frame, dropped or
            // not, so the only way to stop paying for this address's frames is to end its sockets.
            self.count_drop("address budget");
            self.kick(handle, CLOSE_POLICY, "daily allowance used", now, &mut acts);
            return acts;
        }
        if !within_rate {
            self.count_drop("rate");
            let c = self.conns.get_mut(&handle).unwrap();
            if now.saturating_sub(c.last_strike_ms) > RATE_FORGIVE_MS {
                c.rate_strikes = 0;
            }
            c.last_strike_ms = now;
            c.rate_strikes += 1;
            if c.rate_strikes >= MAX_RATE_STRIKES {
                self.kick(handle, CLOSE_POLICY, "too fast", now, &mut acts);
            }
            return acts;
        }
        let frame = match parse(b) {
            Ok(f) => f,
            Err(ParseError::BadHello) => {
                self.kick(handle, CLOSE_POLICY, "bad hello", now, &mut acts);
                return acts;
            }
            Err(_) if !helloed => {
                self.kick(handle, CLOSE_POLICY, "hello first", now, &mut acts);
                return acts;
            }
            Err(_) => {
                self.count_drop("malformed");
                let c = self.conns.get_mut(&handle).unwrap();
                c.malformed += 1;
                if c.malformed >= MAX_MALFORMED {
                    self.kick(handle, CLOSE_POLICY, "too many malformed frames", now, &mut acts);
                }
                return acts;
            }
        };
        match (helloed, frame) {
            (false, Frame::Hello { ver, want_k, info }) => {
                let online = self.conns.values().filter(|c| c.helloed).count() as u16 + 1;
                let k = if want_k == 0 { self.k3.clamp(1, K_MAX) } else { clamp_k(want_k) };
                let c = self.conns.get_mut(&handle).unwrap();
                c.info = info.to_vec();
                c.helloed = true;
                c.online_val = online;
                c.online_ms = now;
                c.ver = ver;
                c.k = if ver == VERSION_3 { k } else { self.k };
                acts.push(Action::Send(handle, if ver == VERSION_3 { welcome3(handle, online, c.k) } else { welcome(handle, online) }));
                acts.push(Action::Persist(handle));
            }
            (false, _) => self.kick(handle, CLOSE_POLICY, "hello first", now, &mut acts),
            (true, Frame::Hello { .. }) => self.kick(handle, CLOSE_POLICY, "second hello", now, &mut acts),
            (true, Frame::Info { info }) => self.on_info(handle, info, now, &mut acts),
            (true, Frame::State { body, x, z }) => self.on_state(handle, body, x, z, now, &mut acts),
            (true, Frame::Say { phrase }) => self.on_say(handle, phrase, now, &mut acts),
            (true, Frame::To { handle: target, direct }) => self.on_to(handle, target, direct, now, &mut acts),
        }
        self.piggyback_online(handle, now, &mut acts);
        self.flush_due(now, &mut acts);
        acts
    }

    fn on_info(&mut self, handle: u16, info: &[u8], now: u64, acts: &mut Vec<Action>) {
        let c = self.conns.get_mut(&handle).unwrap();
        if c.last_info_ms.is_some_and(|t| now < t + INFO_EVERY_MS) {
            self.count_drop("info rate");
            return;
        }
        c.last_info_ms = Some(now);
        c.info = info.to_vec();
        acts.push(Action::Persist(handle));
        // A repeated ENTER is how a receiver learns a changed name or livery.
        let frame = enter(handle, info);
        acts.extend(c.watchers.iter().map(|w| Action::Send(*w, frame.clone())));
    }

    fn on_state(&mut self, handle: u16, body: &[u8], x: f32, z: f32, now: u64, acts: &mut Vec<Action>) {
        let c = self.conns.get_mut(&handle).unwrap();
        c.pos = Some((x, z));
        c.last_state = Some(body.to_vec());
        if c.last_recompute.is_none_or(|t| now >= t + RECOMPUTE_MS) {
            self.recompute(handle, now, acts);
            acts.push(Action::Persist(handle)); // the new position goes into the attachment with the set
        }
        let frame = state_frame(handle, body);
        let radius = self.tune.radius;
        let mut nearest: Option<f32> = None;
        for w in self.conns[&handle].watchers.clone() {
            let Some(r) = self.conns.get_mut(&w) else { continue };
            let Some((rx, rz)) = r.pos else { continue };
            let d = (rx - x).hypot(rz - z);
            nearest = Some(nearest.map_or(d, |n| n.min(d)));
            let mut wait = forward_interval_ms(d);
            let v3 = r.ver == VERSION_3;
            if v3 {
                if let Some(e) = r.bgap.iter().find(|e| e.0 == handle) {
                    wait = wait.max(e.1);
                }
                if d > radius {
                    wait = wait.max(self.tune.far_gap_ms);
                }
            }
            match r.last_fwd.iter_mut().find(|e| e.0 == handle) {
                Some(e) if now < e.1 + wait => {
                    self.stats.thinned += 1;
                    continue;
                }
                Some(e) => e.1 = now,
                None => r.last_fwd.push((handle, now)),
            }
            self.stats.forwarded += 1;
            self.deliver(w, handle, &frame, body, now, acts);
        }
        self.tell_audience(handle, nearest, acts);
    }

    /// One state for one receiver: straight out, or into the receiver's box when it is a v3 player holding enough players and the relay is busy.
    fn deliver(&mut self, w: u16, from: u16, frame: &[u8], body: &[u8], now: u64, acts: &mut Vec<Action>) {
        let bx = self.tune.batch_ms;
        let Some(r) = self.conns.get_mut(&w) else { return };
        let batching = r.ver == VERSION_3 && r.set.len() >= self.tune.batch_min_held && bx > 0;
        if !batching {
            if !r.box_t.is_empty() {
                self.flush(w, now, acts); // the receiver dropped below the number that is batched: what waits goes first, so the order is kept
            }
            acts.push(Action::Send(w, frame.to_vec()));
            return;
        }
        // The first state after a quiet spell, and any state while the relay is quiet, goes at once; only a state that comes within batch_ms of the last frame
        // sent to this receiver, while other events are arriving, waits.
        if r.box_t.is_empty() && (!self.busy || now >= r.last_flush + bx) {
            r.last_flush = now;
            self.stats.batches += 1;
            self.stats.batched_states += 1;
            self.stats.note_wait(0);
            acts.push(Action::Send(w, frame.to_vec()));
            return;
        }
        if r.box_t.is_empty() {
            self.pending.push(w);
        }
        r.box_full.extend_from_slice(&from.to_le_bytes());
        r.box_full.extend_from_slice(body);
        r.box_t.push(now);
        if r.box_t.len() >= self.tune.batch_max.max(2) {
            self.flush(w, now, acts);
        }
    }

    /// Sends what waits for `w` as one frame (a single state as the plain STATE frame).
    fn flush(&mut self, w: u16, now: u64, acts: &mut Vec<Action>) {
        let Some(r) = self.conns.get_mut(&w) else { return };
        if r.box_t.is_empty() {
            return;
        }
        let n = r.box_t.len();
        for t in r.box_t.drain(..) {
            self.stats.note_wait(now.saturating_sub(t));
        }
        r.last_flush = now;
        let buf = std::mem::take(&mut r.box_full);
        self.stats.batches += 1;
        self.stats.batched_states += n as u64;
        acts.push(Action::Send(w, if n == 1 { [&[4u8][..], &buf].concat() } else { batch_frame(n, &buf) }));
    }

    /// Flushes every receiver whose oldest waiting state is `batch_ms` old. Called after every event: this is the whole mechanism, there is no timer.
    /// What bounds the wait: a state waits only if it came within batch_ms of the last frame sent to its receiver, and then until the next event of ANY player at or
    /// after batch_ms later. It is not waiting for a frame that may never come: while it waits the relay is busy (it was entered only when another event had come less than
    /// batch_ms before), the receiver holds at least BATCH_MIN_HELD players, and every one of them sends at least once every keepalive of its audience (1 s moving,
    /// 4 s parked; a player held by nobody is not in a box). So the wait is at most the longest gap between two events of those players: 1 s if any of them
    /// is moving, and the car it concerns is then also the one whose next state flushes the box; 4 s if all are parked, and nothing it holds moves.
    fn flush_due(&mut self, now: u64, acts: &mut Vec<Action>) {
        if self.pending.is_empty() {
            return;
        }
        let bx = self.tune.batch_ms;
        let list = std::mem::take(&mut self.pending);
        for w in list {
            match self.conns.get(&w).map(|r| r.box_t.first().copied()) {
                Some(Some(t)) if now >= t + bx => self.flush(w, now, acts),
                Some(Some(_)) => self.pending.push(w),
                _ => {}
            }
        }
    }

    /// Tells a v3 player how far the nearest player that holds it is, as a band, when the band changed. Sent on the back of events that happen anyway; never from a timer.
    /// `nearest` is the distance to the nearest holder, None when nobody holds it. A move to a nearer band is told at once, a move to a farther one only when the
    /// holder is AUDIENCE_STAY times past the edge, so a holder at the edge does not make the player's pace flip.
    fn tell_audience(&mut self, handle: u16, nearest: Option<f32>, acts: &mut Vec<Action>) {
        let Some(c) = self.conns.get_mut(&handle) else { return };
        if c.ver != VERSION_3 {
            return;
        }
        let band = nearest.map_or(0, audience_band);
        let sent = c.aud_sent;
        let keep = sent != 255 && sent != 0 && band > sent && nearest.is_some_and(|d| audience_band(d / AUDIENCE_STAY) <= sent);
        if band == sent || keep {
            return;
        }
        c.aud_sent = band;
        self.stats.audience_sent += 1;
        acts.push(Action::Send(handle, audience_frame(band)));
    }

    /// The nearest holder of `handle` by the positions known now.
    fn audience_of(&self, handle: u16) -> Option<f32> {
        let c = self.conns.get(&handle)?;
        let (x, z) = c.pos?;
        c.watchers.iter().filter_map(|w| self.conns.get(w).and_then(|r| r.pos)).map(|(rx, rz)| (rx - x).hypot(rz - z)).fold(None, |a: Option<f32>, d| Some(a.map_or(d, |a| a.min(d))))
    }

    fn on_say(&mut self, handle: u16, phrase: u8, now: u64, acts: &mut Vec<Action>) {
        let c = self.conns.get_mut(&handle).unwrap();
        if !c.say.take(now) {
            self.count_drop("say rate");
            return;
        }
        let Some((x, z)) = c.pos else { return };
        let watchers = c.watchers.clone();
        let frame = say_frame(handle, phrase);
        let near: Vec<u16> = watchers
            .into_iter()
            .filter(|w| self.conns.get(w).and_then(|r| r.pos).is_some_and(|(rx, rz)| (rx - x).hypot(rz - z) <= SAY_RADIUS_M))
            .collect();
        self.stats.forwarded += near.len() as u64;
        acts.extend(near.into_iter().map(|w| Action::Send(w, frame.clone())));
    }

    fn on_to(&mut self, handle: u16, target: u16, direct: &[u8], now: u64, acts: &mut Vec<Action>) {
        let c = self.conns.get_mut(&handle).unwrap();
        if !c.to.take(now) {
            self.count_drop("to rate");
            return;
        }
        if c.watchers.contains(&target) {
            self.stats.forwarded += 1;
            acts.push(Action::Send(target, to_frame(handle, direct)));
        } else {
            self.count_drop("to not allowed");
        }
    }

    /// Tells this player how many are online, at most every 10 s and only when the number changed. It rides on a
    /// frame the player just sent: the game sends a state at least every 2 s, so no timer is needed.
    fn piggyback_online(&mut self, handle: u16, now: u64, acts: &mut Vec<Action>) {
        let Some(c) = self.conns.get(&handle) else { return };
        if !c.helloed || now < c.online_ms + ONLINE_EVERY_MS {
            return;
        }
        let n = self.online();
        let c = self.conns.get_mut(&handle).unwrap();
        if n != c.online_val {
            c.online_val = n;
            c.online_ms = now;
            acts.push(Action::Send(handle, online_frame(n)));
        }
    }

    /// Picks this player's set again from the positions known now and sends the ENTERs and LEAVEs that follow.
    fn recompute(&mut self, handle: u16, now: u64, acts: &mut Vec<Action>) {
        let c = &self.conns[&handle];
        let Some((x, z)) = c.pos else { return };
        let cands: Vec<(u16, f32)> = self
            .conns
            .values()
            .filter(|o| o.handle != handle && o.helloed)
            .filter_map(|o| o.pos.map(|(ox, oz)| (o.handle, (ox - x).hypot(oz - z))))
            .collect();
        let new = if c.ver == VERSION_3 {
            // within the radius (a member stays until it is 15 % beyond it), the nearest k; plus the nearest few beyond it
            let rad = self.tune.radius;
            let near_c: Vec<(u16, f32)> = cands.iter().filter(|o| o.1 <= rad || (o.1 <= rad * SET_RADIUS_STAY && c.set.contains(&o.0))).copied().collect();
            let far_c: Vec<(u16, f32)> = cands.iter().filter(|o| !near_c.iter().any(|n| n.0 == o.0)).copied().collect();
            let mut set = select_set(&c.set, &near_c, c.k, HYSTERESIS_M);
            let near_n = set.len();   // the budget is for the players held inside the radius: the far slots have their own, slower, pace
            if self.tune.far_slots > 0 {
                set.extend(select_set(&c.set, &far_c, self.tune.far_slots, HYSTERESIS_M));
            }
            if near_n > self.tune.budget_above {
                let ws: Vec<(u16, f32)> = set[..near_n].iter().map(|m| (*m, 1.0 / (1.0 + cands.iter().find(|o| o.0 == *m).map_or(1e4, |o| o.1) / 60.0))).collect();
                let tot: f32 = ws.iter().map(|w| w.1).sum();
                let b = self.tune.budget_rate;
                let gaps: Vec<(u16, u64)> = ws.iter().map(|(m, w)| (*m, { let rate = b * w / tot; if rate >= 10.0 { 0 } else { (1000.0 / rate) as u64 } })).collect();
                self.conns.get_mut(&handle).unwrap().bgap = gaps;
            } else {
                self.conns.get_mut(&handle).unwrap().bgap.clear();
            }
            set
        } else {
            select_set(&c.set, &cands, self.k, HYSTERESIS_M)
        };
        self.apply_set(handle, new, now, acts);
        self.conns.get_mut(&handle).unwrap().last_recompute = Some(now);
    }

    fn apply_set(&mut self, handle: u16, new: Vec<u16>, now: u64, acts: &mut Vec<Action>) {
        let old = self.conns[&handle].set.clone();
        let removed: Vec<u16> = old.iter().copied().filter(|m| !new.contains(m)).collect();
        let added: Vec<u16> = new.iter().copied().filter(|m| !old.contains(m)).collect();
        if removed.is_empty() && added.is_empty() {
            return;
        }
        self.flush(handle, now, acts); // states waiting for this player go before any ENTER or LEAVE, so the order the player sees is the order they happened
        for m in removed.iter().copied() {
            acts.push(Action::Send(handle, leave(m)));
            if let Some(o) = self.conns.get_mut(&m) {
                o.watchers.retain(|w| *w != handle);
            }
            self.conns.get_mut(&handle).unwrap().last_fwd.retain(|e| e.0 != m);
        }
        for m in added.iter().copied() {
            let o = self.conns.get_mut(&m).unwrap();
            o.watchers.push(handle);
            acts.push(Action::Send(handle, enter(m, &o.info)));
            // Its latest state goes right after the ENTER, so the new neighbour appears at once instead of at its next one.
            let latest = o.last_state.clone();
            if let Some(body) = latest {
                self.stats.forwarded += 1;
                acts.push(Action::Send(handle, state_frame(m, &body)));
                self.conns.get_mut(&handle).unwrap().last_fwd.push((m, now));
            }
        }
        self.conns.get_mut(&handle).unwrap().set = new;
        acts.push(Action::Persist(handle));
        // whoever gained or lost a holder may now be watched from nearer or farther, or by nobody: tell it now, not at its next state
        for m in added.into_iter().chain(removed) {
            let near = self.audience_of(m);
            self.tell_audience(m, near, acts);
        }
    }

    fn kick(&mut self, handle: u16, code: u16, why: &'static str, now: u64, acts: &mut Vec<Action>) {
        acts.push(Action::Close(handle, code, why));
        self.remove(handle, now, acts);
    }

    fn remove(&mut self, handle: u16, now: u64, acts: &mut Vec<Action>) {
        let Some(gone) = self.conns.remove(&handle) else { return };
        if !gone.helloed {
            return;
        }
        for m in &gone.set {
            if let Some(o) = self.conns.get_mut(m) {
                o.watchers.retain(|w| *w != handle);
            }
            let near = self.audience_of(*m);
            self.tell_audience(*m, near, acts);
        }
        for w in gone.watchers {
            self.flush(w, now, acts);
            let Some(r) = self.conns.get_mut(&w) else { continue };
            r.set.retain(|m| *m != handle);
            r.last_fwd.retain(|e| e.0 != handle);
            acts.push(Action::Send(w, leave(handle)));
            acts.push(Action::Persist(w));
            // A member left: take the next nearest straight away, without waiting for the player's next state.
            self.recompute(w, now, acts);
        }
    }

    pub fn stats_json(&self) -> String {
        let dropped: Vec<String> = self.stats.dropped.iter().map(|(k, v)| format!("\"{}\":{}", k, v)).collect();
        format!(
            "{{\"online\":{},\"connections\":{},\"framesIn\":{},\"framesForwarded\":{},\"framesThinned\":{},\"bytesIn\":{},\"dropped\":{{{}}}}}",
            self.online(),
            self.conns.len(),
            self.stats.frames_in,
            self.stats.forwarded,
            self.stats.thinned,
            self.stats.bytes_in,
            dropped.join(",")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::tests::{hello, info, state};

    fn say(p: u8) -> Vec<u8> {
        vec![4, p]
    }
    fn to(h: u16, d: &[u8]) -> Vec<u8> {
        [&[5u8][..], &h.to_le_bytes(), d].concat()
    }
    /// All frames sent to `h` by these actions, in order.
    fn sent(acts: &[Action], h: u16) -> Vec<&Vec<u8>> {
        acts.iter().filter_map(|a| if let Action::Send(t, b) = a { (*t == h).then_some(b) } else { None }).collect()
    }
    fn of_type<'a>(acts: &'a [Action], h: u16, ty: u8) -> Vec<&'a Vec<u8>> {
        sent(acts, h).into_iter().filter(|b| b[0] == ty).collect()
    }

    fn join(hub: &mut Hub, name: &str, ip: &str, now: u64) -> u16 {
        let h = hub.accept(ip, now).unwrap().0;
        let acts = hub.on_binary(h, &hello(name), now);
        assert_eq!(of_type(&acts, h, 1).len(), 1, "WELCOME");
        h
    }

    /// Joins a player and has it send one STATE at (x, 0).
    fn spawn(hub: &mut Hub, name: &str, x: f64, now: u64) -> u16 {
        let h = join(hub, name, &format!("ip-{name}"), now);
        hub.on_binary(h, &state(x, 0.0), now);
        h
    }

    #[test]
    fn welcome_carries_handle_and_online_count() {
        let mut hub = Hub::new(7);
        let a = hub.accept("1", 0).unwrap().0;
        let acts = hub.on_binary(a, &hello("a"), 0);
        assert_eq!(sent(&acts, a), vec![&welcome(a, 1)]);
        let b = hub.accept("2", 0).unwrap().0;
        let acts = hub.on_binary(b, &hello("b"), 0);
        assert_eq!(sent(&acts, b), vec![&welcome(b, 2)]);
        assert_ne!(a, b);
        assert_ne!(a, 0);
    }

    #[test]
    fn enter_comes_before_the_first_state_and_carries_the_info() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "alice", 0.0, 0);
        let b = join(&mut hub, "bob", "ip-bob", 0);
        // b's first state: b learns about a (ENTER, then a's latest state), a learns nothing yet
        let acts = hub.on_binary(b, &state(50.0, 0.0), 0);
        let to_b = sent(&acts, b);
        assert_eq!(to_b[0], &enter(a, &info("alice")[1..]));
        assert_eq!(to_b[1][0], 4, "a's last state follows its ENTER at once");
        assert_eq!(&to_b[1][1..3], &a.to_le_bytes());
        assert!(sent(&acts, a).is_empty());
        // a's next state (a second later, so its set is recomputed) brings b to a: ENTER first, then states
        let acts = hub.on_binary(a, &state(1.0, 0.0), 1100);
        let to_a = sent(&acts, a);
        assert_eq!(to_a[0], &enter(b, &info("bob")[1..]));
        assert_eq!(to_a[1][0], 4);
        // and from now on a's states reach b
        let acts = hub.on_binary(a, &state(2.0, 0.0), 1200);
        assert_eq!(of_type(&acts, b, 4).len(), 1);
    }

    #[test]
    fn states_only_reach_players_with_the_sender_in_their_set() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0);
        hub.on_binary(a, &state(0.0, 0.0), 1100); // a picks up b
        let acts = hub.on_binary(b, &state(10.0, 0.0), 1200);
        assert_eq!(of_type(&acts, a, 4).len(), 1, "b is in a's set");
        assert!(of_type(&acts, b, 4).is_empty());
    }

    #[test]
    fn the_set_is_capped_at_k_and_holds_the_nearest() {
        let mut hub = Hub::new(1);
        let me = spawn(&mut hub, "me", 0.0, 0);
        let others: Vec<u16> = (1..=20).map(|i| spawn(&mut hub, &format!("p{i}"), i as f64 * 100.0, 0)).collect();
        hub.on_binary(me, &state(0.0, 0.0), 1100);
        let mut set = hub.conn(me).unwrap().set.clone();
        set.sort_unstable();
        let mut want: Vec<u16> = others[..K].to_vec();
        want.sort_unstable();
        assert_eq!(set, want);
        assert_eq!(K, 8);
    }

    #[test]
    fn leave_when_a_member_disconnects_and_the_next_nearest_comes_in() {
        let mut hub = Hub::new(1);
        let me = spawn(&mut hub, "me", 0.0, 0);
        let others: Vec<u16> = (1..=9).map(|i| spawn(&mut hub, &format!("p{i}"), i as f64 * 100.0, 0)).collect();
        hub.on_binary(me, &state(0.0, 0.0), 1100);
        assert!(!hub.conn(me).unwrap().set.contains(&others[8]));
        let acts = hub.on_close(others[0], 1200);
        let to_me = sent(&acts, me);
        assert_eq!(to_me[0], &leave(others[0]));
        assert_eq!(to_me[1], &enter(others[8], &info("p9")[1..]), "the ninth takes the free slot");
        assert!(hub.conn(me).unwrap().set.contains(&others[8]));
        assert!(!hub.conn(me).unwrap().set.contains(&others[0]));
    }

    #[test]
    fn leave_when_a_player_goes_far_and_hysteresis_holds_it_back_until_then() {
        let mut hub = Hub::new(1);
        let me = spawn(&mut hub, "me", 0.0, 0);
        let near: Vec<u16> = (1..=8).map(|i| spawn(&mut hub, &format!("n{i}"), i as f64 * 10.0, 0)).collect();
        let late = spawn(&mut hub, "late", 5000.0, 0);
        hub.on_binary(me, &state(0.0, 0.0), 1100);
        assert!(!hub.conn(me).unwrap().set.contains(&late));
        // the farthest member (80 m) drives away to 5030 m; the outsider at 5000 m is only 30 m nearer: it swaps in
        hub.on_binary(near[7], &state(5000.0 + 29.0, 0.0), 1500);
        let acts = hub.on_binary(me, &state(0.0, 0.0), 2200);
        assert!(sent(&acts, me).iter().all(|f| f[0] != 3), "29 m nearer is not enough: no LEAVE");
        hub.on_binary(near[7], &state(5000.0 + 31.0, 0.0), 2300);
        let acts = hub.on_binary(me, &state(0.0, 0.0), 3300);
        let to_me = sent(&acts, me);
        assert_eq!(to_me[0], &leave(near[7]));
        assert_eq!(to_me[1], &enter(late, &info("late")[1..]));
    }

    #[test]
    fn recompute_is_lazy_at_most_once_a_second() {
        let mut hub = Hub::new(1);
        let me = spawn(&mut hub, "me", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0);
        // b is not picked up by a frame 500 ms after the last recompute
        let acts = hub.on_binary(me, &state(0.0, 0.0), 500);
        assert!(of_type(&acts, me, 2).is_empty());
        let acts = hub.on_binary(me, &state(0.0, 0.0), 1000);
        assert_eq!(of_type(&acts, me, 2).len(), 1);
        assert_eq!(hub.conn(me).unwrap().set, vec![b]);
    }

    #[test]
    fn thinning_by_distance() {
        let mut hub = Hub::new(1);
        let rx = spawn(&mut hub, "rx", 0.0, 0);
        let near = spawn(&mut hub, "near", 100.0, 0);
        let mid = spawn(&mut hub, "mid", 300.0, 0);
        let far = spawn(&mut hub, "far", 800.0, 0);
        let afar = spawn(&mut hub, "afar", 5000.0, 0);
        hub.on_binary(rx, &state(0.0, 0.0), 1000); // set: all four; each came with its latest state, at t = 1000
        let count = |hub: &mut Hub, who: u16, x: f64, t: u64| of_type(&hub.on_binary(who, &state(x, 0.0), t), rx, 4).len();
        for (who, x, gap) in [(near, 100.0, 0u64), (mid, 300.0, 195), (far, 800.0, 995), (afar, 5000.0, 2495)] {
            // one just after the ENTER's state, then probes before and at the gap
            if gap > 0 {
                assert_eq!(count(&mut hub, who, x, 1000 + gap - 1), 0, "x={x} too early");
            }
            assert_eq!(count(&mut hub, who, x, 1000 + gap), 1, "x={x} at the gap");
            assert_eq!(count(&mut hub, who, x, 1000 + gap + 1), if gap == 0 { 1 } else { 0 }, "x={x} right after");
        }
        assert!(hub.stats.thinned >= 6);
    }

    #[test]
    fn say_reaches_near_watchers_only() {
        let mut hub = Hub::new(1);
        let s = spawn(&mut hub, "s", 0.0, 0);
        let close = spawn(&mut hub, "close", 399.0, 0);
        let edge = spawn(&mut hub, "edge", 401.0, 0);
        let other = spawn(&mut hub, "other", 100.0, 0);
        for h in [close, edge, other] {
            hub.on_binary(h, &state(hub.conn(h).unwrap().pos.unwrap().0 as f64, 0.0), 1100);
        }
        let acts = hub.on_binary(s, &say(5), 1200);
        assert_eq!(of_type(&acts, close, 5), vec![&say_frame(s, 5)]);
        assert!(of_type(&acts, edge, 5).is_empty(), "401 m is beyond the radius");
        assert_eq!(of_type(&acts, other, 5).len(), 1);
        // a player who does not have s in its set hears nothing even when close
        let mut hub = Hub::new(1);
        let lonely = spawn(&mut hub, "lonely", 10.0, 0); // sent its state before s existed and has not recomputed since
        let s = spawn(&mut hub, "s", 0.0, 0);
        let acts = hub.on_binary(s, &say(1), 1200);
        assert!(of_type(&acts, lonely, 5).is_empty());
    }

    #[test]
    fn to_only_when_the_target_has_the_sender() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0); // b picked up a when it sent its first state; a has not picked up b yet
        // a -> b: b has a in its set
        assert_eq!(sent(&hub.on_binary(a, &to(b, &[1, 2]), 1200), b), vec![&to_frame(a, &[1, 2])]);
        // b -> a: a does not have b in its set
        assert!(sent(&hub.on_binary(b, &to(a, &[9]), 1200), a).is_empty());
        assert_eq!(hub.stats.dropped["to not allowed"], 1);
        // once a recomputes, both ways work
        hub.on_binary(a, &state(0.0, 0.0), 1300);
        assert_eq!(sent(&hub.on_binary(b, &to(a, &[9]), 1400), a), vec![&to_frame(b, &[9])]);
        // unknown handle
        assert!(hub.on_binary(a, &to(4000, &[1]), 3000).is_empty());
    }

    #[test]
    fn info_change_reaches_watchers_as_a_repeated_enter() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0);
        hub.on_binary(a, &state(0.0, 0.0), 1100);
        let acts = hub.on_binary(b, &info("Bobby"), 1200);
        assert_eq!(of_type(&acts, a, 2), vec![&enter(b, &info("Bobby")[1..])]);
        // a second INFO within 2 s is dropped
        assert!(sent(&hub.on_binary(b, &info("Bob2"), 2000), a).is_empty());
        assert_eq!(hub.stats.dropped["info rate"], 1);
        assert_eq!(sent(&hub.on_binary(b, &info("Bob3"), 3300), a).len(), 1);
    }

    #[test]
    fn malformed_frames_drop_and_twenty_close() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let mut t = 1000;
        for i in 0..19 {
            t += 100;
            assert!(hub.on_binary(a, &[4], t).is_empty(), "frame {i}");
        }
        assert_eq!(hub.stats.dropped["malformed"], 19);
        t += 100;
        assert_eq!(hub.on_binary(a, &[4], t), vec![Action::Close(a, 1008, "too many malformed frames")]);
        assert_eq!(hub.len(), 0);
    }

    #[test]
    fn oversize_closes_1009_and_bad_or_second_hello_1008() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        assert_eq!(hub.on_binary(a, &[3u8; 97], 0), vec![Action::Close(a, 1009, "frame too big")]);
        let b = hub.accept("1", 0).unwrap().0;
        assert_eq!(hub.on_binary(b, &[1, 1, 0, 0, 0], 0), vec![Action::Close(b, 1008, "bad hello")]);
        let c = hub.accept("1", 0).unwrap().0;
        assert_eq!(hub.on_binary(c, &state(0.0, 0.0), 0), vec![Action::Close(c, 1008, "hello first")]);
        let d = join(&mut hub, "d", "1", 0);
        assert_eq!(hub.on_binary(d, &hello("d"), 0), vec![Action::Close(d, 1008, "second hello")]);
    }

    #[test]
    fn rate_limits() {
        let mut hub = Hub::new(1);
        let a = join(&mut hub, "a", "1", 0); // one token used
        let sent_ok = (0..60).filter(|_| !hub.on_binary(a, &state(0.0, 0.0), 0).is_empty()).count();
        assert_eq!(sent_ok, 1, "burst 30 in all, minus HELLO: 29 frames pass; only the first changes anything");
        assert_eq!(hub.stats.dropped["rate"], 60 - 29);
        // SAY: burst 3 then one a second (use spaced frames so the all-frames bucket is not the limit)
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0);
        hub.on_binary(b, &state(10.0, 0.0), 1100);
        hub.on_binary(a, &state(0.0, 0.0), 1100);
        let n = (0..8u64).filter(|i| !of_type(&hub.on_binary(a, &say(1), 1200 + i * 10), b, 5).is_empty()).count();
        assert_eq!(n, 3);
        assert_eq!(hub.stats.dropped["say rate"], 5);
        assert_eq!(of_type(&hub.on_binary(a, &say(1), 2300), b, 5).len(), 1, "one a second again");
        // TO: burst 6 then two a second
        let ok = (0..9u64).filter(|i| !sent(&hub.on_binary(b, &to(a, &[1]), 3000 + i * 10), a).is_empty()).count();
        assert_eq!(ok, 6);
        assert_eq!(hub.stats.dropped["to rate"], 3);
    }

    /// Fills the relay to MAX_CONNS with one place per address (10.x.y.z), after whatever is there already.
    fn fill_with_singles(hub: &mut Hub, tag: u8) {
        let mut n = 0u32;
        while hub.len() < MAX_CONNS {
            hub.accept(&format!("10.{tag}.{}.{}", n / 250, n % 250), 0).unwrap();
            n += 1;
        }
    }

    #[test]
    fn connection_caps() {
        let mut hub = Hub::new(1);
        for _ in 0..MAX_PER_IP {
            hub.accept("same", 0).unwrap();
        }
        assert_eq!(hub.accept("same", 0), Err(Refuse::PerAddress));
        fill_with_singles(&mut hub, 1);
        // 300 places, 24 of them one address's: that address gives one up for a newcomer
        let (_, acts) = hub.accept("fresh", 0).unwrap();
        assert!(matches!(acts[0], Action::Close(_, 1013, "making room")), "{acts:?}");
        assert_eq!(hub.len(), MAX_CONNS);
    }

    #[test]
    fn no_address_can_sit_on_every_place() {
        let mut hub = Hub::new(1);
        let hello_less: Vec<u16> = (0..MAX_PER_IP).map(|_| hub.accept("9.9.9.9", 0).unwrap().0).collect();
        fill_with_singles(&mut hub, 2);
        // the biggest holder loses the socket that never said HELLO (all of them here: the lowest handle goes first)
        let (_, acts) = hub.accept("2001:db8::1", 0).unwrap();
        assert_eq!(acts, vec![Action::Close(hello_less[0], 1013, "making room")]);
        assert_eq!(hub.conns.values().filter(|c| c.ip == "9.9.9.9").count(), MAX_PER_IP - 1);
        // a player that said HELLO is kept over one that did not
        let mut hub = Hub::new(1);
        let talker = join(&mut hub, "t", "9.9.9.9", 0);
        let silent = hub.accept("9.9.9.9", 0).unwrap().0;
        for _ in 2..MAX_PER_IP {
            hub.accept("9.9.9.9", 0).unwrap();
        }
        fill_with_singles(&mut hub, 3);
        let (_, acts) = hub.accept("8.8.8.8", 0).unwrap();
        assert!(matches!(acts[0], Action::Close(h, ..) if h != talker), "{acts:?} (silent {silent})");
    }

    #[test]
    fn making_room_needs_two_places_more_than_the_newcomer_holds() {
        // 300 addresses with one place each: nothing to take
        let mut flat = Hub::new(1);
        fill_with_singles(&mut flat, 4);
        assert_eq!(flat.accept("192.0.2.1", 0), Err(Refuse::Full));
        // the biggest holds 2, the newcomer none: a place is made; the newcomer then holds 1 and the other 1: nothing more
        let mut two = Hub::new(1);
        two.accept("7.7.7.7", 0).unwrap();
        two.accept("7.7.7.7", 0).unwrap();
        fill_with_singles(&mut two, 5);
        assert!(two.accept("192.0.2.1", 0).is_ok());
        assert_eq!(two.accept("192.0.2.2", 0), Err(Refuse::Full));
        // an address with 23 places cannot take from one with 24 (it would only swap the problem round)
        let mut hub = Hub::new(1);
        for _ in 0..MAX_PER_IP {
            hub.accept("9.9.9.9", 0).unwrap();
        }
        for _ in 0..MAX_PER_IP - 1 {
            hub.accept("8.8.8.8", 0).unwrap();
        }
        fill_with_singles(&mut hub, 6);
        assert_eq!(hub.accept("8.8.8.8", 0), Err(Refuse::Full));
    }

    #[test]
    fn an_ipv6_client_counts_by_its_64() {
        let mut hub = Hub::new(1);
        for i in 0..MAX_PER_IP {
            hub.accept(&format!("2001:db8:1:2:{i:x}::{i:x}"), 0).unwrap();
        }
        assert_eq!(hub.accept("2001:db8:1:2:ffff:ffff:ffff:ffff", 0), Err(Refuse::PerAddress), "same /64");
        assert!(hub.accept("2001:db8:1:3::1", 0).is_ok(), "the next /64 is another client");
        // the daily frames are shared by the /64 too
        let mut h = Hub::new(1);
        h.day_limit = 5;
        let a = join(&mut h, "a", "2001:db8:1:2::1", 0);
        let b = join(&mut h, "b", "2001:db8:1:2::2", 0); // frame 2 of the same /64
        let mut closed = false;
        for i in 0..3 {
            closed |= h.on_binary(b, &state(1.0, 1.0), 100 + i * 100).iter().any(|x| matches!(x, Action::Close(..)));
        }
        assert!(!closed, "frames 3 to 5");
        let acts = h.on_binary(a, &state(0.0, 0.0), 300);
        assert_eq!(acts, vec![Action::Close(a, 1008, "daily allowance used")], "frame 6 of the shared /64");
    }

    #[test]
    fn daily_budget_per_address_closes_the_socket_then_fresh_next_day() {
        let mut hub = Hub::new(1);
        hub.day_limit = 10;
        let a = join(&mut hub, "a", "1.1.1.1", 0); // frame 1
        let other = join(&mut hub, "o", "2.2.2.2", 0);
        for i in 1..10u64 {
            let acts = hub.on_binary(a, &state(0.0, 0.0), i * 100);
            assert!(!acts.iter().any(|x| matches!(x, Action::Close(..))), "frame {}", i + 1);
        }
        assert_eq!(hub.on_binary(a, &state(0.0, 0.0), 1000), vec![Action::Close(a, 1008, "daily allowance used")], "frame 11");
        assert_eq!(hub.stats.dropped["address budget"], 1);
        assert_eq!(hub.len(), 1, "the socket is gone, not just ignored");
        assert_eq!(hub.accept("1.1.1.1", 2000), Err(Refuse::Budget), "and the address cannot come back today");
        assert!(hub.budget_used("1.1.1.1", 3000) && !hub.budget_used("9.9.9.9", 3000), "/status can say whose budget is used");
        assert!(!hub.budget_used("1.1.1.1", 86_400_000 + 1), "and it is fresh the next day");
        assert!(!hub.on_binary(other, &state(0.0, 0.0), 5000).is_empty(), "another address is not affected");
        assert!(hub.accept("1.1.1.1", 86_400_000 + 5).is_ok(), "fresh the next UTC day");
    }

    #[test]
    fn a_flood_over_the_rate_is_closed_after_the_strikes_and_a_quiet_spell_forgives() {
        let mut hub = Hub::new(1);
        let a = join(&mut hub, "a", "1.1.1.1", 0);
        let mut closed_at = None;
        for i in 0..400u64 {
            if hub.on_binary(a, &state(0.0, 0.0), 1 + i / 100).iter().any(|x| matches!(x, Action::Close(_, 1008, "too fast"))) {
                closed_at = Some(i);
                break;
            }
        }
        // 30 burst tokens (one used by the hello), then every frame is a strike
        assert_eq!(closed_at, Some(29 + MAX_RATE_STRIKES as u64 - 1), "closed on the {MAX_RATE_STRIKES}th strike");
        // the same overshoot spread out is forgiven
        let mut hub = Hub::new(1);
        let b = join(&mut hub, "b", "2.2.2.2", 0);
        let mut t = 1;
        for _ in 0..10 {
            for _ in 0..60 {
                assert!(!hub.on_binary(b, &state(0.0, 0.0), t).iter().any(|x| matches!(x, Action::Close(..))));
            }
            t += 20_000;
        }
    }

    #[test]
    fn a_text_frame_closes_the_socket() {
        let mut hub = Hub::new(1);
        let a = join(&mut hub, "a", "1.1.1.1", 0);
        assert_eq!(hub.on_text(a, 5), vec![Action::Close(a, 1003, "binary only")]);
        assert_eq!(hub.len(), 0);
        assert!(hub.on_text(a, 6).is_empty(), "already gone");
    }

    #[test]
    fn the_address_table_stays_bounded() {
        let mut hub = Hub::new(1);
        for i in 0..MAX_ADDRESSES + 10 {
            hub.address_allowed(&format!("a{i}"), 0);
        }
        assert!(hub.per_address.len() <= MAX_ADDRESSES);
    }

    #[test]
    fn hello_deadline_and_idle_are_enforced_lazily() {
        let mut hub = Hub::new(1);
        let silent = hub.accept("1", 0).unwrap().0;
        let a = join(&mut hub, "a", "2", 0);
        assert!(hub.sweep(9_000).is_empty());
        assert_eq!(hub.sweep(11_000), vec![Action::Close(silent, 1008, "no hello")]);
        hub.on_binary(a, &state(0.0, 0.0), 40_000);
        assert!(hub.sweep(99_000).is_empty());
        assert_eq!(hub.sweep(101_000), vec![Action::Close(a, 1001, "idle")]);
        assert_eq!(hub.len(), 0);
    }

    #[test]
    fn online_is_piggybacked_at_most_every_ten_seconds() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0); // welcome said 1
        assert!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 5_000), a, 7).is_empty());
        let _b = join(&mut hub, "b", "ipb", 6_000);
        assert!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 9_000), a, 7).is_empty(), "under 10 s since the welcome");
        assert_eq!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 10_000), a, 7), vec![&online_frame(2)]);
        // unchanged: nothing, even long after
        assert!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 11_000), a, 7).is_empty());
        let _c = join(&mut hub, "c", "ipc", 12_000);
        assert!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 15_000), a, 7).is_empty(), "10 s limit counts from the last ONLINE");
        assert_eq!(of_type(&hub.on_binary(a, &state(0.0, 0.0), 20_000), a, 7), vec![&online_frame(3)]);
    }

    #[test]
    fn attachment_roundtrip_and_size() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "Totò", 12.5, 5);
        let b = spawn(&mut hub, "b", 20.0, 5);
        hub.on_binary(a, &state(12.5, 0.0), 1100);
        let enc = hub.conn(a).unwrap().encode();
        let back = Conn::decode(&enc, 99).unwrap();
        assert_eq!(back.info, hub.conn(a).unwrap().info);
        assert_eq!(back.set, vec![b]);
        assert!(back.helloed);
        assert!((back.pos.unwrap().0 - 12.5).abs() < 0.03);
        assert!(Conn::decode(&enc[..enc.len() - 1], 0).is_none());

        let mut big = Conn::new(65535, &"i".repeat(45), 0);
        big.info = vec![0; 67];
        big.pos = Some((1.0, 2.0));
        big.set = (0..K as u16).collect();
        assert!(big.encode().len() < 200, "{}", big.encode().len());
    }

    #[test]
    fn state_survives_a_simulated_hibernation() {
        let mut hub = Hub::new(1);
        let a = spawn(&mut hub, "a", 0.0, 0);
        let b = spawn(&mut hub, "b", 10.0, 0);
        let gone = spawn(&mut hub, "g", 20.0, 0);
        hub.on_binary(a, &state(0.0, 0.0), 1100);
        let saved: Vec<Vec<u8>> = [a, b, gone].iter().map(|h| hub.conn(*h).unwrap().encode()).collect();

        let mut woke = Hub::new(500);
        woke.restore(saved.iter().take(2).map(|s| Conn::decode(s, 1_000_000).unwrap()).collect()); // g is gone
        assert_eq!(woke.conn(a).unwrap().set, vec![b], "a set naming a player that no longer exists is trimmed");
        // b's states still reach a, with no repeated ENTER needed
        let acts = woke.on_binary(b, &state(11.0, 0.0), 1_000_100);
        assert_eq!(of_type(&acts, a, 4).len(), 1);
        // a's first state after the wake-up recomputes, finds nothing new to announce
        let acts = woke.on_binary(a, &state(0.0, 0.0), 1_000_200);
        assert!(of_type(&acts, a, 2).is_empty() && of_type(&acts, a, 3).is_empty());
        let c = woke.accept("3", 1_000_000).unwrap().0;
        assert!(c != a && c != b);
    }

    #[test]
    fn stats_json_shape() {
        let mut hub = Hub::new(1);
        let a = join(&mut hub, "a", "1", 0);
        hub.on_binary(a, &[9, 9], 0);
        let j = hub.stats_json();
        assert!(j.starts_with("{\"online\":1,\"connections\":1,") && j.contains("\"malformed\":1"), "{j}");
    }

    // ---------- protocol v3 ----------

    fn hello3(name: &str, k: u8) -> Vec<u8> {
        [&[1u8, 3, k][..], &info(name)[1..]].concat()
    }
    fn join3(hub: &mut Hub, name: &str, k: u8, now: u64) -> u16 {
        let h = hub.accept(&format!("ip-{name}"), now).unwrap().0;
        let acts = hub.on_binary(h, &hello3(name, k), now);
        assert_eq!(of_type(&acts, h, 1).len(), 1, "WELCOME");
        h
    }
    /// A v3 player that has sent one state at (x, z).
    fn spawn3(hub: &mut Hub, name: &str, x: f64, z: f64, now: u64) -> u16 {
        let h = join3(hub, name, 0, now);
        hub.on_binary(h, &state(x, z), now);
        h
    }
    /// Lets every set settle: three rounds of one state from everybody, 1.1 s apart, starting at `t`. Returns the time after.
    fn settle(hub: &mut Hub, who: &[(u16, f64, f64)], t: u64) -> u64 {
        let mut t = t;
        for _ in 0..3 {
            t += 1100;
            for (h, x, z) in who {
                hub.on_binary(*h, &state(*x, *z), t);
            }
        }
        t
    }
    /// The (handle, state) entries of a BATCH frame, checking the frame is exactly laid out.
    fn batch_entries(f: &[u8]) -> Vec<(u16, Vec<u8>)> {
        assert_eq!(f[0], T_BATCH);
        let n = f[1] as usize;
        let (mut o, mut out) = (2, vec![]);
        for _ in 0..n {
            let h = u16::from_le_bytes([f[o], f[o + 1]]);
            let l = if f[o + 2 + 14] & 8 != 0 { 20 } else { 18 };
            out.push((h, f[o + 2..o + 2 + l].to_vec()));
            o += 2 + l;
        }
        assert_eq!(o, f.len(), "no byte left over");
        out
    }

    #[test]
    fn v3_welcome_gives_the_set_size_and_v2_gets_the_old_welcome() {
        let mut hub = Hub::new(1);
        let a = hub.accept("1", 0).unwrap().0;
        assert_eq!(sent(&hub.on_binary(a, &hello3("a", 0), 0), a), vec![&welcome3(a, 1, 32)]);
        let b = hub.accept("2", 0).unwrap().0;
        assert_eq!(sent(&hub.on_binary(b, &hello3("b", 200), 0), b), vec![&welcome3(b, 2, 64)], "a request over K_MAX is cut to it");
        let c = hub.accept("3", 0).unwrap().0;
        assert_eq!(sent(&hub.on_binary(c, &hello3("c", 12), 0), c), vec![&welcome3(c, 3, 12)]);
        let d = hub.accept("4", 0).unwrap().0;
        assert_eq!(sent(&hub.on_binary(d, &hello("d"), 0), d), vec![&welcome(d, 4)], "a v2 hello gets the 6 byte welcome");
        assert_eq!((hub.conn(a).unwrap().ver, hub.conn(a).unwrap().k, hub.conn(d).unwrap().ver, hub.conn(d).unwrap().k), (3, 32, 2, 8));
    }

    #[test]
    fn a_v2_player_keeps_its_eight_nearest_anywhere_and_never_sees_a_v3_frame() {
        let mut hub = Hub::new(1);
        let v2 = spawn(&mut hub, "old", 0.0, 0);
        let mut who = vec![(v2, 0.0, 0.0)];
        for i in 0..20 {
            let h = spawn3(&mut hub, &format!("n{i}"), 10.0 + i as f64 * 5.0, 0.0, 0);
            who.push((h, 10.0 + i as f64 * 5.0, 0.0));
        }
        let far = spawn3(&mut hub, "far", 3000.0, 0.0, 0);
        who.push((far, 3000.0, 0.0));
        let mut all = vec![];
        let mut t = 0;
        for _ in 0..4 {
            t += 1100;
            for (h, x, z) in &who {
                all.extend(hub.on_binary(*h, &state(*x, *z), t));
            }
        }
        assert_eq!(hub.conn(v2).unwrap().set.len(), 8);
        assert!(sent(&all, v2).iter().all(|f| f[0] != T_BATCH && f[0] != T_AUDIENCE), "a v2 player is sent the frames of v2 only");
    }

    #[test]
    fn a_v3_set_is_the_players_within_the_radius_plus_two_far_ones() {
        let mut hub = Hub::new(1);
        let me = spawn3(&mut hub, "me", 0.0, 0.0, 0);
        let mut who = vec![(me, 0.0, 0.0)];
        for i in 0..5 {
            who.push((spawn3(&mut hub, &format!("n{i}"), 20.0 + i as f64 * 40.0, 0.0, 0), 20.0 + i as f64 * 40.0, 0.0));
        }
        for (i, d) in [2000.0, 3000.0, 4000.0, 9000.0].iter().enumerate() {
            who.push((spawn3(&mut hub, &format!("f{i}"), *d, 0.0, 0), *d, 0.0));
        }
        settle(&mut hub, &who, 0);
        let set = &hub.conn(me).unwrap().set;
        assert_eq!(set.len(), 7, "5 near and the 2 nearest far ones: {set:?}");
        assert!(set.contains(&who[6].0) && set.contains(&who[7].0) && !set.contains(&who[8].0) && !set.contains(&who[9].0));
    }

    #[test]
    fn a_v3_set_is_capped_at_k_inside_the_radius() {
        let mut hub = Hub::new(1);
        let me = join3(&mut hub, "me", 0, 0);
        let mut who = vec![(me, 0.0, 0.0)];
        for i in 0..45 {
            let x = 5.0 + i as f64 * 8.0;
            who.push((spawn3(&mut hub, &format!("n{i}"), x, 0.0, 0), x, 0.0));
        }
        settle(&mut hub, &who, 0);
        assert_eq!(hub.conn(me).unwrap().set.len(), 32, "K_V3 of the 45 within 400 m");
        let asked = join3(&mut hub, "asked", 64, 5000);
        who.push((asked, 0.0, 3.0));
        settle(&mut hub, &who, 5000);
        assert_eq!(hub.conn(asked).unwrap().set.len(), 46, "and a player that asked for 64 holds all 46 here");
    }

    #[test]
    fn audience_tells_a_sender_nobody_holds_it_then_who_arrives_and_how_far() {
        let mut hub = Hub::new(1);
        let a = join3(&mut hub, "a", 0, 0);
        let acts = hub.on_binary(a, &state(0.0, 0.0), 0);
        assert_eq!(of_type(&acts, a, T_AUDIENCE), vec![&audience_frame(0)], "first state: nobody holds you");
        // b arrives 30 m away: b holds a, and a is told in the same event, not at its next state
        let b = join3(&mut hub, "b", 0, 100);
        let acts = hub.on_binary(b, &state(30.0, 0.0), 100);
        assert_eq!(of_type(&acts, a, T_AUDIENCE), vec![&audience_frame(1)]);
        // nothing is repeated while it stays in the band
        let acts = hub.on_binary(a, &state(0.0, 0.0), 1300);
        assert!(of_type(&acts, a, T_AUDIENCE).is_empty());
        // b drives away to 400 m: a is told at a's next state, in a farther band; b's own states do not tell a
        hub.on_binary(b, &state(400.0, 0.0), 1400);
        let acts = hub.on_binary(a, &state(0.0, 0.0), 2500);
        assert_eq!(of_type(&acts, a, T_AUDIENCE), vec![&audience_frame(6)], "350 to 600 m");
        // b leaves: a is told at once that nobody holds it
        let acts = hub.on_close(b, 3000);
        assert_eq!(of_type(&acts, a, T_AUDIENCE), vec![&audience_frame(0)]);
    }

    #[test]
    fn audience_does_not_flip_at_the_edge_of_a_band_and_is_never_sent_to_v2() {
        let mut hub = Hub::new(1);
        let a = spawn3(&mut hub, "a", 0.0, 0.0, 0);
        let b = spawn3(&mut hub, "b", 140.0, 0.0, 0);
        let mut t = settle(&mut hub, &[(a, 0.0, 0.0), (b, 140.0, 0.0)], 0);
        // a is in band 3 (100 to 150 m). b at 155 m is past the edge by less than 20 %: no news
        hub.on_binary(b, &state(155.0, 0.0), t + 10);
        t += 1100;
        let acts = hub.on_binary(a, &state(0.0, 0.0), t);
        assert!(of_type(&acts, a, T_AUDIENCE).is_empty());
        // at 200 m (past 150 x 1.2) it is told
        hub.on_binary(b, &state(200.0, 0.0), t + 10);
        t += 1100;
        let acts = hub.on_binary(a, &state(0.0, 0.0), t);
        assert_eq!(of_type(&acts, a, T_AUDIENCE), vec![&audience_frame(4)]);
        // a v2 player is never sent one, however its holders move
        let old = spawn(&mut hub, "old", 0.0, 0);
        let acts = hub.on_binary(b, &state(10.0, 0.0), t + 2000);
        let acts2 = hub.on_binary(old, &state(0.0, 0.0), t + 3000);
        assert!(of_type(&acts, old, T_AUDIENCE).is_empty() && of_type(&acts2, old, T_AUDIENCE).is_empty());
    }

    /// 14 v3 players within 40 m of each other, settled; returns the handles and where each stands.
    fn crowd3(hub: &mut Hub, n: usize) -> (Vec<u16>, Vec<(u16, f64, f64)>, u64) {
        let mut who = vec![];
        for i in 0..n {
            let (x, z) = ((i % 5) as f64 * 8.0, (i / 5) as f64 * 8.0);
            who.push((spawn3(hub, &format!("c{i}"), x, z, 0), x, z));
        }
        let t = settle(hub, &who, 0);
        // the rounds of `settle` send everybody's state in the same millisecond, so some wait in a box: one event a second later carries them, and the counters start from nothing
        let t = t + 1500;
        hub.on_binary(who[0].0, &state(who[0].1, who[0].2), t);
        for c in hub.conns.values() {
            assert!(c.box_t.is_empty());
        }
        hub.stats.batches = 0;
        hub.stats.batched_states = 0;
        hub.stats.batch_wait.clear();
        (who.iter().map(|w| w.0).collect(), who, t)
    }

    #[test]
    fn batching_holds_states_that_come_close_together_and_sends_them_as_one_frame() {
        let mut hub = Hub::new(1);
        let (hs, _, t) = crowd3(&mut hub, 14);
        let r = hs[0];
        assert!(hub.conn(r).unwrap().set.len() >= BATCH_MIN_HELD);
        // events 5 ms apart: the relay is busy. The first state to r goes at once (nothing waiting, last frame long ago)
        let t = t + 500;
        let a1 = hub.on_binary(hs[1], &state(8.0, 0.0), t);
        assert_eq!(of_type(&a1, r, 4).len(), 1, "the first goes straight out");
        let a2 = hub.on_binary(hs[2], &state(16.0, 0.0), t + 5);
        let a3 = hub.on_binary(hs[3], &state(24.0, 0.0), t + 10);
        assert!(sent(&a2, r).is_empty() && sent(&a3, r).is_empty(), "the next ones wait for batch_ms");
        // an event of anybody after batch_ms carries them
        let a4 = hub.on_binary(hs[4], &state(32.0, 0.0), t + BATCH_MS + 6);
        let frames = of_type(&a4, r, T_BATCH);
        assert_eq!(frames.len(), 1, "{:?}", sent(&a4, r));
        let es = batch_entries(frames[0]);
        assert_eq!(es.iter().map(|e| e.0).collect::<Vec<_>>(), vec![hs[2], hs[3], hs[4]], "the two that waited, in order, and the state of the event that carries them");
        assert!(es.iter().all(|e| e.1.len() == 18));
    }

    #[test]
    fn batching_never_holds_a_state_while_the_relay_is_quiet() {
        let mut hub = Hub::new(1);
        let (hs, _, t) = crowd3(&mut hub, 14);
        // events 200 ms apart (not busy: the last was more than batch_ms before): every state goes out as it comes
        for i in 0..10u64 {
            let acts = hub.on_binary(hs[1 + (i as usize % 10)], &state(8.0, 0.0), t + 500 + i * 200);
            assert_eq!(of_type(&acts, hs[0], 4).len(), 1, "state {i}");
        }
        assert!(hub.conn(hs[0]).unwrap().box_t.is_empty());
        assert_eq!(hub.stats.batches, hub.stats.batched_states, "every frame carried one state");
    }

    #[test]
    fn a_receiver_below_the_batch_size_and_a_v2_receiver_are_never_batched() {
        let mut hub = Hub::new(1);
        let (hs, _, t) = crowd3(&mut hub, 8);
        let old = spawn(&mut hub, "old", 4.0, 0);
        settle(&mut hub, &[(hs[0], 0.0, 0.0), (old, 4.0, 0.0)], t);
        let t = t + 3500 + 500;
        let mut got = 0;
        for i in 0..6u64 {
            let a = hub.on_binary(hs[1 + i as usize % 5], &state(8.0, 0.0), t + i * 3);
            got += of_type(&a, hs[0], 4).len() + of_type(&a, old, 4).len();
            assert!(of_type(&a, hs[0], T_BATCH).is_empty() && of_type(&a, old, T_BATCH).is_empty());
        }
        assert!(got >= 6, "every state went straight out: {got}");
    }

    #[test]
    fn what_waits_goes_before_an_enter_or_a_leave_so_the_order_is_kept() {
        let mut hub = Hub::new(1);
        let (hs, _, t) = crowd3(&mut hub, 14);
        let r = hs[0];
        let t = t + 500;
        hub.on_binary(hs[1], &state(8.0, 0.0), t);
        hub.on_binary(hs[2], &state(16.0, 0.0), t + 4);
        assert_eq!(hub.conn(r).unwrap().box_t.len(), 1);
        // hs[2] leaves: r gets its waiting state, then the LEAVE
        let acts = hub.on_close(hs[2], t + 8);
        let to_r = sent(&acts, r);
        let pos = |ty: u8| to_r.iter().position(|f| f[0] == ty);
        assert!(pos(4).is_some() && pos(3).is_some() && pos(4) < pos(3), "state before leave: {:?}", to_r.iter().map(|f| f[0]).collect::<Vec<_>>());
    }

    #[test]
    fn a_batch_never_waits_for_a_frame_that_may_not_come() {
        // random players, random gaps: after every event nothing that is due is left, and the longest wait is batch_ms plus the gap to the next event
        let mut hub = Hub::new(1);
        let (hs, who, mut t) = crowd3(&mut hub, 20);
        let mut rng = 12345u64;
        let mut next = move || { rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (rng >> 33) as u32 };
        let mut max_gap = 0;
        for _ in 0..4000 {
            let gap = (next() % 30) as u64 + 1;
            max_gap = max_gap.max(gap);
            t += gap;
            let i = next() as usize % hs.len();
            hub.on_binary(hs[i], &state(who[i].1 + (next() % 5) as f64 * 0.1, who[i].2), t);
            for c in hub.conns.values() {
                assert!(c.box_t.first().is_none_or(|w| t < *w + BATCH_MS), "a state is left waiting past batch_ms at {t}");
            }
        }
        let max_wait = hub.stats.batch_wait.iter().rposition(|n| *n > 0).unwrap() as u64;
        assert!(max_wait < BATCH_MS + max_gap + 1, "longest wait {max_wait} ms, gaps up to {max_gap} ms");
        assert!(hub.stats.batches < hub.stats.batched_states / 2, "and it did batch: {} frames for {} states", hub.stats.batches, hub.stats.batched_states);
    }

    #[test]
    fn a_frame_is_at_most_batch_max_states() {
        let mut hub = Hub::new(1);
        let (hs, _, t) = crowd3(&mut hub, 40);
        hub.tune.batch_ms = 10_000; // nothing is due by time: only the size flushes
        let r = hs[0];
        let mut frames = vec![];
        for i in 0..39u64 {
            let a = hub.on_binary(hs[1 + i as usize], &state(8.0, 0.0), t + 500 + i);
            frames.extend(of_type(&a, r, T_BATCH).into_iter().cloned());
        }
        assert!(!frames.is_empty());
        for f in &frames {
            assert!(batch_entries(f).len() <= BATCH_MAX);
        }
    }

    #[test]
    fn a_receiver_holding_more_than_the_budget_is_sent_at_most_that_many_states_a_second() {
        let mut hub = Hub::new(1);
        hub.tune.budget_above = 10;
        hub.tune.budget_rate = 40.0;
        hub.tune.batch_ms = 0; // count the states one by one
        let (hs, who, mut t) = crowd3(&mut hub, 40);
        let r = hs[0];
        let mut got = 0;
        let t0 = t;
        for step in 0..100u64 {
            t += 100;
            for i in 1..hs.len() {
                if (step as usize + i) % 2 == 0 {
                    got += of_type(&hub.on_binary(hs[i], &state(who[i].1, who[i].2), t), r, 4).len();
                }
            }
        }
        let rate = got as f64 / ((t - t0) as f64 / 1000.0);
        assert!(rate < 60.0, "{rate} states a second against a budget of 40 (the rate is each state sent at 5 a second by 39 players: 195 without a budget)");
        assert!(rate > 20.0, "{rate}");
    }

    #[test]
    fn one_hostile_sender_cannot_push_more_than_its_rate_into_a_victim() {
        let mut hub = Hub::new(1);
        let v = spawn3(&mut hub, "victim", 0.0, 0.0, 0);
        let h = spawn3(&mut hub, "hostile", 10.0, 0.0, 0);
        settle(&mut hub, &[(v, 0.0, 0.0), (h, 10.0, 0.0)], 0);
        let mut got = 0;
        let start = 4000;
        for i in 0..2000u64 {
            // 200 states a second for 10 s, a valid state every time
            got += sent(&hub.on_binary(h, &state(10.0 + (i % 3) as f64 * 0.05, 0.0), start + i * 5), v).len();
        }
        let secs = 10.0;
        assert!(got as f64 <= RATE_ALL.0 * secs + RATE_ALL.1 + 5.0, "{got} frames in 10 s into one victim: at most the sender's own limit of {} a second and a burst of {}", RATE_ALL.0, RATE_ALL.1);
    }

    #[test]
    fn the_attachment_keeps_the_version_and_the_set_size() {
        let mut hub = Hub::new(1);
        let a = spawn3(&mut hub, "a", 0.0, 0.0, 0);
        let b = join3(&mut hub, "b", 17, 0);
        let c = hub.conn(b).unwrap().encode();
        let d = Conn::decode(&c, 5).unwrap();
        assert_eq!((d.ver, d.k), (3, 17));
        let e = Conn::decode(&hub.conn(a).unwrap().encode(), 5).unwrap();
        assert_eq!((e.ver, e.k), (3, 32));
        // a record of the version before this one (a relay that was asleep over a deploy) is a v2 player
        let mut old = hub.conn(b).unwrap().encode();
        old[0] = 2;
        old.truncate(old.len() - 2);
        let o = Conn::decode(&old, 5).unwrap();
        assert_eq!((o.ver, o.k), (2, 8));
        // a record with a bad version or size is refused
        let mut bad = hub.conn(b).unwrap().encode();
        let n = bad.len();
        bad[n - 2] = 9;
        assert!(Conn::decode(&bad, 5).is_none());
        let mut bad = hub.conn(b).unwrap().encode();
        bad[n - 1] = 0;
        assert!(Conn::decode(&bad, 5).is_none());
        // 64 holders still fit the socket attachment (2 KiB limit, hex doubles it)
        let mut big = hub.conn(b).unwrap().clone();
        big.set = (1..=64).collect();
        big.ip = "2001:db8:ffff:ffff::/64".into();
        big.info = vec![0; 64];
        assert!(big.encode().len() * 2 < 2048, "{}", big.encode().len() * 2);
    }
}
