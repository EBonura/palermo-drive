// Peer to peer multiplayer experiment (?p2p): no server of ours. Players find each other through public signalling (Trystero:
// Nostr relays by default, ?p2p=torrent or ?p2p=mqtt for the others) and then talk over WebRTC data channels.
// Write-up, numbers and the recommendation: docs/P2P-MULTIPLAYER.md. Off unless the page is opened with ?p2p.
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
//   INFO  [1][livery u8][nameLen u8][name utf8]       sent to a new peer and when the name or livery changes
//   SAY   [3][phrase index u8]                        one of PHRASES (src/p2p/phrases.js), shown as a bubble over the sender's car
//   OFFER [4][kind u8][offer id u8]                   a drink (0 cicchetto, 1 birra) for a player close by; ACCEPT [5][id] answers it, CONFIRM [6][id] says the giver paid
//   STATE [2][seq u8][state 11 bytes]                 position 5 bytes, heading u8, speed i8, steer i8, roll i8, lean i8, flags u8
import { createRemotes } from '../remotes.js';
import { strategies, selfId } from './trystero.js';
import { PHRASES } from './phrases.js';
import { garage } from '../garage.js';

const APP_ID = 'palermo-drive-p2p-exp-1';
const POS_UNITS = 20, POS_MID = 1 << 19, POS_MAX = (1 << 20) - 1;
const TAU = Math.PI * 2;
const MAX_NAME_BYTES = 64, MAX_NAME_RUNES = 16, MAX_LIVERY = 15;
const MAX_REMOTES = 48;        // players drawn at once; more are ignored
const STATE_LEN = 11, MSG_STATE = 2 + STATE_LEN, MSG_INFO_MAX = 3 + MAX_NAME_BYTES;
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
  const relayConfig = relayUrls.length ? { urls: relayUrls } : { redundancy: num('red', 3, 1, 10) };
  const log = [];   // timing events for the measurements: { t, ev, ... }
  const ev = (name, o) => { const e = { t: Math.round(performance.now()), ev: name, ...o }; log.push(e); if (log.length > 2000) log.shift(); };

  const clean = s => Array.from(String(s).replace(/[\p{C}\p{Zl}\p{Zp}‎‏‪-‮⁦-⁩]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_RUNES).join('');
  const STORE_KEY = 'palermoDrive.net.v1';   // the relay client's save: { name, offline }; the name is shared between the two clients
  const stored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  let myName = clean(params.get('name') || stored().name || '');
  let named = !!myName;   // nothing is joined until the player has a name (card below)
  if (!myName) myName = 'P2P' + selfId.slice(0, 3);
  const livId = () => Math.max(0, (vehicle.LIVERIES || []).findIndex(l => l.id === car.livery));

  const rm = createRemotes(env);
  const rooms = new Map();   // key -> { key, i, j, room, state, info, peers: Set, t0, tFirstPeer, joined }
  const peers = new Map();   // peerId -> { id, rooms: Set(roomKey), name, livery, seq, lastRx, x, z, nextTx, goneAt, tokens, tokT, rx }
  const stats = { txMsgs: 0, txBytes: 0, rxMsgs: 0, rxBytes: 0, rxDropped: 0, rxDup: 0, rxBad: 0, joins: 0, leaves: 0 };
  let mySeq = 0, lastChecked = -1e9, lastInfoKey = '', started = false;

  // ---------- HUD (debug) ----------
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;z-index:30;left:8px;top:8px;padding:4px 8px;border-radius:6px;background:rgba(13,7,9,.74);color:#fff;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);

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
  const newPeer = id => ({ id, rooms: new Set(), name: '', livery: -1, seq: -1, lastRx: 0, x: NaN, z: NaN, nextTx: 0, goneAt: 0, tokens: RATE_BURST, tokT: performance.now(), shown: false });

  // ---------- outgoing ----------
  const route = p => { let best = null; for (const k of p.rooms) if (rooms.has(k) && (best === null || k < best)) best = k; return best; };
  function sendInfoTo(r, id) {
    const nm = new TextEncoder().encode(myName).slice(0, MAX_NAME_BYTES);
    const b = new Uint8Array(3 + nm.length); b[0] = 1; b[1] = livId(); b[2] = nm.length; b.set(nm, 3);
    stats.txMsgs++; stats.txBytes += b.length;
    r.info.send(b, id ? { target: id } : undefined).catch(() => {});
  }
  function packState() {
    const b = new Uint8Array(MSG_STATE), dv = new DataView(b.buffer);
    b[0] = 2; b[1] = mySeq = (mySeq + 1) & 255;
    const xq = clamp(Math.round(car.x * POS_UNITS) + POS_MID, 0, POS_MAX), zq = clamp(Math.round(car.z * POS_UNITS) + POS_MID, 0, POS_MAX);
    dv.setUint32(2, (xq | ((zq & 0xfff) << 20)) >>> 0, true); b[6] = zq >>> 12;
    b[7] = Math.round(((car.th % TAU) + TAU) % TAU / TAU * 256) & 255;
    dv.setInt8(8, clamp(Math.round((car.vf || 0) * 2), -127, 127)); dv.setInt8(9, q8(car.steer || 0, 0.7)); dv.setInt8(10, q8(car.roll || 0, 0.5)); dv.setInt8(11, q8((car.tip || 0) * Math.sign(car.ay || 0), 1));
    b[12] = (car.nosAmt > 0.15 ? 1 : 0) | (car.braking ? 2 : 0) | (car.drift > 0.3 ? 4 : 0);
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
    if (!p || !b || b.length < 3 || b.length > MSG_INFO_MAX || b[0] !== 1 || b.length !== 3 + b[2] || b[2] > MAX_NAME_BYTES) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now)) { stats.rxDropped++; return; }
    if (b[1] > MAX_LIVERY) { stats.rxBad++; return; }
    p.name = clean(new TextDecoder().decode(b.subarray(3))) || 'Player'; p.livery = b[1];
    p.lastRx = now;
    if (p.shown) rm.setInfo(rm.remotes.get(id), p.name, p.livery);
  }
  function onState(r, id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== MSG_STATE || b[0] !== 2) { stats.rxBad++; return; }
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
    p.x = x; p.z = z; p.lastRx = now;
    if (p.livery < 0) return;   // INFO not here yet (it was sent first, and arrives first unless it came through another room)
    if (!p.shown) {
      if (rm.remotes.size >= MAX_REMOTES) return;
      p.shown = true; rm.setInfo(rm.ensure(id), p.name || 'Player', p.livery);
      ev('firstState', { peer: id.slice(0, 4), room: r.key, msSinceRoom: Math.round(now - r.t0) });
    }
    const rem = rm.remotes.get(id); if (!rem) return;
    rm.addSnap(rem, { t: now, x, z, th: b[7] / 256 * TAU, v, steer: dv.getInt8(9) / 127 * 0.7, roll: dv.getInt8(10) / 127 * 0.5, lean: dv.getInt8(11) / 127, fl: b[12] });
  }

  function onSay(id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== 2 || b[0] !== 3 || b[1] >= PHRASES.length) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now) || now - (p.lastSay || -1e9) < SAY_GAP_MS * 0.8) { stats.rxDropped++; return; }
    const rem = rm.remotes.get(id); if (!rem) return;   // only players we can see
    p.lastSay = now; rm.say(rem, PHRASES[b[1]], now);
  }
  let lastSaid = -1e9;
  function say(idx) {
    const now = performance.now(); if (!(idx >= 0 && idx < PHRASES.length) || now - lastSaid < SAY_GAP_MS) return false;
    lastSaid = now; const b = new Uint8Array([3, idx]), byRoom = new Map();
    for (const p of peers.values()) { const k = route(p); if (k !== null) { if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(p.id); } }
    for (const [k, list] of byRoom) { stats.txMsgs += list.length; stats.txBytes += 2 * list.length; rooms.get(k).say.send(b, { target: list }).catch(() => {}); }
    return true;
  }
  // a small button and list of the phrases (debug-grade UI for the experiment; text set with textContent)
  const chat = document.createElement('div');
  chat.style.cssText = 'position:fixed;z-index:31;left:8px;top:64px;font:600 14px system-ui,sans-serif;color:#fff';
  const chatBtn = document.createElement('button'); chatBtn.type = 'button'; chatBtn.textContent = '💬';
  chatBtn.style.cssText = 'width:44px;height:44px;border-radius:99px;border:2px solid #e8559a;background:rgba(13,7,9,.8);color:#fff;font-size:20px;cursor:pointer';
  const chatList = document.createElement('div'); chatList.style.cssText = 'display:none;margin-top:6px;padding:6px;border-radius:12px;background:rgba(13,7,9,.92);border:2px solid #e8559a;max-height:60vh;overflow:auto';
  PHRASES.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s;
    b.style.cssText = 'display:block;width:100%;text-align:left;min-height:40px;margin:2px 0;padding:6px 12px;border-radius:9px;border:1.5px solid #5a4a50;background:transparent;color:#fff;font:inherit;cursor:pointer';
    b.addEventListener('click', () => { if (say(i)) { chatList.style.display = 'none'; } });
    chatList.appendChild(b);
  });
  chatBtn.addEventListener('click', () => { chatList.style.display = chatList.style.display === 'none' ? 'block' : 'none'; });
  chat.addEventListener('click', e => { if (e.target instanceof HTMLElement) e.target.blur(); });   // so that the arrow keys go on driving
  chat.append(chatBtn, chatList); document.body.appendChild(chat);

  // ---------- a drink for somebody close by ----------
  // Giver: picks cicchetto or birra, the nearest visible player within OFFER_R gets an OFFER and a card with Accetta / Nun mi va. On ACCEPT the
  // giver pays DRINK_PRICE from the Garage wallet and sends CONFIRM; only then does the receiver get the drink (drunk.gift). Nothing happens to
  // anybody without their own yes, and every message is checked like the others.
  const KINDS = ['cicchetto', 'birra'], KIND_TXT = { it: ['un cicchetto', 'una birra'], en: ['a cicchetto', 'a beer'] };   // wording to be corrected by the owner
  const lang = () => { let l = 'it'; try { l = (JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || 'null') || {}).lang; } catch (e) { /* ignore */ } return params.get('lang') === 'en' || l === 'en' ? 'en' : 'it'; };
  const TOAST_IDX = PHRASES.indexOf('a to saluti!');
  let myOffer = null, lastOfferAt = -1e9, incoming = null, offerSeq = 0, card = null, notice = null;
  const sendOffer = (id, bytes) => { const p = peers.get(id), k = p && route(p); if (k === null || k === undefined) return; stats.txMsgs++; stats.txBytes += bytes.length; rooms.get(k).offer.send(bytes, { target: id }).catch(() => {}); };
  function say2(text) { if (!notice) { notice = document.createElement('div'); notice.style.cssText = 'position:fixed;z-index:40;left:50%;bottom:90px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(13,7,9,.92);border:2px solid #e8559a;color:#fff;font:600 14px system-ui,sans-serif'; document.body.appendChild(notice); } notice.textContent = text; notice.style.display = ''; clearTimeout(notice.t); notice.t = setTimeout(() => { notice.style.display = 'none'; }, 3000); }
  function offer(kind) {
    const now = performance.now(); if (kind !== 0 && kind !== 1) return false;
    if (now - lastOfferAt < OFFER_GAP_MS || (myOffer && now < myOffer.until)) return false;
    let best = null, bd = OFFER_R;
    for (const [id, rem] of rm.remotes) { const p = peers.get(id); if (!p || !p.shown || !rem.snaps.length) continue; const d = Math.hypot(p.x - car.x, p.z - car.z); if (d < bd) { bd = d; best = id; } }
    if (!best) { say2(lang() === 'en' ? 'Nobody close enough' : 'Nessuno vicino'); return false; }
    if (garage.cash < DRINK_PRICE) { say2(lang() === 'en' ? 'Not enough money' : 'Sienza picciuli!'); return false; }
    lastOfferAt = now; myOffer = { to: best, id: (offerSeq = (offerSeq + 1) & 255), kind, until: now + OFFER_TTL_MS };
    sendOffer(best, new Uint8Array([4, kind, myOffer.id]));
    say2(lang() === 'en' ? 'Offer sent' : 'Offerta mandata');
    return true;
  }
  function closeCard() { if (card) { card.remove(); card = null; } }
  function onOffer(id, raw) {
    const p = known(id), b = plain(raw), now = performance.now(); stats.rxMsgs++;
    if (!p || !b || b.length !== 3 || b[0] < 4 || b[0] > 6) { stats.rxBad++; return; }
    stats.rxBytes += b.length;
    if (!admit(p, now)) { stats.rxDropped++; return; }
    if (b[0] === 4) {   // OFFER
      const rem = rm.remotes.get(id);
      if (b[1] > 1 || !rem || !p.shown || Math.hypot(p.x - car.x, p.z - car.z) > OFFER_R * 1.6 || incoming || now - (p.lastOffer || -1e9) < OFFER_GAP_MS * 0.8 || game.state !== 'play') { stats.rxDropped++; return; }
      p.lastOffer = now; incoming = { from: id, id: b[2], kind: b[1], until: now + OFFER_TTL_MS, accepted: false };
      const en = lang() === 'en', what = KIND_TXT[en ? 'en' : 'it'][b[1]];
      closeCard(); card = document.createElement('div');
      card.style.cssText = 'position:fixed;z-index:60;left:50%;bottom:120px;transform:translateX(-50%);width:min(320px,calc(100vw - 24px));box-sizing:border-box;padding:12px;border-radius:14px;background:rgba(13,7,9,.94);border:2px solid #e8559a;color:#fff;font:14px/1.35 system-ui,sans-serif';
      const q = document.createElement('div'); q.style.cssText = 'font-weight:700;margin-bottom:8px'; q.textContent = en ? `${p.name} offers you ${what}` : `${p.name} ti offre ${what}`;
      const mk = (txt, yes) => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = txt; bt.style.cssText = 'min-height:40px;margin-right:8px;padding:6px 14px;border-radius:9px;border:1.5px solid #e8559a;background:' + (yes ? '#e8559a' : 'transparent') + ';color:' + (yes ? '#0d0709' : '#fff') + ';font:700 14px system-ui,sans-serif;cursor:pointer'; bt.addEventListener('click', () => { bt.blur(); if (yes && incoming) { incoming.accepted = true; sendOffer(incoming.from, new Uint8Array([5, 0, incoming.id])); } else incoming = null; closeCard(); }); return bt; };
      card.append(q, mk(en ? 'Accept' : 'Accetta', true), mk(en ? 'No thanks' : 'Nun mi va', false)); document.body.appendChild(card);
    } else if (b[0] === 5) {   // ACCEPT, to the giver
      if (!myOffer || myOffer.to !== id || myOffer.id !== b[2] || now > myOffer.until) { stats.rxDropped++; return; }
      const o = myOffer; myOffer = null;
      if (garage.cash >= DRINK_PRICE && garage.debit(DRINK_PRICE) >= DRINK_PRICE) {
        sendOffer(id, new Uint8Array([6, o.kind, o.id]));
        const rem = rm.remotes.get(id); if (rem && TOAST_IDX >= 0) rm.say(rem, PHRASES[TOAST_IDX], now);
        say2(lang() === 'en' ? `Cheers! -${DRINK_PRICE} €` : `Saluti! -${DRINK_PRICE} €`);
      }
    } else if (b[0] === 6) {   // CONFIRM, to the receiver: the giver paid
      if (!incoming || incoming.from !== id || incoming.id !== b[2] || !incoming.accepted || now > incoming.until + 5000) { stats.rxDropped++; return; }
      const o = incoming; incoming = null;
      const d = env.getDrunk && env.getDrunk(); if (d && d.gift) d.gift(KIND_TXT.it[o.kind].replace(/^una? /, '').replace(/^./, c => c.toUpperCase()));
      const rem = rm.remotes.get(id); if (rem && TOAST_IDX >= 0) rm.say(rem, PHRASES[TOAST_IDX], now);
    }
  }
  const offerBox = document.createElement('div');
  offerBox.style.cssText = 'position:fixed;z-index:31;left:60px;top:64px;font:600 14px system-ui,sans-serif;color:#fff';
  const offerBtn = document.createElement('button'); offerBtn.type = 'button'; offerBtn.textContent = '🍺';
  offerBtn.style.cssText = 'width:44px;height:44px;border-radius:99px;border:2px solid #e8559a;background:rgba(13,7,9,.8);color:#fff;font-size:20px;cursor:pointer';
  const offerList = document.createElement('div'); offerList.style.cssText = 'display:none;margin-top:6px;padding:6px;border-radius:12px;background:rgba(13,7,9,.92);border:2px solid #e8559a';
  KINDS.forEach((k, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${k} (${DRINK_PRICE} €)`; b.style.cssText = 'display:block;width:100%;text-align:left;min-height:40px;margin:2px 0;padding:6px 12px;border-radius:9px;border:1.5px solid #5a4a50;background:transparent;color:#fff;font:inherit;cursor:pointer'; b.addEventListener('click', () => { b.blur(); offerList.style.display = 'none'; offer(i); }); offerList.appendChild(b); });
  offerBtn.addEventListener('click', () => { offerBtn.blur(); offerList.style.display = offerList.style.display === 'none' ? 'block' : 'none'; });
  offerBox.append(offerBtn, offerList); document.body.appendChild(offerBox);

  // ---------- name card (same words as the relay client's, src/net.js) ----------
  const NAME_TXT = { it: { ask: 'Come ti chiami?', sub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', save: 'Salva', close: 'Chiudi' },
    en: { ask: "What's your name?", sub: 'Drive online with other players. You can change it any time.', edit: 'Your name', ph: 'Name', join: 'Play online', save: 'Save', close: 'Close' } };
  let nameCard = null, submitName = null, closeName = null;
  function openName() {
    if (nameCard) { nameCard.remove(); nameCard = null; }
    const tx = NAME_TXT[lang()], editing = named;
    nameCard = document.createElement('div'); nameCard.setAttribute('role', 'dialog');
    nameCard.style.cssText = 'position:fixed;z-index:70;left:50%;bottom:120px;transform:translateX(-50%);width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:14px;border-radius:14px;background:rgba(13,7,9,.94);border:2px solid #e8559a;color:#fff;font:14px/1.35 system-ui,sans-serif';
    if (window.matchMedia('(max-height:500px)').matches) nameCard.style.bottom = '12px';
    const h = document.createElement('b'); h.style.cssText = 'display:block;font-size:17px;color:#ff6fae'; h.textContent = editing ? tx.edit : tx.ask;
    const sub = document.createElement('small'); sub.style.cssText = 'display:block;opacity:.7;margin:2px 0 10px;font-size:12px'; sub.textContent = editing ? '' : tx.sub;
    const input = document.createElement('input'); input.maxLength = 16; input.placeholder = tx.ph; input.value = named ? myName : ''; input.autocomplete = 'off'; input.spellcheck = false;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;font:600 16px system-ui,sans-serif;padding:9px 11px;margin-bottom:8px;border-radius:9px;border:1.5px solid #5a4a50;background:#1b1115;color:#fff;outline:none';
    const ok = document.createElement('button'), no = document.createElement('button');
    for (const b of [ok, no]) { b.type = 'button'; b.style.cssText = 'min-height:40px;margin-right:8px;padding:6px 14px;border-radius:9px;border:1.5px solid #e8559a;background:transparent;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer'; }
    ok.style.background = '#e8559a'; ok.style.color = '#0d0709'; ok.textContent = editing ? tx.save : tx.join; no.textContent = tx.close;
    const submit = () => {
      const n = clean(input.value); if (!n) { input.focus(); return; }
      myName = n; named = true; try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...stored(), name: n, offline: false })); } catch (e) { /* private mode: fine */ }
      nameCard.remove(); nameCard = null;
    };
    submitName = submit; closeName = () => { nameCard.remove(); nameCard = null; };
    ok.addEventListener('click', submit); no.addEventListener('click', closeName);
    nameCard.append(h, sub, input, ok); if (editing) nameCard.append(no);
    document.body.appendChild(nameCard); if (window.matchMedia('(pointer:fine)').matches) input.focus();
  }
  // Typing a name must not drive the car or open the pause menu (P and Escape): the game's own key handler (src/ui.js) is a window capture listener
  // too, but it is added after this one, so this runs first and keeps the keys for the card. Enter and Escape are handled here, letters still reach the box.
  addEventListener('keydown', e => {
    if (!nameCard || !nameCard.contains(e.target)) return;
    e.stopImmediatePropagation();
    if (e.key === 'Enter') { e.preventDefault(); submitName && submitName(); } else if (e.key === 'Escape') { e.preventDefault(); closeName && closeName(); }
  }, true);
  const nameBtn = document.createElement('button'); nameBtn.type = 'button'; nameBtn.textContent = '✎';
  nameBtn.style.cssText = 'position:fixed;z-index:31;left:112px;top:64px;width:44px;height:44px;border-radius:99px;border:2px solid #e8559a;background:rgba(13,7,9,.8);color:#fff;font-size:20px;cursor:pointer';
  nameBtn.addEventListener('click', () => { nameBtn.blur(); openName(); });
  document.body.appendChild(nameBtn);

  // ---------- frame ----------
  let hudT = 0, sendAcc = 0, linkTxt = '-', linkT = 0;
  function update(dt) {
    const now = performance.now();
    chat.style.display = offerBox.style.display = nameBtn.style.display = game.state === 'play' ? '' : 'none';
    if (incoming && now > incoming.until) { incoming = null; closeCard(); }
    if (!started) { if (game.state !== 'play') return; started = true; ev('start', { x: Math.round(car.x), z: Math.round(car.z) }); if (!named) setTimeout(openName, 800); }
    if (!named) { rm.update(dt, now); return; }
    if (now - lastChecked > CHECK_MS) { lastChecked = now; evaluate(); }
    sendAcc += dt * 1000;
    if (sendAcc >= SEND_NEAR - 5) {
      sendAcc = 0;
      const key2 = myName + '|' + livId();
      if (key2 !== lastInfoKey) { lastInfoKey = key2; for (const r of rooms.values()) sendInfoTo(r, null); }
      if (game.state === 'play') sendStateTo([...peers.keys()], now, false);
    }
    for (const p of peers.values()) {
      if ((p.goneAt && now - p.goneAt > GONE_MS) || (p.shown && now - p.lastRx > STALE_MS) || (!p.rooms.size && !p.goneAt)) {
        if (p.shown) rm.remove(p.id);
        ev('drop', { peer: p.id.slice(0, 4), why: p.goneAt ? 'left' : 'stale' });
        peers.delete(p.id);
      }
    }
    rm.update(dt, now);
    if (now - hudT > 500) {
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
    enabled: true, update, openName() {}, get online() { return peers.size > 0; },
    debug: { log, stats, rooms, peers, remotes: rm.remotes, wire, selfId, kind, CELL, MARGIN, HYST, grid3, relays: () => Object.keys(strat.sockets() || {}).map(u => [u, (strat.sockets()[u] || {}).readyState]),
      say, offer, gameState: () => game.state,
      setName: n => { myName = clean(n) || myName; },
      // test hook (tools/p2p/fuzz.mjs): feeds hostile messages from a made-up peer through the real handlers
      fuzz(msgs, refill = true) {
        const id = 'fuzz-peer', r = { key: 'fuzz' }; peers.get(id) || peers.set(id, newPeer(id)); const p = peers.get(id); let threw = 0;
        for (const [kind, bytes] of msgs) { if (refill) p.tokens = RATE_BURST; try { (kind === 'i' ? onInfo : onState)(r, id, bytes); } catch (e) { threw++; } }
        return { threw, name: p.name, livery: p.livery, rxBad: stats.rxBad, rxDropped: stats.rxDropped, drawn: rm.remotes.size };
      } },
  };
  window.__p2p = api.debug;
  addEventListener('pagehide', () => { for (const r of rooms.values()) { try { r.room.leave(); } catch (e) { /* ignore */ } } });
  return api;
}
