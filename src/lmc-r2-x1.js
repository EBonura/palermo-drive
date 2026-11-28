// Round 2 landmarks, batch X1: Stand Florio, the Nautoscopio, the Loggiato di San Bartolomeo, the Palchetto della Musica at the Foro Italico and the Arsenale della Real Marina.
// Registered through src/lmc-r2.js. Photos were only looked at, nothing is copied. Frame F per place: origin on the ground in front of the named face, +z out of that face, local x to the right seen from outside.
// Sizes along the walls come from the footprint; heights were read from the photos against the footprint widths, so treat them as good to about half a metre to a metre.
//
// Stand Florio (w49706766), Via Messina Marine at Romagnolo. Commons "Stand Florio.jpg" (2019, from the south east), "Stand Florio 1.jpg" (2018, the inner front); Mapillary 1074686153057597,
//  492811588721137, 242035887679408, 298183538458515, 2058791810928072 (April 2021, from the road to the west); SITR 2013 orthophoto for the plan. Read: a white Moorish pavilion with a south front of three
//  bays under dark hoods, a pointed blind arch with a roundel, pierced lattice parapets with ball finials, stepped merlons, an octagonal drum and a red scaled dome with a finial; a round turret on the east side;
//  behind it a three storey white block with green window frames, a deep bracketed eave and a hipped tile roof; a horseshoe arch gate in the white boundary wall on the road side.
//  Not verified: the exact place of the gate along the boundary wall (read from two street frames and the orthophoto), the east face behind the turret, how the polygonal bay of the inner front sits on the
//  plan (here the north east corner, inside the footprint), the garden walls (the map's own walls are left as they are).
//
// Loggiato di San Bartolomeo (w977504738), Via della Cala by Porta Felice, front to the sea. Commons "Loggiato di S. Bartolomeo.jpg" (2009), "Loggiato San Bartolomeo.jpg",
//  "Palermo, Italy - panoramio (6).jpg" (2014). Read: a sandstone loggia of seven arches over seven smaller ones, glazed behind, half columns, bands with raised panels, a balustrade with urns,
//  set in a plain white wall with three small square windows low down. Not verified: the white building's other sides, the roof, the carving in detail. The planting in front is not drawn.
//
// Palchetto della Musica, Foro Italico (w233807186). Commons "Kalsa, Palermo, Italy - panoramio (16).jpg" (2014); Mapillary 537737944105770, 666563680985848 (September 2021), 731607497508604,
//  200965911640094 (2018). Read: a cream plinth with an iron railing, an open colonnade of pale Ionic columns (nine along the road side, four across each end, three each side of a middle room on the
//  piazza side), a door in the room reached by flights along that side, an entablature with a dentilled cornice, a stepped attic, an eagle at each corner.
//  Not verified: the south flight (taken as the mirror of the north one), the sculpture on the attic, the ceiling, the inside of the room's other walls.
//
// Nautoscopio (OSM way 583791575, no building), between the Cala and the Foro Italico. Commons "Nautoscopio - Palermo" in "Palermo, Italy - panoramio (5).jpg" (2014), "Nautoscopio.jpg" (2009);
//  Mapillary 154920733192770, 2999624326949061 (April 2021). Read: a tall steel mast with a spike, a triangular timber hull hung on it well above the ground, two long yards with dark blades reaching out
//  to the east, stays from the mast head. Heights are estimates from those views (about 22 m of mast under the spike). Not verified: the base, the inside of the hull, the exact bearing of the yards.
//
// Arsenale della Real Marina (w184347059), Via dell'Arsenale, front to the south. Commons "Arsenale Palermo.jpg" (2018); the photos on balarm.it (the place page and the 2024 news on the restoration),
//  livesicilia.it (2017) and an elevated view among them. Read: a sandstone ground storey with a portal in a blind arch at each end and four great arches filled with dark plaster, three barred windows in
//  each, scrolls at the crowns; a ledge with an iron rail; a pale upper storey with stone strips and one framed window to a bay; the royal eagle, inscription and two shields in the middle; a cornice
//  and a tiled hipped roof. Not verified: the east portal (taken as the twin of the west one), the doors in the arch fills, the ends and the north side (plain), the bay widths (fitted from one oblique view).
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, extrude, part, prism, lathe, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, panel, RNG } from './lmc-kit.js';
import { TREE_CLEAR } from './tree-clear.js';

// ---- shared helpers
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
// the frame of a place: origin O on the ground, outward normal N
function site(O, N, probe = [[0, 0.6]]) {
  const W = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const y0 = Math.min(...probe.map(q => groundY(...W(...q))));
  const F = frame(O[0], y0, O[1], N[0], N[1]);
  return { W, y0, F, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
// painter for one region r = [px, py, pw, ph, Wm, Hm] of a canvas: metres, x centred, y up from the bottom of the region
function region(g, r, draw) {
  const [px, py, pw, ph, Wm, Hm] = r, sx = pw / Wm, sy = ph / Hm, X = x => (x + Wm / 2) * sx, Y = y => ph - y * sy;
  g.save(); g.translate(px, py); g.beginPath(); g.rect(0, 0, pw, ph); g.clip();
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, ww, c, pt = 0) => { const rr = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - rr), Y(y0)); g.lineTo(X(x - rr), Y(y1 - rr)); if (pt) { g.quadraticCurveTo(X(x - rr), Y(y1 - rr * 0.15), X(x), Y(y1 + pt)); g.quadraticCurveTo(X(x + rr), Y(y1 - rr * 0.15), X(x + rr), Y(y1 - rr)); } else g.ellipse(X(x), Y(y1 - rr), rr * sx, rr * sy, 0, PI, 0); g.lineTo(X(x + rr), Y(y0)); g.closePath(); g.fill(); };
  const circ = (x, y, rr, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rr * sx, rr * sy, 0, 0, 2 * PI); g.fill(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  draw({ R, poly, arch, circ, line, X, Y, sx, sy, Wm, Hm, pw, ph });
  g.restore();
}
// a flat textured face: the outline p (metres, in the frame M) at depth z, showing region r of a cw x ch canvas at the same metres, shifted by (ox, oy)
function face(key, [cw, ch], r, M, p, z, ox = 0, oy = 0, holes = []) {
  const [px, py, pw, ph, Wm, Hm] = r, ku = pw / Wm / cw, kv = ph / Hm / ch;
  const s = shapeOf(p); for (const h of holes) s.holes.push(new THREE.Path(h.map(q => new THREE.Vector2(q[0], q[1]))));
  part(key, new THREE.ShapeGeometry(s), { M, p: [0, 0, z], uv: 'keep', uvk: [ku, kv], uvo: [(px + pw / 2) / cw + ox * ku, 1 - (py + ph) / ch + oy * kv], noao: true });
}
const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// loose triangles (points in the frame M, anticlockwise seen from the side that shows)
function tris(key, M, T, c) {
  const pos = []; for (const t of T) for (const p of t) pos.push(p[0], p[1], p[2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); g.computeVertexNormals();
  part(key, g, { M, c, noao: true });
}
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
// a hipped roof over x0..x1, z0..z1 from height y, ridge along x
function hip(M, x0, x1, z0, z1, y, rise, c, key = 'tile') {
  const zm = (z0 + z1) / 2, run = (z1 - z0) / 2, a = [x0, y, z1], b = [x1, y, z1], cc = [x1, y, z0], d = [x0, y, z0], r0 = [x0 + run, y + rise, zm], r1 = [x1 - run, y + rise, zm];
  tris(key, M, [...quad(a, b, r1, r0), ...quad(cc, d, r0, r1), [b, cc, r1], [d, a, r0]], c);
}
const OCTA = new THREE.OctahedronGeometry(1);
const ball = (M, x, y, z, r, c) => part('flat', OCTA, { M, p: [x, y + r, z], s: [r, r * 1.2, r], ry: PI / 4, c, noao: true });
// wall collision for a box round the line a-b (world points), half width h
const wallBox = (a, b, h = 0.3) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, ox = -dz / l * h, oz = dx / l * h, P = [[a[0] + ox, a[1] + oz], [b[0] + ox, b[1] + oz], [b[0] - ox, b[1] - oz], [a[0] - ox, a[1] - oz]]; return P.map((p, i) => [...p, ...P[(i + 1) % 4]]); };
const ringWalls = (P) => P.map((p, i) => [...p, ...P[(i + 1) % P.length]]);

// =====================================================================================================
// Stand Florio
// =====================================================================================================
const ST = { id: 'w49706766', p: [1876.9, 936.6, 1880.3, 925.6, 1892.8, 929.3, 1889.4, 940.3] };
const ST_O = [1883.15, 938.45], ST_N = [-0.284, 0.959];
const STW = '#ebe6da', STWOOD = '#3a2c24', STTEAL = '#2f5f57';
const ST_CV = [512, 384];
const stR = {
  S: [0, 0, 260, 180, 13, 9],          // the south front
  N: [260, 0, 252, 210, 13, 10.8],     // the inner (north) front
  W: [0, 214, 230, 170, 11.5, 8.5],    // the west and east sides of the block
  L: [260, 214, 252, 40, 13, 1.1],     // the pierced parapet
  D: [260, 262, 128, 96, 6, 4],        // dome scales
};
function stPaint(g, w, h) {
  g.fillStyle = STW; g.fillRect(0, 0, w, h);
  const glass = '#2e4a58', frameG = '#2d5a50';
  region(g, stR.S, ({ R, arch, circ, line }) => {
    R(-6.5, 0, 6.5, 9, STW); R(-6.5, 0, 6.5, 1.15, '#8d867a'); for (let y = 0.2; y < 1.1; y += 0.28) R(-6.5, y, 6.5, y + 0.04, '#6c655b');
    for (const x of [-4.4, 4.4]) { R(x - 0.85, 0.75, x + 0.85, 4.35, '#d8d2c4'); R(x - 0.62, 0.9, x + 0.62, 4.15, glass); R(x - 0.04, 0.9, x + 0.04, 4.15, '#1f343c'); R(x - 0.62, 3.2, x + 0.62, 3.3, '#1f343c'); }
    arch(0, 1.15, 5.9, 3.3, '#c9c2b2', 0.75); arch(0, 1.15, 5.75, 2.95, '#e4ded0', 0.68);
    R(-1.75, 4.35, -1.35, 4.65, '#c9c2b2'); R(1.35, 4.35, 1.75, 4.65, '#c9c2b2');
    circ(0, 5.35, 0.62, '#8a8274'); circ(0, 5.35, 0.48, '#4d4a42'); for (let i = 0; i < 6; i++) circ(Math.cos(i * PI / 3) * 0.27, 5.35 + Math.sin(i * PI / 3) * 0.27, 0.09, '#a59c8a');
    R(-0.8, 0.3, 0.8, 4.3, '#c9c2b2'); R(-0.62, 0.3, 0.62, 4.12, '#22292c'); R(-0.03, 0.3, 0.03, 4.12, '#45524f');
    for (const y of [6.3, 7.65]) { R(-6.5, y, 6.5, y + 0.12, '#d3ccbd'); R(-6.5, y - 0.07, 6.5, y, 'rgba(90,75,55,0.22)'); }
  });
  region(g, stR.N, ({ R, line }) => {
    R(-6.5, 0, 6.5, 10.8, STW); R(-6.5, 0, 6.5, 0.7, '#a59e92');
    const win = (x0, x1, y0, y1, n, tr_) => { R(x0 - 0.1, y0 - 0.08, x1 + 0.1, y1 + 0.1, frameG); R(x0, y0, x1, y1, glass); R(x0, y0 + (y1 - y0) * 0.5, x1, y1, 'rgba(170,200,215,0.18)'); for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n; R(x - 0.05, y0, x + 0.05, y1, frameG); } for (const f of tr_) R(x0, y0 + (y1 - y0) * f - 0.05, x1, y0 + (y1 - y0) * f + 0.05, frameG); };
    // the main block: x -4.35..6.5, seen from the north (the polygonal bay takes the east end, on the left)
    for (const [x0, x1, n] of [[-4.1, -1.85, 3], [-1.25, 2.85, 6], [3.45, 5.75, 3]]) { win(x0, x1, 0.7, 6.4, n, [0.28, 0.5, 0.75]); win(x0, x1, 8.2, 9.7, n * 2, [0.7]); R(x0 - 0.1, 7.4, x1 + 0.1, 8.15, '#20463e'); for (let x = x0; x < x1; x += 0.35) { line(x, 7.45, Math.min(x1, x + 0.35), 8.1, 0.05, '#3f6e63'); line(Math.min(x1, x + 0.35), 7.45, x, 8.1, 0.05, '#3f6e63'); } }
    R(-4.35, 6.9, 6.5, 7.12, '#4a3a30');
  });
  region(g, stR.W, ({ R }) => {
    R(-5.75, 0, 5.75, 8.5, STW);
    // (of this region the block uses the part from 6.4 up, the pavilion's side the part below)
    R(-2.7, 7.2, 2.7, 8.4, '#27463f'); R(-2.6, 7.28, 2.6, 8.32, '#22313a'); for (let x = -2.6; x <= 2.6; x += 0.743) R(x - 0.04, 7.2, x + 0.04, 8.4, '#2d5a50'); R(-2.6, 7.95, 2.6, 8.0, '#2d5a50');
    for (const x of [-1.2, 0.2]) { R(x, 1.9, x + 0.85, 3.1, '#d0c9ba'); R(x + 0.1, 2.0, x + 0.75, 3.0, '#232b2e'); }
    R(-5.75, 0, 5.75, 0.8, '#b3ac9f');
  });
  region(g, stR.L, ({ R, line }) => {
    R(-6.5, 0, 6.5, 1.1, STW); R(-6.5, 0.14, 6.5, 0.9, '#8f887b');
    for (let x = -6.8; x < 6.8; x += 0.3) { line(x, 0.14, x + 0.76, 0.9, 0.075, STW); line(x + 0.76, 0.14, x, 0.9, 0.075, STW); }
    for (let x = -6.5; x < 6.6; x += 1.3) R(x - 0.1, 0, x + 0.1, 1.1, STW);
    R(-6.5, 0, 6.5, 0.14, '#ded7c8'); R(-6.5, 0.92, 6.5, 1.1, '#f2eee4');
  });
  region(g, stR.D, ({ R, circ, Wm, Hm }) => {
    R(-3, 0, 3, 4, '#8f4431'); const r = RNG(4411);
    for (let j = 15; j >= 0; j--) for (let i = 0; i <= 18; i++) { const x = -3 + i * (6 / 18) + (j % 2) * (3 / 18), y = j * 0.25 + 0.16; circ(x, y, 0.18, '#6e2f22'); circ(x, y + 0.045, 0.165, `hsl(${12 + r() * 6},${44 + r() * 8}%,${40 + r() * 9}%)`); }
  });
  g.save(); g.globalAlpha = 0.5; streaks(g, 512, 214, 26, 4402, 0.1, 40, '90,75,55'); g.restore();
}
// a hood over a window: a tiled lean-to slab on two teal struts
function hood(M, x, y, w, z = 0) {
  box('flat', w + 0.7, 0.14, 1.0, { M, p: [x, y - 0.1, z + 0.42], rx: 0.36, c: '#7e4a38', noao: true });
  box('flat', w + 0.66, 0.1, 0.95, { M, p: [x, y - 0.2, z + 0.4], rx: 0.36, c: STWOOD, noao: true });
  for (const s of [-1, 1]) { box('flat', 0.09, 0.95, 0.09, { M, p: [x + s * (w / 2 + 0.1), y - 0.95, z + 0.06], rx: 0.72, c: STTEAL, noao: true }); bx('flat', M, x + s * (w / 2 + 0.1) - 0.05, x + s * (w / 2 + 0.1) + 0.05, y - 1.0, y - 0.3, z - 0.02, z + 0.08, { c: STTEAL, noao: true }); }
}
// a pierced parapet along the frame M (local x from x0 to x1, facing +z at z = 0), posts and ball finials
function lattice(M, x0, x1, y, o = {}) {
  bx('flat', M, x0, x1, y, y + 1.05, -0.16, -0.01, { c: '#d9d3c6', noao: true });
  face('x1Stand', ST_CV, stR.L, mul(M, tr((x0 + x1) / 2, y, 0)), rectP(-(x1 - x0) / 2, 0, (x1 - x0) / 2, 1.1), 0);
  for (const x of o.posts || [x0 + 0.14, x1 - 0.14]) { bx('flat', M, x - 0.14, x + 0.14, y, y + 1.32, -0.2, 0.06, { c: STW, noao: true }); ball(M, x, y + 1.3, -0.07, 0.17, '#f1ede3'); }
}
// a row of stepped merlons along x0..x1 on height y (two flat faces, back to back)
function merlons(M, x0, x1, y, z = 0, c = STW, step = 0.72) {
  const n = Math.max(1, Math.round((x1 - x0) / step)), d = (x1 - x0) / n, p = [[x0, y - 0.2], [x1, y - 0.2], [x1, y]];
  for (let i = n - 1; i >= 0; i--) { const a = x0 + i * d; p.push([a + d * 0.9, y], [a + d * 0.72, y + 0.3], [a + d * 0.5, y + 0.6], [a + d * 0.28, y + 0.3], [a + d * 0.1, y]); }
  p.push([x0, y]);
  const g = new THREE.ShapeGeometry(shapeOf(p));
  part('flat', g, { M, p: [0, 0, z], c, noao: true }); part('flat', g, { M: mul(M, tr(x0 + x1, 0, z - 0.05)), s: [-1, 1, -1], c, noao: true });
}
// the boundary wall on the road side with the horseshoe gate, in world terms: from A (the pavilion's south west corner) north west along the road
const ST_A = [1876.9, 936.6], ST_U = [-0.55, -0.835], ST_GATE = 11.0, ST_END = 16.2;
const stAlong = (t) => [ST_A[0] + ST_U[0] * t, ST_A[1] + ST_U[1] * t];
function stGate() {
  const [gx, gz] = stAlong(ST_GATE), y = groundY(gx, gz), G = frame(gx, y, gz, -0.835, 0.55);   // local +x towards the pavilion
  const R = 1.95, r = 1.35, cy = 2.95, a0 = -0.62, p = [[-R, 0]];
  p.push([-R, cy - 0.3]);
  for (let i = 0; i <= 12; i++) { const a = PI + 0.12 - (PI + 0.24) * i / 12; p.push([Math.cos(a) * R, cy + Math.sin(a) * R]); }
  p.push([R, cy - 0.3], [R, 0], [r - 0.12, 0], [r - 0.12, cy - 1.15]);
  for (let i = 0; i <= 12; i++) { const a = a0 + (PI - 2 * a0) * i / 12; p.push([Math.cos(a) * r, cy + Math.sin(a) * r]); }
  p.push([-r + 0.12, cy - 1.15], [-r + 0.12, 0]);
  extrude('flat', shapeOf(p), 0.5, { M: G, p: [0, 0, -0.25], c: '#e9e0cb', noao: true });
  // the iron leaves
  for (let x = -1.1; x <= 1.12; x += 0.22) bx('flat', G, x - 0.025, x + 0.025, 0.05, 2.35 - Math.abs(x) * 0.2, -0.04, 0.02, { c: '#26282a', noao: true });
  for (const yy of [0.3, 1.9]) bx('flat', G, -1.2, 1.2, yy, yy + 0.08, -0.05, 0.03, { c: '#26282a', noao: true });
  // the wall on both sides, its piers with ball finials
  for (const [x0, x1] of [[-(ST_END - ST_GATE), -R], [R, ST_GATE - 0.1]]) {
    bx('flat', G, x0, x1, -0.8, 1.75, -0.18, 0.18, { c: '#e6ddc8' }); bx('flat', G, x0, x1, 1.75, 1.9, -0.24, 0.24, { c: '#efe9da', noao: true });
    const n = Math.max(1, Math.round((x1 - x0) / 3.4));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; bx('flat', G, x - 0.28, x + 0.28, -0.8, 2.2, -0.28, 0.28, { c: '#e9e1cd' }); bx('flat', G, x - 0.34, x + 0.34, 2.2, 2.32, -0.34, 0.34, { c: '#efe9da', noao: true }); ball(G, x, 2.32, 0, 0.24, '#c9a982'); }
  }
}
function buildStand() {
  initShared();
  const S = site(ST_O, ST_N, [[-6, 0.5], [0, 0.5], [6, 0.5]]), { F, y0, at } = S, pts = pairsOf(ST.p), lo = Math.min(groundRange(pts).lo, y0) - 1.2;
  defMat('x1Stand', ST_CV[0], ST_CV[1], [1, 1], stPaint);
  begin(y0);
  const sideM = (x, z, a) => mul(F, mul(tr(x, 0, z), new THREE.Matrix4().makeRotationY(a)));
  const W = sideM(-6.5, 0, -PI / 2), E = sideM(6.5, 0, PI / 2), Nf = sideM(0, -11.5, PI);
  // the pavilion (z -4.4..0) and the block behind it (z -11.5..-5.2), the link between them
  bx('flat', F, -6.48, 6.48, lo - y0, 6.4, -5.3, -0.04, { c: '#d9d3c6' });
  bx('flat', F, -6.48, 5.4, lo - y0, 10.2, -11.46, -5.24, { c: '#d9d3c6' });
  bx('flat', F, 5.4, 6.48, lo - y0, 6.8, -11.46, -7.6, { c: '#d9d3c6' });
  // south front: side bays, the taller middle bay a step forward
  face('x1Stand', ST_CV, stR.S, F, rectP(-6.5, 0, -2.4, 6.4), 0); face('x1Stand', ST_CV, stR.S, F, rectP(2.4, 0, 6.5, 6.4), 0);
  bx('flat', F, -2.38, 2.38, 0, 7.8, -0.5, 0.22, { c: '#ded8ca' });
  face('x1Stand', ST_CV, stR.S, F, rectP(-2.4, 0, 2.4, 7.8), 0.23);
  hood(F, -4.4, 5.05, 1.4); hood(F, 4.4, 5.05, 1.4); hood(F, 0, 7.45, 2.9, 0.22);
  lattice(F, -6.5, -2.42, 6.4, { posts: [-6.36, -4.4] }); lattice(F, 2.42, 6.5, 6.4, { posts: [4.4, 6.36] });
  merlons(F, -2.4, 2.4, 7.95, 0.24); for (const x of [-2.4, 2.4]) { bx('flat', F, x - 0.16, x + 0.16, 6.4, 8.75, -0.08, 0.26, { c: STW, noao: true }); ball(F, x, 8.75, 0.09, 0.2, '#f1ede3'); }
  // the pavilion's sides: plaster with the two low windows, lattice on top; the drain pipe
  face('x1Stand', ST_CV, stR.W, W, rectP(-5.24, 0, 0, 6.4), 0.02, 2.6);
  face('x1Stand', ST_CV, stR.S, E, rectP(0, 0, 4.6, 6.4), 0.02, 1.6);
  lattice(W, -5.2, -0.05, 6.4); lattice(E, 0.05, 4.4, 6.4);
  bx('flat', W, -3.82, -3.7, 0.6, 6.1, 0, 0.14, { c: '#39352f', noao: true }); bx('flat', E, 3.08, 3.2, 1.8, 6.2, 0, 0.14, { c: '#39352f', noao: true });
  // drum, merlons and the dome
  const DZ = -2.75;
  cyl('flat', 2.55, 2.6, 3.4, 8, { M: F, p: [0, 6.3, DZ], t0: PI / 8, c: '#e6e0d2', noao: true });
  for (let k = 0; k < 8; k++) { const M = mul(at(0, 0, DZ), new THREE.Matrix4().makeRotationY(k * PI / 4)); const hw = 2.55 * Math.sin(PI / 8); merlons(M, -hw, hw, 9.75, 2.55 * Math.cos(PI / 8) + 0.06, STW, 0.95); bx('flat', M, -hw - 0.05, hw + 0.05, 8.7, 8.84, 2.25, 2.5, { c: '#d3ccbd', noao: true }); }
  { const [px, py, pw, ph] = stR.D, prof = [[2.28, 0], [2.4, 0.4], [2.33, 0.95], [2.0, 1.55], [1.45, 2.05], [0.75, 2.36], [0.06, 2.48]];
    lathe('x1Stand', prof, 16, { M: F, p: [0, 9.65, DZ], uv: 'keep', uvk: [pw / ST_CV[0], ph / ST_CV[1]], uvo: [px / ST_CV[0], 1 - (py + ph) / ST_CV[1]], noao: true }); }
  cyl('flat', 0.05, 0.09, 1.25, 5, { M: F, p: [0, 12.05, DZ], c: '#b06a50', noao: true });
  for (const [y, r] of [[12.12, 0.24], [12.55, 0.17], [12.9, 0.11]]) ball(F, 0, y, DZ, r, '#e8e0cc');
  // the round turret on the east side, with its own lattice
  { const tx = 5.0, tz = -5.9, r = 1.55;
    cyl('flat', r, r, 6.2, 12, { M: F, p: [tx, 0, tz], c: '#e6e0d2' });
    cyl('flat', r + 0.12, r + 0.12, 0.16, 12, { M: F, p: [tx, 6.15, tz], c: '#d3ccbd', noao: true });
    for (let k = 0; k < 5; k++) { const a = -PI / 6 + k * PI / 4.2, M = mul(at(tx, 0, tz), new THREE.Matrix4().makeRotationY(a)); lattice(mul(M, tr(0, 0, r + 0.04)), -0.6, 0.6, 6.3, { posts: k % 2 ? [] : [0] }); } }
  // the block: its sides and inner front, the deep eave on brackets, the hipped roof
  face('x1Stand', ST_CV, stR.W, W, rectP(-11.5, 6.4, -5.26, 10.2), 0.03, 8.4);
  face('x1Stand', ST_CV, stR.W, W, rectP(-11.5, 0, -5.26, 6.4), 0.02, 8.4);
  bx('flat', W, -11.45, -5.3, 6.45, 7.15, 0.02, 0.12, { c: '#e9e4d8', noao: true });
  face('x1Stand', ST_CV, stR.L, mul(W, tr(-8.4, 6.4, 0)), rectP(-3.05, 0, 3.05, 0.75), 0.13);
  const EB = sideM(5.4, 0, PI / 2);   // the block's east face, x = distance north
  face('x1Stand', ST_CV, stR.W, EB, rectP(5.3, 6.4, 11.5, 10.2), 0.02, -8.3, 0);
  bx('flat', EB, 6.6, 11.2, 6.75, 6.85, 0, 0.5, { c: '#8a8276', noao: true }); for (let x = 6.65; x < 11.2; x += 0.42) bx('flat', EB, x - 0.025, x + 0.025, 6.85, 7.8, 0.44, 0.49, { c: '#26282a', noao: true }); bx('flat', EB, 6.6, 11.2, 7.8, 7.86, 0.42, 0.5, { c: '#26282a', noao: true });
  face('x1Stand', ST_CV, stR.N, Nf, rectP(-4.35, 0, 6.5, 10.2), 0.02);
  // the polygonal bay at the north east corner, two storeys with its own little eave
  { const bay = [[-6.5, -0.35], [-5.9, 0.28], [-4.9, 0.28], [-4.35, -0.35]];
    for (let i = 0; i < 3; i++) {
      const a = bay[i], b = bay[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), M = mul(Nf, mul(tr((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2), new THREE.Matrix4().makeRotationY(Math.atan2(-dz, dx))));
      bx('flat', M, -l / 2, l / 2, 0, 7.5, -0.25, 0, { c: STW });
      for (const [y0w, y1w] of [[0.9, 3.9], [5.0, 6.8]]) { bx('flat', M, -l / 2 + 0.1, l / 2 - 0.1, y0w - 0.08, y1w + 0.08, 0, 0.03, { c: STTEAL, noao: true }); bx('flat', M, -l / 2 + 0.18, l / 2 - 0.18, y0w, y1w, 0.02, 0.05, { c: '#2e4a58', noao: true }); bx('flat', M, -0.03, 0.03, y0w, y1w, 0.04, 0.07, { c: STTEAL, noao: true }); }
      bx('flat', M, -l / 2 - 0.12, l / 2 + 0.12, 7.5, 7.66, -0.3, 0.42, { c: STWOOD, noao: true });
    } }
  // eave: a dark soffit slab, brackets, the roof
  bx('flat', F, -7.3, 6.2, 10.18, 10.36, -12.3, -4.45, { c: STWOOD, noao: true });
  for (const x of [-5.8, -4.2, -2.6, -1.0, 0.6, 2.2, 3.8, 5.0]) for (const [z, s] of [[-5.24, 1], [-11.46, -1]]) box('flat', 0.12, 0.14, 0.85, { M: F, p: [x, 9.9, z + s * 0.34], rx: -s * 0.42, c: STWOOD, noao: true });
  for (const z of [-10.6, -9.2, -7.8, -6.4]) for (const [x, s] of [[-6.48, -1], [5.4, 1]]) box('flat', 0.85, 0.14, 0.12, { M: F, p: [x + s * 0.34, 9.9, z], rz: s * 0.42, c: STWOOD, noao: true });
  hip(F, -7.3, 6.2, -12.3, -4.45, 10.36, 1.55, '#e0a080');
  stGate();
  const o = end('Stand Florio');
  o.userData.solids = [[ST.p, null, y0 + 6.4]];
  return o;
}


// =====================================================================================================
// Loggiato di San Bartolomeo
// =====================================================================================================
const LG = { id: 'w977504738', p: [826.6, -465.2, 834.9, -469.0, 848.4, -440.2, 833.9, -433.5, 830.2, -440.1, 831.9, -440.9, 827.8, -447.8, 834.0, -450.6] };
const LG_O = [841.65, -454.6], LG_N = [0.9055, -0.4244];
const LGW = 31.8, LGS = 13.75, LGB = 3.73, LGWHITE = '#e8e6e0', LGST = '#bea07c', LGLT = '#d2b995', LGDK = '#8a6c50';
const LG_CV = [512, 256], lgR = [0, 0, 512, 256, 27.5, 13.0];   // the stone front from 8.4 m up
const LGLOW = { w: 2.75, y0: 9.5, y1: 13.35 }, LGUP = { w: 2.15, y0: 15.75, y1: 18.35 }, LGY = 8.4;
function lgPaint(g, w, h) {
  g.clearRect(0, 0, w, h);
  region(g, lgR, ({ R, arch, circ, line }) => {
    const Y = y => y - LGY, B = (x0, y0, x1, y1, c) => R(x0, Y(y0), x1, Y(y1), c), r = RNG(5521);
    B(-LGS, LGY, LGS, 19.75, LGST);
    // courses of weathered sandstone
    for (let y = LGY; y < 19.7; y += 0.34) for (let x = -LGS; x < LGS;) { const l = 0.5 + r() * 1.1; B(x, y, x + l - 0.05, y + 0.3, `hsl(${29 + r() * 7},${28 + r() * 12}%,${50 + r() * 17}%)`); x += l; }
    // the bands: the base with its panels, the frieze between the two orders, the entablature
    for (const [y0, y1] of [[8.4, 9.45], [13.65, 15.7], [18.8, 19.75]]) {
      B(-LGS, y0, LGS, y0 + 0.16, LGLT); B(-LGS, y0 - 0.08, LGS, y0, 'rgba(60,38,20,0.4)'); B(-LGS, y1 - 0.18, LGS, y1, LGLT); B(-LGS, y1 - 0.3, LGS, y1 - 0.18, 'rgba(60,38,20,0.38)');
      for (let i = -3; i <= 3; i++) { const x = i * LGB; B(x - 1.25, y0 + 0.28, x + 1.25, y1 - 0.42, LGDK); B(x - 1.15, y0 + 0.36, x + 1.15, y1 - 0.5, '#c3a784'); B(x - 0.5, (y0 + y1) / 2 - 0.17, x + 0.5, (y0 + y1) / 2 + 0.04, 'rgba(110,80,52,0.5)'); }
    }
    for (const o of [LGLOW, LGUP]) for (let i = -3; i <= 3; i++) {
      const x = i * LGB;
      arch(x, Y(o.y0), Y(o.y1 + 0.36), o.w + 0.72, LGDK); arch(x, Y(o.y0), Y(o.y1 + 0.29), o.w + 0.58, LGLT); arch(x, Y(o.y0), Y(o.y1 + 0.08), o.w + 0.16, '#9a7a5a');
      B(x - 0.14, o.y1 + 0.05, x + 0.14, o.y1 + 0.45, LGLT);
      for (const s of [-1, 1]) { circ(x + s * (o.w / 2 + 0.32), Y(o.y1 - 0.05), 0.16, '#a88a66'); B(x + s * (o.w / 2 + 0.22) - 0.22, o.y1 - o.w / 2 - 0.12, x + s * (o.w / 2 + 0.22) + 0.22, o.y1 - o.w / 2 + 0.06, LGLT); }
    }
    for (let i = 0; i <= 7; i++) { const x = (i - 3.5) * LGB; for (const [y0, y1] of [[9.45, 13.65], [15.7, 18.8]]) { B(x - 0.24, y0, x + 0.24, y1, '#c9ae8a'); B(x - 0.04, y0 + 0.3, x + 0.04, y1 - 0.5, 'rgba(90,62,40,0.45)'); B(x + 0.24, y0, x + 0.32, y1, 'rgba(60,38,20,0.4)'); B(x - 0.34, y1 - 0.42, x + 0.34, y1 - 0.18, '#dcc7a6'); circ(x - 0.24, Y(y1 - 0.36), 0.1, LGDK); circ(x + 0.24, Y(y1 - 0.36), 0.1, LGDK); } }
    // the balustrade, open between the balusters
    B(-LGS, 19.75, LGS, 19.98, LGLT); B(-LGS, 20.68, LGS, 20.9, LGLT);
    for (let x = -LGS + 0.12; x < LGS; x += 0.36) { B(x, 19.98, x + 0.15, 20.68, '#cbb08c'); B(x - 0.04, 20.1, x + 0.19, 20.36, '#cbb08c'); }
  });
  g.save(); g.globalCompositeOperation = 'source-atop'; streaks(g, w, h, 70, 5522, 0.2, 40, '70,48,30'); noiseDots(g, w, h, 2200, 1.8, 5523, ['rgba(70,45,25,0.22)', 'rgba(255,235,200,0.14)']); g.restore();
}
// the arched outline of an opening, anticlockwise
const archPts = (x, y0, y1, w, n = 8) => { const r = w / 2, o = [[x - r, y0], [x + r, y0]]; for (let i = 0; i <= n; i++) { const a = PI * i / n; o.push([x + r * Math.cos(a), y1 - r + r * Math.sin(a)]); } return o; };
// the sides of an opening, from z0 (front) back to z1
function reveal(M, o, z0, z1, c) { const T = []; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; T.push(...quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1])); } tris('flat', M, T, c); }
// a footprint (world points) kept behind z = zmax of a frame (origin O, normal N), as world points
function behind(pts, O, N, zmax) {
  const loc = pts.map(p => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; }), out = [];
  for (let i = 0; i < loc.length; i++) { const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
  return out.map(([x, z]) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]]);
}
function buildLoggiato() {
  initShared();
  const S = site(LG_O, LG_N, [[-14, 1], [0, 1], [14, 1]]), { F, y0 } = S, pts = pairsOf(LG.p), lo = Math.min(groundRange(pts).lo, y0) - 1.2;
  defMat('x1Logg', LG_CV[0], LG_CV[1], [1, 1], lgPaint, { alphaTest: 0.5, side: THREE.DoubleSide });
  begin(y0);
  const body = behind(pts, LG_O, LG_N, -0.75);
  prism('flat', body, lo, y0 + 19.7, { c: '#dedbd4' });
  prism('flat', body, y0 + 19.7, y0 + 19.82, { c: '#a39e95', noao: true });
  const H = LGW / 2;
  // the white plaster round the loggia: the side strips, the lower wall with its three small windows
  for (const s of [-1, 1]) bx('flat', F, s * LGS, s * H, lo - y0, 20.35, -0.74, 0.02, { c: LGWHITE });
  bx('flat', F, -LGS, LGS, lo - y0, LGY, -0.74, 0.02, { c: LGWHITE });
  for (const x of [-2 * LGB, 0, 2 * LGB]) { bx('flat', F, x - 0.95, x + 0.95, 4.35, 6.2, 0, 0.05, { c: '#8d8a84', noao: true }); bx('flat', F, x - 0.85, x + 0.85, 4.42, 6.12, 0.02, 0.07, { c: '#33414a', noao: true }); }
  // the stone front: pierced by the two orders of arches, the glazing set back behind them
  const holes = [];
  for (const o of [LGLOW, LGUP]) for (let i = -3; i <= 3; i++) holes.push(archPts(i * LGB, o.y0, o.y1, o.w));
  face('x1Logg', LG_CV, lgR, mul(F, tr(0, LGY, 0)), rectP(-LGS, 0, LGS, 19.75 - LGY), 0.06, 0, 0, holes.map(h => h.map(q => [q[0], q[1] - LGY])));
  for (const h of holes) reveal(F, h, 0.06, -0.55, '#a5876a');
  for (const o of [LGLOW, LGUP]) {
    tris('flat', F, quad([-LGS, o.y0 - 0.1, -0.55], [LGS, o.y0 - 0.1, -0.55], [LGS, o.y1 + 0.1, -0.55], [-LGS, o.y1 + 0.1, -0.55]), '#5d7286');
    for (let i = -3; i <= 3; i++) { const x = i * LGB; bx('flat', F, x - o.w / 2, x + o.w / 2, o.y0 + 0.75, o.y0 + 0.81, -0.55, -0.5, { c: '#c9d2d8', noao: true }); bx('flat', F, x - o.w * 0.36, x + o.w * 0.2, o.y1 - 0.85, o.y1 - 0.79, -0.55, -0.52, { c: '#e8edf0', noao: true }); }
  }
  // the balustrade with its posts and urns
  face('x1Logg', LG_CV, lgR, mul(F, tr(0, LGY, 0)), rectP(-LGS, 19.75 - LGY, LGS, 20.92 - LGY), 0.04);
  for (let i = 0; i <= 14; i++) { const x = -LGS + 0.22 + i * (2 * LGS - 0.44) / 14, big = !(i % 2); bx('flat', F, x - 0.2, x + 0.2, 19.75, 20.98, -0.2, 0.2, { c: LGST, noao: true }); ball(F, x, 20.96, 0, big ? 0.27 : 0.2, LGLT); }
  // ledges and the half columns that stand out from the front
  for (const [y, hh, d] of [[8.4, 0.2, 0.3], [9.3, 0.2, 0.26], [13.65, 0.22, 0.32], [15.5, 0.2, 0.28], [18.8, 0.18, 0.24], [19.55, 0.26, 0.42]]) bx('flat', F, -LGS - 0.08, LGS + 0.08, y, y + hh, 0, d, { c: LGLT, noao: true });
  for (let i = 0; i <= 7; i++) { const x = clampX((i - 3.5) * LGB, LGS - 0.22);
    for (const [ya, yb] of [[9.5, 13.65], [15.7, 18.8]]) { bx('flat', F, x - 0.17, x + 0.17, ya, yb - 0.35, 0.02, 0.22, { c: '#c2a582', noao: true }); bx('flat', F, x - 0.3, x + 0.3, yb - 0.38, yb - 0.14, 0.02, 0.3, { c: LGLT, noao: true }); }
    bx('flat', F, x - 0.34, x + 0.34, 8.55, 9.3, 0.02, 0.22, { c: LGST, noao: true }); }
  const o = end('Loggiato di San Bartolomeo');
  o.userData.solids = [[LG.p, null, y0 + 19.7]];
  return o;
}
const clampX = (x, m) => Math.max(-m, Math.min(m, x));

// =====================================================================================================
// Palchetto della Musica, Foro Italico
// =====================================================================================================
const PM = { id: 'w233807186', p: [1020.2, -191.5, 1025.1, -195.0, 1035.0, -181.7, 1030.1, -178.1] };
const PM_O = [1027.6, -186.57], PM_N = [-0.804, 0.594];   // out of the south west side; local x towards the south east end
const PMU = 8.3, PMD = 3.0, PMST = 1.15, PMCREAM = '#d9c39c', PMLT = '#e6d5b2', PMGREY = '#cfccc2';
function eagle(M, y, s = 1) {   // the eagle with raised wings, looking along +x
  const c = '#e4dfd2';
  bx('flat', M, -0.34 * s, 0.34 * s, y, y + 0.2 * s, -0.3 * s, 0.3 * s, { c: '#cdbf9f', noao: true });
  box('flat', 0.5 * s, 0.62 * s, 0.4 * s, { M, p: [0, y + 0.22 * s, 0], rz: -0.35, c, noao: true });
  sphere('flat', 0.15 * s, { M, p: [0.28 * s, y + 0.92 * s, 0], seg: 6, c, noao: true });
  box('flat', 0.18 * s, 0.07 * s, 0.1 * s, { M, p: [0.45 * s, y + 0.86 * s, 0], c: '#bdb29a', noao: true });
  for (const d of [-1, 1]) {
    const z = d * 0.2 * s, a = [0.12 * s, y + 0.72 * s, z], b = [-0.4 * s, y + 1.35 * s, z + d * 0.62 * s], cc = [-0.72 * s, y + 0.62 * s, z + d * 0.4 * s], e = [-0.2 * s, y + 0.3 * s, z];
    tris('flat', M, [[a, b, cc], [a, cc, e], [a, cc, b], [a, e, cc]], c);
  }
}
function buildPalchetto() {
  initShared();
  const S = site(PM_O, PM_N, [[-7, 4.6], [0, 4.6], [7, 4.6], [0, -3.6]]), { F, y0, at } = S, pts = pairsOf(PM.p), lo = Math.min(groundRange(pts).lo, y0) - 1;
  begin(y0);
  const H = 1.9, CT = 6.45;
  // the plinth with its grey foot and the ledge at the top
  bx('flat', F, -PMU, PMU, lo - y0, H - 0.12, -PMD, PMD, { c: PMCREAM });
  bx('flat', F, -PMU - 0.12, PMU + 0.12, lo - y0, 0.34, -PMD - 0.12, PMD + 0.12, { c: '#a8a398' });
  bx('flat', F, -PMU - 0.14, PMU + 0.14, H - 0.12, H + 0.04, -PMD - 0.14, PMD + 0.14, { c: PMLT, noao: true });
  // the columns: nine along the north east side, four across each end, three each side of the middle room on the south west side
  const cols = [], du = (2 * PMU - 0.7) / 8, zc = PMD - 0.35, uc = PMU - 0.35;
  for (let i = 0; i < 9; i++) cols.push([-uc + i * du, -zc]);
  for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) cols.push([s * (uc - i * du), zc]); for (const z of [-zc / 3, zc / 3]) cols.push([s * uc, z]); }
  for (const [x, z] of cols) {
    bx('flat', F, x - 0.34, x + 0.34, H + 0.04, H + 0.46, z - 0.34, z + 0.34, { c: PMGREY, noao: true });
    cyl('flat', 0.22, 0.28, CT - H - 0.72, 8, { M: F, p: [x, H + 0.46, z], open: true, c: PMGREY, noao: true });
    bx('flat', F, x - 0.38, x + 0.38, CT - 0.26, CT, z - 0.28, z + 0.28, { c: '#dedacd', noao: true });
  }
  // the room in the middle of the south west side, its door, the two square pilasters at its corners
  bx('flat', F, -2.75, 2.75, H, CT, -0.7, PMD - 0.28, { c: PMCREAM });
  for (const s of [-1, 1]) { bx('flat', F, s * 2.75 - 0.27, s * 2.75 + 0.27, H, CT - 0.2, PMD - 0.62, PMD - 0.08, { c: PMGREY, noao: true }); bx('flat', F, s * 2.75 - 0.36, s * 2.75 + 0.36, CT - 0.22, CT, PMD - 0.68, PMD - 0.02, { c: '#dedacd', noao: true }); }
  const DZ = PMD - 0.28;
  bx('flat', F, -0.82, 0.82, H, H + 2.65, DZ, DZ + 0.07, { c: '#b09a74', noao: true });
  bx('flat', F, -0.56, 0.56, H, H + 2.35, DZ + 0.03, DZ + 0.1, { c: '#4a3a2c', noao: true }); bx('flat', F, -0.02, 0.02, H, H + 2.35, DZ + 0.06, DZ + 0.12, { c: '#2a2018', noao: true });
  bx('flat', F, -1.02, 1.02, H + 2.75, H + 2.95, DZ, DZ + 0.26, { c: PMLT, noao: true });
  cyl('flat', 0.24, 0.24, 0.05, 10, { M: F, p: [1.7, H + 1.5, DZ], rx: PI / 2, c: '#5a2a30', noao: true });
  // railings on the edge of the plinth
  const RY = H + 0.04;
  panel('rail', 2 * PMU, 0.95, { M: at(0, RY, -PMD + 0.04), ry: PI, uvk: [2 * PMU * 1.6, 1], c: '#9a9aa0' });
  for (const s of [-1, 1]) { panel('rail', 2 * PMD, 0.95, { M: at(s * (PMU - 0.04), RY, 0), ry: s * PI / 2, uvk: [2 * PMD * 1.6, 1], c: '#9a9aa0' });
    const a = 2.95, b = PMU - 0.04; panel('rail', b - a, 0.95, { M: at(s * (a + b) / 2, RY, PMD - 0.04), uvk: [(b - a) * 1.6, 1], c: '#9a9aa0' }); }
  // the entablature, the cornice, the attic with its raised blocks, the dark ceiling
  bx('flat', F, -PMU + 0.06, PMU - 0.06, CT, CT + 0.34, -PMD + 0.06, PMD - 0.06, { c: PMCREAM, noao: true });
  bx('flat', F, -PMU + 0.5, PMU - 0.5, CT - 0.03, CT, -PMD + 0.5, PMD - 0.5, { c: '#4e4032', noao: true });
  bx('flat', F, -PMU + 0.02, PMU - 0.02, CT + 0.34, CT + 0.42, -PMD + 0.02, PMD - 0.02, { c: PMLT, noao: true });
  bx('flat', F, -PMU + 0.1, PMU - 0.1, CT + 0.42, CT + 0.85, -PMD + 0.1, PMD - 0.1, { c: '#d3bb92', noao: true });
  bx('flat', F, -PMU - 0.14, PMU + 0.14, CT + 0.85, CT + 0.98, -PMD - 0.14, PMD + 0.14, { c: PMLT, noao: true });
  bx('flat', F, -PMU - 0.3, PMU + 0.3, CT + 0.98, CT + 1.16, -PMD - 0.3, PMD + 0.3, { c: '#dcc8a2', noao: true });
  { const n = 36, d = (2 * PMU + 0.1) / n, y = CT + 0.86, p = [[PMU + 0.05, y], [-PMU - 0.05, y]];   // the dentils, one toothed strip on each long side
    for (let i = 0; i < n; i++) { const a = -PMU - 0.05 + i * d; p.push([a, y - 0.17], [a + d * 0.55, y - 0.17], [a + d * 0.55, y - 0.04], [a + d, y - 0.04]); }
    const g = new THREE.ShapeGeometry(shapeOf(p));
    part('flat', g, { M: F, p: [0, 0, PMD + 0.02], c: PMLT, noao: true }); part('flat', g, { M: F, p: [0, 0, -PMD - 0.02], ry: PI, c: PMLT, noao: true }); }
  const AY = CT + 1.16;
  bx('flat', F, -PMU + 0.15, PMU - 0.15, AY, AY + 0.5, -PMD + 0.15, PMD - 0.15, { c: '#cbb48c', noao: true });
  for (const [x, z, w] of [[0, -PMD + 0.35, 1.5], [-1.9, PMD - 0.35, 0.65], [1.9, PMD - 0.35, 0.65]]) { bx('flat', F, x - w, x + w, AY + 0.5, AY + 0.92, z - 0.22, z + 0.22, { c: '#d3bd96', noao: true }); }
  sphere('flat', 0.42, { M: F, p: [0, AY + 1.05, -PMD + 0.35], kz: 0.4, seg: 8, c: '#c9b492', noao: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) eagle(mul(at(sx * (PMU - 0.5), 0, sz * (PMD - 0.5)), new THREE.Matrix4().makeRotationY(sx > 0 ? 0 : PI)), AY + 0.5);
  // the two flights up to the door, along the south west side, with their sloping side walls
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) { const x0 = 1.25 + i * 0.5, top = H - (i + 1) * H / 10; bx('flat', F, s * x0, s * (x0 + 0.5), lo - y0, top, PMD, PMD + PMST - 0.18, { c: i % 2 ? '#b9b2a2' : '#c6bfae', noao: true }); }
    const p = [[s * 1.25, -0.8], [s * 6.0, -0.8], [s * 6.0, 0.55], [s * 1.25, H + 0.4]]; if (s < 0) p.reverse();
    extrude('flat', shapeOf(p), 0.2, { M: F, p: [0, 0, PMD + PMST - 0.18], c: PMCREAM });
  }
  bx('flat', F, -1.25, 1.25, lo - y0, H, PMD, PMD + PMST, { c: PMCREAM });
  const o = end('Palchetto della Musica al Foro Italico');
  o.userData.solids = [[PM.p, null, y0 + H]];
  return o;
}
const pmStairs = () => { const W = (x, z) => [PM_O[0] + x * PM_N[1] + z * PM_N[0], PM_O[1] - x * PM_N[0] + z * PM_N[1]], a = PMD, b = PMD + PMST + 0.05, P = [W(-6.05, a), W(-6.05, b), W(6.05, b), W(6.05, a)]; return P.slice(1).map((q, i) => [...P[i], ...q]); };

// =====================================================================================================
// Nautoscopio (Giuseppe Amato)
// =====================================================================================================
const NT_O = [904.5, -526.5], NT_N = [0.31, 0.95];   // local x towards the sea end of the yards
// a straight round member from a to b in the frame M
function beam(M, a, b, r, c, seg = 4) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const T = new THREE.Matrix4().compose(new THREE.Vector3(...a), q, new THREE.Vector3(1, 1, 1));
  cyl('flat', r, r, l, seg, { M: mul(M, T), open: true, c, noao: true });
}
function buildNautoscopio() {
  initShared();
  const S = site(NT_O, NT_N, [[0, 0]]), { F, y0 } = S;
  begin(y0);
  const MAST = '#5a5b5e', WIRE = '#4a4a4e';
  cyl('flat', 0.55, 0.65, 1.5, 10, { M: F, p: [0, -1, 0], c: '#8a867c' });
  cyl('flat', 0.17, 0.34, 22, 8, { M: F, p: [0, 0, 0], open: true, c: MAST, noao: true });
  cyl('flat', 0.42, 0.28, 0.75, 8, { M: F, p: [0, 21.6, 0], c: '#2e2e32', noao: true });
  cyl('flat', 0.04, 0.12, 3.6, 5, { M: F, p: [0, 22.3, 0], c: MAST, noao: true });
  beam(F, [0, 20.4, -1.3], [0, 20.4, 1.3], 0.07, MAST);
  // the timber hull: broad and blunt at the mast's landward end, narrowing towards the yards; planked in two browns
  const lt = [-4.5, 9.7], lb = [-3.1, 6.1], rt = [3.7, 7.9], rb = [2.4, 6.0], wl = 1.5, wr = 0.3, wlb = 0.75;
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  for (let i = 0; i < 6; i++) {
    const k0 = i / 6, k1 = (i + 1) / 6, c = ['#8a5230', '#6e3f26'][i % 2];
    for (const s of [-1, 1]) {
      const A = mix(lb, lt, k0), B = mix(rb, rt, k0), C = mix(rb, rt, k1), D = mix(lb, lt, k1), za = s * (wlb + (wl - wlb) * k0), zd = s * (wlb + (wl - wlb) * k1);
      const q = [[A[0], A[1], za], [B[0], B[1], s * wr], [C[0], C[1], s * wr], [D[0], D[1], zd]];
      tris('flat', F, s > 0 ? quad(q[0], q[1], q[2], q[3]) : quad(q[1], q[0], q[3], q[2]), c);
    }
  }
  tris('flat', F, quad([lb[0], lb[1], -wlb], [lb[0], lb[1], wlb], [lt[0], lt[1], wl], [lt[0], lt[1], -wl]), '#5c3520');
  tris('flat', F, quad([rb[0], rb[1], wr], [rb[0], rb[1], -wr], [rt[0], rt[1], -wr], [rt[0], rt[1], wr]), '#5c3520');
  tris('flat', F, quad([lt[0], lt[1], wl], [rt[0], rt[1], wr], [rt[0], rt[1], -wr], [lt[0], lt[1], -wl]), '#a56a40');
  tris('flat', F, quad([lb[0], lb[1], -wlb], [rb[0], rb[1], -wr], [rb[0], rb[1], wr], [lb[0], lb[1], wlb]), '#4e2c1a');
  beam(F, [lt[0], lt[1] + 0.06, wl], [rt[0], rt[1] + 0.06, wr], 0.07, '#3a261a'); beam(F, [lt[0], lt[1] + 0.06, -wl], [rt[0], rt[1] + 0.06, -wr], 0.07, '#3a261a');
  // the two long yards with their blades, and the stays from the mast head
  const YU = [17.5, 4.7, 0.2], YL = [11.0, 4.0, -0.35];
  beam(F, [3.0, 7.5, 0.1], YU, 0.09, '#3c3c40', 6); beam(F, [2.2, 6.4, -0.15], YL, 0.08, '#3c3c40', 6);
  for (const [a, b] of [[[3.0, 7.5, 0.1], YU], [[2.2, 6.4, -0.15], YL]]) { const mx = a[0] + (b[0] - a[0]) * 0.78, my = a[1] + (b[1] - a[1]) * 0.78, mz = a[2] + (b[2] - a[2]) * 0.78; box('flat', 3.4, 0.34, 0.1, { M: F, p: [mx, my - 0.17, mz], rz: Math.atan2(b[1] - a[1], b[0] - a[0]), c: '#26262a', noao: true }); }
  for (const e of [YU, YL, [lt[0], lt[1], wl], [lt[0], lt[1], -wl]]) beam(F, [0, 21.5, 0], e, 0.03, WIRE, 3);
  for (const s of [-1, 1]) beam(F, [0, 20.4, s * 1.3], [s * 0.2, 9.0, s * 1.0], 0.025, WIRE, 3);
  return end('Nautoscopio');
}


// =====================================================================================================
// Arsenale della Real Marina
// =====================================================================================================
const AR = { id: 'w184347059', p: [484.2, -2306.5, 552.7, -2333.1, 558.0, -2320.1, 489.4, -2292.1] };
const AR_O = [523.7, -2306.05], AR_N = [0.378, 0.926];
const ARHW = 37, ARLO = 11.3, ARTOP = 17.9, ARBAY = 13.1, ARPORT = 10.8, ARST = '#b6946c', ARPL = '#e6dcc4', ARLT = '#cbac82', ARDK = '#7e603f';
const AR_CV = [512, 256];
const arR = { A: [0, 0, 272, 256, ARBAY, 18.4], P: [272, 0, 224, 256, ARPORT, 18.4] };
const ARCH = { r: 4.75, ring: 1.05, spring: 4.5 }, PORT = { r: 3.1, spring: 5.3 };
function arPaint(g, w, h) {
  g.fillStyle = ARST; g.fillRect(0, 0, w, h);
  const bay = (r, seed, draw) => region(g, r, (q) => {
    const { R, Wm } = q, hw = Wm / 2, rr = RNG(seed);
    R(-hw, 0, hw, 18.4, ARST);
    for (let y = 0; y < ARLO; y += 0.55) for (let x = -hw - rr(); x < hw;) { const l = 0.8 + rr() * 1.4; R(x, y, x + l - 0.07, y + 0.5, `hsl(${27 + rr() * 8},${27 + rr() * 12}%,${44 + rr() * 17}%)`); x += l; }
    // the upper storey: plaster between stone strips, the cornices, the balcony
    R(-hw, 11.55, hw, 16.9, ARPL); R(-hw, 16.9, hw, 18.4, ARLT); R(-hw, 17.35, hw, 17.5, ARDK); R(-hw, 16.82, hw, 16.95, ARDK);
    for (const s of [-1, 1]) { R(s * hw - 0.62, 11.55, s * hw + 0.62, 16.9, ARLT); R(s * hw - 0.68, 11.55, s * hw - 0.6, 16.9, 'rgba(80,55,32,0.45)'); R(s * hw + 0.6, 11.55, s * hw + 0.68, 16.9, 'rgba(80,55,32,0.45)'); }
    R(-hw, 10.85, hw, 11.55, ARLT); R(-hw, 10.7, hw, 10.85, 'rgba(60,40,22,0.5)');
    draw(q, hw);
    for (let x = -hw + 0.1; x < hw; x += 0.42) R(x, 11.55, x + 0.1, 12.7, '#3a332b'); R(-hw, 12.62, hw, 12.76, '#3a332b');
  });
  const upper = ({ R, poly }) => {
    R(-1.55, 11.9, 1.55, 16.1, ARLT); R(-1.8, 16.1, 1.8, 16.36, '#d6bb93'); R(-1.8, 15.98, 1.8, 16.1, 'rgba(60,40,22,0.45)'); R(-1.2, 12.1, 1.2, 15.55, ARDK);
    R(-0.95, 12.1, 0.95, 15.35, '#2c2b28'); for (let x = -0.8; x < 0.9; x += 0.32) R(x, 12.1, x + 0.07, 15.35, '#6d675c'); for (let y = 12.4; y < 15.3; y += 0.36) R(-0.95, y, 0.95, y + 0.06, '#6d675c');
    poly([[-0.8, 15.66], [0.8, 15.66], [0, 15.95]], ARDK);
  };
  bay(arR.A, 6611, (q) => {
    const { R, arch, line } = q, { r, ring: t, spring: sp } = ARCH;
    upper(q);
    arch(0, 0, sp + r + t, 2 * (r + t), '#c3a278');
    for (let i = 0; i <= 18; i++) { const a = PI * i / 18; line(Math.cos(a) * r, sp + Math.sin(a) * r, Math.cos(a) * (r + t), sp + Math.sin(a) * (r + t), 0.08, '#6f5236'); }
    for (let y = 0.6; y < sp; y += 0.6) { R(-r - t, y, -r, y + 0.07, '#6f5236'); R(r, y, r + t, y + 0.07, '#6f5236'); }
    arch(0, 0, sp + r + 0.1, 2 * r + 0.2, '#4c3c2c'); arch(0, 0, sp + r - 0.05, 2 * r - 0.1, '#6a5443');
    const rr = RNG(6612); for (let i = 0; i < 90; i++) { const x = (rr() - 0.5) * 2 * (r - 0.8), y = rr() * 7.2, k = rr(); R(x, y, x + 0.3 + rr() * 1.1, y + 0.2 + rr() * 0.6, k < 0.5 ? 'rgba(40,28,20,0.2)' : 'rgba(150,126,102,0.14)'); }
    for (const x of [-2.0, 0, 2.0]) { R(x - 0.85, 4.35, x + 0.85, 7.85, '#a08a6c'); R(x - 0.7, 4.5, x + 0.7, 7.7, '#232a2a'); for (let k = x - 0.7; k < x + 0.7; k += 0.35) R(k, 4.5, k + 0.07, 7.7, '#8b8f84'); for (let y = 4.9; y < 7.6; y += 0.5) R(x - 0.7, y, x + 0.7, y + 0.07, '#8b8f84'); }
    R(-r + 0.1, 0, r - 0.1, 0.7, 'rgba(225,220,208,0.35)');
    R(1.6, 0, 2.9, 2.3, '#2a201a');
    for (const s of [-1, 1]) { R(s * 6.55 - 0.75, sp - 0.15, s * 6.55 + 0.75, sp + 0.35, '#d1b38a'); R(s * 6.55 - 0.65, sp - 0.35, s * 6.55 + 0.65, sp - 0.15, ARDK); }
  });
  bay(arR.P, 6621, (q) => {
    const { R, arch } = q, { r, spring: sp } = PORT;
    upper(q);
    arch(0, 0, sp + r + 0.55, 2 * r + 1.1, '#d0b188'); arch(0, 0, sp + r + 0.16, 2 * r + 0.32, ARDK); arch(0, 0, sp + r, 2 * r, '#ab8b66');
    R(-2.05, 0, 2.05, 5.55, ARLT); R(-2.4, 5.55, 2.4, 5.9, '#d8bd96'); R(-2.4, 5.4, 2.4, 5.55, ARDK);
    R(-1.45, 0, 1.45, 5.0, '#5a3a26'); R(-0.04, 0, 0.04, 5.0, '#26170e'); for (const s of [-1, 1]) for (let y = 0.35; y < 4.5; y += 1.15) { R(s * 0.72 - 0.52, y, s * 0.72 + 0.52, y + 0.9, '#6d4830'); R(s * 0.72 - 0.34, y + 0.16, s * 0.72 + 0.34, y + 0.74, '#53341f'); }
  });
  g.save(); streaks(g, w, h, 90, 6631, 0.2, 46, '50,34,20'); noiseDots(g, w, h, 2600, 1.8, 6632, ['rgba(60,40,22,0.2)', 'rgba(255,235,200,0.12)']);
  const gr = g.createLinearGradient(0, h, 0, h * 0.8); gr.addColorStop(0, 'rgba(30,20,12,0.4)'); gr.addColorStop(1, 'rgba(30,20,12,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.8, w, h * 0.2); g.restore();
}
// the royal arms: the eagle with open wings over its shield and the inscription, a smaller shield on each side
function arms(F) {
  const W = '#e6e2d8', S = '#cfc9bb';
  const wing = [[0.3, 15.7], [0.9, 16.5], [1.8, 17.05], [2.55, 17.75], [2.4, 16.9], [2.15, 16.8], [2.15, 16.2], [1.75, 16.2], [1.65, 15.65], [1.2, 15.75], [1.0, 15.2], [0.35, 15.0]];
  for (const s of [-1, 1]) extrude('flat', shapeOf(s > 0 ? wing : wing.map(q => [-q[0], q[1]]).reverse()), 0.22, { M: F, p: [0, 0, 0.05], c: W, noao: true });
  bx('flat', F, -0.22, 0.22, 16.1, 17.25, 0.05, 0.4, { c: W, noao: true }); sphere('flat', 0.24, { M: F, p: [-0.08, 17.45, 0.3], seg: 6, c: W, noao: true }); bx('flat', F, -0.5, -0.24, 17.38, 17.5, 0.25, 0.38, { c: S, noao: true });
  extrude('flat', shapeOf([[-0.75, 16.15], [-0.8, 14.7], [-0.45, 14.15], [0, 13.95], [0.45, 14.15], [0.8, 14.7], [0.75, 16.15]]), 0.36, { M: F, p: [0, 0, 0.05], c: S, noao: true });
  bx('flat', F, -0.42, 0.42, 14.55, 15.6, 0.36, 0.45, { c: W, noao: true }); bx('flat', F, -0.56, 0.56, 16.12, 16.34, 0.3, 0.5, { c: W, noao: true });
  bx('flat', F, -1.25, 1.25, 13.55, 14.0, 0.05, 0.32, { c: S, noao: true });
  bx('flat', F, -1.0, 1.0, 12.15, 13.55, 0.05, 0.24, { c: W, noao: true }); for (let y = 12.35; y < 13.45; y += 0.2) bx('flat', F, -0.82, 0.82, y, y + 0.06, 0.23, 0.26, { c: '#6a655a', noao: true });
  bx('flat', F, -0.9, 0.9, 11.75, 12.15, 0.05, 0.28, { c: S, noao: true });
  for (const x of [-2.9, 2.9]) { extrude('flat', shapeOf([[x - 0.6, 15.55], [x - 0.65, 14.65], [x - 0.3, 14.15], [x, 14.0], [x + 0.3, 14.15], [x + 0.65, 14.65], [x + 0.6, 15.55]]), 0.2, { M: F, p: [0, 0, 0.03], c: W, noao: true }); bx('flat', F, x - 0.4, x + 0.4, 15.55, 15.95, 0.03, 0.22, { c: S, noao: true }); bx('flat', F, x - 0.3, x + 0.3, 14.45, 15.25, 0.2, 0.28, { c: S, noao: true }); }
}
function buildArsenale() {
  initShared();
  const S = site(AR_O, AR_N, [[-30, 1], [-10, 1], [10, 1], [30, 1]]), { F, y0 } = S, pts = pairsOf(AR.p), lo = Math.min(groundRange(pts).lo, y0) - 1.2;
  defMat('x1Ars', AR_CV[0], AR_CV[1], [1, 1], arPaint);
  begin(y0);
  const body = behind(pts, AR_O, AR_N, -0.2);
  prism('flat', body, lo, y0 + ARLO, { c: '#a68866' });
  prism('flat', body, y0 + ARLO, y0 + ARTOP, { c: '#d9cdb2', noao: true });
  // the front: two portal bays and four great arches between them
  const bays = [[arR.P, -ARHW + ARPORT / 2, ARPORT]]; for (const i of [-1.5, -0.5, 0.5, 1.5]) bays.push([arR.A, i * ARBAY, ARBAY]); bays.push([arR.P, ARHW - ARPORT / 2, ARPORT]);
  for (const [r, x, wd] of bays) {
    face('x1Ars', AR_CV, r, mul(F, tr(x, 0, 0)), rectP(-wd / 2, 0, wd / 2, ARTOP), 0);
    const arch = r === arR.A, top = arch ? ARCH.spring + ARCH.r + ARCH.ring : PORT.spring + PORT.r + 0.55;
    // the ring of the arch standing out, its scroll at the crown, the cornices of the upper window
    const rad = arch ? ARCH.r + ARCH.ring * 0.5 : PORT.r + 0.3, sp = arch ? ARCH.spring : PORT.spring, n = arch ? 12 : 8;
    for (let i = 0; i < n; i++) { const a = PI * (i + 0.5) / n; box('flat', rad * PI / n + 0.06, arch ? 0.34 : 0.22, 0.2, { M: F, p: [x + Math.cos(a) * (rad + (arch ? 0.4 : 0.14)), sp + Math.sin(a) * (rad + (arch ? 0.4 : 0.14)) - (arch ? 0.17 : 0.11), 0.06], rz: a - PI / 2, c: '#bd9c72', noao: true }); }
    bx('flat', F, x - 0.28, x + 0.28, top - 0.55, top + 0.45, 0, 0.42, { c: '#c4a67e', noao: true }); cyl('flat', 0.24, 0.24, 0.66, 8, { M: F, p: [x + 0.33, top + 0.25, 0.4], rz: PI / 2, c: '#cbae86', noao: true });
    bx('flat', F, x - 1.8, x + 1.8, 16.1, 16.36, 0, 0.34, { c: '#d2b58c', noao: true });
    if (!arch) bx('flat', F, x - 2.4, x + 2.4, 5.55, 5.88, 0, 0.4, { c: '#d2b58c', noao: true });
  }
  // the piers' capitals, the strips of the upper storey and the long ledges (the balcony rail is painted)
  for (const x of [-ARHW + 0.4, -ARHW + ARPORT, -ARBAY, 0, ARBAY, ARHW - ARPORT, ARHW - 0.4]) { bx('flat', F, x - 0.8, x + 0.8, ARCH.spring - 0.1, ARCH.spring + 0.38, 0, 0.26, { c: '#cdb088', noao: true }); bx('flat', F, x - 0.55, x + 0.55, 8.9, 10.8, 0, 0.14, { c: '#b99870', noao: true }); bx('flat', F, x - 0.5, x + 0.5, 11.55, 16.85, 0, 0.12, { c: '#c3a47a', noao: true }); }
  bx('flat', F, -ARHW - 0.25, ARHW + 0.25, 11.0, 11.5, -0.2, 0.62, { c: '#c6a87e', noao: true });
  bx('flat', F, -ARHW - 0.3, ARHW + 0.3, 17.6, ARTOP + 0.12, -0.2, 0.55, { c: '#c9ab82', noao: true });
  arms(F);
  // the tiled hip roof
  // the ledges carried round the two ends
  for (const x of [-ARHW, ARHW - 0.45]) for (const [y0e, y1e] of [[11.05, 11.45], [17.65, ARTOP + 0.1]]) bx('flat', F, x - 0.22, x + 0.22, y0e, y1e, -13.8, -0.1, { c: '#bea078', noao: true });
  hip(F, -ARHW - 0.5, ARHW + 0.2, -14.6, 0.6, ARTOP + 0.1, 3.5, '#b4f0f0');   // (the tint takes the red out of the shared tiles: the photos show old grey brown ones)
  const o = end('Arsenale della Real Marina');
  o.userData.solids = [[AR.p, null, y0 + ARTOP]];
  return o;
}

// Generic trees kept off ground the photos show open or planted low: the garden before the Loggiato, the yard of the Nautoscopio, the pavement round the Palchetto.
TREE_CLEAR.push([848.9, -458, 9], [852.2, -448.5, 7], [843.8, -466.6, 7], [869.8, -460.7, 3], [906, -518, 16], [908, -492, 18], [PM_O[0], PM_O[1], 11.5], [1034.9, -173.3, 6], [1022, -182.4, 5]);

export const R2_X1 = [
  { name: 'Stand Florio', x: 1884.8, z: 933, radius: 30, skipIds: [ST.id], build: buildStand, walls: wallBox(ST_A, stAlong(ST_END), 0.3) },
  { name: 'Nautoscopio', x: 904.5, z: -526.5, radius: 25, skipIds: [], build: buildNautoscopio, walls: ringWalls([[903.8, -527.2], [905.2, -527.2], [905.2, -525.8], [903.8, -525.8]]) },
  { name: 'Loggiato di San Bartolomeo', x: 838, z: -452, radius: 35, skipIds: [LG.id], build: buildLoggiato },
  { name: 'Palchetto della Musica al Foro Italico', x: 1027.6, z: -186.6, radius: 25, skipIds: [PM.id], build: buildPalchetto, walls: pmStairs() },
  { name: 'Arsenale della Real Marina', x: 521, z: -2313, radius: 55, skipIds: [AR.id], build: buildArsenale },
];
