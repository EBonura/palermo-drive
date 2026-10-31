// City landmarks, group C: Mondello (Antico Stabilimento Balneare, entrance gate, beach front), Palazzina Cinese, the Gymnasium of the Orto Botanico,
// Villa Giulia's gate, Teatro Garibaldi, the Ucciardone walls, the Fiera del Mediterraneo gate, Villa Igiea, two Liberty villini, the Stazione Marittima.
import {
  THREE, PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, archBay, prism, pyramid, gable, shell,
  mul, tr, rotY, frame, pairsOf, obb, facing, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  statue, palm, crenel, rail, balus,
} from './lmc-kit.js';
import { FP, LINES } from './landmarks-city-data.js';

const skirt = (key, M, w, d, lo, o = {}) => bx(key, M, -w / 2, w / 2, lo, 0.02, -d / 2, d / 2, o);
const ang = (nx, nz) => Math.atan2(nx, nz);

// ====================================================================================================
// Mondello: Antico Stabilimento Balneare, the Liberty pavilion on piles with its wings and the boardwalk out from the beach
// ====================================================================================================
function buildStabilimento() {
  initShared();
  const pts = pairsOf(FP.mondelloStab.p), ob = obb(pts), fr = facing(ob, -1, 0.35);
  const deck = 1.9, M = frame(ob.cx, 0, ob.cz, fr.nx, fr.nz);   // +z towards the beach, x along the coast, y = 0 at the sea surface
  begin(0);
  defMat('mnYellow', 256, 256, [8, 8], (g, w, h) => paintFacade(g, w, h, 8, 8, { base: '#f0dc8c', trim: '#fff8e0', glass: '#6a2c2c', seed: 801, plinth: { h: 0.6, c: '#e7cf7c' }, grime: 0,
    bands: [{ y: 4.0, h: 0.3, c: '#fff4cf' }, { y: 7.6, h: 0.4, c: '#fff4cf' }], rows: [{ y0: 0.9, y1: 3.4, xs: [2, 6], w: 1.2, kind: 'arch', fr: 0.22, sill: false }, { y0: 4.8, y1: 7.1, xs: [2, 6], w: 1.1, kind: 'arch', fr: 0.2, sill: false }] }));
  defMat('mnStripe', 128, 64, [5, 2.5], (g, w, h) => { g.fillStyle = '#f5efe2'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8283a'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 8, h); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 5, w, 5); });
  defMat('mnShed', 256, 128, [14, 5], (g, w, h) => paintFacade(g, w, h, 14, 5, { base: '#efe0a0', trim: '#fff4cf', glass: '#3a2a26', seed: 802, grime: 0, rows: [{ y0: 0.8, y1: 3.4, n: 5, m: 1.6, w: 1.5, kind: 'rect', fr: 0.1 }] }));
  defMat('deck', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#9a7d58'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(60,40,20,0.45)'; g.fillRect(0, y, w, 2); } noiseDots(g, w, h, 300, 2, 803, ['rgba(60,40,20,0.2)', 'rgba(220,190,140,0.2)']); });
  defMat('pile', 32, 32, [1, 1], (g, w, h) => { g.fillStyle = '#6a5a44'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(30,25,15,.5)'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1.5); });
  const LEN = 112, DEP = 26;
  bx('deck', M, -LEN / 2, LEN / 2, deck - 0.4, deck, -DEP / 2, DEP / 2, { noao: true });
  for (let x = -LEN / 2 + 1; x <= LEN / 2; x += 5) for (const z of [-DEP / 2 + 0.6, DEP / 2 - 0.6]) cyl('pile', 0.28, 0.3, deck + 3.4, 5, { M: mul(M, tr(x, -3.4, z)), noao: true });
  // central pavilion: two storeys, balustraded roof, two corner towers with caps
  const CW = 28, CD = 20, CH = 8.2;
  bx('mnYellow', M, -CW / 2, CW / 2, deck, deck + CH, -CD / 2 - 2, CD / 2 - 2);
  bx('flat', M, -CW / 2 - 0.4, CW / 2 + 0.4, deck + CH, deck + CH + 0.6, -CD / 2 - 2.4, CD / 2 - 1.6, { c: '#fff4cf' });
  for (let q = 0; q < 4; q++) balus(mul(M, mul(tr(0, deck + CH + 0.6, -2), mul(rotY(q * PI / 2), tr(0, 0, (q % 2 ? CW : CD) / 2 + 0.2)))), q % 2 ? CD : CW, 1.0);
  for (const sg of [-1, 1]) {
    const Mt = mul(M, tr(sg * (CW / 2 - 1.6), deck, CD / 2 - 4));
    bx('mnYellow', Mt, -1.8, 1.8, 0, CH + 5.6, -1.8, 1.8); bx('flat', Mt, -2.2, 2.2, CH + 5.6, CH + 6.2, -2.2, 2.2, { c: '#fff4cf' });
    pyramid('tile', 3.8, 3.8, 2.4, { M: mul(Mt, tr(0, CH + 6.2, 0)), c: '#d8c07a' }); sphere('flat', 0.35, { M: mul(Mt, tr(0, CH + 8.7, 0)), c: '#e8d9a0', seg: 6 });
  }
  box('dark', 4, 4.2, 0.2, { M: mul(M, tr(0, deck, CD / 2 - 1.9)), noao: true, c: '#4a2a22' });
  // wings: low sheds with a red and white striped fascia and a sun deck on the roof
  for (const sg of [-1, 1]) {
    const x0 = sg * (CW / 2 + 0.6), x1 = sg * (LEN / 2 - 3), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    bx('mnShed', M, lo, hi, deck, deck + 4.6, -2.0, 8.0);
    bx('mnStripe', M, lo, hi, deck + 3.4, deck + 4.6, 8.01, 8.4);
    bx('flat', M, lo - 0.3, hi + 0.3, deck + 4.6, deck + 5.0, -2.3, 8.3, { c: '#efe3b8' });
    rail(mul(M, tr((lo + hi) / 2, deck + 5.0, 8.2)), hi - lo, 1.1, { c: '#ffffff' });
  }
  // boardwalk to the beach gate
  const gx = -3043, gz = -9598, sx = ob.cx + fr.nx * (CD / 2 + 1), sz = ob.cz + fr.nz * (CD / 2 + 1), dl = Math.hypot(gx - sx, gz - sz), gnx = (gx - sx) / dl, gnz = (gz - sz) / dl;
  const MG = frame(sx, 0, sz, gnx, gnz);
  bx('deck', MG, -2.4, 2.4, deck - 0.3, deck, 0, dl, { noao: true });
  for (let z = 0; z < dl; z += 7) for (const x of [-2.2, 2.2]) cyl('pile', 0.25, 0.28, deck + 3.4, 5, { M: mul(MG, tr(x, -3.4, z)), noao: true });
  for (const sg of [-1, 1]) { const Mr = mul(MG, mul(tr(sg * 2.4, deck, dl / 2), rotY(PI / 2))); rail(Mr, dl, 1.1, { c: '#c9c9c0' }); }
  return end('Antico Stabilimento Balneare');
}
export const STABILIMENTO = { name: 'Antico Stabilimento Balneare di Mondello', x: -2990, z: -9604, radius: 100, skipIds: [FP.mondelloStab.id], build: buildStabilimento };

// the Liberty entrance gate on the beach: two slender towers joined by a curved colonnade
function buildMondelloGate() {
  initShared();
  const gx = -3043, gz = -9598, nx = 0.9996, nz = -0.03;   // faces the sea (east)
  const gy = Math.max(groundY(gx, gz), 0.6), M = frame(gx, gy, gz, nx, nz);
  begin(gy);
  defMat('mnTower', 128, 256, [3.2, 9], (g, w, h) => { paintFacade(g, w, h, 3.2, 9, { base: '#f2e6b4', trim: '#fff8e0', glass: '#3a2a26', seed: 811, grime: 0, bands: [{ y: 6.6, h: 0.5, c: '#fff4cf' }, { y: 8.6, h: 0.3, c: '#d9c88a' }], rows: [{ y0: 4.0, y1: 6.0, xs: [1.6], w: 0.9, kind: 'rect', fr: 0.1 }] }); g.fillStyle = '#2a2a2a'; for (let q = 0; q < 6; q++) g.fillRect(0, 150 + q * 8, w, 4); });
  for (const sg of [-1, 1]) {
    const Mt = mul(M, tr(0, 0, sg * 11));
    bx('mnTower', Mt, -1.6, 1.6, 0, 9.0, -1.6, 1.6);
    bx('flat', Mt, -2.0, 2.0, 9.0, 9.4, -2.0, 2.0, { c: '#fff4cf' });
    lathe('flat', [[1.6, 0], [2.0, 0.8], [1.2, 1.8], [0.5, 2.8], [0.01, 3.3]], 10, { M: mul(Mt, tr(0, 9.4, 0)), c: '#f4ecc4', noao: true });
    sphere('flat', 0.25, { M: mul(Mt, tr(0, 12.8, 0)), c: '#c9a24a', seg: 5 });
  }
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const a = -PI * 0.42 + i * PI * 0.84 / N, zc = Math.sin(a) * 8.0 * (11 / 8) * 0.9, xc = -(1 - Math.cos(a)) * 3.5 * 1.0;
    cyl('marble', 0.28, 0.32, 4.4, 8, { M: mul(M, tr(xc, 0, zc)), c: '#f4ecc4' });
    bx('flat', mul(M, tr(xc, 0, zc)), -0.5, 0.5, 4.4, 4.9, -0.5, 0.5, { c: '#fff4cf' });
  }
  for (let i = 0; i < N; i++) {
    const a0 = -PI * 0.42 + i * PI * 0.84 / N, a1 = a0 + PI * 0.84 / N, z0 = Math.sin(a0) * 8 * 11 / 8 * 0.9, z1 = Math.sin(a1) * 8 * 11 / 8 * 0.9, x0 = -(1 - Math.cos(a0)) * 3.5, x1 = -(1 - Math.cos(a1)) * 3.5;
    const l = Math.hypot(z1 - z0, x1 - x0), a = Math.atan2(z1 - z0, x1 - x0);
    bx('flat', mul(M, mul(tr((x0 + x1) / 2, 4.9, (z0 + z1) / 2), rotY(-a + PI / 2))), -l / 2, l / 2, 0, 0.5, -0.45, 0.45, { c: '#fff4cf' });
    balus(mul(M, mul(tr((x0 + x1) / 2, 5.4, (z0 + z1) / 2), rotY(-a + PI / 2 + PI / 2 * 0))), l, 0.9, { ry: 0 });
  }
  return end('Mondello gate');
}
export const MONDELLO_GATE = { name: 'Mondello beach gate', x: -3043, z: -9598, radius: 40, skipIds: ['w370274804'], build: buildMondelloGate };

// the beach itself: rows of umbrellas and sunbeds along the waterline, lifeguard stands
function buildMondelloBeach() {
  initShared();
  const rn = RNG(821), wl = (z) => { for (let x = -3200; x < -2900; x += 2) if (groundY(x, z) < 0.3) return x; return -3000; };
  begin(0);
  const cols = ['#e8473b', '#2f6fb5', '#f2c230', '#f2f0e6', '#3d9a6a', '#e87fa0', '#f08a2a'];
  defMat('stilt', 0, 0, [1, 1], null, {});
  let n = 0;
  for (let z = -9790; z <= -9440; z += 5.5) {
    const xw = wl(z);
    for (let row = 0; row < 3; row++) {
      if (rn() < 0.22) continue;
      const x = xw - 11 - row * 7.5 + (rn() - 0.5) * 1.6, zz = z + (rn() - 0.5) * 1.5, y = groundY(x, zz);
      if (y < 0.5 || Math.hypot(x + 3043, zz + 9598) < 22 || (zz > -9610 && zz < -9594 && x > -3045)) continue;
      const c = cols[(rn() * cols.length) | 0];
      cyl('flat', 0.04, 0.04, 2.2, 4, { p: [x, y, zz], c: '#cfcfcf', noao: true });
      cone('flat', 1.3, 0.55, 8, { p: [x, y + 2.05, zz], c, noao: true });
      const ry = rn() * PI; for (const dx of [-0.8, 0.8]) bx('marble', tr(x, y, zz), dx - 0.3, dx + 0.3, 0.05, 0.35, -0.9, 0.9, { c: rn() < 0.5 ? '#f2f0e6' : '#8cb6d8', noao: true });
      n++;
    }
  }
  for (const z of [-9740, -9660, -9560]) {
    const x = wl(z) - 16, y = groundY(x, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl('trunk', 0.1, 0.12, 2.6, 4, { p: [x + dx, y, z + dz], noao: true });
    bx('marble', tr(x, y, z), -1.5, 1.5, 2.6, 4.0, -1.5, 1.5, { c: '#f0e8d8' }); pyramid('tile', 3.6, 3.6, 0.9, { p: [x, y + 4.0, z], c: '#c8584a' });
    bx('flat', tr(x, y, z), -1.4, 1.4, 2.0, 2.6, -1.4, 1.4, { c: '#c8584a' });
  }
  ensureTrunk();
  return end('Mondello beach');
}
export const MONDELLO_BEACH = { name: 'Mondello beach front', x: -3060, z: -9640, radius: 180, skipIds: [], build: () => { ensureTrunk(); return buildMondelloBeach(); } };

// ====================================================================================================
// Palazzina Cinese in the Real Parco della Favorita
// ====================================================================================================
function buildCinese() {
  initShared();
  const pts = pairsOf(FP.cinese.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.1, 1);
  const gy = gr.hi + 0.1, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = Math.min(fr.w, 19), Dp = Math.min(fr.d, 15.5), PH = 4.2, H = 15.0;
  defMat('cnWall', 256, 256, [8, 10.8], (g, w, h) => paintFacade(g, w, h, 8, 10.8, { base: '#e2845a', trim: '#f4d9b0', glass: '#243a2c', seed: 831, grime: 0,
    bands: [{ y: 5.3, h: 0.35, c: '#f0c79a' }, { y: 10.4, h: 0.4, c: '#f0c79a' }], rows: [{ y0: 0.8, y1: 4.2, xs: [2, 6], w: 1.2, kind: 'rect', shut: 'open', balc: true }, { y0: 6.2, y1: 9.7, xs: [2, 6], w: 1.2, kind: 'rect', shut: 'open', balc: true }], shut: '#3d6a4a' }));
  defMat('cnBase', 256, 128, [10, 4.2], (g, w, h) => { paintAshlar(g, w, h, 10, 4.2, 0.6, 1.3, '#b9aab6', '#8a7c88', 832, 2, 0.06); g.fillStyle = '#a05a4a'; for (const cx of [1.5, 4.0, 6.5, 9.0]) { g.beginPath(); g.moveTo((cx - 0.7) * 25.6, h); g.lineTo((cx - 0.7) * 25.6, 56); g.arc(cx * 25.6, 56, 0.7 * 25.6, Math.PI, 0); g.lineTo((cx + 0.7) * 25.6, h); g.fill(); } });
  skirt('stone', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 2.5, { c: '#b9aab6' });
  bx('cnBase', M, -W / 2, W / 2, 0, PH, -Dp / 2, Dp / 2);
  bx('cnWall', M, -W / 2 + 0.6, W / 2 - 0.6, PH, H, -Dp / 2 + 0.6, Dp / 2 - 1.4);
  bx('flat', M, -W / 2 - 0.3, W / 2 + 0.3, PH - 0.3, PH + 0.3, -Dp / 2 - 0.3, Dp / 2 + 0.3, { c: '#d9c1ae' });
  bx('flat', M, -W / 2 - 0.2, W / 2 + 0.2, H, H + 0.4, -Dp / 2 - 0.2, Dp / 2 + 0.2, { c: '#e9b890' });
  for (let q = 0; q < 4; q++) rail(mul(M, mul(tr(0, H + 0.4, 0), mul(rotY(q * PI / 2), tr(0, 0, (q % 2 ? W : Dp) / 2)))), q % 2 ? Dp : W, 1.1, { c: '#e6c9a0' });
  // the pagoda pavilion on the roof and the corner finials
  const MR = mul(M, tr(0, H + 0.4, -1));
  bx('cnWall', MR, -4.5, 4.5, 0, 3.4, -3.5, 3.5);
  pyramid('flat', 11, 9, 3.4, { M: mul(MR, tr(0, 3.4, 0)), c: '#d9b24a' });
  cyl('flat', 0.12, 0.16, 2.0, 6, { M: mul(MR, tr(0, 6.8, 0)), c: '#2a2a2a' }); sphere('flat', 0.4, { M: mul(MR, tr(0, 8.7, 0)), c: '#d9b24a', seg: 6 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cone('flat', 0.35, 2.2, 6, { M: mul(M, tr(x * (W / 2 - 0.3), H + 0.4, z * (Dp / 2 - 0.3))), c: '#d9b24a' }); }
  // the semicircular portico on the front: slender columns and a ribbed pagoda roof
  const MQ = mul(M, tr(0, 0, Dp / 2 - 1.4)), RP = 4.4;
  cyl('flat', RP + 0.3, RP + 0.4, 0.5, 14, { M: MQ, c: '#c9bcc4', t0: -PI / 2, tl: PI, open: false });
  for (let i = 0; i <= 6; i++) { const a = -PI / 2 + i * PI / 6; cyl('marble', 0.22, 0.25, 5.8, 8, { M: mul(MQ, tr(Math.sin(a) * RP, 0.5, Math.cos(a) * RP)), c: '#efe0c4' }); }
  lathe('flat', [[RP + 0.9, 0], [RP + 0.3, 0.5], [RP - 0.3, 1.0], [RP * 0.4, 2.4], [0.01, 3.0]], 12, { M: mul(MQ, tr(0, 6.3, 0)), t0: -PI / 2, tl: PI, c: '#e0884e', noao: true });
  for (let i = 0; i < 4; i++) bx('flat', mul(M, tr(-W / 2 + 3 + i * (W - 6) / 3, 0, 0)), -0.5, 0.5, PH + 0.3, PH + 5.6, Dp / 2 - 0.6, Dp / 2 - 0.1, { c: '#e0884e', noao: true });
  // steps and the two chevron-patterned gate pillars out in front
  for (let i = 0; i < 4; i++) bx('stone', MQ, -3 - i * 0.4, 3 + i * 0.4, 0, 0.42 - i * 0.1, RP + 0.1 + i * 0.5, RP + 0.7 + i * 0.5, { c: '#c9bcc4' });
  for (const sg of [-1, 1]) { const Mp = mul(M, tr(sg * 6.4, 0, Dp / 2 + 11)); cyl('flat', 0.9, 1.0, 5.6, 10, { M: Mp, c: '#e8b98a' }); cyl('flat', 1.1, 1.1, 0.4, 10, { M: mul(Mp, tr(0, 5.6, 0)), c: '#d9c1ae' }); sphere('flat', 0.55, { M: mul(Mp, tr(0, 6.4, 0)), c: '#f2e6b0', seg: 6, noao: true }); }
  return end('Palazzina Cinese');
}
export const CINESE = { name: 'Palazzina Cinese', x: -2707, z: -5644, radius: 50, skipIds: [FP.cinese.id], build: buildCinese };

// ====================================================================================================
// Orto Botanico: the Gymnasium (Doric portico, sphinxes, low red dome) and Villa Giulia's entrance gate
// ====================================================================================================
function buildGymnasium() {
  initShared();
  const pts = pairsOf(FP.gymnasium.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.48, 0.88);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = Math.min(fr.w, 23.5), Dp = Math.min(fr.d, 23), H = 11.8;
  defMat('gymWall', 256, 256, [6, 6], (g, w, h) => { paintAshlar(g, w, h, 6, 6, 0.5, 1.2, '#e6bf86', '#b8935c', 841, 2, 0.05); }, {});
  defMat('gymFront', 256, 128, [9, 5], (g, w, h) => { g.fillStyle = '#7e2f2c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 842, ['rgba(255,255,255,0.05)']); g.fillStyle = '#2b1a14'; g.fillRect(100, 40, 56, 88); g.fillStyle = '#d6b078'; g.fillRect(96, 34, 64, 6); });
  skirt('stone', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 2.5, { c: '#c2a67a' });
  bx('gymWall', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.1);
  // entablature with a triglyph frieze round the building
  bx('flat', M, -W / 2 - 0.4, W / 2 + 0.4, H - 1.8, H, -Dp / 2 - 0.4, Dp / 2 + 0.4, { c: '#e9c996' });
  bx('flat', M, -W / 2 - 0.9, W / 2 + 0.9, H, H + 0.6, -Dp / 2 - 0.9, Dp / 2 + 0.9, { c: '#f0d8aa' });
  for (let q = 0; q < 4; q++) for (let i = 0; i < Math.floor((q % 2 ? Dp : W) / 1.6); i++) bx('flat', mul(M, mul(rotY(q * PI / 2), tr(-(q % 2 ? Dp : W) / 2 + 0.8 + i * 1.6, 0, (q % 2 ? W : Dp) / 2 + 0.41))), 0, 0.5, H - 1.5, H - 0.3, 0, 0.12, { c: '#b8935c', noao: true });
  // portico of four Doric columns, a few steps and two sphinxes
  const PD = 4.2, MP = mul(M, tr(0, 0, Dp / 2));
  bx('gymFront', MP, -W / 2 + 4.5, W / 2 - 4.5, 0.4, H - 1.8, -0.02, 0.05, { noao: true });
  bx('flat', MP, -W / 2 + 3.4, W / 2 - 3.4, H - 1.8, H, 0, PD + 0.4, { c: '#e9c996' }); bx('flat', MP, -W / 2 + 3.0, W / 2 - 3.0, H, H + 0.6, -0.2, PD + 0.8, { c: '#f0d8aa' });
  for (let i = 0; i < 4; i++) { const x = -W / 2 + 4.6 + i * (W - 9.2) / 3; cyl('gymWall', 0.62, 0.78, H - 2.4, 12, { M: mul(MP, tr(x, 0.5, PD)), c: '#f0cf9a' }); bx('flat', mul(MP, tr(x, 0, PD)), -0.95, 0.95, 0.0, 0.5, -0.95, 0.95, { c: '#e9c996' }); bx('flat', mul(MP, tr(x, 0, PD)), -1.0, 1.0, H - 1.9, H - 1.8, -1.0, 1.0, { c: '#f0d8aa' }); }
  for (let i = 0; i < 5; i++) bx('stone', MP, -W * 0.3 - i * 0.2, W * 0.3 + i * 0.2, 0, 0.5 - i * 0.1, PD + 0.6 + i * 0.4, PD + 1.0 + i * 0.4 + 0.2, { c: '#cbbf9f' });
  for (const sg of [-1, 1]) { const Ms = mul(MP, tr(sg * (W * 0.3 + 1.4), 0, PD + 3.2)); bx('stone', Ms, -0.9, 0.9, 0, 1.2, -1.2, 1.2, { c: '#d8cdb2' }); bx('marble', Ms, -0.45, 0.45, 1.2, 2.1, 0.0, 1.5, { c: '#b8c0c8' }); bx('marble', Ms, -0.5, 0.5, 1.2, 1.8, -1.6, 0.4, { c: '#b8c0c8' }); }
  // the low red dome with its drum behind the portico
  cyl('gymWall', 4.6, 4.8, 1.4, 14, { M: mul(M, tr(0, H + 0.6, -1)), c: '#f0d8aa' });
  lathe('red', [[4.8, 0], [4.5, 0.5], [3.6, 1.5], [2.0, 2.4], [0.01, 2.9]], 14, { M: mul(M, tr(0, H + 2.0, -1)), noao: true });
  return end('Gymnasium, Orto Botanico');
}
export const GYMNASIUM = { name: 'Gymnasium, Orto Botanico', x: 1053, z: 248, radius: 50, skipIds: [FP.gymnasium.id], build: buildGymnasium };

function buildVillaGiuliaGate() {
  initShared();
  const x = 1203, z = 150, nx = -0.5, nz = -0.866, y = groundY(x, z), M = frame(x, y, z, nx, nz);
  begin(y);
  defMat('vgStone', 128, 128, [2.4, 2.4], (g, w, h) => paintAshlar(g, w, h, 2.4, 2.4, 0.4, 0.9, '#ddd0b0', '#a99c7c', 851, 1.5, 0.05));
  for (const sg of [-1, 1]) {
    for (const [px, ph, pw] of [[3.4, 6.2, 2.0], [7.2, 4.0, 1.5]]) {
      const Mp = mul(M, tr(sg * px, 0, 0));
      bx('vgStone', Mp, -pw / 2, pw / 2, 0, ph, -pw / 2, pw / 2); bx('flat', Mp, -pw / 2 - 0.2, pw / 2 + 0.2, ph, ph + 0.3, -pw / 2 - 0.2, pw / 2 + 0.2, { c: '#efe6cc' });
      pyramid('vgStone', pw, pw, pw * 0.8, { M: mul(Mp, tr(0, ph + 0.3, 0)) });
    }
    bx('vgStone', M, sg > 0 ? 8.0 : -24, sg > 0 ? 24 : -8.0, 0, 1.0, -0.4, 0.4); rail(mul(M, tr(sg * 16, 1.0, 0)), 16, 1.6, { c: '#ffffff' });
  }
  rail(mul(M, tr(0, 0, 0)), 5.2, 3.6, { c: '#ffffff' }); bx('vgStone', M, -2.6, 2.6, 4.2, 4.8, -0.4, 0.4);
  return end("Villa Giulia gate");
}
export const VILLA_GIULIA_GATE = { name: 'Villa Giulia gate', x: 1203, z: 150, radius: 40, skipIds: [], build: buildVillaGiuliaGate };

// ====================================================================================================
// Teatro Garibaldi (street front on the old footprint)
// ====================================================================================================
function buildTeatroGaribaldi() {
  initShared();
  const pts = pairsOf(FP.garibaldiTheatre.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.89, -0.45);
  const gy = gr.hi + 0.1, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = fr.w, Dp = fr.d, H = 19.0;
  defMat('tgFront', 256, 512, [W, H], (g, w, h) => paintFacade(g, w, h, W, H, { base: '#e1c79a', trim: '#f2e8d0', glass: '#2c2a2a', seed: 861, plinth: { h: 1.2, c: '#b8a07c' }, pil: { xs: [0.6, W - 0.6, W / 2 - 3.2, W / 2 + 3.2], w: 0.9, c: '#efe2c4' },
    bands: [{ y: 6.4, h: 0.4, c: '#f2e8d0' }, { y: 12.6, h: 0.4, c: '#f2e8d0' }, { y: 17.8, h: 0.8, c: '#f2e8d0' }],
    rows: [{ y0: 1.8, y1: 5.2, xs: [W * 0.2, W * 0.8], w: 1.4, kind: 'arch', fr: 0.2 }, { y0: 1.4, y1: 5.6, xs: [W / 2], w: 2.6, kind: 'door', glass: '#241c18' }, { y0: 7.4, y1: 11.4, xs: [W * 0.2, W / 2, W * 0.8], w: 1.4, kind: 'rect', ped: true, balc: true }, { y0: 13.4, y1: 16.6, xs: [W * 0.2, W / 2, W * 0.8], w: 1.3, kind: 'arch' }] }));
  skirt('stone', M, W + 1, Dp + 1, -(gr.hi - gr.lo) - 2, { c: '#a89c88' });
  bx('plaster', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.02);
  panel('tgFront', W, H, { M: mul(M, tr(0, 0, Dp / 2 + 0.01)) });
  bx('flat', M, -W / 2 - 0.3, W / 2 + 0.3, H, H + 0.7, -Dp / 2, Dp / 2 + 0.5, { c: '#efe3c8' });
  const sh = new THREE.Shape(); sh.moveTo(-W * 0.2, 0); sh.lineTo(W * 0.2, 0); sh.lineTo(0, 2.2); sh.lineTo(-W * 0.2, 0);
  { const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }); part2('flat', g, mul(M, tr(0, H + 0.7, Dp / 2 - 0.4)), '#efe3c8'); }
  return end('Teatro Garibaldi');
}
function part2(key, g, M, c) { part(key, g, { M, c }); }
export const TEATRO_GARIBALDI = { name: 'Teatro Garibaldi', x: 669, z: 175, radius: 40, skipIds: [FP.garibaldiTheatre.id], build: buildTeatroGaribaldi };

// ====================================================================================================
// Ucciardone: the prison's perimeter wall with corner bastions, round watch towers and a gate
// ====================================================================================================
function buildUcciardone() {
  initShared();
  const P = LINES.ucciardone, n = P.length - 1;   // closed: last point repeats the first
  begin(0);
  defMat('uccWall', 256, 256, [6, 8], (g, w, h) => { paintAshlar(g, w, h, 6, 8, 0.55, 1.4, '#c3b08a', '#8c7a58', 871, 2, 0.08); streaks(g, w, h, 40, 872, 0.22, 140); }, {});
  const H = 9.5;
  for (let i = 0; i < n; i++) {
    const A = P[i], B = P[i + 1], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 0.8) continue;
    const gA = groundY(A[0], A[1]), gB = groundY(B[0], B[1]), lo = Math.min(gA, gB) - 1.2, hi = Math.max(gA, gB);
    const Mw = frame((A[0] + B[0]) / 2, 0, (A[1] + B[1]) / 2, -dz / l, dx / l);
    bx('uccWall', Mw, -l / 2 - 0.4, l / 2 + 0.4, lo, hi + H, -0.85, 0.85);
    bx('flat', Mw, -l / 2 - 0.4, l / 2 + 0.4, hi + H, hi + H + 0.5, -1.15, 1.15, { c: '#d6c7a2' });
  }
  const towers = [];
  for (let i = 0; i < n; i++) {
    const A = P[i], B = P[i + 1], C = P[(i + 2) % (n + 1)], ux = B[0] - A[0], uz = B[1] - A[1], vx = C[0] - B[0], vz = C[1] - B[1];
    const turn = Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz));
    if (turn < 0.5 && (i % 4)) continue;
    if (towers.some(t => Math.hypot(t[0] - B[0], t[1] - B[1]) < (turn > 0.9 ? 18 : 60))) continue;
    towers.push(B);
    const gx = groundY(B[0], B[1]), r = turn > 0.9 ? 4.4 : 3.3;
    cyl('uccWall', r, r + 0.3, H + 5.5, 12, { p: [B[0], gx - 1.2, B[1]], c: '#ffffff' });
    cyl('flat', r + 0.5, r + 0.5, 0.6, 12, { p: [B[0], gx + H + 4.3, B[1]], c: '#d6c7a2' });
    cone('tile', r + 0.9, 3.4, 12, { p: [B[0], gx + H + 4.9, B[1]], c: '#b68a6a' });
    box('dark', 0.9, 1.4, 0.2, { p: [B[0], gx + H + 1.0, B[1] + r + 0.02], noao: true });
  }
  return end('Ucciardone walls');
}
export const UCCIARDONE = { name: 'Ucciardone walls', x: -300, z: -1900, radius: 250, skipIds: [], build: buildUcciardone };

// ====================================================================================================
// Fiera del Mediterraneo gate
// ====================================================================================================
function buildFieraGate() {
  initShared();
  const x = -352, z = -3047, nx = -0.2, nz = -0.98, y = groundY(x, z), M = frame(x, y, z, nx, nz);
  begin(y);
  defMat('fiConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#d9d6cc'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 881, ['rgba(60,60,55,0.1)', 'rgba(255,255,250,0.15)']); g.fillStyle = 'rgba(80,80,80,0.2)'; g.fillRect(0, 60, w, 2); });
  for (const sg of [-1, 1]) {
    const Mp = mul(M, tr(sg * 7, 0, 0));
    bx('fiConc', Mp, -1.6, 1.6, 0, 12.5, -1.2, 1.2); bx('fiConc', Mp, -2.1, 2.1, 12.5, 13.1, -1.6, 1.6);
    bx('dark', Mp, -0.9, 0.9, 2.5, 9.5, 1.21, 1.25, { noao: true, c: '#3d6a86' });
    for (const dx of [-3.4, 3.4]) { const Mf = mul(Mp, tr(sg * dx * 0 + dx * 1.0, 0, 0.4)); cyl('stSteelP', 0.1, 0.14, 15, 6, { M: Mf, c: '#d0d0d0' }); box('flat', 2.0, 1.2, 0.04, { M: mul(Mf, tr(1.1, 12.8, 0)), c: dx > 0 ? '#2a6a3a' : '#c8302a', noao: true }); }
  }
  bx('fiConc', M, -8.8, 8.8, 9.5, 10.6, -1.0, 1.0);
  for (const sg of [-1, 1]) bx('fiConc', M, sg > 0 ? 12 : -17, sg > 0 ? 17 : -12, 0, 3.2, -2, 3);   // ticket booths
  return end('Fiera del Mediterraneo gate');
}
export const FIERA_GATE = { name: 'Fiera del Mediterraneo gate', x: -352, z: -3047, radius: 40, skipIds: [], build: () => { defMat('stSteelP', 0, 0, [1, 1], null, {}); return buildFieraGate(); } };

// ====================================================================================================
// Villa Igiea, Villino Florio, Villino Ida: Liberty (Basile) villas as shells with their own facade textures
// ====================================================================================================
function buildIgiea() {
  initShared();
  const p = FP.igiea, pts = pairsOf(p.p), gr = groundRange(pts), gy = gr.hi + 0.1, H = 15.7;
  begin(gy);
  defMat('igWall', 256, 256, [8, 15.7], (g, w, h) => paintFacade(g, w, h, 8, 15.7, { base: '#e9cfa6', trim: '#fbf1da', glass: '#2c2a2a', seed: 891, plinth: { h: 1.0, c: '#c8ad84' }, grime: 0,
    bands: [{ y: 5.2, h: 0.35, c: '#f6e6c6' }, { y: 10.4, h: 0.35, c: '#f6e6c6' }], rows: [{ y0: 1.5, y1: 4.5, xs: [2, 6], w: 1.3, kind: 'arch', fr: 0.2, sill: false }, { y0: 6.2, y1: 9.6, xs: [2, 6], w: 1.2, kind: 'rect', shut: 'open', balc: true }, { y0: 11.5, y1: 14.2, xs: [2, 6], w: 1.1, kind: 'rect', shut: 'open' }], shut: '#5a7a5a' }));
  shell('igWall', pts, [], gy, H, { lo: gr.lo - 2, roof: '#b9705a', cc: '#f0dcb8' });
  const o = obb(pts); const T = frame(o.cx + o.ux * 30, gy + H, o.cz + o.uz * 30, o.vx, o.vz);
  bx('igWall', T, -3.4, 3.4, 0, 9, -3.4, 3.4); bx('flat', T, -3.8, 3.8, 9, 9.5, -3.8, 3.8, { c: '#f0dcb8' }); pyramid('tile', 8, 8, 4.0, { M: mul(T, tr(0, 9.5, 0)), c: '#c8705a' });
  return end('Villa Igiea');
}
export const IGIEA = { name: 'Villa Igiea', x: 786, z: -3282, radius: 90, skipIds: [FP.igiea.id], build: buildIgiea };

function villino(name, fpk, wallSeed, base, trim, roofC, tower, H) {
  return () => {
    initShared();
    const pts = pairsOf(FP[fpk].p), gr = groundRange(pts), gy = gr.hi + 0.1;
    begin(gy);
    defMat('vl' + fpk, 256, 256, [6, H], (g, w, h) => paintFacade(g, w, h, 6, H, { base, trim, glass: '#2a2828', seed: wallSeed, grime: 0, plinth: { h: 0.9, c: '#b8a88a' },
      bands: [{ y: 4.6, h: 0.3, c: trim }, { y: 9.2, h: 0.3, c: trim }], rows: [{ y0: 1.4, y1: 3.8, xs: [1.5, 4.5], w: 1.1, kind: 'arch', fr: 0.2 }, { y0: 5.5, y1: 8.4, xs: [1.5, 4.5], w: 1.1, kind: 'rect', ped: true, balc: true, shut: 'open' }, { y0: 10.0, y1: Math.min(H - 1.0, 12.6), xs: [1.5, 4.5], w: 1.0, kind: 'rect' }], shut: '#5a6a4a' }));
    shell('vl' + fpk, pts, [], gy, H, { lo: gr.lo - 2, roof: roofC, cc: trim });
    const o = obb(pts), M = frame(o.cx + o.ux * (o.w / 2 - 2.2), gy + H, o.cz + o.uz * (o.w / 2 - 2.2), o.vx, o.vz);
    if (tower) { cyl('vl' + fpk, 2.2, 2.4, 6.0, 10, { M: mul(M, tr(0, -0.2, 0)) }); cone('tile', 3.0, 4.6, 10, { M: mul(M, tr(0, 5.8, 0)), c: roofC }); sphere('flat', 0.3, { M: mul(M, tr(0, 10.4, 0)), c: '#2a2a2a', seg: 5 }); }
    return end(name);
  };
}
export const FLORIO = { name: 'Villino Florio', x: -1542, z: -433, radius: 40, skipIds: [FP.florio.id], build: villino('Villino Florio', 'florio', 901, '#d8b78a', '#f1e4c8', '#8f6a58', true, 14.6) };
export const IDA = { name: 'Villino Ida', x: -913, z: -1292, radius: 40, skipIds: [FP.ida.id], build: villino('Villino Ida', 'ida', 902, '#e5c9a0', '#f6ecd4', '#9a6a52', false, 14.6) };

// ====================================================================================================
// Stazione Marittima (the port passenger terminal): long pale block with ribbon windows, a clock tower and a canopy on the quay side
// ====================================================================================================
function buildStazioneMarittima() {
  initShared();
  const pts = pairsOf(FP.stazioneMarittima.p), gr = groundRange(pts), ob = obb(pts), gy = gr.hi + 0.1, H = 16.4;
  begin(gy);
  defMat('smWall', 256, 256, [12, 16.4], (g, w, h) => paintFacade(g, w, h, 12, 16.4, { base: '#ddd5c4', trim: '#f2ede0', glass: '#35505e', seed: 911, grime: 0, plinth: { h: 1.2, c: '#b6ad9a' },
    bands: [{ y: 5.4, h: 0.5, c: '#efe9d8' }, { y: 10.8, h: 0.5, c: '#efe9d8' }, { y: 15.8, h: 0.6, c: '#efe9d8' }], rows: [{ y0: 1.8, y1: 4.6, n: 3, m: 2, w: 2.4, kind: 'arch', fr: 0.2 }, { y0: 6.6, y1: 9.8, n: 3, m: 2, w: 2.0, kind: 'rect', ped: true }, { y0: 11.8, y1: 14.8, n: 3, m: 2, w: 2.0, kind: 'rect' }] }));
  shell('smWall', pts, [], gy, H, { lo: gr.lo - 1.5, roof: '#a39e92', cc: '#eee7d4' });
  const T = frame(ob.cx, gy + H, ob.cz, ob.vx, ob.vz);
  bx('smWall', T, -4.2, 4.2, 0, 10.5, -4.2, 4.2); bx('flat', T, -4.8, 4.8, 10.5, 11.1, -4.8, 4.8, { c: '#eee7d4' }); pyramid('tile', 9, 9, 3.4, { M: mul(T, tr(0, 11.1, 0)), c: '#a9795f' });
  box('marble', 2.2, 2.2, 0.15, { M: mul(T, tr(0, 6.0, 4.3)), c: '#f4f1e6' });
  return end('Stazione Marittima');
}
export const STAZIONE_MARITTIMA = { name: 'Stazione Marittima', x: 441, z: -1250, radius: 70, skipIds: [FP.stazioneMarittima.id], build: buildStazioneMarittima };
