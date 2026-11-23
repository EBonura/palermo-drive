// City landmarks, batch M: four churches of Palermo drawn from reference photos. Registered in src/landmarks-city.js as BATCH_M.
// Frame of a front: origin on the ground at the middle of the chosen footprint edge, +z out of the front, +x to the right seen from the street.
// Reference photos (Wikimedia Commons, looked at, nothing copied; proportions and colours read, then drawn procedurally; ratios taken from the width of each front and from the door heights):
//   San Gregorio Papa (w279883149): "San Gregorio Papa facciata.jpg" (frontal), "Chiesa di San Gregorio (Palermo) - esterno.JPG", "San Gregorio (Palermo) 15 07 2019 01.jpg"
//     read: two orders in brown tufa and cream plaster. Lower order: a wide stone pilaster at each corner, a central door with two free columns carrying a broken curved pediment with a cartouche, plaster panels in stone frames each side.
//     Upper order: two plaster panels with iron ties, one arched window, a low triangular pediment. Lower cornice at about 0.69 of the total height, upper cornice at 0.93.
//   Madonna della Mazza / Madonna del Soccorso (w279882163): "Madonna della Mazza.jpg", "SMM (Palermo) 16 07 2019 01.jpg", "SMM (Palermo) 16 07 2019 02.jpg", "SMM (Palermo) 16 07 2019 03.jpg" (the file prefix SMM is how Commons names the Soccorso photos)
//     read: a flat three-door front in grey ochre plaster on a grey marble plinth: a big arched door between fluted orange columns with a broken curved pediment and a white statue in a niche, an oval window above,
//     a small pedimented door and a round window and a balcony window each side, plaster pilasters, a long cornice, and a bell gable and a low gable roof behind.
//   San Stanislao Kostka (w49866776): "Chiesa di San Stanislao, Palermo - facciata.JPG", "Palermo - Chiesa di San Stanislao Kostka - 2024-09-17 18-32-39 001.jpg", "Palermo - San Stanislao Kostka 0871.JPG", "Chiesa Di San Stanislao Kostka, Monte di Pietà, Palermo, Sicily, Italy - panoramio.jpg"
//     read: a tall narrow front in golden stone: a grey marble door with a carved cartouche, square panels and arched niches each side, a heavy projecting cornice, an upper order with a framed arched window and two oval bust cartouches,
//     pilasters, a steep pediment with a cartouche and a crown of sculpture, finials at the ends. The walls beside and behind are plain brown stucco.
//   Sant'Onofrio (w279881872): "Oratorio San Onofrio Palermo.jpg", "Sant'Onofrio (Palermo) 14 07 2024 01.jpg"
//     read: a narrow tower-like bay in ochre stucco at one end of a long plain wall: a door between two free cream columns with a triangular pediment, a long balcony on brackets, a shuttered door, a small balcony,
//     a cornice, and a bell gable with two arches. The wall to the right is grey and pink peeling stucco with one barred window.
// Fronts chosen from the footprint edges and the streets: San Gregorio edge 13 (13.6 m, on Via Porta Carini), Mazza edge 10 (the church front is the 14.6 m middle of the 26 m run, the rest is the convent), Stanislao edge 7 (13.8 m, onto the piazzetta),
// Sant'Onofrio edge 7 (22.6 m onto the piazza, the tower bay at the west end).
// Not verified: which footprint edge is the front of San Stanislao (the footprint is irregular), the position of the Mazza front along its 26 m run, the roofs and the back of all four (tile roofs assumed), the real height of the Stanislao front.
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, rail, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, RNG } from './lmc-kit.js';

// ---------- shared helpers ----------
const mk = (g, w, h, wm, hm) => { const sx = w / wm, sy = h / hm, X = x => (x + wm / 2) * sx, Y = y => h - y * sy; return { sx, sy, X, Y, R: (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); } }; };
function blotch(g, w, h, n, seed, cols, bw, bh) { const r = RNG(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(r() * w, r() * h, bw * (0.4 + r()), bh * (0.4 + r())); } }
function wear(g, w, h, seed, o = {}) {   // stains, lime and soot streaks, grime at the foot, grain
  blotch(g, w, h, Math.round(w * h / 3500), seed + 1, ['rgba(255,238,205,0.10)', 'rgba(60,38,22,0.13)', 'rgba(255,248,230,0.07)'], w / 7, h / 12);
  streaks(g, w, h, o.lime === undefined ? 8 : o.lime, seed + 2, 0.22, h * 0.3, '244,236,218');
  streaks(g, w, h, o.soot === undefined ? 16 : o.soot, seed + 3, 0.22, h * 0.3, '34,26,18');
  noiseDots(g, w, h, w * h / 50, 1.7, seed + 4, ['rgba(38,26,16,0.13)', 'rgba(252,238,208,0.10)']);
  const fh = h * 0.1, gb = g.createLinearGradient(0, h, 0, h - fh); gb.addColorStop(0, 'rgba(26,19,13,0.42)'); gb.addColorStop(1, 'rgba(26,19,13,0)'); g.fillStyle = gb; g.fillRect(0, h - fh, w, fh);
}
function archAt(g, m, cx, y0, y1, hw, c) {   // round-headed opening from y0 to y1 (top of the arch), half width hw
  g.fillStyle = c; g.beginPath(); g.moveTo(m.X(cx - hw), m.Y(y0)); g.lineTo(m.X(cx - hw), m.Y(y1 - hw)); g.ellipse(m.X(cx), m.Y(y1 - hw), hw * m.sx, hw * m.sy, 0, PI, 0); g.lineTo(m.X(cx + hw), m.Y(y0)); g.closePath(); g.fill();
}
function triAt(g, m, x0, x1, y, hh, c) { g.fillStyle = c; g.beginPath(); g.moveTo(m.X(x0), m.Y(y)); g.lineTo(m.X((x0 + x1) / 2), m.Y(y + hh)); g.lineTo(m.X(x1), m.Y(y)); g.closePath(); g.fill(); }
function ovalAt(g, m, cx, cy, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(m.X(cx), m.Y(cy), rx * m.sx, ry * m.sy, 0, 0, 2 * PI); g.fill(); }
function shade(m, x0, y0, x1, y1) {   // a soft drop shadow under a projection
  const { R } = m; R(x0, y0, x1, y1, 'rgba(40,26,14,0.3)');
}
// plain wall tile for the sides and the back: plaster, a cornice band at the top, a plinth, optional stone strips at the tile edges, weathering
function paintBody(g, w, h, hm, wm, col, seed, o = {}) {
  const m = mk(g, w, h, wm, hm), { R } = m, X0 = x => x * m.sx;
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { const r = RNG(seed + i * 7); g.fillStyle = r() < 0.5 ? 'rgba(255,240,205,0.10)' : 'rgba(70,45,25,0.10)'; g.fillRect(r() * w * 0.7, r() * h * 0.8, w * (0.15 + r() * 0.3), h * (0.1 + r() * 0.25)); }
  const base = o.base === undefined ? 0.9 : o.base;
  R(0, hm - 0.9, wm, hm, o.cor || '#b9a47a'); R(0, hm - 1.0, wm, hm - 0.9, 'rgba(40,26,14,0.35)'); R(0, hm - 0.25, wm, hm, 'rgba(255,240,205,0.25)');
  R(0, 0, wm, base, o.plinth || 'rgba(70,60,52,0.35)');
  if (o.strip) { R(0, base, o.strip, hm - 0.9, o.stripCol); R(wm - o.strip, base, wm, hm - 0.9, o.stripCol); }
  if (o.win) for (const wx of o.win) { const hh = o.winH || 1.7; R(wx - 0.5, 4.0, wx + 0.5, 4.0 + hh, '#3a2e28'); R(wx - 0.65, 4.0 + hh, wx + 0.65, 4.15 + hh, '#b9a47a'); R(wx - 0.5, 4.0, wx + 0.5, 4.1, 'rgba(255,240,205,0.4)'); }
  wear(g, w, h, seed, o.wear);
}

// geometry of the front: the frame at the middle of the chosen edge, +z out of the footprint
function frontOf(p, ei) {
  const pts = pairsOf(p), n = pts.length, A = pts[ei], B = pts[(ei + 1) % n];
  let cx = 0, cz = 0; for (const q of pts) { cx += q[0] / n; cz += q[1] / n; }
  const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz); let nx = -dz / L, nz = dx / L; const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  if ((cx - mx) * nx + (cz - mz) * nz > 0) { nx = -nx; nz = -nz; }
  return { pts, L, nx, nz, mx, mz, toWorld: (x, z) => [mx + x * nz + z * nx, mz - x * nx + z * nz], toLocal: q => [(q[0] - mx) * nz - (q[1] - mz) * nx, (q[0] - mx) * nx + (q[1] - mz) * nz] };
}
function clipFront(E, zmax) {   // the footprint cut back so nothing stands in front of local z = zmax
  const Lc = E.pts.map(E.toLocal), out = [];
  for (let i = 0; i < Lc.length; i++) {
    const a = Lc[i], b = Lc[(i + 1) % Lc.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => E.toWorld(q[0], q[1]));
}
// the shared builder. c: { key, name, p, ei, xc (front centre along the edge), FW, FH, EAVE, wall, wallCol, nave: [hw, xmid, z1, rise] | null, naveTop, paintFront, shape, extras }
function buildChurch(c) {
  initShared();
  const E = frontOf(c.p, c.ei), gr = groundRange(E.pts), W = E.toWorld, xc = c.xc || 0;
  const y0 = Math.min(groundY(...W(xc - c.FW / 2, 2)), groundY(...W(xc + c.FW / 2, 2)), groundY(...W(xc, 3)));
  const F = frame(E.mx, y0, E.mz, E.nx, E.nz), at = (x, y, z) => mul(F, tr(x, y, z));
  const fw = c.FW > c.FH ? 384 : Math.round(384 * c.FW / c.FH), fh = c.FW > c.FH ? Math.round(384 * c.FH / c.FW) : 384;
  defMat(c.key + 'Front', fw, fh, [c.FW, c.FH], c.paintFront);
  defMat(c.key + 'Body', 256, 256, [8, c.EAVE], (g, w, h) => paintBody(g, w, h, c.EAVE, 8, c.wallCol, c.seed, c.bodyOpt || {}));
  if (c.naveCol) defMat(c.key + 'Nave', 256, 256, [8, c.naveTop - c.EAVE], (g, w, h) => paintBody(g, w, h, c.naveTop - c.EAVE, 8, c.naveCol, c.seed + 50, c.bodyOpt || {}));
  begin(y0);
  const body = clipFront(E, -0.1), lo = Math.min(gr.lo, y0) - 1.5;
  prism(c.key + 'Body', body, lo, y0 + c.EAVE, { uvo: [0, -y0 / c.EAVE] });
  prism('flat', body, y0 + c.EAVE, y0 + c.EAVE + 0.12, { c: '#a39a8c' });
  if (c.nave) {
    const [hw, xm, z1, rise] = c.nave, top = c.naveTop || c.EAVE;
    if (c.naveCol) bx(c.key + 'Nave', F, xm - hw, xm + hw, c.EAVE, top, -1.5, z1, { uvo: [0, -(y0 + c.EAVE) / (top - c.EAVE)] });
    gable('tile', c.key + 'Body', at(xm, 0, (-1.5 + z1) / 2), hw * 2, -1.5 - z1, top, rise, { ov: 0.3, c: '#b8744f', wc: c.wallCol });
  }
  extrude(c.key + 'Front', c.shape(c.FW, c.FH), 1.3, { M: at(xc, 0, -1.35), uv: 'keep', uvk: [1 / c.FW, 1 / c.FH], uvo: [0.5, 0], cs: 8, noao: true });
  c.extras({ F, at, y0, xc, E });
  const o = end(c.name);
  o.userData.solids = [[c.p, null, y0 + c.EAVE]];
  return o;
}
const cenOf = pts => { let x = 0, z = 0; for (let i = 0; i < pts.length; i += 2) { x += pts[i]; z += pts[i + 1]; } return [x / (pts.length / 2), z / (pts.length / 2)]; };
const reg = c => { const [x, z] = cenOf(c.p); return { name: c.name, x: Math.round(x), z: Math.round(z), radius: c.radius, skipIds: [c.id], build: () => buildChurch(c) }; };
const polyShape = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };

// ====================================================================================================
// 1. San Gregorio Papa
// ====================================================================================================
const G_LOW = 11.8, G_UPC = 15.6, G_APEX = 17.6;
const G_ST = '#9a7561', G_STH = '#b08a70', G_STU = '#c4a266', G_PL = '#d9c8a6', G_PL2 = '#e6dbc2';
function paintGFront(g, w, h) {
  const m = mk(g, w, h, 13.6, 17.6), { R } = m, hw = 6.8;
  g.fillStyle = G_PL; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 90, 8101, ['rgba(255,240,205,0.12)', 'rgba(120,85,50,0.10)'], w / 6, h / 10);
  R(-hw, 0, hw, 0.6, '#85674f');
  // lower order: corner pilasters, plaster panels in stone frames, the door bay
  for (const s of [-1, 1]) {
    R(s * 6.05 - 0.75, 0.6, s * 6.05 + 0.75, G_LOW - 1.3, G_ST); R(s * 6.05 - 0.75, 0.6, s * 6.05 - 0.55, G_LOW - 1.3, 'rgba(255,230,190,0.3)'); R(s * 6.05 + 0.55, 0.6, s * 6.05 + 0.75, G_LOW - 1.3, 'rgba(50,30,20,0.3)');
    R(s * 6.05 - 0.95, G_LOW - 2.4, s * 6.05 + 0.95, G_LOW - 1.3, G_STH); R(s * 6.05 - 0.65, G_LOW - 2.7, s * 6.05 + 0.65, G_LOW - 2.4, '#7d5e4b');
    R(s * 4.1 - 1.0, 1.4, s * 4.1 + 1.0, 8.8, G_ST); R(s * 4.1 - 0.85, 1.55, s * 4.1 + 0.85, 8.65, G_PL2);
  }
  R(-hw, G_LOW - 1.3, hw, G_LOW, G_ST); R(-hw, G_LOW - 0.35, hw, G_LOW, G_STH); R(-hw, G_LOW - 1.3, hw, G_LOW - 1.2, 'rgba(40,24,14,0.4)');
  for (let x = -hw; x < hw; x += 0.5) R(x, G_LOW - 0.9, x + 0.22, G_LOW - 0.45, 'rgba(60,38,24,0.3)');
  R(-3.5, 0.6, 3.5, 8.4, G_ST); R(-1.7, 0.6, 1.7, 7.3, '#3a352a'); R(-1.5, 0.6, 1.5, 7.1, '#6d6a3a'); R(-0.03, 0.6, 0.03, 7.1, '#2a2618');
  for (let y = 1.0; y < 6.9; y += 1.45) { R(-1.4, y, -0.1, y + 1.25, 'rgba(0,0,0,0.16)'); R(0.1, y, 1.4, y + 1.25, 'rgba(0,0,0,0.16)'); }
  R(-2.2, 7.3, 2.2, 7.6, G_STH);
  R(-3.9, 8.1, 3.9, 8.8, G_STH); R(-3.9, 8.1, 3.9, 8.2, 'rgba(40,24,14,0.4)');
  for (const s of [-1, 1]) { g.fillStyle = G_STH; g.beginPath(); g.moveTo(m.X(s * 3.9), m.Y(8.8)); g.quadraticCurveTo(m.X(s * 2.5), m.Y(11.0), m.X(s * 0.45), m.Y(9.6)); g.lineTo(m.X(s * 0.45), m.Y(8.8)); g.fill(); g.fillStyle = G_ST; g.beginPath(); g.moveTo(m.X(s * 3.3), m.Y(8.8)); g.quadraticCurveTo(m.X(s * 2.4), m.Y(10.3), m.X(s * 0.7), m.Y(9.4)); g.lineTo(m.X(s * 0.7), m.Y(8.8)); g.fill(); }
  ovalAt(g, m, 0, 9.5, 0.75, 0.9, '#a58468'); ovalAt(g, m, 0, 9.5, 0.55, 0.7, '#8a6c56');
  // upper order
  R(-hw, G_LOW, hw, G_UPC, G_PL2);
  for (const s of [-1, 1]) {
    R(s * 6.15 - 0.65, G_LOW, s * 6.15 + 0.65, G_UPC - 0.8, G_STU); R(s * 6.15 - 0.65, G_LOW, s * 6.15 - 0.5, G_UPC - 0.8, 'rgba(255,235,190,0.35)');
    R(s * 2.5 - 0.35, G_LOW, s * 2.5 + 0.35, G_UPC - 0.8, G_STU);
    R(s * 4.3 - 1.25, G_LOW + 0.6, s * 4.3 + 1.25, G_UPC - 1.3, G_STU); R(s * 4.3 - 1.1, G_LOW + 0.75, s * 4.3 + 1.1, G_UPC - 1.45, '#ece6d4');
    R(s * 4.3 - 0.5, G_UPC - 3.0, s * 4.3 + 0.5, G_UPC - 2.8, '#4a4038'); R(s * 4.3 - 0.04, G_UPC - 3.4, s * 4.3 + 0.04, G_UPC - 2.8, '#4a4038');
  }
  R(-hw, G_UPC - 0.8, hw, G_UPC, G_STU); R(-hw, G_UPC - 0.2, hw, G_UPC, '#d8bc7e');
  R(-1.45, G_LOW + 0.7, 1.45, G_UPC - 0.9, G_STU); archAt(g, m, 0, G_LOW + 0.9, G_UPC - 1.0, 0.95, '#2d3040'); archAt(g, m, 0, G_LOW + 0.9, G_UPC - 1.0, 0.95, '#2d3040');
  R(-0.95, G_LOW + 2.1, 0.95, G_LOW + 2.18, '#6a5a48'); R(-0.03, G_LOW + 0.9, 0.03, G_UPC - 1.6, '#6a5a48'); R(-0.7, G_UPC - 2.2, -0.1, G_UPC - 1.6, '#7a3040'); R(0.1, G_UPC - 2.2, 0.7, G_UPC - 1.6, '#3a4a8a');
  // pediment
  triAt(g, m, -hw - 0.2, hw + 0.2, G_UPC, G_APEX - G_UPC, G_STU); triAt(g, m, -hw + 0.8, hw - 0.8, G_UPC + 0.1, G_APEX - G_UPC - 0.55, '#e0d6bd'); ovalAt(g, m, 0, G_UPC + 0.7, 0.45, 0.35, '#a58468');
  const sg = g.createLinearGradient(0, m.Y(G_LOW - 1.3), 0, m.Y(G_LOW - 3.0)); sg.addColorStop(0, 'rgba(50,30,15,0.28)'); sg.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = sg; g.fillRect(0, m.Y(G_LOW - 1.3), w, 1.7 * m.sy);
  wear(g, w, h, 8110, { foot: h * 0.07 });
}
function gShape(W, H) { return polyShape([[-W / 2, 0], [W / 2, 0], [W / 2, G_UPC], [0, G_APEX], [-W / 2, G_UPC]]); }
function gExtras({ F }) {
  for (const s of [-1, 1]) {
    cyl('flat', 0.5, 0.55, 6.4, 12, { M: mul(F, tr(s * 2.65, 0.6, 0.65)), c: '#b58e74' });
    bx('flat', F, s * 2.65 - 0.85, s * 2.65 + 0.85, 0.2, 0.6, 0.0, 1.3, { c: '#9d7b64', noao: true });
    bx('flat', F, s * 2.65 - 0.85, s * 2.65 + 0.85, 7.0, 7.7, 0.0, 1.3, { c: '#b08a70', noao: true });
    bx('flat', F, s * 6.05 - 0.9, s * 6.05 + 0.9, 0.6, G_LOW - 1.3, -0.05, 0.28, { c: '#a98168', noao: true });
    bx('flat', F, s * 6.15 - 0.7, s * 6.15 + 0.7, G_LOW, G_UPC - 0.8, -0.05, 0.22, { c: '#c4a266', noao: true });
  }
  bx('flat', F, -3.9, 3.9, 7.7, 8.7, 0.0, 1.35, { c: '#b08a70', noao: true });
  bx('flat', F, -7.1, 7.1, G_LOW - 0.35, G_LOW + 0.25, -0.05, 0.75, { c: '#b08a70', noao: true });
  bx('flat', F, -7.1, 7.1, G_UPC - 0.2, G_UPC + 0.25, -0.05, 0.6, { c: '#d8bc7e', noao: true });
  bx('flat', F, -2.2, 2.2, 0, 0.25, 0.0, 1.6, { c: '#8e8a82', noao: true });
  sphere('flat', 0.45, { M: mul(F, tr(0, G_APEX + 0.3, 0)), seg: 6, c: '#c4a266' });
}
const GRE = { key: 'bmG', id: 'w279883149', name: 'Chiesa di San Gregorio Papa', radius: 45, ei: 13, FW: 13.6, FH: 17.6, EAVE: 15.0, seed: 8200,
  p: [-634.7, -342.7, -634.4, -342.1, -626.3, -344.9, -610.8, -350.3, -604.1, -352.9, -594.9, -355.9, -593.5, -356.3, -590.1, -345.9, -600.6, -342.1, -623.3, -333.9, -623, -332.9, -629.2, -330.8, -629, -330.1, -630.2, -329.8, -635.7, -342.2],
  wallCol: '#cdb998', bodyOpt: { strip: 0.9, stripCol: '#a5805f', cor: '#a5805f' }, nave: [5.6, 0.2, -43, 2.2], paintFront: paintGFront, shape: gShape, extras: gExtras };

// ====================================================================================================
// 2. Madonna della Mazza (Madonna del Soccorso)
// ====================================================================================================
const M_H = 11.3, M_PL = '#cdb98a', M_PL2 = '#d6c496', M_OR = '#c98440', M_ORH = '#dc9a58', M_DOOR = '#4c2d2e', M_MAR = '#8f9396';
function paintMFront(g, w, h) {
  const m = mk(g, w, h, 14.6, M_H), { R } = m, hw = 7.3;
  g.fillStyle = M_PL; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 100, 8301, ['rgba(255,240,205,0.10)', 'rgba(110,80,40,0.10)', 'rgba(160,140,90,0.10)'], w / 6, h / 8);
  R(-hw, 0, hw, 1.0, M_MAR); R(-hw, 1.0, hw, 1.12, 'rgba(255,255,255,0.25)');
  // pilasters (plaster, framed)
  for (const x of [-6.45, -2.75, 2.75, 6.45]) {
    R(x - 0.55, 1.1, x + 0.55, 10.0, M_PL2); R(x - 0.55, 1.1, x - 0.45, 10.0, 'rgba(255,245,215,0.3)'); R(x + 0.45, 1.1, x + 0.55, 10.0, 'rgba(60,40,20,0.3)');
    R(x - 0.7, 9.7, x + 0.7, 10.1, '#bda979'); R(x - 0.7, 1.0, x + 0.7, 1.5, '#bda979');
  }
  // round windows and side doors
  for (const s of [-1, 1]) {
    const x = s * 5.0;
    ovalAt(g, m, x, 5.9, 0.62, 0.62, M_PL2); ovalAt(g, m, x, 5.9, 0.5, 0.5, '#2a2f36'); for (const d of [-0.25, 0, 0.25]) R(x + d - 0.02, 5.4, x + d + 0.02, 6.4, '#6a6a68');
    R(x - 0.95, 1.0, x + 0.95, 4.0, M_OR); R(x - 0.65, 1.0, x + 0.65, 3.8, M_DOOR); R(x - 0.02, 1.0, x + 0.02, 3.8, '#2a1a1a');
    triAt(g, m, x - 1.35, x + 1.35, 4.0, 0.95, M_ORH); triAt(g, m, x - 0.85, x + 0.85, 4.12, 0.55, M_PL2);
    // balcony window above
    const wx = s * 4.7;
    R(wx - 0.9, 7.0, wx + 0.9, 7.2, '#bda979'); R(wx - 0.5, 7.2, wx + 0.5, 9.0, '#4a3326'); R(wx - 0.38, 7.35, wx + 0.38, 8.9, '#6a5a52'); R(wx - 0.5, 7.2, wx + 0.5, 7.9, '#2e2a26');
    for (let xx = wx - 0.5; xx < wx + 0.5; xx += 0.15) R(xx, 7.2, xx + 0.03, 7.9, '#7a7468');
    R(wx - 0.8, 9.0, wx + 0.8, 9.4, '#b9a577'); R(wx - 0.8, 9.0, wx + 0.8, 9.1, 'rgba(40,26,14,0.35)');
  }
  // the portal in orange stone
  R(-2.6, 1.0, 2.6, 6.1, M_OR); archAt(g, m, 0, 1.0, 5.8, 1.55, M_ORH); archAt(g, m, 0, 1.0, 5.5, 1.35, M_DOOR);
  R(-1.35, 1.0, 1.35, 4.6, M_DOOR); R(-0.03, 1.0, 0.03, 5.0, '#241616');
  for (let y = 1.4; y < 5.2; y += 0.55) for (let x = -1.2; x < 1.3; x += 0.55) R(x, y, x + 0.12, y + 0.12, 'rgba(210,190,170,0.5)');
  R(-2.6, 6.0, 2.6, 6.95, M_OR); R(-2.6, 6.0, 2.6, 6.1, 'rgba(50,25,10,0.4)'); for (let x = -2.4; x < 2.4; x += 0.35) R(x, 6.35, x + 0.2, 6.6, 'rgba(90,50,20,0.35)');
  for (const s of [-1, 1]) { g.fillStyle = M_ORH; g.beginPath(); g.moveTo(m.X(s * 2.8), m.Y(6.95)); g.quadraticCurveTo(m.X(s * 2.2), m.Y(8.4), m.X(s * 0.8), m.Y(7.9)); g.lineTo(m.X(s * 0.8), m.Y(6.95)); g.fill(); g.fillStyle = '#b47232'; g.beginPath(); g.moveTo(m.X(s * 2.3), m.Y(6.95)); g.quadraticCurveTo(m.X(s * 2.0), m.Y(8.0), m.X(s * 1.0), m.Y(7.7)); g.lineTo(m.X(s * 1.0), m.Y(6.95)); g.fill(); }
  R(-0.95, 6.95, 0.95, 9.0, M_OR); R(-0.75, 7.1, 0.75, 8.8, '#8a6a4a'); archAt(g, m, 0, 7.1, 8.6, 0.58, '#6e5438'); ovalAt(g, m, 0, 7.95, 0.34, 0.6, '#ece6d6'); R(-0.2, 7.2, 0.2, 7.5, '#ece6d6');
  ovalAt(g, m, 0, 9.55, 1.05, 0.68, '#b59f70'); ovalAt(g, m, 0, 9.55, 0.9, 0.56, '#2a3038'); for (const d of [-0.5, 0, 0.5]) R(0 + d - 0.02, 9.0, d + 0.02, 10.1, '#6a6a68');
  // cornice and frieze
  R(-hw, 10.2, hw, M_H, '#b9a47a'); R(-hw, 10.2, hw, 10.3, 'rgba(40,26,14,0.4)'); R(-hw, 10.45, hw, 10.65, '#cdb98a'); R(-hw, 10.9, hw, M_H, '#d4c18f');
  const sg = g.createLinearGradient(0, m.Y(10.2), 0, m.Y(8.6)); sg.addColorStop(0, 'rgba(50,30,15,0.3)'); sg.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = sg; g.fillRect(0, m.Y(10.2), w, 1.6 * m.sy);
  wear(g, w, h, 8310, { foot: h * 0.08 });
}
function mExtras({ F }) {
  for (const s of [-1, 1]) {
    cyl('flat', 0.27, 0.3, 5.0, 12, { M: mul(F, tr(s * 1.95, 1.2, 0.5)), c: '#c98440' });
    bx('flat', F, s * 1.95 - 0.55, s * 1.95 + 0.55, 0.9, 1.5, 0.0, 1.1, { c: '#d8d0bf', noao: true });
    bx('flat', F, s * 1.95 - 0.5, s * 1.95 + 0.5, 6.2, 6.55, 0.0, 1.0, { c: '#dc9a58', noao: true });
    bx('flat', F, s * 6.45 - 0.62, s * 6.45 + 0.62, 1.1, 10.0, -0.05, 0.2, { c: '#d6c496', noao: true });
    bx('flat', F, s * 2.75 - 0.62, s * 2.75 + 0.62, 1.1, 10.0, -0.05, 0.2, { c: '#d6c496', noao: true });
    bx('flat', F, s * 5.0 - 0.8, s * 5.0 + 0.8, 3.95, 4.15, -0.05, 0.4, { c: '#dc9a58', noao: true });
    bx('flat', F, s * 4.7 - 0.75, s * 4.7 + 0.75, 6.9, 7.1, 0.0, 0.8, { c: '#bda979', noao: true });
  }
  bx('flat', F, -2.75, 2.75, 6.0, 6.95, -0.05, 1.2, { c: '#c98440', noao: true });
  bx('flat', F, -7.5, 7.5, 10.25, 11.0, -0.05, 0.6, { c: '#b9a47a', noao: true });
  bx('flat', F, -7.5, 7.5, 0, 0.1, 0.0, 1.0, { c: '#a9a59c', noao: true }); bx('flat', F, -2.0, 2.0, 0.1, 0.3, 0.9, 1.5, { c: '#a9a59c', noao: true });
  // bell gable behind the left of the front, and the lantern on the ridge
  bx('flat', F, -7.0, -3.6, M_H, M_H + 3.0, -2.6, -1.4, { c: '#e0d2b4', noao: true });
  bx('flat', F, -5.9, -4.7, M_H + 1.4, M_H + 2.6, -1.45, -1.35, { c: '#2c2622', noao: true });
  bx('flat', F, -6.5, -4.1, M_H + 3.0, M_H + 3.3, -2.8, -1.2, { c: '#c9b690', noao: true });
  bx('flat', F, -0.1, 0.1, M_H + 3.3, M_H + 4.4, -2.1, -1.9, { c: '#3a3028', noao: true }); bx('flat', F, -0.5, 0.5, M_H + 3.9, M_H + 4.05, -2.1, -1.9, { c: '#3a3028', noao: true });
}
const MAZ = { key: 'bmM', id: 'w279882163', name: 'Chiesa della Madonna della Mazza', radius: 32, ei: 10, xc: -1.0, FW: 14.6, FH: M_H, EAVE: 11.0, seed: 8400,
  p: [-160.2, -409.1, -151, -402.5, -157.1, -395.6, -148.5, -391.6, -150.6, -387.3, -156.1, -389.8, -163.5, -383.1, -167.8, -380.3, -171.9, -387.4, -177.1, -385, -183.3, -397.2],
  wallCol: '#c7b48c', bodyOpt: { win: [1.5, 5.5], winH: 1.6 }, nave: [8.0, -1.0, -21, 2.6], paintFront: paintMFront, shape: (W, H) => polyShape([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]]), extras: mExtras };

// ====================================================================================================
// 3. San Stanislao Kostka
// ====================================================================================================
const S_LOW = 9.9, S_UPC = 15.4, S_APEX = 20.4, S_FH = 21.4;
const S_GOLD = '#d2a032', S_GOLDH = '#e2b955', S_GOLDD = '#a97c22', S_MAR = '#b9bcb6';
function paintSFront(g, w, h) {
  const m = mk(g, w, h, 13.8, S_FH), { R } = m, hw = 6.9;
  g.fillStyle = S_GOLD; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 110, 8501, ['rgba(255,226,140,0.14)', 'rgba(130,85,20,0.13)', 'rgba(190,140,50,0.12)'], w / 7, h / 10);
  // ashlar courses faintly
  for (let y = 0.7; y < S_UPC; y += 0.7) R(-hw, y, hw, y + 0.05, 'rgba(100,65,15,0.16)');
  R(-hw, 0, hw, 0.5, S_GOLDD);
  // lower order
  for (const s of [-1, 1]) {
    R(s * 6.2 - 0.7, 0.5, s * 6.2 + 0.7, S_LOW - 0.9, S_GOLDH); R(s * 6.2 - 0.7, 0.5, s * 6.2 - 0.55, S_LOW - 0.9, 'rgba(255,240,180,0.4)'); R(s * 6.2 + 0.55, 0.5, s * 6.2 + 0.7, S_LOW - 0.9, 'rgba(70,40,10,0.3)');
    R(s * 3.9 - 0.95, 6.0, s * 3.9 + 0.95, 8.0, S_GOLDH); R(s * 3.9 - 0.78, 6.17, s * 3.9 + 0.78, 7.83, S_GOLD); R(s * 3.9 - 0.4, 6.55, s * 3.9 + 0.4, 7.45, S_GOLDD);
    R(s * 3.9 - 1.0, 1.2, s * 3.9 + 1.0, 5.4, S_GOLDH); archAt(g, m, s * 3.9, 1.35, 5.25, 0.85, S_GOLD); archAt(g, m, s * 3.9, 1.5, 4.9, 0.55, '#b88a2a');
    R(s * 2.2 - 0.3, 0.5, s * 2.2 + 0.3, S_LOW - 0.9, S_GOLDH);
  }
  R(-hw, S_LOW - 0.9, hw, S_LOW, S_GOLDH); R(-hw, S_LOW - 1.8, hw, S_LOW - 0.9, S_GOLD); for (let x = -hw; x < hw; x += 0.45) R(x, S_LOW - 1.6, x + 0.2, S_LOW - 1.1, 'rgba(100,65,15,0.3)');
  R(-hw - 0.3, S_LOW, hw + 0.3, S_LOW + 0.55, S_GOLDH);
  // the door: grey marble frame, dark panelled leaf, a carved cartouche above
  R(-1.75, 0.5, 1.75, 5.0, S_MAR); R(-1.4, 0.5, 1.4, 4.6, '#3d2c26'); R(-0.03, 0.5, 0.03, 4.6, '#241a16');
  for (let y = 0.8; y < 4.5; y += 0.7) for (const x of [-1.05, -0.35, 0.35]) R(x, y, x + 0.7, y + 0.55, 'rgba(0,0,0,0.2)');
  R(-2.0, 5.0, 2.0, 5.3, S_MAR); ovalAt(g, m, 0, 6.2, 0.7, 0.95, '#d9d6cc'); ovalAt(g, m, 0, 6.2, 0.5, 0.75, '#a9a79e');
  for (const s of [-1, 1]) { g.fillStyle = '#d9d6cc'; g.beginPath(); g.arc(m.X(s * 1.1), m.Y(7.1), 0.55 * m.sx, 0, 2 * PI); g.fill(); }
  // upper order
  for (const s of [-1, 1]) {
    R(s * 6.2 - 0.7, S_LOW + 0.55, s * 6.2 + 0.7, S_UPC - 0.7, S_GOLDH); R(s * 6.2 - 0.7, S_LOW + 0.55, s * 6.2 - 0.55, S_UPC - 0.7, 'rgba(255,240,180,0.4)');
    R(s * 2.55 - 0.4, S_LOW + 0.55, s * 2.55 + 0.4, S_UPC - 0.7, S_GOLDH);
    R(s * 4.35 - 1.5, S_LOW + 2.0, s * 4.35 + 1.5, S_UPC - 0.7, S_GOLD);
    ovalAt(g, m, s * 4.35, 12.7, 1.0, 1.75, S_GOLDH); ovalAt(g, m, s * 4.35, 12.7, 0.75, 1.4, '#b88a2a'); ovalAt(g, m, s * 4.35, 12.7, 0.45, 0.8, '#e9e4d4'); ovalAt(g, m, s * 4.35, 11.9, 0.35, 0.55, '#d9d4c2');
    R(s * 4.35 - 1.5, S_LOW + 0.55, s * 4.35 + 1.5, S_LOW + 1.6, S_GOLDH); R(s * 4.35 - 0.9, S_LOW + 0.85, s * 4.35 + 0.9, S_LOW + 1.3, S_GOLDD);
  }
  R(-1.85, S_LOW + 0.9, 1.85, 14.0, S_GOLDH); R(-1.15, S_LOW + 1.1, 1.15, 13.2, '#2a2f3a'); archAt(g, m, 0, 11.0, 13.4, 1.15, '#2a2f3a');
  for (const y of [12.0, 13.0]) R(-1.15, y, 1.15, y + 0.07, '#7a6a50'); R(-0.04, S_LOW + 1.1, 0.04, 13.8, '#7a6a50');
  g.fillStyle = S_GOLDH; g.beginPath(); g.moveTo(m.X(-2.0), m.Y(13.4)); g.quadraticCurveTo(m.X(0), m.Y(15.2), m.X(2.0), m.Y(13.4)); g.lineTo(m.X(1.4), m.Y(13.2)); g.quadraticCurveTo(m.X(0), m.Y(14.4), m.X(-1.4), m.Y(13.2)); g.fill();
  R(-hw - 0.2, S_UPC - 0.7, hw + 0.2, S_UPC, S_GOLDH); R(-hw - 0.2, S_UPC - 0.7, hw + 0.2, S_UPC - 0.6, 'rgba(100,65,15,0.4)');
  // the steep pediment, with a carved cartouche
  triAt(g, m, -hw - 0.3, hw + 0.3, S_UPC, S_APEX - S_UPC, S_GOLDH); triAt(g, m, -hw + 0.9, hw - 0.9, S_UPC + 0.15, S_APEX - S_UPC - 1.3, S_GOLD);
  ovalAt(g, m, 0, S_UPC + 1.6, 1.6, 0.85, S_GOLDH); ovalAt(g, m, 0, S_UPC + 1.6, 1.2, 0.55, S_GOLDD);
  const sg = g.createLinearGradient(0, m.Y(S_LOW + 0.55), 0, m.Y(S_LOW - 1.0)); sg.addColorStop(0, 'rgba(60,35,5,0.35)'); sg.addColorStop(1, 'rgba(60,35,5,0)'); g.fillStyle = sg; g.fillRect(0, m.Y(S_LOW), w, 1.5 * m.sy);
  wear(g, w, h, 8510, { foot: h * 0.05, soot: 10 });
}
function sShape(W) { return polyShape([[-W / 2, 0], [W / 2, 0], [W / 2, S_UPC], [0, S_APEX], [-W / 2, S_UPC]]); }
function sExtras({ F }) {
  for (const s of [-1, 1]) {
    bx('flat', F, s * 6.2 - 0.75, s * 6.2 + 0.75, 0.5, S_LOW - 0.9, -0.05, 0.3, { c: '#e2b955', noao: true });
    bx('flat', F, s * 6.2 - 0.75, s * 6.2 + 0.75, S_LOW + 0.55, S_UPC - 0.7, -0.05, 0.3, { c: '#e2b955', noao: true });
    bx('flat', F, s * 2.55 - 0.45, s * 2.55 + 0.45, S_LOW + 0.55, S_UPC - 0.7, -0.05, 0.22, { c: '#e2b955', noao: true });
    sphere('flat', 0.5, { M: mul(F, tr(s * 7.0, S_UPC + 0.3, 0.0)), seg: 6, ky: 1.8, c: '#c99a2a' });
  }
  bx('flat', F, -7.3, 7.3, S_LOW - 0.1, S_LOW + 0.6, -0.05, 0.95, { c: '#e2b955', noao: true });
  bx('flat', F, -7.3, 7.3, S_UPC - 0.7, S_UPC, -0.05, 0.7, { c: '#e2b955', noao: true });
  bx('flat', F, -2.2, 2.2, 5.0, 5.35, -0.05, 0.6, { c: '#b9bcb6', noao: true });
  bx('flat', F, -2.5, 2.5, 0, 0.25, 0.0, 1.4, { c: '#8e8a82', noao: true });
  // the crown of sculpture on the apex and the cross
  sphere('flat', 1.5, { M: mul(F, tr(0, S_APEX + 0.9, -0.3)), seg: 8, ky: 0.95, c: '#c99a2a' });
  bx('flat', F, -0.7, 0.7, S_APEX + 2.0, S_APEX + 2.5, -0.5, 0.1, { c: '#e2b955', noao: true });
  bx('flat', F, -0.1, 0.1, S_APEX + 2.4, S_APEX + 3.4, -0.3, -0.1, { c: '#3a3028', noao: true }); bx('flat', F, -0.5, 0.5, S_APEX + 2.9, S_APEX + 3.05, -0.3, -0.1, { c: '#3a3028', noao: true });
}
const STA = { key: 'bmS', id: 'w49866776', name: 'San Stanislao Kostka', radius: 48, ei: 7, FW: 13.8, FH: S_FH, EAVE: 9.0, naveTop: 15.4, seed: 8600,
  p: [-814.6, -227.8, -805.1, -214.5, -819.6, -206.3, -820, -201.3, -829.4, -200.6, -834.7, -204.7, -832.5, -213.7, -826.2, -220.4],
  wallCol: '#b9a589', naveCol: '#b3a083', bodyOpt: { cor: '#9d8a6a' }, nave: [6.3, 0.0, -16, 2.8], paintFront: paintSFront, shape: sShape, extras: sExtras };

// ====================================================================================================
// 4. Sant'Onofrio
// ====================================================================================================
const O_H = 12.8, O_FW = 22.6, O_PX = -7.6;
function paintOFront(g, w, h) {
  const m = mk(g, w, h, O_FW, 15.0), { R } = m, hw = O_FW / 2;
  g.fillStyle = '#c9b8a0'; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 140, 8701, ['rgba(255,240,205,0.10)', 'rgba(90,70,60,0.10)', 'rgba(200,130,110,0.10)'], w / 8, h / 10);
  // the long wall to the right: grey stucco with pink peeling patches and a barred window
  R(-3.9, 0, hw, O_H, '#b7aea4');
  for (const [x0, y0, x1, y1] of [[1.5, 7.5, 7.5, 12.0], [8.5, 5.0, 11.3, 9.5], [-3.4, 8.0, -1.0, 12.0]]) R(x0, y0, x1, y1, 'rgba(206,140,120,0.45)');
  R(8.2, 6.6, 9.4, 8.4, '#bba98e'); R(8.35, 6.75, 9.25, 8.25, '#2a2520'); for (const x of [8.65, 8.95]) R(x, 6.75, x + 0.04, 8.25, '#6a5c4c'); R(8.35, 7.5, 9.25, 7.54, '#6a5c4c');
  R(-3.9, O_H - 0.7, hw, O_H, '#9d927f'); R(-3.9, O_H - 0.75, hw, O_H - 0.7, 'rgba(30,20,10,0.4)');
  R(-hw, 0, hw, 0.7, 'rgba(110,90,70,0.45)');
  // the tower bay in ochre stucco
  const bw = 3.8; R(O_PX - bw, 0, O_PX + bw, O_H, '#d8bd8c'); R(O_PX - bw, O_H - 0.7, O_PX + bw + 0.2, O_H, '#bba478');
  R(O_PX - bw, 0, O_PX + bw, 0.9, '#bba478');
  R(O_PX - 1.3, 0.3, O_PX + 1.3, 4.7, '#e4d3a8'); R(O_PX - 1.1, 0.3, O_PX + 1.1, 4.7, '#6b3f33'); R(O_PX - 0.02, 0.3, O_PX + 0.02, 4.7, '#2a1812');
  for (let y = 0.6; y < 4.5; y += 1.1) { R(O_PX - 1.0, y, O_PX - 0.1, y + 0.9, 'rgba(0,0,0,0.18)'); R(O_PX + 0.1, y, O_PX + 1.0, y + 0.9, 'rgba(0,0,0,0.18)'); }
  R(O_PX - 1.5, 4.7, O_PX + 1.5, 5.0, '#d8c79b'); R(O_PX - 2.9, 5.0, O_PX + 2.9, 6.2, '#d6c496');
  triAt(g, m, O_PX - 3.1, O_PX + 3.1, 6.2, 1.9, '#d8c79b'); triAt(g, m, O_PX - 2.4, O_PX + 2.4, 6.3, 1.4, '#cdb98a');
  // first floor: shuttered door and a side window, second floor: a shuttered door
  R(O_PX - 0.65, 8.5, O_PX + 0.65, 10.2, '#5c3a30'); for (let x = O_PX - 0.6; x < O_PX + 0.6; x += 0.12) R(x, 8.55, x + 0.05, 10.15, '#3c2418');
  R(O_PX - 2.9, 8.4, O_PX - 1.9, 10.0, '#5c3a30'); for (let y = 8.5; y < 9.95; y += 0.14) R(O_PX - 2.85, y, O_PX - 1.95, y + 0.05, '#3c2418');
  R(O_PX - 0.55, 11.4, O_PX + 0.55, 12.4, '#5c3a30'); for (let y = 11.45; y < 12.35; y += 0.13) R(O_PX - 0.5, y, O_PX + 0.5, y + 0.05, '#3c2418');
  wear(g, w, h, 8710, { foot: h * 0.07, lime: 5, soot: 12 });
}
function oShape(W) { return polyShape([[-W / 2, 0], [W / 2, 0], [W / 2, O_H], [-W / 2, O_H]]); }
function oExtras({ F }) {
  const X = O_PX - 11.3 + 11.3;   // x of the bay centre in the frame of the whole front (the front is centred on its edge)
  for (const s of [-1, 1]) {
    cyl('flat', 0.5, 0.55, 4.4, 14, { M: mul(F, tr(O_PX + s * 2.2, 0.5, 0.75)), c: '#e4d3a8' });
    bx('flat', F, O_PX + s * 2.2 - 0.85, O_PX + s * 2.2 + 0.85, 0.2, 0.5, 0.0, 1.5, { c: '#c9b88e', noao: true });
    bx('flat', F, O_PX + s * 2.2 - 0.85, O_PX + s * 2.2 + 0.85, 4.8, 5.4, 0.0, 1.5, { c: '#dcc9a0', noao: true });
    bx('flat', F, O_PX + s * 3.0 - 0.3, O_PX + s * 3.0 + 0.3, 0.5, 5.0, -0.05, 0.3, { c: '#dcc9a0', noao: true });
  }
  bx('flat', F, O_PX - 3.1, O_PX + 3.1, 5.4, 6.4, 0.0, 1.5, { c: '#d8c79b', noao: true });
  // the triangular pediment of the door
  const sh = polyShape([[-3.4, 0], [3.4, 0], [0, 1.9]]);
  extrude('flat', sh, 1.3, { M: mul(F, tr(O_PX, 6.4, 0.1)), c: '#d4c293', noao: true });
  // the long balcony on brackets, with its rail, and the small balcony higher up
  bx('flat', F, O_PX - 3.3, O_PX + 3.3, 8.15, 8.4, 0.0, 1.2, { c: '#b9a98a', noao: true });
  for (let x = -3.1; x <= 3.1; x += 0.8) bx('flat', F, O_PX + x - 0.06, O_PX + x + 0.06, 7.45, 8.15, 0.05, 0.9, { c: '#3a3028', noao: true });
  rail(mul(F, tr(O_PX, 8.4, 1.15)), 6.6, 1.0, {});
  bx('flat', F, O_PX - 1.4, O_PX + 1.4, 11.15, 11.35, 0.0, 1.0, { c: '#b9a98a', noao: true });
  for (let x = -1.2; x <= 1.2; x += 0.8) bx('flat', F, O_PX + x - 0.05, O_PX + x + 0.05, 10.5, 11.15, 0.05, 0.8, { c: '#3a3028', noao: true });
  rail(mul(F, tr(O_PX, 11.35, 0.95)), 2.8, 0.95, {});
  // the cornice, a deeper one over the tower bay
  bx('flat', F, O_PX - 4.2, O_PX + 4.2, O_H - 0.75, O_H + 0.15, -0.05, 0.75, { c: '#bba478', noao: true });
  bx('flat', F, O_PX + 4.1, O_FW / 2 + 0.1, O_H - 0.7, O_H + 0.1, -0.05, 0.45, { c: '#9d927f', noao: true });
  // the bell gable with its two arches
  bx('flat', F, O_PX - 2.9, O_PX + 2.9, O_H, O_H + 2.0, -2.0, -0.4, { c: '#cdb98a', noao: true });
  for (const s of [-1, 1]) { bx('flat', F, O_PX + s * 1.15 - 0.55, O_PX + s * 1.15 + 0.55, O_H + 0.4, O_H + 1.5, -0.45, -0.35, { c: '#2a221c', noao: true }); sphere('flat', 0.55, { M: mul(F, tr(O_PX + s * 1.15, O_H + 1.5, -0.4)), seg: 6, ky: 0.6, kz: 0.2, c: '#2a221c' }); }
  bx('flat', F, O_PX - 0.5, O_PX + 0.5, O_H + 2.0, O_H + 2.5, -1.4, -0.7, { c: '#cdb98a', noao: true });
  bx('flat', F, O_PX - 0.07, O_PX + 0.07, O_H + 2.5, O_H + 3.5, -1.1, -1.0, { c: '#3a3028', noao: true }); bx('flat', F, O_PX - 0.4, O_PX + 0.4, O_H + 3.0, O_H + 3.12, -1.1, -1.0, { c: '#3a3028', noao: true });
  void X;
}
const ONO = { key: 'bmO', id: 'w279881872', name: "Chiesa di Sant'Onofrio", radius: 30, ei: 7, FW: O_FW, FH: 15.0, EAVE: 12.2, seed: 8800,
  p: [-264.4, -191.1, -256.2, -192.1, -256.8, -194.8, -252.7, -196.2, -250.5, -190.3, -242.1, -192, -241.8, -190.1, -240.2, -182.5, -262.5, -178.7],
  wallCol: '#c4b49a', bodyOpt: { cor: '#9d927f' }, nave: [3.8, O_PX, -11.5, 2.4], paintFront: paintOFront, shape: oShape, extras: oExtras };

export const BATCH_M = [reg(GRE), reg(MAZ), reg(STA), reg(ONO)];
