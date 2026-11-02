// Palermo Drive relay: a tiny in-memory WebSocket fan-out. No database for the game, one process.
// Run a single instance (Cloud Run max-instances=1) so every player shares the same state. See protocol.rs.
mod hub;
mod metrics;
mod protocol;
mod serve;
mod stats;
mod store;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ConnectInfo;
use hyper_util::rt::{TokioIo, TokioTimer};
use tower_service::Service;

use hub::{Cfg, Hub, CLOSE_CAP, CLOSE_GOING_AWAY};
use stats::{Stats, StatsCfg};
use store::{FileStore, Store};

const HELP: &str = "palermo-drive relay

  -addr 127.0.0.1:8080   listen address (a bare :8080 listens on every interface); env PORT sets the port
  -data data             directory for the statistics and the month's traffic (made if missing); copy it to back it up
  -radius 400            interest radius in metres
  -tick 100ms            server send interval
  -bands 150,80,200      metres: full entries within the first, updates every 2nd tick beyond the second, every 4th beyond the third
  -max-conns 300         total connection cap
  -per-ip 16             connections per client IP (IPv6: per /64)
  -trust-header NAME     read the client address from this request header (CF-Connecting-IP behind a Cloudflare tunnel);
                         without it the address of the socket is used, which behind a tunnel is the tunnel for everybody
  -idle-timeout 45s      close a connection that sends nothing for this long
  -afk-timeout 3m        close a connection that sends no position for this long
  -max-session 0         close sessions after this long (0 = never; clients reconnect straight away)
  -origins a,b           allowed Origin hosts (patterns), env ALLOWED_ORIGINS
  -filter=false          switch the small name block list off, env NAME_FILTER=off
  -stats-key SECRET      secret for GET /stats?key=... (empty disables /stats), env STATS_KEY
  -traffic-refuse-gb 8000  stop accepting WebSockets at this much outbound traffic in a month (decimal GB), env TRAFFIC_REFUSE_GB
  -traffic-stop-gb 9500    disconnect everybody at this much, env TRAFFIC_STOP_GB
  -threads 1             runtime threads (1 = single threaded)
  -metrics-secs 0        with --features metrics: print tick timing every N seconds (and at exit)
";

fn env(k: &str, d: &str) -> String {
    std::env::var(k).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| d.to_string())
}

fn envf(k: &str, d: f64) -> f64 {
    std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d)
}

/// Go style flags: -name value, -name=value, --name value. Bool flags are bare (-vm) or -name=false.
fn parse_args() -> HashMap<String, String> {
    const BOOLS: [&str; 2] = ["filter", "help"];
    let mut m = HashMap::new();
    let mut it = std::env::args().skip(1).peekable();
    while let Some(a) = it.next() {
        let a = a.trim_start_matches('-').to_string();
        if let Some((k, v)) = a.split_once('=') {
            m.insert(k.to_string(), v.to_string());
        } else if BOOLS.contains(&a.as_str()) {
            m.insert(a, "true".into());
        } else if let Some(v) = it.next() {
            m.insert(a, v);
        } else {
            die(&format!("flag -{a} needs a value"));
        }
    }
    m
}

fn die(msg: &str) -> ! {
    eprintln!("{msg}");
    std::process::exit(2)
}

/// "45s", "3m", "100ms", "1h30m".
fn duration(s: &str) -> Duration {
    let (mut total, mut num) = (0.0f64, String::new());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c.is_ascii_digit() || c == '.' {
            num.push(c);
            continue;
        }
        let mut unit = c.to_string();
        while chars.peek().is_some_and(|c| c.is_ascii_alphabetic()) {
            unit.push(chars.next().unwrap());
        }
        let n: f64 = num.parse().unwrap_or_else(|_| die(&format!("bad duration {s}")));
        num.clear();
        total += n * match unit.as_str() {
            "ms" => 0.001,
            "s" => 1.0,
            "m" => 60.0,
            "h" => 3600.0,
            _ => die(&format!("bad duration {s}")),
        };
    }
    if !num.is_empty() {
        die(&format!("bad duration {s} (needs a unit)"));
    }
    Duration::from_secs_f64(total)
}

fn main() {
    let mut a = parse_args();
    if a.contains_key("help") || a.contains_key("h") {
        print!("{HELP}");
        return;
    }
    let mut get = |k: &str, d: String| a.remove(k).unwrap_or(d);
    let port = env("PORT", "8080");
    let addr = get("addr", format!("127.0.0.1:{port}"));
    let addr: SocketAddr = match addr.strip_prefix(':') {
        Some(p) => format!("0.0.0.0:{p}"),
        None => addr,
    }
    .parse()
    .unwrap_or_else(|_| die("bad -addr"));
    let num = |s: String, name: &str| s.parse::<f64>().unwrap_or_else(|_| die(&format!("bad -{name}")));
    let cfg = Cfg {
        radius: num(get("radius", "400".into()), "radius") as f32,
        tick: duration(&get("tick", "100ms".into())),
        max_conns: num(get("max-conns", "300".into()), "max-conns") as usize,
        per_ip: num(get("per-ip", "16".into()), "per-ip") as usize,
        idle_timeout: duration(&get("idle-timeout", "45s".into())),
        afk_timeout: duration(&get("afk-timeout", "3m".into())),
        max_session: duration(&get("max-session", "0s".into())),
        trust_header: Some(get("trust-header", env("TRUST_HEADER", ""))).filter(|h| !h.is_empty()),
        filter: get("filter", (env("NAME_FILTER", "on") != "off").to_string()) != "false",
        bands: {
            let b: Vec<f32> = get("bands", "150,80,200".into()).split(',').map(|x| x.trim().parse().unwrap_or_else(|_| die("bad -bands"))).collect();
            if b.len() != 3 || b[1] > b[2] {
                die("-bands needs three numbers, the second not above the third");
            }
            [b[0], b[1], b[2]]
        },
        origins: get("origins", env("ALLOWED_ORIGINS", "ebonura.github.io,localhost:*,127.0.0.1:*")).split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
    };
    let data_dir = get("data", env("DATA_DIR", "data"));
    let sc = StatsCfg {
        key: get("stats-key", env("STATS_KEY", "")),
        refuse_bytes: (num(get("traffic-refuse-gb", envf("TRAFFIC_REFUSE_GB", 8000.0).to_string()), "traffic-refuse-gb") * 1e9) as i64,
        stop_bytes: (num(get("traffic-stop-gb", envf("TRAFFIC_STOP_GB", 9500.0).to_string()), "traffic-stop-gb") * 1e9) as i64,
    };
    let threads = num(get("threads", "1".into()), "threads") as usize;
    let metrics_secs = num(get("metrics-secs", "0".into()), "metrics-secs") as u64;
    if !(sc.refuse_bytes > 0 && sc.refuse_bytes < sc.stop_bytes) {
        die("-traffic-refuse-gb must be above 0 and below -traffic-stop-gb");
    }
    if let Some(k) = a.keys().next() {
        die(&format!("unknown flag -{k}\n\n{HELP}"));
    }

    let mut rt = if threads <= 1 { tokio::runtime::Builder::new_current_thread() } else { tokio::runtime::Builder::new_multi_thread() };
    if threads > 1 {
        rt.worker_threads(threads);
    }
    rt.max_blocking_threads(2).enable_all().build().expect("runtime").block_on(run(cfg, sc, addr, data_dir, threads, metrics_secs));
}

async fn run(cfg: Cfg, sc: StatsCfg, addr: SocketAddr, data_dir: String, threads: usize, metrics_secs: u64) {
    let store: Arc<dyn Store> = Arc::new(FileStore(data_dir.into()));
    let tick = cfg.tick;
    let (radius, tick_s) = (cfg.radius, format!("{tick:?}"));
    let st = {
        let store = store.clone();
        tokio::task::spawn_blocking(move || Arc::new(Stats::new(store, sc))).await.expect("stats")
    };
    let hub = Hub::new(cfg);
    let max_sockets = hub.cfg.max_conns * 2 + 256; // WebSockets, plus pings and stats requests in flight
    let app = serve::router(serve::App { hub: hub.clone(), st: st.clone() });

    {
        let hub = hub.clone();
        tokio::spawn(async move {
            let mut t = tokio::time::interval(tick);
            t.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            let mut n = 0u32;
            loop {
                t.tick().await;
                n = n.wrapping_add(1);
                hub.tick(Instant::now(), n);
            }
        });
    }
    {
        // usage accounting, stats flush (at most once a minute) and the hard usage cap
        let (hub, st) = (hub.clone(), st.clone());
        tokio::spawn(async move {
            let mut t = tokio::time::interval(Duration::from_secs(1));
            t.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                t.tick().await;
                let out = st.tick();
                if out.hard_stop {
                    hub.close_all(CLOSE_CAP, "cap");
                }
                if let Some(job) = out.flush {
                    let st = st.clone();
                    let _ = tokio::task::spawn_blocking(move || st.run_flush(job)).await;
                }
            }
        });
    }
    if metrics_secs > 0 {
        tokio::spawn(async move {
            let mut t = tokio::time::interval(Duration::from_secs(metrics_secs));
            t.tick().await;
            loop {
                t.tick().await;
                metrics::report(false);
            }
        });
    }

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap_or_else(|e| die(&format!("listen {addr}: {e}")));
    println!("palermo-drive relay listening on {addr} (radius {radius:.0} m, tick {tick_s}, {} thread{})", threads.max(1), if threads > 1 { "s" } else { "" });

    // Our own accept loop instead of axum::serve: it gives every connection a header read timeout (a client that dribbles a
    // request is cut after 10 s), and a cap on open sockets.
    let sockets = Arc::new(tokio::sync::Semaphore::new(max_sockets));
    let stop = async {
        wait_for_signal().await;
        println!("shutting down");
    };
    tokio::pin!(stop);
    loop {
        let permit = tokio::select! {
            p = sockets.clone().acquire_owned() => p.expect("semaphore"),
            _ = &mut stop => break,
        };
        let (tcp, peer) = tokio::select! {
            a = listener.accept() => match a { Ok(x) => x, Err(e) => { eprintln!("accept: {e}"); tokio::time::sleep(Duration::from_millis(50)).await; continue } },
            _ = &mut stop => break,
        };
        let _ = tcp.set_nodelay(true);
        let router = app.clone();
        tokio::spawn(async move {
            let svc = hyper::service::service_fn(move |mut req: hyper::Request<hyper::body::Incoming>| {
                req.extensions_mut().insert(ConnectInfo(peer));
                let mut r = router.clone();
                async move { r.call(req).await }
            });
            let conn = hyper::server::conn::http1::Builder::new()
                .timer(TokioTimer::new())
                .header_read_timeout(Duration::from_secs(10))
                .serve_connection(TokioIo::new(tcp), svc)
                .with_upgrades();
            let _ = conn.await;
            drop(permit);
        });
    }
    hub.close_all(CLOSE_GOING_AWAY, "restart");
    let until = Instant::now() + Duration::from_secs(2);
    while hub.connections() > 0 && Instant::now() < until {
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let _ = tokio::task::spawn_blocking(move || st.flush()).await;
    metrics::report(true);
}

async fn wait_for_signal() {
    use tokio::signal::unix::{signal, SignalKind};
    let mut term = signal(SignalKind::terminate()).expect("SIGTERM handler");
    let mut int = signal(SignalKind::interrupt()).expect("SIGINT handler");
    tokio::select! { _ = term.recv() => {}, _ = int.recv() => {} }
}
