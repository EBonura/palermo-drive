// City landmarks, group A: Politeama Garibaldi (with its piazza monument), Stadio Renzo Barbera, Castello Utveggio, Santuario di Santa Rosalia.
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, setBase, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, archShape, rectShape, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, ringSegs, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  balus, rail, statue, horse, palm, crenel, crag,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';

// pale grey limestone of the Pellegrino cliffs (shared by the Utveggio footing and the Santuario backdrop)
function cliffMat() {
  defMat('cliff', 256, 256, [7, 7], (g, w, h) => {
    g.fillStyle = '#a8a69c'; g.fillRect(0, 0, w, h); const r = RNG(391);
    noiseDots(g, w, h, 1500, 4, 392, ['rgba(70,66,58,0.22)', 'rgba(228,224,210,0.28)', 'rgba(130,126,112,0.2)']);
    g.strokeStyle = 'rgba(52,48,42,0.32)'; g.lineWidth = 2;
    for (let i = 0; i < 16; i++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 16; y += 30 + r() * 20; g.lineTo(x, y); } g.stroke(); }
    streaks(g, w, h, 24, 393, 0.16, 160, '60,54,44');
  });
}

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
  const STONE = '#ffffff';
  const A0 = -PI / 2, A1 = PI / 2, SEG = 42;
  // ---- foundations and steps
  bx('tufa', M, -27, 27, -(gr.hi - gr.lo) - 1.5, -0.12, -50, 33, { c: '#b9a67c' });
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
  lathe('tile', [[24.2, 0], [22, 0.7], [16, 2.3], [14.5, 2.7]], 42, { M, p: [0, WY1 + 1.9, 0], t0: -PI / 2, tl: PI, c: '#d8a48e', noao: true });
  cyl('stone', 14.5, 14.5, 3.2, 28, { M, p: [0, WY1 + 4.6, 0], c: '#cbbf9f' });
  lathe('lead', [[14.5, 0], [13.2, 1.4], [9.5, 3.2], [4, 4.3], [0.01, 4.6]], 28, { M, p: [0, WY1 + 7.8, 0], noao: true });

  // ---- central arch block with the quadriga
  const BW = 15.7, BZ1 = 26.9, BZ0 = 10.5, AH = 17.5;
  archBay('tufa', BW, AH, 8.4, 12.8, BZ1 - 22.4, { M: mul(M, tr(0, 0, 22.4)), c: STONE });
  bx('tufa', M, -BW / 2, BW / 2, 0, AH, BZ0, 22.4, { c: STONE });
  box('dark', 8.2, 12.2, 0.3, { M: mul(M, tr(0, 0.1, 22.5)), c: '#1c1612', noao: true });
  for (const sg of [-1, 1]) {
    for (const [w, y0, h] of [[1.2, 2.2, 3.4], [1.2, 9.0, 3.4]]) box('dark', w, h, 0.25, { M: mul(M, tr(sg * 6.1, y0, BZ1 + 0.02)), c: '#37291f', noao: true });
    for (const x of [sg * 3.0, sg * 4.2]) { cyl('marble', 0.32, 0.36, 11.8, 8, { M: mul(M, tr(x, 0.3, BZ1 + 0.2)), c: '#f0e6c8' }); box('tufa', 0.9, 0.5, 0.9, { M: mul(M, tr(x, 12.1, BZ1 + 0.2)), c: STONE }); }
  }
  bx('tufa', M, -BW / 2 - 0.8, BW / 2 + 0.8, AH, AH + 0.8, BZ0, BZ1 + 0.9, { c: '#eadcb8' });
  bx('tufa', M, -BW / 2 - 0.2, BW / 2 + 0.2, AH + 0.8, AH + 1.2, BZ0, BZ1 + 0.3, { c: '#e0d0a4' });
  panel('polFrieze', BW, 4.4, { M: mul(M, tr(0, AH + 1.2, BZ1 + 0.02)), uvk: [1, 1] });
  bx('tufa', M, -BW / 2, BW / 2, AH + 1.2, AH + 5.6, BZ0, BZ1 - 0.02, { c: STONE });
  bx('tufa', M, -BW / 2 - 0.6, BW / 2 + 0.6, AH + 5.6, AH + 6.4, BZ0, BZ1 + 0.7, { c: '#eadcb8' });
  bx('tufa', M, -6, 6, AH + 6.4, AH + 7.4, BZ1 - 8.6, BZ1 - 3.4, { c: '#d9c89e' });
  // the quadriga: four bronze horses abreast, a charioteer, and a horse-and-rider group on each corner
  const QY = AH + 7.4, MQ = mul(M, tr(0, QY, BZ1 - 6));
  box('bronze', 3.6, 0.6, 3.2, { M: MQ, p: [0, 0.2, -2.4], c: '#5d6b4f' });
  box('bronze', 2.6, 2.4, 0.5, { M: MQ, p: [0, 0.8, -3.7], c: '#5d6b4f' });
  statue('bronze', mul(MQ, tr(0, 0.8, -2.4)), 3.4, { c: '#6f7d5c', noao: true });
  for (let i = 0; i < 4; i++) horse(mul(MQ, tr((i - 1.5) * 1.1, 0, 0)), 1.45, { rear: i % 2 === 0, c: '#6f7d5c' });
  for (const sg of [-1, 1]) { const Mh = mul(MQ, tr(sg * 6.0, 0, 0.6)); horse(Mh, 1.5, { c: '#6f7d5c', rear: true }); statue('bronze', mul(Mh, tr(0, 1.7, -0.1)), 2.3, { c: '#6f7d5c', noao: true }); }
  // ---- stage house behind the colonnade
  const SW = 58.8, SZ0 = -1.0, SZ1 = -43.3;
  bx('polBack', M, -SW / 2, SW / 2, 0, 29, SZ1, SZ0);
  bx('polBack', M, -21.3, 21.3, 0, 22, SZ1 - 9, SZ1 + 0.1);
  bx('stone', M, -SW / 2 - 0.4, SW / 2 + 0.4, 29, 30, SZ1 - 0.4, SZ0 + 0.4, { c: '#d0c3a0' });
  bx('flat', M, -SW / 2 + 3, SW / 2 - 3, 30, 30.4, SZ1 + 3, SZ0 - 3, { c: '#9a948a' });
  bx('stone', M, -21.7, 21.7, 22, 22.8, SZ1 - 9.4, SZ1 + 0.1, { c: '#d0c3a0' });
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

// ====================================================================================================
// 2. Stadio Renzo Barbera: the OSM ring (outer wall, hole = the playing area) becomes a two-tier bowl, canopies on the long sides,
//    four floodlight towers, a red running track round the pitch, and a vehicle gate through the stands at the north end.
// ====================================================================================================
const GATE = { x: -1668, halfW: 3.6 };
function rayHit(ring, cx, cz, dx, dz) {
  let best = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ez - (a[1] - cz) * ex) / den, s = ((a[0] - cx) * dz - (a[1] - cz) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best;
}
function stadiumCollision() {
  const fp = FP.stadio, outer = pairsOf(fp.p), hole = pairsOf(fp.holes[0]), out = [];
  const clip = (s) => { // cut the gate gap out of a segment that crosses it
    const [x0, z0, x1, z1] = s, lo = GATE.x - GATE.halfW, hi = GATE.x + GATE.halfW, mnx = Math.min(x0, x1), mxx = Math.max(x0, x1);
    if (mxx < lo || mnx > hi || Math.abs(z0 + 4185) > 25) return [s];
    const r = [], zAt = (x) => z0 + (z1 - z0) * (x - x0) / (x1 - x0 || 1);
    if (x0 < lo && x1 > lo || x1 < lo && x0 > lo) r.push(x0 < x1 ? [x0, z0, lo, zAt(lo)] : [x1, z1, lo, zAt(lo)]);
    else if (mnx < lo) r.push(x0 < x1 ? [x0, z0, Math.min(x1, lo), zAt(Math.min(x1, lo))] : [x1, z1, Math.min(x0, lo), zAt(Math.min(x0, lo))]);
    if (x0 < hi && x1 > hi || x1 < hi && x0 > hi) r.push(x0 < x1 ? [hi, zAt(hi), x1, z1] : [hi, zAt(hi), x0, z0]);
    else if (mxx > hi) r.push(x0 < x1 ? [Math.max(x0, hi), zAt(Math.max(x0, hi)), x1, z1] : [Math.max(x1, hi), zAt(Math.max(x1, hi)), x0, z0]);
    return r.filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) > 0.05);
  };
  for (const ring of [outer, hole]) for (const s of ringSegs(ring)) {
    if (ring === outer ? s[1] < -4180 && s[3] < -4180 : s[1] > -4175 && s[1] < -4160 && s[3] > -4175 && s[3] < -4160) out.push(...clip(s)); else out.push(s);
  }
  const zo = -4204.6, zi = -4167.4;
  out.push([GATE.x - GATE.halfW, zo, GATE.x - GATE.halfW, zi], [GATE.x + GATE.halfW, zo, GATE.x + GATE.halfW, zi]);
  return out;
}

function buildStadio() {
  initShared();
  const fp = FP.stadio, outer = pairsOf(fp.p), hole = pairsOf(fp.holes[0]);
  const ob = obb(hole), cx = ob.cx, cz = ob.cz, N = 96;
  const gc = groundY(cx, cz);
  begin(gc);
  const U = [ob.ux, ob.uz], Vv = [ob.vx, ob.vz];
  // textures
  defMat('stSeats', 256, 256, [4, 4], (g, w, h) => {
    g.fillStyle = '#7d7b76'; g.fillRect(0, 0, w, h); const r = RNG(501);
    for (let row = 0; row < 5; row++) { const y = row * 51; g.fillStyle = '#9a978f'; g.fillRect(0, y, w, 13);
      for (let s = 0; s < 8; s++) { const k = r(); g.fillStyle = k < 0.06 ? '#e0709e' : k < 0.12 ? '#20262b' : (k < 0.5 ? '#2f7d52' : '#37875a'); g.fillRect(s * 32 + 3, y + 15, 26, 33); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(s * 32 + 3, y + 44, 26, 4); } }
  }, { side: THREE.DoubleSide });
  defMat('stConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#a8a59d'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 502, ['rgba(60,60,55,0.12)', 'rgba(240,240,230,0.12)']); g.fillStyle = 'rgba(40,40,40,0.25)'; g.fillRect(0, 60, w, 2); }, { side: THREE.DoubleSide });
  defMat('stPink', 64, 64, [2, 2], (g, w, h) => { g.fillStyle = '#e7a2bb'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 100, 2, 503, ['rgba(120,60,80,0.15)']); }, { side: THREE.DoubleSide });
  defMat('stAds', 256, 64, [16, 1.5], (g, w, h) => { const r = RNG(504), cols = ['#14161a', '#e46fa0', '#f2f2ee', '#2e6fb8', '#f0c437', '#14161a', '#e46fa0']; let x = 0; while (x < w) { const bw = 20 + r() * 30; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, 0, bw, h); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 4, 22, bw * 0.6, 5); g.fillRect(x + 4, 34, bw * 0.4, 4); x += bw; } }, { side: THREE.DoubleSide });
  defMat('stFacade', 256, 512, [12, 18], (g, w, h) => paintFacade(g, w, h, 12, 18, { base: '#d8d2c4', trim: '#bfb8a8', glass: '#2a8c93', seed: 505,
    bands: [{ y: 13.4, h: 3.6, c: '#2f9aa1' }, { y: 5.4, h: 0.5, c: '#a9a396' }], pil: { xs: [0, 6], w: 0.8, c: '#e9e4d8' },
    rows: [{ y0: 1.2, y1: 4.2, n: 4, m: 1.5, w: 1.6, kind: 'rect', fr: 0.1, ped: false, glass: '#59636b' }, { y0: 7.0, y1: 10.5, n: 3, m: 2.2, w: 2.2, kind: 'rect', fr: 0.1, glass: '#59636b' }] }), { side: THREE.DoubleSide });
  defMat('stTeal', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#2b9ea3'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,50,60,0.3)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); noiseDots(g, w, h, 200, 2, 506, ['rgba(255,255,255,0.08)']); }, { side: THREE.DoubleSide });
  defMat('stSteel', 0, 0, [1, 1], null, { roughness: 0.6 });
  defMat('stLamp', 0, 0, [1, 1], null, { roughness: 1, emissive: new THREE.Color('#fff6d8'), emissiveIntensity: 0.9 });
  const PW = ob.w + 4, PH = ob.d + 4;
  defMat('stPitch', 1024, Math.round(1024 * PH / PW), [1, 1], (g, w, h) => {
    const sx = w / PW, sy = h / PH, X = (m) => w / 2 + m * sx, Y = (m) => h / 2 + m * sy;
    g.fillStyle = '#b4584a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 3000, 2, 507, ['rgba(80,30,20,0.18)', 'rgba(230,150,120,0.15)']);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; for (const r of [-0.5, 0.5]) { }
    const gx0 = -57.5, gx1 = 57.5, gy0 = -37, gy1 = 37;
    g.fillStyle = '#4a8a3c'; g.fillRect(X(gx0), Y(gy0), (gx1 - gx0) * sx, (gy1 - gy0) * sy);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,30,0,0.10)'; g.fillRect(X(-52.5 + i * 7), Y(-34), 7 * sx, 68 * sy); }
    g.strokeStyle = '#eef2ea'; g.lineWidth = 3; g.strokeRect(X(-52.5), Y(-34), 105 * sx, 68 * sy);
    g.beginPath(); g.moveTo(X(0), Y(-34)); g.lineTo(X(0), Y(34)); g.stroke(); g.beginPath(); g.arc(X(0), Y(0), 9.15 * sx, 0, 7); g.stroke();
    for (const s of [-1, 1]) { g.strokeRect(s > 0 ? X(52.5 - 16.5) : X(-52.5), Y(-20.2), 16.5 * sx, 40.4 * sy); g.strokeRect(s > 0 ? X(52.5 - 5.5) : X(-52.5), Y(-9.2), 5.5 * sx, 18.4 * sy); }
  });
  // polar sampling of the two rings from the centre of the playing area
  const D = [], I = [], O = [], gI = [], gO = [];
  for (let k = 0; k < N; k++) {
    const a = k / N * 2 * PI, dx = Math.cos(a), dz = Math.sin(a), ri = rayHit(hole, cx, cz, dx, dz), ro = rayHit(outer, cx, cz, dx, dz);
    D.push([dx, dz]); I.push([cx + dx * ri, cz + dz * ri]); O.push([cx + dx * ro, cz + dz * ro]);
    gI.push(groundY(I[k][0], I[k][1])); gO.push(groundY(O[k][0], O[k][1]));
  }
  const arc = [0]; for (let k = 1; k <= N; k++) arc.push(arc[k - 1] + Math.hypot(I[k % N][0] - I[k - 1][0], I[k % N][1] - I[k - 1][1]));
  const PROF = [[0.0, 1.5], [0.03, 1.6], [0.40, 8.2], [0.46, 8.5], [0.52, 8.5], [0.53, 9.6], [0.93, 18.0], [1.0, 18.2]];
  const ST = PROF.map(([t, h]) => I.map((p, k) => [p[0] + (O[k][0] - p[0]) * t, gI[k] + h, p[1] + (O[k][1] - p[1]) * t]));
  const dist = PROF.map(() => new Array(N + 1).fill(0));
  for (let i = 1; i < PROF.length; i++) for (let k = 0; k < N; k++) dist[i][k] = dist[i - 1][k] + Math.hypot(ST[i][k][0] - ST[i - 1][k][0], ST[i][k][1] - ST[i - 1][k][1], ST[i][k][2] - ST[i - 1][k][2]);
  const gateCut = (a, b, c, d) => { const mx = (a[0] + b[0] + c[0] + d[0]) / 4, mz = (a[2] + b[2] + c[2] + d[2]) / 4, my = (a[1] + b[1] + c[1] + d[1]) / 4; return Math.abs(mx - GATE.x) < GATE.halfW + 0.9 && mz < cz - 30 && my - gc < 6.4; };
  const seatUV = (i, j) => [arc[j] / 4, dist[i][j % N] / 4];
  const band = (i0, i1, key, skip) => gridMesh(key, ST.slice(i0, i1 + 1), (i, j) => [arc[j] / 4, dist[i0 + i][j % N] / 4], { wrap: true, skip: skip ? (i, j, a, b, c, d) => gateCut(a, b, c, d) : undefined });
  band(0, 1, 'stSeats', true); band(1, 2, 'stSeats', true); band(2, 3, 'stConc', true); band(3, 4, 'stConc', true); band(4, 5, 'stConc'); band(5, 6, 'stSeats'); band(6, 7, 'stPink');
  // front wall with advertising boards
  gridMesh('stAds', [I.map((p, k) => [p[0], gI[k], p[1]]), I.map((p, k) => [p[0], gI[k] + 1.5, p[1]])], (i, j) => [arc[j] / 16, i], { wrap: true, skip: (i, j, a, b, c, d) => Math.abs((a[0] + b[0]) / 2 - GATE.x) < GATE.halfW + 0.3 && a[2] < cz - 30 });
  // outer facade: lower band (with the gate opening cut out) and an upper band that bridges the gate
  const HF = (k) => gI[k] + 18.6;
  const fa = (y) => O.map((p, k) => [p[0], y(k), p[1]]);
  const ac = [0]; for (let k = 1; k <= N; k++) ac.push(ac[k - 1] + Math.hypot(O[k % N][0] - O[k - 1][0], O[k % N][1] - O[k - 1][1]));
  gridMesh('stFacade', [fa(k => gO[k] - 0.8), fa(k => Math.max(gO[k], gI[k]) + 5.6)], (i, j) => [ac[j] / 12, i * 0.31], { wrap: true, skip: (i, j, a, b) => Math.abs((a[0] + b[0]) / 2 - GATE.x) < GATE.halfW + 1.0 && a[2] < cz - 30 });
  gridMesh('stFacade', [fa(k => Math.max(gO[k], gI[k]) + 5.6), fa(HF)], (i, j) => [ac[j] / 12, 0.31 + i * 0.69], { wrap: true });
  gridMesh('stPink', [fa(HF), fa(k => HF(k) + 0.9)], (i, j) => [ac[j] / 2, i], { wrap: true });
  // ribs on the outside
  for (let k = 0; k < N; k += 4) { const Mk = frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]); bx('stConc', Mk, -0.55, 0.55, 0, HF(k) - gO[k] + 0.8, 0, 0.7, { c: '#e9e4d8' }); }
  // canopies over the two long sides (the near side higher and deeper), with white pylons
  for (const sg of [1, -1]) {
    const ks = []; for (let k = 0; k < N; k++) if (Math.abs(D[k][0] * Vv[0] + D[k][1] * Vv[1]) > 0.62 && Math.sign(D[k][0] * Vv[0] + D[k][1] * Vv[1]) === sg) ks.push(k);
    if (ks.length < 3) continue;
    const t0 = sg > 0 ? 0.36 : 0.60, h0 = sg > 0 ? 15.2 : 14.6, h1 = sg > 0 ? 20.2 : 19.4;
    const row = (t, h, kk) => kk.map(k => [I[k][0] + (O[k][0] - I[k][0]) * t, gI[k] + h, I[k][1] + (O[k][1] - I[k][1]) * t]);
    gridMesh('stTeal', [row(t0, h0, ks), row(1.04, h1, ks)], (i, j) => [j * 1.5, i * 4], {});
    gridMesh('stSteel', [row(1.04, h1 - 0.5, ks), row(1.04, h1 + 0.5, ks)], () => [0, 0], {}); // back fascia
    for (let q = 0; q < ks.length; q += 3) { const k = ks[q]; bx('stSteel', frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]), -0.5, 0.5, 0, gI[k] + h1 - gO[k] + 0.8, 1.6, 2.6, { c: '#e9e4d8' }); }
  }
  // pitch and track, draped on the ground
  const SR = 7, rows = [];
  for (let s = 0; s <= SR; s++) { const f = s / SR; rows.push(I.map((p, k) => { const x = cx + (p[0] - cx) * f, z = cz + (p[1] - cz) * f; return [x, groundY(x, z) + 0.07, z]; })); }
  gridMesh('stPitch', rows, (i, j, p) => { const dx = p[0] - ob.cx, dz = p[2] - ob.cz; return [(dx * U[0] + dz * U[1]) / PW + 0.5, (dx * Vv[0] + dz * Vv[1]) / PH + 0.5]; }, { wrap: true, noao: true });
  // goals
  for (const s of [-1, 1]) { const Mg = frame(ob.cx + U[0] * 52.5 * s, groundY(cx, cz) + 0.07, ob.cz + U[1] * 52.5 * s, -U[0] * s, -U[1] * s);
    bx('marble', Mg, -3.7, -3.6, 0, 2.44, 0, 0.12); bx('marble', Mg, 3.6, 3.7, 0, 2.44, 0, 0.12); bx('marble', Mg, -3.7, 3.7, 2.34, 2.44, 0, 0.12);
    bx('rail', Mg, -3.7, 3.7, 0, 2.4, -2.0, -1.9, { noao: true }); }
  // the gate: concrete floor and side walls through the lower tier, with a roof slab
  const zo = -4204.6, zi = -4167.4, ym = groundY(GATE.x, (zo + zi) / 2);
  bx('stConc', tr(0, 0, 0), GATE.x - GATE.halfW, GATE.x + GATE.halfW, ym + 0.06, ym + 0.1, zo - 1, zi + 3, { noao: true });
  for (const sg of [-1, 1]) bx('stConc', tr(0, 0, 0), GATE.x + sg * GATE.halfW - 0.3 + (sg > 0 ? 0.3 : 0), GATE.x + sg * GATE.halfW + 0.3 + (sg > 0 ? 0.3 : 0), ym, ym + 6.2, zo - 1, zi + 3.5, { c: '#d2cfc6' });
  bx('stConc', tr(0, 0, 0), GATE.x - GATE.halfW - 0.3, GATE.x + GATE.halfW + 0.6, ym + 5.4, ym + 6.2, zo - 1.2, zi + 3.5, { c: '#d2cfc6' });
  // floodlight towers on the four diagonals
  for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let bk = 0, bd = -2; const tx = U[0] * 0.75 * sa + Vv[0] * 0.66 * sb, tz = U[1] * 0.75 * sa + Vv[1] * 0.66 * sb;
    for (let k = 0; k < N; k++) { const d = D[k][0] * tx + D[k][1] * tz; if (d > bd) { bd = d; bk = k; } }
    const x = O[bk][0] + D[bk][0] * 7, z = O[bk][1] + D[bk][1] * 7, y = groundY(x, z), Mt = frame(x, y - 0.5, z, -D[bk][0], -D[bk][1]);
    cyl('stSteel', 0.45, 0.8, 44, 8, { M: Mt, c: '#c9ccd0' });
    bx('stSteel', Mt, -4.5, 4.5, 43, 44.4, -1.2, 0.2, { c: '#b9bcc0', noao: true });
    for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) bx('stLamp', Mt, -4.2 + q * 1.5, -3.2 + q * 1.5, 44.4 + r * 1.3, 45.4 + r * 1.3, 0.1, 0.5, { noao: true });
  }
  return end('Stadio Renzo Barbera');
}

export const STADIO = {
  name: 'Stadio Renzo Barbera', x: -1666, z: -4097, radius: 140, skipIds: [FP.stadio.id, 'w124120091'], dropWalls: [FP.stadio.id, 'w124120091'],
  walls: stadiumCollision(), gate: { x: GATE.x, z: -4204.6, to: -4167.4, halfW: GATE.halfW },
  build: buildStadio,
};

// ====================================================================================================
// 3. Castello Utveggio on Monte Pellegrino: salmon-pink hotel castle, arcaded front, two crenellated end towers, round bastion at the foot
// ====================================================================================================
function skirtDown(key, M, w, d, lo, o = {}) { bx(key, M, -w / 2, w / 2, lo, 0.02, -d / 2, d / 2, o); }

function buildUtveggio() {
  initShared();
  const pts = pairsOf(FP.utveggio.p), gr = groundRange(pts);
  const gy = gr.hi + 0.3;
  const nx = 0.985, nz = 0.17, cxw = -489.0, czw = -4019.4;
  const M = frame(cxw, gy, czw, nx, nz);
  begin(gy);
  const LW = 46.5, WD = 19, H = 17;
  defMat('utvWall', 256, 256, [8, 12], (g, w, h) => paintFacade(g, w, h, 8, 12, { base: '#dba892', trim: '#f0dfc6', glass: '#2d2f38', seed: 601, plinth: { h: 0.8, c: '#b98f7c' },
    bands: [{ y: 5.2, h: 0.35, c: '#ecd3bc' }, { y: 10.4, h: 0.35, c: '#ecd3bc' }],
    rows: [{ y0: 1.4, y1: 3.8, xs: [2, 6], w: 1.0, kind: 'rect' }, { y0: 6.6, y1: 9.0, xs: [2, 6], w: 1.0, kind: 'arch' }, { y0: 11.4, y1: 13.8, xs: [2, 6], w: 1.0, kind: 'rect', shut: 'open' }], shut: '#7a5a4a' }));
  defMat('utvFront', 1024, 512, [LW, 17], (g, w, h) => {
    const xs = []; for (let i = 0; i < 12; i++) xs.push(2.0 + i * 3.6);
    paintFacade(g, w, h, LW, 17, { base: '#dba892', trim: '#f0dfc6', glass: '#2d2f38', seed: 602, plinth: { h: 0.9, c: '#b98f7c' },
      bands: [{ y: 5.6, h: 0.4, c: '#ecd3bc' }, { y: 11.4, h: 0.4, c: '#ecd3bc' }, { y: 15.8, h: 0.5, c: '#ecd3bc' }],
      rows: [{ y0: 1.6, y1: 4.2, xs, w: 1.1, kind: 'rect' }, { y0: 6.6, y1: 10.2, xs: xs.slice(2, 10), w: 2.3, kind: 'arch', fr: 0.25, sill: false }, { y0: 6.8, y1: 9.4, xs: [xs[0], xs[1], xs[10], xs[11]], w: 1.1, kind: 'rect', shut: 'open' }, { y0: 12.2, y1: 14.8, xs, w: 1.1, kind: 'rect', shut: 'open' }], shut: '#7a5a4a' });
  });
  // the grey limestone crag the castle sits on, with a stone retaining base just under the walls
  cliffMat();
  const drop = Math.min(46, gr.hi - gr.lo + 14);
  crag('cliff', mul(M, tr(0, -1.2, 0)), LW / 2 * 1.2 + 1.5, (WD / 2 + 2.5) * 1.3, drop, { spread: 1.55, seed: 3, jit: 0.2 });
  crag('cliff', mul(M, tr(-LW * 0.32, -4, -WD * 0.35)), 12, 9, drop * 0.7, { spread: 1.7, seed: 9, jit: 0.25, seg: 10 });
  skirtDown('stone', M, LW + 2, WD + 3, -2.6, { c: '#b5ad9d' });
  // main wing: front texture panel, solid body, cornice, crenellations
  bx('utvWall', M, -LW / 2, LW / 2, 0, H, -WD / 2, WD / 2 - 0.02, { c: '#ffffff' });
  panel('utvFront', LW, 17, { M: mul(M, tr(0, 0, WD / 2 + 0.01)), uvk: [1, 1] });
  bx('flat', M, -LW / 2 - 0.4, LW / 2 + 0.4, H, H + 0.7, -WD / 2 - 0.4, WD / 2 + 0.5, { c: '#e5c4ae' });
  crenel(mul(M, tr(0, H + 0.7, WD / 2 + 0.4)), LW + 0.8, { c: '#e0b9a2' }); crenel(mul(M, mul(rotY(PI), tr(0, H + 0.7, WD / 2 + 0.4))), LW + 0.8, { c: '#e0b9a2' });
  // end towers
  for (const sg of [-1, 1]) {
    const Mt = mul(M, tr(sg * (LW / 2 - 4.2), 0, 1.5)), TH = sg < 0 ? 19.6 : 23.5;   // the right-hand tower is the tall one
    bx('utvWall', Mt, -4.8, 4.8, 0, TH, -5.4, 5.4, { c: '#ffffff' });
    bx('flat', Mt, -5.4, 5.4, TH, TH + 0.8, -6.0, 6.0, { c: '#e5c4ae' });
    for (let q = 0; q < 4; q++) crenel(mul(Mt, mul(rotY(q * PI / 2), tr(0, TH + 0.8, q % 2 ? 5.9 : 5.5))), q % 2 ? 11.6 : 10.8, { c: '#e0b9a2' });
  }
  // the round bastion and the terrace wall at the foot (north-west blob of the footprint)
  const bxw = -510.5, bzw = -3985.0, by = Math.max(gr.hi - 1.5, groundY(bxw, bzw));
  crag('cliff', tr(bxw, by + 1.7 - 1.5, bzw), 12.6, 12.6, by - groundY(bxw, bzw) + 6, { spread: 1.35, seed: 5, jit: 0.1 });
  cyl('stone', 12.5, 12.6, 3.2, 16, { p: [bxw, by - 1.5, bzw], c: '#b9ad98' });
  lathe('stone', [[12.5, 0], [12.5, 0.9], [11.5, 0.9]], 16, { p: [bxw, by + 1.7, bzw], c: '#c9bda7' });
  // a long retaining wall in front of the castle, with crenellated coping
  const Mw = mul(M, tr(0, 0, WD / 2 + 7));
  bx('stone', Mw, -LW / 2 + 2, LW / 2 - 6, -(gr.hi - gr.lo) - 3, 0.2, -1.0, 1.0, { c: '#b5aa96' });
  crenel(mul(Mw, tr(0, 0.2, 1.0)), LW - 8, { c: '#c4b8a0' });
  // roof terrace details
  box('flat', 8, 2.4, 6, { M: mul(M, tr(-6, H + 0.7, -3)), c: '#d6b49e' });
  return end('Castello Utveggio');
}
export const UTVEGGIO = { name: 'Castello Utveggio', x: -503, z: -4000, radius: 80, skipIds: [FP.utveggio.id], build: buildUtveggio };

// ====================================================================================================
// 4. Santuario di Santa Rosalia: ochre convent-church built against the cliff, with a clock gable and a stair up from the road
// ====================================================================================================
function buildSantuario() {
  initShared();
  const pts = pairsOf(FP.santuario.p), gr = groundRange(pts), ob = obb(pts);
  const fr = facing(ob, 0.35, 1);
  const gy = gr.hi + 0.2, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = fr.w + 3, Dp = fr.d, H = 13.2;
  defMat('sanFront', 512, 256, [W, H], (g, w, h) => paintFacade(g, w, h, W, H, { base: '#ecca8c', trim: '#f8f1de', glass: '#2c333b', seed: 611, plinth: { h: 0.9, c: '#a9a08a' },
    bands: [{ y: 4.7, h: 0.3, c: '#f0e0b8' }, { y: 9.2, h: 0.3, c: '#f0e0b8' }, { y: 12.9, h: 0.3, c: '#f0e0b8' }],
    rows: [{ y0: 1.5, y1: 3.8, n: 4, m: 2.4, w: 1.0, kind: 'rect', shut: 'open' }, { y0: 5.7, y1: 8.4, n: 4, m: 2.4, w: 1.1, kind: 'rect', ped: true, shut: 'open', balc: true }, { y0: 10.1, y1: 12.2, n: 4, m: 2.4, w: 1.0, kind: 'rect', shut: 'open' }], shut: '#3f7050' }));
  defMat('sanSide', 256, 256, [6, 12], (g, w, h) => paintFacade(g, w, h, 6, 12, { base: '#e6c486', trim: '#f4ead2', glass: '#2c333b', seed: 612, rows: [{ y0: 1.5, y1: 3.8, xs: [3], w: 1.0, kind: 'rect' }, { y0: 6, y1: 8.4, xs: [3], w: 1.0, kind: 'rect', shut: 'open' }], shut: '#4d6a4a' }));
  skirtDown('stone', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 3, { c: '#a8a08e' });
  bx('sanSide', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.02, {});
  panel('sanFront', W, H, { M: mul(M, tr(0, 0, Dp / 2 + 0.01)) });
  bx('flat', M, -W / 2 - 0.4, W / 2 + 0.4, H, H + 0.5, -Dp / 2 - 0.4, Dp / 2 + 0.5, { c: '#ecdcb4' });
  gable('tile', 'sanSide', mul(M, tr(0, H + 0.5, -2)), W - 0.5, Dp - 4, 0, 2.2, { ov: 0.6 });
  // stone portal and the clock gable over the entrance
  const MP = mul(M, tr(W * 0.18, 0, Dp / 2 + 0.01));
  bx('tufa', MP, -1.6, 1.6, 0, 4.6, 0, 0.5, { c: '#d9cfb4' });
  archBay('tufa', 3.4, 5.2, 1.9, 3.4, 0.6, { M: mul(MP, tr(0, 0, 0.2)), c: '#d9cfb4' });
  bx('dark', MP, -0.9, 0.9, 0, 2.7, 0.25, 0.4, { noao: true });
  const MC = mul(M, tr(W * 0.18, H + 0.5, Dp / 2 - 2.6));
  bx('sanSide', MC, -2.2, 2.2, 0, 5.6, -2.0, 2.0, {}); bx('flat', MC, -2.5, 2.5, 5.6, 6.0, -2.3, 2.3, { c: '#ecdcb4' });
  pyramid('tile', 5.0, 4.6, 2.6, { M: mul(MC, tr(0, 6.0, 0)) });
  box('marble', 1.5, 1.5, 0.15, { M: mul(MC, tr(0, 3.2, 2.05)), c: '#f2eee4' }); box('dark', 0.9, 1.2, 0.1, { M: mul(MC, tr(-1.2, 1.1, 2.05)), noao: true });
  // stairs up from the road
  for (let i = 0; i < 18; i++) bx('stone', M, -W * 0.4 + 6, W * 0.4 + 6, -i * 0.38 - 0.02, -i * 0.38 + 0.18 + 0.0, Dp / 2 + 0.6 + i * 0.46, Dp / 2 + 0.6 + i * 0.46 + 0.5, { c: '#b5ad9b' });
  bx('stone', M, -W * 0.4 + 6, W * 0.4 + 6, -8, -0.05, Dp / 2 + 0.4, Dp / 2 + 8.8, { c: '#a9a190' });
  // the pale limestone cliff the sanctuary is cut into: a sheer wall behind and to the right, broken into blocks
  cliffMat();
  const r_ = RNG(613);
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 - 4 + i * (W + 14) / 5, hh = 46 + r_() * 22, zz = -Dp / 2 - 3.5 - r_() * 3;
    box('cliff', 11 + r_() * 4, hh, 9 + r_() * 3, { M: mul(M, tr(x, -4, zz)), rx: -0.04 - r_() * 0.06, rz: (r_() - 0.5) * 0.08, ry: (r_() - 0.5) * 0.3, c: '#ffffff', noao: true });
  }
  for (let i = 0; i < 3; i++) box('cliff', 10, 36 + i * 9, 12, { M: mul(M, tr(W / 2 + 4 + i * 4.5, -4, -Dp / 2 + 2 - i * 4)), rz: 0.05, ry: 0.25 * i, c: '#ffffff', noao: true });
  return end('Santuario di Santa Rosalia');
}
export const SANTUARIO = { name: 'Santuario di Santa Rosalia', x: -825, z: -5780, radius: 60, skipIds: [FP.santuario.id], build: buildSantuario };
