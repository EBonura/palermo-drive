// The carretto siciliano as a hero prop (c6): a painted Sicilian cart that stands, with its horse and its carrettiere on the bench, near the Cattedrale and the Quattro Canti.
// Same model, same painted boards and same bay horse as the one that wanders the market quarter in the traffic (src/traffic.js, loop in src/carrozze.js), drawn here as a
// two-instance mesh that is only visible when the camera is within a few hundred metres. The body is solid for the lapa (four wall segments), and the camera pull-in sees it.
// The carrettiere is a scripted LPC pedestrian sitting on the plank, created when somebody comes near and taken away when they leave.
import * as THREE from 'three';
import { makeMaterial, carrettoModel, CARRETTO } from '../assets/traffic/models.js';
import { makeCarrettoDecal } from '../assets/traffic/carretto-art.js';

// lat, lon, heading in radians (0 = facing south, x east, z south: the lapa's convention), what it stands for
const SPOTS = [
  [38.114046, 13.356237, 1.57, 'Cattedrale'],       // the garden in front of the cathedral, on the path by the middle roundel, where the carrozze wait for tourists
  [38.115485, 13.361751, 0.0, 'Quattro Canti'],      // the south-west corner of Piazza Pretoria, off the road, a minute's walk from the crossing
];
const SEE = 420, NEAR_PED = 160, FAR_PED = 260;   // metres: the mesh is drawn within SEE, the carrettiere exists between NEAR_PED and FAR_PED

export function createCarrettoProp(env) {
  const { scene, camera, groundY, walls2d, proj } = env;
  let spots = SPOTS.map(([la, lo, th, name]) => { const [x, z] = proj(la, lo); return { x, z, th, name, y: 0, id: -1 }; });
  const q = new URLSearchParams(location.search).get('cartat');   // ?cartat=x,z,th[;x,z,th]: put the carts there (screenshots, tests)
  if (q) spots = q.split(';').map((t, i) => { const [x, z, th] = t.split(',').map(Number); return { x, z, th: th || 0, name: 'test' + i, y: 0, id: -1 }; });
  const n = spots.length;
  const mesh = new THREE.InstancedMesh(carrettoModel(), makeMaterial(), n);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const bay = new THREE.Color('#6a4a30');
  for (let i = 0; i < n; i++) mesh.setColorAt(i, bay);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false; mesh.count = n;
  const decal = makeCarrettoDecal(mesh, n); decal.count = n; decal.visible = false;
  scene.add(mesh, decal);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  function place(s, i) {
    s.y = groundY(s.x, s.z);
    mesh.setMatrixAt(i, m4.compose(p3.set(s.x, s.y, s.z), q4.setFromAxisAngle(up, s.th), one));
  }
  // the body as a rectangle the lapa bumps into: 1.9 m wide, from the back board to the horse's tail ... head, rotated by the heading
  const HL = 2.9, HW = 0.95, sn = Math.sin, cs = Math.cos;
  for (const s of spots) {
    const f = [sn(s.th), cs(s.th)], r = [cs(s.th), -sn(s.th)];   // forward and to the left, on the ground
    const c = (a, b) => [s.x + f[0] * a + r[0] * b, s.z + f[1] * a + r[1] * b];
    const k = [c(-HL * 0.9, -HW), c(-HL * 0.9, HW), c(HL, HW * 0.6), c(HL, -HW * 0.6)];
    for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
  }
  let peds = null, t = 0, tick = 0;
  function seatFn(s) {   // the plank: the model's frame (CARRETTO.SH centres it), the same numbers as the traffic cart's bench in src/carrozze.js
    return out => { const c = cs(s.th), si = sn(s.th); out.x = s.x + c * 0 + si * -1.05; out.z = s.z - si * 0 + c * -1.05; out.y = s.y + 1.14; out.th = s.th + sn(t * 0.3 + s.x) * 0.5; };
  }
  function update(dt) {
    t += dt; tick += dt; if (tick < 0.5) return; tick = 0;
    const cx = camera.position.x, cz = camera.position.z; let any = false;
    for (let i = 0; i < n; i++) {
      const s = spots[i], d = Math.hypot(s.x - cx, s.z - cz);
      if (d < SEE) { any = true; place(s, i); }
      if (peds) {
        if (s.id < 0 && d < NEAR_PED) { const id = peds.spawnScripted('carrettiere', s.x, s.z); if (id >= 0) { peds.setSize?.(id, 0.84); peds.attachTo(id, seatFn(s), { seated: true }); s.id = id; } }
        else if (s.id >= 0 && d > FAR_PED) { peds.remove(s.id); s.id = -1; }
      }
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.visible = decal.visible = any;
  }
  return { update, bindPedestrians(api) { peds = api; }, spots, mesh };
}
