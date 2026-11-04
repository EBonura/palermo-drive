// The play log: a few anonymous counts about how the game ran and how it was played, sent to our own service (joinlog/, on Cloud Run, into a BigQuery table).
// One small report about every 3 minutes of driving (a batch of what happened since the last), one when the player has been in the game for a few seconds and has actually moved ('join') and one when the page
// goes away ('leave', through sendBeacon). Nothing is sent before the player is actually driving, and nothing is sent for the title, the menus or the Garage.
// Who: everybody, solo or online. A report carries the name only when the player chose one on the name card and went online; solo players and players who have not answered the card send none.
// There is no lasting id: the visit id is random for this page load, lives in this closure and is never stored. Nothing about it is saved in localStorage; the only saved thing is the player's off switch
// (there is no off switch since 4 Nov 2026, the owner's decision). No position, route, chat phrase, neighbourhood, address or user agent is in a report.
//
// While PLAYLOG_URL (src/playlog-url.js) is empty nothing is sent. Never sent: automated browsers (navigator.webdriver) and the test and screenshot addresses (?p2p, ?ns=, ?fixres, ?clean, ?debug).
// A build made with --playlog=<url> (tools/build/build.mjs) is for local tests of this module: it sends from those addresses too.
//
//   const log = createPlayLog({ game, car, renderer, perf, getName, getPlayers, getMissionId });   // getName(): the chosen name when playing online, else ''; getPlayers(): other players drawn
//   log.update(dt);                                                      // every frame
import { PLAYLOG_URL } from './playlog-url.js';
import { getLang } from './lang.js';

const URL_ = typeof __PD_PLAYLOG_URL__ !== 'undefined' ? __PD_PLAYLOG_URL__ : PLAYLOG_URL;
const TEST = typeof __PD_PLAYLOG_TEST__ !== 'undefined' && __PD_PLAYLOG_TEST__;
export const PLAYLOG_ON = !!URL_;   // the privacy wording (src/p2p/p2p.js) follows this

const tune = TEST ? +new URLSearchParams(location.search).get('plms') || 0 : 0;   // test builds only: ?plms=<ms> shortens the 3 minutes
const JOIN_AFTER_S = tune ? 1 : 5, ALIVE_MS = tune || 180000, MIN_BATCH_S = tune ? 1 : 20, MAX_MISSIONS = 8, JOIN_MIN_M = 5;
const rnd = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };

function gpuFamily(renderer) {   // the maker only, never the model
  try {
    const g = renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'), s = x ? String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
    return /apple/.test(s) ? 'apple' : /nvidia|geforce/.test(s) ? 'nvidia' : /amd|radeon/.test(s) ? 'amd' : /intel/.test(s) ? 'intel' : /adreno|qualcomm/.test(s) ? 'adreno' : /mali/.test(s) ? 'mali' : 'other';
  } catch (e) { return 'other'; }
}

export function createPlayLog({ game, car, renderer, perf, getName = () => '', getPlayers = () => 0, getMissionId = () => '' }) {
  const params = new URLSearchParams(location.search);
  const blocked = !URL_ || (!TEST && (navigator.webdriver || ['p2p', 'ns', 'fixres', 'clean', 'debug'].some(k => params.has(k))));
  if (blocked) return { update() {}, enabled: false };

  const vid = rnd();   // this page load only
  const device = matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop';
  const version = document.querySelector('meta[name="pd-version"]')?.dataset.name || '0.0.dev';
  const gpu = gpuFamily(renderer);
  const on = () => true;

  let joined = false, t0 = 0, lastSend = 0, playTotal = 0, lastX = NaN, lastZ = NaN, playersAt = 0;
  let b;   // the batch since the last report
  const fresh = () => ({ playS: 0, frames: 0, sumDt: 0, hist: new Uint32Array(121), dist: 0, cash: 0, bust: 0, players: 0, m: {} });
  b = fresh();
  const mis = id => b.m[id] || (Object.keys(b.m).length < MAX_MISSIONS && /^[a-z0-9_.:-]{1,40}$/.test(id) ? (b.m[id] = [0, 0, 0]) : null);
  addEventListener('pd-fare', e => { const a = e.detail && e.detail.amount; if (on() && a > 0) b.cash += Math.round(a); });
  addEventListener('pd-busted', () => { if (on()) b.bust++; });
  addEventListener('pd-event-busy', e => { if (e.detail && on()) { const m = mis(String(getMissionId() || '')); if (m) m[0]++; } });   // a mission starts; 'pd-event-end' (src/missions.js) says how it ended
  addEventListener('pd-event-end', e => { const d = e.detail; if (on() && d && typeof d.id === 'string') { const m = mis(d.id); if (m) m[d.ok ? 1 : 2]++; } });

  function post(body, beacon) {
    if (beacon && navigator.sendBeacon) { try { if (navigator.sendBeacon(URL_, body)) return; } catch (e) { /* fall through to fetch */ } }
    let tries = 0;
    // referrerPolicy 'origin', never 'no-referrer': Safari and every iPhone browser then send Origin: null on this POST, and the service refuses it. Chrome hides the problem.
    const go = () => { try { fetch(URL_, { method: 'POST', body, mode: 'no-cors', keepalive: true, credentials: 'omit', referrerPolicy: 'origin', cache: 'no-store' }).catch(() => { if (++tries < 2) setTimeout(go, 5000); }); } catch (e) { /* silent */ } };
    go();
  }

  function build(t, withBatch) {
    const o = { v: 1, t, vid, d: device, l: getLang(), g: version, s: Math.max(0, Math.round((performance.now() - t0) / 1000)) };
    const name = getName(); if (name) o.n = name;
    if (!withBatch) return o;
    o.ps = Math.round(b.playS);
    if (name) o.pl = b.players;
    if (b.frames >= 100) {
      o.fps = Math.round(b.frames / b.sumDt);
      let need = Math.ceil(b.frames * 0.01), ms = 120; for (let i = 120; i >= 0; i--) { need -= b.hist[i]; if (need <= 0) { ms = i; break; } }
      o.p1 = ms;   // the slowest 1% of frames took at least this many ms
    }
    const st = perf && perf.stats && perf.stats(), g = st && st.state;
    if (g && g.level) { o.lv = g.s; o.mo = g.mode; o.sh = g.level.sh; }
    if (st && st.ratio > 0) o.rs = Math.round(st.ratio * 100);
    const mem = performance.memory && performance.memory.usedJSHeapSize; if (mem > 0) o.mem = Math.min(65535, Math.round(mem / 1048576 / 10) * 10);
    o.gpu = gpu;
    if (typeof car.type === 'string' && /^[a-z0-9_.:-]{1,24}$/.test(car.type)) o.veh = car.type;
    if (b.dist >= 1) o.dist = Math.min(500000, Math.round(b.dist));
    if (b.cash > 0) o.cash = Math.min(1000000, b.cash);
    if (b.bust > 0) o.bust = Math.min(1000, b.bust);
    if (Object.keys(b.m).length) o.m = b.m;
    return o;
  }
  function send(t, beacon) {
    if (!on()) return;
    const withBatch = t !== 'join';
    const body = JSON.stringify(build(t, withBatch));
    if (withBatch) b = fresh();
    lastSend = performance.now();
    post(body, beacon);
  }

  addEventListener('pagehide', () => { if (joined) send('leave', true); });

  return {
    enabled: true,
    update(dt) {
      if (!on()) { if (b.frames || b.playS) b = fresh(); return; }
      if (game.state !== 'play' || game.garage || !(dt > 0)) { lastX = NaN; return; }
      if (dt < 1) { b.playS += dt; playTotal += dt; }
      if (dt < 0.25) { b.frames++; b.sumDt += dt; b.hist[Math.min(120, Math.round(dt * 1000))]++; }
      if (car.x === car.x && lastX === lastX) { const d = Math.hypot(car.x - lastX, car.z - lastZ); if (d < 60) b.dist += d; }   // a jump (a restart, a teleport) is not distance
      lastX = car.x; lastZ = car.z;
      const now = performance.now();
      if (getName() && now - playersAt > 1000) { playersAt = now; try { b.players = Math.max(b.players, getPlayers()); } catch (e) { /* none */ } }
      if (!joined) { if (playTotal >= JOIN_AFTER_S && b.dist >= JOIN_MIN_M) { joined = true; t0 = now - playTotal * 1000; send('join'); } return; }
      if (now - lastSend >= ALIVE_MS && b.playS >= MIN_BATCH_S) send('alive');
    },
  };
}
