// City landmarks, batch S: two churches that were drawn by the generic builder (src/lmc-churches.js) because no exterior photo had been found. Registered through BATCH_S in src/landmarks-city.js.
// One photo was found for each, on the web. They were only looked at, nothing is copied. Heights and positions were read by relating the photo to the footprint, so treat them as rough.
// Frame F: origin on the ground, +z out of the front, local x along the front (right as seen from outside). Collision is the footprint. Nothing outside the footprints is drawn (steps, cars, street trees).
//
// Parrocchia Maria SS. Ausiliatrice (w1160934383) and the wing beside it (w278478959, unnamed in OpenStreetMap), Via Sampolo 71: the summer villa of the nuns of Santa Maria del Cancelliere.
// Front to the west south west. Photo: lasiciliainrete.it, page "Chiesa di S. Maria Ausiliatrice" (credited only as web, undated); the name is lettered over its door.
// Read (camera fitted to the photo: the 8.4 m front edge as the width, a door about 3.6 m high on a 0.9 m threshold taken as given, square pixels assumed): pale yellow front on a grey plinth; a dark red panelled door in a grey frame, the inscription MARIA
//  AUSILIATRICE, a small triangular pediment on brackets; a tall window with a lattice grille and a shield over it; a lamp each side; two pairs of Ionic pilasters with a hanging garland between each pair;
//  entablature blocks over the pairs and a large triangular pediment; an upper order with pilaster strips closed by a cornice about 13 m up. At the sides, brown weathered stone walls to about 10 m, with two
//  grilled windows one above the other next to the church and a dark drain pipe on the left.
// Not verified: anything above the upper cornice, the sides and back of the church (plain, kept lower than the front), the rest of the wing beyond the first windows (plain stone, same height), the roofs.
//  The steps and their iron railing in the photo stand in front of the footprint, so the steps are only painted under the door. The wall to the right of the church belongs to another building.
//
// Parrocchia Sacra Famiglia (w81301748), Via Gaspare Mignosi. Front to the north. Photo: parrocchie.it/palermo/sacrafamiglia, "Prospetto della facciata" (page dated 2000; no newer view of the front was found).
// Read: a stone clad ground floor along the street with barred openings and a small white plaque, a terrace on it with pots and a railing; set back above it a plain ochre front, level up to a higher
//  part at the right hand end, with a thin dark coping; a bronze coloured relief of the Holy Family; a wide recessed porch between white jambs; a large pale cross at the right.
//  Heights and widths follow from taking about 9.4 m for the front (the baked height is 9.7 m) and a guessed lens; the front is set on a straight line across the footprint, the terrace fills the part in front of it.
// Not verified: the sides, back and roof (plain), the inside of the porch beyond its pale walls and a dark door, the relief in detail, the right hand end of the front (cut off in the photo).
//  The palm and shrubs on the terrace in the photo are not drawn; only low pots.
import * as THREE from 'three';
import { PI, bx, cyl, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, rail, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// a frame in the middle of the wall from a to b (world points) at height y, +z out of the polygon poly
function edge(a, b, y, poly) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = -dz / l, nz = dx / l; if (inPoly(poly, mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; } return { M: frame(mx, y, mz, nx, nz), l }; }
// painter for a canvas that covers FW x FH metres, x centred, y up from the ground
function paint(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  return { sx, sy, X, Y, R, poly, circ, line };
}
// soft stains and streaks over the whole canvas
function wear(g, w, h, seed, n, a = 0.08) {
  const r = RNG(seed);
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.2) * Math.max(w, h), k = r() < 0.6 ? '60,42,25' : '255,246,225', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${k},${a * (0.6 + r() * 0.6)})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, a, h * 0.14, '60,46,32');
}
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// a flat coloured solid from a 2D outline, in the frame M, from z0 to z1
const slab = (M, p, z0, z1, c) => extrude('flat', shapeOf(p), z1 - z0, { M, p: [0, 0, z0], c, noao: true });

// =====================================================================================================
// Maria SS. Ausiliatrice
// =====================================================================================================
const MA = { p: [-904.6, -2807.7, -907.1, -2811.6, -910.2, -2809.4, -909.9, -2806.1, -911.6, -2804.6, -917.8, -2801.1, -917.6, -2798.1, -921.1, -2795, -916.2, -2788.2, -911.7, -2791.8, -908.5, -2791.2, -900.8, -2796, -898.5, -2797.5, -897.7, -2798.3] };
const WING = { p: [-940.7, -2816.1, -938.3, -2817.9, -939.1, -2819, -933.2, -2823.3, -927.1, -2814.9, -923.1, -2809.4, -913.7, -2816.4, -911.7, -2813.7, -917.4, -2809.3, -915.1, -2806.6, -910.2, -2809.4, -909.9, -2806.1, -911.6, -2804.6, -917.8, -2801.1, -917.6, -2798.1, -921.1, -2795] };
const MAW = 8.6, MAH = 14, MATOP = 13.45, MABODY = 12.4, MAWING = 9.9, MAYE = '#e6e0b4', MAMO = '#efeac6';
function maFront(g, w, h) {
  const p = paint(g, w, h, MAW, MAH), { R, poly, circ, line, X, Y } = p;
  g.fillStyle = MAYE; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, 9701, ['rgba(120,100,50,0.07)', 'rgba(255,255,230,0.09)']);
  // plinth, the steps under the door
  R(-4.3, 0, 4.3, 1.35, '#a2a7a8'); R(-4.3, 1.28, 4.3, 1.35, '#c3c6c2');
  for (let i = 0; i < 4; i++) { const y = i * 0.225, ww = 1.75 - i * 0.12; R(-ww, y, ww, y + 0.18, '#8f8d87'); R(-ww, y + 0.18, ww, y + 0.225, '#c9c6bc'); }
  // the door in its grey frame
  R(-1.19, 0.9, 1.19, 4.87, '#a9acac'); R(-1.08, 0.9, 1.08, 4.76, '#c2c4c0'); R(-0.9, 0.9, 0.9, 4.57, '#5a2c24'); R(-0.02, 0.9, 0.02, 4.57, '#24100c');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) { const x = -0.85 + i * 0.44, y = 1.02 + j * 0.5; R(x, y, x + 0.36, y + 0.42, '#3f1d17'); R(x + 0.05, y + 0.05, x + 0.31, y + 0.37, '#66332a'); }
  // the inscription
  R(-1.05, 4.9, 1.05, 5.42, '#d5d2c4'); g.fillStyle = '#4c473e'; g.font = `bold ${Math.round(0.27 * p.sy)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MARIA AUSILIATRICE', X(0), Y(5.16), 2.0 * p.sx);
  // the window: white frame, dark panes, the lattice
  R(-0.89, 6.71, 0.89, 9.73, '#c9c39a'); R(-0.81, 6.8, 0.81, 9.65, MAMO); R(-0.6, 6.98, 0.6, 9.44, '#33281f'); R(-0.6, 8.35, 0.6, 9.44, '#554c42');
  g.save(); g.beginPath(); g.rect(X(-0.6), Y(9.44), 1.2 * p.sx, 2.46 * p.sy); g.clip();
  for (let k = -3.2; k < 3.2; k += 0.27) { line(k, 6.98, k + 1.6, 9.44, 0.03, '#8a7c6a'); line(k, 9.44, k + 1.6, 6.98, 0.03, '#8a7c6a'); }
  g.restore(); R(-0.035, 6.98, 0.035, 9.44, '#4a2c20'); R(-0.6, 8.3, 0.6, 8.38, '#4a2c20');
  // the shield and the garlands, as pale relief
  for (const [dx, dy, c] of [[0.04, -0.05, '#b8b086'], [0, 0, '#f5f1d4']]) {
    circ(dx, 10.35 + dy, 0.32, c); circ(dx, 10.76 + dy, 0.17, c); for (const s of [-1, 1]) { circ(dx + s * 0.43, 10.5 + dy, 0.14, c); circ(dx + s * 0.47, 10.17 + dy, 0.12, c); circ(dx + s * 0.28, 9.98 + dy, 0.1, c); }
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const y = 7.28 - i * 0.18, r = 0.08 + 0.09 * Math.sin((i + 1) / 10 * PI); circ(dx + s * 2.76 + (i % 2 ? 0.05 : -0.05), y + dy, r, c); }
  }
  circ(0, 10.35, 0.18, '#cfc79c');
  // shadows under the mouldings
  for (const s of [-1, 1]) { R(s * 2.85 - 1.45, 9.2, s * 2.85 + 1.45, 9.45, 'rgba(90,76,35,0.28)'); R(s * 2.85 - 1.3, 8.84, s * 2.85 + 1.3, 8.9, MAMO); R(s * 2.85 - 1.3, 8.78, s * 2.85 + 1.3, 8.84, 'rgba(90,76,35,0.25)'); for (const x of [1.77, 2.47, 3.05, 4.0]) R(s * x - 0.03, 1.35, s * x + 0.03, 7.55, 'rgba(90,76,35,0.2)'); }
  poly([[-4.2, 9.9], [0, 11.45], [4.2, 9.9], [4.2, 9.65], [0, 11.2], [-4.2, 9.65]], 'rgba(90,76,35,0.22)');
  // the upper order: pilaster strips
  for (const x of [-3.15, -1.95, 1.95, 3.15]) { R(x - 0.38, 10.0, x + 0.38, 13.0, '#ebe6bd'); R(x + 0.38, 10.0, x + 0.45, 13.0, 'rgba(90,76,35,0.25)'); }
  R(-4.3, 12.8, 4.3, 13.0, 'rgba(90,76,35,0.25)');
  wear(g, w, h, 9702, 22, 0.06);
}
// a grilled window on the stone wall: x along the frame M
function maBarred(M, x0, x1, y0, y1) {
  bx('flat', M, x0 - 0.14, x1 + 0.14, y0 - 0.14, y1 + 0.14, -0.05, 0.05, { c: '#a79378', noao: true });
  bx('flat', M, x0, x1, y0, y1, 0, 0.07, { c: '#27211d', noao: true });
  const c = '#4a4038', nx = 5, ny = Math.round((y1 - y0) / 0.28);
  for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx; bx('flat', M, x - 0.022, x + 0.022, y0 - 0.06, y1 + 0.06, 0.15, 0.18, { c, noao: true }); }
  for (let i = 0; i <= ny; i++) { const y = y0 + (y1 - y0) * i / ny; bx('flat', M, x0 - 0.06, x1 + 0.06, y - 0.022, y + 0.022, 0.16, 0.19, { c, noao: true }); }
}
function buildAusiliatrice() {
  initShared();
  const O = [-918.65, -2791.6], N = [-0.811, 0.585];
  const cp = pairsOf(MA.p), wp = pairsOf(WING.p);
  const y0 = Math.min(groundY(...O), groundY(-921.1, -2795), groundY(-916.2, -2788.2));
  const lo = Math.min(groundRange(cp).lo, groundRange(wp).lo, y0) - 1.5;
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  defMat('bsMaFront', 256, 416, [MAW, MAH], maFront);
  begin(y0);
  // the body behind the front
  const loc = cp.map(q => { const dx = q[0] - O[0], dz = q[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; });
  const body = []; for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = -0.35 - a[1], fb = -0.35 - b[1]; if (fa >= 0) body.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); body.push([a[0] + (b[0] - a[0]) * k, -0.35]); } }
  const bw = body.map(([x, z]) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]]);
  prism('plaster', bw, lo, y0 + MABODY, { c: '#ddd5b0' }); prism('flat', bw, y0 + MABODY, y0 + MABODY + 0.12, { c: '#9a948a', noao: true });
  // the painted front: the lower order with its pediment, the upper order
  extrude('bsMaFront', shapeOf([[-4.2, -1.5], [4.2, -1.5], [4.2, 9.95], [3.68, 10.2], [3.62, MATOP - 0.2], [-3.62, MATOP - 0.2], [-3.68, 10.2], [-4.2, 9.95]]), 0.4, { M: F, p: [0, 0, -0.4], uv: 'keep', uvk: [1 / MAW, 1 / MAH], uvo: [0.5, 0], noao: true });
  slab(F, rect(-3.85, 13.0, 3.85, 13.18), -0.45, 0.2, '#d9d2a8'); slab(F, rect(-3.98, 13.18, 3.98, MATOP), -0.5, 0.3, MAMO);
  // pilasters in pairs, their bases and Ionic capitals, the entablature blocks
  for (const s of [-1, 1]) {
    for (const [a, b, d] of [[1.77, 2.47, 0.13], [3.05, 4.0, 0.2]]) {
      const x = s * (a + b) / 2, hw = (b - a) / 2;
      bx('flat', F, x - hw - 0.08, x + hw + 0.08, 1.35, 1.62, 0, d + 0.08, { c: MAMO });
      bx('flat', F, x - hw, x + hw, 1.62, 7.58, 0, d, { c: MAYE });
      bx('flat', F, x - hw + 0.05, x + hw - 0.05, 7.58, 8.0, 0, d + 0.04, { c: '#ded7a8', noao: true });
      bx('flat', F, x - hw - 0.04, x + hw + 0.04, 8.08, 8.28, 0, d + 0.12, { c: MAMO, noao: true });
      for (const k of [-1, 1]) cyl('flat', 0.17, 0.17, 0.1, 8, { M: F, p: [x + k * (hw - 0.04), 7.94, d + 0.02], rx: PI / 2, c: '#f2eed0', noao: true });
    }
    bx('flat', F, s * 2.85 - 1.38, s * 2.85 + 1.38, 9.45, 9.7, 0, 0.26, { c: '#e0d9ac', noao: true });
    bx('flat', F, s * 2.85 - 1.5, s * 2.85 + 1.5, 9.7, 9.95, 0, 0.42, { c: MAMO, noao: true });
    // the raking cornice of the large pediment
    slab(F, [[s * 4.35, 9.95], [s * 4.35, 10.22], [0, 11.74], [0, 11.46]], 0, 0.36, MAMO);
    // lamps
    bx('flat', F, s * 2.8 - 0.03, s * 2.8 + 0.03, 4.32, 4.52, 0, 0.3, { c: '#2a2622', noao: true }); sphere('flat', 0.13, { M: F, p: [s * 2.8, 4.66, 0.28], seg: 6, c: '#e8e6da', noao: true });
    // brackets of the door's pediment
    bx('flat', F, s * 1.24 - 0.11, s * 1.24 + 0.11, 5.12, 5.66, 0, 0.22, { c: MAMO, noao: true });
    slab(F, [[s * 1.52, 5.65], [s * 1.52, 5.82], [0, 6.4], [0, 6.2]], 0, 0.34, MAMO);
  }
  bx('flat', F, -1.52, 1.52, 5.55, 5.72, 0, 0.34, { c: MAMO, noao: true });
  sphere('flat', 0.17, { M: F, p: [0, 5.94, 0.04], seg: 6, kz: 0.6, c: '#e8e2b8', noao: true });
  bx('flat', F, -0.95, 0.95, 6.66, 6.76, 0, 0.16, { c: MAMO, noao: true });
  // the wing: brown stone to the street, the windows and the drain pipe beside the church
  prism('stone', wp, lo, y0 + MAWING, { c: '#e4d3b8', uvo: [0, -y0 / 3.2] });
  prism('flat', wp, y0 + MAWING, y0 + MAWING + 0.12, { c: '#8d8478', noao: true });
  const E = edge([-921.1, -2795], [-940.7, -2816.1], y0, wp);
  const dir = Math.sign(new THREE.Vector3(-921.1, y0, -2795).applyMatrix4(E.M.clone().invert()).x) || 1;   // the end of the wing that touches the church
  const at = d => dir * (E.l / 2 - d);
  for (const [a, b, c, d] of [[0.38, 1.64, 6.52, 8.4], [0.55, 1.65, 2.7, 4.25]]) maBarred(E.M, Math.min(at(a), at(b)), Math.max(at(a), at(b)), c, d);
  bx('flat', E.M, at(0.2) - 0.06, at(0.2) + 0.06, 0.2, MAWING - 0.2, 0, 0.14, { c: '#2b2a2c', noao: true });
  bx('flat', E.M, -E.l / 2, E.l / 2, MAWING - 0.22, MAWING + 0.12, -0.1, 0.18, { c: '#9a876c', noao: true });
  const o = end('Parrocchia Maria SS. Ausiliatrice');
  o.userData.solids = [[MA.p, null, y0 + MABODY], [WING.p, null, y0 + MAWING]];
  return o;
}

// =====================================================================================================
// Sacra Famiglia
// =====================================================================================================
const SF = { p: [841.1, 645, 846.7, 644.9, 856.6, 639.2, 876.8, 671.5, 849.4, 688.3, 844.9, 680.4, 852.3, 675.6, 843.5, 658.2, 839.5, 658.1] };
// the canvas: the upper front at its real heights (x centred on the front), the street wall painted again from SFBASE up, by distance along the front from the left end
const SFW = 20, SFH = 15, SFBASE = 11, SFL = 18.15, SFTER = 3.35, SFTOP = 9.4, SFHI = 10.5, SFOC = '#c8a886';
const SFX = s => s - SFL / 2;
function sfCanvas(g, w, h) {
  const p = paint(g, w, h, SFW, SFH), { R, poly, circ, line } = p;
  g.fillStyle = SFOC; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, 9801, ['rgba(90,60,35,0.08)', 'rgba(255,238,210,0.08)']);
  for (let x = -SFW / 2; x < SFW / 2; x += 0.42) R(x, SFTER, x + 0.04, SFHI, 'rgba(90,60,35,0.12)');
  wear(g, w, h, 9802, 26, 0.07);
  // the relief of the Holy Family
  const cx = SFX(7.9);
  for (const [dx, dy, c] of [[0.05, -0.05, 'rgba(60,30,18,0.45)'], [0, 0, '#8d4f33']]) {
    const q = pts => poly(pts.map(([x, y]) => [cx + x + dx, y + dy]), c);
    q([[-0.75, 6.05], [-0.1, 6.05], [-0.18, 6.9], [-0.28, 7.35], [-0.5, 7.4], [-0.62, 6.7]]); circ(cx - 0.4 + dx, 7.55 + dy, 0.17, c);
    q([[0.1, 6.05], [0.72, 6.05], [0.62, 7.0], [0.5, 7.55], [0.2, 7.55], [0.12, 6.9]]); circ(cx + 0.34 + dx, 7.74 + dy, 0.17, c);
    q([[-0.2, 6.05], [0.18, 6.05], [0.1, 6.65], [-0.1, 6.65]]); circ(cx + dx, 6.82 + dy, 0.13, c);
  }
  line(cx - 0.45, 7.2, cx - 0.3, 6.35, 0.05, '#b4744e'); line(cx + 0.38, 7.4, cx + 0.45, 6.3, 0.05, '#b4744e');
  // inside the porch (seen through the opening): pale stone, a dark glazed door
  R(SFX(10.0), 3.0, SFX(16.0), 5.9, '#b39a7a');
  for (let y = 3.7; y < 5.8; y += 0.42) R(SFX(10.0), y, SFX(16.0), y + 0.035, 'rgba(80,60,40,0.35)');
  R(SFX(10.7), SFTER, SFX(12.0), 5.25, '#332a24'); R(SFX(11.32), SFTER, SFX(11.38), 5.25, '#8a7660'); R(SFX(14.0), 4.0, SFX(14.55), 5.0, '#3b3029'); R(SFX(14.75), SFTER, SFX(15.1), 4.5, '#47604a');
  R(SFX(10.0), 5.45, SFX(16.0), 5.9, 'rgba(40,24,14,0.4)');
  // the street wall: stone blocks, barred openings, the plaque
  const B = SFBASE, X0 = s => s - SFW / 2, r = RNG(9803);
  R(-SFW / 2, B - 0.6, SFW / 2, SFH, '#9d8266');
  for (let y = 0; y < 3.7; y += 0.41) for (let x = -SFW / 2 - r(); x < SFW / 2;) { const bw = 0.45 + r() * 0.7, k = r(); R(x + 0.03, B + y + 0.03, x + bw, B + y + 0.39, k < 0.33 ? '#c4a27c' : k < 0.66 ? '#b99772' : '#ceae88'); x += bw + 0.02; }
  R(-SFW / 2, B + SFTER - 0.12, SFW / 2, B + SFH - SFBASE, '#d2b693');
  for (const [a, b, lo, hi] of [[5.4, 6.6, 0, 2.2], [7.2, 11.1, 0.2, 2.3], [11.6, 14.0, 0.2, 2.4], [14.4, 16.2, 0.2, 2.45]]) {
    R(X0(a) - 0.08, B + lo - 0.06, X0(b) + 0.08, B + hi + 0.1, '#93775a'); R(X0(a), B + lo, X0(b), B + hi, '#271c16');
    for (let x = a + 0.1; x < b; x += 0.2) R(X0(x), B + lo, X0(x) + 0.045, B + hi, '#6a5444');
    R(X0(a), B + hi - 0.45, X0(b), B + hi - 0.4, '#6a5444'); R(X0(a), B + lo + 0.35, X0(b), B + lo + 0.4, '#6a5444');
  }
  R(X0(9.9), B + 2.55, X0(10.4), B + 3.0, '#e8e2d2'); for (let y = 2.64; y < 2.95; y += 0.09) R(X0(9.97), B + y, X0(10.33), B + y + 0.025, '#6a6258');
}
function buildSacraFamiglia() {
  initShared();
  const A = [840.8, 647.4], Bp = [857.9, 641.3], N = [-0.336, -0.942], M = [(A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2];
  const W = (x, z) => [M[0] + x * N[1] + z * N[0], M[1] - x * N[0] + z * N[1]];
  const S = s => (s - 10) / SFW + 0.5;
  const pts = pairsOf(SF.p), street = [[856.6, 639.2], [846.7, 644.9], [841.1, 645]];
  const y0 = Math.min(...street.map(q => groundY(...q))), lo = Math.min(groundRange(pts).lo, y0) - 1.5;
  const F = frame(M[0], y0, M[1], N[0], N[1]);
  defMat('bsSf', 512, 384, [SFW, SFH], sfCanvas);
  begin(y0);
  const front = z => [W(SFX(0), z), W(SFX(10.25), z), W(SFX(10.25), -2.1), W(SFX(15.8), -2.1), W(SFX(15.8), z), W(SFX(SFL), z)];
  // the church, with the porch cut into it
  const f = front(-0.3);
  const body = [...f, [839.5, 658.1], [843.5, 658.2], [852.3, 675.6], [844.9, 680.4], [849.4, 688.3], [876.8, 671.5]];
  prism('plaster', body, lo, y0 + SFTOP, { c: SFOC }); prism('flat', body, y0 + SFTOP, y0 + SFTOP + 0.1, { c: '#8f8479', noao: true });
  // the terrace on the ground floor
  const terrace = [street[2], street[1], street[0], ...f];
  prism('flat', terrace, lo, y0 + SFTER, { c: '#b79a7a' });
  // the upper front with the opening of the porch, the higher right hand end, the coping
  const up = shapeOf([[SFX(0), 3.0], [SFX(SFL), 3.0], [SFX(SFL), SFHI], [SFX(15.2), SFHI], [SFX(15.2), SFTOP], [SFX(0), SFTOP]]);
  const hole = new THREE.Path(); hole.moveTo(SFX(10.25), SFTER); hole.lineTo(SFX(10.25), 5.8); hole.lineTo(SFX(15.8), 5.8); hole.lineTo(SFX(15.8), SFTER); hole.closePath(); up.holes.push(hole);
  const skin = { M: F, uv: 'keep', uvk: [1 / SFW, 1 / SFH], uvo: [0.5, 0], noao: true };
  extrude('bsSf', up, 0.32, { ...skin, p: [0, 0, -0.32] });
  extrude('bsSf', shapeOf(rect(SFX(10.25), SFTER - 0.05, SFX(15.8), 5.85)), 0.06, { ...skin, p: [0, 0, -2.12] });
  bx('flat', F, SFX(10.25), SFX(15.8), 5.8, SFTOP - 0.05, -2.12, -0.32, { c: '#ab9376', noao: true });
  for (const [a, b] of [[10.25, 10.6], [15.45, 15.8]]) bx('flat', F, SFX(a), SFX(b), SFTER, 5.8, -0.4, 0.07, { c: '#e6dcc6', noao: true });
  for (const [a, b] of [[10.58, 10.64], [15.41, 15.47]]) bx('flat', F, SFX(a), SFX(b), SFTER, 5.8, -2.08, -0.4, { c: '#c4ac8a', noao: true });
  bx('flat', F, SFX(15.2), SFX(SFL), SFTOP, SFHI - 0.02, -3.0, -0.3, { c: '#c1a281', noao: true });
  bx('flat', F, SFX(13.5), SFX(15.2), SFTOP, 10.4, -2.6, -1.4, { c: '#cdb18c', noao: true });
  for (const [a, b, y] of [[0, 15.2, SFTOP], [15.2, SFL, SFHI]]) bx('flat', F, SFX(a) - 0.03, SFX(b) + 0.03, y - 0.04, y + 0.1, -0.42, 0.06, { c: '#5c4234', noao: true });
  // the cross and the raised shapes of the relief
  bx('flat', F, SFX(16.75), SFX(17.05), 6.2, 9.33, 0, 0.09, { c: '#e9dab4', noao: true });
  bx('flat', F, SFX(15.7), SFX(18.1), 8.36, 8.64, 0, 0.1, { c: '#e9dab4', noao: true });
  const cx = SFX(7.9);
  for (const q of [[[-0.7, 6.1], [-0.16, 6.1], [-0.3, 7.3], [-0.52, 7.35]], [[0.16, 6.1], [0.66, 6.1], [0.46, 7.5], [0.22, 7.5]]]) slab(F, q.map(([x, y]) => [cx + x, y]), 0, 0.1, '#8d4f33');
  for (const [x, y, r] of [[-0.4, 7.55, 0.15], [0.34, 7.74, 0.15], [0, 6.82, 0.12]]) sphere('flat', r, { M: F, p: [cx + x, y, 0.02], seg: 6, kz: 0.7, c: '#9a5a3a', noao: true });
  // the street wall: stone over the two street faces, a stone edge, pots and the railing at the left end
  const along = q => ((q[0] - Bp[0]) * N[1] - (q[1] - Bp[1]) * N[0]);   // distance along the front from its left end
  for (let i = 0; i < 2; i++) {
    const a = street[i], b = street[i + 1], E = edge(a, b, y0, pts), sa = along(a), sb = along(b), k = (sb - sa) / E.l;
    extrude('bsSf', shapeOf(rect(-E.l / 2, -1.5, E.l / 2, SFTER)), 0.06, { M: E.M, p: [0, 0, -0.03], uv: 'keep', uvk: [k / SFW, 1 / SFH], uvo: [S((sa + sb) / 2), SFBASE / SFH], noao: true });
    bx('flat', E.M, -E.l / 2, E.l / 2, SFTER, SFTER + 0.14, -0.3, 0.07, { c: '#d3b48c', noao: true });
    const n = Math.floor(E.l / 1.15);
    for (let j = 0; j < n; j++) {
      const x = -E.l / 2 + (j + 0.5) * E.l / n, big = i === 0 && sa + (sb - sa) * (j + 0.5) / n < 6;
      cyl('flat', 0.22, 0.15, 0.3, 6, { M: E.M, p: [x, SFTER + 0.14, -0.2], c: '#9a5a3e', noao: true });
      sphere('flat', big ? 0.34 : 0.19, { M: E.M, p: [x, SFTER + (big ? 0.7 : 0.55), -0.28], seg: 6, kz: 0.6, c: j % 2 ? '#3f5230' : '#4a6036', noao: true });
    }
    if (i === 0) rail(mul(E.M, tr(-E.l / 2 + 2.6, SFTER + 0.14, -0.55)), 4.6, 0.95);
  }
  const o = end('Parrocchia Sacra Famiglia');
  o.userData.solids = [[terrace.flat(), null, y0 + SFTER], [body.flat(), null, y0 + SFTOP]];
  return o;
}

export const BATCH_S = [
  { name: 'Parrocchia Maria SS. Ausiliatrice', x: -919, z: -2806, radius: 40, skipIds: ['w1160934383', 'w278478959'], build: buildAusiliatrice },
  { name: 'Parrocchia Sacra Famiglia', x: 857, z: 662, radius: 45, skipIds: ['w81301748'], build: buildSacraFamiglia },
];
