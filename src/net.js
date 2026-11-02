// Multiplayer client: name, connection to the relay, other players' lapas. Owned by the multiplayer work.
//
// The relay (relay/, Rust) forwards each player's position to the players within ~400 m. This module asks for a name once,
// sends our state ~10 Hz when it changed, and draws everybody else as a lapa with a name tag and a minimap dot.
// Protocol (binary, little endian) is documented in relay/src/protocol.rs; the numbers below must match it.
//
// Nothing happens (no DOM, no socket, no per-frame work) until a relay URL is set: RELAY_URL below, or ?relay=wss://host/ws
// for testing, or RELAY_URL_FILE (a file of this site that names the address). ?relay=off disables it. ?name=Foo sets the name for this page load only, ?room=xyz picks a private room.
//
// Two separate things talk to the relay:
//  1. Anonymous play statistics: a random id kept in localStorage and a tiny HTTP POST (/ping) when a session starts, about
//     every 3 minutes of active play, and when the page is hidden. No name, no IP is stored. The answer says whether
//     multiplayer is open (the relay stops accepting WebSockets when it reaches its monthly outbound traffic limit). If the relay
//     cannot be reached (it runs on a machine that is sometimes off) nothing is shown or retried noisily: single player carries on and
//     the ping is retried with growing pauses, up to 5 minutes.
//  2. The WebSocket, open only while the game is in 'play' (not on menus or pause), the tab is visible and the player did
//     something in the last 2 minutes. Every byte the relay sends counts against its monthly traffic limit.
import { esc } from './esc.js';
import { createRemotes } from './remotes.js';

const RELAY_URL = ''; // wss://<relay host>/ws once the relay is reachable from the internet (see relay/RUN.md)
// Alternative to RELAY_URL for a relay whose address changes (a tunnel with a new host name): the path of a small JSON file on
// this site, { "url": "wss://host/ws" }, fetched without caching at start and again after the relay has been unreachable for a while.
const RELAY_URL_FILE = ''; // for example 'relay.json'

const STORE_KEY = 'palermoDrive.net.v1';   // { name, offline }
const SETTINGS_KEY = 'palermoDrive.settings.v1'; // owned by ui.js: we only read the language
const PROTO = 2;               // 2: rooms of up to 256 players, positions in 5 bytes (see packState)
const POS_UNITS = 20, POS_MID = 1 << 19, POS_MAX = (1 << 20) - 1; // positions: 0.05 m units, +-26 km (the map spans x -11500..8500, z -12500..8000)
const SEND_MS = 100;           // state send interval (only when something changed)
const PING_MS = 10000;         // keep-alive when we have nothing to say
const DEAD_MS = 30000;         // server sends something at least every 10 s
const HIDDEN_MS = 5000;        // leave the relay when the tab has been in the background this long
const MENU_MS = 10000;         // ... or the game has been paused / on a menu this long
const INPUT_MS = 120000;       // ... or the player has not touched anything this long
const BEAT_S = 180;            // seconds of active play between stats pings
const POLL_MS = 45000;         // while waiting for another multiplayer player to show up, ask this often
const PID_KEY = 'palermoDrive.pid.v1'; // random anonymous player id
const TAU = Math.PI * 2;
const PINK = '#ff6fae', PINK_D = '#e8559a', BLACK = '#0d0709';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

const T = {
  it: { ask: 'Come ti chiami?', askSub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', skip: 'Offline',
    save: 'Salva', close: 'Chiudi', goOffline: 'Gioca offline', goOnline: 'Torna online', online: 'online', offline: 'offline', connecting: 'connessione…', guest: 'Ospite' },
  en: { ask: "What's your name?", askSub: 'Drive online with other players. You can change it any time.', edit: 'Your name', ph: 'Name', join: 'Play online', skip: 'Offline',
    save: 'Save', close: 'Close', goOffline: 'Play offline', goOnline: 'Go online', online: 'online', offline: 'offline', connecting: 'connecting…', guest: 'Guest' },
};

const CSS = `
.pdn-pill{margin:5px auto 0;pointer-events:auto;display:flex;align-items:center;gap:7px;padding:5px 11px 5px 9px;border-radius:99px;
  font:700 12px/1 system-ui,-apple-system,sans-serif;color:#fff;background:rgba(13,7,9,.74);border:1.5px solid ${PINK_D};cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent;max-width:200px;white-space:nowrap}
.pdn-pill[hidden]{display:none}
.pdn-pill .d{width:9px;height:9px;border-radius:50%;background:#777;flex:none}
.pdn-pill.on .d{background:${PINK};box-shadow:0 0 6px ${PINK}}
.pdn-pill.try .d{background:${PINK_D};animation:pdn-b 1s ease-in-out infinite}
.pdn-pill.off{opacity:.6;border-color:#5a4a50}
.pdn-pill .n{overflow:hidden;text-overflow:ellipsis;opacity:.75;font-weight:600;max-width:9ch}
@keyframes pdn-b{50%{opacity:.25}}
html.pd-title .pdn-pill,html.pd-title .pdn-card{display:none!important}
.pdn-card{position:fixed;z-index:60;left:50%;bottom:120px;transform:translateX(-50%);width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:14px 14px 12px;
  border-radius:14px;background:rgba(13,7,9,.94);border:2px solid ${PINK_D};color:#fff;font:14px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5)}
.pdn-card b{display:block;font-size:17px;color:${PINK}}
.pdn-card small{display:block;opacity:.7;margin:2px 0 10px;font-size:12px}
.pdn-card form{display:flex;flex-wrap:wrap;gap:8px}
.pdn-card input{flex:1 1 100%;min-width:0;box-sizing:border-box;font:600 16px system-ui,sans-serif;padding:9px 11px;border-radius:9px;border:1.5px solid #5a4a50;background:#1b1115;color:#fff;outline:none}
.pdn-card input:focus{border-color:${PINK}}
.pdn-card button{flex:1;font:700 14px system-ui,sans-serif;padding:9px 12px;border-radius:9px;border:1.5px solid ${PINK_D};background:transparent;color:#fff;cursor:pointer;min-height:40px}
.pdn-card button.ok{background:${PINK_D};color:${BLACK}}
.pdn-card button.lnk{flex:1 1 100%;border:0;min-height:0;padding:4px;font-weight:600;font-size:12px;opacity:.7;text-decoration:underline}
html.touch .pdn-pill{margin:4px 0 0 auto;font-size:11px;padding:4px 9px 4px 8px}
html.touch .pdn-pill .n{display:none}
html.touch .pdn-card{bottom:auto;top:max(60px,calc(env(safe-area-inset-top) + 56px));width:min(330px,calc(100vw - 280px));min-width:250px;padding:10px 12px}
html.touch .pdn-card small{display:none}
@media (max-height:420px){html.touch .pdn-card b{font-size:15px}}
@media (max-height:500px){.pdn-card{bottom:56px;padding:10px 12px}.pdn-card small{display:none}.pdn-card b{font-size:15px;margin-bottom:6px}.pdn-card input{padding:6px 10px}.pdn-card button{min-height:34px;padding:6px 10px}}
`;

export function createNet(env) {
  const { scene, camera, car, groundY, raisedMask, CURB, game, vehicle, mapMarkers } = env;
  const params = new URLSearchParams(location.search);

  // ---------- relay URL ----------
  // a ?relay= link overrides both RELAY_URL and the file
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/.test(location.hostname);
  const rq = params.get('relay'), q = local || rq === 'off' || rq === '0' ? rq : null;   // (switching it off is always allowed)
  const normalise = u => {
    if (!u || u === 'off' || u === '0') return '';
    try {
      const x = new URL(u);
      if (x.protocol !== 'ws:' && x.protocol !== 'wss:') return '';
      if (x.pathname === '/') x.pathname = '/ws';
      if (params.get('room')) x.searchParams.set('room', params.get('room'));
      return x.href;
    } catch (e) { return ''; }
  };
  const derivePing = u => { try { const x = new URL(u); x.protocol = x.protocol === 'wss:' ? 'https:' : 'http:'; x.pathname = '/ping'; x.search = ''; return x.href; } catch (e) { return ''; } };
  let relayUrl = normalise(q != null ? q : RELAY_URL);
  const urlFile = q == null && !relayUrl ? RELAY_URL_FILE : '';
  if (!relayUrl && !urlFile) return { update() {}, enabled: false, openName() {}, get online() { return false; } };

  // ---------- stored name ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  const store = load();
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ name: store.name || '', offline: !!store.offline })); } catch (e) { /* private mode: fine */ } };
  const urlName = (params.get('name') || '').slice(0, 16);
  if (urlName) { store.name = urlName; store.offline = false; } // this page load only (not saved until the player edits)
  // the Garage's driver screen (src/garage-ui.js) edits the same stored name and says so with a 'pd-name' event; take it over (and again when the card opens) so this module neither shows nor writes back an old one
  const refreshName = () => { if (urlName) return; const n = load().name, name = typeof n === 'string' ? n.replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/gu, '').trim().slice(0, 16) : ''; if (name !== (store.name || '')) { store.name = name; sleeping = false; attempts = 0; lastPingT = 0; infoDirty(); renderPill(); } };
  addEventListener('pd-name', refreshName);
  const lang = () => {
    let l = 'it';
    try { l = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}).lang; } catch (e) { /* ignore */ }
    const p = params.get('lang'); if (p === 'en' || p === 'it') l = p;
    return T[l] || T.it;
  };

  // ---------- state ----------
  let started = false, ws = null, status = 'idle', attempts = 0, retryT = 0, everOnline = false;
  let mp = null, peers = 0, lastPingT = 0, promptShown = false, activeSec = 0, lastPlay = 0, lastInput = performance.now(), pingTimer = 0, pingTries = 0;
  let myId = -1, count = 0, lastRecv = 0, lastSend = 0, lastSentState = null, lastInfoKey = '', sendAcc = 0;
  let hiddenTimer = 0, sleeping = false, blocked = false, pingBusy = false;
  const { remotes, ensure, setInfo, addSnap, retire, dropAll, update: updateRemotes } = createRemotes(env);

  // ---------- DOM ----------
  let pill = null, card = null;
  function ensureUI() {
    if (pill) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pdn-pill off';
    pill.innerHTML = '<span class="d"></span><span class="c"></span><span class="n"></span>';
    pill.addEventListener('click', () => openName());
    document.getElementById('where').appendChild(pill);   // the HUD's "where am I" column (src/hud.js)
    renderPill();
  }
  function renderPill() {
    if (!pill) return;
    pill.hidden = !(mp === true || store.name);
    const t = lang();
    const cls = status === 'online' ? 'on' : status === 'connecting' ? 'try' : 'off';
    pill.className = 'pdn-pill ' + cls;
    pill.querySelector('.c').textContent = status === 'online' ? `${Math.max(1, count)} ${t.online}` : status === 'connecting' ? t.connecting : t.offline;
    pill.querySelector('.n').textContent = store.name || '';
    pill.title = store.name || '';
    pill.setAttribute('aria-label', `${pill.querySelector('.c').textContent}. ${t.edit}`);
  }
  function setStatus(s) { if (s !== status) { status = s; renderPill(); } }

  function closeCard() { if (card) { card.remove(); card = null; } }
  function openName() {
    refreshName(); ensureUI(); closeCard();
    const t = lang(), editing = !!store.name;
    card = document.createElement('div'); card.className = 'pdn-card'; card.setAttribute('role', 'dialog');

    card.innerHTML = `<b>${editing ? t.edit : t.ask}</b>${editing ? '' : `<small>${esc(t.askSub)}</small>`}
      <form><input maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="${esc(t.ph)}" aria-label="${esc(t.ph)}">
      <button class="ok" type="submit">${editing ? t.save : t.join}</button><button class="no" type="button">${editing ? t.close : t.skip}</button>
      ${editing ? `<button class="lnk" type="button">${store.offline ? t.goOnline : t.goOffline}</button>` : ''}</form>`;
    document.body.appendChild(card);
    const input = card.querySelector('input'); input.value = store.name || '';
    // typing a name must not drive the car (WASD, digits teleport); keyup still bubbles so no key can stay stuck
    card.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeCard(); });
    card.addEventListener('keypress', e => e.stopPropagation());
    card.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const name = input.value.replace(/\s+/g, ' ').trim().slice(0, 16);
      if (!name) { input.focus(); return; }
      store.name = name; store.offline = false; sleeping = false; attempts = 0; lastPingT = 0; save(); closeCard(); infoDirty(); renderPill();
    });
    card.querySelector('.no').addEventListener('click', () => {
      if (!editing) { store.offline = true; save(); renderPill(); }
      closeCard();
    });
    const lnk = card.querySelector('.lnk');
    if (lnk) lnk.addEventListener('click', () => { store.offline = !store.offline; sleeping = false; attempts = 0; lastPingT = 0; save(); closeCard(); renderPill(); });
    if (matchMedia('(pointer:fine)').matches) input.focus();
  }

  // ---------- anonymous statistics (HTTP) ----------
  const pid = (() => {
    let id = ''; try { id = localStorage.getItem(PID_KEY) || ''; } catch (e) { /* ignore */ }
    if (!/^[0-9a-f]{16,40}$/.test(id)) {
      const a = new Uint8Array(16); (crypto || window.crypto).getRandomValues(a);
      id = [...a].map(b => b.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(PID_KEY, id); } catch (e) { /* private mode: a new id each visit */ }
    }
    return id;
  })();
  let pingUrl = derivePing(relayUrl), lastUrlCheck = -1e9;
  function onPingAnswer(j, sentMP) {
    const was = mp; mp = !!(j && j.mp === 1); pingTries = 0;
    peers = Math.max(0, ((j && j.on) | 0) - (sentMP ? 1 : 0)); // other players who want multiplayer right now
    if (mp && !was && !store.name && !store.offline && !promptShown) { promptShown = true; setTimeout(() => { if (!store.name && !store.offline && !card) openName(); }, 1200); }
    if (mp !== was) { ensureUI(); renderPill(); }
  }
  function ping(ev, secs, beacon) {
    if (!pingUrl) return;
    const sent = Math.round(secs || 0), sentMP = wanted() ? 1 : 0, body = `${pid},${ev},${sent},${sentMP}`;
    lastPingT = performance.now();
    if (beacon) { try { if (navigator.sendBeacon(pingUrl, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ } }
    pingBusy = true; if (ev === 'b') activeSec -= sent;
    fetch(pingUrl, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { pingBusy = false; onPingAnswer(j, sentMP); })
      .catch(code => {
        pingBusy = false; if (ev === 'b') activeSec += sent; // credit it with the next ping
        if (code === 429) return;
        mp = false; if (pill) renderPill();
        checkUrlFile(false); // maybe the relay moved
        // relay unreachable (the owner's machine is off, say): single player carries on, keep asking quietly, 5 s, 10 s ... up to 5 minutes between tries
        clearTimeout(pingTimer); pingTimer = setTimeout(() => ping('b', 0), Math.min(300000, 5000 * 2 ** Math.min(pingTries++, 6)));
      });
  }
  // With RELAY_URL_FILE the address of the relay is read from a file of this site, so a moved relay (new tunnel host name) is found
  // without a new release: at start, and after pings have failed (at most once a minute). A new address replaces the old one.
  function checkUrlFile(force) {
    if (!urlFile) return;
    const t = performance.now();
    if (!force && t - lastUrlCheck < 60000) return;
    lastUrlCheck = t;
    fetch(new URL(urlFile, document.baseURI).href, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      const u = normalise(j && j.url);
      if (!u || u === relayUrl) return;
      relayUrl = u; pingUrl = derivePing(u);
      if (ws) closeWs();
      clearTimeout(pingTimer); pingTries = 0; attempts = 0; lastPingT = 0;
      if (started) ping('b', 0); // ask the new address at once; update() starts the socket when it says multiplayer is open
    }).catch(() => {});
  }
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true, capture: true });
  addEventListener('pagehide', () => { if (started) ping('e', activeSec, true); });

  // ---------- connection ----------
  // The WebSocket exists only while this is true: multiplayer open, a name chosen, playing (not on a menu or paused),
  // tab visible, recent input. update() opens and closes the socket to match.
  const wanted = () => !!store.name && !store.offline && started && !blocked;
  function closeWs() {
    clearTimeout(retryT); retryT = 0;
    if (ws) { const w = ws; ws = null; w.onclose = null; try { w.close(1000); } catch (e) { /* ignore */ } }
    dropAll(); myId = -1; count = 0; setStatus('off');
  }
  function connect() {
    if (ws || document.hidden) return;
    clearTimeout(retryT); retryT = 0;
    ensureUI(); setStatus('connecting');
    let s;
    try { s = new WebSocket(relayUrl); } catch (e) { scheduleRetry(); return; }
    s.binaryType = 'arraybuffer'; ws = s;
    s.onopen = () => { lastRecv = performance.now(); lastSend = lastRecv; lastSentState = null; lastInfoKey = ''; sendInfo(); };
    s.onmessage = e => { lastRecv = performance.now(); try { onMessage(new DataView(e.data)); } catch (err) { /* ignore a malformed frame */ } };
    s.onerror = () => {};
    s.onclose = e => {
      if (ws !== s) return;
      ws = null; dropAll(); myId = -1; count = 0;
      if (e.code === 4001) { sleeping = true; setStatus('off'); return; } // idle kick: reconnect when the player drives again
      if (e.code === 4003) { mp = false; setStatus('off'); return; }       // monthly free-tier budget reached: single player, pings go on
      setStatus('connecting');
      scheduleRetry(e.code === 4002 || e.code === 1001);
    };
  }
  function scheduleRetry(soon) {
    if (retryT) return;
    // 1 s, 2 s, 4 s ... capped at 30 s (60 s if the relay has never answered), with jitter
    const base = soon ? 500 : Math.min(everOnline ? 30000 : 60000, 1000 * 2 ** Math.min(attempts, 6));
    attempts++;
    // the socket keeps failing: find out through a ping whether the relay is there at all (a failed ping switches multiplayer off,
    // so the retries stop and the game is plain single player), and whether it has moved
    if (attempts >= 3 && !pingBusy && performance.now() - lastPingT > 15000) { ping('b', 0); checkUrlFile(false); }
    retryT = setTimeout(() => { retryT = 0; if (wanted() && !ws) connect(); }, base * (0.75 + Math.random() * 0.5));
    if (!soon && attempts > 1) setStatus('off');
  }

  // ---------- outgoing ----------
  const livId = () => Math.max(0, (vehicle.LIVERIES || []).findIndex(l => l.id === car.livery));
  let infoPending = false;
  const infoDirty = () => { infoPending = true; };
  function sendInfo() {
    if (!ws || ws.readyState !== 1) return;
    const nm = new TextEncoder().encode(store.name || '');
    const b = new Uint8Array(3 + nm.length); b[0] = 1; b[1] = livId(); b[2] = nm.length; b.set(nm, 3);
    ws.send(b); lastInfoKey = (store.name || '') + '|' + b[1]; infoPending = false; lastSend = performance.now();
  }
  const q8 = (v, scale) => clamp(Math.round(v / scale * 127), -127, 127);
  function packState(x, z, th, v, steer, roll, lean, fl) {
    const b = new Uint8Array(12), dv = new DataView(b.buffer);
    b[0] = 2;
    // x and z: 20 bits each, 5 cm units, offset so the whole map (and twice as much again) is positive; 40 bits in all
    const xq = clamp(Math.round(x * POS_UNITS) + POS_MID, 0, POS_MAX), zq = clamp(Math.round(z * POS_UNITS) + POS_MID, 0, POS_MAX);
    dv.setUint32(1, (xq | ((zq & 0xfff) << 20)) >>> 0, true); b[5] = zq >>> 12;
    b[6] = Math.round(((th % TAU) + TAU) % TAU / TAU * 256) & 255;
    dv.setInt8(7, clamp(Math.round(v * 2), -127, 127)); dv.setInt8(8, q8(steer, 0.7)); dv.setInt8(9, q8(roll, 0.5)); dv.setInt8(10, q8(lean, 1));
    b[11] = fl;
    return b;
  }
  function sendState(now) {
    let b;
    b = packState(car.x, car.z, car.th, car.vf || 0, car.steer || 0, car.roll || 0, (car.tip || 0) * Math.sign(car.ay || 0),
      (car.nosAmt > 0.15 ? 1 : 0) | (car.braking ? 2 : 0) | (car.drift > 0.3 ? 4 : 0));
    if (lastSentState && b.every((v, i) => v === lastSentState[i])) return false;
    ws.send(b); lastSentState = b; lastSend = now; return true;
  }

  // ---------- incoming ----------
  function onMessage(dv) {
    const now = performance.now();
    switch (dv.getUint8(0)) {
      case 0x20: // WELCOME
        if (dv.getUint8(1) !== PROTO) { blocked = true; return; } // incompatible relay: closed by update(), stay quiet
        myId = dv.getUint8(2); attempts = 0; everOnline = true; setStatus('online'); break;
      case 0x21: count = dv.getUint16(1, true); renderPill(); break;
      case 0x22: { // INFO
        const id = dv.getUint8(1), liv = dv.getUint8(2), n = dv.getUint8(3);
        const name = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset + 4, n));
        const r = ensure(id);
        // the position that follows the name is where the later 16 bit positions are counted from
        const lo = dv.getUint32(4 + n, true);
        r.qx = lo & 0xfffff; r.qz = (lo >>> 20) | (dv.getUint8(8 + n) << 12); r.hq = true;
        setInfo(r, name, liv); break;
      }
      case 0x23: { const r = remotes.get(dv.getUint8(1)); if (r) { remotes.delete(r.id); retire(r); } break; }
      case 0x24: { // STATES: nFull FULL entries (11 bytes), then nShort SHORT entries (7 bytes), see relay/src/protocol.rs
        const nf = dv.getUint8(1), ns = dv.getUint8(2);
        let o = 3;
        for (let i = 0; i < nf + ns; i++, o += i <= nf ? 11 : 7) {
          const r = remotes.get(dv.getUint8(o)); if (!r || !r.hq) continue;
          // the low 16 bits of the position: add the wrapped difference to the position we have
          r.qx += ((dv.getUint16(o + 1, true) - r.qx) << 16) >> 16; r.qz += ((dv.getUint16(o + 3, true) - r.qz) << 16) >> 16;
          const l = r.snaps[r.snaps.length - 1];
          const s = { t: now, x: (r.qx - POS_MID) / POS_UNITS, z: (r.qz - POS_MID) / POS_UNITS, th: dv.getUint8(o + 5) / 256 * TAU, v: dv.getInt8(o + 6) / 2,
            steer: l ? l.steer : 0, roll: l ? l.roll : 0, lean: l ? l.lean : 0, fl: l ? l.fl : 0 };   // a SHORT entry keeps the last value of these
          if (i < nf) { s.steer = dv.getInt8(o + 7) / 127 * 0.7; s.roll = dv.getInt8(o + 8) / 127 * 0.5; s.lean = dv.getInt8(o + 9) / 127; s.fl = dv.getUint8(o + 10); }
          addSnap(r, s);
        }
        break;
      }
    }
  }


  // ---------- frame ----------
  // A background tab keeps no connection open (an open WebSocket keeps the Cloud Run instance billed).
  document.addEventListener('visibilitychange', () => {
    clearTimeout(hiddenTimer); hiddenTimer = 0;
    if (document.hidden) {
      hiddenTimer = setTimeout(() => { if (document.hidden && ws) closeWs(); }, HIDDEN_MS);
      if (started && activeSec > 5) { ping('b', activeSec, true); activeSec = 0; }
    }
  });
  checkUrlFile(true);

  return {
    enabled: true,
    openName: () => openName(),
    get online() { return status === 'online'; },
    update(dt) {
      const now = performance.now();
      if (game.state === 'play') lastPlay = now;
      if (!started) {
        if (game.state !== 'play') return;
        started = true; lastInput = now; ping('s', 0);
        if (store.name) { ensureUI(); renderPill(); }
        return;
      }
      const live = now - lastPlay < MENU_MS && !document.hidden && now - lastInput < INPUT_MS;
      if (live && game.state === 'play') { activeSec += dt; if (activeSec >= BEAT_S && !pingBusy) ping('b', activeSec); }
      // wake up after an idle kick as soon as the player drives again
      if (sleeping && game.state === 'play' && Math.abs(car.vf || 0) > 1) { sleeping = false; attempts = 0; }
      const eligible = wanted() && mp === true && live && !sleeping;
      // An open WebSocket costs free-tier time on the relay, so connect only while another multiplayer player is online
      // (the ping answer says how many). While alone, ask again every 45 s.
      if (eligible && peers === 0 && !ws && !pingBusy && now - lastPingT > POLL_MS) ping('b', 0);
      const want = eligible && peers > 0;
      if (want) { if (!ws && !retryT) connect(); }
      else if (ws || retryT || status === 'connecting') closeWs();

      if (ws && ws.readyState === 1) {
        if (now - lastRecv > DEAD_MS) { try { ws.close(); } catch (e) { /* ignore */ } }
        sendAcc += dt * 1000;
        if (sendAcc >= SEND_MS) {
          sendAcc = 0;
          if (infoPending || lastInfoKey !== (store.name || '') + '|' + livId()) sendInfo();
          if (game.state === 'play') sendState(now);
          if (now - lastSend > PING_MS) { ws.send(new Uint8Array([3])); lastSend = now; }
        }
      }

      updateRemotes(dt, now);
    },
  };
}
