// City landmarks, batch T: eight buildings that were drawn by the generic builder. Registered through BATCH_T in src/landmarks-city.js.
// Photos (Wikimedia Commons file names, Mapillary image numbers, news pages) were only looked at, nothing is copied. Plan shapes come from the footprints and from a look at the Regione Siciliana
// orthophoto (SITR, 2012-13). Heights and positions on the fronts of Via Roma, Palazzo d'Orleans and Palazzo delle Finanze were read by fitting the camera of a Mapillary frame to the footprint
// and intersecting its rays with the wall planes (about half a metre); elsewhere they are proportions read off the photos, so rougher. Nothing but what is named below is drawn outside a footprint;
// the pieces that stand outside one (fountain basins on Via Roma, the guard boxes, stone balls and fountains in front of Palazzo d'Orleans, the apses of San Giovanni) have their own wall segments.
// The footprint walls of the replaced buildings stay, so the arcade of the INA base cannot be driven under (as before).
//
// Ingresso monumentale di Via Roma (w279882278, w279883080), Piazza Giulio Cesare. Commons "Imbocco monumentale di Via Roma (Palermo) - panoramio", "Ingresso via Roma a Palermo", "Pal monumentali pzza
//  giulio cesare", "Piazza Giulio Cesare (Palermo) 14 07 2024 01, 02", "(Palermo) 20 06 2026 01"; Mapillary 303380911298935 (2018), 1014952072651194 (2021). Read: two mirrored blocks with
//  concave fronts to the square; grey stone ground storey with arched openings between engaged columns on pedestals and a mezzanine; stone balconies; two cream orders of paired pilasters with white capitals,
//  pedimented windows, cornices and a parapet with two statues; at each inner corner a turret with an open arch on every face and an eagle over it; a fountain with two basins under the turret; an archway on
//  the west block's wing. Not verified: the backs and the sides away from the square (given the same bays, without columns or balconies), the number of bays on each stretch, the exact place and size of the archway.
// Palazzo delle Finanze (r1291575.0), Corso Vittorio Emanuele and Via Cala. Commons "Palazzo finanze"; Mapillary 1816641641836918, 1177568649363484 (2018). Read: yellow rusticated ground storey, three cream
//  storeys with hooded windows and small windows under the cornice, string courses, corner pilasters with white reliefs; on the Corso the portico of five Doric columns with iron gates, the frieze with the name
//  and two lanterns; tiled hip roofs. Not verified: the south west and north west sides (same bays), the place of the portico along the front (taken as the middle), the courtyards.
// Palazzo d'Orleans (w1185594961), Piazza Indipendenza. Commons "Palazzo d'orleans palermo", "Palazzo d'Orleans 2022", "Palace d'Orleans"; Mapillary 458661431885093 (2018), 518917289108594,
//  933113044133160 (2021). Read: nine bays of eroded tufa with giant pilasters, balconies on three levels, the rusticated portal with two columns and the long balcony with
//  three flags, a narrow ochre bay, then the pink wing and a lower end block; two white guard boxes, stone balls on chains and two fountains in the strip in front. Not verified: the back and both ends (plain),
//  the lower end block beyond its height and arches, the planting. The modern office block to the west is another footprint and stays generic.
// San Giovanni dei Lebbrosi (w42414083), off Via Salvatore Cappello. Commons "Palermo SanGiovanniLebbrosi 009 6221, 0877, 0887", "Palermo-San-Giovanni-dei-lebbrosi-bjs2007-01, 02", "San Giovanni dei lebbrosi
//  (Palermo)-msu-0654, 0660, 0677", "(Palermo) 20 06 2026 01, 05". Read: the tower porch with its pointed arch, the lower block beside it, the belfry with stepped arches and a small red dome, the nave with
//  a clerestory and tiled roofs over lean-to aisles, lattice windows and a side door on the north, the square presbytery with the red dome on its drum, three apses. Not verified: the south flank (left plain),
//  the garden, its walls and gate (not drawn).
// San Ciro a Maredolce (w80840224), under Monte Grifone. Commons "Chiesa di san ciro", "San Ciro Palermo", "San Ciro (Palermo) 22 10 2023 01", "01 09 2024 01"; Mapillary 183183767020202 (2021).
//  Read: the weathered front with rough stone on its west third, the door with its curved pediment, small windows, the cornice, the upper bay with the three part half round window, volutes, pediment, urns and
//  cross; pink drums with tiled caps on the flanks, the tiled nave roof, the apse. Not verified: the back, the west flank, the steps and walls before the door (not drawn).
// Abbazia di San Martino delle Scale (r449394.0). Commons "AbbaziaDiSanMartinoDelleScale2" and "San Martino delle Scale" (church front); photos in the balarm.it and enjoysicilia.it pages on the abbey.
//  Read: the long east wing with four storeys of white framed windows under a flat terrace, the church front in white plaster and grey stone with the round window, the ribbed ochre dome with a white lantern,
//  the bell tower, ranges with red tiled roofs round the courts. No street picture of Mapillary shows the buildings. Not verified: every other front (plain window bays), the heights of the ranges and the way
//  they step with the ground, the bell tower's far faces.
// Grattacielo INA Assitalia (w122575448) with its base (w25739679), Piazzale Ungheria. Commons "Grattacielo Ina Assitalia^1, ^2, ^3 - Flickr - Rino Porrovecchio", "INA Skyscraper seen from Piazza Giuseppe
//  Verdi", "Grattacielo ina"; Mapillary 985517765496353, 2288777914613495 (2022). Heights of the shaft and wings are the surveyed roof levels. Read: the pale stone slab with two window
//  columns and the glazed bay of balconies, the six window flank, the penthouse, the steel lattice crown with its arch and mast, ochre side wings, white wrapping balconies on the south east, the sign, the base
//  with its portico, terrace rail and taller blocks behind. Not verified: the north west and south west faces, the taller blocks of the base (plain window bays), the crown's inner bracing.
// Casina No Mafia (w365861339), above Capaci. Photos in palermo.gds.it (May 2025, repainting) and teleoccidente.it (November 2015). Read: a tall white block with a projecting flat cap, NO MAFIA in blue on the
//  face towards the motorway, a low white annex. The baked 21.4 m has no survey behind it (no ground foot in the tile, no LiDAR answer at the spot): the block is taken as 10.5 m from the proportion of its
//  face to the footprint edge in the 2015 photo (9.5 to 11.5 m depending on which edge the face is).
//  Not verified: the other faces, the annex's openings, the fence and the retaining wall (not drawn).
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, sphere, extrude, prism, part, archBay, panel, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, streaks, pairsOf, groundRange, statue, pyramid, paintAshlar, archShape, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// outward unit normal of the edge a-b of the polygon poly
const outN = (a, b, poly) => { const l = dist(a, b) || 1; let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l; if (inPoly(poly, (a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + nz * 0.2)) { nx = -nx; nz = -nz; } return [nx, nz]; };
// a polygon drawn in by d metres (mitred corners)
function inset(poly, d) {
  const n = poly.length, N = poly.map((a, i) => outN(a, poly[(i + 1) % n], poly));
  return poly.map((p, i) => { const a = N[(i + n - 1) % n], b = N[i], k = Math.max(0.35, 1 + a[0] * b[0] + a[1] * b[1]); return [p[0] - (a[0] + b[0]) * d / k, p[1] - (a[1] + b[1]) * d / k]; });
}
// is b to the right of a for someone looking at the wall (facing (nx, nz)) from outside
const leftToRight = (a, b, n) => (b[0] - a[0]) * n[1] - (b[1] - a[1]) * n[0] >= 0;
// a vertical quad from a to b, y0..y1, facing (nx, nz), showing the texture rectangle u0..u1 (left to right seen from outside), v0..v1
function quad(key, a, b, y0, y1, u0, u1, v0, v1, n, c) {
  if (!leftToRight(a, b, n)) [a, b] = [b, a];
  const P = [[a[0], y0, a[1], u0, v0], [b[0], y0, b[1], u1, v0], [b[0], y1, b[1], u1, v1], [a[0], y1, a[1], u0, v1]], pos = [], nor = [], uv = [];
  for (const i of [0, 1, 2, 0, 2, 3]) { const q = P[i]; pos.push(q[0], q[1], q[2]); nor.push(n[0], 0, n[1]); uv.push(q[3], q[4]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  part(key, g, { uv: 'keep', noao: true, c });
}
// flat shaded triangles (each turned to face up)
function tris(key, list, c) {
  const pos = [];
  for (const t of list) { const [a, b, d] = t, ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]); for (const q of ny >= 0 ? [a, b, d] : [a, d, b]) pos.push(q[0], q[1], q[2]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.computeVertexNormals();
  part(key, g, { c, noao: true });
}
// hip roof over the four cornered plan q at height y
function hip(q, y, rise, c = '#d9a184', ov = 0.3, key = 'tile') {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cz = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  let p = q.map(([x, z]) => { const d = Math.hypot(x - cx, z - cz) || 1; return [x + (x - cx) / d * ov, z + (z - cz) / d * ov]; });
  if (dist(p[0], p[1]) + dist(p[2], p[3]) < dist(p[1], p[2]) + dist(p[3], p[0])) p = [p[1], p[2], p[3], p[0]];
  const m1 = lerp(p[1], p[2], 0.5), m0 = lerp(p[3], p[0], 0.5), L = dist(m0, m1), k = Math.min(0.45, (dist(p[1], p[2]) + dist(p[3], p[0])) / 4 / (L || 1));
  const A = lerp(m0, m1, k), B = lerp(m1, m0, k), v = (a, h = 0) => [a[0], y + h, a[1]], R0 = v(A, rise), R1 = v(B, rise);
  tris(key, [[v(p[0]), v(p[1]), R1], [v(p[0]), R1, R0], [v(p[1]), v(p[2]), R1], [v(p[2]), v(p[3]), R0], [v(p[2]), R0, R1], [v(p[3]), v(p[0]), R0]], c);
}
// painter for the rectangle (px, py, pw, ph) of a canvas covering FW x FH metres; x from the left edge, y up from the foot
function painter(g, px, py, pw, ph, FW, FH) {
  const sx = pw / FW, sy = ph / FH, X = x => px + x * sx, Y = y => py + ph - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, w, c) => { const r = w / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  const text = (s, x, y, h, c, maxW, font = 'serif') => { g.fillStyle = c; g.font = `bold ${Math.max(6, Math.round(h * sy))}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, X(x), Y(y), maxW ? maxW * sx : undefined); };
  const clip = (f) => { g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip(); f(); g.restore(); };
  return { sx, sy, X, Y, R, poly, arch, circ, line, text, clip };
}
// stone or plaster ground: colour, grain, soft stains and streaks, inside one rectangle of the canvas
function ground(g, x, y, w, h, c, seed, k = 1) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = c; g.fillRect(x, y, w, h);
  const r = RNG(seed);
  for (let i = 0; i < w * h / 55; i++) { g.fillStyle = r() < 0.5 ? `rgba(80,58,36,${0.09 * k})` : `rgba(255,248,232,${0.1 * k})`; g.fillRect(x + r() * w, y + r() * h, 1 + r() * 1.6, 1 + r() * 1.6); }
  for (let i = 0; i < 4 + w * h / 9000; i++) { const px = x + r() * w, py = y + r() * h, rad = 8 + r() * Math.min(70, Math.max(w, h) * 0.2), col = r() < 0.6 ? '70,50,30' : '255,246,225', gr = g.createRadialGradient(px, py, 1, px, py, rad); gr.addColorStop(0, `rgba(${col},${(0.07 + r() * 0.08) * k})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(px - rad, py - rad, 2 * rad, 2 * rad); }
  for (let i = 0; i < w / 9; i++) { const px = x + r() * w, py = y + r() * h * 0.8, l = h * (0.05 + r() * 0.18), gr = g.createLinearGradient(0, py, 0, py + l); gr.addColorStop(0, `rgba(50,36,24,${(0.06 + r() * 0.1) * k})`); gr.addColorStop(1, 'rgba(50,36,24,0)'); g.fillStyle = gr; g.fillRect(px, py, 1 + r() * 2.5, l); }
  g.restore();
}
const GLASS = '#44515c';
// a framed window with a mullion and a transom
function pane(p, x, y0, y1, w, frameC, fr = 0.18, glass = GLASS, mull = '#d8d4c8') {
  p.R(x - w / 2 - fr, y0 - fr, x + w / 2 + fr, y1 + fr, frameC); p.R(x - w / 2, y0, x + w / 2, y1, glass); p.R(x - w / 2, y1 - (y1 - y0) * 0.16, x + w / 2, y1, 'rgba(0,0,0,0.28)');
  p.R(x - 0.05, y0, x + 0.05, y1, mull); p.R(x - w / 2, y0 + (y1 - y0) * 0.66, x + w / 2, y0 + (y1 - y0) * 0.66 + 0.08, mull);
}
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const slab = (M, p, z0, z1, c, key = 'flat') => extrude(key, shapeOf(p), z1 - z0, { M, p: [0, 0, z0], c, noao: true, cs: 6 });
const flatRoof = (pts, y, c = '#9a948a', holes) => prism('flat', pts, y, y + 0.14, { c, noao: true, holes });
const disc = (M, x, y, z, r, d, c, seg = 10) => cyl('flat', r, r, d, seg, { M, p: [x, y, z], rx: PI / 2, c, noao: true });
// a frame in the middle of the edge a-b (+z out), and a point of it in world coordinates
const edgeFrame = (a, b, y, n) => frame((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, n[0], n[1]);
const along = (a, b, n, d) => [[a[0] + n[0] * d, a[1] + n[1] * d], [b[0] + n[0] * d, b[1] + n[1] * d]];
// a band along an edge: from zIn (inwards of the footprint line is negative) to zOut, y0..y1
function band(a, b, n, y0, y1, zIn, zOut, c, ext = 0) { const M = edgeFrame(a, b, 0, n), l = dist(a, b) / 2 + ext; bx('flat', M, -l, l, y0, y1, zIn, zOut, { c, noao: true }); }
// a convex polygon with each edge drawn in by its own distance
function insetE(P, d) {
  const L = P.map((a, i) => { const b = P[(i + 1) % P.length], n = outN(a, b, P); return [a[0] - n[0] * d[i], a[1] - n[1] * d[i], b[0] - a[0], b[1] - a[1]]; });
  return L.map((l, i) => { const m = L[(i + L.length - 1) % L.length], k = ((l[0] - m[0]) * l[3] - (l[1] - m[1]) * l[2]) / (m[2] * l[3] - m[3] * l[2]); return [m[0] + m[2] * k, m[1] + m[3] * k]; });
}
const skirt = (pts, lo, y0, c = '#9c9282') => prism('flat', inset(pts, 0.06), lo, y0 + 0.05, { c });
// wall segments along a list of local points of the frame (origin O, normal N)
const chainW = (P) => P.slice(1).map((b, i) => [...P[i], ...b]);
const localW = (O, N, L) => chainW(L.map(([x, z]) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]]));
const arcPts = (cx, cz, r, n, a0 = 0, a1 = PI) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
// half a drum standing out in +z of the frame M: the round wall (key) and its conical or domed cap
function halfDrum(key, M, r, y0, y1, o = {}) {
  cyl(key, r, r, y1 - y0, o.seg || 10, { M, p: [0, y0, 0], t0: -PI / 2, tl: PI, open: true, c: o.c });
  if (o.dome) part(o.capKey || 'flat', new THREE.SphereGeometry(r, o.seg || 10, 4, 0, PI, 0, PI / 2), { M, p: [0, y1, 0], s: [1, o.dome, 1], c: o.cap, noao: true });
  else cyl(o.capKey || 'flat', 0.05, r + (o.ov || 0.2), o.rise || 1, o.seg || 10, { M, p: [0, y1, 0], t0: -PI / 2, tl: PI, c: o.cap, noao: true });
}

// =====================================================================================================
// Ingresso monumentale di Via Roma
// =====================================================================================================
const VRW = { id: 'w279883080', p: [423.5, 510.9, 425.8, 510.8, 428.6, 511.8, 430.6, 513.3, 436.4, 527.8, 429.5, 530.5, 426.8, 534.2, 424.2, 539.3, 423.1, 545.4, 428.6, 558.0, 426.9, 559.9, 427.0, 561.6, 406.8, 573.0, 404.3, 568.4, 418.3, 560.1, 398.4, 522.5] };
const VRE = { id: 'w279882278', p: [452.0, 500.9, 452.7, 499.3, 453.7, 497.6, 468.2, 491.5, 468.7, 491.3, 486.1, 522.6, 494.8, 517.7, 500.7, 514.4, 503.0, 519.3, 480.6, 531.4, 477.7, 529.9, 476.0, 525.0, 471.6, 521.6, 467.6, 519.9, 462.8, 518.9, 458.3, 520.4, 451.5, 503.3] };
const VRBW = 4.6, VRH = 24.3;
function vrBay(g, w, h) {
  const p = painter(g, 0, 0, w, h, VRBW, VRH), { R, arch, poly } = p, c = VRBW / 2;
  ground(g, 0, 0, w, p.Y(10), '#c8b69a', 1201);
  ground(g, 0, p.Y(10), w, h - p.Y(10), '#a6a6a1', 1202, 1.4);
  // the grey storey: rusticated courses, the arched opening with its shutter and lunette, the mezzanine window
  for (let y = 2.2; y < 9.2; y += 0.62) { R(0, y, 0.78, y + 0.07, '#83837f'); R(VRBW - 0.78, y, VRBW, y + 0.07, '#83837f'); }
  R(0, 0, VRBW, 0.5, '#8f8f8a');
  arch(c, 0, 5.65, 3.3, '#cfcec8'); arch(c, 0, 5.45, 2.9, '#8d9092'); arch(c, 3.85, 5.3, 2.6, '#a7acab');
  R(c - 1.45, 0, c + 1.45, 3.85, '#777b7f'); for (let y = 0.14; y < 3.8; y += 0.22) R(c - 1.45, y, c + 1.45, y + 0.05, '#575b60'); R(c - 1.55, 3.8, c + 1.55, 4.0, '#9a9a95');
  pane(p, c, 7.15, 8.3, 1.7, '#c9c8c2');
  R(0, 9.35, VRBW, 10, '#cdcac1'); R(0, 9.2, VRBW, 9.35, 'rgba(40,36,30,0.4)');
  // the cream storeys: the pedimented window, the small one, the string course, the upper window, the cornice
  pane(p, c, 11.5, 13.85, 1.45, '#b39c79', 0.26);
  R(c - 1.25, 14.2, c + 1.25, 14.42, '#ac936e'); for (const s of [-1, 1]) { p.line(c + s * 1.25, 14.45, c + s * 0.32, 15.25, 0.2, '#a58b66'); p.line(c + s * 1.2, 14.68, c + s * 0.34, 15.42, 0.08, '#efe2c2'); }
  pane(p, c, 15.75, 17.05, 1.35, '#b7a07e', 0.22);
  R(0, 17.75, VRBW, 17.9, 'rgba(70,48,24,0.35)'); R(0, 17.9, VRBW, 18.6, '#d5c8ae'); R(0, 18.5, VRBW, 18.6, '#e9e0ca');
  pane(p, c, 19.55, 21.75, 1.4, '#b7a07e', 0.22);
  R(0, 22.95, VRBW, 23.4, 'rgba(60,42,22,0.4)'); R(0, 23.4, VRBW, VRH, '#cbbb9d'); for (let x = 0.1; x < VRBW; x += 0.46) R(x, 23.15, x + 0.2, 23.4, '#bcaa8a');
  // half a pilaster at each edge, so that neighbouring bays make the pairs
  for (const [a, b] of [[0, 0.5], [VRBW - 0.5, VRBW]]) for (const [y0, y1] of [[11.4, 17.75], [18.6, 22.95]]) { R(a, y0, b, y1, '#b59f7d'); R(a === 0 ? b - 0.07 : a, y0, a === 0 ? b : a + 0.07, y1, '#917c5c'); R(a, y1 - 0.62, b, y1 - 0.08, '#ece4d0'); R(a, y1 - 0.38, b, y1 - 0.3, '#b9ab8c'); R(a, y0, b, y0 + 0.3, '#cec1a6'); }
  streaks(g, w, h, 16, 1203, 0.07, 80);
}
// one stretch of wall along the footprint vertices ids: bays of the painted texture on the plane drawn in by 0.2; on the fronts the columns, pilasters, balconies
function vrRun(P, ids, y0, front) {
  const pts = ids.map(i => P[i]), I = inset(P, 0.2), q = ids.map(i => I[i]), L = q.slice(1).reduce((s, b, i) => s + dist(q[i], b), 0), n = Math.max(1, Math.round(L / VRBW));
  let s = 0;
  for (let i = 0; i + 1 < q.length; i++) { const l = dist(q[i], q[i + 1]), nn = outN(pts[i], pts[i + 1], P), u0 = s / L * n, u1 = (s + l) / L * n, fwd = leftToRight(q[i], q[i + 1], nn);
    quad('btVr', q[i], q[i + 1], y0, y0 + VRH, fwd ? u0 : -u1, fwd ? u1 : -u0, 0, 1, nn);   // (walked right to left, the same bays count down)
    band(pts[i], pts[i + 1], nn, y0 + 17.95, y0 + 18.55, -0.5, 0.1, '#d2c4a8', 0.1); band(pts[i], pts[i + 1], nn, y0 + 23.45, y0 + 23.85, -0.5, 0.35, '#c3b195', 0.25); band(pts[i], pts[i + 1], nn, y0 + 23.85, y0 + 24.3, -0.5, 0.75, '#d3c5aa', 0.6);
    band(pts[i], pts[i + 1], nn, y0 + 24.3, y0 + 25.5, -0.65, -0.2, '#bcab90'); band(pts[i], pts[i + 1], nn, y0 + 25.5, y0 + 25.68, -0.75, -0.1, '#d9cdb4', 0.05);
    s += l; }
  if (!front) return;
  const at = (d) => { let a = 0; for (let i = 0; i + 1 < pts.length; i++) { const l = dist(pts[i], pts[i + 1]); if (d <= a + l || i + 2 === pts.length) { const t = (d - a) / l; return { p: lerp(pts[i], pts[i + 1], t), n: outN(pts[i], pts[i + 1], P) }; } a += l; } };
  const LP = pts.slice(1).reduce((v, b, i) => v + dist(pts[i], b), 0);
  for (let k = 0; k <= n; k++) {
    const e = at(Math.min(LP - 0.5, Math.max(0.5, k * LP / n))), M = frame(e.p[0], y0, e.p[1], e.n[0], e.n[1]);
    bx('flat', M, -0.55, 0.55, 0, 2.0, -0.22, 0.04, { c: '#a9a9a4' }); bx('flat', M, -0.62, 0.62, 1.82, 2.0, -0.22, 0.07, { c: '#c4c3bd', noao: true });
    cyl('flat', 0.28, 0.33, 6.4, 8, { M, p: [0, 2.0, -0.26], t0: -PI / 2, tl: PI, open: true, c: '#bcbcb6' });
    bx('flat', M, -0.48, 0.48, 8.4, 8.85, -0.22, 0.1, { c: '#cfcdc4', noao: true });
    for (const [a, b] of [[11.4, 17.9], [18.6, 23.45]]) { bx('flat', M, -0.34, 0.34, a, b - 0.6, -0.45, -0.17, { c: '#b8a281', noao: true }); bx('flat', M, -0.48, 0.48, b - 0.6, b - 0.08, -0.45, -0.1, { c: '#e9e0ca', noao: true }); }
  }
  for (let k = 0; k < n; k++) {
    const e = at((k + 0.5) * LP / n), M = frame(e.p[0], y0, e.p[1], e.n[0], e.n[1]), hw = Math.min(1.35, LP / n / 2 - 0.5);
    bx('flat', M, -hw, hw, 9.95, 10.35, -0.45, 0.5, { c: '#c6c4bc', noao: true });
    for (const s of [-1, 1]) { bx('flat', M, s * (hw - 0.35) - 0.18, s * (hw - 0.35) + 0.18, 9.2, 9.95, -0.45, 0.2, { c: '#b4b3ad', noao: true }); panel('balus', 0.9, 1.0, { M: mul(M, tr(s * hw, 10.35, 0.0)), ry: PI / 2, uvk: [0.9, 1] }); }
    panel('balus', hw * 2, 1.0, { M, p: [0, 10.35, 0.45], uvk: [hw * 2, 1] });
  }
}
// the turret over the inner corner: a at the corner, b along the square's front, d metres back along the Via Roma side towards c
function vrTurret(P, ia, ib, ic, y0) {
  const a = P[ia], b = P[ib], l = dist(a, P[ic]) || 1, d = [(P[ic][0] - a[0]) / l * 6.8, (P[ic][1] - a[1]) / l * 6.8];
  const T = inset([a, b, [b[0] + d[0], b[1] + d[1]], [a[0] + d[0], a[1] + d[1]]], 0.65);
  prism('flat', T, y0 + 24.0, y0 + 24.8, { c: '#c0ae92', noao: true });
  for (let i = 0; i < 4; i++) {
    const p = T[i], q = T[(i + 1) % 4], n = outN(p, q, T), M = edgeFrame(p, q, y0 + 24.8, n), W = dist(p, q), ow = Math.min(2.6, W * 0.4);
    archBay('flat', W, 4.6, ow, 3.95, 0.45, { M: mul(M, tr(0, 0, -0.45)), c: '#cbbb9e', oy0: 0.25, noao: true });
    extrude('flat', archShape(ow, 3.7), 0.04, { cs: 6, M, p: [0, 0.25, -0.44], c: '#6f6252', noao: true });   // the shaded inside of the belfry, seen through the arch
    for (const s of [-1, 1]) { bx('flat', M, s * (W / 2 - 0.55) - 0.34, s * (W / 2 - 0.55) + 0.34, 0, 4.6, -0.05, 0.18, { c: '#b7a384', noao: true }); bx('flat', M, s * (ow / 2 + 0.45) - 0.14, s * (ow / 2 + 0.45) + 0.14, 0, 2.7, -0.02, 0.1, { c: '#d8ccb2', noao: true }); }
    // the eagle: two spread wings, body, head and the shield under it
    const E = mul(mul(M, tr(0, 4.8, 0.34)), new THREE.Matrix4().makeScale(1.25, 1.25, 1.1));
    for (const s of [-1, 1]) slab(E, [[s * 0.2, -0.15], [s * 0.75, -0.05], [s * 1.55, 0.35], [s * 1.75, 0.95], [s * 1.25, 0.8], [s * 1.0, 1.0], [s * 0.7, 0.75], [s * 0.25, 0.65]], -0.12, 0.06, '#ece8dc');
    sphere('flat', 0.34, { M: E, p: [0, 0.35, 0.05], ky: 1.7, seg: 6, c: '#e4dfd2', noao: true }); sphere('flat', 0.2, { M: E, p: [0.08, 1.05, 0.12], seg: 6, c: '#ece8dc', noao: true }); box('flat', 0.22, 0.09, 0.1, { M: E, p: [0.3, 1.0, 0.18], c: '#cfc6ac', noao: true });
    slab(E, [[-0.4, -0.2], [0.4, -0.2], [0.3, -0.7], [0, -0.9], [-0.3, -0.7]], -0.1, 0.08, '#e6e0d0');
  }
  prism('flat', inset(T, -0.4), y0 + 29.4, y0 + 29.95, { c: '#d3c6ac', noao: true }); prism('flat', inset(T, 0.15), y0 + 29.95, y0 + 30.7, { c: '#c8b89c', noao: true });
}
// the fountain under the turret, on the edge a-b
function vrFountain(P, ia, ib, y0) {
  const a = P[ia], b = P[ib], n = outN(a, b, P), M = edgeFrame([a[0] + n[0] * 0.2, a[1] + n[1] * 0.2], [b[0] + n[0] * 0.2, b[1] + n[1] * 0.2], y0, n);   // (+0.2: as far out as the wall behind it stands)
  bx('flat', M, -2.2, 2.2, 0, 8.9, -0.42, -0.34, { c: '#9c9c97' });
  for (const s of [-1, 1]) { bx('flat', M, s * 1.45 - 0.22, s * 1.45 + 0.22, 0, 6.4, -0.36, -0.12, { c: '#c2c1bb' }); box('flat', 1.95, 0.34, 0.4, { M, p: [s * 0.8, 6.75, -0.22], rz: -s * 0.55, c: '#d2d0c8', noao: true }); }
  bx('flat', M, -1.75, 1.75, 6.25, 6.5, -0.36, -0.05, { c: '#d2d0c8', noao: true });
  extrude('flat', archShape(1.5, 2.3), 0.06, { cs: 5, M, p: [0, 3.0, -0.35], c: '#5c5c58', noao: true });
  sphere('flat', 0.42, { M, p: [0, 4.5, -0.34], kz: 0.35, seg: 6, c: '#bdbcb4', noao: true });
  cyl('flat', 0.8, 0.35, 0.55, 8, { M, p: [0, 2.45, -0.36], t0: -PI / 2, tl: PI, c: '#cac9c2', noao: true }); bx('flat', M, -0.22, 0.22, 1.9, 2.45, -0.36, -0.05, { c: '#b4b4ae' });
  cyl('flat', 1.35, 1.35, 0.16, 12, { M, p: [0, 1.62, -0.36], t0: -PI / 2, tl: PI, c: '#cfcec7', noao: true });
  cyl('flat', 1.3, 1.22, 1.62, 12, { M, p: [0, 0, -0.36], t0: -PI / 2, tl: PI, open: true, c: '#b9b8b1' }); cyl('flat', 1.2, 1.2, 0.04, 12, { M, p: [0, 1.76, -0.36], t0: -PI / 2, tl: PI, c: '#86908c', noao: true });
  cyl('flat', 1.42, 1.45, 0.2, 12, { M, p: [0, 0, -0.36], t0: -PI / 2, tl: PI, c: '#a8a8a2' });
}
const vrWalls = (flat, ia, ib) => { const P = pairsOf(flat), a = P[ia], b = P[ib], n = outN(a, b, P); return localW([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n, [[-1.45, 0], [-1.27, 0.57], [-0.72, 1.0], [0, 1.17], [0.72, 1.0], [1.27, 0.57], [1.45, 0]]); };
function vrBlock(B, runs, T, F, statues) {
  const P = pairsOf(B.p), rg = groundRange(P), y0 = (groundY(...P[T[0]]) + groundY(...P[T[1]])) / 2;
  skirt(P, rg.lo - 1.5, y0, '#8e8e88');
  for (const [ids, front] of runs) vrRun(P, ids, y0, front);
  prism('tile', inset(P, 0.8), y0 + 24.3, y0 + 24.55, { c: '#d9a184', noao: true });
  vrTurret(P, ...T, y0); vrFountain(P, ...F, y0);
  // the attic panel of the concave front, between two statues
  const [i, j] = statues, a = P[i], b = P[j], n = outN(a, b, P), M = edgeFrame(a, b, y0, n), hw = Math.min(2.4, dist(a, b) / 2);
  bx('flat', M, -hw, hw, 25.68, 26.5, -0.65, -0.2, { c: '#c4b296', noao: true }); bx('flat', M, -hw * 0.6, hw * 0.6, 25.85, 26.32, -0.2, -0.15, { c: '#e6dcc4', noao: true }); bx('flat', M, -hw - 0.15, hw + 0.15, 26.5, 26.68, -0.75, -0.1, { c: '#d9cdb4', noao: true });
  for (const s of [-1, 1]) { bx('flat', M, s * (hw + 0.45) - 0.42, s * (hw + 0.45) + 0.42, 25.5, 26.5, -0.8, -0.05, { c: '#cec0a6', noao: true }); statue('flat', mul(M, tr(s * (hw + 0.45), 26.5, -0.42)), 2.5, { c: '#e8e3d4', noao: true }); }
  return y0;
}
function buildViaRoma() {
  initShared();
  defMat('btVr', 160, 800, [VRBW, VRH], vrBay);
  begin(14.9);
  const w0 = vrBlock(VRW, [[[4, 5], 1], [[5, 6, 7, 8], 1], [[8, 9], 1], [[9, 10, 11], 0], [[11, 12], 1], [[12, 13], 0], [[13, 14], 0], [[14, 15], 0], [[15, 0], 0], [[0, 1, 2, 3], 0], [[3, 4], 1]], [4, 5, 3], [4, 5], [6, 7]);
  const e0 = vrBlock(VRE, [[[14, 15], 1], [[11, 12, 13, 14], 1], [[9, 10, 11], 1], [[8, 9], 1], [[7, 8], 0], [[6, 7], 0], [[5, 6], 0], [[4, 5], 0], [[0, 1, 2, 3, 4], 0], [[16, 0], 0], [[15, 16], 1]], [15, 14, 16], [14, 15], [12, 13]);
  // the archway on the west block's wing
  { const P = pairsOf(VRW.p), a = P[11], b = P[12], n = outN(a, b, P), c = lerp(a, b, 0.62), M = frame(c[0], w0, c[1], n[0], n[1]);
    extrude('flat', archShape(7.4, 8.6), 0.06, { cs: 10, M, p: [0, 0, -0.18], c: '#c4c3bc', noao: true }); extrude('flat', archShape(6.2, 8.0), 0.06, { cs: 10, M, p: [0, 0, -0.13], c: '#3c3a36', noao: true }); }
  const o = end('Ingresso monumentale di Via Roma');
  o.userData.solids = [[VRW.p, null, w0 + VRH], [VRE.p, null, e0 + VRH]];
  return o;
}

// =====================================================================================================
// Palazzo delle Finanze
// =====================================================================================================
const FI = { id: 'r1291575.0', p: [448.0, -302.0, 489.9, -328.4, 556.5, -278.6, 508.7, -254.4], h: [[480.5, -316.2, 485.1, -313.7, 481.3, -306.7, 484.3, -304.7, 480.6, -298.4, 472.0, -304.9], [492.9, -288.9, 511.1, -273.8, 517.8, -282.9, 514.7, -285.4, 515.5, -288.1, 502.0, -299.7]] };
const FIH = 21.4, FIBW = 4.9, FIYEL = 6.8, FIPW = 17.4;
const FIW = 400, FIHP = 448, FIB = 128, FIPX = 32, FIGH = 160;   // atlas: the bay (0..128), the relief pilaster (128..160), the iron gate (160..224, foot), the frieze in two halves (160..400, top)
const fiU = x => x / FIW, fiV = (py) => 1 - py / FIHP;
function fiAtlas(g, w, h) {
  ground(g, 0, 0, w, h, '#e6dcc0', 1301, 0.8);
  {
    const p = painter(g, 0, 0, FIB, h, FIBW, FIH), { R } = p, c = FIBW / 2;
    ground(g, 0, p.Y(FIYEL), FIB, h - p.Y(FIYEL), '#cfb478', 1302);
    for (let y = 0.9; y < FIYEL; y += 0.82) R(0, y, FIBW, y + 0.06, 'rgba(90,66,30,0.42)'); R(0, 0, FIBW, 0.55, '#bfa670');
    pane(p, c, 1.55, 4.15, 1.25, '#e4dcc6', 0.3, '#3c3a36', '#8a8070'); R(0, FIYEL - 0.25, FIBW, FIYEL, '#dcc68e'); R(0, FIYEL - 0.35, FIBW, FIYEL - 0.25, 'rgba(70,50,22,0.4)');
    const hooded = (y0, y1) => { pane(p, c, y0, y1, 1.3, '#efe8d2', 0.24, '#4a463e', '#bdb29a'); R(c - 1.12, y1 + 0.55, c + 1.12, y1 + 0.8, '#f2ebd6'); R(c - 1.12, y1 + 0.42, c + 1.12, y1 + 0.55, 'rgba(80,62,36,0.45)'); for (const s of [-1, 1]) R(c + s * 0.9 - 0.1, y1 + 0.05, c + s * 0.9 + 0.1, y1 + 0.45, '#d6cbac'); R(c - 0.95, y0 - 0.45, c + 0.95, y0 - 0.25, '#efe8d2'); };
    hooded(7.45, 10.2); R(0, 11.25, FIBW, 11.55, '#f0e8d0'); R(0, 11.12, FIBW, 11.25, 'rgba(80,62,36,0.4)'); hooded(13.0, 15.7);
    R(0, 17.05, FIBW, 17.25, '#efe7d0'); R(0, 16.97, FIBW, 17.05, 'rgba(80,62,36,0.35)'); pane(p, c, 17.95, 19.5, 1.05, '#ece4cc', 0.2, '#4a463e', '#bdb29a');
    R(0, 20.15, FIBW, 20.45, 'rgba(70,52,28,0.4)'); R(0, 20.45, FIBW, FIH, '#e9dfc4');
    streaks(g, FIB, h, 14, 1303, 0.09, 90);
  }
  {   // the pilaster of the corners: white reliefs hung one under the other
    const p = painter(g, FIB, 0, FIPX, h, 1.4, FIH), { R, circ, poly } = p, r = RNG(1304);
    ground(g, FIB, p.Y(FIYEL), FIPX, h - p.Y(FIYEL), '#cfb478', 1305);
    for (let y = 0.9; y < FIYEL; y += 0.82) R(0, y, 1.4, y + 0.06, 'rgba(90,66,30,0.42)');
    for (const [a, b] of [[7.2, 11.1], [11.8, 19.9]]) { R(0.15, a, 1.25, b, '#d9cdae'); for (let y = a + 0.35; y < b - 0.3; y += 0.42) { circ(0.7 + (r() - 0.5) * 0.35, y, 0.2 + r() * 0.12, '#f1ece0'); poly([[0.35, y - 0.1], [0.7, y + 0.28], [1.05, y - 0.14]], '#e6dfcd'); circ(0.75 + (r() - 0.5) * 0.5, y - 0.15, 0.08, '#a89c7e'); } }
    R(0, 20.15, 1.4, FIH, '#e9dfc4');
  }
  {   // the gate: black iron stars in squares over the dark of the portico
    const p = painter(g, 160, FIHP - FIGH, 64, FIGH, 2, 5.6), { R, line, circ } = p;
    R(0, 0, 2, 5.6, '#2b2620'); R(0, 0, 2, 3.7, '#35302a');
    for (let y = 0; y < 3.6; y += 0.9) { R(0, y, 2, y + 0.09, '#6a655c'); for (const x0 of [0, 1]) { const cx = x0 + 0.5, cy = y + 0.5; for (let k = 0; k < 8; k++) line(cx, cy, cx + Math.cos(k * PI / 4) * 0.47, cy + Math.sin(k * PI / 4) * 0.42, 0.07, '#77716a'); circ(cx, cy, 0.14, '#8a847a'); } }
    for (const x of [0, 0.97, 1.92]) R(x, 0, x + 0.08, 3.75, '#6a655c'); for (let x = 0.12; x < 2; x += 0.25) p.poly([[x - 0.07, 3.7], [x, 4.05], [x + 0.07, 3.7]], '#5c574f');
  }
  for (let i = 0; i < 2; i++) {   // the frieze, left half over right half: triglyphs and the name
    g.save(); g.beginPath(); g.rect(160, 40 * i, 240, 40); g.clip();
    const p = painter(g, 160 - 240 * i, 40 * i, 480, 40, FIPW, 1.45), { R, text } = p;
    R(0, 0, FIPW, 1.45, '#cfb478');
    for (let x = 0.15; x < FIPW; x += 1.15) { R(x, 0.12, x + 0.46, 0.7, '#b89a5e'); for (let k = 0; k < 3; k++) R(x + 0.06 + k * 0.14, 0.14, x + 0.11 + k * 0.14, 0.68, '#8c7242'); }
    R(0, 0.72, FIPW, 0.82, '#e2cd96'); R(FIPW / 2 - 4.2, 0.84, FIPW / 2 + 4.2, 1.42, '#d8c088'); text('PALAZZO DELLE FINANZE', FIPW / 2, 1.13, 0.52, '#f4eedc', 8);
    g.restore();
  }
}
function buildFinanze() {
  initShared();
  defMat('btFi', FIW, FIHP, [FIBW, FIH], fiAtlas);
  const P = pairsOf(FI.p), I = inset(P, 0.3), rg = groundRange(P), y0 = rg.avg, holes = FI.h.map(pairsOf);
  begin(y0);
  for (let e = 0; e < 4; e++) {
    const a = P[e], b = P[(e + 1) % 4], ia = I[e], ib = I[(e + 1) % 4], n = outN(a, b, P), L = dist(ia, ib), portico = e === 2, M = edgeFrame(a, b, y0, n);
    const bays = (s0, s1, v0y) => { const k = Math.max(1, Math.round((s1 - s0) / FIBW)); for (let i = 0; i < k; i++) quad('btFi', lerp(ia, ib, (s0 + (s1 - s0) * i / k) / L), lerp(ia, ib, (s0 + (s1 - s0) * (i + 1) / k) / L), y0 + v0y, y0 + FIH, 0, fiU(FIB), v0y / FIH, 1, n); };
    if (!portico) bays(0, L, 0);
    else { const s0 = (L - FIPW) / 2, s1 = (L + FIPW) / 2; bays(0, s0, 0); bays(s0, s1, 6.95); bays(s1, L, 0); }
    // the corner pilasters, standing a little out of the wall
    for (const [s0, s1] of [[0, 1.5], [L - 1.5, L]]) { const [c, d] = along(lerp(ia, ib, s0 / L), lerp(ia, ib, s1 / L), n, 0.16); quad('btFi', c, d, y0, y0 + FIH - 0.9, fiU(FIB), fiU(FIB + FIPX), 0, (FIH - 0.9) / FIH, n); }
    band(a, b, n, y0 + 20.5, y0 + 20.9, -0.5, 0.2, '#e4d8ba', 0.1); band(a, b, n, y0 + 20.9, y0 + 21.4, -0.6, 0.55, '#efe6ce', 0.4);
    band(a, b, n, y0 + 11.28, y0 + 11.52, -0.32, -0.12, '#efe6ce');
    if (!portico) { band(a, b, n, y0 + FIYEL - 0.25, y0 + FIYEL, -0.32, -0.14, '#d8c088'); continue; }
    for (const s of [-1, 1]) band(...along(lerp(a, b, s < 0 ? 0 : 0.5 + FIPW / 2 / dist(a, b)), lerp(a, b, s < 0 ? 0.5 - FIPW / 2 / dist(a, b) : 1), n, 0), n, y0 + FIYEL - 0.25, y0 + FIYEL, -0.32, -0.14, '#d8c088');
    // the portico: iron gates between five Doric columns, the frieze and its cornice, two lanterns
    const hw = FIPW / 2, back = -0.36;
    const g0 = new THREE.Vector3(-hw, 0, back).applyMatrix4(M), g1 = new THREE.Vector3(hw, 0, back).applyMatrix4(M);
    for (let i = 0; i < 6; i++) quad('btFi', lerp([g0.x, g0.z], [g1.x, g1.z], i / 6), lerp([g0.x, g0.z], [g1.x, g1.z], (i + 1) / 6), y0, y0 + 5.6, fiU(160), fiU(224), 0, fiV(FIHP - FIGH), n);
    for (const s of [-1, 1]) bx('flat', M, s * hw - 0.2, s * hw + 0.2, 0, 5.6, back - 0.1, -0.22, { c: '#c4a96e' });
    for (let i = 0; i < 5; i++) {
      const x = -hw + (i + 1) * FIPW / 6;
      cyl('flat', 0.45, 0.58, 4.85, 12, { M, p: [x, 0, -0.56], c: '#c9ae74', open: true });
      cyl('flat', 0.68, 0.46, 0.3, 10, { M, p: [x, 4.85, -0.56], c: '#d2b97e', noao: true }); bx('flat', M, x - 0.68, x + 0.68, 5.15, 5.55, -1.28, 0.04, { c: '#d6bf86', noao: true });
    }
    bx('flat', M, -hw - 0.3, hw + 0.3, 5.55, 6.95, -1.3, -0.1, { c: '#cfb478', noao: true });
    const f0 = new THREE.Vector3(-hw, 0, -0.08).applyMatrix4(M), f1 = new THREE.Vector3(hw, 0, -0.08).applyMatrix4(M);
    const fm = [(f0.x + f1.x) / 2, (f0.z + f1.z) / 2];
    quad('btFi', [f0.x, f0.z], fm, y0 + 5.55, y0 + 7.0, fiU(160), 1, fiV(40), 1, n); quad('btFi', fm, [f1.x, f1.z], y0 + 5.55, y0 + 7.0, fiU(160), 1, fiV(80), fiV(40), n);
    bx('flat', M, -hw - 0.45, hw + 0.45, 6.95, 7.3, -0.4, 0.3, { c: '#d9c288', noao: true });
    for (const s of [-1, 1]) { const x = s * (hw + 0.9); bx('flat', M, x - 0.04, x + 0.04, 5.35, 5.42, -0.3, 0.55, { c: '#26221c', noao: true }); cyl('flat', 0.26, 0.16, 0.6, 6, { M, p: [x, 5.0, 0.55], c: '#3a352c', noao: true }); }
  }
  for (const hl of holes) for (let i = 0; i < hl.length; i++) { const a = hl[i], b = hl[(i + 1) % hl.length], l = dist(a, b); let n = outN(a, b, hl); n = [-n[0], -n[1]]; quad('flat', a, b, y0, y0 + FIH, 0, 1, 0, 1, n, '#cdbf9c'); }
  prism('flat', I, y0 + FIH - 0.1, y0 + FIH + 0.04, { c: '#a8a296', noao: true, holes });
  // the hip roof over the four ranges: up from the eaves to a ridge, down towards the courts
  // (the north west range is narrow where the small court comes close to its front)
  const rings = [[insetE(P, [0.25, 0.25, 0.25, 0.25]), FIH], [insetE(P, [2.8, 6.0, 6.5, 6.5]), FIH + 2.4], [insetE(P, [5.1, 10.4, 11.0, 11.0]), FIH + 0.15]];
  for (let k = 0; k < 2; k++) for (let e = 0; e < 4; e++) { const [A, ha] = rings[k], [B, hb] = rings[k + 1], f = (e + 1) % 4, v = (q, hh) => [q[0], y0 + hh, q[1]]; tris('tile', [[v(A[e], ha), v(A[f], ha), v(B[f], hb)], [v(A[e], ha), v(B[f], hb), v(B[e], hb)]], '#dca98a'); }
  skirt(P, rg.lo - 1.5, y0);
  const o = end('Palazzo delle Finanze');
  o.userData.solids = [[FI.p, FI.h, y0 + FIH]];
  return o;
}

// =====================================================================================================
// Palazzo d'Orleans
// =====================================================================================================
const OR = { id: 'w1185594961', p: [-826.7, 668.2, -827.7, 653.4, -745.1, 647.7, -744.2, 661.4, -778.8, 663.7, -778.0, 676.1, -786.9, 676.7, -787.8, 663.8, -814.3, 665.6, -814.1, 667.3] };
const ORM = 49.7, ORPK = 23.0, ORH = 18.4, ORPH = 15.6, ORPX = 600, ORW = 896, ORHP = 336;
const ORB = [5.1, 10.0, 14.9, 20.7, 26.0, 31.1, 36.5, 40.7, 45.0];   // the nine bays, metres from the west end (right to left on the page: x is metres from the left, east, end)
const ORXB = ORB.map(s => ORM - s).reverse(), ORPORT = ORM - 26.0;
function orAtlas(g, w, h) {
  const stone = '#b9a07a', dark = '#3a2e27';
  {
    const p = painter(g, 0, 0, ORPX, h, ORM, ORH), { R, arch, poly, circ, line } = p, r = RNG(1401);
    ground(g, 0, 0, ORPX, h, stone, 1402, 1.5);
    for (let y = 0.5; y < 16.2; y += 0.48) for (let x = (y * 7) % 1.3; x < ORM; x += 1.35) R(x, y, x + 0.05, y + 0.46, 'rgba(100,70,40,0.22)'), R(x, y, x + 1.3, y + 0.035, 'rgba(100,70,40,0.18)');
    for (let i = 0; i < 900; i++) { const x = r() * ORM, y = r() * 15.5, s = 0.08 + r() * r() * 0.7; R(x, y, x + s, y + s * 0.55, r() < 0.65 ? 'rgba(74,58,44,0.38)' : 'rgba(228,214,184,0.34)'); }
    // the narrow ochre bay at the east end
    ground(g, 0, p.Y(8.0), p.X(2.6), h - p.Y(8.0), '#cbab74', 1403);
    pane(p, 1.3, 2.0, 3.3, 0.8, '#d8c090', 0.14, '#2f2a24'); pane(p, 1.3, 5.3, 6.6, 0.8, '#d8c090', 0.14, dark, '#7a6250');
    // the giant pilasters of the two upper floors with their capitals
    for (let i = 0; i <= ORXB.length; i++) {
      const x = i === 0 ? ORXB[0] - 2.35 : i === ORXB.length ? ORXB[i - 1] + 2.35 : (ORXB[i - 1] + ORXB[i]) / 2;
      R(x - 0.42, 8.3, x + 0.42, 16.15, '#cdb084'); R(x + 0.42, 8.3, x + 0.56, 16.15, 'rgba(60,40,22,0.42)'); R(x - 0.5, 8.3, x - 0.42, 16.15, 'rgba(255,236,200,0.35)'); R(x - 0.6, 15.4, x + 0.6, 16.15, '#dcc29a'); for (let k = -2; k <= 2; k++) circ(x + k * 0.22, 15.65 + (k % 2) * 0.12, 0.13, '#8e7250');
    }
    R(0, 7.75, ORM, 8.2, '#cfb488'); R(0, 7.6, ORM, 7.75, 'rgba(60,40,22,0.45)'); R(0, 16.15, ORM, 16.35, 'rgba(60,40,22,0.45)'); R(0, 16.35, ORM, 17.1, '#cbb086'); R(0, 17.1, ORM, ORH, '#c9ae80'); R(0, 18.15, ORM, ORH, '#d4bc90');
    for (const x of [3.1, 12.4, 28.6, 42.4]) R(x, 0.2, x + 0.14, 17.0, '#5a4a3a');
    const french = (x, y0, y1, ww, shut) => {
      R(x - ww / 2 - 0.28, y0, x + ww / 2 + 0.28, y1 + 0.28, '#d2b88c'); R(x - ww / 2, y0, x + ww / 2, y1, dark);
      if (shut) { R(x - ww / 2 + 0.1, y0, x - 0.04, y1 - 0.1, '#5a4436'); R(x + 0.04, y0, x + ww / 2 - 0.1, y1 - 0.1, '#5a4436'); for (let y = y0 + 0.2; y < y1; y += 0.26) R(x - ww / 2 + 0.1, y, x + ww / 2 - 0.1, y + 0.05, 'rgba(20,12,8,0.45)'); return; }
      R(x - ww / 2 + 0.08, y0, x + ww / 2 - 0.08, y1 - 0.1, '#c9d0d2'); R(x - ww / 2 + 0.2, y0 + 0.1, x + ww / 2 - 0.2, y1 - 0.22, '#566068'); R(x - 0.05, y0, x + 0.05, y1, '#e2e2da');
      for (const s of [-1, 1]) { R(x + s * (ww / 2 + 0.1), y0, x + s * (ww / 2 + 0.55), y1, '#4c382c'); for (let y = y0 + 0.2; y < y1; y += 0.26) R(Math.min(x + s * (ww / 2 + 0.1), x + s * (ww / 2 + 0.55)), y, Math.max(x + s * (ww / 2 + 0.1), x + s * (ww / 2 + 0.55)), y + 0.05, 'rgba(18,10,6,0.45)'); }
    };
    ORXB.forEach((x, i) => {
      const mid = Math.abs(x - ORPORT) < 0.2;
      french(x, 8.5, 11.95, 1.5, i === 1 || i === 8);
      R(x - 1.35, 12.55, x + 1.35, 12.8, '#d6bc8e'); R(x - 1.35, 12.42, x + 1.35, 12.55, 'rgba(60,40,22,0.45)');
      if (mid) { poly([[x - 1.5, 12.8], [x + 1.5, 12.8], [x, 13.75]], '#d6bc8e'); poly([[x - 1.0, 12.9], [x + 1.0, 12.9], [x, 13.52]], '#a88a60'); }
      french(x, 13.85, 15.95, 1.25, i > 5 ? false : i % 3 === 0);
      if (!mid) {
        french(x, 4.85, 6.7, 1.25, i % 4 !== 3);
        if (i % 3 !== 1) { arch(x, 0, 4.2, 2.9, '#a98c60'); arch(x, 0.05, 4.1, 2.7, '#c7a56c'); } else R(x - 0.95, 2.35, x + 0.95, 4.2, '#cfb488');
        R(x - 0.72, 2.55, x + 0.72, 3.9, '#322a22'); for (let k = -0.7; k < 0.75; k += 0.28) R(x + k, 2.55, x + k + 0.045, 3.9, '#7a6a52'); for (let y = 2.85; y < 3.9; y += 0.32) R(x - 0.72, y, x + 0.72, y + 0.045, '#7a6a52');
      }
    });
    // the portal: rusticated arch, the dark door and its fan, the frieze
    const x = ORPORT;
    R(x - 3.4, 0, x + 3.4, 7.75, '#b99a6c'); R(x - 3.4, 6.65, x + 3.4, 7.75, '#c8ab7e'); for (let k = x - 3.2; k < x + 3.2; k += 0.62) { R(k, 6.85, k + 0.34, 7.45, '#9c7e56'); circ(k + 0.17, 7.15, 0.12, '#d8bd90'); }
    for (let k = 0; k <= 12; k++) { const a = k / 12 * PI; line(x + Math.cos(a) * 1.75, 4.15 + Math.sin(a) * 1.75, x + Math.cos(a) * 2.45, 4.15 + Math.sin(a) * 2.45, 0.08, '#7e6240'); }
    arch(x, 0, 5.95, 3.6, '#2e221b'); arch(x, 4.15, 5.85, 3.3, '#1e1814'); for (let k = 1; k < 8; k++) { const a = k / 8 * PI; line(x, 4.15, x + Math.cos(a) * 1.6, 4.15 + Math.sin(a) * 1.6, 0.06, '#6e5a44'); }
    R(x - 1.65, 0, x + 1.65, 4.15, '#4a342a'); R(x - 0.04, 0, x + 0.04, 4.15, '#1e130e'); for (const s of [-1, 1]) { poly([[x + s * 0.2, 2.2], [x + s * 0.85, 2.75], [x + s * 1.5, 2.2]], '#5c4234'); R(x + s * 0.2 - (s < 0 ? 1.3 : 0), 0.4, x + s * 0.2 + (s > 0 ? 1.3 : 0), 1.9, '#432f26'); }
    for (const s of [-1, 1]) R(x + s * 3.05 - 0.4, 2.0, x + s * 3.05 + 0.4, 2.55, '#4a3f30');
    streaks(g, ORPX, h, 70, 1404, 0.1, 50);
    const gb = g.createLinearGradient(0, h, 0, h - 40); gb.addColorStop(0, 'rgba(50,34,20,0.3)'); gb.addColorStop(1, 'rgba(50,34,20,0)'); g.fillStyle = gb; g.fillRect(0, h - 40, ORPX, 40);
  }
  {   // the pink wing: coursed ground storey, two floors of corniced windows, the dentil cornice and the parapet
    const p = painter(g, ORPX, 0, ORW - ORPX, h, ORPK, ORPH), { R, arch } = p;
    ground(g, ORPX, 0, ORW - ORPX, h, '#d9bba2', 1405, 0.7);
    for (let y = 0.45; y < 4.8; y += 0.46) R(0, y, ORPK, y + 0.05, 'rgba(120,80,58,0.3)');
    for (let i = 0; i < 5; i++) {
      const x = 2.4 + i * 4.55;
      if (i % 2) { arch(x, 0.2, 4.0, 1.5, '#e6cdb6'); arch(x, 0.2, 3.85, 1.2, '#493428'); } else { R(x - 0.85, 0, x + 0.85, 4.05, '#e6cdb6'); R(x - 0.65, 0, x + 0.65, 3.85, '#4c372a'); for (let y = 0.3; y < 3.7; y += 0.28) R(x - 0.65, y, x + 0.65, y + 0.05, 'rgba(20,12,8,0.45)'); }
      for (const [y0, y1] of [[5.45, 8.1], [9.35, 11.9]]) { R(x - 0.85, y0, x + 0.85, y1 + 0.2, '#e8d2bc'); R(x - 0.62, y0, x + 0.62, y1, '#4b372b'); for (let y = y0 + 0.2; y < y1; y += 0.24) R(x - 0.62, y, x + 0.62, y + 0.05, 'rgba(18,10,6,0.45)'); R(x - 0.03, y0, x + 0.03, y1, '#2a1c14'); R(x - 1.1, y1 + 0.55, x + 1.1, y1 + 0.78, '#ecd8c2'); R(x - 1.1, y1 + 0.43, x + 1.1, y1 + 0.55, 'rgba(110,70,48,0.4)'); }
    }
    R(0, 4.9, ORPK, 5.2, '#e4cbb4'); R(0, 13.3, ORPK, 13.55, 'rgba(90,55,35,0.4)'); for (let x = 0.1; x < ORPK; x += 0.5) R(x, 13.45, x + 0.24, 13.85, '#a9805a'); R(0, 13.85, ORPK, 14.6, '#c09a74'); R(0, 14.6, ORPK, ORPH, '#d4b59c');
    for (const x of [4.7, 13.8]) R(x, 0.2, x + 0.13, 13.4, '#5e4a3c');
    streaks(g, ORW, h, 20, 1406, 0.07, 50);
  }
}
function buildOrleans() {
  initShared();
  defMat('btOr', ORW, ORHP, [ORM, ORH], orAtlas);
  const P = pairsOf(OR.p), A = P[1], B = P[2], L = dist(A, B), t = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = outN(A, B, P);
  const W = (s, out = 0) => [A[0] + t[0] * s + n[0] * out, A[1] + t[1] * s + n[1] * out];   // s metres east of the west corner
  const y0 = (groundY(...W(10, 1)) + groundY(...W(26, 1)) + groundY(...W(45, 1))) / 3, rg = groundRange(P);
  begin(y0);
  skirt(P, rg.lo - 1.5, y0);
  // the three stretches of the front, drawn in so that the portal's columns stand on the footprint's line
  const E = ORM + ORPK;
  quad('btOr', W(0, -0.3), W(ORM, -0.3), y0, y0 + ORH, 0, ORPX / ORW, 0, 1, n);
  const F = edgeFrame(W(0), W(ORM), y0, n), X = s => ORM / 2 - s;   // local x of the point s metres east of the west end (+x is to the west, seen from the front)
  quad('btOr', W(ORM, -0.22), W(E, -0.22), y0, y0 + ORPH, ORPX / ORW, 1, 0, 1, n);
  // behind the front: the body in plain stone, the end block lower
  const mainPlan = inset([W(0), W(ORM), [-778.4, 663.7], [-778.0, 676.1], [-786.9, 676.7], [-787.8, 663.8], [-814.3, 665.6], [-814.1, 667.3], P[0]], 0.24);
  mainPlan.splice(0, 2, W(0.24, -0.55), W(ORM, -0.55));   // behind the painted front
  prism('flat', mainPlan, y0 - 1.5, y0 + 17.1, { c: '#bd9f72' });
  const pink = insetE([W(ORM), W(E), [-755.2, 662.2], [-778.4, 663.7]], [0.5, 0.24, 0.24, 0.24]);
  prism('flat', pink, y0 - 1.5, y0 + 14.4, { c: '#cfb096' });
  const endPl = inset([W(E), W(L), P[3], [-755.2, 662.2]], 0.3);
  prism('flat', endPl, y0 - 1.5, y0 + 8.8, { c: '#d6baa2' });
  band(W(E), W(L), n, y0 + 8.8, y0 + 9.1, -0.7, 0.1, '#e4ceb6', 0.1); balusRow(W(E, -0.35), W(L, -0.35), n, y0 + 9.1);
  for (let s = E + 1.8; s < L - 1; s += 3.2) { const c = W(s, -0.28), M = frame(c[0], y0, c[1], n[0], n[1]); for (const [yb, hh] of [[0.2, 3.4], [4.8, 3.2]]) { extrude('flat', archShape(1.9, hh + 0.25), 0.05, { cs: 5, M, p: [0, yb - 0.05, -0.04], c: '#ead8c2', noao: true }); extrude('flat', archShape(1.45, hh), 0.05, { cs: 5, M, p: [0, yb, 0.0], c: '#4a382c', noao: true }); } }
  hip([W(0.4, -0.9), W(ORM - 0.3, -0.9), [-779, 662.4], [-826.2, 665.2]], y0 + 17.1, 1.9, '#d9a184', 0);
  hip([W(ORM + 0.3, -0.9), W(E - 0.3, -0.9), [-755.6, 661.2], [-777.8, 662.6]], y0 + 14.4, 1.5, '#d9a184', 0);
  for (const [a, b, hh] of [[0, ORM, 18.4], [ORM, E, 15.6]]) { band(W(a), W(b), n, y0 + hh - 1.35, y0 + hh - 1.0, -0.65, -0.1, a ? '#c09a74' : '#cdb084'); band(W(a), W(b), n, y0 + hh - 0.25, y0 + hh, -0.75, -0.3, a ? '#dcc0a6' : '#d4bc90'); railRow(W(a, -0.5), W(b, -0.5), n, y0 + hh, 0.8); }
  // balconies of the main front: slabs on brackets with iron rails
  const bal = (x, y, hw, out) => { bx('flat', F, x - hw, x + hw, y - 0.2, y, -0.35, -0.3 + out, { c: '#b89c74', noao: true }); for (const s of [-1, 1]) { bx('flat', F, x + s * (hw - 0.3) - 0.12, x + s * (hw - 0.3) + 0.12, y - 0.6, y - 0.2, -0.35, -0.3 + out * 0.6, { c: '#9c8260', noao: true }); panel('rail', out, 0.98, { M: mul(F, tr(x + s * hw, y, -0.3 + out / 2)), ry: PI / 2, uvk: [out, 1] }); } panel('rail', hw * 2, 0.98, { M: F, p: [x, y, -0.3 + out], uvk: [hw * 2, 1] }); };
  ORB.forEach((s) => { const x = X(s), mid = Math.abs(s - 26.0) < 0.2; bal(x, 13.85, 1.15, 0.6); if (!mid) { bal(x, 8.5, 1.4, 0.75); bal(x, 4.85, 1.1, 0.55); } });
  // the central balcony on its entablature, the columns of the portal, three flags
  const px = X(26.0);
  bx('flat', F, px - 3.7, px + 3.7, 7.55, 8.2, -0.35, 0.1, { c: '#c2a578', noao: true }); bal(px, 8.5, 4.3, 0.9); bx('flat', F, px - 4.35, px + 4.35, 8.2, 8.35, -0.35, 0.55, { c: '#b89c74', noao: true });
  for (const s of [-1, 1]) { const x = px + s * 2.7; bx('flat', F, x - 0.55, x + 0.55, 0, 1.75, -0.35, 0.1, { c: '#d6cdb8' }); cyl('flat', 0.36, 0.44, 5.35, 9, { M: F, p: [x, 1.75, -0.34], c: '#bc9c6c', open: true }); bx('flat', F, x - 0.55, x + 0.55, 7.1, 7.55, -0.35, 0.1, { c: '#cdb084', noao: true }); }
  for (const [dx, cols] of [[-2.9, ['#2b4a9a', '#2b4a9a', '#2b4a9a']], [0, ['#2f8a4a', '#e8e6de', '#c0382c']], [2.9, ['#c8382c', '#e2b02c', '#e2b02c']]]) {
    const M = mul(F, tr(px + dx, 9.3, 0.5)), tilt = 0.75;
    box('flat', 0.07, 3.1, 0.07, { M, p: [0, 0, 0], rx: tilt, c: '#cfcabc', noao: true });
    cols.forEach((c, i) => slab(M, [[0.05 + i * 0.4, 2.2 - i * 0.12], [0.05 + (i + 1) * 0.4, 2.08 - i * 0.12], [0.05 + (i + 1) * 0.4, 0.95 - i * 0.12], [0.05 + i * 0.4, 1.07 - i * 0.12]], 1.55 + i * 0.01, 1.6 + i * 0.01, c));
  }
  // in front: the two guard boxes, the stone balls on their chains, the two fountains
  for (const s of [-1, 1]) { const c = W(26.0 + s * 4.6, 1.6), gy = groundY(c[0], c[1]) - y0, M = frame(c[0], y0 + gy, c[1], n[0], n[1]); cyl('flat', 0.9, 0.98, 0.3, 10, { M, c: '#d6cfc0' }); cyl('flat', 0.78, 0.82, 2.6, 10, { M, p: [0, 0.3, 0], c: '#e4cfbc' }); cyl('flat', 0.95, 0.95, 0.24, 10, { M, p: [0, 2.9, 0], c: '#efeae0', noao: true }); sphere('flat', 0.82, { M, p: [0, 3.1, 0], ky: 0.75, seg: 10, c: '#ece8de', noao: true }); bx('flat', M, -0.36, 0.36, 0.3, 2.35, 0.7, 0.84, { c: '#2e2822' }); }
  for (const [s0, s1] of ORBALLS) {
    const k = Math.max(1, Math.round((s1 - s0) / 3.3));
    for (let i = 0; i <= k; i++) {
      const s = s0 + (s1 - s0) * i / k, c = W(s, ORBZ), gy = groundY(c[0], c[1]);
      sphere('flat', 0.42, { p: [c[0], gy + 0.36, c[1]], seg: 8, c: '#ece9e0', noao: true });
      if (i < k) { const d = W(s + (s1 - s0) / k, ORBZ), m = lerp(c, d, 0.5), l = dist(c, d), ey = (gy + groundY(d[0], d[1])) / 2; box('flat', l, 0.05, 0.05, { p: [m[0], ey + 0.42, m[1]], ry: Math.atan2(-(d[1] - c[1]), d[0] - c[0]), c: '#34322e', noao: true }); }
    }
  }
  for (const s of ORFOUNT) { const c = W(s, 2.5), gy = groundY(c[0], c[1]); cyl('flat', 1.55, 1.65, 0.55, 12, { p: [c[0], gy - 0.05, c[1]], c: '#cfc6b2' }); cyl('flat', 1.35, 1.35, 0.06, 12, { p: [c[0], gy + 0.5, c[1]], c: '#6f8a86', noao: true }); cyl('flat', 0.22, 0.34, 1.35, 8, { p: [c[0], gy + 0.45, c[1]], c: '#d6cebb' }); cyl('flat', 0.8, 0.25, 0.32, 10, { p: [c[0], gy + 1.75, c[1]], c: '#ddd6c4', noao: true }); cone('flat', 0.14, 0.7, 6, { p: [c[0], gy + 2.05, c[1]], c: '#dfe8ea', noao: true }); }
  const o = end("Palazzo d'Orleans");
  o.userData.solids = [[OR.p, null, y0 + 8.8]];
  return o;
}
const ORBZ = 4.7, ORBALLS = [[1.0, 18.5], [33.5, 64.0]], ORFOUNT = [9.2, 43.0];
const orW = (s, out) => { const t = [82.6 / 82.8, -5.7 / 82.8]; return [-827.7 + t[0] * s - 0.0688 * out, 653.4 + t[1] * s - 0.9976 * out]; };
const orRing = (s, out, rx) => { const P = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * 2 * PI; P.push(orW(s + Math.cos(a) * rx, out + Math.sin(a) * rx)); } return chainW(P); };
// (the stone balls and their chains: a wall along each side of the line, closed at the ends)
const orWalls = [...ORBALLS.flatMap(([a0, b0]) => { const a = a0 - 0.45, b = b0 + 0.45; return chainW([orW(a, ORBZ - 0.4), orW(a, ORBZ + 0.4), orW(b, ORBZ + 0.4), orW(b, ORBZ - 0.4), orW(a, ORBZ - 0.4)]); }), ...[-1, 1].flatMap(s => orRing(26.0 + s * 4.6, 1.6, 0.95)), ...ORFOUNT.flatMap(s => orRing(s, 2.5, 1.65))];
// a row of balusters or of roof railing between two points
function balusRow(a, b, n, y) { const M = edgeFrame(a, b, y, n), l = dist(a, b); panel('rail', l, 0.9, { M, uvk: [l, 1] }); }
function railRow(a, b, n, y, h) { const M = edgeFrame(a, b, y, n), l = dist(a, b); panel('rail', l, h, { M, uvk: [l / 2.2, 1] }); }

// =====================================================================================================
// San Giovanni dei Lebbrosi
// =====================================================================================================
const LB = { id: 'w42414083', p: [1653.2, 1336.7, 1671.7, 1317.3, 1678.5, 1324.6, 1674.6, 1328.8, 1661.0, 1343.2, 1655.3, 1338.3] };
const LBO = [1657.15, 1339.95], LBN = [-0.69, 0.724], LBEND = -26.6;
const LBAPSE = [[0, 2.3], [-3.5, 1.45], [3.5, 1.45]];
const lbWalls = LBAPSE.flatMap(([x, r]) => localW(LBO, LBN, arcPts(x, LBEND, r + 0.05, 6, -PI, 0)));
function lbStone(g, w, h) { paintAshlar(g, w, h, 4, 4, 0.36, 0.72, '#c9ac80', '#96805c', 1501, 1.3, 0.13); const r = RNG(1502); for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.6 ? 'rgba(70,56,40,0.16)' : 'rgba(240,225,195,0.14)'; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 11, 1 + r() * 6, 0, 0, 7); g.fill(); } }
function lbGrey(g, w, h) { paintAshlar(g, w, h, 4, 4, 0.36, 0.72, '#a29d92', '#716c62', 1503, 1.3, 0.15); const r = RNG(1504); for (let i = 0; i < 110; i++) { g.fillStyle = r() < 0.55 ? 'rgba(52,50,44,0.2)' : r() < 0.8 ? 'rgba(220,214,198,0.16)' : 'rgba(150,112,76,0.16)'; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 13, 1 + r() * 8, 0, 0, 7); g.fill(); } }
function buildLebbrosi() {
  initShared();
  defMat('btLb', 256, 256, [4, 4], lbStone);
  defMat('btLbG', 256, 256, [4, 4], lbGrey);
  const y0 = (groundY(...LBO) + groundY(1672, 1322)) / 2;
  begin(y0);
  const F = frame(LBO[0], y0, LBO[1], LBN[0], LBN[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  const GREY = '#f2f2ee', RED = '#a96a60', ROOF = '#f6d2ae', PINK = '#c4968c';
  const block = (x0, x1, y1, z0, z1, c, k = 'btLb') => bx(k, F, x0, x1, -1.2, y1, z0, z1, { c });
  const ledge = (x0, x1, y, z0, z1, c = '#b9a280') => bx('flat', F, x0 - 0.12, x1 + 0.12, y, y + 0.2, z0 - 0.12, z1 + 0.12, { c, noao: true });
  // an arched opening with stepped orders on the face M (z = 0 is the wall)
  const arched = (M, x, yb, hh, w, o = {}) => {
    const orders = o.orders === undefined ? 1 : o.orders;
    for (let k = orders; k >= 1; k--) extrude('flat', archShape(w + 0.34 * k, hh + 0.17 * k), 0.03, { cs: 6, M, p: [x, yb, (orders - k) * 0.025], c: k % 2 ? '#8c765a' : '#c4a880', noao: true });
    extrude('flat', archShape(w, hh), 0.03, { cs: 6, M, p: [x, yb, orders * 0.025], c: o.c || '#241c16', noao: true });
  };
  const lattice = (M, x, yb, hh, w) => { arched(M, x, yb, hh, w, { c: '#d8d2c2' }); for (let y = yb + 0.18; y < yb + hh - 0.2; y += 0.26) for (let dx = -w / 2 + 0.16; dx < w / 2 - 0.08; dx += 0.22) bx('flat', M, x + dx - 0.055, x + dx + 0.055, y, y + 0.13, 0.04, 0.065, { c: '#3a332a', noao: true }); };
  // the tower porch, the lower block beside it, the belfry and its red dome
  block(-5.1, 2.35, 9.4, -4.6, -0.14, '#ffffff'); ledge(-5.1, 2.35, 9.35, -4.6, -0.2);
  block(2.35, 5.1, 6.0, -4.4, -0.3, '#f4eee2'); ledge(2.35, 5.0, 5.9, -4.4, -0.3);
  const BX0 = -1.65, BX1 = 2.35;
  bx('btLb', F, BX0, BX1, 9.4, 14.8, -4.1, -0.14, { c: '#fff6ea' }); ledge(BX0, BX1, 14.65, -4.1, -0.14);
  bx('flat', F, -4.9, BX0 - 0.1, 9.55, 9.62, -4.4, -0.4, { c: PINK, noao: true });
  const front = at(0, 0, -0.12);
  arched(front, 0.4, 0, 5.4, 2.15, { orders: 1, c: '#2a201a' }); extrude('flat', archShape(1.5, 3.3), 0.03, { cs: 6, M: front, p: [0.4, 0, 0.06], c: '#573a28', noao: true }); bx('flat', front, 0.37, 0.43, 0, 3.2, 0.09, 0.11, { c: '#1e140e', noao: true });
  arched(front, 0.45, 6.55, 1.2, 0.55); bx('flat', front, -3.85, -3.7, 3.7, 4.95, 0.0, 0.04, { c: '#241c16', noao: true });
  for (const [px, pz, ry] of [[(BX0 + BX1) / 2, -0.12, 0], [(BX0 + BX1) / 2, -4.12, PI], [BX0 - 0.02, -2.1, -PI / 2], [BX1 + 0.02, -2.1, PI / 2]]) { const M = mul(at(px, 0, pz), rotY(ry)); arched(M, 0, 10.7, 3.15, 1.15, { orders: 3 }); bx('flat', M, -0.58, 0.58, 11.55, 11.65, 0.08, 0.13, { c: '#5a4a38', noao: true }); }
  cyl('flat', 0.14, 0.3, 0.45, 7, { M: at((BX0 + BX1) / 2, 11.05, -0.05), c: '#3a3428', noao: true });
  const dome = (x, z, y, r, drum) => { cyl('flat', r, r + 0.05, drum, 14, { M: at(x, y, z), c: RED }); part('flat', new THREE.SphereGeometry(r, 14, 5, 0, 2 * PI, 0, PI / 2), { M: at(x, y + drum, z), s: [1, 1.05, 1], c: RED, noao: true }); };
  dome((BX0 + BX1) / 2, -2.1, 14.85, 1.55, 0.45);
  // nave and aisles
  const NZ0 = -4.6, NZ1 = -19.6;
  block(-5.05, 5.05, 6.3, NZ1, NZ0, '#ffffff', 'btLbG'); bx('btLb', F, -2.7, 2.7, 6.3, 8.55, NZ1, NZ0, { c: '#e8e0d0' });
  const V = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(F); return [v.x, v.y, v.z]; };
  for (const s of [-1, 1]) {
    tris('tile', [[V(s * 5.25, 6.3, NZ0), V(s * 5.25, 6.3, NZ1), V(s * 2.65, 7.55, NZ1)], [V(s * 5.25, 6.3, NZ0), V(s * 2.65, 7.55, NZ1), V(s * 2.65, 7.55, NZ0)]], ROOF);
    tris('tile', [[V(s * 2.95, 8.5, NZ0), V(s * 2.95, 8.5, NZ1), V(0, 10.05, NZ1)], [V(s * 2.95, 8.5, NZ0), V(0, 10.05, NZ1), V(0, 10.05, NZ0)]], '#fadcbc');
    for (const z of [-6.6, -9.8, -13.0, -16.2]) { const M = mul(at(s * 2.72, 0, z), rotY(s * PI / 2)); disc(M, 0, 7.98, 0, 0.26, 0.04, '#3a3128'); }
  }
  for (const z of [NZ0 + 0.02, NZ1 - 0.02]) { extrude('btLb', shapeOf([[-2.7, 8.5], [2.7, 8.5], [0, 9.95]]), 0.08, { M: F, p: [0, 0, z - 0.04], c: '#e8e0d0', noao: true }); }
  // the presbytery, its roof, the drum and the great dome
  block(-5.1, 4.88, 8.35, LBEND + 0.25, NZ1, '#f4f4f0', 'btLbG'); ledge(-5.0, 4.8, 8.3, LBEND + 0.35, NZ1, '#b7a894');
  bx('flat', F, -4.85, 4.85, 8.5, 8.56, LBEND + 0.25, NZ1 - 0.2, { c: PINK, noao: true });
  bx('flat', F, -2.5, 2.5, 8.5, 10.15, -25.6, -20.6, { c: '#bfa396' }); ledge(-2.5, 2.5, 10.05, -25.6, -20.6, '#ab8c80'); dome(0, -23.1, 10.25, 2.25, 0.5);
  disc(mul(at(0, 0, -23.1), rotY(-PI / 2)), 0, 10.95, 2.18, 0.28, 0.1, '#d9d0c0'); disc(mul(at(0, 0, -23.1), rotY(PI / 2)), 0, 10.95, 2.18, 0.28, 0.1, '#d9d0c0');
  // the three apses
  for (const [x, r] of LBAPSE) {
    const M = mul(at(x, 0, LBEND), rotY(PI)), hh = r > 2 ? 7.7 : 6.9;
    halfDrum('btLbG', M, r, -1.2, hh, { c: GREY, cap: '#8d857a', dome: 0.28, seg: 12 });
    cyl('flat', r + 0.12, r + 0.12, 0.2, 12, { M, p: [0, hh - 0.15, 0], t0: -PI / 2, tl: PI, open: true, c: '#9c9488', noao: true });
    lattice(mul(M, tr(0, 0, r - 0.02)), 0, hh - 3.4, 1.9, r > 2 ? 0.95 : 0.65);
  }
  // north flank (-x): the lattice windows and the side door
  const NM = mul(at(-5.07, 0, 0), rotY(-PI / 2)), PM = mul(at(-5.12, 0, 0), rotY(-PI / 2));   // the faces of the nave and of the presbytery; on them local x runs with the frame's z
  for (const z of [-6.9, -10.3, -13.7, -17.1]) lattice(NM, z, 3.4, 1.85, 0.8);
  lattice(PM, -23.4, 4.6, 1.85, 0.8); arched(PM, -21.4, 0, 2.7, 1.2);
  const o = end('Chiesa di San Giovanni dei Lebbrosi');
  o.userData.solids = [[LB.p, null, y0 + 6.0]];
  return o;
}

// =====================================================================================================
// San Ciro a Maredolce
// =====================================================================================================
const SC = { id: 'w80840224', p: [2150.0, 2998.8, 2149.0, 3020.4, 2154.9, 3021.2, 2156.9, 3024.8, 2160.5, 3026.3, 2163.1, 3024.4, 2164.5, 3021.0, 2170.7, 3021.6, 2169.6, 2999.7] };
const SCFW = 19.6, SCFH = 19.8;
const SC_OUT = [[-9.8, -1.5], [9.8, -1.5], [9.8, 10.7], [8.1, 10.75], [6.7, 11.4], [5.6, 12.7], [5.0, 14.6], [5.0, 16.5], [0, 19.35], [-5.0, 16.5], [-5.0, 14.6], [-5.6, 12.7], [-6.7, 11.4], [-8.1, 10.75], [-9.8, 10.7]];
function scFront(g, w, h) {
  const p = painter(g, 0, 0, w, h, SCFW, SCFH), { R, arch, poly, circ, line } = p, C = SCFW / 2, r = RNG(1601);
  ground(g, 0, 0, w, h, '#d3b490', 1602, 1.7);
  for (let i = 0; i < 46; i++) { const x = r() * SCFW, y = r() * 16, s = 0.25 + r() * 0.9; g.fillStyle = r() < 0.55 ? 'rgba(238,230,214,0.75)' : 'rgba(170,112,60,0.4)'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * PI, rr = s * (0.5 + r() * 0.8); k ? g.lineTo(p.X(x + Math.cos(a) * rr * 0.7), p.Y(y + Math.sin(a) * rr)) : g.moveTo(p.X(x + rr * 0.7), p.Y(y)); } g.fill(); }
  // rough masonry on the west third (right of the picture)
  for (let y = 0; y < 10.2; y += 0.5) for (let x = 14.6 + r() * 0.5; x < SCFW - 0.2; x += 0.55 + r() * 0.35) R(x, y + 0.05, x + 0.35 + r() * 0.28, y + 0.42, ['#b8a284', '#cdbb9c', '#a58e70', '#d8c8aa'][(r() * 4) | 0]);
  // ochre pilaster strips, the two cornices
  for (const x of [0.3, 6.3, 12.6]) { R(x, 0, x + 0.75, 10.0, 'rgba(178,118,62,0.55)'); R(x + 0.75, 0, x + 0.86, 10.0, 'rgba(70,45,25,0.35)'); }
  for (const x of [C - 4.8, C + 4.05]) R(x, 10.7, x + 0.75, 16.2, 'rgba(188,134,80,0.55)');
  R(0, 9.85, SCFW, 10.05, 'rgba(60,40,22,0.5)'); R(0, 10.05, SCFW, 10.65, '#b79c78'); R(0, 10.5, SCFW, 10.65, '#d8c8aa');
  R(C - 5.1, 15.95, C + 5.1, 16.1, 'rgba(60,40,22,0.5)'); R(C - 5.1, 16.1, C + 5.1, 16.55, '#b49872');
  poly([[C - 4.2, 16.7], [C + 4.2, 16.7], [C, 18.95]], '#cdb494'); circ(C, 17.5, 0.55, '#e4dac6'); circ(C - 0.5, 17.2, 0.25, '#d8cab0'); circ(C + 0.55, 17.25, 0.28, '#d8cab0');
  // the half round window in three lights
  arch(C, 10.7, 14.75, 6.0, '#a98a66'); arch(C, 11.1, 14.45, 5.35, '#2f3638'); for (const x of [C - 1.2, C + 1.2]) R(x - 0.19, 11.1, x + 0.19, 14.35, '#c4aa86');
  R(C - 0.05, 11.1, C + 0.05, 14.4, '#75807c'); for (let y = 11.8; y < 14; y += 0.75) R(C - 1.0, y, C + 1.0, y + 0.07, '#75807c'); R(C - 3.1, 10.85, C + 3.1, 11.12, '#bda27e');
  // small windows: a tall one over an arched one on each side
  for (const x of [5.0, 15.7]) { R(x - 0.75, 4.9, x + 0.75, 8.3, '#b2936e'); R(x - 0.53, 5.1, x + 0.53, 8.05, '#26302f'); R(x - 0.04, 5.1, x + 0.04, 8.05, '#4a5a56'); arch(x, 1.45, 4.15, 1.55, '#b2936e'); arch(x, 1.65, 3.95, 1.15, '#2a2622'); for (let k = x - 0.5; k < x + 0.55; k += 0.24) line(k, 1.65, k, 3.8, 0.045, '#8a7a62'); for (let y = 1.9; y < 3.6; y += 0.28) line(x - 0.55, y, x + 0.55, y, 0.045, '#8a7a62'); }
  // the door, its frame and the curved pediment
  R(C - 2.2, 0, C + 2.2, 6.0, '#bf9c74'); R(C - 2.35, 6.0, C + 2.35, 6.35, '#d2bc98'); g.strokeStyle = '#c9ae88'; g.lineWidth = 0.4 * p.sx; g.beginPath(); g.ellipse(p.X(C), p.Y(6.5), 2.0 * p.sx, 1.55 * p.sy, 0, PI, 0); g.stroke(); circ(C, 6.95, 0.42, '#a88862'); R(C - 2.3, 6.4, C + 2.3, 6.6, '#d8c4a0');
  R(C - 1.45, 0, C + 1.45, 4.8, '#d4c09c'); R(C - 1.07, 0, C + 1.07, 4.4, '#3b2c20'); for (let y = 0.55; y < 4.3; y += 0.65) R(C - 1.07, y, C + 1.07, y + 0.08, '#6e563c'); for (const x of [C - 0.55, C, C + 0.55]) R(x - 0.04, 0, x + 0.04, 4.4, '#6e563c'); R(C - 0.9, 0, C + 0.15, 2.0, '#150f0b');
  streaks(g, w, h, 90, 1603, 0.2, 70, '90,56,30');
  const gb = g.createLinearGradient(0, h, 0, h - 50); gb.addColorStop(0, 'rgba(50,36,22,0.4)'); gb.addColorStop(1, 'rgba(50,36,22,0)'); g.fillStyle = gb; g.fillRect(0, h - 50, w, 50);
}
function scSide(g, w, h) { paintAshlar(g, w, h, 4, 4, 0.5, 0.8, '#d6b892', '#c0a078', 1611, 1, 0.09); const r = RNG(1612); for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? 'rgba(240,230,212,0.4)' : 'rgba(150,98,52,0.28)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 22, 3 + r() * 14, r() * 3, 0, 7); g.fill(); } }
function buildSanCiro() {
  initShared();
  defMat('btSc', 320, 320, [SCFW, SCFH], scFront);
  defMat('btScWall', 128, 128, [4, 4], scSide);
  const P = pairsOf(SC.p), O = [2159.8, 2999.25], N = [0.046, -0.999], y0 = Math.min(groundY(2152, 2998), groundY(2160, 2998), groundY(2168, 2998));
  begin(y0);
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z)), PINK = '#e6c4b0', STONE = '#cbb89a';
  extrude('btSc', shapeOf(SC_OUT), 0.4, { M: F, p: [0, 0, -0.55], uv: 'keep', uvk: [1 / SCFW, 1 / SCFH], uvo: [0.5, 0], noao: true });
  // cornices that stand out, the urns and the cross
  const urn = (x, y) => { cyl('flat', 0.22, 0.3, 0.35, 7, { M: at(x, y, -0.35), c: STONE, noao: true }); sphere('flat', 0.36, { M: at(x, y + 0.7, -0.35), ky: 1.15, seg: 7, c: STONE, noao: true }); cone('flat', 0.2, 0.55, 6, { M: at(x, y + 1.0, -0.35), c: '#bfa988', noao: true }); };
  bx('flat', F, -9.85, 9.85, 10.15, 10.4, -0.2, 0.03, { c: '#bda482', noao: true }); bx('flat', F, -5.2, 5.2, 16.15, 16.42, -0.2, 0.05, { c: '#bda482', noao: true });
  const rl = Math.hypot(5.0, 2.85); for (const s of [-1, 1]) { box('flat', rl + 0.15, 0.26, 0.55, { M: F, p: [s * 2.5, 17.8, -0.3], rz: -s * Math.atan2(2.85, 5.0), c: '#b39a78', noao: true }); urn(s * 4.75, 16.95); urn(s * 3.65, 17.55); bx('flat', F, s * 4.75 - 0.26, s * 4.75 + 0.26, 16.4, 16.97, -0.6, -0.1, { c: STONE, noao: true }); bx('flat', F, s * 3.65 - 0.24, s * 3.65 + 0.24, 17.0, 17.57, -0.6, -0.1, { c: STONE, noao: true }); }
  urn(-9.45, 10.7); bx('flat', F, -0.04, 0.04, 19.3, 20.7, -0.37, -0.29, { c: '#3a342c', noao: true }); bx('flat', F, -0.42, 0.42, 20.15, 20.23, -0.37, -0.29, { c: '#3a342c', noao: true });
  bx('flat', F, -2.4, 2.4, 6.15, 6.35, -0.2, 0.06, { c: '#d2bc98', noao: true }); for (const s of [-1, 1]) bx('flat', F, s * 1.85 - 0.24, s * 1.85 + 0.24, 0, 6.1, -0.2, -0.03, { c: '#c4a47c' });
  // the nave: pink upper walls, tiled gable
  const NW = 4.85, NZ = -17.8;
  bx('flat', F, -NW, NW, -1.5, 15.0, NZ, -0.55, { c: PINK });
  const V = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(F); return [v.x, v.y, v.z]; };
  for (const s of [-1, 1]) {
    tris('tile', [[V(s * (NW + 0.35), 15.0, -0.55), V(s * (NW + 0.35), 15.0, NZ - 0.2), V(0, 17.3, NZ - 0.2)], [V(s * (NW + 0.35), 15.0, -0.55), V(0, 17.3, NZ - 0.2), V(0, 17.3, -0.55)]], '#e2a888');
    bx('flat', F, s * (NW + 0.16) - 0.17, s * (NW + 0.16) + 0.17, 14.85, 15.05, NZ, -0.55, { c: '#b86e50', noao: true });
    for (const z of [-3.6, -15.2]) { const M = mul(at(s * (NW + 0.02), 0, z), rotY(s * PI / 2)); extrude('flat', archShape(1.5, 2.3), 0.05, { cs: 5, M, p: [0, 11.2, -0.03], c: '#d29a84', noao: true }); extrude('flat', archShape(1.0, 1.95), 0.05, { cs: 5, M, p: [0, 11.3, 0], c: '#35413c', noao: true }); }
  }
  extrude('flat', shapeOf([[-NW, 15.0], [NW, 15.0], [0, 17.25]]), 0.2, { M: F, p: [0, 0, NZ], c: PINK, noao: true });
  // the side parts under their sloping roofs, the drums of the cross arm with windows and tiled caps
  for (const s of [-1, 1]) {
    const x0 = s * NW, x1 = s * (s < 0 ? 9.75 : 9.7);
    bx('btScWall', F, Math.min(x0, x1), Math.max(x0, x1), 8.4, 9.2, -17.6, -0.55, { c: '#ffffff' });
    tris('tile', [[V(x1 + s * 0.15, 9.2, -0.7), V(x1 + s * 0.15, 9.2, -17.6), V(x0, 10.4, -17.6)], [V(x1 + s * 0.15, 9.2, -0.7), V(x0, 10.4, -17.6), V(x0, 10.4, -0.7)]], '#d99c80');
    extrude('btScWall', shapeOf([[0, 9.2], [x1 - x0, 9.2], [0, 10.4]]), 0.2, { M: at(x0, 0, -0.75), c: '#ffffff' });
    const M = mul(at(s * 5.0, 0, -10.2), rotY(s * PI / 2));
    halfDrum('flat', M, 4.35, 9.0, 13.5, { c: PINK, cap: '#d9946e', rise: 1.25, ov: 0.3, seg: 10, capKey: 'tile' });
    cyl('flat', 4.5, 4.5, 0.2, 10, { M, p: [0, 13.35, 0], t0: -PI / 2, tl: PI, open: true, c: '#b86e50', noao: true });
    for (const a of [-0.95, 0, 0.95]) { const W2 = mul(M, rotY(a)); extrude('flat', archShape(1.15, 2.25), 0.06, { cs: 5, M: W2, p: [0, 10.5, 4.24], c: '#d29a84', noao: true }); extrude('flat', archShape(0.75, 1.95), 0.06, { cs: 5, M: W2, p: [0, 10.6, 4.29], c: '#35413c', noao: true }); }
    // the one arched window low on each flank
    // (the footprint's side wall at 5.2 m back)
    const E = mul(at(s < 0 ? -10.3 : 9.82, 0, -5.2), rotY(s * PI / 2 + (s < 0 ? 0.095 : 0))); extrude('flat', archShape(1.55, 2.5), 0.05, { cs: 5, M: E, p: [0, 2.4, -0.03], c: '#c4a47c', noao: true }); extrude('flat', archShape(1.05, 2.15), 0.05, { cs: 5, M: E, p: [0, 2.5, 0.0], c: '#2c2a24', noao: true });
  }
  // the lower walls on the footprint, from just behind the front; the apse over their roof
  const low = P.map(q => { const dx = q[0] - O[0], dz = q[1] - O[1]; return dx * N[0] + dz * N[1] > -0.55 ? [q[0] - N[0] * 0.6, q[1] - N[1] * 0.6] : q; });
  prism('btScWall', low, y0 - 1.5, y0 + 8.4, { c: '#f6f0e4' }); flatRoof(inset(low, 0.1), y0 + 8.4, '#b89a80');
  halfDrum('btScWall', mul(at(0, 0, -21.4), rotY(PI)), 4.1, 8.4, 11.0, { c: '#ffffff', cap: '#c9a08a', rise: 1.7, ov: 0.2, seg: 10, capKey: 'tile' });
  bx('flat', F, -4.1, 4.1, 8.4, 11.0, -21.4, -17.6, { c: '#d9bca4' });
  const o = end('Chiesa di San Ciro a Maredolce');
  o.userData.solids = [[SC.p, null, y0 + 8.4]];
  return o;
}

// =====================================================================================================
// Abbazia di San Martino delle Scale
// =====================================================================================================
const SM = {
  id: 'r449394.0',
  p: [-9425.8, 2727.2, -9423.2, 2734.5, -9429.4, 2736.9, -9423.9, 2750.9, -9420.7, 2756.2, -9429.3, 2790.0, -9422.7, 2794.8, -9423.8, 2801.0, -9408.4, 2800.2, -9362.7, 2796.6, -9326.2, 2784.7, -9324.5, 2791.7, -9307.2, 2786.3, -9310.9, 2768.0, -9318.4, 2769.3, -9326.9, 2733.4, -9289.0, 2723.5, -9275.8, 2779.9, -9264.4, 2777.5, -9274.0, 2733.4, -9268.3, 2731.2, -9277.7, 2692.2, -9285.1, 2691.4, -9296.7, 2648.9, -9304.4, 2648.9, -9307.0, 2641.1, -9338.7, 2649.8, -9347.0, 2620.7, -9314.8, 2611.6, -9319.1, 2598.0, -9348.9, 2606.1, -9352.9, 2592.3, -9360.1, 2594.4, -9358.8, 2600.6, -9372.0, 2604.9, -9369.1, 2614.8, -9359.9, 2612.2, -9348.9, 2653.0, -9359.2, 2655.5, -9359.2, 2663.2, -9391.3, 2664.3, -9390.7, 2659.2, -9402.0, 2659.6, -9402.2, 2650.8, -9413.4, 2651.3, -9413.3, 2700.8, -9416.8, 2703.7, -9415.1, 2724.4],
  h: [[-9399.4, 2679.9, -9400.2, 2699.3, -9380.4, 2699.3, -9380.8, 2680.3], [-9374.5, 2693.8, -9374.3, 2703.0, -9372.7, 2703.7, -9369.7, 2727.7, -9346.8, 2722.0, -9355.2, 2689.1], [-9347.7, 2662.4, -9331.7, 2722.3, -9293.8, 2712.2, -9303.7, 2675.6, -9305.2, 2676.0, -9308.4, 2664.2, -9306.1, 2663.6, -9309.2, 2652.2], [-9370.7, 2748.5, -9362.0, 2781.7, -9329.1, 2773.2, -9337.8, 2740.0], [-9385.7, 2733.2, -9376.3, 2794.4, -9406.9, 2798.6, -9407.8, 2787.4, -9419.1, 2787.4, -9413.0, 2760.8, -9409.7, 2774.8, -9385.3, 2770.1, -9391.4, 2733.2]],
};
// the ranges: four corners, eaves level (game metres), roof rise (0: flat terrace)
const SMR = [
  // the east wing
  { q: [[-9304.4, 2648.9], [-9296.7, 2648.9], [-9282.5, 2701], [-9298.5, 2694]], top: 546.5, east: 1 },
  { q: [[-9298.8, 2692.4], [-9277.7, 2692.2], [-9268.5, 2731.0], [-9291.5, 2721.8]], top: 548.0, east: 1 },
  { q: [[-9289.0, 2723.5], [-9274.2, 2731.8], [-9264.6, 2777.4], [-9275.8, 2779.9]], top: 546.5, east: 1 },
  // round the courts
  { q: [[-9331.7, 2722.3], [-9292, 2711.6], [-9289.2, 2723.3], [-9327, 2733.2]], top: 544.5, rise: 2.6 },
  { q: [[-9359.2, 2655.6], [-9349.6, 2655.3], [-9331.9, 2721.9], [-9345.6, 2726.0]], top: 543.0, rise: 2.8 },
  { q: [[-9375.5, 2664.2], [-9357.5, 2663.8], [-9354.8, 2689.4], [-9374.5, 2693.6]], top: 542.0, rise: 2.8 },
  { q: [[-9386.0, 2699.5], [-9373.4, 2699.5], [-9370.0, 2730.0], [-9385.8, 2733.2]], top: 545.0, rise: 2.6 },
  { q: [[-9371.0, 2727.9], [-9346.8, 2722.2], [-9337.9, 2739.9], [-9371.0, 2748.4]], top: 546.0, rise: 3.0 },
  { q: [[-9339.5, 2736.0], [-9326.9, 2733.4], [-9318.4, 2769.3], [-9330.5, 2773.4]], top: 546.0, rise: 2.6 },
  { q: [[-9363.0, 2781.6], [-9328.5, 2772.5], [-9326.2, 2784.7], [-9362.7, 2796.6]], top: 548.0, rise: 2.6 },
  { q: [[-9329.5, 2771.5], [-9311.2, 2768.2], [-9307.4, 2786.2], [-9324.8, 2791.4]], top: 549.0, rise: 3.2 },
  { q: [[-9385.6, 2733.0], [-9371.5, 2736.0], [-9361.5, 2796.4], [-9375.8, 2797.0]], top: 549.0, rise: 2.8 },
  // the small cloister
  { q: [[-9413.3, 2664.6], [-9373, 2664.6], [-9373, 2680.1], [-9413.3, 2680.0]], top: 541.0, rise: 2.8 },
  { q: [[-9413.4, 2651.3], [-9402.1, 2651.3], [-9399.6, 2702], [-9413.3, 2701]], top: 542.0, rise: 2.4 },
  { q: [[-9400.2, 2699.4], [-9374.6, 2699.4], [-9374.2, 2710], [-9400.2, 2712]], top: 545.0, rise: 2.4 },
  { q: [[-9380.8, 2680.2], [-9373.5, 2680.2], [-9373.5, 2699.4], [-9380.4, 2699.4]], top: 541.5, rise: 1.8 },
  // the west side of the church court
  { q: [[-9422.9, 2728.0], [-9415.6, 2725.0], [-9413.5, 2760.5], [-9420.8, 2756.0]], top: 548.0, rise: 2.4 },
  { q: [[-9420.6, 2756.4], [-9412.6, 2758.4], [-9421.0, 2788.2], [-9428.8, 2789.6]], top: 548.0, rise: 2.2 },
  { q: [[-9428.9, 2790.1], [-9408.2, 2787.6], [-9408.4, 2800.0], [-9422.6, 2794.9]], top: 549.0, rise: 2.4 },
  // the north building and the passage and terrace that tie it on
  { q: [[-9348.9, 2606.1], [-9319.1, 2598.0], [-9314.9, 2611.6], [-9347.0, 2620.4]], top: 533.5, rise: 2.4 },
  { q: [[-9372.0, 2604.9], [-9351.2, 2598.8], [-9349.4, 2606.4], [-9369.1, 2614.8]], top: 532.0, rise: 2.0 },
  { q: [[-9359.9, 2612.2], [-9350.0, 2609.0], [-9339.4, 2649.9], [-9348.9, 2653.0]], top: 528.5 },
  { q: [[-9348.9, 2653.0], [-9307.0, 2641.2], [-9304.4, 2649.2], [-9346.5, 2661.5]], top: 530.0 },
  { q: [[-9413.2, 2651.4], [-9391.4, 2659.4], [-9391.4, 2665], [-9413.2, 2665]], top: 535.0 },
];
// the parts of the footprint no range covers: low buildings and substructures under flat roofs
const SMREST = [
  [-9429.2, 2790.0, -9408.2, 2787.6, -9408.3, 2800.1, -9362.8, 2796.6, -9376.4, 2797.5, -9376.9, 2794.5, -9406.9, 2798.6, -9407.8, 2787.5, -9419.1, 2787.4, -9413.0, 2760.8, -9410.1, 2773.0, -9412.7, 2759.1, -9421.0, 2788.2, -9428.8, 2789.6, -9420.1, 2756.5, -9420.7, 2756.1],
  [-9420.9, 2755.8, -9424.4, 2735.0, -9429.3, 2736.9, -9423.9, 2750.9],
  [-9409.8, 2774.3, -9385.4, 2770.1, -9391.4, 2733.2, -9385.9, 2733.0, -9386.0, 2711.0, -9400.2, 2712.0, -9400.2, 2702.0, -9413.4, 2700.9, -9416.7, 2703.7, -9415.1, 2724.4, -9425.7, 2727.2, -9425.6, 2727.6, -9415.6, 2725.0, -9415.0, 2735.0, -9411.1, 2734.3, -9413.3, 2722.5, -9401.5, 2720.2, -9399.2, 2732.0, -9395.2, 2731.3, -9392.9, 2743.2, -9391.3, 2742.9, -9390.4, 2747.5, -9391.7, 2747.8, -9385.5, 2769.6],
  [-9348.9, 2653.1, -9359.2, 2655.5, -9349.6, 2655.3, -9347.7, 2662.3, -9309.2, 2652.2, -9306.1, 2663.6, -9308.3, 2664.2, -9305.2, 2675.9, -9303.7, 2675.6, -9297.4, 2698.8, -9304.4, 2649.3, -9346.5, 2661.5],
  [-9331.9, 2721.9, -9344.9, 2725.8, -9339.3, 2737.0, -9339.5, 2736.0, -9326.9, 2733.4, -9291.4, 2724.1, -9327.0, 2733.2],
  [-9352.9, 2592.4, -9360.0, 2594.4, -9358.8, 2600.6, -9368.8, 2603.9, -9351.1, 2598.7],
  [-9346.8, 2722.0, -9354.1, 2723.9, -9346.8, 2722.2, -9346.2, 2723.4, -9357.2, 2666.3, -9355.0, 2689.5],
  [-9371.0, 2738.4, -9371.0, 2730.3, -9385.2, 2733.1, -9371.5, 2736.0],
];
// a wall along every edge of the footprint, high enough to be seen from any ground beside it, and caps over the strips
function smBase(P, holes) {
  for (const ring of [P, ...holes]) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], l = dist(a, b); if (l < 0.2) continue;
    let n = outN(a, b, ring); if (ring !== P) n = [-n[0], -n[1]];
    const hs = [0, 0.25, 0.5, 0.75, 1].map(t => groundY(...lerp(a, b, t))), lo = Math.min(...hs) - 1.2, top = Math.max(...hs) + 3.6, [c, d] = along(a, b, n, -0.16);
    quad('btSmW', c, d, lo, top, 0, Math.max(1, Math.round(l / SMBW)), 1 - (top - lo) / SMVH, 1, n);
  }
  for (const f of SMREST) { const q = pairsOf(f), hs = q.map(c => groundY(...c)); prism('flat', q, Math.max(...hs) + 2.6, Math.max(...hs) + 3.3, { c: '#b9ac90', noao: true }); }
}
const SMBW = 4.4, SMVH = 15.2, SMEBW = 5.2, SMEH = 17.6;
function smWall(g, w, h) {   // one bay, four floors measured down from the eaves
  const p = painter(g, 0, 0, w, h, SMBW, SMVH), { R } = p;
  ground(g, 0, 0, w, h, '#d8c5a0', 1701, 1.1);
  for (const y of [1.0, 4.7, 8.4, 12.1]) { pane(p, SMBW / 2, y, y + 2.05, 1.2, '#e8dcc0', 0.2, '#3b342c', '#9a8c74'); R(SMBW / 2 - 0.9, y - 0.4, SMBW / 2 + 0.9, y - 0.22, '#c4ae88'); }
  R(0, SMVH - 0.55, SMBW, SMVH, '#e0d0ac'); R(0, SMVH - 0.7, SMBW, SMVH - 0.55, 'rgba(80,60,34,0.4)');
}
function smEast(g, w, h) {   // the east wing: ochre plaster, white framed windows, string courses, the cornice
  const p = painter(g, 0, 0, w, h, SMEBW, SMEH), { R, arch, poly } = p, c = SMEBW / 2;
  ground(g, 0, 0, w, h, '#d3b273', 1702, 0.9);
  R(0.0, 0, 0.55, 16.6, '#efe9da'); R(0.55, 0, 0.66, 16.6, 'rgba(90,66,34,0.3)');
  pane(p, c, 1.2, 2.7, 1.2, '#cdb280', 0.22, '#39322a', '#8a7c64');
  for (const y of [4.7, 8.6]) { R(c - 1.12, y - 0.45, c + 1.12, y + 2.75, '#f1ece0'); pane(p, c, y, y + 2.3, 1.35, '#f1ece0', 0.14, '#41484a'); poly([[c - 1.25, y + 2.75], [c + 1.25, y + 2.75], [c, y + 3.3]], '#f1ece0'); }
  arch(c, 12.8, 15.5, 1.9, '#f1ece0'); arch(c, 12.95, 15.25, 1.35, '#41484a'); R(c - 0.04, 12.95, c + 0.04, 15.1, '#d8d4c8');
  for (const y of [3.75, 7.8, 11.75]) { R(0, y, SMEBW, y + 0.28, '#efe9da'); R(0, y - 0.12, SMEBW, y, 'rgba(90,66,34,0.35)'); }
  R(0, 16.35, SMEBW, 16.6, 'rgba(80,58,30,0.4)'); R(0, 16.6, SMEBW, SMEH, '#efe9da');
}
const SMCW = 24.8, SMCH = 21.6;
function smChurch(g, w, h) {
  const p = painter(g, 0, 0, w, h, SMCW, SMCH), { R, circ, text } = p, C = SMCW / 2;
  ground(g, 0, 0, w, h, '#e9e4d8', 1703, 0.7);
  const grey = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, '#7e7f80'); for (let y = y0 + 0.55; y < y1 - 0.1; y += 0.62) R(x0, y, x1, y + 0.05, '#626364'); R(x1, y0, x1 + 0.12, y1, 'rgba(60,60,58,0.35)'); };
  for (const x of [0, 6.25, 17.0, 23.2]) grey(x, 0, x + 1.55, 10.2);
  grey(6.55, 10.8, 7.95, 15.4); grey(16.85, 10.8, 18.25, 15.4); grey(6.7, 16.2, 7.9, 20.0); grey(16.9, 16.2, 18.1, 20.0);
  R(0, 0, SMCW, 0.4, '#8a8a86'); R(0, 10.15, SMCW, 10.8, '#77777a'); R(0, 10.65, SMCW, 10.8, '#a5a5a2'); R(6.2, 15.4, 18.6, 16.2, '#77777a'); R(6.2, 16.05, 18.6, 16.2, '#a5a5a2');
  R(C - 1.35, 0, C + 1.35, 5.45, '#2a1e18'); R(C - 0.04, 0, C + 0.04, 5.45, '#120c08');
  for (const s of [-1, 1]) { R(C + s * 4.0 - 0.7, 2.6, C + s * 4.0 + 0.7, 3.9, '#8a8c90'); R(C + s * 4.0 - 0.55, 2.75, C + s * 4.0 + 0.55, 3.75, '#e2ded2'); }
  R(C - 1.15, 10.8, C + 1.15, 14.3, '#d2ccbe'); R(C - 0.9, 10.8, C + 0.9, 13.9, '#241e18'); for (let y = 11.3; y < 13.8; y += 0.55) R(C - 0.9, y, C + 0.9, y + 0.05, '#4c4438'); for (let x = C - 0.55; x < C + 0.7; x += 0.55) R(x, 10.8, x + 0.05, 13.9, '#4c4438');
  circ(C, 17.9, 1.55, '#b08c48'); circ(C, 17.9, 1.2, '#8c6c34'); circ(C, 17.9, 0.95, '#1e242a'); R(C - 0.04, 17.0, C + 0.04, 18.8, '#6a6254'); R(C - 0.9, 17.86, C + 0.9, 17.94, '#6a6254');
  streaks(g, w, h, 18, 1704, 0.06, 60);
}
// walls of one range, with the texture hung from the eaves
function smRange(r) {
  const q = r.q, up = r.east ? SMEH : SMVH, bw = r.east ? SMEBW : SMBW, key = r.east ? 'btSmE' : 'btSmW', low = Math.min(...q.map(c => groundY(c[0], c[1]))) - 1.2;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], l = dist(a, b), n = outN(a, b, q), k = Math.max(1, Math.round(l / bw)), v0 = (low - r.top) / up + 1;
    if (r.east && v0 < 0) { quad(key, a, b, r.top - up, r.top, 0, k, 0, 1, n); quad('flat', a, b, low, r.top - up, 0, 1, 0, 1, n, '#c3ab80'); }
    else quad(key, a, b, low, r.top, 0, k, v0, 1, n);
  }
  if (r.rise) hip(q, r.top, r.rise, '#f0c09c', 0.35);
  else {
    flatRoof(q, r.top - 0.05, r.east ? '#d9c79c' : '#b0a898');
    if (!r.east) return;
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], n = outN(a, b, q); band(a, b, n, r.top, r.top + 0.3, -0.5, 0.35, '#efe9da', 0.3); band(a, b, n, r.top + 1.15, r.top + 1.35, -0.35, 0.05, '#efe9da'); const l = dist(a, b), k = Math.round(l / 2.6); for (let j = 0; j <= k; j++) { const c = lerp(a, b, j / (k || 1)); box('flat', 0.34, 0.9, 0.34, { p: [c[0] - n[0] * 0.2, r.top + 0.3, c[1] - n[1] * 0.2], c: '#e6dfcc', noao: true }); } }
  }
}
function buildMartino() {
  initShared();
  defMat('btSmW', 96, 336, [SMBW, SMVH], smWall);
  defMat('btSmE', 112, 384, [SMEBW, SMEH], smEast);
  defMat('btSmC', 288, 256, [SMCW, SMCH], smChurch);
  const P = pairsOf(SM.p), A = [-9409.7, 2774.8], B = [-9385.3, 2770.1];
  const yc = groundY(-9393, 2774) + 0.4;   // the church court
  begin(yc - 12);
  for (const r of SMR) smRange(r);
  smBase(P, SM.h.map(pairsOf));
  // the church: front and aisles, the nave, the arms, the dome on its drum, the bell tower
  const n = [0.189, 0.982], F = edgeFrame(A, B, yc, n), at = (x, y, z) => mul(F, tr(x, y, z)), WHITE = '#e6e1d6', GREY = '#85868a', W = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(F); return [v.x, v.z]; };
  extrude('btSmC', shapeOf([[-12.4, -4.5], [12.4, -4.5], [12.4, 10.7], [6.2, 10.7], [6.2, 20.0], [0, 21.55], [-6.2, 20.0], [-6.2, 10.7], [-12.4, 10.7]]), 0.4, { M: F, p: [0, 0, -0.5], uv: 'keep', uvk: [1 / SMCW, 1 / SMCH], uvo: [0.5, 0], noao: true });
  bx('flat', F, -12.5, 12.5, 10.3, 10.75, -0.15, 0.2, { c: GREY, noao: true }); bx('flat', F, -6.35, 6.35, 15.55, 16.1, -0.15, 0.22, { c: GREY, noao: true });
  const rl = Math.hypot(6.3, 1.65); for (const s of [-1, 1]) { box('flat', rl + 0.2, 0.34, 0.6, { M: F, p: [s * 3.1, 20.7, -0.2], rz: -s * Math.atan2(1.55, 6.3), c: GREY, noao: true }); statue('flat', at(s * 5.7, 20.25, -0.3), 1.3, { c: '#e8e4da', noao: true }); }
  bx('flat', F, -0.06, 0.06, 21.7, 22.9, -0.3, -0.18, { c: '#d9d4c6', noao: true }); bx('flat', F, -0.45, 0.45, 22.35, 22.47, -0.3, -0.18, { c: '#d9d4c6', noao: true });
  const low = groundY(...W(-12, -30)) - yc - 1.5;
  const aisles = [W(-12.35, -0.5), W(12.35, -0.5), W(9.0, -38), W(-12.35, -38)];
  prism('flat', aisles, yc + low, yc + 10.3, { c: WHITE }); for (const s of [-1, 1]) tris('tile', (() => { const v = (x, y, z) => { const c = W(x, z); return [c[0], yc + y, c[1]]; }; return [[v(s * 12.5, 10.3, -0.5), v(s * (s > 0 ? 9.2 : 12.5), 10.3, -38), v(s * 6.1, 12.3, -38)], [v(s * 12.5, 10.3, -0.5), v(s * 6.1, 12.3, -38), v(s * 6.1, 12.3, -0.5)]]; })(), '#eecaac');
  bx('flat', F, -6.15, 6.15, 10.0, 19.4, -37, -0.5, { c: WHITE });
  hip([W(-6.2, -0.5), W(6.2, -0.5), W(6.2, -37), W(-6.2, -37)], yc + 19.4, 2.4, '#f2c8a8', 0.3);
  for (let z = -5; z > -24; z -= 5.6) for (const s of [-1, 1]) { const M = mul(at(s * 6.17, 0, z), rotY(s * PI / 2)); bx('flat', M, -0.8, 0.8, 14.0, 16.8, -0.02, 0.04, { c: '#35302a', noao: true }); bx('flat', M, -2.6, -2.2, 10.5, 19.2, -0.02, 0.18, { c: '#b9b6ae', noao: true }); }
  // the arms of the cross, the choir
  const arm = [W(-15.5, -26), W(10.0, -26), W(10.0, -40), W(-15.5, -40)];
  prism('flat', arm, yc + low, yc + 16.6, { c: WHITE }); hip(arm, yc + 16.6, 2.2, '#dcb48e', 0.3);
  const choir = [W(-6.0, -39), W(6.0, -39), W(6.0, -52), W(-6.0, -52)];
  prism('flat', choir, yc + low - 3, yc + 16.0, { c: WHITE }); hip(choir, yc + 16.0, 2.2, '#dcb48e', 0.3);
  const DZ = -33, drum = at(0, 0, DZ);
  cyl('flat', 6.3, 6.4, 6.2, 8, { M: drum, p: [0, 16.4, 0], t0: PI / 8, c: '#dcd5c4' }); cyl('flat', 6.7, 6.7, 0.5, 8, { M: drum, p: [0, 22.4, 0], t0: PI / 8, c: '#cfc5ac', noao: true });
  for (let k = 0; k < 8; k++) { const M = mul(drum, rotY(k * PI / 4)); extrude('flat', archShape(1.6, 2.8), 0.1, { cs: 5, M, p: [0, 18.4, 5.82], c: '#3a342c', noao: true }); }
  const prof = [[6.2, 0], [6.0, 1.5], [5.35, 3.0], [4.2, 4.35], [2.8, 5.35], [1.3, 5.95]];
  for (let i = 0; i + 1 < prof.length; i++) cyl('flat', prof[i + 1][0], prof[i][0], prof[i + 1][1] - prof[i][1], 8, { M: drum, p: [0, 22.9 + prof[i][1], 0], t0: PI / 8, open: true, c: i % 2 ? '#c69a66' : '#cfa570', noao: true });
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; for (let i = 0; i + 1 < prof.length; i++) { const r0 = prof[i][0], r1 = prof[i + 1][0], dy = prof[i + 1][1] - prof[i][1], l = Math.hypot(r0 - r1, dy), M = mul(drum, rotY(a)); box('flat', 0.3, l, 0.2, { M, p: [0, 22.9 + prof[i][1], r0], rx: -Math.atan2(r0 - r1, dy), c: '#e0c896', noao: true }); } }
  cyl('flat', 1.5, 1.6, 0.4, 8, { M: drum, p: [0, 28.75, 0], c: '#e8e4d8', noao: true }); cyl('flat', 1.05, 1.05, 2.1, 8, { M: drum, p: [0, 29.1, 0], c: '#ece8de', noao: true }); for (let k = 0; k < 4; k++) bx('flat', mul(drum, rotY(k * PI / 2)), -0.3, 0.3, 29.5, 30.8, 0.98, 1.06, { c: '#4a443a', noao: true });
  part('flat', new THREE.SphereGeometry(1.3, 8, 4, 0, 2 * PI, 0, PI / 2), { M: drum, p: [0, 31.2, 0], c: '#e4e2da', noao: true }); bx('flat', drum, -0.05, 0.05, 32.4, 33.9, -0.05, 0.05, { c: '#d9d4c6', noao: true }); bx('flat', drum, -0.4, 0.4, 33.2, 33.32, -0.05, 0.05, { c: '#d9d4c6', noao: true });
  // the bell tower east of the nave: shaft, clock, two bell openings a side, pinnacles
  const TM = at(9.4, 0, -25.5), T2 = 2.25;
  bx('flat', TM, -T2, T2, low, 27.8, -T2, T2, { c: '#e0d8c4' });
  for (const y of [20.4, 23.0, 27.5]) bx('flat', TM, -T2 - 0.2, T2 + 0.2, y, y + 0.35, -T2 - 0.2, T2 + 0.2, { c: '#c9bc9c', noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(TM, rotY(k * PI / 2)); for (const x of [-0.85, 0.85]) extrude('flat', archShape(0.95, 3.0), 0.06, { cs: 5, M, p: [x, 23.8, T2 - 0.02], c: '#35291f', noao: true }); disc(M, 0, 21.8, T2 - 0.02, 0.8, 0.08, '#c4a878'); disc(M, 0, 21.8, T2 + 0.02, 0.55, 0.08, '#ece6d6'); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { bx('flat', TM, sx * (T2 - 0.25) - 0.2, sx * (T2 - 0.25) + 0.2, 27.85, 28.9, sz * (T2 - 0.25) - 0.2, sz * (T2 - 0.25) + 0.2, { c: '#e0d8c4', noao: true }); cone('flat', 0.28, 0.9, 5, { M: TM, p: [sx * (T2 - 0.25), 28.9, sz * (T2 - 0.25)], c: '#cfc2a2', noao: true }); }
  bx('flat', TM, -0.8, 0.8, 27.85, 29.5, -0.3, 0.3, { c: '#e0d8c4', noao: true }); extrude('flat', archShape(0.6, 1.0), 0.66, { cs: 4, M: TM, p: [0, 28.15, -0.33], c: '#35291f', noao: true }); pyramid('flat', 1.8, 0.8, 0.8, { M: TM, p: [0, 29.5, 0], c: '#cfc2a2', noao: true });
  const o = end('Abbazia di San Martino delle Scale');
  o.userData.solids = [];
  return o;
}

// =====================================================================================================
// Grattacielo INA Assitalia
// =====================================================================================================
const INA = { id: 'w122575448', p: [-532.5, -627.4, -542.1, -646.9, -567.3, -634.5, -557.7, -614.9] };
const INAB = { id: 'w25739679', p: [-544.0, -650.4, -542.1, -646.9, -567.3, -634.5, -557.7, -614.9, -532.5, -627.4, -529.5, -621.5, -556.3, -608.6, -591.4, -618.8, -593.7, -626.0] };
// the taller blocks of the base behind the tower, from the surveyed roof outlines (height above the ground)
const INAHI = [
  { h: 29.4, p: [-569.7, -630.3, -569.7, -624.4, -565.7, -624.3, -563.7, -616.4, -560.7, -616.4, -559.9, -618.6, -567.6, -634.7, -542.5, -647.0, -543.1, -648.2, -544.5, -649.8, -575.7, -634.4] },
  { h: 29.4, p: [-549.7, -612.4, -545.7, -614.0, -545.7, -620.4, -553.7, -616.4] },
  { h: 21.6, p: [-573.7, -626.4, -569.7, -624.3, -569.7, -620.4, -565.7, -620.3, -565.7, -614.4, -556.7, -614.4, -560.7, -616.4, -563.6, -616.5, -565.7, -624.4, -569.7, -624.5, -569.7, -630.4, -573.7, -632.4] },
];
const INAO = [-549.9, -630.9], INAN = [0.898, -0.44], INAH = 67.6, INAWH = 55.6, INACX = 7.3, INAZ = 13.95;
const INAFW = 14.6, INASW = 26.6, INAWW = 3.6;
const INAP = { f: [0, 146], s: [146, 266], w: [412, 40], b: [452, 60], c: [512, 48], W: 560, H: 576 };
const FL = k => 12.4 + k * 3.45;   // the sill of floor k of the shaft
function inaAtlas(g, w, h) {
  const stone = '#c6c0b4', frameC = '#a29c92';
  const clad = (x, pw, FW, seed) => { ground(g, x, 0, pw, h, stone, seed, 0.6); const p = painter(g, x, 0, pw, h, FW, INAH); const r = RNG(seed + 1); for (let y = 0; y < INAH; y += 1.15) { p.R(0, y, FW, y + 0.07, 'rgba(110,98,78,0.18)'); for (let xx = (y * 3) % 1.9; xx < FW; xx += 1.9) p.R(xx, y, xx + 1.8, y + 1.1, r() < 0.3 ? 'rgba(120,105,80,0.09)' : 'rgba(255,250,235,0.04)'); } return p; };
  const win = (p, x, y, ww, k) => { p.R(x - ww / 2 - 0.12, y - 0.12, x + ww / 2 + 0.12, y + 1.92, frameC); p.R(x - ww / 2, y, x + ww / 2, y + 1.8, '#3e4a55'); const sh = [0, 1.1, 0.5, 0, 1.4, 0.8][k % 6]; if (sh) p.R(x - ww / 2, y + 1.8 - sh, x + ww / 2, y + 1.8, '#b4ac9c'); p.R(x - 0.04, y, x + 0.04, y + 1.8, '#dcd8ce'); };
  {   // the front: two columns of windows, the white framed bay of balconies, the two wide windows at the top, the sign
    const p = clad(0, INAP.f[1], INAFW, 1801), { R, text } = p, C = INAFW / 2;
    for (let k = 0; k < 16; k++) for (const s of [-1, 1]) { win(p, C + s * 4.9, FL(k), 2.1, k * 5 + s + 2); if (k < 13) R(C + s * 4.9 - 1.17, FL(k) - 1.55, C + s * 4.9 + 1.17, FL(k) - 0.15, '#b6a78c'); }
    for (const k of [14, 15]) win(p, C, FL(k), 4.4, k);
    R(C - 2.65, FL(0) - 1.0, C + 2.65, FL(13) + 2.75, '#e8e6de');
    for (let k = 0; k < 14; k++) { const y = FL(k) - 0.7; R(C - 2.35, y, C + 2.35, y + 3.2, '#44545f'); for (let x = C - 2.35; x < C + 2.4; x += 0.94) R(x, y, x + 0.07, y + 3.2, '#c9ccc8'); R(C - 2.35, y + 2.55, C + 2.35, y + 2.65, '#c9ccc8'); R(C - 2.5, y, C + 2.5, y + 0.28, '#eceade'); R(C - 2.5, y + 1.15, C + 2.5, y + 1.25, '#eceade'); for (let x = C - 2.4; x < C + 2.45; x += 0.4) R(x, y + 0.28, x + 0.05, y + 1.2, '#dcdad0'); }
    ground(g, 0, p.Y(8.4), INAP.f[1], h - p.Y(8.4), '#6a5648', 1802);
    for (const x of [1.6, 4.4, 10.2, 13.0]) pane(p, x, 4.9, 7.3, 1.5, '#8a7a68', 0.18);
    R(C - 2.2, 0, C + 2.2, 4.4, '#1e1a18'); for (const x of [2.0, 12.6]) { R(x - 1.3, 0, x + 1.3, 3.4, '#33383a'); R(x - 1.3, 3.5, x + 1.3, 4.1, '#8a7a68'); }
    R(0, 8.4, INAFW, 10.6, '#d9d2c0'); R(0, 8.25, INAFW, 8.4, 'rgba(50,38,24,0.45)');
    for (const x of [3.65, 10.95]) text('GENERALI', x, 9.45, 1.25, '#b0281e', 6.2);
  }
  {   // the flank: six columns of windows
    const p = clad(INAP.s[0], INAP.s[1], INASW, 1803);
    for (let k = 0; k < 16; k++) for (let i = 0; i < 6; i++) win(p, 2.6 + i * 4.28, FL(k), 2.0, k * 7 + i);
    ground(g, INAP.s[0], p.Y(8.4), INAP.s[1], h - p.Y(8.4), '#6a5648', 1804); for (let i = 0; i < 6; i++) pane(p, 2.6 + i * 4.28, 4.9, 7.3, 1.6, '#8a7a68', 0.18); p.R(0, 8.4, INASW, 10.6, '#d9d2c0');
  }
  {   // a bay of the ochre wings, and of the cream blocks of the base
    ground(g, INAP.w[0], 0, INAP.w[1], h, '#caa874', 1805, 0.8); const p = painter(g, INAP.w[0], 0, INAP.w[1], h, INAWW, INAH);
    for (let k = -2; k < 13; k++) win(p, INAWW / 2, FL(k), 1.9, k + 9);
    ground(g, INAP.b[0], 0, INAP.b[1], h, '#bcb09a', 1806);
    const q = painter(g, INAP.b[0], 0, INAP.b[1], h, 3.5, INAH); q.R(0, 4.2, 3.5, 8.6, '#a89882'); pane(q, 1.75, 4.95, 7.4, 2.0, '#cfc4ae', 0.22); q.R(0, 0, 3.5, 4.2, '#4c3630'); q.R(0.35, 0, 3.15, 3.0, '#1f2a24'); q.R(0.35, 3.1, 3.15, 3.6, '#223a2a');
    ground(g, INAP.c[0], 0, INAP.c[1], h, '#d6cfbd', 1807, 0.7); const c = painter(g, INAP.c[0], 0, INAP.c[1], h, INAWW, INAH); for (let k = -2; k < 7; k++) win(c, INAWW / 2, FL(k), 1.9, k + 4);
  }
}
const inaU = (key, a, b) => [(INAP[key][0] + INAP[key][1] * a) / INAP.W, (INAP[key][0] + INAP[key][1] * b) / INAP.W];
function buildIna() {
  initShared();
  defMat('btIna', INAP.W, INAP.H, [INAFW, INAH], inaAtlas);
  const P = pairsOf(INA.p), B = pairsOf(INAB.p), y0 = groundY(-532, -640), rg = groundRange(B);
  begin(y0);
  const F = frame(INAO[0], y0, INAO[1], INAN[0], INAN[1]), W = (x, z) => [INAO[0] + x * INAN[1] + z * INAN[0], INAO[1] - x * INAN[0] + z * INAN[1]];
  const wl = (key, x0, z0, x1, z1, ya, yb, a, b, c) => { const p = W(x0, z0), q = W(x1, z1), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ln = Math.abs(x1 - x0) < 0.01 ? [Math.sign(mx), 0] : [0, Math.sign(mz)], n = [ln[0] * INAN[1] + ln[1] * INAN[0], -ln[0] * INAN[0] + ln[1] * INAN[1]]; const [u0, u1] = inaU(key, a, b); quad('btIna', p, q, y0 + ya, y0 + yb, u0, u1, ya / INAH, yb / INAH, n, c); };
  // the shaft
  const zb = -12.6;
  wl('f', -INACX, INAZ, INACX, INAZ, 0, INAH, 0, 1);
  wl('f', -INACX, zb, INACX, zb, 0, INAH, 0, 1, '#e8e0d0');
  for (const x of [-INACX, INACX]) wl('s', x, zb, x, INAZ, 0, INAH, 0, 1);
  bx('flat', F, -INACX, INACX, INAH - 0.1, INAH, zb, INAZ - 0.05, { c: '#b9b2a2', noao: true }); bx('flat', F, -INACX - 0.2, INACX + 0.2, INAH, INAH + 0.35, zb - 0.2, INAZ + 0.04, { c: '#ddd5c2', noao: true });
  rails(F, -INACX, INACX, zb, INAZ - 0.1, INAH + 0.35, '#4a4a46');
  bx('flat', F, -2.85, 2.85, FL(13) + 2.7, FL(13) + 2.9, INAZ - 0.1, INAZ + 0.05, { c: '#ecebe4', noao: true });
  for (let k = 0; k < 14; k++) { const y = FL(k) - 0.7; bx('flat', F, -2.5, 2.5, y, y + 0.22, INAZ - 0.1, INAZ + 0.55, { c: '#e8e6dc', noao: true }); bx('flat', F, -2.5, 2.5, y + 1.15, y + 1.22, INAZ + 0.49, INAZ + 0.55, { c: '#e8e6dc', noao: true }); }
  bx('flat', F, -10.8, 10.8, 8.4, 8.7, INAZ - 0.1, INAZ + 0.8, { c: '#d4ccb8', noao: true });
  // the ground storey out to the footprint's edges
  for (const s of [-1, 1]) wl('f', s * INACX, INAZ, s * 10.8, INAZ, -1.2, 10.2, 0, 0.2);
  wl('s', -10.8, zb, -10.8, INAZ, -1.2, 8.6, 0, 1); wl('s', 10.8, zb, 10.8, INAZ, -1.2, 8.6, 0, 1);
  bx('flat', F, -10.8, -INACX, 8.5, 8.65, zb, INAZ - 0.05, { c: '#8a847a', noao: true }); bx('flat', F, INACX, 10.8, 10.2, 10.35, zb, INAZ - 0.05, { c: '#b9b2a2', noao: true }); bx('flat', F, -10.8, -INACX, 10.2, 10.35, INAZ - 1.2, INAZ - 0.05, { c: '#b9b2a2', noao: true });
  // the ochre wings; the south east one (-x) set back behind its white balconies
  for (const s of [-1, 1]) {
    const xo = s < 0 ? -9.55 : 10.75, z0 = -10.6, z1 = 12.5;
    wl('w', s * INACX, z1, xo, z1, 0, INAWH, 0, (Math.abs(xo) - INACX) / INAWW);
    wl('w', s * INACX, z0, xo, z0, 0, INAWH, 0, (Math.abs(xo) - INACX) / INAWW);
    const n = Math.round((z1 - z0) / INAWW);
    for (let i = 0; i < n; i++) wl('w', xo, z0 + (z1 - z0) * i / n, xo, z0 + (z1 - z0) * (i + 1) / n, 0, INAWH, 0, 1);
    bx('flat', F, Math.min(s * INACX, xo), Math.max(s * INACX, xo), INAWH - 0.1, INAWH, z0, z1, { c: '#b9ac90', noao: true });
    rails(F, Math.min(s * INACX, xo), Math.max(s * INACX, xo), z0, z1, INAWH, '#4a4a46');
  }
  for (let k = 0; k < 13; k++) {
    const y = FL(k) - 0.75;
    for (const [x0, x1, za, zz] of [[-10.85, -9.45, -12.2, 13.8], [-9.55, -7.2, -12.2, -10.5], [-9.55, -7.2, 12.4, 13.8]]) bx('flat', F, x0, x1, y, y + 0.28, za, zz, { c: '#e9e6dc', noao: true });
    bx('flat', F, -10.85, -10.77, y + 1.2, y + 1.3, -12.2, 13.8, { c: '#e6e4dc', noao: true }); bx('flat', F, -10.85, -7.2, y + 1.2, y + 1.3, 13.72, 13.8, { c: '#e6e4dc', noao: true });
    for (let z = -12.2; z <= 13.8; z += 2.6) bx('flat', F, -10.85, -10.77, y + 0.28, y + 1.2, z - 0.04, z + 0.04, { c: '#d8d6ce', noao: true });
    bx('flat', F, -10.85, -10.79, y + 0.5, y + 0.72, -12.2, 13.8, { c: '#d6d4cc', noao: true });
  }
  // the penthouse with its tall windows
  const PX = 5.7, PZ0 = -5.0, PZ1 = 8.6, PT = 72.0;
  bx('flat', F, -PX, PX, INAH, PT, PZ0, PZ1, { c: '#cdc5b3', noao: true }); bx('flat', F, -PX - 0.15, PX + 0.15, PT, PT + 0.22, PZ0 - 0.15, PZ1 + 0.15, { c: '#ded7c6', noao: true });
  for (let x = -PX + 0.8; x < PX - 0.5; x += 1.25) for (const z of [PZ0 - 0.02, PZ1 + 0.02]) bx('flat', F, x - 0.35, x + 0.35, INAH + 0.7, PT - 0.5, z - 0.03, z + 0.03, { c: '#46525a', noao: true });
  for (let z = PZ0 + 0.9; z < PZ1 - 0.5; z += 1.3) for (const x of [-PX - 0.02, PX + 0.02]) bx('flat', F, x - 0.03, x + 0.03, INAH + 0.7, PT - 0.5, z - 0.36, z + 0.36, { c: '#46525a', noao: true });
  // the steel crown: two tiers of open framing, the arch and the mast
  const IRON = '#33343a', CZ = 1.8;
  const cage = (hx, hz, ya, yb, nx, nz) => {
    const bar = (x0, x1, y0b, y1b, z0b, z1b) => bx('flat', F, x0, x1, y0b, y1b, z0b, z1b, { c: IRON, noao: true });
    for (let i = 0; i <= nx; i++) { const x = -hx + 2 * hx * i / nx; for (const z of [CZ - hz, CZ + hz]) bar(x - 0.07, x + 0.07, ya, yb, z - 0.07, z + 0.07); }
    for (let i = 1; i < nz; i++) { const z = CZ - hz + 2 * hz * i / nz; for (const x of [-hx, hx]) bar(x - 0.07, x + 0.07, ya, yb, z - 0.07, z + 0.07); }
    for (const y of [ya + (yb - ya) / 2, yb]) { for (const z of [CZ - hz, CZ + hz]) bar(-hx, hx, y - 0.06, y + 0.06, z - 0.06, z + 0.06); for (const x of [-hx, hx]) bar(x - 0.06, x + 0.06, y - 0.06, y + 0.06, CZ - hz, CZ + hz); }
    for (let i = 0; i < nx; i++) { const x0 = -hx + 2 * hx * i / nx, wd = 2 * hx / nx, l = Math.hypot(wd, yb - ya); for (const z of [CZ - hz, CZ + hz]) box('flat', 0.08, l, 0.08, { M: F, p: [i % 2 ? x0 : x0 + wd, ya, z], rz: (i % 2 ? -1 : 1) * Math.atan2(wd, yb - ya), c: IRON, noao: true }); }
  };
  cage(5.1, 5.1, PT + 0.2, 76.2, 6, 6); cage(3.4, 3.4, 76.2, 79.8, 4, 4);
  for (const s of [-1, 1]) bx('flat', F, s * 2.3 - 0.14, s * 2.3 + 0.14, 76.2, 85.2, CZ - 0.13, CZ + 0.13, { c: IRON, noao: true });
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI, b = (i + 1) / 8 * PI, x0 = Math.cos(a) * 2.3, y1a = Math.sin(a) * 2.4, x1 = Math.cos(b) * 2.3, y1b = Math.sin(b) * 2.4, l = Math.hypot(x1 - x0, y1b - y1a); box('flat', 0.24, l + 0.08, 0.24, { M: F, p: [x0, 85.2 + y1a, CZ], rz: Math.atan2(-(x1 - x0), y1b - y1a), c: IRON, noao: true }); }
  cyl('flat', 0.08, 0.2, 12.8, 6, { M: F, p: [0, 76.2, CZ], c: IRON, noao: true }); cyl('flat', 0.55, 0.55, 0.12, 8, { M: F, p: [0, 87.7, CZ], c: IRON, noao: true }); cyl('flat', 0.03, 0.05, 3.0, 4, { M: F, p: [0, 89.0, CZ], c: IRON, noao: true });
  // the base: the portico of square piers, the upper storey, the terrace and its rail, the taller blocks behind
  const inner = inset(B, 2.0), outer = inset(B, 0.15);
  for (let i = 0; i < B.length; i++) {
    const a = B[i], b = B[(i + 1) % B.length], j = (i + 1) % B.length, n = outN(a, b, B), l = dist(a, b), street = i >= 4 || i === 0, k = Math.max(1, Math.round(l / 3.5));
    const [u0, u1] = inaU('b', 0, 1), bays = (p, q, ya, yb) => { for (let m = 0; m < k; m++) quad('btIna', lerp(p, q, m / k), lerp(p, q, (m + 1) / k), y0 + ya, y0 + yb, u0, u1, ya / INAH, yb / INAH, n); };
    if (i >= 1 && i <= 3) continue;   // the edges that run along the tower
    bays(outer[i], outer[j], 4.2, 8.6);
    if (street) { bays(inner[i], inner[j], -1.2, 4.2); for (let m = 0; m <= k; m++) { const c = lerp(a, b, Math.min(1 - 0.4 / l, Math.max(0.4 / l, m / k))), M = frame(c[0], y0, c[1], n[0], n[1]); bx('flat', M, -0.36, 0.36, -1.2, 4.25, -0.75, -0.06, { c: '#d6cebc' }); } }
    else bays(outer[i], outer[j], -1.2, 4.2);
    band(a, b, n, y0 + 4.05, y0 + 4.75, -0.6, 0.0, '#a09482'); band(a, b, n, y0 + 8.6, y0 + 9.9, -0.7, 0.05, '#d6cebb');
    panel('rail', l, 1.05, { M: edgeFrame(a, b, y0 + 9.9, n), p: [0, 0, -0.25], uvk: [l / 1.1, 1] });
  }
  prism('flat', B, y0 + 8.6, y0 + 8.75, { c: '#8a847a', noao: true }); prism('flat', inner, y0 + 4.2, y0 + 4.3, { c: '#6f665a', noao: true });
  for (const hi of INAHI) { const q = pairsOf(hi.p); for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], l = dist(a, b), n = outN(a, b, q), k = Math.max(1, Math.round(l / 3.6)), [u0, u1] = inaU('c', 0, 1); for (let m = 0; m < k; m++) quad('btIna', lerp(a, b, m / k), lerp(a, b, (m + 1) / k), y0 + 8.7, y0 + hi.h, u0, u1, (FL(0) - 1.0) / INAH, (FL(0) - 1.0 + hi.h - 8.7) / INAH, n); } flatRoof(q, y0 + hi.h, '#a8a296'); }
  skirt(B, rg.lo - 1.5, y0 - 1.15);
  const o = end('Grattacielo INA Assitalia');
  o.userData.solids = [[INA.p, null, y0 + INAWH], [INAB.p, null, y0 + 8.6]];
  return o;
}
// a thin iron rail round a flat roof (frame coordinates)
function rails(F, x0, x1, z0, z1, y, c) { for (const [a, b, cc, d] of [[x0, x1, z0, z0 + 0.06], [x0, x1, z1 - 0.06, z1], [x0, x0 + 0.06, z0, z1], [x1 - 0.06, x1, z0, z1]]) bx('flat', F, a, b, y + 0.95, y + 1.02, cc, d, { c, noao: true }); }

// =====================================================================================================
// Casina No Mafia
// =====================================================================================================
const CA = { id: 'w365861339', p: [-9591.9, -7196.9, -9590.8, -7203.7, -9585.6, -7203.2, -9584.4, -7212.4, -9578.9, -7211.6, -9579.6, -7206.6, -9575.7, -7206.0, -9576.7, -7200.5, -9580.4, -7200.9, -9580.5, -7200.3, -9586.4, -7196.5] };
const CAH = 10.5, CAW = 6.9;
function caFace(g, w, h) {
  const p = painter(g, 0, 0, w, h, CAW, CAH), { R, poly } = p;
  ground(g, 0, 0, w, h, '#eae8e0', 1901, 0.55);
  // the letters, drawn as the thick uneven strokes of the paint
  const BLUE = '#1d3270', letter = (x, y, ww, hh, strokes) => { for (const s of strokes) poly(s.map(([a, b]) => [x + a * ww, y + b * hh]), BLUE); };
  const T = 0.3, N = [[[0, 0], [T, 0], [T, 1], [0, 1]], [[1 - T, 0], [1, 0], [1, 1], [1 - T, 1]], [[0, 1], [T + 0.04, 1], [1, 0], [1 - T - 0.04, 0]]];
  const O = [[[0, 0], [T, 0], [T, 1], [0, 1]], [[1 - T, 0], [1, 0], [1, 1], [1 - T, 1]], [[0, 0], [1, 0], [1, 0.22], [0, 0.22]], [[0, 0.78], [1, 0.78], [1, 1], [0, 1]]];
  const M = [[[0, 0], [0.24, 0], [0.26, 1], [0, 1]], [[0.76, 0], [1, 0], [1, 1], [0.74, 1]], [[0.05, 1], [0.31, 1], [0.6, 0.3], [0.45, 0.2]], [[0.95, 1], [0.69, 1], [0.4, 0.3], [0.55, 0.2]]];
  const A = [[[0, 0], [0.28, 0], [0.58, 1], [0.36, 1]], [[1, 0], [0.72, 0], [0.42, 1], [0.64, 1]], [[0.22, 0.22], [0.78, 0.22], [0.72, 0.42], [0.28, 0.42]]];
  const F = [[[0, 0], [0.34, 0], [0.34, 1], [0, 1]], [[0, 0.78], [1, 0.78], [1, 1], [0, 1]], [[0, 0.4], [0.85, 0.4], [0.85, 0.6], [0, 0.6]]];
  const I = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
  letter(1.85, 5.95, 1.35, 1.8, N); letter(3.65, 5.95, 1.45, 1.8, O);
  letter(0.4, 3.8, 1.7, 1.85, M); letter(2.25, 3.8, 1.38, 1.85, A); letter(3.82, 3.8, 0.92, 1.85, F); letter(4.92, 3.8, 0.4, 1.85, I); letter(5.45, 3.8, 1.2, 1.85, A);
  streaks(g, w, h, 18, 1902, 0.09, 60, '90,90,80');
  const gb = g.createLinearGradient(0, h, 0, h - 30); gb.addColorStop(0, 'rgba(80,70,52,0.3)'); gb.addColorStop(1, 'rgba(80,70,52,0)'); g.fillStyle = gb; g.fillRect(0, h - 30, w, 30);
}
function buildCasina() {
  initShared();
  defMat('btCa', 160, 200, [CAW, CAH], caFace);
  const P = pairsOf(CA.p), T = [P[0], P[1], P[2], P[10]], rg = groundRange(P), a = P[0], b = P[1], n = outN(a, b, P), y0 = (groundY(...a) + groundY(...b)) / 2;
  begin(y0);
  const lo = rg.lo - 1.5;
  prism('flat', inset(T, 0.08), lo, y0 + CAH, { c: '#dedcd2' });
  quad('btCa', a, b, y0, y0 + CAH, 0, 1, 0, 1, n);
  prism('flat', inset(T, -0.22), y0 + CAH, y0 + CAH + 0.3, { c: '#d2cfc4', noao: true });
  // the low annex
  const A = [P[2], P[3], P[4], P[5], P[6], P[7], P[8], P[9], P[10]], ya = Math.max(y0 + 3.2, groundY(...P[6]) + 2.4);
  prism('flat', A, lo, ya, { c: '#d8d6cc' }); prism('flat', inset(A, -0.1), ya, ya + 0.16, { c: '#c2bfb4', noao: true });
  for (const [i, j] of [[2, 3], [9, 10]]) { const p = P[i], q = P[j]; if (dist(p, q) < 3) continue; const nn = outN(p, q, P), M = edgeFrame(p, q, y0, nn); bx('flat', M, -1.5, 1.5, 0.6, 2.4, -0.03, 0.04, { c: '#2c4a8a', noao: true }); for (let x = -1.3; x < 1.4; x += 0.32) bx('flat', M, x, x + 0.07, 0.65, 2.35, 0.03, 0.07, { c: '#6a86c0', noao: true }); }
  const o = end('Casina No Mafia');
  o.userData.solids = [[CA.p, null, y0 + 3.0]];
  return o;
}

export const BATCH_T = [
  { name: 'Ingresso monumentale di Via Roma', x: 450, z: 532, radius: 75, skipIds: [VRW.id, VRE.id], build: buildViaRoma, walls: [...vrWalls(VRW.p, 4, 5), ...vrWalls(VRE.p, 14, 15)] },
  { name: 'Palazzo delle Finanze', x: 502, z: -291, radius: 65, skipIds: [FI.id], build: buildFinanze },
  { name: "Palazzo d'Orleans", x: -786, z: 660, radius: 55, skipIds: [OR.id], build: buildOrleans, walls: orWalls },
  { name: 'Chiesa di San Giovanni dei Lebbrosi', x: 1666, z: 1330, radius: 30, skipIds: [LB.id], build: buildLebbrosi, walls: lbWalls },
  { name: 'Chiesa di San Ciro a Maredolce', x: 2160, z: 3012, radius: 30, skipIds: [SC.id], build: buildSanCiro },
  { name: 'Abbazia di San Martino delle Scale', x: -9345, z: 2696, radius: 120, skipIds: [SM.id], build: buildMartino },
  { name: 'Grattacielo INA Assitalia', x: -553, z: -629, radius: 55, skipIds: [INA.id, INAB.id], build: buildIna },
  { name: 'Casina No Mafia', x: -9584, z: -7204, radius: 25, skipIds: [CA.id], build: buildCasina },
];
