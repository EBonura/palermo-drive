// Palermo's tram: tracks, platforms, catenary poles and wire, and the trams themselves.
//
//   * per tile (tile.tram, tools/tram.py; the black iron railing along the median is in tile.fences): buildTram(tr, key) returns one Group: the rails
//     (a strip with two rails and sleepers, laid just above whatever street layer the track lies in), the platforms with shelters and benches at the stops
//     (st.w the half width of an island platform OSM maps as an area, else 1.3 m),
//     the dark red catenary poles (instanced) and the wire (one line mesh). Catenary pole spacing is a design value (30 m): nothing says where the real
//     poles stand.
//   * the trams: assets/traffic/tram-lines.js has the seven line patterns (path along the OSM tracks, stops with their chainage, the timetable headway).
//     Every pattern gets a few trams (as many as the headway asks for, at most five), each of three articulated modules following the path; they
//     slow to every stop, wait, and at the end of the line start on the other direction. They are solid: the lapa bounces off a module, and a tram
//     stops for a car on the track ahead. Trams run from the physics step (hooks.tick) and collide from hooks.fall, wrapped here; the world draws them once a frame (drawTrams).
import * as THREE from 'three';
import { Buf, groundY, hooks } from './core.js';
import { TRAM_PATTERNS } from '../assets/traffic/tram-lines.js';

let raisedFn = () => false, root = null;
export function initTrams({ raised, scene }) { raisedFn = raised; root = scene; startTrams(); }

const hh = Math.hypot;
// the corners of a quad in the order that faces n (counter-clockwise seen from that side): the materials are front-sided, so a quad wound the
// other way is invisible from where it should be seen (the platform tops and sides, a tram's right side and rear were)
function facing(a, b, c, d, n) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
}
const LIFT = 0.05, LIFT_RAISED = 0.2;

// ---------- static pieces of a tile ----------
let railMat = null, poleGeo = null, poleMat = null, solidMat = null, wireMat = null;
function assets() {
  if (railMat) return;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#6b665c'; g.fillRect(0, 0, 128, 128);                     // ballast
  g.fillStyle = '#4e4a42'; for (let y = 0; y < 128; y += 16) g.fillRect(14, y + 2, 100, 7);   // sleepers
  g.fillStyle = '#2a2b2d'; g.fillRect(26, 0, 7, 128); g.fillRect(95, 0, 7, 128);              // the two rails
  g.fillStyle = '#9fa4a8'; g.fillRect(28, 0, 2, 128); g.fillRect(97, 0, 2, 128);              // their shine
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  railMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  wireMat = new THREE.LineBasicMaterial({ color: '#2b2b2e' });
  // a catenary pole: tapering steel mast with a bracket arm across the tracks (local +x), dark red
  const b = new Buf(), red = new THREE.Color('#6d2b24'), dark = new THREE.Color('#2e2a2a');
  const box = (x0, y0, z0, x1, y1, z1, c) => {
    const f = (a, bb, cc, d, nx, ny, nz) => { for (const q of [a, bb, cc, a, cc, d]) b.v(q[0], q[1], q[2], nx, ny, nz, c); };
    f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1); f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1);
    f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0); f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0);
    f([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0);
  };
  box(-0.14, 0, -0.14, 0.14, 1.2, 0.14, dark); box(-0.11, 1.2, -0.11, 0.11, 7.2, 0.11, red);
  box(-3.4, 6.3, -0.06, 0.11, 6.46, 0.06, red); box(-3.4, 5.55, -0.04, -3.3, 6.3, 0.04, dark);    // the arm over the nearer track, and its hanger
  poleGeo = b.mesh(new THREE.MeshStandardMaterial()).geometry;
  poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 });
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export function buildTram(tr, key) {
  if (!tr) return null;
  assets();
  const g = new THREE.Group(); g.name = 'tram';
  const lift = (x, z) => groundY(x, z) + (raisedFn(x, z) ? LIFT_RAISED : LIFT);
  // rails: a strip 3 m wide, vertices every 3 m
  const rb = new Buf(), wire = [];
  for (const r of tr.r) {
    const p = r.p, pts = [];
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], n = Math.max(1, Math.ceil(hh(bx - ax, bz - az) / 3));
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    let s = 0; const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], l = hh(b[0] - a[0], b[1] - a[1]); if (l < 0.05) continue;
      const nx = -(b[1] - a[1]) / l * 1.5, nz = (b[0] - a[0]) / l * 1.5;
      const ya = lift(a[0], a[1]), yb = lift(b[0], b[1]), v0 = s / 3, v1 = (s + l) / 3;
      for (const [x, y, z, u, v] of [[a[0] + nx, ya, a[1] + nz, 0, v0], [b[0] + nx, yb, b[1] + nz, 0, v1], [b[0] - nx, yb, b[1] - nz, 1, v1], [a[0] + nx, ya, a[1] + nz, 0, v0], [b[0] - nx, yb, b[1] - nz, 1, v1], [a[0] - nx, ya, a[1] - nz, 1, v0]])
        rb.v(x, y, z, 0, 1, 0, white, u, v);
      s += l;
    }
    if (r.m !== 's') for (let i = 0; i + 1 < pts.length; i++) wire.push(pts[i][0], lift(pts[i][0], pts[i][1]) + 5.7, pts[i][1], pts[i + 1][0], lift(pts[i + 1][0], pts[i + 1][1]) + 5.7, pts[i + 1][1]);
  }
  if (rb.p.length) { const m = rb.mesh(railMat); m.receiveShadow = true; g.add(m); }
  if (wire.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); g.add(new THREE.LineSegments(geo, wireMat)); }
  // stops: platform, shelter, bench
  const sb = new Buf(), conc = new THREE.Color('#bdb9ad'), edge = new THREE.Color('#e3dfd2'), glass = new THREE.Color('#8fb0b4'), steel = new THREE.Color('#3a3d40'), wood = new THREE.Color('#7b5c3d');
  for (const st of tr.s || []) {
    if (!st.a) continue;
    const [ax, az, bx, bz] = st.a, l = hh(bx - ax, bz - az); if (l < 3) continue;
    const tx = (bx - ax) / l, tz = (bz - az) / l, nx = -tz, nz = tx, hw = st.w || 1.3, y = groundY((ax + bx) / 2, (az + bz) / 2);
    const P = (t, o, h) => [ax + tx * t + nx * o, y + h, az + tz * t + nz * o];
    const quad = (a, b, c, d, n, col) => { for (const q of facing(a, b, c, d, n)) sb.v(q[0], q[1], q[2], n[0], n[1], n[2], col); };
    quad(P(0, -hw, 0.3), P(l, -hw, 0.3), P(l, hw, 0.3), P(0, hw, 0.3), [0, 1, 0], conc);                   // top
    quad(P(0, -hw, 0), P(l, -hw, 0), P(l, -hw, 0.3), P(0, -hw, 0.3), [-nx, 0, -nz], edge); quad(P(l, hw, 0), P(0, hw, 0), P(0, hw, 0.3), P(l, hw, 0.3), [nx, 0, nz], edge);
    quad(P(0, -hw, 0), P(0, hw, 0), P(0, hw, 0.3), P(0, -hw, 0.3), [-tx, 0, -tz], edge); quad(P(l, -hw, 0), P(l, hw, 0), P(l, hw, 0.3), P(l, -hw, 0.3), [tx, 0, tz], edge);   // the two ends
    if (st.sh) { // a glass shelter over the middle of the platform
      const c0 = l / 2 - 2.2, c1 = l / 2 + 2.2, o = hw - 0.25;
      for (const up of [1, -1]) quad(P(c0, -hw + 0.1, 2.4), P(c1, -hw + 0.1, 2.4), P(c1, hw - 0.1, 2.4), P(c0, hw - 0.1, 2.4), [0, up, 0], steel);   // roof, seen from above and below
      for (const sg of [1, -1]) quad(P(c0, o, 0.3), P(c1, o, 0.3), P(c1, o, 2.4), P(c0, o, 2.4), [nx * sg, 0, nz * sg], glass);            // the glass back, from either side
      for (const t of [c0, c1]) quad(P(t, o - 0.04, 0.3), P(t, o + 0.04, 0.3), P(t, o + 0.04, 2.4), P(t, o - 0.04, 2.4), [tx, 0, tz], steel);
    }
    if (st.b) quad(P(l / 2 - 0.9, o0(hw), 0.75), P(l / 2 + 0.9, o0(hw), 0.75), P(l / 2 + 0.9, o0(hw) + 0.4, 0.75), P(l / 2 - 0.9, o0(hw) + 0.4, 0.75), [0, 1, 0], wood);
  }
  function o0(hw) { return hw - 0.8; }
  if (sb.p.length) { const m = sb.mesh(solidMat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // catenary poles
  if (tr.o && tr.o.length) {
    const im = new THREE.InstancedMesh(poleGeo, poleMat, tr.o.length);
    tr.o.forEach(([x, z, yaw], i) => { _e.set(0, yaw + Math.PI / 2, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, groundY(x, z) + (raisedFn(x, z) ? 0.15 : 0), z); im.setMatrixAt(i, _m.compose(_p, _q, _s)); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.computeBoundingSphere(); g.add(im);
  }
  g.userData.tris = (rb.p.length + sb.p.length) / 9 + (tr.o ? tr.o.length * 36 : 0);
  return g;
}

// ---------- the trams ----------
const MODULES = 3, MOD_LEN = 8.6, GAP = 0.4, SPEED = 9.0, ACC = 0.9, DEC = 1.1, DWELL = 9;
const trams = [];
let meshes = null;
function pathOf(pt) {
  if (pt.cum) return pt;
  const p = pt.path, n = p.length / 2, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + hh(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
  pt.cum = cum; pt.L = cum[n - 1]; return pt;
}
const _a = { x: 0, z: 0, yaw: 0 };
function at(pt, s) { // position and heading at chainage s
  const cum = pt.cum, p = pt.path; s = Math.max(0, Math.min(pt.L, s));
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < s) lo = mid; else hi = mid; }
  const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  _a.x = p[2 * lo] + (p[2 * hi] - p[2 * lo]) * t; _a.z = p[2 * lo + 1] + (p[2 * hi + 1] - p[2 * lo + 1]) * t;
  _a.yaw = Math.atan2(p[2 * hi] - p[2 * lo], p[2 * hi + 1] - p[2 * lo + 1]);
  return _a;
}
function moduleGeo() {
  const b = new Buf(), W = 1.2, L = MOD_LEN / 2, white = new THREE.Color('#e9e8e2'), dark = new THREE.Color('#25292d'), grey = new THREE.Color('#8b8f92'), skirt = new THREE.Color('#3a3d40'), band = new THREE.Color('#ffffff');
  const f = (a, bb, c, d, nx, ny, nz, col, k = 1) => { for (const q of facing(a, bb, c, d, [nx, ny, nz])) b.v(q[0], q[1], q[2], nx, ny, nz, col, 0, 0, k); };
  const wall = (z, y0, y1, col, sgn, k = 1) => f([-W, y0, z * sgn], [W, y0, z * sgn], [W, y1, z * sgn], [-W, y1, z * sgn], 0, 0, sgn, col, k);
  const side = (x, y0, y1, col, k = 1) => { const s = Math.sign(x); f([x, y0, -L], [x, y0, L], [x, y1, L], [x, y1, -L], s, 0, 0, col, k); };
  for (const sx of [-W, W]) { side(sx, 0.45, 3.1, white); side(sx * 1.01, 1.25, 2.55, dark); side(sx * 1.005, 0.45, 0.9, skirt); side(sx * 1.003, 0.9, 1.25, band, 0.95); }
  f([-W, 3.1, -L], [-W, 3.1, L], [W, 3.1, L], [W, 3.1, -L], 0, 1, 0, grey);                                    // roof
  f([-W, 3.1, L], [W, 3.1, L], [W, 3.1, L - 0.01], [-W, 3.1, L - 0.01], 0, 1, 0, grey);
  wall(L, 0.45, 3.1, white, 1); wall(L + 0.01, 1.25, 2.55, dark, 1, 1); wall(L, 0.45, 3.1, white, -1);   // the windscreen just proud of the front wall, not in it
  return b.mesh(new THREE.MeshStandardMaterial()).geometry;
}
function startTrams() {
  if (meshes || !root) return;
  const pats = TRAM_PATTERNS.map(p => pathOf({ ...p }));
  const geo = moduleGeo(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
  const total = pats.reduce((n, p) => n + Math.max(1, Math.min(5, Math.round(p.L / (p.head * 60 * SPEED)))), 0) * MODULES;
  meshes = new THREE.InstancedMesh(geo, mat, total); meshes.frustumCulled = false; meshes.castShadow = true; meshes.receiveShadow = true; meshes.name = 'trams';
  meshes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
  root.add(meshes);
  let mi = 0;
  pats.forEach((pt, pi) => {
    const n = Math.max(1, Math.min(5, Math.round(pt.L / (pt.head * 60 * SPEED))));
    const col = new THREE.Color(pt.color).lerp(new THREE.Color('#ffffff'), 0.82);
    for (let k = 0; k < n; k++) {
      const T = { pi, pt, s: (pt.L / n) * k + 30, v: SPEED * (k % 2 ? 0.6 : 1), dwell: 0, hold: 0, next: 0, idx: mi, px: new Float64Array(MODULES), pz: new Float64Array(MODULES), pyaw: new Float64Array(MODULES) };
      T.next = pt.stops.findIndex(st => st.s > T.s);
      for (let m = 0; m < MODULES; m++) { meshes.setColorAt(mi + m, col); }
      mi += MODULES; trams.push(T);
    }
  });
  meshes.instanceColor.needsUpdate = true; meshes.count = mi;
  const other = pi => pats.findIndex((q, j) => j !== pi && q.line === pats[pi].line);
  const tick = dt => { stepTrams(dt, pats, other); };
  const prevTick = hooks.tick; hooks.tick = dtt => { if (prevTick) prevTick(dtt); tick(dtt); };
  const prevFall = hooks.fall; hooks.fall = (car, ball) => { if (prevFall) prevFall(car, ball); collideTrams(car); };
  writeInstances();
}

let car0 = null;
function stepTrams(dt, pats, other) {
  for (const T of trams) {
    const pt = T.pt;
    if (T.dwell > 0) { T.dwell -= dt; T.v = 0; if (T.dwell <= 0) { T.next = pt.stops.findIndex(st => st.s > T.s + 5); } continue; }
    if (T.hold > 0) { T.hold -= dt; T.v = Math.max(0, T.v - 6 * dt); }
    else {
      let vt = SPEED;
      const st = pt.stops[T.next];
      if (st) { const d = st.s - T.s; if (d < 1.0) { T.dwell = DWELL; T.v = 0; T.next = -1; continue; } vt = Math.min(vt, Math.sqrt(2 * DEC * Math.max(0, d - 1.5)) + 0.6); }
      if (car0 && blocked(T, car0)) vt = 0;
      T.v += Math.max(-DEC * 1.6 * dt, Math.min(ACC * dt, vt - T.v));
    }
    T.s += T.v * dt;
    if (T.s >= pt.L - 2) {   // the end of the line: wait, then start the other way
      const o = other(T.pi);
      if (o >= 0) { T.pi = o; T.pt = pats[o]; T.s = 4; T.v = 0; T.dwell = 6; T.next = -1; }
      else { T.s = 4; T.dwell = 6; }
    }
  }
  moved = true;
}
function blocked(T, car) { // a car on the track within 14 m ahead of the nose
  const f = at(T.pt, T.s), fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), dx = car.x - f.x, dz = car.z - f.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
  return along > -2 && along < 14 && side < 2.6;
}
// Where module m of a tram is: its centre and heading, from the tram's chainage. The collision asks at every physics step, and only for the trams near the lapa.
function place(T, m) { const a = at(T.pt, T.s - m * (MOD_LEN + GAP) - MOD_LEN / 2); T.px[m] = a.x; T.pz[m] = a.z; T.pyaw[m] = a.yaw; }
// The instances are written once a frame (drawTrams, called from world.update before the frame is drawn), not at each of the 2 to 4 physics steps in it:
// only the last write of a frame was ever seen.
let moved = true;
export function drawTrams() { if (moved) writeInstances(); }
function writeInstances() {
  if (!meshes) return;
  moved = false;
  for (const T of trams) {
    for (let m = 0; m < MODULES; m++) {
      const s = T.s - m * (MOD_LEN + GAP) - MOD_LEN / 2, a = at(T.pt, s), x = a.x, z = a.z, yaw = a.yaw;
      _e.set(0, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, groundY(x, z) + (raisedFn(x, z) ? LIFT_RAISED : LIFT), z);
      meshes.setMatrixAt(T.idx + m, _m.compose(_p, _q, _s));
    }
  }
  meshes.instanceMatrix.needsUpdate = true;
}
const R_CAR = 0.78, R_TRAM = 1.5;
function collideTrams(car) {
  car0 = car;
  if (car.agl > 3) return;   // flying over it (src/vehicle-air.js)
  const sn = Math.sin(car.th), cs = Math.cos(car.th);
  for (const T of trams) {
    place(T, 0);
    if (Math.abs(T.px[0] - car.x) > 40 || Math.abs(T.pz[0] - car.z) > 40) continue;
    for (let m = 0; m < MODULES; m++) {
      if (m) place(T, m);
      const yaw = T.pyaw[m], fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const o of [-3, 0, 3]) {
        const cx = T.px[m] + fx * o, cz = T.pz[m] + fz * o;
        for (const a of [0.72, -0.72]) {
          const px = car.x + sn * a, pz = car.z + cs * a;
          let nx = px - cx, nz = pz - cz, d = hh(nx, nz); const rs = R_CAR + R_TRAM;
          if (d >= rs) continue;
          if (d < 1e-4) { nx = 0; nz = 1; d = 1e-4; } else { nx /= d; nz /= d; }
          car.x += nx * (rs - d); car.z += nz * (rs - d);
          const vn = (car.vx - fx * T.v) * nx + (car.vz - fz * T.v) * nz;
          if (vn < 0) { car.vx -= (1.25) * vn * nx; car.vz -= (1.25) * vn * nz; if (car.vf !== undefined) car.vf = car.vx * sn + car.vz * cs; }
          T.hold = 1.2;
        }
      }
    }
  }
}
export const tramStats = () => ({ trams: trams.length });
export const tramDebug = () => trams.map(T => { place(T, 0); return { line: T.pt.line, dir: T.pt.dir, s: Math.round(T.s), v: +T.v.toFixed(1), x: Math.round(T.px[0]), z: Math.round(T.pz[0]), dwell: Math.round(T.dwell), yaw: T.pyaw[0] }; });
