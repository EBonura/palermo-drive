// Round 2 landmarks, batch X2: the Norman chapel of the Santissima Trinità alla Zisa with the church beside it, sheds and entrance sign of the Cantieri Culturali alla Zisa, the gas holder off
// Via Giuseppe La Villa, the Torre Sperlinga, the old Stazione Lolli, the grandstand of the Ippodromo della Favorita, the Velodromo Paolo Borsellino and the gate of the Cimitero dei Rotoli.
// Registered through src/lmc-r2.js. Photos were only looked at, nothing is copied. Frame F per place: origin on the ground in front of the named face, +z out of that face, local x to the right seen from outside.
// Sizes along the walls come from the footprints (SITR 2013 orthophoto used to check them); heights were read from the photos, so treat them as good to about half a metre to a metre unless said otherwise.
//
// Santissima Trinità alla Zisa (w279323274 church, w279329954 chapel), front to the east. Commons "Cappella della Santissima Trinità alla Zisa Exterior.jpg" and "... Total.jpg" (2024),
//  "Capella della santissima Trinità alla Zisa.jpg" (2009), "Chiesa di Gesù, Maria e Santo Stefano and Santissima Trinità alla Zisa, Palermo.jpg" (2022), "Santissima Trinità alla Zisa 03.jpg" (2019).
//  Read: on the north a golden sandstone church front with paired Ionic pilasters round a tall panelled door, a pediment with a round window, an arched window, a cornice, a balustrade with stone urns, an iron
//  cross, a cream attic and tiles behind; on the south the Norman chapel: ashlar blocks, a half round apse with a barred arched window, a raised drum and a brown dome.
//  Not verified: the back and the north flank of the church, the back of the chapel, the exact set back of the apse.
// Cantieri Culturali alla Zisa. Mapillary 5751289148229460, 289845849457053, 3944236882319206, 857639331481390, 912870379275369, 2610948999208854 (November 2015), Commons
//  "Cantieri Culturali della Zisa di Palermo A.jpg" (2016, the entrance sign), "... The Wall ..." (2016). Four of the 29 buildings: the tall shed with rusty steel doors under an ochre bowed gable (w279328067), the
//  long ZAC hangar with a glazed bowed gable (w279322836), the low white bowed shed west of it (w279326946), the rusty steel pipe on the lawn; the steel frame with the name at the Via Paolo Gili end.
//  Not verified: the sign's exact place (put by the end of the mapped wall, about 2 m either way), the backs of the sheds. The painted portraits on the first shed are not reproduced (blank white there);
//  the other 25 buildings stay generic.
// Gasometro (w990890861), Via Giuseppe La Villa. Mapillary 959068834884802, 951904252048934, 162863125845525, 285584409933641 (October 2019), SITR orthophoto. Read: an open guide frame of steel columns with
//  three railed walkway rings under a latticed top ring and crossed braces, over a low tank. Radius from the footprint, ring heights fitted to the street frames (about 3 m either way).
//  Not verified: the number of columns (18 taken from the spacing in the frames), the tank behind the wall, the south side.
// Torre Sperlinga (w25091496), Via Francesco Scaduto. Mapillary 224303559027002, 455682682163851, 862901817623999 (March 2019), orthophoto for the roof. Read: a white tower of 19 floors on a cross plan,
//  long loggias with white railings on the wide faces, piers dotted with ochre tiles, small slanted windows on the narrow returns, a round plant floor on top.
//  Not verified: which faces carry loggias (the four arm ends are taken), the ground floor, the north and west sides.
// Ex Stazione Lolli (w278802638), front to Piazza Lolli. Commons "Stazione Palermo Lolli (1891-1974), 19 Aprile 2025 - 01.jpg" and "- 02.jpg", "Stazione di Palermo Lolli.jpg" and "... particolare.jpg" (2010).
//  Read: a middle block of five bays, tall arched doors in banded stone below, cream upper floor with pilasters, shuttered windows over balustrade panels, a pedimented middle window, a heavy cornice and the
//  clock in its stone frame; lower stone wings with arched openings. Not verified: the back, the number of wing arches, the roof of the wings. Graffiti is not copied.
// Ippodromo della Favorita, grandstand (w280101532). Photo on livesicilia.it ("Palermo riscopre la passione per l'ippica", 2021), the aerial photo on balarm.it, orthophoto. Read: long stone steps under a
//  cantilevered concrete roof on tapered ribs, rising towards the track, boxes with a dark red band at the back. Not verified: the outside of the back wall, the ends, the number of ribs.
// Velodromo Paolo Borsellino (w1447672285, w285427398, w285430365). Commons "Athletic Club Palermo v ACR Messina, 4 January 2026" (01, 09, 28, 29), "La gradinata del Velodromo Paolo Borsellino.jpg" (2009),
//  orthophoto. Read: the covered west stand with a black cantilevered roof, dark seat blocks with a gold eagle or a ring of stars over striped lower rows; the open east stand with coloured rows; the yellow banked
//  track; four floodlight masts. Not verified: heights of the stand and masts (estimates), mast places (read from their shadows), the outer faces of both stands, the height of the banking.
// Cimitero di Santa Maria dei Rotoli, gate on Via Vergine Maria. Mapillary 936842480218149, 1259678964451011, 2987288298154098, 266856388239062 (October 2019). Read: two massive stone piers with a moulded
//  cornice, an attic and marble tablets, tall iron lattice gates, the stone boundary wall with pilasters. The gates are drawn open. Not verified: anything behind the gate; the wall is only drawn for 24 m south of it.
// Not built: Conservatorio di Musica (r1291641.0). Only its portal is clearly photographed and its place on the 85 m block could not be fixed; no photo found shows the street fronts for certain, so it stays generic.
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, extrude, part, prism, lathe, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, streaks, pairsOf, groundRange, paintAshlar, archShape, RNG } from './lmc-kit.js';

// ---- shared helpers
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// the frame of a place: origin O on the ground, outward normal N
function site(O, N, probe = [[0, 0.6]]) {
  const W = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const y0 = Math.min(...probe.map(q => groundY(...W(...q))));
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  return { W, y0, F, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
// a frame in the middle of the wall from a to b (world points) at height y, +z out of the polygon poly
function edge(a, b, poly, y) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = -dz / l, nz = dx / l;
  if (inPoly(poly, mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; }
  return { M: frame(mx, y, mz, nx, nz), l, nx, nz };
}
// painter for one region r = [px, py, pw, ph, Wm, Hm] of a canvas: metres, x centred, y up from the bottom of the region
function region(g, r, draw) {
  const [px, py, pw, ph, Wm, Hm] = r, sx = pw / Wm, sy = ph / Hm, X = x => (x + Wm / 2) * sx, Y = y => ph - y * sy;
  g.save(); g.translate(px, py); g.beginPath(); g.rect(0, 0, pw, ph); g.clip();
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, ww, c, rise = ww / 2) => { const rr = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - rr), Y(y0)); g.lineTo(X(x - rr), Y(y1 - rise)); g.ellipse(X(x), Y(y1 - rise), rr * sx, rise * sy, 0, PI, 0); g.lineTo(X(x + rr), Y(y0)); g.closePath(); g.fill(); };
  const circ = (x, y, rr, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rr * sx, rr * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  draw({ R, poly, arch, circ, line, X, Y, sx, sy, Wm, Hm, pw, ph });
  g.restore();
}
// a flat textured rectangle x0..x1, y0..y1 at depth z of the frame M, showing the region r of a cw x ch canvas (the part u0..u1 of its width, v0..v1 of its height, v beyond 1 repeats)
function quadR(key, [cw, ch], r, M, x0, x1, y0, y1, z, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const [px, py, pw, ph] = r;
  part(key, new THREE.PlaneGeometry(x1 - x0, y1 - y0), { M, p: [(x0 + x1) / 2, (y0 + y1) / 2, z], uv: 'keep', uvk: [(u1 - u0) * pw / cw, (v1 - v0) * ph / ch], uvo: [(px + u0 * pw) / cw, 1 - (py + ph) / ch + v0 * ph / ch], noao: true });
}
// a textured face with the outline p (metres in the frame M) at depth z, showing region r at the same metres (x centred on ox, y from oy)
function faceR(key, [cw, ch], r, M, p, z, ox = 0, oy = 0) {
  const [px, py, pw, ph, Wm, Hm] = r, ku = pw / Wm / cw, kv = ph / Hm / ch;
  part(key, new THREE.ShapeGeometry(shapeOf(p)), { M, p: [0, 0, z], uv: 'keep', uvk: [ku, kv], uvo: [(px + pw / 2) / cw - ox * ku, 1 - (py + ph) / ch - oy * kv], noao: true });
}
// loose triangles (points in the frame M, anticlockwise seen from the side that shows)
function tris(key, M, T, c) {
  const pos = []; for (const t of T) for (const p of t) pos.push(p[0], p[1], p[2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); g.computeVertexNormals();
  part(key, g, { M, c, noao: true });
}
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
const both = (a, b, c, d) => [...quad(a, b, c, d), ...quad(d, c, b, a)];
// a straight member from a to b in the frame M
function beam(M, a, b, r, c, seg = 3) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  cyl('flat', r, r, l, seg, { M: mul(M, new THREE.Matrix4().compose(new THREE.Vector3(...a), q, new THREE.Vector3(1, 1, 1))), open: true, c, noao: true });
}
// a hipped roof over x0..x1, z0..z1 from height y, ridge along x
function hip(M, x0, x1, z0, z1, y, rise, c, key = 'tile') {
  const zm = (z0 + z1) / 2, run = Math.min((z1 - z0) / 2, (x1 - x0) / 2 - 0.1), a = [x0, y, z1], b = [x1, y, z1], cc = [x1, y, z0], d = [x0, y, z0], r0 = [x0 + run, y + rise, zm], r1 = [x1 - run, y + rise, zm];
  tris(key, M, [...quad(a, b, r1, r0), ...quad(cc, d, r0, r1), [b, cc, r1], [d, a, r0]], c);
}
const ringWalls = (P) => P.map((p, i) => [...p, ...P[(i + 1) % P.length]]);
const pathWalls = (P) => P.slice(1).map((q, i) => [...P[i], ...q]);

// =====================================================================================================
// Santissima Trinità alla Zisa: the 18th century church and the Norman chapel
// =====================================================================================================
const TR = { ids: ['w279323274', 'w279329954'],
  ch: [-1778.0, -193.6, -1776.5, -194.8, -1758.7, -195.3, -1758.7, -194.0, -1758.6, -188.4, -1758.6, -187.4, -1771.5, -187.2, -1776.4, -187.1, -1777.9, -188.0, -1778.9, -189.4, -1778.9, -192.3],
  nc: [-1771.5, -187.3, -1759.3, -187.4, -1759.3, -181.8, -1761.4, -181.5, -1761.6, -177.6, -1771.5, -177.4, -1771.5, -181.3] };
const TR_O = [-1758.62, -191.35], TR_N = [1, 0];
const TR_CV = [256, 384], TR_R = [0, 0, 256, 384, 7.9, 13.4];
function trPaint(g, w, h) {
  paintAshlar(g, w, h, 7.9, 13.4, 0.42, 0.85, '#b19674', '#857055', 5201, 1, 0.1);
  region(g, TR_R, ({ R, circ, line, X, Y, sx, sy }) => {
    const r = RNG(5202);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? 'rgba(80,55,30,0.16)' : 'rgba(255,232,190,0.14)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 14, 2 + r() * 9, 0, 0, 2 * PI); g.fill(); }
    // the smoother stone of the portal, then the door and its frame
    R(-3.2, 0.3, 3.2, 6.0, 'rgba(165,120,70,0.38)');
    R(-1.4, 0.2, 1.4, 4.85, '#a98556'); R(-1.2, 0.2, 1.2, 4.65, '#8c6b44'); R(-1.0, 0.25, 1.0, 4.45, '#5d3322');
    for (const x of [-0.72, -0.24, 0.24, 0.72]) for (let y = 0.45; y < 4.2; y += 0.56) { R(x - 0.19, y, x + 0.19, y + 0.42, '#74422b'); R(x - 0.13, y + 0.06, x + 0.13, y + 0.36, '#673a26'); }
    R(-0.025, 0.25, 0.025, 4.45, '#2c170f');
    R(-0.65, 5.15, 0.65, 5.75, '#b18c5c');
    // the oculus in the pediment, the upper window with its moulded head
    circ(0, 7.75, 0.5, '#9c7a4e'); circ(0, 7.75, 0.36, '#2f2a27'); for (const d of [-0.12, 0.12]) { line(d, 7.43, d, 8.07, 0.025, '#8d7a62'); line(-0.32, 7.75 + d, 0.32, 7.75 + d, 0.025, '#8d7a62'); }
    g.fillStyle = '#a07e52'; g.beginPath(); g.moveTo(X(-1.4), Y(9.45)); g.lineTo(X(-1.4), Y(11.35)); g.ellipse(X(0), Y(11.35), 1.4 * sx, 0.9 * sy, 0, PI, 0); g.lineTo(X(1.4), Y(9.45)); g.fill();
    g.fillStyle = '#5c6366'; g.beginPath(); g.moveTo(X(-1.02), Y(9.65)); g.lineTo(X(-1.02), Y(11.25)); g.ellipse(X(0), Y(11.25), 1.02 * sx, 0.62 * sy, 0, PI, 0); g.lineTo(X(1.02), Y(9.65)); g.fill();
    for (const x of [-0.5, 0, 0.5]) R(x - 0.025, 9.65, x + 0.025, 11.8, '#a3937a'); for (const y of [10.35, 11.05]) R(-1.02, y - 0.025, 1.02, y + 0.025, '#a3937a');
    for (const x of [-2.55, 2.55]) { R(x - 0.32, 9.2, x + 0.32, 12.7, 'rgba(255,225,180,0.16)'); R(x + 0.32, 9.2, x + 0.38, 12.7, 'rgba(70,45,20,0.3)'); }
    const gb = g.createLinearGradient(0, h, 0, h * 0.84); gb.addColorStop(0, 'rgba(55,40,25,0.35)'); gb.addColorStop(1, 'rgba(55,40,25,0)'); g.fillStyle = gb; g.fillRect(0, h * 0.84, w, h * 0.16);
  });
  streaks(g, w, h, 26, 5203, 0.12, 70, '70,48,28');
}
function buildTrinita() {
  initShared();
  defMat('x2Trin', TR_CV[0], TR_CV[1], [7.9, 13.4], trPaint);
  const S = site(TR_O, TR_N, [[0, 0.5], [-7, 1.5]]), { F, y0, at } = S;
  begin(y0);
  const ch = pairsOf(TR.ch), nc = pairsOf(TR.nc), lo = Math.min(groundRange(ch).lo, y0) - 1.2;
  const STONE = '#c6ad8a', TRIM = '#a88a62', DARKT = '#8d7252';
  // ---- the church: body, painted front, orders
  prism('tufa', ch, lo, y0 + 13.4, { c: STONE });
  prism('flat', ch, y0 + 13.4, y0 + 13.48, { c: '#9b8e7e' });
  quadR('x2Trin', TR_CV, TR_R, F, -3.95, 3.95, 0, 13.4, 0.07);
  bx('tufa', F, -3.95, 3.95, -0.6, 0.35, 0, 0.22, { c: '#a99070' });
  for (const s of [-1, 1]) for (const x of [1.95, 2.85]) {
    bx('tufa', F, s * x - 0.3, s * x + 0.3, 0.35, 5.35, 0.05, 0.25, { c: '#b89c76' });
    bx('flat', F, s * x - 0.4, s * x + 0.4, 5.35, 5.68, 0.05, 0.36, { c: TRIM });
    for (const t of [-0.3, 0.3]) cyl('flat', 0.13, 0.13, 0.14, 6, { M: F, p: [s * x + t, 5.43, 0.3], rx: PI / 2, c: '#c8a878', noao: true });
  }
  bx('flat', F, -1.5, 1.5, 4.85, 5.1, 0.05, 0.34, { c: TRIM });
  bx('flat', F, -3.35, 3.35, 5.7, 6.0, 0.05, 0.3, { c: DARKT }); bx('tufa', F, -3.3, 3.3, 6.0, 6.62, 0.05, 0.24, { c: '#b49872' }); bx('flat', F, -3.55, 3.55, 6.62, 6.92, 0.05, 0.55, { c: TRIM });
  const rise = 2.45, half = 3.55, ang = Math.atan2(rise, half), len = Math.hypot(rise, half);
  for (const s of [-1, 1]) box('flat', len + 0.2, 0.26, 0.5, { M: F, p: [s * half / 2, 6.92 + rise / 2 - 0.06, 0.28], rz: -s * ang, c: TRIM, noao: true });
  for (const [x0, x1, y1, y2] of [[-1.2, -1.02, 9.5, 11.3], [1.02, 1.2, 9.5, 11.3], [-1.3, 1.3, 9.38, 9.55]]) bx('flat', F, x0, x1, y1, y2, 0.05, 0.2, { c: DARKT });
  for (let i = 0; i < 7; i++) { const a = PI * (i + 0.5) / 7; box('flat', 0.56, 0.18, 0.15, { M: F, p: [-Math.cos(a) * 1.16, 11.2 + Math.sin(a) * 0.76, 0.12], rz: Math.atan2(Math.cos(a) * 0.76, Math.sin(a) * 1.16), c: DARKT, noao: true }); }
  bx('flat', F, -4.05, 4.05, 12.85, 13.1, 0.05, 0.3, { c: DARKT }); bx('flat', F, -4.2, 4.2, 13.1, 13.45, -0.1, 0.6, { c: TRIM });
  // balustrade with its urns, the iron cross
  bx('flat', F, -4.0, 4.0, 13.45, 13.68, -0.2, 0.28, { c: TRIM }); bx('flat', F, -4.0, 4.0, 14.38, 14.58, -0.2, 0.28, { c: TRIM });
  const PED = [-3.65, -1.85, 0, 1.85, 3.65];
  for (const x of PED) {
    bx('flat', F, x - 0.33, x + 0.33, 13.68, 14.38, -0.18, 0.26, { c: TRIM });
    lathe('flat', [[0, 0], [0.13, 0], [0.1, 0.16], [0.3, 0.36], [0.3, 0.54], [0.12, 0.7], [0.15, 0.76], [0, 0.95]], 5, { M: F, p: [x, 14.56, 0.04], c: '#8c7458' });
  }
  for (let i = 0; i < 4; i++) for (let k = 1; k <= 4; k++) { const x = PED[i] + (PED[i + 1] - PED[i]) * (0.18 + (k - 0.5) * 0.16); cyl('flat', 0.07, 0.12, 0.7, 4, { M: F, p: [x, 13.68, 0.04], open: true, c: '#b99a70' }); }
  bx('flat', F, -0.04, 0.04, 15.4, 17.5, 0.0, 0.08, { c: '#3a3028', noao: true }); bx('flat', F, -0.55, 0.55, 16.75, 16.83, 0.0, 0.08, { c: '#3a3028', noao: true });
  // the cream attic set back behind the balustrade, and the tiled roof over the nave
  bx('flat', F, -3.75, 3.75, 13.4, 14.95, -19.2, -1.3, { c: '#e6d8ba' });
  for (const s of [-1, 1]) bx('flat', F, s * 1.5 - 0.5, s * 1.5 + 0.5, 13.9, 14.75, -1.32, -1.26, { c: '#5a4a3c', noao: true });
  hip(mul(at(0, 0, -10.25), rotY(PI / 2)), -9.35, 9.35, -4.05, 4.05, 14.95, 1.45, '#d9a478');
  // ---- the chapel: block, apse, drum and dome
  prism('tufa', nc, lo, y0 + 8.9, { c: '#aea292' });
  prism('flat', nc, y0 + 8.9, y0 + 8.98, { c: '#a8674a' });
  const AX = -6.75, AZ = -0.68, AR = 1.55;
  cyl('tufa', AR, AR, 8.3 + y0 - lo, 14, { M: F, p: [AX, lo - y0, AZ], t0: -PI / 2, tl: PI, open: true, c: '#b2a695' });
  cyl('flat', AR + 0.08, AR + 0.08, 0.2, 14, { M: F, p: [AX, 8.25, AZ], t0: -PI / 2, tl: PI, c: '#a58c68', noao: true });
  const win = (M, x, y, z, ww, hh) => {
    extrude('flat', archShape(ww + 0.5, hh + 0.28), 0.1, { M, p: [x, y - 0.03, z - 0.1], c: '#b29268', noao: true });
    extrude('flat', archShape(ww, hh), 0.1, { M, p: [x, y, z - 0.07], c: '#2a231d', noao: true });
    for (let i = 1; i < 4; i++) bx('flat', M, x - ww / 2 + i * ww / 4 - 0.02, x - ww / 2 + i * ww / 4 + 0.02, y, y + hh - 0.15, z + 0.02, z + 0.05, { c: '#6a5a48', noao: true });
    for (let k = 1; k < 5; k++) bx('flat', M, x - ww / 2, x + ww / 2, y + k * hh / 5.4, y + k * hh / 5.4 + 0.035, z + 0.02, z + 0.05, { c: '#6a5a48', noao: true });
  };
  win(F, AX, 4.3, AZ + AR, 0.95, 2.15);
  for (const x of [-9.0, -4.45]) cyl('flat', 0.1, 0.1, 0.6, 6, { M: F, p: [x, 7.7, AZ - 0.1], rx: PI / 2, c: '#8a5a40', noao: true });
  bx('tufa', F, AX - 2.15, AX + 2.15, 8.9, 10.55, -5.0, -0.72, { c: '#ac9c85' });
  bx('flat', F, AX - 2.25, AX + 2.25, 10.5, 10.66, -5.1, -0.62, { c: '#8f7d64' });
  extrude('flat', archShape(0.55, 0.75), 0.08, { M: F, p: [AX, 9.35, -0.76], c: '#2a231d', noao: true });
  part('flat', new THREE.SphereGeometry(1.95, 16, 6, 0, 2 * PI, 0, PI / 2), { M: F, p: [AX, 10.62, -2.86], s: [1, 1.12, 1], c: '#7f5a44' });
  const o = end('Santissima Trinita alla Zisa');
  o.userData.solids = [[TR.ch, null, y0 + 14.9], [TR.nc, null, y0 + 8.9]];
  return o;
}
const trWalls = () => { const W = (x, z) => [TR_O[0] + z, TR_O[1] - x]; return pathWalls([W(-8.4, -0.7), W(-7.6, 0.95), W(-5.9, 0.95), W(-5.1, -0.7)]); };

// =====================================================================================================
// Cantieri Culturali alla Zisa (the old Ducrot furniture works)
// =====================================================================================================
const CA = {
  rust: { id: 'w279328067', p: [-2009.7, -285.9, -1998.2, -233.3, -2021.1, -228.4, -2032.6, -281.0] },
  white: { id: 'w279326946', p: [-2023.3, -216.8, -2020.5, -204.7, -2051.2, -197.7, -2056.2, -202.2, -2061.4, -208.5] },
  zac: { id: 'w279322836', p: [-1859.7, -252.1, -1856.5, -237.2, -1861.8, -236.1, -1867.9, -234.7, -1938.5, -219.2, -1949.0, -216.8, -1953.6, -216.0, -1953.5, -215.5, -1977.1, -210.1, -1978.4, -215.6, -1979.7, -221.1, -1980.6, -225.0] },
};
const CA_CV = [512, 384];
const caR = {
  G: [0, 0, 300, 168, 23.4, 13.1],   // the rusty doors under the ochre bow
  E: [300, 0, 106, 106, 9, 9],       // a bay of its east side
  Z: [0, 170, 260, 187, 15.4, 11.1], // the ZAC end
  L: [260, 170, 100, 130, 6, 7.8],   // a bay of the ZAC hangar's long side
  W: [260, 304, 160, 80, 12.4, 6.2], // the white shed's end
  P: [406, 0, 106, 106, 9, 9],       // plain white wall
};
// the bow of a gable: eaves height at the two ends, apex in the middle, as points from left to right
const bow = (half, ye, ya, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const t = -1 + 2 * i / n; return [t * half, ye + (ya - ye) * (1 - t * t)]; });
function caPaint(g, w, h) {
  g.fillStyle = '#e4ded0'; g.fillRect(0, 0, w, h);
  const r = RNG(5301);
  region(g, caR.G, ({ R, poly, line }) => {
    R(-11.7, 0, 11.7, 13.1, '#c9a56a');
    R(-10.6, 0, 10.6, 8.7, '#48443e');
    for (let x = -10.6; x < 10.6; x += 1.77) { R(x, 0, x + 1.7, 8.7, ['#4a4741', '#54504a', '#433f3a'][Math.floor(r() * 3)]); R(x + 1.7, 0, x + 1.77, 8.7, '#25221f'); for (let i = 0; i < 4; i++) { const y = r() * 7; R(x + r() * 1.1, y, x + 0.5 + r() * 1.2, y + 0.5 + r() * 2.4, `rgba(${130 + r() * 40},${70 + r() * 20},40,${0.2 + r() * 0.25})`); } }
    R(-10.6, 5.6, 10.6, 5.68, '#2b2824'); R(-10.6, 8.7, 10.6, 8.95, '#8c744c'); R(5.2, 0, 6.5, 2.3, '#3f6f9a');
    R(-11.7, 0, -10.6, 9.2, '#c4a066'); R(10.6, 0, 11.7, 9.2, '#c4a066');
  });
  region(g, caR.E, ({ R }) => {
    R(-4.5, 0, 4.5, 9, '#e6e2d8');
    R(-3.2, 5.3, 2.8, 8.2, '#5c4a3a'); for (let x = -3.2; x < 2.8; x += 0.5) R(x, 5.3, x + 0.09, 8.2, '#3d3028'); R(-3.2, 6.7, 2.8, 6.85, '#8a7560');
    R(-3.2, 0.25, 2.8, 4.1, '#262a28'); R(-3.2, 3.0, 2.8, 4.1, '#52443a'); for (let x = -3.2; x < 2.8; x += 0.75) R(x, 0.25, x + 0.07, 4.1, '#171a19');
    R(-4.5, 0, 4.5, 0.25, '#b8b0a0');
  });
  region(g, caR.P, ({ R }) => { R(-4.5, 0, 4.5, 9, '#e2ddd0'); R(-4.5, 0, 4.5, 0.4, '#b8b0a0'); R(-3.3, 5.4, -1.2, 7.2, '#6b6258'); R(1.2, 5.4, 3.3, 7.2, '#6b6258'); });
  region(g, caR.Z, ({ R, poly, line, X, Y, sy }) => {
    R(-7.7, 0, 7.7, 11.1, '#e9e3d4');
    for (const [x0, x1] of [[-4.9, -1.75], [-1.55, 1.45], [1.65, 4.8]]) {
      const top = x => 8.0 + 2.85 * (1 - (x / 7.7) ** 2) - 0.55;
      poly([[x0, 6.9], [x1, 6.9], [x1, top(x1)], [(x0 + x1) / 2, top((x0 + x1) / 2)], [x0, top(x0)]], '#5f7f78');
      for (let i = 1; i < 5; i++) { const x = x0 + (x1 - x0) * i / 5; line(x, 6.9, x, top(x), 0.07, '#d9d6c8'); } line(x0, 8.4, x1, 8.4, 0.07, '#d9d6c8');
    }
    R(-4.6, 0, 4.0, 4.5, '#2b3032'); R(-4.6, 3.25, 4.0, 3.4, '#8d9294'); for (let x = -4.6; x <= 4.0; x += 1.23) R(x - 0.05, 0, x + 0.05, 4.5, '#8d9294');
    R(0.9, 0, 4.0, 3.2, '#a85a48'); g.fillStyle = '#f2eee6'; g.font = `bold ${Math.round(1.25 * sy)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ZAC', X(2.45), Y(1.7));
    R(-7.7, 0, 7.7, 0.25, '#bab2a2'); R(-6.6, 0.8, -5.7, 3.1, '#6d675e');
  });
  region(g, caR.L, ({ R }) => {
    R(-3, 0, 3, 7.8, '#e7e1d2'); R(-3, 0, -2.6, 7.8, '#d6cfbd'); R(-1.6, 4.4, 1.8, 6.3, '#59686a'); for (let x = -1.6; x <= 1.8; x += 0.68) R(x - 0.04, 4.4, x + 0.04, 6.3, '#cfcabd');
    R(-1.0, 1.1, 1.2, 2.7, '#59686a'); R(0.06, 1.1, 0.14, 2.7, '#cfcabd'); R(-3, 0, 3, 0.3, '#b8b0a0'); R(-3, 7.55, 3, 7.8, '#bdb5a2');
  });
  region(g, caR.W, ({ R }) => { R(-6.2, 0, 6.2, 6.2, '#eeebe2'); R(-3.6, 0, -0.2, 3.1, '#2a2c2c'); R(-3.75, 3.1, -0.05, 3.3, '#c8c4b8'); R(2.2, 0, 3.4, 2.5, '#55585a'); R(-6.2, 0, 6.2, 0.2, '#c0baac'); });
  g.save(); streaks(g, w, h, 70, 5302, 0.13, 60, '90,70,45'); g.restore();
}
function caMats() { initShared(); defMat('x2Cant', CA_CV[0], CA_CV[1], [20, 14], caPaint); }
// a bowed roof between two end edges: a0-a1 one gable (left to right seen from outside it), b0-b1 the far one, in world metres
function barrel(a0, a1, b0, b1, ye, ya, c, n = 8, key = 'flat') {
  const row = (p, q) => Array.from({ length: n + 1 }, (_, i) => { const k = i / n, t = 2 * k - 1; return [p[0] + (q[0] - p[0]) * k, ye + (ya - ye) * (1 - t * t), p[1] + (q[1] - p[1]) * k]; });
  const A = row(a0, a1), B = row(b0, b1);
  const T = []; for (let i = 0; i < n; i++) T.push(...both(A[i], A[i + 1], B[i + 1], B[i]));
  tris(key, new THREE.Matrix4(), T, c);
}
// the plain end wall under a bow, on the edge frame M (faces out of it)
const bowWall = (M, half, ye, ya, c) => { const b = bow(half, ye, ya); tris('flat', M, b.slice(0, -1).flatMap((a, i) => { const q = b[i + 1]; return [[[a[0], ye, 0.02], [q[0], ye, 0.02], [q[0], q[1], 0.02]], [[a[0], ye, 0.02], [q[0], q[1], 0.02], [a[0], a[1], 0.02]]]; }), c); };
// the dark or ochre edge of the bow
const bowRim = (M, half, ye, ya, c, th, d) => { const b = bow(half, ye, ya); for (let i = 0; i < b.length - 1; i++) { const a = b[i], q = b[i + 1]; box('flat', Math.hypot(q[0] - a[0], q[1] - a[1]) + 0.06, th, d, { M, p: [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2 - 0.08, 0], rz: Math.atan2(q[1] - a[1], q[0] - a[0]), c, noao: true }); } };
function buildCantWest() {
  caMats();
  const R = CA.rust, P = pairsOf(R.p), Q = pairsOf(CA.white.p);
  const y0 = Math.min(groundY(...P[1]), groundY(...P[2])), lo = Math.min(groundRange(P).lo, groundRange(Q).lo) - 1.2;
  begin(y0);
  // ---- the shed with the rusty doors: south gable P1-P2, east side P0-P1
  prism('flat', P, lo, y0 + 9, { c: '#ddd6c6' });
  const G = edge(P[1], P[2], P, y0), gh = G.l / 2;
  faceR('x2Cant', CA_CV, caR.G, G.M, [[-gh, 0], [gh, 0], ...bow(gh, 9, 13.1).reverse()], 0.05);
  bowRim(G.M, gh, 9, 13.1, '#b18d58', 0.22, 0.4);
  const back = edge(P[3], P[0], P, y0);
  bowWall(back.M, back.l / 2, 9, 13.1, '#d6cfbe');
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const E1 = mix(P[1], P[0], 0.36), E2 = mix(P[2], P[3], 0.36);
  barrel(P[2], P[1], E2, E1, y0 + 9.02, y0 + 13.05, '#77726c'); barrel(E2, E1, P[3], P[0], y0 + 9.02, y0 + 13.05, '#c58a5e');
  const E = edge(P[0], P[1], P, y0), nb = 6, bw = E.l / nb;
  for (let i = 0; i < nb; i++) quadR('x2Cant', CA_CV, caR.E, E.M, -E.l / 2 + i * bw, -E.l / 2 + (i + 1) * bw, 0, 9, 0.05);
  for (let i = 0; i <= nb; i++) bx('flat', E.M, -E.l / 2 + i * bw - 0.22, -E.l / 2 + i * bw + 0.22, 0, 9.05, -0.05, 0.14, { c: '#e0dacb' });
  // ---- the low white shed: its end Q0-Q1 faces the road to the east, the far end is Q4-Q2
  prism('flat', Q, lo, y0 + 4.3, { c: '#e6e2d8' });
  const W = edge(Q[0], Q[1], Q, y0), wh = W.l / 2;
  faceR('x2Cant', CA_CV, caR.W, W.M, [[-wh, 0], [wh, 0], ...bow(wh, 4.3, 6.1).reverse()], 0.05);
  barrel(Q[1], Q[0], Q[2], Q[4], y0 + 4.32, y0 + 6.1, '#e8e8e6');
  const far = edge(Q[2], Q[4], Q, y0);
  bowWall(far.M, far.l / 2, 4.3, 6.1, '#dedad0');
  const o = end('Cantieri Culturali, sheds west');
  o.userData.solids = [[R.p, null, y0 + 9], [CA.white.p, null, y0 + 4.3]];
  return o;
}
const PIPE_A = [-2000.0, -212.9], PIPE_B = [-1995.3, -220.7];
function buildCantEast() {
  caMats();
  const P = pairsOf(CA.zac.p), nw = P[11], sw = P[8], ne = P[0], se = [-1857.2, -237.1];
  const y0 = Math.min(groundY(...nw), groundY(...sw)), lo = groundRange(P).lo - 1.2;
  begin(y0);
  prism('flat', P, lo, y0 + 8, { c: '#e3ddcd' });
  // the west end: the glazed bow and the way in
  const W = edge(sw, nw, P, y0), wh = W.l / 2;
  faceR('x2Cant', CA_CV, caR.Z, W.M, [[-wh, 0], [wh, 0], ...bow(wh, 8, 11).reverse()], 0.06);
  bowRim(W.M, wh, 8, 11, '#3c3a38', 0.26, 0.6);
  for (const s of [-1, 1]) bx('flat', W.M, s * wh - 0.15, s * wh + 0.15, 0, 8.05, -0.1, 0.22, { c: '#e3ddcd' });
  // the long sides and the grey bowed roof
  barrel(nw, sw, ne, se, y0 + 8.02, y0 + 11, '#8f959b');
  const back = edge(se, ne, P, y0);
  bowWall(back.M, back.l / 2, 8, 11, '#d9d3c3');
  for (const [a, b, n] of [[nw, ne, 20], [P[8], P[7], 4], [P[5], P[4], 2], [P[4], P[3], 12]]) {
    const E = edge(a, b, P, y0), bw = E.l / n;
    for (let i = 0; i < n; i++) quadR('x2Cant', CA_CV, caR.L, E.M, -E.l / 2 + i * bw, -E.l / 2 + (i + 1) * bw, 0, 8, 0.05);
  }
  // the old steel pipe lying on the lawn
  const dx = PIPE_B[0] - PIPE_A[0], dz = PIPE_B[1] - PIPE_A[1], L = Math.hypot(dx, dz), mx = (PIPE_A[0] + PIPE_B[0]) / 2, mz = (PIPE_A[1] + PIPE_B[1]) / 2, gy = groundY(mx, mz);
  const PM = mul(frame(mx, gy + 1.45, mz, dx / L, dz / L), new THREE.Matrix4().makeRotationX(PI / 2));
  cyl('flat', 1.45, 1.45, L, 14, { M: PM, p: [0, -L / 2, 0], open: true, c: '#5d3a2c', noao: true });
  for (const k of [-L / 2, -L / 6, L / 6, L / 2 - 0.18]) cyl('flat', 1.54, 1.54, 0.18, 14, { M: PM, p: [0, k, 0], open: true, c: '#74452f', noao: true });
  for (const [k, s] of [[-L / 2, -1], [L / 2, 1]]) part('flat', new THREE.CircleGeometry(1.45, 14), { M: PM, p: [0, k, 0], rx: -s * PI / 2, c: '#241812', noao: true });
  const o = end('Cantieri Culturali, ZAC');
  o.userData.solids = [[CA.zac.p, null, y0 + 8]];
  return o;
}
const pipeWalls = () => { const dx = PIPE_B[0] - PIPE_A[0], dz = PIPE_B[1] - PIPE_A[1], l = Math.hypot(dx, dz), ox = -dz / l * 1.5, oz = dx / l * 1.5; return ringWalls([[PIPE_A[0] + ox, PIPE_A[1] + oz], [PIPE_B[0] + ox, PIPE_B[1] + oz], [PIPE_B[0] - ox, PIPE_B[1] - oz], [PIPE_A[0] - ox, PIPE_A[1] - oz]]); };
// the entrance sign: a steel frame on four posts at the end of the Via Paolo Gili wall, white letters on it, facing north
const SG_O = [-1812.8, -265.5], SG_POSTS = [-1.7, -0.9, 0.55, 1.96];
function signPaint(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = '#dfe4ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(h * 0.78)}px sans-serif`; const t = 'CANTIERI CULTURALI ALLA ZISA', m = g.measureText(t).width; g.save(); g.translate(w / 2, h / 2); g.scale(Math.min(1, (w - 10) / m), 1); g.lineWidth = 7; g.strokeStyle = '#47566c'; g.strokeText(t, 0, 1); g.fillStyle = '#e8eef6'; g.fillText(t, 0, 1); g.restore(); }
function buildCantSign() {
  initShared();
  defMat('x2CantSign', 512, 48, [4.6, 0.55], signPaint, { alphaTest: 0.45 });
  const S = site(SG_O, [0, -1], [[0, 0]]), { F, y0 } = S;
  begin(y0);
  const IRON = '#34363a';
  for (const x of SG_POSTS) bx('flat', F, x - 0.09, x + 0.09, -0.3, x === 0.55 ? 5.9 : 6.7, -0.09, 0.09, { c: IRON, noao: true });
  for (const [y, x0, x1] of [[6.0, -2.75, 3.05], [5.78, -2.75, 3.05], [4.3, -2.4, 2.9]]) bx('flat', F, x0, x1, y, y + 0.07, -0.05, 0.05, { c: IRON, noao: true });
  for (const [a, b] of [[-1.7, -0.9], [-0.9, 0.55], [0.55, 1.96]]) { beam(F, [a, 4.34, 0], [(a + b) / 2, 5.8, 0], 0.035, IRON); beam(F, [(a + b) / 2, 5.8, 0], [b, 4.34, 0], 0.035, IRON); }
  part('x2CantSign', new THREE.PlaneGeometry(5.1, 0.58), { M: F, p: [0.2, 5.15, 0.12], uv: 'keep', noao: true });
  // the blue gate post with its leaf folded back, the picture panel on the right post (left blank of its picture)
  bx('flat', F, 0.1, 0.9, 0, 2.55, -0.4, 0.4, { c: '#2f5f9e' });
  bx('flat', F, 0.9, 2.0, 0.15, 2.4, -0.42, -0.32, { c: '#35669f' });
  bx('flat', F, 1.15, 2.75, 2.6, 4.2, 0.1, 0.16, { c: '#7a5148', noao: true }); bx('flat', F, 1.3, 2.2, 2.9, 3.9, 0.16, 0.17, { c: '#3d4c86', noao: true });
  return end('Cantieri Culturali, entrance sign');
}
const signWalls = () => { const W = (x, z) => [SG_O[0] - x, SG_O[1] - z]; return [[-1.8, -0.8], [0.05, 2.05]].flatMap(([a, b]) => ringWalls([W(a, -0.35), W(b, -0.35), W(b, 0.35), W(a, 0.35)])); };

// =====================================================================================================
// Gas holder, Via Giuseppe La Villa
// =====================================================================================================
const GH = { id: 'w990890861', c: [-499.2, -2041.8], R: 13.4, n: 18, ph: -1.553, rings: [6.4, 12.5, 18.6], top: 24.6 };
const ghRing = (R) => Array.from({ length: GH.n }, (_, i) => { const a = GH.ph + i * 2 * PI / GH.n; return [GH.c[0] + R * Math.cos(a), GH.c[1] + R * Math.sin(a)]; });
// a flat bar from a to b, seen from both sides of the frame (four triangles)
function strip(a, b, w, c) {
  const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, dy = b[1] - a[1], k = Math.hypot(l, dy) || 1, ox = -dy / k * dx / l * w, oy = l / k * w, oz = -dy / k * dz / l * w;
  tris('flat', new THREE.Matrix4(), both([a[0] - ox, a[1] - oy, a[2] - oz], [b[0] - ox, b[1] - oy, b[2] - oz], [b[0] + ox, b[1] + oy, b[2] + oz], [a[0] + ox, a[1] + oy, a[2] + oz]), c);
}
function buildGasometro() {
  initShared();
  const y0 = groundY(...GH.c), I = new THREE.Matrix4();
  begin(y0);
  const IRON = '#4b5058', DARK = '#3e434a';
  // the low tank inside the frame
  cyl('flat', 12.2, 12.2, 4.2, GH.n, { p: [GH.c[0], y0 - 1.2, GH.c[1]], open: true, c: '#6a4a3a' });
  part('flat', new THREE.CircleGeometry(12.2, GH.n), { p: [GH.c[0], y0 + 3.0, GH.c[1]], rx: -PI / 2, c: '#cfc6b4', noao: true });
  const P = ghRing(GH.R), Q = ghRing(GH.R + 0.95), pt = (p, y) => [p[0], y0 + y, p[1]];
  const levels = [0.4, ...GH.rings, GH.top];
  for (let i = 0; i < GH.n; i++) {
    const a = P[i], b = P[(i + 1) % GH.n], qa = Q[i], qb = Q[(i + 1) % GH.n];
    // column and its finial
    cyl('flat', 0.15, 0.22, GH.top + 1.2, 4, { p: [a[0], y0 - 0.5, a[1]], open: true, c: DARK, noao: true });
    cone('flat', 0.22, 0.6, 4, { p: [a[0], y0 + GH.top + 0.65, a[1]], c: DARK, noao: true });
    // crossed braces and the strut where they cross
    for (let k = 0; k < levels.length - 1; k++) {
      const l = levels[k], u = levels[k + 1];
      strip(pt(a, l), pt(b, u), 0.06, IRON); strip(pt(b, l), pt(a, u), 0.06, IRON); strip(pt(a, (l + u) / 2), pt(b, (l + u) / 2), 0.055, IRON);
    }
    // the latticed top ring
    strip(pt(a, GH.top), pt(b, GH.top), 0.12, DARK); strip(pt(a, GH.top - 0.65), pt(b, GH.top - 0.65), 0.09, DARK);
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    strip(pt(a, GH.top - 0.65), pt(m, GH.top), 0.05, DARK); strip(pt(m, GH.top), pt(b, GH.top - 0.65), 0.05, DARK);
    // the walkway rings: deck, edge girder, hand rail and posts
    for (const y of GH.rings) {
      tris('flat', I, both(pt(a, y), pt(b, y), pt(qb, y), pt(qa, y)), '#55524e');
      tris('flat', I, both(pt(qa, y - 0.32), pt(qb, y - 0.32), pt(qb, y), pt(qa, y)), DARK);
      tris('flat', I, both(pt(qa, y + 0.98), pt(qb, y + 0.98), pt(qb, y + 1.08), pt(qa, y + 1.08)), IRON);
      for (let k = 0; k < 2; k++) { const t0 = k / 2, t1 = t0 + 0.035, p0 = [qa[0] + (qb[0] - qa[0]) * t0, qa[1] + (qb[1] - qa[1]) * t0], p1 = [qa[0] + (qb[0] - qa[0]) * t1, qa[1] + (qb[1] - qa[1]) * t1]; tris('flat', I, both(pt(p0, y), pt(p1, y), pt(p1, y + 1), pt(p0, y + 1)), IRON); }
    }
  }
  return end('Gasometro');
}

// =====================================================================================================
// Torre Sperlinga
// =====================================================================================================
const SP = { id: 'w25091496', p: [-1589.7, -2384.1, -1582.2, -2369.2, -1565.7, -2376.7, -1559.6, -2365.5, -1543.1, -2372.9, -1549.9, -2385.6, -1536.4, -2393.1, -1543.9, -2406.5, -1557.4, -2399.8, -1564.2, -2413.2, -1579.2, -2405.0, -1573.2, -2392.3], H: 60.6, n: 19 };
const SP_CV = [256, 64], spR = { L: [0, 0, 192, 64, 14, 3.19], P: [192, 0, 64, 64, 4.6, 3.19] };
function spPaint(g, w, h) {
  g.fillStyle = '#ecebe5'; g.fillRect(0, 0, w, h);
  region(g, spR.L, ({ R }) => {
    // the loggia: shade, window frames, the white railing over the slab
    R(-5.5, 0.45, 5.5, 2.85, '#8a735c'); R(-5.5, 2.45, 5.5, 2.85, '#54463a');
    for (const x of [-4.6, -2.6, 0.2, 2.9]) { R(x, 0.45, x + 1.5, 2.35, '#4a3a30'); R(x + 0.7, 0.45, x + 0.8, 2.35, '#a8896a'); }
    for (let x = -5.45; x < 5.5; x += 0.34) R(x, 0.4, x + 0.14, 1.45, '#f4f4f0'); R(-5.5, 1.4, 5.5, 1.58, '#fafaf6'); R(-5.5, 0, 5.5, 0.45, '#f2f0ea'); R(-5.5, 0, 5.5, 0.08, '#b9b4aa');
    for (const s of [-1, 1]) { R(s * 5.95 - 0.17, 1.2, s * 5.95 + 0.17, 1.62, '#c6a870'); R(s * 5.5 - 0.06, 0, s * 5.5 + 0.06, 3.19, '#cfccc3'); }
  });
  region(g, spR.P, ({ R, poly }) => {
    R(-2.3, 0, 2.3, 3.19, '#eae9e3'); R(-2.3, 0, 2.3, 0.05, '#d2d0c8');
    poly([[-0.75, 0.95], [0.55, 1.15], [0.55, 2.45], [-0.75, 2.25]], '#55514c'); poly([[-0.75, 0.85], [0.7, 1.07], [0.7, 1.19], [-0.75, 0.97]], '#bdbab0');
  });
}
function buildSperlinga() {
  initShared();
  defMat('x2Sper', SP_CV[0], SP_CV[1], [14, 3.19], spPaint);
  const P = pairsOf(SP.p), G = groundRange(P), y0 = G.lo, lo = y0 - 1.5, fh = SP.H / SP.n;
  begin(y0);
  // which corners point outward: an arm end is a face between two of them
  const area = P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  const convex = P.map((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return ((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) * area > 0; });
  prism('flat', P, lo, y0 + SP.H, { c: '#e4e2da' });
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length, E = edge(P[i], P[j], P, y0), hl = E.l / 2;
    if (convex[i] && convex[j]) {
      quadR('x2Sper', SP_CV, spR.L, E.M, -hl, hl, fh, SP.H, 0.06, 0, 1, 1, SP.n);
      for (let k = 2; k <= SP.n; k++) bx('flat', E.M, -hl * 0.79, hl * 0.79, k * fh - 0.14, k * fh + 0.04, 0, 0.75, { c: '#f0efea', noao: true });
      for (const s of [-1, 1]) bx('flat', E.M, s * hl - 0.35, s * hl + 0.35, 0, SP.H + 1.1, -0.35, 0.22, { c: '#eeede7' });
    } else {
      const n = Math.max(1, Math.round(E.l / 4.6)), bw = E.l / n;
      for (let k = 0; k < n; k++) quadR('x2Sper', SP_CV, spR.P, E.M, -hl + k * bw, -hl + (k + 1) * bw, fh, SP.H, 0.05, 0, 1, 1, SP.n);
    }
    // the ground floor and the parapet
    bx('flat', E.M, -hl, hl, 0, fh - 0.3, -0.05, 0.08, { c: '#8f8a80' }); bx('flat', E.M, -hl, hl, fh - 0.3, fh + 0.05, 0, 0.7, { c: '#e8e6de', noao: true });
    bx('flat', E.M, -hl, hl, SP.H, SP.H + 0.9, -0.25, 0.06, { c: '#e9e8e1', noao: true });
  }
  // the round plant floor on the roof
  const DC = [-1560.9, -2390.0];
  cyl('flat', 7.6, 7.6, 2.8, 20, { p: [DC[0], y0 + SP.H, DC[1]], c: '#d8d5cc', noao: true });
  cyl('flat', 7.9, 7.9, 0.3, 20, { p: [DC[0], y0 + SP.H + 2.65, DC[1]], c: '#ecebe4', noao: true });
  const o = end('Torre Sperlinga');
  o.userData.solids = [[SP.p, null, y0 + SP.H]];
  return o;
}

// =====================================================================================================
// Ex Stazione Lolli
// =====================================================================================================
const LO = { id: 'w278802638', p: [-1347.0, -877.9, -1345.9, -878.4, -1320.1, -814.9, -1332.1, -810.3, -1358.0, -873.8] };
const LO_O = [-1333.0, -846.65], LO_N = [0.9265, -0.3763];
const LO_C0 = -17.5, LO_C1 = 12.5, LO_W = LO_C1 - LO_C0;   // the middle block along the front (local x, positive to the north)
const LO_CV = [512, 384], loR = { C: [0, 0, 512, 262, 30, 14.5], W: [0, 266, 112, 118, 4.3, 9.2], K: [128, 266, 120, 80, 4.6, 3.1] };
const LOSTONE = '#9c8264', LOCREAM = '#cdb68c', LOTRIM = '#b7a07a';
// banded stone with rusticated joints, an arched opening in it
function loArch(p, x, w, h, door) {
  const { R, arch, line } = p;
  arch(x, 0, h + 0.42, w + 0.84, '#8a7258');
  for (let i = 0; i < 9; i++) { const a = PI * (i + 0.5) / 9, rr = w / 2; line(x - Math.cos(a) * rr, h - rr + Math.sin(a) * rr, x - Math.cos(a) * (rr + 0.45), h - rr + Math.sin(a) * (rr + 0.45), 0.05, '#5d4c3a'); }
  arch(x, 0, h, w, '#2e2823');
  const spring = h - w / 2;
  R(x - w / 2 + 0.1, 0, x + w / 2 - 0.1, spring - 0.1, door);
  for (let i = 1; i < 4; i++) R(x - w / 2 + i * w / 4 - 0.03, 0, x - w / 2 + i * w / 4 + 0.03, spring - 0.1, '#4b4032');
  for (let y = 1.2; y < spring - 0.4; y += 1.15) R(x - w / 2 + 0.1, y, x + w / 2 - 0.1, y + 0.07, '#4b4032');
  for (let i = 1; i < 6; i++) { const a = PI * i / 6; line(x, spring, x - Math.cos(a) * w * 0.47, spring + Math.sin(a) * w * 0.47, 0.06, '#7a6a55'); }
  R(x - w / 2, spring - 0.1, x + w / 2, spring + 0.08, '#6e5d48');
}
function loPaint(g, w, h) {
  g.fillStyle = LOSTONE; g.fillRect(0, 0, w, h);
  const r = RNG(5401);
  region(g, loR.C, (p) => {
    const { R, poly, line } = p;
    R(-15, 0, 15, 14.5, LOCREAM); R(-15, 0, 15, 7.5, LOSTONE);
    for (let y = 0.55; y < 7.2; y += 0.58) { R(-15, y, 15, y + 0.07, '#6f5b46'); R(-15, y + 0.07, 15, y + 0.12, 'rgba(255,230,190,0.25)'); }
    for (const x of [-11.4, -5.7, 0, 5.7, 11.4]) {
      loArch(p, x, 2.9, 5.9, '#8d7a56');
      // the window with shutters, its frame, lintel and the balustrade panel under it
      R(x - 1.15, 9.0, x + 1.15, 12.75, LOTRIM); R(x - 0.85, 9.2, x + 0.85, 12.45, '#4a2f24'); R(x - 0.03, 9.2, x + 0.03, 12.45, '#22140f');
      for (let y = 9.3; y < 12.4; y += 0.19) { R(x - 0.8, y, x - 0.1, y + 0.05, '#6b4534'); R(x + 0.1, y, x + 0.8, y + 0.05, '#6b4534'); }
      if (x === 0) { poly([[-1.45, 12.9], [0, 13.6], [1.45, 12.9]], '#a58e6a'); R(-1.45, 12.82, 1.45, 12.96, '#8a7556'); } else R(x - 1.35, 12.9, x + 1.35, 13.12, '#a58e6a');
      R(x - 1.4, 8.0, x + 1.4, 9.05, '#6e5c44'); for (let u = x - 1.28; u < x + 1.3; u += 0.34) R(u, 8.12, u + 0.17, 8.9, '#d2bd96'); R(x - 1.4, 8.9, x + 1.4, 9.1, '#c3ac85');
    }
    for (const x of [-14.55, -8.55, -2.85, 2.85, 8.55, 14.55]) { R(x - 0.4, 8.0, x + 0.4, 13.4, '#bda582'); R(x + 0.4, 8.0, x + 0.5, 13.4, 'rgba(80,60,35,0.3)'); R(x - 0.55, 13.15, x + 0.55, 13.45, '#a58e6a'); }
    R(-15, 7.2, 15, 8.0, '#8f775a'); R(-15, 13.55, 15, 14.5, '#a78f6c'); for (let x = -15; x < 15; x += 0.5) R(x, 13.6, x + 0.22, 13.85, '#6f5c44');
    // scrawls low on the wall (random, not a copy of any)
    for (let i = 0; i < 26; i++) { const x = -14.5 + r() * 29, y = 0.4 + r() * 1.5; g.strokeStyle = ['#59b0b4', '#e8e4dc', '#2c2a30', '#a8483c'][Math.floor(r() * 4)]; g.lineWidth = 1.2 + r() * 1.4; g.beginPath(); g.moveTo(p.X(x), p.Y(y)); for (let k = 0; k < 5; k++) g.lineTo(p.X(x + k * 0.22 + r() * 0.3), p.Y(y + (r() - 0.5) * 0.9)); g.stroke(); }
  });
  region(g, loR.W, (p) => {
    const { R } = p;
    R(-2.15, 0, 2.15, 9.2, '#a48b69'); R(-2.15, 0, 2.15, 4.2, '#8f775b');
    for (let y = 0.55; y < 4.2; y += 0.58) R(-2.15, y, 2.15, y + 0.07, '#665340');
    loArch(p, 0, 2.3, 5.6, '#4e4234');
    R(-2.15, 4.05, -1.4, 4.35, '#bca280'); R(1.4, 4.05, 2.15, 4.35, '#bca280'); R(-2.15, 7.5, 2.15, 7.9, '#b79e7c'); R(-2.15, 7.9, 2.15, 9.2, '#b29a78');
  });
  region(g, loR.K, ({ R, circ, line, poly }) => {
    R(-2.3, 0, 2.3, 3.1, '#b9a17c'); R(-2.3, 0, -1.65, 3.1, '#a58e6a'); R(1.65, 0, 2.3, 3.1, '#a58e6a');
    for (const s of [-1, 1]) { poly([[s * 0.85, 0.5], [s * 1.55, 0.45], [s * 1.45, 1.7], [s * 1.2, 2.35], [s * 0.95, 1.9]], '#cdb996'); circ(s * 1.18, 2.45, 0.17, '#cdb996'); }
    circ(0, 1.55, 1.05, '#8a7556'); circ(0, 1.55, 0.9, '#cdb996'); circ(0, 1.55, 0.74, '#eef0ee');
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; line(Math.cos(a) * 0.56, 1.55 + Math.sin(a) * 0.56, Math.cos(a) * 0.68, 1.55 + Math.sin(a) * 0.68, 0.05, '#2a2a2e'); }
    line(0, 1.55, -0.3, 1.95, 0.07, '#1c1c22'); line(0, 1.55, 0.58, 1.68, 0.05, '#1c1c22');
  });
  streaks(g, w, h, 60, 5402, 0.13, 55, '70,52,32');
}
function buildLolli() {
  initShared();
  defMat('x2Lolli', LO_CV[0], LO_CV[1], [30, 14.5], loPaint);
  const P = pairsOf(LO.p), S = site(LO_O, LO_N, [[0, 0.8], [-25, 0.8], [25, 0.8]]), { F, y0, at } = S, lo = Math.min(groundRange(P).lo, y0) - 1.2;
  begin(y0);
  const cx = (LO_C0 + LO_C1) / 2, end0 = -34.2, end1 = 34.2;
  prism('flat', P, lo, y0 + 9.2, { c: '#a99273' });
  prism('flat', P, y0 + 9.2, y0 + 9.28, { c: '#8f8c86' });
  // the wings: arched bays, cornice and parapet
  for (const [a, b] of [[end0, LO_C0], [LO_C1, end1]]) {
    const n = Math.round((b - a) / 4.3), bw = (b - a) / n;
    for (let i = 0; i < n; i++) quadR('x2Lolli', LO_CV, loR.W, F, a + i * bw, a + (i + 1) * bw, 0, 9.2, 0.06);
    bx('flat', F, a, b, 7.55, 7.9, 0, 0.35, { c: '#b39b78' }); bx('flat', F, a, b, 9.15, 9.75, -0.45, 0.12, { c: '#b7a283' }); bx('flat', F, a, b, -0.4, 0.5, 0, 0.16, { c: '#7f6a52' });
  }
  // the middle block above and in front
  bx('flat', F, LO_C0, LO_C1, 9.2, 14.5, -12.9, 0, { c: '#c4ad86' });
  quadR('x2Lolli', LO_CV, loR.C, F, LO_C0, LO_C1, 0, 14.5, 0.09);
  bx('flat', F, LO_C0 - 0.15, LO_C1 + 0.15, 7.35, 7.7, 0.05, 0.5, { c: '#a98f6e' }); bx('flat', F, LO_C0 - 0.2, LO_C1 + 0.2, 7.75, 7.98, 0.05, 0.62, { c: '#b9a281' });
  bx('flat', F, LO_C0 - 0.35, LO_C1 + 0.35, 14.15, 14.55, -0.2, 0.7, { c: '#b8a07b' }); bx('flat', F, LO_C0, LO_C1, 14.55, 15.2, -0.35, 0.12, { c: '#c0a983' });
  for (const x of [-14.55, -8.55, -2.85, 2.85, 8.55, 14.55]) bx('flat', F, cx + x - 0.34, cx + x + 0.34, 8.0, 14.15, 0.05, 0.22, { c: '#c4ac87' });
  bx('flat', F, LO_C0 - 0.05, LO_C0 + 0.4, -0.3, 7.4, 0, 0.22, { c: '#8f775a' }); bx('flat', F, LO_C1 - 0.4, LO_C1 + 0.05, -0.3, 7.4, 0, 0.22, { c: '#8f775a' });
  hip(F, LO_C0 + 0.1, LO_C1 - 0.1, -12.9, -0.4, 14.55, 2.3, '#d7a276');
  // the clock in its frame over the middle
  bx('flat', F, cx - 2.3, cx + 2.3, 15.2, 18.3, -1.2, 0.02, { c: '#b9a17c' });
  quadR('x2Lolli', LO_CV, loR.K, F, cx - 2.3, cx + 2.3, 15.2, 18.3, 0.06);
  bx('flat', F, cx - 2.6, cx + 2.6, 18.3, 18.65, -1.4, 0.35, { c: '#a99370' }); bx('flat', F, cx - 0.9, cx + 0.9, 18.65, 18.95, -0.5, 0.1, { c: '#b39c78' }); cone('flat', 0.45, 0.6, 6, { M: F, p: [cx, 18.95, -0.2], c: '#a99370', noao: true });
  const o = end('Ex Stazione Lolli');
  o.userData.solids = [[LO.p, null, y0 + 9.2]];
  return o;
}

// =====================================================================================================
// Ippodromo della Favorita: the grandstand
// =====================================================================================================
const IP = { id: 'w280101532', p: [-1532.8, -3962.4, -1509.4, -3903.2, -1525.9, -3896.7, -1535.1, -3920.1, -1540.2, -3932.7, -1549.3, -3956.0] };
const IP_O = [-1521.1, -3932.8], IP_N = [0.93, -0.3678];
const IP_CV = [256, 160], ipR = [0, 0, 256, 160, 8, 5];
function ipPaint(g, w, h) {
  region(g, ipR, ({ R }) => {
    R(-4, 0, 4, 5, '#8f8b80'); R(-4, 2.0, 4, 4.1, '#8b3a30');
    for (let x = -3.8; x < 3.8; x += 1.3) { R(x, 2.35, x + 1.05, 3.35, '#c9b277'); R(x + 0.08, 2.43, x + 0.97, 3.27, '#3a4244'); R(x + 0.5, 2.43, x + 0.56, 3.27, '#c9b277'); }
    for (let x = -3.9; x < 3.8; x += 1.0) { R(x, 4.15, x + 0.82, 4.85, '#b7a77a'); R(x + 0.07, 4.22, x + 0.75, 4.78, '#454c4c'); }
    R(-0.7, 0, 0.5, 1.75, '#33383a'); R(-4, 1.8, 4, 2.0, '#bdb8aa');
  });
  streaks(g, w, h, 12, 5501, 0.12, 40, '60,50,40');
}
function buildIppodromo() {
  initShared();
  defMat('x2Ippo', IP_CV[0], IP_CV[1], [8, 5], ipPaint);
  const P = pairsOf(IP.p), S = site(IP_O, IP_N, [[0, 0.5], [-25, 0.5], [25, 0.5]]), { F, y0 } = S;
  begin(y0);
  const H = 31.8, STEP = '#d9d5cb';
  // the stone steps up from the track side
  bx('flat', F, -H, H, -1.4, 0.5, -17.7, 0, { c: '#b7b2a6' });
  const N = 10;
  for (let i = 0; i < N; i++) { const z = -0.7 - i * 1.0, y = 0.5 + (i + 1) * 0.42; bx('flat', F, -H, H, 0.5, y - 0.1, z - 1.0, z, { c: '#a9a498' }); bx('flat', F, -H, H, y - 0.1, y, z - 1.0, z + 0.07, { c: STEP }); }
  // the rear block with the boxes
  bx('flat', F, -H, H, 0.5, 9.7, -17.7, -10.7 - 0.9, { c: '#a8a397' });
  const n = 8, bw = 2 * H / n; for (let i = 0; i < n; i++) quadR('x2Ippo', IP_CV, ipR, F, -H + i * bw, -H + (i + 1) * bw, 4.7, 9.6, -11.55);
  // the cantilevered roof, rising to the track side, on its tapered ribs
  const A = [-H - 0.4, 9.9, -17.9], B = [H + 0.4, 9.9, -17.9], C = [H + 0.4, 12.35, 0.4], D = [-H - 0.4, 12.35, 0.4], up = p => [p[0], p[1] + 0.24, p[2]];
  tris('flat', F, quad(A, B, C, D), '#fff6e2'); tris('flat', F, quad(up(D), up(C), up(B), up(A)), '#8d8b84');
  tris('flat', F, [...quad(D, C, up(C), up(D)), ...quad(B, A, up(A), up(B)), ...quad(C, B, up(B), up(C)), ...quad(A, D, up(D), up(A))], '#4a4844');
  const ribs = 12;
  for (let i = 0; i <= ribs; i++) {
    const x = -H + 0.25 + i * (2 * H - 0.5) / ribs;
    extrude('flat', shapeOf([[17.7, 8.2], [11.6, 8.9], [-0.2, 12.05], [-0.2, 12.36], [17.7, 9.95]]), 0.42, { M: mul(F, mul(tr(x - 0.21, 0, 0), rotY(PI / 2))), c: '#a59f90', noao: true });
    bx('flat', F, x - 0.25, x + 0.25, 0.5, 8.9, -11.6, -11.0, { c: '#b2ac9e' });
  }
  const o = end('Ippodromo, tribuna');
  o.userData.solids = [[IP.p, null, y0 + 9.7]];
  return o;
}

// =====================================================================================================
// Velodromo Paolo Borsellino
// =====================================================================================================
const VL = {
  ids: ['w1447672285', 'w285427398', 'w285430365'],
  // the covered stand: the pitch side and the back, both north to south (the front stands a few metres behind the footprint at its north end, clear of the mapped service road)
  front: [[-4207.2, -6454.4], [-4206.6, -6441.0], [-4202.2, -6427.4], [-4197.7, -6404.3], [-4191.1, -6382.4], [-4183.0, -6363.5]],
  back: [[-4240.0, -6455.1], [-4240.0, -6427.4], [-4234.9, -6398.1], [-4226.0, -6371.6], [-4216.7, -6349.7]],
  // the open stand: pitch side and back
  efront: [[-4102.5, -6479.5], [-4093.4, -6454.8], [-4086.2, -6430.0], [-4083.0, -6404.4], [-4083.0, -6382.7]],
  eback: [[-4088.2, -6485.6], [-4076.2, -6457.1], [-4070.0, -6436.5], [-4065.6, -6403.5], [-4065.5, -6382.6]],
  // the oval inside which the track lies (the mapped ground of the track)
  oval: [-4194.7, -6477.7, -4197.5, -6468.8, -4198.7, -6460.2, -4198.6, -6453.0, -4197.4, -6442.1, -4196.2, -6436.1, -4184.5, -6381.8, -4180.1, -6367.2, -4173.0, -6354.1, -4159.6, -6341.2, -4151.4, -6337.2, -4140.6, -6336.0, -4126.1, -6339.2, -4112.4, -6349.9, -4107.6, -6358.4, -4104.2, -6374.4, -4104.2, -6382.8, -4105.7, -6397.7, -4116.0, -6446.9, -4121.2, -6467.2, -4129.4, -6484.1, -4137.3, -6491.3, -4145.6, -6496.6, -4154.8, -6499.0, -4166.6, -6499.1, -4175.7, -6496.7, -4189.6, -6485.8],
  masts: [[-4210, -6479], [-4173, -6343], [-4109, -6506], [-4095, -6355]],
};
const VL_CV = [512, 256], vlR = { W: [0, 0, 512, 128, 100, 25], E: [0, 130, 512, 126, 100, 25] };
function vlPaint(g, w, h) {
  const r = RNG(5601);
  // the covered stand: eight upper blocks (a gold eagle, a ring of stars, in turn) over striped lower rows, stairs between
  region(g, vlR.W, ({ R, poly, circ }) => {
    R(-50, 0, 50, 25, '#9d9890');
    for (let y = 1; y < 10; y += 1.5) R(-50, y, 50, y + 0.95, ['#dcd8cc', '#3d56a0', '#9a3b46', '#e2ded2', '#43609e', '#cfc9bb'][Math.floor(y / 1.5)]);
    for (let i = 0; i < 8; i++) {
      const x = -43.75 + i * 12.5, eagle = i % 2 === 0;
      R(x - 5.7, 12, x + 5.7, 24.2, eagle ? '#5e2734' : '#232f66');
      if (eagle) { poly([[x - 5, 21.5], [x - 1.6, 19.5], [x - 0.9, 22.8], [x + 0.2, 22.2], [x + 0.9, 19.8], [x + 5, 21.5], [x + 3.4, 17], [x + 1.2, 17.4], [x + 2.2, 13.6], [x, 15], [x - 2.2, 13.6], [x - 1.2, 17.4], [x - 3.4, 17]], '#d6a932'); }
      else for (let k = 0; k < 12; k++) circ(x + Math.cos(k * PI / 6) * 3.8, 18.1 + Math.sin(k * PI / 6) * 4.6, 0.55, '#e0bf3c');
    }
    for (let x = -50; x <= 50; x += 12.5) R(x - 0.7, 0, x + 0.7, 25, '#aaa59c');
    for (let y = 0.9; y < 24; y += 0.9) R(-50, y, 50, y + 0.14, 'rgba(15,12,10,0.35)');
    R(-50, 10.4, 50, 11.7, '#6b6760');
  });
  // the open stand: rows of coloured seats
  region(g, vlR.E, ({ R }) => {
    R(-50, 0, 50, 25, '#a9a499');
    const low = ['#c98f1e', '#8a2f40', '#e6e2d6', '#c98f1e'], high = [['#2f7f86', '#e6e2d6'], ['#a8404c', '#e6e2d6'], ['#34518f', '#c98f1e']];
    for (let j = 0; j < 16; j++) { const y = 0.8 + j * 1.5; for (let x = -49; x < 49; x += 1.1) R(x, y, x + 0.85, y + 1.0, j < 7 ? low[Math.floor(j / 2)] : high[Math.floor((x + 50) / 14) % 3][j % 5 === 4 ? 1 : 0]); }
    for (let x = -50; x <= 50; x += 14) R(x - 0.8, 0, x + 0.8, 25, '#cbc6ba');
  });
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(30,25,20,0.18)' : 'rgba(255,250,240,0.14)'; g.fillRect(r() * w, r() * h, 2, 2); }
}
// points along a polyline at the fraction t of its length
function along(P, t) { const d = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); let s = t * d.reduce((a, b) => a + b, 0), i = 0; while (i < d.length - 1 && s > d[i]) { s -= d[i]; i++; } const k = s / d[i]; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k]; }
// a stand between a front and a back line: pts(s, u, y) in world metres (u 0 at the front, 1 at the back)
const standAt = (F, B, y0) => (s, u, y) => { const a = along(F, s), b = along(B, s); return [a[0] + (b[0] - a[0]) * u, y0 + y, a[1] + (b[1] - a[1]) * u]; };
function standSheet(T, prof, c, n = 10) {
  const I = new THREE.Matrix4(), out = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < prof.length - 1; k++) { const [u0, h0] = prof[k], [u1, h1] = prof[k + 1]; out.push(...both(T(i / n, u0, h0), T((i + 1) / n, u0, h0), T((i + 1) / n, u1, h1), T(i / n, u1, h1))); }
  tris('flat', I, out, c);
}
function seatSheet(T, r, u0, h0, u1, h1, n = 12) {
  const rows = [[u0, h0], [u1, h1]].map(([u, h]) => Array.from({ length: n + 1 }, (_, i) => T(i / n, u, h)));
  const [px, py, pw, ph] = r, uu = j => (px + pw * j / n) / VL_CV[0], vv = i => 1 - (py + ph) / VL_CV[1] + i * ph / VL_CV[1];
  // the winding that faces up
  const a = rows[0][0], b = rows[0][1], d = rows[1][0], upY = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
  gridMesh('x2Velo', rows, (i, j) => [uu(j), vv(i)], { flip: upY < 0, noao: true });
}
// the oval's inner line, d metres inside, and the height of the banking at each corner
function track() {
  const O = pairsOf(VL.oval).flatMap((p, i, a) => { const q = a[(i + 1) % a.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 7)); return Array.from({ length: k }, (_, j) => [p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k]); }), n = O.length, c = [-4151.0, -6417.6], ax = [0.2, 0.98];
  const inner = O.map((p, i) => { const a = O[(i + n - 1) % n], b = O[(i + 1) % n]; let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz); nx /= l; nz /= l; if (nx * (c[0] - p[0]) + nz * (c[1] - p[1]) < 0) { nx = -nx; nz = -nz; } return [p[0] + nx * 6.2, p[1] + nz * 6.2]; });
  const h = O.map(p => { const t = Math.abs((p[0] - c[0]) * ax[0] + (p[1] - c[1]) * ax[1]) / 82; return 1.5 + 1.5 * Math.min(1, Math.max(0, (t - 0.4) / 0.45)); });
  // the way in from the service road on the west side stays open
  const open = i => { const m = [(O[i][0] + O[(i + 1) % n][0]) / 2, (O[i][1] + O[(i + 1) % n][1]) / 2]; return Math.hypot(m[0] + 4196.0, m[1] + 6435.5) < 7; };
  return { O, inner, h, open, n };
}
function buildVelodromo() {
  initShared();
  defMat('x2Velo', VL_CV[0], VL_CV[1], [100, 50], vlPaint, { side: THREE.DoubleSide });
  const gy = Math.min(groundY(...VL.front[2]), groundY(...VL.back[2])), ey = Math.min(groundY(...VL.efront[2]), groundY(...VL.eback[2])), I = new THREE.Matrix4();
  begin(gy);
  // ---- the covered stand
  const T = standAt(VL.front, VL.back, gy);
  standSheet(T, [[0, -2], [0, 1.6]], '#c9c3b4');
  seatSheet(T, vlR.W, 0.02, 1.6, 0.7, 10.2);
  standSheet(T, [[0.7, 10.2], [0.84, 10.2], [0.97, 10.2], [0.97, -2]], '#8e8a82');
  standSheet(T, [[0.84, 10.2], [0.84, 13.0]], '#5a5854');
  standSheet(T, [[0.1, 15.2], [0.55, 16.2], [1.0, 18.0]], '#2d2c2e');
  standSheet(T, [[0.1, 14.3], [0.1, 15.2]], '#201f22');
  for (let i = 0; i <= 12; i++) { const s = i / 12; beam(I, T(s, 0.84, 10.2), T(s, 0.84, 17.2), 0.28, '#2a292c', 4); beam(I, T(s, 0.84, 13.6), T(s, 0.12, 14.6), 0.22, '#262528', 4); }
  // the closed ends with their curved bracket under the roof
  for (const s of [0, 1]) {
    const poly = [[0, -2], [0, 1.6], [0.7, 10.2], [0.84, 10.2], [0.45, 13.0], [0.18, 14.2], [0.1, 15.2], [0.55, 16.2], [1.0, 18.0], [0.97, -2]];
    const V = poly.map(q => new THREE.Vector2(q[0] * 38, q[1])), F3 = THREE.ShapeUtils.triangulateShape(V, []);
    const lower = [], upper = [];
    for (const f of F3) { const t = f.map(k => T(s, poly[k][0], poly[k][1])); (f.reduce((a, k) => a + poly[k][1], 0) / 3 > 11 ? upper : lower).push(t, [t[2], t[1], t[0]]); }
    tris('flat', I, lower, '#aaa59a'); if (upper.length) tris('flat', I, upper, '#262528');
  }
  // ---- the open stand
  const U = standAt(VL.efront, VL.eback, ey);
  standSheet(U, [[0, -3], [0, 1.2]], '#c9c3b4');
  seatSheet(U, vlR.E, 0.02, 1.2, 0.84, 6.2);
  standSheet(U, [[0.84, 6.2], [1.0, 6.2], [1.0, -3]], '#b9b3a6');
  standSheet(U, [[1.0, 6.2], [1.0, 7.2]], '#8f8b84');
  for (const s of [0, 1]) tris('flat', I, both(U(s, 0, -3), U(s, 0, 1.2), U(s, 1, 6.2), U(s, 1, -3)), '#a9a498');
  // ---- the banked track
  const K = track(), out = [], rim = [], lip = [];
  const at = (p, y) => [p[0], groundY(p[0], p[1]) + y, p[1]];
  for (let i = 0; i < K.n; i++) {
    if (K.open(i)) continue;
    const j = (i + 1) % K.n, a = at(K.O[i], K.h[i]), b = at(K.O[j], K.h[j]), c = at(K.inner[j], 0.12), d = at(K.inner[i], 0.12);
    out.push(...both(a, b, c, d)); rim.push(...both(at(K.O[i], -0.6), at(K.O[j], -0.6), b, a));
    lip.push(...both(at(K.O[i], K.h[i] + 0.9), at(K.O[j], K.h[j] + 0.9), at(K.O[j], K.h[j] + 1.0), at(K.O[i], K.h[i] + 1.0)));
    if (i % 2 === 0) cyl('flat', 0.05, 0.05, 1.0, 3, { p: a, open: true, c: '#d9b038', noao: true });
  }
  tris('flat', I, out, '#e2a23e'); tris('flat', I, rim, '#b9893c'); tris('flat', I, lip, '#d9b038');
  // ---- the floodlight masts, heads turned to the pitch
  for (const [x, z] of VL.masts) {
    const y = groundY(x, z), dx = -4151 - x, dz = -6418 - z, l = Math.hypot(dx, dz), M = frame(x, y, z, dx / l, dz / l);
    cyl('flat', 0.22, 0.45, 27, 6, { M, p: [0, -0.6, 0], open: true, c: '#8b9096', noao: true });
    bx('flat', M, -2.0, 2.0, 25.8, 28.8, -0.1, 0.35, { c: '#34373c', noao: true });
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) bx('flat', M, -1.8 + i * 0.95, -1.8 + i * 0.95 + 0.7, 26.05 + k * 0.92, 26.05 + k * 0.92 + 0.65, 0.35, 0.46, { c: '#dfe3df', noao: true });
  }
  return end('Velodromo Paolo Borsellino');
}
const vlWalls = () => {
  // the covered stand brings its own walls (the footprint's would shut the service road), then the banking and the masts
  const K = track(), o = ringWalls([...VL.front, ...[...VL.back].reverse()]);
  for (let i = 0; i < K.n; i++) { if (K.open(i)) continue; const j = (i + 1) % K.n; o.push([...K.O[i], ...K.O[j]], [...K.inner[i], ...K.inner[j]]); }
  for (const [x, z] of VL.masts) o.push(...ringWalls([[x - 0.45, z - 0.45], [x + 0.45, z - 0.45], [x + 0.45, z + 0.45], [x - 0.45, z + 0.45]]));
  return o;
};

// =====================================================================================================
// Cimitero di Santa Maria dei Rotoli: the gate on Via Vergine Maria
// =====================================================================================================
const RT_O = [817.34, -5091.99], RT_N = [0.935, -0.355];   // local x towards the north along the road, +z to the road
const rtPiers = [[3.5, 8.8], [-8.8, -3.5]];
function buildRotoli() {
  initShared();
  const S = site(RT_O, RT_N, [[0, 0.5], [-8, 0.5], [8, 0.5]]), { F, y0, at } = S;
  begin(y0);
  const ST = '#c3ab86', DK = '#9c8666', IRON = '#2e2c2a';
  for (const [a, b] of rtPiers) {
    const m = (a + b) / 2;
    bx('tufa', F, a - 0.2, b + 0.2, -1.2, 0.75, -2.75, 0.2, { c: DK });
    bx('tufa', F, a, b, 0.75, 3.85, -2.55, 0, { c: ST });
    bx('flat', F, a - 0.1, b + 0.1, 3.85, 4.05, -2.65, 0.1, { c: DK });
    bx('flat', F, a - 0.38, b + 0.38, 4.05, 4.32, -2.9, 0.38, { c: '#b29a78' });
    bx('tufa', F, a + 0.25, b - 0.25, 4.32, 5.45, -2.35, -0.2, { c: ST });
    bx('flat', F, a + 0.15, b - 0.15, 5.45, 5.62, -2.45, -0.1, { c: DK });
    for (const x of [a + 0.55, b - 0.55]) for (const z of [-0.45, -2.1]) { bx('tufa', F, x - 0.32, x + 0.32, 5.62, 6.05, z - 0.28, z + 0.28, { c: ST }); bx('flat', F, x - 0.38, x + 0.38, 6.05, 6.17, z - 0.34, z + 0.34, { c: DK }); }
    // the marble tablet
    bx('flat', F, m - 0.75, m + 0.75, 2.25, 3.35, 0, 0.07, { c: '#e6e2d6', noao: true });
    for (let i = 0; i < 5; i++) bx('flat', F, m - 0.6 + (i % 2) * 0.12, m + 0.6 - (i % 2) * 0.12, 3.1 - i * 0.17, 3.15 - i * 0.17, 0.07, 0.085, { c: '#7a766c', noao: true });
  }
  // the two lattice leaves, drawn open into the cemetery
  for (const s of [-1, 1]) {
    const x = s * 3.38, z0 = -3.9, z1 = -0.45;
    for (let k = 0; k <= 9; k++) { const z = z0 + (z1 - z0) * k / 9, top = 3.75 + 0.35 * Math.sin(PI * k / 9); bx('flat', F, x - 0.035, x + 0.035, 0.12, top, z - 0.035, z + 0.035, { c: IRON, noao: true }); cone('flat', 0.07, 0.22, 4, { M: F, p: [x, top, z], c: IRON, noao: true }); }
    for (const y of [0.15, 0.75, 1.35, 1.95, 2.55, 3.15, 3.65]) bx('flat', F, x - 0.05, x + 0.05, y, y + 0.07, z0, z1, { c: IRON, noao: true });
  }
  // the boundary wall south of the gate, with its cornice and pilasters (to the north the mapped wall carries on)
  const A = -33, B = -8.8;
  bx('tufa', F, A, B, -1.4, 3.6, -1.25, -0.65, { c: '#b9a380' }); bx('flat', F, A, B, 3.6, 3.85, -1.4, -0.48, { c: DK }); bx('flat', F, A, B, 3.85, 4.15, -1.2, -0.7, { c: '#a8916f' });
  for (let x = B - 3.4; x > A; x -= 4.6) { bx('tufa', F, x - 0.45, x + 0.45, 0, 3.6, -0.68, -0.5, { c: ST }); bx('flat', F, x - 0.55, x + 0.55, 3.85, 4.45, -1.3, -0.55, { c: DK }); }
  return end('Cimitero dei Rotoli, ingresso');
}
const rtWalls = () => {
  const S = (x, z) => [RT_O[0] + x * RT_N[1] + z * RT_N[0], RT_O[1] - x * RT_N[0] + z * RT_N[1]];
  const rect = (x0, x1, z0, z1) => ringWalls([S(x0, z1), S(x1, z1), S(x1, z0), S(x0, z0)]);
  return [...rect(3.35, 9.0, -2.75, 0.2), ...rect(-9.0, -3.35, -2.75, 0.2), ...rect(-33, -9.0, -1.35, -0.55), ...pathWalls([S(3.38, -2.75), S(3.38, -3.95)]), ...pathWalls([S(-3.38, -2.75), S(-3.38, -3.95)])];
};

export const R2_X2 = [
  { name: 'Santissima Trinita alla Zisa', x: -1768.4, z: -191.1, radius: 30, skipIds: TR.ids, build: buildTrinita, walls: trWalls() },
  { name: 'Cantieri Culturali alla Zisa, capannoni ovest', x: -2020, z: -250, radius: 60, skipIds: [CA.rust.id, CA.white.id], build: buildCantWest },
  { name: 'Cantieri Culturali alla Zisa, ZAC', x: -1920, z: -232, radius: 85, skipIds: [CA.zac.id], build: buildCantEast, walls: pipeWalls() },
  { name: 'Cantieri Culturali alla Zisa, ingresso', x: -1812.8, z: -265.5, radius: 10, skipIds: [], build: buildCantSign, walls: signWalls() },
  { name: 'Gasometro di via La Villa', x: GH.c[0], z: GH.c[1], radius: 18, skipIds: [GH.id], build: buildGasometro, walls: ringWalls(ghRing(13.65)) },
  { name: 'Torre Sperlinga', x: -1562.7, z: -2388.3, radius: 35, skipIds: [SP.id], build: buildSperlinga },
  { name: 'Ex Stazione Lolli', x: -1339, z: -844.3, radius: 40, skipIds: [LO.id], build: buildLolli },
  { name: 'Ippodromo della Favorita, tribuna', x: -1529, z: -3930, radius: 40, skipIds: [IP.id], build: buildIppodromo },
  { name: 'Velodromo Paolo Borsellino', x: -4154, z: -6436, radius: 105, skipIds: VL.ids, build: buildVelodromo, walls: vlWalls(), dropWalls: [VL.ids[0]] },
  { name: 'Cimitero dei Rotoli, ingresso', x: 815, z: -5095, radius: 36, skipIds: [], build: buildRotoli, walls: rtWalls() },
];
