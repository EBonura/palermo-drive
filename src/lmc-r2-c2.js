// Round 2 landmarks, batch C2: six churches and oratories that were drawn by the generic builder. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Sizes along the ground come from the footprints; heights and positions on the fronts were read by fitting the camera of a photo to the footprint
// and intersecting its rays with the wall plane (Valdese, Montevergini, Bianchi, San Filippo Neri, Cosma e Damiano flank) or from proportions in a nearly square photo (Isola, the narrow fronts),
// so treat them as good to about half a metre where fitted and about a metre elsewhere.
// Each place: frame with the origin on the ground in the front, +z out of the front, local x along the front (right as seen from outside). One painted texture each plus the shared flat colour (and the shared
// rail at the Oratorio). Collision is the footprints; walls are added only round the Valdese steps, the free standing arch, the recesses at the ZEN church and the wider front at Isola.
//
// Chiesa Valdese di via Spezio (w204272310). Front to the south west, Via della Spezio on its right. Wikimedia Commons "Temple vaudoise Palerme ext" to "ext6" (2025) and "Palermo-Chiesa-Valdese-bjs2007-01" (2007).
//  Read: a sandstone neo gothic front: porch of three pointed arches with roped mouldings on two marble columns, a pierced lattice band, a square panel with a round mosaic and four rosettes, small merlons,
//  two square towers with panelled stages, pointed niches and bracketed caps, the nave gable with a rosette frieze and a stone cross set back behind, two doors, a plaque and a mosaic inside the porch, steps.
//  Not drawn: the iron fence and gate pillars, the garden. Not verified: the north west flank, the back, the roofs behind the front, the windows on the street flank beyond the first bays.
// Teatro Nuovo Montevergini, the former Santa Maria delle Grazie di Montevergine (w279885898 front block, w279883117 nave, w279884265 tower side). Front to the north east on Via Montevergini.
//  Commons "Chiesa di Santa Maria delle Grazie di Montevergine (Palermo)" (2013) and "SMGM (Palermo) 14 07 2019 01" to "05". Read: two orders of carved brown stone with paired pilasters, a white middle bay
//  with the door and a relief, two statues in shell niches, a tall window under a curved pediment, a triangular pediment with a cartouche, a plain stone storey above with five half round windows and a white
//  top wall, and the bell tower on the left with arched openings, a tiled cushion cap, a ball and a cross. Not verified: the nave, apse and roofs (seen only from above), the sides, the depth of the tower.
// Oratorio dei Bianchi (w279885091, w279885047, w279886942, w279886958, w279885211, w279884825, w279884464, w279884296). The map's own outline of this name (w576424974) lies at the Magione and is wrong:
//  the building is at Piazzetta dei Bianchi near the Spasimo, where the photos and the footprint shapes agree. Commons "Palermo-Oratorio-dei-Bianchi-bjs-01" (2007), "Oratorio dei Bianchi 2" (2009),
//  "Oratorio dei Bianchi, Frontansicht" and "Seitenansicht" (2019), "Palermo - oratorio dei Bianchi - 2026-09-03 09-20-08 001" to "003". Read: at the south east end the square loggia of rusticated stone arches
//  with iron gates, a balcony, white upper walls between fluted pilasters, two windows with curved pediments on each open face and a tiled hip roof, with one more arch standing free to the south west;
//  along the north east side a white house with framed windows and balconies under a rough stone upper storey; at the north west end the cream church front with five windows, a round window, a balustraded
//  arched window, three doors, garlands, urns and an iron cross, and a sloping wing on its left. Not verified: the south west side, how the two ends meet inside, the roofs behind the front.
// Chiesa di San Filippo Neri, ZEN (r3785527). Front to the south west on its forecourt. Photos in two news pages: vaticannews.va, 3 January 2026 (day, from the forecourt) and lasicilia.it, 6 January 2026
//  (night). Read: low flat roofed blocks clad in pale travertine that step in and out, a taller block on the left with four square windows, a door block with a blue VIVA MARIA panel, dark doors, small blue
//  squares, white statues between the blocks and a tall stone cross behind. Not drawn: the forecourt steps and walls, the palms. Not verified: the blocks right of the middle (seen at a slant), every other
//  side, the roofs.
// Chiesa dei Santi Cosma e Damiano, Sferracavallo (w87015592). Front to the north west. Mapillary 3022907781364678, 247801260466943, 493062468798180 (October 2019, the north east flank and its corner, the
//  front hidden by festival lights) and the night view of the door on open.online (September 2025). Read: pale yellow plaster over a light base, fluted corner pilasters on high pedestals, two upper windows,
//  a door and the parish's yellow notice board on the flank, an eaves cornice; on the front a tall framed door between fluted pilasters and a framed picture of the two saints above it.
//  Not verified: everything above that picture (a plain gable is drawn to follow the tiled roof in the 2013 orthophoto), any bell tower, the south west flank, the back.
// Maria Santissima delle Grazie, Isola delle Femmine (w170024536). Front to the south on its square (the footprint's south edge, on the pedestrian side). vivasicilia.com, pages on the sanctuary and on the town (photos of the front). Read: white plaster with
//  yellow pilasters and capitals, a middle section with a pediment, round window, pedimented door and iron cross, a lower aisle each side with a round window and door, a tiled image on the right aisle, and
//  behind the right aisle the bell tower with a clock, a balustraded bell arch, paired arches and a small pediment. The front is wider than the footprint by about a metre each side, up to the buildings beside it.
//  Not verified: the flanks, back and roofs, the exact setback of the tower.
import * as THREE from 'three';
import { PI, bx, cyl, extrude, prism, sphere, part, gridMesh, begin, end, defMat, mul, tr, frame, groundY, initShared, pairsOf, groundRange, gable, statue, pyramid, rail, RNG } from './lmc-kit.js';

// ---- shared helpers
// the site of one building: footprint, frame (origin O on the front, outward normal N), the ground
function site(flat, O, N, probe = [-4, 0, 4]) {
  const pts = pairsOf(flat);
  const W = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const L = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
  const y0 = Math.min(...probe.map(x => groundY(...W(x, 0.6)))), lo = Math.min(groundRange(pts).lo, y0) - 1.5;
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  return { pts, W, L, y0, lo, F, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
// a footprint (flat world coordinates) kept behind z = zmax of the site S, as world points
function behind(S, flat, zmax) {
  const loc = pairsOf(flat).map(S.L), out = [];
  for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
  return out.map(q => S.W(q[0], q[1]));
}
// wall segments through the local points of a front frame
const outline = (O, N, p) => { const W = q => [O[0] + q[0] * N[1] + q[1] * N[0], O[1] - q[0] * N[0] + q[1] * N[1]]; return p.slice(1).map((q, i) => { const a = W(p[i]), b = W(q); return [a[0], a[1], b[0], b[1]]; }); };
const B = (M, x0, x1, y0, y1, z0, z1, c, o) => bx('flat', M, x0, x1, y0, y1, z0, z1, { c, noao: true, ...o });
const cross = (M, x, y, z, h, c = '#4a4036', t = 0.1) => { B(M, x - t / 2, x + t / 2, y, y + h, z - t / 2, z + t / 2, c); B(M, x - h * 0.28, x + h * 0.28, y + h * 0.64, y + h * 0.64 + t, z - t / 2, z + t / 2, c); };
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// the line of an arch from the left springing to the right one: half width r, springing s, rise v; pointed if k
const archLine = (x, r, s, v, k, n = 6) => {
  const o = [];
  if (!k) { for (let i = 0; i <= 2 * n; i++) { const a = PI - i / (2 * n) * PI; o.push([x + Math.cos(a) * r, s + Math.sin(a) * v]); } return o; }
  const q = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  for (let i = 0; i <= n; i++) o.push(q([x - r, s], [x - r, s + v * 0.68], [x, s + v], i / n));
  for (let i = 1; i <= n; i++) o.push(q([x, s + v], [x + r, s + v * 0.68], [x + r, s], i / n));
  return o;
};
// the inside face of an opening, running back from z0 to z1 along the line p (left to right over the top)
const reveal = (M, p, z0, z1, c) => gridMesh('flat', [p.map(q => [q[0], q[1], z0]), p.map(q => [q[0], q[1], z1])], () => [0, 0], { flip: true, M, c, noao: true });
// atlas regions: metres (x0.., y0.. up) drawn into the pixel rectangle px, py, pw, ph of a CW x CH canvas
const reg = (x0, y0, x1, y1, px, py, pw, ph) => ({ x0, y0, w: x1 - x0, h: y1 - y0, px, py, pw, ph });
// the outline p (region metres) as a one sided painted sheet at depth z of the frame M
const sheet = (key, CW, CH, A, M, p, z) => part(key, new THREE.ShapeGeometry(shapeOf(p), 1), { M, p: [0, 0, z], uv: 'keep', uvk: [A.pw / (A.w * CW), A.ph / (A.h * CH)], uvo: [(A.px - A.x0 * A.pw / A.w) / CW, (CH - A.py - A.ph - A.y0 * A.ph / A.h) / CH], noao: true });
// painter for one region
function pen(g, A) {
  const sx = A.pw / A.w, sy = A.ph / A.h, X = x => A.px + (x - A.x0) * sx, Y = y => A.py + A.ph - (y - A.y0) * sy;
  const R = (a, y0, b, y1, c) => { g.fillStyle = c; g.fillRect(X(a), Y(y1), (b - a) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const circ = (x, y, r, c, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, (ry || r) * sy, 0, 0, 2 * PI); g.fill(); };
  const ring = (x, y, r, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.stroke(); };
  const line = (a, y0, b, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(a), Y(y0)); g.lineTo(X(b), Y(y1)); g.stroke(); };
  const path = (p, t, c) => { for (let i = 1; i < p.length; i++) line(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], t, c); };
  const arch = (x, y0, y1, ww, c, k) => { const r = ww / 2, v = k ? Math.min(y1 - y0, r * 1.35) : r; poly([[x - r, y0], ...archLine(x, r, y1 - v, v, k), [x + r, y0]], c); };
  // a ledge: lit on top, shadow under it
  const ledge = (a, y0, b, y1, c) => { R(a, y0, b, y1, c); R(a, y1 - Math.min(0.14, (y1 - y0) / 2), b, y1, 'rgba(255,240,215,0.35)'); R(a, y0 - 0.22, b, y0, 'rgba(45,28,15,0.38)'); };
  // an upright strip with a lit and a shaded edge, optionally fluted
  const strip = (a, y0, b, y1, c, flutes = 0) => { R(a, y0, b, y1, c); R(a, y0, a + 0.08, y1, 'rgba(255,240,215,0.32)'); R(b, y0, b + 0.13, y1, 'rgba(45,28,15,0.34)'); for (let i = 1; i <= flutes; i++) { const x = a + (b - a) * i / (flutes + 1); R(x - 0.04, y0 + 0.2, x + 0.03, y1 - 0.2, 'rgba(45,28,15,0.3)'); } };
  // ashlar courses
  const ashlar = (a, y0, b, y1, c, seed, course = 0.5, block = 1.1, k = 1) => {
    R(a, y0, b, y1, c); const r = RNG(seed);
    for (let y = y0; y < y1 - 0.01; y += course) {
      let x = a - r() * block; const t = Math.min(y1, y + course);
      while (x < b) { const bw = block * (0.7 + r() * 0.6), l = Math.max(a, x), q = Math.min(b, x + bw); if (q > l) { const v = r(); R(l, y, q, t, v < 0.5 ? `rgba(55,33,15,${v * 0.3 * k})` : `rgba(255,230,190,${(v - 0.5) * 0.28 * k})`); R(l, y, l + 0.05, t, `rgba(60,38,20,${0.28 * k})`); } x += bw; }
      R(a, y, b, y + 0.05, `rgba(60,38,20,${0.32 * k})`);
    }
  };
  return { g, A, X, Y, R, poly, circ, ring, line, path, arch, ledge, strip, ashlar };
}
// paints one region: clipped, with the base colour, the painter, then stains, streaks, foot grime and grain
function region(g, A, base, seed, wear, fn) {
  g.save(); g.beginPath(); g.rect(A.px, A.py, A.pw, A.ph); g.clip();
  g.fillStyle = base; g.fillRect(A.px, A.py, A.pw, A.ph);
  fn(pen(g, A));
  const r = RNG(seed), { px, py, pw, ph } = A;
  for (let i = 0; i < 7; i++) { const x = px + r() * pw, y = py + r() * ph, rad = (0.12 + r() * 0.22) * Math.max(pw, ph), c = r() < 0.6 ? '55,38,22' : '255,244,222', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${c},${wear * (0.6 + r() * 0.8)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(px, py, pw, ph); }
  for (let i = 0; i < pw / 7; i++) { const x = px + r() * pw, y = py + r() * ph * 0.8, len = ph * (0.06 + r() * 0.22), gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(40,30,20,${wear * (0.5 + r())})`); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 2.5, len); }
  if (A.y0 <= 0.1) { const gb = g.createLinearGradient(0, py + ph, 0, py + ph * 0.86); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(px, py + ph * 0.86, pw, ph * 0.14); }
  for (let i = 0; i < pw * ph / 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,235,0.08)' : 'rgba(50,40,28,0.1)'; g.fillRect(px + r() * pw, py + r() * ph, 1 + r() * 1.3, 1 + r() * 1.3); }
  g.restore();
}

// =====================================================================================================
// Chiesa Valdese
// =====================================================================================================
const VA = { id: 'w204272310', p: [-306.8, -1063.4, -284.0, -1105.7, -296.4, -1112.3, -319.2, -1070.0], O: [-313.0, -1066.7], N: [-0.47, 0.883] };
const VAS = '#bda586', VAD = '#9c8568', VAL = '#cfbb9c';
const VF = reg(-5.1, 4.9, 5.1, 12.5, 0, 0, 256, 192), VB = reg(-5.1, 1.3, 5.1, 9.0, 0, 192, 256, 192), VT = reg(0, 0, 1.94, 13.7, 256, 0, 64, 384), VC = reg(-1.3, 13.7, 1.3, 15.34, 320, 0, 64, 40), VG = reg(-5.2, 9.0, 5.2, 16.5, 320, 40, 64, 96);
const VAA = [[-3.6, 1.35, 5.0, 2.05], [0, 1.75, 5.0, 2.55], [3.6, 1.35, 5.0, 2.05]];   // the porch arches: centre, half width, springing, rise
function vaTex(g) {
  region(g, VF, VAS, 21001, 0.08, (p) => {
    const { R, circ, ring, line, path, ledge, strip, ashlar } = p;
    ashlar(-5.1, 4.9, 5.1, 9.0, VAS, 21002, 0.55, 1.3, 0.55);
    for (const [x, r, s, v] of VAA) { path(archLine(x, r + 0.36, s, v + 0.38, 1, 8), 0.16, '#d3c1a2'); path(archLine(x, r + 0.22, s, v + 0.23, 1, 8), 0.12, '#7f6a52'); path(archLine(x, r + 0.08, s, v + 0.09, 1, 8), 0.14, '#d9c8aa'); const q = archLine(x, r + 0.08, s, v + 0.09, 1, 14); q.forEach(c => circ(c[0], c[1], 0.055, '#6f5a44')); }
    for (const x of [-1.95, 1.95]) strip(x - 0.08, 7.0, x + 0.08, 9.0, VAL);
    // the pierced lattice between two cornices, and the parapet over it
    R(-5.1, 9.15, 5.1, 10.05, '#57483a');
    for (let x = -5.2; x < 5.2; x += 0.46) { line(x, 9.15, x + 0.23, 10.05, 0.08, VAL); line(x + 0.23, 10.05, x + 0.46, 9.15, 0.08, VAL); line(x + 0.23, 9.15, x + 0.23, 9.55, 0.05, VAL); }
    ledge(-5.1, 8.9, 5.1, 9.2, VAL); ledge(-5.1, 10.0, 5.1, 10.28, VAL);
    R(-5.1, 10.28, 5.1, 11.2, '#b9a284'); for (let x = -4.8; x < 5; x += 0.52) circ(x, 10.85, 0.13, '#6b5a47');
    // the square panel with its round mosaic and four rosettes
    R(-1.9, 9.0, 1.9, 12.5, '#c4ad8c'); ledge(-1.9, 12.2, 1.9, 12.45, VAL); strip(-1.9, 9.0, -1.72, 12.2, VAL); strip(1.72, 9.0, 1.86, 12.2, VAL); ledge(-1.9, 9.0, 1.9, 9.22, VAL);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { circ(a * 1.25, 10.66 + b * 1.17, 0.36, VAD); ring(a * 1.25, 10.66 + b * 1.17, 0.27, 0.1, '#e0d0b2'); circ(a * 1.25, 10.66 + b * 1.17, 0.1, '#6f5a44'); }
    circ(0, 10.66, 1.45, '#8d775c'); ring(0, 10.66, 1.34, 0.14, '#ddcdb0'); ring(0, 10.66, 1.12, 0.1, '#6f5a44');
    circ(0, 10.66, 1.02, '#ddd6c2'); ring(0, 10.66, 0.86, 0.12, '#4f7a62'); circ(0, 10.66, 0.72, '#2c4d8c'); circ(0, 10.9, 0.34, '#d9b25a'); R(-0.07, 10.15, 0.07, 10.9, '#efe8d4'); circ(0, 11.05, 0.1, '#f4d98a');
    for (let i = 0; i < 7; i++) { const a = PI * (0.1 + i * 0.133); circ(Math.cos(a) * 0.55, 10.7 + Math.sin(a) * 0.5, 0.055, '#e9e2cf'); }
  });
  region(g, VB, '#a8937a', 21003, 0.08, (p) => {
    const { R, circ, path, poly, arch, ledge, strip, line } = p;
    for (const x of [-3.4, 0, 3.4]) { path([[x - 1.4, 1.38], ...archLine(x, 1.4, 5.0, 2.2, 1, 8), [x + 1.4, 1.38]], 0.14, '#c2ae90'); path([[x - 1.15, 1.38], ...archLine(x, 1.15, 4.9, 1.85, 1, 8), [x + 1.15, 1.38]], 0.08, '#76624c'); }
    for (const x of [-4.95, -1.75, 1.75, 4.95]) strip(x - 0.09, 1.38, x + 0.06, 5.2, '#bba789');
    // the middle door with the mosaic over it
    R(-0.85, 1.38, 0.85, 4.25, '#c4b092'); R(-0.66, 1.38, 0.66, 4.05, '#2e2620'); R(-0.02, 1.38, 0.02, 4.05, '#15100c'); for (const s of [-1, 1]) for (let y = 1.6; y < 3.8; y += 0.75) R(s * 0.35 - 0.2, y, s * 0.35 + 0.2, y + 0.55, '#41372e');
    arch(0, 4.45, 6.1, 1.45, '#d9cba8', 1); arch(0, 4.55, 5.95, 1.2, '#3a7a63', 1); circ(0, 5.3, 0.27, '#d9b25a'); R(-0.05, 4.75, 0.05, 5.3, '#f1ead6'); R(-0.5, 4.62, 0.5, 4.82, '#2c4d8c');
    // two doors and the marble plaque on the left, a panelled bay on the right
    for (const x of [-4.0, -2.75]) { R(x - 0.46, 1.38, x + 0.46, 3.95, '#c0ac8e'); R(x - 0.36, 1.38, x + 0.36, 3.82, '#403830'); for (let y = 1.6; y < 3.5; y += 0.68) R(x - 0.24, y, x + 0.24, y + 0.5, '#514840'); }
    R(-4.4, 4.12, -2.35, 5.05, '#e6e2d8'); for (let y = 4.25; y < 4.95; y += 0.16) R(-4.25, y, -2.5, y + 0.045, '#6a655c');
    R(2.7, 1.38, 4.1, 3.95, '#917c63'); R(2.85, 1.5, 3.95, 3.8, '#a28d72'); poly([[2.7, 4.1], [4.1, 4.1], [3.4, 5.0]], '#917c63'); line(3.4, 1.5, 3.4, 3.8, 0.05, '#76624c');
    ledge(-5.1, 8.45, 5.1, 8.75, '#bba789');
    p.g.fillStyle = 'rgba(30,20,12,0.22)'; p.g.fillRect(VB.px, VB.py, VB.pw, VB.ph * 0.45);
  });
  region(g, VT, VAS, 21004, 0.09, (p) => {
    const { R, circ, path, arch, ledge, strip, ashlar } = p;
    ashlar(0, 0, 1.94, 13.7, VAS, 21005, 0.6, 1.0, 0.45);
    ledge(0, 0, 1.94, 0.9, '#a8927a');
    R(0.3, 1.4, 1.64, 4.4, VAL); R(0.43, 1.53, 1.51, 4.27, VAD); R(0.52, 1.62, 1.42, 4.18, '#b39c7f');
    ledge(0, 4.7, 1.94, 5.0, VAL);
    path([[0.35, 5.25], ...archLine(0.97, 0.62, 7.45, 0.95, 1), [1.59, 5.25]], 0.13, '#dccbac'); arch(0.97, 5.3, 8.1, 0.96, '#8f7a61', 1); arch(0.97, 5.4, 7.85, 0.7, '#a8927a', 1);
    ledge(0, 8.65, 1.94, 8.85, VAL); R(0.35, 9.15, 1.59, 10.25, VAL); R(0.48, 9.28, 1.46, 10.12, '#a8927a');
    ledge(0, 10.55, 1.94, 10.85, VAL);
    path([[0.34, 11.0], ...archLine(0.97, 0.63, 12.55, 0.9, 1), [1.6, 11.0]], 0.12, '#dccbac'); for (const x of [0.67, 1.27]) arch(x, 11.1, 12.75, 0.36, '#59493a', 1); R(0.91, 11.0, 1.03, 13.3, '#d3c1a2'); R(0.42, 12.55, 1.52, 12.68, '#d3c1a2'); circ(0.97, 12.95, 0.16, '#59493a');
    ledge(0, 13.45, 1.94, 13.7, VAL);
  });
  region(g, VC, VAS, 21006, 0.08, (p) => { const { R, circ, ring, ledge } = p; ledge(-1.3, 15.1, 1.3, 15.34, VAL); for (const x of [-0.8, 0, 0.8]) { circ(x, 14.62, 0.33, '#5f4e3d'); ring(x, 14.62, 0.3, 0.09, VAL); circ(x, 14.62, 0.09, VAL); R(x + 0.36, 13.7, x + 0.44, 15.1, VAL); } ledge(-1.3, 13.7, 1.3, 13.95, VAL); });
  region(g, VG, '#bca283', 21007, 0.08, (p) => { const { line, circ } = p; p.ashlar(-5.2, 9, 5.2, 16.5, '#bba284', 21008, 0.6, 1.2, 0.4); for (const s of [-1, 1]) { line(s * 5.2, 13.1, 0, 16.45, 0.28, VAL); line(s * 5.2, 12.25, 0, 15.6, 0.16, VAL); for (let i = 1; i < 8; i++) circ(s * 5.2 * (1 - i / 8), 12.65 + 3.35 * i / 8, 0.24, '#6b5a47'); } });
}
function buildValdese() {
  initShared();
  const S = site(VA.p, VA.O, VA.N, [-5, 0, 5]), { F, y0, lo, at } = S, K = 'c2Valdese';
  defMat(K, 384, 384, [1, 1], vaTex);
  const SH = (A, M, p, z) => sheet(K, 384, 384, A, M, p, z);
  begin(y0);
  const body = behind(S, VA.p, -4.5);
  prism('flat', body, lo, y0 + 11.0, { c: '#b59e80' }); prism('flat', body, y0 + 11.0, y0 + 11.12, { c: '#8d8478', noao: true });
  // the nave gable behind the porch, its roof and the stone cross
  SH(VG, F, [[-5.2, 11.1], [5.2, 11.1], [5.2, 13.1], [0, 16.45], [-5.2, 13.1]], -4.5);
  B(F, -5.2, 5.2, 8.9, 11.1, -4.75, -4.52, '#b59e80');
  gable('flat', 'flat', at(0, 0, -13.6), 10.2, 17.8, 13.05, 3.3, { ov: 0.05, c: '#a8745a', wc: '#b59e80' }); B(F, -5.1, 5.1, 11.1, 13.1, -22.5, -4.76, '#b39c7e');
  B(F, -0.14, 0.14, 16.35, 17.8, -4.75, -4.47, '#cbb897'); B(F, -0.52, 0.52, 17.1, 17.38, -4.75, -4.47, '#cbb897');
  // the porch: floor, back wall, side walls, ceiling
  B(F, -5.1, 5.1, lo - y0, 1.38, -4.5, -0.8, '#a9a297');
  SH(VB, F, rect(-5.08, 1.36, 5.08, 8.92), -4.47);
  for (const s of [-1, 1]) B(F, s * 5.06, s * 6.98, lo - y0, 9.0, -4.55, -1.9, '#ad977b');
  B(F, -5.06, 5.06, 8.7, 9.0, -4.5, -1.1, '#75634f');
  // the arcade on two marble columns
  const edge = [[-5.08, 5.0]];
  for (const [x, r, s, v] of VAA) edge.push(...archLine(x, r, s, v, 1));
  SH(VF, F, [...edge, [5.08, 5.0], [5.08, 11.2], [-5.08, 11.2]], -0.8);
  for (const [x, r, s, v] of VAA) reveal(F, archLine(x, r, s, v, 1), -0.8, -1.35, '#98826a');
  for (const x of [-2.05, 2.05]) { cyl('flat', 0.19, 0.23, 3.0, 8, { M: F, p: [x, 1.6, -1.0], c: '#d6cfc0', noao: true }); B(F, x - 0.34, x + 0.34, 1.38, 1.62, -1.34, -0.66, '#cbc3b2'); B(F, x - 0.27, x + 0.27, 4.55, 4.8, -1.28, -0.72, '#d3c8b2'); B(F, x - 0.36, x + 0.36, 4.8, 5.02, -1.37, -0.68, '#cfbd9e'); }
  B(F, -5.1, 5.1, 8.92, 9.16, -0.82, -0.58, VAL); B(F, -5.1, 5.1, 10.05, 10.28, -0.82, -0.62, VAL);
  for (let x = 2.15; x < 4.9; x += 0.52) for (const s of [-1, 1]) { B(F, s * x - 0.17, s * x + 0.17, 11.2, 11.62, -1.0, -0.82, VAL); B(F, s * x - 0.09, s * x + 0.09, 11.62, 11.86, -0.98, -0.84, VAL); }
  B(F, -1.9, 1.9, 11.2, 12.45, -1.25, -0.72, VAD);
  SH(VF, F, rect(-1.9, 9.0, 1.9, 12.48), -0.64); for (const s of [-1, 1]) B(F, s * 1.9, s * 1.74, 8.95, 12.45, -0.82, -0.62, VAS);
  for (let x = -1.7; x <= 1.71; x += 0.425) B(F, x - 0.1, x + 0.1, 12.48, 12.86, -0.9, -0.66, VAL);
  // the two towers
  for (const s of [-1, 1]) {
    const cx = s * 6.03;
    B(F, cx - 0.95, cx + 0.95, lo - y0, 13.7, -1.92, -0.02, VAS);
    SH(VT, at(cx - 0.97, 0, 0), rect(0, 0, 1.94, 13.7), 0);
    for (const t of [-1, 1]) SH(VT, mul(at(cx + t * 0.97, 0, -0.97), new THREE.Matrix4().makeRotationY(t * PI / 2)).multiply(tr(-0.97, 0, 0)), rect(0, 0, 1.94, 13.7), 0);
    for (const y of [4.7, 10.55]) B(F, cx - 1.1, cx + 1.1, y, y + 0.28, -2.05, 0.12, VAL);
    B(F, cx - 1.22, cx + 1.22, 13.75, 15.1, -2.2, 0.26, VAS); B(F, cx - 1.34, cx + 1.34, 15.1, 15.34, -2.32, 0.38, VAL);
    for (let k = 0; k < 4; k++) { const M = mul(at(cx, 0, -0.97), new THREE.Matrix4().makeRotationY(k * PI / 2)); SH(VC, M, rect(-1.22, 13.75, 1.22, 15.1), 1.235); for (const x of [-1.0, 1.0]) B(M, x - 0.09, x + 0.09, 13.35, 13.75, 0.96, 1.2, VAL); }
  }
  // the steps between the towers
  for (let i = 0; i < 8; i++) B(F, -4.95, 4.95, -0.4, 1.38 - (i + 1) * 0.165, -0.8 + i * 0.3, -0.5 + i * 0.3, i % 2 ? '#b4ada0' : '#aaa396');
  // the street flank: cornice, quatrefoil parapet, pointed windows
  const a = [-284.0, -1105.7], b = [-306.8, -1063.4], dx = a[0] - b[0], dz = a[1] - b[1], l = Math.hypot(dx, dz), E = frame(b[0], y0, b[1], -dz / l, dx / l);
  B(E, 0, l, 10.5, 10.75, -0.1, 0.16, VAL); B(E, 0, l, 11.1, 11.75, -0.2, 0.02, '#b59e80');
  for (let d = 1.2; d < l; d += 3.0) B(E, d, d + 0.3, 11.75, 12.05, -0.18, 0.0, VAL);
  for (let d = 7.5; d < l - 2; d += 7.8) { for (const [w2, h2, y, c, z] of [[0.85, 4.3, 3.6, VAL, 0.0], [0.6, 4.0, 3.75, '#4c4238', 0.04]]) { const p = [[d - w2, y], ...archLine(d, w2, y + h2 - w2 * 1.3, w2 * 1.3, 1, 3), [d + w2, y]]; extrude('flat', shapeOf(p), 0.04, { M: E, p: [0, 0, z], c, noao: true }); } }
  const o = end('Chiesa Valdese di via Spezio');
  o.userData.solids = [[VA.p, null, y0 + 11]];
  return o;
}

// =====================================================================================================
// Teatro Nuovo Montevergini
// =====================================================================================================
const MV = { id: 'w279885898', id2: 'w279883117', id3: 'w279884265', O: [-240.5, 44.8], N: [0.837, -0.548],
  p: [-244.3, 39.0, -236.7, 50.6, -239.6, 52.5, -244.0, 55.3, -245.0, 56.0, -252.5, 44.2],
  p2: [-274.8, 62.0, -274.0, 60.1, -270.4, 57.2, -271.2, 56.1, -252.5, 44.2, -245.0, 56.0, -263.3, 68.0, -263.9, 67.1, -266.8, 68.9, -268.9, 69.3, -271.0, 68.8, -272.9, 67.7, -273.5, 66.9, -274.2, 66.0, -274.8, 64.1],
  p3: [-236.7, 50.6, -234.5, 54.0, -237.6, 56.1, -239.6, 52.5] };
const MVF = reg(-6.95, 0, 6.95, 20.6, 0, 0, 256, 376), MVA = reg(-6.4, 17.4, 6.4, 27.2, 0, 376, 256, 136);
const MVS = '#9a7c5a', MVL = '#b99a72', MVD = '#6f563c', MVW = '#e2dccb';
function mvTex(g) {
  region(g, MVF, MVS, 22001, 0.12, (p) => {
    const { R, circ, ring, line, path, arch, ledge, strip, ashlar, poly } = p, r = RNG(22009);
    const carve = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) circ(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.07 + r() * 0.1, r() < 0.5 ? MVD : '#c0a27a'); };
    ashlar(-6.95, 0, 6.95, 20.6, MVS, 22002, 0.55, 1.1, 0.9);
    R(-6.95, 0, -2.2, 1.7, '#6d5138'); ashlar(-6.95, 0, -2.2, 1.7, '#755a3f', 22003, 0.75, 1.5, 1.2); ashlar(2.2, 0, 6.95, 1.7, '#755a3f', 22004, 0.75, 1.5, 1.2);
    // lower order: pilasters and capitals, the white middle bay, door, relief, niches
    for (const s of [-1, 1]) {
      for (const x of [2.65, 3.7, 6.45]) { strip(s * x - 0.34, 1.7, s * x + 0.34, 8.45, '#8c6e4d', 3); carve(s * x - 0.45, 7.75, s * x + 0.45, 8.5, 12); ledge(s * x - 0.45, 1.7, s * x + 0.45, 2.1, MVL); }
      R(s * 4.95 - 0.55, 3.9, s * 4.95 + 0.55, 6.1, '#83664a'); arch(s * 4.95, 3.9, 6.4, 0.9, '#4f3b28'); circ(s * 4.95, 6.05, 0.32, '#a98a62'); ledge(s * 4.95 - 0.65, 3.55, s * 4.95 + 0.65, 3.9, MVL); carve(s * 4.95 - 0.5, 2.9, s * 4.95 + 0.5, 3.4, 14); carve(s * 4.95 - 0.5, 6.7, s * 4.95 + 0.5, 7.1, 8);
    }
    R(-2.2, 0, 2.2, 8.6, MVW); R(-1.5, 0.55, 1.5, 5.75, '#a89068'); R(-1.28, 0.55, 1.28, 5.5, '#e9e6dc'); R(-0.82, 0.55, 0.82, 3.5, '#d6d3c8'); R(-0.02, 0.55, 0.02, 3.5, '#7a766c'); R(-0.62, 3.85, 0.62, 4.4, '#3a2c22');
    R(-1.15, 4.95, 1.15, 5.12, '#b33a2c'); R(-0.55, 4.62, 0.7, 4.7, '#b33a2c'); p.g.fillStyle = '#2c2622'; p.g.font = `bold ${Math.round(0.24 * MVF.ph / MVF.h * 1.2)}px sans-serif`; p.g.textAlign = 'center'; p.g.textBaseline = 'middle'; p.g.fillText('NUOVO MONTEVERGINI', p.X(0), p.Y(4.82), 2.4 * MVF.pw / MVF.w);
    for (let i = 0; i < 4; i++) R(-1.4, i * 0.14, 1.4, i * 0.14 + 0.1, i % 2 ? '#a8987c' : '#8a7a62');
    circ(0, 6.95, 0.75, '#a8895f', 0.85); circ(-0.5, 6.7, 0.45, '#9a7a52'); circ(0.55, 6.6, 0.42, '#a8895f'); carve(-0.8, 6.2, 0.8, 7.8, 40);
    // frieze and main cornice
    ledge(-6.95, 8.45, -2.2, 8.75, MVL); ledge(2.2, 8.45, 6.95, 8.75, MVL);
    R(-6.95, 8.75, 6.95, 9.7, '#8f7050'); carve(-6.8, 8.9, 6.8, 9.55, 150); ledge(-6.95, 9.65, 6.95, 10.35, MVL); for (let x = -6.8; x < 6.9; x += 0.34) R(x, 9.72, x + 0.15, 9.92, MVD);
    // upper order
    for (const s of [-1, 1]) {
      for (const x of [2.75, 3.65, 5.8]) { R(s * x - 0.36, 10.35, s * x + 0.36, 11.6, '#8a6c4c'); strip(s * x - 0.28, 11.75, s * x + 0.28, 15.7, '#a38563', 2); carve(s * x - 0.4, 15.15, s * x + 0.4, 15.75, 10); }
      arch(s * 4.65, 13.15, 15.35, 0.85, MVD); arch(s * 4.65 + 0.06, 13.2, 15.2, 0.6, '#8c6e4d'); circ(s * 4.65, 15.35, 0.34, '#b7976d'); R(s * 4.65 - 0.65, 12.45, s * 4.65 + 0.65, 13.0, MVL); carve(s * 4.65 - 0.6, 12.5, s * 4.65 + 0.6, 12.98, 18);
    }
    ledge(-6.6, 11.5, -1.7, 11.75, MVL); ledge(1.7, 11.5, 6.6, 11.75, MVL);
    for (const s of [-1, 1]) strip(s * 1.45 - 0.22, 10.35, s * 1.45 + 0.22, 14.7, MVL, 1);
    R(-1.12, 10.45, 1.12, 14.15, MVL); R(-0.88, 10.6, 0.88, 13.92, '#2f2a30');
    for (let x = -0.88; x < 1.4; x += 0.28) { line(x, 10.6, x - 0.7, 13.92, 0.025, '#6d6a78'); line(x - 0.7, 10.6, x, 13.92, 0.025, '#6d6a78'); }
    R(-0.07, 10.6, 0.07, 13.92, '#7a3328'); R(-0.88, 12.25, 0.88, 12.37, '#7a3328');
    R(-1.75, 14.7, 1.75, 15.2, MVL); carve(-1.6, 14.75, 1.6, 15.12, 40); ledge(-1.9, 15.2, 1.9, 15.4, MVL); path(archLine(0, 1.75, 15.5, 0.72, 0, 8), 0.26, MVL); circ(0, 15.55, 0.2, '#c0a27a');
    R(-6.4, 15.75, 6.4, 16.9, '#9a7c5a'); carve(-6.2, 16.35, 6.2, 16.8, 110); ledge(-6.4, 17.0, 6.4, 17.65, MVL); for (let x = -6.2; x < 6.3; x += 0.34) R(x, 17.05, x + 0.15, 17.22, MVD);
    // the pediment with its cartouche
    line(-6.4, 17.75, 0, 20.45, 0.4, MVL); line(6.4, 17.75, 0, 20.45, 0.4, MVL); line(-5.6, 17.75, 0, 20.05, 0.12, MVD); line(5.6, 17.75, 0, 20.05, 0.12, MVD);
    circ(0, 18.75, 0.72, '#b7976d', 0.8); ring(0, 18.75, 0.55, 0.12, MVD); circ(0, 18.7, 0.28, '#c9ac82'); carve(-1.1, 18.0, 1.1, 19.5, 40);
  });
  region(g, MVA, '#c4b294', 22005, 0.1, (p) => {
    const { R, circ, line, arch, ledge, strip, ashlar } = p;
    ashlar(-6.4, 20.3, 6.4, 24.4, '#c1ac8c', 22006, 0.45, 0.95, 0.8); R(-5.6, 17.4, 5.6, 20.3, '#d4cbb4');
    for (let i = -2; i <= 2; i++) { const x = i * 2.15; p.path(archLine(x, 0.88, 21.9, 1.05, 0, 6), 0.16, '#a8906c'); arch(x, 21.85, 22.97, 1.36, '#8c3b2e'); arch(x, 21.95, 22.86, 1.14, '#2f3a52'); R(x - 0.04, 21.9, x + 0.04, 22.85, '#8c3b2e'); }
    for (const x of [-6.05, 6.05]) strip(x - 0.3, 17.4, x + 0.3, 24.0, '#b39a76');
    ledge(-6.4, 21.5, 6.4, 21.75, '#cdbb9c'); ledge(-6.4, 23.9, 6.4, 24.4, '#cdbb9c');
    R(-6.4, 24.4, 6.4, 27.2, '#e6e3da'); R(-6.4, 27.0, 6.4, 27.2, '#b9b2a2');
    for (const x of [-4.2, -0.6, 3.0, 5.2]) R(x, 24.4, x + 0.14, 25.4 + (x * 7 % 1.3), 'rgba(150,110,50,0.4)');
    for (const x of [-3.2, 1.4]) { for (const d of [0, 0.35]) line(x + d, 24.9, x + d, 25.8, 0.07, '#4a4038'); line(x - 0.25, 25.3, x + 0.6, 25.3, 0.07, '#4a4038'); }
    for (const x of [-5.2, -1.2, 4.4]) { line(x, 25.4, x, 26.0, 0.06, '#4a4038'); line(x - 0.3, 26.4, x, 26.0, 0.06, '#4a4038'); line(x + 0.3, 26.4, x, 26.0, 0.06, '#4a4038'); }
  });
}
function buildMontevergini() {
  initShared();
  const S = site(MV.p, MV.O, MV.N, [-5, 0, 5]), { F, y0, lo, at } = S, K = 'c2Montevergini';
  defMat(K, 256, 512, [1, 1], mvTex);
  const SH = (A, M, p, z) => sheet(K, 256, 512, A, M, p, z);
  begin(y0);
  const lo2 = Math.min(groundRange(pairsOf(MV.p2)).lo, y0) - 1.5;
  // the front block: stone front, the storey set back over it, the white wall on top
  prism('flat', behind(S, MV.p, -0.1), lo, y0 + 17.3, { c: '#cfc6b0' });
  prism('flat', behind(S, MV.p, -1.0), y0 + 17.3, y0 + 24.4, { c: '#c3b498', noao: true });
  SH(MVF, F, [[-6.95, -0.6], [6.95, -0.6], [6.95, 10.35], [6.45, 10.35], [6.45, 17.6], [0, 20.55], [-6.45, 17.6], [-6.45, 10.35], [-6.95, 10.35]], 0.0);
  SH(MVA, F, rect(-6.35, 17.4, 6.35, 24.4), -0.95);
  B(F, -6.35, 6.35, 24.4, 27.05, -2.2, -1.05, '#dcd8cc'); SH(MVA, F, rect(-6.35, 24.4, 6.35, 27.15), -0.97);
  B(F, -6.5, 6.5, 24.15, 24.42, -1.2, -0.7, '#cdbb9c');
  // cornices, pilasters, the window head, the raking cornice
  B(F, -7.0, 7.0, 9.95, 10.35, -0.05, 0.22, MVL); B(F, -6.55, 6.55, 17.2, 17.62, -0.05, 0.22, MVL); B(F, -6.95, -2.2, 8.5, 8.75, -0.05, 0.16, '#a98a64'); B(F, 2.2, 6.95, 8.5, 8.75, -0.05, 0.16, '#a98a64'); B(F, -1.85, 1.85, 15.15, 15.4, -0.05, 0.2, MVL);
  for (const s of [-1, 1]) {
    for (const x of [2.65, 3.7, 6.45]) { B(F, s * x - 0.3, s * x + 0.3, 1.7, 8.45, -0.05, 0.09, '#8c6e4d'); B(F, s * x - 0.4, s * x + 0.4, 7.8, 8.45, -0.05, 0.15, '#9a7a56'); }
    for (const x of [2.75, 3.65, 5.8]) B(F, s * x - 0.25, s * x + 0.25, 11.75, 15.7, -0.05, 0.08, '#a38563');
    B(F, s * 4.95 - 0.62, s * 4.95 + 0.62, 3.55, 3.85, -0.05, 0.22, MVL); statue('flat', at(s * 4.95, 3.85, 0.14), 2.05, { c: '#8d7558', noao: true });
    B(F, s * 1.45 - 0.18, s * 1.45 + 0.18, 10.35, 14.7, -0.05, 0.1, MVL);
    const rl = Math.hypot(6.45, 2.95), ra = Math.atan2(2.95, 6.45);
    extrude('flat', shapeOf(rect(-rl / 2, -0.17, rl / 2, 0.17)), 0.3, { M: F, p: [s * 3.22, 19.0, -0.06], rz: -s * ra, c: MVL, noao: true });
  }
  // the bell tower on the left: a white wall below, the stone belfry, the tiled cap
  prism('flat', behind(S, MV.p3, 0), Math.min(groundRange(pairsOf(MV.p3)).lo, y0) - 1.5, y0 + 16.8, { c: '#dcd5c2' });
  const T = at(-8.65, 0, -1.9), H = 1.55;
  B(T, -H, H, 12, 24.0, -H, H, '#b29470');
  for (const [y, g] of [[16.8, 0.14], [19.6, 0.12], [22.9, 0.2], [24.0, 0.28]]) B(T, -H - g, H + g, y, y + 0.34, -H - g, H + g, MVL);
  for (let k = 0; k < 4; k++) {
    const M = mul(T, new THREE.Matrix4().makeRotationY(k * PI / 2));
    for (const x of [-0.65, 0.65]) { const p = [[x - 0.4, 20.1], ...archLine(x, 0.4, 21.7, 0.42, 0, 3), [x + 0.4, 20.1]].reverse(); extrude('flat', shapeOf(p), 0.04, { M, p: [0, 0, H], c: '#43301f', noao: true }); B(M, x - 0.34, x + 0.34, 22.3, 22.75, H, H + 0.07, '#8a6c4c'); }
  }
  const sq = (rt, rb, y, h, c) => cyl('flat', rt * Math.SQRT2, rb * Math.SQRT2, h, 4, { M: T, p: [0, y, 0], t0: PI / 4, c, noao: true });
  sq(1.62, 1.35, 24.34, 0.3, '#6f8a8c'); sq(1.68, 1.62, 24.64, 0.95, '#c08068'); sq(1.0, 1.68, 25.59, 0.6, '#b9755e'); sq(0.22, 0.62, 26.19, 1.05, '#a9806c');
  sphere('flat', 0.3, { M: T, p: [0, 27.5, 0], c: '#7d7a58', seg: 8, noao: true }); cross(T, 0, 27.7, 0, 1.3, '#3a342e');
  // the nave behind, with its rounded end and tiled roof
  const n = pairsOf(MV.p2);
  prism('flat', n, lo2, y0 + 22.6, { c: '#cbbfa8' }); prism('flat', n, y0 + 22.6, y0 + 22.75, { c: '#a89584', noao: true });
  gable('flat', 'flat', at(0, 0, -20.2), 12.6, 21, 22.75, 1.9, { ov: 0.2, c: '#a39080', wc: '#cbbfa8' });
  const o = end('Teatro Nuovo Montevergini');
  o.userData.solids = [[MV.p, null, y0 + 22], [MV.p2, null, y0 + 22], [MV.p3, null, y0 + 16]];
  return o;
}

// =====================================================================================================
// Oratorio dei Bianchi
// =====================================================================================================
const BI = {
  front: { id: 'w279885091', p: [900.2, -3.6, 903.2, -1.0, 910.7, 5.9, 902.3, 14.8, 892.5, 5.0] },
  wing: { id: 'w279885047', p: [907.4, -4.2, 918.8, 7.5, 916.0, 10.9, 910.7, 5.9, 903.2, -1.0] },
  core: { id: 'w279886942', p: [910.7, 5.9, 916.0, 10.9, 926.8, 21.3, 924.4, 23.6, 920.0, 27.7, 917.7, 30.1, 902.3, 14.8] },
  tall: { id: 'w279886958', p: [918.8, 7.5, 919.2, 8.0, 932.7, 22.0, 928.0, 26.5, 924.4, 23.6, 926.8, 21.3, 916.0, 10.9] },
  knot: { id: 'w279885211', p: [924.4, 23.6, 928.0, 26.5, 923.6, 31.0, 923.0, 31.6, 920.0, 27.7] },
  bay: { id: 'w279884825', p: [928.0, 26.5, 932.7, 22.0, 935.7, 25.0, 927.2, 33.9, 923.6, 31.0] },
  lg1: { id: 'w279884464', p: [935.7, 25.0, 938.9, 28.3, 928.9, 36.6, 927.2, 33.9] },
  lg2: { id: 'w279884296', p: [938.9, 28.3, 944.1, 33.7, 935.3, 41.7, 928.9, 36.6] },
  loggia: [935.7, 25.0, 944.1, 33.7, 935.3, 41.7, 928.9, 36.6, 927.2, 33.9],
  NE: [0.719, -0.695], OE: [935.7, 25.0], NS: [0.672, 0.74], OS: [939.7, 37.7], NW: [-0.745, -0.667], OW: [896.35, 0.7],
};
const BIL = reg(-6.1, 0, 6.1, 19.1, 0, 0, 168, 256), BIW = reg(-5.8, 0, 5.8, 16.5, 168, 0, 168, 256), BIX = reg(-2.7, 0, 2.7, 13.0, 336, 0, 64, 168), BIK = reg(0, 14, 12, 23.4, 400, 0, 112, 100), BIP = reg(0, 0, 40.8, 21.6, 0, 256, 512, 256);
const BIST = '#9c7a52', BIWH = '#e6e2d6', BITR = '#a8946e';
const BIARCH = [[-2.5, 1.65, 4.15, 1.65], [2.5, 1.65, 4.15, 1.65]];
function biTex(g) {
  region(g, BIL, '#a07d54', 23001, 0.12, (p) => {
    const { R, circ, line, path, ledge, strip, ashlar, poly } = p;
    // rusticated ground storey with voussoirs round the arches
    ashlar(-6.1, 0, 6.1, 8.2, '#a58156', 23002, 0.55, 1.7, 1.3);
    for (let y = 0.5; y < 6.2; y += 0.55) R(-6.1, y, 6.1, y + 0.12, 'rgba(45,28,12,0.4)');
    for (const [x, r, s, v] of BIARCH) {
      poly([...archLine(x, r + 0.65, s, v + 0.65, 0, 8), ...archLine(x, r - 0.02, s, v - 0.02, 0, 8).reverse()], '#ac885c');
      for (let i = 0; i <= 10; i++) { const a = PI - i / 10 * PI; line(x + Math.cos(a) * r, s + Math.sin(a) * v, x + Math.cos(a) * (r + 0.65), s + Math.sin(a) * (v + 0.65), 0.08, '#5c4228'); }
      path(archLine(x, r + 0.65, s, v + 0.65, 0, 8), 0.1, '#c49e6e'); circ(x, s + v + 0.35, 0.3, '#c09a6a', 0.45); circ(x - 0.1, s + v + 0.42, 0.06, '#4a3320'); circ(x + 0.1, s + v + 0.42, 0.06, '#4a3320'); R(x - 0.1, s + v + 0.1, x + 0.1, s + v + 0.18, '#4a3320');
    }
    for (const x of [-4.95, 0, 4.95]) { R(x - 0.45, 6.35, x + 0.45, 6.75, '#bd976a'); for (const d of [-0.2, 0.05]) R(x + d, 7.0, x + d + 0.14, 7.6, '#5f472c'); }
    ledge(-6.1, 7.7, 6.1, 8.6, '#ac895f');
    // upper storey: white walls between fluted pilasters, windows with curved pediments, entablature
    R(-6.1, 8.6, 6.1, 16.7, BIWH);
    for (const x of [-5.45, 0, 5.45]) { R(x - 0.68, 8.6, x + 0.68, 10.0, '#93724d'); strip(x - 0.52, 10.0, x + 0.52, 16.1, BIST, 3); for (let i = 0; i < 14; i++) circ(x - 0.5 + (i % 5) * 0.25, 16.1 + (i % 3) * 0.2, 0.15, i % 2 ? '#b79468' : '#6f5236'); }
    for (const x of [-2.5, 2.5]) {
      R(x - 1.25, 8.6, x + 1.25, 12.35, BIST); R(x - 0.8, 8.6, x + 0.8, 11.9, '#3d281c'); R(x - 0.68, 8.75, x - 0.06, 11.75, '#35505e'); R(x + 0.06, 8.75, x + 0.68, 11.75, '#35505e'); for (let y = 9.45; y < 11.7; y += 0.62) R(x - 0.7, y, x + 0.7, y + 0.07, '#6e4a30');
      ledge(x - 1.4, 12.35, x + 1.4, 12.62, '#b18e63'); poly([[x - 1.4, 12.62], ...archLine(x, 1.4, 12.62, 0.95, 0, 7), [x + 1.4, 12.62]], '#a58259'); poly([[x - 0.95, 12.7], ...archLine(x, 0.95, 12.7, 0.55, 0, 6), [x + 0.95, 12.7]], BIWH); path(archLine(x, 1.4, 12.65, 0.95, 0, 7), 0.12, '#c8a576');
    }
    ledge(-6.1, 16.7, 6.1, 17.1, '#b08c60'); R(-6.1, 17.1, 6.1, 18.1, '#96744e'); ledge(-6.1, 18.1, 6.1, 18.55, '#b08c60'); R(-6.1, 18.55, 6.1, 19.1, '#8d6c48');
  });
  region(g, BIW, '#e3dcc9', 23003, 0.09, (p) => {
    const { R, circ, ring, line, path, arch, ledge, strip, poly } = p, T = '#efeadb', Sh = '#bcb29a';
    R(-5.8, 0, 5.8, 1.35, '#8d8981'); for (const [x, y, w2] of [[-4.6, 1.35, 0.9], [1.9, 1.35, 1.5], [4.5, 1.4, 0.5]]) { circ(x, y, w2 * 0.6, '#a9a290', 0.35); }
    for (const x of [-5.4, -1.55, 1.55, 5.4]) { strip(x - 0.34, 1.35, x + 0.34, 15.2, '#e9e3d1'); for (const y of [2.0, 6.5, 10.2]) R(x - 0.15, y, x + 0.15, y + 2.6, '#ded6c1'); }
    // doors
    R(-1.4, 0, 1.4, 4.95, Sh); R(-1.15, 0, 1.15, 4.8, '#6d6a66'); R(-0.9, 0, 0.9, 4.5, '#23201f'); R(-0.02, 0, 0.02, 4.5, '#000'); for (const s of [-1, 1]) for (let y = 0.45; y < 4.2; y += 0.95) { R(s * 0.46 - 0.3, y, s * 0.46 + 0.3, y + 0.72, '#33302e'); R(s * 0.46 - 0.18, y + 0.18, s * 0.46 + 0.18, y + 0.54, '#292625'); }
    for (const s of [-1, 1]) { R(s * 1.55 - 0.25, 4.1, s * 1.55 + 0.25, 5.0, T); line(s * 1.55, 4.15, s * 1.55, 4.9, 0.1, Sh); }
    ledge(-2.15, 5.05, 2.15, 5.7, T);
    for (const x of [-3.35, 3.35]) { arch(x, 0.8, 3.85, 1.45, Sh); arch(x, 0.8, 3.65, 1.1, '#6a4128'); R(x - 0.02, 0.8, x + 0.02, 3.6, '#2f1b10'); for (let y = 1.15; y < 2.9; y += 0.8) { R(x - 0.42, y, x - 0.12, y + 0.55, '#7a4e30'); R(x + 0.12, y, x + 0.42, y + 0.55, '#7a4e30'); } for (let i = 0; i < 4; i++) R(x - 0.7, i * 0.2, x + 0.7, i * 0.2 + 0.15, i % 2 ? '#a29c90' : '#7f7a70'); }
    ledge(-5.8, 5.75, 5.8, 6.05, T);
    // the balustrade and the arched window over the door, two barred windows
    R(-0.95, 6.05, 0.95, 6.75, '#b3a98f'); for (let x = -0.8; x < 0.85; x += 0.27) R(x - 0.07, 6.12, x + 0.07, 6.65, T); R(-0.98, 6.65, 0.98, 6.8, T);
    arch(0, 6.8, 9.5, 2.0, Sh); arch(0, 6.8, 9.35, 1.68, '#3c2e22'); arch(0, 6.9, 9.22, 1.44, '#4d5456'); for (const x of [-0.36, 0.36, 0]) R(x - 0.03, 6.9, x + 0.03, 8.9, '#6d4c34'); R(-0.72, 8.45, 0.72, 8.55, '#6d4c34');
    poly([[-1.2, 9.6], [-0.4, 9.85], [0, 10.1], [0.4, 9.85], [1.2, 9.6], [0.5, 9.55], [0, 9.7], [-0.5, 9.55]], Sh); circ(0, 9.85, 0.24, T);
    const win = (x, y0, y1, grate) => { R(x - 0.75, y0 - 0.15, x + 0.75, y1 + 0.25, T); R(x - 0.55, y0, x + 0.55, y1, grate ? '#2b2521' : '#463a30'); if (grate) for (let u = -0.5; u < 1.1; u += 0.27) { line(x + u, y0, x + u - 0.6, y1, 0.03, '#6c625a'); line(x + u - 0.6, y0, x + u, y1, 0.03, '#6c625a'); } else { for (const d of [-0.28, 0.28]) R(x + d - 0.2, y0 + 0.1, x + d + 0.2, y1 - 0.1, '#566268'); for (let y = y0 + 0.6; y < y1 - 0.2; y += 0.6) R(x - 0.55, y, x + 0.55, y + 0.07, '#463a30'); } path(archLine(x, 0.75, y1 + 0.38, 0.28, 0, 5), 0.13, Sh); circ(x, y1 + 0.45, 0.13, Sh); };
    for (const x of [-3.35, 3.35]) { win(x, 6.2, 8.4, true); win(x, 9.9, 11.75, false); }
    ledge(-5.8, 9.45, -2.4, 9.65, T); ledge(2.4, 9.45, 5.8, 9.65, T); ledge(-5.8, 5.95, -5.0, 6.05, T);
    circ(0, 11.8, 1.15, Sh); circ(0, 11.8, 0.98, T); circ(0, 11.8, 0.82, '#4a5054'); for (let i = 0; i < 4; i++) { const a = i * PI / 4; line(-Math.cos(a) * 0.82, 11.8 - Math.sin(a) * 0.82, Math.cos(a) * 0.82, 11.8 + Math.sin(a) * 0.82, 0.07, '#6d4c34'); } ring(0, 11.8, 0.82, 0.08, '#6d4c34'); circ(0, 13.1, 0.4, Sh, 0.3); circ(0, 13.12, 0.2, T);
    for (const x of [-3.35, 3.35]) { path([[x - 1.2, 13.85], [x - 0.65, 13.3], [x, 13.1], [x + 0.65, 13.3], [x + 1.2, 13.85]], 0.14, Sh); for (const d of [-1.2, 1.2, 0]) circ(x + d, d ? 13.8 : 13.12, 0.16, Sh); }
    ledge(-5.8, 14.7, 5.8, 15.3, T); R(-5.8, 15.3, 5.8, 16.5, '#e6dfcc'); path([[-1.8, 15.35], [-1.0, 15.75], [0, 16.35], [1.0, 15.75], [1.8, 15.35]], 0.2, T); circ(0, 15.5, 0.6, '#c4bba4', 0.65); circ(0, 15.55, 0.34, T);
  });
  region(g, BIX, '#ddd5c0', 23004, 0.14, (p) => { const { R, line } = p; R(-2.7, 0, 2.7, 1.4, '#969188'); R(0.7, 1.45, 1.85, 3.45, '#c0b8a2'); R(0.85, 1.45, 1.7, 3.3, '#6a4128'); for (let i = 0; i < 6; i++) R(0.55, i * 0.24, 2.0, i * 0.24 + 0.17, i % 2 ? '#8f8a80' : '#6f6a62'); R(-0.9, 5.5, 0.3, 7.0, '#b7ae98'); R(-0.78, 5.62, 0.18, 6.9, '#54382a'); line(-2.7, 8.3, 2.7, 12.6, 0.3, '#5f574a'); line(-2.7, 7.9, 2.7, 12.2, 0.1, '#a9a08a'); R(1.9, 1.5, 2.0, 9.8, '#b9b09a'); R(-2.2, 0.5, -0.9, 1.3, '#837a70'); });
  region(g, BIK, '#b4a184', 23005, 0.1, (p) => { const { R, circ, ledge, ashlar } = p, r = RNG(23006); ashlar(0, 14, 12, 23.4, '#b6a285', 23007, 0.38, 0.6, 1.1); for (let i = 0; i < 90; i++) circ(r() * 12, 14 + r() * 8.5, 0.1 + r() * 0.18, r() < 0.5 ? '#877056' : '#cbbca0'); R(5.4, 21.0, 6.2, 21.9, '#2e241c'); ledge(0, 22.6, 12, 23.0, '#9c8060'); R(0, 23.0, 12, 23.4, '#8a684c'); });
  region(g, BIP, '#e4e1d7', 23008, 0.08, (p) => {
    const { R, circ, ring, line, path, arch, ledge, ashlar } = p, T = BITR, r = RNG(23009);
    const frameWin = (x, y0, y1, w2, round) => { if (round) { arch(x, y0, y1 + 0.2, w2 * 2 + 0.4, T); arch(x, y0, y1, w2 * 2, '#5f4430'); arch(x, y0 + 0.1, y1 - 0.12, w2 * 2 - 0.3, '#43332a'); } else { R(x - w2 - 0.25, y0 - 0.1, x + w2 + 0.25, y1 + 0.28, T); R(x - w2, y0, x + w2, y1, '#4a362a'); R(x - w2 + 0.12, y0 + 0.1, x - 0.05, y1 - 0.12, '#33302f'); R(x + 0.05, y0 + 0.1, x + w2 - 0.12, y1 - 0.12, '#33302f'); } R(x - 0.03, y0, x + 0.03, y1 - (round ? w2 : 0), '#7a5a40'); };
    // the narrow bay and the house under the rough stone storey
    for (const x of [0.05, 4.2, 9.45, 14.3, 18.75, 23.5]) R(x, 0, x + 0.28, x > 4.3 ? 12.7 : 14.6, T);
    for (const y of [4.05, 7.0, 10.0]) R(0, y, 23.7, y + 0.18, T);
    R(0, 14.45, 4.2, 14.8, T); R(0, 0, 40.8, 0.5, '#a29c90');
    frameWin(1.9, 8.6, 10.75, 0.62, false); circ(1.9, 11.15, 0.4, T, 0.3); frameWin(1.9, 5.5, 7.35, 0.62, false); frameWin(1.9, 2.55, 4.45, 0.62, true); frameWin(1.9, 0, 2.3, 0.75, true);
    for (const y of [2.3, 5.1, 7.6]) { circ(5.25, y, 0.36, T); circ(5.25, y, 0.24, '#4a4038'); }
    for (const x of [7.35, 11.75]) { frameWin(x, 8.45, 10.55, 0.55, false); circ(x, 11.0, 0.35, T, 0.28); frameWin(x, 5.45, 7.4, 0.55, false); frameWin(x, 2.8, 4.5, 0.55, true); frameWin(x, 0, 2.35, 0.8, true); }
    frameWin(16.5, 9.0, 10.2, 0.42, false); circ(16.5, 10.65, 0.3, T, 0.26); frameWin(16.5, 5.45, 7.2, 0.5, true); frameWin(16.5, 2.8, 4.3, 0.5, false); frameWin(16.1, 0, 1.9, 0.45, true); frameWin(17.4, 0, 1.9, 0.45, true);
    frameWin(20.9, 8.95, 10.15, 0.42, false); circ(20.9, 10.6, 0.3, T, 0.26); frameWin(20.9, 5.5, 6.5, 0.32, false); frameWin(20.9, 2.9, 3.9, 0.3, false); frameWin(20.7, 0, 2.2, 0.6, true);
    // rough stone storey with four framed windows and a moulded cornice
    ashlar(4.2, 12.7, 23.75, 20.6, '#b8a588', 23010, 0.34, 0.55, 1.1);
    for (let i = 0; i < 230; i++) circ(4.4 + r() * 19.2, 12.9 + r() * 7.5, 0.09 + r() * 0.16, r() < 0.5 ? '#8a7258' : '#cdbfa3');
    for (const x of [8.0, 12.2, 16.4, 20.6]) { R(x - 0.95, 12.75, x + 0.95, 15.75, '#8f734f'); R(x - 0.72, 12.9, x + 0.72, 15.45, BIWH); R(x - 0.42, 12.95, x + 0.42, 14.95, '#3d2c22'); R(x - 0.03, 12.95, x + 0.03, 14.95, '#8a6a4e'); for (let y = 13.45; y < 14.9; y += 0.5) R(x - 0.42, y, x + 0.42, y + 0.06, '#8a6a4e'); }
    ledge(4.2, 12.55, 23.75, 12.75, T); R(4.2, 20.5, 23.75, 21.0, '#9a8262'); ledge(4.2, 21.0, 23.75, 21.6, '#ab9472'); for (let x = 4.35; x < 23.6; x += 0.42) R(x, 20.6, x + 0.2, 20.9, '#6f5a42');
    // the lower wing towards the church
    R(23.75, 11.2, 40.8, 11.35, '#c8c2b2');
    for (const x of [25.0, 28.2]) { frameWin(x, 4.75, 6.8, 0.5, true); frameWin(x, 0, 2.2, 0.55, true); frameWin(x, 2.6, 3.7, 0.3, false); }
    for (const x of [31.6, 35.0]) { frameWin(x, 4.9, 6.2, 0.4, false); frameWin(x, 0, 2.3, 0.5, true); }
    R(27.2, 9.3, 28.1, 10.1, '#4a4038'); path([[31.0, 8.2], [31.4, 10.4], [33.2, 11.2]], 0.12, '#bdb6a4'); for (let x = 24.6; x < 31; x += 2.2) circ(x, 13.6, 0.12, '#6a6258');
    line(4.05, 0.5, 4.05, 14.6, 0.14, '#4a4036');
  });
}
// one open face of the loggia in the frame M (centred on the face): painted wall with its two arches, balcony, cornices, gates
function loggiaFace(SH, M, extra) {
  const edge = [[-6.1, -0.5]];
  for (const [x, r, s, v] of BIARCH) edge.push([x - r, -0.5], ...archLine(x, r, s, v, 0), [x + r, -0.5]);
  SH(BIL, M, [...edge, [6.1, -0.5], [6.1, 19.05], [-6.1, 19.05]], 0);
  for (const [x, r, s, v] of BIARCH) {
    reveal(M, [[x - r, -0.5], ...archLine(x, r, s, v, 0), [x + r, -0.5]], 0, -0.95, '#8c6c48');
    rail(mul(M, tr(x, 0, -0.45)), 2 * r, 3.7, { c: '#8d8a86' });
    B(M, x - 0.24, x + 0.24, s + v + 0.12, s + v + 0.66, -0.02, 0.2, '#b18d61');
    B(M, x - 1.45, x + 1.45, 12.35, 12.62, -0.02, 0.24, '#a58259');
  }
  for (const x of [-5.45, 0, 5.45]) { B(M, x - 0.5, x + 0.5, 10.0, 16.1, -0.02, 0.12, '#96744e'); B(M, x - 0.66, x + 0.66, 16.1, 16.75, -0.02, 0.2, '#a9875c'); for (const d of [-0.62, 0.62]) B(M, x + d - 0.28, x + d + 0.28, 0, 6.2, -0.02, 0.12, '#9a7850'); }
  B(M, -6.45, 6.45, 8.2, 8.55, -0.3, 0.6, '#a07e56'); B(M, -6.25, 6.25, 7.8, 8.2, -0.2, 0.28, '#8f6f4a');
  rail(mul(M, tr(0, 8.55, 0.56)), 12.8, 1.0, { c: '#8d8a86' });
  B(M, -6.35, 6.35, 18.15, 18.55, -0.3, 0.38, '#b08c60'); B(M, -6.2, 6.2, 16.72, 17.0, -0.3, 0.24, '#a9875c');
  if (extra) {   // the arch that stands on its own beyond the south west corner, seen from both sides
    const x = -8.3, r = 1.55, s = 3.9, v = 1.55, p = [[-10.65, -0.5], [x - r, -0.5], ...archLine(x, r, s, v, 0), [x + r, -0.5], [-6.1, -0.5], [-6.1, 6.7], [-10.0, 6.3], [-10.65, 5.4]];
    SH(BIL, mul(M, tr(-5.8, 0, 0)), p.map(q => [q[0] + 5.8, q[1]]), 0);   // shifted so that the painted arch stones fall round this arch
    extrude('flat', shapeOf(p), 0.85, { M, p: [0, 0, -0.9], c: '#95734c', noao: true });
    B(M, -10.75, -9.75, 4.6, 5.0, -1.0, 0.12, '#b08c60'); rail(mul(M, tr(x, 0, -0.45)), 2 * r, 3.4, { c: '#8d8a86' });
  }
}
function buildBianchi() {
  initShared();
  const E = site(BI.loggia, BI.OE, BI.NE, [-9, 2, 14, 28]), y0 = Math.min(E.y0, groundY(939.9, 37.9)), K = 'c2Bianchi';
  const yW = Math.max(y0, groundY(896.0, 0.4));   // the ground rises a little to the church front at the north west end
  const frameAt = (O, N, y) => ({ ...site(BI.loggia, O, N, [0]), F: frame(O[0], y, O[1], N[0], N[1]) });
  const EF = frameAt(BI.OE, BI.NE, y0), SF = frameAt(BI.OS, BI.NS, y0), WF = frameAt(BI.OW, BI.NW, yW), lo = y0 - 3.5;
  defMat(K, 384, 384, [1, 1], (g, w, h) => { g.save(); g.scale(w / 512, h / 512); biTex(g); g.restore(); });   // laid out on 512, painted at three quarters
  const SH = (A, M, p, z) => sheet(K, 512, 512, A, M, p, z);
  begin(y0);
  const solids = [];
  const mass = (d, h, c, roof, S) => { const p = S ? behind(S, d.p, -0.08) : pairsOf(d.p); prism('flat', p, lo, y0 + h, { c }); prism('flat', p, y0 + h, y0 + h + 0.16, { c: roof || '#97705a', noao: true }); solids.push([d.p, null, y0 + h]); };
  // the loggia: upper storey on top, a set back core under it, the two open faces
  const up = (() => { const c = [935.6, 33.6]; return pairsOf(BI.loggia).map(q => [q[0] + (c[0] - q[0]) * 0.025, q[1] + (c[1] - q[1]) * 0.025]); })();
  prism('flat', up, y0 + 7.9, y0 + 19.0, { c: '#d8d2c2', noao: true });
  prism('flat', [[934.9, 29.0], [939.6, 33.9], [935.0, 38.1], [929.4, 35.9], [928.0, 33.9]], lo, y0 + 7.95, { c: '#bfb49c' });
  loggiaFace(SH, mul(EF.F, tr(-6.05, 0, 0)), false);
  loggiaFace(SH, SF.F, true);
  pyramid('flat', 12.6, 12.4, 2.4, { M: EF.F, p: [-6.05, 19.0, -6.05], c: '#8c5c48', noao: true });
  solids.push([BI.loggia, null, y0 + 19]);
  // the north east side: narrow bay, house with the rough stone storey, lower wing
  mass(BI.bay, 14.7, '#d3cdbe', null, EF); mass(BI.tall, 21.4, '#b3a084', null, EF);
  SH(BIP, EF.F, [[0, -0.6], [40.75, -0.6], [40.75, 9.7], [32.5, 15.2], [23.75, 15.2], [23.75, 21.55], [4.22, 21.55], [4.22, 14.75], [0, 14.75]], 0);
  extrude('flat', shapeOf([[23.75, -3.5], [40.6, -3.5], [40.6, 9.6], [32.5, 15.05], [23.75, 15.05]]), 4.9, { M: EF.F, p: [0, 0, -4.98], c: '#d6d0c0', noao: true }); solids.push([BI.wing.p, null, y0 + 8]);
  B(EF.F, 4.1, 23.9, 21.05, 21.62, -0.4, 0.34, '#a48c6a'); B(EF.F, -0.05, 4.2, 14.7, 14.95, -0.3, 0.22, '#9a6a52');
  const balcony = (x, y, w) => { B(EF.F, x - w / 2, x + w / 2, y - 0.16, y, 0, 0.55, '#a69a80'); rail(EF.at(x, y, 0.52), w, 0.95, { c: '#8d8a86' }); for (const s of [-1, 1]) B(EF.F, x + s * w / 2 - 0.02, x + s * w / 2 + 0.02, y + 0.9, y + 0.95, 0, 0.52, '#33302e'); };
  for (const y of [5.45, 8.55]) balcony(1.9, y, 1.9);
  for (const x of [7.35, 11.75]) for (const y of [2.75, 5.4]) balcony(x, y, 1.75);
  balcony(16.5, 5.4, 1.65); balcony(25.0, 4.7, 1.55); balcony(28.2, 4.7, 1.55);
  // the core behind, its rough walls and tiled hip roof
  mass(BI.core, 23.0, '#b29e80'); mass(BI.knot, 20.4, '#cbc1ac');
  B(WF.F, -5.7, 3.4, 15.4, 22.9, -13.0, -7.0, '#b29e80'); SH(BIK, mul(WF.F, tr(-6.15, 0, 0)), rect(0.45, 15.5, 9.55, 23.35), -6.96);
  B(WF.F, -5.95, 3.65, 23.3, 23.5, -13.0, -6.75, '#8f6450'); pyramid('flat', 9.4, 6.0, 1.7, { M: WF.F, p: [-1.15, 23.45, -9.9], c: '#94624c', noao: true });
  pyramid('flat', 12.6, 21.8, 2.2, { M: frame(914.3, y0, 18.0, BI.NE[0], BI.NE[1]), p: [0, 23.1, 0], ry: PI / 2, c: '#94624c', noao: true });
  // the church front at the north west end and its sloping wing
  mass(BI.front, yW - y0 + 15.4, '#d8d0bc', '#8f6450', WF);
  SH(BIW, WF.F, [[-5.78, -0.6], [5.78, -0.6], [5.78, 15.55], [1.9, 15.55], [1.0, 16.0], [0, 16.5], [-1.0, 16.0], [-1.9, 15.55], [-5.78, 15.55]], 0.0);
  for (const [y, g] of [[5.75, 0.16], [14.75, 0.3], [15.28, 0.18]]) B(WF.F, -5.85, 5.85, y, y + 0.28, -0.1, g, '#e4ddc9');
  B(WF.F, -2.15, 2.15, 5.1, 5.45, -0.05, 0.3, '#e4ddc9'); B(WF.F, -0.98, 0.98, 6.05, 6.7, -0.05, 0.14, '#ded7c2');
  for (const x of [-5.45, -2.1, 2.1, 5.45]) { B(WF.F, x - 0.2, x + 0.2, 15.5, 15.8, -0.4, 0.04, '#6d665a'); sphere('flat', 0.24, { M: WF.F, p: [x, 16.05, -0.18], c: '#6d665a', seg: 6, ky: 1.35, noao: true }); }
  sphere('flat', 0.22, { M: WF.F, p: [0, 16.6, -0.15], c: '#5a544a', seg: 6, noao: true }); cross(WF.F, 0, 16.7, -0.15, 2.0, '#34302c', 0.07);
  const wl = frame(905.3, yW, -2.6, -0.606, -0.795);
  SH(BIX, wl, [[-2.64, -0.6], [2.64, -0.6], [2.64, 12.4], [-2.64, 8.3]], 0.06);
  extrude('flat', shapeOf([[-2.64, -3.5], [2.64, -3.5], [2.64, 12.3], [-2.64, 8.2]]), 0.6, { M: wl, p: [0, 0, -0.58], c: '#d6cdb8', noao: true });
  const o = end('Oratorio dei Bianchi');
  o.userData.solids = solids;
  return o;
}

// =====================================================================================================
// Chiesa di San Filippo Neri (ZEN)
// =====================================================================================================
const NR = { id: 'r3785527.0', O: [-3992.3, -7113.1], N: [-0.869, 0.495],
  p: [-3995.1, -7134.7, -3960.6, -7154.2, -3940.8, -7119.2, -3969.7, -7102.9, -3982.4, -7095.7, -3984.0, -7098.5, -3982.1, -7099.6, -3984.1, -7103.1, -3986.0, -7102.0, -3987.6, -7104.8, -3985.7, -7106.0, -3987.6, -7109.2, -3989.4, -7108.2, -3991.0, -7110.9, -3989.2, -7111.8, -3991.1, -7115.1, -3992.4, -7118.0, -3994.3, -7121.3, -3996.3, -7120.1, -4002.3, -7130.6] };
function nrTex(g, w, h) {   // travertine slabs, 4 m square
  g.fillStyle = '#d3c8b2'; g.fillRect(0, 0, w, h); const r = RNG(24001);
  for (let j = 0; j < 8; j++) { const y = j * h / 8; let x = -r() * 40; while (x < w) { const bw = 28 + r() * 26, v = r(); g.fillStyle = v < 0.5 ? `rgba(110,88,60,${v * 0.22})` : `rgba(255,248,230,${(v - 0.5) * 0.26})`; g.fillRect(x, y, bw, h / 8); g.fillStyle = 'rgba(100,82,58,0.3)'; g.fillRect(x, y, 1, h / 8); x += bw; } g.fillStyle = 'rgba(95,78,55,0.34)'; g.fillRect(0, y, w, 1); }
  for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.6 ? 'rgba(105,85,60,0.18)' : 'rgba(255,250,236,0.2)'; g.fillRect(r() * w, r() * h, 2 + r() * 7, 1); }
}
// block letters on a 3 x 5 grid, enough for the panel over the door (white quads in the flat material)
const QUAD = reg(0, 0, 1, 1, 0, 0, 1, 1);
const GLYPH = { V: ['101', '101', '101', '101', '010'], I: ['010', '010', '010', '010', '010'], A: ['010', '101', '111', '101', '101'], M: ['101', '111', '111', '101', '101'], R: ['110', '101', '110', '101', '101'] };
function letters(M, text, x, y, u, z) {
  [...text].forEach((ch, k) => GLYPH[ch].forEach((row, j) => { for (let i = 0; i < 3;) { if (row[i] !== '1') { i++; continue; } let e = i; while (e < 3 && row[e] === '1') e++; sheet('flat', 1, 1, QUAD, M, rect(x + (k * 4 + i) * u, y + (4 - j) * u, x + (k * 4 + e) * u, y + (5 - j) * u), z); i = e; } }));
}
function buildNeri() {
  initShared();
  const S = site(NR.p, NR.O, NR.N, [-18, -8, 0, 8, 18]), { F, y0, lo, at } = S, K = 'c2NeriStone', T = '#ffffff', BL = '#2a78b4', DK = '#1d2024';
  defMat(K, 128, 128, [4, 4], nrTex);
  begin(y0);
  const slab = (x0, x1, h, z0, z1) => { bx(K, F, x0, x1, lo - y0, h, z0, z1, { c: T }); B(F, x0 - 0.04, x1 + 0.04, h, h + 0.1, z0 - 0.04, z1 + 0.04, '#bdb3a0'); };
  prism(K, behind(S, NR.p, -2.3), lo, y0 + 4.45); prism('flat', behind(S, NR.p, -2.3), y0 + 4.45, y0 + 4.55, { c: '#a9a396', noao: true });
  for (const [z, h] of [[-14, 6.0], [-30, 8.8]]) { const p = behind(S, NR.p, z); prism(K, p, y0 + 4.4, y0 + h); prism('flat', p, y0 + h, y0 + h + 0.1, { c: '#a9a396', noao: true }); }
  slab(-20.14, -8.1, 6.4, -6.5, 0);   // the taller block on the left
  for (const [a, b] of [[2.6, 5.7], [9.5, 12.75], [16.8, 20.0]]) slab(a, b, 4.7, -2.4, 0);
  slab(-5.95, -2.0, 4.55, -2.4, -0.8);   // the door block in the wide recess
  // four square windows
  B(F, -16.35, -11.55, 1.4, 5.35, 0.0, 0.06, '#e4dbc8');
  for (const x of [-15.1, -12.8]) for (const y of [2.5, 4.3]) { B(F, x - 1.0, x + 1.0, y - 0.8, y + 0.8, 0.03, 0.09, DK); B(F, x - 0.04, x + 0.04, y - 0.8, y + 0.8, 0.07, 0.11, '#3a3f46'); }
  for (const [x, y, z] of [[-13.65, 5.7, 0], [2.95, 3.9, 0], [7.9 + 3.2, 3.9, 0], [18.4, 3.9, 0]]) B(F, x - 0.28, x + 0.28, y - 0.28, y + 0.28, z, z + 0.07, BL);
  const door = (x, w, h, z) => { B(F, x - w / 2 - 0.12, x + w / 2 + 0.12, 0, h + 0.12, z, z + 0.04, '#8f887c'); B(F, x - w / 2, x + w / 2, 0, h, z + 0.02, z + 0.07, DK); };
  door(-4.25, 2.05, 2.55, -0.8); door(1.7, 1.1, 2.65, -2.3); door(4.15, 1.9, 2.6, 0); door(11.1, 1.9, 2.6, 0); door(18.4, 1.9, 2.6, 0);
  B(F, -4.95, -3.65, 3.42, 4.3, -0.8, -0.74, BL); letters(F, 'VIVA', -4.78, 3.9, 0.064, -0.73); letters(F, 'MARIA', -4.9, 3.5, 0.064, -0.73);
  B(F, -1.3, 0.2, 3.7, 4.15, -2.3, -2.24, '#e8e2d4');
  // statues between the blocks
  for (const x of [-7.25, -0.9, 7.6, 14.8]) { B(F, x - 0.42, x + 0.42, -0.4, 1.25, -2.3, -1.65, '#a99e88'); B(F, x - 0.5, x + 0.5, 1.25, 1.36, -2.32, -1.57, '#e4dccb'); statue('flat', at(x, 1.35, -1.95), 1.8, { c: '#e8e4da', noao: true }); }
  // the tall cross behind
  bx(K, F, -1.56, -1.24, 4.3, 8.0, -2.95, -2.65, { c: '#e0d6c2', noao: true }); bx(K, F, -2.55, -0.25, 6.85, 7.17, -2.94, -2.66, { c: '#e0d6c2', noao: true });
  const o = end('Chiesa di San Filippo Neri');
  o.userData.solids = [[NR.p, null, y0 + 4.5]];
  return o;
}

// =====================================================================================================
// Santi Cosma e Damiano, Sferracavallo
// =====================================================================================================
const CD = { id: 'w87015592', p: [-7461.0, -9130.0, -7448.6, -9117.5, -7461.6, -9106.2, -7472.7, -9118.6], O: [-7466.85, -9124.3], N: [-0.698, -0.716] };
const CDF = reg(-8.2, 0, 8.2, 12.3, 0, 0, 320, 240), CDS = reg(-8.8, 0, 8.8, 10.2, 0, 240, 320, 144);
const CDY = '#dcc995', CDP = '#e4d4a6', CDB = '#cfc9b6', CDW = '#e8e0c4';
function cdTex(g) {
  const corner = (p, x) => { const { R, strip, ledge } = p; R(x - 0.55, 0, x + 0.55, 2.75, '#c9bc96'); ledge(x - 0.62, 2.55, x + 0.62, 2.85, CDW); strip(x - 0.42, 2.85, x + 0.42, 8.35, CDP, 4); ledge(x - 0.55, 8.35, x + 0.55, 8.85, CDW); p.circ(x - 0.3, 8.5, 0.16, '#b5a578'); p.circ(x + 0.3, 8.5, 0.16, '#b5a578'); };
  region(g, CDF, CDY, 25001, 0.08, (p) => {
    const { R, circ, ledge, strip, line } = p;
    R(-8.2, 0, 8.2, 1.2, CDB);
    for (const s of [-1, 1]) { corner(p, s * 7.75); R(s * 5.0 - 1.35, 3.0, s * 5.0 + 1.35, 8.2, '#c4b17e'); R(s * 5.0 - 1.18, 3.15, s * 5.0 + 1.18, 8.05, '#d9c690'); corner(p, s * 2.55); }
    ledge(-1.95, 5.35, 1.95, 5.65, CDW); R(-1.8, 0, 1.8, 5.35, CDW); R(-1.5, 0, 1.5, 5.0, '#5a3a24'); R(-0.03, 0, 0.03, 5.0, '#24150c'); for (const s of [-1, 1]) for (let y = 0.35; y < 4.6; y += 1.1) { R(s * 0.75 - 0.52, y, s * 0.75 + 0.52, y + 0.85, '#6e4a2e'); R(s * 0.75 - 0.34, y + 0.17, s * 0.75 + 0.34, y + 0.68, '#5f3f27'); }
    // the picture of the two saints in its frame
    R(-1.3, 5.95, 1.3, 8.95, CDW); R(-0.95, 6.2, 0.95, 8.7, '#3d3a30'); R(-0.84, 6.3, 0.84, 8.6, '#c89c44');
    for (const [x, c, c2] of [[-0.4, '#8c3328', '#2f5a46'], [0.4, '#2f5a46', '#8c3328']]) { p.poly([[x - 0.36, 6.35], [x + 0.36, 6.35], [x + 0.2, 7.75], [x - 0.2, 7.75]], c); p.poly([[x - 0.05, 6.35], [x + 0.28, 6.35], [x + 0.1, 7.6]], c2); circ(x, 7.95, 0.17, '#d3a182'); circ(x, 8.12, 0.13, '#5a3c26'); }
    ledge(-8.2, 8.85, 8.2, 9.2, CDW); R(-8.2, 9.2, 8.2, 9.65, '#d3c08c'); ledge(-8.2, 9.65, 8.2, 10.05, CDW);
    for (const s of [-1, 1]) line(s * 8.2, 10.15, 0, 12.2, 0.32, CDW);
  });
  region(g, CDS, CDY, 25002, 0.09, (p) => {
    const { R, circ, ledge, line } = p;
    R(-8.8, 0, 8.8, 2.7, CDB); corner(p, 8.65);
    for (const [a, b] of [[-1.2, -0.05], [5.45, 6.55]]) { R(a - 0.12, 6.38, b + 0.12, 8.42, '#b3a478'); R(a, 6.5, b, 8.3, '#4a4c50'); R(a + 0.1, 6.6, b - 0.1, 8.2, '#7d93a8'); for (let y = 6.85; y < 8.2; y += 0.27) R(a + 0.1, y, b - 0.1, y + 0.03, '#46505c'); R((a + b) / 2 - 0.02, 6.6, (a + b) / 2 + 0.02, 8.2, '#46505c'); R(a - 0.18, 6.28, b + 0.18, 6.4, CDW); }
    R(4.85, 0, 6.55, 3.15, '#c9bc96'); R(4.95, 0, 6.45, 3.05, '#33281f'); R(5.68, 0, 5.72, 3.05, '#15100c');
    R(6.62, 1.95, 7.9, 3.05, '#d6d23a'); R(6.62, 1.95, 7.9, 1.99, '#8a8620'); circ(6.82, 2.78, 0.09, '#2f3a20'); for (const y of [2.76, 2.5, 2.32, 2.14]) R(y > 2.6 ? 7.0 : 6.72, y, 7.8, y + 0.06, '#34401f');
    R(1.1, 0.7, 1.75, 2.35, '#4c4a48'); R(1.2, 1.9, 1.65, 2.25, '#8c3328'); line(0.25, 0, 0.45, 9.4, 0.12, '#bcaa7a'); line(0.45, 5.2, 3.2, 5.25, 0.06, '#bcaa7a');
    for (const x of [-6.5, -2.4, 3.2, 7.0]) R(x, 9.25, x + 0.5, 9.55, '#4a3e2c');
    line(-8.8, 9.0, 3.0, 4.6, 0.04, '#4a4238'); line(-8.8, 5.9, 8.6, 3.9, 0.03, '#4a4238');
    ledge(-8.8, 9.7, 8.8, 9.95, CDW); R(-8.8, 9.95, 8.8, 10.2, '#b88660');
  });
}
function buildCosma() {
  initShared();
  const S = site(CD.p, CD.O, CD.N, [-6, 0, 6]), { lo } = S, K = 'c2Cosma';
  const y0 = Math.min(S.y0, groundY(-7453.9, -9124.8)), M = frame(CD.O[0], y0, CD.O[1], CD.N[0], CD.N[1]);
  defMat(K, 320, 384, [1, 1], cdTex);
  const SH = (A, m, p, z) => sheet(K, 320, 384, A, m, p, z);
  begin(y0);
  const body = [[-7460.95, -9129.8], [-7448.85, -9117.55], [-7461.6, -9106.45], [-7472.45, -9118.6]];   // the footprint, a hand's width inside the painted faces
  const bl = Math.min(lo, y0 - 1.5);
  prism('flat', body, bl, y0 + 10.0, { c: '#d3bf8c' });
  // the front: door and picture between the pilasters, a plain gable following the roof
  SH(CDF, M, [[-8.17, -0.6], [8.17, -0.6], [8.17, 10.05], [0, 12.25], [-8.17, 10.05]], 0.0);
  for (const x of [-7.75, -2.55, 2.55, 7.75]) { B(M, x - 0.4, x + 0.4, 2.85, 8.35, -0.05, 0.14, CDP); B(M, x - 0.58, x + 0.58, 0, 2.8, -0.05, 0.2, '#c6b992'); B(M, x - 0.55, x + 0.55, 8.35, 8.85, -0.05, 0.2, CDW); }
  B(M, -8.35, 8.35, 8.85, 9.15, -0.1, 0.24, CDW); B(M, -8.35, 8.35, 9.68, 10.02, -0.1, 0.3, CDW);
  B(M, -1.95, 1.95, 5.35, 5.65, -0.05, 0.24, CDW); for (const s of [-1, 1]) { B(M, s * 1.55, s * 1.85, 0, 5.35, -0.05, 0.1, CDW); B(M, s * 1.0, s * 1.3, 6.0, 8.9, -0.05, 0.08, CDW); }
  // the north east flank
  const a = [-7461.0, -9130.0], b = [-7448.6, -9117.5], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, E = frame(mx, y0, mz, 0.71, -0.704);
  SH(CDS, E, rect(-8.8, -0.6, 8.8, 10.15), 0.03);
  B(E, 8.2, 9.05, 2.85, 8.35, -0.05, 0.18, CDP); B(E, 8.05, 9.15, 0, 2.8, -0.05, 0.2, '#c6b992'); B(E, 8.1, 9.15, 8.35, 8.85, -0.05, 0.22, CDW); B(E, -8.85, 9.05, 9.7, 9.95, -0.1, 0.24, CDW);
  gable('flat', 'flat', mul(M, tr(0, 0, -8.55)), 16.3, 16.5, 10.0, 2.2, { ov: 0.12, c: '#a9745a', wc: '#d3bf8c' });
  B(M, -0.28, 0.28, 12.15, 12.5, -0.4, 0.05, CDW); cross(M, 0, 12.45, -0.15, 1.2, '#4a4036', 0.09);
  const o = end('Chiesa dei Santi Cosma e Damiano');
  o.userData.solids = [[CD.p, null, y0 + 10]];
  return o;
}

// =====================================================================================================
// Maria Santissima delle Grazie, Isola delle Femmine
// =====================================================================================================
const IF = { id: 'w170024536', p: [-9826.5, -9111.6, -9815.2, -9108.6, -9820.5, -9088.4, -9831.9, -9091.3], O: [-9826.2, -9089.85], N: [-0.247, 0.969] };
const IFF = reg(-6.9, 0, 6.9, 11.3, 0, 0, 256, 240), IFT = reg(-1.25, 7.0, 1.25, 16.1, 256, 0, 64, 240);
const IFW = '#f0ede2', IFY = '#d8bc74';
function ifTex(g) {
  region(g, IFF, IFW, 26001, 0.035, (p) => {
    const { R, circ, ring, line, poly, ledge, strip } = p;
    R(-6.9, 0, 6.9, 0.55, '#cfc7b2');
    for (const [a, b, h] of [[-6.88, -6.55, 6.45], [-5.72, -5.22, 6.45], [-3.98, -3.58, 6.45], [2.18, 2.7, 6.45], [4.55, 5.12, 6.45], [6.5, 6.86, 6.45], [-3.4, -2.75, 7.85], [1.4, 2.12, 7.85]]) { strip(a, 0.55, b, h, IFY); R(a - 0.1, 0.55, b + 0.1, 0.95, IFY); R(a - 0.12, h - 0.55, b + 0.12, h, '#c4a558'); for (const x of [a, (a + b) / 2, b]) circ(x, h - 0.2, 0.13, '#e2cc8c'); }
    ledge(-6.9, 6.45, -3.45, 6.65, IFY); ledge(2.15, 6.45, 6.9, 6.65, IFY); ledge(-6.9, 6.82, -3.45, 7.0, IFY); ledge(2.15, 6.82, 6.9, 7.0, IFY);
    ledge(-3.55, 7.85, 2.35, 8.05, IFY); ledge(-3.55, 8.5, 2.35, 8.82, IFY);
    line(-3.65, 8.95, -0.6, 10.9, 0.3, IFY); line(2.45, 8.95, -0.6, 10.9, 0.3, IFY);
    for (const [x, y, r] of [[-0.71, 6.6, 0.45], [-4.6, 3.9, 0.46], [3.72, 4.05, 0.48]]) { circ(x, y, r + 0.12, IFY); ring(x, y, r, 0.07, '#f2e6c0'); circ(x, y, r - 0.12, '#33302c'); }
    // the doors
    R(-2.0, 0, 0.55, 4.45, IFW); strip(-1.9, 0.2, -1.62, 4.3, IFY); strip(0.18, 0.2, 0.44, 4.3, IFY); ledge(-2.05, 4.3, 0.6, 4.52, IFY); poly([[-2.1, 4.52], [-0.72, 5.3], [0.65, 4.52]], IFY); poly([[-1.65, 4.62], [-0.72, 5.07], [0.2, 4.62]], IFW);
    const door = (a, b, h) => { R(a - 0.14, 0, b + 0.14, h + 0.14, IFY); R(a, 0, b, h, '#4d241c'); R((a + b) / 2 - 0.02, 0, (a + b) / 2 + 0.02, h, '#200e0a'); for (let y = 0.3; y < h - 0.5; y += 0.85) { R(a + 0.12, y, (a + b) / 2 - 0.1, y + 0.62, '#5e3026'); R((a + b) / 2 + 0.1, y, b - 0.12, y + 0.62, '#5e3026'); } };
    door(-1.45, 0.0, 3.7); door(-5.1, -4.15, 2.45); door(3.08, 4.2, 2.45); ledge(-5.35, 2.85, -3.9, 3.0, IFY); ledge(2.85, 2.85, 4.45, 3.0, IFY);
    // the tiled image on the right aisle
    R(5.38, 2.95, 6.42, 4.3, IFY); R(5.5, 3.07, 6.3, 4.18, '#2f5f9c'); p.poly([[5.68, 3.12], [6.1, 3.12], [5.98, 3.85], [5.8, 3.85]], '#d8a640'); circ(5.89, 3.95, 0.12, '#dcb08e'); ledge(5.35, 2.72, 6.45, 2.86, IFY); circ(5.9, 4.65, 0.18, '#c9c2ae');
  });
  region(g, IFT, IFW, 26002, 0.03, (p) => {
    const { R, circ, ring, line, arch, ledge, strip } = p;
    strip(-1.22, 7.0, -0.82, 15.0, IFY); strip(0.82, 7.0, 1.1, 15.0, IFY);
    ledge(-1.25, 7.25, 1.25, 7.5, IFY); R(-0.64, 8.0, 0.64, 9.1, IFY); circ(0, 8.55, 0.47, '#e9e8e0'); ring(0, 8.55, 0.45, 0.06, '#4a463e'); line(0, 8.55, 0.3, 8.42, 0.06, '#222'); line(0, 8.55, -0.05, 8.9, 0.06, '#222');
    ledge(-0.85, 9.2, 0.85, 9.35, IFY); R(-0.66, 9.45, 0.66, 10.25, '#8a857a'); for (let x = -0.56; x < 0.6; x += 0.22) R(x - 0.055, 9.5, x + 0.055, 10.15, IFW); R(-0.68, 10.2, 0.68, 10.32, IFY);
    arch(0, 10.3, 12.65, 1.36, IFY); arch(0, 10.32, 12.5, 1.1, '#3a352d'); circ(0, 11.55, 0.34, '#1f1b16', 0.4); R(-0.4, 11.15, 0.4, 11.25, '#1f1b16'); R(-0.5, 11.9, 0.5, 11.98, '#6a5f4c');
    ledge(-0.9, 12.75, 0.9, 12.9, IFY);
    for (const x of [-0.37, 0.37]) { arch(x, 13.0, 14.45, 0.66, IFY); arch(x, 13.02, 14.32, 0.46, '#4a443a'); } R(-0.06, 13.0, 0.06, 14.1, IFW);
    ledge(-1.25, 14.75, 1.25, 15.0, IFY); line(-1.25, 15.1, 0, 16.0, 0.2, IFY); line(1.25, 15.1, 0, 16.0, 0.2, IFY);
  });
}
function buildGrazie() {
  initShared();
  const S = site(IF.p, IF.O, IF.N, [-6, 0, 6]), { F, y0, lo, at } = S, K = 'c2Grazie';
  defMat(K, 320, 240, [1, 1], ifTex);
  const SH = (A, M, p, z) => sheet(K, 320, 240, A, M, p, z);
  begin(y0);
  const body = behind(S, IF.p, -0.25);
  prism('flat', body, lo, y0 + 6.8, { c: '#e7e2d4' }); prism('flat', body, y0 + 6.8, y0 + 6.95, { c: '#b88d6c', noao: true });
  B(F, -6.9, -5.7, lo - y0, 6.8, -0.5, -0.03, '#e7e2d4'); B(F, 5.7, 6.9, lo - y0, 6.8, -0.5, -0.03, '#e7e2d4');
  SH(IFF, F, [[-6.9, -0.6], [6.9, -0.6], [6.9, 7.0], [2.3, 7.0], [2.3, 8.82], [2.55, 8.85], [-0.6, 10.95], [-3.75, 8.85], [-3.5, 8.82], [-3.5, 7.0], [-6.9, 7.0]], 0.0);
  // the nave over the aisles, its roof and half round windows
  B(F, -3.4, 2.15, 6.8, 8.75, -20.2, -0.06, '#e9e4d6');
  gable('flat', 'flat', at(-0.62, 0, -10.2), 5.7, 19.9, 8.75, 2.0, { ov: 0.1, c: '#b57f60', wc: '#e9e4d6' });
  for (const z of [-2.6, -8.0, -13.4]) for (const s of [-1, 1]) { const M = mul(at(s < 0 ? -3.42 : 2.17, 0, z), new THREE.Matrix4().makeRotationY(s * PI / 2)); extrude('flat', shapeOf(archLine(0, 0.75, 7.15, 0.75, 0, 5).reverse()), 0.03, { M, p: [0, 0, 0.0], c: '#4a4e52', noao: true }); }
  // relief on the front
  for (const [a, b, h] of [[-6.88, -6.55, 6.45], [-5.72, -5.22, 6.45], [-3.98, -3.58, 6.45], [2.18, 2.7, 6.45], [4.55, 5.12, 6.45], [6.5, 6.86, 6.45], [-3.4, -2.75, 7.85], [1.4, 2.12, 7.85]]) { B(F, a, b, 0, h - 0.55, -0.02, 0.09, '#d5b870'); B(F, a - 0.1, b + 0.1, h - 0.5, h, -0.02, 0.15, '#c7a95e'); }
  B(F, -6.9, -3.45, 6.8, 7.02, -0.1, 0.2, IFY); B(F, 2.15, 6.9, 6.8, 7.02, -0.1, 0.2, IFY); B(F, -3.6, 2.4, 8.55, 8.85, -0.1, 0.24, IFY);
  for (const s of [-1, 1]) extrude('flat', shapeOf(rect(-1.86, -0.14, 1.86, 0.14)), 0.24, { M: F, p: [-0.6 + s * 1.55, 9.92, -0.06], rz: -s * Math.atan2(2.05, 3.1), c: IFY, noao: true });
  B(F, -2.05, 0.6, 4.3, 4.52, -0.02, 0.2, IFY);
  cross(F, -0.6, 10.95, -0.2, 1.35, '#4a4036', 0.07); B(F, -0.85, -0.35, 11.5, 11.56, -0.22, -0.18, '#4a4036');
  // the bell tower behind the right aisle
  const T = at(5.4, 0, -2.75), H = 1.2;
  B(T, -H, H, 6.5, 15.0, -H, H, '#ebe7da');
  for (let k = 0; k < 4; k++) { const M = mul(T, new THREE.Matrix4().makeRotationY(k * PI / 2)); SH(IFT, M, rect(-1.22, 7.0, 1.22, 15.0), H + 0.012); SH(IFT, M, [[-1.25, 15.0], [1.25, 15.0], [0, 15.98]], H + 0.012); }
  for (const [y, g] of [[7.25, 0.12], [9.2, 0.08], [12.75, 0.1], [14.75, 0.18]]) B(T, -H - g, H + g, y, y + 0.2, -H - g, H + g, IFY);
  for (const r of [0, 1]) gable('flat', 'flat', mul(T, new THREE.Matrix4().makeRotationY(r * PI / 2)), 2.36, 2.36, 15.0, 0.95, { ov: 0.06, th: 0.12, c: '#c2a766', wc: '#ebe7da' });
  const o = end('Chiesa Maria Santissima delle Grazie');
  o.userData.solids = [[IF.p, null, y0 + 6.8]];
  return o;
}

export const R2_C2 = [
  { name: 'Chiesa Valdese di via Spezio', x: -302, z: -1088, radius: 30, skipIds: [VA.id], build: buildValdese, walls: outline(VA.O, VA.N, [[-5.0, 0], [-5.0, 1.65], [5.0, 1.65], [5.0, 0]]) },
  { name: 'Teatro Nuovo Montevergini', x: -252, z: 55, radius: 32, skipIds: [MV.id, MV.id2, MV.id3], build: buildMontevergini },
  { name: 'Oratorio dei Bianchi', x: 918, z: 18, radius: 40, skipIds: [BI.front, BI.wing, BI.core, BI.tall, BI.knot, BI.bay, BI.lg1, BI.lg2].map(d => d.id), build: buildBianchi, walls: outline(BI.OS, BI.NS, [[-5.9, 0.12], [-10.75, 0.12], [-10.75, -1.0], [-5.9, -1.0]]) },
  { name: 'Chiesa di San Filippo Neri', x: -3972, z: -7125, radius: 40, skipIds: [NR.id], build: buildNeri, walls: [[-8.1, 0, 2.6, 0], [5.7, 0, 9.5, 0], [12.75, 0, 16.8, 0]].flatMap(s => outline(NR.O, NR.N, [[s[0], s[1]], [s[2], s[3]]])) },
  { name: 'Chiesa dei Santi Cosma e Damiano', x: -7461, z: -9118, radius: 22, skipIds: [CD.id], build: buildCosma },
  { name: 'Chiesa Maria Santissima delle Grazie', x: -9824, z: -9100, radius: 22, skipIds: [IF.id], build: buildGrazie, walls: outline(IF.O, IF.N, [[-6.9, -0.4], [-6.9, 0.18], [6.9, 0.18], [6.9, -0.4]]) },
];
