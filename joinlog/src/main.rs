// Palermo Drive play log: one endpoint, POST /e, that appends a small report to a BigQuery table. See README.md.
// It never returns data, never logs (no request, address or body is printed anywhere) and keeps no address: the rate limiter works on salted hashes that live in memory only.
mod bq;
mod report;

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderMap, Method, StatusCode},
    Router,
};
use std::{
    collections::{hash_map::RandomState, HashMap},
    hash::{BuildHasher, Hash, Hasher},
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

struct Cfg {
    origins: Vec<String>,
    daily_rows: u64,
    daily_reqs: u64,
}

struct Bucket {
    tokens: f64,
    last: Instant,
}

// a token bucket: `cap` at most, `rate` tokens a second
struct Gate {
    cap: f64,
    rate: f64,
}

impl Gate {
    fn take(&self, b: &mut Bucket, now: Instant) -> bool {
        b.tokens = (b.tokens + now.duration_since(b.last).as_secs_f64() * self.rate).min(self.cap);
        b.last = now;
        if b.tokens >= 1.0 {
            b.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

const MAX_KEYS: usize = 20_000;
const ADDR: Gate = Gate { cap: 6.0, rate: 0.1 }; // one address: a burst of 6, then one every 10 s (a player sends about one a 3 minutes); ADDR_BURST and ADDR_PER_MIN override it, for tests
const NET: Gate = Gate { cap: 30.0, rate: 0.5 }; // one /24 (IPv4) or /48 (IPv6) network: a school or an office
const WRITES: Gate = Gate { cap: 10.0, rate: 2.0 }; // everyone together: at most 2 table writes a second

struct Limits {
    addr_gate: Gate,
    salt: RandomState,
    addr: HashMap<u64, Bucket>,
    net: HashMap<u64, Bucket>,
    writes: Bucket,
    day: u64,
    reqs: u64,
}

impl Limits {
    fn new(addr_gate: Gate) -> Limits {
        Limits { addr_gate, salt: RandomState::new(), addr: HashMap::new(), net: HashMap::new(), writes: Bucket { tokens: WRITES.cap, last: Instant::now() }, day: 0, reqs: 0 }
    }

    fn key(&self, tag: u8, ip: &[u8]) -> u64 {
        let mut h = self.salt.build_hasher();
        tag.hash(&mut h);
        ip.hash(&mut h);
        h.finish()
    }

    fn allow(map: &mut HashMap<u64, Bucket>, gate: &Gate, key: u64, now: Instant) -> bool {
        if !map.contains_key(&key) && map.len() >= MAX_KEYS {
            map.retain(|_, b| now.duration_since(b.last) < Duration::from_secs(600));
            if map.len() >= MAX_KEYS {
                return false;
            }
        }
        let b = map.entry(key).or_insert(Bucket { tokens: gate.cap, last: now });
        gate.take(b, now)
    }

    // false: refuse. Order: the network, the address, the day's request count.
    fn admit(&mut self, ip: IpAddr, today: u64, daily_reqs: u64) -> bool {
        let now = Instant::now();
        if self.day != today {
            self.day = today;
            self.reqs = 0;
        }
        let (a, n) = match ip {
            IpAddr::V4(v) => (self.key(4, &v.octets()), self.key(5, &v.octets()[..3])),
            IpAddr::V6(v) => (self.key(6, &v.octets()), self.key(7, &v.octets()[..6])),
        };
        if !Self::allow(&mut self.net, &NET, n, now) || !Self::allow(&mut self.addr, &self.addr_gate, a, now) {
            return false;
        }
        self.reqs += 1;
        self.reqs <= daily_reqs
    }

    fn write_slot(&mut self) -> bool {
        WRITES.take(&mut self.writes, Instant::now())
    }
}

struct Day {
    day: u64,
    rows: u64,
    seeded: bool,
    retry: Option<Instant>,
}

struct App {
    cfg: Cfg,
    bq: bq::Bq,
    lim: Mutex<Limits>,
    day: tokio::sync::Mutex<Day>,
}

fn today() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() / 86_400).unwrap_or(0)
}

// Cloud Run's front end appends the connecting address to X-Forwarded-For, so the last entry is the one a client cannot forge. No header: the socket's own peer (local runs).
fn client_ip(h: &HeaderMap, peer: SocketAddr) -> IpAddr {
    let ip = h.get("x-forwarded-for").and_then(|v| v.to_str().ok()).and_then(|v| v.rsplit(',').next()).and_then(|s| s.trim().parse::<IpAddr>().ok()).unwrap_or(peer.ip());
    match ip {
        IpAddr::V6(v) => v.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(ip),
        _ => ip,
    }
}

async fn handle(State(app): State<Arc<App>>, ConnectInfo(peer): ConnectInfo<SocketAddr>, req: Request) -> StatusCode {
    if req.uri().path() != "/e" || req.method() != Method::POST {
        return StatusCode::NOT_FOUND;
    }
    let h = req.headers();
    match h.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        Some(o) if app.cfg.origins.iter().any(|a| a == o) => {}
        _ => return StatusCode::FORBIDDEN,
    }
    if let Some(n) = h.get(header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<usize>().ok()) {
        if n > report::MAX_BODY {
            return StatusCode::PAYLOAD_TOO_LARGE;
        }
    }
    let ip = client_ip(h, peer);
    if !app.lim.lock().unwrap().admit(ip, today(), app.cfg.daily_reqs) {
        return StatusCode::TOO_MANY_REQUESTS;
    }
    let body = match axum::body::to_bytes(req.into_body(), report::MAX_BODY).await {
        Ok(b) => b,
        Err(_) => return StatusCode::PAYLOAD_TOO_LARGE,
    };
    let Some(row) = report::parse(&body) else { return StatusCode::BAD_REQUEST };
    if !app.lim.lock().unwrap().write_slot() {
        return StatusCode::TOO_MANY_REQUESTS;
    }
    {
        // the day's row allowance: counted from the table itself when an instance starts, so a restart cannot reset it
        let mut d = app.day.lock().await;
        let t = today();
        if d.day != t {
            *d = Day { day: t, rows: 0, seeded: false, retry: None };
        }
        if !d.seeded {
            if d.retry.is_some_and(|r| Instant::now() < r) {
                return StatusCode::SERVICE_UNAVAILABLE;
            }
            match app.bq.count_today().await {
                Some(n) => {
                    d.rows = n;
                    d.seeded = true;
                }
                None => {
                    d.retry = Some(Instant::now() + Duration::from_secs(30));
                    return StatusCode::SERVICE_UNAVAILABLE;
                }
            }
        }
        if d.rows >= app.cfg.daily_rows {
            return StatusCode::TOO_MANY_REQUESTS;
        }
        d.rows += 1;
    }
    if app.bq.insert(&row).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}

fn env(k: &str) -> Option<String> {
    std::env::var(k).ok().filter(|v| !v.is_empty())
}

fn safe_name(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"_-.".contains(&b))
}

#[tokio::main]
async fn main() {
    let dev = env("JOINLOG_DEV_SINK");
    let project = env("PROJECT").unwrap_or_else(|| if dev.is_some() { "dev".into() } else { panic!("PROJECT") });
    let dataset = env("DATASET").unwrap_or_else(|| "joinlog".into());
    let table = env("TABLE").unwrap_or_else(|| "events".into());
    assert!(safe_name(&project) && safe_name(&dataset) && safe_name(&table));
    let cfg = Cfg {
        origins: env("ORIGINS").unwrap_or_else(|| "https://ebonura.github.io".into()).split(',').map(|s| s.trim().to_string()).collect(),
        daily_rows: env("DAILY_ROWS").and_then(|v| v.parse().ok()).unwrap_or(3000),
        daily_reqs: env("DAILY_REQS").and_then(|v| v.parse().ok()).unwrap_or(20_000),
    };
    let bq = bq::Bq::new(project, dataset, table, env("LOCATION").unwrap_or_else(|| "europe-west8".into()), dev);
    let app = Arc::new(App { cfg, bq, lim: Mutex::new(Limits::new(match (env("ADDR_BURST").and_then(|v| v.parse::<f64>().ok()), env("ADDR_PER_MIN").and_then(|v| v.parse::<f64>().ok())) {
        (Some(c), Some(r)) => Gate { cap: c, rate: r / 60.0 },
        _ => ADDR,
    })), day: tokio::sync::Mutex::new(Day { day: 0, rows: 0, seeded: false, retry: None }) });
    let router = Router::new().fallback(handle).with_state(app);
    let port: u16 = env("PORT").and_then(|v| v.parse().ok()).unwrap_or(8080);
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await.expect("bind");
    axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>()).await.expect("serve");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_burst_then_refill() {
        let mut l = Limits::new(ADDR);
        let ip: IpAddr = "203.0.113.7".parse().unwrap();
        let ok = (0..10).filter(|_| l.admit(ip, 1, 1_000_000)).count();
        assert_eq!(ok, 6);
    }

    #[test]
    fn network_limit_spans_addresses_in_a_24() {
        let mut l = Limits::new(ADDR);
        let ok = (1..=200u8).filter(|i| l.admit(format!("198.51.100.{i}").parse().unwrap(), 1, 1_000_000)).count();
        assert_eq!(ok, 30);
        assert!(l.admit("198.51.101.1".parse().unwrap(), 1, 1_000_000)); // another /24 is untouched
    }

    #[test]
    fn v6_groups_by_48() {
        let mut l = Limits::new(ADDR);
        let ok = (0..100u16).filter(|i| l.admit(format!("2001:db8:1:{i:x}::1").parse().unwrap(), 1, 1_000_000)).count();
        assert_eq!(ok, 30);
    }

    #[test]
    fn daily_request_cap_and_rollover() {
        let mut l = Limits::new(ADDR);
        let n = (1..=25u8).filter(|i| l.admit(format!("10.{i}.0.1").parse().unwrap(), 5, 20)).count();
        assert_eq!(n, 20);
        assert!(l.admit("10.99.0.1".parse().unwrap(), 6, 20)); // next day
    }

    #[test]
    fn forwarded_for_uses_the_last_entry() {
        let mut h = HeaderMap::new();
        h.insert("x-forwarded-for", "1.1.1.1, 2.2.2.2, 203.0.113.9".parse().unwrap());
        assert_eq!(client_ip(&h, "127.0.0.1:1".parse().unwrap()), "203.0.113.9".parse::<IpAddr>().unwrap());
        h.insert("x-forwarded-for", "garbage".parse().unwrap());
        assert_eq!(client_ip(&h, "127.0.0.1:1".parse().unwrap()), "127.0.0.1".parse::<IpAddr>().unwrap());
    }
}
