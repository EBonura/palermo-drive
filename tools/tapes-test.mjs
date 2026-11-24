// Tests the cassette tapes (src/tapes.js, src/tapes-data.js, radio.playTape, the Collezioni list) on the running game, muted and headless:
//   PD_CHROME=<headless chrome> node tools/tapes-test.mjs outdir [folder with the 31 encoded files]
//   1. the baked road points (no two under 40 m, tools/tapes-bake.mjs --check), the radio switches (a tape with the radio off, play from the list, stations, a saved 'sessanta')
//   2. a real drive: the lapa starts about 80 m before a tape and the accelerator is held (key events) in the centre and at Mondello: pickup, toast, and the audio element really advancing
//   3. Collezioni without ?fakeprogress after those two tapes, and a tap on a found row
//   4. the toast with the longest title (31/31) at 667x375 and 844x390
//   5. pictures from the chase camera 20, 50 and 100 m before a tape (Mondello and Porta Felice), by day and by night; Collezioni on a 768x1024 window (a real tablet upright gets the turn-sideways gate)
// The files are served by a small local server with CORS (the game is pointed at it with ?musicbase=). Nothing is uploaded. The browser is muted.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import os from 'os'; import { execFileSync } from 'child_process';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', dir = process.argv[3] || path.join(os.homedir(), '.cache/palermo-drive/radio/cassette'), wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const music = http.createServer((q, r) => { const f = path.join(dir, path.basename(decodeURIComponent(q.url.split('?')[0]))); if (!fs.existsSync(f)) { r.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); return r.end(); }
  const st = fs.statSync(f), h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' }, m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) { const a = +m[1] || 0, b = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(r); }
  else { r.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(f).pipe(r); } });
await new Promise(r => music.listen(0, '127.0.0.1', r)); const mbase = `http://127.0.0.1:${music.address().port}/`;
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'pdtapes-'));
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', protocolTimeout: 600000, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--user-data-dir=' + udd] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errs = [], seen404 = new Set();
p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message.slice(0, 300)); });
p.on('response', r => { if (r.status() === 404 && /sessanta-/.test(r.url())) { const u = r.url(); if (!seen404.has(u)) { seen404.add(u); console.log('404', u.slice(0, 160)); } } });
p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
await p.evaluateOnNewDocument(() => { window.__aud = []; const pl = Audio.prototype.play; Audio.prototype.play = function () { if (!window.__aud.includes(this)) window.__aud.push(this); return pl.apply(this, arguments); }; });   // the radio's <audio> elements are not in the DOM: keep them
const url = (time = 11, extra = '') => base + `?debug&play&p2p=off&help=0&cloud=off&lang=en&time=${time}${extra}&musicbase=` + encodeURIComponent(mbase);
const load = async (time, extra) => { await p.goto(url(time, extra), { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForFunction(() => window.game?.car && window.game.tapes, { timeout: 120000 }); await wait(2500); };
const tele = (x, z) => p.evaluate((x, z) => new Promise(res => { const g = window.game; g.world.teleport(x, z, () => { g.placeAt(x, z); res(); }); setTimeout(res, 20000); }), x, z);
const where = id => p.evaluate(id => window.game.tapes.where(id), id);
const view = () => p.evaluate(() => ({ ...window.__pdRadio.view, enabled: window.__pdRadio.enabled, saved: JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}').radio, found: window.game.tapes.progress().found }));
let fail = 0; const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) fail++; };
const TAPE_KEY = 'palermoDrive.tapes.v1';
// a start about d metres before the tape along the road (walking back along the graph, keeping straight), facing it; the lapa is put there exactly
const startBefore = async (id, d) => {
  const w = await where(id); await tele(w.x + 30, w.z + 30); await wait(1500);   // (not onto it: that would collect it)
  for (let i = 0; i < 20 && (await p.evaluate(({ x, z }) => window.game.traffic.debug.G.nearestNode(x, z, 15, true), w)) < 0; i++) await wait(1000);   // the tile's roads are in the graph a moment after the ground
  const s = await p.evaluate(({ x, z, d }) => {
    const G = window.game.traffic.debug.G; let cur = G.nearestNode(x, z, 15, true), len = 0, dir = null, th = 0;
    while (cur >= 0 && len < d) {
      const ins = G.NIN[cur].filter(e => !e.ped && !e.dead); if (!ins.length) break;
      const e = dir ? ins.reduce((a, c) => (c.dx * dir[0] + c.dz * dir[1] > a.dx * dir[0] + a.dz * dir[1] ? c : a)) : ins[0];
      dir = [e.dx, e.dz]; th = Math.atan2(e.dx, e.dz); len += e.len; cur = e.a;
    }
    return { x: G.NX[cur], z: G.NZ[cur], th, len: Math.round(len) };
  }, { x: w.x, z: w.z, d });
  await tele(s.x, s.z); await p.evaluate(({ x, z, th }) => { const g = window.game; g.placeAt(x, z, th); g.car.vx = g.car.vz = 0; }, s);
  return { ...s, dist: Math.round(Math.hypot(s.x - w.x, s.z - w.z)) };
};

await load();
const ids = await p.evaluate(() => window.game.tapes.list().map(t => t.id));
check('31 tapes in the list', ids.length === 31, ids.length);

// 1. the baked points
const pts = []; for (const id of ids) pts.push({ id, ...(await where(id)) });
check('every tape has its baked road point', pts.every(r => typeof r.x === 'number' && typeof r.z === 'number'));
let near = Infinity; for (const a of pts) for (const c of pts) if (a !== c) near = Math.min(near, Math.hypot(a.x - c.x, a.z - c.z));
check('no two tapes under 40 m', near >= 40, 'closest ' + near.toFixed(1));
try { console.log(execFileSync('node', [new URL('./tapes-bake.mjs', import.meta.url).pathname, '--check']).toString().trim().split('\n').pop()); check('tapes-bake --check', true); } catch (e) { check('tapes-bake --check', false); }

// radio switches, with the tapes put on by teleport
await p.evaluate(() => localStorage.removeItem('palermoDrive.tapes.v1'));
await p.evaluate(() => dispatchEvent(new Event('pd-gesture'))); await p.evaluate(() => window.__pdRadio.setEnabled(true));
const collectAt = async id => { const w = await where(id); await tele(w.x, w.z); await p.evaluate((x, z) => { const c = window.game.car; c.x = x; c.z = z; c.vx = 0; c.vz = 0; }, w.x, w.z); for (let i = 0; i < 20 && !(await p.evaluate(id => window.game.tapes.has(id), id)); i++) await wait(300); };
await p.evaluate(() => { window.__pdRadio.setEnabled(false); }); await wait(800);
await collectAt('sessanta-bandita'); await wait(1500); let v = await view();
check('radio off: on for the tape alone', v.enabled && /^(Cassetta|Tape)$/.test(v.label) && v.saved === 'off', JSON.stringify({ enabled: v.enabled, saved: v.saved, label: v.label, title: v.title }));
await p.evaluate(() => window.__pdRadio.next()); await wait(2500); v = await view();
check('radio off again after skipping the tape', !v.enabled && v.saved === 'off' && v.mode === 'off', JSON.stringify({ enabled: v.enabled, saved: v.saved, mode: v.mode }));
await p.evaluate(() => window.__pdRadio.setEnabled(true)); await wait(500);
const pl = await p.evaluate(() => [window.game.tapes.play('sessanta-bandita'), window.game.tapes.play('sessanta-628')]); await wait(1500); v = await view();
check('play(found) true, play(not found) false', pl[0] === true && pl[1] === false);
check('list play shows the tape', /Bandita/.test(v.title) && /^(Cassetta|Tape)$/.test(v.label), v.title + ' / ' + v.label);
await load();
check('still collected after a reload', await p.evaluate(() => window.game.tapes.has('sessanta-bandita') && window.game.tapes.progress().found === 1));
const st = await p.evaluate(async () => { const { STATIONS } = await import('/src/radio.js'); return STATIONS.map(s => s.id); }); check('three stations', st.length === 3 && !st.includes('sessanta'), st.join(','));
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}'); s.radioStation = 'sessanta'; localStorage.setItem('palermoDrive.settings.v1', JSON.stringify(s)); });
const e0 = errs.length; await load(); await p.evaluate(() => dispatchEvent(new Event('pd-gesture'))); await wait(2500);
check('saved sessanta starts on the first station', (await p.evaluate(() => window.__pdRadio.station)) === 'abbanniata' && errs.length === e0);

// 2. a real drive through two tapes
await p.evaluate(() => { localStorage.removeItem('palermoDrive.tapes.v1'); const s = JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}'); delete s.radioStation; s.radio = 'on'; localStorage.setItem('palermoDrive.settings.v1', JSON.stringify(s)); });
await load();
await p.evaluate(() => dispatchEvent(new Event('pd-gesture'))); await p.evaluate(() => window.__pdRadio.setEnabled(true));
const driven = [];
for (const id of ['sessanta-cu-t-addifenni-palermo', 'sessanta-mose-a-mondello']) {
  const s = await startBefore(id, 80); console.log('start', id, JSON.stringify(s)); await wait(1500);
  await p.keyboard.down('KeyW'); let got = false, t0 = Date.now(), minD = 1e9;
  while (Date.now() - t0 < 60000 && !got) {
    await wait(250); const r = await p.evaluate(id => ({ has: window.game.tapes.has(id), d: Math.hypot(window.game.car.x - window.game.tapes.where(id).x, window.game.car.z - window.game.tapes.where(id).z) }), id); minD = Math.min(minD, r.d); got = r.has;
    if (got) await p.keyboard.up('KeyW');
  }
  await p.keyboard.up('KeyW');
  check('driven pickup ' + id, got, got ? 'after ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' : 'closest ' + minD.toFixed(1) + ' m');
  if (!got) continue;
  await wait(700);
  const toast = await p.evaluate(() => { const e = document.querySelector('.pd-tape-toast'); return e ? { on: e.classList.contains('on'), text: e.textContent, shown: getComputedStyle(e).display !== 'none' } : null; }); console.log('toast', JSON.stringify(toast));
  check('toast shown ' + id, toast && toast.on && /Cassetta/.test(toast.text) && /\/31/.test(toast.text), toast && toast.text);
  const tt = await p.evaluate(id => window.game.tapes.list().find(t => t.id === id).title, id), vw = await view();
  check('bar shows the tape ' + id, vw.title === tt && /^(Cassetta|Tape)$/.test(vw.label), JSON.stringify({ title: vw.title, label: vw.label }));
  const au = () => p.evaluate(id => (window.__aud || []).filter(a => a.src.includes(id)).map(a => ({ t: +a.currentTime.toFixed(2), d: +(a.duration || 0).toFixed(1), paused: a.paused, err: a.error && a.error.code, muted: a.muted })), id);
  const a1 = await au(); await wait(2000); const a2 = await au();
  console.log('audio', JSON.stringify(a1), '->', JSON.stringify(a2));
  check('audio advancing ' + id, a2.length > 0 && a2.some((x, i) => !x.paused && !x.err && x.t > (a1[i]?.t ?? 0) + 1));
  driven.push(id);
}
const found2 = await p.evaluate(() => window.game.tapes.list().filter(t => t.found).map(t => t.id)); console.log('found after the drives', found2.join(' '));

// 3. Collezioni without ?fakeprogress
await load(11, '&ui=collections'); await wait(2500);
const col = await p.evaluate(() => { const s = document.querySelector('.pd-s-collections'); return { text: s ? s.textContent.replace(/\s+/g, ' ') : null, found: [...document.querySelectorAll('.pd-tape.on')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), unfound: [...document.querySelectorAll('.pd-tape:not(.on)')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) }; });
console.log('rows found', JSON.stringify(col.found)); console.log('rows unfound (first 5)', JSON.stringify(col.unfound.slice(0, 5)), 'count', col.unfound.length);
check('count reads n / 31', new RegExp(found2.length + ' ?/ ?31').test(col.text || ''), (col.text.match(/\d+ ?\/ ?31/) || [''])[0]);
check('found rows show title and place', col.found.length === found2.length && col.found.some(t => /Teatro Massimo/.test(t)) && col.found.some(t => /Mondello/.test(t)));
check('unfound rows show ??? and the quartiere', col.unfound.length === 31 - found2.length && col.unfound.every(t => /^\?\?\?/.test(t) && t.length > 4));
await p.screenshot({ path: path.join(out, 'collezioni-real.png') });
await p.evaluate(() => dispatchEvent(new Event('pd-gesture')));
await p.click('.pd-tape.on .pd-tapeb'); await wait(2500);
const run = await p.evaluate(() => ({ marked: [...document.querySelectorAll('.pd-tape.run')].map(e => e.dataset.title), view: { ...window.__pdRadio.view } }));
check('tapping a found row plays it, the row is marked, the radio label is real', run.marked.length === 1 && run.marked[0] === run.view.title && /^(Cassetta|Tape)$/.test(run.view.label), JSON.stringify({ marked: run.marked, title: run.view.title, label: run.view.label }));
await p.screenshot({ path: path.join(out, 'collezioni-playing.png') });

// 4. the longest toast (31/31) on two phone sizes
const longest = 'sessanta-la-minchiata-di-caracciolo';
await p.evaluate(({ ids, longest }) => localStorage.setItem('palermoDrive.tapes.v1', JSON.stringify(ids.filter(i => i !== longest))), { ids, longest });
for (const [w, h] of [[667, 375], [844, 390]]) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.evaluate(({ ids, longest }) => localStorage.setItem('palermoDrive.tapes.v1', JSON.stringify(ids.filter(i => i !== longest))), { ids, longest });
  await load(); await p.evaluate(() => dispatchEvent(new Event('pd-gesture')));
  await collectAt(longest); await wait(800);
  const r = await p.evaluate(() => { const e = document.querySelector('.pd-tape-toast'), b = e.getBoundingClientRect(), hud = [...document.querySelectorAll('#hud > *, #hud .hz-pick ~ *')].filter(x => x !== e && x.offsetParent && x.getBoundingClientRect().width > 0 && !x.contains(e) && !e.contains(x)).map(x => x.getBoundingClientRect()); return { text: e.textContent, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight, cut: e.scrollWidth > e.clientWidth + 1, over: hud.filter(q => q.width < innerWidth * .9 && q.left < b.right && q.right > b.left && q.top < b.bottom && q.bottom > b.top).length }; });
  console.log('toast', w + 'x' + h, JSON.stringify(r));
  check('toast fits ' + w + 'x' + h, r.text.includes('31/31') && r.x >= 0 && r.x + r.w <= r.vw && r.y >= 0 && r.y + r.h <= r.vh && !r.cut, JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h, overlapping: r.over }));
  await p.screenshot({ path: path.join(out, `toast-${w}x${h}.png`) });
}

// 5. a 768x1024 window with a mouse (a real tablet is a touch device and gets the turn-sideways gate)
await p.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
await p.evaluate(() => localStorage.setItem('palermoDrive.tapes.v1', JSON.stringify(['sessanta-bandita', 'sessanta-mose-a-mondello'])));
await load(11, '&ui=collections'); await wait(2500);
console.log('gate shown on the plain 768x1024 window:', await p.evaluate(() => !!document.querySelector('.rot') && getComputedStyle(document.querySelector('.rot')).display !== 'none'));
await p.screenshot({ path: path.join(out, 'collezioni-768x1024-top.png') });
console.log('scroll', JSON.stringify(await p.evaluate(() => { const c = document.querySelector('.pd-colrows'), r = c.getBoundingClientRect(), card = document.querySelector('.pd-s-collections .pd-card').getBoundingClientRect(); c.scrollTop = 1e6; return { rowsH: Math.round(r.height), scrollH: c.scrollHeight, cardBottom: Math.round(card.bottom), vh: innerHeight }; }))); await wait(400);
await p.screenshot({ path: path.join(out, 'collezioni-768x1024-bottom.png') });

// 6. the chase camera, 20, 50 and 100 m before a tape, day and night
await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
for (const [time, tag] of [[11, 'day'], [22, 'night']]) {
  await p.evaluate(() => localStorage.removeItem('palermoDrive.tapes.v1')); await load(time);
  for (const [id, nm] of [['sessanta-mose-a-mondello', 'mondello'], ['sessanta-porta-felice', 'portafelice']]) for (const d of [100, 50, 20]) {
    const s = await startBefore(id, d); await wait(3500);
    const f = await p.evaluate(() => window.game.tapes.progress().found);
    await p.screenshot({ path: path.join(out, `${nm}-${tag}-${d}m.png`) }); console.log('shot', `${nm}-${tag}-${d}m`, JSON.stringify({ walked: s.len, straight: s.dist, found: f }));
  }
}
console.log('console errors:', errs.length, errs.slice(0, 5).join(' | '));
check('no console errors', errs.length === 0);
console.log(fail ? 'FAILED ' + fail : 'ALL PASSED');
await b.close(); srv.server.close(); music.close(); fs.rmSync(udd, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
