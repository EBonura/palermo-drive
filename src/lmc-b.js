// City landmarks, group B: the Arab-Norman monuments (Zisa, Cuba, San Giovanni degli Eremiti, Ponte dell'Ammiraglio) and Palazzo dei Normanni's front.
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, prism, pyramid, gable, shell,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  statue, palm, crenel, rail,
} from './lmc-kit.js';
import { FP, LINES } from './landmarks-city-data.js';

const skirt = (key, M, w, d, lo, o = {}) => bx(key, M, -w / 2, w / 2, lo, 0.02, -d / 2, d / 2, o);
// a dome on a short cylinder drum
function domeOn(M, r, drumH, o = {}) {
  cyl('stone', r * 1.0, r * 1.05, drumH, 12, { M, c: o.drumC || '#d8c9a0' });
  lathe('red', [[r * 1.02, 0], [r * 1.0, 0.25 * r], [r * 0.85, 0.7 * r], [r * 0.55, 1.05 * r], [r * 0.2, 1.3 * r], [0.01, 1.38 * r]], 12, { M: mul(M, tr(0, drumH, 0)), c: o.c || '#ffffff', noao: true });
  sphere('flat', r * 0.1, { M: mul(M, tr(0, drumH + 1.38 * r, 0)), c: '#8a7a5a', seg: 5, noao: true });
}

// ====================================================================================================
// La Zisa
// ====================================================================================================
function buildZisa() {
  initShared();
  const pts = pairsOf(FP.zisa.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, -1, 0.1);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = Math.min(fr.w, 38), Dp = Math.min(fr.d, 20.5), H = 25.5;
  const arches = [W * 0.2, W * 0.5, W * 0.8];
  defMat('zisaFront', 1024, 700, [W, H], (g, w, h) => {
    const sx = w / W, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, W, H, 0.5, 1.1, '#c2ad84', '#8c7a58', 701, 2, 0.06);
    const pointed = (cx, y0, y1, bw, fill, stroke, lw) => {
      g.beginPath(); g.moveTo(X(cx - bw / 2), Y(y0)); g.lineTo(X(cx - bw / 2), Y(y1 - bw * 0.7));
      g.quadraticCurveTo(X(cx - bw / 2), Y(y1 - bw * 0.2), X(cx), Y(y1)); g.quadraticCurveTo(X(cx + bw / 2), Y(y1 - bw * 0.2), X(cx + bw / 2), Y(y1 - bw * 0.7));
      g.lineTo(X(cx + bw / 2), Y(y0)); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    };
    // seven bays: pointed blind arches over two storeys with rectangular windows, three portals at the foot (the middle one the grand iwan)
    const NB = 7, bw = W / NB, rect = (cx, y0, y1, ww) => { g.fillStyle = '#2b251e'; g.fillRect(X(cx - ww / 2), Y(y1), ww * sx, (y1 - y0) * sy); g.fillStyle = '#e3d5ae'; g.fillRect(X(cx - ww / 2) - 2, Y(y1) - 2, ww * sx + 4, 3); };
    for (let i = 0; i < NB; i++) {
      const cx = bw * (i + 0.5);
      pointed(cx, 8.6, 20.2, bw - 1.4, '#b8a37a', 'rgba(60,45,25,0.55)', 3);            // the tall blind arch of the upper storeys
      pointed(cx, 8.6, 19.0, bw - 2.6, '#c3ae84', 'rgba(60,45,25,0.35)', 2);
      rect(cx, 10.4, 13.0, 1.05); rect(cx, 14.6, 17.2, 1.05);
      if (i % 2 === 1) { const mid = i === 3, pw = mid ? 4.6 : 3.2, ph = mid ? 7.4 : 5.6;
        pointed(cx, 0, ph + 2.2, pw + 2.2, '#a98f64', 'rgba(60,45,25,0.7)', 4);           // recess round the portal
        pointed(cx, 0, ph, pw, '#18130f', '#e6d9b6', 5); }                                   // the portal itself
      else { pointed(cx, 1.2, 7.2, bw - 2.2, '#b49b70', 'rgba(60,45,25,0.5)', 3); rect(cx, 2.6, 5.0, 0.9); }
    }
    g.fillStyle = '#3a2f22'; g.fillRect(0, Y(23.2), w, 1.3 * sy);                              // inscription band
    g.fillStyle = '#c9b78e'; for (let x = 0.3; x < W; x += 0.6) g.fillRect(X(x), Y(22.8), 0.3 * sx, 0.5 * sy);
    g.fillStyle = 'rgba(40,30,20,0.18)'; g.fillRect(0, Y(20.1), w, 0.4 * sy);
    streaks(g, w, h, 70, 702, 0.22, 240); const gb = g.createLinearGradient(0, h, 0, h - 4 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.4)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 4 * sy, w, 4 * sy);
  });
  defMat('zisaSide', 256, 512, [6, 12], (g, w, h) => { paintAshlar(g, w, h, 6, 12, 0.5, 1.1, '#bda880', '#8c7a58', 703, 2, 0.06); g.fillStyle = '#a58e66'; g.fillRect(40, 60, 100, 440); g.fillStyle = '#2b231c'; for (const y of [120, 220]) g.fillRect(70, y, 40, 60); streaks(g, w, h, 30, 704, 0.2, 200); });
  defMat('zisaPink', 256, 128, [14, 6], (g, w, h) => paintFacade(g, w, h, 14, 6, { base: '#c0645a', trim: '#e6b9a0', glass: '#2a1e1c', seed: 705, rows: [{ y0: 0.8, y1: 4.8, n: 4, m: 1.6, w: 1.5, kind: 'arch', fr: 0.2, sill: false }] }));
  skirt('stone', M, W + 3, Dp + 3, -(gr.hi - gr.lo) - 3, { c: '#a89c84' });
  bx('zisaSide', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.02);
  panel('zisaFront', W, H, { M: mul(M, tr(0, 0, Dp / 2 + 0.01)) });
  bx('flat', M, -W / 2 - 0.3, W / 2 + 0.3, H, H + 0.5, -Dp / 2 - 0.3, Dp / 2 + 0.3, { c: '#c9b88e' });
  for (let q = 0; q < 4; q++) crenel(mul(M, mul(rotY(q * PI / 2), tr(0, H + 0.5, (q % 2 ? W : Dp) / 2 + 0.3 - 0.02 - (q % 2 ? 0 : 0)))), q % 2 ? Dp + 0.6 : W + 0.6, { c: '#cdbb92' });
  // the later pink belvedere on the roof and two corner turrets
  bx('zisaPink', M, -7, 7, H + 0.5, H + 6.5, -3.4, 3.4);
  bx('flat', M, -7.4, 7.4, H + 6.5, H + 7.0, -3.8, 3.8, { c: '#d9a99a' });
  for (const sg of [-1, 1]) bx('zisaPink', M, sg * (W / 2 - 2.0) - 1.4, sg * (W / 2 - 2.0) + 1.4, H + 0.5, H + 4.6, -Dp / 2 + 0.8, -Dp / 2 + 3.6);
  // front steps, forecourt and the long pool on the axis
  for (let i = 0; i < 3; i++) bx('stone', M, -6 - i * 0.6, 6 + i * 0.6, -0.02, 0.5 - i * 0.18, Dp / 2 + 0.2, Dp / 2 + 1.0 + (2 - i) * 0.9 + 0.8, { c: '#cbbf9f' });
  for (const sg of [-1, 1]) bx('marble', M, sg * 3.0 - 0.3, sg * 3.0 + 0.3, 0, 0.4, Dp / 2 + 5, Dp / 2 + 30, { c: '#d9d2bf' });
  for (const z of [Dp / 2 + 5, Dp / 2 + 29.7]) bx('marble', M, -3.3, 3.3, 0, 0.4, z, z + 0.3, { c: '#d9d2bf' });
  bx('glass', M, -2.7, 2.7, 0.0, 0.2, Dp / 2 + 5.3, Dp / 2 + 29.7, { c: '#5f95ad', noao: true });
  return end('La Zisa');
}
export const ZISA = { name: 'La Zisa', x: -1770, z: -116, radius: 60, skipIds: [FP.zisa.id], build: buildZisa };

// ====================================================================================================
// La Cuba
// ====================================================================================================
function buildCuba() {
  initShared();
  const pts = pairsOf(FP.cuba.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.6, 0.8);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = Math.min(fr.w, 32), Dp = Math.min(fr.d, 17), H = 17.5;
  const arcFace = (Wm, key, seed, n) => defMat(key, 512, 512, [Wm, H], (g, w, h) => {
    const sx = w / Wm, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, Wm, H, 0.45, 1.0, '#cbb68a', '#97845e', seed, 2, 0.05);
    const bw = Wm / n;
    for (let i = 0; i < n; i++) {
      const cx = bw * (i + 0.5), aw = bw - 1.6;
      g.beginPath(); g.moveTo(X(cx - aw / 2), Y(0.5)); g.lineTo(X(cx - aw / 2), Y(13.5 - aw * 0.4)); g.quadraticCurveTo(X(cx - aw / 2), Y(13.2), X(cx), Y(13.9 + aw * 0.12)); g.quadraticCurveTo(X(cx + aw / 2), Y(13.2), X(cx + aw / 2), Y(13.5 - aw * 0.4)); g.lineTo(X(cx + aw / 2), Y(0.5)); g.closePath();
      g.fillStyle = '#b5a07a'; g.fill(); g.strokeStyle = 'rgba(60,45,25,0.7)'; g.lineWidth = 3; g.stroke();
      for (const [y0, y1, ww] of [[2.0, 4.6, 1.0], [6.2, 9.6, 0.7], [10.6, 12.6, 0.7]]) { g.fillStyle = '#2a2219'; g.beginPath(); g.moveTo(X(cx - ww / 2), Y(y0)); g.lineTo(X(cx - ww / 2), Y(y1 - ww * 0.5)); g.quadraticCurveTo(X(cx), Y(y1 + ww * 0.5), X(cx + ww / 2), Y(y1 - ww * 0.5)); g.lineTo(X(cx + ww / 2), Y(y0)); g.fill(); }
    }
    g.fillStyle = 'rgba(60,45,25,0.5)'; g.fillRect(0, Y(15.6), w, 0.5 * sy); streaks(g, w, h, 40, seed + 1, 0.2, 240);
  });
  arcFace(W, 'cubaLong', 711, 4); arcFace(Dp, 'cubaShort', 712, 2);
  skirt('stone', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 3, { c: '#b0a58c' });
  bx('cubaLong', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.02);
  panel('cubaLong', W, H, { M: mul(M, tr(0, 0, Dp / 2 + 0.01)) });
  panel('cubaLong', W, H, { M: mul(M, mul(rotY(PI), tr(0, 0, Dp / 2 + 0.01))) });
  for (const sg of [-1, 1]) panel('cubaShort', Dp, H, { M: mul(M, mul(rotY(sg * PI / 2), tr(0, 0, W / 2 + 0.01))) });
  bx('flat', M, -W / 2 - 0.3, W / 2 + 0.3, H, H + 0.6, -Dp / 2 - 0.3, Dp / 2 + 0.3, { c: '#d4c196' });
  bx('flat', M, -W / 2 + 0.5, W / 2 - 0.5, H + 0.6, H + 1.0, -Dp / 2 + 0.5, Dp / 2 - 0.5, { c: '#a89a7a' });
  return end('La Cuba');
}
export const CUBA = { name: 'La Cuba', x: -1633, z: 901, radius: 50, skipIds: [FP.cuba.id], build: buildCuba };

// ====================================================================================================
// San Giovanni degli Eremiti
// ====================================================================================================
function buildEremiti() {
  initShared(); ensureTrunk();
  const pts = pairsOf(FP.eremiti.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.5, 0.9);
  const gy = gr.hi + 0.1;
  // frame with local x along the long axis of the footprint
  const M = frame(ob.cx, gy, ob.cz, ob.vx, ob.vz);
  begin(gy);
  defMat('eremWall', 256, 256, [6, 8], (g, w, h) => { paintAshlar(g, w, h, 6, 8, 0.5, 1.2, '#bda985', '#8d7c5c', 721, 2, 0.07); g.fillStyle = 'rgba(70,55,35,0.5)'; g.beginPath(); g.moveTo(40, 256); g.lineTo(40, 100); g.quadraticCurveTo(40, 60, 128, 52); g.quadraticCurveTo(216, 60, 216, 100); g.lineTo(216, 256); g.fill(); g.fillStyle = '#2d2418'; g.fillRect(118, 90, 20, 60); streaks(g, w, h, 20, 722, 0.2, 160); });
  const L = 21, Dc = 12.4, Hb = 7.6;
  skirt('stone', M, L + 2, Dc + 2, -(gr.hi - gr.lo) - 2.5, { c: '#a99d84' });
  bx('eremWall', M, -L / 2 + 2, L / 2 + 2, 0, Hb, -Dc / 2, Dc / 2);
  bx('flat', M, -L / 2 + 1.7, L / 2 + 2.3, Hb, Hb + 0.4, -Dc / 2 - 0.3, Dc / 2 + 0.3, { c: '#cbbb96' });
  // five red domes: two over the nave, three over the choir end
  for (const [x, z, r] of [[-3.5, 0, 2.6], [4.0, 0, 2.6], [10.0, -3.6, 1.8], [10.0, 0, 1.9], [10.0, 3.6, 1.8]]) {
    bx('eremWall', M, x - r - 0.3, x + r + 0.3, Hb + 0.4, Hb + 2.2, z - r - 0.3, z + r + 0.3);
    domeOn(mul(M, tr(x, Hb + 2.2, z)), r, 1.0);
  }
  // bell tower with its own small red dome
  bx('eremWall', M, -8.8, -4.6, 0, 15.5, -9.2, -5.0);
  for (const q of [0, 1]) box('dark', 1.1, 2.4, 0.15, { M: mul(M, mul(tr(-6.7, 11.0, -7.1), rotY(q * PI / 2))), p: [q ? 2.12 : 0, 0, q ? 0 : 2.12], noao: true });
  domeOn(mul(M, tr(-6.7, 15.5, -7.1)), 1.6, 0.6);
  // cloister arcade of paired slender columns on the side opposite the tower
  const NA = 10, MA = mul(M, tr(0, 0, Dc / 2 + 7.0));
  bx('stone', MA, -NA * 1.2 - 0.8, NA * 1.2 + 0.8, 0, 0.5, -0.5, 0.6, { c: '#c9bda0' });
  for (let i = 0; i < NA; i++) {
    const x = (i - (NA - 1) / 2) * 2.4;
    archBay('tufa', 2.4, 3.9, 1.6, 3.2, 0.7, { M: mul(MA, tr(x, 0.5, -0.1)), pointed: true, oy0: 0.5, c: '#d8cba8' });
    for (const dx of [-0.35, 0.35]) cyl('marble', 0.09, 0.09, 2.7, 6, { M: mul(MA, tr(x + dx, 0.5, 0.25)), c: '#ece6d6' });
  }
  bx('eremWall', M, -NA * 1.2 - 0.8, NA * 1.2 + 0.8, 4.4, 4.9, Dc / 2 + 6.4, Dc / 2 + 7.6);
  // palms and a citrus tree in the garden
  for (const [x, z] of [[-6, Dc / 2 + 5], [3, Dc / 2 + 4.5], [8, Dc / 2 + 6]]) palm(ob.cx + ob.vx * x + ob.vz * 0, gy, ob.cz + ob.vz * x + 0, 9.5, { r: x });
  return end('San Giovanni degli Eremiti');
}
export const EREMITI = { name: 'San Giovanni degli Eremiti', x: -577, z: 683, radius: 50, skipIds: [FP.eremiti.id], build: buildEremiti };

// ====================================================================================================
// Ponte dell'Ammiraglio: the 12th-century humpback bridge of pointed stone arches, now a dry bridge over a lawn
// ====================================================================================================
function buildPonte() {
  initShared();
  const [a, b] = LINES.ponte, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  const gy = groundY((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const M = frame((a[0] + b[0]) / 2, gy, (a[1] + b[1]) / 2, -uz, ux);   // local x along the bridge
  begin(gy);
  defMat('pontStone', 256, 256, [3.2, 3.2], (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.32, 0.7, '#aaa07c', '#6f6648', 731, 2, 0.1));
  // nine pointed arches of unequal span (the tall ones in the middle), a shallow hump, grey-ochre ashlar; a round masonry tower at each end
  const sp0 = [2.4, 3.2, 4.2, 5.4, 6.6, 5.4, 4.2, 3.2, 2.4], pier = 2.4, BW = 5.6, sc = (L - pier * (sp0.length + 1)) / sp0.reduce((a, v) => a + v, 0), spans = sp0.map(v => v * sc);   // fitted to the OSM way
  let tot = pier; for (const s of spans) tot += s + pier;
  const hump = (xx) => 4.4 + 3.0 * Math.cos(xx / (tot / 2) * PI / 2);
  let x = -tot / 2;
  box('pontStone', pier, hump(x + pier / 2), BW, { M, p: [x + pier / 2, 0, 0], c: '#d8d0b0' }); x += pier;
  for (const s of spans) {
    const cx = x + s / 2, H = hump(cx);
    archBay('pontStone', s + pier, H, s, Math.min(H - 0.7, s * 1.15 + 0.6), BW, { M: mul(M, tr(cx, 0, -BW / 2)), pointed: true, c: '#e6dfc2' });
    x += s + pier;
  }
  // parapets on both sides, following the hump in short sloped slabs
  const NQ = 28;
  for (let q = 0; q < NQ; q++) {
    const x0 = -tot / 2 + q * tot / NQ, x1 = x0 + tot / NQ, y0 = hump(x0) + 0.25, y1 = hump(x1) + 0.25, len = Math.hypot(x1 - x0, y1 - y0), rz = Math.atan2(y1 - y0, x1 - x0);
    for (const sg of [-1, 1]) box('pontStone', len + 0.04, 1.1, 0.6, { M, p: [(x0 + x1) / 2, (y0 + y1) / 2, sg * (BW / 2 - 0.3)], rz, c: '#ddd5b6' });
  }
  for (const sg of [-1, 1]) { cyl('pontStone', 1.3, 1.5, 8.2, 10, { M, p: [sg * (tot / 2 - 0.4), -0.5, BW / 2 - 0.2], c: '#d8d0b0' }); }
  return end("Ponte dell'Ammiraglio");
}
export const PONTE = { name: "Ponte dell'Ammiraglio", x: 1209, z: 1182, radius: 60, skipIds: [], build: buildPonte };

// ====================================================================================================
// Palazzo dei Normanni: the whole palace mass with the pink-plaster front on Piazza del Parlamento. The Torre Pisana in the middle of
// that front stays in src/landmarks.js (the centro module): this model replaces the generic building; the tower box of the centro module stands against the front wall of this one.
// ====================================================================================================
function buildNormanni() {
  initShared();
  const p = FP.normanni, pts = pairsOf(p.p), holes = (p.holes || []).map(pairsOf), gr = groundRange(pts);
  const gy = gr.hi, WH = 19.5;
  begin(gy);
  defMat('norWall', 256, 512, [7.2, 15], (g, w, h) => paintFacade(g, w, h, 7.2, 15, { base: '#d3a999', trim: '#f0dccb', glass: '#2c2724', seed: 741, plinth: { h: 1.0, c: '#a58a7a' },
    bands: [{ y: 5.6, h: 0.3, c: '#e8cbb8' }, { y: 10.9, h: 0.3, c: '#e8cbb8' }, { y: 15.2, h: 0.6, c: '#e8cbb8' }],
    rows: [{ y0: 1.6, y1: 4.4, xs: [1.8, 5.4], w: 1.2, kind: 'rect', ped: true }, { y0: 6.6, y1: 9.8, xs: [1.8, 5.4], w: 1.2, kind: 'rect', ped: true, balc: true }, { y0: 11.8, y1: 14.4, xs: [1.8, 5.4], w: 1.1, kind: 'rect' }] }));
  defMat('norPortal', 128, 256, [5, 10], (g, w, h) => { paintAshlar(g, w, h, 5, 10, 0.4, 0.9, '#cfc3a6', '#8d8068', 742, 2, 0.05); g.fillStyle = '#231b16'; g.beginPath(); g.moveTo(34, 256); g.lineTo(34, 150); g.arc(64, 150, 30, Math.PI, 0); g.lineTo(94, 256); g.fill(); });
  shell('norWall', pts, holes, gy, WH, { lo: gr.lo - 3, roof: '#8f8a82', cc: '#e2c8b8' });
  // the Piazza del Parlamento front: its centre is the Torre Pisana (centro module); a portal on the left wing
  const fa = [-639.3, 532.3], fb = [-684.1, 486.2], fl = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]), fx = (fb[0] - fa[0]) / fl, fz = (fb[1] - fa[1]) / fl;
  const Mf = frame((fa[0] + fb[0]) / 2, gy, (fa[1] + fb[1]) / 2, 0.717, -0.697);
  const MP = mul(Mf, tr(-fl / 4, 0, 0.3));
  bx('tufa', MP, -2.8, 2.8, 0, 7.6, 0, 0.9, { c: '#d9cfb4' });
  panel('norPortal', 5, 10, { M: mul(MP, tr(0, 0, 0.92)), uvk: [1, 0.76] });
  return end('Palazzo dei Normanni');
}
export const NORMANNI = { name: 'Palazzo dei Normanni', x: -700, z: 502, radius: 120, skipIds: [FP.normanni.id], build: buildNormanni };
