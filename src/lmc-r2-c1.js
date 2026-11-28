// Round 2 landmarks, batch C1: six churches of the old town that were drawn by the generic church builder. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Positions come from the footprints and the 2013 regional orthophoto; heights from the baked LiDAR heights and proportions read off the photos,
// so treat sizes on the fronts as good to about a metre.
// Each church: frame F with the origin on the ground in the front, +z out of the front, local x along the front (right as seen from outside). One painted texture each, plus the shared flat and plaster.
//
// Chiesa di San Francesco di Paola (w278805151, with w278800717 under the tower). Front to the south on Piazza San Francesco di Paola. Wikimedia Commons "Chiesa di San Francesco di Paola (Palermo) -
//  Esterno", "Esterno1", "Esterno2" (2013), "San Francesco di Paola (Palermo) 09 07 2022 01" and "02", "Palermo - Chiesa di Sant'Oliva - 2023-09-12 18-37-42 001" and "18-37-54 001"; Mapillary 2658975411064530.
//  Read: salmon cream plaster with golden ashlar pilasters; a curved gable with a cross and two finials; three round headed windows with white balustrades; a framed window; two statue niches; a white
//  marble portal with a broken pediment, a blue CHARITAS badge and a statue; a square tufa tower on the right with a belfry arch and bell, a balustrade, a many sided cap with small dormers and a vane.
//  Not drawn: the iron fence of the forecourt, the trees and the kiosk. Not verified: the back, the roofs, the lower left bay behind the trees, the sides.
//  The convent block beside it (x46331, one footprint) stays generic and stands higher behind the left bay than the wing in the photos.
// Chiesa dell'Immacolata Concezione al Capo (w143735554), Via Porta Carini. Front to the east north east. One exterior photo, from below and at an angle: Commons "Chiesa dell'Immacolata Concezione al Capo
//  (Palermo) - Facciata" (2013). Read: two orders of salmon stone with paired pilasters and white strips between them; a heavy middle cornice; a great arched window cut by two mullions, a small framed
//  window under it and white blank panels; a pediment and a plain raised gable. The foot of the front is hidden in that photo: the portal (stone frame, broken pediment, cherub head) follows written
//  descriptions on Italian web pages about the church and is drawn plain. Not verified: the lower order, the flanks and the back.
// Santa Maria di Monte Oliveto, Badia Nuova (w279883975), behind the apse of the cathedral. Front to the south south east. Commons "Chiesa della Madonna del Monte Oliveto (Palermo) - facciata1" and
//  "facciata2" (2013), "Palermo-Chiesa della Madonna di Monte Oliveto" (2016), "Cathedral (Palermo) 21 06 2026 44" and "45". Read: ochre stone frames on white plaster in two orders; a grey marble portal
//  with two free columns, a broken pediment and a coat of arms; the Madonna in a shell niche; four framed windows with iron grilles; a round window; lozenges and scrolls; stone balls and a cross; the tall
//  yellow tower block behind with its row of arched openings. Not verified: the back and the east side of the tower block.
// Chiesa di Santa Chiara (w279886240), Piazza Santa Chiara. Front to the west. Commons "Santa Chiara - Facciata" (2018), "SC (Palermo) 14 07 2019 01" and "02", "Palermo. Chiesa di Santa Chiara" (2014).
//  Read: pale plaster between golden stone corners; a round window; an ochre portal with a broken curved pediment and a small shrine on it; steps (drawn shallower than they are, clear of the parked cars); a buttress with a pointed cap; the carved stone bell tower
//  on the north side with three tiers of arches and iron cages on the top one; the pink apse with two half round windows; a red dome with a lantern. Not verified: the north flank, the exact tower plan.
// San Giovanni dei Napoletani (w279888250), corner of Via Vittorio Emanuele and Piazza Marina. Commons "San Giovanni dei Napoletani (Palermo) 14 07 2019 01" and "02", "Palermo - Chiesa di San Giovanni
//  dei Napoletani - 2024-07-16 20-09-05 001" and "002", "Steri PA 06 04 2019 24" and "25" (dome). Read: the three sided end on the Corso: blind arches in brown tufa, a tall arched entrance with an iron
//  gate between two narrow arched openings, a deep ledge with iron balconies, a yellow upper storey with pilasters, framed red doors and a cornice; the blue and white tiled dome on an eight sided drum.
//  Not verified: the long sides (they are covered by the neighbouring footprints), the roof round the dome.
// Oratorio di San Lorenzo (w233500615, with the courtyard wall w1499547079), Via Immacolatella. The oratory is known for its inside; outside there is only the street door into the courtyard.
//  art-crime.blogspot.com, July 2015, "The street entrance to the Oratorio San Lorenzo"; Commons "OSL (Palermo) 16 07 2019 26" (courtyard). Read: an orange rendered wall, a moulded door frame, a panelled
//  wooden door standing open on steps, a round dark red sign, a round bronze plate, a house number, damp at the foot. Not verified: where along the wall the door stands, every other wall of the hall
//  (left plain in the same orange) and the roof.
import * as THREE from 'three';
import { PI, bx, cyl, extrude, prism, lathe, sphere, part, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue, pyramid, RNG } from './lmc-kit.js';

// ---- shared helpers
// the site of one church: footprint, frame (origin O on the front, outward normal N), the ground
function site(flat, O, N) {
  const pts = pairsOf(flat);
  const W = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const L = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
  const loc = pts.map(L);
  // the footprint kept behind z = zmax, as world points
  const behind = (zmax) => { const out = []; for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out.map(q => W(q[0], q[1])); };
  const y0 = Math.min(groundY(...W(-4, 0.6)), groundY(...W(0, 0.6)), groundY(...W(4, 0.6))), lo = Math.min(groundRange(pts).lo, y0) - 1.5;
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  return { pts, W, L, behind, y0, lo, F, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
// painter for a canvas that covers x0..x0+FW metres across and 0..FH up
function pen(g, w, h, x0, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x - x0) * sx, Y = y => h - y * sy;
  const R = (a, y0, b, y1, c) => { g.fillStyle = c; g.fillRect(X(a), Y(y1), (b - a) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, ww, c, rise) => { const r = ww / 2, v = rise === undefined ? r : rise; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - v)); g.ellipse(X(x), Y(y1 - v), r * sx, v * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, (ry || r) * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (a, y0, b, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(a), Y(y0)); g.lineTo(X(b), Y(y1)); g.stroke(); };
  // ashlar courses inside a rectangle
  const ashlar = (a, y0, b, y1, c, seed, course = 0.5, block = 1.1) => {
    R(a, y0, b, y1, c); const r = RNG(seed);
    for (let y = y0, j = 0; y < y1 - 0.01; y += course, j++) {
      let x = a - r() * block;
      while (x < b) { const bw = block * (0.7 + r() * 0.6), l = Math.max(a, x), rr = Math.min(b, x + bw); if (rr > l) { const k = r(); R(l, y, rr, Math.min(y1, y + course), k < 0.5 ? `rgba(60,38,18,${k * 0.22})` : `rgba(255,236,200,${(k - 0.5) * 0.22})`); R(l, y, l + 0.05, Math.min(y1, y + course), 'rgba(70,48,26,0.3)'); } x += bw; }
      R(a, y, b, y + 0.05, 'rgba(70,48,26,0.32)');
    }
  };
  // a ledge: light top, shadow under it
  const ledge = (a, y0, b, y1, c) => { R(a, y0, b, y1, c); R(a, y1 - 0.14, b, y1, 'rgba(255,245,225,0.35)'); R(a, y0 - 0.28, b, y0, 'rgba(55,35,20,0.32)'); };
  // an upright strip with a lit and a shaded edge
  const strip = (a, y0, b, y1, c) => { R(a, y0, b, y1, c); R(a, y0, a + 0.09, y1, 'rgba(255,245,225,0.3)'); R(b, y0, b + 0.14, y1, 'rgba(55,35,20,0.3)'); };
  const grille = (a, y0, b, y1, c, step = 0.32) => { for (let x = a; x <= b + 0.01; x += step) R(x - 0.03, y0, x + 0.03, y1, c); for (let y = y0; y <= y1 + 0.01; y += step) R(a, y - 0.03, b, y + 0.03, c); };
  return { g, sx, sy, X, Y, R, poly, arch, circ, line, ashlar, ledge, strip, grille };
}
const base = (g, w, h, c, seed, a = 0.08) => { g.fillStyle = c; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, seed, [`rgba(90,65,40,${a})`, 'rgba(255,248,232,0.09)']); };
// wear: soft stains, streaks, grime at the foot (foot = share of the canvas height)
function wear(g, w, h, seed, n, foot = 0.14, a = 0.1) {
  const r = RNG(seed);
  for (let i = 0; i < 7; i++) { const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.2) * Math.max(w, h), k = r() < 0.6 ? '60,42,25' : '255,246,225', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${k},${a * (0.6 + r() * 0.6)})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, a * 1.2, h * 0.16, '60,46,32');
  if (foot > 0) { const gb = g.createLinearGradient(0, h, 0, h * (1 - foot)); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, h * (1 - foot), w, h * foot); }
}
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// a flat coloured solid from a 2D outline, in the frame M, from z0 to z1
const slab = (M, p, z0, z1, c) => extrude('flat', shapeOf(p), z1 - z0, { M, p: [0, 0, z0], c, noao: true });
// a painted face: the outline p textured with the canvas T = [x0, FW, FH] at the same metres, shifted by ox
const face = (key, T, M, p, z0, z1, ox = 0) => extrude(key, shapeOf(p), z1 - z0, { M, p: [0, 0, z0], uv: 'keep', uvk: [1 / T[1], 1 / T[2]], uvo: [(ox - T[0]) / T[1], 0], noao: true });
const B = (M, x0, x1, y0, y1, z0, z1, c) => bx('flat', M, x0, x1, y0, y1, z0, z1, { c, noao: true });
const cross = (M, x, y, z, h, c = '#4a4036') => { B(M, x - 0.06, x + 0.06, y, y + h, z - 0.06, z + 0.06, c); B(M, x - h * 0.28, x + h * 0.28, y + h * 0.62, y + h * 0.62 + 0.12, z - 0.06, z + 0.06, c); };
const finial = (M, x, y, z, h, c) => { B(M, x - h * 0.28, x + h * 0.28, y, y + h * 0.3, z - h * 0.28, z + h * 0.28, c); pyramid('flat', h * 0.42, h * 0.42, h * 0.7, { M, p: [x, y + h * 0.3, z], c, noao: true }); };
// a ring or an arc of moulding standing on the wall
const arc = (M, x, y, z, R, r, c, a = 2 * PI, from = 0, seg = 10) => part('flat', new THREE.TorusGeometry(R, r, 3, seg, a), { M, p: [x, y, z], rz: from, c, noao: true });
const flatRoof = (pts, y, c = '#9a948a') => prism('flat', pts, y, y + 0.14, { c, noao: true });
// a dome: rows of a half ellipse of radius r and rise h standing on y in the frame M; colour(i, j) picks one of cols
function dome(M, r, h, y, cols, pick, seg = 16, rows = 5) {
  const P = []; for (let i = 0; i <= rows; i++) { const a = i / rows * PI / 2, rr = Math.max(0.02, r * Math.cos(a)), row = []; for (let j = 0; j < seg; j++) { const t = j / seg * 2 * PI; row.push([rr * Math.sin(t), y + h * Math.sin(a), rr * Math.cos(t)]); } P.push(row); }
  cols.forEach((c, k) => gridMesh('flat', P, () => [0, 0], { wrap: true, skip: (i, j) => pick(i, j) !== k, M, c, noao: true }));
}
// a convex face through the points, turned so that it looks the way of `to`
function flatFace(M, pts, to, c) {
  const A = new THREE.Vector3(...pts[0]), n = new THREE.Vector3(...pts[1]).sub(A).cross(new THREE.Vector3(...pts[2]).sub(A)).normalize(), P = n.dot(new THREE.Vector3(...to)) < 0 ? pts.slice().reverse() : pts;
  if (n.dot(new THREE.Vector3(...to)) < 0) n.negate();
  const pos = [], nor = [], uv = []; for (let i = 1; i < P.length - 1; i++) for (const q of [P[0], P[i], P[i + 1]]) { pos.push(...q); nor.push(n.x, n.y, n.z); uv.push(0, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  part('flat', g, { M, c, uv: 'keep', noao: true });
}
// a two sided roof on the four corners q = [front left, front right, back right, back left] ([x, z] local) with its ridge running back, and the two gable ends
function roof(M, q, y, rise, c, wc) {
  const [a, b, d, e] = q.map(p => [p[0], y, p[1]]), f = [(a[0] + b[0]) / 2, y + rise, a[2]], k = [(d[0] + e[0]) / 2, y + rise, e[2]];
  flatFace(M, [a, f, k, e], [-1, 2, 0], c); flatFace(M, [f, b, d, k], [1, 2, 0], c); flatFace(M, [a, b, f], [0, 0, 1], wc); flatFace(M, [e, d, k], [0, 0, -1], wc);
}
// the outline of a round headed opening: width ww, from y0, springing at y1, rising r above it
const headed = (x, y0, y1, ww, r = ww / 2) => [[x - ww / 2, y0], [x + ww / 2, y0], ...Array.from({ length: 5 }, (_, i) => { const a = i / 4 * PI; return [x + Math.cos(a) * ww / 2, y1 + Math.sin(a) * r]; })];
// wall segments along a local outline
const outline = (O, N, L) => { const P = L.map(([x, z]) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]]); return P.slice(1).map((b, i) => [...P[i], ...b]); };

// =====================================================================================================
// San Francesco di Paola
// =====================================================================================================
const FP = { id: 'w278805151', id2: 'w278800717', p: [-740.2, -686.2, -734.5, -685.5, -730.3, -684.9, -733.0, -668.3, -733.3, -666.2, -733.5, -665.1, -739.3, -666.0, -740.3, -659.6, -744.2, -660.1], p2: [-739.3, -666.0, -733.5, -665.1, -734.5, -658.9, -740.3, -659.6], O: [-742.2, -659.85], N: [-0.124, 0.992] };
const FPT = [-7.4, 19, 23], FPA = '#c9a470', FPW = '#e4ded2';
function fpPaint(g, w, h) {
  const p = pen(g, w, h, FPT[0], FPT[1], FPT[2]), { R, arch, circ, line, poly, ashlar, ledge, strip, grille } = p;
  base(g, w, h, '#ddbd9e', 12101);
  R(-7.4, 0, 6.8, 1.5, '#b7a58d'); R(-7.4, 1.4, 6.8, 1.55, '#d0c2aa');
  // golden pilasters, cornices
  for (const [a, b, top] of [[-7.4, -6.75, 14], [-4.95, -3.9, 17.3], [3.9, 4.95, 17.3]]) { ashlar(a, 1.5, b, top, FPA, 12102 + Math.round(a), 0.48, 1.3); R(b, 1.5, b + 0.14, top, 'rgba(60,40,20,0.3)'); }
  ledge(-3.9, 9.75, 3.9, 10.1, FPA); ledge(-7.4, 13.55, 6.8, 14.05, '#bf9a6c'); ledge(-4.95, 16.95, -3.1, 17.35, '#bf9a6c'); ledge(3.1, 16.95, 4.95, 17.35, '#bf9a6c');
  R(-7.4, 14.9, -4.95, 15.1, 'rgba(120,85,50,0.25)');
  // the curved gable edge
  g.strokeStyle = '#b8946a'; g.lineWidth = 0.34 * p.sx; g.beginPath(); g.moveTo(p.X(-3.15), p.Y(17.2)); g.bezierCurveTo(p.X(-2.5), p.Y(18.95), p.X(2.5), p.Y(18.95), p.X(3.15), p.Y(17.2)); g.stroke();
  // three arched windows with white balustrades
  for (const [x, ww, y1] of [[0, 1.5, 17.1], [-2.35, 1.35, 16.35], [2.35, 1.35, 16.35]]) {
    arch(x, 14.15, y1 + 0.28, ww + 0.55, FPW); arch(x, 14.2, y1, ww, '#7c4a3a'); arch(x, 14.4, y1 - 0.18, ww - 0.3, '#c9ccc6');
    R(x - 0.04, 14.4, x + 0.04, y1 - 0.2, '#7c4a3a'); R(x - ww / 2, 15.75, x + ww / 2, 15.83, '#7c4a3a');
    R(x - ww / 2 - 0.08, 15.0, x + ww / 2 + 0.08, 15.14, '#efeade'); R(x - ww / 2 - 0.08, 14.15, x + ww / 2 + 0.08, 14.28, '#efeade'); for (let k = x - ww / 2; k <= x + ww / 2 + 0.01; k += 0.23) R(k - 0.045, 14.2, k + 0.045, 15.05, '#efeade');
  }
  // the framed window
  R(-1.35, 10.1, 1.35, 13.1, FPW); R(-1.55, 13.05, 1.55, 13.3, '#cfc6b6'); R(-1.55, 12.9, 1.55, 13.05, 'rgba(60,40,25,0.3)'); R(-0.8, 10.35, 0.8, 12.75, '#56707a'); R(-0.04, 10.35, 0.04, 12.75, '#aeb7b2'); R(-0.8, 11.9, 0.8, 11.97, '#aeb7b2');
  // niches and the barred windows under the side bays
  for (const x of [-5.85, 5.6]) { arch(x, 10.3, 12.9, 1.55, '#c09a68'); arch(x, 10.5, 12.65, 1.1, '#4a3a2c'); R(x - 0.9, 10.15, x + 0.9, 10.4, '#c9a874'); R(x - 0.85, 2.2, x + 0.85, 5.0, '#bda684'); R(x - 0.65, 2.4, x + 0.65, 4.8, '#3a3330'); grille(x - 0.65, 2.4, x + 0.65, 4.8, '#1f1b19'); }
  // portal: white marble surround, the bronze door frame standing open on the inner doors
  R(-2.35, 0, 2.35, 7.1, '#d9d4c8'); for (const s of [-1, 1]) { strip(s * 1.9 - 0.32, 0, s * 1.9 + 0.32, 6.2, '#e8e4da'); R(s * 1.9 - 0.45, 0, s * 1.9 + 0.45, 1.25, '#cbc5b8'); R(s * 1.9 - 0.17, 2.3, s * 1.9 + 0.17, 3.7, '#d2cdc0'); circ(s * 1.9, 3.0, 0.2, '#c2bcae', 0.5); circ(s * 1.9, 5.75, 0.22, '#b9ae9c'); }
  R(-1.4, 0, 1.4, 5.75, '#4f6b5d'); R(-1.1, 0, 1.1, 5.35, '#2c241d'); R(-0.75, 0, 0.75, 4.9, '#6e6250'); R(-0.72, 0.2, 0.72, 2.4, '#b9b3a2'); R(-0.03, 0.2, 0.03, 4.9, '#352c22'); for (const s of [-1, 1]) R(s * 0.35 - 0.22, 0.75, s * 0.35 + 0.22, 1.95, '#3b3530'); R(-1.2, 5.38, 1.2, 5.68, '#3d574a');
  circ(0, 6.55, 0.27, '#cdbfa8'); ledge(-2.5, 6.95, 2.5, 7.25, '#d3cbbb');
  for (const s of [-1, 1]) poly([[s * 2.5, 7.25], [s * 0.85, 7.95], [s * 0.85, 8.3], [s * 1.5, 8.2], [s * 2.5, 7.55]], '#c9c0ae');
  circ(0, 7.95, 0.55, '#4d9fc2'); g.fillStyle = '#eef3f0'; g.font = `bold ${Math.max(5, Math.round(0.28 * p.sy))}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; ['CHA', 'RI', 'TAS'].forEach((t, i) => g.fillText(t, p.X(0), p.Y(8.24 - i * 0.28)));
  // ---- the tower, x 6.8..11.6
  ashlar(6.8, 0, 11.6, 23, '#bd9d72', 12130, 0.46, 0.95);
  ledge(6.8, 10.8, 11.6, 11.3, '#b3946a'); ledge(6.8, 13.75, 11.6, 14.1, '#b3946a'); ledge(6.8, 18.45, 11.6, 19.0, '#a98b64');
  for (const x of [8.05, 10.35]) { R(x - 0.8, 11.55, x + 0.8, 13.45, '#a8895f'); R(x - 0.65, 11.7, x + 0.65, 13.3, '#c2a479'); }
  for (const a of [6.8, 11.05]) strip(a, 14.1, a + 0.55, 18.45, '#c7a97e');
  arch(9.2, 14.6, 18.0, 2.4, '#c9ac80'); arch(9.2, 14.7, 17.7, 1.8, '#2a221c');
  R(8.9, 16.4, 9.5, 16.65, '#6b5138'); poly([[8.65, 15.15], [9.75, 15.15], [9.5, 15.5], [9.45, 16.25], [8.95, 16.25], [8.9, 15.5]], '#4a4a40');
  R(8.2, 14.65, 10.2, 14.78, '#cdb186'); R(8.2, 14.15, 10.2, 14.3, '#cdb186'); for (let x = 8.3; x < 10.2; x += 0.24) R(x - 0.05, 14.25, x + 0.05, 14.7, '#cdb186');
  wear(g, w, h, 12103, 46, 0.12, 0.09);
}
function buildPaola() {
  initShared();
  const S = site(FP.p, FP.O, FP.N), { F, y0, at } = S;
  defMat('c1PaolaFront', 384, 448, [FPT[1], FPT[2]], fpPaint);
  begin(y0);
  prism('plaster', S.pts, S.lo, y0 + 9.9, { c: '#d9b99a' }); flatRoof(S.pts, y0 + 9.9, '#a8735a');
  // nave behind the front, with its tiled roof
  B(F, -4.45, 4.45, 9.9, 15.2, -25, -0.4, '#d3b294'); gable('flat', 'flat', at(0, 0, -12.9), 8.9, 24.4, 15.2, 2.6, { ov: 0.15, c: '#ab6c4e', wc: '#d3b294' });
  bx('plaster', F, -7.2, -4.45, -1.5, 14.0, -3, -0.3, { c: '#d9b99a' }); bx('plaster', F, 4.45, 6.7, -1.5, 14.0, -6.5, -0.3, { c: '#d9b99a' }); bx('plaster', F, 6.6, 10.0, -1.5, 10.6, -6.5, -4.7, { c: '#c9a87e' });
  // the front: side bays with their sweeping tops, the centre with the curved gable
  const top = [[6.8, 14.05], [6.2, 14.2], [5.4, 14.7], [4.95, 15.5], [4.95, 17.35], [3.15, 17.35]];
  for (let i = 1; i < 10; i++) { const t = i / 10, u = 1 - t; top.push([u * u * u * 3.15 + 3 * u * u * t * 2.5 - 3 * u * t * t * 2.5 - t * t * t * 3.15, (u * u * u + t * t * t) * 17.35 + 3 * u * t * 19.1]); }
  top.push([-3.15, 17.35], [-4.95, 17.35], [-4.95, 15.5], [-5.6, 14.7], [-6.5, 14.2], [-7.3, 14.05]);
  const F1 = at(0, 0, 0.1);   // the front stands just proud of the face of the convent block beside it
  face('c1PaolaFront', FPT, F1, [[-7.3, 0], [6.8, 0], ...top], -0.55, 0.02, 0);
  B(F1, -7.3, 6.8, -1.5, 0, -0.55, 0.02, '#8f8272');
  // relief: pilasters, cornices, the portal
  for (const s of [-1, 1]) { B(F1, s * 4.42 - 0.52, s * 4.42 + 0.52, 1.5, 13.55, 0.0, 0.14, '#bf9a68'); B(F1, s * 4.42 - 0.52, s * 4.42 + 0.52, 14.05, 16.95, 0.0, 0.12, '#c4a070'); finial(F1, s * 4.35, 17.35, -0.2, 1.15, '#b99c74'); B(F1, s * 4.03 - 1.0, s * 4.03 + 1.0, 17.02, 17.4, -0.4, 0.3, '#b8946a');
    B(F1, s * 1.9 - 0.34, s * 1.9 + 0.34, 0, 6.9, 0.02, 0.24, '#e2ddd2'); B(F1, s * 1.9 - 0.48, s * 1.9 + 0.48, 0, 1.2, 0.02, 0.34, '#cbc5b8');
    slab(F1, [[s * 2.55, 7.25], [s * 0.85, 7.95], [s * 0.85, 8.25], [s * 1.5, 8.18], [s * 2.55, 7.55]], 0.02, 0.38, '#d5cdbc');
  }
  B(F1, -7.35, 6.7, 13.6, 14.02, -0.1, 0.34, '#bd976a'); B(F1, -3.9, 3.9, 9.8, 10.08, -0.05, 0.2, '#c4a272'); B(F1, -2.55, 2.55, 6.95, 7.22, 0.0, 0.42, '#d8d1c2'); B(F1, -1.55, 1.55, 13.08, 13.3, 0.0, 0.26, '#d8d1c2');
  const g = []; for (let i = 0; i <= 12; i++) { const t = i / 12, u = 1 - t; g.push([-u * u * u * 3.15 - 3 * u * u * t * 2.5 + 3 * u * t * t * 2.5 + t * t * t * 3.15, (u * u * u + t * t * t) * 17.35 + 3 * u * t * 19.1]); }
  slab(F1, [...g.map(q => [q[0], q[1] + 0.14]), ...g.slice().reverse().map(q => [q[0], q[1] - 0.16])], -0.42, 0.26, '#b8946a');
  B(F1, -0.22, 0.22, 18.7, 19.0, -0.2, 0.2, '#b9a68a'); cross(F1, 0, 19.0, -0.05, 1.1, '#d9d4c8');
  statue('flat', at(0, 8.5, 0.22), 0.9, { c: '#e8e4da', noao: true });
  for (const x of [-5.85, 5.6]) { statue('flat', at(x, 10.5, 0.24), 1.55, { c: '#d8d2c4', noao: true }); B(F1, x - 0.9, x + 0.9, 10.2, 10.45, 0, 0.34, '#c4a272'); arc(F1, x, 12.1, 0.05, 0.72, 0.1, '#c4a272', PI, 0, 6); }
  // the tower
  const TZ = 0.2, TX = 9.3, TD = 4.7, T0 = at(TX, 0, TZ - TD / 2);
  for (const [a, hw] of [[0, TD / 2], [PI / 2, TD / 2], [-PI / 2, TD / 2], [PI, TD / 2]]) face('c1PaolaFront', FPT, mul(T0, rotY(a)), rect(-hw, a === 0 ? 0 : 9.6, hw, 19.0), TD / 2 - 0.25, TD / 2, 9.2);
  B(F, TX - TD / 2, TX + TD / 2, -1.5, 0, TZ - TD, TZ, '#8f8272');
  bx('plaster', F, TX - 2.1, TX + 2.1, -1.5, 9.6, TZ - TD + 0.05, TZ - 0.26, { c: '#bd9d72' });
  for (const [yy, hh, ex] of [[10.85, 0.42, 0.22], [13.8, 0.28, 0.14], [18.45, 0.36, 0.2], [18.95, 0.34, 0.42]]) B(T0, -TD / 2 - ex, TD / 2 + ex, yy, yy + hh, -TD / 2 - ex, TD / 2 + ex, '#a98b64');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) finial(T0, sx * 2.1, 19.29, sz * 2.1, 0.95, '#a89070');
  cyl('flat', 1.75, 1.95, 0.55, 8, { M: T0, p: [0, 19.29, 0], c: '#a68a66', noao: true });
  lathe('flat', [[1.72, 0], [1.58, 0.75], [1.15, 1.8], [0.64, 2.7], [0.28, 3.25], [0.02, 3.4]], 8, { M: T0, p: [0, 19.84, 0], c: '#8f6f55', noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(T0, rotY(k * PI / 2)); B(M, -0.34, 0.34, 20.15, 21.05, 0.9, 1.68, '#a98c68'); B(M, -0.17, 0.17, 20.25, 20.8, 1.67, 1.71, '#2c231c'); B(M, -0.42, 0.42, 21.05, 21.2, 0.9, 1.74, '#a98c68'); }
  B(T0, -0.03, 0.03, 23.15, 24.4, -0.03, 0.03, '#3a342e'); B(T0, 0.0, 0.75, 23.9, 24.25, -0.015, 0.015, '#3a342e');
  const o = end('Chiesa di San Francesco di Paola');
  o.userData.solids = [[FP.p, null, y0 + 9.9], [FP.p2, null, y0 + 10]];
  return o;
}

// =====================================================================================================
// Immacolata Concezione al Capo
// =====================================================================================================
const IC = { id: 'w143735554', p: [-619.2, -291.9, -611.7, -280.5, -634.5, -265.1, -642.9, -276.0], O: [-615.45, -286.2], N: [0.836, -0.549] };
const ICT = [-6.8, 13.6, 21.6], ICD = '#a67456', ICW = '#ddd2c2';
function icPaint(g, w, h) {
  const p = pen(g, w, h, ICT[0], ICT[1], ICT[2]), { R, arch, circ, line, poly, ashlar, ledge, strip, grille } = p;
  base(g, w, h, '#bd8e6e', 12201);
  ashlar(-6.8, 0, 6.8, 9.6, '#b68668', 12202, 0.55, 1.5);
  R(-6.8, 0, 6.8, 1.3, '#9a8372'); R(-6.8, 1.2, 6.8, 1.35, '#bda793');
  // paired pilasters with a white strip between, both orders
  for (const s of [-1, 1]) for (const [a, b] of [[1.3, 9.0], [10.65, 16.4]]) {
    R(s * 5.65 - 0.28, a, s * 5.65 + 0.28, b, ICW);
    for (const x of [6.35, 4.85]) { strip(s * x - 0.38, a, s * x + 0.38, b, ICD); for (let k = -0.2; k <= 0.2; k += 0.2) R(s * x + k - 0.03, a + 0.8, s * x + k + 0.03, b - 0.6, 'rgba(70,35,20,0.28)'); R(s * x - 0.48, b - 0.45, s * x + 0.48, b, '#a97a5c'); R(s * x - 0.48, a, s * x + 0.48, a + 0.35, '#a97a5c'); }
  }
  ledge(-6.8, 9.0, 6.8, 9.6, ICD); ledge(-6.8, 9.6, 6.8, 10.65, '#a47254'); R(-6.8, 10.05, 6.8, 10.2, 'rgba(60,30,15,0.3)');
  // the portal
  R(-2.1, 0, 2.1, 6.0, '#bfa48c'); for (const s of [-1, 1]) strip(s * 1.75 - 0.25, 0, s * 1.75 + 0.25, 5.4, '#cbb299');
  R(-1.3, 0, 1.3, 5.0, '#4d3526'); R(-0.03, 0, 0.03, 5.0, '#25170e'); for (const s of [-1, 1]) for (let y = 0.35; y < 4.5; y += 1.1) { R(s * 0.65 - 0.45, y, s * 0.65 + 0.45, y + 0.85, '#5f432f'); R(s * 0.65 - 0.3, y + 0.15, s * 0.65 + 0.3, y + 0.7, '#523928'); }
  ledge(-2.35, 5.9, 2.35, 6.3, '#c3a890'); for (const s of [-1, 1]) { poly([[s * 2.35, 6.3], [s * 0.7, 7.25], [s * 0.7, 7.55], [s * 2.35, 6.65]], '#b8977c'); circ(s * 2.0, 5.5, 0.28, '#a98a70'); }
  circ(0, 6.95, 0.32, '#cdb8a4'); R(-0.5, 7.4, 0.5, 8.4, '#b99c84'); circ(0, 7.9, 0.3, '#8f745e');
  // upper order: the great arched window, mullions, the small window and the white panels
  arch(0, 13.0, 16.35, 7.7, '#cfc2b0', 3.2); arch(0, 13.1, 16.0, 7.0, '#3b332f', 2.85);
  grille(-3.4, 13.15, 3.4, 15.9, 'rgba(160,150,135,0.5)', 0.62);
  for (const s of [-1, 1]) { R(s * 1.3 - 0.2, 13.0, s * 1.3 + 0.2, 15.95, '#d6cabb'); R(s * 3.0 - 1.0, 10.9, s * 3.0 + 1.0, 12.75, '#b08064'); R(s * 3.0 - 0.82, 11.05, s * 3.0 + 0.82, 12.6, ICW); }
  ledge(-4.3, 12.8, -1.5, 13.05, '#c0a690'); ledge(1.5, 12.8, 4.3, 13.05, '#c0a690');
  R(-1.2, 10.65, 1.2, 13.5, '#c2a18a'); R(-0.72, 10.85, 0.72, 12.8, '#352c28'); R(-0.03, 10.85, 0.03, 12.8, '#8d8074'); R(-0.72, 12.0, 0.72, 12.07, '#8d8074');
  arch(0, 13.0, 13.85, 2.2, '#c8ab94', 0.6); circ(0, 13.35, 0.24, '#9c7c66');
  // entablature, pediment, the raised gable
  ledge(-6.8, 16.4, 6.8, 17.0, ICD); R(-6.8, 17.0, 6.8, 17.65, '#b98868'); ledge(-6.8, 17.65, 6.8, 17.95, '#c09474');
  poly([[-5.2, 17.95], [0, 19.65], [5.2, 17.95]], '#b27f60'); R(-0.35, 18.35, 0.35, 18.85, '#8d624a');
  R(-3.0, 20.0, -2.4, 20.6, '#4a342a');
  wear(g, w, h, 12203, 44, 0.16, 0.11);
}
function buildCapo() {
  initShared();
  const S = site(IC.p, IC.O, IC.N), { F, y0, at } = S;
  defMat('c1CapoFront', 288, 448, [ICT[1], ICT[2]], icPaint);
  begin(y0);
  const body = S.behind(-0.35);
  prism('plaster', body, S.lo, y0 + 17.6, { c: '#c4a084' }); flatRoof(body, y0 + 17.6, '#9a7a66');
  gable('flat', 'plaster', at(0, 0, -14.9), 13.0, 28.4, 17.6, 2.9, { ov: 0.1, c: '#a5826a', wc: '#c4a084' });
  face('c1CapoFront', ICT, F, [[-6.8, 0], [6.8, 0], [6.8, 18.3], [5.9, 19.2], [0.0, 21.4], [-5.9, 19.2], [-6.8, 18.3]], -0.4, 0.0);
  B(F, -6.8, 6.8, -1.5, 0, -0.4, 0.0, '#7e6a5c');
  for (const s of [-1, 1]) {
    for (const x of [6.38, 4.85]) { B(F, s * x - 0.36, s * x + 0.36, 1.35, 9.0, -0.02, x > 6 ? 0.1 : 0.16, '#ad7a5c'); B(F, s * x - 0.36, s * x + 0.36, 10.65, 16.4, -0.02, x > 6 ? 0.1 : 0.16, '#ad7a5c'); }
    B(F, s * 1.75 - 0.26, s * 1.75 + 0.26, 0, 5.9, -0.02, 0.2, '#c6ad95');
    slab(F, [[s * 2.45, 6.3], [s * 0.7, 7.28], [s * 0.7, 7.55], [s * 2.45, 6.65]], -0.02, 0.36, '#bd9d83');
    slab(F, [[s * 5.4, 17.95], [0, 19.75], [0, 19.42], [s * 4.5, 17.95]], -0.02, 0.35, '#a87658');
  }
  for (const [a, b, z, c] of [[9.15, 9.55, 0.24, '#a97759'], [10.2, 10.65, 0.46, '#a06e50'], [16.45, 16.95, 0.24, '#a97759'], [17.65, 17.95, 0.42, '#b88c6c']]) B(F, -6.8, 6.8, a, b, -0.05, z, c);
  B(F, -2.4, 2.4, 5.95, 6.25, -0.02, 0.36, '#c6ab93'); sphere('flat', 0.3, { M: F, p: [0, 6.95, 0.05], c: '#cdb8a4', seg: 6, noao: true });
  B(F, -1.35, 1.35, 13.45, 13.65, -0.02, 0.22, '#c3a58c'); arc(F, 0, 13.15, 0.02, 3.72, 0.12, '#d2c6b5', PI, 0, 16);
  for (const s of [-1, 1]) B(F, s * 6.1 - 0.5, s * 6.1 + 0.5, 18.25, 18.55, -0.35, 0.15, '#a87658');
  const o = end("Chiesa dell'Immacolata Concezione al Capo");
  o.userData.solids = [[IC.p, null, y0 + 17.6]];
  return o;
}

// =====================================================================================================
// Santa Maria di Monte Oliveto (Badia Nuova)
// =====================================================================================================
const MO = { id: 'w279883975', p: [-442.8, 88.6, -437.5, 97.2, -448.4, 104.3, -454.2, 95.8], O: [-442.95, 100.75], N: [0.546, 0.838] };
const MOT = [-6.5, 13, 21], MOC = '#b4864e', MOL = '#c69b62', MOW = '#e6e0d3';
function moPaint(g, w, h) {
  const p = pen(g, w, h, MOT[0], MOT[1], MOT[2]), { R, arch, circ, line, poly, ashlar, ledge, strip, grille } = p;
  base(g, w, h, MOW, 12301, 0.06);
  const scroll = (x, y, r, dir) => { g.strokeStyle = MOC; g.lineWidth = Math.max(1.5, 0.22 * p.sx); g.beginPath(); for (let i = 0; i <= 28; i++) { const t = i / 28, a = t * 3.6 * PI, rr = r * (1 - t * 0.82), X = x + dir * Math.cos(a) * rr, Y = y + Math.sin(a) * rr; i ? g.lineTo(p.X(X), p.Y(Y)) : g.moveTo(p.X(X), p.Y(Y)); } g.stroke(); };
  // plinth, the giant pilasters of both orders
  ashlar(-6.5, 0, 6.5, 1.7, '#9c7a52', 12302, 0.55, 1.4); ledge(-6.5, 1.55, 6.5, 1.85, MOC);
  for (const s of [-1, 1]) {
    for (const [x, ww] of [[5.95, 1.1], [2.95, 0.78]]) { strip(s * x - ww / 2, 1.85, s * x + ww / 2, 12.3, MOC); R(s * x - ww / 2 + 0.2, 2.5, s * x + ww / 2 - 0.2, 11.3, MOL); R(s * x - ww / 2 - 0.08, 11.4, s * x + ww / 2 + 0.08, 12.3, '#a97c47'); R(s * x - 0.18, 11.55, s * x + 0.18, 12.15, '#caa26c'); }
    strip(s * 2.2 - 0.2, 7.2, s * 2.2 + 0.2, 12.3, MOC);
    // the two windows of each side bay
    for (const [a, b] of [[3.0, 5.7], [8.0, 10.2]]) {
      R(s * 4.45 - 1.02, a - 0.28, s * 4.45 + 1.02, b + 0.3, MOC); R(s * 4.45 - 0.82, a - 0.08, s * 4.45 + 0.82, b + 0.1, MOL); R(s * 4.45 - 0.62, a + 0.08, s * 4.45 + 0.62, b - 0.08, '#3a322c'); grille(s * 4.45 - 0.62, a + 0.08, s * 4.45 + 0.62, b - 0.08, '#8e8174', 0.31);
      for (const d of [-1, 1]) scroll(s * 4.45 + d * 0.55, a - 0.55, 0.34, d); circ(s * 4.45, a - 0.65, 0.22, MOC); scroll(s * 4.45 - 0.42, b + 0.62, 0.27, -1); scroll(s * 4.45 + 0.42, b + 0.62, 0.27, 1); circ(s * 4.45, b + 0.65, 0.25, MOL);
    }
    // upper order: pilasters, lozenge, great scroll
    for (const x of [6.05, 3.0]) { strip(s * x - 0.34, 14.1, s * x + 0.34, x > 5 ? 16.5 : 19.3, MOC); R(s * x - 0.12, 14.4, s * x + 0.12, x > 5 ? 16.2 : 18.7, MOL); }
    R(s * 4.55 - 1.25, 14.35, s * 4.55 + 1.25, 16.3, MOC); R(s * 4.55 - 1.1, 14.5, s * 4.55 + 1.1, 16.15, MOW); poly([[s * 4.55 - 0.9, 15.33], [s * 4.55, 16.02], [s * 4.55 + 0.9, 15.33], [s * 4.55, 14.64]], MOC);
    ledge(Math.min(s * 3.4, s * 6.5), 16.45, Math.max(s * 3.4, s * 6.5), 16.75, MOC);
    scroll(s * 5.05, 17.6, 0.82, -s); scroll(s * 4.0, 18.5, 0.55, s); line(s * 6.2, 17.0, s * 3.7, 19.3, 0.2, MOC);
  }
  // cornices with their consoles
  ledge(-6.5, 12.3, 6.5, 12.75, MOL); R(-6.5, 12.75, 6.5, 13.25, MOC); ledge(-6.5, 13.25, 6.5, 13.75, MOL); for (let x = -6.2; x <= 6.3; x += 0.62) R(x, 12.78, x + 0.22, 13.22, '#8f673c');
  ledge(-3.6, 19.35, 3.6, 19.75, MOL); R(-3.5, 19.75, 3.5, 20.35, MOC); for (let x = -3.2; x <= 3.3; x += 0.64) circ(x, 20.05, 0.16, MOL); ledge(-3.6, 20.35, 3.6, 20.75, MOL);
  // the round window
  circ(0, 16.7, 1.62, '#8e6538'); circ(0, 16.7, 1.46, MOL); circ(0, 16.7, 1.08, '#8a6034'); circ(0, 16.7, 0.94, '#37302b'); for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI; line(0, 16.7, Math.cos(a) * 0.94, 16.7 + Math.sin(a) * 0.94, 0.07, '#8e8174'); } R(-0.22, 18.35, 0.22, 19.35, MOC);
  // the niche of the Madonna
  R(-1.45, 7.7, 1.45, 11.9, MOC); arch(0, 7.9, 11.65, 2.0, MOL); arch(0, 8.0, 11.45, 1.65, '#7d5c3c'); for (let i = -3; i <= 3; i++) line(0, 10.6, i * 0.26, 11.35 - i * i * 0.04, 0.06, '#c9a06a'); for (const d of [-1, 1]) { scroll(d * 1.35, 8.1, 0.5, d); scroll(d * 0.7, 7.6, 0.38, -d); }
  // the grey marble portal and the door
  R(-2.6, 0, 2.6, 6.6, '#8c8a86'); R(-1.55, 0, 1.55, 5.6, '#6f6d69'); R(-1.32, 0, 1.32, 5.35, '#7a5430'); R(-0.03, 0, 0.03, 5.35, '#33210f'); for (let x = -1.2; x < 1.15; x += 0.62) for (let y = 0.25; y < 5.0; y += 0.74) { R(x, y, x + 0.5, y + 0.58, '#95693c'); R(x + 0.1, y + 0.1, x + 0.4, y + 0.48, '#80592f'); }
  ledge(-2.75, 5.85, 2.75, 6.45, '#a3a19c');
  wear(g, w, h, 12303, 40, 0.14, 0.09);
}
function moTowerArches(M, xs, y, ww, hh) {
  for (const x of xs) {
    slab(M, headed(x, y - 0.05, y + hh - ww / 2, ww + 0.34), -0.05, 0.025, '#caa86e'); slab(M, headed(x, y, y + hh - ww / 2, ww), -0.04, 0.05, '#3b2f24');
    B(M, x - ww / 2 - 0.1, x + ww / 2 + 0.1, y + 0.5, y + 0.6, 0.05, 0.22, '#2e2a26'); B(M, x - ww / 2 - 0.1, x + ww / 2 + 0.1, y - 0.1, y, 0.03, 0.25, '#2e2a26');
  }
}
function buildOliveto() {
  initShared();
  const S = site(MO.p, MO.O, MO.N), { F, y0, at } = S;
  defMat('c1OlivetoFront', 304, 480, [MOT[1], MOT[2]], moPaint);
  begin(y0);
  const body = S.behind(-0.6), TOP = 29.6;
  prism('plaster', body, S.lo, y0 + TOP, { c: '#e2c48a' }); flatRoof(body, y0 + TOP, '#b08a64');
  for (let i = 0; i < body.length; i++) {   // the openings of the tower block on the front and the flanks
    const a = body[i], b = body[(i + 1) % body.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 6) continue;
    let nx = -dz / l, nz = dx / l; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (nx * (mx + 445.7) + nz * (mz - 96.5) < 0) { nx = -nx; nz = -nz; }
    const front = nx * MO.N[0] + nz * MO.N[1] > 0.8, back = nx * MO.N[0] + nz * MO.N[1] < -0.8;
    const M = frame(mx, y0, mz, nx, nz); B(M, -l / 2 - 0.12, l / 2 + 0.12, TOP - 0.25, TOP + 0.25, -0.2, 0.14, '#cfae76');
    if (!back) moTowerArches(M, front ? [-4.6, -2.3, 0, 2.3, 4.6] : [-l * 0.28, 0, l * 0.28], 24.6, 1.35, 2.2);
  }
  face('c1OlivetoFront', MOT, F, [[-6.5, 0], [6.5, 0], [6.5, 16.75], [6.1, 17.3], [5.0, 18.4], [3.6, 19.5], [3.6, 20.75], [-3.6, 20.75], [-3.6, 19.5], [-5.0, 18.4], [-6.1, 17.3], [-6.5, 16.75]], -0.65, 0.0);
  B(F, -6.5, 6.5, -1.5, 0, -0.65, 0.0, '#80654a');
  // cornices and pilasters in relief
  for (const [a, b, z] of [[12.35, 12.7, 0.2], [13.3, 13.72, 0.48]]) { B(F, -6.55, -1.9, a, b, -0.05, z, '#bd9158'); B(F, 1.9, 6.55, a, b, -0.05, z, '#bd9158'); }
  B(F, -1.9, 1.9, 12.35, 12.6, -0.05, 0.2, '#bd9158');
  for (const s of [-1, 1]) {
    slab(F, [[s * 2.3, 12.65], [0, 13.9], [0, 13.55], [s * 1.75, 12.65]], -0.02, 0.48, '#c0955c');
    for (const [x, ww] of [[5.95, 1.0], [2.95, 0.68]]) B(F, s * x - ww / 2, s * x + ww / 2, 1.85, 12.35, -0.02, 0.16, '#ad8049');
    B(F, s * 3.0 - 0.3, s * 3.0 + 0.3, 14.0, 19.35, -0.02, 0.14, '#ad8049'); B(F, s * 6.12 - 0.28, s * 6.12 + 0.28, 14.0, 16.45, -0.02, 0.14, '#ad8049'); B(F, Math.min(s * 3.4, s * 6.55), Math.max(s * 3.4, s * 6.55), 16.47, 16.74, -0.05, 0.26, '#bd9158');
    for (const [a, b] of [[3.0, 5.7], [8.0, 10.2]]) { B(F, s * 4.45 - 1.15, s * 4.45 + 1.15, b + 0.3, b + 0.45, -0.02, 0.22, '#bd9158'); B(F, s * 4.45 - 1.05, s * 4.45 + 1.05, a - 0.3, a - 0.16, -0.02, 0.2, '#bd9158'); }
    arc(F, s * 5.05, 17.6, 0.06, 0.78, 0.12, '#b4874f', PI * 1.6, s > 0 ? PI * 0.1 : -PI * 0.7, 12); arc(F, s * 4.0, 18.5, 0.06, 0.48, 0.1, '#b4874f', PI * 1.5, s > 0 ? -PI * 0.4 : -PI * 0.1, 10);
    finial(F, s * 3.2, 20.75, -0.3, 0.9, '#b99466');
    // portal: free columns on bases, capitals, the halves of the broken pediment
    cyl('flat', 0.27, 0.33, 4.3, 8, { M: F, p: [s * 1.98, 1.05, 0.48], c: '#a9a7a2', noao: true }); B(F, s * 1.98 - 0.45, s * 1.98 + 0.45, 0, 1.05, -0.02, 0.88, '#8f8d88'); B(F, s * 1.98 - 0.42, s * 1.98 + 0.42, 5.35, 5.85, -0.02, 0.84, '#c4c0b6');
    B(F, s * 1.98 - 0.5, s * 1.98 + 0.5, 5.85, 6.45, -0.02, 0.9, '#9b9994');
    slab(F, [[s * 2.7, 6.45], [s * 0.95, 7.55], [s * 0.95, 7.95], [s * 1.5, 7.85], [s * 2.7, 6.85]], -0.02, 0.7, '#a3a19c');
    sphere('flat', 0.24, { M: F, p: [s * 0.72, 6.75, 0.4], c: '#d3cec2', seg: 6, ky: 1.5, noao: true });
  }
  B(F, -2.5, 2.5, 5.9, 6.4, -0.02, 0.4, '#9b9994');
  slab(F, [[-0.5, 6.5], [0.5, 6.5], [0.7, 7.2], [0.45, 7.75], [0, 7.95], [-0.45, 7.75], [-0.7, 7.2]], -0.02, 0.5, '#bfbab0');
  B(F, -0.9, 0.9, 8.0, 8.25, -0.02, 0.45, '#c9a778');
  statue('flat', at(0, 8.25, 0.28), 2.5, { c: '#dcd5c6', noao: true }); statue('flat', at(-0.55, 8.2, 0.34), 1.0, { c: '#d2cbbd', noao: true });
  arc(F, 0, 16.7, 0.05, 1.34, 0.17, '#bd9158', 2 * PI, 0, 18);
  B(F, -3.65, 3.65, 19.35, 19.7, -0.05, 0.3, '#bd9158'); B(F, -3.75, 3.75, 20.4, 20.8, -0.6, 0.45, '#c29a62');
  sphere('flat', 0.5, { M: F, p: [0, 21.1, -0.1], c: '#d2cbbb', seg: 8, ky: 0.7, noao: true }); cross(F, 0, 21.3, -0.1, 1.4, '#4a4036');
  const o = end('Chiesa di Santa Maria di Monte Oliveto');
  o.userData.solids = [[MO.p, null, y0 + TOP]];
  return o;
}

// =====================================================================================================
// Santa Chiara
// =====================================================================================================
const CH = { id: 'w279886240', p: [-104.6, 288.0, -104.4, 289.0, -103.0, 289.1, -101.7, 289.7, -100.7, 290.6, -100.0, 291.9, -99.8, 293.2, -100.0, 294.8, -100.8, 296.2, -102.1, 297.2, -103.6, 297.7, -104.0, 298.5, -111.3, 299.3, -134.6, 301.8, -135.1, 288.9, -131.2, 288.6, -131.0, 290.5, -128.7, 290.3, -112.2, 288.7], O: [-134.95, 295.35], N: [-0.999, 0.039] };
const CHT = [-10.4, 16.9, 25], CHW = '#e2d9c6', CHS = '#b29264', CHP = '#9c6c38';
function chPaint(g, w, h) {
  const p = pen(g, w, h, CHT[0], CHT[1], CHT[2]), { R, arch, circ, line, poly, ashlar, ledge, strip, grille } = p;
  base(g, w, h, CHW, 12401, 0.07);
  // the front, x -6.45..6.5: stone corners, base, top cornice
  ashlar(-6.45, 0, -5.15, 18.8, CHS, 12402, 0.5, 0.8); ashlar(5.1, 0, 6.5, 18.8, CHS, 12403, 0.5, 0.8);
  R(-5.15, 0, 5.1, 1.6, '#b3a48a'); poly([[-5.15, 1.5], [-3.5, 2.3], [-2.9, 1.6], [-2.4, 1.5]], 'rgba(120,100,75,0.5)');
  ledge(-6.45, 18.8, 6.5, 19.35, CHS); R(-6.45, 19.35, 6.5, 19.75, '#c0a478'); ledge(-6.45, 19.75, 6.5, 20.2, CHS);
  // the round window
  circ(0, 14.5, 1.95, '#8a755a'); circ(0, 14.5, 1.75, '#a89276'); circ(0, 14.5, 1.3, '#6e5c46'); circ(0, 14.5, 1.15, '#2d3036'); grille(-0.8, 13.7, 0.8, 15.3, 'rgba(150,140,125,0.55)', 0.4);
  // the portal
  R(-2.35, 0.7, 2.35, 7.45, CHP); for (const s of [-1, 1]) { strip(s * 1.95 - 0.26, 0.7, s * 1.95 + 0.26, 6.9, '#a97a42'); R(s * 1.95 - 0.08, 1.5, s * 1.95 + 0.08, 6.0, '#865a2c'); }
  R(-1.55, 0.7, 1.55, 6.45, '#865d30'); R(-1.32, 0.7, 1.32, 6.2, '#2e1f15'); R(-0.03, 0.7, 0.03, 6.2, '#150d08'); R(-0.7, 0.7, 0.55, 3.9, '#0e0a07'); for (let y = 4.2; y < 6.0; y += 0.6) for (const x of [-0.95, -0.28, 0.4]) R(x, y, x + 0.52, y + 0.42, '#3e2b1c');
  ledge(-2.45, 6.85, 2.45, 7.25, '#a2733c');
  for (const s of [-1, 1]) poly([[s * 2.65, 7.45], [s * 1.1, 8.65], [s * 0.85, 8.4], [s * 1.3, 8.05], [s * 2.0, 7.45]], '#8f6c46');
  R(-0.95, 7.45, 0.95, 10.1, '#a27a48'); R(-0.65, 7.75, 0.65, 9.6, '#8a6438'); circ(0, 8.75, 0.35, '#6e5030'); ledge(-1.15, 10.05, 1.15, 10.4, '#a2733c');
  circ(3.25, 3.5, 0.34, '#3a2d28');
  // ---- the tower, x -10.4..-6.5
  ashlar(-10.4, 0, -6.45, 25, '#b08b58', 12410, 0.42, 0.7);
  for (let y = 0; y < 11.6; y += 0.9) R(-9.55, y, -7.3, y + 0.45, 'rgba(225,215,195,0.35)');
  for (const y of [3.2, 5.8]) R(-8.8, y, -8.1, y + 1.0, '#3a2e24');
  arch(-8.45, 9.8, 11.5, 1.9, '#8f6c42', 0.8);
  for (const [a, b] of [[12.6, 15.7], [16.9, 19.7], [21.2, 23.7]]) {
    for (const x of [-10.15, -7.2]) { strip(x - 0.2, a - 0.5, x + 0.28, b + 0.5, '#c49d66'); for (let y = a; y < b; y += 0.45) R(x - 0.1, y, x + 0.16, y + 0.2, '#916d40'); }
    arch(-8.45, a - 0.1, b + 0.28, 2.15, '#c8a46e'); arch(-8.45, a, b, 1.6, '#2b2119'); R(-9.45, a - 0.95, -7.45, a - 0.25, '#d2c2a4'); ledge(-10.4, b + 0.5, -6.45, b + 0.85, '#a8814e'); for (let x = -10.0; x < -6.8; x += 0.4) circ(x, b + 0.42, 0.1, '#d1ac76');
  }
  R(-9.1, 22.0, -7.8, 22.9, '#45413a');
  wear(g, w, h, 12404, 46, 0.16, 0.1);
}
function buildChiara() {
  initShared();
  const S = site(CH.p, CH.O, CH.N), { F, y0, at } = S;
  defMat('c1ChiaraFront', 320, 480, [CHT[1], CHT[2]], chPaint);
  begin(y0);
  prism('plaster', S.behind(-0.4), S.lo, y0 + 13.6, { c: '#e0cdb0' }); flatRoof(S.behind(-0.4), y0 + 13.6, '#a87458');
  // the nave up to its eaves, tiled roof
  const NQ = [[-6.2, -0.4], [6.2, -0.4], [4.85, -24.8], [-5.7, -24.8]];
  prism('plaster', NQ.map(q => S.W(q[0], q[1])), y0 + 13.6, y0 + 17.6, { c: '#e8dcc2' }); roof(F, NQ, 17.6, 2.3, '#ae6a4a', '#d9c4a4');
  face('c1ChiaraFront', CHT, F, rect(-6.45, 0, 6.5, 20.2), -0.45, 0.0);
  B(F, -6.45, 6.5, -1.5, 0, -0.45, 0.0, '#8a7a62');
  B(F, -6.6, 6.65, 19.75, 20.25, -0.55, 0.42, '#b0915f'); B(F, -6.55, 6.6, 18.85, 19.15, -0.1, 0.2, '#b0915f');
  arc(F, 0, 14.5, 0.04, 1.62, 0.2, '#9c8566', 2 * PI, 0, 18);
  for (const s of [-1, 1]) {
    B(F, s * 1.95 - 0.28, s * 1.95 + 0.28, 0.7, 6.85, -0.02, 0.24, '#a77840');
    slab(F, [[s * 2.7, 7.45], [s * 1.1, 8.7], [s * 0.85, 8.42], [s * 1.3, 8.05], [s * 2.05, 7.45]], -0.02, 0.4, '#92704a');
    arc(F, s * 1.12, 8.35, 0.22, 0.26, 0.1, '#92704a', 2 * PI, 0, 8);
  }
  B(F, -2.55, 2.55, 7.15, 7.45, -0.02, 0.45, '#a2733c'); B(F, -0.95, 0.95, 7.45, 10.05, -0.02, 0.14, '#a47c4a'); B(F, -1.2, 1.2, 10.05, 10.35, -0.02, 0.32, '#a2733c'); finial(F, 0, 10.35, 0.1, 0.5, '#9a7444');
  // the buttress with its pointed cap, on the left corner
  B(F, -6.55, -5.35, -0.5, 9.4, -0.3, 0.38, '#a98a5e'); for (let y = 0.6; y < 9.2; y += 0.55) B(F, -6.57, -5.33, y, y + 0.05, -0.28, 0.4, '#7f6845'); B(F, -6.65, -5.25, 9.4, 9.65, -0.3, 0.46, '#a8895c'); slab(F, [[-6.65, 9.65], [-5.25, 9.65], [-5.95, 10.7]], -0.3, 0.4, '#6f604c');
  // the steps in front of the door
  for (let i = 0; i < 4; i++) B(F, -2.7 - (3 - i) * 0.16, 2.7 + (3 - i) * 0.16, -0.6, 0.175 * (i + 1), -0.1, 0.48 - i * 0.12, i % 2 ? '#a79e8e' : '#989082');
  // the bell tower on the north side
  const TX = -8.3, TW = 3.5, T0 = at(TX, 0, 0.02 - TW / 2);
  for (const a of [0, PI / 2, PI, -PI / 2]) face('c1ChiaraFront', CHT, mul(T0, rotY(a)), rect(-TW / 2, a === 0 ? 0 : 6.0, TW / 2, 24.55), TW / 2 - 0.25, TW / 2, -8.45);
  B(T0, -TW / 2, TW / 2, -1.5, 0, -TW / 2, TW / 2, '#8a7a62');
  for (const [y, hh, ex] of [[11.6, 0.35, 0.16], [16.2, 0.36, 0.2], [20.2, 0.36, 0.2], [24.2, 0.35, 0.24], [24.55, 0.25, 0.4]]) B(T0, -TW / 2 - ex, TW / 2 + ex, y, y + hh, -TW / 2 - ex, TW / 2 + ex, '#a98450');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(T0, sx * 1.68 - 0.2, sx * 1.68 + 0.2, 12.0, 24.2, sz * 1.68 - 0.2, sz * 1.68 + 0.2, '#b79058');
  cyl('flat', 1.05, 1.7, 0.7, 8, { M: T0, p: [0, 24.8, 0], c: '#8f7048', noao: true });
  for (const a of [0, PI / 2, PI, -PI / 2]) { const M = mul(T0, rotY(a)); for (const y of [21.55, 22.1]) B(M, -0.95, 0.95, y, y + 0.06, 2.1, 2.15, '#37332e'); for (let k = -1; k <= 1; k++) B(M, k * 0.62 - 0.03, k * 0.62 + 0.03, 21.15, 22.15, 2.1, 2.15, '#37332e'); B(M, -0.95, 0.95, 21.1, 21.18, 1.74, 2.15, '#37332e'); }
  // south flank windows: a row of arched ones over a row of square ones
  {
    const a = [-134.6, 301.8], b = [-111.3, 299.3], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), M = frame((a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2, -dz / l, dx / l);
    for (const x of [-7, 0, 7]) {
      slab(M, headed(x, 9.8, 11.25, 1.85), -0.05, 0.03, '#cbb48c'); slab(M, headed(x, 9.9, 11.25, 1.6), -0.05, 0.05, '#4a3e34');
      B(M, x - 0.6, x + 0.6, 5.2, 7.6, -0.05, 0.05, '#51443a'); B(M, x - 0.72, x + 0.72, 7.6, 7.75, -0.05, 0.12, '#cbb48c');
    }
  }
  // the pink apse with its half round windows and tiled band, the red dome and the lantern
  prism('flat', S.pts.slice(0, 12).map(([x, z]) => [-104.4 + (x + 104.4) * 1.02, 293.3 + (z - 293.3) * 1.02]), S.lo, y0 + 13.75, { c: '#d6a58c', noao: true });
  prism('flat', S.pts.slice(0, 12).map(([x, z]) => [-104.4 + (x + 104.4) * 1.1, 293.3 + (z - 293.3) * 1.07]), y0 + 13.35, y0 + 13.8, { c: '#a9694c', noao: true });
  cyl('flat', 3.4, 5.0, 0.75, 16, { p: [-104.5, y0 + 13.8, 293.35], c: '#b87656', noao: true });
  const D = S.L([-106.0, 294.2]), DM = at(D[0], 0, D[1]);
  cyl('flat', 4.55, 4.55, 1.7, 14, { M: DM, p: [0, 13.7, 0], c: '#cf9c84', noao: true });
  cyl('flat', 4.2, 5.0, 0.45, 14, { M: DM, p: [0, 15.4, 0], c: '#a9694c', noao: true });
  cyl('flat', 4.3, 4.3, 1.5, 14, { M: DM, p: [0, 15.8, 0], c: '#d2a088', noao: true });
  dome(DM, 4.3, 3.7, 17.3, ['#b8636a'], () => 0, 16, 5);
  cyl('flat', 1.15, 1.15, 1.9, 8, { M: DM, p: [0, 20.85, 0], c: '#d6b684', noao: true }); cyl('flat', 1.35, 1.35, 0.2, 8, { M: DM, p: [0, 22.7, 0], c: '#b8986c', noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(DM, rotY(k * PI / 2 + PI / 8)); B(M, -0.24, 0.24, 21.2, 22.35, 1.04, 1.09, '#33281e'); }
  dome(DM, 1.15, 0.9, 22.9, ['#b98a62'], () => 0, 8, 3); cross(DM, 0, 23.75, 0, 1.2);
  for (const a of [PI * 0.37, PI * 0.63]) { const wp = [-104.4 + Math.sin(a) * 4.76, 293.3 + Math.cos(a) * 4.76], M = frame(wp[0], y0, wp[1], Math.sin(a), Math.cos(a)); slab(M, headed(0, 11.1, 11.25, 2.65, 1.25), -0.25, 0.04, '#c08c76'); slab(M, headed(0, 11.2, 11.25, 2.4, 1.1), -0.25, 0.07, '#3a302c'); }
  const o = end('Chiesa di Santa Chiara');
  o.userData.solids = [[CH.p, null, y0 + 13.6]];
  return o;
}

// =====================================================================================================
// San Giovanni dei Napoletani
// =====================================================================================================
const GN = { id: 'w279888250', p: [686.2, -331.5, 684.3, -332.8, 688.9, -335.0, 693.4, -332.6, 693.9, -327.2, 691.5, -328.1, 682.6, -312.7, 680.5, -311.9, 675.9, -314.2] };
// the canvas: the middle face at x -2.7..2.7, a side face centred on x 5.5
const GNT = [-2.75, 11.1, 17], GNS = '#b49269', GNT2 = '#c2a47c', GNY = '#d6bd82';
function gnPaint(g, w, h) {
  const p = pen(g, w, h, GNT[0], GNT[1], GNT[2]), { R, arch, circ, line, poly, ashlar, ledge, strip, grille } = p;
  base(g, w, h, GNS, 12501);
  ashlar(-2.75, 0, 8.35, 10.4, '#b19069', 12502, 0.42, 0.9);
  R(-2.75, 0, 8.35, 1.5, 'rgba(120,105,85,0.55)'); R(-2.75, 10.8, 8.35, 15.4, GNY); noiseDots(g, w, p.Y(10.8) - p.Y(15.4), 500, 1.5, 12503, ['rgba(120,90,40,0.12)']);
  for (const [c, hw] of [[0, 2.6], [5.5, 2.75]]) {
    const mid = c === 0;
    // lower order: pilasters on the corners, the blind arch, the opening
    for (const s of [-1, 1]) { strip(c + s * hw - 0.36, 0, c + s * hw + 0.36, 9.2, GNT2); R(c + s * hw - 0.46, 1.4, c + s * hw + 0.46, 1.75, '#a98d68'); R(c + s * hw - 0.46, 9.0, c + s * hw + 0.46, 9.4, '#a98d68'); }
    const bw = mid ? 4.15 : 3.4;
    arch(c, 1.5, 8.5, bw + 0.55, GNT2); arch(c, 1.5, 8.2, bw, '#ac875e'); ashlar(c - bw / 2, 1.5, c + bw / 2, 5.9, '#ac875e', 12504, 0.3, 0.7);
    for (let i = 0; i <= 12; i++) { const a = i / 12 * PI; line(c + Math.cos(a) * bw * 0.33, 8.2 - bw / 2 + Math.sin(a) * bw * 0.33, c + Math.cos(a) * bw * 0.49, 8.2 - bw / 2 + Math.sin(a) * bw * 0.49, 0.05, 'rgba(80,55,30,0.4)'); }
    if (mid) {
      arch(c, 0, 6.5, 2.35, '#17120f'); for (let x = -1.1; x <= 1.12; x += 0.2) R(x - 0.025, 0, x + 0.025, 2.85, '#3a3a38'); for (const y of [0.4, 1.7, 2.8]) R(-1.15, y, 1.15, y + 0.08, '#45453f');
      circ(0, 3.2, 0.34, '#a8a8a2', 0.4); poly([[-0.65, 3.0], [-0.25, 3.35], [0.25, 3.35], [0.65, 3.0], [0, 2.92]], '#8e8e88');
      R(-2.0, 3.9 - 2.2, -1.45, 2.6, '#e4e0d4'); R(-2.0, 1.15, -1.45, 1.55, '#c8b070'); R(1.4, 1.5, 1.9, 2.1, '#bfa060'); circ(2.15, 1.85, 0.18, '#74402c');
    } else { arch(c, 1.7, 5.3, 1.3, GNT2); arch(c, 1.8, 5.1, 0.95, '#1b1512'); grille(c - 0.45, 1.8, c + 0.45, 4.6, '#35332f', 0.3); }
    // the ledge, then the upper storey: pilasters, the framed door, cornices
    ledge(c - hw - 0.2, 9.55, c + hw + 0.2, 9.85, GNT2); ledge(c - hw - 0.2, 10.35, c + hw + 0.2, 10.85, '#8f7a5c');
    for (const s of [-1, 1]) { strip(c + s * (hw - 0.34) - 0.28, 10.85, c + s * (hw - 0.34) + 0.28, 15.1, '#b59a74'); for (let k = -0.14; k <= 0.15; k += 0.14) R(c + s * (hw - 0.34) + k - 0.025, 11.5, c + s * (hw - 0.34) + k + 0.025, 14.6, 'rgba(70,50,30,0.35)'); circ(c + s * (hw - 0.5), 14.9, 0.16, '#cdb690'); circ(c + s * (hw - 0.18), 14.9, 0.16, '#cdb690'); }
    R(c - 1.15, 10.85, c + 1.15, 14.2, '#b09470'); R(c - 0.9, 10.85, c + 0.9, 13.45, '#8d7656'); R(c - 0.75, 10.85, c + 0.75, 13.25, '#8e4a36'); for (let i = 0; i < 40; i++) { const r = RNG(i + 31 + c * 7); const x = c - 0.7 + r() * 1.2, y = 10.9 + r() * r() * 1.9; R(x, y, x + 0.1 + r() * 0.2, y + 0.08 + r() * 0.2, '#b79c84'); }
    R(c - 0.03, 10.85, c + 0.03, 13.25, '#4a281c'); for (const s of [-1, 1]) R(c + s * 0.22 - 0.14, 12.35, c + s * 0.22 + 0.14, 12.75, '#1c120d');
    for (let x = -0.95; x < 1.0; x += 0.28) circ(c + x, 13.82, 0.14, '#7d6746'); ledge(c - 1.4, 14.2, c + 1.4, 14.5, '#9c8460');
    ledge(c - hw - 0.2, 15.15, c + hw + 0.2, 15.45, '#a38a66'); R(c - hw - 0.2, 15.45, c + hw + 0.2, 15.75, '#8c765a'); ledge(c - hw - 0.2, 15.75, c + hw + 0.2, 16.05, '#a38a66');
    R(c - hw - 0.2, 16.05, c + hw + 0.2, 17, '#c3b9a4'); for (let i = 0; i < 9; i++) { const r = RNG(i * 13 + 5 + c * 3); R(c - hw + r() * hw * 2, 16.1, c - hw + r() * hw * 2 + 0.12, 16.2 + r() * 0.45, 'rgba(40,35,28,0.5)'); }
  }
  wear(g, w, h, 12505, 40, 0.14, 0.12);
}
function buildNapoletani() {
  initShared();
  const mid = [691.15, -333.8], N = [0.47, -0.883], S = site(GN.p, mid, N), { y0 } = S;
  defMat('c1NapolFront', 256, 400, [GNT[1], GNT[2]], gnPaint);
  begin(y0);
  prism('plaster', S.pts, S.lo, y0 + 15.9, { c: '#cbae7c' }); flatRoof(S.pts, y0 + 15.9, '#a97c60');
  // the three faces of the end on the Corso, left to right as seen from the street
  const E = [[[693.4, -332.6], [693.9, -327.2], 5.5, false], [[688.9, -335.0], [693.4, -332.6], 0, true], [[684.3, -332.8], [688.9, -335.0], 5.5, false]];
  for (const [a, b, ox, isMid] of E) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = dz / l, nz = -dx / l, M = frame((a[0] + b[0]) / 2 + nx * 0.04, y0, (a[1] + b[1]) / 2 + nz * 0.04, nx, nz), hw = l / 2 + 0.03;
    face('c1NapolFront', GNT, M, rect(-hw, 0, hw, 16.55), -0.3, 0.05, ox);
    B(M, -hw, hw, -1.5, 0, -0.3, 0.05, '#7c6a54');
    for (const s of [-1, 1]) { B(M, Math.min(s * (hw - 0.36), s * hw), Math.max(s * (hw - 0.36), s * hw), 1.5, 9.35, -0.02, 0.2, '#b89a72'); B(M, Math.min(s * (hw - 0.62), s * (hw - 0.1)), Math.max(s * (hw - 0.62), s * (hw - 0.1)), 10.85, 15.15, -0.02, 0.17, '#b19672'); }
    B(M, -hw - 0.04, hw + 0.04, 9.55, 9.8, -0.1, 0.24, '#b59872'); B(M, -hw - 0.2, hw + 0.2, 10.4, 10.82, -0.1, 0.5, '#8c765a'); B(M, -hw - 0.1, hw + 0.1, 15.2, 15.45, -0.1, 0.3, '#9c8462'); B(M, -hw - 0.22, hw + 0.22, 15.75, 16.08, -0.1, 0.5, '#a38a66');
    B(M, -1.45, 1.45, 14.22, 14.45, -0.02, 0.32, '#9c8460');
    // the iron balcony of the upper door
    const iron = '#2f2b28', bw = isMid ? 1.5 : 1.8;
    B(M, -bw, bw, 11.82, 11.88, 0.5, 0.56, iron); for (let x = -bw; x <= bw + 0.01; x += bw / 6) B(M, x - 0.018, x + 0.018, 10.82, 11.85, 0.51, 0.55, iron); for (const s of [-1, 1]) B(M, s * bw - 0.025, s * bw + 0.025, 11.82, 11.88, 0.05, 0.55, iron);
  }
  // the dome over the church: an eight sided drum, blue and white tiles between ribs, a small cap
  const DM = frame(681.9, y0, -318.2, 0.47, -0.883);
  cyl('flat', 3.2, 3.2, 2.4, 8, { M: DM, p: [0, 15.9, 0], c: '#b08a68', noao: true });
  cyl('flat', 3.35, 3.35, 0.3, 8, { M: DM, p: [0, 18.2, 0], c: '#9c7c5e', noao: true });
  for (let k = 0; k < 8; k++) { const M = mul(DM, rotY(k * PI / 4 + PI / 8)); B(M, -0.4, 0.4, 16.6, 17.8, 2.93, 2.98, '#4a3a30'); }
  dome(DM, 3.15, 2.9, 18.45, ['#53689a', '#d4d2c6', '#b5875c'], (i, j) => j % 3 === 0 ? 2 : (i + j) % 2, 24, 6);
  cyl('flat', 0.62, 0.7, 0.6, 8, { M: DM, p: [0, 21.25, 0], c: '#c4b498', noao: true }); dome(DM, 0.62, 0.55, 21.85, ['#cbbd9e'], () => 0, 8, 3);
  cross(DM, 0, 22.35, 0, 0.8);
  const o = end('Chiesa di San Giovanni dei Napoletani');
  o.userData.solids = [[GN.p, null, y0 + 15.9]];
  return o;
}

// =====================================================================================================
// Oratorio di San Lorenzo
// =====================================================================================================
const SL = { id: 'w233500615', id2: 'w1499547079', p: [438.5, -111.8, 433.4, -121.0, 434.5, -121.7, 442.4, -126.1, 444.8, -127.5, 448.9, -120.4, 449.9, -118.5, 445.9, -116.1], p2: [433.4, -121.0, 427.9, -126.9, 429.1, -127.8, 434.5, -121.7] };
const SLT = [-4.05, 8.1, 4.4], SLO = '#b96b3c';
function slPaint(g, w, h) {
  const p = pen(g, w, h, SLT[0], SLT[1], SLT[2]), { R, circ, line, poly, ledge, strip } = p;
  base(g, w, h, SLO, 12601, 0.1);
  // the moulded frame, the open door: the dark leaf on the left, the light of the courtyard and its steps
  R(-1.35, 0, 1.15, 3.55, '#b0653a'); R(-1.18, 0, 0.98, 3.38, '#c27a4a'); R(-1.0, 0, 0.8, 3.2, '#8f4e2c'); ledge(-1.45, 3.45, 1.25, 3.65, '#bc7044');
  R(-0.85, 0, 0.65, 3.05, '#e8ddc8'); R(-0.85, 2.3, 0.65, 3.05, '#cfc4b0'); for (let i = 0; i < 5; i++) { R(-0.1, i * 0.22, 0.65, i * 0.22 + 0.18, '#c9b7a0'); R(-0.1, i * 0.22 + 0.18, 0.65, i * 0.22 + 0.22, '#7a6a58'); }
  R(0.25, 1.1, 0.45, 2.2, '#4a3a2c');
  poly([[-0.85, 0], [-0.12, 0.22], [-0.12, 2.85], [-0.85, 3.05]], '#3d2a20'); for (const [a, b] of [[0.3, 0.9], [1.05, 1.7], [1.85, 2.3], [2.4, 2.8]]) { poly([[-0.75, (a + b) / 2], [-0.48, b], [-0.2, (a + b) / 2], [-0.48, a]], '#5a4032'); circ(-0.48, (a + b) / 2, 0.08, '#2c1d15'); }
  // the signs to the right of the door
  circ(1.9, 2.5, 0.36, '#d8c8b0', 0.46); circ(1.9, 2.5, 0.32, '#6e2a20', 0.42); for (const [y, hw] of [[2.68, 0.16], [2.52, 0.24], [2.4, 0.2], [2.24, 0.12]]) R(1.9 - hw, y, 1.9 + hw, y + 0.045, '#e6dccb');
  circ(1.85, 1.55, 0.22, '#5a4426'); circ(1.85, 1.55, 0.16, '#8a6c3c'); R(1.22, 2.3, 1.46, 2.5, '#d9d2c2'); R(-1.75, 1.5, -1.62, 1.72, '#4a3a30');
  // the damp base course
  ledge(-4.05, 1.0, -1.45, 1.1, '#bc7044'); ledge(1.25, 1.0, 4.05, 1.1, '#bc7044');
  streaks(g, w, h * 0.5, 0, 1, 0, 1); const r = RNG(12602); for (let i = 0; i < 70; i++) { const x = (r() < 0.5 ? -4.05 + r() * 2.6 : 1.25 + r() * 2.8), len = 0.15 + r() * 0.75, gr = g.createLinearGradient(0, p.Y(1.0), 0, p.Y(1.0 - len)); gr.addColorStop(0, 'rgba(40,24,14,0.5)'); gr.addColorStop(1, 'rgba(40,24,14,0)'); g.fillStyle = gr; g.fillRect(p.X(x), p.Y(1.0), (0.05 + r() * 0.2) * p.sx, len * p.sy); }
  wear(g, w, h, 12603, 18, 0.18, 0.1);
}
function buildLorenzo() {
  initShared();
  // the courtyard wall on the street
  const A = [433.4, -121.0], Bq = [427.9, -126.9], dx = Bq[0] - A[0], dz = Bq[1] - A[1], l = Math.hypot(dx, dz), N = [dz / l, -dx / l], O = [(A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2];
  const S = site(SL.p2, O, N), y0 = groundY(...S.W(-0.1, 0.4)), F = frame(O[0], y0, O[1], N[0], N[1]);
  defMat('c1LorenzoWall', 256, 144, [SLT[1], SLT[2]], slPaint);
  begin(y0);
  prism('plaster', S.pts.map((q, i) => i < 2 ? [q[0] - N[0] * 0.06, q[1] - N[1] * 0.06] : q), S.lo, y0 + 4.25, { c: '#c4744a' });
  face('c1LorenzoWall', SLT, F, rect(-l / 2, 0, l / 2, 4.3), -0.1, 0.03);
  B(F, -l / 2, l / 2, 4.25, 4.45, -0.6, 0.18, '#a9603a');
  for (const s of [-1, 1]) B(F, -0.1 + s * 1.12 - 0.12, -0.1 + s * 1.12 + 0.12, 0, 3.4, 0, 0.13, '#b96e44');
  B(F, -1.45, 1.25, 3.43, 3.65, 0, 0.22, '#b56a40'); B(F, -0.95, 0.75, -0.2, 0.14, -0.02, 0.3, '#a59c8c');
  // the hall of the oratory: plain orange walls, a stone foot, a tiled roof along its length
  const H = pairsOf(SL.p), hl = Math.min(groundRange(H).lo, y0) - 1.5, hy = Math.min(groundY(436, -116.4), groundY(438.5, -111.8), groundY(433.4, -121.0));
  prism('plaster', H, hl, hy + 8.5, { c: '#bd7348' }); prism('flat', H, hy + 8.5, hy + 8.64, { c: '#9d6248', noao: true });
  const RM = frame((438.5 + 433.4) / 2, hy, (-111.8 - 121.0) / 2, -0.875, 0.485);
  B(RM, -5.25, 5.25, 0, 0.9, -0.1, 0.07, '#a08e78'); B(RM, -5.35, 5.35, 8.3, 8.66, -0.3, 0.22, '#cf9066');
  const loc = (x, z) => { const mx = x - 435.95, mz = z + 116.4; return [mx * 0.485 + mz * 0.875, -mx * 0.875 + mz * 0.485]; };
  roof(RM, [loc(433.6, -121.0), loc(438.5, -112.1), loc(448.9, -118.6), loc(444.3, -126.8)], 8.64, 1.7, '#a8704e', '#bd7348');
  const o = end('Oratorio di San Lorenzo');
  o.userData.solids = [[SL.p, null, hy + 8.5], [SL.p2, null, y0 + 4.25]];
  return o;
}

export const R2_C1 = [
  { name: 'Chiesa di San Francesco di Paola', x: -737, z: -668, radius: 35, skipIds: [FP.id, FP.id2], build: buildPaola, walls: outline(FP.O, FP.N, [[-7.3, -0.4], [-7.3, 0.25], [-2.5, 0.4], [-2.5, 0.52], [2.5, 0.52], [2.5, 0.4], [6.75, 0.25], [11.7, 0.25], [11.7, -4.55], [8.5, -4.55]]) },
  { name: "Chiesa dell'Immacolata Concezione al Capo", x: -627, z: -278, radius: 30, skipIds: [IC.id], build: buildCapo },
  { name: 'Chiesa di Santa Maria di Monte Oliveto', x: -446, z: 96, radius: 30, skipIds: [MO.id], build: buildOliveto, walls: outline(MO.O, MO.N, [[-2.5, 0], [-2.5, 0.9], [-1.5, 0.9], [-1.5, 0.1], [1.5, 0.1], [1.5, 0.9], [2.5, 0.9], [2.5, 0]]) },
  { name: 'Chiesa di Santa Chiara', x: -118, z: 294, radius: 35, skipIds: [CH.id], build: buildChiara, walls: outline(CH.O, CH.N, [[-6.65, -0.2], [-6.65, 0.42], [-5.25, 0.42], [-5.25, 0.15], [-3.2, 0.15], [-3.2, 0.5], [3.2, 0.5], [3.2, 0]]) },
  { name: 'Chiesa di San Giovanni dei Napoletani', x: 685, z: -323, radius: 25, skipIds: [GN.id], build: buildNapoletani },
  { name: 'Oratorio di San Lorenzo', x: 440, z: -119, radius: 25, skipIds: [SL.id, SL.id2], build: buildLorenzo },
];
