// City landmarks, group A: Politeama Garibaldi (with its piazza monument), Stadio Renzo Barbera, Castello Utveggio, Santuario di Santa Rosalia.
import {
  THREE, PI, begin, end, setBase, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, archShape, rectShape, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, ringSegs, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  balus, rail, statue, horse, palm,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';

// partial cylinder band (outer wall), facing outward, over the angle range [a0, a1] measured from +z towards +x
function arcWall(key, r, y0, y1, a0, a1, seg, o = {}) { cyl(key, r, r, y1 - y0, seg, { open: true, t0: a0, tl: a1 - a0, p: [0, y0, 0], noao: o.noao, ...o }); }
// annulus sector facing up (or down) at height y, between angles a0..a1 measured from +z towards +x
function deck(key, r0, r1, y, a0, a1, seg, o = {}, down = false) {
  const g = down ? new THREE.RingGeometry(r0, r1, seg, 1, PI / 2 - a1, a1 - a0) : new THREE.RingGeometry(r0, r1, seg, 1, a0 - PI / 2, a1 - a0);
  g.rotateX(down ? PI / 2 : -PI / 2);
  part(key, g, { p: [0, y, 0], ...o });
}
function band(key, r0, r1, y0, y1, a0, a1, seg, o = {}) { arcWall(key, r1, y0, y1, a0, a1, seg, o); deck(key, r0, r1, y1, a0, a1, seg, o); deck(key, r0, r1, y0, a0, a1, seg, { ...o, noao: true }, true); }

// ====================================================================================================
// 1. Teatro Politeama Garibaldi
// ====================================================================================================
function buildPolitea(ctx) {
  initShared(); ensureTrunk();
  const fp = FP.politeama, pts = pairsOf(fp.p), gr = groundRange(pts);
  const FX = -0.891, FZ = 0.454;                          // front normal (towards Piazza Ruggero Settimo, west-south-west)
  const OX = -408.2, OZ = -1037.5;                        // centre of the semicircular colonnade
  const gy = gr.hi, M = frame(OX, gy, OZ, FX, FZ);
  begin(gy);
  defMat('polWall', 256, 512, [4.0, 8.0], (g, w, h) => paintFacade(g, w, h, 4.0, 8.0, { base: '#cf9b78', trim: '#ecdcb8', glass: '#33261f', seed: 401,
    bands: [{ y: 0, h: 0.5, c: '#bf8a68' }], rows: [{ y0: 1.6, y1: 5.8, xs: [2.0], w: 1.3, kind: 'arch', fr: 0.2, sill: false }] }));
  defMat('polBack', 256, 256, [6, 8], (g, w, h) => paintFacade(g, w, h, 6, 8, { base: '#dcc9a6', trim: '#efe3c8', glass: '#2c2b2c', seed: 402,
    bands: [{ y: 7.6, h: 0.4, c: '#eadcbc' }], rows: [{ y0: 0.9, y1: 3.3, xs: [1.5, 4.5], w: 1.1, kind: 'rect', ped: true }, { y0: 4.4, y1: 6.9, xs: [1.5, 4.5], w: 1.1, kind: 'rect', shut: 'open' }], shut: '#6a5a44' }));
  defMat('polFrieze', 512, 128, [15.7, 4.4], (g, w, h) => {
    g.fillStyle = '#dccba0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 411, ['rgba(110,90,60,0.1)']);
    g.fillStyle = '#c9b88c'; g.fillRect(8, 10, w - 16, h - 20); g.strokeStyle = '#8a7650'; g.lineWidth = 3; g.strokeRect(8, 10, w - 16, h - 20);
    const r = RNG(412); g.fillStyle = '#eee3c4'; for (let x = 22; x < w - 20; x += 22) { const hh = 30 + r() * 38; g.fillRect(x, h - 16 - hh, 9, hh); g.beginPath(); g.arc(x + 4, h - 20 - hh, 6, 0, 7); g.fill(); g.fillRect(x - 4, h - 16 - hh * 0.6, 17, 5); }
  });
  const STONE = '#e4d4aa', DK = '#2a2220';
  const A0 = -PI / 2, A1 = PI / 2, SEG = 42;
  // ---- foundations and steps
  box('tufa', 52, gr.hi - gr.lo + 1.5, 50, { M: mul(M, tr(0, -(gr.hi - gr.lo) - 1.5, 4)), c: '#b9a67c' });
  // ---- ground arcade of the semicircle
  const NB = 21, R0 = 23.2, ARC_D = 3.6, BAYH = 7.6;
  arcWall('dark', R0 - ARC_D + 0.2, 0, BAYH, A0, A1, SEG, { M, c: '#4a3a30', noao: true });
  for (let k = 0; k < NB; k++) {
    const a = -PI / 2 + (k + 0.5) * PI / NB, rr = R0 - ARC_D, bw = 2 * R0 * Math.sin(PI / NB / 2) + 0.03;
    archBay('tufa', bw, BAYH, 2.3, 5.4, ARC_D, { M: mul(M, mul(rotY(a), tr(0, 0, rr))), c: STONE });
  }
  // cornice slab between the storeys, and the first-floor deck
  band('tufa', 18.6, R0 + 1.0, BAYH, BAYH + 0.6, A0, A1, SEG, { M, c: '#eadcb8' });
  // ---- upper storey: wall with windows and a colonnade
  const WY0 = BAYH + 0.6, WY1 = 15.4;
  arcWall('polWall', 19.6, WY0, WY1, A0, A1, SEG, { M });
  const NC = 29;
  for (let k = 0; k <= NC; k++) {
    const a = -PI / 2 + k * PI / NC, x = Math.sin(a) * 22.7, z = Math.cos(a) * 22.7, Mc = mul(M, mul(tr(x, WY0, z), rotY(a)));
    cyl('marble', 0.32, 0.38, WY1 - WY0 - 0.9, 8, { M: Mc, p: [0, 0.35, 0], c: '#f0e6c8' });
    box('tufa', 0.9, 0.35, 0.9, { M: Mc, c: STONE }); box('tufa', 0.95, 0.55, 0.95, { M: Mc, p: [0, WY1 - WY0 - 0.55, 0], c: STONE });
  }
  // entablature and attic ring
  band('tufa', 19.6, 24.0, WY1, WY1 + 1.5, A0, A1, SEG, { M, c: '#e6d6ac' });
  band('tufa', 19.6, 24.5, WY1 + 1.5, WY1 + 1.9, A0, A1, SEG, { M, c: '#efe1ba' });
  // roof ring (terracotta) and the low lead dome
  lathe('tile', [[24.2, 0], [22, 0.7], [16, 2.3], [14.5, 2.7]], 42, { M, p: [0, WY1 + 1.9, 0], t0: -PI / 2, tl: PI, c: '#e2a58a', noao: true });
  cyl('stone', 14.5, 14.5, 3.2, 28, { M, p: [0, WY1 + 4.6, 0], c: '#cbbf9f' });
  lathe('lead', [[14.5, 0], [13.2, 1.4], [9.5, 3.2], [4, 4.3], [0.01, 4.6]], 28, { M, p: [0, WY1 + 7.8, 0], noao: true });

  // ---- central arch block with the quadriga
  const BW = 15.7, BZ1 = 26.9, BZ0 = 10.5, AH = 17.5;
  archBay('tufa', BW, AH, 8.4, 12.8, BZ1 - 22.4, { M: mul(M, tr(0, 0, 22.4)), c: STONE });
  box('tufa', BW, AH, 22.4 - BZ0, { M: mul(M, tr(0, 0, BZ0)), c: STONE });
  box('dark', 8.2, 12.2, 0.3, { M: mul(M, tr(0, 0.1, 22.5)), c: '#1c1612', noao: true });
  for (const sg of [-1, 1]) {
    for (const [w, y0, h] of [[1.2, 2.2, 3.4], [1.2, 9.0, 3.4]]) box('dark', w, h, 0.25, { M: mul(M, tr(sg * 6.1, y0, BZ1 + 0.02)), c: '#37291f', noao: true });
    for (const x of [sg * 3.0, sg * 4.2]) { cyl('marble', 0.32, 0.36, 11.8, 8, { M: mul(M, tr(x, 0.3, BZ1 + 0.2)), c: '#f0e6c8' }); box('tufa', 0.9, 0.5, 0.9, { M: mul(M, tr(x, 12.1, BZ1 + 0.2)), c: STONE }); }
  }
  box('tufa', BW + 1.6, 0.8, BZ1 - BZ0 + 0.9, { M: mul(M, tr(0, AH, BZ0)), c: '#eadcb8' });
  box('tufa', BW + 0.4, 0.4, BZ1 - BZ0 + 0.3, { M: mul(M, tr(0, AH + 0.8, BZ0)), c: '#e0d0a4' });
  panel('polFrieze', BW, 4.4, { M: mul(M, tr(0, AH + 1.2, BZ1 + 0.02)), uvk: [1, 1] });
  box('tufa', BW, 4.4, BZ1 - BZ0 - 0.2, { M: mul(M, tr(0, AH + 1.2, BZ0)), c: STONE });
  box('tufa', BW + 1.2, 0.8, BZ1 - BZ0 + 0.7, { M: mul(M, tr(0, AH + 5.6, BZ0)), c: '#eadcb8' });
  box('tufa', 12, 1.0, 5.2, { M: mul(M, tr(0, AH + 6.4, BZ1 - 6)), c: '#d9c89e' });
  // the quadriga: four bronze horses abreast, a charioteer, and a horse-and-rider group on each corner
  const QY = AH + 7.4, MQ = mul(M, tr(0, QY, BZ1 - 6));
  box('bronze', 3.6, 0.6, 3.2, { M: MQ, p: [0, 0.2, -2.4], c: '#3e4a3a' });
  box('bronze', 2.6, 2.4, 0.5, { M: MQ, p: [0, 0.8, -3.7], c: '#3e4a3a' });
  statue('bronze', mul(MQ, tr(0, 0.8, -2.4)), 3.4, { c: '#425040', noao: true });
  for (let i = 0; i < 4; i++) horse(mul(MQ, tr((i - 1.5) * 1.1, 0, 0)), 1.45, { rear: i % 2 === 0, c: '#425040' });
  for (const sg of [-1, 1]) { const Mh = mul(MQ, tr(sg * 6.0, 0, 0.6)); horse(Mh, 1.5, { c: '#425040', rear: true }); statue('bronze', mul(Mh, tr(0, 1.7, -0.1)), 2.3, { c: '#425040', noao: true }); }
  // ---- stage house behind the colonnade
  const SW = 58.8, SZ0 = -1.0, SZ1 = -43.3;
  box('polBack', SW, 29, SZ0 - SZ1, { M: mul(M, tr(0, 0, SZ1)), uvo: [0, 0], c: '#ffffff' });
  box('polBack', 42.5, 22, 9.0, { M: mul(M, tr(0, 0, SZ1 - 9)), c: '#ffffff' });
  box('stone', SW + 0.8, 1.0, SZ0 - SZ1 + 0.8, { M: mul(M, tr(0, 29, SZ1 - 0.4)), c: '#d0c3a0' });
  box('tile', SW - 6, 1.4, SZ0 - SZ1 - 6, { M: mul(M, tr(0, 30, SZ1 + 3)), c: '#c28668' });
  box('stone', 42.5, 0.8, 9.0, { M: mul(M, tr(0, 22, SZ1 - 9)), c: '#d0c3a0' });
  // ---- the monument in the piazza: stepped base, pedestal and statue, ringed by an iron railing
  const MZ = 49, MM = mul(M, tr(0, 0, MZ));
  for (let i = 0; i < 3; i++) cyl('marble', 7.2 - i * 1.0, 7.4 - i * 1.0, 0.25, 12, { M: MM, p: [0, -0.1 + i * 0.25 - 0.0, 0], c: '#cfc9bb' });
  cyl('marble', 2.0, 2.4, 4.0, 8, { M: MM, p: [0, 0.65, 0], c: '#d6d0c2' }); box('marble', 3.2, 0.5, 3.2, { M: MM, p: [0, 4.65, 0], c: '#dcd6c8' });
  statue('marble', mul(MM, tr(0, 5.1, 0)), 3.6, { c: '#d8d2c2' });
  for (let k = 0; k < 16; k++) { const a = k * PI / 8 + PI / 16; rail(mul(MM, mul(rotY(a), tr(0, 0, 8.6))), 3.5, 1.2, { c: '#ffffff' }); }
  return end('Politeama Garibaldi');
}

export const POLITEAMA = {
  name: 'Politeama Garibaldi', x: -409, z: -1039, radius: 70, skipIds: [FP.politeama.id],
  // iron railing round the monument (an octagon of r ~ 8.6 m centred 49 m in front of the colonnade)
  walls: (() => { const OX = -408.2, OZ = -1037.5, fx = -0.891, fz = 0.454, cx = OX + fx * 49, cz = OZ + fz * 49, o = []; for (let k = 0; k < 8; k++) { const a = k * PI / 4, b = (k + 1) * PI / 4; o.push([cx + Math.cos(a) * 8.6, cz + Math.sin(a) * 8.6, cx + Math.cos(b) * 8.6, cz + Math.sin(b) * 8.6]); } return o; })(),
  build: buildPolitea,
};
