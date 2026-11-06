// Bridge steps: does every bridge deck meet the road at its ends? For each bridge of the world tiles (records `structs`, kind 'b'), on the REAL loaded world
// (tiles at full detail), compares the deck height just inside each end (hooks.level) with the ground the approach road is draped on just outside it (hooks.ground, which
// includes the river trenches). A deck that stands well above its approach reads from eye height as a grey wall across the road (Via Palmerino, b81531217).
//
//   tools/release/withbrowser.sh node tools/bridge-steps.mjs [--root dist] [--only <regexp on id>] [--out file.json]
//
// Prints one line per bridge end whose step is over --min metres (default 0.3), then a summary. Flyovers (ov) are listed too: their ends sit on the ground as well, only
// the middle rises.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), ONLY = arg('only') ? new RegExp(arg('only')) : null, MIN = +arg('min', 0.3), OUTF = arg('out');

// the bridge records, from the source tiles (dist holds them packed)
const recs = new Map();
for (const f of fs.readdirSync(path.join(REPO, 'world/tiles'))) {
  if (!f.endsWith('.json')) continue;
  const raw = fs.readFileSync(path.join(REPO, 'world/tiles', f), 'utf8'); if (!raw.includes('"structs"')) continue;
  for (const r of JSON.parse(raw).structs || []) if (r.k === 'b' && r.y0 !== undefined && !recs.has(r.id) && (!ONLY || ONLY.test(r.id))) recs.set(r.id, r);
}
// one probe per end: the end point, the unit direction pointing out of the deck
const T = 500, ends = [];
for (const r of recs.values()) {
  const p = r.p, n = p.length / 2;
  for (const [e, a, b] of [[0, 0, 1], [1, n - 1, n - 2]]) {
    const x = p[2 * a], z = p[2 * a + 1], dx = x - p[2 * b], dz = z - p[2 * b + 1], l = Math.hypot(dx, dz) || 1;
    ends.push({ id: r.id, end: e, x, z, ox: dx / l, oz: dz / l, y: e ? r.y1 : r.y0, ov: !!r.ov, rv: !!r.rv, ly: r.ly, n: r.n || '', tile: Math.floor(x / T) + '_' + Math.floor(z / T) });
  }
}
const byTile = new Map(); for (const e of ends) { if (!byTile.has(e.tile)) byTile.set(e.tile, []); byTile.get(e.tile).push(e); }

const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', protocolTimeout: 900000, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--no-first-run'] });
const closeAll = async () => { await browser.close().catch(() => {}); server.close(); };
process.on('SIGINT', async () => { await closeAll(); process.exit(130); });
const page = await browser.newPage(); await page.setViewport({ width: 480, height: 270, deviceScaleFactor: 1 });
const first = ends[0];
await page.goto(`http://127.0.0.1:${port}/?help=0&p2p=off&debug&fixres&play&time=14&cash=0&tricap=1e9&rfull=800&at=${Math.round(first.x)},${Math.round(first.z)},0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.game && window.__missions && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await page.evaluate(fs.readFileSync(path.join(REPO, 'tools/route-check/page.js'), 'utf8'));   // for __rc.focus

const out = [];
for (const [tile, list] of byTile) {
  const c = list[0];
  const ms = await page.evaluate((x, z) => window.__rc.focus(x, z), c.x + c.ox * 6, c.z + c.oz * 6).catch(() => -1);
  if (ms < 0) console.log('tile', tile, 'did not load in time');
  const res = await page.evaluate(list => {
    const G = window.game;
    return list.map(e => {
      // the deck of this bridge: the highest level not more than 2.5 m over its baked end height (a higher one is another ramp passing over), NaN none
      const lv = (s, ref) => G.hooks.level(e.x - e.ox * s, e.z - e.oz * s, ref), gr = s => G.hooks.ground(e.x + e.ox * s, e.z + e.oz * s), fin = v => Number.isFinite(v) ? v : null;
      return { ...e, deck: fin(lv(0.5, e.y + 1.3)), top: fin(lv(0.5, 1e9)), g0: fin(gr(0)), g2: fin(gr(2)), g5: fin(gr(5)), g10: fin(gr(10)) };
    });
  }, list);
  for (const r of res) {
    r.step = r.deck === null || r.g2 === null ? NaN : r.deck - r.g2;
    out.push(r);
    if (!(Math.abs(r.step) < MIN)) console.log(`${r.id} end ${r.end}${r.ov ? ' ov' : ''}${r.rv ? ' rv' : ''} ${r.n} at ${Math.round(r.x)},${Math.round(r.z)}: deck ${r.deck?.toFixed(2)} (highest ${r.top?.toFixed(2)}) baked ${r.y} ground +2 m ${r.g2?.toFixed(2)} +5 m ${r.g5?.toFixed(2)} +10 m ${r.g10?.toFixed(2)} step ${r.step.toFixed(2)}`);
  }
}
const bad = out.filter(r => !(Math.abs(r.step) < MIN)), badIds = new Set(bad.map(r => r.id));
console.log(`SUMMARY bridges ${recs.size}, ends ${out.length}, ends with a step over ${MIN} m: ${bad.length} (${badIds.size} bridges; up ${bad.filter(r => r.step > 0).length}, down ${bad.filter(r => r.step < 0).length}, no deck/ground ${bad.filter(r => !Number.isFinite(r.step)).length})`);
if (OUTF) fs.writeFileSync(OUTF, JSON.stringify(out));
await closeAll();
