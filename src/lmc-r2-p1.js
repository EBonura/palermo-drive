// Round 2 landmarks, batch P1: five palaces that were drawn by the generic builder. Registered through src/lmc-r2.js.
// Photos were looked at only, nothing is copied. Heights and positions along the fronts were read by fitting the camera of one photo per palace to the footprint and intersecting its rays with the wall planes,
// so treat them as good to about half a metre. Each palace is one painted texture plus shared 'flat' relief (cornices, pediments, balconies, columns) and, where there are iron balconies, the shared 'rail'.
// Collision is the footprint (the tile's own walls). Nothing at street level stands more than about 0.3 m out of it.
//
// Palazzo delle Ferrovie (r3233024.0), Via Roma at Via Gorizia. Photos: the front and north corner from palermoepalermitani.it (articles on the palace), Mapillary 227007736033335 (September 2021).
//  Read: a base of rock faced grey stone, a banded floor with round headed windows and green shutters, pediments on the first floor, a heavy cornice on consoles; the middle set back between two end pavilions,
//  three stone arches under a balcony with globe lamps and flags, one floor more than the ends, FERROVIE DELLO STATO under a curved gable with a dark emblem.
//  Not verified: the south and east faces (no photo shows them: drawn plain, with a bare window per storey), the north face beyond its first few windows (the same rhythm carried on), the courtyard, the roofs.
// Palazzo Utveggio (w278476641), Via XX Settembre 62 at Via Siracusa. The point recorded for it falls on the modern block next door (w278475732): street views put the rusticated front on this footprint.
//  Photos: Wikimedia Commons "Palazzo Utveggio 01" and "02", Mapillary 370991054236188, 1172147413232568 (2015), 821871295100131, 244770570719371 (2014). Read: five bays, a grey rusticated base and ground floor,
//  the door with A.D. MDCCCCIII, three floors of balconies on carved consoles with iron rails, louvred shutters, carved lintels, flat pilasters rising above the cornice as capped blocks.
//  Not verified: the south front beyond its base, balconies and cornice (six bays of the same kind assumed), the west and rear walls (plain), the roof.
// Palazzo Dato (w237087193), corner of Via XX Settembre and Via Dodici Gennaio. Photos: leviedeitesori.com (articles on the restoration, front and corner), balarm.it, the corner view before the works used by wonderfulitaly.eu,
//  restoration details on edilsacif.com.
//  Read: the restored red walls with ochre whiplash ornament, stone base, three bays on each street, the door on Via XX Settembre, stone balconies on curved corbels under round headed windows,
//  two floors of iron balconies above, a bracketed cornice. Not verified: the walls against the neighbours (plain), the roof.
// Palazzo Ziino (w204463217), Via Dante at Via Giuseppe De Spuches. Photos: myartguides.com and balarm.it (front and entrance), Wikimedia Commons "Palazzo Ziino" (corner). Read: five bays, rusticated ground
//  floor with the arched door, latticed windows and the two banners, a long balustrade over the three middle bays, four fluted Corinthian columns through two floors, stone balconies and then iron ones above.
//  On Via De Spuches: iron balconies, the same ground floor and cornice. Not verified: the number of bays on that side (five assumed), the rear and courtyard walls (plain).
// Palazzo Branciforte (w228199207), Via Bara all'Olivella. Photos: Wikimedia Commons "Palazzo Branciforte facciata", "Palazzo Branciforte Palermo 07" and the plaque views beside them. Read: rough stone foot,
//  ochre ashlar ground floor, white wall with ochre window frames, small square attic frames, two round openings, the plaques, the arms, MONTE DI SANTA ROSALIA over the rusticated portal, lamps, dentil cornice.
//  Not verified: the first 14 m of the front from its east end (no windows drawn there), the other three faces (plain ochre foot, white wall and cornice), the courtyard (only the glimpse through the gate), the roof.
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, extrude, panel, part, prism, begin, end, defMat, frame, groundY, initShared, noiseDots, streaks, pairsOf, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// the face of the wall a-b of the polygon poly: a frame at its left end (seen from outside) at height y, +x along the wall, +z out of the building
function face(poly, a, b, y, hole = false) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; let nx = -dz / L, nz = dx / L;
  if (inPoly(poly, (a[0] + b[0]) / 2 + nx * 0.3, (a[1] + b[1]) / 2 + nz * 0.3) !== hole) { nx = -nx; nz = -nz; }
  const o = a[0] * nz - a[1] * nx < b[0] * nz - b[1] * nx ? a : b;
  return { M: frame(o[0], y, o[1], nx, nz), L };
}
// a plain wall quad of that face
const wall = (F, x0, x1, y0, y1, z, c) => panel('flat', x1 - x0, y1 - y0, { M: F, p: [(x0 + x1) / 2, y0, z], c });
// the walls of every edge of a ring that has no painted front, in plain colour from lo to H
function plainWalls(ring, y0, lo, H, c, skip = [], hole = false) {
  for (let i = 0; i < ring.length; i++) { if (skip.includes(i)) continue; const F = face(ring, ring[i], ring[(i + 1) % ring.length], y0, hole); wall(F.M, 0, F.L, lo - y0, H, 0, c); }
}
// a region of a canvas CW x CH that holds a wall of Wm x Hm metres: painting calls in metres (x from the left edge, y up from the foot), and the uv of any part of it
function region(g, px, py, pw, ph, Wm, Hm) {
  const sx = pw / Wm, sy = ph / Hm, X = x => px + x * sx, Y = y => py + ph - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, w, c) => { const r = w / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (pts, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke(); };
  // a curve [start, control, end, control, end, ...]
  const curve = (p, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(p[0][0]), Y(p[0][1])); for (let i = 1; i + 1 < p.length; i += 2) g.quadraticCurveTo(X(p[i][0]), Y(p[i][1]), X(p[i + 1][0]), Y(p[i + 1][1])); g.stroke(); };
  const blob = (p, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(p[0][0]), Y(p[0][1])); for (let i = 1; i + 1 < p.length; i += 2) g.quadraticCurveTo(X(p[i][0]), Y(p[i][1]), X(p[i + 1][0]), Y(p[i + 1][1])); g.closePath(); g.fill(); };
  const text = (t, x, y, h, w, c, rot = 0, font = 'serif') => { g.save(); g.translate(X(x), Y(y)); g.rotate(rot); const len = w * (rot ? sy : sx), ht = h * (rot ? sx : sy); g.fillStyle = c; g.font = `bold ${Math.max(5, Math.round(ht))}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0, len); g.restore(); };
  // louvred shutters or a closed leaf filling x0..x1
  const louvre = (x0, y0, x1, y1, c, mid = true) => { R(x0, y0, x1, y1, c); for (let y = y0 + 0.14; y < y1 - 0.05; y += 0.19) R(x0, y, x1, y + 0.05, 'rgba(0,0,0,0.3)'); if (mid) R((x0 + x1) / 2 - 0.035, y0, (x0 + x1) / 2 + 0.035, y1, 'rgba(0,0,0,0.45)'); };
  return { sx, sy, X, Y, R, poly, arch, circ, line, curve, blob, text, louvre };
}
// panel() options that show the part x0..x1, y0..y1 (metres) of such a region
const uvOf = (CW, CH, px, py, pw, ph, Wm, Hm) => (x0, x1, y0, y1) => ({ uvk: [(x1 - x0) / Wm * pw / CW, (y1 - y0) / Hm * ph / CH], uvo: [(px + x0 / Wm * pw) / CW, 1 - (py + ph - y0 / Hm * ph) / CH] });
// a painted quad x0..x1, y0..y1 of a face, showing the metres u0..u1 (default the same span) of the region
const front = (key, uv, F, x0, x1, y0, y1, z, u0 = x0, u1 = x1, v0 = y0, v1 = y1) => panel(key, x1 - x0, y1 - y0, { M: F, p: [(x0 + x1) / 2, y0, z], ...uv(u0, u1, v0, v1) });
const base = (g, w, h, c, seed, a = 0.07) => { g.fillStyle = c; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 1.8, seed, [`rgba(90,60,35,${a})`, 'rgba(255,248,232,0.08)']); };
// wear over a whole canvas: soft stains, streaks from the ledges
function wear(g, w, h, seed, n, a = 0.09) {
  const r = RNG(seed);
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h, rad = (0.1 + r() * 0.2) * Math.max(w, h), k = r() < 0.6 ? '60,42,25' : '255,246,225', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${k},${a * (0.5 + r() * 0.6)})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, a, h * 0.14, '60,46,32');
}
// rough stone blocks between y0 and y1
function rocks(p, x0, x1, y0, y1, hh, bw, cols, joint, seed) {
  const r = RNG(seed); p.R(x0, y0, x1, y1, joint);
  for (let y = y0; y < y1 - 0.05; y += hh) { let x = x0 - r() * bw; while (x < x1) { const w = bw * (0.6 + r() * 0.8), a = Math.max(x0, x + 0.05), b = Math.min(x1, x + w - 0.05), t = Math.min(y1, y + hh - 0.07); if (b > a) { p.R(a, y + 0.04, b, t, cols[(r() * cols.length) | 0]); p.R(a, t - 0.09, b, t, 'rgba(255,250,235,0.18)'); p.R(a, y + 0.04, b, y + 0.13, 'rgba(30,22,14,0.2)'); } x += w; } }
}
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const slab = (F, pts, z0, z1, c) => extrude('flat', shapeOf(pts), z1 - z0, { M: F, p: [0, 0, z0], c, noao: true });
const fb = (F, x0, x1, y0, y1, z0, z1, c) => bx('flat', F, x0, x1, y0, y1, z0, z1, { c, noao: true });
// a console under a ledge: a wedge w wide at x, from y (foot, on the wall) to y + h (out to depth d)
const wedge = (F, x, y, w, h, d, c, z = 0) => extrude('flat', shapeOf([[0, 0], [d, h], [0, h]]), w, { M: F, p: [x + w / 2, y, z], ry: -PI / 2, c, noao: true });
// an iron balcony: slab whose top is at y, two brackets, the rail on three sides
function ironBalcony(F, x, y, w, d, c, o = {}) {
  fb(F, x - w / 2, x + w / 2, y - 0.16, y, 0, d, c);
  for (const s of o.br || [-1, 1]) wedge(F, x + s * (w / 2 - 0.25), y - 0.16 - (o.bh || 0.45), 0.14, o.bh || 0.45, d * 0.85, o.bc || c);
  const h = 1.05;
  panel('rail', w, h, { M: F, p: [x, y, d - 0.04], uvk: [w / 1.1, 1] });
  for (const s of [-1, 1]) panel('rail', d - 0.04, h, { M: F, p: [x + s * (w / 2 - 0.02), y, (d - 0.04) / 2], ry: s * PI / 2, uvk: [(d - 0.04) / 1.1, 1] });
}
const solid = (o, flat, holes, y) => { o.userData.solids = [[flat, holes, y]]; return o; };

// =====================================================================================================
// Palazzo delle Ferrovie
// =====================================================================================================
const FE = { id: 'r3233024.0', p: [411.8, 404.5, 491.5, 373.7, 506.8, 412.4, 428.9, 450.6, 420.2, 427.2], hole: [480.0, 390.5, 486.6, 407.6, 440.1, 430.0, 436.2, 420.0, 431.6, 408.0] };
const FEW = 49.2, FEH = 22.8, FETOP = 27, FEP = 15.8, FEBAY = 4.35;   // west front, roof height, gable height, width of an end pavilion, bay
const FEAX = [3.3, 7.7, 12.0], FECX = [18.4, 22.5, 26.7, 30.8];
const FECREAM = '#d6c8a8', FESTONE = '#8f877a', FETRIM = '#e4d9bd', FEGREEN = '#37493d';
const FEC = [576, 288], FER = [0, 5, 516, 283, FEW, FETOP], FEPL = [524, 49, 48, 239, FEBAY, FEH];
// one storey set of a pavilion window axis at x (v: which shutters stand open)
function feAxis(p, x, v) {
  const { R, arch, louvre, poly } = p;
  // the barred window in the rock base
  R(x - 0.95, 1.2, x + 0.95, 3.1, '#a49f93'); R(x - 0.7, 1.35, x + 0.7, 2.9, '#24272a'); for (let k = -0.55; k < 0.6; k += 0.35) R(x + k, 1.35, x + k + 0.08, 2.9, '#585c5c'); R(x - 0.7, 2.1, x + 0.7, 2.2, '#585c5c');
  // the round headed window of the banded floor: voussoirs, open shutters, panel under the sill
  arch(x, 4.9, 7.85, 2.5, '#c3b290'); arch(x, 4.9, 7.4, 1.6, FETRIM); arch(x, 4.9, 7.28, 1.35, '#39424a'); R(x - 0.04, 4.9, x + 0.04, 7.2, '#cfc8b6');
  louvre(x - 1.28, 4.9, x - 0.72, 7.0, FEGREEN, false); louvre(x + 0.72, 4.9, x + 1.28, 7.0, FEGREEN, false);
  R(x - 0.85, 4.65, x + 0.85, 4.88, FETRIM); R(x - 0.7, 4.05, x + 0.7, 4.55, '#bfae8c');
  // first floor under its pediment
  R(x - 0.98, 9.35, x + 0.98, 12.25, FETRIM); louvre(x - 0.68, 9.6, x + 0.68, 11.9, FEGREEN); poly([[x - 1.25, 12.25], [x + 1.25, 12.25], [x, 13.2]], '#c8b794'); R(x - 1.1, 12.15, x + 1.1, 12.28, 'rgba(60,45,25,0.35)');
  R(x - 0.95, 8.6, x + 0.95, 9.35, '#cbbb99'); for (let k = -0.75; k < 0.8; k += 0.25) R(x + k, 8.7, x + k + 0.1, 9.2, '#a8987a');
  // second and third floors
  for (const [y0, y1, open] of [[14.7, 17.2, v % 3 === 1], [19.0, 21.3, v % 2 === 0]]) {
    R(x - 0.9, y0 - 0.15, x + 0.9, y1 + 0.2, FETRIM); R(x - 1.05, y1 + 0.3, x + 1.05, y1 + 0.55, '#c6b592'); R(x - 1.05, y1 + 0.22, x + 1.05, y1 + 0.3, 'rgba(60,45,25,0.35)');
    if (open) { R(x - 0.65, y0, x + 0.65, y1, '#50606a'); R(x - 0.04, y0, x + 0.04, y1, '#e6e2d6'); louvre(x - 1.18, y0, x - 0.68, y1, FEGREEN, false); louvre(x + 0.68, y0, x + 1.18, y1, FEGREEN, false); } else louvre(x - 0.65, y0, x + 0.65, y1, FEGREEN);
    R(x - 0.8, y0 - 0.75, x + 0.8, y0 - 0.22, '#c4b492');
  }
}
function feBands(p, x0, x1) {
  const { R } = p;
  rocks(p, x0, x1, 0, 3.8, 0.62, 0.9, ['#aaa69b', '#b8b3a6', '#989489', '#a29a8b'], '#6b665d', 4101);
  for (let y = 4.25; y < 8.0; y += 0.45) R(x0, y, x1, y + 0.07, 'rgba(100,75,45,0.38)');
  for (let y = 8.9; y < 13.3; y += 0.5) R(x0, y, x1, y + 0.05, 'rgba(100,75,45,0.22)');
  R(x0, 3.75, x1, 3.98, '#bdb6a6'); R(x0, 8.0, x1, 8.42, FETRIM); R(x0, 7.88, x1, 8.0, 'rgba(60,45,25,0.4)');
  R(x0, 13.4, x1, 13.65, FETRIM); for (let x = x0 + 0.1; x < x1; x += 0.36) R(x, 13.15, x + 0.18, 13.4, '#a8977a');
  R(x0, 21.55, x1, 22.1, '#bba988'); for (let x = x0 + 0.3; x < x1; x += 0.72) R(x, 21.6, x + 0.3, 22.1, FETRIM); R(x0, 22.1, x1, FEH, FETRIM);
}
function feTex(g, w, h) {
  base(g, w, h, FECREAM, 4100);
  const p = region(g, ...FER), { R, arch, louvre, poly, text, circ, curve } = p;
  for (const [x0, x1, ax] of [[0, FEP, FEAX], [FEW - FEP, FEW, FEAX.map(a => FEW - a).reverse()]]) {
    feBands(p, x0, x1); ax.forEach((x, i) => feAxis(p, x, i + (x0 ? 1 : 0)));
    for (const x of [x0 + 0.6, x1 - 0.6]) { R(x - 0.55, 8.42, x + 0.55, 21.55, '#dbcfb1'); R(x - 0.55, 8.42, x - 0.45, 21.55, 'rgba(255,250,235,0.5)'); R(x + 0.42, 8.42, x + 0.55, 21.55, 'rgba(80,60,35,0.3)'); R(x - 0.25, 14.3, x + 0.25, 18.6, '#d0c2a0'); circ(x, 20.6, 0.25, '#bba988'); }
  }
  // the middle: grey stone ground floor with the three arches
  const c0 = FEP, c1 = FEW - FEP, cx = FEW / 2;
  rocks(p, c0, c1, 0, 3.8, 0.62, 1.0, ['#878074', '#968e80', '#7a746a'], '#4f4a43', 4102);
  R(c0, 3.8, c1, 7.7, FESTONE); for (let y = 4.2; y < 7.6; y += 0.48) R(c0, y, c1, y + 0.07, 'rgba(40,32,22,0.38)');
  arch(cx, 0, 7.15, 4.0, '#b0a796'); arch(cx, 0, 6.55, 3.0, '#26211c'); for (let x = cx - 1.35; x < cx + 1.4; x += 0.3) R(x, 4.5, x + 0.06, 5.9, '#6a5f4d'); R(cx - 1.5, 4.4, cx + 1.5, 4.6, '#4c4336'); R(cx - 0.04, 0, cx + 0.04, 4.4, '#4a3b2a');
  for (const s of [-1, 1]) {
    const x = cx + s * 4.2; arch(x, 4.9, 7.35, 3.1, '#aba291'); arch(x, 5.0, 7.0, 2.3, '#2b2925'); for (let k = -0.95; k < 1; k += 0.32) R(x + k, 5.05, x + k + 0.07, 6.5, '#5e594e');
    R(x - 1.25, 0, x + 1.25, 4.75, '#aaa292'); R(x - 0.95, 0, x + 0.95, 4.4, '#2c241c'); R(x - 0.04, 0, x + 0.04, 4.4, '#151008');
    for (const k of [-2.1, 2.1]) R(x + k - 0.28, 0, x + k + 0.28, 7.5, '#a39a8a');
    const o = cx + s * 7.6; arch(o, 4.4, 7.4, 1.6, '#c0b7a3'); arch(o, 4.4, 7.2, 1.3, '#39424a'); louvre(o - 1.1, 4.4, o - 0.68, 6.8, FEGREEN, false); louvre(o + 0.68, 4.4, o + 1.1, 6.8, FEGREEN, false); R(o - 0.7, 1.35, o + 0.7, 2.9, '#24272a');
  }
  R(c0, 7.7, c1, 9.0, '#9a9284');
  // the floors of the middle
  FECX.forEach((x, i) => {
    R(x - 0.98, 9.0, x + 0.98, 12.0, FETRIM); louvre(x - 0.68, 9.1, x + 0.68, 11.7, FEGREEN); if (i === 1) { p.blob([[x - 1.2, 12.0], [x, 13.7], [x + 1.2, 12.0]], '#c8b794'); } else poly([[x - 1.2, 12.0], [x + 1.2, 12.0], [x, 12.95]], '#c8b794');
    for (const [y0, y1, open] of [[13.0, 15.3, i === 3], [16.9, 19.5, i < 2]]) { R(x - 0.85, y0 - 0.15, x + 0.85, y1 + 0.18, FETRIM); R(x - 1.0, y1 + 0.25, x + 1.0, y1 + 0.48, '#c6b592'); if (open) { R(x - 0.6, y0, x + 0.6, y1, '#56656c'); louvre(x - 1.12, y0, x - 0.63, y1, FEGREEN, false); louvre(x + 0.63, y0, x + 1.12, y1, FEGREEN, false); } else louvre(x - 0.6, y0, x + 0.6, y1, FEGREEN); R(x - 0.75, y0 - 0.65, x + 0.75, y0 - 0.22, '#c4b492'); }
  });
  R(c0, 12.55, c1, 12.72, '#bdac8c'); for (let x = c0; x < c1; x += 0.36) R(x, 12.35, x + 0.18, 12.55, '#ab9a7c');
  R(c0, 20.65, c1, 21.15, FETRIM); R(c0, 20.5, c1, 20.65, 'rgba(60,45,25,0.4)');
  for (const x of [cx - 4.2, cx, cx + 4.2]) { R(x - 1.55, 21.35, x + 1.55, 23.95, FETRIM); for (const [k, ww] of [[-1.05, 0.55], [0, 1.0], [1.05, 0.55]]) louvre(x + k - ww / 2, 21.55, x + k + ww / 2, 23.7, FEGREEN, ww > 0.8); R(x - 1.4, 21.15, x + 1.4, 21.5, '#c4b492'); }
  R(c0 + 0.8, 24.05, c1 - 0.8, 25.35, '#ded2b4'); text('FERROVIE DELLO STATO', cx, 24.7, 1.15, 14.2, '#4a4435');
  curve([[c0 + 0.7, 25.55], [cx, 28.3], [c1 - 0.7, 25.55]], 0.4, '#bba988');
  for (const x of [c0 + 1.1, c1 - 1.1]) { circ(x, 24.7, 0.42, '#6d6a58'); R(x - 0.5, 21.2, x + 0.5, 23.6, '#d0c2a0'); }
  // the bare walls: base, courses, cornice and one plain window a storey
  const q = region(g, ...FEPL);
  feBands(q, 0, FEBAY);
  for (const [y0, y1] of [[5.0, 7.2], [9.6, 11.8], [14.8, 17.1], [19.0, 21.2]]) { q.R(1.4, y0 - 0.15, 2.95, y1 + 0.15, '#dcd0b2'); q.louvre(1.55, y0, 2.8, y1, '#4a574a'); }
  q.R(1.5, 1.4, 2.85, 2.8, '#2c2f30');
  wear(g, w, h, 4103, 90, 0.08);
}
function buildFerrovie() {
  initShared();
  defMat('r2p1Fe', FEC[0], FEC[1], [FEW, FETOP], feTex);
  const pts = pairsOf(FE.p), hole = pairsOf(FE.hole), y0 = groundY(419.8, 427.3) - 0.12, lo = Math.min(...pts.map(q => groundY(q[0], q[1]))) - 0.8;
  const uv = uvOf(...FEC, ...FER), uvp = uvOf(...FEC, ...FEPL);
  begin(y0);
  prism('flat', pts.map((q, i) => i === 0 || i > 2 ? [q[0] + 0.9, q[1] - 0.33] : q), y0 + FEH - 0.05, y0 + FEH + 0.12, { holes: [hole], c: '#a39c90', noao: true });   // (set in from the front, so that it does not cross the gable)
  plainWalls(hole, y0, lo, FEH, '#c9bb9c', [], true);
  const W = face(pts, pts[0], pts[3], y0), N = face(pts, pts[0], pts[1], y0), S = face(pts, pts[3], pts[2], y0), E = face(pts, pts[1], pts[2], y0);
  for (const F of [W, N, S, E]) wall(F.M, 0, F.L, lo - y0, 0, 0.02, '#8d897f');
  const k = W.L / FEW, c0 = FEP * k, c1 = W.L - FEP * k, cx = W.L / 2, Z = -0.5;
  // the two end pavilions, the middle set back between them under its curved gable
  front('r2p1Fe', uv, W.M, -0.03, c0, 0, FEH, 0.03, 0, FEP);
  front('r2p1Fe', uv, W.M, c1, W.L + 0.03, 0, FEH, 0.03, FEW - FEP, FEW);
  const U = uv(0, 1, 0, 1), top = new THREE.Shape(); top.moveTo(FEP, 0); top.lineTo(FEW - FEP, 0); top.lineTo(FEW - FEP, 23.7); top.lineTo(FEW - FEP - 0.7, 23.7); top.lineTo(FEW - FEP - 0.7, 25.6); top.quadraticCurveTo(FEW / 2, 28.4, FEP + 0.7, 25.6); top.lineTo(FEP + 0.7, 23.7); top.lineTo(FEP, 23.7); top.closePath();
  extrude('r2p1Fe', top, 0.35, { M: W.M, p: [0, 0, Z - 0.35], s: [k, 1, 1], uv: 'keep', uvk: U.uvk, uvo: U.uvo, noao: true, cs: 6 });
  for (const [x, s] of [[c0, 1], [c1, -1]]) panel('flat', -Z + 0.03, FEH, { M: W.M, p: [x, 0, (Z + 0.03) / 2], ry: s * PI / 2, c: '#cbbd9e' });
  fb(W.M, c0 + 0.3, c1 - 0.3, FEH, 24.0, -4.0, Z - 0.35, '#cdbf9f');
  // the ledges: plinth, the rock base's top, the banded floor's cornice, the dentil band, the cornice on its consoles
  const run = (F, x0, x1, nCons) => {
    fb(F, x0, x1, -0.4, 0.75, 0, 0.18, '#969287'); fb(F, x0, x1, 3.75, 3.98, 0, 0.2, '#c2bbab'); fb(F, x0, x1, 8.0, 8.42, 0, 0.32, FETRIM); fb(F, x0, x1, 13.42, 13.64, 0, 0.14, FETRIM);
    fb(F, x0, x1, 21.55, 22.15, 0, 0.18, '#cdbd9b'); fb(F, x0 - 0.1, x1 + 0.1, 22.15, FEH + 0.1, -0.2, 0.75, '#ded1b2');
    for (let i = 0; i < nCons; i++) wedge(F, x0 + 0.35 + i * 1.45, 21.55, 0.34, 0.6, 0.62, '#d5c7a6', 0.05);
  };
  run(W.M, 0, c0, 11); run(W.M, c1, W.L, 11); run(N.M, 0, N.L, 0);
  for (let i = 0; i < 18; i++) wedge(N.M, N.L - 0.7 - i * 1.45, 21.55, 0.34, 0.6, 0.62, '#d5c7a6', 0.05);
  const ped = (F, x, y, z, hw = 1.25, hh = 0.95) => slab(F, [[x - hw, y], [x + hw, y], [x, y + hh]], z, z + 0.28, '#c3ae84');
  for (const x of FEAX) { ped(W.M, x * k, 12.28, 0); ped(W.M, W.L - x * k, 12.28, 0); }
  // the north face: the pavilion's bay carried along it from the corner
  const nb = Math.floor((N.L - 1.15) / FEBAY), x0n = N.L - 1.15 - nb * FEBAY;
  front('r2p1Fe', uv, N.M, -0.03, x0n, 0, FEH, 0.03, 0, 1.15);
  for (let i = 0; i < nb; i++) { const x = x0n + i * FEBAY; front('r2p1Fe', uv, N.M, x, x + FEBAY, 0, FEH, 0.03, 5.5, 5.5 + FEBAY); ped(N.M, x + 2.2, 12.28, 0); }
  front('r2p1Fe', uv, N.M, N.L - 1.15, N.L + 0.03, 0, FEH, 0.03, 0, 1.15);
  // south and east, plain
  for (const F of [S, E]) { const n = Math.max(1, Math.round(F.L / FEBAY)), bw = F.L / n; for (let i = 0; i < n; i++) front('r2p1Fe', uvp, F.M, i * bw - (i ? 0 : 0.03), (i + 1) * bw + (i < n - 1 ? 0 : 0.03), 0, FEH, 0.03, 0, FEBAY); fb(F.M, -0.1, F.L + 0.1, 22.15, FEH + 0.1, -0.2, 0.6, '#d8cbac'); fb(F.M, 0, F.L, 8.0, 8.42, 0, 0.22, FETRIM); }
  // the portal: archivolts and piers, the balcony on corbels, globe lamps, flags, pediments, the emblem
  for (const [x, r0, r1, yc] of [[cx, 1.5, 2.0, 5.05], [cx - 4.2, 1.15, 1.55, 5.8], [cx + 4.2, 1.15, 1.55, 5.8]]) {
    const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, PI, false); s.absarc(0, 0, r0, PI, 0, true); s.closePath();
    extrude('flat', s, 0.24, { M: W.M, p: [x, yc, Z], c: '#b4aa98', cs: 6, noao: true });
  }
  for (const dx of [-6.3, -2.1, 2.1, 6.3]) { fb(W.M, cx + dx - 0.3, cx + dx + 0.3, 0, 6.4, Z, Z + 0.28, '#968e7f'); wedge(W.M, cx + dx, 6.4, 0.5, 1.25, 1.0, '#a79e8d', Z + 0.05); }
  const bz = Z + 1.15;
  fb(W.M, c0 + 0.35, c1 - 0.35, 7.65, 8.0, Z, bz, '#a89f8e'); fb(W.M, c0 + 0.35, c1 - 0.35, 8.75, 8.93, bz - 0.22, bz, '#aea593');
  for (let x = c0 + 0.6; x < c1 - 0.5; x += 0.55) fb(W.M, x - 0.11, x + 0.11, 8.0, 8.75, bz - 0.2, bz - 0.04, '#9b9283');
  for (const dx of [-6.3, -2.1, 2.1, 6.3]) { fb(W.M, cx + dx - 0.22, cx + dx + 0.22, 8.0, 9.35, bz - 0.34, bz + 0.04, '#b3aa98'); sphere('flat', 0.36, { M: W.M, p: [cx + dx, 9.68, bz - 0.15], c: '#59606a', seg: 7, noao: true }); }
  for (const [dx, cols] of [[-1.5, ['#2f8a4a', '#eeeae0', '#c4392f']], [0, ['#2c4f9a', '#2c4f9a', '#2c4f9a']], [1.5, ['#d9a62e', '#d9a62e', '#b8332a']]]) {
    box('flat', 0.07, 0.07, 2.6, { M: W.M, p: [cx + dx, 10.2, Z + 1.35], rx: -0.62, c: '#4c463c', noao: true });
    cols.forEach((c, i) => fb(W.M, cx + dx - 0.02, cx + dx + 0.02, 9.9 - 0.12 * i, 10.95 - 0.12 * i, Z + 1.3 + i * 0.42, Z + 1.72 + i * 0.42, c));
  }
  FECX.forEach((x, i) => { if (i === 1) { const s = new THREE.Shape(); s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.quadraticCurveTo(0, 1.7, -1.2, 0); extrude('flat', s, 0.28, { M: W.M, p: [x * k, 12.0, Z], c: '#c3ae84', cs: 5, noao: true }); } else ped(W.M, x * k, 12.0, Z, 1.2); });
  fb(W.M, c0, c1, 20.65, 21.15, Z, Z + 0.35, FETRIM); fb(W.M, c0 + 0.9, c1 - 0.9, 23.98, 24.12, Z, Z + 0.18, FETRIM); fb(W.M, c0 + 0.9, c1 - 0.9, 25.35, 25.5, Z, Z + 0.2, FETRIM);
  for (const x of [c0 + 1.0, c1 - 1.0]) fb(W.M, x - 0.45, x + 0.45, 25.6, 26.5, Z - 0.3, Z + 0.05, '#cbbb99');
  slab(W.M, [[cx - 1.7, 25.7], [cx - 0.6, 25.55], [cx + 0.6, 25.55], [cx + 1.7, 25.7], [cx + 1.0, 26.2], [cx + 0.45, 26.15], [cx + 0.5, 26.75], [cx, 27.05], [cx - 0.5, 26.75], [cx - 0.45, 26.15], [cx - 1.0, 26.2]], Z - 0.05, Z + 0.22, '#4b545c');
  return solid(end('Palazzo delle Ferrovie'), FE.p, [FE.hole], y0 + FEH);
}

// =====================================================================================================
// Palazzo Utveggio
// =====================================================================================================
const UT = { id: 'w278476641', p: [-855, -1334.5, -848.7, -1322.4, -842.2, -1325.6, -843.9, -1329.5, -848.5, -1327.1, -852.7, -1335.7, -853, -1336.4, -849.7, -1338, -839.7, -1342.9, -829.3, -1321.1, -854.8, -1309, -864.7, -1329.8] };
const UTW = 24.2, UTH = 19.6, UTFL = [5.75, 9.9, 14.05], UTBAY = UTW / 5, UTC = [384, 312], UTR = [0, 0, 384, 312, UTW, UTH];
const UTCREAM = '#d5bd93', UTSTONE = '#948672', UTTRIM = '#cbb28a', UTIRON = '#34302e';
function utTex(g, w, h) {
  base(g, w, h, UTCREAM, 4200);
  const p = region(g, ...UTR), { R, curve, louvre, text, circ } = p;
  for (let y = 5.9; y < 18.0; y += 0.36) R(0, y, UTW, y + 0.03, 'rgba(100,75,45,0.2)');
  rocks(p, 0, UTW, 1.9, 5.45, 0.36, 1.3, ['#9a8b73', '#a89880', '#8e806b', '#948470'], '#5e5344', 4201);
  R(0, 0, UTW, 1.9, '#8f877a'); R(0, 1.72, UTW, 1.95, '#a9a091'); R(0, 0, UTW, 0.35, '#7a7268');
  for (let i = 0; i < 5; i++) {
    const x = UTBAY * (i + 0.5);
    if (i !== 2) {
      R(x - 1.0, 2.15, x + 1.0, 5.05, '#7d705e'); louvre(x - 0.8, 2.25, x + 0.8, 4.9, '#4c3b32'); R(x - 1.05, 2.0, x + 1.05, 2.2, '#a89a84');
      R(x - 0.75, 0.45, x + 0.75, 1.0, '#2f2a25'); for (let k = -0.65; k < 0.7; k += 0.26) R(x + k, 1.2, x + k + 0.09, 1.65, '#6c6357');
    }
    UTFL.forEach((f, j) => {
      const top = f + 3.05;
      R(x - 0.95, f, x + 0.95, top + 0.16, UTTRIM); R(x - 0.75, f, x + 0.75, top, '#211c19');
      if ((i + j * 2) % 5 === 3) { louvre(x - 1.2, f, x - 0.72, top, '#5d453f', false); louvre(x + 0.72, f, x + 1.2, top, '#5d453f', false); R(x - 0.04, f, x + 0.04, top, '#8f7d70'); } else louvre(x - 0.75, f, x + 0.75, top, j < 2 ? '#6e4c48' : '#5b463e');
      // the carved lintel and the little leaf panels beside the window
      R(x - 1.05, top + 0.28, x + 1.05, top + 0.45, '#b99f78'); R(x - 1.05, top + 0.2, x + 1.05, top + 0.28, 'rgba(70,50,28,0.4)');
      curve([[x - 1.15, top + 0.5], [x - 0.6, top + 0.55], [x - 0.35, top + 0.82], [x - 0.15, top + 0.95], [x, top + 0.68]], 0.09, '#a88e68');
      curve([[x + 1.15, top + 0.5], [x + 0.6, top + 0.55], [x + 0.35, top + 0.82], [x + 0.15, top + 0.95], [x, top + 0.68]], 0.09, '#a88e68');
      for (const s of [-1, 1]) { R(x + s * 1.42 - 0.3, f + 1.75, x + s * 1.42 + 0.3, f + 2.0, '#c2a880'); circ(x + s * 1.42, f + 1.87, 0.09, '#a58c66'); }
      R(x - 1.5, f - 0.5, x + 1.5, f - 0.05, 'rgba(70,50,28,0.25)');
    });
    for (const s of [-0.75, 0.75]) R(x + s - 0.13, 18.15, x + s + 0.13, 19.0, '#bea37a');
  }
  // frieze under the cornice, the string courses
  R(0, 18.2, UTW, 18.85, '#bfa57b'); for (let x = 0.3; x < UTW; x += 0.42) circ(x, 18.5, 0.1, '#d9c298');
  for (let i = 0; i <= 5; i++) { const x = Math.min(UTW - 0.32, Math.max(0.32, i * UTBAY)); R(x - 0.52, 5.7, x - 0.3, 19.0, 'rgba(70,48,24,0.3)'); R(x + 0.3, 5.7, x + 0.42, 19.0, 'rgba(255,245,220,0.35)'); }
  for (const y of [5.5, 17.95]) { R(0, y, UTW, y + 0.18, '#c4ab82'); R(0, y - 0.1, UTW, y, 'rgba(60,45,25,0.35)'); }
  R(0, 19.0, UTW, UTH, '#c6ad85'); R(0, 19.0, UTW, 19.12, 'rgba(60,45,25,0.45)');
  // the door with its stone surround and date
  const x = UTW / 2;
  R(x - 1.55, 0, x + 1.55, 5.45, '#9c9180'); R(x - 1.08, 0, x + 1.08, 4.55, '#17120f'); R(x + 0.22, 0.2, x + 1.0, 4.45, '#4a302a'); for (let y = 0.6; y < 4.2; y += 0.9) R(x + 0.36, y, x + 0.86, y + 0.6, '#5b3b32');
  R(x - 1.7, 4.65, x + 1.7, 5.3, '#a89d8a'); text('A.D. MDCCCCIII', x, 4.99, 0.48, 2.7, '#4a4033');
  wear(g, w, h, 4202, 60, 0.1);
}
function buildPalazzoUtveggio() {
  initShared();
  defMat('r2p1Ut', UTC[0], UTC[1], [UTW, UTH], utTex);
  const pts = pairsOf(UT.p), y0 = groundY(-833.6, -1332.8) - 0.05, lo = y0 - 1.0, uv = uvOf(...UTC, ...UTR);
  begin(y0);
  prism('flat', pts, y0 + UTH - 0.05, y0 + UTH + 0.12, { c: '#a08474', noao: true });
  plainWalls(pts, y0, lo, UTH, '#c6ae86', [8, 9]);
  const E = face(pts, pts[8], pts[9], y0), S = face(pts, pts[9], pts[10], y0);
  for (const F of [E, S]) wall(F.M, 0, F.L, lo - y0, 0, 0.02, '#7d756a');
  const dress = (F, bays, nCons) => {
    const bw = F.L / bays.length;
    bays.forEach((b, i) => {
      const x = (i + 0.5) * bw;
      front('r2p1Ut', uv, F.M, i * bw - (i ? 0 : 0.03), (i + 1) * bw + (i < bays.length - 1 ? 0 : 0.03), 0, UTH, 0.03, b * UTBAY, (b + 1) * UTBAY);
      for (const f of UTFL) ironBalcony(F.M, x, f, 2.7, 0.85, '#a8987c', { br: nCons, bh: 0.65, bc: '#a38f70' });
      for (const s of [-0.75, 0.75]) wedge(F.M, x + s, 18.2, 0.24, 0.8, 0.4, '#c8ae84');
      if (b !== 2) fb(F.M, i * bw, (i + 1) * bw, -0.3, 0.38, 0, 0.14, '#80786c'); else { fb(F.M, i * bw, x - 1.6, -0.3, 0.38, 0, 0.14, '#80786c'); fb(F.M, x + 1.6, (i + 1) * bw, -0.3, 0.38, 0, 0.14, '#80786c'); }
    });
    fb(F.M, 0, F.L, 5.45, 5.68, 0, 0.16, '#b7a285'); fb(F.M, 0, F.L, 1.75, 1.95, 0, 0.12, '#a89e8e');
    fb(F.M, 0, F.L, 19.05, 19.4, 0, 0.24, '#c9b088'); fb(F.M, 0, F.L, 19.4, UTH + 0.15, -0.3, 0.46, '#bca37c');
    // the pilasters, rising past the cornice as capped blocks
    for (let i = 0; i <= bays.length; i++) { const x = Math.min(F.L - 0.32, Math.max(0.32, i * bw)); fb(F.M, x - 0.3, x + 0.3, 5.68, UTH + 0.75, -0.05, 0.19, '#e0cba2'); fb(F.M, x - 0.4, x + 0.4, UTH + 0.75, UTH + 1.0, -0.3, 0.5, '#c4aa81'); fb(F.M, x - 0.34, x + 0.34, UTH + 0.15, UTH + 0.55, 0.19, 0.3, '#b69d75'); }
  };
  dress(E, [0, 1, 2, 3, 4], [-1, -0.35, 0.35, 1]);
  dress(S, [0, 1, 3, 4, 0, 1], [-1, 1]);
  const x = E.L / 2;
  for (const s of [-1, 1]) fb(E.M, x + s * 1.32 - 0.24, x + s * 1.32 + 0.24, -0.1, 4.65, 0, 0.17, '#9d9281');
  fb(E.M, x - 1.75, x + 1.75, 5.32, 5.5, 0, 0.22, '#aca18d');
  return solid(end('Palazzo Utveggio'), UT.p, null, y0 + UTH);
}

// =====================================================================================================
// Palazzo Dato
// =====================================================================================================
const DA = { id: 'w237087193', p: [-715.5, -1066.0, -700.3, -1073.3, -692.7, -1057.7, -707.8, -1050.4] };
const DAW = 16.9, DAH = 20.0, DADW = 5.6, DAAX = [3.05, 8.45, 13.85], DAC = [432, 384], DAR = [0, 2, 320, 380, DAW, DAH], DAD = [326, 2, 106, 380, DADW, DAH];
const DARED = '#b24a3b', DAOCH = '#d9a655', DALIT = '#e8c37c', DASTONE = '#c9bca2', DAGREEN = '#27463d', DATEAL = '#35605f';
// the whiplash ornament and the windows of one bay at x; foot: 'win' or 'door'
function daBay(p, x, foot) {
  const { R, arch, blob, curve, louvre, circ, text, poly } = p;
  if (foot === 'win') {
    blob([[x - 1.25, 3.2], [x - 0.95, 4.5], [x - 0.5, 4.7], [x - 0.1, 4.9], [x, 5.75], [x + 0.1, 4.9], [x + 0.5, 4.7], [x + 0.95, 4.5], [x + 1.25, 3.2], [x, 4.0], [x - 1.25, 3.2]], DAOCH);
    R(x - 0.95, 1.95, x + 0.95, 4.35, DAOCH); R(x - 0.75, 2.1, x + 0.75, 4.2, '#d8d6cc'); R(x - 0.66, 2.2, x + 0.66, 4.1, '#304340'); R(x - 0.04, 2.2, x + 0.04, 4.1, '#d8d6cc'); louvre(x - 1.3, 2.1, x - 0.78, 4.2, DAGREEN, false); louvre(x + 0.78, 2.1, x + 1.3, 4.2, DAGREEN, false);
  } else {
    blob([[x - 2.2, 0], [x - 2.05, 4.6], [x - 1.2, 5.5], [x - 0.5, 6.1], [x, 6.2], [x + 0.5, 6.1], [x + 1.2, 5.5], [x + 2.05, 4.6], [x + 2.2, 0]], DASTONE);
    R(x - 1.55, 0, x + 1.55, 4.75, '#dec894'); R(x - 1.75, 4.65, x + 1.75, 4.95, '#e6d3a4'); R(x - 1.15, 0, x + 1.15, 4.0, '#c8ae74'); R(x - 0.95, 0, x + 0.95, 3.85, DAGREEN);
    R(x - 0.03, 0, x + 0.03, 3.85, '#12221d'); for (const s of [-1, 1]) { R(x + s * 0.48 - 0.32, 1.9, x + s * 0.48 + 0.32, 3.55, '#141d1b'); for (let y = 2.1; y < 3.5; y += 0.32) R(x + s * 0.48 - 0.32, y, x + s * 0.48 + 0.32, y + 0.05, '#5f6a5c'); R(x + s * 0.48 - 0.32, 0.3, x + s * 0.48 + 0.32, 1.55, '#315348'); }
    poly([[x - 0.28, 4.6], [x + 0.28, 4.6], [x + 0.28, 4.3], [x, 4.08], [x - 0.28, 4.3]], '#e9dcb8'); circ(x - 1.9, 3.2, 0.22, '#f2efe4'); text('36', x - 1.9, 3.2, 0.26, 0.36, '#25324a');
  }
  // piano nobile: the tall ochre field with its curling crown, the round headed window
  blob([[x - 1.9, 6.6], [x - 1.45, 7.2], [x - 1.4, 9.2], [x - 1.8, 10.6], [x - 0.8, 10.9], [x - 0.15, 11.3], [x - 0.12, 12.55], [x, 12.6], [x + 0.12, 12.55], [x + 0.15, 11.3], [x + 0.8, 10.9], [x + 1.8, 10.6], [x + 1.4, 9.2], [x + 1.45, 7.2], [x + 1.9, 6.6]], DAOCH);
  for (const s of [-1, 1]) { curve([[x + s * 1.35, 10.1], [x + s * 1.2, 11.0], [x + s * 0.55, 10.75], [x + s * 0.1, 10.55], [x + s * 0.2, 11.5]], 0.12, DALIT); curve([[x + s * 1.6, 10.55], [x + s * 0.75, 11.25], [x + s * 0.3, 12.1]], 0.09, '#b8863f'); circ(x + s * 0.5, 11.1, 0.13, '#a97b3a'); circ(x + s * 0.5, 11.1, 0.06, DALIT); }
  arch(x, 6.6, 10.3, 1.95, DALIT); arch(x, 6.6, 10.15, 1.65, DATEAL); arch(x, 6.6, 9.95, 1.38, '#cfd0c6'); R(x - 0.7, 9.2, x + 0.7, 9.3, DATEAL); for (let k = -0.45; k < 0.5; k += 0.45) R(x + k - 0.025, 9.3, x + k + 0.025, 9.9, DATEAL);
  for (const s of [-1, 1]) { R(x + s * 0.35 - 0.26, 7.9, x + s * 0.35 + 0.26, 9.1, '#415a60'); R(x + s * 0.35 - 0.26, 6.7, x + s * 0.35 + 0.26, 7.75, '#b9bcae'); }
  R(x - 0.04, 6.6, x + 0.04, 9.2, '#e8e6da');
  // the two upper windows with their crowns
  for (const [f, top, hw] of [[12.75, 15.35, 0.72], [16.4, 18.6, 0.66]]) {
    blob([[x - hw - 0.35, f], [x - hw - 0.1, top - 0.6], [x - hw - 0.55, top + 0.15], [x - 0.3, top + 0.15], [x, top + 0.75], [x + 0.3, top + 0.15], [x + hw + 0.55, top + 0.15], [x + hw + 0.1, top - 0.6], [x + hw + 0.35, f]], DAOCH);
    R(x - hw - 0.08, f, x + hw + 0.08, top + 0.08, DALIT); louvre(x - hw, f, x + hw, top, DATEAL);
    curve([[x - hw - 0.2, top + 0.12], [x - 0.35, top + 0.5], [x, top + 0.28], [x + 0.35, top + 0.5], [x + hw + 0.2, top + 0.12]], 0.09, '#b8863f');
  }
  R(x - 1.3, 5.75, x + 1.3, 6.2, 'rgba(60,25,15,0.18)');
}
// the walls between the bays: base, the ochre bands that wave between the floors, the carved course, the cornice
function daWalls(p, x0, x1, ax) {
  const { R, curve, circ } = p;
  for (const [y, a] of [[11.85, 0.45], [15.75, 0.35], [18.95, 0.2]]) { curve([[x0, y], [(x0 + x1) / 2, y], [x1, y]], 0.14, DAOCH); for (const x of ax) { curve([[x - 2.7, y], [x - 2.0, y - a * 0.3], [x - 1.55, y - a], [x - 1.1, y - a * 1.8], [x - 0.9, y - 0.1]], 0.2, DAOCH); curve([[x + 2.7, y], [x + 2.0, y - a * 0.3], [x + 1.55, y - a], [x + 1.1, y - a * 1.8], [x + 0.9, y - 0.1]], 0.2, DAOCH); } }
  rocks(p, x0, x1, 0, 1.75, 0.55, 0.8, ['#93877a', '#a09384', '#857a6e'], '#5d5449', 4301); R(x0, 1.75, x1, 1.95, DASTONE);
  R(x0, 5.85, x1, 6.55, DASTONE); R(x0, 5.75, x1, 5.87, 'rgba(60,30,15,0.4)'); for (let x = x0 + 0.25; x < x1; x += 0.62) { circ(x, 6.2, 0.16, '#a89a80'); R(x - 0.03, 5.9, x + 0.03, 6.5, '#e3d8c0'); }
  R(x0, 19.15, x1, DAH, DAOCH); for (let x = x0 + 0.1; x < x1; x += 0.52) { R(x, 19.2, x + 0.22, 19.72, '#9a7038'); R(x + 0.22, 19.2, x + 0.3, 19.72, DALIT); } R(x0, 19.76, x1, DAH, DALIT);
}
function daTex(g, w, h) {
  base(g, w, h, DARED, 4300, 0.1);
  const p = region(g, ...DAR);
  daWalls(p, 0, DAW, DAAX);
  for (const x of DAAX) daBay(p, x, 'win');
  for (const [x, s] of [[0, 1], [DAW, -1]]) { p.blob([[x, 1.9], [x + s * 1.1, 2.4], [x + s * 0.7, 6.0], [x + s * 0.5, 9.0], [x + s * 0.95, 11.3], [x + s * 0.35, 12.0], [x + s * 0.85, 14.0], [x + s * 0.4, 16.0], [x + s * 1.0, 18.4], [x + s * 0.5, 19.2], [x, 19.2]], DAOCH); p.curve([[x + s * 0.4, 6.8], [x + s * 0.15, 9.0], [x + s * 0.55, 10.8]], 0.12, DALIT); }
  const q = region(g, ...DAD);
  daWalls(q, 0, DADW, [DADW / 2]); daBay(q, DADW / 2, 'door');
  wear(g, w, h, 4302, 45, 0.07);
}
function buildDato() {
  initShared();
  defMat('r2p1Da', DAC[0], DAC[1], [DAW, DAH], daTex);
  const pts = pairsOf(DA.p), y0 = groundY(-699.9, -1074.2) - 0.05, lo = y0 - 1.0, uv = uvOf(...DAC, ...DAR), uvd = uvOf(...DAC, ...DAD);
  begin(y0);
  prism('flat', pts, y0 + DAH - 0.05, y0 + DAH + 0.12, { c: '#a8705c', noao: true });
  plainWalls(pts, y0, lo, DAH, '#a4503f', [0, 1]);
  const G = face(pts, pts[0], pts[1], y0), X = face(pts, pts[1], pts[2], y0), kg = G.L / DAW;
  for (const F of [G, X]) wall(F.M, 0, F.L, lo - y0, 0, 0.02, '#776d62');
  front('r2p1Da', uv, G.M, -0.03, G.L + 0.03, 0, DAH, 0.03, 0, DAW);
  const dx0 = X.L / 2 - DADW / 2, dx1 = X.L / 2 + DADW / 2;
  front('r2p1Da', uv, X.M, 0, dx0, 0, DAH, 0.03, 0, 5.65);
  front('r2p1Da', uvd, X.M, dx0, dx1, 0, DAH, 0.03, 0, DADW);
  front('r2p1Da', uv, X.M, dx1, X.L + 0.03, 0, DAH, 0.03, DAW - 5.65, DAW);
  const IRON = '#2b2725';
  for (const [F, ax, door] of [[G, DAAX.map(a => a * kg), -1], [X, [DAAX[0] / 5.65 * dx0, X.L / 2, dx1 + (DAAX[2] - (DAW - 5.65)) / 5.65 * (X.L - dx1)], 1]]) {
    ax.forEach((x, i) => {
      // the stone balcony of the piano nobile on its curved corbels
      const w = 3.5, d = 0.95, y = 6.65;
      fb(F.M, x - w / 2, x + w / 2, y - 0.24, y, 0, d, '#d2c6ac');
      for (const s of [-1, -0.34, 0.34, 1]) extrude('flat', shapeOf([[0, 0], [0.2, 0.1], [0.34, 0.5], [d * 0.85, 0.72], [d * 0.85, 0.9], [0, 0.9]]), 0.2, { M: F.M, p: [x + s * (w / 2 - 0.25) + 0.1, y - 1.14, 0], ry: -PI / 2, c: '#c6b99e', noao: true });
      for (const s of [-1, -0.34, 0.34, 1]) fb(F.M, x + s * (w / 2 - 0.1) - 0.1, x + s * (w / 2 - 0.1) + 0.1, y, y + 0.95, d - 0.2, d, '#d4c8ae');
      fb(F.M, x - w / 2, x + w / 2, y + 0.95, y + 1.1, d - 0.22, d + 0.02, '#ddd2ba');
      for (const s of [-1, 1]) { fb(F.M, x + s * (w / 2 - 0.1) - 0.1, x + s * (w / 2 - 0.1) + 0.1, y + 0.95, y + 1.1, 0, d - 0.22, '#ddd2ba'); panel('rail', d - 0.2, 0.95, { M: F.M, p: [x + s * (w / 2 - 0.1), y, (d - 0.2) / 2], ry: s * PI / 2, uvk: [(d - 0.2) / 0.9, 1] }); }
      panel('rail', w - 0.2, 0.95, { M: F.M, p: [x, y, d - 0.1], uvk: [(w - 0.2) / 0.9, 1] });
      ironBalcony(F.M, x, 12.75, 2.9, 0.85, '#5c5048', { bh: 0.6, bc: IRON }); ironBalcony(F.M, x, 16.4, 2.5, 0.75, '#5c5048', { bh: 0.5, bc: IRON });
    });
    // the carved course (broken at the door), the cornice on its brackets, the drain pipes
    fb(F.M, 0, F.L, 5.95, 6.4, 0, 0.17, '#cbbd9f');
    fb(F.M, -0.05, F.L + 0.05, 19.68, 19.86, 0, 0.55, '#d3a456'); fb(F.M, -0.05, F.L + 0.05, 19.86, DAH + 0.18, -0.25, 0.68, '#c49048');
    for (let x = 0.25; x < F.L - 0.2; x += 0.9) wedge(F.M, x, 19.05, 0.22, 0.64, 0.46, '#caa05c');
    for (const x of [(ax[0] + ax[1]) / 2, (ax[1] + ax[2]) / 2]) fb(F.M, x - 0.07, x + 0.07, 0.1, 19.1, 0.02, 0.15, '#6c3d30');
    // the stone foot, open at the door
    if (door < 0) fb(F.M, 0, F.L, -0.3, 0.5, 0, 0.13, '#7e7368'); else { fb(F.M, 0, F.L / 2 - 2.2, -0.3, 0.5, 0, 0.13, '#7e7368'); fb(F.M, F.L / 2 + 2.2, F.L, -0.3, 0.5, 0, 0.13, '#7e7368'); for (const s of [-1, 1]) fb(F.M, F.L / 2 + s * 1.4 - 0.2, F.L / 2 + s * 1.4 + 0.2, -0.1, 4.7, 0, 0.14, '#ddc894'); fb(F.M, F.L / 2 - 1.75, F.L / 2 + 1.75, 4.68, 4.95, 0, 0.25, '#e4d2a4'); }
  }
  // the corner: an ochre pier on both sides with its knots at the floors
  for (const [F, x] of [[G, 0], [X, X.L]]) { const s = x ? -1 : 1; fb(F.M, x, x + s * 0.55, 1.95, 19.1, -0.05, 0.14, '#d6a458'); for (const y of [5.7, 11.5, 15.5, 18.6]) wedge(F.M, x + s * 0.3, y, 0.46, 0.75, 0.34, '#e0b66c'); }
  return solid(end('Palazzo Dato'), DA.p, null, y0 + DAH);
}

// =====================================================================================================
// Palazzo Ziino
// =====================================================================================================
const ZI = { id: 'w204463217', p: [-851.4, -919.5, -862.2, -943.4, -847.4, -948.0, -844.8, -938.7, -839.1, -940.4, -844.5, -958.4, -836.8, -960.7, -827.8, -926.8, -837.3, -924.0] };
const ZIW = 24.7, ZIH = 20.9, ZIAX = [2.9, 7.9, 12.35, 16.8, 21.8], ZICOL = [5.6, 10.1, 14.6, 19.05], ZISW = 5.24;
const ZIC = [480, 352], ZIR = [0, 36, 384, 316, ZIW, ZIH], ZIS = [388, 36, 80, 316, ZISW, ZIH], ZIF = [470, 36, 10, 316, 1, 7];
const ZICREAM = '#e4cd96', ZITRIM = '#efdcae', ZIBRN = '#795538', ZIWHITE = '#e6e0cf';
function ziWin(p, x, y0, y1, w, open) {
  const { R, louvre } = p;
  R(x - w / 2 - 0.22, y0, x + w / 2 + 0.22, y1 + 0.24, ZITRIM); R(x - w / 2 - 0.32, y1 + 0.24, x + w / 2 + 0.32, y1 + 0.42, '#d4bb84'); R(x - w / 2 - 0.32, y1 + 0.16, x + w / 2 + 0.32, y1 + 0.24, 'rgba(90,60,25,0.4)');
  if (open) { R(x - w / 2, y0, x + w / 2, y1, '#6f8290'); R(x - 0.04, y0, x + 0.04, y1, '#eee9da'); R(x - w / 2, y0 + (y1 - y0) * 0.62, x + w / 2, y0 + (y1 - y0) * 0.62 + 0.07, '#eee9da'); louvre(x - w / 2 - 0.42, y0, x - w / 2, y1, ZIBRN, false); louvre(x + w / 2, y0, x + w / 2 + 0.42, y1, ZIBRN, false); } else louvre(x - w / 2, y0, x + w / 2, y1, ZIBRN);
}
function ziWalls(p, x0, x1) {
  const { R } = p;
  R(x0, 0.8, x1, 6.25, '#d6bd87'); for (let y = 0.8, j = 0; y < 6.1; y += 0.5, j++) { R(x0, y, x1, y + 0.07, 'rgba(90,62,30,0.38)'); for (let x = x0 + (j % 2) * 0.55; x < x1; x += 1.1) R(x, y, x + 0.06, y + 0.5, 'rgba(90,62,30,0.25)'); }
  R(x0, 0, x1, 0.8, '#a69a82'); R(x0, 6.15, x1, 6.35, ZITRIM);
  for (const y of [11.75, 15.9]) { R(x0, y, x1, y + 0.2, ZITRIM); R(x0, y - 0.08, x1, y, 'rgba(90,60,25,0.3)'); }
  R(x0, 19.15, x1, 19.4, '#d9c18a'); R(x0, 19.4, x1, 19.9, ZITRIM); for (let x = x0 + 0.1; x < x1; x += 0.34) R(x, 19.9, x + 0.18, 20.25, '#a88f5c'); R(x0, 20.25, x1, ZIH, ZITRIM);
}
function ziGround(p, x) {
  const { R, arch, louvre } = p;
  arch(x, 2.35, 5.1, 2.35, '#c8ad76'); arch(x, 2.3, 4.7, 1.75, '#4a3322'); arch(x, 2.4, 4.55, 1.45, '#6b7a80'); R(x - 0.05, 2.4, x + 0.05, 4.5, '#4a3322'); R(x - 0.72, 3.75, x + 0.72, 3.84, '#4a3322'); louvre(x - 1.2, 2.35, x - 0.8, 4.0, ZIBRN, false); louvre(x + 0.8, 2.35, x + 1.2, 4.0, ZIBRN, false);
  R(x - 1.0, 1.1, x + 1.0, 2.3, ZIWHITE); for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const u = x - 1.0 + i * 0.4 + (j % 2) * 0.2, v = 1.25 + j * 0.3; if (u > x + 0.9) continue; p.poly([[u + 0.03, v], [u + 0.2, v + 0.15], [u + 0.37, v], [u + 0.2, v - 0.15]], '#4d4436'); }
  R(x - 1.1, 2.25, x + 1.1, 2.4, ZITRIM); R(x - 1.1, 1.0, x + 1.1, 1.12, ZITRIM);
}
function ziTex(g, w, h) {
  base(g, w, h, ZICREAM, 4400, 0.06);
  // the strip of stone balusters, the balconies' fronts
  g.fillStyle = '#8f8772'; g.fillRect(0, 0, w, 34); g.fillStyle = ZIWHITE; g.fillRect(0, 0, w, 6); g.fillRect(0, 28, w, 6);
  for (let x = 3; x < w; x += 11) { g.fillStyle = ZIWHITE; g.fillRect(x + 2, 5, 4, 24); g.fillRect(x, 15, 8, 8); g.fillRect(x + 1, 9, 6, 3); g.fillStyle = 'rgba(60,50,30,0.25)'; g.fillRect(x + 6, 5, 2, 24); }
  const p = region(g, ...ZIR), { R, arch, circ, text, line, poly } = p;
  ziWalls(p, 0, ZIW);
  for (const x0 of [0, ZIW - 1.25]) for (let y = 6.4, j = 0; y < 19.1; y += 0.42, j++) { R(x0, y, x0 + 1.25, y + 0.34, j % 2 ? '#ecd8a6' : '#e8d29c'); R(x0, y + 0.34, x0 + 1.25, y + 0.42, 'rgba(90,60,25,0.35)'); }
  ZIAX.forEach((x, i) => {
    if (i !== 2) ziGround(p, x);
    ziWin(p, x, 6.8, 9.7, 1.4, false);
    R(x - 1.05, 10.1, x + 1.05, 10.35, ZITRIM); if (i === 0 || i === 4) poly([[x - 1.15, 10.35], [x + 1.15, 10.35], [x, 11.15]], '#d9c08a'); else p.blob([[x - 1.15, 10.35], [x, 11.75], [x + 1.15, 10.35]], '#d9c08a');
    ziWin(p, x, 12.2, 14.7, 1.35, i === 2 || i === 3);
    ziWin(p, x, 16.3, 18.45, 1.25, i === 3);
    for (const y of [11.85, 15.95]) R(x - 1.35, y - 0.55, x + 1.35, y - 0.1, 'rgba(90,60,25,0.22)');
  });
  for (const x of ZICOL) { R(x - 0.55, 6.35, x + 0.55, 19.15, 'rgba(255,245,210,0.18)'); R(x + 0.42, 6.35, x + 0.55, 19.15, 'rgba(90,60,25,0.22)'); }
  // the door and the two banners
  const cx = ZIAX[2];
  arch(cx, 0, 5.75, 3.9, '#cdb27a'); arch(cx, 0, 5.2, 2.85, '#3d2417'); for (let i = 1; i < 10; i++) { const a = i / 10 * PI; line([[cx, 3.8], [cx + Math.cos(a) * 1.32, 3.8 + Math.sin(a) * 1.32]], 0.07, '#6a442c'); } R(cx - 1.42, 3.65, cx + 1.42, 3.82, '#2a180e');
  R(cx - 0.04, 0, cx + 0.04, 3.65, '#1d1008'); for (const s of [-1, 1]) { R(cx + s * 0.68 - 0.5, 1.2, cx + s * 0.68 + 0.5, 3.45, '#241c18'); R(cx + s * 0.68 - 0.06, 1.2, cx + s * 0.68 + 0.06, 3.45, '#5a3a26'); R(cx + s * 0.68 - 0.5, 0.2, cx + s * 0.68 + 0.5, 0.95, '#52341f'); }
  circ(cx, 5.65, 0.32, '#bba26c');
  for (const [x, t] of [[cx - 2.4, 'Palazzo Ziino'], [cx + 2.4, 'Arte e Cultura']]) { R(x - 0.42, 1.35, x + 0.42, 5.2, '#f4f1e8'); text(t, x, 3.28, 0.52, 3.5, '#28324a', -PI / 2); }
  // the side on Via De Spuches: one bay
  const q = region(g, ...ZIS), c = ZISW / 2;
  ziWalls(q, 0, ZISW); ziGround(q, c);
  ziWin(q, c, 6.8, 9.7, 1.4, false); q.R(c - 1.2, 10.15, c + 1.2, 10.5, '#d9c08a'); ziWin(q, c, 12.2, 14.7, 1.35, false); ziWin(q, c, 16.3, 18.45, 1.25, false);
  // flutes for the columns
  const f = region(g, ...ZIF); f.R(0, 0, 1, 7, '#ecd9a8'); f.R(0.08, 0, 0.42, 7, '#bfa36c'); f.R(0.42, 0, 0.62, 7, '#d9c18c'); f.R(0.82, 0, 1, 7, '#f6e6bc');
  wear(g, w, h, 4402, 40, 0.07);
}
function buildZiino() {
  initShared();
  defMat('r2p1Zi', ZIC[0], ZIC[1], [ZIW, ZIH], ziTex);
  const pts = pairsOf(ZI.p), y0 = groundY(-839.5, -922.2), lo = y0 - 1.0, uv = uvOf(...ZIC, ...ZIR), uvs = uvOf(...ZIC, ...ZIS);
  begin(y0);
  prism('flat', pts, y0 + ZIH - 0.05, y0 + ZIH + 0.12, { c: '#b9825f', noao: true });
  plainWalls(pts, y0, lo, ZIH, '#d2bb88', [0, 7, 8]);
  const F = face(pts, pts[0], pts[7], y0), W = face(pts, pts[0], pts[1], y0), k = F.L / ZIW, M = F.M, Z = 0.16;   // (the front is two nearly straight edges: one plane, a hand's breadth out)
  for (const [A, z] of [[M, Z], [W.M, 0.02]]) wall(A, 0, A === M ? F.L : W.L, lo - y0, 0.05, z, '#948a74');
  front('r2p1Zi', uv, M, -0.03, F.L, 0, ZIH, Z, 0, ZIW);
  for (const [x, s] of [[-0.03, -1], [F.L, 1]]) panel('flat', Z, ZIH, { M, p: [x, 0, Z / 2], ry: s * PI / 2, c: '#d8c18c' });
  // stone balconies: slab, corbels, the painted balusters on three sides, posts at the corners
  const stoneBalc = (x0, x1, y, d, nc, th = 0.28) => {
    fb(M, x0, x1, y - th, y, Z, Z + d, '#d9c595');
    for (let i = 0; i < nc; i++) wedge(M, x0 + 0.3 + i * (x1 - x0 - 0.6) / (nc - 1), y - th - 0.6, 0.24, 0.6, d * 0.9, '#c9b280', Z);
    const bal = (l, o) => panel('r2p1Zi', l, 1.02, { M, ...o, uvk: [l / 15, 33 / ZIC[1]], uvo: [0, 1 - 33.5 / ZIC[1]] });
    bal(x1 - x0, { p: [(x0 + x1) / 2, y, Z + d - 0.05] });
    for (const [x, s] of [[x0 + 0.03, -1], [x1 - 0.03, 1]]) bal(d - 0.05, { p: [x, y, Z + (d - 0.05) / 2], ry: s * PI / 2 });
    fb(M, x0, x1, y + 1.0, y + 1.1, Z + d - 0.14, Z + d, ZIWHITE);
    for (const x of [x0 + 0.1, x1 - 0.1]) fb(M, x - 0.1, x + 0.1, y, y + 1.04, Z + d - 0.2, Z + d, ZIWHITE);
  };
  stoneBalc(5.4 * k, 19.3 * k, 6.8, 1.05, 6, 0.45);
  for (const i of [0, 4]) stoneBalc((ZIAX[i] - 1.3) * k, (ZIAX[i] + 1.3) * k, 6.8, 0.85, 2, 0.35);
  ZIAX.forEach((a, i) => {
    const x = a * k;
    stoneBalc(x - 1.2, x + 1.2, 12.2, 0.75, 2);
    ironBalcony(M, x, 16.3, 2.35, 0.7 + Z, '#d4be8c', { bh: 0.5, bc: '#c9b280' });
    if (i === 0 || i === 4) slab(M, [[x - 1.2, 10.35], [x + 1.2, 10.35], [x, 11.15]], Z - 0.02, Z + 0.28, '#c9a96c');
    else { const s = new THREE.Shape(); s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.quadraticCurveTo(0, 1.4, -1.2, 0); extrude('flat', s, 0.3, { M, p: [x, 10.35, Z - 0.02], c: '#c9a96c', cs: 5, noao: true }); }
    fb(M, x - 1.12, x + 1.12, 10.12, 10.36, Z, Z + 0.24, ZITRIM);
  });
  // the four fluted columns with their capitals, the pilaster blocks over them up through the cornice
  const U = uvOf(...ZIC, ...ZIF)(0, 1, 0, 7);
  for (const a of ZICOL) {
    const x = a * k, shaft = new THREE.CylinderGeometry(0.31, 0.39, 7.2, 10, 1, true).toNonIndexed(), su = shaft.attributes.uv; shaft.translate(0, 3.6, 0);
    for (let t = 0; t < su.count; t += 3) { const u0 = Math.floor(Math.min(su.getX(t), su.getX(t + 1), su.getX(t + 2)) * 10 + 0.001); for (let j = t; j < t + 3; j++) su.setX(j, su.getX(j) * 10 - u0); }
    part('r2p1Zi', shaft, { M, p: [x, 7.9, Z + 0.22], uv: 'keep', uvk: [U.uvk[0], U.uvk[1]], uvo: U.uvo, noao: true });
    fb(M, x - 0.5, x + 0.5, 7.85, 8.15, Z, Z + 0.66, '#dcc896');
    cyl('flat', 0.55, 0.33, 0.95, 8, { M, p: [x, 15.1, Z + 0.22], c: '#b99656', noao: true, open: true });
    fb(M, x - 0.36, x + 0.36, 15.03, 15.18, Z, Z + 0.6, '#c4a463');
    fb(M, x - 0.58, x + 0.58, 16.05, 16.3, Z, Z + 0.74, '#ead7a6');
    fb(M, x - 0.42, x + 0.42, 16.3, 19.4, Z, Z + 0.22, '#e6d19e');
    fb(M, x - 0.55, x + 0.55, 19.35, ZIH + 0.14, -0.2, Z + 0.85, '#e8d4a2');
  }
  const cornice = (A, L, z) => { fb(A, 0, L, 19.4, 19.9, 0, z + 0.2, ZITRIM); fb(A, -0.05, L + 0.05, 20.25, ZIH + 0.1, -0.2, z + 0.62, '#dfc890'); for (let x = 0.3; x < L - 0.2; x += 0.95) wedge(A, x, 19.8, 0.24, 0.46, 0.5, '#d9c18a', z); };
  cornice(M, F.L, Z); fb(M, 0, F.L, 6.12, 6.34, 0, Z + 0.12, ZITRIM); fb(M, 0, 10.5 * k, -0.3, 0.42, 0, Z + 0.1, '#a2967e'); fb(M, 14.2 * k, F.L, -0.3, 0.42, 0, Z + 0.1, '#a2967e');
  // Via De Spuches
  const n = 5, bw = W.L / n;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * bw; front('r2p1Zi', uvs, W.M, i * bw, (i + 1) * bw + (i < n - 1 ? 0 : 0.03), 0, ZIH, 0.03, 0, ZISW); for (const y of [6.8, 12.2, 16.3]) ironBalcony(W.M, x, y, 2.5, 0.75, '#c4ad7c', { bh: 0.5 }); }
  cornice(W.M, W.L, 0.03); fb(W.M, 0, W.L, 6.12, 6.34, 0, 0.14, ZITRIM); fb(W.M, 0, W.L, -0.4, 0.42, 0, 0.12, '#a2967e');
  return solid(end('Palazzo Ziino'), ZI.p, null, y0 + ZIH);
}

// =====================================================================================================
// Palazzo Branciforte
// =====================================================================================================
const BR = { id: 'w228199207', p: [64.8, -616.2, 87.1, -572.5, 133.8, -590.1, 115.1, -631.3] };
const BRW = 52.5, BRH = 16.0, BRC = [640, 200], BRR = [0, 2, 640, 196, BRW, BRH], BRP = 32.1;   // (x from the east end; the portal's axis)
const BRWHITE = '#efeade', BROCH = '#cb9a45', BRASH = '#b58c57', BRFOOT = '#a38661';
const BRWIN = [[18.1, 3.2], [24.1, 3.1], [32.0, 3.0], [39.0, 2.5], [43.0, 2.3], [46.7, 2.1]];   // upper windows: axis, width of the frame
function brTex(g, w, h) {
  base(g, w, h, BRWHITE, 4500, 0.03);
  const p = region(g, ...BRR), { R, arch, circ, line, text } = p, r = RNG(4501);
  // the rough foot, the ochre ashlar ground floor, the string course
  R(0, 2.5, BRW, 6.85, BRASH); for (let y = 2.5, j = 0; y < 6.7; y += 0.62, j++) { R(0, y, BRW, y + 0.07, 'rgba(80,52,22,0.45)'); for (let x = (j % 2) * 0.6 + r() * 0.3; x < BRW; x += 1.25) R(x, y, x + 0.08, y + 0.62, 'rgba(80,52,22,0.35)'); }
  rocks(p, 0, BRW, 0, 2.5, 0.55, 1.2, ['#a68a63', '#b49a70', '#97805c', '#ab8c5e'], '#6e5a3e', 4502);
  R(0, 6.8, BRW, 7.3, BROCH); R(0, 6.68, BRW, 6.8, 'rgba(70,45,15,0.4)'); R(0, 7.22, BRW, 7.3, '#e0b562');
  // the dentil cornice; ochre quoin at the west end
  R(0, 15.15, BRW, BRH, BROCH); for (let x = 0.1; x < BRW; x += 0.5) R(x, 15.28, x + 0.26, 15.6, '#e5bd6c'); R(0, 15.12, BRW, 15.24, 'rgba(70,45,15,0.45)'); R(BRW - 1.0, 7.3, BRW, 15.15, '#d2a24c');
  for (const [x, fw] of BRWIN) {
    R(x - fw / 2, x === 32.0 ? 7.85 : 7.55, x + fw / 2, 10.95, BROCH); const iw = fw * 0.62; R(x - iw / 2, 8.0, x + iw / 2, 10.45, '#2b2620');
    for (let k = x - iw / 2 + 0.2; k < x + iw / 2; k += 0.3) R(k, 8.0, k + 0.07, 10.45, '#6a604f'); for (let y = 8.25; y < 10.4; y += 0.32) R(x - iw / 2, y, x + iw / 2, y + 0.07, '#6a604f');
  }
  for (const [x, ww] of [[17.8, 2.1], [23.9, 2.1], [31.7, 1.9], [38.6, 1.6], [42.2, 1.5], [45.6, 1.4], [49.4, 1.3]]) { R(x - ww / 2, 13.35, x + ww / 2, 15.0, BROCH); R(x - ww * 0.27, 13.72, x + ww * 0.27, 14.65, x < 20 ? '#35302a' : BRWHITE); if (x < 20) for (let k = -0.4; k < 0.5; k += 0.26) R(x + k, 13.72, x + k + 0.06, 14.65, '#77705f'); }
  for (const [x, y] of [[28.1, 14.5], [28.1, 11.8], [39.9, 14.9], [40.5, 14.9]]) { R(x - 0.2, y - 0.2, x + 0.2, y + 0.2, '#2c2a28'); line([[x - 0.18, y - 0.18], [x + 0.18, y + 0.18]], 0.06, '#77736c'); line([[x - 0.18, y + 0.18], [x + 0.18, y - 0.18]], 0.06, '#77736c'); }
  for (const x of [42.6, 47.7]) { circ(x, 12.75, 0.55, '#cfc9bc'); circ(x, 12.75, 0.42, '#7f8588'); }
  // plaques with their lines of writing, and the name over the portal
  for (const x of [28.15, 35.75]) { R(x - 1.35, 8.55, x + 1.35, 10.05, '#a7a69f'); R(x - 1.17, 8.68, x + 1.17, 9.92, '#dcd8cc'); text('D . O . M', x, 9.76, 0.22, 1.4, '#4e4a42'); for (let y = 8.82; y < 9.55; y += 0.17) R(x - 1.0 + r() * 0.15, y, x + 1.0 - r() * 0.15, y + 0.06, 'rgba(60,55,48,0.6)'); }
  R(BRP - 1.45, 7.28, BRP + 1.45, 7.8, '#d9d6cb'); text('MONTE DI SANTA ROSALIA', BRP, 7.54, 0.36, 2.7, '#37332c');
  // ground floor windows under their flat arches
  for (const [x, ww, y0, y1] of [[18.0, 1.9, 2.6, 4.85], [24.2, 1.45, 2.75, 5.05], [39.4, 1.0, 3.35, 5.45], [43.3, 0.85, 3.35, 5.45], [46.9, 0.85, 3.35, 5.5], [50.4, 0.85, 3.35, 5.55]]) {
    for (let k = -2; k <= 2; k++) line([[x + k * ww * 0.22, y1], [x + k * ww * 0.34, y1 + 0.75]], 0.08, 'rgba(80,52,22,0.55)');
    R(x - ww / 2 - 0.12, y0 - 0.15, x + ww / 2 + 0.12, y1 + 0.08, '#8b6c43'); R(x - ww / 2, y0, x + ww / 2, y1, x < 20 ? '#59626a' : '#25221d'); if (x < 30) { for (let k = x - ww / 2 + 0.28; k < x + ww / 2; k += 0.34) R(k, y0, k + 0.07, y1, '#2c2a28'); for (let y = y0 + 0.3; y < y1; y += 0.34) R(x - ww / 2, y, x + ww / 2, y + 0.06, '#2c2a28'); }
  }
  // the portal: the passage seen through the gate, the grille in its arch
  R(BRP - 2.75, 0, BRP + 2.75, 6.8, BRASH); arch(BRP, 0, 6.85, 5.1, '#7d6a4d'); arch(BRP, 0, 6.15, 3.2, '#2a221a');
  R(BRP - 0.95, 0, BRP + 1.15, 3.35, '#c9b695'); arch(BRP + 0.1, 0, 3.9, 2.0, '#8f7c5e'); arch(BRP + 0.1, 0, 3.55, 1.55, '#e3d6ba'); R(BRP - 0.65, 0, BRP + 0.85, 0.7, '#8f8a80');
  for (const [x, y] of [[BRP - 0.8, 0.9], [BRP + 0.95, 1.0]]) { circ(x, y, 0.42, '#3f5a33'); R(x - 0.2, 0.15, x + 0.2, 0.65, '#33302a'); }
  for (let x = BRP - 1.45; x < BRP + 1.5; x += 0.36) R(x, 3.9, x + 0.08, Math.min(6.1, 4.55 + Math.sqrt(Math.max(0, 2.56 - (x - BRP) ** 2))), '#3d2f22'); for (let y = 4.2; y < 5.9; y += 0.36) R(BRP - 1.5, y, BRP + 1.5, y + 0.08, '#3d2f22'); R(BRP - 1.6, 3.78, BRP + 1.6, 3.98, '#2c2118');
  // the signs
  R(28.0, 1.75, 29.45, 3.85, '#b0211d'); text('Palazzo', 28.72, 3.5, 0.28, 1.2, '#f2e6dc'); text('Branciforte', 28.72, 3.18, 0.28, 1.25, '#f2e6dc'); for (let y = 2.0; y < 2.9; y += 0.18) R(28.2, y, 29.25, y + 0.05, 'rgba(242,230,220,0.7)');
  R(35.35, 2.65, 36.55, 3.3, '#4c2420'); text('Palazzo Branciforte', 35.95, 2.98, 0.2, 1.1, '#d9b9a8');
  wear(g, w, h, 4503, 26, 0.045);
}
function buildBranciforte() {
  initShared();
  defMat('r2p1Br', BRC[0], BRC[1], [BRW, BRH], brTex);
  const pts = pairsOf(BR.p), y0 = groundY(84.4, -623.0) - 0.15, lo = Math.min(...pts.map(q => groundY(q[0], q[1]))) - 0.8, uv = uvOf(...BRC, ...BRR);
  begin(y0);
  prism('flat', pts, y0 + BRH - 0.05, y0 + BRH + 0.12, { c: '#b08a6c', noao: true });
  const F = face(pts, pts[3], pts[0], y0), M = F.M, k = F.L / BRW;
  wall(M, 0, F.L, lo - y0, 0, 0.02, '#8d7454');
  front('r2p1Br', uv, M, 0, F.L, 0, BRH, 0.03, 0, BRW);
  // the three faces no photo shows: foot, ashlar colour, white wall, plain
  for (let i = 0; i < 3; i++) {
    const S = face(pts, pts[i], pts[i + 1], y0);
    wall(S.M, 0, S.L, lo - y0, 2.5, 0, BRFOOT); wall(S.M, 0, S.L, 2.5, 6.85, 0, '#b38b55'); wall(S.M, 0, S.L, 6.85, BRH, 0, '#ebe5d8');
    fb(S.M, 0, S.L, 6.82, 7.28, -0.05, 0.1, BROCH); fb(S.M, 0, S.L, 15.15, 15.55, -0.05, 0.16, BROCH); fb(S.M, -0.1, S.L + 0.1, 15.55, BRH + 0.12, -0.2, 0.34, '#d3a652');
  }
  fb(M, 0, F.L, 6.82, 7.26, 0, 0.18, BROCH);
  fb(M, 0, F.L, 15.15, 15.55, 0, 0.2, BROCH); fb(M, -0.05, F.L + 0.05, 15.62, BRH + 0.12, -0.2, 0.52, '#d3a652');
  for (let x = 0.2; x < F.L - 0.2; x += 0.75) wedge(M, x, 15.3, 0.3, 0.34, 0.42, '#e0b866');
  // window frames standing out
  for (const [a, fw] of BRWIN) { const x = a * k, iw = fw * 0.62; for (const s of [-1, 1]) fb(M, x + s * (fw + iw) / 4 - (fw - iw) / 4, x + s * (fw + iw) / 4 + (fw - iw) / 4, 8.0, 10.45, 0, 0.14, BROCH); fb(M, x - fw / 2, x + fw / 2, 10.45, 10.95, 0, 0.14, '#d3a24c'); fb(M, x - fw / 2, x + fw / 2, a === 32.0 ? 7.84 : 7.55, 8.0, 0, a === 32.0 ? 0.07 : 0.17, '#d3a24c'); }   // (over the portal the name plate sits under the sill)
  // the rusticated portal: nine voussoirs, the keystone, the diamond blocks of the jambs
  const P = BRP * k, yc = 4.55;
  for (let i = 0; i < 11; i++) { const a0 = i / 11 * PI + 0.02, a1 = (i + 1) / 11 * PI - 0.02, key = i === 5, r0 = key ? 1.45 : 1.62, r1 = key ? 2.4 : 2.28; slab(M, [[P + Math.cos(a0) * r0, yc + Math.sin(a0) * r0], [P + Math.cos(a0) * r1, yc + Math.sin(a0) * r1], [P + Math.cos(a1) * r1, yc + Math.sin(a1) * r1], [P + Math.cos(a1) * r0, yc + Math.sin(a1) * r0]], 0, i % 2 ? 0.17 : 0.24, i % 2 ? '#a78e69' : '#b29a74'); }
  for (const s of [-1, 1]) {
    const x = P + s * 2.05;
    for (let j = 0; j < 6; j++) { const yb = j * 0.74, ww = j % 2 ? 0.82 : 1.0; fb(M, x - ww / 2, x + ww / 2, yb + 0.02, yb + 0.7, 0, 0.15, j % 2 ? '#a08763' : '#ad9570'); if (j % 2 === 0) part('flat', new THREE.ConeGeometry(Math.SQRT1_2, 0.08, 4, 1, true).rotateY(PI / 4), { M, p: [x, yb + 0.36, 0.19], rx: PI / 2, s: [ww * 0.9, 1, 0.58], c: '#bba37c', noao: true }); }
    fb(M, x - 0.58, x + 0.58, 4.42, 4.72, 0, 0.22, '#b8a17b');
  }
  // lamps on their brackets, the arms, the drain pipes
  for (const a of [30.2, 34.4]) { const x = a * k; fb(M, x - 0.04, x + 0.04, 6.7, 6.78, 0, 0.62, '#26221e'); fb(M, x - 0.03, x + 0.03, 6.2, 6.7, 0.02, 0.08, '#26221e'); cyl('flat', 0.27, 0.16, 0.6, 6, { M, p: [x, 6.78, 0.6], c: '#4a4a46', noao: true }); cyl('flat', 0.02, 0.33, 0.24, 6, { M, p: [x, 7.38, 0.6], c: '#26221e', noao: true }); }
  const ax = 32.2 * k; slab(M, [[ax - 0.5, 12.65], [ax - 0.62, 12.15], [ax - 0.42, 11.55], [ax, 11.25], [ax + 0.42, 11.55], [ax + 0.62, 12.15], [ax + 0.5, 12.65], [ax, 12.5]], 0, 0.16, '#dcd5c4');
  slab(M, [[ax - 0.28, 12.35], [ax - 0.28, 11.8], [ax, 11.6], [ax + 0.28, 11.8], [ax + 0.28, 12.35]], 0.14, 0.24, '#c4bba6'); fb(M, ax - 0.3, ax + 0.3, 12.62, 12.95, 0, 0.2, '#d2cab6');
  for (const [a, top] of [[14.8, 15.15], [41.2, 14.9], [49.2, 14.8]]) fb(M, a * k - 0.08, a * k + 0.08, 7.3, top, 0.02, 0.18, '#35251c');
  return solid(end('Palazzo Branciforte'), BR.p, null, y0 + BRH);
}

export const R2_P1 = [
  { name: 'Palazzo delle Ferrovie', x: 459, z: 412, radius: 60, skipIds: [FE.id], build: buildFerrovie },
  { name: 'Palazzo Utveggio', x: -846, z: -1326, radius: 30, skipIds: [UT.id], build: buildPalazzoUtveggio },
  { name: 'Palazzo Dato', x: -704, z: -1062, radius: 25, skipIds: [DA.id], build: buildDato },
  { name: 'Palazzo Ziino', x: -844, z: -938, radius: 30, skipIds: [ZI.id], build: buildZiino },
  { name: 'Palazzo Branciforte', x: 99, z: -603, radius: 40, skipIds: [BR.id], build: buildBranciforte },
];
