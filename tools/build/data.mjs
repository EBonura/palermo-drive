// Baked map data -> binary blobs (see codec.mjs). Used by build.mjs.
//   - every classic <script src="*-data.js"> in index.html (palermo-data.js, props-data.js, context-data.js, ...)
//     is evaluated in a sandbox and its window.* globals go into one blob, data/core.<hash>.bin
//   - assets/traffic/bus-routes.js (an ES module) goes in the same blob as window.PD_BUS_ROUTES
//   - world/manifest.json and world/tiles/*.json (the whole-city tiles) become world/manifest.bin and
//     world/tiles/<id>.bin, decoded per tile by the fetch shim in runtime/loader.js
// Content transforms before encoding (all optional, reported in the build log):
//   - context: keep only the buildings src/context-select.js would draw (same rule as the game), rectangles for the far field
//   - streets: drop vertices that are within `simplify` metres of the line through their neighbours (default 0.06 m,
//     the data is only 0.1 m precise anyway); curbs are rounded to 0.1 m (they were 0.01)
// Everything else is bit-exact; every blob is decoded again and compared with its source before it is written.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import { encode } from './codec.mjs';
import { decode } from './runtime/decode.js';

const kb = n => (n / 1024).toFixed(1) + ' KB';
const gz = b => zlib.gzipSync(b, { level: 6 }).length;

// ---- street simplification (Douglas-Peucker on flat [x, z, x, z, ...] rings / lines) ----
function simplifyFlat(flat, eps) {
  const n = flat.length / 2;
  if (n < 4) return flat;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    const ax = flat[2 * a], az = flat[2 * a + 1], dx = flat[2 * b] - ax, dz = flat[2 * b + 1] - az, L = Math.hypot(dx, dz);
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const px = flat[2 * i] - ax, pz = flat[2 * i + 1] - az;
      const d = L < 1e-9 ? Math.hypot(px, pz) : Math.abs(px * dz - pz * dx) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(flat[2 * i], flat[2 * i + 1]);
  return out.length >= 6 ? out : flat;
}
const r1 = v => Math.round(v * 10) / 10;
function processStreets(S, eps, stats) {
  if (!S || typeof S !== 'object') return S;
  const out = { ...S };
  for (const layer of ['asphalt', 'paving', 'raised', 'green', 'water']) {
    if (!Array.isArray(S[layer])) continue;
    out[layer] = S[layer].map(poly => poly.map(ring => {
      stats.before += ring.length / 2;
      const rr = eps > 0 ? simplifyFlat(ring, eps) : ring;
      stats.after += rr.length / 2;
      return rr;
    }));
  }
  if (Array.isArray(S.curbs)) out.curbs = S.curbs.map(c => {
    const q = c.map(r1);
    stats.before += c.length / 2;
    const rr = eps > 0 ? simplifyFlat(q, eps) : q;
    stats.after += rr.length / 2;
    return rr;
  });
  return out;
}

function pruneContext(C, log) {
  return import(pathToFileURL(path.join(ROOT, 'src/context-select.js')).href).then(m => {
    if (!C || !Array.isArray(C.b)) return C;
    const all = m.decodeBuildings(C.b), n0 = all.length;
    const chosen = m.chooseBuildings(all);
    log(`  context: ${n0} buildings -> ${chosen.length} (the ones src/context.js draws, TRI_BUDGET ${m.TRI_BUDGET})`);
    return { ...C, b: chosen.map(m.encodeBuilding) };
  });
}

function sandboxLoad(file) {
  const w = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window: w }, { filename: file });
  return w;
}

function roundTrip(obj) { return JSON.parse(JSON.stringify(obj)); }
function pack(obj, what, log) {
  const buf = encode(obj);
  assert.deepStrictEqual(decode(new Uint8Array(buf)), roundTrip(obj), what + ': codec round trip differs');
  return buf;
}

export async function buildDataBlobs({ ROOT, OUT, hash, prune = true, simplify = 0.06, log = console.log }) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+-data\.js)"><\/script>/g)].map(m => m[1]);
  const globals = {};
  let jsonBytes = 0, jsonGz = 0;
  for (const f of scripts) {
    const file = path.join(ROOT, f), raw = fs.readFileSync(file);
    jsonBytes += raw.length; jsonGz += gz(raw);
    Object.assign(globals, sandboxLoad(file));
  }
  // ES-module data
  const busFile = path.join(ROOT, 'assets/traffic/bus-routes.js');
  if (fs.existsSync(busFile)) {
    const raw = fs.readFileSync(busFile); jsonBytes += raw.length; jsonGz += gz(raw);
    const m = await import(pathToFileURL(busFile).href + '?t=' + Date.now());
    globals.PD_BUS_ROUTES = { BUS_ROUTES: m.BUS_ROUTES, BUS_STOPS: m.BUS_STOPS };
  }
  const st = { before: 0, after: 0 };
  if (globals.PALERMO_DATA) {
    const D = globals.PALERMO_DATA;
    globals.PALERMO_DATA = { ...D, streets: processStreets(D.streets, simplify, st) };
    log(`  streets: ${st.before} -> ${st.after} vertices (simplify ${simplify} m, curbs rounded to 0.1 m)`);
  }
  if (prune && globals.PALERMO_CONTEXT) globals.PALERMO_CONTEXT = await pruneContext(globals.PALERMO_CONTEXT, log);

  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  const buf = pack(globals, 'core', log);
  const name = `data/core.${hash(buf)}.bin`;
  fs.writeFileSync(path.join(OUT, name), buf);
  log(`data ${name}: ${Object.keys(globals).join(', ')}: json ${kb(jsonBytes)} (${kb(jsonGz)} gzip) -> ${kb(buf.length)} (${kb(gz(buf))} gzip)`);

  // world tiles (optional)
  const blobs = [{ file: name }];
  let tiles = false;
  const wdir = path.join(ROOT, 'world');
  if (fs.existsSync(path.join(wdir, 'manifest.json'))) {
    tiles = true;
    fs.mkdirSync(path.join(OUT, 'world/tiles'), { recursive: true });
    let nj = 0, njg = 0, nb = 0, nbg = 0, n = 0;
    const one = (src, dst) => {
      const raw = fs.readFileSync(src), obj = JSON.parse(raw);
      if (obj.streets) obj.streets = processStreets(obj.streets, simplify, { before: 0, after: 0 });
      const b = pack(obj, src, log);
      fs.writeFileSync(dst, b);
      nj += raw.length; njg += gz(raw); nb += b.length; nbg += gz(b); n++;
    };
    one(path.join(wdir, 'manifest.json'), path.join(OUT, 'world/manifest.bin'));
    for (const f of fs.readdirSync(path.join(wdir, 'tiles'))) if (f.endsWith('.json')) one(path.join(wdir, 'tiles', f), path.join(OUT, 'world/tiles', f.replace(/\.json$/, '.bin')));
    log(`world: ${n} files: json ${kb(nj)} (${kb(njg)} gzip) -> ${kb(nb)} (${kb(nbg)} gzip)`);
  }
  return { blobs, tiles };
}
