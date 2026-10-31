// Street props and vegetation for the whole city: real OSM street furniture (tile.data.props, baked by tools/tiles.py) plus procedural fill
// along the tile's roads, curbs, buildings and areas, per district (zoneAt). Built per tile when it reaches full detail, disposed when it drops.
// Owned by the props work. Everything is vertex-coloured low-poly in shared InstancedMeshes,
// bucketed into 250 m cells so frustum culling still works.
import * as THREE from 'three';
import { groundY, pairs, signedArea, rng, inPoly, proj, rasterMask } from './core.js';
import { zoneAt } from './districts.js';
import { QUALITY } from './mobile.js';
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

function car(name, { L, W, H, deck = 0.92, cab0 = -0.40, cab1 = 0.12, top0 = -0.34, top1 = -0.02, van = false, pickup = false }) {
  const mb = new MB(), w = W / 2;
  const hl = L / 2;
  mb.frust(0.2, [-w, -hl, w, hl], deck, [-w + 0.05, -hl + 0.04, w - 0.05, hl - 0.07], WHITE, 0.8, 1);
  if (pickup) {
    mb.frust(deck, [-w + 0.05, hl * 0.05, w - 0.05, hl - 0.07], H, [-w + 0.1, hl * 0.2, w - 0.1, hl * 0.5], GLASS, 0.9, 1, false); // cab glass
    mb.box(-w + 0.1, H - 0.05, hl * 0.2, w - 0.1, H, hl * 0.5, WHITE, 1, 1, false);
    mb.box(-w + 0.04, deck, -hl + 0.04, w - 0.04, deck + 0.38, hl * 0.02, C('#cfcfc8'), 0.8, 1, false); // open bed
  } else if (van) {
    const z0 = -hl + 0.04, z1 = hl * 0.12;
    mb.frust(deck, [-w + 0.02, z0, w - 0.02, z1], H - 0.05, [-w + 0.06, z0 + 0.02, w - 0.06, z1 - hl * 0.14], WHITE, 0.9, 1, false);
    mb.box(-w + 0.06, H - 0.07, z0 + 0.02, w - 0.06, H, z1 - hl * 0.14, WHITE, 1, 1, false);
    mb.frust(deck + 0.12, [-w + 0.03, z1 - hl * 0.5, w - 0.03, z1 - 0.02], H - 0.3, [-w + 0.06, z1 - hl * 0.4, w - 0.06, z1 - hl * 0.14], GLASS, 1, 1, false);
  } else {
    const a = [-w + 0.07, cab0 * L, w - 0.07, cab1 * L], b = [-w + 0.22, top0 * L, w - 0.22, top1 * L];
    mb.frust(deck, a, H - 0.05, b, GLASS, 0.9, 1, false);
    mb.box(b[0] - 0.02, H - 0.06, b[1] - 0.02, b[2] + 0.02, H, b[3] + 0.02, WHITE, 1, 1, false);
  }
  const lens = (z, y, col, dir) => { for (const s of [-1, 1]) mb.face(col, [[s * (w - 0.1), y, z * 1.002], [s * (w - 0.4), y, z * 1.002], [s * (w - 0.4), y + 0.14, z * 1.002], [s * (w - 0.1), y + 0.14, z * 1.002]], 1); };
  mb.ctr = null;
  const wz = L * 0.32;
  for (const z of [-wz, wz]) for (const s of [-1, 1]) mb.cylX(s * (w - 0.17), 0.27, z, 0.27, 0.2, 6, TYRE, 1, s);
  const m = mb.geo();
  // lights as small plates (front pale, rear red), appended after
  const lb = new MB();
  for (const s of [-1, 1]) {
    lb.face(C('#fff2c8'), [[s * (w - 0.08), 0.62, hl - 0.06], [s * (w - 0.38), 0.62, hl - 0.06], [s * (w - 0.38), 0.76, hl - 0.06], [s * (w - 0.08), 0.62 + 0.14, hl - 0.06]], 1);
    lb.face(C('#c8281f'), [[s * (w - 0.08), 0.62, -hl + 0.12], [s * (w - 0.38), 0.62, -hl + 0.12], [s * (w - 0.38), 0.76, -hl + 0.12], [s * (w - 0.08), 0.76, -hl + 0.12]], 1);
  }
  MODELS[name] = { geo: m, mat: 'std', tint: true, lights: lb.geo() };
}
car('panda', { L: 3.65, W: 1.64, H: 1.55, deck: 0.95, cab0: -0.38, cab1: 0.14, top0: -0.33, top1: 0.0 });
car('hatch', { L: 4.0, W: 1.74, H: 1.45, deck: 0.9, cab0: -0.40, cab1: 0.06, top0: -0.30, top1: -0.06 });
car('micro', { L: 2.75, W: 1.55, H: 1.5, deck: 0.92, cab0: -0.42, cab1: 0.20, top0: -0.36, top1: 0.05 });
car('van', { L: 4.45, W: 1.8, H: 1.85, deck: 0.95, van: true });
car('pickup', { L: 4.4, W: 1.65, H: 1.8, deck: 0.85, pickup: true });

// merge each car's light plates into its main geometry so one InstancedMesh draws it
for (const n of ['panda', 'hatch', 'micro', 'van', 'pickup']) {
  const m = MODELS[n];
  const merged = new THREE.BufferGeometry();
  for (const a of ['position', 'color']) {
    const A = m.geo.attributes[a].array, B = m.lights.attributes[a].array, o = new Float32Array(A.length + B.length);
    // lights are untinted-by-design: they get multiplied by the paint like everything else, which is fine
    o.set(A); o.set(B, A.length); merged.setAttribute(a, new THREE.BufferAttribute(o, 3));
  }
  merged.computeVertexNormals(); m.geo = merged; delete m.lights;
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
  const hy = new MB(); hy.prism(0, 0, 0, 0.7, 0.07, 0.07, 6, C('#a8282a')); hy.lump(0, 0.74, 0, 0.1, 0.08, 0.1, C('#a8282a'), 0, 0, 0.9);
  def('hydrant', hy);
  const ph = new MB(); ph.box(-0.45, 0, -0.45, 0.45, 2.3, 0.45, C('#8a8f93'), 0.8, 1);
  ph.face(C('#2a343a'), [[-0.3, 0.9, 0.46], [0.3, 0.9, 0.46], [0.3, 2.1, 0.46], [-0.3, 2.1, 0.46]]); def('phone', ph);
  const pb = new MB(); pb.box(-0.2, 0.0, -0.2, 0.2, 0.9, 0.2, C('#b3262a'), 0.8, 1); pb.box(-0.23, 0.9, -0.23, 0.23, 1.15, 0.23, C('#b3262a'), 0.9, 1);
  pb.box(-0.25, 1.0, 0.0, 0.25, 1.1, 0.24, C('#222'), 1, 1, false); def('postbox', pb);
  const cb = new MB(); cb.box(-0.45, 0, -0.2, 0.45, 1.45, 0.2, C('#8d8f8e'), 0.8, 1); def('cabinet', cb);
  const sg = new MB(); sg.prism(0, 0, 0, 3.4, 0.06, 0.05, 6, BLACKMET);   // traffic light, heads face +z
  sg.box(-0.15, 3.0, 0.0, 0.15, 3.9, 0.22, BLACKMET, 1, 1);
  for (const [y, col] of [[3.7, '#c93a2e'], [3.45, '#d9a623'], [3.2, '#3b9c58']]) sg.face(C(col), [[-0.06, y, 0.23], [0.06, y, 0.23], [0.06, y + 0.12, 0.23], [-0.06, y + 0.12, 0.23]]);
  def('signal', sg);
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
  const fn = new MB(); fn.prism(0, 0, 0, 0.55, 1.5, 1.4, 10, C('#c4bfb0'));
  fn.prism(0, 0, 0.5, 0.5, 1.2, 1.2, 10, C('#3a7c8c'), { cap: true });
  fn.prism(0, 0, 0.5, 1.5, 0.22, 0.12, 8, C('#c4bfb0')); fn.prism(0, 0, 1.5, 1.6, 0.6, 0.5, 10, C('#c4bfb0'));
  def('fountain', fn);
}

// Palms, ficus, pine, orange, generic broadleaf
function fanPalm(name, H, bulge) {
  const mb = new MB(), trunk = C('#8a7658'), r = 0.27;
  mb.prism(0, 0, 0, H, r * 1.25, r * 0.85, 5, trunk, { k0: 0.6 });
  
  
  // dead skirt
  const dead = C('#8b7a4a'), g1 = C('#3f6a2a'), g2 = C('#7ca43e'), pet = C('#5a7a34');
  const tri = (a, b, c, col, ka = 1, kb = 1, kc = 1) => { mb.vert([...a, ka], col, 1); mb.vert([...b, kb], col, 1); mb.vert([...c, kc], col, 1); };
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + 0.2, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    tri([dx * 0.2, H + 0.1, dz * 0.2], [dx * 0.75 + px * 0.25, H - 0.85, dz * 0.75 + pz * 0.25], [dx * 0.75 - px * 0.25, H - 0.85, dz * 0.75 - pz * 0.25], dead);
    tri([dx * 0.2, H + 0.1, dz * 0.2], [dx * 0.75 - px * 0.25, H - 0.85, dz * 0.75 - pz * 0.25], [dx * 0.75 + px * 0.25, H - 0.85, dz * 0.75 + pz * 0.25], dead);
  }
  const n = 9 + bulge;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + (i % 2) * 0.17, dx = Math.cos(a), dz = Math.sin(a);
    const up = 0.25 + (i % 3) * 0.25, len = 0.9 + (i % 3) * 0.08;
    const A = [dx * len, H + 0.2 + up, dz * len];
    tri([0, H + 0.2, 0], A, [dx * 0.5 - dz * 0.05, H + 0.2 + up * 0.5, dz * 0.5 + dx * 0.05], pet);
    const drop = 0.55 + (i % 3) * 0.15, bl = 1.7 + (i % 2) * 0.25;
    const tips = [];
    for (let j = -2; j <= 2; j++) {
      const ph = j * 0.5, ca = Math.cos(a + ph), sa = Math.sin(a + ph);
      tips.push([A[0] + ca * bl, A[1] - drop - Math.abs(j) * 0.28 + 0.1, A[2] + sa * bl]);
    }
    for (let j = 0; j < 4; j += 1) { tri(A, tips[j], tips[j + 1], g1, 0.85, 1.15, 1.15); }
  }
  def(name, mb, { dbl: true, tint: true });
}
fanPalm('palm_fan_a', 9, 1); fanPalm('palm_fan_b', 13, 3); fanPalm('palm_fan_c', 6.5, 0);

function datePalm(name, H) {
  const mb = new MB(), trunk = C('#7b684b');
  mb.prism(0, 0, 0, H, 0.5, 0.36, 6, trunk, { k0: 0.6 });
  mb.lump(0, H + 0.1, 0, 0.55, 0.45, 0.55, C('#6c5a3a'), 0, 0.1, 0.7);
  const col1 = C('#3f6428'), col2 = C('#86a548');
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + (i % 2) * 0.1, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const L = 2.6 + (i % 3) * 0.35, lift = i % 3 === 0 ? 1.0 : i % 3 === 1 ? 0.45 : 0.1;
    let prev = null;
    for (let s = 0; s <= 2; s++) {
      const t = s / 2, h = L * t * 0.9, y = H + 0.3 + lift * 1.8 * t - 1.9 * t * t * (0.9 + lift * 0.2);
      const wd = 0.5 * (1 - t * 0.75) * (s === 0 ? 0.3 : 1);
      const cur = [[dx * h + px * wd, y - 0.1 * wd, dz * h + pz * wd], [dx * h - px * wd, y - 0.1 * wd, dz * h - pz * wd], [dx * h, y + 0.04, dz * h]];
      if (prev) {
        const k = 0.8 + 0.35 * t;
        for (const [p, q, rr] of [[prev[0], prev[2], cur[0]], [prev[2], cur[2], cur[0]], [prev[2], prev[1], cur[1]], [prev[2], cur[1], cur[2]]]) {
          mb.vert([...p, k], col1, 1); mb.vert([...q, k], col1, 1); mb.vert([...rr, k], col1, 1);
        }
      }
      prev = cur;
    }
  }
  def(name, mb, { dbl: true, tint: true });
}
datePalm('palm_date_a', 5); datePalm('palm_date_b', 7.5);

{
  const f = new MB();  // large Ficus macrophylla / microcarpa
  f.prism(0, 0, 0, 3.0, 0.75, 0.5, 5, C('#6b5e4e'), { k0: 0.55 });
  for (const [x, y, z, rx, ry, c, sd] of [[0, 5.3, 0, 4.2, 2.6, '#3f5d2d', 1], [2.8, 4.6, 0.7, 2.8, 2.0, '#486a32', 2], [-2.5, 4.4, -1.0, 2.8, 1.9, '#3a5629', 3], [0.4, 6.4, 1.8, 2.5, 1.7, '#4a6c33', 4], [-0.8, 4.2, 2.4, 2.4, 1.6, '#456536', 12]])
    f.lump(x, y, z, rx, ry, rx, C(c), 0, 0.2, 0.55, sd);
  def('ficus', f, { tint: true });
  const o = new MB();   // bitter orange / citrus street tree
  o.prism(0, 0, 0, 2.0, 0.14, 0.1, 5, C('#5b4a3a'), { k0: 0.6 });
  o.lump(0, 3.0, 0, 1.7, 1.5, 1.7, C('#46703a'), 0, 0.2, 0.6, 5);
  o.lump(0.6, 3.5, 0.3, 1.2, 1.1, 1.2, C('#527c40'), 0, 0.2, 0.7, 6);
  o.lump(1.2, 2.5, 0.5, 0.2, 0.2, 0.2, C('#e48a1c'), 0, 0.1, 0.9);
  def('orange', o, { tint: true });
  const t = new MB();   // generic broadleaf (plane, carob, jacaranda...)
  t.prism(0, 0, 0, 3.4, 0.2, 0.13, 5, C('#6e5a44'), { k0: 0.6 });
  t.lump(0, 5.2, 0, 2.7, 2.3, 2.7, C('#587e3a'), 0, 0.2, 0.55, 7);
  t.lump(1.4, 4.4, 0.6, 1.8, 1.5, 1.8, C('#648a40'), 0, 0.2, 0.6, 8);
  t.lump(-1.3, 4.7, -0.5, 1.7, 1.5, 1.7, C('#527a38'), 0, 0.2, 0.6, 13);
  def('tree', t, { tint: true });
  const p = new MB();   // umbrella pine
  p.prism(0, 0, 0, 7.0, 0.3, 0.2, 5, C('#7b5a42'), { k0: 0.55 });
  p.lump(0, 8.0, 0, 3.9, 1.5, 3.9, C('#3d5b30'), 0, 0.2, 0.6, 9);
  p.lump(1.8, 7.4, 0.8, 2.4, 1.1, 2.4, C('#456536'), 0, 0.2, 0.6, 10);
  p.lump(-1.8, 7.5, -0.6, 2.4, 1.1, 2.4, C('#406132'), 0, 0.2, 0.6, 14);
  def('pine', p, { tint: true });
  const sh = new MB();    // oleander / flowering shrub and clipped hedge block
  sh.lump(0, 0.9, 0, 1.0, 0.9, 1.0, C('#4d7438'), 0, 0.2, 0.6, 11);
  for (const [x, y, z] of [[0.6, 1.4, 0.2], [-0.5, 1.2, 0.6]]) sh.lump(x, y, z, 0.28, 0.2, 0.28, C('#d96a8c'), 0, 0.2, 0.9);
  def('shrub', sh, { tint: false });
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
const MATS = {
  std: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }),
  dbl: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }),
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
// c: circles [ox, oz, r] in model space (z forward). kind: veh (launchable), scooter, bin, tree, bend, solid.
// thr: closing speed in m/s above which the thing breaks, flies or falls. he/hc: body half extents and centre height for flights.
const CAR_HE = (W, L) => [W / 2, 0.75, L / 2];
const SPECS = {
  panda: { kind: 'veh', c: [[0, 1.0, 0.85], [0, -1.0, 0.85]], m: 0.95, thr: 4.2, he: CAR_HE(1.64, 3.65), hc: 0.75 },
  hatch: { kind: 'veh', c: [[0, 1.2, 0.9], [0, -1.2, 0.9]], m: 1.1, thr: 4.2, he: CAR_HE(1.74, 4.0), hc: 0.75 },
  micro: { kind: 'veh', c: [[0, 0.55, 0.8], [0, -0.55, 0.8]], m: 0.8, thr: 3.8, he: CAR_HE(1.55, 2.75), hc: 0.75 },
  van: { kind: 'veh', c: [[0, 1.3, 0.95], [0, 0, 0.95], [0, -1.3, 0.95]], m: 2.0, thr: 6.0, he: [0.9, 0.95, 2.2], hc: 0.95 },
  pickup: { kind: 'veh', c: [[0, 1.3, 0.85], [0, 0, 0.85], [0, -1.3, 0.85]], m: 1.3, thr: 5.0, he: [0.83, 0.9, 2.2], hc: 0.9 },
  ape: { kind: 'veh', c: [[0, 0.8, 0.78], [0, -0.7, 0.78]], m: 0.8, thr: 3.6, he: [0.75, 0.9, 1.5], hc: 0.9 },
  apetaxi: { kind: 'veh', c: [[0, 0.8, 0.78], [0, -0.7, 0.78]], m: 0.8, thr: 3.6, he: [0.75, 1.0, 1.5], hc: 1.0 },
  scooter: { kind: 'scooter', c: [[0, 0.35, 0.4], [0, -0.35, 0.4]], m: 0.28, thr: 1.2, fly: 7.5, he: [0.35, 0.55, 0.9], hc: 0.55 },
  bin_big: { kind: 'bin', c: [[0, 0, 0.78]], m: 1.0, thr: 2.6, bags: 4 },
  bin_over: { kind: 'bin', c: [[0, 0, 0.78]], m: 1.0, thr: 2.2, bags: 9 },
  bin_small: { kind: 'bend', c: [[0, 0, 0.24]], thr: 3, tilt: 1.57, H: 0.9 },
  ficus: { kind: 'tree', c: [[0, 0, 0.8]], thr: 13.9, H: 6, crown: 4 },
  tree: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 5, crown: 2.7 },
  orange: { kind: 'tree', c: [[0, 0, 0.22]], thr: 8.3, H: 3.5, crown: 1.7 },
  pine: { kind: 'tree', c: [[0, 0, 0.36]], thr: 11, H: 8, crown: 3.9 },
  palm_fan_a: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 9, crown: 2.5 },
  palm_fan_b: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.7, H: 13, crown: 2.5 },
  palm_fan_c: { kind: 'tree', c: [[0, 0, 0.3]], thr: 9.0, H: 6.5, crown: 2.5 },
  palm_date_a: { kind: 'tree', c: [[0, 0, 0.45]], thr: 11, H: 5, crown: 2.5 },
  palm_date_b: { kind: 'tree', c: [[0, 0, 0.42]], thr: 11, H: 7.5, crown: 2.5 },
  lamp_pole: { kind: 'bend', c: [[0, 0, 0.2]], thr: 7, tilt: 1.05, H: 9 },
  candelabra: { kind: 'bend', c: [[0, 0, 0.25]], thr: 7.5, tilt: 0.9, H: 4 },
  signal: { kind: 'bend', c: [[0, 0, 0.2]], thr: 6.5, tilt: 1.1, H: 3.5 },
  bollard: { kind: 'bend', c: [[0, 0, 0.13]], thr: 5.5, tilt: 1.5, H: 0.8 },
  busstop: { kind: 'bend', c: [[0, 0, 0.12]], thr: 6.5, tilt: 1.0, H: 2.7 },
  bench: { kind: 'solid', c: [[-0.7, 0, 0.32], [0.7, 0, 0.32]] },
  stall_table: { kind: 'solid', c: [[-0.65, 0, 0.5], [0.65, 0, 0.5]] },
  cafe_set: { kind: 'solid', c: [[0, 0, 0.55]] },
  hydrant: { kind: 'solid', c: [[0, 0, 0.18]] },
  phone: { kind: 'solid', c: [[0, 0, 0.5]] },
  cabinet: { kind: 'solid', c: [[-0.3, 0, 0.3], [0.3, 0, 0.3]] },
  postbox: { kind: 'solid', c: [[0, 0, 0.28]] },
  monument: { kind: 'solid', c: [[0, 0, 0.85]] },
  kiosk: { kind: 'solid', c: [[-0.8, 0, 1.1], [0.8, 0, 1.1]] },
  hedge: { kind: 'solid', c: [[-1.0, 0, 0.5], [0, 0, 0.5], [1.0, 0, 0.5]] },
  fountain: { kind: 'solid', c: [[0, 0, 1.6]] },
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
const SCALE_R = new Set(['ficus', 'tree', 'orange', 'pine', 'palm_fan_a', 'palm_fan_b', 'palm_fan_c', 'palm_date_a', 'palm_date_b']);


function makePhysics(env) {
  const { inB, gy, scene } = env;
  let nColl = 0;
  const PR = 0.74, PAX = 0.72, I_YAW = 1.7, E = 0.25, G = 9.8;
  const up = new THREE.Vector3(0, 1, 0), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), sA = new THREE.Vector3();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cellIJ = (i, j) => (i + 4096) * 8192 + (j + 4096);   // whole city: x within +-6.7 km, z within -12 .. +5.6 km
  const cellK = (x, z) => cellIJ(Math.floor(x / 8), Math.floor(z / 8));
  const grid = new Map();
  const gAdd = c => { const k = cellK(c.x, c.z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); c.gk = k; };
  const gDel = c => { const a = grid.get(c.gk); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } };
  let simT = 0, tick = 0, lastShout = -9, camPos = null;
  const dirty = new Set(), dyn = [], broken = new Set();
  const stats = { yeeted: 0, tipped: 0, trees: 0, bent: 0, scooters: 0 };

  // ---- debris pools: bags, cardboard sheets, bottles (all stay until their owner resets), leaves and litter bits (expire)
  const mkPool = (geo, n, castShadow, tinted = true) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.9, side: THREE.DoubleSide }), n);
    im.frustumCulled = false; im.castShadow = castShadow; im.receiveShadow = true; im.count = n;
    mA.makeScale(0, 0, 0); for (let i = 0; i < n; i++) { im.setMatrixAt(i, mA); if (tinted) im.setColorAt(i, new THREE.Color(1, 1, 1)); }
    scene.add(im); return im;
  };
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
    const D2 = DEB[kind], idx = D2.n++ % D2.im.count; let it = D2.items.find(q => q.idx === idx); if (!it) D2.items.push(it = { idx });
    Object.assign(it, { rest: false, hidden: false, owner: c, tilt: 0, tv: 0, spin: 0, roll: 0, rot: rnd() * 6.28, s: 1 }, init);
    D2.im.setColorAt(idx, D2.cols[(rnd() * D2.cols.length) | 0]); D2.im.instanceColor.needsUpdate = true; D2.dirty = true; return it;
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
      const idx = leafN++ % leafPool.count; let l = leaves.find(q => q.idx === idx); if (!l) leaves.push(l = { idx });
      const [vx, vz] = burstV(nx, nz, vc, 0.3 + rnd() * 0.5, pc);
      Object.assign(l, { x: c.x + (rnd() - 0.5), y: gy(c.x, c.z) + 0.2, z: c.z + (rnd() - 0.5), vx, vy: 1.5 + rnd() * 3, vz, rot: rnd() * 6, spin: (rnd() - 0.5) * 12, age: 0, life: 3 + rnd() * 2.5, s: r2(0.5, 0.9), gone: false });
      leafPool.setColorAt(idx, BITC[(rnd() * BITC.length) | 0]); leafPool.instanceColor.needsUpdate = true;
    }
  };
  const spawnLeaves = (c, dx, dz) => {
    const sp = c.sp, n = 16;
    for (let i = 0; i < n; i++) {
      const idx = leafN++ % leafPool.count, a = Math.random() * 6.283, r = Math.random() * sp.crown * c.s * 0.7;
      let l = leaves.find(q => q.idx === idx); if (!l) leaves.push(l = { idx });
      Object.assign(l, { x: c.x + Math.cos(a) * r, y: gy(c.x, c.z) + sp.H * c.s * (0.6 + Math.random() * 0.4), z: c.z + Math.sin(a) * r, vx: dx * Math.random() * 4 + (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: dz * Math.random() * 4 + (Math.random() - 0.5) * 4, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 9, age: 0, life: 2.5 + Math.random() * 2, s: 0.9 + Math.random() * 0.8, gone: false });
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
  function poseInstance(c) {
    if (c.st === 0) baseMatrix(c, mA); else if (c.st === 'gone') goneMatrix(c, mA); else if (c.st === 'fall' || c.st === 'down') tiltMatrix(c, mA); else flyMatrix(c, mA);
    c.im.setMatrixAt(c.i, mA); dirty.add(c.im);
  }
  const moved = new Set();
  const touch = c => { if (!moved.has(c.im)) { moved.add(c.im); c.im.boundingSphere.radius += 45; } broken.add(c); c.tb = simT; dirty.add(c); };

  // ---- state changes
  function startFall(c, nx, nz, vc, target, o = {}) {   // n points from obstacle to car; thing falls away from the car
    const dx = -nx, dz = -nz;
    Object.assign(c, { st: 'fall', dx, dz, ang: 0, av: 0.6 + vc * 0.12, tgt: target, slide: o.slide || 0, lift: o.lift || 0 });
    gDel(c); dyn.push(c); touch(c);
  }
  function yeet(c, nx, nz, vc, pc) {
    const sp = c.sp, mv = sp.m * 0.6, e = 0.55, vo = vc * (1 + e) / (1 + mv) * 1.25;
    // fly from the current pose
    if (c.st === 0) { c.q = new THREE.Quaternion().setFromAxisAngle(up, c.rot0); c.px = c.x0; c.py = c.y0 + sp.hc * c.s; c.pz = c.z0; }
    Object.assign(c, { st: 'fly', vx: -nx * vo + pc.vx * 0.25, vz: -nz * vo + pc.vz * 0.25, vy: clamp(2.6 + vc * 0.32, 3, 9) * (sp.kind === 'scooter' ? 1.2 : 1), settle: 0 });
    const k = clamp(vc * 0.35, 1, 5);
    c.w = new THREE.Vector3((Math.random() - 0.5) * k * 1.6 + nz * k * 0.8, (Math.random() - 0.5) * k * 1.2, (Math.random() - 0.5) * k * 1.6 - nx * k * 0.8);
    gDel(c); if (!dyn.includes(c)) dyn.push(c); touch(c); stats.yeeted++;
    // player loses momentum
    const dv = vc * (1 - mv * e) / (1 + mv), loss = vc - dv;
    pc.vx += nx * loss; pc.vz += nz * loss; pc.vf = pc.vx * Math.sin(pc.th) + pc.vz * Math.cos(pc.th);
    if (simT - lastShout > 1.2) { lastShout = simT; try { dispatchEvent(new CustomEvent('pd-shout', { detail: { x: c.x, y: c.py || c.y0 + 1, z: c.z } })); } catch (err) { /* no events */ } }
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
        if (c.st === 0 && vc >= sp.thr) {
          startFall(c, nx, nz, vc, 1.57, { lift: 0.55, slide: 0.9 }); spawnBags(c, sp.bags, nx, nz, vc, pc); stats.tipped++; slow(pc, nx, nz, 0.12); return;
        }
        break;
      case 'bags': case 'board': case 'bits': case 'object':
        if (c.st === 0 && vc >= sp.thr) { junk(pc, c, nx, nz, vc); return; }
        if (sp.kind !== 'object') return;    // soft: the lapa just drives through rubbish below the threshold
        break;
      case 'tree':
        if (c.st === 0 && vc >= sp.thr) { startFall(c, nx, nz, vc, 1.5); spawnLeaves(c, -nx, -nz); stats.trees++; slow(pc, nx, nz, 0.4); return; }
        break;
      case 'bend':
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
    if (dyn.length) for (let k = dyn.length - 1; k >= 0; k--) { const c = dyn[k]; if (c.st === 'fly') stepFly(c, dt); else if (c.st === 'fall') stepFall(c, dt); }
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
          const c = lst[q]; if (!c || c.dead || c.st === 'down' || c.st === 'fall' || c.st === 'fly' || c.st === 'gone') continue;
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
    for (const c of list) { c.im = meshOf[c.model + '|' + c.key]; if (c.im) { gAdd(c); nColl++; } }
  }
  function remove(list) {
    for (const c of list) {
      c.dead = true; if (c.gk !== undefined) gDel(c);
      const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1);
      broken.delete(c); dirty.delete(c); if (c.im) { dirty.delete(c.im); moved.delete(c.im); } nColl--;
    }
    for (const k in DEB) { const D2 = DEB[k]; for (const b of D2.items) if (b.owner && b.owner.dead && !b.hidden) { b.owner = null; b.rest = true; b.hidden = true; b.dirty = true; D2.dirty = true; } }
  }
  return { collidePlayer, flush, stats, add, remove, count: () => nColl, grid };
}

// ------------------------------------------------------------------ district tables (zones come from src/districts.js zoneAt)
// squalor 0..1 by zone where the centro's street-name rules do not apply
const ZONE_SQ = { zen: 0.95, cep: 0.72, viaLib: 0.18, lido: 0.2, mondello: 0.25, sferra: 0.38, valdesi: 0.3, favorita: 0.3, rural: 0.3, brancaccio: 0.66, noce: 0.6, zisa: 0.6, borgoV: 0.7, oreto: 0.65, porto: 0.7, brin: 0.6, corsoMille: 0.55 };
// "effective distance from the old centre" (m) outside 1.1 km: drives how thickly cars, scooters and lanterns are set
const ZONE_DIST = { viaLib: 850, sacco: 900, resut: 1000, fiera: 1000, politeama: 800, stazione: 900, noce: 1000, zisa: 1000, borgoV: 900, oreto: 1000, brancaccio: 1100, corsoMille: 1000, zen: 1000, cep: 1200, mondello: 1000, lido: 900, sferra: 1100,
  valdesi: 1300, uditore: 1300, rigano: 1300, periph: 1400, rural: 3200, favorita: 2600, porto: 1800, brin: 1800, acquasanta: 1200, arenella: 1300, tn: 1300 };
const ZONE_CARS = { rural: 0.3, favorita: 0.4, porto: 0.5, brin: 0.4, lido: 1.25, mondello: 1.25, viaLib: 1.3, sacco: 1.2, zen: 0.9, sferra: 1.1 };
const CAFE_OUT = { viaLib: 0.85, lido: 0.9, mondello: 0.9, politeama: 0.8, valdesi: 0.7, sferra: 0.7 };   // share of cafes with tables outside
const PLANE_TINT = new THREE.Color('#f3f0b4');   // plane trees on the Libertà: yellowish-green leaves
const BEACH_UMB = ['#e8e4d8', '#2f6fb0', '#d9482a', '#e6c040', '#2a8a8a', '#f2f2ee', '#d9588a', '#1f4f8a'];

// ------------------------------------------------------------------ building index (exact point test + nearest wall)
function makeIndex(buildings) {
  const BC = 32, bgrid = new Map(), bl = [];
  const bkey = (ix, iz) => (ix + 512) * 1024 + (iz + 512);
  for (const b of buildings) {
    const outer = pairs(b.p), holes = (b.holes || []).map(pairs);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [x, z] of outer) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const o = { outer, holes, x0, z0, x1, z1 }; bl.push(o);
    for (let ix = Math.floor(x0 / BC); ix <= Math.floor(x1 / BC); ix++) for (let iz = Math.floor(z0 / BC); iz <= Math.floor(z1 / BC); iz++) {
      const k = bkey(ix, iz); let a = bgrid.get(k); if (!a) bgrid.set(k, a = []); a.push(o);
    }
  }
  const cellB = (x, z) => bgrid.get(bkey(Math.floor(x / BC), Math.floor(z / BC)));
  function inB(x, z) {
    const a = cellB(x, z); if (!a) return false;
    for (const o of a) {
      if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) continue;
      if (inPoly(o.outer, x, z)) { let hole = false; for (const h of o.holes) if (inPoly(h, x, z)) { hole = true; break; } if (!hole) return true; }
    }
    return false;
  }
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
  return { bl, inB, nearWall };
}

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
  const res = { buckets, colls, stats, decals: [], rails: null };
  function put(model, x, y, z, rot = 0, s = 1, col = null) {
    const m = MODELS[model]; if (!m) return;
    const b = (buckets[model] ||= new Map()), key = Math.floor(x / S.cell) * 4096 + Math.floor(z / S.cell);
    let e = b.get(key); if (!e) b.set(key, e = { m: [], c: [] });
    e.m.push(x, y, z, rot, s);
    if (m.tint) e.c.push(col ? col.r : 1, col ? col.g : 1, col ? col.b : 1);
    stats[model] = (stats[model] || 0) + 1;
    const sp = SPECS[model];
    if (sp) colls.push({ model, key, i: e.m.length / 5 - 1, x, y, z, rot, s, sp, st: 0, im: null, circ: sp.c, x0: x, z0: z, y0: y, rot0: rot });
  }

  const bl = S.idx.bl, own = bl.slice(0, S.ownCount), inB = S.idx.inB, nearWall = S.idx.nearWall;
  const wallClear = (x, z, r) => !inB(x, z) && !nearWall(x, z, r);

  // ---------- street masks
  // [perf pass] bit-packed tiled raster (core.js rasterMask) instead of a 66 MB RGBA read-back per call
  function mask(polys, k) { return rasterMask([polys], S.aoi, k); }
  const asphalt = mask(S.asphalt, 2); yield;
  const paving = mask(S.paving, 1); yield;
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
  const CARS = [['panda', 36], ['hatch', 28], ['micro', 12], ['van', 8], ['pickup', 5]];
  const SCOOT = ['#e8e6dc', '#2c2d31', '#b9bec2', '#a2201f', '#27456f', '#e6c040', '#6b7a58', '#d9d9d6'];

  // ---------- 1. real OSM furniture
  const osm = P.items.filter(i => inBounds(i.x, i.z));
  const taken = (it, r) => { occAdd(it.x, it.z, r); };
  const nearAny = (list, x, z, r) => list.some(q => hyp2(q.x - x, q.z - z) < r);
  const lampsReal = [];
  const treeKind = (it) => {
    const s = (it.ge || '') + ' ' + (it.sp || '');
    if (it.lt === 'palm' || /Phoenix|Washingtonia|Trachycarpus|Chamaerops|Livistona|Arecaceae/.test(s))
      return /Phoenix/.test(s) ? pick(['palm_date_a', 'palm_date_b']) : pick(['palm_fan_a', 'palm_fan_b', 'palm_fan_c']);
    if (/Ficus/.test(s)) return 'ficus';
    if (/Citrus/.test(s)) return 'orange';
    if (/Pinus/.test(s)) return 'pine';
    return wpick([['orange', 32], ['ficus', 18], ['tree', 30], ['palm_fan_a', 7], ['palm_fan_b', 4], ['palm_date_a', 4], ['pine', 5]]);
  };
  const placeTree = (x, z, kind, canopy = 0.95, tc = null) => {
    if (!inBounds(x, z) || road(x, z) || inB(x, z)) return false;
    const r = { ficus: 3.2, tree: 2.2, orange: 1.4, pine: 2, shrub: 0.8, hedge: 0.9 }[kind] ?? 0.5;
    if (occHit(x, z, Math.min(r, 1.6) * 0.6)) return false;
    const wd = nearWall(x, z, 1.1); if (wd && kind !== 'shrub') return false;
    const s = R(0.85, 1.2) * canopy, tint = C('#ffffff').multiplyScalar(R(0.85, 1.12)); if (tc) tint.multiply(tc);
    put(kind, x, gy(x, z), z, R(0, TAU), s, tint); occAdd(x, z, Math.min(r, 1.6) * 0.6);
    return true;
  };
  for (const it of osm) {
    if (BUD.over()) yield;
    const k = it.k;
    if (k === 'tree') { placeTree(it.x, it.z, treeKind(it)); continue; }
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
    if (k === 'signal') {
      const sp = snapOff(it.x, it.z); if (!sp) continue;
      const nr = nearRoad(sp[0], sp[1], 14), rot = nr ? Math.atan2(nr.tx, nr.tz) + (rand() < 0.5 ? 0 : Math.PI) : R(0, TAU);
      put('signal', sp[0], gy(sp[0], sp[1]), sp[1], rot); occAdd(sp[0], sp[1], 0.3); continue;
    }
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
      put('monument', it.x, gy(it.x, it.z), it.z, R(0, TAU), it.mem === 'bust' ? 0.7 : 1); occAdd(it.x, it.z, 1); continue;
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
      for (let s = 2; s < L; s += 7) placeTree(A[0] + (B[0] - A[0]) * s / L, A[1] + (B[1] - A[1]) * s / L, pick(['orange', 'orange', 'tree', 'ficus']));
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
      put('awning', w.px + w.nx * 0.05, ey, w.pz + w.nz * 0.05, Math.atan2(w.nx, w.nz), 1, C(pick(AW)));
      placed.push([w.px, w.pz]);
    }
  }

  // ---------- 3. zebra crossings (decals) from OSM nodes plus junction arms
  {
    const zb = new MB(), col = C('#d9d7cc'), colw = C('#bdbcb2');
    let nz = 0; const done = [];
    const zebra = (cx, cz, tx, tz) => {
      // stripes lie along the road (t) and are stacked across it (n)
      const nx = -tz, nzz = tx;
      const e1 = march(cx, cz, nx, nzz, 9, road), e2 = march(cx, cz, -nx, -nzz, 9, road);
      if (e1 + e2 < 4.5 || e1 + e2 > 16) return;
      for (let u = -e2 + 0.45; u <= e1 - 0.45; u += 0.95) {
        const k = rand() < 0.2 ? 0.7 : 1, c = rand() < 0.2 ? colw : col;
        const hw = 0.25, hl = 1.6;
        const q = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => { const x = cx + tx * a + nx * (u + b), z = cz + tz * a + nzz * (u + b); return [x, groundY(x, z) + 0.025, z]; });
        zb.face(c, [q[0], q[3], q[2], q[1]], k); // CCW viewed from above
      }
      nz++; done.push([cx, cz]);
    };
    for (const it of osm) {
      if (it.k !== 'crossing' || it.cr === 'unmarked' || it.den === 'unmarked') continue;
      if (done.some(d => hyp2(d[0] - it.x, d[1] - it.z) < 10)) continue;
      const nr = nearRoad(it.x, it.z, 5); if (!nr || !road(nr.px, nr.pz)) continue;
      if (nr.road.k === 'service' && rand() < 0.5) continue;
      zebra(nr.px, nr.pz, nr.tx, nr.tz);
    }
    // junction arms on real streets
    for (const j of junctions) {
      if (j.roads.size < 3 && j.n < 3) continue;
      for (const ri of j.roads) {
        const r = S.roads[ri]; if (!(r.k === 'primary' || r.k === 'secondary' || r.k === 'tertiary')) continue;
        const p = pairs(r.p); let idx = p.findIndex(v => Math.abs(v[0] - j.x) < 0.2 && Math.abs(v[1] - j.z) < 0.2); if (idx < 0) continue;
        const o = idx === 0 ? p[1] : idx === p.length - 1 ? p[p.length - 2] : p[idx + 1]; if (!o) continue;
        const L = hyp2(o[0] - j.x, o[1] - j.z); if (L < 14) continue;
        const tx = (o[0] - j.x) / L, tz = (o[1] - j.z) / L, cx = j.x + tx * 6.5, cz = j.z + tz * 6.5;
        if (done.some(d => hyp2(d[0] - cx, d[1] - cz) < 12) || !road(cx, cz) || rand() < 0.35) continue;
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
          if (a1 === a2 || inB(x, z)) continue;
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
  const placeCar = (x, z, hx, hz) => {
    const model = wpick(CARS), L = { panda: 3.65, hatch: 4.0, micro: 2.75, van: 4.45, pickup: 4.4 }[model];
    const fx = hx * L / 2, fz = hz * L / 2, wx = -hz * 0.9, wz = hx * 0.9;
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0]]) {
      const px = x + fx * a + wx * b, pz = z + fz * a + wz * b;
      if (!road(px, pz) || nearWall(px, pz, 0.12)) return false;
    }
    if (occHit(x, z, L * 0.4) || occHit(x + hx * L * 0.3, z + hz * L * 0.3, 1) || occHit(x - hx * L * 0.3, z - hz * L * 0.3, 1)) return false;
    put(model, x, groundY(x, z), z, Math.atan2(hx, hz), R(0.99, 1.01), burntCar(x, z) || paint());
    occAdd(x, z, L * 0.36); occAdd(x + hx * L * 0.3, z + hz * L * 0.3, 0.9); occAdd(x - hx * L * 0.3, z - hz * L * 0.3, 0.9);
    carCount++; return true;
  };
  const MARKET = /Ballar|Vucciria|Caracciolo|Chiappara|Maccheronai|Garraffello|Cassari|Argenteria/;
  {
    const CAR_CLASSES = { residential: 0.62, tertiary: 0.5, secondary: 0.38, unclassified: 0.6, service: 0.3, living_street: 0.28, primary: 0.3 };
    let bins = 0, stalls = 0, cap = S.carCap;
    for (let ri = 0; ri < S.roads.length; ri++) {
      const r = S.roads[ri]; if (BUD.over()) yield;
      const base = CAR_CLASSES[r.k] * zoneCars(r); if (!base) continue;
      const market = MARKET.test(r.n || '');
      const p = pairs(r.p); let carry = R(0, 5);
      const state = [rand() < 0.6, rand() < 0.6];
      let binGap = R(10, 40);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 0.5) continue;
        const tx = dx / L, tz = dz / L, rx = -tz, rz = tx;   // right of travel
        for (let s = carry; s < L; s += 5.7) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (!inBounds(cx, cz, 10)) continue;
          const dC = distEff(cx, cz), thin = Math.max(0.3, 1.15 - dC / 1500) * DEN;
          const jn = nearJunction(cx, cz, 8);
          for (let side = 0; side < 2; side++) {
            const sg = side ? -1 : 1, nx = rx * sg, nz = rz * sg;
            state[side] = state[side] ? rand() < 0.82 : rand() < 0.34;
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
            if (jn || carCount >= cap || e + e2 < 3.0 + 1.9) {
              if (!(e + e2 >= 4.8)) continue;
            }
            if (jn || carCount >= cap) continue;
            if (e + e2 - 1.75 < 2.7) continue;                 // a car must still be able to pass
            if (rand() > thin * Math.min(1, base * 0.62)) { state[side] = false; continue; }
            if (!state[side]) continue;
            const d = e - 0.98, x = cx + nx * d, z = cz + nz * d;
            const fwd = rand() < 0.88 ? (sg > 0 ? 1 : -1) : -(sg > 0 ? 1 : -1);
            placeCar(x, z, tx * fwd, tz * fwd);
          }
          // cassonetti: groups at the kerb every so often
          binGap -= 5.7;
          if (binGap < 0 && !jn && r.k !== 'service') {
            binGap = R(110, 260);
            const side = rand() < 0.5 ? 1 : -1, nx = rx * side, nz = rz * side, e = march(cx, cz, nx, nz, 9, road);
            if (e > 2.6) {
              const nb = 1 + Math.floor(rand() * 3), d = e - 0.72;
              let ok = 0;
              for (let q = 0; q < nb; q++) {
                const x = cx + nx * d + tx * q * 1.35, z = cz + nz * d + tz * q * 1.35;
                if (!road(x + nx * 0.5, z + nz * 0.5) && !raisedMask(x + nx * 0.5, z + nz * 0.5)) { }
                if (!wallClear(x, z, 0.7) || occHit(x, z, 0.8) || !road(x - nx * 0.7, z - nz * 0.7) && false) continue;
                const over = hash3(x * 0.7, z * 0.7, 3) < 0.18 + 0.5 * squalor(x, z) * (r.k === 'primary' || r.k === 'secondary' ? 0.4 : 1);
                put(over ? 'bin_over' : 'bin_big', x, groundY(x, z), z, Math.atan2(nx, nz) + Math.PI + R(-0.06, 0.06)); occAdd(x, z, 0.8); ok++; bins++; binSites.push([x, z, nx, nz, tx, tz, over]);
                if (rand() < 0.3) { put('bags', x + nx * 0.2 - tx * 0.4, groundY(x, z), z + nz * 0.2 - tz * 0.4, R(0, TAU), R(0.8, 1.1)); }
              }
              if (ok && rand() < 0.3) { const x = cx + nx * d - tx * 1.6, z = cz + nz * d - tz * 1.6; if (wallClear(x, z, 0.5) && !occHit(x, z, 0.7)) put('bags', x, groundY(x, z), z, R(0, TAU), R(0.8, 1.2)); }
            }
          }
        }
        carry = ((carry - L) % 5.7 + 5.7) % 5.7;
      }
    }
    stats.cars_proc = carCount; stats.cassonetti_proc = bins; stats.stalls = stalls;
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
    for (const a of P.areas) {
      if (a.k !== 'parking' || a.ptype === 'multi-storey' || a.ptype === 'underground') continue;
      const pts = pairs(a.p); if (pts.length < 4) continue;
      const area = Math.abs(signedArea(pts)); if (area < 40 || area > 8000) continue;
      // principal axis from the longest edge
      let best = 0, ang = 0;
      for (let i = 0; i < pts.length - 1; i++) { const l = hyp2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (l > best) { best = l; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); } }
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const u = pts.map(p => p[0] * ca + p[1] * sa), v = pts.map(p => -p[0] * sa + p[1] * ca);
      const u0 = Math.min(...u), u1 = Math.max(...u), v0 = Math.min(...v), v1 = Math.max(...v);
      const wide = (v1 - v0) > 9;   // two rows of nose-in cars, else parallel
      for (let uu = u0 + 1.3; uu < u1; uu += wide ? 2.5 : 5.3) for (let vv = v0 + 2.3; vv < v1; vv += wide ? 5.2 : 2.6) {
        const x = uu * ca - vv * sa, z = uu * sa + vv * ca;
        if (!inPoly(pts, x, z) || rand() < 0.28) continue;
        const hx = wide ? -sa : ca, hz = wide ? ca : sa;
        placeCar(x, z, hx * (rand() < 0.5 ? 1 : -1), hz * (rand() < 0.5 ? 1 : -1)) && n++;
      }
    }
    stats.cars_lots = n;
  }

  // ---------- 9. vegetation: parks, green strips, piazza palms
  {
    let n = 0;
    const kinds = [['tree', 26], ['ficus', 12], ['pine', 8], ['orange', 12], ['palm_fan_a', 6], ['palm_fan_b', 4], ['palm_fan_c', 3], ['palm_date_a', 3], ['palm_date_b', 2], ['shrub', 8]];
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
        const kind = wpick(kinds);
        if (placeTree(x, z, kind)) { i++; n++; }
      }
    }
    stats.trees_green = n;
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
        if (placeTree(x, z, wpick([['palm_fan_a', 4], ['palm_fan_b', 3], ['palm_date_a', 2], ['ficus', 2], ['orange', 3]]))) { i++; pn++; }
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
          if (placeTree(x, z, wpick([['orange', 5], ['tree', 2], ['ficus', 2], ['palm_fan_a', 2]]))) sn++;
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
    for (const r of S.roads) {
      const nm = r.n || '';
      const lib = AVENUE.test(nm), front = FRONT.test(nm) && DRIVE.has(r.k);
      let grand = false;
      if (!lib && !front && (r.k === 'primary' || r.k === 'secondary') && r.p.length >= 4) { const zn = zoneOf(r.p[0], r.p[1]); grand = zn === 'viaLib' || zn === 'sacco' || zn === 'resut'; }
      if (!lib && !front && !grand) continue;
      if (BUD.over()) yield;
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = hyp2(dx, dz); if (L < 3) continue;
        const tx = dx / L, tz = dz / L;
        for (let s = RF(1, 6); s < L; s += front ? 13 : lib ? 10.5 : 15) {
          const cx = a[0] + tx * s, cz = a[1] + tz * s;
          if (nearJunction(cx, cz, 7) && !front) continue;
          for (const sg of [1, -1]) {
            if (!lib && rf() > (front ? 0.7 : 0.5)) continue;
            const nx = -tz * sg, nz = tx * sg, e = march(cx, cz, nx, nz, 18, road); if (e < 1) continue;
            const d = e + (front ? 1.5 : 1.8), x = cx + nx * d, z = cz + nz * d;
            if (!inBounds(x, z) || (!raisedMask(x, z) && !paving(x, z))) continue;
            if (front ? placeTree(x, z, pickF(['palm_fan_a', 'palm_fan_b', 'palm_fan_a', 'palm_date_a'])) : placeTree(x, z, 'tree', 1.35, lib ? PLANE_TINT : null)) { if (front) st.palms++; else st.plane++; }
          }
        }
      }
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

  return res;
}

// ------------------------------------------------------------------ instances -> meshes
// How far (m) each model is drawn; the cell meshes are culled by distance in the scene's onBeforeRender
const FAR = { bag_pile3: 260, mega0: 420, mega1: 420, mega2: 420, mega_burnt0: 420, mega_burnt1: 420, bag_pile0: 220, bag_pile1: 220, bag_pile2: 220, bin_over: 380, cardboard: 220, dump_mattress: 260, dump_fridge: 260, dump_chair: 260, dump_sofa: 260, dump_wreck: 260, litter0: 110, litter1: 110, litter_cafe: 110, mwaste0: 160, mwaste1: 160, mcrates: 200, cafe_set: 280, scooter: 300, bin_small: 250, bags: 250, bollard: 280, hydrant: 200, phone: 250, postbox: 200, cabinet: 200, bench: 300, lamp_wall: 320, awning: 300, stall_table: 320, umbrella: 340,
  signal: 350, busstop: 300, bin_big: 380, panda: 500, hatch: 500, micro: 500, van: 500, pickup: 500, ape: 500, apetaxi: 500, lamp_pole: 650, candelabra: 450, monument: 600, shelter: 350, fountain: 600,
  shrub: 350, ficus: 1300, tree: 1000, orange: 800, pine: 1100, palm_fan_a: 1300, palm_fan_b: 1500, palm_fan_c: 1100, palm_date_a: 1100, palm_date_b: 1200,
  beach_umbrella: 420, sunbed: 220, kiosk: 450, hedge: 260 };
const MOBILE = !!QUALITY.mobile;
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

// Turns the generated buckets into InstancedMeshes (one per model and 250 m cell) under `parent`.
function* instantiate(res, parent, BUD) {
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const meshes = [], meshOf = {}, geos = []; let tris = 0, total = 0;
  for (const [name, cells] of Object.entries(res.buckets)) {
    const M = MODELS[name], per = M.geo.attributes.position.count / 3;
    for (const [ckey, e] of cells.entries()) {
      const n = e.m.length / 5;
      const im = new THREE.InstancedMesh(M.geo, MATS[M.mat], n);
      for (let i = 0; i < n; i++) {
        q4.setFromAxisAngle(up, e.m[i * 5 + 3]); s3.setScalar(e.m[i * 5 + 4]);
        m4.compose(p3.set(e.m[i * 5], e.m[i * 5 + 1], e.m[i * 5 + 2]), q4, s3); im.setMatrixAt(i, m4);
        // [perf pass] every pooled mesh gets an instance colour (white when untinted): the shared materials otherwise flip between
        // 'with / without instanceColor' from one mesh to the next and three re-derives the program parameters (a few MB of garbage per frame).
        im.setColorAt(i, M.tint ? col.setRGB(e.c[i * 3], e.c[i * 3 + 1], e.c[i * 3 + 2]) : WHITE_IC);
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = !/^(bags)$/.test(name); im.receiveShadow = true;
      im.userData.kind = name; /* [day/night] src/daynight.js finds the lamps by kind */ im.userData.maxd = (FAR[name] ?? 450) * (MOBILE ? 0.7 : 1);
      meshes.push(im); meshOf[name + '|' + ckey] = im; parent.add(im); tris += per * n; total += n;
    }
    if (BUD.over()) yield;
  }
  for (const g of res.decals) {
    const m = new THREE.Mesh(g, zebraMat()); m.receiveShadow = true; parent.add(m); geos.push(g); tris += g.attributes.position.count / 3;
  }
  if (res.rails) {
    const a = new THREE.Mesh(res.rails.posts, MATS.dbl); a.castShadow = true; a.receiveShadow = true; parent.add(a);
    const b = new THREE.Mesh(res.rails.panels, panelMat()); b.castShadow = true; b.receiveShadow = true; parent.add(b);
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
  const tstats = { tiles: 0, built: 0, instances: 0, tris: 0, ms: 0, msMax: 0, lamps: 0, stepMax: 0, cpu: 0, queued: () => [...jobs.values()].filter(j => j.phase < 3).length };

  // ---------- tile source
  const sandRings = d => { const a = (d.areas || []).filter(q => q.k === 'sand').map(q => q.p); return a.length ? a : ((d.streets && d.streets.sand) || []).map(p => p[0]); };
  function tileSource(job) {
    const t = job.t, d = t.data, x0 = t.i * T, z0 = t.j * T, x1 = x0 + T, z1 = z0 + T;
    const nb = [], nroads = [];
    if (W) for (const o of W.tiles.values()) {
      if (o === t || !o.data || Math.abs(o.i - t.i) > 1 || Math.abs(o.j - t.j) > 1) continue;
      for (const b of o.data.buildings) {   // neighbours' houses that reach over the border keep cars out of them
        const p = b.p; let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9;
        for (let i = 0; i < p.length; i += 2) { if (p[i] < a0) a0 = p[i]; if (p[i] > a1) a1 = p[i]; if (p[i + 1] < c0) c0 = p[i + 1]; if (p[i + 1] > c1) c1 = p[i + 1]; }
        if (a1 > x0 - 6 && a0 < x1 + 6 && c1 > z0 - 6 && c0 < z1 + 6) nb.push(b);
      }
      for (const r of o.data.roads) if (r.n && MARKET_OR_POOR.test(r.n)) nroads.push(r);   // their street names still make this tile's edge scruffy
    }
    const k = t.i * 7919 + t.j * 104729, den = MOBILE ? 0.55 : 1;
    const st = d.streets || {};
    return {
      ctx, P: d.props || { items: [], areas: [], counts: {} }, seed: 1868 + k, seed2: 7011 + k, seed3: 4242 + k, cell: 250,
      x0, z0, x1, z1, aoi: [x0, z0, x1, z1], inBounds: (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1,
      idx: makeIndex(d.buildings.concat(nb)), ownCount: d.buildings.length,
      roads: d.roads, hotRoads: d.roads.concat(nroads), curbs: st.curbs || [], asphalt: st.asphalt || [], paving: st.paving || [],
      sand: sandRings(d),
      areas: d.areas || [], den, carCap: Math.round(420 * den), treeCap: Math.round(420 * den), megaCap: 10,
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
      for (const im of inst.meshes) { im.visible = false; cull.push(im); }
      scene.add(job.group);
      job.lamps = inst.meshes.some(im => im.userData.kind === 'lamp_pole' || im.userData.kind === 'lamp_wall' || im.userData.kind === 'candelabra');
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
    BUD.t = now + (MOBILE ? 2.5 : 4);
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
    const group = new THREE.Group(); group.name = 'props_' + t.i + '_' + t.j;
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
    for (let i = 0; i < cull.length; i++) { const im = cull[i], b = im.boundingSphere, dx = b.center.x - cp.x, dy = b.center.y - cp.y, dz = b.center.z - cp.z; im.visible = Math.sqrt(dx * dx + dy * dy + dz * dz) - b.radius < im.userData.maxd; }
    phys.flush(cp);
    prev.call(this, r, sc, camera, ...rest);
  };
  const api = { collidePlayer: phys.collidePlayer, stats: phys.stats, tileStats: tstats, attachWorld };
  api.grid = phys.grid;
  if (location.search.includes('debug')) window.__props = Object.assign(api, { jobs, phys });
  return api;
}
