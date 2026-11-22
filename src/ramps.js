// Ramps: wedges standing in the streets that the lapa can drive up and leave the ground from (the air physics of the sphere model, src/vehicle-sphere.js).
// Two kinds, both one rigid piece with a height profile along its length: a plain "rampa" (a steel kicker) and a parked car transporter trailer, whose loading
// ramp leads up on to the bed and on to the rise over the cab. The surface is absolute (a base height plus the profile), so a ramp on a sloping street stays one solid
// piece; the base is the lowest ground under its footprint and is looked up again every half second while the tiles around it improve.
//
// The physics asks surfaceAt(x, z) (the height of the top, or NaN when there is no ramp there) and the sphere model takes the higher of the ground and that.
// The meshes are two merged geometries (one per kind, built once, all ramps of a kind in one draw call each) that are only visible within SEE metres.
// Each piece stands on the right of its street as road works do: barrier boards on both flanks from 6 m before the foot to 3 m after the lip, cones, a "lavori in corso" sign
// on its pole, and the boards on the traffic side are walls for the lapa. The traffic steers round the whole zone (it sees it as one long parked obstacle, zonesNear below) and no
// car is parked inside it (src/props.js reads the same list, src/ramp-spots.js).
// ?ramp=x,z,th[,kind][;x,z,th...] puts ramps there instead (screenshots, tests); kind is 'ramp' or 'truck'.
import * as THREE from 'three';
import { makeMaterial } from '../assets/traffic/models.js';
import { KINDS, placed, ZONE_BEFORE, ZONE_AFTER } from './ramp-spots.js';   // where they stand and the shapes (shared with the props and the traffic)

const SEE = 450, EDGE = 0.3;   // metres: drawn within SEE, the sides fall away over EDGE

export function createRamps(env) {
  const { scene, camera, groundY, walls2d } = env;
  const zones = placed(), list = zones.map(p => ({ x: p.x, z: p.z, th: p.th, kind: p.kind }));
  const q = new URLSearchParams(location.search).get('ramp');   // ?ramp=x,z,th[,kind];...
  if (q) { list.length = 0; for (const t of q.split(';')) { const [x, z, th, kind] = t.split(','); list.push({ x: +x, z: +z, th: +th || 0, kind: kind || 'ramp' }); } }
  for (const r of list) {
    const K = KINDS[r.kind]; r.K = K; r.L = K.profile[K.profile.length - 1][0]; r.hw = K.w / 2;
    r.sn = Math.sin(r.th); r.cs = Math.cos(r.th); r.base = NaN; r.reach = Math.hypot(r.L, r.hw) + 1;
  }
  // the lowest ground under the footprint, so the foot of the ramp is never in the air
  function lowest(r) {
    let y = 1e9;
    for (const s of [0, r.L * 0.5, r.L]) for (const t of [-r.hw, 0, r.hw]) y = Math.min(y, groundY(r.x + r.sn * s + r.cs * t, r.z + r.cs * s - r.sn * t));
    return y - 0.02;
  }
  const heightAt = (K, s) => {
    const p = K.profile; if (s < p[0][0] || s > p[p.length - 1][0]) return NaN;
    for (let i = 1; i < p.length; i++) if (s <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
    return p[p.length - 1][1];
  };
  // absolute height of the top at (x, z), or NaN: for the physics. A handful of ramps, so a plain loop after a cheap distance test.
  function surfaceAt(x, z) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i], dx = x - r.x, dz = z - r.z;
      if (dx > r.reach || dx < -r.reach || dz > r.reach || dz < -r.reach || r.base !== r.base) continue;
      const s = dx * r.sn + dz * r.cs, t = Math.abs(dx * r.cs - dz * r.sn);
      if (t > r.hw) continue;
      const h = heightAt(r.K, s); if (h !== h) continue;
      return r.base + h * Math.min(1, (r.hw - t) / EDGE);
    }
    return NaN;
  }

  // ---------- the meshes ----------
  const mat = makeMaterial();
  const C = { steel: [0.95, 0.72, 0.05], steelD: [0.42, 0.3, 0.06], stripe: [0.13, 0.13, 0.14], dark: [0.12, 0.12, 0.13], bed: [0.38, 0.42, 0.5], bedS: [0.7, 0.72, 0.76], tyre: [0.06, 0.06, 0.07], red: [0.7, 0.12, 0.1] };
  function geo(kind) {
    const K = KINDS[kind], P = [], Cc = [], hw = K.w / 2, p = K.profile, L = p[p.length - 1][0];
    const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) Cc.push(...col); };
    const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
    const box = (x0, x1, y0, y1, z0, z1, col) => {   // local x lateral, y up, z forward
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
    };
    const cyl = (cx, cy, cz, r, w, col) => {   // a wheel with its axle along x
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, y0 = cy + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, y1 = cy + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
        quad([cx - w, y0, z0], [cx - w, y1, z1], [cx + w, y1, z1], [cx + w, y0, z0], col);
        tri([cx + w, cy, cz], [cx + w, y0, z0], [cx + w, y1, z1], col); tri([cx - w, cy, cz], [cx - w, y1, z1], [cx - w, y0, z0], col);
      }
    };
    // the top, in strips along the profile (the stripes are a warning pattern across it), and the plain sides and back below it
    const bedC = kind === 'truck' ? C.bed : C.steel;
    for (let i = 1; i < p.length; i++) {
      const [s0, h0] = p[i - 1], [s1, h1] = p[i], n = Math.max(1, Math.round((s1 - s0) / 1.0));
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n, b = s0 + (s1 - s0) * (k + 1) / n, ya = h0 + (h1 - h0) * k / n, yb = h0 + (h1 - h0) * (k + 1) / n;
        const col = kind === 'ramp' ? (k % 2 ? C.stripe : C.steel) : (i === 1 ? (k % 2 ? C.stripe : C.steelD) : bedC);
        quad([-hw, ya, a], [hw, ya, a], [hw, yb, b], [-hw, yb, b], col);
      }
      const kerb = kind === 'truck' ? 0.14 : 0.1;   // a low lip along each side
      quad([-hw, h0, s0], [-hw, h1, s1], [-hw, h1 + kerb, s1], [-hw, h0 + kerb, s0], C.bedS);
      quad([hw, h1, s1], [hw, h0, s0], [hw, h0 + kerb, s0], [hw, h1 + kerb, s1], C.bedS);
      const sc = kind === 'truck' ? C.bedS : C.steelD;
      quad([-hw, 0, s0], [-hw, 0, s1], [-hw, h1, s1], [-hw, h0, s0], sc);
      quad([hw, 0, s1], [hw, 0, s0], [hw, h0, s0], [hw, h1, s1], sc);
    }
    const hl = p[p.length - 1][1];
    quad([hw, 0, L], [-hw, 0, L], [-hw, hl, L], [hw, hl, L], kind === 'truck' ? C.red : C.steelD);   // the back face at the lip
    if (kind === 'truck') {   // chassis under the bed, wheels at the back of the trailer, a landing leg
      box(-hw + 0.3, hw - 0.3, 0.55, 0.9, 5.5, L - 0.5, C.dark);
      for (const z of [10.2, 11.6, 13.0]) for (const sg of [-1, 1]) cyl(sg * (hw - 0.05), 0.5, z, 0.5, 0.17, C.tyre);
      box(-hw + 0.5, -hw + 0.7, 0, 1.0, 6.5, 6.7, C.dark); box(hw - 0.7, hw - 0.5, 0, 1.0, 6.5, 6.7, C.dark);
    }
    // ----- the road works around it: barrier boards on both flanks, cones, the sign -----
    const white = [0.92, 0.92, 0.9], orange = [0.95, 0.38, 0.05], bx0 = -ZONE_BEFORE, bx1 = L + ZONE_AFTER;
    for (const x of [hw + 0.55, -(hw + 0.45)]) {
      for (let a = bx0; a < bx1 - 0.01; a += 0.5) { const b = Math.min(bx1, a + 0.5), col = Math.floor((a - bx0) / 0.5) % 2 ? white : C.red; box(x - 0.05, x + 0.05, 0.45, 1.05, a, b, col); }
      for (let a = bx0 + 0.3; a < bx1; a += 2) { box(x - 0.22, x + 0.22, 0, 0.08, a, a + 0.12, C.dark); box(x - 0.04, x + 0.04, 0.08, 0.45, a, a + 0.1, C.dark); }   // the feet
    }
    const cone = (x, s) => { const n = 6, r0 = 0.17, r1 = 0.03, h = 0.7; box(x - 0.2, x + 0.2, 0, 0.03, s - 0.2, s + 0.2, C.dark);
      for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c = i % 2 ? orange : white; tri([x + Math.cos(a0) * r0, 0.03, s + Math.sin(a0) * r0], [x + Math.cos(a1) * r0, 0.03, s + Math.sin(a1) * r0], [x, 0.03 + h, s], c); tri([x + Math.cos(a1) * r0, 0.03, s + Math.sin(a1) * r0], [x + Math.cos(a0) * r0, 0.03, s + Math.sin(a0) * r0], [x, 0.03 + h, s], c); } };
    for (const [x, s] of [[hw + 1.2, bx0 - 1.2], [hw + 1.9, bx0 - 3.4], [hw + 2.6, bx0 - 5.6], [hw + 0.55, bx1 + 0.8], [-(hw + 0.45), bx1 + 0.8], [hw + 1.6, bx1 + 0.8]]) cone(x, s);
    { const x = hw + 1.3, s = bx0 - 0.4, red = C.red;   // the sign on its pole: a red triangle, a white one inside, facing the lapa coming up the street
      box(x - 0.03, x + 0.03, 0, 2.1, s - 0.03, s + 0.03, C.dark);
      for (const sd of [-1, 1]) { const z = s - sd * 0.05; tri(sd > 0 ? [x - 0.5, 2.05, z] : [x + 0.5, 2.05, z], sd > 0 ? [x + 0.5, 2.05, z] : [x - 0.5, 2.05, z], [x, 2.95, z], red); const z2 = s - sd * 0.06; tri(sd > 0 ? [x - 0.3, 2.15, z2] : [x + 0.3, 2.15, z2], sd > 0 ? [x + 0.3, 2.15, z2] : [x - 0.3, 2.15, z2], [x, 2.72, z2], white); }
      box(x - 0.04, x + 0.04, 2.25, 2.45, s - 0.075, s - 0.065, C.dark); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.computeVertexNormals();
    return g;
  }
  const meshes = {}, geos = {};
  for (const kind of Object.keys(KINDS)) {
    const mine = list.filter(r => r.kind === kind); if (!mine.length) continue;
    geos[kind] = geo(kind);
    const m = new THREE.InstancedMesh(geos[kind], mat, mine.length);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); meshes[kind] = { m, mine };
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  // the boards on the traffic side are walls for the lapa (the right ones stand 0.45 m from the ramp, in the gap by the kerb)
  if (walls2d) for (const z of zones) {
    const hw = z.w / 2 + 0.55, sn = Math.sin(z.th), cs = Math.cos(z.th), s0 = -ZONE_BEFORE, s1 = z.L + ZONE_AFTER;
    const a = [z.x + sn * s0 + cs * hw, z.z + cs * s0 - sn * hw], b = [z.x + sn * s1 + cs * hw, z.z + cs * s1 - sn * hw];
    walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]);
  }
  // the traffic's view of a work zone: one long parked obstacle made of circles (the same fields as a parked car, src/props.js parked.near)
  const obstacles = zones.map(z => { const r = z.zw / 2, c = []; for (let zo = -z.zl / 2 + r; zo <= z.zl / 2 - r + 0.01; zo += r * 1.2) c.push([0, zo, r]); return { x: z.zx, z: z.zz, rot: z.th, st: 0, ramp: true, sp: { L: z.zl, W: z.zw, m: 1e6, c, kind: 'ramp' } }; });
  function zonesNear(x, z, r, out) { for (const o of obstacles) if (Math.hypot(o.x - x, o.z - z) < r + o.sp.L / 2 + 2) out.push(o); return out.length; }
  let tick = 1;
  function update(dt) {
    tick += dt; if (tick < 0.5) return; tick = 0;
    const cx = camera.position.x, cz = camera.position.z;
    for (const kind in meshes) {
      const { m, mine } = meshes[kind]; let any = false;
      for (let i = 0; i < mine.length; i++) {
        const r = mine[i], near = Math.hypot(r.x - cx, r.z - cz) < SEE;
        if (near) { r.base = lowest(r); any = true; }
        m.setMatrixAt(i, m4.compose(p3.set(r.x, near ? r.base : -1000, r.z), q4.setFromAxisAngle(up, r.th), one));
      }
      m.instanceMatrix.needsUpdate = true; m.visible = any;
    }
  }
  return { surfaceAt, update, list, zonesNear };
}
