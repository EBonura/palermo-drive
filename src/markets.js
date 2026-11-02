// The three street markets (Ballaro, the Vucciria around Piazza Caracciolo and Garraffello, the Capo along Via Sant'Agostino) as living markets: lines of stalls
// along the real streets (src/markets-data.js, laid out by tools/make_markets.py from the baked tiles), each with a striped awning or a tarp on poles, crates of
// fruit, vegetables, fish on ice, hams and cheeses, sacks of olives and spices, a few strings of bulbs, and the vendors standing behind the tables (the crowd's own
// vendor sprites, scripted so they stay put). The stalls are solid for the lapa (a box each), packed away at night (the Vucciria's evening crowd is the movida,
// src/pedestrians.js), and cost a few instanced meshes per market: everything is vertex-coloured low poly, one InstancedMesh per model and market, switched off
// when the market is far away. Numbers are in docs/PERF.md (markets).
import * as THREE from 'three';
import { MARKETS } from './markets-data.js';
import { NIGHT } from './daynight.js';

const C = h => new THREE.Color(h), WHITE = C('#ffffff');

// ------------------------------------------------------------------ geometry builder (convex solids wind away from their centre)
class G {
  constructor() { this.p = []; this.c = []; }
  v(a, col, k) { this.p.push(a[0], a[1], a[2]); this.c.push(col.r * k, col.g * k, col.b * k); }
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
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeVertexNormals();
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
function fruit() {
  const g = new G(); base(g);
  const cols = ['#e8841a', '#e8d02a', '#c8301c', '#6e9a3a', '#e8a060', '#d8561c'];
  let i = 0; for (const z of [-0.16, 0.2]) for (const x of [-0.7, 0, 0.7]) { crate(g, x, z); g.heap(x - 0.27, z - 0.19, x + 0.27, z + 0.19, 0.92, 1.06, C(cols[i++ % 6]), 0.85); }
  g.box(-0.9, 0, -0.95, -0.45, 0.28, -0.6, WOOD); g.box(-0.9, 0.28, -0.95, -0.45, 0.56, -0.6, WOODD);   // empty crates stacked behind
  return g.geo();
}
function veg() {
  const g = new G(); base(g);
  const cols = ['#4f8a2c', '#8ab030', '#b82a1c', '#4a2060', '#e07818', '#6a8a4a', '#9a3a18', '#3e7a3c'];
  let i = 0; for (const z of [-0.16, 0.2]) for (const x of [-0.7, 0, 0.7]) { crate(g, x, z); g.heap(x - 0.27, z - 0.19, x + 0.27, z + 0.19, 0.92, 1.08, C(cols[(i++ * 3) % 8]), 0.9); }
  g.box(0.5, 0, -0.95, 0.95, 0.3, -0.55, WOOD); g.heap(0.52, -0.93, 0.93, -0.57, 0.3, 0.46, C('#6a8a4a'), 0.8);
  return g.geo();
}
function fish() {
  const g = new G(); base(g, C('#c8ccd0'));
  g.box(-0.95, 0.8, -0.38, 0.95, 0.9, 0.38, C('#dfe9ee'));                       // the ice tray
  g.heap(-0.93, -0.36, 0.93, 0.36, 0.9, 0.97, C('#f4f8fa'), 0.96);              // crushed ice
  const body = ['#b8c4cc', '#6c8ca8', '#d8604a', '#e8a8a0', '#8aa0b0', '#c8d4da'];
  let i = 0;
  for (const z of [-0.2, 0.05, 0.28]) for (let k = 0; k < 4; k++) {   // fish lying across the ice, each a tapered flat box
    const x = -0.8 + k * 0.5 + (z === 0.05 ? 0.2 : 0), c = C(body[i++ % 6]);
    g.heap(x - 0.2, z - 0.06, x + 0.2, z + 0.06, 0.96, 1.04, c, 0.6); g.box(x + 0.2, 0.97, z - 0.03, x + 0.27, 1.02, z + 0.03, c);
  }
  g.heap(-0.4, -0.34, 0.5, -0.04, 0.97, 1.1, C('#5a6a78'), 0.45);                 // the swordfish steak head, with its sword
  g.box(0.5, 1.02, -0.2, 1.05, 1.05, -0.17, C('#5a6a78'));
  g.box(-1.0, 0.8, 0.42, 1.0, 0.86, 0.5, C('#9aa4aa'));                            // the metal lip at the front
  return g.geo();
}
function meat() {
  const g = new G(); base(g, CLOTH);
  g.box(-1.12, 1.98, 0.5, 1.12, 2.02, 0.56, POLE);                                 // the hook bar under the canopy
  const hang = ['#8a3a2c', '#c46a58', '#7a2c24', '#b85a48', '#9a4a38', '#d8b0a0'];
  for (let k = 0; k < 6; k++) { const x = -0.95 + k * 0.38, len = 0.4 + (k % 3) * 0.12; g.heap(x - 0.07, 0.46, x + 0.07, 0.6, 1.98 - len, 1.98, C(hang[k]), 0.5); }
  g.box(-0.9, 0.8, -0.3, -0.1, 0.86, 0.3, C('#b83030')); g.heap(-0.88, -0.28, -0.12, 0.28, 0.86, 0.94, C('#c85048'), 0.85);   // a tray of cuts
  for (const x of [0.2, 0.55, 0.85]) g.heap(x - 0.14, -0.14, x + 0.14, 0.14, 0.8, 0.95, C('#e6c866'), 0.9);                      // wheels of cheese
  return g.geo();
}
function misc() {
  const g = new G(); base(g, C('#8b7455'));
  const heaps = ['#c8601c', '#e8c030', '#8a3820', '#5a6a2c', '#2a2220', '#c8b078'];
  let i = 0; for (const x of [-0.75, -0.25, 0.25, 0.75]) { g.box(x - 0.2, 0.8, -0.3, x + 0.2, 0.9, 0.3, C('#e8e4d8')); g.heap(x - 0.19, -0.29, x + 0.19, 0.29, 0.9, 1.04, C(heaps[i++ % 6]), 0.9); }
  for (const [x, c] of [[-0.55, '#c8b078'], [0, '#b8a068'], [0.55, '#d0bc84']]) { g.heap(x - 0.25, -0.95, x + 0.25, -0.55, 0, 0.55, C(c), 0.7); }   // sacks standing behind
  g.box(-1.05, 0, 0.5, -0.62, 0.35, 0.8, WOOD); g.heap(-1.03, 0.52, -0.64, 0.78, 0.35, 0.5, C('#5a6a2c'), 0.85);                    // a tub of olives on the ground
  return g.geo();
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

export function createMarkets(env) {
  const { scene, camera, groundY, walls2d } = env;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const matD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: C('#ffcf70'), emissiveIntensity: 0.15 });
  const geos = { fruit: fruit(), veg: veg(), fish: fish(), meat: meat(), misc: misc(), tarp: tarp(), bulbs: bulbs(), crates: crates(), aw: AW.map((_, i) => awning(i)) };
  const bodyGeo = [geos.fruit, geos.veg, geos.fish, geos.meat, geos.misc];
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3(), col = new THREE.Color();
  const q = new URLSearchParams(location.search);
  const off = q.get('markets') === '0';

  const markets = MARKETS.map(M => {
    const n = M.s.length, S = M.s;
    // which stalls go to which mesh
    const byBody = [[], [], [], [], []], byAw = [[], [], [], []], tarps = [], cr = [];
    S.forEach((s, i) => { byBody[s[3]].push(i); if (s[4] < 4) byAw[s[4]].push(i); else tarps.push(i); if (s[5]) cr.push(i); });
    const meshes = [];
    const mk = (geo, list, material, tint, shadow = true) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, material, list.length); im.matrixAutoUpdate = false; im.castShadow = shadow; im.receiveShadow = true; im.visible = false;
      if (tint) for (let k = 0; k < list.length; k++) im.setColorAt(k, TARP_TINT[S[list[k]][4] - 4]);
      im.userData.list = list; im.userData.noShadowFar = true; scene.add(im); meshes.push(im); return im;
    };
    const parts = [];
    byBody.forEach((l, k) => { const im = mk(bodyGeo[k], l, mat, false, false); if (im) parts.push(im); });   // the tables cast no shadow (the canopies do): the shadow pass is the expensive one
    byAw.forEach((l, k) => { const im = mk(geos.aw[k], l, matD, false); if (im) parts.push(im); });
    { const im = mk(geos.tarp, tarps, matD, true); if (im) parts.push(im); }
    { const im = mk(geos.crates, cr, mat, false, false); if (im) parts.push(im); }
    const bulb = mk(geos.bulbs, S.map((_, i) => i), bulbMat, false, false);
    // collision: a box each, in the lapa's wall grid (static, like the carretto)
    for (const s of S) {
      const [x, z, r] = s, sn = Math.sin(r), cs = Math.cos(r), fw = [sn, cs], rt = [cs, -sn];
      const c = (u, v) => [x + rt[0] * u + fw[0] * v, z + rt[1] * u + fw[1] * v];
      const k = [c(-1.1, -0.45), c(1.1, -0.45), c(1.1, 0.45), c(-1.1, 0.45)];
      for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
    }
    return { M, n, S, parts, bulb, meshes, on: false, y: new Float32Array(n), ids: new Int32Array(n).fill(-1), t0: 0, again: false };
  });
  const place = (mk) => {   // matrices from the stalls' ground heights (re-done when the market comes into range, the tiles' fine heights may arrive a moment later)
    for (const im of mk.meshes) {
      const list = im.userData.list, isCr = im.geometry === geos.crates;
      for (let k = 0; k < list.length; k++) {
        const s = mk.S[list[k]], x = s[0], z = s[1], r = s[2], y = groundY(x, z); mk.y[list[k]] = y;
        let px = x, pz = z; if (isCr) { px = x + Math.cos(r) * 1.55 + Math.sin(r) * 0.55; pz = z - Math.sin(r) * 1.55 + Math.cos(r) * 0.55; }   // beside the stall, a little to its front
        im.setMatrixAt(k, m4.compose(p3.set(px, isCr ? groundY(px, pz) : y, pz), q4.setFromAxisAngle(up, r), s1));
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
    }
  };
  let peds = null, tick = 0, t = 0, open = true, hour = 12;
  function vendors(mk, cx, cz) {
    const S = mk.S, near = [];
    for (let i = 0; i < mk.n; i++) { const d = Math.hypot(S[i][0] - cx, S[i][1] - cz); if (mk.ids[i] >= 0) { if (d > FAR_V || !open) { peds.remove(mk.ids[i]); mk.ids[i] = -1; } } else if (open && d < NEAR_V) near.push([d, i]); }
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
    for (const mk of markets) {
      const d = Math.hypot(mk.M.cx - cx, mk.M.cz - cz), near = !off && open && d < mk.M.r + SEE;
      if (near && !mk.on) { place(mk); mk.t0 = t; mk.again = false; }
      else if (near && !mk.again && t - mk.t0 > 4) { place(mk); mk.again = true; }   // once more after the ground tiles around have had a moment
      if (near !== mk.on) { for (const im of mk.meshes) im.visible = near; mk.on = near; }
      if (peds && (near || mk.ids.some(v => v >= 0))) vendors(mk, cx, cz);
    }
  }
  return { update, bindPedestrians(api) { peds = api; }, markets, stats: () => markets.map(m => ({ id: m.M.id, stalls: m.n, meshes: m.meshes.length, vendors: Array.from(m.ids).filter(v => v >= 0).length })) };
}
