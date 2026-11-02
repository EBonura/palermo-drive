// Load test for the relay: N simulated drivers wander around a square of the given size and send
// STATE at 10 Hz. Reports payload bytes per player-minute in each direction (WebSocket headers included,
// TCP/TLS excluded) and how many other players each client saw on average.
//
//	cargo run --release --features loadtest --bin loadtest -- -url ws://localhost:8791/ws -n 32 -side 1000 -dur 30s
//
// Extra stress modes (-mode): churn (every client leaves and rejoins every 1 to 4 s), storm (everybody drops and
// reconnects at once, three times), stall (-k clients connect and never read), abuse (malformed, oversized and flood
// messages, see abuse() for the list; start the relay with -idle-timeout 6s -afk-timeout 14s).
#[path = "../protocol.rs"]
#[allow(dead_code)]
mod protocol;

use std::sync::atomic::{AtomicI64, Ordering::Relaxed};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

#[derive(Default)]
struct Counters {
    rx: AtomicI64,
    tx: AtomicI64,
    rx_msgs: AtomicI64,
    tx_msgs: AtomicI64,
    vis_sum: AtomicI64,
    vis_n: AtomicI64,
    ok: AtomicI64,
    dial_fail: AtomicI64,
    sessions: AtomicI64,
    connect_ms_max: AtomicI64,
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
}

fn duration(s: &str) -> Duration {
    let (n, u) = s.split_at(s.find(|c: char| c.is_ascii_alphabetic()).unwrap_or(s.len()));
    let n: f64 = n.parse().expect("bad duration");
    Duration::from_secs_f64(n * match u { "ms" => 0.001, "s" | "" => 1.0, "m" => 60.0, "h" => 3600.0, _ => panic!("bad duration") })
}

#[derive(Clone)]
struct Opts {
    url: String,
    side: f64,
    rooms: usize,
}

type Ws = tokio_tungstenite::WebSocketStream<TcpStream>;

/// Opens a WebSocket (Err carries the HTTP status or the error text).
async fn dial(url: &str, origin: &str) -> Result<Ws, String> {
    let mut req = url.into_client_request().map_err(|e| e.to_string())?;
    req.headers_mut().insert("Origin", origin.parse().unwrap());
    let host = req.uri().authority().map(|a| a.to_string()).unwrap_or_default();
    let tcp = TcpStream::connect(host.as_str()).await.map_err(|e| format!("tcp: {e}"))?;
    let _ = tcp.set_nodelay(true);
    // no small read limit here: a crowded frame is a few kB, and the client must take what the relay sends
    let cfg = tokio_tungstenite::tungstenite::protocol::WebSocketConfig::default().max_message_size(Some(1 << 20)).max_frame_size(Some(1 << 20));
    match tokio_tungstenite::client_async_with_config(req, tcp, Some(cfg)).await {
        Ok((ws, _)) => Ok(ws),
        Err(tokio_tungstenite::tungstenite::Error::Http(r)) => Err(format!("http {}", r.status().as_u16())),
        Err(e) => Err(e.to_string()),
    }
}

#[tokio::main]
async fn main() {
    let mut o = Opts { url: "ws://localhost:8791/ws".into(), side: 1000.0, rooms: 1 };
    let (mut n, mut dur, mut mode, mut k) = (32usize, Duration::from_secs(30), "normal".to_string(), 0usize);
    let mut it = std::env::args().skip(1);
    while let Some(a) = it.next() {
        let v = it.next().unwrap_or_default();
        match a.trim_start_matches('-') {
            "url" => o.url = v,
            "n" => n = v.parse().expect("bad -n"),
            "side" => o.side = v.parse().expect("bad -side"),
            "dur" => dur = duration(&v),
            "rooms" => o.rooms = v.parse().expect("bad -rooms"),
            "mode" => mode = v,
            "k" => k = v.parse().expect("bad -k"),
            _ => {
                eprintln!("flags: -url ws://host:port/ws -n 32 -side 1000 -dur 30s -rooms 1 [-mode normal|churn|storm|stall|abuse] [-k stalled clients]");
                std::process::exit(2)
            }
        }
    }
    if mode == "abuse" {
        return abuse(&o.url).await;
    }
    let c = Arc::new(Counters::default());
    let stop = Instant::now() + dur;
    let mut tasks = Vec::new();
    match mode.as_str() {
        "normal" | "stall" => {
            for i in 0..n {
                let (c, o) = (c.clone(), o.clone());
                tasks.push(tokio::spawn(async move { session(i, &o, stop, true, true, &c).await }));
            }
            for j in 0..k {
                // stalled readers: connect, send like anybody, never read
                let (c, o) = (c.clone(), o.clone());
                tasks.push(tokio::spawn(async move { session(n + j, &o, stop, false, false, &c).await }));
            }
        }
        "churn" => {
            for i in 0..n {
                let (c, o) = (c.clone(), o.clone());
                tasks.push(tokio::spawn(async move {
                    let mut r = Rng(i as u64 * 0x2545_F491_4F6C_DD1D + 7);
                    while Instant::now() < stop {
                        let until = (Instant::now() + Duration::from_millis(1000 + (r.next() * 3000.0) as u64)).min(stop);
                        session(i, &o, until, true, true, &c).await;
                        tokio::time::sleep(Duration::from_millis((r.next() * 300.0) as u64)).await;
                    }
                }));
            }
        }
        "storm" => {
            // everybody leaves and rejoins at the same moment, three times
            let o2 = o.clone();
            let c2 = c.clone();
            tasks.push(tokio::spawn(async move {
                for cycle in 0..3 {
                    let t0 = Instant::now();
                    c2.connect_ms_max.store(0, Relaxed);
                    let before = c2.sessions.load(Relaxed);
                    let hs: Vec<_> = (0..n)
                        .map(|i| {
                            let (c, o) = (c2.clone(), o2.clone());
                            tokio::spawn(async move { session(i, &o, t0 + Duration::from_secs(5), true, true, &c).await })
                        })
                        .collect();
                    for h in hs {
                        let _ = h.await;
                    }
                    println!("storm {}: {} of {n} connected, slowest connect {} ms, cycle {:.1}s", cycle + 1, c2.sessions.load(Relaxed) - before, c2.connect_ms_max.load(Relaxed), t0.elapsed().as_secs_f64());
                }
            }));
        }
        m => {
            eprintln!("unknown -mode {m}");
            std::process::exit(2)
        }
    }
    for t in tasks {
        let _ = t.await;
    }
    let nc = c.ok.load(Relaxed);
    let pm = nc as f64 * dur.as_secs_f64() / 60.0;
    let (rx, tx) = (c.rx.load(Relaxed) as f64, c.tx.load(Relaxed) as f64);
    if mode == "normal" || mode == "stall" {
        println!("clients={nc} side={:.0}m rooms={} duration={dur:?}", o.side, o.rooms);
        println!(
            "server->client: {:.0} B per player-minute ({:.1} kB/min, {:.0} msgs/min), avg other players per frame {:.1}",
            rx / pm, rx / pm / 1000.0, c.rx_msgs.load(Relaxed) as f64 / pm, c.vis_sum.load(Relaxed) as f64 / (c.vis_n.load(Relaxed).max(1)) as f64
        );
        println!("client->server: {:.0} B per player-minute ({:.1} kB/min, {:.0} msgs/min)", tx / pm, tx / pm / 1000.0, c.tx_msgs.load(Relaxed) as f64 / pm);
        println!("server egress total: {:.1} kB/s for {nc} clients", rx / dur.as_secs_f64() / 1000.0);
    } else {
        println!("{mode}: sessions={} failed dials={} received {:.0} kB, {} frames", c.sessions.load(Relaxed), c.dial_fail.load(Relaxed), rx / 1000.0, c.rx_msgs.load(Relaxed));
    }
}

/// One simulated driver: connects, sends INFO, then a state at 10 Hz until `stop`. read=false never reads (a stalled client).
async fn session(i: usize, o: &Opts, stop: Instant, read: bool, count: bool, c: &Arc<Counters>) {
    let u = format!("{}?room=lt{}", o.url, i % o.rooms);
    let t0 = Instant::now();
    let ws = match dial(&u, "http://localhost:8790").await {
        Ok(w) => w,
        Err(e) => {
            c.dial_fail.fetch_add(1, Relaxed);
            if c.dial_fail.load(Relaxed) <= 5 {
                println!("dial: {e}");
            }
            return;
        }
    };
    c.sessions.fetch_add(1, Relaxed);
    c.connect_ms_max.fetch_max(t0.elapsed().as_millis() as i64, Relaxed);
    if count {
        c.ok.fetch_add(1, Relaxed);
    }
    let (mut sink, mut stream) = ws.split();
    let name = format!("Bot{i:02}");
    let mut info = vec![0x01, (i % 3) as u8, name.len() as u8];
    info.extend_from_slice(name.as_bytes());
    let n = info.len() as i64 + 6;
    if sink.send(Message::Binary(info.into())).await.is_err() {
        return;
    }
    if count {
        c.tx.fetch_add(n, Relaxed);
    }
    let reader = if read {
        let c2 = c.clone();
        Some(tokio::spawn(async move {
            while let Some(Ok(m)) = stream.next().await {
                if let Message::Binary(d) = m {
                    c2.rx.fetch_add(d.len() as i64 + 2, Relaxed);
                    c2.rx_msgs.fetch_add(1, Relaxed);
                    if d.len() >= 3 && d[0] == 0x24 {
                        c2.vis_sum.fetch_add(d[1] as i64 + d[2] as i64, Relaxed);
                        c2.vis_n.fetch_add(1, Relaxed);
                    }
                }
            }
        }))
    } else {
        std::mem::forget(stream); // keep the socket open and unread
        None
    };
    let mut r = Rng(i as u64 * 0x9E37_79B9_7F4A_7C15 + 1);
    let (mut x, mut z) = ((r.next() - 0.5) * o.side, (r.next() - 0.5) * o.side);
    let (mut th, v) = (r.next() * std::f64::consts::TAU, 8.0 + r.next() * 8.0);
    let mut tk = tokio::time::interval(Duration::from_millis(100));
    let mut last = [0u8; 12];
    loop {
        tk.tick().await;
        if Instant::now() > stop {
            break;
        }
        th += (r.next() - 0.5) * 0.5;
        x += th.sin() * v * 0.1;
        z += th.cos() * v * 0.1;
        let h = o.side / 2.0;
        if x < -h || x > h || z < -h || z > h {
            th = (-x).atan2(-z); // bounce back towards the centre
        }
        let mut m = [0u8; 12];
        m[0] = 0x02;
        m[1..6].copy_from_slice(&protocol::encode_pos(x, z));
        m[6] = (th.rem_euclid(std::f64::consts::TAU) / std::f64::consts::TAU * 256.0) as u8;
        m[7] = (v * 2.0) as i8 as u8;
        m[8] = (r.next() * 40.0 - 20.0) as i8 as u8;
        m[9] = (r.next() * 20.0 - 10.0) as i8 as u8;
        if m == last {
            continue;
        }
        last = m;
        // a stalled reader's socket fills up; do not wait for it forever
        match tokio::time::timeout(Duration::from_secs(2), sink.send(Message::Binary(m.to_vec().into()))).await {
            Ok(Ok(())) => {}
            _ => break,
        }
        if count {
            c.tx.fetch_add(m.len() as i64 + 6, Relaxed);
            c.tx_msgs.fetch_add(1, Relaxed);
        }
    }
    let _ = sink.close().await;
    if let Some(r) = reader {
        r.abort();
    }
}

// ---------- abuse ----------

fn state(i: u32) -> Vec<u8> {
    let mut m = vec![0x02];
    m.extend_from_slice(&protocol::encode_pos(i as f64 * 0.1, 0.0));
    m.extend_from_slice(&[0; 6]);
    m
}

fn info(name: &[u8]) -> Vec<u8> {
    let mut m = vec![0x01, 0, name.len() as u8];
    m.extend_from_slice(name);
    m
}

/// Reads until the relay closes; returns (close code if any, how long it took, frames seen).
async fn until_closed(ws: &mut Ws, limit: Duration) -> (Option<u16>, f64, usize) {
    let t0 = Instant::now();
    let mut frames = 0;
    loop {
        match tokio::time::timeout(limit.saturating_sub(t0.elapsed()), ws.next()).await {
            Err(_) => return (None, t0.elapsed().as_secs_f64(), frames), // still open
            Ok(None) | Ok(Some(Err(_))) => return (Some(0), t0.elapsed().as_secs_f64(), frames), // connection dropped without a close frame
            Ok(Some(Ok(Message::Close(f)))) => return (Some(f.map(|f| u16::from(f.code)).unwrap_or(1005)), t0.elapsed().as_secs_f64(), frames),
            Ok(Some(Ok(_))) => frames += 1,
        }
    }
}

fn verdict(ok: bool) -> &'static str {
    if ok { "PASS" } else { "FAIL" }
}

async fn abuse(url: &str) {
    let u = |room: &str| format!("{url}?room={room}");
    let origin = "http://localhost:8790";

    // 1. bad Origin is refused before the upgrade
    let r = dial(&u("ab1"), "https://evil.example").await;
    println!("{} bad Origin: {}", verdict(matches!(&r, Err(e) if e == "http 403")), r.err().unwrap_or("accepted".into()));

    // 2. a message over 80 bytes closes the connection
    let mut ws = dial(&u("ab2"), origin).await.unwrap();
    ws.send(Message::Binary(info(b"Abuser").into())).await.unwrap();
    ws.send(Message::Binary(vec![0x02; 200].into())).await.unwrap();
    let (code, secs, _) = until_closed(&mut ws, Duration::from_secs(5)).await;
    println!("{} 200 byte message: closed with {:?} after {:.1}s", verdict(code.is_some()), code, secs);

    // 3. a 1 MB frame
    let mut ws = dial(&u("ab3"), origin).await.unwrap();
    ws.send(Message::Binary(info(b"Abuser").into())).await.unwrap();
    let _ = ws.send(Message::Binary(vec![0x02; 1_000_000].into())).await;
    let (code, secs, _) = until_closed(&mut ws, Duration::from_secs(5)).await;
    println!("{} 1 MB frame: closed with {:?} after {:.1}s", verdict(code.is_some()), code, secs);

    // 4. unknown message types: strikes, then closed (policy violation 1008)
    {
        let mut ws = dial(&u("ab4"), origin).await.unwrap();
        ws.send(Message::Binary(info(b"Abuser").into())).await.unwrap();
        let mut sent = 0;
        for _ in 0..600 {
            if ws.send(Message::Binary(vec![0x7f, 1, 2].into())).await.is_err() {
                break;
            }
            sent += 1;
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        let (code, _, _) = until_closed(&mut ws, Duration::from_secs(3)).await;
        println!("{} unknown-type flood at 200/s: closed with {:?} (sent {sent} of 600)", verdict(code == Some(1008)), code);
    }

    // 5. a burst of valid states, much faster than 25 per second
    {
        let mut ws = dial(&u("ab5"), origin).await.unwrap();
        ws.send(Message::Binary(info(b"Flooder").into())).await.unwrap();
        let t0 = Instant::now();
        let mut sent = 0u32;
        for i in 0..2000 {
            if ws.feed(Message::Binary(state(i).into())).await.is_err() {
                break;
            }
            sent += 1;
        }
        let _ = ws.flush().await;
        let (code, _, _) = until_closed(&mut ws, Duration::from_secs(3)).await;
        println!("{} state burst: {sent} messages queued in {:.2}s, closed with {:?} (expect 1008)", verdict(code == Some(1008)), t0.elapsed().as_secs_f64(), code);
    }

    // 6. names: invalid UTF-8, too long, control characters, a block-listed word; the relay must stay up
    {
    let mut ws = dial(&u("ab6"), origin).await.unwrap();
    for name in [&[0xff, 0xfe, 0xfd][..], &[b'A'; 64], "Ma\u{200B}r\u{0007}io\n\n Rossi".as_bytes(), b"Hitler"] {
        ws.send(Message::Binary(info(name).into())).await.unwrap();
        tokio::time::sleep(Duration::from_millis(2100)).await; // the relay ignores name changes faster than every 2 s
    }
    ws.send(Message::Binary(vec![0x01, 0, 255, 1, 2, 3].into())).await.unwrap(); // length byte lies
    ws.send(Message::Binary(info(&[b'B'; 70]).into())).await.unwrap(); // 70 bytes: over the 64 byte limit, still within 80
    ws.send(Message::Binary(state(1).into())).await.unwrap();
    let (code, _, _) = until_closed(&mut ws, Duration::from_millis(800)).await;
    println!("{} odd names and lying lengths: connection {}", verdict(code.is_none()), if code.is_none() { "still open".into() } else { format!("closed {code:?}") });
    }

    // 7. heartbeats but no INFO at all: dropped after 10 s (relay started with -afk-timeout 14s)
    {
        let mut ws = dial(&u("ab7"), origin).await.unwrap();
        let t0 = Instant::now();
        let mut code = None;
        while t0.elapsed() < Duration::from_secs(16) && code.is_none() {
            let _ = ws.send(Message::Binary(vec![0x03].into())).await;
            if let Ok(Some(Ok(Message::Close(f)))) = tokio::time::timeout(Duration::from_secs(2), ws.next()).await {
                code = f.map(|f| u16::from(f.code));
            }
        }
        let secs = t0.elapsed().as_secs_f64();
        println!("{} no INFO: closed with {:?} after {:.1}s (expect 1008 at about 10 s)", verdict(code == Some(1008) && (9.0..13.0).contains(&secs)), code, secs);
    }

    // 8. silent connection: idle timeout (relay started with -idle-timeout 6s)
    {
        let mut ws = dial(&u("ab8"), origin).await.unwrap();
        ws.send(Message::Binary(info(b"Silent").into())).await.unwrap();
        let (code, secs, _) = until_closed(&mut ws, Duration::from_secs(12)).await;
        println!("{} silent after INFO: closed with {:?} after {:.1}s (idle timeout 6s)", verdict(code.is_some() && secs < 9.0), code, secs);
    }

    // 9. heartbeats but no position: AFK close 4001 (relay started with -afk-timeout 14s)
    {
        let mut ws = dial(&u("ab9"), origin).await.unwrap();
        ws.send(Message::Binary(info(b"Afk").into())).await.unwrap();
        let t0 = Instant::now();
        let mut code = None;
        while t0.elapsed() < Duration::from_secs(20) && code.is_none() {
            let _ = ws.send(Message::Binary(vec![0x03].into())).await;
            if let Ok(Some(Ok(Message::Close(f)))) = tokio::time::timeout(Duration::from_secs(2), ws.next()).await {
                code = f.map(|f| u16::from(f.code));
            }
        }
        println!("{} pings only: closed with {:?} after {:.1}s (expect 4001 at about 14 s)", verdict(code == Some(4001)), code, t0.elapsed().as_secs_f64());
    }

    // 10. per-IP limit: 20 connections from one address
    let mut open = Vec::new();
    let mut refused = Vec::new();
    for _ in 0..20 {
        match dial(&u("ab10"), origin).await {
            Ok(w) => open.push(w),
            Err(e) => refused.push(e),
        }
    }
    println!("{} 20 connections from one address: {} accepted, refused with {:?}", verdict(!refused.is_empty() && refused.iter().all(|e| e == "http 429")), open.len(), refused.first());
    drop(open);

    // 11. slowloris: half an HTTP request, then nothing
    let host = url.trim_start_matches("ws://").split('/').next().unwrap().to_string();
    let mut tcp = TcpStream::connect(&host).await.unwrap();
    tcp.write_all(b"GET /ws HTTP/1.1\r\nHost: x\r\nX-Slow: ").await.unwrap();
    let t0 = Instant::now();
    let mut buf = [0u8; 64];
    let r = tokio::time::timeout(Duration::from_secs(40), tcp.read(&mut buf)).await;
    println!("{} slowloris (half a request): {} after {:.1}s", verdict(r.is_ok()), match &r { Ok(Ok(0)) => "relay closed the connection".to_string(), Ok(Ok(n)) => format!("relay answered {n} bytes"), Ok(Err(e)) => format!("error {e}"), Err(_) => "still open after 40 s".into() }, t0.elapsed().as_secs_f64());

    // 12. a normal client is unaffected afterwards
    let mut ws = dial(&u("ab12"), origin).await.unwrap();
    ws.send(Message::Binary(info(b"Normal").into())).await.unwrap();
    ws.send(Message::Binary(state(1).into())).await.unwrap();
    let (code, _, frames) = until_closed(&mut ws, Duration::from_secs(1)).await;
    println!("{} a normal client afterwards: {} frames, open {}", verdict(code.is_none() && frames > 0), frames, code.is_none());
}
