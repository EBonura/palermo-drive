// City landmarks, group G (review-2 items 9, 13/14 and 15): the Giardino Inglese as a garden, the giant ficus of the Villa Garibaldi on Piazza Marina, the Stazione Centrale, the Ponte
// dell'Ammiraglio in its garden, and the paved piazza of Mondello with its church and kiosks. Same toolkit and way of working as the other city landmarks (src/lmc-kit.js): painted textures,
// real geometry for what stands out, one bin per material, built on the streamed ground, collision for what stands outside the footprints. Proportions come from Wikimedia Commons
// photographs (nothing of them is stored); the notes are in docs/faithfulness/landmarks.md (review 2). `pave` on a spec lists ground polygons that src/world.js paves (the terrain, no mesh).
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, prism, shell,
  mul, tr, rotY, frame, pairsOf, obb, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG, palm, rail, balus, crenel,
} from './lmc-kit.js';

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
  defMat('g_leaf', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#4f7d3a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 1100, 3.2, 901, ['rgba(26,66,30,0.38)', 'rgba(150,190,96,0.30)', 'rgba(18,48,26,0.32)']); });
  defMat('g_leafDk', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#35602e'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 1100, 3.2, 902, ['rgba(14,44,24,0.42)', 'rgba(110,160,80,0.26)', 'rgba(10,36,20,0.36)']); });
  defMat('g_bark', 64, 128, [2.4, 4], (g, w, h) => { g.fillStyle = '#8c8070'; g.fillRect(0, 0, w, h); const r = RNG(903); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,52,42' : '170,160,142'},${0.18 + r() * 0.22})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 8 + r() * 30); } });
  defMat('g_root', 64, 128, [1.6, 4], (g, w, h) => { g.fillStyle = '#7b6e5c'; g.fillRect(0, 0, w, h); const r = RNG(909); for (let i = 0; i < 36; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '48,40,32' : '160,148,126'},${0.2 + r() * 0.25})`; g.fillRect(r() * w, r() * h, 1.5 + r() * 3, 10 + r() * 36); } });
  defMat('g_gravel', 128, 128, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#d3c6a6'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 2.2, 904, ['rgba(120,104,76,0.28)', 'rgba(250,244,226,0.38)', 'rgba(160,146,116,0.3)']); },
    { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });   // over the Comune green polygon (lifted 0.16 m, offset -5) of a park
  defMat('g_bed', 128, 128, [2.6, 2.6], (g, w, h) => {
    g.fillStyle = '#3f6a30'; g.fillRect(0, 0, w, h); const r = RNG(905), cols = ['#d63a4a', '#f2c230', '#e9e6dc', '#c24fa0', '#f08a2c', '#8a5cc8'];
    for (let i = 0; i < 360; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const s = 2 + r() * 2.6; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 7); g.fill(); }
    noiseDots(g, w, h, 300, 2, 906, ['rgba(20,50,20,0.3)']);
  });
  defMat('g_soil', 64, 64, [2, 2], (g, w, h) => { g.fillStyle = '#6b5640'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 200, 2, 907, ['rgba(40,28,18,0.3)', 'rgba(150,120,88,0.25)']); });
  defMat('g_wood', 64, 64, [1.2, 1.2], (g, w, h) => { g.fillStyle = '#8f6038'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,24,12,0.35)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.5); });
  defMat('g_iron', 0, 0, [1, 1], null, { roughness: 0.5 });
  defMat('g_stone', 128, 128, [2.4, 2.4], (g, w, h) => paintAshlar(g, w, h, 2.4, 2.4, 0.4, 0.9, '#cdc4ae', '#8f866f', 908, 1.5, 0.07));
}

// a jittered lump of foliage (low poly, flat shaded); `ky` flattens it
function blob(key, x, y, z, r, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, o.det === undefined ? 1 : o.det), pos = g.attributes.position, sd = o.seed || 1;
  const hv = (a, b, c) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + sd * 3.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), k = 1 + (hv(px, py, pz) - 0.5) * (o.jit === undefined ? 0.36 : o.jit); pos.setXYZ(i, px * k, py * k, pz * k); }
  g.computeVertexNormals();
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
  for (const sg of [-1, 1]) bx('g_iron', M, sg * 0.8 - 0.04, sg * 0.8 + 0.04, 0, 0.5, -0.28, 0.24, { c: '#2a2c2b', noao: true });
}

// ====================================================================================================
// a big strangler fig (Ficus macrophylla / magnolioides): a buttressed trunk, heavy limbs, a curtain of aerial roots that hang from the limbs and root, and a wide dark crown of lumps.
// S scales it (1 = the giant of the Villa Garibaldi, about 38 m across). Returns the collision walls.
// ====================================================================================================
function ficus(cx, cz, S, seed) {
  const gy = groundY(cx, cz), r = RNG(seed), A = (a) => mul(tr(cx, gy, cz), rotY(a));
  const V = S * 0.8, TH = 9 * V;   // V: the height scale (a fig is broader than tall); TH: where the trunk splits into limbs
  // trunk: a fluted column with buttress flares
  cyl('g_bark', 2.3 * S, 3.2 * S, TH, 10, { p: [cx, gy - 0.4, cz], noao: true, c: '#e6dccb' });
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4 + r() * 0.3, tilt = 0.55 + r() * 0.2;
    cyl('g_bark', 0.55 * S, 1.5 * S, (5.2 + r() * 2.4) * V, 5, { M: A(a), p: [2.6 * S, -0.4, 0], rz: tilt, noao: true, c: '#e6dccb' });
  }
  // limbs
  const limbs = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * PI / 9 + r() * 0.5, el = 0.3 + r() * 0.4, len = (10 + r() * 7) * S;   // elevation above the horizontal, radians
    cyl('g_bark', 0.55 * S, 1.2 * S, len, 6, { M: A(a), p: [0.8 * S, TH - 1.2 * V, 0], rz: -(PI / 2 - el), noao: true, c: '#e6dccb' });
    const tipR = 0.8 * S + Math.cos(el) * len, tipY = gy + TH - 1.2 * V + Math.sin(el) * len;
    limbs.push({ a, el, len, x: cx + Math.sin(a) * 0 + Math.cos(a) * tipR, z: cz - Math.sin(a) * tipR, y: tipY });   // (rotY(a) maps local +x to (cos a, 0, -sin a))
  }
  // the crown: a wide flat layer of big lumps, a second layer higher, dark leaves with lighter tops
  const lay = (n, rad, y0, y1, rr0, rr1, ky) => {
    for (let i = 0; i < n; i++) {
      const a = r() * 2 * PI, d = Math.sqrt(r()) * rad * S, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = gy + (y0 + (y1 - y0) * r()) * V, rr = (rr0 + (rr1 - rr0) * r()) * S;
      blob(r() < 0.35 ? 'g_leaf' : 'g_leafDk', x, y, z, rr, { ky, seed: seed + i * 7, jit: 0.34, ry: r() * 6 });
    }
  };
  for (const L of limbs) blob(r() < 0.4 ? 'g_leaf' : 'g_leafDk', L.x, L.y + 1.2 * V, L.z, (5.5 + r() * 2.5) * S, { ky: 0.7, seed: seed + 91, jit: 0.34, ry: r() * 6 });   // a lump on every limb tip, so no limb sticks out of the crown
  lay(10, 15, 14, 18, 6.0, 9.0, 0.62); lay(8, 11, 18, 23, 5.0, 7.5, 0.7); lay(6, 17, 11.5, 14, 5.0, 7.0, 0.5);
  // aerial roots: slender columns that fall from the limbs, in curtains of two or three, flared at the foot
  const nRoot = Math.round(52 * S + 8);
  for (let i = 0; i < nRoot; i++) {
    const L = limbs[(r() * limbs.length) | 0], t = 0.25 + r() * 0.75, x = cx + (L.x - cx) * t + (r() - 0.5) * 2.2 * S, z = cz + (L.z - cz) * t + (r() - 0.5) * 2.2 * S, top = gy + TH - 1.2 * V + Math.sin(L.el) * L.len * t, g0 = groundY(x, z);
    const h = top - g0 + 0.8, rt = (0.2 + r() * 0.16) * S + 0.05, rb = rt * (1.7 + r() * 0.7);
    if (h < 1.5) continue;
    cyl('g_root', rt, rb, h, 5, { p: [x, g0 - 0.2, z], rx: (r() - 0.5) * 0.08, rz: (r() - 0.5) * 0.08, noao: true, c: '#e6dccb' });
  }
}
const figWalls = (cx, cz, S) => ringWalls(cx, cz, 4.6 * S, 8);   // the trunk with its buttresses and the first roots

// ====================================================================================================
// 1. Giardino Inglese: the 4.7 ha public garden between Via Libertà and Via Dante, drawn as a real garden: gravel walks with a loop round each of the two ponds, round flowerbeds, rows of palms,
// a few big ficus on the lawns, benches, and a bandstand (cassa armonica) where the little pavilion stood.
// ====================================================================================================
const GI_POLY = pairsOf([-943, -1968, -889, -1867, -920, -1848, -905, -1818, -871, -1751, -837, -1685, -830, -1672, -776, -1696, -772, -1690, -750, -1701, -748, -1694, -736, -1698, -734, -1699, -751, -1733, -770, -1759, -792, -1823, -722, -1855, -740, -1896, -714, -1911, -741, -1965, -759, -2000, -936, -2000, -959, -1993, -947, -1970]);
const GI_BAND = [-806.3, -1832.2];   // the pavilion (w194087049) becomes the bandstand
const GI_PONDS = [[-780, -1902, 18], [-838, -1799, 17]];
const GI_WALKS = [
  [[-838, -1686], [-848, -1715], [-860, -1748], [-868, -1776], [-862, -1806], [-846, -1830], [-824, -1846], [-803, -1866], [-788, -1884]],         // the main walk, from the south gate to the north pond
  [[-780, -1919], [-790, -1946], [-801, -1972], [-812, -1996]],                                                                                       // on to the north gate
  [[-797, -1834], [-778, -1838], [-756, -1850], [-734, -1862]],                                                                                       // from the bandstand to the east gate
  [[-868, -1776], [-846, -1762], [-820, -1756], [-792, -1760], [-772, -1752]],                                                                         // a cross walk to the east lawn
  [[-846, -1830], [-872, -1850], [-890, -1872]],                                                                                                      // and one to the west gate
  [[-737, -1912], [-757, -1908], [-768, -1904]],                                                                                                      // the east gate to the north pond
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
  walls.push(...ringWalls(GI_BAND[0], GI_BAND[1], 4.5, 10));
  return { palms, figs, benches, walls };
})();
function buildGiardino() {
  initShared(); gardenMats();
  const gy = groundY(-835, -1830); begin(gy);
  const ok = GI_OK;
  // walks: gravel strips, 3.4 m wide, and a ring walk round each pond and the bandstand
  for (const w of GI_WALKS) { const line = smoothPts(w, 6).filter(p => ok(p[0], p[1])); if (line.length > 2) ribbon('g_gravel', line, 3.4, 0.2); }
  for (const [px, pz, rr] of GI_PONDS) ribbon('g_gravel', circlePts(px, pz, rr, 30), 3.0, 0.2);
  ribbon('g_gravel', circlePts(GI_BAND[0], GI_BAND[1], 9.5, 22), 2.6, 0.2);
  // the bandstand: a stone plinth with steps, a ring of eight slim iron columns, a low balustrade, a conical copper roof on a finial
  {
    const [bx0, bz0] = GI_BAND, y0 = groundY(bx0, bz0) + 0.05;
    cyl('g_stone', 4.1, 4.4, 1.1, 12, { p: [bx0, y0 - 0.2, bz0], c: '#e8e0cc' });
    cyl('g_stone', 4.3, 4.3, 0.18, 12, { p: [bx0, y0 + 0.9, bz0], c: '#f0e8d4' });
    for (let i = 0; i < 8; i++) {
      const a = i * PI / 4 + PI / 8, x = bx0 + Math.cos(a) * 3.5, z = bz0 + Math.sin(a) * 3.5;
      cyl('g_iron', 0.1, 0.12, 3.7, 6, { p: [x, y0 + 1.05, z], c: '#d9d4c0', noao: true });
      if (i % 2 === 0) bx('g_iron', frame(x, y0 + 1.05, z, Math.cos(a), Math.sin(a)), -0.9, 0.9, 0.15, 0.9, -0.03, 0.03, { c: '#9aa49a', noao: true });
    }
    cyl('g_iron', 4.4, 4.0, 0.35, 8, { p: [bx0, y0 + 4.7, bz0], c: '#cfc6ae', noao: true });
    cone('g_leaf', 4.6, 2.3, 8, { p: [bx0, y0 + 5.05, bz0], c: '#7f9a86', noao: true });
    sphere('g_iron', 0.22, { p: [bx0, y0 + 7.5, bz0], c: '#caa84a', noao: true, seg: 6 });
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; bx('g_stone', frame(bx0 + Math.cos(a) * 4.9, y0 - 0.2, bz0 + Math.sin(a) * 4.9, Math.cos(a), Math.sin(a)), -1.1, 1.1, 0, 0.4, -0.4, 0.4, { c: '#e8e0cc', noao: true }); }
    for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8, x = bx0 + Math.cos(a) * 15, z = bz0 + Math.sin(a) * 15; if (ok(x, z)) cyl('g_bed', 2.4, 2.6, 0.32, 14, { p: [x, groundY(x, z) - 0.04, z], c: i % 2 ? '#ffffff' : '#f4e0d8', noao: true }); }
  }
  // flowerbeds: long beds at the south gate, round ones at the walk crossings
  for (const [x, z, a, l] of [[-852, -1704, -0.2, 11], [-826, -1706, 0.2, 11], [-830, -1740, -0.15, 8]]) {
    const M = frame(x, groundY(x, z), z, Math.cos(a + 1.57), Math.sin(a + 1.57));
    if (ok(x, z)) bx('g_bed', M, -1.4, 1.4, -0.04, 0.3, -l / 2, l / 2, { noao: true });
  }
  for (const [x, z] of [[-868, -1760], [-858, -1790], [-800, -1760], [-815, -1853], [-759, -1850], [-796, -1945], [-770, -1925]]) if (ok(x, z)) cyl('g_bed', 2.6, 2.8, 0.34, 14, { p: [x, groundY(x, z) - 0.04, z], noao: true });
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
// 3. Stazione Centrale (1886, the neoclassical front on Piazza Giulio Cesare): the front is a long block of three floors, rusticated and arcaded at the foot, pedimented windows on the piano nobile,
// with a central pavilion that carries the big clock and two end pavilions; wings run back along the platforms. The ring outline is the OSM relation r1223249.
// ====================================================================================================
const ST_P = pairsOf([457.4, 639.4, 469.9, 632.4, 472.4, 636.7, 484.4, 629.9, 481.6, 625.0, 490.0, 620.3, 500.6, 614.2, 502.9, 618.1, 514.1, 611.8, 511.4, 607.2, 524.6, 599.8, 544.8, 635.0, 549.3, 632.4, 554.2, 641.1, 560.8, 652.4, 558.0, 654.0, 578.2, 689.0, 575.7, 690.4, 573.5, 691.7, 562.1, 698.1, 541.9, 663.0, 539.3, 658.4, 502.8, 679.1, 505.4, 683.6, 526.4, 720.1, 516.2, 725.9, 511.5, 728.5, 491.3, 693.3, 486.6, 696.0, 480.9, 686.2, 475.4, 676.7, 480.7, 673.7, 467.2, 650.1, 464.5, 651.7]);
const ST_H = pairsOf([482.4, 642.2, 517.6, 622.0, 532.2, 647.2, 497.0, 667.4]);
const ST = { F0: [457.4, 639.4], F1: [524.6, 599.8], DEPTH: 15, HW: 16.8, HB: 19.4, HE: 22.0, HC: 25.0, WC: 24, WE: 15 };
const ST_L = Math.hypot(ST.F1[0] - ST.F0[0], ST.F1[1] - ST.F0[1]), ST_U = [(ST.F1[0] - ST.F0[0]) / ST_L, (ST.F1[1] - ST.F0[1]) / ST_L];
// outward normal (towards the garden of Piazza Giulio Cesare, the north-west)
const ST_NX = ST_U[1], ST_NZ = -ST_U[0];   // for u = (0.862, -0.508) this is (-0.508, -0.862)
function stDims() { return { nx: ST_NX, nz: ST_NZ, mid: [(ST.F0[0] + ST.F1[0]) / 2, (ST.F0[1] + ST.F1[1]) / 2] }; }
function paintStFront(g, w, h) {   // 78 x 19.4 m: rusticated arcade, pedimented piano nobile, plain top floor, cornice
  const W = ST_L, H = ST.HB, sx = w / W, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
  const xs = []; for (let x = 2.4; x < W - 1; x += 4.8) xs.push(x);
  paintFacade(g, w, h, W, H, { seed: 1701, base: '#e5d5b0', trim: '#f4ead2', glass: '#2c333c', ashlar: { course: 0.55, block: 1.4, base: '#dcc9a0', joint: '#b6a27a', seed: 17 },
    bands: [{ y: 5.3, h: 0.45, c: '#f1e6c8' }, { y: 11.2, h: 0.4, c: '#f1e6c8' }, { y: H - 1.3, h: 1.3, c: '#f4ead2' }],
    rows: [{ xs, y0: 0.3, y1: 4.6, w: 2.7, kind: 'arch', fr: 0.2, sill: false }, { xs, y0: 6.5, y1: 10.5, w: 1.5, kind: 'rect', ped: true, balc: true }, { xs, y0: 12.4, y1: 16.3, w: 1.3, kind: 'rect', shut: 'open' }], shut: '#5b6a5a' });
  g.fillStyle = 'rgba(255,250,235,0.5)'; g.fillRect(0, Y(5.3 + 0.1), w, 3);
}
function paintStCentre(g, w, h) {   // the central pavilion, 24 x 25 m: three big arches, tall windows over them, the clock in the tympanum zone
  const W = ST.WC, H = ST.HC, sx = w / W, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintFacade(g, w, h, W, H, { seed: 1702, base: '#e9d9b4', trim: '#f6edd6', glass: '#2a313b', ashlar: { course: 0.55, block: 1.4, base: '#dfcca3', joint: '#b9a47c', seed: 19 },
    bands: [{ y: 7.6, h: 0.5, c: '#f3e9cc' }, { y: 18.2, h: 0.5, c: '#f3e9cc' }, { y: H - 1.5, h: 1.5, c: '#f6edd6' }], pil: { xs: [0.9, 8.4, 15.6, 23.1], w: 1.1, c: '#efe3c3' },
    rows: [{ xs: [4.6, 12, 19.4], y0: 0.3, y1: 7.0, w: 3.6, kind: 'arch', fr: 0.3, sill: false }, { xs: [4.6, 12, 19.4], y0: 9.2, y1: 17.0, w: 2.6, kind: 'arch', fr: 0.3, balc: true }] });
  const cx = X(W / 2), cy = Y(21.4), R = 2.7 * sx;   // the clock
  g.fillStyle = '#f6edd6'; g.beginPath(); g.arc(cx, cy, R * 1.22, 0, 7); g.fill(); g.fillStyle = '#2b2620'; g.beginPath(); g.arc(cx, cy, R * 1.06, 0, 7); g.fill();
  g.fillStyle = '#f7f1df'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.strokeStyle = '#2b2620'; g.lineWidth = 0.1 * sx; for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(cx + Math.sin(a) * R * 0.82, cy - Math.cos(a) * R * 0.82); g.lineTo(cx + Math.sin(a) * R * 0.95, cy - Math.cos(a) * R * 0.95); g.stroke(); }
  g.lineWidth = 0.2 * sx; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * 0.55, cy - R * 0.1); g.stroke(); g.lineWidth = 0.14 * sx; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - R * 0.1, cy - R * 0.8); g.stroke();
}
function paintStEnd(g, w, h) {   // an end pavilion, 15 x 22 m
  const W = ST.WE, H = ST.HE, sx = w / W, sy = h / H;
  paintFacade(g, w, h, W, H, { seed: 1703, base: '#e6d6b1', trim: '#f4ead2', glass: '#2c333c', ashlar: { course: 0.55, block: 1.4, base: '#ddcaa1', joint: '#b8a47c', seed: 21 },
    bands: [{ y: 5.3, h: 0.45, c: '#f1e6c8' }, { y: 11.4, h: 0.4, c: '#f1e6c8' }, { y: H - 1.4, h: 1.4, c: '#f4ead2' }], pil: { xs: [0.7, W - 0.7], w: 1.2, c: '#efe3c3' },
    rows: [{ xs: [3.6, 7.5, 11.4], y0: 0.3, y1: 4.6, w: 2.4, kind: 'arch', fr: 0.2, sill: false }, { xs: [3.6, 7.5, 11.4], y0: 6.6, y1: 10.6, w: 1.5, kind: 'rect', ped: true }, { xs: [3.6, 7.5, 11.4], y0: 12.6, y1: 17.6, w: 1.4, kind: 'rect', shut: 'open' }], shut: '#5b6a5a' });
}
function paintStWing(g, w, h) {   // the side wings: plain plaster, a low arcaded foot, three rows of windows; 9.6 x 16.8 m repeat
  const W = 9.6, H = ST.HW;
  paintFacade(g, w, h, W, H, { seed: 1704, base: '#e1cfa8', trim: '#f0e4c6', glass: '#2d343d', bands: [{ y: 4.6, h: 0.35, c: '#efe3c3' }, { y: H - 0.9, h: 0.9, c: '#efe3c3' }],
    rows: [{ xs: [2.4, 7.2], y0: 0.5, y1: 3.9, w: 1.9, kind: 'arch', fr: 0.18, sill: false }, { xs: [2.4, 7.2], y0: 5.7, y1: 9.3, w: 1.3, kind: 'rect' }, { xs: [2.4, 7.2], y0: 10.9, y1: 14.5, w: 1.3, kind: 'rect', shut: 'open' }], shut: '#5b6a5a' });
}
function buildStazione() {
  initShared(); gardenMats();
  const gr = groundRange(ST_P), gy = gr.hi + 0.15, { nx, nz, mid } = stDims();
  begin(gy);
  defMat('st_front', 2048, 512, [ST_L, ST.HB], paintStFront);
  defMat('st_centre', 768, 800, [ST.WC, ST.HC], paintStCentre);
  defMat('st_end', 480, 704, [ST.WE, ST.HE], paintStEnd);
  defMat('st_wing', 256, 448, [9.6, ST.HW], paintStWing);
  defMat('st_stone', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#e4d6b4'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 1711, ['rgba(110,90,60,0.1)', 'rgba(255,255,245,0.1)']); });
  // wings and body: the ring outline, plain, with the stone foot
  shell('st_wing', ST_P, [ST_H], gy, ST.HW, { lo: gr.lo - 1.5, roof: '#9b968b', cc: '#efe3c3' });
  const M = frame(mid[0], gy, mid[1], nx, nz), L = ST_L, D = ST.DEPTH;
  // the front block: 15 m deep, over the notched front of the ring, with its own painted face
  bx('st_stone', M, -L / 2, L / 2, 0, ST.HB, -D, -0.02, { c: '#f0e4c4' });
  panel('st_front', L, ST.HB, { M: mul(M, tr(0, 0, 0.03)), noao: true });
  bx('st_stone', M, -L / 2 - 0.3, L / 2 + 0.3, ST.HB, ST.HB + 0.5, -D - 0.2, 0.3, { c: '#f4ead2' });
  bx('flat', M, -L / 2, L / 2, ST.HB + 0.5, ST.HB + 0.62, -D, 0.0, { c: '#9b968b', noao: true });
  balus(mul(M, tr(0, ST.HB + 0.5, 0.15)), L, 1.0, { noao: true });
  // central pavilion: proud of the front by 3.6 m
  const PC = 3.6;
  bx('st_stone', M, -ST.WC / 2, ST.WC / 2, 0, ST.HC, -D, PC, { c: '#f0e4c4' });
  panel('st_centre', ST.WC, ST.HC, { M: mul(M, tr(0, 0, PC + 0.02)), noao: true });
  bx('st_stone', M, -ST.WC / 2 - 0.4, ST.WC / 2 + 0.4, ST.HC, ST.HC + 0.6, -D, PC + 0.5, { c: '#f4ead2' });
  const ped = new THREE.Shape(); ped.moveTo(-ST.WC / 2 - 0.4, 0); ped.lineTo(ST.WC / 2 + 0.4, 0); ped.lineTo(0, 3.6); ped.lineTo(-ST.WC / 2 - 0.4, 0);
  extrude('st_stone', ped, PC + 0.5 + D, { M: mul(M, tr(0, ST.HC + 0.6, -D)), c: '#f2e8cc' });
  bx('flat', M, -ST.WC / 2, ST.WC / 2, ST.HC + 0.6, ST.HC + 0.7, -D, PC, { c: '#9b968b', noao: true });
  // end pavilions: 2.2 m proud
  for (const sg of [-1, 1]) {
    const xc = sg * (L / 2 - ST.WE / 2), PE = 2.2;
    bx('st_stone', M, xc - ST.WE / 2, xc + ST.WE / 2, 0, ST.HE, -D, PE, { c: '#f0e4c4' });
    panel('st_end', ST.WE, ST.HE, { M: mul(M, tr(xc, 0, PE + 0.02)), noao: true });
    bx('st_stone', M, xc - ST.WE / 2 - 0.3, xc + ST.WE / 2 + 0.3, ST.HE, ST.HE + 0.5, -D - 0.2, PE + 0.4, { c: '#f4ead2' });
    cone('red', ST.WE * 0.62, 3.0, 4, { p: [mid[0] + xc * nz - (D / 2) * nx, gy + ST.HE + 0.5, mid[1] - xc * nx - (D / 2) * nz], ry: Math.atan2(nx, nz) + PI / 4, c: '#9aa497', noao: true });
  }
  // the entrance: a stone stair and a long shallow canopy of iron and glass over the footway
  for (let i = 0; i < 4; i++) bx('st_stone', M, -ST.WC / 2 + 3 - i * 0.2, ST.WC / 2 - 3 + i * 0.2, 0, 0.12 + i * 0.0, PC + 0.2 + i * 0.35, PC + 0.55 + i * 0.35, { c: '#d6cdb8', noao: true });
  const g = end('Stazione Centrale');
  return g;
}
const ST_WALLS = (() => {
  const { nx, nz, mid } = stDims(), O = mid, out = [], PC = 3.6, PE = 2.2, L = ST_L;
  out.push(...rectSegs(O, nx, nz, -ST.WC / 2, ST.WC / 2, -4, PC + 0.6));
  for (const sg of [-1, 1]) { const xc = sg * (L / 2 - ST.WE / 2); out.push(...rectSegs(O, nx, nz, xc - ST.WE / 2, xc + ST.WE / 2, -4, PE + 0.4)); }
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
  const hump = (xx) => 5.0 + 3.3 * Math.cos(xx / (tot / 2) * PI / 2);
  let x = -tot / 2;
  box('g_rubble', pier, hump(x + pier / 2), BW, { M, p: [x + pier / 2, 0, 0], c: '#e0d8b8' }); x += pier;
  for (const s of spans) {
    const cx = x + s / 2, H = hump(cx);
    archBay('g_rubble', s + pier, H, s, Math.min(H - 0.8, s * 0.92 + 0.5), BW, { M: mul(M, tr(cx, 0, -BW / 2)), pointed: true, c: '#ece4c6' });
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
  // the iron garden fence runs along the lawn on both sides of the bed
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
// 5. Piazza Mondello: the open ground round the fountain between the arcade block and the harbour road is paved (the terrain gets slabs from src/world.js, `pave`), with the fountain basin
// ringed by a low kerb, three kiosks with striped awnings, and a row of lamp posts. San Girolamo, the little church at the east side, is rebuilt with a gabled front, a rose window and a bell tower.
// ====================================================================================================
const MO_ZONE = [[-3080, -10159.5], [-3050, -10165], [-3023.8, -10170], [-3008.8, -10163.8], [-3008.8, -10157], [-3025, -10143], [-3038.8, -10132], [-3050.8, -10130.5]];
const MO_KIOSKS = [[-3055, -10153, 0.2, 0.98, '#e8d8a8', '#3d8a96'], [-3021, -10158, -0.3, 0.95, '#ecd6c0', '#c0452e'], [-3041, -10140, 0, 1, '#dfe6d2', '#d8a02c']];
function kiosk(x, z, fx, fz, c1, c2) {
  const y = groundY(x, z), M = frame(x, y, z, fx, fz);
  bx('g_stone', M, -1.7, 1.7, 0, 0.3, -1.4, 1.4, { c: '#d6cdb6', noao: true });
  bx('plaster', M, -1.5, 1.5, 0.3, 2.6, -1.2, 1.2, { c: c1 });
  bx('dark', M, -1.1, 1.1, 1.0, 2.2, 1.18, 1.26, { noao: true });   // the serving hatch
  bx('flat', M, -1.9, 1.9, 2.6, 2.75, -1.6, 1.9, { c: c2, noao: true });
  // the awning: a sloping canvas with stripes (two colours in alternating slats)
  for (let i = 0; i < 6; i++) bx('flat', mul(M, tr(0, 0, 1.2)), -1.8 + i * 0.6, -1.8 + (i + 1) * 0.6, 2.0, 2.06, 0.0, 1.2, { c: i % 2 ? '#f2eee2' : c2, noao: true, rx: 0.0 });
  bx('flat', M, -1.7, 1.7, 2.75, 3.15, -1.45, 1.45, { c: c2, noao: true });
}
function buildPiazzaMondello() {
  initShared(); gardenMats();
  const gy = groundY(-3037, -10150); begin(gy);
  const [fx, fz] = [-3037.5, -10160.5];
  // the fountain kerb: a low stone ring round the water
  lathe('g_stone', [[6.0, 0], [6.0, 0.5], [6.7, 0.5], [6.7, 0]], 24, { p: [fx, groundY(fx, fz) - 0.1, fz], c: '#e4dcc6', noao: true });
  for (const [x, z, fx2, fz2, c1, c2] of MO_KIOSKS) kiosk(x, z, fx2, fz2, c1, c2);
  // lamp posts along the long sides
  for (let i = 0; i < 6; i++) { const t = i / 5, x = -3075 + t * 56, z = -10162 + t * -4; cyl('g_iron', 0.07, 0.1, 4.2, 6, { p: [x, groundY(x, z), z], c: '#2e3430', noao: true }); sphere('g_stone', 0.28, { p: [x, groundY(x, z) + 4.5, z], c: '#f5f0dc', noao: true, seg: 6 }); }
  return end('Piazza Mondello');
}
export const PIAZZA_MONDELLO = { name: 'Piazza Mondello', x: -3040, z: -10150, radius: 55, skipIds: [], build: buildPiazzaMondello, walls: MO_KIOSKS.flatMap(([x, z]) => sqWalls(x, z, 1.9)), pave: [MO_ZONE] };

function buildChiesaMondello() {
  initShared(); gardenMats();
  const P = [[-2960.1, -10177.9], [-2943.2, -10187.8], [-2939.5, -10181.0], [-2956.6, -10170.7]];
  const gr = groundRange(P), gy = gr.hi + 0.1;
  // the front is the short west-south-west side, towards the piazza: outward normal (-0.863, 0.505)
  const nx = -0.863, nz = 0.505, W = 7.7, D = 19.6, H = 8.4;
  begin(gy);
  defMat('mo_front', 256, 384, [W, 12], (g, w, h) => {
    const sx = w / W, sy = h / 12, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintFacade(g, w, h, W, 12, { seed: 1801, base: '#ecdcb6', trim: '#f6efdc', glass: '#2b333b', pil: { xs: [0.45, W - 0.45], w: 0.7, c: '#f1e6c8' }, bands: [{ y: 6.2, h: 0.35, c: '#f1e6c8' }], plinth: { h: 0.6, c: '#b9a98a' },
      rows: [{ kind: 'door', xs: [W / 2], y0: 0.5, y1: 4.2, w: 1.7, glass: '#3a2a1c' }, { xs: [1.7, W - 1.7], y0: 1.4, y1: 3.6, w: 0.7, kind: 'arch', fr: 0.1, sill: false }] });
    g.fillStyle = '#f6efdc'; g.beginPath(); g.arc(X(W / 2), Y(8.0), 1.0 * sx, 0, 7); g.fill(); g.fillStyle = '#2b333b'; g.beginPath(); g.arc(X(W / 2), Y(8.0), 0.78 * sx, 0, 7); g.fill();
    g.strokeStyle = '#f6efdc'; g.lineWidth = 0.1 * sx; g.beginPath(); g.moveTo(X(W / 2), Y(7.25)); g.lineTo(X(W / 2), Y(8.75)); g.moveTo(X(W / 2 - 0.75), Y(8.0)); g.lineTo(X(W / 2 + 0.75), Y(8.0)); g.stroke();
  });
  defMat('mo_wall', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#e3d2ac'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 1802, ['rgba(110,90,60,0.1)', 'rgba(255,255,245,0.1)']); });
  const c = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2];
  const Mc = frame(c[0], gy, c[1], nx, nz);
  bx('mo_wall', Mc, -W / 2, W / 2, 0, H, -D / 2, D / 2, { c: '#ffffff' });
  panel('mo_front', W, 12, { M: mul(Mc, tr(0, 0, D / 2 + 0.02)), noao: true });
  // the gabled roof along the nave and the pediment of the front
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.3, 0); sh.lineTo(W / 2 + 0.3, 0); sh.lineTo(0, 3.6); sh.lineTo(-W / 2 - 0.3, 0);
  extrude('mo_wall', sh, 0.5, { M: mul(Mc, tr(0, H, D / 2 - 0.2)), c: '#f2e8cc' });
  for (const sg of [-1, 1]) box('tile', 4.7, 0.25, D + 0.8, { M: mul(Mc, tr(sg * 2.15, H + 1.7, 0)), rz: -sg * 0.58, noao: true });
  // the bell tower: a square tower at the back corner of the north side with a pyramidal roof and a cross
  const Mt = mul(Mc, tr(-W / 2 - 1.2, 0, D / 2 - 3.2));
  bx('mo_wall', Mt, -1.8, 1.8, 0, 15, -1.8, 1.8, { c: '#ffffff' });
  bx('dark', Mt, -0.7, 0.7, 11.0, 13.6, -1.85, 1.85, { noao: true }); bx('dark', Mt, -1.85, 1.85, 11.0, 13.6, -0.7, 0.7, { noao: true });
  bx('flat', Mt, -2.0, 2.0, 15, 15.4, -2.0, 2.0, { c: '#f2e8cc', noao: true });
  cone('tile', 2.9, 3.6, 4, { M: mul(Mt, tr(0, 15.4, 0)), ry: PI / 4, noao: true });
  bx('g_iron', Mt, -0.05, 0.05, 19.0, 20.4, -0.05, 0.05, { c: '#2c2a26', noao: true }); bx('g_iron', Mt, -0.4, 0.4, 19.8, 19.9, -0.05, 0.05, { c: '#2c2a26', noao: true });
  return end('San Girolamo, Mondello');
}
const CH_C = [-2950.0, -10179.0];   // the centre of the old footprint
export const CHIESA_MONDELLO = { name: 'San Girolamo (Mondello)', x: -2950, z: -10179, radius: 30, skipIds: ['w87015598'], build: buildChiesaMondello, walls: rectSegs([(-2960.1 + -2939.5) / 2, (-10177.9 + -10181.0) / 2], -0.863, 0.505, -7.7 / 2 - 3.0, -7.7 / 2 + 0.6, 19.6 / 2 - 5.0, 19.6 / 2 - 1.4) };

export const GROUP_G = [GIARDINO_INGLESE, VILLA_GARIBALDI, STAZIONE_CENTRALE, PIAZZA_MONDELLO, CHIESA_MONDELLO];
