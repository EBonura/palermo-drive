// Rooms, interest management and the batched per-tick fan-out.
//
// Hot path design (the tick runs 10 times a second and touches every player of every room):
//  - A connection task never takes the hub lock to publish its position. It writes the latest STATE into its own tiny
//    mailbox (a mutex nobody else uses except the tick, for 11 bytes) and the tick copies it out. Only join, leave and
//    name changes take the hub lock, and the tick holds it for the whole pass.
//  - A spatial grid (cells as wide as the leave radius, sorted once per tick) means a receiver only looks at the 3x3 cells
//    around it, not at every other player. Players it already knows are found through a 256 bit set.
//  - One scratch buffer builds each STATES frame; the only allocation per frame is the exact size message that goes into the
//    connection's bounded queue. A queue that is full drops the frame and rolls back what it carried (so the next tick sends
//    it again); a client that cannot keep up for long is disconnected.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, Notify};

use crate::metrics;
use crate::protocol::*;
use crate::stats::{ip_key, IpKey};

pub struct Cfg {
    pub radius: f32,           // metres within which players see each other
    pub tick: Duration,        // server send rate cap (one frame per receiver per tick)
    pub max_conns: usize,      // total connections across rooms
    pub per_ip: usize,         // connections per client IP (IPv6: per /64)
    pub idle_timeout: Duration, // no message at all
    pub afk_timeout: Duration,  // no STATE message (stationary or paused client)
    pub max_session: Duration,  // 0 = no limit
    pub filter: bool,
    pub origins: Vec<String>,
    pub trust_header: Option<String>, // header that carries the client address behind a tunnel or proxy (None: use the socket)
    pub bands: [f32; 3], // metres: full entries within [0], every 2nd tick beyond [1], every 4th beyond [2]
}

pub const CLOSE_IDLE: u16 = 4001; // clients must not auto-reconnect until the player moves
pub const CLOSE_REFRESH: u16 = 4002; // session limit reached, reconnect straight away
pub const CLOSE_CAP: u16 = 4003; // monthly free-tier cap reached: single player until the month rolls over
pub const CLOSE_GOING_AWAY: u16 = 1001;
pub const CLOSE_POLICY: u16 = 1008;

const FULL_LEN: usize = 1 + 4 + 6;
const SHORT_LEN: usize = 1 + 4 + 2;
const QUEUE: usize = 32; // frames per connection
const MAX_DROPPED: u32 = 200; // this many frames in a row refused (20 s): a client that cannot keep up is not worth the memory
const NO_INFO_SECS: u64 = 10;
const BEAT_SECS: u64 = 10;

/// Asks a connection to close with a code. The first request wins; it never blocks.
#[derive(Default)]
pub struct Kick {
    once: OnceLock<(u16, &'static str)>,
    pub notify: Notify,
}

impl Kick {
    pub fn fire(&self, code: u16, reason: &'static str) {
        if self.once.set((code, reason)).is_ok() {
            self.notify.notify_one();
        }
    }
    pub fn get(&self) -> Option<(u16, &'static str)> {
        self.once.get().copied()
    }
}

/// What a connection task and the hub share.
pub struct Shared {
    mail: Mutex<(u32, [u8; STATE_LEN])>, // sequence number (0 = nothing yet) and the latest STATE
    seq: AtomicU32,
    tx: mpsc::Sender<Vec<u8>>,
    dropped: AtomicU32,
    pub kick: Kick,
}

impl Shared {
    pub fn new() -> (Arc<Shared>, mpsc::Receiver<Vec<u8>>) {
        let (tx, rx) = mpsc::channel(QUEUE);
        (Arc::new(Shared { mail: Mutex::new((0, [0; STATE_LEN])), seq: AtomicU32::new(0), tx, dropped: AtomicU32::new(0), kick: Kick::default() }), rx)
    }

    /// Publishes the latest position and state (the connection task, no hub lock).
    pub fn publish(&self, st: &[u8]) {
        let mut m = self.mail.lock().unwrap_or_else(|e| e.into_inner());
        m.0 = m.0.wrapping_add(1).max(1);
        m.1.copy_from_slice(st);
        self.seq.store(m.0, std::sync::atomic::Ordering::Release);
    }

    /// Queues a frame. False when the queue is full (or the connection is gone).
    pub fn send(&self, msg: Vec<u8>) -> bool {
        match self.tx.try_send(msg) {
            Ok(()) => {
                if self.dropped.load(Relaxed) != 0 {
                    self.dropped.store(0, Relaxed);
                }
                true
            }
            Err(_) => {
                if self.dropped.fetch_add(1, Relaxed) + 1 > MAX_DROPPED {
                    self.kick.fire(CLOSE_POLICY, "too slow");
                }
                false
            }
        }
    }

    /// Whether an optional frame (a player's INFO) may be queued now. A burst of them waits for the next tick instead of
    /// filling the queue, which would starve the position frames and look like a client that cannot keep up.
    fn has_room(&self) -> bool {
        self.tx.capacity() > QUEUE / 4
    }
}

/// What other players need to know about one player (read by every receiver in the tick).
#[derive(Clone, Copy, Default)]
struct Pub {
    x: f32,
    z: f32,
    ver: u32, // mailbox sequence of the state below, 0 = no position yet
    info_ver: u32, // 0 = no INFO yet
    st: [u8; STATE_LEN],
    xz16: [u8; 4], // low 16 bits of the x and z positions, for the short entries
}

/// What one receiver has been told about each sender.
#[derive(Clone, Copy, Default)]
struct Seen {
    info: u32, // infoVer the receiver was told about
    sent: u32, // ver of the last state sent (0 = none)
}

struct View {
    known: [u64; 4], // senders this receiver was told about
    seen: Box<[Seen; MAX_PLAYERS]>,
    last_out: Instant,
}

struct Member {
    sh: Arc<Shared>,
    name: String,
    livery: u8,
    joined: Instant,
    last_info: Option<Instant>,
}

#[derive(Default)]
struct Room {
    mem: Vec<Option<Member>>,
    pubs: Vec<Pub>,
    view: Vec<Option<View>>,
    count: u16,
    count_dirty: bool,
    next_info: u32,
}

/// The STATES frame being built for one receiver: full entries (near players) and short entries (the rest).
#[derive(Default)]
struct Frames {
    full: Vec<u8>,
    short: Vec<u8>,
    nf: usize,
    ns: usize,
}

impl Frames {
    fn clear(&mut self) {
        self.full.clear();
        self.short.clear();
        self.nf = 0;
        self.ns = 0;
    }

    /// The frame as one exactly sized message.
    fn build(&self) -> Vec<u8> {
        let mut m = Vec::with_capacity(3 + self.full.len() + self.short.len());
        m.extend_from_slice(&[S_STATES, self.nf as u8, self.ns as u8]);
        m.extend_from_slice(&self.full);
        m.extend_from_slice(&self.short);
        m
    }

    /// The frame was not queued: forget that its players were sent, so the next tick sends them again.
    fn rollback(&self, v: &mut View) {
        for k in 0..self.nf {
            v.seen[self.full[k * FULL_LEN] as usize].sent = 0;
        }
        for k in 0..self.ns {
            v.seen[self.short[k * SHORT_LEN] as usize].sent = 0;
        }
    }
}

#[derive(Default)]
struct Inner {
    rooms: HashMap<String, Room>,
    frames: Frames, // scratch: the STATES frame being built
    grid: Vec<u32>, // scratch: cell and slot of every ready player, sorted
}

#[derive(Default)]
struct Conns {
    ips: HashMap<IpKey, usize>,
    total: usize,
}

pub struct Hub {
    pub cfg: Cfg,
    inner: Mutex<Inner>,
    conns: Mutex<Conns>,
}

/// One admitted connection: releases its per-IP and total slot when dropped.
pub struct ConnGuard {
    hub: Arc<Hub>,
    ip: IpKey,
}

impl Drop for ConnGuard {
    fn drop(&mut self) {
        let mut c = self.hub.conns.lock().unwrap_or_else(|e| e.into_inner());
        c.total = c.total.saturating_sub(1);
        if let Some(n) = c.ips.get_mut(&self.ip) {
            *n -= 1;
            if *n == 0 {
                c.ips.remove(&self.ip);
            }
        }
    }
}

/// A player's place in a room. Leaves the room when dropped.
pub struct Seat {
    hub: Arc<Hub>,
    room: String,
    pub id: u8,
}

impl Drop for Seat {
    fn drop(&mut self) {
        self.hub.leave(&self.room, self.id);
    }
}

fn send_small(sh: &Shared, v: &mut View, m: &[u8], now: Instant) -> bool {
    let ok = sh.send(m.to_vec());
    if ok {
        v.last_out = now;
    }
    ok
}

/// INFO carries the player's position too: the anchor that the 16 bit positions of the STATES entries are added to.
fn info_msg(id: u8, m: &Member, s: &Pub) -> Vec<u8> {
    let mut v = Vec::with_capacity(9 + m.name.len());
    v.extend_from_slice(&[S_INFO, id, m.livery, m.name.len() as u8]);
    v.extend_from_slice(m.name.as_bytes());
    v.extend_from_slice(&s.st[..5]);
    v
}

impl Hub {
    pub fn new(cfg: Cfg) -> Arc<Hub> {
        Arc::new(Hub { cfg, inner: Mutex::new(Inner::default()), conns: Mutex::new(Conns::default()) })
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Takes a connection slot for this client address, or None when the address or the relay is full.
    pub fn admit(self: &Arc<Self>, ip: std::net::IpAddr) -> Option<ConnGuard> {
        let key = ip_key(ip);
        let mut c = self.conns.lock().unwrap_or_else(|e| e.into_inner());
        if c.ips.get(&key).copied().unwrap_or(0) >= self.cfg.per_ip || c.total >= self.cfg.max_conns {
            return None;
        }
        *c.ips.entry(key).or_insert(0) += 1;
        c.total += 1;
        Some(ConnGuard { hub: self.clone(), ip: key })
    }

    pub fn connections(&self) -> usize {
        self.conns.lock().unwrap_or_else(|e| e.into_inner()).total
    }

    /// Puts a player in the first room "<base>#n" with a free slot.
    pub fn join(self: &Arc<Self>, base: &str, sh: Arc<Shared>) -> Seat {
        let mut g = self.lock();
        let mut n = 1;
        loop {
            let key = format!("{base}#{n}");
            n += 1;
            let r = g.rooms.entry(key.clone()).or_insert_with(|| Room { next_info: 1, ..Default::default() });
            let slot = match r.mem.iter().position(Option::is_none) {
                Some(i) => i,
                None if r.mem.len() < MAX_PLAYERS => {
                    r.mem.push(None);
                    r.pubs.push(Pub::default());
                    r.view.push(None);
                    r.mem.len() - 1
                }
                None => continue,
            };
            let now = Instant::now();
            r.mem[slot] = Some(Member { sh, name: String::new(), livery: 0, joined: now, last_info: None });
            r.pubs[slot] = Pub::default();
            r.view[slot] = Some(View { known: [0; 4], seen: Box::new([Seen::default(); MAX_PLAYERS]), last_out: now });
            r.count += 1;
            r.count_dirty = true;
            return Seat { hub: self.clone(), room: key, id: slot as u8 };
        }
    }

    fn leave(&self, key: &str, id: u8) {
        let mut g = self.lock();
        let Some(r) = g.rooms.get_mut(key) else { return };
        let i = id as usize;
        if r.mem[i].take().is_none() {
            return;
        }
        r.pubs[i] = Pub::default();
        r.view[i] = None;
        r.count -= 1;
        r.count_dirty = true;
        let now = Instant::now();
        for (m, v) in r.mem.iter().zip(r.view.iter_mut()) {
            if let (Some(m), Some(v)) = (m, v) {
                if v.known[i >> 6] >> (i & 63) & 1 != 0 {
                    send_small(&m.sh, v, &[S_REMOVE, id], now);
                    v.known[i >> 6] &= !(1 << (i & 63));
                    v.seen[i] = Seen::default();
                }
            }
        }
        if r.count == 0 {
            g.rooms.remove(key);
        }
    }

    /// Applies an INFO message (name and livery already cleaned).
    pub fn set_info(&self, seat: &Seat, name: String, livery: u8, now: Instant) {
        let mut g = self.lock();
        let Some(r) = g.rooms.get_mut(&seat.room) else { return };
        let i = seat.id as usize;
        let has_info = r.pubs[i].info_ver != 0;
        let Some(m) = r.mem[i].as_mut() else { return };
        if has_info && m.last_info.is_some_and(|t| now.duration_since(t) < Duration::from_secs(2)) {
            return; // name spam
        }
        if !has_info || m.name != name || m.livery != livery {
            m.name = name;
            m.livery = livery;
            r.pubs[i].info_ver = r.next_info;
            r.next_info += 1;
            if !has_info {
                r.count_dirty = true;
            }
        }
        m.last_info = Some(now);
    }

    /// Disconnects every client (SIGTERM during a deploy, or the hard usage cap).
    pub fn close_all(&self, code: u16, reason: &'static str) {
        for r in self.lock().rooms.values() {
            for m in r.mem.iter().flatten() {
                m.sh.kick.fire(code, reason);
            }
        }
    }

    // ---------- tick: interest management and batched fan-out ----------

    pub fn tick(&self, now: Instant, tick_no: u32) {
        let t0 = metrics::tick_begin();
        let enter2 = self.cfg.radius * self.cfg.radius;
        let leave2 = enter2 * 1.3; // hysteresis so a player at the edge doesn't flicker (456 m for 400 m)
        let leave = leave2.sqrt();
        let b = self.cfg.bands;
        let bands = Bands { full: b[0] * b[0], mid: b[1] * b[1], far: b[2] * b[2] };
        let mut g = self.lock();
        let Inner { rooms, frames, grid } = &mut *g;
        let mut players = 0;
        for r in rooms.values_mut() {
            players += r.count as usize;
            tick_room(r, frames, grid, now, tick_no, [enter2, leave2], bands, leave);
        }
        drop(g);
        metrics::tick_end(t0, players);
    }
}

#[inline]
fn d2(a: &Pub, b: &Pub) -> f32 {
    let (dx, dz) = (a.x - b.x, a.z - b.z);
    dx * dx + dz * dz
}

#[inline]
fn cell(v: f32, size: f32) -> u32 {
    ((v / size).floor() as i32).clamp(-100, 100).wrapping_add(128) as u32 // 28..228, so a neighbour never wraps
}

/// Considers one sender for one receiver: tells the receiver about it if new or renamed, and appends its state to the frame
/// when it changed and its distance band is due. Returns false when the INFO could not be queued.
/// Squared distances (m) of the bands: full entries within `full`, updates every 2nd tick beyond `mid`, every 4th beyond `far`.
/// Chosen by simulating a car on five paths (steady turn, S-curves, slalom, hard braking, stop and go) with the client's linear
/// interpolation: using every 2nd 10 Hz sample is at most 9 cm off the true path, every 4th at most 29 cm. A view-angle error of
/// 0.1 degree is 14 cm at 80 m and 35 cm at 200 m, so those are the band edges (DEPLOY.md, section 6).
#[derive(Clone, Copy)]
struct Bands {
    full: f32,
    mid: f32,
    far: f32,
}

#[inline]
#[allow(clippy::too_many_arguments)]
fn offer(s: &Pub, j: usize, dist2: f32, m: &Member, mj: &Member, v: &mut View, frames: &mut Frames, phase: u32, bands: Bands, now: Instant) -> bool {
    let sv = &mut v.seen[j];
    if sv.info != s.info_ver {
        if !m.sh.has_room() || !send_small(&m.sh, v, &info_msg(j as u8, mj, s), now) {
            return false;
        }
        let sv = &mut v.seen[j];
        sv.info = s.info_ver;
        sv.sent = 0;
        v.known[j >> 6] |= 1 << (j & 63);
    }
    let sv = &mut v.seen[j];
    if s.ver == sv.sent {
        return true;
    }
    // Distant players are sent less often: every 2nd tick beyond `mid`, every 4th beyond `far`. Which tick is a receiver's own
    // (its slot number shifts it), so a receiver whose players are all far away gets one frame per 2 or 4 ticks, not a thin
    // frame every tick, and the work of the ticks is spread out. The first state after an INFO goes out at once.
    if sv.sent != 0 && if dist2 > bands.far { phase != 0 } else if dist2 > bands.mid { phase & 1 != 0 } else { false } {
        return true;
    }
    // id, low 16 bits of x and z, heading, speed; within 150 m also steer, roll, lean and flags
    if dist2 > bands.full && sv.sent != 0 {
        frames.short.push(j as u8);
        frames.short.extend_from_slice(&s.xz16);
        frames.short.extend_from_slice(&s.st[5..7]);
        frames.ns += 1;
    } else {
        frames.full.push(j as u8);
        frames.full.extend_from_slice(&s.xz16);
        frames.full.extend_from_slice(&s.st[5..11]);
        frames.nf += 1;
    }
    sv.sent = s.ver;
    true
}

fn tick_room(r: &mut Room, frames: &mut Frames, grid: &mut Vec<u32>, now: Instant, tick_no: u32, [enter2, leave2]: [f32; 2], bands: Bands, cell_size: f32) {
    let Room { mem, pubs, view, count, count_dirty, .. } = r;
    let n = mem.len();

    // 1. collect the latest positions from the mailboxes
    for i in 0..n {
        let Some(m) = &mem[i] else { continue };
        let p = &mut pubs[i];
        if m.sh.seq.load(std::sync::atomic::Ordering::Acquire) != p.ver {
            let g = m.sh.mail.lock().unwrap_or_else(|e| e.into_inner());
            p.ver = g.0;
            p.st = g.1;
            drop(g);
            (p.x, p.z) = decode_pos(&p.st);
            p.xz16 = pos16(&p.st);
        }
    }

    // 2. a player that never sent a name is dropped; the others go into the grid
    grid.clear();
    for i in 0..n {
        let Some(m) = &mem[i] else { continue };
        let p = &pubs[i];
        if p.info_ver == 0 {
            if now.duration_since(m.joined) > Duration::from_secs(NO_INFO_SECS) {
                m.sh.kick.fire(CLOSE_POLICY, "no info");
            }
        } else if p.ver != 0 {
            grid.push(cell(p.x, cell_size) << 16 | cell(p.z, cell_size) << 8 | i as u32);
        }
    }
    grid.sort_unstable();

    // 3. one frame per receiver
    for ri in 0..n {
        let (Some(m), Some(v)) = (&mem[ri], &mut view[ri]) else { continue };
        let me = pubs[ri];
        if me.info_ver == 0 {
            continue;
        }
        frames.clear();
        let phase = tick_no.wrapping_add(ri as u32) & 3;
        if me.ver != 0 {
            // players already known: still close enough? changed?
            for w in 0..4 {
                let mut bits = v.known[w];
                while bits != 0 {
                    let j = w * 64 + bits.trailing_zeros() as usize;
                    bits &= bits - 1;
                    let (s, mj) = (&pubs[j], &mem[j]);
                    let dist = d2(&me, s);
                    match mj {
                        Some(mj) if s.info_ver != 0 && s.ver != 0 && dist <= leave2 => {
                            offer(s, j, dist, m, mj, v, frames, phase, bands, now);
                        }
                        _ => {
                            if send_small(&m.sh, v, &[S_REMOVE, j as u8], now) {
                                v.known[w] &= !(1 << (j & 63));
                                v.seen[j] = Seen::default();
                            }
                        }
                    }
                }
            }
            // players that may have come into range: the 3x3 cells around me
            let (cx, cz) = (cell(me.x, cell_size), cell(me.z, cell_size));
            for dx in 0..3 {
                let base = (cx + dx - 1) << 16;
                let lo = grid.partition_point(|&e| e < base | (cz - 1) << 8);
                let hi = grid.partition_point(|&e| e < base | (cz + 2) << 8);
                for &e in &grid[lo..hi] {
                    let j = (e & 255) as usize;
                    if j == ri || v.known[j >> 6] >> (j & 63) & 1 != 0 {
                        continue;
                    }
                    let (s, Some(mj)) = (&pubs[j], &mem[j]) else { continue };
                    let dist = d2(&me, s);
                    if dist <= enter2 {
                        offer(s, j, dist, m, mj, v, frames, phase, bands, now);
                    }
                }
            }
        }
        if frames.nf + frames.ns > 0 {
            if m.sh.send(frames.build()) {
                v.last_out = now;
            } else {
                frames.rollback(v);
            }
        }
        if *count_dirty {
            let c = *count;
            send_small(&m.sh, v, &[S_COUNT, c as u8, (c >> 8) as u8], now);
        }
        if now.duration_since(v.last_out) > Duration::from_secs(BEAT_SECS) {
            send_small(&m.sh, v, &[S_BEAT], now);
        }
    }
    *count_dirty = false;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hub() -> Arc<Hub> {
        Hub::new(Cfg {
            radius: 400.0,
            tick: Duration::from_millis(100),
            max_conns: 300,
            per_ip: 2,
            idle_timeout: Duration::from_secs(45),
            afk_timeout: Duration::from_secs(180),
            max_session: Duration::from_secs(3300),
            filter: true,
            origins: vec![],
            trust_header: None,
            bands: [150.0, 80.0, 200.0],
        })
    }

    fn state(x: f64, z: f64, heading: u8) -> [u8; STATE_LEN] {
        let mut s = [0u8; STATE_LEN];
        s[..5].copy_from_slice(&encode_pos(x, z));
        s[5] = heading;
        s
    }

    fn drain(rx: &mut mpsc::Receiver<Vec<u8>>) -> Vec<Vec<u8>> {
        let mut v = Vec::new();
        while let Ok(m) = rx.try_recv() {
            v.push(m);
        }
        v
    }

    fn player(h: &Arc<Hub>, name: &str, x: f64, z: f64) -> (Seat, Arc<Shared>, mpsc::Receiver<Vec<u8>>) {
        let (sh, rx) = Shared::new();
        let seat = h.join("t", sh.clone());
        h.set_info(&seat, name.into(), 1, Instant::now());
        sh.publish(&state(x, z, 7));
        (seat, sh, rx)
    }

    #[test]
    fn near_then_far_entries_and_leaving() {
        let h = hub();
        let now = Instant::now();
        let (a, _sa, mut ra) = player(&h, "A", 0.0, 0.0);
        let (b, sb, mut rb) = player(&h, "B", 200.0, 0.0);
        h.tick(now, 1);
        let m = drain(&mut ra);
        let kinds: Vec<u8> = m.iter().map(|x| x[0]).collect();
        assert_eq!(kinds, vec![S_INFO, S_STATES, S_COUNT], "{kinds:?}");
        assert_eq!(&m[0][..5], &[S_INFO, b.id, 1, 1, b'B']);
        assert_eq!(&m[0][5..10], &encode_pos(200.0, 0.0), "INFO carries the position");
        // 200 m away, never sent before: a FULL entry
        assert_eq!((m[1][1], m[1][2], m[1].len()), (1, 0, 3 + 11));
        assert_eq!(m[1][3], b.id);
        assert_eq!(m[2], vec![S_COUNT, 2, 0]);
        drain(&mut rb);

        // B moves 10 m at 210 m: beyond 200 m a player is due every 4th tick (A is slot 0, so tick 4), and then as a SHORT entry
        sb.publish(&state(210.0, 0.0, 9));
        h.tick(now, 2);
        h.tick(now, 3);
        assert!(drain(&mut ra).is_empty());
        h.tick(now, 4);
        let m = drain(&mut ra);
        assert_eq!(m.len(), 1);
        assert_eq!((m[0][1], m[0][2], m[0].len()), (0, 1, 3 + 7));
        let (x16, z16) = (u16::from_le_bytes([m[0][4], m[0][5]]), u16::from_le_bytes([m[0][6], m[0][7]]));
        let full = encode_pos(210.0, 0.0);
        let q = u64::from_le_bytes([full[0], full[1], full[2], full[3], full[4], 0, 0, 0]);
        assert_eq!((x16, z16), (q as u16, (q >> 20) as u16));
        assert_eq!(m[0][8], 9); // heading

        // within 80 m every tick, and the entry is FULL again
        sb.publish(&state(60.0, 0.0, 9));
        h.tick(now, 5);
        let m = drain(&mut ra);
        assert_eq!((m[0][1], m[0][2]), (1, 0));

        // out of the 456 m leave radius: REMOVE; back in range (400 m): INFO and a FULL entry again
        sb.publish(&state(460.0, 0.0, 9));
        h.tick(now, 6);
        assert_eq!(drain(&mut ra).iter().map(|x| x[0]).collect::<Vec<_>>(), vec![S_REMOVE]);
        sb.publish(&state(390.0, 0.0, 9));
        h.tick(now, 7);
        let kinds: Vec<u8> = drain(&mut ra).iter().map(|x| x[0]).collect();
        assert_eq!(kinds, vec![S_INFO, S_STATES]);

        // leaving the room tells everybody who knew
        drop(b);
        let kinds: Vec<u8> = drain(&mut ra).iter().map(|x| x[0]).collect();
        assert_eq!(kinds, vec![S_REMOVE]);
        drop(a);
        assert_eq!(h.connections(), 0);
    }

    #[test]
    fn a_full_queue_loses_nothing_for_good() {
        let h = hub();
        let now = Instant::now();
        let (_a, _sa, mut ra) = player(&h, "A", 0.0, 0.0);
        let (_b, sb, _rb) = player(&h, "B", 10.0, 0.0);
        h.tick(now, 1);
        drain(&mut ra);
        // A's reader stalls: fill its queue (32 frames), the next STATES frame is refused and must be sent again later
        for i in 0..QUEUE {
            sb.publish(&state(10.0 + i as f64, 0.0, 3));
            h.tick(now, 2 + i as u32);
        }
        sb.publish(&state(99.0, 0.0, 4));
        h.tick(now, 100);
        let m = drain(&mut ra);
        assert_eq!(m.len(), QUEUE, "queue is bounded");
        h.tick(now, 101);
        let m = drain(&mut ra);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0][3 + 5], 4, "the refused state arrives with the next frame");
    }

    #[test]
    fn rooms_fill_up_and_overflow_to_the_next() {
        let h = hub();
        let mut seats = Vec::new();
        for _ in 0..MAX_PLAYERS + 1 {
            let (sh, _rx) = Shared::new();
            seats.push(h.join("big", sh));
        }
        assert_eq!(seats[255].id, 255);
        assert_eq!(seats[256].id, 0, "the 257th player starts room #2");
        let g = h.lock();
        assert_eq!(g.rooms.len(), 2);
        assert_eq!(g.rooms["big#1"].count, 256);
    }

    #[test]
    fn per_address_limit() {
        let h = hub();
        let ip: std::net::IpAddr = "203.0.113.7".parse().unwrap();
        let (c1, c2) = (h.admit(ip).unwrap(), h.admit(ip).unwrap());
        assert!(h.admit(ip).is_none());
        // two IPv6 addresses in one /64 are one client
        let v6a: std::net::IpAddr = "2001:db8:1:2::1".parse().unwrap();
        let v6b: std::net::IpAddr = "2001:db8:1:2:ffff::9".parse().unwrap();
        let (_d1, _d2) = (h.admit(v6a).unwrap(), h.admit(v6b).unwrap());
        assert!(h.admit("2001:db8:1:2::3".parse().unwrap()).is_none());
        assert!(h.admit("2001:db8:1:3::1".parse().unwrap()).is_some());
        drop(c1);
        assert!(h.admit(ip).is_some());
        drop(c2);
    }
}
