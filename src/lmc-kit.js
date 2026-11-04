// Toolkit shared by the city landmark models (src/landmarks-city*.js, src/lmc-*.js). Owned by the city landmarks work.
// Same approach as src/landmarks.js: geometry is collected into one bin per material, merged and returned as a Group.
// Textures are painted on canvases once (lazily, on first use) and shared by every model and every tile rebuild;
// only geometry is created per build (world.js disposes geometry with the tile).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY, rng, freeCanvas, weld } from './core.js';

export { groundY };
export const PI = Math.PI;
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ====================================================================================================
// material registry and part collector
// ====================================================================================================
const DEFS = {};   // key -> { w, h, texM, paint, opts }
const CACHE = {};  // key -> THREE.MeshStandardMaterial
let BINS = {}, TRIS = 0, BASEY = 0;

export function defMat(key, w, h, texM, paint, opts = {}) { if (!DEFS[key]) DEFS[key] = { w, h, texM, paint, opts }; }
function getMat(key) {
  if (CACHE[key]) return CACHE[key];
  const d = DEFS[key]; let map = null;
  if (d.paint) {
    const cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h;
    d.paint(cv.getContext('2d'), d.w, d.h);
    map = freeCanvas(new THREE.CanvasTexture(cv), d.paint); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  }
  const { noShadow, ...mo } = d.opts;
  return CACHE[key] = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, metalness: 0, ...mo });
}
export function begin(baseY = 0) { BINS = {}; TRIS = 0; BASEY = baseY; }
export function setBase(y) { BASEY = y; }
export function end(name) {
  const g = new THREE.Group(); g.name = name;
  for (const k in BINS) {
    if (!BINS[k].length) continue;
    const merged = mergeGeometries(BINS[k], false);
    const mesh = new THREE.Mesh(merged, getMat(k));
    mesh.castShadow = !DEFS[k].opts.noShadow; mesh.receiveShadow = true; mesh.name = name + ':' + k;
    weld(merged);
    g.add(mesh);
  }
  g.userData.tris = Math.round(TRIS);
  BINS = {};
  return g;
}

const UB = new THREE.BoxGeometry(1, 1, 1); UB.translate(0, 0.5, 0);   // base-centred unit box
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

// o: p [x,y,z], ry/rx/rz (YXZ), s [sx,sy,sz], M parent matrix, c tint, uv 'world' | 'keep' (uvk, uvo), noao
export function part(key, g0, o = {}) {
  if (!DEFS[key]) throw new Error('no material ' + key);
  const bin = BINS[key] || (BINS[key] = []);
  const g = g0.index ? g0.toNonIndexed() : g0.clone();
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
  _m.compose(V3(o.p || [0, 0, 0]), _q, V3(o.s || [1, 1, 1]));
  if (o.M) _m.premultiply(o.M);
  g.applyMatrix4(_m);
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const tm = DEFS[key].texM;
  _c.set(o.c || '#ffffff');
  const keep = o.uv === 'keep', uk = o.uvk || [1, 1], uo = o.uvo || [0, 0];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (keep) { uv[i * 2] = g.attributes.uv.getX(i) * uk[0] + uo[0]; uv[i * 2 + 1] = g.attributes.uv.getY(i) * uk[1] + uo[1]; }
    else {
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      if (Math.abs(ny) > 0.6) { uv[i * 2] = x / tm[0]; uv[i * 2 + 1] = z / tm[1]; }
      else { uv[i * 2] = (x * nz - z * nx) / tm[0]; uv[i * 2 + 1] = y / tm[1]; }
      uv[i * 2] += uo[0]; uv[i * 2 + 1] += uo[1];
    }
    const ao = o.noao ? 1 : 0.74 + 0.26 * Math.min(1, Math.max(0, (y - BASEY) / 5));
    col[i * 3] = _c.r * ao; col[i * 3 + 1] = _c.g * ao; col[i * 3 + 2] = _c.b * ao;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv1');
  bin.push(g);
  TRIS += n / 3;
}

// ---------- primitives ----------
export const box = (key, sx, sy, sz, o = {}) => part(key, UB, { ...o, s: [sx, sy, sz] });
// axis-aligned box in the frame M, from (x0,y0,z0) to (x1,y1,z1)
export const bx = (key, M, x0, x1, y0, y1, z0, z1, o = {}) => box(key, x1 - x0, y1 - y0, z1 - z0, { M, p: [(x0 + x1) / 2, y0, (z0 + z1) / 2], ...o });
export function cyl(key, rt, rb, h, seg, o = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open, o.t0 || 0, o.tl || 2 * PI); g.translate(0, h / 2, 0);
  const tm = DEFS[key].texM;
  part(key, g, { uv: 'keep', uvk: [(o.tl || 2 * PI) * Math.max(rt, rb) / tm[0], h / tm[1]], ...o });
}
export function lathe(key, prof, seg, o = {}) {
  part(key, new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), seg, o.t0 || 0, o.tl || 2 * PI), o);
}
export function sphere(key, r, o = {}) {
  const g = geo('sph' + (o.seg || 8), () => new THREE.SphereGeometry(1, o.seg || 8, Math.max(4, (o.seg || 8) >> 1)));
  part(key, g, { ...o, s: [r, r * (o.ky || 1), r * (o.kz || 1)] });
}
export function cone(key, r, h, seg, o = {}) {
  const g = new THREE.ConeGeometry(r, h, seg, 1); g.translate(0, h / 2, 0);
  part(key, g, o);
}
// flat panel on its base-centre, facing +z, w x h metres; texture region via uvk/uvo (default the whole canvas)
export function panel(key, w, h, o = {}) {
  const g = geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; });
  part(key, g, { ...o, s: [w, h, 1], uv: 'keep', noao: o.noao !== false });
}
export function extrude(key, shape, depth, o = {}) {
  part(key, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: o.cs || 8 }), o);
}
// vertical wall bay: a rectangle W x H with an optional arched opening (width ow, springing at oy0, top at oh) cut out, extruded to depth d (along +z, starting at z=0)
export function archBay(key, W, H, ow, oh, d, o = {}) {
  const s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
  if (ow > 0) {
    const r = ow / 2, y0 = o.oy0 || 0, h = Math.max(oh, r + y0 + 0.1), p = new THREE.Path();
    p.moveTo(-r, y0); p.lineTo(-r, h - r);
    if (o.pointed) { p.quadraticCurveTo(-r, h - r + r * 0.75, 0, h + r * 0.45); p.quadraticCurveTo(r, h - r + r * 0.75, r, h - r); } else p.absarc(0, h - r, r, PI, 0, true);
    p.lineTo(r, y0); p.lineTo(-r, y0);
    s.holes.push(p);
  }
  extrude(key, s, d, o);
}
export const archShape = (w, h, shape = new THREE.Shape()) => {
  const r = w / 2; shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, h - r); shape.absarc(0, h - r, r, 0, PI, false); shape.lineTo(-r, 0); return shape;
};
export function rectShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0); return s; }
// polygon (array of [x,z]) extruded upward from y0 to y1 (walls and flat top); winding independent
export function prism(key, pts, y0, y1, o = {}) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  for (const h of o.holes || []) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1]))));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-PI / 2); g.translate(0, y0, 0); // shape y = -z; extrusion +z becomes up
  part(key, g, { ...o, holes: undefined });
}
// pyramid roof on a w x d base (base-centred at p)
export function pyramid(key, w, d, h, o = {}) {
  const g = geo('pyr', () => { const c = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); c.rotateY(PI / 4); c.translate(0, 0.5, 0); return c; });
  part(key, g, { ...o, s: [w, h, d] });
}
// gable roof: two slabs (roofKey) plus the end triangles (wallKey), ridge along local z, base centred at the origin of M at height y
export function gable(roofKey, wallKey, M, w, d, y, rise, o = {}) {
  const ov = o.ov === undefined ? 0.5 : o.ov, run = w / 2 + ov, len = Math.hypot(run, rise), ang = Math.atan2(rise, run), th = o.th || 0.25;
  for (const sg of [-1, 1]) box(roofKey, len, th, d + ov * 2, { M, p: [sg * run / 2 + 0, y + rise / 2, -d / 2 * 0], rz: -sg * ang, c: o.c, noao: true, uv: 'world' });
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, rise); sh.lineTo(-w / 2, 0);
  for (const zz of [-d / 2, d / 2 - 0.3]) extrude(wallKey, sh, 0.3, { M, p: [0, y, zz], c: o.wc });
}


// Quad grid: P is rows (i) of points (j) [x,y,z]; each cell (i,j)-(i+1,j+1) becomes two flat-shaded triangles.
// o.wrap closes the j direction, o.flip reverses the winding, o.skip(i, j, a, b, c, d) drops a cell, uvf(i, j, p) -> [u, v].
export function gridMesh(key, P, uvf, o = {}) {
  const R = P.length, C = P[0].length, nc = o.wrap ? C : C - 1, pos = [], nor = [], uv = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  const tri = (p, q, r, up, uq, ur) => {
    A.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]); B.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]); N.crossVectors(A, B).normalize();
    for (const [pp, uu] of [[p, up], [q, uq], [r, ur]]) { pos.push(pp[0], pp[1], pp[2]); nor.push(N.x, N.y, N.z); uv.push(uu[0], uu[1]); }
  };
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < nc; j++) {
    const j1 = (j + 1) % C, a = P[i][j], b = P[i][j1], c = P[i + 1][j1], d = P[i + 1][j];
    if (o.skip && o.skip(i, j, a, b, c, d)) continue;
    const ua = uvf(i, j, a), ub = uvf(i, j + 1, b), uc = uvf(i + 1, j + 1, c), ud = uvf(i + 1, j, d);
    if (o.flip) { tri(a, c, b, ua, uc, ub); tri(a, d, c, ua, ud, uc); } else { tri(a, b, c, ua, ub, uc); tri(a, c, d, ua, uc, ud); }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  part(key, g, { uv: 'keep', ...o, skip: undefined });
}


// Rocky outcrop: a jittered frustum hanging below y=0 of the frame M (top ellipse rx x rz, widening by `spread` at depth `depth`).
// Used for cliff footings under buildings on hillsides; flat-shaded, textured with the (rock-like) material `key`.
export function crag(key, M, rx, rz, depth, o = {}) {
  const seg = o.seg || 14, rows = o.rows || 4, spread = o.spread || 1.5, seed = o.seed || 1, jit = o.jit === undefined ? 0.14 : o.jit;
  const g = new THREE.CylinderGeometry(1, 1, 1, seg, rows, !o.cap), pos = g.attributes.position;   // o.cap closes the ends (a free-standing rock, seen from above too)
  for (let i = 0; i < pos.count; i++) {
    const y = 0.5 - pos.getY(i), a = Math.atan2(pos.getZ(i), pos.getX(i)), f = 1 + (spread - 1) * y;   // y: 0 at the top ring, 1 at the bottom
    const hubC = Math.hypot(pos.getX(i), pos.getZ(i)) < 1e-4;   // the centre of an end cap stays on the axis
    const n = hubC ? 1 : 1 + jit * (Math.sin(a * 3 + y * 5.1 + seed) * 0.6 + Math.sin(a * 7 + y * 2.3 + seed * 2.1) * 0.4) * Math.min(1, y * 3) + (o.rough || 0) * (Math.sin(a * 11 + y * 17 + seed * 3.7) * 0.5 + Math.sin(a * 5 - y * 9 + seed) * 0.5);
    pos.setXYZ(i, hubC ? 0 : Math.cos(a) * rx * f * n, (pos.getY(i) - 0.5) * depth, hubC ? 0 : Math.sin(a) * rz * f * n);
  }
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const tm = DEFS[key].texM;
  part(key, ng, { M, uv: 'keep', uvk: [PI * (rx + rz) * (1 + spread) / 2 / tm[0], depth / tm[1]], c: o.c, noao: o.noao });
}

// ---------- frames ----------
export const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
export const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
export const rotY = (a) => new THREE.Matrix4().makeRotationY(a);
// origin (x,y,z); local +z points along (nx,nz), local +x is to the right when looking at the front from outside (towards -z)
export function frame(x, y, z, nx, nz) { const m = new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)); m.setPosition(x, y, z); return m; }

// ====================================================================================================
// footprints
// ====================================================================================================
export const pairsOf = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };
export const centroid = (pts) => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };
// minimum-area bounding rectangle: { cx, cz, ux, uz (long axis unit vector), w (along u), d (along v), vx, vz }
export function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const p of pts) { const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) best = { A, c, s, u0, u1, v0, v1 };
  }
  let { c, s, u0, u1, v0, v1 } = best, w = u1 - u0, d = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  let ux = c, uz = s;
  if (d > w) { [w, d] = [d, w]; ux = -s; uz = c; }  // make u the long axis
  return { cx: cu * c - cv * s, cz: cu * s + cv * c, ux, uz, vx: -uz, vz: ux, w, d };
}
// a frame for a footprint: front normal chosen from the box axes closest to (hx, hz); returns { M, nx, nz, w (across the front), d (depth), cx, cz }
export function facing(ob, hx, hz) {
  let best = null;
  for (const [nx, nz, w, d] of [[ob.ux, ob.uz, ob.d, ob.w], [-ob.ux, -ob.uz, ob.d, ob.w], [ob.vx, ob.vz, ob.w, ob.d], [-ob.vx, -ob.vz, ob.w, ob.d]]) {
    const dot = nx * hx + nz * hz; if (!best || dot > best.dot) best = { nx, nz, w, d, dot };
  }
  return best;
}
export const gAt = (x, z) => groundY(x, z);
export function groundRange(pts) { let lo = 1e9, hi = -1e9, sum = 0; for (const p of pts) { const y = groundY(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; } return { lo, hi, avg: sum / pts.length }; }
// footprint corners of a w x d box in the frame at (cx,cz) facing (nx,nz)
export function boxPts(cx, cz, nx, nz, w, d, dz = 0) {
  const rx = nz, rz = -nx, o = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) o.push([cx + rx * a * w / 2 + nx * (b * d / 2 + dz), cz + rz * a * w / 2 + nz * (b * d / 2 + dz)]);
  return o;
}
// wall collision segments [x0,z0,x1,z1] for a polygon ring (closed)
export const ringSegs = (pts, skip) => { const o = []; for (let i = 0; i < pts.length; i++) { if (skip && skip(i)) continue; const a = pts[i], b = pts[(i + 1) % pts.length]; o.push([a[0], a[1], b[0], b[1]]); } return o; };

// ====================================================================================================
// painters
// ====================================================================================================
export const RNG = (seed) => rng(seed);
export function noiseDots(g, w, h, n, r, seed, cols) {
  const r_ = rng(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(i % cols.length)]; const s = r * (0.4 + r_()); g.fillRect(r_() * w, r_() * h, s, s); }
}
export function streaks(g, w, h, n, seed, alpha, len, col = '30,22,14') {
  const r_ = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r_() * w, y = r_() * h, l = len * (0.4 + r_()), ww = 1 + r_() * 4;
    const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(${col},${alpha})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x, y, ww, l);
  }
}
const shade = (hex, k) => { _c.set(hex); return '#' + new THREE.Color(Math.min(1, _c.r * k), Math.min(1, _c.g * k), Math.min(1, _c.b * k)).getHexString(); };
// ashlar blocks; the canvas covers tw x th metres
export function paintAshlar(g, w, h, tw, th, course, block, base, joint, seed, jointW = 2, vary = 0.07) {
  const r_ = rng(seed), pm = w / tw, rows = Math.max(1, Math.round(th / course));
  g.fillStyle = joint; g.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    const y0 = j * course * (h / th), hh = course * (h / th);
    let x = -r_() * block * pm;
    while (x < w) {
      const bw = block * pm * (0.7 + r_() * 0.6), k = 1 + (r_() - 0.5) * 2 * vary;
      g.fillStyle = shade(base, k); g.fillRect(x + jointW / 2, y0 + jointW / 2, bw - jointW, hh - jointW);
      x += bw;
    }
  }
  noiseDots(g, w, h, w * h / 140, 1.6, seed + 7, ['rgba(60,45,30,0.10)', 'rgba(255,240,210,0.07)']);
}

// Facade painter. The canvas covers Wm x Hm metres (x from the left edge, y up from the base).
// c: base, ashlar {base,joint,course,block,seed}, trim, glass, shut, bands [{y,h,c}], plinth {h,c}, pil {xs,w,c},
//    rows [{y0,y1,xs|n,m(margin),w,kind:'rect'|'arch'|'point'|'oculus'|'door',ped,sill,shut,glass}], grime, seed
export function paintFacade(g, W, H, Wm, Hm, c) {
  const sx = W / Wm, sy = H / Hm, X = (s) => s * sx, Y = (y) => H - y * sy, r_ = rng(c.seed || 7);
  g.fillStyle = c.base || '#d8c9a8'; g.fillRect(0, 0, W, H);
  if (c.ashlar) { const a = c.ashlar; paintAshlar(g, W, H, Wm, Hm, a.course || 0.45, a.block || 1, a.base, a.joint, a.seed || 3, a.jw || 2, a.vary || 0.06); }
  else noiseDots(g, W, H, W * H / 90, 2, (c.seed || 7) + 1, ['rgba(110,85,55,0.07)', 'rgba(255,255,255,0.07)']);
  if (c.plinth) { g.fillStyle = c.plinth.c; g.fillRect(0, Y(c.plinth.h), W, c.plinth.h * sy); }
  for (const b of c.bands || []) { g.fillStyle = b.c; g.fillRect(0, Y(b.y + b.h), W, b.h * sy); g.fillStyle = 'rgba(30,20,10,0.25)'; g.fillRect(0, Y(b.y), W, 1.5); }
  if (c.pil) for (const x of c.pil.xs) { g.fillStyle = c.pil.c; g.fillRect(X(x - c.pil.w / 2), 0, c.pil.w * sx, H); g.fillStyle = 'rgba(30,20,10,0.18)'; g.fillRect(X(x + c.pil.w / 2), 0, 1.5, H); }
  const win = (cx, y0, y1, w, kind, row) => {
    const fr = row.fr === undefined ? 0.16 : row.fr, glass = row.glass || c.glass || '#2b3342', trim = row.trim || c.trim || '#e8dcc0';
    const left = cx - w / 2, hh = y1 - y0;
    const path = (ex) => {
      const l = left - ex, rr = left + w + ex, t = y1 + ex, b = y0 - ex;
      g.beginPath(); g.moveTo(X(l), Y(b));
      if (kind === 'arch' || kind === 'point') {
        const rad = (w / 2 + ex);
        g.lineTo(X(l), Y(t - rad));
        if (kind === 'arch') g.arc(X(cx), Y(t - rad), rad * sx, PI, 0); else { g.quadraticCurveTo(X(l), Y(t - rad * 0.3), X(cx), Y(t + rad * 0.25)); g.quadraticCurveTo(X(rr), Y(t - rad * 0.3), X(rr), Y(t - rad)); }
        g.lineTo(X(rr), Y(b));
      } else if (kind === 'oculus') { g.arc(X(cx), Y((y0 + y1) / 2), (w / 2 + ex) * sx, 0, 2 * PI); }
      else { g.lineTo(X(l), Y(t)); g.lineTo(X(rr), Y(t)); g.lineTo(X(rr), Y(b)); }
      g.closePath();
    };
    if (row.ped && kind === 'rect') { g.fillStyle = trim; g.beginPath(); g.moveTo(X(left - fr - 0.15), Y(y1 + fr)); g.lineTo(X(cx), Y(y1 + fr + 0.55)); g.lineTo(X(left + w + fr + 0.15), Y(y1 + fr)); g.fill(); }
    if (fr > 0) { path(fr); g.fillStyle = trim; g.fill(); }
    path(0); g.fillStyle = glass; g.fill();
    g.save(); path(0); g.clip();
    const gr = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gr.addColorStop(0, 'rgba(160,185,210,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(X(left), Y(y1 + 1), w * sx, (hh + 1) * sy);
    if (row.shut === 'open' || (row.shut && c.shut)) { g.fillStyle = c.shut || '#4c5c51'; g.fillRect(X(left), Y(y1), w * sx * 0.5, hh * sy); g.fillRect(X(cx), Y(y1), w * sx * 0.5, hh * sy); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let yy = y0; yy < y1; yy += 0.12) g.fillRect(X(left), Y(yy), w * sx, 1); }
    else if (kind !== 'oculus') { g.fillStyle = 'rgba(15,12,10,0.7)'; g.fillRect(X(cx) - 1, Y(y1), 2, hh * sy); g.fillRect(X(left), Y(y0 + hh * 0.62), w * sx, 2); }
    g.restore();
    if (row.sill !== false && kind !== 'oculus') { g.fillStyle = trim; g.fillRect(X(left - 0.12), Y(y0), (w + 0.24) * sx, 0.14 * sy); }
    if (row.balc) { g.fillStyle = '#2a2a30'; g.fillRect(X(left - 0.3), Y(y0 + 0.95), (w + 0.6) * sx, 2); for (let k = 0; k <= 8; k++) g.fillRect(X(left - 0.3 + k * (w + 0.6) / 8), Y(y0 + 0.95), 1.5, 0.95 * sy); g.fillRect(X(left - 0.4), Y(y0), (w + 0.8) * sx, 0.12 * sy); }
  };
  for (const row of c.rows || []) {
    let xs = row.xs;
    if (!xs) { xs = []; const m = row.m === undefined ? 0.8 : row.m, n = row.n; for (let i = 0; i < n; i++) xs.push(n === 1 ? Wm / 2 : m + (Wm - 2 * m) * i / (n - 1)); }
    for (const x of xs) {
      if (row.kind === 'door') {
        const w = row.w, h = row.y1 - row.y0; g.fillStyle = c.trim || '#e8dcc0'; g.fillRect(X(x - w / 2 - 0.2), Y(row.y1 + 0.2), (w + 0.4) * sx, (h + 0.2) * sy);
        g.fillStyle = row.glass || '#1e1a18'; g.beginPath(); g.moveTo(X(x - w / 2), Y(row.y0)); g.lineTo(X(x - w / 2), Y(row.y1 - w / 2)); g.arc(X(x), Y(row.y1 - w / 2), w / 2 * sx, PI, 0); g.lineTo(X(x + w / 2), Y(row.y0)); g.fill();
      } else win(x, row.y0, row.y1, row.w, row.kind || 'rect', row);
    }
  }
  if (c.grime !== 0) {
    streaks(g, W, H, 30, (c.seed || 7) + 2, 0.10, 90);
    const gb = g.createLinearGradient(0, H, 0, H - 3 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.32)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, H - 3 * sy, W, 3 * sy);
  }
}

// ====================================================================================================
// shared materials (defined once)
// ====================================================================================================
let SHARED = false;
export function initShared() {
  if (SHARED) return; SHARED = true;
  defMat('tufa', 256, 256, [3.3, 3.3], (g, w, h) => paintAshlar(g, w, h, 3.3, 3.3, 0.55, 1.2, '#e6d7ae', '#b9a780', 311, 1.2, 0.05));
  defMat('stone', 256, 256, [3.2, 3.2], (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.45, 1.0, '#a29a8c', '#6d665a', 312, 1.5, 0.09));
  defMat('plaster', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#e6dac8'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 400, 2.5, 321, ['rgba(120,90,60,0.08)', 'rgba(255,255,255,0.10)']); streaks(g, w, h, 14, 322, 0.07, 60); });
  defMat('marble', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#e4e0d4'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2.2, 331, ['rgba(110,105,95,0.09)', 'rgba(255,255,250,0.12)']); });
  defMat('tile', 128, 128, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#c4714c'; g.fillRect(0, 0, w, h); const r_ = rng(351); for (let y = 0; y < h; y += 8) { for (let x = 0; x < w; x += 8) { g.fillStyle = `hsl(${14 + r_() * 8},${34 + r_() * 10}%,${46 + r_() * 12}%)`; g.fillRect(x, y, 7, 7); } g.fillStyle = 'rgba(60,25,15,.45)'; g.fillRect(0, y + 7, w, 1); } });
  defMat('lead', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#a9aca4'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2.5, 341, ['rgba(60,70,60,0.12)', 'rgba(255,255,245,0.08)']); g.fillStyle = 'rgba(70,80,72,0.22)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1.5, h); });
  defMat('red', 128, 128, [2.5, 2.5], (g, w, h) => { g.fillStyle = '#b4655d'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 700, 3, 361, ['rgba(120,60,60,0.2)', 'rgba(220,150,130,0.18)', 'rgba(90,60,50,0.15)']); });
  defMat('earth', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#a79a7e'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 600, 3, 371, ['rgba(80,60,40,0.18)', 'rgba(220,200,160,0.2)']); });
  defMat('rock', 256, 256, [6, 6], (g, w, h) => {
    g.fillStyle = '#bcb3a0'; g.fillRect(0, 0, w, h); const r_ = rng(381);
    noiseDots(g, w, h, 1600, 4, 382, ['rgba(60,52,44,0.25)', 'rgba(215,205,185,0.25)', 'rgba(120,112,96,0.2)']);
    g.strokeStyle = 'rgba(40,34,28,0.35)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { g.beginPath(); let x = r_() * w, y = r_() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r_() - 0.5) * 50; y += 18 + r_() * 26; g.lineTo(x, y); } g.stroke(); }
  });
  defMat('flat', 0, 0, [1, 1], null);
  defMat('dark', 0, 0, [1, 1], null, { roughness: 1 });
  defMat('bronze', 0, 0, [1, 1], null, { roughness: 0.6, metalness: 0 });
  defMat('glass', 0, 0, [1, 1], null, { roughness: 0.25, metalness: 0 });
  defMat('rail', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#2a2a30'; g.fillRect(0, 2, w, 5); g.fillRect(0, h - 6, w, 5); for (let x = 4; x < w; x += 16) g.fillRect(x, 0, 3, h); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  defMat('balus', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e4e0d3'; g.fillRect(0, 0, w, 9); g.fillRect(0, h - 8, w, 8); for (let x = 0; x < w; x += 16) { g.fillRect(x + 4, 9, 8, h - 17); g.fillRect(x + 2, 22, 12, 8); g.fillRect(x + 2, 38, 12, 6); } }, { alphaTest: 0.5, side: THREE.DoubleSide });
  defMat('cren', 64, 32, [1.6, 0.8], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 8, w, h - 8); g.clearRect(32, 8, 32, 16); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 8, w, 2); }, { alphaTest: 0.5, side: THREE.DoubleSide });
  defMat('palm', 64, 64, [1, 1], (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#4f7a3a'; g.strokeStyle = '#3d6a2c'; g.lineWidth = 1.5;
    for (let a = -1.2; a <= 1.2; a += 0.3) { g.beginPath(); g.moveTo(32, 62); g.quadraticCurveTo(32 + a * 20, 20, 32 + a * 30, 14 + Math.abs(a) * 14); g.stroke(); }
  }, { alphaTest: 0.4, side: THREE.DoubleSide, noShadow: true });
}


// A plain building shell: footprint prism (wall texture wallKey) with a flat roof cap and a cornice round every edge;
// o.lo adds a stone foundation down to that level, o.cornice false skips the cornice, o.roof sets the cap colour, o.cc the cornice colour.
export function shell(wallKey, pts, holes, y0, H, o = {}) {
  if (o.lo !== undefined && o.lo < y0) prism('stone', pts, o.lo, y0, { holes, c: '#a89c88' });
  prism(wallKey, pts, y0, y0 + H, { holes });
  prism('flat', pts, y0 + H, y0 + H + 0.15, { holes, c: o.roof || '#8f8a82' });
  if (o.cornice === false) return;
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    bx('flat', frame((A[0] + B[0]) / 2, y0 + H - 0.45, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, 0.8, -0.5, 0.5, { c: o.cc || '#e2d2b4' });
  }
}

// ---------- ornaments ----------
// crenellation panel along local x (centred), standing on y=0 of M, len x 0.8 m tall
export function crenel(M, len, o = {}) { panel('cren', len, 0.8, { M, uvk: [len / 1.6, 1], ...o }); }
export function balus(M, len, h, o = {}) { panel('balus', len, h, { M, uvk: [len / h, 1], ...o }); }
export function rail(M, len, h, o = {}) { panel('rail', len, h, { M, uvk: [len / 0.5 * 0.5, 1], ...o }); }
// small robed statue standing on y=0 in frame M; total height h
export function statue(key, M, h, o = {}) {
  const c = o.c || '#d6d2c4', k = h, na = !!o.noao;
  lathe(key, [[0, 0], [0.23 * k, 0], [0.24 * k, 0.12 * k], [0.19 * k, 0.45 * k], [0.15 * k, 0.62 * k], [0.19 * k, 0.7 * k], [0.08 * k, 0.74 * k], [0.04 * k, 0.77 * k]], 8, { M, c, noao: na });
  box(key, 0.42 * k, 0.1 * k, 0.17 * k, { M, p: [0, 0.62 * k, 0], c, noao: na });
  sphere(key, 0.075 * k, { M, p: [0, 0.84 * k, 0.005 * k], c, seg: 6, noao: na });
  box(key, 0.07 * k, 0.3 * k, 0.08 * k, { M, p: [0.22 * k, 0.4 * k, 0.04 * k], rz: 0.12, c, noao: na });
  box(key, 0.07 * k, 0.3 * k, 0.08 * k, { M, p: [-0.22 * k, 0.4 * k, 0.04 * k], rz: -0.12, c, noao: na });
}
// bronze horse in profile facing +z, 1 unit ~ body length 2.2 m at s=1
export function horse(M, s = 1, o = {}) {
  const k = 'bronze', c = o.c || '#4d5a45', n = true;
  box(k, 0.55 * s, 0.6 * s, 1.3 * s, { M, p: [0, 0.8 * s, 0], c, noao: n });
  box(k, 0.35 * s, 0.9 * s, 0.4 * s, { M, p: [0, 1.15 * s, 0.7 * s], rx: -0.5, c, noao: n });
  box(k, 0.22 * s, 0.3 * s, 0.6 * s, { M, p: [0, 1.95 * s, 0.9 * s], rx: -1.0, c, noao: n });
  for (const [x, z, rr] of [[-0.18, 0.5, 0], [0.18, 0.5, 0], [-0.18, -0.5, 0], [0.18, -0.5, 0]]) box(k, 0.13 * s, 0.85 * s, 0.14 * s, { M, p: [x * s, 0, z * s], rx: o.rear ? -0.3 : 0.08 + rr, c, noao: n });
  if (o.rear) { /* rearing: front legs raised handled by caller rotation */ }
  box(k, 0.1 * s, 0.1 * s, 0.7 * s, { M, p: [0, 0.95 * s, -0.8 * s], rx: 0.9, c, noao: n });
}
// palm: slim trunk plus crossed frond cards
export function palm(x, y, z, h = 9, o = {}) {
  cyl('trunk', 0.22, 0.32, h, 6, { p: [x, y, z], noao: true });
  for (let a = 0; a < 3; a++) panel('palm', h * 0.75, h * 0.6, { p: [x, y + h - h * 0.12, z], ry: a * PI / 3 + (o.r || 0), noao: true });
}
export function ensureTrunk() { defMat('trunk', 32, 32, [1.2, 1.2], (g, w, h) => { g.fillStyle = '#7a6448'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,30,20,.5)'; for (let y = 0; y < h; y += 5) g.fillRect(0, y, w, 1.5); }); }
