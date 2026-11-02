// Traffic vehicle models, built in code at PS2 level (a few hundred to ~1500 triangles each).
// Local frame: +z is forward, +y up, origin at the centre of the footprint on the ground,
// the driver's right is -x. Each model is one non-indexed geometry with per-vertex colour and a
// `tint` attribute: 1 = multiplied by the per-instance colour (body paint), 0 = fixed colour.
import * as THREE from 'three';

const cc = new Map();
const col = h => { let c = cc.get(h); if (!c) cc.set(h, c = new THREE.Color(h)); return c; };

class MB {
  constructor() { this.p = []; this.c = []; this.t = []; }
  // Convex planar face given in boundary order; winding is corrected to face away from ctr.
  face(vs, ctr, c, tint) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < vs.length; i++) { // Newell normal
      const a = vs[i], b = vs[(i + 1) % vs.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const a = vs[0];
    const o = nx * (a[0] - ctr[0]) + ny * (a[1] - ctr[1]) + nz * (a[2] - ctr[2]) < 0 ? vs.slice().reverse() : vs;
    for (let i = 1; i < o.length - 1; i++) for (const v of [o[0], o[i], o[i + 1]]) {
      this.p.push(v[0], v[1], v[2]); this.c.push(c.r, c.g, c.b); this.t.push(tint);
    }
  }
  // Hexahedron: P[0..3] bottom ring, P[4..7] top ring in the same order.
  hexa(P, c, tint = 0) {
    const ctr = [0, 1, 2].map(k => P.reduce((s, q) => s + q[k], 0) / 8);
    for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
      this.face(f.map(i => P[i]), ctr, c, tint);
  }
  box(x0, x1, y0, y1, z0, z1, c, tint = 0) { this.prism([x0, x1, z0, z1], y0, [x0, x1, z0, z1], y1, c, tint); }
  // Rectangles r = [x0, x1, z0, z1] at heights y0 (bottom) and y1 (top).
  prism(r, y0, s, y1, c, tint = 0) {
    this.hexa([[r[0], y0, r[2]], [r[1], y0, r[2]], [r[1], y0, r[3]], [r[0], y0, r[3]],
      [s[0], y1, s[2]], [s[1], y1, s[2]], [s[1], y1, s[3]], [s[0], y1, s[3]]], c, tint);
  }
  // Box whose top slopes from height yA at zA to yB at zB (hoods, boot lids, wedges).
  wedge(x0, x1, yBase, zA, yA, zB, yB, c, tint = 0, inset = 0) {
    this.hexa([[x0, yBase, zA], [x1, yBase, zA], [x1, yBase, zB], [x0, yBase, zB],
      [x0 + inset, yA, zA], [x1 - inset, yA, zA], [x1 - inset, yB, zB], [x0 + inset, yB, zB]], c, tint);
  }
  // Cylinder along x (wheels). axis 'y' gives a vertical one (hats, poles).
  cyl(cx, cy, cz, r, len, c, tint = 0, seg = 8, axis = 'x') {
    const ring = s => {
      const out = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2 + Math.PI / seg, u = Math.cos(a) * r, v = Math.sin(a) * r;
        out.push(axis === 'x' ? [cx + s * len / 2, cy + u, cz + v] : [cx + u, cy + s * len / 2, cz + v]);
      }
      return out;
    };
    const A = ring(-1), B = ring(1), ctr = [cx, cy, cz];
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.face([A[i], A[j], B[j], B[i]], ctr, c, tint); }
    this.face(A, ctr, c, tint); this.face(B, ctr, c, tint);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('tint', new THREE.Float32BufferAttribute(this.t, 1));
    g.computeVertexNormals(); // non-indexed: flat shading, which is what we want
    return g;
  }
}

const TYRE = col('#151517'), HUB = col('#a7aaae'), DARK = col('#222326'), GLASS = col('#27343d'), WHITE = col('#ffffff'),
  LAMP = col('#f1eedd'), TAIL = col('#9a1b1b'), SKIN = col('#c79a74'), BLACK = col('#161617');

let LITE_WHEELS = false;   // parked cars (buildParkedModels): the hub is only the disc on the outer face, not a second cylinder
function wheel(b, x, z, r, w = 0.2, seg = 8) {
  if (LITE_WHEELS) {
    b.cyl(x, r, z, r, w, TYRE, 0, seg);
    const xo = x + Math.sign(x) * (w / 2 + 0.012), rr = r * 0.58, ring = [];
    for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2 + Math.PI / seg; ring.push([xo, r + Math.cos(a) * rr, z + Math.sin(a) * rr]); }
    b.face(ring, [x, r, z], HUB, 0);
    return;
  }
  b.cyl(x, r, z, r, w, TYRE, 0, seg);
  b.cyl(x + Math.sign(x) * 0.012, r, z, r * 0.58, w, HUB, 0, seg);
}

// ---------- cars ----------
function hatch(o) {
  const b = new MB(), hw = o.W / 2, f = o.L / 2, belt = o.belt, H = o.H, a = hw - 0.04;
  b.box(-hw + 0.1, hw - 0.1, 0.16, 0.36, -f + 0.2, f - 0.2, DARK);
  b.prism([-hw, hw, -f, f], 0.30, [-hw + 0.03, hw - 0.03, -f + 0.04, f - 0.04], belt, WHITE, 1);
  b.wedge(-a, a, belt, o.zc1, belt + 0.15, f - 0.04, belt + 0.05, WHITE, 1, 0.03);        // bonnet
  if (o.trunk) b.wedge(-a, a, belt, -f + 0.04, belt + 0.1, o.zc0, belt + 0.03, WHITE, 1, 0.03); // boot lid
  // glasshouse: dark glass loft, body-coloured roof and pillars
  const g = hw - 0.04, ti = o.ti;
  b.hexa([[-g, belt, o.zc0], [g, belt, o.zc0], [g, belt, o.zc1], [-g, belt, o.zc1],
    [-g + ti, H - 0.04, o.zr0], [g - ti, H - 0.04, o.zr0], [g - ti, H - 0.04, o.zr1], [-g + ti, H - 0.04, o.zr1]], GLASS, 0);
  b.prism([-g + ti - 0.02, g - ti + 0.02, o.zr0 - 0.03, o.zr1 + 0.03], H - 0.06, [-g + ti + 0.02, g - ti - 0.02, o.zr0 - 0.03, o.zr1 + 0.03], H, WHITE, 1);
  for (const s of [1, -1]) for (const [zb, zt] of [[o.zc1, o.zr1], [o.zc0, o.zr0]]) {
    const xb = s * (g + 0.01), xt = s * (g - ti + 0.01), xi = s * 0.06;
    b.hexa([[xb, belt, zb - 0.05], [xb - xi, belt, zb - 0.05], [xb - xi, belt, zb + 0.05], [xb, belt, zb + 0.05],
      [xt, H - 0.05, zt - 0.05], [xt - xi, H - 0.05, zt - 0.05], [xt - xi, H - 0.05, zt + 0.05], [xt, H - 0.05, zt + 0.05]], WHITE, 1);
  }
  // bumpers, lamps, grille, plates
  b.box(-hw + 0.02, hw - 0.02, 0.3, 0.56, f - 0.14, f + 0.03, DARK);
  b.box(-hw + 0.02, hw - 0.02, 0.3, 0.56, -f - 0.03, -f + 0.14, DARK);
  for (const s of [1, -1]) {
    b.box(s * 0.5 - 0.17, s * 0.5 + 0.17, belt - 0.26, belt - 0.06, f - 0.02, f + 0.03, LAMP);
    b.box(s * (hw - 0.22) - 0.17, s * (hw - 0.22) + 0.17, belt - 0.28, belt - 0.04, -f - 0.03, -f + 0.02, TAIL);
    b.box(s * (hw + 0.08) - 0.04, s * (hw + 0.08) + 0.04, belt + 0.1, belt + 0.22, o.zc1 - 0.2, o.zc1 - 0.02, DARK); // mirrors
  }
  b.box(-0.26, 0.26, belt - 0.2, belt - 0.07, f - 0.02, f + 0.04, DARK);
  b.box(-0.25, 0.25, 0.32, 0.4, -f - 0.04, -f + 0.01, col('#e9e6d8'));
  const wz = f - o.ov;
  for (const s of [1, -1]) for (const z of [wz, -wz]) wheel(b, s * (hw - 0.1), z, o.wr, 0.2);
  return b;
}
const PANDA = { L: 3.65, W: 1.64, H: 1.55, belt: 0.90, zc0: -1.72, zc1: 0.42, zr0: -1.62, zr1: 0.12, ti: 0.17, ov: 0.55, wr: 0.29 };
const PUNTO = { L: 4.06, W: 1.69, H: 1.48, belt: 0.88, zc0: -1.78, zc1: 0.62, zr0: -1.45, zr1: 0.18, ti: 0.2, ov: 0.62, wr: 0.30 };
const SMART = { L: 2.69, W: 1.56, H: 1.55, belt: 0.92, zc0: -1.25, zc1: 0.62, zr0: -1.15, zr1: 0.38, ti: 0.15, ov: 0.40, wr: 0.27 };
const SEDAN = { L: 4.5, W: 1.78, H: 1.46, belt: 0.92, zc0: -0.95, zc1: 0.62, zr0: -0.62, zr1: 0.05, ti: 0.22, ov: 0.85, wr: 0.31, trunk: true };

function taxi() {
  const b = hatch(SEDAN);
  b.box(-0.27, 0.27, SEDAN.H, SEDAN.H + 0.17, -0.12, 0.2, col('#f0e7b8'));
  b.box(-0.28, 0.28, SEDAN.H + 0.05, SEDAN.H + 0.1, -0.125, 0.205, BLACK);
  b.box(-0.04, 0.04, SEDAN.H, SEDAN.H + 0.01, -0.1, 0.1, DARK);
  // dark side band so it reads as a taxi from a distance
  for (const s of [1, -1]) b.box(s * 0.89 - 0.005, s * 0.89 + 0.005, 0.6, 0.72, -1.9, 1.9, col('#d8d2c0'));
  return b;
}

function van() {
  const b = new MB(), hw = 0.91, f = 2.225;
  b.box(-hw + 0.1, hw - 0.1, 0.16, 0.4, -f + 0.2, f - 0.2, DARK);
  b.prism([-hw, hw, -f, f], 0.32, [-hw + 0.03, hw - 0.03, -f + 0.04, f - 0.04], 1.0, WHITE, 1);
  b.prism([-hw + 0.02, hw - 0.02, -f + 0.02, 0.35], 1.0, [-hw + 0.06, hw - 0.06, -f + 0.04, 0.33], 1.92, WHITE, 1); // cargo box
  b.wedge(-hw + 0.04, hw - 0.04, 1.0, 1.1, 1.14, f - 0.04, 1.05, WHITE, 1, 0.03);                                    // bonnet
  b.hexa([[-hw + 0.04, 1.0, 0.35], [hw - 0.04, 1.0, 0.35], [hw - 0.04, 1.0, 1.15], [-hw + 0.04, 1.0, 1.15],
    [-hw + 0.17, 1.84, 0.35], [hw - 0.17, 1.84, 0.35], [hw - 0.17, 1.84, 0.8], [-hw + 0.17, 1.84, 0.8]], GLASS, 0);
  b.prism([-hw + 0.15, hw - 0.15, 0.3, 0.84], 1.8, [-hw + 0.17, hw - 0.17, 0.3, 0.82], 1.87, WHITE, 1);
  for (const s of [1, -1]) {
    b.hexa([[s * (hw - 0.03), 1.0, 1.1], [s * (hw - 0.09), 1.0, 1.1], [s * (hw - 0.09), 1.0, 1.2], [s * (hw - 0.03), 1.0, 1.2],
      [s * (hw - 0.15), 1.84, 0.75], [s * (hw - 0.21), 1.84, 0.75], [s * (hw - 0.21), 1.84, 0.85], [s * (hw - 0.15), 1.84, 0.85]], WHITE, 1);
    b.box(s * (hw + 0.09) - 0.04, s * (hw + 0.09) + 0.04, 1.25, 1.5, 1.0, 1.1, DARK);
    b.box(s * 0.5 - 0.17, s * 0.5 + 0.17, 0.72, 0.9, f - 0.02, f + 0.03, LAMP);
    b.box(s * (hw - 0.1) - 0.05, s * (hw - 0.1) + 0.05, 0.75, 1.3, -f - 0.02, -f + 0.02, TAIL);
    for (const z of [1.38, -1.3]) wheel(b, s * (hw - 0.1), z, 0.32, 0.21);
  }
  b.box(-hw + 0.02, hw - 0.02, 0.3, 0.6, f - 0.14, f + 0.04, DARK);
  b.box(-hw + 0.02, hw - 0.02, 0.3, 0.55, -f - 0.04, -f + 0.14, DARK);
  b.box(-0.3, 0.3, 0.55, 0.9, f - 0.02, f + 0.04, DARK);
  return b;
}

function bus() {
  const b = new MB(), hw = 1.25, f = 5.9;
  b.box(-hw + 0.1, hw - 0.1, 0.3, 0.55, -f + 0.3, f - 0.3, DARK);
  b.prism([-hw, hw, -f, f], 0.45, [-hw + 0.02, hw - 0.02, -f + 0.04, f - 0.04], 1.45, WHITE, 1);          // skirt and waist
  b.prism([-hw + 0.02, hw - 0.02, -f + 0.04, f - 0.04], 2.42, [-hw + 0.1, hw - 0.1, -f + 0.1, f - 0.1], 3.0, WHITE, 1); // roof edge
  b.box(-hw + 0.1, hw - 0.1, 1.45, 2.42, -f + 0.08, f - 0.08, WHITE, 1);                                   // window-line core
  for (const s of [1, -1]) {
    b.box(s * (hw - 0.04), s * (hw + 0.006), 1.55, 2.38, -f + 0.5, f - 0.7, GLASS);                        // side windows
    for (let z = -4.7; z <= 4.8; z += 1.55) b.box(s * (hw - 0.05), s * (hw + 0.014), 1.5, 2.4, z - 0.07, z + 0.07, WHITE, 1); // pillars
    b.box(s * (hw - 0.03), s * (hw + 0.012), 0.7, 2.35, 3.7, 4.95, col('#3b4650'));                        // door leaves
    b.box(s * (hw - 0.03), s * (hw + 0.012), 0.7, 2.35, -0.55, 0.7, col('#3b4650'));
    b.box(s * (hw + 0.2) - 0.05, s * (hw + 0.2) + 0.05, 1.7, 2.3, f - 0.55, f - 0.4, DARK);               // mirrors
    b.box(s * 0.78 - 0.2, s * 0.78 + 0.2, 0.75, 1.0, f - 0.03, f + 0.03, LAMP);
    b.box(s * (hw - 0.14) - 0.06, s * (hw - 0.14) + 0.06, 0.75, 1.35, -f - 0.03, -f + 0.02, TAIL);
    for (const z of [3.7, -3.4]) wheel(b, s * (hw - 0.14), z, 0.5, 0.3, 10);
  }
  b.box(-hw + 0.2, hw - 0.2, 1.2, 2.7, f - 0.02, f + 0.02, GLASS);                                         // windscreen
  b.box(-1.0, 1.0, 2.7, 3.0, f - 0.02, f + 0.03, BLACK);                                                   // destination display housing
  b.box(-hw + 0.05, hw - 0.05, 0.9, 1.0, -f + 0.1, f - 0.1, col('#30302f'));                               // dark lower skirt band
  b.box(-hw + 0.15, hw - 0.15, 0.4, 0.8, f - 0.15, f + 0.07, DARK);                                         // bumper
  b.box(-hw + 0.15, hw - 0.15, 0.4, 0.8, -f - 0.07, -f + 0.15, DARK);
  b.box(-hw + 0.3, hw - 0.3, 1.6, 2.35, -f - 0.02, -f + 0.02, GLASS);                                      // rear window
  b.box(-hw + 0.1, hw - 0.1, 3.0, 3.09, -f + 0.15, f - 0.15, col('#d9d8d3'));                              // pale roof
  b.box(-0.75, 0.75, 3.09, 3.4, -4.2, -1.0, col('#c8c8c4'));                                              // air conditioning pod
  b.box(-0.6, 0.6, 3.09, 3.22, 1.2, 3.0, col('#c8c8c4'));
  return b;
}

// ---------- two and three wheelers ----------
function scooter(helmet) {
  const b = new MB(), JEANS = col('#37445f'), JACKET = helmet ? col('#23262e') : col('#d9d4c6');
  wheel(b, 0, 0.62, 0.25, 0.1, 8); wheel(b, 0, -0.58, 0.24, 0.12, 8);
  b.box(-0.2, 0.2, 0.28, 0.4, -0.15, 0.5, DARK);                       // floor
  b.wedge(-0.19, 0.19, 0.3, 0.38, 0.35, 0.58, 1.05, WHITE, 1, 0);      // leg shield
  b.box(-0.17, 0.17, 0.32, 0.55, 0.55, 0.88, WHITE, 1);                // front mudguard
  b.prism([-0.22, 0.22, -0.88, -0.1], 0.3, [-0.19, 0.19, -0.84, -0.14], 0.74, WHITE, 1); // engine cowl
  b.box(-0.16, 0.16, 0.74, 0.84, -0.7, 0.02, col('#2a2a2c'));         // seat
  b.box(-0.36, 0.36, 1.0, 1.06, 0.44, 0.52, DARK);                     // handlebar
  b.box(-0.08, 0.08, 1.02, 1.17, 0.5, 0.62, LAMP);
  b.box(-0.07, 0.07, 0.62, 0.7, -0.92, -0.86, TAIL);
  // rider
  for (const s of [1, -1]) {
    b.box(s * 0.2 - 0.06, s * 0.2 + 0.06, 0.78, 0.9, -0.3, 0.25, JEANS);  // thigh
    b.box(s * 0.2 - 0.06, s * 0.2 + 0.06, 0.34, 0.9, 0.2, 0.3, JEANS);    // shin
    b.box(s * 0.28 - 0.045, s * 0.28 + 0.045, 1.03, 1.34, -0.04, 0.46, JACKET); // arm
  }
  b.wedge(-0.2, 0.2, 0.88, -0.4, 1.46, -0.02, 1.4, JACKET, 0, 0);   // torso, leaning a touch
  b.box(-0.09, 0.09, 1.46, 1.68, -0.24, -0.04, SKIN);
  if (helmet) b.box(-0.115, 0.115, 1.55, 1.76, -0.28, 0.0, col('#e9e7e1'));
  else b.box(-0.095, 0.095, 1.62, 1.72, -0.26, -0.03, col('#241a14'));
  return b;
}

function apeBase(b, cabBody) {
  const hw = 0.7;
  b.box(-0.55, 0.55, 0.22, 0.4, -1.55, 1.1, DARK);
  wheel(b, 0, 1.05, 0.23, 0.12, 8);
  for (const s of [1, -1]) wheel(b, s * 0.7, -0.95, 0.25, 0.14, 8);
  b.box(-0.2, 0.2, 0.4, 0.52, 0.85, 1.4, cabBody, 1);                       // front mudguard
  b.prism([-0.62, 0.62, -0.12, 1.2], 0.4, [-0.52, 0.52, 0.02, 0.9], 1.55, cabBody, 1); // cab
  b.hexa([[-0.44, 0.95, 1.13], [0.44, 0.95, 1.13], [0.44, 0.95, 1.2], [-0.44, 0.95, 1.2],
    [-0.44, 1.5, 0.84], [0.44, 1.5, 0.84], [0.44, 1.5, 0.9], [-0.44, 1.5, 0.9]], GLASS, 0); // windscreen
  for (const s of [1, -1]) b.box(s * 0.58 - 0.005, s * 0.58 + 0.04, 0.95, 1.45, 0.0, 0.8, GLASS);
  b.box(-0.58, 0.58, 1.55, 1.6, -0.02, 0.92, cabBody, 1);
  b.box(-0.1, 0.1, 0.62, 0.72, 1.17, 1.24, LAMP);
  b.box(-0.3, 0.3, 0.3, 0.45, 1.05, 1.15, DARK);
}
// The fruit seller: crates stepped up towards the back with oranges, lemons, tomatoes and melons on top, a striped parasol, a chalkboard.
function apeFrutta() {
  const b = new MB(); apeBase(b, WHITE);
  b.box(-0.72, 0.72, 0.4, 0.46, -1.58, -0.12, col('#6a5a45'));
  const wood = col('#a9783a'), fruit = [col('#e8892a'), col('#e9d23a'), col('#c8372a'), col('#5e9a3a'), col('#f0a32e'), col('#d6c136')];
  const tiers = [[-0.28, 0.46, 0.3], [-0.78, 0.46, 0.5], [-1.28, 0.46, 0.7]];   // z centre, y0, height of the stack
  let k = 0;
  for (const [z, y0, h] of tiers) for (const x of [-0.37, 0.37]) {
    b.box(x - 0.33, x + 0.33, y0, y0 + h, z - 0.22, z + 0.22, wood);                      // the crates
    b.box(x - 0.34, x + 0.34, y0 + h * 0.5 - 0.02, y0 + h * 0.5 + 0.02, z - 0.23, z + 0.23, col('#7a5226'));   // a slat
    for (const dz of [-0.11, 0.11]) for (const dx of [-0.17, 0.17]) b.box(x + dx - 0.12, x + dx + 0.12, y0 + h, y0 + h + 0.13, z + dz - 0.09, z + dz + 0.09, fruit[(k++) % fruit.length]);
  }
  b.box(-0.18, 0.18, 0.46, 0.78, -1.5, -1.42, col('#c9b7a0'));
  for (const sx of [-1, 1]) b.box(sx * 0.7 - 0.02, sx * 0.7 + 0.02, 0.46, 1.9, -1.5, -1.46, col('#6e5a3c'));   // poles
  b.cyl(0, 2.2, -0.85, 1.25, 0.06, col('#d8372a'), 0, 12, 'y'); b.cyl(0, 2.25, -0.85, 0.8, 0.06, col('#f1ece0'), 0, 12, 'y'); b.cyl(0, 2.3, -0.85, 0.35, 0.06, col('#d8372a'), 0, 12, 'y');   // the parasol
  b.box(-0.03, 0.03, 0.46, 2.2, -0.88, -0.82, col('#6e5a3c'));                                           // its pole
  b.box(0.745, 0.76, 0.75, 1.2, -1.2, -0.45, col('#2d3a2f'));                                            // chalkboard (kerb side)
  return b;
}
// Sfincione and pane e panelle: a cream kitchen box, a stack of trays under a glass lid, a red and yellow awning, a loudspeaker on the roof.
function apeSfincione() {
  const b = new MB(); apeBase(b, WHITE);
  b.box(-0.72, 0.72, 0.4, 0.46, -1.58, -0.12, DARK);
  b.prism([-0.73, 0.73, -1.58, -0.14], 0.46, [-0.7, 0.7, -1.55, -0.16], 1.5, col('#f4ecd6'), 1);
  b.box(-0.74, 0.74, 1.5, 1.58, -1.6, -0.1, col('#e0a82a'));
  b.box(-0.6, 0.6, 1.58, 1.62, -1.5, -0.2, col('#9cc4cf'));                                               // glass lid
  for (let i = 0; i < 3; i++) b.box(-0.55, 0.55, 1.62 + i * 0.1, 1.68 + i * 0.1, -1.45, -0.25, i % 2 ? col('#c9531f') : col('#d8742a'));   // trays of sfincione
  b.box(0.74, 0.745, 0.95, 1.4, -1.45, -0.3, col('#2b2e2a'));                                             // hatch
  for (let i = 0; i < 5; i++) b.hexa([[-0.74, 1.4, -1.45 + i * 0.28], [-0.74, 1.4, -1.2 + i * 0.28], [-0.74, 1.38, -1.2 + i * 0.28], [-0.74, 1.38, -1.45 + i * 0.28],
    [-1.35, 1.14, -1.45 + i * 0.28], [-1.35, 1.14, -1.2 + i * 0.28], [-1.35, 1.12, -1.2 + i * 0.28], [-1.35, 1.12, -1.45 + i * 0.28]], i % 2 ? col('#e0a82a') : col('#c42a2a'), 0);   // the awning
  b.box(-1.15, -0.74, 0.92, 0.97, -1.3, -0.4, col('#9a9a96'));                                           // counter
  horn(b, 0, 1.98, -0.9);
  return b;
}
function apePick(load) {
  const b = new MB(); apeBase(b, WHITE);
  b.box(-0.72, 0.72, 0.4, 0.46, -1.58, -0.12, col('#6a5a45'));
  b.box(-0.74, -0.7, 0.46, 0.88, -1.58, -0.12, WHITE, 1); b.box(0.7, 0.74, 0.46, 0.88, -1.58, -0.12, WHITE, 1);
  b.box(-0.74, 0.74, 0.46, 0.88, -1.6, -1.56, WHITE, 1);
  b.box(-0.74, 0.74, 0.46, 1.15, -0.16, -0.12, WHITE, 1);
  if (load === 'crates') {
    const cs = ['#c9822a', '#b8442a', '#6d8a3a', '#d8b04a'];
    let i = 0;
    for (const z of [-1.25, -0.62]) for (const x of [-0.37, 0.37]) {
      const h = i % 3 === 0 ? 2 : 1; i++;
      for (let l = 0; l < h; l++) b.box(x - 0.33, x + 0.33, 0.46 + l * 0.3, 0.74 + l * 0.3, z - 0.28, z + 0.28, col(cs[(i + l) % 4]));
    }
  } else if (load === 'tarp') {
    b.wedge(-0.7, 0.7, 0.46, -1.5, 1.05, -0.2, 1.25, col('#4a6f8c'), 0, 0.18);
  }
  return b;
}
// A roof loudspeaker: a post, a driver box and a horn flaring towards the front (the vendors' Apes call out of it, src/vendors.js)
function horn(b, x, y, z) {
  const g = col('#8c8f94'), d = col('#26272a');
  b.box(x - 0.04, x + 0.04, y, y + 0.14, z - 0.04, z + 0.04, d);
  b.box(x - 0.12, x + 0.12, y + 0.14, y + 0.34, z - 0.22, z - 0.02, d);
  b.hexa([[x - 0.1, y + 0.16, z - 0.02], [x + 0.1, y + 0.16, z - 0.02], [x + 0.1, y + 0.32, z - 0.02], [x - 0.1, y + 0.32, z - 0.02],
    [x - 0.28, y + 0.06, z + 0.5], [x + 0.28, y + 0.06, z + 0.5], [x + 0.28, y + 0.42, z + 0.5], [x - 0.28, y + 0.42, z + 0.5]], g, 0);
  b.box(x - 0.22, x + 0.22, y + 0.12, y + 0.36, z + 0.5, z + 0.52, d);
}
function apeFood() {
  const b = new MB(); apeBase(b, WHITE);
  b.box(-0.72, 0.72, 0.4, 0.46, -1.58, -0.12, DARK);
  b.prism([-0.73, 0.73, -1.58, -0.14], 0.46, [-0.7, 0.7, -1.55, -0.16], 1.95, col('#efe3c8'), 1);   // kitchen box
  b.box(-0.74, 0.74, 1.95, 2.03, -1.6, -0.1, col('#9a1b22'));
  b.box(0.74, 0.745, 1.1, 1.65, -1.4, -0.4, DARK);                                                   // hatch (left side, kerb side is the right)
  for (let i = 0; i < 6; i++) b.hexa([[-0.74, 1.62, -1.45 + i * 0.26], [-0.74, 1.62, -1.2 + i * 0.26], [-0.74, 1.6, -1.2 + i * 0.26], [-0.74, 1.6, -1.45 + i * 0.26],
    [-1.4, 1.38, -1.45 + i * 0.26], [-1.4, 1.38, -1.2 + i * 0.26], [-1.4, 1.36, -1.2 + i * 0.26], [-1.4, 1.36, -1.45 + i * 0.26]], i % 2 ? WHITE : col('#c42a2a'), 0);
  b.box(-1.2, -0.74, 0.95, 1.0, -1.35, -0.4, col('#9a9a96'));                                     // counter
  horn(b, 0, 2.03, -1.05);   // roof loudspeaker
  b.box(0.745, 0.76, 1.0, 1.5, -1.35, -0.45, col('#2d3a2f'));                                       // menu board
  return b;
}

// ---------- horse-drawn ----------
function horse(b, z0, plume) {
  const zf = z0 + 1.6, leg = col('#33261d'), mane = col('#1a1410');
  b.prism([-0.27, 0.27, z0, zf], 0.95, [-0.24, 0.24, z0 + 0.05, zf - 0.05], 1.7, WHITE, 1);
  for (const s of [1, -1]) for (const z of [z0 + 0.2, zf - 0.22]) {
    b.box(s * 0.13 - 0.055, s * 0.13 + 0.055, 0.08, 1.0, z - 0.06, z + 0.06, leg);
    b.box(s * 0.13 - 0.06, s * 0.13 + 0.06, 0, 0.1, z - 0.07, z + 0.09, BLACK);
  }
  b.hexa([[-0.14, 1.1, zf - 0.3], [0.14, 1.1, zf - 0.3], [0.14, 1.1, zf + 0.1], [-0.14, 1.1, zf + 0.1],
    [-0.09, 2.08, zf + 0.15], [0.09, 2.08, zf + 0.15], [0.09, 2.08, zf + 0.45], [-0.09, 2.08, zf + 0.45]], WHITE, 1);          // neck
  b.hexa([[-0.09, 1.78, zf + 0.35], [0.09, 1.78, zf + 0.35], [0.07, 1.78, zf + 0.85], [-0.07, 1.78, zf + 0.85],
    [-0.1, 2.14, zf + 0.38], [0.1, 2.14, zf + 0.38], [0.07, 1.9, zf + 0.85], [-0.07, 1.9, zf + 0.85]], WHITE, 1);                 // head
  b.box(-0.03, 0.03, 1.5, 2.16, zf - 0.12, zf + 0.2, mane);
  b.box(-0.09, -0.05, 2.12, 2.26, zf + 0.35, zf + 0.4, mane); b.box(0.05, 0.09, 2.12, 2.26, zf + 0.35, zf + 0.4, mane);
  b.box(-0.04, 0.04, 0.85, 1.55, z0 - 0.14, z0 + 0.02, mane);
  b.box(-0.255, 0.255, 1.0, 1.72, zf - 0.55, zf - 0.45, col('#2a1c14')); // harness
  b.box(-0.17, 0.17, 1.1, 1.8, zf - 0.28, zf - 0.12, col('#2a1c14'));    // collar
  if (plume) { b.box(-0.03, 0.03, 2.2, 2.55, zf + 0.34, zf + 0.4, col('#c0262c')); b.box(-0.2, 0.2, 1.74, 1.8, z0 + 0.3, zf - 0.6, col('#c0262c')); }
}
// tour: the carrozza of the tourist loop (src/carrozze.js): no modelled coachman (a sprite sits on the box), the hood folded behind the seat so the passengers sit in the open, red plume, brass lamps
function carrozza(tour = false) {
  const b = new MB(), blk = col('#17171a'), red = col('#6e1a22');
  horse(b, 2.55, tour);
  b.box(-0.55, 0.55, 0.5, 0.56, -1.2, 1.3, blk);                              // chassis
  b.prism([-0.52, 0.52, -1.1, 1.3], 0.56, [-0.55, 0.55, -1.1, 1.3], 1.15, blk);  // body
  b.box(-0.5, 0.5, 1.15, 1.45, -1.0, 0.25, red);                                // passenger seat
  b.box(-0.5, 0.5, 1.15, 1.85, -1.05, -0.9, red);                               // back rest
  if (tour) b.wedge(-0.5, 0.5, 1.3, -1.32, 2.05, -1.04, 1.7, blk, 0, 0.03); else b.wedge(-0.52, 0.52, 1.5, -1.12, 2.2, 0.05, 1.95, blk, 0, 0.04);   // folded canopy
  b.box(-0.45, 0.45, 1.15, 1.5, 0.55, 1.15, col('#2d2118'));                    // coachman's box
  if (!tour) { b.box(-0.14, 0.14, 1.5, 1.95, 0.7, 0.95, blk); b.box(-0.1, 0.1, 1.95, 2.18, 0.74, 0.92, SKIN);  // driver
    b.cyl(0, 2.2, 0.83, 0.12, 0.22, blk, 0, 6, 'y'); b.cyl(0, 2.2, 0.83, 0.17, 0.03, blk, 0, 6, 'y'); }
  if (tour) for (const s of [1, -1]) { b.box(s * 0.5 - 0.04, s * 0.5 + 0.04, 1.5, 1.78, 0.5, 0.6, col('#e0b64a')); b.box(s * 0.5 - 0.03, s * 0.5 + 0.03, 1.78, 1.84, 0.51, 0.59, col('#fff2b0')); }   // brass lamps on the box
  for (const s of [1, -1]) {
    b.cyl(s * 0.6, 0.66, -0.5, 0.66, 0.06, red, 0, 12); b.cyl(s * 0.6, 0.66, -0.5, 0.1, 0.1, blk, 0, 6);
    b.cyl(s * 0.6, 0.46, 1.0, 0.46, 0.06, red, 0, 10); b.cyl(s * 0.6, 0.46, 1.0, 0.08, 0.1, blk, 0, 6);
    b.box(s * 0.45 - 0.02, s * 0.45 + 0.02, 0.85, 0.89, 1.3, 2.8, blk);        // shafts
  }
  b.box(-0.03, 0.03, 1.55, 1.85, 1.21, 1.27, col('#e0b64a'));                   // lantern
  const g = b.geometry(); g.translate(0, 0, -1.9); return g;
}
// ---------- the carretto siciliano (c6): a painted Sicilian cart with a decorated horse ----------
// Yellow wheels with red spokes, a yellow box with its side boards, front and back painted in the decal (carrettoDecalGeometry, texture in assets/traffic/carretto-art.js),
// a carved red and blue undercarriage, and a horse in a plumed headdress, red pompons, a blue saddle cloth and brass bells. About 1.7k triangles. A carrettiere (LPC sprite) sits on the bench.
const CT = { y0: 0.86, z0: -1.2, z1: 1.0, hw: 0.64, wy: 0.72, wz: -0.08, wx: 0.84, HZ: 2.35, SH: -1.75 };   // floor height, body ends, half width, wheel centre and radius, horse start, the shift that centres the model
function ringSeg(b, x, cy, cz, r0, r1, a0, a1, t, c) {   // a piece of a wheel's rim, between radii r0 and r1 and angles a0 and a1, 2t thick across x
  const pt = (xx, r, a) => [xx, cy + Math.cos(a) * r, cz + Math.sin(a) * r];
  b.hexa([pt(x - t, r0, a0), pt(x - t, r0, a1), pt(x - t, r1, a1), pt(x - t, r1, a0), pt(x + t, r0, a0), pt(x + t, r0, a1), pt(x + t, r1, a1), pt(x + t, r1, a0)], c, 0);
}
function spoke(b, x, cy, cz, r0, r1, a, w, t, c) {   // a straight spoke from radius r0 to r1 at angle a, w wide, 2t thick
  const ca = Math.cos(a), sa = Math.sin(a), tx = -sa * w, tz = ca * w, pt = (xx, r, k) => [xx, cy + ca * r + tx * k, cz + sa * r + tz * k];
  b.hexa([pt(x - t, r0, -1), pt(x - t, r0, 1), pt(x - t, r1, 1), pt(x - t, r1, -1), pt(x + t, r0, -1), pt(x + t, r0, 1), pt(x + t, r1, 1), pt(x + t, r1, -1)], c, 0);
}
function cartWheel(b, x, cy, cz, r, yel, red) {
  const n = 10, ink = col('#16161a');
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; ringSeg(b, x, cy, cz, r * 0.86, r, a0, a1 + 0.02, 0.05, yel); ringSeg(b, x, cy, cz, r * 0.78, r * 0.86, a0, a1 + 0.02, 0.03, red); }
  for (let i = 0; i < 6; i++) spoke(b, x, cy, cz, 0.08, r * 0.82, i / 6 * Math.PI * 2 + 0.26, 0.032, 0.03, red);
  b.cyl(x, cy, cz, 0.1, 0.2, yel, 0, 8); b.cyl(x + Math.sign(x) * 0.1, cy, cz, 0.05, 0.05, red, 0, 6); b.cyl(x, cy, cz, 0.03, 0.4, ink, 0, 5);
}
function carretto() {
  const b = new MB(), yel = col('#eab81c'), red = col('#c0261c'), blue = col('#274f94'), grn = col('#2c7a45'), blk = col('#17171a'), wood = col('#7a4a26'), gold = col('#e0b64a'), wht = col('#f3efe2');
  const { y0, z0, z1, hw, wy, wz, wx, HZ } = CT;
  horse(b, HZ, true);
  // the horse's finery: a tall plume of three feathers on the poll, red pompons down the neck, a blue saddle cloth with a yellow edge, brass bells on a red sash, blinkers
  const zf = HZ + 1.6;
  b.box(-0.05, 0.05, 2.2, 2.85, zf + 0.3, zf + 0.42, red); b.box(-0.04, 0.04, 2.5, 3.1, zf + 0.22, zf + 0.34, wht); b.box(-0.035, 0.035, 2.4, 2.95, zf + 0.42, zf + 0.54, yel);
  for (const s2 of [1, -1]) { b.wedge(s2 * 0.1 - 0.025, s2 * 0.1 + 0.025, 2.2, zf + 0.3, 2.3, zf + 0.42, 2.7, red, 0, 0); b.wedge(s2 * 0.2 - 0.02, s2 * 0.2 + 0.02, 2.18, zf + 0.3, 2.26, zf + 0.42, 2.55, wht, 0, 0); }
  b.box(-0.09, 0.09, 2.14, 2.24, zf + 0.3, zf + 0.46, red);
  for (let i = 0; i < 4; i++) b.box(-0.045, 0.045, 1.98 - i * 0.14, 2.06 - i * 0.14, zf - 0.16 - i * 0.1, zf - 0.07 - i * 0.1, red);
  b.box(-0.3, 0.3, 1.6, 1.74, HZ + 0.5, HZ + 1.1, blue); b.box(-0.3, 0.3, 1.58, 1.62, HZ + 0.5, HZ + 1.1, yel); b.box(-0.31, 0.31, 1.52, 1.6, HZ + 0.5, HZ + 0.56, red);
  for (const s of [1, -1]) { b.box(s * 0.3 - 0.015, s * 0.3 + 0.015, 1.2, 1.5, HZ + 0.7, HZ + 0.76, red); b.box(s * 0.3 - 0.03, s * 0.3 + 0.03, 1.12, 1.2, HZ + 0.69, HZ + 0.77, gold); b.box(s * 0.12 - 0.02, s * 0.12 + 0.02, 1.9, 2.0, zf + 0.5, zf + 0.58, blk); }
  b.box(-0.04, 0.04, 1.74, 1.82, HZ + 0.7, HZ + 0.78, gold);
  // body: floor, side boards that lean out, a back board and the dashboard in front, rails on top
  b.box(-hw, hw, y0 - 0.06, y0, z0, z1, yel);
  for (const s of [1, -1]) {
    b.hexa([[s * (hw - 0.04), y0, z0], [s * (hw - 0.04), y0, z1], [s * (hw + 0.02), y0, z1], [s * (hw + 0.02), y0, z0], [s * (hw + 0.05), y0 + 0.52, z0], [s * (hw + 0.05), y0 + 0.52, z1], [s * (hw + 0.11), y0 + 0.52, z1], [s * (hw + 0.11), y0 + 0.52, z0]], yel, 0);
    b.box(s * (hw + 0.1) - 0.045, s * (hw + 0.1) + 0.045, y0 + 0.5, y0 + 0.58, z0 - 0.03, z1 + 0.03, red);          // top rail
    for (const z of [z0, z1]) b.box(s * (hw + 0.08) - 0.06, s * (hw + 0.08) + 0.06, y0 - 0.04, y0 + 0.56, z - 0.07, z + 0.07, red);   // corner posts
    b.box(s * (hw + 0.02) - 0.02, s * (hw + 0.02) + 0.02, y0 - 0.14, y0 - 0.06, z0 + 0.1, z1 - 0.1, blue);          // the carved skirt under the boards
    for (let k = 0; k < 7; k++) b.box(s * (hw + 0.02) - 0.025, s * (hw + 0.02) + 0.025, y0 - 0.2, y0 - 0.12, z0 + 0.18 + k * 0.3, z0 + 0.34 + k * 0.3, k % 2 ? red : grn);
    b.box(s * wx - 0.04, s * wx + 0.04, wy - 0.05, wy + 0.05, wz - 0.07, wz + 0.07, blk);                             // axle ends
    b.box(s * 0.4 - 0.025, s * 0.4 + 0.025, y0 + 0.08, y0 + 0.14, z1, HZ + 0.9, wood);                                // shafts to the horse
    cartWheel(b, s * wx, wy, wz, 0.72, yel, red);
  }
  b.box(-hw - 0.1, hw + 0.1, y0 - 0.02, y0 + 0.5, z0 - 0.07, z0 - 0.02, yel);                                          // back board
  b.box(-hw - 0.1, hw + 0.1, y0 + 0.5, y0 + 0.58, z0 - 0.09, z0 - 0.0, red);
  b.box(-hw - 0.1, hw + 0.1, y0 - 0.02, y0 + 0.5, z1 + 0.02, z1 + 0.07, yel);                                          // dashboard
  b.box(-hw - 0.1, hw + 0.1, y0 + 0.5, y0 + 0.58, z1 + 0.0, z1 + 0.09, red);
  b.box(-0.12, 0.12, y0 - 0.16, y0 - 0.06, z0 + 0.05, z1 - 0.05, red);                                                 // central beam
  b.box(-0.07, 0.07, y0 - 0.12, y0 - 0.04, wz - 0.04, wz + 0.04, blk); b.box(-wx, wx, wy - 0.03, wy + 0.03, wz - 0.03, wz + 0.03, blk);   // axle
  b.box(-0.5, 0.5, y0 + 0.2, y0 + 0.26, z1 - 0.5, z1 - 0.1, wood);                                                      // the carrettiere's plank
  b.box(-0.5, 0.5, y0 + 0.26, y0 + 0.56, z1 - 0.1, z1 - 0.05, wood);
  b.box(-0.2, 0.2, y0 + 0.02, y0 + 0.5, z0 + 0.35, z0 + 0.7, col('#b9892b')); b.box(-0.18, 0.18, y0 + 0.5, y0 + 0.62, z0 + 0.38, z0 + 0.66, col('#8a1f1a'));   // crates and a sack on the floor
  const g = b.geometry(); g.translate(0, 0, CT.SH); return g;
}
// Where the painted boards go: the two sides, the dashboard facing the horse and the back board. uv rects (u0, v0, u1, v1) of the 512 x 256 texture, v up.
export const CARRETTO_UV = { side: [0, 0.5, 1, 1], front: [0, 0, 0.5, 0.5], back: [0.5, 0, 1, 0.5] };
export function carrettoDecalGeometry() {
  const { y0, z0, z1, hw } = CT, p = [], uv = [], n = [];
  const quad = (a, bb, c, d, r, flip, nx, ny, nz) => {   // a b c d counter-clockwise seen from the normal side; uv from rect r (a bottom left, b bottom right ...)
    const [u0, v0, u1, v1] = r, U = flip ? [u1, u0, u0, u1] : [u0, u1, u1, u0], V = [v0, v0, v1, v1];
    for (const k of [0, 1, 2, 0, 2, 3]) { const q = [a, bb, c, d][k]; p.push(q[0], q[1], q[2] + CT.SH); uv.push(U[k], V[k]); n.push(nx, ny, nz); }
  };
  for (const s of [1, -1]) {
    const fx = h => hw + 0.02 + 0.09 * h / 0.52 + 0.012, ya = y0 + 0.04, yb = y0 + 0.46, x0 = s * fx(0.04), x1 = s * fx(0.46), e = 0, za = z0 + 0.08, zb = z1 - 0.08, nn = Math.hypot(0.09, 0.52), nx = s * 0.52 / nn, ny = -0.09 / nn;
    // the board leans out: its outer face goes from x0 (bottom) to x1 (top); looking at it from outside the front (+z) is on the left for the +x side
    if (s > 0) quad([x0 + e, ya, zb], [x0 + e, ya, za], [x1 + e, yb, za], [x1 + e, yb, zb], CARRETTO_UV.side, true, nx, ny, 0);
    else quad([x0 + e, ya, za], [x0 + e, ya, zb], [x1 + e, yb, zb], [x1 + e, yb, za], CARRETTO_UV.side, false, nx, ny, 0);
  }
  quad([-hw - 0.04, y0 + 0.02, z1 + 0.098], [hw + 0.04, y0 + 0.02, z1 + 0.098], [hw + 0.04, y0 + 0.46, z1 + 0.098], [-hw - 0.04, y0 + 0.46, z1 + 0.098], CARRETTO_UV.front, false, 0, 0, 1);
  quad([hw + 0.04, y0 + 0.02, z0 - 0.078], [-hw - 0.04, y0 + 0.02, z0 - 0.078], [-hw - 0.04, y0 + 0.46, z0 - 0.078], [hw + 0.04, y0 + 0.46, z0 - 0.078], CARRETTO_UV.back, false, 0, 0, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}
export const CARRETTO = CT;
export const carrettoModel = () => carretto();   // the cart and its horse as one geometry (the standing one, src/carretto.js, uses it too)

export function buildModels() {
  const g = b => b.geometry ? b.geometry() : b;
  return {
    panda: g(hatch(PANDA)), punto: g(hatch(PUNTO)), smart: g(hatch(SMART)), taxi: g(taxi()), van: g(van()), bus: g(bus()),
    vespa: g(scooter(true)), vespaB: g(scooter(false)),
    apePick: g(apePick('')), apeCrate: g(apePick('crates')), apeFood: g(apeFood()), apeFrutta: g(apeFrutta()), apeSfincione: g(apeSfincione()),
    carrozza: carrozza(), carrozzaTour: carrozza(true), carretto: carretto(),
  };
}

// The four cars that also stand parked along the kerbs (src/props.js: hundreds of them), a fifth lighter in triangles (wheel hubs).
export function buildParkedModels() {
  LITE_WHEELS = true;
  try { const g = b => b.geometry ? b.geometry() : b; return { panda: g(hatch(PANDA)), punto: g(hatch(PUNTO)), smart: g(hatch(SMART)), van: g(van()) }; } finally { LITE_WHEELS = false; }
}

// One material for every vehicle. Vertex colour gives the fixed parts; the instance colour only
// multiplies vertices whose `tint` attribute is 1 (the paintwork), so glass and tyres stay put.
const V4 = !THREE.ShaderChunk.color_pars_vertex.includes('vec3 vColor');
export function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tint;')
      .replace('#include <color_vertex>',
        // vColor became a vec4 in r180: initialise it as one when this three.js has the vec4 chunk
        `${V4 ? 'vColor = vec4(1.0);' : 'vColor = vec3(1.0);'}\n#ifdef USE_COLOR\nvColor.rgb *= color.rgb;\n#endif\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb *= mix(vec3(1.0), instanceColor.xyz, tint);\n#endif`);
  };
  m.customProgramCacheKey = () => 'traffic-tint';
  return m;
}

// LED destination displays for the bus: front, and both sides. Each quad has uv 0..1; the shader
// picks the atlas row from the per-instance `row` attribute (see traffic.js).
export function busSignGeometry() {
  const p = [], uv = [], f = 5.9, hw = 1.25;
  const quad = (a, b, c, d) => { p.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
  quad([-0.92, 2.72, f + 0.036], [0.92, 2.72, f + 0.036], [0.92, 2.98, f + 0.036], [-0.92, 2.98, f + 0.036]);               // front, faces +z
  quad([hw + 0.012, 2.46, 3.4], [hw + 0.012, 2.46, 5.2], [hw + 0.012, 2.7, 5.2], [hw + 0.012, 2.7, 3.4]);                  // left side (+x), faces +x
  quad([-hw - 0.012, 2.46, 5.2], [-hw - 0.012, 2.46, 3.4], [-hw - 0.012, 2.7, 3.4], [-hw - 0.012, 2.7, 5.2]);              // right side (-x), faces -x
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export { MB, col, wheel, hatch, bus, apePick, SEDAN, PUNTO, PANDA, DARK, GLASS, WHITE, BLACK, LAMP, TAIL, SKIN };
