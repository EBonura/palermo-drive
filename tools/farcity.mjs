#!/usr/bin/env node
// Bake the far city (src/context.js createFarCity): every building of the whole map merged into flat-coloured boxes, one small file.
//
//   node tools/farcity.mjs                  # world/tiles/*.json -> assets/world/far.bin
//   node tools/farcity.mjs --stats          # print box and triangle counts, write nothing
//   node tools/farcity.mjs --cell=16 --tol=1 --close=1 --minc=1 --tiles=0_0,-3_0   # try other parameters on a few tiles
//
// Per tile (500 m) the footprints are rasterised on a CELL m grid (20 m; 3x3 samples per cell, a cell is built when 4 of 9 samples fall in a
// building), heights are the district-corrected ones the game uses (applyDistrictHeights, lidar roofs where the bake has them), snapped
// to a few storey classes, one-cell gaps closed (--close) and the cells whose classes differ by at most --tol merged into rectangles
// (greedy, row by row). Lone one-cell houses of one or two storeys are dropped (--minc). Each rectangle becomes a box with one flat
// colour (average of the PLASTER colour the low detail ring would give its buildings, 48 colours by k-means), and a mask of the walls
// that are not hidden behind a neighbour of equal or greater height. The runtime (src/context.js) only extrudes them: no facades, no uvs, no textures.
//
// File (little endian): 'PFC2', u8 cell (m), u8 n colours, u16 n tiles, u32 n boxes, colours n*3 (sRGB bytes), tiles n*(i16 i, i16 j, u16 count),
// then seven columns of n boxes each: x, z (cells from the tile corner), w, d (cells), hq (height class), colour index, wall mask (bit0 -z,
// bit1 +x, bit2 +z, bit3 -x). Columns, because gzip likes them. Heights: HQ[hq] metres above the lowest ground under the box.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { applyDistrictHeights } from '../src/districts.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const CELL = +(args.cell || 20), TOL = +(args.tol ?? 1), CLOSE = +(args.close ?? 1), MINC = +(args.minc ?? 1), T = 500, N = Math.ceil(T / CELL), SUB = 3, NCOL = 48;
// storey classes (metres): finer where houses are, coarser for towers
const HQ = [3, 5, 7.5, 10.5, 14, 18, 23, 30, 40, 55, 75];
const PLASTER = ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4', '#cfc3ab', '#d9c9a8'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const hclass = h => { let q = 0; while (q < HQ.length - 1 && h > (HQ[q] + HQ[q + 1]) / 2) q++; return q; };

function inPoly(pts, x, z) { // flat [x, z, ...] ring
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function bakeTile(d, i0, j0) {
  applyDistrictHeights(d);
  const cov = new Float32Array(N * N), hs = new Float32Array(N * N), cr = new Float32Array(N * N * 3);
  const x0 = i0 * T, z0 = j0 * T, step = CELL / SUB;
  for (const b of d.buildings) {
    const p = b.p; let ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9;
    for (let k = 0; k < p.length; k += 2) { ax = Math.min(ax, p[k]); bx = Math.max(bx, p[k]); az = Math.min(az, p[k + 1]); bz = Math.max(bz, p[k + 1]); }
    const h = Math.max(3, b.r !== undefined && b.g !== undefined ? b.r - b.g : b.h), col0 = PLASTER[b.c % PLASTER.length], col = b.rc ? col0.map((c, i) => Math.round(0.5 * c + 0.5 * parseInt(b.rc.slice(2 * i, 2 * i + 2), 16))) : col0, v = 0.92 + ((b.c >> 4) % 9) * 0.02;
    for (let sz = Math.floor((az - z0) / step); sz <= Math.floor((bz - z0) / step); sz++) {
      const z = z0 + (sz + 0.5) * step, cz = Math.floor(sz / SUB); if (cz < 0 || cz >= N) continue;
      for (let sx = Math.floor((ax - x0) / step); sx <= Math.floor((bx - x0) / step); sx++) {
        const x = x0 + (sx + 0.5) * step, cx = Math.floor(sx / SUB); if (cx < 0 || cx >= N) continue;
        if (!inPoly(p, x, z)) continue;
        const c = cz * N + cx; cov[c]++; hs[c] += h; cr[c * 3] += col[0] * v; cr[c * 3 + 1] += col[1] * v; cr[c * 3 + 2] += col[2] * v;
      }
    }
  }
  const hq = new Int8Array(N * N).fill(-1);
  for (let c = 0; c < N * N; c++) if (cov[c] >= SUB * SUB * 0.44) hq[c] = hclass(hs[c] / cov[c]);
  // close one-cell gaps (alleys, courtyards seen from afar): an empty cell between two buildings takes the lower of the two
  for (let pass = 0; pass < CLOSE; pass++) {
    const g = hq.slice();
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      const c = z * N + x; if (g[c] >= 0) continue;
      const a = g[c - 1], b = g[c + 1], u = g[c - N], v = g[c + N];
      const nb = a >= 0 && b >= 0 ? [c - 1, c + 1] : u >= 0 && v >= 0 ? [c - N, c + N] : null;
      if (!nb) continue;
      hq[c] = Math.min(g[nb[0]], g[nb[1]]); cov[c] = 1;
      for (let k = 0; k < 3; k++) cr[c * 3 + k] = (cr[nb[0] * 3 + k] / cov[nb[0]] + cr[nb[1] * 3 + k] / cov[nb[1]]) / 2;
    }
  }
  // greedy rectangles; neighbours within TOL classes of the first cell join, the box takes the mean height
  const used = new Uint8Array(N * N), boxes = [];
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const c = z * N + x, q = hq[c]; if (q < 0 || used[c]) continue;
    const ok = e => hq[e] >= 0 && !used[e] && Math.abs(hq[e] - q) <= TOL;
    let w = 1; while (x + w < N && ok(c + w)) w++;
    let dd = 1;
    grow: while (z + dd < N) { for (let k = 0; k < w; k++) if (!ok((z + dd) * N + x + k)) break grow; dd++; }
    let r = 0, g = 0, b = 0, n = 0, hm = 0;
    for (let k = 0; k < dd; k++) for (let m = 0; m < w; m++) { const e = (z + k) * N + x + m; used[e] = 1; const f = cov[e]; r += cr[e * 3] / f; g += cr[e * 3 + 1] / f; b += cr[e * 3 + 2] / f; hm += HQ[hq[e]]; n++; }
    boxes.push({ x, z, w, d: dd, q: hclass(hm / n), rgb: [r / n, g / n, b / n] });
  }
  // a wall is hidden when every cell beside it is a building at least as tall
  const hid = (bx, side) => {
    const { x, z, w, d, q } = bx; let n = 0;
    const at = (a, b) => (a < 0 || b < 0 || a >= N || b >= N) ? -1 : hq[b * N + a];
    if (side === 0) for (let k = 0; k < w; k++) n += at(x + k, z - 1) >= q ? 1 : 0;
    if (side === 1) for (let k = 0; k < d; k++) n += at(x + w, z + k) >= q ? 1 : 0;
    if (side === 2) for (let k = 0; k < w; k++) n += at(x + k, z + d) >= q ? 1 : 0;
    if (side === 3) for (let k = 0; k < d; k++) n += at(x - 1, z + k) >= q ? 1 : 0;
    return n === (side & 1 ? d : w);
  };
  // lone small houses (one cell, one or two storeys) are not worth a box from a kilometre away
  for (let k = boxes.length - 1; k >= 0; k--) { const bx = boxes[k]; if (bx.w * bx.d <= MINC && bx.q <= 2) boxes.splice(k, 1); }
  for (const bx of boxes) { bx.mask = 0; for (let s = 0; s < 4; s++) if (!hid(bx, s)) bx.mask |= 1 << s; }
  return boxes;
}

// ---- main ----
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/manifest.json'), 'utf8'));
let keys = Object.keys(man.tiles).filter(k => man.tiles[k].b > 0);
if (args.tiles) keys = args.tiles.split(',');
keys.sort((a, b) => { const [ai, aj] = a.split('_').map(Number), [bi, bj] = b.split('_').map(Number); return ai - bi || aj - bj; });
const all = [];
let nb = 0;
for (const k of keys) {
  const f = path.join(ROOT, 'world/tiles', k + '.json'); if (!fs.existsSync(f)) continue;
  const [i, j] = k.split('_').map(Number), d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const boxes = bakeTile(d, i, j); nb += d.buildings.length;
  if (boxes.length) all.push({ i, j, boxes, b: d.buildings.length });
}
// palette: a few k-means rounds over the box colours
const pts = all.flatMap(t => t.boxes.map(b => b.rgb));
let cen = []; for (let k = 0; k < NCOL; k++) cen.push(pts[Math.floor((k + 0.5) / NCOL * pts.length)].slice());
for (let it = 0; it < 12; it++) {
  const sum = cen.map(() => [0, 0, 0, 0]);
  for (const p of pts) { let bi = 0, bd = 1e18; for (let k = 0; k < cen.length; k++) { const c = cen[k], e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (e < bd) { bd = e; bi = k; } } const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
  cen = cen.map((c, k) => sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c);
}
const nearest = p => { let bi = 0, bd = 1e18; for (let k = 0; k < cen.length; k++) { const c = cen[k], e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (e < bd) { bd = e; bi = k; } } return bi; };
const total = all.reduce((a, t) => a + t.boxes.length, 0);
const tris = all.reduce((a, t) => a + t.boxes.reduce((s, b) => s + 2 + 2 * [0, 1, 2, 3].filter(s2 => b.mask >> s2 & 1).length, 0), 0);
console.log(`tiles ${all.length}, buildings ${nb}, boxes ${total} (${(total / Math.max(1, nb)).toFixed(2)} per building), triangles ${tris}, per box ${(tris / total).toFixed(1)}`);
const near9 = all.filter(t => Math.hypot((t.i + .5) * T, (t.j + .5) * T) < 9000), n9 = near9.reduce((a, t) => a + t.boxes.reduce((s, b) => s + 2 + 2 * [0, 1, 2, 3].filter(q => b.mask >> q & 1).length, 0), 0);
console.log(`within 9 km of the centre: ${near9.length} tiles, ${near9.reduce((a, t) => a + t.boxes.length, 0)} boxes, ${n9} triangles`);
const dense = all.slice().sort((a, b) => b.boxes.length - a.boxes.length).slice(0, 5).map(t => `${t.i}_${t.j}: ${t.boxes.length} boxes of ${t.b} buildings`);
console.log('densest:', dense.join('; '));
if (args.stats) process.exit(0);

const head = 4 + 1 + 1 + 2 + 4, size = head + cen.length * 3 + all.length * 6 + total * 7;
const buf = Buffer.alloc(size); let o = 0;
buf.write('PFC2', 0, 'latin1'); buf[4] = CELL; buf[5] = cen.length; buf.writeUInt16LE(all.length, 6); buf.writeUInt32LE(total, 8); o = head;
for (const c of cen) for (let k = 0; k < 3; k++) buf[o++] = Math.max(0, Math.min(255, Math.round(c[k])));
for (const t of all) { buf.writeInt16LE(t.i, o); buf.writeInt16LE(t.j, o + 2); buf.writeUInt16LE(t.boxes.length, o + 4); o += 6; }
for (const col of ['x', 'z', 'w', 'd', 'q', 'c', 'mask']) for (const t of all) for (const b of t.boxes) buf[o++] = col === 'c' ? nearest(b.rgb) : b[col];
const out = path.join(ROOT, 'assets/world/far.bin');
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, buf);
console.log(`wrote ${out}: ${buf.length} bytes, gzip ${zlib.gzipSync(buf, { level: 9 }).length} bytes`);
