// Cloud save: your progress follows you. The browser makes a random secret code the first time and, from then on, uploads what the game keeps in localStorage (the Garage, the missions and
// events, the secrets, the SUCA tags, the stadium best, the cassette tapes, the name, the options and the driver) by itself: a few seconds after something changes, and when the page goes away. Nothing to
// sign up for. The same code typed in Options on another device (or after the browser's data was cleared) brings the save back. The server (relay-worker/src/save.rs and sglue.rs) keeps
// one small object per code, in the EU, hashed so the code itself is not stored, and deletes it after a year without a write; Options has a button that deletes it at once.
//
// What goes up is the raw text of the localStorage entries listed in KEYS, as one JSON, plus the driver's picture on its own (it is large and rarely changes). Restoring writes those
// texts back and reloads the page, so every module reads its own save the way it always has. The code is `palermoDrive.cloud.v1` = { k, t, h, hd, off }.
//   const cloud = createCloudSave();   cloud.start();
//   cloud.code()          the code in groups of five, to show
//   cloud.status()        { state: 'off' | 'new' | 'saved' | 'busy' | 'error' | 'refused', t }  (t: the time of the last upload)
//   cloud.restore(text)   -> { ok: true } (reloads the page) | { ok: false, why: 'bad' | 'none' | 'net' } | { ok: false, why: 'ask', local, cloud, apply() } when this device has more progress
//   cloud.remove()        deletes the server's copy and stops uploading from this device; cloud.enable() turns it back on
// ?cloud=off keeps a page from uploading (tests); ?relay=ws://127.0.0.1:8799/r on a local page points it at a local relay.
import { RELAY_URL } from './online/relay-url.js';
import { getLang } from './lang.js';

const STORE = 'palermoDrive.cloud.v1';
const KEYS = ['palermoDrive.garage.v1', 'palermoDrive.events.v1', 'palermoDrive.secrets.v1', 'palermoDrive.suca', 'palermoDrive.stadium.best.v1', 'palermoDrive.tapes.v1', 'palermoDrive.settings.v1'];   // the options stay last: KEYS.slice(0, -1) is the progress
const NET = 'palermoDrive.net.v1', DRIVER = 'pd.driver';
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PERIOD = 3000, MIN_GAP = 12000, FIRST_AFTER = 20000, RETRY = 40000;

export function createCloudSave() {
  const q = new URLSearchParams(location.search);
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const override = local ? q.get('relay') : null;
  const wss = override && /^wss?:\/\/[\w.:-]+(\/[\w./-]*)?$/.test(override) ? override : RELAY_URL;
  const BASE = wss ? wss.replace(/^ws/, 'http').replace(/\/r$/, '') : '';
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const st = (() => { const o = parse(rd(STORE)); return o && typeof o === 'object' ? o : {}; })();
  const persist = () => wr(STORE, JSON.stringify({ k: st.k, t: st.t, h: st.h, hd: st.hd, off: !!st.off }));
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h + ':' + s.length; };
  const newKey = () => { const b = new Uint8Array(26); crypto.getRandomValues(b); let s = ''; for (const x of b) s += ALPHA[x & 31]; return s; };
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(st.k || '')) { st.k = newKey(); delete st.h; delete st.hd; persist(); }
  const fmt = k => k.match(/.{1,5}/g).join('-');
  const clean = s => String(s).toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  const valid = k => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(k);

  let state = st.off ? 'off' : st.t ? 'saved' : 'new', restoring = false, busy = false, lastTry = 0, failedAt = 0, startedAt = 0, timer = 0, told = false;
  const now = () => Date.now();

  // ---------- what is saved ----------
  const progress = () => KEYS.slice(0, -1).some(k => rd(k) !== null);   // anything worth keeping (the options alone are not)
  function snapshot() {
    const e = {};
    for (const k of KEYS) { const v = rd(k); if (v !== null) e[k] = v; }
    const net = parse(rd(NET)); if (net && typeof net.name === 'string') e[NET] = JSON.stringify({ name: net.name });   // the name only: online or offline is the device's own choice
    let png = null;
    const d = parse(rd(DRIVER));
    if (d && typeof d === 'object') { png = typeof d.png === 'string' ? d.png : null; e[DRIVER] = JSON.stringify({ ...d, png: undefined }); }
    const g = parse(rd(KEYS[0])), cash = g && Number.isFinite(g.cash) ? Math.max(0, Math.round(g.cash)) : 0;
    return { blob: JSON.stringify({ v: 1, e }), cash, png };
  }
  const scoreOf = e => {   // roughly how far a save has got: what is owned, the events done, the secrets, the tags and the cassette tapes, and the money
    const n = (k, f) => { const o = parse(e[k]); return o && typeof o === 'object' ? f(o) : 0; };
    const cnt = o => Object.keys(o).length;
    return n(KEYS[0], g => cnt(g.owned || {}) * 10 + Math.max(0, g.cash || 0) / 100) + n(KEYS[1], p => cnt(p.done || {}) * 10 + (p.fares || 0)) + n(KEYS[2], cnt) * 5 + n(KEYS[3], o => (Array.isArray(o) ? o.length : cnt(o))) + n(KEYS[5], o => (Array.isArray(o) ? o.length : 0));
  };

  // ---------- the server ----------
  async function post(path, body, keepalive = false) {
    const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: keepalive && body.length < 60000, cache: 'no-store' });
    return { code: r.status, text: await r.text() };
  }
  async function upload(urgent) {
    if (st.off || restoring || !BASE || busy || q.get('cloud') === 'off' || !progress()) return;
    const t = now(); if (!urgent && t - lastTry < MIN_GAP) return;
    if (failedAt && t - failedAt < RETRY && !urgent) return;
    const s = snapshot(), hb = hash(s.blob + '|' + s.cash), hd = s.png ? hash(s.png) : '';
    if (hb === st.h && hd === (st.hd || '')) { if (state === 'busy') state = 'saved'; return; }
    if (!told && !st.t) { told = true; const it = getLang() === 'it'; dispatchEvent(new CustomEvent('pd-toast', { detail: { text: it ? 'Salvataggio cloud attivo' : 'Cloud save is on', sub: it ? 'Il tuo codice è in Opzioni, in Altro' : 'Your code is in Options, under More' } })); }
    busy = true; lastTry = t; state = 'busy';
    try {
      if (hb !== st.h) {
        const r = await post('/save', `${st.k}\n${s.cash}\n${s.blob}`, urgent);
        if (r.code === 200) { st.h = hb; st.t = now(); }
        else if (r.code === 429) { state = 'saved'; busy = false; return; }   // too soon: the next tick again
        else { state = 'refused'; st.h = hb; busy = false; persist(); return; }   // the server will not take this one (the wallet, the size): not tried again until something changes
      }
      if (s.png && hd !== st.hd) { const r = await post('/save/driver', `${st.k}\n${s.png}`, false); if (r.code === 200) st.hd = hd; else if (r.code !== 429) st.hd = hd; }
      failedAt = 0; state = 'saved'; persist();
    } catch (e) { failedAt = now(); state = 'error'; }
    busy = false;
  }

  function start() {
    if (timer || !BASE) return; startedAt = now();
    timer = setInterval(() => { if (document.visibilityState === 'hidden') return; if (!st.t && now() - startedAt < FIRST_AFTER) return; upload(false); }, PERIOD);
    const away = () => { if (document.visibilityState === 'hidden' || document.visibilityState === undefined) upload(true); };
    document.addEventListener('visibilitychange', away); addEventListener('pagehide', () => upload(true));
  }

  // ---------- restore, delete ----------
  async function restore(text) {
    const k = clean(text); if (!valid(k)) return { ok: false, why: 'bad' };
    let r; try { r = await post('/save/get', k); } catch (e) { return { ok: false, why: 'net' }; }
    if (r.code === 404) return { ok: false, why: 'none' };
    if (r.code !== 200) return { ok: false, why: 'net' };
    const o = parse(r.text), data = o && parse(o.blob), e = data && data.e;
    if (!e || typeof e !== 'object') return { ok: false, why: 'none' };
    const mine = {}; for (const key of KEYS) { const v = rd(key); if (v !== null) mine[key] = v; }
    const apply = () => {
      restoring = true;   // the page is about to go: no upload of the old state
      for (const key of KEYS) if (typeof e[key] === 'string') wr(key, e[key]);
      if (typeof e[NET] === 'string') { const n = parse(e[NET]), cur = parse(rd(NET)) || {}; if (n && typeof n.name === 'string') wr(NET, JSON.stringify({ ...cur, name: n.name })); }
      if (typeof e[DRIVER] === 'string') { const d = parse(e[DRIVER]); if (d && typeof o.driver === 'string') wr(DRIVER, JSON.stringify({ ...d, png: o.driver })); }
      st.k = k; st.t = now(); st.h = undefined; st.hd = undefined; st.off = false; persist();   // this device now saves under that code
      location.reload();
      return { ok: true };
    };
    const sl = scoreOf(mine), sc = scoreOf(e);
    if (sl > sc + 1) return { ok: false, why: 'ask', local: Math.round(sl), cloud: Math.round(sc), apply };
    return apply();
  }
  async function remove() {
    try { const r = await post('/save/delete', st.k); if (r.code !== 200) return false; } catch (e) { return false; }
    st.off = true; delete st.t; delete st.h; delete st.hd; st.k = newKey(); persist(); state = 'off'; return true;
  }
  function enable() { st.off = false; persist(); state = 'new'; lastTry = 0; failedAt = 0; }

  return { start, code: () => fmt(st.k), status: () => ({ state: st.off ? 'off' : state, t: st.t || 0 }), restore, remove, enable, upload: () => upload(true), _state: st };
}
