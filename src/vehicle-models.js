// The seven vehicles and the tamarro parts, as merged-geometry templates. Owned by the driving work.
//   buildVehicleModel({ type, livery, parts }) -> a rig for one vehicle (used for the local car and for remote players, src/net.js)
// A rig is { root, lean, tilt, bar, wheels, meshes, ... , pose(p), dispose() }, see instantiate() at the bottom.
// Everything is built from boxes, cylinders and spheres in car-frame coordinates (origin on the ground under the middle of the
// vehicle, +z forward, +x left, y up) by src/vehicle-kit.js, one merged mesh per material per group. A few thousand triangles each.
import * as THREE from 'three';
import { Kit, box, cyl, cylX, cylZ, sph, tor, plane, hexa, prism, PI, TAU } from './vehicle-kit.js';
import { MAT, colMat, paintedSet, paintSet, clonedSet, neonMats, stkUV } from './vehicle-art.js';
import { cleanLook, lookKey } from './garage.js';
import { driver } from './driver.js';

// ---------- shared assemblies ----------
// A rider (bikes) or driver, in the 'driver' group so the bonnet camera can hide it.
function rider(D, o) {
  const shirt = colMat(o.shirt, 0.9), pants = colMat(o.pants, 0.9), skin = colMat('#c58b64', 0.8), shoe = MAT.dark;
  const { hip, sh, head } = o;
  D.limb(shirt, hip, sh, 0.34, 0.2);
  D.add(skin, sph(0.1, 10, 8), head[0], head[1], head[2]);
  if (o.helmet === 'full') { D.add(colMat(o.helmetColor || '#16161a', 0.35, 0.2), sph(0.135, 12, 9), head[0], head[1] + 0.015, head[2]); D.add(MAT.dark, box(0.19, 0.06, 0.06), head[0], head[1], head[2] + 0.115); }
  else if (o.helmet === 'jet') { D.add(colMat(o.helmetColor || '#f1efe8', 0.4, 0.1), sph(0.128, 12, 9, 0), head[0], head[1] + 0.03, head[2] - 0.01, 0, 0, 0, 1, 0.82, 1.05); D.add(MAT.dark, box(0.22, 0.025, 0.1), head[0], head[1] + 0.07, head[2] + 0.1); }
  for (const sx of [-1, 1]) {
    D.limb(pants, [sx * 0.12, hip[1], hip[2]], [sx * o.knee[0], o.knee[1], o.knee[2]], 0.14, 0.14);
    D.limb(pants, [sx * o.knee[0], o.knee[1], o.knee[2]], [sx * o.foot[0], o.foot[1], o.foot[2]], 0.11, 0.11);
    D.add(shoe, box(0.1, 0.07, 0.22), sx * o.foot[0], o.foot[1] - 0.03, o.foot[2] + 0.05);
    D.limb(shirt, [sx * 0.19, sh[1] - 0.02, sh[2]], [sx * o.hand[0], o.hand[1], o.hand[2]], 0.095, 0.095);
    D.add(skin, sph(0.045, 6, 5), sx * o.hand[0], o.hand[1], o.hand[2]);
  }
}

// One wheel: tyre + rim, in the wheel's own frame (the axle is the origin). style: 'lapa' whitewall, 'bike' alloy, 'car' flashy.
function addWheel(K, W, style, rimOpt, M) {
  const r = W.r, w = W.w, S = W.s, X = W.x;
  if (style === 'cart') { // spoked wooden cart wheel: a painted rim ring, thin tyre band, four crossing spokes and a hub
    S.add(M.trim, tor(r * 0.93, r * 0.055, 5, 24).clone().rotateY(PI / 2)); S.add(MAT.dark, tor(r * 0.995, r * 0.02, 4, 24).clone().rotateY(PI / 2));
    for (let k = 0; k < 4; k++) S.add(MAT.wood, box(w * 0.7, r * 0.06, r * 1.86), 0, 0, 0, k * PI / 4);
    S.add(M.trim, cylX(r * 0.12, r * 0.12, w + 0.05, 8)); return;
  }
  S.add(MAT.tyre, cylX(r, r, w, style === 'bike' ? 14 : 16));
  const rm = rimOpt === 'oro' ? MAT.gold : rimOpt === 'neri' ? MAT.black : (rimOpt === 'cromati' || rimOpt === 'spinner') ? MAT.chrome : rimOpt === 'rosa' ? PINKM : rimOpt === 'bianchi' ? MAT.white : null;
  const spokes = (mat, n = 3, len = 1.3, wd = 0.12) => { for (let k = 0; k < n; k++) S.add(mat, box(w + 0.03, r * wd, r * len), 0, 0, 0, k * PI / n); };
  if (rm) { // a chosen rim (a tuning part: it vanishes with the others when the vehicle is stripped, leaving the bare tyre)
    K.stage = 1;
    S.add(rimOpt === 'neri' ? MAT.dark : rm, cylX(r * (style === 'lapa' ? 0.78 : 0.72), r * (style === 'lapa' ? 0.78 : 0.72), w + 0.012, 14));
    S.add(rimOpt === 'bianchi' ? MAT.chrome : rm, cylX(r * 0.22, r * 0.22, w + 0.034, 10)); spokes(rimOpt === 'bianchi' ? MAT.chrome : rm, 3, 1.36, 0.14);
    if (rimOpt === 'neri') S.add(colMat('#f27aa8', 0.5, 0.2), tor(r * 0.7, r * 0.03, 4, 18).clone().rotateY(PI / 2), 0, 0, 0);
    K.stage = null;
  } else if (style === 'lapa') {
    S.add(MAT.white, cylX(r * 0.78, r * 0.78, w + 0.012, 14)); S.add(MAT.chrome, cylX(r * 0.4, r * 0.4, w + 0.026, 10)); S.add(MAT.dark, box(w + 0.03, 0.03, r * 0.5));
  } else if (style === 'bike') {
    S.add(MAT.alu, cylX(r * 0.74, r * 0.74, w + 0.01, 14)); S.add(MAT.chrome, cylX(r * 0.2, r * 0.2, w + 0.03, 10)); spokes(MAT.dark, 3, 1.3, 0.1);
  } else { // flashy stock rims of the tamarro car: dark dish, chrome star, gold hub
    S.add(MAT.dark, cylX(r * 0.72, r * 0.72, w + 0.012, 16)); spokes(MAT.chrome, 3, 1.4, 0.15); S.add(MAT.gold, cylX(r * 0.2, r * 0.2, w + 0.036, 10));
  }
  if (rimOpt === 'spinner') { K.stage = 1; // free-spinning blades on the outside (they keep turning when the wheel stops)
    const sides = Math.abs(W.cx) < 0.02 ? [-1, 1] : [Math.sign(W.cx)];
    for (const sd of sides) for (let k = 0; k < 3; k++) X.add(MAT.chrome, box(0.02, r * 0.17, r * 1.62), sd * (w / 2 + 0.02), 0, 0, k * PI / 3);
    for (const sd of sides) X.add(MAT.gold, cylX(r * 0.16, r * 0.16, 0.04, 8), sd * (w / 2 + 0.03), 0, 0);
    K.stage = null;
  }
}

// Decal quad on a flat surface. face: 'x+' 'x-' 'z-' 'z+' 'y+'. w along the reading direction, h across.
function decal(T, key, cx, cy, cz, w, h, face) {
  const g = plane(w, h).clone(), [u0, v0, u1, v1] = stkUV(key), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  const rot = { 'x+': [0, PI / 2, 0], 'x-': [0, -PI / 2, 0], 'z-': [0, PI, 0], 'z+': [0, 0, 0], 'y+': [-PI / 2, 0, 0] }[face];
  T.add(MAT.sticker, g, cx, cy, cz, rot[0], rot[1], rot[2]);
}

// ===================================================================================================================
// LAPE
// ===================================================================================================================
// The front end shared by the three lape: tub, cowl, nose, lamps, bumpers, seat, driver, windscreen, handlebar, front wheel fork.
function lapaFront(K, M, o) {
  const T = K.on('tilt'), D = K.on('driver'), B = K.on('bar'), cab = M.cab || M.body, pil = M.pillar || M.trim || M.body;
  T.add(MAT.dark, box(1.12, 0.1, 2.7), 0, 0.27, -0.1);
  T.add([cab, cab, M.body, M.body, M.body, M.body], new THREE.BoxGeometry(1.3, 0.5, 0.9), 0, 0.53, 0.35);
  T.add(M.body, box(1.0, 0.52, 0.4), 0, 0.74, 0.97);
  T.add(M.body, cyl(0.5, 0.5, 0.52, 18), 0, 0.74, 1.0, 0, 0, 0, 1, 1, 0.82);
  T.add(MAT.chrome, tor(0.5, 0.014, 6, 24), 0, 1.0, 1.0, PI / 2, 0, 0, 1, 0.82, 1);
  T.add(MAT.chrome, box(0.045, 0.46, 0.03), 0, 0.78, 1.405);
  for (const sx of [-1, 1]) {
    T.add(MAT.lamp, sph(0.085, 10, 8), sx * 0.27, 0.93, 1.355); T.add(MAT.chrome, tor(0.09, 0.012, 6, 14), sx * 0.27, 0.93, 1.34);
    T.add(MAT.tail, box(0.12, 0.05, 0.03), sx * 0.5, 0.64, o.tailZ);
  }
  T.add(MAT.white, box(0.3, 0.1, 0.02), 0, 0.45, o.tailZ + 0.01);
  T.add(MAT.chrome, box(1.0, 0.05, 0.12), 0, 0.32, o.tailZ + 0.015); T.add(MAT.chrome, box(0.95, 0.05, 0.1), 0, 0.32, 1.1);
  // front seat and driver
  T.add(MAT.seat, box(0.55, 0.28, 0.45), 0, 0.92, 0.18); T.add(MAT.seat, box(0.55, 0.42, 0.09), 0, 1.2, -0.07);
  D.add(colMat('#2c3a58', 0.9), box(0.42, 0.5, 0.24), 0, 1.28, 0.12);
  D.add(colMat('#c58b64', 0.8), sph(0.12, 10, 8), 0, 1.68, 0.14); D.add(MAT.dark, box(0.26, 0.04, 0.2), 0, 1.78, 0.17);
  // windscreen, A-pillars, wiper and mirror (one assembly leaning back)
  { const W = K.on('tilt', 0, 1.0, 0.8, -0.15, 0, 0);
    W.add(MAT.glass, box(1.14, 0.7, 0.02), 0, 0.4, 0);
    W.add(MAT.chrome, box(1.22, 0.04, 0.04), 0, 0, 0); W.add(MAT.chrome, box(1.22, 0.04, 0.04), 0, 0.78, 0);
    W.add(MAT.chrome, box(0.025, 0.74, 0.022), 0, 0.4, 0.01);
    for (const sx of [-1, 1]) W.add(pil, box(0.05, 1.0, 0.05), sx * 0.62, 0.5, 0);
    W.add(MAT.dark, box(0.5, 0.012, 0.012), 0.2, 0.08, 0.02, 0, 0, 0.12);
    W.add(MAT.chrome, box(0.012, 0.26, 0.012), 0.68, 0.3, 0.05, 0, 0, -0.15);
    K.stage = 1; W.add(MAT.chrome, box(0.14, 0.1, 0.02), 0.72, 0.46, 0.14); K.stage = null; }
  // handlebar (turns with the front wheel)
  B.add(MAT.chrome, cylX(0.015, 0.015, 0.7, 8), 0, 0, 0); B.add(MAT.chrome, box(0.03, 0.2, 0.03), 0, -0.1, 0);
  for (const sx of [-1, 1]) B.add(MAT.dark, cylX(0.022, 0.022, 0.1, 8), sx * 0.36, 0, 0);
  // front wheel with its fork and fender
  const wf = K.wheel(0, 0.23, 1.15, 0.23, 0.15, true);
  for (const sx of [-1, 1]) wf.p.add(MAT.chrome, box(0.025, 0.55, 0.04), sx * 0.1, 0.27, 0);
  wf.p.add(MAT.chrome, box(0.24, 0.04, 0.06), 0, 0.5, 0);
  wf.p.add(M.arch || M.body, cylX(0.275, 0.275, 0.2, 14, false, 0, PI), 0, 0, 0);
  addWheel(K, wf, 'lapa', o.rims);
  // rear wheels with arches
  for (const sx of [-1, 1]) {
    const wr = K.wheel(sx * 0.66, 0.23, -0.7, 0.23, 0.15, false); addWheel(K, wr, 'lapa', o.rims);
    T.add(M.arch || M.body, cylX(0.285, 0.285, 0.2, 14, false, 0, PI), sx * 0.66, 0.23, -0.7);
  }
}

function buildCalessino(K, M, P, A) {
  K.spec.tiltPivot = [0, 0.45, 0]; K.spec.barPos = [0, 1.12, 0.62];
  K.group('tilt', [0, 0.45, 0]).group('driver', [0, 0.45, 0]).group('bar', [0, 1.12, 0.62]);
  const T = K.on('tilt');
  lapaFront(K, M, { tailZ: -1.565, rims: P.rims });
  T.add([M.rear, M.rear, MAT.floor, M.body, M.body, M.rear], new THREE.BoxGeometry(1.3, 0.5, 1.5), 0, 0.53, -0.85);
  T.add(MAT.seat, box(1.12, 0.28, 0.5), 0, 0.92, -1.2); T.add(MAT.seat, box(1.12, 0.5, 0.09), 0, 1.3, -1.48);
  // canvas roof: a crowned, back-sloping panel on chrome poles, with clear plastic at the back
  { const rg = new THREE.BoxGeometry(1.5, 0.05, 2.45, 8, 1, 10), p = rg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + z * 0.085 - x * x * 0.2 - (z > 0.9 ? (z - 0.9) * 0.15 : 0)); }
    rg.computeVertexNormals();
    T.add(M.roof, rg, 0, 1.97, -0.3);
    T.add(M.roof, box(1.36, 0.03, 0.5), 0, 1.56, -1.6, -1.3); T.add(M.roof, box(1.5, 0.05, 0.03), 0, 1.78, -1.52);
    T.add(MAT.plastic, box(1.1, 0.4, 0.015), 0, 1.5, -1.47, -0.25); }
  for (const sx of [-1, 1]) {
    for (const z of [-1.45, -0.3]) T.add(MAT.chrome, cyl(0.017, 0.017, 1.1, 6), sx * 0.66, 1.4, z);
    T.add(MAT.plastic, box(0.012, 0.55, 1.1), sx * 0.715, 1.52, -0.88); T.add(MAT.plastic, box(0.012, 0.3, 0.7), sx * 0.715, 1.6, 0.35);
    for (const [z, len] of [[-0.9, 0.9], [0.33, 0.7]]) { // half doors
      T.add(M.door, box(0.035, 0.4, len), sx * 0.67, 0.99, z);
      T.add(MAT.chrome, box(0.05, 0.03, len + 0.04), sx * 0.67, 1.2, z); T.add(MAT.chrome, box(0.05, 0.03, len + 0.04), sx * 0.67, 0.79, z);
      T.add(MAT.dark, box(0.052, 0.07, 0.22), sx * 0.67, 1.08, z);
    }
  }
  Object.assign(A, {
    kind: 'lapa', spoil: { y: 1.9, z: -1.6, w: 1.3, h: 0.16 }, neon: { x: 0.64, z0: -1.5, z1: 1.2, y: 0.24 }, glow: { w: 2.6, l: 4.0, z: -0.1 },
    roof: { y: 2.04, z: 0.55, w: 0.9 }, rack: { y: 1.94, z: -0.7, w: 1.1, l: 1.2 },
    flank: { x: 0.655, y: 0.53, z: -0.85, l: 1.36, h: 0.4 }, top: null, back: { y: 0.95, z: -1.58, w: 0.9, h: 0.3 }, front: { y: 0.74, z: 1.43, w: 0.34, h: 0.34 },
    exh: [[0.32, 0.3, -1.6], [-0.32, 0.3, -1.6]], tails: [[-0.5, 0.64, -1.59], [0.5, 0.64, -1.59]], sub: { x: 0, y: 0.7, z: -1.8, w: 0.9, h: 0.4, d: 0.34 },
    seats: [{ x: -0.26, z: -1.1, y: 1.04 }, { x: 0.26, z: -1.1, y: 1.04 }], barK: 0.9, steerMax: 0.62, tipMax: 0.17, track: 0.66, rearTrack: 0.66, wheelR: 0.23, len: 3.1,
    chrome(C, m) { C.add(m, box(0.06, 0.06, 2.5), 0.7, 0.3, -0.2); C.add(m, box(0.06, 0.06, 2.5), -0.7, 0.3, -0.2); C.add(m, box(1.1, 0.06, 0.06), 0, 0.42, -1.63); C.add(m, box(0.04, 0.5, 0.04), 0.36, 0.78, 1.43); C.add(m, box(0.04, 0.5, 0.04), -0.36, 0.78, 1.43); C.add(m, box(0.8, 0.04, 0.04), 0, 1.04, 1.44); },
  });
}

function buildCassone(K, M, P, A) {
  K.spec.tiltPivot = [0, 0.45, 0]; K.spec.barPos = [0, 1.12, 0.62];
  K.group('tilt', [0, 0.45, 0]).group('driver', [0, 0.45, 0]).group('bar', [0, 1.12, 0.62]);
  const T = K.on('tilt');
  lapaFront(K, M, { tailZ: -1.72, rims: P.rims });
  // hard cab roof and glazed doors
  T.add(M.trim, box(1.36, 0.06, 1.0), 0, 1.86, 0.32); T.add(M.trim, box(1.36, 0.05, 0.12), 0, 1.78, 0.9, 0.5);
  for (const sx of [-1, 1]) {
    T.add(MAT.glass, box(0.02, 0.5, 0.8), sx * 0.66, 1.5, 0.35);
    T.add(M.trim, box(0.05, 0.98, 0.05), sx * 0.66, 1.3, -0.14); T.add(M.body, box(0.04, 0.34, 0.9), sx * 0.66, 0.98, 0.35);
  }
  T.add(M.trim, box(1.3, 0.9, 0.05), 0, 1.25, -0.16);   // cab back wall
  // cargo bed: floor, side boards, tailgate, wheel arches and a heap of fruit crates
  T.add(M.body, box(1.3, 0.06, 1.62), 0, 0.56, -0.97);
  for (const sx of [-1, 1]) { T.add(MAT.wood, box(0.045, 0.34, 1.62), sx * 0.66, 0.77, -0.97); T.add(M.arch || M.body, cylX(0.29, 0.29, 0.2, 14, false, 0, PI), sx * 0.66, 0.23, -0.7); }
  T.add(MAT.wood, box(1.3, 0.34, 0.045), 0, 0.77, -1.77);
  const crate = (x, y, z, w = 0.52, h = 0.3, d = 0.42) => { T.add(MAT.wood, box(w, h, d), x, y, z); T.add(MAT.dark, box(w + 0.01, 0.03, d + 0.01), x, y + h / 2 - 0.02, z); };
  crate(-0.31, 0.74, -0.58); crate(0.31, 0.74, -0.58); crate(-0.31, 0.74, -1.04); crate(0.31, 0.74, -1.04); crate(0, 1.04, -0.8, 0.56, 0.3, 0.46);
  { const fr = [MAT.orange, MAT.orange, MAT.lemon, MAT.orange, MAT.leaf]; let k = 0;
    for (const [x, z] of [[-0.18, -0.64], [0, -0.64], [0.18, -0.64], [-0.18, -0.8], [0, -0.8], [0.18, -0.8], [-0.18, -0.96], [0, -0.96], [0.18, -0.96]]) T.add(fr[k++ % fr.length], sph(0.075, 7, 5), x, 1.22, z); }
  T.add(MAT.tail, box(0.12, 0.05, 0.03), 0.6, 0.64, -1.77); T.add(MAT.tail, box(0.12, 0.05, 0.03), -0.6, 0.64, -1.77);
  Object.assign(A, {
    kind: 'lapa', spoil: { y: 1.92, z: -0.2, w: 1.34, h: 0.14 }, neon: { x: 0.64, z0: -1.6, z1: 1.2, y: 0.24 }, glow: { w: 2.6, l: 4.2, z: -0.2 },
    roof: { y: 1.9, z: 0.35, w: 1.1 }, rack: { y: 1.32, z: -1.0, w: 1.1, l: 1.3 },
    flank: { x: 0.69, y: 0.77, z: -0.97, l: 1.5, h: 0.26 }, top: null, back: { y: 0.77, z: -1.8, w: 0.9, h: 0.26 }, front: { y: 0.74, z: 1.43, w: 0.34, h: 0.34 },
    exh: [[0.32, 0.3, -1.72], [-0.32, 0.3, -1.72]], tails: [[-0.6, 0.64, -1.78], [0.6, 0.64, -1.78]], sub: { x: 0, y: 1.14, z: -1.12, w: 0.9, h: 0.5, d: 0.36, inBed: true },
    seats: [{ x: -0.26, z: -0.9, y: 0.7 }, { x: 0.26, z: -0.9, y: 0.7 }], barK: 0.9, steerMax: 0.62, tipMax: 0.2, track: 0.66, rearTrack: 0.66, wheelR: 0.23, len: 3.6,
    chrome(C, m) { C.add(m, box(0.06, 0.06, 2.0), 0.7, 0.4, -0.9); C.add(m, box(0.06, 0.06, 2.0), -0.7, 0.4, -0.9); C.add(m, box(1.0, 0.05, 0.05), 0, 1.95, 0.84); C.add(m, box(0.04, 0.5, 0.04), 0.36, 0.78, 1.43); C.add(m, box(0.04, 0.5, 0.04), -0.36, 0.78, 1.43); C.add(m, box(1.34, 0.04, 0.04), 0, 1.08, -1.78); },
  });
}

function buildLapa50(K, M, P, A) {
  const s = 0.86; K.s = s;
  K.spec.tiltPivot = [0, 0.45 * s, 0]; K.spec.barPos = [0, 1.12 * s, 0.62 * s];
  K.group('tilt', [0, 0.45 * s, 0]).group('driver', [0, 0.45 * s, 0]).group('bar', [0, 1.12 * s, 0.62 * s]);
  const T = K.on('tilt');
  lapaFront(K, M, { tailZ: -1.3, rims: P.rims });
  // cab roof, then a van box behind it
  T.add(M.trim, box(1.36, 0.06, 0.9), 0, 1.84, 0.34);
  for (const sx of [-1, 1]) { T.add(MAT.glass, box(0.02, 0.5, 0.7), sx * 0.66, 1.5, 0.36); T.add(M.body, box(0.04, 0.34, 0.9), sx * 0.66, 0.98, 0.35); T.add(M.trim, box(0.05, 0.98, 0.05), sx * 0.66, 1.3, -0.1); }
  T.add(M.body, box(1.32, 1.0, 1.3), 0, 1.06, -0.72);       // van box
  T.add(M.trim, box(1.34, 0.08, 1.32), 0, 1.6, -0.72);       // roof edge
  T.add(M.body, box(1.3, 0.06, 1.46), 0, 0.5, -0.8);         // sill
  T.add(MAT.dark, box(0.02, 0.8, 0.02), 0, 1.06, -1.38); T.add(MAT.dark, box(1.0, 0.02, 0.02), 0, 1.0, -1.375);
  for (const sx of [-1, 1]) { T.add(M.arch || M.body, cylX(0.29, 0.29, 0.2, 14, false, 0, PI), sx * 0.66, 0.23, -0.7); T.add(M.trim, box(0.03, 0.12, 1.1), sx * 0.67, 1.1, -0.72); T.add(MAT.glass, box(0.02, 0.26, 0.5), sx * 0.67, 1.3, -0.5); }
  T.add(MAT.tail, box(0.12, 0.05, 0.03), 0.52, 0.7, -1.38); T.add(MAT.tail, box(0.12, 0.05, 0.03), -0.52, 0.7, -1.38);
  const k = s;
  Object.assign(A, {
    kind: 'lapa', spoil: { y: 1.7 * k, z: -1.42 * k, w: 1.2, h: 0.14 }, neon: { x: 0.57, z0: -1.25, z1: 1.0, y: 0.22 }, glow: { w: 2.3, l: 3.4, z: -0.1 },
    roof: { y: 1.87, z: 0.34, w: 1.1 }, rack: { y: 1.65, z: -0.72, w: 1.1, l: 1.1 },   // the roof and rack anchors are in model units (the kit scales them)
    flank: { x: 0.675 * k, y: 1.06 * k, z: -0.72 * k, l: 1.0, h: 0.6 * k }, top: null, back: { y: 1.0 * k, z: -1.4 * k, w: 0.8, h: 0.5 * k }, front: { y: 0.74 * k, z: 1.43 * k, w: 0.3, h: 0.3 },
    exh: [[0.28, 0.28, -1.3], [-0.28, 0.28, -1.3]], tails: [[-0.52 * k, 0.7 * k, -1.39 * k], [0.52 * k, 0.7 * k, -1.39 * k]], sub: { x: 0, y: 0.62, z: -1.6, w: 0.8, h: 0.36, d: 0.3 },
    seats: [{ x: -0.22, z: -0.4, y: 0.75 }, { x: 0.22, z: -0.4, y: 0.75 }], barK: 0.9, steerMax: 0.66, tipMax: 0.2, track: 0.66 * k, rearTrack: 0.66 * k, wheelR: 0.23 * k, len: 2.7,
    chrome(C, m) { C.add(m, box(0.06, 0.06, 2.0), 0.7, 0.3, -0.2); C.add(m, box(0.06, 0.06, 2.0), -0.7, 0.3, -0.2); C.add(m, box(1.0, 0.05, 0.05), 0, 1.95, 0.84); C.add(m, box(0.04, 0.5, 0.04), 0.36, 0.78, 1.43); C.add(m, box(0.04, 0.5, 0.04), -0.36, 0.78, 1.43); },
  });
}

// ===================================================================================================================
// BIKES (the tilt group pivots about the rear axle so a wheelie lifts the front; the lean group banks about the ground)
// ===================================================================================================================
function bikeFrame(K, rearY, rearZ, barPos) {
  K.spec.tiltPivot = [0, rearY, rearZ]; K.spec.barPos = barPos; K.spec.wheelsIn = 'tilt'; K.spec.leanMode = 'bank';
  K.group('tilt', [0, rearY, rearZ]).group('driver', [0, rearY, rearZ]).group('bar', barPos);
}

function buildVespa(K, M, P, A) {
  bikeFrame(K, 0.2, -0.6, [0, 0.98, 0.5]);
  const T = K.on('tilt'), D = K.on('driver'), B = K.on('bar');
  // body: rear cowl with flat sides, round top, floorboard, legshield, tail
  T.add(M.body, prism([-0.17, 0.17, -0.92, -0.2], 0.24, [-0.15, 0.15, -0.9, -0.24], 0.62));
  T.add(M.body, sph(0.2, 12, 8), 0, 0.6, -0.56, 0, 0, 0, 0.78, 0.55, 1.5);
  T.add(M.body, sph(0.18, 10, 8), 0, 0.46, -0.93, 0, 0, 0, 0.9, 1.2, 0.7);
  T.add(M.body, box(0.38, 0.05, 0.5), 0, 0.2, 0.2); T.add(MAT.alu, box(0.03, 0.03, 0.5), 0.2, 0.2, 0.2); T.add(MAT.alu, box(0.03, 0.03, 0.5), -0.2, 0.2, 0.2);
  T.add(M.body, box(0.4, 0.66, 0.05), 0, 0.56, 0.4, -0.3, 0, 0);
  T.add(M.trim, box(0.3, 0.07, 0.6), 0, 0.72, -0.4); T.add(M.trim, box(0.24, 0.07, 0.2), 0, 0.7, -0.05, 0.15);
  T.add(MAT.tail, box(0.1, 0.05, 0.04), 0, 0.5, -1.1); T.add(MAT.white, box(0.16, 0.1, 0.015), 0, 0.36, -1.12);
  T.add(MAT.chrome, tor(0.1, 0.012, 5, 14), 0, 0.5, -1.095);
  // stock small exhaust
  T.add(MAT.alu, cylX(0.05, 0.05, 0.4, 8).clone().rotateY(PI / 2), -0.2, 0.26, -0.78); T.tube(MAT.alu, [-0.18, 0.3, -0.42], [-0.2, 0.26, -0.6], 0.03);
  // wheels
  const wf = K.wheel(0, 0.2, 0.62, 0.2, 0.1, true), wr = K.wheel(0, 0.2, -0.6, 0.2, 0.1, false);
  addWheel(K, wf, 'bike', P.rims); addWheel(K, wr, 'bike', P.rims);
  // fork, fender (on the steering wheel pivot)
  for (const sx of [-1, 1]) wf.p.tube(MAT.chrome, [sx * 0.07, 0, 0], [sx * 0.07, 0.74, -0.1], 0.016);
  wf.p.add(M.body, cylX(0.235, 0.235, 0.12, 14, false, 0, PI), 0, 0, 0);
  wf.p.add(M.body, box(0.12, 0.1, 0.2), 0, 0.2, -0.15, 0.2);
  // handlebar headset
  B.add(M.body, sph(0.15, 12, 8), 0, 0.02, 0.02, 0, 0, 0, 1.15, 0.8, 1.25);
  B.add(MAT.lamp, sph(0.075, 10, 8), 0, 0.02, 0.17); B.add(MAT.chrome, tor(0.078, 0.01, 5, 14), 0, 0.02, 0.16);
  B.add(MAT.chrome, cylX(0.014, 0.014, 0.62, 8), 0, 0.07, -0.04); for (const sx of [-1, 1]) { B.add(MAT.dark, cylX(0.024, 0.024, 0.1, 8), sx * 0.34, 0.07, -0.04); K.stage = 1; B.tube(MAT.chrome, [sx * 0.2, 0.08, -0.04], [sx * 0.24, 0.3, -0.1], 0.008); B.add(MAT.chrome, box(0.1, 0.07, 0.015), sx * 0.24, 0.32, -0.1); K.stage = null; }
  rider(D, { shirt: '#2f7a87', pants: '#3a4660', helmet: 'jet', helmetColor: '#f1efe8', hip: [0, 0.8, -0.38], sh: [0, 1.3, -0.26], head: [0, 1.5, -0.2], knee: [0.17, 0.78, 0.0], foot: [0.16, 0.27, 0.2], hand: [0.3, 1.06, 0.45] });
  Object.assign(A, {
    kind: 'bike', spoil: { y: 0.66, z: -0.97, w: 0.42, h: 0.12 }, neon: { x: 0.2, z0: -0.5, z1: 0.5, y: 0.15, bike: true }, glow: { w: 1.5, l: 2.6, z: 0 },
    roof: { x: 0.17, y: 0.6, z: -0.88 }, tail: { y: 0.7, z: -0.95, w: 0.36 }, bag: { x: 0.24, y: 0.4, z: -0.8, l: 0.4, h: 0.26 }, screen: { y: 0.17, z: 0.08, w: 0.34 },
    flank: { x: 0.178, y: 0.43, z: -0.56, l: 0.62, h: 0.3 }, top: null, back: null, front: { y: 0.55, z: 0.45, w: 0.26, h: 0.26, tilt: true },
    exh: [[-0.2, 0.26, -0.96], [0.2, 0.26, -0.96]], tails: [[0, 0.5, -1.115]], sub: { x: 0, y: 0.5, z: -1.2, w: 0.5, h: 0.3, d: 0.26 },
    seats: [{ x: 0, z: -0.62, y: 0.82 }], barK: 1, steerMax: 0.45, tipMax: 0.62, track: 0, rearTrack: 0, wheelR: 0.2, len: 1.9,
    chrome(C, m) { C.add(m, box(0.3, 0.025, 0.4), 0, 0.74, -0.97); C.tube(m, [-0.14, 0.62, -0.94], [-0.14, 0.76, -1.08], 0.012); C.tube(m, [0.14, 0.62, -0.94], [0.14, 0.76, -1.08], 0.012); C.add(m, box(0.22, 0.02, 0.1), 0, 0.84, -1.08); C.add(m, box(0.05, 0.4, 0.05), 0, 0.5, 0.43, -0.3); },
  });
}

function buildScooterone(K, M, P, A) {
  bikeFrame(K, 0.26, -0.68, [0, 1.02, 0.5]);
  const T = K.on('tilt'), D = K.on('driver'), B = K.on('bar');
  T.add(M.body, prism([-0.2, 0.2, -1.0, -0.22], 0.3, [-0.18, 0.18, -0.96, -0.3], 0.74));
  T.add(M.body, sph(0.2, 12, 8), 0, 0.72, -0.62, 0, 0, 0, 0.9, 0.5, 1.75);
  T.add(M.body, box(0.42, 0.05, 0.56), 0, 0.27, 0.16); T.add(MAT.alu, box(0.03, 0.03, 0.56), 0.215, 0.27, 0.16); T.add(MAT.alu, box(0.03, 0.03, 0.56), -0.215, 0.27, 0.16);
  T.add(M.body, box(0.42, 0.72, 0.06), 0, 0.64, 0.42, -0.22, 0, 0);
  T.add(M.trim, box(0.32, 0.09, 0.86), 0, 0.86, -0.32); T.add(M.trim, box(0.26, 0.1, 0.25), 0, 0.84, 0.04, 0.2);
  // top box on a rack and a grab rail
  T.add(M.body, box(0.4, 0.34, 0.46), 0, 1.07, -0.86); T.add(MAT.dark, box(0.402, 0.02, 0.42), 0, 1.0, -0.86); T.add(MAT.chrome, box(0.2, 0.03, 0.01), 0, 1.15, -1.09);
  T.add(MAT.chrome, box(0.34, 0.025, 0.5), 0, 0.89, -0.86); T.tube(MAT.chrome, [-0.16, 0.89, -0.62], [-0.16, 0.9, -1.1], 0.012); T.tube(MAT.chrome, [0.16, 0.89, -0.62], [0.16, 0.9, -1.1], 0.012);
  T.add(MAT.tail, box(0.14, 0.05, 0.04), 0, 0.68, -1.04); T.add(MAT.white, box(0.2, 0.11, 0.015), 0, 0.48, -1.02);
  T.add(MAT.dark, cylX(0.065, 0.065, 0.5, 10).clone().rotateY(PI / 2), 0.2, 0.34, -0.8);   // muffler
  T.add(MAT.alu, box(0.02, 0.18, 0.5), 0.205, 0.5, -0.5);
  const wf = K.wheel(0, 0.26, 0.74, 0.26, 0.12, true), wr = K.wheel(0, 0.26, -0.68, 0.26, 0.12, false);
  addWheel(K, wf, 'bike', P.rims); addWheel(K, wr, 'bike', P.rims);
  wf.s.add(MAT.dark, cylX(0.12, 0.12, 0.014, 12), 0.062, 0, 0);
  for (const sx of [-1, 1]) wf.p.tube(MAT.chrome, [sx * 0.085, 0, 0], [sx * 0.085, 0.76, -0.14], 0.02);
  wf.p.add(M.body, cylX(0.3, 0.3, 0.14, 14, false, 0, PI), 0, 0, 0); wf.p.add(M.body, box(0.14, 0.1, 0.22), 0, 0.26, -0.18, 0.2);
  // front cowl, twin headlight and a small screen on the bar
  B.add(M.body, box(0.4, 0.2, 0.3), 0, 0.02, 0.06); B.add(M.body, box(0.32, 0.16, 0.2), 0, -0.1, 0.18, 0.4);
  for (const sx of [-1, 1]) { B.add(MAT.lamp, box(0.1, 0.05, 0.03), sx * 0.1, 0.0, 0.25); }
  B.add(MAT.glass, box(0.3, 0.2, 0.01), 0, 0.2, 0.0, -0.4);
  B.add(MAT.chrome, cylX(0.014, 0.014, 0.66, 8), 0, 0.14, -0.1); for (const sx of [-1, 1]) { B.add(MAT.dark, cylX(0.026, 0.026, 0.11, 8), sx * 0.36, 0.14, -0.1); K.stage = 1; B.tube(MAT.black, [sx * 0.2, 0.14, -0.1], [sx * 0.26, 0.34, -0.1], 0.008); B.add(MAT.black, box(0.1, 0.07, 0.015), sx * 0.26, 0.36, -0.1); K.stage = null; }
  rider(D, { shirt: '#23262e', pants: '#4a5668', helmet: 'jet', helmetColor: '#1f2024', hip: [0, 0.9, -0.34], sh: [0, 1.46, -0.3], head: [0, 1.67, -0.26], knee: [0.17, 0.9, 0.12], foot: [0.16, 0.34, 0.26], hand: [0.3, 1.16, 0.4] });
  Object.assign(A, {
    kind: 'bike', spoil: { y: 1.26, z: -1.09, w: 0.4, h: 0.1 }, neon: { x: 0.22, z0: -0.6, z1: 0.55, y: 0.17, bike: true }, glow: { w: 1.6, l: 2.8, z: 0 },
    roof: { x: 0.15, y: 1.24, z: -1.0 }, tail: { y: 1.24, z: -0.86, w: 0.36 }, bag: { x: 0.27, y: 0.45, z: -0.82, l: 0.42, h: 0.28 }, screen: { y: 0.3, z: 0.0, w: 0.36 },
    flank: { x: 0.205, y: 0.52, z: -0.62, l: 0.7, h: 0.32 }, top: null, back: null, front: { y: 0.52, z: 0.46, w: 0.28, h: 0.28, tilt: true },
    exh: [[0.2, 0.34, -1.05], [-0.2, 0.34, -1.05]], tails: [[0, 0.68, -1.065]], sub: { x: 0, y: 1.07, z: -1.1, w: 0.4, h: 0.3, d: 0.1, onBox: true },
    seats: [{ x: 0, z: -0.66, y: 0.94 }], barK: 1, steerMax: 0.45, tipMax: 0.58, track: 0, rearTrack: 0, wheelR: 0.26, len: 2.0,
    chrome(C, m) { C.add(m, box(0.44, 0.03, 0.5), 0, 0.9, -0.86); C.add(m, box(0.03, 0.2, 0.5), 0.21, 0.6, -0.6); C.add(m, box(0.03, 0.2, 0.5), -0.21, 0.6, -0.6); C.add(m, box(0.44, 0.03, 0.03), 0, 0.99, 0.42, -0.22); },
  });
}

function buildMotorino(K, M, P, A) {
  bikeFrame(K, 0.3, -0.65, [0, 1.0, 0.42]);
  const T = K.on('tilt'), D = K.on('driver'), B = K.on('bar');
  // frame, engine, tank, seat and tail
  T.limb(MAT.black, [0, 0.95, 0.4], [0, 0.55, -0.3], 0.05); T.limb(MAT.black, [0, 0.55, -0.3], [0, 0.34, -0.58], 0.05); T.limb(MAT.black, [0, 0.95, 0.4], [0, 0.4, 0.22], 0.05); T.limb(MAT.black, [0, 0.4, 0.22], [0, 0.34, -0.2], 0.05);
  T.add(MAT.alu, box(0.2, 0.28, 0.36), 0, 0.42, -0.02); T.add(MAT.dark, prism([-0.07, 0.07, -0.15, 0.06], 0.52, [-0.07, 0.07, -0.1, 0.1], 0.74)); T.add(MAT.alu, box(0.22, 0.16, 0.22), 0, 0.34, -0.38);
  T.add(M.body, prism([-0.15, 0.15, -0.12, 0.42], 0.74, [-0.12, 0.12, -0.08, 0.38], 0.96));
  T.add(M.body, sph(0.13, 10, 8), 0, 0.88, 0.42, 0, 0, 0, 1, 0.8, 0.9);
  T.add(MAT.black, box(0.24, 0.07, 0.56), 0, 0.84, -0.4); T.add(M.body, prism([-0.11, 0.11, -0.84, -0.6], 0.84, [-0.07, 0.07, -0.86, -0.66], 0.95));
  T.add(MAT.tail, box(0.1, 0.04, 0.03), 0, 0.9, -0.86); T.add(MAT.white, box(0.14, 0.1, 0.012), 0, 0.64, -0.82, -0.3);
  // exhaust pipe running down and back on the right, with a muffler
  T.tube(MAT.chrome, [-0.12, 0.56, 0.05], [-0.15, 0.3, -0.12], 0.03); T.tube(MAT.chrome, [-0.15, 0.3, -0.12], [-0.17, 0.36, -0.62], 0.032);
  T.add(MAT.chrome, cylZ(0.05, 0.045, 0.34, 10), -0.17, 0.36, -0.78);
  // swingarm, rear shocks with springs, footpegs
  for (const sx of [-1, 1]) { T.limb(MAT.dark, [sx * 0.1, 0.34, -0.2], [sx * 0.1, 0.3, -0.65], 0.04); T.tube(MAT.gold, [sx * 0.14, 0.32, -0.62], [sx * 0.12, 0.7, -0.5], 0.022); T.add(MAT.dark, box(0.08, 0.03, 0.14), sx * 0.2, 0.3, -0.18); }
  const wf = K.wheel(0, 0.3, 0.65, 0.3, 0.09, true), wr = K.wheel(0, 0.3, -0.65, 0.3, 0.11, false);
  addWheel(K, wf, 'bike', P.rims); addWheel(K, wr, 'bike', P.rims);
  wf.s.add(MAT.dark, cylX(0.12, 0.12, 0.014, 12), 0.04, 0, 0);
  for (const sx of [-1, 1]) wf.p.tube(MAT.gold, [sx * 0.075, 0, 0], [sx * 0.07, 0.7, -0.23], 0.019);
  wf.p.add(M.body, cylX(0.33, 0.33, 0.08, 12, false, 0, PI * 0.55).clone().rotateY(PI), 0, 0.02, -0.02, 0, 0, 0, 1, 1, 1);
  // bar: wide handlebar, round headlight, little clocks
  B.add(MAT.black, cylX(0.014, 0.014, 0.74, 8), 0, 0.03, 0); for (const sx of [-1, 1]) { B.add(MAT.dark, cylX(0.026, 0.026, 0.12, 8), sx * 0.38, 0.03, 0); K.stage = 1; B.tube(MAT.chrome, [sx * 0.3, 0.05, 0.02], [sx * 0.34, 0.24, -0.02], 0.007); B.add(MAT.chrome, box(0.09, 0.06, 0.012), sx * 0.34, 0.26, -0.02); K.stage = null; }
  B.add(MAT.chrome, cylZ(0.1, 0.1, 0.12, 14), 0, -0.02, 0.14); B.add(MAT.lamp, cylZ(0.082, 0.082, 0.02, 14), 0, -0.02, 0.205); B.add(MAT.dark, box(0.1, 0.08, 0.04), 0, 0.12, -0.04);
  rider(D, { shirt: '#b0262a', pants: '#20242c', helmet: 'full', helmetColor: '#141418', hip: [0, 0.9, -0.4], sh: [0, 1.34, -0.12], head: [0, 1.5, -0.02], knee: [0.15, 0.78, 0.1], foot: [0.18, 0.36, -0.18], hand: [0.37, 1.04, 0.42] });
  Object.assign(A, {
    kind: 'bike', spoil: { y: 0.93, z: -0.84, w: 0.3, h: 0.1 }, neon: { x: 0.18, z0: -0.45, z1: 0.5, y: 0.2, bike: true }, glow: { w: 1.4, l: 2.6, z: 0 },
    roof: { x: 0.12, y: 0.95, z: -0.88 }, tail: { y: 0.97, z: -0.86, w: 0.26 }, bag: { x: 0.2, y: 0.55, z: -0.7, l: 0.4, h: 0.24 }, screen: { y: 0.15, z: 0.2, w: 0.3 },
    flank: { x: 0.155, y: 0.85, z: 0.15, l: 0.5, h: 0.2 }, top: null, back: null, front: null,
    exh: [[-0.17, 0.36, -0.95], [0.17, 0.36, -0.95]], tails: [[0, 0.9, -0.875]], sub: { x: 0, y: 0.9, z: -0.88, w: 0.26, h: 0.22, d: 0.16 },
    seats: [{ x: 0, z: -0.5, y: 0.9 }], barK: 1, steerMax: 0.5, tipMax: 0.72, track: 0, rearTrack: 0, wheelR: 0.3, len: 1.9,
    chrome(C, m) { C.tube(m, [-0.1, 0.5, 0.0], [-0.1, 0.8, 0.25], 0.012); C.add(m, box(0.26, 0.02, 0.5), 0, 0.97, 0.15); C.add(m, box(0.14, 0.03, 0.03), 0, 0.84, -0.89); C.add(m, box(0.03, 0.12, 0.28), 0.14, 0.4, 0.0); C.add(m, box(0.03, 0.12, 0.28), -0.14, 0.4, 0.0); },
  });
}

// ===================================================================================================================
// THE TAMARRO CAR: a small hatchback, lowered, tinted, flashy rims, a fat exhaust
// ===================================================================================================================
function buildTascia(K, M, P, A) {
  K.spec.tiltPivot = [0, 0.3, 0]; K.spec.barPos = [0, 0.8, 0.4];
  K.group('tilt', [0, 0.3, 0]).group('driver', [0, 0.3, 0]).group('bar', [0, 0.8, 0.4]);
  const T = K.on('tilt'), D = K.on('driver');
  // lower body: slab, long bonnet sloping to the nose, short tail
  T.add(M.body, prism([-0.8, 0.8, -1.78, 1.78], 0.2, [-0.76, 0.76, -1.78, 1.5], 0.62));
  T.add(M.body, prism([-0.76, 0.76, 1.5, 1.78], 0.5, [-0.74, 0.74, 1.62, 1.8], 0.6)); T.add(M.body, prism([-0.74, 0.74, 0.55, 1.5], 0.6, [-0.7, 0.7, 0.62, 1.5], 0.74));
  T.add(M.body, prism([-0.78, 0.78, -1.78, -1.3], 0.6, [-0.72, 0.72, -1.78, -1.4], 0.82));
  // glass house: tinted, with body-coloured roof, pillars and a spoiler-ready tail
  T.add(MAT.tint, prism([-0.68, 0.68, -1.28, 0.58], 0.74, [-0.6, 0.6, -1.0, 0.18], 1.26));
  T.add(M.body, prism([-0.62, 0.62, -1.06, 0.26], 1.24, [-0.6, 0.6, -1.0, 0.18], 1.3));
  for (const sx of [-1, 1]) { T.limb(M.body, [sx * 0.67, 0.76, 0.56], [sx * 0.6, 1.26, 0.2], 0.05); T.limb(M.body, [sx * 0.68, 0.76, -0.3], [sx * 0.6, 1.26, -0.34], 0.05); T.limb(M.body, [sx * 0.68, 0.8, -1.28], [sx * 0.6, 1.26, -1.02], 0.07);
    K.stage = 1; T.add(M.body, box(0.1, 0.07, 0.16), sx * 0.77, 0.9, 0.52, 0, 0.3 * sx); K.stage = null; T.add(MAT.black, box(0.04, 0.04, 0.14), sx * 0.7, 0.64, 0.0); }
  // lamps, grille, bumper lip, plate, tail lights, banner on the windscreen
  for (const sx of [-1, 1]) { T.add(MAT.lamp, box(0.3, 0.1, 0.05), sx * 0.52, 0.55, 1.74, 0, sx * -0.12); T.add(MAT.tail, box(0.3, 0.1, 0.04), sx * 0.52, 0.72, -1.79); }
  T.add(MAT.black, box(0.62, 0.12, 0.05), 0, 0.46, 1.77); T.add(MAT.chrome, box(0.64, 0.02, 0.06), 0, 0.4, 1.78);
  T.add(M.trim, box(1.54, 0.08, 0.2), 0, 0.27, 1.74); T.add(M.trim, box(1.54, 0.1, 0.2), 0, 0.3, -1.76);
  T.add(MAT.white, box(0.42, 0.11, 0.015), 0, 0.5, 1.8); T.add(MAT.white, box(0.42, 0.11, 0.015), 0, 0.52, -1.8);
  // side skirts and arches
  for (const sx of [-1, 1]) T.add(M.trim, box(0.04, 0.09, 1.7), sx * 0.8, 0.27, 0);
  // 4 wheels (the front pair steers); wide tyres under low arches
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    const w = K.wheel(sx * 0.78, 0.29, sz * 1.1, 0.29, 0.2, sz > 0); addWheel(K, w, 'car', P.rims);
    T.add(MAT.dark, cylX(0.36, 0.36, 0.22, 14, false, 0, PI), sx * 0.76, 0.29, sz * 1.1);
  }
  // the bare chassis (what is left after the ZEN): two rails, cross members, a steering wheel and the driver on the floor pan
  for (const sx of [-1, 1]) T.add(MAT.dark, box(0.08, 0.08, 3.3), sx * 0.45, 0.3, 0);
  for (const z of [-1.5, -0.3, 0.8, 1.6]) T.add(MAT.dark, box(1.0, 0.06, 0.08), 0, 0.3, z);
  T.add(MAT.dark, box(0.5, 0.04, 0.9), 0.3, 0.34, -0.2); T.tube(MAT.dark, [0.3, 0.4, 0.55], [0.3, 0.9, 0.2], 0.02); T.add(MAT.dark, tor(0.14, 0.02, 4, 14), 0.3, 0.93, 0.18, -0.9, 0, 0);
  rider(K.on('driver', 0.3, 0, 0), { shirt: '#c9342a', pants: '#3a4660', hip: [0, 0.5, -0.3], sh: [0, 0.92, -0.2], head: [0, 1.08, -0.15], knee: [0.12, 0.56, 0.15], foot: [0.12, 0.36, 0.45], hand: [-0.04, 0.9, 0.2] });
  // the fat stock exhaust: big oval can with a flared tip, right of centre
  T.add(MAT.chrome, cylZ(0.07, 0.085, 0.22, 12, false), 0.5, 0.22, -1.88); T.add(MAT.dark, cylZ(0.05, 0.05, 0.24, 10, false), 0.5, 0.22, -1.88);
  Object.assign(A, {
    kind: 'car', spoil: { y: 1.03, z: -1.74, w: 1.3, h: 0.16 }, neon: { x: 0.72, z0: -1.5, z1: 1.5, y: 0.17 }, glow: { w: 2.9, l: 5.0, z: 0 },
    roof: { y: 1.305, z: -0.02, w: 0.8 }, rack: { y: 1.305, z: -0.6, w: 0.9, l: 0.7 },
    flank: { x: 0.818, y: 0.42, z: -0.1, l: 1.6, h: 0.36 }, top: { y: 1.305, z: -0.4, w: 0.9, l: 1.0 }, hood: { y: 0.745, z: 1.05, w: 1.0, l: 0.8 }, back: { y: 0.7, z: -1.81, w: 1.2, h: 0.3 }, front: null,
    banner: { y: 1.1, z: 0.36, w: 1.16, h: 0.22 },
    exh: [[0.5, 0.22, -1.97], [-0.5, 0.22, -1.97]], tails: [[-0.52, 0.72, -1.8], [0.52, 0.72, -1.8]], sub: { x: 0, y: 0.95, z: -1.1, w: 0.9, h: 0.3, d: 0.4, inCabin: true },
    seats: [{ x: -0.3, z: -0.5, y: 0.7 }, { x: 0.3, z: -0.5, y: 0.7 }], barK: 0, steerMax: 0.5, tipMax: 0, track: 0.78, rearTrack: 0.78, wheelR: 0.29, len: 3.6,
    chrome(C, m) { C.add(m, box(0.8, 0.04, 0.05), 0, 0.46, 1.8); C.add(m, box(1.0, 0.03, 0.04), 0, 0.5, -1.81); for (const sx of [-1, 1]) { C.add(m, box(0.04, 0.03, 1.7), sx * 0.82, 0.34, 0); C.add(m, box(0.1, 0.08, 0.14), sx * 0.77, 0.9, 0.52, 0, 0.3 * sx); } C.add(m, box(0.5, 0.04, 0.04), 0, 0.57, 1.8); },
  });
}


// ===================================================================================================================
// HORSE AND SULKY (calesse da corsa): the vehicle of the "corse clandestine" night event, not in the garage. Cartoon horse, always happy.
// ===================================================================================================================
function buildSulky(K, M, P, A) {
  K.spec.tiltPivot = [0, 0.5, 0]; K.spec.barPos = [0, 1.2, 0.2]; K.spec.len = 3.6;
  K.group('tilt', [0, 0.5, 0]).group('driver', [0, 0.5, 0]).group('bar', [0, 1.2, 0.2]);
  const T = K.on('tilt'), D = K.on('driver'), coat = M.body, cart = M.trim, wood = MAT.wood, blk = MAT.black;
  // the sulky: two big spoked wheels, a light frame, a seat and a footboard, a pink pennant
  for (const sx of [-1, 1]) {
    const w = K.wheel(sx * 0.68, 0.5, -0.65, 0.5, 0.07, false); addWheel(K, w, 'cart', '', M);
    T.add(cart, cylX(0.56, 0.56, 0.1, 14, false, 0, PI), sx * 0.68, 0.5, -0.65);
    T.limb(wood, [sx * 0.34, 0.5, -0.65], [sx * 0.28, 0.98, -0.7], 0.05);
    T.limb(wood, [sx * 0.36, 0.78, -0.95], [sx * 0.4, 0.95, 1.25], 0.055);   // shafts to the horse
  }
  T.add(MAT.dark, cylX(0.03, 0.03, 1.4, 8), 0, 0.5, -0.65);
  T.add(cart, box(0.6, 0.07, 0.44), 0, 0.98, -0.72); T.add(cart, box(0.6, 0.34, 0.05), 0, 1.16, -0.97); T.add(cart, box(0.6, 0.04, 0.6), 0, 0.74, -0.3);
  T.add(wood, box(0.8, 0.05, 0.05), 0, 0.88, 0.5);
  T.tube(MAT.dark, [-0.22, 1.0, -0.98], [-0.22, 1.95, -0.98], 0.014); T.add(colMat('#f27aa8', 0.6), box(0.012, 0.16, 0.34), -0.22, 1.82, -1.16);
  // the jockey, in pink and black silks
  const silk = colMat('#f27aa8', 0.8), skin = colMat('#c58b64', 0.8);
  D.limb(silk, [0, 1.02, -0.72], [0, 1.52, -0.58], 0.34, 0.22); D.add(skin, sph(0.1, 10, 8), 0, 1.7, -0.52);
  D.add(colMat('#141418', 0.5), sph(0.115, 10, 8), 0, 1.74, -0.52, 0, 0, 0, 1, 0.75, 1.1); D.add(colMat('#141418', 0.5), box(0.2, 0.03, 0.12), 0, 1.69, -0.4);
  for (const sx of [-1, 1]) {
    D.limb(colMat('#f4f2ea', 0.8), [sx * 0.12, 1.02, -0.72], [sx * 0.14, 0.92, -0.35], 0.13, 0.13); D.limb(colMat('#f4f2ea', 0.8), [sx * 0.14, 0.92, -0.35], [sx * 0.15, 0.78, 0.0], 0.1, 0.1);
    D.add(MAT.dark, box(0.1, 0.06, 0.2), sx * 0.15, 0.76, 0.06);
    D.limb(silk, [sx * 0.2, 1.46, -0.58], [sx * 0.17, 1.18, -0.2], 0.09, 0.09); D.add(skin, sph(0.04, 6, 5), sx * 0.17, 1.18, -0.2);
    T.tube(MAT.dark, [sx * 0.17, 1.18, -0.2], [sx * 0.1, 1.55, 2.0], 0.008);   // reins
  }
  // the horse: body and head bob, four legs and the tail swing (see rig.pose)
  const bodyA = K.anim('body', [0, 1.1, 0.9], { bob: 0.045 }), B = bodyA;
  B.add(coat, sph(1, 14, 10), 0, 0, 0, 0, 0, 0, 0.3, 0.36, 0.78); B.add(coat, sph(1, 12, 9), 0, 0, 0.62, 0, 0, 0, 0.27, 0.34, 0.4); B.add(coat, sph(1, 12, 9), 0, 0.02, -0.55, 0, 0, 0, 0.28, 0.34, 0.4);
  B.add(cart, box(0.66, 0.08, 0.12), 0, 0.02, 0.2); B.add(cart, box(0.42, 0.04, 0.32), 0, 0.36, 0.15);
  const headA = K.anim('head', [0, 1.35, 1.55], { bob: 0.045, axis: 'x', amp: 0.07, freq: 2, steerY: 0.4 }), H = headA;
  H.tube(coat, [0, 0, 0], [0, 0.5, 0.4], 0.11, 8, 0.2);
  H.limb(coat, [0, 0.55, 0.42], [0, 0.3, 0.8], 0.2, 0.26); H.limb(MAT.dark, [0, 0.32, 0.78], [0, 0.24, 0.92], 0.15, 0.15);
  for (const sx of [-1, 1]) { H.add(MAT.white, box(0.035, 0.06, 0.06), sx * 0.1, 0.5, 0.58); H.add(blk, box(0.04, 0.035, 0.035), sx * 0.115, 0.5, 0.6); H.add(coat, box(0.05, 0.14, 0.05), sx * 0.07, 0.7, 0.4, 0.3); }
  for (let k = 0; k < 5; k++) H.add(blk, box(0.05, 0.12, 0.07), 0, 0.12 + 0.1 * k + 0.05, 0.02 + 0.075 * k - 0.07, 0.4);
  const tailA = K.anim('tail', [0, 1.2, 0.3], { axis: 'x', bias: 0.5, amp: 0.3, freq: 1, phase: 0.6, idle: 0.3 });
  tailA.tube(blk, [0, 0, 0], [0, -0.45, -0.28], 0.05, 6, 0.04); tailA.add(blk, box(0.12, 0.34, 0.1), 0, -0.6, -0.34, 0.5);
  const leg = (nm, x, z, ph) => { const L = K.anim(nm, [x, 0.86, z], { axis: 'x', amp: 0.75, freq: 1, phase: ph });
    L.tube(coat, [0, 0, 0], [0, -0.43, 0.04], 0.07, 6, 0.09); L.tube(coat, [0, -0.43, 0.04], [0, -0.82, 0], 0.05, 6, 0.06); L.add(MAT.dark, box(0.1, 0.07, 0.13), 0, -0.84, 0.02); };
  leg('fl', 0.17, 1.4, 0); leg('fr', -0.17, 1.4, PI * 0.5); leg('hl', 0.17, 0.45, PI); leg('hr', -0.17, 0.45, PI * 1.5);
  Object.assign(A, {
    kind: 'horse', neon: null, glow: { w: 2, l: 4, z: 0.4 }, flank: null, exh: [], tails: [], seats: [{ x: 0, z: -0.7, y: 1.0 }], barK: 0, steerMax: 0.62, tipMax: 0, track: 0.68, rearTrack: 0.68, wheelR: 0.5, len: 3.6,
  });
}

export const BUILD = { sulky: buildSulky, calessino: buildCalessino, cassone: buildCassone, lapa50: buildLapa50, vespa: buildVespa, scooterone: buildScooterone, motorino: buildMotorino, tascia: buildTascia };

// ===================================================================================================================
// PARTS
// ===================================================================================================================
const PINKM = colMat('#f27aa8', 0.45, 0.1);
function decalFlip(T, key, cx, cy, cz, w, h, face, flip) {
  const g = plane(w, h).clone(), [u0, v0, u1, v1] = stkUV(key), uv = g.attributes.uv;
  const a = flip ? u1 : u0, b = flip ? u0 : u1;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? b : a, uv.getY(i) ? v1 : v0);
  const rot = { 'x+': [0, PI / 2, 0], 'x-': [0, -PI / 2, 0], 'z-': [0, PI, 0], 'z+': [0, 0, 0], 'y+': [-PI / 2, 0, 0], 'y+z': [-PI / 2, 0, PI / 2] }[face];
  T.add(MAT.sticker, g, cx, cy, cz, rot[0], rot[1], rot[2]);
}

function addParts(K, M, P, A) {
  const T = K.on('tilt');
  K.stage = 1;   // tuning parts vanish when the ZEN strips the vehicle
  const D = (key, cx, cy, cz, w, h, face, flip) => decalFlip(T, key, cx, cy, cz, w, h, face, flip);
  // --- suspension: the body sits lower or higher on its wheels (applied to the tilt group when the rig is built, see instantiate) ---
  A.drop = P.stance ? (({ lapa: { basso: 0.05, raso: 0.1, alto: -0.08 }, car: { basso: 0.04, raso: 0.08, alto: -0.07 } })[A.kind] || {})[P.stance] || 0 : 0;
  // --- spoiler (alettone) ---
  const S = A.spoil;
  if (P.spoiler && S) {
    const sp = P.spoiler;
    if (sp === 'basso') {
      T.add(M.body, box(S.w, 0.035, 0.14), 0, S.y + 0.03, S.z, -0.1);
      for (const sx of [-1, 1]) T.add(MAT.black, box(0.03, 0.07, 0.16), sx * S.w / 2, S.y + 0.04, S.z);
    } else if (sp === 'anatra') {   // ducktail: a short kicked-up lip on the tail
      T.add(M.body, box(S.w * 0.96, 0.04, 0.2), 0, S.y + 0.07, S.z - 0.03, 0.4);
      for (const sx of [-1, 1]) T.add(MAT.black, box(0.03, 0.1, 0.2), sx * S.w * 0.48, S.y + 0.05, S.z - 0.03, 0.4);
    } else if (sp === 'biplano') {  // two stacked wings on tall end plates
      const w = S.w * 1.1;
      T.add(MAT.black, box(w, 0.04, 0.3), 0, S.y + 0.14, S.z, -0.1); T.add(PINKM, box(w, 0.035, 0.26), 0, S.y + 0.42, S.z - 0.03, -0.18);
      for (const sx of [-1, 1]) { T.add(M.body, box(0.035, 0.5, 0.36), sx * w / 2, S.y + 0.28, S.z); T.limb(MAT.black, [sx * w * 0.3, S.y, S.z + 0.03], [sx * w * 0.3, S.y + 0.4, S.z], 0.04); }
    } else {
      const big = sp === 'gigante', w = S.w * (big ? 1.14 : 1), h = S.h + (big ? 0.32 : 0.1), ch = big ? 0.4 : 0.26;
      T.add(MAT.black, box(w, 0.045, ch), 0, S.y + h, S.z, -0.14);
      if (big) { T.add(PINKM, box(w, 0.03, 0.16), 0, S.y + h + 0.13, S.z - 0.08, -0.5); }
      for (const sx of [-1, 1]) {
        T.add(M.body, box(0.035, big ? 0.28 : 0.16, ch + 0.04), sx * w / 2, S.y + h, S.z);
        T.limb(MAT.black, [sx * w * 0.32, S.y, S.z + 0.03], [sx * w * 0.32, S.y + h, S.z], big ? 0.05 : 0.035);
      }
    }
  }
  // --- underglow neon: self-lit tubes under the body (the ground glow is added when the rig is instantiated) ---
  if (P.neon) {
    const N = A.neon, tube = neonMats(P.neon, (NEON[P.neon] || '#ff2f9e')).tube, mid = (N.z0 + N.z1) / 2, len = N.z1 - N.z0;
    for (const sx of [-1, 1]) T.add(tube, box(0.045, 0.045, len), sx * N.x, N.y, mid);
    if (!N.bike) { T.add(tube, box(N.x * 2, 0.045, 0.045), 0, N.y, N.z0); T.add(tube, box(N.x * 2, 0.045, 0.045), 0, N.y, N.z1); }
  }
  // --- chrome / gold / black / pink trim ---
  if (P.chrome && A.chrome) A.chrome(T, { cromo: MAT.chrome, oro: MAT.gold, nero: MAT.black, rosa: PINKM }[P.chrome] || MAT.chrome);
  // --- exhaust ---
  if (P.exhaust && A.exh) {
    const ex = P.exhaust, k = A.kind === 'car' ? 1.15 : A.kind === 'bike' ? 0.85 : 0.9, n = ex === 'doppio' || ex === 'oro' ? 2 : 1, can = ex === 'oro' ? MAT.gold : MAT.chrome, dz = A.kind === 'car' ? 0.06 : 0;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = A.exh[i];
      if (ex === 'tromba') {   // a big flared trumpet with a dark mouth
        const zc = z + 0.2 * k + dz;
        T.add(MAT.chrome, cylZ(0.06 * k, 0.21 * k, 0.62 * k, 14), x, y + 0.02, zc);
        T.add(MAT.dark, cylZ(0.17 * k, 0.17 * k, 0.03, 12), x, y + 0.02, zc - 0.31 * k - 0.005);
        T.add(MAT.gold, tor(0.2 * k, 0.012, 4, 14), x, y + 0.02, zc - 0.28 * k);
        continue;
      }
      T.add(can, cylZ(0.075 * k, 0.095 * k, 0.5 * k, 12), x, y, z + 0.12 * k + dz);
      T.add(MAT.dark, cylZ(0.055 * k, 0.055 * k, 0.5 * k + 0.02, 10), x, y, z + 0.12 * k - 0.1 + dz);
      if (n === 2) T.add(ex === 'oro' ? MAT.chrome : MAT.gold, tor(0.092 * k, 0.012, 4, 12), x, y, z, 0, 0, 0);
    }
  }
  // --- stickers (original designs) ---
  const F = A.flank;
  if (P.stickers && F) {
    const st = P.stickers;
    if (st === 'palermo') {
      D('palermo', F.x, F.y, F.z, Math.min(F.l, F.h * 5), Math.min(F.l, F.h * 5) / 5.12, 'x+'); D('palermo', -F.x, F.y, F.z, Math.min(F.l, F.h * 5), Math.min(F.l, F.h * 5) / 5.12, 'x-');
      if (A.back) D('palermo', 0, A.back.y, A.back.z, A.back.w, A.back.w / 5.12, 'z-');
      if (A.top) D('palermo', 0, A.top.y, A.top.z, A.top.l, A.top.l / 5.12, 'y+z');
    } else if (st === 'rosanero' || st === 'scacchi') {
      const key = st === 'scacchi' ? 'chequer' : 'stripe', l = F.l, h = l / 9.3;
      D(key, F.x, F.y - F.h * 0.1, F.z, l, h * 1.3, 'x+'); D(key, -F.x, F.y - F.h * 0.1, F.z, l, h * 1.3, 'x-');
      D(key, F.x, F.y + F.h * 0.12, F.z, l, h * 0.8, 'x+'); D(key, -F.x, F.y + F.h * 0.12, F.z, l, h * 0.8, 'x-');
      if (A.top) for (const sx of [-0.14, 0.14]) D(key, sx, A.top.y, A.top.z, A.top.l, 0.12, 'y+z');
      if (A.hood) for (const sx of [-0.14, 0.14]) D(key, sx, A.hood.y, A.hood.z, A.hood.l, 0.12, 'y+z');
    } else if (st === 'trinacria') {
      const hh = Math.min(F.h * 1.05, F.l / 1.42), ww = hh * 1.42;
      D('sun', F.x, F.y, F.z, ww, hh, 'x+'); D('sun', -F.x, F.y, F.z, ww, hh, 'x-');
      if (A.hood) D('sun', 0, A.hood.y, A.hood.z, 0.7, 0.7 / 1.42, 'y+');
      if (A.front) D('sun', 0, A.front.y, A.front.z, A.front.w * 1.42, A.front.h, 'z+');
    } else if (st === 'fiamme') {
      const w = Math.min(F.l * 0.7, 1.3), hh = w * 0.24, z = F.z + F.l * 0.5 - w * 0.5 - 0.02;
      D('flames', F.x, F.y - F.h * 0.1, z, w, hh, 'x+'); D('flames', -F.x, F.y - F.h * 0.1, z, w, hh, 'x-', true);
    } else if (st === 'numero') {   // a race-number roundel on both flanks, the bonnet and the tail
      const d = Math.min(F.h * 1.35, F.l * 0.55, 0.5);
      D('numero', F.x, F.y, F.z, d, d, 'x+'); D('numero', -F.x, F.y, F.z, d, d, 'x-');
      if (A.hood) D('numero', 0, A.hood.y, A.hood.z, 0.5, 0.5, 'y+');
      if (A.back) D('numero', 0, A.back.y, A.back.z, Math.min(d, A.back.w * 0.5), Math.min(d, A.back.w * 0.5), 'z-');
    }
  }
  // --- on the roof: loudspeaker horns, a lit taxi sign, or an aerial with a pink-and-black pennant ---
  const R = A.roof;
  if (P.roof && R) {
    const r = P.roof;
    if (r === 'antenna') {
      const x = R.x != null ? R.x : (R.w || 1) * 0.42, top = R.y + 1.0;
      T.tube(MAT.chrome, [x, R.y, R.z], [x, top, R.z], 0.009, 5); T.add(MAT.chrome, sph(0.02, 6, 5), x, top, R.z);
      T.add(PINKM, box(0.012, 0.08, 0.2), x, top - 0.06, R.z - 0.11); T.add(MAT.black, box(0.012, 0.08, 0.12), x, top - 0.06, R.z - 0.27);
      T.add(MAT.dark, cyl(0.03, 0.03, 0.04, 8), x, R.y + 0.02, R.z);
    } else if (r === 'megafono') {
      T.add(MAT.dark, box(0.62, 0.03, 0.24), 0, R.y + 0.015, R.z);
      for (const sx of [-1, 1]) {
        const hx = sx * 0.22, hy = R.y + 0.17, hz = R.z + 0.08;
        T.add(MAT.alu, cylZ(0.13, 0.05, 0.34, 12), hx, hy, hz); T.add(MAT.dark, cylZ(0.11, 0.11, 0.02, 12), hx, hy, hz + 0.172);
        T.add(MAT.black, cylZ(0.06, 0.06, 0.14, 10), hx, hy, hz - 0.2); T.add(MAT.dark, box(0.04, 0.15, 0.04), hx, R.y + 0.09, R.z);
      }
    } else if (r === 'insegna') {
      T.add(MAT.lamp, box(0.56, 0.17, 0.2), 0, R.y + 0.115, R.z); T.add(MAT.dark, box(0.58, 0.02, 0.22), 0, R.y + 0.215, R.z);
      for (const sx of [-1, 1]) T.add(MAT.dark, box(0.05, 0.03, 0.18), sx * 0.2, R.y + 0.015, R.z);
      D('taxi', 0, R.y + 0.115, R.z + 0.102, 0.42, 0.42 * 110 / 300 * 1.1, 'z+'); D('taxi', 0, R.y + 0.115, R.z - 0.102, 0.42, 0.42 * 110 / 300 * 1.1, 'z-');
    }
  }
  // --- load strapped on the roof rack (or heaped on the cargo bed) ---
  const L = A.rack;
  if (P.load && L) {
    const u = Math.min(1, L.w / 1.1), y = L.y, ld = P.load;
    if (ld === 'casse') {
      const crate = (x, yy, z, w = 0.5, h = 0.28, d = 0.4) => { T.add(MAT.wood, box(w * u, h * u, d * u), x * u, yy, z); T.add(MAT.dark, box((w + 0.01) * u, 0.03, (d + 0.01) * u), x * u, yy + h * u / 2 - 0.02, z); };
      const z0 = L.z, dz = Math.min(0.26, L.l * 0.22);
      crate(-0.27, y + 0.14 * u, z0 + dz); crate(0.27, y + 0.14 * u, z0 + dz); crate(-0.27, y + 0.14 * u, z0 - dz); crate(0.27, y + 0.14 * u, z0 - dz);
      crate(0, y + 0.42 * u, z0, 0.56, 0.28, 0.46);
    } else if (ld === 'valigie') {
      const cs = [colMat('#7a3b2a', 0.7), colMat('#2d4a6b', 0.7), colMat('#c9a23a', 0.7)], z0 = L.z;
      T.add(cs[0], box(0.66 * u, 0.2 * u, 0.44 * u), 0, y + 0.1 * u, z0 + 0.12); T.add(cs[1], box(0.54 * u, 0.18 * u, 0.38 * u), 0.04 * u, y + 0.29 * u, z0 + 0.1, 0, 0.2);
      T.add(cs[2], box(0.16 * u, 0.4 * u, 0.44 * u), -0.28 * u, y + 0.2 * u, z0 - 0.26);
      for (const [x, yy, z] of [[0, y + 0.205 * u, z0 + 0.12], [0.04 * u, y + 0.385 * u, z0 + 0.1]]) T.add(MAT.dark, box(0.16, 0.025, 0.05), x, yy, z);
      for (const sx of [-1, 1]) T.add(MAT.dark, box(0.03, 0.1, L.l * 0.92 + 0.02), sx * 0.34 * u, y + 0.02, z0);   // the rack rails
    } else if (ld === 'materasso') {
      const len = Math.min(L.l, 1.2), mat = colMat('#d7e0f2', 0.95), st = colMat('#8fa9d8', 0.95);
      T.add(mat, box(0.84 * u, 0.16, len), 0, y + 0.1, L.z);
      for (const z of [-0.36, -0.12, 0.12, 0.36]) T.add(st, box(0.85 * u, 0.162, 0.035), 0, y + 0.1, L.z + z * len / 1.1);
      for (const z of [-0.3, 0.3]) T.add(MAT.dark, box(0.88 * u, 0.185, 0.035), 0, y + 0.1, L.z + z * len / 1.1);
      for (const sx of [-1, 1]) T.add(MAT.dark, box(0.03, 0.03, L.l * 0.95), sx * 0.38 * u, y + 0.01, L.z);
    }
  }
  // --- bike luggage: a top box on the tail rack, or saddlebags either side of the rear wheel ---
  const TL = A.tail, BG = A.bag;
  if (P.box === 'bauletto' && TL) {
    const w = TL.w + 0.08;
    T.add(M.body, box(w, 0.3, 0.44), 0, TL.y + 0.17, TL.z); T.add(M.trim || MAT.dark, box(w + 0.012, 0.03, 0.452), 0, TL.y + 0.31, TL.z); T.add(MAT.dark, box(w + 0.01, 0.03, 0.45), 0, TL.y + 0.03, TL.z);
    T.add(MAT.chrome, box(0.16, 0.04, 0.012), 0, TL.y + 0.21, TL.z - 0.225);
  }
  if (P.box === 'borse' && BG) {
    const leather = colMat('#4a3226', 0.85);
    for (const sx of [-1, 1]) { T.add(leather, box(0.14, BG.h, BG.l), sx * BG.x, BG.y, BG.z); T.add(MAT.chrome, box(0.145, 0.03, 0.06), sx * BG.x, BG.y + BG.h * 0.2, BG.z + BG.l * 0.3); T.add(MAT.chrome, box(0.145, 0.03, 0.06), sx * BG.x, BG.y + BG.h * 0.2, BG.z - BG.l * 0.3); }
  }
  // --- windscreen on the handlebar (turns with the bar) ---
  const SC = A.screen;
  if (P.screen && SC) {
    const B = K.on('bar'), tall = P.screen === 'alto', h = tall ? 0.34 : 0.17, y = SC.y + h / 2 * 0.9;
    B.add(MAT.glass, box(SC.w, h, 0.012), 0, y, SC.z, -0.4); B.add(MAT.chrome, box(SC.w + 0.02, 0.015, 0.02), 0, SC.y, SC.z + 0.005);
    for (const sx of [-1, 1]) B.add(MAT.chrome, box(0.012, h, 0.016), sx * SC.w / 2, y, SC.z, -0.4);
  }
  // --- subwoofer: a speaker box on the tail with a woofer cone that pulses (its own group, see rig.cone) ---
  if (P.sub && A.sub) {
    const B = A.sub, z0 = B.z - B.d / 2;
    K.group('sub', [B.x, B.y, B.z]); K.group('cone', [B.x, B.y, z0]);
    const SB = K.on('sub'), CN = K.on('cone');
    SB.add(MAT.black, box(B.w, B.h, B.d)); SB.add(PINKM, box(B.w + 0.01, 0.03, B.d + 0.01), 0, B.h / 2, 0);
    const cr = Math.min(B.w, B.h) * 0.38;
    CN.add(MAT.dark, cylZ(cr, cr * 0.5, 0.07, 14, false), B.x, B.y, z0 - 0.02); CN.add(MAT.chrome, tor(cr, cr * 0.1, 4, 16), B.x, B.y, z0 - 0.052); CN.add(MAT.chrome, cylZ(cr * 0.28, cr * 0.28, 0.05, 8), B.x, B.y, z0 - 0.045);
  }
  // --- the two endgame upgrades: orange floats and an outboard (drive on the sea), feathered wings (fly) ---
  if (P.swim && A.flank) addFloats(T, A);
  if (P.fly && A.flank) addWings(T, M, A);
  K.stage = null;
}
// Floats: a pontoon either side of the wheels on two struts, and a little outboard on the tail with its propeller just above the road (src/vehicle-water.js).
function addFloats(T, A) {
  const F = A.flank, bike = A.kind === 'bike', car = A.kind === 'car', r = bike ? 0.085 : car ? 0.17 : 0.15, xo = F.x + (bike ? 0.36 : 0.3), L = A.len * (bike ? 0.55 : 0.64), z0 = F.z * 0.45, y = 0.2;
  for (const sx of [-1, 1]) {
    T.add(MAT.orange, cylZ(r, r, L - 2 * r, 12), sx * xo, y, z0);
    for (const e of [-1, 1]) T.add(MAT.orange, sph(r, 10, 8), sx * xo, y, z0 + e * (L / 2 - r), 0, 0, 0, 1, 1, e > 0 ? 1.9 : 1.2);
    T.add(MAT.white, tor(r * 1.02, r * 0.18, 5, 14), sx * xo, y, z0 + L * 0.16, 0, PI / 2, 0);
    for (const e of [-0.28, 0.3]) T.limb(MAT.chrome, [sx * (F.x - 0.04), y + 0.16, z0 + L * e], [sx * xo, y + 0.02, z0 + L * e], 0.022);
  }
  const zr = (A.back ? A.back.z : -A.len / 2) - (bike ? 0.28 : 0.2), cow = colMat('#c9342a', 0.5), grey = colMat('#b9bec3', 0.45, 0.3);
  T.add(grey, box(0.24, 0.3, 0.3), 0, 0.64, zr); T.add(cow, box(0.25, 0.1, 0.31), 0, 0.84, zr);
  T.add(MAT.dark, box(0.05, 0.46, 0.1), 0, 0.38, zr - 0.04); T.add(MAT.dark, cyl(0.06, 0.06, 0.16, 8), 0, 0.2, zr - 0.04, 0, 0, PI / 2);
  for (const sx of [-1, 1]) T.add(MAT.chrome, box(0.02, 0.04, 0.12), sx * 0.07, 0.2, zr - 0.04);
  T.add(MAT.dark, box(0.04, 0.04, 0.3), 0, 0.88, zr - 0.2);   // the tiller
}
// Wings: an angel's pair of five-feather fans on the shoulders, white with rosanero tips (src/vehicle-air.js).
function addWings(T, M, A) {
  const F = A.flank, bike = A.kind === 'bike', car = A.kind === 'car', y0 = bike ? 1.2 : car ? 1.05 : F.y + 0.8, x0 = bike ? 0.12 : car ? F.x - 0.04 : F.x - 0.02, z0 = bike ? -0.36 : car ? -0.55 : F.z * 0.4, sc = bike ? 0.8 : 1;
  const LEN = [0.7, 0.95, 1.1, 0.95, 0.72];   // the feathers, top to bottom, in metres
  for (let i = 0; i < 5; i++) {
    const a = 0.95 - i * 0.34, len = LEN[i] * sc;
    for (const sx of [-1, 1]) T.add(i > 2 ? PINKM : MAT.white, box(len, 0.17 * sc, 0.022), sx * (x0 + Math.cos(a) * len / 2), y0 + Math.sin(a) * len / 2, z0 - 0.014 * i, 0, 0, sx * a);
  }
  for (const sx of [-1, 1]) T.add(MAT.dark, box(0.2, 0.16, 0.12), sx * (x0 - 0.02), y0 - 0.02, z0 + 0.04);   // the harness
  A.wing = { x: x0 + Math.cos(0.95 - 2 * 0.34) * LEN[2] * sc, y: y0 + Math.sin(0.95 - 2 * 0.34) * LEN[2] * sc, z: z0 - 0.028 };   // the tip of the longest feather (right wing, mirrored for the left): where src/vehicle-trails.js starts a ribbon
}
export const NEON = Object.fromEntries([['rosa', '#ff2f9e'], ['ciano', '#18e6ff'], ['verde', '#37ff6a'], ['viola', '#9b4dff'], ['ambra', '#ffb020'], ['arcobaleno', '#18e6ff']]);

// ===================================================================================================================
// TEMPLATES AND RIGS
// ===================================================================================================================
const GEO_PARTS = ['spoiler', 'neon', 'chrome', 'rims', 'stickers', 'exhaust', 'sub', 'stance', 'roof', 'load', 'box', 'screen', 'swim', 'fly'];   // the parts that change geometry (not the horn)
const tplKey = l => l.type + '|' + GEO_PARTS.map(k => l.parts[k] || '').join(',');
const tplCache = new Map();
function template(look) {
  const key = tplKey(look); let t = tplCache.get(key);
  if (t) { tplCache.delete(key); tplCache.set(key, t); return t; }   // most recently used last
  const K = new Kit(), A = {}, M = paintedSet(look.type);
  BUILD[look.type](K, M, look.parts, A);
  addParts(K, M, look.parts, A);
  A.type = look.type;
  t = { key, type: look.type, A, groups: K.finish(), wheels: K.wheels, anims: K.anims, spec: { wheelsIn: 'lean', leanMode: 'tip', len: A.len, ...K.spec }, users: 0, tris: 0 };
  for (const name in t.groups) for (const b of t.groups[name]) t.tris += b.geom.attributes.position.count / 3;
  tplCache.set(key, t);
  if (tplCache.size > 14) for (const [k, o] of tplCache) { if (tplCache.size <= 12) break; if (o.users <= 0 && o !== t) { for (const n in o.groups) for (const b of o.groups[n]) b.geom.dispose(); tplCache.delete(k); } }
  return t;
}
export const geoKey = l => tplKey(cleanLook(l));
export const templateStats = look => { const t = template(cleanLook(look)); return { tris: Math.round(t.tris), meshes: Object.values(t.groups).reduce((s, g) => s + g.length, 0) }; };

const _glowGeo = plane(1, 1).clone().rotateX(-PI / 2);
const cl01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
// local: true uses the shared painted materials (recoloured in place by the owner); false gives a private livery copy.
function instantiate(tpl, livery, local) {
  tpl.users++;
  const map = local ? null : clonedSet(tpl.type, livery), mat = m => (map && map.get(m)) || m;
  const sp = tpl.spec, tp = sp.tiltPivot, A = tpl.A;
  const root = new THREE.Group(), lean = new THREE.Group(), tilt = new THREE.Group(), meshes = [];
  root.add(lean); lean.add(tilt); tilt.position.set(tp[0], tp[1] - (A.drop || 0), tp[2]);   // A.drop: lowered or lifted suspension
  const fill = (parent, list) => { if (!list) return; for (const b of list) { const m = new THREE.Mesh(b.geom, mat(b.mat)); m.castShadow = b.shadow; parent.add(m); meshes.push(m); } };
  const Pm = { tilt }, stripObjs = [];
  const driver = Pm.driver = new THREE.Group(); tilt.add(driver);
  const bar = Pm.bar = new THREE.Group(); bar.position.set(sp.barPos[0] - tp[0], sp.barPos[1] - tp[1], sp.barPos[2] - tp[2]); tilt.add(bar);
  let sub = null, cone = null;
  if (tpl.groups.sub) { const B = A.sub; sub = Pm.sub = new THREE.Group(); sub.position.set(B.x - tp[0], B.y - tp[1], B.z - tp[2]); tilt.add(sub);
    cone = Pm.cone = new THREE.Group(); cone.position.set(B.x - tp[0], B.y - tp[1], B.z - B.d / 2 - tp[2]); tilt.add(cone); stripObjs.push(sub, cone); }
  const wheels = tpl.wheels.map((w, i) => {
    const pivot = Pm['w' + i] = new THREE.Group(), spin = Pm['w' + i + 's'] = new THREE.Group(), spinner = Pm['w' + i + 'x'] = new THREE.Group();
    if (sp.wheelsIn === 'tilt') { pivot.position.set(w.x - tp[0], w.y - tp[1], w.z - tp[2]); tilt.add(pivot); } else { pivot.position.set(w.x, w.y, w.z); lean.add(pivot); }
    pivot.add(spin); pivot.add(spinner);
    return { pivot, spin, spinner, front: w.front, r: w.r };
  });
  // animated limbs (the horse)
  const anims = (tpl.anims || []).map(a => { const g = Pm['a:' + a.name] = new THREE.Group(); g.position.set(a.origin[0] - tp[0], a.origin[1] - tp[1], a.origin[2] - tp[2]); tilt.add(g); return { g, oy: g.position.y, ...a }; });
  for (const name in tpl.groups) {
    const i = name.indexOf('#'), base = i < 0 ? name : name.slice(0, i), parent = Pm[base]; if (!parent) continue;
    if (i < 0) fill(parent, tpl.groups[name]);
    else { const sg = new THREE.Group(); parent.add(sg); fill(sg, tpl.groups[name]); stripObjs.push(sg); }   // meshes the ZEN strips off
  }
  // underglow decal on the road: a soft additive quad that does not lean with the body (one extra draw call, no lights)
  let glow = null;
  const neonId = tpl.key.split('|')[1].split(',')[GEO_PARTS.indexOf('neon')];
  if (neonId && A.glow) {
    const g = A.glow;
    glow = new THREE.Mesh(_glowGeo, neonMats(neonId, NEON[neonId] || '#ff2f9e').glow);
    glow.scale.set(g.w, 1, g.l); glow.position.set(0, 0.06, g.z); glow.renderOrder = 2; glow.frustumCulled = false; root.add(glow); stripObjs.push(glow);
  }
  const tipMax = A.tipMax, steerK = A.steerMax / 0.62, track = A.track, bank = sp.leanMode === 'bank';
  const rig = {
    root, lean, tilt, bar, wheels, meshes, driver, sub, cone, glow, A, PIV: tp[1], tipMax, kind: A.kind, type: tpl.type, livery, tpl, stripped: false,
    // pose({ pitch, roll, lean (-1..1, sign = side), steer (rad), spin (rad), t (seconds, for spinners), speed (m/s, for the horse's gait), lockRear })
    pose(p) {
      tilt.rotation.set(p.pitch || 0, 0, p.roll || 0);
      const l = p.lean || 0;
      if (bank) { lean.rotation.z = -l * tipMax; lean.position.set(0, 0, 0); }
      else if (tipMax) { const th = l * tipMax, px = -track * Math.sign(l); lean.rotation.z = th; lean.position.set(px * (1 - Math.cos(th)), -px * Math.sin(th), 0); }
      const st = (p.steer || 0) * steerK;
      for (const w of wheels) { if (w.front) w.pivot.rotation.y = st; if (!(p.lockRear && !w.front)) w.spin.rotation.x = p.spin || 0; w.spinner.rotation.x = (p.spin || 0) * 0.45 + (p.t || 0) * 2.4; }
      bar.rotation.y = st * A.barK * (bank ? 1.3 : 1);
      if (anims.length) {
        const gp = (p.spin || 0) * 0.4, sa = p.speed == null ? 1 : cl01(p.speed / 4), tt = p.t || 0;
        for (const a of anims) {
          const k = Math.max(sa, a.idle || 0), ph = gp * (a.freq || 1) + (a.phase || 0);
          if (a.axis) a.g.rotation[a.axis] = (a.bias || 0) + (a.amp || 0) * k * Math.sin(ph) + (a.idle ? 0.04 * Math.sin(tt * 2.1) : 0);
          if (a.steerY) a.g.rotation.y = st * a.steerY;
          if (a.bob) a.g.position.y = a.oy + a.bob * sa * Math.abs(Math.sin(gp)) + 0.012 * Math.sin(tt * 2.4);
        }
      }
    },
    // the ZEN gag: hide everything but the frame, the wheels and the driver (the meshes tagged with a strip stage)
    setStripped(b) { rig.stripped = !!b; for (const o of stripObjs) o.visible = !b; },
    dispose() { tpl.users--; if (root.parent) root.parent.remove(root); },
  };
  return rig;
}

// Public: a model of any vehicle for any look: { type, livery, parts: { spoiler: 'gt', neon: 'rosa', ... } }. The caller poses it with rig.pose().
export function buildVehicleModel(look) { const l = cleanLook(look); return instantiate(template(l), l.livery, false); }
// The local car's rig: painted with the shared materials (recolour them with repaint()), so a livery change does not rebuild anything.
export function buildLocalRig(look) { const l = cleanLook(look); paintSet(l.type, paintedSet(l.type), l.livery); const rig = instantiate(template(l), l.livery, true); driver.dress(rig); return rig; }   // driver.dress: the player's own driver in a lapa (src/driver.js)
export function repaint(type, livery) { return paintSet(type, paintedSet(type), livery); }
export { tickShared } from './vehicle-art.js';
