// City landmarks, group G (review-2 items 9, 13/14 and 15): the Giardino Inglese as a garden, the giant ficus of the Villa Garibaldi on Piazza Marina, the Stazione Centrale, the Ponte
// dell'Ammiraglio in its garden, and the paved piazza of Mondello with its fountain and church. Same toolkit and way of working as the other city landmarks (src/lmc-kit.js): painted textures,
// real geometry for what stands out, one bin per material, built on the streamed ground, collision for what stands outside the footprints. Proportions come from Wikimedia Commons
// photographs (nothing of them is stored); the notes are in docs/faithfulness/landmarks.md (review 2). `pave` on a spec lists ground polygons that src/world.js paves (the terrain, no mesh).
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, prism, shell,
  mul, tr, rotY, frame, pairsOf, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG, palm, rail, balus, archShape,
} from './lmc-kit.js';
import { lampPost, tubeGeo } from './lmc-mondello.js';

const r1 = (v) => Math.round(v * 10) / 10;
// world position of the local point (x, z) of a frame at O whose +z points along (nx, nz) (local +x is (nz, -nx), as frame() has it)
const wpt = (O, nx, nz, x, z) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz];
const rectSegs = (O, nx, nz, x0, x1, z0, z1) => { const p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => wpt(O, nx, nz, x, z)); return p.map((a, i) => { const b = p[(i + 1) % 4]; return [r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]; }); };
const ringWalls = (cx, cz, r, n = 8, a0 = 0.3927) => { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i * 2 * PI / n, b = a0 + (i + 1) * 2 * PI / n; o.push([r1(cx + Math.cos(a) * r), r1(cz + Math.sin(a) * r), r1(cx + Math.cos(b) * r), r1(cz + Math.sin(b) * r)]); } return o; };
const sqWalls = (cx, cz, h) => [[cx - h, cz - h, cx + h, cz - h], [cx + h, cz - h, cx + h, cz + h], [cx + h, cz + h, cx - h, cz + h], [cx - h, cz + h, cx - h, cz - h]].map(s => s.map(r1));
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// ====================================================================================================
// shared vegetation and garden materials
// ====================================================================================================
function gardenMats() {
  ensureTrunk();
  const leaves = (g, w, h, base, seed, cols) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = RNG(seed); for (let i = 0; i < 900; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.ellipse(r() * w, r() * h, 1.4 + r() * 2.2, 0.8 + r() * 1.2, r() * 3.14, 0, 7); g.fill(); } };
  defMat('g_leaf', 128, 128, [4, 4], (g, w, h) => leaves(g, w, h, '#628c40', 901, ['#3e6c2a', '#86b054', '#a6c664', '#2e5424', '#6e9c46']));
  defMat('g_card', 128, 96, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); const r = RNG(910); for (let i = 0; i < 170; i++) { const a = r() * 6.283, d = Math.sqrt(r()); g.fillStyle = ['#4a7a36', '#689a44', '#8cb456', '#3a642c'][(r() * 4) | 0]; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * d * w * 0.45, h / 2 + Math.sin(a) * d * h * 0.43, 3.5 + r() * 4, 1.8 + r() * 2.2, r() * 3.14, 0, 7); g.fill(); } }, { alphaTest: 0.45, side: THREE.DoubleSide });
  defMat('g_bark', 64, 128, [1.6, 4], (g, w, h) => { g.fillStyle = '#a49682'; g.fillRect(0, 0, w, h); const r = RNG(903); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${r() < 0.55 ? '70,58,44' : '214,204,186'},${0.2 + r() * 0.3})`; const x = r() * w, y = r() * h, wd = 1 + r() * 3, ln = 14 + r() * 50; g.fillRect(x, y, wd, ln); g.fillRect(x, y - h, wd, ln); } noiseDots(g, w, h, 160, 1.6, 911, ['rgba(60,50,38,0.25)', 'rgba(228,220,204,0.25)']); });
  defMat('g_gravel', 128, 128, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#d3c6a6'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 2.2, 904, ['rgba(120,104,76,0.28)', 'rgba(250,244,226,0.38)', 'rgba(160,146,116,0.3)']); },
    { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });   // over the Comune green polygon (lifted 0.16 m, offset -5) of a park
  defMat('g_bed', 128, 128, [2.6, 2.6], (g, w, h) => {
    g.fillStyle = '#3f6a30'; g.fillRect(0, 0, w, h); const r = RNG(905), cols = ['#d63a4a', '#f2c230', '#e9e6dc', '#c24fa0', '#f08a2c', '#8a5cc8'];
    for (let i = 0; i < 360; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const s = 2 + r() * 2.6; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 7); g.fill(); }
    noiseDots(g, w, h, 300, 2, 906, ['rgba(20,50,20,0.3)']);
  });
  defMat('g_soil', 64, 64, [2, 2], (g, w, h) => { g.fillStyle = '#6b5640'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 200, 2, 907, ['rgba(40,28,18,0.3)', 'rgba(150,120,88,0.25)']); });
  defMat('g_wood', 64, 64, [1.2, 1.2], (g, w, h) => { g.fillStyle = '#8f6038'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,24,12,0.35)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.5); });
  defMat('g_stone', 128, 128, [2.4, 2.4], (g, w, h) => paintAshlar(g, w, h, 2.4, 2.4, 0.4, 0.9, '#cdc4ae', '#8f866f', 908, 1.5, 0.07));
}

// a jittered lump of foliage (low poly, flat shaded); `ky` flattens it
function blob(key, x, y, z, r, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, o.det === undefined ? 1 : o.det), pos = g.attributes.position, sd = o.seed || 1;
  const hv = (a, b, c) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + sd * 3.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), k = 1 + (hv(px, py, pz) - 0.5) * (o.jit === undefined ? 0.36 : o.jit); pos.setXYZ(i, px * k, py * k, pz * k); }
  g.computeVertexNormals();
  if (o.smooth) { const nrm = g.attributes.normal, v = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).normalize().multiplyScalar(0.35).add(new THREE.Vector3().fromBufferAttribute(nrm, i).multiplyScalar(0.65)).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); } }   // rounder shading: a clump of leaves, not a cut stone
  part(key, g, { p: [x, y, z], s: [r * (o.kx || 1), r * (o.ky || 0.78), r * (o.kz || 1)], ry: o.ry || 0, c: o.c, noao: true });
}

// a draped path or strip: the polyline `pts` ([x, z] pairs) is smoothed, resampled every ~2 m and laid on the ground w metres wide, `lift` above it
function smoothPts(pts, n = 5) {
  const out = [], P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
function ribbon(key, line, w, lift, uk = 2.4) {
  const res = [line[0]];
  for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(l / 2)); for (let q = 1; q <= k; q++) res.push([a[0] + (b[0] - a[0]) * q / k, a[1] + (b[1] - a[1]) * q / k]); }
  const P = [];
  for (let i = 0; i < res.length; i++) {
    const a = res[Math.max(0, i - 1)], b = res[Math.min(res.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const lx = tz, lz = -tx, p = res[i];   // left of travel (x east, z south)
    P.push([[p[0] + lx * w / 2, groundY(p[0] + lx * w / 2, p[1] + lz * w / 2) + lift, p[1] + lz * w / 2], [p[0] - lx * w / 2, groundY(p[0] - lx * w / 2, p[1] - lz * w / 2) + lift, p[1] - lz * w / 2]]);
  }
  if (P.length > 1) gridMesh(key, P, (i, j, p) => [p[0] / uk, p[2] / uk], { noao: true });
}
const circlePts = (cx, cz, r, n = 28) => { const o = []; for (let i = 0; i <= n; i++) { const a = i * 2 * PI / n; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; };

// a bench facing (fx, fz): seat and back on iron ends
function bench(x, z, fx, fz) {
  const y = groundY(x, z), M = frame(x, y, z, fx, fz);
  bx('g_wood', M, -0.9, 0.9, 0.42, 0.5, -0.25, 0.25, { noao: true });
  bx('g_wood', M, -0.9, 0.9, 0.6, 0.9, -0.3, -0.24, { noao: true, rx: -0.12 });
  for (const sg of [-1, 1]) bx('flat', M, sg * 0.8 - 0.04, sg * 0.8 + 0.04, 0, 0.5, -0.28, 0.24, { c: '#2a2c2b', noao: true });
}

// ====================================================================================================
// a big strangler fig (Ficus macrophylla / magnolioides), from the photos of the giant of the Villa Garibaldi (Wikimedia Commons "Fico magnolioide di Villa Garibaldi.jpg", "Radici di Ficus
// macrophylla - Piazza Marina, Palermo, Italia - 28 Aprile 2023.jpg", "Fico magnolioide, Piazza Marina, Palermo.jpg", "Palermo-Park-bjs-1.jpg"): a trunk made of many fused pale strands that flare
// into roots snaking over the ground, heavy limbs, thick root pillars and curtains of thin hanging roots, and a dense rounded crown, lighter on top. S scales it (1 = about 38 m across).
// Not verified: the real positions of the individual limbs and roots.
// ====================================================================================================
// a tapered tube along [x, y, z] points with one radius per point, `sides` faces round it, open ends; uv in metres of the bark texture
function stem(key, pts, radii, sides, o = {}) {
  const V = pts.map(p => new THREE.Vector3(...p)), pos = [], nor = [], uv = []; let len = 0;
  const rings = V.map((p, i) => {
    const t = V[Math.min(V.length - 1, i + 1)].clone().sub(V[Math.max(0, i - 1)]).normalize();
    const u = new THREE.Vector3(Math.abs(t.y) > 0.9 ? 1 : 0, Math.abs(t.y) > 0.9 ? 0 : 1, 0).cross(t).normalize(), w = t.clone().cross(u);
    if (i) len += p.distanceTo(V[i - 1]);
    return Array.from({ length: sides + 1 }, (_, k) => { const n = u.clone().multiplyScalar(Math.cos(k * 2 * PI / sides)).addScaledVector(w, Math.sin(k * 2 * PI / sides)); return [p.clone().addScaledVector(n, radii[i]), n, k / sides * Math.max(1, Math.round(radii[0] * 2 * PI / 1.6)), len / 4]; });
  });
  for (let i = 0; i < V.length - 1; i++) for (let k = 0; k < sides; k++) {
    const A = rings[i][k], B = rings[i][k + 1], C = rings[i + 1][k + 1], D = rings[i + 1][k];
    for (const q of [A, B, C, A, C, D]) { pos.push(q[0].x, q[0].y, q[0].z); nor.push(q[1].x, q[1].y, q[1].z); uv.push(q[2], q[3]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  part(key, g, { uv: 'keep', noao: true, ...o });
}
function ficus(cx, cz, S, seed) {
  const gy = groundY(cx, cz), r = RNG(seed), rr = (a, b) => a + (b - a) * r();
  const V = S * 0.8, TH = 8.5 * V;   // V: the height scale (a fig is broader than tall); TH: where the trunk splits into limbs
  const at = (a, d, y) => [cx + Math.cos(a) * d, y, cz + Math.sin(a) * d];
  const BARK = ['#ffffff', '#eee6d8', '#fff4e2', '#e2dace'], bark = () => BARK[(r() * BARK.length) | 0];
  // the core of the trunk, then the fused strands round it, each flaring out at the foot into a root on the ground
  stem('g_bark', [[cx, gy - 0.4, cz], [cx, gy + TH * 0.5, cz], [cx, gy + TH, cz]], [2.2 * S, 1.7 * S, 2.1 * S], 8, { c: '#d6ccbc' });
  const small = S < 0.7, nStr = small ? 9 : 14;
  for (let i = 0; i < nStr; i++) {
    const a = i * 2 * PI / nStr + rr(-0.18, 0.18), a1 = a + rr(-0.4, 0.4), d = rr(1.8, 2.5) * S, foot = at(a, rr(3.0, 3.5) * S, gy + 0.25), w = rr(0.5, 0.85) * S * (small ? 1.3 : 1);
    stem('g_bark', [at(a, rr(3.7, 4.4) * S, gy - 0.15), foot, at(a, d, gy + rr(1.6, 2.4) * V), at(a1, d * 0.85, gy + TH * 0.65), at(a1 + rr(-0.2, 0.2), d * 1.25, gy + TH + 0.6)], [0.1 * S, w * 0.75, w, w * 0.75, w * 0.8], 5, { c: bark() });
    if (i % 2 === 0) stem('g_bark', [foot, at(a + 0.3, 4.1 * S, gy + 0.14), at(a + 0.55, 4.5 * S, gy - 0.12)], [0.3 * S, 0.18 * S, 0.06 * S], 4, { c: bark() });   // a side root snaking away
  }
  // limbs
  const limbs = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * PI / 9 + r() * 0.5, el = 0.22 + r() * 0.42, len = (10 + r() * 6) * S, y0 = gy + TH - 0.8 * V;
    const L = { a, len, y0, y1: y0 + Math.sin(el) * len * 0.9, d1: 0.8 * S + Math.cos(el) * len };
    stem('g_bark', [at(a, 0.8 * S, y0), at(a + rr(-0.1, 0.1), L.d1 * 0.5, y0 + (L.y1 - y0) * 0.35 + rr(-0.4, 0.4)), at(a, L.d1, L.y1)], [1.15 * S, 0.7 * S, 0.3 * S], 6, { c: bark() });
    limbs.push(L);
  }
  const onLimb = (L, t) => { const d = 0.8 * S + (L.d1 - 0.8 * S) * t; return [d, L.y0 + (L.y1 - L.y0) * (t < 0.5 ? t * 0.7 : 0.35 + (t - 0.5) * 1.3)]; };
  // root pillars: thick aerial roots that have reached the ground, flared at the foot, and thinner ones beside them
  const nPil = Math.round(7 * S + 3), nIn = small ? 5 : limbs.length;   // the first of them crowd round the trunk, the rest stand further out
  for (let i = 0; i < nIn + nPil; i++) {
    const L = limbs[i % limbs.length], [d, top] = onLimb(L, i < nIn ? rr(0.13, 0.28) : rr(0.38, 0.72)), a = L.a + rr(-0.12, 0.12), p = at(a, d, 0), g0 = groundY(p[0], p[2]), w = (i < nIn ? rr(0.4, 0.65) : rr(0.22, 0.42)) * S + 0.06;
    stem('g_bark', [at(a, d + rr(-0.5, 0.9), g0 - 0.2), at(a, d + rr(-0.1, 0.2), g0 + 1.1), at(a + rr(-0.05, 0.05), d + rr(-0.3, 0.3), (g0 + top) / 2), at(a, d, top)], [w * 2.1, w, w * 0.75, w], 5, { c: bark() });
    for (let k = 0; k < (small ? 0 : i < nIn ? 1 : 2); k++) { const ak = a + rr(-0.1, 0.1), dk = d + rr(-1.1, 1.1); stem('g_bark', [at(ak, dk, g0 - 0.1), at(ak + rr(-0.03, 0.03), dk + rr(-0.4, 0.4), (g0 + top) / 2), at(a, d + rr(-0.5, 0.5), top)], [0.12 * S, 0.07 * S, 0.1 * S], 3, { c: bark() }); }
  }
  // the curtain of thin roots that hang from the limbs and from the fork, most of them short of the ground
  const nHang = Math.round(40 * S + 4);
  for (let i = 0; i < nHang; i++) {
    const L = limbs[(r() * limbs.length) | 0], [d, top] = onLimb(L, rr(0.05, 0.8)), a = L.a + rr(-0.22, 0.22), p = at(a, d, 0), g0 = groundY(p[0], p[2]), end = g0 + (r() < 0.45 ? -0.1 : rr(0.8, 3.2) * V);
    if (top - end < 1.2) continue;
    stem('g_bark', [at(a + rr(-0.04, 0.04), d + rr(-0.4, 0.4), end), at(a, d, top)], [0.035 * S + 0.012, 0.075 * S + 0.02], 3, { c: r() < 0.5 ? '#cdbfa8' : '#a8957c' });
  }
  // the crown: a dense dome of many small clumps, dark underneath, lighter on top, with leaf cards to break the outline
  const clump = (x, y, z, rad, ky, k) => {
    const h = (y - gy) / V, top = h > 17.5, c = top ? (r() < 0.5 ? '#fffff0' : '#f0ffd0') : h > 14 && r() < 0.5 ? '#e4f2d0' : '#b6c8ae';
    blob('g_leaf', x, y, z, rad, { ky, seed: seed + k, jit: 0.42, ry: r() * 6, c, smooth: true });
  };
  limbs.forEach((L, i) => { const p = at(L.a, L.d1, L.y1 + 1.3 * V); clump(p[0], p[1], p[2], rr(4.6, 5.8) * S, 0.72, i); });
  const lay = (n, rad, y0, y1, r0, r1, ky, k0) => { for (let i = 0; i < n; i++) { const a = (i + rr(0, 0.8)) * 2 * PI / n, d = rad * S * rr(0.75, 1.05); clump(cx + Math.cos(a) * d, gy + rr(y0, y1) * V, cz + Math.sin(a) * d, rr(r0, r1) * S, ky, k0 + i * 7); } };
  lay(9, 16.5, 10, 13, 5.4, 6.8, 0.7, 100); lay(8, 12, 14, 17, 5.8, 7.2, 0.74, 200); lay(5, 7.5, 18.5, 20.5, 5.6, 7.0, 0.76, 300); lay(3, 2.8, 22, 23.4, 5.0, 6.0, 0.76, 400); lay(3, 5, 12, 14, 5.6, 6.6, 0.55, 500);
  const nCard = Math.round(36 * S + 10);
  for (let i = 0; i < nCard; i++) {
    const a = r() * 2 * PI, h = rr(9, 22), d = (h < 15 ? rr(17.5, 20.5) : rr(11, 15) * Math.min(1.1, (25 - h) / 8.5)) * S, w = rr(2.8, 4.2) * S;
    panel('g_card', w, w * 0.75, { p: [cx + Math.cos(a) * d, gy + h * V, cz + Math.sin(a) * d], ry: PI / 2 - a + rr(-0.5, 0.5), rx: rr(-0.35, 0.15), c: h > 17 ? '#ffffee' : '#dcecc4', noao: true });
  }
}
const figWalls = (cx, cz, S) => ringWalls(cx, cz, 4.6 * S, 8);   // the trunk with its roots

// ====================================================================================================
// 1. Giardino Inglese: the public garden between Via Libertà and Via Dante: gravel walks, round flowerbeds, rows of palms, big figs on the lawns, benches; the Moorish pavilion (OSM w194087049):
// a yellow cube with a tall pointed arch in a carved white frame on each side, an iron grille, a white frieze and a crown of stepped merlons; the two ponds (OSM water polygons) with rims of
// rough stones, rock islands and jets, and in the southern one the bronze group of two children on a rock. Photos: Wikimedia Commons "Padiglione moresco.jpg", "Ingresso da Via Libertà.jpg",
// "Giochi acquatici nel Giardino Inglese, Palermo.jpg", "Palermo - panoramio - Dawid Glawdzin (1).jpg", "Fountain in Giardino Inglese, Palermo, Sicily, Italy (9456347445).jpg",
// "Giardino Inglese, Palermo, Sicily, Italy (9459124620).jpg".
// Not verified: which pond the children stand in (put in the southern one), the places of the jets and rocks, the sides of the pavilion not seen. The gates are not built (no photo of one read).
// ====================================================================================================
const GI_POLY = pairsOf([-943, -1968, -889, -1867, -920, -1848, -905, -1818, -871, -1751, -837, -1685, -830, -1672, -776, -1696, -772, -1690, -750, -1701, -748, -1694, -736, -1698, -734, -1699, -751, -1733, -770, -1759, -792, -1823, -722, -1855, -740, -1896, -714, -1911, -741, -1965, -759, -2000, -936, -2000, -959, -1993, -947, -1970]);
const GI_PAV = [[-803.4, -1836.8], [-800.8, -1828.6], [-808.3, -1827.2], [-810.4, -1834.9]];   // the Moorish pavilion (OSM w194087049)
const GI_PAVC = [-805.7, -1831.9];
const GI_WATER = [   // the two ponds (OSM water polygons, thinned): north, south
  pairsOf([-788.4, -1896.3, -783.3, -1891.1, -780.0, -1891.1, -774.0, -1893.4, -767.9, -1899.6, -766.7, -1904.8, -769.8, -1908.9, -773.2, -1910.3, -779.8, -1906.2, -783.4, -1901.3, -788.9, -1902.2, -791.5, -1901.1]),
  pairsOf([-830.7, -1793.8, -826.1, -1798.2, -827.9, -1805.1, -830.0, -1809.5, -836.6, -1810.7, -840.2, -1809.7, -844.8, -1805.4, -848.7, -1803.4, -850.7, -1800.3, -846.2, -1795.9, -838.8, -1791.5, -832.8, -1791.9]),
];
const GI_PONDS = [[-780, -1902, 18], [-838, -1799, 17]];
const GI_WALKS = [
  [[-838, -1686], [-848, -1715], [-860, -1748], [-868, -1776], [-862, -1806], [-846, -1830], [-824, -1846], [-803, -1866], [-788, -1884]],         // the main walk, from the south gate to the north pond
  [[-780, -1919], [-790, -1946], [-801, -1972], [-812, -1996]],                                                                                       // on to the north gate
  [[-797, -1834], [-778, -1838], [-756, -1850], [-734, -1862]],                                                                                       // from the bandstand to the east gate
  [[-868, -1776], [-846, -1762], [-820, -1756], [-792, -1760], [-772, -1752]],                                                                         // a cross walk to the east lawn
  [[-846, -1830], [-872, -1850], [-890, -1872]],                                                                                                      // and one to the west gate
  [[-737, -1912], [-752, -1909], [-762.5, -1906]],                                                                                                    // the east gate to the north pond
];
const GI_OK = (x, z) => inPoly(GI_POLY, x, z);
const GI_MAIN = smoothPts(GI_WALKS[0], 4);
// the planting is decided once (the collision is read before the model is built): palms along the main walk and round the ponds, big ficus on the lawns, benches along the walk
const GI_PLAN = (() => {
  const r = RNG(951), palms = [], figs = [], benches = [], walls = [];
  const palmAt = (x, z, h) => { if (!GI_OK(x, z)) return; palms.push({ x, z, h, r: r() * 3 }); walls.push(...sqWalls(x, z, 0.3)); };
  const main = GI_MAIN, nrm = (i) => { const a = main[i - 1], b = main[i + 1], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [-tz / l, tx / l]; };
  for (let i = 3; i < main.length - 3; i += 6) { const [nx, nz] = nrm(i); for (const sg of [-1, 1]) palmAt(main[i][0] + nx * sg * 5.5, main[i][1] + nz * sg * 5.5, 9 + r() * 5); }
  for (const [px, pz, rr] of GI_PONDS) for (let i = 0; i < 6; i++) { const a = i * PI / 3 + 0.5; palmAt(px + Math.cos(a) * (rr + 5), pz + Math.sin(a) * (rr + 5), 8 + r() * 6); }
  for (const [x, z, sc] of [[-810, -1790, 0.62], [-870, -1735, 0.5], [-775, -1960, 0.6], [-835, -1900, 0.5], [-770, -1800, 0.55]]) if (GI_OK(x, z) && GI_OK(x + 12, z) && GI_OK(x - 12, z) && GI_OK(x, z + 12) && GI_OK(x, z - 12)) { figs.push({ x, z, s: sc, seed: Math.round(Math.abs(x + z)) }); walls.push(...figWalls(x, z, sc)); }
  for (let i = 8; i < main.length - 4; i += 11) { const [nx, nz] = nrm(i), sg = (i / 11 | 0) % 2 ? 1 : -1; benches.push([main[i][0] + nx * sg * 2.5, main[i][1] + nz * sg * 2.5, -nx * sg, -nz * sg]); }
  for (const P of GI_WATER) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; walls.push([a[0], a[1], b[0], b[1]]); }   // the stone rim of a pond (the pavilion keeps the walls of its footprint)
  return { palms, figs, benches, walls };
})();
function paintGiPav(g, w, h) {   // one side of the pavilion, 8 x 7.4 m
  const sx = w / 8, sy = h / 7.4, X = (u) => (u + 4) * sx, Y = (y) => h - y * sy, WH = '#ece6d8', YE = '#e3bd6e';
  g.fillStyle = YE; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 200, 2, 921, ['rgba(120,80,30,0.12)', 'rgba(255,240,200,0.14)']);
  const arch = (hw, y0, ys, top) => { g.beginPath(); g.moveTo(X(-hw), Y(y0)); g.lineTo(X(-hw), Y(ys)); g.bezierCurveTo(X(-hw * 1.14), Y(ys + (top - ys) * 0.6), X(-hw * 0.42), Y(top - 0.35), X(0), Y(top)); g.bezierCurveTo(X(hw * 0.42), Y(top - 0.35), X(hw * 1.14), Y(ys + (top - ys) * 0.6), X(hw), Y(ys)); g.lineTo(X(hw), Y(y0)); g.closePath(); };
  g.fillStyle = WH; arch(2.15, 0, 3.55, 6.05); g.fill();
  g.fillStyle = 'rgba(120,108,88,0.45)'; for (let i = 0; i < 90; i++) { const q = i / 90 * PI, rx = Math.cos(q) * 1.9, ry = 3.6 + Math.sin(q) * 2.1; g.fillRect(X(rx), Y(ry), 2, 2); } for (const s of [-1, 1]) for (let y = 0.4; y < 3.3; y += 0.22) g.fillRect(X(s * 1.85) - 2, Y(y), 4, 2);
  g.fillStyle = '#c9a458'; arch(1.55, 0, 3.55, 5.4); g.fill(); g.fillStyle = '#221c18'; arch(1.35, 0, 3.55, 5.2); g.fill();
  g.save(); arch(1.35, 0, 3.55, 5.2); g.clip(); g.strokeStyle = '#8a8c86'; g.lineWidth = 1.2; for (let u = -1.35; u <= 1.36; u += 0.45) { g.beginPath(); g.moveTo(X(u), Y(0)); g.lineTo(X(u), Y(3.55)); g.stroke(); } for (let a = 0; a <= 8; a++) { const q = a * PI / 8; g.beginPath(); g.moveTo(X(0), Y(3.55)); g.lineTo(X(Math.cos(q) * 2), Y(3.55 + Math.sin(q) * 2)); g.stroke(); } for (const y of [1.2, 2.4, 3.55]) { g.beginPath(); g.moveTo(X(-1.35), Y(y)); g.lineTo(X(1.35), Y(y)); g.stroke(); } g.beginPath(); g.arc(X(0), Y(3.55), 0.8 * sx, PI, 0); g.stroke(); g.restore();
  g.fillStyle = WH; g.fillRect(0, Y(6.95), w, 0.6 * sy); g.fillStyle = 'rgba(120,108,88,0.4)'; for (let x = 2; x < w; x += 6) g.fillRect(x, Y(6.82), 3, 0.34 * sy);
  g.fillStyle = '#c9a458'; g.fillRect(0, Y(7.4), w, 0.14 * sy);
  streaks(g, w, h, 10, 922, 0.1, 70);
}
function giPavilion() {
  defMat('giPav', 192, 192, [8, 7.4], paintGiPav);
  const gr = groundRange(GI_PAV), gy = gr.hi + 0.05, H = 7.4;
  prism('flat', GI_PAV, gr.lo - 0.8, gy + H, { c: '#e9c67c' });
  const merlon = new THREE.Shape(); [[-0.42, 0], [0.42, 0], [0.42, 0.32], [0.24, 0.32], [0.24, 0.55], [0, 0.82], [-0.24, 0.55], [-0.24, 0.32], [-0.42, 0.32]].forEach(([x, y], i) => i ? merlon.lineTo(x, y) : merlon.moveTo(x, y));
  for (let i = 0; i < 4; i++) {
    const a = GI_PAV[i], b = GI_PAV[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); let nx = dz / L, nz = -dx / L;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (nx * (mx - GI_PAVC[0]) + nz * (mz - GI_PAVC[1]) < 0) { nx = -nx; nz = -nz; }
    const M = frame(mx, gy, mz, nx, nz);
    panel('giPav', L, H, { M: mul(M, tr(0, 0, 0.03)), noao: true });
    for (const sg of [-1, 1]) { const u = sg * L * 0.23; cyl('flat', 0.12, 0.14, 3.4, 6, { M, p: [u, 0, 0.14], c: '#f2ede0', open: true, noao: true }); bx('flat', M, u - 0.22, u + 0.22, 3.4, 3.65, 0.0, 0.32, { c: '#f2ede0', noao: true }); }
    bx('flat', M, -L / 2 - 0.12, L / 2 + 0.12, H - 0.12, H + 0.1, -0.2, 0.18, { c: '#f2ede0', noao: true });
    const n = 6; for (let k = 0; k < n; k++) extrude('flat', merlon, 0.25, { M: mul(M, tr(-L / 2 + (k + 0.5) * L / n, H + 0.1, -0.2)), s: [L / n / 1.05, 1, 1], c: '#e6c47e', noao: true });
  }
}
// a pond: still water a little over the lawn, a rim of rough stones along its edge, rock islands and jets; k = 1 (south) has the two bronze children
function giPond(P, k) {
  const r = RNG(961 + k), gr = groundRange(P), wl = gr.hi + 0.3;
  const cx = P.reduce((q, p) => q + p[0], 0) / P.length, cz = P.reduce((q, p) => q + p[1], 0) / P.length;
  prism('flat', P, gr.lo - 0.3, wl, { c: '#5d7f62' });
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.2));
    for (let q = 0; q < n; q++) { const t = (q + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, s = 0.5 + r() * 0.36; blob('flat', x, wl - 0.1 + r() * 0.12, z, s, { ky: 0.65 + r() * 0.4, seed: i * 31 + q, det: 0, jit: 0.5, ry: r() * 6, c: r() < 0.35 ? '#827861' : r() < 0.6 ? '#6a6250' : '#524d40' }); }
  }
  const jet = (x0, y0, z0, x1, y1, z1, top) => part('flat', tubeGeo([0, 0.25, 0.5, 0.75, 1].map(t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 4 * top * t * (1 - t), z0 + (z1 - z0) * t]), 0.035), { c: '#e4f2f2', noao: true });
  // the rock in the middle with its high spray
  const rx = k ? -837 : cx, rz = k ? -1801.5 : cz;
  for (let i = 0; i < 4; i++) blob('flat', rx + (i - 1.5) * 0.35, wl + 0.2 + i * 0.42, rz + (i % 2) * 0.3, 1.1 - i * 0.2, { ky: 0.8, seed: 40 + i, det: 0, jit: 0.5, c: '#575244' });
  for (let i = 0; i < 6; i++) { const a = i * PI / 3 + 0.3; jet(rx, wl + 1.7, rz, rx + Math.cos(a) * 2.6, wl, rz + Math.sin(a) * 2.6, 1.6 + (i % 2) * 0.7); }
  if (!k) return;
  // two bronze children on a rock, one bending, one behind with the hands on its back
  const gx = -842.2, gz = -1800.2, M = frame(gx, wl, gz, -0.55, 0.83), C = '#4a4a3c';
  bx('flat', M, -1.2, 1.2, -0.4, 0.22, -1.2, 1.2, { c: '#a89c80', noao: true });
  blob('flat', gx, wl + 0.45, gz, 0.9, { ky: 0.6, seed: 51, det: 0, jit: 0.45, c: '#4e4c40' });
  const limb = (pts, w) => part('flat', tubeGeo(pts, w), { M, c: C, noao: true }), head = (x, y, z) => sphere('flat', 0.17, { M, p: [x, y - 0.17, z], c: C, noao: true, seg: 6 });
  limb([[0, 1.35, 0.05], [0, 1.65, 0.4]], 0.17); head(0, 1.9, 0.58); for (const s of [-1, 1]) { limb([[s * 0.1, 1.35, 0.05], [s * 0.22, 1.1, 0.4], [s * 0.22, 0.8, 0.25]], 0.075); limb([[s * 0.15, 1.65, 0.38], [s * 0.28, 1.3, 0.65], [s * 0.3, 0.95, 0.75]], 0.055); }
  limb([[0, 1.55, -0.45], [0, 2.1, -0.28]], 0.16); head(0, 2.45, -0.18); for (const s of [-1, 1]) { limb([[s * 0.1, 1.55, -0.45], [s * 0.18, 1.1, -0.35], [s * 0.2, 0.75, -0.5]], 0.075); limb([[s * 0.15, 2.05, -0.3], [s * 0.22, 1.8, -0.02], [s * 0.14, 1.68, 0.2]], 0.05); }
  for (const [x, z] of [[-846.5, -1802.5], [-835, -1795], [-831.5, -1806.5], [-840, -1807.5]]) jet(x, wl, z, (x + rx) / 2, wl, (z + rz) / 2, 3.2);
}
function buildGiardino() {
  initShared(); gardenMats();
  const gy = groundY(-835, -1830); begin(gy);
  const ok = GI_OK;
  // walks: gravel strips, 3.4 m wide, and a ring walk round each pond and the pavilion
  for (const w of GI_WALKS) { const line = smoothPts(w, 6).filter(p => ok(p[0], p[1])); if (line.length > 2) ribbon('g_gravel', line, 3.4, 0.2); }
  for (const [px, pz, rr] of GI_PONDS) ribbon('g_gravel', circlePts(px, pz, rr, 30), 3.0, 0.2);
  ribbon('g_gravel', circlePts(GI_PAVC[0], GI_PAVC[1], 9.5, 22), 2.6, 0.2);
  giPavilion();
  GI_WATER.forEach((P, k) => giPond(P, k));
  for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8, x = GI_PAVC[0] + Math.cos(a) * 15, z = GI_PAVC[1] + Math.sin(a) * 15; if (ok(x, z)) cyl('g_bed', 2.4, 2.6, 0.32, 14, { p: [x, groundY(x, z) - 0.04, z], c: i % 2 ? '#ffffff' : '#f4e0d8', noao: true, uv: 'world' }); }
  // flowerbeds: long beds at the south gate, round ones at the walk crossings
  for (const [x, z, a, l] of [[-852, -1704, -0.2, 11], [-826, -1706, 0.2, 11], [-830, -1740, -0.15, 8]]) {
    const M = frame(x, groundY(x, z), z, Math.cos(a + 1.57), Math.sin(a + 1.57));
    if (ok(x, z)) bx('g_bed', M, -1.4, 1.4, -0.04, 0.3, -l / 2, l / 2, { noao: true });
  }
  for (const [x, z] of [[-868, -1760], [-858, -1790], [-800, -1760], [-815, -1853], [-759, -1850], [-796, -1945], [-770, -1925]]) if (ok(x, z)) cyl('g_bed', 2.6, 2.8, 0.34, 14, { p: [x, groundY(x, z) - 0.04, z], noao: true, uv: 'world' });
  for (const q of GI_PLAN.palms) palm(q.x, groundY(q.x, q.z) - 0.1, q.z, q.h, { r: q.r });
  for (const f of GI_PLAN.figs) ficus(f.x, f.z, f.s, f.seed);
  for (const [x, z, fx, fz] of GI_PLAN.benches) bench(x, z, fx, fz);
  return end('Giardino Inglese');
}
export const GIARDINO_INGLESE = { name: 'Giardino Inglese', x: -835, z: -1830, radius: 175, skipIds: ['w194087049'], build: buildGiardino, walls: GI_PLAN.walls };

// ====================================================================================================
// 2. Villa Garibaldi (Piazza Marina): the two giant fig trees of the garden, each one huge tree of buttress trunk, limbs and a curtain of aerial roots
// ====================================================================================================
const VG_FIGS = [[648, -224, 1.3, 11], [704, -168, 0.85, 12]];
function buildVillaGaribaldi() {
  initShared(); gardenMats();
  begin(groundY(650, -222));
  for (const [x, z, sc, sd] of VG_FIGS) ficus(x, z, sc, sd);
  return end('Villa Garibaldi, ficus');
}
export const VILLA_GARIBALDI = { name: 'Villa Garibaldi (giant ficus)', x: 672, z: -200, radius: 75, skipIds: [], build: buildVillaGaribaldi, walls: VG_FIGS.flatMap(([x, z, sc]) => figWalls(x, z, sc)) };

// ====================================================================================================
// 3. Stazione Centrale, the front on Piazza Giulio Cesare. From the photos (Wikimedia Commons "Palermo - Stazione Centrale.jpg", "StazioneFS Palermo.JPG", "Piazza Giulio Cesare e la stazione
// centrale di Palermo - Flickr - Rino Porrovecchio.jpg", "Stazione Centrale, Palermo, Sicily, Italy (9455608403).jpg"; Mapillary 958041995026440 and 834283047190944): a deep arcade on piers of
// weathered tufa with pale marble feet runs along the foot; the end pavilions (3 bays) and the centre (5 bays) have two floors of paired arched windows under larger arches, between columns, with
// balustrades; the two links (3 bays) have three great arched windows and, set back behind a terrace, a lower top floor with small arched windows; heavy cornices; flat roofs with a balustrade on
// the end pavilions; on the centre an attic with the clock under a round crown; two flagpoles. Pink-ochre plaster and stone.
// Not verified: the sides beyond the first three bays and the platforms (kept as plain wings), the back wall inside the arcade, the sculpture under the clock floor (a plain dark relief), exact
// heights (read off the photos). The long bus shelter on the pavement is not built. The ring outline is the OSM relation r1223249; its notches are the set-back top floor of the links.
// ====================================================================================================
const ST_P = pairsOf([457.4, 639.4, 469.9, 632.4, 472.4, 636.7, 484.4, 629.9, 481.6, 625.0, 490.0, 620.3, 500.6, 614.2, 502.9, 618.1, 514.1, 611.8, 511.4, 607.2, 524.6, 599.8, 544.8, 635.0, 549.3, 632.4, 554.2, 641.1, 560.8, 652.4, 558.0, 654.0, 578.2, 689.0, 575.7, 690.4, 573.5, 691.7, 562.1, 698.1, 541.9, 663.0, 539.3, 658.4, 502.8, 679.1, 505.4, 683.6, 526.4, 720.1, 516.2, 725.9, 511.5, 728.5, 491.3, 693.3, 486.6, 696.0, 480.9, 686.2, 475.4, 676.7, 480.7, 673.7, 467.2, 650.1, 464.5, 651.7]);
const ST_H = pairsOf([482.4, 642.2, 517.6, 622.0, 532.2, 647.2, 497.0, 667.4]);
const ST = { F0: [457.4, 639.4], F1: [524.6, 599.8], HW: 16.8, ARC: 3.4, DEPTH: 15 };
const ST_L = Math.hypot(ST.F1[0] - ST.F0[0], ST.F1[1] - ST.F0[1]), ST_U = [(ST.F1[0] - ST.F0[0]) / ST_L, (ST.F1[1] - ST.F0[1]) / ST_L];
const ST_MID = [(ST.F0[0] + ST.F1[0]) / 2, (ST.F0[1] + ST.F1[1]) / 2];
// outward normal (towards the garden of Piazza Giulio Cesare, the north-west); for u = (0.862, -0.508) this is (-0.508, -0.862). Local +x of the front runs from the north-east end to the south-west one.
const ST_NX = ST_U[1], ST_NZ = -ST_U[0];
// the five parts of the front: local x range, front plane, bays, kind (pavilions and centre 'p', links 'l')
const ST_SEC = [[-39, -24, 0.9, 3, 'p'], [-24, -11, 0.4, 3, 'l'], [-11, 11, 1.0, 5, 'p'], [11, 24.7, 0.4, 3, 'l'], [24.7, 39, 0.9, 3, 'p']];
// atlas cells (1024 x 256): paired windows, great arch, small arch, arcade door, clock
const ST_CELL = { pair: [0, 192], great: [192, 192], small: [384, 192], door: [576, 192], clock: [768, 256] };
function paintStAtlas(g) {
  const r = RNG(1701), WALL = '#d3b293', TRIM = '#e8d8bd', SHUT = '#4c3426';
  const arch = (x0, x1, yb, ys) => { const rad = (x1 - x0) / 2; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0, ys); g.arc(x0 + rad, ys, rad, PI, 0); g.lineTo(x1, yb); g.closePath(); };
  const ground = (x, w, c) => { g.fillStyle = c; g.fillRect(x, 0, w, 256); for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(110,75,50,0.10)' : 'rgba(255,240,215,0.10)'; g.fillRect(x + r() * (w - 3), r() * 253, 1 + r() * 3, 1 + r() * 3); } };
  const louvres = (x0, x1, y0, y1) => { g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = y0; y < y1; y += 5) g.fillRect(x0, y, x1 - x0, 1.5); g.fillStyle = 'rgba(255,225,190,0.18)'; g.fillRect((x0 + x1) / 2 - 1, y0, 2, y1 - y0); };
  // two narrow shuttered windows under one great arch with a roundel in its head
  { const x = ST_CELL.pair[0]; ground(x, 192, WALL);
    g.fillStyle = TRIM; arch(x + 20, x + 172, 256, 104); g.fill(); g.fillStyle = '#c9a585'; arch(x + 29, x + 163, 256, 104); g.fill();
    g.fillStyle = TRIM; g.beginPath(); g.arc(x + 96, 66, 13, 0, 7); g.fill(); g.fillStyle = '#9d7c60'; g.beginPath(); g.arc(x + 96, 66, 7, 0, 7); g.fill();
    for (const [a, b] of [[33, 88], [104, 159]]) { g.fillStyle = TRIM; arch(x + a - 4, x + b + 4, 232, 122); g.fill(); g.fillStyle = SHUT; arch(x + a, x + b, 232, 122); g.fill(); g.save(); g.clip(); g.fillStyle = '#28303a'; g.fillRect(x + a, 92, b - a, 30); louvres(x + a, x + b, 122, 232); g.restore(); }
    g.fillStyle = TRIM; g.fillRect(x + 90, 118, 12, 114); g.fillRect(x + 84, 114, 24, 8); g.fillStyle = 'rgba(80,50,30,0.35)'; g.fillRect(x + 100, 122, 2, 110);
    g.fillStyle = TRIM; g.fillRect(x, 232, 192, 24); }
  // one great arched window with a pale transom
  { const x = ST_CELL.great[0]; ground(x, 192, WALL);
    g.fillStyle = TRIM; arch(x + 14, x + 178, 238, 114); g.fill(); g.fillStyle = '#34414e'; arch(x + 26, x + 166, 232, 114); g.fill(); g.save(); g.clip();
    const gr = g.createLinearGradient(0, 40, 0, 232); gr.addColorStop(0, 'rgba(180,205,225,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(x + 26, 40, 140, 192);
    g.fillStyle = '#c9a766'; g.fillRect(x + 26, 112, 140, 5); g.fillStyle = '#1d242c'; g.fillRect(x + 94, 117, 4, 115); g.restore();
    g.fillStyle = TRIM; g.fillRect(x + 88, 28, 16, 22); g.fillRect(x, 238, 192, 18); }
  // the small arched window of the set-back top floor of the links
  { const x = ST_CELL.small[0]; ground(x, 192, WALL);
    g.fillStyle = TRIM; arch(x + 52, x + 140, 232, 112); g.fill(); g.fillStyle = SHUT; arch(x + 61, x + 131, 226, 112); g.fill(); g.save(); g.clip(); g.fillStyle = '#28303a'; g.fillRect(x + 61, 70, 70, 42); louvres(x + 61, x + 131, 112, 226); g.restore();
    g.fillStyle = TRIM; g.fillRect(x + 40, 228, 112, 10); g.fillRect(x + 86, 56, 20, 16); }
  // inside the arcade: a tall arched door in shadow with a lamp over it
  { const x = ST_CELL.door[0]; ground(x, 192, '#a98c6a');
    g.fillStyle = '#c3aa86'; arch(x + 30, x + 162, 256, 138); g.fill(); g.fillStyle = '#241c17'; arch(x + 42, x + 150, 256, 138); g.fill();
    g.strokeStyle = '#6a5440'; g.lineWidth = 3; for (let a = 0; a <= 6; a++) { const q = PI + a * PI / 6; g.beginPath(); g.moveTo(x + 96, 138); g.lineTo(x + 96 + Math.cos(q) * 52, 138 + Math.sin(q) * 52); g.stroke(); }
    g.fillStyle = '#4a3324'; g.fillRect(x + 50, 142, 44, 114); g.fillRect(x + 98, 142, 44, 114);
    g.fillStyle = '#f2c46a'; g.beginPath(); g.arc(x + 96, 70, 7, 0, 7); g.fill();
    const gt = g.createLinearGradient(0, 0, 0, 120); gt.addColorStop(0, 'rgba(20,12,6,0.5)'); gt.addColorStop(1, 'rgba(20,12,6,0)'); g.fillStyle = gt; g.fillRect(x, 0, 192, 120); }
  // the clock
  { const x = ST_CELL.clock[0], cx = x + 128, cy = 128; g.fillStyle = TRIM; g.fillRect(x, 0, 256, 256);
    g.fillStyle = '#3a3029'; g.beginPath(); g.arc(cx, cy, 124, 0, 7); g.fill(); g.fillStyle = '#eef2ee'; g.beginPath(); g.arc(cx, cy, 108, 0, 7); g.fill();
    g.strokeStyle = '#1f2830'; g.lineWidth = 9; for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(cx + Math.sin(a) * 78, cy - Math.cos(a) * 78); g.lineTo(cx + Math.sin(a) * 100, cy - Math.cos(a) * 100); g.stroke(); }
    g.lineCap = 'round'; g.lineWidth = 12; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 56, cy - 14); g.stroke(); g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 10, cy - 86); g.stroke(); }
  streaks(g, 768, 256, 26, 1702, 0.10, 110, '70,44,28');
}
function paintStTufa(g, w, h) {   // the weathered tufa of the arcade: 3.2 x 3.2 m, six courses with deep joints
  g.fillStyle = '#ab9069'; g.fillRect(0, 0, w, h); const r = RNG(1705), ch = h / 6;
  for (let j = 0; j < 6; j++) { let x = (j % 2) * w / 6; for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '80,58,34' : '224,198,158'},${0.1 + r() * 0.2})`; g.fillRect(x % w, j * ch, w / 3, ch); g.fillStyle = 'rgba(62,44,26,0.55)'; g.fillRect((x + w / 3) % w, j * ch, 2, ch); x += w / 3; }
    g.fillStyle = 'rgba(62,44,26,0.7)'; g.fillRect(0, j * ch, w, 3); g.fillStyle = 'rgba(240,222,190,0.35)'; g.fillRect(0, j * ch + 3, w, 1.5); }
  noiseDots(g, w, h, 500, 2.4, 1706, ['rgba(60,42,24,0.3)', 'rgba(236,214,176,0.22)']);
}
function paintStWing(g, w, h) {   // the side wings: plain plaster, a low arcaded foot, two rows of windows; 9.6 x 16.8 m repeat
  const W = 9.6, H = ST.HW;
  paintFacade(g, w, h, W, H, { seed: 1704, base: '#d0b092', trim: '#e6d6bb', glass: '#2d343d', bands: [{ y: 5.9, h: 0.5, c: '#e6d6bb' }, { y: 11.9, h: 0.4, c: '#e6d6bb' }, { y: H - 0.9, h: 0.9, c: '#e6d6bb' }],
    rows: [{ xs: [2.4, 7.2], y0: 0.5, y1: 4.8, w: 2.4, kind: 'arch', fr: 0.25, sill: false }, { xs: [2.4, 7.2], y0: 7.0, y1: 10.8, w: 1.4, kind: 'arch', fr: 0.2 }, { xs: [2.4, 7.2], y0: 12.7, y1: 15.2, w: 1.2, kind: 'arch', fr: 0.18, shut: 'open' }], shut: '#4c3426' });
}
// the arches of one part of the arcade: the wall above the piers with a half-round cut over every opening, as one outline (no holes)
function stArches(x0, x1, opens, y0, y1) {
  const s = new THREE.Shape(); s.moveTo(x0, y0);
  for (const [a, b] of opens) { s.lineTo(a, y0); s.absarc((a + b) / 2, y0, (b - a) / 2, PI, 0, true); }
  s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s;
}
function buildStazione() {
  initShared(); gardenMats();
  const gr = groundRange(ST_P), gy = gr.hi + 0.15, nx = ST_NX, nz = ST_NZ, lo = gr.lo - 1.5 - gy, D = ST.DEPTH;
  begin(gy);
  defMat('stzAtlas', 1024, 256, [1, 1], paintStAtlas);
  defMat('stzTufa', 128, 128, [3.2, 3.2], paintStTufa);
  defMat('stzStone', 64, 64, [3, 3], (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 90, 2, 1711, ['rgba(110,80,55,0.12)', 'rgba(255,250,240,0.2)']); });
  defMat('stzWing', 128, 224, [9.6, ST.HW], paintStWing);
  const M = frame(ST_MID[0], gy, ST_MID[1], nx, nz), at = (x, z) => { const q = wpt(ST_MID, nx, nz, x, z); return [r1(q[0]), r1(q[1])]; };
  const WALL = '#d3b293', TRIM = '#e8d8bd', DARK = '#8a6f56';
  // body and wings: the ring outline, its front cut back to the back wall of the arcade (and further under the terraces of the links)
  const zb = (sec) => sec[2] - ST.ARC, front = [];
  for (let i = ST_SEC.length - 1; i >= 0; i--) { const s = ST_SEC[i], z = s[4] === 'l' ? -5.4 : zb(s) - 0.05; front.push(at(s[1], z), at(s[0], z)); }
  shell('stzWing', front.concat(ST_P.slice(11)), [ST_H], gy, ST.HW, { lo: gr.lo - 1.5, roof: '#9b968b', cc: TRIM });
  // a textured cell on a panel
  const cell = (key, w, h, o) => { const c = ST_CELL[key]; panel('stzAtlas', w, h, { uvk: [c[1] / 1024, 1], uvo: [c[0] / 1024, 0], ...o }); };
  const slab = (x0, x1, y0, y1, z0, z1, c, o = {}) => bx('stzStone', M, x0, x1, y0, y1, z0, z1, { c, ...o });
  const column = (x, z, y0, y1) => { slab(x - 0.3, x + 0.3, y0, y0 + 1.0, z - 0.3, z + 0.25, TRIM, { noao: true }); cyl('stzStone', 0.17, 0.22, y1 - y0 - 1.3, 6, { M, p: [x, y0 + 1.0, z], open: true, c: '#e0cbac', noao: true }); slab(x - 0.28, x + 0.28, y1 - 0.3, y1, z - 0.3, z + 0.27, TRIM, { noao: true }); };
  for (const sec of ST_SEC) {
    const [x0, x1, zf, n, kind] = sec, bw = (x1 - x0) / n, pav = kind === 'p', back = zf - ST.ARC;
    // ---- the arcade: piers with marble feet, the arches over them, archivolts and roundels, the back wall with its doors
    const edge = (i) => i === 0 ? [x0, x0 + 0.85] : i === n ? [x1 - 0.85, x1] : [x0 + i * bw - 0.7, x0 + i * bw + 0.7], opens = [];
    for (let i = 0; i <= n; i++) {
      const [a, b] = edge(i);
      bx('stzTufa', M, a, b, lo, 3.55, zf - 0.9, zf);
      slab(a - 0.1, b + 0.1, lo, 1.05, zf - 1.0, zf + 0.1, '#dcd8ce');
      if (i < n) opens.push([b, edge(i + 1)[0]]);
      if (i > 0 && i < n) part('stzStone', new THREE.CircleGeometry(0.34, 8), { M, p: [x0 + i * bw, 5.25, zf + 0.02], c: TRIM, noao: true });
    }
    extrude('stzTufa', stArches(x0, x1, opens, 3.55, 6.4), 0.9, { M: mul(M, tr(0, 0, zf - 0.9)), cs: 8 });
    for (const [a, b] of opens) part('stzStone', new THREE.RingGeometry((b - a) / 2, (b - a) / 2 + 0.28, 8, 1, 0, PI), { M, p: [(a + b) / 2, 3.55, zf + 0.015], c: '#cdb590', noao: true });
    bx('stzTufa', M, x0, x1, lo, 6.4, back - 0.5, back, { c: '#c9b89a' });
    for (let i = 0; i < n; i++) cell('door', bw, 6.0, { M, p: [x0 + (i + 0.5) * bw, 0, back + 0.02], c: '#d8c8ae' });
    slab(x0, x1, lo, 0.04, back, zf - 0.9, '#bdb3a2', { noao: true });   // the floor of the arcade
    // ---- the floors above
    slab(x0, x1, 6.4, 12.7, pav ? -D : -5.4, zf, WALL);
    slab(x0 - 0.05, x1 + 0.05, 6.25, 6.75, zf - 0.5, zf + 0.35, TRIM, { noao: true });
    slab(x0 - 0.05, x1 + 0.05, 12.45, 12.95, zf - 0.5, zf + 0.4, TRIM, { noao: true });
    for (let i = 0; i < n; i++) cell(pav ? 'pair' : 'great', pav ? bw : bw - 0.1, 5.7, { M, p: [x0 + (i + 0.5) * bw, 6.75, zf + 0.025] });
    for (let i = 0; i < n; i++) balus(mul(M, tr(x0 + (i + 0.5) * bw, 6.75, zf + 0.2)), bw - 0.6, 0.95, { c: TRIM, noao: true });
    if (pav) {
      slab(x0, x1, 12.7, 18.3, -D, zf, WALL);
      slab(x0 - 0.05, x1 + 0.05, 18.0, 18.3, zf - 0.4, zf + 0.25, DARK, { noao: true });   // the shadow of the dentils
      slab(x0 - 0.35, x1 + 0.35, 18.3, 19.0, -D - 0.2, zf + 0.6, TRIM, { noao: true });
      for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * bw; cell('pair', bw, 5.05, { M, p: [x, 12.95, zf + 0.025] }); balus(mul(M, tr(x, 12.95, zf + 0.2)), bw - 0.6, 0.95, { c: TRIM, noao: true }); }
      for (let i = 0; i <= n; i++) { const x = i === 0 ? x0 + 0.32 : i === n ? x1 - 0.32 : x0 + i * bw; column(x, zf + 0.22, 6.75, 12.45); column(x, zf + 0.22, 12.95, 18.0); }
    } else {
      for (let i = 0; i <= n; i++) { const x = Math.min(x1 - 0.2, Math.max(x0 + 0.2, x0 + i * bw)); slab(x - 0.18, x + 0.18, 6.75, 12.45, zf, zf + 0.18, TRIM, { noao: true }); }
      slab(x0, x1, 12.95, 13.9, zf - 0.35, zf + 0.05, '#dcc4a4', { noao: true });   // the parapet of the terrace
      slab(x0, x1, 12.7, 17.0, -D, -5.3, WALL);
      for (let i = 0; i < n; i++) cell('small', bw, 3.9, { M, p: [x0 + (i + 0.5) * bw, 12.9, -5.27] });
      slab(x0, x1, 16.75, 17.35, -5.8, -4.85, TRIM, { noao: true });
    }
  }
  // ---- the outer sides of the end pavilions, three bays back
  for (const sg of [-1, 1]) {
    const x = sg * 39.12, Ms = mul(M, mul(tr(x, 0, 0), rotY(sg * PI / 2))), zf = 0.9, bw = 4.9;
    for (let i = 0; i < 3; i++) {
      const z = zf - (i + 0.5) * bw, lx = -sg * z;
      cell('door', bw, 6.25, { M: Ms, p: [lx, 0, 0], c: '#e6d6bc' });
      cell('pair', bw, 5.7, { M: Ms, p: [lx, 6.75, 0] }); cell('pair', bw, 5.05, { M: Ms, p: [lx, 12.95, 0] });
    }
    bx('stzTufa', M, sg * 38.3, sg * 39.08, lo, 6.4, zf - 3 * bw, zf - ST.ARC);
    // the balustrade round the flat roof, with its posts
    const x0 = sg < 0 ? -39 : 24.7, x1 = sg < 0 ? -24 : 39;
    balus(mul(M, tr((x0 + x1) / 2, 19.0, 1.25)), x1 - x0 + 0.4, 1.15, { c: TRIM, noao: true });
    balus(mul(M, mul(tr(sg * 39.2, 19.0, -D / 2 + 0.6), rotY(sg * PI / 2))), D + 1.3, 1.15, { c: TRIM, noao: true });
    for (const px of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3]) slab(px - 0.3, px + 0.3, 19.0, 20.35, 0.95, 1.5, TRIM, { noao: true });
  }
  // ---- the attic of the centre, the clock between two scrolls under its round crown and finial, the relief under the middle cornice
  slab(-11, 11, 19.0, 20.6, -1.0, 1.15, '#d8bc9c', { noao: true });
  slab(-11.2, 11.2, 20.6, 20.95, -1.15, 1.4, TRIM, { noao: true });
  for (const x of [-10.5, -6.6, -2.9, 2.9, 6.6, 10.5]) slab(x - 0.28, x + 0.28, 19.0, 21.3, -0.6, 1.35, TRIM, { noao: true });
  slab(-2.2, 2.2, 20.95, 22.5, -0.6, 1.3, '#d8bc9c', { noao: true });
  extrude('stzStone', archShape(4.0, 2.0), 1.9, { M: mul(M, tr(0, 22.5, -0.6)), c: TRIM, noao: true, cs: 10 });
  { const c = ST_CELL.clock; part('stzAtlas', new THREE.CircleGeometry(1.35, 14), { M, p: [0, 22.55, 1.32], uv: 'keep', uvk: [c[1] / 1024, 1], uvo: [c[0] / 1024, 0], noao: true }); }
  for (const sg of [-1, 1]) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(sg * 2.0, 0); s.quadraticCurveTo(sg * 0.5, 0.35, 0, 1.7); s.lineTo(0, 0); extrude('stzStone', s, 0.5, { M: mul(M, tr(sg * 2.2, 20.95, 0.5)), c: TRIM, noao: true, cs: 5 }); }
  cone('stzStone', 0.5, 1.0, 6, { M, p: [0, 24.45, 0.4], c: TRIM, noao: true });
  bx('flat', M, -0.55, 0.55, 11.2, 12.45, 1.4, 1.55, { c: '#6a5c48', noao: true }); bx('flat', M, -0.95, 0.95, 11.85, 12.2, 1.4, 1.5, { c: '#6a5c48', noao: true });
  // ---- the two flagpoles on the terraces
  for (const sg of [-1, 1]) {
    const x = sg * 12.6; cyl('flat', 0.06, 0.09, 8.5, 4, { M, p: [x, 13.9, 0.2], c: '#7d9aa2', noao: true });
    if (sg > 0) ['#1f8a4c', '#f2efe8', '#cc3a34'].forEach((c, k) => bx('flat', M, x + 0.08 + k * 0.5, x + 0.58 + k * 0.5, 20.6, 22.2, 0.18, 0.22, { c, noao: true }));
    else bx('flat', M, x + 0.08, x + 1.58, 20.6, 22.2, 0.18, 0.22, { c: '#24509c', noao: true });
  }
  return end('Stazione Centrale');
}
const ST_WALLS = (() => {   // along the feet of the piers, and back down the two ends
  const out = [], pts = [[-39.3, -1.5], [-39.3, 1.02]];
  for (const [x0, x1, zf] of ST_SEC) pts.push([x0 === -39 ? -39.3 : x0, zf + 0.12], [x1 === 39 ? 39.3 : x1, zf + 0.12]);
  pts.push([39.3, -1.5]);
  for (let i = 0; i < pts.length - 1; i++) { const a = wpt(ST_MID, ST_NX, ST_NZ, ...pts[i]), b = wpt(ST_MID, ST_NX, ST_NZ, ...pts[i + 1]); if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.2) out.push([r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]); }
  return out;
})();
export const STAZIONE_CENTRALE = { name: 'Stazione Centrale', x: 513, z: 659, radius: 110, skipIds: ['r1223249.0'], build: buildStazione, walls: ST_WALLS };

// ====================================================================================================
// 4. Ponte dell'Ammiraglio (1131): seven pointed arches of grey-ochre rubble, a high hump, a parapet; the dry bed of the Oreto under it is gravel and rushes, and the garden round it has a
// low iron fence and agaves. The ground under it is the streamed terrain, the bed a draped strip.
// ====================================================================================================
const PONTE_A = [1219.8, 1221.3], PONTE_B = [1198.3, 1143.4];
function paintRubble(g, w, h) {   // irregular rubble in rough courses, ochre and grey, deep joints
  g.fillStyle = '#6f664f'; g.fillRect(0, 0, w, h); const r = RNG(1731);
  let y = 0;
  while (y < h) {
    const rh = 14 + r() * 16; let x = -r() * 30;
    while (x < w) {
      const rw = 16 + r() * 34, v = r(), c = v < 0.3 ? [168, 154, 118] : v < 0.6 ? [150, 142, 120] : v < 0.85 ? [182, 164, 120] : [130, 124, 108], k = 0.88 + r() * 0.24;
      g.fillStyle = `rgb(${c.map(q => Math.round(q * k))})`;
      for (const dx of [0, w, -w]) { g.beginPath(); g.roundRect ? g.roundRect(x + 1.5 + dx, y + 1.5, rw - 3, rh - 3, 4) : g.rect(x + 1.5 + dx, y + 1.5, rw - 3, rh - 3); g.fill(); }
      x += rw;
    }
    y += rh;
  }
  noiseDots(g, w, h, 1500, 2, 1732, ['rgba(40,34,24,0.18)', 'rgba(240,230,200,0.14)']);
}
function buildPonteAmm() {
  initShared(); gardenMats();
  const [a, b] = [PONTE_A, PONTE_B], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, gy = groundY(mx, mz);
  const M = frame(mx, gy, mz, -uz, ux);   // local x along the bridge
  begin(gy);
  defMat('g_rubble', 256, 256, [3.4, 3.4], paintRubble);
  const sp0 = [5.4, 7.2, 9.6, 12.0, 9.6, 7.2, 5.4], pier = 2.3, BW = 5.8, nA = sp0.length, sc = (L - pier * (nA + 1)) / sp0.reduce((q, v) => q + v, 0), spans = sp0.map(v => v * sc);
  let tot = pier; for (const s of spans) tot += s + pier;
  const hump = (xx) => 6.0 + 4.6 * Math.cos(xx / (tot / 2) * PI / 2);   // the deck is high enough over the widest arch for its pointed apex (a hole that breaks the outline of the extrusion fills with a pale lid)
  let x = -tot / 2;
  box('g_rubble', pier, hump(x + pier / 2), BW, { M, p: [x + pier / 2, 0, 0], c: '#e0d8b8' }); x += pier;
  for (const s of spans) {
    const cx = x + s / 2, H = hump(cx);
    archBay('g_rubble', s + pier, H, s, Math.max(s / 2 + 0.2, Math.min(H - 1.0 - 0.45 * s / 2, s * 0.92 + 0.5)), BW, { M: mul(M, tr(cx, 0, -BW / 2)), pointed: true, oy0: 0.1, c: '#ece4c6' });   // oy0: a hole that touches the bottom edge of the outline breaks the triangulation and fills with a pale lid
    x += s + pier;
  }
  // parapets that follow the hump, with a stone coping
  const NQ = 34;
  for (let q = 0; q < NQ; q++) {
    const x0 = -tot / 2 + q * tot / NQ, x1 = x0 + tot / NQ, y0 = hump(x0) + 0.25, y1 = hump(x1) + 0.25, len = Math.hypot(x1 - x0, y1 - y0), rz = Math.atan2(y1 - y0, x1 - x0);
    for (const sg of [-1, 1]) {
      box('g_rubble', len + 0.05, 1.0, 0.55, { M, p: [(x0 + x1) / 2, (y0 + y1) / 2, sg * (BW / 2 - 0.28)], rz, c: '#e4dcbc' });
      box('g_stone', len + 0.08, 0.14, 0.7, { M, p: [(x0 + x1) / 2, (y0 + y1) / 2 + 1.0, sg * (BW / 2 - 0.28)], rz, c: '#e6dfc8', noao: true });
    }
  }
  for (const sg of [-1, 1]) cyl('g_rubble', 1.2, 1.6, 6.0, 10, { M, p: [sg * (tot / 2 - 0.6), -0.4, BW / 2 - 0.1], c: '#e0d8b8' });   // the round masonry abutment at each end
  // the dry bed of the river: pale gravel with stones, 18 m wide across the bridge
  const bedC = [[mx - uz * 22, mz + ux * 22], [mx, mz], [mx + uz * 22, mz - ux * 22]];   // along the (local) z axis, crossing under the bridge
  ribbon('g_gravel', [[mx + uz * 26, mz - ux * 26], [mx + uz * 12, mz - ux * 12], [mx, mz], [mx - uz * 12, mz + ux * 12], [mx - uz * 26, mz + ux * 26]], 17, 0.2, 2.4);
  const rr = RNG(1741);
  for (let i = 0; i < 40; i++) { const t = (rr() - 0.5) * 50, s = (rr() - 0.5) * 16, X = mx + (-uz) * 0 + ux * s + uz * t, Z = mz + uz * s - ux * t; box('g_stone', 0.3 + rr() * 0.7, 0.25 + rr() * 0.3, 0.3 + rr() * 0.6, { p: [X, groundY(X, Z) - 0.05, Z], ry: rr() * 3, c: rr() < 0.5 ? '#bdb59c' : '#d3cbb2', noao: true }); }
  // agaves on the banks: rosettes of crossed stiff cards (the palm card, tinted blue-green), and a few fan-palm bushes
  const agave = (X, Z, s) => { const y = groundY(X, Z); for (let k = 0; k < 4; k++) panel('palm', 2.2 * s, 1.5 * s, { p: [X, y + 0.5 * s, Z], ry: k * PI / 4 + rr(), c: '#7fa08c', noao: true }); };
  for (let i = 0; i < 14; i++) { const t = (rr() - 0.5) * 70, s = (rr() < 0.5 ? -1 : 1) * (10 + rr() * 6); agave(mx + ux * s + uz * t, mz + uz * s - ux * t, 0.8 + rr() * 0.8); }
  const gend = end("Ponte dell'Ammiraglio");
  return gend;
}
const PONTE_WALLS = (() => {   // the piers and the abutments are masonry in the lawn; the deck is not driven on
  const [a, b] = [PONTE_A, PONTE_B], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, out = [];
  const nx = -uz, nz = ux, O = [mx, mz], BW = 5.8, nA = 7, pier = 2.3, sp0 = [5.4, 7.2, 9.6, 12.0, 9.6, 7.2, 5.4], sc = (L - pier * (nA + 1)) / sp0.reduce((q, v) => q + v, 0);
  let x = -L / 2;
  const cover = (x0, x1) => out.push(...rectSegs(O, nx, nz, x0, x1, -BW / 2, BW / 2));
  // piers: local x positions
  let tot = pier; for (const s of sp0) tot += s * sc + pier; x = -tot / 2; cover(x, x + pier); x += pier;
  for (const s of sp0) { x += s * sc; cover(x, x + pier); x += pier; }
  return out;
})();
export const PONTE_AMM = { name: "Ponte dell'Ammiraglio", x: 1209, z: 1182, radius: 70, skipIds: [], build: buildPonteAmm, walls: PONTE_WALLS };

// ====================================================================================================
// 5. Piazza Mondello: the open ground between the arcade block and the harbour road is paved (the terrain gets slabs from src/world.js, `pave`). In it the fountain of the Sirenetta
// (Nino Geraci, 1976): an eight-sided basin of pale stone with square posts at the corners on a low step, a mossy rock with the green bronze siren, both arms raised, and jets that arch in from the
// rim; round it a raised bed of grass inside a low black railing. Blue two-lantern lamp posts, big terracotta pots with small palms. Photos: Wikimedia Commons "Golfo di Mondello visto dalla piazza
// della Sirenetta.JPG"; a blog photo of the fountain (domodama.wordpress.com, "Piazza Mondello, fontana della Sirenetta", 2016); Mapillary 2019 532766781060630, 315804480007792, 822414035041616.
// Not verified: the sizes (the basin from the OSM water polygon), the exact places of the lamps and pots, what the siren holds. The works on the square begun in 2025 are not shown.
// ====================================================================================================
const MO_ZONE = [[-3080, -10159.5], [-3050, -10165], [-3023.8, -10170], [-3008.8, -10163.8], [-3008.8, -10157], [-3025, -10143], [-3038.8, -10132], [-3050.8, -10130.5]];
const MO_F = [-3037.5, -10160.7], MO_RING = 8.3;
const MO_POTS = [[-3045, -10137], [-3038, -10140.5], [-3030.5, -10144.5], [-3052.5, -10145], [-3057.5, -10155]];
const MO_LAMPS = [...[20, 110, 200, 290].map(d => [MO_F[0] + Math.cos(d * PI / 180) * 9.5, MO_F[1] + Math.sin(d * PI / 180) * 9.5]), [-3051, -10137], [-3022, -10153]];
function sirena(x, z) {
  const g0 = groundY(x, z), M = frame(x, g0, z, 0.35, 0.94);   // she looks out to sea
  cyl('flat', MO_RING - 0.2, MO_RING - 0.2, 0.27, 20, { p: [x, g0 - 0.05, z], c: '#5f8440', noao: true });
  lathe('g_stone', [[MO_RING + 0.15, 0], [MO_RING + 0.15, 0.3], [MO_RING - 0.25, 0.3], [MO_RING - 0.25, 0]], 20, { p: [x, g0 - 0.05, z], c: '#d8d0ba', noao: true });
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) * PI / 8, L = 2 * (MO_RING - 0.05) * Math.sin(PI / 16); rail(frame(x + Math.sin(a) * (MO_RING - 0.08), g0 + 0.25, z + Math.cos(a) * (MO_RING - 0.08), Math.sin(a), Math.cos(a)), L, 0.85, { noao: true }); }
  cyl('g_stone', 6.85, 7.0, 0.5, 8, { p: [x, g0 - 0.05, z], c: '#e2d6b8', noao: true, uv: 'world' });
  lathe('g_stone', [[6.0, 0.4], [6.35, 1.3], [5.6, 1.3], [5.55, 0.4]], 8, { p: [x, g0, z], c: '#eadcba', noao: true });
  for (let i = 0; i < 8; i++) { const a = i * PI / 4, px = x + Math.sin(a) * 6.15, pz = z + Math.cos(a) * 6.15; box('g_stone', 0.8, 1.05, 0.8, { p: [px, g0 + 0.4, pz], ry: a, c: '#f0e2c2', noao: true }); }
  cyl('flat', 5.75, 5.75, 0.08, 8, { p: [x, g0 + 1.0, z], c: '#6aa6a4', noao: true });
  // the rock
  blob('flat', x, g0 + 1.2, z, 1.5, { ky: 0.62, seed: 31, c: '#46503c', det: 0, jit: 0.4 });
  blob('flat', x + 0.8, g0 + 1.05, z - 0.5, 0.9, { ky: 0.6, seed: 32, c: '#4a5340', det: 0, jit: 0.4 });
  blob('flat', x - 0.7, g0 + 1.1, z + 0.4, 0.85, { ky: 0.7, seed: 33, c: '#5e6850', det: 0, jit: 0.4 });
  // the siren: the tail coiled on the rock, the trunk, the head with its hair, both arms raised with something in each hand
  const C = '#7d9c86', limb = (pts, r) => part('flat', tubeGeo(pts, r), { M, c: C, noao: true });
  limb([[0.95, 1.75, -0.35], [0.75, 2.2, 0.1], [0.3, 2.05, 0.35], [0, 2.3, 0.1], [0, 2.7, 0]], 0.2);
  part('flat', new THREE.LatheGeometry([[0.2, 0], [0.27, 0.15], [0.16, 0.5], [0.25, 0.82], [0.22, 1.0], [0.07, 1.08]].map(p => new THREE.Vector2(...p)), 7), { M, p: [0, 2.5, 0], s: [1, 1, 0.75], c: C, noao: true });
  sphere('flat', 0.19, { M, p: [0, 3.82, 0.02], ky: 1.15, c: C, noao: true, seg: 7 });
  sphere('flat', 0.2, { M, p: [0, 3.78, -0.14], ky: 1.3, c: '#66826e', noao: true, seg: 6 });
  for (const sg of [-1, 1]) {
    limb([[sg * 0.22, 3.42, 0], [sg * 0.68, 3.66, 0.05], [sg * 0.82, 4.1, 0.1], [sg * 0.86, 4.35, 0.12]], 0.085);
    sphere('flat', 0.13, { M, p: [sg * 0.88, 4.45, 0.13], ky: sg > 0 ? 1.5 : 0.7, c: '#6f8c78', noao: true, seg: 5 });
  }
  // the jets
  for (let i = 0; i < 10; i++) {
    const a = (i + 0.5) * PI / 5, s = Math.sin(a), c = Math.cos(a), pts = [[5.3, 1.1], [4.5, 2.05], [3.6, 2.3], [2.8, 1.95], [2.2, 1.05]].map(([r, y]) => [x + s * r, g0 + y, z + c * r]);
    part('flat', tubeGeo(pts, 0.028), { c: '#eef8fa', noao: true });
  }
}
function pot(x, z, k) {
  const y = groundY(x, z);
  cyl('flat', 0.62, 0.42, 0.85, 8, { p: [x, y, z], c: '#b5643f', noao: true });
  cyl('trunk', 0.09, 0.13, 1.0, 5, { p: [x, y + 0.75, z], noao: true });
  for (let a = 0; a < 3; a++) panel('palm', 1.9, 1.35, { p: [x, y + 1.45, z], ry: a * PI / 3 + k, noao: true });
}
function buildPiazzaMondello() {
  initShared(); gardenMats();
  const gy = groundY(-3037, -10150); begin(gy);
  sirena(MO_F[0], MO_F[1]);
  MO_POTS.forEach(([x, z], k) => pot(x, z, k * 0.4));
  for (const [x, z] of MO_LAMPS) lampPost(x, groundY(x, z), z, Math.atan2(x - MO_F[0], z - MO_F[1]));
  return end('Piazza Mondello');
}
export const PIAZZA_MONDELLO = { name: 'Piazza Mondello', x: -3040, z: -10150, radius: 55, skipIds: [], build: buildPiazzaMondello, walls: [...ringWalls(MO_F[0], MO_F[1], MO_RING + 0.15, 16, 0), ...MO_POTS.flatMap(([x, z]) => sqWalls(x, z, 0.55))], pave: [MO_ZONE] };

// ----------------------------------------------------------------------------------------------------
// San Girolamo, the church of the borgata on the harbour: a flat-topped white front as tall as a tower, a yellow cornice and a small iron cross on top; three round-arched belfry openings with
// yellow arches and railings, a clock, and a tall yellow frame round a niche with its picture over the door; behind it the lower nave in yellow plaster with two rows of windows.
// Photos: Wikimedia Commons "Palermo - Chiesa di San Girolamo - 2025-09-09 16-50-47 001.JPG" and "... 16-55-12 001.JPG"; Mapillary 2019 221098799476594, 318939029622861.
// Not verified: the picture in the niche, the rear and the north side, heights (read off the photos). The festival lights of the 2025 photo are left out.
// ----------------------------------------------------------------------------------------------------
const CH = { W: 7.7, D: 19.6, HT: 14.4, HN: 11.2, DT: 5.0 };
function paintChFront(g, w, h) {   // 7.7 x 14.4 m
  const sx = w / CH.W, sy = h / CH.HT, X = (s) => (s + CH.W / 2) * sx, Y = (y) => h - y * sy, YE = '#dfae3a', WH = '#f4f1e8';
  g.fillStyle = WH; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 260, 2, 1801, ['rgba(120,110,90,0.08)', 'rgba(255,255,255,0.16)']);
  const arch = (cx, hw, y0, ys) => { g.beginPath(); g.moveTo(X(cx - hw), Y(y0)); g.lineTo(X(cx - hw), Y(ys)); g.arc(X(cx), Y(ys), hw * sx, PI, 0); g.lineTo(X(cx + hw), Y(y0)); g.closePath(); };
  g.fillStyle = YE; g.fillRect(0, Y(CH.HT - 0.1), w, 0.55 * sy); g.fillRect(0, Y(0.5), w, 0.5 * sy);
  for (const cx of [-1.9, 0, 1.9]) { g.fillStyle = YE; arch(cx, 0.72, 10.9, 12.45); g.fill(); g.fillStyle = '#2c333a'; arch(cx, 0.55, 10.95, 12.45); g.fill(); }
  g.fillStyle = YE; g.fillRect(X(-3.0), Y(11.05), 6.0 * sx, 0.18 * sy);
  g.fillStyle = YE; g.beginPath(); g.arc(X(0), Y(9.85), 0.68 * sx, 0, 7); g.fill(); g.fillStyle = '#f6f2e4'; g.beginPath(); g.arc(X(0), Y(9.85), 0.52 * sx, 0, 7); g.fill();
  g.strokeStyle = '#33302a'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), Y(9.85)); g.lineTo(X(0), Y(10.27)); g.moveTo(X(0), Y(9.85)); g.lineTo(X(0.26), Y(9.73)); g.stroke();
  g.fillStyle = YE; g.fillRect(X(-2.75), Y(8.95), 5.5 * sx, 0.6 * sy); g.fillRect(X(-2.75), Y(8.4), 1.0 * sx, 8.4 * sy); g.fillRect(X(1.75), Y(8.4), 1.0 * sx, 8.4 * sy);
  g.fillStyle = YE; arch(0, 1.0, 5.0, 6.55); g.fill(); g.fillStyle = '#7c5a36'; arch(0, 0.72, 5.2, 6.55); g.fill();
  g.fillStyle = '#d9a64a'; arch(0, 0.5, 5.35, 6.45); g.fill(); g.fillStyle = '#8a3a2c'; g.fillRect(X(-0.22), Y(6.35), 0.44 * sx, 0.95 * sy); g.fillStyle = '#e8c9a0'; g.beginPath(); g.arc(X(0), Y(6.55), 0.16 * sx, 0, 7); g.fill();
  g.fillStyle = '#d8d2c4'; g.fillRect(X(-1.2), Y(3.75), 2.4 * sx, 3.75 * sy); g.fillStyle = '#3b2a1e'; g.fillRect(X(-0.95), Y(3.45), 1.9 * sx, 3.45 * sy); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X(-0.02), Y(3.45), 2, 3.45 * sy);
  streaks(g, w, h, 12, 1802, 0.07, 90);
}
function paintChSide(g, w, h) {   // one 7.3 m length of the nave flank, 11.2 m high: yellow, small windows over tall arched ones
  const sx = w / 7.3, sy = h / CH.HN, X = (s) => s * sx, Y = (y) => h - y * sy;
  g.fillStyle = '#f0d58c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 200, 2, 1803, ['rgba(120,84,30,0.1)', 'rgba(255,250,225,0.16)']);
  g.fillStyle = '#dca93a'; g.fillRect(0, Y(CH.HN), w, 0.6 * sy);
  for (const cx of [1.8, 5.45]) {
    g.fillStyle = '#f7eed2'; g.fillRect(X(cx - 0.55), Y(9.65), 1.1 * sx, 1.35 * sy); g.fillStyle = '#34414a'; g.fillRect(X(cx - 0.42), Y(9.5), 0.84 * sx, 1.05 * sy);
    for (const [ex, c] of [[0.2, '#dca93a'], [0, '#34414a']]) { g.fillStyle = c; g.beginPath(); g.moveTo(X(cx - 0.5 - ex), Y(4.4 - ex)); g.lineTo(X(cx - 0.5 - ex), Y(6.4)); g.arc(X(cx), Y(6.4), (0.5 + ex) * sx, PI, 0); g.lineTo(X(cx + 0.5 + ex), Y(4.4 - ex)); g.fill(); }
  }
  streaks(g, w, h, 10, 1804, 0.08, 80);
}
function buildChiesaMondello() {
  initShared(); gardenMats();
  const P = [[-2960.1, -10177.9], [-2943.2, -10187.8], [-2939.5, -10181.0], [-2956.6, -10170.7]];
  const gr = groundRange(P), gy = gr.hi + 0.1, lo = gr.lo - 1 - gy, { W, D, HT, HN, DT } = CH;
  // the front is the short west-south-west side, towards the piazza: outward normal (-0.863, 0.505); local +x is the harbour side
  const nx = -0.863, nz = 0.505;
  begin(gy);
  defMat('moChFront', 192, 384, [W, HT], paintChFront);
  defMat('moChSide', 128, 192, [7.3, HN], paintChSide);
  const c = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2], Mc = frame(c[0], gy, c[1], nx, nz), zf = D / 2, YE = '#dfae3a', WH = '#f4f1e8';
  bx('plaster', Mc, -W / 2, W / 2, lo, HT, zf - DT, zf, { c: '#ffffff' });
  panel('moChFront', W, HT, { M: mul(Mc, tr(0, 0, zf + 0.02)), noao: true });
  bx('plaster', Mc, -W / 2, W / 2, lo, HN, -zf, zf - DT, { c: '#f0d58c' });
  for (const sg of [-1, 1]) {
    panel('moChSide', D - DT, HN, { M: mul(Mc, mul(tr(sg * (W / 2 + 0.02), 0, -DT / 2), rotY(sg * PI / 2))), uvk: [2, 1], noao: true });
    // one belfry opening on each side of the tower: the middle arch of the front's own painting
    panel('moChFront', 1.5, 2.5, { M: mul(Mc, mul(tr(sg * (W / 2 + 0.02), 10.85, zf - DT / 2), rotY(sg * PI / 2))), uvk: [1.5 / W, 2.5 / HT], uvo: [0.5 - 0.75 / W, 10.85 / HT], noao: true });
  }
  // what stands proud: the yellow cornices, the frame of the portal, the arches and railings of the belfry
  bx('flat', Mc, -W / 2 - 0.15, W / 2 + 0.15, HT - 0.65, HT - 0.35, zf - DT - 0.15, zf + 0.22, { c: YE, noao: true });
  bx('flat', Mc, -W / 2 - 0.22, W / 2 + 0.22, HT, HT + 0.22, zf - DT - 0.22, zf + 0.3, { c: YE, noao: true });
  bx('flat', Mc, -W / 2 - 0.12, W / 2 + 0.12, HN - 0.35, HN + 0.1, -zf - 0.12, zf - DT, { c: '#dca93a', noao: true });
  bx('flat', Mc, -W / 2 + 0.4, W / 2 - 0.4, HN + 0.1, HN + 0.16, -zf + 0.4, zf - DT, { c: '#b9ad98', noao: true });
  for (const sg of [-1, 1]) bx('flat', Mc, sg * 1.75, sg * 2.75, 0.5, 8.35, zf, zf + 0.14, { c: YE });
  bx('flat', Mc, -2.8, 2.8, 8.35, 8.98, zf, zf + 0.2, { c: YE, noao: true });
  for (const x of [-1.9, 0, 1.9]) { part('flat', new THREE.RingGeometry(0.55, 0.75, 8, 1, 0, PI), { M: Mc, p: [x, 12.45, zf + 0.09], c: YE, noao: true }); rail(mul(Mc, tr(x, 11.05, zf + 0.1)), 1.1, 0.7, { noao: true }); }
  part('flat', new THREE.RingGeometry(0.75, 1.05, 8, 1, 0, PI), { M: Mc, p: [0, 6.55, zf + 0.09], c: YE, noao: true });
  bx('flat', Mc, -3.0, 3.0, 10.82, 11.05, zf, zf + 0.22, { c: YE, noao: true });
  // the iron cross
  bx('flat', Mc, -0.05, 0.05, HT + 0.2, HT + 1.5, zf - 0.1, zf, { c: '#2c2a26', noao: true }); bx('flat', Mc, -0.4, 0.4, HT + 1.0, HT + 1.09, zf - 0.1, zf, { c: '#2c2a26', noao: true });
  return end('San Girolamo, Mondello');
}
export const CHIESA_MONDELLO = { name: 'San Girolamo (Mondello)', x: -2950, z: -10179, radius: 30, skipIds: ['w87015598'], build: buildChiesaMondello };

export const GROUP_G = [GIARDINO_INGLESE, VILLA_GARIBALDI, STAZIONE_CENTRALE, PIAZZA_MONDELLO, CHIESA_MONDELLO];
