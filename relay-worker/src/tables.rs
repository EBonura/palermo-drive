//! The tables state machine, with no Worker types: it takes frames and a clock and returns the actions (send, close,
//! save an attachment) the Worker glue must carry out, exactly as `hub.rs` does for Palermo Drive's room. A table is
//! up to 8 sockets that named the same 5 character code; the relay numbers them (slots), tells every member who is
//! there, and forwards each frame to the other members in one order. It stores nothing: a table is its sockets.
//! Nothing here sets a timer: every rule that involves time is checked when the next event arrives.

use crate::proto::{address_key, Bucket, CLOSE_GOING_AWAY, CLOSE_POLICY, CLOSE_TOO_BIG, CLOSE_TRY_AGAIN, CLOSE_UNSUPPORTED};
use crate::tproto::*;
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

/// Where a socket sits once it said HELLO. Saved in the attachment, so a table can be rebuilt after hibernation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Member {
    pub code: Code,
    pub slot: u8,
    pub pid: Pid,
}

/// One socket. `handle`, `ip`, `connected_ms` and `member` survive hibernation (see `encode`); the rest restarts on a
/// wake-up, which at worst hands an idle member fresh buckets and a fresh idle timer.
#[derive(Debug, Clone)]
pub struct Conn {
    pub handle: u16,
    pub ip: String,
    pub connected_ms: u64,
    pub member: Option<Member>,

    frames: Bucket,
    bytes: Bucket,
    malformed: u32,
    rate_strikes: u32,
    last_strike_ms: u64,
    last_seen: u64,
}

const ATTACHMENT_TAG: u8 = 3;

impl Conn {
    fn new(handle: u16, ip: &str, now: u64) -> Self {
        Conn {
            handle,
            ip: ip.to_string(),
            connected_ms: now,
            member: None,
            frames: Bucket::full(RATE_FRAMES, now),
            bytes: Bucket::full(RATE_BYTES, now),
            malformed: 0,
            rate_strikes: 0,
            last_strike_ms: 0,
            last_seen: now,
        }
    }

    /// Compact bytes for the socket attachment (a 2 KiB limit; this is under 100: about 90 as the hex string).
    pub fn encode(&self) -> Vec<u8> {
        let mut o = vec![ATTACHMENT_TAG];
        o.extend_from_slice(&self.handle.to_le_bytes());
        o.push(self.member.is_some() as u8);
        o.extend_from_slice(&self.connected_ms.to_le_bytes());
        o.push(self.ip.len() as u8);
        o.extend_from_slice(self.ip.as_bytes());
        if let Some(m) = &self.member {
            o.push(m.slot);
            o.extend_from_slice(&m.pid);
            o.extend_from_slice(&m.code);
        }
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
        }
        let mut r = R(b);
        if r.u8()? != ATTACHMENT_TAG {
            return None;
        }
        let handle = u16::from_le_bytes(r.take(2)?.try_into().ok()?);
        let flags = r.u8()?;
        let connected_ms = u64::from_le_bytes(r.take(8)?.try_into().ok()?);
        let n = r.u8()? as usize;
        let ip = String::from_utf8(r.take(n)?.to_vec()).ok()?;
        let member = if flags & 1 != 0 {
            let slot = r.u8()?;
            let pid: Pid = r.take(16)?.try_into().ok()?;
            let code: Code = r.take(5)?.try_into().ok()?;
            if slot as usize >= SLOTS || !valid_code(&code) || !valid_pid(&pid) {
                return None;
            }
            Some(Member { code, slot, pid })
        } else {
            None
        };
        if !r.0.is_empty() {
            return None;
        }
        let mut c = Conn::new(handle, &ip, now);
        c.connected_ms = connected_ms;
        c.member = member;
        Some(c)
    }
}

struct Table {
    slots: [Option<u16>; SLOTS],
    /// The last HELLO, BCAST or TO: beats do not count, so an abandoned open tab cannot keep a table alive.
    last_activity: u64,
    bucket: Bucket,
}

impl Table {
    fn new(now: u64) -> Self {
        Table { slots: [None; SLOTS], last_activity: now, bucket: Bucket::full(RATE_TABLE, now) }
    }

    fn live(&self) -> usize {
        self.slots.iter().flatten().count()
    }
}

#[derive(Debug, Default)]
pub struct Stats {
    pub frames_in: u64,
    pub forwarded: u64,
    pub bytes_in: u64,
    pub dropped: BTreeMap<&'static str, u64>,
}

pub struct Tables {
    conns: BTreeMap<u16, Conn>,
    tables: HashMap<Code, Table>,
    next: u16,
    last_sweep: u64,
    day: u64,
    per_address: HashMap<String, u32>,
    /// For each address: when its hour started and the distinct codes it named in it.
    codes: HashMap<String, (u64, Vec<Code>)>,
    pub day_limit: u32,
    pub stats: Stats,
}

impl Tables {
    /// `seed` picks where handle numbering starts, so a handle is not reused soon after a restart.
    pub fn new(seed: u16) -> Self {
        Tables {
            conns: BTreeMap::new(),
            tables: HashMap::new(),
            next: seed.max(1),
            last_sweep: 0,
            day: 0,
            per_address: HashMap::new(),
            codes: HashMap::new(),
            day_limit: FRAMES_PER_IP_PER_DAY,
            stats: Stats::default(),
        }
    }

    /// Rebuilds the tables from the sockets' saved records after a wake-up. Returns the handles it could not place
    /// (two sockets claiming one slot): the caller closes those.
    pub fn restore(&mut self, conns: Vec<Conn>, now: u64) -> Vec<u16> {
        let mut rejected = vec![];
        for c in conns {
            if self.conns.contains_key(&c.handle) {
                rejected.push(c.handle);
                continue;
            }
            if let Some(m) = &c.member {
                let t = self.tables.entry(m.code).or_insert_with(|| Table::new(now));
                let clash = t.slots[m.slot as usize].is_some() || t.slots.iter().flatten().any(|h| self.conns.get(h).and_then(|o| o.member.as_ref()).is_some_and(|o| o.pid == m.pid));
                if clash {
                    rejected.push(c.handle);
                    continue;
                }
                t.slots[m.slot as usize] = Some(c.handle);
            }
            self.next = self.next.max(c.handle.wrapping_add(1)).max(1);
            self.conns.insert(c.handle, c);
        }
        self.tables.retain(|_, t| t.live() > 0);
        rejected
    }

    pub fn len(&self) -> usize {
        self.conns.len()
    }

    pub fn is_empty(&self) -> bool {
        self.conns.is_empty()
    }

    pub fn table_count(&self) -> usize {
        self.tables.len()
    }

    pub fn conn(&self, handle: u16) -> Option<&Conn> {
        self.conns.get(&handle)
    }

    /// The live members of a table as (slot, handle), in slot order.
    pub fn members(&self, code: &Code) -> Vec<(u8, u16)> {
        self.tables.get(code).map(|t| t.slots.iter().enumerate().filter_map(|(i, h)| h.map(|h| (i as u8, h))).collect()).unwrap_or_default()
    }

    pub fn count_drop(&mut self, reason: &'static str) {
        *self.stats.dropped.entry(reason).or_insert(0) += 1;
    }

    /// Admission check for a new socket. When the relay is full, one socket of the address holding the most places is
    /// closed for it, but only if that address holds at least two more than the newcomer's: a few addresses (or one
    /// /64) cannot sit on every place. Ported from Palermo Drive's hub.
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
        if self.conns.len() >= MAX_SOCKETS {
            let Some(victim) = self.victim_for(mine) else { return Err(Refuse::Full) };
            self.kick(victim, CLOSE_TRY_AGAIN, "making room", &mut acts);
        }
        // At most 180 live handles out of 65535, so this loop ends at once.
        let mut h = self.next;
        while h == 0 || self.conns.contains_key(&h) {
            h = h.wrapping_add(1);
        }
        self.next = h.wrapping_add(1).max(1);
        self.conns.insert(h, Conn::new(h, &ip, now));
        Ok((h, acts))
    }

    /// The socket to close so that a newcomer holding `mine` places can come in: the one that never said HELLO, else
    /// the quietest, of the address with the most places.
    fn victim_for(&self, mine: usize) -> Option<u16> {
        let mut counts: HashMap<&str, usize> = HashMap::new();
        for c in self.conns.values() {
            *counts.entry(c.ip.as_str()).or_insert(0) += 1;
        }
        let (top, n) = counts.into_iter().max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(a.0)))?;
        if n < mine + 2 {
            return None;
        }
        self.conns.values().filter(|c| c.ip == top).min_by_key(|c| (c.member.is_some(), c.last_seen, c.handle)).map(|c| c.handle)
    }

    /// Closes sockets that never said HELLO in time or went silent, and tables where nothing but beats has been sent
    /// for too long. Called on every event but runs at most once a second; there is no alarm, because an alarm would
    /// keep an idle object awake.
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
                if c.member.is_none() && now.saturating_sub(c.connected_ms) > HELLO_DEADLINE_MS {
                    Some((c.handle, "no hello", CLOSE_POLICY))
                } else if now.saturating_sub(c.last_seen) > MEMBER_IDLE_MS {
                    Some((c.handle, "idle", CLOSE_GOING_AWAY))
                } else {
                    None
                }
            })
            .collect();
        for (h, why, code) in stale {
            self.kick(h, code, why, &mut acts);
        }
        let idle: Vec<Code> = self.tables.iter().filter(|(_, t)| now.saturating_sub(t.last_activity) > TABLE_IDLE_MS).map(|(c, _)| *c).collect();
        for code in idle {
            // Everyone is going, so nobody is told about anybody leaving.
            let Some(t) = self.tables.remove(&code) else { continue };
            for h in t.slots.iter().flatten() {
                self.conns.remove(h);
                acts.push(Action::Close(*h, CLOSE_TABLE_IDLE, "table idle"));
            }
        }
        acts
    }

    /// The socket is gone (closed by the peer or errored).
    pub fn on_close(&mut self, handle: u16) -> Vec<Action> {
        let mut acts = vec![];
        self.remove(handle, &mut acts);
        acts
    }

    fn roll_day(&mut self, now: u64) {
        let day = now / 86_400_000;
        if day != self.day {
            self.day = day;
            self.per_address.clear();
        }
    }

    /// Counts one frame against the address's day. Emptied if it ever gets as big as `MAX_ADDRESSES`, which costs a
    /// flood that many addresses to reset the budgets and nothing to anybody else.
    fn address_allowed(&mut self, ip: &str, now: u64) -> bool {
        self.roll_day(now);
        if self.per_address.len() >= MAX_ADDRESSES && !self.per_address.contains_key(ip) {
            self.per_address.clear();
        }
        let n = self.per_address.entry(ip.to_string()).or_insert(0);
        *n = n.saturating_add(1);
        *n <= self.day_limit
    }

    /// Notes that this address named this code, and says whether it may: at most 8 distinct codes an hour. Naming a
    /// code it already named costs nothing, so a returning player is never refused for coming back.
    fn note_code(&mut self, ip: &str, code: Code, now: u64) -> bool {
        if self.codes.len() >= MAX_ADDRESSES && !self.codes.contains_key(ip) {
            self.codes.clear();
        }
        let e = self.codes.entry(ip.to_string()).or_insert((now, vec![]));
        if now.saturating_sub(e.0) >= HOUR_MS {
            *e = (now, vec![]);
        }
        if e.1.contains(&code) {
            return true;
        }
        if e.1.len() >= MAX_CODES_PER_IP_HOUR {
            return false;
        }
        e.1.push(code);
        true
    }

    /// A text frame: the protocol has none. Closed at once, since the runtime has already read and billed the whole
    /// message and nothing else would ever count it.
    pub fn on_text(&mut self, handle: u16) -> Vec<Action> {
        let mut acts = vec![];
        if self.conns.contains_key(&handle) {
            self.count_drop("text");
            self.kick(handle, CLOSE_UNSUPPORTED, "binary only", &mut acts);
        }
        acts
    }

    pub fn on_binary(&mut self, handle: u16, b: &[u8], now: u64) -> Vec<Action> {
        let mut acts = vec![];
        let Some(c) = self.conns.get_mut(&handle) else { return acts };
        self.stats.frames_in += 1;
        self.stats.bytes_in += b.len() as u64;
        c.last_seen = now;
        if b.len() > MAX_FRAME {
            self.kick(handle, CLOSE_TOO_BIG, "frame too big", &mut acts);
            return acts;
        }
        let ip = c.ip.clone();
        // Both buckets are always charged, so a frame refused for its size still counts as a frame.
        let (frame_ok, bytes_ok) = (c.frames.take(now), c.bytes.take_n(now, b.len() as f64));
        let within_rate = frame_ok && bytes_ok;
        let helloed = c.member.is_some();
        if !self.address_allowed(&ip, now) {
            // Closed rather than ignored: the day's request allowance is billed for every incoming frame, dropped or
            // not, so the only way to stop paying for this address's frames is to end its sockets.
            self.count_drop("address budget");
            self.kick(handle, CLOSE_POLICY, "daily allowance used", &mut acts);
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
                self.kick(handle, CLOSE_POLICY, "too fast", &mut acts);
            }
            return acts;
        }
        let frame = match parse(b) {
            Ok(f) => f,
            Err(ParseError::Oversize) => {
                self.kick(handle, CLOSE_TOO_BIG, "frame too big", &mut acts);
                return acts;
            }
            Err(ParseError::BadHello) => {
                self.kick(handle, CLOSE_POLICY, "bad hello", &mut acts);
                return acts;
            }
            Err(_) if !helloed => {
                self.kick(handle, CLOSE_POLICY, "hello first", &mut acts);
                return acts;
            }
            Err(_) => {
                self.count_drop("malformed");
                let c = self.conns.get_mut(&handle).unwrap();
                c.malformed += 1;
                if c.malformed >= MAX_MALFORMED {
                    self.kick(handle, CLOSE_POLICY, "too many malformed frames", &mut acts);
                }
                return acts;
            }
        };
        match (helloed, frame) {
            (false, Frame::Hello { must_be_new, pid, code }) => self.on_hello(handle, must_be_new, pid, code, now, &mut acts),
            (false, _) => self.kick(handle, CLOSE_POLICY, "hello first", &mut acts),
            (true, Frame::Hello { .. }) => self.kick(handle, CLOSE_POLICY, "second hello", &mut acts),
            (true, Frame::Beat) => acts.push(Action::Send(handle, beat())),
            (true, Frame::Bcast { kind, payload }) => self.on_bcast(handle, kind, payload, None, now, &mut acts),
            (true, Frame::To { slot, kind, payload }) => self.on_bcast(handle, kind, payload, Some(slot), now, &mut acts),
        }
        acts
    }

    fn on_hello(&mut self, handle: u16, must_be_new: bool, pid: Pid, code: Code, now: u64, acts: &mut Vec<Action>) {
        let ip = self.conns[&handle].ip.clone();
        // The two per address limits come first and do not depend on whether the table exists, so they cannot be used
        // to find out. Naming a code counts even when the HELLO is refused after this point: that is what makes the
        // distinct codes limit a limit on guessing.
        if !self.note_code(&ip, code, now) {
            self.count_drop("codes per address");
            return self.kick(handle, CLOSE_POLICY, "too many tables", acts);
        }
        let tables_of_ip: std::collections::HashSet<Code> = self.conns.values().filter(|c| c.ip == ip).filter_map(|c| c.member.as_ref().map(|m| m.code)).collect();
        if tables_of_ip.len() >= MAX_TABLES_PER_IP && !tables_of_ip.contains(&code) {
            self.count_drop("tables per address");
            return self.kick(handle, CLOSE_POLICY, "too many tables", acts);
        }
        if must_be_new && self.tables.contains_key(&code) {
            self.count_drop("table exists");
            return self.kick(handle, CLOSE_EXISTS, "table exists", acts);
        }
        // The same player on a newer socket replaces the older one, which is told (4001) and leaves the table first,
        // so the others see a LEAVE and then a JOIN and send the newcomer their state again.
        let older = self.tables.get(&code).and_then(|t| t.slots.iter().flatten().copied().find(|h| self.conns[h].member.as_ref().is_some_and(|m| m.pid == pid)));
        if let Some(old) = older {
            self.kick(old, CLOSE_REPLACED, "replaced", acts);
        }
        match self.tables.get(&code) {
            Some(t) if t.live() >= SLOTS => {
                self.count_drop("table full");
                return self.kick(handle, CLOSE_TABLE_FULL, "table full", acts);
            }
            None if self.tables.len() >= MAX_TABLES => {
                self.count_drop("too many tables");
                return self.kick(handle, CLOSE_TRY_AGAIN, "relay full", acts);
            }
            _ => {}
        }
        let t = self.tables.entry(code).or_insert_with(|| Table::new(now));
        t.last_activity = now;
        let slot = t.slots.iter().position(Option::is_none).unwrap() as u8;
        let others: Vec<(u8, Pid)> = t.slots.iter().enumerate().filter_map(|(i, h)| h.map(|h| (i as u8, self.conns[&h].member.as_ref().unwrap().pid))).collect();
        let others_handles: Vec<u16> = t.slots.iter().flatten().copied().collect();
        t.slots[slot as usize] = Some(handle);
        self.conns.get_mut(&handle).unwrap().member = Some(Member { code, slot, pid });
        // WELCOME to the newcomer, then JOIN to everyone else: the JOIN always comes before the newcomer's first BCAST.
        acts.push(Action::Send(handle, welcome(slot, &others)));
        acts.push(Action::Persist(handle));
        let j = join(slot, &pid);
        acts.extend(others_handles.into_iter().map(|h| Action::Send(h, j.clone())));
    }

    /// BCAST (`to` is None) or TO (`to` is a slot).
    fn on_bcast(&mut self, handle: u16, kind: u8, payload: &[u8], to: Option<u8>, now: u64, acts: &mut Vec<Action>) {
        let m = self.conns[&handle].member.clone().unwrap();
        let t = self.tables.get_mut(&m.code).unwrap();
        // A table's own limit is a drop and not a strike: one noisy member must not get the quiet ones closed.
        if !t.bucket.take(now) {
            self.count_drop("table rate");
            return;
        }
        t.last_activity = now;
        let targets: Vec<u16> = match to {
            None => t.slots.iter().flatten().copied().filter(|h| *h != handle).collect(),
            Some(s) => match t.slots[s as usize] {
                Some(h) if h != handle => vec![h],
                _ => {
                    self.count_drop("to not live");
                    return;
                }
            },
        };
        let frame = if to.is_some() { to_frame(m.slot, kind, payload) } else { bcast(m.slot, kind, payload) };
        self.stats.forwarded += targets.len() as u64;
        acts.extend(targets.into_iter().map(|h| Action::Send(h, frame.clone())));
    }

    fn kick(&mut self, handle: u16, code: u16, why: &'static str, acts: &mut Vec<Action>) {
        acts.push(Action::Close(handle, code, why));
        self.remove(handle, acts);
    }

    fn remove(&mut self, handle: u16, acts: &mut Vec<Action>) {
        let Some(gone) = self.conns.remove(&handle) else { return };
        let Some(m) = gone.member else { return };
        let Some(t) = self.tables.get_mut(&m.code) else { return };
        if t.slots[m.slot as usize] == Some(handle) {
            t.slots[m.slot as usize] = None;
        }
        let rest: Vec<u16> = t.slots.iter().flatten().copied().collect();
        if rest.is_empty() {
            self.tables.remove(&m.code);
            return;
        }
        let l = leave(m.slot);
        acts.extend(rest.into_iter().map(|h| Action::Send(h, l.clone())));
    }

    /// One line of counters for `wrangler tail`. Nothing in it identifies a player or an address.
    pub fn stats_json(&self) -> String {
        let dropped: Vec<String> = self.stats.dropped.iter().map(|(k, v)| format!("\"{}\":{}", k, v)).collect();
        format!(
            "{{\"sockets\":{},\"tables\":{},\"framesIn\":{},\"framesForwarded\":{},\"bytesIn\":{},\"dropped\":{{{}}}}}",
            self.conns.len(),
            self.tables.len(),
            self.stats.frames_in,
            self.stats.forwarded,
            self.stats.bytes_in,
            dropped.join(",")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::{from_hex, to_hex};
    use crate::tproto::tests::*;

    struct H {
        t: Tables,
        now: u64,
    }

    impl H {
        fn new() -> Self {
            H { t: Tables::new(1), now: 1_000_000 }
        }
        fn open(&mut self, ip: &str) -> u16 {
            let (h, acts) = self.t.accept(ip, self.now).unwrap();
            assert!(acts.is_empty());
            h
        }
        fn send(&mut self, h: u16, f: &[u8]) -> Vec<Action> {
            self.t.on_binary(h, f, self.now)
        }
        fn join(&mut self, ip: &str, pid: &Pid, code: &str) -> (u16, Vec<Action>) {
            let h = self.open(ip);
            let a = self.send(h, &hello(pid, code, false));
            (h, a)
        }
        /// Joins from a fresh address each time, for tests that are not about addresses.
        fn member(&mut self, n: u8, code: &str) -> u16 {
            let ip = format!("10.0.{}.{}", n / 100, n % 100 + 1);
            let h = self.open(&ip);
            self.send(h, &hello(&pid(n), code, false));
            h
        }
    }

    fn sends(acts: &[Action], to: u16) -> Vec<Vec<u8>> {
        acts.iter().filter_map(|a| if let Action::Send(h, b) = a { (*h == to).then(|| b.clone()) } else { None }).collect()
    }
    fn closes(acts: &[Action]) -> Vec<(u16, u16)> {
        acts.iter().filter_map(|a| if let Action::Close(h, c, _) = a { Some((*h, *c)) } else { None }).collect()
    }
    const K: &str = "K7Q2M";
    const KC: Code = *b"K7Q2M";

    #[test]
    fn first_member_gets_slot_zero_and_an_empty_roster() {
        let mut h = H::new();
        let (a, acts) = h.join("1.1.1.1", &pid(1), K);
        assert_eq!(sends(&acts, a), vec![welcome(0, &[])]);
        assert!(acts.contains(&Action::Persist(a)));
        assert_eq!(h.t.members(&KC), vec![(0, a)]);
        assert_eq!(h.t.table_count(), 1);
    }

    #[test]
    fn join_roster_and_join_before_the_first_bcast() {
        let mut h = H::new();
        let a = h.member(1, K);
        let (b, acts) = h.join("2.2.2.2", &pid(2), K);
        assert_eq!(sends(&acts, b), vec![welcome(1, &[(0, pid(1))])], "roster lists the others only");
        assert_eq!(sends(&acts, a), vec![join(1, &pid(2))], "the others are told");
        let (c, acts) = h.join("3.3.3.3", &pid(3), K);
        assert_eq!(sends(&acts, c), vec![welcome(2, &[(0, pid(1)), (1, pid(2))])]);
        assert_eq!(sends(&acts, a), vec![join(2, &pid(3))]);
        assert_eq!(sends(&acts, b), vec![join(2, &pid(3))]);
        // the order inside one batch: WELCOME to the newcomer comes before any JOIN
        assert!(matches!(&acts[0], Action::Send(x, f) if *x == c && f[0] == 1));
        // and the newcomer's first BCAST arrives after its JOIN, which was already delivered
        let acts = h.send(c, &bcast_frame(1, HELLO_JSON));
        assert_eq!(sends(&acts, a), vec![bcast(2, 1, HELLO_JSON.as_bytes())]);
    }

    #[test]
    fn lowest_free_slot_is_reused() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let _c = h.member(3, K);
        let acts = h.t.on_close(b);
        assert_eq!(sends(&acts, a), vec![leave(1)]);
        let (d, acts) = h.join("9.9.9.9", &pid(9), K);
        assert_eq!(sends(&acts, d)[0][2], 1, "slot 1 again");
        assert_eq!(h.t.members(&KC).len(), 3);
    }

    #[test]
    fn leave_goes_to_the_others_and_the_last_member_ends_the_table() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let acts = h.t.on_close(a);
        assert_eq!(sends(&acts, b), vec![leave(0)]);
        assert_eq!(h.t.table_count(), 1);
        let acts = h.t.on_close(b);
        assert!(acts.is_empty());
        assert_eq!(h.t.table_count(), 0, "a table dies with its last socket");
        assert!(h.t.is_empty());
        assert!(h.t.on_close(b).is_empty(), "closing twice is harmless");
    }

    #[test]
    fn bcast_reaches_everyone_else_in_one_order() {
        let mut h = H::new();
        let ms: Vec<u16> = (1..=4).map(|n| h.member(n, K)).collect();
        let mut seen: Vec<Vec<Vec<u8>>> = vec![vec![]; 4];
        // interleaved senders
        for round in 0..3u8 {
            for (i, &m) in ms.iter().enumerate() {
                let json = format!(r#"{{"nonce":"n{round}{i}","action":{{}}}}"#);
                let acts = h.send(m, &bcast_frame(4, &json));
                assert!(sends(&acts, m).is_empty(), "no echo to the sender");
                for (j, &r) in ms.iter().enumerate() {
                    seen[j].extend(sends(&acts, r));
                }
            }
        }
        // every member saw everyone else's frames, each from the right slot, in send order
        for j in 0..4 {
            let want: Vec<Vec<u8>> = (0..3u8)
                .flat_map(|round| (0..4usize).filter(move |&i| i != j).map(move |i| bcast(i as u8, 4, format!(r#"{{"nonce":"n{round}{i}","action":{{}}}}"#).as_bytes())))
                .collect();
            assert_eq!(seen[j], want, "member {j}");
        }
    }

    #[test]
    fn to_reaches_one_live_slot_and_drops_a_dead_one() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let c = h.member(3, K);
        let acts = h.send(a, &to_bytes(2, 2, STATE_JSON));
        assert_eq!(sends(&acts, c), vec![to_frame(0, 2, STATE_JSON.as_bytes())]);
        assert!(sends(&acts, b).is_empty() && sends(&acts, a).is_empty());
        let before = h.t.stats.dropped.get("to not live").copied().unwrap_or(0);
        let acts = h.send(a, &to_bytes(5, 2, STATE_JSON));
        assert!(acts.is_empty(), "a dead slot is dropped");
        assert_eq!(h.t.stats.dropped["to not live"], before + 1);
        assert!(h.send(a, &to_bytes(0, 2, STATE_JSON)).is_empty(), "to oneself is dropped");
        assert!(h.send(a, &to_bytes(1, 2, STATE_JSON)).iter().any(|x| matches!(x, Action::Send(_, _))));
        assert_eq!(h.t.conn(a).unwrap().malformed, 0, "a dead slot is not a malformed frame");
    }

    const STATE_JSON: &str = r#"{"code":"K7Q2M","version":3,"phase":"lobby","players":[],"game":null}"#;

    #[test]
    fn tables_are_isolated_from_each_other() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let x = h.member(3, "ABCDE");
        let y = h.member(4, "ABCDE");
        let acts = h.send(a, &bcast_frame(4, ACT));
        assert_eq!(sends(&acts, b).len(), 1);
        assert!(sends(&acts, x).is_empty() && sends(&acts, y).is_empty());
        // slots are per table: slot 0 of the other table is a different socket
        let acts = h.send(x, &to_bytes(1, 4, ACT));
        assert_eq!(sends(&acts, y).len(), 1);
        assert!(sends(&acts, b).is_empty());
        // a TO from a to slot 1 reaches b only, never y
        let acts = h.send(a, &to_bytes(1, 4, ACT));
        assert_eq!(sends(&acts, b).len(), 1);
        assert!(sends(&acts, y).is_empty());
        // a join to one table is not announced in the other
        let (_, acts) = h.join("7.7.7.7", &pid(7), K);
        assert!(sends(&acts, x).is_empty());
    }

    #[test]
    fn create_flag_against_a_live_table_closes_4002() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.open("2.2.2.2");
        let acts = h.send(b, &hello(&pid(2), K, true));
        assert_eq!(closes(&acts), vec![(b, 4002)]);
        assert!(h.t.conn(b).is_none());
        assert_eq!(h.t.members(&KC), vec![(0, a)], "the table is untouched");
        // the same flag on a code nobody has creates it
        let c = h.open("3.3.3.3");
        let acts = h.send(c, &hello(&pid(3), "ABCDE", true));
        assert_eq!(sends(&acts, c), vec![welcome(0, &[])]);
        // and once the table is gone the flag works on its code again
        h.t.on_close(a);
        let d = h.open("4.4.4.4");
        let acts = h.send(d, &hello(&pid(4), K, true));
        assert_eq!(sends(&acts, d), vec![welcome(0, &[])]);
    }

    #[test]
    fn same_pid_on_a_new_socket_replaces_the_old_one() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let (a2, acts) = h.join("1.2.3.4", &pid(1), K);
        assert_eq!(closes(&acts), vec![(a, 4001)]);
        assert!(h.t.conn(a).is_none());
        assert_eq!(sends(&acts, b), vec![leave(0), join(0, &pid(1))], "the others see a LEAVE, then a JOIN");
        assert_eq!(sends(&acts, a2), vec![welcome(0, &[(1, pid(2))])], "the newcomer takes the freed slot");
        assert_eq!(h.t.members(&KC), vec![(0, a2), (1, b)]);
        // frames from the old socket's handle are ignored; the replaced socket's own close event changes nothing
        assert!(h.send(a, &bcast_frame(4, ACT)).is_empty());
        assert!(h.t.on_close(a).is_empty());
        assert_eq!(h.t.members(&KC).len(), 2);
    }

    #[test]
    fn replacement_works_when_the_table_is_full_and_when_alone() {
        let mut h = H::new();
        for n in 1..=8 {
            h.member(n, K);
        }
        let (n, acts) = h.join("9.9.9.9", &pid(3), K);
        assert_eq!(closes(&acts).len(), 1, "one closed, not the newcomer");
        assert!(h.t.conn(n).is_some());
        assert_eq!(h.t.members(&KC).len(), 8);
        // a lone member replaced by itself
        let mut h = H::new();
        let a = h.member(1, K);
        let (a2, acts) = h.join("1.9.9.9", &pid(1), K);
        assert_eq!(closes(&acts), vec![(a, 4001)]);
        assert_eq!(sends(&acts, a2), vec![welcome(0, &[])]);
        assert_eq!(h.t.table_count(), 1);
    }

    #[test]
    fn the_same_pid_may_sit_at_two_tables() {
        let mut h = H::new();
        let a = h.member(1, K);
        let (b, acts) = h.join("1.1.1.1", &pid(1), "ABCDE");
        assert!(closes(&acts).is_empty());
        assert!(h.t.conn(a).is_some() && h.t.conn(b).is_some());
    }

    #[test]
    fn a_ninth_socket_closes_4004() {
        let mut h = H::new();
        for n in 1..=8 {
            h.member(n, K);
        }
        let (n, acts) = h.join("9.9.9.9", &pid(99), K);
        assert_eq!(closes(&acts), vec![(n, 4004)]);
        assert_eq!(h.t.members(&KC).len(), 8);
        assert_eq!(h.t.members(&KC).iter().map(|m| m.0).collect::<Vec<_>>(), (0..8).collect::<Vec<u8>>());
    }

    #[test]
    fn the_first_frame_must_be_a_good_hello() {
        for first in [bcast_frame(4, ACT), vec![4], to_bytes(0, 4, ACT), vec![], vec![9, 9], hello(&pid(1), "K7Q2O", false), hello(&[0; 16], K, false), vec![1, 2, 0]] {
            let mut h = H::new();
            let a = h.open("1.1.1.1");
            assert_eq!(closes(&h.send(a, &first)), vec![(a, 1008)], "{first:?}");
            assert_eq!(h.t.len(), 0);
        }
        let mut h = H::new();
        let a = h.member(1, K);
        assert_eq!(closes(&h.send(a, &hello(&pid(1), K, false))), vec![(a, 1008)], "a second HELLO");
        assert!(h.t.members(&KC).is_empty());
    }

    #[test]
    fn text_frame_closes_1003_and_oversize_1009() {
        let mut h = H::new();
        let a = h.member(1, K);
        assert_eq!(closes(&h.t.on_text(a)), vec![(a, 1003)]);
        let b = h.member(2, K);
        assert_eq!(closes(&h.send(b, &vec![2u8; 16_385])), vec![(b, 1009)]);
        assert!(h.t.on_text(b).is_empty(), "already gone");
    }

    #[test]
    fn malformed_frames_are_dropped_and_the_twentieth_closes() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let bad: [Vec<u8>; 6] = [vec![9], vec![2, 9, b'{', b'}'], bcast_frame(4, "[]"), bcast_frame(4, HELLO_JSON), to_bytes(8, 4, ACT), vec![4, 0]];
        for i in 0..19 {
            let acts = h.send(a, &bad[i % 6]);
            assert!(acts.is_empty(), "frame {i}");
            // pace under the rate limit
            h.now += 200;
        }
        assert!(h.t.conn(a).is_some());
        // good frames in between do not reset the count
        assert_eq!(sends(&h.send(a, &bcast_frame(4, ACT)), b).len(), 1);
        h.now += 200;
        assert_eq!(closes(&h.send(a, &bad[0])), vec![(a, 1008)]);
        assert_eq!(h.t.stats.dropped["malformed"], 20);
    }

    #[test]
    fn rate_is_burst_then_steady_and_a_flood_closes() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let mut delivered = 0;
        for _ in 0..40 {
            delivered += sends(&h.send(a, &bcast_frame(1, HELLO_JSON)), b).len();
        }
        assert_eq!(delivered, 23, "burst 24 less the HELLO already sent");
        h.now += 1000;
        delivered = 0;
        for _ in 0..20 {
            delivered += sends(&h.send(a, &bcast_frame(1, HELLO_JSON)), b).len();
        }
        assert_eq!(delivered, 8, "8 a second");
        assert!(h.t.stats.dropped["rate"] > 0);
        // a long flood: 100 refused frames in a row close the socket
        let mut closed = None;
        for i in 0..200 {
            let acts = h.send(a, &bcast_frame(1, HELLO_JSON));
            if let Some(c) = closes(&acts).first() {
                closed = Some((i, *c));
                break;
            }
        }
        let (i, c) = closed.expect("flood closes");
        assert_eq!(c, (a, 1008));
        assert!(i < 120, "{i}");
    }

    #[test]
    fn a_quiet_spell_forgives_rate_strikes() {
        let mut h = H::new();
        let a = h.member(1, K);
        for _ in 0..24 + 90 {
            h.send(a, &bcast_frame(1, HELLO_JSON));
        }
        assert!(h.t.conn(a).is_some());
        h.now += 11_000;
        for _ in 0..24 + 90 {
            h.send(a, &bcast_frame(1, HELLO_JSON));
        }
        assert!(h.t.conn(a).is_some(), "90 strikes twice, with a quiet spell between, is not 100 in a row");
    }

    #[test]
    fn byte_rate_limits_big_frames() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        // a state of about 12 KB: the 64 KB burst holds five of them, and the frame count is far under its own limit
        let json = format!(r#"{{"code":"K7Q2M","version":3,"phase":"lobby","players":[],"game":null,"recent":["{}"]}}"#, "x".repeat(12_000));
        let ok: usize = (0..7).map(|_| sends(&h.send(a, &bcast_frame(2, &json)), b).len()).sum();
        assert_eq!(ok, 5);
        assert_eq!(h.t.stats.dropped["rate"], 2);
        h.now += 10_000;
        assert_eq!(sends(&h.send(a, &bcast_frame(2, &json)), b).len(), 1, "refilled");
    }

    #[test]
    fn table_rate_drops_without_striking_the_sender() {
        let mut h = H::new();
        let ms: Vec<u16> = (1..=8).map(|n| h.member(n, K)).collect();
        // 8 members send 16 frames each in one instant: each is inside its own burst of 24, together they pass the
        // table's burst of 120
        let mut forwarded = 0;
        for _ in 0..16 {
            for &m in &ms {
                forwarded += sends(&h.send(m, &bcast_frame(1, HELLO_JSON)), ms[0]).len();
            }
        }
        assert!(forwarded > 0);
        assert!(h.t.stats.dropped["table rate"] > 0, "the table's burst of 120 was passed");
        assert!(!h.t.stats.dropped.contains_key("rate"), "no socket was over its own rate");
        assert!(ms.iter().all(|m| h.t.conn(*m).is_some() && h.t.conn(*m).unwrap().rate_strikes == 0), "nobody was struck for it");
    }

    #[test]
    fn per_address_socket_limit_and_ipv6_block() {
        let mut h = H::new();
        for _ in 0..24 {
            h.open("5.5.5.5");
        }
        assert_eq!(h.t.accept("5.5.5.5", 0).unwrap_err(), Refuse::PerAddress);
        assert!(h.t.accept("5.5.5.6", 0).is_ok());
        for i in 0..24 {
            h.open(&format!("2001:db8:1:2:{i}::1"));
        }
        assert_eq!(h.t.accept("2001:db8:1:2:ffff::9", 0).unwrap_err(), Refuse::PerAddress, "one /64 is one address");
        assert!(h.t.accept("2001:db8:1:3::1", 0).is_ok());
    }

    #[test]
    fn four_tables_per_address() {
        let mut h = H::new();
        for (i, code) in ["AAAAA", "BBBBB", "CCCCC", "DDDDD"].iter().enumerate() {
            let (_, acts) = h.join("6.6.6.6", &pid(i as u8 + 1), code);
            assert!(closes(&acts).is_empty(), "{code}");
        }
        let (x, acts) = h.join("6.6.6.6", &pid(9), "EEEEE");
        assert_eq!(closes(&acts), vec![(x, 1008)], "a fifth table");
        // another socket of the same address at a table it already sits at is fine
        let (_, acts) = h.join("6.6.6.6", &pid(10), "AAAAA");
        assert!(closes(&acts).is_empty());
        // other addresses are not affected
        let (_, acts) = h.join("6.6.6.7", &pid(11), "EEEEE");
        assert!(closes(&acts).is_empty());
    }

    #[test]
    fn eight_distinct_codes_an_hour_per_address() {
        let mut h = H::new();
        let codes = ["AAAAA", "BBBBB", "CCCCC", "DDDDD", "EEEEE", "FFFFF", "GGGGG", "HHHHH", "JJJJJ"];
        // join and leave each in turn so the 4 tables limit is not the one being hit
        for (i, code) in codes.iter().take(8).enumerate() {
            let (a, acts) = h.join("6.6.6.6", &pid(i as u8 + 1), code);
            assert!(closes(&acts).is_empty(), "{code}");
            h.t.on_close(a);
        }
        let (x, acts) = h.join("6.6.6.6", &pid(20), codes[8]);
        assert_eq!(closes(&acts), vec![(x, 1008)], "the ninth distinct code");
        // naming a code it already named is free
        let (_, acts) = h.join("6.6.6.6", &pid(21), codes[0]);
        assert!(closes(&acts).is_empty());
        // a refused guess counts too: 8 guesses at tables that exist (create flag) use the allowance
        let mut g = H::new();
        let a = g.member(1, "KKKKK");
        let _ = a;
        for (i, c) in ["LLLLL", "MMMMM", "NNNNN", "PPPPP", "QQQQQ", "RRRRR", "SSSSS", "TTTTT"].iter().enumerate() {
            g.member(50 + i as u8, c); // existing tables, each from its own address
        }
        for (i, c) in ["LLLLL", "MMMMM", "NNNNN", "PPPPP", "QQQQQ", "RRRRR", "SSSSS", "TTTTT"].iter().enumerate() {
            let s = g.open("8.8.8.8");
            let acts = g.send(s, &hello(&pid(100 + i as u8), c, true));
            assert_eq!(closes(&acts), vec![(s, 4002)], "{c}");
        }
        let s = g.open("8.8.8.8");
        let acts = g.send(s, &hello(&pid(120), "VVVVV", true));
        assert_eq!(closes(&acts), vec![(s, 1008)], "the ninth guess is refused outright");
        // an hour later the allowance is back
        g.now += HOUR_MS;
        let s = g.open("8.8.8.8");
        assert!(closes(&g.send(s, &hello(&pid(121), "VVVVV", true))).is_empty());
    }

    #[test]
    fn thirty_tables_at_once_then_1013() {
        let mut h = H::new();
        let alphabet = CODE_ALPHABET;
        for i in 0..30 {
            let code = format!("{}{}AAA", alphabet[i / 8] as char, alphabet[i % 8] as char);
            let ip = format!("11.0.{}.{}", i / 250, i % 250);
            let (_, acts) = h.join(&ip, &pid(i as u8 + 1), &code);
            assert!(closes(&acts).is_empty(), "table {i}");
        }
        assert_eq!(h.t.table_count(), 30);
        let (x, acts) = h.join("12.0.0.1", &pid(200), "ZZZZZ");
        assert_eq!(closes(&acts), vec![(x, 1013)]);
        assert_eq!(h.t.table_count(), 30);
        // joining an existing table is still allowed
        let (_, acts) = h.join("12.0.0.2", &pid(201), "AAAAA");
        assert!(closes(&acts).is_empty());
    }

    #[test]
    fn day_budget_closes_and_blocks_the_upgrade() {
        let mut h = H::new();
        h.t.day_limit = 50;
        let a = h.member(1, K);
        let ip = h.t.conn(a).unwrap().ip.clone();
        let mut closed = false;
        for _ in 0..60 {
            // beats are frames too: the allowance counts what Cloudflare bills
            h.now += 200;
            let acts = h.send(a, &[4]);
            if !closes(&acts).is_empty() {
                closed = true;
                assert_eq!(closes(&acts), vec![(a, 1008)]);
                break;
            }
        }
        assert!(closed);
        assert_eq!(h.t.accept(&ip, h.now).unwrap_err(), Refuse::Budget);
        assert!(h.t.accept("99.99.99.99", h.now).is_ok(), "other addresses are unaffected");
        h.now += 86_400_000;
        assert!(h.t.accept(&ip, h.now).is_ok(), "the next UTC day");
    }

    #[test]
    fn beat_is_answered_and_does_not_keep_a_table_alive() {
        let mut h = H::new();
        let a = h.member(1, K);
        h.now += 15_000;
        assert_eq!(sends(&h.send(a, &[4]), a), vec![beat()]);
        // beats every 15 s for 31 minutes: the member lives, the table goes
        let start = h.now;
        let mut last = vec![];
        while h.now < start + 31 * 60_000 {
            h.now += 15_000;
            let mut acts = h.t.sweep(h.now);
            acts.extend(h.send(a, &[4]));
            if !closes(&acts).is_empty() {
                last = acts;
                break;
            }
        }
        assert_eq!(closes(&last), vec![(a, 4003)]);
        assert!(h.now - start >= 29 * 60_000 && h.now - start <= 31 * 60_000, "{}", h.now - start);
        assert_eq!(h.t.table_count(), 0);
        assert!(h.t.is_empty());
    }

    #[test]
    fn game_frames_keep_a_table_alive_and_everyone_gets_4003_when_it_is_not() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        for _ in 0..4 {
            h.now += 20 * 60_000;
            h.send(b, &[4]);
            h.send(a, &[4]);
            assert!(h.t.sweep(h.now).is_empty(), "silent but beating members, active table");
            h.send(a, &bcast_frame(4, ACT));
        }
        // a lone socket of another table sees nothing of this
        let c = h.member(3, "ABCDE");
        h.now += 31 * 60_000;
        h.send(a, &[4]);
        h.send(b, &[4]);
        h.send(c, &[4]);
        let acts = h.t.sweep(h.now);
        let mut cl = closes(&acts);
        cl.sort();
        assert_eq!(cl, vec![(a, 4003), (b, 4003), (c, 4003)]);
        assert!(sends(&acts, a).is_empty() && sends(&acts, b).is_empty(), "nobody is told about leavers when all go");
        assert_eq!(h.t.table_count(), 0);
        assert_eq!(h.t.len(), 0);
    }

    #[test]
    fn silent_member_closes_1001_after_40_seconds_and_the_others_are_told() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        h.now += 30_000;
        h.send(b, &[4]);
        assert!(h.t.sweep(h.now).is_empty(), "30 s is not yet 40");
        h.now += 11_000;
        h.send(b, &[4]);
        let acts = h.t.sweep(h.now);
        assert_eq!(closes(&acts), vec![(a, 1001)]);
        assert_eq!(sends(&acts, b), vec![leave(0)]);
    }

    #[test]
    fn no_hello_in_10_seconds_closes() {
        let mut h = H::new();
        let a = h.open("1.1.1.1");
        h.now += 9_000;
        assert!(h.t.sweep(h.now).is_empty());
        h.now += 1_500;
        assert_eq!(closes(&h.t.sweep(h.now)), vec![(a, 1008)]);
        // the sweep runs at most once a second
        let x = h.open("1.1.1.2");
        h.now += 9_500;
        assert!(h.t.sweep(h.now).is_empty());
        h.now += 700; // x is now overdue, but the last sweep was 700 ms ago
        assert!(h.t.sweep(h.now).is_empty());
        h.now += 400;
        assert_eq!(closes(&h.t.sweep(h.now)), vec![(x, 1008)]);
    }

    #[test]
    fn a_full_relay_makes_room_from_the_heaviest_address_only() {
        let mut h = H::new();
        // one address holds 24 places (none has said HELLO), the rest are singles
        let big: Vec<u16> = (0..24).map(|_| h.open("20.0.0.1")).collect();
        let mut singles = 0;
        while h.t.len() < MAX_SOCKETS {
            h.open(&format!("30.{}.{}.1", singles / 250, singles % 250));
            singles += 1;
        }
        assert_eq!(h.t.len(), 180);
        // a newcomer from a fresh address is let in by closing one of the heavy address's sockets (1013)
        let (n, acts) = h.t.accept("40.0.0.1", h.now).unwrap();
        let cl = closes(&acts);
        assert_eq!(cl.len(), 1);
        assert_eq!(cl[0].1, 1013);
        assert!(big.contains(&cl[0].0));
        assert_eq!(h.t.len(), 180);
        assert!(h.t.conn(n).is_some());
        // an address holding 23 is not served at the cost of one holding only 24
        let mut g = H::new();
        for _ in 0..24 {
            g.open("20.0.0.1");
        }
        let mut k = 0;
        while g.t.len() < 180 - 23 {
            g.open(&format!("30.{}.{}.1", k / 250, k % 250));
            k += 1;
        }
        for _ in 0..23 {
            g.open("21.0.0.1");
        }
        assert_eq!(g.t.len(), 180);
        assert_eq!(g.t.accept("21.0.0.1", 0).unwrap_err(), Refuse::Full, "24 against 23 is not two more");
        // 180 distinct addresses with one place each cannot be made room in
        let mut f = H::new();
        for i in 0..180 {
            f.open(&format!("50.0.{}.{}", i / 250, i % 250));
        }
        assert_eq!(f.t.accept("60.0.0.1", 0).unwrap_err(), Refuse::Full);
    }

    #[test]
    fn the_victim_is_a_socket_that_never_said_hello_before_a_member() {
        let mut h = H::new();
        // one address with 22 places, one of which is a seated member that is also the oldest; the rest are singles
        let member = h.open("70.0.0.1");
        h.send(member, &hello(&pid(1), K, false));
        let silent: Vec<u16> = (0..21).map(|_| h.open("70.0.0.1")).collect();
        let mut k = 0;
        while h.t.len() < MAX_SOCKETS {
            h.open(&format!("71.{}.{}.1", k / 250, k % 250));
            k += 1;
        }
        let (_, acts) = h.t.accept("80.0.0.1", h.now).unwrap();
        let victim = closes(&acts)[0].0;
        assert!(silent.contains(&victim), "a socket that never spoke goes first");
        assert_eq!(h.t.members(&KC), vec![(0, member)], "the member was spared");
    }

    #[test]
    fn attachment_roundtrip() {
        let mut h = H::new();
        let a = h.member(1, K);
        let c = h.t.conn(a).unwrap().clone();
        let bytes = c.encode();
        assert!(bytes.len() < 100, "{}", bytes.len());
        let back = Conn::decode(&bytes, 5).unwrap();
        assert_eq!((back.handle, &back.ip, back.connected_ms, &back.member), (c.handle, &c.ip, c.connected_ms, &c.member));
        let lone = h.open("2.2.2.2");
        let b2 = h.t.conn(lone).unwrap().encode();
        assert!(Conn::decode(&b2, 5).unwrap().member.is_none());
        // longest address kept in the attachment
        let long = Conn::new(9, &address_key(&"é".repeat(300)), 0).encode();
        assert!(Conn::decode(&long, 0).is_some());
        // hex and back, as the glue does it
        assert_eq!(Conn::decode(&from_hex(&to_hex(&bytes)).unwrap(), 0).unwrap().member, c.member);
    }

    #[test]
    fn attachment_decode_refuses_damage() {
        let mut h = H::new();
        let a = h.member(1, K);
        let good = h.t.conn(a).unwrap().encode();
        assert!(Conn::decode(&[], 0).is_none());
        for cut in 0..good.len() {
            assert!(Conn::decode(&good[..cut], 0).is_none(), "cut at {cut}");
        }
        assert!(Conn::decode(&[&good[..], &[0]].concat(), 0).is_none(), "trailing byte");
        let mut b = good.clone();
        b[0] = 2;
        assert!(Conn::decode(&b, 0).is_none(), "another record's tag");
        let n = good.len();
        let mut b = good.clone();
        b[n - 22] = 8; // slot byte
        assert!(Conn::decode(&b, 0).is_none(), "slot 8");
        let mut b = good.clone();
        b[n - 1] = b'0';
        assert!(Conn::decode(&b, 0).is_none(), "code outside the alphabet");
        let mut b = good.clone();
        b[n - 21 + 6] = 0;
        assert!(Conn::decode(&b, 0).is_none(), "pid not v4");
        let mut b = good.clone();
        b[12] = 200; // ip length beyond the record
        assert!(Conn::decode(&b, 0).is_none());
        assert!(Conn::decode(&[3, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0xff], 0).is_none());
    }

    /// What the glue does after a wake-up: every socket's attachment is decoded and the tables are rebuilt from them.
    fn wake(old: &Tables, now: u64) -> (Tables, Vec<u16>) {
        let conns: Vec<Conn> = old.conns.values().map(|c| Conn::decode(&c.encode(), now).unwrap()).collect();
        let mut t = Tables::new(77);
        let rejected = t.restore(conns, now);
        (t, rejected)
    }

    #[test]
    fn a_table_is_rebuilt_from_attachments_after_hibernation() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let c = h.member(3, K);
        let x = h.member(4, "ABCDE");
        h.t.on_close(b); // a hole at slot 1
        let lone = h.open("9.9.9.9"); // a socket that has not said HELLO yet
        h.now += 60_000;
        let (mut t, rej) = wake(&h.t, h.now);
        assert!(rej.is_empty());
        assert_eq!(t.members(&KC), vec![(0, a), (2, c)]);
        assert_eq!(t.members(b"ABCDE"), vec![(0, x)]);
        assert_eq!(t.len(), 4);
        assert!(t.conn(lone).unwrap().member.is_none());
        // it works as before: a frame goes to the right slot, a join takes the hole, the unhelloed one can still say hello
        let acts = t.on_binary(a, &bcast_frame(4, ACT), h.now);
        assert_eq!(sends(&acts, c), vec![bcast(0, 4, ACT.as_bytes())]);
        assert!(sends(&acts, x).is_empty());
        let n = t.accept("5.5.5.5", h.now).unwrap().0;
        let acts = t.on_binary(n, &hello(&pid(50), K, false), h.now);
        assert_eq!(sends(&acts, n), vec![welcome(1, &[(0, pid(1)), (2, pid(3))])]);
        assert_eq!(sends(&acts, a), vec![join(1, &pid(50))]);
        let acts = t.on_binary(lone, &hello(&pid(60), "QQQQQ", false), h.now);
        assert_eq!(sends(&acts, lone), vec![welcome(0, &[])]);
        // replacement still finds the old member by its pid
        let r = t.accept("6.6.6.6", h.now).unwrap().0;
        let acts = t.on_binary(r, &hello(&pid(1), K, false), h.now);
        assert_eq!(closes(&acts), vec![(a, 4001)]);
        // handle numbering carries on above the restored ones
        assert!(t.accept("7.7.7.7", h.now).unwrap().0 > x);
    }

    #[test]
    fn what_a_wake_up_resets() {
        let mut h = H::new();
        h.t.day_limit = 10;
        let a = h.member(1, K);
        for _ in 0..24 {
            h.send(a, &bcast_frame(1, HELLO_JSON));
        }
        // buckets are empty now; after a wake they are full again (documented: an idle player gets fresh buckets)
        let (mut t, _) = wake(&h.t, h.now);
        let acts = t.on_binary(a, &bcast_frame(1, HELLO_JSON), h.now);
        assert!(acts.is_empty() && t.stats.dropped.get("rate").is_none(), "accepted from a fresh bucket");
        // the table idle clock restarts at the wake
        let acts = t.sweep(h.now + TABLE_IDLE_MS - 1000);
        assert!(acts.is_empty());
    }

    #[test]
    fn restore_refuses_a_clash() {
        let mut h = H::new();
        let a = h.member(1, K);
        let mut one = Conn::decode(&h.t.conn(a).unwrap().encode(), 0).unwrap();
        let mut dup_slot = one.clone();
        dup_slot.handle = 500;
        dup_slot.member.as_mut().unwrap().pid = pid(2);
        let mut dup_pid = one.clone();
        dup_pid.handle = 501;
        dup_pid.member.as_mut().unwrap().slot = 3;
        let mut same_handle = one.clone();
        same_handle.member = None;
        one.handle = a;
        let mut t = Tables::new(1);
        let rej = t.restore(vec![one, dup_slot, dup_pid, same_handle], 0);
        assert_eq!(rej, vec![500, 501, a]);
        assert_eq!(t.members(&KC), vec![(0, a)]);
        // a record for a table with nobody placed leaves no table
        let mut t = Tables::new(1);
        let lone = Conn::decode(&Conn::new(5, "1.1.1.1", 0).encode(), 0).unwrap();
        assert!(t.restore(vec![lone], 0).is_empty());
        assert_eq!(t.table_count(), 0);
    }

    #[test]
    fn a_hostile_member_cannot_reach_beyond_its_table() {
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, "ABCDE");
        // every slot, every kind, as TO and BCAST: only members of a's own table can ever be reached, and a is alone
        for slot in 0..8u8 {
            for kind in 1..=4u8 {
                let json = match kind {
                    1 => HELLO_JSON,
                    2 => STATE_JSON,
                    3 => r#"{"from":1,"to":2,"f":"a","p":null}"#,
                    _ => ACT,
                };
                h.now += 1000;
                let acts = h.send(a, &to_bytes(slot, kind, json));
                assert!(sends(&acts, b).is_empty());
                let acts = h.send(a, &bcast_frame(kind, json));
                assert!(sends(&acts, b).is_empty() && acts.is_empty());
            }
        }
    }

    #[test]
    fn many_random_frames_never_panic_and_never_cross_tables() {
        // a small deterministic fuzz: random bytes behind valid and invalid headers
        let mut seed = 0x1234_5678u64;
        let mut rnd = move || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed
        };
        let mut h = H::new();
        let a = h.member(1, K);
        let b = h.member(2, K);
        let x = h.member(3, "ABCDE");
        let (mut ha, mut hb) = (a, b);
        for _ in 0..5000 {
            h.now += 150;
            let len = (rnd() % 60) as usize;
            let mut f: Vec<u8> = (0..len).map(|_| rnd() as u8).collect();
            if rnd() % 2 == 0 && !f.is_empty() {
                f[0] = (rnd() % 6) as u8;
            }
            let from = if rnd() % 2 == 0 { ha } else { hb };
            let acts = h.send(from, &f);
            assert!(sends(&acts, x).is_empty());
            for c in closes(&acts) {
                // a hostile sender got itself closed: put a fresh one in so the run goes on
                if c.0 == ha {
                    ha = h.member(1, K);
                }
                if c.0 == hb {
                    hb = h.member(2, K);
                }
            }
        }
    }

    #[test]
    fn stats_line_has_no_addresses() {
        let mut h = H::new();
        h.join("203.0.113.9", &pid(1), K);
        let s = h.t.stats_json();
        assert!(s.contains("\"sockets\":1") && s.contains("\"tables\":1"));
        assert!(!s.contains("203.0.113") && !s.contains("K7Q2M"));
    }

    #[test]
    fn handles_are_unique_and_never_zero() {
        let mut t = Tables::new(0);
        let mut seen = std::collections::HashSet::new();
        for i in 0..170 {
            let (h, _) = t.accept(&format!("1.0.{}.{}", i / 24, i % 250), 0).unwrap();
            assert!(h != 0 && seen.insert(h));
        }
        let mut t = Tables::new(65_535);
        let a = t.accept("1.1.1.1", 0).unwrap().0;
        let b = t.accept("1.1.1.2", 0).unwrap().0;
        assert!(a != 0 && b != 0 && a != b);
    }
}
