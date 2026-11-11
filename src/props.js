// Street props and vegetation for the whole city: real OSM street furniture (tile.data.props, baked by tools/tiles.py) plus procedural fill
// along the tile's roads, curbs, buildings and areas, per district (zoneAt). Built per tile when it reaches full detail, disposed when it drops.
// Owned by the props work. Everything is vertex-coloured low-poly in shared InstancedMeshes,
// bucketed into 250 m cells so frustum culling still works.
import * as THREE from 'three';
import { groundY, pairs, signedArea, rng, inPoly, proj, rasterMaskIter, freeCanvas } from './core.js';
import { paintAtlas, COLS as POSTER_COLS, ROWS as POSTER_ROWS, CELL_W, CELL_H, COUNT as POSTERS, DW as POSTER_DW, DH as POSTER_DH } from './adverts.js';   // the twelve adverts on the billboards
import { NIGHT } from './daynight.js';   // (read only: its shared night uniform lights the billboards)
import { paintAtlas as paintSigns, COLS as SIGN_COLS, ROWS as SIGN_ROWS, CELL_W as SIGN_W, CELL_H as SIGN_H, BRANDS, brandOf } from './supermarkets.js';   // the supermarkets' parody signs
import { zoneAt, ZONES } from './districts.js';
import { SUCA_TAGS } from './suca-tags.js';   // (the SUCA wall tags are collectibles: a shopfront never covers one)
import { speciesFor, SP } from './species.js';
import { treeGeo } from './treegeo.js';
import { treeCleared } from './tree-clear.js';
import { buildParkedModels, makeMaterial } from '../assets/traffic/models.js';   // the traffic cars' own models: parked cars are the same cars
import { BUS_STOPS } from '../assets/traffic/bus-routes.js';
import { signalSites, legPoint, signalMaterial, createSignalLamps, STOP_BACK, clock as signalClock, light as signalLight } from './signals.js';   // the traffic signals: where they stand, which road each head faces, the lamp it shows
import { isFastRoad, isLane, builtAt, fastAt } from './road-class.js';   // the fast roads (the Viale's carriageways, and its lanes where nothing is built beside them): no parked cars, bins or crossings
const hyp2 = (a, b) => Math.sqrt(a * a + b * b); // [perf pass] Math.hypot boxes a heap number per call; this runs thousands of times per frame

const TAU = Math.PI * 2;
const C = h => new THREE.Color(h);
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// ------------------------------------------------------------------ geometry builder
class MB {
  constructor() { this.p = []; this.c = []; this.ctr = null; }
  vert(v, col, kk) { this.p.push(v[0], v[1], v[2]); const k = (v[3] === undefined ? 1 : v[3]) * kk; this.c.push(col.r * k, col.g * k, col.b * k); }
  // Polygon fan. With this.ctr set (convex solids) the winding is fixed to face away from it.
  face(col, vs, kk = 1) {
    if (this.ctr) {
      const a = vs[0], b = vs[1], c = vs[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const mx = (a[0] + b[0] + c[0]) / 3 - this.ctr[0], my = (a[1] + b[1] + c[1]) / 3 - this.ctr[1], mz = (a[2] + b[2] + c[2]) / 3 - this.ctr[2];
      if (nx * mx + ny * my + nz * mz < 0) vs = vs.slice().reverse();
    }
    for (let i = 1; i < vs.length - 1; i++) { this.vert(vs[0], col, kk); this.vert(vs[i], col, kk); this.vert(vs[i + 1], col, kk); }
  }
  // rect bottom [x0,z0,x1,z1] at y0, rect top at y1 (box when equal)
  frust(y0, r0, y1, r1, col, k0 = 0.78, k1 = 1, bot = true) {
    this.ctr = [(r0[0] + r0[2] + r1[0] + r1[2]) / 4, (y0 + y1) / 2, (r0[1] + r0[3] + r1[1] + r1[3]) / 4];
    const b = [[r0[0], y0, r0[1], k0], [r0[2], y0, r0[1], k0], [r0[2], y0, r0[3], k0], [r0[0], y0, r0[3], k0]];
    const t = [[r1[0], y1, r1[1], k1], [r1[2], y1, r1[1], k1], [r1[2], y1, r1[3], k1], [r1[0], y1, r1[3], k1]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.face(col, [b[i], b[j], t[j], t[i]]); }
    this.face(col, t); if (bot) this.face(col, b);
    this.ctr = null; return this;
  }
  box(x0, y0, z0, x1, y1, z1, col, k0, k1, bot) { return this.frust(y0, [x0, z0, x1, z1], y1, [x0, z0, x1, z1], col, k0, k1, bot); }
  prism(cx, cz, y0, y1, r0, r1, seg, col, o = {}) {
    const k0 = o.k0 ?? 0.75, k1 = o.k1 ?? 1, rot = o.rot ?? 0.3;
    this.ctr = [cx, (y0 + y1) / 2, cz];
    const ring = (y, r, k) => { const a = []; for (let i = 0; i < seg; i++) a.push([cx + Math.cos(rot + TAU * i / seg) * r, y, cz + Math.sin(rot + TAU * i / seg) * r, k]); return a; };
    const b = ring(y0, r0, k0), t = ring(y1, r1, k1);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.face(col, [b[i], b[j], t[j], t[i]]); }
    if (r1 > 0 && o.cap !== false) this.face(col, t);
    if (o.bot) this.face(col, b);
    this.ctr = null; return this;
  }
  // cylinder along x (wheels)
  cylX(cx, cy, cz, r, w, seg, col, k = 1, outer = 0) {
    this.ctr = [cx, cy, cz];
    const ring = x => { const a = []; for (let i = 0; i < seg; i++) a.push([x, cy + Math.sin(TAU * i / seg + 0.4) * r, cz + Math.cos(TAU * i / seg + 0.4) * r, 1]); return a; };
    const l = ring(cx - w / 2), r2 = ring(cx + w / 2);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.face(col, [l[i], l[j], r2[j], r2[i]], k); }
    if (outer <= 0) this.face(col, l, k);
    if (outer >= 0) this.face(col, r2, k);
    this.ctr = null; return this;
  }
  // lumpy ellipsoid (shared-vertex jitter so it stays watertight); colour darkens towards the bottom
  lump(cx, cy, cz, rx, ry, rz, col, detail = 1, jit = 0.16, kLow = 0.6, seed = 0) {
    const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(), pos = g.attributes.position;
    const v = [];
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const j = 1 + (hash3(Math.round(x * 50) + seed, Math.round(y * 50), Math.round(z * 50)) - 0.5) * 2 * jit;
      v.push([cx + x * rx * j, cy + y * ry * j, cz + z * rz * j, kLow + (1 - kLow) * (y * 0.5 + 0.5)]);
    }
    for (let i = 0; i < v.length; i += 3) { const tj = 0.86 + 0.28 * hash3(i * 0.37 + seed, seed * 1.7, i * 0.11); for (let k = 0; k < 3; k++) this.vert(v[i + k], col, tj); }
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

// ------------------------------------------------------------------ models
const MODELS = {}; // name -> { geo, mat: 'std'|'dbl', tint }
const def = (name, mb, o = {}) => { MODELS[name] = { geo: mb.geo(), mat: o.dbl ? 'dbl' : 'std', tint: !!o.tint }; };

const GLASS = C('#262e35'), TYRE = C('#1a1a1c'), WHITE = C('#ffffff'), BLACKMET = C('#26262b');
const BB_LAMPS = [-1.6, 1.6]; let BB_LAMP_Y = 7;   // the billboard's two lamps (x on the model; the lens height is set where it is built)

// Parked cars are the traffic cars' own models (windows, wheels, lamps, a body colour tinted per instance), drawn with the traffic material.
{
  const TM = buildParkedModels();
  for (const n of ['panda', 'punto', 'smart', 'van']) MODELS[n] = { geo: TM[n], mat: 'veh', tint: true };
}

// Vespa / Piaggio Beverly style scooter, front is +z
{
  const mb = new MB(), seat = C('#1d1d20');
  mb.cylX(0, 0.2, 0.62, 0.2, 0.1, 5, TYRE, 1, 1); mb.cylX(0, 0.2, -0.62, 0.2, 0.12, 5, TYRE, 1, 1);
  mb.box(-0.2, 0.26, -0.95, 0.2, 0.78, -0.12, WHITE, 0.75, 1, false);       // rear body
  mb.box(-0.19, 0.24, -0.12, 0.19, 0.32, 0.4, WHITE, 0.8, 1, false);
  mb.frust(0.3, [-0.2, 0.34, 0.2, 0.42], 1.0, [-0.17, 0.5, 0.17, 0.56], WHITE, 0.85, 1, false);      // leg shield
  mb.box(-0.14, 0.78, -0.62, 0.14, 0.86, -0.02, seat, 0.9, 1, false);        // seat
  mb.box(-0.34, 0.98, 0.42, 0.34, 1.05, 0.52, BLACKMET, 0.9, 1, false);      // handlebar
  def('scooter', mb, { tint: true });
}

// Piaggio Ape (three-wheeler) and the tourist Ape Calessino
function ape(name, calessino) {
  const mb = new MB(), W = 0.7;
  const body = calessino ? C('#e9dfc4') : C('#f0ede4');
  mb.cylX(0, 0.2, 0.9, 0.2, 0.1, 6, TYRE); mb.cylX(-0.58, 0.2, -0.45, 0.2, 0.12, 6, TYRE, 1, -1); mb.cylX(0.58, 0.2, -0.45, 0.2, 0.12, 6, TYRE, 1, 1);
  mb.frust(0.28, [-0.5, 0.45, 0.5, 1.2], 1.0, [-0.4, 0.55, 0.4, 1.0], body, 0.8, 1);          // cab front
  mb.box(-0.5, 0.28, -1.0, 0.5, 0.85, 0.45, body, 0.8, 1);                                      // bed / seat box
  if (calessino) {
    for (const [x, z] of [[-0.55, 0.3], [0.55, 0.3], [-0.55, -0.9], [0.55, -0.9]]) mb.box(x - 0.025, 0.85, z - 0.025, x + 0.025, 1.9, z + 0.025, C('#3a3436'), 1, 1, false);
    mb.frust(1.9, [-0.7, -1.1, 0.7, 0.4], 2.05, [-0.6, -1.0, 0.6, 0.3], C('#7b2230'), 0.7, 1);   // burgundy canopy
    mb.box(-0.5, 0.85, -0.2, 0.5, 1.05, 0.15, C('#7b2230'), 1, 1, false);                       // seat cushion
  } else {
    mb.box(-0.5, 0.85, -1.0, 0.5, 1.5, 0.0, body, 0.8, 1);
  }
  def(name, mb, { tint: false });
}
ape('ape', false); ape('apetaxi', true);

// Cassonetto (1100 l wheelie bin, dark green) and loose bin bags
{
  const mb = new MB(), green = C('#4b6a5a');
  mb.frust(0.12, [-0.55, -0.62, 0.55, 0.62], 1.12, [-0.58, -0.66, 0.58, 0.66], green, 0.7, 1);
  mb.frust(1.12, [-0.58, -0.66, 0.58, 0.66], 1.26, [-0.55, -0.4, 0.55, 0.66], C('#3b4f44'), 0.9, 1);   // sloped lid
  for (const [u, y, s, col] of [[-0.3, 0.55, 0.3, '#d8d2c0'], [0.2, 0.8, 0.22, '#3a6f9a'], [0.35, 0.4, 0.25, '#c7a24a']]) // faded graffiti blotches
    mb.face(C(col), [[0.5 + 0.12, y, u - s], [0.5 + 0.12, y + 0.2, u - s], [0.5 + 0.12, y + 0.2, u + s], [0.5 + 0.12, y, u + s]], 1);
  def('bin_big', mb, { dbl: true });
  const bags = new MB();
  for (const [x, y, z, r, col] of [[0, 0.25, 0, 0.32, '#1c1c1f'], [0.4, 0.2, 0.15, 0.27, '#d9d8d0']])
    bags.lump(x, y, z, r, r * 0.85, r, C(col), 0, 0.2, 0.7);
  def('bags', bags);
  const sm = new MB();
  sm.prism(0, 0, 0.1, 0.85, 0.2, 0.23, 7, C('#3c4a42')); sm.prism(0, 0, 0.85, 0.9, 0.24, 0.24, 7, C('#222a26'));
  def('bin_small', sm);
}

// Lamps
{
  const grey = C('#8c9094'), mb = new MB();
  mb.prism(0, 0, 0, 0.5, 0.17, 0.12, 5, grey, { k0: 0.6 }); mb.prism(0, 0, 0.5, 8.6, 0.1, 0.07, 5, grey);
  for (const s of [-1, 1]) {   // double curved arm
    
    mb.box(Math.min(0, s * 1.6), 8.9, -0.04, Math.max(0, s * 1.6), 9.0, 0.04, grey, 1, 1, false);
    mb.box(s * 1.45 - 0.35, 8.82, -0.16, s * 1.45 + 0.35, 8.95, 0.16, C('#cfd3d5'), 0.8, 1, false);
  }
  def('lamp_pole', mb);
  // a roadside billboard of the fast roads (photos su07, su09, nw30): a 6 x 2.82 m poster on two steel posts, 4 m up, front +z, with a walkway under it and two lamps over it.
  // One model for all twelve adverts (src/adverts.js): the poster quad reads its cell of the advert atlas by the instance colour (posterMat), the rest are vertex colours.
  // uv marks the parts: the poster 0..1, the frame -1, the lamp lenses -2 (lit at night).
  const steel = C('#6d7175'), frame = C('#4a4d50'), bb = new MB(), PY0 = 4.1, PY1 = 4.1 + 6 * POSTER_DH / POSTER_DW;
  for (const x of [-2.2, 2.2]) bb.box(x - 0.14, 0, -0.14, x + 0.14, 4.1, 0.14, steel, 0.7, 1, false);
  bb.box(-3.1, 4.0, -0.22, 3.1, PY1 + 0.1, -0.02, frame, 0.8, 1, true);
  bb.box(-3.0, 3.9, 0.0, 3.0, 4.0, 0.7, frame, 0.8, 1, true);   // the walkway under it
  for (const x of BB_LAMPS) {   // a lamp on an arm over the poster, looking down at it
    bb.box(x - 0.03, PY1 + 0.02, -0.06, x + 0.03, PY1 + 0.08, 0.95, steel, 0.9, 1, false);
    bb.box(x - 0.18, PY1 + 0.0, 0.82, x + 0.18, PY1 + 0.14, 1.06, BLACKMET, 0.8, 1, false);
  }
  const nFrame = bb.p.length / 3;
  for (const x of BB_LAMPS) bb.face(WHITE, [[x - 0.15, PY1 - 0.01, 0.85], [x + 0.15, PY1 - 0.01, 0.85], [x + 0.15, PY1 - 0.01, 1.03], [x - 0.15, PY1 - 0.01, 1.03]]);   // the lens, facing down
  const nLens = bb.p.length / 3;
  bb.face(WHITE, [[-3, PY0, 0], [3, PY0, 0], [3, PY1, 0], [-3, PY1, 0]]);   // the poster
  const bg = bb.geo(), uv = new Float32Array(bg.attributes.position.count * 2).fill(-1), pos = bg.attributes.position;
  for (let i = nFrame; i < nLens; i++) uv[i * 2] = uv[i * 2 + 1] = -2;
  for (let i = nLens; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + 3) / 6; uv[i * 2 + 1] = (pos.getY(i) - PY0) / (PY1 - PY0); }
  bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  MODELS.billboard = { geo: bg, mat: 'poster', tint: true };   // tint: the instance colour carries the advert (posterCol)
  BB_LAMP_Y = PY1 - 0.01;
  const wl = new MB(), blk = C('#232326'), glow = C('#f4e6b8');   // wall lantern on a curly bracket, wall is z=0, out is +z
  wl.box(-0.025, 4.45, 0.0, 0.025, 4.52, 0.75, blk, 1, 1, false);
  wl.frust(4.0, [-0.1, 0.62, 0.1, 0.82], 4.3, [-0.17, 0.57, 0.17, 0.87], glow, 1, 1, false);
  wl.frust(4.3, [-0.17, 0.57, 0.17, 0.87], 4.42, [-0.04, 0.68, 0.04, 0.76], blk, 1, 1, false);
  def('lamp_wall', wl);
  // black candelabra post with globes (Piazza Pretoria style)
  const cd = new MB();
  cd.prism(0, 0, 0, 0.9, 0.22, 0.14, 8, blk, { k0: 0.7 }); cd.prism(0, 0, 0.9, 3.6, 0.07, 0.05, 6, blk);
  cd.prism(0, 0, 3.6, 3.75, 0.12, 0.12, 8, blk);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.78, dx = Math.cos(a), dz = Math.sin(a);
    cd.box(dx * 0.35 - 0.02, 3.65, dz * 0.35 - 0.02, dx * 0.35 + 0.02, 3.95, dz * 0.35 + 0.02, blk, 1, 1);
    cd.lump(dx * 0.4, 4.15, dz * 0.4, 0.17, 0.2, 0.17, C('#f1ede0'), 0, 0.05, 0.8);
  }
  cd.prism(0, 0, 3.75, 3.95, 0.04, 0.04, 6, blk); cd.lump(0, 4.35, 0, 0.18, 0.22, 0.18, C('#f1ede0'), 0, 0.05, 0.8);
  def('candelabra', cd);
  // a supermarket's totem at the entrance of its car park: two posts and a sign box 4.4 to 5.4 m up, front +z; the sign's two faces are in the tile's supermarket mesh (res.smk)
  const tm = new MB(), post = C('#7d8287');
  for (const x of [-0.9, 0.9]) tm.box(x - 0.09, 0, -0.09, x + 0.09, 4.42, 0.09, post, 0.7, 1, false);
  tm.box(-1.68, 4.38, -0.14, 1.68, 5.42, 0.14, C('#34373c'), 0.85, 1, true);
  def('smk_totem', tm);
}

// Utility pole of the power and telephone lines along the roads of the outskirts: a tapered shaft (grey concrete; the instance colour turns it wood brown) with a cross arm and three
// insulators, 9.4 m. The arm runs along z. The wires between the poles are one mesh per tile (generate, 14).
{
  const mb = new MB(), con = C('#b8b4aa'), arm = C('#4a4640'), ins = C('#6e7a74');
  mb.prism(0, 0, 0, 9.4, 0.16, 0.1, 6, con, { k0: 0.7 });
  mb.box(-0.06, 8.72, -1.0, 0.06, 8.84, 1.0, arm, 0.9, 1);
  for (const z of [-0.8, 0, 0.8]) mb.box(-0.04, 8.84, z - 0.04, 0.04, 8.97, z + 0.04, ins, 1, 1, false);
  def('utility_pole', mb, { tint: true });
}

// Bollards, benches, hydrants, phone, post box, cabinet, signals, bus stop
{
  const mb = new MB();
  mb.prism(0, 0, 0, 0.82, 0.09, 0.08, 5, C('#55585a'));
  def('bollard', mb);
  const bn = new MB(), wood = C('#8b6a45'), iron = C('#2a2c2e');   // bench facing +z
  bn.box(-0.9, 0.42, -0.2, 0.9, 0.46, 0.22, wood, 0.9, 1); bn.box(-0.9, 0.55, -0.22, 0.9, 0.9, -0.17, wood, 0.9, 1);
  for (const s of [-0.8, 0.8]) { bn.box(s - 0.03, 0, -0.2, s + 0.03, 0.42, 0.2, iron, 1, 1, false); bn.box(s - 0.03, 0.42, -0.24, s + 0.03, 0.9, -0.17, iron, 1, 1, false); }
  def('bench', bn);
  const fw = new MB();   // a Palermo fontanella: a green cast-iron column with a tap and a stone foot
  fw.box(-0.26, 0, -0.26, 0.26, 0.14, 0.26, C('#8d9094'), 0.8, 1); fw.prism(0, 0, 0.14, 0.9, 0.15, 0.11, 8, C('#2f4a3a'));
  fw.prism(0, 0, 1.0, 1.08, 0.17, 0.17, 8, C('#2f4a3a')); fw.box(-0.035, 0.66, 0.1, 0.035, 0.74, 0.3, C('#b8bdc0'), 1, 1); fw.box(-0.2, 0.4, 0.12, 0.2, 0.44, 0.34, C('#7d8286'), 1, 1);
  def('fontanella', fw);
  const hy = new MB(); hy.prism(0, 0, 0, 0.7, 0.07, 0.07, 6, C('#a8282a')); hy.lump(0, 0.74, 0, 0.1, 0.08, 0.1, C('#a8282a'), 0, 0, 0.9);
  def('hydrant', hy);
  const ph = new MB(); ph.box(-0.45, 0, -0.45, 0.45, 2.3, 0.45, C('#8a8f93'), 0.8, 1);
  ph.face(C('#2a343a'), [[-0.3, 0.9, 0.46], [0.3, 0.9, 0.46], [0.3, 2.1, 0.46], [-0.3, 2.1, 0.46]]); def('phone', ph);
  const pb = new MB(); pb.box(-0.2, 0.0, -0.2, 0.2, 0.9, 0.2, C('#b3262a'), 0.8, 1); pb.box(-0.23, 0.9, -0.23, 0.23, 1.15, 0.23, C('#b3262a'), 0.9, 1);
  pb.box(-0.25, 1.0, 0.0, 0.25, 1.1, 0.24, C('#222'), 1, 1, false); def('postbox', pb);
  const cb = new MB(); cb.box(-0.45, 0, -0.2, 0.45, 1.45, 0.2, C('#8d8f8e'), 0.8, 1); def('cabinet', cb);
  // Traffic signals (src/signals.js): an Italian head is a dark housing with three round lenses of 25 cm under tunnel visors, red on top, on a white-bordered backplate.
  // Poles stand at the right kerb of the approach and the heads face the traffic coming (+z); on wide roads a mast arm carries one more head over the lanes (Corso
  // Calatafimi has them). The lens vertices carry attributes (lamp 1 red, 2 amber, 3 green, and the lens centre) that the material of the heads (signalMaterial) lights.
  const HOUSING = C('#1c1d20'), SPOLE = C('#5b6165'), LENS = [C('#ff0610'), C('#ffa800'), C('#10e46c')], LAMPS = [];
  const strut = (mb, a, b, r, col) => {   // a hexagonal bar between two points
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]), u = d.map(q => q / L), t = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let v1 = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]]; const l1 = Math.hypot(...v1); v1 = v1.map(q => q / l1);
    const v2 = [u[1] * v1[2] - u[2] * v1[1], u[2] * v1[0] - u[0] * v1[2], u[0] * v1[1] - u[1] * v1[0]];
    const ring = c => { const o = []; for (let i = 0; i < 6; i++) { const q = TAU * i / 6; o.push([c[0] + r * (Math.cos(q) * v1[0] + Math.sin(q) * v2[0]), c[1] + r * (Math.cos(q) * v1[1] + Math.sin(q) * v2[1]), c[2] + r * (Math.cos(q) * v1[2] + Math.sin(q) * v2[2]), 1]); } return o; };
    const A = ring(a), B = ring(b); mb.ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; mb.face(col, [A[i], A[j], B[j], B[i]]); }
    mb.face(col, A); mb.face(col, B); mb.ctr = null;
  };
  // one head: housing bottom at (x, y0, z0), lenses facing +z; hangs from whatever the caller builds behind it
  const sigHead = (mb, x, y0, z0) => {
    mb.box(x - 0.31, y0 - 0.1, z0 - 0.04, x + 0.31, y0 + 1.12, z0 - 0.01, HOUSING, 1, 1, false);   // the backplate, with its white reflective border on the front
    const wf = C('#e8e6dc'), bz = z0 - 0.0085;
    for (const [a, b, c, d] of [[-0.31, -0.1, 0.31, -0.07], [-0.31, 1.09, 0.31, 1.12], [-0.31, -0.07, -0.28, 1.09], [0.28, -0.07, 0.31, 1.09]])
      mb.face(wf, [[x + a, y0 + b, bz], [x + c, y0 + b, bz], [x + c, y0 + d, bz], [x + a, y0 + d, bz]]);
    mb.box(x - 0.17, y0, z0 - 0.01, x + 0.17, y0 + 1.02, z0 + 0.27, HOUSING, 0.85, 1);
    for (let k = 0; k < 3; k++) {
      const yc = y0 + 0.855 - k * 0.345, zf = z0 + 0.275, a0 = LAMPS.length;
      for (let i = 0; i < 8; i++) { const q0 = TAU * i / 8, q1 = TAU * (i + 1) / 8; mb.face(LENS[k], [[x, yc, zf], [x + Math.cos(q0) * 0.125, yc + Math.sin(q0) * 0.125, zf], [x + Math.cos(q1) * 0.125, yc + Math.sin(q1) * 0.125, zf]]); }
      LAMPS.push([mb.p.length / 3 - 24, mb.p.length / 3, k + 1, x, yc, zf]);
      mb.box(x - 0.165, yc + 0.135, z0 + 0.27, x + 0.165, yc + 0.155, z0 + 0.42, HOUSING, 0.9, 1, false);   // the visor over each lens: a roof and two cheeks
      mb.box(x - 0.165, yc - 0.15, z0 + 0.27, x - 0.145, yc + 0.155, z0 + 0.38, HOUSING, 0.9, 1, false);
      mb.box(x + 0.145, yc - 0.15, z0 + 0.27, x + 0.165, yc + 0.155, z0 + 0.38, HOUSING, 0.9, 1, false);
    }
  };
  const sigGeo = mb => {   // the geometry plus the lens attributes
    const g = mb.geo(), n = g.attributes.position.count, id = new Float32Array(n), ctr = new Float32Array(n * 3);
    for (const [a, b, k, cx, cy, cz] of LAMPS) for (let i = a; i < b; i++) { id[i] = k; ctr[i * 3] = cx; ctr[i * 3 + 1] = cy; ctr[i * 3 + 2] = cz; }
    g.setAttribute('lamp', new THREE.BufferAttribute(id, 1)); g.setAttribute('lampC', new THREE.BufferAttribute(ctr, 3)); LAMPS.length = 0; return g;
  };
  const sg = new MB(); sg.prism(0, 0, 0, 3.75, 0.075, 0.06, 6, SPOLE); sg.prism(0, 0, 0, 0.35, 0.1, 0.1, 6, SPOLE);
  sigHead(sg, 0, 2.62, 0.115);
  MODELS.signal = { geo: sigGeo(sg), mat: 'sig', tint: false };
  {   // the mast arm for the wide carriageways: it runs to the left of the traffic (-x), the head hangs near its end
    const L = 6.5, ma = new MB(); ma.prism(0, 0, 0, 5.5, 0.13, 0.085, 8, SPOLE, { k0: 0.7 }); ma.prism(0, 0, 0, 0.5, 0.17, 0.17, 8, SPOLE);
    const top = [0, 5.3, 0], arc = [[-0.15, 5.62, 0], [-0.6, 5.85, 0], [-1.3, 5.93, 0]], end = [-L, 5.93, 0];
    let prev = top; for (const q of [...arc, end]) { strut(ma, prev, q, 0.065, SPOLE); prev = q; }
    const hx = -(L - 0.9);
    strut(ma, [hx, 5.93, 0], [hx, 5.62, 0.02], 0.04, SPOLE);
    sigHead(ma, hx, 4.62, 0.115);   // the head over the lane, hanging below the arm
    sigHead(ma, 0, 2.62, 0.115);    // and the one on the pole
    MODELS.signal_arm = { geo: sigGeo(ma), mat: 'sig', tint: false };
  }
  const bs = new MB(); bs.prism(0, 0, 0, 2.7, 0.04, 0.04, 6, C('#7d8286'));
  bs.box(-0.25, 2.2, -0.02, 0.25, 2.7, 0.02, C('#1f5aa8'), 1, 1); bs.face(C('#f0f0f0'), [[-0.14, 2.3, 0.025], [0.14, 2.3, 0.025], [0.14, 2.55, 0.025], [-0.14, 2.55, 0.025]]);
  def('busstop', bs);
  const sh = new MB();    // small glazed shelter, open to +z
  sh.box(-1.4, 2.3, -0.5, 1.4, 2.4, 0.5, C('#5c6064'), 1, 1);
  for (const x of [-1.35, 1.35]) sh.box(x - 0.03, 0, -0.45, x + 0.03, 2.3, -0.4, C('#5c6064'), 1, 1, false);
  sh.box(-1.35, 0.5, -0.5, 1.35, 2.2, -0.45, C('#9db8c0'), 1, 1, false);
  sh.box(-0.8, 0.42, -0.4, 0.8, 0.46, -0.05, C('#5c6064'), 1, 1);
  def('shelter', sh);
  const mn = new MB(), st = C('#cdc6b4');
  mn.box(-0.7, 0, -0.7, 0.7, 1.2, 0.7, st, 0.7, 1); mn.box(-0.55, 1.2, -0.55, 0.55, 1.6, 0.55, st, 0.9, 1);
  mn.prism(0, 0, 1.6, 3.0, 0.22, 0.14, 6, st); mn.lump(0, 3.15, 0, 0.17, 0.2, 0.15, st, 0, 0.08, 0.85);
  mn.box(-0.3, 2.0, -0.05, -0.1, 2.3, 0.35, st, 1, 1);
  def('monument', mn);
  const ms = new MB(), ws = C('#d8d4c6');    // a statue on a low plinth, for the figures round the Fontana Pretoria (OSM maps each as a monument: the obelisk of `monument` stood 4 m high in the middle of the piazza)
  ms.box(-0.45, 0, -0.45, 0.45, 0.9, 0.45, st, 0.7, 1);
  ms.prism(0, 0, 0.9, 2.1, 0.36, 0.2, 6, ws); ms.box(-0.32, 1.95, -0.13, 0.32, 2.2, 0.13, ws, 0.9, 1);
  ms.lump(0, 2.45, 0, 0.15, 0.18, 0.15, ws, 0, 0.08, 0.85); ms.box(0.32, 1.7, -0.06, 0.42, 2.35, 0.06, ws, 1, 1);
  def('monument_s', ms);
  const fn = new MB(); fn.prism(0, 0, 0, 0.55, 1.5, 1.4, 10, C('#c4bfb0'));
  fn.prism(0, 0, 0.5, 0.5, 1.2, 1.2, 10, C('#3a7c8c'), { cap: true });
  fn.prism(0, 0, 0.5, 1.5, 0.22, 0.12, 8, C('#c4bfb0')); fn.prism(0, 0, 1.5, 1.6, 0.6, 0.5, 10, C('#c4bfb0'));
  def('fountain', fn);
}

// Palms, ficus, pine, orange, generic broadleaf: all in src/treegeo.js (canopies of overlapping clumps, forked trunks, fan and date palms with arching fronds); the palms are double sided (fronds are single sheets)
for (const n of ['palm_fan_a', 'palm_fan_b', 'palm_fan_c', 'palm_date_a', 'palm_date_b']) MODELS[n] = { geo: treeGeo(n), mat: 'dbl', tint: true };

{
  MODELS.ficus = { geo: treeGeo('ficus'), mat: 'dbl', tint: true };      // large Ficus macrophylla / microcarpa
  MODELS.orange = { geo: treeGeo('orange'), mat: 'dbl', tint: true };    // bitter orange / citrus street tree
  MODELS.tree = { geo: treeGeo('tree'), mat: 'dbl', tint: true };        // generic broadleaf (carob, holm oak, olive, jacaranda...)
  MODELS.pine = { geo: treeGeo('stone'), mat: 'dbl', tint: true };       // umbrella pine
  MODELS.plane_bare = { geo: treeGeo('plane_bare'), mat: 'dbl', tint: true };   // the same plane without leaves (winter, and the planes of Via Ernesto Basile and Viale Michelangelo in the photos)
  MODELS.holm = { geo: treeGeo('holm'), mat: 'dbl', tint: true };        // the holm oak: a very dark, dense, lobed dome
  MODELS.plane = { geo: treeGeo('plane'), mat: 'dbl', tint: true };
  MODELS.plane_b = { geo: treeGeo('plane_b'), mat: 'dbl', tint: true };   // a second individual of the planes, the bare planes and the stone pines (picked by position in placeTree): a row of trees is not one tree repeated
  MODELS.plane_bare_b = { geo: treeGeo('plane_bare_b'), mat: 'dbl', tint: true };
  MODELS.jacaranda = { geo: treeGeo('jacaranda'), mat: 'dbl', tint: true };   // lilac in blossom
  MODELS.holm_b = { geo: treeGeo('holm_b'), mat: 'dbl', tint: true };
  MODELS.pine_b = { geo: treeGeo('stone_b'), mat: 'dbl', tint: true };      // n4: the plane tree (Via della Liberta, the old avenues)
  MODELS.aleppo = { geo: treeGeo('aleppo'), mat: 'dbl', tint: true };    // n4: the Aleppo pine (the hills, Monte Gallo, the Favorita)
  MODELS.shrub = { geo: treeGeo('oleander'), mat: 'dbl', tint: false };   // oleander: an upright clump of arching stems with pink flower tips (src/treegeo.js); and the clipped hedge block
  const hd = new MB(); hd.box(-1.5, 0, -0.45, 1.5, 1.1, 0.45, C('#3f6a30'), 0.6, 1); def('hedge', hd, { tint: true });
}

// Market stall: table, crates of produce, square umbrella, tilted canopy; front is +z
{
  const mb = new MB();
  mb.box(-1.0, 0.7, -0.4, 1.0, 0.76, 0.4, C('#8b7455'), 0.9, 1);
  for (const x of [-0.9, 0.9]) mb.box(x - 0.03, 0, -0.35, x + 0.03, 0.7, 0.35, C('#5a4a38'), 1, 1, false);
  const prod = ['#d9701f', '#c0392b', '#7aa23a', '#e0c13a', '#8a2f5a', '#5d8a35'];
  for (let i = 0; i < 4; i++) { const x = -0.75 + i * 0.5; mb.box(x - 0.2, 0.76, -0.3, x + 0.2, 0.9, 0.3, C('#a98a5a'), 0.9, 1, false); mb.frust(0.9, [x - 0.18, -0.26, x + 0.18, 0.26], 1.0, [x - 0.1, -0.2, x + 0.1, 0.2], C(prod[i]), 0.9, 1, false); }
  mb.prism(-1.0, 0.0, 0, 2.6, 0.03, 0.03, 4, C('#6d6d6d'));
  def('stall_table', mb);
  const um = new MB();
  um.prism(0, 0, 0, 2.5, 0.03, 0.03, 4, C('#6d6d6d'));
  um.frust(2.4, [-1.4, -1.4, 1.4, 1.4], 2.9, [-0.05, -0.05, 0.05, 0.05], WHITE, 0.9, 1, false);
  def('umbrella', um, { tint: true, dbl: true });
}

// Cafe table with two chairs (front +z). People are billboard sprites in src/pedestrians.js
{
  const mb = new MB(), tb = C('#d9d4c6'), ch = C('#4b3a2c');
  mb.prism(0, 0, 0.0, 0.7, 0.04, 0.04, 4, C('#2a2a2d'), { cap: false }); mb.prism(0, 0, 0.7, 0.74, 0.38, 0.38, 6, tb, { k0: 0.8 });
  for (const s of [-1, 1]) {
    mb.box(s * 0.62 - 0.2, 0.43, -0.2, s * 0.62 + 0.2, 0.48, 0.2, ch, 0.9, 1, false);
    mb.box(s * 0.62 - 0.16, 0.0, -0.16, s * 0.62 + 0.16, 0.43, 0.16, ch, 1, 1, false);
    mb.box(s * 0.62 - 0.2, 0.48, s > 0 ? -0.2 : 0.16, s * 0.62 + 0.2, 0.9, s > 0 ? -0.16 : 0.2, ch, 0.9, 1, false);
  }
  def('cafe_set', mb);
}

// Shop awning, wall at z=0 and out is +z; two-tone stripes via vertex colour
{
  const mb = new MB();
  const W = 3.0, n = 6, drop = 2.5, top = 3.2, out = 1.3;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + W * i / n, x1 = -W / 2 + W * (i + 1) / n, k = i % 2 ? 0.55 : 1;
    mb.face(WHITE, [[x0, top, 0.02], [x1, top, 0.02], [x1, drop, out], [x0, drop, out]], k);
    mb.face(WHITE, [[x0, drop, out], [x1, drop, out], [x1, drop - 0.25, out], [x0, drop - 0.25, out]], k);
  }
  mb.face(WHITE, [[-W / 2, top, 0.02], [-W / 2, drop, out], [-W / 2, drop, 0.02]], 0.7);
  mb.face(WHITE, [[W / 2, top, 0.02], [W / 2, drop, 0.02], [W / 2, drop, out]], 0.7);
  def('awning', mb, { dbl: true, tint: true });
}


// Rubbish: overflowing cassonetto, bag piles, cardboard, bulky dumped items, litter, market waste
{
  // Palermo's heaps: mostly black, grey and translucent white bags, with blue, pink, green and orange supermarket bags
  const BAGP = [['#1b1b1e', 9], ['#2a2a30', 5], ['#17181b', 5], ['#3a3d44', 3], ['#e1e2dc', 8], ['#eceae2', 6], ['#c9d6de', 4], ['#9fc0d8', 3], ['#d9a0b0', 2], ['#a9d0a8', 2], ['#d9892a', 2], ['#d9c15a', 1], ['#3a6f9a', 2]];
  const BURNP = [['#0f0e0d', 9], ['#191816', 8], ['#24221f', 6], ['#33302b', 4], ['#4f4b44', 3], ['#6a655c', 2], ['#7a3a1f', 1]];
  const pickP = (pal, h) => { let t = 0; for (const [, w] of pal) t += w; let r = h * t; for (const [c, w] of pal) { if ((r -= w) <= 0) return c; } return pal[0][0]; };
  // n lumps on an elliptical mound centred at (ox, oz) on the ground y0, peak height h
  const mound = (mb, n, ox, oz, rx, rz, h, y0, seed, pal = BAGP, rmin = 0.22, rmax = 0.38) => {
    for (let i = 0; i < n; i++) {
      const a = hash3(seed, i, 1) * TAU, rr = Math.sqrt(hash3(seed, i, 2)) * 0.95, r = rmin + hash3(seed, i, 3) * (rmax - rmin);
      const x = ox + Math.cos(a) * rx * rr, z = oz + Math.sin(a) * rz * rr, y = y0 + r * 0.65 + h * Math.pow(1 - rr * rr, 0.9);
      mb.lump(x, y, z, r * 1.25, r * 0.72, r * (0.85 + hash3(seed, i, 5) * 0.3), C(pickP(pal, hash3(seed, i, 4))), 0, 0.34, 0.55, seed + i);
    }
  };
  const bottlesOn = (mb, n, ox, oz, spread, seed) => {
    for (let i = 0; i < n; i++) {
      const x = ox + (hash3(seed, i, 7) - 0.5) * spread * 2, z = oz + (hash3(seed, i, 8) - 0.5) * spread, a = hash3(seed, i, 9) * 3;
      const c = Math.cos(a) * 0.1, sn = Math.sin(a) * 0.1;
      mb.face(C(['#9ec4d4', '#3f7a5a', '#d8d8d0', '#7a4a22'][i % 4]), [[x - c, 0.05, z - sn - 0.03], [x + c, 0.05, z + sn - 0.03], [x + c, 0.05, z + sn + 0.03], [x - c, 0.05, z - sn + 0.03]], 1);
    }
  };
  for (let v = 0; v < 3; v++) { const mb = new MB(); mound(mb, 5 + v * 2, 0, 0, 0.55 + v * 0.2, 0.5 + v * 0.15, 0.4 + v * 0.15, 0, 31 + v * 7); bottlesOn(mb, 2 + v, 0, 0, 0.9 + v * 0.3, 5 + v); def('bag_pile' + v, mb, { dbl: true }); }
  { const mb = new MB(); mound(mb, 13, 0, 0, 1.2, 0.95, 0.85, 0, 91, BAGP, 0.24, 0.4); mb.box(0.6, 0, 0.2, 1.2, 0.45, 0.7, C('#a98558'), 0.75, 1); bottlesOn(mb, 5, 0, 0, 1.4, 17); def('bag_pile3', mb, { dbl: true }); }

  const bo = new MB(), green = C('#4b6a5a');   // overflowing cassonetto, open lid at the back (-z), heap taller than the bin
  bo.frust(0.12, [-0.55, -0.62, 0.55, 0.62], 1.12, [-0.58, -0.66, 0.58, 0.66], green, 0.7, 1);
  const lid = C('#3b4f44');
  bo.face(lid, [[-0.58, 1.12, -0.66], [0.58, 1.12, -0.66], [0.58, 1.75, -1.0], [-0.58, 1.75, -1.0]], 1);
  bo.face(lid, [[-0.58, 1.75, -1.0], [0.58, 1.75, -1.0], [0.58, 1.12, -0.66], [-0.58, 1.12, -0.66]], 0.7);
  mound(bo, 11, 0, -0.05, 0.55, 0.5, 0.85, 1.0, 71, BAGP, 0.2, 0.34);
  mound(bo, 6, 0.1, 0.95, 0.9, 0.5, 0.3, 0, 77, BAGP, 0.2, 0.32);
  bo.face(C('#a98a5a'), [[-0.4, 0.05, 0.9], [0.1, 0.05, 1.05], [0.1, 0.05, 1.4], [-0.4, 0.05, 1.25]], 1);
  def('bin_over', bo, { dbl: true });

  // Signature mega-piles: wall at z=0, out +z. Two dark bins swallowed by a mound taller than they are, spilling
  // across the pavement, with crates, boxes and bulky junk dumped alongside. The burnt ones are black and scorched.
  const megaPile = (name, seed, burnt, extra) => {
    const mb = new MB(), pal = burnt ? BURNP : BAGP;
    const binCols = burnt ? ['#2a2622', '#1f1c19'] : ['#4b6a5a', '#3d4248'];
    [-0.95, 0.45].forEach((x, k) => { mb.frust(0.12, [x - 0.55, 0.15, x + 0.55, 1.4], 1.12, [x - 0.58, 0.12, x + 0.58, 1.44], C(binCols[k]), 0.7, 1); });
    mound(mb, 22, -0.25, 0.8, 1.8, 0.75, 1.05, 1.0, seed, pal, 0.2, 0.36);       // on and around the bins
    mound(mb, 24, 0.1, 1.7, 2.4, 1.0, 0.7, 0, seed + 50, pal, 0.18, 0.36);        // sprawl in front
    mound(mb, 12, 0, 2.5, 2.8, 0.65, 0.1, 0, seed + 99, pal, 0.12, 0.22);          // spill fringe
    const card = burnt ? '#3a342c' : '#a98558';
    mb.box(1.7, 0, 0.5, 2.4, 0.5, 1.1, C(card), 0.75, 1); mb.box(1.8, 0.5, 0.6, 2.3, 0.85, 1.05, C(burnt ? '#2c2822' : '#b8966a'), 0.85, 1);
    mb.box(-2.4, 0, 0.9, -1.8, 0.35, 1.5, C(card), 0.75, 1);
    mb.face(C(card), [[-1.6, 0.012, 2.2], [-0.6, 0.012, 2.4], [-0.5, 0.012, 3.0], [-1.7, 0.012, 2.8]], 1);
    bottlesOn(mb, 6, 0, 2.2, 2.0, seed);
    if (!burnt) { mb.box(-2.2, 0, 1.8, -1.6, 0.26, 2.1, C('#b79a63'), 0.7, 1); mb.box(-2.15, 0.26, 1.82, -1.65, 0.52, 2.08, C('#4f8a4a'), 0.8, 1); }
    if (extra === 'mattress') { mb.frust(0, [2.6, 0.55, 3.5, 0.75], 1.7, [2.6, 0.08, 3.5, 0.28], C('#d8d0bb'), 0.85, 1); }
    if (extra === 'fridge') { mb.box(2.6, 0, 0.3, 3.25, 1.7, 0.95, C(burnt ? '#2a2723' : '#e4e3dc'), 0.8, 1); mb.box(-3.0, 0, 1.3, -2.6, 0.47, 1.7, C('#6d4c30'), 0.9, 1); mb.box(-3.0, 0.47, 1.3, -2.6, 0.95, 1.36, C('#6d4c30'), 0.9, 1); }
    if (extra === 'sofa') { mb.box(2.4, 0, 0.3, 3.9, 0.45, 1.2, C(burnt ? '#26221e' : '#7a3b3b'), 0.7, 1); mb.box(2.4, 0.45, 0.3, 3.9, 0.95, 0.5, C(burnt ? '#26221e' : '#7a3b3b'), 0.8, 1); }
    if (burnt) { // scorch mark on the ground and a few glowing embers
      const P = []; for (let i = 0; i < 10; i++) { const a = i * TAU / 10, rr = 2.4 + hash3(seed, i, 3) * 1.0; P.push([Math.cos(a) * rr * 1.15 - 0.1, 0.013, 1.5 + Math.sin(a) * rr * 0.7]); }
      mb.face(C('#0c0b0a'), P.slice().reverse(), 1);
      for (const [x, y, z] of [[0.3, 0.3, 1.9], [-0.6, 0.5, 1.4], [0.9, 0.2, 2.3]]) mb.lump(x, y, z, 0.1, 0.06, 0.1, C('#b5421c'), 0, 0.1, 0.9, seed);
    }
    def(name, mb, { dbl: true });
  };
  megaPile('mega0', 211, false, ''); megaPile('mega1', 233, false, 'mattress'); megaPile('mega2', 257, false, 'fridge');
  megaPile('mega_burnt0', 281, true, 'sofa'); megaPile('mega_burnt1', 303, true, '');

  const cb = new MB(), paper = C('#a98558'), paper2 = C('#b8966a');   // cardboard from the shops
  cb.box(-0.45, 0, -0.3, 0.15, 0.5, 0.25, paper, 0.75, 1); cb.box(-0.4, 0.5, -0.25, 0.1, 0.85, 0.15, paper2, 0.85, 1); cb.box(0.2, 0, -0.2, 0.7, 0.35, 0.25, paper2, 0.75, 1);
  cb.face(paper2, [[-0.5, 0.01, 0.4], [0.5, 0.01, 0.5], [0.5, 0.01, 0.95], [-0.45, 0.01, 0.8]], 1); cb.face(paper, [[0.55, 0.01, 0.15], [1.1, 0.01, 0.3], [1.0, 0.01, 0.7], [0.5, 0.01, 0.55]], 0.9);
  cb.face(paper, [[-0.6, 0.02, -0.3], [-0.6, 1.0, -0.2], [-0.5, 1.0, 0.0], [-0.5, 0.02, -0.1]], 0.9);
  def('cardboard', cb, { dbl: true });

  const mt = new MB();    // mattress leaning on a wall (wall at z=0, out +z)
  mt.frust(0, [-0.45, 0.5, 0.45, 0.7], 1.9, [-0.45, 0.05, 0.45, 0.25], C('#d8d0bb'), 0.85, 1);
  for (const y of [0.4, 0.9, 1.4]) mt.face(C('#8c8470'), [[-0.45, y, 0.5 - y * 0.236 + 0.21], [0.45, y, 0.5 - y * 0.236 + 0.21], [0.45, y + 0.05, 0.5 - (y + 0.05) * 0.236 + 0.21], [-0.45, y + 0.05, 0.5 - (y + 0.05) * 0.236 + 0.21]], 1);
  def('dump_mattress', mt);
  const fr = new MB();    // dead fridge
  fr.box(-0.32, 0, -0.32, 0.32, 1.65, 0.32, C('#e4e3dc'), 0.8, 1); fr.box(0.2, 0.9, 0.32, 0.26, 1.4, 0.38, C('#8a8a8a'), 1, 1, false); fr.box(-0.32, 1.1, 0.32, 0.32, 1.12, 0.325, C('#a9a8a0'), 1, 1, false);
  def('dump_fridge', fr);
  const chr = new MB(), wd = C('#6d4c30');
  chr.box(-0.22, 0.42, -0.22, 0.22, 0.47, 0.22, wd, 0.9, 1); chr.box(-0.22, 0.47, -0.22, 0.22, 0.95, -0.18, wd, 0.9, 1);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) chr.box(x - 0.02, 0, z - 0.02, x + 0.02, 0.42, z + 0.02, wd, 1, 1, false);
  def('dump_chair', chr);
  const sf = new MB(), fab = C('#7a3b3b');   // sofa on its back
  sf.box(-0.9, 0.0, -0.4, 0.9, 0.45, 0.45, fab, 0.7, 1); sf.box(-0.9, 0.45, -0.4, 0.9, 0.9, -0.2, fab, 0.8, 1); sf.box(-0.9, 0.45, -0.4, -0.7, 0.7, 0.45, fab, 0.8, 1); sf.box(0.7, 0.45, -0.4, 0.9, 0.7, 0.45, fab, 0.8, 1);
  def('dump_sofa', sf);
  const wr = new MB();    // broken scooter lying on its side, no front wheel
  wr.box(-0.5, 0.0, -0.2, 0.4, 0.3, 0.2, C('#9a2a2a'), 0.7, 1, false); wr.box(0.2, 0.0, -0.2, 0.55, 0.12, 0.2, C('#3a3a3e'), 0.9, 1, false);
  wr.prism(-0.7, 0.05, 0, 0.12, 0.2, 0.2, 5, TYRE); wr.box(0.5, 0.1, -0.35, 0.6, 0.25, 0.35, BLACKMET, 1, 1, false); wr.box(-0.3, 0.3, -0.1, 0.0, 0.4, 0.1, C('#1d1d20'), 0.9, 1, false);
  def('dump_wreck', wr, { dbl: true });

  // litter clusters: papers, bottles, cans, butts. Flat quads and tiny boxes only.
  const quad = (mb, x, z, w, d, rot, col) => { const c = Math.cos(rot), s = Math.sin(rot); const P = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([a, b]) => [x + a * c - b * s, 0.015, z + a * s + b * c]); mb.face(col, P, 1); };
  const litter = (name, n, kinds) => {
    const mb = new MB();
    for (let i = 0; i < n; i++) {
      const x = (hash3(i, name.length, 5) - 0.5) * 1.6, z = (hash3(i, name.length, 6) - 0.5) * 0.9, rot = hash3(i, name.length, 7) * TAU, k = kinds[i % kinds.length];
      if (k === 'paper') quad(mb, x, z, 0.1 + hash3(i, 1, 9) * 0.1, 0.07, rot, C(['#e6e3d8', '#cfd6dc', '#d9c9a0'][i % 3]));
      else if (k === 'bottle') mb.box(x - 0.1, 0.0, z - 0.03, x + 0.1, 0.06, z + 0.03, C(['#9ec4d4', '#3f7a5a', '#d8d8d0'][i % 3]), 0.8, 1, false);
      else if (k === 'can') mb.box(x - 0.04, 0.0, z - 0.04, x + 0.04, 0.12, z + 0.04, C(['#b8b8b2', '#b3262a', '#2f5f93'][i % 3]), 0.8, 1, false);
      else if (k === 'butt') quad(mb, x, z, 0.022, 0.008, rot, C('#e9e5d8'));
      else if (k === 'leaf') quad(mb, x, z, 0.14, 0.1, rot, C(['#5f8a3a', '#7aa04a', '#4c7a34'][i % 3]));
      else if (k === 'crate') mb.box(x - 0.25, 0, z - 0.17, x + 0.25, 0.2, z + 0.17, C(['#b79a63', '#4f8a4a', '#c0472f'][i % 3]), 0.7, 1);
      else if (k === 'peel') mb.lump(x, 0.04, z, 0.1, 0.05, 0.08, C(['#d98a2a', '#e0c13a', '#8a3a2a'][i % 3]), 0, 0.2, 0.8, i);
    }
    def(name, mb, { dbl: true });
  };
  litter('litter0', 7, ['paper', 'bottle', 'paper', 'can', 'paper', 'butt', 'paper']);
  litter('litter1', 7, ['paper', 'paper', 'can', 'butt', 'paper', 'bottle', 'paper']);
  litter('litter_cafe', 12, ['butt', 'butt', 'paper', 'butt', 'can', 'butt', 'paper', 'butt', 'butt', 'bottle', 'butt', 'paper']);
  litter('mwaste0', 14, ['leaf', 'leaf', 'crate', 'paper', 'leaf', 'peel', 'leaf', 'crate', 'leaf', 'paper', 'peel', 'leaf', 'leaf', 'paper']);
  litter('mwaste1', 12, ['crate', 'leaf', 'leaf', 'peel', 'paper', 'leaf', 'crate', 'peel', 'leaf', 'leaf', 'paper', 'leaf']);
  const mc = new MB();   // stacked market crates
  mc.box(-0.3, 0, -0.2, 0.3, 0.28, 0.2, C('#b79a63'), 0.7, 1); mc.box(-0.3, 0.28, -0.2, 0.3, 0.56, 0.2, C('#4f8a4a'), 0.8, 1); mc.box(-0.25, 0.56, -0.18, 0.3, 0.84, 0.2, C('#b79a63'), 0.85, 1);
  mc.box(0.4, 0, -0.2, 0.9, 0.26, 0.2, C('#c0472f'), 0.7, 1);
  def('mcrates', mc);
}

// ------------------------------------------------------------------ materials / instancing
// The billboards' material: one atlas of the twelve adverts (src/adverts.js, 2048 x 768, 8.4 MB with its mipmaps), painted once and freed after upload like the other painted
// textures. The instance colour's red channel is the advert (posterCol); uv says the part (poster 0..1, frame -1, lamp lens -2). At night (NIGHT.win, daynight.js) the lamps
// glow and the poster takes a soft light, stronger at the top under them. No extra draw: one InstancedMesh per props cell, as before.
const posterCol = k => new THREE.Color((k + 0.5) / 16, 0, 0);
function posterMaterial() {
  const cv = document.createElement('canvas'); cv.width = POSTER_COLS * CELL_W; cv.height = POSTER_ROWS * CELL_H;
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const paint = () => { paintAtlas(cv.getContext('2d'), cv.width, cv.height); map.needsUpdate = true; freeCanvas(map, (g, w, h) => paintAtlas(g, w, h)); };
  // Painted and uploaded when the first billboard is placed (userData.need, called where a tile's props put one), not at the start: the billboards stand along the fast
  // roads only, and until one is near the atlas would hold 8 MB of the GPU's memory for nothing. A tile is built over many frames, so the atlas
  // is there before its billboards are drawn.
  let asked = false;
  const need = () => {
    if (asked) return; asked = true;
    // the headlines are Impact; a device without it uses Barlow Condensed, which the page loads (src/ui.css): wait for it there, a little
    const pc = document.createElement('canvas'); pc.width = pc.height = 1;
    const probe = pc.getContext('2d'); probe.font = '40px monospace'; const a = probe.measureText('MWMWiiii').width; probe.font = '40px Impact, monospace';
    if (probe.measureText('MWMWiiii').width !== a || !document.fonts?.load) paint();
    else Promise.race([document.fonts.load('700 40px "Barlow Condensed"'), new Promise(r => setTimeout(r, 4000))]).then(paint, paint);
  };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.75, metalness: 0.0 });
  m.userData.need = need;
  m.onBeforeCompile = sh => {
    sh.uniforms.uWin = NIGHT.win;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vPart;')
      .replace('#include <color_vertex>', `vColor = vec4( 1.0 );
#ifdef USE_COLOR
vColor.rgb *= color;
#endif`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
{ float k = floor( instanceColor.r * 16.0 ); vec2 cell = vec2( mod( k, ${POSTER_COLS}.0 ), floor( k / ${POSTER_COLS}.0 ) );
  vPart = uv.x < -1.5 ? -2.0 : uv.x < -0.5 ? -1.0 : uv.y;
  vMapUv = uv.x < -0.5 ? vec2( -1.0 ) : vec2( ( cell.x + 0.002 + uv.x * 0.996 ) / ${POSTER_COLS}.0, 1.0 - ( cell.y + 0.004 + ( 1.0 - uv.y ) * 0.992 ) / ${POSTER_ROWS}.0 ); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWin;\nvarying float vPart;')
      .replace('#include <map_fragment>', `vec4 sampledDiffuseColor = texture2D( map, max( vMapUv, 0.0 ) );
if ( vPart >= 0.0 ) diffuseColor *= sampledDiffuseColor;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float nk = smoothstep( 0.0, 0.08, uWin );
  if ( vPart < -1.5 ) totalEmissiveRadiance += vec3( 1.0, 0.86, 0.62 ) * 2.5 * nk;
  else if ( vPart >= 0.0 ) totalEmissiveRadiance += diffuseColor.rgb * ( 0.25 + 0.35 * vPart ) * nk; }`);
  };
  m.customProgramCacheKey = () => 'billboard-poster';
  return m;
}
// The supermarkets' material (generate, 2b): the atlas of the sixteen parody signs (src/supermarkets.js, 1024 x 1024, 5.6 MB with its mipmaps), made with the first tile that
// has a store and freed after upload like the posters. uv inside 0..1 reads the atlas; uv.x -1 is a part in its vertex colour that glows warm by uv.y at night (the shop
// windows), uv.x -2 one that glows in its own colour by uv.y (the bands, the sign boxes). The sign faces glow as a backlit sign does.
let SIGN_MAT = null;
function signMat() {
  if (SIGN_MAT) return SIGN_MAT;
  const cv = document.createElement('canvas'); cv.width = SIGN_COLS * SIGN_W; cv.height = SIGN_ROWS * SIGN_H;
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  paintSigns(cv.getContext('2d'), cv.width, cv.height); map.needsUpdate = true; freeCanvas(map, (g, w, h) => paintSigns(g, w, h));   // (the fonts are the page's own by the time a tile builds)
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.6, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWin = NIGHT.win;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWin;')
      .replace('#include <map_fragment>', `vec4 sampledDiffuseColor = texture2D( map, max( vMapUv, 0.0 ) );
if ( vMapUv.x >= 0.0 ) diffuseColor *= sampledDiffuseColor;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float nk = smoothstep( 0.0, 0.08, uWin );
  if ( vMapUv.x >= 0.0 ) totalEmissiveRadiance += diffuseColor.rgb * 0.55 * nk;
  else if ( vMapUv.x > -1.5 ) totalEmissiveRadiance += vec3( 1.0, 0.82, 0.58 ) * vMapUv.y * nk;
  else totalEmissiveRadiance += diffuseColor.rgb * vMapUv.y * nk; }`);
  };
  m.customProgramCacheKey = () => 'supermarket-sign';
  return SIGN_MAT = m;
}
const MATS = {
  std: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }),
  dbl: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }),
  veh: makeMaterial(),   // the traffic material: instance colour tints only the paintwork
  sig: signalMaterial(),   // traffic signal heads: the red channel of the instance colour says which lens is lit
  poster: posterMaterial(),   // the billboards: the red channel of the instance colour says which advert
};

// Beach (Mondello lido and the other sand strips): striped umbrella, sunbed, summer kiosk
{
  const um = new MB(), pole = C('#e9e6dc');
  um.prism(0, 0, 0, 2.3, 0.025, 0.025, 4, pole);
  const apex = [0, 2.55, 0], rr = 1.45, n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU + 0.2, a1 = (i + 1) / n * TAU + 0.2, k = i % 2 ? 0.42 : 1;
    um.face(WHITE, [apex, [Math.cos(a0) * rr, 2.05, Math.sin(a0) * rr], [Math.cos(a1) * rr, 2.05, Math.sin(a1) * rr]].reverse(), k);
  }
  def('beach_umbrella', um, { tint: true, dbl: true });
  const sb = new MB(), fr = C('#f1eee6');
  sb.box(-0.32, 0.2, -0.45, 0.32, 0.27, 0.5, fr, 0.8, 1, false);                  // mattress
  sb.face(fr, [[-0.32, 0.27, -0.45], [0.32, 0.27, -0.45], [0.32, 0.62, -0.78], [-0.32, 0.62, -0.78]], 0.95);   // back rest
  def('sunbed', sb, { tint: true, dbl: true });
  const ks = new MB();   // lido kiosk: pale box with a striped awning over the hatch
  ks.box(-1.6, 0, -1.2, 1.6, 2.5, 1.2, C('#eadfc6'), 0.75, 1);
  ks.box(-1.7, 2.5, -1.3, 1.7, 2.65, 1.3, C('#b5654a'), 0.8, 1, false);
  ks.box(-1.1, 0.95, 1.2, 1.1, 1.75, 1.23, C('#2c2b2e'), 1, 1, false);               // hatch
  ks.box(-1.2, 0.9, 1.2, 1.2, 0.98, 1.6, C('#8b7455'), 0.9, 1, false);                // counter
  for (let i = 0; i < 6; i++) { const x0 = -1.5 + i * 0.5, x1 = x0 + 0.5; ks.face(WHITE, [[x0, 2.25, 1.2], [x1, 2.25, 1.2], [x1, 1.95, 1.9], [x0, 1.95, 1.9]], i % 2 ? 0.45 : 1); }
  def('kiosk', ks, { tint: true, dbl: true });
}

// ------------------------------------------------------------------ collision specs
// c: circles [ox, oz, r] in model space (z forward). kind: park (a parked car), veh (launchable), scooter, bin, tree, bend, solid.
// thr: closing speed in m/s above which the thing breaks, flies or falls. he/hc: body half extents and centre height for flights.
const CAR_HE = (W, L) => [W / 2, 0.75, L / 2];
const SPECS = {
  // parked cars: yeeted like the traffic (src/traffic.js launch / stepFly), at 4 m/s of closing speed; below that they are pushed. L, W as the traffic type.
  panda: { kind: 'park', c: [[0, 1.0, 0.85], [0, -1.0, 0.85]], m: 0.95, thr: 4, L: 3.65, W: 1.64 },
  punto: { kind: 'park', c: [[0, 1.2, 0.9], [0, -1.2, 0.9]], m: 1.1, thr: 4, L: 4.06, W: 1.69 },
  smart: { kind: 'park', c: [[0, 0.55, 0.8], [0, -0.55, 0.8]], m: 0.8, thr: 4, L: 2.69, W: 1.56 },
  van: { kind: 'park', c: [[0, 1.3, 0.95], [0, 0, 0.95], [0, -1.3, 0.95]], m: 2.0, thr: 4, L: 4.45, W: 1.82 },
  ape: { kind: 'park', c: [[0, 0.8, 0.78], [0, -0.7, 0.78]], m: 0.8, thr: 4, L: 3.2, W: 1.4 },       // the Ape and the Apetaxi are parked-car yeets too
  apetaxi: { kind: 'park', c: [[0, 0.8, 0.78], [0, -0.7, 0.78]], m: 0.8, thr: 4, L: 3.2, W: 1.4 },
  scooter: { kind: 'scooter', c: [[0, 0.35, 0.4], [0, -0.35, 0.4]], m: 0.28, thr: 1.2, fly: 7.5, he: [0.35, 0.55, 0.9], hc: 0.55 },
  // light things: tip or bend below `fly`, knocked flying above it (yeet: same balloon rule as the other flying props); they lie where they land and the tile puts them back after a while
  bin_big: { kind: 'bin', c: [[0, 0, 0.78]], m: 0.9, thr: 2.6, fly: 6, bags: 4, he: [0.45, 0.55, 0.45], hc: 0.55, ghost: true },
  bin_over: { kind: 'bin', c: [[0, 0, 0.78]], m: 0.9, thr: 2.2, fly: 6, bags: 9, he: [0.5, 0.55, 0.5], hc: 0.55, ghost: true },
  bin_small: { kind: 'bend', c: [[0, 0, 0.24]], thr: 3, fly: 5.5, m: 0.3, he: [0.2, 0.45, 0.2], hc: 0.45, ghost: true, tilt: 1.57, H: 0.9 },
  fontanella: { kind: 'bend', c: [[0, 0, 0.26]], thr: 5, tilt: 1.3, H: 1.1 },
  ficus: { kind: 'tree', c: [[0, 0, 1.1]], thr: 13.9, H: 9, crown: 4.8 },
  tree: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 6, crown: 3.4 },
  orange: { kind: 'tree', c: [[0, 0, 0.22]], thr: 8.3, H: 4.5, crown: 1.8 },
  pine: { kind: 'tree', c: [[0, 0, 0.45]], thr: 11, H: 11, crown: 4.5 },
  plane: { kind: 'tree', c: [[0, 0, 0.4]], thr: 12, H: 11, crown: 4.0 },
  plane_bare: { kind: 'tree', c: [[0, 0, 0.36]], thr: 12, H: 7, crown: 3.4 },
  holm: { kind: 'tree', c: [[0, 0, 0.5]], thr: 11, H: 8.5, crown: 4.8 },
  plane_b: { kind: 'tree', c: [[0, 0, 0.4]], thr: 12, H: 11, crown: 4.0 },
  plane_bare_b: { kind: 'tree', c: [[0, 0, 0.36]], thr: 12, H: 7, crown: 3.4 },
  pine_b: { kind: 'tree', c: [[0, 0, 0.45]], thr: 11, H: 11, crown: 4.5 },
  jacaranda: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 7, crown: 3.4 },
  holm_b: { kind: 'tree', c: [[0, 0, 0.5]], thr: 11, H: 8.5, crown: 4.8 },
  aleppo: { kind: 'tree', c: [[0, 0, 0.3]], thr: 10, H: 8.5, crown: 2.6 },
  palm_fan_a: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 9, crown: 2.5 },
  palm_fan_b: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 13, crown: 2.5 },
  palm_fan_c: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.0, H: 6.5, crown: 2.5 },
  palm_date_a: { kind: 'tree', c: [[0, 0, 0.55]], thr: 11, H: 5, crown: 2.5 },
  palm_date_b: { kind: 'tree', c: [[0, 0, 0.52]], thr: 11, H: 7.5, crown: 2.5 },
  lamp_pole: { kind: 'bend', c: [[0, 0, 0.2]], thr: 7, tilt: 1.05, H: 9 },
  billboard: { kind: 'solid', c: [[-2.2, 0, 0.3], [2.2, 0, 0.3]] },
  candelabra: { kind: 'bend', c: [[0, 0, 0.25]], thr: 7.5, tilt: 0.9, H: 4 },
  utility_pole: { kind: 'bend', c: [[0, 0, 0.2]], thr: 10, tilt: 0.7, H: 9.4 },   // a pole of the power line: heavier than a lamp; the wires stay where they are
  signal: { kind: 'bend', c: [[0, 0, 0.2]], thr: 6.5, tilt: 1.1, H: 3.5 },
  signal_arm: { kind: 'bend', c: [[0, 0, 0.25]], thr: 8, tilt: 0.95, H: 5.5 },   // the mast arm: a taller, heavier pole
  bollard: { kind: 'bend', c: [[0, 0, 0.13]], thr: 5.5, tilt: 1.5, H: 0.8 },
  busstop: { kind: 'bend', c: [[0, 0, 0.12]], thr: 4.5, fly: 8, m: 0.4, he: [0.25, 1.35, 0.25], hc: 1.35, ghost: true, tilt: 1.0, H: 2.7 },   // a sign on a thin pole: light
  bench: { kind: 'object', c: [[-0.7, 0, 0.32], [0.7, 0, 0.32]], thr: 3.5, m: 1.0, he: [0.9, 0.45, 0.25], hc: 0.45, ghost: true },
  stall_table: { kind: 'object', c: [[-0.65, 0, 0.5], [0.65, 0, 0.5]], thr: 2.5, m: 0.8, he: [0.9, 0.45, 0.5], hc: 0.45, ghost: true },
  cafe_set: { kind: 'object', c: [[0, 0, 0.55]], thr: 2.2, m: 0.6, he: [0.7, 0.45, 0.7], hc: 0.45, ghost: true },     // table and plastic chairs
  umbrella: { kind: 'object', c: [[0, 0, 0.15]], thr: 2.2, m: 0.4, he: [0.5, 1.0, 0.5], hc: 1.0, ghost: true },       // sits over a cafe set or a stall table: they go together
  sunbed: { kind: 'object', c: [[0, 0, 0.5]], thr: 1.5, m: 0.4, he: [0.35, 0.25, 0.9], hc: 0.25, ghost: true },
  beach_umbrella: { kind: 'object', c: [[0, 0, 0.2]], thr: 2.5, m: 0.4, he: [0.5, 1.1, 0.5], hc: 1.1, ghost: true },
  shelter: { kind: 'solid', c: [[-1.0, 0, 0.6], [0, 0, 0.6], [1.0, 0, 0.6]] },   // glazed bus shelter: heavy
  shrub: { kind: 'soft', c: [[0, 0, 0.6]], thr: 2.5, H: 1.2, crown: 0.9 },       // a bush: the lapa goes through it, slowed, in a puff of leaves
  hydrant: { kind: 'solid', c: [[0, 0, 0.18]] },
  phone: { kind: 'solid', c: [[0, 0, 0.5]] },
  cabinet: { kind: 'solid', c: [[-0.3, 0, 0.3], [0.3, 0, 0.3]] },
  postbox: { kind: 'solid', c: [[0, 0, 0.28]] },
  monument: { kind: 'solid', c: [[0, 0, 0.85]] },
  monument_s: { kind: 'solid', c: [[0, 0, 0.85]] },
  kiosk: { kind: 'solid', c: [[-0.8, 0, 1.1], [0.8, 0, 1.1]] },
  hedge: { kind: 'hedge', c: [[-1.0, 0, 0.5], [0, 0, 0.5], [1.0, 0, 0.5]], thr: 1.8, H: 1.1, crown: 1.5 },   // a clipped hedge block (the Libertà ones): bursts into leaves and clumps above 1.8 m/s (effective, see src/fences.js) and leaves a gap for the session
  fountain: { kind: 'solid', c: [[0, 0, 1.6]] },
  smk_totem: { kind: 'solid', c: [[-0.9, 0, 0.2], [0.9, 0, 0.2]] },
  // rubbish: soft things burst into debris, loose junk is launched like a light prop
  bags: { kind: 'bags', c: [[0, 0, 0.55]], thr: 0.9, n: 3, slow: 0.03 },
  bag_pile0: { kind: 'bags', c: [[0, 0, 0.75]], thr: 0.9, n: 3, slow: 0.03 },
  bag_pile1: { kind: 'bags', c: [[0, 0, 0.8]], thr: 0.9, n: 4, slow: 0.04 },
  bag_pile2: { kind: 'bags', c: [[0, 0, 0.85]], thr: 0.9, n: 5, slow: 0.05 },
  bag_pile3: { kind: 'bags', c: [[0, 0, 1.1]], thr: 0.9, n: 7, slow: 0.07, remain: 0.25 },
  mega0: { kind: 'bags', c: [[0, 1.0, 1.5]], thr: 0.9, n: 16, slow: 0.14, mega: true, remain: 0.4 },
  mega1: { kind: 'bags', c: [[0, 1.0, 1.5]], thr: 0.9, n: 16, slow: 0.14, mega: true, remain: 0.4 },
  mega2: { kind: 'bags', c: [[0, 1.0, 1.5]], thr: 0.9, n: 16, slow: 0.14, mega: true, remain: 0.4 },
  mega_burnt0: { kind: 'bags', c: [[0, 1.0, 1.5]], thr: 0.9, n: 14, slow: 0.14, mega: true, remain: 0.5 },
  mega_burnt1: { kind: 'bags', c: [[0, 1.0, 1.5]], thr: 0.9, n: 14, slow: 0.14, mega: true, remain: 0.5 },
  cardboard: { kind: 'board', c: [[0.1, 0.2, 0.75]], thr: 0.9 },
  litter0: { kind: 'bits', c: [[0, 0, 0.8]], thr: 1.6, bottles: 2 },
  litter1: { kind: 'bits', c: [[0, 0, 0.8]], thr: 1.6, bottles: 2 },
  litter_cafe: { kind: 'bits', c: [[0, 0, 0.8]], thr: 1.6 },
  mwaste0: { kind: 'bits', c: [[0, 0, 0.9]], thr: 1.6, bottles: 1 },
  mwaste1: { kind: 'bits', c: [[0, 0, 0.9]], thr: 1.6, bottles: 1 },
  mcrates: { kind: 'object', c: [[0.2, 0, 0.6]], thr: 1.2, m: 0.5, he: [0.5, 0.42, 0.25], hc: 0.42, ghost: true },
  dump_mattress: { kind: 'object', c: [[0, 0.4, 0.55]], thr: 0.9, m: 0.6, he: [0.45, 0.95, 0.2], hc: 0.95, ghost: true },
  dump_fridge: { kind: 'object', c: [[0, 0, 0.45]], thr: 3.2, m: 1.2, he: [0.32, 0.83, 0.32], hc: 0.83, ghost: true },
  dump_chair: { kind: 'object', c: [[0, 0, 0.3]], thr: 0.9, m: 0.2, he: [0.22, 0.47, 0.22], hc: 0.47, ghost: true },
  dump_sofa: { kind: 'object', c: [[0, 0, 0.9]], thr: 2.5, m: 1.0, he: [0.9, 0.45, 0.4], hc: 0.45, ghost: true },
  dump_wreck: { kind: 'object', c: [[0, 0, 0.6]], thr: 1.6, m: 0.3, he: [0.6, 0.2, 0.35], hc: 0.2, ghost: true },
};
const TREE_VARIANT = new Set(['plane', 'plane_bare', 'pine', 'holm']);   // models with a second individual (name + '_b')
const TREE_LIKE = new Set(['jacaranda', 'holm_b', 'plane_b', 'plane_bare_b', 'pine_b', 'ficus', 'tree', 'holm', 'orange', 'pine', 'plane', 'plane_bare', 'aleppo', 'palm_fan_a', 'palm_fan_b', 'palm_fan_c', 'palm_date_a', 'palm_date_b']);
const SCALE_R = new Set(['jacaranda', 'holm_b', 'plane_b', 'plane_bare_b', 'pine_b', 'shrub', 'ficus', 'tree', 'holm', 'orange', 'pine', 'plane', 'plane_bare', 'aleppo', 'palm_fan_a', 'palm_fan_b', 'palm_fan_c', 'palm_date_a', 'palm_date_b']);


function makePhysics(env) {
  const { inB, gy, scene } = env;
  let nColl = 0;
  const PR = 0.74, PAX = 0.72, I_YAW = 1.7, E = 0.25, G = 9.8;
  const up = new THREE.Vector3(0, 1, 0), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), sA = new THREE.Vector3();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const cellIJ = (i, j) => (i + 4096) * 8192 + (j + 4096);   // whole city: x within +-6.7 km, z within -12 .. +5.6 km
  const cellK = (x, z) => cellIJ(Math.floor(x / 8), Math.floor(z / 8));
  const grid = new Map();
  const gAdd = c => { const k = cellK(c.x, c.z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); c.gk = k; };
  const gDel = c => { const a = grid.get(c.gk); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } };
  let simT = 0, tick = 0, lastShout = -9, camPos = null;
  const dirty = new Set(), dyn = [], broken = new Set(), goneHedge = new Set();   // goneHedge: hedge blocks burst this session, by position (they survive the tile unloading)
  const hedgeKey = c => Math.round(c.x0 * 4) + ',' + Math.round(c.z0 * 4);
  const stats = { yeeted: 0, tipped: 0, trees: 0, bent: 0, scooters: 0 };

  // ---- debris pools: bags, cardboard sheets, bottles (all stay until their owner resets), leaves and litter bits (expire)
  // `count` starts at 0 and grows with what has been spawned (spawnIdx): nothing is drawn for an empty pool, instead of every instance at scale 0 through the vertex shader
  const mkPool = (geo, n, castShadow, tinted = true) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.9, side: THREE.DoubleSide }), n);
    im.frustumCulled = false; im.castShadow = castShadow; im.receiveShadow = true; im.count = 0; im.userData.cap = n;
    mA.makeScale(0, 0, 0); for (let i = 0; i < n; i++) { im.setMatrixAt(i, mA); if (tinted) im.setColorAt(i, new THREE.Color(1, 1, 1)); }
    scene.add(im); return im;
  };
  const spawnIdx = (im, n) => { const i = n % im.userData.cap; if (i >= im.count) im.count = i + 1; return i; };
  const rnd = Math.random, r2 = (a, b) => a + rnd() * (b - a);
  const bagGeo = (() => { const g = new THREE.IcosahedronGeometry(0.2, 0); g.scale(1.15, 0.8, 1); return g; })();
  const boardGeo = new THREE.BoxGeometry(0.7, 0.025, 0.5);
  const bottleGeo = (() => { const g = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 5); g.rotateZ(Math.PI / 2); return g; })();   // lies along x
  const leafGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, -0.08, 0.12, 0, -0.08, 0.12, 0, 0.1, -0.12, 0, -0.08, 0.12, 0, 0.1, -0.12, 0, 0.1], 3)); g.computeVertexNormals(); return g; })();
  const leafPool = mkPool(leafGeo, 700, false);
  const leaves = []; let leafN = 0;
  const BAGC = ['#1b1b1e', '#2a2a30', '#d8d9d4', '#e6e6e0', '#9fc0d8', '#d9a0b0', '#9ec9a0', '#d9892a', '#c9c3b0', '#3a6f9a', '#17181b'].map(h => new THREE.Color(h));
  const BOARDC = ['#a98558', '#b8966a', '#9a7a4e'].map(h => new THREE.Color(h));
  const BOTC = ['#9ec4d4', '#3f7a5a', '#d8d8d0', '#7a4a22'].map(h => new THREE.Color(h));
  const LEAFC = ['#4a7a30', '#5f8a3a', '#7aa04a', '#3f6a2a'].map(h => new THREE.Color(h));
  const BITC = ['#e6e3d8', '#cfd6dc', '#d9c9a0', '#b8966a', '#e9e5d8', '#9ec4d4'].map(h => new THREE.Color(h));
  const mkDebris = (geo, n, kind, cast) => ({ im: mkPool(geo, n, cast), items: [], n: 0, dirty: false, kind, cols: kind === 'bag' ? BAGC : kind === 'board' ? BOARDC : BOTC });
  const DEB = { bag: mkDebris(bagGeo, 560, 'bag', false), board: mkDebris(boardGeo, 160, 'board', false), bottle: mkDebris(bottleGeo, 140, 'bottle', false) };
  const spawnDeb = (kind, c, init) => {
    const D2 = DEB[kind], idx = spawnIdx(D2.im, D2.n++); let it = D2.items.find(q => q.idx === idx); if (!it) D2.items.push(it = { idx });
    Object.assign(it, { rest: false, hidden: false, owner: c, tilt: 0, tv: 0, spin: 0, roll: 0, rot: rnd() * 6.28, s: 1 }, init);
    D2.im.setColorAt(idx, init.col || D2.cols[(rnd() * D2.cols.length) | 0]); D2.im.instanceColor.needsUpdate = true; D2.dirty = true; return it;
  };
  // bursts fly away from the lapa: (nx,nz) points from the prop to the car, v is the car's velocity
  const burstV = (nx, nz, vc, k, pc) => [-nx * vc * k + pc.vx * 0.3 + (rnd() - 0.5) * 3, -nz * vc * k + pc.vz * 0.3 + (rnd() - 0.5) * 3];
  const spawnBags = (c, n, nx, nz, vc = 3, pc = { vx: 0, vz: 0 }, small = false) => {
    for (let i = 0; i < n; i++) {
      const [vx, vz] = burstV(nx, nz, vc, 0.35 + rnd() * 0.5, pc);
      spawnDeb('bag', c, { x: c.x + (rnd() - 0.5) * 1.2, y: gy(c.x, c.z) + 0.5 + rnd() * 0.7, z: c.z + (rnd() - 0.5) * 1.2, vx, vy: 2 + rnd() * 3.5, vz, s: small ? r2(0.45, 0.8) : r2(0.6, 0.95), spin: (rnd() - 0.5) * 8 });
    }
  };
  const spawnBoards = (c, n, nx, nz, vc, pc) => {
    for (let i = 0; i < n; i++) { const [vx, vz] = burstV(nx, nz, vc, 0.3 + rnd() * 0.4, pc); spawnDeb('board', c, { x: c.x + (rnd() - 0.5), y: gy(c.x, c.z) + 0.4 + rnd() * 0.6, z: c.z + (rnd() - 0.5), vx, vy: 2 + rnd() * 3, vz, tv: (rnd() - 0.5) * 14, tilt: rnd() * 3, spin: (rnd() - 0.5) * 7, s: r2(0.7, 1.2) }); }
  };
  const spawnBottles = (c, n, nx, nz, vc, pc) => {
    for (let i = 0; i < n; i++) { const [vx, vz] = burstV(nx, nz, vc, 0.5 + rnd() * 0.6, pc); spawnDeb('bottle', c, { x: c.x + (rnd() - 0.5) * 0.8, y: gy(c.x, c.z) + 0.3, z: c.z + (rnd() - 0.5) * 0.8, vx, vy: 1 + rnd() * 2.5, vz, s: 1 }); }
  };
  const spawnBits = (c, n, nx, nz, vc, pc) => {   // light litter puffs up and flutters down
    for (let i = 0; i < n; i++) {
      const idx = spawnIdx(leafPool, leafN++); let l = leaves.find(q => q.idx === idx); if (!l) leaves.push(l = { idx });
      const [vx, vz] = burstV(nx, nz, vc, 0.3 + rnd() * 0.5, pc);
      Object.assign(l, { x: c.x + (rnd() - 0.5), y: gy(c.x, c.z) + 0.2, z: c.z + (rnd() - 0.5), vx, vy: 1.5 + rnd() * 3, vz, rot: rnd() * 6, spin: (rnd() - 0.5) * 12, age: 0, life: 3 + rnd() * 2.5, s: r2(0.5, 0.9), gone: false });
      leafPool.setColorAt(idx, BITC[(rnd() * BITC.length) | 0]); leafPool.instanceColor.needsUpdate = true;
    }
  };
  const spawnLeaves = (c, dx, dz, n = 16, big = 1) => {
    const sp = c.sp;
    for (let i = 0; i < n; i++) {
      const idx = spawnIdx(leafPool, leafN++), a = Math.random() * 6.283, r = Math.random() * sp.crown * c.s * 0.7;
      let l = leaves.find(q => q.idx === idx); if (!l) leaves.push(l = { idx });
      Object.assign(l, { x: c.x + Math.cos(a) * r, y: gy(c.x, c.z) + sp.H * c.s * (0.6 + Math.random() * 0.4), z: c.z + Math.sin(a) * r, vx: dx * Math.random() * 4 + (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: dz * Math.random() * 4 + (Math.random() - 0.5) * 4, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 9, age: 0, life: 2.5 + Math.random() * 2, s: (0.9 + Math.random() * 0.8) * big, gone: false });
      leafPool.setColorAt(idx, LEAFC[(Math.random() * LEAFC.length) | 0]); leafPool.instanceColor.needsUpdate = true;
    }
  };

  // ---- poses
  const baseMatrix = (c, m) => m.compose(vA.set(c.x0, c.y0, c.z0), qA.setFromAxisAngle(up, c.rot0), sA.setScalar(c.s));
  const goneMatrix = (c, m) => { const k = c.sp.remain || 0; return m.compose(vA.set(c.x0, c.y0, c.z0), qA.setFromAxisAngle(up, c.rot0), k ? sA.set(c.s * 1.1, c.s * k, c.s * 1.1) : sA.set(0, 0, 0)); };
  function tiltMatrix(c, m) {
    const sn = Math.sin(c.ang), a = vB.set(c.dz, 0, -c.dx);
    qB.setFromAxisAngle(up, c.rot0); qA.setFromAxisAngle(a, c.ang).multiply(qB);
    return m.compose(vA.set(c.x0 + c.dx * (c.slide || 0) * sn, c.y0 + (c.lift || 0) * sn, c.z0 + c.dz * (c.slide || 0) * sn), qA, sA.setScalar(c.s));
  }
  function flyMatrix(c, m) {
    qA.copy(c.q); m.compose(vA.set(c.px, c.py, c.pz), qA, sA.setScalar(c.s));
    return m.multiply(mB.makeTranslation(0, -c.sp.hc, 0));
  }
  // a parked car in the air or tumbling: yaw h, pitch and roll as the traffic writes them (src/traffic.js writeInstances)
  function parkMatrix(c, m) {
    const h = c.h, cc = Math.cos(h), s = Math.sin(h), cr = Math.cos(c.roll), sr = Math.sin(c.roll), pi = c.pitch, cp = Math.cos(pi), sp = Math.sin(pi), e = m.elements;
    e[0] = cc * cr + s * sr * sp; e[1] = sr * cp; e[2] = -s * cr + cc * sr * sp; e[3] = 0;
    e[4] = -cc * sr + s * cr * sp; e[5] = cr * cp; e[6] = s * sr + cc * cr * sp; e[7] = 0;
    e[8] = s * cp; e[9] = -sp; e[10] = cc * cp; e[11] = 0;
    e[12] = c.x; e[13] = gy(c.x, c.z) + c.fl.y; e[14] = c.z; e[15] = 1;
    return m;
  }
  function poseInstance(c) {
    if (c.st === 0) baseMatrix(c, mA); else if (c.st === 'gone') goneMatrix(c, mA); else if (c.st === 'fall' || c.st === 'down') tiltMatrix(c, mA); else if (c.st === 'pfly') parkMatrix(c, mA); else flyMatrix(c, mA);
    c.im.setMatrixAt(c.i, mA); dirty.add(c.im);
  }
  const moved = new Set();
  const grow = c => { if (!moved.has(c.im)) { moved.add(c.im); c.im.boundingSphere.radius += 60; } dirty.add(c); };   // the mesh's culling sphere has to cover where the car may go
  const touch = c => { if (!moved.has(c.im)) { moved.add(c.im); c.im.boundingSphere.radius += 45; } broken.add(c); c.tb = simT; dirty.add(c); };

  // ---- state changes
  function startFall(c, nx, nz, vc, target, o = {}) {   // n points from obstacle to car; thing falls away from the car
    const dx = -nx, dz = -nz;
    Object.assign(c, { st: 'fall', dx, dz, ang: 0, av: 0.6 + vc * 0.12, tgt: target, slide: o.slide || 0, lift: o.lift || 0 });
    gDel(c); dyn.push(c); touch(c);
  }
  // sets c flying away from the car with a spin (n points from the thing to the car, vc is the closing speed); o scales it for a loose piece: v speed, up lift, spin, side random sideways speed
  const SCOOT = { up: 1.2 };
  function launch(c, nx, nz, vc, pc, o = {}) {
    const sp = c.sp, mv = sp.m * 0.6, e = 0.55, vo = vc * (1 + e) / (1 + mv) * 1.25 * (o.v || 1), sd = o.side || 0;
    // fly from the current pose
    if (c.st === 0) { c.q = new THREE.Quaternion().setFromAxisAngle(up, c.rot0); c.px = c.x0; c.py = c.y0 + sp.hc * c.s; c.pz = c.z0; }
    Object.assign(c, { st: 'fly', vx: -nx * vo + pc.vx * 0.25 + (Math.random() - 0.5) * sd, vz: -nz * vo + pc.vz * 0.25 + (Math.random() - 0.5) * sd, vy: clamp(2.6 + vc * 0.32, 3, 9) * (o.up || 1), settle: 0 });
    const k = clamp(vc * 0.35, 1, 5) * (o.spin || 1);
    c.w = new THREE.Vector3((Math.random() - 0.5) * k * 1.6 + nz * k * 0.8, (Math.random() - 0.5) * k * 1.2, (Math.random() - 0.5) * k * 1.6 - nx * k * 0.8);
  }
  function yeet(c, nx, nz, vc, pc) {
    const sp = c.sp, mv = sp.m * 0.6, e = 0.55;
    launch(c, nx, nz, vc, pc, sp.kind === 'scooter' ? SCOOT : undefined);
    gDel(c); if (!dyn.includes(c)) dyn.push(c); touch(c); stats.yeeted++;
    // player loses momentum
    const dv = vc * (1 - mv * e) / (1 + mv), loss = vc - dv;
    pc.vx += nx * loss; pc.vz += nz * loss; pc.vf = pc.vx * Math.sin(pc.th) + pc.vz * Math.cos(pc.th);
    if (simT - lastShout > 1.2) { lastShout = simT; try { dispatchEvent(new CustomEvent('pd-shout', { detail: { x: c.x, y: c.py || c.y0 + 1, z: c.z, follow: () => c.dead ? null : { x: c.x, y: c.py || c.y0 + 1, z: c.z } } })); } catch (err) { /* no events */ } }
  }
  // A loose piece that is not a tile prop (a market stall's frame, canopy and crates, src/markets.js): p = { im, i, x0, y0, z0, rot0, s, sp: { m, he, hc, ghost } }, an instance of any
  // InstancedMesh. Thrown like a yeeted object (same speeds and spin, o scales them), it lands and lies where it falls: it is never put back, and nothing hits it again.
  function throwPiece(p, nx, nz, vc, pc, o) {
    launch(p, nx, nz, vc, pc, o); if (!dyn.includes(p)) dyn.push(p); grow(p); stats.yeeted++;
  }
  // a lump of loose goods (an orange, a fish, a ham): one of the bag pool's balls, s times a bag, in a colour; it lies where it lands
  const lump = (x, y, z, vx, vy, vz, s, col) => spawnDeb('bag', null, { x, y, z, vx, vy, vz, s, spin: (rnd() - 0.5) * 9, col });
  // ---- parked cars: the traffic's yeet (src/traffic.js launch / stepFly), then they stay where they land
  const shoutAt = c => {
    try { dispatchEvent(new CustomEvent('pd-shout', { detail: { x: c.x, y: gy(c.x, c.z) + 1.4, z: c.z, follow: () => c.dead ? null : { x: c.x, y: gy(c.x, c.z) + (c.fl ? c.fl.y : 0) + 1.4, z: c.z } } })); } catch (err) { /* no events */ }
  };
  const keepSlot = c => PARKED_MOVED.set(c.slot, { x: c.x, z: c.z, h: c.st === 'pfly' ? c.h : c.rot });
  // quiet: a vehicle of the traffic did it, not the lapa: no police chaos (the lapa's yeet and its chain reactions raise it, as with a traffic car)
  function startParkFly(c, vx, vz, vy, chain, quiet) {
    const sg = () => rnd() < 0.5 ? -1 : 1;
    c.st = 'pfly'; gDel(c); if (!dyn.includes(c)) dyn.push(c);
    c.fl = { vx, vz, vy, y: 0.15, yaw: sg() * (2 + rnd() * 4), sp: (rnd() - 0.5) * 7, sr: sg() * (3 + rnd() * 6), bounces: 0, phase: 0, t: 0, chain, hit: new Set(), quiet };
    c.h = c.rot; c.pitch = 0; c.roll = 0; grow(c); stats.yeeted++;
    if (!quiet) { try { dispatchEvent(new CustomEvent('pd-yeet', { detail: { kind: chain ? 'chain' : 'yeet' } })); } catch (err) { /* no events */ } }
  }
  // (vx, vz): the velocity of whatever hit it, rel: the closing speed
  function launchParkV(c, nx, nz, rel, vx, vz, pen, quiet) {
    const sc = c.sp.m <= 1.3 ? 1 : 0.65, pv = hyp2(vx, vz) || 1;
    let ux = -nx * 0.45 + vx / pv * 0.55, uz = -nz * 0.45 + vz / pv * 0.55; const um = hyp2(ux, uz) || 1; ux /= um; uz /= um;
    const hs = clamp(rel * 1.3 + 3, 6, 28) * sc;
    startParkFly(c, ux * hs, uz * hs, clamp(4.5 + rel * 0.55, 5.5, 12.5) * sc, 0, quiet);
    c.x -= nx * pen; c.z -= nz * pen;
    shoutAt(c);
  }
  function launchPark(c, nx, nz, rel, pc, pen) {
    launchParkV(c, nx, nz, rel, pc.vx, pc.vz, pen, false);
    const j = 0.1 * rel; pc.vx += nx * j; pc.vz += nz * j; pc.vf = pc.vx * Math.sin(pc.th) + pc.vz * Math.cos(pc.th);   // the lapa only gets a light knock
  }
  parked.near = (x, z, r, out) => {
    out.length = 0;
    const i0 = Math.floor((x - r) / 8), i1 = Math.floor((x + r) / 8), j0 = Math.floor((z - r) / 8), j1 = Math.floor((z + r) / 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const lst = grid.get(cellIJ(i, j)); if (!lst) continue;
      for (let q = 0; q < lst.length; q++) { const c = lst[q]; if (c.st === 0 && c.sp.kind === 'park' && !c.dead) out.push(c); }
    }
    return out.length;
  };
  parked.bump = (c, nx, nz, pen, rel, vx, vz, mv, quiet) => {
    if (c.st !== 0 || c.dead) return 0;
    if (rel * Math.min(1, mv / c.sp.m) >= (quiet ? 7 : c.sp.thr)) { launchParkV(c, nx, nz, rel, vx, vz, pen, quiet); return 2; }   // (a scooter does not launch a car, and a car scraping past one at walking speed only pushes it: it takes a ram, 7 m/s, to launch)
    const x = c.x - nx * pen * (mv / (mv + c.sp.m)), z = c.z - nz * pen * (mv / (mv + c.sp.m));
    if (inB(x, z)) return 0;
    c.x = x; c.z = z; c.x0 = x; c.z0 = z; c.y0 = gy(x, z);
    const k = cellK(x, z); if (k !== c.gk) { gDel(c); gAdd(c); }
    grow(c); keepSlot(c);
    return 1;
  };
  // below the launch speed a parked car is pushed (the lapa and the car share the overlap by mass), unless a wall is behind it
  function nudgePark(c, nx, nz, pen, arm, pc) {
    const mv = c.sp.m, shV = 1 / (1 + mv), shP = mv / (1 + mv), x = c.x - nx * pen * shV, z = c.z - nz * pen * shV;
    if (inB(x, z)) { solid(pc, c, nx, nz, pen, arm); return; }
    solid(pc, c, nx, nz, pen * shP, arm);
    c.x = x; c.z = z; c.x0 = x; c.z0 = z; c.y0 = gy(x, z);
    const k = cellK(x, z); if (k !== c.gk) { gDel(c); gAdd(c); }
    grow(c); keepSlot(c);
  }
  function stepPark(c, dt) {
    const f = c.fl, sp = c.sp;
    f.t += dt;
    const restY = 0.5 * (Math.abs(Math.sin(c.roll)) * sp.W * 0.9 + Math.abs(Math.sin(c.pitch)) * sp.L * 0.2);
    if (f.phase === 0) {   // in the air or sliding
      f.vy -= G * dt; f.y += f.vy * dt;
      c.x += f.vx * dt; c.z += f.vz * dt;
      c.h += f.yaw * dt; c.pitch += f.sp * dt; c.roll += f.sr * dt;
      const speed = hyp2(f.vx, f.vz);
      if (f.y <= restY) {
        f.y = restY;
        if (f.vy < -1.8) { f.vy = -f.vy * 0.42; f.vx *= 0.72; f.vz *= 0.72; f.yaw *= 0.6; f.sp *= 0.5; f.sr *= 0.55; f.bounces++; }
        else {
          f.vy = 0; const k = Math.exp(-2.4 * dt); f.vx *= k; f.vz *= k; f.yaw *= Math.exp(-3 * dt); f.sp *= Math.exp(-5 * dt); f.sr *= Math.exp(-5 * dt);
          if (speed < 0.6) { f.phase = 1; f.t = 0; c.roll = wrapPi(c.roll); c.pitch = wrapPi(c.pitch); }
        }
      }
      if (f.y < 1.2 && speed > 5 && f.chain < 3) {   // chain reaction: it hits the next parked car on the way
        const i0 = Math.floor(c.x / 8), j0 = Math.floor(c.z / 8);
        hunt: for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
          const lst = grid.get(cellIJ(i, j)); if (!lst) continue;
          for (const o of lst) {
            if (o === c || o.st !== 0 || o.sp.kind !== 'park' || f.hit.has(o)) continue;
            const dx = o.x - c.x, dz = o.z - c.z, rr = (sp.L + o.sp.L) * 0.32;
            if (dx * dx + dz * dz > rr * rr) continue;
            f.hit.add(o);
            const k = (o.sp.m <= 1.3 ? 0.8 : 0.5) * (sp.m >= 1.5 ? 1.1 : 1), d = hyp2(dx, dz) || 1;
            startParkFly(o, (f.vx * 0.7 + dx / d * speed * 0.3) * k, (f.vz * 0.7 + dz / d * speed * 0.3) * k, (3.2 + speed * 0.25) * k, f.chain + 1, f.quiet);
            f.vx *= 0.55; f.vz *= 0.55; shoutAt(o);
            break hunt;
          }
        }
      }
      if (inB(c.x, c.z)) { c.x -= f.vx * dt; c.z -= f.vz * dt; f.vx *= -0.3; f.vz *= -0.3; }   // houses stop it
    } else if (f.phase === 1) {   // lying there for a moment, then it rights itself with a hop (and stays where it is)
      if (f.t > (Math.abs(c.roll) > 0.35 || Math.abs(c.pitch) > 0.35 ? 1.8 : 0.5)) { f.phase = 2; f.t = 0; f.r0 = c.roll; f.p0 = c.pitch; }
    } else {
      const u = Math.min(1, f.t / 0.7), e = u * u * (3 - 2 * u);
      c.roll = f.r0 * (1 - e); c.pitch = f.p0 * (1 - e); f.y = 0.45 * Math.sin(u * Math.PI);
      if (u >= 1) {   // parked again, here: it can be hit once more, and it is still here when its tile is built again
        c.st = 0; c.fl = null; c.roll = 0; c.pitch = 0; c.rot = c.rot0 = wrapPi(c.h);
        c.x0 = c.x; c.z0 = c.z; c.y0 = gy(c.x, c.z); gAdd(c);
        const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1);
        keepSlot(c); dirty.add(c);
        return;
      }
    }
    dirty.add(c);
  }
  function solid(pc, c, nx, nz, pen, arm) {
    pc.x += nx * pen; pc.z += nz * pen;
    const vn = pc.vx * nx + pc.vz * nz;
    if (vn < 0) {
      const j = -(1 + E) * vn / (1 + arm * arm / I_YAW);
      pc.vx += j * nx; pc.vz += j * nz; pc.w = clamp((pc.w || 0) + clamp(j * arm / I_YAW * 0.7, -1.6, 1.6), -3.2, 3.2);
      pc.vf = pc.vx * Math.sin(pc.th) + pc.vz * Math.cos(pc.th);
    }
  }
  const slow = (pc, nx, nz, f) => { const vn = pc.vx * nx + pc.vz * nz; if (vn < 0) { pc.vx -= vn * nx * f; pc.vz -= vn * nz * f; pc.vf = pc.vx * Math.sin(pc.th) + pc.vz * Math.cos(pc.th); } };

  function junk(pc, c, nx, nz, vc) {
    const sp = c.sp;
    if (sp.kind === 'object') { yeet(c, nx, nz, vc, pc); stats.junk = (stats.junk || 0) + 1; return; }
    c.st = 'gone'; gDel(c); touch(c); stats.junk = (stats.junk || 0) + 1;
    if (sp.kind === 'bags') {
      spawnBags(c, sp.n, nx, nz, vc, pc, true);
      if (sp.mega) { spawnBoards(c, 3, nx, nz, vc, pc); spawnBottles(c, 4, nx, nz, vc, pc); spawnBits(c, 14, nx, nz, vc, pc); }
      else if (rnd() < 0.5) spawnBits(c, 4, nx, nz, vc, pc);
      slow(pc, nx, nz, sp.slow || 0.04);
    } else if (sp.kind === 'board') { spawnBoards(c, 3, nx, nz, vc, pc); slow(pc, nx, nz, 0.03); }
    else { spawnBits(c, 9, nx, nz, vc, pc); if (sp.bottles) spawnBottles(c, sp.bottles, nx, nz, vc, pc); }
  }
  function hit(pc, c, nx, nz, pen, arm) {
    const sp = c.sp, vc = -(pc.vx * nx + pc.vz * nz);
    switch (sp.kind) {
      case 'veh':
        if (c.st === 0 && vc >= sp.thr) { yeet(c, nx, nz, vc, pc); return; }
        break;
      case 'park':
        if (c.st === 0 && vc >= sp.thr) { launchPark(c, nx, nz, vc, pc, pen); return; }
        if (c.st === 0) { nudgePark(c, nx, nz, pen, arm, pc); return; }
        break;
      case 'scooter':
        if (c.st === 0 && vc >= (sp.fly)) { yeet(c, nx, nz, vc, pc); return; }
        if (c.st === 0 && vc >= sp.thr) {
          // topple sideways, away from the side the lapa came from
          const rx = Math.cos(c.rot), rz = -Math.sin(c.rot), side = (nx * rx + nz * rz) > 0 ? -1 : 1;
          startFall(c, rx * side * -1 * -1, rz * side * -1 * -1, vc, 1.5, { lift: 0.3, slide: 0.2 });
          c.dx = rx * side; c.dz = rz * side; stats.scooters++; slow(pc, nx, nz, 0.15); return;
        }
        break;
      case 'bin':
        if (c.st === 0 && sp.fly && vc >= sp.fly) { spawnBags(c, sp.bags, nx, nz, vc, pc); yeet(c, nx, nz, vc, pc); stats.tipped++; return; }   // hard enough: the whole bin goes
        if (c.st === 0 && vc >= sp.thr) {
          startFall(c, nx, nz, vc, 1.57, { lift: 0.55, slide: 0.9 }); spawnBags(c, sp.bags, nx, nz, vc, pc); stats.tipped++; slow(pc, nx, nz, 0.12); return;
        }
        break;
      case 'bags': case 'board': case 'bits': case 'object':
        if (c.st === 0 && vc >= sp.thr) { junk(pc, c, nx, nz, vc); return; }
        if (sp.kind !== 'object') return;    // soft: the lapa just drives through rubbish below the threshold
        break;
      case 'soft':   // a bush: through it, slowed, a puff of leaves
        if (c.st === 0 && vc >= sp.thr && simT - (c.tsoft || -9) > 1) { c.tsoft = simT; spawnLeaves(c, -nx, -nz); stats.soft = (stats.soft || 0) + 1; }
        slow(pc, nx, nz, 0.012); return;
      case 'hedge':   // a clipped hedge block: bursts into a puff of leaves and a few clumps, the gap stays for the session (the tile puts it back gone when it loads again)
        if (c.st === 0 && Math.hypot(vc, 0.55 * Math.sqrt(Math.max(0, pc.vx * pc.vx + pc.vz * pc.vz - vc * vc))) >= sp.thr) {   // effective speed: the glancing part counts too
          c.st = 'gone'; gDel(c); goneHedge.add(hedgeKey(c)); poseInstance(c);
          spawnLeaves(c, -nx, -nz, 30, 1); spawnLeaves(c, -nx, -nz, 7, 2.6); slow(pc, nx, nz, 0.12); stats.hedges = (stats.hedges || 0) + 1;
          try { dispatchEvent(new CustomEvent('pd-fence', { detail: { x: c.x, z: c.z, kind: 'hedge' } })); } catch (err) { /* no events */ }
          return;
        }
        break;
      case 'tree':
        if (c.st === 0 && vc >= sp.thr) { startFall(c, nx, nz, vc, 1.5); spawnLeaves(c, -nx, -nz); stats.trees++; slow(pc, nx, nz, 0.4); return; }
        break;
      case 'bend':
        if (c.st === 0 && sp.fly && vc >= sp.fly) { yeet(c, nx, nz, vc, pc); stats.bent++; return; }   // the light ones (signs on thin poles, the small bin) are torn out
        if (c.st === 0 && vc >= sp.thr) { startFall(c, nx, nz, vc, sp.tilt); stats.bent++; slow(pc, nx, nz, 0.18); return; }
        break;
      default: break;
    }
    solid(pc, c, nx, nz, pen, arm);
  }

  // ---- dynamics
  const qd = new THREE.Quaternion(), ax = new THREE.Vector3(), mm = new THREE.Matrix4();
  function stepFly(c, dt) {
    c.vy -= G * dt;
    let nx = c.px + c.vx * dt, nz = c.pz + c.vz * dt;
    if (inB(nx, nz)) { c.vx *= -0.3; c.vz *= -0.3; nx = c.px; nz = c.pz; }
    c.px = nx; c.pz = nz; c.py += c.vy * dt;
    const wl = c.w.length();
    if (wl > 1e-4) { qd.setFromAxisAngle(ax.copy(c.w).multiplyScalar(1 / wl), wl * dt); c.q.premultiply(qd); }
    const he = c.sp.he; mm.makeRotationFromQuaternion(c.q); const e = mm.elements;
    const low = Math.abs(e[1]) * he[0] + Math.abs(e[5]) * he[1] + Math.abs(e[9]) * he[2];
    const ground = gy(c.px, c.pz);
    if (c.py - low < ground) {
      c.py = ground + low;
      if (c.vy < 0) c.vy = -c.vy * 0.28;
      c.vx *= 0.82; c.vz *= 0.82; c.w.multiplyScalar(0.7);
      if (Math.abs(c.vy) < 1.1 && hyp2(c.vx, c.vz) < 2.2) c.settle = (c.settle || 0) + dt;
    }
    if (c.settle > 0.15) { // blend to the nearest resting pose
      c.vx *= 0.9; c.vz *= 0.9; c.vy = 0; c.w.set(0, 0, 0);
      let best = 0, sg = 1, bi = 1;
      for (let k = 0; k < 3; k++) { const v = Math.abs(e[k * 4 + 1]); if (v > best) { best = v; bi = k; sg = Math.sign(e[k * 4 + 1]) || 1; } }
      const axw = vA.set(e[bi * 4], e[bi * 4 + 1], e[bi * 4 + 2]).multiplyScalar(sg);
      qd.setFromUnitVectors(axw, up); const target = qd.multiply(c.q.clone());
      c.q.slerp(target, 0.15);
      c.py += (ground + he[bi] - c.py) * 0.2;
      if (best > 0.995 && hyp2(c.vx, c.vz) < 0.2) { // at rest: now a solid wreck
        const ghost = c.sp.ghost; c.st = 'rest'; c.x = c.px; c.z = c.pz; c.circ = [[0, 0, Math.max(he[0], he[2]) * 0.8]]; c.sp = { kind: 'solid', c: c.circ, he: he, hc: c.sp.hc }; if (!ghost) gAdd(c);
        const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1);
      }
    }
    dirty.add(c);
  }
  function stepFall(c, dt) {
    c.av += (3.2 + 5 * Math.sin(c.ang + 0.15)) * dt; c.ang += c.av * dt;
    if (c.ang >= c.tgt) { c.ang = c.tgt; c.st = 'down'; const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1); }
    dirty.add(c);
  }
  function stepDebris(dt) {
    for (const k in DEB) {
      const D2 = DEB[k];
      for (const b of D2.items) {
        if (b.rest || b.hidden) continue;
        b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (inB(b.x, b.z)) { b.x -= b.vx * dt; b.z -= b.vz * dt; b.vx *= -0.3; b.vz *= -0.3; }
        const g0 = gy(b.x, b.z) + (k === 'bag' ? 0.1 * b.s : k === 'board' ? 0.02 : 0.035);
        if (k === 'board') b.tilt += b.tv * dt;
        b.rot += b.spin * dt;
        if (b.y < g0) {
          b.y = g0; b.vy = -b.vy * (k === 'bag' ? 0.3 : 0.25);
          const f = k === 'bottle' ? 0.985 : k === 'board' ? 0.9 : 0.7; b.vx *= f; b.vz *= f; b.spin *= 0.9;
          if (k === 'board') { b.tv *= 0.5; b.tilt += (Math.round(b.tilt / Math.PI) * Math.PI - b.tilt) * 0.3; }
          if (k === 'bottle') { const sp = hyp2(b.vx, b.vz); b.roll += sp * dt / 0.035; if (sp > 0.05) b.rot = Math.atan2(b.vx, b.vz); if (sp < 0.12 && Math.abs(b.vy) < 0.5) b.rest = true; }
          else if (Math.abs(b.vy) < 0.6 && hyp2(b.vx, b.vz) < 0.8) { b.rest = true; if (k === 'board') b.tilt = Math.round(b.tilt / Math.PI) * Math.PI; }
        } else if (k === 'bottle') b.roll += 6 * dt;
        b.dirty = true; D2.dirty = true;
      }
    }
    for (const l of leaves) {
      if (l.age >= l.life) continue;
      l.age += dt; l.vy += (-2.2 - l.vy * 1.6) * dt; l.vx *= 1 - 0.8 * dt; l.vz *= 1 - 0.8 * dt;
      l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt; l.rot += l.spin * dt;
      const g0 = gy(l.x, l.z) + 0.03; if (l.y < g0) { l.y = g0; l.vy = 0; l.spin *= 0.9; l.vx *= 0.8; l.vz *= 0.8; }
      leafDirty = true;
    }
  }
  let leafDirty = false;

  function reset(c) {
    broken.delete(c); const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1);
    if (c.st === 'rest' || c.st === 0 || c.gk !== undefined) gDel(c);
    c.st = 0; c.x = c.x0; c.z = c.z0; c.sp = SPECS[c.model]; c.circ = c.sp.c; gAdd(c);
    for (const k in DEB) for (const b of DEB[k].items) if (b.owner === c) { b.owner = null; b.rest = true; b.hidden = true; b.dirty = true; DEB[k].dirty = true; }
    baseMatrix(c, mA); c.im.setMatrixAt(c.i, mA); dirty.add(c.im);
  }

  function collidePlayer(pc, dt = 1 / 120) {
    simT += dt;
    if (dyn.length) for (let k = dyn.length - 1; k >= 0; k--) { const c = dyn[k]; if (c.st === 'fly') stepFly(c, dt); else if (c.st === 'fall') stepFall(c, dt); else if (c.st === 'pfly') stepPark(c, dt); }
    if (DEB.bag.n || DEB.board.n || DEB.bottle.n || leaves.length) stepDebris(dt);
    if (broken.size && (++tick % 60) === 0 && camPos) {
      for (const c of broken) if (!c.dead && simT - c.tb > 25 && c.st !== 'fly' && c.st !== 'fall' && hyp2(c.x0 - camPos.x, c.z0 - camPos.z) > 80 && hyp2(c.x - camPos.x, c.z - camPos.z) > 80) reset(c);
    }
    const sn = Math.sin(pc.th), cs = Math.cos(pc.th);
    for (let sg = 1; sg >= -1; sg -= 2) {
      const a = sg * PAX, px = pc.x + sn * a, pz = pc.z + cs * a;
      const i0 = Math.floor((px - 4) / 8), i1 = Math.floor((px + 4) / 8), j0 = Math.floor((pz - 4) / 8), j1 = Math.floor((pz + 4) / 8);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const lst = grid.get(cellIJ(i, j)); if (!lst) continue;
        for (let q = lst.length - 1; q >= 0; q--) {
          const c = lst[q]; if (!c || c.dead || c.st === 'down' || c.st === 'fall' || c.st === 'fly' || c.st === 'pfly' || c.st === 'gone') continue;
          const cr = Math.cos(c.rot), sr = Math.sin(c.rot), ss = c.s;
          for (const [ox, oz, r0] of c.circ) {
            const r = SCALE_R.has(c.model) ? r0 * ss : r0;
            const wx = c.x + (ox * cr + oz * sr) * (c.st === 'rest' ? 0 : 1), wz = c.z + (-ox * sr + oz * cr) * (c.st === 'rest' ? 0 : 1);
            let nx = px - wx, nz = pz - wz, d = hyp2(nx, nz); const rs = PR + r;
            if (d >= rs) continue;
            if (d < 1e-4) { nx = sn; nz = cs; d = 1e-4; } else { nx /= d; nz /= d; }
            const arm = a * (cs * nx - sn * nz);
            hit(pc, c, nx, nz, rs - d, arm);
            break;
          }
        }
      }
    }
  }

  // called once per rendered frame: writes the matrices of everything that moved
  function flush(cam) {
    camPos = cam;
    if (dirty.size) {
      for (const d of dirty) { if (d.isInstancedMesh) d.instanceMatrix.needsUpdate = true; else poseInstance(d); }
      for (const d of dirty) if (d.isInstancedMesh) d.instanceMatrix.needsUpdate = true;
      dirty.clear();
    }
    for (const k in DEB) {
      const D2 = DEB[k]; if (!D2.dirty) continue;
      for (const b of D2.items) {
        if (!b.dirty) continue; b.dirty = false;
        if (b.hidden) { mA.makeScale(0, 0, 0); D2.im.setMatrixAt(b.idx, mA); continue; }
        qA.setFromAxisAngle(up, b.rot);
        if (k === 'board') qA.multiply(qB.setFromAxisAngle(vB.set(1, 0, 0), b.tilt)); else if (k === 'bottle') qA.multiply(qB.setFromAxisAngle(vB.set(1, 0, 0), b.roll));
        mA.compose(vA.set(b.x, b.y, b.z), qA, sA.setScalar(b.s)); D2.im.setMatrixAt(b.idx, mA);
      }
      D2.im.instanceMatrix.needsUpdate = true; D2.dirty = false;
    }
    if (leafDirty) {
      let live = false;
      for (const l of leaves) {
        if (l.age >= l.life) { if (!l.gone) { l.gone = true; mA.makeScale(0, 0, 0); leafPool.setMatrixAt(l.idx, mA); live = true; } continue; }
        l.gone = false; live = true;
        qB.setFromEuler(new THREE.Euler(l.age * 3 + l.rot, l.rot, l.age * 2)); mA.compose(vA.set(l.x, l.y, l.z), qB, sA.setScalar(l.s * Math.min(1, (l.life - l.age) * 2)));
        leafPool.setMatrixAt(l.idx, mA);
      }
      leafPool.instanceMatrix.needsUpdate = true; if (!live) leafDirty = false;
    }
  }
  // tiles bring and take their colliders (c.im is the tile's instanced mesh for that model and cell)
  function add(list, meshOf) {
    for (const c of list) {
      c.im = meshOf[c.model + '|' + c.key];
      if (c.im) { gAdd(c); nColl++; if (c.model === 'hedge' && goneHedge.has(hedgeKey(c))) { c.st = 'gone'; gDel(c); poseInstance(c); } }
    }
  }
  function remove(list) {
    for (const c of list) {
      if (c.st === 'pfly') keepSlot(c);   // a car in the air when its tile goes: it comes back where it was
      c.dead = true; if (c.gk !== undefined) gDel(c);
      const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1);
      broken.delete(c); dirty.delete(c); if (c.im) { dirty.delete(c.im); moved.delete(c.im); } nColl--;
    }
    for (const k in DEB) { const D2 = DEB[k]; for (const b of D2.items) if (b.owner && b.owner.dead && !b.hidden) { b.owner = null; b.rest = true; b.hidden = true; b.dirty = true; D2.dirty = true; } }
  }
  // The chase camera's pull-in (src/vehicle.js): where along the car -> camera segment does a prop that stands tall enough to hide the car get in the way?
  // 1 = clear. Trunks, poles, kiosks and shelters count (a thin one at least 0.35 m wide, so a lamp post is seen to cross the view); low things (bins, cars, benches,
  // hedges) and anything knocked over do not. Props the car is touching are ignored: they are in the picture anyway. Reads the collision grid, no allocation.
  const TALL = new Set(['jacaranda', 'holm_b', 'plane_b', 'plane_bare_b', 'pine_b', 'kiosk', 'shelter', 'monument', 'monument_s', 'phone', 'ficus', 'tree', 'holm', 'orange', 'pine', 'plane', 'plane_bare', 'aleppo', 'palm_fan_a', 'palm_fan_b', 'palm_fan_c', 'palm_date_a', 'palm_date_b', 'lamp_pole', 'utility_pole', 'candelabra', 'signal', 'busstop', 'signal_arm', 'billboard']);
  function occlude(x0, z0, x1, z1) {
    const rx = x1 - x0, rz = z1 - z0, L2 = rx * rx + rz * rz; if (L2 < 1e-6) return 1;
    let tMin = 1;
    const i0 = Math.floor(Math.min(x0, x1) / 8), i1 = Math.floor(Math.max(x0, x1) / 8), j0 = Math.floor(Math.min(z0, z1) / 8), j1 = Math.floor(Math.max(z0, z1) / 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const lst = grid.get(cellIJ(i, j)); if (!lst) continue;
      for (let q = 0; q < lst.length; q++) {
        const c = lst[q]; if (!c || c.dead || c.st !== 0 || !TALL.has(c.model)) continue;
        const cr = Math.cos(c.rot), sr = Math.sin(c.rot);
        for (const [ox, oz, r0] of c.circ) {
          const r = Math.max(0.35, SCALE_R.has(c.model) ? r0 * c.s : r0);
          const wx = c.x + ox * cr + oz * sr, wz = c.z - ox * sr + oz * cr;
          const ax = wx - x0, az = wz - z0;
          if (ax * ax + az * az < (r + 1.2) * (r + 1.2)) continue;   // beside the car
          const tc = (ax * rx + az * rz) / L2; if (tc <= 0) continue;
          const px = ax - rx * tc, pz = az - rz * tc, d2 = px * px + pz * pz; if (d2 >= r * r) continue;
          const t = tc - Math.sqrt((r * r - d2) / L2); if (t > 0 && t < tMin) tMin = t;
        }
      }
    }
    return tMin;
  }
  // is there a prop of one of these models (a Set) within r metres of a spot: the crowd of the beaches keeps its sunbathers off the sunbeds and the umbrella poles (src/pedestrians.js)
  function nearModel(x, z, r, models) {
    for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) {
      const lst = grid.get(cellIJ(i, j)); if (!lst) continue;
      for (let q = 0; q < lst.length; q++) { const c = lst[q]; if (c && !c.dead && c.st === 0 && models.has(c.model) && (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < r * r) return true; }
    }
    return false;
  }
  return { collidePlayer, flush, stats, add, remove, count: () => nColl, grid, occlude, throwPiece, lump, nearModel };
}

// ------------------------------------------------------------------ district tables (zones come from src/districts.js zoneAt)
// squalor 0..1 by zone where the centro's street-name rules do not apply
const ZONE_SQ = { zen: 0.95, cep: 0.72, viaLib: 0.18, lido: 0.2, mondello: 0.25, sferra: 0.38, valdesi: 0.3, favorita: 0.3, rural: 0.3, brancaccio: 0.66, noce: 0.6, zisa: 0.6, borgoV: 0.7, villabate: 0.5, monrealeOld: 0.55, monreale: 0.4, isola: 0.45, bellolampo: 0.35, belmonte: 0.5, capaci: 0.45, borgata: 0.4, oreto: 0.65, porto: 0.7, brin: 0.6, corsoMille: 0.55 };
// "effective distance from the old centre" (m) outside 1.1 km: drives how thickly cars, scooters and lanterns are set
const ZONE_DIST = { viaLib: 850, sacco: 900, resut: 1000, fiera: 1000, politeama: 800, stazione: 900, noce: 1000, zisa: 1000, borgoV: 900, villabate: 1000, monrealeOld: 900, monreale: 1000, isola: 1100, bellolampo: 1700, belmonte: 1000, capaci: 1100, borgata: 1300, oreto: 1000, brancaccio: 1100, corsoMille: 1000, zen: 1000, cep: 1200, mondello: 1000, lido: 900, sferra: 1100,
  valdesi: 1300, uditore: 1300, rigano: 1300, periph: 1400, rural: 3200, favorita: 2600, porto: 1800, brin: 1800, acquasanta: 1200, arenella: 1300, tn: 1300 };
const ZONE_CARS = { rural: 0.3, favorita: 0.4, porto: 0.5, brin: 0.4, lido: 1.25, mondello: 1.25, viaLib: 1.3, sacco: 1.2, zen: 0.9, sferra: 1.1, villabate: 1.15, monrealeOld: 1.3, monreale: 1.2, isola: 1.0, bellolampo: 0.5, belmonte: 1.25, capaci: 1.1, borgata: 0.9 };
const CAFE_OUT = { viaLib: 0.85, lido: 0.9, mondello: 0.9, politeama: 0.8, valdesi: 0.7, sferra: 0.7, villabate: 0.6, monrealeOld: 0.5, monreale: 0.4, isola: 0.6, bellolampo: 0.2, belmonte: 0.4, capaci: 0.5, borgata: 0.3 };   // share of cafes with tables outside
const BEACH_UMB = ['#e8e4d8', '#2f6fb0', '#d9482a', '#e6c040', '#2a8a8a', '#f2f2ee', '#d9588a', '#1f4f8a'];

// ------------------------------------------------------------------ building index (exact point test + nearest wall)
function makeIndex(buildings) {
  const BC = 32, bgrid = new Map(), bl = [];
  const bkey = (ix, iz) => (ix + 512) * 1024 + (iz + 512);
  for (const b of buildings) {
    const outer = pairs(b.p), holes = (b.holes || []).map(pairs);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [x, z] of outer) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const o = { outer, holes, x0, z0, x1, z1, h: b.h || 0 }; bl.push(o);
    for (let ix = Math.floor(x0 / BC); ix <= Math.floor(x1 / BC); ix++) for (let iz = Math.floor(z0 / BC); iz <= Math.floor(z1 / BC); iz++) {
      const k = bkey(ix, iz); let a = bgrid.get(k); if (!a) bgrid.set(k, a = []); a.push(o);
    }
  }
  const cellB = (x, z) => bgrid.get(bkey(Math.floor(x / BC), Math.floor(z / BC)));
  function bAt(x, z) {   // the building at (x, z), or null
    const a = cellB(x, z); if (!a) return null;
    for (const o of a) {
      if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) continue;
      if (inPoly(o.outer, x, z)) { let hole = false; for (const h of o.holes) if (inPoly(h, x, z)) { hole = true; break; } if (!hole) return o; }
    }
    return null;
  }
  const inB = (x, z) => bAt(x, z) !== null;
  // nearest wall edge within maxd: {d, px, pz, nx, nz} with n pointing away from the building
  function nearWall(x, z, maxd) {
    let best = null;
    const i0 = Math.floor((x - maxd) / BC), i1 = Math.floor((x + maxd) / BC), j0 = Math.floor((z - maxd) / BC), j1 = Math.floor((z + maxd) / BC);
    const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = bgrid.get(bkey(i, j)); if (!a) continue;
      for (const o of a) {
        if (seen.has(o)) continue; seen.add(o);
        if (x < o.x0 - maxd || x > o.x1 + maxd || z < o.z0 - maxd || z > o.z1 + maxd) continue;
        const ring = o.outer;
        for (let q = 0; q < ring.length; q++) {
          const A = ring[q], B = ring[(q + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l2 = dx * dx + dz * dz;
          if (l2 < 0.01) continue;
          const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / l2)), px = A[0] + dx * t, pz = A[1] + dz * t;
          const d = hyp2(x - px, z - pz);
          if (d < maxd && (!best || d < best.d)) {
            const l = Math.sqrt(l2); let nx = dz / l, nz = -dx / l;
            if (inB(px + nx * 0.4, pz + nz * 0.4)) { nx = -nx; nz = -nz; }
            best = { d, px, pz, nx, nz };
          }
        }
      }
    }
    return best;
  }
  return { bl, inB, bAt, nearWall };
}

// Parked cars: instanced in 100 m cells (a 500 m tile is hundreds of them: the distance cull has to be fine), and the ones the lapa moved are
// remembered for the session by their slot (tile and original spot): tile key + ':' + x + ',' + z  ->  { x, z, h } where they stand now.
const CELL_OF = { panda: 100, punto: 100, smart: 100, van: 100 };
// beyond this distance (m, to the cell's nearest instance) a mesh stops drawing into the shadow map (the shadow pass doubles what it draws). Parked cars at 60 m; [perf pass] so do the
// things narrower than about a metre (their shadow is one to three texels of the 1024 map there, 0.31 m each, and the cell is still drawn), and the ones up to two metres at 80 m.
const SHADOW_D = { panda: 60, punto: 60, smart: 60, van: 60,
  utility_pole: 60, bollard: 60, hydrant: 60, phone: 60, postbox: 60, cabinet: 60, bin_small: 60, fontanella: 60, litter0: 60, litter1: 60, litter_cafe: 60, cardboard: 60, mwaste0: 60, mwaste1: 60, mcrates: 60, busstop: 60,
  bag_pile0: 80, bag_pile1: 80, bag_pile2: 80, bag_pile3: 80, bin_big: 80, bin_over: 80, scooter: 80, cafe_set: 80, bench: 80, stall_table: 80 };
const PARKED_MOVED = new Map();
// The traffic's side (src/traffic.js): parked cars as obstacles beside its lanes, and what happens when a vehicle runs into one.
//   near(x, z, r, out)  fills `out` (the caller's own scratch array) with the parked cars (standing, not flying) in the grid cells within r and returns how many: car.x, car.z, car.rot (nose direction), car.sp.L / W / m / c
//   bump(car, nx, nz, pen, rel, vx, vz, mv, quiet)  a vehicle of mass mv overlaps `car` by pen, (nx, nz) pointing from the parked car to the vehicle, closing at rel m/s
//     with velocity (vx, vz): 0 nothing, 1 the car was pushed (share of the overlap by mass), 2 it was launched (quiet: raises no police chaos)
export const parked = { near() { return 0; }, bump() { return 0; } };

// ------------------------------------------------------------------ one source of props = one 500 m tile
// generate() is a generator: it yields now and then so the caller can spread the work over frames (BUD.over()).
// S describes the tile: ctx, data layers (roads, curbs, asphalt, paving, sand, areas, P = OSM furniture), idx (building index), densities.
function* generate(S, BUD) {
  const { raisedMask, CURB } = S.ctx;
  const P = S.P;
  const rand = rng(S.seed);
  const R = (a, b) => a + rand() * (b - a);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const wpick = (items) => { let t = items.reduce((s, i) => s + i[1], 0), r = rand() * t; for (const [v, w] of items) { if ((r -= w) <= 0) return v; } return items[0][0]; };
  const inBounds = S.inBounds, DEN = S.den;
  const gy = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);

  // ---------- instance buckets
  const colls = [];
  const buckets = {};
  const stats = {};
  const res = { buckets, colls, stats, decals: [], rails: null, wires: null };
  function put(model, x, y, z, rot = 0, s = 1, col = null) {
    const m = MODELS[model]; if (!m) return;
    const sp = SPECS[model], park = sp && sp.kind === 'park', slot = park ? S.tk + ':' + Math.round(x) + ',' + Math.round(z) : null;
    if (park) {   // a parked car the lapa knocked somewhere stays there for the session, also when its tile is built again
      const mv = PARKED_MOVED.get(slot), my = mv ? gy(mv.x, mv.z) : NaN;
      if (mv && my === my) { x = mv.x; z = mv.z; y = my; rot = mv.h; }
    }
    const b = (buckets[model] ||= new Map()), cell = CELL_OF[model] || S.cell, key = Math.floor(x / cell) * 4096 + Math.floor(z / cell);
    let e = b.get(key); if (!e) b.set(key, e = { m: [], c: [] });
    e.m.push(x, y, z, rot, s);
    if (m.tint) e.c.push(col ? col.r : 1, col ? col.g : 1, col ? col.b : 1);
    stats[model] = (stats[model] || 0) + 1;
    if (sp) colls.push({ model, key, i: e.m.length / 5 - 1, x, y, z, rot, s, sp, st: 0, im: null, circ: sp.c, x0: x, z0: z, y0: y, rot0: rot, slot });
  }

  const bl = S.idx.bl, own = bl.slice(0, S.ownCount), inB = S.idx.inB, nearWall = S.idx.nearWall;
  const wallClear = (x, z, r) => !inB(x, z) && !nearWall(x, z, r);

  // ---------- street masks
  // [perf pass] bit-packed tiled raster (core.js rasterMask) instead of a 66 MB RGBA read-back per call
  const asphalt = yield* rasterMaskIter([S.asphalt], S.aoi, 2);
  const paving = yield* rasterMaskIter([S.paving], S.aoi, 1);
  const road = (x, z) => asphalt(x, z) && !inB(x, z);

  // ---------- roads
  const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']);
  const RC = 24, rgrid = new Map(), rkey = (i, j) => (i + 1024) * 2048 + (j + 1024);
  const juncs = new Map();
  S.roads.forEach((r, ri) => {
    if (!DRIVE.has(r.k)) return;
    const p = pairs(r.p);
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], seg = [a[0], a[1], b[0], b[1], ri];
      for (let ix = Math.floor(Math.min(a[0], b[0]) / RC); ix <= Math.floor(Math.max(a[0], b[0]) / RC); ix++)
        for (let iz = Math.floor(Math.min(a[1], b[1]) / RC); iz <= Math.floor(Math.max(a[1], b[1]) / RC); iz++) {
          const k = rkey(ix, iz); let q = rgrid.get(k); if (!q) rgrid.set(k, q = []); q.push(seg);
        }
    }
    for (const v of [p[0], p[p.length - 1], ...p.slice(1, -1)]) {
      const key = Math.round(v[0] * 10) + ',' + Math.round(v[1] * 10); let j = juncs.get(key);
      if (!j) juncs.set(key, j = { x: v[0], z: v[1], roads: new Set(), n: 0 });
      j.roads.add(ri); j.n++;
    }
  });
  const junctions = [...juncs.values()].filter(j => j.roads.size >= 2 || j.n >= 3);
  const jgrid = new Map();
  for (const j of junctions) { const k = rkey(Math.floor(j.x / RC), Math.floor(j.z / RC)); let q = jgrid.get(k); if (!q) jgrid.set(k, q = []); q.push(j); }
  function nearJunction(x, z, r) {
    for (let i = Math.floor((x - r) / RC); i <= Math.floor((x + r) / RC); i++) for (let j = Math.floor((z - r) / RC); j <= Math.floor((z + r) / RC); j++) {
      const a = jgrid.get(rkey(i, j)); if (a) for (const q of a) if (hyp2(q.x - x, q.z - z) < r) return q;
    }
    return null;
  }
  // nearest drivable centreline: {d, px, pz, tx, tz, road}
  function nearRoad(x, z, maxd) {
    let best = null;
    for (let i = Math.floor((x - maxd) / RC); i <= Math.floor((x + maxd) / RC); i++) for (let j = Math.floor((z - maxd) / RC); j <= Math.floor((z + maxd) / RC); j++) {
      const a = rgrid.get(rkey(i, j)); if (!a) continue;
      for (const s of a) {
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; if (l2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)), px = s[0] + dx * t, pz = s[1] + dz * t, d = hyp2(x - px, z - pz);
        if (d < maxd && (!best || d < best.d)) { const l = Math.sqrt(l2); best = { d, px, pz, tx: dx / l, tz: dz / l, road: S.roads[s[4]] }; }
      }
    }
    return best;
  }
  const march = (cx, cz, nx, nz, maxd, pred) => { let d = 0; for (let s = 0.3; s <= maxd; s += 0.3) { if (!pred(cx + nx * s, cz + nz * s)) break; d = s; } return d; };

  // ---------- districts: which zone a spot is in (cached per 40 m), and what that changes
  const zcache = new Map();
  function zoneOf(x, z) {
    const k = Math.floor(x / 40) * 4096 + Math.floor(z / 40);
    let v = zcache.get(k);
    if (v === undefined) { const nr = nearRoad(x, z, 40); v = zoneAt(x, z, nr ? nr.road.n : '', nr ? Math.max(0, nr.d - nr.road.w / 2) : 99); zcache.set(k, v); }
    return v;
  }
  const distEff = (x, z) => { const d = hyp2(x, z); return d < 1100 ? d : (ZONE_DIST[zoneOf(x, z)] ?? 1300); };   // beyond the centro the zone says how built-up it is
  const zoneCars = r => ZONE_CARS[zoneOf(r.p[r.p.length >> 2 << 1], r.p[(r.p.length >> 2 << 1) + 1])] ?? 1;
  const burntCar = (x, z) => zoneOf(x, z) === 'zen' && rand() < 0.07 ? C(pick(['#2a2420', '#3a2a20', '#4a3022', '#241f1c'])) : null;
  // How built-up a spot is, 0 (open country) to 1 (a street of houses): the share of the 120 m square around it that is covered by buildings. The district seeds reach only so far;
  // a village or suburb street outside them is "rural" to the zone tables (a third of the cars) though the houses stand on both sides of it.
  const BU = 40, BU0 = 0.05, BU1 = 0.15, bCov = new Map();
  for (let bi = 0; bi < bl.length; bi++) {
    const o = bl[bi], k = Math.floor((o.x0 + o.x1) / 2 / BU) * 4096 + Math.floor((o.z0 + o.z1) / 2 / BU); bCov.set(k, (bCov.get(k) || 0) + Math.abs(signedArea(o.outer)));
    if ((bi & 255) === 255 && BUD.over()) yield;
  }
  const builtUp = (x, z) => {
    const ci = Math.floor(x / BU), cj = Math.floor(z / BU); let a = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) a += bCov.get(i * 4096 + j) || 0;
    // where the square runs over the tile edge the neighbour's houses are not known (a 6 m margin only): divide by the part that is
    const fx = (Math.min((ci + 2) * BU, S.x1 + 6) - Math.max((ci - 1) * BU, S.x0 - 6)) / (3 * BU), fz = (Math.min((cj + 2) * BU, S.z1 + 6) - Math.max((cj - 1) * BU, S.z0 - 6)) / (3 * BU);
    return Math.max(0, Math.min(1, (a / (9 * BU * BU * Math.max(0.35, fx * fz)) - BU0) / (BU1 - BU0)));
  };
  // the old centre and the belts of the 1960s grid keep the planting, the cars and the lamps they have (the rules for the outskirts below leave them alone)
  const viale = (r, x, z) => /Regione Siciliana/.test(r.n || '') && !(isLane(r) && builtAt(x, z));   // a stretch of the Viale that is a fast road (its lanes are city streets where houses line them: src/road-class.js)
  const OLD_ZONES = new Set(['corso', 'roma', 'old', 'alberg', 'kalsa', 'centro', 'politeama', 'viaLib', 'sacco', 'avenue', 'calat', 'fiera', 'resut', 'stazione', 'porto']);
  const oldCity = (x, z, n = '') => {
    const d = hyp2(x, z); if (d < 2000) return true;
    const zn = zoneOf(x, z); return OLD_ZONES.has(zn) && !(zn === 'avenue' && d > 4500 && /Regione Siciliana/.test(n));   // (the far ends of the Viale Regione Siciliana are the outskirts)
  };
  // the tile's mapped fences and walls (their pieces are built and collided in src/fences.js; the line is the same whatever the style): a tree or a pole does not stand in one
  const fgrid = new Map(), FC = 16;
  for (let fi = 0; fi < S.fences.length; fi++) {
    if ((fi & 63) === 63 && BUD.over()) yield;
    const p = S.fences[fi].p; if (!p || p.length < 4) continue;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const sg = [p[i], p[i + 1], p[i + 2], p[i + 3]];
      for (let ix = Math.floor(Math.min(sg[0], sg[2]) / FC); ix <= Math.floor(Math.max(sg[0], sg[2]) / FC); ix++) for (let iz = Math.floor(Math.min(sg[1], sg[3]) / FC); iz <= Math.floor(Math.max(sg[1], sg[3]) / FC); iz++) {
        const k = ix * 4096 + iz; let a = fgrid.get(k); if (!a) fgrid.set(k, a = []); a.push(sg);
      }
    }
  }
  const nearFence = (x, z, r) => {
    for (let ix = Math.floor((x - r) / FC); ix <= Math.floor((x + r) / FC); ix++) for (let iz = Math.floor((z - r) / FC); iz <= Math.floor((z + r) / FC); iz++) {
      const a = fgrid.get(ix * 4096 + iz); if (!a) continue;
      for (const g of a) {
        const dx = g[2] - g[0], dz = g[3] - g[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - g[0]) * dx + (z - g[1]) * dz) / l2));
        if (hyp2(x - g[0] - dx * t, z - g[1] - dz * t) < r) return true;
      }
    }
    return false;
  };
  // under or beside a bridge deck: a pole or a tree that tall would stand through it
  const brSegs = [];
  for (const r of S.roads) if (r.br && r.p.length >= 4) for (let i = 0; i + 3 < r.p.length; i += 2) brSegs.push([r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], (r.w || 8) / 2 + 6]);
  const nearBridge = (x, z) => {
    for (const g of brSegs) {
      const dx = g[2] - g[0], dz = g[3] - g[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - g[0]) * dx + (z - g[1]) * dz) / l2));
      if (hyp2(x - g[0] - dx * t, z - g[1] - dz * t) < g[4]) return true;
    }
    return false;
  };

  // the steepest fall of the ground within 2 m of a spot (m per m): a trunk or a pole on a bank stands on the drawn terrain only roughly
  const fall = (x, z) => Math.max(Math.abs(groundY(x + 2, z) - groundY(x - 2, z)), Math.abs(groundY(x, z + 2) - groundY(x, z - 2))) / 4;

  // ---------- squalor: how run-down / market-busy a spot is (0..1). Markets and the old poor quarters are
  // found from street names; elsewhere it follows the road class (grand roads stay clean).
  const MARKET_RE = /Ballar|Vucciria|Caracciolo|Chiappara|Maccheronai|Garraffello|Cassari|Argenteria|Capo\b|Carini|Beati Paoli/;
  const POOR_RE = /Albergheria|Casa Professa|Divisi|Lattarini|Biscottari|Bandiera|Alloro|Cala\b|Sant'Agostino|Schioppettieri|Ponticello|Sant'Anna|Collegio di Maria|Marina/;
  const hotGrid = new Map(), hk = (i, j) => (i + 512) * 1024 + (j + 512);
  const hotAdd = (x, z, v) => { const k = hk(Math.floor(x / 100), Math.floor(z / 100)); let a = hotGrid.get(k); if (!a) hotGrid.set(k, a = []); a.push(x, z, v); };
  for (const r of S.hotRoads) {
    const v = MARKET_RE.test(r.n || '') ? 2 : POOR_RE.test(r.n || '') ? 1 : 0; if (!v) continue;
    const p = pairs(r.p);
    for (let i = 0; i < p.length - 1; i++) { const L = hyp2(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); for (let s = 0; s <= L; s += 15) hotAdd(p[i][0] + (p[i + 1][0] - p[i][0]) * s / Math.max(L, 1e-6), p[i][1] + (p[i + 1][1] - p[i][1]) * s / Math.max(L, 1e-6), v); }
    hotAdd(p[p.length - 1][0], p[p.length - 1][1], v);
  }
  const CLASS_SQ = { primary: 0.2, secondary: 0.3, tertiary: 0.5, unclassified: 0.55, residential: 0.65, living_street: 0.5, service: 0.75 };
  function squalor(x, z) {
    let best = 0;
    for (let i = Math.floor((x - 110) / 100); i <= Math.floor((x + 110) / 100); i++) for (let j = Math.floor((z - 110) / 100); j <= Math.floor((z + 110) / 100); j++) {
      const a = hotGrid.get(hk(i, j)); if (!a) continue;
      for (let q = 0; q < a.length; q += 3) { const d = hyp2(a[q] - x, a[q + 1] - z); const f = a[q + 2] === 2 ? (d < 45 ? 1 : d < 110 ? 0.8 : 0) : (d < 90 ? 0.85 : 0); if (f > best) best = f; }
    }
    if (best >= 0.8) return best;
    const nr = nearRoad(x, z, 18);
    const base = nr ? (CLASS_SQ[nr.road.k] ?? 0.4) : 0.35, zs = ZONE_SQ[zoneOf(x, z)];
    return Math.max(best, zs === undefined ? base : zs);
  }
  const binSites = [];

  // ---------- occupancy (avoid stacking props)
  const occ = new Map();
  const okey = (i, j) => (i + 8192) * 16384 + (j + 8192);
  const occAdd = (x, z, r) => { const k = okey(Math.floor(x / 4), Math.floor(z / 4)); let a = occ.get(k); if (!a) occ.set(k, a = []); a.push(x, z, r); };
  function occHit(x, z, r) {
    for (let i = Math.floor((x - r - 3) / 4); i <= Math.floor((x + r + 3) / 4); i++) for (let j = Math.floor((z - r - 3) / 4); j <= Math.floor((z + r + 3) / 4); j++) {
      const a = occ.get(okey(i, j)); if (!a) continue;
      for (let q = 0; q < a.length; q += 3) if (hyp2(a[q] - x, a[q + 1] - z) < a[q + 2] + r) return true;
    }
    return false;
  }

  // pavement furniture: nudge off the carriageway onto the nearest bit of non-asphalt
  function snapOff(x, z) {
    if (inB(x, z)) return null;
    if (!road(x, z)) return [x, z];
    for (let r = 0.6; r <= 6; r += 0.6) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a * TAU / 16) * r, pz = z + Math.sin(a * TAU / 16) * r;
      if (!asphalt(px, pz) && !inB(px, pz) && wallClear(px, pz, 0.25)) return [px, pz];
    }
    return null;
  }

  const PAINT = [['#f4f2ec', 28], ['#c9cdd0', 20], ['#8d9296', 13], ['#2a2b2f', 11], ['#f0f0ea', 6], ['#a8181f', 6], ['#27456f', 6], ['#8eb4cf', 4], ['#cdbf9f', 3], ['#4a5b4a', 1], ['#d4a017', 1], ['#5a5d63', 4]];
  const paint = () => C(wpick(PAINT)).multiplyScalar(R(0.92, 1.05));
  // the traffic's own cars and colours (src/traffic.js TYPES: panda, punto, smart, van)
  const CARS = [['panda', 36], ['punto', 30], ['smart', 14], ['van', 8]];
  const HATCH_COLS = [['#f2f2f0', 30], ['#c3c6cb', 22], ['#6e7378', 16], ['#1f2124', 12], ['#b3241e', 9], ['#8fb3cc', 6], ['#3d5a45', 3]];
  const VAN_COLS = [['#f2f2f0', 70], ['#c3c6cb', 12], ['#8fb3cc', 8], ['#d8d2b8', 10]];
  const carPaint = model => C(wpick(model === 'van' ? VAN_COLS : HATCH_COLS)).multiplyScalar(R(0.94, 1.04));
  // the same picks from given random numbers (0..1), for the cars that have to come out the same each time their tile is built
  const pickBy = (list, u) => { let t = 0; for (const c of list) t += c[1]; u *= t; for (const [v, w] of list) { if ((u -= w) <= 0) return v; } return list[0][0]; };
  const paintBy = (model, u, shade) => C(pickBy(model === 'van' ? VAN_COLS : HATCH_COLS, u)).multiplyScalar(0.94 + shade * 0.1);
  const SCOOT = ['#e8e6dc', '#2c2d31', '#b9bec2', '#a2201f', '#27456f', '#e6c040', '#6b7a58', '#d9d9d6'];

  // ---------- 1. real OSM furniture
  const osm = P.items.filter(i => inBounds(i.x, i.z));
  const taken = (it, r) => { occAdd(it.x, it.z, r); };
  const nearAny = (list, x, z, r) => list.some(q => hyp2(q.x - x, q.z - z) < r);
  const lampsReal = [];
  // n4: the species of a tree from where it stands (src/species.js): explicit OSM / register species first, then the crown kind, then the mix of the place
  const landList = (S.areas || []).filter(a => a.k === 'orchard' || a.k === 'olive' || a.k === 'farm' || a.k === 'forest' || a.k === 'scrub').map(a => {
    const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
    return { k: a.k, pts, x0, z0, x1, z1 };
  });
  const landAt = (x, z) => { for (const a of landList) if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && inPoly(a.pts, x, z)) return a.k; return ''; };
  const TINTS = {}, tintOf = hex => hex ? (TINTS[hex] ||= new THREE.Color(hex)) : null;
  // the planes of Piazza Indipendenza (photo ce12, February) stand bare, like those of Via Ernesto Basile and Viale Michelangelo (CANOPY below): a bare plane is a real thing here for four months of the year, and the survey photos are of all seasons
  const bareAt = (x, z) => Math.hypot(x + 795.7, z - 576.4) < 140;
  const treeSpec = (x, z, it = null) => {
    const code = speciesFor(x, z, groundY(x, z), zoneOf(x, z), it, landList.length ? landAt(x, z) : '');
    const [model, hex] = SP[code];
    let m = model === 'palm_date' ? 'palm_date_b' : model === 'palm_fan' ? pick(['palm_fan_a', 'palm_fan_b']) : model;   // two fan palms and one date palm: every model is one more draw call per cell
    if (m === 'plane' && bareAt(x, z)) m = 'plane_bare';
    return { m, t: tintOf(hex), code };
  };
  const treePts = [];   // where the trees stand (the street trees of 13 keep their distance)
  const placeTree = (x, z, kind, canopy = 0.95, tc = null) => {
    if (!inBounds(x, z) || road(x, z) || inB(x, z) || treeCleared(x, z)) return false;
    const r = { ficus: 3.2, tree: 2.2, jacaranda: 2.2, holm: 2.8, orange: 1.4, pine: 2, plane: 2.4, plane_bare: 2.4, aleppo: 2, shrub: 0.8, hedge: 0.9 }[kind] ?? 0.5;
    if (TREE_VARIANT.has(kind) && hash3(x * 0.73, z * 0.41, 3.7) < 0.5) kind += '_b';   // (by position, not from the random stream of the tile)
    if (occHit(x, z, Math.min(r, 1.6) * 0.6)) return false;
    const wd = nearWall(x, z, 1.1); if (wd && kind !== 'shrub') return false;
    const s = R(0.85, 1.2) * canopy, tint = C('#ffffff').multiplyScalar(R(0.85, 1.12)); if (tc) tint.multiply(tc);
    put(kind, x, gy(x, z), z, R(0, TAU), s, tint); occAdd(x, z, Math.min(r, 1.6) * 0.6); treePts.push([x, z]);
    return true;
  };
  // Traffic signals: one head on its pole (or mast arm) per road that arrives at a mapped signal, at the right kerb by the stop line (src/streets.js), facing the
  // traffic that comes. src/signals.js says which roads and which phase; the heads are registered with the lamp board when the tile's meshes exist.
  res.sigs = [];
  for (const site of signalSites(S.roads, osm)) {
    const done = [];
    for (const leg of site.legs) {
      if (!leg.inb || done.some(q => q.ax * leg.ax + q.az * leg.az > 0.97)) continue;
      const [px, pz, tx, tz] = legPoint(leg, site, STOP_BACK + 0.5), rx = tz, rz = -tx;   // by the stop line; (rx, rz): the driver's right
      let d = march(px, pz, rx, rz, leg.w / 2 + 3, road); if (d < 0.5 || d > leg.w / 2 + 2.5) d = leg.w / 2;   // the kerb: where the asphalt ends, or the mapped width when the march ran on into a cross street
      let o = d + 0.65, x = px + rx * o, z = pz + rz * o;
      for (let i = 0; i < 5 && (inB(x, z) || occHit(x, z, 0.5)); i++) { o = d + 0.65 - 0.2 * (i + 1); x = px + rx * o; z = pz + rz * o; }   // a wall or another prop: nearer the road, then give up
      if (inB(x, z)) continue;
      done.push(leg);
      const aw = leg.ow ? leg.w : leg.w / 2, model = aw >= 9 ? 'signal_arm' : 'signal';   // a mast arm over a carriageway of three lanes or more
      put(model, x, gy(x, z), z, Math.atan2(tx, tz)); occAdd(x, z, 0.5);
      res.sigs.push({ coll: colls[colls.length - 1], site, g: leg.g }); stats.signals = (stats.signals || 0) + 1;
    }
  }
  for (const it of osm) {
    if (BUD.over()) yield;
    const k = it.k;
    if (k === 'tree') {
      if (it.kd === 'fruit') {   // a CTR orchard symbol stands for a few trees of the grove (the Conca d'Oro citrus, the olive and almond orchards of the hills): a short irregular row of four
        for (const [dx, dz] of [[0, 0], [6.5, 2], [-4.5, 6], [2.5, -6.5]]) { const x = it.x + dx, z = it.z + dz, sq = treeSpec(x, z, it); placeTree(x, z, sq.m, 0.85, sq.t); }
        continue;
      }
      const sp = treeSpec(it.x, it.z, it), kd = sp.m, isPalm = kd.startsWith('palm');
      const cs = it.r ? (isPalm && it.h ? Math.max(0.6, Math.min(1.6, it.h / (SPECS[kd] ? SPECS[kd].H : 9))) : Math.max(0.55, Math.min(2.4, it.r / (SPECS[kd] ? SPECS[kd].crown : 2.7)))) : 0.95;
      placeTree(it.x, it.z, kd, cs, sp.t); continue;
    }
    if (k === 'bollard') { if (!inB(it.x, it.z)) { put('bollard', it.x, gy(it.x, it.z), it.z); occAdd(it.x, it.z, 0.2); } continue; }
    if (k === 'bin_big') { if (!inB(it.x, it.z)) { const y = gy(it.x, it.z), a = R(0, TAU); put('bin_big', it.x, y, it.z, a); put('bags', it.x + Math.cos(a) * 0.9, y, it.z - Math.sin(a) * 0.9, R(0, TAU)); occAdd(it.x, it.z, 1); } continue; }
    if (k === 'lamp') {
      const w = nearWall(it.x, it.z, 3);
      if (w && (it.mount === 'wall' || w.d < 1.5)) { const y = groundY(w.px, w.pz) + (raisedMask(w.px + w.nx, w.pz + w.nz) ? CURB : 0); put('lamp_wall', w.px, y, w.pz, Math.atan2(w.nx, w.nz)); lampsReal.push(it); }
      else { const sp = snapOff(it.x, it.z); if (sp && !occHit(sp[0], sp[1], 0.3)) { put('lamp_pole', sp[0], gy(sp[0], sp[1]), sp[1], R(0, TAU)); occAdd(sp[0], sp[1], 0.4); lampsReal.push(it); } }
      continue;
    }
    if (k === 'bench') {
      const sp = snapOff(it.x, it.z); if (!sp) continue;
      const w = nearWall(sp[0], sp[1], 3), rot = w ? Math.atan2(w.nx, w.nz) : (it.dir ? +it.dir * Math.PI / 180 : R(0, TAU));
      put('bench', sp[0], gy(sp[0], sp[1]), sp[1], rot); occAdd(sp[0], sp[1], 0.8); continue;
    }
    if (k === 'bin_small') { const sp = snapOff(it.x, it.z); if (sp) put('bin_small', sp[0], gy(sp[0], sp[1]), sp[1]); continue; }
    if (k === 'hydrant') { const sp = snapOff(it.x, it.z); if (sp) put('hydrant', sp[0], gy(sp[0], sp[1]), sp[1]); continue; }
    if (k === 'phone') { const sp = snapOff(it.x, it.z); if (sp) { const w = nearWall(sp[0], sp[1], 3); put('phone', sp[0], gy(sp[0], sp[1]), sp[1], w ? Math.atan2(w.nx, w.nz) : 0); } continue; }
    if (k === 'postbox') { const sp = snapOff(it.x, it.z); if (sp) put('postbox', sp[0], gy(sp[0], sp[1]), sp[1], R(0, TAU)); continue; }
    if (k === 'street_cabinet') { const sp = snapOff(it.x, it.z); if (sp) { const w = nearWall(sp[0], sp[1], 3); put('cabinet', sp[0], gy(sp[0], sp[1]), sp[1], w ? Math.atan2(w.nx, w.nz) : R(0, TAU)); } continue; }
    if (k === 'signal') continue;   // placed per approach before this loop
    if (k === 'busstop') {
      const sp = snapOff(it.x, it.z); if (!sp || occHit(sp[0], sp[1], 1)) continue;
      const nr = nearRoad(sp[0], sp[1], 14), y = gy(sp[0], sp[1]);
      put('busstop', sp[0], y, sp[1], nr ? Math.atan2(nr.tx, nr.tz) : 0);
      occAdd(sp[0], sp[1], 1);
      if (nr && rand() < 0.25 && wallClear(sp[0], sp[1], 1.6)) { const rr = Math.atan2(-nr.tz, nr.tx) ; put('shelter', sp[0] + nr.tz * 0.0, y, sp[1], Math.atan2(nr.px - sp[0], nr.pz - sp[1])); occAdd(sp[0], sp[1], 2); }
      continue;
    }
    if (k === 'monument') {
      if (it.tour === 'artwork' && it.support === 'ground' && !it.mem) continue;   // mosaics and the like
      if (inB(it.x, it.z) || road(it.x, it.z)) continue;
      const dp = it.art === 'statue' ? Math.hypot(it.x - 71.5, it.z - 25.8) : 99;   // Fontana Pretoria (src/landmarks.js): the statues of its precinct are figures; the one in the middle of the basin is in the model, behind a fence
      if (dp < 10) continue;
      put(dp < 24 ? 'monument_s' : 'monument', it.x, gy(it.x, it.z), it.z, R(0, TAU), it.mem === 'bust' ? 0.7 : 1); occAdd(it.x, it.z, 1); continue;
    }
    if (k === 'water') { // a drinking tap (OSM drinking_water and the Comune's fontanelle list): on the pavement
      const sp = snapOff(it.x, it.z); if (!sp || occHit(sp[0], sp[1], 0.4)) continue;
      put('fontanella', sp[0], gy(sp[0], sp[1]), sp[1], R(0, TAU)); occAdd(sp[0], sp[1], 0.4); continue;
    }
    if (k === 'fountain') {
      if (hyp2(it.x, it.z) < 70 || hyp2(it.x - proj(38.1151, 13.3622)[0], it.z - proj(38.1151, 13.3622)[1]) < 50) continue; // landmarks handles Quattro Canti and Pretoria
      if (inB(it.x, it.z)) continue;
      put('fountain', it.x, gy(it.x, it.z), it.z, 0); occAdd(it.x, it.z, 2); continue;
    }
    if (k === 'bikepark') { // motorcycle / bicycle parking: a few scooters
      const nn = 3 + Math.floor(rand() * 3), a0 = R(0, Math.PI);
      for (let i = 0; i < nn; i++) { const x = it.x + Math.cos(a0 + Math.PI / 2) * (i - nn / 2) * 0.8, z = it.z + Math.sin(a0 + Math.PI / 2) * (i - nn / 2) * 0.8; if (!inB(x, z)) put('scooter', x, gy(x, z), z, a0 + R(-0.25, 0.25), 1, C(pick(SCOOT))); }
      continue;
    }
  }

  // tree rows
  for (const a of P.areas) {
    if (a.k !== 'tree_row') continue;
    const p = pairs(a.p);
    for (let i = 0; i < p.length - 1; i++) {
      const A = p[i], B = p[i + 1], L = hyp2(B[0] - A[0], B[1] - A[1]);
      for (let s = 2; s < L; s += 7) { const x = A[0] + (B[0] - A[0]) * s / L, z = A[1] + (B[1] - A[1]) * s / L, sp = treeSpec(x, z, { r: 3 }); placeTree(x, z, sp.m, 1, sp.t); }
    }
  }

  // ---------- 2. shop awnings from real shop positions
  {
    const AW = ['#a8232a', '#2a5b3a', '#1f4f8a', '#d9a62a', '#d9d4c2', '#7a2a3a', '#2f6f8a'];
    const awnTypes = new Set(['greengrocer', 'bakery', 'pastry', 'butcher', 'convenience', 'supermarket', 'clothes', 'shoes', 'florist', 'gift', 'variety_store', 'bag', 'tobacco', 'deli', 'seafood']);
    const placed = [];
    for (const it of osm) {
      if (it.k !== 'shop' || !awnTypes.has(it.shop) || rand() < 0.35) continue;
      const w = nearWall(it.x, it.z, 7); if (!w) continue;
      if (placed.some(q => hyp2(q[0] - w.px, q[1] - w.pz) < 3.2)) continue;
      const ox = w.px + w.nx * 1.5, oz = w.pz + w.nz * 1.5;
      if (inB(ox, oz) || (asphalt(ox, oz) && !raisedMask(ox, oz) && !paving(ox, oz))) continue;   // no awnings over the carriageway
      const ey = groundY(w.px, w.pz) + (raisedMask(ox, oz) ? CURB : 0);
      const col = C(pick(AW));
      if (!(it.shop === 'supermarket' && brandOf(it.n) >= 0)) put('awning', w.px + w.nx * 0.05, ey, w.pz + w.nz * 0.05, Math.atan2(w.nx, w.nz), 1, col);   // a chain's store has its own front (2b); its draws and its spacing stay, so the rest of the tile is as it was
      placed.push([w.px, w.pz]);
    }
  }

  // ---------- 2b. supermarkets: every store of a chain (src/supermarkets.js: OSM shop=supermarket, or a building named after the chain) wears the chain's parody on its real
  // building, on the wall that faces its street. On a palazzo's ground floor: a glazed shopfront (lit inside at night), a band of the chain's colour over it and the sign
  // on the band, under the first floor's balconies. On a low hall: the band along the top of the wall and the sign on it, standing a little over the parapet. A car park beside it gets a totem at the
  // entrance. All of it is one merged mesh per tile on the sign atlas (res.smk), plus the totems' posts as props. Nothing here draws from the tile's random stream.
  {
    const SP = [], SC = [], SU = [], shops = [], fronts = [], totems = [], SK = 0.002;   // positions, colours, uvs (the atlas, or x -1: warm glow y, x -2: own-colour glow y)
    const cellUv = k => { const c = k % SIGN_COLS, r = Math.floor(k / SIGN_COLS); return [(c + SK) / SIGN_COLS, (c + 1 - SK) / SIGN_COLS, 1 - (r + 1 - SK * 4) / SIGN_ROWS, 1 - (r + SK * 4) / SIGN_ROWS]; };
    const sc3 = new THREE.Color();
    // a frame on a wall: origin (ox, oz), n out of the wall, r = the viewer's right (looking at the wall), y absolute
    const frame = (ox, oz, nx, nz) => { const rx = nz, rz = -nx; return (u, y, w) => [ox + rx * u + nx * w, y, oz + rz * u + nz * w]; };
    const quad = (a, b, c, d, col, ua = null) => {   // a b c d counter-clockwise seen from the front; ua: [u0, u1, v0, v1] over a..d, else [part, glow]
      for (const [p, i] of [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]]) {
        SP.push(p[0], p[1], p[2]); SC.push(col.r, col.g, col.b);
        if (ua && ua.length === 4) SU.push(i === 0 || i === 3 ? ua[0] : ua[1], i < 2 ? ua[2] : ua[3]); else SU.push(ua ? ua[0] : -1, ua ? ua[1] : 0);
      }
    };
    // a box in a frame: u0..u1 along the wall, y0..y1, w0..w1 out of it; front: uv of the front face (the sign) or null
    const box = (F, u0, u1, y0, y1, w0, w1, col, part = null, front = null) => {
      quad(F(u0, y0, w1), F(u1, y0, w1), F(u1, y1, w1), F(u0, y1, w1), front ? WHITE : col, front || part);
      const side = col.clone().multiplyScalar(0.8);
      quad(F(u1, y0, w1), F(u1, y0, w0), F(u1, y1, w0), F(u1, y1, w1), side, part);
      quad(F(u0, y0, w0), F(u0, y0, w1), F(u0, y1, w1), F(u0, y1, w0), side, part);
      quad(F(u0, y1, w0), F(u0, y1, w1), F(u1, y1, w1), F(u1, y1, w0), col, part);
      quad(F(u0, y0, w1), F(u0, y0, w0), F(u1, y0, w0), F(u1, y0, w1), side.multiplyScalar(0.7), part);
    };
    const RANK = { primary: 6, secondary: 5, tertiary: 4, unclassified: 2, residential: 2, living_street: 1, service: -2 };
    const Hof = b => b.r !== undefined && b.g !== undefined ? b.r - b.g : (b.h || 6);
    const tags = [], ti = Math.round(S.x0 / 500), tj = Math.round(S.z0 / 500);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const q of SUCA_TAGS[(ti + di) + '_' + (tj + dj)] || []) tags.push(q);
    const sites = [];
    for (let i = 0; i < S.ownCount; i++) {
      const b = S.bdata[i]; if (!b.n || b.n.length > 24) continue;   // (a building named after the chain: a long name is a mall or an office that merely contains the word)
      const k = brandOf(b.n); if (k < 0) continue;
      const o = bl[i], x = (o.x0 + o.x1) / 2, z = (o.z0 + o.z1) / 2;
      if (inBounds(x, z)) sites.push({ k, o, x, z, own: true, H: Hof(b) });
    }
    for (const it of osm) {
      if (it.k !== 'shop' || it.shop !== 'supermarket') continue;
      const k = brandOf(it.n); if (k < 0 || sites.some(s => s.k === k && hyp2(s.x - it.x, s.z - it.z) < 60)) continue;   // (the node of a store whose building is mapped too)
      let o = S.idx.bAt(it.x, it.z);
      if (!o) { const w = nearWall(it.x, it.z, 15); if (w) o = S.idx.bAt(w.px - w.nx * 0.3, w.pz - w.nz * 0.3); }
      if (!o) continue;
      const bi = bl.indexOf(o), b = S.bdata[bi];
      if (bi >= S.ownCount && b.n && brandOf(b.n) === k) continue;   // the neighbouring tile dresses its own building
      sites.push({ k, o, x: it.x, z: it.z, own: false, H: Hof(b) });
    }
    for (const s of sites) {
      // the wall: long, facing a street close by (the bigger the better), and for a mapped shop the one nearest to it; never a party wall
      const ring = s.o.outer; let best = null;
      for (let q = 0; q < ring.length; q++) {
        const A = ring[q], B = ring[(q + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], L = hyp2(dx, dz); if (L < 4) continue;
        const tx = dx / L, tz = dz / L, mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2; let nx = tz, nz = -tx;
        const tagged = tags.some(q => { const u = (q[1] - A[0]) * tx + (q[2] - A[1]) * tz; return u > -q[4] && u < L + q[4] && Math.abs((q[1] - A[0]) * tz - (q[2] - A[1]) * tx) < 1.5; });   // a SUCA tag on the wall: no glass over it
        if (inB(mx + nx * 0.4, mz + nz * 0.4)) { nx = -nx; nz = -nz; }
        if (inB(mx + nx * 0.4, mz + nz * 0.4) || inB(mx + nx * 3, mz + nz * 3)) continue;
        const nr = nearRoad(mx + nx * 3, mz + nz * 3, 40); if (!nr) continue;
        const dr = hyp2(nr.px - mx, nr.pz - mz); if (((nr.px - mx) * nx + (nr.pz - mz) * nz) / Math.max(1, dr) < 0.3) continue;
        const t = Math.max(0, Math.min(L, (s.x - A[0]) * tx + (s.z - A[1]) * tz)), dn = s.own ? 0 : hyp2(A[0] + tx * t - s.x, A[1] + tz * t - s.z);
        const sc = Math.min(L, 30) - dr * 0.6 - dn * 1.5 + (RANK[nr.road.k] || 0) - (tagged ? 6 : 0);
        if (!best || sc > best.sc) best = { sc, A, tx, tz, nx, nz, L, t: s.own ? L / 2 : t, tagged };
      }
      if (!best) continue;
      const { A, tx, tz, nx, nz, L } = best, low = s.H < 7.5, br = BRANDS[s.k], band = new THREE.Color(br.band), trim = new THREE.Color(br.trim);
      let hs = Math.min(s.own ? (low ? 20 : 7) : 4.5, L / 2 - 0.3), tc = Math.max(hs + 0.3, Math.min(L - hs - 0.3, best.t));
      const cx = A[0] + tx * tc, cz = A[1] + tz * tc, F = frame(cx, cz, nx, nz), rs = tx * nz - tz * nx > 0 ? 1 : -1;   // rs: the edge runs along the viewer's right (1) or left
      const at = u => { const x = cx + tx * u * rs, z = cz + tz * u * rs; return gy(x + nx * 0.8, z + nz * 0.8); };
      const gw = Math.min(hs, 6), yL = at(-gw), yR = at(gw), y0 = Math.max(yL, yR), yTop = Math.min(at(-hs), at(hs)) + s.H;
      // the shopfront: glass from the pavement up (the sky in it, paler at the top), mullions every 2.4 m, lit warm inside at night
      const gTop = y0 + 2.5, gLo = new THREE.Color('#2e3c44'), gHi = new THREE.Color('#617784');
      if (!best.tagged) {
        quad(F(-gw, yL + 0.1, 0.07), F(gw, yR + 0.1, 0.07), F(gw, gTop, 0.07), F(-gw, gTop, 0.07), gLo, [-1, 0.05]);
        for (let i = SC.length - 18, j = SU.length - 12; i < SC.length; i += 3, j += 2) if (SP[i + 1] > gTop - 0.01) { SC[i] = gHi.r; SC[i + 1] = gHi.g; SC[i + 2] = gHi.b; SU[j + 1] = 0.22; }   // (at night the ceiling lights: brighter at the top)
        for (let u = -gw; u <= gw + 0.01; u += Math.max(1.6, (2 * gw) / Math.max(1, Math.round(2 * gw / 2.4)))) box(F, u - 0.06, u + 0.06, Math.min(yL, yR) + 0.1, gTop, 0.05, 0.11, sc3.set('#5d6468'));
      }
      let sw = Math.min(2 * hs - 0.4, low ? 10 : 4.2), sh = sw / 4, sy;   // (on a palazzo the sign stays under the balconies of the first floor, about 3.8 m up)
      if (low) {   // the band along the top of the hall, the sign on it standing over the parapet by up to 40 % of its height
        const bTop = Math.max(yTop, gTop + 0.9), bBot = bTop - 0.85;
        box(F, -hs, hs, bBot, bTop, 0.02, 0.12, band, [-2, 0.35]);
        sy = Math.max(gTop + 0.25, bTop - sh * 0.6);
        if (sy > gTop + 0.25) box(F, -0.45, 0.45, bBot, sy, 0.1, 0.14, trim);   // a short stand where the sign rises over the band
      } else {   // the band over the shop windows, the sign on it
        box(F, -gw - 0.3, gw + 0.3, gTop, gTop + 0.85, 0.02, 0.12, band, [-2, 0.35]);
        sy = gTop + 0.425 - sh / 2;
      }
      box(F, -sw / 2, sw / 2, sy, sy + sh, 0.1, 0.24, trim, [-2, 0.25], cellUv(s.k));
      shops.push(...F(0, y0, 1.2), -1.7); fronts.push(cx, y0, cz, nx, nz, s.k);   // the light the windows spill on the pavement: a lamp for src/daynight.js (userData.lampPts: x, ground y, z, height) whose pool is wanted, its halo sunk under the ground (a halo over the door washed out the sign)
      // the car park nearest the shop's front, within 70 m: a totem where its edge comes closest to a street, facing it
      let lot = null, ld = 70;
      for (const a of P.areas) {
        if (a.k !== 'parking' || a.ptype === 'underground' || a.ptype === 'multi-storey') continue;
        for (let i = 0; i < a.p.length; i += 2) { const d = hyp2(a.p[i] - cx, a.p[i + 1] - cz); if (d < ld) { ld = d; lot = a; } }
      }
      if (!lot || totems.includes(lot)) continue;
      const lp = pairs(lot.p); let tb = null;
      for (let i = 0; i < lp.length - 1; i++) {
        const a = lp[i], b = lp[i + 1], l = hyp2(b[0] - a[0], b[1] - a[1]);
        for (let u = 1; u < l - 1; u += 3) {
          const x = a[0] + (b[0] - a[0]) * u / l, z = a[1] + (b[1] - a[1]) * u / l;
          if (!inBounds(x, z) || inB(x, z) || nearWall(x, z, 2) || occHit(x, z, 1.5) || road(x, z) || road(x + 1.8, z) || road(x - 1.8, z) || road(x, z + 1.8) || road(x, z - 1.8)) continue;   // (off the asphalt by a car's width: the cars parked along the kerb stay where they were)
          const nr = nearRoad(x, z, 25); if (nr && (!tb || nr.d < tb.d)) tb = { x, z, d: nr.d, px: nr.px, pz: nr.pz };
        }
      }
      if (!tb) continue;
      const fl = hyp2(tb.px - tb.x, tb.pz - tb.z) || 1, fx = (tb.px - tb.x) / fl, fz = (tb.pz - tb.z) / fl, ty = gy(tb.x, tb.z);
      put('smk_totem', tb.x, ty, tb.z, Math.atan2(fx, fz)); occAdd(tb.x, tb.z, 1.2); totems.push(lot);
      for (const sd of [1, -1]) { const T = frame(tb.x, tb.z, fx * sd, fz * sd); quad(T(-1.6, ty + 4.5, 0.145), T(1.6, ty + 4.5, 0.145), T(1.6, ty + 5.3, 0.145), T(-1.6, ty + 5.3, 0.145), WHITE, cellUv(s.k)); }
    }
    if (SP.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(SC, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(SU, 2));
      g.computeVertexNormals();
      res.smk = { geo: g, lamps: new Float32Array(shops), fronts };
    }
    stats.supermarkets = sites.length; stats.smk_totems = totems.length;
  }

  // ---------- 3. zebra crossings (decals) from OSM nodes plus junction arms
  const zebras = [];   // where they are: no car parks on a crossing (6b)
  {
    const zb = new MB(), col = C('#d9d7cc'), colw = C('#bdbcb2');
    let nz = 0; const done = [];
    const zebra = (cx, cz, tx, tz, rnd = rand, ext = null) => {   // (rnd: the side-street zebras below draw from their own stream, so that adding them moves nothing else in the tile; ext: their measured width)
      // stripes lie along the road (t) and are stacked across it (n)
      const nx = -tz, nzz = tx;
      const e1 = ext ? ext.e1 : march(cx, cz, nx, nzz, 9, road), e2 = ext ? ext.e2 : march(cx, cz, -nx, -nzz, 9, road);
      if (e1 + e2 < 4.5 || e1 + e2 > 16) return;
      for (let u = -e2 + 0.45; u <= e1 - 0.45; u += 0.95) {
        const k = rnd() < 0.2 ? 0.7 : 1, c = rnd() < 0.2 ? colw : col;
        const hw = 0.25, hl = 1.6;
        const q = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => { const x = cx + tx * a + nx * (u + b), z = cz + tz * a + nzz * (u + b); return [x, groundY(x, z) + 0.025, z]; });
        zb.face(c, [q[0], q[3], q[2], q[1]], k); // CCW viewed from above
      }
      nz++; done.push([cx, cz]); zebras.push([cx, cz]);
    };
    for (const it of osm) {
      if (it.k !== 'crossing') continue;
      zebras.push([it.x, it.z]);   // marked or not: nobody parks on a crossing
      if (it.cr === 'unmarked' || it.den === 'unmarked') continue;
      if (done.some(d => hyp2(d[0] - it.x, d[1] - it.z) < 10)) continue;
      const nr = nearRoad(it.x, it.z, 5); if (!nr || !road(nr.px, nr.pz)) continue;
      if (nr.road.k === 'service' && rand() < 0.5 || fastAt(nr.road, nr.px, nr.pz)) continue;
      zebra(nr.px, nr.pz, nr.tx, nr.tz);
    }
    // the mouth of a side street on a main road: a zebra across the side street just past the flare of its mouth (src/streets.js sideZebrasIter decides where, with the paint, which
    // leaves it clear); drawn here with the junction it belongs to, so the zebras placed after it see it as before
    const side = new Map(), jk = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);
    for (const q of S.sideZebras) { const k = jk(q.jx, q.jz); if (!side.has(k)) side.set(k, []); side.get(k).push(q); }
    const zr = rng(S.seed3 + 4241);
    for (const j of junctions) {
      for (const q of side.get(jk(j.x, j.z)) || []) zebra(q.x, q.z, q.tx, q.tz, zr, q);
      // junction arms on real streets
      if (j.roads.size < 3 && j.n < 3) continue;
      for (const ri of j.roads) {
        const r = S.roads[ri]; if (!(r.k === 'primary' || r.k === 'secondary' || r.k === 'tertiary')) continue;
        const p = pairs(r.p); let idx = p.findIndex(v => Math.abs(v[0] - j.x) < 0.2 && Math.abs(v[1] - j.z) < 0.2); if (idx < 0) continue;
        const o = idx === 0 ? p[1] : idx === p.length - 1 ? p[p.length - 2] : p[idx + 1]; if (!o) continue;
        const L = hyp2(o[0] - j.x, o[1] - j.z); if (L < 14) continue;
        const tx = (o[0] - j.x) / L, tz = (o[1] - j.z) / L, cx = j.x + tx * 6.5, cz = j.z + tz * 6.5;
        if (done.some(d => hyp2(d[0] - cx, d[1] - cz) < 12) || !road(cx, cz) || rand() < 0.35 || fastAt(r, j.x, j.z)) continue;
        zebra(cx, cz, tx, tz);
      }
    }
    if (nz) res.decals.push(zb.geo());
    stats.zebra_crossings = nz;;
  }

  const QC5 = proj(38.1151, 13.3622);
  // ---------- 4. procedural street lamps
  const lampNear = (x, z, r) => lampsReal.some(q => hyp2(q.x - x, q.z - z) < r) || occHit(x, z, r * 0.5);
  {
    // tall pole lamps along the curbs of the wide streets
    const lampPts = [];
    for (const flat of S.curbs) {
      if (BUD.over()) yield;
      const p = pairs(flat); let acc = R(0, 25);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 0.01) continue;
        const nx = -dz / L, nz = dx / L;
        for (let s = acc; s < L; s += 34 + R(0, 8)) {
          const x = a[0] + dx * s / L - nx * 0.55, z = a[1] + dz * s / L - nz * 0.55;
          acc = s - L;
          if (!inBounds(x, z) || !raisedMask(x, z) || inB(x, z)) continue;
          const nr = nearRoad(x, z, 14); if (!nr || !(nr.road.k === 'primary' || nr.road.k === 'secondary' || nr.road.k === 'tertiary')) continue;
          if (nr.road.k === 'tertiary' && rand() < 0.45) continue;
          if (lampNear(x, z, 20) || lampPts.some(q => hyp2(q[0] - x, q[1] - z) < 22) || nearWall(x, z, 0.5)) continue;
          if (nearJunction(x, z, 4) || hyp2(x, z) < 45 || hyp2(x - QC5[0], z - QC5[1]) < 50) continue;
          lampPts.push([x, z]);
          put('lamp_pole', x, gy(x, z), z, Math.atan2(nx, nz) + Math.PI / 2); occAdd(x, z, 0.5);
        }
        acc = Math.max(0, acc);
      }
    }
    stats.lamp_poles_proc = lampPts.length;
  }
  {
    // the fast roads (src/expressway.js) stand under tall double-arm poles beside the rail, every 40 m on the right of the carriageway (photos nw29, nw30, zs12); where a mapped lamp is near, that one is the pole
    let n = 0;
    for (const r of S.roads) {
      if (!isFastRoad(r) || r.k === 'motorway_link' || (r.cw || r.w) < 5.5) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p); let acc = hash3(r.p[0], r.p[1], 9) * 40;   // (not from the shared stream: the rest of the tile builds as it did)
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 0.01) continue;
        const tx = dx / L, tz = dz / L, nx = -tz * (r.o === -1 ? -1 : 1), nz = tx * (r.o === -1 ? -1 : 1);   // right of travel
        let s = acc;
        for (; s < L; s += 40) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (!inBounds(cx, cz) || !road(cx, cz) || nearJunction(cx, cz, 12) || !fastAt(r, cx, cz)) continue;
          const e = march(cx, cz, nx, nz, 12, road), x = cx + nx * (e + 2.4), z = cz + nz * (e + 2.4);
          if (e > 11 || !inBounds(x, z) || road(x, z) || inB(x, z) || nearWall(x, z, 0.6) || lampNear(x, z, 24)) continue;
          put('lamp_pole', x, gy(x, z), z, Math.atan2(nx, nz) + Math.PI / 2); occAdd(x, z, 0.5); n++;
        }
        acc = s - L;
      }
    }
    stats.lamp_poles_fast = n;
  }
  {
    // billboards along the open fast roads (photos su07, su09, nw30; none in the OSM data): now and then, on the right of travel well beyond the rail and the tall lamps, angled to the traffic that comes,
    // one of the twelve adverts. Never near a junction or a building, on or next to the asphalt (it may stand in a separator wide enough), on a slope or within 40 m of another one. About one in BB_EVERY m of each carriageway.
    const BB_STEP = 30, BB_EVERY = 250, BB_OFF = 5.5;
    const bbs = []; let n = 0;
    for (const r of S.roads) {
      if (!isFastRoad(r) || r.k === 'motorway_link' || r.o === -1) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
        const tx = dx / L, tz = dz / L, nx = -tz, nz = tx;   // right of travel
        for (let s = BB_STEP * hash3(a[0], a[1], 6.1); s < L; s += BB_STEP) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (hash3(cx * 0.13, cz * 0.17, 8.3) > BB_STEP / BB_EVERY || !inBounds(cx, cz) || !road(cx, cz) || nearJunction(cx, cz, 25) || !fastAt(r, cx, cz)) continue;
          const e = march(cx, cz, nx, nz, 12, road); if (e > 11) continue;
          const x = cx + nx * (e + BB_OFF), z = cz + nz * (e + BB_OFF);
          if (!inBounds(x, z) || march(x, z, -nx, -nz, BB_OFF - 1.5, (qx, qz) => !road(qx, qz)) < BB_OFF - 1.8 || road(x + nx * 2, z + nz * 2) || road(x + tx * 3.5, z + tz * 3.5) || road(x - tx * 3.5, z - tz * 3.5) || inB(x, z) || nearWall(x, z, 4) || occHit(x, z, 3.2) || nearJunction(x, z, 25)) continue;
          if (Math.abs(gy(x, z) - gy(cx, cz)) > 1.5 || bbs.some(q => hyp2(q[0] - x, q[1] - z) < 40)) continue;
          const fx = -tx * 0.85 - nx * 0.53, fz = -tz * 0.85 - nz * 0.53;   // facing the oncoming traffic, turned 32 degrees to the road
          // the advert: a fixed hash of the position (the same for everyone), stepped on past the ones the billboards of this tile within 800 m already show
          const near = bbs.filter(q => hyp2(q[0] - x, q[1] - z) < 800).map(q => q[2]);
          let k = Math.floor(hash3(x, z, 1.7) * POSTERS) % POSTERS;
          for (let j = 0; j < POSTERS && near.includes(k); j++) k = (k + 5) % POSTERS;   // (5 and 12 are coprime: the steps visit every advert)
          MATS.poster.userData.need(); put('billboard', x, gy(x, z), z, Math.atan2(fx, fz), 1, posterCol(k)); occAdd(x, z, 3.2); bbs.push([x, z, k]); n++;
        }
      }
    }
    stats.billboards = n;
  }
  {
    // wall lanterns on street-facing facades, denser towards Quattro Canti
    let n = 0;
    for (const o of own) {
      if (BUD.over()) yield;
      const ring = o.outer;
      for (let q = 0; q < ring.length; q++) {
        const A = ring[q], B = ring[(q + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], L = hyp2(dx, dz);
        if (L < 7) continue;
        const cxm = (A[0] + B[0]) / 2, czm = (A[1] + B[1]) / 2;
        if (!inBounds(cxm, czm)) continue;
        const dist = distEff(cxm, czm), pk = Math.max(0.04, 0.5 - dist / 1700) * DEN;
        let nx = dz / L, nz = -dx / L;
        if (inB(cxm + nx * 0.5, czm + nz * 0.5)) { nx = -nx; nz = -nz; }
        for (let s = R(3, 14); s < L - 3; s += R(22, 38)) {
          if (rand() > pk) continue;
          const x = A[0] + dx * s / L, z = A[1] + dz * s / L;
          if (inB(x + nx * 0.5, z + nz * 0.5) || inB(x + nx * 2.2, z + nz * 2.2)) continue;
          const ox = x + nx * 1.2, oz = z + nz * 1.2;
          if (!asphalt(ox, oz) && !raisedMask(ox, oz) && !paving(ox, oz)) continue;
          if (lampNear(x, z, 14)) continue;
          put('lamp_wall', x, groundY(ox, oz) + (raisedMask(ox, oz) ? CURB : 0), z, Math.atan2(nx, nz));
          occAdd(x, z, 6); n++;
        }
      }
    }
    stats.wall_lanterns_proc = n;
  }

  // candelabra around the larger paved piazze
  {
    let n = 0;
    for (const a of S.areas) {
      if (BUD.over()) yield;
      if (a.k !== 'plaza') continue;
      const pts = pairs(a.p), area = Math.abs(signedArea(pts));
      if (area < 600 || area > 25000) continue;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      if (!inBounds(cx, cz)) continue;
      for (let i = 0; i < pts.length; i++) {
        const A = pts[i], B = pts[(i + 1) % pts.length], L = hyp2(B[0] - A[0], B[1] - A[1]); if (L < 5) continue;
        const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
        const inward = inPoly(pts, A[0] + (-uz) * 1.5, A[1] + ux * 1.5) ? 1 : -1;
        for (let s = 3; s < L - 2; s += 24) {
          const x = A[0] + ux * s + (-uz) * inward * 1.4, z = A[1] + uz * s + ux * inward * 1.4;
          if (!inBounds(x, z) || inB(x, z) || road(x, z) || nearWall(x, z, 0.8) || lampNear(x, z, 16)) continue;
          put('candelabra', x, gy(x, z), z, R(0, TAU)); occAdd(x, z, 6); n++;
        }
      }
    }
    stats.candelabra = n;
  }

  // ---------- 5. bollards where paved zones meet traffic
  {
    let n = 0, cap = 260;
    for (const poly of S.paving) {
      const ring = pairs(poly[0]);
      for (let i = 0; i < ring.length && n < cap; i++) {
        const A = ring[i], B = ring[(i + 1) % ring.length], L = hyp2(B[0] - A[0], B[1] - A[1]); if (L < 1) continue;
        const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
        for (let s = 0.5; s < L; s += 6.5) {
          const x = A[0] + ux * s, z = A[1] + uz * s;
          if (!inBounds(x, z)) continue;
          // road must be on one side only, within a metre
          const a1 = asphalt(x - uz * 0.9, z + ux * 0.9), a2 = asphalt(x + uz * 0.9, z - ux * 0.9);
          if (a1 === a2 || inB(x, z) || treeCleared(x, z)) continue;   // (the access road of the stadium crosses a pavement here: no bollards across it)
          const sx = x + (a1 ? -uz : uz) * 0.1, sz = z + (a1 ? ux : -ux) * 0.1;
          if (road(sx, sz) || occHit(sx, sz, 0.3) || nearWall(sx, sz, 0.4)) continue;
          put('bollard', sx, groundY(sx, sz) + (raisedMask(sx, sz) ? CURB : 0.01), sz); occAdd(sx, sz, 0.3); n++;
        }
      }
    }
    stats.bollards_proc = n;
  }

  // ---------- 6. cars, cassonetti, market stalls along the carriageways
  let carCount = 0;
  // one car, footprint (body and four corners) wholly on asphalt, off the walls and the other props; (hx, hz) is where its nose points
  // (inset: the sides are tested that far inside the body; the asphalt mask has 0.5 m cells, and a car at the kerb has its wheels on the very edge of the asphalt)
  const placeCar = (x, z, hx, hz, model = wpick(CARS), paint = null, inset = 0) => {
    const sp = SPECS[model], L = sp.L, W = sp.W;
    const fx = hx * L / 2, fz = hz * L / 2, wx = -hz * (W / 2 + 0.08 - inset), wz = hx * (W / 2 + 0.08 - inset);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = x + fx * a + wx * b, pz = z + fz * a + wz * b;
      if (!road(px, pz) || nearWall(px, pz, 0.12)) return false;
    }
    if (occHit(x, z, L * 0.4) || occHit(x + hx * L * 0.3, z + hz * L * 0.3, 1) || occHit(x - hx * L * 0.3, z - hz * L * 0.3, 1)) return false;
    put(model, x, groundY(x, z), z, Math.atan2(hx, hz), 1, paint || burntCar(x, z) || carPaint(model));
    occAdd(x, z, L * 0.36); occAdd(x + hx * L * 0.3, z + hz * L * 0.3, 0.9); occAdd(x - hx * L * 0.3, z - hz * L * 0.3, 0.9);
    carCount++; return true;
  };
  const MARKET = /Ballar|Vucciria|Caracciolo|Chiappara|Maccheronai|Garraffello|Cassari|Argenteria/;
  {
    const CAR_CLASSES = { residential: 0.62, tertiary: 0.5, secondary: 0.38, unclassified: 0.6, service: 0.3, living_street: 0.28, primary: 0.3 };
    let bins = 0, stalls = 0;
    for (let ri = 0; ri < S.roads.length; ri++) {
      const r = S.roads[ri]; if (BUD.over()) yield;
      const base = CAR_CLASSES[r.k] * zoneCars(r); if (!base) continue;
      const market = MARKET.test(r.n || '');
      const p = pairs(r.p); let carry = R(0, 5);
      let binGap = R(10, 40);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 0.5) continue;
        const tx = dx / L, tz = dz / L, rx = -tz, rz = tx;   // right of travel
        for (let s = carry; s < L; s += 5.7) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (!inBounds(cx, cz, 10)) continue;
          const jn = nearJunction(cx, cz, 8);
          for (let side = 0; side < 2; side++) {
            const sg = side ? -1 : 1, nx = rx * sg, nz = rz * sg;
            const e = march(cx, cz, nx, nz, 9, road), e2 = march(cx, cz, -nx, -nz, 9, road);
            if (e < 1.2) continue;
            if (market) {
              if (e + e2 > 3 && rand() < 0.45 && !jn) {
                const d = e - 1.0, x = cx + nx * d, z = cz + nz * d;
                if (wallClear(x, z, 0.5) && !occHit(x, z, 1.1)) {
                  // stalls face the street centre line
                  put('stall_table', x, groundY(x, z), z, Math.atan2(-nx, -nz)); occAdd(x, z, 1.1); stalls++;
                  if (rand() < 0.75) put('umbrella', x, groundY(x, z), z, R(0, TAU), 1, C(pick(['#ece4ca', '#e8dfc0', '#2f6b49', '#2f5f93', '#b73a2c', '#d9a62a']))), occAdd(x, z, 1.1);
                }
              }
              continue;
            }
          }
          // cassonetti: groups at the kerb every so often
          binGap -= 5.7;
          if (binGap < 0 && !jn && r.k !== 'service' && !fastAt(r, cx, cz)) {
            binGap = R(110, 260);
            const side = rand() < 0.5 ? 1 : -1, nx = rx * side, nz = rz * side, e = march(cx, cz, nx, nz, 9, road);
            if (e > 2.6) {
              const nb = 1 + Math.floor(rand() * 3), d = e + 0.85;   // past the kerb, on the pavement
              let ok = 0;
              for (let q = 0; q < nb; q++) {
                const x = cx + nx * d + tx * q * 1.35, z = cz + nz * d + tz * q * 1.35;
                if (road(x, z) || !raisedMask(x, z) || !wallClear(x, z, 0.7) || occHit(x, z, 0.8)) continue;   // only where there is pavement room
                const over = hash3(x * 0.7, z * 0.7, 3) < 0.18 + 0.5 * squalor(x, z) * (r.k === 'primary' || r.k === 'secondary' ? 0.4 : 1);
                put(over ? 'bin_over' : 'bin_big', x, gy(x, z), z, Math.atan2(nx, nz) + Math.PI + R(-0.06, 0.06)); occAdd(x, z, 0.8); ok++; bins++; binSites.push([x, z, nx, nz, tx, tz, over]);
                if (rand() < 0.3) { put('bags', x + nx * 0.2 - tx * 0.4, gy(x, z), z + nz * 0.2 - tz * 0.4, R(0, TAU), R(0.8, 1.1)); }
              }
              if (ok && rand() < 0.3) { const x = cx + nx * d - tx * 1.6, z = cz + nz * d - tz * 1.6; if (wallClear(x, z, 0.5) && !occHit(x, z, 0.7)) put('bags', x, gy(x, z), z, R(0, TAU), R(0.8, 1.2)); }
            }
          }
        }
        carry = ((carry - L) % 5.7 + 5.7) % 5.7;
      }
    }
    stats.cassonetti_proc = bins; stats.stalls = stalls;
  }

  // ---------- 6b. parked cars along the kerbs
  // Nose to tail, as on the real streets: runs of cars with an empty space now and then, on both sides of the residential streets and the avenues, on one
  // side where the carriageway is too narrow for two rows and a car passing between them. OSM parking:lane / parking:both (tiles bake them as r.pk, the
  // left and the right of the way: n none, p parallel, q perpendicular, d diagonal) win where they exist; elsewhere parallel, thinner towards the
  // outskirts. Never: on bridges or in tunnels, within 6 m of a junction (side streets and driveways keep clear), on a crossing, near a bus stop,
  // on tram tracks. They are the traffic's cars (see SPECS: pushed when nudged, launched like the traffic when hit).
  // Outside the old centre the thinning follows the houses along the street (builtUp), not only the district seed that happens to be near: a village street no seed
  // reaches was counted as countryside (a third of the cars), and at the kerb a footprint that fits the asphalt by a hand's width often failed the 0.5 m cells of its mask.
  {
    const PK_CLASS = { primary: 0.55, secondary: 0.72, tertiary: 0.82, unclassified: 0.78, residential: 0.9, living_street: 0.5, service: 0.35 };
    const PK_CAP = Math.round(900 * S.den / 0.8);
    const stops = P.items.filter(i => i.k === 'busstop').map(i => [i.x, i.z]);
    for (let i = 0; i + 1 < BUS_STOPS.length; i += 2) { const x = BUS_STOPS[i], z = BUS_STOPS[i + 1]; if (x > S.x0 - 40 && x < S.x1 + 40 && z > S.z0 - 40 && z < S.z1 + 40) stops.push([x, z]); }
    const rails = [];   // tram rail segments near the tile
    for (const ln of S.tram || []) for (let i = 0; i + 3 < ln.length; i += 2) {
      const ax = ln[i], az = ln[i + 1], bx = ln[i + 2], bz = ln[i + 3];
      if (Math.max(ax, bx) > S.x0 - 20 && Math.min(ax, bx) < S.x1 + 20 && Math.max(az, bz) > S.z0 - 20 && Math.min(az, bz) < S.z1 + 20) rails.push([ax, az, bx, bz]);
    }
    const nearList = (list, x, z, r) => { for (const q of list) if (hyp2(q[0] - x, q[1] - z) < r) return true; return false; };
    const nearRail = (x, z, r) => {
      for (const q of rails) {
        const dx = q[2] - q[0], dz = q[3] - q[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - q[0]) * dx + (z - q[1]) * dz) / l2));
        if (hyp2(x - q[0] - dx * t, z - q[1] - dz * t) < r) return true;
      }
      return false;
    };
    const blocked = (x, z, hx, hz, L) => {   // the car's centre and its two ends
      for (const k of [0, -0.45, 0.45]) {
        const px = x + hx * L * k, pz = z + hz * L * k;
        if (nearJunction(px, pz, 6) || nearList(zebras, px, pz, 3.2) || nearList(stops, px, pz, 12) || (rails.length && nearRail(px, pz, 2.7))) return true;
      }
      return false;
    };
    // The tile's budget (PK_CAP) used to be spent in the order the roads come in the tile, so in a dense tile the last streets got no car at all (zs22: the cap of 900
    // was reached at road 84 of 92 and both kerbs of Via Guadagna stayed empty). A first pass adds up what the streets would ask for (occupancy x kerb length / a car's
    // pitch, both sides where the mapped carriageway is wide enough, PK_YIELD of the slots ending up as cars) and, when that is over the budget, every street's occupancy
    // is scaled down by the same factor, so the cars thin out evenly over the tile instead of stopping at one street.
    const PK_YIELD = 0.64, plan = [];
    let want = 0;
    for (let ri = 0; ri < S.roads.length; ri++) {
      const r = S.roads[ri]; if ((ri & 63) === 63 && BUD.over()) yield;
      const cls = PK_CLASS[r.k]; if (!cls || r.br || r.tn) { plan.push(null); continue; }
      const p = pairs(r.p); if (p.length < 2) { plan.push(null); continue; }
      const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + hyp2(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      const len = cum[cum.length - 1]; if (len < 8) { plan.push(null); continue; }
      let h = len / 2, k = 1; while (k < cum.length - 1 && cum[k] < h) k++;
      const u = (h - cum[k - 1]) / (cum[k] - cum[k - 1] || 1), mid = [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u];
      // outside the old centre a street of houses that no district seed reaches counts as built-up (builtUp), as in the photos, and a car may stand with its wheels on the very edge of the asphalt; a fast road keeps what it had
      const fast = (r.ms || 0) >= 60 || viale(r, mid[0], mid[1]), outskirts = !fast && !oldCity(mid[0], mid[1]), bu = outskirts ? builtUp(mid[0], mid[1]) : 0;
      const zc = Math.min(1.3, zoneCars(r)), dE = distEff(mid[0], mid[1]);
      const occ = Math.min(0.93, cls * (zc < 1 ? zc + (1 - zc) * bu : zc) * Math.max(0.6, Math.min(1, 1.2 - (dE > 1300 ? dE + (1300 - dE) * bu : dE) / 4000)) * 1.05);
      plan.push({ p, cum, len, outskirts, occ });
      if (r.pk || !fastAt(r, mid[0], mid[1])) want += occ * len * ((r.cw || r.w || 6) >= (r.o ? 6 : 8) ? 2 : 1) / 5.4 * PK_YIELD;
    }
    const pkScale = want > PK_CAP * 0.95 ? PK_CAP * 0.95 / want : 1;
    stats.parked_scale = Math.round(pkScale * 100) / 100;
    let n = 0;
    for (let ri = 0; ri < S.roads.length && carCount < PK_CAP; ri++) {
      const r = S.roads[ri], pl = plan[ri]; if (BUD.over()) yield;
      if (!pl) continue;
      const { p, cum, len, outskirts } = pl, occ = pl.occ * pkScale;
      let seg = 0;
      const at = sv => {
        sv = Math.max(0, Math.min(len, sv));
        while (seg > 0 && cum[seg] > sv) seg--;
        while (seg < p.length - 2 && cum[seg + 1] < sv) seg++;
        const a = p[seg], b = p[seg + 1], l = cum[seg + 1] - cum[seg] || 1, u = (sv - cum[seg]) / l;
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      };
      const pStay = 0.93, pStart = Math.min(0.9, occ * (1 - pStay) / Math.max(0.05, 1 - occ));
      // Every random number here comes from a generator seeded by the tile and the road, and every slot takes the same draws and the same step whether
      // it is filled or not: a tile built again (its neighbours may differ this time: walls, other tiles' props) puts the same cars on the same spots,
      // which is what lets a car the lapa moved be found again (PARKED_MOVED).
      const pk = r.pk || '--', r0 = rng(S.seed3 + ri * 7919), only = r0() < 0.5 ? 1 : -1;   // on a narrow street one side takes the cars
      for (const sg of [1, -1]) {
        const tag = pk[sg > 0 ? 1 : 0], mode = tag === '-' ? 'p' : tag;
        if (mode === 'n') continue;
        const rs = rng(S.seed3 + ri * 7919 + (sg > 0 ? 1 : 2));
        let run = rs() < occ, s = 0.5 + rs() * 3.5;
        while (s < len - 2 && carCount < PK_CAP) {
          const rm = rs(), rrun = rs(), rflip = rs(), rgap = rs(), rcol = rs(), rshade = rs(), rburn = rs();
          const model = pickBy(CARS, rm), sp = SPECS[model], L = sp.L, W = sp.W;
          const pitch = mode === 'q' ? W + 0.8 : mode === 'd' ? (W + 0.7) * 1.41 : L + 0.4;
          const step = pitch + (mode === 'p' ? rgap * 0.5 : 0);
          const sc = s + pitch / 2; if (sc > len) break;
          run = run ? rrun < pStay : rrun < pStart;
          if (!run) { s += mode === 'p' ? L * 0.85 : pitch; continue; }
          const c = at(sc), A = at(sc - L * 0.45), B = at(sc + L * 0.45), cl = hyp2(B[0] - A[0], B[1] - A[1]) || 1;
          const tx = (B[0] - A[0]) / cl, tz = (B[1] - A[1]) / cl, nx = -tz * sg, nz = tx * sg;   // sg 1: right of travel
          s += step;
          if (!inBounds(c[0], c[1]) || (!r.pk && fastAt(r, c[0], c[1]))) continue;   // (a fast road has no parked cars, unless OSM maps a parking lane on it)
          const e = march(c[0], c[1], nx, nz, 9, road), e2 = march(c[0], c[1], -nx, -nz, 9, road);
          const oneway = r.o ? (r.o > 0 ? 1 : -1) : 0, free = oneway ? 2.7 : 4.6;   // what has to stay open: one lane of one-way traffic, two narrow lanes otherwise (the traffic steers round the cars and keeps flowing)
          const wide = e + e2 - 2 * (W + 0.3) >= free;   // room for a row of cars each side and the lanes between
          if ((!wide && sg !== only && tag === '-') || e < W / 2 + 0.4) { run = false; continue; }
          let hx, hz, d, ext;
          let f = oneway || (sg > 0 ? 1 : -1); if (rflip < 0.06) f = -f;
          if (mode === 'q') { hx = nx; hz = nz; d = e - L / 2 - 0.25; ext = L + 0.5; }
          else if (mode === 'd') { hx = (nx + tx * f) * 0.7071; hz = (nz + tz * f) * 0.7071; d = e - (L + W) * 0.35 - 0.25; ext = (L + W) * 0.71 + 0.3; }
          else { hx = tx * f; hz = tz * f; d = e - W / 2 - 0.17; ext = W + 0.3; }
          if (e + e2 - ext < free) { run = false; continue; }   // the lanes must stay open
          const x = c[0] + nx * d, z = c[1] + nz * d;
          const paint = (rburn < 0.07 && zoneOf(x, z) === 'zen') ? C(['#2a2420', '#3a2a20', '#4a3022', '#241f1c'][Math.floor(rcol * 4) % 4])
            : paintBy(model, rcol, rshade);
          // a car whose outer corners miss the asphalt by a hand's width (the kerb is not quite parallel to the mapped line, the mask has 0.5 m cells) is tried again 0.35 m further
          // in, where the lanes stay open: before, every such miss ended the run, and a wide street with a wavy kerb (zs22) kept only one car in three
          if (blocked(x, z, hx, hz, L) || (!placeCar(x, z, hx, hz, model, paint, outskirts ? 0.3 : 0) && !(e + e2 - ext - 0.35 >= free && placeCar(x - nx * 0.35, z - nz * 0.35, hx, hz, model, paint, outskirts ? 0.3 : 0)))) { run = false; continue; }
          n++;
        }
      }
    }
    stats.parked = n; stats.cars_proc = carCount;
  }

  // ---------- 7. scooters along walls and kerbs, Ape taxis in the tourist piazze
  {
    let n = 0;
    const park = (x, z, ax, az, count) => {
      for (let q = 0; q < count; q++) {
        const u = (q - (count - 1) / 2) * 0.85 + R(-0.1, 0.1), px = x + ax * u, pz = z + az * u;
        if (inB(px, pz) || occHit(px, pz, 0.5) || nearWall(px, pz, 0.35)) continue;
        if (!(road(px, pz) || raisedMask(px, pz) || paving(px, pz))) continue;
        put('scooter', px, gy(px, pz), pz, Math.atan2(-az, ax) + Math.PI / 2 + R(-0.35, 0.35) + (rand() < 0.5 ? Math.PI : 0), 1, C(pick(SCOOT)));
        occAdd(px, pz, 0.5); n++;
      }
    };
    for (const o of own) {
      if (BUD.over()) yield;
      const ring = o.outer;
      for (let q = 0; q < ring.length; q++) {
        const A = ring[q], B = ring[(q + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], L = hyp2(dx, dz);
        if (L < 6) continue;
        const cxm = (A[0] + B[0]) / 2, czm = (A[1] + B[1]) / 2;
        if (!inBounds(cxm, czm, 10)) continue;
        let nx = dz / L, nz = -dx / L;
        if (inB(cxm + nx * 0.5, czm + nz * 0.5)) { nx = -nx; nz = -nz; }
        const dist = distEff(cxm, czm), pk = 0.075 * Math.max(0.2, 1 - dist / 1500) * DEN;
        for (let s = R(1, 10); s < L - 1.5; s += R(18, 40)) {
          if (rand() > pk) continue;
          const x = A[0] + dx * s / L + nx * 0.62, z = A[1] + dz * s / L + nz * 0.62;
          if (nearJunction(x, z, 5)) continue;
          park(x, z, dx / L, dz / L, 1 + Math.floor(rand() * rand() * 6));
        }
      }
    }
    stats.scooters_proc = n;
    // Apetaxi at the cathedral, Quattro Canti and Teatro Massimo piazze
    const spots = [[38.11572, 13.36126], [38.1146, 13.3558], [38.1199, 13.3573], [38.1151, 13.3622]].map(s => proj(s[0], s[1]));
    let a = 0;
    for (const [sx, sz] of spots) if (inBounds(sx, sz)) for (let t = 0; t < 400 && a < 14; t++) {
      const x = sx + R(-40, 40), z = sz + R(-40, 40);
      if (inB(x, z) || !(paving(x, z) || raisedMask(x, z)) || occHit(x, z, 2.4) || nearWall(x, z, 2) || hyp2(x - sx, z - sz) < 14) continue;
      put(rand() < 0.65 ? 'apetaxi' : 'ape', x, gy(x, z), z, R(0, TAU)); occAdd(x, z, 2); a++;
    }
    stats.apetaxi = a;
  }

  // ---------- 7b. cafe tables at real cafe/bar/restaurant positions, and people on foot
  {
    let sets = 0;
    const UMB = ['#ece4ca', '#e8dfc0', '#2f6b49', '#2f5f93', '#b73a2c', '#d9d4c2'];
    const walkable = (x, z) => !inB(x, z) && (raisedMask(x, z) || paving(x, z));
    for (const it of osm) {
      if (it.k !== 'cafe') continue;
      if (rand() > (it.out === 'yes' ? 1 : (CAFE_OUT[zoneOf(it.x, it.z)] ?? 0.45))) continue;
      const w = nearWall(it.x, it.z, 9); if (!w) continue;
      const tx = -w.nz, tz = w.nx, n = 1 + Math.floor(rand() * 3);
      let placed = 0;
      for (let i = 0; i < n; i++) {
        const u = (i - (n - 1) / 2) * 2.3, x = w.px + w.nx * 1.5 + tx * u, z = w.pz + w.nz * 1.5 + tz * u;
        if (!walkable(x, z) || occHit(x, z, 1.0) || nearWall(x, z, 1.0)) continue;
        const rot = Math.atan2(w.nx, w.nz) + R(-0.4, 0.4);
        put('cafe_set', x, gy(x, z), z, rot, 1); occAdd(x, z, 1.1); sets++; placed++;
        if (rand() < 0.55) put('umbrella', x, gy(x, z), z, R(0, TAU), 0.8, C(pick(UMB)));
      }
    }
    stats.cafe_sets = sets;
  }

  // ---------- 8. OSM parking lots: fill with parked cars
  {
    let n = 0;
    P.areas.forEach((a, ai) => {
      if (a.k !== 'parking' || a.ptype === 'multi-storey' || a.ptype === 'underground') return;
      const pts = pairs(a.p); if (pts.length < 4) return;
      const area = Math.abs(signedArea(pts)); if (area < 40 || area > 8000) return;
      const rl = rng(S.seed2 + 77 + ai * 131);   // as in 6b: the same cars on the same spots every time the tile is built
      // principal axis from the longest edge
      let best = 0, ang = 0;
      for (let i = 0; i < pts.length - 1; i++) { const l = hyp2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (l > best) { best = l; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); } }
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const u = pts.map(p => p[0] * ca + p[1] * sa), v = pts.map(p => -p[0] * sa + p[1] * ca);
      const u0 = Math.min(...u), u1 = Math.max(...u), v0 = Math.min(...v), v1 = Math.max(...v);
      const wide = (v1 - v0) > 9;   // two rows of nose-in cars, else parallel
      for (let uu = u0 + 1.3; uu < u1; uu += wide ? 2.5 : 5.3) for (let vv = v0 + 2.3; vv < v1; vv += wide ? 5.2 : 2.6) {
        const rEmpty = rl(), rm = rl(), rcol = rl(), rshade = rl(), rf1 = rl(), rf2 = rl();
        const x = uu * ca - vv * sa, z = uu * sa + vv * ca;
        if (!inPoly(pts, x, z) || rEmpty < 0.28) continue;
        const hx = wide ? -sa : ca, hz = wide ? ca : sa, model = pickBy(CARS, rm);
        placeCar(x, z, hx * (rf1 < 0.5 ? 1 : -1), hz * (rf2 < 0.5 ? 1 : -1), model, paintBy(model, rcol, rshade)) && n++;
      }
    });
    stats.cars_lots = n;
  }

  // ---------- 9. vegetation: parks, green strips, piazza palms
  {
    let n = 0;
    for (const a of S.areas) {
      if (BUD.over()) yield;
      if (a.k !== 'green') continue;
      const pts = pairs(a.p); if (pts.length < 3) continue;
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
      const x0 = Math.max(bx0, S.x0), x1 = Math.min(bx1, S.x1), z0 = Math.max(bz0, S.z0), z1 = Math.min(bz1, S.z1);
      if (x1 <= x0 || z1 <= z0) continue;
      const area = Math.abs(signedArea(pts)) * Math.min(1, (x1 - x0) * (z1 - z0) / Math.max(1, (bx1 - bx0) * (bz1 - bz0)));   // the part inside this tile
      const dens = area > 4000 ? 1 / 220 : 1 / 130;
      const want = Math.min(90, Math.floor(area * dens * DEN));
      if (n >= S.treeCap) continue;
      for (let i = 0, tries = 0; i < want && tries < want * 5; tries++) {
        const x = R(x0, x1), z = R(z0, z1);
        if (!inPoly(pts, x, z)) continue;
        const sp = treeSpec(x, z);
        if (placeTree(x, z, rand() < 0.08 ? 'shrub' : sp.m, 1, sp.t)) { i++; n++; }
      }
    }
    stats.trees_green = n;
    // n4: groves. The CTR orchards (citrus in the Conca d'Oro) and olive groves, baked as land cover, are planted: one tree per ~100 m2 up to a cap per tile, species from src/species.js
    let gv = 0;
    const gvCap = Math.round(300 * DEN);
    for (const a of S.areas) {
      if (a.k !== 'orchard' && a.k !== 'olive') continue;
      if (BUD.over()) yield;
      if (gv >= gvCap) break;
      const pts = pairs(a.p); if (pts.length < 3) continue;
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
      const x0 = Math.max(bx0, S.x0), x1 = Math.min(bx1, S.x1), z0 = Math.max(bz0, S.z0), z1 = Math.min(bz1, S.z1);
      if (x1 <= x0 || z1 <= z0) continue;
      const area = Math.abs(signedArea(pts)) * Math.min(1, (x1 - x0) * (z1 - z0) / Math.max(1, (bx1 - bx0) * (bz1 - bz0)));
      const want = Math.min(gvCap - gv, Math.floor(area / 100 * DEN));
      for (let i = 0, tries = 0; i < want && tries < want * 4; tries++) {
        const x = R(x0, x1), z = R(z0, z1);
        if (!inPoly(pts, x, z) || road(x, z) || raisedMask(x, z) || paving(x, z)) continue;
        const sp = treeSpec(x, z);
        if (placeTree(x, z, sp.m, a.k === 'orchard' ? 1.15 : 0.95, sp.t)) { i++; gv++; }
      }
    }
    stats.trees_groves = gv;
    // n4: oleanders on the medians of the avenues (Viale Regione Siciliana, the Libertà, Corso Calatafimi...): the narrow green and verge strips of the street layer beside those roads (the Comune draws Viale Regione Siciliana's median as a verge), one shrub in about 12 m2, now and then a plane tree
    {
      const MEDIAN_RE = /Regione Siciliana|Libert|Calatafimi|Corso dei Mille|Strasburgo|Notarbartolo|Viale Lazio|Viale Francia|Viale Campania|Leonardo da Vinci|Viale del Fante/;
      let mn = 0;
      for (const poly of S.green) {
        if (BUD.over()) yield;
        if (mn >= 220 * DEN) break;
        const pts = pairs(poly[0]); if (pts.length < 4) continue;
        let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
        for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
        let per = 0; for (let q = 0; q < pts.length; q++) per += hyp2(pts[(q + 1) % pts.length][0] - pts[q][0], pts[(q + 1) % pts.length][1] - pts[q][1]);
        const ar = Math.abs(signedArea(pts));
        if (Math.max(x1 - x0, z1 - z0) < 14 || 2 * ar / Math.max(per, 1) > 9) continue;   // a median is a long strip (mean width under 9 m)
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, nr = nearRoad(cx, cz, 40);
        if (!nr || !MEDIAN_RE.test(nr.road.n || '')) continue;
        const want = Math.min(60, Math.floor(ar / 12));
        for (let i = 0, tries = 0; i < want && tries < want * 5; tries++) {
          const x = R(x0, x1), z = R(z0, z1);
          if (!inPoly(pts, x, z) || !S.inBounds(x, z)) continue;
          if (rand() < 0.08 ? placeTree(x, z, 'plane', 0.8, null) : placeTree(x, z, 'shrub', R(0.9, 1.4), null)) { i++; mn++; }
        }
      }
      stats.trees_median = mn;
    }
    // piazza palms: big paved squares with only a few trees get a loose ring
    let pn = 0;
    for (const a of S.areas) {
      if (BUD.over()) yield;
      if (a.k !== 'plaza') continue;
      const pts = pairs(a.p), area = Math.abs(signedArea(pts));
      if (area < 1500 || area > 30000) continue;
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      const x0 = Math.max(Math.min(...xs), S.x0), x1 = Math.min(Math.max(...xs), S.x1), z0 = Math.max(Math.min(...zs), S.z0), z1 = Math.min(Math.max(...zs), S.z1);
      if (x1 <= x0 || z1 <= z0) continue;
      const want = Math.floor(area / 500 * DEN * Math.min(1, (x1 - x0) * (z1 - z0) / Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)))));
      for (let i = 0, tries = 0; i < want && tries < want * 12; tries++) {
        const x = R(x0, x1), z = R(z0, z1);
        if (!inPoly(pts, x, z) || nearWall(x, z, 3.5)) continue;
        const sp = treeSpec(x, z, rand() < 0.5 ? { kd: 'tall' } : null);
        if (placeTree(x, z, sp.m, 1, sp.t)) { i++; pn++; }
      }
    }
    stats.trees_piazza = pn;
    // street trees: sparse oranges / ficus on wide pavements of the bigger streets
    let sn = 0;
    for (const flat of S.curbs) {
      if (BUD.over()) yield;
      const p = pairs(flat);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 12) continue;
        const nx = -dz / L, nz = dx / L;
        for (let s = R(6, 20); s < L; s += R(11, 15)) {
          if (rand() > 0.35) continue;
          const x = a[0] + dx * s / L - nx * 1.4, z = a[1] + dz * s / L - nz * 1.4;
          if (!inBounds(x, z) || !raisedMask(x, z) || !raisedMask(x - nx * 1.4, z - nz * 1.4)) continue;   // wide pavements only
          const nr = nearRoad(x, z, 16); if (!nr || !(nr.road.k === 'primary' || nr.road.k === 'secondary' || nr.road.k === 'tertiary')) continue;
          if (nearJunction(x, z, 6) || lampNear(x, z, 3)) continue;
          const sp = treeSpec(x, z, { r: 2.6 });
          if (placeTree(x, z, sp.m, 1, sp.t)) sn++;
        }
      }
    }
    stats.trees_street = sn;
  }

  // ---------- 10. iron railings from OSM fences
  {
    const mb = new MB(), iron = C('#26272b'), panels = [];
    let segs = 0;
    for (const a of P.areas) {
      if (a.k !== 'fence' || a.b === 'handrail') continue;
      const pts = pairs(a.p);
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1], L = hyp2(B[0] - A[0], B[1] - A[1]); if (L < 0.5 || L > 120) continue;
        const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, n = Math.max(1, Math.round(L / 2.5));
        for (let k = 0; k < n; k++) {
          const x0 = A[0] + ux * L * k / n, z0 = A[1] + uz * L * k / n, x1 = A[0] + ux * L * (k + 1) / n, z1 = A[1] + uz * L * (k + 1) / n;
          const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
          if (!inBounds(mx, mz) || inB(mx, mz) || road(mx, mz)) continue;
          const g0 = gy(x0, z0), g1 = gy(x1, z1), h = 1.3, t = 0.03;
          mb.box(x0 - t, g0, z0 - t, x0 + t, g0 + h, z0 + t, iron, 0.8, 1, false);
          const pan = [[x0, g0 + 0.2, z0], [x1, g1 + 0.2, z1], [x1, g1 + h - 0.05, z1], [x0, g0 + h - 0.05, z0]];
          panels.push(pan, L / n);
          mb.face(iron, [[x0, g0 + h - 0.1, z0], [x1, g1 + h - 0.1, z1], [x1, g1 + h, z1], [x0, g0 + h, z0]], 1);
          segs++;
        }
      }
    }
    if (segs) {
      const pp = [], uv = [];
      for (let i = 0; i < panels.length; i += 2) {
        const q = panels[i], len = panels[i + 1], u = len / 0.13, v = 1.05 / 0.13;
        for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) for (const k of [a, b, c]) { pp.push(...q[k]); uv.push([0, u, u, 0][k], [0, 0, v, v][k]); }
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.computeVertexNormals();
      res.rails = { posts: mb.geo(), panels: pg };
    }
    stats.railing_spans = segs;
  }


  // ---------- 11. rubbish: bag piles, cardboard, dumped junk, kerb litter, market waste (own rng, so nothing above moves)
  {
    const rt = rng(S.seed2), RT = (a, b) => a + rt() * (b - a);
    const st = { piles: 0, cardboard: 0, dumps: 0, litter: 0, market: 0, cafeLitter: 0 };
    const pileName = () => rt() < 0.14 ? 'bag_pile3' : 'bag_pile' + Math.floor(rt() * 3);
    let megas = 0; const MEGA_CAP = S.megaCap;
    const tryMega = (x, z, nx, nz) => {   // x,z on the wall line, n points out into the street
      if (megas >= MEGA_CAP) return false;
      const tx = -nz, tz = nx, px = x + nx * 0.3, pz = z + nz * 0.3;
      for (const u of [-2.6, 0, 2.6, 3.6]) for (const v of [0.3, 1.6, 3.0]) { const qx = px + tx * u + nx * v, qz = pz + tz * u + nz * v; if (inB(qx, qz) || !lane(qx, qz)) return false; }
      if (march(px, pz, nx, nz, 9, (a2, b2) => !inB(a2, b2)) < 5.6) return false;       // the lapa must still pass
      if (occHit(px + nx * 1.5, pz + nz * 1.5, 2.6) || nearJunction(px, pz, 7)) return false;
      const burnt = rt() < (zoneOf(px, pz) === 'zen' ? 0.6 : 0.28), name = burnt ? 'mega_burnt' + Math.floor(rt() * 2) : 'mega' + Math.floor(rt() * 3);
      put(name, px, gy(px, pz), pz, Math.atan2(nx, nz), RT(0.95, 1.1)); occAdd(px + nx * 1.5, pz + nz * 1.5, 2.8); megas++; st.mega = (st.mega || 0) + 1;
      return true;
    };
    const free = (x, z) => !inB(x, z) && !occHit(x, z, 0.55);
    // a pile or dump must leave the carriageway passable: on a pavement, or at least 3 m of street across from it
    const passable = (x, z, nx, nz) => raisedMask(x, z) || paving(x, z) || march(x, z, nx, nz, 5, (a, b) => !inB(a, b)) >= 3.1;
    const lane = (x, z) => road(x, z) || raisedMask(x, z) || paving(x, z);
    const wallSpot = (A, nx, nz, s, L, dx, dz, off) => { const x = A[0] + dx * s / L + nx * off, z = A[1] + dz * s / L + nz * off; return [x, z]; };
    // piles beside the real and procedural cassonetti
    for (const [x, z, nx, nz, tx, tz, over] of binSites) {
      const sq = squalor(x, z);
      if (rt() > (over ? 0.95 : 0.3 + 0.5 * sq)) continue;
      const nn = 1 + (rt() < 0.3 * sq ? 1 : 0) + (over && rt() < 0.4 ? 1 : 0);
      for (let q = 0; q < nn; q++) {
        const px = x + tx * (q ? RT(-1.7, 1.7) : RT(-0.9, 0.9)) + nx * RT(-0.15, 0.35), pz = z + tz * (q ? RT(-1.7, 1.7) : RT(-0.9, 0.9)) + nz * RT(-0.15, 0.35);
        if (!free(px, pz) || !lane(px, pz) || !passable(px, pz, nx, nz)) continue;
        put(pileName(), px, gy(px, pz), pz, RT(0, TAU), RT(0.85, 1.15)); occAdd(px, pz, 0.5); st.piles++;
      }
    }
    for (const it of osm) {
      if (it.k === 'bin_big' && !inB(it.x, it.z) && rt() < 0.6) { const px = it.x + RT(-1.2, 1.2), pz = it.z + RT(-1.2, 1.2); if (free(px, pz) && lane(px, pz)) { put(pileName(), px, gy(px, pz), pz, RT(0, TAU)); occAdd(px, pz, 0.5); st.piles++; } }
    }
    // along building walls: loose piles, dumped junk, litter
    for (const o of own) {
      if (BUD.over()) yield;
      const ring = o.outer;
      for (let q = 0; q < ring.length; q++) {
        const A = ring[q], B = ring[(q + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], L = hyp2(dx, dz);
        if (L < 5) continue;
        const cxm = (A[0] + B[0]) / 2, czm = (A[1] + B[1]) / 2; if (!inBounds(cxm, czm, 8)) continue;
        let nx = dz / L, nz = -dx / L; if (inB(cxm + nx * 0.5, czm + nz * 0.5)) { nx = -nx; nz = -nz; }
        const sq = squalor(cxm, czm);
        for (let s = RT(1, 14); s < L - 1; s += RT(28, 60)) {
          if (sq > 0.8 && rt() < (zoneOf(cxm, czm) === 'zen' ? 0.16 : 0.06)) { const [mx, mz] = wallSpot(A, nx, nz, s, L, dx, dz, 0.0); if (tryMega(mx, mz, nx, nz)) continue; }
          const u = rt();
          if (u > 0.55 * sq * sq + 0.02) continue;
          const [x, z] = wallSpot(A, nx, nz, s, L, dx, dz, 0.5);
          if (!free(x, z) || !lane(x, z) || nearJunction(x, z, 3.5) || !passable(x, z, nx, nz)) continue;
          const kind = rt();
          if (kind < 0.55) { put(pileName(), x, gy(x, z), z, RT(0, TAU), RT(1.0, 1.5)); st.piles++; occAdd(x, z, 0.6); }
          else if (kind < 0.62) {
            const m = wpick([['dump_mattress', 3], ['dump_fridge', 2], ['dump_chair', 3], ['dump_sofa', 2], ['dump_wreck', 2]]);
            const wall = m === 'dump_mattress' || m === 'dump_fridge';
            const px = wall ? x - nx * 0.25 : x + nx * 0.2, pz = wall ? z - nz * 0.25 : z + nz * 0.2;
            put(m, px, gy(px, pz), pz, Math.atan2(nx, nz) + (wall ? 0 : RT(-0.6, 0.6)), 1); occAdd(px, pz, 0.8); st.dumps++;
          } else if (kind < 0.78) { put('cardboard', x, gy(x, z), z, Math.atan2(nx, nz) + RT(-0.3, 0.3), RT(0.8, 1.1)); st.cardboard++; occAdd(x, z, 0.7); }
          else { put('litter' + (rt() < 0.5 ? 0 : 1), x, gy(x, z) + 0.01, z, RT(0, TAU), RT(0.9, 1.3)); st.litter++; }
        }
      }
    }
    // cardboard left outside real shops
    for (const it of osm) {
      if (it.k !== 'shop' || rt() > 0.05 + 0.1 * squalor(it.x, it.z)) continue;
      const w = nearWall(it.x, it.z, 8); if (!w) continue;
      const x = w.px + w.nx * 0.55 + (-w.nz) * RT(-1.5, 1.5), z = w.pz + w.nz * 0.55 + w.nx * RT(-1.5, 1.5);
      if (!free(x, z) || !lane(x, z) || !passable(x, z, w.nx, w.nz)) continue;
      put('cardboard', x, gy(x, z), z, Math.atan2(w.nx, w.nz) + RT(-0.3, 0.3), RT(0.8, 1.1)); occAdd(x, z, 0.7); st.cardboard++;
    }
    // kerb litter in the gutter, thicker in the poor quarters
    for (const flat of S.curbs) {
      if (BUD.over()) yield;
      const p = pairs(flat);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 4) continue;
        const nx = -dz / L, nz = dx / L;
        for (let s = RT(0, 10); s < L; s += RT(14, 34)) {
          const x = a[0] + dx * s / L, z = a[1] + dz * s / L; if (!inBounds(x, z, 8)) continue;
          if (rt() > 0.02 + 0.2 * squalor(x, z) ** 2) continue;
          const gx = x + nx * 0.3, gz = z + nz * 0.3;
          if (!road(gx, gz) || occHit(gx, gz, 0.3)) continue;
          put('litter' + (rt() < 0.5 ? 0 : 1), gx, groundY(gx, gz) + 0.012, gz, Math.atan2(dx, dz) + RT(-0.3, 0.3), RT(0.8, 1.2)); st.litter++;
        }
      }
    }
    // market streets: crates, cabbage leaves and cardboard against the walls
    for (const r of S.roads) {
      if (!MARKET_RE.test(r.n || '')) continue;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 1) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = RT(1, 8); s < L; s += RT(7, 14)) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s; if (!inBounds(cx, cz, 8) || nearJunction(cx, cz, 5)) continue;
          for (const sg of [1, -1]) {
            if (rt() > 0.75) continue;
            const nx = -tz * sg, nz = tx * sg, e = march(cx, cz, nx, nz, 9, (x, z) => !inB(x, z)), e2 = march(cx, cz, -nx, -nz, 9, (x, z) => !inB(x, z));
            if (e < 1.4 || e + e2 < 4) continue;
            if (rt() < 0.3) { if (tryMega(cx + nx * e, cz + nz * e, -nx, -nz)) continue; }
            const d = e - 0.55, x = cx + nx * d, z = cz + nz * d;
            if (!free(x, z) || !lane(x, z)) continue;
            const rot = Math.atan2(-nx, -nz) + RT(-0.4, 0.4), k = rt();
            put(k < 0.45 ? 'mwaste' + Math.floor(rt() * 2) : k < 0.7 ? 'mcrates' : k < 0.85 ? 'cardboard' : pileName(), x, gy(x, z) + (k < 0.45 ? 0.012 : 0), z, rot, RT(0.85, 1.15)); occAdd(x, z, 0.7); st.market++;
            if (k < 0.45 && rt() < 0.6) { const x2 = x + tx * RT(-1.5, 1.5), z2 = z + tz * RT(-1.5, 1.5); if (free(x2, z2) && lane(x2, z2)) { put('mwaste' + Math.floor(rt() * 2), x2, gy(x2, z2) + 0.012, z2, RT(0, TAU), RT(0.8, 1.2)); st.market++; } }
          }
        }
      }
    }
    // butts and paper outside the bars
    for (const it of osm) {
      if (it.k !== 'cafe' || rt() > 0.6) continue;
      const w = nearWall(it.x, it.z, 9); if (!w) continue;
      const x = w.px + w.nx * RT(0.7, 1.6) + (-w.nz) * RT(-2, 2), z = w.pz + w.nz * RT(0.7, 1.6) + w.nx * RT(-2, 2);
      if (inB(x, z) || !lane(x, z)) continue;
      put('litter_cafe', x, gy(x, z) + 0.012, z, RT(0, TAU), RT(0.8, 1.2)); st.cafeLitter++;
    }
    stats.rubbish = st;
  }

  // ---------- 12. district flavour (own rng, so nothing above moves)
  {
    const rf = rng(S.seed3), RF = (a, b) => a + rf() * (b - a), pickF = arr => arr[Math.floor(rf() * arr.length)];
    const st = { umbrellas: 0, sunbeds: 0, kiosks: 0, plane: 0, palms: 0, lamps: 0, burnt: 0 };

    // a) beaches: rows of striped umbrellas with two sunbeds each (packed at the Mondello lido, sparse on wild strips), summer kiosks on the edge
    for (const ring of S.sand) {
      if (BUD.over()) yield;
      const pts = pairs(ring); if (pts.length < 3) continue;
      let sx0 = 1e9, sx1 = -1e9, sz0 = 1e9, sz1 = -1e9;
      for (const p of pts) { if (p[0] < sx0) sx0 = p[0]; if (p[0] > sx1) sx1 = p[0]; if (p[1] < sz0) sz0 = p[1]; if (p[1] > sz1) sz1 = p[1]; }
      const cx = (sx0 + sx1) / 2, cz = (sz0 + sz1) / 2, zn = zoneOf(cx, cz), packed = zn === 'lido' || zn === 'mondello';
      const pU = packed ? 0.5 : 0.07, alongX = (sx1 - sx0) > (sz1 - sz0);
      const ax0 = Math.max(sx0, S.x0), ax1 = Math.min(sx1, S.x1), az0 = Math.max(sz0, S.z0), az1 = Math.min(sz1, S.z1);
      if (ax1 <= ax0 || az1 <= az0) continue;
      const sA = alongX ? [ax0, ax1] : [az0, az1], sB = alongX ? [az0, az1] : [ax0, ax1];   // A runs along the shore, B across it
      for (let b = sB[0] + 3; b < sB[1]; b += 6.4) {
        if (rf() < 0.12) continue;   // an aisle
        for (let a = sA[0] + 2; a < sA[1] && st.umbrellas < 260 * DEN; a += 5.2) {
          if (rf() > pU) continue;
          const x = (alongX ? a : b) + RF(-0.4, 0.4), z = (alongX ? b : a) + RF(-0.4, 0.4);
          if (!inBounds(x, z) || !inPoly(pts, x, z) || inB(x, z) || asphalt(x, z) || occHit(x, z, 1.2)) continue;
          const y = groundY(x, z);
          put('beach_umbrella', x, y, z, RF(0, TAU), RF(0.95, 1.12), C(pickF(BEACH_UMB))); st.umbrellas++;
          const base = alongX ? 0 : Math.PI / 2, sc = C(pickF(['#f1eee6', '#f1eee6', '#e6d9b8', '#cfe3ee']));
          for (const side of [-1, 1]) {
            const sx = x + (alongX ? 0 : side * 0.95), sz = z + (alongX ? side * 0.95 : 0);
            put('sunbed', sx, groundY(sx, sz), sz, base + RF(-0.25, 0.25), 1, sc); st.sunbeds++;
          }
          occAdd(x, z, 1.4);
        }
      }
      // kiosks and cabins along the shore edge
      let kk = 0;
      for (let i = 0; i < pts.length && kk < 5; i += Math.max(1, Math.floor(pts.length / 14))) {
        if (rf() > (packed ? 0.6 : 0.1)) continue;
        const A = pts[i], dx = cx - A[0], dz = cz - A[1], dl = hyp2(dx, dz) || 1;
        const x = A[0] + dx / dl * 3.2, z = A[1] + dz / dl * 3.2;
        if (!inBounds(x, z) || !inPoly(pts, x, z) || inB(x, z) || road(x, z) || occHit(x, z, 2.4)) continue;
        put('kiosk', x, groundY(x, z), z, Math.atan2(dx, dz), RF(0.95, 1.1), C(pickF(['#ffffff', '#f2ece0', '#e4eef0']))); occAdd(x, z, 2.4); st.kiosks++; kk++;
      }
    }

    // b) planes along Via della Liberta and the other grand avenues of the 1960s grid; palms along the seafronts
    const AVENUE = /^(Via|Viale) della Libertà$/, FRONT = /Regina Elena|Lungomare|Foro Italico|Piano di Gallo|Viale Marina|Lido/;
    // Streets whose real canopy closes over the carriageway, read off the Mapillary photos of the faithfulness survey (round 2: po02 and po31 planes and jacaranda, zi08 and zi09 plane rows, su13 pollarded planes, su18 broadleaves, pt10 plane and ficus, pt12 ficus); the same planting is carried along the whole named street, which the photos do not show: [name, tree, scale, spacing in m]
    const CANOPY = [[/Ruggero Settimo|^Viale Lazio$|Imperatore Federico/, 'plane', 1.55, 11], [/^Viale Michelangelo$/, 'plane_bare', 1.55, 11], [/Ernesto Basile/, 'plane_bare', 1.15, 11], [/Filippo Paruta/, 'tree', 1.55, 10], [/Domenico Costantino/, 'ficus', 1.1, 14], [/Regione Siciliana/, 'pine', 1.15, 22]];   // (Viale Regione Siciliana: its outer edges here, the strip on the left of its one-way ways below)
    for (const r of S.roads) {
      const nm = r.n || '';
      const lib = AVENUE.test(nm), front = FRONT.test(nm) && DRIVE.has(r.k), can = !lib && !front ? CANOPY.find(c => c[0].test(nm)) : null;
      let grand = false;
      if (!lib && !front && !can && (r.k === 'primary' || r.k === 'secondary') && r.p.length >= 4) { const zn = zoneOf(r.p[0], r.p[1]); grand = zn === 'viaLib' || zn === 'sacco' || zn === 'resut'; }
      if (!lib && !front && !grand && !can) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = can ? 1 + 5 * hash3(a[0], a[1], i) : RF(1, 6); s < L; s += front ? 13 : lib ? 10.5 : can ? can[3] : 15) {   // (the canopy streets take no number from the flavour generator, so nothing after them moves)
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (nearJunction(cx, cz, 7) && !front) continue;
          for (const sg of [1, -1]) {
            if (can && sg === -1 && r.o === 1 && /Regione Siciliana/.test(nm)) continue;   // (the left of a one-way way of the Viale is its separator: planted below)
            if (!lib && !can && rf() > (front ? 0.7 : 0.5)) continue;
            const nx = -tz * sg, nz = tx * sg, e = march(cx, cz, nx, nz, 18, road); if (e < 1) continue;
            const d = e + (front ? 1.5 : 1.8), x = cx + nx * d, z = cz + nz * d;
            if (!inBounds(x, z) || (!can && !raisedMask(x, z) && !paving(x, z))) continue;
            if (front ? placeTree(x, z, pickF(['palm_fan_a', 'palm_fan_b', 'palm_fan_a', 'palm_date_a'])) : can ? placeTree(x, z, can[1] === 'plane' && /Ruggero Settimo/.test(nm) && hash3(x * 0.37, z * 0.59, 9.1) < 0.22 ? 'jacaranda' : can[1], can[2], null) : placeTree(x, z, lib || grand ? 'plane' : 'tree', lib ? 1.45 : 0.9, null)) { if (front) st.palms++; else st.plane++; }
          }
        }
      }
    }

    // Viale Regione Siciliana's separators (tr9; photos su08, su09, zs12, zs20, zw47, lm24): a row of stone pines, a palm now and then, down the middle of the strip between the two carriageways and
    // between a carriageway and its side lane. (The rule of the canopy streets above put a pine every 22 m 1.8 m off the asphalt on both sides of every way of the Viale: two rows in a wide median and
    // trunks on the guard rail in a narrow one; it keeps the outer edges.) The Viale's ways are all one-way and traffic keeps right, so the strip is on the left of travel. Where it is:
    // from the asphalt edge on the left, across the ground to the next asphalt within SEP_MAX m, which must be another way of the Viale running alongside it (a cross street or a slip road is no separator).
    // Under SEP_MIN m there is no room; under SEP_RAIL m the guard rail stands in the middle (src/expressway.js: one rail where the edges are under 6 m apart), so the trunk stands ROW_RAIL m beside it;
    // up to SEP_ONE m one row in the middle, wider strips (a lay-by, a garden) a row SEP_EDGE m in from each side. The two ways of a strip share its middle row: no tree within ROW_GAP m of another.
    {
      const VIALE = /Regione Siciliana/, VDRIVE = new Set(['primary', 'secondary', 'tertiary']), SEP_MIN = 2.4, SEP_RAIL = 6, SEP_ONE = 16, SEP_MAX = 34, SEP_EDGE = 3.2, ROW_STEP = 11, ROW_GAP = 8, ROW_RAIL = 0.7;
      const near2 = (list, x, z, rr) => { for (const q of list) if (hyp2(q[0] - x, q[1] - z) < rr) return true; return false; };
      let sn = 0;
      for (const r of S.roads) {
        if (!VDRIVE.has(r.k) || r.o !== 1 || r.tn || r.br || r.j === 'roundabout' || !VIALE.test(r.n || '') || r.p.length < 4) continue;
        if (BUD.over()) yield;
        const p = pairs(r.p);
        for (let i = 0; i < p.length - 1; i++) {
          const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
          const tx = dx / L, tz = dz / L, nx = tz, nz = -tx;   // (nx, nz): left of travel
          for (let s = ROW_STEP * hash3(a[0], a[1], 4.4); s < L; s += ROW_STEP) {
            const cx = a[0] + tx * s, cz = a[1] + tz * s;
            if (!inBounds(cx, cz) || nearJunction(cx, cz, 9)) continue;
            const e = march(cx, cz, nx, nz, 18, road); if (e < 1) continue;
            let g = -1; for (let q = e + 0.6; q <= e + SEP_MAX; q += 0.3) if (road(cx + nx * q, cz + nz * q)) { g = q - e - 0.3; break; }
            if (g < SEP_MIN) continue;
            const o = nearRoad(cx + nx * (e + g + 1.5), cz + nz * (e + g + 1.5), 6);
            if (!o || o.road === r || !VIALE.test(o.road.n || '') || Math.abs(o.tx * tx + o.tz * tz) < 0.8) continue;
            const d = g < SEP_RAIL ? e + g / 2 + ROW_RAIL : g <= SEP_ONE ? e + g / 2 : e + SEP_EDGE, x = cx + nx * d, z = cz + nz * d;
            if (!inBounds(x, z) || near2(treePts, x, z, ROW_GAP) || nearJunction(x, z, 9)) continue;
            const u = hash3(x * 0.61, z * 0.37, 2.9), kind = u < 0.12 ? 'palm_fan_a' : u < 0.2 ? 'palm_date_a' : 'pine';
            if (placeTree(x, z, kind, kind === 'pine' ? 1.15 : 1.0, null)) sn++;
          }
        }
      }
      st.viale_sep = sn;
    }

    // the Libertà is lined with clipped hedges between the carriageway and the gardens
    for (const r of S.roads) {
      if (!AVENUE.test(r.n || '')) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = 1.5; s < L - 1.5; s += 3.1) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (nearJunction(cx, cz, 9)) continue;
          for (const sg of [1, -1]) {
            const nx = -tz * sg, nz = tx * sg, e = march(cx, cz, nx, nz, 18, road); if (e < 1) continue;
            const x = cx + nx * (e + 0.75), z = cz + nz * (e + 0.75);
            if (!inBounds(x, z) || !(raisedMask(x, z) || paving(x, z)) || inB(x, z) || occHit(x, z, 0.7) || nearWall(x, z, 1.0)) continue;
            put('hedge', x, gy(x, z), z, Math.atan2(-tz, tx), 1, C('#ffffff').multiplyScalar(RF(0.9, 1.08))); st.hedges = (st.hedges || 0) + 1;
          }
        }
      }
    }

    // c) street lamps on the residential grid (the procedural poles above only follow the primary to tertiary roads)
    const rl = [];
    for (const r of S.roads) {
      if (r.k !== 'residential' && r.k !== 'unclassified' && r.k !== 'living_street') continue;
      if (BUD.over()) yield;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 8) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = RF(4, 16); s < L; s += 34 + RF(0, 12)) {
          if (rf() > 0.62 * Math.min(1, DEN + 0.25)) continue;
          const cx = a[0] + tx * s, cz = a[1] + tz * s, sg = rf() < 0.5 ? 1 : -1, nx = -tz * sg, nz = tx * sg;
          if (!inBounds(cx, cz)) continue;
          const e = march(cx, cz, nx, nz, 9, road); if (e < 1) continue;
          const x = cx + nx * (e + 0.55), z = cz + nz * (e + 0.55);
          if (!inBounds(x, z) || !(raisedMask(x, z) || paving(x, z)) || inB(x, z) || nearWall(x, z, 0.6) || nearJunction(x, z, 5)) continue;
          if (lampNear(x, z, 24) || rl.some(q => hyp2(q[0] - x, q[1] - z) < 24)) continue;
          rl.push([x, z]); put('lamp_pole', x, gy(x, z), z, Math.atan2(nx, nz) + Math.PI / 2); occAdd(x, z, 0.5); st.lamps++;
        }
      }
    }
    // d) the villa quarters of Mondello, Valdesi and Partanna (src/gardens.js turns their yards green): Aleppo and umbrella pines, palms, ficus,
    // citrus and oleander between the houses, as on the aerial photos where the roofs sit in a dark green canopy; pavements and the piazzas stay clear
    if (S.x1 > -3950 && S.x0 < -2150 && S.z1 > -10750 && S.z0 < -8650) {
      const GK = [['pine', 20], ['palm_fan_a', 8], ['palm_fan_b', 6], ['palm_date_a', 6], ['ficus', 8], ['orange', 16], ['tree', 14], ['shrub', 12]];
      const gpick = () => { let t = rf() * 104; for (const [v, w] of GK) { if ((t -= w) <= 0) return v; } return 'tree'; };
      const KEEP = [[-3060, -10150, 85], [-2995, -10120, 50], [-2500, -8960, 45]];
      let gn = 0;
      for (let x = Math.max(S.x0, -3950); x < Math.min(S.x1, -2150) && gn < 520 * DEN; x += 8) {
        if (BUD.over()) yield;
        for (let z = Math.max(S.z0, -10750); z < Math.min(S.z1, -8650); z += 8) {
          if (rf() > 0.3 * Math.min(1, DEN + 0.3)) continue;
          const px = x + RF(-3.6, 3.6), pz = z + RF(-3.6, 3.6);
          if (!inBounds(px, pz) || !raisedMask(px, pz) || road(px, pz) || inB(px, pz) || paving(px, pz) || groundY(px, pz) < 1.0) continue;
          if (KEEP.some(k => hyp2(px - k[0], pz - k[1]) < k[2])) continue;
          if (nearRoad(px, pz, 4.2)) continue;
          if (placeTree(px, pz, gpick(), 1.0)) gn++;
        }
      }
      st.gardenTrees = gn;
    }
    stats.flavour = st;
  }

  // ---------- 12f. street life of the country towns (Villabate photos): a produce stall on the pavement in front of each greengrocer (own rng, so nothing above moves)
  {
    const rt = rng(S.seed3 + 4141), CRATE = ['#d9701f', '#e6d9b0', '#7aa23a', '#c0392b'];
    let n = 0;
    for (const it of osm) {
      if (it.k !== 'shop' || it.shop !== 'greengrocer') continue;
      const zn = ZONES[zoneOf(it.x, it.z)]; if (!zn || !zn.town) continue;
      const r1 = rt(), r2 = rt(); if (r1 < 0.25) continue;
      const w = nearWall(it.x, it.z, 7); if (!w) continue;
      const x = w.px + w.nx * 1.35, z = w.pz + w.nz * 1.35;
      if (inB(x, z) || (asphalt(x, z) && !raisedMask(x, z) && !paving(x, z)) || occHit(x, z, 1.1) || nearWall(x, z, 0.6)) continue;
      put('stall_table', x, gy(x, z), z, Math.atan2(w.nx, w.nz), 1); occAdd(x, z, 1.1); n++;
      if (r2 < 0.6) put('umbrella', x, gy(x, z), z, r2 * 6, 0.8, C(CRATE[Math.floor(r2 * 4) % 4]));
    }
    stats.town_stalls = n;
  }

  // ---------- 13. street trees along the streets of the towns and the countryside around Palermo (the old avenues have theirs in 12 b; the centre and its belts keep what they have)
  // The planting follows the street class and how built-up the place is (builtUp): planes, ficus and carob along the roads of a town, a mix of pines, olive and carob in the open country, stone
  // pines both sides of the fast roads. Every draw comes from a hash of the spot, so a tile built again plants the same trees; at most 160 a tile (the phone), thinned evenly over its roads.
  // Never: within 8 m of a junction, on a crossing, in front of a door (a wall within 1.7 m), on a slope or beside the sea, on the asphalt, nearer than 6 m to another tree.
  {
    const STREET_TREE = { primary: [11, 0.75], secondary: [11, 0.75], tertiary: [11, 0.7], unclassified: [12, 0.5], residential: [12, 0.5], living_street: [14, 0.3], service: [18, 0.12] };   // [spacing in m, chance of a tree at a spot]
    const MIX_MAIN = [['plane', 36], ['ficus', 22], ['carob', 16], ['stone', 8], ['holm', 6], ['canary', 6], ['wash', 6]];
    const MIX_TOWN = [['ficus', 24], ['carob', 22], ['citrus', 22], ['plane', 14], ['olive', 8], ['wash', 5], ['canary', 5]];
    const MIX_EDGE = [['plane', 14], ['carob', 22], ['stone', 16], ['aleppo', 14], ['olive', 14], ['ficus', 10], ['holm', 10]];
    const MIX_OPEN = [['stone', 24], ['aleppo', 24], ['olive', 22], ['carob', 16], ['holm', 14]];
    const MIX_FAST = [['stone', 70], ['aleppo', 12], ['holm', 8], ['carob', 10]];
    const TREE_CAP = Math.round(200 * DEN), near2 = (list, x, z, r) => { for (const q of list) if (hyp2(q[0] - x, q[1] - z) < r) return true; return false; }, tspot = (x, z, k) => hash3(x * 0.37 + k, z * 0.53, k * 3.1);
    const spOf = (code, x, z) => { const [model, hex] = SP[code]; return { m: model === 'palm_date' ? 'palm_date_b' : model === 'palm_fan' ? (tspot(x, z, 1) < 0.5 ? 'palm_fan_a' : 'palm_fan_b') : model, t: tintOf(hex) }; };
    const eligible = [];
    let want = 0;   // the trees the whole tile would plant: to thin evenly when that is more than the cap
    for (const r of S.roads) {
      const cl = STREET_TREE[r.k]; if (!cl || r.br || r.tn || r.j === 'roundabout' || r.p.length < 4) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p); let L = 0; for (let i = 0; i < p.length - 1; i++) L += hyp2(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      if (L < 16) continue;
      const mid = p[p.length >> 1];
      if (oldCity(mid[0], mid[1], r.n)) continue;
      const fast = (r.ms || 0) >= 60 || viale(r, mid[0], mid[1]), bu = fast ? 0 : builtUp(mid[0], mid[1]);
      if (!fast && bu < 0.05 && r.k === 'service') continue;
      const f = fast ? 0.7 : bu > 0.5 ? 1 : bu > 0.2 ? 0.7 : 0.35;
      eligible.push({ r, p, f, fast, bu, cl }); want += 2 * L / cl[0] * cl[1] * f;
    }
    const scale = want > TREE_CAP ? TREE_CAP / want : 1;
    let tn = 0;
    for (const { r, p, f, fast, bu, cl } of eligible) {
      if (tn >= TREE_CAP) break;
      if (BUD.over()) yield;
      const mix = fast ? MIX_FAST : bu > 0.5 ? (r.k === 'residential' || r.k === 'unclassified' || r.k === 'living_street' || r.k === 'service' ? MIX_TOWN : MIX_MAIN) : bu > 0.2 ? MIX_EDGE : MIX_OPEN;
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = cl[0] * (0.3 + 0.7 * tspot(a[0], a[1], 7)); s < L; s += cl[0]) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (!inBounds(cx, cz) || nearJunction(cx, cz, 8) || near2(zebras, cx, cz, 5)) continue;
          for (const sg of [1, -1]) {
            if (tspot(cx, cz, sg + 11) > cl[1] * f * scale) continue;
            const nx = -tz * sg, nz = tx * sg, e = march(cx, cz, nx, nz, 12, road); if (e < 1 || e > 11) continue;
            const x = cx + nx * (e + (fast ? 3.5 : 1.7)), z = cz + nz * (e + (fast ? 3.5 : 1.7));
            if (!inBounds(x, z) || road(x, z) || inB(x, z) || nearWall(x, z, 1.7) || treeCleared(x, z) || nearJunction(x, z, 8) || near2(zebras, x, z, 4) || near2(treePts, x, z, 6) || lampNear(x, z, 2.5) || nearFence(x, z, 1.3) || nearBridge(x, z)) continue;
            const y = groundY(x, z); if (y < 1.0 || Math.abs(y - groundY(cx, cz)) > 1.5 || fall(x, z) > 0.3) continue;
            const sp = spOf(pickBy(mix, tspot(x, z, 5)), x, z);
            if (placeTree(x, z, sp.m, 1.05 + 0.25 * tspot(x, z, 9), sp.t)) tn++;
          }
        }
      }
    }
    stats.trees_street2 = tn;
  }

  // ---------- 14. furniture of the roads at the edge of town and in the country (own random stream: nothing above moves)
  // a) poles of the electricity and telephone lines, one row along a road (on one side of it, the same side all the way) with the wires between them, as in the photos of the villages and the
  // lanes of the west and south-east; one merged mesh of wires per tile (res.wires). b) lamps along the roads that have houses but no pavement (the procedural lamps above want a kerb).
  // Never in the old centre or its belts, on the fast roads (the expressways have their lamps and rails), within 5 m of a junction, on a crossing, in front of a door or on the asphalt.
  {
    const POLE_ROADS = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service']);   // (half of the service lanes)
    const pspot = (x, z, k) => hash3(x * 0.41 + k, z * 0.29, k * 2.3);
    const near2 = (list, x, z, r) => { for (const q of list) if (hyp2(q[0] - x, q[1] - z) < r) return true; return false; };
    // the tram avenues carry their own overhead lines: no pole row of this beside them (a tram rail within 35 m)
    const trams = [];
    for (const ln of S.tram || []) for (let i = 0; i + 3 < ln.length; i += 2) {
      if (Math.max(ln[i], ln[i + 2]) > S.x0 - 40 && Math.min(ln[i], ln[i + 2]) < S.x1 + 40 && Math.max(ln[i + 1], ln[i + 3]) > S.z0 - 40 && Math.min(ln[i + 1], ln[i + 3]) < S.z1 + 40) trams.push([ln[i], ln[i + 1], ln[i + 2], ln[i + 3]]);
    }
    const nearTram = (x, z) => {
      for (const q of trams) {
        const dx = q[2] - q[0], dz = q[3] - q[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - q[0]) * dx + (z - q[1]) * dz) / l2));
        if (hyp2(x - q[0] - dx * t, z - q[1] - dz * t) < 35) return true;
      }
      return false;
    };
    const wm = new MB(), wcol = C('#1c1c1f');
    // a wire from (a) to (b) hanging by `sag` in the middle: a flat ribbon and an upright one crossed, 0.05 m wide
    const wire = (ax, ay, az, bx, by, bz, sag) => {
      const N = 5; let px = ax, py = ay, pz = az;
      for (let i = 1; i <= N; i++) {
        const u = i / N, x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = ay + (by - ay) * u - 4 * sag * u * (1 - u);
        const dx = x - px, dz = z - pz, l = hyp2(dx, dz) || 1, hx = -dz / l * 0.025, hz = dx / l * 0.025;
        wm.face(wcol, [[px - hx, py, pz - hz], [x - hx, y, z - hz], [x + hx, y, z + hz], [px + hx, py, pz + hz]]);
        wm.face(wcol, [[px, py - 0.025, pz], [x, y - 0.025, z], [x, y + 0.025, z], [px, py + 0.025, pz]]);
        px = x; py = y; pz = z;
      }
    };
    const lampHere = (x, z, r) => {   // a lamp pole of any of the rows so far (the real ones, the kerb rows of 4 and 12 c, these)
      if (lampsReal.some(q => hyp2(q.x - x, q.z - z) < r)) return true;
      const b = buckets.lamp_pole; if (b) for (const e of b.values()) for (let i = 0; i < e.m.length; i += 5) if (hyp2(e.m[i] - x, e.m[i + 2] - z) < r) return true;
      return false;
    };
    let np = 0, nl = 0, nw = 0;
    const POLE_CAP = Math.round(120 * DEN), LAMP_CAP = Math.round(60 * DEN);
    for (const r of S.roads) {
      if (!DRIVE.has(r.k) || r.br || r.tn || r.j === 'roundabout' || r.p.length < 4) continue;
      if (!POLE_ROADS.has(r.k)) continue;
      const p = pairs(r.p); let L = 0; for (let i = 0; i < p.length - 1; i++) L += hyp2(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      if (L < 30) continue;
      const mid = p[p.length >> 1];
      if (oldCity(mid[0], mid[1], r.n)) continue;
      if ((r.ms || 0) >= 60 || /Regione Siciliana/.test(r.n || '') || r.k === 'service' && pspot(p[0][0], p[0][1], 3) > 0.5) continue;
      const bu = builtUp(mid[0], mid[1]);
      if (bu > 0.9 && pspot(p[0][0], p[0][1], 5) > 0.35) continue;   // the dense streets carry their wires on the facades
      const side = pspot(p[0][0], p[0][1], 1) < 0.5 ? 1 : -1;
      if (BUD.over()) yield;
      let prev = null, carry = 12 + 24 * pspot(p[0][0], p[0][1], 2);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = hyp2(dx, dz); if (L2 < 1) continue;
        const tx = dx / L2, tz = dz / L2, nx = -tz * side, nz = tx * side;
        let s = carry;
        for (; s < L2; s += 38 + 8 * pspot(a[0] + s, a[1], 4)) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (!inBounds(cx, cz) || nearJunction(cx, cz, 5) || near2(zebras, cx, cz, 3)) { prev = null; continue; }
          const e = march(cx, cz, nx, nz, 12, road); if (e < 1 || e > 11) { prev = null; continue; }
          const x = cx + nx * (e + 1.0), z = cz + nz * (e + 1.0);
          if (!inBounds(x, z) || road(x, z) || inB(x, z) || nearWall(x, z, 0.9) || occHit(x, z, 0.5) || treeCleared(x, z) || nearFence(x, z, 0.8) || nearBridge(x, z) || (trams.length && nearTram(x, z))) { prev = null; continue; }
          const y = groundY(x, z); if (y < 0.8 || Math.abs(y - groundY(cx, cz)) > 1.8 || fall(x, z) > 0.4) { prev = null; continue; }
          if (np >= POLE_CAP) break;
          const conc = pspot(x, z, 6) < 0.45;   // concrete poles in the new quarters, wood elsewhere
          put('utility_pole', x, y, z, Math.atan2(nx, nz), 1, conc ? C('#ffffff') : C('#9a7a58'));
          occAdd(x, z, 0.5); np++;
          if (prev && hyp2(prev[0] - x, prev[2] - z) < 62 && Math.abs(prev[1] - y) < 5) {   // a span: three conductors from the cross arm of the one pole to that of the next
            for (const o of [-0.8, 0, 0.8]) wire(prev[0] + prev[3] * o, prev[1] + 8.95, prev[2] + prev[4] * o, x + nx * o, y + 8.95, z + nz * o, 0.014 * hyp2(prev[0] - x, prev[2] - z));
            nw++;
          }
          prev = [x, y, z, nx, nz];
        }
        carry = Math.max(0, s - L2);
      }
    }
    // b) lamps on the roads with houses but no pavement
    {
      for (const r of S.roads) {
        if (nl >= LAMP_CAP) break;
        if (!(r.k === 'primary' || r.k === 'secondary' || r.k === 'tertiary' || r.k === 'unclassified' || r.k === 'residential') || r.br || r.tn || r.j === 'roundabout' || r.p.length < 4) continue;
        if ((r.ms || 0) >= 60 || /Regione Siciliana/.test(r.n || '')) continue;
        const p = pairs(r.p), mid = p[p.length >> 1];
        if (oldCity(mid[0], mid[1], r.n)) continue;
        const bu = builtUp(mid[0], mid[1]); if (bu < 0.25) continue;
        if (BUD.over()) yield;
        const side = pspot(p[0][0], p[0][1], 9) < 0.5 ? 1 : -1;
        for (let i = 0; i < p.length - 1; i++) {
          const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = hyp2(dx, dz); if (L2 < 8) continue;
          const tx = dx / L2, tz = dz / L2, nx = -tz * side, nz = tx * side;
          for (let s = 6 + 14 * pspot(a[0], a[1], 10); s < L2 - 3; s += 40 + 12 * pspot(a[0] + s, a[1], 11)) {
            const cx = a[0] + tx * s, cz = a[1] + tz * s;
            if (!inBounds(cx, cz) || pspot(cx, cz, 12) > 0.5 + 0.5 * bu) continue;
            const e = march(cx, cz, nx, nz, 12, road); if (e < 1 || e > 11) continue;
            const x = cx + nx * (e + 0.7), z = cz + nz * (e + 0.7);
            if (!inBounds(x, z) || road(x, z) || raisedMask(x, z) || inB(x, z) || nearWall(x, z, 0.8) || nearJunction(x, z, 6) || near2(zebras, x, z, 3) || lampHere(x, z, 30) || treeCleared(x, z) || nearFence(x, z, 0.8) || nearBridge(x, z)) continue;
            const y = groundY(x, z); if (y < 0.8 || Math.abs(y - groundY(cx, cz)) > 1.8 || fall(x, z) > 0.4) continue;
            put('lamp_pole', x, y, z, Math.atan2(nx, nz) + Math.PI / 2); occAdd(x, z, 0.5); nl++;
          }
        }
      }
    }
    // c) street lamps hung on a wire across the street from facade to facade, as in the blocks of flats of the 1960s and 70s quarters (zs22, Via Guadagna): on a built-up
    // street outside the walled town with houses of three floors or more on both sides, at most 26 m apart, one span every 26 to 38 m on about half of such streets.
    // The wire and the lamp go into the same wire mesh (no new draw call). At night they light like the other street lamps: their bulbs ride on the wire mesh (res.wireLamps:
    // x, ground y, z, height of the lens above the ground), which src/daynight.js reads into its halos and pools of light.
    let nc = 0; const wireLamps = [];
    {
      const bAt = S.idx.bAt, CAT_CAP = Math.round(50 * DEN), lampCol = C('#3a3b3d'), lensCol = C('#e9e6d8');
      const facade = (cx, cz, nx, nz) => {   // the first building wall from the centre line along (nx, nz), within 16 m: [distance, building]
        for (let d = 1.5; d <= 16; d += 0.5) { const o = bAt(cx + nx * d, cz + nz * d); if (o) return [d, o]; }
        return null;
      };
      for (const r of S.roads) {
        if (nc >= CAT_CAP) break;
        if (!(r.k === 'residential' || r.k === 'tertiary' || r.k === 'secondary' || r.k === 'unclassified' || r.k === 'living_street') || r.br || r.tn || r.j === 'roundabout' || r.p.length < 4) continue;
        if ((r.ms || 0) >= 60 || /Regione Siciliana/.test(r.n || '') || isFastRoad(r)) continue;
        const p = pairs(r.p), mid = p[p.length >> 1];
        if (hyp2(mid[0], mid[1]) < 1100 || pspot(p[0][0], p[0][1], 21) > 0.5 || builtUp(mid[0], mid[1]) < 0.6) continue;   // (not in the walled town: its lamps are on brackets on the walls)
        if (BUD.over()) yield;
        for (let i = 0; i < p.length - 1 && nc < CAT_CAP; i++) {
          const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = hyp2(dx, dz); if (L2 < 10) continue;
          const tx = dx / L2, tz = dz / L2, nx = -tz, nz = tx;
          for (let s = 8 + 12 * pspot(a[0], a[1], 22); s < L2 - 6; s += 26 + 12 * pspot(a[0] + s, a[1], 23)) {
            const cx = a[0] + tx * s, cz = a[1] + tz * s;
            if (!inBounds(cx, cz) || nearJunction(cx, cz, 10) || !road(cx, cz)) continue;
            const fl = facade(cx, cz, nx, nz), fr = facade(cx, cz, -nx, -nz);
            if (!fl || !fr || fl[0] + fr[0] > 26 || fl[1].h < 9 || fr[1].h < 9) continue;
            const lx = cx + nx * (fl[0] - 0.35), lz = cz + nz * (fl[0] - 0.35), rx = cx - nx * (fr[0] - 0.35), rz = cz - nz * (fr[0] - 0.35);
            const y = Math.max(groundY(lx, lz), groundY(rx, rz), groundY(cx, cz)) + Math.min(7.4, Math.min(fl[1].h, fr[1].h) - 1.5), span = fl[0] + fr[0], sag = 0.012 * span + 0.15;
            wire(lx, y, lz, rx, y, rz, sag);
            // the lamp: a short stem from the lowest point of the wire and a flat shade with a pale lens under it
            const mx = (lx + rx) / 2, mz = (lz + rz) / 2, my = y - sag, hs = 0.28;
            wm.box(mx - 0.03, my - 0.45, mz - 0.03, mx + 0.03, my, mz + 0.03, lampCol);
            wm.frust(my - 0.62, [mx - hs, mz - hs, mx + hs, mz + hs], my - 0.45, [mx - 0.1, mz - 0.1, mx + 0.1, mz + 0.1], lampCol, 0.7, 1, false);
            wm.face(lensCol, [[mx - hs + 0.03, my - 0.625, mz - hs + 0.03], [mx + hs - 0.03, my - 0.625, mz - hs + 0.03], [mx + hs - 0.03, my - 0.625, mz + hs - 0.03], [mx - hs + 0.03, my - 0.625, mz + hs - 0.03]]);
            const gm = groundY(mx, mz); wireLamps.push(mx, gm, mz, my - 0.66 - gm);
            nc++; nw++;
          }
        }
      }
    }
    if (nw) { res.wires = wm.geo(); if (wireLamps.length) res.wireLamps = new Float32Array(wireLamps); }
    stats.poles_rural = np; stats.wire_spans = nw; stats.lamps_rural = nl; stats.catenary = nc;
  }

  return res;
}

// ------------------------------------------------------------------ instances -> meshes
// How far (m) each model is drawn; the cell meshes are culled by distance in the scene's onBeforeRender
const FAR = { bag_pile3: 260, mega0: 420, mega1: 420, mega2: 420, mega_burnt0: 420, mega_burnt1: 420, bag_pile0: 220, bag_pile1: 220, bag_pile2: 220, bin_over: 380, cardboard: 220, dump_mattress: 260, dump_fridge: 260, dump_chair: 260, dump_sofa: 260, dump_wreck: 260, litter0: 110, litter1: 110, litter_cafe: 110, mwaste0: 160, mwaste1: 160, mcrates: 200, cafe_set: 280, scooter: 300, bin_small: 250, bags: 250, bollard: 280, hydrant: 200, phone: 250, postbox: 200, cabinet: 200, bench: 300, lamp_wall: 320, awning: 300, stall_table: 320, umbrella: 340,
  signal: 350, signal_arm: 380, busstop: 300, bin_big: 380, panda: 130, punto: 130, smart: 130, van: 130, ape: 500, apetaxi: 500, lamp_pole: 650, utility_pole: 500, candelabra: 450, monument: 600, monument_s: 600, shelter: 350, fountain: 600,
  shrub: 350, ficus: 1300, holm_b: 1100, jacaranda: 1000, tree: 1000, holm: 1100, orange: 800, pine: 1100, pine_b: 1100, plane: 1100, plane_b: 1100, plane_bare: 1100, plane_bare_b: 1100, aleppo: 1100, palm_fan_a: 1300, palm_fan_b: 1500, palm_fan_c: 1100, palm_date_a: 1100, palm_date_b: 1200,
  beach_umbrella: 420, sunbed: 220, kiosk: 450, hedge: 260 };
const WHITE_IC = new THREE.Color(1, 1, 1);
let ZEBRA_MAT = null, PANEL_MAT = null;
const zebraMat = () => ZEBRA_MAT ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
const panelMat = () => {
  if (PANEL_MAT) return PANEL_MAT;
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8; const g = cv.getContext('2d');
  g.fillStyle = '#26272b'; g.fillRect(3, 0, 2, 8); g.fillRect(0, 3, 8, 0);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter;
  return PANEL_MAT = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 0.8 });
};

// One profile for every device (docs/PERF.md): prop density, draw distance factor and the per-frame build budget (ms).
const PDEN = 0.8, PFAR = 0.85, PBUD = 3;

// Turns the generated buckets into InstancedMeshes (one per model and 250 m cell) under `parent`.
function* instantiate(res, parent, BUD) {
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const meshes = [], meshOf = {}, geos = []; let tris = 0, total = 0;
  for (const [name, cells] of Object.entries(res.buckets)) {
    const M = MODELS[name], per = M.geo.attributes.position.count / 3;
    for (const [ckey, e] of cells.entries()) {
      const n = e.m.length / 5;
      const im = new THREE.InstancedMesh(M.geo, MATS[M.mat], n); im.name = 'prop_' + name; im.matrixAutoUpdate = false;   // [perf pass] a cell never moves (its instances do, through the instance matrices); a frozen matrix is not composed and multiplied every frame
      for (let i = 0; i < n; i++) {
        q4.setFromAxisAngle(up, e.m[i * 5 + 3]);
        if (TREE_LIKE.has(name)) { const k = e.m[i * 5 + 4], px = e.m[i * 5], pz = e.m[i * 5 + 2]; s3.set(k * (0.86 + 0.28 * hash3(px, pz, 1.7)), k * (0.82 + 0.36 * hash3(px, pz, 5.9)), k * (0.86 + 0.28 * hash3(px, pz, 3.3))); }   // no two trees of one species are one shape: wider or narrower, taller or squatter
        else s3.setScalar(e.m[i * 5 + 4]);
        m4.compose(p3.set(e.m[i * 5], e.m[i * 5 + 1], e.m[i * 5 + 2]), q4, s3); im.setMatrixAt(i, m4);
        // [perf pass] every pooled mesh gets an instance colour (white when untinted): the shared materials otherwise flip between
        // 'with / without instanceColor' from one mesh to the next and three re-derives the program parameters (a few MB of garbage per frame).
        im.setColorAt(i, M.tint ? (TREE_LIKE.has(name) ? col.setRGB(e.c[i * 3] * (0.93 + 0.14 * hash3(e.m[i * 5], e.m[i * 5 + 2], 8.8)), e.c[i * 3 + 1] * (0.95 + 0.1 * hash3(e.m[i * 5], e.m[i * 5 + 2], 2.2)), e.c[i * 3 + 2] * (0.9 + 0.2 * hash3(e.m[i * 5], e.m[i * 5 + 2], 6.1))) : col.setRGB(e.c[i * 3], e.c[i * 3 + 1], e.c[i * 3 + 2])) : WHITE_IC);   // (trees also differ a little in hue from one to the next)
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = !/^(bags)$/.test(name); im.receiveShadow = true;
      im.userData.kind = name; /* [day/night] src/daynight.js finds the lamps by kind */ im.userData.maxd = (FAR[name] ?? 450) * PFAR; if (SHADOW_D[name]) im.userData.shadowd = SHADOW_D[name];
      if (name === 'billboard') {   // its two lamps light at night like the lamps on wires (src/daynight.js reads userData.lampPts: x, ground y, z, height of the lens)
        const lp = [];
        for (let i = 0; i < n; i++) { const r = e.m[i * 5 + 3], c = Math.cos(r), s = Math.sin(r); for (const lx of BB_LAMPS) lp.push(e.m[i * 5] + lx * c + 0.94 * s, e.m[i * 5 + 1], e.m[i * 5 + 2] - lx * s + 0.94 * c, BB_LAMP_Y); }
        im.userData.lampPts = new Float32Array(lp);
      }
      meshes.push(im); meshOf[name + '|' + ckey] = im; parent.add(im); tris += per * n; total += n;
    }
    if (BUD.over()) yield;
  }
  for (const g of res.decals) {
    const m = new THREE.Mesh(g, zebraMat()); m.matrixAutoUpdate = false; m.receiveShadow = true; parent.add(m); geos.push(g); tris += g.attributes.position.count / 3;
  }
  if (res.wires) {   // the wires between the poles of the tile: one mesh, culled by distance like the cells
    const w = new THREE.Mesh(res.wires, MATS.dbl); w.name = 'prop_wires'; w.matrixAutoUpdate = false; w.castShadow = false; w.receiveShadow = false;
    res.wires.computeBoundingSphere(); w.boundingSphere = res.wires.boundingSphere; w.userData.kind = 'wires'; w.userData.maxd = 450 * PFAR;
    if (res.wireLamps) w.userData.lampPts = res.wireLamps;   // the lamps hung on wires: src/daynight.js lights them
    parent.add(w); meshes.push(w); geos.push(res.wires); tris += res.wires.attributes.position.count / 3;
  }
  if (res.smk) {   // the supermarkets' fronts and signs (generate, 2b): one mesh, culled by distance like the cells; its shop doors are lamps for src/daynight.js
    const m = new THREE.Mesh(res.smk.geo, signMat()); m.name = 'prop_supermarkets'; m.matrixAutoUpdate = false; m.castShadow = false; m.receiveShadow = true;
    res.smk.geo.computeBoundingSphere(); m.boundingSphere = res.smk.geo.boundingSphere; m.userData.kind = 'supermarkets'; m.userData.maxd = 700 * PFAR; m.userData.lampPts = res.smk.lamps; m.userData.fronts = res.smk.fronts;   // (fronts: x, y, z, nx, nz, chain of each store, for tools)
    parent.add(m); meshes.push(m); geos.push(res.smk.geo); tris += res.smk.geo.attributes.position.count / 3;
  }
  if (res.rails) {
    const a = new THREE.Mesh(res.rails.posts, MATS.dbl); a.matrixAutoUpdate = false; a.castShadow = true; a.receiveShadow = true; parent.add(a);
    const b = new THREE.Mesh(res.rails.panels, panelMat()); b.matrixAutoUpdate = false; b.castShadow = true; b.receiveShadow = true; parent.add(b);
    geos.push(res.rails.posts, res.rails.panels); tris += (res.rails.posts.attributes.position.count + res.rails.panels.attributes.position.count) / 3;
  }
  return { meshes, meshOf, geos, tris, total };
}

// ------------------------------------------------------------------ the module
const MARKET_OR_POOR = /Ballar|Vucciria|Caracciolo|Chiappara|Maccheronai|Garraffello|Cassari|Argenteria|Capo\b|Carini|Beati Paoli|Albergheria|Casa Professa|Divisi|Lattarini|Biscottari|Bandiera|Alloro|Cala\b|Sant'Agostino|Schioppettieri|Ponticello|Sant'Anna|Collegio di Maria|Marina/;

// ctx: { scene, raisedMask, CURB }. Props now exist per tile only: call api.attachWorld(world) once the streamer exists; every tile that
// reaches full detail gets its props (parked cars, bins, rubbish, scooters, trees, lamps, benches, kiosks, stalls ...), built in slices of a few
// ms per frame and disposed when the tile drops. The collidePlayer API (cars yeeted, rubbish bursting, trees felled) works on all of them.
export function buildProps(ctx) {
  const { scene, raisedMask, CURB } = ctx;
  const T = 500;
  let W = null, cull = [];
  const jobs = new Map();       // tile key -> job
  const tileIdx = new Map();    // tile (i * 4096 + j) -> building index of a built tile
  const tkey = (i, j) => i * 4096 + j;
  const inBAny = (x, z) => { const t = tileIdx.get(tkey(Math.floor(x / T), Math.floor(z / T))); return t ? t.inB(x, z) : false; };
  const gy = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  const phys = makePhysics({ inB: inBAny, gy, scene });
  const lamps = createSignalLamps();   // the lit lens of every signal head in the scene
  const tstats = { tiles: 0, built: 0, instances: 0, tris: 0, ms: 0, msMax: 0, lamps: 0, stepMax: 0, cpu: 0, queued: () => [...jobs.values()].filter(j => j.phase < 3).length };

  // ---------- tile source
  const sandRings = d => { const a = (d.areas || []).filter(q => q.k === 'sand').map(q => q.p); return a.length ? a : ((d.streets && d.streets.sand) || []).map(p => p[0]); };
  function tileSource(job) {
    const t = job.t, d = t.data, x0 = t.i * T, z0 = t.j * T, x1 = x0 + T, z1 = z0 + T;
    const nb = [], nroads = [], tram = (d.tram && d.tram.r ? d.tram.r.map(q => q.p) : []);
    if (W) for (const o of W.tiles.values()) {
      if (o === t || !o.data || Math.abs(o.i - t.i) > 1 || Math.abs(o.j - t.j) > 1) continue;
      for (const b of o.data.buildings) {   // neighbours' houses that reach over the border keep cars out of them
        const p = b.p; let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9;
        for (let i = 0; i < p.length; i += 2) { if (p[i] < a0) a0 = p[i]; if (p[i] > a1) a1 = p[i]; if (p[i + 1] < c0) c0 = p[i + 1]; if (p[i + 1] > c1) c1 = p[i + 1]; }
        if (a1 > x0 - 6 && a0 < x1 + 6 && c1 > z0 - 6 && c0 < z1 + 6) nb.push(b);
      }
      if (o.data.tram && o.data.tram.r) for (const q of o.data.tram.r) tram.push(q.p);   // tracks over the border keep cars off the tile's edge too
      for (const r of o.data.roads) if (r.n && MARKET_OR_POOR.test(r.n)) nroads.push(r);   // their street names still make this tile's edge scruffy
    }
    const k = t.i * 7919 + t.j * 104729, den = PDEN, blds = d.buildings.concat(nb);
    const st = d.streets || {};
    return {
      ctx, tk: t.k, tram, P: d.props || { items: [], areas: [], counts: {} }, seed: 1868 + k, seed2: 7011 + k, seed3: 4242 + k, cell: 250,
      x0, z0, x1, z1, aoi: [x0, z0, x1, z1], inBounds: (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1,
      idx: makeIndex(blds), bdata: blds, ownCount: d.buildings.length,   // (bdata[i] is the building of idx.bl[i]: its name and heights)
      sideZebras: t.sideZebras || [],   // the zebras at the mouths of side streets (src/streets.js sideZebrasIter, made with the tile's paint)
      roads: d.roads, hotRoads: d.roads.concat(nroads), curbs: st.curbs || [], asphalt: st.asphalt || [], paving: st.paving || [], green: (st.green || []).concat(st.verge || []),
      sand: sandRings(d),
      fences: d.fences || [], areas: d.areas || [], den, carCap: Math.round(420 * den), treeCap: Math.round(420 * den), megaCap: 10,
    };
  }

  // ---------- job steps
  const BUD = { t: 0, over: () => performance.now() > BUD.t };
  function stepJob(job) {   // true when finished
    if (job.phase === 0) {
      job.S = tileSource(job); job.gen = generate(job.S, BUD); job.phase = 1;
      if (BUD.over()) return false;
    }
    if (job.phase === 1) {
      const r = job.gen.next(); if (!r.done) return false;
      job.res = r.value; job.gen = instantiate(job.res, job.group, BUD); job.phase = 2;
      if (BUD.over()) return false;
    }
    if (job.phase === 2) {
      const r = job.gen.next(); if (!r.done) return false;
      const inst = r.value, res = job.res;
      job.inst = inst; job.colls = res.colls; job.gen = null;
      tileIdx.set(tkey(job.t.i, job.t.j), { inB: job.S.idx.inB });
      phys.add(res.colls, inst.meshOf);
      for (const g of res.sigs) { const im = inst.meshOf[g.coll.model + '|' + g.coll.key]; if (im) lamps.add(im, g.coll.i, g.site, g.g, g.coll); }
      lamps.update();
      for (const im of inst.meshes) { im.visible = false; cull.push(im); }
      scene.add(job.group);
      job.lamps = inst.meshes.some(im => im.userData.kind === 'lamp_pole' || im.userData.kind === 'lamp_wall' || im.userData.kind === 'candelabra' || im.userData.lampPts);
      tstats.built++; tstats.instances += inst.total; tstats.tris += inst.tris; tstats.lamps += job.lamps ? 1 : 0;
      job.ms = performance.now() - job.t0; tstats.ms += job.ms; tstats.cpu += job.cpu || 0; if (job.ms > tstats.msMax) tstats.msMax = job.ms;
      job.stats = res.stats; job.S = null; job.res = null; job.phase = 3;
      if (job.lamps) lampsChanged();
      return true;
    }
    return true;
  }
  const cp = new THREE.Vector3();
  let lastPump = -1;
  function pump(now) {
    if (now - lastPump < 2) return;
    lastPump = now;
    BUD.t = now + PBUD;
    for (;;) {
      let best = null, bd = 1e18;
      for (const j of jobs.values()) if (j.phase < 3) { const dx = j.cx - cp.x, dz = j.cz - cp.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } }
      if (!best) return;
      if (!best.t0) best.t0 = now;
      const s0 = performance.now(), fin = stepJob(best), s1 = performance.now();
      best.cpu = (best.cpu || 0) + (s1 - s0); if (s1 - s0 > tstats.stepMax) tstats.stepMax = s1 - s0;
      if (!fin || BUD.over()) return;
    }
  }
  // daynight lights lamps from the instanced meshes it finds; tell it when tiles bring or take lamps
  let lampTimer = 0;
  function lampsChanged() { clearTimeout(lampTimer); lampTimer = setTimeout(() => { try { dispatchEvent(new Event('pd-lamps-changed')); } catch (e) { /* no events */ } }, 300); }

  function startTile(t) {
    if (jobs.has(t.k) || !t.data) return;
    const group = new THREE.Group(); group.name = 'props_' + t.i + '_' + t.j; group.matrixAutoUpdate = false;   // at the origin for good: frozen, so the children are not forced to recompute their world matrices every frame
    jobs.set(t.k, { t, k: t.k, phase: 0, group, cx: (t.i + 0.5) * T, cz: (t.j + 0.5) * T, t0: 0, lamps: false });
    tstats.tiles++;
  }
  function dropTile(t) {
    const job = jobs.get(t.k); if (!job) return;
    jobs.delete(t.k);
    if (job.gen && job.gen.return) job.gen.return();
    if (job.phase === 3) {
      phys.remove(job.colls); tileIdx.delete(tkey(t.i, t.j));
      const gone = new Set(job.inst.meshes); cull = cull.filter(im => !gone.has(im));
      lamps.drop(gone);
    }
    scene.remove(job.group);
    job.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    if (job.inst) for (const g of job.inst.geos) g.dispose();
    if (job.lamps) lampsChanged();
  }
  function attachWorld(world) {
    W = world;
    world.onTile((kind, t) => { if (kind === 'full') startTile(t); else dropTile(t); });
  }

  // Distance culling per cell mesh, decided before each render (shadow pass included); also where the tile jobs get their slice of time.
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, sc, camera, ...rest) {
    camera.getWorldPosition(cp);
    pump(performance.now());
    // [perf pass] sqrt instead of Math.hypot: hypot boxed a heap number per cell mesh per frame
    for (let i = 0; i < cull.length; i++) { const im = cull[i], b = im.boundingSphere, dx = b.center.x - cp.x, dy = b.center.y - cp.y, dz = b.center.z - cp.z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - b.radius; im.visible = d < im.userData.maxd; if (im.userData.shadowd) im.castShadow = d < im.userData.shadowd; }
    phys.flush(cp); lamps.update();
    prev.call(this, r, sc, camera, ...rest);
  };
  const api = { collidePlayer: phys.collidePlayer, occlude: phys.occlude, stats: phys.stats, tileStats: tstats, attachWorld, throwPiece: phys.throwPiece, lump: phys.lump };   // throwPiece, lump: loose pieces for src/markets.js
  api.grid = phys.grid;
  if (location.search.includes('debug')) { window.__props = Object.assign(api, { jobs, phys }); window.__signals = { clock: signalClock, lamps, light: signalLight }; }
  return api;
}
