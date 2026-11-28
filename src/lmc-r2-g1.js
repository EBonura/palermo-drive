// Round 2 landmarks, batch G1: four old city gates and two stretches of the city walls. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Positions come from the footprints and the mapped walls of the world tiles, checked on the Regione Siciliana orthophoto (SITR, 15 cm, 2013).
// Heights were read by fitting the camera of a photo to those points, so take them as good to about half a metre (the bastion less, see below).
// Frames: origin on the ground in the middle of the front, +z out of the front, local x to the right as seen from outside.
//
// Porta di Vicari (Porta Sant'Antonino): two facing fronts on the corners of Via Maqueda, no arch. Commons: "Porta di Vicari (Palermo) 20 06 2026 01/02", "14 07 2024 01/02", "Porta Sant'Antonino".
//  Read: ochre plaster; two high pedestals, two Doric columns, an arched niche, a frieze of three carved panels under a deep cornice, a balustraded attic; between the pedestals a grey fountain with a mask
//  over a small and a large basin; a barred window on the west front, a plaque on the east one; a pale wall that rises behind the east attic. Heights from the 2026 photo: columns to 12.4 m, cornice 15.8 m, top 20 m.
//  The house the west front stands against (w279883690) is drawn here too, plain, because the generic facade's balconies came through the columns.
//  Not verified: the backs and sides (plain), the carving of the panels and of the masks, the exact windows of that house (green shutters and balconies as in the photos, their spacing by eye).
// Porta Mazzara (w153619353): the ruined gate wall behind its railing in Via dei Benedettini. Commons: "Porta di Mazzara-1", "Porta Mazzara (Palermo)"; Mapillary 488981212444419 (2015), 817120969177683 (2021).
//  Read: weathered tuff rubble with patches of render, a tall pointed arch with a lower arch inside it, a narrow open doorway on the left and a dark one on the right, two stone brackets with a ledge over the arch,
//  the line of an old stair, a stepped scrap of wall on the crest and a pinnacle at the right end, tufts of grass; lower wall and a low tiled shed to the right; iron railing along the pavement.
//  Not verified: the back of the wall, the north west part behind the shed (drawn plain), the coats of arms.
// Porta dei Leoni (Parco della Favorita): two stone pylons with reclining lionesses and the lodge beside them. Commons "Porta dei Leoni" (2020); the photo on lasiciliainrete.it, page "Porta dei Leoni";
//  Mapillary 656996938465436, 593968801579130 (2017). Read: pale stained stone, sunk panels, REAL TENUTA on the north pylon and LA FAVORITA on the south one, deep mouldings, lions with headdresses;
//  a low weathered lodge with a tiled hip roof against the north pylon. Not verified: the far faces of the pylons, the park side and north side of the lodge, whether the northern way in ever had pylons of its own (none drawn).
// Porta Reale: two tall pilastered fronts on the corners of the street that leaves Piazzetta Porta Reale, no arch. Commons "Porta Reale" (2019), "Porta Reale (Palermo) 24 05 2026 01".
//  Read: stained ochre stone, two flat pilasters with capitals on a plinth, a heavy cornice, an attic with two finials, a white name plaque on the east front. Cornice about 13.5 m, attic about 16.5 m.
//  Not verified: the sides and backs. The curved orange buildings beside them are left to the generic builder.
// Mura delle Cattive: the sea wall of the Passeggiata between Piazza Santo Spirito and Porta Felice. Commons "Palermo-Mura-delle-Cattive-bjs2007-01", "Porta Felice (Palermo) msu2017-0112", "Steri PA 06 04 2019 34",
//  "Passeggiata delle Cattive (Palermo) 21 06 2026 01". Read: golden rusticated stone with a cornice and parapet about 7 m high; beside Porta Felice an open loggia of five flat headed bays between battered piers,
//  stone bollards before it; behind it the broad stair with two carved posts, urns and iron gates. The mapped wall (fences, kind c) stays inside the new skin and keeps its collision; only the stretch where the
//  loggia stands is taken out. The loggia is closed to traffic, as the bollards show. Not verified: the walk on top (it stays at street level, as mapped, so the stair ends in a blank terrace end),
//  the plaques, the small stair at the Santo Spirito end, the shape of the carved posts, the length of the upper flight.
// Mura di Palermo, Corso Alberto Amedeo: the bastion north of Porta Nuova (the one with the garden on top), which the game did not draw. Commons "Palermo mura" (Category:Corso Alberto Amedeo);
//  Mapillary 492531535298991 (2021), 269072581606078 (2018), 482382499701659 (2015). Read: a high battered wall of grey tan rubble stone with a sharp corner to the north, a round moulding under the top, trees and
//  a tall palm over it. Height from a single street frame, about 10 m (rough). Not verified: the garden inside, the east end of the north face, the tree positions. The Wikidata point of "Mura di Palermo" lies on
//  the walls of the Palazzo Reale at Piazza Indipendenza, which the map data already draws; they are unchanged.
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, sphere, lathe, extrude, prism, part, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, RNG } from './lmc-kit.js';
import { TREE_CLEAR } from './tree-clear.js';

// ---- shared helpers
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
// a flat painted face: the shape's own metres pick the part of a canvas that covers FW x FH metres (x centred, y up from the ground)
const face = (key, M, shape, z, FW, FH, uo = 0.5) => part(key, new THREE.ShapeGeometry(shape, 6), { M: mul(M, tr(0, 0, z)), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [uo, 0], noao: true });
// canvas painter in metres
function painter(g, w, h, FW, FH, x0 = -FW / 2) {
  const sx = w / FW, sy = h / FH, X = x => (x - x0) * sx, Y = y => h - y * sy;
  const R = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  const poly = (p, col) => { g.fillStyle = col; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const line = (a, b, c, d, t, col) => { g.strokeStyle = col; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(a), Y(b)); g.lineTo(X(c), Y(d)); g.stroke(); };
  const arch = (x, y0, y1, ww, col) => { const r = ww / 2; g.fillStyle = col; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const blob = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); };
  return { R, poly, line, arch, blob, X, Y, sx, sy };
}
// the outline of a thing standing before a frame, as wall segments in world metres
const wallsOf = (M, L) => { const P = L.map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(M)); return P.slice(1).map((b, i) => [P[i].x, P[i].z, b.x, b.z]); };
const pathWalls = (P) => P.slice(1).map((b, i) => [P[i][0], P[i][1], b[0], b[1]]);
// the unit outer normal of each stretch of a line of [x, z] (side +1 or -1 picks the side), and at each corner the mitre that a unit offset moves along
function mitres(line, side) {
  const seg = line.slice(1).map((b, i) => { const dx = b[0] - line[i][0], dz = b[1] - line[i][1], l = Math.hypot(dx, dz) || 1; return [side * dz / l, -side * dx / l, dx / l, dz / l]; });
  const at = line.map((p, j) => { const a = seg[Math.max(0, j - 1)], b = seg[Math.min(seg.length - 1, j)], k = 1 + a[0] * b[0] + a[1] * b[1]; return [(a[0] + b[0]) / k, (a[1] + b[1]) / k]; });
  return { seg, at };
}
const offsetLine = (line, side, d) => { const m = mitres(line, side).at; return line.map((p, j) => [p[0] + m[j][0] * d, p[1] + m[j][1] * d]); };
// A long wall along a line of [x, z]: the profile [[offset to the outer side, height over `top`]] is swept along it with mitred corners, so a wall costs two triangles per face and stretch.
// side +1 or -1 picks the outer side. The first and last profile points are the foot: they follow the ground of each corner.
function ribbon(key, line, prof, top, side, o = {}) {
  const { seg: segN, at: mit } = mitres(line, side);
  const S = [0]; for (let j = 1; j < line.length; j++) S.push(S[j - 1] + Math.hypot(line[j][0] - line[j - 1][0], line[j][1] - line[j - 1][1]));
  const n = prof.length, foot = i => !o.band && (i === 0 || i === n - 1);
  const P = prof.map((q, i) => line.map((p, j) => [p[0] + mit[j][0] * q[0], foot(i) ? Math.min(groundY(p[0], p[1]), top) + q[1] : top + q[1], p[1] + mit[j][1] * q[0]]));
  const V = [0]; for (let i = 1; i < n; i++) V.push(V[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const T = o.tm || [3.3, 3.3];
  gridMesh(key, P, (i, j) => [S[j] / T[0], V[i] / T[1]], { flip: side > 0, c: o.c, noao: o.noao });
  if (o.band) return;
  // the two ends, closed
  for (const [j, sg] of [[0, -1], [line.length - 1, 1]]) {
    const pts = P.map(r => r[j]), tri = THREE.ShapeUtils.triangulateShape(prof.map((q, i) => new THREE.Vector2(q[0], pts[i][1])), []);
    const t = segN[sg < 0 ? 0 : segN.length - 1], pos = [], uv = [];
    for (const f of tri) {
      const [a, b, c] = f.map(i => new THREE.Vector3(...pts[i])), nn = b.clone().sub(a).cross(c.clone().sub(a)), ok = (nn.x * t[2] + nn.z * t[3]) * sg > 0;
      for (const i of ok ? f : [f[0], f[2], f[1]]) { pos.push(...pts[i]); uv.push(prof[i][0] / T[0], pts[i][1] / T[1]); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    part(key, g, { uv: 'keep', c: o.c, noao: o.noao });
  }
}
// an iron gate or railing drawn as bars (shared flat material)
function bars(M, x0, x1, y0, y1, z, step = 0.22, c = '#26242a') {
  for (let x = x0; x <= x1 + 0.01; x += step) bx('flat', M, x - 0.025, x + 0.025, y0, y1, z - 0.02, z + 0.02, { c, noao: true });
  for (const y of [y0 + 0.15, y1 - 0.3]) bx('flat', M, x0, x1, y, y + 0.06, z - 0.03, z + 0.03, { c, noao: true });
}

// =====================================================================================================
// Porta di Vicari: the two fronts
// =====================================================================================================
const VW = 5.8, VH = 20.1, VOCH = '#caa674', VDARK = '#ab8d66', VGREY = '#b4ac9c';
const VIC_E = { c: [338.84, 613.1], depth: 2.7 }, VIC_W = { c: [321.5, 619.66], depth: 1.6 }, VN = [0.413, 0.911];
function vicFront(g, w, h) {
  const p = painter(g, w, h, VW, VH), { R, arch, line } = p;
  g.fillStyle = VOCH; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, 900, 2.2, 5101, ['rgba(120,85,50,0.10)', 'rgba(255,240,205,0.10)']);
  const r = RNG(5102);
  for (let i = 0; i < 26; i++) p.blob(-2.9 + r() * 5.8, r() * r() * 4.4, 0.2 + r() * 0.55, 0.12 + r() * 0.45, r() < 0.5 ? 'rgba(232,216,184,0.55)' : 'rgba(110,80,50,0.28)');   // peeled render at the foot
  // the niche between the columns: a moulded frame, the hollow in shade on its upper left, a sill
  arch(0, 5.55, 10.85, 3.15, '#dcba88'); arch(0, 5.55, 10.55, 2.6, '#a98a62'); arch(0.22, 5.55, 10.3, 2.15, '#c09c6c');
  R(-1.85, 5.3, 1.85, 5.58, '#dcbb8a'); R(-1.85, 5.1, 1.85, 5.3, 'rgba(70,45,25,0.35)'); R(-1.55, 8.9, -1.25, 9.1, '#dcbb8a'); R(1.25, 8.9, 1.55, 9.1, '#dcbb8a');
  // entablature: architrave lines, the frieze with triglyphs and three carved panels, shadow under the cornice
  R(-VW / 2, 12.35, VW / 2, 13.3, '#c2a070'); R(-VW / 2, 12.78, VW / 2, 12.86, 'rgba(70,45,25,0.35)'); R(-VW / 2, 13.2, VW / 2, 13.34, '#dcbd8c');
  R(-VW / 2, 13.34, VW / 2, 14.5, '#bd9c6e');
  for (let i = 0; i < 4; i++) { const x = -2.45 + i * 1.633; for (let k = -1; k <= 1; k++) R(x + k * 0.15 - 0.04, 13.4, x + k * 0.15 + 0.04, 14.4, 'rgba(75,50,28,0.5)'); }
  for (const x of [-1.63, 0, 1.63]) {
    R(x - 0.52, 13.4, x + 0.52, 14.44, '#cfb085'); R(x - 0.44, 13.48, x + 0.44, 14.36, '#9f8360');
    for (let k = 0; k < 16; k++) p.blob(x - 0.36 + r() * 0.72, 13.58 + r() * 0.68, 0.06 + r() * 0.13, 0.05 + r() * 0.1, r() < 0.55 ? '#c9ab80' : '#7e6648');
  }
  R(-VW / 2, 14.3, VW / 2, 14.5, 'rgba(60,40,22,0.4)');
  // the wall behind the balusters, in shade
  R(-2.05, 17.0, 2.05, 19.05, '#8d7352'); R(-2.05, 18.7, 2.05, 19.05, '#6e5a40');
  streaks(g, w, h, 40, 5103, 0.16, 60, '55,38,22');
  line(-VW / 2, 3.45, VW / 2, 3.45, 0.08, 'rgba(70,45,25,0.4)');
}
// one front in the frame M; east = the pylon with the plaque, depth = how far its block runs back
function vicPylon(M, depth, east) {
  bx('flat', M, -VW / 2, VW / 2, -0.8, 19.1, -depth, -0.05, { c: '#c4a274' });
  face('g1VicF', M, shapeOf([[-VW / 2, -0.5], [VW / 2, -0.5], [VW / 2, 19.4], [-VW / 2, 19.4]]), 0, VW, VH);
  for (const s of [-1, 1]) {
    const x = s * 2.0;
    bx('flat', M, x - 0.95, x + 0.95, -0.6, 0.65, 0, 0.98, { c: VDARK }); bx('flat', M, x - 0.84, x + 0.84, 0.65, 3.15, 0, 0.86, { c: '#c09d6e' }); bx('flat', M, x - 0.95, x + 0.95, 3.15, 3.45, 0, 0.98, { c: '#d3b48a' });
    bx('flat', M, x - 0.72, x + 0.72, 3.45, 3.75, 0, 1.02, { c: '#cfae80', noao: true }); cyl('flat', 0.62, 0.68, 0.28, 12, { M, p: [x, 3.75, 0.4], c: '#d2b184', open: true, noao: true });
    cyl('flat', 0.47, 0.57, 7.9, 10, { M, p: [x, 4.0, 0.4], c: '#cfac7b', open: true, noao: true });
    cyl('flat', 0.62, 0.5, 0.25, 12, { M, p: [x, 11.85, 0.4], c: '#d2b184', noao: true }); bx('flat', M, x - 0.68, x + 0.68, 12.1, 12.35, 0, 1.08, { c: '#d6b78a', noao: true });
  }
  // entablature: architrave, the painted frieze, three steps of cornice
  bx('flat', M, -VW / 2, VW / 2, 12.35, 14.5, 0.01, 0.9, { c: '#c2a070', noao: true });
  face('g1VicF', M, shapeOf([[-VW / 2, 12.35], [VW / 2, 12.35], [VW / 2, 14.5], [-VW / 2, 14.5]]), 0.91, VW, VH);
  bx('flat', M, -3.05, 3.05, 14.5, 14.88, -0.1, 1.15, { c: '#d1b184', noao: true }); bx('flat', M, -3.45, 3.45, 14.88, 15.35, -0.2, 1.55, { c: '#c2a278', noao: true }); bx('flat', M, -3.6, 3.6, 15.35, 15.8, -0.25, 1.72, { c: '#b39670', noao: true });
  // the attic and its balustrade
  bx('flat', M, -3.0, 3.0, 15.8, 16.75, -0.2, 0.55, { c: '#caa877', noao: true }); bx('flat', M, -3.08, 3.08, 16.75, 17.0, -0.2, 0.66, { c: '#d6b889', noao: true });
  for (const s of [-1, 1]) bx('flat', M, s * 2.5 - 0.48, s * 2.5 + 0.48, 17.0, 19.05, 0, 0.55, { c: '#c9a676', noao: true });
  for (let i = 0; i < 7; i++) lathe('flat', [[0.12, 0], [0.19, 0.15], [0.13, 0.35], [0.24, 0.9], [0.12, 2.05]], 5, { M: mul(M, tr(-1.68 + i * 0.56, 17.0, 0.27)), t0: -PI / 2, tl: PI * 1.6, c: '#d0ae7e', noao: true });
  bx('flat', M, -3.1, 3.1, 19.05, 19.45, -0.2, 0.66, { c: '#cdab7c', noao: true }); bx('flat', M, -3.25, 3.25, 19.45, 19.75, -0.3, 0.8, { c: '#b79a73', noao: true }); bx('flat', M, -2.95, 2.95, 19.75, 20.05, -0.25, 0.55, { c: '#c4a477', noao: true });
  // the fountain: foot, large basin, small basin, the stone back with the mask
  cyl('flat', 0.28, 0.45, 0.95, 8, { M, p: [0, -0.1, 0.55], c: '#a8a193', noao: true });
  lathe('flat', [[0.3, 0], [0.8, 0.14], [1.12, 0.42], [1.18, 0.6], [1.02, 0.62], [0.9, 0.45], [0, 0.42]], 10, { M: mul(M, tr(0, 0.82, 0.3)), t0: -PI / 2, tl: PI, c: VGREY, noao: true });
  bx('flat', M, -0.62, 0.62, 1.35, 2.2, 0, 0.35, { c: '#6f6a5e', noao: true });
  lathe('flat', [[0.12, 0], [0.5, 0.16], [0.68, 0.36], [0.55, 0.4], [0, 0.3]], 8, { M: mul(M, tr(0, 2.0, 0.22)), t0: -PI / 2, tl: PI, c: '#a49d8e', noao: true });
  extrude('flat', shapeOf([[-0.42, 2.35], [0.42, 2.35], [0.62, 2.8], [0.4, 3.2], [0.55, 3.55], [0.15, 3.9], [-0.15, 3.9], [-0.55, 3.55], [-0.4, 3.2], [-0.62, 2.8]]), 0.22, { M, c: VGREY, noao: true });
  sphere('flat', 0.3, { M, p: [0, 3.25, 0.24], seg: 7, kz: 0.7, c: '#9b9486', noao: true });
  if (east) {
    bx('flat', M, -0.5, 0.5, 4.35, 4.95, 0, 0.05, { c: '#d9d5c8', noao: true });
    bx('flat', M, -2.3, 2.4, 19.0, 21.9, -depth - 0.05, -1.3, { c: '#d8c08c', noao: true }); bx('flat', M, -0.4, 0.4, 20.4, 21.4, -1.32, -1.28, { c: '#6a5238', noao: true });
  } else {
    bx('flat', M, -0.75, 0.75, 4.15, 5.05, 0, 0.04, { c: '#33302c', noao: true });
    for (let x = -0.6; x < 0.7; x += 0.3) bx('flat', M, x - 0.02, x + 0.02, 4.15, 5.05, 0.05, 0.07, { c: '#8a8272', noao: true });
    for (const y of [4.45, 4.75]) bx('flat', M, -0.75, 0.75, y, y + 0.035, 0.05, 0.08, { c: '#8a8272', noao: true });
    bars(M, -2.7, 2.7, 20.05, 21.05, 0.35, 0.6);
  }
}
// the house the west front is built against: redrawn plain, with its shutters and balconies, because the generic facade's balconies came through the columns
const VIC_HOUSE = [[321.2, 612.4], [324.25, 618.29], [315.05, 622.49], [312.3, 617.2]], VIC_HH = 13.8;   // its front 0.12 m back from the footprint, so the pylon's face stands clear of it
function vicHouse(y) {
  prism('plaster', VIC_HOUSE, y - 1, y + VIC_HH, { c: '#dcc095' }); prism('flat', VIC_HOUSE, y + VIC_HH, y + VIC_HH + 0.15, { c: '#9a9284', noao: true });
  const win = (M, x, f) => {
    const [y0, y1] = [[4.5, 6.9], [7.9, 10.2], [11.1, 12.9]][f];
    bx('flat', M, x - 0.75, x + 0.75, y0 - 0.1, y1 + 0.2, -0.02, 0.06, { c: '#e6dcc6', noao: true }); bx('flat', M, x - 0.55, x + 0.55, y0, y1, 0.02, 0.09, { c: '#4d7556', noao: true }); bx('flat', M, x - 0.02, x + 0.02, y0, y1, 0.08, 0.1, { c: '#274030', noao: true });
    if (f < 2) { bx('flat', M, x - 1.05, x + 1.05, y0 - 0.28, y0 - 0.1, 0, 0.7, { c: '#c9bda5', noao: true }); bars(M, x - 1.0, x + 1.0, y0 - 0.1, y0 + 1.0, 0.66, 0.5); }
  };
  const F = frame(319.65, y, 620.39, VN[0], VN[1]), S = frame(322.72, y, 615.35, 0.889, -0.459);
  for (let f = 0; f < 3; f++) { win(F, -3.0, f); win(S, 0.1, f); win(S, 2.2, f); }
  bx('flat', F, -4.4, -1.6, -0.3, 3.3, -0.02, 0.05, { c: '#3d3a38', noao: true }); bx('flat', F, -4.6, -1.4, 3.3, 3.85, -0.02, 0.1, { c: '#34507a', noao: true });
  for (const x of [0.1, 2.2]) bx('flat', S, x - 0.65, x + 0.65, -0.3, 3.0, -0.02, 0.05, { c: '#4a3c32', noao: true });
  for (const M of [F, S]) { const hw = M === F ? 5.06 : 3.37; bx('flat', M, -hw, hw, VIC_HH - 0.35, VIC_HH + 0.15, -0.05, 0.25, { c: '#e0d2b2', noao: true }); bx('flat', M, -hw, hw, 4.0, 4.2, -0.05, 0.14, { c: '#d6c39e', noao: true }); }
}
const vicFrame = (v) => frame(v.c[0], groundY(v.c[0] + VN[0], v.c[1] + VN[1]), v.c[1], VN[0], VN[1]);
function buildVicari() {
  initShared();
  defMat('g1VicF', 160, 512, [VW, VH], vicFront);
  const E = vicFrame(VIC_E), W = vicFrame(VIC_W);
  begin(E.elements[13]);
  vicPylon(E, VIC_E.depth, true); vicPylon(W, VIC_W.depth, false); vicHouse(W.elements[13]);
  const o = end('Porta di Vicari');
  o.userData.solids = [[[340.2, 609.5, 341.5, 611.9, 336.2, 614.3, 334.9, 611.9], null, E.elements[13] + 19], [VIC_HOUSE.flat(), null, W.elements[13] + VIC_HH]];
  return o;
}
const VIC_OUT = [[-2.98, 0], [-2.98, 1.0], [-1.05, 1.0], [-0.7, 1.48], [0.7, 1.48], [1.05, 1.0], [2.98, 1.0], [2.98, 0]];
const vicWalls = () => [VIC_E, VIC_W].flatMap(v => wallsOf(frame(v.c[0], 0, v.c[1], VN[0], VN[1]), VIC_OUT));

// =====================================================================================================
// Porta Mazzara
// =====================================================================================================
const MZ = { c: [-494.65, 788.75], n: [0.702, -0.712] };
const MZ_TOP = [[-8.7, 6.75], [-8.05, 6.95], [-5.95, 7.05], [-5.85, 7.9], [-3.35, 7.75], [-2.5, 7.85], [-2.5, 8.6], [-1.65, 8.8], [-1.0, 8.65], [-0.72, 8.65], [-0.72, 8.45], [-0.45, 8.45], [-0.45, 8.25], [-0.15, 8.25], [-0.15, 8.05], [0.15, 8.05], [0.15, 7.85], [0.5, 7.85], [0.55, 7.65], [3.6, 7.8], [6.95, 7.75], [7.2, 8.85], [7.6, 9.45], [8.2, 9.7], [8.35, 8.65], [8.6, 7.7], [8.9, 7.4], [8.9, 0]];
const MZA = { l: -1.95, r: 1.25, s: 4.4, a: 6.15 }, MZB = { l: -1.4, r: 0.85, s: 3.15, a: 3.8 }, MZD = { l: -6.35, r: -5.5, h: 2.45 };
function mzArchPath(p, A, grow = 0) {
  const l = A.l - grow, r = A.r + grow, c = (l + r) / 2, a = A.a + grow, k = A.s + (a - A.s) * 0.68;
  p.moveTo(l, -0.6); p.lineTo(l, A.s); p.quadraticCurveTo(l, k, c, a); p.quadraticCurveTo(r, k, r, A.s); p.lineTo(r, -0.6);
}
// the wall outline with the arch and the open doorway cut in from the foot
function mzShape(A, drop = 0) {
  const s = new THREE.Shape(), k = A.s + (A.a - A.s) * 0.68, c = (A.l + A.r) / 2;
  s.moveTo(-8.9, -0.8); for (const [x, y] of MZ_TOP) s.lineTo(x, y ? y - drop : -0.8);
  s.lineTo(A.r, -0.8); s.lineTo(A.r, A.s); s.quadraticCurveTo(A.r, k, c, A.a); s.quadraticCurveTo(A.l, k, A.l, A.s); s.lineTo(A.l, -0.8);
  s.lineTo(MZD.r, -0.8); s.lineTo(MZD.r, MZD.h); s.lineTo(MZD.l, MZD.h); s.lineTo(MZD.l, -0.8); s.closePath();
  return s;
}
function mzPaint(g, w, h) {
  const p = painter(g, w, h, 18, 10.5), { R, blob, line, X, Y } = p, r = RNG(5201);
  g.fillStyle = '#8f7e60'; g.fillRect(0, 0, w, h);
  // courses of rough blocks, darker and bigger low down
  for (let y = -0.2; y < 10.5; y += 0.34) for (let x = -9.2 + r() * 0.5; x < 9;) {
    const bw = 0.25 + r() * (x > 0.5 && y < 6 ? 0.75 : 0.45), k = r(), dim = y < 2.5 ? 0.82 : x < -5.5 ? 0.88 : 1;
    const c = [[166, 144, 108], [146, 126, 94], [182, 160, 120], [122, 106, 82], [158, 132, 92]][(k * 5) | 0];
    R(x + 0.03, y + 0.03 + (r() - 0.5) * 0.07, x + bw - 0.02, y + 0.31 + (r() - 0.5) * 0.07, `rgb(${c[0] * dim | 0},${c[1] * dim | 0},${c[2] * dim | 0})`);
    x += bw;
  }
  // remains of render, mostly high on the wall
  for (const [cx, cy, rx, ry, n] of [[-5.2, 6.2, 1.7, 1.3, 34], [-2.9, 7.0, 1.5, 0.9, 22], [3.9, 6.9, 3.2, 0.75, 46], [0.3, 6.6, 1.0, 1.0, 16], [5.6, 5.2, 1.4, 1.1, 14], [-1.5, 8.1, 1.2, 0.6, 12]]) for (let i = 0; i < n * 3; i++) { const x = cx + (r() - 0.5) * 2.2 * rx, y = cy + (r() - 0.5) * 2.2 * ry, s = 0.08 + r() * 0.42; p.poly([[x - s, y], [x - s * 0.3, y + s * (0.3 + r() * 0.5)], [x + s * (0.5 + r() * 0.5), y + s * 0.2], [x + s * 0.4, y - s * (0.2 + r() * 0.4)]], `rgba(${188 + r() * 14 | 0},${170 + r() * 13 | 0},${136 + r() * 12 | 0},0.42)`); }
  for (let i = 0; i < 55; i++) { const x = -8.6 + r() * 17.2, y = 0.5 + r() * 6.5, s = 0.06 + r() * 0.2; R(x, y, x + s, y + s * 0.8, 'rgba(38,28,18,0.7)'); }
  // the line of the old stair, the course under the crest on the right
  for (let i = 0; i < 12; i++) { const x = -6.2 + i * 0.33, y = 4.35 + i * 0.25; R(x, y, x + 0.34, y + 0.09, 'rgba(225,208,172,0.8)'); R(x, y - 0.13, x + 0.34, y, 'rgba(50,36,22,0.6)'); }
  R(0.6, 7.0, 6.9, 7.14, 'rgba(60,45,28,0.5)');
  // the ring of stones round the pointed arch
  const ring = (grow, col, t) => { g.strokeStyle = col; g.lineWidth = t * p.sx; g.beginPath(); const q = { moveTo: (x, y) => g.moveTo(X(x), Y(y)), lineTo: (x, y) => g.lineTo(X(x), Y(y)), quadraticCurveTo: (a, b, c, d) => g.quadraticCurveTo(X(a), Y(b), X(c), Y(d)) }; mzArchPath(q, MZA, grow); g.stroke(); };
  ring(0.22, '#b6a07a', 0.45); ring(0.46, 'rgba(50,36,22,0.55)', 0.07); ring(0.02, 'rgba(45,32,20,0.6)', 0.09);
  R(6.2, 0.35, 7.45, 2.95, '#a8926e'); R(6.35, 0.5, 7.3, 2.8, '#1e1812');
  streaks(g, w, h, 34, 5202, 0.22, 34, '40,30,18');
  noiseDots(g, w, h, 1400, 1.3, 5203, ['rgba(40,28,16,0.22)', 'rgba(240,225,190,0.14)']);
  line(MZD.l - 0.1, 0, MZD.l - 0.1, MZD.h, 0.16, '#b6a07a'); line(MZD.r + 0.1, 0, MZD.r + 0.1, MZD.h, 0.16, '#b6a07a'); R(MZD.l - 0.2, MZD.h, MZD.r + 0.2, MZD.h + 0.18, '#b6a07a');
}
// the north west run of the footprint (a lower wall) and the shed before it, in world metres
const MZ_LOW = [[-501.0, 782.5], [-502.6, 783.9], [-523.2, 768.8], [-524.9, 770.7], [-502.3, 786.8]];
const MZ_SHED = (() => { const a = [-502.6, 783.9], u = [-0.807, -0.591], n = [0.591, -0.807], q = (s, o) => [a[0] + u[0] * s + n[0] * o, a[1] + u[1] * s + n[1] * o]; return [q(2.5, 0), q(2.5, 3.2), q(14, 3.2), q(14, 0)]; })();
const MZ_RAIL = [[-5.3, 1.1], [-2, 1.35], [13.2, 1.75]];
function buildMazzara() {
  initShared();
  defMat('g1MazF', 288, 168, [18, 10.5], mzPaint);
  const y0 = groundY(MZ.c[0] + MZ.n[0], MZ.c[1] + MZ.n[1]), M = frame(MZ.c[0], y0, MZ.c[1], MZ.n[0], MZ.n[1]), r = RNG(5204);
  begin(y0);
  // the front leaf with the tall arch, the back leaf with the low one, the painted skin
  extrude('stone', mzShape(MZA), 0.95, { M, p: [0, 0, -0.97], c: '#c9b38a', cs: 6 });
  extrude('stone', mzShape(MZB, 0.35), 2.43, { M, p: [0, 0, -3.4], c: '#b39e78', cs: 6 });
  face('g1MazF', M, mzShape(MZA), 0, 18, 10.5);
  // brackets and ledge over the arch, the loose stones of the crest, grass
  for (const x of [-2.4, -1.15]) { bx('stone', M, x - 0.22, x + 0.22, 6.55, 7.15, 0, 0.32, { c: '#d0bc94', noao: true }); bx('stone', M, x - 0.2, x + 0.2, 7.0, 7.2, 0.3, 0.55, { c: '#c4b08a', noao: true }); }
  bx('stone', M, -2.75, -0.8, 7.2, 7.38, 0, 0.5, { c: '#cdb890', noao: true });
  for (const [x, y, nn] of [[-7.4, 6.95, 6], [-6.4, 6.95, 4], [-1.9, 7.38, 7], [-1.2, 7.38, 5], [4.6, 7.75, 3]]) for (let i = 0; i < nn; i++) cone('stone', 0.07 + r() * 0.07, 0.4 + r() * 0.45, 4, { M, p: [x + (r() - 0.5) * 0.7, y - 0.05, 0.05 - r() * 0.4], rz: (r() - 0.5) * 0.9, c: r() < 0.5 ? '#b9c282' : '#d6cf92', noao: true });
  // the lower wall to the north west with its broken top, the shed with the tiled roof
  const lo = Math.min(...MZ_LOW.map(q => groundY(q[0], q[1])));
  prism('stone', MZ_LOW, lo - 0.8, y0 + 6.0, { c: '#b7a27c' });
  for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9, x = -502.45 - 20.4 * k, z = 785.2 - 15.3 * k; box('stone', 1.2 + r(), 0.25 + r() * 0.6, 1.0, { p: [x - 0.1, y0 + 5.95, z], ry: Math.atan2(15.3, 20.4) * -1, c: '#a8946f', noao: true }); }
  prism('stone', MZ_SHED, y0 - 0.3, y0 + 3.0, { c: '#a89a7e' });
  const S = frame((MZ_SHED[1][0] + MZ_SHED[2][0]) / 2, y0, (MZ_SHED[1][1] + MZ_SHED[2][1]) / 2, 0.591, -0.807);
  box('stone', 11.9, 0.2, 3.65, { M: S, p: [0, 3.15, -1.55], rx: 0.14, c: '#d08a64', noao: true });
  bx('stone', S, -1.9, -0.7, 0, 2.2, 0, 0.05, { c: '#5a4636', noao: true }); bx('stone', S, 1.4, 2.9, 0, 2.3, 0, 0.05, { c: '#4a3a2e', noao: true });
  // the iron railing on its low kerb
  for (let i = 1; i < MZ_RAIL.length; i++) {
    const a = MZ_RAIL[i - 1], b = MZ_RAIL[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), R = mul(M, mul(tr((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2), rotY(-Math.atan2(b[1] - a[1], b[0] - a[0]))));
    bx('stone', R, -l / 2, l / 2, -0.4, 0.22, -0.14, 0.14, { c: '#cfc7b4' });
    part('rail', new THREE.PlaneGeometry(1, 1), { M: R, p: [0, 1.17, 0], s: [l, 1.9, 1], uv: 'keep', uvk: [l, 1], noao: true });
  }
  return end('Porta Mazzara');
}
const mazzaraWalls = () => [...wallsOf(frame(MZ.c[0], 0, MZ.c[1], MZ.n[0], MZ.n[1]), MZ_RAIL), ...pathWalls(MZ_SHED)];

// =====================================================================================================
// Porta dei Leoni
// =====================================================================================================
const LN = [-0.69, 0.724];                                       // the lettered faces look back along Viale Diana, to the south west
const LP = [[-1509.8, -3454.4], [-1503.9, -3447.4]];            // north pylon (against the lodge), south pylon
const LODGE = [-1515.0, -3462.5, -1510.7, -3466.2, -1513.3, -3473.9, -1511.1, -3475.2, -1506.2, -3469.8, -1499.9, -3474.9, -1494.4, -3468.4, -1509.2, -3455.4];
const LSTONE = '#d9cdb0', LW = 2.6;
function leoPaint(g, w, h) {   // three faces of 2.6 x 3.1 m side by side: a plain sunk panel, then the two lettered ones
  const r = RNG(5301);
  g.fillStyle = '#c8b994'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, 1500, 2, 5302, ['rgba(90,75,50,0.14)', 'rgba(250,240,215,0.14)']);
  for (let f = 0; f < 3; f++) {
    const p = painter(g, w / 3, h, LW, 3.1), { R } = p;
    g.save(); g.translate(f * w / 3, 0);
    R(-1.05, 0.2, 1.05, 2.85, '#ddcfae'); R(-0.98, 0.27, 0.98, 2.78, '#8f7f60'); R(-0.92, 0.27, 0.98, 2.72, '#c3b390');
    if (f) {
      R(-0.88, 1.65, 0.88, 2.5, '#e2d6b6'); R(-0.8, 1.72, 0.8, 2.43, '#a2906c'); R(-0.74, 1.76, 0.74, 2.37, '#d8caa6'); p.blob(0, 2.55, 0.2, 0.16, '#d8caa6'); p.blob(0, 2.55, 0.1, 0.08, '#8f7f60'); p.blob(0, 1.1, 0.16, 0.34, '#a8967a');
      g.fillStyle = '#3c3224'; g.font = `bold ${Math.round(0.24 * p.sy)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(f === 1 ? 'REAL TENUTA' : 'LA FAVORITA', p.X(0), p.Y(2.06), 1.42 * p.sx);
    }
    for (let i = 0; i < 9; i++) { const x = -1.3 + r() * 2.6, ww = 0.05 + r() * 0.28; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(48,42,34,${0.25 + r() * 0.3})`); gr.addColorStop(0.3 + r() * 0.6, 'rgba(48,42,34,0)'); g.fillStyle = gr; g.fillRect(p.X(x), 0, ww * p.sx, h); }
    g.restore();
  }
}
// a lioness lying on the slab, head up: +z of M is the way it looks
function lion(M) {
  const c = '#97917f', d = '#726d60', o = { M, c, noao: true };
  sphere('flat', 0.44, { M, p: [0, 0.42, -0.72], seg: 8, kz: 1.15, c: '#878172', noao: true });
  cyl('flat', 0.36, 0.36, 1.15, 8, { M, p: [0, 0.41, -0.72], rx: PI / 2, c, noao: true });
  sphere('flat', 0.44, { M, p: [0, 0.57, 0.36], seg: 8, ky: 1.15, c, noao: true });
  const H = mul(M, mul(tr(0, 0, 0.42), mul(rotY(-0.75), tr(0, 0, -0.42))));   // the head turns towards whoever arrives
  for (const s of [-1, 1]) {
    box('flat', 0.22, 0.2, 0.85, { ...o, p: [s * 0.25, 0, 0.75] }); box('flat', 0.26, 0.13, 0.2, { ...o, p: [s * 0.25, 0, 1.18], c: d });
    box('flat', 0.26, 0.32, 0.75, { ...o, p: [s * 0.42, 0, -0.42], c: d });
    box('flat', 0.22, 0.78, 0.3, { M: H, p: [s * 0.36, 0.6, 0.52], rz: s * 0.22, c: '#78736a', noao: true });   // the lappets of the headdress
    cone('flat', 0.11, 0.24, 4, { M: H, p: [s * 0.27, 1.64, 0.5], rz: -s * 0.35, c: d, noao: true });
  }
  cyl('flat', 0.38, 0.52, 0.65, 8, { M: H, p: [0, 0.66, 0.4], rx: 0.12, c: '#86806f', noao: true });
  sphere('flat', 0.44, { M: H, p: [0, 1.34, 0.43], seg: 8, kz: 0.8, c: '#797468', noao: true });
  sphere('flat', 0.3, { M: H, p: [0, 1.32, 0.64], seg: 8, c: '#9a9483', noao: true });
  box('flat', 0.3, 0.2, 0.22, { M: H, p: [0, 1.08, 0.83], c: '#8d8777', noao: true }); box('flat', 0.46, 0.1, 0.2, { M: H, p: [0, 1.52, 0.74], c: d, noao: true });
  for (const s of [-1, 1]) box('flat', 0.09, 0.05, 0.04, { M: H, p: [s * 0.12, 1.39, 0.91], c: '#3a362f', noao: true });
  box('flat', 0.1, 0.09, 0.75, { ...o, p: [0.47, 0.02, -0.85], ry: 0.25, c: d });
}
function leoPylon(M, which) {
  bx('plaster', M, -1.48, 1.48, -0.8, 0.5, -1.48, 1.48, { c: '#c6bb9e' });
  bx('plaster', M, -LW / 2, LW / 2, 0.5, 3.6, -LW / 2, LW / 2, { c: LSTONE });
  for (let k = 0; k < 4; k++) face('g1LeoF', mul(M, mul(rotY(k * PI / 2), tr(0, 0.5, 0))), shapeOf([[-1.29, 0], [1.29, 0], [1.29, 3.1], [-1.29, 3.1]]), LW / 2 + 0.012, LW * 3, 3.1, ((k === 0 ? which : 0) + 0.5) / 3);
  for (const [y0, y1, hw, c] of [[3.6, 3.74, 1.37, LSTONE], [3.74, 4.08, 1.52, '#cfc4a8'], [4.08, 4.36, 1.62, '#b4aa92'], [4.36, 4.45, 1.35, '#a29a86']]) bx('plaster', M, -hw, hw, y0, y1, -hw, hw, { c, noao: true });
  const L = mul(M, mul(tr(0, 4.45, 0), rotY(1.05)));
  bx('plaster', L, -0.72, 0.72, 0, 0.3, -1.3, 1.35, { c: '#bdb39a', noao: true });
  lion(mul(L, tr(0, 0.3, 0)));
}
// the hip roof of the lodge: eaves on the footprint, ridges over the three arms
function lodgeRoof(y, ym) {
  const V = []; for (let i = 0; i < LODGE.length; i += 2) V.push([LODGE[i], y, LODGE[i + 1]]);
  const Rn = [-1511.4, ym, -3472.4], J = [-1506.6, ym, -3464.3], Re = [-1500.0, ym, -3469.0], Rs = [-1509.4, ym, -3460.6];
  const faces = [[V[2], V[3], Rn], [V[3], V[4], J, Rn], [V[4], V[5], Re, J], [V[5], V[6], Re], [V[6], V[7], Rs, J, Re], [V[7], V[0], Rs], [V[0], V[1], J, Rs], [V[1], V[2], Rn, J]];
  const pos = [];
  for (const f of faces) for (let i = 1; i + 1 < f.length; i++) {
    const a = f[0], b = f[i], c = f[i + 1], up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0;
    pos.push(...a, ...(up ? b : c), ...(up ? c : b));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.computeVertexNormals();
  part('flat', g, { c: '#b8694a', noao: true });
}
function buildLeoni() {
  initShared();
  defMat('g1LeoF', 288, 128, [LW * 3, 3.1], leoPaint);
  const y0 = groundY(-1507, -3450);
  begin(y0);
  LP.forEach((p, i) => leoPylon(frame(p[0], groundY(p[0], p[1]), p[1], LN[0], LN[1]), i + 1));
  // the lodge
  const pts = []; for (let i = 0; i < LODGE.length; i += 2) pts.push([LODGE[i], LODGE[i + 1]]);
  const lo = Math.min(...pts.map(q => groundY(q[0], q[1])));
  prism('plaster', pts, lo - 0.8, y0 + 3.75, { c: '#cdbd98' });
  lodgeRoof(y0 + 4.02, y0 + 5.35);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    // the footprint runs clockwise seen from above in (x, z): the outward normal of an edge is (dz, -dx) turned to leave the ring
    let nx = dz / l, nz = -dx / l; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (inPoly(pts, mx + nx * 0.2, mz + nz * 0.2)) { nx = -nx; nz = -nz; }
    const E = frame(mx, y0, mz, nx, nz);
    bx('plaster', E, -l / 2 - 0.05, l / 2 + 0.05, 3.62, 3.86, -0.1, 0.16, { c: '#b6a98c', noao: true }); bx('plaster', E, -l / 2 - 0.1, l / 2 + 0.1, 3.86, 4.04, -0.1, 0.28, { c: '#a89c82', noao: true });
    bx('plaster', E, -l / 2, l / 2, -0.4, 0.55, -0.05, 0.07, { c: '#9d9278' });
    if (i === 7) { bx('flat', E, -0.6, 0.6, 0.9, 2.0, -0.02, 0.05, { c: '#4a3226', noao: true }); bx('flat', E, -0.75, 0.75, 2.0, 2.18, -0.02, 0.12, { c: '#b6a98c', noao: true }); }
  }
  // the short piece of wall from the south pylon to the tall house
  bx('plaster', frame(-1502.8, y0, -3447.25, LN[0], LN[1]), -0.45, 0.9, -0.5, 3.4, -0.5, 0.1, { c: '#c3b494' });
  const o = end('Porta dei Leoni');
  o.userData.solids = [[LODGE, null, y0 + 3.75]];
  return o;
}
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const leoWalls = () => LP.flatMap(p => wallsOf(frame(p[0], 0, p[1], LN[0], LN[1]), [[-1.48, -1.48], [1.48, -1.48], [1.48, 1.48], [-1.48, 1.48], [-1.48, -1.48]]));

// =====================================================================================================
// Porta Reale: the two fronts
// =====================================================================================================
const RW = 4.7, RP = 0.35;                                       // width; how far a front stands before the building's wall
const REALE = [{ a: [1135.4, 138.0], b: [1139.46, 135.62], east: true }, { a: [1120.76, 145.43], b: [1125.0, 143.4], east: false }];
const realeFrame = (q, y) => { const dx = q.b[0] - q.a[0], dz = q.b[1] - q.a[1], l = Math.hypot(dx, dz), n = [-dz / l, dx / l]; return frame((q.a[0] + q.b[0]) / 2, y, (q.a[1] + q.b[1]) / 2, n[0], n[1]); };
function realePylon(M, east, seed) {
  const W = RW / 2, r = RNG(seed), P = (x0, x1, y0, y1, z0, z1, c, o) => bx('plaster', M, x0, x1, y0, y1, z0, z1, { c, noao: true, ...o });
  P(-W, W, -0.8, 13.2, -1.5, RP - 0.12, '#c49b70', { noao: false });
  P(-W - 0.1, W + 0.1, -0.8, 1.05, -1.5, RP + 0.18, '#a99a80', { noao: false }); P(-W - 0.04, W + 0.04, 1.05, 1.3, -1.5, RP + 0.08, '#bba98a');
  for (const s of [-1, 1]) {
    const x = s * 1.12;
    P(x - 0.8, x + 0.8, 1.3, 10.65, RP - 0.2, RP + 0.04, s < 0 ? '#caa578' : '#c29a6e', { noao: false });
    P(x - 0.88, x + 0.88, 10.65, 10.95, RP - 0.2, RP + 0.14, '#b49c7a'); P(x - 0.95, x + 0.95, 10.95, 11.2, RP - 0.2, RP + 0.22, '#a89272');
  }
  // peeled and stained patches
  for (let i = 0; i < 16; i++) { const x = -W + 0.3 + r() * (RW - 0.9), y = 1.3 + r() * r() * 8.5, ww = 0.2 + r() * 0.75, hh = 0.2 + r() * 0.9, z = Math.abs(Math.abs(x + ww / 2) - 1.12) < 0.8 ? RP + 0.045 : RP - 0.115; P(x, x + ww, y, y + hh, z, z + 0.006 + i * 0.0004, ['#bd9d74', '#b6946c', '#cba97f', '#ae9272'][(r() * 4) | 0]); }
  // frieze, cornice, attic with its two end blocks, finials
  P(-W - 0.02, W + 0.02, 11.9, 12.1, -1.5, RP - 0.02, '#bd9a72');
  P(-W - 0.2, W + 0.2, 13.2, 13.5, -1.6, RP + 0.25, '#b39b7a'); P(-W - 0.45, W + 0.45, 13.5, 13.8, -1.75, RP + 0.55, '#a8957a'); P(-W - 0.6, W + 0.6, 13.8, 14.05, -1.85, RP + 0.72, '#8e8170');
  P(-W + 0.15, W - 0.15, 14.05, 16.3, -1.4, RP - 0.2, '#bca584');
  for (const s of [-1, 1]) { P(s * 1.55 - 0.5, s * 1.55 + 0.5, 14.05, 16.3, -1.4, RP, '#c4ad8a'); P(s * 1.55 - 0.62, s * 1.55 + 0.62, 16.3, 16.55, -1.45, RP + 0.16, '#a2937a'); }
  P(-W + 0.05, W - 0.05, 16.2, 16.42, -1.45, RP - 0.04, '#a8987e');
  for (const [x, ball] of [[-1.55, !east], [1.55, east]]) {
    P(x - 0.32, x + 0.32, 16.55, 16.9, -0.4, 0.25, '#b6a68a');
    if (ball) { cyl('flat', 0.1, 0.2, 0.25, 6, { M, p: [x, 16.9, -0.07], c: '#a59880', noao: true }); sphere('flat', 0.34, { M, p: [x, 17.42, -0.07], seg: 8, c: '#a89c86', noao: true }); }
    else lathe('flat', [[0.26, 0], [0.12, 0.14], [0.27, 0.35], [0.1, 0.6], [0, 0.72]], 6, { M: mul(M, tr(x, 16.9, -0.07)), c: '#a59880', noao: true });
  }
  if (east) { bx('flat', M, -1.55, -0.55, 3.85, 4.55, RP + 0.02, RP + 0.09, { c: '#ddd8ca', noao: true }); for (const y of [4.08, 4.32]) bx('flat', M, -1.4, -0.7, y, y + 0.05, RP + 0.09, RP + 0.095, { c: '#5a554c', noao: true }); }
}
function buildReale() {
  initShared();
  const y0 = groundY(1130, 141);
  begin(y0);
  REALE.forEach((q, i) => { const M = realeFrame(q, 0); M.elements[13] = groundY((q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2 + 1); realePylon(M, q.east, 5401 + i); });
  return end('Porta Reale');
}
const realeWalls = () => REALE.flatMap(q => wallsOf(realeFrame(q, 0), [[-RW / 2 - 0.1, -0.2], [-RW / 2 - 0.1, RP + 0.18], [RW / 2 + 0.1, RP + 0.18], [RW / 2 + 0.1, -0.2]]));

// =====================================================================================================
// Mura delle Cattive
// =====================================================================================================
const CW = [[880.1, -392.1], [887.9, -379.0], [900.7, -357.5], [951.1, -267.6], [972.1, -231.5], [998.6, -192.0], [993.6, -189.4]];
const CG = 3.3, GOLD = '#d2bb95';
// the skin over the mapped wall (1.3 m thick, 6.4 m high, which stays inside it): plinth, face, cornice, parapet, coping
const CPROF = [[0.92, -1.0], [0.92, 0.75], [0.73, 0.85], [0.71, 5.35], [0.71, 6.75], [0.84, 6.8], [0.84, 6.97], [-0.74, 6.97], [-0.74, -1.0]];
// the loggia: pier spans in z (north end last), the faces in x
const LOG = { e: 882.25, w: 878.6, piers: [[-394.9, -392.1], [-399.0, -397.5], [-403.1, -401.6], [-407.2, -405.7], [-411.3, -409.8], [-416.7, -413.4]] };
// the stair behind it: O the middle of the line of the two posts, U up the stair, V across (towards the wall)
const ST = { O: [874.95, -388.7], U: [0.49, 0.872] };
function buildLoggia(y) {
  for (const [z0, z1] of LOG.piers) extrude('tufa', shapeOf([[LOG.w, -1], [LOG.e + 0.05, -1], [LOG.e + 0.05, 0.55], [LOG.e - 0.08, 0.65], [LOG.e - 0.42, 4.0], [LOG.w, 4.0]]), z1 - z0, { p: [0, y, z0], c: GOLD, uv: 'world' });
  const z0 = LOG.piers[5][0], z1 = LOG.piers[0][1], I = new THREE.Matrix4();
  bx('tufa', I, LOG.w, LOG.e - 0.42, y + 4.0, y + 5.35, z0, z1, { c: GOLD });
  bx('tufa', I, LOG.w - 0.25, LOG.e - 0.02, y + 5.35, y + 5.75, z0 - 0.02, z1 + 0.2, { c: '#c8b08a', noao: true });
  bx('tufa', I, LOG.w + 0.12, LOG.e - 0.37, y + 5.75, y + 6.55, z0, z1, { c: GOLD, noao: true });
  bx('tufa', I, LOG.w, LOG.e - 0.25, y + 6.55, y + 6.72, z0 - 0.05, z1 + 0.1, { c: '#bfa882', noao: true });
  for (let i = 0; i < 5; i++) {
    const a = LOG.piers[i + 1][1], b = LOG.piers[i][0], zc = (a + b) / 2, hw = (b - a) / 2;
    for (const [x, nx] of [[LOG.e - 0.42, 1], [LOG.w, -1]]) {
      const M = frame(x, y, zc, nx, 0);
      for (let k = 0; k < 5; k++) { const u0 = -hw - 0.12 + k * (2 * hw + 0.24) / 5, u1 = u0 + (2 * hw + 0.24) / 5 - 0.05; extrude('tufa', shapeOf([[u0, 4.0], [u1, 4.0], [u1 * 1.3, 5.05], [u0 * 1.3, 5.05]]), 0.07, { M, p: [0, 0, -0.02], c: k % 2 ? '#dbc6a0' : '#bca37c', noao: true }); }
    }
    cyl('flat', 0.15, 0.23, 0.85, 4, { p: [LOG.e + 0.9, y - 0.05, zc], t0: PI / 4, c: '#cfc9ba', noao: true });
  }
}
function buildStair(y) {
  const M = frame(ST.O[0], y, ST.O[1], -ST.U[0], -ST.U[1]);   // local z runs down the stair, local x away from the wall
  const step = (x0, x1, h, z0, z1, i) => bx('flat', M, x0, x1, -0.5, h, z0, z1, { c: i % 2 ? '#b4b0a6' : '#c2beb3' });
  for (let k = 0; k < 8; k++) step(-5.1, 5.0, 0.165 * (k + 1), 5.6 - 0.7 * (k + 1), 5.6 - 0.7 * k, k);
  for (let k = 0; k < 20; k++) step(-5.2, 3.9, 1.32 + 0.21 * (k + 1), -0.63 * (k + 1), -0.63 * k, k);
  step(-5.2, 3.9, 5.52, -13.8, -12.6, 0);
  // where the flight stops, over the mapped walk: closed in the wall's stone, as the end of a terrace
  bx('tufa', M, -6.4, 4.0, -0.5, 5.5, -14.05, -13.78, { c: GOLD }); bx('tufa', M, -6.4, 4.1, 5.5, 5.8, -14.15, -13.7, { c: '#c6af89', noao: true });
  for (const x of [-4.5, 4.45]) {
    const c = '#c4a779';
    bx('tufa', M, x - 0.65, x + 0.65, -0.4, 1.75, -0.65, 0.65, { c }); bx('flat', M, x - 0.55, x + 0.55, 1.75, 2.05, -0.55, 0.55, { c: '#bfa578', noao: true });
    cyl('flat', 0.44, 0.52, 2.75, 4, { M, p: [x, 2.05, 0], t0: PI / 4, c: '#b89d70', noao: true });
    bx('flat', M, x - 0.52, x + 0.52, 4.8, 5.05, -0.52, 0.52, { c: '#c2a97c', noao: true }); sphere('flat', 0.3, { M, p: [x, 5.35, 0], seg: 6, c: '#a89068', noao: true });
    lathe('flat', [[0.2, 0], [0.12, 0.2], [0.38, 0.55], [0.42, 0.68], [0, 0.7]], 8, { M: mul(M, tr(x, 5.55, 0)), c: '#bba175', noao: true });
  }
  bars(M, -3.95, -1.7, 1.32, 3.9, 0); bars(M, 1.65, 3.9, 1.32, 3.9, 0);
}
function buildCattive() {
  initShared();
  const y = groundY(884, -405);
  begin(CG);
  ribbon('tufa', CW, CPROF, CG, 1, { c: GOLD });
  ribbon('tufa', CW, [[0.7, 5.35], [0.99, 5.45], [0.99, 5.74], [0.7, 5.84]], CG, 1, { band: true, c: '#c6af89', noao: true });
  ribbon('tufa', [[985.6, -188.4], [986.8, -186.2]], CPROF, CG, 1, { c: GOLD });
  buildLoggia(y);
  buildStair(y);
  return end('Mura delle Cattive');
}
const cattiveWalls = () => [
  ...pathWalls(offsetLine(CW, 1, 0.8)),   // the face of the skin (the mapped wall's own segment is along its middle, which let a car sink into it)
  ...pathWalls([[880.1, -392.1], [LOG.e, -392.6], [LOG.e, LOG.piers[5][0]], [LOG.w, LOG.piers[5][0]], [LOG.w, -392.6], [880.1, -392.1]]),
  ...wallsOf(frame(ST.O[0], 0, ST.O[1], -ST.U[0], -ST.U[1]), [[-7.0, 5.7], [5.15, 5.7], [5.15, -0.7], [4.0, -0.7], [4.1, -14.15], [-6.5, -14.15]]),
];
// the mapped city wall runs through the loggia: its first stretch (from Porta Felice to the bend) is left out, the loggia brings its own collision
const cattiveFences = (list) => list && list.map(f => f.k === 'c' && f.p.length === 6 && Math.hypot(f.p[0] - 878.7, f.p[1] + 416.6) < 1.5 ? { ...f, p: f.p.slice(2) } : f);

// =====================================================================================================
// The bastion on Corso Alberto Amedeo
// =====================================================================================================
const BL = [[-895.6, -150.3], [-907.2, -155.4], [-921.5, -110.7], [-912.3, -91.9]];
const BG = 28.0;
const BPROF = [[1.5, -2.0], [1.38, 0], [0.74, 8.4], [0.73, 9.85], [0.9, 9.9], [0.9, 10.15], [-0.95, 10.15], [-0.95, -2.0]];
const CROWNS = [[-902.5, -146.5, 12.8, 2.5], [-908.5, -135.5, 12.2, 2.9], [-913.5, -121.5, 12.6, 2.6], [-911.0, -105.5, 11.8, 2.8], [-906.0, -96.5, 11.6, 2.2]];
function buildBastion() {
  initShared();
  const r = RNG(5601);
  begin(BG);
  ribbon('stone', BL, BPROF, BG, -1, { c: '#f4e2c0' });
  ribbon('stone', BL, [[0.74, 8.35], [1.02, 8.48], [1.07, 8.65], [1.0, 8.82], [0.73, 8.95]], BG, -1, { band: true, c: '#fff0d2', noao: true });
  // the garden over the wall: crowns on their trunks, the tall palm by the corner
  for (const [x, z, h, s] of CROWNS) {
    const g = groundY(x, z);
    cyl('flat', 0.22, 0.34, BG + h - g, 5, { p: [x, g - 0.2, z], c: '#6a5840', open: true, noao: true });
    for (let i = 0; i < 4; i++) sphere('flat', s * (0.65 + r() * 0.35), { p: [x + (r() - 0.5) * s * 1.7, BG + h + (r() - 0.35) * s, z + (r() - 0.5) * s * 1.7], seg: 7, ky: 0.7, ry: r() * 3, c: ['#3f5a2e', '#4b6a36', '#35502a', '#56723a'][i], noao: true });
  }
  const px = -906.2, pz = -150.5, g = groundY(px, pz), top = BG + 18.5;
  cyl('flat', 0.22, 0.34, top - g, 6, { p: [px, g - 0.2, pz], c: '#7a6a50', open: true, noao: true });
  cyl('flat', 0.55, 0.35, 3.2, 7, { p: [px, top - 3.4, pz], c: '#77603c', noao: true });
  for (let i = 0; i < 11; i++) { const M = mul(tr(px, top - 0.2, pz), rotY(i / 11 * 2 * PI)), t = -0.45 + (i % 3) * 0.35; extrude('flat', shapeOf([[0, 0], [0.9, 0.55 + t], [1.9, 0.35 + t * 1.3], [2.5, -0.35 + t], [1.5, 0.0 + t * 0.6], [0.7, 0.1 + t * 0.4]]), 0.07, { M, c: i % 2 ? '#587238' : '#476230', noao: true }); }
  return end('Mura di Palermo, Corso Alberto Amedeo');
}
function bastionWalls() {
  // along the foot of the outer face, and a small square round each trunk
  const foot = offsetLine(BL, -1, 1.4);
  const trunks = [...CROWNS.map(c => [c[0], c[1]]), [-906.2, -150.5]].flatMap(([x, z]) => pathWalls([[x - 0.3, z - 0.3], [x + 0.3, z - 0.3], [x + 0.3, z + 0.3], [x - 0.3, z + 0.3], [x - 0.3, z - 0.3]]));
  return [...pathWalls([BL[0], ...foot, BL[BL.length - 1]]), ...trunks];
}

TREE_CLEAR.push([880.5, -396.5, 3.5], [880.5, -403, 3.8], [880.5, -410, 3.8], [880.5, -415, 3], [875.5, -388.5, 6], [880.5, -381, 4]);   // nothing grows through the loggia or on the stair

export const R2_G1 = [
  { name: 'Porta di Vicari', x: 330, z: 616, radius: 30, skipIds: ['w279884203', 'w279883690'], build: buildVicari, walls: vicWalls() },
  { name: 'Porta Mazzara', x: -502, z: 788, radius: 35, skipIds: ['w153619353'], build: buildMazzara, walls: mazzaraWalls() },
  { name: 'Porta dei Leoni', x: -1506, z: -3460, radius: 30, skipIds: ['r18689953.0'], build: buildLeoni, walls: leoWalls() },
  { name: 'Porta Reale', x: 1130, z: 141, radius: 30, skipIds: [], build: buildReale, walls: realeWalls() },
  { name: 'Mura delle Cattive', x: 940, z: -300, radius: 140, skipIds: [], build: buildCattive, walls: cattiveWalls(), clearFences: cattiveFences },
  { name: 'Mura di Palermo, Corso Alberto Amedeo', x: -912, z: -128, radius: 50, skipIds: [], build: buildBastion, walls: bastionWalls() },
];
