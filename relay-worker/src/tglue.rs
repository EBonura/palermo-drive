//! The Cloudflare side of tables (BLATERO): a Durable Object that owns the table sockets. All the rules are in
//! `tables`; this file only moves frames between sockets and the state machine and keeps the attachments up to date.
//! It is a second class beside `Relay` in glue.rs, with its own single instance, so a fault or a flood on one game
//! cannot take the other's object down. No storage is used: a table is its sockets.

use crate::proto::{from_hex, to_hex};
use crate::tables::{Action, Conn, Refuse};
use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use worker::*;

/// The players are in Italy: ask for the object to live in western Europe.
const LOCATION_HINT: &str = "weur";
/// Counters go to `wrangler tail` at most this often, and when the last table closes.
const REPORT_EVERY_MS: u64 = 10 * 60_000;

/// The one object every table lives in.
pub fn stub(env: &Env) -> Result<Stub> {
    env.durable_object("TABLES")?.id_from_name("main")?.get_stub_with_location_hint(LOCATION_HINT)
}

fn now_ms() -> u64 {
    Date::now().as_millis()
}

fn attachment(c: &Conn) -> String {
    to_hex(&c.encode())
}

/// The handle is the second and third byte of the saved record; reading just those spares decoding all of it.
fn handle_of(ws: &WebSocket) -> Option<u16> {
    let s = ws.deserialize_attachment::<String>().ok().flatten()?;
    let b = from_hex(s.get(..6)?)?;
    Some(u16::from_le_bytes([b[1], b[2]]))
}

#[durable_object]
pub struct Tables {
    state: State,
    /// Built from the sockets' attachments on the first event after a start or a wake-up.
    tables: RefCell<Option<crate::tables::Tables>>,
    sockets: RefCell<HashMap<u16, WebSocket>>,
    last_report: Cell<u64>,
}

impl Tables {
    fn ensure(&self) {
        if self.tables.borrow().is_some() {
            return;
        }
        let now = now_ms();
        let mut t = crate::tables::Tables::new(now as u16);
        let mut conns = vec![];
        let mut socks = HashMap::new();
        let mut lost = vec![];
        for ws in self.state.get_websockets() {
            match ws.deserialize_attachment::<String>().ok().flatten().and_then(|s| from_hex(&s)).and_then(|b| Conn::decode(&b, now)) {
                Some(c) => {
                    socks.insert(c.handle, ws);
                    conns.push(c);
                }
                None => lost.push(ws),
            }
        }
        let rejected = t.restore(conns, now);
        for h in rejected {
            if let Some(ws) = socks.remove(&h) {
                let _ = ws.close(Some(1011), Some("state lost"));
            }
        }
        for ws in lost {
            let _ = ws.close(Some(1011), Some("state lost"));
        }
        // No address and no code in this line. It is how a wake-up shows in `wrangler tail`.
        console_log!("tables: rebuilt {} sockets in {} tables", t.len(), t.table_count());
        self.last_report.set(now);
        *self.sockets.borrow_mut() = socks;
        *self.tables.borrow_mut() = Some(t);
    }

    fn with<R>(&self, f: impl FnOnce(&mut crate::tables::Tables) -> R) -> R {
        self.ensure();
        f(self.tables.borrow_mut().as_mut().unwrap())
    }

    fn run(&self, acts: Vec<Action>) {
        let tables = self.tables.borrow();
        let tables = tables.as_ref().unwrap();
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
                        if let Err(e) = ws.close(Some(code), Some(why)) {
                            console_error!("close {h} failed: {e:?}");
                        }
                    }
                }
                Action::Persist(h) => {
                    // Once per batch is enough: it is the state after the whole batch that matters.
                    if saved.insert(h) {
                        if let (Some(ws), Some(c)) = (socks.get(&h), tables.conn(h)) {
                            let _ = ws.serialize_attachment(attachment(c));
                        }
                    }
                }
            }
        }
    }

    /// Counters (no address, no code) when the last table has closed and every ten minutes while busy.
    fn report(&self, now: u64, force: bool) {
        if force || now.saturating_sub(self.last_report.get()) >= REPORT_EVERY_MS {
            self.last_report.set(now);
            console_log!("tables: {}", self.with(|t| t.stats_json()));
        }
    }

    fn gone(&self, ws: &WebSocket) {
        let Some(h) = handle_of(ws) else { return };
        let now = now_ms();
        let (acts, emptied) = self.with(|t| {
            let before = t.table_count();
            let mut acts = t.sweep(now);
            acts.extend(t.on_close(h));
            (acts, before > 0 && t.table_count() == 0)
        });
        self.sockets.borrow_mut().remove(&h);
        self.run(acts);
        self.report(now, emptied);
    }
}

impl DurableObject for Tables {
    fn new(state: State, _env: Env) -> Self {
        Self { state, tables: RefCell::new(None), sockets: RefCell::new(HashMap::new()), last_report: Cell::new(0) }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        let now = now_ms();
        let ip = req.headers().get("CF-Connecting-IP")?.unwrap_or_else(|| "unknown".into());
        let swept = self.with(|t| t.sweep(now));
        self.run(swept);
        let handle = match self.with(|t| t.accept(&ip, now)) {
            Ok((h, acts)) => {
                self.run(acts);
                h
            }
            Err(Refuse::Full) => return Response::error("full", 503),
            Err(Refuse::PerAddress) => return Response::error("too many connections from this address", 429),
            Err(Refuse::Budget) => return Response::error("this address has used today's allowance", 429),
        };
        let pair = WebSocketPair::new()?;
        self.state.accept_web_socket(&pair.server); // hibernatable: an idle relay is not billed
        let saved = self.with(|t| attachment(t.conn(handle).unwrap()));
        pair.server.serialize_attachment(saved)?;
        self.sockets.borrow_mut().insert(handle, pair.server.clone());
        Response::from_websocket(pair.client)
    }

    async fn websocket_message(&self, ws: WebSocket, message: WebSocketIncomingMessage) -> Result<()> {
        let Some(h) = handle_of(&ws) else { return Ok(()) };
        let now = now_ms();
        let acts = self.with(|t| {
            let mut acts = t.sweep(now);
            match message {
                WebSocketIncomingMessage::Binary(b) => acts.extend(t.on_binary(h, &b, now)),
                WebSocketIncomingMessage::String(_) => acts.extend(t.on_text(h)),
            }
            acts
        });
        self.run(acts);
        self.report(now, false);
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
