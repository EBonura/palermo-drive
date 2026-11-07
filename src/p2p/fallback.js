// The relay fallback: game messages through Nostr relays for a player whose direct WebRTC connection does not open (src/p2p/p2p.js decides who; this file only carries).
// Found on real phones (docs/P2P-MULTIPLAYER.md, "Relay fallback"): on mobile data and on a phone's hotspot every pair met in the same room and the signalling went through,
// but no WebRTC connection opened (local addresses hidden behind mDNS, a carrier's shared address that does not hairpin, no TURN server). This is the way round it.
//
// The messages are the game's own binary ones (INFO, STATE, SAY, the offers, src/p2p/p2p.js), base64, in Nostr ephemeral events (kind FB_KIND, in 20000 to 29999: a relay
// forwards them to whoever is subscribed and stores nothing). Content: "1 <sender's Trystero id> <base64> <base64>..." (version, who, up to MAX_MSGS messages). One tag 't' per
// recipient, so one event reaches several players:
//   the room topic  "<app>:fb:<room key>"       a hello (INFO and STATE) to whoever in that room is listening, or a goodbye (no messages)
//   an inbox topic  "<app>:fb:<ns>@<id>"         to that player only: STATE, INFO, SAY, the offers
// Readable by anyone on those relays: nothing goes in that the other players do not already get over WebRTC (name, vehicle, position, phrase, offer), and the author is a key
// made fresh at every start and thrown away, as in src/p2p/presence.js.
//
// Relays: two (FALLBACK_RELAYS). Everybody listens on both and publishes on one of them, picked at random per player (the other if that one refuses, limits or is closed), so
// any two players meet on the relay one of them writes to, nothing arrives twice, and the load is split between the two. A relay that refuses this kind is left for the
// session; one that rate-limits us is left for LIMITED_MS. Sockets are opened only while there is something to do (setActive) and closed IDLE_MS after.
// Every event passes allow() (the limit in src/p2p/guard.js) before it goes, and every frame passes the frame limit in WebSocket.send (src/p2p/p2p.js).
import { schnorr } from './trystero.js';

export const FB_KIND = 20078;       // ephemeral, the 2xxxx twin of presence's 30078
const MAX_MSGS = 4, MAX_MSG = 72, MAX_CONTENT = 520, MAX_TOPICS = 12, MAX_AGE_S = 120;
const RETRY_MIN_MS = 4000, RETRY_MAX_MS = 60000, LIMITED_MS = 60000, STABLE_MS = 30000, IDLE_MS = 20000, SUB_GAP_MS = 500;
const hex = u => { let s = ''; for (const b of u) s += b.toString(16).padStart(2, '0'); return s; };
const b64 = u => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const unb64 = s => { try { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; } catch (e) { return null; } };
const ID_RE = /^[\w-]{1,32}$/, B64_RE = /^[A-Za-z0-9+/]{2,96}={0,2}$/;

export function createFallback({ urls, app, ns, selfId, allow = () => true, onEvent }) {
  const stats = { txEvents: 0, txBytes: 0, rxEvents: 0, rxBytes: 0, refused: 0, limited: 0, bad: 0, dup: 0, unsent: 0 };
  const refusals = [];
  const inboxOf = id => `${app}:fb:${ns}@${id}`, roomTopic = k => `${app}:fb:${k}`;
  const mine = inboxOf(selfId);
  const relays = urls.slice(0, 2).map(url => ({ url, ws: null, backoff: RETRY_MIN_MS, retry: null, dead: false, limitedUntil: 0, openedAt: 0, sub: '' }));
  const primary = Math.random() < 0.5 ? 0 : 1;
  let active = false, running = false, idleTimer = null, keys = null, listenRooms = new Map(), subTimer = null, lastSub = 0;   // listenRooms: topic -> room key
  const seen = new Set(), pins = new Map();   // event ids already handled; Trystero id -> the Nostr key that first spoke for it (a stranger cannot then speak for that player)
  const now = () => performance.now();

  const filter = () => ({ kinds: [FB_KIND], '#t': [mine, ...listenRooms.keys()], since: Math.floor(Date.now() / 1000) - 10 });
  function subscribe(r) {
    if (!r.ws || r.ws.readyState !== 1) return;
    r.sub = r.sub || 'fb' + Math.random().toString(36).slice(2, 8);
    try { r.ws.send(JSON.stringify(['REQ', r.sub, filter()])); } catch (e) { /* closing */ }   // the same id again replaces the subscription
  }
  function resubscribe() {   // the rooms listened to changed: at most every SUB_GAP_MS
    if (subTimer) return;
    const wait = Math.max(0, lastSub + SUB_GAP_MS - now());
    subTimer = setTimeout(() => { subTimer = null; lastSub = now(); for (const r of relays) subscribe(r); }, wait);
  }
  function handle(raw, r) {   // strangers' words: checked field by field
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(d)) return;
    if (d[0] === 'OK' && d[2] === false) {
      const why = String(d[3] || '').slice(0, 80); stats.refused++; if (refusals.length < 8) refusals.push([r.url, why]);
      if (/^rate-limited/.test(why)) { stats.limited++; r.limitedUntil = now() + LIMITED_MS; }
      else if (/^(blocked|restricted|auth-required|pow|invalid)/.test(why)) { r.dead = true; drop(r); }   // this relay does not want this traffic: leave it alone
      return;
    }
    if (d[0] === 'NOTICE' || d[0] === 'CLOSED') { if (/rate/i.test(String(d[d.length - 1]))) { stats.limited++; r.limitedUntil = now() + LIMITED_MS; } return; }
    if (d[0] !== 'EVENT' || d[1] !== r.sub) return;
    const ev = d[2]; stats.rxBytes += raw.length;
    if (!ev || typeof ev !== 'object' || ev.kind !== FB_KIND || typeof ev.id !== 'string' || typeof ev.pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(ev.pubkey) || !Array.isArray(ev.tags) || typeof ev.content !== 'string') { stats.bad++; return; }
    if (seen.has(ev.id)) { stats.dup++; return; }
    seen.add(ev.id); if (seen.size > 3000) seen.delete(seen.values().next().value);
    stats.rxEvents++;
    if (!Number.isFinite(ev.created_at) || Math.abs(Date.now() / 1000 - ev.created_at) > MAX_AGE_S || ev.content.length > MAX_CONTENT || ev.tags.length > MAX_TOPICS) { stats.bad++; return; }
    let room = null, toMe = false;
    for (const t of ev.tags) { if (!Array.isArray(t) || t[0] !== 't') continue; if (t[1] === mine) toMe = true; else if (listenRooms.has(t[1])) room = listenRooms.get(t[1]); }
    if (!toMe && room === null) return;   // a room we no longer listen to
    const parts = ev.content.split(' ');
    if (parts[0] !== '1' || !ID_RE.test(parts[1] || '') || parts.length > 2 + MAX_MSGS) { stats.bad++; return; }
    const from = parts[1]; if (from === selfId) return;
    const msgs = [];
    for (const s of parts.slice(2)) { const u = B64_RE.test(s) && unb64(s); if (!u || !u.length || u.length > MAX_MSG) { stats.bad++; return; } msgs.push(u); }
    const pin = pins.get(from);
    if (pin && pin !== ev.pubkey) { stats.bad++; return; }
    if (!pin) { pins.set(from, ev.pubkey); if (pins.size > 200) pins.delete(pins.keys().next().value); }
    onEvent(from, toMe ? null : room, msgs);
  }
  function connect(r) {
    if (!running || r.dead) return;
    let ws; try { ws = new WebSocket(r.url); } catch (e) { retry(r); return; }
    r.ws = ws;
    ws.onopen = () => { r.openedAt = now(); subscribe(r); };
    ws.onmessage = m => handle(typeof m.data === 'string' ? m.data : '', r);
    ws.onclose = () => { if (r.ws === ws) { r.ws = null; if (r.openedAt && now() - r.openedAt > STABLE_MS) r.backoff = RETRY_MIN_MS; r.openedAt = 0; retry(r); } };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* gone */ } };
  }
  function retry(r) {
    if (!running || r.dead || r.retry) return;
    r.retry = setTimeout(() => { r.retry = null; connect(r); }, r.backoff); r.backoff = Math.min(RETRY_MAX_MS, r.backoff * 2);
  }
  function drop(r) { clearTimeout(r.retry); r.retry = null; const w = r.ws; r.ws = null; r.openedAt = 0; if (w) { w.onclose = w.onmessage = w.onerror = w.onopen = null; try { w.close(); } catch (e) { /* gone */ } } }
  function start() { if (running) return; running = true; keys = schnorr.keygen(); for (const r of relays) connect(r); }   // a new key at every start, as presence does
  function stop() {
    clearTimeout(idleTimer); idleTimer = null; clearTimeout(subTimer); subTimer = null;
    if (!running) return; running = false; keys = null;
    for (const r of relays) { drop(r); r.backoff = RETRY_MIN_MS; }
  }
  // whether there is anything to listen for or send: sockets open at once, and close IDLE_MS after the last need
  function setActive(on) {
    if (on === active) return; active = on;
    if (on) { clearTimeout(idleTimer); idleTimer = null; start(); }
    else if (running && !idleTimer) idleTimer = setTimeout(() => { idleTimer = null; if (!active) stop(); }, IDLE_MS);
  }
  function listen(roomKeys) {   // the room topics to hear hellos on
    const next = new Map(roomKeys.slice(0, MAX_TOPICS - 1).map(k => [roomTopic(k), k]));
    if (next.size === listenRooms.size && [...next.keys()].every(t => listenRooms.has(t))) return;
    listenRooms = next; resubscribe();
  }
  const writer = () => { const t = now(); for (const i of [primary, 1 - primary]) { const r = relays[i]; if (r && r.ws && r.ws.readyState === 1 && !r.dead && t > r.limitedUntil) return r; } return null; };
  // one event: the messages to every topic listed. false when nothing went out (no relay open, or over the limit)
  async function publish(topics, msgs) {
    if (!running || !keys || !topics.length) return false;
    const r = writer(); if (!r) { stats.unsent++; return false; }
    if (!allow()) { stats.unsent++; return false; }
    const k = keys, created = Math.floor(Date.now() / 1000), pubkey = hex(k.publicKey);
    const tags = topics.slice(0, MAX_TOPICS).map(t => ['t', t]), content = ['1', selfId, ...msgs.slice(0, MAX_MSGS).map(b64)].join(' ');
    const id = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([0, pubkey, created, FB_KIND, tags, content]))));
    const sig = hex(await schnorr.signAsync(id, k.secretKey));
    if (keys !== k || !r.ws || r.ws.readyState !== 1) { stats.unsent++; return false; }   // stopped, or the socket closed, while signing
    const msg = JSON.stringify(['EVENT', { id: hex(id), pubkey, created_at: created, kind: FB_KIND, tags, content, sig }]);
    try { r.ws.send(msg); stats.txEvents++; stats.txBytes += msg.length; } catch (e) { return false; }
    return true;
  }
  return {
    FB_KIND, setActive, listen, stop, stats, refusals,
    send: (ids, msgs) => publish(ids.slice(0, MAX_TOPICS).map(inboxOf), msgs),   // to these players' inboxes
    post: (roomKey, msgs) => publish([roomTopic(roomKey)], msgs),                // to a room: a hello, or with no messages a goodbye
    get running() { return running; }, get active() { return active; },
    relays: () => relays.map(r => ({ url: r.url, state: r.dead ? 'refused' : now() < r.limitedUntil ? 'limited' : r.ws && r.ws.readyState === 1 ? 'open' : r.ws ? 'opening' : running ? 'closed' : 'off', writer: r === writer() })),
    sockets: () => relays.filter(r => r.ws).map(r => [r.url, r.ws.readyState]),
  };
}
