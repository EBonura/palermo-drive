// Geometry baker for the vehicle models (src/vehicle-models.js). Owned by the driving work.
// Builders add primitives in car-frame coordinates (origin on the ground under the middle of the vehicle, +z forward,
// +x left, y up) to named groups; every primitive is baked (transform applied) and merged into one geometry per material per
// group when the template is finished. So a vehicle is a handful of draw calls no matter how many parts it has, and the
// merged geometry is shared by every instance (the local car and all remote players with the same look).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PI = Math.PI, TAU = PI * 2;

// ---------- primitive geometries (cached, never mutated: the kit clones before baking) ----------
const gc = new Map();
const G = (k, f) => { let g = gc.get(k); if (!g) gc.set(k, g = f()); return g; };
export const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (r0, r1, h, s = 12, open = false, a0 = 0, a1 = TAU) => G(`c${r0},${r1},${h},${s},${open},${a0},${a1}`, () => new THREE.CylinderGeometry(r0, r1, h, s, 1, open, a0, a1));
// cylinder along x (wheels, axles, handlebars)
export const cylX = (r0, r1, len, s = 12, open = false, a0 = 0, a1 = TAU) => G(`cx${r0},${r1},${len},${s},${open},${a0},${a1}`, () => cyl(r0, r1, len, s, open, a0, a1).clone().rotateZ(PI / 2));
// cylinder along z (exhausts, lamps)
export const cylZ = (r0, r1, len, s = 12, open = false) => G(`cz${r0},${r1},${len},${s},${open}`, () => cyl(r0, r1, len, s, open).clone().rotateX(PI / 2));
export const sph = (r, ws = 10, hs = 8) => G(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const tor = (R, r, rs = 6, ts = 16, arc = TAU) => G(`t${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
export const plane = (w, h) => G(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));

// Hexahedron from 8 corners (bottom ring 0..3, top ring 4..7 in the same order); flat normals, outward-facing whatever the order.
export function hexa(P) {
  const c = [0, 1, 2].map(k => P.reduce((s, q) => s + q[k], 0) / 8), pos = [], nor = [], uv = [];
  for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
    let vs = f.map(i => P[i]);
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 4; i++) { const a = vs[i], b = vs[(i + 1) % 4]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    const m = vs[0];
    if (nx * (m[0] - c[0]) + ny * (m[1] - c[1]) + nz * (m[2] - c[2]) < 0) { vs = vs.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...vs[i]); nor.push(nx, ny, nz); uv.push(...uvs[i]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
// Box-like solid between a bottom rectangle r = [x0, x1, z0, z1] at y0 and a top rectangle s at y1 (hoods, cabins, cowls).
export const prism = (r, y0, s, y1) => hexa([[r[0], y0, r[2]], [r[1], y0, r[2]], [r[1], y0, r[3]], [r[0], y0, r[3]], [s[0], y1, s[2]], [s[1], y1, s[2]], [s[1], y1, s[3]], [s[0], y1, s[3]]]);

// A multi-material indexed geometry (a BoxGeometry given an array of materials) -> [[materialIndex, geometry], ...]
function sliceGroups(geo) {
  const out = [], idx = geo.index.array, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (const gr of geo.groups) {
    const n = gr.count, p = new Float32Array(n * 3), nn = new Float32Array(n * 3), u = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const k = idx[gr.start + i];
      p[i * 3] = P.getX(k); p[i * 3 + 1] = P.getY(k); p[i * 3 + 2] = P.getZ(k);
      nn[i * 3] = N.getX(k); nn[i * 3 + 1] = N.getY(k); nn[i * 3 + 2] = N.getZ(k);
      u[i * 2] = U.getX(k); u[i * 2 + 1] = U.getY(k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    out.push([gr.materialIndex, g]);
  }
  return out;
}

const _M = new THREE.Matrix4(), _T = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _D = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1), _Y = new THREE.Vector3(0, 1, 0);

// Strip stage of a material: 0 stays on a stripped vehicle (frame, wheels), 1 vanishes when the ZEN strips it (see vehicle-events.js).
export const MAT_STAGE = new Map();

export class Kit {
  // s: uniform scale applied to everything added (a smaller variant of a model)
  constructor(s = 1) { this.s = s; this.g = {}; this.wheels = []; this.spec = {}; this.anims = []; this.stage = null; }
  group(name, origin) { this.g[name] = { o: origin, b: new Map() }; return this; }
  _put(G, mat, geo, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    g.applyMatrix4(m);
    let b = G.b.get(mat); if (!b) G.b.set(mat, b = []);
    b.push(g);
  }
  // final car-frame matrix m (before the kit scale and the group origin)
  addM(name, mat, geo, m) {
    if (!this.g[name]) throw new Error('no group ' + name);
    const mm = _M.copy(m);
    if (this.s !== 1) mm.premultiply(_T.makeScale(this.s, this.s, this.s));
    const base = this.g[name], skip = name === 'sub' || name === 'cone';
    // the strip stage picks a sibling group 'name#1' (same origin) so a stripped vehicle can hide those meshes
    const grp = m2 => { const st = skip ? 0 : (this.stage != null ? this.stage : (MAT_STAGE.get(m2) || 0)); if (!st) return base; const k = name + '#' + st; return this.g[k] || (this.g[k] = { o: base.o, b: new Map() }); };
    mm.premultiply(_T.makeTranslation(-base.o[0], -base.o[1], -base.o[2]));
    if (Array.isArray(mat)) for (const [i, sub] of sliceGroups(geo)) this._put(grp(mat[i]), mat[i], sub, mm);
    else this._put(grp(mat), mat, geo, mm);
  }
  // ops bound to a group, optionally inside a parent transform (x, y, z, rx, ry, rz): a sub-assembly such as the windscreen
  on(name, px = 0, py = 0, pz = 0, prx = 0, pry = 0, prz = 0) {
    // the handlebar group is drawn in its own frame (0,0,0 = the middle of the bar, which turns with the steering): lift it onto the bar position
    // so the group origin that addM() subtracts cancels out (without this the whole bar assembly sat 1 m below the vehicle)
    if (name === 'bar' && this.g.bar && !px && !py && !pz) { const o = this.g.bar.o, k = 1 / this.s; px = o[0] * k; py = o[1] * k; pz = o[2] * k; }
    return this.onM(name, new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(prx, pry, prz)), new THREE.Vector3(1, 1, 1)));
  }
  onM(name, parent) {
    const kit = this;
    return {
      add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        const m = new THREE.Matrix4().compose(_V.set(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), _S.set(sx, sy, sz));
        kit.addM(name, mat, geo, m.premultiply(parent));
      },
      // box from a to b (w across, h the other way), e.g. a frame member or a limb
      limb(mat, a, b, w, h = w) {
        _D.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _D.length(); if (len < 1e-5) return;
        _Q.setFromUnitVectors(_Z, _D.multiplyScalar(1 / len));
        const m = new THREE.Matrix4().compose(_V.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _Q, _S.set(1, 1, 1));
        kit.addM(name, mat, box(w, h, len), m.premultiply(parent));
      },
      // cylinder from a to b (r at b, r2 at a)
      tube(mat, a, b, r, seg = 6, r2 = r) {
        _D.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _D.length(); if (len < 1e-5) return;
        _Q.setFromUnitVectors(_Y, _D.multiplyScalar(1 / len));
        const m = new THREE.Matrix4().compose(_V.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _Q, _S.set(1, 1, 1));
        kit.addM(name, mat, cyl(r, r2, len, seg), m.premultiply(parent));
      },
      child(x, y, z, rx = 0, ry = 0, rz = 0) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
        return kit.onM(name, m.premultiply(parent));
      },
    };
  }
  // An animated limb (a horse's leg, tail, head): its own group pivoting at origin. a = { mode: 'rot' | 'bob', amp, phase, bias, freq, axis }.
  anim(name, origin, a) {
    const o = [origin[0] * this.s, origin[1] * this.s, origin[2] * this.s];
    this.group('a:' + name, o); this.anims.push({ name, origin: o, ...a });
    return this.on('a:' + name, origin[0], origin[1], origin[2]);
  }
  // A wheel: a pivot group (steering, fork, fender), a spin group (tyre, rim) and a spinner group (free-spinning rim blades).
  wheel(x, y, z, r, w, front) {
    const i = this.wheels.length, s = this.s, c = [x * s, y * s, z * s];
    this.group('w' + i, c).group('w' + i + 's', c).group('w' + i + 'x', c);
    this.wheels.push({ x: c[0], y: c[1], z: c[2], r: r * s, w: w * s, front: !!front });
    // coordinates for these groups are given in the wheel's own frame, (0,0,0) = the axle
    const local = n => this.on(n, x, y, z);
    return { i, p: local('w' + i), s: local('w' + i + 's'), x: local('w' + i + 'x'), r, w, front: !!front, cx: x, cy: y, cz: z };
  }
  // merged result: { name: [{ mat, geom, shadow }] }
  finish() {
    const out = {};
    for (const name in this.g) {
      const list = [];
      for (const [mat, geoms] of this.g[name].b) {
        const geom = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
        if (geom) list.push({ mat, geom, shadow: !mat.transparent && !(mat.userData && mat.userData.noShadow) });
        for (const g of geoms) if (g !== geom) g.dispose();
      }
      out[name] = list;
    }
    return out;
  }
}
