//! The Cloudflare side of the cloud saves: the routes in front (checked origin, key to object name) and `Saves`, a Durable Object per player holding one save. The rules are in `save`.
//!
//! Routes (all POST with a text/plain body, so the browser sends them without a preflight and the key never travels in a URL):
//!   /save          `key \n cash \n blob`    store the save            -> 200 "ok" | 400 | 409 (wallet) | 413 | 429
//!   /save/driver   `key \n png data url`    store the driver picture   -> 200 "ok" | 400 | 413 | 429
//!   /save/get      `key`                    -> 200 {"t","cash","blob","driver"} | 404
//!   /save/delete   `key`                    delete everything of this key -> 200 "ok"
//! Every answer carries the CORS header for an allowed origin. Each write pushes the object's alarm back RETENTION_MS; when the alarm fires the object deletes everything it holds.

use crate::proto::origin_allowed;
use crate::save::{self, Refuse};
use crate::status::cors_origin;
use worker::wasm_bindgen::JsCast;
use worker::*;

fn now_ms() -> u64 {
    Date::now().as_millis()
}

/// The object of a key, made in the EU jurisdiction when the var says so (same rule and same by-hand call as the room, see glue.rs).
fn stub(env: &Env, name: &str) -> Result<Stub> {
    let ns = env.durable_object("SAVES")?;
    let jd = env.var("JURISDICTION").map(|v| v.to_string()).unwrap_or_default();
    if jd.is_empty() {
        return ns.id_from_name(name)?.get_stub();
    }
    let sub = worker::js_sys::Reflect::get(ns.as_ref(), &"jurisdiction".into())?
        .dyn_into::<worker::js_sys::Function>()?
        .call1(ns.as_ref(), &jd.into())?;
    let sub: ObjectNamespace = sub.unchecked_into();
    sub.id_from_name(name)?.get_stub()
}

fn reply(status: u16, body: &str, origin: Option<&str>, allowed: &str) -> Result<Response> {
    let mut r = Response::ok(body)?.with_status(status);
    let h = r.headers_mut();
    h.set("Content-Type", if body.starts_with('{') { "application/json" } else { "text/plain" })?;
    h.set("Cache-Control", "no-store")?;
    h.set("Vary", "Origin")?;
    if let Some(o) = cors_origin(origin, allowed) {
        h.set("Access-Control-Allow-Origin", o)?;
    }
    Ok(r)
}

/// The front: POST only, an allowed origin only, and the key must look like a key before an object is woken.
pub async fn handle(mut req: Request, env: &Env) -> Result<Response> {
    let allowed = env.var("ORIGINS").map(|v| v.to_string()).unwrap_or_default();
    let origin = req.headers().get("Origin")?;
    if !origin_allowed(origin.as_deref(), &allowed) {
        return Response::error("origin not allowed", 403);
    }
    if req.method() != Method::Post {
        return reply(405, "post only", origin.as_deref(), &allowed);
    }
    let path = req.url()?.path().to_string();
    let op = match path.as_str() {
        "/save" => "put",
        "/save/driver" => "driver",
        "/save/get" => "get",
        "/save/delete" => "delete",
        _ => return Response::error("not found", 404),
    };
    let body = req.text().await?;
    if body.len() > save::MAX_BLOB + save::MAX_DRIVER + 64 {
        return reply(413, "too big", origin.as_deref(), &allowed);
    }
    let key = body.split('\n').next().unwrap_or("");
    if !save::valid_key(key) {
        return reply(400, "bad key", origin.as_deref(), &allowed);
    }
    let mut init = RequestInit::new();
    init.with_method(Method::Post).with_body(Some(body.clone().into()));
    let inner = Request::new_with_init(&format!("https://save.internal/{op}"), &init)?;
    let mut res = stub(env, &save::object_name(key))?.fetch_with_request(inner).await?;
    let status = res.status_code();
    let text = res.text().await?;
    reply(status, &text, origin.as_deref(), &allowed)
}

#[durable_object]
pub struct Saves {
    state: State,
}

impl Saves {
    /// Stored as strings under four keys: "blob", "driver", "cash" and "t" (the time of the last write of the blob).
    async fn put(&self, body: &str) -> Result<(u16, String)> {
        let w = match save::parse_write(body) {
            Ok(w) => w,
            Err(Refuse::TooBig) => return Ok((413, "too big".into())),
            Err(_) => return Ok((400, "malformed".into())),
        };
        let st = self.state.storage();
        let now = now_ms();
        let old_t: Option<String> = st.get("t").await?;
        let old_cash: Option<String> = st.get("cash").await?;
        let gap = old_t.as_deref().and_then(|t| t.parse::<u64>().ok()).map(|t| now.saturating_sub(t));
        if gap.is_some_and(save::too_soon) {
            return Ok((429, "too soon".into()));
        }
        let old = match (old_cash.as_deref().and_then(|c| c.parse::<u64>().ok()), gap) {
            (Some(c), Some(g)) => Some((c, g)),
            _ => None,
        };
        if !save::wallet_ok(w.cash, old) {
            return Ok((409, "wallet".into()));
        }
        st.put("blob", w.blob.to_string()).await?;
        st.put("cash", w.cash.to_string()).await?;
        st.put("t", now.to_string()).await?;
        st.set_alarm(save::RETENTION_MS).await?;
        Ok((200, "ok".into()))
    }

    async fn driver(&self, body: &str) -> Result<(u16, String)> {
        let (_, png) = match save::parse_driver(body) {
            Ok(p) => p,
            Err(Refuse::TooBig) => return Ok((413, "too big".into())),
            Err(_) => return Ok((400, "malformed".into())),
        };
        let st = self.state.storage();
        st.put("driver", png.to_string()).await?;
        st.set_alarm(save::RETENTION_MS).await?;
        Ok((200, "ok".into()))
    }

    async fn get(&self) -> Result<(u16, String)> {
        let st = self.state.storage();
        let Some(blob) = st.get::<String>("blob").await? else { return Ok((404, "none".into())) };
        let t = st.get::<String>("t").await?.unwrap_or_else(|| "0".into());
        let cash = st.get::<String>("cash").await?.unwrap_or_else(|| "0".into());
        let driver = match st.get::<String>("driver").await? {
            Some(d) => serde_json::to_string(&d).unwrap_or_else(|_| "null".into()),
            None => "null".into(),
        };
        let t: u64 = t.parse().unwrap_or(0);
        let cash: u64 = cash.parse().unwrap_or(0);
        Ok((200, format!("{{\"t\":{},\"cash\":{},\"blob\":{},\"driver\":{}}}", t, cash, serde_json::to_string(&blob).unwrap_or_else(|_| "\"\"".into()), driver)))
    }

    async fn delete(&self) -> Result<(u16, String)> {
        let st = self.state.storage();
        st.delete_all().await?;
        st.delete_alarm().await?;
        Ok((200, "ok".into()))
    }
}

impl DurableObject for Saves {
    fn new(state: State, _env: Env) -> Self {
        Self { state }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let op = req.url()?.path().trim_start_matches('/').to_string();
        let body = req.text().await?;
        let (code, text) = match op.as_str() {
            "put" => self.put(&body).await?,
            "driver" => self.driver(&body).await?,
            "get" => self.get().await?,
            "delete" => self.delete().await?,
            _ => (404, "not found".into()),
        };
        Ok(Response::ok(text)?.with_status(code))
    }

    /// The retention alarm: nobody has written for RETENTION_MS, so everything goes.
    async fn alarm(&self) -> Result<Response> {
        self.state.storage().delete_all().await?;
        Response::ok("gone")
    }
}
