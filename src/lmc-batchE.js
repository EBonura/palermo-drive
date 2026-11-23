// City landmarks, batch E: Palazzo Chiaramonte-Steri (r1291721.0), Castello a Mare (w926609495), Chiesa di Santa Maria della Catena (w49772132), Santa Maria dello Spasimo (r403706.0).
// Registered through BATCH_E in src/landmarks-city.js; each one replaces its OSM footprint. Collision stays the footprint. World coordinates are the ones of the tile data.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions, orders and colours read):
//   Steri: Palermo-Palazzo-Chiaramonte-bjs2007-01.jpg (the corner of the two street fronts); Palermo, Palazzo Chiaramonte-Steri.jpg (the same corner, wider, with the balcony of the next palace and the crowned merlons);
//     Palazzo steri3.jpg (the windows of the upper floors from below); Steri PA 06 04 2019 01.jpg (the portal on the long front). The graffiti photos of the cells (2015) show only interiors and were not used.
//   Catena: Facade - Santa Maria della Catena - Palermo - Italy 2015.JPG (the front from the steps); Santa Maria Catena.jpg (from the port side); Chiesa di S. Maria della Catena and La Cala Port, Palermo, Italy (9458255414).jpg (the stair and the plain wall on the right);
//     Santa Maria della Catena.jpg (the corner with the pinnacle piers).
//   Castello a Mare: Castello a mare di Palermo ingresso principale 06 nov 2016.jpg (the gate arch); Castello a Mare, Palermo.jpg (the low curtain walls and the corner tower, 2022);
//     Castello a mare di Palermo fronte corpo fabbrica principale 06 nov 2016.jpg (the keep under scaffolding); Palermo-Castello-a-Mare-bjs2007-01.jpg (fetched, the keep from far).
//   Spasimo: Santa Maria dello Spasimo, Chiesa dall' Alto.jpg (the nave with the chapel arcade); Chiesa di Santa Maria dello Spasimo Palermo 04.jpg and 03.jpg (the apse, the ribbed vault, the narrow lancet);
//     Spasimo esterno.jpg (the outside of the nave end, the broken pointed arch, the stepped gable); LoSpasimoPalermo-2025-09-msu-0366-4052.jpg (the skyline, fetched, a silhouette only).
// Read from the photos:
//   Steri: a square, fortress-like block of three storeys in pale golden sandstone ashlar (courses about half a metre), a plain ground floor with only small slits, a thin dark string course over it and another over the first floor;
//     on the two upper floors a tall round hood with a zig-zag inlay of dark lava stone over each pair of narrow lights (a colonnette between, wooden lattice behind), the upper ones smaller; Y-shaped stone spouts under the top;
//     a cornice and Ghibelline merlons all round. The portal on the long front: a round arch under a flat console cornice, jambs of stepped rusticated blocks, a small rectangular window over it.
//   Catena: warm golden sandstone ashlar; a raised loggia of three round arches (two free grey columns with leaf capitals, a respond column against each end pier) reached by a broad flight of steps; the two end piers are square towers
//     with pointed niches in two tiers and a pinnacle; over the arches a plain wall with an inscription plaque and a statue, then an openwork frieze; in the back wall of the loggia three portals (the middle one bigger, carved lintels);
//     to the right of the stair a tall plain wall of the church body with one barred window.
//   Castello a Mare: golden tufa ashlar in small courses, a pink plaster plinth, a gate tower with chamfered corners, a round arch with big voussoirs, two narrow chain slots over it and a marble plaque, square merlons with slits;
//     the rest are low rubble walls with ragged tops round a grass court.
//   Spasimo: a nave with no roof, walls of warm golden ashlar and rubble, a deep arcade of pointed chapel arches along the inside (a lower roofed tier outside), tall narrow lancet windows high up, a stepped ruined gable.
// Not known and not drawn: the interiors (cells of the Steri, the vault of the Spasimo), the exact corners of the Steri's second court, any front of the Spasimo (no photo found of its west end), the bridge over the moat of the castle, the stair side walls of the Catena.
import * as THREE from 'three';
import { PI, bx, cyl, panel, part, prism, extrude, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, paintAshlar, pairsOf, groundRange, RNG, archBay } from './lmc-kit.js';

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

function buildSteri() {
  initShared();
  const pts = pairsOf(STERI.p), holes = STERI.holes.map(pairsOf), gr = groundRange(pts);
  const edges = edgesOf(pts, holes), outer = edges.filter(e => !e.hole);
  const west = outer.reduce((a, e) => (e.l > a.l ? e : a), outer[0]);   // the long front on the garden square
  const y0 = groundY(west.mx, west.mz), top = y0 + SH, lo = Math.min(gr.lo, y0) - 1.5;
  defMat('eStBay', 384, 384, [SBW, SH], (g, w, h) => paintSteriBay(g, w, h, false));
  defMat('eStDoor', 384, 384, [SBW, SH], (g, w, h) => paintSteriBay(g, w, h, true));
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
  for (const e of edges.filter(q => q.hole)) rim(e, top - 0.5, 0.6, '#a68b63');
  const o = end('Palazzo Chiaramonte-Steri');
  o.userData.solids = [[STERI.p, STERI.holes, top + 1.4]];
  return o;
}
export const STERI_LM = { name: 'Palazzo Chiaramonte-Steri', x: 776, z: -206, radius: 40, skipIds: [STERI.id], build: buildSteri };

// ====================================================================================================
// 2. Chiesa di Santa Maria della Catena
// ====================================================================================================
const CAT = { id: 'w49772132', p: [705.6, -375.8, 709.4, -378.8, 708.2, -380.4, 734.2, -400.8, 737.3, -397.1, 740.2, -397.3, 743.2, -393.7, 742.7, -391.5, 744.5, -388.6, 741.1, -386.3, 741.8, -385, 738.6, -382.8, 722.8, -371.8, 726.1, -365.5, 721.2, -363.1, 718.2, -368.6, 714.3, -366, 710.2, -370.6] };
const CO = [721.2, -390.6], CN = [-0.617, -0.787];   // origin on the front edge (the 33 m run facing the port), +z out of the front
const CFL = 2.8, CPAR = 10.4, CTOP = CFL + CPAR, CGOLD = '#cfae7a', CJOINT = '#9d8359';
const CLOC = [[21.4, -2], [16.6, -2], [16.5, 0], [1.5, 0], [1.5, -11], [-19.2, -11.1], [-17.5, -12.6], [-17.1, -16], [-13, -15.7], [-12.8, -17.1], [-8.9, -16.9], [10.3, -15.8], [11.6, -22.8], [17, -21.6], [15.9, -15.5], [20.6, -15.1], [21, -9]];
const CARCH = [-11.9, -7.5, -3.1], CAR = 2.2, CSP = 4.3, CPW = 18, CX0 = -16.5;   // arch centres, radius, springing above the floor, loggia width and its left end
function paintCatFront(g, w, h) {   // the front of the loggia, 18 m x CPAR m, x from CX0, y up from the floor
  const p = mkp(g, w, h, CPW, CPAR, CX0), { X, Y, sx, sy, R } = p;
  paintAshlar(g, w, h, CPW, CPAR, 0.5, 1.2, CGOLD, CJOINT, 9101, 1.4, 0.08);
  for (const pierX of [[-16.5, -14.1], [-0.9, 1.5]]) {   // the end piers: panels with pointed niches in two tiers
    const [a, b] = pierX; R(a, 0, b, CPAR, 'rgba(228,205,160,0.28)'); R(a, 0, a + 0.1, CPAR, 'rgba(40,28,14,0.35)'); R(b - 0.1, 0, b, CPAR, 'rgba(40,28,14,0.35)');
    for (const [y0, y1] of [[0.6, 3.6], [5.4, 8.6]]) {
      const cx = (a + b) / 2, ww = 1.0; g.fillStyle = '#d9be90'; g.fillRect(X(cx - ww / 2 - 0.2), Y(y1 - 0.4), (ww + 0.4) * sx, (y1 - y0 - 0.4 + 0.2) * sy);
      g.save(); g.translate(X(cx), Y(y1 - 0.4)); g.scale(sx, sy); g.fillStyle = '#d9be90'; g.beginPath(); g.moveTo(-ww / 2 - 0.2, 0); g.quadraticCurveTo(-ww / 2 - 0.2, -0.9, 0, -1.25); g.quadraticCurveTo(ww / 2 + 0.2, -0.9, ww / 2 + 0.2, 0); g.fill();
      g.fillStyle = '#6e5a3e'; g.beginPath(); g.moveTo(-ww / 2, 0.2); g.lineTo(-ww / 2, 0); g.quadraticCurveTo(-ww / 2, -0.7, 0, -1.0); g.quadraticCurveTo(ww / 2, -0.7, ww / 2, 0); g.lineTo(ww / 2, 0.2); g.fill(); g.restore();
      g.fillStyle = '#6e5a3e'; g.fillRect(X(cx - ww / 2), Y(y1 - 0.4), ww * sx, (y1 - y0 - 0.4) * sy);
    }
    R(a, 4.4, b, 4.7, '#c3a56f'); R(a, 9.1, b, 9.5, '#c3a56f');   // the string courses of the pier
  }
  for (const cx of CARCH) {   // the moulded ring round each arch and its radial joints
    g.save(); g.translate(X(cx), Y(CSP)); g.scale(sx, sy);
    g.fillStyle = '#dcc194'; g.beginPath(); g.arc(0, 0, CAR + 0.6, PI, 2 * PI); g.lineTo(CAR + 0.6, 0); g.lineTo(-CAR - 0.6, 0); g.fill();
    g.strokeStyle = 'rgba(70,52,30,0.6)'; g.lineWidth = 0.04; for (let a = PI + 0.12; a < 2 * PI; a += 0.2) { g.beginPath(); g.moveTo(Math.cos(a) * CAR, Math.sin(a) * CAR); g.lineTo(Math.cos(a) * (CAR + 0.6), Math.sin(a) * (CAR + 0.6)); g.stroke(); }
    g.beginPath(); g.arc(0, 0, CAR + 0.6, PI, 2 * PI); g.stroke(); g.restore();
  }
  for (const x of [-9.7, -5.3]) R(x - 0.13, CSP + 2.4, x + 0.13, 9.4, 'rgba(236,218,176,0.55)');   // the thin ribs over the columns
  const cx = -7.5;   // the plaque with its scrolled edge, the statue over it
  R(cx - 1.5, 7.6, cx + 1.5, 8.7, '#e0c89c'); R(cx - 1.35, 7.75, cx + 1.35, 8.55, '#c9ae7d'); g.fillStyle = 'rgba(70,52,30,0.55)'; for (let k = 0; k < 4; k++) g.fillRect(X(cx - 1.1), Y(8.35 - k * 0.2), 2.2 * sx, 1.4);
  for (const sg of [-1, 1]) { g.fillStyle = '#e0c89c'; g.beginPath(); g.arc(X(cx + sg * 1.55), Y(8.15), 0.3 * sx, 0, 2 * PI); g.fill(); }
  g.fillStyle = '#e8d8b6'; g.beginPath(); g.ellipse(X(cx), Y(9.5), 0.16 * sx, 0.12 * sy, 0, 0, 2 * PI); g.fill(); g.fillRect(X(cx - 0.18), Y(9.4), 0.36 * sx, 0.6 * sy);
  R(cx - 0.3, 9.0, cx + 0.3, 9.1, '#cdb386');
  R(-16.5, 9.4, 1.5, 9.5, 'rgba(40,28,14,0.5)'); R(-16.5, 9.5, 1.5, 9.75, '#d6bb8c');   // the cornice and the openwork frieze
  R(-16.5, 9.75, 1.5, 10.4, '#cfb384'); g.fillStyle = '#4a3b2a'; for (let x = -16.2; x < 1.5; x += 0.78) { g.beginPath(); g.ellipse(X(x + 0.3), Y(10.08), 0.19 * sx, 0.2 * sy, 0, 0, 2 * PI); g.fill(); g.fillRect(X(x), Y(9.95), 0.12 * sx, 0.18 * sy); }
  wear(g, w, h, CPW, CPAR, 9111, { dens: 14, streaks: 14, damp: 4 });
}
function paintCatBack(g, w, h) {   // A: the back wall of the loggia (13.2 x 6.8 m), top left; B: the plain wall right of the stair (15 x 14.8 m), right half
  const ha = Math.round(h * 150 / 384);
  g.save(); g.beginPath(); g.rect(0, 0, w / 2, ha); g.clip();
  { const p = mkp(g, w / 2, ha, 13.2, 6.8), { X, Y, sx, sy, R } = p;
    paintAshlar(g, w / 2, ha, 13.2, 6.8, 0.5, 1.2, '#c9a873', CJOINT, 9201, 1.2, 0.08);
    R(0, 0, 13.2, 0.45, '#a89068');
    for (const [dx, dw, dh, fh] of [[-4.4, 1.1, 2.4, 3.3], [0, 1.9, 3.3, 4.3], [4.4, 1.1, 2.4, 3.3]]) {
      const x = 6.6 + dx; R(x - dw / 2 - 0.3, 0.45, x + dw / 2 + 0.3, 0.45 + fh, '#e0c99c'); R(x - dw / 2, 0.45, x + dw / 2, 0.45 + dh, '#6a4630'); g.fillStyle = 'rgba(30,18,8,0.5)';
      for (let k = 0; k < 2; k++) for (let m = 0; m < 3; m++) g.fillRect(X(x - dw / 2 + 0.1 + m * dw / 3.1), Y(0.55 + dh * (k + 0.9) / 2), dw / 3.3 * sx, dh / 2.4 * sy);
      R(x - 0.03, 0.45, x + 0.03, 0.45 + dh, 'rgba(20,10,4,0.6)');
      R(x - dw / 2 - 0.5, 0.45 + fh, x + dw / 2 + 0.5, 0.45 + fh + 0.55, '#e6d3a8'); g.fillStyle = '#9d835a'; for (let m = 0; m < 6; m++) g.fillRect(X(x - dw / 2 - 0.35 + m * (dw + 0.7) / 6), Y(0.45 + fh + 0.4), (dw + 0.7) / 9 * sx, 0.25 * sy);   // the carved lintel
    }
  }
  g.restore();
  g.save(); g.beginPath(); g.rect(w / 2, 0, w / 2, h); g.clip(); g.translate(w / 2, 0);
  { const p = mkp(g, w / 2, h, 15, 14.8), { X, Y, sx, sy, R } = p;
    paintAshlar(g, w / 2, h, 15, 14.8, 0.62, 1.5, '#c9a974', CJOINT, 9301, 1.5, 0.09);
    R(0, 0, 15, 1.1, '#b59c70'); R(0, 13.4, 15, 14.0, '#c0a470'); R(0, 13.35, 15, 13.4, 'rgba(30,20,10,0.5)');
    const wx = 11.5; R(wx - 0.95, 4.2, wx + 0.95, 7.2, '#dcc49a'); R(wx - 0.7, 4.5, wx + 0.7, 6.9, '#1f1913'); g.fillStyle = '#3a342e'; for (let m = wx - 0.6; m < wx + 0.7; m += 0.2) g.fillRect(X(m), Y(6.9), 1.4, 2.4 * sy); for (let y = 4.7; y < 6.9; y += 0.3) g.fillRect(X(wx - 0.7), Y(y), 1.4 * sx, 1.4);
    R(wx - 1.1, 4.0, wx + 1.1, 4.2, '#d0b68a');
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(88,70,48,0.28)'; g.fillRect(X(0.5 + i * 2.3), Y(11 - i % 3 * 2), 1.4 * sx, 2.6 * sy); }   // the darker patches of the weathered tufa
    wear(g, w / 2, h, 15, 14.8, 9311, { dens: 12, streaks: 14, damp: 6 }); }
  g.restore();
}
function buildCatena() {
  initShared();
  const F0 = frameOf(CO, CN), W = F0.toWorld, pts = pairsOf(CAT.p), gr = groundRange(pts);
  const y0 = Math.min(groundY(...W(-8, 0)), groundY(...W(8, 0)), groundY(...W(0, 0))), lo = Math.min(gr.lo, y0) - 1.5;
  const F = frame(CO[0], y0, CO[1], CN[0], CN[1]), at = (x, y, z) => mul(F, tr(x, y, z)), FL = y0 + CFL;
  defMat('eCaStone', 256, 256, [3.2, 3.2], (g, w, h) => { paintAshlar(g, w, h, 3.2, 3.2, 0.5, 1.2, CGOLD, CJOINT, 9001, 1.4, 0.09); wear(g, w, h, 3.2, 3.2, 9002, { dens: 8, damp: 3, streaks: 4 }); });
  defMat('eCaFront', 384, 384, [CPW, CPAR], paintCatFront);
  defMat('eCaBack', 384, 384, [1, 1], paintCatBack);
  begin(y0);
  // the body behind and to the right: the footprint without the stair and the loggia, the tall plain wall by the stair
  const body = CLOC.map(q => W(q[0], q[1]));
  prism('eCaStone', body, lo, y0 + CTOP, { c: '#ffffff' });
  prism('flat', body, y0 + CTOP, y0 + CTOP + 0.12, { c: '#8d806c' });
  bx('eCaStone', F, 1.5, 16.5, CTOP, 14.8, -11, 0);
  panel('eCaBack', 15, 14.8, { M: at(9, 0, 0.04), uvk: [0.5, 1], uvo: [0.5, 0] });
  // the podium, the stair (12 steps) and the platform of the loggia
  bx('eCaStone', F, CX0, 1.5, -(y0 - lo), CFL, -11, -6);
  for (let i = 0; i < 12; i++) bx('eCaStone', F, CX0, 1.5, -(y0 - lo), CFL * (i + 1) / 12, -6, -0.5 * i, { c: '#d8c9a8' });
  for (const sg of [-1, 1]) { bx('eCaStone', F, sg < 0 ? CX0 - 0.4 : 1.5, sg < 0 ? CX0 : 1.9, -(y0 - lo), CFL + 0.6, -11, 0); }   // the cheek walls of the stair
  // the front of the loggia: a wall with three round arches, the arcs joined below the capitals
  const s = new THREE.Shape(); s.moveTo(CX0, 0); s.lineTo(-14.1, 0); s.lineTo(-14.1, CSP);
  for (const cx of CARCH) s.absarc(cx, CSP, CAR, PI, 0, true);
  s.lineTo(-0.9, 0); s.lineTo(1.5, 0); s.lineTo(1.5, CPAR); s.lineTo(CX0, CPAR); s.lineTo(CX0, 0);
  extrude('eCaFront', s, 0.8, { M: at(0, CFL, -6.8), uv: 'keep', uvk: [1 / CPW, 1 / CPAR], uvo: [-CX0 / CPW, 0], cs: 14, noao: true });
  // the end piers: towers with a pinnacle each, the walls closing the loggia at both ends
  for (const [a, b] of [[CX0, -14.1], [-0.9, 1.5]]) {
    bx('eCaStone', F, a, b, CFL, CFL + CPAR, -11, -6.8);
    bx('eCaStone', F, a, b, CFL + CPAR, CFL + 12.4, -9.2, -6.0);
    bx('flat', F, a - 0.15, b + 0.15, CFL + 12.4, CFL + 12.75, -9.35, -5.85, { c: '#c9ae7d', noao: true });
    bx('eCaStone', F, a + 0.2, b - 0.2, CFL + 12.75, CFL + 13.6, -9.0, -6.2, { c: '#e4cfa2' });
    for (const [dx, dz] of [[0.1, -6.3], [b - a - 0.4, -6.3], [0.1, -8.9], [b - a - 0.4, -8.9]]) bx('flat', F, a + dx, a + dx + 0.3, CFL + 13.6, CFL + 14.0, dz - 0.15, dz + 0.15, { c: '#c9ae7d', noao: true });
  }
  // inside: the ceiling, the back wall with its three portals
  bx('eCaStone', F, -14.1, -0.9, CFL + 6.9, CFL + CPAR, -11, -6.8, { c: '#d8c9a8' });
  panel('eCaBack', 13.2, 6.8, { M: at(-7.5, CFL, -10.96), uvk: [0.5, 150 / 384], uvo: [0, 1 - 150 / 384] });
  // the free columns with their capitals, a respond column at each end
  for (const x of [-9.7, -5.3]) {
    cyl('flat', 0.3, 0.36, CSP - 0.7, 12, { M: at(x, CFL + 0.35, -6.4), c: '#8e8c86' }); bx('flat', F, x - 0.5, x + 0.5, CFL, CFL + 0.35, -6.9, -5.9, { c: '#c4ab7c', noao: true });
    bx('flat', F, x - 0.55, x + 0.55, CFL + CSP - 0.35, CFL + CSP + 0.35, -6.95, -5.85, { c: '#d6c093', noao: true });
  }
  for (const x of [-13.8, -1.2]) cyl('flat', 0.2, 0.24, CSP - 0.5, 10, { M: at(x, CFL + 0.25, -6.9), c: '#8e8c86' });
  // the plain cap over the loggia and a rail round the stair
  bx('flat', F, CX0 - 0.1, 1.6, CFL + CPAR, CFL + CPAR + 0.25, -9.4, -5.9, { c: '#c9ae7d', noao: true });
  const o = end('Chiesa di Santa Maria della Catena');
  o.userData.solids = [[CAT.p, null, y0 + 14.8]];
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
const SPT1 = 8.5, SPW = 10.8;
function paintSpNave(g, w, h) {   // an inner face of the nave, 5 m bay x 10.8 m: a deep pointed chapel arch, a narrow lancet high up
  const p = mkp(g, w, h, 5, SPW), { X, Y, sx, sy, R } = p;
  paintAshlar(g, w, h, 5, SPW, 0.46, 1.1, '#b89d70', '#8b7552', 9601, 1.4, 0.1);
  for (const x of [0, 4.55]) R(x, 0, x + 0.45, SPW, 'rgba(226,204,160,0.3)');
  g.save(); g.translate(X(2.5), Y(4.2)); g.scale(sx, sy);
  g.fillStyle = '#d3b98c'; g.beginPath(); g.moveTo(-1.95, 4.2); g.lineTo(-1.95, 0); g.quadraticCurveTo(-1.95, -2.2, 0, -3.0); g.quadraticCurveTo(1.95, -2.2, 1.95, 0); g.lineTo(1.95, 4.2); g.fill();
  g.fillStyle = '#2a211a'; g.beginPath(); g.moveTo(-1.55, 4.2); g.lineTo(-1.55, 0); g.quadraticCurveTo(-1.55, -1.9, 0, -2.6); g.quadraticCurveTo(1.55, -1.9, 1.55, 0); g.lineTo(1.55, 4.2); g.fill();
  g.fillStyle = 'rgba(150,120,80,0.35)'; g.beginPath(); g.moveTo(-1.55, 4.2); g.lineTo(-1.55, 0); g.quadraticCurveTo(-1.55, -1.9, 0, -2.6); g.lineTo(0, 4.2); g.fill(); g.restore();
  g.save(); g.translate(X(2.5), Y(8.6)); g.scale(sx, sy);
  g.fillStyle = '#cfb58a'; g.beginPath(); g.moveTo(-0.62, 1.5); g.lineTo(-0.62, 0); g.quadraticCurveTo(-0.62, -0.8, 0, -1.2); g.quadraticCurveTo(0.62, -0.8, 0.62, 0); g.lineTo(0.62, 1.5); g.fill();
  g.fillStyle = '#8fa6b0'; g.beginPath(); g.moveTo(-0.34, 1.5); g.lineTo(-0.34, 0); g.quadraticCurveTo(-0.34, -0.6, 0, -0.9); g.quadraticCurveTo(0.34, -0.6, 0.34, 0); g.lineTo(0.34, 1.5); g.fill(); g.restore();
  R(0, 5.9, 5, 6.1, 'rgba(60,44,26,0.4)');
  wear(g, w, h, 5, SPW, 9611, { dens: 10, damp: 5, streaks: 8 });
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
function buildSpasimo() {
  initShared();
  const pts = pairsOf(SPA.p), holes = SPA.holes.map(pairsOf), gr = groundRange(pts), y0 = gr.avg, lo = Math.min(gr.lo, y0) - 1.5;
  defMat('eSpStone', 384, 384, [4, 4], (g, w, h) => { paintAshlar(g, w, h, 4, 4, 0.46, 1.1, '#b89d70', '#7f6a4a', 9801, 1.8, 0.12); wear(g, w, h, 4, 4, 9802, { dens: 6, damp: 4, streaks: 4 }); });
  defMat('eSpNave', 384, 384, [5, SPW], paintSpNave);
  defMat('eSpOuter', 384, 384, [4.5, SPT1], paintSpOuter);
  begin(y0);
  prism('eSpStone', pts, lo, y0 + SPT1, { holes });
  prism('flat', pts, y0 + SPT1, y0 + SPT1 + 0.14, { holes, c: '#7e7567' });
  const edges = edgesOf(pts, holes), r = RNG(9811);
  for (const e of edges.filter(q => !q.hole)) {
    if (e.l < 3) continue;
    bays('eSpOuter', e, y0, SPT1, 4.5);
    rim(e, y0 + SPT1 - 0.5, 0.6, '#a98b5e');
  }
  for (const e of edges.filter(q => q.hole)) {   // the nave walls: painted inner face, then the broken crest of blocks above
    bays('eSpNave', e, y0, SPW, 5, { off: 0.05 });
    const F = frame(e.mx, y0, e.mz, e.nx, e.nz), n = Math.max(2, Math.round(e.l / 1.9)), sl = e.l / n, short = e.l < 15;
    bx('eSpStone', F, -e.l / 2, e.l / 2, SPT1, SPW, -1.7, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, tri = 1 - Math.abs(t - 0.5) * 2, hgt = short ? SPW + 0.8 + tri * 3.8 + r() * 0.5 : SPW + 0.3 + r() * 3.2 - (i % 4 === 2 ? 1.4 : 0);   // the short ends climb to a stepped gable
      bx('eSpStone', F, -e.l / 2 + i * sl, -e.l / 2 + (i + 1) * sl, SPW, Math.min(hgt, 15.6), -1.7, 0, { c: i % 3 ? '#ffffff' : '#e6dcc8' });
    }
  }
  const o = end('Santa Maria dello Spasimo');
  o.userData.solids = [[SPA.p, SPA.holes, y0 + SPT1 + 0.2]];
  return o;
}
export const SPASIMO = { name: 'Santa Maria dello Spasimo', x: 920, z: 170, radius: 40, skipIds: [SPA.id], build: buildSpasimo };

export const BATCH_E = [STERI_LM, CATENA, CASTELLO, SPASIMO];
