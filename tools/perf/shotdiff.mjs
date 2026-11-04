// Same picture? Two builds, the same fixed cameras, no crowd, a seeded Math.random and a frozen clock, and a pixel diff of each pair.
//   tools/release/withbrowser.sh node tools/perf/shotdiff.mjs --a <dist> --b <dist> --out <dir> [--only name,name]
// Prints per shot the pixels that differ by more than 2 and by more than 8 levels out of 255 and the largest difference; writes <name>-a.png, -b.png, -diff.png (differences x 8 on black).
// What moves on its own (traffic, the sea, a light that follows it) can differ: run a build against itself for the noise, and look at the diff picture before believing a number.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const A = path.resolve(arg('a')), B = path.resolve(arg('b')), OUT = path.resolve(arg('out', '.')), ONLY = arg('only') ? arg('only').split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
// time, where the lapa stands (x, z, heading), and the camera and what it looks at as offsets from the ground under the lapa
const SHOTS = {
  ballaro_stalls: { time: 11, at: [25, 489, 0], cam: [4, 9, -32], look: [0, 1, 0] },
  capo_stalls: { time: 11, at: [-450, -250, 0], cam: [-4, 8, 28], look: [4, 1, 0] },
  lapa_mondello: { time: 13, at: [-3033, -10177, -1.07], cam: [-3.5, 1.8, 3], look: [0, 1, 0] },
  lapa_qc: { time: 17, at: [17.5, 0, 0], cam: [3.6, 1.2, 1], look: [0, 1.1, 0] },
  lapa_night: { time: 22, at: [-3033, -10177, -1.07], cam: [-7, 2.5, -3], look: [3, 0.5, 5] },
  qc_street: { time: 13, at: [17.5, 0, 0], cam: [0, 1.8, -14], look: [0, 1.5, 30] },
};
const seed = () => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const openPage = async () => { const page = await browser.newPage(); await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); return page; };
const ready = page => page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
async function groundUnder(root, S) {
  const { server, port } = await startServer(root, ''), page = await openPage();
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&p2p=off&peds=0&at=${S.at.join(',')}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await ready(page); await new Promise(r => setTimeout(r, 4000));
  const y = await page.evaluate((x, z) => window.game.groundY(x, z), S.at[0], S.at[1]);
  await page.close(); server.close(); return y;
}
async function shot(root, q, file) {
  const { server, port } = await startServer(root, ''), page = await openPage();
  await page.evaluateOnNewDocument(seed);
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&p2p=off&peds=0&${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await ready(page);
  await new Promise(r => setTimeout(r, 12000));
  await page.waitForFunction(() => window.game.world.visiblePending() === 0, { timeout: 60000, polling: 250 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  // the 3D canvas alone, drawn right now (no HUD)
  const url = await page.evaluate(() => new Promise(res => { requestAnimationFrame(() => { window.game.renderer.render(window.game.scene, window.game.camera); res(document.querySelector('canvas#view, #view canvas, canvas').toDataURL('image/png')); }); }));
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  await page.close(); server.close();
  return url;
}
const cmp = await browser.newPage();
let bad = 0;
for (const [name, S] of Object.entries(SHOTS)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const y = await groundUnder(A, S), off = (o, v) => [S.at[0] + v[0], y + v[1], S.at[1] + v[2]].join(',');
  const q = `time=${S.time}&at=${S.at.join(',')}&campos=${off(0, S.cam)}&look=${off(0, S.look)}`;
  const ua = await shot(A, q, path.join(OUT, name + '-a.png')), ub = await shot(B, q, path.join(OUT, name + '-b.png'));
  const r = await cmp.evaluate(async (ua, ub) => {
    const img = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const [ia, ib] = [await img(ua), await img(ub)], w = ia.width, h = ia.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, w, h); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, w, h), o = g.createImageData(w, h);
    let over2 = 0, over8 = 0, max = 0;
    for (let i = 0; i < da.data.length; i += 4) { const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2])); if (d > 2) over2++; if (d > 8) over8++; if (d > max) max = d; o.data[i] = o.data[i + 1] = o.data[i + 2] = Math.min(255, d * 8); o.data[i + 3] = 255; }
    g.putImageData(o, 0, 0); return { w, h, over2, over8, max, diff: c.toDataURL('image/png') };
  }, ua, ub);
  fs.writeFileSync(path.join(OUT, name + '-diff.png'), Buffer.from(r.diff.split(',')[1], 'base64'));
  console.log(name.padEnd(16), `${r.w}x${r.h}`, 'over 2:', r.over2, 'over 8:', r.over8, 'max', r.max);
  if (r.over8) bad++;
}
await browser.close(); process.exit(bad ? 1 : 0);
