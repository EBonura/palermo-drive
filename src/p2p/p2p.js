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
//   SAY   [3][phrase index u8]                        one of PHRASES (src/p2p/phrases.js), shown as a bubble over the sender's car
//   OFFER [4][kind u8][offer id u8]                   a drink (0 cicchetto, 1 birra) for a player close by; ACCEPT [5][id] answers it, CONFIRM [6][id] says the giver paid
//   STATE [2][seq u8][state 11 bytes][height u16]?    position 5 bytes, heading u8, speed i8, steer i8, roll i8, lean i8, flags u8 (bit 0 nitro, 1 brake, 2 drift, 3 height follows);
//         height: how far the car stands above the ground at its x, z, in tenths of a metre (a bridge deck, a roof, the air: car.lift); sent only above 0.6 m, so a car on the road costs nothing extra
import { createRemotes } from '../remotes.js';
import { getLang as lang } from '../lang.js';   // the language shown, 'it' | 'en' (src/lang.js)
import { strategies, selfId, pauseRelayReconnection, resumeRelayReconnection } from './trystero.js';
import { PHRASES, CATEGORIES } from './phrases.js';
import { createWheel } from './wheel.js';
import { RELAYS } from './relays.js';
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
const SEND_NEAR = 100, SEND_MID = 200, SEND_FAR = 1000; // state interval by distance to the receiver: < 150 m, < 350 m, farther

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
  // nothing is joined until the player has a name and has seen the card. A name saved in the Garage alone isn't a yes, so the yes is stored by itself. Chosen solo: stays solo until the card says otherwise.
  let agreed = testing || !!stored().p2pOk;
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
  let mySeq = 0, lastChecked = -1e9, lastInfoKey = '', started = false;

  // ---------- HUD (debug) ----------
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;z-index:30;left:8px;top:8px;padding:4px 8px;border-radius:6px;background:rgba(13,7,9,.74);color:#fff;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre';
  if (testing) document.body.appendChild(hud);

  // the Garage draws its own screen and the main loop skips the frame (so update() below does not run): the buttons are hidden by a rule that follows the page, not by a frame
  const css = document.createElement('style'); css.textContent = 'html.pd-in-garage .pd-p2p{display:none!important}@keyframes pd-p2p-bar{from{width:100%}to{width:0}}.pd-p2p-bar{animation:pd-p2p-bar ' + OFFER_TTL_MS + 'ms linear forwards}'; document.head.appendChild(css);

  // ---------- rooms ----------
  const key = (i, j) => `${ns}:${CELL}:${i}:${j}`;
  const rectDist = (x, z, i, j) => Math.hypot(Math.max(i * CELL - x, 0, x - (i + 1) * CELL), Math.max(j * CELL - z, 0, z - (j + 1) * CELL));
  function evaluate() {
    const x = car.x, z = car.z, ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {   // MARGIN < CELL: no cell farther than the ring around ours is in reach
      const i = ci + di, j = cj + dj, k = key(i, j);
      if (grid3 || rectDist(x, z, i, j) <= MARGIN) { if (!rooms.has(k)) joinCell(k, i, j); }
    }
    for (const r of [...rooms.values()]) {
      const stay = grid3 ? Math.abs(r.i - ci) <= 1 && Math.abs(r.j - cj) <= 1 : rectDist(x, z, r.i, r.j) <= MARGIN + HYST;
      if (!stay) leaveCell(r);
    }
  }
  function joinCell(k, i, j) {
    const r = { key: k, i, j, room: null, state: null, info: null, peers: new Set(), t0: performance.now(), tFirstPeer: 0, joined: false };
    rooms.set(k, r); stats.joins++;
    try {
      r.room = strat.joinRoom({ appId: APP_ID, relayConfig }, k, { onJoinError: e => ev('joinError', { room: k, error: String(e && e.error) }) });
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
    b[0] = 2; b[1] = mySeq = (mySeq + 1) & 255;
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
      if (!force && now < p.nextTx) continue;
      const d = Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : 0;
      p.nextTx = now + (d < 150 ? SEND_NEAR : d < 350 ? SEND_MID : SEND_FAR) - 5;
      const k = route(p); if (k === null) continue;
      if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(id);
    }
    if (!byRoom.size) return;
    const b = packState();
    for (const [k, list] of byRoom) { stats.txMsgs += list.length; stats.txBytes += b.length * list.length; rooms.get(k).state.send(b, { target: list }).catch(() => {}); }
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
    if (p.livery < 0) return;   // INFO not here yet (it was sent first, and arrives first unless it came through another room)
    if (!p.shown) {
      if (rm.remotes.size >= MAX_REMOTES) return;
      p.shown = true; rm.setInfo(rm.ensure(id), p.name || 'Player', p.livery, p.vehicle);
      ev('firstState', { peer: id.slice(0, 4), room: r.key, msSinceRoom: Math.round(now - r.t0) });
    }
    const rem = rm.remotes.get(id); if (!rem) return;
    rm.addSnap(rem, { t: now, x, z, th: b[7] / 256 * TAU, v, steer: dv.getInt8(9) / 127 * 0.7, roll: dv.getInt8(10) / 127 * 0.5, lean: dv.getInt8(11) / 127, fl: b[12] & 7, h });
  }

  function onSay(id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== 2 || b[0] !== 3 || b[1] >= PHRASES.length) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now) || now - (p.lastSay || -1e9) < SAY_GAP_MS * 0.8) { stats.rxDropped++; return; }
    const rem = rm.remotes.get(id); if (!rem) return;   // only players we can see
    p.lastSay = now; rm.say(rem, PHRASES[b[1]], now); chirp('say');
  }
  let lastSaid = -1e9;
  function say(idx) {
    const now = performance.now(); if (!(idx >= 0 && idx < PHRASES.length) || now - lastSaid < SAY_GAP_MS) return false;
    lastSaid = now; const b = new Uint8Array([3, idx]), byRoom = new Map();
    for (const p of peers.values()) { const k = route(p); if (k !== null) { if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(p.id); } }
    for (const [k, list] of byRoom) { stats.txMsgs += list.length; stats.txBytes += 2 * list.length; rooms.get(k).say.send(b, { target: list }).catch(() => {}); }
    toast(PHRASES[idx]);   // what you said, on your own screen too (the bubble is over your car on theirs)
    return true;
  }
  // the talk wheel (src/p2p/wheel.js): the 💬 button or the T key opens it; categories first, then the phrases of one. The wheel is built from the
  // fixed lists in src/p2p/phrases.js, so what it can send is exactly what the receiver accepts.
  const chat = document.createElement('div');
  chat.className = 'pd-p2p'; chat.style.cssText = 'position:fixed;z-index:31;left:calc(max(10px,env(safe-area-inset-left)) + var(--bar-w) + 8px);top:max(8px,env(safe-area-inset-top));font:600 14px system-ui,sans-serif;color:#fff';   // beside the slim bar top left (src/ui.css), in its row
  const chatBtn = document.createElement('button'); chatBtn.type = 'button'; chatBtn.textContent = '💬'; chatBtn.title = 'T';
  chatBtn.style.cssText = 'width:40px;height:40px;padding:0;border-radius:99px;border:0;background:rgba(13,7,10,.8);box-shadow:0 2px 10px rgba(0,0,0,.3);color:#fff;font-size:19px;line-height:1;cursor:pointer';
  const wheelLang = () => lang() === 'en' ? 'en' : 'it';
  const wheel = createWheel({
    categories: [],   // filled by buildWheel (the language and the offers are read when it opens)
    backLabel: () => wheelLang() === 'en' ? 'back' : 'indietro', closeLabel: () => wheelLang() === 'en' ? 'close' : 'chiudi',
    onClose: () => { chatBtn.blur(); },
  });
  const KIND_NAME = { it: ['Offri un cicchetto', 'Offri una birra'], en: ['Offer a cicchetto', 'Offer a beer'] };
  function buildWheel() {
    const l = wheelLang();
    return CATEGORIES.map(c => ({
      label: c[l], icon: c.icon,
      items: [...c.phrases.map(i => ({ label: PHRASES[i], onPick: () => say(i) })), ...(c.drinks || []).map(k => ({ label: KIND_NAME[l][k], tag: priceTag(), onPick: () => { offer(k); } }))],
    }));
  }
  function openWheel() { wheel.setCategories(buildWheel()); wheel.open(); }
  chatBtn.addEventListener('click', () => { chatBtn.blur(); if (wheel.isOpen) wheel.close(); else openWheel(); });
  // T opens and closes it, 1 to 8 pick, Escape closes: in the capture phase, ahead of the game's own handler (src/ui.js adds its listener later)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const typing = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
    if (typing || nameCard) return;
    if (card && (e.code === 'KeyY' || e.code === 'KeyN')) { e.preventDefault(); e.stopImmediatePropagation(); answer(e.code === 'KeyY'); return; }   // N is the radio's key too: the card has it first
    if (e.code === 'KeyT' && named && game.state === 'play') { e.preventDefault(); e.stopImmediatePropagation(); if (wheel.isOpen) wheel.close(); else openWheel(); return; }
    if (!wheel.isOpen) return;
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') wheel.close(); else wheel.back(); }
    else if (/^(Digit|Numpad)[1-8]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); wheel.pick(+e.code.slice(-1) - 1); }
  }, true);
  chat.addEventListener('click', e => { if (e.target instanceof HTMLElement) e.target.blur(); });   // so that the arrow keys go on driving
  chat.append(chatBtn); document.body.appendChild(chat);

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
  const NAME_TXT = { it: { ask: 'Come ti chiami?', sub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', priv: 'Online i giocatori vicini vedono il tuo nome, la tua posizione e il tuo indirizzo IP, e i server che ci mettono in contatto sanno in che zona (500 m) sei.' + (PLAYLOG_ON ? ' Tutti i giocatori, anche da soli, inviano statistiche anonime su come giocano e su come gira il gioco (missioni, soldi, chilometri, fotogrammi): si spengono in Opzioni, Statistiche di gioco. Se giochi online salviamo anche il nome che scegli. Teniamo tutto fino a 12 mesi e non salviamo il tuo indirizzo IP.' : ' Non salviamo nulla.'), edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', save: 'Salva', close: 'Chiudi', solo: 'Gioca da solo', info: 'Cosa vedono gli altri' },
    en: { ask: "What's your name?", sub: 'Drive online with other players. You can change it any time.', priv: 'Online, players near you can see your name, your position and your IP address, and the servers that connect us learn which 500 m area you are in.' + (PLAYLOG_ON ? ' Every player, even playing alone, sends anonymous stats about how they play and how the game runs (missions, money, distance, frame rate): turn them off in Options, Game stats. If you play online we also save the name you chose. We keep it all for up to 12 months and do not save your IP address.' : ' We store nothing.'), edit: 'Your name', ph: 'Name', join: 'Play online', save: 'Save', close: 'Close', solo: 'Play alone', info: 'What others can see' } };
  let nameCard = null, submitName = null, closeName = null;
  function openName() {
    refreshName();
    if (nameCard) { nameCard.remove(); nameCard = null; }
    const tx = NAME_TXT[lang()], editing = named && agreed;
    nameCard = document.createElement('div'); nameCard.setAttribute('role', 'dialog');
    nameCard.style.cssText = 'position:fixed;z-index:600;left:50%;bottom:120px;transform:translateX(-50%);width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:14px;border-radius:14px;background:rgba(13,7,9,.94);border:2px solid #e8559a;color:#fff;font:14px/1.35 system-ui,sans-serif';
    if (window.matchMedia('(max-height:500px)').matches) nameCard.style.bottom = '12px';
    const h = document.createElement('b'); h.style.cssText = 'display:block;font-size:17px;color:#ff6fae;padding-right:36px'; h.textContent = editing ? tx.edit : tx.ask;
    const sub = document.createElement('small'); sub.style.cssText = 'display:block;opacity:.7;margin:2px 0 10px;font-size:12px'; sub.textContent = editing ? '' : tx.sub;
    // what others can see: behind the i, opened by a tap on a phone and by hovering or a click with a mouse
    const priv = document.createElement('div'); priv.setAttribute('role', 'tooltip'); priv.textContent = tx.priv;
    priv.style.cssText = 'display:none;position:absolute;left:0;right:0;bottom:calc(100% + 8px);box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(13,7,9,.96);border:1.5px solid #e8559a;color:#fff;font:500 12px/1.4 system-ui,sans-serif';
    const info = document.createElement('button'); info.type = 'button'; info.className = 'p2p-info'; info.textContent = 'i'; info.setAttribute('aria-label', tx.info); info.setAttribute('aria-expanded', 'false');
    info.style.cssText = 'position:absolute;right:10px;top:10px;width:30px;height:30px;padding:0;border-radius:99px;border:1.5px solid #e8559a;background:transparent;color:#fff;font:700 14px Georgia,serif;cursor:pointer';
    const showInfo = on => { priv.style.display = on ? 'block' : 'none'; info.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    let pinned = false;
    info.addEventListener('click', () => { pinned = !pinned; showInfo(pinned); });
    if (window.matchMedia('(hover:hover)').matches) { info.addEventListener('mouseenter', () => showInfo(true)); info.addEventListener('mouseleave', () => showInfo(pinned)); }
    const input = document.createElement('input'); input.maxLength = 16; input.placeholder = tx.ph; input.value = named ? myName : ''; input.autocomplete = 'off'; input.spellcheck = false;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;font:600 16px system-ui,sans-serif;padding:9px 11px;margin-bottom:8px;border-radius:9px;border:1.5px solid #5a4a50;background:#1b1115;color:#fff;outline:none';
    const ok = document.createElement('button'), no = document.createElement('button'), solo = document.createElement('button');
    for (const b of [ok, no, solo]) { b.type = 'button'; b.style.cssText = 'min-height:40px;margin-right:8px;padding:6px 14px;border-radius:9px;border:1.5px solid #e8559a;background:transparent;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer'; }
    ok.style.background = '#e8559a'; ok.style.color = '#0d0709'; ok.textContent = editing ? tx.save : tx.join; no.textContent = tx.close; solo.textContent = tx.solo;
    const submit = () => {
      const n = clean(input.value); if (!n) { input.focus(); return; }
      myName = n; named = true; agreed = true; saveStore({ name: n, p2pOk: true, offline: false }); goLoud();
      nameCard.remove(); nameCard = null;
    };
    submitName = submit; closeName = () => { nameCard.remove(); nameCard = null; };
    ok.addEventListener('click', submit); no.addEventListener('click', closeName); solo.addEventListener('click', () => { agreed = false; saveStore({ p2pOk: false, offline: true }); goOffline(); closeName(); });
    nameCard.append(priv, info, h, sub, input, ok); if (editing) nameCard.append(no); nameCard.append(solo);
    document.body.appendChild(nameCard); if (window.matchMedia('(pointer:fine)').matches) input.focus();
  }
  // Typing a name must not drive the car or open the pause menu (P and Escape): the game's own key handler (src/ui.js) is a window capture listener
  // too, but it is added after this one, so this runs first and keeps the keys for the card. Enter and Escape are handled here, letters still reach the box.
  addEventListener('keydown', e => {
    if (!nameCard || !nameCard.contains(e.target)) return;
    e.stopImmediatePropagation();
    if (e.key === 'Enter') { e.preventDefault(); submitName && submitName(); } else if (e.key === 'Escape') { e.preventDefault(); closeName && closeName(); }
  }, true);
  // the name and the online choice live in Options (src/ui.js), which asks for the card with this event; html.pd-mp tells it that there is multiplayer to choose
  addEventListener('pd-open-name', () => openName());
  document.documentElement.classList.add('pd-mp');

  function goOffline() {
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
  addEventListener('offline', () => pauseRelayReconnection());
  addEventListener('online', () => { if (!quiet) resumeRelayReconnection(); });

  // ---------- frame ----------
  let hudT = 0, sendAcc = 0, linkTxt = '-', linkT = 0;
  function update(dt) {
    const now = performance.now();
    const playing = game.state === 'play', company = playing && rm.remotes.size > 0;   // nobody near: nothing to say or offer, so the buttons stay off the screen
    chat.style.display = company ? '' : 'none';
    if (!company && wheel.isOpen) wheel.close();
    offerClocks(now, playing); if (playing) arrivals(now);
    if (!started) { if (game.state !== 'play') return; started = true; ev('start', { x: Math.round(car.x), z: Math.round(car.z) }); if (!(named && agreed) && !stored().offline && !screenshots) setTimeout(openName, 800); }
    if (quiet && now - quietT > 2000) { quietT = now; shutSockets(); }   // a relay that was already waiting to retry opens once more: shut it again
    if (!named || !agreed) { rm.update(dt, now); return; }
    if (now - lastChecked > CHECK_MS) { lastChecked = now; evaluate(); }
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
      hud.textContent = `p2p ${kind} ${grid3 ? 'grid3' : 'near'} cell ${CELL} m  ${myName}\nrooms ${[...rooms.values()].map(r => `${r.i},${r.j}:${r.peers.size}`).join(' ')}\npeers ${peers.size} drawn ${rm.remotes.size}  tx ${stats.txMsgs} rx ${stats.rxMsgs}\nlinks ${linkTxt}`;
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
    statsName: () => named && agreed && !quiet && rooms.size > 0 ? myName : '',   // the play log (src/playlog.js) sends the name only while the player is online by their own yes; solo and unanswered send none
    debug: { log, stats, rooms, peers, remotes: rm.remotes, wire, selfId, kind, CELL, MARGIN, HYST, grid3, relays: () => Object.keys(strat.sockets() || {}).map(u => [u, (strat.sockets()[u] || {}).readyState]),
      rawSockets: () => strat.sockets() || {},   // test hook: the signalling WebSockets themselves
      wallet: () => garage.cash, free: () => freeLeft(), spend: n => garage.debit(n),   // test hooks (tools/p2p/offer.mjs)
      resetOffers(keepMute) { lastOfferAt = -1e9; for (const p of peers.values()) { p.lastOffer = 0; if (!keepMute) p.mutedUntil = 0; } },
      inMission, forceBusy: b => { busyForce = b; },
      say, offer, name: () => myName, offerState: () => ({ myOffer, incoming: incoming && { ...incoming }, card: !!card, muted: [...peers.values()].map(p => p.mutedUntil || 0) }), gameState: () => game.state,
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
