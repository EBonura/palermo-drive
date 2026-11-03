// Who is online and in which rooms: plain Nostr events, no WebRTC. Every player publishes one small event now and then saying which rooms (500 m cells, src/p2p/p2p.js)
// they are in, and reads everybody else's, so the game can pick the closest players in the whole city and join their rooms. Nothing here connects two players.
//
// The event is NIP-78 application data (kind 30078, parameterised replaceable): one per player on a relay, each new one replaces the last, and a NIP-40 expiration tag lets
// a relay forget it. A relay keeps it, so a player who has just arrived reads the whole list at once instead of waiting a minute for everybody's next beat (Trystero's own
// announcements are ephemeral: they are only seen by whoever is subscribed at that moment). The content is the room list ("3,0,0 4,0,0": cell x, cell z, shard of the first
// room, then the others); the author is a Nostr key made fresh at every page load and thrown away, so there is no account, no name, no position finer than a cell, no IP.
//
// Its own WebSockets (not Trystero's): a relay that refuses this kind must not cost the game its room signalling, and a refusal here is handled here. Two relays out of
// PRESENCE_RELAYS, picked at random per player: any two of three share at least one, so any two players share a relay, and the load is spread over three.
// Traffic is bounded: one event per player per BEAT_MS (more spaced out as the crowd grows: the rate every player receives stays near RX_EVENTS_PER_S whatever the number of
// players), plus one when the room list changes, no more often than MOVE_GAP_MS (or half a beat, if that is longer). MAX_ENTRIES players are remembered: past a few hundred players online at once the topic would have to be split by region.
import { schnorr } from './trystero.js';

const KIND = 30078, D_TAG = 'pd';
const BEAT_MS = 60000, BEAT_MAX_MS = 600000, MOVE_GAP_MS = 15000;
const RX_EVENTS_PER_S = 1.6;        // heartbeats per second a player is willing to receive from each relay: with more players the beat is spread out
const EXP_FACTOR = 2.5;             // an entry is believed this many beats after it was sent
const MAX_ENTRIES = 400, MAX_EXP_S = 1500, MAX_ROOMS = 6, MAX_CELL = 1000, MAX_SHARD = 99;
const SINCE_S = 600, LIMIT = 300;   // what a new reader asks the relay for
const RETRY_MIN_MS = 4000, RETRY_MAX_MS = 60000, LIMITED_MS = 60000;
const hex = u => { let s = ''; for (const b of u) s += b.toString(16).padStart(2, '0'); return s; };

export function createPresence({ topic, urls, onChange }) {
  const relays = [], entries = new Map();   // entries: author -> { rooms: [[i, j, s]...], created, until }
  const stats = { txEvents: 0, txBytes: 0, rxEvents: 0, rxBytes: 0, refused: 0, limited: 0, notices: 0, bye: 0 };
  const refusals = [];   // what relays said when they said no (first few), for the measurements
  let running = false, keys = null, current = '', lastPub = -1e9, lastSent = '', timer = null, beatTimer = null, changeTimer = null, ready = false, startedAt = 0, dirty = false;
  const seen = new Set();
  const me = () => hex(keys.publicKey);
  const now = () => performance.now();
  const beatMs = () => Math.min(BEAT_MAX_MS, Math.max(BEAT_MS, Math.round(entries.size / RX_EVENTS_PER_S * 1000)));

  async function sign(k, content, expSec) {   // k: the keys it started with (stop() may clear them while the signature is being made)
    const created = Math.floor(Date.now() / 1000), pubkey = hex(k.publicKey);
    const tags = [['d', D_TAG], ['t', topic], ['expiration', String(created + expSec)]];
    const id = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([0, pubkey, created, KIND, tags, content]))));
    return JSON.stringify(['EVENT', { id: hex(id), pubkey, created_at: created, kind: KIND, tags, content, sig: hex(await schnorr.signAsync(id, k.secretKey)) }]);
  }
  async function send(content) {
    if (!keys) return;
    const k = keys, msg = await sign(k, content, Math.round(beatMs() * EXP_FACTOR / 1000));
    if (!running && content !== '' || keys !== k) return;
    for (const r of relays) if (r.ws && r.ws.readyState === 1 && now() > r.limitedUntil) { try { r.ws.send(msg); stats.txEvents++; stats.txBytes += msg.length; } catch (e) { /* closing */ } }
  }
  function publishNow() {
    clearTimeout(timer); timer = null; clearTimeout(beatTimer); beatTimer = setTimeout(publishNow, beatMs());
    if (!current) return;   // nothing to say yet (an empty event would be a goodbye)
    lastPub = now(); dirty = false; lastSent = current;
    send(current);
  }
  // set what we say we are in; sent at once, or as soon as MOVE_GAP_MS has passed since the last one
  function publish(rooms) {
    const c = rooms.slice(0, MAX_ROOMS).map(r => r.join(',')).join(' ');
    if (c === current && !dirty) return; current = c; dirty = true;
    if (!running) return;
    if (c === lastSent) return;
    const wait = lastPub + Math.max(MOVE_GAP_MS, beatMs() / 2) - now();   // with a crowd the beat is longer, and so is the gap
    if (wait <= 0) publishNow(); else if (!timer) timer = setTimeout(publishNow, wait);
  }

  function parse(content) {
    if (typeof content !== 'string' || content.length > 120) return null;
    const out = [];
    for (const part of content.split(' ')) {
      const m = /^(-?\d{1,4}),(-?\d{1,4}),(\d{1,2})$/.exec(part); if (!m) return null;
      const i = +m[1], j = +m[2], s = +m[3]; if (Math.abs(i) > MAX_CELL || Math.abs(j) > MAX_CELL || s > MAX_SHARD) return null;
      out.push([i, j, s]);
    }
    return out.length && out.length <= MAX_ROOMS ? out : null;
  }
  function handle(ev) {   // strangers' words: checked field by field
    if (!keys || !ev || typeof ev !== 'object' || ev.kind !== KIND || typeof ev.pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(ev.pubkey) || ev.pubkey === me()) return;
    if (typeof ev.id !== 'string' || seen.has(ev.id) || !Array.isArray(ev.tags) || !Number.isFinite(ev.created_at)) return;
    seen.add(ev.id); if (seen.size > 2000) seen.delete(seen.values().next().value);
    let topicOk = false, exp = 0;
    for (const t of ev.tags) { if (!Array.isArray(t)) continue; if (t[0] === 't' && t[1] === topic) topicOk = true; else if (t[0] === 'expiration') exp = +t[1]; }
    const nowS = Date.now() / 1000;
    if (!topicOk || Math.abs(nowS - ev.created_at) > MAX_EXP_S + 300) return;
    const ttl = Math.min(MAX_EXP_S, exp - ev.created_at);   // from the sender's own clock to the sender's own clock: a wrong clock on either side does not matter
    const old = entries.get(ev.pubkey);
    if (old && ev.created_at < old.created) return;
    if (ev.content === '') { if (old) { entries.delete(ev.pubkey); change(); } return; }   // goodbye
    const rooms = parse(ev.content); if (!rooms || !(ttl >= 20)) return;
    if (!old && entries.size >= MAX_ENTRIES) return;
    entries.set(ev.pubkey, { rooms, created: ev.created_at, until: now() + ttl * 1000 });
    change();
  }
  function change() { if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = null; onChange && onChange(); }, 200); }

  function connect(r) {
    if (!running || r.dead) return;
    let ws; try { ws = new WebSocket(r.url); } catch (e) { retry(r); return; }
    r.ws = ws; const sub = 'pd' + Math.random().toString(36).slice(2, 8);
    ws.onopen = () => {
      r.backoff = RETRY_MIN_MS;
      ws.send(JSON.stringify(['REQ', sub, { kinds: [KIND], '#t': [topic], since: Math.floor(Date.now() / 1000) - SINCE_S, limit: LIMIT }]));
      if (current) { lastSent = ''; publishNow(); }
    };
    ws.onmessage = m => {
      const raw = typeof m.data === 'string' ? m.data : ''; let d; try { d = JSON.parse(raw); } catch (e) { return; }
      if (!Array.isArray(d)) return;
      if (d[0] === 'EVENT' && d[1] === sub) { stats.rxEvents++; stats.rxBytes += raw.length; handle(d[2]); }
      else if (d[0] === 'EOSE' && d[1] === sub) { if (!ready) { ready = true; change(); } }
      else if (d[0] === 'OK' && d[2] === false) {
        const why = String(d[3] || '').slice(0, 80); stats.refused++; if (refusals.length < 8) refusals.push([r.url, why]);
        if (/^rate-limited/.test(why)) { stats.limited++; r.limitedUntil = now() + LIMITED_MS; lastSent = ''; if (!timer) timer = setTimeout(publishNow, LIMITED_MS + 500); }   // that relay missed what we said: say it again when it will take it
        else if (/^(blocked|restricted|auth-required|pow|invalid)/.test(why)) { r.dead = true; try { ws.close(); } catch (e) { /* gone */ } }   // this relay does not want this kind: leave it alone
      } else if (d[0] === 'NOTICE' || d[0] === 'CLOSED') { stats.notices++; if (/rate/i.test(String(d[d.length - 1]))) r.limitedUntil = now() + LIMITED_MS; }
    };
    ws.onclose = () => { if (r.ws === ws) { r.ws = null; retry(r); } };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* gone */ } };
  }
  function retry(r) {
    if (!running || r.dead || r.retry) return;
    r.retry = setTimeout(() => { r.retry = null; connect(r); }, r.backoff); r.backoff = Math.min(RETRY_MAX_MS, r.backoff * 2);
  }

  function start() {
    if (running) return; running = true; ready = false; startedAt = now(); entries.clear(); seen.clear();
    keys = schnorr.keygen();   // a new key at every start: nobody can follow a player from one session to the next
    const pick = urls.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    for (const url of pick) { const r = { url, ws: null, backoff: RETRY_MIN_MS, retry: null, dead: false, limitedUntil: 0 }; relays.push(r); connect(r); }
    clearTimeout(beatTimer); beatTimer = setTimeout(publishNow, beatMs());
  }
  // stop: say goodbye (an empty event replaces ours) when asked, then close every socket and forget everybody
  function stop(bye) {
    if (!running) return; running = false;
    clearTimeout(timer); clearTimeout(beatTimer); clearTimeout(changeTimer); timer = beatTimer = changeTimer = null;
    const rs = relays.splice(0), k = keys; keys = null;
    const close = () => { for (const r of rs) { clearTimeout(r.retry); r.retry = null; const w = r.ws; r.ws = null; if (w) { w.onclose = w.onmessage = w.onerror = null; try { w.close(); } catch (e) { /* gone */ } } } };
    entries.clear(); ready = false; lastSent = ''; lastPub = -1e9;
    for (const r of rs) if (r.ws) { r.ws.onmessage = r.ws.onopen = null; }   // nothing more is read, and a socket still connecting asks for nothing
    if (bye && k && current) {
      const created = Math.floor(Date.now() / 1000), pubkey = hex(k.publicKey), tags = [['d', D_TAG], ['t', topic], ['expiration', String(created + 60)]];
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([0, pubkey, created, KIND, tags, '']))).then(async buf => {
        const id = new Uint8Array(buf), msg = JSON.stringify(['EVENT', { id: hex(id), pubkey, created_at: created, kind: KIND, tags, content: '', sig: hex(await schnorr.signAsync(id, k.secretKey)) }]);
        for (const r of rs) if (r.ws && r.ws.readyState === 1) { try { r.ws.send(msg); stats.txEvents++; stats.bye++; } catch (e) { /* gone */ } }
      }).catch(() => {}).finally(() => setTimeout(close, 150));
    } else close();
    current = '';
  }
  // everybody currently believed to be online, other than us
  function list() {
    const t = now(), out = [];
    for (const [k, e] of entries) { if (e.until < t) entries.delete(k); else out.push({ id: k, rooms: e.rooms }); }
    return out;
  }
  return {
    start, stop, publish, list, stats, refusals,
    get running() { return running; }, get ready() { return ready; }, get startedAt() { return startedAt; }, get size() { return entries.size; }, beatMs,
    sockets: () => relays.filter(r => r.ws).map(r => [r.url, r.ws.readyState]),
  };
}
