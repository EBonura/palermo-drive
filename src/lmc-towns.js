// City landmarks of the towns around Palermo (docs/faithfulness/towns.md). Registered in src/landmarks-city.js, built with the full-detail tile that holds them.
// Everything is drawn in code from photos that were looked at only. Footprints are the OSM buildings of the world tiles (14_8 and 15_8; -13_7 for Monreale; 4_14 for
// Belmonte Mezzagno, -22_-13 for Capaci). Heights are estimates read off the photos against the footprints, not measurements.
// Villabate, Chiesa Madre di Sant'Agata (mid 19th century): the front is the north end, on Piazza Matrice; the regional orthophoto (Regione Siciliana SITR, 2012-13) shows one
// tiled gable roof with a round apse at the south end and no tower. The front is drawn from the parish's own emblem (a drawing of the church on the 2019 San Giuseppe festival
// poster, cronachevillabatesi.it/images/san-giuseppe-villabate2019.jpg): a tall cream gabled front with corner pilasters, a cross on the point, a round window and one portal
// under a small pediment. The half round windows high in the side walls are those seen from inside (wanderlog.com/place/details/633560). Not verified: no photo of the real front
// was found (the diocese census picture refuses requests; the street photos pass beside the square without seeing it), so proportions, colours and relief are the emblem's; a
// text snippet speaks of three doors, the emblem shows one; the sides and the back are plain.
// Villabate, Chiesa di San Giuseppe: a modern church under a tent roof of brown sheet that sweeps up from deep eaves to a tall point with three iron crosses, walls of upright
// slats between concrete posts, a low flat wing to the south, and a freestanding white bell tower to the north that tapers, carries a cross shaped ledge under the pointed bell
// openings and ends in two blades of unequal height. Mapillary 523328348824437 and 1199042473884603 (March 2021, from the east: roof, walls, tower), 160889729320719 and
// 807518163471976 (April 2021, from the north: ledge, bell, globe lamps, palms); the orthophoto for the plan and the tower's place. Not verified: the west and south sides,
// the entrance, the exact roof folds, where the lamps and the palm stand. The garden railing of the photos is not drawn here: it is the look of the map's own wall there (src/wall-looks.js).
// Villabate, Palchetto della Musica (Ernesto Basile, 1922, for the Napoli family: fondoambiente.it/luoghi/tempietto-della-musica): a square block of shops in grooved cream
// plaster, over it an open terrace with an iron railing, ten columns and a low pyramid roof with a fretted wooden edge and an iron finial. Mapillary 747931339175526,
// 109735734525655, 3934558339999073 and 743067373031377 (2021, the east and north faces). Not verified: the south and west faces; the two stairs at the back that the text
// describes are seen in no photo and are not drawn.
// Monreale, the Duomo (Santa Maria Nuova, 1174 to 1189). West front and towers: Wikimedia Commons "Monreale - Duomo di Monreale - 2024-09-29 19-18-31 001.jpg" and
// "MonrealeCathedral-pjt10.jpg" (the porch of three arches on columns under a balustrade, the interlaced arches and the gable behind it, the lower north tower with its row
// of bell openings and merlons, the taller south tower with its open upper stages). Apses: Commons "Monreale - Cathedral - 2.jpg", "Cattedrale (Monreale) 17 07 2019
// 01.jpg", "... 02.jpg", "... 04.jpg", "Monreale Cathedral 009 6460.jpg", "Monreale-bjs-3.jpg", "Monreale-bjs-17.jpg" (three registers of interlaced pointed arches inlaid
// in dark and pale stone, with roundels). Flanks: Mapillary, north side, March 2019. Roof plan: the orthophoto. The map's ground slopes right across the footprint (about
// 18 m from the north-west corner to the foot of the apses) while the photos show a level square at the front, so every part is carried down to the ground under it and
// not set on one plinth; the floor is the ground at the middle of the front. Not verified: the heights, the south side (the monastery stands there), the bronze door inside
// the porch, the carving of the porch, the number of arches round each apse.
// Belmonte Mezzagno and Capaci: their Chiesa Madre, see the notes over each model below for what is drawn from a photo and what from the type.
import * as THREE from 'three';
import { PI, begin, end, defMat, part, box, bx, cyl, cone, sphere, panel, prism, gable, extrude, pyramid, balus, rail, palm, ensureTrunk, gridMesh, mul, tr, rotY, frame, pairsOf, groundRange, groundY, initShared, paintFacade, paintAshlar, noiseDots, streaks } from './lmc-kit.js';

const SANTAGATA = { id: 'w35582356', p: [7041.8, 4272.7, 7026.2, 4308.3, 7037.9, 4313.8, 7053, 4277.7] };
const GIUSEPPE = { id: 'w48009589', p: [7651, 4293.1, 7645.2, 4303.7, 7645.1, 4310.8, 7651.7, 4323.7, 7656.8, 4337.8, 7660, 4337.2, 7666.5, 4349.3, 7683.6, 4336.3, 7673.8, 4327.2, 7677.5, 4322.4, 7681, 4322.4, 7683.8, 4310.6, 7683.3, 4302.8, 7680.6, 4302.8, 7678.6, 4296.1, 7675.1, 4290.1, 7672.1, 4291.7, 7662.5, 4283.7, 7654.9, 4295.2] };
const PALCHETTO = { id: 'w870659720', p: [7215.2, 4255.1, 7211.2, 4265.1, 7221.4, 4269.2, 7225.4, 4259.2] };

const facadeMat = (key, bayW, H, spec, px = 40) =>
  defMat(key, Math.max(64, Math.round(bayW * px / 16) * 16), Math.max(128, Math.round(H * px / 16) * 16), [bayW, H], (g, w, h) => paintFacade(g, w, h, bayW, H, spec));
const centre = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
// a point (x, z) of the frame on a front at F (outward normal n, +x to the right seen from outside) in world metres
const toWorld = (F, n) => (x, z) => [F[0] + x * n[1] + z * n[0], F[1] - x * n[0] + z * n[1]];
const poly = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.lineTo(pts[0][0], pts[0][1]); return s; };
// a pointed arch outline, w wide and h tall to the point, springing from y = 0 at the foot
const pointed = (w, h) => { const r = w / 2, y = h - w * 0.62, s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, y); s.quadraticCurveTo(r, h - w * 0.2, 0, h); s.quadraticCurveTo(-r, h - w * 0.2, -r, y); s.lineTo(-r, 0); return s; };
// 1 or -1: which side of an edge a -> b of this ring looks outward
const turn = ring => Math.sign(ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
// a wall panel along the edge a -> b (world x, z) from height y0 to y1, facing the side sg of the ring
function wall(key, a, b, y0, y1, sg, o = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
  panel(key, l, y1 - y0, { M: frame((a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2, sg * dz / l, -sg * dx / l), ...o });
}

// ---------------------------------------------------------------------------------------------------
// Chiesa Madre di Sant'Agata: a nave about 12.5 m wide and 39 m long under one tiled gable roof, a round apse roof at the south end, the front on the north end (Piazza Matrice).
// Frame F: the middle of the front on the ground, +z out of the front.
// ---------------------------------------------------------------------------------------------------
const AG_F = [7047.4, 4275.2], AG_N = [0.408, -0.913], AG_W = 12.4, AG_L = 39;
function paintAgataFront(g, w, h) {   // 12.4 m wide, 16 m tall: cream render, the sides of the corner pilasters, the round window, the portal
  const sx = w / 12.4, sy = h / 16, X = x => (x + 6.2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  R(-6.2, 0, 6.2, 16, '#ecdcae'); noiseDots(g, w, h, w * h / 60, 2, 1301, ['rgba(120,90,50,0.08)', 'rgba(255,255,240,0.09)']);
  R(-6.2, 0, 6.2, 0.9, '#b9a888');
  for (const s of [-1, 1]) for (let y = 0.9; y < 12.4; y += 0.55) R(s * 5.15 - 0.55, y, s * 5.15 + 0.55, y + 0.04, 'rgba(110,80,40,0.35)');
  R(-1.65, 0, 1.65, 4.75, '#d8bd88'); R(-1.2, 0, 1.2, 4.35, '#4a3020'); R(-0.03, 0, 0.03, 4.35, '#1e130c');
  for (const x of [-1.05, 0.2]) for (const y of [0.35, 1.7, 3.05]) R(x, y, x + 0.85, y + 1.05, '#3a2417');
  g.fillStyle = '#d3b57c'; g.beginPath(); g.arc(X(0), Y(10.8), 1.35 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#302b28'; g.beginPath(); g.arc(X(0), Y(10.8), 0.95 * sx, 0, 2 * PI); g.fill();
  g.strokeStyle = '#8a7c66'; g.lineWidth = 1.5; for (let a = 0; a < 4; a++) { g.beginPath(); g.moveTo(X(0), Y(10.8)); g.lineTo(X(0) + Math.cos(a * PI / 4) * 0.95 * sx, Y(10.8) + Math.sin(a * PI / 4) * 0.95 * sy); g.moveTo(X(0), Y(10.8)); g.lineTo(X(0) - Math.cos(a * PI / 4) * 0.95 * sx, Y(10.8) - Math.sin(a * PI / 4) * 0.95 * sy); g.stroke(); }
}
function buildSantAgata() {
  initShared();
  const pts = pairsOf(SANTAGATA.p), gr = groundRange(pts), W = toWorld(AG_F, AG_N), H = 12, rise = 2.5;
  const y0 = (groundY(...W(-AG_W / 2, 0)) + groundY(...W(AG_W / 2, 0))) / 2;
  begin(y0);
  facadeMat('vbAgWall', 4.3, H, { base: '#e2d2a8', trim: '#f2e9d0', glass: '#2a2624', seed: 1301, plinth: { h: 0.9, c: '#bba98a' }, grime: 1,
    bands: [{ y: 11.1, h: 0.5, c: '#f0e6c8' }], rows: [{ y0: 8.3, y1: 9.8, xs: [2.15], w: 2.4, kind: 'arch', fr: 0.16, sill: false }] });
  defMat('vbAgFront', 192, 256, [12.4, 16], paintAgataFront);
  prism('flat', pts, Math.min(gr.lo, y0) - 1.2, y0, { c: '#968768' });
  prism('vbAgWall', pts, y0, y0 + H, { uvo: [0, -y0 / H] });
  prism('flat', pts, y0 + H, y0 + H + 0.1, { c: '#8f8a82' });
  // the roof: a gable from the front to the apse, the apse under half a cone of tiles
  const F = frame(AG_F[0], y0, AG_F[1], AG_N[0], AG_N[1]), apse = 5.6, gl = AG_L - apse;
  gable('tile', 'vbAgWall', mul(F, tr(0, H, -gl / 2)), AG_W, gl, 0, rise, { ov: 0.3, c: '#bd8466', wc: '#e2d2a8' });
  const cg = new THREE.ConeGeometry(AG_W / 2 + 0.25, rise, 10, 1, true, PI / 2, PI); cg.translate(0, rise / 2, 0);
  part('tile', cg, { M: mul(F, tr(0, H + 0.05, -gl)), c: '#bd8466' });
  // the front: one gabled slab standing just proud of the end wall, the pilasters, the cornices along the gable, the portal's frame and pediment, the ring of the window
  // (FP is set back so the relief stays within a quarter of a metre of the footprint's wall, which is what the car meets)
  const hw = AG_W / 2 + 0.05, eave = 13, top = 15.6, FP = mul(F, tr(0, 0, -0.12));
  extrude('vbAgFront', poly([[-hw, 0], [hw, 0], [hw, eave], [0, top], [-hw, eave]]), 0.5, { M: mul(FP, tr(0, 0, -0.35)), uv: 'keep', uvk: [1 / 12.4, 1 / 16], uvo: [0.5, 0], noao: true });
  bx('flat', FP, -hw, hw, -1.4, 0.05, -0.35, 0.17, { c: '#968768' });
  for (const s of [-1, 1]) {
    bx('flat', FP, s * (hw - 1.15), s * hw, 0, eave - 0.15, 0.1, 0.32, { c: '#dcc38c' });
    for (const [a, b] of [[0.9, 1.2], [7.2, 7.55], [eave - 0.45, eave - 0.1]]) bx('flat', FP, s * (hw - 1.3), s * (hw + 0.1), a, b, 0.1, 0.42, { c: '#e8d6a4' });
    const len = Math.hypot(hw, top - eave), ang = Math.atan2(top - eave, hw);
    box('flat', len + 0.25, 0.3, 0.75, { M: FP, p: [s * hw / 2, (eave + top) / 2 - 0.1, -0.1], rz: -s * ang, c: '#cfb078', noao: true });
    bx('flat', FP, s * 1.35, s * 1.72, 0, 4.75, 0.1, 0.36, { c: '#d8bd88' });
  }
  bx('flat', FP, -2.0, 2.0, 4.75, 5.05, 0.1, 0.5, { c: '#e6d2a0' });
  extrude('flat', poly([[-2.0, 0], [2.0, 0], [0, 1.15]]), 0.3, { M: mul(FP, tr(0, 5.05, 0.1)), c: '#dcc38c' });
  part('flat', new THREE.TorusGeometry(1.15, 0.17, 4, 16), { M: mul(FP, tr(0, 10.8, 0.2)), c: '#d8bd88', noao: true });
  bx('flat', FP, -0.35, 0.35, top - 0.1, top + 0.45, -0.3, 0.2, { c: '#cfb078' });
  bx('dark', FP, -0.07, 0.07, top + 0.4, top + 2.0, -0.12, 0.0, { c: '#3a342e', noao: true }); bx('dark', FP, -0.5, 0.5, top + 1.35, top + 1.5, -0.12, 0.0, { c: '#3a342e', noao: true });
  const o = end('Chiesa Madre di Sant Agata, Villabate');
  o.userData.solids = [[SANTAGATA.p, null, y0 + H]];
  return o;
}
const cs = centre(pairsOf(SANTAGATA.p));
export const SANT_AGATA = { name: "Chiesa Madre di Sant'Agata (Villabate)", x: cs[0], z: cs[1], radius: 40, skipIds: [SANTAGATA.id], build: buildSantAgata };

// ---------------------------------------------------------------------------------------------------
// Chiesa di San Giuseppe: the tent roof over the north part of the footprint, the low wing over the rest, the freestanding bell tower to the north.
// ---------------------------------------------------------------------------------------------------
const SG_TENT = [[7645.1, 4310.8], [7645.2, 4303.7], [7651, 4293.1], [7654.9, 4295.2], [7662.5, 4283.7], [7672.1, 4291.7], [7675.1, 4290.1], [7678.6, 4296.1], [7680.6, 4302.8], [7683.3, 4302.8], [7683.8, 4310.6], [7681, 4322.4], [7668, 4320], [7651.7, 4317]];
const SG_WING = [[7645.1, 4310.8], [7651.7, 4317], [7668, 4320], [7681, 4322.4], [7677.5, 4322.4], [7673.8, 4327.2], [7683.6, 4336.3], [7666.5, 4349.3], [7660, 4337.2], [7656.8, 4337.8], [7651.7, 4323.7]];
const SG_APEX = [7658, 4306], SG_C = [7665, 4306];
const SG_TOWER = [7667.2, 4275], SG_TN = [0.966, -0.259];   // the tower and the way its front looks (east)
function paintGiuseppeWall(g, w, h) {   // a bay 4 m wide and 8 m tall: a concrete post, upright slats of brown and buff with narrow dark lights high up, a concrete foot
  const sx = w / 4, sy = h / 8, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4, 8, '#8d765c');
  for (let i = 0, x = 0.5; x < 4; i++, x += 0.35) { R(x, 0.9, x + 0.19, 7.5, i % 3 === 1 ? '#a8957a' : '#9a846a'); R(x + 0.19, 0.9, x + 0.25, 7.5, '#4a3c30'); if (i % 3 === 0) R(x + 0.04, 3.9, x + 0.15, 6.9, '#2c2a2a'); }
  R(0, 0, 0.5, 8, '#c6bcaa'); R(0.5, 0, 0.58, 8, '#6e6458'); R(0, 0, 4, 0.9, '#bdb3a0'); R(0, 3.5, 4, 3.75, '#b2a692'); R(0, 7.5, 4, 8, '#5c4636');
  streaks(g, w, h, 10, 1331, 0.1, 40);
}
function buildGiuseppe() {
  initShared(); ensureTrunk();
  defMat('sgConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#e4dcca'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + (i * 7) % 40},${80 + (i * 5) % 30},60,0.07)`; g.fillRect((i * 37) % w, (i * 53) % h, 2 + (i % 3), 2 + (i % 4)); } });
  defMat('sgWall', 128, 128, [4, 8], paintGiuseppeWall);
  const y0 = groundRange(SG_TENT).avg, eave = y0 + 8, apex = y0 + 23.6, hiW = groundRange(SG_WING).hi, wing = Math.max(y0 + 4.6, hiW + 3.2);
  begin(y0);
  const walls = (ring, top) => {
    const sg = turn(ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      wall('sgWall', a, b, Math.min(groundY(...a), groundY(...b)) - 0.4, top, sg, { uvk: [Math.max(1, Math.round(l / 4)), 1] });
    }
  };
  walls(SG_TENT, eave); walls(SG_WING, wing);
  // the wing: a flat roof with a brown edge
  const grow = (ring, c, d) => ring.map(p => { const dx = p[0] - c[0], dz = p[1] - c[1], l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * d, p[1] + dz / l * d]; });
  prism('flat', SG_WING, wing, wing + 0.35, { c: '#c7ae8c' });
  prism('flat', SG_WING, wing - 0.3, wing, { c: '#6c4434' });
  // the tent: rings from the eaves up to the point, the height rising faster and faster; the underside of the eaves and their edge
  const E = grow(SG_TENT, SG_C, 1.8), n = E.length, ccw = turn(SG_TENT) > 0;
  const arc = [0]; for (let i = 1; i <= n; i++) arc.push(arc[i - 1] + Math.hypot(E[i % n][0] - E[i - 1][0], E[i % n][1] - E[i - 1][1]));
  const rows = [0, 0.2, 0.4, 0.58, 0.74, 0.87, 0.97].map(t => E.map(p => [p[0] + (SG_APEX[0] - p[0]) * t, eave + (apex - eave) * Math.pow(t, 2.7), p[1] + (SG_APEX[1] - p[1]) * t]));
  gridMesh('lead', rows, (i, j) => [arc[j] / 2.2, i * 0.8], { wrap: true, flip: ccw, c: '#a5634c', noao: true });
  const cap = rows[rows.length - 1]; prism('flat', cap.map(p => [p[0], p[2]]), cap[0][1] - 0.15, cap[0][1], { c: '#6c4030' });
  gridMesh('dark', [E.map(p => [p[0], eave - 0.02, p[1]]), SG_TENT.map(p => [p[0], eave - 0.02, p[1]])], () => [0, 0], { wrap: true, flip: ccw, c: '#6a4a36', noao: true });
  gridMesh('flat', [E.map(p => [p[0], eave - 0.45, p[1]]), E.map(p => [p[0], eave + 0.02, p[1]])], () => [0, 0], { wrap: true, flip: ccw, c: '#7a4a38', noao: true });
  for (const [dz, h] of [[0, 3.6], [-1.0, 2.6], [-1.9, 1.6]]) {   // the three crosses on the point
    const x = SG_APEX[0], z = SG_APEX[1] + dz * 0.6, yy = apex - 1.1;
    box('dark', 0.1, h + 1.9, 0.1, { p: [x, yy - 1.4, z], c: '#33291f', noao: true }); box('dark', 0.08, 0.12, 0.9, { p: [x, yy + h, z], c: '#33291f', noao: true }); box('dark', 0.08, 0.1, 0.55, { p: [x, yy + h - 0.35, z], c: '#33291f', noao: true });
  }
  // the bell tower: two tapering stages, the cross shaped ledge, the pointed openings with the bell, the two blades and the cross
  const gt = Math.min(groundY(SG_TOWER[0] - 2, SG_TOWER[1]), groundY(SG_TOWER[0] + 2, SG_TOWER[1])) - 0.1, T = frame(SG_TOWER[0], gt, SG_TOWER[1], SG_TN[0], SG_TN[1]), white = '#ece6d6';
  const taper = (ya, wa, da, yb, wb, db) => {
    const at = (y, hw, hd) => [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]].map(([x, z]) => [x, y, z]);
    gridMesh('sgConc', [at(ya, wa, da), at(yb, wb, db)], (i, j) => [j * 0.7, (i ? yb : ya) / 4], { wrap: true, M: T, c: white });
    bx('sgConc', T, -wb, wb, yb - 0.1, yb, -db, db, { c: white });
  };
  taper(0, 2.45, 1.75, 15, 1.65, 1.3); taper(15, 1.6, 1.28, 19.7, 1.2, 1.0);
  extrude('sgConc', poly([[-1.2, 0], [1.2, 0], [1.0, 2.1], [0.05, 3.3], [-0.1, 5.2], [-0.65, 5.2]]), 1.6, { M: mul(T, tr(0, 19.65, -0.8)), c: white });
  bx('sgConc', T, -2.8, 2.8, 14.6, 15.5, -0.75, 0.75, { c: '#e6dfcc' }); bx('sgConc', T, -0.75, 0.75, 14.62, 15.48, -2.45, 2.45, { c: '#e6dfcc' });
  const hole = poly([[-0.72, 0], [0.72, 0], [0.72, 1.35], [0, 2.15], [-0.72, 1.35]]);
  for (const [a, half] of [[0, 1.22], [PI, 1.22], [PI / 2, 1.5], [-PI / 2, 1.5]]) {
    const Mf = mul(T, rotY(a));
    extrude('dark', hole, 0.3, { M: mul(Mf, tr(0, 15.55, half - 0.22)), c: '#3a332c', noao: true });
    bx('dark', Mf, -0.7, 0.7, 16.85, 17.0, half + 0.06, half + 0.18, { c: '#4a3a28', noao: true });
    cyl('dark', 0.17, 0.38, 0.75, 6, { M: mul(Mf, tr(0, 16.08, half + 0.14)), c: '#8a6a34', noao: true });
  }
  for (const y of [6.4, 11.2]) bx('dark', T, -0.14, 0.14, y, y + 1.4, 1.4, 1.75 - y * 0.03 + 0.05, { c: '#2c2824', noao: true });
  cyl('flat', 0.5, 0.5, 0.12, 8, { M: mul(mul(T, tr(0, 9.4, 1.47)), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#9aa6b4', noao: true });
  bx('dark', T, -0.36, -0.24, 24.8, 26.4, -0.06, 0.06, { c: '#33291f', noao: true }); bx('dark', T, -0.7, 0.1, 25.75, 25.88, -0.06, 0.06, { c: '#33291f', noao: true });
  // the garden north of it: two lamps with clusters of globes and a tall palm, behind the garden wall
  for (const [x, z] of [[7660.5, 4252.5], [7663.5, 4259.5]]) {
    const y = groundY(x, z);
    box('dark', 0.14, 5.2, 0.14, { p: [x, y, z], c: '#8a8e90', noao: true });
    for (const [dx, dy, dz] of [[0, 5.45, 0], [-0.75, 4.6, 0], [0.75, 4.6, 0], [0, 4.25, 0.7]]) { sphere('flat', 0.33, { p: [x + dx, y + dy, z + dz], seg: 6, c: '#f0e2a8', noao: true }); if (dx || dz) box('dark', Math.abs(dx) || 0.06, 0.06, Math.abs(dz) || 0.06, { p: [x + dx / 2, y + dy - 0.4, z + dz / 2], c: '#8a8e90', noao: true }); }
  }
  palm(7668.6, groundY(7668.6, 4250.5) - 0.2, 4250.5, 11);
  const o = end('Chiesa di San Giuseppe, Villabate');
  o.userData.solids = [[SG_TENT.flat(), null, eave], [SG_WING.flat(), null, wing]];
  return o;
}
const sgW = toWorld(SG_TOWER, SG_TN);
export const SAN_GIUSEPPE = {
  name: 'Chiesa di San Giuseppe (Villabate)', x: 7664.5, z: 4300, radius: 55, skipIds: [GIUSEPPE.id], build: buildGiuseppe,
  walls: [[-2.45, -1.75], [2.45, -1.75], [2.45, 1.75], [-2.45, 1.75]].map((q, i, r) => [...sgW(...q), ...sgW(...r[(i + 1) % 4])]),   // the foot of the freestanding tower
};

// ---------------------------------------------------------------------------------------------------
// Palchetto della Musica: the block of shops, the terrace with its ten columns (four on the north and south faces, three on the east and west, corners shared), the roof.
// Frame E: the middle of the square on the ground, +z out of the east face, +x towards the north.
// ---------------------------------------------------------------------------------------------------
const PV_N = [0.928, 0.373];
function paintPalchettoWall(g, w, h) {   // three faces side by side, 11 m each and 3.75 m tall: the east one, the north one, a plain one for the two sides no photo shows
  const sx = w / 33, sy = h / 3.75, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 33, 3.75, '#ead7a4'); noiseDots(g, w, h, w * h / 50, 1.6, 1701, ['rgba(120,90,50,0.08)', 'rgba(255,250,230,0.09)']);
  for (let j = 0, y = 0.42; y < 3.3; j++, y += 0.42) { R(0, y, 33, y + 0.05, 'rgba(110,80,40,0.4)'); for (let x = (j % 2) * 0.6; x < 33; x += 1.2) R(x, y, x + 0.05, y + 0.42, 'rgba(110,80,40,0.22)'); }
  R(0, 0, 33, 0.42, '#b7a584'); R(0, 3.38, 33, 3.5, 'rgba(110,80,40,0.35)'); R(0, 3.5, 33, 3.75, '#f1e2b6');
  const door = (x, sign) => {
    R(x - 0.85, 0, x + 0.85, 2.7, '#d2bd8c'); R(x - 0.65, 0, x + 0.65, 2.5, '#2e2a28'); R(x - 0.6, 0.5, x - 0.04, 2.4, '#4a5258'); R(x + 0.04, 0.5, x + 0.6, 2.4, '#3c4248');
    R(x - 1.05, 2.72, x + 1.05, 3.3, '#4a2c1e');
    g.fillStyle = '#efe6d2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(0.34 * sy)}px sans-serif`; g.fillText(sign, x * sx, h - 3.01 * sy, 1.9 * sx);
  };
  door(2.3, 'LOTTO'); door(7.8, 'TABACCHI');
  R(11.7, 1.15, 12.7, 3.0, '#cfc9ba'); for (let y = 1.4; y < 2.85; y += 0.2) R(11.82, y, 12.58, y + 0.04, '#8a847a');
  door(14.3, 'FUMATORI'); door(17.0, 'TABACCHI'); door(19.8, '');   // the third board's lettering cannot be read in the photos
  streaks(g, w, h, 40, 1702, 0.08, 36);
}
function buildPalchetto() {
  initShared();
  const pts = pairsOf(PALCHETTO.p), c = centre(pts), gr = groundRange(pts), y0 = (gr.lo + gr.hi) / 2 - 0.15, hx = 5.39, hz = 5.5;
  defMat('pvWall', 768, 128, [33, 3.75], paintPalchettoWall);
  defMat('pvFringe', 64, 64, [0.8, 0.75], (g, w, h) => {   // the wooden edge of the roof: a moulding, brackets, a row of fretted pendants
    g.clearRect(0, 0, w, h); g.fillStyle = '#8a5538'; g.fillRect(0, 0, w, 40); g.fillStyle = '#5c3624'; g.fillRect(0, 8, w, 3); g.fillRect(0, 36, w, 4);
    g.fillStyle = '#c49a72'; for (let x = 3; x < w; x += 16) g.fillRect(x, 14, 8, 19);
    g.fillStyle = '#7a4a30'; for (let x = 0; x < w; x += 16) { g.fillRect(x + 2, 40, 12, 9); g.beginPath(); g.arc(x + 8, 52, 6.5, 0, 2 * PI); g.fill(); g.fillRect(x + 6, 55, 4, 8); }
  }, { alphaTest: 0.5, side: THREE.DoubleSide });
  begin(y0);
  const E = frame(c[0], y0, c[1], PV_N[0], PV_N[1]);
  prism('flat', pts, Math.min(gr.lo, y0) - 0.8, y0 + 0.05, { c: '#8f8266' });
  for (const [a, w, d, seg] of [[0, 2 * hx, hz, 0], [PI / 2, 2 * hz, hx, 1], [PI, 2 * hx, hz, 2], [-PI / 2, 2 * hz, hx, 2]]) panel('pvWall', w, 3.75, { M: mul(mul(E, rotY(a)), tr(0, 0, d)), uvk: [1 / 3, 1], uvo: [seg / 3, 0] });
  bx('flat', E, -hx - 0.28, hx + 0.28, 3.75, 4.08, -hz - 0.28, hz + 0.28, { c: '#ecdcae' });   // the cornice that carries the terrace
  const T = 4.08, cx = hx - 0.3, cz = hz - 0.3, zs = [-cz, -cz / 3, cz / 3, cz];
  const cols = [...zs.flatMap(z => [[-cx, z], [cx, z]]), [0, -cz], [0, cz]];
  for (const [x, z] of cols) {
    bx('flat', E, x - 0.29, x + 0.29, T, T + 1.0, z - 0.29, z + 0.29, { c: '#dfc99a' });
    bx('flat', E, x - 0.34, x + 0.34, T + 1.0, T + 1.12, z - 0.34, z + 0.34, { c: '#ead8ac' });
    cyl('flat', 0.18, 0.23, 2.15, 8, { M: mul(E, tr(x, T + 1.12, z)), c: '#e2d0a8', noao: true });
    bx('flat', E, x - 0.29, x + 0.29, T + 3.27, T + 3.47, z - 0.29, z + 0.29, { c: '#ead8ac' });
  }
  for (const s of [-1, 1]) {
    bx('flat', E, s * cx - 0.2, s * cx + 0.2, T + 3.47, T + 3.75, -cz - 0.2, cz + 0.2, { c: '#b99a78' });
    bx('flat', E, -cx + 0.2, cx - 0.2, T + 3.47, T + 3.75, s * cz - 0.2, s * cz + 0.2, { c: '#b99a78' });
    for (let i = 0; i < 3; i++) rail(mul(mul(E, tr(s * cx, T, (zs[i] + zs[i + 1]) / 2)), rotY(PI / 2)), zs[i + 1] - zs[i] - 0.58, 1.0, { c: '#b8b8c0' });
    for (const x of [-cx / 2, cx / 2]) rail(mul(E, tr(x, T, s * cz)), cx - 0.58, 1.0, { c: '#b8b8c0' });
  }
  // the roof: the fretted edge all round, the dark boards under it, the low pyramid, the iron finial
  const rx = hx + 0.75, rz = hz + 0.75, Y = T + 3.9;
  for (const [a, w, d] of [[0, 2 * rx, rz], [PI, 2 * rx, rz], [PI / 2, 2 * rz, rx], [-PI / 2, 2 * rz, rx]]) panel('pvFringe', w, 0.75, { M: mul(mul(E, rotY(a)), tr(0, Y - 0.6, d)), uvk: [Math.round(w / 0.8), 1] });
  bx('dark', E, -rx + 0.03, rx - 0.03, Y - 0.02, Y + 0.1, -rz + 0.03, rz - 0.03, { c: '#6a5240', noao: true });
  for (const s of [-1, 1]) box('dark', 0.14, 0.16, 2 * Math.hypot(cx, cz), { M: E, p: [0, Y - 0.2, 0], ry: s * Math.atan2(cx, cz), c: '#4a382a', noao: true });
  pyramid('flat', 2 * rx + 0.1, 2 * rz + 0.1, 1.35, { M: mul(E, tr(0, Y + 0.1, 0)), c: '#69625c', noao: true });
  const P = Y + 1.35;
  box('dark', 0.13, 2.1, 0.13, { M: E, p: [0, P, 0], c: '#3c3834', noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(mul(E, tr(0, P + 0.15, 0)), rotY(k * PI / 2)); part('dark', new THREE.TorusGeometry(0.46, 0.06, 3, 7, PI), { M: mul(M, tr(0.45, 0, 0)), c: '#3c3834', noao: true }); part('dark', new THREE.TorusGeometry(0.22, 0.05, 3, 6, PI * 1.5), { M: mul(M, tr(0.22, 0.55, 0)), c: '#3c3834', noao: true }); }
  const o = end('Palchetto della Musica, Villabate');
  o.userData.solids = [[PALCHETTO.p, null, y0 + 3.75]];   // the shops; the terrace is open
  return o;
}
export const PALCHETTO_VB = { name: 'Palchetto della Musica (Villabate)', x: centre(pairsOf(PALCHETTO.p))[0], z: centre(pairsOf(PALCHETTO.p))[1], radius: 15, skipIds: [PALCHETTO.id], build: buildPalchetto };

// ---------------------------------------------------------------------------------------------------
// Duomo di Monreale. The OSM footprint w82665029 is the church alone, a rectangle of about 88 by 43 m whose long axis runs east-north-east (the west front looks over Piazza Guglielmo II
// to the west-south-west) and a rounded east end. Positions below are (u, v): u metres east along the nave from the middle of the west front, v metres north of its axis.
// Frame FF: origin at the middle of the west front at floor level, local +z towards the west (out of the front), local +x towards the south: x = -v, z = -u.
// ---------------------------------------------------------------------------------------------------
const DUOMO = { id: 'w82665029', p: [-6090, 3716.4, -6082.7, 3738.1, -6076.5, 3757.6, -6023.7, 3739.4, -6022.9, 3741.5, -5993.5, 3731.5, -5998.5, 3715.6, -5995, 3714.1, -5995.9, 3712, -5992.8, 3709, -5992.7, 3705.6, -5994, 3702.3, -5996.4, 3701, -5999.4, 3700.9, -6001, 3701.2, -6002, 3699.2, -6006.4, 3701, -6010.5, 3690.9, -6020.3, 3694.4, -6035.3, 3699.8, -6041.7, 3700] };
const DU_AXIS = [0.949, -0.316];   // from the north-west corner (-6090, 3716.4) to the south-west corner (-6076.5, 3757.6) is 43.4 m: the front; the nave runs along this axis
const DU_F = [(-6090 + -6076.5) / 2, (3716.4 + 3757.6) / 2];
const duUV = (u, v) => [DU_F[0] + DU_AXIS[0] * u + DU_AXIS[1] * v, DU_F[1] + DU_AXIS[1] * u - DU_AXIS[0] * v];
const DU_APSES = { c: [88.8, 1.2, 6.9], n: [84.2, 14.6, 5.2], s: [86.8, -14, 5.2] };   // u, v, radius
const DU_STONE = '#c2ab84', DU_JOINT = '#8b7b62';
// a pointed arch of inlaid stone on the canvas: a dark line, the tufa moulding, a dotted pale inlay
function inlayArch(g, xa, xb, ys, ya, t) {
  const xm = (xa + xb) / 2, rise = ys - ya;
  const path = () => { g.beginPath(); g.moveTo(xa, ys); g.bezierCurveTo(xa, ys - rise * 0.6, xm - (xm - xa) * 0.35, ya + rise * 0.12, xm, ya); g.bezierCurveTo(xm + (xb - xm) * 0.35, ya + rise * 0.12, xb, ys - rise * 0.6, xb, ys); };
  path(); g.strokeStyle = '#54453a'; g.lineWidth = t; g.setLineDash([]); g.stroke();
  path(); g.strokeStyle = '#d0b28a'; g.lineWidth = t * 0.66; g.stroke();
  path(); g.strokeStyle = '#463a32'; g.lineWidth = t * 0.26; g.setLineDash([t * 0.4, t * 0.45]); g.stroke(); g.setLineDash([]);
}
function roundel(g, x, y, r) {
  for (const [k, c] of [[1, '#52443a'], [0.8, '#e6dcc2'], [0.58, '#7a5a44'], [0.34, '#ece2c8'], [0.15, '#40342c']]) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * k, r * k * 0.85, 0, 0, 2 * PI); g.fill(); }
  g.fillStyle = '#e6dcc2'; for (let a = 0; a < 8; a++) g.fillRect(x + Math.cos(a * PI / 4) * r * 0.46 - 1, y + Math.sin(a * PI / 4) * r * 0.39 - 1, 2, 2);
}
function paintApse(g, w, h) {   // one bay of the east end, 4.7 m wide and the whole height: foot, blind arches interlaced, band, a second order on colonnettes, band, a small arcade, corbels
  const Y = f => h * (1 - f), R = (x0, f0, x1, f1, c) => { g.fillStyle = c; g.fillRect(x0 * w, Y(f1), (x1 - x0) * w, (f1 - f0) * h); };
  R(0, 0, 1, 1, '#c3a27a'); paintAshlar(g, w, h, 4.7, 34, 0.55, 1.0, '#c2a27c', '#957a5c', 1801, 1, 0.08);
  R(0, 0, 1, 0.035, '#8d7a60');
  const panelArch = (x0, x1, f0, f1, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0 * w, Y(f0)); g.lineTo(x0 * w, Y(f1 - 0.035)); g.quadraticCurveTo(x0 * w, Y(f1 - 0.008), (x0 + x1) / 2 * w, Y(f1)); g.quadraticCurveTo(x1 * w, Y(f1 - 0.008), x1 * w, Y(f1 - 0.035)); g.lineTo(x1 * w, Y(f0)); g.fill(); };
  const column = (x, f0, f1) => { R(x - 0.05, f0, x + 0.05, f1, '#e2d4b6'); R(x - 0.014, f0, x + 0.014, f1, '#6a584a'); R(x - 0.085, f1 - 0.008, x + 0.085, f1 + 0.004, '#8f765c'); };
  panelArch(0.22, 0.78, 0.05, 0.285, '#6e5a48'); panelArch(0.26, 0.74, 0.05, 0.275, '#d2c1a0'); panelArch(0.36, 0.64, 0.05, 0.245, '#c4ad88');
  roundel(g, w * 0.5, Y(0.19), w * 0.15); R(0.34, 0.095, 0.66, 0.14, '#8a7258'); R(0.37, 0.103, 0.63, 0.132, '#cdb794'); for (let i = 0; i < 5; i++) R(0.39 + i * 0.05, 0.108, 0.41 + i * 0.05, 0.127, '#4a3c32');
  for (const x of [0, 1]) column(x, 0.035, 0.265);
  for (const k of [-1, 0, 1]) inlayArch(g, k * w, (k + 1.5) * w, Y(0.265), Y(0.392), w * 0.095);
  roundel(g, w * 0.5, Y(0.325), w * 0.14); roundel(g, 0, Y(0.378), w * 0.09); roundel(g, w, Y(0.378), w * 0.09);
  const band = (f0, f1) => { R(0, f0, 1, f1, '#d6c29c'); const n = 14; for (let i = 0; i < n; i++) { R(i / n, f0 + (f1 - f0) * 0.18, (i + 0.5) / n, f0 + (f1 - f0) * 0.5, '#43362e'); R((i + 0.5) / n, f0 + (f1 - f0) * 0.5, (i + 1) / n, f0 + (f1 - f0) * 0.82, '#43362e'); } R(0, f1 - 0.004, 1, f1, '#efe4c8'); R(0, f0 - 0.004, 1, f0, '#6a584a'); };
  band(0.4, 0.44);
  panelArch(0.24, 0.76, 0.455, 0.655, '#6e5a48'); panelArch(0.285, 0.715, 0.46, 0.645, '#dccdac');
  R(0.285, 0.545, 0.715, 0.557, '#6a584a'); roundel(g, w * 0.5, Y(0.512), w * 0.13); roundel(g, w * 0.5, Y(0.596), w * 0.1);
  for (const x of [0, 0.13, 0.87, 1]) column(x, 0.44, 0.635);
  for (const k of [-1, 0, 1]) inlayArch(g, k * w, (k + 1.5) * w, Y(0.635), Y(0.755), w * 0.09);
  roundel(g, w * 0.5, Y(0.695), w * 0.12); roundel(g, 0, Y(0.742), w * 0.09); roundel(g, w, Y(0.742), w * 0.09);
  band(0.765, 0.8);
  for (const x of [0.25, 0.75]) { panelArch(x - 0.13, x + 0.13, 0.815, 0.893, '#e2d6bc'); roundel(g, w * x, Y(0.84), w * 0.075); }
  for (const x of [0, 0.5, 1]) column(x, 0.8, 0.872);
  for (let k = -1; k < 3; k++) inlayArch(g, k * w / 2, (k + 1.5) * w / 2, Y(0.872), Y(0.935), w * 0.06);
  band(0.945, 0.968);
  for (let i = 0; i < 9; i++) R(i / 9 + 0.02, 0.972, i / 9 + 0.06, 0.99, '#4e4034'); R(0, 0.99, 1, 1, '#dcc9a4');
  streaks(g, w, h, 14, 1802, 0.14, 120, '50,36,26');
}
function paintDuFront(g, w, h) {   // the wall over the porch, 21 m wide from 12.2 to 26 m: pinkish tufa, interlaced arches, the middle window, the gable with its roundels
  const sx = w / 21, sy = h / 13.8, X = x => (x + 10.5) * sx, Y = y => h - (y - 12.2) * sy;
  paintAshlar(g, w, h, 21, 13.8, 0.45, 0.9, '#bd9a7c', '#93765c', 1811, 1, 0.07);
  for (let x = -12.6; x < 10.5; x += 2.1) inlayArch(g, X(x), X(x + 3.15), Y(16.4), Y(20.1), 0.3 * sx);
  for (let x = -10.5; x < 11; x += 2.1) { g.fillStyle = '#dccbac'; g.fillRect(X(x) - 0.1 * sx, Y(16.4), 0.2 * sx, 4.2 * sy); roundel(g, X(x + 1.05), Y(15.6), 0.45 * sx); }
  const win = (r, y1, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(-r), Y(12.2)); g.lineTo(X(-r), Y(y1 - r)); g.arc(X(0), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(r), Y(12.2)); g.fill(); };
  win(3.1, 19.7, '#d6bc96'); win(2.65, 19.25, '#6a5242'); win(2.3, 18.9, '#cdb08a'); win(1.65, 18.25, '#2a2420');
  g.strokeStyle = '#6e6052'; g.lineWidth = 2; for (let x = -1.1; x < 1.2; x += 0.55) { g.beginPath(); g.moveTo(X(x), Y(12.2)); g.lineTo(X(x), Y(17.5)); g.stroke(); }
  const band = (y0, y1) => { g.fillStyle = '#d9c4a2'; g.fillRect(0, Y(y1), w, (y1 - y0) * sy); g.fillStyle = '#4a3a30'; for (let x = 0; x < w; x += 12) g.fillRect(x, Y(y1 - 0.18), 6, (y1 - y0 - 0.36) * sy); };
  band(20.35, 21.05);
  g.fillStyle = '#c7a488'; g.beginPath(); g.moveTo(X(-10.5), Y(21.05)); g.lineTo(X(0), Y(25.8)); g.lineTo(X(10.5), Y(21.05)); g.fill();
  roundel(g, X(-2.5), Y(22.4), 0.9 * sx); roundel(g, X(2.5), Y(22.4), 0.9 * sx); roundel(g, X(0), Y(22.9), 1.15 * sx);
  streaks(g, w, h, 30, 1812, 0.1, 70);
}
// one face of a tower: ashlar, then the windows [x, y0, width, height, kind] in metres (x from the middle), string courses with their inlay
function paintTower(g, w, h, Wm, Hm, wins, bands, seed) {
  const sx = w / Wm, sy = h / Hm, X = x => (x + Wm / 2) * sx, Y = y => h - y * sy;
  paintAshlar(g, w, h, Wm, Hm, 0.55, 1.1, '#bb9f76', '#8e775a', seed, 1, 0.11);
  noiseDots(g, w, h, w * h / 40, 3, seed + 2, ['rgba(80,55,30,0.16)', 'rgba(235,210,165,0.10)']);
  for (const y of bands) { g.fillStyle = '#d4bd94'; g.fillRect(0, Y(y + 0.35), w, 0.7 * sy); g.fillStyle = '#54453a'; for (let x = 0; x < w; x += 8) g.fillRect(x, Y(y + 0.12), 4, 0.24 * sy); }
  const arch = (x, y, ww, hh, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y)); g.lineTo(X(x - r), Y(y + hh - r)); g.arc(X(x), Y(y + hh - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y)); g.fill(); };
  for (const [x, y, ww, hh, kind] of wins) {
    if (kind === 'rect') { g.fillStyle = '#d0b992'; g.fillRect(X(x - ww / 2 - 0.2), Y(y + hh + 0.2), (ww + 0.4) * sx, (hh + 0.4) * sy); g.fillStyle = '#1d1712'; g.fillRect(X(x - ww / 2), Y(y + hh), ww * sx, hh * sy); }
    else if (kind === 'blind') { arch(x, y, ww + 0.7, hh + 0.35, '#cfb48c'); arch(x, y, ww, hh, '#a4875f'); }
    else { arch(x, y, ww + 0.8, hh + 0.4, '#ccb28a'); arch(x, y, ww + 0.35, hh + 0.18, '#7d674c'); arch(x, y, ww, hh, '#17110d'); }
  }
  streaks(g, w, h, 26, seed + 1, 0.13, 90);
}
function buildDuomo() {
  initShared();
  const pts = pairsOf(DUOMO.p), ax = DU_AXIS[0], az = DU_AXIS[1], W = 43.4, E = 21;
  const y0 = groundY(...duUV(0, 3)) + 0.2;   // the floor: the ground in the middle of the front
  const FF = frame(DU_F[0], y0, DU_F[1], -ax, -az);                      // faces the west, x to the south
  // the long walls: three registers in a bay of 5.5 m (the arcade of the north portico at the foot, blind arches, pointed windows under the eaves)
  facadeMat('duoWall', 5.5, 22, { base: DU_STONE, ashlar: { base: DU_STONE, joint: DU_JOINT, course: 0.42, block: 0.95, seed: 1401, jw: 1.6, vary: 0.05 }, trim: '#d9c7a0', glass: '#1d1914', seed: 1402, grime: 1,
    bands: [{ y: 9.6, h: 0.5, c: '#d2bd94' }, { y: 15.2, h: 0.45, c: '#d2bd94' }, { y: 21.2, h: 0.8, c: '#cdb68c' }],
    rows: [{ y0: 0.4, y1: 8.4, xs: [2.75], w: 2.9, kind: 'arch', fr: 0.2, sill: false, glass: '#5a4a38' }, { y0: 10.6, y1: 13.8, xs: [1.45, 4.05], w: 1.9, kind: 'arch', fr: 0.15, sill: false, glass: '#4b3f30' },
      { y0: 16.4, y1: 20.4, xs: [2.75], w: 1.3, kind: 'point', fr: 0.16, sill: false }] }, 36);
  defMat('duoApse', 160, 640, [4.7, 34], paintApse);
  defMat('duoFront', 512, 336, [21, 13.8], paintDuFront);
  defMat('duoTowerN', 192, 448, [11.2, 25.6], (g, w, h) => paintTower(g, w, h, 11.2, 25.6,
    [[-1.2, 3.6, 0.35, 2.4, 'rect'], [2.4, 7.2, 0.35, 1.8, 'rect'], [0, 13.4, 1.4, 3.4, 'arch'], ...[-3.6, -1.2, 1.2, 3.6].map(x => [x, 22.4, 1.1, 2.1, 'arch'])], [11.5, 21.6, 25.2], 1821));
  defMat('duoTowerS', 176, 608, [11.2, 38], (g, w, h) => paintTower(g, w, h, 11.2, 38,
    [[-0.6, 3.4, 1.3, 1.6, 'rect'], [1.6, 8.0, 0.9, 1.1, 'rect'], [0, 14.2, 1.5, 4.4, 'arch'], [0, 23.2, 3.0, 5.2, 'arch'], [0, 31.0, 5.2, 5.6, 'blind'], [-1.05, 31.2, 1.55, 3.8, 'arch'], [1.05, 31.2, 1.55, 3.8, 'arch']], [11.5, 22, 30, 37.4], 1831));
  defMat('duoClock', 128, 128, [1, 1], (g, w, h) => {
    g.fillStyle = '#c9b48c'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8dfc8'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 2 * PI); g.fill();
    g.strokeStyle = '#3b3328'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#3b3328';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.fillRect(w / 2 + Math.sin(a) * w * 0.38 - 2, h / 2 - Math.cos(a) * w * 0.38 - 2, 4, 4); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 14, h / 2 - 30); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 36, h / 2 + 6); g.stroke();
  });
  begin(y0);
  const low = (...q) => Math.min(...q.map(p => groundY(...p))) - 0.4;
  // ---- the walls, bay by bay down to the ground under each; where that is far below the floor an arcade stands on it under the three registers
  const sg = turn(pts);
  const flank = (a, b) => {
    const pa = duUV(...a), pb = duUV(...b), l = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), n = Math.max(1, Math.round(l / 5.5));
    for (let i = 0; i < n; i++) {
      const p = [0, 1].map(k => pa[k] + (pb[k] - pa[k]) * i / n), q = [0, 1].map(k => pa[k] + (pb[k] - pa[k]) * (i + 1) / n), g = low(p, q, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      if (g < y0 - 4) { wall('duoWall', p, q, g, y0, sg, { uvk: [1, 9.6 / 22] }); wall('duoWall', p, q, y0, y0 + E, sg); } else wall('duoWall', p, q, g, y0 + E, sg);
    }
  };
  flank([11, -21.5], [55.8, -21.1]); flank([55.8, -21.1], [55.9, -23.3]); flank([55.9, -23.3], [86.9, -23.1]);
  flank([83.6, 20.8], [73.2, 20.5]); flank([73.2, 20.5], [57.3, 20.2]); flank([57.3, 20.2], [51.1, 22]); flank([51.1, 22], [11, 21.8]);
  // the walls beside the apses carry the same arches as they do
  for (const [a, b] of [[[86.9, -23.1], [87, -6.4]], [[87, -6.4], [87.2, 10.2]], [[87.2, 10.2], [84.3, 10]], [[84.3, 10], [83.6, 20.8]]]) {
    const pa = duUV(...a), pb = duUV(...b);
    wall('duoApse', pa, pb, low(pa, pb), y0 + E, sg, { uvk: [Math.max(1, Math.round(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / 4.7)), 1] });
  }
  // ---- the apses: half drums from the ground, their cornices standing out between the orders, colonnettes between the bays, tiled half cones
  const apse = ([u, v, r], top, bays) => {
    const T0 = -PI / 2 - 0.16, TL = PI + 0.32, seg = bays * 3, c = duUV(u, v);
    const base = low(...[-1.57, -0.8, 0, 0.8, 1.57].map(a => duUV(u + Math.cos(a) * r, v + Math.sin(a) * r))), hh = top - base;
    const M = frame(c[0], base, c[1], ax, az);
    cyl('duoApse', r, r, hh, seg, { M, open: true, t0: T0, tl: TL, uvk: [bays, 1], noao: true });
    for (const [f0, d, o] of [[0.402, 0.036, 0.28], [0.766, 0.032, 0.22], [0.968, 0.034, 0.34]]) {
      cyl('flat', r + o, r + o, hh * d, seg, { M: mul(M, tr(0, hh * f0, 0)), open: true, t0: T0, tl: TL, c: '#c9ac84', noao: true });
      const ring = new THREE.RingGeometry(r - 0.05, r + o, seg, 1, T0 - PI / 2, TL); ring.rotateX(PI / 2);
      part('flat', ring, { M: mul(M, tr(0, hh * f0, 0)), c: '#7d6850', noao: true });
    }
    for (let k = 1; k < bays; k++) {
      const Mk = mul(M, rotY(T0 + TL * k / bays));
      for (const [f0, f1] of [[0.035, 0.265], [0.44, 0.635]]) bx('flat', Mk, -0.16, 0.16, hh * f0, hh * f1, r - 0.05, r + 0.2, { c: '#d6c3a0', noao: true });
    }
    const rh = r * 0.42, roof = new THREE.ConeGeometry(r + 0.3, rh, seg, 1, true, T0, TL); roof.translate(0, rh / 2, 0);
    part('lead', roof, { M: mul(M, tr(0, hh, 0)), c: '#b09c84', noao: true });
    return { M, hh };
  };
  const mid = apse(DU_APSES.c, y0 + E + 1.6, 5);
  const midH = mid.hh;
  for (const [key, w, h, z, col] of [['flat', 3.0, 6.3, 0.0, '#d9c4a0'], ['dark', 2.1, 5.5, 0.06, '#2a211a']]) extrude(key, pointed(w, h), 0.2, { M: mul(mid.M, tr(0, midH * 0.475, DU_APSES.c[2] - 0.08 + z)), c: col, noao: true });
  for (const k of ['n', 's']) { const c = duUV(DU_APSES[k][0] + DU_APSES[k][2], DU_APSES[k][1]); apse(DU_APSES[k], Math.min(y0 + E - 2.5, groundY(...c) + midH * 0.76), 4); }
  // ---- the roofs: the cap, the nave under its low gable, the aisles' slopes, the raised presbytery under glazed tiles
  prism('flat', [[7, 21.6], [7, -21.4], [55.8, -21.1], [55.9, -23.3], [86.9, -23.1], [87.1, 10.2], [84.3, 10], [83.6, 20.8], [73.2, 20.5], [57.3, 20.2], [51.1, 22]].map(q => duUV(...q)), y0 + E - 0.1, y0 + E + 0.1, { c: '#9a8a70' });
  const along = (u, y) => frame(...(() => { const p = duUV(u, 0); return [p[0], y0 + y, p[1]]; })(), ax, az);
  bx('tufa', along(32, E), -9.8, 9.8, 0, 0.9, -25, 25, { c: '#c9ab82' });
  gable('lead', 'tufa', along(32, E + 0.9), 19.6, 50, 0, 3.6, { ov: 0.35, c: '#ad9a80', wc: '#c9ab82' });
  for (const s of [-1, 1]) box('lead', 11.6, 0.2, 45, { M: along(33.5, E + 0.5), p: [s * 15.5, 0, 0], rz: -s * 0.055, c: '#a69880', noao: true });
  bx('tufa', along(70.6, E), -10.6, 10.6, 0, 3.4, -13.6, 13.6, { c: '#c9ab82' });
  gable('lead', 'tufa', along(70.6, E + 3.4), 21.2, 27.2, 0, 3.4, { ov: 0.4, c: '#8c9674', wc: '#c9ab82' });
  // ---- the towers: faces carried down to their own ground, cornices, the crowns
  const TW = 11.2;
  const faces = (T, key, w, ya, yb, texH, uw = 1) => { for (const a of [0, PI / 2, PI, -PI / 2]) panel(key, w, yb - ya, { M: mul(mul(T, rotY(a)), tr(0, ya, w / 2)), uvk: [uw, (yb - Math.max(0, ya)) / texH], uvo: [(1 - uw) / 2, Math.max(0, ya) / texH] }); };
  const cornice = (T, w, y, c = '#d2bd94') => bx('flat', T, -w / 2 - 0.35, w / 2 + 0.35, y, y + 0.5, -w / 2 - 0.35, w / 2 + 0.35, { c });
  const tower = (x, key, texH) => {
    const T = mul(FF, tr(x, 0, -TW / 2 - 0.02));
    const g = low(...[[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 0]].map(([s, d]) => duUV(d * TW, -x + s * TW / 2))) - y0;
    faces(T, key, TW, g, 11.5, texH); cornice(T, TW, 11.3);
    return T;
  };
  const N = tower(-16.1, 'duoTowerN', 25.6);
  faces(N, 'duoTowerN', TW, 11.5, 25.6, 25.6); cornice(N, TW, 25.3);
  bx('flat', N, -TW / 2 + 0.2, TW / 2 - 0.2, 25.3, 25.7, -TW / 2 + 0.2, TW / 2 - 0.2, { c: '#9a8668' });
  for (let i = 0; i < 6; i++) for (const [fx, fz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {   // merlons round the top, a notch in each
    const t = (i + 0.5) / 6 * (TW + 0.5) - (TW + 0.5) / 2, a = fx ? fx * (TW / 2) : t, b = fz ? fz * (TW / 2) : t;
    bx('flat', N, a - (fx ? 0.3 : 0.55), a + (fx ? 0.3 : 0.55), 25.8, 26.8, b - (fz ? 0.3 : 0.55), b + (fz ? 0.3 : 0.55), { c: '#c2a880', noao: true });
    pyramid('flat', fx ? 0.6 : 0.6, 0.6, 0.55, { M: mul(N, tr(a, 26.8, b)), c: '#b89e76', noao: true });
  }
  bx('tufa', N, -5.2, -2.0, 25.7, 29.0, -4.6, -2.6, { c: '#c4a87e' }); pyramid('flat', 3.5, 2.3, 0.9, { M: mul(N, tr(-3.6, 29.0, -3.6)), c: '#b89e76' });   // the little bell gable on the north corner
  bx('dark', N, -4.2, -3.0, 26.9, 28.5, -2.62, -2.55, { c: '#1d1712', noao: true });
  bx('dark', N, -3.65, -3.55, 29.8, 31.2, -3.65, -3.55, { c: '#3a342e', noao: true }); bx('dark', N, -4.0, -3.2, 30.6, 30.72, -3.65, -3.55, { c: '#3a342e', noao: true });
  panel('duoClock', 3.0, 3.0, { M: mul(mul(N, rotY(-PI / 2)), tr(0, 17.8, TW / 2 + 0.07)), noao: true });   // on the face looking north
  const S = tower(16.1, 'duoTowerS', 38), SU = 9.6;
  faces(S, 'duoTowerS', TW, 11.5, 22, 38); cornice(S, TW, 21.8);
  faces(S, 'duoTowerS', SU, 22, 30, 38, SU / TW); cornice(S, SU, 29.8);
  faces(S, 'duoTowerS', SU, 30, 37.6, 38, SU / TW); cornice(S, SU, 37.3);
  bx('flat', S, -SU / 2, SU / 2, 37.4, 37.9, -SU / 2, SU / 2, { c: '#9a8668' });
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    bx('tufa', S, a * 4.55 - 0.55, a * 4.55 + 0.55, 37.7, 39.5, b * 4.55 - 0.55, b * 4.55 + 0.55, { c: '#c4a87e' });
    pyramid('flat', 1.3, 1.3, 1.2, { M: mul(S, tr(a * 4.55, 39.5, b * 4.55)), c: '#b89e76', noao: true });
  }
  // ---- the porch between the towers: three arches on two columns and two end piers, each down to its own ground, an iron railing between, the entablature and the balustrade
  const gnd = (x, u = 0.6) => groundY(...duUV(u, -x)) - y0 - 0.3, pale = '#cbc6b8';
  const arches = new THREE.Shape(); arches.moveTo(-10.5, 6.3);
  for (const c of [-5.65, 0, 5.65]) { arches.lineTo(c - 2.45, 6.3); arches.absarc(c, 6.3, 2.45, PI, 0, true); }
  arches.lineTo(10.5, 6.3); arches.lineTo(10.5, 11.4); arches.lineTo(-10.5, 11.4); arches.lineTo(-10.5, 6.3);
  extrude('flat', arches, 0.8, { M: mul(FF, tr(0, 0, -1.0)), c: pale, cs: 6 });
  for (const c of [-5.65, 0, 5.65]) part('flat', new THREE.TorusGeometry(2.58, 0.13, 3, 12, PI), { M: mul(FF, tr(c, 6.3, -0.18)), c: '#b4aea0', noao: true });
  for (const x of [-2.83, 2.83]) {
    const g = gnd(x);
    cyl('flat', 0.34, 0.4, 5.9 - g, 8, { M: mul(FF, tr(x, g, -0.6)), c: pale, noao: true });
    bx('flat', FF, x - 0.52, x + 0.52, g, g + 0.8, -1.1, -0.1, { c: '#b8b2a2' }); bx('flat', FF, x - 0.52, x + 0.52, 5.85, 6.32, -1.1, -0.1, { c: '#d4cfc0' });
  }
  for (const s of [-1, 1]) {
    const g = Math.min(gnd(s * 8.1), gnd(s * 10.5));
    bx('flat', FF, s * 8.1, s * 10.55, g, 6.3, -1.0, -0.2, { c: '#beb8a9' });
    for (const x of [8.4, 9.75]) bx('flat', FF, s * x - 0.28, s * x + 0.28, g, 11.4, -0.22, -0.04, { c: '#d4cfc0' });
  }
  for (const [a, b] of [[-8.1, -3.35], [-2.3, 2.3], [3.35, 8.1]]) rail(mul(FF, tr((a + b) / 2, gnd((a + b) / 2), -0.45)), b - a, 2.4, { c: '#a8a8b0' });
  bx('flat', FF, -10.6, 10.6, 11.4, 12.5, -1.15, -0.05, { c: '#c3bdae' });
  for (let i = 0; i < 14; i++) bx('flat', FF, -10.2 + i * 1.48, -9.1 + i * 1.48, 11.62, 12.12, -0.06, 0.0, { c: '#a9a294' });
  bx('flat', FF, -10.7, 10.7, 12.35, 12.6, -1.2, 0.15, { c: '#d4cfc0' });
  bx('flat', FF, -10.5, 10.5, 12.0, 12.3, -6.6, -1.1, { c: '#8d877a' });
  balus(mul(FF, tr(0, 12.6, -0.15)), 20.6, 1.35, { c: '#e8e4d8' });
  for (const x of [-10.2, -5.1, 0, 5.1, 10.2]) bx('flat', FF, x - 0.3, x + 0.3, 12.6, 14.1, -0.45, 0.05, { c: '#cbc6b8' });
  // the back of the porch with the great pointed door
  const gb = Math.min(gnd(-10.5, 6.5), gnd(0, 6.5), gnd(10.5, 6.5));
  bx('tufa', FF, -10.6, 10.6, gb, 12.1, -7.0, -6.6, { c: '#a58a68' });
  const gd = gnd(0, 6.5);
  extrude('flat', pointed(6.4, 10.4 - gd), 0.1, { M: mul(FF, tr(0, gd, -6.62)), c: '#c9b48e', noao: true });
  extrude('dark', pointed(4.6, 8.8 - gd), 0.16, { M: mul(FF, tr(0, gd, -6.6)), c: '#47321f', noao: true });
  // the wall over the porch with its gable, the cornices along it and the cross
  extrude('duoFront', poly([[-10.55, 12.2], [10.55, 12.2], [10.55, 21.05], [0, 25.8], [-10.55, 21.05]]), 0.5, { M: mul(FF, tr(0, 0, -7.0)), uv: 'keep', uvk: [1 / 21, 1 / 13.8], uvo: [0.5, -12.2 / 13.8], noao: true });
  for (const s of [-1, 1]) box('flat', Math.hypot(10.6, 4.75), 0.32, 0.75, { M: FF, p: [s * 5.3, 23.3, -6.75], rz: -s * Math.atan2(4.75, 10.6), c: '#d6c09a', noao: true });
  bx('flat', FF, -0.3, 0.3, 25.7, 26.3, -7.0, -6.4, { c: '#d6c09a' });
  bx('flat', FF, -0.08, 0.08, 26.3, 27.8, -6.75, -6.62, { c: '#e0dccc', noao: true }); bx('flat', FF, -0.5, 0.5, 27.1, 27.25, -6.75, -6.62, { c: '#e0dccc', noao: true });
  const o = end('Duomo di Monreale');
  o.userData.solids = [[[[7, 21.3], [7, -20.9], [55.6, -20.8], [56.1, -22.8], [86.6, -22.9], [86.8, 9.8], [84, 9.8], [83.4, 20.2], [73.2, 20.2], [57.3, 19.9], [51, 21.4]].flatMap(q => duUV(...q)), null, y0 + E]];   // occluder: the body behind the porch, kept inside the walls
  return o;
}
const cd = centre(pairsOf(DUOMO.p));
// the two side apses stand out of the footprint over ground the car can reach: walls round them
const DUO_WALLS = ['n', 's'].flatMap(k => { const [u, v, r] = DU_APSES[k], q = [-90, -54, -18, 18, 54, 90].map(a => duUV(u + Math.cos(a * PI / 180) * (r + 0.15), v + Math.sin(a * PI / 180) * (r + 0.15))); return q.slice(1).map((p, i) => [...q[i], ...p]); });
export const DUOMO_MONREALE = { name: 'Duomo di Monreale', x: cd[0], z: cd[1], radius: 90, skipIds: [DUOMO.id], build: buildDuomo, walls: DUO_WALLS };

// ---------------------------------------------------------------------------------------------------
// Shared by the two churches below (Belmonte Mezzagno and Capaci), in a frame on the middle of a front:
// a flight of n steps rising along local x from xa (the foot) to xb (the top, height h) between z0 and z1, and a balustrade or railing laid along a flight.
// ---------------------------------------------------------------------------------------------------
function flight(M, xa, xb, z0, z1, h, n, c, key = 'stone') {
  const L = Math.abs(xb - xa), t = L / n, r = h / n, sg = xb > xa ? 1 : -1, s = new THREE.Shape();
  s.moveTo(xa, -0.4);
  for (let i = 0; i < n; i++) { s.lineTo(xa + sg * i * t, (i + 1) * r); s.lineTo(xa + sg * (i + 1) * t, (i + 1) * r); }
  s.lineTo(xb, -0.4); s.lineTo(xa, -0.4);
  extrude(key, s, z1 - z0, { M: mul(M, tr(0, 0, z0)), c });
}
function slantRail(kind, M, xa, xb, z, h, rh, c) {   // along the outer edge of a flight, from (xa, 0) up to (xb, h)
  const len = Math.hypot(xb - xa, h), a = Math.atan2(h, xb - xa), Mr = mul(mul(M, tr((xa + xb) / 2, h / 2, z)), new THREE.Matrix4().makeRotationZ(a > PI / 2 ? a - PI : a));
  (kind === 'balus' ? balus : rail)(Mr, len, rh, { c });
}

// ---------------------------------------------------------------------------------------------------
// Belmonte Mezzagno: the Chiesa Madre del Santissimo Crocifisso (OSM w487530927, building=church, name from the OSM tags). Its front looks east-south-east over the paved square
// that runs down to Piazza Garibaldi. Frame CF: origin at the middle of the front on the ground, +z out of the front, +x towards the north-north-east.
// Seen in a photo (Wikimedia Commons, "Belmonte Mezzagno (PA) - chiesa madre del Santissimo Crocifisso.jpg", Saro68, CC BY-SA 3.0, a frontal view; looked at only): the front of
// white render framed in ochre, two orders. The lower one: four single and two paired pilasters, the portal in the middle under a stucco figure and a medallion, a window and an
// oculus in each outer bay, framed blank panels in the inner bays, a frieze and a deep cornice. The upper one, as wide as the nave: four pilasters, the bells hanging in two pairs of
// arched openings under small pediments, a clock under each pair, a tall window in the middle, a triangular pediment with a finial; concave scrolls down to the cornice and two
// obelisks on the ends of the cornice. No bell tower: the bells are in the front. The church stands on a terrace above the square, a balustrade along it and two flights of steps
// that come down from a landing in the middle to either side. From an aerial view on Commons ("Belmonte Mezzagno (PA) - vista - 01.jpg", Saro68, CC BY-SA 3.0): one long gable
// roof of pale tiles over a nave with plain white walls, no dome. Not seen: the sides (drawn as white render with arched windows), the back (the footprint's shallow apse, flat
// roofs on the aisle and on the front range). Heights are read off the photo against the 23 m width of the footprint: terrace 3.2 m, lower order 9.9 m, upper order 7.5 m,
// pediment 2.6 m (the top 23.2 m over the square). The terrain of the map is smoother than the town, so the terrace rises from the square as the photo has it but the church
// floor is not on a ledge of the hill.
// ---------------------------------------------------------------------------------------------------
const CROCIFISSO = { id: 'w487530927', p: [2187.1, 7446.6, 2184.1, 7451.7, 2194.9, 7457.3, 2205.6, 7437.0, 2181.0, 7424.0, 2178.1, 7428.9, 2177.2, 7428.4, 2174.2, 7430.2, 2172.6, 7433.2, 2171.0, 7436.1, 2171.6, 7438.7, 2174.3, 7440.0] };
const CR_F = [2200.25, 7447.15], CR_N = [0.8846, 0.4663];   // the middle of the 23 m front edge (2205.6, 7437) to (2194.9, 7457.3), and its outward normal
const CR_T = 3.2, CR_W = 23, CR_LO = 9.1, CR_UP = 9.9, CR_UT = 16.5;   // terrace, front width, top of the lower order, foot of the upper order, top of the upper pilasters (from the terrace)
const CR_OCHRE = '#d4a04a', CR_WHITE = '#f1ece1';
function paintCrocifisso(g, w, h) {   // the front, 23 m wide and 18 m tall from the terrace: the lower order across the whole canvas, the upper one in x 6 to 17 above y 9.9
  const sx = w / 23, sy = h / 18, O = CR_OCHRE, Wh = CR_WHITE;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  const frameR = (x0, y0, x1, y1, t = 0.16) => { R(x0, y0, x1, y0 + t, O); R(x0, y1 - t, x1, y1, O); R(x0, y0, x0 + t, y1, O); R(x1 - t, y0, x1, y1, O); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x * sx, h - y * sy, r * sx, 0, 2 * PI); g.fill(); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo((x - r) * sx, h - y0 * sy); g.lineTo((x - r) * sx, h - (y1 - r) * sy); g.arc(x * sx, h - (y1 - r) * sy, r * sx, PI, 0); g.lineTo((x + r) * sx, h - y0 * sy); g.fill(); };
  const tri = (x0, x1, y0, y1, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0 * sx, h - y0 * sy); g.lineTo(x1 * sx, h - y0 * sy); g.lineTo((x0 + x1) / 2 * sx, h - y1 * sy); g.fill(); };
  R(0, 0, 23, 18, Wh); noiseDots(g, w, h, w * h / 50, 1.6, 1501, ['rgba(120,100,70,0.07)', 'rgba(255,255,255,0.08)']);
  R(0, 0, 23, 0.4, '#c9ad80');
  // lower order: a frieze of ochre with white metopes, the bays framed in ochre lines
  const P = [-10.4, -9.3, -4.95, -2.1, 2.1, 4.95, 9.3, 10.4].map(x => x + 11.5);
  R(0, 7.5, 23, 8.4, O);
  for (let i = 0; i < P.length - 1; i++) if (P[i + 1] - P[i] > 1.5) { R(P[i] + 0.55, 7.65, P[i + 1] - 0.55, 8.25, Wh); frameR(P[i] + 0.55, 0.55, P[i + 1] - 0.55, 7.25, 0.1); }
  for (const s of [-1, 1]) {
    const ob = 11.5 + s * 7.125, ib = 11.5 + s * 3.525;
    frameR(ob - 0.75, 0.6, ob + 0.75, 2.95, 0.2); R(ob - 0.55, 0.8, ob + 0.55, 2.75, '#3a3430'); R(ob - 0.03, 0.8, ob + 0.03, 2.75, '#1c1814');   // the window
    frameR(ob - 0.95, 4.0, ob + 0.95, 5.9, 0.2); circ(ob, 4.95, 0.72, O); circ(ob, 4.95, 0.58, '#3e3a36');   // the oculus in its square frame
    frameR(ib - 0.62, 4.15, ib + 0.62, 5.75, 0.17);   // the blank panel
  }
  // the portal, the stucco figure on a cartouche and the medallion over it
  R(10.15, 0, 12.85, 4.05, '#c9b28a'); R(10.4, 0, 12.6, 3.75, '#5a4230'); R(11.47, 0, 11.53, 3.75, '#2e2219');
  for (const y of [0.5, 2.1]) for (const x of [10.6, 11.65]) R(x, y, x + 0.75, y + 1.25, '#4b3626');
  circ(11.5, 4.55, 0.42, '#bfa784'); circ(11.5, 4.55, 0.3, '#a58c68');
  g.fillStyle = '#c4ac86'; g.beginPath(); g.moveTo(10.8 * sx, h - 4.9 * sy); g.lineTo(12.2 * sx, h - 4.9 * sy); g.lineTo(11.95 * sx, h - 6.4 * sy); g.lineTo(11.75 * sx, h - 7.1 * sy); g.lineTo(11.25 * sx, h - 7.1 * sy); g.lineTo(11.05 * sx, h - 6.4 * sy); g.fill();
  circ(11.5, 6.95, 0.3, '#c9b18c');
  // upper order (x 6 to 17, y 9.9 to 17.4): frieze, the bells under their pediments, the clocks, the middle window
  R(6, 15.95, 17, 16.5, O); for (const [a, b] of [[6.7, 9.0], [10.0, 13.0], [14.0, 16.3]]) R(a, 16.07, b, 16.38, Wh);
  for (const s of [-1, 1]) {
    const c = 11.5 + s * 3.4;
    for (const dx of [-0.55, 0.55]) { arch(c + dx, 11.15, 13.05, 0.95, O); arch(c + dx, 11.3, 12.92, 0.72, '#2a2420'); circ(c + dx, 12.15, 0.24, '#8a6a32'); R(c + dx - 0.27, 11.85, c + dx + 0.27, 12.15, '#8a6a32'); }
    tri(c - 1.35, c + 1.35, 13.25, 13.95, O); tri(c - 1.05, c + 1.05, 13.4, 13.78, Wh);
    circ(c, 10.6, 0.68, O); circ(c, 10.6, 0.56, '#f4f1ea');
    g.strokeStyle = '#2a2622'; g.lineWidth = Math.max(1.5, 0.07 * sx); g.beginPath(); g.moveTo(c * sx, h - 10.6 * sy); g.lineTo((c + 0.1) * sx, h - 11.0 * sy); g.moveTo(c * sx, h - 10.6 * sy); g.lineTo((c + 0.35) * sx, h - 10.5 * sy); g.stroke();
  }
  frameR(10.6, 10.1, 12.4, 12.85, 0.22); R(10.82, 10.32, 12.18, 12.63, '#35312d'); R(11.47, 10.32, 11.53, 12.63, '#1c1814'); R(10.82, 11.6, 12.18, 11.66, '#1c1814');
  g.fillStyle = O; g.beginPath(); g.ellipse(11.5 * sx, h - 13.0 * sy, 1.05 * sx, 0.55 * sy, 0, PI, 2 * PI); g.fill();
  g.fillStyle = Wh; g.beginPath(); g.ellipse(11.5 * sx, h - 13.0 * sy, 0.8 * sx, 0.35 * sy, 0, PI, 2 * PI); g.fill();
  streaks(g, w, h, 26, 1502, 0.06, 70);
}
function paintCrSide(g, w, h) {   // a side bay, 4.6 m wide and 9.3 m tall from the terrace: white render, one arched window, the ochre band under the eaves
  const sx = w / 4.6, sy = h / 9.3, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4.6, 9.3, '#eee8dc'); noiseDots(g, w, h, w * h / 45, 1.6, 1511, ['rgba(120,100,70,0.08)', 'rgba(255,255,255,0.08)']);
  R(0, 8.5, 4.6, 9.3, CR_OCHRE); R(0, 0, 0.3, 9.3, '#e6dccb');
  g.fillStyle = CR_OCHRE; g.beginPath(); g.moveTo(1.55 * sx, h - 4.4 * sy); g.lineTo(1.55 * sx, h - 6.9 * sy); g.arc(2.3 * sx, h - 6.9 * sy, 0.75 * sx, PI, 0); g.lineTo(3.05 * sx, h - 4.4 * sy); g.fill();
  g.fillStyle = '#3a3633'; g.beginPath(); g.moveTo(1.72 * sx, h - 4.55 * sy); g.lineTo(1.72 * sx, h - 6.9 * sy); g.arc(2.3 * sx, h - 6.9 * sy, 0.58 * sx, PI, 0); g.lineTo(2.88 * sx, h - 4.55 * sy); g.fill();
  streaks(g, w, h, 10, 1512, 0.07, 50);
}
function buildCrocifisso() {
  initShared();
  const pts = pairsOf(CROCIFISSO.p), gr = groundRange(pts), W = toWorld(CR_F, CR_N);
  const y0 = Math.min(groundY(...W(-CR_W / 2, 0)), groundY(...W(CR_W / 2, 0)), groundY(...W(0, 4.6))), T = CR_T;
  const F = frame(CR_F[0], y0, CR_F[1], CR_N[0], CR_N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('crFront', 736, 576, [23, 18], paintCrocifisso);
  defMat('crSide', 128, 256, [4.6, 9.3], paintCrSide);
  begin(y0);
  // the body: stone up to the floor of the church (the terrace level), white render to the eaves of the aisle and the front range, flat roofs; the nave above it under one gable roof
  prism('stone', pts, Math.min(gr.lo, y0) - 1.5, y0 + T, { c: '#d8c8a8' });
  prism('crSide', pts, y0 + T, y0 + 12.5, { uvo: [0, -(y0 + T) / 9.3] });
  prism('flat', pts, y0 + 12.5, y0 + 12.62, { c: '#a49d92' });
  prism('flat', [W(-11.5, -12), W(11.5, -12), W(11.5, 0), W(-11.5, 0)], y0 + 12.5, y0 + 13.1, { c: '#ece6da' });
  bx('flat', F, -5.8, 5.8, 12.5, 17.4, -27.8, -0.3, { c: '#efeadf' });
  gable('tile', 'flat', at(0, 17.4, -14.05), 11.6, 27.5, 0, 3.2, { ov: 0.35, c: '#d9b071', wc: '#efeadf' });
  // the front: the two orders painted on panels 6 cm proud, with the pilasters, the cornices, the scrolls, the obelisks and the pediment as relief
  panel('crFront', CR_W, CR_LO, { M: at(0, T, 0.06), uvk: [1, CR_LO / 18] });
  panel('crFront', 11, 7.5, { M: at(0, T + CR_UP, 0.06), uvk: [11 / 23, 7.5 / 18], uvo: [6 / 23, CR_UP / 18] });
  for (const x of [-10.4, -9.3, -4.95, -2.1, 2.1, 4.95, 9.3, 10.4]) bx('flat', F, x - 0.37, x + 0.37, T, T + CR_LO, 0.06, 0.32, { c: CR_OCHRE });
  for (const x of [-4.8, -2.0, 2.0, 4.8]) bx('flat', F, x - 0.33, x + 0.33, T + CR_UP, T + CR_UT, 0.06, 0.28, { c: CR_OCHRE });
  bx('flat', F, -11.85, 11.85, T + CR_LO, T + CR_UP, -0.1, 0.78, { c: '#d9a957' });   // the main cornice
  bx('flat', F, -5.85, 5.85, T + CR_UT, T + 17.4, -0.1, 0.58, { c: '#d9a957' });     // the upper entablature
  const ped = (hw, rise, z0, d, c) => { const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rise); sh.lineTo(-hw, 0); extrude('flat', sh, d, { M: at(0, T + 17.4, z0), c }); };
  ped(6.1, 2.65, -0.1, 0.62, '#d9a957'); ped(5.1, 2.0, 0.52, 0.06, CR_WHITE);
  cyl('flat', 0.42, 0.42, 0.06, 10, { M: mul(at(0, T + 18.35, 0.6), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#d9a957', noao: true });   // the oculus in the tympanum
  sphere('flat', 0.32, { M: at(0, T + 20.35, 0.2), seg: 6, c: '#e6c27a', noao: true }); bx('flat', F, -0.25, 0.25, T + 19.95, T + 20.1, -0.05, 0.45, { c: '#e6c27a' });
  for (const sg of [-1, 1]) {   // the scrolls from the upper order down to the cornice, the pedestals and the obelisks on the ends
    const sh = new THREE.Shape(); sh.moveTo(sg * 5.5, 0); sh.lineTo(sg * 8.75, 0); sh.lineTo(sg * 8.75, 0.55); sh.quadraticCurveTo(sg * 5.95, 0.75, sg * 5.5, 6.5); sh.lineTo(sg * 5.5, 0);
    extrude('flat', sh, 0.5, { M: at(0, T + CR_UP, -0.05), c: CR_WHITE, cs: 6 });
    const sh2 = new THREE.Shape(); sh2.moveTo(sg * 8.75, 0.55); sh2.quadraticCurveTo(sg * 5.95, 0.75, sg * 5.5, 6.5); sh2.lineTo(sg * 5.5, 6.9); sh2.quadraticCurveTo(sg * 6.25, 1.0, sg * 8.95, 0.85); sh2.lineTo(sg * 8.75, 0.55);
    extrude('flat', sh2, 0.56, { M: at(0, T + CR_UP, -0.05), c: CR_OCHRE, cs: 6 });
    const ox = sg * 9.85;
    bx('flat', F, ox - 0.85, ox + 0.85, T + CR_UP, T + CR_UP + 1.35, -0.6, 0.55, { c: '#e8d29e' });
    bx('flat', F, ox - 0.95, ox + 0.95, T + CR_UP + 1.35, T + CR_UP + 1.55, -0.7, 0.65, { c: CR_OCHRE });
    pyramid('flat', 1.25, 1.25, 4.9, { M: at(ox, T + CR_UP + 1.55, 0), c: '#ead6a2' });
    sphere('flat', 0.2, { M: at(ox, T + CR_UP + 6.5, 0), seg: 4, c: '#5a5048', noao: true });
  }
  // the terrace in front, the landing in the middle and the two flights coming down from it to either side; balustrades along the edges
  bx('flat', F, -CR_W / 2, CR_W / 2, -0.4, T, 0, 2.6, { c: '#ddcfb2' });
  bx('flat', F, -1.6, 1.6, -0.4, T, 2.6, 4.6, { c: '#ddcfb2' });
  bx('flat', F, -0.62, 0.62, 0, 2.35, 4.6, 4.66, { c: '#3d3129', noao: true });   // the door under the landing
  flight(F, -6.1, -1.6, 2.6, 4.6, T, 10, '#d9cdb4', 'flat'); flight(F, 6.1, 1.6, 2.6, 4.6, T, 10, '#d9cdb4', 'flat');
  for (const sg of [-1, 1]) {
    balus(at(sg * 6.55, T, 2.6), 9.9, 0.95, { c: '#e9dfc6' });
    slantRail('balus', F, sg * 6.1, sg * 1.6, 4.6, T, 0.95, '#e9dfc6');
  }
  balus(at(0, T, 4.6), 3.2, 0.95, { c: '#e9dfc6' });
  const o = end('Chiesa Madre del Santissimo Crocifisso, Belmonte Mezzagno');
  o.userData.solids = [[CROCIFISSO.p, null, y0 + 12.5], [[W(-5.8, -0.3), W(5.8, -0.3), W(5.8, -27.8), W(-5.8, -27.8)].flat(), null, y0 + 17.4]];   // occluders for the lean renderer, as the generic block was (src/world.js): the body and the nave
  return o;
}
const crW = toWorld(CR_F, CR_N);
export const CROCIFISSO_BM = {
  name: 'Chiesa Madre del Santissimo Crocifisso (Belmonte Mezzagno)', x: CR_F[0], z: CR_F[1], radius: 45, skipIds: [CROCIFISSO.id], build: buildCrocifisso,
  walls: [[-11.5, 0, -11.5, 2.6], [-11.5, 2.6, -6.1, 2.6], [-6.1, 2.6, -6.1, 4.6], [-6.1, 4.6, 6.1, 4.6], [6.1, 4.6, 6.1, 2.6], [6.1, 2.6, 11.5, 2.6], [11.5, 2.6, 11.5, 0]].map(([a, b, c, d]) => [...crW(a, b), ...crW(c, d)]),
};

// ---------------------------------------------------------------------------------------------------
// Capaci: the Chiesa Madre (OSM w370279778, named only "Chiesa Madre"; it.wikipedia: built from 1734 for the Pilo counts of Capaci, a baroque front with a pincer staircase).
// Its front is the short west-north-west end of the footprint, on the square where Via Generale Cascino comes down. Frame KF: origin at the middle of that edge on the ground,
// +z out of the front, +x towards the south-south-west (to the right seen from the square); the bell tower stands at the north end (-x).
// Seen in photos (Mapillary, 5 October 2019, from the street to the north-west: 472051383873858, 269820611559767, 182537833748420, 1163620144099733, 1037298440009986; looked at only):
// the front of warm buff stone, richly framed, crowned by a wavy crest that climbs from two shoulders to a cross, stone finials on the shoulders and on the crest,
// pilasters, an arched portal in the middle and a smaller arched door either side with an oculus over it, a window with a carved frame over the portal; the square tower flush
// with the front at its north end, plain ashlar with quoins in three stages divided by cornices, one round-arched bell opening a face at the top, a flat top behind a parapet;
// a stone terrace with steps and an iron railing in front; a tall grey rendered wall with a curved top behind and north of the tower (taken for the next building, not drawn here).
// Not seen: the far (south) end of the front behind the trees, the sides and the back (drawn as grey render under a gable roof of tiles kept below the crest, since no roof shows
// over the front in the photos), the stairs' exact plan (two flights from the ends to a middle landing, from the "a tenaglia" of the text).
// The same frames show the carved work standing out of the front (a moulded coping along the crest, frames round the openings, a pediment over the portal); it is drawn plainer.
// Heights are estimates from the photos against the 20.6 m front of the footprint: shoulders 12.4 m, crest 16.6 m, the tower 24.8 m. Whether there is a dome behind could not be
// told from the photos; none is drawn.
// ---------------------------------------------------------------------------------------------------
const CAPACI = { id: 'w370279778', p: [-10734.9, -6014.2, -10733.5, -6014.1, -10717.8, -6008.3, -10713.6, -6006.8, -10700.3, -6001.9, -10707.7, -5982.2, -10726.7, -5989.3, -10742.1, -5994.9, -10740.1, -6000.2] };
const CA_F = [-10738.5, -6004.55], CA_N = [-0.9369, -0.3495];   // the middle of the front edge (-10734.9, -6014.2) to (-10742.1, -5994.9), 20.6 m, and its outward normal
const CA_TW = 6.2, CA_X0 = -10.3, CA_X1 = 10.3, CA_FW = 14.4, CA_FC = 3.1, CA_TH = 24.8;   // tower width, front from x0 to x1, the facade beside the tower (width, middle)
const CA_STONE = '#cbae80';
function paintCapaciFront(g, w, h) {   // 14.4 m wide, 17 m tall from the ground
  const sx = w / 14.4, sy = h / 17, X = x => (x + 7.2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  paintAshlar(g, w, h, 14.4, 17, 0.5, 1.1, CA_STONE, '#a98e66', 1601, 1.0, 0.09);
  noiseDots(g, w, h, w * h / 60, 3, 1603, ['rgba(150,90,50,0.16)', 'rgba(245,220,170,0.14)']);
  const gr = g.createRadialGradient(X(0), Y(9), 0, X(0), Y(9), 6 * sx); gr.addColorStop(0, 'rgba(188,124,86,0.40)'); gr.addColorStop(1, 'rgba(188,124,86,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (const x of [-6.7, -2.6, 2.6, 6.7]) { R(x - 0.42, 1.2, x + 0.42, 11.8, '#dcc092'); R(x + 0.42, 1.2, x + 0.5, 11.8, 'rgba(60,45,30,0.35)'); R(x - 0.55, 10.6, x + 0.55, 11.2, '#e2c89c'); }
  // the portal in the middle, a door each side with an oculus over it, the carved window over the portal
  arch(0, 1.2, 6.9, 3.3, '#dab98a'); arch(0, 1.2, 6.5, 2.5, '#5d4330'); R(-0.03, 1.2, 0.03, 5.3, '#2e2218');
  for (const s of [-1, 1]) {
    arch(s * 4.65, 1.2, 5.2, 2.1, '#dab98a'); arch(s * 4.65, 1.2, 4.9, 1.5, '#5d4330');
    circ(s * 4.65, 7.1, 0.85, '#dab98a'); circ(s * 4.65, 7.1, 0.62, '#3b3530');
  }
  arch(0, 7.6, 10.4, 2.4, '#d2a67c'); arch(0, 7.9, 10.0, 1.5, '#37312c');
  g.fillStyle = '#d2a67c'; g.beginPath(); g.moveTo(X(-1.6), Y(7.6)); g.quadraticCurveTo(X(0), Y(7.0), X(1.6), Y(7.6)); g.fill();
  // the crest: a carved cartouche and a niche in the middle, a moulding along the edge (the outline is the shape of the geometry)
  R(-7.2, 11.75, 7.2, 12.4, '#dcc090');
  // carved scrolls over the side doors and under the crest
  g.strokeStyle = '#e2c496'; g.lineWidth = 0.16 * sx; for (const s of [-1, 1]) { for (const [x, y, r] of [[4.65, 5.85, 0.45], [4.65, 9.0, 0.55], [2.3, 13.2, 0.6], [1.55, 11.0, 0.4]]) { g.beginPath(); g.arc(X(s * (x - r * 0.8)), Y(y), r * sx, 0, 1.5 * PI); g.stroke(); g.beginPath(); g.arc(X(s * (x + r * 0.8)), Y(y), r * sx, PI, 2.5 * PI); g.stroke(); } }
  g.fillStyle = '#d8b484'; g.beginPath(); g.ellipse(X(0), Y(13.9), 1.2 * sx, 1.0 * sy, 0, 0, 2 * PI); g.fill(); circ(0, 13.9, 0.55, '#9c7652');
  g.strokeStyle = '#e6caa0'; g.lineWidth = 0.35 * sx; g.beginPath(); g.moveTo(X(4.6), Y(12.2)); g.bezierCurveTo(X(3.6), Y(12.2), X(3.4), Y(14.4), X(2.0), Y(14.8)); g.quadraticCurveTo(X(0.6), Y(15.1), X(0), Y(16.4));
  g.quadraticCurveTo(X(-0.6), Y(15.1), X(-2.0), Y(14.8)); g.bezierCurveTo(X(-3.4), Y(14.4), X(-3.6), Y(12.2), X(-4.6), Y(12.2)); g.stroke();
  streaks(g, w, h, 30, 1602, 0.09, 80, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintCapaciTower(g, w, h) {   // one face, 6.2 m wide and 24.8 m tall: ashlar, quoins, a slit in the lower stages, the bell opening at the top
  const sx = w / 6.2, sy = h / 24.8, X = x => x * sx, Y = y => h - y * sy;
  paintAshlar(g, w, h, 6.2, 24.8, 0.5, 1.1, '#cdb282', '#a58a60', 1611, 0.8, 0.08);
  for (let y = 0; y < 24.8; y += 1.0) for (const [x0, x1] of [[0, y % 2 ? 0.9 : 0.55], [y % 2 ? 5.3 : 5.65, 6.2]]) { g.fillStyle = '#d6c6a2'; g.fillRect(X(x0), Y(y + 0.95), (x1 - x0) * sx, 0.9 * sy); }
  for (const y of [7.5, 15.2]) { g.fillStyle = '#2b2622'; g.fillRect(X(2.85), Y(y + 1.3), 0.5 * sx, 1.3 * sy); }
  const r = 0.75; g.fillStyle = '#e0d0aa'; g.beginPath(); g.moveTo(X(3.1 - r - 0.2), Y(19.0)); g.lineTo(X(3.1 - r - 0.2), Y(22.2)); g.arc(X(3.1), Y(22.2), (r + 0.2) * sx, PI, 0); g.lineTo(X(3.1 + r + 0.2), Y(19.0)); g.fill();
  g.fillStyle = '#1f1b17'; g.beginPath(); g.moveTo(X(3.1 - r), Y(19.2)); g.lineTo(X(3.1 - r), Y(22.2)); g.arc(X(3.1), Y(22.2), r * sx, PI, 0); g.lineTo(X(3.1 + r), Y(19.2)); g.fill();
  g.fillStyle = '#7d6236'; g.beginPath(); g.arc(X(3.1), Y(21.0), 0.42 * sx, PI, 0); g.lineTo(X(3.55), Y(20.25)); g.lineTo(X(2.65), Y(20.25)); g.fill();
  streaks(g, w, h, 18, 1612, 0.1, 90, '55,48,40');
}
function paintCapaciSide(g, w, h) {   // a side bay, 4.5 m wide and 11 m tall: grey render over a stone plinth, an arched window high up, a band under the eaves
  const sx = w / 4.5, sy = h / 11, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4.5, 11, '#c9c1b0'); noiseDots(g, w, h, w * h / 40, 2, 1621, ['rgba(90,80,60,0.10)', 'rgba(255,255,255,0.07)']);
  R(0, 0, 4.5, 1.2, '#b3aa96'); R(0, 10.3, 4.5, 11, '#d8d0be');
  g.fillStyle = '#3a3531'; g.beginPath(); g.moveTo(1.7 * sx, h - 6.6 * sy); g.lineTo(1.7 * sx, h - 8.7 * sy); g.arc(2.25 * sx, h - 8.7 * sy, 0.55 * sx, PI, 0); g.lineTo(2.8 * sx, h - 6.6 * sy); g.fill();
  streaks(g, w, h, 12, 1622, 0.1, 60);
}
function buildCapaci() {
  initShared();
  const pts = pairsOf(CAPACI.p), gr = groundRange(pts), W = toWorld(CA_F, CA_N);
  const y0 = Math.min(groundY(...W(CA_X0, 0)), groundY(...W(CA_X1, 0)), groundY(...W(CA_FC, 4.4)));
  const F = frame(CA_F[0], y0, CA_F[1], CA_N[0], CA_N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('caFront', 464, 544, [14.4, 17], paintCapaciFront);
  defMat('caTower', 128, 512, [6.2, 24.8], paintCapaciTower);
  defMat('caSide', 128, 256, [4.5, 11], paintCapaciSide);
  begin(y0);
  // the body in grey render to 11 m, a flat roof over the side chapels, the nave above it under a gable roof
  prism('caSide', pts, Math.min(gr.lo, y0) - 1.5, y0 + 11, { uvo: [0, -y0 / 11] });
  prism('flat', pts, y0 + 11, y0 + 11.12, { c: '#9b958b' });
  const NC = CA_FC, NW = 11.4;
  bx('flat', F, NC - NW / 2, NC + NW / 2, 11, 12.3, -36.2, -1.2, { c: '#c4bcab' });
  gable('tile', 'flat', at(NC, 12.3, -18.7), NW, 35.0, 0, 3.2, { ov: 0.35, c: '#b37a5a', wc: '#c4bcab' });   // the ridge (15.5 m) stays under the crest
  // the front: one shape with the wavy crest, the ashlar painted on it; pilasters, the cornice, finials and the cross in relief
  const s = new THREE.Shape(), hw = CA_FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 12.4); s.lineTo(4.6, 12.4); s.bezierCurveTo(3.6, 12.4, 3.4, 14.6, 2.0, 15.0); s.quadraticCurveTo(0.6, 15.3, 0, 16.6);
  s.quadraticCurveTo(-0.6, 15.3, -2.0, 15.0); s.bezierCurveTo(-3.4, 14.6, -3.6, 12.4, -4.6, 12.4); s.lineTo(-hw, 12.4); s.lineTo(-hw, 0);
  extrude('caFront', s, 0.75, { M: at(CA_FC, 0, -0.35), uv: 'keep', uvk: [1 / CA_FW, 1 / 17], uvo: [0.5, 0], cs: 5, noao: true });
  for (const x of [-6.7, -2.6, 2.6, 6.7]) bx('flat', F, CA_FC + x - 0.42, CA_FC + x + 0.42, 1.2, 11.75, 0.4, 0.62, { c: '#d6ba8c' });
  bx('flat', F, CA_FC - hw - 0.15, CA_FC + hw + 0.25, 11.75, 12.45, -0.2, 0.85, { c: '#dcc296' });   // the cornice under the crest
  // the carved work standing out: the coping that follows the crest, the capitals, rings round the arches and the oculi, the pediments over the portal and the window
  const lip = new THREE.Shape(); lip.moveTo(-4.9, 12.45); lip.lineTo(-4.6, 12.45); lip.bezierCurveTo(-3.6, 12.45, -3.4, 14.65, -2.0, 15.05); lip.quadraticCurveTo(-0.6, 15.35, 0, 16.65); lip.quadraticCurveTo(0.6, 15.35, 2.0, 15.05); lip.bezierCurveTo(3.4, 14.65, 3.6, 12.45, 4.6, 12.45); lip.lineTo(4.9, 12.45);
  lip.lineTo(4.9, 12.75); lip.bezierCurveTo(3.8, 12.8, 3.7, 14.95, 2.15, 15.45); lip.quadraticCurveTo(0.8, 15.75, 0, 17.05); lip.quadraticCurveTo(-0.8, 15.75, -2.15, 15.45); lip.bezierCurveTo(-3.7, 14.95, -3.8, 12.8, -4.9, 12.75); lip.lineTo(-4.9, 12.45);
  extrude('flat', lip, 1.05, { M: at(CA_FC, 0, -0.4), c: '#e0c698', cs: 5, noao: true });
  for (const x of [-6.7, -2.6, 2.6, 6.7]) bx('flat', F, CA_FC + x - 0.6, CA_FC + x + 0.6, 10.6, 11.15, 0.4, 0.74, { c: '#e2c89c' });
  const hoop = (x, y, r, t, arc) => part('flat', new THREE.TorusGeometry(r, t, 3, arc > PI ? 14 : 10, arc), { M: at(CA_FC + x, y, 0.45), c: '#e0c294', noao: true });
  hoop(0, 5.25, 1.5, 0.18, PI); for (const s of [-1, 1]) { hoop(s * 4.65, 4.15, 0.92, 0.12, PI); hoop(s * 4.65, 7.1, 0.76, 0.13, 2 * PI); bx('flat', F, CA_FC + s * 1.33, CA_FC + s * 1.75, 1.2, 5.3, 0.4, 0.66, { c: '#d9bc8e' }); }
  hoop(0, 9.2, 0.98, 0.13, PI);
  const hood = (x, y, hw2, rise2) => { const sh = new THREE.Shape(); sh.moveTo(-hw2, 0); sh.quadraticCurveTo(-hw2 * 0.4, rise2 * 0.2, 0, rise2); sh.quadraticCurveTo(hw2 * 0.4, rise2 * 0.2, hw2, 0); sh.lineTo(hw2, 0.22); sh.quadraticCurveTo(hw2 * 0.4, rise2 * 0.45, 0, rise2 + 0.3); sh.quadraticCurveTo(-hw2 * 0.4, rise2 * 0.45, -hw2, 0.22); sh.lineTo(-hw2, 0); extrude('flat', sh, 0.35, { M: at(CA_FC + x, y, 0.35), c: '#e2c698', cs: 4, noao: true }); };
  hood(0, 6.85, 2.05, 0.45); hood(0, 10.55, 1.45, 0.45); for (const s of [-1, 1]) hood(s * 4.65, 5.35, 1.15, 0.28);
  const finial = (x, y, k) => { bx('flat', F, x - 0.42 * k, x + 0.42 * k, y, y + 0.8 * k, -0.05, 0.75, { c: '#d6ba8c' }); sphere('flat', 0.4 * k, { M: at(x, y + 0.8 * k + 0.32 * k, 0.35), ky: 1.4, seg: 5, c: '#cdb286' }); };
  finial(CA_FC - 6.5, 12.45, 1); finial(CA_FC + 6.5, 12.45, 1); finial(CA_FC - 2.25, 14.85, 0.85); finial(CA_FC + 2.25, 14.85, 0.85);
  bx('flat', F, CA_FC - 0.08, CA_FC + 0.08, 16.4, 18.2, 0.0, 0.16, { c: '#3e3a36', noao: true }); bx('flat', F, CA_FC - 0.55, CA_FC + 0.55, 17.3, 17.45, 0.0, 0.16, { c: '#3e3a36', noao: true });
  // the bell tower: four painted faces round a core, cornices between the stages, a parapet on the top
  const TX = CA_X0 + CA_TW / 2, TZ = -CA_TW / 2 + 0.35, T = at(TX, 0, TZ);
  for (const a of [0, PI / 2, PI, -PI / 2]) panel('caTower', CA_TW, CA_TH, { M: mul(mul(T, new THREE.Matrix4().makeRotationY(a)), tr(0, 0, CA_TW / 2 + 0.02)) });
  box('flat', CA_TW - 0.1, CA_TH, CA_TW - 0.1, { M: T, c: '#c2b08c', noao: true });
  for (const [y0c, y1c, o] of [[12.0, 12.6, 0.3], [18.2, 18.7, 0.25], [23.6, 24.2, 0.35]]) bx('flat', T, -CA_TW / 2 - o, CA_TW / 2 + o, y0c, y1c, -CA_TW / 2 - o, CA_TW / 2 + o, { c: '#d8c7a0' });
  bx('flat', T, -CA_TW / 2 + 0.1, CA_TW / 2 - 0.1, 24.2, 24.85, -CA_TW / 2 + 0.1, CA_TW / 2 - 0.1, { c: '#ccba94' });
  // the terrace across the front beside the tower, a landing in the middle, the two flights from the ends, iron railings
  const TH = 1.2, x0 = CA_X0 + CA_TW, x1 = CA_X1;
  bx('stone', F, x0, x1, -0.4, TH, 0.4, 2.8, { c: '#cfc7b4' });
  bx('stone', F, x0 + 2.4, x1 - 2.4, -0.4, TH, 2.8, 4.4, { c: '#cfc7b4' });
  flight(F, x0, x0 + 2.4, 2.8, 4.4, TH, 6, '#cbc3b0'); flight(F, x1, x1 - 2.4, 2.8, 4.4, TH, 6, '#cbc3b0');
  rail(at((x0 + x1) / 2, TH, 4.4), x1 - x0 - 4.8, 1.0, { c: '#ffffff' });
  slantRail('rail', F, x0, x0 + 2.4, 4.4, TH, 1.0, '#ffffff'); slantRail('rail', F, x1, x1 - 2.4, 4.4, TH, 1.0, '#ffffff');
  const o = end('Chiesa Madre, Capaci');
  o.userData.solids = [[CAPACI.p, null, y0 + 11], [[W(NC - NW / 2, -1.2), W(NC + NW / 2, -1.2), W(NC + NW / 2, -36.2), W(NC - NW / 2, -36.2)].flat(), null, y0 + 12.3], [[W(CA_X0, 0.3), W(CA_X0 + CA_TW, 0.3), W(CA_X0 + CA_TW, -CA_TW + 0.4), W(CA_X0, -CA_TW + 0.4)].flat(), null, y0 + CA_TH]];   // occluders: the body, the nave and the tower (src/world.js)
  return o;
}
const caW = toWorld(CA_F, CA_N);
export const CHIESA_MADRE_CAPACI = {
  name: 'Chiesa Madre (Capaci)', x: CA_F[0], z: CA_F[1], radius: 45, skipIds: [CAPACI.id], build: buildCapaci,
  walls: [[CA_X0 + CA_TW, 0, CA_X0 + CA_TW, 2.8], [CA_X0 + CA_TW, 2.8, CA_X0 + CA_TW, 4.4], [CA_X0 + CA_TW, 4.4, CA_X1, 4.4], [CA_X1, 4.4, CA_X1, 0]].map(([a, b, c, d]) => [...caW(a, b), ...caW(c, d)]),
};

export const TOWN_LANDMARKS = [SANT_AGATA, SAN_GIUSEPPE, PALCHETTO_VB, DUOMO_MONREALE, CROCIFISSO_BM, CHIESA_MADRE_CAPACI];
