// City landmarks, batch E: Palazzo Chiaramonte-Steri (r1291721.0), Castello a Mare (w926609495), Chiesa di Santa Maria della Catena (w49772132), Santa Maria dello Spasimo (r403706.0).
// Registered through BATCH_E in src/landmarks-city.js; each one replaces its OSM footprint. Collision stays the footprint. World coordinates are the ones of the tile data.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions, orders and colours read):
//   Steri: Palermo-Palazzo-Chiaramonte-bjs2007-01.jpg (the corner of the two street fronts); Palermo, Palazzo Chiaramonte-Steri.jpg (the same corner, wider, with the balcony of the next palace and the crowned merlons);
//     Palazzo steri3.jpg (the windows of the upper floors from below); Steri PA 06 04 2019 01.jpg (the portal on the long front). The graffiti photos of the cells (2015) show only interiors and were not used.
//   Catena: Facade - Santa Maria della Catena - Palermo - Italy 2015 (2).JPG; Santa Maria Catena.jpg (the loggia with its open west end and the crested flank); Santa Maria della Catena (Palermo) 14 07 2024 01.jpg (the loggia head on);
//     Chiesa di S. Maria della Catena and La Cala Port, Palermo, Italy (9458255414).jpg (the loggia faces the Piazzetta delle Dogane, the plain wall on its right); Santa Maria della Catena (Palermo) 21 06 2026 01.jpg and 06.jpg (the long flank from across the Cala road, the loggia at its right end);
//     Santa Maria della Catena (Palermo) - Exterior-2025-msu-3880-.jpg (the front at night).
//   Castello a Mare: Castello a mare di Palermo ingresso principale 06 nov 2016.jpg (the gate arch); Castello a Mare, Palermo.jpg (the low curtain walls and the corner tower, 2022);
//     Castello a mare di Palermo fronte corpo fabbrica principale 06 nov 2016.jpg (the keep under scaffolding); Palermo-Castello-a-Mare-bjs2007-01.jpg (fetched, the keep from far).
//   Spasimo: Santa Maria dello Spasimo, Chiesa dall' Alto.jpg (the nave with the chapel arcade); Chiesa di Santa Maria dello Spasimo Palermo 04.jpg and 03.jpg (the apse, the ribbed vault, the narrow lancet);
//     Spasimo esterno.jpg (the outside of the nave end, the broken pointed arch, the stepped gable); LoSpasimoPalermo-2025-09-msu-0366-4052.jpg (the skyline, fetched, a silhouette only);
//     round 2: Chiesa S. Maria dello Spasimo quartiere Kalsa.jpg (the west end wall of the nave from inside: plain rubble, a doorway, one high window) and Chiesa di Santa Maria dello Spasimo Palermo 06.jpg (the same doorway seen from the timber-beamed room behind it: dressed jambs, flat lintel, round relieving arch).
//   Steri round 2: Palazzo steri.jpg and Palazzo steri2.jpg (the court, two arcade tiers, taken from inside; a corner of the court in both).
// Read from the photos:
//   Steri: a square, fortress-like block of three storeys in pale golden sandstone ashlar (courses about half a metre), a plain ground floor with only small slits, a thin dark string course over it and another over the first floor;
//     on the two upper floors a tall round hood with a zig-zag inlay of dark lava stone over each pair of narrow lights (a colonnette between, wooden lattice behind), the upper ones smaller; Y-shaped stone spouts under the top;
//     a cornice and Ghibelline merlons all round. The portal on the long front: a round arch under a flat console cornice, jambs of stepped rusticated blocks, a small rectangular window over it.
//   Catena: warm golden sandstone ashlar; at the south-west end a raised loggia of three moulded arches (slim grey columns with leaf capitals) with one more arch at each open end, reached by a broad flight of steps behind an iron railing;
//     a slim square tower at each front corner with round headed niches in two tiers and a narrower capped shaft over the roof line; over the arches a plain wall with two thin ribs, an inscription plaque and a statue in a niche, then an openwork crest
//     that runs round the church; in the back wall of the loggia three marble framed portals (the middle one bigger); a tall plain wall with a barred window right of the loggia; the long north-west flank has two tiers of round headed windows between buttress piers.
//   Castello a Mare: golden tufa ashlar in small courses, a pink plaster plinth, a gate tower with chamfered corners, a round arch with big voussoirs, two narrow chain slots over it and a marble plaque, square merlons with slits;
//     the rest are low rubble walls with ragged tops round a grass court.
//   Spasimo: a nave with no roof, walls of warm golden ashlar and rubble, an arcade of chapel arches along the inside (a lower roofed tier outside), a ruined gable.
//   Steri court (round 2): ground arcade of pointed arches on stone columns with capitals, a heraldic shield in the haunch of the arches, ashlar up to a ledge, on it a loggia of smaller pointed arches on short slim pale columns (two to a ground arch), pale plastered back walls shaded under the arches,
//     pale plaster above with small Y shaped iron ties and stone spouts, a cornice. The corner is just the two arcades meeting on a column.
//   Spasimo west wall (round 2): plain coursed rubble, a doorway with dressed jambs and a flat lintel under a round relieving arch filled with rubble, one round headed window high up in a dressed splay.
//   Spasimo nave walls (Chiesa S. Maria dello Spasimo quartiere Kalsa.jpg, looking west, and Palermo-Santa-Maria-dello-Spasimo-bjs2007-01.jpg, looking east): level wall tops; round chapel arches on dressed piers reaching a little under half the height;
//     small rectangular windows high on the south wall, round headed openings nearer the top on the north wall; a bare forked tree near the west end on the north side, taller than the walls; at the east end a great
//     pointed arch, the apse window seen through it, and a gable with a small square opening. One arch and one window per 5 m bay (their true count and spacing are read by eye); the stepped outline of the east gable is kept from before.
//   Heights and spacing of the court arcade and of the Spasimo door and window are read off the photos by eye (no scale in them), so they are approximate; the court is drawn on every side of the OSM hole although the photos show two corners only.
// Not known and not drawn: the interiors (cells of the Steri, the vault of the Spasimo), the Steri court floor level and what stands in the arcades, the outer west front of the Spasimo (the photos show only the inner face of the west wall, level at the top, and the room behind it), the bridge over the moat of the castle, the south-east flank and the apse of the Catena (drawn like the north-west flank), its window count and bay spacing (read by eye), the low garden wall below its flank.
import * as THREE from 'three';
import { PI, bx, cyl, panel, part, prism, extrude, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, paintAshlar, pairsOf, groundRange, RNG, archBay, statue } from './lmc-kit.js';

// ====================================================================================================
// shared helpers
// ====================================================================================================
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
function edgesOf(outer, holes) {   // every edge with its outward normal (away from the solid; for a hole edge that is into the hole)
  const solid = (x, z) => inPoly(x, z, outer) && !holes.some(h => inPoly(x, z, h)), out = [];
  const add = (ring, hole) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 0.5) continue;
      let nx = dz / l, nz = -dx / l; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (solid(mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; }
      out.push({ a, b, l, nx, nz, mx, mz, hole });
    }
  };
  add(outer, false); holes.forEach(h => add(h, true));
  return out;
}
// painted bays along an edge: n panels of about bw0 metres, height H, standing on y0; pick(cx, cz, i, n) may return another material key (or null for none)
function bays(key, e, y0, H, bw0, o = {}) {
  const n = Math.max(1, Math.round(e.l / bw0)), bw = e.l / n, ux = (e.b[0] - e.a[0]) / e.l, uz = (e.b[1] - e.a[1]) / e.l;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * bw, cx = e.a[0] + ux * t, cz = e.a[1] + uz * t, k = o.pick ? o.pick(cx, cz, i, n) : key; if (!k) continue;
    panel(k, bw, H, { M: mul(frame(cx, y0, cz, e.nx, e.nz), tr(0, 0, o.off === undefined ? 0.05 : o.off)), uvk: o.uvk || [1, 1], uvo: o.uvo || [0, 0] });
  }
}
function mkp(g, w, h, Wm, Hm, x0 = 0) {   // metres to pixels: X from x0, Y up from the bottom of the canvas
  const sx = w / Wm, sy = h / Hm, X = (m) => (m - x0) * sx, Y = (m) => h - m * sy;
  const R = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  return { sx, sy, X, Y, R };
}
function wear(g, w, h, Wm, Hm, seed, o = {}) {   // replaced stones, dark patches, damp at the foot, water streaks, salts, a dirty foot
  const r = RNG(seed), sx = w / Wm, sy = h / Hm, n = Math.round(Wm * Hm / (o.dens || 16));
  for (let i = 0; i < n; i++) {
    const bw = (0.5 + r() * 1.6) * sx, bh = (0.3 + r() * 0.45) * sy, x = r() * w, y = r() * h;
    g.fillStyle = r() < 0.5 ? `rgba(${o.light || '244,226,184'},${0.1 + r() * 0.16})` : `rgba(${o.dark || '62,46,30'},${0.08 + r() * 0.14})`; g.fillRect(x, y, bw, bh);
  }
  for (let i = 0, nd = o.damp === undefined ? 5 : o.damp; i < nd; i++) {
    const cx = r() * w, cy = h * (0.5 + r() * 0.5), rad = (12 + r() * 30) * Math.max(1, w / 220), gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, 'rgba(55,45,30,0.3)'); gr.addColorStop(1, 'rgba(55,45,30,0)'); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  streaks(g, w, h, o.streaks === undefined ? Math.round(Wm * 2) : o.streaks, seed + 3, o.sa || 0.15, h * 0.42, '40,30,20');
  for (let i = 0; i < Wm * 2; i++) { g.fillStyle = 'rgba(236,232,214,0.2)'; g.fillRect(r() * w, h - r() * 2.6 * sy, 4 + r() * 10, 2 + r() * 4); }
  const gb = g.createLinearGradient(0, h, 0, h - 3 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.36)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 3 * sy, w, 3 * sy);
}
function offsetRing(pts, d) {   // miter offset of a convex ring outward by d (the ring may run either way)
  let a2 = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
  const s = a2 > 0 ? 1 : -1, out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[(i + pts.length - 1) % pts.length], c = pts[i], q = pts[(i + 1) % pts.length];
    const e1 = [c[0] - p[0], c[1] - p[1]], e2 = [q[0] - c[0], q[1] - c[1]], l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const n1 = [e1[1] / l1 * s, -e1[0] / l1 * s], n2 = [e2[1] / l2 * s, -e2[0] / l2 * s], bx_ = n1[0] + n2[0], bz_ = n1[1] + n2[1], k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    out.push([c[0] + bx_ * k, c[1] + bz_ * k]);
  }
  return out;
}
const frameOf = (O, N) => ({
  toWorld: (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]],
  toLocal: (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; },
});
function rim(e, y, h, c, o = {}) {   // a cornice slab along an edge, standing out of the wall
  const F = frame(e.mx, 0, e.mz, e.nx, e.nz);
  bx('flat', F, -e.l / 2, e.l / 2, y, y + h, -0.2, o.out || 0.3, { c, noao: true });
}
function merlons(e, y, c, o = {}) {   // square merlons with a gap each, built as one cut-out panel
  panel('cren', e.l, o.h || 1.3, { M: mul(frame(e.mx, y, e.mz, e.nx, e.nz), tr(0, 0, o.z || 0.1)), uvk: [e.l / (o.pitch || 2.0), 1], c, noao: true });
}

// ====================================================================================================
// 1. Palazzo Chiaramonte-Steri
// ====================================================================================================
const STERI = { id: 'r1291721.0', p: [755.1, -219.9, 764.6, -182.7, 798.9, -192.8, 788, -229.1, 765.2, -222.5], holes: [[769.3, -203.8, 771.7, -192.6, 780, -194, 785.5, -195.9, 782.3, -208.1]] };
const SH = 20.0, SBW = 7.5, SGOLD = '#b99f74', SJOINT = '#8b7655';
function sbase(g, w, h, seed) {   // the ashlar with the odd darker lava and the cleaner replaced blocks
  paintAshlar(g, w, h, SBW, SH, 0.52, 1.15, SGOLD, SJOINT, seed, 1.3, 0.1);
  const r = RNG(seed + 11);
  for (let i = 0; i < 9; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,98,70,0.22)' : 'rgba(245,230,195,0.17)'; g.fillRect(r() * w, r() * h, (0.9 + r() * 1.5) * w / SBW, (0.9 + r() * 1.2) * h / SH); }
}
function twoLight(g, p, cx, ys, yt, R) {   // a hood with the zig-zag inlay over a pair of narrow lights
  const { X, Y, sx, sy } = p;
  g.save(); g.translate(X(cx), Y(yt)); g.scale(sx, sy);
  g.fillStyle = '#9d8761'; g.beginPath(); g.arc(0, 0, R, PI, 2 * PI); g.lineTo(R, 0.05); g.lineTo(-R, 0.05); g.fill();   // the tympanum under the hood
  g.lineWidth = 0.4; g.strokeStyle = '#c9b085'; g.beginPath(); g.arc(0, 0, R + 0.2, PI, 2 * PI); g.stroke();   // the ring of light stone
  g.lineWidth = 0.05; g.strokeStyle = '#4b3b2a'; g.beginPath();
  for (let k = 0, a = PI; a < 2 * PI - 0.001; k++, a += PI / 22) { const rr = R + (k % 2 ? 0.02 : 0.38); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.stroke();
  g.fillStyle = '#5b4a36'; g.beginPath(); g.arc(0, -0.42, 0.12, 0, 2 * PI); g.fill();
  g.restore();
  for (const sg of [-1, 1]) {   // the lights
    const x0 = cx + (sg < 0 ? -0.72 : 0.2), ww = 0.52;
    g.fillStyle = '#d0ba8f'; g.fillRect(X(x0 - 0.06), Y(yt), (ww + 0.12) * sx, (yt - ys) * sy);
    g.fillStyle = '#251d16'; g.fillRect(X(x0), Y(yt - 0.06), ww * sx, (yt - ys - 0.06) * sy);
    g.fillStyle = '#5f432a'; for (let y = ys + 0.15; y < yt - 0.1; y += 0.2) g.fillRect(X(x0), Y(y), ww * sx, 1.2); for (let x = x0; x < x0 + ww; x += 0.18) g.fillRect(X(x), Y(yt - 0.06), 1.2, (yt - ys - 0.06) * sy);
  }
  g.fillStyle = '#d6c298'; g.fillRect(X(cx - 0.1), Y(yt), 0.2 * sx, (yt - ys) * sy);   // the colonnette
  g.fillRect(X(cx - 0.95), Y(yt), 0.12 * sx, (yt - ys) * sy); g.fillRect(X(cx + 0.83), Y(yt), 0.12 * sx, (yt - ys) * sy);
  g.fillStyle = '#c4ab80'; g.fillRect(X(cx - 1.05), Y(ys), 2.1 * sx, 0.16 * sy); g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(X(cx - 1.05), Y(ys - 0.16), 2.1 * sx, 0.16 * sy);
}
function paintSteriBay(g, w, h, door) {
  const p = mkp(g, w, h, SBW, SH), { X, Y, sx, sy, R } = p;
  sbase(g, w, h, door ? 8102 : 8101);
  if (!door) for (const x of [0.3, 0.7]) for (const y of [2.6, 5.1]) { R(SBW * x - 0.15, y, SBW * x + 0.15, y + 0.62, '#1d1712'); R(SBW * x - 0.2, y + 0.62, SBW * x + 0.2, y + 0.7, '#c4ab80'); }   // the small slits of the ground floor
  for (const y of [7.35, 14.8]) { R(0, y, SBW, y + 0.3, '#a58a62'); R(0, y + 0.3, SBW, y + 0.36, 'rgba(250,235,200,0.5)'); R(0, y - 0.12, SBW, y, 'rgba(40,28,16,0.5)'); for (let m = 0.2; m < SBW; m += 0.34) R(m, y + 0.08, m + 0.16, y + 0.24, '#7d6646'); }   // the string courses with a zig-zag edge
  twoLight(g, p, SBW / 2, 8.9, 11.5, 1.45); twoLight(g, p, SBW / 2, 15.7, 17.9, 1.15);
  R(0, 19.35, SBW, 19.95, '#a68b63'); R(0, 19.3, SBW, 19.35, 'rgba(30,20,10,0.5)'); for (let m = 0.1; m < SBW; m += 0.42) R(m, 19.4, m + 0.2, 19.62, '#cdb68a');   // the cornice with its blocks
  for (const [x, y] of [[0.9, 19.0], [SBW - 0.9, 19.0], [0.9, 13.9], [SBW - 0.9, 13.9]]) {   // the Y shaped spouts
    g.strokeStyle = '#3f3226'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y - 0.5)); g.moveTo(X(x), Y(y - 0.5)); g.lineTo(X(x - 0.22), Y(y - 0.2)); g.moveTo(X(x), Y(y - 0.5)); g.lineTo(X(x + 0.22), Y(y - 0.2)); g.stroke();
  }
  if (door) {
    const cx = SBW / 2;   // the portal: a round arch, stepped jambs, a console cornice, a small window over it
    for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) { const y = 0.1 + i * 0.5; R(cx + (sg < 0 ? -1.95 : 1.2), y, cx + (sg < 0 ? -1.2 : 1.95), y + 0.46, i % 2 ? '#cdb78a' : '#c1a97c'); R(cx + (sg < 0 ? -1.95 : 1.2), y + 0.44, cx + (sg < 0 ? -1.2 : 1.95), y + 0.5, 'rgba(60,45,28,0.5)'); }
    g.fillStyle = '#18130f'; g.beginPath(); g.moveTo(X(cx - 1.2), Y(0)); g.lineTo(X(cx - 1.2), Y(3.5)); g.save(); g.translate(X(cx), Y(3.5)); g.scale(sx, sy); g.arc(0, 0, 1.2, PI, 2 * PI); g.restore(); g.lineTo(X(cx + 1.2), Y(0)); g.fill();
    R(cx - 1.2, 0, cx + 1.2, 2.2, '#5a3a28'); g.fillStyle = 'rgba(0,0,0,0.4)'; for (let x = cx - 1.1; x < cx + 1.2; x += 0.26) for (let y = 0.2; y < 2.1; y += 0.26) g.fillRect(X(x), Y(y), 3, 3);
    g.fillStyle = 'rgba(25,22,20,0.55)'; for (let x = cx - 1.2; x < cx + 1.2; x += 0.2) g.fillRect(X(x), Y(4.7), 1.4, (4.7 - 2.3) * sy);   // the grille over the leaves
    R(cx - 2.4, 5.25, cx + 2.4, 5.7, '#cbb386'); R(cx - 2.4, 5.2, cx + 2.4, 5.25, 'rgba(30,20,10,0.5)'); for (let x = cx - 2.2; x < cx + 2.3; x += 0.55) R(x, 4.95, x + 0.22, 5.25, '#b09668');
    R(cx - 0.6, 6.0, cx + 0.6, 7.1, '#d0ba8f'); R(cx - 0.45, 6.15, cx + 0.45, 6.95, '#2a2118'); R(cx - 0.05, 6.15, cx + 0.05, 6.95, '#8a7048');
  }
  wear(g, w, h, SBW, SH, door ? 8112 : 8111, { dens: 14, streaks: 11 });
}

const SCB = 4.2;   // one bay of the court arcade, metres
function ptArch(g, x0, x1, ys, ya, yb) {   // a pointed arch as a path in metres (y up): vertical sides from yb to ys, a point at ya
  const m = (x0 + x1) / 2, c = ys + (ya - ys) * 0.55;
  g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0, ys); g.quadraticCurveTo(x0, c, m, ya); g.quadraticCurveTo(x1, c, x1, ys); g.lineTo(x1, yb); g.closePath();
}
function paintSteriCourt(g, w, h) {   // an inner face of the court, 4.2 m bay: pointed arcade on columns below, ashlar up to a ledge, two small arches on short slim columns standing on it, plain plaster, cornice
  const sx = w / SCB, sy = h / SH;
  paintAshlar(g, w, h, SCB, SH, 0.5, 1.1, '#bba982', '#8e7e5c', 8131, 1.3, 0.09);
  g.fillStyle = '#d3c8ae'; g.fillRect(0, 0, w, (SH - 8.7) * sy);   // the plastered wall over the upper arcade
  noiseDots(g, w, (SH - 8.7) * sy, w * h / 90, 1.8, 8132, ['rgba(90,70,45,0.09)', 'rgba(255,248,225,0.12)']);
  wear(g, w, h, SCB, SH, 8133, { dens: 18, damp: 2, streaks: 4 });
  g.save(); g.translate(0, h); g.scale(sx, -sy); g.lineJoin = 'round';
  const open = (x0, x1, ys, ya, yb, ring) => {   // an arch opening with a lighter ring, shade under the vault and the pale plastered back wall
    ptArch(g, x0 - ring, x1 + ring, ys, ya + ring * 1.1, yb); g.fillStyle = '#cbb68c'; g.fill();
    ptArch(g, x0, x1, ys, ya, yb); const gr = g.createLinearGradient(0, ya, 0, yb), k = Math.min(0.45, 1.3 / (ya - yb)); gr.addColorStop(0, '#6f685c'); gr.addColorStop(k, '#bdbdb7'); gr.addColorStop(1, '#c9c9c3'); g.fillStyle = gr; g.fill();
    const side = g.createLinearGradient(x0, 0, x1, 0); side.addColorStop(0, 'rgba(45,40,32,0.34)'); side.addColorStop(0.35, 'rgba(45,40,32,0)'); side.addColorStop(0.85, 'rgba(45,40,32,0)'); side.addColorStop(1, 'rgba(45,40,32,0.18)'); g.fillStyle = side; g.fill();   // the depth of the portico
    g.lineWidth = 0.05; g.strokeStyle = yb > 0 ? '#3a2f22' : '#8a744f'; ptArch(g, x0 - ring, x1 + ring, ys, ya + ring * 1.1, yb); g.stroke();   // the dark hood moulding is on the upper arches only
  };
  const col = (cx, y0, y1, r, cap) => {   // a column with a base block and a capital
    g.fillStyle = r > 0.25 ? '#c9b288' : '#e0d3b4'; g.fillRect(cx - r, y0, 2 * r, y1 - y0); g.fillStyle = 'rgba(70,52,32,0.55)'; g.fillRect(cx - r, y0, 0.035, y1 - y0); g.fillRect(cx + r - 0.035, y0, 0.035, y1 - y0); g.fillStyle = 'rgba(60,45,28,0.25)'; g.fillRect(cx + r * 0.35, y0, r * 0.65, y1 - y0);
    g.fillStyle = '#c9bb98'; g.fillRect(cx - r * 1.3, y0, 2.6 * r, 0.35); g.fillRect(cx - r * 1.45, y1 - cap, 2.9 * r, cap);
    g.fillStyle = 'rgba(40,28,16,0.4)'; g.fillRect(cx - r * 1.45, y1 - cap, 2.9 * r, 0.04);
  };
  open(0.4, SCB - 0.4, 4.7, 7.1, 0.0, 0.32);
  col(0, 0, 4.7, 0.34, 0.3); col(SCB, 0, 4.7, 0.34, 0.3);
  g.fillStyle = '#a3896a'; g.fillRect(0.3, 7.35, 0.42, 0.55); g.fillStyle = '#6f5a3e'; g.fillRect(0.41, 7.5, 0.2, 0.28);   // the small heraldic shield in the haunch
  g.fillStyle = '#b49d70'; g.fillRect(0, 8.38, SCB, 0.32); g.fillStyle = 'rgba(250,236,200,0.5)'; g.fillRect(0, 8.67, SCB, 0.04); g.fillStyle = 'rgba(30,20,10,0.45)'; g.fillRect(0, 8.33, SCB, 0.05);   // the ledge
  const hb = SCB / 2;
  for (const k of [0, 1]) open(k * hb + 0.22, (k + 1) * hb - 0.22, 12.2, 14.1, 8.7, 0.2);
  for (const cx of [0, hb, SCB]) col(cx, 8.7, 12.2, 0.17, 0.22);
  g.fillStyle = '#a58a62'; g.fillRect(0, SH - 0.65, SCB, 0.5); g.fillStyle = 'rgba(30,20,10,0.5)'; g.fillRect(0, SH - 0.7, SCB, 0.05);   // the cornice
  g.restore();
  g.strokeStyle = '#3f3226'; g.lineWidth = 2; const X = (m) => m * sx, Y = (m) => h - m * sy;   // the small Y shaped iron ties between the upper arches
  for (const x of [0, SCB / 2, SCB]) { g.beginPath(); g.moveTo(X(x), Y(13.45)); g.lineTo(X(x), Y(13.9)); g.moveTo(X(x - 0.18), Y(14.2)); g.lineTo(X(x), Y(13.9)); g.lineTo(X(x + 0.18), Y(14.2)); g.stroke(); }
  g.fillStyle = '#b09a74'; g.fillRect(X(3.0), Y(18.35), 0.28 * sx, 0.3 * sy); g.fillStyle = 'rgba(30,20,10,0.4)'; g.fillRect(X(3.0), Y(18.05), 0.28 * sx, 0.14 * sy);   // a stone spout under the cornice
}

function buildSteri() {
  initShared();
  const pts = pairsOf(STERI.p), holes = STERI.holes.map(pairsOf), gr = groundRange(pts);
  const edges = edgesOf(pts, holes), outer = edges.filter(e => !e.hole);
  const west = outer.reduce((a, e) => (e.l > a.l ? e : a), outer[0]);   // the long front on the garden square
  const y0 = groundY(west.mx, west.mz), top = y0 + SH, lo = Math.min(gr.lo, y0) - 1.5;
  defMat('eStBay', 384, 384, [SBW, SH], (g, w, h) => paintSteriBay(g, w, h, false));
  defMat('eStDoor', 384, 384, [SBW, SH], (g, w, h) => paintSteriBay(g, w, h, true));
  defMat('eStCourt', 256, 768, [SCB, SH], paintSteriCourt);
  defMat('eStWall', 256, 256, [4, 4], (g, w, h) => { paintAshlar(g, w, h, 4, 4, 0.52, 1.15, SGOLD, SJOINT, 8121, 1.3, 0.1); wear(g, w, h, 4, 4, 8122, { dens: 10, damp: 3, streaks: 5 }); });
  begin(y0);
  prism('eStWall', pts, lo, top, { holes });
  prism('flat', pts, top, top + 0.12, { holes, c: '#8d806c' });
  const door = outer.length ? edges.indexOf(west) : -1;
  for (const e of outer) {
    if (e.l < 3) continue;
    bays('eStBay', e, y0, SH, SBW, { pick: e === west ? (cx, cz, i, n) => (i === 1 ? 'eStDoor' : 'eStBay') : undefined });
    rim(e, top - 0.7, 0.8, '#a68b63'); merlons(e, top + 0.1, '#b0976d', { h: 1.4, pitch: 2.2 });
  }
  for (const e of edges.filter(q => q.hole)) { if (e.l >= 3) bays('eStCourt', e, y0, SH, SCB); rim(e, top - 0.5, 0.6, '#a68b63'); }
  const o = end('Palazzo Chiaramonte-Steri');
  o.userData.solids = [[STERI.p, STERI.holes, top + 1.4]];
  return o;
}
export const STERI_LM = { name: 'Palazzo Chiaramonte-Steri', x: 776, z: -206, radius: 40, skipIds: [STERI.id], build: buildSteri };

// ====================================================================================================
// 2. Chiesa di Santa Maria della Catena
// ====================================================================================================
const CAT = { id: 'w49772132', p: [705.6, -375.8, 709.4, -378.8, 708.2, -380.4, 734.2, -400.8, 737.3, -397.1, 740.2, -397.3, 743.2, -393.7, 742.7, -391.5, 744.5, -388.6, 741.1, -386.3, 741.8, -385, 738.6, -382.8, 722.8, -371.8, 726.1, -365.5, 721.2, -363.1, 718.2, -368.6, 714.3, -366, 710.2, -370.6] };
const CO = [705.6, -375.8], CN = [-0.748, 0.664];   // origin on the outline's west corner, +z out of the south-west end (the loggia), local x to the south-east
const CFL = 2.6, CWALL = 8.2, CGOLD = '#c9b189', CJOINT = '#968262';   // the loggia floor over the street, the cornice over the floor
const CXA = 0.6, CXB = 11.6, CZF = -5.3, CZB = -10.3;   // the loggia: between the two towers, front and back wall (set back so that the towers stand inside the outline)
const CARCH = [0, 1, 2].map(i => CXA + (CXB - CXA) * (i + 0.5) / 3), CAR = 1.68, CSP = 4.25;
// the atlas eCaBack, 304 x 384 px: [x, y, w, h] and the metres each part stands for
const CAW = 304, CAH = 384;
const CR = { back: [0, 0, 240, 150, 11, 6.6], pier: [240, 0, 64, 384, 2.0, 11.4], side: [0, 150, 120, 234, 5.8, 10.8], block: [120, 150, 120, 234, 6.3, 10.2] };
const cuv = (r, fx = 1, fy = 1, fy0 = 0) => ({ uvk: [r[2] * fx / CAW, r[3] * fy / CAH], uvo: [r[0] / CAW, 1 - (r[1] + r[3] * (1 - fy0)) / CAH] });
function paintCatFront(g, w, h) {   // the front of the loggia, between the towers, y up from the floor to the cornice
  const Wm = CXB - CXA, p = mkp(g, w, h, Wm, CWALL, CXA), { X, Y, sx, sy, R } = p;
  paintAshlar(g, w, h, Wm, CWALL, 0.46, 1.1, CGOLD, CJOINT, 9101, 1.2, 0.07);
  for (const cx of CARCH) {   // the deep moulded archivolt of each arch
    g.save(); g.translate(X(cx), Y(CSP)); g.scale(sx, sy);
    for (const [r, c] of [[CAR + 0.52, '#8f764f'], [CAR + 0.45, '#dcc59a'], [CAR + 0.3, '#a68b60'], [CAR + 0.22, '#cfb487'], [CAR + 0.09, '#8f764f']]) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, r, PI, 2 * PI); g.fill(); }
    g.restore();
  }
  const cx = CARCH[1];   // the plaque with its scrolled ends, the statue in its niche over it
  R(cx - 1.35, 6.3, cx + 1.35, 7.35, '#e3d0aa'); R(cx - 1.18, 6.42, cx + 1.18, 7.22, '#d4bd92'); g.fillStyle = 'rgba(80,60,35,0.6)'; for (let k = 0; k < 4; k++) g.fillRect(X(cx - 0.95), Y(7.05 - k * 0.17), 1.9 * sx, 1.3);
  for (const sg of [-1, 1]) { g.fillStyle = '#e3d0aa'; g.beginPath(); g.arc(X(cx + sg * 1.42), Y(6.83), 0.24 * sx, 0, 2 * PI); g.fill(); }
  R(cx - 0.42, 7.4, cx + 0.42, 8.1, '#6a5438');
  R(CXA, CWALL - 0.28, CXB, CWALL, '#ddc599'); R(CXA, CWALL - 0.4, CXB, CWALL - 0.28, 'rgba(50,34,16,0.45)');
  wear(g, w, h, Wm, CWALL, 9111, { dens: 14, streaks: 12, damp: 3 });
}
function paintCatAtlas(g) {
  const part_ = (r, paint) => { g.save(); g.beginPath(); g.rect(r[0], r[1], r[2], r[3]); g.clip(); g.translate(r[0], r[1]); const p = mkp(g, r[2], r[3], r[4], r[5]); paint(p, r[2], r[3], r[4], r[5]); g.restore(); };
  const arched = (p, x, y0, y1, ww, c) => { const rr = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(p.X(x - rr), p.Y(y0)); g.lineTo(p.X(x - rr), p.Y(y1 - rr)); g.arc(p.X(x), p.Y(y1 - rr), rr * p.sx, PI, 0); g.lineTo(p.X(x + rr), p.Y(y0)); g.fill(); };
  // the back wall of the loggia: three portals with carved marble frames and lintels, the middle one bigger
  part_(CR.back, (p, w, h, Wm, Hm) => {
    paintAshlar(g, w, h, Wm, Hm, 0.48, 1.1, '#c6a977', CJOINT, 9201, 1.1, 0.07); p.R(0, 0, Wm, 0.35, '#a08a64');
    for (const [dx, dw, dh, fh] of [[-3.67, 1.15, 2.35, 3.25], [0, 1.9, 3.5, 4.55], [3.67, 1.15, 2.35, 3.25]]) {
      const x = Wm / 2 + dx; p.R(x - dw / 2 - 0.35, 0.3, x + dw / 2 + 0.35, fh, '#e4d4b0'); p.R(x - dw / 2 - 0.16, 0.3, x + dw / 2 + 0.16, dh + 0.46, '#c9b48c'); p.R(x - dw / 2, 0.3, x + dw / 2, dh + 0.3, '#64422c');
      for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) p.R(x - dw / 2 + 0.1 + m * dw / 2, 0.45 + k * dh / 3, x - 0.08 + m * dw / 2, 0.3 + (k + 0.82) * dh / 3, 'rgba(30,16,6,0.45)');
      p.R(x - 0.03, 0.3, x + 0.03, dh + 0.3, '#22140a');
      p.R(x - dw / 2 - 0.5, fh, x + dw / 2 + 0.5, fh + 0.16, '#efe2c2'); p.R(x - dw / 2 - 0.35, fh - 0.6, x + dw / 2 + 0.35, fh - 0.1, '#d6c29a');
      g.fillStyle = '#8f7752'; for (let m = 0; m < 9; m++) { g.beginPath(); g.arc(p.X(x - dw / 2 - 0.2 + m * (dw + 0.4) / 8), p.Y(fh - 0.35 + (m % 2) * 0.12), 0.1 * p.sx, 0, 2 * PI); g.fill(); }
    }
    const gr = g.createLinearGradient(0, 0, 0, h * 0.55); gr.addColorStop(0, 'rgba(45,30,15,0.45)'); gr.addColorStop(1, 'rgba(45,30,15,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  // a face of a tower: two tiers of round headed niches with slim shafts between string courses, the sunk panel of the upper shaft
  part_(CR.pier, (p, w, h, Wm, Hm) => {
    paintAshlar(g, w, h, Wm, Hm, 0.46, 1.0, '#d1b688', CJOINT, 9401, 1.0, 0.06);
    p.R(0, 0, 0.16, Hm, 'rgba(245,228,190,0.4)'); p.R(Wm - 0.14, 0, Wm, Hm, 'rgba(60,40,20,0.35)');
    for (const [y0, y1] of [[0.75, 3.75], [5.0, 7.7]]) { arched(p, 1, y0, y1 + 0.28, 1.28, '#e0caa0'); arched(p, 1, y0, y1 + 0.08, 0.94, '#a2875c'); arched(p, 1.07, y0, y1 - 0.06, 0.66, '#7a6242'); for (const x of [0.43, 1.57]) p.R(x - 0.07, y0, x + 0.07, y1 - 0.4, '#e6d2aa'); p.R(0.25, y0 - 0.2, 1.75, y0, '#e0caa0'); }
    for (const [y0, y1] of [[7.95, 9.0], [3.9, 4.35], [9.75, 11.0]]) { p.R(0.34, y0, 1.66, y1, '#a98f65'); p.R(0.44, y0 + 0.1, 1.58, y1 - 0.1, '#d6bd90'); }
    for (const y of [4.55, 9.35]) { p.R(0, y, Wm, y + 0.18, '#e2cca2'); p.R(0, y - 0.12, Wm, y, 'rgba(45,30,14,0.45)'); }
    wear(g, w, h, Wm, Hm, 9411, { dens: 3, streaks: 3, damp: 2 });
  });
  // a bay of the long flank: a round headed window low, a taller one high, the cornice
  part_(CR.side, (p, w, h, Wm, Hm) => {
    paintAshlar(g, w, h, Wm, Hm, 0.5, 1.2, '#c6ae87', '#8f7d5f', 9501, 1.0, 0.09); p.R(0, 0, Wm, 1.0, 'rgba(90,75,55,0.4)');
    for (const [y0, y1, ww] of [[2.0, 3.9, 0.95], [5.4, 8.9, 1.25]]) { arched(p, Wm / 2, y0, y1 + 0.35, ww + 0.65, '#d4bd94'); arched(p, Wm / 2, y0, y1 + 0.12, ww + 0.22, '#8f7956'); arched(p, Wm / 2, y0 + 0.1, y1, ww, '#2b241c'); p.R(Wm / 2 - 0.04, y0, Wm / 2 + 0.04, y1 - 0.3, '#c9b48e'); p.R(Wm / 2 - ww / 2 - 0.4, y0 - 0.2, Wm / 2 + ww / 2 + 0.4, y0, '#d4bd94'); }
    p.R(0, 4.5, Wm, 4.7, '#d4bd94'); p.R(0, 4.38, Wm, 4.5, 'rgba(45,30,14,0.4)'); p.R(0, Hm - 0.45, Wm, Hm, '#d8c198'); p.R(0, Hm - 0.62, Wm, Hm - 0.45, 'rgba(45,30,14,0.45)');
    wear(g, w, h, Wm, Hm, 9511, { dens: 8, streaks: 8, damp: 4 });
  });
  // the plain block right of the stair: tufa, one barred window
  part_(CR.block, (p, w, h, Wm, Hm) => {
    paintAshlar(g, w, h, Wm, Hm, 0.55, 1.3, '#c6a673', CJOINT, 9301, 1.2, 0.09); p.R(0, 0, Wm, 1.0, '#a98f66'); p.R(0, Hm - 0.35, Wm, Hm, '#bea474');
    const wx = Wm / 2 - 0.4; p.R(wx - 0.95, 3.3, wx + 0.95, 6.0, '#dcc49a'); p.R(wx - 0.72, 3.55, wx + 0.72, 5.75, '#1f1913');
    for (let m = wx - 0.6; m < wx + 0.7; m += 0.24) p.R(m, 3.55, m + 0.05, 5.75, '#453e36'); for (let y = 3.8; y < 5.7; y += 0.34) p.R(wx - 0.72, y, wx + 0.72, y + 0.05, '#453e36');
    wear(g, w, h, Wm, Hm, 9311, { dens: 5, streaks: 8, damp: 5 });
  });
}
function buildCatena() {
  initShared();
  const F0 = frameOf(CO, CN), W = F0.toWorld, pts = pairsOf(CAT.p), gr = groundRange(pts);
  const y0 = Math.min(groundY(...W(2, 0.5)), groundY(...W(6.5, 0.5)), groundY(...W(11, 0.5))), lo = Math.min(gr.lo, y0) - 1.5, base = lo - y0;
  const F = frame(CO[0], y0, CO[1], CN[0], CN[1]), at = (x, y, z) => mul(F, tr(x, y, z)), FL = y0 + CFL, LIT = '#d9c298', DIM = '#b59a6e';
  // plain coursed stone: it repeats up tall walls and over flat tops, so it carries no damp, streaks or darkened foot
  defMat('eCaStone', 256, 256, [3.2, 3.2], (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.4, 0.8, CGOLD, '#a28b64', 9001, 1.0, 0.05));
  defMat('eCaFront', 352, 264, [CXB - CXA, CWALL], paintCatFront);
  defMat('eCaBack', CAW, CAH, [1, 1], paintCatAtlas);
  defMat('eCaPar', 64, 64, [1, 1], (g, w, h) => {   // the openwork crest: a pierced panel and a small post per metre
    g.clearRect(0, 0, w, h); g.fillStyle = '#d8c298'; g.fillRect(0, h - 9, w, 9); g.fillRect(0, 12, w, 7); g.fillRect(0, 12, 9, h - 12);
    g.strokeStyle = '#cdb48a'; g.lineWidth = 6; g.beginPath(); g.arc(36, 37, 14, 0, 2 * PI); g.moveTo(9, 19); g.lineTo(w, h - 9); g.moveTo(w, 19); g.lineTo(9, h - 9); g.stroke();
    g.fillStyle = '#d8c298'; for (const x of [4, 36]) { g.beginPath(); g.moveTo(x - 5, 12); g.lineTo(x, 0); g.lineTo(x + 5, 12); g.fill(); }
  }, { alphaTest: 0.5, side: THREE.DoubleSide });
  begin(y0);
  const crest = (M, len, y) => { panel('eCaPar', len, 1.0, { M: mul(M, tr(0, y, 0)), uvk: [len / 1.0, 1] }); };
  const ring = (M, r, band, d, c) => { const s = new THREE.Shape(); s.moveTo(r + band, 0); s.absarc(0, 0, r + band, 0, PI, false); s.lineTo(-r, 0); s.absarc(0, 0, r, PI, 0, true); s.lineTo(r + band, 0); extrude('flat', s, d, { M, c, cs: 5, noao: true }); };
  // the church body behind the loggia (the outline cut at the loggia's back wall), the apse at the far end; painted bays and a crested parapet round it
  const L = pts.map(F0.toLocal), clip = [];
  for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], fa = CZB - a[1], fb = CZB - b[1]; if (fa >= 0) clip.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); clip.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
  const body = clip.map(q => W(q[0], q[1]));
  prism('eCaStone', body, lo, FL + CWALL);
  prism('flat', body, FL + CWALL, FL + CWALL + 0.12, { c: '#a8997c' });
  for (const e of edgesOf(body, [])) {
    const inward = F0.toLocal([e.mx, e.mz]); if (Math.abs(inward[1] - CZB) < 0.4) continue;   // (the loggia's own back wall)
    rim(e, FL + CWALL - 0.22, 0.34, LIT, { out: 0.28 });
    if (e.l < 1.5) continue;
    const M = frame(e.mx, FL + CWALL + 0.1, e.mz, e.nx, e.nz); crest(M, e.l, 0);
    const n = Math.max(1, Math.round(e.l / 5.8));
    bays('eCaBack', e, y0, CFL + CWALL - 0.2, 5.8, cuv(CR.side, e.l < 3.6 ? 0.5 : 1));
    if (e.l > 3.6) for (let i = 0; i <= n; i++) {   // the buttress piers between the bays, each ending in a small capped pinnacle over the crest
      const t = i / n, x = e.a[0] + (e.b[0] - e.a[0]) * t, z = e.a[1] + (e.b[1] - e.a[1]) * t, P = frame(x, 0, z, e.nx, e.nz);
      bx('eCaStone', P, -0.32, 0.32, lo, FL + CWALL + 1.2, -0.2, 0.28, { c: '#f4f0e6' }); bx('flat', P, -0.42, 0.42, FL + CWALL + 1.2, FL + CWALL + 1.42, -0.3, 0.38, { c: LIT, noao: true });
    }
  }
  // the tall plain wall of the block to the right of the stair
  const blk = [[13.75, -4.64], [19.86, -3.24], [21.32, -8.49], [14.41, -10.21]].map(q => W(q[0], q[1]));
  prism('eCaStone', blk, lo, FL + 7.6, { c: '#e8dcc0' }); prism('flat', blk, FL + 7.6, FL + 7.72, { c: '#a8997c' });
  for (const e of edgesOf(blk, [])) if (e.l > 5) { const l = F0.toLocal([e.mx, e.mz]); if (l[1] > -6 || l[0] > 19) bays('eCaBack', e, y0, CFL + 7.6, 6.3, cuv(CR.block)); rim(e, FL + 7.45, 0.27, DIM, { out: 0.2 }); }
  // the podium, the stair of twelve steps between its cheek walls, the iron railing at its foot
  bx('eCaStone', F, -1.5, 13.7, base, CFL, CZB, CZF - 0.2, { c: '#e4d6b8' });
  const going = (-CZF - 0.2) / 12;
  for (let i = 0; i < 12; i++) { const z = -0.1 - (i + 1) * going, top = CFL * (i + 1) / 12; bx('flat', F, CXA + 0.25, CXB - 0.25, i ? CFL * i / 12 - 0.1 : base, top, CZF - 0.25, z + going, { c: i % 2 ? '#a8997f' : '#b3a489' }); bx('flat', F, CXA + 0.25, CXB - 0.25, top - 0.05, top + 0.01, z + going - 0.12, z + going + 0.02, { c: '#d3c6aa', noao: true }); }
  for (const x of [CXA, CXB]) { const s = new THREE.Shape(); s.moveTo(0, base); s.lineTo(0, 0.7); s.lineTo(-CZF, CFL + 0.5); s.lineTo(-CZF, base); s.lineTo(0, base); extrude('eCaStone', s, 0.5, { M: mul(at(x - 0.25, 0, -0.1), rotY(PI / 2)), uvk: [1 / 3.2, 1 / 3.2] }); }
  for (let x = 0.2; x <= 13.01; x += 0.4) bx('flat', F, x - 0.025, x + 0.025, 0, 1.45, -0.09, -0.04, { c: '#2e2c28', noao: true });
  for (const y of [0.18, 1.2]) bx('flat', F, 0.2, 13.0, y, y + 0.06, -0.1, -0.03, { c: '#2e2c28', noao: true });
  // the loggia front: the wall over three arches on slim grey columns with leaf capitals, ribs, cornice, plaque, statue and crest
  const s = new THREE.Shape(); s.moveTo(CXA, CSP);
  for (const cx of CARCH) { s.lineTo(cx - CAR, CSP); s.absarc(cx, CSP, CAR, PI, 0, true); }
  s.lineTo(CXB, CSP); s.lineTo(CXB, CWALL); s.lineTo(CXA, CWALL); s.lineTo(CXA, CSP);
  extrude('eCaFront', s, 0.7, { M: at(0, CFL, CZF - 0.7), uv: 'keep', uvk: [1 / (CXB - CXA), 1 / CWALL], uvo: [-CXA / (CXB - CXA), 0], cs: 12, noao: true });
  for (const cx of CARCH) { ring(at(cx, CFL + CSP, CZF - 0.02), CAR, 0.18, 0.2, LIT); ring(at(cx, CFL + CSP, CZF - 0.02), CAR + 0.34, 0.14, 0.12, DIM); }
  const column = (x, z) => {
    bx('flat', F, x - 0.34, x + 0.34, CFL, CFL + 0.28, z - 0.34, z + 0.34, { c: DIM, noao: true });
    cyl('flat', 0.19, 0.24, CSP - 0.95, 10, { M: at(x, CFL + 0.28, z), c: '#a4a29a', noao: true });
    cyl('flat', 0.38, 0.2, 0.5, 8, { M: at(x, CFL + CSP - 0.67, z), c: '#dccba6', noao: true });
    bx('flat', F, x - 0.42, x + 0.42, CFL + CSP - 0.17, CFL + CSP + 0.02, z - 0.42, z + 0.42, { c: LIT, noao: true });
  };
  for (const x of [CXA + 0.18, (CARCH[0] + CARCH[1]) / 2, (CARCH[1] + CARCH[2]) / 2, CXB - 0.18]) column(x, CZF - 0.35);
  for (const x of [(CARCH[0] + CARCH[1]) / 2, (CARCH[1] + CARCH[2]) / 2]) bx('flat', F, x - 0.11, x + 0.11, CFL + CSP + 1.6, CFL + CWALL - 0.2, CZF - 0.05, CZF + 0.2, { c: LIT, noao: true });
  bx('flat', F, CXA, CXB, CFL + CWALL - 0.18, CFL + CWALL + 0.12, CZF - 0.7, CZF + 0.35, { c: LIT, noao: true });
  crest(at((CXA + CXB) / 2, 0, CZF + 0.12), CXB - CXA, CFL + CWALL + 0.12);
  bx('flat', F, CARCH[1] - 1.45, CARCH[1] + 1.45, CFL + 6.28, CFL + 6.4, CZF - 0.05, CZF + 0.18, { c: LIT, noao: true });
  statue('flat', at(CARCH[1], CFL + 7.4, CZF + 0.12), 0.75, { c: '#e9dcbc' });
  // the open ends of the loggia: an arch on each side, the ceiling, the back wall with its three portals
  for (const [x, ry] of [[-0.75, -PI / 2], [12.95, PI / 2]]) {
    const hw = (CZF - 1.7 - CZB) / 2, zc = CZB + hw, a = new THREE.Shape(); a.moveTo(-hw, CSP); a.absarc(0, CSP, hw - 0.12, PI, 0, true); a.lineTo(hw, CSP); a.lineTo(hw, CWALL); a.lineTo(-hw, CWALL); a.lineTo(-hw, CSP);
    const M = mul(at(x, CFL, zc), rotY(ry));
    extrude('eCaStone', a, 0.6, { M: mul(M, tr(0, 0, -0.6)), cs: 10, uvk: [1 / 3.2, 1 / 3.2] });
    ring(mul(M, tr(0, CSP, -0.02)), hw - 0.12, 0.22, 0.16, LIT);
    column(x - Math.sign(ry) * 0.3, CZB + 0.2);
    bx('flat', M, -hw, hw, CWALL - 0.18, CWALL + 0.12, -0.6, 0.3, { c: LIT, noao: true });
    crest(mul(M, tr(0, 0, 0.1)), hw * 2, CWALL + 0.12);
  }
  bx('flat', F, -0.2, 12.4, CFL + 6.65, CFL + CWALL, CZB, CZF - 0.6, { c: '#a89474' });
  panel('eCaBack', CXB - CXA + 1.4, 6.65, { M: at((CXA + CXB) / 2, CFL, CZB + 0.06), ...cuv(CR.back) });
  // the two slim towers at the corners of the loggia: painted niche faces, projecting string courses and hoods, a narrower shaft over the crest with its moulded cap
  for (const [a, b, sg] of [[-1.35, CXA, -1], [CXB, 13.55, 1]]) {
    const xc = (a + b) / 2, hw = (b - a) / 2, z0 = CZF - 1.7, z1 = CZF + 0.25, zc = (z0 + z1) / 2;
    bx('eCaStone', F, a - 0.12, b + 0.12, base, CFL + 0.5, z0 - 0.12, z1 + 0.12, { c: '#e4d6b8' });
    bx('eCaStone', F, a, b, CFL + 0.5, CFL + 9.35, z0, z1);
    bx('eCaStone', F, xc - 0.68, xc + 0.68, CFL + 9.35, CFL + 11.4, zc - 0.68, zc + 0.68);
    for (const [M, fw] of [[at(xc, 0, z1 + 0.012), 2 * hw], [mul(at(sg < 0 ? a - 0.012 : b + 0.012, 0, zc), rotY(sg * PI / 2)), z1 - z0]]) {
      panel('eCaBack', fw, 8.85, { M: mul(M, tr(0, CFL + 0.5, 0)), ...cuv(CR.pier, 1, 9.35 / 11.4 - 0.5 / 11.4, 0.5 / 11.4) });
      for (const y of [3.75 + 0.3, 7.7 + 0.3]) ring(mul(M, tr(0, CFL + y - 0.64, -0.02)), 0.58, 0.16, 0.18, LIT);
      for (const y of [0.55, 4.75]) bx('flat', M, -fw / 2 + 0.2, fw / 2 - 0.2, CFL + y - 0.05, CFL + y + 0.12, -0.05, 0.14, { c: LIT, noao: true });
    }
    for (const [M] of [[at(xc, 0, zc + 0.69)], [mul(at(xc + sg * 0.69, 0, zc), rotY(sg * PI / 2))]]) panel('eCaBack', 1.36, 2.05, { M: mul(M, tr(0, CFL + 9.35, 0)), ...cuv(CR.pier, 1, 2.05 / 11.4, 9.35 / 11.4) });
    for (const [y, o, hh] of [[4.5, 0.18, 0.26], [9.3, 0.24, 0.3]]) bx('flat', F, a - o, b + o, CFL + y, CFL + y + hh, z0 - o, z1 + o, { c: LIT, noao: true });
    bx('flat', F, xc - 0.8, xc + 0.8, CFL + 11.4, CFL + 11.58, zc - 0.8, zc + 0.8, { c: DIM, noao: true });
    bx('flat', F, xc - 0.9, xc + 0.9, CFL + 11.58, CFL + 11.86, zc - 0.9, zc + 0.9, { c: LIT, noao: true });
  }
  const o = end('Chiesa di Santa Maria della Catena');
  o.userData.solids = [[body.flat(), null, FL + CWALL], [blk.flat(), null, FL + 7.6]];   // the stair and the open loggia hide nothing
  return o;
}
export const CATENA = { name: 'Chiesa di Santa Maria della Catena', x: 724, z: -382, radius: 40, skipIds: [CAT.id], build: buildCatena };

// ====================================================================================================
// 3. Castello a Mare
// ====================================================================================================
const CAS = { id: 'w926609495', p: [503.4, -714.6, 508.9, -718.5, 508, -719.7, 509.1, -720.5, 514.6, -724.4, 520, -716.7, 523.6, -711.6, 528.7, -704.5, 521.6, -699.8, 520.1, -702, 516.4, -699.4, 517.2, -697.7, 510.7, -693.7, 507.9, -696.5, 501.9, -691.3, 503.5, -687.9, 499.9, -683.7, 499.4, -679.8, 489.4, -674, 471.9, -679.2, 475.2, -697.7, 476.2, -699, 479, -702.4, 492.8, -708.9, 495.7, -706.6, 501.5, -709.2, 501.6, -712.2] };
const CMT = 1.9;   // wall thickness of the ruined curtain
function paintCasGate(g, w, h) {   // the gate front 8 m x 8.5 m: ashlar, the round arch cut in the geometry, voussoirs, two chain slots, a plaque
  const p = mkp(g, w, h, 8, 8.5, -4), { X, Y, sx, sy, R } = p;
  paintAshlar(g, w, h, 8, 8.5, 0.4, 0.95, '#c3a263', '#8d7549', 9501, 1.6, 0.1);
  R(-4, 0, 4, 0.9, '#caa59a'); g.fillStyle = 'rgba(160,120,100,0.5)'; for (let i = 0; i < 14; i++) g.fillRect(i * w / 14, Y(0.9) + (i % 3) * 3, w / 14, 4);   // the pink plaster plinth, peeling
  R(-4, 7.05, 4, 7.4, '#b19259'); R(-4, 7.0, 4, 7.05, 'rgba(30,20,10,0.5)');
  g.save(); g.translate(X(0), Y(3.7)); g.scale(sx, sy); g.strokeStyle = 'rgba(60,44,24,0.7)'; g.lineWidth = 0.05; g.fillStyle = '#cfb27a'; g.beginPath(); g.arc(0, 0, 2.5, PI, 2 * PI); g.lineTo(2.5, 0.4); g.lineTo(-2.5, 0.4); g.fill();
  for (let a = PI + 0.1; a < 2 * PI; a += 0.19) { g.beginPath(); g.moveTo(Math.cos(a) * 1.8, Math.sin(a) * 1.8); g.lineTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5); g.stroke(); } g.restore();
  for (const sg of [-1, 1]) { R(sg * 1.5 - 0.15 + 0.0, 5.9, sg * 1.5 + 0.15, 7.6, '#1e1a15'); R(sg * 1.5 - 0.25, 7.6, sg * 1.5 + 0.25, 7.75, '#a68a56'); }   // the two chain slots
  R(-1.1, 6.35, 1.1, 6.95, '#dedacc'); R(-1.0, 6.45, 1.0, 6.85, '#c9c5b6'); g.fillStyle = 'rgba(70,64,52,0.6)'; for (let k = 0; k < 3; k++) g.fillRect(X(-0.8), Y(6.75 - k * 0.12), 1.6 * sx, 1.4);
  wear(g, w, h, 8, 8.5, 9511, { dens: 10, damp: 4, streaks: 8 });
}
function buildCastello() {
  initShared();
  const pts = pairsOf(CAS.p), gr = groundRange(pts), y0 = gr.avg, lo = Math.min(gr.lo, y0) - 1.2;
  defMat('eCmStone', 256, 256, [3.2, 3.2], (g, w, h) => { paintAshlar(g, w, h, 3.2, 3.2, 0.36, 0.85, '#c3a263', '#8d7549', 9401, 1.6, 0.1); wear(g, w, h, 3.2, 3.2, 9402, { dens: 8, damp: 3, streaks: 4 }); });
  defMat('eCmRub', 256, 256, [3.2, 3.2], (g, w, h) => {
    paintAshlar(g, w, h, 3.2, 3.2, 0.34, 0.7, '#b39460', '#6e5c40', 9411, 2.4, 0.14); wear(g, w, h, 3.2, 3.2, 9412, { dens: 5, damp: 6, streaks: 3 });
    const r = RNG(9413); for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? 'rgba(88,104,52,0.26)' : 'rgba(40,36,26,0.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 2 * PI); g.fill(); }   // moss and soot
  });
  defMat('eCmGate', 384, 384, [8, 8.5], paintCasGate);
  begin(y0);
  prism('earth', pts, lo, y0 + 0.3);
  const r = RNG(9421), edges = edgesOf(pts, []);
  // the gate tower on the middle of the north-east run
  const gE = edges.reduce((a, e) => (e.l > a.l && e.mx > 515 && e.mz < -706 ? e : a), edges[0]);
  const GF = frame(gE.mx, y0, gE.mz, gE.nx, gE.nz), gat = (x, y, z) => mul(GF, tr(x, y, z));
  // ruined curtain walls: a run of blocks along every edge with a ragged top, each standing inside the edge
  for (const e of edges) {
    if (e === gE) continue;
    const F = frame(e.mx, y0, e.mz, e.nx, e.nz), n = Math.max(1, Math.round(e.l / 3.2)), sl = e.l / n;
    for (let i = 0; i < n; i++) {
      const x0 = -e.l / 2 + i * sl, hgt = 3.0 + r() * 3.4 + (r() < 0.16 ? 2.6 : 0) - (r() < 0.2 ? 1.6 : 0);
      bx('eCmRub', F, x0 - 0.1, x0 + sl + 0.1, 0.2, hgt, -CMT, 0, { c: i % 3 === 0 ? '#d8cdb8' : '#ffffff' });
      if (r() < 0.4) bx('eCmRub', F, x0 + sl * 0.2, x0 + sl * 0.8, hgt, hgt + 0.6 + r() * 0.8, -CMT * 0.7, -CMT * 0.1);
    }
  }
  // the gate tower: chamfered corners, the arched front, the passage, merlons with slits
  const GW = 11, GD = 7, GH = 8.6;
  for (const sg of [-1, 1]) bx('eCmStone', GF, sg < 0 ? -GW / 2 : 1.8, sg < 0 ? -1.8 : GW / 2, 0.2, GH, -GD, -1.0);
  bx('eCmStone', GF, -1.8, 1.8, 5.7, GH, -GD, -1.0);
  for (const sg of [-1, 1]) { const m = mul(GF, mul(tr(sg * 4.7, 0.2, -0.6), rotY(sg * 0.7))); bx('eCmStone', m, -1.0, 1.0, 0, GH - 0.2, -0.6, 0.6); }   // the chamfered corners
  archBay('eCmGate', 8, GH, 3.6, 5.0, 1.0, { M: gat(0, 0.2, -1.0), uv: 'keep', uvk: [1 / 8, 1 / 8.5], uvo: [0.5, 0], noao: true });
  bx('flat', GF, -1.6, 1.6, 0.2, 0.32, -GD, 0.5, { c: '#8a7a5e' });   // the threshold
  for (let x = -4.6; x <= 4.7; x += 1.9) { bx('eCmStone', GF, x - 0.5, x + 0.5, GH, GH + 1.1, -1.2, -0.3); bx('dark', GF, x - 0.06, x + 0.06, GH + 0.4, GH + 0.95, -0.31, -0.28, { noao: true }); }
  for (const sg of [-1, 1]) for (let z = -2.4; z > -GD; z -= 1.9) bx('eCmStone', GF, sg < 0 ? -GW / 2 : GW / 2 - 0.9, sg < 0 ? -GW / 2 + 0.9 : GW / 2, GH, GH + 1.1, z - 0.5, z + 0.5);
  bx('eCmStone', GF, -GW / 2, GW / 2, GH - 0.2, GH, -GD, -1.0, { c: '#e6dcc6' });
  // rubble in the court, the keep's stumps
  for (let i = 0; i < 16; i++) { const k = Math.floor(r() * pts.length), q = pts[k], cx = pts.reduce((a, b) => a + b[0], 0) / pts.length, cz = pts.reduce((a, b) => a + b[1], 0) / pts.length, t = 0.25 + r() * 0.35; const x = q[0] + (cx - q[0]) * t, z = q[1] + (cz - q[1]) * t; if (!inPoly(x, z, pts)) continue; const F = frame(x, y0 + 0.3, z, Math.sin(r() * 6), Math.cos(r() * 6)); bx('eCmRub', F, -0.5 - r(), 0.5 + r(), 0, 0.5 + r() * 1.3, -0.5 - r() * 0.7, 0.5 + r() * 0.7); }
  const o = end('Castello a Mare');
  o.userData.solids = [[CAS.p, null, y0 + 9.5]];
  return o;
}
export const CASTELLO = { name: 'Castello a Mare', x: 500, z: -700, radius: 40, skipIds: [CAS.id], build: buildCastello };

// ====================================================================================================
// 4. Santa Maria dello Spasimo
// ====================================================================================================
const SPA = { id: 'r403706.0', p: [889.6, 181.3, 921.1, 154.9, 924.9, 157.4, 941.8, 145, 949.2, 149, 949.7, 155.9, 932.1, 173.9, 932.6, 180.3, 907, 200.3], holes: [[901.4, 181, 919.4, 165.7, 927.1, 174.2, 909.9, 189.6]] };
const SPT1 = 8.5, SPW = 12.2;   // top of the lower roofed tier outside, top of the nave walls
// the inner faces of the long nave walls, two 5 m bays side by side on one canvas (left half the south wall, right half the north wall), SPW tall: rubble, a round chapel arch on dressed piers,
// and high up a small rectangular window (south) or a round headed opening nearer the top (north)
function paintSpNave(g, w, h) {
  for (const north of [0, 1]) {
    const hw = w / 2, p = mkp(g, hw, h, 5, SPW), { sx, sy, X, Y, R } = p;
    g.save(); g.translate(north * hw, 0); g.beginPath(); g.rect(0, 0, hw, h); g.clip();
    paintAshlar(g, hw, h, 5, SPW, 0.28, 0.5, '#ab9268', '#7a6748', 9601 + north, 1.2, 0.17);
    const m = (draw) => { g.save(); g.translate(X(2.5), Y(0)); g.scale(sx, -sy); draw(); g.restore(); };   // metres, y up, from the foot of the bay's middle
    const fill = (col, f) => { g.fillStyle = col; g.beginPath(); f(); g.closePath(); g.fill(); };
    const head = (x, y0, ys, r) => () => { g.moveTo(x - r, y0); g.lineTo(x - r, ys); g.arc(x, ys, r, PI, 0, true); g.lineTo(x + r, y0); };
    for (const x of [0, 4.45]) { R(x, 0, x + 0.55, 3.4, '#b59c72'); for (let y = 0.45; y < 3.4; y += 0.45) R(x, y, x + 0.55, y + 0.04, 'rgba(70,52,30,0.45)'); }
    m(() => {
      g.strokeStyle = 'rgba(190,165,118,0.55)'; g.lineWidth = 0.07;
      for (let a = 0.06; a < PI; a += 0.12) { g.beginPath(); g.moveTo(Math.cos(a) * 2.1, 3.35 + Math.sin(a) * 2.1); g.lineTo(Math.cos(a) * 2.45, 3.35 + Math.sin(a) * 2.45); g.stroke(); }   // the thin stones set on edge over the arch
      fill('#c1a779', head(0, 0, 3.35, 2.05));
      g.strokeStyle = 'rgba(80,58,32,0.55)'; g.lineWidth = 0.045;
      for (let a = 0.2; a < PI; a += 0.26) { g.beginPath(); g.moveTo(Math.cos(a) * 1.6, 3.35 + Math.sin(a) * 1.6); g.lineTo(Math.cos(a) * 2.05, 3.35 + Math.sin(a) * 2.05); g.stroke(); }
      for (let y = 0.45; y < 3.4; y += 0.45) for (const x of [-2.05, 1.6]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.45, y); g.stroke(); }
      fill('#231b13', head(0, 0, 3.35, 1.6));
      fill('rgba(150,121,82,0.55)', () => { g.moveTo(-1.6, 0); g.lineTo(-1.6, 3.35); g.arc(0, 3.35, 1.6, PI, PI / 2, true); g.quadraticCurveTo(-1.0, 4.3, -1.0, 3.0); g.lineTo(-1.0, 0); });   // the thickness of the arch on one side
      if (north) {
        fill('#c0a578', head(0, 9.0, 10.45, 0.85)); fill('#7c6240', head(0, 9.15, 10.45, 0.6)); fill('#2b2117', head(0.14, 9.15, 10.38, 0.38));
      } else {
        fill('#bea377', () => g.rect(-0.72, 7.45, 1.44, 1.95)); fill('#70573a', () => g.rect(-0.48, 7.65, 0.96, 1.5)); fill('#241c14', () => g.rect(-0.18, 7.65, 0.6, 1.33));
        fill('#cdb486', () => g.rect(-0.8, 7.4, 1.6, 0.16)); fill('#4a3a26', () => g.rect(-1.75, 6.35, 0.3, 0.36));   // the sill, a putlog hole
      }
    });
    wear(g, hw, h, 5, SPW, 9611 + north * 7, { dens: 10, damp: 5, streaks: 8 });
    g.restore();
  }
}
function paintSpWest(g, w, h, Wm) {   // the inner face of the west end wall: plain rubble, a doorway with a flat lintel under a round relieving arch, one splayed round headed window high up
  const p = mkp(g, w, h, Wm, SPW), { X, Y, sx, sy, R } = p, cx = Wm / 2;
  paintAshlar(g, w, h, Wm, SPW, 0.34, 0.8, '#ad946b', '#7d6a4b', 9621, 1.4, 0.13);
  g.save(); g.translate(X(cx), Y(0)); g.scale(sx, -sy);   // metres, y up, from the middle of the wall
  const arch = (r, y, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.arc(0, y, r, 0, PI); g.stroke(); };
  g.fillStyle = '#a58c64'; g.beginPath(); g.arc(0, 3.35, 1.5, 0, PI); g.fill();   // the rubble infill inside the relieving arch
  arch(1.5, 3.35, 0.32, '#9c7f56');   // the relieving arch of dark ashlar
  g.fillStyle = '#cdb68a'; g.fillRect(-1.45, 0, 0.4, 3.35); g.fillRect(1.05, 0, 0.4, 3.35); g.fillRect(-1.45, 2.95, 2.9, 0.4);   // the dressed jambs and the flat lintel
  g.fillStyle = '#2a2219'; g.fillRect(-1.05, 0, 2.1, 2.95);   // the doorway, dark, a wall of rubble seen behind it
  g.fillStyle = 'rgba(120,100,70,0.35)'; g.fillRect(-1.05, 0, 2.1, 0.6);
  g.translate(0, 1.2);
  g.fillStyle = '#c9b184'; g.beginPath(); g.moveTo(-1.7, 6.1); g.lineTo(-1.7, 8.8); g.arc(0, 8.8, 1.7, PI, 2 * PI, true); g.lineTo(1.7, 6.1); g.closePath(); g.fill();   // the dressed splay of the window
  g.fillStyle = '#8fa6b0'; g.beginPath(); g.moveTo(-0.4, 6.55); g.lineTo(-0.4, 9.2); g.arc(0, 9.2, 0.4, PI, 2 * PI, true); g.lineTo(0.4, 6.55); g.closePath(); g.fill();   // the opening, sky
  g.fillStyle = '#b9a176'; g.fillRect(-1.1, 6.35, 2.2, 0.2);   // the sill
  g.restore();
  wear(g, w, h, Wm, SPW, 9622, { dens: 10, damp: 5, streaks: 8 });
}
function paintSpOuter(g, w, h) {   // an outer face of the lower tier, 4.5 m x 8.5 m: rubble ashlar, a buttress strip, a small pointed window
  const p = mkp(g, w, h, 4.5, SPT1), { X, Y, sx, sy, R } = p;
  paintAshlar(g, w, h, 4.5, SPT1, 0.5, 1.2, '#b8996a', '#7f6a4a', 9701, 1.6, 0.12);
  R(0, 0, 0.6, SPT1, 'rgba(226,204,160,0.3)'); R(3.9, 0, 4.5, SPT1, 'rgba(226,204,160,0.3)'); R(0.6, 0, 0.66, SPT1, 'rgba(40,28,14,0.35)');
  g.save(); g.translate(X(2.25), Y(5.4)); g.scale(sx, sy); g.fillStyle = '#d0b684'; g.beginPath(); g.moveTo(-0.6, 1.5); g.lineTo(-0.6, 0); g.quadraticCurveTo(-0.6, -0.8, 0, -1.2); g.quadraticCurveTo(0.6, -0.8, 0.6, 0); g.lineTo(0.6, 1.5); g.fill();
  g.fillStyle = '#231b14'; g.beginPath(); g.moveTo(-0.38, 1.5); g.lineTo(-0.38, 0); g.quadraticCurveTo(-0.38, -0.6, 0, -0.9); g.quadraticCurveTo(0.38, -0.6, 0.38, 0); g.lineTo(0.38, 1.5); g.fill(); g.restore();
  R(0, 7.9, 4.5, 8.5, '#a98b5e');
  wear(g, w, h, 4.5, SPT1, 9711, { dens: 9, damp: 5, streaks: 6 });
}
function spEastEnd(F, len) {   // the east end: the great pointed arch to the presbytery, the shaded stone seen through it and the narrow window of the apse
  panel('eSpStone', len, SPW, { M: mul(F, tr(0, 0, 0.05)), uvk: [len / 4, SPW / 4] });
  const OW = 8.2, OH = 9.4, r = OW / 2;
  const arch = (r_, h, p = new THREE.Shape()) => { p.moveTo(-r_, 0); p.lineTo(-r_, h - r_); p.quadraticCurveTo(-r_, h - r_ + r_ * 0.75, 0, h + r_ * 0.45); p.quadraticCurveTo(r_, h - r_ + r_ * 0.75, r_, h - r_); p.lineTo(r_, 0); p.lineTo(-r_, 0); return p; };
  extrude('eSpStone', arch(r, OH), 0.02, { M: F, p: [0, 0, 0.06], c: '#968874' });
  extrude('flat', arch(0.75, 2.6), 0.02, { M: F, p: [0, 4.1, 0.08], c: '#b39a70', noao: true });   // the dressed frame of the apse window
  extrude('flat', arch(0.4, 2.2), 0.02, { M: F, p: [0, 4.35, 0.1], c: '#8fa6b0', noao: true });
  bx('flat', F, -0.6, 0.6, 0, 1.8, 0.08, 0.1, { c: '#2a2219', noao: true });
  archBay('eSpStone', len, SPW, OW, OH, 0.44, { M: F, p: [0, 0, 0.06], pointed: true });
  const ring = arch(r + 0.45, OH + 0.3); ring.holes.push(arch(r - 0.02, OH - 0.02, new THREE.Path()));
  extrude('flat', ring, 0.1, { M: F, p: [0, 0, 0.5], c: '#c3a878', noao: true });
}
function spTree(at, a, c, y0) {
  const r = RNG(9821), Y = new THREE.Vector3(0, 1, 0), BARK = '#5d5246';
  const limb = (p, q, r0, r1, seg = 5) => {
    const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), len = d.length();
    cyl('flat', r1, r0, len * 1.03, seg, { M: new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), new THREE.Vector3(1, 1, 1)), open: true, c: BARK, noao: true });
  };
  const P = (da, h, dc) => at(a + da, y0 + h, c + dc);   // metres from the foot: east, up, south
  const foot = P(0, 0, 0), knee = P(0.3, 4.6, 0.5), fork = P(0.2, 9.0, 1.7);
  limb(foot, knee, 0.38, 0.28, 7); limb(knee, fork, 0.28, 0.21, 7);
  const south = [fork, P(0.1, 10.8, 3.5), P(0.4, 12.4, 4.0), P(0.2, 14.0, 4.5)], north = [fork, P(0.6, 11.2, 1.0), P(0.4, 13.3, 0.4), P(0.7, 15.2, -0.4)];
  for (const run of [south, north]) for (let i = 1; i < run.length; i++) {
    limb(run[i - 1], run[i], 0.2 - i * 0.045, 0.16 - i * 0.045);
    for (let k = 0; k < 6; k++) {   // twigs, each with two forks
      const q = run[i], m = [q[0] + (r() - 0.5) * 2.4, q[1] + 0.1 + r() * 1.3, q[2] + (r() - 0.5) * 2.4];
      limb(q, m, 0.065, 0.04, 3);
      for (let j = 0; j < 2; j++) limb(m, [m[0] + (r() - 0.5) * 1.5, m[1] - 0.2 + r() * 1.0, m[2] + (r() - 0.5) * 1.5], 0.04, 0.014, 3);
    }
  }
}
function buildSpasimo() {
  initShared();
  const pts = pairsOf(SPA.p), holes = SPA.holes.map(pairsOf), gr = groundRange(pts), y0 = gr.avg, lo = Math.min(gr.lo, y0) - 1.5;
  defMat('eSpStone', 384, 384, [4, 4], (g, w, h) => { paintAshlar(g, w, h, 4, 4, 0.46, 1.1, '#b89d70', '#7f6a4a', 9801, 1.8, 0.12); wear(g, w, h, 4, 4, 9802, { dens: 6, damp: 4, streaks: 4 }); });
  defMat('eSpNave', 512, 384, [10, SPW], paintSpNave);
  defMat('eSpOuter', 384, 384, [4.5, SPT1], paintSpOuter);
  const westE = edgesOf(pts, holes).filter(q => q.hole && q.l < 15).reduce((a, q) => (q.mx < a.mx ? q : a));   // the short end of the nave that faces away from the apse
  defMat('eSpWest', 512, 384, [westE.l, SPW], (g, w, h) => paintSpWest(g, w, h, westE.l));
  begin(y0);
  prism('eSpStone', pts, lo, y0 + SPT1, { holes });
  prism('flat', pts, y0 + SPT1, y0 + SPT1 + 0.14, { holes, c: '#7e7567' });
  const edges = edgesOf(pts, holes), r = RNG(9811), westE2 = edges.find(q => q.hole && q.a === westE.a);
  for (const e of edges.filter(q => !q.hole)) {
    if (e.l < 3) continue;
    bays('eSpOuter', e, y0, SPT1, 4.5);
    rim(e, y0 + SPT1 - 0.5, 0.6, '#a98b5e');
  }
  for (const e of edges.filter(q => q.hole)) {   // the nave walls: painted inner faces under a level top, but for the gable over the east arch
    const F = frame(e.mx, y0, e.mz, e.nx, e.nz), east = e.l < 15 && e !== westE2;
    if (e === westE2) bays('eSpWest', e, y0, SPW, e.l, { off: 0.05 });
    else if (!east) bays('eSpNave', e, y0, SPW, 5, { off: 0.05, uvk: [0.5, 1], uvo: [e.nz > 0 ? 0.5 : 0, 0] });   // (the north wall faces +z, into the nave)
    else spEastEnd(F, e.l);
    bx('eSpStone', F, -e.l / 2, e.l / 2, SPT1, SPW, -1.7, 0);
    if (!east) continue;
    const n = Math.max(2, Math.round(e.l / 1.9)), sl = e.l / n;
    for (let i = 0; i < n; i++) {   // the stepped gable
      const tri = 1 - Math.abs((i + 0.5) / n - 0.5) * 2;
      bx('eSpStone', F, -e.l / 2 + i * sl, -e.l / 2 + (i + 1) * sl, SPW, SPW + 0.5 + tri * 3.6 + r() * 0.4, -1.7, 0.5, { c: i % 3 ? '#ffffff' : '#e6dcc8' });
    }
    bx('flat', F, -0.4, 0.4, SPW + 1.5, SPW + 2.3, 0.49, 0.52, { c: '#1f1912', noao: true });   // the small square opening in the gable
  }
  // the bare tree inside, near the west end on the north side: a leaning trunk that forks into two limbs and a crown of twigs above the walls
  {
    const w = [westE.mx, westE.mz], far = edges.find(q => q.hole && q.l < 15 && q !== westE2), l = Math.hypot(far.mx - w[0], far.mz - w[1]);
    const u = [(far.mx - w[0]) / l, (far.mz - w[1]) / l], s = [-u[1], u[0]];   // along the nave towards the east, and across it towards the south
    spTree((a, y, c) => [w[0] + u[0] * a + s[0] * c, y, w[1] + u[1] * a + s[1] * c], 3.2, -3.6, groundY(w[0] + u[0] * 3.2 - s[0] * 3.6, w[1] + u[1] * 3.2 - s[1] * 3.6) - 0.2);
  }
  const o = end('Santa Maria dello Spasimo');
  o.userData.solids = [[SPA.p, SPA.holes, y0 + SPT1 + 0.2]];
  return o;
}
export const SPASIMO = { name: 'Santa Maria dello Spasimo', x: 920, z: 170, radius: 40, skipIds: [SPA.id], build: buildSpasimo };

export const BATCH_E = [STERI_LM, CATENA, CASTELLO, SPASIMO];
