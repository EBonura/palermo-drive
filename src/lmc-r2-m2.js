// Round 2 landmarks, batch M2. Registered through src/lmc-r2.js. Seven places that were missing: the monument of Santa Rosalia on the Cathedral piano, the fountain of the Genius of Palermo in Piazza
// Rivoluzione, the fountains of the Garraffo and of the sea horse by Piazza Marina and Piazza Santo Spirito, the fountain of the two dragons in Corso Calatafimi, the statue of Santa Rosalia on the
// belvedere of Monte Pellegrino and the fountain of the Triton in Monreale.
// The figure kit is the one of src/lmc-monuments.js. Every stone, bronze, rock and water part is a tint of its stone grain, so a place is one to three meshes: that grain, a small painted sheet (the
// bellied iron railing of the Genius and the inscription tablet of Santa Rosalia), the shared iron railing and, for the dragons, the shared plaster of the wall behind them. The props-data node of the
// Pellegrino statue is listed in MODELLED (src/props.js). In front of the dragons 16.6 m of the map's fence are taken out (clearFences) and the model's own railing stands there.
//
// Photos (only shapes, colours and proportions were read from them). Plans and positions were set on the Regione Siciliana orthophoto and the OSM geometry, heights estimated from the photos, so treat
// positions as good to about a metre and heights as rather less.
//   Santa Rosalia, Cathedral piano (w926581673): Wikimedia Commons "Palermo BW 2012-10-09 12-07-39.JPG" and "12-08-06", "Palermo-Sicily-Italy - Creative Commons by gnuckx (3491877891), (3492769298)";
//     Mapillary 1547033402695621, 1107236643868937. (The two "0480 ... Santa Rosalia" pictures show a different statue, not this monument.) It was drawn by no other model.
//   Genius of Palermo (w551744944): Commons "Genio della Rivoluzione.jpg", "Genio di Piazza Rivoluzione (Palermo) 21 06 2026 01.jpg", "Piazza Rivoluzione (Palermo) 14 07 2024 01.jpg" and "03",
//     "Genio (Palermo) 15 07 2019 01.jpg" (the shop signs behind it give the side it faces).
//   Fontana del Garraffo (w1185596314): Commons "Fontana del Garraffo - Piazza Marina 2.jpg", "Fontana del Garraffo (Palermo) 14 07 2019 01.jpg".
//   Fontana del Cavallo Marino (w418897527): Commons "Fontana del Cavallo Marino.JPG", "... (Palermo) 21 06 2026 01.jpg" and "02", "Fontana del Cavallo marino () 14 07 2024 01.jpg" and "04".
//   Fontana dei Due Draghi (not mapped): the two photos of the balarm.it pages "Fontana dei due draghi" and "chi ricorda la fontana dei due dragoni"; Mapillary 1448903642123055 (the curved wall
//     and the railing from the Corso); the top of the curved wall in the orthophoto, which fixes the place.
//   Santa Rosalia, belvedere of Monte Pellegrino (n9466444709; Benedetto De Lisi, 1964 according to balarm.it): the two photos of balarm.it "La statua di Santa Rosalia risplende a Monte Pellegrino".
//   Fontana del Tritone (w153253754): Commons "Monreale - Fontana del Tritone 0877.JPG" and "0880"; Mapillary 245320357343385.
// Not verified, and plain or simplified: the faces and drapery of every statue; all carving (shapes only); the inscriptions (faint strokes); the sides of the Cathedral monument that no photo shows
// (taken as plain); the backs of the fountain groups; the way the Garraffo, the sea horse and the Triton face (read from what stands behind them in the photos); the bearing of the Pellegrino statue (towards the
// terrace, east) and the rocks behind it; the shape of the ground inside the dragons' recess. The palms round the sea horse and the trees of the recess are not drawn.
// The antimafia murals of Via Duca della Verdura (Andrea Buglisi, "La porta dei Giganti", 2021, the portraits of Falcone and Borsellino, as reported by regione.sicilia.it and artribune) are not
// painted: a hand drawn copy of two real faces, and of a living artist's work, would not be a fit likeness. Their walls stay as they are.
import * as THREE from 'three';
import { TREE_CLEAR } from './tree-clear.js';
import { PI, bx, lathe, panel, extrude, begin, end, defMat, part, tr, rotY, mul, frame, groundY, rail, RNG } from './lmc-kit.js';
import { setup, limb, blob, taper, figure, eagle, unit, wpt, siteSegs, siteRect, open, at, SQ } from './lmc-monuments.js';

const S = 'mnStone', D = 'r2m2';

// ---------------------------------------------------------------------------------------------------
// the painted sheet: the iron railing of the Genius (cut out) and the tablet on the Cathedral monument
// ---------------------------------------------------------------------------------------------------
const AT = 256;
const RG = { iron: [0, 0, 256, 128], tablet: [0, 128, 96, 128] };   // [x, y, w, h]
function paintSheet(g) {
  g.clearRect(0, 0, AT, AT);
  // bellied wrought iron: bars bent like an S with a scroll at the foot, two rails, a spear point on every fourth bar
  g.strokeStyle = g.fillStyle = '#1d1e22'; g.lineCap = 'round';
  g.fillRect(0, 22, 256, 5); g.fillRect(0, 118, 256, 6);
  for (let i = 0; i < 16; i++) {
    const x = i * 16 + 7;
    g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, 10); g.bezierCurveTo(x - 1, 46, x + 11, 66, x + 4, 88); g.bezierCurveTo(x - 1, 104, x - 3, 110, x, 120); g.stroke();
    g.lineWidth = 2.2; g.beginPath(); g.arc(x + 4.5, 107, 5, 0.4 * PI, 2.1 * PI); g.stroke();
    if (i % 4 === 0) { g.fillRect(x - 2, 6, 4, 118); g.beginPath(); g.moveTo(x - 5, 12); g.lineTo(x, 0); g.lineTo(x + 5, 12); g.closePath(); g.fill(); }
  }
  const [tx, ty, tw, th] = RG.tablet, r = RNG(5201);
  g.fillStyle = '#d9d4c6'; g.fillRect(tx, ty, tw, th);
  g.strokeStyle = '#a8a190'; g.lineWidth = 5; g.strokeRect(tx + 4, ty + 4, tw - 8, th - 8);
  g.fillStyle = '#8c8574';
  for (let i = 0; i < 12; i++) { const lw = (tw - 24) * (0.6 + r() * 0.4); let u = tx + (tw - lw) / 2; while (u < tx + (tw + lw) / 2 - 2) { const k = 2 + r() * 5; g.fillRect(u, ty + 15 + i * 8.6, Math.min(k, tx + (tw + lw) / 2 - u), 2.4); u += k + 2; } }
}
const define = () => defMat(D, AT, AT, [1, 1], (g) => paintSheet(g), { alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, noShadow: true });
const uvOf = (k) => { const [x, y, w, h] = RG[k]; return { uvk: [(w - 1) / AT, (h - 1) / AT], uvo: [(x + 0.5) / AT, 1 - (y + h - 0.5) / AT] }; };

// ---------------------------------------------------------------------------------------------------
// solids
// ---------------------------------------------------------------------------------------------------
// a block on the plan pts [[x, z], ...] from y0 to y1
function block(M, pts, y0, y1, c, key = S) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-PI / 2); g.translate(0, y0, 0);
  part(key, g, { M, c, noao: true });
}
// like open(), for a place on sloping ground: the model stands at a given height above the ground at its middle, its foundations reaching down past the lowest ground within r
function level(Q, r, lift) {
  setup(); const y = groundY(Q.O[0], Q.O[1]) + lift; let lo = y;
  for (const [x, z] of [[r, r], [-r, r], [r, -r], [-r, -r], [r, 0], [-r, 0], [0, r], [0, -r]]) { const p = wpt(Q, x, z); lo = Math.min(lo, groundY(p[0], p[1])); }
  begin(y);
  return { M: frame(Q.O[0], y, Q.O[1], Q.N[0], Q.N[1]), y, drop: y - lo + 0.5 };
}
const circle = (r, n, a0 = PI / n) => Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * 2 * PI / n) * r, Math.sin(a0 + i * 2 * PI / n) * r]);
// four broad lobes with a notch between them, the plan of the Garraffo's steps and basin
const lobed = (r) => Array.from({ length: 16 }, (_, i) => { const a = i * PI / 8, k = [1, 0.975, 0.89, 0.975][i % 4]; return [Math.cos(a) * r * k, Math.sin(a) * r * k]; });
const turned = (M, prof, seg, c, o = {}) => lathe(S, prof, seg, { M, c, noao: true, ...o });
const water = (M, r, y, c = '#587069', n = 18, sz = 1) => turned(M, [[r, y], [0.001, y]], n, c, { s: [1, 1, sz] });   // from the rim inwards, so that it faces up
const ring = (M, p, r, t, c, o = {}) => part(S, new THREE.TorusGeometry(r, t, 3, o.n || 8), { M, p, c, noao: true, rx: o.rx || 0, ry: o.ry || 0 });
const drape = (M, pts, z, d, c) => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); extrude(S, s, d, { M, p: [0, 0, z], c, noao: true }); };
// a limb along the points pts, its radius going from r0 to r1
function chain(M, pts, r0, r1, c, seg = 4) { const n = pts.length - 1; for (let i = 0; i < n; i++) limb(M, pts[i], pts[i + 1], r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n, c, seg); }
// a heap of rough stones: n of them between the radius rad at y0 and a quarter of it at y1
function rocks(M, seed, n, rad, y0, y1, size, cols) {
  const r = RNG(seed);
  turned(M, [[rad * 0.82, y0], [rad * 0.55, (y0 + y1) / 2], [rad * 0.18, y1 - size * 0.3], [0.001, y1 - size * 0.3]], 7, cols[0]);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, a = i * 2.4 + r(), rr = rad * (1 - 0.76 * u) * (0.7 + r() * 0.3), s = size * (0.65 + r() * 0.6);
    blob(M, [Math.cos(a) * rr, y0 + (y1 - y0 - size * 0.6) * u + s * 0.2, Math.sin(a) * rr], [s, s * (0.55 + r() * 0.35), s * (0.7 + r() * 0.4)], cols[i % cols.length], 0, r() * 1.2, r() * 1.2);
  }
}

// ====================================================================================================
// Santa Rosalia on the Cathedral piano: two steps, a plinth, the die with a column at each corner and the inscription towards the Corso, a heavy cornice with four urns, a scrolled block, and on it
// the saint in white marble over the fallen figure of the plague, the cross raised in her right hand; the iron railing of the middle bed round it
// ====================================================================================================
const RO = { O: [-430.5, 193.9], N: unit(0.454, 0.891) };
function buildRosalia() {
  define(); const { M, drop } = open(RO, 3.0), W = '#dcd7c9', W2 = '#c5bfaf', W3 = '#aea795', WH = '#eae6da', IR = '#24262a';
  SQ(M, S, 2.05, -drop, 0.52, '#bdb8aa'); SQ(M, S, 1.72, 0.52, 0.9, W2);
  SQ(M, S, 1.38, 0.9, 1.62, W); SQ(M, S, 1.48, 1.62, 1.8, W2);
  SQ(M, S, 0.84, 1.8, 4.9, W);
  panel(D, 1.2, 1.9, { M, p: [0, 2.4, 0.852], ...uvOf('tablet') });
  bx(S, M, -0.74, 0.74, 4.42, 4.52, 0.8, 0.9, { c: W2, noao: true });
  for (const x of [-1.02, 1.02]) for (const z of [-1.02, 1.02]) {
    SQ(M, S, 0.24, 1.8, 2.04, W2, x, z);
    turned(at(M, x, 0, z), [[0.19, 2.04], [0.15, 4.5], [0.25, 4.86], [0.001, 4.9]], 7, WH);
  }
  SQ(M, S, 1.24, 4.9, 5.3, W); SQ(M, S, 1.34, 5.3, 5.42, W2); SQ(M, S, 1.48, 5.42, 5.6, W); SQ(M, S, 1.08, 5.6, 5.76, W3);
  for (const x of [-1.16, 1.16]) for (const z of [-1.16, 1.16]) turned(at(M, x, 5.6, z), [[0.14, 0], [0.07, 0.16], [0.24, 0.42], [0.09, 0.58], [0.12, 0.66], [0.02, 0.9]], 6, WH);
  taper(M, 0, 0, 5.76, 6.2, 0.98, 0.7, 0.68, 0.52, W); taper(M, 0, 0, 6.2, 6.76, 0.68, 0.52, 0.48, 0.42, W); SQ(M, S, 0.66, 6.76, 6.9, W2, 0, 0, 0.56);
  for (const s of [-1, 1]) { ring(M, [s * 0.82, 6.02, 0.5], 0.2, 0.09, WH); ring(M, [s * 0.82, 6.02, -0.5], 0.2, 0.09, WH); chain(M, [[s * 0.82, 6.2, 0.5], [s * 0.56, 6.45, 0.45], [s * 0.54, 6.76, 0.4]], 0.11, 0.08, W2); }
  bx(S, M, -0.4, 0.4, 5.9, 6.55, 0.5, 0.6, { c: WH, noao: true });
  // the plague: a body flung along the front under her feet
  blob(M, [0.02, 7.07, 0.2], [0.55, 0.2, 0.34], '#d3cebf', 1, 0, 0.1);
  blob(M, [0.66, 7.1, 0.36], [0.17, 0.17, 0.17], W2); chain(M, [[0.5, 7.12, 0.3], [0.75, 6.98, 0.52], [0.62, 6.92, 0.62]], 0.09, 0.05, WH);
  chain(M, [[-0.4, 7.04, 0.25], [-0.76, 7.12, 0.4], [-0.82, 6.9, 0.5]], 0.15, 0.07, W2);
  const h = 2.3, F = at(M, 0, 7.16, -0.04);
  figure(F, h, WH, { arms: [[[-0.27, 0.76, 0.05], [-0.25, 0.94, 0.14]], [[0.22, 0.57, 0.04], [0.3, 0.47, 0.16]]] });
  drape(F, [[0.06, 0.2], [0.44, 0.35], [0.4, 1.0], [0.3, 1.6], [0.1, 1.2]], -0.2, 0.14, '#d6d1c2');
  ring(F, [0.025, 2.09, 0.02], 0.14, 0.05, W2, { rx: PI / 2 - 0.15 });
  bx(S, F, -0.6, -0.55, 2.12, 2.82, 0.3, 0.35, { c: IR, noao: true }); bx(S, F, -0.74, -0.41, 2.6, 2.65, 0.3, 0.35, { c: IR, noao: true });
  // the bed inside the railing and the railing itself
  const r = RNG(5301);
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    rail(at(K, 0, 0.16, 2.9), 5.8, 1.15);
    for (const x of [-2.9, 0]) bx(S, K, x - 0.05, x + 0.05, -drop, 1.42, 2.85, 2.95, { c: IR, noao: true });
    for (let i = 0; i < 3; i++) { const x = -1.8 + i * 1.8, s = 0.24 + r() * 0.12; blob(K, [x, 0.22 + s * 0.5, 2.46], [s * 1.5, s, s * 0.9], r() < 0.3 ? '#a58f2c' : '#3f5c2b', 0, r(), r()); }
  }
  return end('Statua di Santa Rosalia al piano della Cattedrale');
}

// ====================================================================================================
// The Genius of Palermo in Piazza Rivoluzione: a pale step ring, the bellied iron railing on it, a round marble basin on a short foot, a heap of dark rock hung with green, and on top the old crowned
// king sitting, the serpent at his breast. Facing east south east
// ====================================================================================================
const GE = { O: [463.4, 176.0], N: unit(0.85, 0.53) };
function buildGenio() {
  define(); const { M, drop } = open(GE, 3.1), W = '#d8d3c4', W2 = '#bfb9a8', C = '#e4decb', C2 = '#cfc7b0';
  turned(M, [[3.05, -drop], [3.05, 0.12], [2.94, 0.18], [2.88, 0.4], [2.74, 0.45], [0.001, 0.45]], 18, '#cfcabb');
  turned(M, [[1.35, 0.45], [1.2, 0.6], [1.12, 0.72], [1.5, 0.84], [1.9, 1.02], [2.02, 1.18], [2.0, 1.28], [2.14, 1.34], [2.14, 1.44], [1.94, 1.44], [1.86, 1.28]], 16, W);
  water(M, 1.9, 1.33, '#587069', 16);
  rocks(M, 5401, 22, 1.5, 1.3, 3.05, 0.48, ['#4a4439', '#3c3a30', '#47592c', '#5a5345', '#5c7433']);
  // the iron railing: sixteen flat sides on the ring
  const N = 16, R = 2.72, side = 2 * R * Math.sin(PI / N), [ix, iy, iw, ih] = RG.iron;
  for (let k = 0; k < N; k++) {
    const a = (k + 0.5) * 2 * PI / N, ap = R * Math.cos(PI / N), m = at(M, Math.sin(a) * ap, 0.45, Math.cos(a) * ap, a);
    panel(D, side, 1.22, { M: m, uvk: [(iw / 2 - 1) / AT, (ih - 1) / AT], uvo: [(ix + (k % 2) * iw / 2 + 0.5) / AT, 1 - (iy + ih - 0.5) / AT] });
  }
  // the king
  const F = at(M, 0, 2.95, 0.02, 0, 1.08);
  blob(F, [0, 0.2, -0.22], [0.36, 0.3, 0.3], '#4a4439');
  blob(F, [0, 0.47, -0.08], [0.25, 0.17, 0.2], C2, 1);
  for (const s of [-1, 1]) { chain(F, [[s * 0.14, 0.47, -0.04], [s * 0.26, 0.54, 0.33]], 0.14, 0.095, C, 6); chain(F, [[s * 0.26, 0.54, 0.33], [s * 0.22, 0.06, 0.38]], 0.095, 0.055, C, 6); blob(F, [s * 0.22, 0.04, 0.45], [0.07, 0.05, 0.12], C); }
  limb(F, [0, 0.46, -0.1], [0, 0.98, -0.04], 0.18, 0.23, C, 8); blob(F, [0, 0.96, -0.04], [0.31, 0.15, 0.18], C, 1);
  limb(F, [0, 1.0, -0.03], [-0.02, 1.16, 0.02], 0.085, 0.075, C, 5);
  blob(F, [-0.03, 1.25, 0.03], [0.13, 0.15, 0.135], C, 1);
  blob(F, [-0.05, 1.14, 0.14], [0.11, 0.14, 0.08], C2, 1, -0.25); blob(F, [-0.03, 1.27, -0.05], [0.16, 0.15, 0.12], C2);
  turned(at(F, -0.03, 1.34, 0.01), [[0.12, 0], [0.145, 0.09], [0.11, 0.07], [0.001, 0.1]], 8, W2);
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; limb(F, [-0.03 + Math.cos(a) * 0.125, 1.41, 0.01 + Math.sin(a) * 0.125], [-0.03 + Math.cos(a) * 0.16, 1.51, 0.01 + Math.sin(a) * 0.16], 0.03, 0.003, W2, 3); }
  chain(F, [[-0.28, 0.99, -0.03], [-0.4, 0.72, 0.04], [-0.08, 0.8, 0.22]], 0.095, 0.05, C);
  chain(F, [[0.28, 0.99, -0.03], [0.38, 0.66, 0.04], [0.04, 0.62, 0.26]], 0.095, 0.05, C);
  chain(F, [[0.02, 0.92, 0.23], [-0.14, 0.78, 0.3], [0.12, 0.62, 0.34], [0.3, 0.46, 0.3], [0.1, 0.3, 0.42], [-0.2, 0.22, 0.4], [-0.28, 0.07, 0.24], [0.06, 0.05, 0.3], [0.42, 0.12, 0.16]], 0.07, 0.035, '#d9d2bd');
  blob(F, [0.02, 0.95, 0.24], [0.06, 0.05, 0.09], '#d9d2bd');
  drape(F, [[-0.34, 1.04], [0.34, 1.04], [0.44, 0.5], [0.4, 0.08], [-0.2, 0.2], [-0.4, 0.62]], -0.32, 0.12, C2);
  return end('Genio di Palermo');
}

// ====================================================================================================
// The Fontana del Garraffo: a lobed white pavement, three lobed steps, the lobed basin, four dolphins carrying two tiers of shell bowls round a stem, a knot of dolphins, the eagle with its wings
// spread and on it the standing figure with her right arm raised. Facing north north west, to the Cassaro
// ====================================================================================================
const GA = { O: [543.0, -247.6], N: unit(-0.55, -0.83) };
function buildGarraffo() {
  const { M, drop } = open(GA, 4.0), W = '#e0dbce', W2 = '#c8c2b1', W3 = '#aaa392', WH = '#ebe7dc';
  block(M, lobed(4.7), -drop, 0.23, '#cbc7ba');
  [3.25, 2.93, 2.62].forEach((r, i) => block(M, lobed(r), 0.23 + i * 0.22, 0.45 + i * 0.22, i % 2 ? W2 : W));
  block(M, lobed(2.2), 0.89, 1.02, W2); block(M, lobed(2.08), 1.02, 1.55, W); block(M, lobed(2.27), 1.55, 1.74, WH); block(M, lobed(2.0), 1.74, 1.755, '#6b7f77');
  turned(M, [[0.62, 1.75], [0.46, 2.0], [0.3, 2.35], [0.4, 2.6], [0.24, 2.9], [0.33, 3.15], [0.18, 3.45], [0.26, 3.7], [0.14, 4.1], [0.001, 4.3]], 6, W2);
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2)), Q = mul(M, rotY(PI / 4 + k * PI / 2));
    SQ(K, S, 0.24, 1.75, 2.02, W3, 0, 1.12);
    chain(K, [[0, 2.62, 0.82], [0, 2.4, 0.98], [0, 2.1, 1.3], [0, 2.04, 1.12]], 0.11, 0.19, W);
    blob(K, [0, 2.12, 1.34], [0.18, 0.15, 0.16], WH);
    turned(at(K, 0, 0, 1.18), [[0.001, 2.55], [0.12, 2.58], [0.48, 2.77], [0.6, 2.98], [0.52, 2.96], [0.001, 2.86]], 8, WH);
    chain(Q, [[0, 1.8, 0.78], [0, 2.35, 0.6], [0, 2.75, 0.3]], 0.17, 0.09, W3);
    turned(at(K, 0, 0, 0.74), [[0.001, 3.28], [0.1, 3.3], [0.37, 3.45], [0.46, 3.62], [0.4, 3.6], [0.001, 3.52]], 7, WH);
    chain(K, [[0, 3.55, 0.28], [0, 3.35, 0.55], [0, 2.95, 0.5]], 0.09, 0.04, W2);
    chain(Q, [[0, 4.12, 0.14], [0, 3.95, 0.45], [0, 3.72, 0.48]], 0.1, 0.16, WH); blob(Q, [0, 3.72, 0.52], [0.14, 0.12, 0.13], WH);
  }
  blob(M, [0, 4.3, 0], [0.22, 0.18, 0.22], W2);
  eagle(at(M, 0, 4.36, 0.02, 0, 0.72), WH);
  drape(M, [[-0.12, 4.74], [-0.92, 5.04], [-0.82, 4.86], [-0.12, 4.56]], -0.09, 0.07, WH); drape(M, [[0.12, 4.56], [0.82, 4.86], [0.92, 5.04], [0.12, 4.74]], -0.09, 0.07, WH);
  const h = 1.55, F = at(M, 0, 5.1, -0.04);
  figure(F, h, WH, { arms: [[[-0.24, 0.84, 0.02], [-0.2, 1.05, 0.06]], [[0.22, 0.6, 0.05], [0.14, 0.52, 0.16]]] });
  drape(F, [[0.05, 0.15], [0.34, 0.28], [0.28, 0.7], [0.14, 1.08], [0.02, 0.6]], -0.14, 0.09, W2);
  limb(F, [-0.31, 1.62, 0.09], [-0.34, 1.9, 0.12], 0.03, 0.02, W2, 4);
  return end('Fontana del Garraffo');
}

// ====================================================================================================
// The fountain of the sea horse in Piazza Santo Spirito: three round steps, a wide basin with a high plain wall, in the middle a heap of rough rock, and on it the horse rearing out of the water with
// its fish tail curled behind, a young triton reclining on each side. The horse looks north north west, to the Cassaro
// ====================================================================================================
const CM = { O: [833.8, -396.0], N: unit(-0.46, -0.89) };
function buildCavallo() {
  const { M, drop } = open(CM, 6.9), ST = '#bebbb0', ST2 = '#d4d1c5', W = '#e8e3d4', W2 = '#d3cdbb';
  turned(M, [[6.9, -drop], [6.9, 0.22], [6.55, 0.22], [6.55, 0.42], [6.2, 0.42], [6.2, 0.62], [5.88, 0.62], [5.88, 1.4], [5.98, 1.42], [5.98, 1.56], [5.45, 1.56], [5.45, 1.1]], 22, ST);
  turned(M, [[5.9, 1.4], [6.0, 1.43], [6.0, 1.57], [5.43, 1.57]], 22, ST2);
  water(M, 5.46, 1.3, '#55706a', 22);
  rocks(M, 5501, 30, 3.0, 1.25, 2.9, 0.65, ['#6c6556', '#827a69', '#57534a', '#958c78']);
  const r = RNG(5502);
  for (let i = 0; i < 6; i++) blob(M, [(r() - 0.5) * 3, 2.1 + r() * 0.4, 1.0 + r() * 0.7], [0.25, 0.14, 0.2], '#566b31', 0, r(), r());
  // the horse, rearing: hindquarters sunk in the rock, chest up, the head turned a little to its left
  const H = at(M, 0, 2.65, -0.1, 0.12, 1.12);
  blob(H, [0, 0.22, -0.5], [0.4, 0.42, 0.55], W2, 1);
  limb(H, [0, 0.22, -0.48], [0, 0.72, 0.1], 0.38, 0.36, W, 9); blob(H, [0, 0.72, 0.14], [0.37, 0.42, 0.34], W, 1);
  chain(H, [[0, 0.82, 0.14], [0, 1.36, 0.38], [0.02, 1.64, 0.5]], 0.28, 0.14, W, 7);
  limb(H, [0.02, 1.67, 0.52], [0.08, 1.28, 0.9], 0.17, 0.075, W, 7); blob(H, [0.03, 1.58, 0.57], [0.15, 0.17, 0.17], W);
  for (const s of [-1, 1]) limb(H, [s * 0.09 + 0.02, 1.74, 0.48], [s * 0.14 + 0.02, 1.95, 0.46], 0.05, 0.004, W, 4);
  chain(H, [[0.02, 1.76, 0.4], [0.06, 1.46, 0.16], [0.04, 1.1, -0.06], [0.02, 0.8, -0.2]], 0.07, 0.13, W2, 4);
  chain(H, [[0.24, 0.74, 0.36], [0.34, 0.74, 0.86], [0.34, 0.36, 0.82], [0.35, 0.22, 0.9]], 0.15, 0.055, W);
  chain(H, [[-0.24, 0.66, 0.36], [-0.34, 0.38, 0.8], [-0.34, 0.08, 0.6], [-0.35, -0.04, 0.7]], 0.15, 0.055, W);
  // the fish tail rising and curling over on its left, ending in a fin
  chain(H, [[0.12, 0.2, -0.72], [0.62, 0.4, -0.82], [0.94, 0.86, -0.66], [0.84, 1.28, -0.4], [0.56, 1.28, -0.28], [0.52, 1.04, -0.28], [0.68, 0.94, -0.32]], 0.3, 0.06, W2, 7);
  drape(H, [[0.6, 0.96], [0.98, 0.66], [0.92, 0.92], [1.16, 1.0], [0.82, 1.08]], -0.4, 0.07, W);
  // the two young tritons, half lying on the rocks
  for (const s of [-1, 1]) {
    const T = at(M, s * 1.55, 2.15, 0.85 - (s > 0 ? 0.25 : 0), s * 0.35);
    blob(T, [0, 0.2, 0], [0.32, 0.26, 0.3], W2);
    limb(T, [0, 0.22, 0], [-s * 0.08, 0.74, 0.02], 0.23, 0.25, W, 7); blob(T, [-s * 0.08, 0.72, 0.02], [0.31, 0.19, 0.2], W);
    blob(T, [-s * 0.1, 1.04, 0.06], [0.19, 0.21, 0.2], W, 1); blob(T, [-s * 0.1, 1.14, -0.01], [0.22, 0.17, 0.2], W2);
    chain(T, [[0, 0.2, 0.05], [s * 0.45, 0.22, 0.38], [s * 0.85, 0.02, 0.22], [s * 1.2, 0.12, -0.1]], 0.22, 0.07, W, 6);
    chain(T, [[s * 0.18, 0.78, 0.02], [s * 0.48, 0.5, 0.18], [s * 0.62, 0.28, 0.38]], 0.115, 0.065, W);
    chain(T, [[-s * 0.34, 0.78, 0.02], [-s * 0.52, 0.82, 0.24], [-s * 0.22, 1.05, 0.2]], 0.115, 0.065, W);
  }
  return end('Fontana del Cavallo Marino');
}

// ====================================================================================================
// The fountain of the two dragons: in a half round recess off Corso Calatafimi, behind its iron railing (the map's fence), an ochre curved wall with a dark coping; an oval basin with a pine cone on a
// stem, and at its two ends, on marble blocks, a winged dragon crouching towards the other, its tail coiled behind
// ====================================================================================================
const DR = { O: [-1330.0, 707.9], N: unit(-0.453, -0.892) };
const DRZ = 1.7, DRR = 5.3;   // the centre of the recess lies this far in front of the fountain; its radius
const DRF = 2.2, DRRAIL = [-11.0, 5.6];   // the line of the map's fence in front of the fountain, and the stretch of it (local x) that the model draws instead
// the map's fence starts at the first point of DRRAIL: that stretch is cut off it, the rest stays as it was
const drFences = (list) => list.flatMap((f) => {
  if (f.k !== 'f' || !f.p || Math.hypot(f.p[0] + 1321.2, f.p[1] - 701.0) > 1) return [f];
  const cut = wpt(DR, DRRAIL[1], DRF);
  return [{ ...f, p: [cut[0], cut[1], ...f.p.slice(2)] }];
});
const drArc = (r, n = 9) => Array.from({ length: n + 1 }, (_, i) => { const a = i * PI / n; return [Math.cos(a) * r, DRZ - Math.sin(a) * r]; });
function dragon(M, c, c2, c3) {   // facing +z, crouching on y = 0
  blob(M, [0, 0.36, -0.08], [0.36, 0.36, 0.6], c, 1);
  blob(M, [0, 0.46, 0.3], [0.33, 0.4, 0.32], c);
  chain(M, [[0, 0.58, 0.38], [0, 0.88, 0.5], [0, 0.96, 0.66]], 0.22, 0.14, c, 7);
  blob(M, [0, 0.98, 0.7], [0.2, 0.18, 0.2], c2);
  limb(M, [0, 0.98, 0.76], [0, 0.9, 1.1], 0.14, 0.08, c2, 6); limb(M, [0, 0.82, 0.76], [0, 0.72, 1.0], 0.08, 0.05, c3, 5);
  for (const s of [-1, 1]) {
    blob(M, [s * 0.12, 1.06, 0.8], [0.06, 0.05, 0.06], c3); limb(M, [s * 0.12, 1.1, 0.64], [s * 0.2, 1.3, 0.46], 0.06, 0.005, c2, 4);
    chain(M, [[s * 0.26, 0.4, 0.34], [s * 0.34, 0.12, 0.48], [s * 0.32, 0.07, 0.8]], 0.13, 0.075, c2);
    blob(M, [s * 0.3, 0.22, -0.42], [0.2, 0.22, 0.3], c3);
    // the folded wing: a leaf of long feathers along the flank
    const W = mul(M, mul(tr(s * 0.38, 0, 0), rotY(-PI / 2)));
    drape(W, [[0.4, 0.5], [0.2, 0.94], [-0.18, 1.08], [-0.56, 0.9], [-0.46, 0.7], [-0.6, 0.5], [-0.1, 0.28], [0.28, 0.32]], -0.04, 0.08, c2);
    for (let i = 0; i < 3; i++) limb(M, [s * 0.44, 0.66 + i * 0.02, 0.26 - i * 0.08], [s * 0.44, 0.98 - i * 0.2, -0.36 - i * 0.07], 0.035, 0.015, c3, 3);
  }
  // the tail: up from the haunches into a coil
  const coil = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, a = -PI / 2 - t * 3.4 * PI * 0.9, rr = 0.42 * (1 - 0.8 * t); coil.push([0.04 * Math.sin(t * 4), 0.62 + Math.sin(a) * rr, -0.76 + Math.cos(a) * rr]); }
  chain(M, [[0, 0.3, -0.5], ...coil], 0.19, 0.035, c);
}
function buildDraghi() {
  const { M, drop } = open(DR, 4.5), W = '#d3d0c5', W2 = '#bcb8ab', W3 = '#a29d90', OC = '#d8ac6c', DK = '#5a4e42';
  block(M, drArc(DRR - 0.1), -drop, 0.17, '#bcb6a7');
  const A = drArc(DRR + 0.16);
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), m = at(M, (a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
    bx('plaster', m, -len / 2 - 0.06, len / 2 + 0.06, 0.45, 3.1, -0.16, 0.16, { c: OC, noao: true });
    bx(S, m, -len / 2 - 0.08, len / 2 + 0.08, -drop, 0.45, -0.2, 0.2, { c: '#9a9384', noao: true });
    bx(S, m, -len / 2 - 0.1, len / 2 + 0.1, 3.1, 3.34, -0.25, 0.25, { c: DK, noao: true });
  }
  // the iron railing along the pavement on a low stone kerb: it takes the place of this stretch of the map's fence, which would be drawn as a blank wall
  const [x0, x1] = DRRAIL, n = 7, step = (x1 - x0) / n;
  bx(S, M, x0, x1, -drop, 0.34, DRF - 0.16, DRF + 0.16, { c: '#a49d8e', noao: true });
  for (let i = 0; i < n; i++) rail(at(M, x0 + (i + 0.5) * step, 0.34, DRF), step, 1.95);
  for (let i = 0; i <= n; i++) bx(S, M, x0 + i * step - 0.05, x0 + i * step + 0.05, 0.34, 2.42, DRF - 0.05, DRF + 0.05, { c: '#26282a', noao: true });
  for (const s of [-1, 1]) bx('plaster', M, s * (DRR + 0.16) - 0.16, s * (DRR + 0.16) + 0.16, -drop, 3.1, DRZ - 0.1, DRF - 0.1, { c: OC, noao: true });
  const oval = [1, 1, 0.62];
  turned(M, [[2.42, 0.17], [2.42, 0.34], [2.1, 0.36], [0.001, 0.36]], 16, W2, { s: [1, 1, 0.66] });
  turned(M, [[1.74, 0.36], [1.68, 0.48], [1.96, 0.62], [2.14, 0.84], [2.16, 0.96], [2.26, 1.0], [2.26, 1.1], [2.02, 1.1], [1.96, 0.94]], 16, W, { s: oval });
  water(M, 2.0, 0.99, '#5a6d62', 16, 0.62);
  turned(M, [[0.42, 0.95], [0.42, 1.14], [0.2, 1.2], [0.14, 1.42], [0.24, 1.48], [0.2, 1.56], [0.31, 1.76], [0.28, 1.96], [0.14, 2.14], [0.001, 2.22]], 9, '#c9c3ae');
  for (const s of [-1, 1]) {
    const P = at(M, s * 3.08, 0, 0);
    bx(S, P, -0.92, 0.92, 0.17, 0.34, -0.6, 0.6, { c: W3, noao: true }); bx(S, P, -0.84, 0.84, 0.34, 0.92, -0.52, 0.52, { c: W2, noao: true }); bx(S, P, -0.94, 0.94, 0.92, 1.06, -0.62, 0.62, { c: W, noao: true });
    dragon(at(M, s * 3.0, 1.06, 0, -s * PI / 2), W, '#c4c0b3', W3);
    chain(M, [[s * 1.92, 1.82, 0], [s * 1.45, 1.72, 0], [s * 1.05, 1.4, 0], [s * 0.85, 1.02, 0]], 0.025, 0.015, '#cfe0e2', 3);
  }
  return end('Fontana dei Due Draghi');
}

// ====================================================================================================
// Santa Rosalia on the belvedere of Monte Pellegrino: three steps against a low white bench wall, a tall pillar of white slabs set at different heights, a flaring neck and a round dish, and on it the
// bronze saint in her hooded habit with a long staff in her left hand; bare rock behind
// ====================================================================================================
const BE = { O: [-9.0, -6603.7], N: unit(0.97, -0.24) };
function buildBelvedere() {
  const { M, y, drop } = level(BE, 4.5, 0.05), W = '#e6e3da', W2 = '#d3cfc4', W3 = '#bfbbb0', B = '#333d36', B2 = '#262e29';
  bx(S, M, -2.65, 2.65, -drop, 0.28, -0.5, 2.0, { c: W2, noao: true }); bx(S, M, -2.28, 2.28, 0.28, 0.55, -0.5, 1.62, { c: W, noao: true }); bx(S, M, -1.9, 1.9, 0.55, 0.82, -0.5, 1.24, { c: W2, noao: true });
  bx(S, M, -3.15, 3.15, -drop, 1.2, -1.0, -0.45, { c: W3, noao: true }); bx(S, M, -3.2, 3.2, 1.2, 1.3, -1.05, -0.4, { c: W, noao: true });
  const z = 0.05;
  SQ(M, S, 0.66, 0.82, 1.78, W2, 0, z, 0.52); bx(S, M, -1.5, 1.55, 1.78, 2.05, -0.62, 0.72, { c: W, noao: true });
  SQ(M, S, 0.38, 2.05, 6.42, W3, 0, z, 0.34);
  for (const [x0, x1, y0, y1, d0, d1, c] of [[-0.56, 0.16, 2.2, 4.0, -0.3, 0.55, W], [0.18, 0.6, 2.35, 4.95, -0.48, 0.44, W2], [-0.58, -0.22, 4.04, 6.42, -0.42, 0.46, W], [-0.2, 0.55, 4.96, 5.95, -0.36, 0.53, W2], [-0.18, 0.5, 4.02, 4.9, -0.5, 0.36, W]]) bx(S, M, x0, x1, y0, y1, z + d0, z + d1, { c, noao: true });
  turned(at(M, 0, 0, z), [[0.24, 6.42], [0.2, 6.6], [0.4, 7.2], [0.68, 7.42], [0.7, 7.66], [0.56, 7.74], [0.001, 7.74]], 10, W);
  turned(at(M, 0, 0, z), [[0.46, 7.74], [0.44, 7.9], [0.001, 7.9]], 10, B2);
  const h = 2.55, F = at(M, 0, 7.9, z);
  figure(F, h, B, { arms: [[[-0.2, 0.55, 0.02], [-0.19, 0.43, 0.08]], [[0.23, 0.62, 0.05], [0.24, 0.68, 0.15]]] });
  blob(F, [0.025, 2.26, -0.02], [0.23, 0.24, 0.2], B2, 1);                                                       // the hood
  blob(F, [0.025, 2.22, 0.14], [0.11, 0.13, 0.08], '#3d4a40');
  drape(F, [[-0.46, 1.86], [0.46, 1.86], [0.52, 0.85], [0.34, 0.1], [-0.34, 0.1], [-0.52, 0.85]], -0.24, 0.14, B2);
  limb(F, [0.62, 0.02, 0.4], [0.62, 3.05, 0.4], 0.028, 0.022, '#9aa0a2', 5);
  const R = RNG(5601);
  for (const [x, up, zz, s] of [[-3.7, 0.4, -1.8, 1.05], [-2.2, 0.3, -2.4, 0.8], [-0.4, 0.25, -2.2, 0.65], [1.5, 0.4, -2.35, 0.85], [3.4, 0.6, -1.9, 1.2], [4.0, 0.2, -0.6, 0.65]]) {
    const p = wpt(BE, x, zz), g = groundY(p[0], p[1]) - y;
    blob(M, [x, g + up, zz], [s * 1.15, s * (0.8 + R() * 0.35), s * 0.85], R() < 0.5 ? '#b1ab9d' : '#c4beb0', 1, R() * 0.7 - 0.35, R() * 0.7 - 0.35);
  }
  return end('Santa Rosalia al Belvedere di Monte Pellegrino');
}

// ====================================================================================================
// The fountain of the Triton in the square beside the Duomo of Monreale: a step ring, a wide low round basin, a heap of dark rock with a coiling sea beast, and the white triton standing on it with
// his right arm stretched out. Facing north
// ====================================================================================================
const TR = { O: [-6076.8, 3684.8], N: [0, -1] };
function buildTritone() {
  const { M, drop } = level(TR, 3.9, 0.7), ST = '#b4b1a8', ST2 = '#c9c6bc', DK = '#44433d', DK2 = '#595750', W = '#e0dccd', W2 = '#cac5b4';
  turned(M, [[4.3, -drop], [4.3, -0.5], [4.0, -0.45], [0.001, -0.45]], 20, '#9d998e');
  turned(M, [[3.9, -drop], [3.9, 0.24], [3.78, 0.3], [3.36, 0.3], [3.3, 0.42], [3.34, 0.72], [3.5, 0.82], [3.5, 0.94], [3.1, 0.96], [3.02, 0.72]], 20, ST);
  turned(M, [[3.36, 0.74], [3.52, 0.83], [3.52, 0.95], [3.08, 0.97]], 20, ST2);
  water(M, 3.05, 0.8, '#6d8254', 20);
  rocks(M, 5701, 16, 1.45, 0.76, 1.85, 0.42, [DK, DK2, '#4d4a3e']);
  // the beast: two thick coils climbing the rock, heads over the water
  const coil = [];
  for (let i = 0; i <= 13; i++) { const t = i / 13, a = t * 3.6 * PI, rr = 0.95 * (1 - t * 0.75); coil.push([Math.cos(a) * rr, 1.05 + t * 1.55, Math.sin(a) * rr]); }
  chain(M, coil, 0.24, 0.12, DK, 5);
  for (const s of [-1, 1]) { chain(M, [[s * 0.5, 1.7, 0.2], [s * 0.95, 1.65, 0.65], [s * 1.2, 1.3, 0.85]], 0.2, 0.14, DK2, 6); blob(M, [s * 1.25, 1.24, 0.9], [0.2, 0.15, 0.24], DK); drape(M, [[s * 0.5, 1.6], [s * 1.25, 2.1], [s * 1.05, 1.7], [s * 1.4, 1.55], [s * 0.8, 1.35]], -0.2, 0.08, DK2); }
  const h = 1.95, F = at(M, 0, 2.3, 0, -0.15);
  figure(F, h, W, { robe: false, arms: [[[-0.3, 0.74, 0.04], [-0.46, 0.8, 0.14]], [[0.2, 0.57, -0.02], [0.14, 0.45, 0.1]]] });
  blob(F, [0.02, 1.3, 0.02], [0.3, 0.26, 0.2], W, 1); blob(F, [0.02, 0.94, 0], [0.24, 0.22, 0.19], W2, 1); blob(F, [0.02, 1.76, -0.03], [0.17, 0.15, 0.16], W2);
  for (const s of [-1, 1]) chain(F, [[s * 0.1, 0.9, 0], [s * 0.2, 0.5, 0.2], [s * 0.14, 0.05, 0.08]], 0.17, 0.08, W, 6);
  drape(F, [[-0.24, 0.92], [0.2, 0.98], [0.34, 0.5], [0.12, 0.16], [0.04, 0.8]], -0.24, 0.1, W2);
  limb(F, [-0.9, 1.56, 0.27], [-1.1, 1.62, 0.32], 0.07, 0.03, W2, 5);
  return end('Fontana del Tritone (Monreale)');
}

// ====================================================================================================
// No tree or bollard within these circles [x, z, radius]: it would stand in a model or hide it. Round the sea horse the photos show palms and open lawn, not the broad trees the map put there.
TREE_CLEAR.push([RO.O[0], RO.O[1], 5], [GE.O[0], GE.O[1], 4], [GA.O[0], GA.O[1], 5.2], [CM.O[0], CM.O[1], 14], [DR.O[0], DR.O[1], 6], [BE.O[0], BE.O[1], 5], [TR.O[0], TR.O[1], 5]);

const spec = (name, Q, build, walls, more = {}) => ({ name, x: Q.O[0], z: Q.O[1], radius: 20, skipIds: [], build, walls, ...more });
export const R2_M2 = [
  spec('Statua di Santa Rosalia al piano della Cattedrale', RO, buildRosalia, siteRect(RO, -2.95, 2.95, -2.95, 2.95)),
  spec('Genio di Palermo', GE, buildGenio, siteSegs(GE, circle(3.0, 14))),
  spec('Fontana del Garraffo', GA, buildGarraffo, siteSegs(GA, circle(3.2, 14))),
  spec('Fontana del Cavallo Marino', CM, buildCavallo, siteSegs(CM, circle(6.85, 22))),
  // the curved wall (both ends open onto the map's railing) and the fountain between the two blocks
  spec('Fontana dei Due Draghi', DR, buildDraghi, [...siteSegs(DR, drArc(DRR + 0.16)).slice(0, -1), ...siteRect(DR, -4.05, 4.05, -1.4, 1.4), siteSegs(DR, [[DRRAIL[0], DRF], [DRRAIL[1], DRF]])[0]], { clearFences: drFences }),
  spec('Santa Rosalia al Belvedere di Monte Pellegrino', BE, buildBelvedere, siteRect(BE, -3.2, 3.2, -2.4, 2.0)),
  spec('Fontana del Tritone (Monreale)', TR, buildTritone, siteSegs(TR, circle(4.28, 14))),
];
