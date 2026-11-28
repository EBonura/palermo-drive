// City landmarks, batch Q (five churches). Registered through BATCH_Q in src/landmarks-city.js.
// Of the eleven churches that were still drawn by the generic builder, exterior photos were found for five: two on Wikimedia Commons (Oratorio di San Filippo Neri, San Nicolo di Bari)
// and three only on Mapillary (Santissimo Salvatore, San Giovanni Bosco, Sant'Ernesto). Their generic rows are removed from src/lmc-churches-data.js.
// No usable photo was found then for the other six. Sacra Famiglia w81301748, Maria SS. Ausiliatrice w1160934383 and its unnamed second footprint w278478959 were built later (src/lmc-batchS.js).
// Three stay generic: Annunciazione del Signore w71805652, ex chiesa dello Spirito Santo w143736594 (the Commons category Spirito Santo (Palermo) shows a 1938 brick church elsewhere)
// and the unnamed low strip w278476174 beside the Chiesa di Terrasanta.
//
// Oratorio di San Filippo Neri (Piazza Olivella, next to Sant'Ignazio all'Olivella). The unnamed footprint w543069968 is this building: the Commons geosearch puts the oratorio category 8 m from the footprint's centre,
// the front edge faces the piazza like the Sant'Ignazio front beside it, and the photos show Sant'Ignazio's big column on the left of the front. The generic church row for w543069968 is removed from src/lmc-churches-data.js.
// Frame F: origin on the ground in the middle of the 8.1 m footprint edge, +z out of the front (west-north-west, onto the piazza), +x towards the south (to the right seen from the piazza).
// Reference photos (Wikimedia Commons, looked at, nothing copied): Palermo - San Filippo Neri 0417.JPG; Oratorio di San Filippo (Palermo) 01.jpg; S. Ignazio all'Olivella - panoramio.jpg;
// Sant'Ignazio all'Olivella (Palermo) 20 06 2026 01.jpg and 02.jpg. (The 09 07 2022 set of Sant'Ignazio shows the inside of the church, nothing of this front.)
// Read from them: a front in weathered honey and grey-brown limestone in three faces, a flat middle one and a side bay canted back on each side. Lower order: a central door with a framed surround, scroll
// brackets and a segmental pediment, a winged figure group in pale stone lying on it; a pilaster and a half pilaster with carved capitals each side of the door; on each canted bay a framed figure relief
// over a tall sunk panel, and an outer pilaster; a heavy cornice. Upper order: over the middle face an aedicule with two pilasters under fluted blocks, a big half-round lattice window in a moulded arch with a
// keystone bracket, a triangular pediment with a shield and garlands, two urn finials near each end and an iron cross on a carved block; over each canted bay a wall (the "wings") with its own cornice,
// a big scroll and, standing on the lower cornice, a white statue. A low iron railing on a stone kerb runs along the foot, with a taller gate and two lanterns before the door.
// Size: from a camera fit to 0417.JPG and 01.jpg (focal lengths from the files' EXIF; scale from the kerb and gate foot on the ground, a parked Fiat Punto and eye height), checked against the cars in the
// panoramio view, the footprint and the lidar (roof about 12 to 14 m over the footprint). Middle face 6.9 m wide, canted bays 3.35 m at 34 degrees, lower cornice 7.85 m, wing tops 11.45 m, pediment apex 13 m,
// cross top 16 m. Treat these as good to about 10 per cent (apex somewhere between 12 and 14.5 m).
// The 8.1 m edge is not the whole front: the middle face and both canted bays are fitted over it and the short edge south of it, so the south corner stands about 0.7 m past the footprint and the outer part of
// the north bay runs into the flank of Sant'Ignazio, which hides it in the photos too.
// Not verified and left plain: the long side walls and the back (plain honey stone), the roof (hidden in every photo, a flat block behind the front at about the lidar height), the figures in the reliefs,
// statues and winged group (simple pale shapes), the carving of the capitals and the shield, the rough rock under the right-hand side (painted), the palm in the north corner (not drawn).
// The railing is drawn about 0.4 m closer to the door than the photos suggest. It is solid (wall segments, with the south corner).
//
// San Nicolo di Bari all'Albergheria (Piazzetta San Nicolo, Ballaro). Replaces the OSM footprints w1248124755 (the church), w279884510 (Torre di San Nicolo di Bari, baked only 11.3 m tall) and
// w279885675 (the parish house between them).
// Reference photos (Wikimedia Commons, looked at, nothing copied): SNA (Palermo) 16 07 2019.jpg; Turri di San Nicola.jpg; Palermo - Albergheria 0777.jpg.
// Read from them: a square tower of weathered tan ashlar with a flat top; on the north and west faces a round-headed window high up, below it a two-light window with a middle column under a pointed arch
// with a zigzag band, framed by two string courses, iron anchor ties, a small square opening lower down, a drain pipe on the north face. East of it the parish house: cream plaster, a tiled eave,
// brown framed windows under grey hoods, tall balcony doors, grated windows, a door, and the parish banner on a balcony.
// The tower's height (27 m) is estimated from the photos against its 6.4 m side and the house beside it.
// Not verified and left plain: the church body (no photo shows its walls; plain plaster to the baked heights, 18.2 m with the raised crossing at 23.5 m), the tower's south and east faces,
// the house beyond about 12 m from the tower and its other sides. The low stone wall and iron fence in front of the house are not drawn.
//
// Santissimo Salvatore at Brancaccio (not the Cassaro church). Replaces w80924196. Mapillary 295235942263511, 315535330168455 (2021, from the west), 326730008813166, 221185849422878 (2021, from the east).
// Read from them: a front of weathered tan brick facing north onto the street; a lower order to a heavy cornice (about 11 m) with pilasters, a tall arched central door and a lower arched door each side,
// a pale plaque, toothed quoins at the west corner; a narrower upper part with pilasters, a round window (about 16 m) and a triangular pediment (apex about 22.5 m), sloping scrolls at its sides;
// at the east end a square brick bell tower (about 27.5 m) with a second cornice and three arched bell openings per face; on the west flank a cream plaster wing with two arched windows and the taller nave wall above it.
// Heights and positions are measured by projecting the footprint into the frames with the camera data Mapillary gives (the east frames needed their heading turned by 3 to 4 degrees to fit).
// Not verified and left plain: the rear and the south and west faces of the tower, the roofs (flat caps), the iron fence by the west wing (not drawn), the plaque's text.
//
// San Giovanni Bosco (Via Messina Marine corner). Replaces w49790463. Mapillary 493987702014908, 537934063866491, 946575066116941 (2021), 209289724054983 (2018).
// Read from them: the narrow north-east end faces the sea road: whitish panels in a frame of tan pilasters and a string course (about 7.5 m), pairs of tall narrow windows above it (about 9 to 12.5 m),
// a raised door at the west bay reached by a stair over a rubble stone base, an iron gate, a round iron emblem on the first bay of the long west side. Behind that end, on the east side, a slim square
// bell tower (about 28.5 m, placed by crossing sight lines from three frames) with a pair of tall openings on the faces seen, a rail across their foot and a thin cross.
// Not verified and left plain: the long sides beyond the first bay, the south end, the tower's south face, the roof; the stair is simplified.
//
// Sant'Ernesto (Via Campolo). Replaces w279174001 (the body) and w279175519 (the front block, where the facade really stands: the generic model had the front on the wrong side).
// Mapillary 1196144817493850, 485449356133287 (2019). Read from them: a pale plastered front facing north over the parking, 18.7 m wide, its top a very shallow gable (about 15 to 16.4 m) with a cross;
// five tall round-headed windows with fine glazing bars in grey frames (from about 4 to 12 m), and under them five bays: brown wooden doors in the outer two, pale panels, a dark central doorway.
// Not verified and left plain: the sides and the body behind (plain pale plaster at the baked height), the rear footprint w279166296 stays a generic building, the iron fence is not drawn.
import * as THREE from 'three';
import { PI, part, box, bx, cyl, lathe, sphere, statue, extrude, prism, panel, archShape, rotY, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, RNG } from './lmc-kit.js';

const OR = { id: 'w543069968', p: [-71.2, -518.8, -69.4, -510.9, -66.6, -508.6, -59.2, -510.7, -44.5, -514.9, -48.3, -525.3] };
const O = [-70.3, -514.85], N = [-0.975, 0.222];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
// the front: a middle face SFC wide centred at x = SFX on z = 0, a bay SFS wide canted back by SFA on each side; SFH is the top of the painted canvas (the pediment apex)
const SFX = 1.3, SFC = 6.9, SFS = 3.35, SFA = 34 * PI / 180, SFH = 13, SFU = SFC + 2 * SFS;
const LCORN = 7.85, WTOP = 11.45, ROOF = 12.7, CROSS = 16, APEX = SFH, PB = 11.45;   // lower cornice top, wing wall top, roof block behind, cross top, apex, pediment base
const GW = 0.8, GZ = 1.0, RZ = 0.55;   // the gate's half width, how far the gate and the railing stand in front of the footprint
const HONEY = '#ad9971', DRESS = '#bdaa86', SHADE = '#7b6b50', WOOD = '#533a29', IRON = '#34383a', GLASS = '#343a3e', PALE = '#dbd6c6', LOW = '#9f9076';

function paintFront(g, w, h) {   // the front unrolled: north bay, middle face, south bay; 13.6 m wide, 13 m from the ground
  const sx = w / SFU, sy = h / SFH, X = x => (x + SFU / 2) * sx, Y = y => h - y * sy, hc = SFC / 2;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(Math.min(x0, x1)), Y(y1), Math.abs(x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (c, ...p) => { g.fillStyle = c; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.fill(); };
  const sunk = (x0, y0, x1, y1, c) => { R(x0, y0, x1, y1, 'rgba(45,32,18,0.42)'); R(x0 + 0.09, y0, x1, y1 - 0.09, 'rgba(240,218,175,0.4)'); R(x0 + 0.09, y0 + 0.09, x1 - 0.09, y1 - 0.09, c); };
  const dots = (x0, y0, x1, y1, n, seed, cols, r) => { g.save(); g.beginPath(); g.rect(X(Math.min(x0, x1)), Y(y1), Math.abs(x1 - x0) * sx, (y1 - y0) * sy); g.clip(); const rr = RNG(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(X(x0 + (x1 - x0) * rr()), Y(y0 + (y1 - y0) * rr()), (0.4 + rr()) * r * sx, 0, 2 * PI); g.fill(); } g.restore(); };
  paintAshlar(g, w, h, SFU, SFH, 0.52, 1.25, HONEY, '#877454', 5101, 1, 0.07);
  R(-SFU / 2, 0, SFU / 2, 7.4, 'rgba(105,92,78,0.28)');                                                        // the lower order is greyer and darker
  for (let i = 0; i < 12; i++) { const cx = X(-6 + (i % 5) * 3), cy = Y(1.5 + (i % 4) * 3), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 2.4 * sx); gr.addColorStop(0, i % 3 ? 'rgba(60,42,26,0.2)' : 'rgba(225,180,110,0.16)'); gr.addColorStop(1, 'rgba(110,80,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // lower order entablature: architrave lines, frieze, the shadow under the cornice
  R(-SFU / 2, 6.55, SFU / 2, 6.68, '#b6a78a'); R(-SFU / 2, 6.68, SFU / 2, 6.76, SHADE); R(-SFU / 2, 6.95, SFU / 2, LCORN - 0.45, 'rgba(50,36,22,0.2)'); R(-SFU / 2, LCORN - 0.75, SFU / 2, LCORN - 0.45, 'rgba(35,24,14,0.38)'); R(-SFU / 2, LCORN - 0.45, SFU / 2, LCORN, DRESS);
  const capital = (x0, x1, y0, y1) => { R(x0, y0, x1, y1, '#685941'); R(x0 - 0.06, y1 - 0.12, x1 + 0.06, y1, '#c4b598'); dots(x0, y0, x1, y1 - 0.12, Math.round((x1 - x0) * 34), 5120 + Math.round(x0 * 10), ['#c5b799', '#4a3a24', '#a49579'], 0.07); };
  const pil = (x0, x1, c) => { R(x0, 0.9, x1, 5.9, c); R(x0, 0.9, x0 + 0.07, 5.9, 'rgba(250,228,190,0.4)'); R(x1 - 0.08, 0.9, x1, 5.9, 'rgba(40,28,16,0.45)'); capital(x0, x1, 5.9, 6.55); };
  for (const s of [-1, 1]) {
    pil(s * 2.4, s * 3.1, '#aa997b'); pil(s * 3.14, s * hc, '#99886c');                                         // the pilaster and half pilaster beside the door
    sunk(s * 1.1, 5.3, s * 2.2, 6.25, LOW); sunk(s * 1.45, 1.6, s * 2.2, 4.35, LOW);
    R(s * 1.75, 4.62, s * 2.4, 4.72, '#b9aa8c'); R(s * 1.75, 4.54, s * 2.4, 4.62, SHADE);
    const U = u => s * (hc + u);                                                                                // the canted bay: u from the corner outwards
    pil(U(1.9), U(2.75), '#a19175'); R(U(2.8), 0, U(SFS), 6.9, 'rgba(40,30,20,0.18)');
    R(U(0.45), 5.0, U(1.82), 6.42, '#b7a98b'); R(U(0.55), 5.1, U(1.72), 6.32, '#7a6e57');                           // figure relief: a few pale forms in a frame
    for (const [u, y, rx, ry] of [[0.85, 5.55, 0.17, 0.34], [0.95, 6.0, 0.11, 0.12], [1.28, 5.45, 0.2, 0.27], [1.4, 5.84, 0.1, 0.11], [1.1, 5.25, 0.42, 0.1]]) { g.fillStyle = '#d8d2c2'; g.beginPath(); g.ellipse(X(U(u)), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); }
    R(U(0.3), 4.62, U(1.9), 4.72, '#b9aa8c'); R(U(0.3), 4.54, U(1.9), 4.62, SHADE); sunk(U(0.55), 1.55, U(1.75), 4.35, LOW);
    // the wing: wall, a sunk panel, the scroll sweeping down from the upper order to its volute
    R(U(0), LCORN, U(SFS), WTOP, 'rgba(70,50,28,0.1)'); sunk(U(0.8), 9.3, U(2.1), 10.55, '#a5926e'); R(U(0), 10.7, U(SFS), 11.0, 'rgba(40,28,16,0.35)');
    g.lineCap = 'round';
    for (const [c, lw, dx] of [['rgba(45,30,16,0.55)', 0.5, 0.07], ['#bfad88', 0.32, 0]]) { g.strokeStyle = c; g.lineWidth = lw * sx; g.beginPath(); g.moveTo(X(U(0.2 + dx)), Y(10.75)); g.bezierCurveTo(X(U(0.05 + dx)), Y(9.3), X(U(0.5 + dx)), Y(8.5), X(U(1.35 + dx)), Y(8.45)); g.stroke(); }
  }
  // plinth and the rough rock under the south side
  R(-SFU / 2, 0, SFU / 2, 0.9, '#7b6f59'); R(-SFU / 2, 0.82, SFU / 2, 0.95, '#a5967a');
  dots(hc - 0.4, 0, SFU / 2, 1.15, 90, 5131, ['#675941', '#8c7c5b', '#4b3d29'], 0.2);
  // door: stone frame, dark wooden leaves with raised panels, brackets, entablature
  R(-1.15, 0.4, 1.15, 4.35, '#baac8e'); R(-0.98, 0.4, 0.98, 4.18, SHADE); R(-0.84, 0.4, 0.84, 4.0, WOOD); R(-0.035, 0.4, 0.035, 4.0, 'rgba(0,0,0,0.5)');
  for (const x0 of [-0.74, 0.1]) for (const [y0, y1] of [[0.6, 1.25], [1.4, 2.35], [2.5, 3.15], [3.3, 3.85]]) { R(x0, y0, x0 + 0.64, y1, 'rgba(0,0,0,0.28)'); R(x0 + 0.1, y0 + 0.1, x0 + 0.54, y1 - 0.1, '#6d4c34'); }
  for (const s of [-1, 1]) { R(s * 1.18, 3.6, s * 1.45, 4.65, '#c3b59a'); R(s * 1.22, 3.6, s * 1.3, 4.65, SHADE); }
  R(-1.65, 4.42, 1.65, 4.62, 'rgba(40,28,16,0.35)');
  poly('rgba(50,35,20,0.3)', [-1.35, 4.9], [-0.9, 5.28], [0, 5.42], [0.9, 5.28], [1.35, 4.9]);
  // the upper order: the aedicule, its pilasters and fluted blocks, the entablature and the pediment
  for (const s of [-1, 1]) {
    R(s * 2.5, LCORN, s * 3.25, 10.25, '#b9a57f'); R(s * 2.5, LCORN, s * 2.57, 10.25, 'rgba(250,228,190,0.4)'); R(s * 3.17, LCORN, s * 3.25, 10.25, 'rgba(40,28,16,0.45)'); R(s * 2.45, LCORN, s * 3.3, 8.35, '#ad9b77');
    R(s * 2.48, 10.25, s * 3.27, 11.05, '#c3b28f'); for (let k = 0; k < 4; k++) R(s * (2.57 + k * 0.18), 10.38, s * (2.64 + k * 0.18), 10.95, '#6c5d43'); R(s * 2.48, 10.17, s * 3.27, 10.27, '#6c5d43');
  }
  R(-hc, 10.98, hc, 11.2, 'rgba(40,28,16,0.35)'); R(-hc, 11.2, hc, PB, DRESS);
  poly('#7c6c50', [-hc, PB], [0, APEX], [hc, PB]); poly('#aa9772', [-2.75, PB + 0.12], [0, APEX - 0.36], [2.75, PB + 0.12]);
  for (const s of [-1, 1]) { g.strokeStyle = '#d5ceb7'; g.lineWidth = 0.13 * sy; g.setLineDash([0.12 * sx, 0.05 * sx]); g.beginPath(); g.moveTo(X(s * 0.4), Y(12.05)); g.quadraticCurveTo(X(s * 0.9), Y(11.55), X(s * 1.65), Y(11.75)); g.stroke(); g.setLineDash([]); }
  // the half-round lattice window in its moulded arch
  const wy0 = 8.55, ys = 8.65, wr = 1.85, ar = 2.35;
  const arch = (r, y0, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(-r), Y(y0)); g.lineTo(X(-r), Y(ys)); g.ellipse(X(0), Y(ys), r * sx, r * sy, 0, PI, 2 * PI); g.lineTo(X(r), Y(y0)); g.fill(); };
  arch(ar, LCORN, '#c3b290'); arch(ar - 0.14, LCORN, '#8c7b5b'); arch(ar - 0.24, LCORN, '#b9a785'); arch(wr + 0.14, LCORN, '#7a6a4e'); R(-wr - 0.14, LCORN, wr + 0.14, wy0, '#b09e7b'); arch(wr, wy0, GLASS);
  g.strokeStyle = '#8a7a61'; g.lineWidth = 0.065 * sx;
  const top = x => ys + Math.sqrt(Math.max(0, wr * wr - x * x));
  for (let x = -1.54; x <= 1.55; x += 0.44) { g.beginPath(); g.moveTo(X(x), Y(wy0)); g.lineTo(X(x), Y(top(x))); g.stroke(); }
  for (let y = wy0 + 0.46; y < ys + wr; y += 0.46) { const hx = Math.sqrt(Math.max(0, wr * wr - Math.max(0, y - ys) ** 2)); g.beginPath(); g.moveTo(X(-hx), Y(y)); g.lineTo(X(hx), Y(y)); g.stroke(); }
  streaks(g, w, h, 70, 5102, 0.16, 100, '55,40,26');
  for (const y of [LCORN - 0.75, 10.98]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 0.7)); gs.addColorStop(0, 'rgba(30,20,12,0.28)'); gs.addColorStop(1, 'rgba(30,20,12,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 0.7 * sy); }
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3.2)); gb.addColorStop(0, 'rgba(40,30,20,0.36)'); gb.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.2), w, 3.2 * sy);
}
function paintSide(g, w, h) {   // plain honey ashlar, 4 m bay
  paintAshlar(g, w, h, 4, WTOP, 0.5, 1.1, '#a6926c', '#7f6d4f', 5111, 1.2, 0.07);
  streaks(g, w, h, 8, 5112, 0.14, 80, '60,45,30');
}

function buildOratorio() {
  initShared();
  const pts = pairsOf(OR.p), gr = groundRange(pts), W = toWorld, hc = SFC / 2, ca = Math.cos(SFA), sa = Math.sin(SFA);
  const y0 = Math.min(groundY(...W(SFX - 4.5, 0.5)), groundY(...W(SFX + 4.5, 0.5)), groundY(...W(SFX, 1.5)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bpSFFront', 416, 400, [SFU, SFH], paintFront);
  defMat('bpSFSide', 128, 256, [4, WTOP], paintSide);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5;
  // the plan: the three faces of the front, the footprint behind them
  const NJ = [SFX - hc, 0], SJ = [SFX + hc, 0], NO = [NJ[0] - SFS * ca, -SFS * sa], SO = [SJ[0] + SFS * ca, -SFS * sa];
  const set = [W(NO[0] + 0.9, NO[1] - 1.0), W(NJ[0] + 0.2, -0.68), W(SJ[0] - 0.2, -0.68), W(SO[0] - 0.38, SO[1] - 0.57), pts[3], pts[4], pts[5]];
  prism('bpSFSide', set, lo, y0 + WTOP - 0.25, { uvo: [0, -y0 / WTOP] });
  prism('flat', set, y0 + WTOP - 0.25, y0 + WTOP - 0.13, { c: '#88785d' });
  // the roof block, set far enough back not to show over the front from the piazza
  const back = [W(-4.2, -5.2), W(6.3, -5.2), W(6.2, -9.9), W(5.5, -24.6), W(-5.0, -23.4)];
  prism('bpSFSide', back, y0 + WTOP - 0.25, y0 + ROOF, { uvo: [0, -y0 / WTOP] });
  prism('flat', back, y0 + ROOF, y0 + ROOF + 0.12, { c: '#977a64' });
  // the three painted faces, each with its stone behind
  const M0 = at(SFX, 0, 0), MN = mul(at(NJ[0], 0, 0), rotY(-SFA)), MS = mul(at(SJ[0], 0, 0), rotY(SFA));
  const face = (M, x0, x1, u0, ...top) => {   // outline from (x0, 0) to (x1, 0) and the top points right to left; u0 is where local x = 0 falls on the unrolled canvas
    const s = new THREE.Shape(); s.moveTo(x0, lo - y0); s.lineTo(x1, lo - y0); for (const q of top) s.lineTo(q[0], q[1]); s.lineTo(x0, lo - y0);
    part('bpSFFront', new THREE.ShapeGeometry(s), { M, uv: 'keep', uvk: [1 / SFU, 1 / SFH], uvo: [u0 / SFU, 0], noao: true });
    extrude('bpSFSide', s, 0.7, { M, p: [0, 0, -0.72], noao: true });
  };
  face(M0, -hc, hc, SFS + hc, [hc, PB], [0, APEX], [-hc, PB]);
  face(MN, -SFS, 0, SFS, [0, WTOP], [-SFS, WTOP]);
  face(MS, 0, SFS, SFS + SFC, [SFS, WTOP], [0, WTOP]);
  // relief that stands out: cornices, pilasters with capitals (the painted canvas carried forward), plinths
  const skin = (M, x0, x1, y0_, y1_, d, u0) => {
    bx('flat', M, x0 + 0.01, x1 - 0.01, y0_, y1_ - 0.01, 0, d - 0.006, { c: '#8c7b5e', noao: true });
    panel('bpSFFront', x1 - x0, y1_ - y0_, { M, p: [(x0 + x1) / 2, y0_, d], uvk: [(x1 - x0) / SFU, (y1_ - y0_) / SFH], uvo: [(u0 + x0) / SFU, y0_ / SFH] });
  };
  const cap = (M, x0, x1, u0, d) => { skin(M, x0, x1, 0.9, 5.9, d, u0); skin(M, x0 - 0.05, x1 + 0.05, 5.9, 6.55, d + 0.1, u0); };
  for (const s of [-1, 1]) {
    cap(M0, Math.min(s * 2.4, s * 3.1), Math.max(s * 2.4, s * 3.1), SFS + hc, 0.18);
    cap(M0, Math.min(s * 3.14, s * (hc - 0.05)), Math.max(s * 3.14, s * (hc - 0.05)), SFS + hc, 0.09);
    skin(M0, s < 0 ? -3.25 : 2.5, s < 0 ? -2.5 : 3.25, LCORN, 11.05, 0.2, SFS + hc);
    const M = s < 0 ? MN : MS, u0 = s < 0 ? SFS : SFS + SFC, a = (u, v) => [Math.min(s * u, s * v), Math.max(s * u, s * v)];
    cap(M, ...a(1.9, 2.75), u0, 0.15);
    bx('flat', M, ...a(1.8, 2.85), 0, 0.9, -0.05, 0.25, { c: '#8b7c5f' });
    bx('flat', M, ...a(0.45, 1.82), 4.98, 5.08, 0, 0.14, { c: DRESS, noao: true });
    // lower cornice and wing cornice on the canted bay
    bx('flat', M, ...a(0.1, SFS + 0.15), LCORN - 0.42, LCORN - 0.22, -0.1, 0.32, { c: '#897759', noao: true });
    bx('flat', M, ...a(0.12, SFS + 0.25), LCORN - 0.22, LCORN - 0.005, -0.1, 0.55, { c: DRESS, noao: true });
    bx('flat', M, ...a(0, SFS + 0.1), WTOP - 0.45, WTOP - 0.25, -0.3, 0.18, { c: '#7e6d54', noao: true });
    bx('flat', M, ...a(0, SFS + 0.2), WTOP - 0.25, WTOP - 0.005, -0.5, 0.32, { c: '#a18f6f', noao: true });
    // the volute at the foot of the scroll, the statue on its block
    for (const [r, d, c] of [[0.5, 0.16, '#a2906e'], [0.31, 0.23, '#bfae8a'], [0.12, 0.3, '#7a6a4e']]) cyl('flat', r, r, d, 10, { M, p: [s * 1.35, 8.8, 0], rx: PI / 2, c, noao: true });
    const su = s < 0 ? -1.95 : 2.2;   // the statue (the north one a little nearer the middle, clear of the church flank)
    bx('flat', M, su - 0.34, su + 0.34, LCORN, 8.55, 0, 0.55, { c: '#a19172' });
    statue('flat', mul(M, tr(su, 8.55, 0.3)), 1.75, { c: '#e0dccd', noao: true });
  }
  // middle face: lower cornice, door pediment, upper entablature, raking cornice
  bx('flat', F, SFX - hc - 0.12, SFX + hc + 0.12, LCORN - 0.42, LCORN - 0.22, -0.1, 0.34, { c: '#897759', noao: true });
  bx('flat', F, SFX - hc - 0.17, SFX + hc + 0.17, LCORN - 0.22, LCORN, -0.1, 0.6, { c: DRESS, noao: true });
  bx('flat', F, SFX - 1.75, SFX + 1.75, 4.72, 4.92, 0, 0.48, { c: '#baa98b', noao: true });
  const seg = new THREE.Shape(); seg.moveTo(-1.7, 4.9); seg.quadraticCurveTo(0, 6.3, 1.7, 4.9); seg.lineTo(1.35, 4.9); seg.quadraticCurveTo(0, 5.9, -1.35, 4.9); seg.lineTo(-1.7, 4.9);
  extrude('flat', seg, 0.45, { M: M0, c: '#b5a484', noao: true, cs: 6 });
  bx('flat', F, SFX - hc - 0.1, SFX + hc + 0.1, 11.05, 11.25, -0.1, 0.42, { c: '#897759', noao: true });
  bx('flat', F, SFX - hc - 0.18, SFX + hc + 0.18, 11.25, PB + 0.02, -0.1, 0.68, { c: DRESS, noao: true });
  { const dx = hc + 0.18, dy = APEX - PB, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    for (const s of [-1, 1]) box('flat', L + 0.08, 0.24, 1.1, { M: F, p: [SFX + s * dx / 2, PB + dy / 2 - 0.14, -0.1], rz: -s * a, c: '#a49272', noao: true }); }
  // the moulded arch over the window and its keystone bracket
  const ring = new THREE.Shape(); ring.absarc(0, 8.65, 2.35, 0, PI, false); ring.absarc(0, 8.65, 2.05, PI, 0, true);
  extrude('flat', ring, 0.16, { M: M0, c: '#bdac89', noao: true, cs: 8 });
  bx('flat', F, SFX - 0.27, SFX + 0.27, 10.4, 11.1, 0, 0.36, { c: '#bfaf8e', noao: true });
  // the winged figure group on the door pediment: a shield, a seated figure and a smaller one, spread wings
  cyl('flat', 0.36, 0.36, 0.12, 10, { M: F, p: [SFX - 0.32, 6.05, 0.5], rx: PI / 2, s: [1, 1, 1.25], c: PALE });
  const fig = (x, y, r, ky, z = 0.4) => sphere('flat', r, { M: F, p: [SFX + x, y, z], ky, seg: 6, c: PALE });
  fig(0.15, 5.98, 0.28, 1.5); fig(0.2, 6.55, 0.15, 1.1, 0.45); fig(0.55, 5.8, 0.24, 1.1); fig(0.62, 6.1, 0.12, 1.1, 0.5);
  bx('flat', F, SFX - 1.05, SFX + 1.0, 5.5, 5.72, 0.25, 0.55, { c: '#ccc6b5' });
  const wing = new THREE.Shape(); wing.moveTo(0.3, 6.0); wing.quadraticCurveTo(0.7, 6.75, 1.35, 6.5); wing.quadraticCurveTo(0.95, 6.2, 0.7, 5.85); wing.lineTo(0.3, 6.0);
  extrude('flat', wing, 0.14, { M: M0, p: [0, 0, 0.18], c: '#a8a18f', cs: 4 });
  // the shield in the tympanum
  cyl('flat', 0.42, 0.42, 0.2, 8, { M: F, p: [SFX, 12.05, 0], rx: PI / 2, s: [1, 1, 1.35], c: '#d7d2c0', noao: true });
  // urn finials on the pediment, the carved block and the iron cross at the apex
  const urn = [[0, 0], [0.17, 0], [0.12, 0.16], [0.31, 0.45], [0.29, 0.62], [0.1, 0.78], [0.18, 1.08], [0, 1.4]];
  for (const x of [-3.3, -2.6, 2.6, 3.3]) { const yt = PB + (APEX - PB) * (1 - Math.abs(x) / (hc + 0.18)); bx('flat', F, SFX + x - 0.2, SFX + x + 0.2, PB, yt + 0.22, -0.55, -0.1, { c: '#998667', noao: true }); lathe('flat', urn, 6, { M: F, p: [SFX + x, yt + 0.2, -0.32], c: '#b8a888', noao: true }); }
  bx('flat', F, SFX - 0.5, SFX + 0.5, APEX - 0.05, 13.75, -0.6, 0.15, { c: '#ae9e7e', noao: true });
  cyl('flat', 0.3, 0.55, 0.45, 7, { M: F, p: [SFX, 13.75, -0.25], c: '#8c7c5d', noao: true });
  bx('flat', F, SFX - 0.05, SFX + 0.05, 14.15, CROSS, -0.3, -0.2, { c: IRON, noao: true });
  bx('flat', F, SFX - 0.55, SFX + 0.55, CROSS - 0.62, CROSS - 0.52, -0.3, -0.2, { c: IRON, noao: true });
  for (const [x, y] of [[-0.55, CROSS - 0.57], [0.55, CROSS - 0.57], [0, CROSS]]) bx('flat', F, SFX + x - 0.1, SFX + x + 0.1, y - 0.1, y + 0.1, -0.31, -0.19, { c: IRON, noao: true });
  // the railing on its kerb: flat bars, two rails; the taller gate before the door with its two lanterns
  const run = (a, b, ht, step) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), M = mul(at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2), rotY(Math.atan2(-dz, dx))), n = Math.round(L / step);
    for (let i = 0; i <= n; i++) panel('flat', 0.045, ht - 0.2, { M, p: [-L / 2 + i * L / n, 0.2, 0], c: IRON });
    for (const y of [0.34, ht - 0.22]) panel('flat', L, 0.06, { M, p: [0, y, 0.004], c: IRON });
    bx('flat', M, -L / 2, L / 2, lo - y0, 0.22, -0.18, 0.12, { c: '#bdb8ae' });
  };
  run([-3.95, -0.35], [NJ[0], RZ], 1.5, 0.22); run([NJ[0], RZ], [SFX - GW, RZ], 1.5, 0.22);
  run([SFX + GW, RZ], [SJ[0], RZ], 1.5, 0.22); run([SJ[0], RZ], [SO[0] + 0.25, SO[1] + 0.5], 1.5, 0.22);
  run([SFX - GW, GZ], [SFX + GW, GZ], 2.45, 0.2); run([SFX - GW, RZ], [SFX - GW, GZ], 2.45, 0.2); run([SFX + GW, GZ], [SFX + GW, RZ], 2.45, 0.2);
  for (const s of [-1, 1]) bx('flat', F, SFX + s * GW - 0.17, SFX + s * GW + 0.17, 2.43, 2.83, GZ - 0.15, GZ + 0.15, { c: '#4a4940', noao: true });
  const o = end('Oratorio di San Filippo Neri');
  o.userData.solids = [[[W(...NO), W(...NJ), W(...SJ), W(...SO), pts[3], pts[4], pts[5]].flat(), null, y0 + WTOP - 0.25]];
  return o;
}

const NC = { id: 'w1248124755', p: [-102, 441.9, -101.2, 441.9, -100.4, 442.1, -99.8, 442.7, -99.4, 443.4, -99.3, 444.1, -99.5, 444.9, -99.8, 445.5, -99.8, 445.8, -99.1, 445.6, -97.2, 445.8, -95.6, 446.7, -94.9, 447.4, -94.4, 448.1, -93.8, 449.9, -93.9, 451.7, -94.6, 453.4, -95.1, 453.9, -95.9, 454.7, -97.6, 455.4, -96.2, 459.5, -100.1, 461.7, -108.8, 465, -125.9, 471.3, -127.3, 466.9, -130.3, 457.7, -131.7, 453.5, -125.8, 451.2, -115.6, 447.3, -107.1, 444, -102.8, 442.3] };
const NX = [-109.7, 457.9, -103.7, 457.9, -103.7, 453.9, -99.7, 453.9, -99.7, 449.9, -101.7, 449.9, -101.7, 451.9, -109.7, 451.9];   // the raised crossing (baked building part)
const NT = { id: 'w279884510', p: [-127.6, 445.3, -125.8, 451.2, -131.7, 453.5, -133.7, 447.2] };
const NH = { id: 'w279885675', p: [-106.2, 436.5, -102.8, 442.3, -107.1, 444, -115.6, 447.3, -125.8, 451.2, -127.6, 445.3] };
const TH = 27, EAVEH = 12.4, TSTONE = '#b3a084';

function paintTowerStone(g, w, h) { paintAshlar(g, w, h, 4, 4, 0.36, 0.7, TSTONE, '#8d7c63', 5201, 1, 0.1); streaks(g, w, h, 7, 5202, 0.12, 60, '70,55,40'); }
function paintTowerFace(g, w, h) {   // one face, 6.4 m wide, 27 m tall
  const TW = 6.4, sx = w / TW, sy = h / TH, X = x => (x + TW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, ys, ya, r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(ya), X(x), Y(ya)); g.quadraticCurveTo(X(x + r), Y(ya), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, TW, TH, 0.36, 0.7, TSTONE, '#8d7c63', 5203, 1, 0.1);
  for (let i = 0; i < 7; i++) { const cx = X(-2 + (i % 3) * 2), cy = Y(2 + i * 3.6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 2.6 * sx); gr.addColorStop(0, i % 2 ? 'rgba(190,140,70,0.18)' : 'rgba(80,65,50,0.16)'); gr.addColorStop(1, 'rgba(120,90,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // the high round-headed window in its recess
  arch(0, 21.2, 23.2, 24.1, 0.85, '#8a785e'); arch(0.12, 21.4, 23.0, 23.7, 0.55, '#221d18');
  // the two-light window: zigzag band, pointed stone arch, two dark lights and the column between them
  arch(0, 15.1, 17.1, 19.0, 1.65, '#5f5140'); arch(0, 15.1, 17.1, 18.75, 1.45, '#c4b090'); arch(0, 15.1, 17.05, 18.45, 1.2, '#9c8a70');
  g.strokeStyle = '#d3c2a2'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = PI - i * PI / 16, r = i % 2 ? 1.64 : 1.47; g.lineTo(X(Math.cos(a) * r), Y(17.15 + Math.sin(a) * r * 1.05)); } g.stroke();
  for (const x of [-0.48, 0.48]) arch(x, 15.2, 16.7, 17.4, 0.36, '#1d1915');
  R(-0.08, 15.2, 0.08, 16.8, '#d9cbae'); R(-0.15, 16.7, 0.15, 16.95, '#d9cbae');
  for (const x of [-1.5, 1.5]) for (let y = 15.2; y < 17.0; y += 0.4) { g.fillStyle = '#51453a'; g.beginPath(); g.moveTo(X(x - 0.14), Y(y + 0.18)); g.lineTo(X(x), Y(y + 0.36)); g.lineTo(X(x + 0.14), Y(y + 0.18)); g.lineTo(X(x), Y(y)); g.fill(); }
  R(-TW / 2, 14.75, TW / 2, 15.05, '#7a6a54'); R(-TW / 2, 14.95, TW / 2, 15.05, '#cdbb9a'); R(1.7, 17.0, TW / 2, 17.25, '#7a6a54'); R(-TW / 2, 17.0, -1.7, 17.25, '#7a6a54');
  // iron anchor ties and the small square opening
  g.strokeStyle = '#2b241f'; g.lineWidth = 0.09 * sx;
  for (const [x, y] of [[-2.2, 19.8], [2.1, 13.1], [-2.1, 12.4]]) { g.beginPath(); g.moveTo(X(x - 0.25), Y(y + 0.55)); g.lineTo(X(x), Y(y)); g.lineTo(X(x + 0.25), Y(y + 0.55)); g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y - 0.65)); g.stroke(); }
  R(-0.45, 9.4, 0.25, 10.5, '#cbb999'); R(-0.35, 9.5, 0.15, 10.4, '#241f1a');
  R(-TW / 2, TH - 0.3, TW / 2, TH, '#a8967a');
  streaks(g, w, h, 18, 5204, 0.14, 90, '70,55,40');
}
function paintParish(g, w, h) {   // the parish house front, 23.1 m wide, 12.4 m tall; local x +11.55 is the corner against the tower
  const HWm = 23.1, sx = w / HWm, sy = h / EAVEH, X = x => (x + HWm / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#dccd9f'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, 5211, ['rgba(150,120,70,0.10)', 'rgba(255,245,215,0.10)']);
  const win = (d, y0, wd, ht, grate) => { const x = HWm / 2 - d; R(x - wd / 2 - 0.12, y0 - 0.1, x + wd / 2 + 0.12, y0 + ht + 0.12, '#6a3326'); R(x - wd / 2, y0, x + wd / 2, y0 + ht, '#2b2a2a'); R(x - 0.04, y0, x + 0.04, y0 + ht, '#6a3326');
    if (grate) for (let i = 1; i < 4; i++) { R(x - wd / 2 + i * wd / 4 - 0.025, y0, x - wd / 2 + i * wd / 4 + 0.025, y0 + ht, '#77726a'); R(x - wd / 2, y0 + i * ht / 4 - 0.025, x + wd / 2, y0 + i * ht / 4 + 0.025, '#77726a'); }
    R(x - wd / 2 - 0.35, y0 + ht + 0.35, x + wd / 2 + 0.35, y0 + ht + 0.55, '#8f8a80'); };
  const balcony = (d, y) => { const x = HWm / 2 - d; R(x - 1.1, y - 0.2, x + 1.1, y, '#5a564e'); R(x - 1.1, y + 0.95, x + 1.1, y + 1.02, '#25272a'); for (let k = -1.08; k < 1.1; k += 0.22) R(x + k, y, x + k + 0.05, y + 1.0, '#25272a'); };
  win(0.75, 9.1, 0.7, 1.0);                                                       // the small window by the tower
  win(2.9, 7.6, 1.2, 2.2); balcony(2.9, 7.4); { const x = HWm / 2 - 2.5; R(x - 1.25, 7.5, x + 1.25, 8.5, '#efebdd'); g.fillStyle = '#22262b'; g.font = `bold ${Math.max(6, 0.34 * sy)}px sans-serif`; g.textAlign = 'center'; g.fillText('PARROCCHIA S. NICOL\u00d2 DI BARI', X(x), Y(8.1), 2.4 * sx); g.fillText("ALL'ALBERGHERIA", X(x), Y(7.65), 2.4 * sx); }
  win(2.7, 4.2, 1.0, 1.6, true); win(2.7, 1.5, 1.0, 0.9, true);
  win(5.2, 0.2, 1.0, 2.4);                                                        // the door
  win(7.8, 8.1, 1.2, 2.2); balcony(7.8, 7.9); win(7.8, 4.7, 0.95, 1.4); win(7.8, 1.1, 1.5, 2.2, true);
  win(11.4, 7.8, 1.2, 2.2); balcony(11.4, 7.6); win(11.4, 4.6, 0.95, 1.4); win(11.4, 1.4, 1.0, 1.4, true);
  R(-HWm / 2, EAVEH - 0.25, HWm / 2, EAVEH, '#9c5a3c');
  streaks(g, w, h, 22, 5212, 0.12, 60, '100,75,45');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.4)); gb.addColorStop(0, 'rgba(60,45,30,0.3)'); gb.addColorStop(1, 'rgba(60,45,30,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.4), w, 2.4 * sy);
}

function buildSanNicolo() {
  initShared();
  const church = pairsOf(NC.p), tower = pairsOf(NT.p), house = pairsOf(NH.p);
  const gr = groundRange([...church, ...tower, ...house]), lo = gr.lo - 1.5;
  const y0 = Math.min(groundY(-130.6, 445.6), groundY(-133.2, 450.4), groundY(-116.9, 440.2));
  defMat('bpSNStone', 128, 128, [4, 4], paintTowerStone);
  defMat('bpSNTower', 192, 768, [6.4, TH], paintTowerFace);
  defMat('bpSNHouse', 512, 288, [23.1, EAVEH], paintParish);
  begin(y0);
  // the church body, plain
  prism('plaster', church, lo, y0 + 18.2, { c: '#d3bd92' });
  prism('flat', church, y0 + 18.2, y0 + 18.35, { c: '#a8856a' });
  prism('plaster', pairsOf(NX), y0 + 18.0, y0 + 23.5, { c: '#d3bd92' });
  prism('flat', pairsOf(NX), y0 + 23.5, y0 + 23.65, { c: '#a8856a' });
  // the tower: plain stone on the footprint, the two photographed faces as panels just off the north and west walls
  prism('bpSNStone', tower, lo, y0 + TH);
  prism('flat', tower, y0 + TH, y0 + TH + 0.08, { c: '#9a8a72' });
  const face = (ax, az, bx_, bz, nx, nz) => { const L = Math.hypot(bx_ - ax, bz - az), F = frame((ax + bx_) / 2 + nx * 0.05, y0, (az + bz) / 2 + nz * 0.05, nx, nz); panel('bpSNTower', L, TH, { M: F, noao: true }); bx('flat', F, -L / 2 - 0.08, L / 2 + 0.08, 14.8, 15.02, -0.05, 0.1, { c: '#a8967a', noao: true }); return F; };
  const FN = face(-127.6, 445.3, -133.7, 447.2, -0.297, -0.955);
  face(-133.7, 447.2, -131.7, 453.5, -0.953, 0.303);
  bx('flat', FN, 1.2, 1.32, 12.4, 25.5, 0.02, 0.14, { c: '#2f2a26', noao: true });   // drain pipe
  // the parish house: cream plaster, the photographed front on its north wall, a tiled cap and an eave
  prism('plaster', house, lo, y0 + EAVEH, { c: '#dccd9f' });
  prism('flat', house, y0 + EAVEH, y0 + EAVEH + 0.2, { c: '#a8785c' });
  { const ax = -106.2, az = 436.5, cx = -127.6, cz = 445.3, nx = -0.38, nz = -0.925, L = Math.hypot(cx - ax, cz - az), F = frame((ax + cx) / 2 + nx * 0.05, y0, (az + cz) / 2 + nz * 0.05, nx, nz);
    panel('bpSNHouse', L, EAVEH, { M: F, noao: true });
    bx('flat', F, -L / 2, L / 2, EAVEH, EAVEH + 0.16, -0.1, 0.45, { c: '#9c6a4e', noao: true });
    const x = L / 2 - 2.9; bx('flat', F, x - 1.1, x + 1.1, 7.25, 7.4, 0, 0.6, { c: '#4a463f', noao: true }); }
  const o = end("Chiesa di San Nicol\u00f2 di Bari all'Albergheria");
  o.userData.solids = [[NC.p, null, y0 + 18.2], [NT.p, null, y0 + TH], [NH.p, null, y0 + EAVEH]];
  return o;
}

// Frame helper: origin on the ground in the middle of the front edge a-b (a on the viewer's left), +z out of the front, +x to the viewer's right.
function frontFrame(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const y = Math.min(groundY(...a), groundY(...m), groundY(...b), groundY(m[0] + nx * 1.5, m[1] + nz * 1.5));
  const W = (x, z) => [m[0] + x * ux + z * nx, m[1] + x * uz + z * nz];
  return { F: frame(m[0], y, m[1], nx, nz), L, y, W };
}
const facePaint = (g, w, h, Wm, Hm) => { const sx = w / Wm, sy = h / Hm, X = x => x * sx, Y = y => h - y * sy;   // x in metres from the left edge, y up from the ground
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 2 * PI); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  return { sx, sy, X, Y, R, arch };
};

// ---------- Santissimo Salvatore, Brancaccio ----------
const SS = { id: 'w80924196', p: [2327.2, 1814.9, 2350.4, 1820.1, 2343.2, 1846.8, 2336.3, 1845.5, 2333.1, 1852.6, 2310.3, 1845.5, 2312.2, 1837.5, 2314.3, 1825.6, 2319.6, 1829.6, 2320.5, 1826.9, 2324.2, 1828.2] };
const SSW = 23.8, SSH = 22.7, SSTW = 6.4, SSTH = 27.5, BRICK = '#ab8a60';
function paintSalvBrick(g, w, h) { paintAshlar(g, w, h, 4, 4, 0.3, 0.6, BRICK, '#87704f', 5301, 0.8, 0.09); streaks(g, w, h, 6, 5302, 0.13, 60, '70,55,40'); }
function paintSalvFront(g, w, h) {   // canvas left edge is the east end of the front (the viewer's left); a() takes metres from the west corner, as measured
  const { sx, sy, X, Y, R, arch } = facePaint(g, w, h, SSW, SSH), a = s => SSW - s;
  const A = (s0, y0, s1, y1, c) => R(a(s1), y0, a(s0), y1, c);
  paintAshlar(g, w, h, SSW, SSH, 0.36, 0.7, BRICK, '#87704f', 5303, 0.8, 0.09);
  for (let i = 0; i < 9; i++) { const cx = X(1.5 + i * 2.7), cy = Y(2 + (i % 4) * 4.6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 3 * sx); gr.addColorStop(0, i % 2 ? 'rgba(200,160,100,0.17)' : 'rgba(75,60,45,0.18)'); gr.addColorStop(1, 'rgba(120,90,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  A(0, 0, SSW, 0.8, '#8a7459');
  for (const s of [1.2, 6.5, 8.9, 13.1, 15.5, 20.6, 23.2]) { A(s - 0.42, 0.8, s + 0.42, 9.9, '#bb9b6e'); A(s + 0.3, 0.8, s + 0.42, 9.9, 'rgba(60,40,25,0.35)'); A(s - 0.55, 9.9, s + 0.55, 10.6, '#c6a97c'); }
  for (const [s, ww, top] of [[4.1, 1.8, 5.0], [11, 2.4, 6.5], [17.9, 1.8, 5.0]]) {
    arch(a(s), 0.4, top + 0.45, ww + 0.8, '#c2a377'); arch(a(s), 0.4, top, ww, '#262a27'); R(a(s) - 0.04, 0.4, a(s) + 0.04, top - 0.2, 'rgba(190,180,150,0.35)');
    A(s - ww / 2 - 0.6, top + 1.0, s + ww / 2 + 0.6, top + 1.25, '#c6a97c');
  }
  A(7.0, 3.5, 8.2, 5.8, '#d8d1c0');
  for (let y = 0.8, i = 0; y < 10.6; y += 0.55, i++) A(0, y, i % 2 ? 0.55 : 1.0, y + 0.45, '#c0a176');   // the toothed quoins
  A(0, 10.6, SSW, 11.4, '#c2a377'); A(0, 10.6, SSW, 10.8, 'rgba(60,40,25,0.4)'); A(0, 11.25, SSW, 11.4, '#d3b98c');
  // the upper part: pilasters, the round window, the entablature and the pediment, the scrolls
  for (const s of [6.1, 8.2, 13.8, 15.9]) { A(s - 0.38, 11.4, s + 0.38, 18.8, '#bb9b6e'); A(s - 0.5, 18.8, s + 0.5, 19.4, '#c6a97c'); }
  g.fillStyle = '#cbaf82'; g.beginPath(); g.arc(X(a(11)), Y(16.1), 1.25 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#2a2c2a'; g.beginPath(); g.arc(X(a(11)), Y(16.1), 0.8 * sx, 0, 2 * PI); g.fill();
  A(5.5, 19.4, 16.5, 20.1, '#c2a377'); A(5.5, 19.4, 16.5, 19.55, 'rgba(60,40,25,0.4)');
  g.strokeStyle = '#cbaf82'; g.lineWidth = 0.4 * sy; g.beginPath(); g.moveTo(X(a(5.5)), Y(20.1)); g.lineTo(X(a(11)), Y(22.55)); g.lineTo(X(a(16.5)), Y(20.1)); g.stroke();
  g.lineWidth = 0.4 * sx; g.beginPath(); g.moveTo(X(a(2.0)), Y(11.5)); g.quadraticCurveTo(X(a(5.2)), Y(12.2), X(a(5.5)), Y(15.4)); g.stroke();
  streaks(g, w, h, 60, 5304, 0.15, 90, '65,50,35');
  const gb = g.createLinearGradient(0, Y(0.8), 0, Y(3.4)); gb.addColorStop(0, 'rgba(45,32,20,0.3)'); gb.addColorStop(1, 'rgba(45,32,20,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.4), w, 2.6 * sy);
}
function buildSalvatore() {
  initShared();
  const pts = pairsOf(SS.p), gr = groundRange(pts), { F, y: y0 } = frontFrame([SS.p[2], SS.p[3]], [SS.p[0], SS.p[1]]), at = (x, y, z) => mul(F, tr(x, y, z));
  const HW2 = SSW / 2, X = s => HW2 - s;   // local x of a distance s from the west corner
  defMat('bpSSBrick', 128, 128, [4, 4], paintSalvBrick);
  defMat('bpSSFront', 384, 368, [SSW, SSH], paintSalvFront);
  begin(y0);
  // the plan: the low wings at 12.6 m (cream, as on the west flank), set just behind the front slab
  const back = pts.map((q, i) => i === 0 ? [q[0] - 0.22, q[1] + 0.97] : i === 1 ? [q[0] - 0.22, q[1] + 0.97] : q);
  prism('plaster', back, Math.min(gr.lo, y0) - 1.5, y0 + 12.6, { c: '#d9bd98' });
  prism('flat', back, y0 + 12.6, y0 + 12.72, { c: '#8f8274' });
  // the taller nave
  bx('bpSSBrick', F, X(16.5), X(3.0), 12.6, 19.0, -27, -1.0, { uvo: [0, -(y0 % 4) / 4] });
  bx('flat', F, X(16.5) - 0.15, X(3.0) + 0.15, 19.0, 19.2, -27.1, -1.0, { c: '#8f7a62', noao: true });
  // the front slab with the painted face
  const s = new THREE.Shape(), prof = [[0, 0], [0, 11.4], [2.0, 11.4], [3.6, 12.5], [5.5, 15.4], [5.5, 20.1], [11, SSH], [16.5, 20.1], [16.5, 14.0], [17.4, 11.4], [SSW, 11.4], [SSW, 0]];
  prof.forEach((q, i) => i ? s.lineTo(X(q[0]), q[1]) : s.moveTo(X(q[0]), q[1]));
  extrude('bpSSFront', s, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / SSW, 1 / SSH], uvo: [0.5, 0], noao: true });
  bx('flat', F, -HW2 - 0.1, HW2 + 0.1, 10.95, 11.4, -0.1, 0.35, { c: '#bd9f74', noao: true });
  bx('flat', F, X(16.7), X(5.3), 19.6, 20.1, -1.05, 0.3, { c: '#bd9f74', noao: true });
  bx('flat', F, X(11) - 0.04, X(11) + 0.04, SSH, SSH + 1.3, -0.55, -0.47, { c: '#25272a', noao: true });
  // the bell tower at the east end
  const tx0 = -HW2, tx1 = X(17.4), tz = -0.08 - SSTW;
  bx('bpSSBrick', F, tx0, tx1, 0, SSTH, tz, -0.08);
  for (const y of [10.95, 21.2, SSTH - 0.45]) bx('flat', F, tx0 - 0.3, tx1 + 0.3, y, y + 0.45, tz - 0.3, y < 12 ? -0.1 : 0.25, { c: '#bd9f74', noao: true });
  const mx = (tx0 + tx1) / 2, mz = (tz - 0.08) / 2;
  for (const [dx, dz, ry] of [[0, 1, 0], [-1, 0, -PI / 2]]) for (const k of [-1, 0, 1]) {   // north and east faces, the ones photographed
    const M = mul(F, mul(tr(mx + dx * (SSTW / 2 + 0.01), 22.3, mz + dz * (SSTW / 2 + 0.01)), rotY(ry)));
    extrude('flat', archShape(1.7, 3.5), 0.03, { M, p: [k * 1.95, 0, -0.01], c: '#c6a97c', noao: true });
    extrude('flat', archShape(1.3, 3.2), 0.05, { M, p: [k * 1.95, 0, 0], c: '#2a231c', noao: true });
    bx('flat', M, k * 1.95 - 0.3, k * 1.95 + 0.3, 1.2, 1.9, 0.02, 0.08, { c: '#5a4c34', noao: true });
  }
  // the west flank: two arched windows in the cream wing, two small ones in the nave above
  for (const z of [-3.4, -9.1]) extrude('flat', archShape(1.3, 1.8), 0.05, { M: mul(F, mul(tr(HW2, 8.6, z), rotY(PI / 2))), c: '#3a3a38', noao: true });
  for (const z of [-3.2, -7.6]) extrude('flat', archShape(1.2, 1.6), 0.05, { M: mul(F, mul(tr(X(3.0), 13.5, z), rotY(PI / 2))), c: '#3a3f46', noao: true });
  const o = end('Chiesa del Santissimo Salvatore a Brancaccio');
  o.userData.solids = [[SS.p, null, y0 + 12.6]];
  return o;
}

// ---------- San Giovanni Bosco ----------
const GB = { id: 'w49790463', p: [2343, 1161.1, 2361, 1129, 2370.2, 1134.1, 2352.2, 1166.2] };
const GBH = 17, GBW = 10.52, GBS = 4, TAN = '#d3bb90', WHITEWALL = '#ded8ca';
function paintBosco(g, w, h) {   // left 10.52 m: the north-east end (x from the viewer's left, the east corner); the next 4 m: the first bay of the long west side
  const { sx, Y, R } = facePaint(g, w, h, GBW + GBS, GBH);
  g.fillStyle = WHITEWALL; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, 5401, ['rgba(130,115,90,0.09)', 'rgba(255,252,240,0.10)']);
  const pair = (x, y0, y1) => { for (const d of [-0.45, 0.45]) { R(x + d - 0.36, y0 - 0.1, x + d + 0.36, y1 + 0.1, '#cfc4ac'); R(x + d - 0.27, y0, x + d + 0.27, y1, '#34393c'); for (let y = y0 + 0.8; y < y1; y += 0.8) R(x + d - 0.27, y, x + d + 0.27, y + 0.05, '#8a8c88'); } };
  for (const x of [0.25, 2.4, 5.9, 9.55, 10.3, GBW + 0.25, GBW + 2.7]) R(x - 0.22, 0, x + 0.22, GBH, TAN);
  R(0, 7.25, GBW, 7.75, TAN); R(GBW, 7.25, GBW + 2.7, 7.75, TAN); R(0, GBH - 0.7, GBW, GBH, TAN);
  pair(4.2, 9.2, 12.6); pair(7.75, 9.2, 12.6); pair(GBW + 1.35, 9.4, 12.0);
  R(7.7, 3.4, 9.5, 7.0, TAN); R(8.1, 3.4, 9.15, 6.6, '#5a4130'); R(8.6, 3.4, 8.65, 6.6, '#2e2118');
  const ex = (GBW + 0.9) * sx, ey = Y(5.3), r = 0.45 * sx; g.strokeStyle = '#3a3634'; g.lineWidth = 0.1 * sx; g.beginPath(); g.arc(ex, ey, r, 0, 2 * PI); g.moveTo(ex - r * 1.3, ey); g.lineTo(ex + r * 1.3, ey); g.moveTo(ex - r * 0.6, ey - r * 1.1); g.lineTo(ex + r * 0.6, ey + r * 1.1); g.stroke();
  streaks(g, w, h, 26, 5402, 0.1, 70, '110,90,65');
}
function buildBosco() {
  initShared();
  const pts = pairsOf(GB.p), gr = groundRange(pts), P = i => pts[i];
  const { F, y: y0, W } = frontFrame(P(2), P(1)), at = (x, y, z) => mul(F, tr(x, y, z)), hw = GBW / 2;
  defMat('bpGBFace', 256, 320, [GBW + GBS, GBH], paintBosco);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, len = 36.8;
  // the front block (4 m deep) at 17 m, the long body behind it at the baked height
  bx('plaster', F, -hw, hw, lo - y0, GBH, -4, -0.03, { c: WHITEWALL });
  bx('flat', F, -hw - 0.1, hw + 0.1, GBH, GBH + 0.2, -4.05, 0.05, { c: '#a89a82', noao: true });
  bx('plaster', F, -hw + 0.02, hw - 0.02, lo - y0, 14.2, -len, -4, { c: WHITEWALL });
  bx('flat', F, -hw, hw, 14.2, 14.35, -len, -4, { c: '#ab9a88', noao: true });
  const U = GBW + GBS;
  panel('bpGBFace', GBW, GBH, { M: at(0, 0, 0), uvk: [GBW / U, 1] });
  panel('bpGBFace', GBS, GBH, { M: mul(F, mul(tr(hw + 0.03, 0, -GBS / 2), rotY(PI / 2))), uvk: [GBS / U, 1], uvo: [GBW / U, 0] });
  // the raised entrance: a rubble stone base before the door, the stair climbing to it from the east corner, the gate
  bx('stone', F, -1.6, hw, lo - y0, 3.4, 0, 2.2, { c: '#e6ded2' });
  for (let i = 0; i < 6; i++) bx('stone', F, -hw + i * (hw - 1.6) / 6, -hw + (i + 1) * (hw - 1.6) / 6, lo - y0, 3.4 * (i + 1) / 7, 0, 2.2, { c: '#e6ded2' });
  bx('flat', F, -1.6, 2.6, 4.35, 4.45, 2.1, 2.18, { c: '#2a2c2e', noao: true });
  for (let x = -1.5; x < 2.6; x += 0.8) bx('flat', F, x, x + 0.07, 3.4, 4.4, 2.1, 2.18, { c: '#2a2c2e', noao: true });
  for (let x = 2.7; x < 5.2; x += 0.3) bx('flat', F, x, x + 0.06, 0, 3.4, 2.28, 2.34, { c: '#34373a', noao: true });
  for (const y of [0.3, 3.0]) bx('flat', F, 2.65, 5.2, y, y + 0.08, 2.28, 2.34, { c: '#34373a', noao: true });
  // the bell tower, on the east side just behind the front
  const TW = 4.6, TT = 28.5, tx = -hw + TW / 2, tz = -3.0;
  bx('plaster', F, tx - TW / 2, tx + TW / 2, 12, TT, tz - TW / 2, tz + TW / 2, { c: '#d0bd9a' });
  bx('flat', F, tx - TW / 2 - 0.12, tx + TW / 2 + 0.12, TT, TT + 0.22, tz - TW / 2 - 0.12, tz + TW / 2 + 0.12, { c: '#bca888', noao: true });
  for (const ry of [0, PI / 2, -PI / 2]) {   // the road face, the west and the east face
    const M = mul(F, mul(tr(tx, 20.6, tz), mul(rotY(ry), tr(0, 0, TW / 2 + 0.01))));
    bx('flat', M, -1.45, 1.45, 0, 6.5, -0.01, 0.01, { c: '#b9a480', noao: true });
    for (const x of [-0.6, 0.6]) extrude('flat', archShape(0.85, 5.2), 0.04, { M, p: [x, 0.5, 0], c: '#3b332a', noao: true });
    bx('flat', M, -1.1, 1.1, 1.7, 1.78, 0.05, 0.09, { c: '#26282a', noao: true });
    for (let x = -1.05; x < 1.1; x += 0.35) bx('flat', M, x, x + 0.05, 0.5, 1.7, 0.05, 0.08, { c: '#26282a', noao: true });
  }
  bx('flat', F, tx - 0.04, tx + 0.04, TT + 0.2, TT + 1.9, tz - 0.04, tz + 0.04, { c: '#25272a', noao: true });
  bx('flat', F, tx - 0.4, tx + 0.4, TT + 1.35, TT + 1.43, tz - 0.04, tz + 0.04, { c: '#25272a', noao: true });
  const o = end('Chiesa di San Giovanni Bosco');
  const base = [W(-hw, 0), W(hw, 0), W(hw, 2.2), W(-hw, 2.2)].flat();
  o.userData.solids = [[GB.p, null, y0 + 14.2], [base, null, y0 + 3.4]];
  return o;
}

// ---------- Sant'Ernesto ----------
const SE = { id: 'w279174001', p: [-2347.1, -1382.8, -2342.6, -1363.4, -2350, -1363.8, -2357.1, -1360.2, -2360.2, -1379.5] };
const SEF = { id: 'w279175519', p: [-2346.4, -1388.5, -2344.7, -1384.1, -2347.1, -1382.8, -2360.2, -1379.5, -2364.3, -1379.2, -2364.6, -1384.4] };
const SEW = 18.66, SEE = 15.2, SEA = 16.4, PALEWALL = '#d9d5ca';
function paintErnesto(g, w, h) {   // 18.66 m wide, 16.4 m to the apex
  const { sx, sy, X, Y, R, arch } = facePaint(g, w, h, SEW, SEA);
  g.fillStyle = PALEWALL; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, 5501, ['rgba(115,108,95,0.08)', 'rgba(255,253,245,0.09)']);
  const FRAME = '#aaa89f';
  for (let k = -2; k <= 2; k++) {
    const x = SEW / 2 + k * 2.5;
    arch(x, 0.3, 12.45, 2.6, FRAME); arch(x, 4.1, 12.1, 2.1, '#4b4742');
    for (let d = -0.7; d < 0.75; d += 0.35) R(x + d - 0.025, 4.1, x + d + 0.025, 11.9 - Math.abs(d), '#a9a59a');
    for (let y = 4.9; y < 11.5; y += 0.8) R(x - 1.05, y, x + 1.05, y + 0.05, '#a9a59a');
    R(x - 1.3, 3.65, x + 1.3, 4.1, FRAME);
    const c = Math.abs(k) === 2 ? '#6d4a34' : k === 0 ? '#34302b' : '#cfcbc0';
    R(x - 1.05, 0.3, x + 1.05, 3.65, c); if (k) R(x - 0.025, 0.3, x + 0.025, 3.65, 'rgba(40,28,18,0.35)');
  }
  R(0, 0, SEW, 0.3, '#9d998f');
  g.strokeStyle = '#b9b5aa'; g.lineWidth = 0.18 * sy; g.beginPath(); g.moveTo(0, Y(SEE - 0.05)); g.lineTo(X(SEW / 2), Y(SEA - 0.05)); g.lineTo(w, Y(SEE - 0.05)); g.stroke();
  streaks(g, w, h, 24, 5502, 0.08, 80, '100,92,80');
}
function buildErnesto() {
  initShared();
  const front = pairsOf(SEF.p), body = pairsOf(SE.p), gr = groundRange([...front, ...body]);
  const { F, y: y0 } = frontFrame(front[0], front[5]), at = (x, y, z) => mul(F, tr(x, y, z)), hw = SEW / 2;
  defMat('bpSEFront', 288, 256, [SEW, SEA], paintErnesto);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5;
  const set = front.map((q, i) => i === 0 || i === 5 ? [q[0] + 0.22 * 0.6, q[1] + 0.975 * 0.6] : q);   // the block's front wall stands just behind the slab's face
  prism('plaster', set, lo, y0 + SEE, { c: PALEWALL });
  prism('flat', set, y0 + SEE, y0 + SEE + 0.1, { c: '#a5a096' });
  prism('plaster', body, lo, y0 + 13.7, { c: '#d3cec2' });
  prism('flat', body, y0 + 13.7, y0 + 13.82, { c: '#a3b0b2' });
  const s = new THREE.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, SEE); s.lineTo(0, SEA); s.lineTo(-hw, SEE); s.lineTo(-hw, 0);
  extrude('bpSEFront', s, 0.75, { M: at(0, 0, -0.75), uv: 'keep', uvk: [1 / SEW, 1 / SEA], uvo: [0.5, 0], noao: true });
  bx('flat', F, -0.06, 0.06, SEA, SEA + 1.4, -0.4, -0.3, { c: '#3a3a3a', noao: true });
  bx('flat', F, -0.45, 0.45, SEA + 0.85, SEA + 0.97, -0.4, -0.3, { c: '#3a3a3a', noao: true });
  const o = end("Chiesa di Sant'Ernesto");
  o.userData.solids = [[SE.p, null, y0 + 13.7], [SEF.p, null, y0 + SEE]];
  return o;
}

// What stands in front of a footprint (the Oratorio's railing, gate and south corner, the stair of San Giovanni Bosco) gets wall segments along its outline, or the lapa drives into it.
const outline = (P) => P.slice(1).map((b, i) => [...P[i], ...b]);
const orWalls = outline([...[[-3.95, 0], [SFX - SFC / 2, RZ], [SFX - GW, RZ], [SFX - GW, GZ], [SFX + GW, GZ], [SFX + GW, RZ], [SFX + SFC / 2, RZ],
  [SFX + SFC / 2 + SFS * Math.cos(SFA) + 0.25, -SFS * Math.sin(SFA) + 0.5]].map(([x, z]) => toWorld(x, z)), [OR.p[4], OR.p[5]]]);
const gbWalls = (() => {   // the frame of frontFrame(point 2, point 1), without the ground: +x along the front, +z out of it
  const [bx_, bz, ax, az] = GB.p.slice(2, 6), L = Math.hypot(bx_ - ax, bz - az), ux = (bx_ - ax) / L, uz = (bz - az) / L, hw = GBW / 2;
  return outline([[-hw, 0], [-hw, 2.34], [hw, 2.34], [hw, 0]].map(([x, z]) => [(ax + bx_) / 2 + x * ux - z * uz, (az + bz) / 2 + x * uz + z * ux]));
})();

export const BATCH_Q = [
  { name: 'Chiesa del Santissimo Salvatore a Brancaccio', x: 2332, z: 1833, radius: 45, skipIds: [SS.id], build: buildSalvatore },
  { name: 'Chiesa di San Giovanni Bosco', x: 2357, z: 1148, radius: 40, skipIds: [GB.id], build: buildBosco, walls: gbWalls },
  { name: "Chiesa di Sant'Ernesto", x: -2353, z: -1376, radius: 35, skipIds: [SE.id, SEF.id], build: buildErnesto },
  { name: 'Oratorio di San Filippo Neri', x: -57, z: -516, radius: 30, skipIds: [OR.id], build: buildOratorio, walls: orWalls },
  { name: "Chiesa di San Nicol\u00f2 di Bari all'Albergheria", x: -113, z: 453, radius: 40, skipIds: [NC.id, NT.id, NH.id], build: buildSanNicolo },
];
