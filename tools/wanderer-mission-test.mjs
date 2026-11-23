// Drives the Sicilian Wanderer mission (src/job-wanderer.js) on the running game, muted, and takes pictures of each stage: node tools/wanderer-mission-test.mjs outdir
//   needs PD_CHROME (tools/release/withbrowser.sh sets it). The car is put by hand near each stage (placeAt) so the run takes seconds; the logic under test is the job's own.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto(base + '?debug&play&p2p=off&help=0&time=11&call=wanderer', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForFunction(() => window.game?.car && window.__missions?.wanderer && window.__missions.X.kinds.wanderer, { timeout: 120000 });
const shot = async n => { await p.screenshot({ path: path.join(out, n + '.png') }); console.log('shot', n); };
const phase = () => p.evaluate(() => { const r = window.__missions.X.kinds.wanderer.state(); return r ? r.phase + '/' + r.leg : 'none'; });
const put = (x, z, exact) => p.evaluate((x, z, exact) => { const g = window.game; g.placeAt(x, z); if (exact) { g.car.x = x; g.car.z = z; } g.car.vx = 0; g.car.vz = 0; }, x, z, exact);
const W = await p.evaluate(() => { const w = window.__missions.wanderer; return { x: w.x, z: w.z }; });
await put(W.x + 60, W.z + 60); await wait(7000);
// the call: the lapa has to be moving for the director to ring
let ringing = false;
for (let i = 0; i < 150 && !ringing; i++) { await p.evaluate(() => { const c = window.game.car; c.vx = 4; }); await wait(400); ringing = await p.evaluate(() => !!document.querySelector('#pd-call.on')); }
console.log('card ringing', ringing); if (!ringing) { await shot('m0-nocard'); await b.close(); srv.server.close(); process.exit(1); }
await wait(1200); await shot('m1-card');
await p.evaluate(() => document.querySelector('#pd-call').click()); await wait(1500); console.log('phase', await phase()); await shot('m2-goto');
await put(W.x + 5, W.z + 3); await wait(2500);
for (let i = 0; i < 40 && !(await phase()).startsWith('ride'); i++) await wait(500);
console.log('phase', await phase()); await shot('m3-board'); await wait(2500); await shot('m3-ride');
// a bump: a wall scrape for a moment
await p.evaluate(() => { window.game.car.scrape = 12; }); await wait(300); await p.evaluate(() => { window.game.car.scrape = 0; }); await wait(1200); await shot('m3-bump');
const pts = await p.evaluate(() => window.__missions.X.kinds.wanderer.points());
await put(pts.dest.x, pts.dest.z, true); await wait(2500);
console.log('diag', JSON.stringify(await p.evaluate(() => { const c = window.game.car, X = window.__missions.X, d = X.kinds.wanderer.points().dest; return { car: [c.x, c.z], dest: [d.x, d.z], dist: Math.hypot(c.x - d.x, c.z - d.z), v: Math.hypot(c.vx, c.vz), R: X.destBeacon.R }; })));
for (let i = 0; i < 20 && !(await phase()).startsWith('out'); i++) { await put(pts.dest.x, pts.dest.z, true); await wait(500); }
console.log('phase', await phase()); await wait(2800); await shot('m4-out-a'); await wait(3500); await shot('m4-out-b'); await wait(4500); await shot('m4-out-c');
for (let i = 0; i < 40 && !(await phase()).startsWith('ride/2'); i++) await wait(500);
console.log('phase', await phase()); await wait(1500); await shot('m5-back');
await put(pts.home.x, pts.home.z, true); await wait(2500);
for (let i = 0; i < 20 && !(await phase()).startsWith('drop'); i++) { await put(pts.home.x, pts.home.z, true); await wait(500); }
console.log('phase', await phase()); await wait(1500); await shot('m6-end'); await wait(7000); console.log('phase after', await phase());
await shot('m7-after');
await b.close(); srv.server.close(); process.exit(0);
