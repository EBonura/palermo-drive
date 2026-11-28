// Round 2 landmarks, batch V1: villas behind their gardens. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Sizes were judged from the photos against the mapped footprints and the baked heights, so treat them as good to about a metre. Each place has one painted
// atlas plus the shared 'flat' and 'rail' materials. Frames: origin on the ground in the middle of a front, +z out of the front, local x along it (right as seen from outside).
//
// Villa Whitaker, Via Cavour (w279883631). Commons "Villa Whitaker (Palermo).jpg", the balarm.it photo on the visits to the Prefettura, Mapillary 284344140053116, 476471943561100 (2018).
//  Read: red brick with white stone Venetian windows (pointed arches on slender colonnettes), a recessed middle between two projecting wings with stone quoins, a pale rusticated ground floor, a long
//  balcony with a pierced stone parapet across the middle, a balustraded balcony on the wing, a small balcony with flags on the top floor, a bracketed cornice; on Via Cavour a low stone wall with a tall
//  dark iron railing. The east wing is drawn as the mirror of the west one. Not verified: the openings of the ground floor, the outer sides, the back and the southern part (plain brick), the roof, the
//  place of the gate in the railing and the pillars; the railing's line is set 13 m from the road's centre line, from the photos' sidewalk.
//
// Villa Zito, Via della Libertà (w25170515). Commons "Villa Zito - Veduta esterna.jpg", "Pinacoteca Villa Zito.jpg", "Museo archeologico Ignazio Mormino.jpg" and "... ingresso.jpg", the photos on
//  villazito.it (palazzo01, palazzo02). Read: ochre stone, rusticated at the foot; ground floor arched doors with green shutters in radiating voussoirs; two upper floors of windows with iron balconies,
//  segmental pediments over the first and flat hoods over the second; a bracketed cornice, a tiled roof; at the south end a rounded terrace with a balustrade and a loggia on square pillars; on the
//  street a tufa wall with an iron railing and stone pillars, a gate between two black lamp posts, a blue banner; a round basin in the garden. Not verified: the number of bays (nine drawn), the north
//  end and the back (plain stone), the doors of the south end, the exact places of the gate, banner and pillars, the short return of the wall at the north end.
// Villa Pajno, Via della Libertà 72 (w35607584). lasiciliainrete.it, page "Villa Pajno" (photo from the street). Read: a beige front of two rows of paired pointed windows under round arches, five bays,
//  diamond ornaments beside the middle one, a stone balcony with two flag staffs, a corbel table of little arches, a pierced parapet, a set back attic with a railing and chimneys; on the street a low
//  wall with pale panels, an iron fence and a clipped hedge. Not verified: the sides and back (bands only, no windows), the ends of the hedged stretch (50 m drawn).
// Casina of Villa Trabia, the old foresteria in the park by Via Piersanti Mattarella (w375399756). balarm.it, "Villa Trabia: riqualificazione giovane per la Foresteria" (2 March 2015: about 70 m2 on two
//  floors, entrance from Via Piersanti Mattarella, abandoned and damaged by a fire) and its one photo. Read: a plain two storey house of weathered off white plaster with a cornice, a flat roof behind a low
//  parapet, small dark windows (two upper ones on one side, one above one on the next). The photo shows it before any restoration; its present state is unknown. Not verified: which side of the footprint
//  carries which windows (the two others repeat them); the shrubs round it are not drawn.
// Villino Favaloro, Piazza Virgilio (w278804042 and the turret w278805222). Commons "Villino favaloro", "... 2", "... 6", "... 7", "... 8" and "Villino Favaloro stile Liberty in Palermo" 01, 02;
//  balarm.it, finestresullarte.info, regione.sicilia.it, enjoysicilia.it and gpsmycity.com photos. Read: off white walls with grey green bands over a grey base; on the east front a door in a pierced
//  Liberty frame up a flight of steps, windows with tracery heads, a first floor loggia of slender columns under pierced arches with a painted ochre wall; dark louvred shutters and a glass canopy over the
//  west door; an octagonal turret with an open top, a tiled frieze and a crest of finials; a winter garden of iron and glass on the south side; a tiled roof; an iron railing on stone pillars along the
//  street. Not verified: the north side (bands only), the number of columns, the size of the winter garden (from the aerial picture), the railing's line (the edges of the mapped garden) and the gate.
// Villa Airoldi, Via Leoni (w223970240). Commons "Villa airoldi.jpg", "Villa Airoldi 10.jpg", "Villa Airoldi 11.jpg" (and 06, 09 for the colours). Read: the portal bay with a vaulted passage between two
//  columns, a stone balcony, a window with a curved pediment, paired white pilasters on pinkish brown plaster, a cornice, a parapet with busts and the arms with the eagle; two lanterns; iron fences at its sides, the
//  golf club's board. The street front is otherwise hidden by trees in every photo found: the other bays carry only the pilasters, cornice and parapet, no windows. Not verified: those bays, the exact
//  place of the portal along the front, the back and the courtyard.
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, sphere, panel, part, prism, pyramid, extrude, begin, end, defMat, mul, tr, frame, groundY, initShared, pairsOf, groundRange, RNG } from './lmc-kit.js';

// ---- shared helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// a painted atlas covering W x H metres, w x h pixels: define(), and quad() which lays the region with its lower left at (u, v) metres on the rectangle x0..x1, y0..y1 of the frame M at depth z
function atlas(key, w, h, W, H, painter) {
  return {
    key, W, H,
    define: () => defMat(key, w, h, [W, H], (g, cw, ch) => painter(g, cw, ch, pen(g, cw, ch, W, H))),
    quad: (M, x0, x1, y0, y1, z, u, v, o = {}) => panel(key, x1 - x0, y1 - y0, { M, p: [(x0 + x1) / 2, y0, z], uvk: [(o.uw || x1 - x0) / W, (o.vh || y1 - y0) / H], uvo: [u / W, v / H], c: o.c }),
  };
}
// drawing in metres, y up
function pen(g, w, h, W, H) {
  const sx = w / W, sy = h / H, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const ring = (x, y, r, t, c, a0 = 0, a1 = 2 * PI) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, a0, a1); g.stroke(); };
  const line = (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
  // everything painted by fn stays inside the rectangle
  const clip = (x0, y0, x1, y1, fn) => { g.save(); g.beginPath(); g.rect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); g.clip(); fn(); g.restore(); };
  // grain, soft stains and streaks over a region
  const wear = (x0, y0, x1, y1, seed, a = 0.1) => clip(x0, y0, x1, y1, () => {
    const r = RNG(seed), area = (x1 - x0) * (y1 - y0);
    for (let i = 0; i < area * 5; i++) { g.fillStyle = r() < 0.5 ? 'rgba(70,50,35,0.10)' : 'rgba(255,248,232,0.10)'; g.fillRect(X(x0 + r() * (x1 - x0)), Y(y0 + r() * (y1 - y0)), 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < area / 7; i++) { const x = X(x0 + r() * (x1 - x0)), y = Y(y0 + r() * (y1 - y0)), l = sy * (0.6 + r() * 2.4), gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(55,40,28,${a * (0.5 + r())})`); gr.addColorStop(1, 'rgba(55,40,28,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 3, l); }
    const gb = g.createLinearGradient(0, Y(y0), 0, Y(y0 + 1.6)); gb.addColorStop(0, 'rgba(40,28,18,0.25)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(X(x0), Y(y0 + 1.6), (x1 - x0) * sx, 1.6 * sy);
  });
  return { g, sx, sy, X, Y, R, poly, arch, circ, ring, line, clip, wear };
}
// a site: footprint, the ground (y0 at the front point O, lo the lowest ground), a frame at O facing N, and a frame in the middle of each wall
function site(flat, O, N) {
  const pts = pairsOf(flat), l = Math.hypot(N[0], N[1]), nx = N[0] / l, nz = N[1] / l;
  const y0 = groundY(O[0] + nx * 0.8, O[1] + nz * 0.8), lo = Math.min(groundRange(pts).lo, y0) - 1.2, F = frame(O[0], y0, O[1], nx, nz);
  const W = (x, z) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz];
  const edge = (a, b, poly = pts) => { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let ex = -dz / len, ez = dx / len; if (inPoly(poly, mx + ex * 0.15, mz + ez * 0.15)) { ex = -ex; ez = -ez; } return { M: frame(mx, y0, mz, ex, ez), l: len, nx: ex, nz: ez }; };
  const wall = i => edge(pts[i], pts[(i + 1) % pts.length]);
  return { pts, y0, lo, F, W, edge, wall };
}
const shapeFrom = (q) => { const s = new THREE.Shape(); q.forEach((v, i) => i ? s.lineTo(v[0], v[1]) : s.moveTo(v[0], v[1])); s.closePath(); return s; };
// cover a wall edge with equal bays of one atlas region (u, v, width bw)
function bays(A, E, y0, y1, u, v, bw, o = {}) {
  const n = Math.max(1, Math.round(E.l / bw)), s = E.l / n;
  for (let i = 0; i < n; i++) A.quad(E.M, -E.l / 2 + i * s, -E.l / 2 + (i + 1) * s, y0, y1, o.z || 0, u, v, { uw: bw, c: o.c });
}
const foot = (E, depth, c) => { if (depth < 0) bx('flat', E.M, -E.l / 2, E.l / 2, depth, 0, -0.2, 0, { c, noao: true }); };
// roof triangles in the frame M, wound so that every face looks up
function roofTris(M, tris, c) {
  const pos = [];
  for (const [a, b, d] of tris) { const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]); for (const q of ny < 0 ? [a, d, b] : [a, b, d]) pos.push(q[0], q[1], q[2]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); geo.computeVertexNormals();
  part('flat', geo, { M, c, noao: true });
}
// a hip roof over x0..x1, z0..z1 of the frame M, eaves at y
function hip(M, x0, x1, z0, z1, y, rise, c, c2 = c) {
  const w = x1 - x0, d = z1 - z0, s = Math.min(w, d) / 2, along = w >= d;
  const r0 = along ? [x0 + s, y + rise, (z0 + z1) / 2] : [(x0 + x1) / 2, y + rise, z0 + s], r1 = along ? [x1 - s, y + rise, (z0 + z1) / 2] : [(x0 + x1) / 2, y + rise, z1 - s];
  const a = [x0, y, z0], b = [x1, y, z0], e = [x1, y, z1], f = [x0, y, z1];
  const long = along ? [[a, b, r1], [a, r1, r0], [f, e, r1], [f, r1, r0]] : [[a, f, r1], [a, r1, r0], [b, e, r1], [b, r1, r0]];
  const short = along ? [[a, f, r0], [b, e, r1]] : [[a, b, r0], [f, e, r1]];
  roofTris(M, long, c); roofTris(M, short, c2);
}
// An iron railing on a low wall along a world polyline whose outer (street) side is to `out` = [x, z]. o.wh wall height, o.rh railing height, o.wc wall colour, o.face (E, x0, x1, y0, y1) paints the
// street face, o.pier [every nth joint, size, height, colour, cap]. Returns nothing; collision comes from fenceWalls over the same points.
function fenceRun(line, out, o) {
  const wh = o.wh, rh = o.rh;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    let nx = -dz / len, nz = dx / len; if ((out[0] - a[0]) * nx + (out[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const sg = Math.sign(dx * nz - dz * nx) || 1, n = Math.max(1, Math.round(len / (o.step || 4)));
    for (let k = 0; k < n; k++) {
      const p = [a[0] + dx * k / n, a[1] + dz * k / n], q = [a[0] + dx * (k + 1) / n, a[1] + dz * (k + 1) / n], s = len / n;
      const y = Math.min(groundY(p[0], p[1]), groundY(q[0], q[1])), M = frame((p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2, nx, nz);
      bx('flat', M, -s / 2, s / 2, -0.5, wh, -0.2, 0.2, { c: o.wc, noao: true });
      if (o.face) o.face(M, -s / 2, s / 2, 0, wh);
      bx('flat', M, -s / 2, s / 2, wh, wh + 0.08, -0.25, 0.25, { c: o.cap || o.wc, noao: true });
      panel('rail', s, rh, { M, p: [0, wh + 0.08, 0], uvk: [s, 1], c: o.rc || '#8a8f96' });
      if (o.pier && ((k % o.pier[0] === 0) || (k === n - 1 && i === line.length - 2))) {
        const [, sz, ph, pc] = o.pier, ends = k === n - 1 && i === line.length - 2 && k % o.pier[0] ? [sg * s / 2] : [-sg * s / 2];
        for (const e of ends) { bx('flat', M, e - sz / 2, e + sz / 2, -0.5, ph, -sz / 2, sz / 2, { c: pc }); bx('flat', M, e - sz / 2 - 0.08, e + sz / 2 + 0.08, ph, ph + 0.16, -sz / 2 - 0.08, sz / 2 + 0.08, { c: pc }); pyramid('flat', sz * 0.85, sz * 0.85, sz * 0.75, { M, p: [e, ph + 0.16, 0], c: pc, noao: true }); }
      }
    }
  }
}
// collision along a polyline, moved d metres to the side of `out` (the street face of the wall)
function fenceWalls(line, out, d = 0.2) {
  const w = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    let nx = -dz / len, nz = dx / len; if ((out[0] - a[0]) * nx + (out[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
    w.push([a[0] + nx * d, a[1] + nz * d, b[0] + nx * d, b[1] + nz * d]);
  }
  return w;
}
// a closed iron gate between two world points: bars from the ground, two rails and a centre stile
function gate(a, b, out, h, c = '#2c2e33') {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  let nx = -dz / len, nz = dx / len; if ((out[0] - a[0]) * nx + (out[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const y = Math.min(groundY(a[0], a[1]), groundY(b[0], b[1])), M = frame((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, nx, nz);
  panel('rail', len, h, { M, p: [0, 0.08, 0], uvk: [len, 1], c: '#8a8f96' });
  for (const x of [-len / 2 + 0.05, 0, len / 2 - 0.05]) bx('flat', M, x - 0.05, x + 0.05, 0, h + 0.2, -0.04, 0.04, { c, noao: true });
  bx('flat', M, -len / 2, len / 2, 1.05, 1.15, -0.03, 0.03, { c, noao: true });
}

// =====================================================================================================
// Villa Whitaker, Via Cavour
// =====================================================================================================
const WH = { id: 'w279883631', p: [103.3, -675.4, 104.2, -679.7, 106.6, -680.7, 102.9, -690.1, 111.2, -693, 112.1, -691.3, 125.9, -696.8, 125.2, -698.5, 133.7, -701.8, 137.9, -691.4, 135.8, -690.6, 138.5, -683.2, 129.2, -679.4, 127.2, -683.2, 119.8, -680.2, 129, -656.3, 125.5, -654.9, 118.2, -673.6, 116.2, -672.9, 115.8, -673.8, 111.2, -672, 111.6, -670.8, 107.3, -669.1, 107.6, -668.4, 89.8, -660.6, 86.5, -667.5] };
const WHH = 17, WHWH = 18, WHSTONE = '#d9d0bd', WHBRICK = '#ad6f58';
// the street railing, from the west end to the gatehouse, the gate, then on to the east end of the garden
const WHF1 = [[68, -714.9], [76, -716], [86.4, -719.9]], WHG = [[95.4, -722.9], [103.4, -724.4]], WHF2 = [[103.4, -724.4], [108.3, -725.3], [124.6, -728.4], [150.4, -733.2]], WHOUT = [110, -760];
function whBrick(p, x0, x1, top) {
  const { R, g, X, Y, sx, sy } = p, r = RNG(Math.round(x0 * 10) + 5);
  R(x0, 0, x1, 18, WHBRICK);
  for (let y = 5.9; y < top; y += 0.16) for (let x = x0 - r() * 0.4; x < x1; x += 0.42) { g.fillStyle = r() < 0.5 ? `rgba(222,170,140,${r() * 0.35})` : `rgba(95,45,30,${r() * 0.3})`; g.fillRect(X(Math.max(x, x0)), Y(y + 0.13), (Math.min(x + 0.37, x1) - Math.max(x, x0)) * sx, 0.12 * sy); }
  // ground floor: pale rough stone in courses, a string course above the first floor, the cornice on its corbels
  R(x0, 0, x1, 5.7, '#cdc2aa');
  for (let j = 0, y = 0; y < 5.6; y += 0.42, j++) { R(x0, y, x1, y + 0.05, 'rgba(95,80,60,0.5)'); for (let x = x0 + (j % 2) * 0.45; x < x1; x += 0.9) R(x, y, x + 0.05, y + 0.42, 'rgba(95,80,60,0.4)'); }
  R(x0, 0, x1, 0.9, '#aaa08e');
  R(x0, 11.35, x1, 11.55, WHSTONE); R(x0, 11.27, x1, 11.35, 'rgba(60,35,20,0.4)');
  R(x0, top - 0.75, x1, top - 0.6, '#c9bfa9'); for (let x = x0 + 0.2; x < x1 - 0.2; x += 0.62) { R(x, top - 0.62, x + 0.2, top - 0.18, WHSTONE); R(x + 0.2, top - 0.62, x + 0.28, top - 0.18, 'rgba(60,35,20,0.45)'); } R(x0, top - 0.2, x1, top + 1, WHSTONE);
}
// a Venetian window: n pointed lights on colonnettes in a stone frame; sill y0, springing ys, arch point ya, top of the frame yt
function venetian(p, cx, w, n, y0, ys, ya, yt) {
  const { R, circ, ring, poly, g, X, Y } = p, lw = w / n;
  R(cx - w / 2 - 0.32, y0 - 0.18, cx + w / 2 + 0.32, yt + 0.12, '#bfb39c'); R(cx - w / 2 - 0.22, y0 - 0.1, cx + w / 2 + 0.22, yt, WHSTONE);
  for (let i = 0; i < n; i++) {
    const m = cx - w / 2 + lw * (i + 0.5), a = lw / 2 - 0.12, path = () => {
      g.beginPath(); g.moveTo(X(m - a), Y(y0)); g.lineTo(X(m - a), Y(ys));
      g.bezierCurveTo(X(m - a * 1.08), Y(ys + (ya - ys) * 0.62), X(m - a * 0.2), Y(ys + (ya - ys) * 0.6), X(m), Y(ya));
      g.bezierCurveTo(X(m + a * 0.2), Y(ys + (ya - ys) * 0.6), X(m + a * 1.08), Y(ys + (ya - ys) * 0.62), X(m + a), Y(ys)); g.lineTo(X(m + a), Y(y0)); g.closePath();
    };
    g.save(); g.strokeStyle = '#a89a80'; g.lineWidth = 3.5; path(); g.stroke(); g.fillStyle = '#3a2a22'; path(); g.fill(); g.clip();
    R(m - a, y0, m + a, ys - 0.15, '#33404e'); R(m - 0.04, y0, m + 0.04, ys + 0.1, '#6a4a34'); R(m - a, ys - 0.2, m + a, ys - 0.08, '#6a4a34'); poly([[m - a, y0], [m - a * 0.2, ys], [m - a * 0.75, ys], [m - a, y0 + 0.9]], 'rgba(190,210,230,0.25)'); g.restore();
    circ(m, ya + 0.28, 0.09, '#a89a80');
  }
  for (let i = 0; i <= n; i++) { const x = cx - w / 2 + lw * i; R(x - 0.07, y0, x + 0.07, ys, '#eee8da'); R(x + 0.04, y0, x + 0.07, ys, 'rgba(90,75,55,0.4)'); R(x - 0.15, ys - 0.06, x + 0.15, ys + 0.14, '#e8e0ce'); R(x - 0.12, y0, x + 0.12, y0 + 0.14, '#c9bfa9'); }
  for (let i = 1; i < n; i++) { const x = cx - w / 2 + lw * i, y = (ya + yt) / 2 + 0.05; circ(x, y, 0.22, '#a89a80'); circ(x, y, 0.13, '#d2b8a4'); }
}
// the pierced parapet of the long balcony and the balustrade of the others: 3 m of each
function whParapet(p, u, v) {
  const { R, circ, ring, line } = p;
  R(u, v, u + 3, v + 1.1, WHSTONE);
  for (let i = 0; i < 3; i++) {
    const x = u + 0.5 + i, y = v + 0.55; R(x - 0.4, v + 0.16, x + 0.4, v + 0.94, '#6a5242');
    ring(x, y, 0.3, 0.09, WHSTONE); circ(x, y, 0.11, WHSTONE); for (let k = 0; k < 8; k++) { const a = k * PI / 4; line(x, y, x + Math.cos(a) * 0.42, y + Math.sin(a) * 0.42, 0.075, WHSTONE); }
  }
  R(u, v + 1.0, u + 3, v + 1.05, 'rgba(90,70,50,0.4)');
}
function whBaluster(p, u, v) { const { R } = p; R(u, v, u + 3, v + 1.1, '#5e4b3e'); R(u, v + 0.92, u + 3, v + 1.1, WHSTONE); R(u, v, u + 3, v + 0.16, WHSTONE); for (let x = u + 0.1; x < u + 3; x += 0.34) { R(x, v + 0.16, x + 0.13, v + 0.92, '#e2dac8'); R(x - 0.04, v + 0.42, x + 0.17, v + 0.56, '#e2dac8'); } }
// atlas, in metres: the middle 0..14.9, a wing front 15..23.8, a narrow wing side 24..26, plain brick 26.2..30.2, the two parapets at 30.4
const WHA = atlas('v1Whit', 640, 352, 33.6, 18, (g, w, h, p) => {
  whBrick(p, 0, 14.9, WHH);
  p.clip(0, 0, 14.9, 18, () => {
    venetian(p, 7.45, 4.2, 3, 6.0, 8.5, 9.8, 10.7); for (const x of [2.25, 12.65]) venetian(p, x, 1.7, 1, 6.0, 8.5, 9.8, 10.7);
    venetian(p, 7.45, 4.2, 3, 12.3, 13.8, 14.75, 15.35); for (const x of [2.25, 12.65]) venetian(p, x, 2.7, 2, 12.3, 13.8, 14.75, 15.35);
  });
  whBrick(p, 15, 23.8, WHWH);
  p.clip(15, 0, 23.8, 18, () => {
    venetian(p, 19.4, 4.8, 3, 6.0, 8.6, 10.0, 10.9); venetian(p, 19.4, 4.3, 3, 12.7, 14.4, 15.5, 16.35); for (let x = 17.5; x < 21.4; x += 0.8) { p.circ(x, 13.05, 0.28, WHSTONE); p.circ(x, 13.05, 0.14, '#6a5242'); }
    p.arch(19.4, 1.0, 4.7, 2.7, '#e4dcc9'); p.arch(19.4, 1.15, 4.45, 2.1, '#342a26'); p.line(19.4, 1.15, 19.4, 4.4, 0.08, '#6a4a34'); p.line(18.35, 3.3, 20.45, 3.3, 0.08, '#6a4a34');
    for (const [x, s] of [[15, 1], [23.8, -1]]) for (let j = 0, y = 5.7; y < 17.2; y += 0.46, j++) p.R(Math.min(x, x + s * (j % 2 ? 0.45 : 0.75)), y, Math.max(x, x + s * (j % 2 ? 0.45 : 0.75)), y + 0.38, WHSTONE);
  });
  whBrick(p, 24, 26, WHWH);
  p.clip(24, 0, 26, 18, () => { venetian(p, 25, 0.75, 1, 6.2, 8.5, 9.6, 10.3); venetian(p, 25, 0.75, 1, 12.5, 13.9, 14.8, 15.4); });
  whBrick(p, 26.2, 30.2, WHH);
  whParapet(p, 30.4, 0); whBaluster(p, 30.4, 1.4);
  p.wear(0, 0, 30.2, 18, 41, 0.07);
});
function buildWhitaker() {
  initShared(); WHA.define();
  const S = site(WH.p, [119, -694.05], [-0.37, -0.929]), { F, y0 } = S, A = WHA;
  begin(y0);
  // walls, edge by edge: 3 and 7 the wing fronts, 5 the middle, 4 and 6 the wings' inner sides, the rest plain brick
  for (let i = 0; i < S.pts.length; i++) {
    const E = S.wall(i);
    foot(E, S.lo - y0, '#aaa08e');
    if (i === 5) A.quad(E.M, -E.l / 2, E.l / 2, 0, WHH, 0, 0, 0, { uw: 14.9 });
    else if (i === 3 || i === 7) A.quad(E.M, -E.l / 2, E.l / 2, 0, WHWH, 0, 15, 0, { uw: 8.8 });
    else if (i === 4 || i === 6) A.quad(E.M, -E.l / 2, E.l / 2, 0, WHWH, 0, 24, 0, { uw: 2 });
    else if (i === 2 || i === 8) bays(A, E, 0, WHWH, 26.2, 18 - WHWH, 4);
    else bays(A, E, 0, WHH, 26.2, 0, 4);
    const top = [2, 3, 4, 6, 7, 8].includes(i) ? WHWH : WHH;
    bx('flat', E.M, -E.l / 2 - 0.25, E.l / 2 + 0.25, top - 0.2, top + 0.12, -0.3, 0.38, { c: WHSTONE, noao: true });
  }
  prism('flat', S.pts, y0 + WHH - 0.1, y0 + WHH, { c: '#a8705a', noao: true });
  hip(F, -7.6, 7.6, -9.2, 0.15, WHH + 0.1, 2.2, '#c08766', '#ad775b');
  for (const s of [-1, 1]) hip(F, s < 0 ? -16.5 : 7.5, s < 0 ? -7.5 : 16.5, -8.6, 2.05, WHWH + 0.1, 2.0, '#c8906d', '#b47d5f');
  // the long balcony of the middle with its pierced parapet, on brackets
  const E5 = S.wall(5), M = E5.M, hw = E5.l / 2 - 0.1;
  bx('flat', M, -hw, hw, 5.55, 5.85, 0, 1.15, { c: WHSTONE, noao: true });
  for (let x = -hw; x < hw - 0.1; x += 3) A.quad(M, x, Math.min(hw, x + 3), 5.85, 6.95, 1.12, 30.4, 0);
  bx('flat', M, -hw, hw, 6.92, 7.02, 0.98, 1.16, { c: WHSTONE, noao: true });
  for (let i = 0; i < 7; i++) { const x = -hw + 0.4 + i * (2 * hw - 0.8) / 6; bx('flat', M, x - 0.14, x + 0.14, 4.85, 5.55, 0, 0.75, { c: '#c4b9a2', noao: true }); }
  // the small balcony of the top floor with the two flags
  bx('flat', M, -2.5, 2.5, 11.85, 12.05, 0, 0.75, { c: WHSTONE, noao: true });
  A.quad(M, -2.5, 2.5, 12.05, 12.95, 0.73, 30.4, 1.4, { uw: 3, vh: 1.1 });
  for (const x of [-1.8, 0, 1.8]) bx('flat', M, x - 0.12, x + 0.12, 11.35, 11.85, 0, 0.55, { c: '#c4b9a2', noao: true });
  for (const [x, cols] of [[-1.6, ['#2f7d4a', '#eeeae0', '#bb3a33']], [1.4, ['#20449a', '#20449a', '#20449a']]]) {
    bx('flat', M, x - 0.03, x + 0.03, 12.9, 16.1, 0.72, 0.78, { c: '#4a4640', noao: true });
    cols.forEach((c, k) => bx('flat', M, x + 0.04 + k * 0.33, x + 0.37 + k * 0.33, 13.9, 15.95, 0.73, 0.77, { c, noao: true }));
  }
  for (const x of [1.77, 2.1]) bx('flat', M, x - 0.06, x + 0.06, 14.9 + (x - 1.77), 15.02 + (x - 1.77), 0.77, 0.79, { c: '#e8c93c', noao: true });
  // a balustraded balcony on each wing
  for (const i of [3, 7]) {
    const E = S.wall(i);
    bx('flat', E.M, -2.9, 2.9, 5.6, 5.85, 0, 1.0, { c: WHSTONE, noao: true });
    for (const x of [-2.9, 0]) A.quad(E.M, x, x + 2.9, 5.85, 6.9, 0.98, 30.4, 1.4, { vh: 1.1 });
    for (const s of [-1, 1]) A.quad(mul(E.M, mul(tr(s * 2.88, 0, 0.49), new THREE.Matrix4().makeRotationY(s * PI / 2))), -0.48, 0.48, 5.85, 6.9, 0, 30.4, 1.4);
    bx('flat', E.M, -2.95, 2.95, 6.88, 6.98, 0.86, 1.04, { c: WHSTONE, noao: true });
    for (const x of [-2.4, -0.8, 0.8, 2.4]) bx('flat', E.M, x - 0.14, x + 0.14, 4.95, 5.6, 0, 0.7, { c: '#c4b9a2', noao: true });
  }
  // the street railing on Via Cavour and its gate
  const fo = { wh: 1.2, rh: 2.1, wc: '#a99877', cap: '#c2b496', pier: [4, 0.55, 3.2, '#b5a688'], step: 4.2 };
  fenceRun(WHF1, WHOUT, fo); fenceRun(WHF2, WHOUT, fo); gate(WHG[0], WHG[1], WHOUT, 3.0);
  for (const q of [WHG[0]]) { const gy = groundY(q[0], q[1]), Mq = frame(q[0], gy, q[1], -0.19, -0.98); bx('flat', Mq, -0.35, 0.35, -0.5, 3.6, -0.35, 0.35, { c: '#b5a688' }); pyramid('flat', 0.6, 0.6, 0.55, { M: Mq, p: [0, 3.6, 0], c: '#b5a688', noao: true }); }
  const o = end('Villa Whitaker');
  o.userData.solids = [[WH.p, null, y0 + WHH]];
  return o;
}

// =====================================================================================================
// Villa Zito, Via della Libertà
// =====================================================================================================
const ZI = { id: 'w25170515', p: [-1076.9, -2086.2, -1068.8, -2060.9, -1061.1, -2036.9, -1076.1, -2032.4, -1091.1, -2081.7] };
const ZIH = 17.2, ZIOCHRE = '#d6ae6e', ZITRIM = '#e0bd82', ZIGREEN = '#2f5545';
// the main block stops 5 m short of the south end: the terrace and the loggia take that strip
const ZIS1 = [-1062.6, -2041.7], ZIS2 = [-1077.6, -2037.2], ZIX0 = -20.9, ZIX1 = 25.9, ZIN = 9;
// the garden railing along the street: a point s metres along it
const ziAt = s => [-1059.3 + s * 0.453, -2069.6 + s * 0.892];
const ZIF1 = [[-1076.9, -2086.2], ziAt(-28), ziAt(-1.5)], ZIF2 = [ziAt(3.5), ziAt(40)], ZIOUT = [-1030, -2072], ZIFN = [-1057.5, -2046.4];
const ziRing = Array.from({ length: 9 }, (_, i) => [ZIFN[0] + Math.cos(i * PI / 4) * 2.1, ZIFN[1] + Math.sin(i * PI / 4) * 2.1]);
function ziStone(p, x0, x1) {
  const { R } = p;
  R(x0, 0, x1, 17.4, ZIOCHRE);
  for (let y = 0.7; y < 6.0; y += 0.43) { R(x0, y, x1, y + 0.1, 'rgba(110,70,30,0.42)'); R(x0, y + 0.1, x1, y + 0.16, 'rgba(255,236,190,0.35)'); }
  for (let y = 6.5; y < 15.6; y += 0.4) R(x0, y, x1, y + 0.04, 'rgba(120,80,35,0.22)');
  R(x0, 0, x1, 0.7, '#a9a295');
  for (const [y, t] of [[5.9, 0.45], [11.35, 0.35], [15.6, 0.18], [16.55, 0.14]]) { R(x0, y, x1, y + t, ZITRIM); R(x0, y - 0.09, x1, y, 'rgba(80,45,15,0.4)'); }
  R(x0, 16.7, x1, 17.4, '#cfa563'); for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.52) { R(x, 16.72, x + 0.18, 17.1, '#e8c98e'); R(x + 0.18, 16.72, x + 0.25, 17.1, 'rgba(70,40,15,0.5)'); }
}
function ziShutters(p, x, y0, y1, w) { const { R } = p; R(x - w / 2, y0, x + w / 2, y1, ZIGREEN); R(x - 0.025, y0, x + 0.025, y1, '#16291f'); for (let y = y0 + 0.12; y < y1; y += 0.16) R(x - w / 2 + 0.07, y, x + w / 2 - 0.07, y + 0.05, '#1f3b30'); R(x - w / 2, y0 + (y1 - y0) * 0.62, x + w / 2, y0 + (y1 - y0) * 0.62 + 0.06, '#16291f'); }
// atlas, in metres: a bay of the front 0..5.2, a plain bay 5.4..10.6, the tufa of the garden wall 10.8..15 (below), the banner above it
const ZIA = atlas('v1Zito', 320, 384, 15, 17.4, (g, w, h, p) => {
  const { R, arch, line, ring, X, Y, sx, sy } = p;
  ziStone(p, 0, 5.2);
  p.clip(0, 0, 5.2, 17.4, () => {
    // ground floor: the arched french door with its voussoirs and open shutters
    for (let k = 0; k <= 12; k++) { const a = k * PI / 12; line(2.6 + Math.cos(a) * 0.95, 3.7 + Math.sin(a) * 0.95, 2.6 + Math.cos(a) * 1.75, 3.7 + Math.sin(a) * 1.75, 0.07, 'rgba(100,60,25,0.6)'); }
    arch(2.6, 0.35, 4.75, 2.05, '#e6c58c'); arch(2.6, 0.35, 4.58, 1.72, ZIGREEN); arch(2.6, 0.35, 4.35, 0.95, '#26303a');
    R(2.575, 0.35, 2.625, 4.3, '#d8d2c0'); for (const y of [1.5, 2.6, 3.7]) R(2.13, y, 3.07, y + 0.05, '#d8d2c0'); for (let y = 0.5; y < 3.7; y += 0.17) { R(1.78, y, 2.08, y + 0.05, '#1f3b30'); R(3.12, y, 3.42, y + 0.05, '#1f3b30'); }
    // first floor: window with its segmental pediment
    R(1.6, 6.35, 3.6, 10.05, ZITRIM); R(1.75, 6.35, 3.45, 9.85, '#c99f5e'); ziShutters(p, 2.6, 6.35, 9.6, 1.4);
    R(1.45, 10.05, 3.75, 10.3, '#e8c98e'); R(1.5, 9.97, 3.7, 10.05, 'rgba(70,40,15,0.45)');
    g.fillStyle = '#e8c98e'; g.beginPath(); g.moveTo(X(1.45), Y(10.3)); g.quadraticCurveTo(X(2.6), Y(11.55), X(3.75), Y(10.3)); g.fill(); g.fillStyle = '#c99f5e'; g.beginPath(); g.moveTo(X(1.8), Y(10.34)); g.quadraticCurveTo(X(2.6), Y(11.12), X(3.4), Y(10.34)); g.fill();
    // second floor: window with a flat hood
    R(1.65, 11.75, 3.55, 14.75, ZITRIM); ziShutters(p, 2.6, 11.85, 14.5, 1.3); R(1.45, 14.85, 3.75, 15.1, '#e8c98e'); R(1.5, 14.75, 3.7, 14.85, 'rgba(70,40,15,0.45)');
    // the brackets under the two balconies
    for (const y of [6.16, 11.56]) for (const s of [-1, 1]) { R(2.6 + s * 0.95 - 0.12, y - 0.55, 2.6 + s * 0.95 + 0.14, y, '#e8c98e'); R(2.6 + s * 0.95 + 0.14, y - 0.55, 2.6 + s * 0.95 + 0.24, y - 0.04, 'rgba(70,40,15,0.5)'); }
    // frieze panels, the rusticated strip between the bays
    for (const x of [0.6, 3.2]) { R(x, 15.9, x + 1.4, 16.45, '#c99f5e'); R(x + 0.1, 16.0, x + 1.3, 16.35, ZITRIM); }
    for (let j = 0, y = 6.4; y < 15.4; y += 0.5, j++) for (const x of [0, 5.2]) { const t = j % 2 ? 0.24 : 0.36; R(x - t, y, x + t, y + 0.42, '#ddb878'); R(x - t, y, x + t, y + 0.05, 'rgba(90,55,20,0.4)'); }
  });
  ziStone(p, 5.4, 10.6);
  // tufa blocks
  R(10.8, 0, 15, 1.6, '#8f7442'); const r = RNG(77);
  for (let y = 0; y < 1.55; y += 0.38) for (let x = 10.8 - r() * 0.4; x < 15;) { const bw = 0.45 + r() * 0.45, c = ['#c9a45f', '#d3b06a', '#bd9857', '#c7a76b'][Math.floor(r() * 4)]; p.clip(10.8, 0, 15, 1.6, () => R(x + 0.02, y + 0.02, x + bw - 0.02, y + 0.35, c)); x += bw; }
  R(10.8, 1.38, 15, 1.6, '#c9a866');
  // the blue banner at the railing
  R(11, 2.2, 12.9, 6.0, '#c9cdd0'); R(11.1, 2.3, 12.8, 5.9, '#17354e'); g.fillStyle = '#f2efe6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(X(11.95), Y(4.8)); g.scale(sx / sy, 1); g.font = `${Math.round(0.34 * sy)}px serif`; g.fillText('villa Zito', 0, 0, 1.55 * sy); g.restore();
  for (let i = 0; i < 3; i++) R(11.35, 3.75 - i * 0.32, 12.4 - i * 0.12, 3.87 - i * 0.32, '#cfd8de');
  // the stone balusters of the terrace
  R(13.1, 2.2, 15, 3.15, '#8a6a3c'); R(13.1, 3.0, 15, 3.15, '#e8c98e'); R(13.1, 2.2, 15, 2.32, '#e8c98e'); for (let x = 13.18; x < 14.95; x += 0.38) { R(x, 2.32, x + 0.15, 3.0, '#e2c088'); R(x - 0.05, 2.45, x + 0.2, 2.65, '#e2c088'); }
  p.wear(0, 0, 10.6, 17.4, 51, 0.07); p.wear(10.8, 0, 15, 1.6, 52, 0.12);
});
function buildZito() {
  initShared(); ZIA.define();
  const S = site(ZI.p, [-1069, -2061.55], [0.952, -0.305]), { F, y0 } = S, A = ZIA;
  begin(y0);
  const main = [S.pts[0], S.pts[1], ZIS1, ZIS2, S.pts[4]];
  // the front, nine bays, each upper window with its iron balcony on two brackets
  const bw = (ZIX1 - ZIX0) / ZIN;
  for (let i = 0; i < ZIN; i++) {
    const x = ZIX0 + (i + 0.5) * bw;
    A.quad(F, x - bw / 2, x + bw / 2, 0, ZIH, 0.02, 0, 0, { uw: 5.2 });
    for (const y of [6.38, 11.78]) {
      bx('flat', F, x - 1.35, x + 1.35, y - 0.22, y, 0, 0.75, { c: ZITRIM, noao: true });
      for (const s of [-1, 1]) { panel('rail', 0.7, 1.0, { M: F, p: [x + s * 1.3, y, 0.37], ry: PI / 2, uvk: [0.7, 1], c: '#9aa0a8' }); }
      panel('rail', 2.6, 1.0, { M: F, p: [x, y, 0.72], uvk: [2.6, 1], c: '#9aa0a8' });
    }
  }
  const front = S.edge(S.pts[0], ZIS1, main); foot(front, S.lo - y0, '#a9a295');
  // the other walls stay plain stone
  for (const [a, b] of [[ZIS1, ZIS2], [ZIS2, S.pts[4]], [S.pts[4], S.pts[0]]]) { const E = S.edge(a, b, main); bays(A, E, 0, ZIH, 5.4, 0, 5.2); foot(E, S.lo - y0, '#a9a295'); }
  for (let i = 0; i < main.length; i++) {
    const E = S.edge(main[i], main[(i + 1) % main.length], main);
    bx('flat', E.M, -E.l / 2 - 0.5, E.l / 2 + 0.5, ZIH, ZIH + 0.28, -0.3, 0.7, { c: ZITRIM, noao: true });
    bx('flat', E.M, -E.l / 2 - 0.3, E.l / 2 + 0.3, ZIH + 0.28, ZIH + 0.62, -0.3, 0.5, { c: '#e8c98e', noao: true });
  }
  prism('flat', main, y0 + ZIH + 0.4, y0 + ZIH + 0.55, { c: '#a9805e', noao: true });
  hip(F, ZIX0 + 0.2, ZIX1 - 0.2, -14.9, -0.2, ZIH + 0.55, 2.2, '#bf7f58', '#ab6f4c');
  // the south end: a rounded terrace over the ground floor, the loggia above it
  const a = ZIS1, c = S.pts[2], d = S.pts[3], e = ZIS2, ux = (c[0] - a[0]) / Math.hypot(c[0] - a[0], c[1] - a[1]), uz = (c[1] - a[1]) / Math.hypot(c[0] - a[0], c[1] - a[1]), vx = (d[0] - c[0]) / Math.hypot(d[0] - c[0], d[1] - c[1]), vz = (d[1] - c[1]) / Math.hypot(d[0] - c[0], d[1] - c[1]);
  const R = 3, arc = Array.from({ length: 6 }, (_, i) => { const t = i / 5 * PI / 2; return [c[0] - ux * R * (1 - Math.sin(t)) + vx * R * (1 - Math.cos(t)), c[1] - uz * R * (1 - Math.sin(t)) + vz * R * (1 - Math.cos(t))]; });
  const terr = [a, ...arc, d, e];
  for (let i = 0; i + 1 < terr.length - 1; i++) {
    const E = S.edge(terr[i], terr[i + 1], terr);
    bays(A, E, 0, 6.0, 5.4, 0, 5.2); foot(E, S.lo - y0, '#a9a295');
    bx('flat', E.M, -E.l / 2 - 0.08, E.l / 2 + 0.08, 5.95, 6.35, -0.2, 0.3, { c: ZITRIM, noao: true });
    bx('flat', E.M, -E.l / 2 - 0.05, E.l / 2 + 0.05, 7.2, 7.36, -0.22, 0.06, { c: '#e8c98e', noao: true });
    const n = Math.ceil(E.l / 1.9); for (let k = 0; k < n; k++) A.quad(E.M, -E.l / 2 + k * E.l / n, -E.l / 2 + (k + 1) * E.l / n, 6.3, 7.22, -0.1, 13.1, 2.2, { uw: Math.min(1.9, E.l / n), vh: 0.95 });
  }
  // the arched doors of the south end and the corner front
  const ES = S.edge(arc[5], d, terr); for (const x of [-ES.l / 4, ES.l / 4]) A.quad(ES.M, x - 1.1, x + 1.1, 0, 5.2, 0.03, 1.5, 0);
  const EF = S.edge(a, arc[0], terr); if (EF.l > 1.2) A.quad(EF.M, -1.0, 1.0, 0, 5.2, 0.03, 1.6, 0);
  prism('flat', terr, y0 + 6.2, y0 + 6.3, { c: '#c3b393', noao: true });
  // loggia: pillars at the corners and two between, the roof over them with its attic
  const lg = [a, [c[0] - ux * 1.7 + vx * 1.2, c[1] - uz * 1.7 + vz * 1.2], [d[0] - ux * 1.7 - vx * 1.2, d[1] - uz * 1.7 - vz * 1.2], e];
  for (const t of [0.02, 0.34, 0.67, 0.98]) { const q = [lg[1][0] + (lg[2][0] - lg[1][0]) * t, lg[1][1] + (lg[2][1] - lg[1][1]) * t], M = frame(q[0], y0, q[1], ux, uz); bx('flat', M, -0.36, 0.36, 6.3, 11.4, -0.36, 0.36, { c: ZITRIM }); bx('flat', M, -0.48, 0.48, 11.15, 11.4, -0.48, 0.48, { c: '#e8c98e', noao: true }); bx('flat', M, -0.45, 0.45, 6.3, 6.75, -0.45, 0.45, { c: '#c99f5e' }); }
  prism('flat', lg, y0 + 11.4, y0 + 12.3, { c: ZIOCHRE, noao: true });
  for (let i = 0; i < 3; i++) { const E = S.edge(lg[i], lg[i + 1], lg); bx('flat', E.M, -E.l / 2 - 0.2, E.l / 2 + 0.2, 12.3, 12.55, -0.25, 0.3, { c: '#e8c98e', noao: true }); bx('flat', E.M, -E.l / 2, E.l / 2, 12.55, 13.45, -0.22, 0.02, { c: ZITRIM, noao: true }); }
  // the garden: tufa wall, railing and stone pillars on the street, the gate between two black lamp posts, the banner, the round basin
  const fo = { wh: 1.45, rh: 1.9, wc: '#bd9a5c', cap: '#cbab6e', rc: '#8a8f96', pier: [3, 0.62, 3.5, '#c2a46c'], step: 4.1, face: (M, x0, x1) => A.quad(M, x0, x1, 0, 1.45, 0.21, 10.8, 0, { uw: Math.min(4.2, x1 - x0), vh: 1.45 }) };
  fenceRun(ZIF1, ZIOUT, fo); fenceRun(ZIF2, ZIOUT, fo); gate(ZIF1[2], ZIF2[0], ZIOUT, 3.3);
  for (const s of [-1.2, 3.2]) { const q = ziAt(s), M = frame(q[0], groundY(q[0], q[1]), q[1], 0.892, -0.453); cyl('flat', 0.3, 0.34, 0.7, 6, { M, p: [0, 0, 0.15], c: '#c2a46c' }); cyl('flat', 0.12, 0.2, 3.8, 5, { M, p: [0, 0.7, 0.15], c: '#25272c', noao: true }); cyl('flat', 0.34, 0.14, 0.4, 6, { M, p: [0, 4.5, 0.15], c: '#25272c', noao: true }); sphere('flat', 0.22, { M, p: [0, 5.1, 0.15], seg: 6, c: '#d9d5c4', noao: true }); }
  const bq = ziAt(-9), BM = frame(bq[0], groundY(bq[0], bq[1]), bq[1], 0.892, -0.453);
  A.quad(BM, -0.95, 0.95, 1.9, 5.7, -0.3, 11, 2.2); bx('flat', BM, -0.95, 0.95, 1.9, 5.7, -0.33, -0.31, { c: '#10283c', noao: true }); for (const x of [-1.0, 1.0]) bx('flat', BM, x - 0.04, x + 0.04, 0, 5.8, -0.37, -0.31, { c: '#8a8e92', noao: true });
  const fy = groundY(ZIFN[0], ZIFN[1]);
  cyl('flat', 2.05, 2.1, 0.55, 12, { p: [ZIFN[0], fy - 0.05, ZIFN[1]], open: true, c: '#dcd8cc', noao: true }); cyl('flat', 1.85, 1.85, 0.44, 12, { p: [ZIFN[0], fy - 0.05, ZIFN[1]], c: '#4c6258', noao: true });
  const o = end('Villa Zito');
  o.userData.solids = [[main.flat(), null, y0 + ZIH]];
  return o;
}

// =====================================================================================================
// Villa Pajno, Via della Libertà 72
// =====================================================================================================
const PJ = { id: 'w35607584', p: [-1284.2, -2408.8, -1269.8, -2382.8, -1250.9, -2393.1, -1265.4, -2419.1] };
const PJW = '#cfb394', PJTRIM = '#dcc5a8', PJH = 12.4;
// The map draws a 2.3 m wall along the whole garden on Via della Libertà. In front of the villa the photo shows a low wall, an iron fence and a clipped hedge, so those 50 m (60 to 110 m along the
// mapped segment from PJA to PJB) are taken out of the map's wall and drawn here, on the same line.
const PJA = [-1200.1, -2340.8], PJB = [-1271.3, -2482.6], pjAt = t => { const l = Math.hypot(PJB[0] - PJA[0], PJB[1] - PJA[1]); return [PJA[0] + (PJB[0] - PJA[0]) * t / l, PJA[1] + (PJB[1] - PJA[1]) * t / l]; };
const PJF = [pjAt(60), pjAt(110)], PJOUT = [-1180, -2420];
function pjFences(list) {
  if (!list) return list;
  return list.flatMap(f => {
    const p = f.p;
    for (let i = 0; p && i + 3 < p.length; i += 2) if (Math.hypot(p[i] - PJA[0], p[i + 1] - PJA[1]) < 0.3 && Math.hypot(p[i + 2] - PJB[0], p[i + 3] - PJB[1]) < 0.3) return [{ ...f, p: [...p.slice(0, i + 2), ...PJF[0]] }, { ...f, p: [...PJF[1], ...p.slice(i + 2)] }];
    return [f];
  });
}
function pjBands(p, x0, x1) {
  const { R, arch, circ } = p;
  R(x0, 0, x1, 13.6, PJW);
  R(x0, 0, x1, 0.7, '#a9977f'); R(x0, 5.85, x1, 6.2, PJTRIM); R(x0, 5.76, x1, 5.85, 'rgba(80,50,30,0.35)'); R(x0, 10.95, x1, 11.07, PJTRIM);
  // the corbel table of little arches, the cornice, the pierced parapet
  R(x0, 11.35, x1, 12.25, PJTRIM); for (let x = x0 + 0.3; x < x1; x += 0.56) { arch(x, 11.35, 11.98, 0.42, '#9c8066'); arch(x + 0.03, 11.35, 11.9, 0.32, '#b89c7e'); }
  R(x0, 12.25, x1, 12.55, '#e4d0b4'); R(x0, 12.18, x1, 12.25, 'rgba(70,45,25,0.45)');
  R(x0, 12.55, x1, 13.6, '#d6bd9f'); for (let x = x0 + 0.28; x < x1; x += 0.5) { circ(x, 13.05, 0.2, '#7d6652'); circ(x, 13.05, 0.08, '#d6bd9f'); } R(x0, 13.42, x1, 13.6, '#e4d0b4');
}
// a pair of pointed lights under a round arch
function pjWindow(p, x, y0, ys, yt, w) {
  const { arch, R, poly, circ, ring } = p;
  arch(x, y0 - 0.1, yt + 0.28, w + 0.55, '#e2ccb0'); ring(x, yt + 0.28 - (w + 0.55) / 2, (w + 0.55) / 2, 0.07, '#9c8066', PI, 2 * PI); arch(x, y0, yt, w, '#bfa184');
  for (const s of [-1, 1]) { const m = x + s * w * 0.23, a = w * 0.17; poly([[m - a, y0], [m - a, ys - 0.1], [m - a * 0.6, ys + 0.28], [m, ys + 0.48], [m + a * 0.6, ys + 0.28], [m + a, ys - 0.1], [m + a, y0]], '#5a2f26'); R(m - 0.02, y0, m + 0.02, ys + 0.3, '#2c1712'); for (let y = y0 + 0.15; y < ys; y += 0.2) R(m - a, y, m + a, y + 0.04, '#46231c'); }
  R(x - 0.07, y0, x + 0.07, ys, '#e8d7be'); R(x - 0.14, ys - 0.12, x + 0.14, ys + 0.04, '#e8d7be'); circ(x, ys + 0.68, 0.15, '#9c8066'); R(x - w / 2 - 0.35, y0 - 0.2, x + w / 2 + 0.35, y0 - 0.05, '#e2ccb0');
}
// atlas, in metres: the front 0..29.8, a plain bay 30..36; at 36.2: the stone balustrade (below) and a 3 m length of the street wall (above)
const PJAT = atlas('v1Pajno', 768, 256, 39.4, 13.6, (g, w, h, p) => {
  const { R, line, ring, circ, poly } = p;
  pjBands(p, 0, 29.8);
  for (let i = -2; i <= 2; i++) { const x = 14.9 + i * 5.87; pjWindow(p, x, 7.2, 9.05, 10.35, 1.75); pjWindow(p, x, 1.4, 3.35, 4.65, 1.75); }
  for (const x of [14.9 - 2.93, 14.9 + 2.93]) { poly([[x, 10.65], [x + 0.45, 10.2], [x, 9.75], [x - 0.45, 10.2]], '#e4d0b4'); poly([[x, 10.45], [x + 0.25, 10.2], [x, 9.95], [x - 0.25, 10.2]], '#9c8066'); circ(x, 10.2, 0.09, '#e4d0b4'); }
  pjBands(p, 30, 36);
  R(36.2, 0, 39.2, 1.1, '#6f5c49'); R(36.2, 0.9, 39.2, 1.1, '#dcc9ad'); R(36.2, 0, 39.2, 0.18, '#dcc9ad'); for (let x = 36.45; x < 39.1; x += 0.5) { ring(x, 0.54, 0.2, 0.09, '#d4bfa3'); R(x - 0.27, 0.18, x - 0.19, 0.9, '#d4bfa3'); }
  R(36.2, 1.4, 39.2, 2.2, '#9d9684'); for (const x of [36.2, 37.7]) { R(x + 0.06, 1.48, x + 0.62, 2.1, '#cfc9ba'); R(x + 0.7, 1.46, x + 1.46, 2.12, '#a8a08c'); } R(36.2, 2.08, 39.2, 2.2, '#bdb5a2');
  p.wear(0, 0, 36, 13.6, 61, 0.06); p.wear(36.2, 1.4, 39.2, 2.2, 62, 0.2);
});
function buildPajno() {
  initShared(); PJAT.define();
  const S = site(PJ.p, [-1258.15, -2406.1], [0.873, -0.487]), { F, y0 } = S, A = PJAT;
  begin(y0);
  for (let i = 0; i < 4; i++) {
    const E = S.wall(i);
    if (i === 2) A.quad(E.M, -E.l / 2, E.l / 2, 0, 13.4, 0, 0, 0, { uw: 29.8, vh: 13.4 }); else bays(A, E, 0, 13.4, 30, 0, 6);
    foot(E, S.lo - y0, '#a9977f');
    bx('flat', E.M, -E.l / 2 - 0.2, E.l / 2 + 0.2, 12.3, 12.55, -0.2, 0.32, { c: '#e4d0b4', noao: true });
    bx('flat', E.M, -E.l / 2, E.l / 2, 13.3, 13.45, -0.3, 0.06, { c: '#e4d0b4', noao: true });
  }
  prism('flat', S.pts, y0 + PJH, y0 + PJH + 0.15, { c: '#b9876a', noao: true });
  // the set back attic with its railing and chimneys
  bx('flat', F, -8.6, 8.6, PJH, 14.4, -15, -5, { c: '#c4a68a', noao: true }); bx('flat', F, -8.8, 8.8, 14.4, 14.55, -15.2, -4.8, { c: '#dcc5a8', noao: true });
  panel('rail', 17.2, 0.8, { M: F, p: [0, 14.55, -5], uvk: [17.2, 1], c: '#8a8f96' });
  for (const x of [-8, -3.2, 3.4, 8]) bx('flat', F, x - 0.35, x + 0.35, 14.4, 15.5, -6.4, -5.8, { c: '#b9876a', noao: true });
  // the middle balcony on its brackets, the two flag staffs
  bx('flat', F, -3.0, 3.0, 5.9, 6.2, 0, 0.95, { c: '#dcc9ad', noao: true });
  for (const x of [-3, 0]) A.quad(F, x, x + 3, 6.2, 7.25, 0.92, 36.2, 0, { vh: 1.1 });
  for (const s of [-1, 1]) A.quad(mul(F, mul(tr(s * 2.98, 0, 0.46), new THREE.Matrix4().makeRotationY(s * PI / 2))), -0.46, 0.46, 6.2, 7.25, 0, 36.2, 0, { vh: 1.1 });
  bx('flat', F, -3.05, 3.05, 7.22, 7.32, 0.82, 0.99, { c: '#e4d0b4', noao: true });
  for (const x of [-2.4, -0.8, 0.8, 2.4]) bx('flat', F, x - 0.16, x + 0.16, 5.3, 5.9, 0, 0.7, { c: '#c4a68a', noao: true });
  for (const s of [-1, 1]) flagStaff(F, s * 0.25, 7.25, 0.85, s * 0.28);
  // the boundary on the street: low wall, iron fence, the hedge behind it
  const fo = { wh: 0.72, rh: 1.45, wc: '#9d9684', cap: '#bdb5a2', rc: '#6d737a', step: 3.0, face: (M, x0, x1) => A.quad(M, x0, x1, 0, 0.72, 0.21, 36.2, 1.4, { uw: Math.min(3, x1 - x0), vh: 0.8 }) };
  fenceRun(PJF, PJOUT, fo);
  const dx = PJF[1][0] - PJF[0][0], dz = PJF[1][1] - PJF[0][1], len = Math.hypot(dx, dz), r = RNG(9);
  for (let k = 0; k < 17; k++) {
    const q = [PJF[0][0] + dx * (k + 0.5) / 17, PJF[0][1] + dz * (k + 0.5) / 17], M = frame(q[0], groundY(q[0], q[1]), q[1], 0.894, -0.449), top = 2.3 + r() * 0.25;
    bx('flat', M, -len / 34 - 0.02, len / 34 + 0.02, 0.1, top - 0.2, -0.85, -0.22, { c: ['#5d8a45', '#679650', '#54803f'][k % 3], noao: true });
    bx('flat', M, -len / 34 - 0.02, len / 34 + 0.02, top - 0.2, top, -0.75, -0.32, { c: '#7aa95a', noao: true });
  }
  const o = end('Villa Pajno');
  o.userData.solids = [[PJ.p, null, y0 + PJH]];
  return o;
}
// a flag staff leaning out of a balcony
function flagStaff(M, x, y, z, lean) { bx('flat', mul(M, mul(tr(x, y, z), new THREE.Matrix4().makeRotationZ(-lean))), -0.025, 0.025, 0, 3.2, -0.025, 0.025, { c: '#c9c4b8', noao: true }); }

// =====================================================================================================
// Casina of Villa Trabia (the old foresteria), inside the park beside Via Piersanti Mattarella
// =====================================================================================================
const TR = { id: 'w375399756', p: [-1106.5, -1652.5, -1097.4, -1655.1, -1095.3, -1648.2, -1104.3, -1645.5] };
// atlas, in metres: a long side 0..9.4, a short side 9.6..16.9
const TRA = atlas('v1Casina', 256, 128, 17, 6.6, (g, w, h, p) => {
  const { R, poly } = p;
  R(0, 0, 17, 6.6, '#d8d2c2'); const r = RNG(91);
  for (let i = 0; i < 90; i++) { const x = r() * 17, y = r() * r() * 6.6, a = 0.15 + r() * 0.8; poly([[x, y], [x + a * 0.5, y - r() * 0.15], [x + a, y + r() * 0.25], [x + a * 0.8, y + 0.15 + r() * 0.5], [x + a * 0.3, y + 0.2 + r() * 0.55], [x - r() * 0.25, y + r() * 0.35]], r() < 0.5 ? 'rgba(140,125,100,0.12)' : 'rgba(236,232,220,0.22)'); }
  R(0, 0, 17, 0.5, 'rgba(110,96,76,0.6)'); R(0, 5.55, 17, 5.7, 'rgba(90,76,60,0.55)'); R(0, 6.1, 17, 6.25, 'rgba(90,76,60,0.35)');
  const win = (x, y, ww, hh) => { R(x - ww / 2 - 0.12, y - 0.12, x + ww / 2 + 0.12, y + hh + 0.12, '#b3a993'); R(x - ww / 2, y, x + ww / 2, y + hh, '#241d18'); R(x - 0.03, y, x + 0.03, y + hh * 0.75, '#5c4a38'); for (let k = 0; k < 3; k++) R(x - ww / 2 - 0.12 + k * 0.07, y + hh + 0.12 + k * 0.13, x + ww / 2 + 0.1 - k * 0.14, y + hh + 0.25 + k * 0.13, `rgba(55,42,32,${0.3 - k * 0.08})`); };
  for (const x of [2.4, 6.9]) win(x, 3.45, 0.95, 1.35);
  win(13.4, 3.4, 1.2, 1.4); win(14.0, 0.9, 1.2, 1.3);
  p.wear(0, 0, 17, 6.6, 92, 0.22);
});
function buildCasina() {
  initShared(); TRA.define();
  const S = site(TR.p, [-1105.4, -1649], [-0.954, 0.3]), { y0 } = S, A = TRA;
  begin(y0);
  for (let i = 0; i < 4; i++) {
    const E = S.wall(i), long = i % 2 === 0;
    A.quad(E.M, -E.l / 2, E.l / 2, 0, 6.2, 0, long ? 0 : 9.6, 0, { uw: long ? 9.4 : 7.3 });
    foot(E, S.lo - y0, '#9a8d76');
    bx('flat', E.M, -E.l / 2 - 0.18, E.l / 2 + 0.18, 5.62, 5.82, -0.15, 0.25, { c: '#bdb4a0', noao: true });
    bx('flat', E.M, -E.l / 2, E.l / 2, 6.18, 6.36, -0.28, 0.04, { c: '#c9c1ae', noao: true });
  }
  prism('flat', S.pts, y0 + 5.82, y0 + 5.9, { c: '#8d8578', noao: true });
  const o = end('Casina di Villa Trabia');
  o.userData.solids = [[TR.p, null, y0 + 5.9]];
  return o;
}

// =====================================================================================================
// Villino Favaloro, Piazza Virgilio
// =====================================================================================================
const FV = { id: 'w278804042', tid: 'w278805222', p: [-1110.9, -871.1, -1094.7, -868, -1097.5, -850.5, -1098.4, -850.7, -1112.7, -852.9, -1112.5, -854, -1113.3, -855.2] };
const FVH = 11.4, FVW = '#dedacd', FVG = '#8f9a90', FVT = [-1114.6, -853.7], FVR = 2.05;
// the garden railing on the three street sides of the mapped garden, with a closed gate facing the door
const FVF1 = [[-1118.6, -839], [-1082, -849.1], [-1080.1, -857.4]], FVG0 = [[-1080.1, -857.4], [-1079.4, -860.9]], FVF2 = [[-1079.4, -860.9], [-1077.7, -871.3], [-1110.8, -893.8]], FVOUT = [-1060, -835], FVOUT2 = [-1070, -895];
// the steps to the door and the iron and glass winter garden on the south side, both outside the footprint: their outlines in the frames of the east and south walls
const FVSTEP = [[-1.9, 0], [-1.9, 2.5], [1.9, 2.5], [1.9, 0]], FVGL = [[-6.2, 0], [-6.2, 3.4], [-2.5, 3.4], [-1.3, 5.0], [1.3, 5.0], [2.5, 3.4], [6.6, 3.4], [6.6, 0]];
const frameXZ = (O, N) => { const l = Math.hypot(N[0], N[1]), nx = N[0] / l, nz = N[1] / l; return ([x, z]) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz]; };
const FVE = frameXZ([-1096.1, -859.25], [0.987, 0.158]), FVS = frameXZ([-1105.55, -851.8], [-0.152, 0.988]);
const chain = (pts) => pts.slice(1).map((q, i) => [...pts[i], ...q]);
// a window with its pierced Liberty head and louvred shutters
function fvWindow(p, x, y0, y1, w, open) {
  const { R, ring, line, clip } = p;
  R(x - w / 2 - 0.16, y0 - 0.14, x + w / 2 + 0.16, y1 + 0.16, '#b7b3a6'); R(x - w / 2, y0, x + w / 2, y1, '#333b3c');
  const head = y1 - 0.65;
  clip(x - w / 2, head, x + w / 2, y1, () => { R(x - w / 2, head, x + w / 2, y1, '#5e6058'); for (const s of [-1, 0, 1]) ring(x + s * w / 2, head, w * 0.36, 0.07, '#e4e0d2'); line(x - w / 2, y1, x, head, 0.06, '#e4e0d2'); line(x + w / 2, y1, x, head, 0.06, '#e4e0d2'); });
  R(x - w / 2, head - 0.07, x + w / 2, head + 0.03, '#dcd8ca');
  for (let y = y0 + 0.12; y < head - 0.12; y += 0.17) R(x - w / 2 + 0.06, y, x + w / 2 - 0.06, y + 0.07, '#4a5652');
  R(x - 0.05, y0, x + 0.05, head, '#c9c5b6'); if (open) { R(x - w * 0.22, y0, x + w * 0.22, head, '#8d9aa0'); R(x - 0.03, y0, x + 0.03, head, '#3a4444'); }
  R(x - w / 2 - 0.25, y0 - 0.26, x + w / 2 + 0.25, y0 - 0.12, '#cfcbbd');
}
function fvWall(p, x0, x1) {
  const { R } = p;
  R(x0, 0, x1, 12.4, FVW);
  R(x0, 0, x1, 1.5, '#b4ad9c'); R(x0, 1.45, x1, 1.65, '#93998a');
  for (const y of [2.55, 3.85, 5.15]) R(x0, y, x1, y + 0.17, FVG);
  R(x0, 5.95, x1, 6.35, '#c7c1b0'); R(x0, 5.88, x1, 5.95, 'rgba(70,60,45,0.45)'); R(x0, 6.35, x1, 6.5, FVG);
  R(x0, 10.65, x1, 10.8, FVG); R(x0, 10.8, x1, 11.15, '#e8e4d6'); for (let x = x0 + 0.3; x < x1; x += 0.7) R(x, 11.15, x + 0.22, 11.4, '#b9b2a0');
}
const FVA = atlas('v1Fava', 912, 256, 45.6, 12.4, (g, w, h, p) => {
  const { R, arch, ring, circ, line, poly, clip } = p;
  // the east front: basement openings, two windows each side of the door in its pierced frame, a window each side of the loggia
  fvWall(p, 0, 17.7); const c = 8.85;
  for (const d of [-6.3, -3.4, 3.4, 6.3]) { fvWindow(p, c + d, 2.2, 5.35, 1.3); R(c + d - 0.55, 0.35, c + d + 0.55, 1.0, '#4a443a'); }
  for (const d of [-6.5, 6.5]) fvWindow(p, c + d, 6.85, 10.2, 1.3);
  R(c - 1.4, 1.5, c + 1.4, 5.75, '#cbc6b6'); R(c - 1.2, 3.95, c + 1.2, 5.65, '#6a6a60');
  clip(c - 1.2, 3.95, c + 1.2, 5.65, () => { for (const s of [-1, 1]) { ring(c + s * 1.2, 5.65, 0.75, 0.1, '#ece8da'); ring(c + s * 1.2, 3.95, 0.6, 0.09, '#ece8da'); line(c + s * 1.2, 4.7, c, 5.65, 0.08, '#ece8da'); } ring(c, 4.55, 0.42, 0.1, '#ece8da'); R(c - 1.2, 5.12, c + 1.2, 5.2, '#ece8da'); });
  circ(c, 4.55, 0.3, '#b9ad92'); R(c - 0.8, 1.5, c + 0.8, 3.95, '#40595c'); R(c - 0.03, 1.5, c + 0.03, 3.95, '#1f2f31'); for (const s of [-1, 1]) { R(c + s * 0.4 - 0.27, 2.2, c + s * 0.4 + 0.27, 3.7, '#7f8f8c'); line(c + s * 0.4, 2.2, c + s * 0.55, 3.7, 0.05, '#2c4043'); line(c + s * 0.4, 2.2, c + s * 0.25, 3.7, 0.05, '#2c4043'); }
  // the back wall of the loggia: ochre with painted ornament and three red doors
  R(18, 0, 27.2, 4.5, '#c9a867'); R(18, 3.55, 27.2, 3.75, '#9c5a38'); R(18, 4.15, 27.2, 4.5, '#a8784a'); for (let x = 18.35; x < 27; x += 0.62) { ring(x, 3.95, 0.14, 0.05, '#6f8a62'); }
  for (const x of [20, 22.6, 25.2]) { R(x - 0.7, 0, x + 0.7, 3.15, '#d9c48c'); R(x - 0.52, 0, x + 0.52, 2.95, '#7c2f2a'); R(x - 0.34, 0.9, x - 0.06, 2.75, '#9aa6a8'); R(x + 0.06, 0.9, x + 0.34, 2.75, '#9aa6a8'); poly([[x - 0.7, 3.15], [x, 3.5], [x + 0.7, 3.15]], '#a8663c'); }
  // the turret's painted tile frieze, and a bay of the winter garden's iron and frosted glass
  R(18, 4.8, 19.7, 5.6, '#c9a548'); R(18.08, 4.9, 19.62, 5.5, '#e6d58a'); for (let x = 18.3; x < 19.6; x += 0.38) { circ(x, 5.2, 0.15, '#4f7a46'); circ(x, 5.2, 0.06, '#e6d58a'); }
  R(20, 4.8, 23, 9.0, '#26302e'); for (let i = 0; i < 4; i++) { const x = 20.06 + i * 0.735; R(x, 4.9, x + 0.68, 5.65, '#39423e'); for (const [a, b] of [[5.75, 7.5], [7.58, 8.4]]) R(x, a, x + 0.68, b, i % 2 ? '#9fb2ac' : '#adbfb8'); ring(x + 0.34, 8.62, 0.17, 0.05, '#79867f'); }
  // the west side: louvred shutters, in one bay the door
  for (const [u, door] of [[27.6, 0], [33.4, 1]]) {
    fvWall(p, u, u + 5.4); const m = u + 2.7;
    fvWindow(p, m, 6.85, 10.2, 1.35, true); for (const s of [-1, 1]) { R(m + s * 1.15 - 0.34, 6.85, m + s * 1.15 + 0.34, 9.55, '#2f3634'); for (let y = 7.0; y < 9.4; y += 0.17) R(m + s * 1.15 - 0.28, y, m + s * 1.15 + 0.28, y + 0.06, '#515a56'); }
    if (door) { R(m - 1.05, 0, m + 1.05, 4.5, '#bdb7a5'); R(m - 0.8, 0, m + 0.8, 4.25, '#4a382a'); R(m - 0.03, 0, m + 0.03, 4.25, '#241a12'); R(m - 0.65, 3.4, m + 0.65, 4.1, '#2c3432'); } else fvWindow(p, m, 2.0, 5.3, 1.35);
  }
  fvWall(p, 39.2, 43.2);
  // a face of the turret
  fvWall(p, 43.6, 45.3); fvWindow(p, 44.45, 7.4, 10.3, 1.0); R(43.6, 11.4, 45.3, 12.4, '#d9d4c4'); ring(44.45, 11.85, 0.32, 0.07, '#9c9684'); fvWindow(p, 44.45, 2.2, 5.0, 0.8);
  p.wear(0, 0, 17.7, 12.4, 71, 0.09); p.wear(27.6, 0, 45.3, 12.4, 72, 0.12);
});
function buildFavaloro() {
  initShared(); FVA.define();
  const S = site(FV.p, [-1096.1, -859.25], [0.987, 0.158]), { F, y0 } = S, A = FVA, hw = 8.85, LX = 4.6, L0 = 6.4, L1 = 10.65, white = '#e6e2d4';
  begin(y0);
  const E = S.wall(1), k = E.l / 17.7;
  for (const [x0, x1, a, b] of [[-hw, hw, 0, L0], [-hw, -LX, L0, L1], [LX, hw, L0, L1], [-hw, hw, L1, FVH]]) A.quad(E.M, x0 * k, x1 * k, a, b, 0, x0 + hw, a, { uw: x1 - x0 });
  // the loggia: back wall, sides, floor and ceiling, a low parapet, six slender columns under pierced arches
  A.quad(E.M, -LX, LX, L0, L1, -1.3, 18, 0, { uw: 9.2, vh: 4.4 });
  for (const s of [-1, 1]) bx('flat', E.M, s * LX - 0.08, s * LX + 0.08, L0, L1, -1.3, -0.01, { c: '#cdbf99', noao: true });
  bx('flat', E.M, -LX, LX, L0 - 0.12, L0, -1.3, 0.12, { c: white, noao: true }); bx('flat', E.M, -LX, LX, L1, L1 + 0.08, -1.3, 0.05, { c: '#cfc8b4', noao: true });
  bx('flat', E.M, -LX, LX, L0, L0 + 0.62, -0.06, 0.06, { c: white, noao: true });
  const step = 2 * LX / 5, sh = new THREE.Shape(); sh.moveTo(-LX, L1); sh.lineTo(-LX, 9.15);
  for (let i = 0; i < 5; i++) { const a = -LX + i * step + 0.1, b = a + step - 0.2, m = (a + b) / 2; sh.lineTo(a, 9.15); sh.quadraticCurveTo(a + 0.02, 9.9, a + 0.45, 9.8); sh.quadraticCurveTo(m - 0.3, 10.45, m, 10.42); sh.quadraticCurveTo(m + 0.3, 10.45, b - 0.45, 9.8); sh.quadraticCurveTo(b - 0.02, 9.9, b, 9.15); }
  sh.lineTo(LX, 9.15); sh.lineTo(LX, L1); sh.closePath();
  extrude('flat', sh, 0.12, { cs: 3, M: E.M, p: [0, 0, -0.04], c: white, noao: true });
  for (let i = 0; i <= 5; i++) { const x = Math.max(-LX + 0.1, Math.min(LX - 0.1, -LX + i * step)); cyl('flat', 0.075, 0.095, 2.2, 6, { M: E.M, p: [x, L0 + 0.62, 0.02], c: white, noao: true }); bx('flat', E.M, x - 0.14, x + 0.14, 9.0, 9.18, -0.12, 0.16, { c: white, noao: true }); }
  // the steps to the door with their side walls
  for (let i = 0; i < 7; i++) bx('flat', E.M, -1.55, 1.55, -0.3, 1.5 - i * 0.215, i * 0.34, (i + 1) * 0.34, { c: i % 2 ? '#cfc9b9' : '#c2bcac', noao: true });
  for (const s of [-1, 1]) { bx('flat', E.M, s * 1.72 - 0.17, s * 1.72 + 0.17, -0.3, 0.75, 0, 2.5, { c: '#b9b2a0' }); extrude('flat', shapeFrom([[0, 0.75], [2.5, 0.75], [0, 1.9]]), 0.34, { M: mul(E.M, mul(tr(s * 1.72 + 0.17, 0, 0), new THREE.Matrix4().makeRotationY(-PI / 2))), c: '#c9c3b2', noao: true }); }
  // the other walls
  for (const i of [0, 2, 3, 4, 5, 6]) {
    const W = S.wall(i); foot(W, S.lo - y0, '#aaa392');
    if (i === 6) { const n = 3, s = W.l / n; for (let j = 0; j < n; j++) A.quad(W.M, -W.l / 2 + j * s, -W.l / 2 + (j + 1) * s, 0, FVH, 0, j === 1 ? 33.4 : 27.6, 0, { uw: 5.4 }); }
    else if (i === 3) bays(A, W, 0, FVH, 27.6, 0, 5.4); else bays(A, W, 0, FVH, 39.2, 0, 4);
  }
  foot(E, S.lo - y0, '#aaa392');
  for (const i of [0, 1, 3, 6]) { const W = S.wall(i); bx('flat', W.M, -W.l / 2 - 0.55, W.l / 2 + 0.55, FVH, FVH + 0.22, -0.2, 0.75, { c: '#c9c1ac', noao: true }); bx('flat', W.M, -W.l / 2 - 0.35, W.l / 2 + 0.35, FVH + 0.22, FVH + 0.42, -0.2, 0.55, { c: white, noao: true }); }
  prism('flat', S.pts, y0 + FVH + 0.15, y0 + FVH + 0.3, { c: '#a66a4c', noao: true });
  hip(F, -8.3, 8.3, -15.0, -0.3, FVH + 0.4, 2.1, '#bd7453', '#a96446');
  // the glass and iron canopy over the west door
  const W6 = S.wall(6);
  box('flat', 3.2, 0.07, 1.7, { M: W6.M, p: [0, 4.7, 0.8], rx: 0.22, c: '#cdbd7c', noao: true });
  for (const x of [-1.55, -0.52, 0.52, 1.55]) box('flat', 0.07, 0.1, 1.75, { M: W6.M, p: [x, 4.74, 0.8], rx: 0.22, c: '#3a3c36', noao: true });
  for (const x of [-1.55, 1.55]) box('flat', 0.06, 0.06, 1.55, { M: W6.M, p: [x, 4.0, 0.68], rx: -0.55, c: '#3a3c36', noao: true });
  // the winter garden: frosted glass in iron on a dark base, pitched glass roofs up to the wall
  const G = frame(FVS([0, 0])[0], y0, FVS([0, 0])[1], -0.152, 0.988);
  for (let i = 1; i + 2 < FVGL.length + 1 && i < FVGL.length; i++) {
    const a = FVGL[i - 1], b = FVGL[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), W = S.edge(FVS(a), FVS(b), FVGL.map(FVS));
    for (let j = 0, n = Math.max(1, Math.round(l / 3)); j < n; j++) A.quad(W.M, -l / 2 + j * l / n, -l / 2 + (j + 1) * l / n, 0, 4.2, 0, 20, 4.8, { uw: Math.min(3, l / n) });
    bx('flat', W.M, -l / 2, l / 2, -1.0, 0.02, -0.12, 0.04, { c: '#8f897a', noao: true });
    bx('flat', W.M, -l / 2 - 0.08, l / 2 + 0.08, 4.18, 4.32, -0.1, 0.14, { c: '#2b3230', noao: true });
  }
  const top = x => [x, 5.7, 0.02], eave = ([x, z]) => [x, 4.3, z];
  const g = FVGL.map(eave), ridge = FVGL.map(q => top(q[0]));
  for (let i = 1; i < FVGL.length - 2; i++) {
    const t = [[g[i], g[i + 1], ridge[i + 1]], [g[i], ridge[i + 1], ridge[i]]];
    roofTris(G, t, i % 2 ? '#8fa39d' : '#9db0a9');
    box('flat', 0.08, 0.08, Math.hypot(g[i][2], 1.4), { M: G, p: [g[i][0], 4.96, g[i][2] / 2], rx: Math.atan2(1.4, g[i][2]), c: '#2b3230', noao: true });
  }
  roofTris(G, [[g[0], g[1], ridge[1]], [g[g.length - 2], g[g.length - 1], ridge[g.length - 2]]], '#8fa39d');
  // the octagonal turret: shaft, open loggia on eight shafts, tiled frieze, bracketed cornice and its crest
  const T = (x, y, z) => frame(FVT[0] + x, y0 + y, FVT[1] + z, 0, 1), side = 2 * FVR * Math.sin(PI / 8), ap = FVR * Math.cos(PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4 + 0.17, nx = Math.sin(a), nz = Math.cos(a), M = frame(FVT[0] + nx * ap, y0, FVT[1] + nz * ap, nx, nz);
    A.quad(M, -side / 2, side / 2, 0, 12.4, 0, 43.6, 0, { uw: 1.7 });
    bx('flat', M, -side / 2, side / 2, S.lo - y0, 0, -0.2, 0, { c: '#aaa392', noao: true });
    const q = new THREE.Shape(), hs = side / 2 - 0.05; [[-hs, 15.7], [-hs, 14.2], [-hs * 0.78, 14.75], [-hs * 0.45, 14.8], [-hs * 0.3, 15.28], [0, 15.5], [hs * 0.3, 15.28], [hs * 0.45, 14.8], [hs * 0.78, 14.75], [hs, 14.2], [hs, 15.7]].forEach((v, k) => k ? q.lineTo(v[0], v[1]) : q.moveTo(v[0], v[1])); q.closePath();
    extrude('flat', q, 0.12, { M, p: [0, 0, -0.18], c: '#d6bfa0', noao: true });
    bx('flat', M, -side / 2, side / 2, 12.4, 13.0, -0.16, -0.06, { c: '#ded6c4', noao: true });
    A.quad(M, -side / 2 - 0.03, side / 2 + 0.03, 15.7, 16.45, 0.03, 18, 4.8, { uw: 1.7, vh: 0.8 });
    const v = a + PI / 8, vx = FVT[0] + Math.sin(v) * (FVR - 0.12), vz = FVT[1] + Math.cos(v) * (FVR - 0.12);
    bx('flat', frame(vx, y0 + 12.4, vz, Math.sin(v), Math.cos(v)), -0.12, 0.12, 0, 3.3, -0.12, 0.12, { c: '#e0d8c6', noao: true });
    cone('flat', 0.2, 1.05, 5, { p: [FVT[0] + Math.sin(v) * (FVR + 0.15), y0 + 17.0, FVT[1] + Math.cos(v) * (FVR + 0.15)], c: '#b59a7c', noao: true });
    cone('flat', 0.15, 0.6, 3, { p: [FVT[0] + nx * (ap + 0.17), y0 + 17.0, FVT[1] + nz * (ap + 0.17)], c: '#b59a7c', noao: true });
  }
  const O8 = (r, y, h, c) => cyl('flat', r, r, h, 8, { M: T(0, y, 0), t0: 0.17 + PI / 8, c, noao: true });
  O8(FVR + 0.22, 12.15, 0.28, '#cfc6b2'); O8(FVR - 0.05, 15.65, 0.8, '#bfae8c'); O8(FVR + 0.42, 16.45, 0.25, '#c7b393'); O8(FVR + 0.25, 16.7, 0.32, '#b59a7c');
  // the street railing on stone pillars
  const fo = { wh: 0.7, rh: 1.75, wc: '#a39a86', cap: '#bdb5a0', pier: [3, 0.5, 2.8, '#b3aa94'], step: 5.5 };
  fenceRun(FVF1, FVOUT, fo); fenceRun(FVF2, FVOUT2, fo); gate(FVG0[0], FVG0[1], FVOUT, 2.7);
  const o = end('Villino Favaloro');
  o.userData.solids = [[FV.p, null, y0 + FVH]];
  return o;
}
const FVWALLS = [
  ...fenceWalls(FVF1, FVOUT), ...fenceWalls(FVG0, FVOUT, 0.06), ...fenceWalls(FVF2, FVOUT2),
  ...chain(FVSTEP.map(FVE)), ...chain(FVGL.map(FVS)),
  ...chain(Array.from({ length: 9 }, (_, i) => { const a = i * PI / 4 + 0.17 + PI / 8; return [FVT[0] + Math.sin(a) * FVR, FVT[1] + Math.cos(a) * FVR]; })),
];

// =====================================================================================================
// Villa Airoldi, Via Leoni
// =====================================================================================================
const AI = { id: 'w223970240', p: [-1393.5, -3415.4, -1419.7, -3391.3, -1416.8, -3388.1, -1430.8, -3375.2, -1386.8, -3328.1, -1344.7, -3366.7, -1350, -3372.4, -1360.3, -3362.9, -1368.5, -3371.7, -1379.5, -3361.6, -1376.1, -3357.9, -1383.1, -3351.4, -1377.9, -3345.9, -1381.7, -3342.4, -1394.4, -3356, -1389.8, -3360.2, -1411, -3382.9, -1385.2, -3406.6] };
const AIH = 10.3, AIW = '#c39a7e', AIWHITE = '#e4ddcd', AIX = 5.5;
// two lengths of iron fence a little in front of the wall, at the sides of the portal (x along the front, z out of it)
const AIF = frameXZ([-1408.8, -3351.65], [-0.731, 0.682]), AIR = [[[AIX - 9.5, 1.35], [AIX - 3.4, 1.35]], [[AIX + 3.4, 1.35], [AIX + 9.5, 1.35]]], AIOUT = AIF([AIX, 8]);
function aiBay(p, x0, x1, pil) {
  const { R } = p;
  R(x0, 0, x1, 11.6, AIW);
  R(x0, 0, x1, 1.1, '#b9ab92'); R(x0, 5.1, x1, 5.45, AIWHITE); R(x0, 5.02, x1, 5.1, 'rgba(70,40,25,0.4)');
  for (const x of pil) { R(x - 0.36, 1.1, x + 0.36, 9.2, AIWHITE); R(x + 0.28, 1.1, x + 0.36, 9.2, 'rgba(110,85,65,0.35)'); R(x - 0.48, 8.75, x + 0.48, 8.95, '#cfc6b2'); }
  R(x0, 9.2, x1, 9.55, AIWHITE); R(x0, 9.55, x1, 9.95, '#d3c6ae'); R(x0, 9.95, x1, 10.35, AIWHITE); R(x0, 9.88, x1, 9.95, 'rgba(70,40,25,0.45)');
  R(x0, 10.35, x1, 11.6, '#d9d1c0'); for (let x = x0 + 0.5; x < x1 - 0.4; x += 1.25) R(x, 10.62, x + 0.75, 11.2, '#b7ac98'); R(x0, 11.42, x1, 11.6, AIWHITE);
}
// atlas, in metres: the portal bay 0..9, a plain bay 9.4..14.4; at 15: the stone balusters (below) and the golf club's board
const AIA = atlas('v1Airoldi', 384, 256, 18.4, 11.6, (g, w, h, p) => {
  const { R, arch, circ, line, poly, ring, X, Y, sx, sy } = p, c = 4.5;
  aiBay(p, 0, 9, [0.45, 1.5, 7.5, 8.55]);
  // the passage through the house: dark vault, the courtyard seen at its end, a fan light
  R(c - 1.85, 0, c + 1.85, 5.0, '#cfc4ae'); arch(c, 0, 4.75, 3.15, '#8f8472'); arch(c, 0, 4.55, 2.75, '#1c1815'); arch(c, 0, 2.75, 1.35, '#46513a'); arch(c, 0, 1.15, 1.3, '#a79a7e'); circ(c - 0.2, 2.0, 0.34, '#6d7f4c');
  for (let k = 1; k < 8; k++) { const a = k * PI / 8; line(c, 3.2, c + Math.cos(a) * 1.3, 3.2 + Math.sin(a) * 1.3, 0.05, '#8d8676'); } ring(c, 3.2, 1.33, 0.07, '#8d8676', PI, 2 * PI); R(c - 1.35, 3.16, c + 1.35, 3.24, '#8d8676');
  // the window over the balcony with its curved pediment
  R(c - 1.15, 5.75, c + 1.15, 8.45, AIWHITE); R(c - 0.8, 5.75, c + 0.8, 8.1, '#4c4034'); R(c - 0.03, 5.75, c + 0.03, 8.1, '#241c15'); for (let y = 5.95; y < 8.0; y += 0.18) { R(c - 0.74, y, c - 0.08, y + 0.06, '#6a5a46'); R(c + 0.08, y, c + 0.74, y + 0.06, '#6a5a46'); }
  R(c - 1.35, 8.45, c + 1.35, 8.65, '#efe9da'); g.fillStyle = '#efe9da'; g.beginPath(); g.moveTo(X(c - 1.35), Y(8.65)); g.quadraticCurveTo(X(c), Y(9.75), X(c + 1.35), Y(8.65)); g.fill(); g.fillStyle = '#b9ae98'; g.beginPath(); g.moveTo(X(c - 0.95), Y(8.7)); g.quadraticCurveTo(X(c), Y(9.35), X(c + 0.95), Y(8.7)); g.fill();
  aiBay(p, 9.4, 14.4, [9.9, 13.9]);
  R(15, 0, 18, 1.1, '#6d5b4c'); R(15, 0.92, 18, 1.1, '#e0d8c6'); R(15, 0, 18, 0.16, '#e0d8c6'); for (let x = 15.12; x < 18; x += 0.34) { R(x, 0.16, x + 0.12, 0.92, '#d6cdb9'); R(x - 0.04, 0.36, x + 0.16, 0.56, '#d6cdb9'); }
  R(15.1, 1.4, 17.1, 2.9, '#efece2'); circ(16.1, 2.5, 0.28, '#3f6b46'); circ(16.1, 2.5, 0.14, '#d9c768'); g.fillStyle = '#3c5a44'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(X(16.1), Y(1.9)); g.scale(sx / sy, 1); g.font = `bold ${Math.round(0.34 * sy)}px sans-serif`; g.fillText('GOLF CLUB', 0, 0); g.restore();
  p.wear(0, 0, 14.4, 11.6, 81, 0.2);
});
function buildAiroldi() {
  initShared(); AIA.define();
  const S = site(AI.p, [-1408.8, -3351.65], [-0.731, 0.682]), { F, y0 } = S, A = AIA, N = S.pts.length, hw = Math.hypot(44, 47.1) / 2;
  begin(y0);
  // the front: the portal bay, plain bays with their pilasters to both sides
  A.quad(F, AIX - 4.5, AIX + 4.5, 0, 11.6, 0.02, 0, 0);
  for (const [x0, x1] of [[-hw, AIX - 4.5], [AIX + 4.5, hw]]) { const n = Math.max(1, Math.round((x1 - x0) / 5)), s = (x1 - x0) / n; for (let i = 0; i < n; i++) A.quad(F, x0 + i * s, x0 + (i + 1) * s, 0, 11.6, 0.02, 9.4, 0, { uw: 5 }); }
  for (let i = 0; i < N; i++) {
    const E = S.wall(i), low = S.lo - y0;
    if (i !== 3) bays(A, E, 0, 11.6, 9.4, 0, 5);
    foot(E, low, '#a99a80');
    bx('flat', E.M, -E.l / 2 - 0.2, E.l / 2 + 0.2, 9.95, 10.3, -0.2, 0.42, { c: AIWHITE, noao: true });
    bx('flat', E.M, -E.l / 2, E.l / 2, 11.5, 11.66, -0.3, 0.1, { c: AIWHITE, noao: true });
  }
  prism('flat', S.pts, y0 + AIH, y0 + AIH + 0.15, { c: '#b07d61', noao: true });
  // busts and vases along the parapet over the pilasters
  for (let x = -hw + 2.5; x < hw - 1; x += 5) if (Math.abs(x - AIX) > 2.6) { cyl('flat', 0.14, 0.24, 0.45, 5, { M: F, p: [x, 11.6, -0.08], c: '#d8d1c0', noao: true }); pyramid('flat', 0.42, 0.34, 0.5, { M: F, p: [x, 12.05, -0.08], c: '#d8d1c0', noao: true }); }
  // the portal: two columns on pedestals, the balcony with its balusters
  for (const s of [-1, 1]) {
    const x = AIX + s * 2.2;
    bx('flat', F, x - 0.42, x + 0.42, -0.3, 0.95, 0, 0.9, { c: '#c9c0ac' }); cyl('flat', 0.24, 0.3, 3.7, 8, { M: F, p: [x, 0.95, 0.45], c: '#d9d3c4', noao: true });
    bx('flat', F, x - 0.42, x + 0.42, 4.65, 5.0, 0.03, 0.87, { c: AIWHITE, noao: true });
    A.quad(mul(F, mul(tr(AIX + s * 2.9, 0, 0.55), new THREE.Matrix4().makeRotationY(s * PI / 2))), -0.5, 0.5, 5.35, 6.4, 0, 15, 0, { vh: 1.1 });
  }
  bx('flat', F, AIX - 2.95, AIX + 2.95, 5.0, 5.35, 0, 1.1, { c: '#d6cdb9', noao: true });
  for (const x of [-2.9, 0]) A.quad(F, AIX + x, AIX + x + 2.9, 5.35, 6.4, 1.05, 15, 0, { vh: 1.1 });
  bx('flat', F, AIX - 2.98, AIX + 2.98, 6.38, 6.5, 0.94, 1.12, { c: AIWHITE, noao: true });
  // a lantern on a bracket beside each column
  for (const s of [-1, 1]) { const x = AIX + s * 3.05; bx('flat', F, x - 0.03, x + 0.03, 4.35, 4.41, 0, 0.45, { c: '#2b2b2c', noao: true }); bx('flat', F, x - 0.18, x + 0.18, 3.8, 4.3, 0.3, 0.62, { c: '#33322f', noao: true }); pyramid('flat', 0.46, 0.42, 0.22, { M: F, p: [x, 4.3, 0.46], c: '#2b2b2c', noao: true }); }
  // the arms with the eagle over the portal
  const U = mul(F, tr(AIX, 0, -0.12));
  extrude('flat', shapeFrom([[-2.2, 11.55], [-1.7, 12.15], [-1.0, 12.0], [-0.9, 13.0], [-0.55, 13.35], [-0.2, 13.15], [0, 13.75], [0.25, 13.45], [0.55, 13.35], [0.9, 13.0], [1.0, 12.0], [1.7, 12.15], [2.2, 11.55]]), 0.3, { M: U, c: '#d9d3c4', noao: true });
  extrude('flat', shapeFrom([[-0.72, 12.75], [-0.62, 12.05], [0, 11.65], [0.62, 12.05], [0.72, 12.75], [0, 12.92]]), 0.1, { M: U, p: [0, 0, 0.3], c: '#eeeadf', noao: true });
  // the iron fences at the sides of the portal, the golf club's board on the southern one
  for (const run of AIR) fenceRun(run.map(AIF), AIOUT, { wh: 0.35, rh: 1.9, wc: '#b3a58c', pier: [9, 0.4, 2.5, '#c4b9a2'], step: 3.1 });
  const bd = AIF([AIX + 5.2, 1.35]), BM = frame(bd[0], y0, bd[1], -0.731, 0.682);
  A.quad(BM, -1.0, 1.0, 0.9, 2.4, 0.3, 15.1, 1.4, { uw: 2, vh: 1.5 }); bx('flat', BM, -1.0, 1.0, 0.9, 2.4, 0.24, 0.28, { c: '#c9c5ba', noao: true });
  const o = end('Villa Airoldi');
  o.userData.solids = [[AI.p, null, y0 + AIH]];
  return o;
}

export const R2_V1 = [
  { name: 'Villa Whitaker', x: 118, z: -705, radius: 60, skipIds: [WH.id], build: buildWhitaker, walls: [...fenceWalls(WHF1, WHOUT), ...fenceWalls(WHG, WHOUT, 0.06), ...fenceWalls(WHF2, WHOUT)] },
  { name: 'Villa Zito', x: -1065, z: -2062, radius: 60, skipIds: [ZI.id], build: buildZito, walls: [...fenceWalls(ZIF1, ZIOUT), ...fenceWalls([ZIF1[2], ZIF2[0]], ZIOUT, 0.06), ...fenceWalls(ZIF2, ZIOUT), ...ziRing.slice(1).map((q, i) => [...ziRing[i], ...q])] },
  { name: 'Villa Pajno', x: -1250, z: -2408, radius: 55, skipIds: [PJ.id], build: buildPajno, walls: fenceWalls(PJF, PJOUT), clearFences: pjFences },
  { name: 'Casina di Villa Trabia', x: -1101, z: -1650, radius: 20, skipIds: [TR.id], build: buildCasina },
  { name: 'Villino Favaloro', x: -1104, z: -861, radius: 50, skipIds: [FV.id, FV.tid], build: buildFavaloro, walls: FVWALLS },
  { name: 'Villa Airoldi', x: -1388, z: -3370, radius: 75, skipIds: [AI.id], build: buildAiroldi, walls: [...AIR.flatMap(r => chain([[r[0][0], 0], r[0], r[1], [r[1][0], 0]].map(AIF)))] },
];
