//! A crowd of simulated players in virtual time: layouts, a car that drives a loop the way tools/online/bytes.mjs does,
//! and the game's own send rule (src/online/online.js `stateDue`, with src/predict.js `predict`), ported line by line.
//! The hub is the relay's real one; nothing here sleeps, so a minute of a 300 player crowd takes a second or two.
use crate::hub::{Action, Hub};
use crate::proto::*;
use std::collections::HashMap;
use std::f64::consts::PI;

pub struct Rng(pub u64);
impl Rng {
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }
    pub fn f(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
    pub fn range(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.f()
    }
}

// ---------- the loop a car drives (tools/online/bytes.mjs track()) ----------
/// Points every metre along a rounded rectangle w x h with corner radius r, and the speed limit there: 16 m/s on straights,
/// 9 in corners, braking at 5 m/s2 before a corner, accelerating at 3 after it.
pub fn track(w: f64, h: f64, r: f64, rot: f64, cx: f64, cz: f64) -> Vec<(f64, f64, f64)> {
    let corners = [(w / 2.0 - r, h / 2.0 - r, 0.0), (w / 2.0 - r, -h / 2.0 + r, 1.0), (-w / 2.0 + r, -h / 2.0 + r, 2.0), (-w / 2.0 + r, h / 2.0 - r, 3.0)];
    let mut raw = vec![];
    for (ox, oz, k) in corners {
        let mut a = 0.0;
        while a <= 90.0 {
            let t = (k * 90.0 + a) * PI / 180.0;
            raw.push((ox + t.sin() * r, oz + t.cos() * r, 1.0));
            a += 3.0;
        }
    }
    let mut pts: Vec<(f64, f64, f64)> = vec![];
    for i in 0..raw.len() {
        let (a, b) = (raw[i], raw[(i + 1) % raw.len()]);
        let l = (b.0 - a.0).hypot(b.1 - a.1);
        let n = (l.round() as usize).max(1);
        for j in 0..n {
            let f = j as f64 / n as f64;
            pts.push((a.0 + (b.0 - a.0) * f, a.1 + (b.1 - a.1) * f, if l > 3.0 { 0.0 } else { 1.0 }));
        }
    }
    let n = pts.len();
    let mut v: Vec<f64> = pts.iter().map(|p| if p.2 > 0.5 { 9.0 } else { 16.0 }).collect();
    for _ in 0..3 {
        for i in (0..n).rev() {
            let nx = v[(i + 1) % n];
            v[i] = v[i].min((nx * nx + 2.0 * 5.0).sqrt());
        }
        for i in 0..n {
            let p = v[(i + n - 1) % n];
            v[i] = v[i].min((p * p + 2.0 * 3.0).sqrt());
        }
    }
    let (s, c) = rot.sin_cos();
    pts.iter().enumerate().map(|(i, p)| (cx + p.0 * c - p.1 * s, cz + p.0 * s + p.1 * c, v[i])).collect()
}

// ---------- src/predict.js ----------
#[derive(Clone, Copy, Default, Debug)]
pub struct St {
    pub t: f64,
    pub x: f64,
    pub z: f64,
    pub th: f64,
    pub v: f64,
    pub steer: f64,
    pub roll: f64,
    pub lean: f64,
    pub fl: u8,
    pub k: f64,
    pub a: f64,
    pub h: f64,
}
pub fn predict(s: &St, dt: f64) -> (f64, f64, f64, f64) {
    let mut v = s.v;
    let a = s.a;
    let stop = if a * v < 0.0 { -v / a } else { f64::INFINITY };
    let t = dt.min(stop);
    let d = v * t + 0.5 * a * t * t;
    v += a * t;
    let k = s.k;
    let th1 = s.th + k * d;
    if (k * d).abs() < 1e-4 {
        return (s.x + s.th.sin() * d, s.z + s.th.cos() * d, th1, v);
    }
    (s.x + (s.th.cos() - th1.cos()) / k, s.z + (th1.sin() - s.th.sin()) / k, th1, v)
}
fn wrap_pi(a: f64) -> f64 {
    let mut a = a % (2.0 * PI);
    if a > PI {
        a -= 2.0 * PI
    }
    if a < -PI {
        a += 2.0 * PI
    }
    a
}

// ---------- src/online/wire.js: the state as sent and as read back ----------
pub fn clampf(x: f64, a: f64, b: f64) -> f64 {
    x.max(a).min(b)
}
pub fn state_frame(s: &St, now_ms: u64) -> Vec<u8> {
    let lift = if s.h > 0.6 { s.h.min(1000.0) } else { 0.0 };
    let mut b = vec![0u8; if lift > 0.0 { 21 } else { 19 }];
    b[0] = 3;
    b[1..3].copy_from_slice(&((now_ms & 0xffff) as u16).to_le_bytes());
    b[3..8].copy_from_slice(&encode_pos(s.x, s.z));
    let th = (((s.th % (2.0 * PI)) + 2.0 * PI) % (2.0 * PI)) / (2.0 * PI) * 65536.0;
    b[8..10].copy_from_slice(&((th.round() as i64 & 0xffff) as u16).to_le_bytes());
    b[10..12].copy_from_slice(&(clampf((s.v * 100.0).round(), -32767.0, 32767.0) as i16).to_le_bytes());
    b[12] = (clampf((s.steer / 0.7 * 127.0).round(), -127.0, 127.0) as i8) as u8;
    b[13] = (clampf((s.roll / 0.5 * 127.0).round(), -127.0, 127.0) as i8) as u8;
    b[14] = (clampf((s.lean * 127.0).round(), -127.0, 127.0) as i8) as u8;
    b[15] = (s.fl & 7) | if lift > 0.0 { 8 } else { 0 };
    b[16..18].copy_from_slice(&(clampf((s.k * 10000.0).round(), -30000.0, 30000.0) as i16).to_le_bytes());
    b[18] = (clampf((s.a * 10.0).round(), -127.0, 127.0) as i8) as u8;
    if lift > 0.0 {
        b[19..21].copy_from_slice(&((lift * 10.0).round() as u16).to_le_bytes());
    }
    b
}
/// What a receiver reads back from a state frame (readState): the sender's `last` is this, so quantisation is part of the rule.
pub fn read_state(b: &[u8]) -> St {
    read_state_at(b, 1)
}
/// The state that starts at byte o of b (a client frame has it at 1, a relay STATE frame at 3).
pub fn read_state_at(b: &[u8], o: usize) -> St {
    let (x, z) = decode_pos(&b[o + 2..o + 7]);
    let i16at = |q: usize| i16::from_le_bytes([b[o + q], b[o + q + 1]]) as f64;
    St {
        t: u16::from_le_bytes([b[o], b[o + 1]]) as f64,
        x: x as f64,
        z: z as f64,
        th: u16::from_le_bytes([b[o + 7], b[o + 8]]) as f64 / 65536.0 * 2.0 * PI,
        v: clampf(i16at(9) / 100.0, -60.0, 60.0),
        steer: b[o + 11] as i8 as f64 / 127.0 * 0.7,
        roll: b[o + 12] as i8 as f64 / 127.0 * 0.5,
        lean: b[o + 13] as i8 as f64 / 127.0,
        fl: b[o + 14] & 7,
        k: clampf(i16at(15) / 10000.0, -3.0, 3.0),
        a: b[o + 17] as i8 as f64 / 10.0,
        h: if b[o + 14] & 8 != 0 { u16::from_le_bytes([b[o + 18], b[o + 19]]) as f64 / 10.0 } else { 0.0 },
    }
}
// ---------- the player: car, kinematics and the send rule ----------
/// The send rule's constants, src/online/online.js. The tolerances can be loosened for the experiments.
#[derive(Clone, Copy, Debug)]
pub struct Rule {
    pub send_near: f64,
    pub send_mid: f64,
    pub send_far: f64,
    pub send_afar: f64,
    pub keep_moving: f64,
    pub keep_parked: f64,
    /// with the audience of protocol 3 (ms): the longest silence moving without anybody holding us, still with somebody, still with nobody; and the distance scale of the tolerances
    pub keep_moving_nobody: f64,
    pub keep_parked_aud: f64,
    pub keep_parked_nobody: f64,
    /// is the pace set by the audience the relay tells (protocol 3), or by the nearest player of our own set (what the game did until now)
    pub use_audience: bool,
    pub dr_pos: f64,
    pub dr_th: f64,
    pub dr_v: f64,
    pub dr_roll: f64,
    /// tolerance grows as max(1, d / dist_scale): 50 m in the game
    pub dist_scale: f64,
}
impl Rule {
    /// The send rule of src/online/online.js as shipped with protocol 3 (the constants of that file).
    pub fn shipped() -> Rule {
        Rule { keep_moving_nobody: 4000.0, keep_parked_aud: 4000.0, keep_parked_nobody: 15000.0, use_audience: true, dr_pos: 0.3, dr_th: 0.05, dr_v: 0.75, dr_roll: 0.075, dist_scale: 25.0, ..Rule::default() }
    }
}
impl Default for Rule {
    fn default() -> Self {
        Rule { send_near: 100.0, send_mid: 200.0, send_far: 1000.0, send_afar: 2500.0, keep_moving: 1000.0, keep_parked: 2000.0, keep_moving_nobody: 1000.0, keep_parked_aud: 2000.0, keep_parked_nobody: 2000.0, use_audience: false, dr_pos: 0.2, dr_th: 0.035, dr_v: 0.5, dr_roll: 0.05, dist_scale: 50.0 }
    }
}

pub struct Bot {
    pub handle: u16,
    pub pts: Vec<(f64, f64, f64)>, // empty: parked
    pub s: f64,
    pub x: f64,
    pub z: f64,
    pub th: f64,
    pub v: f64,
    px: f64,
    pz: f64,
    tdrive: f64,
    kt: f64,
    kth: f64,
    kv: f64,
    kw: f64,
    ka: f64,
    pub last: Option<St>,
    pub last_t: f64,
    pub force: bool,
    /// the band the relay last told this player (protocol 3): 0 nobody holds it, 1 to 8 by how far the nearest holder is
    pub audience: Option<u8>,
    /// the car's body roll: the game's physics moves it in corners with some bounce (measured with tools/online/bytes.mjs: it went from -0.2 to +0.07 on the 160 x 100 m loop). Modelled as a second order
    /// response to the lateral acceleration, ROLL_GAIN of it; the gain is fitted so that two drivers on that loop send the measured 4.7 states a second (docs/ONLINE-CROWD.md).
    pub roll: f64,
    rollv: f64,
    roll_phase: usize,
    /// terrain roll noise (an Ornstein-Uhlenbeck process, ROLL_NOISE metres-per-second-free radians of standard deviation, 0.3 s long): the measured roll also jumps on straights
    noise: f64,
    rng: Rng,
}
pub static mut ROLL_NOISE: f64 = 0.0;
pub static mut ROLL_FROM_SERIES: bool = true;
fn roll_series() -> &'static Vec<f32> {
    static S: std::sync::OnceLock<Vec<f32>> = std::sync::OnceLock::new();
    S.get_or_init(|| include_str!("../roll-series.txt").lines().filter_map(|l| l.trim().parse().ok()).collect())
}
pub const ROLL_GAIN: f64 = 0.0226;
pub const ROLL_W: f64 = 12.0;
pub const ROLL_ZETA: f64 = 0.25;
impl Bot {
    pub fn new(x: f64, z: f64, th: f64, pts: Vec<(f64, f64, f64)>, s0: f64) -> Self {
        let mut b = Bot { handle: 0, pts, s: s0, x, z, th, v: 0.0, px: f64::NAN, pz: f64::NAN, tdrive: 0.0, kt: 0.0, kth: 0.0, kv: 0.0, kw: 0.0, ka: 0.0, last: None, last_t: 0.0, force: false, audience: None, roll: 0.0, rollv: 0.0, roll_phase: (x.to_bits() ^ z.to_bits().rotate_left(29)) as usize % 1249, noise: 0.0, rng: Rng(x.to_bits() ^ z.to_bits().rotate_left(17) ^ 0x1234567) };
        if !b.pts.is_empty() {
            b.drive(0.0);
            b.px = f64::NAN;
        }
        b
    }
    fn at(&self, s: f64) -> (f64, f64, f64, f64) {
        let n = self.pts.len();
        let i = s.floor() as usize % n;
        let f = s - s.floor();
        let (a, b) = (self.pts[i], self.pts[(i + 1) % n]);
        (a.0 + (b.0 - a.0) * f, a.1 + (b.1 - a.1) * f, a.2 + (b.2 - a.2) * f, (b.0 - a.0).atan2(b.1 - a.1))
    }
    /// One frame of driving (bytes.mjs `drive`): along the loop at its speed limit with a 0.3 m weave across the lane.
    pub fn drive(&mut self, dt: f64) {
        if self.pts.is_empty() {
            return;
        }
        self.tdrive += dt;
        let n = self.pts.len() as f64;
        let (_, _, v, _) = self.at(self.s);
        self.s = (self.s + v * dt) % n;
        let (x, z, _, th) = self.at(self.s);
        let w = (self.tdrive * 2.0 * PI / 3.0).sin() * 0.3;
        let (nx, nz) = (x + th.cos() * w, z - th.sin() * w);
        let head = if self.px.is_finite() && (nx - self.px).hypot(nz - self.pz) > 1e-4 { (nx - self.px).atan2(nz - self.pz) } else { th };
        self.x = nx;
        self.z = nz;
        self.th = head;
        self.v = v;
        self.px = nx;
        self.pz = nz;
    }
    pub fn track_kin(&mut self, now: f64) {
        let dt = (now - self.kt) / 1000.0;
        let v = self.v;
        if self.kt != 0.0 && dt > 0.0 && dt < 0.5 {
            let f = (dt / 0.08).min(1.0);
            self.kw += (wrap_pi(self.th - self.kth) / dt - self.kw) * f;
            self.ka += ((v - self.kv) / dt - self.ka) * f;
        } else {
            self.kw = 0.0;
            self.ka = 0.0;
        }
        self.kt = now;
        self.kth = self.th;
        self.kv = v;
        if unsafe { ROLL_FROM_SERIES } {
            // the real roll: what the game's own physics computed for the car on the 160 x 100 m loop (roll-series.txt, one value every 20 ms, from the recording netcompare-drive.json), replayed from a
            // phase of the bot's own; a parked car has none. The model below (second order response with noise) was the stand-in before that recording was used; it has spikes of other sizes.
            if self.pts.is_empty() {
                self.roll = 0.0;
            } else {
                let series = roll_series();
                self.roll = series[(self.roll_phase + (now / 20.0) as usize) % series.len()] as f64;
            }
            return;
        }
        if dt > 0.0 && dt < 0.5 {
            // the body: x'' = w2 (target - x) - 2 z w x'
            let (sigma, tau) = (unsafe { ROLL_NOISE }, 0.3);
            let g = (self.rng.f() + self.rng.f() + self.rng.f() + self.rng.f() - 2.0) * 1.7320508; // about unit variance
            self.noise += -self.noise / tau * dt + sigma * (2.0 * dt / tau).sqrt() * g;
            let target = -ROLL_GAIN * v * self.kw + if v.abs() > 0.2 { self.noise } else { 0.0 };
            let acc = ROLL_W * ROLL_W * (target - self.roll) - 2.0 * ROLL_ZETA * ROLL_W * self.rollv;
            self.rollv += acc * dt;
            self.roll += self.rollv * dt;
        }
    }
    pub fn car_state(&self, now: f64) -> St {
        let v = self.v;
        St { t: now, x: self.x, z: self.z, th: self.th, v, steer: 0.0, roll: self.roll.clamp(-0.5, 0.5), lean: 0.0, fl: 0, k: if v.abs() > 1.0 { self.kw / v } else { 0.0 }, a: self.ka, h: 0.0 }
    }
    /// online.js stateDue(now, d): d is the distance to the nearest player of the set, infinity with nobody.
    pub fn due(&self, now: f64, d: f64, r: &Rule) -> bool {
        self.why(now, d, r) != 0
    }
    /// 0 not due, 1 first or forced, 2 keepalive, 3 position, 4 heading, 5 speed, 6 roll
    pub fn why(&self, now: f64, d: f64, r: &Rule) -> u8 {
        let Some(last) = self.last else { return 1 };
        let age = now - self.last_t;
        let band = if d < 150.0 { r.send_near } else if d < 350.0 { r.send_mid } else if d < 1200.0 { r.send_far } else { r.send_afar };
        if age < r.send_near - 5.0 {
            return 0;
        }
        if self.force {
            return 1;
        }
        if age < band - 5.0 {
            return 0;
        }
        let moving = self.v.abs() > 0.2 || last.v.abs() > 0.2;
        let nobody = self.audience == Some(0);
        let keep = if moving {
            if nobody { r.keep_moving_nobody } else { r.keep_moving }
        } else if nobody {
            r.keep_parked_nobody
        } else if r.use_audience && self.audience.is_some() {
            r.keep_parked_aud
        } else {
            r.keep_parked
        };
        if age >= band.max(keep) {
            return 2;
        }
        let f = (d / r.dist_scale).max(1.0);
        let pr = predict(&last, age.min(1500.0) / 1000.0);
        if (self.x - pr.0).hypot(self.z - pr.1) > r.dr_pos * f {
            3
        } else if wrap_pi(self.th - pr.2).abs() > r.dr_th * f {
            4
        } else if (self.v - pr.3).abs() > r.dr_v * f {
            5
        } else if (self.roll.clamp(-0.5, 0.5) - last.roll).abs() > r.dr_roll * if r.use_audience { f } else { 1.0 } {   // protocol 3: body roll, like the rest, matters less the farther the nearest receiver is (and not at all with nobody)
            6
        } else {
            0
        }
    }
}

// ---------- layouts ----------
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Layout {
    /// all inside a 100 m square: a meeting point, the start of a race, the stadium
    Tight,
    /// along 1 km of road
    Street,
    /// over 10 km, in clusters
    City,
    /// half in one tight crowd, a quarter on a street, a quarter scattered over the city
    Mix,
}
impl Layout {
    pub fn parse(s: &str) -> Option<Layout> {
        Some(match s {
            "tight" => Layout::Tight,
            "street" => Layout::Street,
            "city" => Layout::City,
            "mix" => Layout::Mix,
            _ => return None,
        })
    }
}

fn loop_bot(rng: &mut Rng, w: f64, h: f64, cx: f64, cz: f64, calm: bool) -> Bot {
    // calm: the loop of tools/online/bytes.mjs (160 x 100 m, 25 m corners), the one the measured 2.4 to 4.7 states a second belong to; busy: tight small loops of random size, corners of 12 m
    let (w, h, r) = if calm { (160.0, 100.0, 25.0) } else { (w, h, 12.0_f64.min(h / 2.5)) };
    let pts = track(w, h, r, rng.range(0.0, 2.0 * PI), cx, cz);
    let s0 = rng.range(0.0, pts.len() as f64);
    Bot::new(cx, cz, 0.0, pts, s0)
}

/// Where the n players are and which of them drive. `drive` is the share that drive (the others are parked).
pub fn place(layout: Layout, n: usize, drive: f64, calm: bool, rng: &mut Rng) -> Vec<Bot> {
    let clusters: Vec<(f64, f64)> = (0..8).map(|_| (rng.range(-4500.0, 4500.0), rng.range(-4500.0, 4500.0))).collect();
    let mut out = vec![];
    for i in 0..n {
        let driving = rng.f() < drive;
        let (kind, ox, oz) = match layout {
            Layout::Tight => (0, 0.0, 0.0),
            Layout::Street => (1, -500.0, 0.0),
            Layout::City => (2, 0.0, 0.0),
            Layout::Mix => {
                if i * 2 < n {
                    (0, 2000.0, 2000.0)
                } else if i * 4 < n * 3 {
                    (1, -3000.0, -2500.0)
                } else {
                    (2, 0.0, 0.0)
                }
            }
        };
        out.push(match kind {
            0 => {
                // a loop of its own inside the square, random size and turn, so the cars are not in a line
                if driving {
                    let (w, h) = (rng.range(40.0, 90.0), rng.range(30.0, 60.0));
                    let (cx, cz) = (ox + rng.range(-20.0, 20.0), oz + rng.range(-20.0, 20.0));
                    loop_bot(rng, w, h, cx, cz, calm)
                } else {
                    Bot::new(ox + rng.range(-50.0, 50.0), oz + rng.range(-50.0, 50.0), rng.range(0.0, 2.0 * PI), vec![], 0.0)
                }
            }
            1 => {
                if driving {
                    let pts = track(1000.0, 30.0, 12.0, 0.0, ox + 500.0, oz);
                    let s0 = rng.range(0.0, pts.len() as f64);
                    let (x, z, _) = pts[s0 as usize];
                    Bot::new(x, z, 0.0, pts, s0)
                } else {
                    Bot::new(ox + rng.range(0.0, 1000.0), oz + rng.range(-12.0, 12.0), 0.0, vec![], 0.0)
                }
            }
            _ => {
                let (cx, cz) = if rng.f() < 0.1 {
                    (rng.range(-5000.0, 5000.0), rng.range(-5000.0, 5000.0)) // a loner
                } else {
                    let c = clusters[(rng.next() % 8) as usize];
                    (c.0 + rng.range(-150.0, 150.0), c.1 + rng.range(-150.0, 150.0))
                };
                if driving {
                    let (w, h) = (rng.range(60.0, 110.0), rng.range(40.0, 70.0));
                    loop_bot(rng, w, h, cx, cz, calm)
                } else {
                    Bot::new(cx, cz, rng.range(0.0, 2.0 * PI), vec![], 0.0)
                }
            }
        });
    }
    out
}

// ---------- the run ----------
#[derive(Default, Clone)]
pub struct PerPlayer {
    pub rx_frames: u64,
    pub rx_states: u64,
    pub rx_bytes: u64,
    pub rx_packets: u64,
    pub held_sum: u64,
    pub held_n: u64,
}

pub struct Report {
    pub players: Vec<PerPlayer>,
    pub tx_frames: Vec<u64>,
    pub tx_bytes: Vec<u64>,
    pub secs: f64,
    pub events: u64,
    pub forwarded: u64,
    pub thinned: u64,
    pub by_type: [u64; 16],
    /// error of the drawn car (where the receiver's prediction puts it against where it is), metres, by distance band < 50, < 150, < 400, farther
    pub err: [Vec<f32>; 4],
    pub driving: Vec<bool>,
}

pub struct Run {
    /// protocol version of every player (2: today's relay behaviour, 3: radius sets, batching, audience); `want_k` is what a v3 player asks for (0: the hub's default)
    pub ver: u8,
    pub want_k: u8,
    pub layout: Layout,
    pub n: usize,
    pub drive: f64,
    pub seed: u64,
    pub secs: f64,
    pub warm: f64,
    pub rule: Rule,
    /// frames a second of the game loop that evaluates the send rule (the real game runs at what the machine gives it)
    pub fps: f64,
    pub calm: bool,
    /// how many receivers are watched for the drawn error
    pub obs_n: usize,
    pub why: std::cell::RefCell<[u64; 7]>,
}

/// Runs the crowd against `hub` (made by the caller, so that its options are the caller's) for `warm + secs` virtual seconds, 60 steps a second.
pub fn run(hub: &mut Hub, r: &Run) -> Report {
    let mut rng = Rng(r.seed.wrapping_mul(0x2545F4914F6CDD1D).wrapping_add(7));
    let mut bots = place(r.layout, r.n, r.drive, r.calm, &mut rng);
    let mut byh: HashMap<u16, usize> = HashMap::new();
    for (i, b) in bots.iter_mut().enumerate() {
        let h = hub.accept(&format!("10.0.{}.{}", i / 250, i % 250), 0).unwrap().0;
        b.handle = h;
        byh.insert(h, i);
        let mut hello = if r.ver == 3 { vec![1u8, VERSION_3, r.want_k, 0, 0, 4, b'b', b'o', b't', b'0' + (i % 10) as u8] } else { vec![1u8, VERSION, 0, 0, 4, b'b', b'o', b't', b'0' + (i % 10) as u8] };
        let _ = &mut hello;
        hub.on_binary(h, &hello, 0);
    }
    let driving: Vec<bool> = bots.iter().map(|b| !b.pts.is_empty()).collect();
    let mut rep = Report { players: vec![PerPlayer::default(); r.n], tx_frames: vec![0; r.n], tx_bytes: vec![0; r.n], secs: r.secs, events: 0, forwarded: 0, thinned: 0, by_type: [0; 16], err: Default::default(), driving };
    let total_steps = ((r.warm + r.secs) * r.fps) as u64;
    let warm_steps = (r.warm * r.fps) as u64;
    let (mut f0, mut th0, mut ev0) = (0, 0, 0);
    // what the first `obs_n` receivers last heard of each player they hold (the state as the receiver reads it)
    let mut obs: HashMap<(usize, u16), St> = HashMap::new();
    // PD_DUMP=file: every frame the first player receives, as [len u16][bytes], for the compression test (tools/online/deflate.mjs)
    let mut dump: Vec<u8> = vec![];
    let dump_to = std::env::var("PD_DUMP").ok();
    let mut next_sample = 0u64;
    for step in 0..total_steps {
        let now_f = step as f64 * 1000.0 / r.fps;
        let now = now_f as u64;
        let measuring = step >= warm_steps;
        if step == warm_steps {
            f0 = hub.stats.forwarded;
            th0 = hub.stats.thinned;
            ev0 = hub.stats.frames_in;
        }
        for i in 0..r.n {
            bots[i].drive(1.0 / r.fps);
            bots[i].track_kin(now_f);
            let h = bots[i].handle;
            // d: the nearest player of the set (what the client knows)
            let aud_d = match (r.rule.use_audience, bots[i].audience) {
                (true, Some(0)) => Some(f64::INFINITY),
                (true, Some(b)) => Some([f64::INFINITY, 0.0, 50.0, 100.0, 150.0, 250.0, 350.0, 600.0, 1200.0][b as usize]),
                _ => None,
            };
            let d = match hub.conn(h) {
                _ if aud_d.is_some() => aud_d.unwrap(),
                Some(c) if !c.set.is_empty() => {
                    let mut d = f64::INFINITY;
                    for m in &c.set {
                        let o = &bots[byh[m]];
                        d = d.min((o.x - bots[i].x).hypot(o.z - bots[i].z));
                    }
                    d
                }
                _ => f64::INFINITY,
            };
            let why = bots[i].why(now_f, d, &r.rule);
            if why == 0 {
                continue;
            }
            if step >= warm_steps {
                r.why.borrow_mut()[why as usize] += 1;
            }
            let st = bots[i].car_state(now_f);
            let f = state_frame(&st, now);
            let acts = hub.on_binary(h, &f, now);
            bots[i].last = Some(read_state(&f));
            bots[i].last_t = now_f;
            bots[i].force = false;
            if measuring {
                rep.tx_frames[i] += 1;
                rep.tx_bytes[i] += f.len() as u64;
            }
            let mut burst: Vec<u16> = vec![];
            for a in &acts {
                if let Action::Send(to, b) = a {
                    let ti = byh[to];
                    if ti == 0 && dump_to.is_some() && measuring {
                        dump.extend_from_slice(&(b.len() as u16).to_le_bytes());
                        dump.extend_from_slice(b);
                    }
                    if ti < r.obs_n {
                        let h16 = |o: usize| u16::from_le_bytes([b[o], b[o + 1]]);
                        match b[0] {
                            4 => { obs.insert((ti, h16(1)), read_state_at(b, 3)); }
                            8 => {
                                let (mut o, n) = (2, b[1]);
                                for _ in 0..n {
                                    let from = h16(o);
                                    let l = if b[o + 2 + 14] & 8 != 0 { 20 } else { 18 };
                                    obs.insert((ti, from), read_state_at(b, o + 2));
                                    o += 2 + l;
                                }
                            }
                            _ => {}
                        }
                    }
                    if b[0] == 2 && !r.rule.use_audience {
                        bots[byh[to]].force = true; // a newcomer in our set is owed a state at once: the old guess that it holds us too. With the audience the relay says who holds us.
                    }
                    if b[0] == 9 {
                        // the audience: a nearer one than before, or the first holder, is owed a state at once (it holds our latest from its ENTER)
                        let t = &mut bots[byh[to]];
                        let band = b[1];
                        if band != 0 && (t.audience.is_none() || t.audience == Some(0) || band < t.audience.unwrap()) {
                            t.force = true;
                        }
                        t.audience = Some(band);
                    }
                    if measuring {
                        let p = &mut rep.players[byh[to]];
                        p.rx_frames += 1;
                        p.rx_bytes += b.len() as u64;
                        if b[0] == 4 {
                            p.rx_states += 1;
                        }
                        rep.by_type[(b[0] & 15) as usize] += 1;
                        if !burst.contains(to) {
                            burst.push(*to);
                            p.rx_packets += 1;
                        }
                    }
                }
            }
        }
        if measuring && step % 3 == 0 {
            for ti in 0..r.obs_n.min(r.n) {
                let Some(c) = hub.conn(bots[ti].handle) else { continue };
                for m in c.set.iter() {
                    let Some(st) = obs.get(&(ti, *m)) else { continue };
                    let o = &bots[byh[m]];
                    let age = (((now & 0xffff) as i64 - st.t as i64).rem_euclid(65536)) as f64 / 1000.0;
                    if age > 5.0 { continue; }
                    let pr = predict(st, age);
                    let err = (o.x - pr.0).hypot(o.z - pr.1) as f32;
                    let d = (o.x - bots[ti].x).hypot(o.z - bots[ti].z);
                    rep.err[if d < 50.0 { 0 } else if d < 150.0 { 1 } else if d < 400.0 { 2 } else { 3 }].push(err);
                }
            }
        }
        if measuring && step >= next_sample {
            next_sample = step + r.fps as u64;
            for i in 0..r.n {
                if let Some(c) = hub.conn(bots[i].handle) {
                    let p = &mut rep.players[i];
                    p.held_sum += c.set.len() as u64;
                    p.held_n += 1;
                }
            }
        }
    }
    if let Some(f) = dump_to {
        std::fs::write(f, &dump).unwrap();
    }
    rep.events = hub.stats.frames_in - ev0;
    rep.forwarded = hub.stats.forwarded - f0;
    rep.thinned = hub.stats.thinned - th0;
    rep
}

fn pct(v: &[f64], p: f64) -> f64 {
    if v.is_empty() {
        return 0.0;
    }
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.total_cmp(b));
    s[((s.len() as f64 * p) as usize).min(s.len() - 1)]
}
fn mean(v: &[f64]) -> f64 {
    if v.is_empty() {
        0.0
    } else {
        v.iter().sum::<f64>() / v.len() as f64
    }
}

/// Overheads of the estimate of bytes on the wire, per frame and per packet (docs/ONLINE-CROWD.md, "Bytes on the wire").
pub const WS_DOWN: f64 = 2.0; // relay to client: no mask, payload under 126
pub const WS_UP: f64 = 6.0; // client to relay: 2 bytes and a 4 byte mask
pub const TLS: f64 = 22.0; // TLS 1.3 record: 5 header, 1 content type, 16 tag
pub const IPTCP: f64 = 52.0; // IPv4 20 + TCP 20 + 12 of timestamp option, per packet

impl Report {
    /// One JSON object. down_*: per player per second over the players (mean, p50, p95, max); `ip` counts TLS records and TCP/IP
    /// headers with the frames of one burst to one receiver sharing a packet, `ip_nocoalesce` with every frame a packet of its own.
    pub fn json(&self, label: &str) -> String {
        let s = self.secs;
        let pl = &self.players;
        let col = |f: &dyn Fn(&PerPlayer) -> f64| -> Vec<f64> { pl.iter().map(|p| f(p) / s).collect() };
        let down_f = col(&|p| p.rx_frames as f64);
        let down_b = col(&|p| p.rx_bytes as f64);
        let ws = col(&|p| p.rx_bytes as f64 + p.rx_frames as f64 * WS_DOWN);
        let ip = col(&|p| p.rx_bytes as f64 + p.rx_frames as f64 * (WS_DOWN + TLS) + p.rx_packets as f64 * IPTCP);
        let ipn = col(&|p| p.rx_bytes as f64 + p.rx_frames as f64 * (WS_DOWN + TLS + IPTCP));
        let pk = col(&|p| p.rx_packets as f64);
        let held: Vec<f64> = pl.iter().map(|p| if p.held_n > 0 { p.held_sum as f64 / p.held_n as f64 } else { 0.0 }).collect();
        let up_f: Vec<f64> = self.tx_frames.iter().map(|x| *x as f64 / s).collect();
        let sel = |d: bool| -> Vec<f64> { up_f.iter().zip(&self.driving).filter(|x| *x.1 == d).map(|x| *x.0).collect() };
        let n = pl.len() as f64;
        let (txf, txb) = (self.tx_frames.iter().sum::<u64>() as f64, self.tx_bytes.iter().sum::<u64>() as f64);
        let g = |v: f64| if v.is_finite() { v } else { 0.0 };
        format!(
            "{{\"label\":\"{label}\",\"n\":{},\"down_frames\":[{:.2},{:.2},{:.2},{:.2}],\"down_payload\":[{:.0},{:.0},{:.0},{:.0}],\"down_ws\":[{:.0},{:.0}],\"down_ip\":[{:.0},{:.0}],\"down_ip_nocoalesce\":{:.0},\"down_packets\":{:.2},\"up_frames\":{:.2},\"up_frames_driving\":{:.2},\"up_frames_parked\":{:.2},\"up_payload\":{:.0},\"up_ws\":{:.0},\"up_ip\":{:.0},\"held\":[{:.1},{:.1}],\"relay_events_ps\":{:.1},\"relay_forwarded_ps\":{:.1},\"relay_thinned_ps\":{:.1},\"by_type\":{:?}}}",
            pl.len(),
            g(mean(&down_f)), pct(&down_f, 0.5), pct(&down_f, 0.95), pct(&down_f, 1.0),
            g(mean(&down_b)), pct(&down_b, 0.5), pct(&down_b, 0.95), pct(&down_b, 1.0),
            mean(&ws), pct(&ws, 0.95),
            mean(&ip), pct(&ip, 0.95), mean(&ipn),
            mean(&pk),
            txf / s / n, mean(&sel(true)), mean(&sel(false)), txb / s / n, (txb + txf * WS_UP) / s / n, (txb + txf * (WS_UP + TLS + IPTCP)) / s / n,
            mean(&held), pct(&held, 0.95),
            self.events as f64 / s, self.forwarded as f64 / s, self.thinned as f64 / s,
            self.by_type,
        )
    }
}
