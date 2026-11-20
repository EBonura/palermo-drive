//! The Cloudflare side: a Worker that checks the upgrade and a Durable Object that owns the sockets. All the rules
//! are in `hub`; this file only moves frames between sockets and the hub and keeps the attachments up to date.

use crate::hub::{Action, Conn, Hub, Refuse};
use crate::proto::{from_hex, origin_allowed, to_hex, MAX_CONNS};
use crate::status::{cors_origin, failure_body, status_body};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use worker::*;

/// The players are in Italy: ask for the object to live in western Europe.
const LOCATION_HINT: &str = "weur";

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let path = req.url()?.path().to_string();
    match path.as_str() {
        "/r" => {
            if req.headers().get("Upgrade")?.map(|u| u.eq_ignore_ascii_case("websocket")) != Some(true) {
                return Response::error("expected a WebSocket upgrade", 426);
            }
            // Checked here, before the object: a refused browser never wakes it.
            let allowed = env.var("ORIGINS").map(|v| v.to_string()).unwrap_or_default();
            if !origin_allowed(req.headers().get("Origin")?.as_deref(), &allowed) {
                return Response::error("origin not allowed", 403);
            }
            relay(&env)?.fetch_with_request(req).await
        }
        // Tables (BLATERO): its own origin list, so a Palermo Drive page cannot open one and the reverse.
        "/t" => {
            if req.headers().get("Upgrade")?.map(|u| u.eq_ignore_ascii_case("websocket")) != Some(true) {
                return Response::error("expected a WebSocket upgrade", 426);
            }
            let allowed = env.var("TABLE_ORIGINS").map(|v| v.to_string()).unwrap_or_else(|_| crate::tproto::DEFAULT_TABLE_ORIGINS.to_string());
            if !origin_allowed(req.headers().get("Origin")?.as_deref(), &allowed) {
                return Response::error("origin not allowed", 403);
            }
            crate::tglue::stub(&env)?.fetch_with_request(req).await
        }
        "/stats" => relay(&env)?.fetch_with_request(req).await,
        "/status" => status(req, &env).await,
        _ => Response::error("not found", 404),
    }
}

/// GET /status: why a player cannot get in, for a browser that cannot read the status of a failed upgrade (see status.rs). Never fails: a call
/// to the object that throws (its free daily limit used up, or anything else) is caught and answered as JSON too.
async fn status(req: Request, env: &Env) -> Result<Response> {
    let allowed = env.var("ORIGINS").map(|v| v.to_string()).unwrap_or_default();
    let origin = req.headers().get("Origin").ok().flatten();
    let body = match async { relay(env)?.fetch_with_request(req).await?.text().await }.await {
        Ok(b) => b,
        Err(e) => failure_body(&e.to_string()),
    };
    let mut r = Response::ok(body)?;
    let h = r.headers_mut();
    h.set("Content-Type", "application/json")?;
    h.set("Cache-Control", "private, max-age=5")?; // a refused page asks by its own backoff; this keeps a second tab or a quick retry from asking twice
    h.set("Vary", "Origin")?;
    if let Some(o) = cors_origin(origin.as_deref(), &allowed) {
        h.set("Access-Control-Allow-Origin", o)?;
    }
    Ok(r)
}

/// The one object everything lives in.
fn relay(env: &Env) -> Result<Stub> {
    env.durable_object("RELAY")?.id_from_name("main")?.get_stub_with_location_hint(LOCATION_HINT)
}

fn now_ms() -> u64 {
    Date::now().as_millis()
}

fn attachment(c: &Conn) -> String {
    to_hex(&c.encode())
}

/// The handle is the third and fourth byte of the saved record; reading just those spares decoding all of it.
fn handle_of(ws: &WebSocket) -> Option<u16> {
    let s = ws.deserialize_attachment::<String>().ok().flatten()?;
    let b = from_hex(s.get(..6)?)?;
    Some(u16::from_le_bytes([b[1], b[2]]))
}

#[durable_object]
pub struct Relay {
    state: State,
    /// Built from the sockets' attachments on the first event after a start or a wake-up.
    hub: RefCell<Option<Hub>>,
    sockets: RefCell<HashMap<u16, WebSocket>>,
}

impl Relay {
    fn ensure(&self) {
        if self.hub.borrow().is_some() {
            return;
        }
        let now = now_ms();
        let mut hub = Hub::new(now as u16);
        let mut conns = vec![];
        let mut socks = HashMap::new();
        for ws in self.state.get_websockets() {
            match ws.deserialize_attachment::<String>().ok().flatten().and_then(|s| from_hex(&s)).and_then(|b| Conn::decode(&b, now)) {
                Some(c) => {
                    socks.insert(c.handle, ws);
                    conns.push(c);
                }
                None => {
                    let _ = ws.close(Some(1011), Some("state lost"));
                }
            }
        }
        hub.restore(conns);
        *self.sockets.borrow_mut() = socks;
        *self.hub.borrow_mut() = Some(hub);
    }

    fn with_hub<R>(&self, f: impl FnOnce(&mut Hub) -> R) -> R {
        self.ensure();
        f(self.hub.borrow_mut().as_mut().unwrap())
    }

    fn run(&self, acts: Vec<Action>) {
        let hub = self.hub.borrow();
        let hub = hub.as_ref().unwrap();
        let mut socks = self.sockets.borrow_mut();
        let mut saved = HashSet::new();
        for a in acts {
            match a {
                Action::Send(h, bytes) => {
                    if let Some(ws) = socks.get(&h) {
                        let _ = ws.send_with_bytes(&bytes);
                    }
                }
                Action::Close(h, code, why) => {
                    if let Some(ws) = socks.remove(&h) {
                        // Kept in the Worker's logs: a player told to stop is rare, and without this nothing records why.
                        console_log!("relay: closed a player, {code} {why}");
                        if let Err(e) = ws.close(Some(code), Some(why)) {
                            console_error!("close {h} failed: {e:?}");
                        }
                    }
                }
                Action::Persist(h) => {
                    // Once per batch is enough: it is the state after the whole batch that matters.
                    if saved.insert(h) {
                        if let (Some(ws), Some(c)) = (socks.get(&h), hub.conn(h)) {
                            let _ = ws.serialize_attachment(attachment(c));
                        }
                    }
                }
            }
        }
    }

    fn gone(&self, ws: &WebSocket) {
        let Some(h) = handle_of(ws) else { return };
        let now = now_ms();
        let acts = self.with_hub(|hub| {
            let mut acts = hub.sweep(now);
            acts.extend(hub.on_close(h, now));
            acts
        });
        self.sockets.borrow_mut().remove(&h);
        self.run(acts);
    }
}

impl DurableObject for Relay {
    fn new(state: State, _env: Env) -> Self {
        Self { state, hub: RefCell::new(None), sockets: RefCell::new(HashMap::new()) }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        if req.url()?.path() == "/status" {
            let ip = req.headers().get("CF-Connecting-IP")?.unwrap_or_else(|| "unknown".into());
            let now = now_ms();
            let (body, frames) = self.with_hub(|hub| (status_body(hub.online(), MAX_CONNS, hub.len() >= MAX_CONNS, hub.budget_used(&ip, now)), hub.frames_today(&ip)));
            if !body.contains("\"ok\":true") {
                console_log!("relay: status said {body}, this address has sent {frames} frames today");
            }
            return Response::ok(body);
        }
        if req.url()?.path() == "/stats" {
            let json = self.with_hub(|hub| hub.stats_json());
            let mut r = Response::ok(json)?;
            r.headers_mut().set("Content-Type", "application/json")?;
            return Ok(r);
        }
        let now = now_ms();
        let ip = req.headers().get("CF-Connecting-IP")?.unwrap_or_else(|| "unknown".into());
        let swept = self.with_hub(|hub| hub.sweep(now));
        self.run(swept);
        let handle = match self.with_hub(|hub| hub.accept(&ip, now)) {
            Ok((h, acts)) => {
                self.run(acts);
                h
            }
            Err(e) => {
                let (why, code) = match e {
                    Refuse::Full => ("full", 503),
                    Refuse::PerAddress => ("too many connections from this address", 429),
                    Refuse::Budget => ("this address has used today's allowance", 429),
                };
                console_log!("relay: refused a player, {code} {why}");
                return Response::error(why, code);
            }
        };
        let pair = WebSocketPair::new()?;
        self.state.accept_web_socket(&pair.server); // hibernatable: an idle relay is not billed
        let saved = self.with_hub(|hub| attachment(hub.conn(handle).unwrap()));
        pair.server.serialize_attachment(saved)?;
        self.sockets.borrow_mut().insert(handle, pair.server.clone());
        Response::from_websocket(pair.client)
    }

    async fn websocket_message(&self, ws: WebSocket, message: WebSocketIncomingMessage) -> Result<()> {
        let Some(h) = handle_of(&ws) else { return Ok(()) };
        let now = now_ms();
        let acts = self.with_hub(|hub| {
            let mut acts = hub.sweep(now);
            match message {
                WebSocketIncomingMessage::Binary(b) => acts.extend(hub.on_binary(h, &b, now)),
                WebSocketIncomingMessage::String(_) => acts.extend(hub.on_text(h, now)),
            }
            acts
        });
        self.run(acts);
        Ok(())
    }

    async fn websocket_close(&self, ws: WebSocket, _code: usize, _reason: String, _clean: bool) -> Result<()> {
        // The runtime answers the peer's Close frame by itself, so there is nothing to close here.
        self.gone(&ws);
        Ok(())
    }

    async fn websocket_error(&self, ws: WebSocket, _e: Error) -> Result<()> {
        self.gone(&ws);
        Ok(())
    }
}
