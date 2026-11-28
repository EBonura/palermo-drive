// Round 2 landmarks, batch G2: a Norman pavilion, a hilltop castle, a Norman ruin and five coastal towers. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Plans come from the footprints of the world tiles, checked on the Regione Siciliana orthophoto (SITR, 15 cm, 2013) where it covers the place
// (not the Isola delle Femmine). Heights were read off the photos against those widths, so take them as good to about a metre; at the Castellaccio they come from a camera fitted to the footprint.
// Collision is the baked footprint, which stays, plus wall segments round whatever stands outside it (rock footings, battered bases, a buttress).
//
// La Cubula (r3714638.0), the garden pavilion off Via Aurelio Zancla. Commons: "Cubula 1", "Cubula 2", "La Cubula (Palermo)" 1, 3, 5, "La Cubula 01", "Piccola Cuba 01", "Piccola Cuba 03", "Palermo - La piccola Cuba - panoramio".
//  Read: a square of tuff blocks open on all four sides by pointed arches with a recessed ring of voussoirs, a flat cornice, a pink roof and a red dome. Not verified: the ceiling under the dome.
//  The footprint stays solid, so the arches are seen through but not driven through.
// Castellaccio di Monreale (r2384070.0), Monte Caputo. Commons: "Castelaccio" (from the air, 2020), "Castellaccio di Monreale", "(est)", "est 2", "nord" (2025).
//  Read: a long walled enclosure of grey and tan rubble, square towers standing out of both long sides and at the corners, a taller block at the north east corner with a white plaque, broken crests,
//  slit windows, a pointed door with ivy on the north end, courts with trees and two houses with tiled roofs inside. Not verified: the south end seen from outside, the exact places of the slits,
//  the inner walls (placed from the orthophoto).
// Castello dell'Uscibene (w82092948), off Via Nave: what is mapped under that name is the chapel. Commons: "Castello dell'Uscibene" 01 to 11, 14 (2017).
//  Read: the chapel in tuff, a low gable to the west with a pointed door, two blind arches and a battered south corner; a south side of tall blind pointed arches with small round headed windows, a
//  pointed doorway and a buttress, rough masonry at the west end; a tile edge and a pale barrel vault over the east end; a plain gable with quoins to the east (assumed to be that end).
//  Not verified: the north side (against the next house), the east end. Left out: the ruined hall with the ivy, which no photo ties to a footprint.
// Torre dell'Addaura (w285429715). Commons: "Torre di Addaura, Palermo", "Torre Addaura" (2024). Read: a round white tower, a string course, a crenellated parapet, a cluster of three corbels, a small square
//  window, a round hole, a tall window with a green frame and a little balcony lower down. Not verified: which way these face (set towards the north east), the other side. The house against it stays generic,
//  and its flat roof stands round the lower half of the tower.
// Torre del Rotolo (w1333776986), Lungomare Cristoforo Colombo. Commons: "Torre del Rotolo (PA)" (2013); Mapillary 508602670265030, 2945799428998934, 585898609060501 (2019). Read: a broken round tower of
//  grey rubble on a rock that stands up from the shoulder of the road, a large breach high on the north side, a flat grassy crest. Not verified: the sea side. Left out: two brick piers on the verge to the north.
// Torre della Tonnara di Vergine Maria (w278477636). Commons: "Torre Vergine Maria" (2010), "Tonnara Bordonaro Vergine Maria" (2019), "Torre della Tonnara di Vergine Maria" (2024).
//  Read: the north wing of the tuna works with the tower as its rounded east end on a battered foot; to the sea a weathered pink front with green shutters, arched windows, a long iron balcony on brackets,
//  iron tie plates, a quoined west end, a tiled roof, a small bell gable and a toothed parapet on the tower; to the south yellow plaster, small shuttered windows and the balcony on the round end.
//  Not verified: the west end and the south front behind the lower wing, which stays generic like the buildings round it.
// Torre di Fuori (w631345670), on the islet of the Isola delle Femmine. Commons: "Torre di fuori di Isola delle Femmine" (1977), "Isola delle Femmine (Palermo) 22 10 2023 04", "Isola delle Femmine
//  (3204574064)" (2009), "Femmine Island". Read: a ruined square tower over a slope of its own rubble, a tall battered mass on the north east, a wall with a large and a small round arch open to the sky on the
//  south east, a lower broken stump. Not verified: the north west and south west sides.
// Torre di Dentro (w561342651), Viale della Torre. Commons: "Torre in Terra di Isola delle Femmine" (2024), "La torre-4", "Isola delle Femmine (Palermo) 22 10 2023 09".
//  Read: a tall round tower of rubble on a crag, slightly tapering, the crest stepped, a door high up with a steep metal stair, small openings. Not verified: which way the door faces (set to the west,
//  towards the footpath), the other sides.
// Torre di Mondello or del Fico d'India (Capo Mondello): not here, it is the watchtower w285428887 that the Hotel La Torre model already draws (src/lmc-mondello.js).
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, lathe, extrude, prism, part, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, groundRange, pairsOf, initShared, noiseDots, streaks, RNG } from './lmc-kit.js';
import { TREE_CLEAR } from './tree-clear.js';

// ---- shared helpers
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
// a flat face: the shape's own metres pick the part of a canvas that covers FW x FH metres, shifted right by u0 metres
const face = (key, M, shape, z, FW, FH, u0 = FW / 2, o = {}) => part(key, new THREE.ShapeGeometry(shape, 6), { M: mul(M, tr(0, 0, z)), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [u0 / FW, 0], noao: true, ...o });
const ring = (cx, cz, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + i / n * 2 * PI) * r, cz + Math.sin(a0 + i / n * 2 * PI) * r]);
const closedSegs = (p) => p.map((a, i) => { const b = p[(i + 1) % p.length]; return [a[0], a[1], b[0], b[1]]; });
const openSegs = (p) => p.slice(1).map((b, i) => [p[i][0], p[i][1], b[0], b[1]]);
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
// A broken wall of rubble along a line of [x, z]: outer face, crest and inner face. o.t thickness, o.y0 foot, o.top(x, z, k) height of the crest at sample k, o.step sample spacing,
// o.closed, o.side (+1 or -1, the outer side of an open line), o.batter [offset at the foot, height where the face turns upright], o.c colour. Open lines get their ends closed.
function broken(line, o) {
  const closed = !!o.closed, t = o.t || 1, step = o.step || 3, key = o.key || 'g2Rubble';
  const side = o.side || (area(line) > 0 ? 1 : -1);   // outer normal of a stretch (dx, dz): side * (dz, -dx)
  const n = line.length, ns = closed ? n : n - 1;
  const nrm = (i) => { const a = line[i], b = line[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [side * dz / l, -side * dx / l]; };
  const mit = line.map((_, j) => { const a = nrm(closed ? (j + n - 1) % n : Math.max(0, j - 1)), b = nrm(closed ? j : Math.min(ns - 1, j)), k = Math.max(0.35, 1 + a[0] * b[0] + a[1] * b[1]); return [(a[0] + b[0]) / k, (a[1] + b[1]) / k]; });
  const S = [];   // samples: [x, z, nx, nz, s]
  let s = 0;
  for (let i = 0; i < ns; i++) {
    const a = line[i], b = line[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(l / step));
    for (let k = 0; k < m; k++) { const f = k / m, q = k ? nrm(i) : mit[i]; S.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, q[0], q[1], s + l * f]); }
    s += l;
  }
  if (!closed) S.push([line[n - 1][0], line[n - 1][1], mit[n - 1][0], mit[n - 1][1], s]);
  const T = S.map((q, k) => o.top(q[0], q[1], k, q[4]));
  const bat = o.batter, at = (q, d, y) => [q[0] + q[2] * d, y, q[1] + q[3] * d];
  const rows = [];
  rows.push(S.map(q => at(q, bat ? bat[0] : 0, o.y0)));
  if (bat) rows.push(S.map(q => at(q, 0, bat[1])));
  rows.push(S.map((q, k) => at(q, 0, T[k])));
  rows.push(S.map((q, k) => at(q, -t, T[k] - 0.15)));
  rows.push(S.map(q => at(q, -t, o.yIn !== undefined ? o.yIn : o.y0)));
  const cols = closed ? [...S, S[0]] : S, U = cols.map((q, j) => (closed && j === S.length ? s : q[4]) / 4);
  const P = rows.map(r => closed ? [...r, r[0]] : r);
  // which way round faces outwards: tested on the first cell of the outer face
  const a = V(...P[0][0]), b = V(...P[0][1]), c = V(...P[1][1]), nn = b.sub(a).cross(c.sub(a)), flip = nn.x * S[0][2] + nn.z * S[0][3] < 0;
  const vv = (i, p) => i === rows.length - 2 ? (p[1] + t) / 4 : p[1] / 4;
  gridMesh(key, P, (i, j, p) => [U[j], vv(i, p)], { flip, c: o.c, noao: true });
  if (closed) return;
  for (const [j, sg] of [[0, -1], [S.length - 1, 1]]) {
    const q = S[j], p0 = at(q, bat ? bat[0] : 0, o.y0), p1 = at(q, 0, T[j]), p2 = at(q, -t, T[j] - 0.15), p3 = at(q, -t, o.y0);
    const dir = j ? [S[j][0] - S[j - 1][0], S[j][1] - S[j - 1][1]] : [S[1][0] - S[0][0], S[1][1] - S[0][1]];
    const e = V(...p1).sub(V(...p0)).cross(V(...p2).sub(V(...p0))), ok = (e.x * dir[0] + e.z * dir[1]) * sg > 0;
    gridMesh(key, ok ? [[p3, p0], [p2, p1]] : [[p0, p3], [p1, p2]], (i, k, p) => [(k * t) / 4, p[1] / 4], { c: o.c, noao: true });
  }
}
// a crest height with a ragged edge, seeded
const ragged = (base, amp, seed) => { const r = RNG(seed), v = Array.from({ length: 97 }, () => r()); return (x, z, k) => base + (v[k % 97] - 0.5) * 2 * amp; };
// a polygon fan closing the top of a ring at height y, seen from above
const lid = (pts, y, c, key = 'flat') => { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), g = new THREE.ShapeGeometry(s); g.rotateX(-PI / 2); g.translate(0, y, 0); part(key, g, { c, noao: true }); };
// a thin dark opening laid on a wall: world point of the wall (x, z), outward normal (nx, nz)
const slit = (x, y, z, nx, nz, w, h, c = '#2e2822') => bx('flat', frame(x, y, z, nx, nz), -w / 2, w / 2, 0, h, -0.1, 0.06, { c, noao: true });

// A crag that carries a tower: uneven rings from the foot (y0, radius r0) to a nearly flat top (y1, radius r1), closed, in the kit's rock
function outcrop(cx, cz, y0, y1, r0, r1, seed, c, seg = 11) {
  const r = RNG(seed), levels = [0, 0.42, 0.7, 0.9, 1];
  const P = levels.map((f, i) => Array.from({ length: seg }, (_, j) => {
    const a = (j + (r() - 0.5) * 0.6) / seg * 2 * PI, rr = (r0 + (r1 - r0) * f * f) * (1 + (r() - 0.65) * 0.4);
    return [cx + Math.cos(a) * rr, y0 + (y1 - y0) * f + (i && i < 4 ? (r() - 0.5) * (y1 - y0) * 0.14 : i === 4 ? (r() - 0.7) * 0.35 : 0), cz + Math.sin(a) * rr];
  }));
  P.push(P[0].map(() => [cx, y1, cz]));
  const a = V(...P[0][0]), n = V(...P[0][1]).sub(a).cross(V(...P[1][1]).sub(a));
  gridMesh('rock', P, (i, j, p) => [j * 0.55, (p[1] + i * 0.4) / 6], { wrap: true, flip: n.x * (a.x - cx) + n.z * (a.z - cz) < 0, c, noao: true });
}

// the rubble masonry shared by the ruins: pale stones in darker mortar, 4 x 4 m, tinted by each place
function paintRubble(g, w, h) {
  g.fillStyle = '#b6ac9b'; g.fillRect(0, 0, w, h);
  const r = RNG(7201);
  for (let row = 0, y = 0; y < h; row++, y += 7) for (let x = (row % 2) * 4 - 4; x < w;) {
    const sw = 5 + r() * 9, sh = 4.5 + r() * 3.5, yy = y + (r() - 0.5) * 3, k = r();
    const col = k < 0.12 ? '#c4b49a' : k < 0.2 ? '#fbf7ee' : `hsl(${34 + r() * 10},${10 + r() * 14}%,${74 + r() * 16}%)`;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      if (x + dx > w || x + dx + sw < 0 || yy + dy > h || yy + dy + sh < 0) continue;
      g.fillStyle = col; g.beginPath(); g.ellipse(x + dx + sw / 2, yy + dy + sh / 2, sw / 2, sh / 2, (k - 0.5) * 0.7, 0, 2 * PI); g.fill();
    }
    x += sw + 0.8;
  }
  noiseDots(g, w, h, 420, 2, 7202, ['rgba(70,55,38,0.22)', 'rgba(255,250,238,0.22)', 'rgba(120,100,70,0.16)']);
}
const defRubble = () => defMat('g2Rubble', 128, 128, [4, 4], paintRubble);

// =====================================================================================================
// La Cubula
// =====================================================================================================
const CU = { id: 'r3714638.0', p: [-2124.5, 1016.0, -2123.6, 1024.4, -2132.4, 1025.3, -2132.9, 1021.0, -2133.3, 1016.9] };
const CUW = 8.7, CUH = 8.0, CUS = 2.9;   // side, wall height, springing of the arches
const CUBIG = { a: 2.85, h: 6.3 }, CUSM = { a: 1.65, h: 5.1 };
// a pointed arch as points from the left foot to the right foot
function pointed(a, h, y0 = CUS, y = 0, n = 7) {
  const r = h - y0, c = Math.max(0, (r * r - a * a) / (2 * a)), R = a + c, top = Math.atan2(r, -c), out = [[-a, y]];
  for (let i = 0; i <= n; i++) { const t = PI + (top - PI) * i / n; out.push([c + R * Math.cos(t), y0 + R * Math.sin(t)]); }
  for (let i = n - 1; i >= 0; i--) out.push([-out[i + 1][0], out[i + 1][1]]);
  out.push([a, y]);
  return out;
}
function cubulaFace(g, w, h) {
  const sx = w / CUW, sy = h / CUH, X = x => (x + CUW / 2) * sx, Y = y => h - y * sy, r = RNG(7211);
  g.fillStyle = '#76634a'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < CUH; y += 0.34) for (let x = -CUW / 2 - r(); x < CUW / 2;) {
    const bw = 0.5 + r() * 0.6; g.fillStyle = `hsl(${31 + r() * 7},${20 + r() * 14}%,${43 + r() * 17}%)`; g.fillRect(X(x) + 0.5, Y(y + 0.34) + 0.5, bw * sx - 1, 0.34 * sy - 1); x += bw;
  }
  const path = (a, hh) => { g.beginPath(); pointed(a, hh, CUS, 0, 10).forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); };
  // the ring of voussoirs and its mouldings
  g.save(); path(CUBIG.a + 0.42, CUBIG.h + 0.5); g.closePath(); g.clip(); g.fillStyle = 'rgba(206,176,134,0.35)'; g.fillRect(0, Y(CUH), w, h - Y(CUS));
  g.strokeStyle = 'rgba(62,46,28,0.6)'; g.lineWidth = 1;
  for (const s of [-1, 1]) for (let i = 0; i <= 15; i++) { const t = i / 15 * 1.12, ox = s * 0.55, px = ox - s * Math.cos(t) * 4.2, py = CUS + Math.sin(t) * 4.2; g.beginPath(); g.moveTo(X(ox - s * Math.cos(t) * 1.5), Y(CUS + Math.sin(t) * 1.5)); g.lineTo(X(px), Y(py)); g.stroke(); }
  g.restore();
  for (const [a, hh, t, col] of [[CUBIG.a + 0.42, CUBIG.h + 0.5, 0.09, '#6d573a'], [CUBIG.a + 0.3, CUBIG.h + 0.36, 0.07, '#ead9b8'], [CUBIG.a, CUBIG.h, 0.14, '#6d573a'], [2.25, 5.72, 0.07, '#7a6344'], [CUSM.a + 0.1, CUSM.h + 0.12, 0.1, '#e3d0ab']]) { path(a, hh); g.strokeStyle = col; g.lineWidth = Math.max(1, t * sx); g.stroke(); }
  const gt = g.createLinearGradient(0, 0, 0, Y(5.6)); gt.addColorStop(0, 'rgba(60,52,42,0.35)'); gt.addColorStop(1, 'rgba(60,52,42,0)'); g.fillStyle = gt; g.fillRect(0, 0, w, Y(5.6));
  streaks(g, w, h, 34, 7212, 0.2, 50, '58,46,34'); noiseDots(g, w, h, 900, 2, 7213, ['rgba(60,44,28,0.2)', 'rgba(250,236,205,0.18)']);
}
function buildCubula() {
  initShared(); defMat('g2Cubula', 256, 232, [CUW, CUH], cubulaFace);
  const pts = pairsOf(CU.p), gr = groundRange(pts), y0 = gr.lo, cx = -2128.45, cz = 1020.65, H2 = CUW / 2;
  begin(y0);
  const C = mul(tr(cx, y0, cz), rotY(Math.atan2(0.9, 8.85)));
  const outline = (a) => pointed(a.a, a.h);
  for (let k = 0; k < 4; k++) {
    const M = mul(C, rotY(k * PI / 2));
    const wall = (half, a, base = 0) => shapeOf([[-half, base], ...outline(a).map(q => [q[0], Math.max(base, q[1])]), [half, base], [half, CUH], [-half, CUH]]);
    face('g2Cubula', M, wall(H2, CUBIG), H2, CUW, CUH);
    // the recessed ring between the outer and the inner arch
    const big = outline(CUBIG), sm = outline(CUSM);
    face('g2Cubula', M, shapeOf([...sm, ...big.slice().reverse()]), H2 - 0.28, CUW, CUH, H2, { c: '#e9ddc8' });
    // the soffits
    for (const [line, z0, z1, col] of [[big, H2 - 0.28, H2, '#a38a64'], [sm, H2 - 1.15, H2 - 0.28, '#8f7857']]) {
      const P = [line.map(q => [q[0], q[1], z0]), line.map(q => [q[0], q[1], z1])];
      const W = P.map(r => r.map(q => V(...q).applyMatrix4(M).toArray()));
      const mid = V(0, 3, (z0 + z1) / 2).applyMatrix4(M), a = V(...W[0][1]), n = V(...W[0][2]).sub(a).cross(V(...W[1][2]).sub(a));
      gridMesh('flat', W, (i, j) => [j, i], { flip: n.dot(mid.sub(a)) < 0, c: col, noao: true });
    }
    // the inner face of the wall, seen through the arches
    face('g2Cubula', mul(M, mul(tr(0, 0, H2 - 1.15), rotY(PI))), wall(H2 - 1.15, CUSM), 0, CUW, CUH, H2, { c: '#9c8c72' });
    // the cornice
    bx('flat', M, -H2 - 0.1, H2 + (k % 2 ? -0.02 : 0.1), CUH - 0.3 - (k % 2) * 0.01, CUH + 0.04 - (k % 2) * 0.01, H2 - 0.1, H2 + 0.1, { c: '#bda884', noao: true });
  }
  bx('flat', C, -H2 + 0.05, H2 - 0.05, CUH - 0.08, CUH + 0.1, -H2 + 0.05, H2 - 0.05, { c: '#c98f7e', noao: true });
  // the vault seen from underneath
  const g = new THREE.PlaneGeometry(CUW - 2.3, CUW - 2.3); g.rotateX(PI / 2); part('flat', g, { M: C, p: [0, 6.3, 0], c: '#6a5b47', noao: true });
  lathe('flat', [[2.72, 0], [2.72, 0.35], [2.68, 0.9], [2.45, 1.6], [2.02, 2.2], [1.4, 2.68], [0.7, 2.96], [0.01, 3.06]], 18, { M: C, p: [0, CUH + 0.08, 0], c: '#a9453b', noao: true });
  const o = end('La Cubula');
  o.userData.solids = [[CU.p, null, y0 + CUH]];
  return o;
}

// =====================================================================================================
// Castellaccio di Monreale
// =====================================================================================================
const CA = { id: 'r2384070.0', p: [-7576.4, 3530.5, -7581.5, 3519.2, -7612.4, 3528.7, -7609.1, 3535.4, -7606.0, 3535.7, -7600.4, 3547.4, -7603.5, 3549.0, -7600.2, 3555.5, -7597.6, 3554.8, -7591.5, 3566.3, -7594.5, 3567.9, -7591.5, 3572.8, -7588.7, 3573.2, -7578.3, 3594.3, -7580.9, 3596.1, -7578.1, 3601.5, -7548.0, 3592.8, -7554.6, 3580.5, -7558.1, 3581.4, -7564.7, 3564.8, -7562.6, 3563.4, -7565.4, 3556.7, -7568.7, 3557.9, -7580.3, 3533.0] };
const CATOP = 771.0;   // the crest of the curtain walls, nearly level all round: the walls are low on the east, where the ground is high, and tall on the west
function buildCastellaccio() {
  initShared(); defRubble();
  const P = pairsOf(CA.p), gr = groundRange(P), lo = gr.lo - 2;
  begin(gr.lo);
  const stone = '#e8dcc6', pale = '#e6e0d4', warm = '#ead4b6';
  // the curtain walls, along the outline between the towers
  const at = (i) => P[i % P.length];
  const sides = area(P) > 0 ? 1 : -1;
  const run = (ids, c, seed, top) => broken(ids.map(at), { t: 1.4, y0: lo, yIn: 753, top: ragged(top || CATOP, 0.55, seed), step: 3.2, side: sides, c });
  const NA = at(1), NB = at(2), nr = ragged(CATOP + 0.4, 0.45, 7301), nlen = Math.hypot(NB[0] - NA[0], NB[1] - NA[1]);
  broken([NA, NB], { t: 1.4, y0: lo, yIn: 753, step: 2.1, side: sides, c: pale, top: (x, z, k) => nr(x, z, k) + 3.4 * Math.max(0, 1 - Math.abs(Math.hypot(x - NA[0], z - NA[1]) / nlen - 0.6) / 0.28) });   // north end, with its broken gable
  run([4, 5], pale, 7302); run([8, 9], pale, 7303); run([12, 13], pale, 7304);   // west
  run([15, 16], stone, 7305, CATOP - 0.4);           // south end
  run([18, 19], warm, 7306); run([22, 23, 0], warm, 7307);   // east
  // the towers: broken square shafts standing out of the walls, open at the top
  const tower = (q, top, seed, c, amp = 0.55) => broken(q, { closed: true, t: 1.1, y0: lo, yIn: top - 3.5, top: ragged(top, amp, seed), step: 2.6, c });
  const inward = (a, b, d) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -sides * dz / l, nz = sides * dx / l; return [a, b, [b[0] + nx * d, b[1] + nz * d], [a[0] + nx * d, a[1] + nz * d]]; };
  const blockNE = inward(at(0), at(1), 7.6);
  tower(blockNE, 775.8, 7310, warm, 0.45);
  tower(inward(at(2), at(3), 6.5), 773.4, 7311, pale, 1.1);
  tower(inward(at(6), at(7), 5.8), 774.2, 7312, pale);
  tower(inward(at(10), at(11), 5.4), 774.0, 7313, pale);
  tower(inward(at(14), at(15), 5.8), 773.0, 7314, stone);
  tower(inward(at(16), at(17), 8.0), 774.6, 7315, stone, 0.35);
  tower(inward(at(20), at(21), 5.6), 773.8, 7316, warm, 0.4);
  // inner cross walls and the two roofed houses (from the orthophoto)
  for (const [a, b, top, seed] of [[[-7595.4, 3534.6], [-7581.4, 3530.2], 768.5, 7320], [[-7584.2, 3571.6], [-7566.0, 3564.6], 767.8, 7321], [[-7574.2, 3588.4], [-7557.0, 3582.6], 768.6, 7322]]) broken([a, b], { t: 0.9, y0: lo, top: ragged(top, 0.7, seed), step: 3.5, c: stone });
  for (const [q, eave] of [[[[-7586.0, 3555.2], [-7580.6, 3553.0], [-7574.4, 3567.6], [-7579.8, 3569.8]], 767.4], [[[-7600.6, 3537.6], [-7595.0, 3535.6], [-7590.8, 3546.2], [-7596.2, 3548.4]], 768.2]]) {
    prism('g2Rubble', q, lo, eave, { c: '#d8c8ac', noao: true });
    const m = (a, b, y) => [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], p3 = (a, y = eave + 0.05) => [a[0], y, a[1]];
    const r0 = m(q[0], q[1], eave + 1.7), r1 = m(q[3], q[2], eave + 1.7);
    for (const [i0, [e0, e1]] of [[q[1], q[2]], [q[3], q[0]]].entries()) {
      const G = [[p3(e0), p3(e1)], e0 === q[1] ? [r0, r1] : [r1, r0]];
      const a = V(...G[0][0]), n = V(...G[0][1]).sub(a).cross(V(...G[1][1]).sub(a));
      gridMesh('flat', G, (i, j) => [j, i], { flip: n.y < 0, c: i0 ? '#a57c66' : '#ad8670', noao: true });
    }
    for (const [a, b, r] of [[q[0], q[1], r0], [q[2], q[3], r1]]) {
      const G = [[p3(a), p3(b)], [r, r]], u = V(...G[0][0]), n = V(...G[0][1]).sub(u).cross(V(...r).sub(u)), cc = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
      gridMesh('g2Rubble', G, (i, j, p) => [j * 1.4, p[1] / 4], { flip: n.x * (u.x - cc[0]) + n.z * (u.z - cc[1]) < 0, c: '#d8c8ac', noao: true });
    }
  }
  // the courts: dark green crowns showing over the walls
  for (const [x, z, y, r] of [[-7588.5, 3541, 766, 2.8], [-7586, 3548, 765.5, 2.4], [-7572.5, 3575, 767.5, 3.4], [-7567, 3579, 767, 3.0], [-7577, 3580, 766.5, 2.6], [-7572, 3561, 767, 2.2]]) sphere('flat', r, { p: [x, y, z], ky: 0.65, seg: 7, c: '#52603a', noao: true });
  // openings: slits on the outer faces, the window high on the north east block, its plaque, the door and the ivy on the north end
  const on = (a, b, f, y, w, h, c, out = 0.04) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = sides * dz / l, nz = -sides * dx / l; slit(a[0] + dx * f + nx * out, y, a[1] + dz * f + nz * out, nx, nz, w, h, c); };
  for (const [a, b, ys] of [[22, 23, [767.4]], [18, 19, [767.6]], [4, 5, [767]], [8, 9, [766.6]], [12, 13, [766.8]], [15, 16, [767]]]) for (const f of [0.22, 0.5, 0.78]) for (const y of ys) on(at(a), at(b), f, y, 0.22, 1.1);
  for (const [a, b] of [[20, 21], [16, 17], [6, 7], [10, 11]]) { on(at(a), at(b), 0.5, 768.6, 0.28, 1.6); on(at(a), at(b), 0.5, 771.2, 0.22, 0.9); }
  on(at(0), at(1), 0.7, 769.4, 1.1, 1.5); on(at(0), at(1), 0.3, 767.2, 0.22, 1.1); on(at(0), at(1), 0.76, 761.6, 1.9, 1.15, '#e9e6dc');
  const gy = (f) => groundY(NA[0] + (NB[0] - NA[0]) * f, NA[1] + (NB[1] - NA[1]) * f);
  const onN = (f, pts, c) => { const dx = NB[0] - NA[0], dz = NB[1] - NA[1], nx = sides * dz / nlen, nz = -sides * dx / nlen; extrude('flat', shapeOf(pts), 0.12, { M: frame(NA[0] + dx * f, gy(f), NA[1] + dz * f, nx, nz), p: [0, 0, -0.06], c, noao: true }); };
  onN(0.4, [[-0.8, -0.3], [0.8, -0.3], [0.8, 2.4], [0.5, 3.1], [0, 3.55], [-0.5, 3.1], [-0.8, 2.4]], '#4a4048');
  onN(0.58, [[-0.3, -0.3], [0.2, -0.3], [0.35, 1.9], [1.2, 2.7], [1.45, 4.2], [0.9, 4.9], [1.15, 6.4], [0.35, 8.1], [-0.35, 7.0], [-1.1, 6.2], [-0.85, 4.6], [-1.4, 3.4], [-0.5, 2.2]], '#5f7c46');
  onN(0.76, [[-1.05, 3.0], [1.05, 3.0], [1.05, 4.4], [-1.05, 4.4]], '#e6e4de');
  const o = end('Castellaccio di Monreale');
  o.userData.solids = [[CA.p, null, 768]];
  return o;
}

// =====================================================================================================
// Castello dell'Uscibene: the chapel
// =====================================================================================================
const US = { id: 'w82092948', p: [-2887.8, 989.4, -2886.7, 995.2, -2873.3, 992.6, -2874.4, 986.8] };
const USL = 13.65, USW = 5.9, USH = 6.5, USA = 7.35, USTH = 8;   // length, width, eaves, west apex, height covered by the texture
function uscFace(g, w, h) {
  const FW = USL + USW, sx = w / FW, sy = h / USTH, X = x => x * sx, Y = y => h - y * sy, r = RNG(7401);
  g.fillStyle = '#8f7e62'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < USTH; y += 0.28) for (let x = -r(); x < FW;) { const bw = 0.4 + r() * 0.5; g.fillStyle = `hsl(${34 + r() * 7},${18 + r() * 12}%,${55 + r() * 16}%)`; g.fillRect(X(x) + 0.5, Y(y + 0.28) + 0.5, bw * sx - 0.8, 0.28 * sy - 0.8); x += bw; }
  const arch = (x, y0, y1, ww, fill, line, lw = 0.1) => { const a = ww / 2; g.beginPath(); pointed(a, y1, y1 - a * 1.35, y0, 6).forEach((q, i) => i ? g.lineTo(X(x + q[0]), Y(q[1])) : g.moveTo(X(x + q[0]), Y(q[1]))); if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.strokeStyle = line; g.lineWidth = Math.max(1, lw * sx); g.stroke(); } };
  const win = (x, y0, y1, ww) => { g.fillStyle = '#2b241c'; g.beginPath(); g.moveTo(X(x - ww / 2), Y(y0)); g.lineTo(X(x - ww / 2), Y(y1 - ww / 2)); g.arc(X(x), Y(y1 - ww / 2), ww / 2 * sx, PI, 0); g.lineTo(X(x + ww / 2), Y(y0)); g.fill(); };
  // the south side (0 .. USL, west on the left)
  const mx = USL / 2;
  for (const [x, ww] of [[-1.9, 1.75], [0.15, 1.75], [2.0, 1.6], [3.7, 1.2], [5.35, 1.15], [6.35, 0.8]]) { arch(mx + x, 0.3, 6.05, ww, 'rgba(70,52,32,0.14)', '#5f4c34', 0.13); arch(mx + x + 0.1, 0.3, 5.95, ww - 0.12, null, 'rgba(244,228,195,0.6)', 0.06); }
  win(mx - 1.6, 4.55, 5.35, 0.42); win(mx + 3.2, 4.15, 4.9, 0.36); win(mx + 6.05, 3.9, 4.6, 0.3);
  arch(mx + 2.0, 0.7, 3.25, 1.2, '#d6c19c', '#6d573a', 0.08); arch(mx + 2.0, 0.7, 2.95, 0.82, '#33291f');
  for (let i = 0; i < 520; i++) { const x = r() * 3.3, y = r() * (5.9 - (x > 2.6 ? 1.5 : 0)); g.fillStyle = `hsl(${32 + r() * 10},${8 + r() * 12}%,${52 + r() * 32}%)`; g.beginPath(); g.ellipse(X(x), Y(y), (0.1 + r() * 0.14) * sx, (0.07 + r() * 0.09) * sy, r(), 0, 2 * PI); g.fill(); }
  // the west front (USL .. FW, north on the left)
  const wx = USL + USW / 2;
  for (const x of [-1.35, 1.2]) arch(wx + x, 4.3, 6.35, 1.35, 'rgba(70,52,32,0.14)', '#5f4c34', 0.1);
  win(wx - 1.25, 5.35, 6.0, 0.3);
  arch(wx - 0.35, 0, 4.15, 2.3, null, '#6d573a', 0.12); arch(wx - 0.35, 0, 3.85, 1.9, 'rgba(235,218,186,0.5)', '#7a6344', 0.07);
  arch(wx - 0.35, 0, 3.35, 1.2, '#4c5638', '#e0cba4', 0.1); g.fillStyle = '#9a6a38'; g.fillRect(X(wx - 0.95), Y(2.55), 1.2 * sx, 2.55 * sy); g.fillStyle = '#5e3d1e'; g.fillRect(X(wx - 0.37), Y(2.55), 0.05 * sx, 2.55 * sy); g.fillRect(X(wx - 1.1), Y(2.72), 1.5 * sx, 0.14 * sy);
  streaks(g, w, h, 40, 7402, 0.18, 36, '60,48,34'); noiseDots(g, w, h, 1100, 2, 7403, ['rgba(60,44,28,0.2)', 'rgba(250,236,205,0.18)']);
}
function buildUscibene() {
  initShared(); defRubble(); defMat('g2Usc', 320, 128, [USL + USW, USTH], uscFace);
  const pts = pairsOf(US.p), gr = groundRange(pts), y0 = gr.lo;
  begin(y0);
  const [A, B, C, D] = pts, FW = USL + USW;
  const edge = (a, b, nx, nz) => frame((a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2, nx, nz);
  const S = edge(B, C, 0.19, 0.982), W = edge(A, B, -0.982, 0.19), E = edge(C, D, 0.982, -0.19), N = edge(D, A, -0.19, -0.982);
  const gab = (hw, e, a) => shapeOf([[-hw, -1], [hw, -1], [hw, e], [0, a], [-hw, e]]);
  face('g2Usc', S, shapeOf([[-USL / 2, -1], [USL / 2, -1], [USL / 2, USH], [-USL / 2, USH]]), 0, FW, USTH, USL / 2);
  face('g2Usc', W, gab(USW / 2, USH - 0.1, USA), 0, FW, USTH, USL + USW / 2);
  face('g2Rubble', E, gab(USW / 2, USH - 0.1, USA), 0, 4, 4, 0, { c: '#e0c9a0' });
  face('g2Rubble', N, shapeOf([[-USL / 2, -1], [USL / 2, -1], [USL / 2, USH], [-USL / 2, USH]]), 0, 4, 4, 0, { c: '#d6c8ac' });
  for (const s of [-1, 1]) for (let y = 0.2; y < USH - 0.4; y += 0.62) bx('flat', E, s * USW / 2 - (s > 0 ? 0.55 : -0.05), s * USW / 2 + (s > 0 ? -0.05 : 0.55), y, y + 0.34, -0.05, 0.05, { c: '#dcc494', noao: true });
  slit(...new THREE.Vector3(0, 5.2, 0.05).applyMatrix4(E).toArray(), 0.982, -0.19, 0.32, 0.55);
  // the roof: two slopes behind the gables, their tiled edge along the south side
  const R = (x, y, z) => V(x, y, z).applyMatrix4(S).toArray(), zc = -USW / 2;
  for (const [ze, zr] of [[0.14, zc], [-USW - 0.05, zc]]) {
    const G = [[R(-USL / 2, USH - 0.02, ze), R(USL / 2, USH - 0.02, ze)], [R(-USL / 2, USA - 0.08, zr), R(USL / 2, USH + 0.45, zr)]];
    const a = V(...G[0][0]), n = V(...G[0][1]).sub(a).cross(V(...G[1][1]).sub(a));
    gridMesh('flat', G, (i, j) => [j, i], { flip: n.y < 0, c: '#9d7558', noao: true });
  }
  bx('flat', S, -USL / 2, USL / 2, USH - 0.12, USH + 0.06, -0.05, 0.2, { c: '#a5684a', noao: true });
  // the pale vault over the east end
  cyl('flat', 2.0, 2.0, USW - 0.7, 8, { M: S, p: [USL / 2 - 2.9, USH - 0.15, -0.35], rx: -PI / 2, t0: -PI / 2, tl: PI, open: true, c: '#cfc6b2', noao: true });
  for (const z of [-0.36, -USW + 0.36]) { const half = new THREE.CircleGeometry(2.0, 8, 0, PI); part('flat', half, { M: S, p: [USL / 2 - 2.9, USH - 0.15, z], ry: z > -1 ? 0 : PI, c: '#bdb29c', noao: true }); }
  // the buttress on the south side and the battered south corner of the west front: wedges, deepest at the ground
  const wedge = (M, x0, x1, h, d0, d1) => { const s = shapeOf([[-d0, -1], [0.05, -1], [0.05, h], [-d1, h]]); extrude('g2Rubble', s, x1 - x0, { M, p: [x0, 0, 0], ry: PI / 2, c: '#e0cba6', noao: true }); };
  wedge(S, 4.05, 4.9, 5.6, 0.85, 0.15);
  wedge(W, 2.0, 2.93, 6.2, 0.75, 0.05);
  const o = end("Castello dell'Uscibene");
  o.userData.solids = [[US.p, null, y0 + USH]];
  return o;
}
const wallsOf = (M, L) => openSegs(L.map(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(M); return [+p.x.toFixed(2), +p.z.toFixed(2)]; }));
const uscWalls = () => [
  ...wallsOf(frame((-2886.7 - 2873.3) / 2, 0, (995.2 + 992.6) / 2, 0.19, 0.982), [[4.05, 0], [4.05, 0.85], [4.9, 0.85], [4.9, 0]]),
  ...wallsOf(frame((-2887.8 - 2886.7) / 2, 0, (989.4 + 995.2) / 2, -0.982, 0.19), [[2.0, 0], [2.0, 0.75], [2.93, 0.75], [2.93, 0]]),
];

// =====================================================================================================
// Torre dell'Addaura
// =====================================================================================================
const AD = { id: 'w285429715', c: [-1684.25, -8174.7], r: 3.1 };
function buildAddaura() {
  initShared();
  const [cx, cz] = AD.c, r = AD.r, gr = groundRange(ring(cx, cz, r, 8)), y0 = gr.hi, top = y0 + 11.6;
  begin(y0);
  const white = '#f7f4ee', grey = '#d6d3cc';
  cyl('plaster', r, r + 0.18, top - 2.0 - (gr.lo - 1.5), 18, { p: [cx, gr.lo - 1.5, cz], open: true, c: white, noao: true });
  cyl('flat', r + 0.14, r + 0.14, 0.14, 18, { p: [cx, top - 2.06, cz], open: true, c: '#e6dfcc', noao: true });
  cyl('plaster', r + 0.03, r + 0.03, 1.2, 18, { p: [cx, top - 1.94, cz], open: true, c: '#e9e7e1', noao: true });
  lid(ring(cx, cz, r + 0.03, 18), top - 0.9, '#8c8479');
  // the merlons: broad blocks with narrow gaps
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * 2 * PI + 0.35, M = frame(cx + Math.cos(a) * (r - 0.19), top - 0.76, cz + Math.sin(a) * (r - 0.19), Math.cos(a), Math.sin(a));
    bx('plaster', M, -0.72, 0.72, 0, 0.76, -0.2, 0.24, { c: k % 3 ? '#e4e2dc' : grey, noao: true });
  }
  // what the photos show, round the side taken to face north east
  const face0 = Math.atan2(-0.72, 0.69), on = (da, d = 0) => { const a = face0 + da, rr = r + 0.02 + d; return frame(cx + Math.cos(a) * rr, y0, cz + Math.sin(a) * rr, Math.cos(a), Math.sin(a)); };
  const W = on(-0.5, 0.06);
  bx('flat', W, -0.45, 0.45, 6.55, 7.65, -0.25, 0.02, { c: '#d8d3c6', noao: true }); bx('flat', W, -0.33, 0.33, 6.65, 7.55, -0.2, 0.05, { c: '#3c4440', noao: true });
  disc(on(-0.42, 0.02), 0, 5.3, 0, 0.17, '#6f6a62');
  for (const [da, x] of [[0.62, 0], [0.86, 0], [1.10, 0]]) { const M = on(da); bx('plaster', M, x - 0.16, x + 0.16, 8.45, 9.0, -0.1, 0.42, { c: '#e0dcd2', noao: true }); bx('plaster', M, x - 0.14, x + 0.14, 8.05, 8.45, -0.1, 0.2, { c: '#d8d4ca', noao: true }); }
  const Dn = on(0.5, 0.08);
  bx('flat', Dn, -0.68, 0.68, 5.05, 5.18, -0.3, 0.06, { c: '#cfc9bb', noao: true });
  bx('flat', Dn, -0.55, 0.55, 2.8, 4.95, -0.3, 0.02, { c: '#4d6a54', noao: true });
  for (const s of [-1, 1]) bx('flat', Dn, s * 0.25 - 0.17, s * 0.25 + 0.17, 3.0, 4.8, -0.2, 0.05, { c: '#c4d2d0', noao: true });
  bx('flat', Dn, -0.75, 0.75, 2.62, 2.78, -0.1, 0.45, { c: '#cfc9bb', noao: true });
  bx('flat', Dn, -0.72, 0.72, 3.62, 3.68, 0.4, 0.44, { c: '#2c2c2c', noao: true }); for (let x = -0.7; x < 0.72; x += 0.2) bx('flat', Dn, x - 0.015, x + 0.015, 2.78, 3.62, 0.41, 0.43, { c: '#2c2c2c', noao: true });
  const o = end("Torre dell'Addaura");
  o.userData.solids = [[ring(cx, cz, r, 8).flat(), null, top]];
  return o;
}
function disc(M, x, y, z, r, c) { cyl('flat', r, r, 0.1, 8, { M, p: [x, y, z - 0.04], rx: PI / 2, c, noao: true }); }

// =====================================================================================================
// Torre del Rotolo
// =====================================================================================================
const RO = { id: 'w1333776986', c: [438.9, -7002.3] };
const ROROCK = ring(437.9, -7002.2, 5.6, 9, 0.2);
function buildRotolo() {
  initShared(); defRubble();
  const [cx, cz] = RO.c, road = groundY(425, -7002), lo = Math.min(groundY(443, -7002), groundY(438, -6997), groundY(444, -7007), groundY(432, -6996)) - 1.5;
  const rockTop = road + 4.2, top = road + 10.0;
  begin(lo);
  outcrop(438.6, -7002.3, lo, rockTop, 5.2, 3.6, 7501, '#cdcabf', 12);
  outcrop(435.4, -7000.2, lo, rockTop - 1.3, 2.6, 1.0, 7502, '#dcd8cc', 8);
  outcrop(437.6, -7005.2, lo, rockTop - 2.4, 2.3, 1.1, 7504, '#c0bdb2', 7);
  for (const [x, z, s] of [[433.2, -7005.8, 1.0], [433.4, -6998.2, 0.8], [434.0, -7007.6, 0.8]]) sphere('flat', s, { p: [x, groundY(x, z) + s * 0.45, z], ky: 0.8, seg: 6, c: '#5c6b3c', noao: true });
  // the broken drum; the crest drops towards the north
  const circle = ring(cx, cz, 3.05, 16, -PI / 2), rag = ragged(top, 0.32, 7503);
  broken(circle, { closed: true, t: 0.9, y0: rockTop - 0.8, yIn: top - 2.5, step: 1.3, batter: [0.45, rockTop + 2.2], top: (x, z, k) => rag(x, z, k) - Math.max(0, -(z - cz) / 3.05 - 0.75) * 2.0, c: '#bdb09a' });
  lid(ring(cx, cz, 2.3, 10), top - 1.3, '#7f765e');
  // the breach high on the north side: a ragged dark hollow, on the road side of due north
  const a = -PI / 2 - 0.55, M = frame(cx + Math.cos(a) * 3.1, rockTop, cz + Math.sin(a) * 3.1, Math.cos(a), Math.sin(a));
  extrude('g2Rubble', shapeOf([[-0.75, 1.7], [0.3, 1.5], [0.85, 2.45], [0.6, 3.05], [0.95, 3.85], [0.15, 4.65], [-0.65, 4.15], [-0.5, 3.05], [-0.95, 2.45]]), 0.3, { M, p: [0, 0, -0.24], c: '#76695a', noao: true });
  extrude('flat', shapeOf([[-0.5, 1.9], [0.15, 1.75], [0.55, 2.5], [0.35, 3.0], [0.65, 3.8], [0.05, 4.35], [-0.4, 3.95], [-0.25, 3.05], [-0.65, 2.5]]), 0.3, { M, p: [0, 0, -0.2], c: '#54483a', noao: true });
  for (const [dx, dz, s] of [[1.9, 1.0, 0.5], [-0.6, 2.3, 0.4], [0.6, -1.6, 0.3], [-2.2, -0.4, 0.35]]) sphere('flat', s, { p: [cx + dx, top - 0.15, cz + dz], ky: 0.55, seg: 5, c: '#8a8650', noao: true });
  const o = end('Torre del Rotolo');
  o.userData.solids = [[ring(cx, cz, 3.1, 8).flat(), null, top]];
  return o;
}

// =====================================================================================================
// Torre della Tonnara di Vergine Maria
// =====================================================================================================
const VM = { id: 'w278477636', p: [653.4, -5556.0, 623.7, -5559.2, 624.0, -5561.5, 624.6, -5566.4, 624.9, -5569.0, 645.8, -5566.7, 655.6, -5565.6, 656.8, -5565.4, 660.5, -5565.9, 664.1, -5563.9, 665.3, -5560.5, 665.1, -5558.2, 663.2, -5555.8, 660.8, -5555.2, 654.5, -5555.9] };
const VMW = 30.9, VMH = 15, VMEAVE = 14.8;
function vmFront(g, w, h) {   // the sea front of the wing, east (the tower) on the left as seen from outside
  const sx = w / VMW, sy = h / VMH, X = x => x * sx, Y = y => h - y * sy, r = RNG(7601);
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#c6a98c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = r() * VMW, y = r() * VMH, rx = 0.5 + r() * 2.2; g.fillStyle = r() < 0.55 ? 'rgba(120,98,78,0.2)' : r() < 0.5 ? 'rgba(226,204,170,0.3)' : 'rgba(160,110,70,0.18)'; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, (0.3 + r()) * sy, r() * 2, 0, 2 * PI); g.fill(); }
  for (let i = 0; i < 700; i++) { const x = r() * VMW, y = r() * r() * 4.2; g.fillStyle = `hsl(${28 + r() * 12},${18 + r() * 16}%,${42 + r() * 30}%)`; g.fillRect(X(x), Y(y), (0.15 + r() * 0.4) * sx, (0.12 + r() * 0.25) * sy); }
  const win = (x, y0, y1, ww, arch) => {
    R(x - ww / 2 - 0.14, y0 - 0.12, x + ww / 2 + 0.14, y1 + 0.14, '#d9c9ac');
    if (arch) { g.fillStyle = '#d9c9ac'; g.beginPath(); g.arc(X(x), Y(y1), (ww / 2 + 0.14) * sx, PI, 0); g.fill(); g.fillStyle = '#25302c'; g.beginPath(); g.arc(X(x), Y(y1), ww / 2 * sx, PI, 0); g.fill(); }
    R(x - ww / 2, y0, x + ww / 2, y1, '#25302c'); R(x - 0.03, y0, x + 0.03, y1, '#5b6f60'); R(x - ww / 2, (y0 + y1) / 2, x + ww / 2, (y0 + y1) / 2 + 0.06, '#5b6f60');
    if (!arch) R(x - ww / 2 - 0.25, y1 + 0.25, x + ww / 2 + 0.25, y1 + 0.42, '#8f8a80');
  };
  // metres from the east end of the painted front
  for (const y of [11.1, 13.0]) win(1.15, y, y + 1.1, 0.9); win(1.2, 6.6, 8.1, 0.95, true);
  win(4.85, 12.4, 13.5, 0.85); win(4.8, 8.3, 9.7, 0.95, true);
  win(8.55, 10.0, 11.4, 0.95, true); win(11.25, 13.2, 14.2, 0.9); win(11.25, 10.0, 11.4, 0.95, true);
  R(3.6, 2.75, 5.0, 4.6, '#3d342a'); for (let x = 3.75; x < 5; x += 0.28) R(x, 2.75, x + 0.05, 4.6, '#17120e');
  // the balcony: two shuttered doors, the slab on brackets, the iron rail
  for (const [x, white] of [[17.3, true], [25.4, false]]) { R(x - 1.3, 9.25, x + 1.3, 12.75, '#d4c3a4'); R(x - 1.15, 9.25, x - 0.58, 12.5, '#2c3a30'); R(x + 0.58, 9.25, x + 1.15, 12.5, '#2c3a30'); R(x - 0.55, 9.25, x + 0.55, 12.5, white ? '#d5d3c8' : '#34463a'); R(x - 0.03, 9.25, x + 0.03, 12.5, '#5b5a52'); R(x - 1.0, 12.95, x + 1.0, 13.15, '#8f8a80'); }
  R(15.0, 8.95, 27.4, 9.25, '#a8998a'); for (let x = 15.2; x < 27.3; x += 0.62) { R(x, 8.4, x + 0.2, 8.95, '#8e7c68'); R(x + 0.2, 8.4, x + 0.34, 8.9, 'rgba(40,28,18,0.35)'); }
  R(15.0, 10.35, 27.4, 10.45, '#222026'); for (let x = 15.0; x <= 27.4; x += 0.25) R(x, 9.25, x + 0.045, 10.4, '#222026');
  for (const x of [15.35, 19.45]) { R(x - 0.75, 2.5, x + 0.75, 5.9, '#9c8b74'); R(x - 0.58, 2.5, x + 0.58, 5.75, '#2b3328'); R(x - 0.03, 2.5, x + 0.03, 5.75, '#4a5744'); }
  win(25.2, 6.5, 7.5, 0.9);
  g.strokeStyle = '#332a22'; g.lineWidth = Math.max(1, 0.1 * sx);
  for (const [x, y] of [[13.1, 12.1], [13.2, 8.5], [13.2, 6.4], [16.8, 6.5], [28.5, 10.6]]) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(x - 0.32), Y(y - 0.32 * s)); g.lineTo(X(x + 0.32), Y(y + 0.32 * s)); g.stroke(); }
  // the quoins of the west end
  for (let y = 0, i = 0; y < VMH; y += 0.45, i++) R(VMW - (i % 2 ? 1.5 : 2.1), y + 0.03, VMW, y + 0.43, `hsl(34,${34 + r() * 12}%,${46 + r() * 12}%)`);
  R(0, VMEAVE - 0.25, VMW, VMH, '#b3997d');
  streaks(g, w, h, 60, 7602, 0.24, 60, '62,46,34'); noiseDots(g, w, h, 1500, 2, 7603, ['rgba(60,44,28,0.2)', 'rgba(240,224,195,0.16)']);
}
const VMEAST = [[655.6, -5565.6], [656.8, -5565.4], [660.5, -5565.9], [664.1, -5563.9], [665.3, -5560.5], [665.1, -5558.2], [663.2, -5555.8], [660.8, -5555.2], [654.5, -5555.9]];
const VMFOOT = [[655.6, -5565.6], [656.9, -5566.6], [661.0, -5567.4], [665.4, -5565.0], [667.0, -5560.6], [666.6, -5557.5], [664.1, -5554.5], [661.0, -5553.9], [660.8, -5555.2]];   // the battered foot, outside the footprint
function buildVergineMaria() {
  initShared(); defMat('g2VM', 512, 192, [VMW, VMH], vmFront);
  const pts = pairsOf(VM.p), gr = groundRange(pts), y0 = groundY(645, -5567.5), lo = Math.min(gr.lo, groundY(667, -5561), groundY(661, -5567)) - 1.2;
  begin(y0);
  const yellow = '#e2c794';
  const main = [[623.7, -5559.2], [624.0, -5561.5], [624.6, -5566.4], [624.9, -5569.0], [645.8, -5566.7], [655.6, -5565.6], [654.5, -5555.9], [653.4, -5556.0]];
  prism('plaster', main, lo, y0 + VMEAVE - 0.1, { c: yellow, noao: true });
  // the sea front
  const dx = 655.6 - 624.9, dz = -5565.6 + 5569.0, l = Math.hypot(dx, dz), F = frame((624.9 + 655.6) / 2, y0, (-5569.0 - 5565.6) / 2, dz / l, -dx / l);
  face('g2VM', F, shapeOf([[-l / 2, lo - y0], [l / 2, lo - y0], [l / 2, VMEAVE], [-l / 2, VMEAVE]]), 0.05, VMW, VMH);
  // the round east end: battered below the string course, upright above, a flat roof and teeth
  const bat = y0 + 6.6, topT = y0 + 15.2;
  const upper = VMEAST.map(p => [p[0], bat, p[1]]), foot = VMFOOT.map(p => [p[0], lo, p[1]]);
  const strip = (rows, key, c) => { const a = V(...rows[0][1]), n = V(...rows[0][2]).sub(a).cross(V(...rows[1][2]).sub(a)); let u = 0; const U = rows[1].map((p, j) => j ? (u += Math.hypot(p[0] - rows[1][j - 1][0], p[2] - rows[1][j - 1][2])) : 0); gridMesh(key, rows, (i, j, p) => [U[j] / 4, p[1] / 4], { flip: n.x * (a.x - 657) + n.z * (a.z + 5560.5) < 0, c, noao: true }); };
  strip([foot, upper], 'plaster', '#c2ad98');
  strip([upper.slice(0, 5), VMEAST.slice(0, 5).map(p => [p[0], topT, p[1]])], 'plaster', '#cdbaa8');   // the weathered sea side
  strip([upper.slice(4), VMEAST.slice(4).map(p => [p[0], topT, p[1]])], 'plaster', yellow);
  strip([VMEAST.map(p => [p[0] + (p[0] - 659) * 0.025, bat - 0.1, p[1] + (p[1] + 5560.5) * 0.025]), VMEAST.map(p => [p[0] + (p[0] - 659) * 0.025, bat + 0.2, p[1] + (p[1] + 5560.5) * 0.025])], 'flat', '#caae80');
  lid(VMEAST, topT - 0.5, '#a5978a');
  // the back of the tower where it rises over the roof of the wing, looking west
  { const a = VMEAST[0], b = VMEAST[8], G = [[[a[0], y0 + 11, a[1]], [b[0], y0 + 11, b[1]]], [[a[0], topT, a[1]], [b[0], topT, b[1]]]]; const u = V(...G[0][0]), n = V(...G[0][1]).sub(u).cross(V(...G[1][1]).sub(u)); gridMesh('plaster', G, (i, j, p) => [j * 2.4, p[1] / 4], { flip: n.x > 0, c: '#d9bd8a', noao: true }); }
  for (let i = 0; i < 4; i++) { const a = VMEAST[i], b = VMEAST[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez), n = Math.max(1, Math.round(el / 0.9)); for (let k = 0; k < n; k++) { const f = (k + 0.5) / n; bx('plaster', frame(a[0] + ex * f, topT, a[1] + ez * f, ez / el, -ex / el), -0.24, 0.24, 0, 0.42, -0.35, 0, { c: '#d9bd8a', noao: true }); } }
  // the bell gable on the tower
  const B = frame(655.9, topT - 0.5, -5564.3, 0.11, -0.994);
  bx('plaster', B, -1.45, 1.45, 0, 3.1, -0.45, 0.35, { c: '#dcbe8e', noao: true });
  for (const s of [-1, 1]) extrude('flat', shapeOf(pointedRound(0.42, 1.25)), 0.05, { M: mul(B, rotY(s > 0 ? 0 : PI)), p: [0, 1.25, s > 0 ? 0.33 : 0.43], c: '#33291f', noao: true });
  bx('flat', B, -1.6, 1.6, 3.1, 3.35, -0.55, 0.45, { c: '#b08a66', noao: true });
  // windows of the tower: the sea side, the south side, the balcony on the tip
  const onSeg = (i, f, y, ww, hh) => { const a = VMEAST[i], b = VMEAST[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez), M = frame(a[0] + ex * f, y0 + y, a[1] + ez * f, ez / el, -ex / el); bx('flat', M, -ww / 2 - 0.12, ww / 2 + 0.12, -0.1, hh + 0.12, -0.12, 0.03, { c: '#d9c9ac', noao: true }); bx('flat', M, -ww / 2, ww / 2, 0, hh, -0.1, 0.06, { c: '#2f4436', noao: true }); bx('flat', M, -ww / 2 - 0.2, ww / 2 + 0.2, hh + 0.2, hh + 0.34, -0.1, 0.14, { c: '#8f8a80', noao: true }); return M; };
  onSeg(1, 0.62, 8.0, 0.95, 2.4); onSeg(2, 0.55, 11.0, 0.8, 1.1);
  onSeg(7, 0.28, 9.0, 0.95, 1.5); onSeg(7, 0.76, 9.0, 0.95, 1.5); onSeg(7, 0.76, 12.4, 0.7, 0.9);
  const Bal = onSeg(4, 0.35, 7.2, 1.0, 2.4);
  bx('flat', Bal, -1.3, 1.3, -0.35, -0.1, -0.1, 1.0, { c: '#c9a45e', noao: true }); bx('flat', Bal, -0.9, 0.9, -0.85, -0.35, -0.1, 0.45, { c: '#b8945a', noao: true });
  bx('flat', Bal, -1.3, 1.3, 0.9, 0.96, 0.95, 1.0, { c: '#26242a', noao: true }); for (let x = -1.28; x <= 1.3; x += 0.215) bx('flat', Bal, x - 0.018, x + 0.018, -0.1, 0.92, 0.96, 0.99, { c: '#26242a', noao: true });
  for (const x of [-1.28, 1.28]) bx('flat', Bal, x - 0.02, x + 0.02, 0.9, 0.96, 0, 1.0, { c: '#26242a', noao: true });
  // the south front over the lower wing
  const sdx = 623.7 - 653.4, sdz = -5559.2 + 5556.0, sl = Math.hypot(sdx, sdz), So = frame(653.4, y0, -5556.0, sdz / sl, -sdx / sl);
  const south = (x, y, ww, hh) => { const M = mul(So, tr(x, y, 0)); bx('flat', M, -ww / 2 - 0.1, ww / 2 + 0.1, -0.08, hh + 0.1, -0.1, 0.03, { c: '#d9c9ac', noao: true }); bx('flat', M, -ww / 2, ww / 2, 0, hh, -0.1, 0.06, { c: '#33503c', noao: true }); bx('flat', M, -ww / 2 - 0.18, ww / 2 + 0.18, hh + 0.16, hh + 0.28, -0.05, 0.16, { c: '#8f8a80', noao: true }); };
  for (const [x, y, ww, hh] of [[1.8, 9.2, 0.95, 1.5], [6.4, 9.2, 0.95, 1.5], [10.6, 11.6, 0.85, 0.95], [10.6, 8.8, 0.85, 0.95], [15.4, 9.2, 0.95, 1.5], [20.5, 9.2, 0.95, 1.5], [26, 9.2, 0.95, 1.5], [18, 3.6, 0.8, 0.9], [24, 3.6, 0.8, 0.9]]) south(-x, y, ww, hh);   // x: metres west of the corner by the lower wing
  // the tiled roof of the wing: two slopes and the west gable
  const rn = [[624.9, -5569.2], [645.8, -5566.9], [655.5, -5565.8]], rs = [[623.5, -5559.0], [644.4, -5556.8], [654.4, -5555.7]], eave = y0 + VMEAVE - 0.1, ridge = rn.map((p, i) => [(p[0] + rs[i][0]) / 2, eave + 1.9, (p[1] + rs[i][1]) / 2]);
  for (const edge of [rn, rs]) { const G = [edge.map(p => [p[0], eave, p[1]]), ridge]; const a = V(...G[0][0]), n = V(...G[0][1]).sub(a).cross(V(...G[1][1]).sub(a)); gridMesh('flat', G, (i, j) => [j, i], { flip: n.y < 0, c: edge === rn ? '#b58a68' : '#ac805f', noao: true }); }
  for (const [j, sg] of [[0, -1], [2, 1]]) { const G = [[[rn[j][0], eave, rn[j][1]], [rs[j][0], eave, rs[j][1]]], [ridge[j], ridge[j]]]; const a = V(...G[0][0]), n = V(...G[0][1]).sub(a).cross(V(...ridge[j]).sub(a)); gridMesh('plaster', G, (i, k, p) => [k * 2.4, p[1] / 4], { flip: n.x * sg < 0, c: '#d8b486', noao: true }); }
  const o = end('Torre della Tonnara di Vergine Maria');
  o.userData.solids = [[VM.p, null, y0 + VMEAVE]];
  return o;
}
function pointedRound(a, h) { const p = [[-a, 0]]; for (let i = 0; i <= 6; i++) { const t = PI - i / 6 * PI; p.push([Math.cos(t) * a, h - a + Math.sin(t) * a]); } p.push([a, 0]); return p; }

// =====================================================================================================
// Torre di Fuori
// =====================================================================================================
const FU = { id: 'w631345670', p: [-11027.3, -10569.4, -11015.3, -10577.7, -11007.4, -10566.5, -11019.4, -10558.2] };
function buildFuori() {
  initShared(); defRubble();
  const pts = pairsOf(FU.p), gr = groundRange(pts), lo = gr.lo - 1.5, g = gr.hi;
  begin(gr.lo);
  const [c0, c1, c2, c3] = pts, mid = [(c0[0] + c2[0]) / 2, (c0[1] + c2[1]) / 2];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  // the slope of fallen stone: an uneven heap from the footprint up round the walls, with loose blocks on it
  const r = RNG(7701), rows = [[], [], [], []];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) {
    const p = lerp(pts[i], pts[(i + 1) % 4], k / 5);
    rows[0].push([p[0], groundY(p[0], p[1]) - 0.6, p[1]]);
    for (const [j, f, y, dy] of [[1, 0.86, 0.5, 1.7], [2, 0.7, 2.0, 2.4], [3, 0.52, 3.2, 2.2]]) { const w = lerp(mid, p, f + (r() - 0.5) * 0.18); rows[j].push([w[0], g + y + r() * dy, w[1]]); }
  }
  rows.push(rows[0].map(() => [mid[0], g + 3.8, mid[1]]));
  const a = V(...rows[0][0]), n = V(...rows[0][1]).sub(a).cross(V(...rows[1][1]).sub(a));
  gridMesh('g2Rubble', rows, (i, j, p) => [j * 0.7, i * 0.6 + p[1] / 9], { wrap: true, flip: n.x * (a.x - mid[0]) + n.z * (a.z - mid[1]) < 0, c: '#bdb6a6', noao: true });
  for (let i = 0; i < 9; i++) { const q0 = rows[1 + (i % 2)][(i * 7 + 2) % 20], sz = 0.7 + r() * 0.9; box('g2Rubble', sz, sz * 0.7, sz * 0.8, { p: [q0[0], q0[1] - 0.15, q0[2]], ry: r() * 3, rz: (r() - 0.5) * 0.7, c: '#cbc4b4', noao: true }); }
  const q = pts.map(p => lerp(mid, p, 0.66)), [q0, q1, q2, q3] = q, s = area(q) > 0 ? 1 : -1;
  // north east: the tall battered mass; its ends turn a little way down the north west and south east sides
  broken([lerp(q0, q1, 0.7), q1, q2, lerp(q2, q3, 0.14)], { t: 2.0, y0: g + 2.0, side: s, step: 2.4, batter: [0.75, g + 8], top: (x, z, k) => g + [11.8, 13.0, 13.9, 13.2, 13.6, 12.6, 13.0, 11.4, 10.4][k % 9], c: '#d0c8b6' });
  // south east: the wall with the two round arches open to the sky
  const A = lerp(q2, q3, 0.12), Bq = lerp(q2, q3, 0.76), ex = Bq[0] - A[0], ez = Bq[1] - A[1], L = Math.hypot(ex, ez), nx = s * ez / L, nz = -s * ex / L;
  const M = frame((A[0] + Bq[0]) / 2, g + 3, (A[1] + Bq[1]) / 2, nx, nz), ne = Math.sign(V(A[0], g, A[1]).applyMatrix4(M.clone().invert()).x) || 1;
  const sh = shapeOf([[-L / 2, -1], [L / 2, -1], ...(ne > 0 ? [[L / 2, 9.6], [2.0, 9.9], [0.7, 9.2], [-1.4, 9.4], [-2.4, 8.4], [-L / 2, 6.2]] : [[L / 2, 6.2], [2.4, 8.4], [1.4, 9.4], [-0.7, 9.2], [-2.0, 9.9], [-L / 2, 9.6]])]);
  const hole = (x, y, a_, h) => { const p = new THREE.Path(); p.moveTo(x - a_, y); p.lineTo(x - a_, y + h - a_); p.absarc(x, y + h - a_, a_, PI, 0, true); p.lineTo(x + a_, y); p.lineTo(x - a_, y); sh.holes.push(p); };
  hole(-ne * 0.7, 4.7, 1.55, 3.7); hole(ne * 1.9, 6.6, 0.65, 1.8);
  extrude('g2Rubble', sh, 1.2, { M, p: [0, 0, -1.2], uv: 'keep', uvk: [0.25, 0.25], c: '#dbd3c2', noao: true });
  // south west: a broken stump; north west: a low remnant
  broken([lerp(q2, q3, 0.9), q3, lerp(q3, q0, 0.28)], { t: 1.3, y0: g + 2.0, side: s, step: 1.6, top: (x, z, k) => g + [6.4, 8.6, 9.6, 7.8, 6.0][k % 5], c: '#c0b9a8' });
  broken([lerp(q3, q0, 0.6), q0, lerp(q0, q1, 0.66)], { t: 1.2, y0: g + 1.5, side: s, step: 2.2, top: ragged(g + 5.8, 1.1, 7702), c: '#c0b9a8' });
  const o = end('Torre di Fuori');
  o.userData.solids = [[FU.p, null, g + 4]];
  return o;
}

// =====================================================================================================
// Torre di Dentro
// =====================================================================================================
const DE = { id: 'w561342651', c: [-10184.1, -9519.8] };
const DEROCK = ring(-10184.1, -9519.8, 7.0, 10, 0.15);
function buildDentro() {
  initShared(); defRubble();
  const [cx, cz] = DE.c, gr = groundRange(ring(cx, cz, 6.6, 8)), lo = gr.lo - 1.2, rock = gr.hi + 3.0;
  begin(gr.lo);
  outcrop(cx, cz, lo, rock, 6.0, 5.5, 7801, '#cac6ba', 15);
  for (const [a, d, rr, h] of [[0.4, 4.9, 1.6, 0.7], [2.2, 5.0, 1.4, 1.2], [4.1, 4.8, 1.7, 0.5], [5.3, 5.2, 1.3, 1.4]]) outcrop(cx + Math.cos(a) * d, cz + Math.sin(a) * d, lo, rock - h, rr, rr * 0.45, 7810 + Math.round(a * 10), '#b6b3a8', 7);
  const topH = rock + 12.0, rag = ragged(topH, 0.12, 7802);
  broken(ring(cx, cz, 4.65, 20, 0), { closed: true, t: 0.9, y0: rock - 0.5, yIn: topH - 2.5, step: 1.5, batter: [0.55, rock + 11], top: (x, z, k) => rag(x, z, k) + (z - cz > 1.0 ? 1.0 : 0), c: '#c6a682' });
  lid(ring(cx, cz, 3.9, 12), topH - 1.2, '#8a7a62');
  // the door high on the west side, its steep metal stair and two small openings
  const rr = (y) => 4.65 + 0.55 * Math.max(0, 1 - (y - rock) / 11);
  const on = (a, y, w, h, c) => { const q = rr(y + h / 2) + 0.03; slit(cx + Math.cos(a) * q, y, cz + Math.sin(a) * q, Math.cos(a), Math.sin(a), w, h, c); };
  const door = PI, sill = rock + 5.6;
  on(door, sill - 0.15, 1.5, 2.6, '#cdb48e'); on(door, sill, 1.1, 2.25, '#2b241c');
  on(door - 0.75, rock + 7.4, 0.6, 0.8); on(door + 0.95, rock + 3.2, 0.5, 0.65); on(PI / 2 - 0.5, rock + 8.2, 0.55, 0.7);
  const S = frame(cx - rr(sill), rock, cz, -1, 0), run = 1.15, len = Math.hypot(run, 5.6), tilt = Math.atan2(run, 5.6);
  for (const x of [-0.45, 0.45]) { box('flat', 0.1, len, 0.14, { M: S, p: [x, 0, run + 0.05], rx: -tilt, c: '#8d9296', noao: true }); box('flat', 0.05, len, 0.05, { M: S, p: [x, 0.95, run + 0.12], rx: -tilt, c: '#a7adb0', noao: true }); }
  for (let i = 1; i < 18; i++) bx('flat', S, -0.45, 0.45, i * 0.31, i * 0.31 + 0.05, run * (1 - i * 0.31 / 5.6) - 0.06, run * (1 - i * 0.31 / 5.6) + 0.16, { c: '#7f8488', noao: true });
  bx('flat', S, -0.65, 0.65, 5.5, 5.6, -0.2, 0.4, { c: '#7f8488', noao: true });
  const o = end('Torre di Dentro');
  o.userData.solids = [[ring(cx, cz, 5.3, 8).flat(), null, topH]];
  return o;
}

TREE_CLEAR.push([-2128.4, 1020.6, 9.5], [-2128.8, 1008, 6], [-10184.1, -9519.8, 11]);   // the photos show open ground before the Cubula's arch and a bare crag at the Torre di Dentro

export const R2_G2 = [
  { name: 'La Cubula', x: -2128, z: 1021, radius: 20, skipIds: [CU.id], build: buildCubula },
  { name: 'Castellaccio di Monreale', x: -7579, z: 3560, radius: 60, skipIds: [CA.id], build: buildCastellaccio },
  { name: "Castello dell'Uscibene", x: -2881, z: 991, radius: 20, skipIds: [US.id], build: buildUscibene, walls: uscWalls() },
  { name: "Torre dell'Addaura", x: -1684, z: -8175, radius: 20, skipIds: [AD.id], build: buildAddaura },
  { name: 'Torre del Rotolo', x: 439, z: -7002, radius: 20, skipIds: [RO.id], build: buildRotolo, walls: closedSegs(ROROCK) },
  { name: 'Torre della Tonnara di Vergine Maria', x: 645, z: -5561, radius: 40, skipIds: [VM.id], build: buildVergineMaria, walls: openSegs(VMFOOT) },
  { name: 'Torre di Fuori', x: -11017, z: -10568, radius: 20, skipIds: [FU.id], build: buildFuori },
  { name: 'Torre di Dentro', x: -10184, z: -9520, radius: 20, skipIds: [DE.id], build: buildDentro, walls: closedSegs(DEROCK) },
];
