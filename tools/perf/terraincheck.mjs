// Is the terrain the pool builds the terrain the main thread builds? The game is loaded with ?terrcheck, which makes every tile's terrain the pool's way (src/terrain-task.js: the vertices, and the paving and road fields)
// and the main thread's way (src/world.js terrainMesh with paveFieldIter and roadFieldIter), and compares them bit for bit: the seven attribute arrays, the fields, and the ground lattice against each vertex asking for its
// own ground and its neighbours'. window.__terrCheck keeps the counts and the tiles that differ.
// A page per start spot, each left until no new tile has been compared for a while.
//   tools/release/withbrowser.sh node tools/perf/terraincheck.mjs --root <dist> [--spots qc,regione,...] [--q 'extra=query']
// Exit code 1 when a tile differs or none was compared.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), SPOTS = String(arg('spots', '1,2,3,4,5,6,7')).split(','), QUERY = arg('q', '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const { server, port } = await startServer(ROOT, ROOT);
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let tiles = 0, vertices = 0, bad = [];
for (const spot of SPOTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('  page error:', e.message.slice(0, 200)));
  await page.goto(`http://127.0.0.1:${port}/?help=0&terrcheck&spot=${spot}${QUERY ? '&' + QUERY : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let last = -1, still = 0;
  for (let t0 = Date.now(); Date.now() - t0 < 240000 && still < 12;) {
    await wait(1000);
    const c = await page.evaluate(() => window.__terrCheck ? window.__terrCheck.tiles : 0).catch(() => 0);
    if (c > 0 && c === last) still++; else { still = 0; last = c; }
  }
  const r = await page.evaluate(() => window.__terrCheck || { tiles: 0, vertices: 0, bad: [] });
  console.log(`spot ${spot}: ${r.tiles} tiles, ${r.vertices} vertices (lattice against direct calls), ${r.pool ? r.pool.tiles : 0} tiles' arrays and ${r.fields ? r.fields.tiles : 0} tiles' fields against the pool's, ${r.bad.length + (r.pool ? r.pool.bad.length : 0)} differ`);
  for (const b of r.bad.concat(r.pool ? r.pool.bad : []).slice(0, 10)) console.log('   ' + b);
  tiles += r.pool ? r.pool.tiles : 0; vertices += r.vertices; bad = bad.concat(r.bad, r.pool ? r.pool.bad : []);
  await page.close();
}
await browser.close(); server.close();
console.log(!tiles ? 'FAIL: no tile was compared' : bad.length ? `FAIL: ${bad.length} tile(s) differ` : `PASS: ${tiles} tiles, ${vertices} vertices, every array bit for bit the loop's`);
process.exit(!tiles || bad.length ? 1 : 0);
