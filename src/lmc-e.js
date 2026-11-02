// City landmarks, group E (board item c4, "landmark leftovers"): La Cuba, San Giovanni degli Eremiti, the front of the Palazzo dei Normanni and the Stazione Marittima.
// Same toolkit and the same way of working as the centro landmarks (src/landmarks.js): painted textures with the heavy parts as real geometry, everything built on the streamed ground
// (src/world.js builds city landmarks once the tile under them, and the tiles their footprint reaches into, have terrain), with collision for what stands outside the footprints.
// Proportions come from Wikimedia Commons photographs (nothing of them is stored); the notes are in docs/faithfulness/landmarks.md.
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, prism, pyramid, shell,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, initShared, ensureTrunk, paintAshlar, noiseDots, streaks, palm, rail,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';

const TWO = PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
// world position of the local point (x, z) of a frame at O whose +z points along (nx, nz) (local +x is (nz, -nx), as frame() has it)
const wpt = (O, nx, nz, x, z) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz];
const rectSegs = (O, nx, nz, x0, x1, z0, z1) => { const p = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => wpt(O, nx, nz, x, z)); return p.map((a, i) => { const b = p[(i + 1) % 4]; return [r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]; }); };
const lineSegs = (O, nx, nz, x0, z0, x1, z1) => { const a = wpt(O, nx, nz, x0, z0), b = wpt(O, nx, nz, x1, z1); return [[r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]]; };
const pointedArch = (g, X, Y, cx, y0, hw, hs, top) => {   // a pointed arch path: from (cx - hw, y0) up to the springing hs, to the apex `top` (all metres from the bottom)
  g.beginPath(); g.moveTo(X(cx - hw), Y(y0)); g.lineTo(X(cx - hw), Y(y0 + hs)); g.quadraticCurveTo(X(cx - hw), Y(y0 + top * 0.86), X(cx), Y(y0 + top)); g.quadraticCurveTo(X(cx + hw), Y(y0 + top * 0.86), X(cx + hw), Y(y0 + hs)); g.lineTo(X(cx + hw), Y(y0)); g.closePath();
};

// ====================================================================================================
// La Cuba (the pleasure pavilion of William II, 1180): a tall block of pale ashlar, 31 x 17 m and 17.5 m high. Each face is a row of huge pointed blind arches stepping back in two orders
// between pilasters, with in them the blind windows (two open pointed windows low down, twin blind ones above, a niche and two slits over them) and a frieze of Kufic lettering under the parapet.
// ====================================================================================================
const CB = { W: 31.5, D: 17.0, H: 17.5, FH: 1.9 };   // frieze height
function paintCubaBay(g, w, h, bw) {
  const sx = w / bw, sy = h / CB.H, X = (s) => s * sx, Y = (y) => h - y * sy, cx = bw / 2;
  paintAshlar(g, w, h, bw, CB.H, 0.42, 0.95, '#cdb98f', '#a08c62', 811, 2, 0.07);
  pointedArch(g, X, Y, cx, 0.0, bw / 2 - 0.7, 9.4, 14.2); g.fillStyle = '#c0aa7c'; g.fill();                 // the recess inside the great arch
  pointedArch(g, X, Y, cx, 0.0, bw / 2 - 1.0, 9.4, 13.5); g.strokeStyle = '#e6d6aa'; g.lineWidth = 0.22 * sx; g.stroke();   // its lighter inner order
  const win = (x, y0, hw, hs, top, fill, rim) => { pointedArch(g, X, Y, x, y0, hw + 0.16, hs, top + 0.2); g.fillStyle = rim; g.fill(); pointedArch(g, X, Y, x, y0, hw, hs, top); g.fillStyle = fill; g.fill(); };
  for (const sg of [-1, 1]) win(cx + sg * 1.35, 0.5, 0.78, 3.0, 4.0, '#241c14', '#d8c79b');                   // the two open windows at the foot
  pointedArch(g, X, Y, cx, 4.4, 2.75, 0.4, 1.9); g.strokeStyle = '#e0cf9f'; g.lineWidth = 0.14 * sx; g.stroke();
  for (const sg of [-1, 1]) win(cx + sg * 1.35, 5.4, 0.74, 2.1, 3.0, '#a8936a', '#dccb9e');                      // the twin blind windows under their joint arch
  pointedArch(g, X, Y, cx, 9.2, 1.05, 2.0, 3.0); g.fillStyle = '#e0cf9f'; g.fill(); pointedArch(g, X, Y, cx, 9.3, 0.88, 1.9, 2.7); g.fillStyle = '#a8936a'; g.fill();    // the niche
  g.fillStyle = '#e8dbb4'; g.beginPath(); g.arc(X(cx), Y(11.65), 0.42 * sx, PI, 0); g.fill();                    // its scallop shell
  for (const sg of [-1, 1]) { g.fillStyle = '#3a2f22'; g.fillRect(X(cx + sg * 2.25) - 0.15 * sx, Y(13.0), 0.3 * sx, 2.2 * sy); }   // the two slits
  streaks(g, w, h, 18, 812, 0.2, 220);
}
function paintKufic(g, w, h) {
  g.fillStyle = '#cdb88c'; g.fillRect(0, 0, w, h);
  const r_ = (() => { let s = 77; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  g.fillStyle = '#9b8660'; g.fillRect(0, 0, w, h * 0.12); g.fillRect(0, h * 0.86, w, h * 0.14);
  g.strokeStyle = '#7a6a4a'; g.lineWidth = h * 0.07; g.lineCap = 'round';
  for (let x = 6; x < w - 6; x += h * 0.34) {   // a band of stylised letters: stems of different heights, with hooks and loops
    const t = r_(), top = h * (0.2 + t * 0.12), bot = h * 0.78;
    g.beginPath(); g.moveTo(x, bot); g.lineTo(x, top); if (r_() < 0.5) g.lineTo(x + h * 0.14, top + h * 0.1); g.stroke();
    if (r_() < 0.45) { g.beginPath(); g.arc(x + h * 0.17, bot - h * 0.12, h * 0.1, 0, 7); g.stroke(); }
  }
  streaks(g, w, h, 6, 813, 0.2, 40);
}
function buildCuba() {
  initShared();
  const pts = pairsOf(FP.cuba.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.6, 0.8);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const { W, D, H, FH } = CB, nL = 4, nS = 2, bwL = W / nL, bwS = D / nS;
  defMat('cbStone', 256, 256, [3.2, 3.2], (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.42, 0.95, '#d3c096', '#a38f66', 801, 2, 0.06));
  defMat('cbBayL', 320, 704, [bwL, H], (g, w, h) => paintCubaBay(g, w, h, bwL));
  defMat('cbBayS', 320, 704, [bwS, H], (g, w, h) => paintCubaBay(g, w, h, bwS));
  defMat('cbKufic', 512, 64, [1, 1], paintKufic);
  // the footing: a stone plinth down to the lowest ground under the building
  bx('cbStone', M, -W / 2 - 0.5, W / 2 + 0.5, -(gr.hi - gr.lo) - 3, 0.3, -D / 2 - 0.5, D / 2 + 0.5, { c: '#b8a880' });
  bx('cbStone', M, -W / 2, W / 2, 0, H, -D / 2, D / 2);
  const face = (Wm, n, bwKey, MF) => {
    const bw = Wm / n, pil = 0.55;
    for (let i = 0; i < n; i++) {
      const x = -Wm / 2 + bw * (i + 0.5), ow = bw - 2 * pil - 0.9;
      panel(bwKey, bw, H, { M: mul(MF, tr(x, 0, 0.02)), noao: false });                                                        // the painted back of the bay
      archBay('cbStone', bw, H - FH, ow, 12.4, 0.8, { M: mul(MF, tr(x, 0, 0.0)), pointed: true, c: '#d9c8a0' });               // the pilasters and the arch order in front of it
    }
    bx('cbStone', MF, -Wm / 2 - 0.3, Wm / 2 + 0.3, H - FH - 0.15, H - FH + 0.1, 0, 1.0, { c: '#cdb98e' });                    // the string course under the frieze
    panel('cbKufic', Wm + 0.2, FH - 0.2, { M: mul(MF, tr(0, H - FH, 0.04)), uvk: [Wm / 16, 1], noao: true });                 // the Kufic frieze
    bx('cbStone', MF, -Wm / 2 - 0.35, Wm / 2 + 0.35, H, H + 0.55, -0.1, 0.9, { c: '#d8c79d' });                               // the parapet and its coping
    bx('cbStone', MF, -Wm / 2 + 0.2, Wm / 2 - 0.2, H + 0.55, H + 0.95, 0.1, 0.5, { c: '#c9b68c' });
  };
  face(W, nL, 'cbBayL', mul(M, tr(0, 0, D / 2)));
  face(W, nL, 'cbBayL', mul(M, mul(rotY(PI), tr(0, 0, D / 2))));
  face(D, nS, 'cbBayS', mul(M, mul(rotY(PI / 2), tr(0, 0, W / 2))));
  face(D, nS, 'cbBayS', mul(M, mul(rotY(-PI / 2), tr(0, 0, W / 2))));
  // the corner buttresses
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx('cbStone', M, sx * (W / 2 - 0.0) - 0.6, sx * (W / 2 - 0.0) + 0.6, 0, H + 0.2, sz * (D / 2) - 0.6, sz * (D / 2) + 0.6, { c: '#dccba3' });
  // the doorway of the front face: a dark pointed opening in the middle of the second bay's foot
  panel('flat', 1.6, 3.2, { M: mul(M, tr(0, 0, D / 2 + 0.85)), c: '#1c1612', noao: true });
  return end('La Cuba');
}
export const CUBA = { name: 'La Cuba', x: -1633, z: 901, radius: 50, skipIds: [FP.cuba.id], build: buildCuba };

// ====================================================================================================
// San Giovanni degli Eremiti (1136): a plain block of ashlar with narrow slit windows, five bare red domes on drums over the nave and the choir, a bell tower with a relieving arch and a sixth red dome,
// and the cloister next to it: coupled slender columns carrying stepped pointed arches round a garden of palms and orange trees with a well, a cypress at the church.
// ====================================================================================================
const ER = { L: 21, Dc: 12.4, Hb: 8.0, NA: 10 };
function paintEremWall(g, w, h) {
  paintAshlar(g, w, h, 6, 8.6, 0.46, 1.5, '#c1b28c', '#8d7d5c', 821, 2, 0.08);
  const sx = w / 6, sy = h / 8.6, X = (s) => s * sx, Y = (y) => h - y * sy;
  for (const x of [1.5, 4.5]) { g.fillStyle = '#2b241b'; g.fillRect(X(x) - 0.12 * sx, Y(6.2), 0.24 * sx, 2.4 * sy); g.fillRect(X(x) - 0.6 * sx * 0.5, Y(5.1), 0.6 * sx, 0.14 * sy); }   // slit windows with their small cross-bars
  g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(0, Y(8.6), w, 0.5 * sy); g.fillStyle = '#d3c49c'; g.fillRect(0, 0, w, 0.45 * sy);        // the dark under-eave line and the pale cornice course
  streaks(g, w, h, 14, 822, 0.22, 200);
}
function paintEremTower(g, w, h) {
  paintAshlar(g, w, h, 4.2, 15.5, 0.46, 1.2, '#c4b48e', '#8d7d5c', 831, 2, 0.07);
  const sx = w / 4.2, sy = h / 15.5, X = (s) => s * sx, Y = (y) => h - y * sy, cx = 2.1;
  pointedArch(g, X, Y, cx, 8.6, 1.5, 3.0, 4.6); g.strokeStyle = '#e1d2a8'; g.lineWidth = 0.2 * sx; g.stroke();            // the relieving arch of the belfry stage, in two orders
  pointedArch(g, X, Y, cx, 8.6, 1.15, 2.9, 4.2); g.strokeStyle = '#b3a37c'; g.lineWidth = 0.14 * sx; g.stroke();
  pointedArch(g, X, Y, cx, 9.2, 0.62, 2.0, 3.2); g.fillStyle = '#251d15'; g.fill();                                          // the belfry opening
  g.fillStyle = '#2b241b'; for (const y of [2.2, 5.0]) g.fillRect(X(cx) - 0.1 * sx, Y(y + 1.4), 0.2 * sx, 1.4 * sy);          // the slits lower down
  g.fillStyle = '#d3c49c'; g.fillRect(0, Y(14.0), w, 0.5 * sy);
  streaks(g, w, h, 8, 832, 0.22, 200);
}
function buildEremiti() {
  initShared(); ensureTrunk();
  const pts = pairsOf(FP.eremiti.p), gr = groundRange(pts), ob = obb(pts);
  const gy = gr.hi + 0.1, M = frame(ob.cx, gy, ob.cz, ob.vx, ob.vz);   // local x along the long axis of the footprint
  begin(gy);
  defMat('erWall', 256, 352, [6, 8.6], paintEremWall);
  defMat('erTower', 192, 512, [4.2, 15.5], paintEremTower);
  defMat('erRed', 128, 128, [2.5, 2.5], (g, w, h) => { g.fillStyle = '#a9493b'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 3, 841, ['rgba(110,40,34,0.28)', 'rgba(205,120,98,0.22)', 'rgba(70,30,26,0.2)']); streaks(g, w, h, 8, 842, 0.2, 90); });
  defMat('erLeaf', 64, 64, [2, 2], (g, w, h) => { g.fillStyle = '#4d7a3a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 160, 3, 843, ['rgba(30,70,30,0.35)', 'rgba(150,190,90,0.3)', 'rgba(230,150,40,0.45)']); });
  defMat('erColumn', 64, 128, [0.4, 2.4], (g, w, h) => { g.fillStyle = '#e3dcc8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,70,50,0.18)'; g.fillRect(0, 0, w * 0.2, h); streaks(g, w, h, 4, 844, 0.12, 60); });
  defMat('erArch', 256, 256, [3.2, 3.2], (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.4, 0.9, '#d1c095', '#9b8a64', 845, 2, 0.08));
  const { L, Dc, Hb, NA } = ER;
  // the footing, the church block, the cornice
  bx('erWall', M, -L / 2 + 1.5, L / 2 + 2.5, -(gr.hi - gr.lo) - 2.5, 0.2, -Dc / 2 - 0.4, Dc / 2 + 0.4, { c: '#a99d84' });
  bx('erWall', M, -L / 2 + 2, L / 2 + 2, 0, Hb, -Dc / 2, Dc / 2);
  bx('erArch', M, -L / 2 + 1.75, L / 2 + 2.25, Hb, Hb + 0.4, -Dc / 2 - 0.25, Dc / 2 + 0.25);
  // the five red domes over square bases: two on the nave, three over the choir end; each on a low drum with two small windows
  for (const [x, z, r] of [[-3.5, 0, 2.7], [4.0, 0, 2.7], [10.0, -3.6, 1.8], [10.0, 0, 2.0], [10.0, 3.6, 1.8]]) {
    bx('erWall', M, x - r - 0.3, x + r + 0.3, Hb + 0.4, Hb + 1.9, z - r - 0.3, z + r + 0.3);
    const D0 = mul(M, tr(x, Hb + 1.9, z));
    cyl('erArch', r * 0.98, r * 1.0, 0.8, 12, { M: D0, c: '#d6c79f' });
    lathe('erRed', [[r * 1.0, 0], [r * 1.01, 0.18 * r], [r * 0.92, 0.55 * r], [r * 0.7, 0.9 * r], [r * 0.4, 1.17 * r], [r * 0.14, 1.34 * r], [0.01, 1.4 * r]], 14, { M: mul(D0, tr(0, 0.8, 0)), c: '#ffffff', noao: true });
    for (const a of [0.7, 2.3]) box('flat', 0.45, 0.65, 0.2, { M: mul(D0, tr(Math.cos(a) * r * 0.97, 0.9, Math.sin(a) * r * 0.97)), c: '#2b2018', ry: -a + PI / 2, noao: true });
    cone('erArch', 0.07, 0.6, 5, { M: mul(D0, tr(0, 0.8 + 1.4 * r, 0)), c: '#e8e0cc', noao: true });
  }
  // the bell tower: a square shaft with its relieving arch and a red dome on a small drum
  const TX = -6.7, TZ = -7.1, TW = 4.2, TH = 15.5, TM = mul(M, tr(TX, 0, TZ));
  bx('erWall', M, TX - TW / 2 - 0.2, TX + TW / 2 + 0.2, -(gr.hi - gr.lo) - 2.5, 0.2, TZ - TW / 2 - 0.2, TZ + TW / 2 + 0.2, { c: '#a99d84' });
  for (let q = 0; q < 4; q++) panel('erTower', TW, TH, { M: mul(TM, mul(rotY(q * PI / 2), tr(0, 0, TW / 2))) });
  bx('erArch', TM, -TW / 2 - 0.15, TW / 2 + 0.15, TH, TH + 0.4, -TW / 2 - 0.15, TW / 2 + 0.15, { c: '#d3c49c' });
  cyl('erArch', 1.55, 1.6, 0.7, 12, { M: mul(TM, tr(0, TH + 0.4, 0)), c: '#d6c79f' });
  lathe('erRed', [[1.6, 0], [1.62, 0.3], [1.45, 0.85], [1.0, 1.35], [0.45, 1.65], [0.01, 1.78]], 12, { M: mul(TM, tr(0, TH + 1.1, 0)), c: '#ffffff', noao: true });
  cone('erArch', 0.08, 0.7, 5, { M: mul(TM, tr(0, TH + 2.85, 0)), c: '#e8e0cc', noao: true });
  // the cloister: an L of arcades along the back of the garden and down one side, on a low stylobate: coupled columns carry pointed arches in two orders
  const CZ = Dc / 2 + 7.0, X0 = -NA * 1.2, bay = 2.4;
  const bayAt = (MA, x) => {
    for (const dx of [-0.19, 0.19]) { cyl('erColumn', 0.12, 0.12, 2.3, 6, { M: mul(MA, tr(x + dx, 0.9, 0.0)) }); box('erArch', 0.26, 0.14, 0.34, { M: mul(MA, tr(x + dx, 0.82, 0.0)) }); box('erArch', 0.3, 0.16, 0.38, { M: mul(MA, tr(x + dx, 3.2, 0.0)) }); }
    archBay('erArch', bay, 2.1, 2.0, 1.5, 0.55, { M: mul(MA, tr(x + bay / 2, 3.36, -0.28)), pointed: true });
  };
  const MA = mul(M, tr(0, 0, CZ));
  bx('erArch', MA, X0 - 0.5, X0 + NA * bay + 0.5, 0, 0.9, -0.4, 0.4);
  for (let i = 0; i < NA; i++) bayAt(MA, X0 + i * bay + 0.0);
  for (let i = 0; i <= NA; i += NA) { box('erArch', 0.7, 4.6, 0.7, { M: mul(MA, tr(X0 + i * bay, 0.9, 0)) }); }
  bx('erArch', MA, X0 - 0.3, X0 + NA * bay + 0.3, 5.46, 5.76, -0.45, 0.45);                                                  // the cornice over the arcade
  const MB = mul(M, mul(tr(X0, 0, CZ), rotY(-PI / 2)));                                                                                           // the side wing: runs back towards the church
  bx('erArch', MB, -0.4, 6 * bay + 0.4, 0, 0.9, -0.4, 0.4);
  for (let i = 0; i < 6; i++) bayAt(MB, i * bay + 0.0);
  bx('erArch', MB, -0.3, 6 * bay + 0.3, 5.46, 5.76, -0.45, 0.45);
  // the garden: a well, orange trees with fruit, palms, a cypress by the church, agaves
  const G = (x, z) => mul(M, tr(x, 0, z));
  cyl('erArch', 0.7, 0.8, 0.9, 10, { M: G(X0 + 8.5, CZ - 5.5), c: '#cbbb92' }); cyl('flat', 0.5, 0.5, 0.05, 8, { M: mul(G(X0 + 8.5, CZ - 5.5), tr(0, 0.88, 0)), c: '#3d5a63', noao: true });
  for (const [x, z, s] of [[X0 + 5.5, CZ - 3.5, 1], [X0 + 13.0, CZ - 4.0, 1.1], [X0 + 17.5, CZ - 7.5, 0.9], [X0 + 4.5, CZ - 9.5, 1]]) {
    cyl('trunk', 0.14 * s, 0.2 * s, 1.6 * s, 5, { M: G(x, z) }); sphere('erLeaf', 1.45 * s, { M: mul(G(x, z), tr(0, 2.4 * s, 0)), ky: 0.85, seg: 6 }); sphere('erLeaf', 0.9 * s, { M: mul(G(x, z), tr(0.6 * s, 3.0 * s, 0.3)), seg: 5 });
  }
  const wp = (x, z) => wpt([ob.cx, ob.cz], ob.vx, ob.vz, x, z);
  for (const [x, z, h] of [[X0 + 3.0, CZ - 6.5, 11], [X0 + 10.5, CZ - 2.6, 9.5], [X0 + 15.0, CZ - 5.0, 12.5], [X0 + 20.0, CZ - 3.2, 10]]) { const p = wp(x, z); palm(p[0], gy, p[1], h, { r: x }); }
  { const x = L / 2 + 4.8, z = 3.2; cone('erLeaf', 1.1, 10.5, 8, { M: G(x, z), c: '#274a2e' }); }
  for (const [x, z] of [[X0 + 7, CZ - 1.4], [X0 + 15, CZ - 1.4], [X0 + 1.5, CZ - 12]]) for (let a = 0; a < 7; a++) cone('erLeaf', 0.14, 1.2, 4, { M: mul(G(x, z), mul(rotY(a * 0.9), tr(0.35, 0.05, 0))), rz: -0.7, c: '#6e8f63', noao: true });
  return end('San Giovanni degli Eremiti');
}
const EREM_O = obb(pairsOf(FP.eremiti.p));
const EREM_WALLS = (() => {   // the arcades (a line of coupled columns is a wall to a car), the well and the palm trunks
  const O = [EREM_O.cx, EREM_O.cz], nx = EREM_O.vx, nz = EREM_O.vz, { Dc, NA } = ER, CZ = Dc / 2 + 7.0, X0 = -NA * 1.2, out = [];
  out.push(...lineSegs(O, nx, nz, X0 - 0.4, CZ, X0 + NA * 2.4 + 0.4, CZ));                                // the back arcade
  out.push(...lineSegs(O, nx, nz, X0, CZ, X0, CZ - 6 * 2.4 - 0.4));                                      // the side arcade
  out.push(...rectSegs(O, nx, nz, X0 + 8.5 - 0.8, X0 + 8.5 + 0.8, CZ - 5.5 - 0.8, CZ - 5.5 + 0.8));       // the well
  for (const [x, z] of [[X0 + 3.0, CZ - 6.5], [X0 + 10.5, CZ - 2.6], [X0 + 15.0, CZ - 5.0], [X0 + 20.0, CZ - 3.2]]) out.push(...rectSegs(O, nx, nz, x - 0.3, x + 0.3, z - 0.3, z + 0.3));
  return out;
})();
export const EREMITI = { name: 'San Giovanni degli Eremiti', x: -577, z: 683, radius: 50, skipIds: [FP.eremiti.id], build: buildEremiti, walls: EREM_WALLS };

// ====================================================================================================
// Palazzo dei Normanni, the front on Piazza del Parlamento (the Torre Pisana in the middle is in src/landmarks.js): a long ochre plaster front of three storeys with arched windows in stucco frames,
// a frieze of small interlaced arches under the cornice, bundles of slender pilasters along it, the pointed Arab-Norman merlons all round the roof, and the baroque portal with the crowned arms and two lanterns.
// ====================================================================================================
const NO = { H: 19.5, TW: 7.2 };
function paintNorWall(g, w, h) {
  const { H, TW } = NO, sx = w / TW, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
  g.fillStyle = '#d6aa72'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, 851, ['rgba(120,80,40,0.10)', 'rgba(255,235,190,0.09)']);
  g.fillStyle = '#b98a58'; g.fillRect(0, Y(1.1), w, 1.1 * sy);                                                                     // the plinth
  const stucco = '#ecd9b0', glass = '#2a2b33';
  const win = (cx, y0, y1, ww, kind) => {
    g.fillStyle = stucco; if (kind === 'arch') { g.beginPath(); g.moveTo(X(cx - ww / 2 - 0.2), Y(y0 - 0.1)); g.lineTo(X(cx - ww / 2 - 0.2), Y(y1 - ww / 2)); g.arc(X(cx), Y(y1 - ww / 2), (ww / 2 + 0.2) * sx, PI, 0); g.lineTo(X(cx + ww / 2 + 0.2), Y(y0 - 0.1)); g.fill(); g.fillStyle = glass; g.beginPath(); g.moveTo(X(cx - ww / 2), Y(y0)); g.lineTo(X(cx - ww / 2), Y(y1 - ww / 2)); g.arc(X(cx), Y(y1 - ww / 2), ww / 2 * sx, PI, 0); g.lineTo(X(cx + ww / 2), Y(y0)); g.fill(); }
    else { g.fillRect(X(cx - ww / 2 - 0.22), Y(y1 + 0.22), (ww + 0.44) * sx, (y1 - y0 + 0.44) * sy); g.fillStyle = glass; g.fillRect(X(cx - ww / 2), Y(y1), ww * sx, (y1 - y0) * sy); g.fillStyle = stucco; g.beginPath(); g.moveTo(X(cx - ww / 2 - 0.4), Y(y1 + 0.22)); g.lineTo(X(cx), Y(y1 + 0.85)); g.lineTo(X(cx + ww / 2 + 0.4), Y(y1 + 0.22)); g.fill(); }
    g.fillStyle = 'rgba(15,12,10,0.65)'; g.fillRect(X(cx) - 1, Y(y1), 2, (y1 - y0) * sy); g.fillRect(X(cx - ww / 2), Y(y0 + (y1 - y0) * 0.62), ww * sx, 2);
  };
  for (const cx of [1.8, 5.4]) {
    win(cx, 1.5, 4.6, 1.3, 'arch');                         // ground floor: arched windows
    win(cx, 7.1, 10.6, 1.3, 'rect'); g.fillStyle = '#2a2a2e'; g.fillRect(X(cx - 0.95), Y(7.9), 1.9 * sx, 2); for (let k = 0; k <= 7; k++) g.fillRect(X(cx - 0.95 + k * 0.27), Y(7.9), 1.5, 0.8 * sy);   // first floor: balcony rail
    win(cx, 13.0, 15.9, 1.15, 'rect');                      // second floor
  }
  g.fillStyle = stucco; g.fillRect(0, Y(6.0), w, 0.3 * sy); g.fillRect(0, Y(12.2), w, 0.3 * sy);                                         // string courses
  g.fillStyle = '#e7d3a4'; g.fillRect(0, Y(19.0), w, 0.5 * sy); g.fillStyle = 'rgba(40,25,10,0.5)'; g.fillRect(0, Y(18.4), w, 0.08 * sy);
  g.strokeStyle = '#a4713d'; g.lineWidth = 0.1 * sx;                                                                                       // the frieze of small interlaced arches under the cornice
  for (let k = -1; k < TW / 0.6 + 1; k++) for (const o of [0, 0.3]) { const x = k * 0.6 + o; g.beginPath(); g.moveTo(X(x - 0.3), Y(18.3)); g.quadraticCurveTo(X(x - 0.3), Y(18.75), X(x), Y(18.95)); g.quadraticCurveTo(X(x + 0.3), Y(18.75), X(x + 0.3), Y(18.3)); g.stroke(); }
  streaks(g, w, h, 16, 852, 0.2, 240);
  const gb = g.createLinearGradient(0, h, 0, Y(4)); gb.addColorStop(0, 'rgba(30,20,12,0.3)'); gb.addColorStop(1, 'rgba(30,20,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(4), w, 4 * sy);
}
function paintNorPortal(g, w, h) {   // 5 x 10 m: the salmon ashlar wall with the baroque doorway of the photographs
  paintAshlar(g, w, h, 5, 10, 0.42, 1.0, '#cf9a6c', '#a2704a', 861, 2, 0.07);
  const sx = w / 5, sy = h / 10, X = (s) => s * sx, Y = (y) => h - y * sy, cx = 2.5;
  const arch = (hw, y0, top, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(X(cx - hw), Y(y0)); g.lineTo(X(cx - hw), Y(y0 + top - hw)); g.arc(X(cx), Y(y0 + top - hw), hw * sx, PI, 0); g.lineTo(X(cx + hw), Y(y0)); g.fill(); };
  arch(1.55, 0.0, 6.2, '#c6a06a'); arch(1.25, 0.0, 5.8, '#5b3a22');                                   // the stone surround and the wooden door
  g.strokeStyle = '#3a2412'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(cx), Y(0)); g.lineTo(X(cx), Y(5.6)); g.stroke();
  g.fillStyle = '#2a1a0e'; for (let y = 0.5; y < 5.2; y += 0.55) for (let x = cx - 1.1; x < cx + 1.2; x += 0.5) g.fillRect(X(x), Y(y), 3, 3);   // the studs
  g.fillStyle = '#d9b97e'; for (const sg of [-1, 1]) { g.beginPath(); g.arc(X(cx + sg * 1.65), Y(5.4), 0.34 * sx, 0, 7); g.fill(); }   // shells
  g.fillStyle = '#d9b97e'; g.beginPath(); g.arc(X(cx), Y(7.35), 0.62 * sx, 0, 7); g.fill(); g.fillStyle = '#a77f4c'; g.beginPath(); g.arc(X(cx - 0.2), Y(7.35), 0.34 * sx, 0, 7); g.arc(X(cx + 0.2), Y(7.35), 0.34 * sx, 0, 7); g.fill();   // the arms
  g.fillStyle = '#d9b97e'; g.fillRect(X(cx - 0.45), Y(8.25), 0.9 * sx, 0.3 * sy); for (const dx of [-0.35, 0, 0.35]) { g.beginPath(); g.arc(X(cx + dx), Y(8.35), 0.1 * sx, 0, 7); g.fill(); }   // the crown
  for (const sg of [-1, 1]) { g.fillStyle = '#2b2a2c'; g.fillRect(X(cx + sg * 1.85) - 0.18 * sx, Y(4.5), 0.36 * sx, 0.7 * sy); g.fillStyle = '#f0dca0'; g.fillRect(X(cx + sg * 1.85) - 0.1 * sx, Y(4.4), 0.2 * sx, 0.5 * sy); }   // the lanterns
  streaks(g, w, h, 8, 862, 0.2, 160);
}
function buildNormanni() {
  initShared();
  const p = FP.normanni, pts = pairsOf(p.p), holes = (p.holes || []).map(pairsOf), gr = groundRange(pts);
  const gy = gr.hi, WH = NO.H;
  begin(gy);
  defMat('noWall', 256, 512, [NO.TW, NO.H], paintNorWall);
  defMat('noPortal', 160, 320, [5, 10], paintNorPortal);
  defMat('noStone', 256, 256, [3.3, 3.3], (g, w, h) => paintAshlar(g, w, h, 3.3, 3.3, 0.5, 1.2, '#d3b27d', '#9b7a4d', 871, 2, 0.06));
  defMat('noMer', 64, 64, [1.6, 1.0], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e4cba0'; g.fillRect(0, h * 0.5, w, h * 0.5); for (const x of [0, 32]) { g.beginPath(); g.moveTo(x + 4, h * 0.5); g.lineTo(x + 16, 2); g.lineTo(x + 28, h * 0.5); g.fill(); } g.fillStyle = 'rgba(70,45,20,0.25)'; g.fillRect(0, h * 0.5, w, 3); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  shell('noWall', pts, holes, gy, WH, { lo: gr.lo - 3, roof: '#8f8a82', cc: '#e2c8a0' });
  // the pointed merlons all round the roofline and round the courtyards
  const ring = (r) => { for (let i = 0; i < r.length; i++) { const A = r[i], B = r[(i + 1) % r.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 2) continue;
    const MM = frame((A[0] + B[0]) / 2, gy + WH + 0.15, (A[1] + B[1]) / 2, -dz / l, dx / l); panel('noMer', l, 1.0, { M: mul(MM, tr(0, 0, 0.0)), uvk: [l / 1.6, 1], noao: true }); } };
  ring(pts); for (const h of holes) ring(h);
  // the Piazza del Parlamento front: a plinth, bundles of pilasters every bay, the portal on the left wing (the centre is the Torre Pisana of the centro module)
  const fa = [-639.3, 532.3], fb = [-684.1, 486.2], fl = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]);
  const Mf = frame((fa[0] + fb[0]) / 2, gy, (fa[1] + fb[1]) / 2, 0.717, -0.697);
  for (const x of [-fl / 2 + 3.6, -fl / 2 + 10.8, -fl / 2 + 18.0, fl / 2 - 3.6, fl / 2 - 10.8, fl / 2 - 18.0]) {
    bx('noStone', Mf, x - 0.35, x + 0.35, 0, WH - 0.4, 0.0, 0.32, { c: '#e2c691' });
    for (const dx of [-0.2, 0.2]) cyl('noStone', 0.1, 0.1, WH - 1.0, 6, { M: mul(Mf, tr(x + dx, 0.6, 0.38)), c: '#ead7ab' });
    bx('noStone', Mf, x - 0.4, x + 0.4, WH - 0.4, WH - 0.1, 0.0, 0.4, { c: '#d9bd86' });
  }
  const MP = mul(Mf, tr(-fl / 4, 0, 0.3));
  bx('noStone', MP, -2.8, 2.8, 0, 7.8, 0, 0.9, { c: '#d8c196' });
  panel('noPortal', 5.0, 10.0, { M: mul(MP, tr(0, 0, 0.92)), noao: true });
  bx('noStone', MP, -3.0, 3.0, 7.8, 8.3, 0, 1.2, { c: '#e4cf9e' });
  return end('Palazzo dei Normanni');
}
export const NORMANNI = { name: 'Palazzo dei Normanni', x: -700, z: 502, radius: 120, skipIds: [FP.normanni.id], build: buildNormanni };

// ====================================================================================================
// Stazione Marittima (1930s, the port's passenger terminal): a long low block of cream plaster on a red brick ground storey, a taller central pavilion with three tall arched windows and the name in
// letters over them, and a flat portico on square pillars along the quay side.
// ====================================================================================================
const SM = { HW: 11.5, HP: 15.4, PW: 24, BAY: 5.75 };
function paintSmWing(g, w, h) {
  const { HW, BAY } = SM, sx = w / BAY, sy = h / HW, X = (s) => s * sx, Y = (y) => h - y * sy, cx = BAY / 2;
  g.fillStyle = '#e9dcb5'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 80, 2, 881, ['rgba(120,90,50,0.08)', 'rgba(255,255,240,0.1)']);
  paintAshlar(g, w, Math.round(5.2 * sy), BAY, 5.2, 0.16, 0.5, '#a9523b', '#7a3a2a', 882, 1, 0.1);                                    // the brick storey: courses of small bricks (the canvas above is drawn over it below)
  const img = g.getImageData(0, 0, w, Math.round(5.2 * sy)); g.fillStyle = '#e9dcb5'; g.fillRect(0, 0, w, h); g.putImageData(img, 0, h - Math.round(5.2 * sy));
  g.fillStyle = '#f3ecd2'; g.fillRect(0, Y(5.5), w, 0.3 * sy); g.fillRect(0, Y(HW), w, 0.5 * sy);                                         // the string course and the cornice
  g.fillStyle = '#2a3340'; g.beginPath(); g.moveTo(X(cx - 0.8), Y(1.0)); g.lineTo(X(cx - 0.8), Y(3.8)); g.arc(X(cx), Y(3.8), 0.8 * sx, PI, 0); g.lineTo(X(cx + 0.8), Y(1.0)); g.fill();   // an arched window in the brick
  g.strokeStyle = '#e9dcb5'; g.lineWidth = 0.14 * sx; g.stroke();
  g.fillStyle = '#f3ecd2'; g.fillRect(X(cx - 0.95), Y(10.2), 1.9 * sx, 3.5 * sy); g.fillStyle = '#2a3340'; g.fillRect(X(cx - 0.75), Y(10.0), 1.5 * sx, 3.1 * sy);   // the upper window
  g.fillStyle = 'rgba(10,10,12,0.6)'; g.fillRect(X(cx) - 1, Y(10.0), 2, 3.1 * sy); g.fillRect(X(cx - 0.75), Y(8.5), 1.5 * sx, 2);
  streaks(g, w, h, 6, 883, 0.16, 120);
}
function paintSmPavilion(g, w, h) {
  const { PW, HP } = SM, sx = w / PW, sy = h / HP, X = (s) => s * sx, Y = (y) => h - y * sy;
  g.fillStyle = '#eadfb9'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 80, 2, 891, ['rgba(120,90,50,0.08)', 'rgba(255,255,240,0.1)']);
  paintAshlar(g, w, Math.round(4.2 * sy), PW, 4.2, 0.16, 0.5, '#a9523b', '#7a3a2a', 892, 1, 0.1);
  const img = g.getImageData(0, 0, w, Math.round(4.2 * sy)); g.fillStyle = '#eadfb9'; g.fillRect(0, 0, w, h); g.putImageData(img, 0, h - Math.round(4.2 * sy));
  g.fillStyle = '#f3ecd2'; g.fillRect(0, Y(4.5), w, 0.3 * sy);
  for (const x of [5.0, 12.0, 19.0]) {
    g.fillStyle = '#f5eed6'; g.beginPath(); g.moveTo(X(x - 1.95), Y(4.9)); g.lineTo(X(x - 1.95), Y(10.6)); g.arc(X(x), Y(10.6), 1.95 * sx, PI, 0); g.lineTo(X(x + 1.95), Y(4.9)); g.fill();       // the stucco frame
    g.fillStyle = '#2b3744'; g.beginPath(); g.moveTo(X(x - 1.6), Y(5.1)); g.lineTo(X(x - 1.6), Y(10.6)); g.arc(X(x), Y(10.6), 1.6 * sx, PI, 0); g.lineTo(X(x + 1.6), Y(5.1)); g.fill();       // the dark glass
    g.fillStyle = 'rgba(190,210,225,0.18)'; g.fillRect(X(x - 1.6), Y(10.0), 3.2 * sx, 4.0 * sy);
    g.fillStyle = 'rgba(12,12,14,0.7)'; g.fillRect(X(x) - 1, Y(12.2), 2, 7.1 * sy); for (const y of [7.0, 9.2]) g.fillRect(X(x - 1.6), Y(y), 3.2 * sx, 2);
    g.fillStyle = '#1d1815'; g.beginPath(); g.moveTo(X(x - 1.2), Y(0.3)); g.lineTo(X(x - 1.2), Y(3.0)); g.arc(X(x), Y(3.0), 1.2 * sx, PI, 0); g.lineTo(X(x + 1.2), Y(0.3)); g.fill();                 // the doors under them
  }
  g.fillStyle = '#f3ecd2'; g.fillRect(0, Y(13.2), w, 1.4 * sy); g.fillStyle = '#4a3a2e'; g.font = `bold ${(1.0 * sy) | 0}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STAZIONE MARITTIMA', w / 2, Y(12.5));
  g.fillStyle = '#f3ecd2'; g.fillRect(0, Y(HP), w, 0.6 * sy);
  for (const x of [0.0, PW - 0.9]) { g.fillStyle = '#f3ecd2'; g.fillRect(X(x), 0, 0.9 * sx, h); }                                        // the corner pilasters
  streaks(g, w, h, 8, 893, 0.16, 140);
}
const SM_O = obb(pairsOf(FP.stazioneMarittima.p));
const SM_FRONT = (() => { const o = SM_O, dots = [[o.vx, o.vz], [-o.vx, -o.vz]]; const f = dots[0][1] < dots[1][1] ? dots[0] : dots[1]; return f; })();   // the quay side is the north one (-z)
const SM_PILLARS = (() => {   // the portico pillar positions on the front, in the frame of the long axis (x along it, z towards the quay)
  const o = SM_O, out = [], n = Math.floor((o.w - 10) / SM.BAY), x0 = -(n - 1) * SM.BAY / 2;
  for (let i = 0; i < n; i++) { const x = x0 + i * SM.BAY; if (Math.abs(x) < SM.PW / 2 + 0.5) continue; out.push(x); }
  return out;
})();
function buildStazioneMarittima() {
  initShared();
  const pts = pairsOf(FP.stazioneMarittima.p), gr = groundRange(pts), o = SM_O, gy = gr.hi + 0.1, nx = SM_FRONT[0], nz = SM_FRONT[1];
  begin(gy);
  defMat('smWing', 192, 384, [SM.BAY, SM.HW], paintSmWing);
  defMat('smPav', 768, 480, [SM.PW, SM.HP], paintSmPavilion);
  defMat('smStone', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#e9dfc0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 895, ['rgba(110,90,60,0.1)', 'rgba(255,255,245,0.1)']); });
  shell('smWing', pts, [], gy, SM.HW, { lo: gr.lo - 1.5, roof: '#a39e92', cc: '#f0e8cc' });
  // the central pavilion: a block on the long axis, a metre and a half proud of the front, its own painted face on the quay side and plain cream elsewhere
  const M = frame(o.cx, gy, o.cz, nx, nz), PD = o.d / 2 - 0.2;
  bx('smStone', M, -SM.PW / 2, SM.PW / 2, 0, SM.HP, -PD - 1.0, PD + 1.5, { c: '#ecdfb8' });
  panel('smPav', SM.PW, SM.HP, { M: mul(M, tr(0, 0, PD + 1.52)), noao: true });
  panel('smPav', SM.PW, SM.HP, { M: mul(M, mul(rotY(PI), tr(0, 0, PD + 1.02))), noao: true });
  bx('smStone', M, -SM.PW / 2 - 0.3, SM.PW / 2 + 0.3, SM.HP, SM.HP + 0.5, -PD - 1.3, PD + 1.8, { c: '#f3ecd2' });
  bx('flat', M, -SM.PW / 2, SM.PW / 2, SM.HP + 0.5, SM.HP + 0.62, -PD - 1.0, PD + 1.5, { c: '#9a958a', noao: true });
  // the portico along the quay side of the wings: a flat slab on square pillars, 3.2 m deep, 4.6 m up
  const Lw = o.w - 4, Dq = PD + 3.2;
  for (const sg of [-1, 1]) {
    const x0 = sg * (SM.PW / 2 + 0.2), x1 = sg * (Lw / 2);
    bx('smStone', M, Math.min(x0, x1), Math.max(x0, x1), 4.6, 5.0, PD - 0.2, Dq, { c: '#f0e8cc' });
  }
  for (const x of SM_PILLARS) bx('smStone', M, x - 0.28, x + 0.28, 0, 4.6, Dq - 0.5, Dq, { c: '#efe6c8' });
  return end('Stazione Marittima');
}
const SM_WALLS = (() => {   // the pavilion's front is proud of the footprint; the portico pillars are square posts
  const o = SM_O, O = [o.cx, o.cz], nx = SM_FRONT[0], nz = SM_FRONT[1], PD = o.d / 2 - 0.2, Dq = PD + 3.2, out = [];
  out.push(...rectSegs(O, nx, nz, -SM.PW / 2, SM.PW / 2, PD - 0.5, PD + 1.5));
  for (const x of SM_PILLARS) out.push(...rectSegs(O, nx, nz, x - 0.3, x + 0.3, Dq - 0.5, Dq));
  return out;
})();
export const STAZIONE_MARITTIMA = { name: 'Stazione Marittima', x: 441, z: -1250, radius: 70, skipIds: [FP.stazioneMarittima.id], build: buildStazioneMarittima, walls: SM_WALLS };
