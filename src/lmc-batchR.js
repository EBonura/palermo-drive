// City landmarks, batch R: six churches that were drawn by the generic builder (src/lmc-churches.js) because no exterior photo had been found. Registered through BATCH_R in src/landmarks-city.js.
// Photos were found on Mapillary (street imagery around each footprint) and on two Italian pages. They were only looked at, nothing is copied. Heights and positions along the fronts were read by fitting
// the camera of a photo to the footprint (computed pose of the Mapillary frame, adjusted on the corners seen in it) and intersecting its rays with the wall planes, so treat them as good to about half a metre.
// Each church: frame F with the origin on the ground in the middle of the front, +z out of the front, local x along the front (right as seen from outside). Collision is the footprint, plus wall segments round
// the porches of San Michele and Santa Lucia, which stand about a metre in front of it. Nothing else outside the footprints is drawn (fences, long front steps, trees, parked cars).
//
// Chiesa di Terrasanta (w45407453), Via Terrasanta at the corner of Via Damiani Almeyda. Front to the west. Mapillary 887124222138676, 1623546807855031 (2014), 516804466162601 (2014), 795516624737303 (2015),
//  316638086699824, 2989404544665542 (2019). Read: salmon plaster with thin grey stone courses in the lower half over a stone plinth; a tall round arched recess with the door, the words AVE MARIA over it,
//  a gold mosaic of the Resurrection, a ledge and a rose window; a painted panel of the Madonna on the left pier (in the 2019 frames, not in 2014); a gable with a grey raking cornice and a cross, red tiles;
//  three round windows in round headed recesses high on the north flank; a square bell tower behind the front on the south side with arched openings and a pointed brown cap.
//  Not verified: the south flank and the back, the tracery of the rose window in detail, the figures of the mosaic.
// San Michele Arcangelo (w97225599), Largo San Michele Arcangelo, back to Via Giuseppe Sciuti. Front to the east. Mapillary 227107145879103, 866602277252932, 371741187511651 (2019), 547780639539515 (2014).
//  Read: a cream stone porch with four slim piers, three bays, ochre mosaic with two inscribed plaques and a tall glazed door, four gilt lanterns; lower wings at both sides; the bronze archangel on a bracket;
//  behind, a tall ribbed nave with a row of small square openings under the top, and in its middle the bell tower slab with a column of pierced squares, a clock, the belfry and a cross; at the back a low
//  wing with a tiled picture panel over its south end. Not verified: the length and roof of the nave, the long sides, the windows of the low wing, the plaque texts, the picture on the tile panel.
// Maria Santissima Mediatrice (w48849513), Viale Maria Santissima Mediatrice. Front to the south west. Mapillary 296248575286572 (2018), 161619925812116, 488084425954468, 508999830136843 (2017).
//  Read: cream plaster with beige stone strips; two square towers with framed windows, string courses and paired belfry slots; between them a gabled front with a broad grey green raking band, an octagonal
//  window, two pointed pilaster strips, three doors under small hoods and a cross; flanks with pilasters, tall and square windows and a saw tooth row of small gables. The gabled front stands 1.45 m back from the footprint's edge, with steps up to the doors.
//  Not verified: the west flank and the transept ends behind, the roofs, the middle door (a palm stands in front of it).
// San Raffaele Arcangelo (w81132103), Via Gustavo Roccella. Mapillary 4371250576535699, 826111003184070, 2330278957447566, 34868834106065714 (April 2026).
//  Read: an octagonal hall in cream with yellow framed panels, a many sided glazed lantern with a scalloped cornice, a dark cap, a spire and a cross; a lower hall clad in pale stone with a yellow cornice
//  and tall windows; a slim square bell tower in yellow with arched openings and an open metal spire to the east. The small octagonal building beside it is a separate footprint and stays generic.
//  Not verified: everything on the south side, the low eastern arm, the number of lantern windows.
// Santa Lucia Vergine Maria (w82636565), Piazza della Pace on Via Enrico Albanese. Front to the north. Photos: the front as shown on lasiciliainrete.it (page "Chiesa di Santa Lucia al Borgo", photo credited
//  only as web) and in the balarm.it article on the works in Piazza della Pace (April 2026). Read: a white stone front with fine courses, a low gable with a cross, a relief of two angels, five small windows with
//  pointed heads, four spouts, three tall windows with zigzag glazing, a folded canopy over four piers and gilt gates, low white wings.
//  Not verified: the sides, back and roofs (no photo shows them), so the nave and the eastern wing are plain white stone with flat or shallow roofs; the wings beside the front stand outside the footprint.
// Santa Caterina da Siena (w279882644), Via Giuseppe Garibaldi 23-27 (the church of the old conservatory, inside Palazzo Villaraut). Front to the west. Mapillary 261779599106730, 360681708990928,
//  636721173956324 (2021). Read: a long weathered cream palazzo front with a grey plinth, tall windows with stone frames, cornices and iron grilles, the church door with pilasters and a cornice, a white
//  statue of the Madonna on a bracket with a marble plaque beside it, shop doors, rust red drain pipes, a lantern. Not verified: the part of the front south of the church door beyond the rhythm of the
//  windows; the third row of windows is only partly in frame, so its size is estimated and the eaves height is the baked one; the side and back walls stay plain.
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue, pyramid, paintAshlar, archShape, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// the site of one church: footprint, frame (origin O on the front, outward normal N), the ground
function site(flat, O, N) {
  const pts = pairsOf(flat);
  const W = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const loc = pts.map(p => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; });
  // the footprint kept behind z = zmax, as world points
  const behind = (zmax) => { const out = []; for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out.map(q => W(q[0], q[1])); };
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)];
  const y0 = Math.min(groundY(...W(-4, 1)), groundY(...W(0, 1)), groundY(...W(4, 1))), lo = Math.min(groundRange(pts).lo, y0) - 1.5;
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  // a frame in the middle of the wall from a to b (world points), +z out of the polygon poly
  const edge = (a, b, poly = pts) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = -dz / l, nz = dx / l; if (inPoly(poly, mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; } return { M: frame(mx, y0, mz, nx, nz), l }; };
  return { pts, W, behind, ring, y0, lo, F, edge, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
// painter for a canvas that covers FW x FH metres, x centred, y up from the ground
function paint(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const ring = (x, y, r, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.stroke(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  return { sx, sy, X, Y, R, poly, arch, circ, ring, line };
}
const base = (g, w, h, c, seed, a = 0.08) => { g.fillStyle = c; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, seed, [`rgba(90,65,40,${a})`, 'rgba(255,248,232,0.09)']); };
// wear: soft stains, streaks from the ledges, grime at the foot (foot = share of the canvas height)
function wear(g, w, h, seed, n, foot = 0.14, a = 0.1) {
  const r = RNG(seed);
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.2) * Math.max(w, h), k = r() < 0.6 ? '60,42,25' : '255,246,225', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${k},${a * (0.6 + r() * 0.6)})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, a, h * 0.18, '60,46,32');
  if (foot > 0) { const gb = g.createLinearGradient(0, h, 0, h * (1 - foot)); gb.addColorStop(0, 'rgba(40,28,18,0.28)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, h * (1 - foot), w, h * foot); }
}
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => shapeOf([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
// a flat coloured solid from a 2D outline, in the frame M, from z0 to z1
const slab = (M, p, z0, z1, c, key = 'flat') => extrude(key, shapeOf(p), z1 - z0, { M, p: [0, 0, z0], c, noao: true });
// a painted face: the outline p textured with the part of the canvas (FW x FH metres, x centred) found at the same metres, shifted by ox
const face = (key, M, p, z0, z1, FW, FH, ox = 0, o = {}) => extrude(key, shapeOf(p), z1 - z0, { M, p: [0, 0, z0], uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5 + ox / FW, 0], noao: true, ...o });
const disc = (M, x, y, z, r, d, c, seg = 14, t0 = 0) => cyl('flat', r, r, d, seg, { M, p: [x, y, z], rx: PI / 2, c, t0, noao: true });
const cross = (M, x, y, z, h, c = '#4a4036') => { bx('flat', M, x - 0.06, x + 0.06, y, y + h, z - 0.06, z + 0.06, { c, noao: true }); bx('flat', M, x - h * 0.28, x + h * 0.28, y + h * 0.62, y + h * 0.62 + 0.12, z - 0.06, z + 0.06, { c, noao: true }); };
const flatRoof = (pts, y, c = '#9a948a') => prism('flat', pts, y, y + 0.14, { c, noao: true });

// =====================================================================================================
// Chiesa di Terrasanta
// =====================================================================================================
const TS = { id: 'w45407453', p: [-1450.7, -1626, -1426.9, -1637.6, -1423.4, -1636.9, -1418.3, -1623.5, -1431.3, -1618, -1443.8, -1612.8] };
const TSW = 14.8, TSE = 17.0, TSA = 21.4, TSFH = 22, TSPINK = '#e0b598', TSGREY = '#bcb5aa', TSSTONE = '#aaa296';
function tsCourses(g, p, x0, x1) { for (let y = 2.25; y < 8.2; y += 0.62) { p.R(x0, y, x1, y + 0.2, TSGREY); p.R(x0, y - 0.04, x1, y, 'rgba(80,45,30,0.25)'); } }
function tsFront(g, w, h) {
  const p = paint(g, w, h, TSW, TSFH), { R, arch, circ, ring, line, X, Y } = p;
  base(g, w, h, TSPINK, 9101);
  tsCourses(g, p, -TSW / 2, TSW / 2);
  R(-TSW / 2, 0, TSW / 2, 1.6, TSSTONE); R(-TSW / 2, 1.5, TSW / 2, 1.6, '#c9c1b2');
  // the great recess: shadow along its edge, the grey panel of the portal, the ledge
  arch(0, 0, 17.0, 5.4, '#c1977c'); arch(0.12, 0, 16.85, 5.0, '#dbb59b');
  R(-2.1, 1.6, 2.1, 11.4, '#c2b09e'); R(-2.55, 11.25, 2.55, 11.75, '#a8a194'); R(-2.55, 11.05, 2.55, 11.25, 'rgba(70,45,30,0.35)');
  // steps and the door in its grey surround
  for (let i = 0; i < 7; i++) { const y = i * 0.23; R(-2.4, y, 2.4, y + 0.19, i % 2 ? '#c4bcac' : '#b6ae9f'); R(-2.4, y + 0.19, 2.4, y + 0.23, '#6f675c'); }
  R(-1.35, 1.6, 1.35, 5.8, '#aaa398'); R(-0.95, 1.6, 0.95, 5.55, '#5f4231'); R(-0.03, 1.6, 0.03, 5.55, '#2c1d14');
  for (const s of [-1, 1]) for (let y = 1.8; y < 5.2; y += 0.85) { R(s * 0.5 - 0.32, y, s * 0.5 + 0.32, y + 0.65, '#76533c'); R(s * 0.5 - 0.2, y + 0.12, s * 0.5 + 0.2, y + 0.53, '#684733'); }
  R(-1.6, 5.75, 1.6, 6.45, '#cfc9ba'); g.fillStyle = '#5f6a58'; g.font = `bold ${Math.round(0.55 * p.sy)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AVE MARIA', X(0), Y(6.1));
  // the mosaic: the risen Christ with the banner over the tomb, two soldiers
  arch(0, 6.45, 10.05, 2.8, '#c9c1b0'); arch(0, 6.55, 9.9, 2.5, '#c8982e'); const my = 8.5;
  for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI; line(0, my, Math.cos(a) * 1.15, my + Math.sin(a) * 1.2, 0.07, '#efd068'); }
  R(-0.8, 6.65, 0.8, 7.35, '#a59d90'); p.poly([[-0.35, 7.35], [0.4, 7.35], [0.28, 8.9], [-0.15, 8.95]], '#eee9dc'); circ(0.08, 9.15, 0.2, '#d2a381'); line(-0.5, 8.0, -0.5, 9.7, 0.06, '#7a5a30'); R(-0.92, 9.25, -0.5, 9.65, '#e9e1d2'); R(-0.73, 9.25, -0.67, 9.65, '#b4362c'); R(-0.92, 9.42, -0.5, 9.48, '#b4362c');
  for (const s of [-1, 1]) { p.poly([[s * 1.15, 6.6], [s * 0.55, 6.6], [s * 0.75, 7.6], [s * 1.0, 7.65]], s < 0 ? '#6f4a2c' : '#5a4a3a'); circ(s * 0.86, 7.8, 0.17, '#c99a78'); }
  // the rose window with its geometric tracery
  circ(0, 14.35, 2.3, '#c59c82'); circ(0, 14.35, 2.0, '#c7a690'); circ(0, 14.35, 1.82, '#8b8784');
  for (const r of [1.78, 1.18, 0.72]) ring(0, 14.35, r, 0.14, '#6a463a');
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI, b = a + PI / 12; line(Math.cos(a) * 1.18, 14.35 + Math.sin(a) * 1.18, Math.cos(a) * 1.78, 14.35 + Math.sin(a) * 1.78, 0.12, '#6a463a'); line(Math.cos(b) * 0.72, 14.35 + Math.sin(b) * 0.72, Math.cos(b) * 1.18, 14.35 + Math.sin(b) * 1.18, 0.1, '#6a463a'); }
  for (const x of [-0.3, 0.3]) line(x, 13.75, x, 14.95, 0.1, '#6a463a');
  // the Madonna panel on the left pier, the small oval window on the right one
  R(-6.85, 4.2, -4.65, 9.2, '#d9d3c4'); R(-6.75, 4.3, -4.75, 9.1, '#7288bd'); circ(-5.9, 5.4, 0.7, '#c9d2e6'); circ(-5.4, 4.9, 0.55, '#dde3ef');
  p.poly([[-6.4, 4.9], [-5.1, 4.9], [-5.45, 7.2], [-5.55, 7.8], [-5.95, 7.8], [-6.05, 7.2]], '#eee8d8'); circ(-5.75, 8.0, 0.24, '#d8ac8c'); R(-5.95, 6.6, -5.55, 7.05, '#d9c9a8');
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; circ(-5.75 + Math.cos(a) * 0.55, 8.05 + Math.sin(a) * 0.6, 0.06, '#f4e08a'); }
  circ(5.8, 8.7, 0.55, '#caa088'); circ(5.8, 8.7, 0.38, '#41352f');
  wear(g, w, h, 9102, 30);
}
function tsWall(g, w, h) {   // a 4 m bay of the flanks, up to the eaves
  const p = paint(g, w, h, 4, TSE);
  base(g, w, h, TSPINK, 9111);
  tsCourses(g, p, -2, 2);
  p.R(-2, 0, 2, 1.25, TSSTONE); p.R(-2, 1.15, 2, 1.25, '#c9c1b2'); p.R(-0.8, 0.25, 0.8, 0.9, '#4a2f26'); for (let x = -0.7; x < 0.8; x += 0.25) p.R(x, 0.25, x + 0.05, 0.9, '#231a15');
  p.R(-2, TSE - 0.35, 2, TSE, '#cca68d');
  wear(g, w, h, 9112, 12);
}
function buildTerrasanta() {
  initShared();
  const S = site(TS.p, [-1447.25, -1619.4], [-0.886, 0.463]), { F, y0, at } = S;
  defMat('brTsFront', 256, 384, [TSW, TSFH], tsFront);
  defMat('brTsWall', 64, 256, [4, TSE], tsWall);
  begin(y0);
  const body = S.behind(-0.3);
  prism('brTsWall', body, S.lo, y0 + TSE, { uvo: [0, -y0 / TSE] });
  flatRoof(body, y0 + TSE);
  face('brTsFront', F, [[-7.4, -1.5], [7.4, -1.5], [7.4, TSE], [0, TSA], [-7.4, TSE]], -0.45, 0, TSW, TSFH);
  gable('tile', 'brTsWall', at(0, 0, -13.5), 13.9, 26.2, TSE, 4.0, { ov: 0.15, c: '#b46e4e', wc: '#ffffff' });
  // grey raking cornice, the ledge over the mosaic, the stone cross
  const rl = Math.hypot(7.4, TSA - TSE), ra = Math.atan2(TSA - TSE, 7.4);
  for (const s of [-1, 1]) box('flat', rl + 0.3, 0.32, 0.75, { M: F, p: [s * 3.75, (TSE + TSA) / 2 - 0.05, -0.1], rz: -s * ra, c: '#8f8b86', noao: true });
  bx('flat', F, -2.55, 2.55, 11.3, 11.65, -0.02, 0.22, { c: '#a8a194', noao: true });
  bx('flat', F, -0.3, 0.3, TSA - 0.1, TSA + 0.35, -0.35, 0.15, { c: '#b9b3a8', noao: true }); cross(F, 0, TSA + 0.3, -0.1, 1.4, '#b9b3a8');
  // round windows in round headed recesses on the north flank
  const P = S.pts, E = S.edge(P[0], P[1]), toEnd = Math.sign(new THREE.Vector3(P[1][0], y0, P[1][1]).applyMatrix4(E.M.clone().invert()).x) || 1;
  for (const d of [4.4, 11.0, 17.6]) {
    const x = toEnd * (d - E.l / 2);
    extrude('flat', archShape(3.5, 4.4), 0.05, { cs: 4, M: E.M, p: [x, 11.0, -0.01], c: '#cda387', noao: true });
    disc(E.M, x, 13.3, 0.02, 1.5, 0.08, '#dcbaa2'); disc(E.M, x, 13.3, 0.04, 1.1, 0.09, '#2e2b30', 12);
    for (const [ww, hh] of [[2.1, 0.07], [0.07, 2.1]]) bx('flat', E.M, x - ww / 2, x + ww / 2, 13.3 - hh / 2, 13.3 + hh / 2, 0.12, 0.15, { c: '#6a463a', noao: true });
  }
  // the bell tower, set back behind the front on the south side
  const TX = 5.1, TZ = -2.7, TH = 25.2, T2 = 2.15;
  bx('flat', F, TX - T2, TX + T2, 12, TH, TZ - T2, TZ + T2, { c: '#dbb196', noao: true });
  for (const y of [17.9, 18.8, TH - 0.3]) bx('flat', F, TX - T2 - 0.12, TX + T2 + 0.12, y, y + 0.28, TZ - T2 - 0.12, TZ + T2 + 0.12, { c: TSGREY, noao: true });
  for (let k = 0; k < 4; k++) {
    const M = mul(at(TX, 0, TZ), new THREE.Matrix4().makeRotationY(k * PI / 2));
    extrude('flat', archShape(2.0, 3.9), 0.06, { cs: 4, M, p: [0, 19.1, T2 - 0.02], c: '#3a2a24', noao: true });
    bx('flat', M, -1.05, 1.05, 19.9, 20.05, T2 + 0.03, T2 + 0.1, { c: '#4d4640', noao: true });
    cyl('flat', 0.12, 0.42, 0.7, 7, { M, p: [0, 20.9, T2 - 0.05], c: '#5a4a34', noao: true });
  }
  pyramid('flat', T2 * 2 + 0.2, T2 * 2 + 0.2, 4.3, { M: F, p: [TX, TH, TZ], c: '#80665a', noao: true });
  sphere('flat', 0.3, { M: F, p: [TX, TH + 4.5, TZ], seg: 6, c: '#6d625a', noao: true }); cross(F, TX, TH + 4.7, TZ, 1.1);
  const o = end('Chiesa di Terrasanta');
  o.userData.solids = [[TS.p, null, y0 + TSE]];
  return o;
}

// =====================================================================================================
// San Michele Arcangelo
// =====================================================================================================
const SM = { id: 'w97225599', p: [-1687.6, -2103.5, -1681.3, -2106.2, -1682.3, -2109.1, -1674.6, -2112.1, -1667.9, -2099.2, -1661.7, -2102, -1657.5, -2094.7, -1630.8, -2108.2, -1625, -2096.4, -1651.2, -2083.5, -1646.8, -2074.9, -1667.3, -2063.9] };
const SMFW = 19.2, SMFH = 33, SMN = 6.55, SMNH = 22.2, SMTW = 2.15, SMTH = 32.1, SMLOW = 8.6, SMST = '#dcd3c0', SMTWR = '#e0dbcf';
function smFront(g, w, h) {
  const p = paint(g, w, h, SMFW, SMFH), { R, circ, ring, line, X, Y } = p;
  base(g, w, h, '#d8ccb6', 9201);
  // the ribbed nave front and its row of small openings
  for (let x = -SMN; x < SMN; x += 1.1) { R(x, 9.5, x + 0.16, 20.4, 'rgba(110,85,55,0.28)'); R(x + 0.16, 9.5, x + 0.34, 20.4, 'rgba(255,248,230,0.35)'); }
  R(-SMN, 20.2, SMN, 20.45, '#c4b79e');
  for (let x = 2.65; x < 6.2; x += 0.72) for (const s of [-1, 1]) { R(s * x - 0.23, 20.65, s * x + 0.23, 21.75, '#4e463a'); R(s * x - 0.23, 21.65, s * x + 0.23, 21.75, '#2c261f'); }
  R(-SMN, 22.0, SMN, 22.2, '#b9ac94');
  // the tower slab: pierced squares, clock, belfry
  R(-SMTW, 9.5, SMTW, SMFH, SMTWR); R(-SMTW, 9.5, -SMTW + 0.14, SMFH, 'rgba(255,255,250,0.5)'); R(SMTW - 0.16, 9.5, SMTW, SMFH, 'rgba(80,65,45,0.3)');
  R(-0.95, 11.2, 0.95, 24.4, '#cbc4b4');
  for (let i = 0; i < 7; i++) {
    const y = 23.5 - i * 1.85;
    R(-0.72, y - 0.72, 0.72, y + 0.72, '#37332d'); ring(0, y, 0.5, 0.17, '#e6e1d4'); ring(0, y, 0.17, 0.14, '#e6e1d4');
    line(-0.72, y, 0.72, y, 0.13, '#e6e1d4'); line(0, y - 0.72, 0, y + 0.72, 0.13, '#e6e1d4');
  }
  circ(0, 25.65, 1.0, '#ece8dc'); for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; line(Math.cos(a) * 0.68, 25.65 + Math.sin(a) * 0.68, Math.cos(a) * 0.92, 25.65 + Math.sin(a) * 0.92, 0.09, '#2a2622'); }
  line(0, 25.65, 0.45, 25.4, 0.09, '#2a2622'); line(0, 25.65, 0.05, 24.95, 0.07, '#2a2622');
  for (const x of [-1.25, 0, 1.25]) { R(x - 0.46, 27.1, x + 0.46, 30.1, '#2f2a24'); line(x - 0.46, 27.1, x + 0.46, 28.6, 0.07, '#8f877a'); line(x + 0.46, 27.1, x - 0.46, 28.6, 0.07, '#8f877a'); }
  circ(0, 28.9, 0.4, '#55604a'); R(-0.4, 28.45, 0.4, 28.85, '#55604a'); R(-SMTW, 30.5, SMTW, 30.65, '#bdb4a2'); for (const x of [-1.3, 0, 1.3]) R(x - 0.2, 31.1, x + 0.2, 31.55, '#4e463a');
  // behind the porch: ochre mosaic, the two plaques, the glazed door
  R(-5.2, 0, 5.2, 7.5, '#a98c55');
  for (let row = 0, y = 1.4; y < 7.4; y += 0.3, row++) for (let x = -5.2 + (row % 2) * 0.2; x < 5.2; x += 0.4) circ(x, y, 0.16, (row + Math.round(x * 3)) % 3 ? '#bd9c58' : '#c9aa68');
  for (const s of [-1, 1]) {
    R(s * 3.4 - 0.75, 2.2, s * 3.4 + 0.75, 5.25, '#cfc6b0'); R(s * 3.4 - 0.62, 2.3, s * 3.4 + 0.62, 4.25, '#e5e0d2');
    for (let y = 2.55; y < 4.05; y += 0.22) R(s * 3.4 - 0.45, y, s * 3.4 + 0.45, y + 0.05, 'rgba(70,60,45,0.55)');
    circ(s * 3.4, 4.72, 0.34, '#a89c84'); circ(s * 3.4, 4.72, 0.2, '#d8d0bc');
  }
  R(-1.45, 1.4, 1.55, 6.55, SMST); R(-1.0, 1.4, 1.15, 5.85, '#232a2c'); R(-1.0, 6.0, 1.15, 6.35, '#6e5230');
  for (const x of [-1.0, -0.5, 0.05, 0.62, 1.1]) R(x, 1.4, x + 0.07, 5.85, '#75654a'); for (const y of [2.5, 3.65, 4.8]) R(-1.0, y, 1.15, y + 0.07, '#75654a');
  R(-5.2, 6.8, 5.2, 7.5, 'rgba(40,30,18,0.4)');
  // the tiled picture, kept in a spare corner of the canvas: it stands on the back wing
  R(6.9, 12.0, 9.5, 14.8, '#b9ae98'); R(7.05, 12.15, 9.35, 14.65, '#5f79a8'); R(7.05, 12.15, 9.35, 12.75, '#75805a'); circ(8.2, 14.0, 0.55, '#d8c06a'); p.poly([[7.7, 12.4], [8.75, 12.4], [8.45, 13.65], [7.95, 13.65]], '#a8483a'); circ(8.2, 13.85, 0.22, '#dcb294'); p.poly([[7.95, 13.5], [7.2, 14.4], [7.6, 12.9]], '#e4ded0'); p.poly([[8.45, 13.5], [9.2, 14.4], [8.8, 12.9]], '#e4ded0');
  for (let x = 7.05; x < 9.4; x += 0.38) R(x, 12.15, x + 0.04, 14.65, 'rgba(40,40,40,0.18)'); for (let y = 12.15; y < 14.65; y += 0.36) R(7.05, y, 9.35, y + 0.04, 'rgba(40,40,40,0.18)');
  wear(g, w, h, 9202, 26, 0.05, 0.08);
}
function smWall(g, w, h) {   // a 4.4 m bay of the sides, 22.2 m: plain stone with windows below (the low wing), ribs and small openings above (the nave)
  const p = paint(g, w, h, 4.4, SMNH), { R } = p;
  base(g, w, h, '#d8ccb6', 9211);
  for (let y = 0.9; y < SMLOW; y += 0.75) R(-2.2, y, 2.2, y + 0.05, 'rgba(110,85,55,0.18)');
  R(-2.2, 0, 2.2, 0.9, '#b8ad98');
  for (const [a, b] of [[1.9, 3.9], [5.0, 7.0]]) { R(-0.85, a - 0.15, 0.85, b + 0.15, '#c6baa2'); R(-0.7, a, 0.7, b, '#3a3a36'); R(-0.7, b - 0.7, 0.7, b, '#a59877'); R(-0.03, a, 0.03, b - 0.7, '#8c8676'); }
  R(-2.2, SMLOW - 0.35, 2.2, SMLOW, '#bfb29a');
  for (let x = -2.2; x < 2.2; x += 1.1) { R(x, 9.5, x + 0.16, 20.4, 'rgba(110,85,55,0.28)'); R(x + 0.16, 9.5, x + 0.34, 20.4, 'rgba(255,248,230,0.35)'); }
  for (let x = -1.8; x < 2.1; x += 0.72) R(x - 0.23, 20.65, x + 0.23, 21.75, '#4e463a');
  R(-2.2, 22.0, 2.2, 22.2, '#b9ac94');
  wear(g, w, h, 9212, 16, 0.08, 0.08);
}
function smAngel(M) {   // the bronze archangel on his bracket, sword raised, the fallen devil at his feet
  const c = '#59766a', b = (sx, sy, sz, x, y, z, rz = 0, k = c) => box('flat', sx, sy, sz, { M, p: [x, y, z], rz, c: k, noao: true });
  b(1.5, 0.5, 0.7, 0, 0.9, 0, 0, '#4e665a'); b(0.9, 0.35, 0.5, 0.25, 1.35, 0.1, 0.35);
  b(0.26, 1.5, 0.3, -0.3, 1.3, 0.05, -0.12); b(0.26, 1.5, 0.3, 0.2, 1.4, 0.0, 0.14);
  cyl('flat', 0.34, 0.45, 1.25, 7, { M, p: [-0.05, 2.65, 0], c, noao: true }); sphere('flat', 0.27, { M, p: [-0.05, 4.2, 0.05], seg: 6, c, noao: true });
  b(0.2, 1.1, 0.2, -0.55, 3.6, 0.1, 0.9); b(0.09, 1.7, 0.09, -0.35, 4.2, 0.15, -1.05); b(0.2, 0.9, 0.2, 0.45, 3.0, 0.15, 0.55);
  for (const [s, x, y0, y1, x1] of [[1, 0.2, 2.9, 4.95, 0.85], [-1, -0.25, 3.1, 4.4, -0.8]]) extrude('flat', shapeOf([[x, y0], [x1, y1 - 0.2], [x1 + s * 0.1, y1], [x + s * 0.75, y0 - 0.9]]), 0.08, { M, p: [0, 0, -0.28], c: '#506b60', noao: true });
}
function buildSanMichele() {
  initShared();
  const S = site(SM.p, [-1627.9, -2102.3], [0.897, -0.441]), { F, y0, at } = S;
  defMat('brSmFront', 256, 448, [SMFW, SMFH], smFront);
  defMat('brSmWall', 64, 256, [4.4, SMNH], smWall);
  begin(y0);
  // the low block behind, to Via Sciuti
  const low = S.behind(-29.0);
  prism('brSmWall', low, S.lo, y0 + SMLOW, { uvo: [0, -y0 / SMNH] }); flatRoof(low, y0 + SMLOW);
  // the nave
  const nave = S.ring(-SMN, SMN, -40, -2.9);
  prism('brSmWall', nave, S.lo, y0 + SMNH, { uvo: [0, -y0 / SMNH] }); flatRoof(nave, y0 + SMNH);
  face('brSmFront', F, [[-SMN, -1.5], [SMN, -1.5], [SMN, SMNH], [-SMN, SMNH]], -2.95, -2.5, SMFW, SMFH);
  // the tower slab, its belfry and cross
  bx('flat', F, -SMTW, SMTW, 8, SMTH, -4.4, -2.02, { c: SMTWR, noao: true });
  face('brSmFront', F, [[-SMTW, 9.5], [SMTW, 9.5], [SMTW, SMTH], [-SMTW, SMTH]], -2.05, -1.9, SMFW, SMFH);
  for (const s of [-1, 1]) for (const dz of [-3.6, -2.75]) bx('flat', F, s * SMTW - 0.03, s * SMTW + 0.03, 27.1, 30.1, dz - 0.28, dz + 0.28, { c: '#2f2a24', noao: true });
  bx('flat', F, -SMTW - 0.18, SMTW + 0.18, SMTH, SMTH + 0.3, -4.55, -1.75, { c: '#c9c0ac', noao: true }); cross(F, 0, SMTH + 0.3, -2.2, 1.7, '#34302a');
  // the porch: the pierced front, the painted back wall, jambs, ceiling and steps
  const porch = shapeOf([[-7.3, -1.5], [7.3, -1.5], [7.3, 9.9], [0, 10.4], [-7.3, 9.9]]);
  for (const [a, b] of [[-5.06, -2.17], [-1.32, 1.53], [2.38, 5.06]]) { const h = new THREE.Path(); h.moveTo(a, 1.4); h.lineTo(a, 7.4); h.lineTo(b, 7.4); h.lineTo(b, 1.4); h.closePath(); porch.holes.push(h); }
  extrude('flat', porch, 0.55, { M: F, p: [0, 0, 0.45], c: SMST, noao: true });
  face('brSmFront', F, [[-5.2, 1.3], [5.2, 1.3], [5.2, 7.5], [-5.2, 7.5]], -1.35, -1.2, SMFW, SMFH);
  for (const s of [-1, 1]) bx('flat', F, s * 6.25 - 1.05, s * 6.25 + 1.05, -1.5, 9.88, -2.5, 0.46, { c: SMST });
  bx('flat', F, -5.2, 5.2, 7.4, 9.85, -2.5, 0.46, { c: '#cdc3ae', noao: true });
  for (let i = 0; i < 5; i++) bx('flat', F, -5.2, 5.2, i ? i * 0.28 : -1.5, (i + 1) * 0.28, -1.25, 0.98 - i * 0.28, { c: i % 2 ? '#bdb5a4' : '#cac2b0' });
  slab(F, [[-7.45, 9.85], [0, 10.35], [7.45, 9.85], [7.45, 10.1], [0, 10.62], [-7.45, 10.1]], -2.5, 1.12, '#c7bda6');
  // the side wings
  for (const s of [-1, 1]) { bx('flat', F, s * 8.35 - 1.05, s * 8.35 + 1.05, -1.5, 9.15, -2.9, 0.5, { c: '#d6cbb4' }); bx('flat', F, s * 8.35 - 1.12, s * 8.35 + 1.12, 9.15, 9.35, -2.95, 0.58, { c: '#bfb49d', noao: true }); }
  // gilt lanterns on their stems
  for (const x of [-5.4, -1.75, 1.85, 5.4]) { cyl('flat', 0.28, 0.18, 0.7, 6, { M: F, p: [x, 7.9, 1.22], c: '#c9a038', noao: true }); cone('flat', 0.34, 0.28, 6, { M: F, p: [x, 8.6, 1.22], c: '#5e5038', noao: true }); bx('flat', F, x - 0.04, x + 0.04, 5.3, 7.9, 1.0, 1.08, { c: '#9a9488', noao: true }); }
  bx('flat', F, -0.85, 0.85, 9.7, 10.95, -2.0, 0.9, { c: '#9fae9c', noao: true });
  smAngel(at(0, 10.15, 0.2));
  // the tiled picture on the back wing, towards the south
  const P = S.pts, B = S.edge(P[11], P[0]), sx = Math.sign(new THREE.Vector3(P[11][0], y0, P[11][1]).applyMatrix4(B.M.clone().invert()).x) || 1;
  face('brSmFront', B.M, [[-1.35, 12.0], [1.35, 12.0], [1.35, 14.8], [-1.35, 14.8]], -0.2, 0.02, SMFW, SMFH, 8.2, { p: [sx * (B.l / 2 - 5), -3.4, -0.2] });
  const o = end('San Michele Arcangelo');
  o.userData.solids = [[SM.p, null, y0 + SMLOW], [nave.flat(), null, y0 + SMNH], [S.ring(-9.4, 9.4, -2.9, 0.9).flat(), null, y0 + 9.2]];
  return o;
}

// =====================================================================================================
// Maria Santissima Mediatrice
// =====================================================================================================
const MM = { id: 'w48849513', p: [-2398.6, 1531.7, -2395.1, 1539.9, -2398.8, 1543.6, -2401.5, 1546.7, -2399.8, 1551.1, -2397.3, 1556.7, -2392.2, 1557.9, -2386.3, 1556.6, -2377.3, 1578, -2381.5, 1580.5, -2378.8, 1585.4, -2355.9, 1575.2, -2358.5, 1569.9, -2361.5, 1570.9, -2371.4, 1548.9, -2367.9, 1546, -2366.2, 1542.6, -2366.1, 1537.6, -2369.9, 1533.2, -2372.7, 1531.9, -2379.9, 1532.7, -2383.7, 1525.3] };
const MMFW = 25.4, MMFH = 26, MMTH = 25.4, MMEAVE = 14.2, MMCR = '#e2dac6', MMBE = '#c2b596';
function mmFront(g, w, h) {
  const p = paint(g, w, h, MMFW, MMFH), { R, arch, poly } = p;
  base(g, w, h, MMCR, 9301, 0.06);
  // the towers (the right hand one is also the skin of the other tower faces)
  for (const c of [-9.5, 9.5]) {
    for (const s of [-1, 1]) { R(c + s * 2.55 - 0.4, 0, c + s * 2.55 + 0.4, MMTH, MMBE); R(c + s * 2.55 + 0.32, 0, c + s * 2.55 + 0.4, MMTH, 'rgba(70,55,35,0.28)'); }
    for (const y of [10.0, 18.0, 25.0]) { R(c - 3, y, c + 3, y + 0.4, MMBE); R(c - 3, y - 0.18, c + 3, y, 'rgba(70,55,35,0.28)'); }
    for (const [a, b] of [[4.5, 8.3], [11.1, 15.2]]) { R(c - 1.0, a - 0.3, c + 1.0, b + 0.3, MMBE); R(c - 0.6, a, c + 0.6, b, '#566066'); R(c - 0.04, a, c + 0.04, b, '#bdb39a'); R(c - 0.6, b - 1.0, c + 0.6, b - 0.93, '#bdb39a'); }
    poly([[c - 1.8, 19.4], [c + 1.8, 19.4], [c + 1.8, 24.1], [c, 24.55], [c - 1.8, 24.1]], MMBE);
    for (const s of [-1, 1]) { R(c + s * 0.75 - 0.48, 19.8, c + s * 0.75 + 0.48, 23.9, '#3b362e'); R(c + s * 0.75 - 0.48, 19.8, c + s * 0.75 + 0.48, 21.0, '#6f685a'); for (let x = -0.4; x < 0.45; x += 0.2) R(c + s * 0.75 + x, 19.8, c + s * 0.75 + x + 0.05, 21.0, '#d8d0bc'); }
    R(c - 3, 0, c + 3, 1.2, '#bcb29c');
  }
  // the middle: steps, three red brown doors in beige frames, their hoods
  for (let i = 0; i < 6; i++) { R(-5.6, i * 0.33, 5.6, i * 0.33 + 0.27, i % 2 ? '#cdc5b2' : '#bfb7a5'); R(-5.6, i * 0.33 + 0.27, 5.6, i * 0.33 + 0.33, '#847c6c'); }
  for (const x of [-3.6, 0, 3.6]) { poly([[x - 1.35, 2.0], [x + 1.35, 2.0], [x + 1.35, 5.4], [x, 5.85], [x - 1.35, 5.4]], MMBE); R(x - 0.9, 2.0, x + 0.9, 5.05, '#74382a'); R(x - 0.03, 2.0, x + 0.03, 5.05, '#2c130d'); for (const s of [-1, 1]) for (const y of [2.25, 3.65]) R(x + s * 0.45 - 0.3, y, x + s * 0.45 + 0.3, y + 1.1, '#843f2e'); }
  R(-5.8, 6.2, 5.8, 6.5, 'rgba(70,55,35,0.2)');
  wear(g, w, h, 9302, 30, 0.1, 0.08);
}
function mmWall(g, w, h) {   // a 5.8 m bay of the flanks: pilaster, tall window, string course, square window
  const p = paint(g, w, h, 5.8, MMEAVE), { R } = p;
  base(g, w, h, MMCR, 9311, 0.06);
  R(-2.9, 0, 2.9, 1.2, '#bcb29c');
  R(-2.9, 1.2, -2.45, MMEAVE, MMBE); R(2.45, 1.2, 2.9, MMEAVE, MMBE); R(-2.45, 1.2, -2.35, MMEAVE, 'rgba(70,55,35,0.26)');
  R(-2.9, 9.9, 2.9, 10.3, MMBE); R(-2.9, 9.72, 2.9, 9.9, 'rgba(70,55,35,0.26)'); R(-2.9, MMEAVE - 0.4, 2.9, MMEAVE, MMBE);
  R(-0.85, 3.45, 0.85, 7.95, MMBE); R(-0.52, 3.75, 0.52, 7.65, '#4d565c'); for (let y = 4.2; y < 7.6; y += 0.5) R(-0.52, y, 0.52, y + 0.06, '#a89e86'); R(-0.04, 3.75, 0.04, 7.65, '#a89e86');
  R(-0.72, 10.75, 0.72, 12.85, MMBE); R(-0.46, 11.0, 0.46, 12.6, '#4d565c'); R(-0.04, 11.0, 0.04, 12.6, '#a89e86');
  wear(g, w, h, 9312, 14, 0.14, 0.08);
}
function buildMediatrice() {
  initShared();
  const S = site(MM.p, [-2367.35, 1580.3], [0.407, 0.913]), { F, y0, at } = S;
  defMat('brMmFront', 384, 384, [MMFW, MMFH], mmFront);
  defMat('brMmWall', 128, 256, [5.8, MMEAVE], mmWall);
  begin(y0);
  const body = S.behind(-6.0), neck = S.ring(-6.6, 6.6, -6.3, -1.8);
  for (const b of [body, neck]) { prism('brMmWall', b, S.lo, y0 + MMEAVE, { uvo: [0, -y0 / MMEAVE] }); flatRoof(b, y0 + MMEAVE); }
  // the saw tooth row of little gables along the walls
  for (let i = 0; i < body.length; i++) {
    const a = body[i], b = body[(i + 1) % body.length], E = S.edge(a, b, body); if (E.l < 3.4) continue;
    const mz = new THREE.Vector3((a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2).applyMatrix4(S.F.clone().invert()).z; if (mz > -7) continue;
    const n = Math.max(1, Math.round(E.l / 5.8)), s = E.l / n;
    for (let k = 0; k < n; k++) { const x0 = -E.l / 2 + k * s; slab(E.M, [[x0 + 0.25, MMEAVE], [x0 + s - 0.25, MMEAVE], [x0 + s - 0.25, MMEAVE + 0.35], [x0 + s / 2, MMEAVE + 1.35], [x0 + 0.25, MMEAVE + 0.35]], -0.3, 0.06, '#d9d0ba'); box('flat', s / 2 - 0.1, 0.14, 0.45, { M: E.M, p: [x0 + s * 0.27, MMEAVE + 0.82, -0.1], rz: Math.atan2(1.0, s / 2 - 0.25), c: MMBE, noao: true }); box('flat', s / 2 - 0.1, 0.14, 0.45, { M: E.M, p: [x0 + s * 0.73, MMEAVE + 0.82, -0.1], rz: -Math.atan2(1.0, s / 2 - 0.25), c: MMBE, noao: true }); }
  }
  // the towers: a core, the painted skin on each face, a flat cap
  const towers = [];
  for (const sg of [-1, 1]) {
    const cx = sg * 9.5, cz = -2.95, hw = 2.95; towers.push(S.ring(cx - hw, cx + hw, cz - hw, cz + hw));
    bx('flat', F, cx - hw + 0.12, cx + hw - 0.12, -1.5, MMTH - 0.05, cz - hw + 0.12, cz + hw - 0.12, { c: MMCR, noao: true });
    for (let k = 0; k < 4; k++) {
      const M = mul(at(cx, 0, cz), new THREE.Matrix4().makeRotationY(k * PI / 2));
      extrude('brMmFront', rect(-hw, -1.5, hw, MMTH), 0.16, { M, p: [0, 0, hw - 0.16], uv: 'keep', uvk: [(6 / (2 * hw)) / MMFW, 1 / MMFH], uvo: [(9.5 + MMFW / 2) / MMFW, 0], noao: true });
    }
    bx('flat', F, cx - hw - 0.16, cx + hw + 0.16, MMTH, MMTH + 0.3, cz - hw - 0.16, cz + hw + 0.16, { c: MMBE, noao: true });
  }
  const side = mul(at(12.45, 0, -2.95), new THREE.Matrix4().makeRotationY(PI / 2));
  bx('flat', side, -0.95, 0.95, 1.7, 4.6, -0.02, 0.07, { c: MMBE, noao: true }); bx('flat', side, -0.65, 0.65, 1.9, 4.3, 0.02, 0.1, { c: '#4a2a20', noao: true });
  // the steps up to the doors, as painted behind them: the front stands 1.45 m back from the footprint's edge, where the lapa stops
  for (let i = 0; i < 6; i++) bx('flat', F, -5.6, 5.6, i ? i * 0.33 : -1.5, (i + 1) * 0.33, -1.45, -0.01 - i * 0.24, { c: i % 2 ? '#cdc5b2' : '#bfb7a5', noao: true });
  // the gabled front between them
  face('brMmFront', F, [[-6.6, -1.5], [6.6, -1.5], [6.6, 17.0], [0, 19.6], [-6.6, 17.0]], -1.9, -1.45, MMFW, MMFH);
  slab(F, [[-6.6, MMEAVE], [6.6, MMEAVE], [6.6, 17.0], [0, 19.5], [-6.6, 17.0]], -3.0, -1.9, MMCR);
  const ra = Math.atan2(2.7, 6.0), rl = Math.hypot(6.0, 2.7);
  for (const s of [-1, 1]) {
    box('flat', rl + 0.5, 1.25, 1.0, { M: F, p: [s * 3.1, 17.35, -1.2], rz: -s * ra, c: '#a5aa9c', noao: true });
    box('flat', rl + 0.7, 0.2, 1.15, { M: F, p: [s * 3.15, 18.68, -1.18], rz: -s * ra, c: '#d4ccb8', noao: true });
    bx('flat', F, s * 6.05 - 0.45, s * 6.05 + 0.45, 14.6, 16.7, -1.5, -0.7, { c: '#a5aa9c', noao: true });
    slab(F, [[s * 1.8 - 0.28, 2.0], [s * 1.8 + 0.28, 2.0], [s * 1.8 + 0.28, 9.8], [s * 1.8, 10.8], [s * 1.8 - 0.28, 9.8]], -1.5, -1.2, '#cabd9f');
  }
  for (const x of [-3.6, 0, 3.6]) slab(F, [[x - 1.55, 6.15], [x, 6.75], [x + 1.55, 6.15], [x + 1.55, 6.45], [x, 7.15], [x - 1.55, 6.45]], -1.5, -0.6, '#d5ccb4');
  disc(F, 0, 12.4, -1.5, 1.65, 0.28, MMBE, 8, PI / 8); disc(F, 0, 12.4, -1.45, 1.15, 0.26, '#e6dfcd', 8, PI / 8); disc(F, 0, 12.4, -1.4, 0.78, 0.24, '#51606e', 8, PI / 8);
  for (const [a, b] of [[1.45, 0.08], [0.08, 1.45]]) bx('flat', F, -a / 2, a / 2, 12.4 - b / 2, 12.4 + b / 2, -1.16, -1.12, { c: '#b9ae94', noao: true });
  cross(F, 0, 19.9, -1.3, 1.7, '#cfc8b6');
  const o = end('Maria Santissima Mediatrice');
  o.userData.solids = [[MM.p, null, y0 + MMEAVE], ...towers.map(t => [t.flat(), null, y0 + MMTH])];
  return o;
}

// =====================================================================================================
// San Raffaele Arcangelo
// =====================================================================================================
const SR = { id: 'w81132103', p: [-957.5, 2007, -955.4, 2017.2, -946.5, 2022.3, -936.3, 2020.5, -934.3, 2017.8, -930.7, 2019.6, -927.7, 2012.6, -919.5, 2010.9, -917.8, 2016.7, -913.6, 2016.3, -914.2, 2013.4, -891.9, 2007.6, -893.2, 1998.1, -920.5, 2003.4, -921.7, 1998.6, -918.6, 1994.9, -913.5, 1996.7, -911.5, 1995.7, -907.5, 1997.3, -904.5, 1993.4, -907.9, 1991.1, -906.8, 1987.8, -930.5, 1973.4, -929.5, 1971.3, -936.7, 1967.7, -942.7, 1978.7, -936.4, 1981.4, -933.4, 1978.9, -922.8, 1985.9, -929.7, 1996.9, -934.8, 1992.3, -936.4, 1994.5, -939.1, 1995.5, -940.2, 1999.5, -949.9, 2000.7] };
const SRC = [-943.2, 2007.5], SRLOW = 5.4, SRAP = 9.6, SRSIDE = 2 * 9.6 * Math.tan(PI / 8), SRCR = '#e8ddc0', SRYE = '#d8bd74', SRWING = 8.4;
function srFace(g, w, h) {   // one face of the octagon: cream with the yellow frame that follows the chamfered top
  const p = paint(g, w, h, SRSIDE, 17.6), { poly } = p, a = SRSIDE / 2;
  base(g, w, h, SRYE, 9401, 0.05);
  poly([[-a + 0.65, 0], [a - 0.65, 0], [a - 0.65, 14.7], [a * 0.5, 16.6], [-a * 0.5, 16.6], [-a + 0.65, 14.7]], SRCR);
  p.line(0, 0, 0, SRLOW, 0.1, SRCR);
  wear(g, w, h, 9402, 10, 0, 0.07);
}
function srDrum(g, w, h) {   // one side of the lantern, 2.04 x 4.4 m: a window between yellow piers, the scalloped cornice over it
  const p = paint(g, w, h, 2.04, 4.4), { R, circ } = p;
  base(g, w, h, SRYE, 9411, 0.05);
  R(-0.82, 0.8, 0.82, 3.35, SRCR); R(-0.68, 0.95, 0.68, 3.2, '#7f9aa4'); R(-0.04, 0.95, 0.04, 3.2, SRCR); R(-0.68, 2.55, 0.68, 2.62, SRCR); R(-0.68, 0.95, 0.68, 1.5, 'rgba(30,40,45,0.35)');
  R(-1.02, 3.55, 1.02, 4.4, '#6f6a62'); circ(-0.51, 3.7, 0.5, SRYE); circ(0.51, 3.7, 0.5, SRYE); R(-1.02, 3.45, 1.02, 3.68, SRYE);
}
function srStone(g, w, h) {   // the lower hall: pale squared stone cladding under a yellow cornice, a 4 m bay up to its roof
  const p = paint(g, w, h, 4, SRWING), { R } = p;
  paintAshlar(g, w, h, 4, SRWING, 0.7, 1.15, '#ddd2ba', '#bcae92', 9421, 1.0, 0.05);
  R(-2, 6.9, 2, 8.15, SRYE); R(-2, 6.75, 2, 6.9, 'rgba(70,50,30,0.3)'); R(-2, 8.15, 2, SRWING, '#b9b0a0'); R(-2, 0, 2, 0.7, '#b0a690');
  wear(g, w, h, 9422, 10, 0.2, 0.08);
}
function buildRaffaele() {
  initShared();
  const pts = pairsOf(SR.p);
  const y0 = Math.min(groundY(-945, 1999), groundY(-930, 1985), groundY(-940, 2022)), lo = Math.min(groundRange(pts).lo, y0) - 1.5;
  const S = site(SR.p, [-938, 1975], [-0.45, -0.893]);   // used for its wall frames
  defMat('brSrFace', 128, 256, [SRSIDE, 17.6], srFace);
  defMat('brSrDrum', 64, 128, [2.04, 4.4], srDrum);
  defMat('brSrStone', 128, 256, [4, SRWING], srStone);
  begin(y0);
  const P = (i) => pts[i];
  // the low ring round the hall, with its dark windows on the street sides
  const ringLow = [0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 28, 29, 30, 31, 32, 33, 34].map(P);
  prism('flat', ringLow, lo, y0 + SRLOW, { c: '#e2d8bf' }); flatRoof(ringLow, y0 + SRLOW, '#8d877d');
  const E = (a, b, poly) => { const e = S.edge(a, b, poly); e.M.elements[13] = y0; return e; };
  for (const [i, j] of [[34, 0], [33, 34], [0, 1]]) { const e = E(P(i), P(j)), n = Math.max(1, Math.floor(e.l / 3.2)); for (let k = 0; k < n; k++) { const x = -e.l / 2 + (k + 0.5) * e.l / n; bx('flat', e.M, x - 0.8, x + 0.8, 2.2, 4.1, -0.03, 0.05, { c: '#33423a', noao: true }); bx('flat', e.M, x - 0.95, x + 0.95, 4.1, 4.3, -0.03, 0.1, { c: SRYE, noao: true }); } }
  // the north hall in stone and the eastern arm
  const wing = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].map(P), east = [7, 8, 9, 10, 11, 12, 13, 14].map(P);
  for (const b of [wing, east]) { prism('brSrStone', b, lo, y0 + SRWING, { uvo: [0, -y0 / SRWING] }); flatRoof(b, y0 + SRWING, '#8d877d'); }
  const W = E(P(24), P(25), wing);
  for (let k = 0; k < 4; k++) { const x = -W.l / 2 + 2.4 + k * (W.l - 4.8) / 3; extrude('flat', archShape(1.5, 2.8), 0.05, { cs: 4, M: W.M, p: [x, 4.35, -0.01], c: SRYE, noao: true }); extrude('flat', archShape(1.15, 2.5), 0.05, { cs: 4, M: W.M, p: [x, 4.5, 0.02], c: '#4a3a2e', noao: true }); }
  const G = E(P(21), P(22), wing);
  for (let k = 0; k < 8; k++) { const x = -G.l / 2 + (k + 0.5) * G.l / 8; extrude('flat', archShape(1.2, 2.6), 0.05, { cs: 4, M: G.M, p: [x, 3.0, 0.0], c: '#4a3a2e', noao: true }); }
  // the octagonal hall
  const C = frame(SRC[0], y0, SRC[1], -0.122, -0.9925), turn = (k) => mul(C, new THREE.Matrix4().makeRotationY(k * PI / 4)), a = SRSIDE / 2;
  const outline = [[-a, SRLOW], [a, SRLOW], [a, 15.2], [a * 0.5, 17.4], [-a * 0.5, 17.4], [-a, 15.2]];
  for (let k = 0; k < 8; k++) face('brSrFace', turn(k), outline, SRAP - 0.35, SRAP, SRSIDE, 17.6);
  const R8 = SRAP / Math.cos(PI / 8), oct = [];
  for (let k = 0; k < 8; k++) { const v = new THREE.Vector3(Math.sin(k * PI / 4 + PI / 8) * (R8 - 0.45), 0, Math.cos(k * PI / 4 + PI / 8) * (R8 - 0.45)).applyMatrix4(C); oct.push([v.x, v.z]); }
  prism('flat', oct, y0 + SRLOW, y0 + 14.9, { c: SRCR });
  cyl('flat', 4.2, 7.1, 5.8, 8, { M: C, p: [0, 14.85, 0], ry: PI / 8, c: '#8a857d', noao: true });
  // the lantern: twelve glazed sides, the scalloped cornice, the cap, spire, ball and cross
  const DR = 3.9, DS = 2 * DR * Math.tan(PI / 12);
  for (let k = 0; k < 12; k++) { const M = mul(C, new THREE.Matrix4().makeRotationY(k * PI / 6)); extrude('brSrDrum', rect(-DS / 2, 0, DS / 2, 4.4), 0.25, { M, p: [0, 20.6, DR - 0.25], uv: 'keep', uvk: [1 / DS, 1 / 4.4], uvo: [0.5, 0], noao: true }); cyl('flat', 0.55, 0.55, 0.35, 6, { M, p: [0, 24.85, DR - 0.25], rx: PI / 2, c: SRYE, noao: true }); }
  cyl('flat', DR - 0.2, DR - 0.2, 4.3, 12, { M: C, p: [0, 20.6, 0], ry: PI / 12, c: SRYE, noao: true });
  cyl('flat', 0.5, DR + 0.15, 1.6, 12, { M: C, p: [0, 24.95, 0], ry: PI / 12, c: '#6f6a62', noao: true });
  cone('flat', 0.45, 1.7, 8, { M: C, p: [0, 26.4, 0], c: '#3c3a38' }); sphere('flat', 0.38, { M: C, p: [0, 28.0, 0], seg: 6, c: '#3c3a38', noao: true }); cross(C, 0, 28.25, 0, 1.1, '#34302a');
  // the bell tower to the east
  const T = frame(-918.4, y0, 2005.8, -0.122, -0.9925), t = 1.85;
  bx('flat', T, -t, t, SRLOW, 23.2, -t, t, { c: SRYE });
  for (let k = 0; k < 4; k++) { const M = mul(T, new THREE.Matrix4().makeRotationY(k * PI / 2)); bx('flat', M, -1.0, 1.0, SRWING, 17.9, t - 0.02, t + 0.04, { c: SRCR, noao: true }); extrude('flat', archShape(1.8, 3.5), 0.05, { cs: 4, M, p: [0, 18.7, t - 0.01], c: '#3d342a', noao: true }); bx('flat', M, -0.04, 0.04, 18.7, 21.4, t + 0.03, t + 0.08, { c: '#8a8070', noao: true }); }
  bx('flat', T, -t - 0.25, t + 0.25, 23.2, 23.55, -t - 0.25, t + 0.25, { c: '#c4aa66', noao: true });
  pyramid('flat', 3.9, 3.9, 1.2, { M: T, p: [0, 23.55, 0], c: '#6f6a62', noao: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box('flat', 0.1, 4.0, 0.1, { M: T, p: [sx * 0.9, 23.9, sz * 0.9], rz: sx * 0.23, rx: -sz * 0.23, c: '#34302a', noao: true });
  sphere('flat', 0.28, { M: T, p: [0, 27.8, 0], seg: 6, c: '#34302a', noao: true }); bx('flat', T, -0.05, 0.05, 27.9, 29.4, -0.05, 0.05, { c: '#34302a', noao: true });
  const o = end('San Raffaele Arcangelo');
  o.userData.solids = [[SR.p, null, y0 + SRLOW], [oct.flat(), null, y0 + 15.2], [wing.flat(), null, y0 + SRWING], [east.flat(), null, y0 + SRWING]];
  return o;
}

// =====================================================================================================
// Santa Lucia Vergine Maria
// =====================================================================================================
const SL = { id: 'w82636565', p: [-259.3, -1726.6, -248.3, -1731.7, -242.9, -1722.1, -212.7, -1736, -204.5, -1719.1, -233.4, -1704.3, -227, -1691.5, -238.8, -1686.2, -245.7, -1700.1, -246.9, -1699.9] };
const SLW = 12.1, SLEAVE = 17.4, SLTOP = 18.9, SLFH = 19.2, SLNAVE = 14.4, SLLOW = 6.4, SLWH = '#e4e1d8';
function slCourses(R, x0, x1, y1) { for (let y = 0.9; y < y1; y += 0.52) R(x0, y, x1, y + 0.05, 'rgba(95,90,80,0.22)'); }
function slFront(g, w, h) {
  const p = paint(g, w, h, SLW, SLFH), { R, poly, line, circ } = p;
  base(g, w, h, SLWH, 9501, 0.05);
  slCourses(R, -6.05, 6.05, SLFH);
  // the relief of two angels either side of the middle
  for (const s of [-1, 1]) { poly([[s * 0.35, 16.9], [s * 1.5, 17.55], [s * 2.1, 17.45], [s * 1.35, 17.15], [s * 1.75, 16.95], [s * 0.9, 16.75]], '#b9b3a4'); circ(s * 0.62, 17.38, 0.2, '#aaa493'); line(s * 0.4, 16.75, s * 1.3, 16.45, 0.12, '#b9b3a4'); }
  // five small windows with pointed heads in a raised frame
  R(-3.55, 13.6, 3.55, 16.2, '#f0eee6'); R(-3.55, 13.45, 3.55, 13.6, 'rgba(70,65,55,0.35)');
  for (let i = -2; i <= 2; i++) { const x = i * 1.33; poly([[x - 0.46, 13.85], [x + 0.46, 13.85], [x + 0.46, 15.5], [x, 15.95], [x - 0.46, 15.5]], '#3f4a48'); for (let y = 14.15; y < 15.6; y += 0.42) { line(x - 0.46, y, x, y + 0.22, 0.05, '#b29c68'); line(x, y + 0.22, x + 0.46, y, 0.05, '#b29c68'); } }
  // three tall windows with zigzag glazing
  for (const x of [-2.32, 0, 2.32]) {
    poly([[x - 1.18, 4.75], [x + 1.18, 4.75], [x + 1.18, 12.25], [x, 12.95], [x - 1.18, 12.25]], '#f1efe7');
    poly([[x - 0.9, 4.85], [x + 0.9, 4.85], [x + 0.9, 12.05], [x, 12.55], [x - 0.9, 12.05]], '#485459');
    for (let y = 5.2; y < 12.0; y += 0.62) { line(x - 0.9, y, x, y + 0.34, 0.07, '#b6a470'); line(x, y + 0.34, x + 0.9, y, 0.07, '#b6a470'); line(x - 0.9, y + 0.34, x, y, 0.04, '#8f8660'); line(x, y, x + 0.9, y + 0.34, 0.04, '#8f8660'); }
    line(x + 1.2, 4.75, x + 1.2, 12.2, 0.12, 'rgba(80,72,58,0.35)');
  }
  // the folded ledge, the shadow of the porch, the doors behind the gilt gates
  poly([[-4.6, 4.25], [-3.48, 4.85], [-2.32, 4.4], [-1.16, 4.85], [0, 4.4], [1.16, 4.85], [2.32, 4.4], [3.48, 4.85], [4.6, 4.25], [4.6, 4.05], [-4.6, 4.05]], '#d2cec2');
  R(-3.9, 0.4, 3.9, 3.9, '#4b443a'); for (const x of [-1.95, 0, 1.95]) { poly([[x - 0.7, 0.4], [x + 0.7, 0.4], [x + 0.7, 2.9], [x, 3.35], [x - 0.7, 2.9]], '#241f1a'); R(x - 0.55, 0.4, x - 0.1, 2.2, '#bdb7a8'); }
  for (let i = 0; i < 2; i++) R(-4.4, i * 0.2, 4.4, i * 0.2 + 0.17, '#b9b4a8');
  wear(g, w, h, 9502, 24, 0.07, 0.08);
}
function slWall(g, w, h) { const p = paint(g, w, h, 4, 4.16); base(g, w, h, '#dedbd1', 9511, 0.05); for (let y = 0.1; y < 4.16; y += 0.52) p.R(-2, y, 2, y + 0.05, 'rgba(95,90,80,0.22)'); streaks(g, w, h, 8, 9512, 0.08, 50, '80,66,50'); }
function buildSantaLucia() {
  initShared();
  const S = site(SL.p, [-253.8, -1729.15], [-0.421, -0.907]), { F, y0 } = S;
  defMat('brSlFront', 256, 384, [SLW, SLFH], slFront);
  defMat('brSlWall', 64, 64, [4, 4.16], slWall);
  begin(y0);
  const body = S.behind(-0.3);
  prism('brSlWall', body, S.lo, y0 + SLLOW); flatRoof(body, y0 + SLLOW);
  const nave = S.ring(-6.0, 6.0, -29.5, -0.3);
  prism('brSlWall', nave, y0 + SLLOW, y0 + SLNAVE); flatRoof(nave, y0 + SLNAVE);
  gable('flat', 'brSlWall', S.at(0, 0, -16.2), 11.6, 26.4, SLNAVE, 1.1, { ov: 0.1, c: '#a8a298', wc: '#ffffff' });
  face('brSlFront', F, [[-6.05, -1.5], [6.05, -1.5], [6.05, SLEAVE], [0, SLTOP], [-6.05, SLEAVE]], -0.35, 0, SLW, SLFH);
  slab(F, [[-6.0, SLNAVE - 0.2], [6.0, SLNAVE - 0.2], [6.0, SLEAVE - 0.05], [0, SLTOP - 0.05], [-6.0, SLEAVE - 0.05]], -2.8, -0.34, '#dcd9cf');
  const ra = Math.atan2(SLTOP - SLEAVE, 6.05), rl = Math.hypot(6.05, SLTOP - SLEAVE);
  for (const s of [-1, 1]) box('flat', rl + 0.2, 0.28, 0.6, { M: F, p: [s * 3.05, (SLEAVE + SLTOP) / 2 - 0.05, -0.1], rz: -s * ra, c: '#b88f70', noao: true });
  cross(F, 0, SLTOP + 0.1, -0.15, 1.7, '#2f2a24');
  for (const x of [-3.5, -1.16, 1.16, 3.5]) cyl('flat', 0.17, 0.2, 0.5, 6, { M: F, p: [x, 13.0, -0.02], rx: PI / 2, c: '#d8d4c8', noao: true });
  // the porch: folded canopy, four piers, gilt gates between them
  slab(F, [[-3.9, 3.25], [-2.9, 3.3], [-1.93, 3.75], [-0.97, 3.3], [0, 3.75], [0.97, 3.3], [1.93, 3.75], [2.9, 3.3], [3.9, 3.25], [3.9, 3.6], [2.9, 3.7], [1.93, 4.15], [0.97, 3.7], [0, 4.15], [-0.97, 3.7], [-1.93, 4.15], [-2.9, 3.7], [-3.9, 3.6]], -0.05, 1.15, '#d6d2c6');
  for (const x of [-2.9, -0.97, 0.97, 2.9]) bx('flat', F, x - 0.22, x + 0.22, -0.5, 3.4, 0.55, 1.0, { c: '#d4d0c4' });
  for (const x of [-1.93, 0, 1.93]) { for (let k = -3; k <= 3; k++) bx('flat', F, x + k * 0.22 - 0.025, x + k * 0.22 + 0.025, 0.3, 2.25 + (k === 0 ? 0.2 : 0), 0.62, 0.67, { c: '#c2a45a', noao: true }); for (const y of [0.55, 1.95]) bx('flat', F, x - 0.72, x + 0.72, y, y + 0.07, 0.61, 0.69, { c: '#c2a45a', noao: true }); }
  bx('flat', F, -4.2, 4.2, -0.8, 0.22, -0.05, 1.15, { c: '#bdb8ac' });
  const o = end('Santa Lucia al Borgo');
  o.userData.solids = [[SL.p, null, y0 + SLLOW], [nave.flat(), null, y0 + SLNAVE]];
  return o;
}

// =====================================================================================================
// Santa Caterina da Siena
// =====================================================================================================
const SC = { id: 'w279882644', p: [549, 331.3, 550.8, 335.3, 556.8, 348.6, 561.5, 346.4, 565, 353.9, 550.9, 359.8, 542.8, 340.7, 542.5, 339.9, 536.5, 326, 545.5, 321.8] };
const SCW = 36.8, SCH = 15.2, SCX = (along) => along - 18.4, SCPL = '#d6c7a8', SCST = '#b7a78a';
function scFront(g, w, h) {
  const p = paint(g, w, h, SCW, SCH), { R, poly, X, Y } = p;
  base(g, w, h, SCPL, 9601, 0.1);
  const r = RNG(9603);
  for (let i = 0; i < 26; i++) { const x = r() * w, y = h - r() * r() * h * 0.5, rad = 6 + r() * 26, gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.6 ? '110,90,66' : '235,222,198'},0.28)`); gr.addColorStop(1, 'rgba(120,100,70,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
  R(-18.4, 0, 18.4, 0.95, '#9a9284'); R(-18.4, 0.95, 18.4, 1.07, '#c3b9a4'); R(-18.4, 3.85, 18.4, 4.05, SCST); R(-18.4, 3.72, 18.4, 3.85, 'rgba(70,52,32,0.3)'); R(-18.4, 7.6, 18.4, 7.8, SCST); R(-18.4, 7.48, 18.4, 7.6, 'rgba(70,52,32,0.28)');
  R(-18.4, 14.5, 18.4, 14.75, SCST); R(-18.4, 14.75, 18.4, SCH, '#cbbb9a'); R(-18.4, 14.35, 18.4, 14.5, 'rgba(70,52,32,0.35)');
  // the upper windows: stone frame, cornice, sill, the iron grille standing out from them
  const win = (x, y0, y1, ww, grille) => {
    R(x - ww / 2 - 0.35, y0 - 0.15, x + ww / 2 + 0.35, y1 + 0.35, SCST); R(x - ww / 2 - 0.6, y1 + 0.5, x + ww / 2 + 0.6, y1 + 0.75, '#c9b999'); R(x - ww / 2 - 0.6, y1 + 0.38, x + ww / 2 + 0.6, y1 + 0.5, 'rgba(70,52,32,0.4)'); R(x - ww / 2 - 0.5, y0 - 0.4, x + ww / 2 + 0.5, y0 - 0.15, '#c4b494');
    R(x - ww / 2, y0, x + ww / 2, y1, '#4d4034'); R(x - 0.04, y0, x + 0.04, y1, '#7a6a54');
    if (!grille) return;
    for (let k = x - ww / 2 - 0.1; k <= x + ww / 2 + 0.12; k += 0.26) R(k, y0 - 0.05, k + 0.055, y1 + 0.05, '#2c241e');
    for (let y = y0; y <= y1 + 0.02; y += 0.3) R(x - ww / 2 - 0.12, y, x + ww / 2 + 0.17, y + 0.055, '#2c241e');
  };
  const bays = [2.9, 10.1, 15.3, 21.7, 27.8, 33.6].map(SCX);
  for (const x of bays) { win(x, 4.55, 6.65, 1.7, true); win(x, 8.6, 10.7, 1.6, true); win(x, 12.2, 13.55, 1.3, false); }
  // ground floor: shop doors, the barred window, the church door with its pilasters and cornice
  const door = (x, ww, y1, c) => { R(x - ww / 2 - 0.3, 0, x + ww / 2 + 0.3, y1 + 0.35, SCST); R(x - ww / 2 - 0.45, y1 + 0.35, x + ww / 2 + 0.45, y1 + 0.55, '#c9b999'); R(x - ww / 2, 0, x + ww / 2, y1, c); };
  door(SCX(3.0), 1.7, 2.75, '#8f8577'); for (let y = 0.15; y < 2.7; y += 0.2) R(SCX(2.15), y, SCX(3.85), y + 0.05, 'rgba(40,32,24,0.4)'); R(SCX(2.15), 2.78, SCX(3.85), 3.45, '#e6e2d8'); R(SCX(2.4), 3.0, SCX(3.4), 3.22, '#58707a');
  R(SCX(9.4), 1.45, SCX(11.0), 3.65, SCST); R(SCX(9.6), 1.65, SCX(10.8), 3.45, '#3d332a'); for (let x = 9.65; x < 10.8; x += 0.22) R(SCX(x), 1.65, SCX(x) + 0.05, 3.45, '#231c16'); for (let y = 1.9; y < 3.4; y += 0.3) R(SCX(9.6), y, SCX(10.8), y + 0.05, '#231c16');
  for (const [a, c] of [[21.7, '#6e5440'], [27.8, '#8a5c40'], [33.6, '#7a6a58']]) { door(SCX(a), 1.6, 2.9, c); for (let y = 0.2; y < 2.85; y += 0.24) R(SCX(a) - 0.8, y, SCX(a) + 0.8, y + 0.05, 'rgba(35,22,14,0.4)'); }
  const cx = SCX(15.3);
  R(cx - 2.0, 0, cx + 2.0, 3.55, '#cdbd9d'); for (const s of [-1, 1]) { R(cx + s * 1.55 - 0.32, 0, cx + s * 1.55 + 0.32, 3.4, SCST); R(cx + s * 1.55 + 0.2, 0, cx + s * 1.55 + 0.32, 3.4, 'rgba(70,52,32,0.35)'); R(cx + s * 1.55 - 0.45, 3.1, cx + s * 1.55 + 0.45, 3.4, '#c9b999'); }
  R(cx - 1.05, 0, cx + 1.05, 3.0, '#7d4432'); R(cx - 0.03, 0, cx + 0.03, 3.0, '#331a12'); for (const s of [-1, 1]) for (let y = 0.25; y < 2.7; y += 0.68) { R(cx + s * 0.52 - 0.36, y, cx + s * 0.52 + 0.36, y + 0.52, '#8d4f3a'); R(cx + s * 0.52 - 0.22, y + 0.1, cx + s * 0.52 + 0.22, y + 0.42, '#7a4231'); }
  R(cx - 2.15, 3.55, cx + 2.15, 3.8, '#d3c4a4'); R(cx - 2.3, 4.0, cx + 2.3, 4.25, '#d3c4a4'); poly([[cx - 0.6, 3.8], [cx + 0.6, 3.8], [cx + 0.25, 4.0], [cx - 0.25, 4.0]], '#a8977a');
  // the marble plaque under the statue
  R(SCX(12.28), 1.7, SCX(13.0), 2.12, '#e8e4da'); for (let y = 1.78; y < 2.08; y += 0.09) R(SCX(12.35), y, SCX(12.93), y + 0.025, 'rgba(60,55,48,0.6)');
  wear(g, w, h, 9602, 60, 0.2, 0.11);
  g.fillStyle = 'rgba(50,36,24,0.18)'; g.fillRect(X(-18.4), Y(1.8), w, 0.8 * p.sy);
}
function buildCaterina() {
  initShared();
  const S = site(SC.p, [543.7, 342.9], [-0.92, 0.392]), { F, y0 } = S;
  defMat('brScFront', 640, 272, [SCW, SCH], scFront);
  begin(y0);
  const body = S.behind(-0.35);
  prism('plaster', body, S.lo, y0 + SCH, { c: '#ddccaa' }); flatRoof(body, y0 + SCH, '#a49a8a');
  face('brScFront', F, [[-18.4, -1.5], [18.4, -1.5], [18.4, SCH], [-18.4, SCH]], -0.4, 0, SCW, SCH);
  bx('flat', F, -18.5, 18.5, SCH - 0.2, SCH + 0.12, -0.35, 0.3, { c: '#c9b999', noao: true });
  // grilles, cornices, drain pipes, the church door's cornice, the statue on its bracket, the lantern
  for (const a of [2.9, 10.1, 15.3, 21.7, 27.8, 33.6]) {
    for (const [y0g, y1g] of [[4.5, 6.7], [8.55, 10.75]]) { bx('flat', F, SCX(a) - 0.98, SCX(a) + 0.98, y0g, y0g + 0.07, 0, 0.3, { c: '#2c241e', noao: true }); for (const s of [-1, 1]) box('flat', 0.06, y1g - y0g, 0.06, { M: F, p: [SCX(a) + s * 0.95, y0g, 0.16], rx: -0.12, c: '#2c241e', noao: true }); }
    for (const y of [7.18, 11.22]) bx('flat', F, SCX(a) - 1.45, SCX(a) + 1.45, y, y + 0.14, -0.02, 0.22, { c: '#c9b999', noao: true });
  }
  for (const a of [6.4, 12.4, 24.7]) bx('flat', F, SCX(a) - 0.07, SCX(a) + 0.07, 0.4, SCH - 0.2, 0, 0.14, { c: '#9a6a55', noao: true });
  for (const s of [-1, 1]) bx('flat', F, SCX(15.3) + s * 1.55 - 0.24, SCX(15.3) + s * 1.55 + 0.24, 0, 3.4, -0.02, 0.18, { c: '#bfae8e' });
  bx('flat', F, SCX(15.3) - 2.35, SCX(15.3) + 2.35, 4.05, 4.28, -0.02, 0.42, { c: '#d0c0a0', noao: true });
  bx('flat', F, SCX(12.65) - 0.4, SCX(12.65) + 0.4, 2.35, 2.5, -0.02, 0.42, { c: '#cfc6b2', noao: true });
  statue('flat', S.at(SCX(12.65), 2.5, 0.22), 0.95, { c: '#eeebe2', noao: true });
  bx('flat', F, SCX(4.6) - 0.03, SCX(4.6) + 0.03, 5.15, 5.2, 0, 0.55, { c: '#26211c', noao: true }); cyl('flat', 0.22, 0.13, 0.5, 6, { M: F, p: [SCX(4.6), 4.65, 0.55], c: '#33302a', noao: true });
  const o = end('Chiesa di Santa Caterina da Siena');
  o.userData.solids = [[SC.p, null, y0 + SCH]];
  return o;
}

// the porches that stand in front of their footprints: wall segments along their outline, in the frame (origin O, normal N)
const outline = (O, N, L) => { const P = L.map(([x, z]) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]]); return P.slice(1).map((b, i) => [...P[i], ...b]); };

export const BATCH_R = [
  { name: 'Chiesa di Terrasanta', x: -1432, z: -1626, radius: 40, skipIds: [TS.id], build: buildTerrasanta },
  { name: 'San Michele Arcangelo', x: -1661, z: -2096, radius: 55, skipIds: [SM.id], build: buildSanMichele, walls: outline([-1627.9, -2102.3], [0.897, -0.441], [[-6.6, -2.9], [-9.4, -2.9], [-9.4, 0.5], [-7.3, 0.5], [-7.3, 1.0], [7.3, 1.0], [7.3, 0.5], [9.4, 0.5], [9.4, -2.9], [6.6, -2.9]]) },
  { name: 'Maria Santissima Mediatrice', x: -2380, z: 1552, radius: 50, skipIds: [MM.id], build: buildMediatrice },
  { name: 'San Raffaele Arcangelo', x: -926, z: 1999, radius: 55, skipIds: [SR.id], build: buildRaffaele },
  { name: 'Santa Lucia Vergine Maria', x: -236, z: -1712, radius: 50, skipIds: [SL.id], build: buildSantaLucia, walls: outline([-253.8, -1729.15], [-0.421, -0.907], [[-3.15, 0], [-3.15, 1.05], [3.15, 1.05], [3.15, 0]]) },
  { name: 'Chiesa di Santa Caterina da Siena', x: 550, z: 340, radius: 35, skipIds: [SC.id], build: buildCaterina },
];
