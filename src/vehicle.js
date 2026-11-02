// Player vehicle: seven vehicles (three lape, three two-wheelers, a tamarro hatchback), handling with drift/nitro/two-wheel lift
// for the lape, leaning and wheelies for the bikes, tamarro tuning parts, synthesised engines, collision response and chase camera.
// Owned by the driving work. Models are built in src/vehicle-models.js, sound in src/vehicle-audio.js, the saved look and wallet in src/garage.js.
// main.js owns input (env.keys), the world and the render loop; it calls physics(dt) at a fixed 120 Hz, then updateVisual(dt) and
// updateCamera(dt) once per frame.
//
// Handling is an arcade bicycle model tuned for fun on a keyboard or phone pads (feel inspired by classic arcade street racers): lots of
// grip and a speed-sensitive steering lock for normal driving, and a separate drift state (handbrake, brake-tap-and-turn, or a big slide)
// in which steering sets the slip angle you hold instead of the yaw rate. Velocity is rotated towards the nose by a capped "tyre" rate, so
// grip loss, slides and drifts all come from one rule. Lape are tall, so they roll a lot and tip onto two wheels in hard fast turns.
// Bikes bank into corners instead, pop wheelies on a launch and can be high-sided by a big pothole. The car just grips more.
// The rolling-ball model in src/vehicle-sphere.js is the default for the yaw, grip, movement and wall part (same inputs and car fields); ?physics=classic gets the bicycle model.
// ?speed=N scales every vehicle's speed and acceleration (default 1.5, 1 is the original feel); see SPEED_SCALE.
import * as THREE from 'three';
import { D, groundY, hooks } from './core.js';
import { garage, cleanLook, lookKey, LIVERIES as ALL_LIVERIES, VEHICLES } from './garage.js';
import { buildVehicleModel, buildLocalRig, repaint, tickShared, geoKey } from './vehicle-models.js';
import { createVehicleAudio } from './vehicle-audio.js';
import { createVehicleEvents } from './vehicle-events.js';
import { createSphere } from './vehicle-sphere.js';
import { createWater, WET_TOP, WET_GRIP } from './vehicle-water.js';   // floats: drive on the sea (src/vehicle-water.js)
import { createAir, CAP as AIR_CAP } from './vehicle-air.js';   // wings: fly (src/vehicle-air.js)
import { createTrails } from './vehicle-trails.js';   // vapour from the wing tips while flying (src/vehicle-trails.js)
import { QUALITY } from './mobile.js';
import { vp } from './viewport.js';
import { createCameraClear } from './camera-clear.js';   // the chase camera stays under tunnel roofs, gate vaults and flyover decks

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => a - TAU * Math.floor((a + PI) / TAU);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- tuning ----------
// BASE is the Calessino. Each vehicle overrides what makes it feel different (see PRESET).
const BASE = {
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
  nG: 5,
  gearV: [0, 7, 12, 18.5, 24.5, 30],      // speed at the rev limiter in each gear, m/s (top about 108 km/h)
  gearA: [0, 9.2, 7.0, 5.2, 4.0, 3.1],    // peak engine acceleration in each gear, m/s^2
  cvt: false,        // scooters: one smooth gear, rpm follows the throttle
  brake: 14, hbrake: 4.5, reverseV: 6, reverseA: 5,
  drag: 0.0012, roll: 0.35,
  nosTime: 3.4,      // seconds of boost from a full bar
  nosThrust: 6.0, nosTop: 1.17, nosTorque: 1.3,   // about 124 km/h flat out with nitro
  nosDriftFill: 0.24, nosSpeedFill: 0.04,
  tipA0: 8.5, tipA1: 3, tipMax: 0.17, tipGrip: 0.12,   // lateral accel where the inner wheels start to lift, range, max extra lean (rad), grip lost at full lift
  rollGain: 0.0085, rollMax: 0.16, pitchK: 0.0075, pitchMax: 0.09,
  bike: false, bankGain: 0, bankMax: 0.6, wheelie: 0, wheelV: 14,   // bikes: lean per m/s^2, max lean, max wheelie (rad), speed where it fades
  R: 0.74, AXLE: 0.72,   // collision: two circles of radius R, AXLE metres ahead of and behind the centre
  camK: 1, camH: 1.3, eye: 1.55,   // chase camera scale, look-at height, bonnet camera height
};
const PRESET = {
  calessino: {},
  // loaded cargo lapa: heavier, slower, tips sooner, long wheelbase
  cassone: { L: 2.1, lock: 0.66, aGrip: 11, aDrift: 7.6, gearV: [0, 6, 10.5, 16, 21.5, 26], gearA: [0, 7.4, 5.7, 4.2, 3.2, 2.5], brake: 12, tipA0: 7.2, tipMax: 0.2, nosThrust: 5, AXLE: 0.82, camK: 1.12, camH: 1.5, eye: 1.62 },
  // small, light and nimble, but weak and tippy
  lapa50: { L: 1.55, lock: 0.82, aGrip: 11.5, aDrift: 7.8, gearV: [0, 6, 10, 15, 20, 25], gearA: [0, 8.4, 6.2, 4.6, 3.5, 2.7], tipA0: 7.4, tipMax: 0.2, R: 0.64, AXLE: 0.58, camK: 0.92, camH: 1.25, eye: 1.45, nosThrust: 5 },
  // Vespa: quick off the line, leans, pops a wheelie, tops out at about 100 km/h
  vespa: { bike: true, nG: 4, gearV: [0, 7, 13, 21, 28], gearA: [0, 9.6, 7.2, 5.2, 3.9], L: 1.2, lock: 0.55, aGrip: 11.5, aDrift: 8.2, kGrip: 18, tipGrip: 0, tipA0: 99, rollGain: 0, rollMax: 0, bankGain: 0.047, bankMax: 0.62, wheelie: 0.34, wheelV: 13, pitchK: 0.016, pitchMax: 0.17, R: 0.46, AXLE: 0.5, camK: 0.84, camH: 1.15, eye: 1.62, brake: 12.5, hbrake: 4, scrubSlip: 3.2 },
  // big-wheel scooter: smooth CVT, stable, fast, hardly wheelies
  scooterone: { bike: true, nG: 1, cvt: true, gearV: [0, 32], gearA: [0, 6.6], L: 1.4, lock: 0.5, aGrip: 12.5, aDrift: 8.8, kGrip: 18, tipGrip: 0, tipA0: 99, rollGain: 0, rollMax: 0, bankGain: 0.04, bankMax: 0.58, wheelie: 0.13, wheelV: 11, pitchK: 0.016, pitchMax: 0.15, R: 0.5, AXLE: 0.56, camK: 0.88, camH: 1.25, eye: 1.7, brake: 13.5, nosThrust: 6.4 },
  // little naked bike: revvy, twitchy, big wheelies
  motorino: { bike: true, nG: 5, gearV: [0, 8, 14, 20, 27, 34], gearA: [0, 11, 8.2, 6.2, 4.8, 3.8], L: 1.3, lock: 0.5, aGrip: 12.8, aDrift: 8.8, kGrip: 19, tipGrip: 0, tipA0: 99, rollGain: 0, rollMax: 0, bankGain: 0.05, bankMax: 0.72, wheelie: 0.62, wheelV: 17, pitchK: 0.018, pitchMax: 0.18, R: 0.44, AXLE: 0.52, camK: 0.84, camH: 1.15, eye: 1.55, brake: 14, nosThrust: 6.6, sigMax: 0.65 },
  // horse and sulky (the night race, not in the garage): fast in a straight line, understeers through wide turns, no tipping
  sulky: { L: 3.2, lock: 0.45, lockV: 18, aGrip: 8.5, aDrift: 6.5, kGrip: 9, sigMax: 0.5, nG: 1, cvt: true, gearV: [0, 25], gearA: [0, 8.8], brake: 9, hbrake: 3.5, tipA0: 99, tipMax: 0, tipGrip: 0, rollGain: 0.002, rollMax: 0.04, pitchK: 0.004, R: 0.6, AXLE: 1.0, camK: 1.25, camH: 1.6, eye: 1.9, nosThrust: 4, nosTop: 1.1 },
  // tamarro hatchback: grippy, quick, flat, a long wheelbase for stability
  tascia: { L: 2.4, lock: 0.62, aGrip: 15.5, aDrift: 10.8, kGrip: 18, gearV: [0, 8, 14, 21, 28, 35], gearA: [0, 9.8, 7.6, 5.8, 4.5, 3.6], tipA0: 99, tipMax: 0, tipGrip: 0, rollGain: 0.0042, rollMax: 0.08, pitchK: 0.006, R: 0.8, AXLE: 0.95, camK: 1.1, camH: 1.2, eye: 1.25, brake: 16, hbrake: 5.5, nosThrust: 6.4 },
};
// Owner request: everything faster. SPEED_SCALE multiplies top speeds, engine and nitro acceleration; braking, coasting drag, grip and the speed-sensitive
// steering lock scale with it so the handling keeps its character (see applyPreset). ?speed=1 gives the original feel. races.js reads it for the opponents.
export const SPEED_SCALE = +new URLSearchParams(location.search).get('speed') || 1.5;
const SS = SPEED_SCALE;
const T = { ...BASE };
const MODEL_LEN = 3.1;
// the paint schemes of the current vehicle: [{ id, name_it, name_en, color }]; ui and net read this
export const LIVERIES = ALL_LIVERIES.calessino;

export function createVehicle(env) {
  const { scene, camera, keys, walls2d, closestOnSeg, raisedMask, CURB, roadVerts, viewBlock, sea, world } = env;   // viewBlock(x0, z0, x1, z1): where tall props hide the car from the chase camera (props.js occlude), optional
  const baseFov = camera.fov;
  const audio = createVehicleAudio({ keys });

  // ---------- the rig: the vehicle model currently driven (rebuilt when the vehicle or a geometry part changes) ----------
  // rig.root (world position and yaw) > lean (tips or banks) > tilt (pitch, roll) > [driver, bar, wheels, parts]. See vehicle-models.js.
  let rig = null, curLook = null, savedLook = null, previewing = false;
  const flameOuter = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flameGeo = (r, h) => { const g = new THREE.ConeGeometry(r, h, 10, 1, true); g.translate(0, h / 2, 0); g.rotateX(-PI / 2); return g; };
  const FLAME_O = flameGeo(0.1, 1), FLAME_I = flameGeo(0.05, 0.7);
  const brakeMat = new THREE.MeshBasicMaterial({ color: '#ff1a10', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const BRAKE_G = new THREE.BoxGeometry(0.15, 0.07, 0.04);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(160,210,255,0.7)'); gr.addColorStop(0.6, 'rgba(255,140,40,0.25)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.visible = false;
  let flames = [], rearZ = 0.7, rearTrack = 0.66, hornCustom = false, stripped = false, holdSimFlag = false, swapLock = false, events = null;


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
    psiPrev: 0, psiDot: 0, dLatch: 0, ax: 0, ay: 0, braking: false, scrape: 0, tip: 0, livery: 'blu', type: 'calessino', kind: 'lapa',
    hop: 0, hopV: 0, gripLoss: 0, kickT: 0, kickSgn: 0, skid: 0,   // road wear: bounce spring, grip lost to a pothole, forced two-wheel lean / high-side, tyre scrub 0..1
    lean: 0,           // signed visual lean -1..1 (lapa: tip * side, bike: bank). net.js sends this.
    bank: 0, bankV: 0, wheelie: 0, hsT: 0, hsSgn: 0, hsCool: 0, spin: 0, bass: 0,   // bikes
  };
  let ticks = 0, seenTicks = 0, idleFrames = 99;
  let hitMag = 0, hitId = 0, nosStartId = 0;

  function nearestRoad(x, z) {
    let best = null, bd = Infinity;
    for (const v of roadVerts) { const d = (v[0] - x) ** 2 + (v[1] - z) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  }
  function placeAt(x, z, th) {   // th given: exactly there, facing th (test link ?at=x,z,th: the stadium's pitch, a roof...); else on the nearest road vertex
    const v = th === undefined ? nearestRoad(x, z) : [x, z, th];
    Object.assign(car, { x: v[0], z: v[1], th: v[2], vx: 0, vz: 0, vf: 0, steer: 0, w: 0, sIn: 0, slip: 0, drift: 0, dLatch: 0, gear: 1, shiftT: 0, psiDot: 0, scrape: 0, hop: 0, hopV: 0, gripLoss: 0, kickT: 0, skid: 0, bank: 0, bankV: 0, wheelie: 0, hsT: 0, hsCool: 0 });
    camState.init = false;
    sphere.reset(); air.reset(); water.reset();
  }

  // ---------- collision ----------
  // Two circles along the car against the building wall segments. A contact is resolved with an
  // impulse (small bounce, tangential friction so the car scrapes along instead of stopping, a bit of
  // yaw) and a position push. Called on sub-steps of at most 0.35 m so nothing can tunnel.
  const I_YAW = 1.7;
  // ground under the classic model's car: the terrain, or the bridge deck / tunnel floor it is on (hooks.level, src/bridges.js); car.deck is its height over the terrain
  const gB = (x, z) => { if (hooks.level && car.deck) { const y = hooks.level(x, z, groundY(car.x, car.z) + car.deck + 0.3); if (y === y) return y; } return groundY(x, z); };
  function collide() {
    const sn = Math.sin(car.th), cs = Math.cos(car.th);
    let touched = false;
    for (const sgn of [1, -1]) {
      const a = T.AXLE * sgn;
      const cx = car.x + sn * a, cz = car.z + cs * a;
      let px = 0, pz = 0;
      walls2d.query(cx - T.R, cz - T.R, cx + T.R, cz + T.R, s => {
        if (s.lv !== undefined && (Math.abs(groundY(car.x, car.z) + (car.deck || 0) - s.lv) > 2.6 || car.vault > 0)) return;   // a parapet or tunnel wall on another level, or a car in the air
        if (car.flying && s.lv === undefined && car.fy > (s.top !== undefined ? s.top : groundY((s[0] + s[2]) * 0.5, (s[1] + s[3]) * 0.5) + 4) - 1.2) return;   // flying: a wall stops the lapa only below its top (as in src/vehicle-sphere.js)
        const [qx, qz] = closestOnSeg(cx + px, cz + pz, s);
        const dx = cx + px - qx, dz = cz + pz - qz, d = Math.hypot(dx, dz);
        if (d >= T.R) return;
        if (s.fn && hooks.breakFence) { const nn = d > 1e-4 ? [dx / d, dz / d] : [0, 0], vs = -(car.vx * nn[0] + car.vz * nn[1]); if (vs > 0 && hooks.breakFence(s, vs, nn[0], nn[1], car)) return; }   // a fence panel: smashed above a speed (src/fences.js)
        // a jump bridge (LANDMARK_ZONES in src/bridges.js): fast and fairly square on, the parapet is vaulted and the car flies off the deck
        if (s.jump && Math.hypot(car.vx, car.vz) > 11 && (car.vx * dx + car.vz * dz) / d < -4.5) { car.vault = 2.5; car.dfv = 2.5; return; }
        let nx, nz;
        if (d > 1e-4) { nx = dx / d; nz = dz / d; }
        else { const ex = s[2] - s[0], ez = s[3] - s[1], el = Math.hypot(ex, ez) || 1; nx = -ez / el; nz = ex / el; }
        const push = T.R - d;
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

  // Test links: ?drive=KeyW,KeyD holds those keys; &freeze=2.5 stops the simulation after 2.5 s of driving (for screenshots).
  const qs = new URLSearchParams(location.search), freezeAt = qs.has('freeze') ? +qs.get('freeze') : -1;
  const SIDECAM = qs.has('sidecam') ? +qs.get('sidecam') || 4.5 : 0;
  let simT = 0, frozen = false;
  // the sphere model (src/vehicle-sphere.js, the default) replaces the yaw, grip, movement and wall response below; everything else is shared
  let SPHERE = qs.get('physics') !== 'classic';   // switchable at run time: api.setPhysics('classic' | 'sphere')
  const water = createWater({ car, sea });
  const sphere = createSphere({ car, T, walls2d, closestOnSeg, raisedMask, CURB, groundY, hooks, onHit: m => { if (m > hitMag) hitMag = m; }, waterAt: water.floorAt });
  const trails = createTrails({ scene });
  const air = createAir({ car, keys, groundY, floorAt: sphere.floorAt, roofAt: (x, z) => world ? world.roofAt(x, z) : NaN, detailAt: (x, z) => world ? world.detailAt(x, z) : 2, isWater: water.isWater, onEvent: (kind, a, b, x, z) => airEvent(kind, a, b, x, z) });
  if (qs.get('drive')) for (const k of qs.get('drive').split(',')) keys[k.length === 1 ? 'Key' + k.toUpperCase() : k] = true;
  let prevFlying = false;
  function physics(dt) {
    ticks++;
    if (frozen || holdSimFlag) return;
    if (freezeAt >= 0 && (simT += dt) >= freezeAt) { frozen = true; console.warn('[veh]', JSON.stringify({ type: car.type, vf: +car.vf.toFixed(1), wheelie: +car.wheelie.toFixed(2), pitch: +car.pitch.toFixed(2), bank: +car.bank.toFixed(2), tip: +car.tip.toFixed(2), ay: +car.ay.toFixed(1), gear: car.gear })); }
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
    const nosFree = car.flying && car.agl > 1;   // up in the air the nitro never runs out (src/vehicle-air.js)
    if (!nosKey || nosFree) car.nosLock = false;
    const nosWant = !!nosKey && (nosFree || (car.nos > 0.002 && !car.nosLock)) && vf > -1;
    if (nosKey && !nosFree && car.nos <= 0.002) car.nosLock = true;
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
    if (vf > T.driftV && (car.dLatch > 0 || (sa > (SPHERE ? 0.42 : 0.24) && !against))) dT = 1;
    car.drift += (dT - car.drift) * Math.min(1, (dT > car.drift ? 10 : 5) * dt);
    const d = car.drift;

    // ----- floats and wings (src/vehicle-water.js, src/vehicle-air.js): how wet we are, and the height while we fly -----
    water.step(dt);
    if (car.wings || car.flying) air.step(dt, SPHERE ? sphere.state.y : groundY(car.x, car.z) + car.lift);
    const wet = car.wet || 0, flying = !!car.flying;

    // ----- longitudinal -----
    const thrOn = up || nosWant;
    let g = car.gear;
    const vMul = (1 + (T.nosTop - 1) * nm) * (1 - (1 - WET_TOP) * wet);   // on the water the gears top out lower
    let aDrive = 0, brakeA = 0;
    if (car.shiftT > 0) car.shiftT -= dt;
    else {
      const r = Math.abs(vf) / (T.gearV[g] * vMul);
      if (g < T.nG && r > 0.95 && thrOn && vf > 0) { g++; car.shiftT = 0.1; }
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
    if (hb) brakeA += T.hbrake * (SPHERE ? 0.45 : 1);   // sphere: the handbrake is mostly a yaw flick and a grip cut, not a brake
    if (car.gripLoss > 0) { aDrive *= 1 - 0.4 * car.gripLoss; brakeA *= 1 - 0.5 * car.gripLoss; }   // e6: gravel, sand and grass (src/world.js drivePlayer) and potholes: the tyres spin and lock before they bite
    // in the air nothing rolls or brakes the engine, so the speed holds when the throttle is let go; on the water what is above the water top speed is dragged off
    const coast = flying ? 0.25 + 0.5 * T.drag * vf * vf : (thrOn ? 0 : 1.1 * SS) + T.roll + T.drag * vf * vf + wet * 0.55 * Math.max(0, Math.abs(vf) - WET_TOP * T.gearV[T.nG]);
    // Gravity along the slope: the Cassaro really does climb towards Porta Nuova.
    const slope = flying ? 0 : (gB(car.x + sn * 1.2, car.z + cs * 1.2) - gB(car.x - sn * 1.2, car.z - cs * 1.2)) / 2.4;
    vf += (aDrive - 9.81 * slope) * dt;
    if (flying && car.agl > 3 && vf > AIR_CAP) vf -= (vf - AIR_CAP) * Math.min(1, 4 * dt);   // the tile streamer cannot build the city faster than this (measured, see CAP in src/vehicle-air.js)
    const resist = (brakeA + coast) * dt;
    vf = Math.abs(vf) <= resist ? 0 : vf - Math.sign(vf) * resist;
    // rpm for the gauge and the engine sound
    rr = Math.abs(vf) / (T.gearV[g] * vMul);
    const rpmT = T.cvt ? clamp(0.3 + 0.45 * Math.max(car.thr, car.nosAmt) + 0.25 * rr, 0.14, 1.02) : clamp(Math.max(0.16 + 0.12 * car.thr, rr), 0.14, 1.02) * (car.shiftT > 0 ? 0.88 : 1);
    car.rpm += (rpmT - car.rpm) * Math.min(1, 14 * dt);
    car.ax += ((vf - car.lastVf) / dt - car.ax) * Math.min(1, 8 * dt);
    car.lastVf = vf;

    // nitro bar: burns while boosting, refills with speed and (a lot) with drifting
    if (nosWant && !nosFree) car.nos = Math.max(0, car.nos - dt / T.nosTime);
    else {
      const sp01 = clamp(vf / (28 * SS), 0, 1);
      car.nos = Math.min(1, car.nos + (T.nosSpeedFill * sp01 + T.nosDriftFill * d * clamp(sa / 0.35, 0, 1) * clamp(vf / 10, 0, 1)) * dt);
    }

    // rebuild world velocity after the drive forces
    car.vx = sn * vf + cs * vl; car.vz = cs * vf - sn * vl;

    if (SPHERE) sphere.step(dt, { hb, d, against });
    else {
      // ----- yaw -----
      const v1 = Math.hypot(car.vx, car.vz);
      const delta = T.lock / (1 + (v1 / T.lockV) ** 2);
      const wCap = T.aGrip * 0.92 * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss) / Math.max(Math.abs(vf), 3);
      const wN = clamp(vf * Math.tan(delta * car.sIn) / T.L, -wCap, wCap) * (1 - 0.5 * car.wheelie / (T.wheelie || 1));
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
        const wetG = 1 - WET_GRIP * wet, aCap = lerp(T.aGrip, T.aDrift, d) * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss) * wetG, kG = lerp(T.kGrip, T.kDrift, d) * wetG;
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

    }

    sn = Math.sin(car.th); cs = Math.cos(car.th);
    car.vf = car.vx * sn + car.vz * cs;
    car.ay += (car.w * car.vf - car.ay) * Math.min(1, 10 * dt);

    // Body sits on the terrain, plus cosmetic weight transfer: roll out of the corner, dive and squat.
    const lx = cs, lz = -sn;
    const side = SPHERE ? sphere.state.side : (gB(car.x + lx * 0.8, car.z + lz * 0.8) - gB(car.x - lx * 0.8, car.z - lz * 0.8)) / 1.6;
    if (T.bike) {
      // lean into the corner: a damped spring on the bank angle (so a pothole can kick it); wheelie from the throttle at low speed
      const bt = clamp(car.ay * T.bankGain, -T.bankMax, T.bankMax) * sstep(1.5, 5, Math.abs(vf));
      car.bankV += (-90 * (car.bank - bt) - 12 * car.bankV) * dt; car.bank += car.bankV * dt; car.bank = clamp(car.bank, -1.1, 1.1);
      const wT = T.wheelie * Math.max(car.thr, car.nosAmt) * (car.gear <= 2 ? 1 : 0) * (1 - sstep(T.wheelV * 0.5, T.wheelV, vf)) * (vf > -0.5 && !car.braking ? 1 : 0) * (1 + 0.4 * car.nosAmt);
      car.wheelie += (wT - car.wheelie) * Math.min(1, (wT > car.wheelie ? 4.5 : 2.5) * dt);
      // high-side: a big pothole hit (roadwear sets kickT) dips the bike, then flicks it hard to the other side; it never falls over
      car.hsCool -= dt;
      if (car.hsT > 0) {
        const t0 = car.hsT; car.hsT -= dt; car.gripLoss = Math.max(car.gripLoss, 0.55);
        if (t0 > 0.8 && car.hsT <= 0.8) { car.bankV -= car.hsSgn * 7.5; car.w += -car.hsSgn * 1.4; car.vx *= 0.84; car.vz *= 0.84; car.hopV = Math.min(2.6, car.hopV + 1.2); cam.trauma = Math.max(cam.trauma, 0.85); }
      } else if (car.kickT > 0.3 && vf > 7 && car.hsCool <= 0) {
        car.hsT = 1.1; car.hsSgn = car.kickSgn || (Math.random() < 0.5 ? 1 : -1); car.hsCool = 2.5; car.bankV += car.hsSgn * 3.2;
      }
      car.tip += (car.wheelie / T.wheelie - car.tip) * Math.min(1, 8 * dt);   // "two wheels" for the missions bonus is the wheelie
      car.lean = clamp(car.bank / T.bankMax, -1, 1);
    } else {
      const tipT = Math.max(clamp((Math.abs(car.ay) - T.tipA0) / T.tipA1, 0, 1) * sstep(7, 12, Math.abs(vf)) * (1 - 0.8 * d), car.kickT);
      car.tip += (tipT - car.tip) * Math.min(1, (tipT > car.tip ? 7 : 4) * dt);
      const sg = Math.abs(car.ay) < 1 && car.kickT > 0 ? car.kickSgn : Math.sign(car.ay);
      car.lean = car.tip * sg;
    }
    // in the air the lapa banks into its turns (a left turn rolls it left, the other way round to a lapa on the road) and its nose follows the climb
    const rollT = flying ? -car.sIn * 0.5 : clamp(car.ay * T.rollGain, -T.rollMax, T.rollMax) + Math.atan(side) * (T.bike ? 0.4 : 1);
    const pitchT = flying ? -clamp(car.fvy * 0.03, -0.5, 0.42) : clamp(-car.ax * T.pitchK, -T.pitchMax, T.pitchMax) - Math.atan(SPHERE ? sphere.state.slopeF : slope) - car.wheelie;
    car.roll += (rollT - car.roll) * Math.min(1, 7 * dt);
    car.pitch += (pitchT - car.pitch) * Math.min(1, 7 * dt);
    if (!SPHERE) {   // the sphere model sets car.lift (and car.deck) itself
      // a bridge deck or tunnel floor under the car (hooks.level): car.deck is its height over the terrain; leaving it sideways or off the end is a free fall
      const gb = groundY(car.x, car.z);
      if (prevFlying && !flying && hooks.level) { const l = hooks.level(car.x, car.z, car.fy + 1.2); if (l === l) car.deck = l - gb; }   // touched down on a bridge deck: the deck logic below takes over from its height
      const tele = car.px !== undefined && Math.hypot(car.x - car.px, car.z - car.pz) > 6;   // placed somewhere new: take the highest deck there
      const d0 = tele ? 0 : (car.deck || 0), ly = hooks.level ? hooks.level(car.x, car.z, tele ? 1e9 : gb + d0 + 0.3) : NaN, tgt = ly === ly ? ly - gb : 0;
      car.px = car.x; car.pz = car.z;
      if (tele) car.deck = tgt;
      if (car.vault > 0) car.vault -= dt;
      if (tele) { car.dfv = 0; car.vault = 0; car.lift = car.deck + (raisedMask(car.x, car.z) ? CURB : 0); }
      else if (tgt >= d0 - 0.6 && !(car.vault > 1.8)) { car.deck = d0 + (tgt - d0) * Math.min(1, 20 * dt); car.dfv = 0; }
      else { car.dfv = (car.dfv || 0) - 22 * dt; car.deck = Math.max(tgt, d0 + car.dfv * dt); if (car.deck <= tgt + 0.01) { car.dfv = 0; car.vault = 0; } }
      if (Math.abs(car.deck) < 0.002) car.deck = 0;
      const wf = water.floorAt(car.x, car.z);   // wings and floats (the sphere model does this itself): on floats the body rides the water, in flight the height is the air module's
      if (wf === wf && wf > gb && !flying) car.lift += (wf - gb - car.lift) * Math.min(1, 12 * dt);
      else car.lift += ((raisedMask(car.x, car.z) ? CURB : 0) + car.deck - car.lift) * Math.min(1, 25 * dt);
      if (flying) { car.lift = car.fy - gb; car.deck = 0; car.dfv = 0; car.vault = 0; }
      if (hooks.fall) hooks.fall(car, { y: gb + car.deck, air: (car.dfv || 0) < -1 && car.deck > tgt + 0.5 });
      if (hooks.tick) hooks.tick(dt);   // smashed fence panels in flight (src/fences.js)
    }
    if (!flying) car.agl = 0;
    prevFlying = flying;
    // road wear (src/roadwear.js): bounce spring after a pothole, grip and forced lean fade, and how hard the rear tyres scrub
    car.hopV += (-170 * car.hop - 8 * car.hopV) * dt; car.hop += car.hopV * dt;
    car.gripLoss = Math.max(0, car.gripLoss - dt / 0.7); car.kickT = Math.max(0, car.kickT - dt / 0.9);
    car.skid = vf > 3 ? Math.max(d * clamp((sa - 0.1) * 4, 0, 1), hb ? 0.9 : 0, brakeA >= T.brake && vf > 9 ? clamp((vf - 9) / 10, 0, 1) * 0.8 : 0) : 0;
    car.spin += car.vf * dt / (rig ? rig.A.wheelR : 0.23);
  }


  // events of the air module (src/vehicle-air.js): a hop and dust on take-off and touch-down, the driver's line as a balloon
  function airEvent(kind, a, b, x, z) {
    if (kind === 'say') {
      dispatchEvent(new CustomEvent('pd-shout', { detail: { x: car.x, y: groundY(car.x, car.z) + car.lift + 2.7, z: car.z, text: a, follow: () => ({ x: car.x, y: groundY(car.x, car.z) + car.lift + 2.7, z: car.z }) } }));
      return;
    }
    const hit = kind === 'land' ? a : 1;
    car.hopV = Math.min(2.6, car.hopV + 0.5 + 0.12 * hit);
    cam.trauma = Math.max(cam.trauma, kind === 'land' ? clamp(0.1 + hit / 22, 0, 0.7) : 0.2);
    if (b !== 'water' && !(kind === 'up' && car.wet > 0.5)) {   // dust at the wheels
      const y = groundY(car.x, car.z) + car.lift + 0.15, sn = Math.sin(car.th), cs = Math.cos(car.th);
      for (let i = 0; i < 10; i++) { const sg = i % 2 ? 1 : -1, r = 0.3 + Math.random() * 0.5; puff(car.x - sn * rearZ + cs * rearTrack * sg, y, car.z - cs * rearZ - sn * rearTrack * sg, cs * sg * r * 2 + (Math.random() - 0.5), -sn * sg * r * 2 + (Math.random() - 0.5), 1.0 + Math.random() * 0.8); }
    }
    if (kind === 'land' && hit > 8) { car.vx *= 0.7; car.vz *= 0.7; }   // a hard landing (fast and steep) costs speed, never the lapa
  }

  // A wheel dropped into a pothole (src/roadwear.js): s = severity (about 0.1 small hole, 1 big hole at speed), side +1 left / -1 right,
  // pitch +1 front wheel (nose dips) / -1 rear. Bounces the body and camera; the caller handles speed, yaw, grip and tipping.
  function bump(s, side = 0, pitch = 0) {
    s = clamp(s, 0, 1.6);
    car.hopV = Math.min(2.2, car.hopV + 0.35 + 1.0 * s);
    car.pitch += pitch * 0.035 * s; car.roll += side * 0.05 * s;
    cam.trauma = Math.max(cam.trauma, Math.min(0.85, 0.12 + 0.5 * s));
  }

  // ---------- nitro bar (own DOM element, outside the HUD corners) ----------
  const nosEl = document.createElement('div');
  nosEl.className = 'nosbar'; nosEl.hidden = true;
  nosEl.innerHTML = '<span class="nosbar-l">NOS</span><span class="nosbar-t"><i></i></span>';
  document.body.appendChild(nosEl);
  const nosFill = nosEl.querySelector('i');
  let nosShown = -1, nosHidden = true;

  // ---------- camera ----------
  const camState = { mode: 0, init: false, pos: new THREE.Vector3() };
  const camClear = createCameraClear({ scene, groundY });
  const cam = { pull: 1, ang: 0, fov: baseFov, trauma: 0, kick: 0, nosEnv: 0, roll: 0, t: 0, lastNosId: 0, lastHit: 0, look: new THREE.Vector3(), up: new THREE.Vector3() };
  function wallHit(x0, z0, x1, z1) {
    let tMin = 1;
    walls2d.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), s => {
      if (s.lv !== undefined) return;   // parapets and tunnel walls never block the camera
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
    if (SIDECAM) { camera.position.set(car.x + Math.cos(car.th) * SIDECAM, groundY(car.x, car.z) + 0.9, car.z - Math.sin(car.th) * SIDECAM); camera.lookAt(car.x, groundY(car.x, car.z) + 0.8, car.z); camState.init = true; return; }
    const v = Math.hypot(car.vx, car.vz), sp01 = clamp(v / (32 * SS), 0, 1);
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

    const gy0 = groundY(car.x, car.z), gy = gy0 + (car.flying || car.wet > 0.02 ? car.lift : car.deck || 0);   // car.deck: a bridge deck or tunnel floor under the car (src/bridges.js); in the air or on the water the body's own height
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
      camera.position.set(car.x + f.x * 0.3 + sx, gy0 + car.lift + car.hop * 0.7 + T.eye + sy, car.z + f.z * 0.3 + sz);
      camera.lookAt(car.x + f.x * 20, gy + 1.2 + (groundY(car.x + f.x * 20, car.z + f.z * 20) - gy0), car.z + f.z * 20);
      camera.rotateZ(cam.roll + car.roll * 0.5);
      camState.init = true;
      if (rig) rig.driver.visible = false;
      return;
    }
    if (rig) rig.driver.visible = true;
    const [dist0, h] = [[5.8 * T.camK, 2.7 * T.camK], [13 * T.camK, 7 * T.camK], null, [3, 130]][m];
    const hi = car.flying ? sstep(0, 25, car.agl) : 0;   // up in the air the camera backs off a little, to show the city under the wings
    const dist = dist0 + (m < 2 ? sp01 * 1.8 + cam.nosEnv * 0.7 + hi * 3.5 : 0);
    const dx = car.x - f.x * dist, dz = car.z - f.z * dist, dy = gy + h + (m < 2 ? sp01 * 0.5 + hi * 1.6 : 0);
    if (!camState.init) { camState.pos.set(dx, dy, dz); camState.init = true; }
    const kh = 1 - Math.exp(-(m === 3 ? 3 : 22) * dt), kv = 1 - Math.exp(-(m === 3 ? 3 : 6) * dt);
    camState.pos.x += (dx - camState.pos.x) * kh; camState.pos.z += (dz - camState.pos.z) * kh; camState.pos.y += (dy - camState.pos.y) * kv;
    const p = _p.copy(camState.pos);
    if (m !== 3 && !(car.flying && car.agl > 8)) {   // (up in the air the walls and trunks below do not matter)
      let t = wallHit(car.x, car.z, p.x, p.z);
      if (viewBlock) t = Math.min(t, viewBlock(car.x, car.z, p.x, p.z));   // trunks, poles, kiosks: the same pull-in as a wall
      const kT = t < 1 ? Math.max(0.15, t * 0.85) : 1;
      cam.pull += (kT - cam.pull) * (kT < cam.pull ? 1 : Math.min(1, 5 * dt));   // in at once, back out over a fraction of a second: a pole going by is a nudge, not a jolt
      if (cam.pull < 0.995) { const k = cam.pull; p.x = car.x + (p.x - car.x) * k; p.z = car.z + (p.z - car.z) * k; p.y += (1 - k) * 2.5; }
    }
    if (m !== 3 && !car.flying) camClear.apply(p, car, gy, dt, Math.abs(sy) + car.hop * 0.6);   // under the roof of a tunnel, a gate or a flyover (src/camera-clear.js)
    const lvC = car.flying || !hooks.level ? NaN : hooks.level(p.x, p.z, gy + 1.2);   // the deck or tunnel floor under the camera itself: the car may be out of the tunnel while the camera is still in it, or the other way round
    p.y = Math.max(p.y, (lvC === lvC ? lvC : groundY(p.x, p.z) + (car.flying ? 0 : car.deck || 0)) + 1.2);   // (on a deck the camera stays above the deck, in a tunnel under the roof)
    camera.position.set(p.x + sx, p.y + sy + (m === 3 ? 0 : car.hop * 0.6), p.z + sz);
    const look = f.clone().multiplyScalar(m === 3 ? 0 : 3.5).add(_p.set(car.x, gy + T.camH, car.z));
    camera.lookAt(look);
    if (cam.roll) camera.rotateZ(cam.roll);
  }

  // ---------- mounting a look (vehicle + livery + parts) ----------
  // the ZEN gag strips the vehicle to its frame and wheels (cosmetic only: the garage and the saved look are untouched)
  function applyStrip() {
    rig.setStripped(stripped); car.stripped = stripped;
    hornCustom = !!curLook.parts.horn && !stripped; audio.setVoice(curLook.type, stripped ? '' : curLook.parts.exhaust);
  }
  function applyPreset(type) {
    Object.assign(T, BASE, PRESET[type] || {});
    if (SS !== 1) {   // speeds and accelerations x SS; braking, resistance, tyre force and tip thresholds (all accelerations) x SS too, drag per speed squared / SS, steering lock speed x SS
      T.gearV = T.gearV.map(v => v * SS); T.gearA = T.gearA.map(a => a * SS);
      for (const k of ['nosThrust', 'brake', 'hbrake', 'reverseV', 'reverseA', 'roll', 'aGrip', 'aDrift', 'scrubSlip', 'scrubDrift', 'tipA0', 'tipA1', 'lockV', 'wheelV']) T[k] *= SS;
      for (const k of ['drag', 'rollGain', 'bankGain', 'pitchK']) T[k] /= SS;   // lean and dive follow the (now larger) accelerations, so the look stays
    }
    sphere.tune(type);
    car.gear = Math.min(car.gear, T.nG);
  }
  function mount(look) {
    look = cleanLook(look);
    const prev = rig;
    if (prev && prev.type === look.type && prev.geo === geoKey(look)) { // only the paint or the horn changed: no rebuild
      if (look.livery !== prev.livery) { repaint(look.type, look.livery); prev.livery = look.livery; }
      curLook = look; car.livery = look.livery; applyStrip();
      return;
    }
    rig = buildLocalRig(look); rig.geo = geoKey(look); curLook = look;
    const tp = rig.tpl.spec.tiltPivot, A = rig.A;
    // brake lights glow over the tail lamps; nitro flames and glow at the exhaust
    for (const [x, y, z] of A.tails) { const m = new THREE.Mesh(BRAKE_G, brakeMat); m.position.set(x - tp[0], y - tp[1], z - tp[2] - 0.02); rig.tilt.add(m); }
    flames = [];
    const ex = A.kind === 'bike' ? A.exh.slice(0, 1) : A.exh;
    if (ex.length) {
    for (const [x, y, z] of ex) {
      const mk = (g, mat) => { const m = new THREE.Mesh(g, mat); m.position.set(x - tp[0], y - tp[1], z - tp[2] - 0.2); m.visible = false; m.frustumCulled = false; rig.tilt.add(m); return m; };
      flames.push([mk(FLAME_O, flameOuter), mk(FLAME_I, flameInner)]);
    }
    const ez = Math.min(...ex.map(e => e[2])) - 0.35, ey = ex.reduce((s, e) => s + e[1], 0) / ex.length;
    glow.position.set(0, ey - tp[1], ez - tp[2]); rig.tilt.add(glow);
    }
    scene.add(rig.root);
    if (prev) prev.dispose();
    rearZ = -Math.min(...rig.tpl.wheels.map(w => w.z)); rearTrack = A.rearTrack;
    car.wheelPts = rig.tpl.wheels.map(w => ({ lx: w.x, fz: w.z, side: Math.abs(w.x) < 0.05 ? 0 : Math.sign(w.x), pitch: w.z > 0 ? 1 : -1 }));
    car.type = look.type; car.kind = A.kind; car.livery = look.livery;
    applyStrip();
    applyPreset(look.type);
    camState.init = false;
  }
  function syncSaved() {
    savedLook = garage.look(); if (!previewing) mount(savedLook);
    car.wings = !!savedLook.parts.fly; car.floats = !!savedLook.parts.swim;   // what the lapa on the road wears (not the look the Garage previews)
    document.documentElement.classList.toggle('pd-wings', car.wings);          // the touch pad VOLA shows only with wings (src/mobile.css)
    if (!car.wings) air.reset();
  }
  garage.onChange(syncSaved);
  // The garage shows unsaved looks while you browse (and unowned parts): preview(look) shows one, preview(null) goes back to the saved look.
  function preview(look) { if (look) { previewing = true; mount(look); } else { previewing = false; mount(savedLook); } }

  // The default horn lives in src/horn.js and polls keys.KeyH. When a bought horn is fitted this module plays it instead, so KeyH
  // reads false for the default horn while the real key state is kept here (the touch CLACSON pad and the keyboard both write keys.KeyH).
  let rawH = !!keys.KeyH, hornTest = 0, showcase = false;
  Object.defineProperty(keys, 'KeyH', { configurable: true, enumerable: true, get: () => (hornCustom ? false : rawH), set: v => { rawH = !!v; } });

  let lastHitId = 0, lastHitT = 0, lastHitMag = 0;
  function pollHit() {
    if (hitId !== lastHitId) {
      lastHitId = hitId;
      const now = performance.now();
      if (lastHitMag > 1.5 && now - lastHitT > 120) { audio.impact(lastHitMag); lastHitT = now; }
    }
  }

  // Swap vehicle in the street: V on the keyboard, the swap button on the touch UI (mobile.js dispatches 'pd-swap'). Cycles through the owned vehicles.
  function cycleVehicle() {
    const owned = VEHICLES.filter(v => garage.ownsVehicle(v.id)); if (owned.length < 2 || idleFrames >= 4 || swapLock || car.flying || car.wet > 0.2) return;   // (not in the air or on the water: the next one may have no wings or floats)
    garage.setVehicle(owned[(owned.findIndex(v => v.id === garage.type) + 1) % owned.length].id);
  }
  addEventListener('keydown', e => { if (e.code === 'KeyV' && !e.repeat && !e.ctrlKey && !e.metaKey) cycleVehicle(); });
  addEventListener('pd-swap', cycleVehicle);

  // ---------- visual ----------
  const _pose = { speed: 0, pitch: 0, roll: 0, lean: 0, steer: 0, spin: 0, t: 0, lockRear: false }, _au = { rpm: 0, thr: 0, nosAmt: 0, active: false, vf: 0, slip: 0, drift: 0, hb: false, scrape: 0 };
  function updateVisual(dt) {
    // is the simulation running (not on the title screen or paused)?
    if (ticks !== seenTicks) { seenTicks = ticks; idleFrames = 0; } else idleFrames++;
    const active = idleFrames < 4;
    if (hitMag > 0) { lastHitMag = hitMag; hitMag = 0; hitId++; car.pitch += clamp(lastHitMag * 0.003, 0, 0.05) * (car.vf > 0 ? 1 : -1); }

    const g = rig.root, now = performance.now() / 1000;
    const wv = car.wet || 0;   // floats: the body bobs and sways on the water
    g.position.set(car.x, groundY(car.x, car.z) + car.lift + car.hop + wv * 0.07 * Math.sin(now * 2.3), car.z); g.rotation.y = car.th;
    const P = _pose; P.speed = Math.abs(car.vf); P.pitch = car.pitch + wv * 0.03 * Math.sin(now * 1.7); P.roll = car.roll + wv * 0.04 * Math.sin(now * 1.3 + 1); P.lean = car.lean; P.steer = car.steer; P.spin = car.spin; P.t = now; P.lockRear = !!keys.Space && Math.abs(car.vf) > 1;
    rig.pose(P);
    tickShared(now);
    brakeMat.opacity = active && (car.braking || keys.Space) ? 0.85 : (car.tailGlow || 0) * 0.45; // tail lamps stay dimly lit at night (src/daynight.js sets car.tailGlow)

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
        puff(car.x - sn * rearZ + cs * rearTrack * sgn + (Math.random() - 0.5) * 0.3, g.position.y + 0.15, car.z - cs * rearZ - sn * rearTrack * sgn + (Math.random() - 0.5) * 0.3,
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
      const cv = document.getElementById('view'), pr = cv && vp.h ? cv.height / vp.h : 1;   // the canvas is as tall as the window (renderer.setSize(innerWidth, innerHeight) in main.js)
      s.mat.uniforms.uScale.value = vp.h * pr / (2 * Math.tan(camera.fov * PI / 360));
    }

    // sound: engine, tyres, impacts, a bought horn, the subwoofer
    const A = _au; A.rpm = car.rpm; A.thr = car.thr; A.nosAmt = car.nosAmt; A.active = active; A.vf = car.vf; A.slip = car.slip; A.drift = car.drift; A.hb = !!keys.Space; A.scrape = car.scrape;
    audio.update(A);
    pollHit();
    hornTest = Math.max(0, hornTest - dt);
    audio.hornUpdate(stripped ? '' : (curLook.parts.horn || ''), (rawH && active) || hornTest > 0, dt, car.x, car.z);
    audio.bassUpdate(!!curLook.parts.sub && !stripped && (active || showcase), dt, car.x, car.z);
    const bp = curLook.parts.sub && !stripped ? audio.bass.pulse : 0;
    car.bass = bp;
    if (rig.cone) { rig.cone.scale.set(1 + 0.12 * bp, 1 + 0.12 * bp, 1 + 0.9 * bp); rig.sub.scale.setScalar(1 + 0.025 * bp); if (bp > 0.3) cam.trauma = Math.max(cam.trauma, 0.05 * bp); }

    if (events) events.update(dt, active);
    trails.update(dt, car, rig, camera, air.state.rest);   // (resting on a roof is driving, not flying)

    // bar
    if (active === nosHidden) { nosEl.hidden = !active; nosHidden = !active; }
    const q = car.flying && car.agl > 1 ? 1 : Math.round(car.nos * 200) / 200;   // the bar reads full while the nitro is free in the air
    if (q !== nosShown) { nosShown = q; nosFill.style.transform = `scaleX(${q})`; }
    nosEl.classList.toggle('on', car.nosAmt > 0.3);
    nosEl.classList.toggle('low', car.nos < 0.15 && car.nosAmt < 0.3);
    nosEl.classList.toggle('full', car.nos > 0.995);
    return g.position;
  }
  let smokeAcc = 0;

  function setVolume(v) { audio.setVolume(v); }

  // ---------- remote players (src/net.js) ----------
  // buildVehicleModel({ type, livery, parts }) returns a rig for any vehicle (see src/vehicle-models.js): pose it with
  // rig.pose({ pitch, roll, lean, steer, spin, t }) and add it to the scene. buildLapa(liveryId) is the old Calessino-only call.
  const buildLapa = id => buildVehicleModel({ type: 'calessino', livery: id });

  if (qs.has('strip')) stripped = true;   // test link: start stripped like after the ZEN
  syncSaved();
  const api = {
    car, camState, placeAt, physics, updateVisual, updateCamera, setVolume, buildLapa, buildVehicleModel, bump,
    get LIVERIES() { return ALL_LIVERIES[curLook.type] || ALL_LIVERIES.calessino; },
    VEHICLES, setLivery: id => garage.setLivery(id), garage, preview, look: () => curLook,
    setShowcase: v => { showcase = !!v; },
    testHorn: () => { hornTest = 1.6; },
    unlockAudio: audio.gesture,
    get rig() { return rig; }, get seats() { return rig.A.seats; }, audio,
  };
  // used by src/vehicle-events.js (the ZEN gag and the night race)
  api.holdSim = b => { holdSimFlag = !!b; if (b) { car.vx = car.vz = 0; } };
  api.setStripped = b => { stripped = !!b; applyStrip(); };
  Object.defineProperty(api, 'stripped', { get: () => stripped });
  api.lockSwap = b => { swapLock = !!b; };
  // line of sight over the building footprints: the garage camera uses it to swing round walls instead of through them
  api.sightClear = (ax, az, bx, bz) => {
    let ok = true;
    walls2d.query(Math.min(ax, bx) - 0.5, Math.min(az, bz) - 0.5, Math.max(ax, bx) + 0.5, Math.max(az, bz) + 0.5, s => {
      if (!ok) return;
      const d1x = bx - ax, d1z = bz - az, d2x = s[2] - s[0], d2z = s[3] - s[1], den = d1x * d2z - d1z * d2x;
      if (Math.abs(den) < 1e-9) return;
      const ex = s[0] - ax, ez = s[1] - az, t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
      if (t > 0 && t < 1 && u > 0 && u < 1) ok = false;
    });
    return ok;
  };
  api.puff = puff;
  api.air = air; api.water = water;   // test hooks and the wake (src/main.js)
  api.teleport = (x, z, th) => {
    Object.assign(car, { x, z, th, vx: 0, vz: 0, vf: 0, w: 0, slip: 0, drift: 0, dLatch: 0, psiDot: 0, psiPrev: th, hop: 0, hopV: 0, gripLoss: 0, kickT: 0, bank: 0, bankV: 0, wheelie: 0, hsT: 0, steer: 0, sIn: 0 });
    camState.init = false;
    sphere.reset(); air.reset(); water.reset();
  };
  // Live switch between the bicycle model ('classic') and the rolling-ball model ('sphere'); position, heading and speed carry over.
  api.setPhysics = mode => {
    const on = mode === 'sphere'; if (on === SPHERE) return;
    SPHERE = on; sphere.reset(); car.psiPrev = Math.atan2(car.vx, car.vz); car.psiDot = 0; car.hop = car.hopV = 0;
  };
  api.physicsMode = () => SPHERE ? 'sphere' : 'classic';
  api.fly = () => ({ wings: !!car.wings, floats: !!car.floats, flying: !!car.flying, agl: car.agl, y: car.fy, wet: car.wet });
  events = createVehicleEvents({ scene, camera, car, groundY, roadVerts, api, audio, mobile: QUALITY });
  api.events = events;
  if (qs.has('debug') || qs.has('pdveh')) window.pdVehicle = api;   // test hook
  return api;
}
