// Player car: model, handling, collision response, nitro, sound and chase camera. Owned by the driving work.
// main.js owns input (env.keys), the world and the render loop; it calls physics(dt) at a fixed
// 120 Hz, then updateVisual(dt) and updateCamera(dt) once per frame.
//
// Handling is an arcade bicycle model tuned for fun on a keyboard or phone pads (feel inspired by
// classic arcade street racers): lots of grip and a speed-sensitive steering lock for normal driving,
// and a separate drift state (handbrake, brake-tap-and-turn, or a big slide) in which steering sets the
// slip angle you hold instead of the yaw rate. Velocity is rotated towards the nose by a capped
// "tyre" rate, so grip loss, slides and drifts all come from one rule.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { D, groundY } from './core.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => a - TAU * Math.floor((a + PI) / TAU);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- tuning ----------
const T = {
  L: 2.5,            // wheelbase for the kinematic yaw rate, m
  lock: 0.58,        // full steering lock at standstill, rad
  lockV: 16,         // steering lock = lock / (1 + (v / lockV)^2), halved at 16 m/s
  aGrip: 15.5,       // max lateral acceleration with full grip, m/s^2 (about 1.6 g)
  aDrift: 10.5,      // max lateral acceleration while drifting
  kGrip: 18,         // how hard grip pulls the velocity towards the nose (1/s)
  kDrift: 2.6,
  sigMax: 0.62,      // drift angle a full steering input asks for, rad (about 35 degrees)
  scrubSlip: 4.5,    // speed lost per unit of sin(slip angle) while sliding, m/s^2
  scrubDrift: 0.9,   // constant speed scrub while in drift state
  gearV: [0, 11.5, 19, 28.5, 38, 47.5],   // speed at the rev limiter in each gear, m/s
  gearA: [0, 10.4, 8.2, 6.6, 5.2, 4.3],   // peak engine acceleration in each gear, m/s^2
  brake: 17, hbrake: 4.5, reverseV: 9, reverseA: 6,
  drag: 0.0013, roll: 0.35,
  nosTime: 3.4,      // seconds of boost from a full bar
  nosThrust: 7.5, nosTop: 1.1, nosTorque: 1.3,
  nosDriftFill: 0.24, nosSpeedFill: 0.03,
};
const R_CAR = 0.93, AXLE = 1.1;

export function createVehicle(env) {
  const { scene, camera, keys, walls2d, closestOnSeg, raisedMask, CURB, roadVerts } = env;
  const baseFov = camera.fov;

  // ---------- car model ----------
  // Fallback box car until the glTF has loaded (or if it fails to).
  function buildFallback() {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: '#b5121f', roughness: 0.35, metalness: 0.2 });
    const glass = new THREE.MeshStandardMaterial({ color: '#1d252e', roughness: 0.08, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.8 });
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff6d8' });
    const tail = new THREE.MeshBasicMaterial({ color: '#ff3b2f' });
    const box = (w, h, l, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
    box(1.7, 0.62, 3.7, paint, 0, 0.62, 0);
    box(1.5, 0.58, 2.0, paint, 0, 1.2, -0.25);
    box(1.52, 0.42, 1.6, glass, 0, 1.2, -0.25);
    box(1.38, 0.4, 2.02, glass, 0, 1.2, -0.25);
    box(1.72, 0.14, 0.2, dark, 0, 0.36, 1.85);
    box(1.72, 0.14, 0.2, dark, 0, 0.36, -1.85);
    box(0.3, 0.14, 0.05, lamp, 0.6, 0.74, 1.86); box(0.3, 0.14, 0.05, lamp, -0.6, 0.74, 1.86);
    box(0.3, 0.14, 0.05, tail, 0.62, 0.74, -1.86); box(0.3, 0.14, 0.05, tail, -0.62, 0.74, -1.86);
    const wheelG = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12); wheelG.rotateZ(Math.PI / 2);
    const wheels = [];
    for (const [x, z] of [[0.8, 1.2], [-0.8, 1.2], [0.8, -1.2], [-0.8, -1.2]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.33, z);
      const spin = new THREE.Mesh(wheelG, dark); spin.castShadow = true; pivot.add(spin);
      wheels.push({ pivot, spin, front: z > 0 });
    }
    return { body: group, wheels };
  }

  const carRoot = new THREE.Group();   // placed and yawed in the world
  const tilt = new THREE.Group();      // body roll and pitch
  carRoot.add(tilt);
  const model = { wheels: [], rearZ: -1.85 };
  {
    const fb = buildFallback();
    tilt.add(fb.body);
    for (const w of fb.wheels) carRoot.add(w.pivot);
    model.fallback = fb;
    model.wheels = fb.wheels;
  }
  scene.add(carRoot);

  const MODEL_SCALE = 1.3;   // Kenney hatchback is 2.85 m long, 1.3 m wide: scaled to a 3.7 m Panda-sized car
  new GLTFLoader().load(new URL('../assets/cars/hatchback-sports.glb', import.meta.url).href, gltf => {
    const root = gltf.scene, s = MODEL_SCALE, wheels = [];
    const bodyNode = root.getObjectByName('body');
    for (const n of ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']) {
      const node = root.getObjectByName(n);
      node.geometry?.computeBoundingBox();
      const cx = node.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
      const pivot = new THREE.Group(), spin = new THREE.Group();
      pivot.position.set((node.position.x + cx) * s, node.position.y * s, node.position.z * s);
      pivot.scale.setScalar(s);
      node.position.set(-cx, 0, 0);
      node.removeFromParent(); spin.add(node); pivot.add(spin);
      wheels.push({ pivot, spin, front: n.includes('front') });
    }
    bodyNode.removeFromParent();
    bodyNode.position.multiplyScalar(s); bodyNode.scale.setScalar(s);
    const bodyGroup = new THREE.Group(); bodyGroup.add(bodyNode);
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.material.roughness = 0.55; o.material.metalness = 0.1; o.material.side = THREE.FrontSide;
      }
    });
    wheels.forEach(w => w.pivot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material.roughness = 0.7; } }));
    // swap in
    tilt.remove(model.fallback.body);
    for (const w of model.fallback.wheels) carRoot.remove(w.pivot);
    tilt.add(bodyGroup);
    for (const w of wheels) carRoot.add(w.pivot);
    model.wheels = wheels;
    model.rearZ = -1.85;
  }, undefined, err => console.warn('car model failed to load, keeping the box car', err));

  // brake lights (glow over the baked tail lights) and nitro exhaust flames
  const brakeMat = new THREE.MeshBasicMaterial({ color: '#ff1a10', transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (const x of [-0.58, 0.58]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), brakeMat);
    m.position.set(x, 0.82, -1.88); tilt.add(m);
  }
  const flames = [];
  const flameOuter = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (const x of [-0.45, 0.45]) {
    const mk = (r, h, mat) => { const g = new THREE.ConeGeometry(r, h, 10, 1, true); g.translate(0, h / 2, 0); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, 0.42, -1.9); m.visible = false; m.frustumCulled = false; tilt.add(m); return m; };
    flames.push([mk(0.14, 1, flameOuter), mk(0.07, 0.7, flameInner)]);
  }
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(160,210,255,0.7)'); gr.addColorStop(0.6, 'rgba(255,140,40,0.25)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.position.set(0, 0.45, -2.3); glow.visible = false; tilt.add(glow);

  // tyre smoke: one Points object with a ring buffer of puffs
  const SMOKE_N = 56;
  const smoke = (() => {
    const pos = new Float32Array(SMOKE_N * 3), life = new Float32Array(SMOKE_N).fill(1), size = new Float32Array(SMOKE_N);
    const vel = new Float32Array(SMOKE_N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aLife; attribute float aSize; uniform float uScale; varying float vLife;\nvoid main(){ vLife=aLife; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(1.0+aLife*2.2)*uScale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vLife;\nvoid main(){ float r=length(gl_PointCoord-0.5)*2.0; float a=(1.0-smoothstep(0.35,1.0,r))*(1.0-vLife)*0.42*step(vLife,0.999); if(a<0.01) discard; gl_FragColor=vec4(vec3(0.82,0.8,0.78),a); }',
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
    return { pts, pos, life, size, vel, i: 0, mat };
  })();
  function puff(x, y, z, vx, vz, sz) {
    const s = smoke, i = s.i; s.i = (i + 1) % SMOKE_N;
    s.pos[i * 3] = x; s.pos[i * 3 + 1] = y; s.pos[i * 3 + 2] = z;
    s.vel[i * 3] = vx; s.vel[i * 3 + 1] = 0.7 + Math.random() * 0.5; s.vel[i * 3 + 2] = vz;
    s.life[i] = 0; s.size[i] = sz;
  }

  // ---------- state ----------
  const car = {
    x: 0, z: 0, th: 0, vx: 0, vz: 0, vf: 0, steer: 0, roll: 0, pitch: 0, lastVf: 0, lift: 0,
    w: 0, sIn: 0, thr: 0, slip: 0, drift: 0, rpm: 0.15, gear: 1, shiftT: 0, nos: 0.6, nosAmt: 0, nosOn: false, nosLock: false,
    psiPrev: 0, psiDot: 0, dLatch: 0, ax: 0, ay: 0, braking: false, scrape: 0,
  };
  let ticks = 0, seenTicks = 0, idleFrames = 99;
  let hitMag = 0, hitId = 0, nosStartId = 0;

  function nearestRoad(x, z) {
    let best = null, bd = Infinity;
    for (const v of roadVerts) { const d = (v[0] - x) ** 2 + (v[1] - z) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  }
  function placeAt(x, z) {
    const v = nearestRoad(x, z);
    Object.assign(car, { x: v[0], z: v[1], th: v[2], vx: 0, vz: 0, vf: 0, steer: 0, w: 0, sIn: 0, slip: 0, drift: 0, dLatch: 0, gear: 1, shiftT: 0, psiDot: 0, scrape: 0 });
    camState.init = false;
  }

  // ---------- collision ----------
  // Two circles along the car against the building wall segments. A contact is resolved with an
  // impulse (small bounce, tangential friction so the car scrapes along instead of stopping, a bit of
  // yaw) and a position push. Called on sub-steps of at most 0.35 m so nothing can tunnel.
  const I_YAW = 1.7;
  function collide() {
    const sn = Math.sin(car.th), cs = Math.cos(car.th);
    let touched = false;
    for (const sgn of [1, -1]) {
      const a = AXLE * sgn;
      const cx = car.x + sn * a, cz = car.z + cs * a;
      let px = 0, pz = 0;
      walls2d.query(cx - R_CAR, cz - R_CAR, cx + R_CAR, cz + R_CAR, s => {
        const [qx, qz] = closestOnSeg(cx + px, cz + pz, s);
        const dx = cx + px - qx, dz = cz + pz - qz, d = Math.hypot(dx, dz);
        if (d >= R_CAR) return;
        let nx, nz;
        if (d > 1e-4) { nx = dx / d; nz = dz / d; }
        else { const ex = s[2] - s[0], ez = s[3] - s[1], el = Math.hypot(ex, ez) || 1; nx = -ez / el; nz = ex / el; }
        const push = R_CAR - d;
        px += nx * push; pz += nz * push;
        touched = true;
        // velocity of the contact point: translation plus yaw about the centre (lateral = l = (cs, -sn))
        const lx = cs, lz = -sn;
        const vpx = car.vx + car.w * a * lx, vpz = car.vz + car.w * a * lz;
        const vn = vpx * nx + vpz * nz;
        if (vn < 0) {
          const ln = lx * nx + lz * nz, arm = a * ln;
          const inv = 1 + arm * arm / I_YAW;
          const j = -(1 + 0.16) * vn / inv;
          car.vx += j * nx; car.vz += j * nz; car.w += clamp(j * arm / I_YAW * 0.7, -1.6, 1.6);
          // scrape: friction along the wall, never more than a fraction of the normal impulse
          const tx = -nz, tz = nx, vt = (car.vx + car.w * a * lx) * tx + (car.vz + car.w * a * lz) * tz;
          const jt = clamp(-vt, -0.3 * j, 0.3 * j);
          car.vx += jt * tx; car.vz += jt * tz;
          if (-vn > hitMag) hitMag = -vn;
        }
      });
      car.x += px; car.z += pz;
    }
    car.w = clamp(car.w, -3.2, 3.2);
    const [x0, z0, x1, z1] = D.bounds;
    if (car.x < x0 || car.x > x1) { car.x = clamp(car.x, x0, x1); car.vx = 0; }
    if (car.z < z0 || car.z > z1) { car.z = clamp(car.z, z0, z1); car.vz = 0; }
    return touched;
  }

  // ---------- physics ----------
  const torque = r => r < 0.5 ? 0.7 + 0.6 * r : r < 0.82 ? 1 : 1 - 0.5 * (r - 0.82) / 0.18;

  function physics(dt) {
    ticks++;
    const up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight, hb = !!keys.Space;
    const nosKey = keys.ShiftLeft || keys.ShiftRight;
    const sIn = (left ? 1 : 0) - (right ? 1 : 0);

    // smoothed inputs (digital pads ramp in, opposite input flips quickly)
    const rate = sIn === 0 ? 10 : (car.sIn === 0 || Math.sign(sIn) === Math.sign(car.sIn) ? 6.5 : 13);
    car.sIn += (sIn - car.sIn) * Math.min(1, rate * dt);
    car.thr += ((up ? 1 : 0) - car.thr) * Math.min(1, 9 * dt);

    let sn = Math.sin(car.th), cs = Math.cos(car.th);
    let vf = car.vx * sn + car.vz * cs, vl = car.vx * cs - car.vz * sn;
    const v0 = Math.hypot(vf, vl);
    car.slip = v0 > 2 && vf > 0.5 ? clamp(Math.atan2(-vl, vf), -1.4, 1.4) : 0;   // + = nose left of the velocity

    // ----- nitro -----
    if (!nosKey) car.nosLock = false;
    const nosWant = !!nosKey && car.nos > 0.002 && !car.nosLock && vf > -1;
    if (nosKey && car.nos <= 0.002) car.nosLock = true;
    if (nosWant && !car.nosOn) nosStartId++;
    car.nosOn = nosWant;
    car.nosAmt += ((nosWant ? 1 : 0) - car.nosAmt) * Math.min(1, (nosWant ? 12 : 3) * dt);
    const nm = car.nosAmt;

    // ----- drift state -----
    const sa = Math.abs(car.slip);
    const against = sIn !== 0 && sa > 0.06 && Math.sign(sIn) !== Math.sign(car.slip);
    const brakeTurn = down && !up && vf > 14 && Math.abs(car.sIn) > 0.55;
    if (vf > 6 && (hb || brakeTurn)) car.dLatch = 0.35;
    car.dLatch = Math.max(0, car.dLatch - dt);
    let dT = 0;
    if (vf > 6 && (car.dLatch > 0 || (sa > 0.24 && !against))) dT = 1;
    car.drift += (dT - car.drift) * Math.min(1, (dT > car.drift ? 10 : 5) * dt);
    const d = car.drift;

    // ----- longitudinal -----
    const thrOn = up || nosWant;
    let g = car.gear;
    const vMul = 1 + (T.nosTop - 1) * nm;
    let aDrive = 0, brakeA = 0;
    if (car.shiftT > 0) car.shiftT -= dt;
    else {
      const r = Math.abs(vf) / (T.gearV[g] * vMul);
      if (g < 5 && r > 0.95 && thrOn && vf > 0) { g++; car.shiftT = 0.1; }
      else if (g > 1 && r < 0.45) g--;
      car.gear = g;
    }
    let rr = Math.abs(vf) / (T.gearV[g] * vMul);
    car.braking = false;
    if (thrOn) {
      if (vf < -0.6) { brakeA = T.brake; car.braking = true; }
      else {
        aDrive = T.gearA[g] * torque(rr) * (car.shiftT > 0 ? 0 : 1) * (1 + (T.nosTorque - 1) * nm);
        if (rr > 1) aDrive *= Math.max(0, 1 - (rr - 1) * 25);
        aDrive += T.nosThrust * nm;
      }
    } else if (down) {
      if (vf > 0.6) { brakeA = T.brake; car.braking = true; }
      else if (vf > -T.reverseV) { aDrive = -T.reverseA; car.gear = g = 1; }
    }
    if (hb) brakeA += T.hbrake;
    const coast = (thrOn ? 0 : 1.1) + T.roll + T.drag * vf * vf;
    // Gravity along the slope: the Cassaro really does climb towards Porta Nuova.
    const slope = (groundY(car.x + sn * 1.2, car.z + cs * 1.2) - groundY(car.x - sn * 1.2, car.z - cs * 1.2)) / 2.4;
    vf += (aDrive - 9.81 * slope) * dt;
    const resist = (brakeA + coast) * dt;
    vf = Math.abs(vf) <= resist ? 0 : vf - Math.sign(vf) * resist;
    // rpm for the gauge and the engine sound
    rr = Math.abs(vf) / (T.gearV[g] * vMul);
    const rpmT = clamp(Math.max(0.16 + 0.12 * car.thr, rr), 0.14, 1.02) * (car.shiftT > 0 ? 0.88 : 1);
    car.rpm += (rpmT - car.rpm) * Math.min(1, 14 * dt);
    car.ax += ((vf - car.lastVf) / dt - car.ax) * Math.min(1, 8 * dt);
    car.lastVf = vf;

    // nitro bar: burns while boosting, refills with speed and (a lot) with drifting
    if (nosWant) car.nos = Math.max(0, car.nos - dt / T.nosTime);
    else {
      const sp01 = clamp(vf / 40, 0, 1);
      car.nos = Math.min(1, car.nos + (T.nosSpeedFill * sp01 + T.nosDriftFill * d * clamp(sa / 0.35, 0, 1) * clamp(vf / 15, 0, 1)) * dt);
    }

    // rebuild world velocity after the drive forces
    car.vx = sn * vf + cs * vl; car.vz = cs * vf - sn * vl;

    // ----- yaw -----
    const v1 = Math.hypot(car.vx, car.vz);
    const delta = T.lock / (1 + (v1 / T.lockV) ** 2);
    const wCap = T.aGrip * 0.92 / Math.max(Math.abs(vf), 3);
    const wN = clamp(vf * Math.tan(delta * car.sIn) / T.L, -wCap, wCap);
    let wT = wN;
    if (d > 0.01) {
      const psiV = Math.atan2(car.vx, car.vz);
      if (v1 > 3) car.psiDot += (wrap(psiV - car.psiPrev) / dt - car.psiDot) * Math.min(1, 25 * dt); else car.psiDot = 0;
      car.psiPrev = psiV;
      let sigT;
      if (against) sigT = 0;                                   // counter-steer: straighten up
      else if (sIn !== 0) sigT = car.sIn * T.sigMax;           // steering into the slide sets the angle
      else sigT = car.slip * (1 - (up ? 0.45 : 1.1) * dt);     // hands off: the angle holds, then fades
      const wD = car.psiDot + 5.5 * wrap(sigT - car.slip);
      wT = lerp(wN, clamp(wD, -2.8, 2.8), d);
    } else car.psiPrev = Math.atan2(car.vx, car.vz);
    car.w += (wT - car.w) * Math.min(1, (d > 0.5 ? 9 : 12) * dt);
    car.th += car.w * dt;
    car.steer += (clamp(car.sIn * 0.5 - car.slip * 0.8 * d, -0.62, 0.62) - car.steer) * Math.min(1, 12 * dt);

    // ----- grip: rotate the velocity towards the nose at a capped rate, scrub speed while sliding -----
    sn = Math.sin(car.th); cs = Math.cos(car.th);
    let v = Math.hypot(car.vx, car.vz);
    if (v > 0.3) {
      let psi = Math.atan2(car.vx, car.vz);
      const fwd = car.vx * sn + car.vz * cs >= 0;
      const e = wrap((fwd ? car.th : car.th + PI) - psi);
      const aCap = lerp(T.aGrip, T.aDrift, d), kG = lerp(T.kGrip, T.kDrift, d);
      const rMax = aCap / Math.max(v, 4);
      let dpsi = clamp(e * kG, -rMax, rMax) * dt;
      if (Math.abs(dpsi) > Math.abs(e)) dpsi = e;
      psi += dpsi;
      v = Math.max(0, v - (T.scrubDrift * d + T.scrubSlip * Math.abs(Math.sin(e))) * dt);
      car.vx = Math.sin(psi) * v; car.vz = Math.cos(psi) * v;
    }

    // ----- move with sub-steps, then collide -----
    const n = Math.min(10, Math.ceil(v * dt / 0.35));
    const sdt = dt / n;
    let touched = false;
    for (let i = 0; i < n; i++) {
      car.x += car.vx * sdt; car.z += car.vz * sdt;
      if (collide()) touched = true;
    }
    car.scrape = touched ? Math.hypot(car.vx, car.vz) : 0;

    sn = Math.sin(car.th); cs = Math.cos(car.th);
    car.vf = car.vx * sn + car.vz * cs;
    car.ay += (car.w * car.vf - car.ay) * Math.min(1, 10 * dt);

    // Body sits on the terrain, plus cosmetic weight transfer: roll out of the corner, dive and squat.
    const lx = cs, lz = -sn;
    const side = (groundY(car.x + lx * 0.8, car.z + lz * 0.8) - groundY(car.x - lx * 0.8, car.z - lz * 0.8)) / 1.6;
    const rollT = clamp(car.ay * 0.0042, -0.085, 0.085) + Math.atan(side);
    const pitchT = clamp(-car.ax * 0.0048, -0.065, 0.065) - Math.atan(slope);
    car.roll += (rollT - car.roll) * Math.min(1, 7 * dt);
    car.pitch += (pitchT - car.pitch) * Math.min(1, 7 * dt);
    car.lift += ((raisedMask(car.x, car.z) ? CURB : 0) - car.lift) * Math.min(1, 25 * dt);
  }

  // ---------- sound ----------
  // Web Audio, started on the first user gesture. Engine: looping sample whose pitch follows rpm.
  // Skid and scrape: looping sample gated by slip. Impact: one-shot. Nitro: filtered noise whoosh.
  const audio = { ctx: null, vol: 0.8, ready: false, started: false };
  function startAudio() {
    if (audio.started) return;
    audio.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = audio.ctx = new AC();
    const master = audio.master = ctx.createGain(); master.gain.value = audio.vol * 0.9; master.connect(ctx.destination);
    const load = name => fetch(new URL(`../assets/audio/${name}.wav`, import.meta.url).href)
      .then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)));
    Promise.all([load('engine'), load('skid'), load('impact')]).then(([eng, skid, imp]) => {
      const loop = (buf, filterType, f0) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filt = ctx.createBiquadFilter(); filt.type = filterType; filt.frequency.value = f0;
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(filt); filt.connect(gain); gain.connect(master); src.start();
        return { src, filt, gain };
      };
      audio.engine = loop(eng, 'lowpass', 2000);
      audio.skid = loop(skid, 'lowpass', 5000);
      // nitro: looped white noise through a band-pass
      const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      audio.nos = loop(nb, 'bandpass', 1400); audio.nos.filt.Q.value = 0.7;
      audio.impact = imp;
      audio.ready = true;
    }).catch(err => console.warn('car audio failed to load', err));
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  }
  function gesture() {
    startAudio();
    if (audio.ctx && audio.ctx.state === 'suspended' && !document.hidden) audio.ctx.resume();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, gesture, { passive: true });

  function playImpact(mag) {
    const a = audio; if (!a.ready) return;
    const src = a.ctx.createBufferSource(); src.buffer = a.impact;
    src.playbackRate.value = 0.8 + Math.random() * 0.3 - clamp(mag / 60, 0, 0.2);
    const gn = a.ctx.createGain(); gn.gain.value = clamp(0.25 + mag / 18, 0.25, 1.2);
    src.connect(gn); gn.connect(a.master); src.start();
  }
  let lastHitId = 0, lastHitT = 0;
  function updateAudio(dt, active) {
    const a = audio; if (!a.ready) return;
    const t = a.ctx.currentTime, set = (p, v, tc = 0.06) => p.setTargetAtTime(v, t, tc);
    const speed = Math.abs(car.vf);
    // engine
    const rpm = car.rpm, thr = active ? Math.max(car.thr, car.nosAmt) : 0;
    set(a.engine.src.playbackRate, 0.5 + 1.25 * rpm + 0.07 * car.nosAmt, 0.04);
    set(a.engine.gain.gain, active ? 0.22 + 0.4 * thr + 0.12 * rpm : 0, 0.08);
    set(a.engine.filt.frequency, 900 + 5200 * (0.25 + 0.75 * thr) * (0.5 + 0.5 * rpm), 0.08);
    // skid and scrape
    const slide = clamp((Math.abs(car.slip) - 0.1) * 3, 0, 1) * clamp(speed / 8, 0, 1) * (car.drift > 0.2 ? 1 : 0.35);
    const hbLock = keys.Space && speed > 5 ? 0.7 : 0;
    const scrape = clamp(car.scrape / 25, 0, 0.5);
    const sk = active ? Math.max(slide, hbLock, scrape) : 0;
    set(a.skid.gain.gain, sk * 0.55, 0.05);
    set(a.skid.src.playbackRate, scrape > slide ? 0.6 + 0.2 * scrape : 0.95 + 0.25 * clamp(speed / 40, 0, 1), 0.1);
    set(a.skid.filt.frequency, scrape > slide ? 1800 : 6000, 0.1);
    // nitro whoosh
    set(a.nos.gain.gain, active ? car.nosAmt * 0.3 : 0, 0.06);
    set(a.nos.filt.frequency, 900 + 1500 * car.nosAmt + speed * 20, 0.1);
    // impacts
    if (hitId !== lastHitId) {
      lastHitId = hitId;
      const now = performance.now();
      if (lastHitMag > 1.5 && now - lastHitT > 120) { playImpact(lastHitMag); lastHitT = now; }
    }
  }
  let lastHitMag = 0;

  // ---------- nitro bar (own DOM element, outside the HUD corners) ----------
  const nosEl = document.createElement('div');
  nosEl.className = 'nosbar'; nosEl.hidden = true;
  nosEl.innerHTML = '<span class="nosbar-l">NOS</span><span class="nosbar-t"><i></i></span>';
  document.body.appendChild(nosEl);
  const nosFill = nosEl.querySelector('i');
  let nosShown = -1, nosHidden = true;

  // ---------- camera ----------
  const camState = { mode: 0, init: false, pos: new THREE.Vector3() };
  const cam = { ang: 0, fov: baseFov, trauma: 0, kick: 0, nosEnv: 0, roll: 0, t: 0, lastNosId: 0, lastHit: 0, look: new THREE.Vector3(), up: new THREE.Vector3() };
  function wallHit(x0, z0, x1, z1) {
    let tMin = 1;
    walls2d.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), s => {
      const rx = x1 - x0, rz = z1 - z0, sx = s[2] - s[0], sz = s[3] - s[1], den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) return;
      const t = ((s[0] - x0) * sz - (s[1] - z0) * sx) / den, u = ((s[0] - x0) * rz - (s[1] - z0) * rx) / den;
      if (t >= 0 && t < tMin && u >= 0 && u <= 1) tMin = t;
    });
    return tMin;
  }
  const _p = new THREE.Vector3(), _c = new THREE.Vector3();
  function updateCamera(dt) {
    dt = clamp(dt, 0, 0.1);
    cam.t += dt;
    const m = camState.mode;
    const v = Math.hypot(car.vx, car.vz), sp01 = clamp(v / 45, 0, 1);
    if (hitId !== cam.lastHit) { cam.lastHit = hitId; cam.trauma = Math.max(cam.trauma, clamp(lastHitMag / 22, 0, 1) * 0.9); }
    if (nosStartId !== cam.lastNosId) { cam.lastNosId = nosStartId; cam.kick = 1; }
    cam.trauma = Math.max(0, cam.trauma - 1.6 * dt);
    cam.kick = Math.max(0, cam.kick - 2.8 * dt);
    cam.nosEnv += (car.nosAmt - cam.nosEnv) * Math.min(1, 6 * dt);

    // heading the camera follows: towards the direction of travel while sliding, lagging in turns
    let hT = car.th;
    if (car.vf > 0 && v > 4) hT = car.th + wrap(Math.atan2(car.vx, car.vz) - car.th) * 0.65 * sstep(4, 10, v);
    if (!camState.init) cam.ang = car.th;
    cam.ang += wrap(hT - cam.ang) * (1 - Math.exp(-5 * dt));
    const ca = m === 2 ? car.th : cam.ang;
    const f = _c.set(Math.sin(ca), 0, Math.cos(ca));

    const gy = groundY(car.x, car.z);
    // field of view: speed, nitro punch
    const fovT = baseFov + sp01 * 12 + cam.nosEnv * 11 + cam.kick * 6;
    cam.fov += (fovT - cam.fov) * Math.min(1, 7 * dt);
    if (Math.abs(camera.fov - cam.fov) > 0.02) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }

    // shake: constant faint buzz at speed, bursts on impacts and nitro
    const tr = cam.trauma, amp = tr * tr * 0.45 + (0.006 + 0.028 * sp01 * sp01) * (1 + cam.nosEnv * 1.6);
    const tt = cam.t;
    const sx = (Math.sin(tt * 41) + Math.sin(tt * 67 + 1.3)) * 0.5 * amp, sy = (Math.sin(tt * 53 + 2.1) + Math.sin(tt * 79)) * 0.5 * amp * 0.7;
    const sz = (Math.sin(tt * 47 + 0.7) + Math.sin(tt * 71 + 4)) * 0.5 * amp;
    const rollT = m === 3 ? 0 : clamp(-car.w * 0.016, -0.05, 0.05) + (tr * tr) * Math.sin(tt * 33) * 0.03;
    cam.roll += (rollT - cam.roll) * Math.min(1, 8 * dt);

    if (m === 2) { // bonnet
      camera.position.set(car.x + f.x * 0.4 + sx, gy + 1.45 + sy, car.z + f.z * 0.4 + sz);
      camera.lookAt(car.x + f.x * 20, gy + 1.2 + (groundY(car.x + f.x * 20, car.z + f.z * 20) - gy), car.z + f.z * 20);
      camera.rotateZ(cam.roll + car.roll * 0.5);
      camState.init = true;
      return;
    }
    const [dist0, h] = [[7.5, 3], [16, 8], null, [3, 130]][m];
    const dist = dist0 + (m < 2 ? sp01 * 1.8 + cam.nosEnv * 0.7 : 0);
    const dx = car.x - f.x * dist, dz = car.z - f.z * dist, dy = gy + h + (m < 2 ? sp01 * 0.5 : 0);
    if (!camState.init) { camState.pos.set(dx, dy, dz); camState.init = true; }
    const kh = 1 - Math.exp(-(m === 3 ? 3 : 22) * dt), kv = 1 - Math.exp(-(m === 3 ? 3 : 6) * dt);
    camState.pos.x += (dx - camState.pos.x) * kh; camState.pos.z += (dz - camState.pos.z) * kh; camState.pos.y += (dy - camState.pos.y) * kv;
    const p = _p.copy(camState.pos);
    if (m !== 3) {
      const t = wallHit(car.x, car.z, p.x, p.z);
      if (t < 1) { const k = Math.max(0.15, t * 0.85); p.x = car.x + (p.x - car.x) * k; p.z = car.z + (p.z - car.z) * k; p.y += (1 - k) * 2.5; }
    }
    p.y = Math.max(p.y, groundY(p.x, p.z) + 1.2);
    camera.position.set(p.x + sx, p.y + sy, p.z + sz);
    const look = f.clone().multiplyScalar(m === 3 ? 0 : 4).add(_p.set(car.x, gy + 1.2, car.z));
    camera.lookAt(look);
    if (cam.roll) camera.rotateZ(cam.roll);
  }

  // ---------- visual ----------
  const _w = new THREE.Vector3();
  function updateVisual(dt) {
    // is the simulation running (not on the title screen or paused)?
    if (ticks !== seenTicks) { seenTicks = ticks; idleFrames = 0; } else idleFrames++;
    const active = idleFrames < 4;
    if (hitMag > 0) { lastHitMag = hitMag; hitMag = 0; hitId++; car.pitch += clamp(lastHitMag * 0.003, 0, 0.05) * (car.vf > 0 ? 1 : -1); }

    const g = carRoot;
    g.position.set(car.x, groundY(car.x, car.z) + car.lift, car.z); g.rotation.y = car.th;
    tilt.rotation.set(car.pitch, 0, car.roll);
    const spin = (car.vf || 0) * dt / 0.39;
    for (const w of model.wheels) {
      const locked = w.front ? false : (keys.Space && Math.abs(car.vf) > 1);
      if (!locked) w.spin.rotation.x += spin;
      if (w.front) w.pivot.rotation.y = car.steer;
    }
    brakeMat.opacity = active && (car.braking || keys.Space) ? 0.85 : 0;

    // nitro flames
    const n = car.nosAmt, fl = n > 0.05;
    glow.visible = fl;
    for (const [o, i] of flames) {
      o.visible = i.visible = fl;
      if (fl) {
        const flick = 0.8 + Math.random() * 0.4;
        o.scale.set(1.5, 1.5, (0.8 + 2.6 * n) * flick); i.scale.set(1.5, 1.5, (0.6 + 1.9 * n) * flick);
      }
    }
    if (fl) { glow.scale.setScalar(1.2 + 2.0 * n * (0.85 + Math.random() * 0.3)); glow.material.opacity = 0.9 * n; }

    // tyre smoke while sliding, braking hard with the handbrake, or scraping
    const sp = Math.abs(car.vf);
    const slideAmt = Math.max(clamp((Math.abs(car.slip) - 0.18) * 3, 0, 1) * (car.drift > 0.3 ? 1 : 0), keys.Space && sp > 6 ? 0.8 : 0) * clamp(sp / 10, 0, 1);
    if (active && slideAmt > 0.1) {
      smokeAcc += dt * 38 * slideAmt;
      const sn = Math.sin(car.th), cs = Math.cos(car.th);
      while (smokeAcc >= 1) {
        smokeAcc -= 1;
        const sgn = Math.random() < 0.5 ? 1 : -1;
        puff(car.x - sn * 1.2 + cs * 0.8 * sgn + (Math.random() - 0.5) * 0.3, g.position.y + 0.15, car.z - cs * 1.2 - sn * 0.8 * sgn + (Math.random() - 0.5) * 0.3,
          car.vx * 0.25 + (Math.random() - 0.5) * 0.8, car.vz * 0.25 + (Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.5);
      }
    }
    {
      const s = smoke;
      for (let i = 0; i < SMOKE_N; i++) {
        if (s.life[i] >= 1) continue;
        s.life[i] += dt / 0.9;
        if (s.life[i] >= 1) { s.life[i] = 1; continue; }
        s.pos[i * 3] += s.vel[i * 3] * dt; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
        s.vel[i * 3] *= 0.97; s.vel[i * 3 + 2] *= 0.97;
      }
      s.pts.geometry.attributes.position.needsUpdate = true; s.pts.geometry.attributes.aLife.needsUpdate = true; s.pts.geometry.attributes.aSize.needsUpdate = true;
      const cv = document.getElementById('view'), pr = cv && cv.clientHeight ? cv.height / cv.clientHeight : 1;
      s.mat.uniforms.uScale.value = innerHeight * pr / (2 * Math.tan(camera.fov * PI / 360));
    }

    updateAudio(dt, active);

    // bar
    if (active === nosHidden) { nosEl.hidden = !active; nosHidden = !active; }
    const q = Math.round(car.nos * 200) / 200;
    if (q !== nosShown) { nosShown = q; nosFill.style.transform = `scaleX(${q})`; }
    nosEl.classList.toggle('on', car.nosAmt > 0.3);
    nosEl.classList.toggle('low', car.nos < 0.15 && car.nosAmt < 0.3);
    nosEl.classList.toggle('full', car.nos > 0.995);
    return g.position;
  }
  let smokeAcc = 0;

  function setVolume(v) {
    audio.vol = clamp(+v || 0, 0, 1);
    if (audio.master) audio.master.gain.value = audio.vol * 0.9;
  }

  return { car, camState, placeAt, physics, updateVisual, updateCamera, setVolume };
}
