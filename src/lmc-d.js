// City landmarks, group D: signature places outside the centro that had only a generic extrusion before.
// Albergo delle Povere, Palazzo di Giustizia, Villa Niscemi, Villa Castelnuovo with the Teatro di Verdura pavilion, Castello di Maredolce,
// Tonnara Florio, Porta Felice (the two pylons), Convento dei Cappuccini (catacombs) and its church.
// Footprints come from src/landmarks-city-data2.js (world tiles, OSM); coordinates of the places were checked against Wikipedia (see docs/faithfulness/landmarks.md).
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, archBay, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  statue, palm, crenel, rail, balus,
} from './lmc-kit.js';
import { FP2 } from './landmarks-city-data2.js';

// ---------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------
// farthest hit of a ray from (cx,cz) with a ring
function rayFar(ring, cx, cz, dx, dz) {
  let best = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ez - (a[1] - cz) * ex) / den, s = ((a[0] - cx) * dz - (a[1] - cz) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best;
}
// the footprint's front: the box axis closest to the direction of the nearest road, and the frame on the wall in that direction (local +z outward)
function front(key, gy) {
  const f = FP2[key], pts = pairsOf(f.p), holes = (f.holes || []).map(pairsOf), ob = obb(pts), c = centroid(pts), fc = f.face || [0, 1];
  let n = null;
  for (const [nx, nz] of [[ob.ux, ob.uz], [-ob.ux, -ob.uz], [ob.vx, ob.vz], [-ob.vx, -ob.vz]]) { const d = nx * fc[0] + nz * fc[1]; if (!n || d > n.d) n = { nx, nz, d }; }
  // use the ray through the middle of the box on that side so that wings and notches do not mislead it
  const hit = rayFar(pts, ob.cx, ob.cz, n.nx, n.nz);
  const x = ob.cx + n.nx * hit, z = ob.cz + n.nz * hit;
  const across = Math.abs(n.nx * ob.ux + n.nz * ob.uz) > 0.7 ? ob.d : ob.w;   // box extent along the front wall
  return { pts, holes, ob, c, nx: n.nx, nz: n.nz, hit, across, M: frame(x, gy, z, n.nx, n.nz), x, z };
}
// storey facade texture: one bay of bayW metres, H metres tall, repeated along every wall (v starts at the base, see body())
function facadeMat(key, bayW, H, spec, px = 40) {
  defMat(key, Math.max(64, Math.round(bayW * px / 16) * 16), Math.max(128, Math.round(H * px / 16) * 16), [bayW, H], (g, w, h) => paintFacade(g, w, h, bayW, H, spec));
}
// the building mass: optional foundation, walls with the repeating facade (v aligned to the base), flat roof cap, cornice round every edge
function body(key, bayW, H, pts, holes, y0, o = {}) {
  if (o.lo !== undefined && o.lo < y0) prism('stone', pts, o.lo, y0, { holes, c: o.footC || '#a89c88' });
  prism(key, pts, y0, y0 + H, { holes, uvo: [0, -y0 / H] });
  prism('flat', pts, y0 + H, y0 + H + 0.2, { holes, c: o.roof || '#8f8a82' });
  const rings = [pts, ...(o.holeCornice ? holes : [])];
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    bx('flat', frame((A[0] + B[0]) / 2, y0 + H - 0.5, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, o.cornH || 0.8, -(o.cornD || 0.5), o.cornD || 0.5, { c: o.cc || '#e6d9bc' });
  }
}
// arcade along the inside of a courtyard ring: bays of `bay` metres, ground storey and first floor, towards the courtyard centre
function arcade(ring, y0, o = {}) {
  let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
  const bay = o.bay || 3.6; let n = 0;
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 5) continue;
    let nx = -dz / l, nz = dx / l; if (nx * (cx - (A[0] + B[0]) / 2) + nz * (cz - (A[1] + B[1]) / 2) < 0) { nx = -nx; nz = -nz; }
    const nb = Math.floor(l / bay), bw = l / nb;
    for (let q = 0; q < nb; q++) {
      const t = (q + 0.5) * bw, px = A[0] + dx / l * t, pz = A[1] + dz / l * t;
      for (let fl = 0; fl < (o.floors || 2); fl++) {
        const M = frame(px, y0 + fl * 4.9, pz, nx, nz);
        archBay('marble', bw, 4.6, bw - 1.1, 3.9, 0.9, { M, c: o.c || '#f0e6cc' });
        bx('flat', M, -bw / 2, bw / 2, 4.6, 4.9, 0, 1.0, { c: o.cc || '#e6d9bc', noao: true });
        n++;
      }
    }
  }
  return n;
}

// ====================================================================================================
// Albergo delle Povere (Corso Calatafimi): the vast 18th-century poorhouse, weathered ochre, three storeys, the baroque portal on the main front,
// two-storey arcades round the courtyards.
// ====================================================================================================
function buildPovere() {
  initShared();
  const F = front('povere', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 14.6;
  begin(gy);
  facadeMat('apWall', 5.2, H, { base: '#cdb48a', trim: '#e9dcc0', glass: '#2b2724', seed: 951, plinth: { h: 1.3, c: '#a89478' }, grime: 1,
    bands: [{ y: 5.0, h: 0.3, c: '#e1d3b2' }, { y: 9.9, h: 0.3, c: '#e1d3b2' }, { y: 13.8, h: 0.7, c: '#e1d3b2' }],
    rows: [{ y0: 1.8, y1: 3.9, xs: [2.6], w: 1.1, kind: 'rect', fr: 0.12 }, { y0: 5.9, y1: 8.9, xs: [2.6], w: 1.3, kind: 'rect', ped: true, balc: true }, { y0: 10.7, y1: 13.0, xs: [2.6], w: 1.1, kind: 'rect' }] });
  body('apWall', 5.2, H, F.pts, F.holes, gy, { lo: gr.lo - 2, roof: '#9c8e7a', cc: '#e1d3b2', holeCornice: true });
  // courtyards: arcades on the three largest, within a triangle budget
  let bays = 0;
  [...F.holes].sort((a, b) => b.length - a.length).slice(0, 3).forEach(h => { if (bays < 90) bays += arcade(h, gy, { bay: 4.0 }); });
  // the main portal: stone surround with a balcony, a pediment and the coat of arms
  const M = F.M;
  bx('tufa', M, -3.2, 3.2, 0, 8.2, 0, 0.9, { c: '#e8dcc0' });
  archBay('tufa', 3.6, 5.2, 2.2, 4.2, 0.5, { M: mul(M, tr(0, 0, 0.9)), c: '#d8c9a6' });
  bx('dark', M, -1.0, 1.0, 0, 3.7, 0.95, 1.0, { noao: true });
  bx('flat', M, -2.6, 2.6, 5.1, 5.5, 0.9, 2.1, { c: '#d8c9a6' });
  rail(mul(M, tr(0, 5.5, 2.0)), 5.2, 1.0, { c: '#2a2a2a' });
  bx('flat', M, -3.6, 3.6, 8.2, 8.7, 0, 1.3, { c: '#e8dcc0' });
  return end('Albergo delle Povere');
}
export const POVERE = { name: 'Albergo delle Povere', x: -1382, z: 633, radius: 130, skipIds: [FP2.povere.id], build: buildPovere };

// ====================================================================================================
// Palazzo di Giustizia (Piazza Vittorio Emanuele Orlando; Ernesto and Gaetano Rapisardi, 1938 to 1957): rationalist block in pale travertine,
// vertical pilaster strips with tall recessed windows, a stepped plinth and a pale flat roof.
// ====================================================================================================
function buildGiustizia() {
  initShared();
  const F = front('giustizia', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 25.2;
  begin(gy);
  facadeMat('pgWall', 6.0, H, { base: '#dcd2bb', trim: '#ece4d0', glass: '#4a5a62', seed: 961, plinth: { h: 2.4, c: '#bcb29c' }, grime: 1,
    pil: { xs: [0, 6], w: 1.3, c: '#cfc5ae' }, bands: [{ y: 24.0, h: 1.2, c: '#cfc5ae' }],
    rows: [{ y0: 3.6, y1: 6.4, xs: [3.0], w: 2.2, kind: 'rect', fr: 0.1 }, { y0: 7.6, y1: 10.4, xs: [3.0], w: 2.2, kind: 'rect', fr: 0.1 }, { y0: 11.6, y1: 14.4, xs: [3.0], w: 2.2, kind: 'rect', fr: 0.1 },
      { y0: 15.6, y1: 18.4, xs: [3.0], w: 2.2, kind: 'rect', fr: 0.1 }, { y0: 19.6, y1: 22.4, xs: [3.0], w: 2.2, kind: 'rect', fr: 0.1 }] }, 28);
  body('pgWall', 6.0, H, F.pts, F.holes, gy, { lo: gr.lo - 3, roof: '#b8b0a0', cc: '#cfc5ae', cornH: 1.2, cornD: 0.7 });
  // the entrance: a wide stair up to a glazed hall under a deep canopy
  const M = F.M;
  for (let i = 0; i < 5; i++) bx('stone', M, -9 - i * 0.3, 9 + i * 0.3, 0, 0.4 + i * 0.18, 0.5 + (4 - i) * 0.5, 4.5, { c: '#cfc7b4' });
  bx('flat', M, -9.5, 9.5, 8.2, 9.0, 0, 5.2, { c: '#d6ccb6' });
  for (const x of [-8.5, -4.2, 0, 4.2, 8.5]) bx('flat', M, x - 0.5, x + 0.5, 0, 8.2, 4.6, 5.1, { c: '#d6ccb6' });
  bx('dark', M, -7.4, 7.4, 0.6, 7.8, 0.02, 0.1, { c: '#2a3640', noao: true });
  return end('Palazzo di Giustizia');
}
export const GIUSTIZIA = { name: 'Palazzo di Giustizia', x: -806, z: -330, radius: 110, skipIds: [FP2.giustizia.id], build: buildGiustizia };

// ====================================================================================================
// Villa Niscemi (Piana dei Colli): cream baroque villa with stone balconies, a low service wing with a balustraded terrace and orange pergola cloths.
// ====================================================================================================
function buildNiscemi() {
  initShared();
  const F = front('niscemi', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 13.2;
  begin(gy);
  facadeMat('nsWall', 4.6, H, { base: '#ecdfb9', trim: '#f7efd8', glass: '#2a2422', seed: 971, plinth: { h: 0.9, c: '#d8c89e' }, grime: 1,
    bands: [{ y: 4.5, h: 0.3, c: '#f4ead0' }, { y: 9.0, h: 0.3, c: '#f4ead0' }, { y: 12.4, h: 0.5, c: '#f4ead0' }],
    rows: [{ y0: 1.4, y1: 3.6, xs: [2.3], w: 1.1, kind: 'rect', fr: 0.16 }, { y0: 5.4, y1: 8.2, xs: [2.3], w: 1.2, kind: 'rect', ped: true, balc: true, shut: 'open' }, { y0: 9.9, y1: 11.9, xs: [2.3], w: 1.1, kind: 'rect', shut: 'open' }], shut: '#3a2f28' });
  body('nsWall', 4.6, H, F.pts, F.holes, gy, { lo: gr.lo - 1.5, roof: '#b6704f', cc: '#f4ead0' });
  const M = F.M;   // the arched entrance and its balcony
  archBay('tufa', 3.4, 4.0, 2.0, 3.4, 0.5, { M: mul(M, tr(0, 0, 0.0)), c: '#f2e8c8' });
  bx('dark', M, -0.9, 0.9, 0, 3.0, 0.1, 0.18, { noao: true });
  bx('flat', M, -1.9, 1.9, 5.0, 5.4, 0, 1.0, { c: '#e8dcc0' });
  balus(mul(M, tr(0, 5.4, 1.0)), 3.8, 0.9);
  // palms and a stone urn at the entrance
  palm(F.x + F.nx * 12 + F.nz * 9, groundY(F.x + F.nx * 12, F.z + F.nz * 12), F.z + F.nz * 12 - F.nx * 9, 11, { r: 1 });
  palm(F.x + F.nx * 11 - F.nz * 10, groundY(F.x + F.nx * 11, F.z + F.nz * 11), F.z + F.nz * 11 + F.nx * 10, 12, { r: 2 });
  return end('Villa Niscemi');
}
export const NISCEMI = { name: 'Villa Niscemi', x: -2354, z: -5420, radius: 70, skipIds: [FP2.niscemi.id], build: buildNiscemi };

// ====================================================================================================
// Villa Castelnuovo (Istituto Agrario) and the entrance pavilion of the Teatro di Verdura on Viale del Fante: a neoclassical pronaos with two herms
// under a pediment; the gate in front is flanked by stone sphinxes.
// ====================================================================================================
function buildCastelnuovo() {
  initShared();
  const F = front('castelnuovo', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 12.4;
  begin(gy);
  facadeMat('cnuWall', 5.0, H, { base: '#e6d4a0', trim: '#f6ecd0', glass: '#2a2624', seed: 981, plinth: { h: 0.9, c: '#cbb98a' }, grime: 1,
    bands: [{ y: 4.3, h: 0.3, c: '#f0e4c0' }, { y: 8.6, h: 0.3, c: '#f0e4c0' }, { y: 11.8, h: 0.6, c: '#f0e4c0' }],
    rows: [{ y0: 1.4, y1: 3.6, xs: [2.5], w: 1.2, kind: 'arch', fr: 0.16 }, { y0: 5.2, y1: 7.8, xs: [2.5], w: 1.2, kind: 'rect', ped: true, balc: true, shut: 'open' }, { y0: 9.4, y1: 11.2, xs: [2.5], w: 1.0, kind: 'rect', shut: 'open' }], shut: '#4a6a4a' });
  body('cnuWall', 5.0, H, F.pts, [], gy, { lo: gr.lo - 1.5, roof: '#b6704f', cc: '#f0e4c0' });
  return end('Villa Castelnuovo');
}
export const CASTELNUOVO = { name: 'Villa Castelnuovo', x: -2314, z: -4742, radius: 50, skipIds: [FP2.castelnuovo.id], build: buildCastelnuovo };

function buildVerdura() {
  initShared();
  const F = front('verdura', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 7.2, M = F.M;
  begin(gy);
  defMat('vdWall', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#e2cf92'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 991, ['rgba(110,85,50,0.10)', 'rgba(255,250,220,0.10)']); streaks(g, w, h, 8, 992, 0.08, 60); });
  const W = F.across, D = Math.min(F.ob.d, F.ob.w);
  body('vdWall', 3, H, F.pts, [], gy, { lo: gr.lo - 1.0, roof: '#a89878', cc: '#d8c680', cornH: 1.0 });
  // pronaos: shallow porch with two herms (telamones) carrying the architrave, a pediment above
  bx('dark', M, -W * 0.22, W * 0.22, 0, H - 1.2, -0.02, 0.4, { c: '#2c2622', noao: true });
  for (const sx of [-1, 1]) {
    bx('vdWall', M, sx * W * 0.34 - 0.55, sx * W * 0.34 + 0.55, 0, H - 1.2, 0, 1.3);
    bx('marble', M, sx * W * 0.1 - 0.4, sx * W * 0.1 + 0.4, 0.3, H - 1.8, 0.3, 1.1, { c: '#d9d3c2' });     // herm shaft
    sphere('marble', 0.38, { M: mul(M, tr(sx * W * 0.1, H - 1.9, 0.7)), c: '#d9d3c2', seg: 6 });             // head
  }
  bx('vdWall', M, -W / 2 - 0.3, W / 2 + 0.3, H - 1.2, H, 0, 1.6, { c: '#efe3b8' });
  const sh = new THREE.Shape(); sh.moveTo(-W * 0.52, 0); sh.lineTo(W * 0.52, 0); sh.lineTo(0, 1.7); sh.lineTo(-W * 0.52, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), { M: mul(M, tr(0, H, 0.6)), c: '#efe3b8' });
  // the gate on the street, with two sphinx pillars and a low iron railing
  const MG = mul(M, tr(0, 0, 9));
  for (const sx of [-1, 1]) {
    bx('tufa', MG, sx * 3.2 - 0.8, sx * 3.2 + 0.8, 0, 2.2, -0.8, 0.8, { c: '#cfc3a0' });
    bx('marble', MG, sx * 3.2 - 0.4, sx * 3.2 + 0.4, 2.2, 2.9, -0.9, 0.6, { c: '#bdb6a4' });              // sphinx body
    box('marble', 0.5, 0.7, 0.5, { M: MG, p: [sx * 3.2, 2.2, 0.8], c: '#bdb6a4' });                           // raised head
    bx('flat', MG, sx * 3.2 - 0.3, sx * 3.2 + 0.3, 0.05, 3.5, 0.9, 1.1, { c: '#6a6a60', noao: true });          // lantern post
  }
  rail(mul(MG, tr(-7.5, 0, 0)), 8.5, 1.6, { c: '#ffffff' }); rail(mul(MG, tr(7.5, 0, 0)), 8.5, 1.6, { c: '#ffffff' });
  return end('Teatro di Verdura (entrance)');
}
export const VERDURA = { name: 'Teatro di Verdura (entrance pavilion)', x: -2362, z: -4953, radius: 40, skipIds: [FP2.verdura.id], build: buildVerdura };

// ====================================================================================================
// Castello di Maredolce (Palazzo della Favara, Brancaccio): plain blocky sandstone Norman pleasure palace with tall blind pointed arches on the
// long walls, narrow slit windows, a crenellated top and a round tower on one corner.
// ====================================================================================================
function buildMaredolce() {
  initShared();
  const F = front('maredolce', 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 11.5;
  begin(gy);
  defMat('mdWall', 512, 256, [14, H], (g, w, h) => {
    const sx = w / 14, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, 14, H, 0.42, 1.0, '#c4aa7c', '#8f7a54', 1001, 2, 0.06);
    for (const cx of [3.5, 10.5]) {
      g.beginPath(); g.moveTo(X(cx - 2.2), Y(0.4)); g.lineTo(X(cx - 2.2), Y(7.2)); g.quadraticCurveTo(X(cx - 2.2), Y(9.3), X(cx), Y(10.2)); g.quadraticCurveTo(X(cx + 2.2), Y(9.3), X(cx + 2.2), Y(7.2)); g.lineTo(X(cx + 2.2), Y(0.4)); g.closePath();
      g.fillStyle = '#b39967'; g.fill(); g.strokeStyle = 'rgba(60,45,25,0.55)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#2a2219'; g.fillRect(X(cx - 0.18), Y(7.2), 0.36 * sx, 1.6 * sy); g.fillRect(X(cx - 0.18), Y(3.6), 0.36 * sx, 1.4 * sy);
    }
    streaks(g, w, h, 40, 1002, 0.22, 200);
  });
  body('mdWall', 14, H, F.pts, [], gy, { lo: gr.lo - 2.5, roof: '#a89a7a', cc: '#cdb98e', cornH: 0.6, cornD: 0.35 });
  for (let i = 0; i < F.pts.length; i++) {   // crenellation along every wall
    const A = F.pts[i], B = F.pts[(i + 1) % F.pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 2) continue;
    crenel(frame((A[0] + B[0]) / 2, gy + H + 0.2, (A[1] + B[1]) / 2, -dz / l, dx / l), l, { c: '#cdb98e' });
  }
  // the round tower on the corner nearest the road
  const o = F.ob, cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.cx + o.ux * a * o.w / 2 + o.vx * b * o.d / 2, o.cz + o.uz * a * o.w / 2 + o.vz * b * o.d / 2]);
  let best = cs[0]; for (const c of cs) if (Math.hypot(c[0] - F.x, c[1] - F.z) < Math.hypot(best[0] - F.x, best[1] - F.z)) best = c;
  const tx = best[0] - (best[0] - o.cx) * 0.06, tz = best[1] - (best[1] - o.cz) * 0.06;
  cyl('stone', 2.7, 3.0, H + 5.5, 10, { p: [tx, gy - 0.5, tz], c: '#d6c39a' });
  cyl('flat', 3.1, 3.1, 0.5, 10, { p: [tx, gy + H + 5.0, tz], c: '#cdb98e' });
  return end('Castello di Maredolce');
}
export const MAREDOLCE = { name: 'Castello di Maredolce', x: 2288, z: 2587, radius: 50, skipIds: [FP2.maredolce.id], build: buildMaredolce };

// ====================================================================================================
// Tonnara Florio (Arenella): the long tuff-stone sheds of the old tuna cannery with their rows of tall pointed arches, tiled roofs,
// and the stone tower of the old mill beside it.
// ====================================================================================================
function buildTonnara() {
  initShared();
  const keys = ['tonnara', 'tonnara2'];
  const all = keys.map(k => pairsOf(FP2[k].p)), gr = groundRange([].concat(...all)), gy = gr.hi + 0.1;
  begin(gy);
  defMat('tnWall', 512, 128, [16, 7], (g, w, h) => {
    const sx = w / 16, sy = h / 7, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, 16, 7, 0.45, 1.0, '#cdb68a', '#947f58', 1011, 2, 0.07);
    for (let i = 0; i < 4; i++) {
      const cx = 2 + i * 4, bw = 2.6;
      g.beginPath(); g.moveTo(X(cx - bw / 2), Y(0)); g.lineTo(X(cx - bw / 2), Y(3.8)); g.quadraticCurveTo(X(cx - bw / 2), Y(5.3), X(cx), Y(6.0)); g.quadraticCurveTo(X(cx + bw / 2), Y(5.3), X(cx + bw / 2), Y(3.8)); g.lineTo(X(cx + bw / 2), Y(0)); g.closePath();
      g.fillStyle = '#2a2018'; g.fill(); g.strokeStyle = '#e1d0a8'; g.lineWidth = 4; g.stroke();
    }
    streaks(g, w, h, 24, 1012, 0.2, 90);
  });
  for (const pts of all) {
    prism('stone', pts, gr.lo - 1.5, gy, { c: '#a89c80' });
    prism('tnWall', pts, gy, gy + 7, { uvo: [0, -gy / 7] });
    prism('flat', pts, gy + 7, gy + 7.2, { c: '#a8704f' });
    const ob = obb(pts); pyramid('tile', ob.w * 1.02, ob.d * 1.15, 2.4, { p: [ob.cx, gy + 7.2, ob.cz], ry: Math.atan2(ob.ux, ob.uz) + PI / 2, c: '#c4785a' });
  }
  // the mill tower: stone, round, with a conical cap
  const mt = pairsOf(FP2.mulino.p), mc = centroid(mt), mg = groundY(mc[0], mc[1]);
  cyl('stone', 4.2, 4.8, 13.5, 12, { p: [mc[0], mg - 1, mc[1]], c: '#cdb68a' });
  cone('tile', 5.0, 3.2, 12, { p: [mc[0], mg + 12.5, mc[1]], c: '#b86a4a' });
  return end('Tonnara Florio');
}
export const TONNARA = { name: 'Tonnara Florio', x: 1162, z: -3971, radius: 70, skipIds: [FP2.tonnara.id, FP2.tonnara2.id, FP2.mulino.id], build: buildTonnara };

// ====================================================================================================
// Porta Felice (outside, towards the sea): the two baroque pylons at the end of the Cassaro; ochre stone, paired columns, a statue niche,
// a balcony and a broken pediment on top. The gate itself is the street between them.
// ====================================================================================================
function buildPortaFelice(which) {
  return () => {
    initShared();
    const k = 'portaFelice' + which, F = front(k, 0), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = which === 1 ? 17.2 : 19.8, M = F.M;
    begin(gy);
    defMat('pfWall', 256, 256, [12, 20], (g, w, h) => {
      const sx = w / 12, sy = h / 20, X = (s) => s * sx, Y = (y) => h - y * sy;
      paintAshlar(g, w, h, 12, 20, 0.5, 1.1, '#d6b78f', '#a98b63', 1021, 2, 0.06);
      g.fillStyle = '#c7a578'; g.fillRect(0, Y(6.4), w, 0.5 * sy); g.fillRect(0, Y(12.6), w, 0.5 * sy); g.fillRect(0, Y(19.5), w, 0.5 * sy);
      for (const x of [2.2, 9.8]) { g.fillStyle = '#ead9b8'; g.fillRect(X(x - 0.4), Y(18.8), 0.8 * sx, 18 * sy); }              // pilaster strips
      g.fillStyle = '#4a3a2c'; g.fillRect(X(4.6), Y(5.0), 2.8 * sx, 3.4 * sy);                                                   // doorway
      g.fillStyle = '#c9a97a'; g.beginPath(); g.moveTo(X(4.2), Y(11.2)); g.lineTo(X(4.2), Y(15.6)); g.arc(X(6), Y(15.6), 1.8 * sx, PI, 0); g.lineTo(X(7.8), Y(11.2)); g.fill(); // statue niche
      g.fillStyle = '#ece2cc'; g.fillRect(X(5.5), Y(14.2), 1.0 * sx, 2.6 * sy);
      g.fillStyle = '#2b2420'; g.fillRect(X(4.8), Y(10.4), 2.4 * sx, 0.1 * sy); g.fillRect(X(5.0), Y(8.8), 2.0 * sx, 2.4 * sy);  // balcony window
      streaks(g, w, h, 20, 1022, 0.18, 120);
    });
    const ob = F.ob, w = ob.w * 0.92, d = ob.d * 0.92;
    box('stone', w + 1.4, 0.9, d + 1.4, { p: [ob.cx, gy - 0.4, ob.cz], ry: Math.atan2(ob.ux, ob.uz) + PI / 2, c: '#c9b690' });
    prism('pfWall', F.pts, gy, gy + H, { uvo: [0, -gy / 20] });
    prism('flat', F.pts, gy + H, gy + H + 0.6, { c: '#cdb48c' });
    // crowning: broken pediment with a finial on each face, volute shoulders
    const sh = new THREE.Shape(); sh.moveTo(-3.2, 0); sh.lineTo(3.2, 0); sh.lineTo(1.4, 1.8); sh.lineTo(-1.4, 1.8); sh.lineTo(-3.2, 0);
    part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }), { M: mul(M, tr(0, H + 0.6, -0.4)), c: '#d6b78f' });
    sphere('flat', 0.55, { M: mul(M, tr(0, H + 2.7, 0)), c: '#cdb48c', seg: 6 });
    for (const sx of [-1, 1]) { sphere('flat', 0.7, { M: mul(M, tr(sx * 3.4, H + 0.9, 0)), c: '#d6b78f', seg: 6 }); }
    return end('Porta Felice pylon ' + which);
  };
}
export const PORTA_FELICE_1 = { name: 'Porta Felice, north pylon', x: 870, z: -446, radius: 30, skipIds: [FP2.portaFelice1.id], build: buildPortaFelice(1) };
export const PORTA_FELICE_2 = { name: 'Porta Felice, south pylon', x: 881, z: -426, radius: 30, skipIds: [FP2.portaFelice2.id], build: buildPortaFelice(2) };

// ====================================================================================================
// Convento dei Cappuccini (the catacombs): pale plastered convent round a cloister and its plain neoclassical church with a portico.
// ====================================================================================================
function buildCappuccini() {
  initShared();
  const F = front('cappuccini', 0), Fc = front('cappChiesa', 0), gr = groundRange([...F.pts, ...Fc.pts]), gy = gr.hi + 0.1, Hc = 12.0, Hh = 14.5;
  begin(gy);
  facadeMat('cpWall', 4.4, Hc, { base: '#e4d4aa', trim: '#f2e8cc', glass: '#2a2624', seed: 1031, plinth: { h: 0.8, c: '#c8b88e' }, grime: 1,
    bands: [{ y: 4.3, h: 0.25, c: '#f0e4c0' }, { y: 8.4, h: 0.25, c: '#f0e4c0' }, { y: 11.4, h: 0.5, c: '#f0e4c0' }],
    rows: [{ y0: 1.3, y1: 3.4, xs: [2.2], w: 1.0, kind: 'arch', fr: 0.14 }, { y0: 5.2, y1: 7.5, xs: [2.2], w: 1.0, kind: 'rect', shut: 'open' }, { y0: 9.2, y1: 10.8, xs: [2.2], w: 0.9, kind: 'rect', shut: 'open' }], shut: '#5a6a4a' });
  body('cpWall', 4.4, Hc, F.pts, F.holes, gy, { lo: gr.lo - 2, roof: '#b6704f', cc: '#f0e4c0', holeCornice: true });
  // church: taller nave under a low gabled roof, a pedimented portico on the road side
  facadeMat('cpChurch', 5.0, Hh, { base: '#e6d6ae', trim: '#f4ead0', glass: '#2a2624', seed: 1032, plinth: { h: 1.0, c: '#c8b88e' }, grime: 1,
    bands: [{ y: 13.6, h: 0.8, c: '#f0e4c0' }], rows: [{ y0: 6.2, y1: 10.8, xs: [2.5], w: 1.3, kind: 'arch', fr: 0.18, sill: false }] });
  body('cpChurch', 5.0, Hh, Fc.pts, [], gy, { lo: gr.lo - 2, roof: '#a89a7a', cc: '#f0e4c0' });
  const M = Fc.M, PW = Math.min(Fc.across * 0.7, 12);
  for (let i = 0; i < 4; i++) cyl('marble', 0.4, 0.46, 8.2, 10, { M: mul(M, tr(-PW / 2 + 0.6 + i * (PW - 1.2) / 3, 0.4, 3.2)), c: '#efe6cc' });
  bx('flat', M, -PW / 2, PW / 2, 8.6, 9.6, 0, 3.8, { c: '#efe6cc' });
  const sh = new THREE.Shape(); sh.moveTo(-PW / 2, 0); sh.lineTo(PW / 2, 0); sh.lineTo(0, 2.0); sh.lineTo(-PW / 2, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }), { M: mul(M, tr(0, 9.6, 3.2)), c: '#efe6cc' });
  bx('dark', M, -1.3, 1.3, 0.4, 5.4, 0.02, 0.1, { c: '#3a2c22', noao: true });
  for (let i = 0; i < 4; i++) bx('stone', M, -PW / 2 + 0.4 - i * 0.2, PW / 2 - 0.4 + i * 0.2, 0, 0.5 - i * 0.12, 3.6 + i * 0.4, 4.0 + i * 0.4, { c: '#cfc7b4' });
  return end('Convento dei Cappuccini');
}
export const CAPPUCCINI = { name: 'Convento dei Cappuccini', x: -1898, z: 413, radius: 90, skipIds: [FP2.cappuccini.id, FP2.cappChiesa.id], build: buildCappuccini };
