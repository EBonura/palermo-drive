// Round 2 landmarks, batch P2: five palazzi that were drawn by the generic builder. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. "Commons" is Wikimedia Commons, "Mapillary" the street imagery (image ids given). Widths are the footprint edges of world/tiles; heights are the baked ones
// or read off the photos against them, so treat positions along a front as good to about half a metre (Bonocore's south front, read from a rectified photo, is closer than that).
//
// Palazzo Bonocore (w86870881, "Palazzo Serradifalco Buonocore"), between Piazza Pretoria, the Corso and Discesa dei Musici. Commons "Palazzo Bonocore Piazza Pretoria a Palermo.jpg" (2018, rectified);
//  Mapillary 638708520867928 (2021, the Corso and west sides). Read: Pretoria front: golden stone, grey plinth, rusticated ground floor with three arched doors under keystone heads, small windows with grilles,
//  a long balcony on small corbels across seven tall shuttered windows under flat hoods, flat Corinthian pilasters, a row of small square windows, a dentilled cornice, a pediment with a medallion over the three
//  middle bays and a panelled attic. Corso side: pinkish stone, tall arched shopfronts, two long balconies, hooded windows, small balconies at the top. West side: the arch of the restaurant, balconies, windows.
//  Not verified, left plain: the side on Salita Santa Caterina (string courses and cornice only), the roof, the number of Corso bays to better than one, the carving.
//
// Palazzo Costantino di Napoli (w279883469), the north east corner of the Quattro Canti. The concave corner itself is drawn by src/landmarks.js and is not touched; this adds the two street fronts and the
//  building behind. Mapillary 762740725637471, 2674172239427438 (2024), 638708520867928 (2021) for the Corso; 4303135136401868, 861343967853404, 2928755264055337 (2021) for Via Maqueda;
//  141175681783239 (2022) for both against the corner's cornices. Read: Corso front in orange render with banded ground floor, an arched portal with a dark door beside the corner and a square window over
//  it, shop doors, small iron balconies, a long balcony on deep corbels level with the corner's first one, arched hoods with a head in each, separate balconies on top, a heavy cornice. Via Maqueda: cream
//  plaster, grey stone ground floor with shop doors, balconies on corbels. Commons "Palazzo Costantino 01 to 15" show the courtyard and ceilings (not built); "Palazzo Costantino 1 to 6" are in Naples.
//  Not verified: the upper floors on Via Maqueda (only seen steeply: drawn with the rhythm of the Corso front), the exact bay count there, the side on Vicolo Mori and the back (plain), the carving.
//
// Palazzo Lanza Tomasi (w279883620 on Via Butera and w279883350 on the sea side). Mapillary 957097003506447, 1650999552618070, 2186055802140511, 925739436915830 (April 2026) along Via Butera, numbers 26 to 34;
//  Commons "Foro Italico 10.jpg" (the sea front, the left hand building in it). Read: Via Butera: cream rusticated render over a grey marble plinth, round arched brown doors, one portal framed by two grey
//  columns, bracketed balconies with scrolled iron rails, dark green shutters, three floors above the doors. Sea front: white plaster, ochre window surrounds with pediments (triangle and curve in turn),
//  ochre pilasters and cornice. Not verified: the sea front below the piano nobile (hidden by trees: plain), its bay count, the terrace in front (not drawn), the strip of the Via Butera side south of
//  number 34 and the ends and courtyards (plain). Camminamento photos of the Mura delle Cattive show Palazzo Butera, not this house.
//
// Palazzo Alliata di Pietratagliata (palace w279887923 and tower w279884877), Via Bandiera at Via Pizzuto. Commons "Palazzu Alliata di Pietratagliata ex Termini.jpg" and "... - finestra.jpg" (2009),
//  "Palermo - panoramio (46).jpg" (2013), "A street in Palermo, Sicily, Italy (22691619853).jpg" (1932); palazzoalliata.it for the history. Read: grey brown dressed stone, a pointed portal, two small
//  traceried windows, a moulded sill course, four two light windows under arched hoods, the corner window with flamboyant tracery and carved heads that wraps round to Via Pizzuto, a plain coping; the corner
//  column at street level; behind, the square tower in paler stone with a small window and ledge on the street face, a row of putlog holes and merlons.
//  Not verified: the east and south faces of the tower, the back of the palace and all but the first bay on Via Pizzuto (plain stone), the tracery in detail.
//
// Palazzo Francavilla (w230569846), Piazza Verdi at the corner of Via Ruggero Settimo. Mapillary 717720312700327, 359131826169072, 964943810836185, 148780257654296 (April 2022);
//  Commons "Via Ruggero Settimo da Piazza Verdi 02.jpg" (2026). Read: pale rusticated ground floor, red walls with ochre stone: nine bays to the square (an end bay, a quoin strip, seven bays, a strip,
//  an end bay), columned windows with triangular and curved pediments in turn, a stone balcony on brackets under each, small windows below them, a carved frieze and a deep bracketed cornice; the same
//  system to Via Ruggero Settimo with a columned doorway in the middle; two bays on the west end with a square window in the frieze.
//  Not verified: the bay count on Via Ruggero Settimo (seven, by its length and the part seen), which bay holds the doorway, the north side on Via Sperlinga and the courtyard (plain), shop signs.
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, extrude, prism, gridMesh, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, rail, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const lowest = (pts) => Math.min(...pts.map(p => groundY(p[0], p[1])));
// one wall of the footprint poly from a to b: M a frame in its middle at height y0 (+z out), L its length, A its left end as seen from outside, B its right end
function side(poly, a, b, y0) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = -dz / L, nz = dx / L;
  if (inPoly(poly, mx + nx * 0.25, mz + nz * 0.25)) { nx = -nx; nz = -nz; }
  const flip = dx * nz - dz * nx < 0, A = flip ? b : a, B = flip ? a : b;
  return { M: frame(mx, y0, mz, nx, nz), L, A, B, nx, nz, y0 };
}
// an upright quad on a side, from u0 to u1 metres from its left end and h0 to h1 above y0; rect [x, y, w, h] is the canvas area (cw x ch pixels) it shows
function quad(key, S, u0, u1, h0, h1, o = {}) {
  const at = (u) => [S.A[0] + (S.B[0] - S.A[0]) * u / S.L, S.A[1] + (S.B[1] - S.A[1]) * u / S.L];
  const out = o.out || 0, a = at(u0), b = at(u1); for (const q of [a, b]) { q[0] += S.nx * out; q[1] += S.nz * out; }
  const P = [[[a[0], S.y0 + h0, a[1]], [b[0], S.y0 + h0, b[1]]], [[a[0], S.y0 + h1, a[1]], [b[0], S.y0 + h1, b[1]]]];
  let uvf = (i, j, p) => [(j ? u1 : u0) / 4, p[1] / 4];
  if (o.rect) { const [x, y, w, h] = o.rect, [cw, ch] = o.canvas; uvf = (i, j) => [(x + w * (j ? 1 : 0)) / cw, 1 - (y + h * (i ? 0 : 1)) / ch]; }
  gridMesh(key, P, uvf, { c: o.c, noao: true });
}
// a painted front: the whole side, H high, shows the canvas area rect; below it a footing in the colour foot down to lo
function front(key, canvas, S, rect, H, lo, foot) { quad(key, S, 0, S.L, 0, H, { rect, canvas }); quad('flat', S, 0, S.L, lo - S.y0, 0.01, { c: foot }); }
const plain = (S, H, lo, c) => quad('flat', S, 0, S.L, lo - S.y0, H, { c });
// x along a side measured from its left end, for the 3D pieces in the frame S.M
const X = (S, u) => u - S.L / 2;
const slab = (S, u0, u1, h0, h1, z0, z1, c) => bx('flat', S.M, X(S, u0), X(S, u1), h0, h1, z0, z1, { c, noao: true });
const band = (S, h0, h1, d, c, over = 0) => slab(S, -over, S.L + over, h0, h1, -0.05, d, c);
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const solid = (S, pts, z0, z1, c) => extrude('flat', shapeOf(pts.map(q => [X(S, q[0]), q[1]])), z1 - z0, { M: S.M, p: [0, 0, z0], c, noao: true });
// a triangular or curved pediment, base at height h, width w, rise r
const pedi = (S, u, h, w, r, curved, c, d = 0.28) => {
  const p = curved ? [[u - w / 2, h], [u + w / 2, h], [u + w * 0.42, h + r * 0.6], [u + w * 0.22, h + r * 0.92], [u, h + r], [u - w * 0.22, h + r * 0.92], [u - w * 0.42, h + r * 0.6]] : [[u - w / 2, h], [u + w / 2, h], [u, h + r]];
  solid(S, p, -0.02, d, c);
};
// an iron balcony: stone slab, brackets, the shared rail on three sides
function balcony(S, u0, u1, h, d, o = {}) {
  const c = o.c || '#cfc4ac', n = Math.max(2, Math.round((u1 - u0) / (o.gap || 1.2)));
  slab(S, u0, u1, h - 0.18, h, -0.02, d, c);
  for (let i = 0; i <= n; i++) { const u = u0 + 0.12 + (u1 - u0 - 0.24) * i / n; solid2(S, u, h - 0.18, d * 0.85, o.bh || 0.5, o.bc || c); }
  rail(mul(S.M, tr(X(S, (u0 + u1) / 2), h, d - 0.04)), u1 - u0 - 0.04, o.rh || 1.0);
  for (const u of [u0 + 0.03, u1 - 0.03]) rail(mul(mul(S.M, tr(X(S, u), h, d / 2)), new THREE.Matrix4().makeRotationY(PI / 2)), d - 0.06, o.rh || 1.0);
}
// a bracket: a wedge under a slab, u along the side, top at h, reaching d out, drop deep
function solid2(S, u, h, d, drop, c) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(0, -drop); s.closePath();
  extrude('flat', s, 0.16, { M: S.M, p: [X(S, u) + 0.08, h, -0.02], ry: -PI / 2, c, noao: true });
}
// painter for the area [px, py, pw, ph] of a canvas covering L x H metres, u from the left, h up from the foot
function area(g, [px, py, pw, ph], L, H) {
  const sx = pw / L, sy = ph / H, U = (u) => px + u * sx, V = (h) => py + ph - h * sy;
  const R = (u0, h0, u1, h1, c) => { g.fillStyle = c; g.fillRect(U(u0), V(h1), (u1 - u0) * sx, (h1 - h0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(U(q[0]), V(q[1])) : g.moveTo(U(q[0]), V(q[1]))); g.closePath(); g.fill(); };
  const arch = (u, h0, h1, w, c) => { const r = w / 2; g.fillStyle = c; g.beginPath(); g.moveTo(U(u - r), V(h0)); g.lineTo(U(u - r), V(h1 - r)); g.ellipse(U(u), V(h1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(U(u + r), V(h0)); g.fill(); };
  const point = (u, h0, h1, w, c) => { const r = w / 2, s = h1 - w * 0.75; g.fillStyle = c; g.beginPath(); g.moveTo(U(u - r), V(h0)); g.lineTo(U(u - r), V(s)); g.quadraticCurveTo(U(u - r), V(h1 - r * 0.35), U(u), V(h1)); g.quadraticCurveTo(U(u + r), V(h1 - r * 0.35), U(u + r), V(s)); g.lineTo(U(u + r), V(h0)); g.fill(); };
  const circ = (u, h, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(U(u), V(h), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (u0, h0, u1, h1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(U(u0), V(h0)); g.lineTo(U(u1), V(h1)); g.stroke(); };
  const clip = (fn) => { g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip(); fn(); g.restore(); };
  // louvred shutters or a glazed window in the opening
  const shut = (u, h0, h1, w, c, dark = 'rgba(0,0,0,0.3)') => { R(u - w / 2, h0, u + w / 2, h1, c); for (let h = h0 + 0.12; h < h1; h += 0.17) R(u - w / 2, h, u + w / 2, h + 0.04, dark); R(u - 0.03, h0, u + 0.03, h1, dark); };
  const glass = (u, h0, h1, w, c = '#2e333a', bar = '#c9c2b0') => { R(u - w / 2, h0, u + w / 2, h1, c); R(u - w / 2, h0 + (h1 - h0) * 0.5, u + w / 2, h1, 'rgba(150,175,200,0.18)'); R(u - 0.03, h0, u + 0.03, h1, bar); R(u - w / 2, h0 + (h1 - h0) * 0.68, u + w / 2, h0 + (h1 - h0) * 0.68 + 0.05, bar); };
  const grille = (u, h0, h1, w) => { R(u - w / 2, h0, u + w / 2, h1, '#2a2420'); for (let k = u - w / 2 + 0.14; k < u + w / 2; k += 0.24) R(k, h0, k + 0.04, h1, '#6a5c4c'); for (let h = h0 + 0.2; h < h1; h += 0.28) R(u - w / 2, h, u + w / 2, h + 0.04, '#6a5c4c'); };
  // horizontal grooves (rustication) with a few upright joints
  const courses = (u0, u1, h0, h1, step, c, hi, seed) => { const r = RNG(seed); for (let h = h0 + step; h < h1 - 0.1; h += step) { R(u0, h, u1, h + 0.06, c); R(u0, h + 0.06, u1, h + 0.1, hi); if (seed) for (let u = u0 + r() * 1.5; u < u1; u += 1.2 + r()) R(u, h - step + 0.1, u + 0.045, h, c); } };
  return { sx, sy, U, V, R, poly, arch, point, circ, line, clip, shut, glass, grille, courses, L, H };
}
// stains, streaks and grain over the whole canvas
function grime(g, w, h, seed, k = 1) {
  const r = RNG(seed);
  for (let i = 0; i < 16; i++) { const x = r() * w, y = r() * h, rad = 20 + r() * 90, c = r() < 0.6 ? '70,48,28' : '255,244,220', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${c},${(0.07 + r() * 0.08) * k})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad); }
  streaks(g, w, h, Math.round(w / 12), seed + 1, 0.12 * k, h * 0.12, '50,36,22');
  noiseDots(g, w, h, w * h / 60, 1.6, seed + 2, [`rgba(60,42,25,${0.11 * k})`, `rgba(255,246,225,${0.08 * k})`]);
}
// a painted texture laid out on a size[0] x size[1] canvas and painted at K of it, to save memory
const K = 0.75;
const paintMat = (key, size, paint) => defMat(key, size[0] * K, size[1] * K, [4, 4], (g) => { g.save(); g.scale(K, K); paint(g, size[0], size[1]); g.restore(); });
// the roof: a thin flat lid over the footprint
const lid = (pts, y, c) => prism('flat', pts, y - 0.12, y, { c, noao: true });

// =====================================================================================================
// Palazzo Bonocore
// =====================================================================================================
const BO = { id: 'w86870881', p: [62.0, -12.6, 64.3, -5.9, 65.9, -1.1, 66.2, -0.2, 94.5, -3.8, 92.1, -15.3, 91.4, -18.5, 89.7, -26.9] };
const BOH = 19.7, BOC = [1024, 512], BOS = [0, 0, 570, 256], BOW1 = [580, 0, 142, 256], BOW2 = [730, 0, 120, 256], BOK = [0, 256, 624, 256];
const BOST = '#c8a774', BOTR = '#d6ba86', BOGR = '#a8a298', BOSH = '#5b3b35', BOPK = '#cbb197', BOPT = '#dcc6aa';
const BOPW = [3.0, 7.15, 10.45, 13.9, 17.55, 21.0, 25.4], BOUW = [2.7, 6.75, 10.45, 13.6, 17.25, 21.05, 25.1];
const BOPIL = [0.5, 1.25, 4.65, 5.4, 8.75, 12.1, 15.75, 19.3, 22.8, 23.6, 27.1, 27.95];
const BOKB = [0, 1, 2, 3, 4, 5, 6, 7].map(i => 1.95 + i * 3.9);
function boPaint(g, w, h) {
  const all = area(g, [0, 0, w, h], w, h); all.R(0, 0, w, h, BOST);
  // ---- Piazza Pretoria
  let p = area(g, BOS, 28.5, BOH);
  p.clip(() => {
    p.R(0, 0, 28.5, BOH, BOST);
    p.courses(0, 28.5, 1.45, 7.7, 0.56, 'rgba(105,72,34,0.42)', 'rgba(255,238,196,0.35)', 8101);
    p.R(0, 0, 28.5, 1.45, BOGR); p.R(0, 1.3, 28.5, 1.45, '#c2bcae');
    for (const [u, ww] of [[7.4, 2.05], [14.1, 2.25], [21.25, 2.35]]) {
      p.arch(u, 0, 6.95, ww + 0.8, BOTR); p.arch(u, 0, 6.7, ww + 0.18, '#8d714c'); p.arch(u, 0, 6.6, ww, '#2e2220');
      p.R(u - ww / 2, 0.05, u + ww / 2, 5.15, '#4b3335'); p.R(u - 0.04, 0.05, u + 0.04, 5.15, '#241719');
      for (const s of [-1, 1]) for (const [a, b] of [[0.4, 1.7], [2.0, 3.6], [3.9, 4.9]]) { p.R(u + s * ww / 4 - ww / 6, a, u + s * ww / 4 + ww / 6, b, '#5a3f40'); p.R(u + s * ww / 4 - ww / 6, b - 0.07, u + s * ww / 4 + ww / 6, b, '#2c1d1f'); }
      for (let i = 1; i < 8; i++) { const a = i / 8 * PI; p.line(u, 5.2, u + Math.cos(a) * ww / 2, 5.2 + Math.sin(a) * 1.35, 0.06, '#8a7a68'); }
      p.R(u - ww / 2, 5.12, u + ww / 2, 5.26, '#6b5846'); p.circ(u, 7.15, 0.3, '#bd9c6c'); p.circ(u, 7.18, 0.16, '#93764f');
    }
    for (const [u, ww, a, b, c, d] of [[3.08, 1.0, 3.6, 6.1, 1.5, 2.6], [10.75, 1.1, 3.5, 6.2, 1.4, 2.5], [17.6, 1.1, 3.5, 6.2, 1.4, 2.5], [25.45, 1.15, 3.7, 6.3, 1.5, 2.7]]) {
      p.R(u - ww / 2 - 0.12, a - 0.15, u + ww / 2 + 0.12, b + 0.14, BOTR); p.glass(u, a, b, ww, '#392a27', '#7a5f4e'); p.R(u - ww / 2, a + 0.05, u + ww / 2, a + 1.0, 'rgba(25,18,16,0.55)');
      p.R(u - ww / 2 - 0.1, c - 0.1, u + ww / 2 + 0.1, d + 0.1, BOTR); p.grille(u, c, d, ww);
    }
    p.R(0, 7.0, 28.5, 7.75, 'rgba(80,52,26,0.28)');
    for (const u of BOPW) { p.R(u - 0.98, 8.05, u + 0.98, 12.0, BOTR); p.shut(u, 8.1, 11.8, 1.55, BOSH); p.R(u - 1.35, 12.0, u + 1.35, 12.3, 'rgba(90,60,28,0.35)'); p.R(u - 1.38, 12.3, u + 1.38, 12.65, BOTR); }
    for (const u of BOPIL) { p.R(u - 0.37, 9.2, u + 0.37, 15.2, '#cdaf7c'); p.R(u + 0.3, 9.2, u + 0.5, 15.2, 'rgba(90,60,28,0.5)'); p.R(u - 0.45, 9.2, u - 0.37, 15.2, 'rgba(90,60,28,0.3)'); for (const k of [-0.17, 0, 0.17]) p.R(u + k - 0.025, 9.8, u + k + 0.025, 14.9, 'rgba(110,76,38,0.3)'); p.R(u - 0.44, 15.2, u + 0.44, 15.75, '#a8824f'); for (let k = -2; k <= 2; k++) p.circ(u + k * 0.17, 15.35 + Math.abs(k) * 0.07, 0.09, '#a8885a'); }
    BOUW.forEach((u, i) => {
      p.R(u - 0.75, 13.95, u + 0.75, 15.5, BOTR);
      if (i === 2) { p.shut(u, 14.1, 15.35, 1.3, '#6d4038'); return; }
      p.glass(u, 14.1, 15.35, 0.95, '#c8d2d4', '#5a4a42'); p.R(u - 0.42, 14.15, u + 0.42, 15.3, 'rgba(40,60,60,0.45)');
      for (const s of [-1, 1]) p.shut(u + s * 0.82, 14.08, 15.37, 0.64, '#4a3a36');
    });
    p.R(0, 16.05, 28.5, 16.3, 'rgba(90,60,28,0.22)'); p.R(0, 16.3, 28.5, 16.8, BOTR); for (let u = 0.15; u < 28.5; u += 0.36) p.R(u, 16.3, u + 0.16, 16.48, '#8f734c');
    for (const [a, b] of [[1.9, 5.25], [6.0, 8.3], [19.7, 23.25], [23.9, 26.6]]) { p.R(a, 17.5, b, 18.95, '#c8ab78'); p.R(a + 0.12, 17.62, b - 0.12, 18.83, '#d4b783'); }
    p.poly([[7.9, 16.8], [19.6, 16.8], [13.75, 19.45]], BOTR); p.poly([[8.9, 17.05], [18.6, 17.05], [13.75, 19.15]], '#ceb27e'); p.circ(13.88, 17.85, 0.56, BOTR); p.circ(13.88, 17.85, 0.4, '#b1905f'); p.circ(13.88, 17.85, 0.2, '#d4b884');
    p.R(0, 19.4, 28.5, BOH, BOTR);
  });
  // ---- Discesa dei Musici: the restaurant's arch on the first stretch, one bay on the second
  const bay = (q, u, wide) => {
    for (const [a, b] of [[6.0, 8.5], [10.2, 13.1], [14.9, 16.9]]) { q.R(u - wide / 2 - 0.2, a - 0.05, u + wide / 2 + 0.2, b + 0.25, BOPT); q.shut(u, a, b, wide, '#453631'); q.R(u - wide / 2 - 0.4, b + 0.25, u + wide / 2 + 0.4, b + 0.45, '#b4997f'); }
  };
  for (const [rect, L] of [[BOW1, 7.1], [BOW2, 6.0]]) {
    p = area(g, rect, L, BOH);
    p.clip(() => {
      p.R(0, 0, L, BOH, BOPK); p.courses(0, L, 0.9, 5.4, 0.5, 'rgba(100,72,48,0.4)', 'rgba(255,240,220,0.3)', 8103); p.courses(0, L, 5.4, 17.8, 0.62, 'rgba(100,72,48,0.2)', 'rgba(255,240,220,0.18)');
      p.R(0, 0, L, 0.9, BOGR);
      if (L > 7) { p.arch(3.55, 0, 5.15, 3.9, BOPT); p.arch(3.55, 0, 4.9, 3.4, '#161210'); p.R(2.4, 0.1, 4.7, 2.5, '#40342a'); g.fillStyle = '#e8e2d4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(0.62 * p.sy)}px serif`; g.fillText('PLAZA', p.U(3.55), p.V(3.75)); g.fillText('PRETORIA', p.U(3.55), p.V(3.05)); }
      else { p.R(1.7, 0, 4.3, 3.9, BOPT); p.glass(3.0, 0.1, 3.7, 2.2, '#2c2622', '#5a4c40'); }
      bay(p, L > 7 ? 3.55 : 3.0, 1.35); p.R(0, 18.7, L, BOH, BOPT);
    });
  }
  // ---- the Corso
  p = area(g, BOK, 31.2, BOH);
  p.clip(() => {
    p.R(0, 0, 31.2, BOH, BOPK); p.courses(0, 31.2, 0.9, 5.4, 0.5, 'rgba(100,72,48,0.4)', 'rgba(255,240,220,0.3)', 8104); p.courses(0, 31.2, 5.4, 17.8, 0.62, 'rgba(100,72,48,0.2)', 'rgba(255,240,220,0.18)');
    p.R(0, 0, 31.2, 0.9, BOGR);
    for (const u of BOKB) { p.arch(u, 0, 4.95, 3.0, BOPT); p.arch(u, 0.2, 4.7, 2.5, '#27292a'); p.R(u - 1.25, 3.3, u + 1.25, 3.42, '#6a5a4a'); p.R(u - 0.04, 0.2, u + 0.04, 4.6, '#6a5a4a'); p.R(u - 1.0, 0.3, u + 1.0, 3.2, 'rgba(170,190,195,0.14)'); bay(p, u, 1.45); p.arch(u, 12.75, 13.95, 2.4, BOPT); p.arch(u, 12.75, 13.7, 1.9, '#a88c70'); }
    p.R(0, 17.9, 31.2, 18.7, '#bda187'); p.R(0, 18.7, 31.2, BOH, BOPT); for (let u = 0.2; u < 31.2; u += 0.55) p.R(u, 18.45, u + 0.24, 18.7, '#8e745c');
  });
  grime(g, w, h, 8110);
}
function buildBonocore() {
  initShared();
  paintMat('p2rBono', BOC, boPaint);
  const P = pairsOf(BO.p), y0 = lowest(P), lo = y0 - 1.5;
  begin(y0);
  const S = side(P, P[3], P[4], y0), K = side(P, P[7], P[0], y0), W1 = side(P, P[0], P[1], y0), W2 = side(P, P[1], P[3], y0);
  front('p2rBono', BOC, S, BOS, BOH, lo, '#8c867c'); front('p2rBono', BOC, K, BOK, BOH, lo, '#8c867c'); front('p2rBono', BOC, W1, BOW1, BOH, lo, '#8c867c'); front('p2rBono', BOC, W2, BOW2, BOH, lo, '#8c867c');
  // Salita Santa Caterina: plain, with the cornices carried round
  for (const [i, j] of [[4, 5], [5, 6], [6, 7]]) { const E = side(P, P[i], P[j], y0); plain(E, BOH, lo, '#bd9d6c'); band(E, 7.7, 8.05, 0.12, BOTR); band(E, 16.3, 16.8, 0.25, BOTR); band(E, 19.4, 19.75, 0.18, BOTR); }
  // Piazza Pretoria in relief
  band(S, 0, 1.4, 0.07, BOGR);
  for (const [a, b] of [[0, 6.05], [8.75, 12.8], [15.45, 19.8], [22.75, 28.5]]) slab(S, a, b, 1.38, 1.46, -0.02, 0.1, '#c2bcae');
  balcony(S, 0.35, 27.25, 8.1, 0.95, { gap: 1.3, bh: 0.5, rh: 1.1, c: '#c7a977', bc: '#c2a16c' });
  for (const u of BOPW) { slab(S, u - 1.38, u + 1.38, 12.35, 12.65, -0.02, 0.22, BOTR); slab(S, u - 1.2, u + 1.2, 12.22, 12.36, -0.02, 0.12, '#caa974'); }
  for (const u of BOPIL) { slab(S, u - 0.3, u + 0.3, 9.2, 15.2, -0.02, 0.07, '#cbad7a'); slab(S, u - 0.42, u + 0.42, 15.25, 15.75, -0.02, 0.14, '#ae8a58'); }
  band(S, 16.45, 16.8, 0.36, BOTR); band(S, 16.3, 16.45, 0.18, '#c8a974');
  for (const q of [[[7.75, 16.75], [8.55, 16.75], [13.75, 19.12], [13.75, 19.5]], [[19.75, 16.75], [13.75, 19.5], [13.75, 19.12], [18.95, 16.75]]]) solid(S, q, -0.02, 0.3, BOTR);
  band(S, 19.45, 19.75, 0.2, BOTR);
  // the Corso: two long balconies, small ones at the top, the cornice
  balcony(K, 0.6, 30.6, 6.0, 0.65, { gap: 1.95, bh: 0.55, c: '#c9b095', bc: '#bda286' });
  balcony(K, 0.3, 30.9, 10.2, 0.85, { gap: 1.55, bh: 0.7, c: '#c9b095', bc: '#bda286' });
  for (const u of BOKB) { balcony(K, u - 1.05, u + 1.05, 14.9, 0.5, { gap: 1.8, bh: 0.35, c: '#c9b095' }); slab(K, u - 1.2, u + 1.2, 13.85, 14.05, -0.02, 0.18, BOPT); }
  band(K, 18.7, 19.15, 0.35, BOPT); band(K, 19.15, 19.75, 0.55, '#d3bda2');
  for (const [E, u] of [[W1, 3.55], [W2, 3.0]]) { balcony(E, u - 1.5, u + 1.5, 6.0, 0.55, { gap: 1.3, c: '#c9b095' }); balcony(E, u - 1.3, u + 1.3, 10.2, 0.55, { gap: 1.2, c: '#c9b095' }); balcony(E, u - 1.0, u + 1.0, 14.9, 0.4, { gap: 1.7, bh: 0.3, c: '#c9b095' }); band(E, 18.7, 19.75, 0.35, BOPT); }
  lid(P, y0 + BOH, '#8f8478');
  const o = end('Palazzo Bonocore');
  o.userData.solids = [[BO.p, null, y0 + BOH]];
  return o;
}

// =====================================================================================================
// Palazzo Costantino di Napoli
// =====================================================================================================
const NA = { id: 'w279883469', p: [17.2, -29.2, 19.0, -23.7, 28.6, -28.8, 27.2, -31.5, 32.3, -33.9, 27.0, -44.1, 28.0, -44.6, 31.2, -46.3, 33.5, -41.9, 35.8, -43.2, 49.0, -18.3, 28.1, -7.2, 24.8, -9.3, 22.6, -10.2, 20.3, -10.8, 16.1, -11.1, 7.8, -25.9] };
const NAH = 22.0, NAC = [768, 384], NAK = [0, 0, 437, 384], NAM = [445, 0, 313, 384];
const NAOR = '#c98f55', NALT = '#ddb57c', NADK = '#a8723f', NACR = '#d7b986', NAGR = '#c6bcaa';
const NAKB = [2.2, 6.15, 10.05, 13.95, 17.85, 21.6], NAMB = [2.15, 6.4, 10.65, 14.9];
function naPaint(g, w, h) {
  const all = area(g, [0, 0, w, h], w, h); all.R(0, 0, w, h, NAOR);
  const upper = (p, bays, wall, trim, dk, heads) => {
    p.R(0, 7.0, p.L, 7.75, 'rgba(70,40,15,0.34)');
    for (const u of bays) {
      // the main floor: tall shuttered window, stone frame, the hood (a round tympanum with a head on the Corso)
      p.R(u - 0.95, 7.9, u + 0.95, 11.65, trim); p.shut(u, 8.0, 11.35, 1.35, '#6a4c36');
      if (heads) { p.arch(u, 11.75, 13.5, 2.3, trim); p.arch(u, 11.9, 13.25, 1.8, dk); p.circ(u, 12.55, 0.3, '#e6cfa6'); p.circ(u, 12.1, 0.42, '#d9bc8c'); p.R(u - 1.2, 11.65, u + 1.2, 11.85, trim); }
      else { p.R(u - 1.15, 11.75, u + 1.15, 12.2, trim); p.R(u - 1.0, 11.6, u + 1.0, 11.75, 'rgba(70,40,15,0.35)'); }
      p.R(u - 0.85, 14.9, u + 0.85, 18.3, trim); p.glass(u, 15.0, 18.0, 1.2, '#3a302a', '#8a745a'); p.R(u - 0.6, 15.0, u - 0.18, 18.0, '#70503a'); p.R(u - 1.0, 18.35, u + 1.0, 18.6, trim); p.R(u - 0.9, 14.3, u + 0.9, 14.85, 'rgba(70,40,15,0.3)');
    }
    p.R(0, 19.6, p.L, 20.75, dk); for (let u = 0.2; u < p.L; u += 0.72) p.R(u, 19.85, u + 0.3, 20.75, trim); p.R(0, 20.75, p.L, NAH, trim); p.R(0, 20.62, p.L, 20.75, 'rgba(50,28,10,0.4)');
  };
  // ---- the Corso, the canto at the left
  let p = area(g, NAK, 23.7, NAH);
  p.clip(() => {
    p.R(0, 0, 23.7, NAH, NAOR); p.courses(0, 23.7, 0.8, 7.0, 0.55, 'rgba(90,48,16,0.45)', 'rgba(255,222,170,0.3)'); p.R(0, 0, 23.7, 0.8, '#a99c8a');
    p.arch(2.2, 0, 5.6, 3.4, NALT); p.arch(2.2, 0, 5.3, 2.8, '#33211a'); p.R(1.05, 0.1, 3.35, 3.75, '#442c20'); p.R(2.16, 0.1, 2.24, 3.75, '#1f140e');
    for (const s of [-1, 1]) for (const [a, b] of [[0.4, 1.5], [1.75, 3.4]]) { p.R(2.2 + s * 0.57 - 0.4, a, 2.2 + s * 0.57 + 0.4, b, '#5a3a28'); p.R(2.2 + s * 0.57 - 0.4, b - 0.07, 2.2 + s * 0.57 + 0.4, b, '#241610'); }
    p.R(1.0, 3.75, 3.4, 3.95, '#5a4232'); p.circ(2.2, 4.45, 0.42, '#55382a'); p.circ(2.2, 4.45, 0.22, '#2c1b14');
    p.R(1.35, 5.65, 3.05, 7.05, NALT); p.glass(2.2, 5.75, 6.95, 1.45, '#6c7a76', '#4a3a2c');
    NAKB.slice(1).forEach((u, i) => {
      p.R(u - 1.15, 0, u + 1.15, 3.15, NADK); p.arch(u, 2.6, 3.95, 2.3, '#b27a45');
      if (i === 0 || i === 3) { p.R(u - 0.95, 0.05, u + 0.95, 3.0, '#8f8c86'); for (let a = 0.2; a < 3.0; a += 0.2) p.R(u - 0.95, a, u + 0.95, a + 0.05, '#5f5c56'); }
      else p.glass(u, 0.1, 3.0, 1.8, '#2b2824', '#6a5440');
      p.R(u - 0.78, 4.3, u + 0.78, 6.95, NALT); p.glass(u, 4.4, 6.8, 1.2, '#46525a', '#a89070');
    });
    upper(p, NAKB, NAOR, NALT, NADK, true);
  });
  // ---- Via Maqueda, the canto at the right
  p = area(g, NAM, 17.0, NAH);
  p.clip(() => {
    p.R(0, 0, 17, NAH, NACR); p.R(0, 0, 17, 4.35, NAGR); p.R(0, 4.1, 17, 4.35, '#ddd4c2'); p.R(0, 0, 17, 1.05, '#85887e');
    NAMB.forEach((u, i) => {
      p.R(u - 1.45, 0, u + 1.45, 3.65, '#948b80'); p.R(u - 1.12, 0.05, u + 1.12, 3.35, '#26231f');
      if (i === 1) { p.R(u - 1.0, 0.1, u + 1.0, 2.7, '#8d8a84'); for (let a = 0.2; a < 2.7; a += 0.2) p.R(u - 1.0, a, u + 1.0, a + 0.05, '#5c5953'); } else { p.glass(u, 0.1, 2.7, 1.9, '#33322e', '#8a8478'); }
      p.R(u - 1.12, 2.75, u + 1.12, 3.3, i === 2 ? '#e4e0d6' : '#55504a');
      p.R(u - 0.8, 4.55, u + 0.8, 6.95, '#e0c998'); p.glass(u, 4.65, 6.8, 1.25, '#3c4246', '#9a8a70');
    });
    upper(p, NAMB, NACR, '#e6d0a2', '#bd9a66', false);
  });
  grime(g, w, h, 8210);
}
function buildCostantino() {
  initShared();
  paintMat('p2rNapo', NAC, naPaint);
  const P = pairsOf(NA.p), y0 = Math.min(groundY(...P[10]), groundY(...P[11]), groundY(...P[15]), groundY(...P[16])), lo = lowest(P) - 1.5;
  begin(y0);
  const K = side(P, P[10], P[11], y0), M = side(P, P[15], P[16], y0);
  front('p2rNapo', NAC, K, NAK, NAH, lo, '#8d7f6c'); front('p2rNapo', NAC, M, NAM, NAH, lo, '#77746a');
  // the walls behind the concave corner (which stands in front of them) and the short returns that close the slits at its two ends
  for (let i = 11; i < 15; i++) plain(side(P, P[i], P[i + 1], y0), NAH, lo, '#9c875f');
  for (const [a, b] of [[[16.17, -10.9], [16.1, -11.1]], [[28.1, -7.2], [27.73, -6.89]]]) { const dx = b[0] - a[0], dz = b[1] - a[1]; gridMesh('flat', [[[a[0], lo, a[1]], [b[0], lo, b[1]]], [[a[0], y0 + NAH, a[1]], [b[0], y0 + NAH, b[1]]]], () => [0, 0], { c: '#9c875f', noao: true }); gridMesh('flat', [[[b[0], lo, b[1]], [a[0], lo, a[1]]], [[b[0], y0 + NAH, b[1]], [a[0], y0 + NAH, a[1]]]], () => [0, 0], { c: '#9c875f', noao: true }); }
  for (let i = 0; i < 10; i++) plain(side(P, P[i], P[i + 1], y0), NAH, lo, i === 9 ? '#bd8a58' : '#a99478');
  plain(side(P, P[16], P[0], y0), NAH, lo, '#a99478');
  // the Corso in relief
  const iron = '#5a3c28';
  for (const u of NAKB.slice(1)) balcony(K, u - 1.05, u + 1.05, 4.4, 0.55, { gap: 1.7, bh: 0.45, c: '#b98a58', bc: iron });
  balcony(K, 0.15, 23.5, 7.95, 0.95, { gap: 0.98, bh: 0.9, rh: 1.1, c: '#b5834f', bc: '#9c6c40' });
  for (const u of NAKB) {
    const arc = []; for (let i = 0; i <= 6; i++) { const a = PI * i / 6; arc.push([u + Math.cos(a) * 1.18, 12.35 + Math.sin(a) * 1.18]); }
    for (let i = 6; i >= 0; i--) { const a = PI * i / 6; arc.push([u + Math.cos(a) * 0.95, 12.35 + Math.sin(a) * 0.95]); }
    solid(K, arc, -0.02, 0.2, NALT); slab(K, u - 1.22, u + 1.22, 11.72, 11.92, -0.02, 0.24, NALT);
    sphere('flat', 0.24, { M: K.M, p: [X(K, u), 12.62, 0.04], seg: 6, c: '#e2c9a0', noao: true });
    balcony(K, u - 1.15, u + 1.15, 14.9, 0.7, { gap: 1.9, bh: 0.6, c: '#b5834f', bc: iron });
  }
  band(K, 20.75, 21.35, 0.4, NALT); band(K, 21.35, 22.15, 0.7, '#c9925c');
  // Via Maqueda in relief
  for (const u of NAMB) { balcony(M, u - 1.15, u + 1.15, 4.6, 0.6, { gap: 1.8, bh: 0.55, c: '#9a9284', bc: '#4a443c' }); slab(M, u - 1.15, u + 1.15, 11.75, 12.1, -0.02, 0.2, '#e6d0a2'); balcony(M, u - 1.15, u + 1.15, 14.9, 0.65, { gap: 1.9, bh: 0.55, c: '#bfa57c', bc: '#4a443c' }); }
  balcony(M, 0.15, 16.85, 7.95, 0.8, { gap: 1.05, bh: 0.75, rh: 1.1, c: '#a89472', bc: '#6a5a44' });
  band(M, 20.75, 21.35, 0.35, '#e6d0a2'); band(M, 21.35, 22.15, 0.6, '#d2b585');
  lid(P, y0 + NAH, '#97887a');
  const o = end('Palazzo Costantino di Napoli');
  o.userData.solids = [[NA.p, null, y0 + NAH]];
  return o;
}

// =====================================================================================================
// Palazzo Lanza Tomasi
// =====================================================================================================
const LT = {
  a: 'w279883620', pa: [916.9, -243.8, 914.8, -247.7, 921.1, -250.3, 923.1, -251.8, 927.3, -244.1, 929.6, -240.7, 939.0, -247.9, 943.0, -250.5, 946.3, -245.2, 931.4, -233.8, 937.7, -223.6, 932.6, -220.6, 936.4, -214.9, 939.2, -216.7, 938.3, -218.4, 940.4, -219.5, 943.9, -214.4, 939.8, -210.4, 943.1, -205.7, 939.1, -202.5, 930.6, -214.4, 928.8, -213.4, 920.0, -226.9, 912.1, -241.1],
  b: 'w279883350', pb: [930.6, -214.4, 939.1, -202.5, 943.1, -205.7, 939.8, -210.4, 943.9, -214.4, 940.4, -219.5, 937.7, -223.6, 931.4, -233.8, 946.3, -245.2, 964.3, -213.6, 953.0, -206.6, 940.4, -197.1, 928.8, -213.4],
};
const LTHA = 20.6, LTHB = 17.9, LTC = [640, 512], LTB = [0, 0, 640, 256], LTS = [0, 256, 640, 256];
const LTCR = '#e6d5ab', LTCT = '#f0e3c2', LTWH = '#e8e2d3', LTOC = '#c89d60', LTGN = '#2e4a3a';
const LTDOOR = [[3.4, 3.2, 5.1], [9.6, 2.2, 4.9], [14.4, 1.9, 4.3], [22.4, 2.4, 4.6], [28.8, 3.3, 5.2]];   // u from the north end, width, height
const LTSEA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 2.0 + i * 3.6);
function ltPaint(g, w, h) {
  // ---- Via Butera
  let p = area(g, LTB, 32.3, LTHA);
  p.clip(() => {
    p.R(0, 0, 32.3, LTHA, LTCR); p.courses(0, 32.3, 1.5, 5.4, 0.78, 'rgba(120,92,48,0.42)', 'rgba(255,248,220,0.45)', 8301); p.courses(0, 32.3, 5.8, 19.2, 0.9, 'rgba(120,92,48,0.17)', 'rgba(255,248,220,0.25)');
    p.R(0, 0, 32.3, 1.5, '#c4bba8'); p.R(0, 1.38, 32.3, 1.55, '#9f9a8e'); for (let u = 0.7; u < 32.3; u += 1.9) p.R(u, 0, u + 0.05, 1.38, 'rgba(90,80,65,0.45)');
    LTDOOR.forEach(([u, ww, hh], i) => {
      p.arch(u, 0, hh + 0.35, ww + 0.65, i === 1 ? '#b2aca0' : LTCT); p.arch(u, 0, hh, ww, '#4e3428'); p.R(u - 0.035, 0.05, u + 0.035, hh - 1.0, '#251710'); p.R(u - ww / 2, hh - ww / 2 - 0.06, u + ww / 2, hh - ww / 2 + 0.08, '#2e1d15'); p.circ(u, hh - ww / 4 - 0.05, ww / 8, '#634434');
      for (const s of [-1, 1]) for (let a = 0.35; a < hh - ww / 2 - 0.7; a += 1.0) { p.R(u + s * ww / 4 - ww / 6, a, u + s * ww / 4 + ww / 6, a + 0.75, '#5d4032'); p.circ(u + s * ww / 4, a + 0.38, 0.1, '#3a251b'); }
      for (const [a, b] of [[5.9, 8.7], [10.3, 13.2], [14.5, 17.0]]) {
        p.R(u - 0.95, a, u + 0.95, b + 0.22, LTCT); p.glass(u, a, b, 1.25, '#3b4448', '#d9d2c0');
        for (const s of [-1, 1]) p.shut(u + s * 0.9, a, b, 0.52, LTGN);
        p.R(u - 1.35, b + 0.35, u + 1.35, b + 0.52, '#d6c294');
        p.R(u - 1.6, a - 0.75, u + 1.6, a - 0.2, 'rgba(100,75,40,0.28)');
      }
    });
    p.R(0, 18.5, 32.3, 19.45, '#d8c497'); p.R(0, 19.45, 32.3, LTHA, LTCT); for (let u = 0.2; u < 32.3; u += 0.5) p.R(u, 19.2, u + 0.22, 19.45, '#a89168');
  });
  // ---- the sea front
  p = area(g, LTS, 36.4, LTHB);
  p.clip(() => {
    p.R(0, 0, 36.4, LTHB, LTWH); p.R(0, 9.15, 36.4, 9.45, LTOC);
    for (const [a, b] of [[0, 0.85], [35.55, 36.4]]) p.R(a, 0, b, 16.4, LTOC);
    LTSEA.forEach((u, i) => {
      p.R(u - 1.15, 10.05, u + 1.15, 14.15, LTOC); p.R(u - 0.9, 10.3, u + 0.9, 13.9, '#e9dcc0'); p.glass(u, 10.4, 13.75, 1.4, '#2c3434', '#8f9a88'); if (i % 3 !== 1) p.shut(u - 0.37, 10.4, 13.75, 0.66, '#33443a');
      if (i % 2) p.arch(u, 14.2, 15.35, 2.5, LTOC); else p.poly([[u - 1.35, 14.2], [u + 1.35, 14.2], [u, 15.25]], LTOC);
      p.R(u - 1.35, 14.12, u + 1.35, 14.32, '#d9b478');
    });
    p.R(0, 16.35, 36.4, 17.15, LTOC); p.R(0, 16.2, 36.4, 16.35, 'rgba(90,60,25,0.35)'); p.R(0, 17.15, 36.4, LTHB, '#ddd2bc'); p.R(0, 17.7, 36.4, LTHB, LTOC);
  });
  grime(g, w, h, 8310);
}
function buildLanza() {
  initShared();
  paintMat('p2rLanza', LTC, ltPaint);
  const A = pairsOf(LT.pa), B = pairsOf(LT.pb);
  const y0 = Math.min(groundY(...A[21]), groundY(...A[22]), groundY(...A[23])), lo = Math.min(lowest(A), lowest(B)) - 1.5;
  begin(y0);
  // Via Butera: the front bends a little at its middle; each half shows its part of the one picture (u from the north end)
  const N = side(A, A[22], A[23], y0), S = side(A, A[21], A[22], y0), cut = LTB[2] * N.L / (N.L + S.L);
  front('p2rLanza', LTC, N, [0, 0, cut, 256], LTHA, lo, '#a8a092'); front('p2rLanza', LTC, S, [cut, 0, LTB[2] - cut, 256], LTHA, lo, '#a8a092');
  for (let i = 0; i < A.length; i++) if (i !== 21 && i !== 22) plain(side(A, A[i], A[(i + 1) % A.length], y0), LTHA, lo, i === 20 ? LTCR : '#cdbf9e');
  const Sea = side(B, B[8], B[9], y0);
  front('p2rLanza', LTC, Sea, LTS, LTHB, lo, '#b3a68c');
  for (let i = 0; i < B.length; i++) if (i !== 8) plain(side(B, B[i], B[(i + 1) % B.length], y0), LTHB, lo, i === 11 ? '#dccca6' : '#d3c9b2');
  // Via Butera in relief: bracketed balconies over the doors, the cornice, the two columns
  LTDOOR.forEach(([u]) => {
    const [E, e] = u < N.L ? [N, u] : [S, u - N.L], w2 = Math.min(1.6, e - 0.02, E.L - e - 0.02);
    for (const [hh, d] of [[5.9, 0.7], [10.3, 0.62], [14.5, 0.55]]) balcony(E, e - w2, e + w2, hh, d, { gap: 1.0, bh: 0.55, c: '#d8d0bc', bc: '#6a5a46' });
  });
  const [cu, cw, ch] = LTDOOR[1];
  for (const s of [-1, 1]) {
    const x = X(N, cu + s * (cw / 2 + 0.42));
    cyl('flat', 0.2, 0.23, ch - 1.35, 8, { M: N.M, p: [x, 0.75, 0.07], c: '#a5a39c', noao: true });
    bx('flat', N.M, x - 0.3, x + 0.3, -0.5, 0.75, -0.02, 0.32, { c: '#bdb7a8', noao: true }); bx('flat', N.M, x - 0.3, x + 0.3, ch - 0.6, ch - 0.25, -0.02, 0.34, { c: '#c4bfb2', noao: true });
  }
  slab(N, cu - cw / 2 - 0.75, cu + cw / 2 + 0.75, ch - 0.25, ch + 0.05, -0.02, 0.34, '#c4bfb2');
  for (const E of [N, S]) { band(E, 19.45, 19.95, 0.3, LTCT); band(E, 19.95, 20.65, 0.5, '#dfcda2'); slab(E, 0, E.L, 5.2, 5.38, -0.02, 0.1, LTCT); }
  // the sea front in relief: pediments, pilasters, cornice
  LTSEA.forEach((u, i) => { pedi(Sea, u, 14.25, 2.6, 1.05, i % 2 === 1, LTOC, 0.2); slab(Sea, u - 1.35, u + 1.35, 14.12, 14.28, -0.02, 0.24, '#d9b478'); });
  for (const [a, b] of [[0, 0.85], [Sea.L - 0.85, Sea.L]]) slab(Sea, a, b, 0, 16.4, -0.02, 0.1, LTOC);
  band(Sea, 16.35, 16.75, 0.25, LTOC); band(Sea, 16.75, 17.15, 0.45, '#d0a668'); band(Sea, 17.7, 17.98, 0.15, LTOC);
  lid(A, y0 + LTHA, '#a08d7c'); lid(B, y0 + LTHB, '#a9684c');
  const o = end('Palazzo Lanza Tomasi');
  o.userData.solids = [[LT.pa, null, y0 + LTHA], [LT.pb, null, y0 + LTHB]];
  return o;
}
// the two columns of the door on Via Butera stand 0.32 m out of the footprint (the door is 9.6 m from the north end of the front, on its first edge from there)
const LANZA_WALLS = (() => {
  const A = [912.1, -241.1], B = [920.0, -226.9], l = Math.hypot(B[0] - A[0], B[1] - A[1]), r = [(B[0] - A[0]) / l, (B[1] - A[1]) / l], n = [-r[1], r[0]], out = [];
  for (const s of [-1, 1]) {
    const u = LTDOOR[1][0] + s * (LTDOOR[1][1] / 2 + 0.42), at = (du, d) => [A[0] + r[0] * (u + du) + n[0] * d, A[1] + r[1] * (u + du) + n[1] * d];
    const q = [at(-0.3, 0), at(-0.3, 0.32), at(0.3, 0.32), at(0.3, 0)];
    for (let i = 0; i < 3; i++) out.push([...q[i], ...q[i + 1]].map(v => Math.round(v * 100) / 100));
  }
  return out;
})();

// =====================================================================================================
// Palazzo Alliata di Pietratagliata
// =====================================================================================================
const AP = { id: 'w279887923', p: [79.6, -300.6, 79.0, -291.7, 81.7, -291.5, 81.2, -289.2, 70.5, -289.6, 70.8, -292.4, 64.2, -292.9, 64.2, -301.5] };
const AT = { id: 'w279884877', p: [79.6, -300.6, 87.4, -300.1, 86.1, -291.2, 81.7, -291.5, 79.0, -291.7] };
const APH = 15.2, ATH = 24.0, APC = [640, 384], APF = [0, 0, 336, 384], APS = [340, 0, 164, 384], APT = [508, 0, 132, 384];
const APST = '#998d78', APLT = '#c2b499', APDK = '#5e5547', APTW = '#aa9c80';
const APBI = [2.2, 5.1, 8.0, 10.9];   // the two light windows, u from the tower end
// the outline of a pointed window: from h0, springing so that the apex is at h1
function pointed(u, h0, h1, w, n = 5) {
  const r = w / 2, sp = h1 - w * 0.75, out = [[u - r, h0], [u - r, sp]];
  const q = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  for (let i = 1; i <= n; i++) out.push(q([u - r, sp], [u - r, h1 - r * 0.35], [u, h1], i / n));
  for (let i = 1; i <= n; i++) out.push(q([u, h1], [u + r, h1 - r * 0.35], [u + r, sp], i / n));
  out.push([u + r, h0]); return out;
}
function apAshlar(p, L, h0, h1, base, seed) {
  const r = RNG(seed), cols = ['rgba(60,48,32,0.10)', 'rgba(255,236,200,0.07)', 'rgba(110,86,52,0.09)', 'rgba(40,36,30,0.06)'];
  p.R(0, h0, L, h1, base);
  for (let h = h0; h < h1; h += 0.42) { p.R(0, h, L, h + 0.035, 'rgba(48,38,26,0.38)'); for (let u = -r(); u < L;) { const bw = 0.55 + r() * 0.7; p.R(u + 0.03, h + 0.04, u + bw, h + 0.42, cols[Math.floor(r() * 4)]); p.R(u, h, u + 0.035, h + 0.42, 'rgba(48,38,26,0.34)'); u += bw; } }
}
function apBifora(p, u) {
  p.poly(pointed(u, 8.75, 13.15, 2.2, 8), APLT); p.poly(pointed(u, 8.8, 12.7, 1.75, 8), APDK);
  for (const s of [-1, 1]) { p.arch(u + s * 0.4, 8.85, 11.7, 0.66, '#1f242b'); for (let h = 9.05; h < 11.4; h += 0.28) p.line(u + s * 0.4 - 0.3, h, u + s * 0.4 + 0.3, h + 0.2, 0.025, 'rgba(150,165,180,0.4)'); p.circ(u + s * 0.4, 11.35, 0.17, APLT); p.circ(u + s * 0.4, 11.35, 0.09, '#22262c'); }
  p.R(u - 0.06, 8.8, u + 0.06, 11.55, '#d6c9ac'); p.R(u - 0.84, 8.8, u - 0.74, 11.5, APLT); p.R(u + 0.74, 8.8, u + 0.84, 11.5, APLT);
  for (const [du, dh, rr] of [[0, 12.05, 0.27], [-0.36, 11.72, 0.15], [0.36, 11.72, 0.15], [0, 12.47, 0.1]]) { p.circ(u + du, dh, rr + 0.08, APLT); p.circ(u + du, dh, rr * 0.7, '#2a2c2c'); }
}
function apPaint(g, w, h) {
  // ---- Via Bandiera (u from the tower end, the corner at the right)
  let p = area(g, APF, 15.4, APH);
  p.clip(() => {
    apAshlar(p, 15.4, 0, APH, APST, 8401); p.R(0, 0, 15.4, 8.4, 'rgba(50,38,20,0.16)'); p.R(0, 14.75, 15.4, APH, APDK);
    for (const u of APBI) { apBifora(p, u); p.R(u - 1.2, 8.45, u + 1.2, 8.75, '#4f4739'); p.R(u - 1.2, 8.2, u + 1.2, 8.45, 'rgba(30,24,16,0.3)'); }
    p.R(12.6, 8.45, 15.4, 8.8, '#4f4739'); p.R(12.6, 8.2, 15.4, 8.45, 'rgba(30,24,16,0.3)');
    // the half of the corner window on this face
    p.poly([[13.7, 8.8], [13.7, 11.9], [14.05, 12.85], [14.7, 13.55], [15.4, 14.1], [15.4, 8.8]], APLT);
    p.poly([[14.05, 8.85], [14.05, 11.75], [14.45, 12.75], [15.4, 13.55], [15.4, 8.85]], '#222a33');
    for (let hh = 9.1; hh < 11.5; hh += 0.26) for (let u = 14.15 + (Math.round(hh * 4) % 2) * 0.1; u < 15.35; u += 0.22) p.circ(u, hh, 0.07, 'rgba(135,155,175,0.45)');
    for (const [u, hh, rr] of [[14.45, 12.0, 0.24], [14.95, 12.45, 0.3], [15.0, 11.75, 0.22], [15.3, 13.0, 0.16]]) { p.circ(u, hh, rr + 0.09, APLT); p.circ(u, hh, rr * 0.6, '#2a2c2c'); }
    // the small traceried windows, the portal, the door under the awnings
    for (const u of [7.6, 11.8]) { p.poly(pointed(u, 4.45, 6.95, 1.15), APLT); p.poly(pointed(u, 4.7, 6.55, 0.68), '#232831'); p.R(u - 0.04, 4.7, u + 0.04, 5.9, '#cdbfa2'); p.circ(u, 6.0, 0.2, APLT); p.circ(u, 6.0, 0.1, '#262a2a'); p.R(u - 0.75, 4.3, u + 0.75, 4.55, '#b5a88e'); }
    p.poly(pointed(4.3, 0, 6.0, 3.3, 8), '#b1a38a'); p.poly(pointed(4.3, 0, 5.65, 2.8, 8), APDK); p.poly(pointed(4.3, 0, 5.3, 2.4, 8), '#a2947c'); p.arch(4.3, 0, 4.5, 2.1, '#3c2a1e'); p.R(4.27, 0, 4.33, 4.4, '#1e140d'); p.R(3.25, 3.35, 5.35, 3.45, '#1e140d');
    p.R(11.8, 0, 14.2, 3.25, '#a99b82'); p.R(12.0, 0, 14.0, 2.8, '#2b241d');
  });
  // ---- Via Pizzuto (u from the corner, at the left)
  p = area(g, APS, 8.6, APH);
  p.clip(() => {
    apAshlar(p, 8.6, 0, APH, APST, 8402); p.R(0, 0, 8.6, 8.4, 'rgba(50,38,20,0.16)'); p.R(0, 14.75, 8.6, APH, APDK);
    p.R(0, 8.45, 2.8, 8.8, '#4f4739'); apBifora(p, 5.0); p.R(3.8, 8.45, 6.2, 8.75, '#4f4739');
    p.poly([[1.7, 8.8], [1.7, 11.9], [1.35, 12.85], [0.7, 13.55], [0, 14.1], [0, 8.8]], APLT);
    p.poly([[1.35, 8.85], [1.35, 11.75], [0.95, 12.75], [0, 13.55], [0, 8.85]], '#222a33');
    for (let hh = 9.1; hh < 11.5; hh += 0.26) for (let u = 0.12 + (Math.round(hh * 4) % 2) * 0.1; u < 1.3; u += 0.22) p.circ(u, hh, 0.07, 'rgba(135,155,175,0.45)');
    for (const [u, hh, rr] of [[0.95, 12.0, 0.24], [0.45, 12.45, 0.3], [0.4, 11.75, 0.22], [0.1, 13.0, 0.16]]) { p.circ(u, hh, rr + 0.09, APLT); p.circ(u, hh, rr * 0.6, '#2a2c2c'); }
  });
  // ---- the tower's face on the street (u from its east end)
  p = area(g, APT, 7.8, ATH);
  p.clip(() => {
    apAshlar(p, 7.8, 0, ATH, APTW, 8403); p.R(0, 0, 7.8, 13, 'rgba(50,38,20,0.18)');
    p.poly(pointed(4.1, 16.55, 18.75, 1.3), APLT); p.poly(pointed(4.1, 16.6, 18.4, 0.85), '#242830'); p.R(4.06, 16.6, 4.14, 18.0, '#cdbfa2'); p.R(3.0, 16.15, 5.2, 16.5, '#4f4739');
    for (let u = 0.7; u < 7.5; u += 1.25) p.R(u, 21.35, u + 0.24, 21.65, '#3a332a');
    for (const [a, b, ww] of [[4.0, 6.2, 1.1], [8.7, 11.3, 1.2], [12.6, 14.0, 0.7]]) { p.R(4.0 - ww / 2 - 0.15, a - 0.15, 4.0 + ww / 2 + 0.15, b + 0.2, APLT); p.glass(4.0, a, b, ww, '#30343a', '#8a7c66'); }
    p.R(2.9, 0, 5.1, 2.9, '#2e271f'); p.R(0, 22.55, 7.8, 22.9, '#7d7260');
  });
  grime(g, w, h, 8410, 0.8);
}
function buildAlliata() {
  initShared();
  paintMat('p2rAlli', APC, apPaint);
  const P = pairsOf(AP.p), T = pairsOf(AT.p), y0 = Math.min(groundY(...P[7]), groundY(...P[0]), groundY(...P[6]), groundY(...T[1])), lo = Math.min(lowest(P), lowest(T)) - 1.5;
  begin(y0);
  // ---- the palace
  const F = side(P, P[7], P[0], y0), W = side(P, P[6], P[7], y0);
  front('p2rAlli', APC, F, APF, APH, lo, '#6f6556'); front('p2rAlli', APC, W, APS, APH, lo, '#6f6556');
  for (let i = 0; i < 6; i++) plain(side(P, P[i], P[i + 1], y0), APH, lo, '#8d826f');
  lid(P, y0 + APH - 0.05, '#8a7a68');
  band(F, 14.95, 15.3, 0.14, APDK, 0.1); band(W, 14.95, 15.3, 0.14, APDK);
  // sill courses and ledges, the hood moulds, the colonnettes
  const hood = (E, u, w2) => { const o = pointed(u, 11.55, 13.35, w2 + 0.3), i = pointed(u, 11.55, 13.05, w2 - 0.05); solid(E, [...o.slice(1, -1), ...i.slice(1, -1).reverse()], -0.02, 0.13, '#ad9f85'); for (const s of [-1, 1]) bx('flat', E.M, X(E, u + s * (w2 + 0.2) / 2) - 0.14, X(E, u + s * (w2 + 0.2) / 2) + 0.14, 11.3, 11.65, -0.02, 0.2, { c: '#8f8370', noao: true }); };
  for (const u of APBI) { slab(F, u - 1.22, u + 1.22, 8.5, 8.75, -0.02, 0.22, '#5a5143'); hood(F, u, 1.9); cyl('flat', 0.055, 0.07, 2.75, 6, { M: F.M, p: [X(F, u), 8.75, 0.07], c: '#d6c9ac', noao: true }); }
  slab(F, 12.6, F.L + 0.24, 8.5, 8.8, -0.02, 0.24, '#5a5143');
  slab(W, -0.0, 2.8, 8.5, 8.8, -0.02, 0.24, '#5a5143'); slab(W, 3.8, 6.2, 8.5, 8.75, -0.02, 0.22, '#5a5143'); hood(W, 5.0, 1.9);
  // the corner window: its slender column, the two carved heads, the arched mouldings meeting at the angle
  const [cx, cz] = P[7], out = [(F.nx + W.nx) * 0.07, (F.nz + W.nz) * 0.07];
  cyl('flat', 0.08, 0.1, 3.45, 7, { p: [cx + out[0], y0 + 8.8, cz + out[1]], c: '#ded1b4', noao: true });
  box('flat', 0.36, 0.28, 0.36, { p: [cx + out[0], y0 + 12.2, cz + out[1]], c: '#c9bb9e', noao: true });
  for (const [E, u0, u1] of [[F, F.L - 1.75, F.L], [W, 1.75, 0]]) {
    const k = u1 > u0 ? 1 : -1, outer = [[u0 - k * 0.1, 11.8], [u0 + k * 0.3, 13.0], [u0 + k * 1.05, 13.75], [u1, 14.3]], inner = [[u1, 14.05], [u0 + k * 1.1, 13.55], [u0 + k * 0.48, 12.88], [u0 + k * 0.12, 11.8]];
    solid(E, [...outer, ...inner], -0.02, 0.13, '#ad9f85');
    sphere('flat', 0.22, { M: E.M, p: [X(E, u0), 11.65, 0.1], seg: 6, c: '#6f6454', noao: true });
  }
  for (const u of [7.6, 11.8]) slab(F, u - 0.75, u + 0.75, 4.3, 4.52, -0.02, 0.16, '#b5a88e');
  // the corner column at the street, drain pipes
  cyl('flat', 0.17, 0.19, 3.2, 8, { p: [cx, y0, cz], c: '#b6a990', noao: true }); box('flat', 0.55, 0.42, 0.55, { p: [cx, y0 + 3.2, cz], c: '#8f826c', noao: true });
  for (const u of [6.55, 12.95]) slab(F, u, u + 0.08, 0.4, u > 9 ? 8.5 : 14.9, 0, 0.1, '#9a9488');
  // ---- the tower
  const TN = side(T, T[0], T[1], y0), TW = side(T, T[4], T[0], y0), wallH = 22.9;
  quad('p2rAlli', TN, 0, TN.L, 0, wallH, { rect: [APT[0], APT[3] * (1 - wallH / ATH), APT[2], APT[3] * wallH / ATH], canvas: APC }); quad('flat', TN, 0, TN.L, lo - y0, 0.01, { c: '#6f6556' });
  quad('p2rAlli', TW, 0, TW.L, APH - 0.4, wallH, { rect: [APT[0], APT[3] * (1 - wallH / ATH), APT[2], APT[3] * (wallH - APH + 0.4) / ATH], canvas: APC });
  quad('flat', TW, 0, TW.L, lo - y0, APH - 0.4, { c: '#8d826f' });
  for (let i = 1; i < 4; i++) plain(side(T, T[i], T[i + 1], y0), wallH, lo, '#a09379');
  lid(T, y0 + wallH, '#7f7260');
  for (let i = 0; i < T.length; i++) {
    const E = side(T, T[i], T[(i + 1) % T.length], y0); if (E.L < 3.5) continue;
    band(E, wallH - 0.35, wallH, 0.12, '#8a7e68', 0.06);
    const n = Math.max(3, Math.round(E.L / 1.8)), mw = E.L / (2 * n - 1);
    for (let k = 0; k < n; k++) { const u = k * 2 * mw; slab(E, u, u + mw, wallH, ATH, -0.38, 0.06, '#aa9c80'); for (const [a, b] of [[u, u + mw * 0.3], [u + mw * 0.7, u + mw]]) slab(E, a, b, ATH, ATH + 0.28, -0.36, 0.04, '#aa9c80'); }
  }
  slab(TN, 3.0, 5.2, 16.2, 16.5, -0.02, 0.24, '#5a5143');
  const o = end('Palazzo Alliata di Pietratagliata');
  o.userData.solids = [[AP.p, null, y0 + APH], [AT.p, null, y0 + wallH]];
  return o;
}

// =====================================================================================================
// Palazzo Francavilla
// =====================================================================================================
const FR = { id: 'w230569846', p: [-350.4, -593.4, -355.6, -603.3, -326.6, -618.3, -333.6, -631.7, -361.8, -617.1, -367.4, -627.7, -326.0, -649.2, -308.1, -615.3] };
const FRH = 13.8, FRC = [1024, 576], FRS = [0, 0, 1024, 288], FRE = [0, 288, 768, 288], FRW = [770, 288, 226, 288];
const FRRD = '#b9634c', FROC = '#c29a5e', FRLO = '#d5b278', FRDK = '#8a6a40', FRGR = '#cbc2ac';
// bays: [u, kind] kind 't' triangle, 'a' curve, 'p' a plain shuttered window with the square one in the frieze above; q: quoin strips [u0, u1]
const FRBS = [[3.2, 't'], ...[9.7, 14.4, 19.1, 23.8, 28.5, 33.2, 37.9].map((u, i) => [u, i % 2 ? 't' : 'a']), [44.4, 't']];
const FRBE = [[3.2, 't'], ...[9.75, 14.45, 19.15, 23.85, 28.55].map((u, i) => [u, i % 2 ? 't' : 'a']), [35.1, 't']];
const FRBW = [[2.5, 'p'], [7.2, 't']];
function frFace(g, rect, L, bays, quoins, o) {
  const p = area(g, rect, L, FRH);
  p.clip(() => {
    p.R(0, 0, L, FRH, FRRD);
    // the rusticated ground floor with its shop doors
    p.R(0, 0, L, 4.05, FRGR); p.courses(0, L, 0.5, 4.05, 0.46, 'rgba(100,82,52,0.45)', 'rgba(255,248,225,0.4)'); p.R(0, 0, L, 0.55, '#a89f8c');
    bays.forEach(([u, k], i) => {
      if (u === o.portal) { p.R(u - 2.0, 0, u + 2.0, 4.0, '#c9bb9a'); p.arch(u, 0, 3.85, 2.5, '#2a1e16'); return; }
      if (k === 'p') return;
      p.R(u - 1.2, 0, u + 1.2, 3.35, '#b4a98f'); p.glass(u, 0.1, 3.1, 2.0, i % 3 === 1 ? '#3a342c' : '#27292a', '#8d8068');
      if (i % 3 === 2) p.R(u - 1.15, 2.5, u + 1.15, 3.0, '#e8e2d2');
    });
    p.R(0, 4.05, L, 4.35, FRLO); p.R(0, 3.92, L, 4.05, 'rgba(70,50,28,0.35)');
    // quoin strips
    for (const [a, b] of quoins) { p.R(a, 4.35, b, 11.35, FROC); for (let hh = 4.4, i = 0; hh < 11.2; hh += 0.46, i++) { p.R(a, hh, b, hh + 0.07, 'rgba(90,62,30,0.45)'); if (i % 2) { p.R(a, hh + 0.07, a + 0.16, hh + 0.46, FRRD); p.R(b - 0.16, hh + 0.07, b, hh + 0.46, FRRD); } } }
    p.R(0, 5.95, L, 6.25, FROC);
    for (const [u, k] of bays) {
      // the small window under the balcony
      p.R(u - 0.8, 4.45, u + 0.8, 5.75, FROC); p.shut(u, 4.6, 5.6, 1.15, '#4a3226');
      if (k === 'p') { p.R(u - 0.95, 6.85, u + 0.95, 9.85, FROC); p.shut(u, 7.0, 9.6, 1.35, '#4e3828'); p.R(u - 1.1, 9.85, u + 1.1, 10.1, FRLO); continue; }
      p.R(u - 1.25, 5.35, u + 1.25, 6.2, 'rgba(60,36,18,0.35)');
      p.R(u - 1.2, 6.35, u + 1.2, 10.1, FROC);
      for (const s of [-1, 1]) { p.R(u + s * 0.98 - 0.14, 6.45, u + s * 0.98 + 0.14, 9.7, FRLO); p.R(u + s * 0.98 + 0.07, 6.45, u + s * 0.98 + 0.14, 9.7, 'rgba(90,62,30,0.4)'); }
      p.R(u - 0.72, 6.45, u + 0.72, 9.6, '#4a2f22'); p.glass(u, 6.5, 9.5, 1.2, '#2c2a2a', '#8a5a40');
      p.R(u - 1.3, 9.75, u + 1.3, 10.1, FRLO);
      if (k === 't') { p.poly([[u - 1.35, 10.1], [u + 1.35, 10.1], [u, 11.15]], FRLO); p.poly([[u - 0.9, 10.25], [u + 0.9, 10.25], [u, 10.88]], FRDK); }
      else { p.arch(u, 10.1, 11.25, 2.5, FRLO); p.arch(u, 10.22, 11.0, 1.9, FRDK); }
      p.circ(u, 10.45, 0.2, FRLO);
    }
    // the carved frieze: festoons between small heads
    p.R(0, 11.35, L, 12.55, '#a8834e'); p.R(0, 11.35, L, 11.5, FRLO);
    for (let u = 0.5; u < L; u += 1.05) { for (let k = 0; k <= 8; k++) { const t = k / 8; p.circ(u + t * 1.05, 12.2 - Math.sin(t * PI) * 0.45, 0.1 + Math.sin(t * PI) * 0.05, '#d8b67c'); } p.circ(u, 12.22, 0.19, '#e0c088'); p.circ(u + 0.03, 11.82, 0.08, '#6f5230'); }
    for (const [u, k] of bays) if (k === 'p') { p.R(u - 0.75, 11.4, u + 0.75, 12.5, FRLO); p.shut(u, 11.5, 12.4, 1.15, '#4a3426'); }
    p.R(0, 12.55, L, FRH, '#8d7048'); for (let u = 0.15; u < L; u += 0.4) p.R(u, 12.6, u + 0.18, 12.85, '#4e3c26'); p.R(0, 13.45, L, FRH, '#a8895a');
  });
}
function frPaint(g, w, h) {
  frFace(g, FRS, 47.6, FRBS, [[0, 0.85], [5.95, 6.85], [40.75, 41.65], [46.75, 47.6]], {});
  frFace(g, FRE, 38.3, FRBE, [[0, 0.85], [5.95, 6.85], [31.45, 32.35], [37.45, 38.3]], { portal: 19.15 });
  frFace(g, FRW, 11.2, FRBW, [[0, 0.7], [4.7, 5.35], [9.4, 11.2]], {});
  grime(g, w, h, 8510, 0.8);
}
const FRPORT = 1.65, FRPD = 0.32;   // the doorway's columns: either side of its middle, and how far they stand out
function buildFrancavilla() {
  initShared();
  paintMat('p2rFran', FRC, frPaint);
  const P = pairsOf(FR.p), S = side(P, P[7], P[0], Math.min(groundY(...P[7]), groundY(...P[0]), groundY(...P[6]))), y0 = S.y0, lo = lowest(P) - 1.5;
  begin(y0);
  const E = side(P, P[6], P[7], y0), W = side(P, P[0], P[1], y0);
  front('p2rFran', FRC, S, FRS, FRH, lo, '#968c78'); front('p2rFran', FRC, E, FRE, FRH, lo, '#968c78'); front('p2rFran', FRC, W, FRW, FRH, lo, '#968c78');
  // the other sides: the colours and the cornice carried round, no windows
  for (let i = 1; i < 6; i++) { const Q = side(P, P[i], P[i + 1], y0); quad('flat', Q, 0, Q.L, lo - y0, 4.2, { c: '#bfb5a0' }); quad('flat', Q, 0, Q.L, 4.2, FRH, { c: '#a95c48' }); band(Q, 4.05, 4.35, 0.12, FRLO); band(Q, 12.55, 13.05, 0.25, '#8d7048'); band(Q, 13.4, FRH, 0.5, '#a8895a'); }
  for (const [F, bays] of [[S, FRBS], [E, FRBE], [W, FRBW]]) {
    band(F, 4.05, 4.35, 0.16, FRLO);
    band(F, 12.86, 13.05, 0.3, '#8d7048', 0.1); band(F, 13.05, 13.45, 0.72, '#7e6440', 0.3); band(F, 13.45, 13.82, 0.88, '#a8895a', 0.45);
    for (const [u, k] of bays) {
      if (k === 'p') { slab(F, u - 1.1, u + 1.1, 9.85, 10.1, -0.02, 0.2, FRLO); continue; }
      // the window's cornice and pediment (its columns are painted)
      slab(F, u - 1.3, u + 1.3, 9.75, 10.1, -0.02, 0.26, FRLO);
      const A = k === 't' ? [[u - 1.38, 10.1], [u - 1.38, 10.22], [u, 11.22], [u + 1.38, 10.22], [u + 1.38, 10.1], [u, 11.02]] : [[u - 1.3, 10.1], [u - 0.95, 10.88], [u, 11.26], [u + 0.95, 10.88], [u + 1.3, 10.1], [u + 1.0, 10.1], [u + 0.72, 10.73], [u, 11.02], [u - 0.72, 10.73], [u - 1.0, 10.1]];
      solid(F, A, -0.02, 0.28, '#cfa86e');
      // the stone balcony on its two brackets
      slab(F, u - 1.4, u + 1.4, 6.12, 6.38, -0.02, 0.8, '#b08a54');
      slab(F, u - 1.32, u + 1.32, 6.38, 7.34, -0.02, 0.72, FROC); quad('flat', F, u - 1.06, u + 1.06, 6.55, 7.14, { c: '#8a6a40', out: 0.73 });
      for (const s of [-1, 1]) solid2(F, u + s * 1.05, 6.14, 0.7, 0.75, '#a8824e');
    }
  }
  // the doorway to Via Ruggero Settimo: two columns and their entablature
  const pu = 19.15;
  for (const s of [-1, 1]) {
    const x = X(E, pu + s * FRPORT);
    cyl('flat', 0.2, 0.23, 3.1, 8, { M: E.M, p: [x, 0.5, 0.07], c: '#8f877a', noao: true });
    bx('flat', E.M, x - 0.35, x + 0.35, -0.6, 0.5, -0.02, FRPD, { c: '#aaa292', noao: true }); bx('flat', E.M, x - 0.34, x + 0.34, 3.6, 3.85, -0.02, FRPD, { c: '#c4b498', noao: true });
  }
  slab(E, pu - 2.1, pu + 2.1, 3.85, 4.3, -0.02, 0.36, '#c9a96e');
  lid(P, y0 + FRH - 0.05, '#97806a');
  const o = end('Palazzo Francavilla');
  o.userData.solids = [[FR.p, null, y0 + FRH]];
  return o;
}
// collision for the two columns of Francavilla's doorway (the east front runs from the footprint's north east corner to the square)
const FRANCA_WALLS = (() => {
  const A = [-326.0, -649.2], B = [-308.1, -615.3], l = Math.hypot(B[0] - A[0], B[1] - A[1]), r = [(B[0] - A[0]) / l, (B[1] - A[1]) / l], n = [r[1], -r[0]], out = [];
  for (const s of [-1, 1]) {
    const u = 19.15 + s * FRPORT, uu = (l - u), at = (du, d) => [A[0] + r[0] * (uu + du) + n[0] * d, A[1] + r[1] * (uu + du) + n[1] * d];
    const q = [at(-0.35, 0), at(-0.35, FRPD), at(0.35, FRPD), at(0.35, 0)];
    for (let i = 0; i < 3; i++) out.push([...q[i], ...q[i + 1]].map(v => Math.round(v * 100) / 100));
  }
  return out;
})();

export const R2_P2 = [
  { name: 'Palazzo Bonocore', x: 79, z: -13, radius: 32, skipIds: [BO.id], build: buildBonocore },
  { name: 'Palazzo Costantino di Napoli', x: 30, z: -24, radius: 35, skipIds: [NA.id], build: buildCostantino },
  { name: 'Palazzo Lanza Tomasi', x: 937, z: -229, radius: 40, skipIds: [LT.a, LT.b], build: buildLanza, walls: LANZA_WALLS },
  { name: 'Palazzo Alliata di Pietratagliata', x: 76, z: -296, radius: 28, skipIds: [AP.id, AT.id], build: buildAlliata },
  { name: 'Palazzo Francavilla', x: -337, z: -623, radius: 40, skipIds: [FR.id], build: buildFrancavilla, walls: FRANCA_WALLS },
];
