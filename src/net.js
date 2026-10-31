// Multiplayer client: name, connection to the relay, other players' lapas. Owned by the multiplayer work.
//
// The relay (server/, Go) forwards each player's position to the players within ~400 m. This module asks for a name once,
// sends our state ~10 Hz when it changed, and draws everybody else as a lapa with a name tag and a minimap dot.
// Protocol (binary, little endian) is documented in server/protocol.go; the numbers below must match it.
//
// Nothing happens (no DOM, no socket, no per-frame work) until a relay URL is set: RELAY_URL below, or ?relay=wss://host/ws
// for testing. ?relay=off disables it. ?name=Foo sets the name for this page load only, ?room=xyz picks a private room.
//
// Two separate things talk to the relay:
//  1. Anonymous play statistics: a random id kept in localStorage and a tiny HTTP POST (/ping) when a session starts, about
//     every 3 minutes of active play, and when the page is hidden. No name, no IP is stored. The answer says whether
//     multiplayer is open (the relay stops accepting WebSockets when it nears its monthly free-tier budget).
//  2. The WebSocket, open only while the game is in 'play' (not on menus or pause), the tab is visible and the player did
//     something in the last 2 minutes. Every open second counts against the relay's free-tier budget.
import * as THREE from 'three';

const RELAY_URL = ''; // wss://<cloud-run-host>/ws once the relay is deployed (see server/DEPLOY.md)

const STORE_KEY = 'palermoDrive.net.v1';   // { name, offline }
const SETTINGS_KEY = 'palermoDrive.settings.v1'; // owned by ui.js: we only read the language
const PROTO = 1;
const SEND_MS = 100;           // state send interval (only when something changed)
const PING_MS = 10000;         // keep-alive when we have nothing to say
const DEAD_MS = 30000;         // server sends something at least every 10 s
const HIDDEN_MS = 5000;        // leave the relay when the tab has been in the background this long
const MENU_MS = 10000;         // ... or the game has been paused / on a menu this long
const INPUT_MS = 120000;       // ... or the player has not touched anything this long
const BEAT_S = 180;            // seconds of active play between stats pings
const PID_KEY = 'palermoDrive.pid.v1'; // random anonymous player id
const DELAY = 150;             // interpolation buffer, ms
const EXTRAP = 250;            // longest extrapolation, ms
const FADE = 0.5;              // seconds
const TAU = Math.PI * 2;
const PINK = '#ff6fae', PINK_D = '#e8559a', BLACK = '#0d0709';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapPI = a => a - TAU * Math.floor((a + Math.PI) / TAU);

const T = {
  it: { ask: 'Come ti chiami?', askSub: 'Guida online con altri giocatori. Puoi cambiarlo quando vuoi.', edit: 'Il tuo nome', ph: 'Nome', join: 'Gioca online', skip: 'Offline',
    save: 'Salva', close: 'Chiudi', goOffline: 'Gioca offline', goOnline: 'Torna online', online: 'online', offline: 'offline', connecting: 'connessione…', guest: 'Ospite' },
  en: { ask: "What's your name?", askSub: 'Drive online with other players. You can change it any time.', edit: 'Your name', ph: 'Name', join: 'Play online', skip: 'Offline',
    save: 'Save', close: 'Close', goOffline: 'Play offline', goOnline: 'Go online', online: 'online', offline: 'offline', connecting: 'connecting…', guest: 'Guest' },
};

const CSS = `
.pdn-pill{position:fixed;z-index:30;right:226px;top:20px;display:flex;align-items:center;gap:7px;padding:5px 11px 5px 9px;border-radius:99px;
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
html.touch .pdn-pill{right:calc(max(12px,env(safe-area-inset-right)) + clamp(76px,25vh,104px) + 8px);top:max(10px,env(safe-area-inset-top));font-size:11px;padding:4px 9px 4px 8px}
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
  const relayUrl = (() => {
    const q = params.get('relay');
    let u = q != null ? q : RELAY_URL;
    if (!u || u === 'off' || u === '0') return '';
    try {
      const x = new URL(u);
      if (x.protocol !== 'ws:' && x.protocol !== 'wss:') return '';
      if (x.pathname === '/') x.pathname = '/ws';
      if (params.get('room')) x.searchParams.set('room', params.get('room'));
      return x.href;
    } catch (e) { return ''; }
  })();
  if (!relayUrl) return { update() {}, enabled: false, openName() {}, get online() { return false; } };

  // ---------- stored name ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  const store = load();
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ name: store.name || '', offline: !!store.offline })); } catch (e) { /* private mode: fine */ } };
  const urlName = (params.get('name') || '').slice(0, 16);
  if (urlName) { store.name = urlName; store.offline = false; } // this page load only (not saved until the player edits)
  const lang = () => {
    let l = 'it';
    try { l = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}).lang; } catch (e) { /* ignore */ }
    const p = params.get('lang'); if (p === 'en' || p === 'it') l = p;
    return T[l] || T.it;
  };

  // ---------- state ----------
  let started = false, ws = null, status = 'idle', attempts = 0, retryT = 0, everOnline = false;
  let mp = null, promptShown = false, activeSec = 0, lastPlay = 0, lastInput = performance.now(), pingTimer = 0, pingTries = 0;
  let myId = -1, count = 0, lastRecv = 0, lastSend = 0, lastSentState = null, lastInfoKey = '', sendAcc = 0;
  let hiddenTimer = 0, sleeping = false, blocked = false, pingBusy = false;
  const remotes = new Map(), dying = [];

  if (params.has('netdebug')) window.__net = { remotes, dying, get status() { return status; }, get count() { return count; } }; // TEMP
  // ---------- DOM ----------
  let pill = null, card = null;
  function ensureUI() {
    if (pill) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pdn-pill off';
    pill.innerHTML = '<span class="d"></span><span class="c"></span><span class="n"></span>';
    pill.addEventListener('click', () => openName());
    document.body.appendChild(pill);
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
    ensureUI(); closeCard();
    const t = lang(), editing = !!store.name;
    card = document.createElement('div'); card.className = 'pdn-card'; card.setAttribute('role', 'dialog');
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      store.name = name; store.offline = false; sleeping = false; attempts = 0; save(); closeCard(); infoDirty(); renderPill();
    });
    card.querySelector('.no').addEventListener('click', () => {
      if (!editing) { store.offline = true; save(); renderPill(); }
      closeCard();
    });
    const lnk = card.querySelector('.lnk');
    if (lnk) lnk.addEventListener('click', () => { store.offline = !store.offline; sleeping = false; attempts = 0; save(); closeCard(); renderPill(); });
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
  const pingUrl = (() => { try { const u = new URL(relayUrl); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; u.pathname = '/ping'; u.search = ''; return u.href; } catch (e) { return ''; } })();
  function onPingAnswer(j) {
    const was = mp; mp = !!(j && j.mp === 1); pingTries = 0;
    if (mp && !was && !store.name && !store.offline && !promptShown) { promptShown = true; setTimeout(() => { if (!store.name && !store.offline && !card) openName(); }, 1200); }
    if (mp !== was) { ensureUI(); renderPill(); }
  }
  function ping(ev, secs, beacon) {
    if (!pingUrl) return;
    const sent = Math.round(secs || 0), body = pid + ',' + ev + (sent ? ',' + sent : '');
    if (beacon) { try { if (navigator.sendBeacon(pingUrl, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ } }
    pingBusy = true; if (ev === 'b') activeSec -= sent;
    fetch(pingUrl, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { pingBusy = false; onPingAnswer(j); })
      .catch(code => {
        pingBusy = false; if (ev === 'b') activeSec += sent; // credit it with the next ping
        if (code === 429) return;
        mp = false; if (pill) renderPill();
        // relay unreachable: keep trying quietly, 5 s, 10 s ... up to 5 minutes between tries
        clearTimeout(pingTimer); pingTimer = setTimeout(() => ping('b', 0), Math.min(300000, 5000 * 2 ** Math.min(pingTries++, 6)));
      });
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
    const b = new Uint8Array(11), dv = new DataView(b.buffer);
    b[0] = 2;
    dv.setInt16(1, clamp(Math.round(x * 10), -32768, 32767), true); dv.setInt16(3, clamp(Math.round(z * 10), -32768, 32767), true);
    b[5] = Math.round(((th % TAU) + TAU) % TAU / TAU * 256) & 255;
    dv.setInt8(6, clamp(Math.round(v * 2), -127, 127)); dv.setInt8(7, q8(steer, 0.7)); dv.setInt8(8, q8(roll, 0.5)); dv.setInt8(9, q8(lean, 1));
    b[10] = fl;
    return b;
  }
  function sendState(now) {
    let b;
    if (params.has('netdrive')) { const [cx, cz] = params.get('netdrive').split(',').map(Number), a = now / 1000 * 0.3; b = packState(cx, cz + Math.sin(a) * 30, Math.cos(a) >= 0 ? 0 : Math.PI, 10 * Math.abs(Math.cos(a)), 0.2 * Math.cos(a * 3), -0.12, 0.3 * Math.sin(a * 2), 1); ws.send(b); lastSend = now; return true; } // TEMP
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
      case 0x21: count = dv.getUint8(1); renderPill(); break;
      case 0x22: { // INFO
        const id = dv.getUint8(1), liv = dv.getUint8(2), n = dv.getUint8(3);
        const name = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset + 4, n));
        let r = remotes.get(id);
        if (!r) { r = makeRemote(id); remotes.set(id, r); }
        setInfo(r, name, liv); break;
      }
      case 0x23: { const r = remotes.get(dv.getUint8(1)); if (r) { remotes.delete(r.id); retire(r); } break; }
      case 0x24: {
        const n = dv.getUint8(1);
        for (let i = 0, o = 2; i < n; i++, o += 11) {
          const r = remotes.get(dv.getUint8(o)); if (!r) continue;
          const t = now, x = dv.getInt16(o + 1, true) / 10, z = dv.getInt16(o + 3, true) / 10;
          const s = { t, x, z, th: dv.getUint8(o + 5) / 256 * TAU, v: dv.getInt8(o + 6) / 2, steer: dv.getInt8(o + 7) / 127 * 0.7,
            roll: dv.getInt8(o + 8) / 127 * 0.5, lean: dv.getInt8(o + 9) / 127, fl: dv.getUint8(o + 10) };
          const l = r.snaps[r.snaps.length - 1];
          if (l) {
            const gap = t - l.t, d = Math.hypot(s.x - l.x, s.z - l.z);
            if (d > 25 + 0.045 * gap) r.snaps.length = 0; // teleport (respawn, or came back from far away)
            else if (gap > 300 && Math.abs(l.v) < 0.5) r.snaps.push({ ...l, t: t - 100 }); // it sat still until just now
          }
          r.snaps.push(s); if (r.snaps.length > 16) r.snaps.shift();
          r.have = true;
        }
        break;
      }
    }
  }

  // ---------- remote players ----------
  const flameGeo = new THREE.ConeGeometry(0.1, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  function tagTexture(name) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), f = '700 30px system-ui,-apple-system,sans-serif';
    g.font = f; const w = Math.ceil(g.measureText(name).width) + 30, h = 46;
    c.width = Math.max(w, 60); c.height = h;
    g.font = f; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(13,7,9,0.72)'; g.beginPath(); g.roundRect ? g.roundRect(1.5, 1.5, c.width - 3, h - 3, 12) : g.rect(1.5, 1.5, c.width - 3, h - 3); g.fill();
    g.strokeStyle = PINK_D; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.fillText(name, 15, h / 2 + 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    return t;
  }

  function makeRemote(id) {
    const marker = { x: 0, z: 0, color: PINK, size: 4 };
    return { id, name: '', livery: -1, snaps: [], have: false, model: null, tag: null, flames: null, marker, alpha: 0, target: 1, lift: 0, y: 0, shadow: true, fadeMats: null, spin: 0, shown: false };
  }
  function setInfo(r, name, liv) {
    const lid = (vehicle.LIVERIES && vehicle.LIVERIES[liv] && vehicle.LIVERIES[liv].id) || 'blu';
    if (r.livery !== liv || !r.model) {
      if (r.model) { scene.remove(r.model.root); r.fadeMats = null; }
      r.livery = liv;
      r.model = vehicle.buildLapa ? vehicle.buildLapa(lid) : null;
      if (r.model) {
        r.model.root.visible = false; scene.add(r.model.root);
        r.flames = [-0.3, 0.3].map(x => { const m = new THREE.Mesh(flameGeo, flameMat); m.position.set(x, 0.36 - r.model.PIV, -1.6); m.visible = false; m.frustumCulled = false; r.model.tilt.add(m); return m; });
        if (r.tag) r.model.root.add(r.tag);
        r.shadow = true; for (const me of r.model.meshes) me.userData.sh = me.castShadow;
      }
    }
    if (name !== r.name || !r.tag) {
      r.name = name;
      if (r.tag) { r.tag.material.map.dispose(); r.tag.material.dispose(); r.model && r.model.root.remove(r.tag); }
      const map = tagTexture(name || '?');
      r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
      r.tag.scale.set(0.042 * map.image.width / map.image.height, 0.042, 1);
      r.tag.position.set(0, 2.55, 0); r.tag.renderOrder = 20;
      if (r.model) r.model.root.add(r.tag);
    }
  }

  function applyAlpha(r) {
    const a = r.alpha;
    if (a >= 0.999) {
      if (r.fadeMats) { for (const [m, o, c] of r.fadeMats) { m.material = o; c.dispose(); } r.fadeMats = null; }
    } else if (r.model) {
      if (!r.fadeMats) {
        r.fadeMats = r.model.meshes.map(m => { const o = m.material, c = o.clone(); c.userData.base = o.opacity; c.transparent = true; m.material = c; return [m, o, c]; });
      }
      for (const [, , c] of r.fadeMats) c.opacity = c.userData.base * a;
    }
    if (r.tag) r.tag.material.opacity = a * r.tagA;
  }

  function retire(r) { // player left: fade out, then free
    r.target = 0;
    const i = mapMarkers.indexOf(r.marker); if (i >= 0) mapMarkers.splice(i, 1);
    dying.push(r);
  }
  function dispose(r) {
    r.fadeMats && r.fadeMats.forEach(([, , c]) => c.dispose()); r.fadeMats = null;
    if (r.model) scene.remove(r.model.root);
    if (r.tag) { r.tag.material.map.dispose(); r.tag.material.dispose(); }
    const i = mapMarkers.indexOf(r.marker); if (i >= 0) mapMarkers.splice(i, 1);
  }
  function dropAll() {
    for (const r of remotes.values()) retire(r);
    remotes.clear();
  }

  function sample(r, now) {
    const s = r.snaps, rt = now - DELAY;
    while (s.length > 2 && s[1].t <= rt) s.shift();
    const a = s[0], b = s[1];
    if (!b || rt >= b.t) {
      const l = s[s.length - 1], dt = clamp(rt - l.t, 0, EXTRAP) / 1000;
      return { x: l.x + Math.sin(l.th) * l.v * dt, z: l.z + Math.cos(l.th) * l.v * dt, th: l.th, v: l.v, steer: l.steer, roll: l.roll, lean: l.lean, fl: l.fl };
    }
    if (rt <= a.t) return a;
    const k = (rt - a.t) / (b.t - a.t), m = (p, q) => p + (q - p) * k;
    return { x: m(a.x, b.x), z: m(a.z, b.z), th: a.th + wrapPI(b.th - a.th) * k, v: m(a.v, b.v), steer: m(a.steer, b.steer), roll: m(a.roll, b.roll), lean: m(a.lean, b.lean), fl: b.fl };
  }

    function poseRemote(r, dt, now) {
    const m = r.model; if (!m || !r.snaps.length) return;
    const p = sample(r, now);
    const gy = groundY(p.x, p.z), lt = raisedMask(p.x, p.z) ? CURB : 0;
    r.lift += (lt - r.lift) * Math.min(1, 12 * dt);
    m.root.position.set(p.x, gy + r.lift, p.z); m.root.rotation.y = p.th;
    m.tilt.rotation.set(0, 0, p.roll);
    const th = p.lean * m.tipMax, px = -0.66 * Math.sign(p.lean);
    m.lean.rotation.z = th; m.lean.position.set(px * (1 - Math.cos(th)), -px * Math.sin(th), 0);
    r.spin += p.v * dt / 0.23;
    for (const w of m.wheels) { w.spin.rotation.x = r.spin; if (w.front) w.pivot.rotation.y = p.steer; }
    m.bar.rotation.y = p.steer * 0.9;
    if (r.flames) { const on = (p.fl & 1) === 1; for (const f of r.flames) { f.visible = on; if (on) f.scale.set(1.3, 1.3, 1.6 + Math.random() * 0.8); } }
    r.marker.x = p.x; r.marker.z = p.z;
    const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
    r.tagA = clamp((330 - d) / 100, 0, 1);
    const sh = d < 90; if (sh !== r.shadow) { r.shadow = sh; for (const me of m.meshes) me.castShadow = sh && me.userData.sh; }
    if (!r.shown) { r.shown = true; m.root.visible = true; mapMarkers.push(r.marker); }
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
      if (params.has('netdrive')) lastInput = now; // TEMP
      const live = now - lastPlay < MENU_MS && !document.hidden && now - lastInput < INPUT_MS;
      if (live && game.state === 'play') { activeSec += dt; if (activeSec >= BEAT_S && !pingBusy) ping('b', activeSec); }
      // wake up after an idle kick as soon as the player drives again
      if (sleeping && game.state === 'play' && Math.abs(car.vf || 0) > 1) { sleeping = false; attempts = 0; }
      const want = wanted() && mp === true && live && !sleeping;
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

      if (remotes.size || dying.length) {
        for (const r of remotes.values()) {
          if (r.have) { r.alpha = Math.min(1, r.alpha + dt / FADE); }
          if (r.tagA === undefined) r.tagA = 0;
          if (!r.have) continue;
          poseRemote(r, dt, now); applyAlpha(r);
        }
        for (let i = dying.length - 1; i >= 0; i--) {
          const r = dying[i]; r.alpha = Math.max(0, r.alpha - dt / FADE);
          if (r.alpha <= 0) { dispose(r); dying.splice(i, 1); continue; }
          if (r.tagA === undefined) r.tagA = 0;
          applyAlpha(r);
        }
      }
    },
  };
}
