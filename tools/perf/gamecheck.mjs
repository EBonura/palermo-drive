// Did a performance change break the game? Scripted, on a built site, printing what happened so that two builds can be compared:
//   tools/release/withbrowser.sh node tools/perf/gamecheck.mjs --root <dist> [--only fare,pub,dump,people,cars,props]
// Missions: starts ?event=<id>&auto, then at every step puts the lapa at the end of the line the guide shows and stops, and lists the phases it went through. Collisions: the lapa is launched at someone, at a vehicle, along a street of parked cars.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
const ONLY = arg('only') ? arg('only').split(',') : null, want = n => !ONLY || ONLY.includes(n), wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
async function open(q) {
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 160))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&debug&p2p=off&${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.game && window.__missions && window.__peds && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  return { page, errs };
}
async function mission(tag, q, id, maxSteps = 14) {
  const { page, errs } = await open(`event=${id}&auto&${q}`);
  await page.waitForFunction(() => window.__missions.S.ev, { timeout: 90000, polling: 250 }).catch(() => errs.push('never started'));
  const phases = []; let last = null, ended = false;
  for (let k = 0; k < maxSteps && !ended; k++) {
    const st = await page.evaluate(async () => {
      const M = window.__missions, X = M.X, S = M.S, c = window.game.car;
      if (!S.ev) return { ended: true, earned: X.earned() };
      const r = X.guide.route();
      if (r && r.length >= 2) { const x = r[r.length - 2], z = r[r.length - 1], th = Math.atan2(x - r[r.length - 4], z - r[r.length - 3]) || 0; await new Promise(res => { const t = setTimeout(res, 8000); window.game.world.teleport(x, z, () => { clearTimeout(t); res(); }); }); X.vehicle.teleport(x, z, th); c.vx = c.vz = 0; }
      return { phase: S.phase, route: r ? r.length / 2 : 0, earned: X.earned() };
    });
    if (st.ended) { ended = true; phases.push('ended, earned ' + st.earned); break; }
    if (st.phase !== last) { phases.push(st.phase + (st.route ? '' : ' (no line)')); last = st.phase; }
    await wait(5000);
  }
  console.log(tag.padEnd(8), phases.join(' > '), ended ? '' : '(still running after the steps)', errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await page.close();
}
async function collide(tag, q, fn) {
  const { page, errs } = await open(q);
  await wait(9000);
  const r = await page.evaluate(fn);
  console.log(tag.padEnd(8), JSON.stringify(r), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await page.close();
}
if (want('fare')) await mission('fare', 'time=13', 'fare:qc');
if (want('pub')) await mission('pub', 'time=21', 'pub:krust');
if (want('dump')) await mission('dump', 'time=13', 'dump:bellolampo', 18);
// someone walking ahead: launched straight at them, many times over
if (want('people')) await collide('people', 'time=13&at=17.5,0,0', async () => {
  const G = window.game, P = window.__peds, X = window.__missions.X, c = G.car; let knocked = 0, tries = 0, jump = 0;
  P.api.onKnock(() => { knocked++; });
  for (let k = 0; k < 12; k++) {
    let best = -1; for (let i = 0; i < P.N.n; i++) if (P.ST[i] <= 1) { const d = Math.hypot(P.X[i] - c.x, P.Z[i] - c.z); if (d > 8 && d < 45 && (best < 0 || d < Math.hypot(P.X[best] - c.x, P.Z[best] - c.z))) best = i; }
    if (best < 0) break;
    const x = P.X[best], z = P.Z[best], a = Math.random() * 6.28, sx = x - Math.sin(a) * 7, sz = z - Math.cos(a) * 7;
    X.vehicle.teleport(sx, sz, a); c.vx = Math.sin(a) * 14; c.vz = Math.cos(a) * 14; c.vf = 14; tries++;
    await new Promise(r => setTimeout(r, 900));
  }
  return { tries, knocked };
});
// a moving vehicle: its speed or the lapa's has to change
if (want('cars')) await collide('cars', 'time=13&at=-2743,-1678,0', async () => {
  const G = window.game, A = G.traffic.agents, X = window.__missions.X, c = G.car; let tries = 0, hit = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let k = 0; k < 24; k++) {
    const list = A(); if (!list.length) { await sleep(2000); continue; }
    const o = list[Math.floor(Math.random() * list.length)], ox = o.x, oz = o.z, a = Math.random() * 6.28;
    X.vehicle.teleport(ox - Math.sin(a) * 3.5, oz - Math.cos(a) * 3.5, a); c.vx = Math.sin(a) * 18; c.vz = Math.cos(a) * 18; c.vf = 18; tries++;
    let low = 18; for (let q = 0; q < 12; q++) { await sleep(40); low = Math.min(low, Math.hypot(c.vx, c.vz)); }
    if (low < 14) hit++;
    await sleep(500);
  }
  return { tries, hit };
});
// the props: full throttle down Via Maqueda, what got yeeted or bent
if (want('props')) await collide('props', 'time=13&at=133,229,-2.6', async () => {
  const G = window.game, s0 = { ...G.props.stats }; G.keys.ArrowUp = true;
  await new Promise(r => setTimeout(r, 12000)); G.keys.ArrowUp = false;
  const s1 = G.props.stats, d = {}; for (const k in s1) if (typeof s1[k] === 'number' && s1[k] !== s0[k]) d[k] = s1[k] - s0[k];
  return { changed: d, x: Math.round(G.car.x), z: Math.round(G.car.z), v: +Math.hypot(G.car.vx, G.car.vz).toFixed(1) };
});
await browser.close(); server.close();
