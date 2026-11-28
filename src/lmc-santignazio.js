// City landmark: the Chiesa di Sant'Ignazio all'Olivella (Piazza Olivella, beside the Museo Salinas). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49786081 (a six point outline, a blank block): the baroque front across the whole west edge, the flanks, the nave under its roof and the dome with its lantern.
// Frame F: origin on the ground in the middle of the front, +z out of the front (west-north-west, onto the piazza), +x towards the south (to the right seen from the piazza).
// Measured from the footprint and the lidar parts (the front is the west wall of the outline, the nave and the crossing reach about 25 m and 40 m above the 15.1 m ground).
// Reference photos (Wikimedia Commons, viewed): Chiesa di Sant'Ignazio all'Olivella Palermo.JPG; Palermo - Sant'Ignazio all'Olivella 0046.jpg; Palermo - Sant'Ignazio all'Olivella 0411.JPG; S. Ignazio all'Olivella.JPG; Crèsia di Santu Gnazziu.jpg; and for the dome: S. Ignazio all'Olivella - panoramio.jpg.
// Read from them: cream plaster front with honey limestone dressings and grey marble free-standing columns; a lower order of big columns on pedestals with broken entablatures (about six drawn),
// a central portal between two small columns under a broken curved pediment, a side door with a segmental pediment and a grated window over it in each side bay; an upper order of two slender columns
// either side of a tall arched lattice window, a small lattice window under it, a triangular pediment with a round relief and a cross, scroll volutes joining it to the lower order;
// two square bell towers over the outer bays (clock on the shaft, a bell stage with two arches over a balustrade, an iron rail, an eight sided lantern with round openings under a stone cap, a vane).
// From "Chiesa di Sant'Ignazio all'Olivella Palermo.JPG" and "... 0046.jpg" close up: the columns are smooth (not fluted), each with a ring a third of the way up and a Corinthian capital; the entablatures are
// deep and break forward over the columns; carved shields sit in the broken pediments; white statue groups stand on pedestals beside the clocks; the stone is a warm grey with darker golden dressings.
// The dome (seen from the piazza, behind the Oratorio di San Filippo Neri): green patinated copper with pale ribs, a little taller than a half sphere, on a golden stone drum whose corner piers carry urn finials;
// a round stone lantern with tall windows inside an iron balcony rail, small finials round its cap and a cross.
// The golden front below the dome in that photo (pediment, big half round window, scroll volute and white statue) is not a transept of this church: it is the front of the Oratorio di San Filippo Neri
// next door (footprint w543069968, built in src/lmc-batchQ.js). The same shield, window, scrolls and statues show in Palermo - San Filippo Neri 0417.JPG, Oratorio di San Filippo (Palermo) 01.jpg
// and Sant'Ignazio all'Olivella (Palermo) 20 06 2026 01.jpg. Do not add it here.
// The south corner, from Sant'Ignazio all'Olivella (Palermo) 20 06 2026 02.jpg and 01.jpg, S. Ignazio all'Olivella - panoramio.jpg and Palermo - San Filippo Neri 0417.JPG, with Palermo - Sant'Ignazio all'Olivella 0046.jpg
// for the whole front: the big columns run out to both corners and the towers stand over the outer bays at the corners; the outer bays are blank; the south tower's flank is ochre render with a tall white blank panel,
// the lower entablature turning the corner, a small white panel over it, then a second clock over a white panel and a bell opening. Behind the tower the south wall is plain weathered plaster with no row of windows.
// Not verified: the exact column spacing (read by eye from oblique views), the north flank, the nave walls and the back (all plain plaster), the carving and the statues (plain white or stone shapes), the palm in the south corner (not drawn),
// the iron railing along the front (not drawn: the columns, steps and front have collision walls of their own),
// the number of drum sides (eight, from the piers in view), the lower drum (hidden in the photo, drawn plain), the far side of the dome, the drum height (kept from before).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

const SI = { id: 'w49786081', p: [-83.6, -546.5, -43.3, -557, -35.8, -528.8, -48.3, -525.3, -71.2, -518.8, -76.9, -517.2] };
const O = [-80.36, -532.16], N = [-0.975, 0.222];
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
const FW = 29.8, XF = 0.32, FH = 25,   // the front spans the 30 m west edge of the footprint, its middle XF south of the frame's origin
   FZ = 0.3, EAVE = 13.4, NAVE_EAVE = 19.0, RISE = 4.5, NW = 7.6, NZ0 = -38, NZ1 = -0.6;
const DX = 0, DZ = -24, DR = 5.4, DH = 10, DY = 19;   // the drum: centre, radius, height, base
const PLASTER = '#c9bd9f', DRESS = '#ae9065', LEDGE = '#c2a77c', SOFFIT = '#6e5a3e', MARBLE = '#d3d0c7', WHITE = '#e4e0d4', CAPST = '#b39a70';
const COLS = [-13.8, -10.8, -4.8, 4.8, 10.8, 13.8], TX = 12.4, SX = 15.35;   // from the front's middle: the big columns, the tower axes; SX: the south front corner of the footprint, from the origin
// collision for what stands out of the footprint: the front's face and the flank's base, a box round each outer pedestal, and one round the upper steps and the two middle pedestals (the lowest step is a kerb)
const SI_WALLS = (() => {
  const runs = [[[-14.9, 0], [-14.9, 0.34], [15.14, 0.34], [15.14, 0]], [[-5.65, 0.34], [-5.65, 2.05], [-5.2, 2.72], [5.2, 2.72], [5.65, 2.05], [5.65, 0.34]],
    ...COLS.filter(x => Math.abs(x) > 6).map(x => [[x - 0.85, 0.34], [x - 0.85, 2.06], [x + 0.85, 2.06], [x + 0.85, 0.34]])];
  return runs.flatMap(r => r.slice(1).map((q, i) => [...toWorld(XF + r[i][0], r[i][1]), ...toWorld(XF + q[0], q[1])]));
})();

function paintFront(g, w, h) {   // 29.8 m wide, 25 m tall from the ground
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const tri = (x0, x1, y0, ya, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X((x0 + x1) / 2), Y(ya)); g.lineTo(X(x1), Y(y0)); g.closePath(); g.fill(); };
  const lattice = (x0, y0, x1, y1, c, st) => { g.strokeStyle = c; g.lineWidth = 0.07 * sx; for (let x = x0; x <= x1 + 1e-6; x += st) { g.beginPath(); g.moveTo(X(x), Y(y0)); g.lineTo(X(x), Y(y1)); g.stroke(); } for (let y = y0; y <= y1 + 1e-6; y += st) { g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X(x1), Y(y)); g.stroke(); } };
  paintAshlar(g, w, h, FW, FH, 0.7, 1.7, PLASTER, '#a99d80', 4201, 0.8, 0.07);
  noiseDots(g, w, h, w * h / 90, 2.5, 4203, ['rgba(95,75,48,0.14)', 'rgba(240,230,205,0.10)']);
  for (let i = 0; i < 5; i++) { const gr = g.createRadialGradient(X(-11 + i * 5.5), Y(5 + (i % 3) * 6), 0, X(-11 + i * 5.5), Y(5 + (i % 3) * 6), 5 * sx); gr.addColorStop(0, 'rgba(110,88,58,0.18)'); gr.addColorStop(1, 'rgba(150,120,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, '#948770');                                                           // plinth
  // lower order: the central portal between two small columns, a broken curved pediment over it
  R(-2.6, 0.9, 2.6, 7.2, DRESS); R(-2.3, 0.9, 2.3, 6.9, '#a58a60'); R(-1.5, 0.9, 1.5, 5.7, '#3d2a1c'); R(-0.04, 0.9, 0.04, 5.7, '#22160d'); R(-1.5, 5.7, 1.5, 6.0, DRESS);
  for (let yy = 1.4; yy < 5.5; yy += 0.9) R(-1.4, yy, 1.4, yy + 0.04, 'rgba(0,0,0,0.3)');
  g.fillStyle = DRESS; g.strokeStyle = 'rgba(60,45,30,0.55)'; g.lineWidth = 0.1 * sx;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 3.0), Y(7.2)); g.quadraticCurveTo(X(s * 1.6), Y(7.3), X(s * 0.5), Y(8.6)); g.lineTo(X(s * 0.5), Y(8.1)); g.quadraticCurveTo(X(s * 1.6), Y(6.9), X(s * 3.0), Y(6.8)); g.closePath(); g.fill(); g.stroke(); }
  circ(0, 8.0, 0.45, '#8a7650'); R(-0.35, 6.6, 0.35, 7.3, '#a58a5c');
  // each side bay: a door with a segmental pediment and a grated window over it; the outer bay under a tower is blank, a sunk panel in it
  for (const s of [-1, 1]) {
    const cx = s * 7.8;
    R(cx - 1.15, 0.9, cx + 1.15, 4.4, DRESS); R(cx - 0.8, 0.9, cx + 0.8, 3.7, '#3d2a1c'); R(cx - 1.3, 3.7, cx + 1.3, 4.0, '#9c8058');
    g.fillStyle = '#a58a60'; g.beginPath(); g.moveTo(X(cx - 1.5), Y(4.0)); g.quadraticCurveTo(X(cx), Y(5.4), X(cx + 1.5), Y(4.0)); g.closePath(); g.fill();
    R(cx - 1.0, 5.6, cx + 1.0, 8.6, DRESS); R(cx - 0.7, 5.9, cx + 0.7, 8.3, '#2a2e36'); lattice(cx - 0.7, 5.9, cx + 0.7, 8.3, '#6b6a66', 0.33); tri(cx - 1.3, cx + 1.3, 8.6, 9.5, '#9c8058');
    const ox = s * 12.3; R(ox - 0.55, 2.0, ox + 0.55, 9.2, '#cdc2a4'); R(ox - 0.55, 9.12, ox + 0.55, 9.2, 'rgba(60,45,30,0.3)'); R(ox - 0.55, 2.0, ox + 0.55, 2.08, 'rgba(255,248,225,0.4)');
  }
  // the entablature of the lower order and its shadow
  R(-FW / 2, 10.2, FW / 2, 11.4, DRESS); R(-FW / 2, 10.2, FW / 2, 10.35, 'rgba(60,45,30,0.4)'); R(-FW / 2, 10.9, FW / 2, 11.0, 'rgba(255,245,215,0.25)');
  for (let x = -14.7; x <= 14.5; x += 0.6) R(x, 10.35, x + 0.25, 10.65, 'rgba(60,45,30,0.3)');
  // upper order: a tall arched lattice window in a dressed frame, a small lattice window under it, panels either side
  arch(0, 12.8, 17.6, 3.0, DRESS); arch(0, 13.1, 17.3, 2.3, '#9c8058'); arch(0, 13.3, 17.1, 1.8, '#3a2a22'); lattice(-0.9, 13.3, 0.9, 16.2, '#7a5a3a', 0.3);
  R(-1.6, 12.4, 1.6, 12.8, DRESS);
  R(-1.3, 11.6, 1.3, 12.4, '#3a2a22'); R(-1.5, 11.5, 1.5, 11.65, DRESS); R(-1.5, 12.35, 1.5, 12.5, DRESS); lattice(-1.3, 11.6, 1.3, 12.4, '#8a7a5a', 0.26);
  for (const s of [-1, 1]) for (const [x, hw] of [[3.2, 0.95], [7.8, 1.6]]) { const c = s * x, y1 = x < 5 ? 14.4 : 13.2; R(c - hw, 11.8, c + hw, y1, '#d0c5a8'); R(c - hw, 11.8, c + hw, 11.88, 'rgba(60,45,30,0.3)'); R(c - hw, y1 - 0.08, c + hw, y1, 'rgba(60,45,30,0.3)'); }
  // the pediment of the upper order with its round relief, raking cornice, a cross-bearing block on top
  R(-6.4, 17.9, 6.4, 18.6, DRESS); tri(-6.4, 6.4, 18.6, 22.9, DRESS); tri(-5.4, 5.4, 18.9, 22.1, '#c8bb9a');
  circ(0, 20.0, 0.95, DRESS); circ(0, 20.0, 0.7, '#9c8058'); circ(0, 20.0, 0.4, '#d0c5a8');
  // the scroll volutes joining the upper order to the lower one
  for (const s of [-1, 1]) {
    g.fillStyle = DRESS; g.strokeStyle = 'rgba(60,45,30,0.5)'; g.lineWidth = 0.08 * sx; g.beginPath(); g.moveTo(X(s * 9.4), Y(11.4)); g.bezierCurveTo(X(s * 8.4), Y(12.6), X(s * 7.1), Y(14.4), X(s * 6.4), Y(16.8)); g.lineTo(X(s * 6.0), Y(16.8)); g.lineTo(X(s * 6.0), Y(14.2)); g.bezierCurveTo(X(s * 6.6), Y(13.0), X(s * 7.2), Y(12.2), X(s * 7.4), Y(11.4)); g.closePath(); g.fill(); g.stroke();
    circ(s * 8.35, 12.2, 0.42, '#a58a5c'); circ(s * 8.35, 12.2, 0.22, '#c4b695');
  }
  // a soft shadow under each cornice, rain streaks, dirt at the foot
  for (const y of [10.2, 17.9]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 2.0)); gs.addColorStop(0, 'rgba(30,20,10,0.55)'); gs.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 2.0 * sy); }
  // the shadow each column and pedestal throws on the wall beside it
  for (const [xs, y0, y1] of [[COLS, 1.5, 10.2], [[-4.8, 4.8], 11.4, 17.9], [[-1.95, 1.95], 0.9, 6.4]]) for (const x of xs) { R(x + 0.3, y0, x + 1.05, y1, 'rgba(35,24,12,0.28)'); R(x - 0.95, y0, x - 0.55, y1, 'rgba(35,24,12,0.12)'); }
  streaks(g, w, h, 24, 4202, 0.07, 110, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,25,18,0.32)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, seed) {   // a 4.5 m length of the flanks, hm m tall: plain weathered plaster, patched, under a cornice (no photo shows windows on these walls)
  const sx = w / 4.5, sy = h / hm, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4.5, hm, '#d6c7a6');
  noiseDots(g, w, h, w * h / 60, 2, seed + 3, ['rgba(120,90,60,0.09)', 'rgba(255,250,235,0.08)']);
  for (let i = 0; i < 4; i++) { const x = (0.5 + i * 1.1) * sx, y = h * (0.25 + ((i * 7) % 5) * 0.13), rad = (0.7 + (i % 3) * 0.4) * sx, gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, i % 2 ? 'rgba(150,120,90,0.22)' : 'rgba(236,228,208,0.3)'); gr.addColorStop(1, 'rgba(150,120,90,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
  R(0, hm - 0.7, 4.5, hm, '#e2d6b8'); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '55,48,40');
}
function paintDrum(g, w, h) {   // one eighth of the drum: 4.1 m wide, 10 m tall; weathered golden stone, pilaster halves at the joins, mouldings under the top
  const sx = w / 4.1, sy = h / 10;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, 4.1, 10, 0.5, 1.2, '#c4a272', '#8d7149', 4231, 1.0, 0.1);
  for (const x of [0, 3.55]) { R(x, 0, x + 0.55, 9.4, 'rgba(240,215,165,0.3)'); R(x ? x : x + 0.5, 0, x ? x + 0.05 : x + 0.55, 9.4, 'rgba(60,42,24,0.4)'); }
  R(0, 7.5, 4.1, 7.75, '#d4b484'); R(0, 7.3, 4.1, 7.5, 'rgba(50,35,20,0.4)'); R(0, 9.4, 4.1, 10, '#d4b484'); R(0, 9.2, 4.1, 9.4, 'rgba(50,35,20,0.4)');
  streaks(g, w, h, 10, 4232, 0.14, 70, '55,42,30');
}

function buildSantIgnazio() {
  initShared();
  const pts = pairsOf(SI.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-9, FZ + 1)), groundY(...W(9, FZ + 1)), groundY(...W(0, FZ + 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('siFront', 512, 512, [FW, FH], paintFront);
  defMat('siBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, 4221));
  defMat('siNave', 128, 128, [4.5, NAVE_EAVE - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_EAVE - EAVE, 4222));
  defMat('siDrum', 128, 256, [4.1, 10], paintDrum);
  begin(y0);
  // the body: the whole OSM footprint up to the aisle eaves, a flat roof over it
  const body = clipFront(pts, FZ - 0.1);
  prism('siBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
  // the nave on top of it, under a gable roof of tiles; the ridge (23.5 m) stays under the crest (24 m) of the front
  bx('siNave', F, -NW, NW, EAVE, NAVE_EAVE, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_EAVE - EAVE)] });
  gable('tile', 'siNave', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ1 - NZ0, NAVE_EAVE, RISE, { ov: 0.4, c: '#b8744f', wc: '#d8cdb2' });
  // the front: one shape (the lower order, volutes, the upper order under a triangular pediment) with the painted front on it
  const s = new THREE.Shape(), hw = FW / 2, A = at(XF, 0, 0), on = (x, y, z) => mul(A, tr(x, y, z));   // A: the frame on the middle of the front
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 11.4); s.lineTo(9.4, 11.4); s.bezierCurveTo(8.4, 12.6, 7.1, 14.4, 6.4, 16.8); s.lineTo(6.4, 17.9); s.lineTo(6.5, 18.6); s.lineTo(0, 23.0); s.lineTo(-6.5, 18.6); s.lineTo(-6.4, 17.9); s.lineTo(-6.4, 16.8);
  s.bezierCurveTo(-7.1, 14.4, -8.4, 12.6, -9.4, 11.4); s.lineTo(-hw, 11.4); s.lineTo(-hw, 0);
  extrude('siFront', s, 1.2, { M: on(0, 0, FZ - 1.2), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // the two entablatures: a frieze, a dark soffit and a deep ledge across the whole front; the pediment's raking cornices, its medallion, a block with a cross on top
  const B = (x0, x1, y0, y1, d, c) => bx('flat', A, x0, x1, y0, y1, FZ - 0.1, FZ + d, { c, noao: true });
  B(-hw - 0.15, hw + 0.15, 10.05, 10.35, 0.42, LEDGE); B(-hw - 0.1, hw + 0.1, 10.35, 10.85, 0.18, DRESS); B(-hw - 0.2, hw + 0.2, 10.85, 11.05, 0.55, SOFFIT); B(-hw - 0.35, hw + 0.35, 11.05, 11.45, 0.85, LEDGE);
  B(-6.7, 6.7, 17.7, 17.95, 0.3, DRESS); B(-6.8, 6.8, 17.95, 18.15, 0.45, SOFFIT); B(-7.0, 7.0, 18.15, 18.55, 0.72, LEDGE);
  for (const sg of [-1, 1]) {
    const dx = 6.9, dy = 4.35, len = Math.hypot(dx, dy);
    bx('flat', mul(on(sg * dx / 2, 18.45 + dy / 2, FZ + 0.1), new THREE.Matrix4().makeRotationZ(-sg * Math.atan2(dy, dx))), -len / 2, len / 2, -0.12, 0.34, -0.3, 0.5, { c: LEDGE, noao: true });
  }
  cyl('flat', 0.95, 0.95, 0.22, 10, { M: on(0, 20.0, FZ - 0.05), rx: PI / 2, c: LEDGE, noao: true }); sphere('flat', 0.55, { M: on(0, 20.0, FZ + 0.15), kz: 0.5, seg: 6, c: '#d8d0bc', noao: true });
  bx('flat', A, -0.7, 0.7, 22.7, 23.8, FZ - 0.9, FZ - 0.1, { c: '#bca27a' });
  bx('flat', A, -0.06, 0.06, 23.8, 25.3, FZ - 0.55, FZ - 0.43, { c: '#3e3a36', noao: true }); bx('flat', A, -0.45, 0.45, 24.6, 24.74, FZ - 0.55, FZ - 0.43, { c: '#3e3a36', noao: true });
  // a grey marble column with its moulded foot, a ring a third of the way up, a Corinthian capital (a flaring bell and a square slab)
  const column = (x, y0, h, r, z, seg) => {
    const t = h - 3.2 * r;
    lathe('flat', [[r * 1.35, 0], [r, r * 0.7], [r * 0.99, t * 0.34], [r * 1.09, t * 0.355], [r * 0.97, t * 0.37], [r * 0.82, t]], seg, { M: on(x, y0, z), c: MARBLE, noao: true });
    lathe('flat', [[r * 0.9, 0], [r * 1.08, r * 1.5], [r * 1.55, r * 2.7]], seg, { M: on(x, y0 + t, z), c: '#c9bda0', noao: true });
    bx('flat', A, x - r * 1.55, x + r * 1.55, y0 + t + r * 2.7, y0 + h, z - r * 1.4, z + r * 1.55, { c: '#cdbd98', noao: true });
  };
  // lower order: six big grey marble columns on stone pedestals out to both corners, the entablature breaking forward over each; two small columns beside the portal
  for (const x of COLS) {
    bx('flat', A, x - 0.85, x + 0.85, 0.0, 1.25, FZ + 0.25, FZ + 1.75, { c: '#aaa08c' }); bx('flat', A, x - 0.8, x + 0.8, 1.25, 1.55, FZ + 0.2, FZ + 1.7, { c: '#c8c0ac' });
    column(x, 1.55, 8.5, 0.57, FZ + 0.95, 8);
    B(x - 0.85, x + 0.85, 10.05, 10.35, 1.68, LEDGE); B(x - 0.78, x + 0.78, 10.35, 10.85, 1.55, DRESS); B(x - 0.95, x + 0.95, 10.85, 11.05, 1.78, SOFFIT); B(x - 1.15, x + 1.15, 11.05, 11.5, 2.0, LEDGE);
  }
  for (const x of [-1.95, 1.95]) {
    bx('flat', A, x - 0.4, x + 0.4, 0.5, 1.5, FZ - 0.1, FZ + 0.95, { c: '#aaa08c' });
    column(x, 1.5, 4.75, 0.25, FZ + 0.55, 5);
    B(x - 0.5, x + 0.5, 6.25, 6.65, 0.95, DRESS); B(x - 0.65, x + 0.65, 6.65, 6.95, 1.15, LEDGE);
  }
  B(-1.7, 1.7, 5.75, 6.25, 0.28, DRESS); B(-1.75, 1.75, 6.25, 6.55, 0.5, LEDGE);
  const curve = (pts, d, c, z = FZ - 0.05) => { const q = new THREE.Shape(); q.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) pts[i].length === 4 ? q.quadraticCurveTo(...pts[i]) : q.lineTo(...pts[i]); extrude('flat', q, d, { M: on(0, 0, z), c, noao: true, cs: 3 }); };
  // the portal's broken curved pediment and the carved shield between its halves
  for (const k of [-1, 1]) curve([[k * 2.75, 6.95], [k * 2.2, 8.35, k * 0.85, 8.65], [k * 0.75, 8.1], [k * 1.8, 7.85, k * 2.0, 7.3], [k * 1.2, 7.25], [k * 1.2, 6.95], [k * 2.75, 6.95]], 0.8, LEDGE);
  sphere('flat', 0.62, { M: on(0, 7.75, FZ + 0.3), ky: 1.25, kz: 0.5, seg: 7, c: '#b9a27a', noao: true }); sphere('flat', 0.3, { M: on(0, 8.65, FZ + 0.35), seg: 5, c: '#b9a27a', noao: true });
  for (const sg of [-1, 1]) {
    const cx = sg * 7.8;
    // the side door: jambs, a ledge, a curved pediment with a carving in it; the grated window over it in a moulded frame under a gable
    for (const k of [-1, 1]) { B(cx + k * 0.97 - 0.17, cx + k * 0.97 + 0.17, 0.0, 3.75, 0.06, DRESS); B(cx + k * 0.86 - 0.16, cx + k * 0.86 + 0.16, 5.75, 8.35, 0.28, DRESS); }
    B(cx - 1.45, cx + 1.45, 3.72, 4.05, 0.55, LEDGE);
    curve([[cx - 1.5, 4.05], [cx, 6.0, cx + 1.5, 4.05], [cx + 1.15, 4.05], [cx, 5.45, cx - 1.15, 4.05], [cx - 1.5, 4.05]], 0.6, LEDGE);
    sphere('flat', 0.38, { M: on(cx, 4.5, FZ + 0.2), ky: 1.1, kz: 0.5, seg: 5, c: '#b9a27a', noao: true });
    B(cx - 1.2, cx + 1.2, 5.5, 5.75, 0.45, LEDGE); B(cx - 1.2, cx + 1.2, 8.35, 8.65, 0.5, LEDGE);
    curve([[cx - 1.45, 8.65], [cx + 1.45, 8.65], [cx, 9.7], [cx - 1.45, 8.65]], 0.5, LEDGE);
  }
  // upper order: the arched window's frame and curved hood, the small window's ledge, two slender columns either side, each on a pedestal
  for (const k of [-1, 1]) B(k * 1.35 - 0.18, k * 1.35 + 0.18, 12.75, 16.15, 0.34, DRESS);
  curve([[-1.8, 16.1], [-1.75, 18.25, 0, 18.3], [1.75, 18.25, 1.8, 16.1], [1.3, 16.1], [1.25, 17.6, 0, 17.65], [-1.25, 17.6, -1.3, 16.1], [-1.8, 16.1]], 0.42, LEDGE);
  B(-1.75, 1.75, 12.45, 12.75, 0.5, LEDGE);
  for (const x of [-4.8, 4.8]) {
    bx('flat', A, x - 0.62, x + 0.62, 11.45, 12.75, FZ - 0.1, FZ + 1.05, { c: DRESS });
    column(x, 12.75, 5.05, 0.31, FZ + 0.6, 5);
    B(x - 0.55, x + 0.55, 17.7, 18.15, 1.05, DRESS); B(x - 0.75, x + 0.75, 18.15, 18.65, 1.3, LEDGE);
  }
  // the great scrolls that join the upper order to the lower one
  for (const k of [-1, 1]) {
    const q = new THREE.Shape(); q.moveTo(k * 9.5, 11.45); q.bezierCurveTo(k * 8.4, 12.6, k * 7.1, 14.4, k * 6.45, 16.9); q.lineTo(k * 6.0, 16.9); q.lineTo(k * 6.0, 14.4); q.bezierCurveTo(k * 6.6, 13.2, k * 7.3, 12.4, k * 7.5, 11.45); q.lineTo(k * 9.5, 11.45);
    extrude('flat', q, 0.4, { M: on(0, 0, FZ - 0.1), c: CAPST, noao: true, cs: 3 });
    for (const [x, y, r] of [[8.45, 12.15, 0.62], [6.5, 16.75, 0.4]]) { cyl('flat', r, r, 0.34, 7, { M: on(k * x, y, FZ + 0.18), rx: PI / 2, c: LEDGE, noao: true }); }
  }
  // the white statue groups on pedestals in front of the towers, either side of each clock
  for (const x of [-13.8, -10.8, 10.8, 13.8]) {
    bx('flat', A, x - 0.65, x + 0.65, 11.45, 13.35, FZ - 0.1, FZ + 1.15, { c: DRESS }); B(x - 0.8, x + 0.8, 13.35, 13.65, 1.3, LEDGE);
    const M = on(x, 13.65, FZ + 0.75);
    lathe('flat', [[0.55, 0], [0.36, 0.9], [0.48, 1.65], [0.14, 2.05]], 5, { M, c: WHITE, noao: true }); sphere('flat', 0.26, { M, p: [0, 2.3, 0], seg: 5, c: WHITE, noao: true });
    bx('flat', M, -0.62, 0.62, 0.55, 1.25, -0.15, 0.25, { c: '#d6d1c4', noao: true });
  }
  for (let i = 0; i < 3; i++) bx('stone', A, -5.0 - i * 0.2, 5.0 + i * 0.2, -0.3, 0.18 * (3 - i), FZ + 1.7, FZ + 1.7 + 0.35 * (i + 1), { c: '#d8cfb8' });
  // the two bell towers over the outer bays: a shaft with a clock, a bell stage with two arched openings and a balustrade, a heavy cornice with an iron rail, an eight sided lantern under a stone cap, a vane
  for (const sg of [-1, 1]) {
    const T = on(sg * TX, 0, 0), E = sg > 0 ? 2.65 : 2.2;   // E: the south tower's shaft reaches out to the flank, over the footprint's edge
    const TB = (x0, x1, y0, y1, z0, z1, c) => bx('flat', T, x0, x1, y0, y1, z0, z1, { c, noao: true });
    bx('flat', T, -2.2, E, 11.4, 19.0, -4.6, FZ - 0.05, { c: '#b39770' });
    TB(-1.3, 1.3, 13.0, 17.0, FZ - 0.05, FZ + 0.06, PLASTER);
    cyl('flat', 1.12, 1.12, 0.12, 12, { M: T, p: [0, 14.9, FZ + 0.06], rx: PI / 2, c: LEDGE, noao: true });
    cyl('flat', 0.9, 0.9, 0.12, 12, { M: T, p: [0, 14.9, FZ + 0.14], rx: PI / 2, c: '#efe9d6', noao: true });
    TB(-0.04, 0.04, 14.9, 15.7, FZ + 0.24, FZ + 0.32, '#2a2622'); TB(0, 0.5, 14.9, 14.96, FZ + 0.24, FZ + 0.32, '#2a2622');
    TB(-1.5, 1.5, 17.0, 17.35, FZ - 0.1, FZ + 0.35, LEDGE);
    TB(-2.45, E + 0.2, 18.7, 19.0, -4.85, FZ + 0.25, SOFFIT); bx('flat', T, -2.65, E + 0.4, 19.0, 19.65, -5.05, FZ + 0.5, { c: LEDGE });
    bx('flat', T, -1.8, 1.8, 19.65, 23.7, -4.2, -0.4, { c: '#b39770' });
    const arch = (ww, h) => { const r = ww / 2, q = new THREE.Shape(); q.moveTo(-r, 0); q.lineTo(r, 0); q.lineTo(r, h - r); q.absarc(0, h - r, r, 0, PI, false); q.lineTo(-r, 0); return q; };
    for (const x of [-0.82, 0.82]) { extrude('flat', arch(1.25, 2.95), 0.1, { M: mul(T, tr(x, 20.45, -0.42)), c: LEDGE, noao: true, cs: 2 }); extrude('flat', arch(0.86, 2.45), 0.1, { M: mul(T, tr(x, 20.65, -0.36)), c: '#1d1712', noao: true, cs: 2 }); }
    for (const q of [-1, 1]) extrude('flat', arch(1.2, 2.45), 0.08, { M: mul(T, mul(tr(q * 1.8, 20.65, -2.3), rotY(q * PI / 2))), c: '#1d1712', noao: true, cs: 2 });   // a bell opening on each side
    for (const x of [-1.8, 0, 1.8]) TB(x - 0.2, x + 0.2, 19.65, 23.7, -0.45, -0.2, LEDGE);
    TB(-1.9, 1.9, 20.3, 20.55, -0.4, -0.05, LEDGE); for (const x of [-1.3, -0.65, 0.65, 1.3]) TB(x - 0.1, x + 0.1, 19.65, 20.3, -0.35, -0.15, '#cfc4a8');
    TB(-2.1, 2.1, 23.4, 23.7, -4.5, -0.1, SOFFIT); bx('flat', T, -2.4, 2.4, 23.7, 24.25, -4.7, 0.2, { c: LEDGE });
    for (const [x0, x1, z0, z1] of [[-2.3, 2.3, 0.06, 0.1], [-2.3, -2.26, -4.6, 0.1], [2.26, 2.3, -4.6, 0.1]]) { TB(x0, x1, 24.8, 24.9, z0, z1, '#2e2c2a'); }
    const C = mul(T, tr(0, 24.25, -2.3));
    cyl('flat', 1.45, 1.6, 1.7, 8, { M: C, c: '#b39770', open: true, noao: true });
    for (let k = 0; k < 4; k++) cyl('flat', 0.42, 0.42, 0.1, 6, { M: mul(C, rotY(k * PI / 2)), p: [0, 0.9, 1.45], rx: PI / 2, c: '#1d1712', noao: true });
    cyl('flat', 1.85, 1.75, 0.3, 8, { M: mul(C, tr(0, 1.7, 0)), c: LEDGE, noao: true });
    lathe('flat', [[1.6, 0], [1.75, 0.45], [1.3, 1.15], [0.65, 1.55], [0.5, 2.0], [0.62, 2.3], [0.22, 2.7], [0, 3.0]], 8, { M: mul(C, tr(0, 2.0, 0)), c: CAPST, noao: true });
    for (let k = 0; k < 4; k++) lathe('flat', [[0.12, 0], [0.28, 0.35], [0, 0.95]], 4, { M: mul(C, mul(rotY(k * PI / 2 + PI / 4), tr(0, 1.95, 1.85))), c: LEDGE, noao: true });
    sphere('flat', 0.3, { M: mul(C, tr(0, 5.2, 0)), seg: 6, c: '#c9a85c', noao: true });
    TB(-0.05, 0.05, 29.5, 30.8, -2.35, -2.25, '#3e3a36'); TB(0.05, 0.7, 30.25, 30.65, -2.33, -2.27, '#3e3a36');
    if (sg < 0) continue;
    // the south face of the south tower: a white panel over the lower entablature, a ledge, the second clock over its white panel, the balustrade under the bell opening
    bx('flat', T, E - 0.02, E + 0.06, 11.9, 13.2, -3.1, -1.5, { c: WHITE, noao: true });
    bx('flat', T, -2.35, E + 0.15, 13.35, 13.65, -4.75, FZ - 0.12, { c: LEDGE, noao: true });
    bx('flat', T, E - 0.02, E + 0.05, 13.9, 15.3, -3.1, -1.5, { c: WHITE, noao: true });
    cyl('flat', 0.9, 0.9, 0.12, 14, { M: T, p: [E, 15.3, -2.3], rz: -PI / 2, c: '#efe9d6', noao: true });
    bx('flat', T, E + 0.13, E + 0.16, 15.3, 16.05, -2.34, -2.26, { c: '#2a2622', noao: true }); bx('flat', T, E + 0.13, E + 0.16, 15.27, 15.33, -2.8, -2.3, { c: '#2a2622', noao: true });
    bx('flat', T, 1.8, 1.92, 19.8, 20.55, -3.05, -1.55, { c: '#bdb09a', noao: true });
  }
  // the south flank under that tower, along the footprint's edge (u runs back from the front corner): ochre render over a grey base, a tall white blank panel, the lower entablature turning the corner
  const S = mul(at(SX, 0, 0), rotY(Math.atan2(0.9988, -0.0489)));
  bx('flat', S, -0.3, 4.7, -0.8, 10.2, -0.3, 0.06, { c: '#b39770' });
  bx('flat', S, -0.32, 4.72, -0.8, 1.5, -0.3, 0.1, { c: '#b9b3a6' });
  bx('flat', S, 1.0, 3.4, 2.4, 9.4, 0, 0.09, { c: WHITE, noao: true });
  bx('flat', S, -0.35, 4.8, 10.2, 11.2, -0.3, 0.3, { c: DRESS, noao: true });
  bx('flat', S, -0.4, 4.85, 11.2, 11.47, -0.3, 0.5, { c: LEDGE, noao: true });

  // the dome: an eight sided drum with a pier and an urn at every corner, the ribbed green dome, the lantern with its balcony rail, a cross
  const D = at(DX, DY, DZ), GREEN = '#b4e6cc';
  cyl('siDrum', DR, DR, DH, 8, { M: D, uvk: [8, 1] });
  cyl('flat', DR + 0.35, DR + 0.35, 0.5, 8, { M: mul(D, tr(0, DH, 0)), c: '#d4b988', noao: true });
  const DOME = [[5.0, 0], [5.05, 0.7], [4.85, 1.9], [4.3, 3.2], [3.4, 4.4], [2.3, 5.3], [1.2, 5.9], [0, 6.1]];
  lathe('lead', DOME, 16, { M: mul(D, tr(0, DH + 0.5, 0)), c: GREEN, noao: true });
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4, P = mul(D, mul(tr(Math.sin(a) * DR, 0, Math.cos(a) * DR), rotY(a)));
    bx('flat', P, -0.42, 0.42, DH - 3.0, DH + 1.1, -0.35, 0.45, { c: '#c9aa78', noao: true });
    lathe('flat', [[0.3, 0], [0.14, 0.25], [0.48, 0.75], [0.16, 1.1], [0, 1.65]], 6, { M: P, p: [0, DH + 1.1, 0.05], c: '#b59a6e', noao: true });
    lathe('lead', DOME.slice(0, 7).map(q => [q[0] + 0.08, q[1]]), 1, { M: mul(D, tr(0, DH + 0.5, 0)), t0: a - 0.025, tl: 0.05, c: '#e2fff0', noao: true });
  }
  const L = mul(D, tr(0, DH + 0.5 + 5.8, 0));
  cyl('flat', 1.75, 1.75, 0.45, 8, { M: L, c: '#c9aa78', noao: true });
  cyl('flat', 1.25, 1.25, 2.4, 8, { M: mul(L, tr(0, 0.45, 0)), c: '#d9bf90', noao: true });
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * PI / 4, P = mul(L, rotY(a)), q = 1.25 * Math.cos(PI / 8);
    bx('flat', P, -0.24, 0.24, 1.0, 2.5, q - 0.05, q + 0.05, { c: '#2a2e36', noao: true });
    bx('flat', mul(L, rotY(i * PI / 4)), -0.04, 0.04, 0.45, 1.35, 1.65, 1.73, { c: '#2e2c2a', noao: true }); }
  cyl('flat', 1.72, 1.72, 0.08, 8, { M: mul(L, tr(0, 1.35, 0)), open: true, c: '#2e2c2a', noao: true });
  cyl('flat', 1.5, 1.4, 0.3, 8, { M: mul(L, tr(0, 2.85, 0)), c: '#d4b988', noao: true });
  for (let i = 0; i < 4; i++) { const a = (i + 0.5) * PI / 2; sphere('flat', 0.2, { M: L, p: [Math.sin(a) * 1.3, 3.4, Math.cos(a) * 1.3], ky: 1.6, seg: 6, c: '#b59a6e', noao: true }); }
  lathe('lead', [[1.2, 0], [0.9, 0.6], [0.35, 1.0], [0.28, 1.25], [0, 1.45]], 8, { M: mul(L, tr(0, 3.15, 0)), c: GREEN, noao: true });
  bx('flat', L, -0.07, 0.07, 4.4, 5.8, -0.07, 0.07, { c: '#3e3a36', noao: true }); bx('flat', L, -0.4, 0.4, 5.2, 5.34, -0.07, 0.07, { c: '#3e3a36', noao: true });
  const o = end("Chiesa di Sant'Ignazio all'Olivella");
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SI.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_EAVE + RISE]];
  return o;
}
export const SANT_IGNAZIO = { name: "Chiesa di Sant'Ignazio all'Olivella", x: -60, z: -532, radius: 40, skipIds: [SI.id], build: buildSantIgnazio, walls: SI_WALLS };
