// City landmark: the Basilica di San Francesco d'Assisi (Piazza San Francesco, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49769037 (a lidar-extruded block): the medieval front with its pointed portal and rose window, the nave under a gable roof, the body behind.
// Frame F: origin on the ground in the middle of the west front, +z out of the front onto the piazza (west-north-west), local x runs along the front.
// Measured from the footprint: the front is 22.8 m wide, the body runs 53 m back (apex of the front 17 m, the OSM roof is 17.6 m above the 9 m ground).
// Read from Wikimedia Commons photos: "San Francesco d'Assisi (Palermo) - Exterior 02.jpg" (whole front from the piazza), "Portal s francesco palermo.JPG" (portal), "San Francesco d'Assisi - Palermo.jpg" (nave inside, open timber roof).
// From those: one plain front of honey-coloured sandstone ashlar, NO tower and no buttress strips; the outline is a gable (steep over the nave, flatter over the aisles) with a small cross at the apex and a light rake cornice;
// a big round rose window (carved ring) high in the middle; below it the Gothic portal, pointed, in layered arch rings carved with zigzag, on colonettes, door of dark timber; over the portal a small gable of three blind arches;
// a plain rectangular door with a lintel in each side bay, about 3.5 m tall. Front about 22.8 m wide and 17 m to the apex.
// Not known and not drawn: the exact rose tracery and portal carving, the apse and chapel roofs (flat here), the aisle doors' lintel carving.
import * as THREE from 'three';
import { PI, bx, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

const SF = { id: 'w49769037', p: [453.2, -97.9, 500.7, -122.6, 505.3, -117.4, 516.7, -123.5, 522.5, -114.5, 520.6, -107.1, 513.8, -103.4, 516.5, -95.9, 492.8, -85.4, 490.2, -90.7, 487.1, -88.7, 489.3, -83.7, 482.1, -80.7, 477, -79.9, 474.5, -82.5, 463.6, -77.6] };
const O = [458.4, -87.75], N = [-0.890, 0.456];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {   // the footprint cut off where it stands out in front of the front (Sutherland-Hodgman against z = zmax, keeping z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 22.8, FH = 17.4, EAVE = 11.4, NAVE_TOP = 14.2, NW = 5.6, NZ0 = -53, NZ1 = -0.7;
const PROF = [[-11.4, 11.6], [-5.0, 14.6], [0, 17.2], [5.0, 14.6], [11.4, 11.6]];   // the gable outline of the front
const DARK = '#1c1713', GLASS = '#232b35', STONE = '#cdb78d', TRIM = '#dccaa0', SHADE = '#a8946e';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const pointed = (x, y0, y1, ww, c) => {   // a pointed (Gothic) arch, y1 is the apex
    const r = ww / 2, spring = y1 - r * 1.15; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(spring));
    g.quadraticCurveTo(X(x - r), Y(spring + r * 0.9), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(spring + r * 0.9), X(x + r), Y(spring)); g.lineTo(X(x + r), Y(y0)); g.fill();
  };
  paintAshlar(g, w, h, FW, FH, 0.45, 1.2, STONE, SHADE, 4201, 1.0, 0.06);
  for (let i = 0; i < 6; i++) { const cx = X(-9 + i * 3.6), cy = Y(3 + (i % 3) * 4), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4.5 * sx); gr.addColorStop(0, 'rgba(120,95,60,0.16)'); gr.addColorStop(1, 'rgba(120,95,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.5, '#b8a47c');                                                        // plinth
  // the portal: layered pointed arch rings (the carved zigzag read as alternating light and dark bands), colonettes at the jambs, a dark timber door
  const ring = [[7.2, 8.1, TRIM], [6.7, 7.8, '#b5a27a'], [6.2, 7.5, TRIM], [5.7, 7.2, '#b5a27a'], [5.2, 6.9, TRIM], [4.7, 6.6, '#b5a27a'], [4.2, 6.3, TRIM]];
  for (const [ww, ap, c] of ring) pointed(0, 0.5, ap, ww, c);
  pointed(0, 0.5, 5.9, 3.5, '#43372c');
  for (const x of [-1.5, -0.5, 0.5, 1.5]) R(x - 0.03, 0.5, x + 0.03, 4.6, '#2a1f17');
  R(-1.75, 3.2, 1.75, 3.27, '#2a1f17');
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) R(s * (2.2 + i * 0.28) - 0.1, 0.5, s * (2.2 + i * 0.28) + 0.1, 3.3, i % 2 ? '#e4d5b0' : '#c9b78e');   // colonettes
  R(-3.9, 3.3, 3.9, 3.55, TRIM);
  // the small gable over the portal: three blind arches
  g.fillStyle = TRIM; g.beginPath(); g.moveTo(X(-3.9), Y(9.1)); g.lineTo(X(0), Y(11.0)); g.lineTo(X(3.9), Y(9.1)); g.closePath(); g.fill();
  g.fillStyle = '#bcab84'; g.beginPath(); g.moveTo(X(-3.5), Y(9.3)); g.lineTo(X(0), Y(10.7)); g.lineTo(X(3.5), Y(9.3)); g.closePath(); g.fill();
  for (const x of [-2.2, 0, 2.2]) { g.fillStyle = '#8f7e5e'; g.beginPath(); g.moveTo(X(x - 0.75), Y(9.3)); g.lineTo(X(x - 0.75), Y(9.7)); g.arc(X(x), Y(9.7), 0.75 * sx, PI, 0); g.lineTo(X(x + 0.75), Y(9.3)); g.fill(); }
  // the rose window: a carved ring, a dark ground, petals round a hub
  circ(0, 13.1, 2.2, TRIM); circ(0, 13.1, 1.95, '#b5a27a'); circ(0, 13.1, 1.7, GLASS);
  g.strokeStyle = '#c9b78e'; g.lineWidth = 0.12 * sx; for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(Math.cos(a) * 0.5), Y(13.1 + Math.sin(a) * 0.5)); g.lineTo(X(Math.cos(a) * 1.7), Y(13.1 + Math.sin(a) * 1.7)); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * 2 * PI; circ(Math.cos(a) * 1.15, 13.1 + Math.sin(a) * 1.15, 0.3, '#cfbd94'); circ(Math.cos(a) * 1.15, 13.1 + Math.sin(a) * 1.15, 0.18, '#14181e'); }
  circ(0, 13.1, 0.55, TRIM); circ(0, 13.1, 0.3, GLASS);
  // a plain rectangular door with a lintel in each side bay
  for (const s of [-1, 1]) { R(s * 8.0 - 1.15, 0.5, s * 8.0 + 1.15, 4.4, TRIM); R(s * 8.0 - 0.85, 0.5, s * 8.0 + 0.85, 3.9, '#4a3b2e'); R(s * 8.0 - 0.04, 0.5, s * 8.0 + 0.04, 3.9, '#2a1f17'); R(s * 8.0 - 1.35, 4.4, s * 8.0 + 1.35, 4.7, '#d3c196'); }
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3.5)); gb.addColorStop(0, 'rgba(30,25,18,0.28)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.5), w, 3.5 * sy);
  streaks(g, w, h, 34, 4202, 0.09, 110, '60,50,40');
}
function paintWall(g, w, h, hm, nave) {   // a side bay, 4.5 m wide: ashlar, a small pointed window on the nave, a taller one on the body
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const pointed = (x, y0, y1, ww, c) => { const r = ww / 2, sp = y1 - r * 1.15; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(sp)); g.quadraticCurveTo(X(x - r), Y(sp + r * 0.9), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(sp + r * 0.9), X(x + r), Y(sp)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.45, 1.2, '#c9b58e', '#a39068', nave ? 4211 : 4212, 1.0, 0.06);
  noiseDots(g, w, h, w * h / 120, 2, 4215, ['rgba(110,85,55,0.07)', 'rgba(255,250,235,0.06)']);
  if (nave) { pointed(2.25, 0.4, hm - 0.5, 0.8, TRIM); pointed(2.25, 0.6, hm - 0.8, 0.5, GLASS); }
  else { R(0, 0, 4.5, 0.7, '#b8a47c'); pointed(2.25, 5.5, 9.5, 1.1, TRIM); pointed(2.25, 5.8, 9.2, 0.7, GLASS); }
  R(0, hm - 0.5, 4.5, hm, TRIM); R(0, hm - 0.8, 4.5, hm - 0.5, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, 4216, 0.1, 80, '55,48,40');
}

function buildSanFrancesco() {
  initShared();
  const pts = pairsOf(SF.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-8, 3)), groundY(...W(8, 3)), groundY(...W(0, 5)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('sfFront', 512, 512, [FW, FH], paintFront);
  defMat('sfBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false));
  defMat('sfNave', 128, 128, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true));
  begin(y0);
  const body = clipFront(pts, -0.6);
  prism('sfBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
  bx('sfNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  gable('tile', 'sfNave', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ1 - NZ0, NAVE_TOP, 2.8, { ov: 0.3, c: '#a9755a', wc: '#c9b58e' });
  // the front: one gable-shaped plate (steep over the nave, flatter over the aisles) with the painted face on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); for (let k = PROF.length - 1; k >= 0; k--) s.lineTo(PROF[k][0], PROF[k][1]); s.lineTo(-hw, 0);
  extrude('sfFront', s, 0.6, { M: at(0, 0, -0.7), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // the rake cornice along the gable, a little proud of the face, and the cross at the apex
  const band = new THREE.Shape(); band.moveTo(PROF[0][0], PROF[0][1]); for (let k = 1; k < PROF.length; k++) band.lineTo(PROF[k][0], PROF[k][1]);
  for (let k = PROF.length - 1; k >= 0; k--) band.lineTo(PROF[k][0], PROF[k][1] + 0.5); band.lineTo(PROF[0][0], PROF[0][1]);
  extrude('flat', band, 0.85, { M: at(0, 0, -0.7), c: '#d6c59c', noao: true });
  bx('flat', F, -0.09, 0.09, 17.6, 18.8, -0.4, -0.2, { c: '#bfae88', noao: true }); bx('flat', F, -0.45, 0.45, 18.2, 18.4, -0.4, -0.2, { c: '#bfae88', noao: true });
  for (let i = 0; i < 3; i++) bx('stone', F, -3.4 - i * 0.2, 3.4 + i * 0.2, -0.3, 0.18 * (3 - i), 0, 0.35 * (i + 1), { c: '#cfc5aa' });
  const o = end('Basilica di San Francesco');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SF.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_TOP + 2.8]];
  return o;
}
export const SAN_FRANCESCO = { name: "Basilica di San Francesco d'Assisi", x: 494, z: -97, radius: 55, skipIds: [SF.id], build: buildSanFrancesco };
