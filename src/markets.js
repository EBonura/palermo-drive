// The three street markets (Ballaro, the Vucciria around Piazza Caracciolo and Garraffello, the Capo along Via Sant'Agostino) as living markets: lines of stalls
// along the real streets (src/markets-data.js, laid out by tools/make_markets.py from the baked tiles), each with a striped awning or a tarp on poles, crates of
// fruit, vegetables, fish on ice, hams and cheeses, sacks of olives and spices, a few strings of bulbs, and the vendors standing behind the tables (the crowd's own
// vendor sprites, scripted so they stay put). The stalls are solid for the lapa (a box each), packed away at night (the Vucciria's evening crowd is the movida,
// src/pedestrians.js), and cost a few instanced meshes per market: everything is vertex-coloured low poly, one InstancedMesh per model and market, switched off
// when the market is far away. Numbers are in docs/PERF.md (markets).
// The stalls are yeetable like the other props: a stall (table, frame, goods) hit at 3 m/s or more breaks free and its pieces fly separately (the frame, the goods on the table, the
// canopy with its bulbs), loose fruit, fish and vegetables spill and scatter (the bag pool of src/props.js), and a pile of crates beside a stall goes at 1.6 m/s. Slower, they are walls.
// The pieces are instances of the market's own meshes (the canopy, the bulbs, the crates) or of a few wreck meshes made when the first stall of a kind is smashed (the frame and the
// goods of the table, which the intact stall draws as one mesh); src/props.js flies them (throwPiece). A smashed stall stays smashed for the session.
import * as THREE from 'three';
import { MARKETS } from './markets-data.js';
import { NIGHT } from './daynight.js';
import { hooks } from './core.js';

const C = h => new THREE.Color(h), WHITE = C('#ffffff');

// ------------------------------------------------------------------ geometry builder (convex solids wind away from their centre)
class G {
  constructor() { this.p = []; this.c = []; this.gp = []; this.gc = []; this.on = false; }   // gp, gc: the goods (crates, heaps, trays), apart from the frame, so a smashed stall can spill them
  v(a, col, k) { const p = this.on ? this.gp : this.p, c = this.on ? this.gc : this.c; p.push(a[0], a[1], a[2]); c.push(col.r * k, col.g * k, col.b * k); }
  face(col, vs, k = 1, ctr = null) {
    if (ctr) {
      const [a, b, c] = vs, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const mx = (a[0] + b[0] + c[0]) / 3 - ctr[0], my = (a[1] + b[1] + c[1]) / 3 - ctr[1], mz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      if (nx * mx + ny * my + nz * mz < 0) vs = vs.slice().reverse();
    }
    for (let i = 1; i < vs.length - 1; i++) { this.v(vs[0], col, k); this.v(vs[i], col, k); this.v(vs[i + 1], col, k); }
  }
  // box x0..x1, y0..y1, z0..z1 (no bottom unless bot)
  box(x0, y0, z0, x1, y1, z1, col, bot = false) {
    const ctr = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.face(col, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 1, ctr);
    this.face(col, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0.84, ctr);
    this.face(col, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 0.7, ctr);
    this.face(col, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 0.78, ctr);
    this.face(col, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.74, ctr);
    if (bot) this.face(col, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0.5, ctr);
    return this;
  }
  // a heap: box-like frustum from the bottom rectangle to a smaller top rectangle
  heap(x0, z0, x1, z1, y0, y1, col, top = 0.55) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 * top, hz = (z1 - z0) / 2 * top, ctr = [cx, (y0 + y1) / 2, cz];
    const b = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], t = [[cx - hx, y1, cz - hz], [cx + hx, y1, cz - hz], [cx + hx, y1, cz + hz], [cx - hx, y1, cz + hz]];
    this.face(col, t, 1.05, ctr);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.face(col, [b[i], b[j], t[j], t[i]], i % 2 ? 0.8 : 0.9, ctr); }
    return this;
  }
  // a bulb: small octahedron
  bulb(x, y, z, r, col) {
    const p = [[x + r, y, z], [x - r, y, z], [x, y + r, z], [x, y - r, z], [x, y, z + r], [x, y, z - r]];
    for (const [a, b, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) this.face(col, [p[a], p[b], p[c]], 1, [x, y, z]);
    return this;
  }
  geo(part) {   // the whole model, or only its 'frame' or its 'goods'
    const g = new THREE.BufferGeometry(), p = part === 'frame' ? this.p : part === 'goods' ? this.gp : this.p.concat(this.gp), c = part === 'frame' ? this.c : part === 'goods' ? this.gc : this.c.concat(this.gc);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
    return g;
  }
}

// ------------------------------------------------------------------ the models (front of the table is +z, y up, 2.2 m wide)
const WOOD = C('#a98a5a'), WOODD = C('#6b5238'), POLE = C('#5d5a55'), CLOTH = C('#efe9d8');
function base(g, top = WOOD) {   // trestle table and the four poles of the frame (the canopy is a separate model)
  g.box(-1.05, 0.74, -0.42, 1.05, 0.8, 0.42, top);
  g.box(-0.98, 0, -0.34, -0.9, 0.74, 0.34, WOODD); g.box(0.9, 0, -0.34, 0.98, 0.74, 0.34, WOODD);
  for (const [x, z, h] of [[-1.12, 0.55, 2.1], [1.12, 0.55, 2.1], [-1.12, -1.0, 2.55], [1.12, -1.0, 2.55]]) g.box(x - 0.025, 0, z - 0.025, x + 0.025, h, z + 0.025, POLE);
}
const crate = (g, x, z, y = 0.8, w = 0.3, d = 0.22, h = 0.12) => g.box(x - w, y, z - d, x + w, y + h, z + d, WOOD);
// what each kind of table sells, in the colours of its heaps (the lumps that spill when it is smashed use them too)
const FRUIT = ['#e8841a', '#e8d02a', '#c8301c', '#6e9a3a', '#e8a060', '#d8561c'], VEG = ['#4f8a2c', '#8ab030', '#b82a1c', '#4a2060', '#e07818', '#6a8a4a', '#9a3a18', '#3e7a3c'];
const FISH = ['#b8c4cc', '#6c8ca8', '#d8604a', '#e8a8a0', '#8aa0b0', '#c8d4da'], MEAT = ['#8a3a2c', '#c46a58', '#7a2c24', '#b85a48', '#9a4a38', '#d8b0a0', '#e6c866'], MISC = ['#c8601c', '#e8c030', '#8a3820', '#5a6a2c', '#2a2220', '#c8b078'];
const LOOT = [FRUIT, VEG, FISH, MEAT, MISC].map(l => l.map(C)), LUMP = [0.4, 0.45, 0.55, 0.6, 0.5];   // lump colours and sizes (times a bag of rubbish) per kind
// each model is a G: the frame (table and poles, what holds the awning) and the goods (g.on) are kept apart, drawn together until the stall is smashed
function fruit() {
  const g = new G(); base(g); g.on = true;
  let i = 0; for (const z of [-0.16, 0.2]) for (const x of [-0.7, 0, 0.7]) { crate(g, x, z); g.heap(x - 0.27, z - 0.19, x + 0.27, z + 0.19, 0.92, 1.06, C(FRUIT[i++ % 6]), 0.85); }
  g.box(-0.9, 0, -0.95, -0.45, 0.28, -0.6, WOOD); g.box(-0.9, 0.28, -0.95, -0.45, 0.56, -0.6, WOODD);   // empty crates stacked behind
  return g;
}
function veg() {
  const g = new G(); base(g); g.on = true;
  let i = 0; for (const z of [-0.16, 0.2]) for (const x of [-0.7, 0, 0.7]) { crate(g, x, z); g.heap(x - 0.27, z - 0.19, x + 0.27, z + 0.19, 0.92, 1.08, C(VEG[(i++ * 3) % 8]), 0.9); }
  g.box(0.5, 0, -0.95, 0.95, 0.3, -0.55, WOOD); g.heap(0.52, -0.93, 0.93, -0.57, 0.3, 0.46, C('#6a8a4a'), 0.8);
  return g;
}
function fish() {
  const g = new G(); base(g, C('#c8ccd0')); g.on = true;
  g.box(-0.95, 0.8, -0.38, 0.95, 0.9, 0.38, C('#dfe9ee'));                       // the ice tray
  g.heap(-0.93, -0.36, 0.93, 0.36, 0.9, 0.97, C('#f4f8fa'), 0.96);              // crushed ice
  const body = FISH;
  let i = 0;
  for (const z of [-0.2, 0.05, 0.28]) for (let k = 0; k < 4; k++) {   // fish lying across the ice, each a tapered flat box
    const x = -0.8 + k * 0.5 + (z === 0.05 ? 0.2 : 0), c = C(body[i++ % 6]);
    g.heap(x - 0.2, z - 0.06, x + 0.2, z + 0.06, 0.96, 1.04, c, 0.6); g.box(x + 0.2, 0.97, z - 0.03, x + 0.27, 1.02, z + 0.03, c);
  }
  g.heap(-0.4, -0.34, 0.5, -0.04, 0.97, 1.1, C('#5a6a78'), 0.45);                 // the swordfish steak head, with its sword
  g.box(0.5, 1.02, -0.2, 1.05, 1.05, -0.17, C('#5a6a78'));
  g.on = false; g.box(-1.0, 0.8, 0.42, 1.0, 0.86, 0.5, C('#9aa4aa'));              // the metal lip at the front
  return g;
}
function meat() {
  const g = new G(); base(g, CLOTH);
  g.box(-1.12, 1.98, 0.5, 1.12, 2.02, 0.56, POLE); g.on = true;                    // the hook bar under the canopy
  const hang = MEAT;
  for (let k = 0; k < 6; k++) { const x = -0.95 + k * 0.38, len = 0.4 + (k % 3) * 0.12; g.heap(x - 0.07, 0.46, x + 0.07, 0.6, 1.98 - len, 1.98, C(hang[k]), 0.5); }
  g.box(-0.9, 0.8, -0.3, -0.1, 0.86, 0.3, C('#b83030')); g.heap(-0.88, -0.28, -0.12, 0.28, 0.86, 0.94, C('#c85048'), 0.85);   // a tray of cuts
  for (const x of [0.2, 0.55, 0.85]) g.heap(x - 0.14, -0.14, x + 0.14, 0.14, 0.8, 0.95, C('#e6c866'), 0.9);                      // wheels of cheese
  return g;
}
function misc() {
  const g = new G(); base(g, C('#8b7455')); g.on = true;
  const heaps = MISC;
  let i = 0; for (const x of [-0.75, -0.25, 0.25, 0.75]) { g.box(x - 0.2, 0.8, -0.3, x + 0.2, 0.9, 0.3, C('#e8e4d8')); g.heap(x - 0.19, -0.29, x + 0.19, 0.29, 0.9, 1.04, C(heaps[i++ % 6]), 0.9); }
  for (const [x, c] of [[-0.55, '#c8b078'], [0, '#b8a068'], [0.55, '#d0bc84']]) { g.heap(x - 0.25, -0.95, x + 0.25, -0.55, 0, 0.55, C(c), 0.7); }   // sacks standing behind
  g.box(-1.05, 0, 0.5, -0.62, 0.35, 0.8, WOOD); g.heap(-1.03, 0.52, -0.64, 0.78, 0.35, 0.5, C('#5a6a2c'), 0.85);                    // a tub of olives on the ground
  return g;
}
const AW = [['#c4281f', '#f4f0e6'], ['#2b7a45', '#f4f0e6'], ['#2a5aa0', '#f4f0e6'], ['#e0a820', '#f4f0e6']];
function awning(pair) {   // striped canopy, sloping from the back (high) to the front (low), a valance on the front edge
  const g = new G(), n = 10, W = 2.6, zb = -1.1, yb = 2.6, zf = 0.8, yf = 2.08, ca = C(AW[pair][0]), cb = C(AW[pair][1]);
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + W * i / n, x1 = -W / 2 + W * (i + 1) / n, c = i % 2 ? cb : ca;
    g.face(c, [[x0, yb, zb], [x1, yb, zb], [x1, yf, zf], [x0, yf, zf]], 1);
    g.face(c, [[x0, yf, zf], [x1, yf, zf], [x1, yf - 0.22, zf + 0.02], [x0, yf - 0.22, zf + 0.02]], 0.82);
  }
  g.face(ca, [[-W / 2, yb, zb], [-W / 2, yf, zf], [-W / 2, yb - 0.3, zb]], 0.6); g.face(ca, [[W / 2, yb, zb], [W / 2, yb - 0.3, zb], [W / 2, yf, zf]], 0.6);
  return g.geo();
}
function tarp() {   // one plain sheet, tinted per instance, slack in the middle
  const g = new G(), W = 2.7, zb = -1.15, yb = 2.62, zf = 0.85, yf = 2.0, c = WHITE;
  g.face(c, [[-W / 2, yb, zb], [0, yb - 0.05, zb], [0, yf - 0.1, zf], [-W / 2, yf, zf]], 1);
  g.face(c, [[0, yb - 0.05, zb], [W / 2, yb + 0.04, zb], [W / 2, yf + 0.06, zf], [0, yf - 0.1, zf]], 0.92);
  g.face(c, [[-W / 2, yf, zf], [0, yf - 0.1, zf], [0, yf - 0.34, zf], [-W / 2, yf - 0.24, zf]], 0.78); g.face(c, [[0, yf - 0.1, zf], [W / 2, yf + 0.06, zf], [W / 2, yf - 0.16, zf], [0, yf - 0.34, zf]], 0.74);
  return g.geo();
}
function bulbs() {
  const g = new G(), c = C('#fff0bc');
  for (const x of [-0.9, -0.3, 0.3, 0.9]) g.bulb(x, 1.92, 0.82, 0.05, c);
  g.box(-1.0, 2.0, 0.8, 1.0, 2.01, 0.82, C('#222222'));   // the wire
  return g.geo();
}
function crates() {   // a pile of empty and full crates on the ground beside the stall
  const g = new G(); const c1 = WOOD, c2 = C('#8f7448');
  for (const [x, z, n] of [[0, 0, 3], [0.62, 0.05, 2]]) for (let k = 0; k < n; k++) { g.box(x - 0.28, k * 0.2, z - 0.2, x + 0.28, k * 0.2 + 0.19, z + 0.2, k % 2 ? c2 : c1); }
  g.heap(0.34, -0.15, 0.9, 0.25, 0.4, 0.5, C('#e8841a'), 0.85);
  return g.geo();
}

// ------------------------------------------------------------------ the module
const SEE = 330;                 // metres from a market's edge within which its meshes are drawn
const VEND = ['fruttivendolo', 'vendor', 'pescivendolo', 'macellaio', 'vendor2'];   // by stall kind
const NEAR_V = 62, FAR_V = 82, MAX_V = 36;                                     // vendors exist for stalls within NEAR_V of the camera (up to MAX_V at once)
const TARP_TINT = ['#2a6aa8', '#3a7a40', '#e8e4da', '#b8742a'].map(C);
const THR_STALL = 3.0, THR_CRATES = 1.6;   // closing speed (m/s) from which a stall, or the pile of crates beside it, breaks (a fence panel 3.0, a bench 3.5, a crate 1.2); slower they are walls
const LOSS = 0.3;                          // share of the closing speed the lapa gives up to a stall it smashes (a fence panel 0.22, a garden wall 0.38): it goes on through
const WRECK = 64;                          // pieces of each kind and part the wreck meshes keep (the oldest is recycled)
const FAR = [1e7, 1e7, 1e7, 1e7];          // where a wall segment that is not in play sits (as the fences do)
const NONE = new THREE.Vector3(0, 0, 0);
// what src/props.js flies a loose piece by: its mass, and the half extents and centre height of its box, from the geometry
const pieceSpec = (geo, m) => { geo.computeBoundingBox(); const b = geo.boundingBox; return { kind: 'object', m, ghost: true, hc: (b.min.y + b.max.y) / 2, he: [Math.max(-b.min.x, b.max.x), (b.max.y - b.min.y) / 2, Math.max(-b.min.z, b.max.z)] }; };
const piece = (im, i, x, y, z, rot, sp) => ({ im, i, x, z, x0: x, y0: y, z0: z, rot, rot0: rot, s: 1, st: 0, sp });

export function createMarkets(env) {
  const { scene, camera, groundY, walls2d, props } = env;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const matD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: C('#ffcf70'), emissiveIntensity: 0.15 });
  const bodyG = [fruit(), veg(), fish(), meat(), misc()], bodyGeo = bodyG.map(g => g.geo());
  const geos = { tarp: tarp(), bulbs: bulbs(), crates: crates(), aw: AW.map((_, i) => awning(i)) };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3(), col = new THREE.Color();
  const q = new URLSearchParams(location.search);
  const off = q.get('markets') === '0';
  const cratePos = s => [s[0] + Math.cos(s[2]) * 1.55 + Math.sin(s[2]) * 0.55, s[1] - Math.sin(s[2]) * 1.55 + Math.cos(s[2]) * 0.55];   // the pile beside the stall, a little to its front

  const markets = MARKETS.map(M => {
    const n = M.s.length, S = M.s;
    // which stalls go to which mesh
    const byBody = [[], [], [], [], []], byAw = [[], [], [], []], tarps = [], cr = [];
    S.forEach((s, i) => { byBody[s[3]].push(i); if (s[4] < 4) byAw[s[4]].push(i); else tarps.push(i); if (s[5]) cr.push(i); });
    const meshes = [], where = S.map(() => ({}));   // where[i]: the [mesh, instance] of each part of stall i
    const mk = (geo, list, material, tint, shadow, part) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, material, list.length); im.matrixAutoUpdate = false; im.castShadow = shadow; im.receiveShadow = true; im.visible = false;
      if (tint) for (let k = 0; k < list.length; k++) im.setColorAt(k, TARP_TINT[S[list[k]][4] - 4]);
      im.userData.list = list; im.userData.noShadowFar = true; im.userData.part = part; list.forEach((j, k) => { where[j][part] = [im, k]; }); scene.add(im); meshes.push(im); return im;
    };
    const parts = [];
    byBody.forEach((l, k) => { const im = mk(bodyGeo[k], l, mat, false, false, 'body'); if (im) parts.push(im); });   // the tables cast no shadow (the canopies do): the shadow pass is the expensive one
    byAw.forEach((l, k) => { const im = mk(geos.aw[k], l, matD, false, true, 'canopy'); if (im) parts.push(im); });
    { const im = mk(geos.tarp, tarps, matD, true, true, 'canopy'); if (im) parts.push(im); }
    { const im = mk(geos.crates, cr, mat, false, false, 'crates'); if (im) parts.push(im); }
    const bulb = mk(geos.bulbs, S.map((_, i) => i), bulbMat, false, false, 'bulb');
    // collision: a box each for the stall and for the pile of crates beside it, in the lapa's wall grid (static, like the carretto). The segments carry their piece (seg.fn) so the lapa
    // smashes it above a speed (hooks.breakFence, src/fences.js asks the same of its panels); they sit out of play (at FAR) while the market is not drawn: shut at night, far away or ?markets=0
    const ent = [];
    const box = (e, x, z, r, u0, v0, u1, v1) => {
      const sn = Math.sin(r), cs = Math.cos(r), c = (u, v) => [x + cs * u + sn * v, z - sn * u + cs * v], k = [c(u0, v0), c(u1, v0), c(u1, v1), c(u0, v1)];
      for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4], seg = [a[0], a[1], b[0], b[1]]; seg.fn = e; seg.o = seg.slice(); e.segs.push(seg); walls2d.addSeg(seg, a[0], a[1], b[0], b[1]); seg[0] = seg[1] = seg[2] = seg[3] = FAR[0]; }
      ent.push(e);
    };
    S.forEach((s, i) => {
      box({ mk: null, i, part: 1, thr: THR_STALL, segs: [], gone: false }, s[0], s[1], s[2], -1.1, -0.45, 1.1, 0.45);
      if (s[5]) { const [px, pz] = cratePos(s); box({ mk: null, i, part: 2, thr: THR_CRATES, segs: [], gone: false }, px, pz, s[2], -0.3, -0.22, 0.92, 0.27); }
    });
    const m = { M, n, S, parts, bulb, meshes, where, ent, dead: new Uint8Array(n), on: false, y: new Float32Array(n), ids: new Int32Array(n).fill(-1), t0: 0, again: false };
    for (const e of ent) e.mk = m;
    return m;
  });
  const hide = (im, k, x, y, z) => im.setMatrixAt(k, m4.compose(p3.set(x, y, z), q4.identity(), NONE));   // scaled to nothing where it stood (the culling sphere still knows the place)
  const wake = (mk, on) => { for (const e of mk.ent) if (!e.gone) for (const s of e.segs) { const a = on ? s.o : FAR; s[0] = a[0]; s[1] = a[1]; s[2] = a[2]; s[3] = a[3]; } };
  const place = (mk) => {   // matrices from the stalls' ground heights (re-done when the market comes into range, the tiles' fine heights may arrive a moment later)
    for (const im of mk.meshes) {
      const list = im.userData.list, isCr = im.geometry === geos.crates, isBody = im.userData.part === 'body';
      for (let k = 0; k < list.length; k++) {
        const s = mk.S[list[k]], x = s[0], z = s[1], r = s[2];
        if (mk.dead[list[k]] & (isCr ? 2 : 1)) { if (isBody) hide(im, k, x, mk.y[list[k]], z); continue; }   // smashed: the pieces lie as src/props.js left them (the fused body is gone, its two halves are in the wreck meshes)
        const y = groundY(x, z); mk.y[list[k]] = y;
        let px = x, pz = z; if (isCr) [px, pz] = cratePos(s);
        im.setMatrixAt(k, m4.compose(p3.set(px, isCr ? groundY(px, pz) : y, pz), q4.setFromAxisAngle(up, r), s1));
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.boundingSphere.radius += 30;   // 30 m of room for what is thrown off the stalls
    }
  };

  // ---------- smashing a stall
  // A table is drawn as one mesh until the first of its kind breaks: then the frame and the goods get a mesh each, the whole model is hidden and its two halves fly apart.
  const wreck = {}, wreckMeshes = [];
  function wreckSlot(kind, part) {
    const key = kind + part; let w = wreck[key];
    if (!w) {
      const geo = bodyG[kind].geo(part), im = new THREE.InstancedMesh(geo, mat, WRECK);
      im.matrixAutoUpdate = false; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.name = 'market_wreck'; im.computeBoundingSphere(); im.count = 0; scene.add(im); wreckMeshes.push(im);
      w = wreck[key] = { im, n: 0, sp: pieceSpec(geo, part === 'frame' ? 0.8 : 0.4) };
    }
    const i = w.n++ % WRECK; w.im.count = Math.min(w.n, WRECK); return [w.im, i, w.sp];
  }
  const specOf = (im, m) => im.userData.sp ||= pieceSpec(im.geometry, m);
  const lumps = (n, x, y, z, r, w, d, nx, nz, vs, car, kind) => {   // loose fruit, fish, vegetables: spilled over a w by d patch facing r, they scatter away from the lapa and lie where they land
    const cols = LOOT[kind];
    for (let k = 0; k < n; k++) {
      const v = vs * (0.3 + Math.random() * 0.7), u = (Math.random() - 0.5) * w, f = (Math.random() - 0.5) * d;
      props.lump(x + Math.cos(r) * u + Math.sin(r) * f, y + Math.random() * 0.25, z - Math.sin(r) * u + Math.cos(r) * f, -nx * v + car.vx * 0.3 + (Math.random() - 0.5) * 3, 2 + Math.random() * 3.5, -nz * v + car.vz * 0.3 + (Math.random() - 0.5) * 3,
        LUMP[kind] * (0.8 + Math.random() * 0.4), cols[(Math.random() * cols.length) | 0]);
    }
  };
  function smashStall(mk, i, nx, nz, vs, car) {
    const s = mk.S[i], x = s[0], z = s[1], r = s[2], kind = s[3], y = mk.y[i], w = mk.where[i];
    hide(w.body[0], w.body[1], x, y, z); w.body[0].instanceMatrix.needsUpdate = true;
    for (const [part, o] of [['frame', { v: 0.9 }], ['goods', { v: 1.15, up: 1.4, spin: 1.5, side: 2.5 }]]) {
      const [im, k, sp] = wreckSlot(kind, part); props.throwPiece(piece(im, k, x, y, z, r, sp), nx, nz, vs, car, o);
    }
    const [cim, ck] = w.canopy, [bim, bk] = w.bulb;   // the canopy and its bulbs come off the poles, higher and lighter than the table
    props.throwPiece(piece(cim, ck, x, y, z, r, specOf(cim, 0.3)), nx, nz, vs, car, { v: 1, up: 1.6, spin: 1.4, side: 3 });
    props.throwPiece(piece(bim, bk, x, y, z, r, specOf(bim, 0.2)), nx, nz, vs, car, { v: 1, up: 2, spin: 2, side: 4 });
    lumps(14, x, y + 0.9, z, r, 2, 0.8, nx, nz, vs, car, kind);
  }
  function smashCrates(mk, i, nx, nz, vs, car) {
    const s = mk.S[i], [px, pz] = cratePos(s), y = groundY(px, pz), [im, k] = mk.where[i].crates;
    props.throwPiece(piece(im, k, px, y, pz, s[2], specOf(im, 0.5)), nx, nz, vs, car, { v: 1, up: 1.2, spin: 1.2, side: 1.5 });
    lumps(6, px, y + 0.5, pz, s[2], 0.8, 0.4, nx, nz, vs, car, 0);
  }
  let lastShout = -9;
  function smash(e, vs, nx, nz, car) {   // n points from the wall to the lapa, vs is the lapa's speed into it
    e.gone = true; e.mk.dead[e.i] |= e.part; for (const g of e.segs) g[0] = g[1] = g[2] = g[3] = FAR[0];
    car.vx += nx * vs * LOSS; car.vz += nz * vs * LOSS; if (car.vf !== undefined) car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    (e.part === 1 ? smashStall : smashCrates)(e.mk, e.i, nx, nz, vs, car);
    if (t - lastShout > 1.2) {   // the vendor swears at you (a balloon over their head), or the stall itself does when there is nobody behind it
      const mk = e.mk, s = mk.S[e.i], v = peds && mk.ids[e.i] >= 0 && peds.info(mk.ids[e.i]); lastShout = t;
      try { dispatchEvent(new CustomEvent('pd-shout', { detail: v ? { x: v.x, y: v.y + 1.9, z: v.z, follow: () => ({ x: v.x, y: v.y + 1.9, z: v.z }) } : { x: s[0], y: mk.y[e.i] + 1.4, z: s[1] } })); } catch (err) { /* no events */ }
    }
  }
  const chain = hooks.breakFence;   // the fences' hook (src/fences.js): the lapa asks it about any wall segment that carries a piece (seg.fn)
  hooks.breakFence = (seg, vs, nx, nz, car) => {
    const e = seg.fn; if (!e || !e.mk) return chain ? chain(seg, vs, nx, nz, car) : false;
    if (e.gone || vs < e.thr) return false;
    smash(e, vs, nx, nz, car); return true;
  };

  let peds = null, tick = 0, t = 0, open = true, hour = 12;
  function vendors(mk, cx, cz) {
    const S = mk.S, near = [];
    for (let i = 0; i < mk.n; i++) { const d = Math.hypot(S[i][0] - cx, S[i][1] - cz); if (mk.ids[i] >= 0) { if (d > FAR_V || !open) { peds.remove(mk.ids[i]); mk.ids[i] = -1; } } else if (open && d < NEAR_V && !(mk.dead[i] & 1)) near.push([d, i]); }   // (no new vendor for a smashed stall; the one standing there stays until they are far)
    near.sort((a, b) => a[0] - b[0]);
    for (const [, i] of near) {
      if (vendorCount() >= MAX_V) break;
      const s = S[i], r = s[2], x = s[0] - Math.sin(r) * 0.78, z = s[1] - Math.cos(r) * 0.78;   // behind the table
      const id = peds.spawnScripted(VEND[s[3]], x, z); if (id < 0) break;
      peds.face(id, s[0] + Math.sin(r) * 3, s[1] + Math.cos(r) * 3); mk.ids[i] = id;
    }
  }
  const vendorCount = () => { let n = 0; for (const mk of markets) for (let i = 0; i < mk.n; i++) if (mk.ids[i] >= 0) n++; return n; };
  function update(dt) {
    t += dt; tick += dt; if (tick < 0.5) return; tick = 0;
    const cx = camera.position.x, cz = camera.position.z;
    if (peds && peds.night) { const nt = peds.night(); hour = nt.hour; open = hour > 6.5 && hour < 20.5; }
    const lit = open ? Math.min(1, NIGHT.win.value * 3) : 0;
    bulbMat.emissiveIntensity = 0.15 + 3.2 * lit;
    let any = false;
    for (const mk of markets) {
      const d = Math.hypot(mk.M.cx - cx, mk.M.cz - cz), near = !off && open && d < mk.M.r + SEE;
      if (near && !mk.on) { place(mk); mk.t0 = t; mk.again = false; }
      else if (near && !mk.again && t - mk.t0 > 4) { place(mk); mk.again = true; }   // once more after the ground tiles around have had a moment
      if (near !== mk.on) { for (const im of mk.meshes) im.visible = near; mk.on = near; wake(mk, near); }
      if (near) any = true;
      if (peds && (near || mk.ids.some(v => v >= 0))) vendors(mk, cx, cz);
    }
    for (const im of wreckMeshes) im.visible = any;
  }
  return { update, bindPedestrians(api) { peds = api; }, markets, stats: () => markets.map(m => ({ id: m.M.id, stalls: m.n, meshes: m.meshes.length, vendors: Array.from(m.ids).filter(v => v >= 0).length, smashed: m.dead.reduce((a, b) => a + (b & 1), 0) })) };
}
