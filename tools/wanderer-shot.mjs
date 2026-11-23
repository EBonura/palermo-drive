// Pictures of the Sicilian Wanderer cameo (src/wanderer.js) on the running game, muted: node tools/wanderer-shot.mjs outdir [tweed]
//   serves the repo itself (tools/build/serve.mjs) and needs PD_CHROME (tools/release/withbrowser.sh sets it). Takes: face (close, from the front), full (whole figure, front), side (a side view), street (from the lapa's side).
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', tweed = process.argv[3] === 'tweed', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.goto(base + '?debug&play&p2p=off&help=0&clean&time=11' + (tweed ? '&wanderer=tweed' : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForFunction(() => window.game?.car && window.__missions?.wanderer, { timeout: 120000 });
const info = await p.evaluate(async () => {
  const g = window.game, w = window.__missions.wanderer; g.placeAt(w.x + 30, w.z + 30); g.world?.teleport?.(w.x, w.z, () => {});
  await new Promise(r => setTimeout(r, 6000)); g.placeAt(w.x + 30, w.z + 30);
  return { x: w.x, z: w.z, id: w.id() };
});
console.log('wanderer at', info);
await wait(8000);
const view = async (name, dist, h, look, az) => {   // az: degrees round him from the direction he faces (0 = in front of him)
  await p.evaluate((dist, h, look, az) => {
    const g = window.game, w = window.__missions.wanderer, gy = g.groundY(w.x, w.z), c = window.__missions.wanderer, ang = (window.__az0 ?? 0) + az * Math.PI / 180;
    g.filmCam = (cam) => { cam.position.set(w.x + Math.sin(ang) * dist, gy + h, w.z + Math.cos(ang) * dist); cam.lookAt(w.x, gy + look, w.z); cam.fov = 28; cam.updateProjectionMatrix(); };
  }, dist, h, look, az); await wait(2500); await p.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name);
};
const az0 = await p.evaluate(() => { const w = window.__missions.wanderer; return 0; });
await p.evaluate(() => { const w = window.__missions.wanderer; const m = window.game.pedestrians; window.__az0 = Math.atan2(w.lx - w.x, w.lz - w.z); });
await view('face', 1.9, 1.3, 1.25, 0); await view('full', 4.2, 1.2, 0.85, 0); await view('side', 3.5, 1.2, 0.85, 90); await view('back', 3.5, 1.2, 0.85, 180);
await b.close(); srv.server.close(); process.exit(0);
