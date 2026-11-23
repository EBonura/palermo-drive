// City landmark: the Chiesa di Sant'Ignazio all'Olivella (Piazza Olivella, beside the Museo Salinas). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49786081 (a six point outline, a blank block): the baroque front, the plain flanks, the nave under its roof and the dome with its lantern.
// Frame F: origin on the ground in the middle of the front, +z out of the front (west-north-west, onto the piazza), +x towards the south (to the right seen from the piazza).
// Measured from the footprint and the lidar parts (the front is the west wall of the outline, the nave and the crossing reach about 25 m and 40 m above the 15.1 m ground).
// Reference photos (Wikimedia Commons, viewed): Chiesa di Sant'Ignazio all'Olivella Palermo.JPG; Palermo - Sant'Ignazio all'Olivella 0046.jpg; Palermo - Sant'Ignazio all'Olivella 0411.JPG; S. Ignazio all'Olivella.JPG; Crèsia di Santu Gnazziu.jpg.
// Read from them: cream plaster front with honey limestone dressings and grey marble free-standing columns; a lower order of big columns on pedestals with broken entablatures (about six drawn),
// a central portal between two small columns under a broken curved pediment, a side door with a segmental pediment and a grated window over it in each side bay; an upper order of two slender columns
// either side of a tall arched lattice window, a small lattice window under it, a triangular pediment with a round relief and a cross, scroll volutes joining it to the lower order;
// two square bell towers over the outer bays (clock on the shaft, a bell stage with two arches, a lead cap with a lantern).
// Not verified: the exact column count and spacing, the statues (omitted), the dome and drum (no photo shows them, kept as before).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

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
const FW = 22, FH = 25, FZ = 0.3, EAVE = 13.4, NAVE_EAVE = 19.0, RISE = 4.5, NW = 7.6, NZ0 = -38, NZ1 = -0.6;
const DX = 0, DZ = -24, DR = 5.4, DH = 10, DY = 19;   // the drum: centre, radius, height, base
const DARKGLASS = '#262f3a', PLASTER = '#d9cfa8', DRESS = '#c9a468', MARBLE = '#cdc9bd';

function paintFront(g, w, h) {   // 22 m wide, 25 m tall from the ground
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const tri = (x0, x1, y0, ya, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X((x0 + x1) / 2), Y(ya)); g.lineTo(X(x1), Y(y0)); g.closePath(); g.fill(); };
  const lattice = (x0, y0, x1, y1, c, st) => { g.strokeStyle = c; g.lineWidth = 0.07 * sx; for (let x = x0; x <= x1 + 1e-6; x += st) { g.beginPath(); g.moveTo(X(x), Y(y0)); g.lineTo(X(x), Y(y1)); g.stroke(); } for (let y = y0; y <= y1 + 1e-6; y += st) { g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X(x1), Y(y)); g.stroke(); } };
  paintAshlar(g, w, h, FW, FH, 0.9, 2.4, PLASTER, '#cdc19a', 4201, 0.6, 0.03);
  for (let i = 0; i < 5; i++) { const gr = g.createRadialGradient(X(-8 + i * 4), Y(5 + (i % 3) * 6), 0, X(-8 + i * 4), Y(5 + (i % 3) * 6), 5 * sx); gr.addColorStop(0, 'rgba(150,120,80,0.14)'); gr.addColorStop(1, 'rgba(150,120,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, '#b9a982');                                                           // plinth
  // lower order: the central portal between two small columns, a broken curved pediment over it
  R(-2.6, 0.9, 2.6, 7.2, DRESS); R(-2.3, 0.9, 2.3, 6.9, '#c0a064'); R(-1.5, 0.9, 1.5, 5.7, '#3d2a1c'); R(-0.04, 0.9, 0.04, 5.7, '#22160d'); R(-1.5, 5.7, 1.5, 6.0, DRESS);
  for (let yy = 1.4; yy < 5.5; yy += 0.9) R(-1.4, yy, 1.4, yy + 0.04, 'rgba(0,0,0,0.3)');
  g.fillStyle = DRESS; g.strokeStyle = 'rgba(60,45,30,0.55)'; g.lineWidth = 0.1 * sx;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 3.0), Y(7.2)); g.quadraticCurveTo(X(s * 1.6), Y(7.3), X(s * 0.5), Y(8.6)); g.lineTo(X(s * 0.5), Y(8.1)); g.quadraticCurveTo(X(s * 1.6), Y(6.9), X(s * 3.0), Y(6.8)); g.closePath(); g.fill(); g.stroke(); }
  circ(0, 8.0, 0.45, '#8a7650'); R(-0.35, 6.6, 0.35, 7.3, '#a58a5c');
  // each side bay: a door with a segmental pediment and a grated window over it; the outer bay (under a tower) a smaller door
  for (const s of [-1, 1]) {
    const cx = s * 6.05;
    R(cx - 1.15, 0.9, cx + 1.15, 4.4, DRESS); R(cx - 0.8, 0.9, cx + 0.8, 3.7, '#3d2a1c'); R(cx - 1.3, 3.7, cx + 1.3, 4.0, '#b99a5e');
    g.fillStyle = '#c0a064'; g.beginPath(); g.moveTo(X(cx - 1.5), Y(4.0)); g.quadraticCurveTo(X(cx), Y(5.4), X(cx + 1.5), Y(4.0)); g.closePath(); g.fill();
    R(cx - 1.0, 5.6, cx + 1.0, 8.6, DRESS); R(cx - 0.7, 5.9, cx + 0.7, 8.3, '#2a2e36'); lattice(cx - 0.7, 5.9, cx + 0.7, 8.3, '#6b6a66', 0.33); tri(cx - 1.3, cx + 1.3, 8.6, 9.5, '#b99a5e');
    const ox = s * 9.2; R(ox - 0.9, 0.9, ox + 0.9, 3.6, DRESS); R(ox - 0.6, 0.9, ox + 0.6, 3.2, '#3d2a1c'); R(ox - 1.0, 3.2, ox + 1.0, 3.5, '#b99a5e');
    R(ox - 1.0, 5.2, ox + 1.0, 8.0, '#d3c7a2'); R(ox - 0.9, 5.3, ox + 0.9, 7.9, 'rgba(0,0,0,0.05)');
  }
  // the entablature of the lower order and its shadow
  R(-FW / 2, 10.2, FW / 2, 11.4, DRESS); R(-FW / 2, 10.2, FW / 2, 10.35, 'rgba(60,45,30,0.4)'); R(-FW / 2, 10.9, FW / 2, 11.0, 'rgba(255,245,215,0.25)');
  for (let x = -10.8; x <= 10.8; x += 0.6) R(x, 10.35, x + 0.25, 10.65, 'rgba(60,45,30,0.3)');
  // upper order: a tall arched lattice window in a dressed frame, a small lattice window under it, panels either side
  arch(0, 12.8, 17.6, 3.0, DRESS); arch(0, 13.1, 17.3, 2.3, '#b99a5e'); arch(0, 13.3, 17.1, 1.8, '#3a2a22'); lattice(-0.9, 13.3, 0.9, 16.2, '#7a5a3a', 0.3);
  R(-1.6, 12.4, 1.6, 12.8, DRESS);
  R(-1.3, 11.6, 1.3, 12.4, '#3a2a22'); R(-1.5, 11.5, 1.5, 11.65, DRESS); R(-1.5, 12.35, 1.5, 12.5, DRESS); lattice(-1.3, 11.6, 1.3, 12.4, '#8a7a5a', 0.26);
  for (const s of [-1, 1]) { R(s * 3.0 - 0.8, 11.8, s * 3.0 + 0.8, 14.4, '#e0d6b4'); R(s * 3.0 - 0.8, 11.8, s * 3.0 + 0.8, 11.88, 'rgba(60,45,30,0.3)'); R(s * 3.0 - 0.8, 14.32, s * 3.0 + 0.8, 14.4, 'rgba(60,45,30,0.3)'); }
  // the pediment of the upper order with its round relief, raking cornice, a cross-bearing block on top
  R(-5.3, 17.9, 5.3, 18.6, DRESS); tri(-5.3, 5.3, 18.6, 22.9, DRESS); tri(-4.4, 4.4, 18.9, 22.0, '#d2c69e');
  circ(0, 20.0, 0.95, DRESS); circ(0, 20.0, 0.7, '#b99a5e'); circ(0, 20.0, 0.4, '#e0d6b4');
  // the scroll volutes joining the upper order to the lower one
  for (const s of [-1, 1]) {
    g.fillStyle = DRESS; g.strokeStyle = 'rgba(60,45,30,0.5)'; g.lineWidth = 0.08 * sx; g.beginPath(); g.moveTo(X(s * 7.9), Y(11.4)); g.bezierCurveTo(X(s * 7.0), Y(12.6), X(s * 5.9), Y(14.4), X(s * 5.3), Y(16.8)); g.lineTo(X(s * 4.9), Y(16.8)); g.lineTo(X(s * 4.9), Y(14.2)); g.bezierCurveTo(X(s * 5.4), Y(13.0), X(s * 5.8), Y(12.2), X(s * 5.9), Y(11.4)); g.closePath(); g.fill(); g.stroke();
    circ(s * 6.9, 12.2, 0.42, '#a58a5c'); circ(s * 6.9, 12.2, 0.22, '#d3c7a2');
  }
  // a soft shadow under each cornice, rain streaks, dirt at the foot
  for (const y of [10.2, 17.9]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(30,22,14,0.32)'); gs.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sy); }
  streaks(g, w, h, 34, 4202, 0.1, 110, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,25,18,0.32)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay: 4.5 m wide, hm m tall; the body gets a blind arch over a window, the nave a tall arched window, both a cornice
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.6, 1.4, '#d8cdb2', '#b8ad94', seed, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, seed + 3, ['rgba(120,90,60,0.07)', 'rgba(255,250,235,0.06)']);
  R(0, 0, 0.5, hm, 'rgba(255,250,235,0.18)'); R(4.0, 0, 4.5, hm, 'rgba(60,45,30,0.14)');
  if (win) { arch(2.25, hm - 4.6, hm - 0.8, 1.7, '#ece4cf'); arch(2.25, hm - 4.3, hm - 1.1, 1.1, '#16120f'); arch(2.25, hm - 4.3, hm - 1.3, 0.9, DARKGLASS); }
  else { R(0, 0, 4.5, 1.1, '#c2b8a0'); arch(2.25, 3.0, 7.4, 1.5, '#cfc6ae'); arch(2.25, 3.2, 7.1, 1.1, '#2a2420'); R(1.4, 2.8, 3.1, 3.1, '#e9e1cc'); }
  R(0, hm - 0.7, 4.5, hm, '#e9e1cc'); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '55,48,40');
}
function paintDrum(g, w, h) {   // one eighth of the drum: 4.1 m wide, 10 m tall; a tall arched window in the upper part, plain wall below it (hidden in the roof)
  const sx = w / 4.1, sy = h / 10, X = x => x * sx, Y = y => h - y * sy;
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.1, 10, 0.6, 1.4, '#dcd1b6', '#bcb198', 4231, 1.0, 0.05);
  g.fillStyle = '#ebe3ce'; g.fillRect(0, Y(10), 0.45 * sx, 10 * sy); g.fillRect(X(3.65), Y(10), 0.45 * sx, 10 * sy);   // pilaster halves at the joins
  arch(2.05, 4.6, 9.0, 1.6, '#ece4cf'); arch(2.05, 4.9, 8.7, 1.05, '#16120f'); arch(2.05, 4.9, 8.5, 0.9, DARKGLASS);
  g.fillStyle = '#ebe3ce'; g.fillRect(0, Y(10), w, 0.6 * sy); g.fillRect(0, Y(5.0), w, 0.0);
  streaks(g, w, h, 6, 4232, 0.1, 40, '55,48,40');
}

function buildSantIgnazio() {
  initShared();
  const pts = pairsOf(SI.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-9, FZ + 1)), groundY(...W(9, FZ + 1)), groundY(...W(0, FZ + 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('siFront', 512, 512, [FW, FH], paintFront);
  defMat('siBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 4221));
  defMat('siNave', 128, 128, [4.5, NAVE_EAVE - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_EAVE - EAVE, true, 4222));
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
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 11.4); s.lineTo(7.9, 11.4); s.bezierCurveTo(7.0, 12.6, 5.9, 14.4, 5.3, 16.8); s.lineTo(5.3, 17.9); s.lineTo(5.4, 18.6); s.lineTo(0, 23.0); s.lineTo(-5.4, 18.6); s.lineTo(-5.3, 17.9); s.lineTo(-5.3, 16.8);
  s.bezierCurveTo(-5.9, 14.4, -7.0, 12.6, -7.9, 11.4); s.lineTo(-hw, 11.4); s.lineTo(-hw, 0);
  extrude('siFront', s, 1.2, { M: at(0, 0, FZ - 1.2), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // cornices that stand out of the front, the pediment's raking cornice, a block with a cross on top
  bx('flat', F, -hw - 0.3, hw + 0.3, 10.2, 10.45, FZ - 0.1, FZ + 0.7, { c: DRESS, noao: true });
  bx('flat', F, -5.6, 5.6, 17.85, 18.1, FZ - 0.1, FZ + 0.5, { c: DRESS, noao: true });
  bx('flat', F, -0.7, 0.7, 22.7, 23.8, FZ - 0.9, FZ - 0.1, { c: '#d6c096' });
  bx('flat', F, -0.06, 0.06, 23.8, 25.3, FZ - 0.55, FZ - 0.43, { c: '#3e3a36', noao: true }); bx('flat', F, -0.45, 0.45, 24.6, 24.74, FZ - 0.55, FZ - 0.43, { c: '#3e3a36', noao: true });
  // lower order: six big grey marble columns on pedestals, a broken entablature over each; two small columns beside the portal
  for (const x of [-10.2, -8.0, -4.1, 4.1, 8.0, 10.2]) {
    bx('flat', F, x - 0.85, x + 0.85, 0.0, 1.5, FZ + 0.25, FZ + 1.75, { c: DRESS });
    cyl('flat', 0.55, 0.6, 8.6, 12, { M: at(x, 1.5, FZ + 1.0), c: MARBLE });
    bx('flat', F, x - 0.8, x + 0.8, 10.1, 10.6, FZ + 0.2, FZ + 1.8, { c: '#d6c096' });
    bx('flat', F, x - 1.0, x + 1.0, 10.6, 11.5, FZ - 0.1, FZ + 1.95, { c: DRESS });
  }
  for (const x of [-1.95, 1.95]) { cyl('flat', 0.22, 0.24, 5.2, 10, { M: at(x, 0.9, FZ + 0.55), c: MARBLE }); bx('flat', F, x - 0.35, x + 0.35, 6.1, 6.45, FZ + 0.2, FZ + 0.9, { c: '#d6c096' }); }
  // upper order: two slender columns either side of the window, each on a pedestal
  for (const x of [-3.6, 3.6]) {
    bx('flat', F, x - 0.55, x + 0.55, 11.5, 12.6, FZ + 0.2, FZ + 1.0, { c: DRESS });
    cyl('flat', 0.3, 0.33, 5.0, 10, { M: at(x, 12.6, FZ + 0.6), c: MARBLE });
    bx('flat', F, x - 0.5, x + 0.5, 17.6, 18.0, FZ + 0.15, FZ + 1.05, { c: '#d6c096' });
  }
  for (let i = 0; i < 3; i++) bx('stone', F, -5.0 - i * 0.2, 5.0 + i * 0.2, -0.3, 0.18 * (3 - i), FZ + 1.7, FZ + 1.7 + 0.35 * (i + 1), { c: '#d8cfb8' });
  // the two bell towers over the outer bays: a shaft with a clock, a bell stage with two arched openings, a lead cap with a lantern
  for (const sg of [-1, 1]) {
    const cx = sg * 8.8, T = at(cx, 0, 0);
    bx('flat', T, -2.2, 2.2, 11.4, 19.0, -4.6, FZ - 0.05, { c: '#cfae72' });
    bx('flat', T, -1.4, 1.4, 12.4, 17.4, FZ - 0.05, FZ + 0.1, { c: PLASTER, noao: true });
    cyl('flat', 0.95, 0.95, 0.12, 14, { M: T, p: [0, 14.8, FZ + 0.1], rx: PI / 2, c: '#efe9d6', noao: true });
    bx('flat', T, -0.04, 0.04, 14.8, 15.6, FZ + 0.2, FZ + 0.3, { c: '#2a2622', noao: true }); bx('flat', T, 0, 0.5, 14.8, 14.86, FZ + 0.2, FZ + 0.3, { c: '#2a2622', noao: true });
    bx('flat', T, -2.6, 2.6, 19.0, 19.7, -5.0, FZ + 0.4, { c: '#d6c096' });
    bx('flat', T, -1.8, 1.8, 19.7, 24.0, -4.2, -0.4, { c: '#cfae72' });
    for (const x of [-0.85, 0.85]) { bx('flat', T, x - 0.62, x + 0.62, 20.5, 23.5, -0.45, -0.3, { c: '#e0cd9e' }); bx('flat', T, x - 0.42, x + 0.42, 20.7, 23.0, -0.5, -0.32, { c: '#1d1712', noao: true }); }
    bx('flat', T, -1.55, 1.55, 19.8, 20.4, -0.5, -0.3, { c: '#bdb09a' });
    bx('flat', T, -2.3, 2.3, 24.0, 24.6, -4.6, 0.1, { c: '#d6c096' });
    lathe('lead', [[0, 0], [2.0, 0], [2.15, 0.5], [1.8, 1.3], [1.1, 2.0], [0.6, 2.5], [0.75, 2.9], [0.35, 3.4], [0, 4.2]], 10, { M: T, p: [0, 24.6, -2.3], c: '#9aa09a', noao: true });
    bx('flat', T, -0.06, 0.06, 28.4, 29.6, -2.36, -2.24, { c: '#3e3a36', noao: true }); bx('flat', T, -0.4, 0.4, 29.0, 29.12, -2.36, -2.24, { c: '#3e3a36', noao: true });
  }
  // the dome: a drum with eight windows, a cornice, the lead dome, a lantern, a cross
  const D = at(DX, DY, DZ);
  cyl('siDrum', DR, DR, DH, 16, { M: D });
  cyl('flat', DR + 0.35, DR + 0.35, 0.5, 16, { M: mul(D, tr(0, DH, 0)), c: '#e6dec8', noao: true });
  lathe('lead', [[0, 0], [DR + 0.1, 0], [DR - 0.1, 0.9], [DR - 0.9, 2.5], [DR - 2.2, 4.0], [DR - 3.7, 5.1], [DR - 4.5, 5.6], [1.0, 6.0], [0, 6.1]], 16, { M: mul(D, tr(0, DH + 0.5, 0)), c: '#9aa09a', noao: true });
  const L = mul(D, tr(0, DH + 0.5 + 5.9, 0));
  cyl('flat', 1.2, 1.2, 2.2, 8, { M: L, c: '#e2dac4', noao: true });
  cyl('flat', 1.4, 1.4, 0.3, 8, { M: mul(L, tr(0, 2.2, 0)), c: '#e6dec8', noao: true });
  lathe('lead', [[0, 0], [1.3, 0], [0.9, 0.8], [0.4, 1.5], [0, 1.9]], 8, { M: mul(L, tr(0, 2.5, 0)), c: '#9aa09a', noao: true });
  bx('flat', L, -0.07, 0.07, 4.3, 5.8, -0.07, 0.07, { c: '#3e3a36', noao: true }); bx('flat', L, -0.4, 0.4, 5.1, 5.25, -0.07, 0.07, { c: '#3e3a36', noao: true });
  const o = end("Chiesa di Sant'Ignazio all'Olivella");
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SI.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_EAVE + RISE]];
  return o;
}
export const SANT_IGNAZIO = { name: "Chiesa di Sant'Ignazio all'Olivella", x: -60, z: -532, radius: 40, skipIds: [SI.id], build: buildSantIgnazio };
