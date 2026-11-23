// City landmarks, batch A: Santa Ninfa dei Crociferi (w86873788), San Matteo al Cassaro (w143740354), Sant'Anna la Misericordia (w49863590), Santa Maria degli Angeli "La Gancia" (w49788642). Registered in src/landmarks-city.js as BATCH_A.
// Each church follows the Gesu / Teatini / Santa Cita pattern: footprint prism clipped at the front, painted front extruded as one shape, nave under a gable roof, in a frame F with +z out of the front and local x to the right seen from the street.
// The front of each church is the footprint edge that faces the street (checked against the roads and the photos): Ninfa the 25.6 m edge on Via Maqueda, Matteo the 18.8 m north end, Anna the 26.4 m south end onto Piazza Sant'Anna, Gancia the 22.5 m west end onto Vicolo della Gancia.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions and colours were read):
// Ninfa: Palermo, Santa Ninfa ai Crociferi - facciata.JPG; Santa Ninfa dei Crociferi, Palermo.jpg. Read: weathered honey-brown stone front, lower order with three doors (the outer two with small triangular pediments, the middle with a flat lintel), a relief panel over each (a round medallion in the middle),
//   paired pilasters between the doors, heavy corner piers and a deep cornice; a narrower upper order with one tall window under a curved pediment, paired pilasters, a scroll with leaves each side, a triangular pediment, obelisk finials on the lower cornice.
// Matteo: Chiesa di San Matteo al Cassaro (Palermo) - Facciata1.JPG; Facciata2.JPG. Read: grey-cream stone, lower order with a window, a middle portal with a statue niche over it and a pedimented side door, upper order with a statue niche each side, a round oculus in a frame,
//   spiral volutes and a cartouche, and a white stucco bell gable with three arched openings, scrolls and a cross.
// Anna: Chiesa di Sant'Anna (Palermo) - Facciata.JPG; Chiesa di Sant'Anna, Palermo, Italia - facciata.jpg. Read: dark brown wall with ochre stone, two orders; lower order eight grey marble columns in four pairs, four statue niches, two small side doors, a tall wooden central door with a broken pediment and a Pieta relief over it;
//   upper order four grey columns, a framed window over a balustrade, a cartouche with angels, a segmental cornice, concave scrolled wings down to the outer pedestals with vases, a cross on top.
// Gancia: SMA (Palermo) 15 07 2019 45.jpg. Read: plain sand-yellow ashlar front under a raked gable, one tall pointed portal with stepped archivolts, a large blind lunette over it, one narrow lancet window high up, small putlog holes.
// Not verified: the exact bay positions (photos are taken at an angle, so positions are mirrored symmetric), the roofs and side walls behind the fronts (plain), Gancia's bell tower and cloister (not drawn).
import * as THREE from 'three';
import { PI, bx, cyl, pyramid, box, sphere, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, statue } from './lmc-kit.js';

// ---------- shared helpers ----------
function tb(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const pointed = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r * 1.1)); g.quadraticCurveTo(X(x - r), Y(y1 - r * 0.2), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(y1 - r * 0.2), X(x + r), Y(y1 - r * 1.1)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const ell = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); };
  const vol = (x, y, r, c, d) => { ell(x, y, r, r, c); g.strokeStyle = d; g.lineWidth = Math.max(1, 0.12 * sx); g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const rr = r * (1 - a / 10); g.lineTo(X(x + Math.cos(a) * rr), Y(y + Math.sin(a) * rr)); } g.stroke(); };
  const win = (x, y0, y1, ww, glass, frame) => { R(x - ww / 2 - 0.25, y0 - 0.2, x + ww / 2 + 0.25, y1 + 0.2, frame); R(x - ww / 2, y0, x + ww / 2, y1, glass); for (let y = y0 + 0.5; y < y1; y += 0.55) R(x - ww / 2, y, x + ww / 2, y + 0.05, 'rgba(0,0,0,0.3)'); R(x - 0.04, y0, x + 0.04, y1, 'rgba(0,0,0,0.35)'); };
  return { sx, sy, X, Y, R, arch, pointed, tri, ell, vol, win };
}
function ground(g, w, h, T, seed, ys, col) {   // weathering: stains, shadow under cornices, dark foot
  noiseDots(g, w, h, w * h / 55, 2, seed, ['rgba(120,85,50,0.09)', 'rgba(255,240,210,0.07)', 'rgba(70,50,30,0.07)']);
  for (const y of ys) { const gs = g.createLinearGradient(0, T.Y(y), 0, T.Y(y - 1.7)); gs.addColorStop(0, 'rgba(30,20,10,0.34)'); gs.addColorStop(1, 'rgba(30,20,10,0)'); g.fillStyle = gs; g.fillRect(0, T.Y(y), w, 1.7 * T.sy); }
  streaks(g, w, h, 34, seed + 1, 0.12, 110, col || '50,36,24');
  const gb = g.createLinearGradient(0, T.Y(0), 0, T.Y(3)); gb.addColorStop(0, 'rgba(30,22,14,0.34)'); gb.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gb; g.fillRect(0, T.Y(3), w, 3 * T.sy);
}
function paintWall(g, w, h, hm, seed, c) {   // a side bay 4.5 m wide: plain wall, a pilaster edge each side, one arched window, a cornice
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, col) => { g.fillStyle = col; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, col) => { const r = ww / 2; g.fillStyle = col; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = c.base; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, seed, ['rgba(120,85,50,0.1)', 'rgba(255,240,210,0.08)']);
  R(0, 0, 0.5, hm, c.trim); R(4.0, 0, 4.5, hm, c.trim);
  R(0, 0, 4.5, 0.9, c.foot); arch(2.25, hm - 5.2, hm - 1.4, 1.5, c.trim); arch(2.25, hm - 5.0, hm - 1.6, 1.1, '#2a2d33');
  R(0, hm - 0.7, 4.5, hm, c.trim); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,25,10,0.3)');
  streaks(g, w, h, 8, seed + 5, 0.1, 80, '50,36,24');
}

// ---------- the common builder ----------
function makeChurch(c) {
  const [Ox, Oz] = c.O, [Nx, Nz] = c.N;
  const W = (x, z) => [Ox + x * Nz + z * Nx, Oz - x * Nx + z * Nz];
  const toLocal = (p) => { const dx = p[0] - Ox, dz = p[1] - Oz; return [dx * Nz - dz * Nx, dx * Nx + dz * Nz]; };
  const clip = (pts, zmax) => {
    const L = pts.map(toLocal), out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out.map(q => W(q[0], q[1]));
  };
  return function build() {
    initShared();
    const pts = pairsOf(c.p), gr = groundRange(pts);
    const y0 = Math.min(groundY(...W(-6, 1.5)), groundY(...W(6, 1.5)), groundY(...W(0, 3)));
    const F = frame(Ox, y0, Oz, Nx, Nz), at = (x, y, z) => mul(F, tr(x, y, z));
    const k = c.key, hw = c.FW / 2, NZ0 = -1.6;
    defMat(k + 'Front', c.tw, c.th, [c.FW, c.FH], c.paint);
    defMat(k + 'Body', 128, 256, [4.5, c.EAVE], (g, w, h) => paintWall(g, w, h, c.EAVE, c.seed, c.wall));
    begin(y0);
    const body = clip(pts, -0.1);
    prism(k + 'Body', body, Math.min(gr.lo, y0) - 1.5, y0 + c.EAVE, { uvo: [0, -y0 / c.EAVE] });
    prism('flat', body, y0 + c.EAVE, y0 + c.EAVE + 0.12, { c: '#a39a8c' });
    if (c.NT > c.EAVE) bx(k + 'Body', F, -c.NW, c.NW, c.EAVE, c.NT, NZ0, c.NZ1, { uvo: [0, -(y0 + c.EAVE) / c.EAVE] });
    gable('tile', k + 'Body', at(0, 0, (NZ0 + c.NZ1) / 2), c.NW * 2, NZ0 - c.NZ1, c.NT, c.RISE, { ov: 0.35, c: '#b8744f', wc: c.wall.base });
    const s = new THREE.Shape(); c.shape(s, hw);
    extrude(k + 'Front', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / c.FW, 1 / c.FH], uvo: [0.5, 0], cs: 8, noao: true });
    c.extras(F, at, y0);
    const o = end(c.name);
    const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
    o.userData.solids = [[c.p, null, y0 + c.EAVE], [ring(-c.NW, c.NW, c.NZ1, NZ0), null, y0 + c.NT + c.RISE]];
    return o;
  };
}
// a raking cornice strip between two front points (x, y) with the given thickness, projecting to z
function rake(at, x0, y0, x1, y1, th, z1, col) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  box('flat', len, th, z1 + 1.35, { M: at((x0 + x1) / 2, (y0 + y1) / 2, (z1 - 1.35) / 2 - 0.05), p: [0, 0, 0], rz: ang, c: col, noao: true, uv: 'world' });
}

// ====================================================================================================
// Santa Ninfa dei Crociferi
// ====================================================================================================
const NI = { LOW: 10.8, UP: 17.0, APX: 20.4, FW: 25.6, FH: 21.6 };
function paintNinfa(g, w, h) {
  const T = tb(g, w, h, NI.FW, NI.FH), { R, tri, ell, vol, win, arch } = T, { LOW, UP, FW, FH } = NI;
  const BASE = '#a68259', ST = '#bd9a6e', STH = '#d0b184', DK = '#4f3d2d';
  g.fillStyle = BASE; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { const cx = T.X(-11 + i * 3.7), cy = T.Y(3 + (i % 3) * 5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4.5 * T.sx); gr.addColorStop(0, 'rgba(70,50,30,0.2)'); gr.addColorStop(1, 'rgba(70,50,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, '#7b6244');
  const pil = (x, ww, y1) => { R(x - ww / 2, 0.9, x + ww / 2, y1, ST); R(x - ww / 2, 0.9, x - ww / 2 + 0.1, y1, 'rgba(255,235,190,0.3)'); R(x + ww / 2 - 0.12, 0.9, x + ww / 2, y1, 'rgba(50,30,15,0.35)'); R(x - ww / 2 - 0.1, y1 - 0.4, x + ww / 2 + 0.1, y1, STH); };
  for (const s of [-1, 1]) { pil(s * 11.6, 2.4, LOW - 1.5); R(s * 11.6 - 0.8, 2.2, s * 11.6 + 0.8, LOW - 2.4, 'rgba(60,40,20,0.22)'); pil(s * 2.8, 0.7, LOW - 1.5); pil(s * 4.1, 0.7, LOW - 1.5); }
  // the three doors, a relief over each
  for (const x of [-7.3, 0, 7.3]) {
    R(x - 1.7, 0.9, x + 1.7, 5.4, STH); R(x - 1.3, 0.9, x + 1.3, 5.1, DK);
    if (x === 0) { R(x - 1.9, 5.4, x + 1.9, 5.9, STH); } else { tri(x - 2.1, x + 2.1, 5.4, 1.1, STH); tri(x - 1.4, x + 1.4, 5.5, 0.65, BASE); }
  }
  for (const x of [-7.3, 7.3]) { R(x - 1.4, 6.5, x + 1.4, 9.2, STH); R(x - 1.2, 6.7, x + 1.2, 9.0, '#9a7a58'); R(x - 0.5, 7.2, x + 0.5, 8.6, '#c9ad86'); }
  ell(0, 7.8, 1.7, 1.7, STH); ell(0, 7.8, 1.45, 1.45, '#9a7a58'); ell(0, 7.8, 0.8, 0.8, '#c9ad86');
  R(-FW / 2, LOW - 1.5, FW / 2, LOW, ST); R(-FW / 2, LOW - 1.55, FW / 2, LOW - 1.4, 'rgba(40,25,10,0.45)'); R(-FW / 2, LOW - 0.45, FW / 2, LOW, STH);
  for (let x = -12; x < 12.2; x += 1.2) R(x, LOW - 1.3, x + 0.5, LOW - 0.6, 'rgba(60,40,20,0.3)');
  // upper order: window under a curved pediment, paired pilasters, scrolls
  for (const s of [-1, 1]) { pil(s * 3.4, 0.7, UP - 0.7); pil(s * 4.5, 0.7, UP - 0.7); }
  R(-1.6, 12.0, 1.6, 16.2, STH); win(0, 12.3, 15.8, 2.4, '#2c3036', STH); arch(0, 15.8, 17.0, 3.4, STH); arch(0, 15.9, 16.8, 2.6, BASE);
  for (const s of [-1, 1]) { ell(s * 7.2, 13.6, 0.85, 1.9, STH); vol(s * 7.6, 11.9, 0.7, STH, '#7e6347'); }
  R(-6.4, UP - 0.7, 6.4, UP, ST); R(-6.6, UP, 6.6, UP + 0.35, STH);
  tri(-6.3, 6.3, UP + 0.35, 2.9, STH); tri(-5.2, 5.2, UP + 0.6, 2.3, '#b08c62'); ell(0, UP + 1.5, 1.1, 0.7, '#cdb48a');
  ground(g, w, h, T, 8101, [LOW, UP]);
}
function buildNinfaExtras(F, at) {
  const { LOW, UP } = NI, hw = NI.FW / 2;
  bx('flat', F, -hw - 0.3, hw + 0.3, LOW - 0.2, LOW + 0.35, -1.35, 0.9, { c: '#c7a577', noao: true });
  bx('flat', F, -6.5, 6.5, UP - 0.1, UP + 0.3, -1.35, 0.55, { c: '#c7a577', noao: true });
  rake(at, -6.5, UP + 0.2, 0, UP + 3.35, 0.4, 0.45, '#c7a577'); rake(at, 6.5, UP + 0.2, 0, UP + 3.35, 0.4, 0.45, '#c7a577');
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 11.6 - 1.4, sg * 11.6 + 1.4, 0.9, LOW - 1.5, -0.05, 0.4, { c: '#bd9a6e', noao: true });
    for (const d of [2.8, 4.1]) bx('flat', F, sg * d - 0.4, sg * d + 0.4, 0.9, LOW - 1.5, -0.05, 0.3, { c: '#bd9a6e', noao: true });
    for (const d of [3.4, 4.5]) bx('flat', F, sg * d - 0.4, sg * d + 0.4, LOW, UP - 0.7, -0.05, 0.3, { c: '#bd9a6e', noao: true });
    bx('flat', F, sg * 9.4 - 0.6, sg * 9.4 + 0.6, LOW + 0.3, LOW + 1.1, -0.6, 0.2, { c: '#c0a073', noao: true }); pyramid('flat', 0.9, 0.9, 3.4, { M: at(sg * 9.4, LOW + 1.1, -0.2), c: '#b9966a' });
    bx('flat', F, sg * 11.7 - 0.5, sg * 11.7 + 0.5, LOW + 0.3, LOW + 0.9, -0.6, 0.2, { c: '#c0a073', noao: true }); pyramid('flat', 0.7, 0.7, 2.2, { M: at(sg * 11.7, LOW + 0.9, -0.2), c: '#b9966a' });
  }
  bx('stone', F, -2.2, 2.2, -0.2, 0.2, -0.05, 0.6, { c: '#c9b894' });
}
const NINFA = makeChurch({
  key: 'niNf', name: 'Chiesa di Santa Ninfa dei Crociferi', id: 'w86873788',
  p: [-52.6, -122.7, -41.6, -99.6, -55.1, -92.8, -78.2, -79.8, -81.4, -84.4, -89.3, -79.6, -96, -92.2, -88.1, -96.7, -90.7, -102],
  O: [-47.1, -111.15], N: [0.9029, -0.4299], FW: NI.FW, FH: NI.FH, tw: 384, th: 320, seed: 8121,
  EAVE: 11.5, NT: 15.0, NW: 7, NZ1: -41, RISE: 3.0,
  wall: { base: '#a98a63', trim: '#bd9a6e', foot: '#7b6244' },
  paint: paintNinfa,
  shape(s, hw) {
    const { LOW, UP, APX } = NI;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, LOW); s.lineTo(9.8, LOW); s.bezierCurveTo(8.2, LOW + 0.2, 6.6, LOW + 2.0, 6.0, UP - 0.7); s.lineTo(6.3, UP); s.lineTo(0, APX);
    s.lineTo(-6.3, UP); s.lineTo(-6.0, UP - 0.7); s.bezierCurveTo(-6.6, LOW + 2.0, -8.2, LOW + 0.2, -9.8, LOW); s.lineTo(-hw, LOW); s.lineTo(-hw, 0);
  },
  extras: buildNinfaExtras,
});
export const SANTA_NINFA = { name: 'Chiesa di Santa Ninfa dei Crociferi', x: -70, z: -100, radius: 45, skipIds: ['w86873788'], build: NINFA };

// ====================================================================================================
// San Matteo al Cassaro
// ====================================================================================================
const MA = { LOW: 8.4, UP: 14.4, FW: 18.8, FH: 21.4 };
function paintMatteo(g, w, h) {
  const T = tb(g, w, h, MA.FW, MA.FH), { R, tri, ell, vol, win, arch } = T, { LOW, UP, FW, FH } = MA;
  const LO = '#8d877a', MID = '#b4ad9e', WH = '#e7dfcc', ST = '#c6bfae', DK = '#3a3631';
  g.fillStyle = LO; g.fillRect(0, 0, w, h);
  R(-FW / 2, LOW, FW / 2, UP + 0.6, MID); R(-FW / 2, UP + 0.6, FW / 2, FH, WH);
  R(-FW / 2, 0, FW / 2, 0.9, '#6f695d');
  const pil = (x, ww, y0, y1) => { R(x - ww / 2, y0, x + ww / 2, y1, ST); R(x + ww / 2 - 0.12, y0, x + ww / 2, y1, 'rgba(40,30,20,0.3)'); R(x - ww / 2 - 0.1, y1 - 0.35, x + ww / 2 + 0.1, y1, '#d6cfbd'); };
  for (const s of [-1, 1]) { pil(s * 8.5, 1.8, 0.9, LOW - 1.3); pil(s * 3.2, 0.9, 0.9, LOW - 1.3); }
  // lower order: window left, portal with a statue niche over it in the middle, pedimented door right
  win(-5.8, 2.4, 6.4, 2.3, '#262a30', ST);
  R(-1.5, 0.9, 1.5, 5.0, ST); R(-1.15, 0.9, 1.15, 4.7, '#3c2c20'); R(-1.7, 5.0, 1.7, 5.4, '#d6cfbd');
  arch(0, 5.9, 8.0, 1.6, ST); arch(0, 6.05, 7.85, 1.2, '#4d4a44'); R(-0.3, 6.05, 0.3, 7.2, '#d9d2c0');
  R(5.6 - 1.2, 0.9, 5.6 + 1.2, 4.2, ST); R(5.6 - 0.9, 0.9, 5.6 + 0.9, 3.9, DK); tri(5.6 - 1.6, 5.6 + 1.6, 4.2, 0.9, '#d6cfbd'); tri(5.6 - 1.0, 5.6 + 1.0, 4.3, 0.5, LO);
  R(5.6 - 0.9, 5.2, 5.6 + 0.9, 6.9, ST); R(5.6 - 0.7, 5.4, 5.6 + 0.7, 6.7, '#4d4a44');
  R(-FW / 2, LOW - 1.3, FW / 2, LOW, '#a8a191'); R(-FW / 2, LOW - 0.4, FW / 2, LOW, '#d0c9b6');
  // upper order: niches with statues, oculus, volutes, cartouche
  for (const s of [-1, 1]) {
    const x = s * 5.7; R(x - 1.2, 9.5, x + 1.2, 13.7, ST); arch(x, 9.8, 13.3, 1.7, '#5a554c'); R(x - 0.3, 9.8, x + 0.3, 12.0, '#d8d1bf'); ell(x, 12.3, 0.25, 0.3, '#d8d1bf'); tri(x - 1.5, x + 1.5, 13.7, 0.7, '#d6cfbd');
    vol(s * 8.5, 12.8, 1.0, '#cfc8b6', '#756f63'); vol(s * 3.2, 10.0, 0.7, '#d1cab8', '#756f63');
  }
  ell(0, 11.3, 2.0, 2.0, '#d6cfbd'); ell(0, 11.3, 1.55, 1.55, '#2f3137'); ell(0, 14.0, 0.9, 0.7, '#cfc8b6'); ell(0, 14.0, 0.6, 0.45, '#8a8374');
  R(-FW / 2, UP - 0.5, FW / 2, UP + 0.2, '#d0c9b6'); R(-FW / 2, UP - 0.6, FW / 2, UP - 0.5, 'rgba(40,25,10,0.35)');
  // bell gable: three arched openings, scrolls
  for (const x of [-2.0, 2.0]) { arch(x, UP + 2.4, UP + 5.1, 2.0, '#d9d0bb'); arch(x, UP + 2.55, UP + 4.95, 1.6, '#2b2a2c'); }
  arch(0, UP + 0.9, UP + 2.7, 1.5, '#d9d0bb'); arch(0, UP + 1.0, UP + 2.6, 1.1, '#2b2a2c');
  for (const s of [-1, 1]) vol(s * 4.7, UP + 1.3, 0.95, '#f0e9d6', '#a39b86');
  R(-FW / 2, UP + 0.55, FW / 2, UP + 0.9, '#d8d0bb');
  ground(g, w, h, T, 8201, [LOW, UP], '40,36,30');
}
function buildMatteoExtras(F, at) {
  const { LOW, UP } = MA, hw = MA.FW / 2;
  bx('flat', F, -hw - 0.3, hw + 0.3, LOW - 0.2, LOW + 0.35, -1.35, 0.9, { c: '#c9c2b0', noao: true });
  bx('flat', F, -hw - 0.2, hw + 0.2, UP - 0.1, UP + 0.4, -1.35, 0.6, { c: '#d3ccb9', noao: true });
  bx('flat', F, -4.6, 4.6, UP + 3.2, UP + 3.5, -1.35, 0.4, { c: '#e9e2d0', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 8.5 - 0.9, sg * 8.5 + 0.9, 0.9, LOW - 1.3, -0.05, 0.35, { c: '#c6bfae', noao: true });
    bx('flat', F, sg * 3.2 - 0.45, sg * 3.2 + 0.45, 0.9, LOW - 1.3, -0.05, 0.25, { c: '#c6bfae', noao: true });
    statue('flat', at(sg * 5.7, 9.85, 0.05), 2.1, { c: '#e2dccb' });
  }
  statue('flat', at(0, 6.1, 0.05), 1.5, { c: '#e2dccb' });
  bx('flat', F, -0.1, 0.1, UP + 6.4, UP + 8.0, -0.6, -0.4, { c: '#44403a', noao: true }); bx('flat', F, -0.5, 0.5, UP + 7.2, UP + 7.35, -0.6, -0.4, { c: '#44403a', noao: true });
  bx('stone', F, -1.8, 1.8, -0.2, 0.2, -0.05, 0.5, { c: '#cfc6b0' });
}
const MATTEO = makeChurch({
  key: 'maCa', name: 'Chiesa di San Matteo al Cassaro', id: 'w143740354',
  p: [117.1, -53.2, 103.7, -79.3, 102.2, -78.5, 91.7, -99.1, 108.5, -107.6, 114.9, -95.1, 117.2, -96.3, 134.7, -62],
  O: [100.1, -103.35], N: [-0.4515, -0.8923], FW: MA.FW, FH: MA.FH, tw: 384, th: 384, seed: 8221,
  EAVE: 11.0, NT: 14.4, NW: 7, NZ1: -50, RISE: 3.2,
  wall: { base: '#aaa394', trim: '#c6bfae', foot: '#7b756a' },
  paint: paintMatteo,
  shape(s, hw) {
    const { LOW, UP } = MA;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, UP + 0.6); s.lineTo(7.2, UP + 0.6); s.bezierCurveTo(6.4, UP + 1.0, 5.2, UP + 2.0, 4.9, UP + 3.4); s.lineTo(4.5, UP + 5.4); s.lineTo(1.8, UP + 6.0); s.lineTo(0, UP + 6.5);
    s.lineTo(-1.8, UP + 6.0); s.lineTo(-4.5, UP + 5.4); s.lineTo(-4.9, UP + 3.4); s.bezierCurveTo(-5.2, UP + 2.0, -6.4, UP + 1.0, -7.2, UP + 0.6); s.lineTo(-hw, UP + 0.6); s.lineTo(-hw, 0);
  },
  extras: buildMatteoExtras,
});
export const SAN_MATTEO = { name: 'Chiesa di San Matteo al Cassaro', x: 112, z: -80, radius: 40, skipIds: ['w143740354'], build: MATTEO };

// ====================================================================================================
// Sant'Anna la Misericordia
// ====================================================================================================
const AN = { LOW: 8.9, UP: 16.6, FW: 26.4, FH: 21.0 };
function paintAnna(g, w, h) {
  const T = tb(g, w, h, AN.FW, AN.FH), { R, tri, ell, vol, win, arch } = T, { LOW, UP, FW } = AN;
  const WALL = '#6f5a47', OCH = '#a98962', OCHH = '#c3a478', DK = '#3a2a1e', WOOD = '#b9783c';
  g.fillStyle = WALL; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { const cx = T.X(-12 + i * 3.4), cy = T.Y(3 + (i % 3) * 5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * T.sx); gr.addColorStop(0, 'rgba(160,130,90,0.16)'); gr.addColorStop(1, 'rgba(160,130,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, '#54443a');
  // lower order: central door, broken pediment, Pieta relief, four niches, two small doors
  R(-2.1, 0.9, 2.1, 6.3, OCH); R(-1.6, 0.9, 1.6, 5.7, WOOD); R(-0.04, 0.9, 0.04, 5.7, '#6a4020'); for (let y = 1.6; y < 5.6; y += 1.3) { R(-1.5, y, -0.1, y + 1.1, 'rgba(0,0,0,0.14)'); R(0.1, y, 1.5, y + 1.1, 'rgba(0,0,0,0.14)'); }
  R(-2.8, 6.3, -0.3, 6.8, OCHH); R(0.3, 6.3, 2.8, 6.8, OCHH); tri(-2.8, -0.2, 6.8, 0.6, OCHH); tri(0.2, 2.8, 6.8, 0.6, OCHH);
  R(-1.7, 6.9, 1.7, 8.7, OCH); R(-1.5, 7.1, 1.5, 8.5, '#8f7456'); ell(0, 7.8, 0.7, 0.55, '#cdbb98');
  for (const s of [-1, 1]) {
    for (const x of [s * 10.7, s * 7.3]) { R(x - 1.0, 3.2, x + 1.0, 7.9, OCH); arch(x, 3.5, 7.7, 1.5, '#4c3a2b'); R(x - 0.35, 3.5, x + 0.35, 5.9, '#d6c7a8'); ell(x, 6.2, 0.25, 0.3, '#d6c7a8'); R(x - 0.9, 3.0, x + 0.9, 3.5, OCHH); }
    R(s * 7.3 - 0.8, 0.9, s * 7.3 + 0.8, 3.0, WOOD); R(s * 7.3 - 0.6, 0.9, s * 7.3 + 0.6, 2.8, 'rgba(0,0,0,0.15)');
    R(s * 12.7 - 0.7, 0.9, s * 12.7 + 0.7, 2.5, '#5d4635');
  }
  R(-FW / 2, LOW - 1.0, FW / 2, LOW, OCH); R(-FW / 2, LOW - 1.05, FW / 2, LOW - 0.95, 'rgba(30,20,10,0.5)'); R(-FW / 2, LOW - 0.3, FW / 2, LOW, OCHH);
  // upper order: window over a balustrade, angels cartouche, columns come from 3D parts
  R(-7.6, LOW, 7.6, UP, '#7b6550'); R(-1.6, 10.0, 1.6, 14.2, OCH); win(0, 10.3, 13.8, 2.0, '#4b3322', OCHH); R(-1.8, 14.2, 1.8, 14.6, OCHH);
  R(-2.4, 9.0, 2.4, 9.9, OCH); for (let x = -2.2; x < 2.3; x += 0.55) R(x, 9.1, x + 0.22, 9.8, '#d3c4a4');
  R(-2.3, 14.8, 2.3, 16.0, OCH); R(-1.7, 15.0, 1.7, 15.8, '#d4c5a5'); ell(0, 15.3, 0.9, 0.6, '#e5d9bd');
  R(-FW / 2, UP - 0.6, FW / 2, UP - 0.1, 'rgba(0,0,0,0)');
  R(-3.7, UP - 0.1, 3.7, UP + 0.5, OCHH); arch(0, UP + 0.5, UP + 2.6, 5.2, OCH); ell(0, UP + 1.3, 1.1, 0.9, '#cdb98f'); ell(0, UP + 1.3, 0.75, 0.6, '#8f7456');
  for (const s of [-1, 1]) { vol(s * 9.8, UP - 5.6, 0.7, OCHH, '#6f573f'); R(s * 8.2 - 0.3, LOW + 1.2, s * 8.2 + 0.3, UP - 3.2, 'rgba(180,150,105,0.5)'); }
  ground(g, w, h, T, 8301, [LOW, UP], '40,28,18');
}
function buildAnnaExtras(F, at) {
  const { LOW, UP } = AN, hw = AN.FW / 2, GREY = '#b9b6aa', CAP = '#c9a97c';
  bx('flat', F, -hw - 0.3, hw + 0.3, LOW - 0.15, LOW + 0.3, -1.35, 1.0, { c: CAP, noao: true });
  bx('flat', F, -8.2, 8.2, UP - 0.15, UP + 0.45, -1.35, 0.7, { c: CAP, noao: true });
  bx('flat', F, -3.9, 3.9, UP + 2.55, UP + 2.8, -1.35, 0.5, { c: CAP, noao: true });
  for (const sg of [-1, 1]) {
    for (const d of [3.4, 5.0, 9.2, 12.6]) {   // lower columns on bases with capitals
      bx('flat', F, sg * d - 0.6, sg * d + 0.6, 0.9, 1.45, -0.1, 1.0, { c: CAP, noao: true });
      cyl('flat', 0.42, 0.46, LOW - 2.5, 10, { M: at(sg * d, 1.45, 0.4), c: GREY });
      bx('flat', F, sg * d - 0.62, sg * d + 0.62, LOW - 1.05, LOW - 0.15, -0.1, 1.0, { c: CAP, noao: true });
    }
    for (const d of [3.2, 4.9]) {   // upper columns
      bx('flat', F, sg * d - 0.5, sg * d + 0.5, LOW + 0.3, LOW + 0.8, -0.1, 0.8, { c: CAP, noao: true });
      cyl('flat', 0.32, 0.36, UP - LOW - 1.5, 8, { M: at(sg * d, LOW + 0.8, 0.35), c: GREY });
      bx('flat', F, sg * d - 0.5, sg * d + 0.5, UP - 0.7, UP - 0.15, -0.1, 0.8, { c: CAP, noao: true });
    }
    bx('flat', F, sg * hw - 0.5 - 0.7, sg * hw - 0.5 + 0.7, LOW + 0.3, LOW + 1.3, -0.5, 0.6, { c: CAP, noao: true }); sphere('flat', 0.55, { M: at(sg * (hw - 0.5), LOW + 1.7, 0.1), ky: 1.3, seg: 6, c: '#c3a475' });
    bx('flat', F, sg * 8.0 - 0.6, sg * 8.0 + 0.6, UP - 0.15, UP + 0.6, -0.5, 0.5, { c: CAP, noao: true }); sphere('flat', 0.5, { M: at(sg * 8.0, UP + 0.95, 0), ky: 1.3, seg: 6, c: '#c3a475' });
    statue('flat', at(sg * 9.6, LOW + 0.9, -0.3), 2.6, { c: '#d9d2c0' });
    statue('flat', at(sg * 10.7, 3.5, 0.0), 2.0, { c: '#e0dac8' }); statue('flat', at(sg * 7.3, 3.5, 0.0), 2.0, { c: '#e0dac8' });
  }
  bx('flat', F, -0.1, 0.1, UP + 3.0, UP + 5.8, -0.9, -0.7, { c: '#4a4036', noao: true }); bx('flat', F, -0.6, 0.6, UP + 4.4, UP + 4.55, -0.9, -0.7, { c: '#4a4036', noao: true });
  bx('stone', F, -2.6, 2.6, -0.2, 0.2, -0.05, 0.7, { c: '#cfc2a4' });
}
const ANNA = makeChurch({
  key: 'anMi', name: "Chiesa di Sant'Anna la Misericordia", id: 'w49863590',
  p: [327.2, 20.7, 323.9, 56.9, 350.2, 59.6, 357.8, -1.2, 354, -1.6, 348.7, -2.1, 348.4, 6.7, 339.5, 5.4, 338, 13.2, 332.3, 12.5, 332.5, 21.1],
  O: [337.05, 58.25], N: [-0.1021, 0.9948], FW: AN.FW, FH: AN.FH, tw: 384, th: 320, seed: 8321,
  EAVE: 12.0, NT: 16.0, NW: 9, NZ1: -34, RISE: 4.0,
  wall: { base: '#8a735b', trim: '#b49770', foot: '#5d4a3a' },
  paint: paintAnna,
  shape(s, hw) {
    const { LOW, UP } = AN;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, LOW + 0.8); s.lineTo(11.9, LOW + 0.8); s.bezierCurveTo(10.4, LOW + 1.0, 8.2, LOW + 3.0, 7.7, LOW + 6.0); s.lineTo(7.7, UP + 0.4); s.lineTo(3.8, UP + 0.6); s.lineTo(3.1, UP + 2.4); s.lineTo(0, UP + 3.1);
    s.lineTo(-3.1, UP + 2.4); s.lineTo(-3.8, UP + 0.6); s.lineTo(-7.7, UP + 0.4); s.lineTo(-7.7, LOW + 6.0); s.bezierCurveTo(-8.2, LOW + 3.0, -10.4, LOW + 1.0, -11.9, LOW + 0.8); s.lineTo(-hw, LOW + 0.8); s.lineTo(-hw, 0);
  },
  extras: buildAnnaExtras,
});
export const SANT_ANNA = { name: "Chiesa di Sant'Anna la Misericordia", x: 340, z: 28, radius: 45, skipIds: ['w49863590'], build: ANNA };

// ====================================================================================================
// Santa Maria degli Angeli, La Gancia
// ====================================================================================================
const GA = { EAVE: 14.2, RISE: 4.7, FW: 22.5, FH: 19.2 };
function paintGancia(g, w, h) {
  const T = tb(g, w, h, GA.FW, GA.FH), { R, tri, ell, arch, pointed } = T, { FW } = GA;
  paintAshlar(g, w, h, FW, GA.FH, 0.42, 1.15, '#cda56a', '#a2804e', 8401, 1.4, 0.08);
  for (let i = 0; i < 6; i++) { const cx = T.X(-9 + i * 3.6), cy = T.Y(2 + (i % 3) * 5.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4.5 * T.sx); gr.addColorStop(0, 'rgba(90,60,30,0.16)'); gr.addColorStop(1, 'rgba(90,60,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // the pointed portal with stepped archivolts, the door in dark green-black
  pointed(0, 0, 7.4, 5.2, '#b89258'); pointed(0, 0, 7.0, 4.6, '#d6b57e'); pointed(0, 0, 6.5, 3.8, '#a98350'); pointed(0, 0, 6.1, 3.2, '#232a28');
  R(-1.7, 0, 1.7, 3.0, '#2a312e'); for (let x = -1.5; x < 1.6; x += 0.5) R(x, 0, x + 0.08, 3.0, 'rgba(120,130,125,0.25)');
  // the big blind lunette above, a narrow lancet window high up
  g.fillStyle = '#d3ae72'; g.beginPath(); g.moveTo(T.X(-4.4), T.Y(9.0)); g.lineTo(T.X(4.4), T.Y(9.0)); g.arc(T.X(0), T.Y(9.0), 4.4 * T.sx, 0, PI, true); g.fill();
  g.fillStyle = '#b8895c'; g.beginPath(); g.moveTo(T.X(-4.0), T.Y(9.1)); g.lineTo(T.X(4.0), T.Y(9.1)); g.arc(T.X(0), T.Y(9.1), 4.0 * T.sx, 0, PI, true); g.fill();
  R(-4.6, 8.6, 4.6, 9.0, '#c19a62');
  pointed(0, 13.2, 18.0, 1.9, '#d3ae72'); pointed(0, 13.4, 17.8, 1.4, '#3e342a');
  for (const [x, y] of [[-5.2, 15.5], [-1.2, 16.6], [4.8, 15.0], [7.6, 6.2], [-7.4, 11.0], [2.2, 11.0], [-5.8, 7.8]]) R(x - 0.2, y, x + 0.2, y + 0.4, '#5a4328');
  noiseDots(g, w, h, w * h / 70, 2, 8402, ['rgba(90,60,30,0.08)', 'rgba(255,235,190,0.08)']);
  streaks(g, w, h, 30, 8403, 0.1, 120, '60,42,22');
  const gb = g.createLinearGradient(0, T.Y(0), 0, T.Y(3)); gb.addColorStop(0, 'rgba(40,28,16,0.34)'); gb.addColorStop(1, 'rgba(40,28,16,0)'); g.fillStyle = gb; g.fillRect(0, T.Y(3), w, 3 * T.sy);
}
function buildGanciaExtras(F, at) {
  const hw = GA.FW / 2, E = GA.EAVE;
  bx('flat', F, -hw - 0.1, hw + 0.1, E - 0.1, E + 0.25, -1.35, 0.3, { c: '#bd9a62', noao: true });
  rake(at, -hw - 0.1, E + 0.1, 0, E + GA.RISE + 0.15, 0.3, 0.3, '#bd9a62'); rake(at, hw + 0.1, E + 0.1, 0, E + GA.RISE + 0.15, 0.3, 0.3, '#bd9a62');
  bx('stone', F, -3.0, 3.0, -0.2, 0.2, -0.05, 0.9, { c: '#cbb58a' });
  bx('dark', F, -2.9, 2.9, 0.2, 2.3, 0.45, 0.55, { c: '#2b2d29', noao: true });
  for (let x = -2.8; x < 2.9; x += 0.4) bx('dark', F, x - 0.03, x + 0.03, 0.2, 2.3, 0.4, 0.5, { c: '#1c1d1a', noao: true });
}
const GANCIA = makeChurch({
  key: 'gaAn', name: 'Chiesa di Santa Maria degli Angeli (La Gancia)', id: 'w49788642',
  p: [784.8, -70.7, 795.2, -50.7, 833.1, -68.2, 846.6, -74.5, 834, -102.4, 812.8, -90.5, 814.9, -85.8],
  O: [790, -60.7], N: [-0.8872, 0.4614], FW: GA.FW, FH: GA.FH, tw: 384, th: 320, seed: 8421,
  EAVE: GA.EAVE, NT: GA.EAVE, NW: 10.9, NZ1: -33.5, RISE: GA.RISE,
  wall: { base: '#c4a068', trim: '#d6b57e', foot: '#8e6f44' },
  paint: paintGancia,
  shape(s, hw) { s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, GA.EAVE); s.lineTo(0, GA.EAVE + GA.RISE); s.lineTo(-hw, GA.EAVE); s.lineTo(-hw, 0); },
  extras: buildGanciaExtras,
});
export const GANCIA_CH = { name: 'Chiesa di Santa Maria degli Angeli (La Gancia)', x: 815, z: -78, radius: 45, skipIds: ['w49788642'], build: GANCIA };

export const BATCH_A = [SANTA_NINFA, SAN_MATTEO, SANT_ANNA, GANCIA_CH];
