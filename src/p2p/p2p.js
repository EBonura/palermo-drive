// Peer to peer multiplayer, on by default (?p2p=off turns it off): no server of ours. Players find each other through public signalling (Trystero:
// Nostr relays by default, ?p2p=torrent or ?p2p=mqtt for the others) and then talk over WebRTC data channels.
// Write-up and numbers: docs/P2P-MULTIPLAYER.md. Nothing connects until the player says yes on the name card, which says what others can see. ?p2p in the address is the test mode: the debug box shows and a name is enough to join.
//
// Rooms follow the map. The world is cut into square cells (CELL metres, 500 = one world tile). A player is in the room of every
// cell whose rectangle is within MARGIN metres of the car, and leaves a room once the car is MARGIN + HYST metres from that
// cell. So in the middle of a cell there is one room, near an edge two, near a corner four. Any two players closer than MARGIN
// always share a room (if B is within MARGIN of A, B's cell is within MARGIN of A, and A is in its own cell). ?mode=grid3 joins the
// 3x3 cells around the car instead (the naive design, for comparison).
//
// A pair that shares several rooms needs only one WebRTC connection: Trystero 0.26 multiplexes all rooms of an app over one shared
// peer connection per pair (and keeps it for about two minutes after the last shared room closes). States still go out through
// one room only (the lowest room key both are in), so a pair is not sent the same state once per room; the receiver also drops
// duplicates and old packets by sequence number.
//
// Messages come from strangers: every byte is validated (length, ranges, rate limit, names reduced to plain text and drawn on a
// canvas, never as HTML). Wire format (little endian), the same state encoding as relay/src/protocol.rs, in one data channel action:
//   INFO  [1][vehicle u8][livery u8][nameLen u8][name utf8]   sent to a new peer and when the name, vehicle or livery changes;
//         vehicle indexes VEHICLES (src/garage.js), livery the LIVERIES of that vehicle; anything out of range is the calessino / its first livery
//   SAY   [3][phrase index u8]                        one of PHRASES (src/p2p/phrases.js), shown as a bubble over the sender's car and as a line with the sender's name in the multiplayer section (src/p2p/panel.js); sent only to players within DRAW_R of the sender, and ignored by a receiver farther than that
//   OFFER [4][kind u8][offer id u8]                   a drink (0 cicchetto, 1 birra) for a player close by; ACCEPT [5][id] answers it, CONFIRM [6][id] says the giver paid
//   STATE [2][seq u8][state 11 bytes][height u16]?    position 5 bytes, heading u8, speed i8, steer i8, roll i8, lean i8, flags u8 (bit 0 nitro, 1 brake, 2 drift, 3 height follows);
//         height: how far the car stands above the ground at its x, z, in tenths of a metre (a bridge deck, a roof, the air: car.lift); sent only above 0.6 m, so a car on the road costs nothing extra
import { createRemotes } from '../remotes.js';
import { getLang as lang } from '../lang.js';   // the language shown, 'it' | 'en' (src/lang.js)
import { strategies, selfId, pauseRelayReconnection, resumeRelayReconnection } from './trystero.js';
import { PHRASES, CATEGORIES } from './phrases.js';
import { createWheel } from './wheel.js';
import { createPanel } from './panel.js';
import { zone } from '../hud.js';
import { RELAYS, PRESENCE_RELAYS } from './relays.js';
import { createPresence } from './presence.js';
import { garage, VEHICLES, LIVERIES } from '../garage.js';
import { PLAYLOG_ON } from '../playlog.js';   // true once src/playlog-url.js has an address: the wording below then says what is saved

const APP_ID = 'palermo-drive-p2p-exp-1';
const POS_UNITS = 20, POS_MID = 1 << 19, POS_MAX = (1 << 20) - 1;
const TAU = Math.PI * 2;
const MAX_NAME_BYTES = 64, MAX_NAME_RUNES = 16;
const MAX_REMOTES = 48;        // players drawn at once; more are ignored
const STATE_LEN = 11, MSG_STATE = 2 + STATE_LEN, MAX_LIFT = 1000, LIFT_MIN = 0.6,   // metres: the ceiling of src/vehicle-air.js is 700 above the sea
   MSG_INFO_MAX = 4 + MAX_NAME_BYTES;
const RATE_PER_S = 40, RATE_BURST = 60;  // incoming messages per peer
const STALE_MS = 6000;         // a player we hear nothing from for this long is dropped
const GONE_MS = 1500;          // a player whose last connection closed is dropped after this (a room swap may bring it back)
const CHECK_MS = 500;          // how often the room set is re-evaluated
const OFFER_R = 25, OFFER_TTL_MS = 15000, OFFER_GAP_MS = 10000, DRINK_PRICE = 1;   // metres to the receiver, how long an offer stands, least time between two, euro
const SAY_GAP_MS = 1500;       // least time between two phrases from one player (checked on both ends)
const SEND_NEAR = 100, SEND_MID = 200, SEND_FAR = 1000, SEND_AFAR = 2500; // state interval by distance to the receiver: < 150 m, < 350 m, < 1200 m, farther
// The most other players held at once, wherever they are: connected, sent to, shown. Players are taken from the closest outward until this many (a room counts as
// all of its members). Chosen from the phone-profile measurements in docs/P2P-MULTIPLAYER.md (section "The closest players"). ?maxp=N overrides it for the tests.
const MAX_PLAYERS = 8;
const DRAW_R = 400, DRAW_OUT = 480;   // metres: a player farther than this is a dot with a name on the maps, not a car (fades in again inside DRAW_R)
const KEEP_M = 150;                   // a room already joined counts this much closer than it is, so two rooms at about the same distance do not swap places all the time
const SETTLE_MS = 8000;               // a room is not left by the selection until it has been joined this long (the presence of the others lags a few seconds)
const DECOY_MS = 25000, BAN_MS = 120000;   // a room that presence says is occupied but where nobody has turned up after DECOY_MS is left alone for BAN_MS
const SHARED_IDLE_MS = 15000;         // Trystero keeps the connection to a player for this long after the last room you shared closes (its default is 2 minutes): long enough for a room swap, short enough that a player we dropped is not connected for minutes. The option's name says test only; it is read in the vendored 0.26.0 and costs nothing if a later version ignores it
const PRESENCE_WAIT_MS = 3000;        // the first room waits this long for the list of who is online (then goes without it)
const PRESENCE_IDLE_MS = 60000;       // a paused or hidden game stops publishing and reading presence after this long

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const q8 = (v, scale) => clamp(Math.round(v / scale * 127), -127, 127);

export function createP2P(env) {
  const { car, game, vehicle } = env;
  const params = new URLSearchParams(location.search);
  const num = (k, d, lo, hi) => { const v = parseFloat(params.get(k)); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  const kind = ['nostr', 'torrent', 'mqtt'].includes(params.get('p2p')) ? params.get('p2p') : 'nostr';
  const CELL = num('cell', 500, 100, 4000), MARGIN = num('margin', 150, 0, 2000), HYST = num('hyst', 60, 0, 1000);
  const grid3 = params.get('mode') === 'grid3';
  const ns = (params.get('ns') || '').replace(/[^\w-]/g, '').slice(0, 24);   // separate the rooms of a test run from everybody else's
  const relayUrls = (params.get('relays') || '').split(',').filter(u => /^wss:\/\/[\w.:-]+(\/[\w./-]*)?$/.test(u));
  const strat = strategies[kind];
  // manualReconnection: Trystero no longer pauses and resumes relay reconnection by itself when the browser goes offline and online; this file does (below), so that a player who chose to be solo stays disconnected
  const relayConfig = { manualReconnection: true, ...(relayUrls.length ? { urls: relayUrls } : kind === 'nostr' ? { urls: RELAYS } : { redundancy: num('red', 3, 1, 10) }) };
  const log = [];   // timing events for the measurements: { t, ev, ... }
  const ev = (name, o) => { const e = { t: Math.round(performance.now()), ev: name, ...o }; log.push(e); if (log.length > 2000) log.shift(); };

  const clean = s => Array.from(String(s).replace(/[\p{C}\p{Zl}\p{Zp}‎‏‪-‮⁦-⁩]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_RUNES).join('');
  const STORE_KEY = 'palermoDrive.net.v1';   // the relay client's save: { name, offline }; the name is shared between the two clients
  const stored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  let myName = clean(params.get('name') || stored().name || '');
  let named = !!myName;
  const testing = params.has('p2p');
  // nothing is joined until the player has a name and has answered the card. The card asks on every page open, online or solo: only the name is remembered, never the answer.
  let agreed = testing;
  const screenshots = !testing && ['clean', 'fixres'].some(k => params.has(k));   // the comparison shots and benches run with no card over the picture
  const saveStore = o => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...stored(), ...o })); } catch (e) { /* private mode: fine */ } };
  if (!myName) myName = 'P2P' + selfId.slice(0, 3);
  // the Garage's driver screen (src/garage-ui.js) edits the same stored name and says so with a 'pd-name' event; take it over, as src/net.js does
  const urlName = !!params.get('name');
  const refreshName = () => { if (urlName) return; const n = stored().name, c = typeof n === 'string' ? clean(n) : ''; if (c && c !== myName) { myName = c; named = true; } };
  addEventListener('pd-name', refreshName);
  const vehId = () => Math.max(0, VEHICLES.findIndex(v => v.id === car.type));   // the night race's sulky is not a garage vehicle: it goes out as the default
  const livId = () => Math.max(0, (LIVERIES[VEHICLES[vehId()].id] || []).findIndex(l => l.id === car.livery));   // a custom colour is not in the list: the first one

  const rm = createRemotes(env);
  const rooms = new Map();   // key -> { key, i, j, room, state, info, peers: Set, t0, tFirstPeer, joined }
  const peers = new Map();   // peerId -> { id, rooms: Set(roomKey), name, livery, seq, lastRx, x, z, nextTx, goneAt, tokens, tokT, rx }
  const stats = { txMsgs: 0, txBytes: 0, rxMsgs: 0, rxBytes: 0, rxDropped: 0, rxDup: 0, rxBad: 0, joins: 0, leaves: 0 };
  let lastChecked = -1e9, lastInfoKey = '', started = false;

  // ---------- HUD (debug) ----------
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;z-index:30;left:8px;top:8px;padding:4px 8px;border-radius:6px;background:rgba(13,7,9,.74);color:#fff;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre';
  if (testing) document.body.appendChild(hud);

  // the Garage draws its own screen and the main loop skips the frame (so update() below does not run): the buttons are hidden by a rule that follows the page, not by a frame
  const css = document.createElement('style'); css.textContent = 'html.pd-in-garage .pd-p2p{display:none!important}@keyframes pd-p2p-bar{from{width:100%}to{width:0}}.pd-p2p-bar{animation:pd-p2p-bar ' + OFFER_TTL_MS + 'ms linear forwards}'; document.head.appendChild(css);

  // ---------- rooms ----------
  // Who to hold. The limit is a number of players, not a distance: MAXP other players at most, the closest ones, wherever they are in the city.
  // The list of who is online and in which rooms comes from src/p2p/presence.js (plain Nostr events, no WebRTC). Rooms are taken from the closest outward until their
  // members add up to MAXP (a room is all or nothing: Trystero connects you to everyone in it), and a room already joined counts KEEP_M closer than it is, so a new one has to
  // be clearly closer to push it out. A cell can hold a crowd, so a cell is cut into shards (rooms "cell", "cell:1", "cell:2"...): the lowest shard with fewer than MAXP others is
  // the one a player takes as their home room, so no room ever has more than MAXP + 1 members. When several players take the same shard at the same moment and it overfills,
  // the members sort themselves by id, the first MAXP + 1 stay and the rest move to the next shard, with no talking needed. Without presence (another strategy, ?presence=off,
  // or no relay answered) the old rule applies: the rooms within MARGIN metres of the car, shard 0.
  const MAXP = Math.round(num('maxp', MAX_PLAYERS, 1, 40)), IDLE_MS = num('idlems', PRESENCE_IDLE_MS, 1000, 600000);   // ?idlems=N: for the tests
  const presenceOn = kind === 'nostr' && params.get('presence') !== 'off' && !grid3;
  const presence = createPresence({ topic: `${APP_ID}:presence${CELL === 500 ? '' : ':c' + CELL}${ns ? ':' + ns : ''}`, urls: relayUrls.length ? relayUrls.slice(0, 3) : PRESENCE_RELAYS, onChange: () => { lastChecked = -1e9; } });
  const key = (i, j, s = 0) => `${ns}:${CELL}:${i}:${j}` + (s ? ':' + s : '');
  const rectDist = (x, z, i, j) => Math.hypot(Math.max(i * CELL - x, 0, x - (i + 1) * CELL), Math.max(j * CELL - z, 0, z - (j + 1) * CELL));
  let home = null, overSince = 0, lastListed = '';
  const banned = new Map();   // room key -> until: rooms that turned out empty or overfull
  function evaluate(now) {
    const x = car.x, z = car.z, ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    if (presenceOn) {
      if (!presence.running) return;   // paused for a long time: the rooms are left as they are
      if (!presence.ready && now - presence.startedAt < PRESENCE_WAIT_MS) return;
    }
    if (!presenceOn || !presence.ready) { legacy(x, z, ci, cj, now); return; }
    // who is where, by room: the others that list the room
    const gs = new Map();
    for (const e of presence.list()) for (const [i, j, s] of e.rooms) { const k = key(i, j, s); let g = gs.get(k); if (!g) gs.set(k, g = { key: k, i, j, s, who: new Set(), anon: 0 }); g.who.add(e.id); }
    for (const r of rooms.values()) { let g = gs.get(r.key); if (!g) gs.set(r.key, g = { key: r.key, i: r.i, j: r.j, s: r.s, who: new Set(), anon: 0 }); g.anon = Math.max(0, r.peers.size - g.who.size); }   // connected to more than presence lists (a player with no presence): they count too
    const occ = k => { const g = gs.get(k); return g ? g.who.size + g.anon : 0; };
    const ok = k => (banned.get(k) || 0) <= now;
    if (!home || home.i !== ci || home.j !== cj || !ok(home.key)) {
      let s = 0; for (; s < 60; s++) { const k = key(ci, cj, s); if (ok(k) && (rooms.has(k) || occ(k) < MAXP)) break; }
      home = { i: ci, j: cj, s, key: key(ci, cj, s) };
    }
    // the players held are counted once each, however many of the chosen rooms they are in (two players who each visit the other's room are one connection, not two:
    // counting them twice makes both give up the visit, and then neither is held)
    const want = new Map([[home.key, home]]), held = new Set(gs.get(home.key) ? gs.get(home.key).who : []);
    let anon = gs.get(home.key) ? gs.get(home.key).anon : 0;
    const cand = [...gs.values()].filter(g => g.key !== home.key && g.who.size + g.anon > 0 && ok(g.key)).map(g => [rectDist(x, z, g.i, g.j) - (rooms.has(g.key) ? KEEP_M : 0), g]).sort((a, b) => a[0] - b[0] || (a[1].key < b[1].key ? -1 : 1));
    for (const [, g] of cand) {
      let fresh = g.anon; for (const w of g.who) if (!held.has(w)) fresh++;
      if (held.size + anon + fresh <= MAXP) { want.set(g.key, g); for (const w of g.who) held.add(w); anon += g.anon; }
    }
    const homeKey = home.key;
    for (const r of [...rooms.values()]) {
      const settled = now - r.t0 > SETTLE_MS;
      if (!want.has(r.key) && settled) { leaveCell(r); continue; }
      if (r.key !== homeKey && now - r.t0 > DECOY_MS && !r.peers.size && occ(r.key) > 0) { banned.set(r.key, now + BAN_MS); ev('decoy', { room: r.key }); leaveCell(r); continue; }   // somebody said they were there, nobody is
      if (r.peers.size > MAXP && now - r.t0 > 6000 && [selfId, ...r.peers].sort().indexOf(selfId) > MAXP) {   // overfull, and we are not among the first MAXP + 1 ids
        banned.set(r.key, now + BAN_MS); ev('overfull', { room: r.key, members: r.peers.size + 1 }); leaveCell(r);
        if (r.key === homeKey) home = null;
      }
    }
    if (home) for (const [k, g] of want) if (!rooms.has(k) && ok(k)) joinCell(k, g.i, g.j, g.s);   // (a room just banned above is not rejoined in the same pass)
    // the other cap: whatever the rooms add up to, more than MAXP + 2 players connected for ten seconds means the farthest settled room goes
    const linked = [...peers.values()].filter(p => p.rooms.size).length;
    if (linked > MAXP + 2) { if (!overSince) overSince = now; } else overSince = 0;
    if (overSince && now - overSince > 10000) {
      const far = [...rooms.values()].filter(r => (!home || r.key !== home.key) && now - r.t0 > SETTLE_MS).sort((a, b) => rectDist(x, z, b.i, b.j) - rectDist(x, z, a.i, a.j))[0];
      if (far) { ev('overcap', { room: far.key, linked }); leaveCell(far); overSince = now; }
    }
    // tell the others which rooms we are in (home first)
    if (home && rooms.has(home.key)) {
      const list = [[home.i, home.j, home.s], ...[...rooms.values()].filter(r => r.key !== home.key).sort((a, b) => (a.key < b.key ? -1 : 1)).map(r => [r.i, r.j, r.s])], txt = list.join(';');
      if (txt !== lastListed) { lastListed = txt; presence.publish(list); }
    }
  }
  function legacy(x, z, ci, cj, now) {
    home = null;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {   // MARGIN < CELL: no cell farther than the ring around ours is in reach
      const i = ci + di, j = cj + dj, k = key(i, j);
      if (grid3 || rectDist(x, z, i, j) <= MARGIN) { if (!rooms.has(k)) joinCell(k, i, j, 0); }
    }
    for (const r of [...rooms.values()]) {
      const stay = grid3 ? Math.abs(r.i - ci) <= 1 && Math.abs(r.j - cj) <= 1 : r.s === 0 && rectDist(x, z, r.i, r.j) <= MARGIN + HYST;
      if (!stay) leaveCell(r);
    }
  }
  function joinCell(k, i, j, sh) {
    const r = { key: k, i, j, s: sh || 0, room: null, state: null, info: null, peers: new Set(), t0: performance.now(), tFirstPeer: 0, joined: false };
    rooms.set(k, r); stats.joins++;
    try {
      r.room = strat.joinRoom({ appId: APP_ID, relayConfig, _test_only_sharedPeerIdleMs: SHARED_IDLE_MS }, k, { onJoinError: e => ev('joinError', { room: k, error: String(e && e.error) }) });
    } catch (e) { ev('joinThrew', { room: k, error: String(e) }); rooms.delete(k); return; }
    ev('join', { room: k });
    r.info = r.room.makeAction('i'); r.state = r.room.makeAction('s'); r.say = r.room.makeAction('c');
    r.say.onMessage = (d, c) => onSay(c.peerId || c, d);
    r.offer = r.room.makeAction('o'); r.offer.onMessage = (d, c) => onOffer(c.peerId || c, d);
    r.info.onMessage = (d, c) => onInfo(r, c.peerId || c, d);
    r.state.onMessage = (d, c) => onState(r, c.peerId || c, d);
    r.room.onPeerJoin = id => {
      const first = !r.peers.size; r.peers.add(id);
      const t = performance.now(); if (first) { r.tFirstPeer = t; }
      ev('peerJoin', { room: k, peer: id.slice(0, 4), ms: Math.round(t - r.t0) });
      let p = peers.get(id); if (!p) { p = newPeer(id); peers.set(id, p); }
      p.rooms.add(k); p.goneAt = 0;
      sendInfoTo(r, id); sendStateTo([id], performance.now(), true);
    };
    r.room.onPeerLeave = id => detach(r, id, 'peerLeave');
  }
  function leaveCell(r) {
    ev('leave', { room: r.key, peers: r.peers.size }); stats.leaves++;
    for (const id of [...r.peers]) detach(r, id, null);
    rooms.delete(r.key);
    try { r.room.leave(); } catch (e) { /* ignore */ }
  }
  function detach(r, id, why) {
    r.peers.delete(id);
    const p = peers.get(id); if (!p) return;
    p.rooms.delete(r.key);
    if (why) ev(why, { room: r.key, peer: id.slice(0, 4) });
    if (!p.rooms.size) p.goneAt = performance.now();
  }
  const newPeer = id => ({ id, rooms: new Set(), name: '', vehicle: 'calessino', livery: -1, seq: -1, lastRx: 0, x: NaN, z: NaN, nextTx: 0, goneAt: 0, tokens: RATE_BURST, tokT: performance.now(), shown: false });

  // ---------- outgoing ----------
  const route = p => { let best = null; for (const k of p.rooms) if (rooms.has(k) && (best === null || k < best)) best = k; return best; };
  function sendInfoTo(r, id) {
    const nm = new TextEncoder().encode(myName).slice(0, MAX_NAME_BYTES);
    const b = new Uint8Array(4 + nm.length); b[0] = 1; b[1] = vehId(); b[2] = livId(); b[3] = nm.length; b.set(nm, 4);
    stats.txMsgs++; stats.txBytes += b.length;
    r.info.send(b, id ? { target: id } : undefined).catch(() => {});
  }
  function packState() {
    const lift = car.lift > LIFT_MIN ? Math.min(MAX_LIFT, car.lift) : 0, b = new Uint8Array(lift ? MSG_STATE + 2 : MSG_STATE), dv = new DataView(b.buffer);
    b[0] = 2;   // b[1], the sequence number, is set per receiver (sendStateTo): one counter shared by all of them would jump by the number of other sends, and a far player that is sent to rarely would look out of order
    const xq = clamp(Math.round(car.x * POS_UNITS) + POS_MID, 0, POS_MAX), zq = clamp(Math.round(car.z * POS_UNITS) + POS_MID, 0, POS_MAX);
    dv.setUint32(2, (xq | ((zq & 0xfff) << 20)) >>> 0, true); b[6] = zq >>> 12;
    b[7] = Math.round(((car.th % TAU) + TAU) % TAU / TAU * 256) & 255;
    dv.setInt8(8, clamp(Math.round((car.vf || 0) * 2), -127, 127)); dv.setInt8(9, q8(car.steer || 0, 0.7)); dv.setInt8(10, q8(car.roll || 0, 0.5)); dv.setInt8(11, q8(car.lean || 0, 1));
    b[12] = (car.nosAmt > 0.15 ? 1 : 0) | (car.braking ? 2 : 0) | (car.drift > 0.3 ? 4 : 0) | (lift ? 8 : 0);
    if (lift) dv.setUint16(MSG_STATE, Math.round(lift * 10), true);
    return b;
  }
  function sendStateTo(ids, now, force) {
    const byRoom = new Map();
    for (const id of ids) {
      const p = peers.get(id); if (!p) continue;
      if (p.held === false || (!force && now < p.nextTx)) continue;   // not one of the closest MAXP: nothing is sent
      const d = Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : 0;
      p.nextTx = now + (d < 150 ? SEND_NEAR : d < 350 ? SEND_MID : d < 1200 ? SEND_FAR : SEND_AFAR) - 5;
      const k = route(p); if (k === null) continue;
      if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(id);
    }
    if (!byRoom.size) return;
    const b = packState();
    for (const [k, list] of byRoom) for (const id of list) { const p = peers.get(id), c = b.slice(); c[1] = p.txSeq = ((p.txSeq | 0) + 1) & 255; stats.txMsgs++; stats.txBytes += c.length; rooms.get(k).state.send(c, { target: id }).catch(() => {}); }
  }

  // ---------- incoming (untrusted) ----------
  function admit(p, now) {   // token bucket per peer
    p.tokens = Math.min(RATE_BURST, p.tokens + (now - p.tokT) * RATE_PER_S / 1000); p.tokT = now;
    if (p.tokens < 1) return false; p.tokens--; return true;
  }
  function plain(d) { return d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : null; }
  function known(id) { return typeof id === 'string' && peers.get(id); }
  function onInfo(r, id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length < 4 || b.length > MSG_INFO_MAX || b[0] !== 1 || b.length !== 4 + b[3] || b[3] > MAX_NAME_BYTES) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now)) { stats.rxDropped++; return; }
    const v = VEHICLES[b[1]] || VEHICLES[0];   // untrusted: an unknown vehicle is the lapa, an unknown livery its first
    p.vehicle = v.id; p.livery = b[2] < LIVERIES[v.id].length ? b[2] : 0;
    p.name = clean(new TextDecoder().decode(b.subarray(4))) || 'Player';
    p.lastRx = now;
    if (p.shown) rm.setInfo(rm.remotes.get(id), p.name, p.livery, p.vehicle);
  }
  function onState(r, id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b[0] !== 2 || b.length < MSG_STATE || b[12] & 0xf0 || b.length !== (b[12] & 8 ? MSG_STATE + 2 : MSG_STATE)) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now)) { stats.rxDropped++; return; }
    const dseq = (b[1] - p.seq) & 255;
    if (p.seq >= 0 && (dseq === 0 || dseq > 128)) { stats.rxDup++; return; }   // a copy through another room, or out of order
    p.seq = b[1];
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const lo = dv.getUint32(2, true), xq = lo & 0xfffff, zq = (lo >>> 20) | (b[6] << 12);
    const x = (xq - POS_MID) / POS_UNITS, z = (zq - POS_MID) / POS_UNITS;
    if (!(Math.abs(x) < 20000 && Math.abs(z) < 20000)) { stats.rxBad++; return; }
    const v = clamp(dv.getInt8(8) / 2, -60, 60);
    const h = b[12] & 8 ? dv.getUint16(MSG_STATE, true) / 10 : 0;
    if (h > MAX_LIFT) { stats.rxBad++; return; }
    p.x = x; p.z = z; p.lastRx = now; p.h = h;
    if (p.held === false) return;   // known, but not among the closest MAXP: its position is kept for the ranking, nothing is drawn
    if (p.livery < 0) return;   // INFO not here yet (it was sent first, and arrives first unless it came through another room)
    if (!p.shown) {
      if (rm.remotes.size >= MAXP) { rank(now); if (p.held === false || rm.remotes.size >= MAXP) return; }   // full: a newcomer is shown only if it is closer than the farthest one, who is then taken off
      if (rm.remotes.size >= MAX_REMOTES) return;
      p.shown = true; p.far = Math.hypot(x - car.x, z - car.z) > DRAW_R;
      const first = rm.ensure(id); rm.setFar(first, p.far); rm.setInfo(first, p.name || 'Player', p.livery, p.vehicle);
      ev('firstState', { peer: id.slice(0, 4), room: r.key, msSinceRoom: Math.round(now - r.t0) });
    }
    const rem = rm.remotes.get(id); if (!rem) return;
    rm.addSnap(rem, { t: now, x, z, th: b[7] / 256 * TAU, v, steer: dv.getInt8(9) / 127 * 0.7, roll: dv.getInt8(10) / 127 * 0.5, lean: dv.getInt8(11) / 127, fl: b[12] & 7, h });
  }

  // A phrase reaches the players who can see our car: within DRAW_R metres (the range at which another player is drawn as a car and not a ring on the maps). The sender sends to
  // those only, and a receiver checks its own distance too, since a message comes from a stranger: past that range there is no bubble, no line and no sound.
  const reach = p => !!(p && p.held !== false && p.rooms.size && Number.isFinite(p.x) && performance.now() - p.lastRx < STALE_MS && Math.hypot(p.x - car.x, p.z - car.z) <= DRAW_R);
  const inReach = () => { let n = 0; for (const p of peers.values()) if (reach(p)) n++; return n; };
  const SAID = { it: 'dici', en: 'said' };   // "izzy dici “ciao curò”": wording to be corrected by the owner
  function onSay(id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== 2 || b[0] !== 3 || b[1] >= PHRASES.length) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now) || now - (p.lastSay || -1e9) < SAY_GAP_MS * 0.8) { stats.rxDropped++; return; }
    const rem = rm.remotes.get(id); if (!rem) return;   // only players we can see
    if (!p.shown || !Number.isFinite(p.x) || Math.hypot(p.x - car.x, p.z - car.z) > DRAW_R) { stats.rxDropped++; return; }   // too far to be a car on our street: not for us
    p.lastSay = now; rm.say(rem, PHRASES[b[1]], now); panel.line(p.name || 'Player', SAID[lang()], PHRASES[b[1]], false); chirp('say');
  }
  let lastSaid = -1e9;
  function say(idx) {
    const now = performance.now(); if (!(idx >= 0 && idx < PHRASES.length) || now - lastSaid < SAY_GAP_MS) return false;
    const byRoom = new Map(); let n = 0;
    for (const p of peers.values()) { if (!reach(p)) continue; const k = route(p); if (k !== null) { if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(p.id); n++; } }
    if (!n) { toast(tr('Nessuno vicino', 'Nobody close enough'), tr(`Entro ${DRAW_R} m`, `Within ${DRAW_R} m`), true); return false; }
    lastSaid = now; const b = new Uint8Array([3, idx]);
    for (const [k, list] of byRoom) { stats.txMsgs += list.length; stats.txBytes += 2 * list.length; rooms.get(k).say.send(b, { target: list }).catch(() => {}); }
    panel.line(myName, SAID[lang()], PHRASES[idx], true);   // what you said, in the same form as on their screens (the bubble is over your car on theirs)
    return true;
  }
  // the talk wheel (src/p2p/wheel.js): the talk button of the multiplayer section (src/p2p/panel.js) or the T key opens it; categories first, then the phrases of one. The wheel is built from the
  // fixed lists in src/p2p/phrases.js, so what it can send is exactly what the receiver accepts.
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
  const online = () => named && agreed && !quiet;   // the player said yes (the name card, or Online in Options) and has not gone solo since
  function openWheel() {
    if (!inReach()) { toast(tr('Nessuno vicino', 'Nobody close enough'), tr(`Entro ${DRAW_R} m`, `Within ${DRAW_R} m`), true); return; }
    wheel.setCategories(buildWheel()); wheel.open();
  }
  const toggleWheel = () => { if (wheel.isOpen) wheel.close(); else openWheel(); };
  const panel = createPanel({ zone: zone('social'), onTalk: toggleWheel });
  // T opens and closes it, 1 to 8 pick, Escape closes: in the capture phase, ahead of the game's own handler (src/ui.js adds its listener later)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const typing = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    if (typing || nameCard) return;
    if (card && (e.code === 'KeyY' || e.code === 'KeyN')) { e.preventDefault(); e.stopImmediatePropagation(); answer(e.code === 'KeyY'); return; }   // N is the radio's key too: the card has it first
    if (e.code === 'KeyT' && online() && game.state === 'play') { e.preventDefault(); e.stopImmediatePropagation(); toggleWheel(); return; }
    if (!wheel.isOpen) return;
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') wheel.close(); else wheel.back(); }
    else if (/^(Digit|Numpad)[1-8]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); wheel.pick(+e.code.slice(-1) - 1); }
  }, true);

  // ---------- a drink for somebody close by ----------
  // Giver: picks cicchetto or birra, the nearest visible player within OFFER_R gets an OFFER and a card with Accetta / Nun mi va. On ACCEPT the
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
  let busyForce = null;   // test seam (tools/p2p/held.mjs)
  const inMission = () => { if (busyForce !== null) return busyForce; const m = env.missions; if (!m || !m.busy || !m.busy()) return false; const k = m.state && m.state.ev && m.state.ev.slot && m.state.ev.slot.kind; return k !== 'pub' && k !== 'rave' && k !== 'leaf'; };
  let myOffer = null, lastOfferAt = -1e9, incoming = null, offerSeq = 0, card = null, pill = null;
  const toast = (text, sub, neg) => dispatchEvent(new CustomEvent('pd-toast', { detail: { text, sub, neg } }));   // the game's own line at the top of the screen (src/event-hud.js)
  const nameOf = id => { const p = peers.get(id); return (p && p.name) || 'Player'; };
  const here = id => { const p = peers.get(id); return !!(p && p.shown && rm.remotes.get(id)); };   // somebody we can see on the street
  const dist = id => { const p = peers.get(id); return p && Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : Infinity; };
  const sendOffer = (id, bytes) => { const p = peers.get(id), k = p && route(p); if (k === null || k === undefined) return false; stats.txMsgs++; stats.txBytes += bytes.length; rooms.get(k).offer.send(bytes, { target: id }).catch(() => {}); return true; };
  const reply = (id, offerId, code) => sendOffer(id, new Uint8Array([7, code, offerId]));
  // what the giver waits for: a line under the buttons until the answer comes (a toast only lasts two seconds)
  function note(text) {
    if (!pill) { pill = document.createElement('div'); pill.className = 'pd-p2p'; pill.style.cssText = 'position:fixed;z-index:40;left:50%;bottom:90px;transform:translateX(-50%);max-width:calc(100vw - 24px);box-sizing:border-box;padding:8px 14px;border-radius:12px;background:rgba(13,7,9,.92);border:2px solid #e8559a;color:#fff;font:600 14px system-ui,sans-serif;text-align:center'; document.body.appendChild(pill); }
    pill.textContent = text || ''; pill.style.display = text ? '' : 'none';
  }
  const drunkOf = () => env.getDrunk && env.getDrunk();
  function offer(kind) {
    const now = performance.now(); if (kind !== 0 && kind !== 1) return false;
    if (!(game.state === 'play')) return false;
    if (myOffer || now - lastOfferAt < OFFER_GAP_MS) { toast(tr('Aspetta ’na picca', 'Wait a moment'), myOffer ? tr(`Aspettu a ${nameOf(myOffer.to)}`, `Waiting for ${nameOf(myOffer.to)}`) : '', true); return false; }
    let best = null, bd = OFFER_R;
    for (const [id, rem] of rm.remotes) { const p = peers.get(id); if (!p || !p.shown || !rem.snaps.length) continue; const d = Math.hypot(p.x - car.x, p.z - car.z); if (d < bd) { bd = d; best = id; } }
    if (!best) { toast(tr('Nessuno vicino', 'Nobody close enough'), '', true); return false; }
    if (freeLeft() <= 0 && garage.cash < DRINK_PRICE) { toast(tr('Sienza picciuli!', 'Not enough money'), `${DRINK_PRICE} €`, true); return false; }
    const id = (offerSeq = (offerSeq + 1) & 255);
    if (!sendOffer(best, new Uint8Array([4, kind, id]))) { toast(tr(`${nameOf(best)} un c’è chiù`, `${nameOf(best)} is gone`), '', true); return false; }
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
    closeCard(); card = document.createElement('div'); card.className = 'pd-p2p'; card.setAttribute('role', 'alertdialog');
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
    const bar = document.createElement('div'); bar.className = 'pd-p2p-bar'; bar.style.cssText = 'position:absolute;left:0;bottom:0;height:3px;background:#e8559a';
    card.append(q, dz, mk(tr('Accetta', 'Accept'), true), mk(tr('Nun mi va', 'No thanks'), false), bar); document.body.appendChild(card);
  }
  function answer(yes) {
    const o = incoming; closeCard(); if (!o || o.accepted) return;
    if (!yes) { reply(o.from, o.id, R_NO); decline(o); return; }
    if (!sendOffer(o.from, new Uint8Array([5, 0, o.id]))) { incoming = null; toast(tr(`${o.name} un c’è chiù`, `${o.name} is gone`), '', true); return; }
    o.accepted = true; o.waitUntil = performance.now() + CONFIRM_WAIT_MS;
  }
  function decline(o) { incoming = null; const p = peers.get(o.from); if (p) p.mutedUntil = performance.now() + MUTE_MS; }
  function onOffer(id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== 3 || b[0] < 4 || b[0] > 7 || (b[0] === 4 && b[1] > 1) || (b[0] === 7 && b[1] > R_HELD)) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now)) { stats.rxDropped++; return; }
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
        toast(code === R_NO ? tr(`${name}: nun ci va`, `${name} said no thanks`) : code === R_BUSY ? tr(`${name} è occupatu`, `${name} is busy`) : code === R_ENOUGH ? tr(`${name} n’avi abbastanza`, `${name} has had enough`) : tr(`${name} è truappu luntanu`, `${name} is too far`), '', true);
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
    for (const p of peers.values()) {
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
      if (!here(myOffer.to)) { note(null); myOffer = null; toast(tr(`${name} un c’è chiù`, `${name} is gone`), '', true); }
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
    if (incoming.accepted) { if (now > incoming.waitUntil) { const n = incoming.name; incoming = null; toast(tr(`${n} un c’è chiù`, `${n} is gone`), '', true); } return; }
    if (!playing) { reply(incoming.from, incoming.id, R_BUSY); closeCard(); incoming = null; return; }   // paused, game over: nothing to answer with
    if (now > incoming.until) { decline(incoming); closeCard(); return; }
    if (!here(incoming.from) || dist(incoming.from) > FAR_R * 1.5) { closeCard(); incoming = null; }   // its giver left or drove away: the card would be a question about nobody
  }
  // ---------- name card (same words as the relay client's, src/net.js) ----------
  // The notice behind the i: three short paragraphs, kept true by hand (docs/P2P-MULTIPLAYER.md, joinlog/README.md). The second one follows PLAYLOG_ON.
  // WHO_SEES is the one sentence about who can see a player: if that changes (who is told what), change it here and nowhere else.
  const WHO_SEES = {
    it: 'Se giochi online, i giocatori più vicini a te, ovunque siano in città, vedono il tuo nome, la tua posizione e il tuo indirizzo IP: una connessione diretta funziona così. I server che mettono in contatto i giocatori vedono anche il tuo indirizzo IP. Su una lista pubblica, senza nomi, si legge in quale zona di 500 m è ogni giocatore online.',
    en: 'If you play online, the players closest to you, wherever they are in the city, can see your name, your position and your IP address: that is how a direct connection works. The servers that connect players see your IP address too. A public list, with no names, shows which 500 m area each online player is in.' };
  const KEPT = {
    it: 'Non raccogliamo informazioni personali. Non teniamo il tuo indirizzo, la tua posizione né un identificativo che dura nel tempo.',
    en: 'We do not collect personal information. We keep no address, no position and no ID that lasts.' };
  const STATS = {
    it: 'Ogni giocatore, anche da solo, invia conteggi anonimi su come gioca e su come gira il gioco: missioni, soldi, chilometri, fotogrammi. Se giochi online, salviamo con loro anche il nome che scegli, quindi meglio un soprannome. Teniamo tutto fino a 12 mesi.',
    en: 'Every player, even playing alone, sends anonymous counts about how they play and how the game runs: missions, money, distance, frame rate. If you play online, we save the name you chose with them, so pick a nickname. We keep it all for up to 12 months.' };
  const NONE = { it: 'Non salviamo nulla.', en: 'We store nothing.' };
  const NAME_TXT = { it: { ask: 'Come ti chiami?', again: 'Online o da solo?', sub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', save: 'Salva', close: 'Chiudi', solo: 'Gioca da solo', info: 'Privacy e dati', back: 'Indietro' },
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
      myName = n; named = true; agreed = true; saveStore({ name: n, offline: false }); goLoud();
      dropName(); dispatchEvent(new Event('pd-net-changed'));
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
    if (e.detail) { if (!myName) return; named = true; agreed = true; saveStore({ name: myName, offline: false }); goLoud(); }
    else { agreed = false; saveStore({ offline: true }); goOffline(); }
    dispatchEvent(new Event('pd-net-changed')); dropName();
  });
  document.documentElement.classList.add('pd-mp');

  function goOffline() {
    panel.clear(); wheel.close(); presence.stop(true); home = null; lastListed = ''; banned.clear();   // no list of who is online, no more events
    for (const r of [...rooms.values()]) leaveCell(r);
    for (const p of peers.values()) if (p.shown) rm.remove(p.id);
    peers.clear(); myOffer = null; incoming = null; closeCard(); note(null);   // an offer in the air is over with the player it was for
    goQuiet();
  }
  // Solo by choice means no connection at all: the relay sockets are shut and Trystero is told not to reopen them (pauseRelayReconnection, resumeRelayReconnection),
  // until the player says yes again. A page that starts solo never opens them. The browser's own offline and online events are followed by hand, the way Trystero does it by default, except that "online" does not resume while quiet.
  let quiet = false, quietT = 0;
  const shutSockets = () => { for (const w of Object.values(strat.sockets() || {})) if (w && w.readyState < 2) { try { w.close(); } catch (e) { /* already closing */ } } };
  function goQuiet() { quiet = true; pauseRelayReconnection(); shutSockets(); }
  function goLoud() { if (!quiet) return; quiet = false; resumeRelayReconnection(); }
  // a page in the background has no frames, so update() below does not run there: its own timer ends presence after PRESENCE_IDLE_MS hidden (it starts again on the first frame back)
  let hiddenTimer = null;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(hiddenTimer); hiddenTimer = null;
    if (document.hidden && presenceOn) hiddenTimer = setTimeout(() => { if (presence.running) { presence.stop(true); home = null; lastListed = ''; } }, IDLE_MS);
  });
  addEventListener('offline', () => pauseRelayReconnection());
  addEventListener('online', () => { if (!quiet) resumeRelayReconnection(); });

  // ---------- the cap on players, whatever the rooms hold ----------
  // The rooms are chosen so that the players in them add up to MAXP, but presence lags, and a room can hold more by the time we are in it. So the players actually
  // connected are ranked by distance as well: only the closest MAXP are sent to, drawn or listened to (a farther one in a room is connected, and idle). A player
  // beyond DRAW_R is a dot with a name on the maps, not a car.
  function rank(now) {
    const known = [], unknown = [];
    for (const p of peers.values()) { if (!p.rooms.size) continue; (Number.isFinite(p.x) ? known : unknown).push(p); }
    const dist = p => Math.hypot(p.x - car.x, p.z - car.z);
    known.sort((a, b) => dist(a) - (a.held ? 50 : 0) - (dist(b) - (b.held ? 50 : 0)));
    const slots = MAXP;   // a player we have not heard a position from yet takes no slot (it sends us its first state within a moment, and then it is ranked); it is sent to, so that it can rank us
    known.forEach((p, n) => {
      p.held = n < slots;
      if (!p.shown) return;
      if (!p.held) { rm.remove(p.id); p.shown = false; p.seq = -1; ev('unheld', { peer: p.id.slice(0, 4) }); return; }
      const d = dist(p), far = p.far ? d > DRAW_R : d > DRAW_OUT;
      if (far !== p.far) { p.far = far; rm.setFar(rm.remotes.get(p.id), far); ev(far ? 'far' : 'near', { peer: p.id.slice(0, 4), m: Math.round(d) }); }
    });
    for (const p of unknown) p.held = true;
  }
  // ---------- frame ----------
  let idleSince = 0, hudT = 0, sendAcc = 0, linkTxt = '-', linkT = 0;
  function update(dt) {
    const now = performance.now();
    const playing = game.state === 'play', on = online();
    if (!on || !playing) panel.set({ show: false, title: '', sub: '', label: '' });
    else {   // the multiplayer section: how many are connected, how many of them can see what we say (within DRAW_R)
      let linked = 0; for (const p of peers.values()) if (p.rooms.size && p.held !== false) linked++;
      const near = inReach(), keys = !document.documentElement.classList.contains('touch');
      panel.set({
        show: true, idle: !near, open: wheel.isOpen, label: tr('Parla', 'Talk') + (keys ? ' (T)' : ''),
        title: linked ? tr(`${linked} ${linked === 1 ? 'giocatore' : 'giocatori'}`, `${linked} ${linked === 1 ? 'player' : 'players'}`) : 'Online',
        sub: !linked ? tr('ancora nessuno', 'no one yet') : near ? tr(`${near} entro ${DRAW_R} m`, `${near} within ${DRAW_R} m`) : tr(`nessuno entro ${DRAW_R} m`, `none within ${DRAW_R} m`),
      });
    }
    if (wheel.isOpen && !(on && playing && inReach())) wheel.close();   // nobody within reach any more, or paused: nothing to say
    offerClocks(now, playing); if (playing) arrivals(now);
    if (!started) { if (game.state !== 'play') return; started = true; ev('start', { x: Math.round(car.x), z: Math.round(car.z) }); if (!(named && agreed) && !screenshots) setTimeout(openName, 800); }
    if (quiet && now - quietT > 2000) { quietT = now; shutSockets(); }   // a relay that was already waiting to retry opens once more: shut it again
    if (!named || !agreed) { rm.update(dt, now); return; }
    if (presenceOn) {   // publishing and reading who is online: only while the game is being played and looked at (a phone in the background sends nothing)
      if (playing && !document.hidden) { idleSince = 0; if (!presence.running && !quiet) presence.start(); }
      else { if (!idleSince) idleSince = now; if (presence.running && now - idleSince > IDLE_MS) { presence.stop(true); home = null; lastListed = ''; } }
    }
    if (now - lastChecked > CHECK_MS) { lastChecked = now; evaluate(now); rank(now); }
    sendAcc += dt * 1000;
    if (sendAcc >= SEND_NEAR - 5) {
      sendAcc = 0;
      const key2 = myName + '|' + vehId() + '|' + livId();
      if (key2 !== lastInfoKey) { lastInfoKey = key2; for (const r of rooms.values()) sendInfoTo(r, null); }
      if (game.state === 'play') sendStateTo([...peers.keys()], now, false);
    }
    for (const p of peers.values()) {
      if ((p.goneAt && now - p.goneAt > GONE_MS) || (!p.rooms.size && !p.goneAt)) {
        if (p.shown) rm.remove(p.id);
        ev('drop', { peer: p.id.slice(0, 4), why: 'left' });
        peers.delete(p.id);
      } else if (p.shown && now - p.lastRx > STALE_MS) {
        // quiet for a while (the other page was locked, or in the background): take the car off the street but keep the record, the connection
        // is still open and nothing would add it again. Its next STATE shows it again with the name and livery we already have.
        rm.remove(p.id); p.shown = false; p.seq = -1;
        ev('drop', { peer: p.id.slice(0, 4), why: 'stale' });
      }
    }
    rm.update(dt, now);
    if (testing && now - hudT > 500) {
      hudT = now;
      if (now - linkT > 3000 && peers.size) { linkT = now; wire().then(w => { linkTxt = `${w.open}/${w.pcs} open: direct ${w.link.host}, stun ${w.link.srflx + w.link.prflx}, relay ${w.link.relay}  up ${(w.sent / 1024).toFixed(0)} KB dn ${(w.recv / 1024).toFixed(0)} KB`; }).catch(() => {}); }
      hud.textContent = `p2p ${kind} ${grid3 ? 'grid3' : 'near'} cell ${CELL} m  ${myName}\nrooms ${[...rooms.values()].map(r => `${r.i},${r.j}${r.s ? '/' + r.s : ''}:${r.peers.size}`).join(' ')}  online ${presenceOn ? presence.size : '-'} (max ${MAXP})\npeers ${peers.size} drawn ${rm.remotes.size}  tx ${stats.txMsgs} rx ${stats.rxMsgs}\nlinks ${linkTxt}`;
    }
  }

  async function wire() {   // WebRTC byte counters across every connection, for the measurements
    let sent = 0, recv = 0, pcs = 0, open = 0, tsent = 0, trecv = 0; const link = { host: 0, srflx: 0, prflx: 0, relay: 0 };
    const seen = new Set();
    for (const r of rooms.values()) for (const pc of Object.values(r.room.getPeers())) {
      if (seen.has(pc)) continue; seen.add(pc);   // one shared connection can show up in several rooms
      pcs++; if (pc.connectionState === 'connected') open++;
      try { const st = await pc.getStats(); for (const s of st.values()) { if (s.type === 'transport' && s.selectedCandidatePairId) { const cp = st.get(s.selectedCandidatePairId), lc = cp && st.get(cp.localCandidateId), rc = cp && st.get(cp.remoteCandidateId); const ty = [lc && lc.candidateType, rc && rc.candidateType]; const w = ty.includes('relay') ? 'relay' : ty.includes('prflx') || ty.includes('srflx') ? 'srflx' : 'host'; link[w]++; } if (s.type === 'data-channel') { sent += s.bytesSent || 0; recv += s.bytesReceived || 0; } else if (s.type === 'transport') { tsent += s.bytesSent || 0; trecv += s.bytesReceived || 0; } } } catch (e) { /* ignore */ }
    }
    return { pcs, open, sent, recv, tsent, trecv, link };
  }

  const api = {
    enabled: true, update, openName, players: () => rm.list(), get online() { return peers.size > 0; },
    isOnline: online,
    statsName: () => named && agreed && !quiet && rooms.size > 0 ? myName : '',   // the play log (src/playlog.js) sends the name only while the player is online by their own yes; solo and unanswered send none
    debug: { log, stats, rooms, peers, remotes: rm.remotes, wire, selfId, kind, CELL, MARGIN, HYST, grid3, relays: () => [...Object.keys(strat.sockets() || {}).map(u => [u, (strat.sockets()[u] || {}).readyState]), ...presence.sockets()],   // the room signalling sockets, then the presence ones
      peerInfo: () => [...peers.values()].map(p => ({ id: p.id.slice(0, 4), rooms: [...p.rooms].map(k => k.split(':').slice(2).join(',')), shown: p.shown, held: p.held, far: p.far, age: Math.round(performance.now() - p.lastRx), x: Math.round(p.x), nextIn: Math.round(p.nextTx - performance.now()) })),
      presence, MAXP, home: () => home && { ...home }, banned,
      rawSockets: () => strat.sockets() || {},   // test hook: the signalling WebSockets themselves
      wallet: () => garage.cash, free: () => freeLeft(), spend: n => garage.debit(n),   // test hooks (tools/p2p/offer.mjs)
      resetOffers(keepMute) { lastOfferAt = -1e9; for (const p of peers.values()) { p.lastOffer = 0; if (!keepMute) p.mutedUntil = 0; } },
      inMission, forceBusy: b => { busyForce = b; },
      say, offer, inReach, feedLine: (name, idx, mine) => panel.line(name, SAID[lang()], PHRASES[idx], !!mine),   // test hooks (tools/p2p/feed.mjs, the screenshots): a line in the section, and the peers' reach
      name: () => myName, offerState: () => ({ myOffer, incoming: incoming && { ...incoming }, card: !!card, muted: [...peers.values()].map(p => p.mutedUntil || 0) }), gameState: () => game.state,
      setName: n => { myName = clean(n) || myName; },
      // test hook (tools/p2p/fuzz.mjs): feeds hostile messages from a made-up peer through the real handlers
      fuzz(msgs, refill = true) {
        const id = 'fuzz-peer', r = { key: 'fuzz' }; peers.get(id) || peers.set(id, newPeer(id)); const p = peers.get(id); let threw = 0;
        for (const [kind, bytes] of msgs) { if (refill) p.tokens = RATE_BURST; try { if (kind === 'o') onOffer(id, bytes); else (kind === 'i' ? onInfo : onState)(r, id, bytes); } catch (e) { threw++; } }
        return { threw, h: p.h, name: p.name, vehicle: p.vehicle, livery: p.livery, rxBad: stats.rxBad, rxDropped: stats.rxDropped, drawn: rm.remotes.size };
      } },
  };
  window.__p2p = api.debug;
  addEventListener('pagehide', () => { for (const r of rooms.values()) { try { r.room.leave(); } catch (e) { /* ignore */ } } });
  return api;
}
