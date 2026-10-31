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

function wheel(b, x, z, r, w = 0.2, seg = 8) {
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
function apeFood() {
  const b = new MB(); apeBase(b, WHITE);
  b.box(-0.72, 0.72, 0.4, 0.46, -1.58, -0.12, DARK);
  b.prism([-0.73, 0.73, -1.58, -0.14], 0.46, [-0.7, 0.7, -1.55, -0.16], 1.95, col('#efe3c8'), 1);   // kitchen box
  b.box(-0.74, 0.74, 1.95, 2.03, -1.6, -0.1, col('#9a1b22'));
  b.box(0.74, 0.745, 1.1, 1.65, -1.4, -0.4, DARK);                                                   // hatch (left side, kerb side is the right)
  for (let i = 0; i < 6; i++) b.hexa([[-0.74, 1.62, -1.45 + i * 0.26], [-0.74, 1.62, -1.2 + i * 0.26], [-0.74, 1.6, -1.2 + i * 0.26], [-0.74, 1.6, -1.45 + i * 0.26],
    [-1.4, 1.38, -1.45 + i * 0.26], [-1.4, 1.38, -1.2 + i * 0.26], [-1.4, 1.36, -1.2 + i * 0.26], [-1.4, 1.36, -1.45 + i * 0.26]], i % 2 ? WHITE : col('#c42a2a'), 0);
  b.box(-1.2, -0.74, 0.95, 1.0, -1.35, -0.4, col('#9a9a96'));                                     // counter
  b.box(-0.08, 0.08, 2.03, 2.2, -0.75, -0.55, DARK); b.box(-0.2, 0.2, 2.2, 2.35, -0.9, -0.4, DARK); // loudspeaker
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
function carrozza() {
  const b = new MB(), blk = col('#17171a'), red = col('#6e1a22');
  horse(b, 2.55, false);
  b.box(-0.55, 0.55, 0.5, 0.56, -1.2, 1.3, blk);                              // chassis
  b.prism([-0.52, 0.52, -1.1, 1.3], 0.56, [-0.55, 0.55, -1.1, 1.3], 1.15, blk);  // body
  b.box(-0.5, 0.5, 1.15, 1.45, -1.0, 0.25, red);                                // passenger seat
  b.box(-0.5, 0.5, 1.15, 1.85, -1.05, -0.9, red);                               // back rest
  b.wedge(-0.52, 0.52, 1.5, -1.12, 2.2, 0.05, 1.95, blk, 0, 0.04);             // folded canopy
  b.box(-0.45, 0.45, 1.15, 1.5, 0.55, 1.15, col('#2d2118'));                    // coachman's box
  b.box(-0.14, 0.14, 1.5, 1.95, 0.7, 0.95, blk); b.box(-0.1, 0.1, 1.95, 2.18, 0.74, 0.92, SKIN);  // driver
  b.cyl(0, 2.2, 0.83, 0.12, 0.22, blk, 0, 6, 'y'); b.cyl(0, 2.2, 0.83, 0.17, 0.03, blk, 0, 6, 'y');
  for (const s of [1, -1]) {
    b.cyl(s * 0.6, 0.66, -0.5, 0.66, 0.06, red, 0, 12); b.cyl(s * 0.6, 0.66, -0.5, 0.1, 0.1, blk, 0, 6);
    b.cyl(s * 0.6, 0.46, 1.0, 0.46, 0.06, red, 0, 10); b.cyl(s * 0.6, 0.46, 1.0, 0.08, 0.1, blk, 0, 6);
    b.box(s * 0.45 - 0.02, s * 0.45 + 0.02, 0.85, 0.89, 1.3, 2.8, blk);        // shafts
  }
  b.box(-0.03, 0.03, 1.55, 1.85, 1.21, 1.27, col('#e0b64a'));                   // lantern
  const g = b.geometry(); g.translate(0, 0, -1.9); return g;
}
function carretto() {
  const b = new MB(), yel = col('#e3b324'), red = col('#b3201a'), blue = col('#2a5b9a'), grn = col('#2f7a46'), blk = col('#17171a');
  horse(b, 2.2, true);
  b.box(-0.68, 0.68, 0.82, 0.9, -1.15, 1.0, yel);                                // floor
  for (const s of [1, -1]) {
    b.box(s * 0.68 - 0.03, s * 0.68 + 0.03, 0.9, 1.4, -1.15, 1.0, yel);
    const x = s * 0.72;
    b.box(x - 0.015, x + 0.015, 0.98, 1.32, -1.05, -0.5, red); b.box(x - 0.02, x + 0.02, 1.05, 1.25, -0.95, -0.6, blue);
    b.box(x - 0.015, x + 0.015, 0.98, 1.32, -0.4, 0.15, grn); b.box(x - 0.02, x + 0.02, 1.05, 1.25, -0.3, 0.05, yel);
    b.box(x - 0.015, x + 0.015, 0.98, 1.32, 0.25, 0.9, red); b.box(x - 0.02, x + 0.02, 1.05, 1.25, 0.35, 0.8, blue);
    b.cyl(s * 0.82, 0.72, -0.1, 0.72, 0.07, yel, 0, 12); b.cyl(s * 0.82, 0.72, -0.1, 0.55, 0.075, red, 0, 12);
    b.cyl(s * 0.82, 0.72, -0.1, 0.12, 0.12, blk, 0, 6);
    b.box(s * 0.82 - 0.04, s * 0.82 + 0.04, 0.12, 1.32, -0.13, -0.07, yel); b.box(s * 0.82 - 0.04, s * 0.82 + 0.04, 0.69, 0.75, -0.8, 0.6, yel);
    b.box(s * 0.4 - 0.025, s * 0.4 + 0.025, 0.95, 1.0, 1.0, 2.2, blk);          // shafts
  }
  b.box(-0.6, 0.6, 1.4, 1.46, -1.15, -1.05, red);
  b.box(-0.3, 0.3, 1.0, 1.35, 0.4, 0.9, col('#8a1f1a'));                          // driver's bench
  b.box(-0.12, 0.12, 1.35, 1.8, 0.45, 0.7, col('#24323f')); b.box(-0.09, 0.09, 1.8, 2.02, 0.48, 0.67, SKIN);
  b.box(-0.17, 0.17, 2.02, 2.1, 0.44, 0.72, blk);
  const g = b.geometry(); g.translate(0, 0, -1.5); return g;
}

export function buildModels() {
  const g = b => b.geometry ? b.geometry() : b;
  return {
    panda: g(hatch(PANDA)), punto: g(hatch(PUNTO)), smart: g(hatch(SMART)), taxi: g(taxi()), van: g(van()), bus: g(bus()),
    vespa: g(scooter(true)), vespaB: g(scooter(false)),
    apePick: g(apePick('')), apeCrate: g(apePick('crates')), apeFood: g(apeFood()),
    carrozza: carrozza(), carretto: carretto(),
  };
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
