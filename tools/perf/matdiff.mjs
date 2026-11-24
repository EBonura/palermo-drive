// Same picture with two page-load switches? Two pages of ONE build (e.g. ?mats=off against the default), the same views, a pixel diff of each pair.
//   tools/release/withbrowser.sh node tools/perf/matdiff.mjs --root <dist> [--a 'mats=off'] [--b ''] [--spots qc,viaroma] [--times 12,22.5] [--views 6] [--out dir]
// The build must be readable (node tools/build/build.mjs --minify=false --out=<dir>): the page's random numbers are kept apart from three.js's uuids by patching generateUUID, which a minified build renames.
// What it does: each page is loaded with a seeded Math.random, no crowd (?peds=0), no clouds (?clouds=off), settles, then the animation loop is stopped, the moving things
// (traffic, boats, trams) are hidden, and the scene is drawn from the same --views cameras round the spot (a ring of headings, 2.5 m up, looking out; the same cameras in both pages).
// Each view is drawn four times before it is read, so the shadow map's cached slices have settled the same way. The PNGs are compared pixel for pixel here (0 is the bar).
// What it proves: that, with the movers hidden, the two switches draw the same pixels from these cameras at these times. What it cannot: anything about the movers (draw a vehicle
// against another surface at equal depth), or views that no camera here sees. Run --a against --b of the same switch (--a '' --b '') first: that is the noise floor, and must be 0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), A = arg('a', 'mats=off'), B = arg('b', ''), OUT = arg('out', ''), VIEWS = +arg('views', 6);
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
const ll = (lat, lon) => [((lon - LON0) * KX).toFixed(1), (-(lat - LAT0) * KZ).toFixed(1), 0].join(',');
const SPOTS = { qc: '15,5,0', vucciria: '210,-182,0', regione: ll(38.090479, 13.343314), mondello: '-3033.1,-10177.4,-1.07', ballaro: '24.9,488.6,-2.01', viaroma: ll(38.1183, 13.3632), monreale: '-6125,3752,1.25' };
const spots = String(arg('spots', 'qc')).split(','), times = String(arg('times', '12,22.5')).split(',');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
// three.js draws four Math.random numbers for the uuid of every material, geometry, texture and object, so a build that makes one material fewer would shift every later random number of the game
// (the smoke puffs, the crowd, what is scattered): the page's own generator is for the game, and generateUUID is served with the real one (window.__u)
const seed = () => { window.__u = Math.random; let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const uuidApart = js => js.replace(/function generateUUID\(\) \{[\s\S]*?\n\}/, m => m.replaceAll('Math.random()', 'window.__u()'));
const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function shots(q, spot, time) {
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.evaluateOnNewDocument(seed);
  await page.setRequestInterception(true);
  page.on('request', async req => {
    if (!/\/js\/app\.[^/]*\.js$/.test(req.url())) return req.continue();
    const body = uuidApart(await (await fetch(req.url())).text());
    req.respond({ status: 200, contentType: 'text/javascript', body });
  });
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&p2p=off&peds=0&clouds=off&weather=cumulus&time=${time}&at=${SPOTS[spot]}${q ? '&' + q : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.game && window.game.clouds && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await new Promise(r => setTimeout(r, 14000));
  await page.waitForFunction(() => window.game.world.visiblePending() === 0, { timeout: 60000, polling: 250 }).catch(() => {});
  const out = await page.evaluate(async views => {
    const G = window.game, R = G.renderer, S = G.scene, C = G.camera;
    // the same held clock in both pages (every shader, every sway and the coals' pulse read the same instant: it is held while the game still runs a few frames, then the game stops)
    performance.now = () => 123456.789; Date.now = () => 1.7e12;
    await new Promise(r => setTimeout(r, 600));
    window.requestAnimationFrame = () => 0;
    await new Promise(r => setTimeout(r, 200));
    // movers: traffic, boats, trams, the scripted people, and the light beam of the call beacon (it stands where a random call slot is)
    S.traverse(o => { if ((o.name && (/^traffic_/.test(o.name) || /boat|tram|^crowd/i.test(o.name))) || (o.isMesh && o.material.isShaderMaterial && o.geometry.type === 'CylinderGeometry')) o.visible = false; });
    const px = G.car.x, pz = G.car.z, py = G.groundY(px, pz), res = [];
    const poses = [];
    for (let v = 0; v < views; v++) { const a = v / views * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a); poses.push([px - sx * 3, py + 2.5, pz - cz * 3, px + sx * 40, py + 1.5, pz + cz * 40]); }
    // close views of every grill cart within 400 m (the brazier's steel is the one colour that marks it), four sides each (found by the cart's own group, where its pieces stand in both builds); the streets round a far one may not have streamed in, which is the same in both pages
    const carts = new Map(); S.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.material.color && o.material.color.getHexString() === '2a2624' && o.parent) { o.parent.updateWorldMatrix(true, false); const e = o.parent.matrixWorld.elements, k = Math.round(e[12] / 3) + ',' + Math.round(e[14] / 3); if (!carts.has(k) && Math.hypot(e[12] - px, e[14] - pz) < 400) carts.set(k, [e[12], e[14]]); o.parent.children.forEach(c => { if (c.isSprite) c.visible = false; }); } });   // the coals' glow sprite is left out: its opacity comes from a seed drawn at the cart's creation, which differs from page to page
    for (const [cx, cz0] of carts.values()) { const cy = G.groundY(cx, cz0); for (let v = 0; v < 4; v++) { const a = v * Math.PI / 2 + 0.4; poses.push([cx + Math.sin(a) * 3.2, cy + 1.7, cz0 + Math.cos(a) * 3.2, cx, cy + 0.9, cz0]); } }
    for (const [x, y, z, lx, ly, lz] of poses) {
      C.position.set(x, y, z); C.lookAt(lx, ly, lz); C.updateMatrixWorld(true);
      for (let i = 0; i < 4; i++) R.render(S, C);
      res.push(document.querySelector('canvas').toDataURL('image/png'));
    }
    return res;
  }, VIEWS);
  await page.close();
  return out;
}
const cmp = await browser.newPage();
const compare = (ua, ub) => cmp.evaluate(async (ua, ub) => {
  const img = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const [ia, ib] = [await img(ua), await img(ub)], w = ia.width, h = ia.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, w, h); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, w, h);
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < da.data.length; i += 4) { const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2])); if (d) { n++; if (d > max) max = d; const x = (i / 4) % w, y = (i / 4 / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { n, max, box: n ? [x0, y0, x1, y1] : null };
}, ua, ub);
let total = 0, views = 0;
for (const spot of spots) for (const time of times) {
  const sa = await shots(A, spot, time), sb = await shots(B, spot, time), row = [];
  if (sa.length !== sb.length) console.log(`  (${sa.length} views in a, ${sb.length} in b: the cart close-ups differ in number, only the first ${Math.min(sa.length, sb.length)} are compared)`);
  for (let v = 0; v < Math.min(sa.length, sb.length); v++) {
    const r = await compare(sa[v], sb[v]); row.push(r.n ? `${r.n}px max ${r.max} at ${r.box.join(',')}` : '0'); total += r.n; views++;
    if (OUT && r.n) { fs.writeFileSync(path.join(OUT, `${spot}-${time}-${v}-a.png`), Buffer.from(sa[v].split(',')[1], 'base64')); fs.writeFileSync(path.join(OUT, `${spot}-${time}-${v}-b.png`), Buffer.from(sb[v].split(',')[1], 'base64')); }
  }
  console.log(`${spot} ${time} h: ${row.join(' | ')}`);
}
console.log(`${views} views, ${total} pixels differ`);
await browser.close(); server.close();
process.exit(total ? 1 : 0);
