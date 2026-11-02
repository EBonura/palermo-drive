// City landmarks, group F (review-2 items 6 and 7): La Zisa and the Palazzina Cinese, rebuilt after the Commons photographs (proportions only, nothing is stored).
// Same toolkit and the same way of working as the other city landmarks (src/lmc-kit.js): painted textures for the walls, real geometry for what stands out of them or goes
// in behind them, one bin per material, built on the streamed ground, collision for what stands outside the footprints. Notes: docs/faithfulness/landmarks.md (review 2).
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, pyramid,
  mul, tr, rotY, frame, pairsOf, obb, facing, groundRange, groundY, initShared, ensureTrunk, paintAshlar, noiseDots, streaks, palm, crenel, rail,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';

const r1 = (v) => Math.round(v * 10) / 10;
// world position of the local point (x, z) of a frame at O whose +z points along (nx, nz) (local +x is (nz, -nx), as frame() has it)
const wpt = (O, nx, nz, x, z) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz];
const rectSegs = (O, nx, nz, x0, x1, z0, z1) => { const p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => wpt(O, nx, nz, x, z)); return p.map((a, i) => { const b = p[(i + 1) % 4]; return [r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]; }); };
const lineSegs = (O, nx, nz, x0, z0, x1, z1) => { const a = wpt(O, nx, nz, x0, z0), b = wpt(O, nx, nz, x1, z1); return [[r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]]; };
// a pointed arch outline (springing at hs, apex at top) as a Path, for the openings cut into a wall slab
const pointedPath = (cx, hw, hs, top) => {
  const p = new THREE.Path(); p.moveTo(cx - hw, 0); p.lineTo(cx - hw, hs);
  p.quadraticCurveTo(cx - hw, hs + (top - hs) * 0.78, cx, top); p.quadraticCurveTo(cx + hw, hs + (top - hs) * 0.78, cx + hw, hs); p.lineTo(cx + hw, 0); p.lineTo(cx - hw, 0);
  return p;
};
// the same arch on a canvas, in metres: X(m) and Y(m) map the model's metres to pixels
const archPath = (g, X, Y, cx, hw, y0, hs, top) => {
  g.beginPath(); g.moveTo(X(cx - hw), Y(y0)); g.lineTo(X(cx - hw), Y(y0 + hs)); g.quadraticCurveTo(X(cx - hw), Y(y0 + hs + (top - hs) * 0.78), X(cx), Y(y0 + top));
  g.quadraticCurveTo(X(cx + hw), Y(y0 + hs + (top - hs) * 0.78), X(cx + hw), Y(y0 + hs)); g.lineTo(X(cx + hw), Y(y0)); g.closePath();
};

// ====================================================================================================
// La Zisa (Palermo, 1165-1175): a 36 x 20 m block of ochre ashlar, three storeys under a crenellated parapet. Ground floor: the great iwan (a tall pointed arch in a wider
// pointed frame) on the axis with a smaller doorway each side; above them seven tall blind arches round the windows and a row of small ones under the inscription band.
// Behind the iwan the Sala della Fontana: marble walls, the gold mosaic frieze, the muqarnas niche at the back and the water channel that runs out of it over the floor, down
// a stepped cascade between two flights of stairs into the long pool; the garden round it. The later pink belvedere on the roof and the corner turrets.
// ====================================================================================================
const ZW = 36, ZD = 19.6, ZH = 25.2, SLAB_H = 12.4, IW = 4.8, IH = 8.6, PODIUM = 1.2, POOL_GAP = 3.0, POOL_L = 23.2;
const ZIS = (() => {   // fitted to the OSM footprint once, at load (no ground needed): origin, front normal
  const pts = pairsOf(FP.zisa.p), ob = obb(pts), fr = facing(ob, -1, 0.1);
  return { ob, fr, W: Math.min(fr.w, ZW), D: Math.min(fr.d, ZD) };
})();
function paintZisaLow(g, w, h) {   // the ground floor and the first window row: ashlar, the framing arches, the flank windows; metres from the left edge, y up
  const sx = w / ZW, sy = h / SLAB_H, X = (m) => (m + ZW / 2) * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, ZW, SLAB_H, 0.5, 1.15, '#c7ad7e', '#8c7753', 811, 2, 0.07);
  g.fillStyle = 'rgba(40,30,18,0.22)'; g.fillRect(0, Y(0.9), w, 0.9 * sy);                                        // the plinth
  const ring = (cx, hw, hs, top, lw, col) => { archPath(g, X, Y, cx, hw, 0, hs, top); g.lineWidth = lw * sx; g.strokeStyle = col; g.stroke(); };
  // the great frame arch round the iwan: a wide band of lighter stone, a shadow line inside it
  archPath(g, X, Y, 0, 5.1, 0, 6.2, 11.6); g.fillStyle = '#b8a174'; g.fill();
  ring(0, 5.1, 6.2, 11.6, 0.55, '#e0cfa2'); ring(0, 4.5, 6.0, 10.9, 0.18, 'rgba(50,38,22,0.7)');
  for (const sg of [-1, 1]) { archPath(g, X, Y, sg * 9.4, 2.9, 0, 3.9, 8.5); g.fillStyle = '#b8a174'; g.fill(); ring(sg * 9.4, 2.9, 3.9, 8.5, 0.4, '#e0cfa2'); ring(sg * 9.4, 2.5, 3.8, 7.9, 0.14, 'rgba(50,38,22,0.7)'); }
  const rect = (cx, y0, y1, ww) => { g.fillStyle = '#231c15'; g.fillRect(X(cx - ww / 2), Y(y1), ww * sx, (y1 - y0) * sy); g.fillStyle = '#e3d3a8'; g.fillRect(X(cx - ww / 2) - 2, Y(y1) - 2, ww * sx + 4, 3); g.fillRect(X(cx - ww / 2) - 2, Y(y0), ww * sx + 4, 3); };
  for (const x of [-14.4, -9.7, 9.7, 14.4]) rect(x, 9.5, 12.0, 1.05);                                        // the flank windows of the first row
  g.fillStyle = '#e8dcb6'; g.beginPath(); g.ellipse(X(0), Y(12.0), 1.1 * sx, 0.55 * sy, 0, 0, 7); g.fill();  // the cartouche over the frame arch
  g.strokeStyle = 'rgba(60,45,25,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, Y(8.3)); g.lineTo(w, Y(8.3)); g.stroke();   // the string course the tall arches stand on
  streaks(g, w, h, 40, 812, 0.2, 200);
  const gb = g.createLinearGradient(0, h, 0, h - 3 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.4)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 3 * sy, w, 3 * sy);
}
function paintZisaUp(g, w, h) {   // from 12.4 m to the parapet: seven tall blind arches with a window each, the row of small arches, the band of the inscription
  const UH = ZH - SLAB_H, sx = w / ZW, sy = h / UH, X = (m) => (m + ZW / 2) * sx, Y = (y) => h - (y - SLAB_H) * sy;
  paintAshlar(g, w, h, ZW, UH, 0.5, 1.15, '#c9b082', '#8c7753', 813, 2, 0.07);
  for (let i = 0; i < 7; i++) {
    const cx = (i - 3) * 4.8;
    archPath(g, X, Y, cx, 2.0, 12.4, 6.8, 9.4); g.fillStyle = '#b09a70'; g.fill(); g.lineWidth = 0.28 * sx; g.strokeStyle = '#dccb9c'; g.stroke();     // the tall blind arch
    archPath(g, X, Y, cx, 1.55, 12.6, 6.3, 8.7); g.fillStyle = '#a28b63'; g.fill();
    g.fillStyle = '#231c15'; g.fillRect(X(cx - 0.52), Y(18.4), 1.04 * sx, 3.0 * sy); g.fillStyle = '#e3d3a8'; g.fillRect(X(cx - 0.62), Y(18.4) - 2, 1.24 * sx, 3);   // the window
    g.fillStyle = '#231c15'; g.fillRect(X(cx - 0.52), Y(14.2), 1.04 * sx, 1.7 * sy);                                                                       // and the lower one
  }
  for (let i = 0; i < 14; i++) { const cx = (i - 6.5) * 2.4; archPath(g, X, Y, cx, 0.9, 21.0, 1.1, 2.2); g.fillStyle = '#a99366'; g.fill(); g.lineWidth = 0.14 * sx; g.strokeStyle = '#d6c496'; g.stroke(); }
  g.fillStyle = '#3a2f22'; g.fillRect(0, Y(24.6), w, 0.7 * sy); g.fillStyle = '#c9b78e'; for (let x = 0.3; x < ZW; x += 0.55) g.fillRect(X(x - ZW / 2), Y(24.5), 0.28 * sx, 0.4 * sy);   // the inscription band
  g.fillStyle = 'rgba(40,30,20,0.2)'; g.fillRect(0, Y(21.0), w, 0.12 * sy);
  streaks(g, w, h, 50, 814, 0.2, 200);
}
function paintZisaInt(g, w, h) {   // the side walls of the hall, 5.8 m x 8.6 m: marble to 2.4 m, the gold mosaic frieze, a plain stucco above
  const sx = w / 5.8, sy = h / IH, Y = (y) => h - y * sy;
  g.fillStyle = '#d9cfae'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8e2d0'; g.fillRect(0, Y(2.4), w, 2.4 * sy); g.strokeStyle = 'rgba(90,80,60,0.35)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 1.45 * sx) { g.beginPath(); g.moveTo(x, Y(2.4)); g.lineTo(x, h); g.stroke(); }
  g.fillStyle = '#b8a47a'; g.fillRect(0, Y(2.55), w, 0.15 * sy);
  g.fillStyle = '#c9a24a'; g.fillRect(0, Y(4.0), w, 1.45 * sy);                                                  // the gold ground of the frieze
  const cols = ['#2a6a8a', '#7a2a26', '#3a7a4a', '#f0e6c0']; for (let x = 0; x < w; x += 0.5 * sx) { g.fillStyle = cols[((x / (0.5 * sx)) | 0) % 4]; g.fillRect(x + 2, Y(3.8), 0.32 * sx, 0.45 * sy); g.fillRect(x + 2, Y(3.1), 0.32 * sx, 0.3 * sy); }
  noiseDots(g, w, h, 500, 2.5, 815, ['rgba(110,90,60,0.1)', 'rgba(255,250,230,0.1)']);
}
function paintZisaNiche(g, w, h) {   // the back wall of the hall, IW x IH: the marble slab with the carved zigzag channel, the mosaic roundels, the muqarnas niche
  const sx = w / IW, sy = h / IH, X = (m) => (m + IW / 2) * sx, Y = (y) => h - y * sy;
  g.fillStyle = '#d9cfae'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d0'; g.fillRect(0, Y(2.4), w, 2.4 * sy);
  g.fillStyle = '#c9a24a'; g.fillRect(0, Y(4.0), w, 1.45 * sy);
  const cols = ['#2a6a8a', '#7a2a26', '#3a7a4a', '#f0e6c0']; for (let x = 0; x < w; x += 0.5 * sx) { g.fillStyle = cols[((x / (0.5 * sx)) | 0) % 4]; g.fillRect(x + 2, Y(3.8), 0.32 * sx, 0.45 * sy); }
  // the chadar: a carved slab from the niche to the floor, zigzag grooves the water runs down
  g.fillStyle = '#efe9d6'; g.fillRect(X(-0.55), Y(2.4), 1.1 * sx, 2.4 * sy); g.strokeStyle = '#8a8470'; g.lineWidth = 3;
  for (let y = 0.1; y < 2.3; y += 0.22) { g.beginPath(); g.moveTo(X(-0.5), Y(y)); g.lineTo(X(0), Y(y + 0.14)); g.lineTo(X(0.5), Y(y)); g.stroke(); }
  // the niche: a pointed arch of stalactite tiers (muqarnas), each tier a row of small cells, lighter above
  archPath(g, X, Y, 0, 1.3, 2.4, 3.4, 6.2); g.fillStyle = '#2a2420'; g.fill();
  for (let t = 0; t < 5; t++) { const hw = 1.2 - t * 0.2, y0 = 3.2 + t * 0.62, n = 6 - t; for (let k = 0; k < n; k++) { const x0 = -hw + (2 * hw) * k / n, x1 = -hw + (2 * hw) * (k + 1) / n; g.fillStyle = t % 2 ? '#d8c9a0' : '#c9a24a'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y0)); g.lineTo(X((x0 + x1) / 2), Y(y0 + 0.62)); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,45,25,0.6)'; g.lineWidth = 1.5; g.stroke(); } }
  archPath(g, X, Y, 0, 1.55, 2.4, 3.5, 6.7); g.lineWidth = 0.22 * sx; g.strokeStyle = '#c9a24a'; g.stroke();
  for (const sg of [-1, 1]) { g.fillStyle = '#f0e6c0'; g.beginPath(); g.arc(X(sg * 1.85), Y(5.2), 0.34 * sx, 0, 7); g.fill(); g.fillStyle = '#2a6a8a'; g.beginPath(); g.arc(X(sg * 1.85), Y(5.2), 0.2 * sx, 0, 7); g.fill(); }   // the roundels
  noiseDots(g, w, h, 400, 2.5, 816, ['rgba(110,90,60,0.1)', 'rgba(255,250,230,0.1)']);
}
function buildZisa() {
  initShared();
  const { ob, fr, W, D } = ZIS, pts = pairsOf(FP.zisa.p), gr = groundRange(pts);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy + PODIUM, ob.cz, fr.nx, fr.nz), M0 = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  defMat('zfLow', 1024, 360, [W, SLAB_H], paintZisaLow);
  defMat('zfUp', 1024, 380, [W, ZH - SLAB_H], paintZisaUp);
  defMat('zfInt', 256, 400, [5.8, IH], paintZisaInt);
  defMat('zfNiche', 256, 400, [IW, IH], paintZisaNiche);
  defMat('zfAshlar', 256, 256, [5, 5], (g, w, h) => paintAshlar(g, w, h, 5, 5, 0.5, 1.15, '#c2a97a', '#8c7753', 817, 2, 0.07));
  defMat('zfFloor', 128, 128, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#d6cdb2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b9ad8a'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); noiseDots(g, w, h, 300, 2, 818, ['rgba(110,90,60,0.1)']); });
  defMat('zfGravel', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#c4b490'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 2.2, 819, ['rgba(120,100,70,0.3)', 'rgba(240,225,190,0.3)']); });
  defMat('zfPlain', 0, 0, [1, 1], null);
  const front = D / 2, SL = 1.0;                                            // the front plane and the thickness of the front slab
  const wall = (x0, x1, y0, y1, z0, z1, key = 'zfAshlar') => bx(key, M, x0, x1, y0, y1, z0, z1);
  // the podium the palace stands on, a skirt down to the ground, and the footing under the whole block
  bx('stone', M0, -W / 2 - 1.0, W / 2 + 1.0, -2.5, PODIUM, -D / 2 - 1.0, front + 4.0, { c: '#b8a98a' });
  // the block: back part, the two solid sides of the hall, the roof over the hall, the full-width front slab with its three openings, the wall over it
  wall(-W / 2, W / 2, 0, ZH, -D / 2, front - 6.8);
  wall(-W / 2, -IW / 2, 0, ZH, front - 6.8, front - SL); wall(IW / 2, W / 2, 0, ZH, front - 6.8, front - SL);
  wall(-IW / 2, IW / 2, IH + 0.3, ZH, front - 6.8, front - SL);
  wall(-W / 2, W / 2, SLAB_H, ZH, front - SL, front);
  const slab = new THREE.Shape(); slab.moveTo(-W / 2, 0); slab.lineTo(W / 2, 0); slab.lineTo(W / 2, SLAB_H); slab.lineTo(-W / 2, SLAB_H); slab.lineTo(-W / 2, 0);
  slab.holes.push(pointedPath(0, IW / 2, 6.0, IH)); slab.holes.push(pointedPath(-9.4, 1.7, 3.6, 6.4)); slab.holes.push(pointedPath(9.4, 1.7, 3.6, 6.4));
  extrude('zfLow', slab, SL, { M: mul(M, tr(0, 0, front - SL)), uv: 'keep', uvk: [1 / W, 1 / SLAB_H], uvo: [0.5, 0] });
  panel('zfUp', W, ZH - SLAB_H, { M: mul(M, tr(0, SLAB_H, front + 0.01)) });
  // the two side doorways: a black recess behind each
  for (const sg of [-1, 1]) panel('dark', 3.6, 6.6, { M: mul(M, tr(sg * 9.4, 0, front - SL + 0.02)), c: '#17120d' });
  // the Sala della Fontana: the floor with the channel, the marble side walls, the back wall with the niche, the muqarnas tiers in relief, the vaulted ceiling
  bx('zfFloor', M, -IW / 2, IW / 2, 0.02, 0.06, front - 6.8, front - SL + 0.4);
  for (const sg of [-1, 1]) panel('zfInt', 5.8, IH, { M: mul(M, mul(tr(sg * (IW / 2 - 0.01), 0, front - 6.8 + 2.9), rotY(-sg * PI / 2))) });
  panel('zfNiche', IW, IH, { M: mul(M, tr(0, 0, front - 6.8 + 0.02)) });
  for (let t = 0; t < 5; t++) bx('zfAshlar', M, -(1.15 - t * 0.2), 1.15 - t * 0.2, 3.2 + t * 0.62, 3.2 + t * 0.62 + 0.3, front - 6.8 + 0.02, front - 6.8 + 0.22 + t * 0.1, { c: t % 2 ? '#e0d4ae' : '#cbae5a' });
  bx('zfPlain', M, -IW / 2, IW / 2, IH, IH + 0.3, front - 6.8, front - SL, { c: '#c9a24a' });
  bx('glass', M, -0.4, 0.4, 0.05, 0.12, front - 6.8 + 0.1, front + 4.0, { c: '#5f95ad', noao: true });   // the water: from the foot of the niche, over the hall floor, out over the terrace
  bx('marble', M, -0.55, 0.55, 0.06, 0.12, front - 6.8 + 0.02, front - 6.8 + 0.12, { c: '#efe9d6' });
  // the terrace in front of the iwan, the cascade down to the pool between two flights of stairs, the gravel, and the long pool with its red coping
  const TZ1 = front + 4.0, PZ0 = TZ1 + POOL_GAP, PW = 11.0;
  bx('zfFloor', M0, -W / 2 - 0.4, W / 2 + 0.4, PODIUM, PODIUM + 0.04, front, TZ1);
  for (let i = 0; i < 2; i++) {
    const z0 = TZ1 + i * 1.0, z1 = z0 + 1.0, top = 0.8 - i * 0.4;
    for (const sg of [-1, 1]) bx('zfFloor', M0, Math.min(sg * 1.0, sg * 4.6), Math.max(sg * 1.0, sg * 4.6), 0, top, z0, z1, { c: '#cbbf9f' });
    bx('zfFloor', M0, -0.7, 0.7, 0, top - 0.02, z0, z1, { c: '#cbbf9f' });
    bx('glass', M0, -0.7, 0.7, top - 0.02, top + 0.04, z0, z1, { c: '#6aa3b8', noao: true });                    // the sheet of water over each step
  }
  for (const sg of [-1, 1]) bx('marble', M0, Math.min(sg * 0.7, sg * 1.0), Math.max(sg * 0.7, sg * 1.0), 0, PODIUM + 0.3, TZ1, TZ1 + 2.0, { c: '#e0d9c4' });
  bx('zfGravel', M0, -W / 2 - 1.0, W / 2 + 1.0, 0.01, 0.05, TZ1 + 2.0, PZ0);
  const PE = PZ0 + POOL_L + 1.2;
  for (const [x0, x1, z0, z1] of [[-PW - 0.6, -PW, PZ0, PE], [PW, PW + 0.6, PZ0, PE], [-PW, PW, PZ0, PZ0 + 0.6], [-PW, PW, PE - 0.6, PE]]) bx('earth', M0, x0, x1, 0, 0.5, z0, z1, { c: '#a5614a' });
  bx('glass', M0, -PW, PW, 0, 0.44, PZ0 + 0.6, PE - 0.6, { c: '#5f95ad', noao: true });
  bx('zfGravel', M0, -W / 2 - 1.0, W / 2 + 1.0, 0.01, 0.05, PZ0 + POOL_L + 1.2, PZ0 + POOL_L + 7.8);
  // the garden: clipped hedges along the pool, orange trees, palms by the corners of the palace
  ensureTrunk();
  const hz0 = PZ0 - 0.5, hz1 = hz0 + POOL_L + 1.2;
  for (const sg of [-1, 1]) { bx('flat', M0, sg * (PW + 2.4) - 0.5, sg * (PW + 2.4) + 0.5, 0, 0.95, hz0, hz1, { c: '#3a6030' }); bx('flat', M0, sg * (PW + 5.0) - 0.5, sg * (PW + 5.0) + 0.5, 0, 0.95, hz0 + 3, hz1 - 3, { c: '#40693a' }); }
  for (const [x, z] of [[-PW - 3.8, hz0 + 2], [PW + 3.8, hz0 + 2], [-PW - 3.8, hz1 - 2], [PW + 3.8, hz1 - 2], [-PW - 3.8, hz0 + 13], [PW + 3.8, hz0 + 13]]) {
    const p = wpt([ob.cx, ob.cz], fr.nx, fr.nz, x, z); cyl('trunk', 0.14, 0.2, 2.0, 6, { p: [p[0], gy, p[1]], noao: true }); sphere('flat', 1.5, { p: [p[0], gy + 2.8, p[1]], seg: 7, ky: 0.9, c: '#4a7436', noao: true });
    for (const [a, b] of [[0.6, 0.4], [-0.5, 0.6]]) sphere('flat', 0.22, { p: [p[0] + a * 1.2, gy + 3.0 + b, p[1] + b * 1.2], seg: 4, c: '#e08a24', noao: true });
  }
  for (const [x, z] of [[-W / 2 - 3.0, front + 2], [W / 2 + 3.0, front + 2], [-W / 2 + 3.0, front + 9], [W / 2 - 3.0, front + 9]]) { const p = wpt([ob.cx, ob.cz], fr.nx, fr.nz, x, z); palm(p[0], gy, p[1], 9.5); }
  // the parapet with its merlons, the inscription is on the wall; the corner turrets with their cones; the pink belvedere on the roof
  for (let q = 0; q < 4; q++) crenel(mul(M, mul(rotY(q * PI / 2), tr(0, ZH, (q % 2 ? W : D) / 2 - 0.02))), q % 2 ? D : W, { c: '#d3bd8c' });
  bx('zfPlain', M, -W / 2 - 0.15, W / 2 + 0.15, ZH - 0.5, ZH, -D / 2 - 0.15, D / 2 + 0.15, { c: '#c9b284' });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const Mt = mul(M, tr(x * (W / 2 - 0.9), ZH, z * (D / 2 - 0.9))); cyl('zfAshlar', 0.85, 0.95, 2.6, 8, { M: Mt }); cone('zfPlain', 1.05, 1.8, 8, { M: mul(Mt, tr(0, 2.6, 0)), c: '#c9b284' }); sphere('flat', 0.18, { M: mul(Mt, tr(0, 4.55, 0)), seg: 5, c: '#c9a24a', noao: true }); }
  defMat('zfPink', 256, 128, [14, 6], (g, w, h) => { g.fillStyle = '#c0645a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 400, 2, 820, ['rgba(120,50,40,0.18)', 'rgba(240,190,170,0.14)']); g.fillStyle = '#2a1e1c'; for (let i = 0; i < 4; i++) { const cx = (i + 0.5) * w / 4; g.beginPath(); g.moveTo(cx - 16, h); g.lineTo(cx - 16, 48); g.arc(cx, 48, 16, Math.PI, 0); g.lineTo(cx + 16, h); g.fill(); } });
  bx('zfPink', M, -7, 7, ZH, ZH + 5.2, -3.4, 3.4);
  bx('zfPlain', M, -7.4, 7.4, ZH + 5.2, ZH + 5.7, -3.8, 3.8, { c: '#d9a99a' });
  for (const sg of [-1, 1]) bx('zfPink', M, sg * 9.2 - 1.7, sg * 9.2 + 1.7, ZH, ZH + 3.8, -2.2, 2.2);
  return end('La Zisa');
}
const ZIS_WALLS = (() => {   // the podium (the facade, the cascade), the pool's coping and the hedges: all are walls to a car
  const O = [ZIS.ob.cx, ZIS.ob.cz], { nx, nz } = ZIS.fr, f = ZIS.D / 2, out = [];
  out.push(...rectSegs(O, nx, nz, -ZIS.W / 2 - 1.2, ZIS.W / 2 + 1.2, -f - 1.2, f + 4.0));                                   // the podium
  const p0 = f + 4.0 + POOL_GAP, p1 = p0 + POOL_L + 1.2;
  out.push(...rectSegs(O, nx, nz, -11.6, 11.6, p0, p1));                                                                    // the pool
  for (const sg of [-1, 1]) out.push(...rectSegs(O, nx, nz, sg * 13.4 - 0.5, sg * 13.4 + 0.5, p0 - 0.5, p1));               // the hedges beside it
  return out;
})();
export const ZISA = { name: 'La Zisa', x: -1770, z: -116, radius: 80, skipIds: [FP.zisa.id], build: buildZisa, walls: ZIS_WALLS };

// ====================================================================================================
// The Palazzina Cinese in the Favorita (Venanzio Marvuglia, 1799): a lilac-grey base with pointed arches, two storeys of orange plaster banded in terracotta pink with green
// shutters, a round columned portico on the front reached by a double stair, an open lattice loggia on the roof round a small tower under a gold pyramid and a spire of discs,
// two slender stair turrets at the front corners, and the two chevron-patterned gate pillars with their lamps in front of the iron fence.
// ====================================================================================================
const CIN = (() => {
  const pts = pairsOf(FP.cinese.p), ob = obb(pts), fr = facing(ob, 0.1, 1);
  return { ob, fr, W: Math.min(fr.w, 16.6), D: Math.min(fr.d, 13.2) };
})();
function buildCinese() {
  initShared(); ensureTrunk();
  const { ob, fr, W, D } = CIN, pts = pairsOf(FP.cinese.p), gr = groundRange(pts);
  const gy = gr.hi + 0.1, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const PH = 3.2, FH = 4.4, F1 = PH, F2 = PH + FH, F3 = PH + 2 * FH, LG = 3.0, front = D / 2 - 0.6;
  const ORANGE = '#e9a45e', PINK = '#d8745c', LAC = '#b8a9bd';
  defMat('cfBase', 256, 218, [3.0, 3.2], (g, w, h) => {   // the lilac base: ashlar and, in every bay, a pointed arch (open and dark, or filled with salmon plaster, or a lancet window)
    paintAshlar(g, w, h, 3.0, 3.2, 0.5, 1.1, LAC, '#8b7d92', 831, 2, 0.05);
    const sx = w / 3.0, sy = h / 3.2, X = (m) => m * sx, Y = (y) => h - y * sy;
    archPath(g, X, Y, 1.5, 0.62, 0, 1.55, 2.5); g.fillStyle = '#d98a6a'; g.fill(); g.lineWidth = 0.14 * sx; g.strokeStyle = '#efe6d6'; g.stroke();
    archPath(g, X, Y, 1.5, 0.38, 0, 1.3, 2.0); g.fillStyle = '#3a2e30'; g.fill();
    streaks(g, w, h, 8, 832, 0.15, 90);
  });
  defMat('cfWall', 256, 352, [3.2, FH], (g, w, h) => {   // an orange bay: terracotta bands top and bottom, a tall shuttered window and its balcony rail
    g.fillStyle = ORANGE; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 2, 833, ['rgba(130,70,30,0.12)', 'rgba(255,235,190,0.14)']);
    const sx = w / 3.2, sy = h / FH, Y = (y) => h - y * sy;
    g.fillStyle = PINK; g.fillRect(0, Y(0.5), w, 0.5 * sy); g.fillRect(0, 0, w, 0.45 * sy); g.fillStyle = 'rgba(60,25,15,0.3)'; g.fillRect(0, Y(0.5), w, 2); g.fillRect(0, 0.45 * sy, w, 2);
    g.fillStyle = '#e8c9a0'; g.fillRect(0, 0, 0.16 * sx, h); g.fillRect(w - 0.16 * sx, 0, 0.16 * sx, h);
    g.fillStyle = '#f0dcc0'; g.fillRect(0.7 * sx, Y(3.55), 1.8 * sx, 2.65 * sy);        // the frame
    g.fillStyle = '#1f2a22'; g.fillRect(0.82 * sx, Y(3.43), 1.56 * sx, 2.41 * sy);
    g.fillStyle = 'rgba(170,195,215,0.25)'; g.fillRect(0.82 * sx, Y(3.43), 1.56 * sx, 1.2 * sy);
    g.fillStyle = '#3f6a46'; g.fillRect(0.56 * sx, Y(3.5), 0.64 * sx, 2.5 * sy); g.fillRect(2.0 * sx, Y(3.5), 0.64 * sx, 2.5 * sy);   // the open green shutters
    g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 1.1; y < 3.4; y += 0.14) { g.fillRect(0.56 * sx, Y(y), 0.64 * sx, 1.5); g.fillRect(2.0 * sx, Y(y), 0.64 * sx, 1.5); }
    g.strokeStyle = '#e8d2a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(0.4 * sx, Y(1.9)); g.lineTo(2.8 * sx, Y(1.9)); g.stroke(); for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo((0.4 + k * 0.3) * sx, Y(1.9)); g.lineTo((0.4 + k * 0.3) * sx, Y(1.0)); g.stroke(); }
    g.fillStyle = PINK; g.fillRect(0, Y(4.0), w, 0.12 * sy);
  });
  defMat('cfTower', 256, 256, [4.4, 4.4], (g, w, h) => { g.fillStyle = ORANGE; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 600, 2, 834, ['rgba(130,70,30,0.12)', 'rgba(255,235,190,0.14)']); g.fillStyle = PINK; g.fillRect(0, 0, w, 24); g.fillRect(0, h - 24, w, 24); g.fillStyle = '#1f2a22'; for (const x of [50, 150]) { g.fillRect(x, 80, 56, 110); g.fillStyle = '#f0dcc0'; g.fillRect(x - 6, 74, 68, 8); g.fillStyle = '#1f2a22'; } });
  defMat('cfPillar', 128, 128, [2, 2], (g, w, h) => { g.fillStyle = '#e4b47e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9763a'; g.lineWidth = 9; for (let y = -16; y < h + 16; y += 32) { g.beginPath(); g.moveTo(0, y + 16); g.lineTo(w / 2, y); g.lineTo(w, y + 16); g.stroke(); } noiseDots(g, w, h, 200, 2, 835, ['rgba(110,70,30,0.15)']); });
  defMat('cfTurret', 64, 128, [1.4, 3.0], (g, w, h) => { g.fillStyle = '#e8b17c'; g.fillRect(0, 0, w, h); g.fillStyle = PINK; for (let y = -64; y < h + 64; y += 22) { g.beginPath(); g.moveTo(0, y + 14); g.lineTo(w, y); g.lineTo(w, y + 6); g.lineTo(0, y + 20); g.fill(); } g.fillStyle = '#1f2a22'; g.fillRect(w / 2 - 5, 50, 10, 24); });
  defMat('cfLat', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#e08a52'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4); g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  defMat('cfIron', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#22221f'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 10, w, 5); for (let x = 5; x < w; x += 12) { g.fillRect(x, 0, 3, h); g.beginPath(); g.moveTo(x - 2, 0); g.lineTo(x + 1.5, -6 + 6); g.lineTo(x + 5, 0); g.fill(); } }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  defMat('cfGold', 0, 0, [1, 1], null, { roughness: 0.7 });
  defMat('cfHood', 0, 0, [1, 1], null, { roughness: 0.7, side: THREE.DoubleSide });
  const skirtH = -(gr.hi - gr.lo) - 2.5;
  bx('stone', M, -W / 2 - 0.6, W / 2 + 0.6, skirtH, 0.02, -D / 2 - 0.6, D / 2 + 0.6, { c: LAC });
  // the base, the two storeys (the second stands back), the open lattice loggia, the tower
  bx('cfBase', M, -W / 2 - 0.2, W / 2 + 0.2, 0, PH, -D / 2 - 0.2, D / 2 + 0.2);
  bx('flat', M, -W / 2 - 0.5, W / 2 + 0.5, PH - 0.2, PH + 0.12, -D / 2 - 0.5, D / 2 + 0.5, { c: '#d6cbd8' });
  bx('cfWall', M, -W / 2 + 0.3, W / 2 - 0.3, F1, F2, -D / 2 + 0.3, D / 2 - 0.6);
  bx('flat', M, -W / 2 + 0.1, W / 2 - 0.1, F2 - 0.1, F2 + 0.15, -D / 2 + 0.1, D / 2 - 0.3, { c: '#ecc79c' });
  bx('cfWall', M, -W / 2 + 1.3, W / 2 - 1.3, F2, F3, -D / 2 + 1.3, D / 2 - 1.6);
  bx('flat', M, -W / 2 + 1.0, W / 2 - 1.0, F3 - 0.1, F3 + 0.15, -D / 2 + 1.0, D / 2 - 1.3, { c: '#ecc79c' });
  // the verandah rail round the first floor (the balconies of the shuttered windows), thin lattice in orange
  for (let q = 0; q < 4; q++) { const L = q % 2 ? D - 0.4 : W - 0.4; panel('cfLat', L, 1.0, { M: mul(M, mul(rotY(q * PI / 2), tr(0, F1 + 0.1, (q % 2 ? W : D) / 2 - 0.15))), uvk: [L / 1.0, 1], noao: true }); }
  // the roof loggia: posts, the roof slab, lattice between them, and the tower in the middle
  const LW = W - 3.6, LD = D - 3.6, lz0 = -D / 2 + 1.8, lz1 = lz0 + LD;
  for (let i = 0; i <= 4; i++) for (const z of [lz0, lz1]) bx('cfGold', M, -LW / 2 + i * LW / 4 - 0.17, -LW / 2 + i * LW / 4 + 0.17, F3, F3 + LG, z - 0.17, z + 0.17, { c: '#e08a52' });
  for (const x of [-LW / 2, LW / 2]) for (const z of [lz0 + LD / 2]) bx('cfGold', M, x - 0.17, x + 0.17, F3, F3 + LG, z - 0.17, z + 0.17, { c: '#e08a52' });
  bx('cfGold', M, -LW / 2 - 0.3, LW / 2 + 0.3, F3 + LG, F3 + LG + 0.3, lz0 - 0.3, lz1 + 0.3, { c: '#e0885a' });
  for (const z of [lz0, lz1]) panel('cfLat', LW, 1.1, { M: mul(M, tr(0, F3 + 0.15, z)), uvk: [LW / 1.1, 1], noao: true });
  for (const sg of [-1, 1]) panel('cfLat', LD, 1.1, { M: mul(M, mul(tr(sg * LW / 2, F3 + 0.15, lz0 + LD / 2), rotY(PI / 2))), uvk: [LD / 1.1, 1], noao: true });
  const TWC = [0, F3, lz0 + LD / 2], Mt = mul(M, tr(...TWC)), TH = 4.6;
  bx('cfTower', Mt, -2.5, 2.5, 0, TH, -2.5, 2.5);
  bx('flat', Mt, -2.9, 2.9, TH - 0.1, TH + 0.2, -2.9, 2.9, { c: '#ecc79c' });
  pyramid('cfGold', 6.4, 6.4, 2.8, { M: mul(Mt, tr(0, TH + 0.2, 0)), c: '#dba72a', noao: true });
  cyl('flat', 0.12, 0.16, 1.4, 6, { M: mul(Mt, tr(0, TH + 3.0, 0)), c: '#2a2a2a' });
  for (const [k, r] of [[0, 0.52], [1, 0.42], [2, 0.34], [3, 0.26]]) cyl('cfGold', r, r, 0.12, 10, { M: mul(Mt, tr(0, TH + 3.2 + k * 0.45, 0)), c: k % 2 ? '#d9b24a' : '#2a2a2a', noao: true });
  sphere('cfGold', 0.2, { M: mul(Mt, tr(0, TH + 5.1, 0)), c: '#d9b24a', seg: 6, noao: true });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cone('cfGold', 0.28, 1.5, 6, { M: mul(M, tr(x * (LW / 2 + 0.1), F3 + LG + 0.3, z * (LD / 2) + lz0 + LD / 2)), c: '#dba72a', noao: true });
  // the round portico: half a disc of platform, five slender columns, the flared pagoda hood, the terrace on top with its lattice rail, the double stair
  const RP = 3.0, MQ = mul(M, tr(0, 0, front));
  cyl('cfBase', RP + 0.7, RP + 0.75, PH, 16, { M: MQ, t0: -PI / 2, tl: PI });
  for (let i = 0; i < 5; i++) { const a = -1.25 + i * 0.625; cyl('marble', 0.17, 0.2, FH - 0.5, 8, { M: mul(MQ, tr(Math.sin(a) * RP, F1, Math.cos(a) * RP)), c: '#e6cdbd' }); }
  lathe('cfHood', [[RP + 1.1, 0], [RP + 0.75, 0.3], [RP + 0.2, 0.55], [RP - 0.6, 0.62], [0.01, 0.62]], 16, { M: mul(MQ, tr(0, F2 - 0.55, 0)), t0: -PI / 2, tl: PI, c: '#e08a60', noao: true });
  for (let i = 0; i < 6; i++) { const a0 = -PI / 2 + i * PI / 6, a1 = a0 + PI / 6, am = (a0 + a1) / 2, L = 2 * (RP + 0.9) * Math.sin(PI / 12); panel('cfLat', L, 1.0, { M: mul(MQ, mul(tr(Math.sin(am) * (RP + 0.9), F2 + 0.1, Math.cos(am) * (RP + 0.9)), rotY(am))), uvk: [L, 1], noao: true }); }
  for (const sg of [-1, 1]) {   // each flight climbs towards the portico along the front, 8 steps, with its lattice rail
    const n = 8, run = 0.55, rise = PH / n, x0 = sg * (RP + 0.7 + n * run);
    for (let i = 0; i < n; i++) bx('stone', M, Math.min(x0 - sg * i * run, x0 - sg * (i + 1) * run), Math.max(x0 - sg * i * run, x0 - sg * (i + 1) * run), 0, (i + 1) * rise, front + 0.3, front + 2.0, { c: '#d6cbd8' });
    const L = Math.hypot(n * run, PH), ang = Math.atan2(PH, n * run);
    for (const z of [front + 0.35, front + 1.95]) panel('cfLat', L, 1.0, { M: mul(M, tr(x0 - sg * n * run / 2, PH / 2, z)), rz: -sg * ang, uvk: [L, 1], noao: true });
  }
  // the two stair turrets at the front corners, slender, with a gold cone
  for (const sg of [-1, 1]) { const Mw = mul(M, tr(sg * (W / 2 + 0.2), 0, front - 0.2)); cyl('cfTurret', 0.85, 0.95, F3 + 0.4, 10, { M: Mw }); cone('cfGold', 1.1, 2.2, 10, { M: mul(Mw, tr(0, F3 + 0.4, 0)), c: '#dba72a', noao: true }); sphere('cfGold', 0.14, { M: mul(Mw, tr(0, F3 + 2.7, 0)), c: '#d9b24a', seg: 5, noao: true }); }
  // the gate: two chevron pillars with their lamps, the iron fence each side, the gates open between them, clipped hedges and palms behind the fence
  const GZ = D / 2 + 10.5, GX = 3.6;
  for (const sg of [-1, 1]) {
    const Mp = mul(M, tr(sg * GX, 0, GZ));
    cyl('cfPillar', 0.78, 0.9, 5.0, 12, { M: Mp }); cyl('flat', 1.0, 1.0, 0.3, 12, { M: mul(Mp, tr(0, 5.0, 0)), c: '#dcbf96' });
    cyl('flat', 0.08, 0.08, 1.1, 6, { M: mul(Mp, tr(0, 5.3, 0)), c: '#26262b', noao: true }); box('glass', 0.5, 0.7, 0.5, { M: mul(Mp, tr(0, 6.3, 0)), c: '#f6efc8', noao: true }); cone('flat', 0.36, 0.5, 4, { M: mul(Mp, tr(0, 7.0, 0)), c: '#26262b', noao: true });
    const fx0 = sg * (GX + 0.9), L = 9.0; panel('cfIron', L, 1.9, { M: mul(M, tr(fx0 + sg * L / 2, 0, GZ)), uvk: [L / 1.9, 1], noao: true });
    bx('flat', M, sg > 0 ? GX + 0.9 : -(GX + 0.9 + L), sg > 0 ? GX + 0.9 + L : -(GX + 0.9), 0, 1.1, GZ - 3.2, GZ - 2.0, { c: '#365a2e' });   // the hedge behind the fence
    panel('cfIron', 1.7, 1.9, { M: mul(M, mul(tr(sg * (GX - 1.0), 0, GZ), rotY(sg * 0.9))), uvk: [1, 1], noao: true });                     // a gate leaf, swung open
  }
  for (const [x, z] of [[-GX - 4.5, GZ + 1.6], [GX + 4.5, GZ + 1.6], [-W / 2 - 3.5, D / 2 + 3], [W / 2 + 3.5, D / 2 + 3]]) { const pt = new THREE.Vector3(x, 0, z).applyMatrix4(M); palm(pt.x, gy, pt.z, 9); }
  return end('Palazzina Cinese');
}
const CIN_WALLS = (() => {   // the stair flights and the portico's platform, the gate pillars and the fence
  const O = [CIN.ob.cx, CIN.ob.cz], { nx, nz } = CIN.fr, D = CIN.D, front = D / 2 - 0.6, GZ = D / 2 + 10.5, GX = 3.6, out = [];
  for (const sg of [-1, 1]) {
    out.push(...rectSegs(O, nx, nz, sg * GX - 0.9, sg * GX + 0.9, GZ - 0.9, GZ + 0.9));
    out.push(...lineSegs(O, nx, nz, sg * (GX + 0.9), GZ, sg * (GX + 9.9), GZ));
    const x0 = sg * (3.7 + 4.4); out.push(...rectSegs(O, nx, nz, Math.min(x0, sg * 3.7), Math.max(x0, sg * 3.7), front + 0.3, front + 2.0));
  }
  out.push(...rectSegs(O, nx, nz, -3.9, 3.9, front, front + 3.9));
  return out;
})();
export const CINESE = { name: 'Palazzina Cinese', x: -2707, z: -5644, radius: 60, skipIds: [FP.cinese.id], build: buildCinese, walls: CIN_WALLS };
