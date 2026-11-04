// Load test of the peer to peer netcode with many players (docs/P2P-MULTIPLAYER.md, section "Stress test"). Everything runs on this Mac.
//
//   CHROME=<chrome-headless-shell> node tools/p2p/stress.mjs --root dist --scenario A --n 32 [--real 1] [--maxp 8] [--phone] [--append docs/p2p/measurements.txt]
//
//   --scenario  A  everyone in one spot, arriving over 20 s, then steady (the worst crowd)
//               B  spread over the city, each holds its closest players ("closest players" mode)
//               C  everyone arrives in the same second at one spot; after a minute half of them drive off at 40 m/s (bots 40 s, real pages 15 s) and come back
//               D  rolling join: one player every --gap seconds (3) into one spot
//               E  fast driving (50 m/s) back and forth over cell borders, so rooms hand over constantly
//               H  headroom: --maxp M with M+1 players in one spot (a full mesh), measuring the real client's frame time, CPU and bandwidth (add --phone for the phone profile)
//               P  public relays: the same as A with the game's own relay list. ONLY with --n 4 or less, a few minutes, once (this is the one run allowed to touch real relays)
//   --n N       players in total (default 16);  --real R  how many of them are full game pages (default 1; 2 from 32 up), the rest are light bots
//   --maxp M    the cap on other players (?maxp=, default: the shipped 8);  --steady S  seconds of steady state measured at the end (default 60);  --seed K  (default 1)
//   --end S     total seconds of the scenario, to override the default (smoke tests)
//   --patch F   experiments only: F is JSON [[from, to], ...] applied to the bots' copy of src/p2p/p2p.js (the real clients and the shipped file are untouched)
//   --append F  adds the raw numbers to F;  --json F  writes the full result (all samples) to F
//
// How it works. The game's signalling goes to public Nostr relays run by volunteers, so this does not use them: it starts five small local relays (tools/p2p/relay.mjs,
// 127.0.0.1 only, self-signed TLS because the shipped client accepts only wss:// in ?relays=) and passes them as ?relays=, five like the five pinned in src/p2p/relays.js (the
// first three also carry presence, as PRESENCE_RELAYS does). The page policy (CSP) of the shipped build allows only the pinned hosts, so the test serves the build through a tiny
// proxy that adds the local relay addresses to connect-src in index.html; the build on disk, and what is shipped, is not changed. Chrome is started with --host-resolver-rules so
// that every name except 127.0.0.1 fails to resolve: nothing in these runs can reach a public relay, a STUN server or the play stats service, and the run counts the lookups that were
// refused (it expects 0). Players use a private ?ns=, so real players never meet them even if something leaked.
// The players: a few real game pages (tools/p2p/lib.mjs player(), the shipped bundle) and many light bots (tools/p2p/botgame): the REAL src/p2p/p2p.js, presence and Trystero,
// bundled with the drawing, garage and language stubbed and STUN switched off (loopback). Same room choice, shards, rate limits, wire format and timers as a game client; what
// they do not do is draw cars, build models or run the game, so they cost less CPU and memory than a real page. They are not game clients and the report never says they are.
// A page starts when the scenario tells it to (the real pages load first, solo and unnamed; giving them a name at their start time is what makes them join, as in the game).
// Time: setup 20 to 60 s, then the scenario (A 135 s, B 135 s, C 195 s, D 3 s x n + 60 s, E 135 s, H 150 s) plus the steady window. A 64 player run takes about 4 minutes.
// If memory free drops below 25 % the run stops and reports what it has; a run whose pages stop answering is killed (watchdog) seven minutes after its planned end and appends nothing.
// Start it through the shared browser slot wrapper (tools/release/withbrowser.sh) with CHROME pointing at the headless shell, never at the owner's Chrome.
// Needs openssl on the PATH (a throw-away certificate for the local relays) and tools/build/node_modules (puppeteer-core, esbuild, ws).
// Chrome keeps only about 300 WebSockets open per browser context (measured), so every page of 8 bots gets a context of its own.
// When a netcode storm makes the pages stop answering, the numbers of that run are partial; the report says so (long gaps between samples, 0 players at the end).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { start, player, sleep, arg } from './lib.mjs';
import { startRelays } from './relay.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const esbuild = createRequire(path.join(HERE, '../build/package.json'))('esbuild');
const has = k => process.argv.includes('--' + k);
const SC = arg('scenario', 'A'), N = +arg('n', 16), STEADY = +arg('steady', 60), SEED = +arg('seed', 1), GAP = +arg('gap', 3), PHONE = has('phone');
const PER = +arg('per', 8);   // bots per browser page (each in an iframe of its own, so each has its own Trystero and its own id; one process for the lot)
const REAL = Math.min(N, +arg('real', N >= 32 ? 2 : 1)), MAXP_ARG = arg('maxp', ''), MAXP = MAXP_ARG ? +MAXP_ARG : 8;
const rnd = (() => { let a = SEED * 2654435761 >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const dist = (a, d = 0) => a.length ? { n: a.length, min: +a.reduce((m, v) => v < m ? v : m, Infinity).toFixed(d), p50: +pct(a, 0.5).toFixed(d), p90: +pct(a, 0.9).toFixed(d), max: +a.reduce((m, v) => v > m ? v : m, -Infinity).toFixed(d) } : { n: 0 };
const sum = a => a.reduce((s, v) => s + v, 0);
const within = (pr, ms, dflt = null) => Promise.race([pr, new Promise(r => setTimeout(() => r(dflt), ms))]);   // a page that stops answering must not stop the whole run
const memFree = () => { try { return +/free percentage: (\d+)%/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))[1]; } catch (e) { return 100; } };

// ---------- what the test serves ----------
async function buildBots() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-bots-')), G = p => path.join(HERE, 'botgame', p);
  await esbuild.build({ entryPoints: [G('entry.js')], bundle: true, format: 'esm', outfile: path.join(dir, 'bot.js'), minify: true, target: 'es2022', logLevel: 'warning', plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^\.\.\/(remotes|lang|garage|playlog)\.js$/ }, a => /src[\\/]p2p[\\/]/.test(a.importer) ? { path: G(path.basename(a.path)) } : null);
    b.onResolve({ filter: /^\.\/trystero\.js$/ }, a => /src[\\/]p2p[\\/](p2p|presence)\.js$/.test(a.importer) ? { path: G('trystero.js') } : null);
    if (arg('patch', '')) b.onLoad({ filter: /src[\\/]p2p[\\/]p2p\.js$/ }, a => {   // EXPERIMENTS ONLY (--patch file.json: [[from, to], ...]): edits the bots' copy of p2p.js to test a hypothesis; the shipped file is never touched
      let t = fs.readFileSync(a.path, 'utf8'); for (const [f, r] of JSON.parse(fs.readFileSync(arg('patch'), 'utf8'))) { if (!t.includes(f)) throw new Error('patch text not found: ' + f); t = t.replace(f, r); } return { contents: t, loader: 'js', resolveDir: path.dirname(a.path) }; });
    b.onResolve({ filter: /^REAL_TRYSTERO$/ }, () => ({ path: path.join(ROOT, 'src/p2p/trystero.js') }));
  } }] });
  fs.copyFileSync(G('bot.html'), path.join(dir, 'bot.html')); fs.writeFileSync(path.join(dir, 'host.html'), '<!doctype html><meta charset="utf-8"><title>bot host</title>');
  return dir;
}
const serveDir = dir => new Promise(res => { const s = http.createServer((q, r) => { const f = path.join(dir, q.url.split('?')[0] === '/' ? 'bot.html' : q.url.split('?')[0]); if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(f)); }); s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port })); });
// the shipped build's page policy lists the pinned relays only: add the local ones to connect-src in index.html on the way through (the build on disk is not touched)
const cspProxy = (inner, extra) => new Promise(res => { const s = http.createServer((q, r) => {
  const idx = ['/', '/index.html'].includes(q.url.split('?')[0]), headers = { ...q.headers }; if (idx) delete headers['accept-encoding'];
  const up = http.request({ host: '127.0.0.1', port: inner, path: q.url, method: q.method, headers }, u => {
    if (!idx || !extra) { r.writeHead(u.statusCode, u.headers); return u.pipe(r); }
    const ch = []; u.on('data', c => ch.push(c)); u.on('end', () => { const b = Buffer.from(Buffer.concat(ch).toString().replace("connect-src 'self'", `connect-src 'self' ${extra}`)), h = { ...u.headers, 'content-length': b.length }; delete h['content-encoding']; r.writeHead(u.statusCode, h); r.end(b); });
  });
  up.on('error', () => { r.writeHead(502); r.end(); }); q.pipe(up);
}); s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port })); });
function chromeTree(pid) {   // memory of the Chrome this run started: all its processes, from ps
  try {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8' }).split('\n').map(l => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], rss: +m[3], cmd: m[4] }));
    const kids = new Map(); rows.forEach(r => (kids.get(r.ppid) || kids.set(r.ppid, []).get(r.ppid)).push(r));
    const all = [], walk = p => (kids.get(p) || []).forEach(r => { all.push(r); walk(r.pid); }); walk(pid);
    const ren = all.filter(r => /--type=renderer/.test(r.cmd));
    return { mbAll: Math.round(sum(all.map(r => r.rss)) / 1024), renderers: ren.length, mbRenderers: Math.round(sum(ren.map(r => r.rss)) / 1024) };
  } catch (e) { return null; }
}

// ---------- the scenarios: where each player starts, when, and how it moves ----------
const SPOT = [-1250, 250];   // the crowd spot (the one scale.mjs and crowd.mjs use)
const LAND = [[-1250, 250], [3000, 2000], [-1250, 3500], [1000, 1500], [-2000, 250], [500, 250]];   // places the real pages have been put before without drowning
const BOX = [-2200, -250, -600, 750];   // E: x0, z0, x1, z1, over cell borders at x=-2000,-1500,-1000 and z=0,500
function plan() {
  const P = Array.from({ length: N }, (_, i) => ({ i, at: 0, x: SPOT[0], z: SPOT[1], mode: 'circle', v: 12, r: 40, cx: SPOT[0], cz: SPOT[1], real: false }));
  const realIdx = new Set(Array.from({ length: REAL }, (_, k) => Math.floor((k + 0.5) * N / REAL)));
  if (SC === 'D') { const a = Math.floor(N / 4), b = Math.floor(3 * N / 4); realIdx.clear(); [a, b].slice(0, REAL).forEach(i => realIdx.add(i)); if (REAL === 1) { realIdx.clear(); realIdx.add(a); } }
  P.forEach(p => { p.real = realIdx.has(p.i); });
  let end = 135, steadyFrom = 135 - STEADY, actions = [];
  if (SC === 'A' || SC === 'P') P.forEach(p => { p.at = rnd() * 20; });
  else if (SC === 'B') { let k = 0; P.forEach(p => { p.at = rnd() * 20; const c = p.real ? LAND[k++ % LAND.length] : [-4500 + rnd() * 9000, -3000 + rnd() * 9500]; Object.assign(p, { x: c[0], z: c[1], cx: c[0], cz: c[1] }); }); }
  else if (SC === 'C') {   // all at second 0; at 60 s the odd ones drive off (bots 40 s at 40 m/s in a random direction, real pages 15 s east or west along a road known to be land), turn round, and come back to the spot
    end = 200; steadyFrom = end - Math.min(STEADY, 45);
    P.forEach((p, i) => { if (i % 2 === 1) { const secs = p.real ? 15 : 40, th = p.real ? (i % 4 === 1 ? Math.PI / 2 : -Math.PI / 2) : rnd() * 6.283;
      actions.push({ at: 60, i, spec: { mode: 'line', v: 40, th } }); actions.push({ at: 60 + secs, i, spec: { mode: 'line', v: 40, th: th + Math.PI } }); actions.push({ at: 60 + 2 * secs, i, spec: { mode: 'circle', v: 12, r: 40, cx: SPOT[0], cz: SPOT[1], x: SPOT[0] + 40, z: SPOT[1] } }); } });
  } else if (SC === 'D') { P.forEach(p => { p.at = p.i * GAP; }); end = (N - 1) * GAP + 60; steadyFrom = end - Math.min(STEADY, 45); }
  else if (SC === 'E') { let k = 0; P.forEach(p => { p.at = rnd() * 10; const c = p.real ? [LAND[0][0] + 300 * (k++ % 3) - 300, 250 + 100 * (k % 2)] : [BOX[0] + rnd() * (BOX[2] - BOX[0]), BOX[1] + rnd() * (BOX[3] - BOX[1])]; Object.assign(p, { x: c[0], z: c[1], mode: 'bounce', v: 50, th: rnd() * 6.28, cx: (BOX[0] + BOX[2]) / 2, cz: (BOX[1] + BOX[3]) / 2, box: p.real ? [-2200, 150, -600, 350] : BOX }); }); }
  else if (SC === 'H') { P.forEach(p => { p.at = rnd() * 10; }); end = 150; steadyFrom = end - STEADY; }
  else throw new Error('scenario ' + SC);
  if (arg('end', '')) { end = +arg('end'); steadyFrom = end - STEADY; }   // --end S: run for S seconds (a short smoke test)
  return { P, end, steadyFrom, actions };
}

// ---------- the run ----------
const SAMPLE = lastT => { const d = window.__p2p, c = window.bot ? window.bot.car : window.game.car, peers = [...d.peers.values()]; return {
  w: performance.timeOrigin, mem: performance.memory ? performance.memory.usedJSHeapSize : 0, online: d.presence.size, shown: d.remotes.size,
  rooms: [...d.rooms.values()].map(r => r.i + ',' + r.j + (r.s ? ':' + r.s : '') + '=' + r.peers.size), home: (h => h ? h.i + ',' + h.j + (h.s ? ':' + h.s : '') : '')(d.home()),
  linked: peers.filter(p => p.rooms.size).length, held: peers.filter(p => p.rooms.size && p.held !== false).length, st: { ...d.stats }, x: Math.round(c.x), z: Math.round(c.z),
  ev: d.log.filter(e => e.t > lastT), logLen: d.log.length }; };
const REAL_MOVE = spec => { const c = window.game.car; if (window.__mv) cancelAnimationFrame(window.__mv.id); const m = window.__mv = { spec, id: 0, ang: Math.random() * 6.28, last: performance.now() };
  const f = now => { const dt = Math.min(0.1, (now - m.last) / 1000); m.last = now; const s = m.spec;
    if (s.mode === 'circle') { m.ang += s.v / s.r * dt; c.x = s.cx + Math.cos(m.ang) * s.r; c.z = s.cz + Math.sin(m.ang) * s.r; c.th = -m.ang; c.vf = s.v; }
    else if (s.mode === 'line') { if (m.th === undefined || m.thSet !== s) { m.th = s.th; m.thSet = s; } c.vf = s.v; c.x += Math.sin(m.th) * s.v * dt; c.z += Math.cos(m.th) * s.v * dt; c.th = m.th; }
    else if (s.mode === 'bounce') { if (m.th === undefined) m.th = s.th; c.vf = s.v; c.x += Math.sin(m.th) * s.v * dt; c.z += Math.cos(m.th) * s.v * dt; const [x0, z0, x1, z1] = s.box;
      if (c.x < x0 || c.x > x1 || c.z < z0 || c.z > z1) { c.x = Math.min(x1, Math.max(x0, c.x)); c.z = Math.min(z1, Math.max(z0, c.z)); m.th = Math.atan2(s.cx - c.x, s.cz - c.z) + (Math.random() - 0.5); } c.th = m.th; }
    else { c.x = s.x; c.z = s.z; c.vf = 0; }
    c.vx = Math.sin(c.th) * c.vf; c.vz = Math.cos(c.th) * c.vf; m.id = requestAnimationFrame(f); };
  m.id = requestAnimationFrame(f); };
const FRAMES = secs => new Promise(res => { const ts = []; let last = performance.now(), id; const t = setTimeout(() => { cancelAnimationFrame(id); res(ts); }, secs * 1000); const f = now => { ts.push(now - last); last = now; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); });

async function main() {
  const pl = plan(), local = SC !== 'P';
  if (SC === 'P' && N > 4) throw new Error('the public relay run is limited to 4 players');
  const botDir = await buildBots(), botSrv = await serveDir(botDir);
  const relays = local ? await startRelays({ n: 5 }) : null;
  const h = await start({ root: arg('root', 'dist'), extraArgs: ['--disable-features=IntensiveWakeUpThrottling', ...(local ? ['--ignore-certificate-errors', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost, EXCLUDE *.local'] : [])] });
  const proxy = await cspProxy(h.port, local ? relays.urls.join(' ') : ''); h.port = proxy.port;
  const ns = 'st' + Date.now().toString(36), relayParam = local ? '&relays=' + relays.urls.join(',') : '', maxpParam = MAXP_ARG ? '&maxp=' + MAXP : '';
  const net = { ws: {}, http: {}, refused: {} };   // hosts only, never addresses of peers
  const note = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const watch = async page => {
    const c = await page.createCDPSession(); await c.send('Network.enable').catch(() => {});
    c.on('Network.webSocketCreated', e => { try { note(net.ws, new URL(e.url).host); } catch (x) { /* odd url */ } });
    page.on('request', r => { try { const u = new URL(r.url()); if (u.protocol.startsWith('http')) note(net.http, u.host.replace(/:\d+$/, '')); } catch (x) { /* data: */ } });
    page.on('requestfailed', r => { try { if (/NAME_NOT_RESOLVED/.test((r.failure() || {}).errorText || '')) note(net.refused, new URL(r.url()).host); } catch (x) { /* odd url */ } });
  };
  const errs = new Map(), addErr = (t) => note(errs, String(t).replace(/\d{3,}/g, '#').slice(0, 140));
  const players = [];
  const t00 = Date.now();
  const loadOne = async p => {
    const name = (p.real ? 'R' : 'B') + p.i;
    if (p.real) {
      const g = await player(h, { name: '', ns, x: p.x, z: p.z, extra: `at=${p.x},${p.z},0${relayParam}${maxpParam}`, isolated: true, phone: PHONE && SC === 'H', cpu: PHONE && SC === 'H' ? 4 : 1, p2p: 'p2p' });
      await watch(g.page); g.errs.length = 0; Object.assign(p, g, { name });
    } else Object.assign(p, { name, errs: [] });
    p.frame = p.real ? p.page.mainFrame() : null; p.series = []; p.events = []; p.lastT = -1; p.startT = 0; p.cpu = [];
    if (p.real) { p.page.on('pageerror', e => addErr('real pageerror ' + e.message)); p.page.on('console', m => { if (m.type() === 'error') addErr('real console ' + m.text()); }); }
  };
  // isolation self-check (local runs): a public address must fail to resolve, and a STUN server must give no server-reflexive candidate
  let isolation = null;
  if (local) {
    const pg = await h.browser.newPage(); await pg.goto(`http://127.0.0.1:${botSrv.port}/bot.html`, { waitUntil: 'domcontentloaded' });
    isolation = await pg.evaluate(async () => {
      const r = {}; try { await fetch('https://joinlog-502854225296.europe-west8.run.app/e', { mode: 'no-cors' }); r.playStatsReachable = true; } catch (e) { r.playStatsReachable = false; }
      try { await fetch('https://nos.lol/', { mode: 'no-cors' }); r.publicRelayHostReachable = true; } catch (e) { r.publicRelayHostReachable = false; }
      r.stunServerReflexiveCandidates = await new Promise(res => { let n = 0; const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] }); pc.createDataChannel('x'); pc.onicecandidate = e => { if (e.candidate && e.candidate.type === 'srflx') n++; }; pc.createOffer().then(o => pc.setLocalDescription(o)); setTimeout(() => { pc.close(); res(n); }, 4000); });
      return r;
    }).catch(e => ({ error: String(e) }));
    await pg.close(); console.log('isolation self-check', JSON.stringify(isolation));
  }
  // real pages first (they take longest), then the bots, eight at a time
  const reals = pl.P.filter(p => p.real), bots = pl.P.filter(p => !p.real);
  await Promise.all(reals.map(loadOne));
  const treeReals = chromeTree(h.browser.process().pid);
  bots.forEach(loadOne);   // (nothing to load per bot: the pages below)
  const groups = [], urlOf = p => `http://127.0.0.1:${botSrv.port}/bot.html?p2p=nostr&ns=${ns}&name=${p.name}${relayParam}${maxpParam}${local ? '' : '&stun=1'}`;
  async function loadGroup(list, cpu = 1) {
    // a browser context of its own for each page: Chrome keeps about 300 WebSockets open per context and leaves the rest waiting without an error (measured), and 8 bots x 7 sockets is far below that
    const bctx = await h.browser.createBrowserContext(), page = await bctx.newPage(), grp = { page, list, cpu };
    await page.evaluateOnNewDocument(() => { Object.defineProperty(document, 'hidden', { get: () => false }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); });
    page.on('pageerror', e => addErr('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') addErr('console ' + m.text()); });
    await watch(page);
    if (cpu > 1) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
    await page.goto(`http://127.0.0.1:${botSrv.port}/host.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(urls => Promise.all(urls.map(u => new Promise(r => { const f = document.createElement('iframe'); f.src = u; f.style.cssText = 'width:8px;height:8px'; f.onload = r; document.body.appendChild(f); }))), list.map(urlOf));
    const frames = page.frames();
    list.forEach(p => { p.page = page; p.grp = grp; p.frame = frames.find(f => f.url() === urlOf(p)); });
    await Promise.all(list.map(p => p.frame.waitForFunction(() => window.bot && window.__p2p, { timeout: 60000 })));
    groups.push(grp);
  }
  // the headroom run gives two bots a page of their own, one of them slowed 4x like the phone profile: that is the main thread of the netcode alone
  const solo = SC === 'H' ? bots.splice(0, 2) : [];
  if (solo.length) { await loadGroup([solo[0]]); if (solo[1]) await loadGroup([solo[1]], 4); }
  const chunks = []; for (let i = 0; i < bots.length; i += PER) chunks.push(bots.slice(i, i + PER));
  for (let i = 0; i < chunks.length; i += 4) await Promise.all(chunks.slice(i, i + 4).map(c => loadGroup(c)));
  const treeLoaded = chromeTree(h.browser.process().pid);
  console.log(`loaded ${reals.length} real + ${bots.length} bots in ${((Date.now() - t00) / 1000).toFixed(0)} s; chrome ${treeLoaded ? treeLoaded.mbAll + ' MB, ' + treeLoaded.renderers + ' renderers' : '?'}; memory free ${memFree()} %`);

  // ---------- run the timeline ----------
  const startPlayer = async p => {
    const spec = { mode: p.mode, v: p.v, r: p.r, cx: p.cx, cz: p.cz, x: p.x, z: p.z, th: p.th, box: p.box };
    if (p.real) {
      await p.frame.evaluate(REAL_MOVE, spec);
      p.startT = await p.frame.evaluate(n => { try { localStorage.setItem('palermoDrive.net.v1', JSON.stringify({ name: n })); } catch (e) { /* storage */ } dispatchEvent(new Event('pd-name')); return Date.now(); }, p.name);
    } else p.startT = await p.frame.evaluate(o => { window.bot.start(o); return Date.now(); }, { ...spec, x: p.x, z: p.z, th: p.th || 0 });
    p.started = true;
  };
  const moveTo = async (p, spec) => { if (p.real) await p.frame.evaluate(REAL_MOVE, spec); else await p.frame.evaluate(o => window.bot.set(o), spec); };
  // a run whose pages stop answering (a netcode storm can do that) must still end: after the scenario plus 7 minutes the browser is killed
  const dog = setTimeout(() => { console.log('WATCHDOG: the run did not finish in time (pages not answering); browser killed'); try { h.browser.process().kill('SIGKILL'); } catch (e) { /* gone */ } process.exit(3); }, (pl.end + 420) * 1000);
  const T0 = Date.now(), ticks = [], relSnaps = [], tl = [];
  pl.P.forEach(p => tl.push({ at: p.at * 1000, run: () => startPlayer(p) }));
  pl.actions.forEach(a => tl.push({ at: a.at * 1000, run: () => moveTo(pl.P[a.i], a.spec) }));
  let winA = null, winB = null, aborted = null; const pageM = new Map();
  const bro = await h.browser.target().createCDPSession();
  const procCpu = async () => { try { return (await bro.send('SystemInfo.getProcessInfo')).processInfo; } catch (e) { return null; } };
  const winStart = pl.steadyFrom * 1000, winEnd = pl.end * 1000;
  const stamp = async (f, ms = 30000) => { const r = await within(f(), ms); return r ? { ...r, t: Date.now() } : null; };   // every reading carries the moment it was returned: windows are measured between readings, not between the planned times
  const stepLog = [];
  tl.push({ at: winStart, run: async () => {   // steady window opens: frame sampling on the real pages first (it runs for STEADY seconds on its own), then traces on, CPU and bandwidth counters read
    pl.P.filter(p => p.real && p.started).forEach(p => { p.frames = p.frame.evaluate(FRAMES, STEADY).catch(() => []); });
    let a = Date.now();
    winA = { T: Date.now(), tree: chromeTree(h.browser.process().pid), procs: await procCpu() }; stepLog.push(['open: process info', Date.now() - a]); a = Date.now();
    await Promise.all([...new Set(pl.P.filter(p => p.started).map(p => p.page))].map(async pg => { pageM.set(pg, { m0: await stamp(() => pg.metrics().catch(() => null), 20000) }); })); stepLog.push(['open: page metrics', Date.now() - a]); a = Date.now();
    await Promise.all(pl.P.map(async p => { if (!p.started) return; if (!p.real) await within(p.frame.evaluate(() => { window.__trace.on = true; }), 20000); p.w0 = await stamp(() => p.frame.evaluate(() => window.__p2p.wire()).catch(() => null)); })); stepLog.push(['open: bandwidth counters', Date.now() - a]);
  } });
  tl.push({ at: winEnd, run: async () => {
    let a = Date.now();
    winB = { T: Date.now(), tree: chromeTree(h.browser.process().pid), procs: await procCpu() }; stepLog.push(['close: process info', Date.now() - a]); a = Date.now();
    await Promise.all([...pageM].map(async ([pg, o]) => { o.m1 = await stamp(() => pg.metrics().catch(() => null), 20000); })); stepLog.push(['close: page metrics', Date.now() - a]); a = Date.now();
    await Promise.all(pl.P.map(async p => { if (!p.started) return; p.w1 = await stamp(() => p.frame.evaluate(() => window.__p2p.wire()).catch(() => null)); if (!p.real) p.trace = await within(p.frame.evaluate(() => window.__trace.drain()), 30000).catch(() => null); })); stepLog.push(['close: bandwidth counters and traces', Date.now() - a]);
  } });
  tl.sort((a, b) => a.at - b.at);
  let nextTick = 0, nextCheck = 0, ti = 0;
  const sampleAll = async () => {
    const tk = { T: Date.now(), s: [] };
    tk.s = await Promise.all(pl.P.map(async p => { if (!p.started) return null; try { const s = await within(p.frame.evaluate(SAMPLE, p.lastT), 20000); if (!s) { slowSamples++; return null; } p.lastT = s.ev.length ? Math.max(p.lastT, ...s.ev.map(e => e.t)) : p.lastT; s.ev.forEach(e => p.events.push({ ...e, T: s.w + e.t })); delete s.ev; return s; } catch (e) { return null; } }));
    ticks.push(tk); if (relays) relSnaps.push({ T: tk.T, r: relays.snapshot() });
  };
  let slowSamples = 0, lastLog = 0;
  while (Date.now() - T0 < winEnd + 1500) {
    const el = Date.now() - T0;
    while (ti < tl.length && tl[ti].at <= el) { const job = tl[ti++]; const grp = [job]; while (ti < tl.length && tl[ti].at <= el && tl[ti].at - job.at < 400) grp.push(tl[ti++]); await within(Promise.all(grp.map(j => j.run())), 90000); }
    if (el >= nextTick) { const a0 = Date.now(); await sampleAll(); nextTick = (Date.now() - T0) + 2000; if (el - lastLog > 30000) { lastLog = el; console.log(`  t=${Math.round(el / 1000)} s, a sample of ${pl.P.filter(p => p.started).length} pages took ${Date.now() - a0} ms, memory free ${memFree()} %`); } }
    if (el >= nextCheck) { nextCheck = el + 10000; const f = memFree(); if (f < 25) { aborted = `memory free ${f} % at ${(el / 1000).toFixed(0)} s`; console.log('STOP: ' + aborted); break; } }
    await sleep(100);
  }
  // let the real pages' frame sampling finish, then one last look
  const frames = {}; for (const p of pl.P.filter(p => p.real && p.frames)) frames[p.name] = await within(p.frames, 30000, []);
  await sampleAll();
  const tree = chromeTree(h.browser.process().pid);
  const relFinal = relays ? relays.snapshot() : null, relPeak = relays ? relays.peak(Math.floor(T0 / 1000), Math.floor(Date.now() / 1000)) : null;

  // ---------- analysis ----------
  const R = { scenario: SC, n: N, real: REAL, bots: N - REAL, maxp: MAXP, shippedCap: !MAXP_ARG, phone: PHONE, seed: SEED, endedEarly: aborted, durationS: Math.round((Date.now() - T0) / 1000), steadyS: STEADY };
  const act = (tk, i) => tk.s[i];
  // time to connect and to see someone, from each player's own start (a start that is a teleport or a name given is the moment the netcode begins)
  const firstAfter = (p, name) => { const e = p.events.find(e => e.ev === name && e.T > p.startT); return e ? e.T - p.startT : null; };
  const earliest = pl.P.filter(p => p.started).sort((a, b) => a.startT - b.startT)[0];
  const connect = pl.P.filter(p => p.started && p !== earliest).map(p => ({ real: p.real, i: p.i, peer: firstAfter(p, 'peerJoin'), seen: firstAfter(p, 'firstState') }));   // the first player in has nobody to meet until the second arrives, so it is left out
  const bucket = f => { const v = connect.filter(f); return { players: v.length, firstPeerMs: dist(v.map(c => c.peer).filter(x => x != null)), firstSeenMs: dist(v.map(c => c.seen).filter(x => x != null)), neverConnected: v.filter(c => c.peer == null).length, neverSaw: v.filter(c => c.seen == null).length }; };
  R.connect = { all: bucket(() => true), real: bucket(c => c.real), bots: bucket(c => !c.real) };
  // shards, over cap, alone: per tick
  const cap = MAXP + 1;
  let overRoomTicks = 0, overLinkTicks = 0, overShownTicks = 0, longestOver = 0, curOver = 0, maxLinked = 0, maxShown = 0, maxRoomMembers = 0, aloneTicks = 0;
  const alone = pl.P.map(() => ({ ever: false, cur: 0, longest: 0, total: 0, all: 0 }));   // every tick stands for the time since the one before it (the harness can be slow to sample when the Mac is busy)
  let TICK = 2, prevTickT = null;
  const roomsAt = tk => { const m = new Map(); tk.s.forEach(s => { if (s) s.rooms.forEach(r => { const k = r.split('=')[0]; m.set(k, (m.get(k) || 0) + 1); }); }); return m; };
  const members = []; let sawOver = null;
  for (const tk of ticks) {
    const rm = roomsAt(tk), mx = Math.max(0, ...rm.values()); maxRoomMembers = Math.max(maxRoomMembers, mx);
    const overRoom = mx > cap, overLink = tk.s.some(s => s && s.linked > MAXP), overShown = tk.s.some(s => s && s.shown > MAXP);
    TICK = prevTickT == null ? 2 : (tk.T - prevTickT) / 1000; prevTickT = tk.T;
    if (overRoom) overRoomTicks += TICK; if (overLink) overLinkTicks += TICK; if (overShown) overShownTicks += TICK;
    if (overLink) { curOver += TICK; longestOver = Math.max(longestOver, curOver); } else curOver = 0;
    tk.s.forEach((s, i) => { if (!s) return; maxLinked = Math.max(maxLinked, s.linked); maxShown = Math.max(maxShown, s.shown); const a = alone[i]; if (s.shown === 0 && N > 1 && tk.T - pl.P[i].startT > 4000) a.all += TICK; if (s.shown > 0) { a.ever = true; a.cur = 0; } else if (a.ever) { a.cur += TICK; a.total += TICK; a.longest = Math.max(a.longest, a.cur); } });
  }
  let lastChangeT = 0, prevKey = '';   // when did any player last change its set of rooms
  for (const tk of ticks) { const key = tk.s.map(x => x ? x.rooms.map(r => r.split('=')[0]).sort().join('|') : '-').join('/'); if (key !== prevKey) { lastChangeT = tk.T; prevKey = key; } }
  const lastStart = Math.max(...pl.P.filter(p => p.started).map(p => p.startT));
  const last = ticks[ticks.length - 1], firstStarted = ticks.findIndex(tk => tk.s.some(s => s));
  const expect = Math.min(N - 1, MAXP);
  const fin = last.s.filter(Boolean);
  R.end = {
    lastRoomChangeSOfRun: Math.round((lastChangeT - T0) / 1000), lastPlayerStartedAtS: Math.round((lastStart - T0) / 1000),
    active: fin.length, linked: dist(fin.map(s => s.linked)), shown: dist(fin.map(s => s.shown)), expectedShown: expect, belowExpected: fin.filter(s => s.shown < expect).length, onlineSeen: dist(fin.map(s => s.online)),
    rooms: (() => { const m = roomsAt(last), v = [...m.values()]; return { distinctRooms: m.size, sizes: v.sort((a, b) => b - a), maxMembers: Math.max(0, ...v) }; })(),
    homes: (() => { const m = new Map(); fin.forEach(s => { if (s.home) m.set(s.home, (m.get(s.home) || 0) + 1); }); return { distinct: m.size, sizes: [...m.values()].sort((a, b) => b - a) }; })(),
  };
  R.cap = { maxLinkedEver: maxLinked, maxShownEver: maxShown, maxRoomMembersEver: maxRoomMembers, roomLimit: cap, secondsWithAnyPlayerOverLinkCap: Math.round(overLinkTicks), longestStreakS: Math.round(longestOver), secondsWithRoomOverLimit: Math.round(overRoomTicks), secondsWithAnyShownOverCap: Math.round(overShownTicks), longestSampleGapS: Math.round(Math.max(...ticks.map((t, k) => k ? (t.T - ticks[k - 1].T) / 1000 : 0))) };
  R.alone = { secondsAloneSinceOwnStart: dist(alone.filter((a, i) => pl.P[i].started).map(a => a.all)), playersAloneOver10s: alone.filter(a => a.all > 10).length, playersEverAloneAfterSeeing: alone.filter(a => a.longest > 0).length, longestS: Math.max(0, ...alone.map(a => a.longest)), totalS: sum(alone.map(a => a.total)), endingAlone: fin.filter(s => s.shown === 0).length };
  // timeline of the crowd: how many saw someone, per 10 s
  R.timeline = ticks.filter((_, k) => k % 5 === 0).map(tk => { const v = tk.s.filter(Boolean); return [Math.round((tk.T - T0) / 1000), v.length, v.filter(s => s.shown > 0).length, Math.max(0, ...v.map(s => s.linked)), roomsAt(tk).size]; });
  // churn in the steady window: room level events per player per minute
  const wa = winA ? winA.T : T0, wb = winB ? winB.T : Date.now(), mins = (wb - wa) / 60000;
  const evNames = ['join', 'leave', 'peerJoin', 'peerLeave', 'drop', 'unheld', 'decoy', 'overfull', 'overcap', 'joinError'];
  const started = pl.P.filter(p => p.started), cnt = (names, f = e => true, from = wa, to = wb) => Object.fromEntries(names.map(n => [n, sum(started.map(p => p.events.filter(e => e.ev === n && e.T >= from && e.T <= to && f(e)).length))]));
  const cw = cnt(evNames), call = cnt(evNames, () => true, T0, Date.now());
  R.churn = { windowS: Math.round(mins * 60), perPlayerPerMin: Object.fromEntries(Object.entries(cw).map(([k, v]) => [k, +(v / Math.max(1, started.length) / Math.max(mins, 0.01)).toFixed(2)])), wholeRunTotals: call, droppedWhy: { left: sum(started.map(p => p.events.filter(e => e.ev === 'drop' && e.why === 'left' && e.T >= wa && e.T <= wb).length)), stale: sum(started.map(p => p.events.filter(e => e.ev === 'drop' && e.why === 'stale' && e.T >= wa && e.T <= wb).length)) } };
  // messages (app counters, steady window): sent vs received, over all players that were on at both ends
  const tkA = ticks.reduce((b, tk) => Math.abs(tk.T - wa) < Math.abs(b.T - wa) ? tk : b), tkB = ticks.reduce((b, tk) => Math.abs(tk.T - wb) < Math.abs(b.T - wb) ? tk : b), secsAB = Math.max(1, (tkB.T - tkA.T) / 1000);
  const dsum = k => sum(pl.P.map((_, i) => tkA.s[i] && tkB.s[i] ? tkB.s[i].st[k] - tkA.s[i].st[k] : 0));
  const tx = dsum('txMsgs'), rx = dsum('rxMsgs');
  R.messages = { windowS: +secsAB.toFixed(0), sent: tx, received: rx, lostOrInFlightPct: +(100 * (tx - rx) / Math.max(1, tx)).toFixed(2), rxDup: dsum('rxDup'), rxBad: dsum('rxBad'), rxDropped: dsum('rxDropped'), txPerPlayerPerS: +(tx / secsAB / Math.max(1, started.length)).toFixed(1), rxPerPlayerPerS: +(rx / secsAB / Math.max(1, started.length)).toFixed(1), txBytesPerPlayerPerS: +(dsum('txBytes') / secsAB / Math.max(1, started.length)).toFixed(0) };
  // position update delay between bots (send to receive, same Date.now()) and gaps between updates
  {
    const tx0 = new Map(), delays = [], gaps = [], nearGaps = [], dmLast = new Map(), lastRx = new Map(); let nrx = 0, nmatch = 0;
    const idOf = p => p.page && p.selfIdCache;
    for (const p of pl.P) if (p.started && !p.real) p.selfIdCache = await within(p.frame.evaluate(() => window.__p2p.selfId), 10000).catch(() => null);
    for (const p of pl.P) if (p.trace && p.selfIdCache) for (const [t, to, seq] of p.trace.tx) { const k = p.selfIdCache + '>' + to + ':' + seq; (tx0.get(k) || tx0.set(k, []).get(k)).push(t); }
    for (const p of pl.P) if (p.trace && p.selfIdCache) for (const [t, from, seq, dm] of p.trace.rx) { nrx++; const arr = tx0.get(from + '>' + p.selfIdCache + ':' + seq); let t0 = null; if (arr) for (let q = arr.length - 1; q >= 0; q--) if (arr[q] <= t + 2) { t0 = arr[q]; break; }   // the latest send with that sequence number that is not after the arrival (numbers wrap at 256, about 25 s)
      if (t0 != null && t - t0 < 5000) { delays.push(Math.max(0, t - t0)); nmatch++; } const pk = from + '>' + p.selfIdCache, lt = lastRx.get(pk); if (lt != null) { gaps.push(t - lt); if (dm >= 0 && dm < 150 && dmLast.get(pk) < 150) nearGaps.push(t - lt); } lastRx.set(pk, t); dmLast.set(pk, dm); }
    R.update = { fromBotsOnly: true, statesReceived: nrx, matchedToASend: nmatch, oneWayMs: dist(delays), oneWayP99: pct(delays, 0.99), gapMs: dist(gaps), gapP99: pct(gaps, 0.99), nearGapMs: dist(nearGaps), nearGapP99: pct(nearGaps, 0.99), nearGapOver250ms: nearGaps.filter(g => g > 250).length, nearGapOver1000ms: nearGaps.filter(g => g > 1000).length, gapOver250ms: gaps.filter(g => g > 250).length, gapOver1000ms: gaps.filter(g => g > 1000).length, pairs: lastRx.size };
  }
  // relays: what public relays would have to take
  if (relays) {
    const at = (T) => relSnaps.reduce((b, s) => Math.abs(s.T - T) < Math.abs(b.T - T) ? s : b), a = at(wa), b = at(wb), secs = Math.max(1, (b.T - a.T) / 1000), all0 = relSnaps[0], whole = Math.max(1, (relSnaps[relSnaps.length - 1].T - T0) / 1000);
    const per = b.r.map((x, i) => ({ relay: i, carries: i < 3 ? 'signalling+presence' : 'signalling only', inPerS: +((x.inFrames - a.r[i].inFrames) / secs).toFixed(1), outPerS: +((x.outFrames - a.r[i].outFrames) / secs).toFixed(1), inKBperS: +((x.inBytes - a.r[i].inBytes) / secs / 1024).toFixed(1), outKBperS: +((x.outBytes - a.r[i].outBytes) / secs / 1024).toFixed(1), presenceEventsInPerS: +((x.eventsInPresence - a.r[i].eventsInPresence) / secs).toFixed(2), presenceEventsOutPerS: +((x.eventsOutPresence - a.r[i].eventsOutPresence) / secs).toFixed(2), reqPerS: +((x.in.REQ - a.r[i].in.REQ) / secs).toFixed(2), eventPerS: +((x.in.EVENT - a.r[i].in.EVENT) / secs).toFixed(2), conns: x.conns, subsMax: x.subsMax }));
    const tot = f => sum(per.map(f));
    R.relay = { windowS: +secs.toFixed(0), perRelay: per, totalFramesPerS: +(tot(r => r.inPerS + r.outPerS)).toFixed(1), totalKBperS: +(tot(r => r.inKBperS + r.outKBperS)).toFixed(1), framesPerPlayerPerS: +(tot(r => r.inPerS + r.outPerS) / Math.max(1, started.length)).toFixed(2),
      busiestRelayFramesPerS: Math.max(...per.map(r => r.inPerS + r.outPerS)), estimateBusiestRelayFramesPerHour: Math.round(Math.max(...per.map(r => r.inPerS + r.outPerS)) * 3600), estimateBusiestRelayMBPerHour: +(Math.max(...per.map(r => r.inKBperS + r.outKBperS)) * 3600 / 1024).toFixed(0),
      wholeRun: { framesPerS: +(sum(relFinal.map(x => x.inFrames + x.outFrames)) / whole).toFixed(1), peakPerSecondIn: Math.max(...relPeak.map(x => x.peakIn)), peakPerSecondOut: Math.max(...relPeak.map(x => x.peakOut)), firstMinuteFrames: (() => { const m = at(T0 + 60000); return sum(m.r.map(x => x.inFrames + x.outFrames)); })() } };
  }
  // CPU of the pages in the steady window, and the real clients' frame time and bandwidth
  const wsecs = winB ? (winB.T - winA.T) / 1000 : 1;
  const cpuOf = p => { const o = pageM.get(p.page); if (!o || !o.m0 || !o.m1 || !winB) return null; const k = p.grp ? p.grp.list.length : 1; return { task: (o.m1.TaskDuration - o.m0.TaskDuration) / ((o.m1.t - o.m0.t) / 1000) * 1000 / k, script: (o.m1.ScriptDuration - o.m0.ScriptDuration) / ((o.m1.t - o.m0.t) / 1000) * 1000 / k, heapMB: o.m1.JSHeapUsedSize / 1048576 / k, perPage: k }; };
  const botCpu = pl.P.filter(p => !p.real && p.started).map(cpuOf).filter(Boolean);
  const procDelta = (type) => winA && winB && winA.procs && winB.procs ? sum(winB.procs.filter(x => x.type === type).map(x => x.cpuTime)) - sum(winA.procs.filter(x => x.type === type).map(x => x.cpuTime)) : null;
  R.processCpu = winA && winB ? { windowS: Math.round(wsecs), rendererCoresUsed: +(procDelta('renderer') / wsecs).toFixed(2), gpuCores: +(procDelta('gpu') / wsecs).toFixed(2), browserCores: +(procDelta('browser') / wsecs).toFixed(2), otherCores: +((sum((winB.procs || []).map(x => x.cpuTime)) - sum((winA.procs || []).map(x => x.cpuTime)) - procDelta('renderer') - procDelta('gpu') - procDelta('browser')) / wsecs).toFixed(2), note: 'cores = CPU seconds per wall second, summed over every process of the browser started by this run (includes the real game pages; "other" holds the network and utility processes, where the WebRTC sockets live)' } : null;
  R.botMainThread = { botsPerPage: PER, taskMsPerS: dist(botCpu.map(c => c.task), 0), scriptMsPerS: dist(botCpu.map(c => c.script), 0), jsHeapMB: dist(botCpu.map(c => c.heapMB), 0) };
  R.realClients = pl.P.filter(p => p.real && p.started).map(p => {
    const c = cpuOf(p), f = (frames[p.name] || []).slice().sort((a, b) => a - b), mean = f.length ? sum(f) / f.length : 0, w0 = p.w0, w1 = p.w1, secs = w0 && w1 ? Math.max(1, (w1.t - w0.t) / 1000) : 1, last = ticks[ticks.length - 1].s[p.i];
    return { name: p.name, frameMs: f.length ? { mean: +mean.toFixed(1), p95: +pct(f, 0.95).toFixed(1), p99: +pct(f, 0.99).toFixed(1), fps: +(1000 / mean).toFixed(0) } : null, taskMsPerS: c && Math.round(c.task), scriptMsPerS: c && Math.round(c.script), jsHeapMB: c && Math.round(c.heapMB),
      wire: w0 && w1 ? { pcs: w1.pcs, open: w1.open, upKBs: +((w1.sent - w0.sent) / secs / 1024).toFixed(1), downKBs: +((w1.recv - w0.recv) / secs / 1024).toFixed(1), wireUpKBs: +(((w1.tsent - w0.tsent) || 0) / secs / 1024).toFixed(1), wireDownKBs: +(((w1.trecv - w0.trecv) || 0) / secs / 1024).toFixed(1), links: w1.link } : null,
      shown: last && last.shown, linked: last && last.linked };
  });
  const soloCpu = groups.filter(g => g.list.length === 1).map(g => ({ throttle: g.cpu, name: g.list[0].name, ...(cpuOf(g.list[0]) || {}) }));
  R.soloBots = soloCpu; R.windowSteps = stepLog;
  const botWire = pl.P.filter(p => !p.real && p.w0 && p.w1).map(p => ({ up: (p.w1.sent - p.w0.sent) / (Math.max(1, (p.w1.t - p.w0.t) / 1000)) / 1024, down: (p.w1.recv - p.w0.recv) / (Math.max(1, (p.w1.t - p.w0.t) / 1000)) / 1024, wup: ((p.w1.tsent - p.w0.tsent) || 0) / (Math.max(1, (p.w1.t - p.w0.t) / 1000)) / 1024, pcs: p.w1.pcs }));
  R.botBandwidth = { upKBs: dist(botWire.map(w => w.up), 1), downKBs: dist(botWire.map(w => w.down), 1), wireUpKBs: dist(botWire.map(w => w.wup), 1), connections: dist(botWire.map(w => w.pcs)) };
  // memory
  R.memory = { chromeAtLoad: treeLoaded, chromeSteadyStart: winA && winA.tree, chromeEnd: tree, chromeAfterRealPages: treeReals, perBotPageMBApprox: treeLoaded && treeReals && bots.length ? +((treeLoaded.mbRenderers - treeReals.mbRenderers) / bots.length).toFixed(0) : null, perBotPageMBInMeshApprox: tree && treeReals && bots.length ? +((tree.mbRenderers - treeReals.mbRenderers) / bots.length).toFixed(0) : null, note: 'chrome tree = every process of the browser this run started; renderers include the real pages' };
  // network: nothing may leave the machine in a local run
  R.isolationSelfCheck = isolation;
  R.network = { websocketHosts: net.ws, httpHosts: net.http, refusedLookups: net.refused, onlyLocal: Object.keys(net.ws).every(k => /^127\.0\.0\.1:/.test(k)) && Object.keys(net.http).every(k => k === '127.0.0.1') && !Object.keys(net.refused).length };
  const joinErr = {}; started.forEach(p => p.events.filter(e => e.ev === 'joinError').forEach(e => note(joinErr, String(e.error).replace(/peer \w{20}/, 'peer *').slice(0, 90))));
  R.errors = { joinErrorKinds: joinErr, distinct: Object.fromEntries([...errs.entries()].slice(0, 12)), realPageErrors: reals.flatMap(p => p.errs).slice(0, 5), joinErrors: call.joinError, total: sum([...errs.values()]) };
  R.memFreeAtEnd = memFree();
  // ---------- print ----------
  const out = [];
  const L = s => out.push(s);
  L(`scenario ${SC} N=${N} (${REAL} real game pages + ${N - REAL} bots) cap ${MAXP}${MAXP_ARG ? ' (?maxp)' : ' (shipped)'}${PHONE ? ' phone profile' : ''} seed ${SEED}, ran ${R.durationS} s${aborted ? ', STOPPED: ' + aborted : ''}`);
  L(`  connect (ms from own start): first peer ${JSON.stringify(R.connect.all.firstPeerMs)} first seen ${JSON.stringify(R.connect.all.firstSeenMs)} never connected ${R.connect.all.neverConnected} never saw ${R.connect.all.neverSaw}; real pages first peer ${JSON.stringify(R.connect.real.firstPeerMs)} seen ${JSON.stringify(R.connect.real.firstSeenMs)}`);
  L(`  end state: last room change at ${R.end.lastRoomChangeSOfRun} s (last player started at ${R.end.lastPlayerStartedAtS} s, run ${R.durationS} s); ${R.end.active} players, shown ${JSON.stringify(R.end.shown)} (expected ${expect}), below expected ${R.end.belowExpected}, linked ${JSON.stringify(R.end.linked)}; rooms ${R.end.rooms.distinctRooms} sizes ${R.end.rooms.sizes.join(',')}; home shards ${R.end.homes.distinct} sizes ${R.end.homes.sizes.join(',')}`);
  L(`  cap: max linked ${maxLinked}, max shown ${maxShown}, max members in a room ${maxRoomMembers} (limit ${cap}); seconds any player linked > ${MAXP}: ${R.cap.secondsWithAnyPlayerOverLinkCap} (longest streak ${R.cap.longestStreakS}), room over ${cap}: ${R.cap.secondsWithRoomOverLimit}, shown over cap: ${R.cap.secondsWithAnyShownOverCap}; longest gap between samples ${R.cap.longestSampleGapS} s`);
  L(`  alone: seconds with nobody in view since own start (per player) ${JSON.stringify(R.alone.secondsAloneSinceOwnStart)}, players alone over 10 s in all: ${R.alone.playersAloneOver10s}; players that lost everybody after seeing someone ${R.alone.playersEverAloneAfterSeeing}, longest ${R.alone.longestS} s, total ${R.alone.totalS} s; ending alone ${R.alone.endingAlone}`);
  L(`  churn per player per minute (steady ${R.churn.windowS} s): ${JSON.stringify(R.churn.perPlayerPerMin)}  drops: ${JSON.stringify(R.churn.droppedWhy)}`);
  L(`  messages (steady ${R.messages.windowS} s): sent ${tx} received ${rx} (${R.messages.lostOrInFlightPct} % not counted as received, includes in flight and sent to peers that just left), dup ${R.messages.rxDup} bad ${R.messages.rxBad} rate-limited ${R.messages.rxDropped}; per player ${R.messages.txPerPlayerPerS} out / ${R.messages.rxPerPlayerPerS} in msgs/s, ${R.messages.txBytesPerPlayerPerS} B/s payload out`);
  if (R.update) L(`  update delay between bots (ms): one-way ${JSON.stringify(R.update.oneWayMs)} p99 ${R.update.oneWayP99}; gap between updates ${JSON.stringify(R.update.gapMs)} p99 ${R.update.gapP99}, over 250 ms ${R.update.gapOver250ms}, over 1 s ${R.update.gapOver1000ms} (of ${R.update.statesReceived} states, ${R.update.pairs} pairs); gaps between players under 150 m apart (sent at 10 Hz by design): ${JSON.stringify(R.update.nearGapMs)} p99 ${R.update.nearGapP99}, over 250 ms ${R.update.nearGapOver250ms}, over 1 s ${R.update.nearGapOver1000ms}`);
  if (R.relay) { L(`  relays (steady ${R.relay.windowS} s, 5 local relays): total ${R.relay.totalFramesPerS} frames/s ${R.relay.totalKBperS} KB/s, ${R.relay.framesPerPlayerPerS} frames/s per player; busiest relay ${R.relay.busiestRelayFramesPerS} frames/s = ${R.relay.estimateBusiestRelayFramesPerHour} per hour, ${R.relay.estimateBusiestRelayMBPerHour} MB/h; whole run avg ${R.relay.wholeRun.framesPerS}/s, peak second in ${R.relay.wholeRun.peakPerSecondIn} out ${R.relay.wholeRun.peakPerSecondOut}, first minute ${R.relay.wholeRun.firstMinuteFrames} frames`); R.relay.perRelay.forEach(r => L(`    relay ${r.relay} (${r.carries}): in ${r.inPerS}/s out ${r.outPerS}/s, ${r.inKBperS}+${r.outKBperS} KB/s, presence events in ${r.presenceEventsInPerS}/s out ${r.presenceEventsOutPerS}/s, REQ ${r.reqPerS}/s EVENT ${r.eventPerS}/s, conns ${r.conns}`)); }
  L(`  bots main thread (steady): task ${JSON.stringify(R.botMainThread.taskMsPerS)} ms/s, script ${JSON.stringify(R.botMainThread.scriptMsPerS)} ms/s, JS heap ${JSON.stringify(R.botMainThread.jsHeapMB)} MB; bot bandwidth up ${JSON.stringify(R.botBandwidth.upKBs)} down ${JSON.stringify(R.botBandwidth.downKBs)} KB/s (data channels), connections ${JSON.stringify(R.botBandwidth.connections)}`);
  R.realClients.forEach(r => L(`  real ${r.name}: frame ${JSON.stringify(r.frameMs)} task ${r.taskMsPerS} script ${r.scriptMsPerS} ms/s heap ${r.jsHeapMB} MB, wire ${JSON.stringify(r.wire)}, shown ${r.shown} linked ${r.linked}`));
  L(`  harness steps (ms): ${JSON.stringify(stepLog)}`);
  L(`  memory: chrome ${JSON.stringify(R.memory)}; free at end ${R.memFreeAtEnd} %`);
  L(`  network: ws hosts ${JSON.stringify(net.ws)} http hosts ${JSON.stringify(net.http)} refused lookups ${JSON.stringify(net.refused)} => ${R.network.onlyLocal ? 'LOCAL ONLY' : 'CHECK'}`);
  L(`  errors: ${JSON.stringify(R.errors)}`);
  L(`  whole run room events (all players): ${JSON.stringify(R.churn.wholeRunTotals)}`);
  if (R.processCpu) L(`  browser CPU (steady ${R.processCpu.windowS} s): ${JSON.stringify(R.processCpu)}`);
  if (R.soloBots && R.soloBots.length) L(`  solo bot pages (netcode alone on a main thread): ${JSON.stringify(R.soloBots)}`);
  L(`  timeline [s, active, seeing someone, max linked, rooms]: ${JSON.stringify(R.timeline)}`);
  console.log(out.join('\n'));
  const app = arg('append', '');
  if (app) fs.appendFileSync(path.resolve(app), `\n=== stress.mjs ${process.argv.slice(2).join(' ')}\n` + out.join('\n') + '\n');
  const jf = arg('json', ''); if (jf) fs.writeFileSync(path.resolve(jf), JSON.stringify({ R, events: pl.P.filter(p => p.started).map(p => ({ i: p.i, real: p.real, start: p.startT - T0, ev: p.events.filter(e => ['join', 'leave', 'decoy', 'overfull', 'overcap', 'unheld', 'drop'].includes(e.ev)).map(e => [e.T - T0, e.ev, e.room || e.peer || '', e.peers, e.why || e.linked || '']) })), ticks: ticks.map(t => ({ T: t.T - T0, s: t.s.map(s => s && { shown: s.shown, linked: s.linked, held: s.held, rooms: s.rooms, home: s.home, online: s.online }) })) }));
  // ---------- tidy ----------
  clearTimeout(dog); await within(h.browser.close(), 20000).catch(() => {}); try { h.browser.process().kill('SIGKILL'); } catch (e) { /* gone */ } h.server.close(); proxy.server.close(); botSrv.server.close(); relays && relays.close();
  fs.rmSync(botDir, { recursive: true, force: true });
  process.exit(0);
}
main().catch(e => { console.error('stress failed:', e); process.exit(1); });
