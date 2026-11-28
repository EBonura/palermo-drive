// City landmarks, group F (review-2 items 6 and 7): La Zisa and the Palazzina Cinese, rebuilt after the Commons photographs (proportions only, nothing is stored).
// Same toolkit and the same way of working as the other city landmarks (src/lmc-kit.js): painted textures for the walls, real geometry for what stands out of them or goes
// in behind them, one bin per material, built on the streamed ground, collision for what stands outside the footprints. Notes: docs/faithfulness/landmarks.md (review 2).
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, pyramid,
  mul, tr, rotY, frame, pairsOf, obb, facing, groundRange, groundY, initShared, ensureTrunk, paintAshlar, noiseDots, streaks, palm, crenel, rail,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';
import { TREE_CLEAR } from './tree-clear.js';

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
// La Zisa (Palermo, 12th century): a 36.6 x 20.6 m block of ochre ashlar under a crenellated parapet, its front to the EAST, over the garden. Front: the great iwan
// (a tall pointed arch in a wider pointed frame) on the axis with a smaller doorway each side, the carved emblem over it, two square windows either side of the middle
// storey inside blind arches, and on top seven tall blind arches round the upper windows. The short sides carry blind arches in three tiers and, in the middle of each,
// the projecting bay of the footprint ending in a small turret with a pyramid cap; the rear has its own row of blind arches and small round-headed windows. Set back on the roof the
// remains of the later attic: two ochre pavilions with a low wall between. Behind the iwan the Sala della Fontana with its niche and water channel; in front, a low
// basin with a red rim and clipped hedges along the wall.
// Photos (Wikimedia Commons, looked at only): "East facade of La Zisa, Palermo" (both), "East and south facade of La Zisa, Palermo", "North facade of La Zisa, Palermo",
// "La Zisa (Palermo) msu2017-0472", "0690 - PA - La Zisa", "Palazzo Zisa PA 03", "La Zisa (Palermo) 19 06 2026 22" to "36" (rear and sides).
// Not verified: the exact spacing of the rear windows, the south side (drawn as the north one), the depth of the attic on the roof, the basin's size.
// ====================================================================================================
const ZW = 36.6, ZD = 20.6, ZH = 23.2, SLAB_H = 12.4, IW = 4.8, IH = 9.4, PROJ = 2.8, PW2 = 2.4;
const ZIS = (() => {   // fitted to the OSM footprint once, at load (no ground needed): origin, front normal (east)
  const pts = pairsOf(FP.zisa.p), ob = obb(pts), fr = facing(ob, 1, 0);
  return { ob, fr, W: Math.min(fr.w, ZW), D: Math.min(fr.d, ZD) };
})();
// a blind arch sunk in the wall: the shadowed field, a light outer moulding and a second one inside it. y0 foot, hs springing, top apex (metres above the ground)
const blind = (g, X, Y, sx, cx, hw, y0, hs, top, deep = true) => {
  archPath(g, X, Y, cx, hw, y0, hs - y0, top - y0); g.fillStyle = '#baa88a'; g.fill(); g.lineWidth = 0.22 * sx; g.strokeStyle = '#d8caac'; g.stroke();
  g.lineWidth = Math.max(1, 0.07 * sx); g.strokeStyle = 'rgba(55,40,22,0.6)'; g.stroke();
  if (!deep) return;
  archPath(g, X, Y, cx, hw * 0.72, y0 + 0.15, hs - y0 - 0.35, top - y0 - 0.7); g.fillStyle = '#b09d80'; g.fill(); g.lineWidth = Math.max(1, 0.1 * sx); g.strokeStyle = '#cfbf9f'; g.stroke();
};
const course = (g, Y, sy, w, y) => { g.fillStyle = '#d9c799'; g.fillRect(0, Y(y + 0.16), w, 0.16 * sy); g.fillStyle = 'rgba(50,36,20,0.55)'; g.fillRect(0, Y(y), w, Math.max(1, 0.09 * sy)); };
const zwin = (g, X, Y, sx, sy, cx, y0, y1, ww, round) => {   // a window: stone surround, dark glass, for the square ones a pale frame and mullion
  g.fillStyle = '#e3d3a8';
  if (round) { archPath(g, X, Y, cx, ww / 2 + 0.16, y0 - 0.1, y1 - y0 - ww / 2, y1 - y0 + 0.3); g.fill(); g.fillStyle = '#2a251f'; archPath(g, X, Y, cx, ww / 2, y0, y1 - y0 - ww / 2, y1 - y0); g.fill(); return; }
  g.fillRect(X(cx - ww / 2 - 0.14), Y(y1 + 0.18), (ww + 0.28) * sx, (y1 - y0 + 0.3) * sy);
  g.fillStyle = '#26231f'; g.fillRect(X(cx - ww / 2), Y(y1), ww * sx, (y1 - y0) * sy);
  g.fillStyle = 'rgba(190,200,205,0.45)'; g.fillRect(X(cx - ww / 2) + 2, Y(y1) + 2, ww * sx - 4, (y1 - y0) * sy * 0.62);
  g.fillStyle = '#d8d2c2'; g.fillRect(X(cx) - 1, Y(y1), 2, (y1 - y0) * sy); g.fillRect(X(cx - ww / 2), Y(y1 - (y1 - y0) * 0.62), ww * sx, 2);
};
function paintZisaLow(g, w, h) {   // 0 to 12.4 m: the plinth, the three doorways in their arches, the middle storey's windows
  const sx = w / ZW, sy = h / SLAB_H, X = (m) => (m + ZW / 2) * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, ZW, SLAB_H, 0.5, 1.15, '#c2b093', '#9b8a6c', 811, 1.5, 0.08);
  g.fillStyle = 'rgba(40,30,18,0.2)'; g.fillRect(0, Y(0.9), w, 0.9 * sy);
  course(g, Y, sy, w, 6.9);
  for (const x of [-14.4, -9.9, 9.9, 14.4]) { blind(g, X, Y, sx, x, 1.9, 7.1, 10.0, 12.0, false); zwin(g, X, Y, sx, sy, x, 7.9, 10.2, 1.35); }
  blind(g, X, Y, sx, 0, 4.3, 0, 6.6, 11.3, false); blind(g, X, Y, sx, 0, 3.3, 0, 6.4, 10.3, false);          // the stepped frame of the iwan
  for (const sg of [-1, 1]) { blind(g, X, Y, sx, sg * 9.9, 2.25, 0, 4.0, 6.7, false); blind(g, X, Y, sx, sg * 9.9, 1.6, 0, 3.8, 6.0, false); }
  g.fillStyle = '#e4dcc4'; g.beginPath(); g.ellipse(X(0), Y(11.75), 0.6 * sx, 0.42 * sy, 0, 0, 7); g.fill();            // the carved emblem
  for (const sg of [-1, 1]) { g.beginPath(); g.ellipse(X(sg * 0.9), Y(11.6), 0.55 * sx, 0.22 * sy, -sg * 0.5, 0, 7); g.fill(); }
  g.fillStyle = '#8f3b30'; g.fillRect(X(5.6), Y(4.2), 1.0 * sx, 0.7 * sy);                                              // the red plaque beside the iwan
  streaks(g, w, h, 36, 812, 0.18, 130);
  const gb = g.createLinearGradient(0, h, 0, h - 3 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.36)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 3 * sy, w, 3 * sy);
}
function paintZisaUp(g, w, h) {   // 12.4 m to the parapet: seven tall blind arches, a window in each (the third and fifth small and round headed)
  const UH = ZH - SLAB_H, sx = w / ZW, sy = h / UH, X = (m) => (m + ZW / 2) * sx, Y = (y) => h - (y - SLAB_H) * sy;
  paintAshlar(g, w, h, ZW, UH, 0.5, 1.15, '#c4b295', '#9b8a6c', 813, 1.5, 0.08);
  course(g, Y, sy, w, 12.5);
  [-14.4, -9.9, -5.0, 0, 5.0, 9.9, 14.4].forEach((x, i) => { blind(g, X, Y, sx, x, 2.05, 12.8, 19.6, 22.0); if (i === 2 || i === 4) zwin(g, X, Y, sx, sy, x, 15.0, 17.2, 0.75, true); else zwin(g, X, Y, sx, sy, x, 15.0, 17.5, 1.35); });
  course(g, Y, sy, w, 22.35);
  streaks(g, w, h, 44, 814, 0.18, 130);
}
function paintZisaSide(g, w, h) {   // a short side, ZD wide: three tiers of blind arches either side of the middle (the projecting bay shows the middle of this canvas)
  const sx = w / ZD, sy = h / ZH, X = (m) => (m + ZD / 2) * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, ZD, ZH, 0.5, 1.15, '#c0ae91', '#9b8a6c', 815, 1.5, 0.08);
  for (const y of [6.9, 12.5, 22.35]) course(g, Y, sy, w, y);
  for (const x of [-6.4, 0, 6.4]) {
    const hw = x ? 2.5 : 1.7;
    blind(g, X, Y, sx, x, hw, 0.9, 4.6, 6.4); blind(g, X, Y, sx, x, hw, 7.2, 10.1, 11.9); blind(g, X, Y, sx, x, hw, 12.8, 19.4, 21.9);
    if (x) { zwin(g, X, Y, sx, sy, x, 8.2, 9.8, 0.7, true); zwin(g, X, Y, sx, sy, x, 15.2, 17.2, 0.7, true); }
  }
  zwin(g, X, Y, sx, sy, 0, 15.2, 16.6, 0.5, true);
  streaks(g, w, h, 30, 816, 0.2, 90);
}
function paintZisaRear(g, w, h) {
  const sx = w / ZW, sy = h / ZH, X = (m) => (m + ZW / 2) * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, ZW, ZH, 0.5, 1.15, '#c4b295', '#9b8a6c', 817, 1.5, 0.09);
  course(g, Y, sy, w, 12.5); course(g, Y, sy, w, 22.35);
  for (let i = -4; i <= 4; i++) blind(g, X, Y, sx, i * 3.9, 1.6, 12.8, 19.8, 21.9, Math.abs(i) > 2);
  for (const x of [-15.6, -7.8, -4.6, 4.6, 7.8, 15.6]) zwin(g, X, Y, sx, sy, x, 14.6, 16.2, 0.9, true);
  zwin(g, X, Y, sx, sy, 0, 14.5, 16.9, 1.2);
  for (const sg of [-1, 1]) blind(g, X, Y, sx, sg * 14.6, 2.4, 6.6, 10.0, 11.9);
  for (const x of [-8.2, -5.4, 5.0, 7.8]) zwin(g, X, Y, sx, sy, x, 7.6, 9.6, 1.0, true);
  zwin(g, X, Y, sx, sy, 14.6, 7.8, 9.4, 0.7, true);
  for (const x of [-12, -4, 4, 12]) { g.fillStyle = '#2a231a'; g.fillRect(X(x - 0.35), Y(1.2), 0.7 * sx, 0.5 * sy); }
  streaks(g, w, h, 40, 818, 0.18, 110);
}
function paintZisaInt(g, w, h) {   // the side walls of the hall, 5.8 m x IH: marble to 2.4 m, the gold mosaic frieze, plain stucco above
  const sx = w / 5.8, sy = h / IH, Y = (y) => h - y * sy;
  g.fillStyle = '#d9cfae'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8e2d0'; g.fillRect(0, Y(2.4), w, 2.4 * sy); g.strokeStyle = 'rgba(90,80,60,0.35)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 1.45 * sx) { g.beginPath(); g.moveTo(x, Y(2.4)); g.lineTo(x, h); g.stroke(); }
  g.fillStyle = '#b8a47a'; g.fillRect(0, Y(2.55), w, 0.15 * sy);
  g.fillStyle = '#c9a24a'; g.fillRect(0, Y(4.0), w, 1.45 * sy);                                                  // the gold ground of the frieze
  const cols = ['#2a6a8a', '#7a2a26', '#3a7a4a', '#f0e6c0']; for (let x = 0; x < w; x += 0.5 * sx) { g.fillStyle = cols[((x / (0.5 * sx)) | 0) % 4]; g.fillRect(x + 2, Y(3.8), 0.32 * sx, 0.45 * sy); g.fillRect(x + 2, Y(3.1), 0.32 * sx, 0.3 * sy); }
  noiseDots(g, w, h, 300, 2.5, 819, ['rgba(110,90,60,0.1)', 'rgba(255,250,230,0.1)']);
}
function paintZisaNiche(g, w, h) {   // the back wall of the hall, IW x IH: the marble slab with the carved zigzag channel, the mosaic roundels, the muqarnas niche
  const sx = w / IW, sy = h / IH, X = (m) => (m + IW / 2) * sx, Y = (y) => h - y * sy;
  g.fillStyle = '#d9cfae'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d0'; g.fillRect(0, Y(2.4), w, 2.4 * sy);
  g.fillStyle = '#c9a24a'; g.fillRect(0, Y(4.0), w, 1.45 * sy);
  const cols = ['#2a6a8a', '#7a2a26', '#3a7a4a', '#f0e6c0']; for (let x = 0; x < w; x += 0.5 * sx) { g.fillStyle = cols[((x / (0.5 * sx)) | 0) % 4]; g.fillRect(x + 2, Y(3.8), 0.32 * sx, 0.45 * sy); }
  g.fillStyle = '#efe9d6'; g.fillRect(X(-0.55), Y(2.4), 1.1 * sx, 2.4 * sy); g.strokeStyle = '#8a8470'; g.lineWidth = 3;
  for (let y = 0.1; y < 2.3; y += 0.22) { g.beginPath(); g.moveTo(X(-0.5), Y(y)); g.lineTo(X(0), Y(y + 0.14)); g.lineTo(X(0.5), Y(y)); g.stroke(); }
  archPath(g, X, Y, 0, 1.3, 2.4, 3.4, 6.2); g.fillStyle = '#2a2420'; g.fill();
  for (let t = 0; t < 5; t++) { const hw = 1.2 - t * 0.2, y0 = 3.2 + t * 0.62, n = 6 - t; for (let k = 0; k < n; k++) { const x0 = -hw + (2 * hw) * k / n, x1 = -hw + (2 * hw) * (k + 1) / n; g.fillStyle = t % 2 ? '#d8c9a0' : '#c9a24a'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y0)); g.lineTo(X((x0 + x1) / 2), Y(y0 + 0.62)); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,45,25,0.6)'; g.lineWidth = 1.5; g.stroke(); } }
  archPath(g, X, Y, 0, 1.55, 2.4, 3.5, 6.7); g.lineWidth = 0.22 * sx; g.strokeStyle = '#c9a24a'; g.stroke();
  for (const sg of [-1, 1]) { g.fillStyle = '#f0e6c0'; g.beginPath(); g.arc(X(sg * 1.85), Y(5.2), 0.34 * sx, 0, 7); g.fill(); g.fillStyle = '#2a6a8a'; g.beginPath(); g.arc(X(sg * 1.85), Y(5.2), 0.2 * sx, 0, 7); g.fill(); }
  noiseDots(g, w, h, 300, 2.5, 820, ['rgba(110,90,60,0.1)', 'rgba(255,250,230,0.1)']);
}
function buildZisa() {
  initShared();
  const { ob, fr, W, D } = ZIS, pts = pairsOf(FP.zisa.p), gr = groundRange(pts);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  defMat('zfLow', 768, 260, [W, SLAB_H], paintZisaLow);
  defMat('zfUp', 768, 228, [W, ZH - SLAB_H], paintZisaUp);
  defMat('zfSide', 256, 288, [ZD, ZH], paintZisaSide);
  defMat('zfRear', 512, 320, [ZW, ZH], paintZisaRear);
  defMat('zfInt', 192, 320, [5.8, IH], paintZisaInt);
  defMat('zfNiche', 192, 384, [IW, IH], paintZisaNiche);
  defMat('zfAshlar', 256, 256, [5, 5], (g, w, h) => paintAshlar(g, w, h, 5, 5, 0.5, 1.15, '#bfad90', '#9b8a6c', 821, 2, 0.07));
  defMat('zfFloor', 128, 128, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#d6cdb2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b9ad8a'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); noiseDots(g, w, h, 300, 2, 822, ['rgba(110,90,60,0.1)']); });
  const front = D / 2, SL = 1.0, HB = 6.8;                                  // the front plane, the thickness of the front slab, the depth of the hall
  const wall = (x0, x1, y0, y1, z0, z1, key = 'zfAshlar') => bx(key, M, x0, x1, y0, y1, z0, z1);
  bx('zfAshlar', M, -W / 2 - 0.25, W / 2 + 0.25, gr.lo - gy - 1.2, 0.02, -D / 2 - 0.25, front + 0.25, { c: '#d0c4ac' });
  // the block: back part, the two solid sides of the hall, the roof over the hall, the full-width front slab with its three openings, the wall over it
  wall(-W / 2, W / 2, 0, ZH, -D / 2, front - HB);
  wall(-W / 2, -IW / 2, 0, ZH, front - HB, front - SL); wall(IW / 2, W / 2, 0, ZH, front - HB, front - SL);
  wall(-IW / 2, IW / 2, IH + 0.3, ZH, front - HB, front - SL);
  wall(-W / 2, W / 2, SLAB_H, ZH, front - SL, front);
  const slab = new THREE.Shape(); slab.moveTo(-W / 2, 0); slab.lineTo(W / 2, 0); slab.lineTo(W / 2, SLAB_H); slab.lineTo(-W / 2, SLAB_H); slab.lineTo(-W / 2, 0);
  slab.holes.push(pointedPath(0, IW / 2, 6.4, IH)); slab.holes.push(pointedPath(-9.9, 1.1, 3.4, 5.4)); slab.holes.push(pointedPath(9.9, 1.1, 3.4, 5.4));
  extrude('zfLow', slab, SL, { M: mul(M, tr(0, 0, front - SL)), uv: 'keep', uvk: [1 / W, 1 / SLAB_H], uvo: [0.5, 0] });
  panel('zfUp', W, ZH - SLAB_H, { M: mul(M, tr(0, SLAB_H, front + 0.01)) });
  panel('zfRear', W, ZH, { M: mul(M, mul(tr(0, 0, -D / 2 - 0.01), rotY(PI))) });
  // the short sides and the projecting bay in the middle of each, its turret and pyramid cap
  for (const sg of [-1, 1]) {
    panel('zfSide', D, ZH, { M: mul(M, mul(tr(sg * (W / 2 + 0.01), 0, 0), rotY(sg * PI / 2))) });
    bx('zfAshlar', M, Math.min(sg * W / 2, sg * (W / 2 + PROJ)), Math.max(sg * W / 2, sg * (W / 2 + PROJ)), 0, ZH, -PW2, PW2);
    panel('zfSide', PW2 * 2, ZH, { M: mul(M, mul(tr(sg * (W / 2 + PROJ + 0.01), 0, 0), rotY(sg * PI / 2))), uvk: [PW2 * 2 / ZD, 1], uvo: [0.5 - PW2 / ZD, 0] });
    const Mt = mul(M, tr(sg * (W / 2 + PROJ - 1.5), ZH, 0));
    bx('zfAshlar', Mt, -1.35, 1.35, 0, 2.7, -1.35, 1.35);
    bx('flat', Mt, -1.6, 1.6, 2.7, 2.95, -1.6, 1.6, { c: '#d3c4a6' });
    for (let q = 0; q < 4; q++) panel('flat', 0.8, 1.4, { M: mul(Mt, mul(rotY(q * PI / 2), tr(0, 0.7, 1.36))), c: '#2a2118' });
    pyramid('flat', 3.0, 3.0, 1.9, { M: mul(Mt, tr(0, 2.95, 0)), c: '#7f8668', noao: true });
    cyl('flat', 0.04, 0.06, 1.1, 4, { M: mul(Mt, tr(0, 4.75, 0)), c: '#3a3226', noao: true });
    crenel(mul(M, tr(sg * (W / 2 + PROJ / 2), ZH, PW2 - 0.02)), PROJ, { c: '#c8b799' });
    crenel(mul(M, mul(tr(sg * (W / 2 + PROJ / 2), ZH, -PW2 + 0.02), rotY(PI))), PROJ, { c: '#c8b799' });
    panel('flat', 2.2, 5.4, { M: mul(M, tr(sg * 9.9, 0, front - SL + 0.02)), c: '#1c150f' });                // the dark behind the side doors
  }
  // the Sala della Fontana: floor and channel, marble side walls, the back wall with the niche, the muqarnas tiers, the inner arch on its two columns, the rail
  bx('zfFloor', M, -IW / 2, IW / 2, 0.02, 0.06, front - HB, front - 0.02);
  for (const sg of [-1, 1]) panel('zfInt', 5.8, IH, { M: mul(M, mul(tr(sg * (IW / 2 - 0.01), 0, front - HB + 2.9), rotY(-sg * PI / 2))) });
  panel('zfNiche', IW, IH, { M: mul(M, tr(0, 0, front - HB + 0.02)) });
  for (let t = 0; t < 5; t++) bx('zfAshlar', M, -(1.15 - t * 0.2), 1.15 - t * 0.2, 3.2 + t * 0.62, 3.2 + t * 0.62 + 0.3, front - HB + 0.02, front - HB + 0.22 + t * 0.1, { c: t % 2 ? '#e0d4ae' : '#cbae5a' });
  bx('flat', M, -IW / 2, IW / 2, IH, IH + 0.3, front - HB, front - SL, { c: '#c9a24a' });
  const arc = new THREE.Shape(); arc.moveTo(-IW / 2, 3.9); arc.lineTo(-1.75, 3.9); arc.quadraticCurveTo(-1.75, 5.3, 0, 5.9); arc.quadraticCurveTo(1.75, 5.3, 1.75, 3.9); arc.lineTo(IW / 2, 3.9); arc.lineTo(IW / 2, 6.3); arc.lineTo(-IW / 2, 6.3); arc.lineTo(-IW / 2, 3.9);
  extrude('zfAshlar', arc, 0.4, { M: mul(M, tr(0, 0, front - 2.0)) });
  for (const sg of [-1, 1]) cyl('flat', 0.17, 0.2, 3.9, 8, { M: mul(M, tr(sg * 1.95, 0, front - 1.8)), c: '#e8e2d0' });
  bx('flat', M, -IW / 2, IW / 2, 0.06, 1.15, front - 0.75, front - 0.65, { c: '#6a3a24' });
  bx('glass', M, -0.4, 0.4, 0.05, 0.12, front - HB + 0.1, front - 0.8, { c: '#5f95ad', noao: true });
  // in front: the channel's red kerbs, the low basin with its red rim over dry ground, the clipped hedges along the foot of the wall
  const BZ0 = front + BAS_Z0, BZ1 = front + BAS_Z1, red = { c: '#b0705c' };
  const [fx, fz] = wpt([ob.cx, ob.cz], fr.nx, fr.nz, 0, front + (BAS_Z0 + BAS_Z1) / 2), by = Math.min(0, groundY(fx, fz) - gy);   // the ground in front lies below the floor of the palace
  bx('zfFloor', M, -W / 2 - 0.25, W / 2 + 0.25, by - 0.7, 0.04, front, front + 0.9, { c: '#cbbf9f' });                              // the stone step along the front
  for (let i = 1; i < 4; i++) bx('zfFloor', M, -3.4, 3.4, by - 0.7, by * i / 4, front + 0.9 + (i - 1) * 0.35, front + 0.9 + i * 0.35, { c: '#cbbf9f' });
  for (const sg of [-1, 1]) bx('flat', M, Math.min(sg * 0.5, sg * 0.75), Math.max(sg * 0.5, sg * 0.75), by - 0.6, by + 0.4, front + 1.9, BZ0, red);
  bx('flat', M, -BAS_W, BAS_W, by - 0.6, by + 0.22, BZ0, BZ1, { c: '#cdbfae' });
  for (const [x0, x1, z0, z1] of [[-BAS_W - 0.5, -BAS_W, BZ0, BZ1], [BAS_W, BAS_W + 0.5, BZ0, BZ1], [-BAS_W - 0.5, -0.75, BZ0 - 0.5, BZ0], [0.75, BAS_W + 0.5, BZ0 - 0.5, BZ0], [-BAS_W - 0.5, BAS_W + 0.5, BZ1, BZ1 + 0.5], [-1.4, 1.4, BZ0 + 3.2, BZ0 + 4.6]]) bx('flat', M, x0, x1, by - 0.6, by + 0.55, z0, z1, red);
  for (const sg of [-1, 1]) bx('flat', M, Math.min(sg * 12.4, sg * 17.2), Math.max(sg * 12.4, sg * 17.2), by - 0.5, by + 0.75, front + 1.0, front + 1.9, { c: '#3a6030' });
  // the parapet with its merlons
  for (let q = 0; q < 4; q++) crenel(mul(M, mul(rotY(q * PI / 2), tr(0, ZH, (q % 2 ? W : D) / 2 - 0.02))), q % 2 ? D : W, { c: '#c8b799' });
  bx('flat', M, -W / 2 - 0.15, W / 2 + 0.15, ZH - 0.35, ZH, -D / 2 - 0.15, D / 2 + 0.15, { c: '#c3b193' });
  // what is left of the attic: two ochre pavilions and a low broken wall between them, set back from the front
  for (const x of [-7.2, 9.0]) {
    bx('zfAshlar', M, x - 2.2, x + 2.2, ZH, ZH + 3.0, -4.2, 0.4, { c: '#e2b088' });
    bx('flat', M, x - 2.5, x + 2.5, ZH + 3.0, ZH + 3.35, -4.5, 0.7, { c: '#c98f6e' });
    bx('zfAshlar', M, x - 0.9, x + 0.9, ZH + 3.35, ZH + 4.2, -2.8, -1.0, { c: '#e2b088' });
    for (const dz of [0.41, -4.21]) panel('flat', 1.3, 2.0, { M: mul(M, mul(tr(x, ZH + 0.4, dz), rotY(dz > 0 ? 0 : PI))), c: '#2f231c' });
  }
  for (const [x0, x1, h] of [[-5.0, -0.8, 1.9], [-0.8, 2.6, 1.3], [2.6, 6.8, 2.2]]) bx('zfAshlar', M, x0, x1, ZH, ZH + h, -2.4, -1.6, { c: '#d29678' });
  return end('La Zisa');
}
const BAS_Z0 = 4.5, BAS_Z1 = 13.5, BAS_W = 5.5;
const ZIS_WALLS = (() => {   // the block and its bays keep the footprint's walls; the basin and the hedges in front are walls to a car too
  const O = [ZIS.ob.cx, ZIS.ob.cz], { nx, nz } = ZIS.fr, f = ZIS.D / 2, out = [];
  out.push(...rectSegs(O, nx, nz, -BAS_W - 0.5, BAS_W + 0.5, f + BAS_Z0 - 0.5, f + BAS_Z1 + 0.5));
  for (const sg of [-1, 1]) { out.push(...rectSegs(O, nx, nz, Math.min(sg * 12.4, sg * 17.2), Math.max(sg * 12.4, sg * 17.2), f + 1.0, f + 1.9)); out.push(...rectSegs(O, nx, nz, Math.min(sg * 0.5, sg * 0.75), Math.max(sg * 0.5, sg * 0.75), f + 1.9, f + BAS_Z0)); }
  out.push(...rectSegs(O, nx, nz, -ZIS.W / 2 - 0.25, ZIS.W / 2 + 0.25, f, f + 0.9));
  return out;
})();
{ const [x, z] = wpt([ZIS.ob.cx, ZIS.ob.cz], ZIS.fr.nx, ZIS.fr.nz, 0, ZIS.D / 2 + (BAS_Z0 + BAS_Z1) / 2); TREE_CLEAR.push([r1(x), r1(z), 15]); }   // no generic tree in the basin or against the front
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
