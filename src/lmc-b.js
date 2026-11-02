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
