// City landmarks, batch J: Santa Maria di Porto Salvo, Chiesa dei Santi Pietro e Paolo, Santa Croce (the Anglican church of the Holy Cross). Registered in src/landmarks-city.js.
// Santa Caterina da Siena (w279882644) is NOT built here: no photo of its exterior could be found, so it stays generic.
// Each church: frame F with the origin on the ground in the middle of the real front, +z out of the front, local x along the front (right as seen from the street).
// The front is chosen from the photos and the roads around the footprint. The body is the footprint clipped at the front, the painted front is one extruded shape, nave and roofs follow the photos.
// Reference photos (Wikimedia Commons, looked at, nothing copied):
//  Santa Maria di Porto Salvo: "Palermo - Chiesa di Santa Maria di Porto Salvo - 2024-07-16 20-08-06 001.JPG" (corner view of the front and its return), "Santa Maria di Portosalvo.jpg" (the whole front, three bays; the third file is an interior).
//   Read: a two-storey tuff front in warm ochre-brown ashlar, four pilasters (three bays), lower row of three barred windows with cornices, a central door with a triangular pediment and a framed window above it,
//   a heavy projecting ledge, an upper row of three balcony windows with iron rails and short pilasters, a deep dentilled cornice. About 16 m wide, 0.9 of that high, flat roof behind the cornice.
//  Chiesa dei Santi Pietro e Paolo: "Chiesa dei Santi Pietro e Paolo (Palermo) - facciata1.JPG", "Palermo-AP-p1070709.jpg", "Palermo-AP-p1070716.jpg" (details of the portal and the plaque).
//   Read: neo-Gothic front in honey tuff ashlar, three pointed portals (a big central one with a striped archivolt and a leafy hood, two small ones), two roundels over the side portals, a diamond plaque with papal keys,
//   a higher central nave with a bifora window under a striped hood, aisle fronts that slope down to the sides, a frieze of small pointed arches under the slopes and the gable, an inscription band, thin buttress strips.
//  Santa Croce (Holy Cross, Via Roma): "Palermo-Chiesa-Anglicana-bjs2007-01.jpg" (front from the street), "Holy_Cross_Palermo.jpg" (interior, striped arches, honey stone).
//   Read: cream-yellow ashlar, a steep gable with a big rose window, three round-arched windows under it, a small arched door at the right, a square tower on the left with a slim stone spire, red tile roofs, round-arched side windows.
// Not known and not drawn: the roofs behind the fronts beyond what the photos show, the back walls, the side doors of Santa Croce and the porch at its front-left corner.
import * as THREE from 'three';
import { PI, bx, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, paintAshlar, pairsOf, groundRange, gable, cone, RNG } from './lmc-kit.js';

const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
function setup(flat, mid, n) {
  const toW = (x, z) => [mid[0] + x * n[1] + z * n[0], mid[1] - x * n[0] + z * n[1]];
  const toL = (p) => { const dx = p[0] - mid[0], dz = p[1] - mid[1]; return [dx * n[1] - dz * n[0], dx * n[0] + dz * n[1]]; };
  const loc = pairsOf(flat).map(toL);
  const clip = (zmax) => { const out = []; for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out.map(q => toW(q[0], q[1])); };
  const fit = (x0, x1) => { let len = 0; for (let z = -1.5; z > -60; z -= 1) { if (inPoly(loc, x0, z) && inPoly(loc, x1, z) && inPoly(loc, (x0 + x1) / 2, z)) len = -z; else break; } return len; };
  const y0 = Math.min(groundY(...toW(-4, 1)), groundY(...toW(4, 1)), groundY(...toW(0, 1)));
  return { toW, clip, fit, y0, F: frame(mid[0], y0, mid[1], n[0], n[1]), pts: pairsOf(flat), ring: (x0, x1, z0, z1) => [toW(x0, z0), toW(x1, z0), toW(x1, z1), toW(x0, z1)].flat() };
}
const centre = (flat) => { let x = 0, z = 0; const n = flat.length / 2; for (let i = 0; i < n; i++) { x += flat[2 * i]; z += flat[2 * i + 1]; } return [x / n, z / n]; };
// painting helpers: a canvas covering FW x FH metres, x centred, y up from the ground
function tools(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const pnt = (x, y0, y1, ww, c) => { const r = ww / 2, ys = y1 - 1.3 * r; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(ys + r * 1.05), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(ys + r * 1.05), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); g.fill(); };
  return { sx, sy, X, Y, R, arch, pnt, circ, poly };
}
// stone with real wear: ashlar, big blotches of damp and sun, streaks from the ledges, grime at the foot
function stone(g, w, h, tw, th, base, joint, seed, course = 0.5, block = 1.1) {
  paintAshlar(g, w, h, tw, th, course, block, base, joint, seed, 1.2, 0.09);
  const r = RNG(seed + 3);
  for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h, rad = (0.1 + r() * 0.2) * Math.max(w, h), c = r() < 0.6 ? '70,50,30' : '255,240,205', gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${c},${0.1 + r() * 0.1})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
}
function finish(g, w, h, th, seed, col = '60,42,28') {
  streaks(g, w, h, 34, seed, 0.12, 110, col);
  const gb = g.createLinearGradient(0, h, 0, h - 3 * h / th); gb.addColorStop(0, 'rgba(40,28,18,0.34)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, h - 3 * h / th, w, 3 * h / th);
}
// a side wall bay (4.5 m wide, hm tall): pilaster edges, windows given as [y0, y1, arched]
function paintBay(g, w, h, hm, base, joint, seed, wins, trim) {
  const t = tools(g, w, h, 4.5, hm), { R, arch } = t, sx = t.sx, sy = t.sy;
  const X = x => x * sx;
  stone(g, w, h, 4.5, hm, base, joint, seed);
  R(-2.25, 0, -1.75, hm, trim); R(1.75, 0, 2.25, hm, trim); R(-2.25, 0, 2.25, 0.8, 'rgba(70,52,32,0.5)');
  for (const [a, b, ar] of wins) { if (ar) { arch(0, a - 0.2, b + 0.2, 1.5, trim); arch(0, a, b, 1.0, '#231c16'); } else { R(-0.8, a - 0.2, 0.8, b + 0.2, trim); R(-0.55, a, 0.55, b, '#231c16'); R(-0.55, (a + b) / 2, 0.55, (a + b) / 2 + 0.07, trim); } }
  R(-2.25, hm - 0.5, 2.25, hm, trim);
  streaks(g, w, h, 10, seed + 5, 0.12, 80, '60,42,28');
}

// ======================================================================================================
// Santa Maria di Porto Salvo: front = the 16.2 m run (w49772133 outline edge from (577.8,-289.1) to (562,-292.7)), looking onto the street; the return to the east turns away
const PS = { id: 'w49772133', p: [562, -292.7, 564.9, -302.8, 566.1, -307.2, 567.7, -313.6, 579.5, -310.6, 583.5, -309.6, 591.2, -296.1, 577.8, -289.1], mid: [569.9, -290.9], n: [-0.222, 0.975] };
const PS_W = 16.2, PS_H = 14.8, PS_E = 14.0;
function paintPsFront(g, w, h) {
  const { R, poly, X, Y, sx, sy } = tools(g, w, h, PS_W, PS_H), ST = '#bd9d6c', LT = '#cfb083', DK = '#9a7d54';
  stone(g, w, h, PS_W, PS_H, '#b99a6a', '#8a7049', 9101);
  R(-8.1, 0, 8.1, 0.9, '#8d7753');
  for (const x of [-7.6, -2.9, 2.9, 7.6]) { R(x - 0.45, 0.9, x + 0.45, 8.9, LT); R(x + 0.3, 0.9, x + 0.45, 8.9, 'rgba(60,40,20,0.3)'); R(x - 0.62, 8.4, x + 0.62, 8.95, DK); R(x - 0.38, 10.8, x + 0.38, 13.7, LT); R(x - 0.5, 13.3, x + 0.5, 13.7, DK); }
  for (const x of [-5.45, 0, 5.45]) {
    R(x - 0.95, 5.0, x + 0.95, 8.1, LT); R(x - 0.62, 5.3, x + 0.62, 7.8, '#221a14');
    for (const gy of [6.0, 6.7, 7.4]) R(x - 0.6, gy, x + 0.6, gy + 0.06, '#6b5a44'); R(x - 0.03, 5.3, x + 0.03, 7.8, '#6b5a44');
    R(x - 1.2, 7.9, x + 1.2, 8.4, DK); R(x - 1.1, 5.0, x + 1.1, 5.2, DK);
    R(x - 0.8, 10.8, x + 0.8, 13.1, LT); R(x - 0.55, 11.0, x + 0.55, 12.8, '#6e3a2a'); R(x - 0.03, 11.0, x + 0.03, 12.8, '#3a2018'); R(x - 0.9, 10.8, x + 0.9, 11.5, 'rgba(30,26,22,0.55)');
    for (let k = -0.8; k <= 0.8; k += 0.2) R(x + k - 0.02, 10.8, x + k + 0.02, 11.5, '#1c1a18'); R(x - 0.9, 13.0, x + 0.9, 13.3, DK);
  }
  R(-1.45, 0.9, 1.45, 3.7, LT); R(-1.1, 0.9, 1.1, 3.4, '#6a2a20'); R(-0.03, 0.9, 0.03, 3.4, '#3a1812');
  for (const y of [1.6, 2.4]) { R(-1.0, y, -0.1, y + 0.6, 'rgba(0,0,0,0.14)'); R(0.1, y, 1.0, y + 0.6, 'rgba(0,0,0,0.14)'); }
  poly([[-1.9, 3.7], [0, 5.0], [1.9, 3.7]], LT); poly([[-1.3, 3.8], [0, 4.6], [1.3, 3.8]], '#a98c62');
  R(-8.1, 10.15, 8.1, 10.8, DK); R(-8.1, 10.15, 8.1, 10.25, 'rgba(255,240,205,0.3)');
  R(-8.1, 13.7, 8.1, 14.8, DK); R(-8.1, 14.5, 8.1, 14.8, LT); for (let x = -8.0; x < 8.0; x += 0.5) R(x, 14.0, x + 0.28, 14.35, '#7e6540');
  for (const y of [10.15, 13.7]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(40,28,15,0.32)'); gs.addColorStop(1, 'rgba(40,28,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sy); }
  finish(g, w, h, PS_H, 9102);
}
function buildPs() {
  initShared();
  const S = setup(PS.p, PS.mid, PS.n), { F, y0 } = S, gr = groundRange(S.pts), hw = PS_W / 2;
  defMat('bjPsFront', 384, 352, [PS_W, PS_H], paintPsFront);
  defMat('bjPsWall', 128, 256, [4.5, PS_E], (g, w, h) => paintBay(g, w, h, PS_E, '#b3946a', '#86704a', 9111, [[5.1, 7.7], [11.0, 12.8]], '#c5a678'));
  begin(y0);
  prism('bjPsWall', S.clip(-0.1), Math.min(gr.lo, y0) - 1.5, y0 + PS_E, { uvo: [0, -y0 / PS_E] });
  prism('flat', S.clip(-0.1), y0 + PS_E, y0 + PS_E + 0.12, { c: '#8e857a' });
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, PS_H); sh.lineTo(-hw, PS_H); sh.lineTo(-hw, 0);
  extrude('bjPsFront', sh, 0.9, { M: mul(F, tr(0, 0, -0.95)), uv: 'keep', uvk: [1 / PS_W, 1 / PS_H], uvo: [0.5, 0], noao: true });
  const C = { c: '#b89a6c', noao: true };
  bx('flat', F, -hw - 0.15, hw + 0.15, 10.1, 10.25 + 0.1, -0.95, 0.5, C);
  bx('flat', F, -hw - 0.2, hw + 0.2, 14.35, 14.8, -0.95, 0.7, { c: '#c0a273', noao: true });
  for (const x of [-7.6, -2.9, 2.9, 7.6]) { bx('flat', F, x - 0.45, x + 0.45, 0.9, 8.4, -0.05, 0.28, C); bx('flat', F, x - 0.35, x + 0.35, 10.8, 13.3, -0.05, 0.2, C); }
  for (const x of [-5.45, 0, 5.45]) { bx('flat', F, x - 1.2, x + 1.2, 7.9, 8.3, -0.05, 0.4, C); bx('flat', F, x - 1.0, x + 1.0, 4.95, 5.15, -0.05, 0.3, C); bx('flat', F, x - 0.95, x + 0.95, 10.4, 10.8, -0.05, 0.7, { c: '#a98c62', noao: true }); }
  bx('flat', F, -1.9, 1.9, 3.6, 3.85, -0.05, 0.45, C); bx('flat', F, -1.4, 1.4, 3.85, 4.4, -0.05, 0.3, C);
  const o = end('Santa Maria di Porto Salvo');
  o.userData.solids = [[PS.p, null, y0 + PS_H]];
  return o;
}

// ======================================================================================================
// Chiesa dei Santi Pietro e Paolo: front = the 16.1 m run on the street to the north-west (w278802914)
const PP = { id: 'w278802914', p: [-127.4, -778.4, -119.2, -762.8, -115.3, -755.2, -129.5, -747.8, -131.4, -751.4, -141.7, -771], mid: [-134.6, -774.7], n: [-0.46, -0.888] };
const PP_W = 16.1, PP_H = 15.6, PP_AE = 8.2, PP_AI = 10.8, PP_NH = 12.8, PP_NW = 4.3, PP_E = 8.0;
function paintPpFront(g, w, h) {
  const { R, pnt, circ, poly, X, Y, sx, sy } = tools(g, w, h, PP_W, PP_H), HONEY = '#d0a25c', LT = '#e6d8b8', MID = '#dcc08a';
  stone(g, w, h, PP_W, PP_H, HONEY, '#b0824a', 9201, 0.45, 1.0);
  for (const s of [-1, 1]) { R(s * PP_NW - 0.25, 0, s * PP_NW + 0.25, PP_NH, MID); R(s * 7.85 - 0.25, 0, s * 7.85 + 0.25, PP_AE, MID); }
  // frieze of small pointed arches under the aisle slopes, the nave base and the gable, with the inscription band over it
  const band = (a, b, th) => { poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + th], [a[0], a[1] + th]], '#b08a58'); };
  const arcs = (x0, y0, x1, y1) => { const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.62)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; g.fillStyle = 'rgba(60,40,20,0.5)'; g.beginPath(); g.arc(X(x), Y(y - 0.12), 0.24 * sx, 0, PI); g.fill(); g.fillStyle = '#e2cfa0'; g.beginPath(); g.arc(X(x), Y(y - 0.06), 0.22 * sx, 0, PI); g.fill(); } };
  for (const s of [-1, 1]) { band([s * 8.05, PP_AE - 0.8], [s * PP_NW, PP_AI - 0.8], 0.6); arcs(s * 7.9, PP_AE - 0.8, s * PP_NW, PP_AI - 0.8); arcs(s * PP_NW, PP_NH - 0.1, 0, PP_H - 0.1); }
  band([-PP_NW, 10.0], [PP_NW, 10.0], 0.7); arcs(-PP_NW, 10.0, PP_NW, 10.0);
  g.fillStyle = 'rgba(70,50,30,0.55)'; for (let x = -3.9; x < 3.9; x += 0.34) g.fillRect(X(x), Y(10.55), 0.14 * sx, 0.28 * sy);
  // the portals: hood, striped archivolt, dark leaf
  const portal = (x, hw, top, door, tt) => {
    pnt(x, 0, top + 0.5, hw * 2, LT); pnt(x, 0, top, hw * 2 - 0.5, '#d9b36c');
    g.save(); g.beginPath(); const r = hw - 0.25, ys = top - 1.3 * r; g.moveTo(X(x - r), Y(0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(ys + r * 1.05), X(x), Y(top)); g.quadraticCurveTo(X(x + r), Y(ys + r * 1.05), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(0)); g.clip();
    g.strokeStyle = '#efe6d0'; g.lineWidth = 0.32 * sx; for (let a = 0.15; a < PI; a += 0.19) { g.beginPath(); g.moveTo(X(x), Y(top - 1.8 * r)); g.lineTo(X(x + Math.cos(a) * 5), Y(top - 1.8 * r + Math.sin(a) * 5)); g.stroke(); } g.restore();
    pnt(x, 0, tt, door, '#3f2a1c'); R(x - 0.03, 0, x + 0.03, tt - 1.2, '#241810');
  };
  portal(0, 2.7, 5.2, 2.9, 4.2); portal(-5.6, 1.9, 3.9, 1.7, 3.0); portal(5.6, 1.9, 3.9, 1.7, 3.0);
  R(-2.9, 0, 2.9, 0.12, '#b79058');
  poly([[0, 6.2], [0.6, 6.8], [0, 7.4], [-0.6, 6.8]], '#e0d4b6'); poly([[0, 6.4], [0.4, 6.8], [0, 7.2], [-0.4, 6.8]], '#a99a7a');
  for (const x of [-5.3, 5.3]) { circ(x, 6.6, 1.0, LT); circ(x, 6.6, 0.8, '#c9a666'); g.strokeStyle = '#e8dcc0'; g.lineWidth = 0.1 * sx; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(X(x), Y(6.6)); g.lineTo(X(x + Math.cos(a * 1.05) * 0.78), Y(6.6 + Math.sin(a * 1.05) * 0.78)); g.stroke(); } }
  // the bifora in the nave wall under a striped hood
  pnt(0, 10.7, 13.3, 3.0, LT); pnt(0, 10.7, 13.0, 2.5, '#d9b36c'); g.save(); g.globalAlpha = 0.9; g.strokeStyle = '#efe6d0'; g.lineWidth = 0.26 * sx; for (let a = 0.3; a < 2.9; a += 0.3) { g.beginPath(); g.moveTo(X(0), Y(11.7)); g.lineTo(X(Math.cos(a) * 1.4), Y(11.7 + Math.sin(a) * 1.4)); g.stroke(); } g.restore();
  pnt(0, 10.7, 12.3, 1.9, LT);
  for (const s of [-1, 1]) pnt(s * 0.42, 10.7, 12.0, 0.6, '#231c16'); R(-0.06, 10.7, 0.06, 11.6, LT); circ(0, 12.4, 0.2, '#231c16');
  // gable top cap
  R(-0.5, PP_H - 0.5, 0.5, PP_H, '#c9ab70');
  finish(g, w, h, PP_H, 9202);
}
function buildPp() {
  initShared();
  const S = setup(PP.p, PP.mid, PP.n), { F, y0 } = S, gr = groundRange(S.pts), hw = PP_W / 2;
  defMat('bjPpFront', 384, 372, [PP_W, PP_H], paintPpFront);
  defMat('bjPpWall', 128, 256, [4.5, PP_NH], (g, w, h) => paintBay(g, w, h, PP_NH, '#c99c58', '#a97c46', 9211, [[2.8, 6.2, true], [9.0, 12.0, true]], '#dcc08a'));
  begin(y0);
  prism('bjPpWall', S.clip(-0.1), Math.min(gr.lo, y0) - 1.5, y0 + PP_E, { uvo: [0, -y0 / PP_NH] });
  prism('flat', S.clip(-0.1), y0 + PP_E, y0 + PP_E + 0.12, { c: '#a6552f' });
  const len = Math.min(S.fit(-PP_NW, PP_NW), 40), top = [];
  if (len > 8) {
    bx('bjPpWall', F, -PP_NW, PP_NW, PP_E, PP_NH, -len, -1.0, { uvo: [0, -y0 / PP_NH] });
    gable('tile', 'bjPpWall', mul(F, tr(0, 0, -(len + 1) / 2)), PP_NW * 2, len - 1, y0 + PP_NH - y0, 2.8, { ov: 0.3, c: '#b8744f', wc: '#c99c58' });
    top.push([S.ring(-PP_NW, PP_NW, -len, -1.0), null, y0 + PP_NH + 2.8]);
  }
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, PP_AE); sh.lineTo(PP_NW, PP_AI); sh.lineTo(PP_NW, PP_NH); sh.lineTo(0, PP_H); sh.lineTo(-PP_NW, PP_NH); sh.lineTo(-PP_NW, PP_AI); sh.lineTo(-hw, PP_AE); sh.lineTo(-hw, 0);
  extrude('bjPpFront', sh, 0.9, { M: mul(F, tr(0, 0, -0.95)), uv: 'keep', uvk: [1 / PP_W, 1 / PP_H], uvo: [0.5, 0], noao: true });
  const C = { c: '#dcc08a', noao: true };
  for (const s of [-1, 1]) { bx('flat', F, s * PP_NW - 0.25, s * PP_NW + 0.25, 0, PP_NH - 0.1, -0.05, 0.2, C); bx('flat', F, s * 7.85 - 0.25, s * 7.85 + 0.25, 0, PP_AE - 0.8, -0.05, 0.2, C); }
  bx('flat', F, -1.0, 1.0, 5.4, 5.7, -0.05, 0.4, { c: '#e6d8b8', noao: true });
  bx('flat', F, -0.12, 0.12, PP_H, PP_H + 1.4, -0.4, -0.1, { c: '#7a6e5c', noao: true }); bx('flat', F, -0.45, 0.45, PP_H + 0.7, PP_H + 0.85, -0.4, -0.1, { c: '#7a6e5c', noao: true });
  const o = end('Chiesa dei Santi Pietro e Paolo');
  o.userData.solids = [[PP.p, null, y0 + PP_E], ...top];
  return o;
}

// ======================================================================================================
// Santa Croce (the Anglican church of the Holy Cross, Via Roma): front = the 11.5 m gable end on the west side (w49786083), tower at the left
const CR = { id: 'w49786083', p: [-128.2, -880.7, -106.9, -891.5, -101.6, -881.3, -123, -870.4], mid: [-125.6, -875.5], n: [-0.893, 0.451] };
const CR_W = 11.5, CR_H = 13.2, CR_TX = -3.35, CR_GX = 1.2, CR_EV = 6.4, CR_AP = 12.0, CR_E = 4.6, CR_SP = 3.8;
function paintCrFront(g, w, h) {
  const { R, arch, circ, poly, X, Y, sx, sy } = tools(g, w, h, CR_W, CR_H), LT = '#e6d09c', DK = '#b8985a';
  stone(g, w, h, CR_W, CR_H, '#d8b878', '#b4945a', 9301, 0.4, 0.9);
  R(-5.75, 0, 5.75, 0.6, '#a58a56');
  // tower: string courses, a slit window, the belfry opening
  R(-5.75, 4.5, CR_TX, 4.7, DK); R(-5.75, 9.2, CR_TX, 9.4, DK); R(-5.75, 12.8, CR_TX, 13.2, LT);
  R(-4.75, 5.8, -4.35, 7.8, '#231c16'); arch(-4.55, 10.0, 12.6, 0.9, LT); arch(-4.55, 10.1, 12.5, 0.7, '#2a2420'); R(-4.9, 10.6, -4.2, 10.7, DK);
  // the gable: round-arched windows with hoods, a string course, the rose window, the slit above it
  for (const k of [-1.5, 0, 1.5]) { arch(CR_GX + k, 1.8, 4.1, 1.15, LT); arch(CR_GX + k, 1.9, 3.95, 0.8, '#2a2c33'); R(CR_GX + k - 0.03, 1.9, CR_GX + k + 0.03, 3.4, DK); }
  R(CR_TX, 4.6, 5.75, 4.8, DK);
  const ry = 6.8; circ(CR_GX, ry, 1.65, LT); circ(CR_GX, ry, 1.45, '#232a33'); g.strokeStyle = '#e3d3a6'; g.lineWidth = 0.1 * sx;
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(CR_GX + Math.cos(a) * 0.35), Y(ry + Math.sin(a) * 0.35)); g.lineTo(X(CR_GX + Math.cos(a) * 1.45), Y(ry + Math.sin(a) * 1.45)); g.stroke(); }
  for (const r of [0.75, 1.15]) { g.beginPath(); g.arc(X(CR_GX), Y(ry), r * sx, 0, 2 * PI); g.stroke(); } circ(CR_GX, ry, 0.3, LT);
  arch(CR_GX, 9.6, 11.0, 0.45, '#231c16');
  // small door at the right with a hood
  arch(4.7, 0.6, 2.7, 1.3, LT); arch(4.7, 0.6, 2.55, 0.95, '#3c281a');
  for (const [x0, x1] of [[CR_TX, CR_GX]]) { const gs = g.createLinearGradient(0, Y(4.6), 0, Y(3.0)); gs.addColorStop(0, 'rgba(50,35,20,0.22)'); gs.addColorStop(1, 'rgba(50,35,20,0)'); g.fillStyle = gs; g.fillRect(0, Y(4.6), w, 1.6 * sy); }
  finish(g, w, h, CR_H, 9302, '70,50,30');
}
function buildCr() {
  initShared();
  const S = setup(CR.p, CR.mid, CR.n), { F, y0 } = S, gr = groundRange(S.pts), hw = CR_W / 2, WH = CR_EV;
  defMat('bjCrFront', 320, 352, [CR_W, CR_H], paintCrFront);
  defMat('bjCrWall', 128, 192, [4.5, WH], (g, w, h) => paintBay(g, w, h, WH, '#d4b574', '#b09056', 9311, [[1.9, 4.5, true]], '#e0c88e'));
  begin(y0);
  prism('bjCrWall', S.clip(-0.1), Math.min(gr.lo, y0) - 1.5, y0 + CR_E, { uvo: [0, -y0 / WH] });
  prism('flat', S.clip(-0.1), y0 + CR_E, y0 + CR_E + 0.12, { c: '#a6552f' });
  const top = [], len = Math.min(S.fit(CR_TX, hw), 40), hn = (hw - CR_TX) / 2;
  if (len > 8) {
    bx('bjCrWall', F, CR_TX, hw, CR_E, CR_EV, -len, -1.0, { uvo: [0, -y0 / WH] });
    gable('tile', 'bjCrWall', mul(F, tr(CR_GX, 0, -(len + 1) / 2)), hn * 2, len - 1, CR_EV, CR_AP - CR_EV, { ov: 0.3, c: '#b8744f', wc: '#d4b574' });
    top.push([S.ring(CR_TX, hw, -len, -1.0), null, y0 + CR_AP]);
  }
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, CR_EV); sh.lineTo(CR_GX, CR_AP); sh.lineTo(CR_TX, CR_EV); sh.lineTo(CR_TX, CR_H); sh.lineTo(-hw, CR_H); sh.lineTo(-hw, 0);
  extrude('bjCrFront', sh, 0.9, { M: mul(F, tr(0, 0, -0.95)), uv: 'keep', uvk: [1 / CR_W, 1 / CR_H], uvo: [0.5, 0], noao: true });
  bx('bjCrWall', F, -hw, CR_TX, 0, CR_H, -2.5, -0.9, { uvo: [0, -y0 / WH] });
  bx('flat', F, -hw - 0.1, CR_TX + 0.1, CR_H - 0.4, CR_H, -2.6, 0.1, { c: '#e0c88e', noao: true });
  const tc = mul(F, tr((-hw + CR_TX) / 2, CR_H, -1.35));
  cone('tufa', 1.38, CR_SP, 8, { M: tc, c: '#d9bd84' });
  bx('flat', tc, -0.05, 0.05, CR_SP, CR_SP + 1.0, -0.05, 0.05, { c: '#4a4036', noao: true }); bx('flat', tc, -0.3, 0.3, CR_SP + 0.55, CR_SP + 0.65, -0.05, 0.05, { c: '#4a4036', noao: true });
  const o = end('Santa Croce (chiesa anglicana)');
  o.userData.solids = [[CR.p, null, y0 + CR_E], ...top, [S.ring(-hw, CR_TX, -2.5, 0), null, y0 + CR_H + CR_SP]];
  return o;
}

const mk = (name, D, build) => { const c = centre(D.p); return { name, x: c[0], z: c[1], radius: 40, skipIds: [D.id], build }; };
export const BATCH_J = [
  mk('Santa Maria di Porto Salvo', PS, buildPs),
  mk('Chiesa dei Santi Pietro e Paolo', PP, buildPp),
  mk('Santa Croce (chiesa anglicana)', CR, buildCr),
];
