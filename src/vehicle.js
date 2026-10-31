// Player vehicle: a procedural Piaggio Ape Calessino (the Palermo "lapa"), handling, collision response, nitro, sound and chase camera. Owned by the driving work.
// main.js owns input (env.keys), the world and the render loop; it calls physics(dt) at a fixed
// 120 Hz, then updateVisual(dt) and updateCamera(dt) once per frame.
//
// Handling is an arcade bicycle model tuned for fun on a keyboard or phone pads (feel inspired by
// classic arcade street racers): lots of grip and a speed-sensitive steering lock for normal driving,
// and a separate drift state (handbrake, brake-tap-and-turn, or a big slide) in which steering sets the
// slip angle you hold instead of the yaw rate. Velocity is rotated towards the nose by a capped
// "tyre" rate, so grip loss, slides and drifts all come from one rule. The lapa is tall, so it rolls a lot and
// tips onto two wheels in hard fast turns (visual, plus a small grip penalty that stops it from tipping further).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D, groundY, hooks } from './core.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => a - TAU * Math.floor((a + PI) / TAU);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- tuning ----------
const T = {
  L: 1.85,           // wheelbase for the kinematic yaw rate, m
  lock: 0.72,        // full steering lock at standstill, rad
  lockV: 12,         // steering lock = lock / (1 + (v / lockV)^2), halved at 12 m/s
  aGrip: 12.5,       // max lateral acceleration with full grip, m/s^2 (about 1.3 g)
  aDrift: 8.5,       // max lateral acceleration while drifting
  kGrip: 16,         // how hard grip pulls the velocity towards the nose (1/s)
  kDrift: 2.4,
  sigMax: 0.6,       // drift angle a full steering input asks for, rad (about 34 degrees)
  scrubSlip: 4.0,    // speed lost per unit of sin(slip angle) while sliding, m/s^2
  scrubDrift: 0.8,   // constant speed scrub while in drift state
  driftV: 5, brakeTurnV: 10,   // minimum speeds (m/s) for a handbrake drift and for a brake-tap drift
  gearV: [0, 7, 12, 18.5, 24.5, 30],      // speed at the rev limiter in each gear, m/s (top about 108 km/h)
  gearA: [0, 9.2, 7.0, 5.2, 4.0, 3.1],    // peak engine acceleration in each gear, m/s^2
  brake: 14, hbrake: 4.5, reverseV: 6, reverseA: 5,
  drag: 0.0012, roll: 0.35,
  nosTime: 3.4,      // seconds of boost from a full bar
  nosThrust: 6.0, nosTop: 1.17, nosTorque: 1.3,   // about 124 km/h flat out with nitro
  nosDriftFill: 0.24, nosSpeedFill: 0.04,
  tipA0: 8.5, tipA1: 3, tipMax: 0.17, tipGrip: 0.12,   // lateral accel where the inner wheels start to lift, range, max extra lean (rad), grip lost at full lift
  rollGain: 0.0085, rollMax: 0.16,
};
const R_CAR = 0.74, AXLE = 0.72;
const MODEL_LEN = 3.1;
export const LIVERIES = [
  { id: 'blu', name_it: 'Blu reale', name_en: 'Royal blue' },
  { id: 'bianco', name_it: 'Bianco e bordeaux', name_en: 'White and burgundy' },
  { id: 'carretto', name_it: 'Carretto siciliano', name_en: 'Sicilian cart' },
];

export function createVehicle(env) {
  const { scene, camera, keys, walls2d, closestOnSeg, raisedMask, CURB, roadVerts } = env;
  const baseFov = camera.fov;

  // ---------- the lapa: a procedural Piaggio Ape Calessino ----------
  // Origin on the ground under the middle of the vehicle, +z forward, +x left. About 3.1 m long, 1.4 m wide, 2.0 m tall.
  // Hierarchy: carRoot (world position and yaw) > lean (tips onto two wheels in hard turns) > [tilt (body, rolls on its
  // springs about PIV), wheels]. The front wheel sits in a fork group that steers.
  const PIV = 0.45;
  const carRoot = new THREE.Group(), lean = new THREE.Group(), tilt = new THREE.Group();
  carRoot.add(lean); lean.add(tilt); tilt.position.y = PIV;
  scene.add(carRoot);

  // --- procedural textures ---
  const rngOf = seed => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const FOLK = { yellow: '#f2c200', red: '#d42a1f', blue: '#1c4fb8', green: '#1f9a4a', cream: '#fff0cf', orange: '#ec7a1c', dark: '#2a1a10' };
  function flower(g, x, y, r, petal, centre, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; g.fillStyle = petal; g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.4, r * 0.2, a, 0, TAU); g.fill();
    }
    g.fillStyle = centre; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
    g.fillStyle = FOLK.cream; g.beginPath(); g.arc(x, y, r * 0.12, 0, TAU); g.fill();
  }
  function scroll(g, x, y, r, col, dir) {
    g.strokeStyle = col; g.lineWidth = Math.max(2, r * 0.2); g.lineCap = 'round'; g.beginPath();
    for (let t = 0; t < 3.4 * PI; t += 0.12) { const rad = r * (1 - t / (3.8 * PI)); const px = x + dir * rad * Math.cos(t), py = y + rad * Math.sin(t); t === 0 ? g.moveTo(px, py) : g.lineTo(px, py); }
    g.stroke();
  }
  function teeth(g, x, y, w, h, n, c1, c2, down) {
    const tw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? c1 : c2; g.beginPath();
      if (down) { g.moveTo(x + i * tw, y); g.lineTo(x + (i + 1) * tw, y); g.lineTo(x + (i + 0.5) * tw, y + h); }
      else { g.moveTo(x + i * tw, y + h); g.lineTo(x + (i + 1) * tw, y + h); g.lineTo(x + (i + 0.5) * tw, y); }
      g.fill();
    }
  }
  // Hand-painted folk-art panel in the spirit of the Sicilian cart: bright fields, scrolls, flowers, borders.
  function folkPanel(g, w, h, seed) {
    const R = rngOf(seed), C = FOLK;
    g.fillStyle = C.yellow; g.fillRect(0, 0, w, h);
    const band = h * 0.14;
    g.fillStyle = C.red; g.fillRect(0, 0, w, band * 0.5); g.fillRect(0, h - band * 0.5, w, band * 0.5);
    teeth(g, 0, band * 0.5, w, band * 0.5, Math.round(w / 26), C.blue, C.cream, true);
    teeth(g, 0, h - band, w, band * 0.5, Math.round(w / 26), C.green, C.cream, false);
    const n = Math.max(2, Math.round(w / (h * 1.05))), pw = w / n, py = band * 1.15, ph = h - band * 2.3;
    const fields = [C.red, C.blue, C.green, C.orange], petals = [C.yellow, C.cream, C.orange, C.red];
    for (let i = 0; i < n; i++) {
      const x = i * pw + pw * 0.06, fw = pw * 0.88, f = (i + (R() * 4 | 0)) % 4;
      g.fillStyle = C.dark; g.fillRect(x - 3, py - 3, fw + 6, ph + 6);
      g.fillStyle = fields[f]; g.fillRect(x, py, fw, ph);
      g.strokeStyle = C.cream; g.lineWidth = 2; g.strokeRect(x + 5, py + 5, fw - 10, ph - 10);
      const cx = x + fw / 2, cy = py + ph / 2, r = Math.min(fw, ph) * 0.34;
      scroll(g, cx - r * 1.25, cy - r * 0.35, r * 0.55, C.cream, 1); scroll(g, cx + r * 1.25, cy + r * 0.35, r * 0.55, C.cream, -1);
      flower(g, cx, cy, r, petals[f], f === 1 ? C.red : C.blue, 8 + (i % 2) * 4);
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? C.yellow : C.cream; g.beginPath(); g.arc(x + fw * (0.15 + 0.14 * k), py + ph * 0.1, 3, 0, TAU); g.arc(x + fw * (0.15 + 0.14 * k), py + ph * 0.9, 3, 0, TAU); g.fill(); }
      if (i < n - 1) { // diamond chain between fields
        for (let k = 0; k < 4; k++) { const dx = x + fw + pw * 0.06, dy = py + ph * (0.12 + 0.25 * k); g.fillStyle = k % 2 ? C.red : C.blue; g.beginPath(); g.moveTo(dx, dy - 7); g.lineTo(dx + 6, dy); g.lineTo(dx, dy + 7); g.lineTo(dx - 6, dy); g.fill(); }
      }
    }
  }
  const T_FOLK_REAR = canvasTex(512, 200, (g, w, h) => folkPanel(g, w, h, 11));
  const T_FOLK_CAB = canvasTex(384, 190, (g, w, h) => folkPanel(g, w, h, 29));
  const T_CHECK = canvasTex(64, 64, g => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#fdfbf2' : '#1c4fb8'; g.fillRect(x * 32, y * 32, 32, 32); } }, [1, 12]);
  const T_CANVAS = canvasTex(128, 128, (g, w, h) => {
    const R = rngOf(5); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.05})`; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.06})`; g.fillRect(R() * w, R() * h, 2, 2); }
  }, [2, 2]);
  const T_WOOD = canvasTex(256, 128, (g, w, h) => {
    const R = rngOf(3), n = 6, sh = h / n;
    for (let i = 0; i < n; i++) {
      const l = 36 + R() * 8; g.fillStyle = `hsl(28,62%,${l}%)`; g.fillRect(0, i * sh, w, sh);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,30,10,${0.08 + R() * 0.1})`; g.fillRect(0, i * sh + R() * sh, w, 1); }
      g.fillStyle = 'rgba(255,230,170,0.22)'; g.fillRect(0, i * sh + 2, w, 3);
      g.fillStyle = '#2e1a0c'; g.fillRect(0, i * sh, w, 2);
    }
  });

  // --- materials (livery changes recolour these in place) ---
  const std = (c, r = 0.5, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const mBody = std('#1d4fd0', 0.32, 0.15), mArch = std('#1d4fd0', 0.32, 0.15), mCabSide = std('#1d4fd0', 0.32, 0.15), mRearSide = std('#ffffff', 0.45);
  const mRoof = std('#f3efe4', 0.9), mDoor = std('#f3efe4', 0.9), mPillar = std('#1d4fd0', 0.32, 0.15);
  mRoof.map = mDoor.map = T_CANVAS; mRoof.side = THREE.DoubleSide;
  const mChrome = std('#e4e8ec', 0.25, 0.6), mGlass = new THREE.MeshStandardMaterial({ color: '#8fb4c8', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false });
  const mPlastic = new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const mTyre = std('#1a1a1c', 0.9), mWhite = std('#f3f1e8', 0.7), mSeat = std('#efe6cf', 0.8), mDark = std('#1d1c1e', 0.8), mFloor = std('#3a3430', 0.9);
  const mLamp = new THREE.MeshStandardMaterial({ color: '#fff7dc', emissive: '#ffe9a8', emissiveIntensity: 0.55, roughness: 0.2 });
  const mTail = new THREE.MeshStandardMaterial({ color: '#a01410', emissive: '#6a0a06', emissiveIntensity: 0.5, roughness: 0.4 });
  const mWood = std('#ffffff', 0.45); mWood.map = T_WOOD;
  const mShirt = std('#2c3a58', 0.9), mSkin = std('#c58b64', 0.8);
  const LIV = {
    blu:      { body: '#1d4fd0', arch: '#1d4fd0', roof: '#f3efe4', door: '#f3efe4', pillar: '#1d4fd0', cab: '#1d4fd0', rear: 'wood' },
    bianco:   { body: '#f1efe8', arch: '#f1efe8', roof: '#7a1830', door: '#7a1830', pillar: '#f1efe8', cab: '#f1efe8', rear: 'wood' },
    carretto: { body: '#f0c000', arch: '#d42a1f', roof: '#74182c', door: '#74182c', pillar: 'check', cab: 'folk', rear: 'folk' },
  };
  // Paints a set of the seven livery-dependent materials (the local car's, or a remote lapa's copies).
  function paintLivery(M, id) {
    const L = LIV[id]; if (!L) return false;
    const paint = (m, c, map) => { m.color.set(map ? '#ffffff' : c); if (m.map !== (map || null)) { m.map = map || null; m.needsUpdate = true; } };
    paint(M.body, L.body); paint(M.arch, L.arch);
    paint(M.roof, L.roof, T_CANVAS); M.roof.color.set(L.roof); paint(M.door, L.door, T_CANVAS); M.door.color.set(L.door);
    L.pillar === 'check' ? paint(M.pillar, null, T_CHECK) : paint(M.pillar, L.pillar);
    L.cab === 'folk' ? paint(M.cab, null, T_FOLK_CAB) : paint(M.cab, L.cab);
    paint(M.rear, null, L.rear === 'folk' ? T_FOLK_REAR : T_WOOD);
    return true;
  }
  function setLivery(id) {
    if (paintLivery({ body: mBody, arch: mArch, roof: mRoof, door: mDoor, pillar: mPillar, cab: mCabSide, rear: mRearSide }, id)) car.livery = id;
  }

  // --- geometry helpers ---
  const G = {}; const gcache = (k, f) => G[k] || (G[k] = f());
  const box = (w, h, d) => gcache(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r0, r1, h, s = 12, open = false, a0 = 0, a1 = TAU) => gcache(`c${r0},${r1},${h},${s},${open},${a0},${a1}`, () => new THREE.CylinderGeometry(r0, r1, h, s, 1, open, a0, a1));
  const wheelGeo = (r, w, s = 14) => gcache(`w${r},${w},${s}`, () => cyl(r, r, w, s).clone().rotateZ(PI / 2));
  function mesh(geo, mat, parent, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m;
  }
  // body parts take car-frame coordinates; tilt sits at PIV so subtract it
  const part = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = mesh(geo, mat, tilt, x, y - PIV, z); m.rotation.set(rx, ry, rz); return m; };

  // lower body: dark underbody, cab tub, nose, rear body with side panels (wood or painted)
  part(box(1.12, 0.1, 2.7), mDark, 0, 0.27, -0.1);
  part(new THREE.BoxGeometry(1.3, 0.5, 0.9), [mCabSide, mCabSide, mBody, mBody, mBody, mBody], 0, 0.53, 0.35);
  part(new THREE.BoxGeometry(1.3, 0.5, 1.5), [mRearSide, mRearSide, mFloor, mBody, mBody, mRearSide], 0, 0.53, -0.85);
  part(box(1.0, 0.52, 0.4), mBody, 0, 0.74, 0.97);                                  // cowl
  { const nose = part(cyl(0.5, 0.5, 0.52, 18), mBody, 0, 0.74, 1.0); nose.scale.set(1, 1, 0.82); }    // rounded nose
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.014, 6, 24), mChrome); ring.rotation.x = PI / 2; ring.scale.set(1, 0.82, 1); ring.position.set(0, 1.0 - PIV, 1.0); ring.castShadow = true; tilt.add(ring); }
  part(box(0.045, 0.46, 0.03), mChrome, 0, 0.78, 1.405);                            // chrome trim down the nose
  for (const sx of [-1, 1]) {
    part(new THREE.SphereGeometry(0.085, 10, 8), mLamp, sx * 0.27, 0.93, 1.355);
    part(new THREE.TorusGeometry(0.09, 0.012, 6, 14), mChrome, sx * 0.27, 0.93, 1.34);
    part(box(0.12, 0.05, 0.03), mTail, sx * 0.5, 0.64, -1.565);                       // tail lights
    // rear wheel arches
    const arch = part(cyl(0.285, 0.285, 0.2, 14, false, 0, PI).clone().rotateZ(PI / 2), mArch, sx * 0.66, 0.23, -0.7);
    arch.material = mArch;
  }
  mArch.side = THREE.DoubleSide;
  part(box(0.3, 0.1, 0.02), mWhite, 0, 0.45, -1.575);                               // number plate
  part(box(1.0, 0.05, 0.12), mChrome, 0, 0.32, -1.58); part(box(0.95, 0.05, 0.1), mChrome, 0, 0.32, 1.1); // bumpers

  // seats and driver
  part(box(0.55, 0.28, 0.45), mSeat, 0, 0.92, 0.18); part(box(0.55, 0.42, 0.09), mSeat, 0, 1.2, -0.07);
  part(box(1.12, 0.28, 0.5), mSeat, 0, 0.92, -1.2); part(box(1.12, 0.5, 0.09), mSeat, 0, 1.3, -1.48);
  part(box(0.42, 0.5, 0.24), mShirt, 0, 1.28, 0.12).userData.driver = true;
  { const h = part(new THREE.SphereGeometry(0.12, 10, 8), mSkin, 0, 1.68, 0.14); h.userData.driver = true; const c = part(box(0.26, 0.04, 0.2), mDark, 0, 1.78, 0.17); c.userData.driver = true; }
  const driverParts = tilt.children.filter(m => m.userData.driver);

  // windscreen, A-pillars, wiper and mirror (one group leaning back)
  { const ws = new THREE.Group(); ws.position.set(0, 1.0 - PIV, 0.8); ws.rotation.x = -0.15; tilt.add(ws);
    mesh(box(1.14, 0.7, 0.02), mGlass, ws, 0, 0.4, 0, false);
    mesh(box(1.22, 0.04, 0.04), mChrome, ws, 0, 0.0, 0); mesh(box(1.22, 0.04, 0.04), mChrome, ws, 0, 0.78, 0);
    mesh(box(0.025, 0.74, 0.022), mChrome, ws, 0, 0.4, 0.01);
    for (const sx of [-1, 1]) { mesh(box(0.05, 1.0, 0.05), mPillar, ws, sx * 0.62, 0.5, 0); }
    const wiper = mesh(box(0.5, 0.012, 0.012), mDark, ws, 0.2, 0.08, 0.02, false); wiper.rotation.z = 0.12;
    const arm = mesh(box(0.012, 0.26, 0.012), mChrome, ws, 0.68, 0.3, 0.05, false); arm.rotation.z = -0.15;
    mesh(box(0.14, 0.1, 0.02), mChrome, ws, 0.72, 0.46, 0.14);
  }
  // handlebar (turns with the front wheel)
  const bar = new THREE.Group(); bar.position.set(0, 1.12 - PIV, 0.62); tilt.add(bar);
  mesh(wheelGeo(0.015, 0.7, 8), mChrome, bar, 0, 0, 0, false); mesh(box(0.03, 0.2, 0.03), mChrome, bar, 0, -0.1, 0.0, false);
  for (const sx of [-1, 1]) mesh(wheelGeo(0.022, 0.1, 8), mDark, bar, sx * 0.36, 0, 0, false);

  // roof: canvas on a crowned, back-sloping panel, on chrome poles, with clear plastic at the back
  { const rg = new THREE.BoxGeometry(1.5, 0.05, 2.45, 8, 1, 10), p = rg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + z * 0.085 - x * x * 0.2 - (z > 0.9 ? (z - 0.9) * 0.15 : 0)); }
    rg.computeVertexNormals();
    part(rg, mRoof, 0, 1.97, -0.3);
    part(box(1.36, 0.03, 0.5), mRoof, 0, 1.56, -1.6, -1.3);                      // rear canvas flap sloping down
    part(box(1.5, 0.05, 0.03), mRoof, 0, 1.78, -1.52);                              // rear lip
    part(box(1.1, 0.4, 0.015), mPlastic, 0, 1.5, -1.47, -0.25);                    // rear window
  }
  for (const sx of [-1, 1]) {
    for (const z of [-1.45, -0.3]) part(cyl(0.017, 0.017, 1.1, 6), mChrome, sx * 0.66, 1.4, z);
    part(box(0.012, 0.55, 1.1), mPlastic, sx * 0.715, 1.52, -0.88);                 // side windows
    part(box(0.012, 0.3, 0.7), mPlastic, sx * 0.715, 1.6, 0.35);
  }
  // half doors (canvas on chrome frames, with hand-hold cut-outs)
  for (const sx of [-1, 1]) for (const [z, len] of [[-0.9, 0.9], [0.33, 0.7]]) {
    part(box(0.035, 0.4, len), mDoor, sx * 0.67, 0.99, z);
    part(box(0.05, 0.03, len + 0.04), mChrome, sx * 0.67, 1.2, z);
    part(box(0.05, 0.03, len + 0.04), mChrome, sx * 0.67, 0.79, z);
    part(box(0.052, 0.07, 0.22), mDark, sx * 0.67, 1.08, z);
  }

  // --- wheels: small whitewalls with chrome hubcaps. Rear pair on the ground, front one in a steering fork ---
  const wheelObjs = [];
  function makeWheel(parent, x, y, z, front) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const r = 0.23, w = 0.15;
    mesh(wheelGeo(r, w), mTyre, spin, 0, 0, 0); mesh(wheelGeo(r * 0.78, w + 0.012), mWhite, spin, 0, 0, 0, false);
    mesh(wheelGeo(r * 0.4, w + 0.026, 10), mChrome, spin, 0, 0, 0, false); mesh(box(w + 0.03, 0.03, r * 0.5), mDark, spin, 0, 0, 0, false);
    if (front) {
      for (const sx of [-1, 1]) mesh(box(0.025, 0.55, 0.04), mChrome, pivot, sx * 0.1, 0.27, 0, false);
      mesh(box(0.24, 0.04, 0.06), mChrome, pivot, 0, 0.5, 0, false);
      const fender = mesh(cyl(0.275, 0.275, 0.2, 14, false, 0, PI).clone().rotateZ(PI / 2), mArch, pivot, 0, 0, 0);
      void fender;
    }
    wheelObjs.push({ pivot, spin, front });
  }
  makeWheel(lean, 0, 0.23, 1.15, true);
  makeWheel(lean, 0.66, 0.23, -0.7, false); makeWheel(lean, -0.66, 0.23, -0.7, false);
  const model = { wheels: wheelObjs };

  // brake lights (glow over the tail lights) and nitro exhaust flames
  const brakeMat = new THREE.MeshBasicMaterial({ color: '#ff1a10', transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (const x of [-0.5, 0.5]) part(box(0.15, 0.07, 0.04), brakeMat, x, 0.64, -1.59, 0, 0, 0).castShadow = false;
  const flames = [];
  const flameOuter = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (const x of [-0.3, 0.3]) {
    const mk = (r, h, mat) => { const g = new THREE.ConeGeometry(r, h, 10, 1, true); g.translate(0, h / 2, 0); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, 0.36 - PIV, -1.6); m.visible = false; m.frustumCulled = false; tilt.add(m); return m; };
    flames.push([mk(0.1, 1, flameOuter), mk(0.05, 0.7, flameInner)]);
  }
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(160,210,255,0.7)'); gr.addColorStop(0.6, 'rgba(255,140,40,0.25)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.position.set(0, 0.4 - PIV, -1.95); glow.visible = false; tilt.add(glow);


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
    psiPrev: 0, psiDot: 0, dLatch: 0, ax: 0, ay: 0, braking: false, scrape: 0, tip: 0, livery: 'blu',
    hop: 0, hopV: 0, gripLoss: 0, kickT: 0, kickSgn: 0, skid: 0,   // road wear: bounce spring, grip lost to a pothole, forced two-wheel lean, tyre scrub 0..1
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
    Object.assign(car, { x: v[0], z: v[1], th: v[2], vx: 0, vz: 0, vf: 0, steer: 0, w: 0, sIn: 0, slip: 0, drift: 0, dLatch: 0, gear: 1, shiftT: 0, psiDot: 0, scrape: 0, hop: 0, hopV: 0, gripLoss: 0, kickT: 0, skid: 0 });
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
    const [x0, z0, x1, z1] = hooks.bounds; // world streaming (src/world.js) widens this to the whole city; defaults to D.bounds
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
    const brakeTurn = down && !up && vf > T.brakeTurnV && Math.abs(car.sIn) > 0.55;
    if (vf > T.driftV && (hb || brakeTurn)) car.dLatch = 0.35;
    car.dLatch = Math.max(0, car.dLatch - dt);
    let dT = 0;
    if (vf > T.driftV && (car.dLatch > 0 || (sa > 0.24 && !against))) dT = 1;
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
      const sp01 = clamp(vf / 28, 0, 1);
      car.nos = Math.min(1, car.nos + (T.nosSpeedFill * sp01 + T.nosDriftFill * d * clamp(sa / 0.35, 0, 1) * clamp(vf / 10, 0, 1)) * dt);
    }

    // rebuild world velocity after the drive forces
    car.vx = sn * vf + cs * vl; car.vz = cs * vf - sn * vl;

    // ----- yaw -----
    const v1 = Math.hypot(car.vx, car.vz);
    const delta = T.lock / (1 + (v1 / T.lockV) ** 2);
    const wCap = T.aGrip * 0.92 * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss) / Math.max(Math.abs(vf), 3);
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
      const aCap = lerp(T.aGrip, T.aDrift, d) * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss), kG = lerp(T.kGrip, T.kDrift, d);
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
    const tipT = Math.max(clamp((Math.abs(car.ay) - T.tipA0) / T.tipA1, 0, 1) * sstep(7, 12, Math.abs(vf)) * (1 - 0.8 * d), car.kickT);
    car.tip += (tipT - car.tip) * Math.min(1, (tipT > car.tip ? 7 : 4) * dt);
    const rollT = clamp(car.ay * T.rollGain, -T.rollMax, T.rollMax) + Math.atan(side);
    const pitchT = clamp(-car.ax * 0.0075, -0.09, 0.09) - Math.atan(slope);
    car.roll += (rollT - car.roll) * Math.min(1, 7 * dt);
    car.pitch += (pitchT - car.pitch) * Math.min(1, 7 * dt);
    car.lift += ((raisedMask(car.x, car.z) ? CURB : 0) - car.lift) * Math.min(1, 25 * dt);
    // road wear (src/roadwear.js): bounce spring after a pothole, grip and forced lean fade, and how hard the rear tyres scrub
    car.hopV += (-170 * car.hop - 8 * car.hopV) * dt; car.hop += car.hopV * dt;
    car.gripLoss = Math.max(0, car.gripLoss - dt / 0.7); car.kickT = Math.max(0, car.kickT - dt / 0.9);
    car.skid = vf > 3 ? Math.max(d * clamp((sa - 0.1) * 4, 0, 1), hb ? 0.9 : 0, brakeA >= T.brake && vf > 9 ? clamp((vf - 9) / 10, 0, 1) * 0.8 : 0) : 0;
  }

  // A wheel dropped into a pothole (src/roadwear.js): s = severity (about 0.1 small hole, 1 big hole at speed), side +1 left / -1 right,
  // pitch +1 front wheel (nose dips) / -1 rear. Bounces the body and camera; the caller handles speed, yaw, grip and tipping.
  function bump(s, side = 0, pitch = 0) {
    s = clamp(s, 0, 1.6);
    car.hopV = Math.min(2.2, car.hopV + 0.35 + 1.0 * s);
    car.pitch += pitch * 0.035 * s; car.roll += side * 0.05 * s;
    cam.trauma = Math.max(cam.trauma, Math.min(0.85, 0.12 + 0.5 * s));
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
    Promise.all([load('skid'), load('impact')]).then(([skid, imp]) => {
      const loop = (buf, filterType, f0) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filt = ctx.createBiquadFilter(); filt.type = filterType; filt.frequency.value = f0;
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(filt); filt.connect(gain); gain.connect(master); src.start();
        return { src, filt, gain };
      };
      audio.skid = loop(skid, 'lowpass', 5000);
      // nitro: looped white noise through a band-pass
      const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      audio.nos = loop(nb, 'bandpass', 1400); audio.nos.filt.Q.value = 0.7;
      // Engine: a small buzzy single-cylinder two-stroke, synthesised. Two detuned oscillators (saw plus a square an
      // octave up) through a resonant low-pass and a mid peak, chopped by a sawtooth LFO at the firing rate (the
      // "putt putt" at idle that blurs into a buzz), plus a little high-passed exhaust rasp.
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square'; lfo.type = 'sawtooth';
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      const mix = ctx.createGain(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), am = ctx.createGain(), out = ctx.createGain();
      lp.type = 'lowpass'; lp.Q.value = 2.5; pk.type = 'peaking'; pk.frequency.value = 900; pk.gain.value = 7; pk.Q.value = 1.2;
      am.gain.value = 0.62; out.gain.value = 0;
      const lg = ctx.createGain(); lg.gain.value = -0.34; lfo.connect(lg); lg.connect(am.gain);
      o1.connect(mix); o2.connect(g2); g2.connect(mix); mix.connect(lp); lp.connect(pk); pk.connect(am); am.connect(out); out.connect(master);
      const rasp = ctx.createBufferSource(); rasp.buffer = nb; rasp.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; const ng = ctx.createGain(); ng.gain.value = 0;
      rasp.connect(hp); hp.connect(ng); ng.connect(out);
      for (const o of [o1, o2, lfo, rasp]) o.start();
      audio.engine = { o1, o2, lfo, lp, out, ng };
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
    const f1 = 62 + 175 * rpm + 18 * car.nosAmt;
    set(a.engine.o1.frequency, f1, 0.03); set(a.engine.o2.frequency, f1 * 2.01, 0.03);
    set(a.engine.lfo.frequency, 7 + 52 * rpm, 0.04);
    set(a.engine.lp.frequency, 700 + 3500 * (0.3 + 0.7 * thr) * (0.4 + 0.6 * rpm), 0.06);
    set(a.engine.out.gain, active ? 0.16 + 0.2 * thr + 0.08 * rpm : 0, 0.08);
    set(a.engine.ng.gain, active ? 0.02 + 0.07 * thr * rpm : 0, 0.08);
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
    const v = Math.hypot(car.vx, car.vz), sp01 = clamp(v / 32, 0, 1);
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
    const fovT = baseFov + sp01 * 11 + cam.nosEnv * 10 + cam.kick * 6;
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
      camera.position.set(car.x + f.x * 0.3 + sx, gy + car.lift + car.hop * 0.7 + 1.55 + sy, car.z + f.z * 0.3 + sz);
      camera.lookAt(car.x + f.x * 20, gy + 1.2 + (groundY(car.x + f.x * 20, car.z + f.z * 20) - gy), car.z + f.z * 20);
      camera.rotateZ(cam.roll + car.roll * 0.5);
      camState.init = true;
      for (const d of driverParts) d.visible = false;
      return;
    }
    for (const d of driverParts) d.visible = true;
    const [dist0, h] = [[5.8, 2.7], [13, 7], null, [3, 130]][m];
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
    camera.position.set(p.x + sx, p.y + sy + (m === 3 ? 0 : car.hop * 0.6), p.z + sz);
    const look = f.clone().multiplyScalar(m === 3 ? 0 : 3.5).add(_p.set(car.x, gy + 1.3, car.z));
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
    g.position.set(car.x, groundY(car.x, car.z) + car.lift + car.hop, car.z); g.rotation.y = car.th;
    tilt.rotation.set(car.pitch, 0, car.roll);
    // two-wheel lean: tip about the outer rear wheel's contact line (left turn = ay > 0 = lean right, outer wheel on the right)
    {
      const sg = Math.abs(car.ay) < 1 && car.kickT > 0 ? car.kickSgn : Math.sign(car.ay);
      const th = car.tip * T.tipMax * sg, px = -0.66 * sg;
      lean.rotation.z = th; lean.position.set(px * (1 - Math.cos(th)), -px * Math.sin(th), 0);
    }
    const spin = (car.vf || 0) * dt / 0.23;
    for (const w of model.wheels) {
      const locked = w.front ? false : (keys.Space && Math.abs(car.vf) > 1);
      if (!locked) w.spin.rotation.x += spin;
      if (w.front) w.pivot.rotation.y = car.steer;
    }
    bar.rotation.y = car.steer * 0.9;
    brakeMat.opacity = active && (car.braking || keys.Space) ? 0.85 : 0;

    // nitro flames
    const n = car.nosAmt, fl = n > 0.05;
    glow.visible = fl;
    for (const [o, i] of flames) {
      o.visible = i.visible = fl;
      if (fl) {
        const flick = 0.8 + Math.random() * 0.4;
        o.scale.set(1.3, 1.3, (0.7 + 2.2 * n) * flick); i.scale.set(1.3, 1.3, (0.5 + 1.6 * n) * flick);
      }
    }
    if (fl) { glow.scale.setScalar(1.0 + 1.6 * n * (0.85 + Math.random() * 0.3)); glow.material.opacity = 0.9 * n; }

    // tyre smoke while sliding, braking hard with the handbrake, or scraping
    const sp = Math.abs(car.vf);
    const slideAmt = Math.max(clamp((Math.abs(car.slip) - 0.18) * 3, 0, 1) * (car.drift > 0.3 ? 1 : 0), keys.Space && sp > 6 ? 0.8 : 0) * clamp(sp / 10, 0, 1);
    if (active && slideAmt > 0.1) {
      smokeAcc += dt * 38 * slideAmt;
      const sn = Math.sin(car.th), cs = Math.cos(car.th);
      while (smokeAcc >= 1) {
        smokeAcc -= 1;
        const sgn = Math.random() < 0.5 ? 1 : -1;
        puff(car.x - sn * 0.7 + cs * 0.66 * sgn + (Math.random() - 0.5) * 0.3, g.position.y + 0.15, car.z - cs * 0.7 - sn * 0.66 * sgn + (Math.random() - 0.5) * 0.3,
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

  // ---------- remote lapas (src/net.js) ----------
  // buildLapa(liveryId) returns a cheap copy of the model for another player: the same construction as above, merged
  // into one mesh per material (about 35 draw calls instead of about 120), with its own livery materials, shared geometry,
  // and the same group hierarchy as the local car. The caller poses it: root (position, yaw) > lean (tip) > tilt (pitch, roll),
  // wheels[i].spin.rotation.x, wheels[i].pivot.rotation.y (front only: steer), bar.rotation.y. It never touches the local car.
  let lapaTpl = null;
  const lapaSkip = new Set([brakeMat, flameOuter, flameInner]);
  function lapaTemplate() {
    if (lapaTpl) return lapaTpl;
    // read the model in its neutral pose, then put the live pose back
    const saved = [tilt.rotation.clone(), lean.rotation.clone(), lean.position.clone(), bar.rotation.clone(), ...wheelObjs.map(w => [w.spin.rotation.clone(), w.pivot.rotation.clone()])];
    tilt.rotation.set(0, 0, 0); lean.rotation.set(0, 0, 0); lean.position.set(0, 0, 0); bar.rotation.set(0, 0, 0);
    for (const w of wheelObjs) { w.spin.rotation.set(0, 0, 0); w.pivot.rotation.set(0, 0, 0); }
    carRoot.updateMatrixWorld(true);
    const collect = (rootObj, refObj, skip) => {
      const buckets = new Map(), inv = refObj.matrixWorld.clone().invert();
      rootObj.traverse(m => {
        if (!m.isMesh || (skip && skip(m))) return;
        const rel = inv.clone().multiply(m.matrixWorld);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat, mi) => {
          if (lapaSkip.has(mat)) return;
          let g = m.geometry.clone();
          if (Array.isArray(m.material)) { // one slot of a multi-material box: keep only its triangles
            const idx = [], ia = g.index.array;
            for (const gr of g.groups) if (gr.materialIndex === mi) for (let i = gr.start; i < gr.start + gr.count; i++) idx.push(ia[i]);
            g.setIndex(idx);
          }
          g.clearGroups(); g.applyMatrix4(rel);
          let b = buckets.get(mat); if (!b) buckets.set(mat, b = { mat, geoms: [], shadow: false });
          b.geoms.push(g); b.shadow = b.shadow || (m.castShadow && !mat.transparent);
        });
      });
      return [...buckets.values()].map(b => ({ mat: b.mat, shadow: b.shadow, geom: mergeGeometries(b.geoms) })).filter(b => b.geom);
    };
    const inBar = m => { for (let p = m.parent; p; p = p.parent) if (p === bar) return true; return false; };
    const front = wheelObjs.find(w => w.front);
    lapaTpl = {
      tilt: collect(tilt, tilt, m => inBar(m)), bar: collect(bar, bar),
      spin: collect(front.spin, front.spin), front: collect(front.pivot, front.pivot, m => { for (let p = m.parent; p; p = p.parent) if (p === front.spin) return true; return false; }),
      wheels: wheelObjs.map(w => ({ pos: w.pivot.position.clone(), front: w.front })), barPos: bar.position.clone(), mats: {},
    };
    tilt.rotation.copy(saved[0]); lean.rotation.copy(saved[1]); lean.position.copy(saved[2]); bar.rotation.copy(saved[3]);
    wheelObjs.forEach((w, i) => { w.spin.rotation.copy(saved[4 + i][0]); w.pivot.rotation.copy(saved[4 + i][1]); });
    carRoot.updateMatrixWorld(true);
    return lapaTpl;
  }
  function buildLapa(id) {
    const tpl = lapaTemplate();
    if (!LIV[id]) id = 'blu';
    let map = tpl.mats[id];
    if (!map) { // this livery's copies of the seven painted materials
      const set = { body: mBody, arch: mArch, roof: mRoof, door: mDoor, pillar: mPillar, cab: mCabSide, rear: mRearSide };
      const copy = {}; map = tpl.mats[id] = new Map();
      for (const k in set) { copy[k] = set[k].clone(); map.set(set[k], copy[k]); }
      paintLivery(copy, id);
    }
    const root = new THREE.Group(), lean2 = new THREE.Group(), tilt2 = new THREE.Group(), meshes = [];
    root.add(lean2); lean2.add(tilt2); tilt2.position.y = PIV;
    const add = (parent, list) => { for (const b of list) { const m = new THREE.Mesh(b.geom, map.get(b.mat) || b.mat); m.castShadow = b.shadow; parent.add(m); meshes.push(m); } };
    add(tilt2, tpl.tilt);
    const bar2 = new THREE.Group(); bar2.position.copy(tpl.barPos); tilt2.add(bar2); add(bar2, tpl.bar);
    const wheels = tpl.wheels.map(w => {
      const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.copy(w.pos); lean2.add(pivot); pivot.add(spin);
      add(spin, tpl.spin); if (w.front) add(pivot, tpl.front);
      return { pivot, spin, front: w.front };
    });
    return { root, lean: lean2, tilt: tilt2, bar: bar2, wheels, meshes, PIV, tipMax: T.tipMax };
  }

  setLivery('blu');
  return { car, camState, placeAt, physics, updateVisual, updateCamera, setVolume, LIVERIES, setLivery, buildLapa, bump };
}
