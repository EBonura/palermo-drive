// Bakes src/fast-built.js: the built-up stretches of the Viale's side lanes (src/road-class.js isLane), as the flat x, z of a point every 10 m.
// A lane is a fast road only where nothing is built beside it. Per lane (its pieces joined end to end, so the answer does not depend on where a tile ends):
//   * a sample every 5 m is built when a building outline is within the lane's half width + 14 m of it, on either side;
//   * a lone built bit under 40 m long between open ground is dropped (one house is not a street), then every built stretch grows 15 m each way,
//     then an open gap under 100 m between built stretches, or open ground of under 100 m at the end of a lane with built stretches, becomes built too.
// Run: node tools/fast-built.mjs   (reads world/tiles, writes src/fast-built.js; run it again after the tiles are rebaked). Prints the km of lane that end up open and built.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), T = ROOT + '/world/tiles/';
const { isFastRoad, isExpressway } = await import('../src/road-class.js');
const STEP = 5, REACH = 14, LONE = 8, GROW = 3, MIN_OPEN = 20, OUT_STEP = 2;
const lane = r => !isExpressway(r) && isFastRoad(r) && (r.k === 'tertiary' || r.k === 'secondary');
const files = fs.readdirSync(T).filter(f => /^-?\d+_-?\d+\.json$/.test(f));
// ---- the lanes
const pieces = [];
for (const f of files) for (const r of JSON.parse(fs.readFileSync(T + f)).roads || []) if (lane(r)) { const p = r.o < 0 ? r.p.slice().reverse() : r.p; pieces.push({ p: r.o < 0 ? flip(r.p) : r.p, r }); }
function flip(p) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); return q; }
const key = (x, z) => Math.round(x * 4) + ',' + Math.round(z * 4);
const starts = new Map(), ends = new Map();
for (const pc of pieces) { const a = key(pc.p[0], pc.p[1]), b = key(pc.p[pc.p.length - 2], pc.p[pc.p.length - 1]); (starts.get(a) || starts.set(a, []).get(a)).push(pc); (ends.get(b) || ends.set(b, []).get(b)).push(pc); }
const next = pc => { const l = starts.get(key(pc.p[pc.p.length - 2], pc.p[pc.p.length - 1])) || []; const pr = ends.get(key(pc.p[pc.p.length - 2], pc.p[pc.p.length - 1])) || []; return l.length === 1 && pr.length === 1 && l[0] !== pc ? l[0] : null; };
const hasPrev = new Set(); for (const pc of pieces) { const n = next(pc); if (n) hasPrev.add(n); }
const chains = [], used = new Set();
for (const pc of pieces) { if (hasPrev.has(pc) || used.has(pc)) continue; const c = []; for (let q = pc; q && !used.has(q); q = next(q)) { used.add(q); c.push(q); } chains.push(c); }
for (const pc of pieces) if (!used.has(pc)) { const c = []; for (let q = pc; q && !used.has(q); q = next(q)) { used.add(q); c.push(q); } chains.push(c); }   // (rings)
// samples every STEP m along each chain
const S = [];   // { x, z, hw, ch, i, name }
for (let ci = 0; ci < chains.length; ci++) {
  let carry = 0, idx = 0;
  for (const pc of chains[ci]) {
    const hw = Math.max(3, (pc.r.cw || { tertiary: 8, secondary: 9 }[pc.r.k] || 8) / 2);
    for (let i = 0; i + 3 < pc.p.length; i += 2) {
      const ax = pc.p[i], az = pc.p[i + 1], bx = pc.p[i + 2], bz = pc.p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      for (; carry < L; carry += STEP) S.push({ x: ax + (bx - ax) * carry / L, z: az + (bz - az) * carry / L, hw, ch: ci, i: idx++, n: pc.r.n || '' });
      carry -= L;
    }
  }
}
// ---- buildings near the samples
const C = 32, grid = new Map();
S.forEach((s, id) => { const k = Math.floor(s.x / C) * 100003 + Math.floor(s.z / C); (grid.get(k) || grid.set(k, []).get(k)).push(id); s.d = 1e9; });
for (const f of files) {
  for (const b of JSON.parse(fs.readFileSync(T + f)).buildings || []) {
    const p = b.p; if (!p) continue;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length, n = Math.max(1, Math.ceil(Math.hypot(p[j] - p[i], p[j + 1] - p[i + 1]) / 4));
      for (let q = 0; q < n; q++) {
        const x = p[i] + (p[j] - p[i]) * q / n, z = p[i + 1] + (p[j + 1] - p[i + 1]) * q / n, ci = Math.floor(x / C), cj = Math.floor(z / C);
        for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const l = grid.get((ci + a) * 100003 + cj + c); if (l) for (const id of l) { const s = S[id], d = Math.hypot(s.x - x, s.z - z); if (d < s.d) s.d = d; } }
      }
    }
  }
}
// ---- per chain: built flags, merged
const out = [], stat = {};
const runs = (f, v) => { const r = []; for (let i = 0; i < f.length;) { let j = i; while (j + 1 < f.length && f[j + 1] === f[i]) j++; if (f[i] === v) r.push([i, j]); i = j + 1; } return r; };
for (let ci = 0; ci < chains.length; ci++) {
  const ss = S.filter(s => s.ch === ci); if (!ss.length) continue;
  let f = ss.map(s => s.d < s.hw + REACH);   // true: built
  const n = f.length;
  for (const [a, b] of runs(f, true)) if (b - a + 1 < LONE && a > 0 && b < n - 1) for (let i = a; i <= b; i++) f[i] = false;   // a lone house
  const g = f.slice(); for (let i = 0; i < n; i++) if (f[i]) for (let k = Math.max(0, i - GROW); k <= Math.min(n - 1, i + GROW); k++) g[k] = true; f = g;
  if (f.some(Boolean)) for (const [a, b] of runs(f, false)) if (b - a + 1 < MIN_OPEN) for (let i = a; i <= b; i++) f[i] = true;   // a short open bit between built stretches, or at the end of a built lane
  for (let i = 0; i < n; i++) {
    const nm = /Sud Est/.test(ss[i].n) ? 'SE' : /Nord Ovest/.test(ss[i].n) ? 'NW' : 'other'; const k = nm + (f[i] ? ' built' : ' open'); stat[k] = (stat[k] || 0) + STEP / 1000;
    if (f[i] && i % OUT_STEP === 0) out.push(Math.round(ss[i].x), Math.round(ss[i].z));
  }
}
fs.writeFileSync(ROOT + '/src/fast-built.js', '// Generated by tools/fast-built.mjs from the world tiles (the built-up stretches of the Viale\'s side lanes, src/road-class.js). Do not edit.\nexport default [' + out.join(',') + '];\n');
console.log('lanes', pieces.length, 'pieces,', chains.length, 'chains,', S.length, 'samples;', out.length / 2, 'built points');
for (const k of Object.keys(stat).sort()) console.log(k.padEnd(14), stat[k].toFixed(2), 'km');
