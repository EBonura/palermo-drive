// HTTP routes (/ws, /ping, /stats, /healthz) and the per-connection WebSocket task.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, State};
use axum::http::header::{ACCEPT, CACHE_CONTROL, CONTENT_TYPE, HOST, ORIGIN};
use axum::http::{HeaderMap, Method, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use axum::Router;
use tokio::time::{sleep, timeout};

use crate::hub::{ConnGuard, Hub, Shared, CLOSE_IDLE, CLOSE_POLICY, CLOSE_REFRESH};
use crate::metrics;
use crate::protocol::*;
use crate::stats::{ip_key, Stats};

#[derive(Clone)]
pub struct App {
    pub hub: Arc<Hub>,
    pub st: Arc<Stats>,
}

pub fn router(app: App) -> Router {
    Router::new()
        .route("/", get(|| async { "Palermo Drive relay\n" }))
        .route("/ws", get(ws_route))
        .route("/ping", any(ping_route))
        .route("/stats", get(stats_route))
        .route("/healthz", get(|| async { "ok" }))
        .fallback(|| async { (StatusCode::NOT_FOUND, "404 page not found\n") })
        .with_state(app)
}

/// The client address: the connecting socket's, unless a header name is configured (-trust-header, for example CF-Connecting-IP
/// behind a Cloudflare tunnel, where every connection arrives from the tunnel on localhost). Only then is that header believed,
/// and only its last value; a missing or unparseable one falls back to the socket.
fn client_ip(h: &HeaderMap, peer: SocketAddr, trust: Option<&str>) -> IpAddr {
    trust
        .and_then(|name| h.get(name))
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or_else(|| peer.ip())
}

fn glob(p: &[u8], s: &[u8]) -> bool {
    match p.split_first() {
        None => s.is_empty(),
        Some((b'*', rest)) => (0..=s.len()).any(|i| glob(rest, &s[i..])),
        Some((b'?', rest)) => !s.is_empty() && glob(rest, &s[1..]),
        Some((c, rest)) => s.first() == Some(c) && glob(rest, &s[1..]),
    }
}

/// A browser sends Origin on a WebSocket handshake: accept our own host and the listed host patterns (host:port, "*" wildcard).
/// Requests without Origin are not browsers and pass (the per-IP limit and caps still apply).
fn origin_ok(h: &HeaderMap, patterns: &[String]) -> bool {
    let Some(o) = h.get(ORIGIN) else { return true };
    let Some(o) = o.to_str().ok().and_then(|o| o.split_once("://")).map(|(_, r)| r.split('/').next().unwrap_or("").to_ascii_lowercase()) else { return false };
    if o.is_empty() {
        return false;
    }
    if h.get(HOST).and_then(|v| v.to_str().ok()).is_some_and(|host| host.eq_ignore_ascii_case(&o)) {
        return true;
    }
    patterns.iter().any(|p| glob(p.to_ascii_lowercase().as_bytes(), o.as_bytes()))
}

fn qparam(uri: &Uri, name: &str) -> Option<String> {
    uri.query()?.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=').unwrap_or((kv, ""));
        (k == name).then(|| pct_decode(v))
    })
}

fn pct_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut o = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => o.push(b' '),
            b'%' if i + 2 < b.len() && b[i + 1].is_ascii_hexdigit() && b[i + 2].is_ascii_hexdigit() => {
                o.push(u8::from_str_radix(&s[i + 1..i + 3], 16).unwrap_or(b'?'));
                i += 2;
            }
            c => o.push(c),
        }
        i += 1;
    }
    String::from_utf8_lossy(&o).into_owned()
}

fn clean_room(s: &str) -> String {
    let r: String = s.bytes().map(|c| c.to_ascii_lowercase()).filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-' || *c == b'_').take(16).map(char::from).collect();
    if r.is_empty() { "main".into() } else { r }
}

// ---------- /ws ----------

async fn ws_route(State(app): State<App>, ConnectInfo(peer): ConnectInfo<SocketAddr>, headers: HeaderMap, uri: Uri, ws: WebSocketUpgrade) -> Response {
    if !origin_ok(&headers, &app.hub.cfg.origins) {
        return (StatusCode::FORBIDDEN, "origin not allowed\n").into_response();
    }
    if !app.st.allow_ws() {
        // monthly free-tier cap: clients fall back to single player
        return (StatusCode::SERVICE_UNAVAILABLE, "multiplayer paused\n").into_response();
    }
    let Some(guard) = app.hub.admit(client_ip(&headers, peer, app.hub.cfg.trust_header.as_deref())) else {
        return (StatusCode::TOO_MANY_REQUESTS, "busy\n").into_response();
    };
    let room = clean_room(&qparam(&uri, "room").unwrap_or_default());
    ws.max_message_size(MAX_CLIENT_MSG).max_frame_size(MAX_CLIENT_MSG).read_buffer_size(1024).write_buffer_size(0).on_upgrade(move |sock| conn(app, sock, guard, room))
}

struct Open(Arc<Stats>);
impl Drop for Open {
    fn drop(&mut self) {
        self.0.ws_close();
    }
}

/// Reads at most 40 messages in a burst and 25 a second (token bucket), strikes for the rest.
struct Limits {
    tokens: f64,
    t: Instant,
    strikes: u32,
}

async fn close_with(sock: &mut WebSocket, code: u16, reason: &'static str) {
    // send the close frame and wait briefly for the answer, so the client sees the code before the socket goes away
    let _ = timeout(Duration::from_secs(2), async {
        if sock.send(Message::Close(Some(CloseFrame { code, reason: reason.into() }))).await.is_err() {
            return;
        }
        while let Some(Ok(m)) = sock.recv().await {
            if matches!(m, Message::Close(_)) {
                break;
            }
        }
    })
    .await;
}

async fn conn(app: App, mut sock: WebSocket, _guard: ConnGuard, room: String) {
    let cfg = &app.hub.cfg;
    let (sh, mut rx) = Shared::new();
    let seat = app.hub.join(&room, sh.clone());
    app.st.ws_open();
    let _open = Open(app.st.clone());
    sh.send(vec![S_WELCOME, VERSION, seat.id, (MAX_PLAYERS & 255) as u8, (MAX_PLAYERS >> 8) as u8]);

    let start = Instant::now();
    let session_end = sleep(if cfg.max_session.is_zero() { Duration::from_secs(100 * 365 * 86400) } else { cfg.max_session });
    let idle = sleep(cfg.idle_timeout);
    tokio::pin!(session_end, idle);
    let mut lim = Limits { tokens: 40.0, t: start, strikes: 0 };
    let mut last_state = start;
    let mut close: Option<(u16, &'static str)> = None;

    loop {
        tokio::select! {
            biased;
            _ = sh.kick.notify.notified() => { close = sh.kick.get(); break; }
            _ = &mut session_end => { close = Some((CLOSE_REFRESH, "session limit")); break; }
            _ = &mut idle => break,
            m = rx.recv() => {
                let Some(m) = m else { break };
                let len = m.len();
                match timeout(Duration::from_secs(5), sock.send(Message::Binary(m.into()))).await {
                    Ok(Ok(())) => { app.st.add_egress(len + 2 + 40); metrics::frame_out(len + 2); } // payload, WebSocket header, rough TCP/TLS share
                    _ => break,
                }
            }
            msg = sock.recv() => {
                let data = match msg {
                    Some(Ok(Message::Binary(b))) => b,
                    Some(Ok(Message::Text(t))) => t.into(),
                    Some(Ok(Message::Ping(_) | Message::Pong(_))) => continue,
                    _ => break,
                };
                let now = Instant::now();
                idle.as_mut().reset(tokio::time::Instant::now() + cfg.idle_timeout);
                lim.tokens = (lim.tokens + now.duration_since(lim.t).as_secs_f64() * 25.0).min(40.0);
                lim.t = now;
                if lim.tokens < 1.0 {
                    lim.strikes += 1;
                    if lim.strikes > 300 { close = Some((CLOSE_POLICY, "rate limit")); break; }
                    continue;
                }
                lim.tokens -= 1.0;
                let Some(&kind) = data.first() else { continue };
                match kind {
                    C_STATE => {
                        if data.len() != 1 + STATE_LEN { continue }
                        last_state = now;
                        sh.publish(&data[1..]);
                    }
                    C_INFO => {
                        if data.len() < 3 || data[2] as usize != data.len() - 3 { continue }
                        let mut name = clean_name(&data[3..]);
                        if name.is_empty() || (cfg.filter && is_blocked(&name)) { name = "Ospite".into(); }
                        let livery = if data[1] > MAX_LIVERY { 0 } else { data[1] };
                        app.hub.set_info(&seat, name, livery, now);
                    }
                    C_PING => {}
                    _ => {
                        lim.strikes += 1;
                        if lim.strikes > 300 { close = Some((CLOSE_POLICY, "bad message")); break; }
                    }
                }
                if now.duration_since(last_state) > cfg.afk_timeout { close = Some((CLOSE_IDLE, "idle")); break; }
            }
        }
    }
    if let Some((code, reason)) = close {
        close_with(&mut sock, code, reason).await;
    }
}

// ---------- /ping ----------

fn cors(mut r: Response) -> Response {
    let h = r.headers_mut();
    h.insert("access-control-allow-origin", "*".parse().unwrap());
    h.insert("access-control-allow-methods", "POST, OPTIONS".parse().unwrap());
    h.insert("access-control-allow-headers", "Content-Type".parse().unwrap());
    h.insert("access-control-max-age", "86400".parse().unwrap());
    r
}

async fn ping_route(State(app): State<App>, ConnectInfo(peer): ConnectInfo<SocketAddr>, headers: HeaderMap, method: Method, body: Body) -> Response {
    cors(ping(&app, peer, &headers, method, body).await)
}

async fn ping(app: &App, peer: SocketAddr, headers: &HeaderMap, method: Method, body: Body) -> Response {
    if method == Method::OPTIONS {
        return StatusCode::NO_CONTENT.into_response();
    }
    if method != Method::POST {
        return (StatusCode::METHOD_NOT_ALLOWED, "post only\n").into_response();
    }
    let b = axum::body::to_bytes(body, 128).await.unwrap_or_default();
    let text = String::from_utf8_lossy(&b);
    let parts: Vec<&str> = text.trim().split(',').collect();
    if parts.len() < 2 {
        return (StatusCode::BAD_REQUEST, "bad\n").into_response();
    }
    let secs = parts.get(2).and_then(|s| s.parse::<f64>().ok()).filter(|f| f.is_finite()).unwrap_or(0.0);
    let on = app.st.ping(ip_key(client_ip(headers, peer, app.hub.cfg.trust_header.as_deref())), parts[0], parts[1], secs, parts.get(3) == Some(&"1"));
    if on < 0 {
        return (StatusCode::TOO_MANY_REQUESTS, "no\n").into_response();
    }
    let body = format!(r#"{{"mp":{},"on":{}}}"#, app.st.mp_available() as u8, on);
    app.st.add_egress(body.len() + 250); // rough: response headers
    ([(CONTENT_TYPE, "application/json"), (CACHE_CONTROL, "no-store")], body).into_response()
}

// ---------- /stats ----------

async fn stats_route(State(app): State<App>, headers: HeaderMap, uri: Uri) -> Response {
    let hdr = [(CACHE_CONTROL, "no-store"), (axum::http::header::REFERRER_POLICY, "no-referrer"), (axum::http::HeaderName::from_static("x-robots-tag"), "noindex")];
    if !app.st.key_matches(&qparam(&uri, "key").unwrap_or_default()) {
        return (StatusCode::NOT_FOUND, hdr, "404 page not found\n").into_response();
    }
    let o = app.st.snapshot();
    let want_html = headers.get(ACCEPT).and_then(|v| v.to_str().ok()).is_some_and(|a| a.contains("text/html")) && qparam(&uri, "format").as_deref() != Some("json");
    if !want_html {
        let body = serde_json::to_string_pretty(&o).unwrap_or_default() + "\n";
        return (hdr, [(CONTENT_TYPE, "application/json")], body).into_response();
    }
    (hdr, [(CONTENT_TYPE, "text/html; charset=utf-8")], crate::stats::render_html(&o)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_address_comes_from_the_socket_unless_a_header_is_trusted() {
        let peer: SocketAddr = "127.0.0.1:5555".parse().unwrap();
        let mut h = HeaderMap::new();
        h.insert("cf-connecting-ip", "203.0.113.9".parse().unwrap());
        h.insert("x-forwarded-for", "198.51.100.1, 198.51.100.2".parse().unwrap());
        assert_eq!(client_ip(&h, peer, None), peer.ip(), "headers are not believed by default");
        assert_eq!(client_ip(&h, peer, Some("cf-connecting-ip")), "203.0.113.9".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(&h, peer, Some("x-forwarded-for")), "198.51.100.2".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(&h, peer, Some("x-missing")), peer.ip(), "a missing header falls back to the socket");
        h.insert("cf-connecting-ip", "not an address".parse().unwrap());
        assert_eq!(client_ip(&h, peer, Some("cf-connecting-ip")), peer.ip());
    }

    #[test]
    fn origins() {
        let pats = vec!["ebonura.github.io".to_string(), "localhost:*".to_string()];
        let mk = |o: &str, host: &str| {
            let mut h = HeaderMap::new();
            h.insert(ORIGIN, o.parse().unwrap());
            h.insert(HOST, host.parse().unwrap());
            h
        };
        assert!(origin_ok(&mk("https://ebonura.github.io", "relay.example"), &pats));
        assert!(origin_ok(&mk("http://localhost:8832", "relay.example"), &pats));
        assert!(!origin_ok(&mk("https://evil.example", "relay.example"), &pats));
        assert!(!origin_ok(&mk("https://ebonura.github.io.evil.example", "relay.example"), &pats));
        assert!(origin_ok(&mk("https://relay.example", "relay.example"), &pats), "same host");
        assert!(origin_ok(&HeaderMap::new(), &pats), "no Origin: not a browser");
        assert!(!origin_ok(&mk("null", "relay.example"), &pats));
    }
}
