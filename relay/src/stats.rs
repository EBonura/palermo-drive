// Anonymous player analytics and the relay's own free-tier accounting.
//
// Clients send a tiny HTTP ping (POST /ping, text/plain, no preflight): "<random id>,<s|b|e>[,<active seconds>]".
// s = session start, b = beat (every ~3 minutes of active play), e = session end (sendBeacon on page hide).
// The random id never leaves the relay in readable form: only the first 6 bytes of its SHA-256 are kept, in a set per
// day and per month (for "unique players"). No IP address and no name is stored anywhere; IPs are only used in memory
// for a rate limit.
//
// Traffic accounting: every frame's size (payload, WebSocket header and a rough 40 byte TCP/IP share) is added to the month's
// outbound total, which is kept with the other statistics and so survives restarts. At the first limit (default 8000 GB) the
// relay stops accepting WebSockets and clients keep pinging and play single-player; at the second (default 9500 GB) it
// disconnects everybody and only answers the cheap stats pings, until the (UTC) month rolls over. Set both limits to what the
// connection or the plan allows.

use std::collections::{BTreeSet, HashMap};
use std::fmt::Write as _;
use std::sync::atomic::{AtomicI64, Ordering::Relaxed};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

use crate::store::Store;

const SESSION_TTL: f64 = 240.0; // a session with no ping for this long is no longer "online"
const MAX_SESSIONS: usize = 20000;
const MAX_SET_IDS: usize = 50000; // per day or month set; beyond this uniques stop growing (a Firestore document is limited to 1 MiB)
const MAX_BEAT_SECS: f64 = 200.0; // credit per beat; clients send one every ~180 s
const KEEP_DAYS: i64 = 120;
const KEEP_MONTHS: i64 = 36;
const MAX_IP_BUCKETS: usize = 50000;

/// A client address as a rate limit key: the IPv4 address, or the /64 of an IPv6 address (one device can use any address in its /64).
pub type IpKey = u128;

pub fn ip_key(ip: std::net::IpAddr) -> IpKey {
    match ip.to_canonical() {
        std::net::IpAddr::V4(a) => u32::from(a) as u128,
        std::net::IpAddr::V6(a) => 1u128 << 100 | (u128::from(a) >> 64),
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct Agg {
    #[serde(rename = "p")]
    players: i64,
    #[serde(rename = "s")]
    sessions: i64,
    #[serde(rename = "m")]
    minutes: f64,
    #[serde(rename = "o")]
    peak_online: i64,
    #[serde(rename = "c")]
    peak_conn: i64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct Usage {
    egress: i64,
    ws: i64,
    refused: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
struct Persisted {
    days: HashMap<String, Agg>,
    months: HashMap<String, Agg>,
    usage: HashMap<String, Usage>,
    total: Agg, // players = not tracked
    since: String,
}

struct Session {
    last: f64,
    mp: bool, // wants multiplayer (has a name and is not playing offline)
}

pub struct StatsCfg {
    pub key: String,
    pub refuse_bytes: i64, // stop accepting WebSockets at this month-to-date outbound traffic
    pub stop_bytes: i64,   // disconnect everybody at this one
}

struct Bucket {
    tokens: f64,
    t: f64,
}

type IdKey = [u8; 12];

struct Inner {
    p: Persisted,
    day_key: String,
    month_key: String,
    day_set: BTreeSet<IdKey>,
    month_set: BTreeSet<IdKey>,
    sessions: HashMap<IdKey, Session>,
    connected: i64,
    dirty: bool,
    day_dirty: bool,
    month_dirty: bool,
    last_flush: f64,
    last_log: String,
    ip_hits: HashMap<IpKey, Bucket>,
    ip_new: HashMap<IpKey, u32>,
    pending: HashMap<String, Vec<u8>>, // id sets of a finished day or month, written at the next flush
    level: u8, // 0 open, 1 refusing WebSockets, 2 stopped: a change is flushed at once
}

pub struct Stats {
    inner: Mutex<Inner>,
    store: Arc<dyn Store>,
    cfg: StatsCfg,
    // counted without the lock (every frame and request), folded into the month's usage once a second
    egress: AtomicI64,
}

/// One flush of changed blobs to the store, prepared under the lock and run without it.
pub struct FlushJob {
    blobs: Vec<(String, Vec<u8>)>,
    line: String,
}

pub struct TickOut {
    pub hard_stop: bool,
    pub flush: Option<FlushJob>,
}

// ---------- UTC dates without a date crate ----------

pub fn now_secs() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0)
}

fn civil(secs: f64) -> (i64, i64, i64) {
    let z = (secs / 86400.0).floor() as i64 + 719468; // days since 0000-03-01
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + (m <= 2) as i64, m, d)
}

pub fn day_key(secs: f64) -> String {
    let (y, m, d) = civil(secs);
    format!("{y:04}-{m:02}-{d:02}")
}

pub fn month_key(secs: f64) -> String {
    let (y, m, _) = civil(secs);
    format!("{y:04}-{m:02}")
}

fn month_key_back(secs: f64, months: i64) -> String {
    let (y, m, _) = civil(secs);
    let i = y * 12 + (m - 1) - months;
    format!("{:04}-{:02}", i.div_euclid(12), i.rem_euclid(12) + 1)
}

// ---------- helpers ----------

fn id_key(id: &str) -> IdKey {
    let h = Sha256::digest(id.as_bytes());
    let mut k = [0u8; 12];
    for (i, b) in h[..6].iter().enumerate() {
        k[2 * i] = b"0123456789abcdef"[(b >> 4) as usize];
        k[2 * i + 1] = b"0123456789abcdef"[(b & 15) as usize];
    }
    k
}

fn valid_id(id: &str) -> bool {
    (16..=40).contains(&id.len()) && id.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

fn encode_set(s: &BTreeSet<IdKey>) -> Vec<u8> {
    let mut v = Vec::with_capacity(s.len() * 12);
    for k in s {
        v.extend_from_slice(k);
    }
    v
}

fn decode_set(b: &[u8]) -> BTreeSet<IdKey> {
    b.chunks_exact(12).map(|c| c.try_into().unwrap()).collect()
}

fn round3(f: f64) -> f64 {
    (f * 1000.0 + 0.5).floor() / 1000.0
}

fn round1(f: f64) -> f64 {
    ((f * 10.0 + 0.5) as i64) as f64 / 10.0
}

fn agg<'a>(m: &'a mut HashMap<String, Agg>, k: &str) -> &'a mut Agg {
    m.entry(k.to_string()).or_default()
}

impl Inner {
    fn usage(&mut self) -> &mut Usage {
        self.p.usage.entry(self.month_key.clone()).or_default()
    }

    /// Switches to a new day or month; the finished sets are queued for the next flush.
    fn rollover(&mut self, now: f64) {
        let d = day_key(now);
        if d == self.day_key {
            return;
        }
        self.pending.insert(format!("ids-d-{}", self.day_key), encode_set(&self.day_set));
        self.day_key = d;
        self.day_set.clear();
        self.ip_new.clear();
        self.dirty = true;
        let m = month_key(now);
        if m != self.month_key {
            self.pending.insert(format!("ids-m-{}", self.month_key), encode_set(&self.month_set));
            self.month_key = m;
            self.month_set.clear();
        }
        let cut = day_key(now - KEEP_DAYS as f64 * 86400.0);
        self.p.days.retain(|k, _| *k >= cut);
        let cut_m = month_key_back(now, KEEP_MONTHS);
        self.p.months.retain(|k, _| *k >= cut_m);
        self.p.usage.retain(|k, _| *k >= cut_m);
    }

    fn online(&self, now: f64) -> i64 {
        self.sessions.values().filter(|x| now - x.last < SESSION_TTL).count() as i64
    }

    /// Sessions that would join the relay: multiplayer is only worth an open WebSocket when two or more of them overlap.
    fn online_mp(&self, now: f64) -> i64 {
        self.sessions.values().filter(|x| x.mp && now - x.last < SESSION_TTL).count() as i64
    }

    fn bump_peaks(&mut self, now: f64) {
        let o = self.online(now);
        let (dk, mk) = (self.day_key.clone(), self.month_key.clone());
        let mut hit = false;
        for a in [agg(&mut self.p.days, &dk), agg(&mut self.p.months, &mk), &mut self.p.total] {
            if o > a.peak_online {
                a.peak_online = o;
                hit = true;
            }
        }
        self.dirty |= hit;
    }
}

impl Stats {
    pub fn new(store: Arc<dyn Store>, cfg: StatsCfg) -> Self {
        let now = now_secs();
        let mut p = Persisted { since: day_key(now), ..Default::default() };
        match store.get("state") {
            Err(e) => eprintln!("stats: load failed: {e} (starting empty)"),
            Ok(Some(b)) => {
                if let Ok(x) = serde_json::from_slice::<Persisted>(&b) {
                    p = x;
                }
            }
            Ok(None) => {}
        }
        let (dk, mk) = (day_key(now), month_key(now));
        let load = |name: String| match store.get(&name) {
            Ok(Some(b)) => decode_set(&b),
            Ok(None) => BTreeSet::new(),
            Err(e) => {
                eprintln!("stats: load {name}: {e}");
                BTreeSet::new()
            }
        };
        let (day_set, month_set) = (load(format!("ids-d-{dk}")), load(format!("ids-m-{mk}")));
        let inner = Inner {
            p,
            day_key: dk,
            month_key: mk,
            day_set,
            month_set,
            sessions: HashMap::new(),
            connected: 0,
            dirty: true,
            day_dirty: false,
            month_dirty: false,
            last_flush: now,
            last_log: String::new(),
            ip_hits: HashMap::new(),
            ip_new: HashMap::new(),
            pending: HashMap::new(),
            level: 0,
        };
        Stats { inner: Mutex::new(inner), store, cfg, egress: AtomicI64::new(0) }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    // ---------- pings ----------

    /// Records one client ping. Returns the number of multiplayer-willing sessions online, or -1 when rejected.
    pub fn ping(&self, ip: IpKey, id: &str, ev: &str, secs: f64, wants_mp: bool) -> i64 {
        if !valid_id(id) {
            return -1;
        }
        let now = now_secs();
        let k = id_key(id);
        let mut g = self.lock();
        let s = &mut *g;
        s.rollover(now);
        // per IP: 30 pings per minute and at most 40 new ids per day (in memory only)
        if !s.ip_hits.contains_key(&ip) && s.ip_hits.len() > MAX_IP_BUCKETS {
            return -1;
        }
        let b = s.ip_hits.entry(ip).or_insert(Bucket { tokens: 30.0, t: now });
        b.tokens = (b.tokens + (now - b.t) * 0.5).min(30.0);
        b.t = now;
        if b.tokens < 1.0 {
            return -1;
        }
        b.tokens -= 1.0;

        let (dk, mk) = (s.day_key.clone(), s.month_key.clone());
        // the live session of this id, as its last ping time
        let mut ss: Option<f64> = s.sessions.get(&k).filter(|x| now - x.last <= SESSION_TTL).map(|x| x.last);

        let start_session = |s: &mut Inner, ss: &mut Option<f64>| {
            if s.sessions.len() >= MAX_SESSIONS {
                return;
            }
            s.sessions.insert(k, Session { last: now, mp: false });
            *ss = Some(now);
            agg(&mut s.p.days, &dk).sessions += 1;
            agg(&mut s.p.months, &mk).sessions += 1;
            s.p.total.sessions += 1;
            if !s.day_set.contains(&k) && s.day_set.len() < MAX_SET_IDS {
                if s.ip_new.get(&ip).copied().unwrap_or(0) >= 40 {
                    return;
                }
                *s.ip_new.entry(ip).or_insert(0) += 1;
                s.day_set.insert(k);
                agg(&mut s.p.days, &dk).players = s.day_set.len() as i64;
                s.day_dirty = true;
            }
            if !s.month_set.contains(&k) && s.month_set.len() < MAX_SET_IDS {
                s.month_set.insert(k);
                agg(&mut s.p.months, &mk).players = s.month_set.len() as i64;
                s.month_dirty = true;
            }
            s.dirty = true;
        };
        let credit = |s: &mut Inner, ss: Option<f64>| {
            let mut secs = secs;
            if secs <= 0.0 {
                return;
            }
            secs = secs.min(MAX_BEAT_SECS);
            if let Some(last) = ss {
                // never credit more than the wall time since the last ping (plus slack)
                secs = secs.min(now - last + 20.0);
            }
            let m = secs / 60.0;
            agg(&mut s.p.days, &dk).minutes += m;
            agg(&mut s.p.months, &mk).minutes += m;
            s.p.total.minutes += m;
            s.dirty = true;
        };
        match ev {
            "s" => {
                if ss.is_none_or(|l| now - l > 60.0) {
                    // a quick reload is the same session
                    start_session(s, &mut ss);
                }
            }
            "b" => {
                if ss.is_none() {
                    start_session(s, &mut ss);
                }
                credit(s, ss);
            }
            "e" => {
                credit(s, ss);
                s.sessions.remove(&k);
                s.dirty = true;
                return s.online_mp(now);
            }
            _ => return -1,
        }
        if ss.is_some() {
            if let Some(x) = s.sessions.get_mut(&k) {
                x.last = now;
                x.mp = wants_mp;
            }
        }
        s.bump_peaks(now);
        s.online_mp(now)
    }

    // ---------- usage accounting and caps ----------

    pub fn add_egress(&self, n: usize) {
        self.egress.fetch_add(n as i64, Relaxed);
    }

    pub fn ws_open(&self) {
        let mut g = self.lock();
        g.connected += 1;
        g.usage().ws += 1;
        let c = g.connected;
        let (dk, mk) = (g.day_key.clone(), g.month_key.clone());
        let s = &mut *g;
        for a in [agg(&mut s.p.days, &dk), agg(&mut s.p.months, &mk), &mut s.p.total] {
            a.peak_conn = a.peak_conn.max(c);
        }
        s.dirty = true;
    }

    pub fn ws_close(&self) {
        let mut g = self.lock();
        if g.connected > 0 {
            g.connected -= 1;
        }
    }

    /// The month's outbound traffic including what has been counted but not yet folded in.
    fn sent_now(&self, g: &mut Inner) -> i64 {
        g.usage().egress + self.egress.load(Relaxed)
    }

    /// Whether new WebSocket connections are accepted (false: the first limit is reached, clients fall back to single player).
    pub fn allow_ws(&self) -> bool {
        let mut g = self.lock();
        let ok = self.sent_now(&mut g) < self.cfg.refuse_bytes;
        if !ok {
            g.usage().refused += 1;
            g.dirty = true;
        }
        ok
    }

    pub fn mp_available(&self) -> bool {
        let mut g = self.lock();
        self.sent_now(&mut g) < self.cfg.refuse_bytes
    }

    /// Runs once a second: folds the traffic count in, rolls the day over, prepares a flush at most once a minute.
    /// hard_stop is true when the hard limit is reached and every connection must be closed.
    pub fn tick(&self) -> TickOut {
        let now = now_secs();
        let mut g = self.lock();
        g.rollover(now);
        let e = self.egress.swap(0, Relaxed);
        let connected = g.connected;
        g.usage().egress += e;
        if e > 0 {
            g.dirty = true;
        }
        if (now as i64).rem_euclid(60) == 0 || now - g.last_flush >= 60.0 {
            g.sessions.retain(|_, x| now - x.last <= SESSION_TTL);
            g.ip_hits.retain(|_, b| now - b.t <= 300.0);
        }
        let sent = g.usage().egress;
        let level = if sent >= self.cfg.stop_bytes { 2 } else if sent >= self.cfg.refuse_bytes { 1 } else { 0 };
        let crossed = level > g.level; // write the counters at once, so a restart cannot forget that a limit was reached
        if level != g.level {
            println!("month's traffic {:.1} GB: {}", sent as f64 / 1e9, ["under the limits, WebSockets open", "first limit reached, new WebSockets refused", "second limit reached, WebSockets closed"][level as usize]);
        }
        g.level = level;
        if crossed {
            g.dirty = true;
        }
        let flush = if crossed || now - g.last_flush >= 60.0 { self.prepare_flush(&mut g, now) } else { None };
        TickOut { hard_stop: connected > 0 && level == 2, flush }
    }

    fn prepare_flush(&self, g: &mut Inner, now: f64) -> Option<FlushJob> {
        g.last_flush = now;
        if !g.dirty && !g.day_dirty && !g.month_dirty && g.pending.is_empty() {
            return None;
        }
        let mut blobs: Vec<(String, Vec<u8>)> = std::mem::take(&mut g.pending).into_iter().collect();
        if g.dirty {
            blobs.push(("state".into(), serde_json::to_vec(&g.p).unwrap_or_default()));
        }
        if g.day_dirty {
            blobs.push((format!("ids-d-{}", g.day_key), encode_set(&g.day_set)));
        }
        if g.month_dirty {
            blobs.push((format!("ids-m-{}", g.month_key), encode_set(&g.month_set)));
        }
        let u = g.usage().clone();
        let line = format!("traffic this month {:.2} GB sent, {} WebSockets opened, online={} conns={}", u.egress as f64 / 1e9, u.ws, g.online(now), g.connected);
        g.dirty = false;
        g.day_dirty = false;
        g.month_dirty = false;
        Some(FlushJob { blobs, line })
    }

    /// Writes a prepared flush (blocking: call it on a blocking thread) and records the outcome.
    pub fn run_flush(&self, job: FlushJob) {
        let mut failed = Vec::new();
        for (n, b) in &job.blobs {
            if let Err(e) = self.store.put(n, b) {
                eprintln!("stats: save {n} failed: {e}");
                failed.push((n.clone(), b.clone()));
            }
        }
        let mut g = self.lock();
        if !failed.is_empty() {
            g.dirty = true;
            g.day_dirty = true;
            g.month_dirty = true;
            let (dn, mn) = (format!("ids-d-{}", g.day_key), format!("ids-m-{}", g.month_key));
            for (n, b) in failed {
                if n.starts_with("ids-") && n != dn && n != mn {
                    g.pending.entry(n).or_insert(b);
                }
            }
        }
        if job.line != g.last_log {
            // at most one summary line a minute, and none when nothing changed
            g.last_log = job.line.clone();
            println!("{}", job.line);
        }
    }

    /// Called on shutdown (blocking).
    pub fn flush(&self) {
        let job = {
            let mut g = self.lock();
            g.dirty = true;
            self.prepare_flush(&mut g, now_secs())
        };
        if let Some(j) = job {
            self.run_flush(j);
        }
    }

    // ---------- reports ----------

    pub fn snapshot(&self) -> Value {
        let now = now_secs();
        let mut g = self.lock();
        g.rollover(now);
        let online = g.online(now);
        let connected = g.connected;
        let sent = self.sent_now(&mut g);
        let u = g.usage().clone();
        let (dk, mk) = (g.day_key.clone(), g.month_key.clone());
        let today = row(&dk, &agg(&mut g.p.days, &dk).clone());
        let month = row(&mk, &agg(&mut g.p.months, &mk).clone());
        let mut all = row(&format!("all time (since {})", g.p.since), &g.p.total);
        all.remove("uniquePlayers");
        all.remove("avgMinutesPerPlayer");
        let mut days: Vec<&String> = g.p.days.keys().collect();
        days.sort_by(|a, b| b.cmp(a));
        let days: Vec<Value> = days.into_iter().take(45).map(|k| Value::Object(row(k, &g.p.days[k]))).collect();
        let mut months: Vec<&String> = g.p.months.keys().collect();
        months.sort_by(|a, b| b.cmp(a));
        let months: Vec<Value> = months.into_iter().map(|k| Value::Object(row(k, &g.p.months[k]))).collect();
        json!({
            "now": {"onlinePlayers": online, "multiplayerConnections": connected},
            "today": today, "month": month, "allTime": all,
            "traffic": {
                "month": mk, "sentGB": round3(sent as f64 / 1e9), "refuseNewWebSocketsAtGB": self.cfg.refuse_bytes as f64 / 1e9, "closeEverythingAtGB": self.cfg.stop_bytes as f64 / 1e9,
                "multiplayerOpen": sent < self.cfg.refuse_bytes, "websocketsOpened": u.ws, "websocketsRefused": u.refused,
            },
            "days": days, "months": months,
        })
    }

    pub fn key_matches(&self, k: &str) -> bool {
        let (a, b) = (self.cfg.key.as_bytes(), k.as_bytes());
        !a.is_empty() && a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
    }
}

fn row(k: &str, a: &Agg) -> Map<String, Value> {
    let avg_s = if a.sessions > 0 { a.minutes / a.sessions as f64 } else { 0.0 };
    let avg_p = if a.players > 0 { a.minutes / a.players as f64 } else { 0.0 };
    let Value::Object(m) = json!({"period": k, "uniquePlayers": a.players, "sessions": a.sessions, "playMinutes": round1(a.minutes),
        "avgMinutesPerSession": round1(avg_s), "avgMinutesPerPlayer": round1(avg_p), "peakOnline": a.peak_online, "peakMultiplayer": a.peak_conn})
    else {
        unreachable!()
    };
    m
}

// ---------- HTML ----------

fn esc(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => o.push_str("&amp;"),
            '<' => o.push_str("&lt;"),
            '>' => o.push_str("&gt;"),
            '"' => o.push_str("&#34;"),
            '\'' => o.push_str("&#39;"),
            c => o.push(c),
        }
    }
    o
}

/// A value the way Go's %v prints it: strings bare, whole numbers without a decimal point.
fn v(x: &Value) -> String {
    match x {
        Value::String(s) => s.clone(),
        Value::Number(n) => match n.as_f64() {
            Some(f) if f.fract() == 0.0 && f.abs() < 1e15 => format!("{}", f as i64),
            _ => n.to_string(),
        },
        o => o.to_string(),
    }
}

pub fn render_html(o: &Value) -> String {
    let mut b = String::with_capacity(8192);
    b.push_str(
        r#"<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>Palermo Drive stats</title>
<style>body{font:15px/1.4 system-ui,sans-serif;background:#0d0709;color:#fff;margin:0;padding:16px;max-width:900px}h1{color:#ff6fae;margin:0 0 12px}h2{color:#ff6fae;font-size:15px;margin:22px 0 6px}
.k{display:flex;flex-wrap:wrap;gap:10px}.c{background:#1b1115;border:1.5px solid #e8559a;border-radius:10px;padding:10px 14px;min-width:120px}.c b{display:block;font-size:26px}.c span{opacity:.7;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:4px 8px;border-bottom:1px solid #3a2a31;text-align:right}th:first-child,td:first-child{text-align:left}th{color:#ff6fae}</style><h1>Palermo Drive</h1>"#,
    );
    let card = |b: &mut String, val: String, l: &str| {
        let _ = write!(b, "<div class=c><b>{}</b><span>{}</span></div>", val, esc(l));
    };
    let (now, today, month, usage) = (&o["now"], &o["today"], &o["month"], &o["traffic"]);
    b.push_str("<div class=k>");
    card(&mut b, v(&now["onlinePlayers"]), "playing now (ping in the last 4 min)");
    card(&mut b, v(&now["multiplayerConnections"]), "in multiplayer now");
    card(&mut b, v(&today["uniquePlayers"]), "players today");
    card(&mut b, v(&month["uniquePlayers"]), "players this month");
    card(&mut b, v(&month["sessions"]), "sessions this month");
    card(&mut b, v(&month["playMinutes"]), "play minutes this month");
    card(&mut b, v(&month["avgMinutesPerSession"]), "avg min / session (month)");
    card(&mut b, v(&month["peakOnline"]), "peak online (month)");
    b.push_str("</div><h2>Outbound traffic this month</h2><div class=k>");
    card(&mut b, format!("{} GB", v(&usage["sentGB"])), &format!("sent (limits {} and {} GB)", v(&usage["refuseNewWebSocketsAtGB"]), v(&usage["closeEverythingAtGB"])));
    card(&mut b, v(&usage["websocketsOpened"]), "WebSockets opened");
    card(&mut b, v(&usage["websocketsRefused"]), "WebSockets refused");
    card(&mut b, v(&usage["multiplayerOpen"]), "multiplayer open");
    b.push_str("</div>");
    let table = |b: &mut String, title: &str, rows: &Value| {
        let _ = write!(b, "<h2>{}</h2><table><tr><th></th><th>players</th><th>sessions</th><th>minutes</th><th>min/session</th><th>min/player</th><th>peak online</th><th>peak mp</th></tr>", esc(title));
        for r in rows.as_array().into_iter().flatten() {
            let _ = write!(
                b,
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                esc(&v(&r["period"])), v(&r["uniquePlayers"]), v(&r["sessions"]), v(&r["playMinutes"]), v(&r["avgMinutesPerSession"]),
                v(&r["avgMinutesPerPlayer"]), v(&r["peakOnline"]), v(&r["peakMultiplayer"])
            );
        }
        b.push_str("</table>");
    };
    table(&mut b, "Months", &o["months"]);
    table(&mut b, "Days (UTC)", &o["days"]);
    let a = &o["allTime"];
    let _ = write!(
        b,
        "<h2>All time</h2><p>{} sessions, {} play minutes, {} min/session, peak online {}</p>",
        v(&a["sessions"]), v(&a["playMinutes"]), v(&a["avgMinutesPerSession"]), v(&a["peakOnline"])
    );
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates() {
        assert_eq!(day_key(0.0), "1970-01-01");
        assert_eq!(day_key(1_793_577_600.0), "2026-11-02");
        assert_eq!(month_key(1_793_577_600.0), "2026-11");
        assert_eq!(month_key_back(1_793_577_600.0, 36), "2023-11");
        assert_eq!(month_key_back(1_793_577_600.0, 10), "2026-01");
        assert_eq!(day_key(1_709_164_800.0), "2024-02-29");
    }

    #[test]
    fn ids() {
        assert!(valid_id("0123456789abcdef") && !valid_id("0123456789abcdeF") && !valid_id("short"));
        assert_eq!(&id_key("0123456789abcdef")[..], &id_key("0123456789abcdef")[..]);
    }

    fn test_stats(refuse_gb: f64, stop_gb: f64, store: Arc<dyn Store>) -> Stats {
        Stats::new(store, StatsCfg { key: "k".into(), refuse_bytes: (refuse_gb * 1e9) as i64, stop_bytes: (stop_gb * 1e9) as i64 })
    }

    #[test]
    fn the_limits_close_the_door_and_stay_closed() {
        let store: Arc<dyn Store> = Arc::new(crate::store::MemStore::default());
        let s = test_stats(1.0, 2.0, store.clone());
        assert!(s.allow_ws() && s.mp_available());
        s.add_egress(1_100_000_000);
        assert!(!s.allow_ws() && !s.mp_available());
        let t = s.tick();
        assert!(!t.hard_stop, "nobody connected, nothing to close");
        assert!(t.flush.is_some(), "crossing a limit is written at once");
        s.ws_open();
        s.add_egress(1_000_000_000);
        assert!(s.tick().hard_stop);
        s.flush();
        // a restart reads the traffic back and is still over the limit
        let s2 = test_stats(1.0, 2.0, store);
        assert!(!s2.allow_ws());
    }
}
