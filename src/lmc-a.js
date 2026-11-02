// City landmarks, group A: Politeama Garibaldi (with its piazza monument), Stadio Renzo Barbera, Castello Utveggio, Santuario di Santa Rosalia.
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, setBase, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, archShape, rectShape, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, ringSegs, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  balus, rail, statue, horse, palm, crenel, crag,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';
import { PITCH_Y } from './stadium-ground.js';
import { buildCrowd } from './stadium-crowd.js';

// grey-ochre limestone of the Pellegrino cliffs (shared by the Utveggio footing and the Santuario backdrop): mottled ochre and lichen-grey patches, short horizontal bedding cracks with a pale lip
// under each, a few vertical joints and dark scrub specks. No long vertical streaks (they read as wood grain).
function cliffMat() {
  defMat('cliff', 256, 256, [9, 9], (g, w, h) => {
    const r = RNG(391), wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    g.fillStyle = '#c3bba7'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 34; i++) {   // soft patches: ochre weathering, grey lichen, pale fresh rock
      const x = r() * w, y = r() * h, rx = 14 + r() * 40, ry = 8 + r() * 22, c = i % 3 === 0 ? '184,156,104' : i % 3 === 1 ? '120,116,106' : '236,230,212', a = 0.08 + r() * 0.1;
      wrap(() => { g.fillStyle = `rgba(${c},${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.3, 0, 7); g.fill(); });
    }
    noiseDots(g, w, h, 1800, 3, 392, ['rgba(80,74,64,0.16)', 'rgba(238,232,214,0.30)', 'rgba(140,132,114,0.20)']);
    for (let i = 0; i < 16; i++) {   // bedding cracks: short, nearly horizontal, with a pale lip below
      let x = r() * w, y = r() * h; const len = 30 + r() * 80; g.lineCap = 'round';
      const pts = [[x, y]]; for (let k = 0; k < 6; k++) { x += len / 6; y += (r() - 0.5) * 5; pts.push([x, y]); }
      for (const [dy, col, lw] of [[2, 'rgba(236,230,212,0.30)', 2.4], [0, 'rgba(52,47,40,0.42)', 1.4]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0], q[1] + dy) : g.moveTo(q[0], q[1] + dy)); g.stroke(); }
    }
    g.strokeStyle = 'rgba(52,47,40,0.30)'; g.lineWidth = 1.1;
    for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 8 + r() * 22); g.stroke(); }   // short vertical joints
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, s = 1.5 + r() * 2.5; g.fillStyle = `rgba(${r() < 0.5 ? '84,90,58' : '108,96,62'},${0.22 + r() * 0.2})`; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 7); g.fill(); }   // scrub in the ledges
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
//    four floodlight towers, a red running track round the pitch, and the vehicle gate: the main entrance in the middle of the front.
// ====================================================================================================
// The front is the covered Tribuna, the long side towards Viale del Fante (west-south-west): the OSM roof polygon (way 124120091) is that stand to the metre, the entrance=main nodes
// line that side, and Via Cassarà, its junction with Viale del Fante and the OSM service road run straight at the middle of its wall (the road ends 2 m along the pitch from the centre).
// (u, v): u along the pitch, v out from its centre towards the front; every x, z of the gate comes from them.
const SD = (() => {
  const outer = pairsOf(FP.stadio.p), hole = pairsOf(FP.stadio.holes[0]), ob = obb(hole), s = ob.ux > 0 ? 1 : -1, U = [ob.ux * s, ob.uz * s];
  return { outer, hole, ob, U, F: [-U[1], U[0]], cx: ob.cx, cz: ob.cz };
})();
const P = (u, v) => [SD.cx + SD.U[0] * u + SD.F[0] * v, SD.cz + SD.U[1] * u + SD.F[1] * v];
const lat = (x, z) => (x - SD.cx) * SD.U[0] + (z - SD.cz) * SD.U[1], dep = (x, z) => (x - SD.cx) * SD.F[0] + (z - SD.cz) * SD.F[1];
// u, halfW: where the gate is along the front and half its width; PD: how far the entrance block stands out of the wall; EX: how far the tunnel's walls and roof run on over the track
const GATE = { u: 2.0, halfW: 4.0, PD: 3.2, EX: 3.5 };
{ const g = P(GATE.u, 0); GATE.vOut = rayHit(SD.outer, g[0], g[1], SD.F[0], SD.F[1]); GATE.vIn = rayHit(SD.hole, g[0], g[1], SD.F[0], SD.F[1]); }   // v of the outer wall and of the pitch wall at the gate
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
// the entrance block in front of the gate, seen from above: a pier each side of the opening (PIER wide, GATE.PD out of the wall) and beyond it an arched side door (DOOR wide, DOOR_D out)
const PIER = 2.4, DOOR = 5.0, DOOR_D = 2.4;
function stadiumCollision() {
  const out = [], { outer, hole, ob } = SD, lo = GATE.u - GATE.halfW, hi = GATE.u + GATE.halfW;
  const clip = (s) => { // cut the gate's gap out of a segment of the front wall (both rings)
    const [x0, z0, x1, z1] = s, a = lat(x0, z0), b = lat(x1, z1);
    if (dep((x0 + x1) / 2, (z0 + z1) / 2) < 30 || Math.max(a, b) <= lo || Math.min(a, b) >= hi) return [s];
    if (Math.abs(b - a) < 1e-6) return [];
    const t1 = (lo - a) / (b - a), t2 = (hi - a) / (b - a), tl = Math.min(t1, t2), th = Math.max(t1, t2), at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t], r = [];
    if (tl > 0) r.push([x0, z0, ...at(Math.min(tl, 1))]);
    if (th < 1) r.push([...at(Math.max(th, 0)), x1, z1]);
    return r.filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) > 0.05);
  };
  for (const ring of [outer, hole]) for (const s of ringSegs(ring)) out.push(...clip(s));
  // the tunnel's two walls, from the front of the entrance block to where the roof ends over the track, and the block itself: the piers beside the gate and the two arched doors
  const v0 = GATE.vOut + GATE.PD, v1 = GATE.vIn - GATE.EX, seg = (l0, v0_, l1, v1_) => out.push([...P(l0, v0_), ...P(l1, v1_)]);
  for (const l of [lo, hi]) seg(l, v0, l, v1);
  for (const sg of [-1, 1]) {
    const e = sg < 0 ? lo : hi, e1 = e + sg * PIER, e2 = e1 + sg * DOOR;
    seg(e, v0, e1, v0); seg(e1, v0, e1, GATE.vOut);
    seg(e1, GATE.vOut + DOOR_D, e2, GATE.vOut + DOOR_D); seg(e2, GATE.vOut + DOOR_D, e2, GATE.vOut);
  }
  // the two goals are solid: a box over the mouth (7.4 m between the posts) and the net behind it (the models are at u = +-52.5 along the pitch, below)
  const Q = (u, v) => [ob.cx + ob.ux * u + ob.vx * v, ob.cz + ob.uz * u + ob.vz * v];
  for (const sg of [-1, 1]) { const a = Q(52.5 * sg, -3.7), b = Q(52.5 * sg, 3.7), c = Q(55.0 * sg, 3.7), d = Q(55.0 * sg, -3.7); out.push([...a, ...b], [...b, ...c], [...c, ...d], [...d, ...a]); }
  return out;
}

function buildStadio() {
  initShared();
  const fp = FP.stadio, outer = pairsOf(fp.p), hole = pairsOf(fp.holes[0]);
  const ob = obb(hole), cx = ob.cx, cz = ob.cz, N = 120;
  const gc = PITCH_Y - 0.8;   // about the terrain under the pitch (the playing area is a flat platform over it, src/stadium-ground.js)
  begin(gc);
  const U = [ob.ux, ob.uz], Vv = [ob.vx, ob.vz];
  // ---- textures. Real colours (Commons photos and the satellite view): teal-green and blue plastic seats, white concrete with teal roofs, rose concrete walkways.
  defMat('stSeats', 256, 256, [4, 4], (g, w, h) => {
    g.fillStyle = '#6d7d78'; g.fillRect(0, 0, w, h); const r = RNG(501);
    for (let row = 0; row < 5; row++) { const y = row * 51; g.fillStyle = '#b7b2a6'; g.fillRect(0, y, w, 12);
      for (let s = 0; s < 8; s++) { const k = r(); g.fillStyle = k < 0.07 ? '#c9d2d4' : k < 0.16 ? '#2f6f9a' : (k < 0.55 ? '#2c8f7f' : '#3aa08c'); g.fillRect(s * 32 + 3, y + 14, 26, 31); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(s * 32 + 3, y + 41, 26, 4); } }
  }, { side: THREE.DoubleSide });
  defMat('stConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#cfccc2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 502, ['rgba(60,60,55,0.12)', 'rgba(250,250,240,0.14)']); g.fillStyle = 'rgba(40,40,40,0.22)'; g.fillRect(0, 60, w, 2); }, { side: THREE.DoubleSide });
  defMat('stRing', 64, 64, [3, 3], (g, w, h) => { g.fillStyle = '#d4aaa0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 160, 2, 503, ['rgba(120,60,60,0.16)', 'rgba(255,225,215,0.18)']); }, { side: THREE.DoubleSide });
  defMat('stAds', 256, 64, [16, 1.5], (g, w, h) => { const r = RNG(504), cols = ['#14161a', '#e46fa0', '#f2f2ee', '#2e6fb8', '#f0c437', '#14161a', '#e46fa0']; let x = 0; while (x < w) { const bw = 20 + r() * 30; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, 0, bw, h); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 4, 22, bw * 0.6, 5); g.fillRect(x + 4, 34, bw * 0.4, 4); x += bw; } }, { side: THREE.DoubleSide });
  // outer facade: pale concrete with a pylon every bay, rows of dark openings, a blue-teal band under the eaves
  defMat('stFacade', 256, 512, [13, 22], (g, w, h) => paintFacade(g, w, h, 13, 22, { base: '#dfdcd2', trim: '#c7c3b8', glass: '#35606c', seed: 505,
    bands: [{ y: 17.2, h: 3.4, c: '#2e7f94' }, { y: 8.6, h: 0.5, c: '#bdb9ae' }], pil: { xs: [0, 6.5], w: 1.0, c: '#efede6' },
    rows: [{ y0: 1.2, y1: 4.4, n: 3, m: 2.0, w: 1.6, kind: 'rect', fr: 0.1, glass: '#4a5560' }, { y0: 10.0, y1: 13.2, n: 3, m: 2.0, w: 2.2, kind: 'rect', fr: 0.1, glass: '#3f6a7a' }] }), { side: THREE.DoubleSide });
  defMat('stTeal', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#287a78'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,50,60,0.3)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); noiseDots(g, w, h, 200, 2, 506, ['rgba(255,255,255,0.08)']); }, { side: THREE.DoubleSide });
  defMat('stRoofTop', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#c3cdc8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(70,90,85,0.25)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); noiseDots(g, w, h, 200, 2, 509, ['rgba(255,255,255,0.12)']); }, { side: THREE.DoubleSide });
  defMat('stRoofUnder', 0, 0, [1, 1], null, { roughness: 1, side: THREE.DoubleSide });
  defMat('stSteel', 0, 0, [1, 1], null, { roughness: 0.6 });
  defMat('stLamp', 0, 0, [1, 1], null, { roughness: 1, emissive: new THREE.Color('#fff6d8'), emissiveIntensity: 0.9 });
  defMat('stFence', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#8f9498'; g.fillRect(0, 2, w, 3); g.fillRect(0, h - 5, w, 3); for (let x = 4; x < w; x += 8) g.fillRect(x, 0, 2, h); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  const PW = ob.w + 4, PH = ob.d + 4;
  defMat('stPitch', 1024, Math.round(1024 * PH / PW), [1, 1], (g, w, h) => {   // the track (red, requested) round the grass; lifted 0.8 m over the raised layer (street_raised sits about 0.35 m over the terrain mesh here)
    const sx = w / PW, sy = h / PH, X = (m) => w / 2 + m * sx, Y = (m) => h / 2 + m * sy;
    g.fillStyle = '#b4584a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 3000, 2, 507, ['rgba(80,30,20,0.18)', 'rgba(230,150,120,0.15)']);
    const gx0 = -57.5, gx1 = 57.5, gy0 = -37, gy1 = 37;
    g.fillStyle = '#4a8a3c'; g.fillRect(X(gx0), Y(gy0), (gx1 - gx0) * sx, (gy1 - gy0) * sy);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,30,0,0.10)'; g.fillRect(X(-52.5 + i * 7), Y(-34), 7 * sx, 68 * sy); }
    g.strokeStyle = '#eef2ea'; g.lineWidth = 3; g.strokeRect(X(-52.5), Y(-34), 105 * sx, 68 * sy);
    g.beginPath(); g.moveTo(X(0), Y(-34)); g.lineTo(X(0), Y(34)); g.stroke(); g.beginPath(); g.arc(X(0), Y(0), 9.15 * sx, 0, 7); g.stroke();
    for (const s of [-1, 1]) { g.strokeRect(s > 0 ? X(52.5 - 16.5) : X(-52.5), Y(-20.2), 16.5 * sx, 40.4 * sy); g.strokeRect(s > 0 ? X(52.5 - 5.5) : X(-52.5), Y(-9.2), 5.5 * sx, 18.4 * sy); }
  }, { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -12 });   // no slope factor: seen edge-on from outside it pulled the pitch through the stands as a green line
  // polar sampling of the two rings from the centre of the playing area
  const D = [], I = [], O = [], gI = [], gO = [];
  for (let k = 0; k < N; k++) {
    const a = k / N * 2 * PI, dx = Math.cos(a), dz = Math.sin(a), ri = rayHit(hole, cx, cz, dx, dz), ro = rayHit(outer, cx, cz, dx, dz);
    D.push([dx, dz]); I.push([cx + dx * ri, cz + dz * ri]); O.push([cx + dx * ro, cz + dz * ro]);
    gI.push(groundY(I[k][0], I[k][1])); gO.push(groundY(O[k][0], O[k][1]));
  }
  const arc = [0]; for (let k = 1; k <= N; k++) arc.push(arc[k - 1] + Math.hypot(I[k % N][0] - I[k - 1][0], I[k % N][1] - I[k - 1][1]));
  // two tiers (lower rake to a rose walkway at about 9 m, upper rake to the rim at about 21 m); t is the fraction of the way from the pitch wall to the outer wall
  const PROF = [[0.0, 1.4], [0.03, 1.5], [0.36, 8.6], [0.42, 8.9], [0.50, 8.9], [0.51, 10.0], [0.93, 21.0], [1.0, 21.4]], HT = 22.0;
  const ST = PROF.map(([t, h]) => I.map((p, k) => [p[0] + (O[k][0] - p[0]) * t, gI[k] + h, p[1] + (O[k][1] - p[1]) * t]));
  const dist = PROF.map(() => new Array(N + 1).fill(0));
  for (let i = 1; i < PROF.length; i++) for (let k = 0; k < N; k++) dist[i][k] = dist[i - 1][k] + Math.hypot(ST[i][k][0] - ST[i - 1][k][0], ST[i][k][1] - ST[i - 1][k][1], ST[i][k][2] - ST[i - 1][k][2]);
  // the gate's width on the front: the stands, the pitch wall and the facade leave out every cell that touches it; the bowl's cells are radial, so the cut is a little wider than the gate,
  // and ext is how far it reaches on each side (the tunnel's abutments below cover it)
  const lo = GATE.u - GATE.halfW, hi = GATE.u + GATE.halfW, ext = { lo, hi };
  const overGate = (track, ...p) => {
    let l0 = 1e9, l1 = -1e9; for (const q of p) { const l = lat(q[0], q[2]); l0 = Math.min(l0, l); l1 = Math.max(l1, l); }
    if (l1 <= lo || l0 >= hi || dep((p[0][0] + p[2][0]) / 2, (p[0][2] + p[2][2]) / 2) < 30) return false;
    if (track) { ext.lo = Math.min(ext.lo, l0); ext.hi = Math.max(ext.hi, l1); }
    return true;
  };
  const gateCut = (a, b, c, d) => (a[1] + b[1] + c[1] + d[1]) / 4 - gc < 6.4 && overGate(true, a, b, c, d);
  const band = (i0, i1, key, skip) => gridMesh(key, ST.slice(i0, i1 + 1), (i, j) => [arc[j] / 4, dist[i0 + i][j % N] / 4], { wrap: true, skip: skip ? (i, j, a, b, c, d) => gateCut(a, b, c, d) : undefined });
  band(0, 1, 'stSeats', true); band(1, 2, 'stSeats', true); band(2, 3, 'stConc', true); band(3, 4, 'stRing', true); band(4, 5, 'stConc'); band(5, 6, 'stSeats'); band(6, 7, 'stConc');
  // radial gangways (rose concrete) down both tiers, one every five samples
  for (let k = 2; k < N; k += 5) for (const [i0, i1] of [[1, 2], [5, 6]]) {
    const a = ST[i0][k], b = ST[i1][k], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (lat(a[0], a[2]) > ext.lo - 1.5 && lat(a[0], a[2]) < ext.hi + 1.5 && dep(a[0], a[2]) > 30) continue;
    box('stRing', 1.3, 0.12, len, { p: [a[0], a[1] + 0.04, a[2]], ry: Math.atan2(dx, dz), rx: -Math.asin(dy / len), noao: true });
  }
  // front wall with advertising boards
  gridMesh('stAds', [I.map((p, k) => [p[0], gI[k], p[1]]), I.map((p, k) => [p[0], gI[k] + 1.5, p[1]])], (i, j) => [arc[j] / 16, i], { wrap: true, skip: (i, j, a, b, c, d) => overGate(true, a, b, c, d) });
  // outer facade: lower band (the gate's opening cut out, strips filled in up to its edges) and an upper band that bridges the gate
  const HF = (k) => gI[k] + HT;
  const fa = (y) => O.map((p, k) => [p[0], y(k), p[1]]);
  const ac = [0]; for (let k = 1; k <= N; k++) ac.push(ac[k - 1] + Math.hypot(O[k % N][0] - O[k - 1][0], O[k % N][1] - O[k - 1][1]));
  const FL = 0.27;   // v of the lower band's top in the facade texture
  const fl = { l0: 1e9, l1: -1e9 };   // the cut's reach along the front, with the edge points [bottom, top, arc length] at both ends
  gridMesh('stFacade', [fa(k => gO[k] - 0.8), fa(k => Math.max(gO[k], gI[k]) + 5.6)], (i, j) => [ac[j] / 13, i * FL], { wrap: true, skip: (i, j, a, b, c, d) => {
    if (!overGate(false, a, b, c, d)) return false;
    for (const [p, q, k] of [[a, d, j], [b, c, j + 1]]) { const l = lat(p[0], p[2]); if (l < fl.l0) { fl.l0 = l; fl.A = [p, q, ac[k]]; } if (l > fl.l1) { fl.l1 = l; fl.B = [p, q, ac[k]]; } }
    return true;
  } });
  for (const [c0, c1] of [[fl.l1, hi], [lo, fl.l0]]) {   // (the bowl's samples run towards smaller u, so the strip nearer the larger u comes first)
    const cols = [c0, c1].map(l => { const f = (l - fl.l0) / (fl.l1 - fl.l0), m = (a, b) => a + (b - a) * f, [A, B] = [fl.A, fl.B], at = (q) => [m(A[q][0], B[q][0]), m(A[q][1], B[q][1]), m(A[q][2], B[q][2])]; return { b: at(0), t: at(1), u: m(A[2], B[2]) }; });
    if (Math.abs(c1 - c0) > 0.05) gridMesh('stFacade', [cols.map(c => c.b), cols.map(c => c.t)], (i, j) => [cols[j].u / 13, i * FL], {});
  }
  gridMesh('stFacade', [fa(k => Math.max(gO[k], gI[k]) + 5.6), fa(HF)], (i, j) => [ac[j] / 13, FL + i * (1 - FL)], { wrap: true });
  gridMesh('stConc', [fa(HF), fa(k => HF(k) + 0.8)], (i, j) => [ac[j] / 2, i], { wrap: true });
  // pylons on the outside (every 4th sample) and the teal eave ring round the whole rim
  const atGate = (x, z, w) => Math.abs(lat(x, z) - GATE.u) < w && dep(x, z) > 30;   // in front of the entrance block, within w of the gate's axis
  const BLOCK = GATE.halfW + PIER + DOOR + 1;   // half the width of the entrance block, and a metre
  for (let k = 0; k < N; k += 4) { if (atGate(O[k][0], O[k][1], BLOCK)) continue; const Mk = frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]); bx('stConc', Mk, -0.6, 0.6, 0, HF(k) - gO[k] + 1.6, 0, 0.9, { c: '#efede6' }); }
  const eaveIn = (k, d, dy) => [O[k][0] - D[k][0] * d, HF(k) + dy, O[k][1] - D[k][1] * d], eaveOut = (k, d, dy) => [O[k][0] + D[k][0] * d, HF(k) + dy, O[k][1] + D[k][1] * d];
  gridMesh('stTeal', [O.map((p, k) => eaveIn(k, 1.2, 0.5)), O.map((p, k) => eaveOut(k, 2.6, -0.5))], (i, j) => [j * 1.2, i * 3], { wrap: true });
  gridMesh('stTeal', [O.map((p, k) => eaveOut(k, 2.6, -0.5)), O.map((p, k) => eaveOut(k, 2.6, -1.4))], (i, j) => [j * 1.2, i], { wrap: true });
  // the covered main stand (Tribuna, the long side towards Viale del Fante: the side of v = WSW): a deep cantilever roof, pale on top, dark underneath, a teal fascia and white pylons
  { const sgn = Vv[0] < 0 ? 1 : -1, SV = [Vv[0] * sgn, Vv[1] * sgn], av = Math.atan2(SV[1], SV[0]);
    const wrap = (a) => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
    const pick = (centre, half) => { const o = []; for (let k = 0; k < N; k++) { const d = wrap(k / N * 2 * PI - centre); if (Math.abs(d) < half) o.push([d, k]); } o.sort((p, q) => p[0] - q[0]); return o.map(p => p[1]); };
    const run = pick(av, 0.95);
    const row = (t, h, kk) => kk.map(k => [I[k][0] + (O[k][0] - I[k][0]) * t, gI[k] + h, I[k][1] + (O[k][1] - I[k][1]) * t]);
    const outerRow = (h, kk, over) => kk.map(k => [O[k][0] + D[k][0] * over, gI[k] + h, O[k][1] + D[k][1] * over]);
    if (run.length > 3) {
      const t0 = 0.28, h0 = 20.5, h1 = 29.5;
      gridMesh('stRoofTop', [row(t0, h0 + 0.35, run), outerRow(h1 + 0.35, run, 6)], (i, j) => [j * 2, i * 4], {});
      gridMesh('stRoofUnder', [row(t0, h0, run), outerRow(h1, run, 6)], () => [0, 0], { flip: true, noao: true, c: '#555c60' });
      gridMesh('stTeal', [row(t0, h0 - 0.4, run), row(t0, h0 + 0.8, run)], (i, j) => [j, i], {});            // front fascia
      gridMesh('stTeal', [outerRow(h1 - 2.4, run, 6), outerRow(h1 + 0.9, run, 6)], (i, j) => [j, i], {});     // back fascia, the tall teal edge seen from the street
      for (let q = 0; q < run.length; q += 3) { const k = run[q]; if (atGate(O[k][0], O[k][1], BLOCK)) continue; bx('stConc', frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]), -0.6, 0.6, 0, gI[k] + h1 - gO[k] + 1.4, 1.2, 2.4, { c: '#efede6' }); }
    }
    // the other long side (Tribuna Montepellegrino) and both ends are open to the sky in the satellite view: no roof there
  }
  // pitch and track, draped on the ground
  const PL = 0.2;   // the pitch is drawn this high over the (lifted) ground: over the raised and green layers of the streets (0.15, 0.16, and their depth offsets), and the lapa stands on it like on a kerb (CURB 0.15)
  const FS = [0, 0.25, 0.5, 0.7, 0.85, 0.9, 0.94, 0.97, 1], rows = [];   // from the centre out (the winding depends on it), finer near the ring where the platform ramps up over a few metres
  for (const f of FS) { rows.push(I.map((p, k) => { const x = cx + (p[0] - cx) * f, z = cz + (p[1] - cz) * f; return [x, groundY(x, z) + PL, z]; })); }
  gridMesh('stPitch', rows, (i, j, p) => { const dx = p[0] - ob.cx, dz = p[2] - ob.cz; return [(dx * U[0] + dz * U[1]) / PW + 0.5, (dx * Vv[0] + dz * Vv[1]) / PH + 0.5]; }, { wrap: true, noao: true });
  // goals
  for (const s of [-1, 1]) { const Mg = frame(ob.cx + U[0] * 52.5 * s, groundY(cx, cz) + PL, ob.cz + U[1] * 52.5 * s, -U[0] * s, -U[1] * s);
    bx('marble', Mg, -3.7, -3.6, 0, 2.44, 0, 0.12); bx('marble', Mg, 3.6, 3.7, 0, 2.44, 0, 0.12); bx('marble', Mg, -3.7, 3.7, 2.34, 2.44, 0, 0.12);
    bx('rail', Mg, -3.7, 3.7, 0, 2.4, -2.0, -1.9, { noao: true }); }
  // the gate, the main entrance: a concrete tunnel from the front to a little way over the track (a floor that follows the ground, two abutments that fill the cut in the stands, a roof slab), and
  // in front of it the entrance block: two piers and a lintel round the opening, an attic with the name, and an arched side door each side (the three arches of the 1932 front). Axis of the gate: u = GATE.u
  { const vf = GATE.vOut + GATE.PD, v1 = GATE.vIn - GATE.EX, go = P(GATE.u, GATE.vOut), Mg = frame(go[0], 0, go[1], SD.F[0], SD.F[1]);
    const gat = (v) => { const q = P(GATE.u, v); return groundY(q[0], q[1]); };
    const gb = (key, l0, l1, y0, y1, w0, w1, o) => bx(key, Mg, l0 - GATE.u, l1 - GATE.u, y0, y1, w0 - GATE.vOut, w1 - GATE.vOut, o);   // a box between laterals l0..l1, heights y0..y1 and v w0..w1
    const rb = Math.max(gat(GATE.vOut), gat(GATE.vIn)) + 5.6, yb = Math.min(gat(GATE.vOut), gat(vf)) - 0.8, yg = yb + 0.8, yl = rb + 1.2, yt = rb + 5.0;   // roof of the tunnel (= the top of the facade's lower band), the foot of the blocks, the ground, the lintel's top, the attic's top, attic top
    const grey = '#d2cfc6', pale = '#ffffff', w0 = GATE.vOut - 0.5, w1 = vf;
    defMat('stApron', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#cfccc2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 400, 2, 511, ['rgba(60,60,55,0.12)', 'rgba(250,250,240,0.14)']); g.fillStyle = 'rgba(40,40,40,0.28)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); },
      { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    defMat('stName', 1024, 288, [1, 1], (g, w, h) => {
      g.fillStyle = '#e8e5db'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 512, ['rgba(60,60,55,0.10)', 'rgba(250,250,240,0.12)']);
      g.fillStyle = '#2e7f94'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillStyle = '#e46fa0'; g.fillRect(40, 118, w - 80, 4);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1f6a80';
      g.font = '700 64px Arial, Helvetica, sans-serif'; g.fillText('S T A D I O', w / 2, 74);
      let fs = 150, t = 'RENZO BARBERA'; do { g.font = `900 ${fs}px Arial, Helvetica, sans-serif`; fs -= 4; } while (g.measureText(t).width > w - 90); g.fillText(t, w / 2, 198);
    });
    // floor
    const rows = [], nf = Math.ceil((vf - v1) / 4);
    for (let i = 0; i <= nf; i++) { const v = vf - (vf - v1) * i / nf; rows.push([lo, hi].map(l => { const q = P(l, v); return [q[0], groundY(q[0], q[1]) + 0.06, q[1]]; })); }
    gridMesh('stConc', rows, (i, j, q) => [lat(q[0], q[2]) / 4, dep(q[0], q[2]) / 4], { noao: true });
    // abutments (the stands' cut reaches a little beyond the gate's walls) and the roof slab
    gb('stConc', ext.lo - 0.05, lo, yb, rb + 0.8, v1, GATE.vOut, { c: grey }); gb('stConc', hi, ext.hi + 0.05, yb, rb + 0.8, v1, GATE.vOut, { c: grey });
    gb('stConc', ext.lo - 0.05, ext.hi + 0.05, rb, rb + 0.8, v1, GATE.vOut, { c: grey });
    // piers, lintel, attic with the name and its cornice
    gb('stConc', lo - PIER, lo, yb, rb, w0, w1, { c: pale }); gb('stConc', hi, hi + PIER, yb, rb, w0, w1, { c: pale });
    gb('stConc', lo - PIER, hi + PIER, rb, yl, w0, w1, { c: pale });
    gb('stTeal', lo - PIER - 0.1, hi + PIER + 0.1, rb + 0.25, rb + 0.85, w1, w1 + 0.08, { noao: true });
    gb('stConc', lo - PIER, hi + PIER, yl, yt, w0, w1, { c: pale });
    gb('stTeal', lo - PIER - 0.5, hi + PIER + 0.5, yt, yt + 0.55, w0, w1 + 0.5, { noao: true });
    panel('stName', hi - lo + 2 * PIER - 1.0, yt - yl - 0.5, { M: mul(Mg, tr(0, yl + 0.25, GATE.PD + 0.02)) });
    // the side doors: an arched recess in a block each side, dark inside
    for (const sg of [-1, 1]) {
      const xc = sg * (GATE.halfW + PIER + DOOR / 2), Md = mul(Mg, tr(xc, yb, -0.3)), oh = 0.8 + 4.6;
      archBay('stConc', DOOR, yl - yb, 2.8, oh, DOOR_D + 0.3, { M: Md, c: pale, oy0: 0.8 });
      extrude('dark', archShape(2.8, oh - 0.8), 0.05, { M: mul(Mg, tr(xc, yg, 0.05)), c: '#2a2622', noao: true });
      gb('stTeal', GATE.u + sg * (GATE.halfW + PIER) - (sg < 0 ? DOOR : 0) - 0.15, GATE.u + sg * (GATE.halfW + PIER) + (sg > 0 ? DOOR : 0) + 0.15, yl, yl + 0.35, w0, GATE.vOut + DOOR_D + 0.15, { noao: true });
    }
    // the forecourt: a concrete apron from the front of the block, level with the ground (the service road runs into it)
    const aw = 5, al = 11, ar = [];
    for (let i = 0; i <= 3; i++) ar.push([0, 1, 2, 3, 4, 5, 6].map(k => { const q = P(lo - aw + (hi - lo + 2 * aw) * k / 6, vf + al * i / 3); return [q[0], groundY(q[0], q[1]) + 0.03, q[1]]; }));
    gridMesh('stApron', ar, (i, j, q) => [lat(q[0], q[2]) / 4, dep(q[0], q[2]) / 4], { noao: true });
  }
  // perimeter fence 13 m outside the wall (Via del Fante side shows the sponsor boards on it), with a gate pier at each turnstile bay
  { const FO = 13;
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N, ax = O[k][0] + D[k][0] * FO, az = O[k][1] + D[k][1] * FO, bx_ = O[k1][0] + D[k1][0] * FO, bz = O[k1][1] + D[k1][1] * FO, l = Math.hypot(bx_ - ax, bz - az);
      if (l < 0.5 || (Math.abs(lat((ax + bx_) / 2, (az + bz) / 2) - GATE.u) < GATE.halfW + 6 + l / 2 && dep(ax, az) > 30)) continue;
      const y = Math.min(groundY(ax, az), groundY(bx_, bz)), Mf = frame((ax + bx_) / 2, y, (az + bz) / 2, -(bz - az) / l, (bx_ - ax) / l);
      panel('stFence', l, 2.2, { M: Mf, uvk: [l / 4, 1], c: '#d8dcde' });
      if (k % 2 === 0) panel('stAds', l, 1.0, { M: mul(Mf, tr(0, 0.9, 0.05)), uvk: [l / 16, 1] });
    }
  }
  // floodlight towers beyond the four corners
  for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let bk = 0, bd = -2; const tx = U[0] * 0.75 * sa + Vv[0] * 0.66 * sb, tz = U[1] * 0.75 * sa + Vv[1] * 0.66 * sb;
    for (let k = 0; k < N; k++) { const d = D[k][0] * tx + D[k][1] * tz; if (d > bd) { bd = d; bk = k; } }
    const x = O[bk][0] + D[bk][0] * 8, z = O[bk][1] + D[bk][1] * 8, y = groundY(x, z), Mt = frame(x, y - 0.5, z, -D[bk][0], -D[bk][1]);
    cyl('stSteel', 0.4, 0.8, 52, 8, { M: Mt, c: '#e4e6e8' });
    bx('stSteel', Mt, -4.8, 4.8, 50.5, 51.8, -1.2, 0.2, { c: '#cfd2d6', noao: true });
    for (let r = 0; r < 3; r++) for (let q = 0; q < 7; q++) bx('stLamp', Mt, -4.5 + q * 1.5, -3.5 + q * 1.5, 51.8 + r * 1.3, 52.8 + r * 1.3, 0.1, 0.5, { noao: true });
  }
  // the crowd: rosanero fans on the seats of both tiers (src/stadium-crowd.js), none in the gate's tunnel or on the cut round it
  const grp = end('Stadio Renzo Barbera');
  grp.add(buildCrowd({ ST, I, O, tiers: [[1, 2, 0.1, 0.95], [5, 6, 0.04, 0.96]], skip: (x, y, z) => lat(x, z) > ext.lo - 0.5 && lat(x, z) < ext.hi + 0.5 && dep(x, z) > 30 && y - gc < 12 }));
  return grp;
}

// The real road is gated and fenced where it meets the stadium (the tile data has panels of fence and a retaining wall across the way in, which the world streams in): the game's entrance is open, so
// the pieces of them inside the strip in front of the gate (18 m wide, from the wall to the carriageway of Viale del Fante) are left out. src/world.js passes each tile's fences through here.
function clearFences(list) {
  if (!list) return list;
  const L0 = GATE.u - 9, L1 = GATE.u + 9, D0 = GATE.vOut - 2, D1 = 121;
  const outside = (ax, az, bx, bz) => {   // the parts [t0, t1] of a segment that lie outside the strip
    let t0 = 0, t1 = 1;
    for (const [a, b, l0, l1] of [[lat(ax, az), lat(bx, bz), L0, L1], [dep(ax, az), dep(bx, bz), D0, D1]]) {
      const d = b - a;
      if (Math.abs(d) < 1e-9) { if (a <= l0 || a >= l1) return [[0, 1]]; continue; }
      const s0 = (l0 - a) / d, s1 = (l1 - a) / d;
      t0 = Math.max(t0, Math.min(s0, s1)); t1 = Math.min(t1, Math.max(s0, s1));
    }
    return t0 >= t1 ? [[0, 1]] : [[0, t0], [t1, 1]].filter(r => r[1] - r[0] > 1e-6);
  };
  const res = [];
  for (const f of list) {
    const p = f.p, runs = []; let run = null, touched = false;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
      const parts = outside(ax, az, bx, bz);
      if (parts.length !== 1 || parts[0][0] > 0 || parts[0][1] < 1) touched = true;
      for (const [t0, t1] of parts) {
        const qa = [ax + (bx - ax) * t0, az + (bz - az) * t0], qb = [ax + (bx - ax) * t1, az + (bz - az) * t1];
        if (run && Math.hypot(run[run.length - 2] - qa[0], run[run.length - 1] - qa[1]) < 1e-6) run.push(qb[0], qb[1]);
        else { if (run) runs.push(run); run = [qa[0], qa[1], qb[0], qb[1]]; }
      }
    }
    if (run) runs.push(run);
    if (!touched) res.push(f); else for (const r of runs) res.push({ ...f, p: r });
  }
  return res;
}

export const STADIO = {
  name: 'Stadio Renzo Barbera', x: -1666, z: -4097, radius: 140, skipIds: [FP.stadio.id, 'w124120091'], dropWalls: [FP.stadio.id, 'w124120091'],
  walls: stadiumCollision(), clearFences,
  // the vehicle entrance: its mouth on the front wall (x, z), its mouth on the pitch wall (x1, z1), the way in (dx, dz) and half its width; the tunnel's clear height is about 5.5 m
  gate: (() => { const a = P(GATE.u, GATE.vOut), b = P(GATE.u, GATE.vIn); return { x: a[0], z: a[1], x1: b[0], z1: b[1], dx: -SD.F[0], dz: -SD.F[1], halfW: GATE.halfW }; })(),
  build: buildStadio,
};

// ====================================================================================================
// 3. Castello Utveggio on Monte Pellegrino: salmon-pink hotel castle, arcaded front, two crenellated end towers, round bastion at the foot
// ====================================================================================================
// lowest ground (world y) under the local rectangle u0..u1 x v0..v1 of the frame M, so a footing can be rooted below the slope in front of a building
function lowestGround(M, u0, u1, v0, v1) {
  const q = new THREE.Vector3(); let lo = Infinity;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { q.set(u0 + (u1 - u0) * i / 6, 0, v0 + (v1 - v0) * j / 6).applyMatrix4(M); lo = Math.min(lo, groundY(q.x, q.z)); }
  return lo;
}
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
  const lowFront = lowestGround(M, -LW / 2 - 8, LW / 2 + 8, -WD / 2 - 6, WD / 2 + 34), drop = Math.min(120, gy - lowFront + 6);   // rooted below the slope in front, so no underside hangs in the air
  crag('cliff', mul(M, tr(0, -1.2, 0)), LW / 2 * 1.2 + 1.5, (WD / 2 + 2.5) * 1.3, drop, { spread: 1.55, seed: 3, jit: 0.24, rough: 0.1, rows: 9, seg: 22, cap: true });
  crag('cliff', mul(M, tr(-LW * 0.32, -4, -WD * 0.35)), 12, 9, drop * 0.7, { spread: 1.7, seed: 9, jit: 0.28, seg: 14, rough: 0.1, rows: 8, cap: true });
  skirtDown('cliff', M, LW + 2, WD + 3, -2.6, { c: '#e8e4d8' });
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
  // a retaining wall in front of the castle with crenellated coping, standing on a rock footing that reaches down to the slope below it (a box that deep was a sheer prism)
  const Mw = mul(M, tr(0, 0, WD / 2 + 7));
  bx('cliff', Mw, -LW / 2 + 2, LW / 2 - 6, -5, 0.2, -1.0, 1.0, { c: '#eeeadc' });
  crag('cliff', mul(Mw, tr(-2, -3, 0)), (LW - 8) / 2 - 1, 4.2, Math.max(8, gy - lowestGround(Mw, -LW / 2 + 2, LW / 2 - 6, -4, 22) + 6), { spread: 1.9, seed: 14, jit: 0.3, rough: 0.12, seg: 20, rows: 8, cap: true });
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
  cliffMat(); skirtDown('cliff', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 3, { c: '#e8e4d8' });
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
  // the grey-ochre limestone cliff the sanctuary is cut into: rock towers behind and to the right, rooted deep in the hillside (they used to be boxes whose underside hung over the road)
  cliffMat();
  const r_ = RNG(613), root = gy - lowestGround(M, -W / 2 - 14, W / 2 + 20, -Dp / 2 - 16, Dp / 2 + 14) + 8;
  // each massif is a stack of four tiers, a broad foot and narrower tiers stepping back above it, so the cliff shows layered ledges (flat tops with scrub) and not a column
  const massif = (x, zz, rx, rz, H, seed) => {
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const top = H * (k + 1) / tiers * (0.94 + r_() * 0.1), f = 1.6 - 0.2 * k, sx = (r_() - 0.5) * 3.5;
      crag('cliff', mul(M, tr(x + sx, top, zz - k * 2.8)), rx * f, rz * f, top + root, { spread: 1.12, seed: seed + k * 5, jit: 0.3, rough: 0.13, seg: 18, rows: 6, cap: true, noao: true });
    }
  };
  for (let i = 0; i < 6; i++) massif(-W / 2 - 4 + i * (W + 14) / 5, -Dp / 2 - 6 - r_() * 3, 8 + r_() * 2.5, 6 + r_() * 2, 46 + r_() * 22, 20 + i * 3);
  for (let i = 0; i < 3; i++) massif(W / 2 + 6 + i * 6.5, -Dp / 2 + 1 - i * 4, 7, 7, 36 + i * 9, 50 + i * 4);
  return end('Santuario di Santa Rosalia');
}
export const SANTUARIO = { name: 'Santuario di Santa Rosalia', x: -825, z: -5780, radius: 60, skipIds: [FP.santuario.id], build: buildSantuario };
