// City landmarks, batch P (four churches). Registered through BATCH_P in src/landmarks-city.js.
// Only Sant'Agata la Pedata could be drawn from photos of its own exterior. San Michele Arcangelo (w97225599), Maria Santissima Mediatrice (w48849513) and San Raffaele Arcangelo (w81132103)
// have no usable exterior photo on Wikimedia Commons or Wikipedia (the Commons category "San Michele Arcangelo (Palermo)" shows the former church beside Casa Professa, a different building in the old centre,
// while the footprint w97225599 stands at the Commons coordinates 38.134 N, 13.342 E far to the north-west). Nothing is drawn for those three, the lead leaves them generic.
//
// Sant'Agata la Pedata (Via Giuseppe Patricolo / Via Maggiore Francesco Perni, beside Porta Sant'Agata). Replaces the OSM footprint w81202236.
// Frame F: origin on the ground in the middle of the 17.6 m front, +z out of the front (west, onto the narrow street), local x along the front (towards the south, to the right when facing the front).
// Front decided from the photos: the viewer stands at the south-west corner, the front is on the left and the long side wall runs away to the right; the footprint's west edge (17.6 m) is that front.
// Reference photos (Wikimedia Commons, looked at, nothing copied): Sant'Agata la Pedata - Facciata.jpg; SAP (PA) 17 07 2019 02.jpg; SAP (PA) 17 07 2019 04.jpg.
// Read from them: a flat plastered front in pale peach-cream with white framed openings, in two parts. A lower left wing (about 40 % of the width) with a high framed barred window with an iron balcony,
// a shuttered window, and two small low windows. The taller nave front (a gable with a thin cornice rising each side) with a central door in a moulded surround under a small cornice, a framed barred window above it
// and a round oculus with a white ring in the gable. Narrow low part at the right end. A stone plinth on the street. Set back on the ridge: a small bell tower, square, plastered, three round-arched openings
// with bells on the front, a low triangular pediment on top with a cross. Long plain side wall, a row of square windows high up, one low annexe block with an iron gate on the south side.
// Heights relative to the front width (17.6 m): wing eave about 0.40, nave eave about 0.52, gable apex about 0.66. Not known and not drawn: the roof (tiles are assumed, hidden behind the gable), the interior.
import * as THREE from 'three';
import { PI, bx, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

const SA = { id: 'w81202236', p: [40.5, 850.8, 41.2, 868.4, 65.1, 865.5, 64.4, 862.7, 71.7, 863.8, 68.6, 848] };
const N = [-0.9992, 0.0397], O = [40.85, 859.6];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 17.6, LOW = 7.0, NE = 9.2, RISE = 2.4, FH = NE + RISE, NX0 = -1.6, NX1 = 6.0, NXC = (NX0 + NX1) / 2, NZ1 = -20;
const PLAS = '#e3c8a0', WHITE = '#efe6d4', PLINTH = '#8c8982', DARK = '#1c1815', IRON = '#272b2f';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const bars = (x0, y0, x1, y1) => { for (let x = x0 + 0.25; x < x1; x += 0.3) R(x, y0, x + 0.04, y1, '#5c5f63'); for (let y = y0 + 0.3; y < y1; y += 0.45) R(x0, y, x1, y + 0.04, '#5c5f63'); };
  g.fillStyle = PLAS; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 8101, ['rgba(160,110,70,0.10)', 'rgba(255,240,215,0.10)', 'rgba(120,85,55,0.07)']);
  for (let i = 0; i < 6; i++) { const cx = X(-7 + i * 2.9), cy = Y(2 + (i % 3) * 4), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 3.4 * sx); gr.addColorStop(0, 'rgba(170,115,70,0.16)'); gr.addColorStop(1, 'rgba(170,115,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, PLINTH); R(-FW / 2, 0.9, FW / 2, 1.0, 'rgba(60,40,25,0.3)');
  R(-FW / 2, LOW - 0.35, NX0, LOW, WHITE); R(NX1, LOW - 0.35, FW / 2, LOW, WHITE);
  // lower left wing: two small low windows, a shuttered window, a high barred window with an iron balcony
  for (const x of [-7.4, -4.6]) { R(x - 0.55, 1.5, x + 0.55, 3.4, WHITE); R(x - 0.4, 1.65, x + 0.4, 3.25, DARK); }
  R(-5.0 - 0.8, 4.3, -5.0 + 0.8, 6.5, WHITE); R(-5.0 - 0.6, 4.5, -5.0 + 0.6, 6.3, '#6e5a3e'); for (let y = 4.65; y < 6.3; y += 0.22) R(-5.6, y, -4.4, y + 0.05, 'rgba(0,0,0,0.3)');
  R(-8.1 - 0.7, 4.0, -8.1 + 0.7, 6.6, WHITE); R(-8.1 - 0.5, 4.2, -8.1 + 0.5, 6.4, '#5d4b34'); R(-8.8, 3.6, -7.0, 3.9, IRON);
  // nave front: the door in a moulded surround with a small cornice, the barred window, the oculus
  R(NXC - 1.25, 0.9, NXC + 1.25, 4.5, WHITE); R(NXC - 0.9, 0.9, NXC + 0.9, 4.1, DARK); R(NXC - 1.6, 4.5, NXC + 1.6, 4.85, WHITE); R(NXC - 1.5, 4.4, NXC + 1.5, 4.5, 'rgba(60,40,25,0.4)');
  R(NXC - 1.0, 5.7, NXC + 1.0, 8.2, WHITE); R(NXC - 0.8, 5.9, NXC + 0.8, 8.0, DARK); bars(NXC - 0.8, 5.9, NXC + 0.8, 8.0);
  g.fillStyle = WHITE; g.beginPath(); g.arc(X(NXC - 0.4), Y(10.2), 0.62 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#c9a07c'; g.beginPath(); g.arc(X(NXC - 0.4), Y(10.2), 0.42 * sx, 0, 2 * PI); g.fill();
  // the right end: a low narrow window
  R(7.2 - 0.5, 1.5, 7.2 + 0.5, 3.4, WHITE); R(7.2 - 0.35, 1.65, 7.2 + 0.35, 3.25, DARK);
  // the thin cornice along the gable slopes
  g.strokeStyle = WHITE; g.lineWidth = 0.35 * sx; g.beginPath(); g.moveTo(X(NX0), Y(NE + 0.1)); g.lineTo(X(NXC), Y(FH - 0.1)); g.lineTo(X(NX1), Y(NE + 0.1)); g.stroke();
  R(NX0, NE - 0.05, NX1, NE + 0.2, WHITE);
  streaks(g, w, h, 34, 8102, 0.11, 100, '90,65,45');
  const gb = g.createLinearGradient(0, Y(0.9), 0, Y(3.4)); gb.addColorStop(0, 'rgba(50,35,22,0.3)'); gb.addColorStop(1, 'rgba(50,35,22,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.4), w, 2.5 * sy);
}
function paintBody(g, w, h) {   // side wall, 4.5 m bay, LOW high: peach plaster, grey plinth, grime, one barred window low
  const sx = w / 4.5, sy = h / LOW, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#e0c39a'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 8111, ['rgba(160,110,70,0.10)', 'rgba(255,240,215,0.09)']);
  R(0, 0, 4.5, 0.9, PLINTH); R(1.7, 4.2, 2.8, 5.8, WHITE); R(1.85, 4.35, 2.65, 5.65, DARK);
  streaks(g, w, h, 8, 8115, 0.12, 80, '90,65,45');
}
function paintNave(g, w, h) {   // upper nave wall, 4.5 m bay, 2.2 high: a square window with a white frame
  const sx = w / 4.5, sy = h / (NE - LOW), X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#e5ccaa'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 60, 2, 8121, ['rgba(160,110,70,0.10)', 'rgba(255,240,215,0.09)']);
  R(1.45, 0.55, 3.05, 1.95, WHITE); R(1.6, 0.7, 2.9, 1.8, DARK);
  streaks(g, w, h, 5, 8125, 0.12, 60, '90,65,45');
}

function buildSantAgata() {
  initShared();
  const pts = pairsOf(SA.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-6, 1)), groundY(...W(6, 1)), groundY(...W(0, 2)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bpSAFront', 384, 256, [FW, FH], paintFront);
  defMat('bpSABody', 128, 192, [4.5, LOW], paintBody);
  defMat('bpSANave', 128, 64, [4.5, NE - LOW], paintNave);
  begin(y0);
  const body = clipFront(pts, -0.1);
  prism('bpSABody', body, Math.min(gr.lo, y0) - 1.5, y0 + LOW, { uvo: [0, -y0 / LOW] });
  prism('flat', body, y0 + LOW, y0 + LOW + 0.12, { c: '#a39a8c' });
  bx('bpSANave', F, NX0, NX1, LOW, NE, -0.1, NZ1, { uvo: [0, -(y0 + LOW) / (NE - LOW)] });
  gable('tile', 'bpSANave', at(NXC, 0, (-0.1 + NZ1) / 2), NX1 - NX0, -0.1 - NZ1, NE, RISE, { ov: 0.3, c: '#b8744f', wc: '#e5ccaa' });
  const hw = FW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, LOW); s.lineTo(NX1, LOW); s.lineTo(NX1, NE); s.lineTo(NXC, FH); s.lineTo(NX0, NE); s.lineTo(NX0, LOW); s.lineTo(-hw, LOW); s.lineTo(-hw, 0);
  extrude('bpSAFront', s, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, NX0 - 0.1, NX1 + 0.1, NE - 0.05, NE + 0.2, -1.05, 0.25, { c: '#efe6d4', noao: true });
  // the door's cornice and the plinth step stand a little out of the front
  bx('stone', F, NXC - 1.6, NXC + 1.6, 4.5, 4.85, -0.05, 0.3, { c: '#e6dcc6' });
  bx('stone', F, NXC - 1.4, NXC + 1.4, 0, 0.12, -0.05, 0.5, { c: '#9a968c' });
  // the bell tower on the ridge, set back, three arched openings on the front and back, a pedimented cap
  const TW = 2.6, TZ0 = -4.6, TZ1 = TZ0 - TW, TB = NE + 0.9, TT = FH + 3.4;
  bx('bpSANave', F, NXC - TW / 2, NXC + TW / 2, TB, TT, TZ1, TZ0, { uvo: [0, 0] });
  for (const zz of [TZ0 + 0.03, TZ1 - 0.03]) for (const k of [-1, 0, 1]) { bx('dark', F, NXC + k * 0.78 - 0.26, NXC + k * 0.78 + 0.26, TT - 2.0, TT - 0.5, zz, zz, { c: '#1c1815', noao: true }); }
  gable('tile', 'bpSANave', at(NXC, 0, (TZ0 + TZ1) / 2), TW + 0.4, TW + 0.2, TT, 0.9, { ov: 0.1, c: '#b8744f', wc: '#e5ccaa' });
  bx('flat', F, NXC - 0.04, NXC + 0.04, TT + 0.9, TT + 1.7, (TZ0 + TZ1) / 2 - 0.04, (TZ0 + TZ1) / 2 + 0.04, { c: '#3e3a36', noao: true });
  const o = end("Chiesa di Sant'Agata la Pedata");
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SA.p, null, y0 + LOW], [ring(NX0, NX1, NZ1, -0.1), null, y0 + FH]];
  return o;
}
export const BATCH_P = [
  { name: "Chiesa di Sant'Agata la Pedata", x: 56, z: 858, radius: 40, skipIds: [SA.id], build: buildSantAgata },
];
