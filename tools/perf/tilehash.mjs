// Did a change to the tile building change what gets built? Loads the same places in two builds and compares a hash of every tile's geometry (each part of the tile, each attribute), its instance matrices and its surface masks.
//   tools/release/withbrowser.sh node tools/perf/tilehash.mjs --a <dist> --b <dist> [--c <dist>]     with --c as a second copy of a, for what differs between two runs of one build
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SPOTS = [[17.5, 0, 'Quattro Canti'], [-2743, -1678, 'Viale Regione'], [-3033, -10177, 'Mondello'], [25, 489, 'Ballaro']];
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const pageHash = () => {
  const W = window.game.world, out = {};
  const fnv = (a, h = 2166136261) => { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  for (const t of W.tiles.values()) {
    if (t.lod !== 2 || !t.phys) continue;
    const o = out[t.id] = {};
    for (const name in t.parts) {
      const rows = [];
      t.parts[name].traverse(m => {
        if (!m.geometry) return;
        const g = m.geometry; let line = (m.name || '') + ':';
        for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k]; if (a.array) line += k + a.array.length + '=' + fnv(a.array) + ','; }
        if (g.index && g.index.array) line += 'i' + g.index.count + '=' + fnv(g.index.array.BYTES_PER_ELEMENT === 2 ? new Uint32Array(g.index.array) : g.index.array);
        if (m.isInstancedMesh) line += 'M' + m.count + '=' + fnv(m.instanceMatrix.array.subarray(0, m.count * 16)) + (m.instanceColor ? 'C' + fnv(m.instanceColor.array.subarray(0, m.count * 3)) : '');
        rows.push(line);
      });
      rows.sort(); let h = 2166136261; for (const r of rows) for (let i = 0; i < r.length; i++) { h ^= r.charCodeAt(i); h = Math.imul(h, 16777619); }
      o[name] = rows.length + ':' + (h >>> 0);
    }
    for (const k of ['raised', 'hard', 'sandb']) if (t[k]) o['mask_' + k] = fnv(t[k]);
  }
  // the props of the tiles (src/props.js keeps them in the scene, not in the tile's parts)
  window.game.scene.traverse(g => { if (/^props_/.test(g.name)) { const rows = []; g.traverse(m => { if (m.isInstancedMesh) rows.push(m.name + m.count + '=' + fnv(m.instanceMatrix.array.subarray(0, m.count * 16))); }); rows.sort(); let h = 2166136261; for (const r of rows) for (let i = 0; i < r.length; i++) { h ^= r.charCodeAt(i); h = Math.imul(h, 16777619); } (out[g.name] = {}).all = rows.length + ':' + (h >>> 0); } });
  return out;
};
async function collect(root) {
  const { server, port } = await startServer(path.resolve(root), ''), res = {};
  for (const [x, z, name] of SPOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await page.goto(`http://127.0.0.1:${port}/?help=0&play&debug&p2p=off&peds=0&keepgeo&time=13&at=${x},${z},0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
    await page.waitForFunction(() => { const W = window.game.world; let any = 0; for (const t of W.tiles.values()) { if (t.want === 2 && (t.lod !== 2 || t.task)) return false; if (t.lod === 2) any++; } return any > 0 && W.stats().queued <= 1; }, { timeout: 240000, polling: 500 }).catch(() => console.log('  not settled at', name));
    await new Promise(r => setTimeout(r, 6000));
    res[name] = await page.evaluate(pageHash);
    await page.close();
  }
  server.close();
  return res;
}
const A = await collect(arg('a')), B = await collect(arg('b')), C = arg('c') ? await collect(arg('c')) : null;
const compare = (X, Y, label) => {
  let same = 0, diff = 0, one = 0; const list = [];
  for (const spot in X) for (const tile in X[spot]) { if (!Y[spot][tile]) { one++; continue; } for (const part in X[spot][tile]) { if (X[spot][tile][part] === Y[spot][tile][part]) same++; else { diff++; if (list.length < 40) list.push(`${spot} ${tile} ${part}`); } } }
  console.log(label, 'parts the same', same, 'different', diff, 'tiles in only one', one); if (list.length) console.log('  ' + list.join('\n  '));
};
compare(A, B, 'a against b:');
if (C) compare(A, C, 'a against c (noise):');
await browser.close();
