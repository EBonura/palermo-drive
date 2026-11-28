// Round 2 landmarks, batch V2: villas of the Piana dei Colli. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Layouts were checked against the 2013 regional orthophoto (SITR, Regione Siciliana).
// Each villa: one painted atlas (fronts and walls as panels on the footprint edges), flat coloured solids, and the shared balustrade cards.
//
// Villa Boscogrande (w191810308, gate on Via Tommaso Natale). Commons "Villa boscogrande.jpg" (2014, through the gate), "Villa Boscogrande.jpg" (2020, rear front),
//  "Palermo, Villa Montalbo Boscogrande.jpg" (1989). Read: ochre ashlar; a projecting middle block with an arched door under a curved double stair with stone balusters, three tall
//  openings in white frames over it, a cornice and a plain attic; lower wings with white shuttered windows and pairs of small square ones; on the garden side white ground floor with
//  relief panels, ochre paired pilasters, pedimented windows with iron balconies, a cornice, a parapet and a crest; the gate with two stone piers and the name in gilt letters over it.
//  Not verified: the end walls and the ground floor of the wings (left plain), the roofs, the number of bays, the garden wall beyond the two short stretches by the gate, the heights (estimated from the photos).
// Villa Lampedusa (via dei Quartieri 104; the group round w285429191, none of it named in the map data, identified by the courtyard plan and the end of the drive). balarm.it, article on the
//  eighteenth century villas of the Piana dei Colli (11 March 2024, three photos: the front, the courtyard from above, the open gate) and a photo on lasiciliainrete.it. Read: a two storey
//  front in white with ochre pilasters, pedimented windows, festoon panels, a middle door in an aedicule, a cornice, urns and a curved crest; a middle stair block with a door, two shell
//  niches, a terrace with a pale balustrade and a flight at each side; two low white wings coming forward; low houses with tile roofs round the courtyard; the gate between two pavilions.
//  The map gives most of the low houses 18 to 21 m: they are drawn at the one storey the photos show. Not verified: the back and ends (plain pedimented bays after the one distant photo),
//  the heights (estimated from the photos), which low houses have tiles, the gazebos and planting (left out).
// Villa Pantelleria (w280096427, vicolo Pantelleria). Photos on lasiciliainrete.it (page "Villa Pantelleria") and in the balarm.it article of July 2019 on its state. Read: an end front of two
//  storeys of broken plaster, below it a lower storey with arched windows and two doors that carries a stone balustrade (the mapped part, 5.3 m), three windows under broken scrolled
//  pediments, pilasters, a cornice and a balustrade with piers round the top; on the long front to its left windows with the same heads over swelling iron balconies; a tiled hip roof
//  (orthophoto). The mapped 21 m strip in front of the end is in no photo and is not drawn. Not verified: the other long front and the far end (plain; the mapped low strip there is left
//  to the generic builder), the number of bays, which end the photos show (taken to be the north-east one, where the map has a 5.3 m part), the original stair (lost in 1823).
// Villa Resuttano Terrasi (w223971359, by the Sacra Famiglia). One photo of the courtyard (balarm.it, article on the Vie dei Tesori villas, photo credited to Le Vie dei Tesori) and the
//  orthophoto. Read: the courtyard front in cream with ochre pilasters, a middle door in a tall frame reached by a double stair over an arch, a round window each side of it, balconies,
//  a cornice and a panelled parapet; the high wings with balconies; their ends one storey with a stone balustrade (the mapped parts give 14.4 and 5.9 m). Not verified: the outer faces
//  towards the road (plain), the left wing, which trees hide, the closing wall of the courtyard (left to the generic builder), which side of the courtyard is which (read from the mapped low parts).
// Villa Bordonaro ai Colli (w234822297, viale del Fante). Two photos on balarm.it (the courtyard front from the drive; the same front from an arm's terrace) and the orthophoto. Read:
//  salmon plaster with cream surrounds and green shutters; a main block with doors and small windows on three levels, three iron balconies, a middle storey rising as a low tower with
//  three windows, a long balcony and a pyramid of tiles; two one storey arms with balustraded terraces round the courtyard; the octagonal basin (mapped as water). Heights between the
//  mapped parts (10.9, 15.6, 4.1 and 4.6 m) and the photos. Not verified: the back, the ends and the faces of the arms (no openings drawn), the garden.
// The brick villa with a tower in the Commons photo "Villa Chiaramonte-Bordonaro a Palermo.jpg" does not match this villa and was not used (it may be the family's other house by the Giardino Inglese).
// Museo Pitre (w253476274 and w253476282, the service buildings beside the Palazzina Cinese). Commons "2012-11-03 Museo Pitre Ingresso" (the entrance), "Palermo23.jpg" (2007, the dome)
//  and the orthophoto. Read: a little pavilion at the south end of the long building, dark red below and orange above, two turrets with pagoda caps, a ribbed tent roof with a second pagoda,
//  a swelling iron balcony on two posts, pale green shutters, the court gate beside it; cream wings with green shutters; a round hall with a red and a green band, a shallow grey dome and a
//  spire of discs. Not verified: the outer and north faces (the cream bay repeated), the arched windows round the front block (one is seen), the heights beyond those mapped.
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, extrude, prism, panel, part, obb, begin, end, defMat, mul, tr, rotY, frame, groundY, groundRange, pairsOf, initShared, noiseDots, streaks, RNG } from './lmc-kit.js';
import { TREE_CLEAR } from './tree-clear.js';

// ---- shared helpers of this batch
const r1 = (v) => Math.round(v * 10) / 10;
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
// a flat coloured solid from a 2D outline in the frame M, from z0 to z1
const slab = (M, p, z0, z1, c) => extrude('flat', shapeOf(p), z1 - z0, { M, p: [0, 0, z0], c, noao: true });
const fb = (M, x0, x1, y0, y1, z0, z1, c) => bx('flat', M, x0, x1, y0, y1, z0, z1, { c, noao: true });
// a frame on the ground at O facing N: local x to the right as seen from the front, +z out; W gives world [x, z] of local (x, z)
const mapW = (O, N) => { const l = Math.hypot(N[0], N[1]), n = [N[0] / l, N[1] / l]; return Object.assign((x, z) => [O[0] + x * n[1] + z * n[0], O[1] - x * n[0] + z * n[1]], { n }); };
function place(O, N, pts) {
  const W = mapW(O, N), n = W.n;
  const y0 = groundY(O[0] + n[0], O[1] + n[1]), M = frame(O[0], y0, O[1], n[0], n[1]);
  const lo = (pts ? Math.min(groundRange(pts).lo, y0) : y0) - 1.5;
  return { W, y0, M, lo, n };
}
// world wall segments from a run of local points (these are asked for at load, before there is any ground)
const run = (W, L) => L.slice(1).map((b, i) => [...W(L[i][0], L[i][1]), ...W(b[0], b[1])]);
// the frame on the wall from a to b (world points), +z out of the polygon, and its length
function edge(poly, a, b, y) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  let nx = -dz / l, nz = dx / l; if (inPoly(poly, mx + nx * 0.25, mz + nz * 0.25)) { nx = -nx; nz = -nz; }
  return { M: frame(mx, y, mz, nx, nz), l };
}
// An atlas of painted wall pieces: list = [key of the piece, metres wide, metres high, px x, px y, painter(p)]; ppm pixels per metre.
// def() registers the material; card() puts a piece on a plane, wall() repeats it along a footprint edge.
function atlas(key, CW, CH, ppm, list) {
  const R = {};
  for (const [name, wm, hm, x, y] of list) R[name] = { wm, hm, x, y, w: Math.round(wm * ppm), h: Math.round(hm * ppm) };
  const paint = (g) => {
    g.fillStyle = '#c9b494'; g.fillRect(0, 0, CW, CH);
    for (const [name, wm, hm, , , f] of list) {
      const r = R[name], sx = r.w / wm, sy = r.h / hm;
      g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.translate(r.x, r.y);
      const X = (v) => (v + wm / 2) * sx, Y = (v) => r.h - v * sy;
      const p = {
        g, w: r.w, h: r.h, sx, sy, X, Y,
        R: (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); },
        poly: (q, c) => { g.fillStyle = c; g.beginPath(); q.forEach((v, i) => i ? g.lineTo(X(v[0]), Y(v[1])) : g.moveTo(X(v[0]), Y(v[1]))); g.closePath(); g.fill(); },
        arch: (x0, y0, y1, ww, c) => { const rr = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x0 - rr), Y(y0)); g.lineTo(X(x0 - rr), Y(y1 - rr)); g.ellipse(X(x0), Y(y1 - rr), rr * sx, rr * sy, 0, PI, 0); g.lineTo(X(x0 + rr), Y(y0)); g.fill(); },
        circ: (x0, y0, rr, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x0), Y(y0), rr * sx, rr * sy, 0, 0, 2 * PI); g.fill(); },
        line: (x0, y0, x1, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); },
      };
      f(p); g.restore();
    }
  };
  const def = () => defMat(key, CW, CH, [1, 1], paint);
  // the part u0..u1 (0..1 across), v0..v1 (0..1 up) of a piece on a plane w x h whose base centre is at (x, y, z) of M
  const card = (name, M, x, y, z, w, h, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
    const r = R[name], a = r.x + 0.5, ww = r.w - 1, b = CH - r.y - r.h + 0.5, hh = r.h - 1;
    panel(key, w, h, { M, p: [x, y, z], uvk: [ww * (u1 - u0) / CW, hh * (v1 - v0) / CH], uvo: [(a + ww * u0) / CW, (b + hh * v0) / CH] });
  };
  // the piece repeated along the edge a to b of poly, from height y up h metres (h defaults to the piece's own height; a lower wall takes the lower part)
  const wall = (name, poly, a, b, y, h) => {
    const E = edge(poly, a, b, y), r = R[name], hh = h || r.hm, n = Math.max(1, Math.round(E.l / r.wm)), bw = E.l / n;
    for (let i = 0; i < n; i++) card(name, E.M, -E.l / 2 + (i + 0.5) * bw, 0, 0, bw, hh, 0, 1, 0, Math.min(1, hh / r.hm));
  };
  return { def, card, wall, R };
}
// soft weathering over a piece: stains, streaks and grime at the foot
function wear(p, seed, n = 10, a = 0.1) {
  const { g, w, h } = p, r = RNG(seed);
  for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.22) * Math.max(w, h), k = r() < 0.6 ? '70,48,28' : '255,244,222', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${k},${a * (0.6 + r() * 0.8)})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, a, h * 0.18, '66,50,34');
  const gb = g.createLinearGradient(0, h, 0, h * 0.86); gb.addColorStop(0, 'rgba(45,32,20,0.26)'); gb.addColorStop(1, 'rgba(45,32,20,0)'); g.fillStyle = gb; g.fillRect(0, h * 0.86, w, h * 0.14);
}
// plaster or rough stone over a whole piece
function ground(p, c, seed, dots = 0.09) { p.g.fillStyle = c; p.g.fillRect(0, 0, p.w, p.h); noiseDots(p.g, p.w, p.h, p.w * p.h / 45, 2.2, seed, [`rgba(100,70,42,${dots})`, 'rgba(255,244,224,0.11)']); }
// squared blocks over a piece (course height in metres)
function blocks(p, x0, x1, y1, course, base, seed) {
  const r = RNG(seed);
  for (let y = 0; y < y1; y += course) for (let x = x0 - r() * 0.9; x < x1;) {
    const bw = 0.7 + r() * 0.8, k = r();
    p.R(Math.max(x0, x), y, Math.min(x1, x + bw - 0.05), Math.min(y1, y + course - 0.05), k < 0.25 ? 'rgba(150,92,50,0.20)' : k < 0.45 ? 'rgba(255,232,196,0.20)' : k < 0.55 ? 'rgba(110,76,48,0.14)' : base); x += bw;
  }
}
// a window: frame, dark glass, mullion and, if shut, slatted shutters of that colour
function win(p, x, y0, y1, w, o = {}) {
  const f = o.f === undefined ? 0.16 : o.f;
  if (f > 0) p.R(x - w / 2 - f, y0 - f, x + w / 2 + f, y1 + f, o.frame || '#e9e2d2');
  p.R(x - w / 2, y0, x + w / 2, y1, o.glass || '#2e343c');
  if (o.shut) { p.R(x - w / 2 + 0.03, y0 + 0.03, x + w / 2 - 0.03, y1 - 0.03, o.shut); for (let y = y0 + 0.12; y < y1; y += 0.16) p.R(x - w / 2 + 0.06, y, x + w / 2 - 0.06, y + 0.045, 'rgba(0,0,0,0.28)'); p.R(x - 0.025, y0, x + 0.025, y1, 'rgba(0,0,0,0.45)'); }
  else { p.R(x - 0.04, y0, x + 0.04, y1, o.bar || '#d9d3c4'); p.R(x - w / 2, y0 + (y1 - y0) * 0.64, x + w / 2, y0 + (y1 - y0) * 0.64 + 0.06, o.bar || '#d9d3c4'); p.R(x - w / 2, y1 - 0.14, x + w / 2, y1, 'rgba(0,0,0,0.35)'); }
}
// an iron railing painted on the wall
function ironRail(p, x0, x1, y, h, c = '#2b2a2c') { p.R(x0, y + h - 0.07, x1, y + h, c); p.R(x0, y, x1, y + 0.09, c); for (let x = x0; x <= x1; x += 0.19) p.R(x, y, x + 0.045, y + h, c); }
// a row of turned balusters painted between two rails
function paintedBalus(p, x0, x1, y0, y1, stone = '#dccfae', gap = 'rgba(70,50,30,0.55)') { p.R(x0, y0, x1, y1, stone); for (let x = x0 + 0.12; x < x1 - 0.1; x += 0.34) p.R(x, y0 + 0.16, x + 0.17, y1 - 0.16, gap); p.R(x0, y1 - 0.1, x1, y1 - 0.05, 'rgba(255,250,235,0.5)'); }
// stone balustrade card standing at height y along the local segment (x0,z0)-(x1,z1) of M
function balusRun(M, x0, z0, x1, z1, y, h, c = '#e8d5ac', y1 = y) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), L = Math.hypot(l, y1 - y);
  panel('balus', L, h, { M: mul(M, mul(tr((x0 + x1) / 2, (y + y1) / 2, (z0 + z1) / 2), rotY(Math.atan2(-dz, dx)))), rz: Math.atan2(y1 - y, l), uvk: [L / h, 1], c });
}

// =====================================================================================================
// Villa Boscogrande
// =====================================================================================================
const BO = { id: 'w191810308', p: [-5414.1, -6772.5, -5406.1, -6760.0, -5418.7, -6753.5, -5410.8, -6740.8, -5399.5, -6747.4, -5391.5, -6733.9, -5379.3, -6740.0, -5402.8, -6779.1] };
const BO_O = [-5414.75, -6747.15], BO_N = [-0.849, 0.528], BOH = 15.8, BOW = 13.8, BOR = 13.4, BOGZ = 60, BOTUF = '#cfa87c';
const boAt = atlas('v2Bosco', 512, 320, 19.2, [
  ['front', 15, 15.8, 0, 0, (p) => {   // the middle block: the arched door (behind the stair), three tall openings, cornice and attic
    ground(p, BOTUF, 6101); blocks(p, -7.5, 7.5, 15.8, 0.52, 'rgba(0,0,0,0)', 6102);
    p.arch(0, 0, 5.4, 3.3, '#efe8da'); p.arch(0, 0, 5.1, 2.8, '#9a6e4c'); p.R(-1.0, 0, 1.0, 3.6, '#241c18'); p.R(-0.04, 0, 0.04, 3.6, '#5a4a3a');
    p.R(-1.75, 6.2, 1.75, 11.15, '#e4c8a8'); p.R(-1.75, 11.0, 1.75, 11.15, '#f2e6d2'); win(p, 0, 6.25, 10.15, 1.6, { f: 0.18 });
    for (const s of [-1, 1]) { win(p, s * 4.25, 6.25, 9.85, 1.5, { f: 0.28 }); ironRail(p, s * 4.25 - 0.95, s * 4.25 + 0.95, 6.25, 1.05, '#e6e2d8'); p.R(s * 4.25 - 1.1, 10.2, s * 4.25 + 1.1, 10.35, '#f2ead8'); }
    p.R(-7.5, 13.45, 7.5, 13.75, '#dcc29a'); p.R(-7.5, 13.3, 7.5, 13.45, 'rgba(80,52,30,0.45)'); p.R(-7.5, 15.55, 7.5, 15.8, '#dcc29a'); p.R(-7.5, 15.45, 7.5, 15.55, 'rgba(80,52,30,0.35)');
    wear(p, 6103, 22);
  }],
  ['wing', 3.5, 13.8, 288, 0, (p) => {
    ground(p, '#cda47b', 6111); blocks(p, -1.75, 1.75, 13.8, 0.52, 'rgba(0,0,0,0)', 6112);
    win(p, 0, 6.9, 9.7, 1.35); ironRail(p, -0.75, 0.75, 6.9, 0.95, '#e6e2d8'); p.R(-0.95, 10.05, 0.95, 10.2, '#c39c72');
    for (const x of [-0.45, 0.45]) win(p, x, 11.35, 12.25, 0.6, { f: 0.12 });
    p.R(-1.75, 13.05, 1.75, 13.3, '#d9bd94'); p.R(-1.75, 12.92, 1.75, 13.05, 'rgba(80,52,30,0.45)');
    wear(p, 6113, 8);
  }],
  ['rear', 6.5, 13.4, 355, 0, (p) => {   // the garden front: white ground floor, ochre order above
    const { R, poly } = p, O = '#d9ad76';
    ground(p, '#e6ddcc', 6121, 0.06);
    R(-3.25, 0, 3.25, 0.5, '#bda684');
    R(-0.95, 0.4, 0.95, 3.2, O); win(p, 0, 0.5, 2.9, 1.15, { f: 0.1, frame: '#e9e2d2' }); R(-1.15, 3.2, 1.15, 3.38, '#c99a62');
    R(-1.0, 3.75, 1.0, 5.0, '#c99660'); R(-0.84, 3.88, 0.84, 4.88, '#dcb583'); p.circ(-0.1, 4.5, 0.22, '#b98550'); poly([[-0.65, 3.95], [0.6, 3.95], [0.15, 4.4], [-0.25, 4.3]], '#b98550');
    R(-3.25, 5.25, 3.25, 5.65, O);
    for (const s of [-1, 1]) for (const x of [s * 2.95, s * 2.15]) { R(x - 0.28, 0.4, x + 0.28, 10.55, O); R(x - 0.38, 0.4, x + 0.38, 1.1, '#c99a62'); R(x - 0.36, 9.85, x + 0.36, 10.55, '#c8955c'); R(x - 0.2, 10.05, x + 0.2, 10.3, '#e2bd8c'); }
    R(-1.15, 5.65, 1.15, 9.2, '#dcb582'); p.arch(0, 8.6, 9.55, 1.7, '#cf9f6a'); win(p, 0, 5.8, 8.7, 1.4, { f: 0.1, frame: '#c99a62' });
    poly([[-1.35, 9.55], [1.35, 9.55], [0, 10.35]], '#c4915a'); poly([[-0.95, 9.65], [0.95, 9.65], [0, 10.15]], '#e0bb8a');
    ironRail(p, -0.95, 0.95, 5.65, 1.15);
    R(-3.25, 10.55, 3.25, 11.3, '#d7ae7a'); R(-3.25, 11.3, 3.25, 11.65, '#8d7356'); R(-3.25, 11.65, 3.25, 13.4, '#d2b48c'); paintedBalus(p, -2.6, 2.6, 11.85, 13.0, '#d9bf98', 'rgba(80,55,35,0.45)'); R(-3.25, 13.15, 3.25, 13.4, '#c9a67c');
    wear(p, 6123, 14);
  }],
  ['plain', 1.5, 13.8, 482, 0, (p) => { ground(p, '#c79f76', 6131); blocks(p, -0.75, 0.75, 13.8, 0.52, 'rgba(0,0,0,0)', 6132); p.R(-0.75, 13.05, 0.75, 13.3, '#d9bd94'); wear(p, 6133, 4); }],
  ['sign', 8, 1.2, 288, 285, (p) => {   // the iron band over the gate with the name
    const { g } = p; p.R(-4, 0, 4, 1.2, '#1d1b1a'); g.fillStyle = '#d8b45a'; g.font = `bold ${Math.round(0.72 * p.sy)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VILLA BOSCOGRANDE', p.X(0), p.Y(0.6), p.w * 0.94);
  }],
]);
const BO_PTS = pairsOf(BO.p);
function buildBosco() {
  initShared(); boAt.def();
  const S = place(BO_O, BO_N, BO_PTS), { M, y0 } = S, P = BO_PTS;
  begin(y0);
  // the walls on the footprint's edges, over a foundation
  prism('flat', P, S.lo, y0 + 0.02, { c: '#a8865f', noao: true });
  boAt.wall('wing', P, P[0], P[1], y0); boAt.wall('wing', P, P[4], P[5], y0);
  boAt.card('front', M, 0, 0, 0, 14.96, BOH);
  boAt.wall('plain', P, P[1], P[2], y0, BOH - 0.3); boAt.wall('plain', P, P[3], P[4], y0, BOH - 0.3);
  // the ground behind the house lies lower than the forecourt: those walls start at their own ground
  for (const [name, i, j, H] of [['plain', 5, 6, BOW], ['plain', 7, 0, BOW], ['rear', 6, 7, BOR]]) { const g = Math.min(y0, groundY(...P[i]), groundY(...P[j])); boAt.wall(name, P, P[i], P[j], g, y0 - g + H); }
  prism('flat', [P[0], P[1], P[4], P[5], P[6], P[7]], y0 + 12.9, y0 + 13.05, { c: '#8e8c84', noao: true });
  prism('flat', [P[1], P[2], P[3], P[4]], y0 + 14.7, y0 + 14.85, { c: '#8e8c84', noao: true });
  fb(M, -7.5, 7.5, BOH - 1.3, BOH, -0.45, -0.05, '#c9a47a');   // the back of the attic
  // cornices that stand out of the middle block, and the crest on the garden front
  fb(M, -7.65, 7.65, 13.4, 13.7, -0.1, 0.22, '#d8be96');
  { const E = edge(P, P[6], P[7], y0); fb(E.M, -E.l / 2, E.l / 2, 11.25, 11.5, -0.1, 0.35, '#a98a66'); slab(E.M, [[-1.2, 13.4], [1.2, 13.4], [0.95, 14.7], [0.35, 15.5], [-0.35, 15.5], [-0.95, 14.7]], -0.35, -0.05, '#cdb695'); }
  // the stair: the landing over the arched door, curved cheeks, two flights beside them, stone balusters
  const WH = '#e6ddcc', LZ = 3.4, LY = 6.05;
  const front = shapeOf([[-4.5, 0], [4.5, 0], [4.5, LY], [-4.5, LY]]), hole = new THREE.Path();
  hole.moveTo(-1.45, 0.001); hole.lineTo(-1.45, 3.95); hole.absarc(0, 3.95, 1.45, PI, 0, true); hole.lineTo(1.45, 0.001); hole.closePath(); front.holes.push(hole);
  extrude('flat', front, 0.35, { M, p: [0, 0, LZ - 0.35], cs: 10, c: WH, noao: true });
  for (let i = 0; i < 9; i++) { const a = PI - i * PI / 9, b = PI - (i + 1) * PI / 9, q = (t, r) => [Math.cos(t) * r, 3.95 + Math.sin(t) * r]; slab(M, [q(a, 1.45), q(a, 1.7), q(b, 1.7), q(b, 1.45)], LZ - 0.02, LZ + 0.08, '#f4efe4'); }
  for (const s of [-1, 1]) {
    fb(M, s * 1.45, s * 1.7, 0, 3.95, LZ - 0.02, LZ + 0.08, '#f4efe4');
    fb(M, s * 4.15, s * 4.5, 0, LY, 0, LZ - 0.3, '#ddd3c0');
    // the curved cheek: down from the landing to the foot
    const cheek = [[4.5, 0], [6.0, 0], [6.0, 2.9], [5.55, 3.6], [5.0, 4.55], [4.5, LY]].map(([x, y]) => [s * x, y]);
    slab(M, s > 0 ? cheek : cheek.reverse(), LZ - 0.5, LZ - 0.05, WH);
    balusRun(M, s * 6.0, LZ - 0.25, s * 5.0, LZ - 0.25, 2.9, 0.9, '#e8d5ac', 4.55);
    balusRun(M, s * 5.0, LZ - 0.25, s * 4.5, LZ - 0.25, 4.55, 0.9, '#e8d5ac', LY);
    // the outer flight, rising towards the front of the house
    for (let i = 0; i < 14; i++) fb(M, s * 6.0, s * 8.3, 0, (i + 1) * 0.31, 6.6 - (i + 1) * 0.42, 6.6 - i * 0.42, i % 2 ? '#a9a398' : '#b8b2a6');
    fb(M, s * 6.0, s * 8.3, 0, 4.34, 0.02, 0.72, '#b0a99d');
    balusRun(M, s * 8.2, 6.5, s * 8.2, 0.75, 0.25, 0.9, '#e8d5ac', 4.35);
    // the low walls in front, with their balusters, piers and red pots
    fb(M, s * 2.5, s * 6.0, 0, 0.35, 7.2, 7.65, '#cdb086'); balusRun(M, s * 2.6, 7.45, s * 5.9, 7.45, 0.35, 0.85);
    fb(M, s * 2.5, s * 6.0, 1.2, 1.38, 7.25, 7.65, '#dcc397');
    for (const x of [2.7, 5.85]) { fb(M, s * (x - 0.24), s * (x + 0.24), 0, 1.5, 7.18, 7.68, '#d3b78c'); cyl('flat', 0.2, 0.12, 0.35, 7, { M, p: [s * x, 1.5, 7.43], c: '#a4332a', noao: true }); }
    cyl('flat', 0.18, 0.1, 0.4, 7, { M, p: [s * 2.0, LY + 1.1, LZ - 0.2], c: '#a4332a', noao: true });
    fb(M, s * 1.8, s * 2.2, LY, LY + 1.1, LZ - 0.4, LZ, '#dcc397');
    // lamp posts
    cyl('flat', 0.05, 0.08, 2.6, 6, { M, p: [s * 7.0, 0, 8.2], c: '#1f1e1e', noao: true }); box('flat', 0.3, 0.42, 0.3, { M, p: [s * 7.0, 2.6, 8.2], c: '#3a3a30', noao: true });
  }
  fb(M, -4.55, 4.55, LY - 0.22, LY + 0.05, 0, LZ + 0.1, '#d9cdb6');
  balusRun(M, -4.45, LZ - 0.1, 4.45, LZ - 0.1, LY + 0.05, 1.05);
  fb(M, -4.55, 4.55, LY + 1.08, LY + 1.2, LZ - 0.28, LZ + 0.08, '#dcc397');
  for (const s of [-1, 1]) balusRun(M, s * 4.45, 0.05, s * 4.45, LZ - 0.1, LY + 0.05, 1.05);
  // the gate at the end of the drive: two piers of rough stone, the leaves swung in, the name on an iron band, a short stretch of wall and of railing
  const gx = S.W(0, BOGZ), gy = groundY(gx[0], gx[1]) - y0, G = mul(M, tr(0, gy, BOGZ));
  for (const s of [-1, 1]) {
    fb(G, s * 2.1, s * 3.5, -0.8, 4.7, -0.65, 0.65, '#b68f66');
    for (let i = 0; i < 9; i++) fb(G, s * 2.07, s * 3.53, 0.35 + i * 0.5, 0.39 + i * 0.5, -0.68, 0.68, i % 3 ? '#96734f' : '#caa57c');
    fb(G, s * 1.95, s * 3.65, 4.7, 5.0, -0.8, 0.8, '#a98660'); fb(G, s * 2.15, s * 3.45, 5.0, 5.2, -0.6, 0.6, '#bd9a73');
    // a leaf of the gate, open towards the garden
    const L = mul(G, mul(tr(s * 2.08, 0, -0.55), rotY(s * 1.42)));
    for (let k = 0; k <= 7; k++) fb(L, -s * k * 0.27 - 0.025, -s * k * 0.27 + 0.025, 0.15, 3.5 + (k % 2) * 0.12, -0.025, 0.025, '#1c1b1b');
    for (const y of [0.25, 1.2, 3.3]) fb(L, 0, -s * 1.92, y, y + 0.08, -0.04, 0.04, '#1c1b1b');
  }
  fb(G, -5.9, -3.5, -0.8, 3.1, -0.3, 0.3, '#b0895f'); fb(G, -6.0, -3.5, 3.1, 3.3, -0.4, 0.4, '#a98660');
  fb(G, 3.5, 5.9, -0.8, 0.9, -0.3, 0.3, '#b0895f'); for (let x = 3.75; x < 5.9; x += 0.26) fb(G, x - 0.025, x + 0.025, 0.9, 3.4, -0.025, 0.025, '#1c1b1b'); fb(G, 3.5, 5.9, 3.0, 3.1, -0.04, 0.04, '#1c1b1b');
  boAt.card('sign', G, 0, 4.15, 0, 4.2, 0.62); boAt.card('sign', mul(G, rotY(PI)), 0, 4.15, 0.01, 4.2, 0.62);
  fb(G, 2.35, 3.25, 3.25, 3.65, 0.66, 0.7, '#e8e6e0'); fb(G, 2.55, 3.05, 1.9, 2.5, 0.66, 0.7, '#d6cbb2');
  const o = end('Villa Boscogrande');
  o.userData.solids = [[BO.p, null, y0 + 13]];
  return o;
}
function boWalls() {   // the stair and its low walls, and the gate's piers and side stretches
  const W = mapW(BO_O, BO_N), out = run(W, [[-8.4, 0], [-8.4, 6.7], [-6.0, 6.7], [-6.0, 7.75], [-2.4, 7.75], [-2.4, 3.45], [2.4, 3.45], [2.4, 7.75], [6.0, 7.75], [6.0, 6.7], [8.4, 6.7], [8.4, 0]]);
  for (const s of [-1, 1]) out.push(...run(W, [[s * 2.1, BOGZ - 0.7], [s * 5.9, BOGZ - 0.7], [s * 5.9, BOGZ + 0.7], [s * 2.1, BOGZ + 0.7], [s * 2.1, BOGZ - 0.7]]));
  return out;
}
{ const W = mapW(BO_O, BO_N); for (const t of [11, 18, 25, 32, 39, 46, 53, 60]) TREE_CLEAR.push([...W(0, t).map(r1), t < 20 ? 9 : 4.5]); TREE_CLEAR.push([...W(0, 67.5).map(r1), 4]); }   // the drive from the gate to the stair stays open

// =====================================================================================================
// Villa Lampedusa
// =====================================================================================================
// the footprints, with the height drawn (m) and the kind: 0 the house, 1 a white wing, 2 a tiled house, 3 a flat topped pavilion
const LA = [
  ['w285429191', 12.6, 0, [-2899.5, -5438.5, -2890.6, -5445.2, -2889.0, -5443.2, -2884.9, -5446.4, -2868.2, -5459.4, -2859.9, -5449.5, -2862.9, -5447.0, -2871.0, -5440.5, -2876.8, -5436.2, -2880.6, -5433.3, -2879.9, -5432.4, -2891.3, -5423.6, -2901.0, -5436.0]],
  ['w285443478', 5.6, 1, [-2879.9, -5432.4, -2872.0, -5422.5, -2878.9, -5417.0, -2883.4, -5413.5, -2891.3, -5423.6]],
  ['w285446902', 5.6, 1, [-2862.9, -5447.0, -2858.3, -5441.0, -2854.3, -5435.7, -2862.3, -5429.7, -2871.0, -5440.5]],
  ['w285429331', 3.0, 2, [-2883.4, -5413.5, -2878.9, -5417.0, -2877.4, -5415.2, -2879.0, -5413.8, -2869.4, -5401.5, -2875.9, -5396.5, -2882.7, -5405.0, -2884.2, -5403.9, -2888.5, -5409.5]],
  ['w285440756', 4.2, 2, [-2868.1, -5399.2, -2860.9, -5390.5, -2864.1, -5388.0, -2868.1, -5392.7, -2871.3, -5396.7]],
  ['w285441147', 3.2, 2, [-2868.1, -5392.7, -2864.1, -5388.0, -2869.6, -5383.6, -2873.6, -5388.4]],
  ['w285424644', 5.2, 3, [-2849.6, -5399.9, -2845.6, -5395.0, -2844.0, -5393.2, -2851.1, -5387.4, -2852.4, -5388.9, -2858.0, -5389.1, -2859.2, -5388.3, -2860.9, -5390.5]],
  ['w285450374', 5.2, 3, [-2836.6, -5409.9, -2842.4, -5417.4, -2837.5, -5421.1, -2835.0, -5418.2, -2830.4, -5411.9, -2837.5, -5406.1, -2835.8, -5402.9, -2835.3, -5399.7, -2841.6, -5395.1, -2847.0, -5401.9]],
  ['w285442896', 4.4, 2, [-2854.3, -5435.7, -2850.3, -5438.7, -2845.1, -5432.1, -2842.4, -5428.7, -2846.4, -5425.5]],
  ['w426017677', 4.4, 2, [-2858.3, -5441.0, -2842.6, -5453.2, -2838.3, -5447.5, -2850.3, -5438.7, -2854.3, -5435.7]],
  ['w426017678', 4.4, 2, [-2845.1, -5432.1, -2850.3, -5438.7, -2838.3, -5447.5, -2834.2, -5450.6, -2829.0, -5443.8]],
  ['w426017683', 4.4, 2, [-2818.9, -5430.4, -2829.0, -5443.8, -2834.2, -5450.6, -2828.5, -5454.9, -2812.1, -5433.2, -2813.0, -5432.4, -2812.4, -5430.2, -2810.5, -5427.4, -2830.4, -5411.9, -2835.0, -5418.2]],
];
const LA_O = [-2875.5, -5436.5], LA_N = [0.624, 0.781], LAY = '#d9ae68', LAW = '#ece4d2';
function laBay(p, w, h, kind, seed) {   // the low parts: white plaster, ochre foot and frame, an arched door, a window or nothing
  ground(p, LAW, seed, 0.05); p.R(-w / 2, 0, w / 2, 0.75, '#d2a762'); p.R(-w / 2, h - 0.75, w / 2, h - 0.45, LAY); p.R(-w / 2, h - 0.1, w / 2, h, '#c99c58');
  p.R(-w / 2, 0, -w / 2 + 0.16, h, LAY); p.R(w / 2 - 0.16, 0, w / 2, h, LAY);
  if (kind === 1) { p.arch(0, 0, 3.3, 2.0, LAY); p.arch(0, 0, 3.05, 1.55, '#4a3326'); p.R(-0.03, 0, 0.03, 2.9, '#2a1c14'); }
  if (kind === 2) { win(p, 0, 1.45, 2.75, 0.95, { f: 0.2, frame: LAY, glass: '#4a3a2c' }); }
  wear(p, seed + 1, 5, 0.07);
}
const laAt = atlas('v2Lamp', 512, 384, 12, [
  ['front', 40.8, 13.2, 0, 0, (p) => {
    const { R, poly, line } = p;
    ground(p, '#eee6d0', 6201, 0.05); R(-20.4, 0, 20.4, 0.9, '#cdb889');
    for (const x of [-19.9, -7.8, -3.6, 3.6, 7.8, 19.9]) { R(x - 0.38, 0, x + 0.38, 12.0, LAY); R(x - 0.5, 11.35, x + 0.5, 11.7, '#e7c98c'); }
    R(-20.4, 4.55, 20.4, 5.0, LAY); R(-20.4, 11.9, 20.4, 12.55, LAY); R(-20.4, 11.75, 20.4, 11.9, 'rgba(90,60,25,0.4)'); R(-20.4, 13.0, 20.4, 13.2, LAY);
    for (const s of [-1, 1]) {
      [[16.6, 0], [12.9, 1], [9.7, 0], [5.65, 1]].forEach(([d, round]) => {
        const x = s * d; R(x - 1.05, 5.05, x + 1.05, 8.75, LAY); win(p, x, 5.15, 8.4, 1.4, { f: 0.08, frame: '#b98a48', glass: '#4d3128', bar: '#7a5240' });
        if (round) { p.circ(x, 8.75, 0.1, LAY); p.g.fillStyle = LAY; p.g.beginPath(); p.g.ellipse(p.X(x), p.Y(8.95), 1.3 * p.sx, 1.0 * p.sy, 0, PI, 0); p.g.fill(); p.g.fillStyle = '#eadfc4'; p.g.beginPath(); p.g.ellipse(p.X(x), p.Y(9.05), 0.8 * p.sx, 0.55 * p.sy, 0, PI, 0); p.g.fill(); }
        else { poly([[x - 1.35, 8.95], [x + 1.35, 8.95], [x, 10.05]], LAY); poly([[x - 0.8, 9.1], [x + 0.8, 9.1], [x, 9.75]], '#eadfc4'); }
      });
      for (const [a, b] of [[8.6, 19.1], [4.35, 7.05]]) { const x0 = Math.min(s * a, s * b), x1 = Math.max(s * a, s * b); R(x0, 10.25, x1, 11.45, '#e2d2a8'); R(x0 + 0.18, 10.4, x1 - 0.18, 11.3, '#efe6cc'); const n = b - a > 5 ? 3 : 1, d = (x1 - x0 - 0.6) / n; for (let i = 0; i < n; i++) { const c = x0 + 0.3 + d * (i + 0.5); p.g.strokeStyle = '#c7ad78'; p.g.lineWidth = 2; p.g.beginPath(); p.g.moveTo(p.X(c - d * 0.42), p.Y(11.15)); p.g.quadraticCurveTo(p.X(c), p.Y(10.15), p.X(c + d * 0.42), p.Y(11.15)); p.g.stroke(); } }
      R(s * 1.75 - 0.28, 5.0, s * 1.75 + 0.28, 9.35, LAY); line(s * 1.75, 5.2, s * 1.75, 9.2, 0.1, '#f0dca8');
    }
    R(-1.3, 5.0, 1.3, 9.05, '#c99a56'); win(p, 0, 5.0, 8.75, 1.9, { f: 0.1, frame: '#a67a3e', glass: '#4a2c20', bar: '#8a5a3c' });
    R(-2.35, 9.35, 2.35, 9.8, LAY); poly([[-2.5, 9.8], [2.5, 9.8], [0, 11.4]], LAY); poly([[-1.6, 10.0], [1.6, 10.0], [0, 10.95]], '#eadfc4');
    wear(p, 6202, 26, 0.07);
  }],
  ['side', 4, 13.2, 0, 164, (p) => {   // the back and the ends
    ground(p, '#e4d7bc', 6211); p.R(-2, 4.55, 2, 4.95, '#cfa86c'); p.R(-2, 11.9, 2, 12.55, '#cfa86c'); p.R(-2, 11.75, 2, 11.9, 'rgba(90,60,25,0.4)');
    win(p, 0, 5.4, 8.3, 1.25, { f: 0.22, frame: '#cfa86c', glass: '#4d3128', bar: '#7a5240' }); p.poly([[-1.15, 8.85], [1.15, 8.85], [0, 9.75]], '#cfa86c'); win(p, 0, 1.5, 3.1, 0.9, { f: 0.18, frame: '#cfa86c' });
    wear(p, 6212, 10, 0.12);
  }],
  ['door', 4, 5.6, 52, 164, (p) => laBay(p, 4, 5.6, 1, 6221)],
  ['blank', 4, 5.6, 104, 164, (p) => laBay(p, 4, 5.6, 0, 6231)],
  ['low', 4, 4.2, 156, 164, (p) => laBay(p, 4, 4.2, 2, 6241)],
  ['stair', 7.8, 4.9, 208, 164, (p) => {
    const { R, circ, arch } = p;
    ground(p, '#eee5ce', 6251, 0.05); R(-3.9, 0, 3.9, 0.55, '#cdb07c'); R(-3.9, 4.15, 3.9, 4.9, LAY); R(-3.9, 4.1, 3.9, 4.2, 'rgba(90,60,25,0.4)');
    for (const x of [-3.65, -1.55, 1.55, 3.65]) R(x - 0.25, 0, x + 0.25, 4.2, LAY);
    R(-1.15, 0, 1.15, 3.5, '#d3a55e'); R(-0.9, 0, 0.9, 3.2, '#3f2a1e'); R(-0.03, 0, 0.03, 3.2, '#22150e'); R(-0.65, 1.3, -0.2, 2.7, '#6a4a34'); R(0.2, 1.3, 0.65, 2.7, '#6a4a34');
    for (const x of [-2.6, 2.6]) { arch(x, 0.9, 3.2, 1.25, '#dcc596'); circ(x, 1.75, 0.46, '#c9a86e'); circ(x, 1.85, 0.3, '#eadcb8'); R(x - 0.55, 0.9, x + 0.55, 1.25, '#c29a5c'); }
    wear(p, 6252, 8, 0.07);
  }],
]);
// a low hipped roof over the box of a footprint, in flat tile colour
function hip(pts, y, rise, c) {
  const o = obb(pts), L = o.w / 2 + 0.12, D = o.d / 2 + 0.12, r = Math.max(0.2, L - D), V = [];
  const P = (u, v, h) => [o.cx + o.ux * u + o.vx * v, y + h, o.cz + o.uz * u + o.vz * v];
  const a = P(-L, -D, 0), b = P(L, -D, 0), cc = P(L, D, 0), d = P(-L, D, 0), e = P(-r, 0, rise), f = P(r, 0, rise);
  for (const [p0, p1, p2] of [[a, e, f], [a, f, b], [cc, f, e], [cc, e, d], [b, f, cc], [d, e, a]]) V.push(...p0, ...p1, ...p2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
  g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { for (let i = 0; i < V.length; i += 9) for (let k = 0; k < 3; k++) { const t = V[i + 3 + k]; V[i + 3 + k] = V[i + 6 + k]; V[i + 6 + k] = t; } g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.computeVertexNormals(); }
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(V.length / 3 * 2), 2));
  part('flat', g, { c, noao: true });
}
function buildLampedusa() {
  initShared(); laAt.def();
  const S = place(LA_O, LA_N), { M, y0 } = S;
  const lo = Math.min(y0, ...LA.map(q => groundRange(pairsOf(q[3])).lo)) - 1.2;
  begin(y0);
  const WINGIN = (n) => Math.abs(n[0] * S.W.n[1] - n[1] * S.W.n[0]) > 0.8;   // a wall that looks across the middle
  for (const [id, H, kind, flat] of LA) {
    const P = pairsOf(flat);
    prism('flat', P, lo, y0 + 0.02, { c: '#b39a72', noao: true });
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], E = edge(P, a, b, y0); if (E.l < 0.6) continue;
      const z = new THREE.Vector3().setFromMatrixColumn(E.M, 2);
      if (kind === 0) {   // the house: its front is the painted whole, the rest plain bays
        const front = z.x * S.W.n[0] + z.z * S.W.n[1] > 0.7;
        if (!front) laAt.wall('side', P, a, b, y0);
      } else if (kind === 1) laAt.wall(WINGIN([z.x, z.z]) ? 'door' : 'blank', P, a, b, y0);
      else laAt.wall('low', P, a, b, y0, H);
    }
    if (kind === 2) { prism('flat', P, y0 + H - 0.06, y0 + H, { c: '#a8644a', noao: true }); if (obb(P).d > 3) hip(P, y0 + H, Math.min(1.5, obb(P).d * 0.17), '#a5705a'); }
    else { const top = kind === 0 ? 12.5 : H - 0.35; prism('flat', P, y0 + top - 0.1, y0 + top, { c: kind === 0 ? '#b98a70' : '#cfc9bb', noao: true }); }
  }
  // the front of the house on its own plane, the parapet's urns and the crest
  laAt.card('front', M, -0.05, 0, 0.45, 40.8, 13.2);
  fb(M, -20.45, 20.35, 0, 13.2, -0.9, 0.4, '#e2d4b4'); fb(M, -20.7, 20.6, 11.95, 12.5, 0.4, 0.75, '#dcb26c');
  for (const x of [-19.9, -7.8, 7.8, 19.9]) { fb(M, x - 0.25, x + 0.25, 13.2, 13.5, 0.0, 0.5, LAY); cyl('flat', 0.28, 0.1, 0.55, 6, { M, p: [x, 13.5, 0.25], c: '#e0b873', noao: true }); sphere('flat', 0.14, { M, p: [x, 14.15, 0.25], seg: 6, c: '#e0b873', noao: true }); }
  fb(M, 14.1, 14.8, 13.2, 14.9, -0.4, 0.3, '#d9ae68');
  slab(M, [[-3.5, 13.2], [3.5, 13.2], [3.3, 13.9], [2.4, 14.2], [2.2, 15.4], [1.2, 15.6], [0.8, 16.2], [-0.8, 16.2], [-1.2, 15.6], [-2.2, 15.4], [-2.4, 14.2], [-3.3, 13.9]], 0.05, 0.5, '#d9ae68');
  slab(M, [[-1.7, 13.5], [1.7, 13.5], [1.7, 14.9], [0.7, 15.4], [-0.7, 15.4], [-1.7, 14.9]], 0.5, 0.56, '#eee4cc'); fb(M, -0.55, 0.55, 14.0, 14.95, 0.55, 0.6, '#8a6a42'); sphere('flat', 0.2, { M, p: [0, 16.4, 0.25], seg: 6, c: '#e0b873', noao: true });
  // the stair block with its terrace and the two flights
  const SZ = 4.4, TY = 4.75;
  laAt.card('stair', M, 0, 0, SZ, 7.8, 4.9);
  fb(M, -3.88, 3.88, 0, TY, 0.4, SZ - 0.03, '#e4d6b2');
  fb(M, -4.05, 4.05, TY - 0.05, TY + 0.15, 0.4, SZ + 0.15, '#d9b676');
  balusRun(M, -3.9, SZ - 0.05, 3.9, SZ - 0.05, TY + 0.15, 1.0, '#f4f0e6');
  for (const s of [-1, 1]) {
    balusRun(M, s * 3.9, 0.5, s * 3.9, 1.7, TY + 0.15, 1.0, '#f4f0e6');
    for (let i = 0; i < 13; i++) fb(M, s * 3.9, s * 5.7, 0, (i + 1) * TY / 13, 7.7 - (i + 1) * 0.48, 7.7 - i * 0.48, i % 2 ? '#a7a196' : '#bab4a8');
    fb(M, s * 3.9, s * 5.7, 0, TY, 0.4, 1.46, '#b2aca0');
    balusRun(M, s * 5.65, 7.65, s * 5.65, 1.5, 0.3, 0.95, '#f4f0e6', TY);
    // the stone urns on their pedestals by the wings
    fb(M, s * 6.0, s * 6.8, 0, 1.5, 13.7, 14.5, '#ddd5c4'); cyl('flat', 0.5, 0.18, 0.9, 8, { M, p: [s * 6.4, 1.5, 14.1], c: '#e4ddcc', noao: true });
  }
  // the gate between the two pavilions, its leaves swung out
  const gw = [-2842.8, -5394.2], G = edge(pairsOf([-2844.0, -5393.2, -2841.6, -5395.1, -2850, -5405]), [-2844.0, -5393.2], [-2841.6, -5395.1], groundY(...gw));
  for (const s of [-1, 1]) { const L = mul(G.M, mul(tr(s * (G.l / 2 - 0.08), 0, 0.15), rotY(s * 2.25))); for (let k = 0; k <= 5; k++) { fb(L, -s * k * 0.28 - 0.04, -s * k * 0.28 + 0.04, 0.12, 3.3, -0.03, 0.03, '#1b1a1a'); cyl('flat', 0, 0.08, 0.28, 4, { M: L, p: [-s * k * 0.28, 3.3, 0], c: '#1b1a1a', noao: true }); } fb(L, 0, -s * 1.42, 0.12, 1.7, -0.015, 0.015, '#242220'); for (const y of [0.2, 1.7, 3.0]) fb(L, 0, -s * 1.42, y, y + 0.09, -0.045, 0.045, '#1b1a1a'); }
  const o = end('Villa Lampedusa');
  o.userData.solids = LA.map(q => [q[3], null, y0 + q[1]]);
  return o;
}
function laWalls() {
  const W = mapW(LA_O, LA_N), out = run(W, [[-5.75, 0.4], [-5.75, 7.75], [-3.9, 7.75], [-3.9, 4.45], [3.9, 4.45], [3.9, 7.75], [5.75, 7.75], [5.75, 0.4]]);
  for (const s of [-1, 1]) out.push(...run(W, [[s * 6.0, 13.2], [s * 6.0, 14.5], [s * 6.8, 14.5], [s * 6.8, 13.2]]));
  const G = mapW([-2842.8, -5394.15], [0.621, 0.784]);   // the open leaves of the gate
  for (const s of [-1, 1]) out.push(...run(G, [[s * 1.45, 0.15], [s * 2.34, 1.26]]));
  return out;
}
{ const W = mapW(LA_O, LA_N); for (const [x, z, r] of [[-2, 29, 14], [0, 14, 8], [-1, 44, 7], [-1, 58, 5]]) TREE_CLEAR.push([...W(x, z).map(r1), r]); }

// =====================================================================================================
// Villa Pantelleria
// =====================================================================================================
const PT = { id: 'w280096427', p: [-3496.0, -4758.6, -3485.0, -4748.2, -3508.6, -4722.9, -3519.9, -4732.9] };
const PT_O = [-3490.5, -4753.4], PT_N = [0.687, -0.727], PTH = 11.4, PTL = 5.2, PTD = 4.5, PTS = '#d9c4a0';
function ptStone(p, w, h, seed) {   // weathered plaster over rubble: pale above, patches of bare brown stone
  ground(p, '#d6c3a0', seed, 0.12); const r = RNG(seed + 1);
  for (let i = 0; i < w * h / 7; i++) { const x = (r() - 0.5) * w, y = r() * h * (r() < 0.6 ? 0.45 : 1); p.circ(x, y, 0.15 + r() * 0.55, r() < 0.5 ? 'rgba(135,96,62,0.20)' : r() < 0.6 ? 'rgba(235,222,196,0.30)' : 'rgba(96,82,66,0.16)'); }
}
function ptHead(p, x, y) {   // the broken pediment with its two scrolls over an upper window
  const { g } = p, C = '#b9955f';
  p.R(x - 1.3, y, x + 1.3, y + 0.22, C);
  for (const s of [-1, 1]) { g.strokeStyle = C; g.lineWidth = 0.26 * p.sx; g.beginPath(); g.moveTo(p.X(x + s * 1.3), p.Y(y + 0.3)); g.quadraticCurveTo(p.X(x + s * 0.6), p.Y(y + 0.55), p.X(x + s * 0.5), p.Y(y + 1.35)); g.quadraticCurveTo(p.X(x + s * 0.2), p.Y(y + 1.5), p.X(x + s * 0.18), p.Y(y + 1.0)); g.stroke(); }
  p.circ(x, y + 0.62, 0.26, '#c9a877');
}
const ptAt = atlas('v2Pant', 512, 320, 18, [
  ['upper', 15.1, 11.4, 0, 0, (p) => {   // the end front above the terrace
    ptStone(p, 15.1, 11.4, 6301); p.R(-7.55, 0, 7.55, 5.4, 'rgba(120,90,60,0.15)');
    for (const x of [-7.15, -5.8, 5.8, 7.15]) { p.R(x - 0.3, 0, x + 0.3, 10.75, '#dccba8'); p.R(x + 0.3, 0, x + 0.38, 10.75, 'rgba(80,55,35,0.35)'); }
    for (const x of [-3.8, 0, 3.8]) { p.R(x - 1.0, 5.9, x + 1.0, 8.5, '#c6a877'); win(p, x, 6.0, 8.25, 1.4, { f: 0.08, frame: '#a88455', glass: '#3a2e24', bar: '#6e5438' }); ptHead(p, x, 8.6); }
    p.R(-7.55, 10.75, 7.55, 11.4, '#d5bd92'); p.R(-7.55, 10.6, 7.55, 10.75, 'rgba(75,50,28,0.5)');
    wear(p, 6302, 20, 0.15);
  }],
  ['lower', 15.1, 5.2, 0, 208, (p) => {   // the lower storey that carries the terrace
    ptStone(p, 15.1, 5.2, 6311); p.R(-7.55, 0, 7.55, 4.85, 'rgba(120,84,52,0.22)'); for (let i = 0; i < 60; i++) { const r = RNG(6312 + i); p.circ((r() - 0.5) * 15, r() * 4.4, 0.15 + r() * 0.5, i % 3 ? 'rgba(132,80,48,0.30)' : 'rgba(75,62,50,0.28)'); }
    for (const x of [-4.9, -1.8, 2.6, 5.35]) { p.arch(x, 3.05, 4.65, 1.5, '#c4a678'); p.arch(x, 3.2, 4.45, 1.1, '#2b231c'); p.line(x - 0.45, 3.25, x + 0.45, 4.1, 0.07, '#6b5a46'); p.line(x + 0.45, 3.25, x - 0.45, 4.1, 0.07, '#6b5a46'); }
    p.R(-2.55, 0, -1.05, 2.45, '#b99c72'); p.R(-2.35, 0, -1.25, 2.25, '#221a14'); p.R(2.0, 1.2, 3.1, 2.35, '#b99c72'); p.R(2.15, 1.3, 2.95, 2.2, '#2b221a');
    for (const x of [-7.15, 7.15]) p.R(x - 0.3, 0, x + 0.3, 4.9, '#cdb690');
    p.R(-7.55, 4.85, 7.55, 5.2, '#c2aa80'); p.R(-7.55, 4.72, 7.55, 4.85, 'rgba(75,50,28,0.5)');
    wear(p, 6313, 16, 0.18);
  }],
  ['side', 5.75, 11.4, 276, 0, (p) => {   // a bay of the long front with the balconies
    ptStone(p, 5.75, 11.4, 6321);
    p.R(-2.87, 0, -2.5, 10.75, '#dccba8'); p.R(-2.5, 0, -2.42, 10.75, 'rgba(80,55,35,0.3)');
    win(p, 0, 5.6, 8.35, 1.35, { f: 0.28, frame: '#bb9a69', glass: '#38302a', bar: '#6e5a42' }); ptHead(p, 0, 8.75);
    win(p, 0, 2.7, 3.75, 0.95, { f: 0.2, frame: '#b39266', glass: '#241c16' }); p.R(-0.65, 0, 0.65, 1.7, '#8f7552'); p.R(-0.48, 0, 0.48, 1.55, '#261e17');
    p.R(-2.87, 10.75, 2.87, 11.4, '#d5bd92'); p.R(-2.87, 10.6, 2.87, 10.75, 'rgba(75,50,28,0.5)');
    wear(p, 6322, 10, 0.15);
  }],
  ['plain', 5.75, 11.4, 384, 0, (p) => {
    ptStone(p, 5.75, 11.4, 6331); win(p, 0, 5.8, 8.1, 1.2, { f: 0.16, frame: '#c3a676', glass: '#38302a' }); win(p, 0, 2.2, 3.4, 0.9, { f: 0.14, frame: '#b79a6e', glass: '#241c16' });
    p.R(-2.87, 10.75, 2.87, 11.4, '#d5bd92'); wear(p, 6332, 10, 0.15);
  }],
]);
// a stone balustrade along a world edge with square piers and small finials
function crown(P, a, b, y, h, c, step = 5, fin = true) {
  const E = edge(P, a, b, y), n = Math.max(1, Math.round(E.l / step));
  panel('balus', E.l, h, { M: mul(E.M, tr(0, 0, -0.15)), uvk: [E.l / h, 1], c });
  fb(E.M, -E.l / 2, E.l / 2, h - 0.04, h + 0.1, -0.32, 0.04, c);
  for (let i = 0; i <= n; i++) { const x = -E.l / 2 + Math.max(0.22, Math.min(E.l - 0.22, i * E.l / n)); fb(E.M, x - 0.22, x + 0.22, 0, h + 0.14, -0.38, 0.06, c); if (fin) cyl('flat', 0.04, 0.2, 0.42, 5, { M: E.M, p: [x, h + 0.14, -0.16], c, noao: true }); }
}
function buildPantelleria() {
  initShared(); ptAt.def();
  const P = pairsOf(PT.p), S = place(PT_O, PT_N, P), { M, y0 } = S;
  begin(y0);
  const q = (i, j) => { const l = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]), k = PTD / l; return [P[i][0] + (P[j][0] - P[i][0]) * k, P[i][1] + (P[j][1] - P[i][1]) * k]; };
  const A = q(0, 3), B = q(1, 2), MAIN = [A, B, P[2], P[3]];
  prism('flat', P, S.lo, y0 + 0.02, { c: '#9d8564', noao: true });
  // the end front: the terrace storey, and the house set back behind it
  const at = (poly, name, a, b, H) => { const g = Math.min(y0, groundY(...a), groundY(...b)); ptAt.wall(name, poly, a, b, g, y0 - g + H); };
  ptAt.card('lower', M, 0, 0, 0, 15.14, PTL);
  at(P, 'plain', P[0], A, PTL); at(P, 'plain', B, P[1], PTL);
  prism('flat', [P[0], P[1], B, A], y0 + PTL - 0.15, y0 + PTL, { c: '#b9a284', noao: true });
  crown(P, P[0], P[1], y0 + PTL, 0.95, '#d3bf99', 3.8, false); crown(P, P[0], A, y0 + PTL, 0.95, '#d3bf99', 4.5, false); crown(P, B, P[1], y0 + PTL, 0.95, '#d3bf99', 4.5, false);
  ptAt.card('upper', M, 0, 0, -PTD, 15.14, PTH);
  at(MAIN, 'side', B, P[2], PTH); at(MAIN, 'plain', P[2], P[3], PTH); at(MAIN, 'plain', P[3], A, PTH);
  // the cornices, the balustrade round the top and the low tiled roof
  for (const [a, b] of [[A, B], [B, P[2]], [P[2], P[3]], [P[3], A]]) { const E = edge(MAIN, a, b, y0); fb(E.M, -E.l / 2 - 0.3, E.l / 2 + 0.3, PTH - 0.28, PTH + 0.02, -0.1, 0.36, '#cdb48a'); crown(MAIN, a, b, y0 + PTH, 0.95, '#d6c29c', 5.8); }
  prism('flat', MAIN, y0 + PTH - 0.1, y0 + PTH + 0.04, { c: '#b5754e', noao: true });
  hip(MAIN.map(p => { const cx = (A[0] + B[0] + P[2][0] + P[3][0]) / 4, cz = (A[1] + B[1] + P[2][1] + P[3][1]) / 4; return [cx + (p[0] - cx) * 0.9, cz + (p[1] - cz) * 0.9]; }), y0 + PTH + 0.04, 2.2, '#c47a4e');
  // the iron balconies with their swelling rails on the long front
  { const E = edge(MAIN, B, P[2], y0), n = Math.max(1, Math.round(E.l / 5.75)), bw = E.l / n;
    for (let i = 0; i < n; i++) { const x = -E.l / 2 + (i + 0.5) * bw; fb(E.M, x - 1.15, x + 1.15, 5.32, 5.52, 0, 0.75, '#b39a72');
      fb(E.M, x - 1.1, x + 1.1, 6.5, 6.57, 0.88, 0.95, '#201f20');
      for (let k = 0; k <= 4; k++) { const u = x - 1.08 + k * 0.54; slab(mul(E.M, mul(tr(u, 0, 0), rotY(-PI / 2))), [[0.72, 5.52], [1.0, 5.75], [0.9, 6.55], [0.84, 6.55], [0.92, 5.78], [0.66, 5.55]], -0.03, 0.03, '#201f20'); }
      fb(E.M, x - 1.1, x + 1.1, 5.72, 5.78, 0.9, 0.97, '#201f20');
      fb(E.M, x - 1.1, x - 1.04, 5.5, 6.55, 0, 0.9, '#201f20'); fb(E.M, x + 1.04, x + 1.1, 5.5, 6.55, 0, 0.9, '#201f20'); } }
  const o = end('Villa Pantelleria');
  o.userData.solids = [[PT.p, null, y0 + PTL], [MAIN.flat(), null, y0 + PTH]];
  return o;
}
{ const W = mapW(PT_O, PT_N); for (const [x, z, r] of [[0, 6, 7], [0, 15, 7], [-7, 4, 5], [7, 4, 5]]) TREE_CLEAR.push([...W(x, z).map(r1), r]); }

// =====================================================================================================
// Villa Resuttano
// =====================================================================================================
// the footprint's parts as mapped: the house and the south wing are high, the ends of the wings are one storey
const RS = { id: 'w223971359', p: [-2382.6, -3881.5, -2342.0, -3907.4, -2337.9, -3901.0, -2337.1, -3899.8, -2339.0, -3898.6, -2365.5, -3881.7, -2352.8, -3862.1, -2341.1, -3869.6, -2340.4, -3868.5, -2326.2, -3877.6, -2323.6, -3879.4, -2320.2, -3874.2, -2336.4, -3863.8, -2335.1, -3861.9, -2359.7, -3846.2] };
const RS_HI = [[-2359.4, -3846.4, -2346.8, -3854.4, -2352.1, -3862.6, -2352.8, -3862.1, -2365.5, -3881.7, -2352.8, -3889.8, -2357.7, -3897.4, -2382.6, -3881.5, -2364.2, -3853.2], [-2352.8, -3862.1, -2346.8, -3854.4, -2335.4, -3862.2, -2336.4, -3863.8, -2335.6, -3864.3, -2339.2, -3869.3, -2340.4, -3868.5, -2341.0, -3869.4]];
const RS_LO = [[-2352.8, -3889.8, -2340.3, -3898.2, -2338.4, -3900.7, -2342.4, -3907.2, -2357.7, -3897.4], [-2324.2, -3879.0, -2339.2, -3869.3, -2335.6, -3864.3, -2320.8, -3873.8], [-2337.9, -3901.0, -2340.3, -3898.2, -2340.1, -3897.9, -2337.1, -3899.8]];
const RS_O = [-2359.15, -3871.9], RS_N = [0.839, -0.544], RSH = 13.4, RSL = 5.9, RSY = '#d7a65c';
const rsAt = atlas('v2Resu', 512, 192, 13, [
  ['back', 23.36, 14.2, 0, 0, (p) => {   // the courtyard front at the head of the stair
    const { R, poly, circ, arch } = p;
    ground(p, '#e9ddc2', 6401); R(-11.7, 0, 11.7, 0.8, '#bfa985');
    for (const x of [-11.35, -6.1, -2.1, 2.1, 6.1, 11.35]) R(x - 0.33, 0, x + 0.33, 11.5, RSY);
    R(-11.7, 4.9, 11.7, 5.25, '#c9a468'); R(-11.7, 11.45, 11.7, 12.15, '#cfa05c'); R(-11.7, 11.3, 11.7, 11.45, 'rgba(80,50,22,0.5)');
    arch(0, 0, 3.9, 3.0, '#c9a266'); arch(0, 0, 3.6, 2.4, '#3a2c20');
    R(-1.55, 5.4, 1.55, 9.2, RSY); win(p, 0, 5.4, 8.5, 1.6, { f: 0.14, frame: '#b9884a', glass: '#2a201a', bar: '#6a4a30' });
    R(-1.85, 9.2, 1.85, 9.55, '#c38f4a'); poly([[-1.3, 9.55], [1.3, 9.55], [0.7, 10.2], [0.35, 11.1], [-0.35, 11.1], [-0.7, 10.2]], RSY); circ(0, 10.2, 0.4, '#e9d6a8');
    for (const s of [-1, 1]) {
      circ(s * 4.1, 7.7, 0.85, RSY); circ(s * 4.1, 7.7, 0.55, '#33271d');
      R(s * 8.75 - 1.05, 5.3, s * 8.75 + 1.05, 8.9, RSY); win(p, s * 8.75, 5.4, 8.45, 1.45, { f: 0.1, frame: '#b9884a', glass: '#2c2620', bar: '#8a7a62' }); R(s * 8.75 - 1.15, 9.05, s * 8.75 + 1.15, 9.35, '#c38f4a'); ironRail(p, s * 8.75 - 1.15, s * 8.75 + 1.15, 5.4, 1.1);
      R(s * 9.3 - 0.6, 0, s * 9.3 + 0.6, 2.7, '#b59a70'); R(s * 9.3 - 0.42, 0, s * 9.3 + 0.42, 2.5, '#2c231a');
    }
    for (const [a, b] of [[-10.8, -6.7], [-5.5, -2.7], [2.7, 5.5], [6.7, 10.8]]) { R(a, 12.5, b, 13.75, '#d9c8a2'); R(a + 0.2, 12.68, b - 0.2, 13.57, '#e4d7bb'); }
    R(-11.7, 13.95, 11.7, 14.2, '#c9a468');
    wear(p, 6402, 18, 0.13);
  }],
  ['bay', 4.5, 14.2, 306, 0, (p) => {   // a bay of the high wings
    ground(p, '#e4d3b0', 6411); p.R(-2.25, 4.9, 2.25, 5.2, '#c9a468'); p.R(-2.25, 11.45, 2.25, 12.15, '#cfa05c'); p.R(-2.25, 11.3, 2.25, 11.45, 'rgba(80,50,22,0.5)');
    win(p, 0, 5.4, 8.5, 1.35, { f: 0.24, frame: RSY, glass: '#2c2620', bar: '#8a7a62' }); p.poly([[-1.2, 9.1], [1.2, 9.1], [0, 9.9]], '#c38f4a'); ironRail(p, -1.05, 1.05, 5.4, 1.1);
    win(p, 0, 2.6, 3.7, 0.9, { f: 0.18, frame: '#bfa070', glass: '#2c231a' }); p.R(-2.25, 13.95, 2.25, 14.2, '#c9a468');
    wear(p, 6412, 10, 0.15);
  }],
  ['plain', 4.5, 14.2, 366, 0, (p) => {
    ground(p, '#dcc9a6', 6421); p.R(-2.25, 11.45, 2.25, 12.15, '#c49a60'); win(p, 0, 6.0, 8.1, 1.1, { f: 0.15, frame: '#c3a676', glass: '#38302a' }); wear(p, 6422, 10, 0.16);
  }],
  ['low', 4.5, 5.9, 426, 0, (p) => {   // a bay of the one storey ends, under the terrace
    ground(p, '#e2d6bc', 6431); p.R(-2.25, 5.35, 2.25, 5.9, '#c9ac7c'); p.R(-2.25, 5.22, 2.25, 5.35, 'rgba(80,50,22,0.45)');
    p.R(-0.95, 2.75, 0.95, 4.35, '#c0a273'); p.R(-0.75, 2.9, 0.75, 4.2, '#2e251c'); for (let x = -0.6; x < 0.7; x += 0.24) p.R(x, 2.9, x + 0.05, 4.2, '#8a8478'); for (let y = 3.2; y < 4.2; y += 0.32) p.R(-0.75, y, 0.75, y + 0.05, '#8a8478');
    win(p, 0, 0.3, 1.9, 1.0, { f: 0.12, frame: '#bfa885', shut: '#8d938c' });
    wear(p, 6432, 8, 0.16);
  }],
]);
function buildResuttano() {
  initShared(); rsAt.def();
  const all = pairsOf(RS.p), S = place(RS_O, RS_N, all), { M, y0 } = S;
  begin(y0);
  const parts = [...RS_HI.map(f => [pairsOf(f), RSH, true]), ...RS_LO.map(f => [pairsOf(f), RSL, false])];
  const onBack = (a, b) => { const W = S.W.n, o = [RS_O[0], RS_O[1]]; return [a, b].every(p => Math.abs((p[0] - o[0]) * W[0] + (p[1] - o[1]) * W[1]) < 0.4); };
  for (const [P, H, high] of parts) {
    prism('flat', P, S.lo, y0 + 0.02, { c: '#a78e68', noao: true });
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], E = edge(P, a, b, y0); if (E.l < 1.0 || onBack(a, b)) continue;
      const g = Math.min(y0, groundY(...a), groundY(...b)), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, n = new THREE.Vector3().setFromMatrixColumn(E.M, 2);
      // the walls that look into the courtyard are the windowed ones; the outer faces are in no photo
      const inward = (S.W(0, 15)[0] - mx) * n.x + (S.W(0, 15)[1] - mz) * n.z > 0;
      rsAt.wall(high ? (inward ? 'bay' : 'plain') : 'low', P, a, b, g, y0 - g + (high ? 14.2 : RSL));
      if (!high) crown(P, a, b, y0 + RSL, 0.9, '#d6c6a2', 4.5, false);
      else { fb(E.M, -E.l / 2, E.l / 2, 11.75, 12.05, -0.05, 0.28, '#c99c5e'); fb(E.M, -E.l / 2, E.l / 2, 14.0, 14.2, -0.35, 0.05, '#c4a470'); }
    }
    prism('flat', P, y0 + (high ? 13.0 : RSL - 0.15), y0 + (high ? 13.12 : RSL), { c: high ? '#a8714f' : '#bcab90', noao: true });
    if (high) for (let i = 0; i < P.length; i++) { const E = edge(P, P[i], P[(i + 1) % P.length], y0); if (E.l > 1) fb(E.M, -E.l / 2, E.l / 2, 12.9, 14.1, -0.34, -0.06, '#c8b190'); }
  }
  rsAt.card('back', M, 0, 0, 0.02, 23.36, 14.2);
  fb(M, -11.7, 11.7, 11.75, 12.05, 0, 0.35, '#c99c5e'); fb(M, -11.7, 11.7, 14.0, 14.2, -0.3, 0.1, '#c4a470'); fb(M, -11.7, 11.7, 12.9, 14.1, -0.34, -0.06, '#c8b190');
  // the double stair: a landing over an arch, a flight running down to each side, stone balusters
  const LY = 5.2, LZ = 3.2, ST = '#d9d0bc';
  const front = shapeOf([[-3.0, 0], [3.0, 0], [3.0, LY], [-3.0, LY]]), hole = new THREE.Path();
  hole.moveTo(-1.3, 0.001); hole.lineTo(-1.3, 2.6); hole.absarc(0, 2.6, 1.3, PI, 0, true); hole.lineTo(1.3, 0.001); hole.closePath(); front.holes.push(hole);
  extrude('flat', front, 0.35, { M, p: [0, 0, LZ - 0.35], cs: 8, c: ST, noao: true });
  fb(M, -3.1, 3.1, LY - 0.2, LY + 0.05, 0, LZ + 0.1, '#c7bca4');
  balusRun(M, -2.95, LZ - 0.12, 2.95, LZ - 0.12, LY + 0.05, 1.0, '#ddd2ba');
  for (const s of [-1, 1]) {
    for (let i = 0; i < 15; i++) fb(M, s * (3.0 + i * 0.42), s * (3.42 + i * 0.42), 0, LY - (i + 0.5) * LY / 15.5, 0.05, LZ - 0.4, i % 2 ? '#aaa393' : '#bbb4a3');
    const cheek = [[3.0, 0], [9.3, 0], [9.3, 0.25], [3.0, LY]].map(([x, y]) => [s * x, y]);
    slab(M, s > 0 ? cheek : cheek.reverse(), LZ - 0.4, LZ - 0.05, ST);
    balusRun(M, s * 9.3, LZ - 0.22, s * 3.0, LZ - 0.22, 0.25, 0.95, '#ddd2ba', LY);
    for (const [x, y] of [[3.0, LY], [9.3, 0.2]]) fb(M, s * x - 0.22, s * x + 0.22, y - 0.2, y + 1.15, LZ - 0.45, LZ + 0.02, '#cfc2a6');
  }
  // the balconies of the courtyard front
  for (const x of [-8.75, 8.75]) fb(M, x - 1.25, x + 1.25, 5.2, 5.4, 0, 0.7, '#c2a674');
  const o = end('Villa Resuttano');
  o.userData.solids = [...RS_HI.map(f => [f, null, y0 + 13]), ...RS_LO.map(f => [f, null, y0 + RSL])];
  return o;
}
const rsWalls = () => run(mapW(RS_O, RS_N), [[-9.5, 0.1], [-9.5, 3.3], [9.5, 3.3], [9.5, 0.1]]);
{ const W = mapW(RS_O, RS_N); for (const [x, z, r] of [[0, 7, 7], [-8, 6, 5], [8, 6, 5], [0, 16, 5]]) TREE_CLEAR.push([...W(x, z).map(r1), r]); }

// =====================================================================================================
// Villa Bordonaro ai Colli
// =====================================================================================================
const BD = { id: 'w234822297', p: [-2126.4, -4512.3, -2149.7, -4546.3, -2101.3, -4579.0, -2077.1, -4543.9, -2083.2, -4539.7, -2099.6, -4563.7, -2134.2, -4540.3, -2118.6, -4517.6] };
// the mapped parts: the house, the tower storey over its middle, the two low arms with their terraces
const BD_MAIN = [-2142.2, -4535.3, -2094.2, -4568.5, -2102.7, -4578.1, -2149.7, -4546.2];
const BD_ARMS = [[-2094.2, -4568.5, -2100.5, -4564.2, -2099.6, -4563.7, -2083.3, -4539.9, -2077.2, -4544.1, -2100.2, -4577.6, -2102.7, -4578.1], [-2136.5, -4539.3, -2142.2, -4535.3, -2126.4, -4512.3, -2120.6, -4516.2]];
const BD_O = [-2116.9, -4552.0], BD_N = [0.56, 0.829], BDH = 11.8, BDL = 4.5, BDP = '#e2a982', BDTW = 4.6, BDTX = -0.9, BDT = 15.8;
function bdFrame(p, x, y0, y1, w, o = {}) {   // a window with its cream surround and hood, green shutters
  p.R(x - w / 2 - 0.28, y0 - 0.06, x + w / 2 + 0.28, y1 + 0.28, '#ecd0ae');
  if (o.hood) { p.R(x - w / 2 - 0.45, y1 + 0.42, x + w / 2 + 0.45, y1 + 0.62, '#f0d6b4'); p.R(x - w / 2 - 0.45, y1 + 0.36, x + w / 2 + 0.45, y1 + 0.42, 'rgba(110,60,35,0.45)'); }
  if (o.open) { win(p, x, y0, y1, w * 0.62, { f: 0, bar: '#e8e0d0' }); for (const s of [-1, 1]) win(p, x + s * w * 0.46, y0, y1, w * 0.3, { f: 0, shut: '#4f7656' }); }
  else win(p, x, y0, y1, w, { f: 0, shut: '#5a8262' });
}
const bdAt = atlas('v2Bord', 512, 192, 11, [
  ['front', 41.8, 11.8, 0, 0, (p) => {   // the courtyard front
    ground(p, BDP, 6501, 0.07); p.R(-20.9, 0, 20.9, 0.5, '#bda898');
    for (const x of [-17.4, -12.6, -7.3, 5.9, 11.4, 16.9]) { bdFrame(p, x, 4.55, 7.3, 1.35, { hood: true, open: Math.abs(x) < 8 }); bdFrame(p, x, 9.0, 10.35, 1.3); }
    for (const x of [-8.1, -4.5, 2.7, 6.1]) bdFrame(p, x, 1.0, 2.5, 1.25, { open: true });
    p.R(-2.5, 0, 0.7, 3.65, '#ecd0ae'); p.arch(BDTX, 0, 3.4, 2.4, '#33473a'); p.R(BDTX - 0.04, 0, BDTX + 0.04, 3.0, '#1c261f');
    bdFrame(p, BDTX, 4.55, 7.35, 1.5, { hood: true, open: true }); p.circ(BDTX, 9.2, 0.55, '#d9b48c'); p.circ(BDTX, 9.2, 0.3, '#c49a74');
    for (const x of [BDTX - BDTW - 0.2, BDTX + BDTW + 0.2, -20.6, 20.6]) { p.R(x - 0.16, 0, x + 0.16, 11.3, '#eac29c'); p.R(x + 0.16, 0, x + 0.24, 11.3, 'rgba(110,60,35,0.25)'); }
    p.R(-20.9, 11.25, 20.9, 11.8, '#eecfae'); p.R(-20.9, 11.1, 20.9, 11.25, 'rgba(100,55,30,0.4)');
    wear(p, 6502, 24, 0.07);
  }],
  ['bay', 4.5, 11.8, 462, 0, (p) => { ground(p, BDP, 6511, 0.07); p.R(-2.25, 0, 2.25, 0.5, '#bda898'); p.R(-2.25, 11.25, 2.25, 11.8, '#eecfae'); p.R(-2.25, 11.1, 2.25, 11.25, 'rgba(100,55,30,0.4)'); wear(p, 6512, 8, 0.09); }],
  ['tower', 9.2, 4.0, 0, 134, (p) => {   // the storey that rises over the middle, from the house's cornice up
    ground(p, BDP, 6521, 0.07);
    for (const x of [-2.9, 0, 2.9]) bdFrame(p, x, 0.15, 2.4, 1.15, { hood: true });
    for (const x of [-4.4, 4.4]) p.R(x - 0.2, 0, x + 0.2, 3.55, '#eac29c');
    p.R(-4.6, 3.45, 4.6, 4.0, '#eecfae'); p.R(-4.6, 3.3, 4.6, 3.45, 'rgba(100,55,30,0.4)');
    wear(p, 6522, 8, 0.06);
  }],
  ['arm', 4.5, 4.5, 104, 134, (p) => { ground(p, BDP, 6531, 0.07); p.R(-2.25, 0, 2.25, 0.45, '#bda898'); p.R(-2.25, 3.95, 2.25, 4.5, '#eecfae'); p.R(-2.25, 3.8, 2.25, 3.95, 'rgba(100,55,30,0.4)'); wear(p, 6532, 6, 0.1); }],
]);
// an iron balcony front of width w, standing at (x, y) before the wall at depth z
function bars(M, x, y, w, z, n) { for (const h of [0.08, 0.98]) fb(M, x - w / 2, x + w / 2, y + h, y + h + 0.07, z - 0.03, z + 0.03, '#26262a'); for (let k = 0; k <= n; k++) { const u = x - w / 2 + k * w / n; fb(M, u - 0.025, u + 0.025, y, y + 1.0, z - 0.025, z + 0.025, '#26262a'); } }
// the octagonal basin of the courtyard (the mapped water)
const BDF = [-2107.4, -4538.8], BDFR = 5.2;
const octo = (c, r, a0 = PI / 8) => Array.from({ length: 8 }, (_, i) => [c[0] + Math.cos(a0 + i * PI / 4) * r, c[1] + Math.sin(a0 + i * PI / 4) * r]);
function buildBordonaro() {
  initShared(); bdAt.def();
  const all = pairsOf(BD.p), S = place(BD_O, BD_N, all), { M, y0 } = S, MAIN = pairsOf(BD_MAIN);
  begin(y0);
  const walls = (P, name, H, skip) => { prism('flat', P, S.lo, y0 + 0.02, { c: '#a98d74', noao: true }); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (skip === i || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.0) continue; const g = Math.min(y0, groundY(...a), groundY(...b)); bdAt.wall(name, P, a, b, g, y0 - g + H); } };
  walls(MAIN, 'bay', BDH, 0);
  bdAt.card('front', M, 0, 0, 0.02, 41.8, BDH);
  { const E = edge(MAIN, MAIN[0], MAIN[1], y0); if (E.l > 42.2) { const k = (E.l - 41.8) / 2; for (const s of [-1, 1]) bdAt.card('bay', E.M, s * (E.l / 2 - k / 2), 0, 0, k, BDH, 0.4, 0.6); } }
  fb(M, -21, 21, BDH - 0.35, BDH, 0, 0.35, '#e9c7a4');
  // roofs: low tile hips over the house, clear of the tower
  prism('flat', MAIN, y0 + BDH - 0.12, y0 + BDH + 0.04, { c: '#b98262', noao: true });
  for (const [x0, x1] of [[-20.4, BDTX - BDTW - 0.1], [BDTX + BDTW + 0.1, 20.4]]) hip([S.W(x0, -0.5), S.W(x1, -0.5), S.W(x1, -11.2), S.W(x0, -11.2)], y0 + BDH + 0.04, 2.0, '#c4764e');
  // the tower storey, its long balcony and its pyramid of tiles
  { const D = 11.2, h = BDT - BDH, T = [S.W(BDTX - BDTW, 0), S.W(BDTX + BDTW, 0), S.W(BDTX + BDTW, -D), S.W(BDTX - BDTW, -D)];
    for (let i = 0; i < 4; i++) { const a = T[i], b = T[(i + 1) % 4], E = edge(T, a, b, y0 + BDH); bdAt.card('tower', E.M, 0, 0, 0.03, E.l, h); fb(E.M, -E.l / 2 - 0.3, E.l / 2 + 0.3, h - 0.25, h + 0.05, -0.1, 0.35, '#eecfae'); }
    hip(T, y0 + BDT + 0.05, 1.7, '#bf6e4a'); prism('flat', T, y0 + BDT - 0.05, y0 + BDT + 0.06, { c: '#b98262', noao: true });
    fb(M, BDTX - 4.4, BDTX + 4.4, BDH - 0.05, BDH + 0.15, 0, 0.8, '#d8c0a4'); bars(M, BDTX, BDH + 0.15, 8.7, 0.75, 22); }
  // balconies of the middle floor
  for (const x of [-7.3, BDTX, 5.9]) { fb(M, x - 1.2, x + 1.2, 4.35, 4.55, 0, 0.75, '#d8c0a4'); bars(M, x, 4.55, 2.35, 0.72, 7); }
  // the two low arms and the balustrades of their terraces
  for (const f of BD_ARMS) { const P = pairsOf(f); walls(P, 'arm', BDL); prism('flat', P, y0 + BDL - 0.15, y0 + BDL, { c: '#c9b6a0', noao: true }); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], E = edge(P, a, b, y0), n = new THREE.Vector3().setFromMatrixColumn(E.M, 2); if (E.l < 2 || (E.l < 12 && n.x * S.W.n[0] + n.z * S.W.n[1] < -0.7)) continue; crown(P, a, b, y0 + BDL, 1.0, '#cbbda8', 4.4, false); } }
  // the basin: a stone kerb round the water, a pedestal and a bowl in the middle
  { const R = octo(BDF, BDFR), fy = groundY(...BDF);
    for (let i = 0; i < 8; i++) { const E = edge(R, R[i], R[(i + 1) % 8], fy); fb(E.M, -E.l / 2 - 0.1, E.l / 2 + 0.1, -0.5, 0.55, -0.35, 0.05, '#b9ae9c'); fb(E.M, -E.l / 2 - 0.15, E.l / 2 + 0.15, 0.55, 0.68, -0.45, 0.12, '#cfc5b2'); }
    prism('flat', octo(BDF, BDFR - 0.3), fy - 0.2, fy + 0.3, { c: '#3f5c50', noao: true });
    cyl('flat', 0.45, 0.65, 1.1, 8, { p: [BDF[0], fy + 0.2, BDF[1]], c: '#b5aa96', noao: true }); cyl('flat', 1.1, 0.35, 0.4, 10, { p: [BDF[0], fy + 1.3, BDF[1]], c: '#c5bba6', noao: true }); cyl('flat', 0.12, 0.28, 1.1, 6, { p: [BDF[0], fy + 1.7, BDF[1]], c: '#b5aa96', noao: true }); }
  const o = end('Villa Bordonaro');
  o.userData.solids = [[BD_MAIN, null, y0 + BDH], ...BD_ARMS.map(f => [f, null, y0 + BDL])];
  return o;
}
const bdWalls = () => { const R = octo(BDF, BDFR + 0.1); return R.map((a, i) => [...a, ...R[(i + 1) % 8]]).map(s => s.map(r1)); };
{ const W = mapW(BD_O, BD_N); for (const [x, z, r] of [[0, 8, 9], [-9, 8, 8], [9, 8, 8], [0, 20, 10], [-12, 20, 8], [12, 20, 8], [0, 32, 7]]) TREE_CLEAR.push([...W(x, z).map(r1), r]); }

// =====================================================================================================
// Museo Pitre: the two service buildings of the Palazzina Cinese (the Palazzina itself is src/lmc-f.js)
// =====================================================================================================
const MP = { east: 'w253476274', west: 'w253476282' };
const MPE = [-2682.6, -5664.3, -2693.4, -5684.1, -2663.8, -5699.4, -2635.8, -5645.9, -2642.4, -5642.6, -2648.6, -5639.4, -2660.7, -5662.5, -2654.0, -5666.0, -2656.4, -5670.5, -2659.2, -5675.9, -2666.9, -5671.9, -2673.1, -5683.5, -2674.8, -5682.6, -2677.9, -5681.0, -2672.1, -5669.8];
const MPW = [-2676.9, -5653.7, -2665.2, -5659.8, -2653.2, -5637.3, -2664.7, -5631.3];
const MPWF = [-2664.7, -5631.3, -2653.2, -5637.3, -2661.3, -5649.8, -2671.8, -5644.4], MPD = [-2664.6, -5641.3];   // the front block under the drum, and the drum's centre
const MP_O = [-2642.2, -5642.65], MP_N = [0.453, 0.892], MPH = 6.8;
function mpLattice(p, x0, x1, y0, y1, bg, line) { p.R(x0, y0, x1, y1, bg); p.g.save(); p.g.beginPath(); p.g.rect(p.X(x0), p.Y(y1), (x1 - x0) * p.sx, (y1 - y0) * p.sy); p.g.clip(); const d = 0.36; for (let x = x0 - (y1 - y0); x < x1; x += d) { p.line(x, y0, x + (y1 - y0), y1, 0.06, line); p.line(x + (y1 - y0), y0, x, y1, 0.06, line); } p.g.restore(); }
function mpShutter(p, x, y0, y1, w, arch) { if (arch) { p.arch(x, y0, y1 + 0.2, w + 0.36, '#d9894a'); p.arch(x, y0, y1, w, '#74b3a0'); } else { p.R(x - w / 2 - 0.16, y0, x + w / 2 + 0.16, y1 + 0.16, '#cf7a3e'); p.R(x - w / 2, y0, x + w / 2, y1, '#74b3a0'); } for (let y = y0 + 0.14; y < y1 - (arch ? 0.35 : 0.05); y += 0.15) p.R(x - w / 2 + 0.06, y, x + w / 2 - 0.06, y + 0.045, 'rgba(20,60,50,0.5)'); p.R(x - 0.025, y0, x + 0.025, y1, '#356a5c'); }
const mpAt = atlas('v2Pitre', 512, 192, 20, [
  ['pav', 14.4, 6.8, 0, 0, (p) => {   // between the turrets: dark red below, orange above
    ground(p, '#a64a22', 6601, 0.1); p.R(-7.2, 0, 7.2, 3.4, '#84301c'); p.R(-7.2, 0, 7.2, 0.5, '#7d756c');
    p.R(-7.2, 2.95, 7.2, 3.35, '#772818'); p.R(-7.2, 6.15, 7.2, 6.8, '#8a2c1c'); for (let x = -7.1; x < 7.2; x += 0.36) p.poly([[x, 6.22], [x + 0.18, 6.6], [x + 0.36, 6.22]], '#b86c34');
    p.R(-0.35, 0, 1.75, 2.35, '#5a2416'); p.R(-0.15, 0, 1.55, 2.2, '#1d1712'); for (let k = 0; k < 5; k++) { p.line(0.75 + k * 0.16, 0.1, 0.75 + k * 0.16, 2.15, 0.025, '#77736a'); p.line(0.75, 0.3 + k * 0.42, 1.52, 0.3 + k * 0.42, 0.025, '#77736a'); }
    for (const x of [0.15, 1.25]) { p.R(x - 0.55, 2.25, x + 0.55, 2.95, '#7a3a1c'); p.circ(x, 2.6, 0.25, '#b0702e'); }
    for (const x of [-2.7, 3.9]) { p.circ(x, 1.75, 0.27, '#d08a52'); p.circ(x, 1.75, 0.19, '#9b3a22'); }
    mpShutter(p, -3.2, 3.4, 5.75, 1.35); mpShutter(p, 0.75, 3.4, 5.55, 1.15, true); mpShutter(p, 4.0, 3.4, 5.2, 1.05);
    for (const x of [-3.2, 0.75, 4.0]) p.poly([[x - 0.7, 5.9], [x + 0.7, 5.9], [x, x === 0.75 ? 6.75 : 6.35]], '#a63d24');
    wear(p, 6602, 8, 0.06);
  }],
  ['turret', 2.3, 8.2, 290, 0, (p) => {
    ground(p, '#92391f', 6611, 0.1); p.R(-1.15, 0, 1.15, 0.5, '#7d756c');
    mpLattice(p, -1.15, 1.15, 7.2, 8.0, '#a85626', '#cf9a52'); mpLattice(p, -0.95, -0.35, 4.6, 6.85, '#87301c', '#bc7038'); mpLattice(p, 0.35, 0.95, 4.6, 6.85, '#87301c', '#bc7038'); mpLattice(p, -1.15, 1.15, 3.75, 4.55, '#a85626', '#cf9a52');
    p.R(-0.28, 3.4, 0.28, 6.6, '#2a1710'); ironRail(p, -0.4, 0.4, 3.4, 1.15);
    for (const y of [3.25, 6.95, 8.05]) p.R(-1.15, y, 1.15, y + 0.15, '#e0a860');
    p.circ(0, 1.65, 0.27, '#d9a070'); p.circ(0, 1.65, 0.18, '#a84525');
    wear(p, 6612, 6, 0.07);
  }],
  ['cream', 4, 6.8, 340, 0, (p) => { ground(p, '#e3c9a0', 6621, 0.06); p.R(-2, 0, 2, 0.5, '#9a8a74'); mpShutter(p, 0, 3.9, 5.7, 0.95); mpShutter(p, 0, 1.0, 2.6, 0.95); p.R(-2, 6.4, 2, 6.8, '#d9b988'); wear(p, 6622, 8, 0.09); }],
  ['pink', 4, 7.5, 424, 0, (p) => { ground(p, '#dcb095', 6631, 0.06); p.R(-2, 0, 2, 0.6, '#9a8a74'); p.arch(0, 1.6, 4.9, 1.9, '#cfc4b0'); p.arch(0, 1.75, 4.7, 1.55, '#4a4a48'); p.line(-0.78, 3.3, 0.78, 3.3, 0.07, '#cfc4b0'); p.line(0, 1.75, 0, 4.7, 0.07, '#cfc4b0'); p.R(-2, 6.5, 2, 6.85, '#b4513a'); p.R(-2, 7.2, 2, 7.5, '#d8c3ac'); wear(p, 6632, 8, 0.08); }],
]);
// a pagoda roof: rings [half width, half depth, y] round (cx, cz) of M, the sides cut in strips of two tones for the ribs
function flare(M, cx, cz, rings, c1, c2, strips) {
  const quads = { [c1]: [], [c2]: [] };
  const at = (r, side, u) => { const [w, d, y] = r, a = u * 2 - 1; return side === 0 ? [cx + a * w, y, cz + d] : side === 1 ? [cx + w, y, cz - a * d] : side === 2 ? [cx - a * w, y, cz - d] : [cx - w, y, cz + a * d]; };
  for (let k = 0; k + 1 < rings.length; k++) for (let s = 0; s < 4; s++) for (let i = 0; i < strips; i++) {
    const u0 = i / strips, u1 = (i + 1) / strips, a = at(rings[k], s, u0), b = at(rings[k], s, u1), c = at(rings[k + 1], s, u1), d = at(rings[k + 1], s, u0), V = quads[i % 2 ? c2 : c1];
    V.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (const c in quads) { const V = quads[c]; if (!V.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(V.length / 3 * 2), 2)); part('flat', g, { M, c, noao: true }); }
}
function buildPitre() {
  initShared(); mpAt.def();
  const E = pairsOf(MPE), Wp = pairsOf(MPW), F = pairsOf(MPWF), S = place(MP_O, MP_N, [...E, ...Wp]), { M, y0 } = S;
  begin(y0);
  const wallsOf = (P, name, H, skip) => { prism('flat', P, S.lo, y0 + 0.02, { c: '#a99478', noao: true }); for (let i = 0; i < P.length; i++) { if (skip && skip(i)) continue; const a = P[i], b = P[(i + 1) % P.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.9) continue; const g = Math.min(y0, groundY(...a), groundY(...b)); mpAt.wall(name, P, a, b, g, y0 - g + H); } };
  // the long building round its court: cream with green shutters; its south end is the little pavilion
  wallsOf(E, 'cream', MPH, (i) => i === 3 || i === 4);
  prism('flat', E, y0 + MPH - 0.15, y0 + MPH, { c: '#b49a84', noao: true });
  hip([[-2639.9, -5652.8], [-2661.4, -5693.9], [-2666.7, -5691.1], [-2645.2, -5650.0]], y0 + MPH, 1.4, '#8d887e');
  for (const x of [-7.2, 4.9]) { fb(M, x, x + 2.3, 0, 8.2, -2.2, 0.15, '#8a361e'); mpAt.card('turret', M, x + 1.15, 0, 0.17, 2.3, 8.2); for (const s of [-1, 1]) mpAt.card('turret', mul(M, mul(tr(x + 1.15 + s * 1.17, 0, -1.02), rotY(s * PI / 2))), 0, 0, 0, 2.35, 8.2);
    const cx = x + 1.15;
    flare(M, cx, -1.02, [[1.75, 1.75, 8.15], [1.55, 1.55, 8.42]], '#8e6a2a', '#a98438', 7);
    flare(M, cx, -1.02, [[1.55, 1.55, 8.42], [0.95, 0.95, 8.6], [0.55, 0.55, 9.05], [0.04, 0.04, 10.25]], '#a8402a', '#b9503a', 5);
    cyl('flat', 0.025, 0.025, 1.1, 4, { M, p: [cx, 10.2, -1.02], c: '#222222', noao: true }); }
  mpAt.card('pav', M, 0.05, 0, 0.02, 9.75, 6.8, (7.2 - 4.88) / 14.4, (7.2 + 4.88) / 14.4);
  // the tent roof between the turrets and the small pagoda on it
  flare(M, 0.05, -3.9, [[5.15, 4.15, 6.75], [4.7, 3.75, 7.0], [3.0, 2.3, 7.65], [1.9, 1.35, 8.5], [1.5, 1.05, 9.15]], '#b4863a', '#c99e4e', 9);
  flare(M, 0.05, -3.9, [[2.15, 1.7, 9.05], [1.9, 1.45, 9.4]], '#8e6a2a', '#a98438', 8);
  flare(M, 0.05, -3.9, [[1.9, 1.45, 9.4], [0.9, 0.7, 9.65], [0.45, 0.35, 10.15], [0.04, 0.04, 10.9]], '#a8402a', '#b9503a', 5);
  fb(M, -4.9, 5.0, 6.65, 6.8, -0.25, 0.25, '#c8853a');
  // the balcony with its iron rail, swelling out over the door on two thin posts
  fb(M, -4.9, 5.0, 3.2, 3.4, 0, 0.85, '#a34a26'); fb(M, -0.2, 3.5, 3.2, 3.4, 0.85, 1.35, '#a34a26');
  for (const [x0, z0, x1, z1] of [[-4.9, 0.82, -0.2, 0.82], [-0.2, 0.82, -0.2, 1.32], [-0.2, 1.32, 3.5, 1.32], [3.5, 1.32, 3.5, 0.82], [3.5, 0.82, 4.95, 0.82]]) { const l = Math.hypot(x1 - x0, z1 - z0); panel('rail', l, 1.15, { M: mul(M, mul(tr((x0 + x1) / 2, 3.4, (z0 + z1) / 2), rotY(Math.atan2(-(z1 - z0), x1 - x0)))), uvk: [l * 2.2, 1] }); fb(mul(M, mul(tr((x0 + x1) / 2, 3.4, (z0 + z1) / 2), rotY(Math.atan2(-(z1 - z0), x1 - x0)))), -l / 2, l / 2, 0.55, 0.61, -0.02, 0.02, '#2a2a30'); }
  for (const x of [0.25, 3.05]) cyl('flat', 0.06, 0.07, 3.25, 6, { M, p: [x, 0, 1.2], c: '#33363a', noao: true });
  // the gate of the court, its leaves open against the walls
  for (const [x, s] of [[-7.35, 1], [-11.9, -1]]) { const L = mul(M, mul(tr(x, 0, -0.4), rotY(PI / 2))); for (let k = 0; k <= 6; k++) fb(L, k * 0.3 - 0.02, k * 0.3 + 0.02, 0.1, 2.6, s * 0.02, s * 0.06, '#1f2022'); for (const y of [0.2, 1.7, 2.45]) fb(L, 0, 1.8, y, y + 0.07, s * 0.01, s * 0.07, '#1f2022'); }
  // the other building: a low back range, the square front block and the round hall with its shallow dome
  wallsOf(Wp, 'cream', 5.6);
  prism('flat', Wp, y0 + 5.45, y0 + 5.6, { c: '#b9a890', noao: true });
  for (let i = 0; i < 4; i++) { const a = F[i], b = F[(i + 1) % 4], Ed = edge(F, a, b, y0); const g = Math.min(y0, groundY(...a), groundY(...b)), push = tr(0, 0, 0.04); mpAt.card('pink', mul(Ed.M, mul(push, tr(0, g - y0, 0))), -Ed.l / 4, 0, 0, Ed.l / 2, y0 - g + 7.5); mpAt.card('pink', mul(Ed.M, mul(push, tr(0, g - y0, 0))), Ed.l / 4, 0, 0, Ed.l / 2, y0 - g + 7.5); fb(Ed.M, -Ed.l / 2 - 0.15, Ed.l / 2 + 0.15, 7.45, 7.65, -0.25, 0.15, '#d8c3ac'); }
  prism('flat', F, y0 + 7.3, y0 + 7.45, { c: '#b7aca0', noao: true });
  const DM = frame(MPD[0], y0, MPD[1], 0, 1);
  const ringAt = (r0, r1, a, b, c, seg = 16) => cyl('flat', r1, r0, b - a, seg, { M: DM, p: [0, a, 0], c, open: true, noao: true });
  ringAt(5.3, 5.3, 7.4, 8.4, '#dcb598'); ringAt(5.4, 5.4, 8.4, 8.75, '#b4513a'); ringAt(5.35, 5.35, 8.75, 9.35, '#5f8a62'); ringAt(5.55, 5.55, 9.35, 9.55, '#cfc4ae');
  for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI; fb(mul(DM, rotY(a)), -0.16, 0.16, 8.85, 9.25, 5.3, 5.42, '#c9c29a'); }
  const prof = [[5.45, 9.55], [5.0, 10.15], [4.1, 10.8], [2.8, 11.35], [1.3, 11.7], [0.35, 11.8]];
  for (let k = 0; k + 1 < prof.length; k++) ringAt(prof[k][0], prof[k + 1][0], prof[k][1], prof[k + 1][1], k % 2 ? '#8f8a7c' : '#999386');
  cyl('flat', 0.3, 0.6, 0.6, 8, { M: DM, p: [0, 11.75, 0], c: '#e4dfd0', noao: true }); cyl('flat', 0.06, 0.08, 2.1, 5, { M: DM, p: [0, 12.3, 0], c: '#3a3a38', noao: true });
  for (let k = 0; k < 4; k++) cyl('flat', 0.42 - k * 0.07, 0.42 - k * 0.07, 0.09, 8, { M: DM, p: [0, 12.6 + k * 0.42, 0], c: k % 2 ? '#cdb25a' : '#d8d2c0', noao: true });
  sphere('flat', 0.14, { M: DM, p: [0, 14.45, 0], seg: 6, c: '#cdb25a', noao: true });
  const o = end('Museo Pitre');
  o.userData.solids = [[MPE, null, y0 + MPH - 0.2], [MPW, null, y0 + 5.4], [MPWF, null, y0 + 7.3]];
  return o;
}
const mpWalls = () => run(mapW(MP_O, MP_N), [[0.0, 0.1], [0.0, 1.45], [3.3, 1.45], [3.3, 0.1]]);   // the two posts before the door
{ const W = mapW(MP_O, MP_N); for (const [x, z, r] of [[0, 5, 5], [-5, 5, 4], [5, 5, 4], [0, 11, 5], [-9.5, 1, 3]]) TREE_CLEAR.push([...W(x, z).map(r1), r]); }

export const R2_V2 = [
  { name: 'Villa Boscogrande', x: -5414, z: -6747, radius: 75, skipIds: [BO.id], build: buildBosco, walls: boWalls() },
  { name: 'Villa Lampedusa', x: -2866, z: -5422, radius: 75, skipIds: LA.map(q => q[0]), build: buildLampedusa, walls: laWalls() },
  { name: 'Villa Pantelleria', x: -3502, z: -4741, radius: 40, skipIds: [PT.id], build: buildPantelleria },
  // (the strip before the end front lies in the next tile, and a model only hides footprints of its own)
  { name: 'Villa Pantelleria forecourt', x: -3489, z: -4755, radius: 10, skipIds: ['w280098820'], dropWalls: ['w280098820'], build: () => { begin(0); return end('Villa Pantelleria forecourt'); } },
  { name: 'Villa Resuttano', x: -2352, z: -3876, radius: 55, skipIds: [RS.id], build: buildResuttano, walls: rsWalls() },
  { name: 'Villa Bordonaro', x: -2114, z: -4546, radius: 55, skipIds: [BD.id], build: buildBordonaro, walls: bdWalls() },
  { name: 'Museo Pitre', x: -2662, z: -5655, radius: 50, skipIds: [MP.east, MP.west], build: buildPitre, walls: mpWalls() },
];
