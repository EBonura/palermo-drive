// The pedalò of Mondello (a job module of the director, docs/missions-director.md; an encounter at a place, so it never rings: no director.add). The owner: "aggiungere i pedalò a
// Mondello, gare in acqua contro i pedalò".
//
// 1. The pedalò as part of Mondello. Ten of the classic Italian beach pedalò (two hulls in a colour, a white deck, two seats, a console, some with the little slide at the back) float in
//    the water off the beach by the Charleston: four wait in a row at the start line of the race, three rock close to the sand, three drift slowly. They are built when the lapa is within
//    BUILD_R metres of the beach and taken out of the scene again beyond DROP_R, by day only (at night the pedalò are hauled out and nothing is drawn). All of them are two InstancedMeshes (one
//    merged geometry with the slide, one without; a colour per instance for the hulls, the white parts keep their own through a vertex attribute `aTint`), the buoys of the course are a third:
//    three draw calls and about 5000 triangles in all. Their heave, pitch and roll are the same cheap bob the boats of src/sea.js have (that module keeps its wave function to itself, and
//    its water is flat: a few sines on a phase of its own per boat is all it does). No per-frame allocation. No wake for the pedalò (the lapa's own is the sea's, src/sea-wake.js).
// 2. The race. The start is a ring on the sand at the end of the beach (a pin on the minimap too). Stop in it for a second (or X.start(slot) with kind 'pedalo') and the lapa is put on the
//    water at the grid, with the four pedalò, and the usual 3, 2, 1, VIA! The course is five buoys out in the bay and back (about 1.4 km, 60 to 90 s). The next buoy is pink and marked by a
//    pillar of light from afar and a half hoop near (the same sign as the land races, src/races.js); a buoy is counted by the distance along the racing line, so passing beside counts too.
//    The rivals follow a smooth line through the buoys at a capped speed with a little rubber band, never collide, and stop at the finish. First three are paid (RACES in src/event-places.js
//    for the scale, times PAY_X), the result is saved through X.addRaceResult('pedalo', won).
// How the player moves on the water: the lapa itself, on its floats. src/vehicle-water.js already floats and drives the lapa when car.floats is set (the Garage part "swim": the sea does not
//    drown it, it rides on the surface at 55% of its top speed and slides a little), so the race borrows that mode: start() sets car.floats, shows the floats with vehicle.preview (the way
//    src/races.js shows the sulky), locks the swap with vehicle.lockSwap and holds the simulation with vehicle.holdSim for the countdown; stop() puts every one of them back, and takes the lapa
//    to the sand first if it is still on the water, so it never drowns when a race is cut short (the leash, the pause menu). No file but this one is touched.
// The shore frame: the beach runs along t (towards +z, a little east), the sea is out along n; u along the shore, v out to sea, from O (on the waterline by the Stabilimento Charleston).
//   Test link: ?debug&pedalo=1 puts the lapa on the sand at the start and, with &auto, starts the race 3 s later (the boats also show by night then).
//   Words are [Italian, English] pairs; the first is Palermitan in the owner's spelling, drafted from his rulings and passed by him on 22 Nov 2026 (the document "new mission lines to rewrite"); the countdown and result words are the land races' own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAY_X } from './economy.js';
import { SEA_Y } from './sea.js';
import { SPEED_SCALE as SS } from './vehicle.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------- the place
const TX = 0.46, TZ = 0.888, NX = 0.888, NZ = -0.46;          // along the shore (+z, a little east) and out to sea, unit vectors (the waterline of the beach: x -3062 at z -9720, -2906 at z -9420)
const O = { x: -3058, z: -9712 };                              // on the waterline of the free sand north of the Charleston (its pier and forecourt are at z -9598; cabins start at z -9760)
const at = (u, v) => [O.x + TX * u + NX * v, O.z + TZ * u + NZ * v];
const START = at(0, -16), TH0 = Math.atan2(NX, NZ);            // the ring on the sand; the lapa leaves it facing the sea
const BUILD_R = 600, DROP_R = 700, JOIN_R = 16, RING_SHOW = 180;
// the course in the shore frame [u, v]: the line P0 (the grid's front row), five buoys, the finish F back by the beach
const P0 = [0, 30], BUOYS = [[-60, 140], [-80, 260], [20, 330], [110, 250], [90, 130]].map(b => [b[0] * 1.9, b[1] * 1.9]), FIN = [20, 25], PASS = 3.5;   // PASS: metres the racing line keeps inside each buoy
const PRIZE = [55, 24, 10];                                     // euro for first, second, third, times PAY_X (RACES: 60 to 80 for 1.9 km of road, this is about 1.4 km of water)
const VMAX = 23;                                                // m/s of the fastest rival (21 let a clean driver win by a quarter of a minute: no race) at SPEED_SCALE 1.5 (measured: the lapa on its floats holds 25 m/s there); scaled by SS / 1.5
const HOOP_R = 6.5, HOOP_NEAR = 150, HOOP_FULL = 95, BEAM_W = 0.35;
const COLS = ['#d8352a', '#f2c230', '#2f6fd0', '#f4f1ea'], BUOY_COLS = ['#f2a21a', '#e8e4d6'], NEXT_COL = '#ff4fa3';

// ---------------------------------------------------------------------------------------------------- the model
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e2 = new THREE.Euler();
const SPH = new THREE.SphereGeometry(1, 12, 6), BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
// a primitive baked into a list: geometry g, centre (x, y, z), turn (rx, ry, rz), size (sx, sy, sz), its own colour, and tint 1 when the colour of the instance multiplies it
function put(list, g, x, y, z, rx, ry, rz, sx, sy, sz, col, tint) {
  const q = g.toNonIndexed(); q.deleteAttribute('uv');
  q.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e2.set(rx, ry, rz)), _s.set(sx, sy, sz)));
  const n = q.attributes.position.count, cc = new Float32Array(n * 3), tt = new Float32Array(n).fill(tint); _c.set(col);
  for (let i = 0; i < n; i++) { cc[i * 3] = _c.r; cc[i * 3 + 1] = _c.g; cc[i * 3 + 2] = _c.b; }
  q.setAttribute('color', new THREE.BufferAttribute(cc, 3)); q.setAttribute('aTint', new THREE.BufferAttribute(tt, 1));
  list.push(q);
}
// one pedalò, origin on the waterline under the middle, +z the bow: two hulls with a white gunwale, the deck, two seats with backs, the pedals, the console; the slide (a ramp from a
// platform over the stern, with two rails) only when `slide`
function pedaloGeometry(slide) {
  const L = [], W = '#f4f1ea', D = '#2a2d31';
  for (const sx of [-1, 1]) {
    put(L, SPH, sx * 0.64, 0.1, -0.05, 0, 0, 0, 0.3, 0.27, 1.75, W, 1);               // a hull, the colour of the instance
    put(L, SPH, sx * 0.64, 0.17, 1.55, 0.35, 0, 0, 0.16, 0.14, 0.4, W, 1);              // the up-turned bow
    put(L, BOX, sx * 0.64, 0.33, -0.1, 0, 0, 0, 0.1, 0.2, 2.6, W, 0);                   // the white strip along the top
  }
  put(L, BOX, 0, 0.45, -0.1, 0, 0, 0, 1.74, 0.09, 2.2, W, 0);                           // the deck
  for (const sx of [-1, 1]) {
    put(L, BOX, sx * 0.34, 0.6, -0.55, 0, 0, 0, 0.5, 0.14, 0.5, '#c0bcb0', 1);          // seat
    put(L, BOX, sx * 0.34, 0.9, -0.82, -0.12, 0, 0, 0.5, 0.5, 0.1, '#c0bcb0', 1);       // back
    put(L, BOX, sx * 0.3, 0.5, 0.08, 0, 0, 0, 0.1, 0.09, 0.5, D, 0);                    // pedals
  }
  put(L, BOX, 0, 0.64, 0.5, 0, 0, 0, 1.0, 0.28, 0.4, W, 0);                              // the console
  put(L, CYL, 0, 0.95, 0.52, 0.5, 0, 0, 0.03, 0.55, 0.03, D, 0);                         // the steering stick
  if (slide) {
    for (const sx of [-1, 1]) put(L, BOX, sx * 0.72, 0.85, -1.1, 0, 0, 0, 0.06, 0.95, 0.06, W, 0);   // the posts of the platform
    put(L, BOX, 0, 1.33, -1.1, 0, 0, 0, 1.6, 0.07, 0.5, W, 0);                          // the platform
    put(L, BOX, 0, 0.72, -2.4, -0.5, 0, 0, 0.9, 0.06, 2.5, W, 1);                       // the ramp, down to the water behind the stern
    for (const sx of [-1, 1]) put(L, BOX, sx * 0.46, 0.78, -2.4, -0.5, 0, 0, 0.06, 0.14, 2.5, W, 1);
  }
  const g = mergeGeometries(L, false); for (const q of L) q.dispose(); return g;
}
// a buoy of the course: a body in the colour of the instance, a white cap, a mast and a little flag (about 2 m tall at the scale it is drawn)
function buoyGeometry() {
  const L = [];
  put(L, CYL, 0, 0.45, 0, 0, 0, 0, 0.5, 0.9, 0.5, '#ffffff', 1); put(L, SPH, 0, 0.95, 0, 0, 0, 0, 0.36, 0.36, 0.36, '#ffffff', 0);
  put(L, CYL, 0, 1.5, 0, 0, 0, 0, 0.05, 1.1, 0.05, '#e8e4d6', 0); put(L, BOX, 0.18, 1.95, 0, 0, 0, 0, 0.34, 0.2, 0.03, '#ffffff', 1);
  const g = mergeGeometries(L, false); for (const q of L) q.dispose(); return g;
}
function makeMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = sh => {   // the vertex colour times the instance colour only where aTint is 1
    sh.vertexShader = 'attribute float aTint;\n' + sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, aTint);\n#endif');
  };
  return mat;
}

// ---------------------------------------------------------------------------------------------------- the racing line
const STEP = 4;
function makePath(ctrl) {
  const dense = [], n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {   // Catmull-Rom through the points, 16 samples a segment
    const a = ctrl[Math.max(i - 1, 0)], b = ctrl[i], c = ctrl[i + 1], d = ctrl[Math.min(i + 2, n - 1)];
    for (let k = 0; k < 16; k++) { const t = k / 16, t2 = t * t, t3 = t2 * t, f = j => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3); dense.push([f(0), f(1)]); }
  }
  dense.push(ctrl[n - 1]);
  const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = cum[cum.length - 1], N = Math.max(8, Math.round(L / STEP)) + 1, ds = L / (N - 1), x = new Float32Array(N), z = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
  let seg = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds; while (seg < dense.length - 2 && cum[seg + 1] < s) seg++;
    const l = cum[seg + 1] - cum[seg] || 1, u = clamp((s - cum[seg]) / l, 0, 1);
    x[i] = dense[seg][0] + (dense[seg + 1][0] - dense[seg][0]) * u; z[i] = dense[seg][1] + (dense[seg + 1][1] - dense[seg][1]) * u;
    tx[i] = (dense[seg + 1][0] - dense[seg][0]) / l; tz[i] = (dense[seg + 1][1] - dense[seg][1]) / l;
  }
  const A = { x: 0, z: 0, tx: 0, tz: 1 };
  return {
    L, N, ds, x, z,
    at(s) {   // the point at arc length s (a straight extension before the start and after the end), into a shared object
      if (s <= 0) { A.tx = tx[0]; A.tz = tz[0]; A.x = x[0] + tx[0] * s; A.z = z[0] + tz[0] * s; return A; }
      if (s >= L) { A.tx = tx[N - 1]; A.tz = tz[N - 1]; A.x = x[N - 1] + tx[N - 1] * (s - L); A.z = z[N - 1] + tz[N - 1] * (s - L); return A; }
      const i = Math.floor(s / ds), u = s / ds - i, j = Math.min(i + 1, N - 1);
      A.x = x[i] + (x[j] - x[i]) * u; A.z = z[i] + (z[j] - z[i]) * u;
      const a = tx[i] + (tx[j] - tx[i]) * u, b = tz[i] + (tz[j] - tz[i]) * u, l = Math.hypot(a, b) || 1; A.tx = a / l; A.tz = b / l; return A;
    },
    // arc length of the nearest point within +-win m of hint; -1 when the lapa is further than maxD from the line there
    project(px, pz, hint, win, maxD) {
      const c = Math.round(hint / ds), r = Math.ceil(win / ds); let best = 1e12, bi = -1;
      for (let k = -r; k <= r; k++) { const i = c + k; if (i < 0 || i >= N) continue; const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < best) { best = d; bi = i; } }
      if (bi < 0 || best > maxD * maxD) return -1;
      const j = Math.min(bi + 1, N - 1), dx = x[j] - x[bi], dz = z[j] - z[bi], l2 = dx * dx + dz * dz, u = l2 ? clamp(((px - x[bi]) * dx + (pz - z[bi]) * dz) / l2, 0, 1) : 0;
      return (bi + u) * ds;
    },
    nearest(px, pz) { let best = 1e12, bi = 0; for (let i = 0; i < N; i++) { const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < best) { best = d; bi = i; } } return bi * ds; },
  };
}

export default function setup(X) {
  const { scene, car, vehicle, hud, T, params } = X;
  const water = vehicle.water, isWater = (x, z) => !!water && water.isWater(x, z);   // false until the coastline is in: nothing is built before that
  const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '.' + String(Math.floor((t % 1) * 10));
  const DBG = params.has('pedalo'), VM = VMAX * SS / 1.5;

  // ---- the course, built once from the shore frame
  const buoyW = BUOYS.map(b => at(b[0], b[1]));
  const ctrl = [at(P0[0], P0[1])];
  BUOYS.forEach((b, i) => {   // the line passes PASS m inside the turn at each buoy
    const a = i ? BUOYS[i - 1] : P0, c = i < BUOYS.length - 1 ? BUOYS[i + 1] : FIN;
    let ix = b[0] - a[0], iz = b[1] - a[1], ox = c[0] - b[0], oz = c[1] - b[1]; const li = Math.hypot(ix, iz), lo = Math.hypot(ox, oz); ix /= li; iz /= li; ox /= lo; oz /= lo;
    let nx = ox - ix, nz = oz - iz; const ln = Math.hypot(nx, nz) || 1; nx /= ln; nz /= ln;
    ctrl.push(at(b[0] + nx * PASS, b[1] + nz * PASS));
  });
  ctrl.push(at(FIN[0], FIN[1]));
  const path = makePath(ctrl);
  const cps = buoyW.map(b => path.nearest(b[0], b[1])); cps.push(path.L - 2);   // where along the line each buoy and the finish are
  const flat = []; for (let i = 0; i < path.N; i += 5) flat.push(path.x[i], path.z[i]); flat.push(path.x[path.N - 1], path.z[path.N - 1]);   // for the guide and the minimap
  let cx = 0, cz = 0; for (const b of buoyW) { cx += b[0] / buoyW.length; cz += b[1] / buoyW.length; }
  let leashR = 0; for (let i = 0; i < path.N; i++) leashR = Math.max(leashR, Math.hypot(path.x[i] - cx, path.z[i] - cz));
  leashR += 320;
  const slot = { id: 'pedalo:mondello', kind: 'pedalo', sub: 'race', name: 'Pedalò ri Munnieddu', x: START[0], z: START[1], dx: NX, dz: NZ, w: 10, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null, cool: 12,   // (Palermitan: the owner passed it on 22 Nov 2026)
    leash: () => ({ a: [cx, cz], b: [cx, cz], r: leashR }) };
  slot.marker = X.addMarker(START[0], START[1], '#5ac8ff', 5);   // a pin on the minimap, like the landfill's

  // ---- the boats: ten of them, built near Mondello only
  let mats = null, geoA = null, geoB = null, geoBuoy = null, meshes = null, buoyMesh = null, built = false, ring = null, hoop = null, beacon = null;
  const boats = [], racers = [];
  let clk = 0, stopT = 0, dbgT = 0, dbgDone = false, dbgGo = 0, R = null;
  const night = () => X.isNight() && !DBG;
  const setCol = (mesh, i, hex) => { mesh.setColorAt(i, _c.set(hex)); mesh.instanceColor.needsUpdate = true; };

  function build() {
    if (!mats) { mats = makeMaterial(); geoA = pedaloGeometry(false); geoB = pedaloGeometry(true); geoBuoy = buoyGeometry(); }
    const mk = (g, n) => { const m = new THREE.InstancedMesh(g, mats, n); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; scene.add(m); return m; };
    meshes = [mk(geoA, 7), mk(geoB, 3)]; buoyMesh = mk(geoBuoy, BUOYS.length);
    boats.length = racers.length = 0;
    const used = [0, 0];
    const add = (slide, col, kind, u, v) => {
      const k = slide ? 1 : 0, b = { m: k, i: used[k]++, kind, x: 0, z: 0, yaw: TH0 + (kind === 'bob' ? rand(-0.5, 0.5) : 0), ph: rand(0, TAU), f: rand(0.7, 1.3), vx: 0, vz: 0, s: 0, v: 0, lat: 0, wob: 0, vmax: 0, done: false, total: 0 };
      for (let t = 0; t < 6 && !isWater(...at(u, v)); t++) v += 8;
      [b.x, b.z] = at(u, v);
      meshes[k].count = used[k]; setCol(meshes[k], b.i, col); boats.push(b); return b;
    };
    // four at the start line (they take their places on the grid in the race), three rocking near the sand, three drifting out to the west
    [[false, 0], [true, 1], [false, 2], [false, 3]].forEach(([s, c]) => racers.push(add(s, COLS[c], 'idle', 0, 0)));
    add(true, COLS[0], 'bob', -55, 14); add(false, COLS[1], 'bob', -90, 22); add(false, COLS[3], 'bob', 75, 9);
    [[true, 2, -100, 60], [false, 0, -150, 90], [false, 1, -75, 105]].forEach(([s, c, u, v]) => { const b = add(s, COLS[c], 'drift', u, v), a = rand(0, TAU), sp = rand(0.15, 0.35); b.vx = Math.cos(a) * sp; b.vz = Math.sin(a) * sp; b.yaw = a; });
    BUOYS.forEach((b, i) => { buoyMesh.count = i + 1; setCol(buoyMesh, i, BUOY_COLS[i % 2]); _p.set(buoyW[i][0], SEA_Y + 0.1, buoyW[i][1]); buoyMesh.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.setScalar(2.2))); });
    buoyMesh.instanceMatrix.needsUpdate = true;
    gridIdle();
    if (!beacon) { beacon = X.makeBeacon('#5ac8ff', 9); beacon.beam.scale.set(BEAM_W, 1, BEAM_W); beacon.show(false); }
    if (!ring) { ring = X.makeBeacon('#5ac8ff', 14); ring.beam.scale.set(0.25, 1, 0.25); ring.set(START[0], START[1]); ring.show(false); }
    built = true;
  }
  function unbuild() {
    if (!built) return;
    for (const m of meshes) { scene.remove(m); m.dispose(); }
    scene.remove(buoyMesh); buoyMesh.dispose(); meshes = buoyMesh = null; boats.length = racers.length = 0; built = false;
    ring.show(false);
  }
  function markNext(k) { for (let i = 0; i < BUOYS.length; i++) setCol(buoyMesh, i, i === k ? NEXT_COL : BUOY_COLS[i % 2]); }
  // the grid: two abreast, rows 6.5 m behind the line; the lapa takes one of the five places
  function gridPlace(k, o) { const row = k >> 1, side = k & 1 ? 1 : -1; o.s = -(4 + row * 6.5); o.lat = side * 2.4; return o; }
  const _g = { s: 0, lat: 0 };
  function gridIdle() {   // the four racers wait on the places 1 to 4 (place 0 is where the lapa will be)
    racers.forEach((b, i) => { gridPlace(i + 1, _g); const a = path.at(_g.s); b.kind = 'idle'; b.s = _g.s; b.lat = _g.lat; b.v = 0; b.done = false; b.x = a.x - a.tz * _g.lat; b.z = a.z + a.tx * _g.lat; b.yaw = Math.atan2(a.tx, a.tz); });
  }

  // ---- every frame the boats are put on the sea (the cheap bob of src/sea.js); the drifters turn back at the edges of their stretch of water
  function animate(dt) {
    for (let n = 0; n < boats.length; n++) {
      const b = boats[n];
      if (b.kind === 'drift') {
        b.x += b.vx * dt; b.z += b.vz * dt;
        const u = (b.x - O.x) * TX + (b.z - O.z) * TZ, v = (b.x - O.x) * NX + (b.z - O.z) * NZ, vn = b.vx * NX + b.vz * NZ, vt = b.vx * TX + b.vz * TZ;
        if ((v < 40 && vn < 0) || (v > 130 && vn > 0)) { b.vx -= 2 * vn * NX; b.vz -= 2 * vn * NZ; }
        if ((u < -170 && vt < 0) || (u > -60 && vt > 0)) { b.vx -= 2 * vt * TX; b.vz -= 2 * vt * TZ; }
        b.yaw += (Math.atan2(b.vx, b.vz) - b.yaw) * Math.min(1, dt * 0.3);
      }
      const w = clk * b.f + b.ph, amp = b.kind === 'race' ? 1.5 : 1;
      const heave = (Math.sin(w * 1.3) * 0.05 + Math.sin(w * 0.7 + 1.7) * 0.035) * amp, pitch = Math.sin(w * 0.9 + 0.6) * 0.03 * amp, roll = Math.sin(w * 0.8) * 0.05 * amp;
      meshes[b.m].setMatrixAt(b.i, _m.compose(_p.set(b.x, SEA_Y + 0.02 + heave, b.z), _q.setFromEuler(_e.set(pitch, b.yaw, roll)), _s.set(1, 1, 1)));
    }
    meshes[0].instanceMatrix.needsUpdate = true; meshes[1].instanceMatrix.needsUpdate = true;
  }

  // ---- the next buoy's sign: a half hoop standing on the water across the line, the pillar of light while it is far (the same sign as src/races.js)
  function hoopSet(x, z, tx, tz, on) {
    const k = on ? clamp((HOOP_NEAR - Math.hypot(car.x - x, car.z - z)) / (HOOP_NEAR - HOOP_FULL), 0, 1) : 0;
    if (beacon) { beacon.beam.visible = k < 1; const w = BEAM_W * (1 - k) + 0.001; beacon.beam.scale.set(w, 1, w); }
    if (!hoop) {
      if (!k) return;
      const mt = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, toneMapped: false, fog: false });
      hoop = { g: new THREE.Group(), tube: mt('#5ac8ff'), core: mt('#ffffff') };
      hoop.g.add(new THREE.Mesh(new THREE.TorusGeometry(HOOP_R, 0.5, 8, 40, Math.PI), hoop.tube), new THREE.Mesh(new THREE.TorusGeometry(HOOP_R, 0.2, 6, 40, Math.PI), hoop.core));
      scene.add(hoop.g);
    }
    hoop.g.visible = k > 0; if (!k) return;
    hoop.g.position.set(x, SEA_Y - 0.2, z); hoop.g.rotation.y = Math.atan2(tx, tz); hoop.g.scale.setScalar(0.7 + 0.3 * k);
    hoop.tube.opacity = 0.8 * k; hoop.core.opacity = 0.95 * k;
  }

  // ---- the race
  async function teleportTo(x, z, th) {
    if (X.world) await new Promise(res => { const t = setTimeout(res, 9000); X.world.teleport(x, z, () => { clearTimeout(t); res(); }); });
    vehicle.teleport(x, z, th);
  }
  const floatY = () => SEA_Y + 0.1 - X.groundAt(car.x, car.z);
  function start(s) {
    if (R) return;
    if (!built) build();
    R = { slot: s, state: 'prep', t: 0, clock: 0, total: 0, prevS: 0, cpi: 0, rank: 1, hudT: 0, hudO: null, resultT: 0, place: 0, prize: 0, leaving: false, restored: false, was: !!car.floats, k0: 0, lastCount: 4, preview: false };
    car.floats = true; vehicle.lockSwap(true);
    { const lk = vehicle.look(); if (lk) { vehicle.preview({ ...lk, parts: { ...(lk.parts || {}), swim: 'galleggianti' } }); R.preview = true; } }   // the floats show on the lapa (the sea would let it float without them)
    vehicle.holdSim(true);
    X.setPhase('race'); ring.show(false); X.guide.path(flat, { fixed: true });
    markNext(0);
    R.k0 = Math.floor(Math.random() * (racers.length + 1));
    let k = 0; racers.forEach(b => { if (k === R.k0) k++; gridPlace(k, _g); b.s = b.total = _g.s; b.lat = _g.lat; b.v = 0; b.done = false; b.vmax = VM * rand(0.93, 1.0); b.wob = rand(0, 6); b.kind = 'race'; k++; });
    const g0 = gridPlace(R.k0, { s: 0, lat: 0 }); R.total = g0.s; R.prevS = 0;
    X.transition(async () => {
      if (!R || R.slot !== s) return;
      for (const b of racers) { const a = path.at(b.s); b.x = a.x - a.tz * b.lat; b.z = a.z + a.tx * b.lat; b.yaw = Math.atan2(a.tx, a.tz); }
      const a = path.at(g0.s);
      await teleportTo(a.x - a.tz * g0.lat, a.z + a.tx * g0.lat, Math.atan2(a.tx, a.tz));
      if (!R || R.slot !== s) return;
      vehicle.holdSim(true); car.wet = 1; car.lift = floatY();
    }, { hold: 500 }).then(() => { if (R && R.slot === s) { R.state = 'count'; R.t = 0; } });
    hud.toast(T('Galleggianti muntati: si va supra l’acqua!', 'Floats fitted: out on the water!'), '');
  }

  function raceUpdate(dt) {
    const S = R;
    S.clock += dt;
    if (!S.restored) car.floats = true;   // every frame: the prize going into the wallet makes the Garage re-read the saved look (src/vehicle.js syncSaved), which would take the floats away
    if (S.state === 'prep') { hud.set({ label: T('Pedalò', 'Pedalò'), title: T('Nta l’acqua', 'Into the water'), sub: '', time: '', frac: null, target: null }); return; }
    S.t += dt;
    if (S.state === 'count') { car.wet = 1; car.lift = floatY(); }   // held for the countdown: the lapa already sits on the water
    const ps = path.project(car.x, car.z, Math.max(0, S.prevS), 70, 80);
    if (ps >= 0) { S.total += ps - S.prevS; S.prevS = ps; }
    if (S.state === 'count') {
      const n = 3 - Math.floor(S.t - 0.3);
      if (S.t > 0.3 && n !== S.lastCount) { S.lastCount = n; if (n > 0) hud.count(String(n), T('Pronti', 'Ready')); }
      rivals(dt, false);
      if (S.t >= 3.3) { S.state = 'race'; S.t = 0; vehicle.holdSim(false); hud.count(T('VIA!', 'GO!')); }
    } else {
      rivals(dt, true);
      if (S.state === 'race') {
        let rank = 1; for (const b of racers) if (b.done || b.total > S.total) rank++; S.rank = rank;
        while (S.cpi < BUOYS.length && S.total >= cps[S.cpi]) { hud.toast(T('Boa ', 'Buoy ') + (S.cpi + 1) + '/' + BUOYS.length, fmtT(S.t)); S.cpi++; markNext(S.cpi < BUOYS.length ? S.cpi : -1); }
        if (S.total >= path.L - 6 || (S.cpi >= BUOYS.length && Math.hypot(car.x - path.x[path.N - 1], car.z - path.z[path.N - 1]) < 16)) endRace(true); else if (S.t > 50 + path.L / 6) endRace(false);
      } else if (S.state === 'finish') { S.resultT -= dt; if (S.resultT <= 0) leave(); }
    }
    // the card: position and what is left, set every frame, its text a few times a second; the sign stands on the next buoy, then on the finish
    const ci = Math.min(S.cpi, BUOYS.length), a = path.at(cps[ci]), tx = a.tx, tz = a.tz, px = ci < BUOYS.length ? buoyW[ci][0] : a.x, pz = ci < BUOYS.length ? buoyW[ci][1] : a.z;
    if ((S.hudT -= dt) <= 0 && S.state !== 'finish') {
      S.hudT = 0.1;
      S.hudO = { label: T('Cuoisa ri pedalò', 'Pedalò race'), title: S.state === 'count' ? '' : S.rank + ' / ' + (racers.length + 1), sub: Math.round(Math.max(0, path.L - S.total)) + ' m', time: S.state === 'race' ? fmtT(S.t) : '', frac: clamp(S.total / path.L, 0, 1), target: { x: px, z: pz } };
    }
    if (S.hudO) { hud.set(S.hudO); if (S.hudO.target) { S.hudO.target.x = px; S.hudO.target.z = pz; X.aim(px, pz, S.state === 'race'); beacon.set(px, pz); beacon.show(S.state === 'race'); hoopSet(px, pz, tx, tz, S.state === 'race'); } }
  }
  function rivals(dt, go) {
    for (const b of racers) {
      if (go) {
        if (!b.done) {
          const gap = b.total - R.total, rub = gap < -60 ? 1.08 : gap > 70 ? 0.93 : 1, vt = b.vmax * rub * (0.96 + 0.04 * Math.sin(R.t * 0.8 + b.wob));
          b.v += clamp(vt - b.v, -6 * SS * dt, 3.2 * SS * dt); b.total += b.v * dt; b.s = b.total;
          if (b.total >= path.L - 6) b.done = true;
        } else { b.v = Math.max(0, b.v - 3 * dt); b.total += b.v * dt; b.s = b.total; }
      } else b.v = 0;
      const lat = b.lat + Math.sin(R.t * 0.5 + b.wob) * 0.5 * Math.min(1, b.v / 6), a = path.at(b.s);
      b.x = a.x - a.tz * lat; b.z = a.z + a.tx * lat; b.yaw = Math.atan2(a.tx, a.tz);
    }
  }
  function endRace(finished) {
    const S = R; S.state = 'finish'; S.resultT = 6; X.setPhase('finish');
    const ahead = racers.filter(b => b.done).length;
    S.place = finished ? ahead + 1 : racers.length + 1;
    S.prize = finished ? (PRIZE[S.place - 1] || 0) * PAY_X : 0;
    if (S.prize > 0) { vehicle.garage.credit(S.prize); car.floats = true; }   // the wallet, as the land races do (it is not a fare); the credit makes the Garage re-read the saved look, which drops the floats at once
    X.addRaceResult('pedalo', finished && S.place === 1);
    S.hudO = { frac: null, target: null, label: T('Cuoisa ri pedalò', 'Pedalò race'), title: finished ? T(S.place + '° posto!', 'Place ' + S.place + '!') : T('Tempo scaduto', 'Time is up'), sub: '', time: finished ? fmtT(S.t) : '' };
    hud.result(`<h3>${finished ? T(S.place + '° posto!', 'Place ' + S.place + '!') : T('Tempo scaduto', 'Time is up')}</h3>
      <div class="row"><span>${T('Tempo', 'Time')}</span><span>${finished ? fmtT(S.t) : '-'}</span></div>
      <div class="row tot"><span>${S.prize > 0 ? T('Premio', 'Prize') : T('Niente premio, ritenta', 'No prize, try again')}</span><span>${S.prize > 0 ? '€ ' + S.prize : ''}</span></div>`, 5.5, S.prize > 0 ? 'cash' : 'fail');
    if (finished && S.place === 1) hud.burst();
    beacon.show(false); hoopSet(0, 0, 0, 1, false); markNext(-1);
  }
  async function leave() {   // back to the sand with the lapa as it was
    const S = R; if (!S || S.leaving) return; S.leaving = true;
    await X.transition(async () => { restore(); await teleportTo(START[0], START[1], TH0); }, { hold: 350 });
    if (R === S) X.endEvent(true);
  }
  // everything the race borrowed goes back: the floats, the swap lock, the simulation. A lapa still on the water goes to the sand first, or it would drown the moment the floats go.
  function restore() {
    const S = R; if (!S || S.restored) return; S.restored = true;
    if (isWater(car.x, car.z)) vehicle.teleport(START[0], START[1], TH0);
    car.floats = S.was; car.wet = 0;
    vehicle.holdSim(false); vehicle.lockSwap(false); if (S.preview) vehicle.preview(null);
    if (beacon) { beacon.show(false); hoopSet(0, 0, 0, 1, false); }
    if (built) { markNext(-1); gridIdle(); }
  }
  function stop() { if (R) { restore(); R = null; } stopT = 0; }

  // ---- the encounter: the boats, the ring on the sand, the join
  function tick(dt, idle) {
    clk += dt;
    const d = Math.hypot(car.x - O.x, car.z - O.z), day = !night();
    if (!built) { if (d < BUILD_R && day && isWater(...at(0, 40))) build(); }
    else if (!R && (d > DROP_R || !day)) unbuild();
    if (built) {
      animate(dt);
      const ds = Math.hypot(car.x - START[0], car.z - START[1]), ok = idle && !R && X.now() >= slot.coolUntil;
      ring.show(ok && ds < RING_SHOW);
      if (ok && ds < 70) {
        const slow = Math.abs(car.vf) < 2.5 && ds < JOIN_R && X.calls.armed();
        stopT = slow ? stopT + dt : Math.max(0, stopT - dt * 2);
        hud.set({ label: T('Pedalò', 'Pedalò'), title: T('Cuoisa ri pedalò a Munnieddu', 'Pedalò race at Mondello'), sub: T('Fiaimmati nnâ spiaggia pi curriri', 'Stop on the beach to join'), time: '', frac: stopT / 1.1, target: slot });
        if (stopT >= 1.1) { stopT = 0; X.start(slot); }
      } else if (!R) stopT = 0;
    }
    // the test link: ?debug&pedalo=1 puts the lapa on the sand, &auto starts the race a few seconds later
    if (DBG && !dbgDone && X.game && X.game.state === 'play' && (dbgT += dt) > 1.5) {
      dbgDone = true; dbgGo = 3;
      const put = () => vehicle.teleport(START[0], START[1], TH0);
      if (X.world) X.world.teleport(START[0], START[1], put); else put();
    }
    if (dbgGo > 0 && (dbgGo -= dt) <= 0 && params.has('auto') && idle && !R) X.start(slot);
  }
  X.kinds.pedalo = { start, stop, update(dt) { if (R) raceUpdate(dt); }, tick, get R() { return R; }, path, boats, slot };
}
