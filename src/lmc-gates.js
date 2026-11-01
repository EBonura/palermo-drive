// City landmarks: the drivable city gates. Registered in src/landmarks-city.js.
//  - Porta Nuova: the model is in src/landmarks.js (centro), this file only gives it its collision (the two piers, the passage stays open)
//  - Porta dei Greci: the gate block of the Palazzo Forcella De Seta, a round arch through a three-storey block with pointed windows
//  - Porta Sant'Agata: the rough Norman wall with a pointed arch beside the Piazza Porta Sant'Agata
// Porta Felice (src/lmc-d.js) stays two open pylons, Porta Carini and Porta di Vicari are pylon pairs without a lintel: no arch to drive through.
// Collision is 2D against wall segments (src/vehicle.js): a landmark can hand world.js `walls` ([x0,z0,x1,z1]) and `dropWalls` (building ids whose
// footprint walls are not registered), so the passages are open for the car and the piers still block it.
// Checked against Wikimedia Commons photos (Category:Porta dei Greci, Category:Porta Sant'Agata (Palermo), Category:Porta Nuova (Palermo)) and the OSM
// tunnel=building_passage way "Porta dei Greci" (the road under the block).
import * as THREE from 'three';
import {
  PI, bx, box, lathe, begin, end, defMat, part, prism, archBay, mul, tr, rotY, frame, obb, groundRange, groundY, initShared, paintFacade, paintAshlar, noiseDots, streaks, ringSegs, RNG,
} from './lmc-kit.js';

// ---------------------------------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------------------------------
// local frame at c facing n (the passage axis): local +z along n, local +x = lateral (n.z, -n.x), as frame() in lmc-kit
const W2 = (c, n, lx, lz) => [c[0] + lx * n[1] + lz * n[0], c[1] - lx * n[0] + lz * n[1]];
const rectRing = (c, n, x0, x1, z0, z1) => [W2(c, n, x0, z0), W2(c, n, x1, z0), W2(c, n, x1, z1), W2(c, n, x0, z1)];
// Sutherland-Hodgman against the line lat = t (lat = dot(p - c, lam)); keep the side `above` (lat >= t) or below
function clipRing(ring, c, lam, t, above) {
  const s = above ? 1 : -1, f = p => s * ((p[0] - c[0]) * lam[0] + (p[1] - c[1]) * lam[1] - t), out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out;
}
const flatTo = (pts) => pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
const segsOf = (...rings) => rings.flatMap(r => ringSegs(flatTo(r)));
// the walls of a passage: the outlines of its two piers
const pierWalls = (c, n, hw, W, D) => segsOf(rectRing(c, n, -W / 2, -hw, -D / 2, D / 2), rectRing(c, n, hw, W / 2, -D / 2, D / 2));

// ---------------------------------------------------------------------------------------------------
// Porta Nuova: collision only. The model (landmarks.js) stands on the OSM footprint w815701117 (18 x 18 m, axis along the Corso, ENE); its
// 5.8 m wide passage is cut right through. The footprint's own walls would close the street, so they are dropped and the two piers replace them.
// ---------------------------------------------------------------------------------------------------
export const NUOVA = { c: [-750.8, 395.6], n: [0.907, -0.42], W: 18.0, D: 18.0, PW: 5.8, PH: 8.6 };
export const PORTA_NUOVA = {
  name: 'Porta Nuova (passage)', x: NUOVA.c[0], z: NUOVA.c[1], radius: 30, skipIds: [], dropWalls: ['w815701117'],
  walls: pierWalls(NUOVA.c, NUOVA.n, NUOVA.PW / 2, NUOVA.W, NUOVA.D),
  build: () => null,
};

// ---------------------------------------------------------------------------------------------------
// Porta dei Greci: the passage under the palace block between Piazza della Kalsa and the Foro Italico (OSM tunnel way from (1109.5,-43.1) to
// (1120.2,-52.6), 14.3 m). Round arch about 5.6 m wide and 6.4 m high in a plastered block 19 m wide and 17 m tall (two red and one green pointed window
// over the arch, a group of pointed lights on the top storey), flanked by lower wings that carry on along the OSM strip.
// ---------------------------------------------------------------------------------------------------
const GREC_RING = [[1090.7, -63.0], [1101.9, -51.3], [1106.7, -46.1], [1109.5, -43.1], [1111.9, -40.4], [1116.8, -35.0], [1132.8, -18.7], [1134.5, -17.0], [1145.3, -4.6], [1141.7, -1.5],
  [1144.6, 1.7], [1131.4, 13.7], [1130.7, 16.3], [1130.7, 18.4], [1132.0, 21.0], [1133.5, 22.5], [1135.9, 23.1], [1138.2, 23.0], [1143.3, 21.2], [1155.9, 16.4], [1181.6, 6.6], [1145.5, -27.7],
  [1127.8, -45.7], [1122.4, -50.6], [1120.2, -52.6], [1116.9, -55.9], [1112.0, -60.8], [1110.0, -62.9], [1100.8, -72.5]];
const G = (() => {
  const a = [1109.5, -43.1], b = [1120.2, -52.6], c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  return { c, n, lam: [n[1], -n[0]], D: l, hw: 2.8, BW: 19, AH: 6.4, Hc: 17.0, Hw: 12.2 };
})();
function grecWalls() {
  const L = clipRing(GREC_RING, G.c, G.lam, -G.hw, false), R = clipRing(GREC_RING, G.c, G.lam, G.hw, true);
  return segsOf(L, R);
}
function paintGrecFront(g, w, h) {
  const BW = 19, BH = 17, X = (m) => (m + BW / 2) / BW * w, Y = (y) => h - y / BH * h, sx = w / BW, sy = h / BH;
  g.fillStyle = '#d6bc86'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, 1500, 3, 411, ['rgba(110,85,50,0.10)', 'rgba(255,245,215,0.10)', 'rgba(90,70,45,0.07)']);
  g.fillStyle = '#b9a173'; g.fillRect(0, Y(1.1), w, 1.1 * sy);                                         // plinth
  g.fillStyle = '#e3cf9b'; g.fillRect(X(-9.5), 0, 0.7 * sx, h); g.fillRect(X(8.8), 0, 0.7 * sx, h);   // corner pilasters
  for (const [y, hh] of [[9.0, 0.3], [11.4, 0.4], [15.9, 0.9]]) { g.fillStyle = '#ead8a9'; g.fillRect(0, Y(y + hh), w, hh * sy); g.fillStyle = 'rgba(40,28,14,0.3)'; g.fillRect(0, Y(y), w, 2); }
  // moulding round the round arch
  g.strokeStyle = '#ead8a9'; g.lineWidth = 0.55 * sx; g.beginPath(); g.moveTo(X(-3.15), Y(0)); g.lineTo(X(-3.15), Y(3.6)); g.arc(X(0), Y(3.6), 3.15 * sx, PI, 0); g.lineTo(X(3.15), Y(0)); g.stroke();
  const point = (cx, y0, y1, ww, col) => {
    const l = cx - ww / 2, r = cx + ww / 2, tp = y1;
    g.fillStyle = '#ead8a9'; g.beginPath(); g.moveTo(X(l - 0.18), Y(y0)); g.lineTo(X(l - 0.18), Y(tp - ww * 0.55)); g.quadraticCurveTo(X(l - 0.18), Y(tp - ww * 0.1), X(cx), Y(tp + ww * 0.55)); g.quadraticCurveTo(X(r + 0.18), Y(tp - ww * 0.1), X(r + 0.18), Y(tp - ww * 0.55)); g.lineTo(X(r + 0.18), Y(y0)); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(X(l), Y(y0)); g.lineTo(X(l), Y(tp - ww * 0.5)); g.quadraticCurveTo(X(l), Y(tp - ww * 0.1), X(cx), Y(tp + ww * 0.45)); g.quadraticCurveTo(X(r), Y(tp - ww * 0.1), X(r), Y(tp - ww * 0.5)); g.lineTo(X(r), Y(y0)); g.fill();
  };
  point(-5.9, 7.4, 9.0, 1.3, '#b8283a'); point(5.9, 7.4, 9.0, 1.3, '#b8283a'); point(0, 7.4, 9.0, 1.3, '#3d7a56');   // the three coloured panes over the arch
  for (const [cx, n] of [[-5.3, 3], [0, 5], [5.3, 3]]) for (let i = 0; i < n; i++) point(cx + (i - (n - 1) / 2) * 1.15, 12.2, 14.2, 0.8, '#2f3640');   // top-storey lights
  streaks(g, w, h, 30, 412, 0.14, 140, '60,45,25');
  const gb = g.createLinearGradient(0, h, 0, h - 3 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.3)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 3 * sy, w, 3 * sy);
}
function buildGreci() {
  initShared();
  const { c, n, lam, D, hw, BW, AH, Hc, Hw } = G;
  const gr = groundRange(GREC_RING), gy = groundY(c[0], c[1]), M = frame(c[0], gy, c[1], n[0], n[1]);
  begin(gy);
  defMat('grFront', 512, 512, [BW, Hc], paintGrecFront);
  defMat('grWing', 256, 256, [4.4, Hw], (g, w, h) => paintFacade(g, w, h, 4.4, Hw, { base: '#d9c18e', trim: '#ecdcb0', glass: '#2d2a28', seed: 421, plinth: { h: 1.0, c: '#bda677' }, grime: 1,
    bands: [{ y: 4.4, h: 0.25, c: '#ead8a9' }, { y: 8.0, h: 0.25, c: '#ead8a9' }, { y: 11.3, h: 0.7, c: '#ead8a9' }],
    rows: [{ y0: 1.5, y1: 3.7, xs: [2.2], w: 1.0, kind: 'rect', fr: 0.12 }, { y0: 5.2, y1: 7.5, xs: [2.2], w: 1.0, kind: 'rect', shut: 'open', fr: 0.12 }, { y0: 8.8, y1: 10.9, xs: [2.2], w: 0.9, kind: 'rect', shut: 'open', fr: 0.1 }], shut: '#556a56' }));
  defMat('grVault', 128, 128, [3.3, 3.3], (g, w, h) => paintAshlar(g, w, h, 3.3, 3.3, 0.5, 1.1, '#9a8c70', '#5c5240', 413, 2, 0.1), { side: THREE.DoubleSide });
  // wings: the OSM strip beyond the block, a stone foot down to the lowest ground under it
  for (const above of [false, true]) {
    const wing = clipRing(GREC_RING, c, lam, above ? BW / 2 : -BW / 2, above);
    if (wing.length < 3) continue;
    prism('grWing', wing, gy, gy + Hw, { uvo: [0, -gy / Hw] });
    prism('stone', wing, Math.min(gr.lo, gy) - 1.5, gy, { c: '#b9a98a' });
    prism('flat', wing, gy + Hw, gy + Hw + 0.25, { c: '#8f8a82' });
    for (let i = 0; i < wing.length; i++) {
      const A = wing[i], B = wing[(i + 1) % wing.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
      bx('flat', frame((A[0] + B[0]) / 2, gy + Hw - 0.5, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, 0.8, -0.45, 0.45, { c: '#e6d6a8' });
    }
  }
  // the gate block: BW wide, as deep as the strip, the arch cut through (front and back caps carry the painted facade, centred on the arch)
  const Dd = D;
  archBay('grFront', BW, Hc, 2 * hw, AH, Dd, { M: mul(M, tr(0, 0, -Dd / 2)), uv: 'keep', uvk: [1 / BW, 1 / Hc], uvo: [0.5, 0], noao: true });
  prism('stone', rectRing(c, n, -BW / 2, BW / 2, -Dd / 2, Dd / 2), Math.min(gr.lo, gy) - 1.5, gy - 0.02, { c: '#b9a98a' });
  bx('flat', M, -BW / 2 - 0.4, BW / 2 + 0.4, Hc - 0.9, Hc + 0.2, -Dd / 2 - 0.5, Dd / 2 + 0.5, { c: '#ead8a9' });
  bx('flat', M, -BW / 2, BW / 2, Hc + 0.2, Hc + 0.5, -Dd / 2, Dd / 2, { c: '#8f8a82' });
  // vault: half-tube over the straight lining
  const vg = new THREE.CylinderGeometry(hw - 0.02, hw - 0.02, Dd + 0.2, 14, 1, true, 0, PI); vg.rotateZ(PI / 2); vg.rotateY(PI / 2); // axis along z, upper half
  vg.translate(0, AH - hw, 0);
  part('grVault', vg, { M, noao: true, uvk: [1, 1] });
  for (const sg of [-1, 1]) bx('grVault', M, sg * (hw - 0.04) - 0.04, sg * (hw - 0.04) + 0.04, 0, AH - hw, -Dd / 2 - 0.1, Dd / 2 + 0.1, { noao: true });
  return end('Porta dei Greci');
}
export const PORTA_GRECI = {
  name: 'Porta dei Greci', x: G.c[0], z: G.c[1], radius: 60, skipIds: ['w49683271'], dropWalls: ['w49683271'], walls: grecWalls(), build: buildGreci,
};

// ---------------------------------------------------------------------------------------------------
// Porta Sant'Agata: a 14 m stretch of the rough Norman wall of blocks and tuff, 8.4 m tall, 2.4 m thick, with the pointed arch (3.6 m wide, 5.2 m to
// the crown, a plain ring of voussoirs round it). It stands at the south edge of Via Cesare Battisti where the OSM footway "Piazza Porta Sant'Agata" meets the
// street; OSM has no object for the wall, so the position comes from the Commons photo geotags and Wikidata (38.1095 N 13.3617 E), good to a few metres.
// ---------------------------------------------------------------------------------------------------
export const SANTAGATA = { c: [39.8, 674.4], n: [0.24, 0.9708], W: 14, T: 2.4, hw: 1.8, H: 8.4, AH: 5.2 };
function buildSantAgata() {
  initShared();
  const { c, n, W, T, hw, H, AH } = SANTAGATA, gy = groundY(c[0], c[1]), M = frame(c[0], gy, c[1], n[0], n[1]), rn = RNG(431);
  begin(gy);
  defMat('saWall', 256, 256, [3.2, 3.2], (g, w, h) => {
    paintAshlar(g, w, h, 3.2, 3.2, 0.34, 0.8, '#bda57e', '#7a6648', 432, 3, 0.12);
    noiseDots(g, w, h, 900, 4, 433, ['rgba(70,55,35,0.16)', 'rgba(235,220,180,0.14)', 'rgba(60,70,45,0.1)']);
    streaks(g, w, h, 16, 434, 0.18, 120, '50,40,25');
  });
  defMat('saVault', 128, 128, [2.4, 2.4], (g, w, h) => paintAshlar(g, w, h, 2.4, 2.4, 0.4, 0.9, '#a39278', '#5e5240', 435, 2, 0.1), { side: THREE.DoubleSide });
  // wall with the pointed opening (the wall slab itself, uv from its caps)
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
  const r = hw, h0 = AH - r, p = new THREE.Path(); p.moveTo(-r, 0); p.lineTo(-r, h0); p.quadraticCurveTo(-r, h0 + r * 0.75, 0, h0 + r * 1.45); p.quadraticCurveTo(r, h0 + r * 0.75, r, h0); p.lineTo(r, 0); p.lineTo(-r, 0); s.holes.push(p);
  part('saWall', new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 6 }), { M: mul(M, tr(0, 0, -T / 2)), uv: 'keep', uvk: [1 / 3.2, 1 / 3.2], uvo: [0.5, 0] });
  // ragged crest: a few stepped courses along the top, higher towards the arch
  for (let i = 0; i < 9; i++) {
    const x0 = -W / 2 + i * W / 9, hh = 0.25 + rn() * 0.7 + (i > 2 && i < 6 ? 0.35 : 0);
    bx('saWall', M, x0, x0 + W / 9, H, H + hh, -T / 2 + 0.1, T / 2 - 0.1, { noao: true });
  }
  // plain voussoir ring on both faces
  for (const sg of [-1, 1]) {
    const ring = new THREE.Shape(), q = r + 0.45; ring.moveTo(-q, 0); ring.lineTo(-q, h0); ring.quadraticCurveTo(-q, h0 + q * 0.75, 0, h0 + q * 1.45); ring.quadraticCurveTo(q, h0 + q * 0.75, q, h0); ring.lineTo(q, 0); ring.lineTo(r, 0); ring.lineTo(r, h0);
    ring.quadraticCurveTo(r, h0 + r * 0.75, 0, h0 + r * 1.45); ring.quadraticCurveTo(-r, h0 + r * 0.75, -r, h0); ring.lineTo(-r, 0); ring.lineTo(-q, 0);
    part('stone', new THREE.ShapeGeometry(ring, 6), { M: mul(M, sg > 0 ? tr(0, 0, T / 2 + 0.03) : mul(tr(0, 0, -T / 2 - 0.03), rotY(PI))), c: '#b8aa8c' });
  }
  // lining of the passage
  const vg = new THREE.CylinderGeometry(hw - 0.02, hw - 0.02, T + 0.2, 10, 1, true, 0, PI); vg.rotateZ(PI / 2); vg.rotateY(PI / 2); vg.translate(0, AH - hw - 0.4, 0);
  part('saVault', vg, { M, noao: true });
  return end("Porta Sant'Agata");
}
export const PORTA_SANT_AGATA = {
  name: "Porta Sant'Agata", x: SANTAGATA.c[0], z: SANTAGATA.c[1], radius: 30, skipIds: [], walls: pierWalls(SANTAGATA.c, SANTAGATA.n, SANTAGATA.hw, SANTAGATA.W, SANTAGATA.T), build: buildSantAgata,
};

// ---------------------------------------------------------------------------------------------------
// Porta Carini (Via Porta Carini at the Capo market): not an arch but two baroque pylons facing each other across the street, 7 m apart, pilastered shafts
// under a heavy cornice, a stone balustrade and an urn at each corner (Commons: Porta Carini (Palermo) 19 06 2026, Porta Carini - panoramio). OSM has both
// as small building footprints (w566758785, w279884676); their own walls stay, the street between them is open.
// ---------------------------------------------------------------------------------------------------
const CARINI = { west: [[-663.9, -386.9], [-663.3, -382.3], [-667.5, -382.2], [-668.1, -387.1]], east: [[-652.7, -390.8], [-651.2, -385.9], [-655.2, -385.0], [-656.6, -389.3]] };
function buildCariniPylon(ring) {
  return () => {
    initShared();
    const H = 13.0, ob = obb(ring), gr = groundRange(ring), gy = gr.hi + 0.1, ry = Math.atan2(ob.ux, ob.uz) + PI / 2;
    begin(gy);
    defMat('caWall', 128, 256, [4.6, H], (g, w, h) => {
      const sx = w / 4.6, sy = h / H, Y = (y) => h - y * sy;
      g.fillStyle = '#c9a97c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2.5, 441, ['rgba(110,80,50,0.12)', 'rgba(240,215,170,0.12)']);
      g.fillStyle = '#b39569'; g.fillRect(0, Y(1.3), w, 1.3 * sy);                                                         // base
      for (const x of [0.45, 1.65, 2.95, 4.15]) { g.fillStyle = '#dcc298'; g.fillRect((x - 0.3) * sx, 0, 0.6 * sx, Y(0)); g.fillStyle = 'rgba(50,35,20,0.25)'; g.fillRect((x + 0.3) * sx, 0, 2, h); }   // pilaster strips
      g.fillStyle = '#d6bb90'; g.fillRect(0, Y(H - 1.7), w, 1.0 * sy); g.fillRect(0, Y(H - 0.8), w, 0.5 * sy);                  // entablature and cornice
      g.fillStyle = 'rgba(40,28,16,0.28)'; g.fillRect(0, Y(H - 2.7), w, 2);
      streaks(g, w, h, 12, 442, 0.2, 100, '60,40,20');
    });
    box('stone', ob.w + 0.8, 1.0, ob.d + 0.8, { p: [ob.cx, gy - 0.5, ob.cz], ry, c: '#b39569' });
    prism('caWall', ring, gy, gy + H, { uvo: [0, -gy / H] });
    prism('flat', ring, gy + H, gy + H + 0.25, { c: '#d6bb90' });
    for (let i = 0; i < ring.length; i++) {   // projecting cornice
      const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz);
      bx('flat', frame((A[0] + B[0]) / 2, gy + H - 0.5, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2 - 0.2, l / 2 + 0.2, 0, 0.7, -0.4, 0.4, { c: '#dcc298' });
    }
    box('stone', ob.w - 0.9, 0.9, ob.d - 0.9, { p: [ob.cx, gy + H + 0.25, ob.cz], ry, c: '#d6bb90' });                       // balustrade block
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])                                                              // an urn on each corner
      lathe('stone', [[0, 0], [0.36, 0], [0.44, 0.32], [0.65, 0.98], [0.47, 1.56], [0.29, 1.82], [0.42, 2.0], [0, 2.1]], 8, { p: [ob.cx + (ob.ux * a * (ob.w / 2 - 0.35) + ob.vx * b * (ob.d / 2 - 0.35)), gy + H + 0.35, ob.cz + (ob.uz * a * (ob.w / 2 - 0.35) + ob.vz * b * (ob.d / 2 - 0.35))], c: '#d6bb90' });
    return end('Porta Carini pylon');
  };
}
export const PORTA_CARINI_W = { name: 'Porta Carini, west pylon', x: -665.8, z: -384.6, radius: 20, skipIds: ['w566758785'], build: buildCariniPylon(CARINI.west) };
export const PORTA_CARINI_E = { name: 'Porta Carini, east pylon', x: -654.0, z: -387.6, radius: 20, skipIds: ['w279884676'], build: buildCariniPylon(CARINI.east) };

export const GATES = [PORTA_NUOVA, PORTA_GRECI, PORTA_SANT_AGATA, PORTA_CARINI_W, PORTA_CARINI_E];
