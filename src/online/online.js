// Online multiplayer, on by default (?p2p=off turns it off; the ?p2p name is the test and debug switch, kept from the first version): one WebSocket to the game's relay (relay-worker/), nothing else.
// The relay forwards each player's state to the players near them and tells us who they are (ENTER, LEAVE); players never learn each other's address.
// Write-up, protocol and numbers: docs/ONLINE.md. Frames: src/online/wire.js. The socket and its reconnecting: src/online/link.js. The address of the relay: src/online/relay-url.js.
// Nothing connects until the player says yes on the name card, which says what others can see. ?p2p in the address is the test mode: the debug box shows and a name is enough to join.
//
// The relay sends us the players within 400 m (the nearest 32 of them, and two beyond that so the maps are not empty) and tells us when the set changes. We hold up to maxTracked of them by handle (a number the
// relay gives each connection) and draw the nearest 32 (12 on a touch screen) as cars through src/remotes.js, the rest as a ring and a name on the maps, with the state prediction of src/predict.js: the sender sends a state
// only when its car leaves the path predict() draws from the last one sent. What we send is paced by our audience: the relay tells us how far the nearest player that holds us is, or that nobody does (see
// audienceD() and stateDue() below), because it thins what it forwards by each receiver's own distance and a player nobody receives needs to send almost nothing.
//
// Frames come from strangers by way of the relay: every one is validated by src/online/wire.js before it is used, every player has a rate limit, the relay as a whole has one, names are reduced
// to plain text and drawn on a canvas (never as HTML), and nothing in a frame decides how much memory is used: the table of players is capped.
import { createRemotes } from '../remotes.js';
import { predict } from '../predict.js';
import { getLang as lang } from '../lang.js';   // the language shown, 'it' | 'en' (src/lang.js)
import { PHRASES, CATEGORIES } from './phrases.js';
import { createWheel } from './wheel.js';
import { createPanel } from './panel.js';
import { zone } from '../hud.js';
import { createLink } from './link.js';
import { RELAY_URL } from './relay-url.js';
import { createReach, describe, TEXT } from './status.js';   // why there is nobody: the relay is full, over for today, or cannot be reached
import { IN, AUDIENCE_LOW, packInfo, helloFrame, infoFrame, sayFrame, toFrame, rosterFrame, stateFrame, readState, parseFrame, toBytes, cleanName as clean } from './wire.js';
import { garage, VEHICLES, LIVERIES } from '../garage.js';
import { townAt } from '../districts.js';
import { createGuide } from '../route-guide.js';
import { areaAt } from '../danger.js';
import { createBump, HIT as HIT_TYPE } from './bump.js';   // other players' cars bump ours (docs/ONLINE.md)
import { sfx } from '../sfx.js';
import { PLAYLOG_ON } from '../playlog.js';   // true once src/playlog-url.js has an address: the wording below then says what is saved

const TAU = Math.PI * 2;
const TRACK_SLACK = 8;         // players held at once: what the relay said it sends (K) and this much more, the room for an ENTER that comes before the LEAVE that makes space for it (16 for a relay that said 8)
const SHOWN_DESKTOP = 32, SHOWN_TOUCH = 12;   // cars drawn at once, the nearest; the others are held as a ring and a name on the maps. A phone with its CPU slowed 4 times drew 49 fps with 16 cars, 36 with 32 and 26 with 64 (docs/ONLINE-CROWD.md); a desktop 60 with 64
const RATE_PER_S = 40, RATE_BURST = 60;       // incoming states per player
const GLOBAL_PER_S = 640, GLOBAL_BURST = 1280; // incoming states from the relay altogether, each state in a batch counted: 64 players driving in a crowd send about 7 a second each, 450
const STALE_MS = 6000, STALE_PARKED_MS = 16000, STALE_FAR_MS = 20000;   // a player we hear nothing from for this long is taken off the street (its record stays: the relay says when it has left). A parked player is sent every 4 s, one beyond the radius every 5 s
const FORGET_MS = 90000;       // and one we hear nothing from for this long is forgotten, whatever the relay says
const HIDDEN_RETRY_MS = 600000;   // a page hidden for this long that becomes visible again asks the link to try once (src/online/link.js keeps those to one in ten minutes)
const IDLE_MS = 30000;        // a game that has not been played for this long (paused, in the Garage, a page in the background) lets go of the relay, which closes a socket that is silent for 60 s anyway
const CHECK_MS = 500;          // how often the players are ranked by distance
const INFO_GAP_MS = 2200;      // least time between two INFO frames (the relay allows one every 2 s)
const OFFER_R = 25, OFFER_TTL_MS = 15000, OFFER_GAP_MS = 10000, DRINK_PRICE = 1;   // metres to the receiver, how long an offer stands, least time between two, euro
const SAY_GAP_MS = 1500;       // least time between two phrases from one player (checked on both ends)
const SEND_NEAR = 100, SEND_MID = 200, SEND_FAR = 1000, SEND_AFAR = 2500; // state interval by distance to the receiver: < 150 m, < 350 m, < 1200 m, farther (the relay thins by the same bands)
// ms: the longest without a state. Moving: 1 s with an audience (the draw carries on past a state for 1.5 s, src/remotes.js), 4 s with none: only the relay's idea of where we are needs keeping. Still: 4 s with an audience (a receiver
// drops a still car after STALE_PARKED_MS), 15 s with none (the relay closes a socket that is silent for 60 s, and a ghost, a player whose page vanished without closing, stays in the relay for that long either way).
const KEEP_MOVING = 1000, KEEP_PARKED = 4000, KEEP_MOVING_NOBODY = 4000, KEEP_PARKED_NOBODY = 15000;
// how far the car may be from where the receiver draws it before a new state goes (close by; times the distance over DR_SCALE metres farther out): metres, radians, m/s. Measured in docs/ONLINE-CROWD.md: the position, heading and speed
// ones add 0.07 m to the 95th percentile of the drawn error. The roll one was 0.05: on the real game's own recorded roll, 0.075 is worth 4 % of the states and 0.1 another 2 %, and the roll drawn is off by 1.8 degrees at the 95th percentile either way (tools/online/netcompare.mjs).
const DR_POS = 0.3, DR_TH = 0.05, DR_V = 0.75, DR_STEER = 0.1, DR_ROLL = 0.075, DR_LEAN = 0.1, DR_H = 0.2, DR_SCALE = 25;
const DRAW_R = 400, DRAW_OUT = 480, SAY_R = 1000;   // SAY_R: how far a phrase is heard (the owner's 1 km, 21 Nov 2026); past DRAW_R it comes as a line with the name, no bubble (IN.SAY_FAR)   // DRAW_R, DRAW_OUT: metres, a player farther than this is a dot with a name on the maps, not a car (fades in again inside DRAW_R)

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapPI = a => a - TAU * Math.floor((a + Math.PI) / TAU);

export function createOnline(env) {
  const { car, game, vehicle } = env;
  const params = new URLSearchParams(location.search);
  const num = (k, d, lo, hi) => { const v = parseFloat(params.get(k)); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  // ?relay=wss://... points a test at another relay (a local one). Only a page served from this machine listens to it: on the real site the address in src/online/relay-url.js is the only one.
  const localPage = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const override = localPage ? params.get('relay') : null;
  const relayUrl = override && /^wss?:\/\/[\w.:-]+(\/[\w./-]*)?$/.test(override) ? override : RELAY_URL;
  const IDLE = num('idlems', IDLE_MS, 1000, 600000);   // ?idlems=N: for the tests
  const log = [];   // timing events for the measurements: { t, ev, ... }
  const ev = (name, o) => { const e = { t: Math.round(performance.now()), ev: name, ...o }; log.push(e); if (log.length > 2000) log.shift(); };

  const STORE_KEY = 'palermoDrive.net.v1';   // the saved { name, offline }, shared with the Garage's driver screen; the key keeps the name of the first relay client so that nobody's saved name is lost
  const stored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  let myName = clean(params.get('name') || stored().name || '');
  let named = !!myName;
  // ?p2p skips the name card, so it works only on a page served from this machine. On the real site a link someone sends you must not put you online (your name and position visible to others, your address seen by the relay) without the card.
  const testing = params.has('p2p') && localPage;
  // nothing is joined until the player has a name and has answered the card. The card asks on every page open, online or solo: only the name is remembered, never the answer.
  let agreed = testing;
  const screenshots = !testing && ['clean', 'fixres'].some(k => params.has(k));   // the comparison shots and benches run with no card over the picture
  const saveStore = o => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...stored(), ...o })); } catch (e) { /* private mode: fine */ } };
  if (!myName) myName = 'Player';
  // the Garage's driver screen (src/garage-ui.js) edits the same stored name and says so with a 'pd-name' event; take it over
  const urlName = !!params.get('name');
  const refreshName = () => { if (urlName) return; const n = stored().name, c = typeof n === 'string' ? clean(n) : ''; if (c && c !== myName) { myName = c; named = true; } };
  addEventListener('pd-name', refreshName);
  const vehId = () => Math.max(0, VEHICLES.findIndex(v => v.id === car.type));   // the night race's sulky is not a garage vehicle: it goes out as the default
  const livId = () => Math.max(0, (LIVERIES[VEHICLES[vehId()].id] || []).findIndex(l => l.id === car.livery));   // a custom colour is not in the list: the first one

  const rm = createRemotes(env);
  const others = new Map();   // handle -> { handle, name, vehicle, livery, lastRx, x, z, tokens, tokT, shown, held, far, near, fts, infoKey, infoAt, lastSay, lastOffer, mutedUntil, lastHello }
  const stats = { tx: 0, txBytes: 0, rx: 0, rxBytes: 0, rxBad: 0, rxDropped: 0, rxDup: 0, enters: 0, leaves: 0, threw: 0, connects: 0, drops: 0, batches: 0, states: 0, audience: 0, rxMs: 0, updMs: 0, updN: 0 };
  let ready = false, selfHandle = 0, onlineCount = 0;   // ready: the relay has answered our HELLO
  let maxTracked = 16, relayVer = 0;                   // set by WELCOME: the players the relay will send and the protocol it speaks
  let audience = null;                                  // the band the relay last told us (AUDIENCE): 0 nobody holds us, 1 to 8 how far the nearest holder is; null until told, and always on a relay of protocol 2
  // ?k=N and ?shown=N: for the tests, on a page served from this machine only. The set size we ask for (the relay cuts it to 64) and the cars drawn.
  const WANT_K = localPage ? Math.round(num('k', 0, 0, 64)) : 0, SHOWN_TEST = localPage ? Math.round(num('shown', 0, 0, 64)) : 0;
  const shownCap = () => SHOWN_TEST || (document.documentElement.classList.contains('touch') ? SHOWN_TOUCH : SHOWN_DESKTOP);
  let started = false, lastChecked = -1e9, activeAt = -1e9;

  // ---------- HUD (debug) ----------
  // In the HUD's status zone, under the slim music bar top left (src/hud.js), so the bar never covers it; the body if that zone is missing.
  const hud = document.createElement('div');
  hud.style.cssText = 'padding:4px 8px;border-radius:6px;background:rgba(13,7,9,.8);color:#fff;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre-wrap;max-width:min(560px,92vw)';
  if (testing) { const z = zone('status'); if (z) z.appendChild(hud); else { hud.style.cssText += ';position:fixed;z-index:30;left:8px;top:60px'; document.body.appendChild(hud); } }

  // the Garage draws its own screen and the main loop skips the frame (so update() below does not run): the buttons are hidden by a rule that follows the page, not by a frame
  const css = document.createElement('style'); css.textContent = 'html.pd-in-garage .pd-online{display:none!important}@keyframes pd-online-bar{from{width:100%}to{width:0}}.pd-online-bar{animation:pd-online-bar ' + OFFER_TTL_MS + 'ms linear forwards}'; document.head.appendChild(css);

  // ---------- the link ----------
  // After a socket fails the relay may be asked why, at most once per attempt (src/online/status.js): never while connected, never while the link is stopped, never for a daily reason already known. A daily reason
  // (the day's allowance, or this address's share) is passed on to the link, which then waits for 00:00 UTC (src/online/link.js); any other answer, or none, leaves it on its own timer.
  const whyNot = createReach({ url: relayUrl, onChange: s => { if (s) link.daily(s === 'quota' || s === 'budget'); } });
  const link = createLink({
    url: relayUrl,
    onFail: info => { ev('fail', { code: info.code }); whyNot.failed(info); },
    onOpen() { whyNot.opened(); stats.connects++; ev('open'); tx(helloFrame(packInfo(vehId(), livId(), myName), WANT_K)); sentInfoKey = infoKey(); infoAt = performance.now(); },
    onFrame: testing ? d => { const t = performance.now(); onFrame(d); stats.rxMs += performance.now() - t; } : onFrame,   // with ?p2p on a local page: the time spent in handling frames, for tools/online/pagecrowd.mjs
    onClose() { stats.drops++; ev('close'); forgetAll(); },
  });
  function tx(frame) { if (!link.send(frame)) return false; stats.tx++; stats.txBytes += frame.length; return true; }
  const bumpOn = params.get('bump') !== 'off';   // ?bump=off: cars of other players are only drawn (tests)
  const bump = createBump({ send: (id, bytes) => others.has(id) && tx(toFrame(id, bytes)), crunch: k => sfx('crunch', k) });
  // everything about the others goes when the link does: a car on the street whose player the relay can no longer vouch for is a ghost
  function forgetAll() {
    panel.clear(); wheel.close();
    for (const p of others.values()) if (p.shown) rm.remove(p.handle);
    others.clear(); myOffer = null; incoming = null; closeCard(); note(null);
    ready = false; selfHandle = 0; last = null; forceState = false; audience = null; relayVer = 0; roster = null;
  }

  // ---------- outgoing ----------
  const infoKey = () => myName + '|' + vehId() + '|' + livId();
  let sentInfoKey = '', infoAt = -1e9;
  function sendInfo(now) {   // the name, vehicle or livery changed: once, and not faster than the relay allows
    const key = infoKey(); if (key === sentInfoKey || now - infoAt < INFO_GAP_MS) return;
    if (tx(infoFrame(packInfo(vehId(), livId(), myName)))) { sentInfoKey = key; infoAt = now; }
  }
  // what the car is doing, for the prediction the receiver makes: how fast the heading turns and the speed changes, smoothed over about 80 ms of frames
  const kin = { t: 0, th: 0, v: 0, w: 0, a: 0 };
  function trackKin(now) {
    const dt = (now - kin.t) / 1000, v = car.vf || 0;
    if (kin.t && dt > 0 && dt < 0.5) { const f = Math.min(1, dt / 0.08); kin.w += (wrapPI(car.th - kin.th) / dt - kin.w) * f; kin.a += ((v - kin.v) / dt - kin.a) * f; } else { kin.w = 0; kin.a = 0; }
    kin.t = now; kin.th = car.th; kin.v = v;
  }
  const flagsNow = lift => (car.nosAmt > 0.15 ? 1 : 0) | (car.braking ? 2 : 0) | (car.drift > 0.3 ? 4 : 0) | (lift ? 8 : 0);
  const liftNow = () => car.lift > 0.6 ? Math.min(1000, car.lift) : 0;
  function carState(now) {
    const v = car.vf || 0;
    return { t: now, x: car.x, z: car.z, th: car.th, v, steer: car.steer || 0, roll: car.roll || 0, lean: car.lean || 0, fl: flagsNow(0), k: Math.abs(v) > 1 ? kin.w / v : 0, a: kin.a, h: liftNow() };
  }
  // The relay thins what it forwards by the distance between each receiver and us, so the pace we need is the nearest receiver's. We know only our own set, the players the relay sends us,
  // not who has us in theirs, but those are almost the same: anybody not in our set is farther than everybody in it, so the nearest one of ours has the highest need of anybody who gets us. A player whose
  // position we have not heard yet counts as close (it may be); with nobody at all the far pace keeps us known to the relay, so that a player who arrives near us finds us.
  function nearest() {
    let d = Infinity;
    for (const p of others.values()) { const q = Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : 0; if (q < d) d = q; }
    return d;
  }
  // The distance the pace is set for. With an audience told by the relay (protocol 3) it is the lower edge of the band of the nearest player that holds us, and Infinity for nobody; it is what the relay thins by,
  // which our own set is only a guess at (a player we hold may not hold us, and one that holds us may be one we do not hold). Without it, the old guess.
  const audienceD = () => audience === null ? nearest() : AUDIENCE_LOW[audience];
  let last = null, forceState = false;   // the last state sent, as the receiver reads it back (its t is our clock); a newcomer is owed one at once
  // does the receiver need a state now: the car is no longer where predict() puts it from the last one sent, or it is time for the keepalive
  function stateDue(now, d) {
    if (!last) return true;
    const age = now - last.t, band = d < 150 ? SEND_NEAR : d < 350 ? SEND_MID : d < 1200 ? SEND_FAR : SEND_AFAR;
    if (age < SEND_NEAR - 5) return false;
    if (forceState) return true;
    if (age < band - 5) return false;
    const v = car.vf || 0, moving = Math.abs(v) > 0.2 || Math.abs(last.v) > 0.2;
    const nobody = audience === 0, keep = moving ? (nobody ? KEEP_MOVING_NOBODY : KEEP_MOVING) : (nobody ? KEEP_PARKED_NOBODY : audience === null ? 2000 : KEEP_PARKED);   // 2 s on a relay that does not tell us: the old rule
    if (age >= Math.max(band, keep)) return true;
    const f = Math.max(1, d / DR_SCALE), pr = predict(last, Math.min(age, 1500) / 1000), lift = liftNow();
    // the body (steer, roll, lean) is judged by the same distance as the path: it is a few pixels at 150 m. The lights (nitro, brake, drift) and a height are not, but nobody holding us asks for none of it.
    return Math.hypot(car.x - pr.x, car.z - pr.z) > DR_POS * f || Math.abs(wrapPI(car.th - pr.th)) > DR_TH * f || Math.abs(v - pr.v) > DR_V * f
      || Math.abs((car.steer || 0) - last.steer) > DR_STEER * f || Math.abs((car.roll || 0) - last.roll) > DR_ROLL * f || Math.abs((car.lean || 0) - last.lean) > DR_LEAN * f
      || (!nobody && (flagsNow(lift) !== (last.fl | (last.h ? 8 : 0)) || Math.abs(lift - last.h) > DR_H));
  }
  function sendState(now) {
    if (!ready || game.state !== 'play' || !stateDue(now, audienceD())) return;
    const f = stateFrame(carState(now));
    if (tx(f)) { last = { ...readState(f, 1), t: now }; forceState = false; }
  }

  // ---------- incoming (untrusted) ----------
  const newPlayer = handle => ({ handle, name: '', vehicle: 'calessino', livery: 0, lastRx: performance.now(), x: NaN, z: NaN, tokens: RATE_BURST, tokT: performance.now(), shown: false, held: undefined, far: false, near: false, fts: -1, infoKey: '', infoAt: -1e9 });
  function admit(p, now) {   // token bucket per player
    p.tokens = Math.min(RATE_BURST, p.tokens + (now - p.tokT) * RATE_PER_S / 1000); p.tokT = now;
    if (p.tokens < 1) return false; p.tokens--; return true;
  }
  const bucket = { tokens: GLOBAL_BURST, t: performance.now() };
  function takeGlobal(now) {
    bucket.tokens = Math.min(GLOBAL_BURST, bucket.tokens + (now - bucket.t) * GLOBAL_PER_S / 1000); bucket.t = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens--; return true;
  }
  function onFrame(data) {   // a frame from the relay. Whatever is in it, nothing here may throw: the game's frame loop and the socket's handler are the callers
    const now = performance.now(); stats.rx++;
    // the whole relay's bucket is taken per state: here for every frame but a batch (which takes one for each of its states, in route())
    const first = toBytes(data); if (!first || first[0] !== IN.BATCH) { if (!takeGlobal(now)) { stats.rxDropped++; return; } }
    try { route(data, now); } catch (e) { stats.threw++; }
  }
  function route(data, now) {
    const b = toBytes(data), f = parseFrame(b);
    if (!f) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (f.type === IN.WELCOME) {
      if (ready) { stats.rxBad++; return; }   // one answer to one HELLO
      ready = true; selfHandle = f.handle; onlineCount = f.online; last = null; relayVer = f.version; maxTracked = f.k + (f.version === 3 ? TRACK_SLACK : 8); ev('welcome', { handle: f.handle, online: f.online, k: f.k });
      return;
    }
    if (!ready) { stats.rxBad++; return; }   // nothing else means anything before that
    if (f.type === IN.ONLINE) { onlineCount = f.online; return; }
    if (f.type === IN.ROSTER) { roster = f.list; onlineCount = f.online; rosterGot = performance.now(); return; }
    if (f.type === IN.AUDIENCE) {   // how far the nearest holder is: a nearer one than before, or the first, is owed a state at once (it holds our latest, possibly old, from its ENTER)
      if (relayVer < 3) { stats.rxBad++; return; }
      if (f.band !== 0 && (audience === null || audience === 0 || f.band < audience)) forceState = true;
      audience = f.band; stats.audience++; return;
    }
    if (f.type === IN.BATCH) {   // each state of a batch is a state: it has the player's own bucket and takes a token of the whole relay's, so a batch is no way round either limit
      if (relayVer < 3) { stats.rxBad++; return; }
      stats.batches++;
      for (const e of f.entries) {
        const q = others.get(e.handle);
        if (!q) { stats.rxDropped++; continue; }
        if (!takeGlobal(now) || !admit(q, now)) { stats.rxDropped++; continue; }
        stats.states++; onState(q, e.s, now);
      }
      return;
    }
    if (f.type === IN.SAY_FAR) return onSayFar(f, now);
    if (f.type === IN.ENTER) return onEnter(f, now);
    if (f.type === IN.LEAVE) return onLeave(f.handle);
    const p = others.get(f.handle);
    if (!p) { stats.rxDropped++; return; }   // a handle the relay has not introduced (or one it let go of a moment ago)
    if (!admit(p, now)) { stats.rxDropped++; return; }
    if (f.type === IN.STATE) { stats.states++; onState(p, f.s, now); }
    else if (f.type === IN.SAY) onSay(p, f.phrase, now);
    else if (f.direct[0] === HIT_TYPE) bump.receive(car, rm.remotes.get(p.handle), f.direct, now);
    else onOffer(p, f.direct, now);
  }
  // ENTER: a player is now one of ours, or one of ours changed its info (a repeated ENTER with nothing new is nothing)
  function onEnter(f, now) {
    if (f.handle === selfHandle) { stats.rxBad++; return; }
    let p = others.get(f.handle);
    if (!p) {
      if (others.size >= maxTracked) { stats.rxDropped++; return; }
      p = newPlayer(f.handle); others.set(f.handle, p); stats.enters++; if (relayVer < 3) forceState = true; ev('enter', { handle: f.handle });   // protocol 2: a newcomer in our set is owed a state at once, the guess that it holds us too; protocol 3 tells us who holds us (AUDIENCE)
    }
    const key = f.info.vehicle + '|' + f.info.livery + '|' + f.info.name;
    if (key === p.infoKey) return;
    if (p.infoKey && now - p.infoAt < INFO_GAP_MS * 0.4) { stats.rxDropped++; return; }   // faster than a real client changes its name
    p.infoKey = key; p.infoAt = now;
    const v = VEHICLES[f.info.vehicle] || VEHICLES[0];   // untrusted: an unknown vehicle is the lapa, an unknown livery its first
    p.vehicle = v.id; p.livery = f.info.livery < LIVERIES[v.id].length ? f.info.livery : 0; p.name = f.info.name || 'Player';
    if (p.shown) rm.setInfo(rm.remotes.get(p.handle), p.name, p.livery, p.vehicle);
  }
  function onLeave(handle) {
    const p = others.get(handle); if (!p) return;
    if (p.shown) rm.remove(handle);
    others.delete(handle); stats.leaves++; ev('leave', { handle });
  }
  function onState(p, s, now) {
    if (p.fts >= 0) { const d = (s.t16 - p.fts) & 0xffff; if (d === 0 || d > 32768) { stats.rxDup++; return; } p.fts += d; } else p.fts = s.t16;   // older than the last one (or the same): dropped
    s.t = now; s.ts = p.fts;
    place(p, now, s);
  }
  function place(p, now, s) {   // a valid state from player p: kept for the ranking, a car if p is one of the nearest, a ring and a name on the maps if not
    p.x = s.x; p.z = s.z; p.lastRx = now; p.h = s.h; p.parked = Math.abs(s.v) < 0.2;
    if (!p.shown) {
      rank(now);   // a newcomer is ranked before anything is built for it: thirty players arriving together must not all become cars for an instant
      p.shown = true; p.far = p.held === false || Math.hypot(s.x - car.x, s.z - car.z) > DRAW_R;
      const r = rm.ensure(p.handle); rm.setFar(r, p.far); rm.setInfo(r, p.name || 'Player', p.livery, p.vehicle);
      ev('firstState', { handle: p.handle });
    }
    const rem = rm.remotes.get(p.handle); if (rem) rm.addSnap(rem, s);
  }

  // A phrase reaches the players who can see our car: within DRAW_R metres (the range at which another player is drawn as a car and not a ring on the maps). The relay forwards it to those near, and a receiver
  // checks its own distance too, since a frame comes from a stranger: past that range there is no bubble, no line and no sound.
  const staleMs = p => p.far ? STALE_FAR_MS : p.parked ? STALE_PARKED_MS : STALE_MS;
  const reach = p => !!(p && p.held !== false && Number.isFinite(p.x) && performance.now() - p.lastRx < staleMs(p) && Math.hypot(p.x - car.x, p.z - car.z) <= DRAW_R);
  const inReach = () => { let n = 0; for (const p of others.values()) if (reach(p)) n++; return n; };
  // for a phrase: anyone we know of within SAY_R (the relay sends us the nearest players beyond DRAW_R too, so if anybody is within 1 km we know one of them)
  const inSayReach = () => { for (const p of others.values()) if (Number.isFinite(p.x) && performance.now() - p.lastRx < STALE_FAR_MS && Math.hypot(p.x - car.x, p.z - car.z) <= SAY_R) return true; return false; };
  const SAID = { it: 'rici', en: 'said' };   // "izzy rici “ciao curò”": the owner's spelling (7 Nov: rici, not dici)
  function onSay(p, phrase, now) {
    if (now - (p.lastSay || -1e9) < SAY_GAP_MS * 0.8) { stats.rxDropped++; return; }
    const rem = rm.remotes.get(p.handle); if (!rem) return;   // only players we can see
    if (!p.shown || !Number.isFinite(p.x) || Math.hypot(p.x - car.x, p.z - car.z) > DRAW_R) { stats.rxDropped++; return; }   // too far to be a car on our street: not for us
    p.lastSay = now; rm.say(rem, PHRASES[phrase], now); panel.line(p.name || 'Player', SAID[lang()], PHRASES[phrase], false); chirp('say');
  }
  // a phrase from up to SAY_R away, from a player we do not see as a car: a line with the name only. The relay keeps the pace (one a second); this keeps a stranger's flood out too
  const farSaid = new Map();
  function onSayFar(f, now) {
    if (now - (farSaid.get(f.handle) || -1e9) < SAY_GAP_MS * 0.8 || !takeGlobal(now)) { stats.rxDropped++; return; }
    farSaid.set(f.handle, now); if (farSaid.size > 64) farSaid.delete(farSaid.keys().next().value);
    panel.line(f.info.name || 'Player', SAID[lang()], PHRASES[f.phrase], false); chirp('say');
  }
  let lastSaid = -1e9;
  function say(idx) {
    const now = performance.now(); if (!(idx >= 0 && idx < PHRASES.length) || now - lastSaid < SAY_GAP_MS) return false;
    if (!inSayReach() || !tx(sayFrame(idx))) { toast(tr('Nessuno vicino', 'Nobody close enough'), tr('Entro 1 km', 'Within 1 km'), true); return false; }
    lastSaid = now;
    panel.line(myName, SAID[lang()], PHRASES[idx], true);   // what you said, in the same form as on their screens (the bubble is over your car on theirs)
    return true;
  }
  // the talk wheel (src/online/wheel.js): the talk button of the multiplayer section (src/online/panel.js) or the T key opens it; categories first, then the phrases of one. The wheel is built from the
  // fixed lists in src/online/phrases.js, so what it can send is exactly what the receiver accepts.
  const wheelLang = () => lang() === 'en' ? 'en' : 'it';
  const wheel = createWheel({
    categories: [],   // filled by buildWheel (the language and the offers are read when it opens)
    backLabel: () => wheelLang() === 'en' ? 'back' : 'indietro', closeLabel: () => wheelLang() === 'en' ? 'close' : 'chiudi',
    onClose: () => { panel.talk.blur(); },
  });
  const KIND_NAME = { it: ['Offri un cicchetto', 'Offri una birra'], en: ['Offer a cicchetto', 'Offer a beer'] };
  function buildWheel() {
    const l = wheelLang();
    return CATEGORIES.map(c => ({
      label: c[l], icon: c.icon,
      items: [...c.phrases.map(i => ({ label: PHRASES[i], onPick: () => say(i) })), ...(c.drinks || []).map(k => ({ label: KIND_NAME[l][k], tag: priceTag(), onPick: () => { offer(k); } }))],
    }));
  }
  const online = () => named && agreed;   // the player said yes (the name card, or Online in Options) and has not gone solo since
  function openWheel() {
    if (!inSayReach()) { toast(tr('Nessuno vicino', 'Nobody close enough'), tr('Entro 1 km', 'Within 1 km'), true); return; }
    wheel.setCategories(buildWheel()); wheel.open();
  }
  const toggleWheel = () => { if (wheel.isOpen) wheel.close(); else openWheel(); };
  // ---------- the Online list: everybody connected, with the neighbourhood and how far, and Raggiungi (a jump there, as the start map does) ----------
  // The relay answers a ROSTER with everybody's position in 50 m squares (relay-worker/src/proto.rs): asked when the list opens and every ROSTER_EVERY_MS while it is open.
  // A player we hold has its exact position, the others the square's. Raggiungi: not near (DRAW_R), not during a mission, and once per JUMP_GAP_MS.
  const ROSTER_EVERY_MS = 5000, JUMP_GAP_MS = 30000;
  let listOpen = false, listPaused = false, roster = null, rosterAsked = -1e9, rosterGot = 0, lastJump = -1e9, listAt = 0;
  // Segui: a blue way on the minimap to a player we hold (within DRAW_R), kept up to date as they move (src/route-guide.js on the traffic graph, as a mission's leg without a baked route).
  // The same button stops it; it stops by itself, with a line on screen, when the player goes past DRAW_OUT or leaves. Raggiungi follows the player once we are there.
  const followRoute = env.followRoute || [];
  const fguide = createGuide({ car, mapRoute: followRoute, graph: () => env.traffic && env.traffic.graph });
  let following = 0, followAt = { x: 0, z: 0 }, followClock = 0, pendingFollow = 0, pendingUntil = 0;
  const askRoster = now => { if (relayVer >= 3 && now - rosterAsked > 3100 && tx(rosterFrame())) rosterAsked = now; };
  const missionOn = () => inMission();   // (defined below with the drinks; a pub, a rave or a leaf is not a mission here either)
  const placeOf = (x, z) => townAt(x, z) || areaAt(x, z) || 'Palermo';
  const distText = d => d < 1000 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0).replace('.', lang() === 'en' ? '.' : ',')} km`;
  function rosterEntries() {
    const out = [];
    if (!roster) {   // the relay has not answered yet: the players we already hold, at once (the list opens first, the rest comes in)
      for (const p of others.values()) if (p.x !== undefined && p.name) { const v = VEHICLES.findIndex(q => q.id === p.vehicle); out.push({ e: { handle: p.handle, info: { name: p.name, vehicle: Math.max(0, v) } }, x: p.x, z: p.z, d: Math.hypot(p.x - car.x, p.z - car.z) }); }
      return out.sort((a, b) => a.d - b.d);
    }
    for (const e of roster) {
      if (e.handle === selfHandle) continue;
      const p = others.get(e.handle), exact = p && p.x !== undefined && performance.now() - p.lastRx < 10000;
      const x = exact ? p.x : e.x, z = exact ? p.z : e.z;
      out.push({ e, x, z, d: Math.hypot(x - car.x, z - car.z) });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  function listView(now) {
    const en = lang() === 'en', wait = Math.ceil((JUMP_GAP_MS - (now - lastJump)) / 1000), ents = rosterEntries();
    return {
      open: true,
      empty: roster || onlineCount <= 1 ? (en ? 'Nobody else is online right now.' : 'Nessun altro è online adesso.') : (en ? 'Asking who is online…' : 'Cerco chi è online…'),
      rows: ents.map(({ e, x, z, d }) => {
        const near = d < DRAW_R, v = VEHICLES[e.info.vehicle] || VEHICLES[0];
        const fol = following === e.handle, go = fol || near || (!missionOn() && wait <= 0);
        return { h: e.handle, name: e.info.name || 'Player', veh: en ? v.name_en : v.name_it, place: placeOf(x, z), dist: near ? (en ? 'Near you' : 'Vicino a te') : distText(d), near,
          go, kind: fol ? 'stop' : near ? 'follow' : wait > 0 ? 'wait' : 'join', goLabel: fol ? (en ? 'Stop' : 'Smetti') : near ? (en ? 'Follow' : 'Segui') : wait > 0 ? `${wait} s` : (en ? 'Join' : 'Raggiungi'), fol };
      }),
    };
  }
  // the list does not pause the game (the owner, 21 Nov 2026: the side menu pauses, the players list does not)
  function closeList(resume = true) {
    if (!listOpen) return;
    listOpen = false; panel.setList({ open: false });
    if (listPaused) { listPaused = false; game.hold = false; if (resume && game.state === 'pause') game.resume(); dispatchEvent(new Event('pd-state')); }
  }
  function toggleList() {
    if (listOpen) { closeList(); return; }
    if (!ready || game.state !== 'play') return;
    listOpen = true; if (wheel.isOpen) wheel.close();
    askRoster(performance.now());
    panel.setList(listView(performance.now()));
  }
  function followTarget(h) { const p = others.get(h); return p && p.x !== undefined && performance.now() - p.lastRx < 8000 ? p : null; }
  function startFollow(h) {
    const p = followTarget(h); if (!p) { toast(tr('Non lo vedo ancora', 'Not in sight yet'), tr('Riprova tra un attimo', 'Try again in a moment'), true); return false; }   // in the list but not yet among the players the relay sends us (a tap that did nothing said nothing)
    following = h; followAt.x = p.x; followAt.z = p.z; followClock = 0; fguide.to(p.x, p.z);
    toast(tr(`Segui ${p.name || 'Player'}`, `Following ${p.name || 'Player'}`), tr('La strada blu sulla mappa', 'The blue way on the map'));
    ev('follow', { handle: h }); return true;
  }
  function stopFollow(why) {
    if (!following) return;
    const p = others.get(following), n = (p && p.name) || 'Player';
    following = 0; fguide.off();
    if (why === 'far') toast(tr(`${n} è troppo lontano`, `${n} is too far away`), tr('Non lo segui più', 'No longer following'), true);
    else if (why === 'gone') toast(tr(`${n} è andato via`, `${n} has left`), tr('Non lo segui più', 'No longer following'), true);
    ev('unfollow', { why });
  }
  function followTick(dt, now) {
    if (pendingFollow && now > pendingUntil) pendingFollow = 0;
    if (pendingFollow && game.state === 'play') { const p = followTarget(pendingFollow); if (p && Math.hypot(p.x - car.x, p.z - car.z) < DRAW_R) { const h = pendingFollow; pendingFollow = 0; startFollow(h); } }
    if (!following) return;
    const p = followTarget(following);
    if (!others.has(following)) return stopFollow('gone');
    if (!p || Math.hypot(p.x - car.x, p.z - car.z) > DRAW_OUT) return stopFollow('far');
    followClock += dt;
    if (followClock > 1 && Math.hypot(p.x - followAt.x, p.z - followAt.z) > 20) { followClock = 0; followAt.x = p.x; followAt.z = p.z; fguide.to(p.x, p.z); }   // the way again when they have moved on
    fguide.update(dt);
  }
  function followToggle(h) { if (following === h) stopFollow(''); else { stopFollow(''); startFollow(h); } panel.setList(listView(performance.now())); }
  function joinPlayer(h) {
    const now = performance.now(), it = rosterEntries().find(r => r.e.handle === h); if (!it) return;
    if (it.d < DRAW_R || following === h) { followToggle(h); return; }   // near: Segui / Smetti
    if (missionOn()) { toast(tr('Prima finisci la missione', 'Finish the mission first'), '', true); return; }
    if (now - lastJump < JUMP_GAP_MS || it.d < DRAW_R || !game.goTo) return;
    lastJump = now; closeList(false);   // (the jump's own transition resumes the game)
    ev('join', { handle: h, d: Math.round(it.d) }); stopFollow(''); pendingFollow = h; pendingUntil = now + 30000;   // once there, follow them
    game.goTo(it.x, it.z);
  }
  const panel = createPanel({ zone: zone('social'), onTalk: toggleWheel, onList: toggleList, onGo: joinPlayer });
  addEventListener('pointerdown', e => { if (listOpen && !panel.root.contains(e.target)) closeList(); }, true);   // a tap anywhere else folds the list away (and still does what it was for: the pads keep driving)
  // T opens and closes it, 1 to 8 pick, Escape closes: in the capture phase, ahead of the game's own handler (src/ui.js adds its listener later)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const typing = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    if (typing || nameCard) return;
    if (listOpen && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeList(); return; }
    if (card && (e.code === 'KeyY' || e.code === 'KeyN')) { e.preventDefault(); e.stopImmediatePropagation(); answer(e.code === 'KeyY'); return; }   // N is the radio's key too: the card has it first
    if (e.code === 'KeyT' && online() && game.state === 'play') { e.preventDefault(); e.stopImmediatePropagation(); toggleWheel(); return; }
    if (!wheel.isOpen) return;
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') wheel.close(); else wheel.back(); }
    else if (/^(Digit|Numpad)[1-8]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); wheel.pick(+e.code.slice(-1) - 1); }
  }, true);
  // ---------- a drink for somebody close by ----------
  // Giver: picks cicchetto or birra, the nearest visible player within OFFER_R gets an OFFER and a card with Accetta / Un mi va. On ACCEPT the
  // giver pays DRINK_PRICE from the Garage wallet and sends CONFIRM; only then does the receiver get the drink (drunk.gift). Nothing happens to
  // anybody without their own yes, and every message is checked like the others.
  // Both sides always hear how it went: the giver gets a line for every outcome (accepted, no, busy, had enough, too far, gone, no answer, no money),
  // the receiver gets the card (who, what, and how dizzy it makes them) and a line if the drink does not arrive. REPLY [7][code][offer id] carries
  // the refusals. Against harassment: one card at a time, the giver waits OFFER_GAP_MS between offers, a player who said no (or let the card run out)
  // is not shown another card from the same player for MUTE_MS, and a card closes by itself when its giver leaves, walks off or the game pauses.
  const KIND_TXT = { it: ['un cicchetto', 'una birra'], en: ['a cicchetto', 'a beer'] };   // wording to be corrected by the owner
  const tr = (it, en) => lang() === 'en' ? en : it;
  const TOAST_IDX = PHRASES.indexOf('a to saluti!');
  const FAR_R = OFFER_R * 1.6, MUTE_MS = 60000, ACCEPT_GRACE_MS = 2500, CONFIRM_WAIT_MS = 5000;
  // Two rounds are free for every browser, so that a new player (an empty wallet) can offer. The count is saved here on its own and goes down when a drink is
  // paid for, so a reload does not bring a round back; with no storage there are none.
  const FREE_KEY = 'palermoDrive.p2pFree.v1', FREE_ROUNDS = 2;
  const freeLeft = () => { try { const v = localStorage.getItem(FREE_KEY); if (v === null) return FREE_ROUNDS; const n = parseInt(v, 10); return Number.isFinite(n) ? clamp(n, 0, FREE_ROUNDS) : 0; } catch (e) { return 0; } };
  const useFree = () => { const n = freeLeft(); if (n <= 0) return false; try { localStorage.setItem(FREE_KEY, String(n - 1)); return localStorage.getItem(FREE_KEY) === String(n - 1); } catch (e) { return false; } };
  const priceTag = () => freeLeft() > 0 ? tr('gratis', 'free') : '€' + DRINK_PRICE;
  const R_NO = 0, R_BUSY = 1, R_ENOUGH = 2, R_FAR = 3, R_BROKE = 4, R_WALKED = 5, R_HELD = 6;   // REPLY codes: 0 to 3 receiver to giver (no, busy, had enough, you are too far from me), 4 and 5 giver to receiver after their yes (cannot pay, you walked off), 6 receiver to giver: on a mission, the card comes when it ends
  // In a timed mission (a fare, food, a race, the horns: not the pub errand, the leaves or the rave, where a drink belongs) no card is put on the screen. The offer is held for HOLD_MS; when the mission is over (and the result has had its moment) the card shows if the giver is still near and the offer still stands, otherwise the giver is told the player is busy.
  const HOLD_MS = num('holdms', 120000, 1000, 600000), CALM_MS = 3000;   // ?holdms=N: for the tests
  let busyForce = null;   // test seam (tools/online/held.mjs)
  const inMission = () => { if (busyForce !== null) return busyForce; const m = env.missions; if (!m || !m.busy || !m.busy()) return false; const k = m.state && m.state.ev && m.state.ev.slot && m.state.ev.slot.kind; return k !== 'pub' && k !== 'rave' && k !== 'leaf'; };
  let myOffer = null, lastOfferAt = -1e9, incoming = null, offerSeq = 0, card = null, pill = null;
  const toast = (text, sub, neg, ms) => dispatchEvent(new CustomEvent('pd-toast', { detail: { text, sub, neg, ms } }));   // the game's own line at the top of the screen (src/event-hud.js); ms: longer than the usual, for a sentence
  const nameOf = id => { const p = others.get(id); return (p && p.name) || 'Player'; };
  const here = id => { const p = others.get(id); return !!(p && p.shown && rm.remotes.get(id)); };   // somebody we can see on the street
  const dist = id => { const p = others.get(id); return p && Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : Infinity; };
  const sendOffer = (id, bytes) => others.has(id) && tx(toFrame(id, bytes));   // a drink's messages go to one player by handle, and the relay passes them on only if that player is near
  const reply = (id, offerId, code) => sendOffer(id, new Uint8Array([7, code, offerId]));
  // what the giver waits for: a line under the buttons until the answer comes (a toast only lasts two seconds)
  function note(text) {
    if (!pill) { pill = document.createElement('div'); pill.className = 'pd-online'; pill.style.cssText = 'position:fixed;z-index:40;left:50%;bottom:90px;transform:translateX(-50%);max-width:calc(100vw - 24px);box-sizing:border-box;padding:8px 14px;border-radius:12px;background:rgba(13,7,9,.92);border:2px solid #e8559a;color:#fff;font:600 14px system-ui,sans-serif;text-align:center'; document.body.appendChild(pill); }
    pill.textContent = text || ''; pill.style.display = text ? '' : 'none';
  }
  const drunkOf = () => env.getDrunk && env.getDrunk();
  function offer(kind) {
    const now = performance.now(); if (kind !== 0 && kind !== 1) return false;
    if (!(game.state === 'play')) return false;
    if (myOffer || now - lastOfferAt < OFFER_GAP_MS) { toast(tr('Aspetta ’na picca', 'Wait a moment'), myOffer ? tr(`Aspettu a ${nameOf(myOffer.to)}`, `Waiting for ${nameOf(myOffer.to)}`) : '', true); return false; }
    let best = null, bd = OFFER_R;
    for (const [id, rem] of rm.remotes) { const p = others.get(id); if (!p || !p.shown || !rem.snaps.length) continue; const d = Math.hypot(p.x - car.x, p.z - car.z); if (d < bd) { bd = d; best = id; } }
    if (!best) { toast(tr('Nessuno vicino', 'Nobody close enough'), '', true); return false; }
    if (freeLeft() <= 0 && garage.cash < DRINK_PRICE) { toast(tr('Sienza picciuli!', 'Not enough money'), `${DRINK_PRICE} €`, true); return false; }
    const id = (offerSeq = (offerSeq + 1) & 255);
    if (!sendOffer(best, new Uint8Array([4, kind, id]))) { toast(tr(`${nameOf(best)} un c’è cchiù`, `${nameOf(best)} is gone`), '', true); return false; }
    lastOfferAt = now; myOffer = { to: best, name: nameOf(best), id, kind, until: now + OFFER_TTL_MS };
    note(tr(`Offerta mandata a ${nameOf(best)}`, `Offer sent to ${nameOf(best)}`) + (freeLeft() > 0 ? tr(' · gratis', ' · free') : ''));
    return true;
  }
  function closeCard() { if (card) { card.remove(); card = null; } }
  function dizzy() {   // the stack the receiver would be at after this drink (src/drunk.js), 1 to max
    const d = drunkOf(), max = (d && d.max) || 6; return { n: Math.min(max, Math.ceil(((d && d.units) || 0) + 1 - 1e-6)), max };
  }
  function showCard(name, kind) {
    const what = KIND_TXT[lang()][kind], { n, max } = dizzy();
    closeCard(); card = document.createElement('div'); card.className = 'pd-online'; card.setAttribute('role', 'alertdialog');
    card.style.cssText = 'position:fixed;z-index:60;left:50%;bottom:120px;transform:translateX(-50%);width:min(320px,calc(100vw - 24px));box-sizing:border-box;padding:12px 12px 14px;border-radius:14px;background:rgba(13,7,9,.94);border:2px solid #e8559a;color:#fff;font:14px/1.35 system-ui,sans-serif;overflow:hidden';
    if (window.matchMedia('(max-height:500px)').matches) card.style.bottom = '12px';
    const q = document.createElement('div'); q.style.cssText = 'font-weight:700;margin-bottom:4px'; q.textContent = tr(`${name} ti offre ${what}`, `${name} offers you ${what}`);
    const dz = document.createElement('div'); dz.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:#ffb3d4';
    const dl = document.createElement('span'); dl.textContent = tr('Ti gira a testa', 'Your head will spin'); dz.append(dl);
    const pips = document.createElement('span'); pips.setAttribute('aria-label', `${n}/${max}`); pips.style.cssText = 'display:inline-flex;gap:3px;align-items:center';
    for (let i = 1; i <= max; i++) { const s = document.createElement('i'); s.style.cssText = `display:block;width:9px;height:9px;border-radius:99px;border:1.5px solid #e8559a;background:${i <= n ? '#e8559a' : 'transparent'}`; pips.append(s); }
    const x = document.createElement('b'); x.textContent = `×${n}`; x.style.color = '#fff'; dz.append(pips, x);
    const keys = !document.documentElement.classList.contains('touch');
    const mk = (txt, yes) => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = txt; bt.style.cssText = 'min-height:40px;margin-right:8px;padding:6px 14px;border-radius:9px;border:1.5px solid #e8559a;background:' + (yes ? '#e8559a' : 'transparent') + ';color:' + (yes ? '#0d0709' : '#fff') + ';font:700 14px system-ui,sans-serif;cursor:pointer';
      bt.dataset.act = yes ? 'yes' : 'no';
      if (keys) { const k = document.createElement('kbd'); k.textContent = yes ? 'Y' : 'N'; k.style.cssText = 'margin-left:8px;padding:1px 6px;border-radius:4px;font:700 12px system-ui,sans-serif;background:' + (yes ? '#0d0709' : '#e8559a') + ';color:' + (yes ? '#e8559a' : '#0d0709'); bt.append(k); }   // a keyboard player is told which keys answer
      bt.addEventListener('click', () => { bt.blur(); answer(yes); }); return bt; };
    const bar = document.createElement('div'); bar.className = 'pd-online-bar'; bar.style.cssText = 'position:absolute;left:0;bottom:0;height:3px;background:#e8559a';
    card.append(q, dz, mk(tr('Accetta', 'Accept'), true), mk(tr('Un mi va', 'No thanks'), false), bar); document.body.appendChild(card);
  }
  function answer(yes) {
    const o = incoming; closeCard(); if (!o || o.accepted) return;
    if (!yes) { reply(o.from, o.id, R_NO); decline(o); return; }
    if (!sendOffer(o.from, new Uint8Array([5, 0, o.id]))) { incoming = null; toast(tr(`${o.name} un c’è cchiù`, `${o.name} is gone`), '', true); return; }
    o.accepted = true; o.waitUntil = performance.now() + CONFIRM_WAIT_MS;
  }
  function decline(o) { incoming = null; const p = others.get(o.from); if (p) p.mutedUntil = performance.now() + MUTE_MS; }
  function onOffer(p, b, now) {   // b: the direct bytes of a TO frame, from a stranger
    const id = p.handle;
    if (b.length !== 3 || b[0] < 4 || b[0] > 7 || (b[0] === 4 && b[1] > 1) || (b[0] === 7 && b[1] > R_HELD)) { stats.rxBad++; return; }
    if (b[0] === 4) {   // OFFER, to the receiver
      if (now - (p.lastOffer || -1e9) < OFFER_GAP_MS * 0.8) { stats.rxDropped++; return; }   // faster than a real client sends: no card and no answer
      p.lastOffer = now;
      if ((p.mutedUntil || 0) > now) { reply(id, b[2], R_NO); return; }
      const d = drunkOf();
      if (game.state !== 'play' || incoming || !p.shown) { reply(id, b[2], R_BUSY); return; }
      if (!rm.remotes.get(id) || dist(id) > FAR_R) { reply(id, b[2], R_FAR); return; }
      if (d && d.full) { reply(id, b[2], R_ENOUGH); return; }
      incoming = { from: id, name: p.name || 'Player', id: b[2], kind: b[1], until: now + OFFER_TTL_MS, accepted: false, waitUntil: 0 };
      if (inMission()) { incoming.held = true; incoming.heldUntil = now + HOLD_MS; incoming.calmAt = 0; reply(id, b[2], R_HELD); return; }   // no card in the middle of a run
      showCard(incoming.name, b[1]); chirp('offer');
    } else if (b[0] === 5) {   // ACCEPT, to the giver
      if (!myOffer || myOffer.to !== id || myOffer.id !== b[2] || now > myOffer.until + ACCEPT_GRACE_MS) { stats.rxDropped++; return; }
      const o = myOffer, name = nameOf(id); myOffer = null; note(null);
      if (!here(id) || dist(id) > FAR_R) { reply(id, o.id, R_WALKED); toast(tr(`${name} è truappu luntanu`, `${name} is too far`), '', true); return; }
      const free = useFree();
      if (!free && !(garage.cash >= DRINK_PRICE && garage.debit(DRINK_PRICE) >= DRINK_PRICE)) { reply(id, o.id, R_BROKE); toast(tr('Sienza picciuli!', 'Not enough money'), `${DRINK_PRICE} €`, true); return; }
      sendOffer(id, new Uint8Array([6, o.kind, o.id]));
      const rem = rm.remotes.get(id); if (rem && TOAST_IDX >= 0) rm.say(rem, PHRASES[TOAST_IDX], now);
      const left = freeLeft();   // the line says it was free, and how many rounds are still free, so the first paid one is no surprise
      toast(free ? tr('Saluti! Offre a casa', 'Cheers! On the house') : tr(`Saluti! -${DRINK_PRICE} €`, `Cheers! -${DRINK_PRICE} €`), tr(`${name} accittau`, `${name} accepted`) + (free ? (left > 0 ? tr(` · ${left} gratis arristati`, ` · ${left} free left`) : tr(' · era l’ultimu gratis', ' · that was the last free one')) : ''));
    } else if (b[0] === 6) {   // CONFIRM, to the receiver: the giver paid
      if (!incoming || incoming.from !== id || incoming.id !== b[2] || !incoming.accepted || now > incoming.waitUntil + 2000) { stats.rxDropped++; return; }
      const o = incoming; incoming = null;
      toast(tr(`${o.name} t’offriu ${KIND_TXT.it[o.kind]}`, `${o.name} treated you to ${KIND_TXT.en[o.kind]}`));   // who; the drink's own line (how dizzy) follows from src/drunk.js
      const d = drunkOf(); if (d && d.gift) d.gift(KIND_TXT.it[o.kind].replace(/^una? /, '').replace(/^./, c => c.toUpperCase()));
      const rem = rm.remotes.get(id); if (rem && TOAST_IDX >= 0) rm.say(rem, PHRASES[TOAST_IDX], now);
    } else {   // REPLY
      const code = b[1];
      if (code === R_HELD) {   // to the giver: he is on a mission and will see the card afterwards
        if (!myOffer || myOffer.to !== id || myOffer.id !== b[2] || myOffer.held) { stats.rxDropped++; return; }
        myOffer.held = true; myOffer.until = now + HOLD_MS + OFFER_TTL_MS; const name = myOffer.name;
        toast(tr(`${name} è ’n missioni`, `${name} is on a mission`), tr('Ti rispunni appressu', 'He will answer afterwards'));
        note(tr(`Aspettu a ${name} (è ’n missioni)`, `Waiting for ${name} (on a mission)`));
      } else if (code <= R_FAR) {   // to the giver
        if (!myOffer || myOffer.to !== id || myOffer.id !== b[2]) { stats.rxDropped++; return; }
        myOffer = null; note(null); const name = nameOf(id);
        toast(code === R_NO ? tr(`${name}: un ci va`, `${name} said no thanks`) : code === R_BUSY ? tr(`${name} è occupatu`, `${name} is busy`) : code === R_ENOUGH ? tr(`${name} n’havi abbastanza`, `${name} has had enough`) : tr(`${name} è truappu luntanu`, `${name} is too far`), '', true);
      } else {   // to the receiver, after their yes
        if (!incoming || incoming.from !== id || incoming.id !== b[2] || !incoming.accepted) { stats.rxDropped++; return; }
        const o = incoming; incoming = null;
        toast(code === R_BROKE ? tr(`${o.name} un havi picciuli`, `${o.name} can’t pay for it`) : tr('Si’ truappu luntanu', 'You are too far away'), '', true);
      }
    }
  }
  // A small sound for a phrase and for an offer, on an AudioContext of its own (made at the first sound, so after a key press; src/audio-recover.js wraps the class, so it is
  // resumed when a phone comes back from the background) at the game's own volume setting (Options, game.settings.volume).
  let ac = null;
  function chirp(what) {
    try {
      const vol = clamp(game.settings && Number.isFinite(game.settings.volume) ? game.settings.volume : 0.8, 0, 1); if (vol <= 0 || game.state !== 'play') return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); if (ac.state !== 'running') ac.resume().catch(() => {});
      const notes = what === 'offer' ? [[659.25, 0], [830.6, 0.12], [987.8, 0.24]] : [[740, 0], [988, 0.09]], g = vol * (what === 'offer' ? 0.2 : 0.1), t0 = ac.currentTime + 0.02;
      notes.forEach(([f, dt], i) => {
        const o = ac.createOscillator(), e = ac.createGain(), t = t0 + dt, last = i === notes.length - 1;
        o.type = 'triangle'; o.frequency.value = f; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0008, t + (last ? 0.4 : 0.16));
        o.connect(e); e.connect(ac.destination); o.start(t); o.stop(t + 0.5);
      });
    } catch (e) { /* no audio: the card and the bubble are enough */ }
  }
  // somebody comes close: one short line. Per player once a minute and for everybody once every 6 s, so a street full of players is not a stream of lines.
  const NEAR_R = 60, NEAR_OUT = 100, HELLO_PLAYER_MS = 60000, HELLO_ALL_MS = 6000;
  let lastHello = -1e9;
  function arrivals(now) {
    for (const p of others.values()) {
      if (!p.shown || !Number.isFinite(p.x)) { p.near = false; continue; }
      const d = Math.hypot(p.x - car.x, p.z - car.z);
      if (!p.near && d < NEAR_R) {
        p.near = true;
        if (now - lastHello > HELLO_ALL_MS && now - (p.lastHello || -1e9) > HELLO_PLAYER_MS) { lastHello = p.lastHello = now; toast(tr(`${p.name || 'Player'} è vicino`, `${p.name || 'Player'} is nearby`)); }
      } else if (p.near && d > NEAR_OUT) p.near = false;
    }
  }
  // housekeeping, every frame: the clocks of both sides, and an offer whose other end has gone
  function offerClocks(now, playing) {
    if (myOffer) {
      const name = myOffer.name;   // the record of the player may be gone by now
      if (!here(myOffer.to)) { note(null); myOffer = null; toast(tr(`${name} un c’è cchiù`, `${name} is gone`), '', true); }
      else if (now > myOffer.until + ACCEPT_GRACE_MS) { note(null); myOffer = null; toast(tr(`${name} un rispunniu`, `${name} didn’t answer`), '', true); }
    }
    if (!incoming) return;
    if (incoming.held) {   // on a mission: wait for it to end
      if (!here(incoming.from) || dist(incoming.from) > FAR_R * 1.5) { incoming = null; return; }   // the giver's own line says he is gone
      if (now > incoming.heldUntil) { reply(incoming.from, incoming.id, R_BUSY); incoming = null; return; }
      if (playing && !inMission()) {
        if (!incoming.calmAt) incoming.calmAt = now;
        if (now - incoming.calmAt > CALM_MS) {
          const d = drunkOf(); if (d && d.full) { reply(incoming.from, incoming.id, R_ENOUGH); incoming = null; return; }
          incoming.held = false; incoming.until = now + OFFER_TTL_MS; showCard(incoming.name, incoming.kind); chirp('offer');
        }
      } else incoming.calmAt = 0;
      return;
    }
    if (incoming.accepted) { if (now > incoming.waitUntil) { const n = incoming.name; incoming = null; toast(tr(`${n} un c’è cchiù`, `${n} is gone`), '', true); } return; }
    if (!playing) { reply(incoming.from, incoming.id, R_BUSY); closeCard(); incoming = null; return; }   // paused, game over: nothing to answer with
    if (now > incoming.until) { decline(incoming); closeCard(); return; }
    if (!here(incoming.from) || dist(incoming.from) > FAR_R * 1.5) { closeCard(); incoming = null; }   // its giver left or drove away: the card would be a question about nobody
  }
  // ---------- name card ----------
  // The notice behind the i: three short paragraphs, kept true by hand (docs/ONLINE.md, joinlog/README.md). The second one follows PLAYLOG_ON.
  // WHO_SEES is the one sentence about who can see a player: if that changes (who is told what), change it here and nowhere else.
  const WHO_SEES = {
    it: 'Se giochi online, i giocatori più vicini a te, ovunque siano in città, vedono il tuo nome e la tua posizione, e tutti i giocatori online vedono il tuo nome e il quartiere in cui sei (nella lista Online, a meno di 50 m). Il nostro server, ospitato su Cloudflare, vede il tuo indirizzo IP mentre ti collega a loro: lo tiene solo finché sei collegato, e gli altri giocatori non lo vedono.',
    en: 'If you play online, the players closest to you, wherever they are in the city, can see your name and your position, and everybody online can see your name and the neighbourhood you are in (in the Online list, to within 50 m). Our server, hosted on Cloudflare, sees your IP address while it connects you to them. It keeps it only while you are connected, and the other players do not see it.' };
  const KEPT = {
    it: 'Non raccogliamo informazioni personali. Non teniamo il tuo indirizzo, la tua posizione né un identificativo che dura nel tempo.',
    en: 'We do not collect personal information. We keep no address, no position and no ID that lasts.' };
  const STATS = {
    it: 'Ogni giocatore, anche da solo, invia conteggi anonimi su come gioca e su come gira il gioco: missioni, soldi, chilometri, fotogrammi. Se giochi online, salviamo con loro anche il nome che scegli, quindi meglio un soprannome. Teniamo tutto fino a 12 mesi.',
    en: 'Every player, even playing alone, sends anonymous counts about how they play and how the game runs: missions, money, distance, frame rate. If you play online, we save the name you chose with them, so pick a nickname. We keep it all for up to 12 months.' };
  const NONE = { it: 'Non salviamo nulla.', en: 'We store nothing.' };
  const NAME_TXT = { it: { ask: 'Come ti chiami?', again: 'Online o da solo?', sub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', save: 'Salva', close: 'Chiudi', solo: 'Gioca da solo', info: 'Privacy e dati', back: 'Arrieri' },
    en: { ask: "What's your name?", again: 'Online or solo?', sub: 'Drive online with other players. You can change it any time.', edit: 'Your name', ph: 'Name', join: 'Play online', save: 'Save', close: 'Close', solo: 'Play alone', info: 'Privacy and data', back: 'Back' } };
  const privParts = l => [KEPT[l], PLAYLOG_ON ? STATS[l] : NONE[l], WHO_SEES[l]];
  let nameCard = null, submitName = null, closeName = null, nameFit = null;
  // The card sits in the middle of the screen with the game dimmed behind it. nameCard is that full-screen layer (it takes every touch, so nothing reaches the game
  // underneath), the dialog is its child. It follows the visible area (visualViewport) so an on-screen keyboard that does not resize the page cannot cover it.
  function dropName() {
    if (nameFit && window.visualViewport) { visualViewport.removeEventListener('resize', nameFit); visualViewport.removeEventListener('scroll', nameFit); }
    nameFit = null; if (nameCard) nameCard.remove(); nameCard = null;
  }
  function openName() {
    refreshName();
    dropName();
    const tx = NAME_TXT[lang()], editing = named && agreed;
    nameCard = document.createElement('div');
    nameCard.style.cssText = 'position:fixed;inset:0;z-index:599;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:rgba(4,2,3,.72);touch-action:none';
    const dlg = document.createElement('div'); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
    dlg.style.cssText = 'position:relative;width:min(460px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;box-sizing:border-box;padding:14px;border-radius:14px;background:rgba(13,7,9,.97);border:2px solid #e8559a;color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.6)';
    // the page's touch lockdown (src/mobile.js) would cancel a scroll inside the card; the same two lines as the menu (src/ui.js)
    for (const t of ['touchstart', 'touchmove', 'touchend']) dlg.addEventListener(t, e => e.stopPropagation(), { passive: true });
    const h = document.createElement('b'); h.style.cssText = 'display:block;font-size:17px;color:#ff6fae;padding-right:36px'; const head = editing ? tx.edit : named ? tx.again : tx.ask; h.textContent = head;
    const sub = document.createElement('small'); sub.style.cssText = 'display:block;opacity:.7;margin:2px 0 10px;font-size:12px'; sub.textContent = editing ? '' : tx.sub;
    // what happens to your data: behind the i, opened by a tap or a click. It takes the place of the form while it is open (so it is never cut off on a short screen), with a Back button under it.
    const priv = document.createElement('div'); priv.id = 'p2p-priv'; priv.style.cssText = 'display:none;margin-top:8px';
    const note = document.createElement('div'); note.setAttribute('role', 'note'); note.style.cssText = 'margin-bottom:8px;padding:8px 10px;border-radius:10px;background:rgba(232,85,154,.12);border:1px solid rgba(232,85,154,.5);font:500 12.5px/1.38 system-ui,sans-serif';
    privParts(lang()).forEach((t, i) => { const p = document.createElement('p'); p.style.cssText = i ? 'margin:6px 0 0' : 'margin:0'; p.textContent = t; note.appendChild(p); });
    const back = document.createElement('button'); back.type = 'button'; back.textContent = tx.back;
    priv.append(note, back);
    const info = document.createElement('button'); info.type = 'button'; info.className = 'p2p-info'; info.textContent = 'i'; info.setAttribute('aria-label', tx.info); info.setAttribute('aria-expanded', 'false'); info.setAttribute('aria-controls', 'p2p-priv');
    info.style.cssText = 'position:absolute;right:10px;top:10px;width:30px;height:30px;padding:0;border-radius:99px;border:1.5px solid #e8559a;background:transparent;color:#fff;font:700 14px Georgia,serif;cursor:pointer';
    const form = document.createElement('div');   // the sub line, the name box and the buttons
    let shown = false;
    const showInfo = on => {
      shown = on; priv.style.display = on ? 'block' : 'none'; form.style.display = on ? 'none' : '';
      info.setAttribute('aria-expanded', String(on)); info.style.background = on ? '#e8559a' : 'transparent'; info.style.color = on ? '#0d0709' : '#fff'; h.textContent = on ? tx.info : head;
      dlg.scrollTop = 0; if (on) back.focus({ preventScroll: true }); else if (window.matchMedia('(pointer:fine)').matches) input.focus();
    };
    info.addEventListener('click', () => showInfo(!shown)); back.addEventListener('click', () => showInfo(false));
    const input = document.createElement('input'); input.maxLength = 16; input.placeholder = tx.ph; input.value = named ? myName : ''; input.autocomplete = 'off'; input.spellcheck = false;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;font:600 16px system-ui,sans-serif;padding:9px 11px;margin-bottom:8px;border-radius:9px;border:1.5px solid #5a4a50;background:#1b1115;color:#fff;outline:none';
    const ok = document.createElement('button'), no = document.createElement('button'), solo = document.createElement('button');
    for (const b of [ok, no, solo, back]) { b.type = 'button'; b.style.cssText = 'min-height:40px;margin-right:8px;padding:6px 14px;border-radius:9px;border:1.5px solid #e8559a;background:transparent;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer'; }
    ok.style.background = '#e8559a'; ok.style.color = '#0d0709'; ok.textContent = editing ? tx.save : tx.join; no.textContent = tx.close; solo.textContent = tx.solo;
    const submit = () => {
      const n = clean(input.value); if (!n) { input.focus(); return; }
      myName = n; named = true; agreed = true; saveStore({ name: n, offline: false });
      dropName(); dispatchEvent(new Event('pd-net-changed')); link.ask();   // saying yes again is asking: one attempt now, even if the link had given up
    };
    submitName = submit; closeName = dropName;
    ok.addEventListener('click', submit); no.addEventListener('click', closeName); solo.addEventListener('click', () => { agreed = false; saveStore({ offline: true }); goOffline(); closeName(); dispatchEvent(new Event('pd-net-changed')); });
    // a press on the dim does nothing to the game; with a mouse it keeps the keyboard in the box so that Enter and Escape still reach the card
    nameCard.addEventListener('pointerdown', e => { if (e.target === nameCard && e.pointerType === 'mouse') { e.preventDefault(); input.focus(); } });
    form.append(sub, input, ok); if (editing) form.append(no); form.append(solo);
    dlg.append(info, h, form, priv);
    nameCard.appendChild(dlg);
    // keep the layer on the part of the page that can be seen
    const vv = window.visualViewport;
    nameFit = () => { if (!nameCard || !vv) return; const s = nameCard.style; s.inset = 'auto'; s.left = vv.offsetLeft + 'px'; s.top = vv.offsetTop + 'px'; s.width = vv.width + 'px'; s.height = vv.height + 'px'; };
    if (vv) { vv.addEventListener('resize', nameFit); vv.addEventListener('scroll', nameFit); }
    document.body.appendChild(nameCard); if (window.matchMedia('(pointer:fine)').matches) input.focus();
  }
  // Typing a name must not drive the car or open the pause menu (P and Escape): the game's own key handler (src/ui.js) is a window capture listener
  // too, but it is added after this one, so this runs first and keeps the keys for the card. Enter and Escape are handled here, letters still reach the box.
  addEventListener('keydown', e => {
    if (!nameCard || !nameCard.contains(e.target)) return;
    e.stopImmediatePropagation();
    // on a button Enter presses that button, as it does everywhere else
    if (e.key === 'Enter') { if (e.target.tagName === 'BUTTON') return; e.preventDefault(); submitName && submitName(); } else if (e.key === 'Escape') { e.preventDefault(); closeName && closeName(); }
  }, true);
  // the name and the online choice live in Options (src/ui.js), which asks for the card with this event; html.pd-mp tells it that there is multiplayer to choose
  addEventListener('pd-open-name', () => openName());
  addEventListener('pd-net-mode', e => {   // the toggle in Options (src/ui.js): the same two answers as the card
    refreshName();
    if (e.detail) { if (!myName) return; named = true; agreed = true; saveStore({ name: myName, offline: false }); link.ask(); }
    else { agreed = false; saveStore({ offline: true }); goOffline(); }
    dispatchEvent(new Event('pd-net-changed')); dropName();
  });
  document.documentElement.classList.add('pd-mp');


  // Solo by choice means no connection at all: the socket is closed and not reopened until the player says yes again. A page that starts solo never opens it.
  function goOffline() { link.want(false); whyNot.reset(); forgetAll(); }
  // a page that is not being played (paused, in the Garage, in the background) has no frames, so update() below does not run there: this timer is what lets go of the relay after IDLE ms. The next frame back reopens it
  setInterval(() => { if (link.state !== 'idle' && performance.now() - activeAt > IDLE) link.want(false); }, 5000);
  addEventListener('offline', () => link.want(false));
  addEventListener('online', () => link.retryNow());
  // a page that comes back after being hidden for a while may find the relay back; the link decides whether that is too soon after the last time
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt && performance.now() - hiddenAt >= HIDDEN_RETRY_MS) { hiddenAt = 0; link.retryNow(); } });
  addEventListener('pagehide', () => link.want(false));

  // ---------- the cap on cars, whatever the relay sends ----------
  // The relay sends up to K players and a phone draws a dozen cars, so the players are ranked by distance: the nearest shownCap() may be cars (and are listened to: phrases, offers), a farther one is
  // a ring and a name on the maps, with its position kept up to date. A player beyond DRAW_R is a ring too, not a car, whatever its rank.
  function rank(now) {
    const known = [], unknown = [];
    for (const p of others.values()) (Number.isFinite(p.x) ? known : unknown).push(p);
    const dist = p => Math.hypot(p.x - car.x, p.z - car.z), cap = shownCap();
    known.sort((a, b) => dist(a) - (a.held ? 50 : 0) - (dist(b) - (b.held ? 50 : 0)));   // one already held has 50 m in hand, so two players at about the same distance do not swap places
    known.forEach((p, n) => {
      p.held = n < cap;
      if (!p.shown) return;
      const d = dist(p), far = !p.held || (p.far ? d > DRAW_R : d > DRAW_OUT);
      if (far !== p.far) { p.far = far; rm.setFar(rm.remotes.get(p.handle), far); ev(far ? 'far' : 'near', { handle: p.handle, m: Math.round(d) }); }
    });
    for (const p of unknown) p.held = true;   // no position yet: it takes no slot, and the first state ranks it
  }
  // One line when the reason there is nobody appears or changes, one when online comes back after that; connecting says nothing. The sentence stays in the panel as long as it is true.
  let toldWhy = null;
  function netToasts(on, bad, why) {
    if (!on) { toldWhy = null; return; }
    if (bad && why !== toldWhy) { toldWhy = why; toast(bad.pill, bad.msg, true, 6500); }
    else if (ready && toldWhy) { toldWhy = null; toast(TEXT[lang() === 'en' ? 'en' : 'it'].back, '', false, 2500); }
  }
  // ---------- frame ----------
  let hudT = 0;
  function update(dt) {
    const now = performance.now();
    const playing = game.state === 'play', on = online();
    if (playing) activeAt = now;
    if (link.state === 'idle' && whyNot.state) whyNot.reset();   // not trying any more (solo, paused too long): an old reason is not shown when it starts again
    const why = on && !ready ? whyNot.state : null, bad = why && describe(why, lang(), Date.now());
    netToasts(on, bad, why);
    const listHold = listPaused && game.state === 'pause';   // paused by the Online list: the capsule and the list stay
    if (!on || !(playing || listHold)) panel.set({ show: false, title: '', sub: '', label: '' });
    else if (!ready) {   // nobody to talk to: connecting (quiet), or the reason there is nobody
      panel.set(bad ? { show: true, tone: bad.tone, title: bad.pill, sub: '', msg: bad.msg, idle: true, label: '' } : { show: true, tone: 'wait', title: 'Online…', sub: '', idle: true, label: '' });
    } else {   // the multiplayer section: how many are connected, how many of them can see what we say (within DRAW_R)
      let linked = 0; for (const p of others.values()) if (p.held !== false) linked++;
      const total = Math.max(onlineCount, linked + 1);
      let hear = 0; for (const p of others.values()) if (Number.isFinite(p.x) && now - p.lastRx < STALE_FAR_MS && Math.hypot(p.x - car.x, p.z - car.z) <= SAY_R) hear++;
      const near = inReach(), keys = !document.documentElement.classList.contains('touch');
      panel.set({
        show: true, idle: !near, open: wheel.isOpen, label: tr('Abbannìa', 'Shout') + (keys ? ' (T)' : ''), word: tr('Abbannìa', 'Shout'),
        title: total > 1 ? tr(`${total} giocatori online`, `${total} players online`) : 'Online',   // everybody connected, us included (the relay's count): the players the relay sends us are only the nearest few plus two far ones, so that was always 2 or so
        sub: total <= 1 ? tr('ancora nessuno', 'no one yet') : hear ? tr(`${hear} ${hear === 1 ? 'vicino' : 'vicini'}`, `${hear} nearby`) : tr('nessuno vicino', 'nobody nearby'),   // the players who hear what you say (within SAY_R), not a distance (the owner, 21 Nov 2026)
      });
    }
    if (wheel.isOpen && !(on && playing && inReach())) wheel.close();   // nobody within reach any more, or paused: nothing to say
    if (listOpen && listPaused && playing) { listPaused = false; game.hold = false; closeList(false); }   // something else resumed the game (Escape in the page's own menu handling): the list goes with the pause
    if (listOpen && !(on && ready && (playing || listPaused && game.state === 'pause'))) closeList();
    if (on && ready && playing) followTick(dt, now); else if (following && !on) stopFollow('');
    if (listOpen) { if (now - rosterAsked > ROSTER_EVERY_MS) askRoster(now); if (now - listAt > 250) { listAt = now; panel.setList(listView(now)); } }
    offerClocks(now, playing); if (playing) arrivals(now);
    if (!started) { if (game.state !== 'play') return; started = true; ev('start', { x: Math.round(car.x), z: Math.round(car.z) }); if (!(named && agreed) && !screenshots) setTimeout(openName, 800); }
    link.want(on && now - activeAt < IDLE);
    if (!on) { rm.update(dt, now); return; }
    if (now - lastChecked > CHECK_MS) { lastChecked = now; rank(now); }
    if (playing) trackKin(now);
    sendInfo(now); sendState(now);
    for (const p of others.values()) {
      if (now - p.lastRx > FORGET_MS) { if (p.shown) rm.remove(p.handle); others.delete(p.handle); ev('drop', { handle: p.handle, why: 'forgotten' }); }
      else if (p.shown && now - p.lastRx > staleMs(p)) {
        // quiet for a while (the other page was locked, or in the background): take the car off the street but keep the record, the relay will say when the player is gone
        // and its next state shows it again with the name and livery we already have
        rm.remove(p.handle); p.shown = false; p.fts = -1;
        ev('drop', { handle: p.handle, why: 'stale' });
      }
    }
    rm.update(dt, now); bump.flush(now);
    if (testing && now - hudT > 500) {
      hudT = now;
      hud.textContent = `online ${link.state}${link.fails ? ' (failed ' + link.fails + ')' : ''}  ${myName}  handle ${selfHandle || '-'}  connected ${onlineCount || '-'}\nplayers ${others.size} drawn ${rm.remotes.size}  tx ${stats.tx} rx ${stats.rx} bad ${stats.rxBad} dropped ${stats.rxDropped}\nrelay ${relayUrl || 'none'}`;
    }
  }

  const api = {
    enabled: true, update,
    collidePlayer: c => { if (bumpOn && ready && game.state === 'play') bump.collide(c, rm.remotes, performance.now()); },   // called by the physics step (src/main.js) openName, players: () => rm.list(), get online() { return others.size > 0; },
    isOnline: online,
    statsName: () => named && agreed && ready ? myName : '',   // the play log (src/playlog.js) sends the name only while the player is online by their own yes; solo and unanswered send none
    // test hooks, under the name the tools have always used (window.__p2p)
    debug: { log, stats, bump: bump.stats, peers: others, remotes: rm.remotes, DRAW_R, shownCap, maxTracked: () => maxTracked, audience: () => audience, relayVer: () => relayVer, cars: () => [...rm.remotes.values()].filter(r => !r.far).length,
      relay: () => ({ url: relayUrl, state: link.state, fails: link.fails, waitMs: Math.round(link.waitMs), ready, handle: selfHandle, online: onlineCount, why: whyNot.state, asks: whyNot.asks }),
      peerInfo: () => [...others.values()].map(p => ({ handle: p.handle, name: p.name, shown: p.shown, held: p.held, far: p.far, age: Math.round(performance.now() - p.lastRx), x: Math.round(p.x) })),
      wallet: () => garage.cash, free: () => freeLeft(), spend: n => garage.debit(n),   // test hooks (tools/online/offer.mjs)
      resetOffers(keepMute) { lastOfferAt = -1e9; for (const p of others.values()) { p.lastOffer = 0; if (!keepMute) p.mutedUntil = 0; } },
      inMission, forceBusy: b => { busyForce = b; },
      say, offer, inReach, feedLine: (name, idx, mine) => panel.line(name, SAID[lang()], PHRASES[idx], !!mine),   // test hooks (tools/online/feed.mjs, the screenshots): a line in the section, and the players in reach
      name: () => myName, offerState: () => ({ myOffer, incoming: incoming && { ...incoming }, card: !!card, muted: [...others.values()].map(p => p.mutedUntil || 0) }), gameState: () => game.state,
      setName: n => { myName = clean(n) || myName; },
      // test hook (tools/film, the trailer): a made-up player drawn by the real code, with nothing on the network. move(snapshot) every frame keeps it alive and within reach; say(index) is a phrase received from it
      puppet(id, name, vehicle = 'calessino', livery = 0) {
        others.get(id) || others.set(id, newPlayer(id)); const p = others.get(id); p.name = clean(name); p.vehicle = vehicle; p.livery = livery; p.shown = true; p.held = true;
        const r = rm.ensure(id); rm.setFar(r, false); rm.setInfo(r, p.name, livery, vehicle);
        return { move(sn) { const now = performance.now(); p.x = sn.x; p.z = sn.z; p.lastRx = now; rm.addSnap(r, { t: now, steer: 0, roll: 0, lean: 0, fl: 0, ...sn }); },
          say(i) { rm.say(r, PHRASES[i], performance.now()); panel.line(p.name, SAID[lang()], PHRASES[i], false); } };
      },
      // test hooks (tools/online/fuzz.mjs): hostile frames through the real handlers. fuzz() skips the limit on the relay as a whole (it tests the others), inject() goes through it. Both refill the per-player limits unless told not to.
      fuzz(frames, refill = true) {
        let threw = 0; const bad0 = stats.rxBad, drop0 = stats.rxDropped;
        for (const f of frames) { if (refill) for (const p of others.values()) p.tokens = RATE_BURST; try { route(f, performance.now()); } catch (e) { threw++; } }
        return { threw, bad: stats.rxBad - bad0, dropped: stats.rxDropped - drop0, players: others.size, drawn: rm.remotes.size };
      },
      inject(frames) { const t0 = stats.threw, drop0 = stats.rxDropped; for (const f of frames) onFrame(f); return { threw: stats.threw - t0, dropped: stats.rxDropped - drop0 }; },
      follow: () => ({ following, pending: pendingFollow, route: followRoute.length, events: log.filter(e => /follow|join/.test(e.ev)).slice(-6) }),
      player: handle => { const p = others.get(handle); return p && { name: p.name, vehicle: p.vehicle, livery: p.livery, x: p.x, z: p.z, h: p.h, shown: p.shown }; } },
  };
  if (testing) { const upd = api.update; api.update = dt => { const t = performance.now(); upd(dt); stats.updMs += performance.now() - t; stats.updN++; }; }   // the time spent in update() a frame, for tools/online/pagecrowd.mjs
  window.__p2p = api.debug;
  return api;
}
