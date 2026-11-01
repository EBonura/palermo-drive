// Tools for building the garage rooms (src/garage-scene.js lists them, src/garage-officina.js is the first). Owned by the driving work.
// A room is a handful of merged meshes with the light baked into the vertex colours (the PS2 way: no dynamic lights on the walls, so a
// phone only pays for the vehicle). Bake collects boxes, cylinders and grids, lights every vertex with the room's own function and
// merges them into one mesh per material.
import * as THREE from 'three';
import { canvasTex } from './vehicle-art.js';
export { canvasTex };
export { rng } from './core.js';

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3(), _pos = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _nm = new THREE.Matrix3();
const _c = new THREE.Color(), _l = { r: 1, g: 1, b: 1 };

export class Bake {
  // light(p, n, out): writes the light (r, g, b multipliers) arriving at point p with normal n into out
  constructor(light) { this.light = light; this.P = []; this.C = []; this.U = []; this.I = []; this.count = 0; }
  push(p, n, color, lit, u, v) {
    if (lit) this.light(p, n, _l); else { _l.r = _l.g = _l.b = 1; }
    this.P.push(p.x, p.y, p.z); this.C.push(color.r * _l.r, color.g * _l.g, color.b * _l.b); this.U.push(u, v);
    return this.count++;
  }
  // any three.js geometry, placed by at = { x, y, z, rx, ry, rz, sx, sy, sz }; lit: false for things that glow
  add(geo, color, at = {}, lit = true) {
    _e.set(at.rx || 0, at.ry || 0, at.rz || 0); _q.setFromEuler(_e);
    _m.compose(_pos.set(at.x || 0, at.y || 0, at.z || 0), _q, _s.set(at.sx ?? 1, at.sy ?? at.sx ?? 1, at.sz ?? at.sx ?? 1)); _nm.getNormalMatrix(_m);
    _c.set(color);
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ix = geo.index, base = this.count;
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i).applyMatrix4(_m); _n.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize();
      this.push(_p, _n, _c, lit, ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0);
    }
    if (ix) for (let i = 0; i < ix.count; i++) this.I.push(base + ix.getX(i));
    else for (let i = 0; i < pa.count; i++) this.I.push(base + i);
    geo.dispose();
  }
  box(color, x, y, z, w, h, d, ry = 0, lit = true, rx = 0, rz = 0) { this.add(new THREE.BoxGeometry(w, h, d), color, { x, y, z, ry, rx, rz }, lit); }
  cyl(color, x, y, z, rt, rb, h, seg = 10, lit = true, at = {}) { this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, { x, y, z, ...at }, lit); }
  sph(color, x, y, z, r, seg = 8, lit = true, at = {}) { this.add(new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)), color, { x, y, z, ...at }, lit); }
  tor(color, x, y, z, r, t, at = {}, lit = true) { this.add(new THREE.TorusGeometry(r, t, 6, 12), color, { x, y, z, ...at }, lit); }
  // a rectangle from o along du and dv (3-arrays, full edge vectors), cut into nu x nv cells so the baked light has some resolution.
  // uv: [u0, v0, u1, v1] spread over the whole rectangle, or a function (p) => [u, v]
  grid(o, du, dv, nu, nv, color = '#ffffff', uv = [0, 0, 1, 1], lit = true) {
    const nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0], nl = Math.hypot(nx, ny, nz) || 1;
    _n.set(nx / nl, ny / nl, nz / nl); _c.set(color);
    const base = this.count, f = typeof uv === 'function';
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = i / nu, b = j / nv;
      _p.set(o[0] + du[0] * a + dv[0] * b, o[1] + du[1] * a + dv[1] * b, o[2] + du[2] * a + dv[2] * b);
      const t = f ? uv(_p) : [uv[0] + (uv[2] - uv[0]) * a, uv[1] + (uv[3] - uv[1]) * b];
      this.push(_p, _n, _c, lit, t[0], t[1]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const k = base + j * (nu + 1) + i;
      this.I.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);
    }
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    const m = new THREE.Mesh(g, material); m.matrixAutoUpdate = false; m.frustumCulled = false;
    return m;
  }
  get tris() { return this.I.length / 3; }
}

// the room's surface material: unlit (the light is in the vertex colours), optionally textured
export const surface = (map, extra) => new THREE.MeshBasicMaterial({ map: map || null, vertexColors: true, ...extra });

export function disposeTree(root) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) {
      if (!m || seen.has(m)) continue; seen.add(m);
      for (const k of ['map', 'alphaMap']) if (m[k]) m[k].dispose();
      m.dispose();
    }
  });
}

// ---- small canvas helpers shared by the rooms ----
export const blot = (g, w, x, y, rx, ry, rot, fill) => {   // an ellipse, repeated across the edges of a texture that tiles in x
  for (const o of [-w, 0, w]) { g.save(); g.translate(x + o, y); g.rotate(rot); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.restore(); }
};
export const soft = (g, x, y, r, rgba0, rgba1 = 'rgba(0,0,0,0)') => {   // a soft round brush mark
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba0); gr.addColorStop(1, rgba1);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
};
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
