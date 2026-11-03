// Races of the free-roam events: one system for the sprint on Viale Regione Siciliana, the lap races at the University (Viale delle Scienze) and on
// Viale dell'Olimpo, and the night "Corse clandestine" (horse and sulky, scooters escorting, a crowd). Tracks are racing lines baked from the road
// data (src/event-routes.js TRACKS, made by assets/missions/snap-places.mjs); the definitions (name, opponents, prizes) are RACES in src/event-places.js.
// Flow: racers wait at the start line (the call) -> stop at the line -> transition to the grid -> 3, 2, 1, VIA! -> checkpoints, positions, laps
// -> finish, results, prize into the Garage wallet -> back to the line. Opponents are cheap: they follow the racing line at a speed capped by the
// curvature, with a little rubber band, and never collide. Cars and lape are vehicle-models.js rigs (tamarro parts), scooters and the sulky too; the
// carrozza (horse carriage) is the traffic model of assets/traffic/models.js.
// createRaces(X) -> { slots, update(dt, allowed) -> slot to start | null, start(slot), stop(), active(), stageOf() }
import * as THREE from 'three';
import { Kit, box, sph } from './vehicle-kit.js';
import { buildModels, makeMaterial } from '../assets/traffic/models.js';
import { SPEED_SCALE as SS } from './vehicle.js';   // the player's speed scale (?speed=): opponents' speeds and accelerations follow it

const PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const STAGE_R = 230, UNSTAGE_R = 460, JOIN_R = 26, STEP = 5;

// ------------------------------------------------------------------------------------------------ the racing line
function makeTrack(T) {
  const raw = [], P = T.pts; for (let i = 0; i < P.length; i += 2) raw.push([P[i], P[i + 1]]);
  const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.max(8, Math.round(L / STEP)), ds = L / n, N = T.closed ? n : n + 1;
  const x = new Float32Array(N), z = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N), vcap = new Float32Array(N);
  let seg = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds; while (seg < raw.length - 2 && cum[seg + 1] < s) seg++;
    const l = cum[seg + 1] - cum[seg] || 1, u = clamp((s - cum[seg]) / l, 0, 1);
    x[i] = raw[seg][0] + (raw[seg + 1][0] - raw[seg][0]) * u; z[i] = raw[seg][1] + (raw[seg + 1][1] - raw[seg][1]) * u;
    tx[i] = (raw[seg + 1][0] - raw[seg][0]) / l; tz[i] = (raw[seg + 1][1] - raw[seg][1]) / l;
  }
  const W = T.closed ? (i => (i % N + N) % N) : (i => clamp(i, 0, N - 1));
  // corner speed from the heading change over +-3 samples, then braking distance backwards (a = 7 m/s2, times SS), a few passes round a loop
  for (let i = 0; i < N; i++) {
    const a = Math.atan2(tx[W(i - 3)], tz[W(i - 3)]), b = Math.atan2(tx[W(i + 3)], tz[W(i + 3)]);
    let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d));
    vcap[i] = clamp(Math.sqrt(9 * SS / Math.max(Math.abs(d) / (6 * ds), 1e-3)), 7, 60 * SS);
  }
  for (let pass = 0; pass < (T.closed ? 3 : 1); pass++) for (let i = N - 1 + (T.closed ? N : 0); i >= 0; i--) {
    const j = W(i), k = W(i + 1); vcap[j] = Math.min(vcap[j], Math.sqrt(vcap[k] * vcap[k] + 2 * 7 * SS * ds));
  }
  const A = { x: 0, z: 0, tx: 0, tz: 1, cap: 60 };
  const trk = {
    closed: T.closed, w: T.w, L, ds, N,
    at(s) {
      let i, u;
      if (T.closed) { s = ((s % L) + L) % L; i = Math.floor(s / ds); u = s / ds - i; }
      else if (s <= 0) { A.tx = tx[0]; A.tz = tz[0]; A.x = x[0] + tx[0] * s; A.z = z[0] + tz[0] * s; A.cap = vcap[0]; return A; }
      else if (s >= L) { A.tx = tx[N - 1]; A.tz = tz[N - 1]; A.x = x[N - 1] + tx[N - 1] * (s - L); A.z = z[N - 1] + tz[N - 1] * (s - L); A.cap = vcap[N - 1]; return A; }
      else { i = Math.floor(s / ds); u = s / ds - i; }
      const j = W(i + 1); i = W(i);
      A.x = x[i] + (x[j] - x[i]) * u; A.z = z[i] + (z[j] - z[i]) * u;
      let a = tx[i] + (tx[j] - tx[i]) * u, b = tz[i] + (tz[j] - tz[i]) * u; const l = Math.hypot(a, b) || 1; A.tx = a / l; A.tz = b / l; A.cap = Math.min(vcap[i], vcap[j]); return A;
    },
    // arc length of the nearest point within +-win m of hint; -1 when the lapa is further than maxD from the line there
    project(px, pz, hint, win, maxD) {
      const c = Math.round(hint / ds), r = Math.ceil(win / ds); let best = 1e12, bi = -1;
      for (let k = -r; k <= r; k++) {
        const i = T.closed ? W(c + k) : c + k; if (i < 0 || i >= N) continue;
        const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < best) { best = d; bi = T.closed ? c + k : i; }
      }
      if (bi < 0 || best > maxD * maxD) return -1;
      const i = W(bi), j = W(bi + 1), dx = x[j] - x[i], dz = z[j] - z[i], l2 = dx * dx + dz * dz, u = l2 ? clamp(((px - x[i]) * dx + (pz - z[i]) * dz) / l2, 0, 1) : 0;
      return (bi + u) * ds;
    },
  };
  return trk;
}

// ------------------------------------------------------------------------------------------------ the crowd
function figureGeos() {
  const K = new Kit(), m = {}; K.group('b', [0, 0, 0]).group('h', [0, 0, 0]);
  const B = K.on('b'), H = K.on('h');
  B.add(m, box(0.36, 0.62, 0.22), 0, 1.0, 0); for (const sx of [-1, 1]) { B.add(m, box(0.13, 0.72, 0.15), sx * 0.09, 0.36, 0); B.add(m, box(0.1, 0.5, 0.1), sx * 0.25, 1.05, 0, 0, 0, sx * 0.25); }
  H.add(m, sph(0.125, 8, 6), 0, 1.52, 0);
  const f = K.finish(); return [f.b[0].geom, f.h[0].geom];
}

const TUNED = [
  { spoiler: 'gt', rims: 'cromati', stance: 'basso', exhaust: 'doppio', neon: 'rosa', stickers: 'fiamme' },
  { spoiler: 'gigante', rims: 'spinner', stance: 'raso', exhaust: 'tromba', neon: 'ciano', stickers: 'scacchi' },
  { spoiler: 'anatra', rims: 'oro', stance: 'basso', exhaust: 'marmitta', neon: 'viola', stickers: 'rosanero', sub: 'sub' },
  { spoiler: 'biplano', rims: 'neri', stance: 'basso', exhaust: 'oro', neon: 'verde', stickers: 'numero' },
];
const SCOOTER_TYPES = ['vespa', 'motorino', 'scooterone'];
const VMAX = { car: 27.5 * SS, lapa: 22.5 * SS, scooter: 25 * SS, carrozza: 18.5 * SS, sulky: 22.5 * SS };

export function createRaces(X) {
  const { scene, camera, car, vehicle, hud, T, groundAt, speed } = X;
  const audio = vehicle.audio;
  const noShadow = !!X.phone;
  const defs = new Map(), tracks = new Map();
  let slots = [], stage = null, R = null, beacon = null, startRing = null, phaseCool = 0;
  let models = null, carMat = null;
  const forcedNight = () => X.params.get('event') === 'race:corse' || X.params.get('night') === '1';
  const trackOf = def => { let t = tracks.get(def.id); if (!t) { t = makeTrack(X.TRACKS[def.id]); tracks.set(def.id, t); } return t; };

  function buildSlots(list) {
    slots = list; for (const s of slots) defs.set(s.id, s.def);
    startRing = X.makeBeacon('#5ac8ff', 14); startRing.beam.scale.set(0.25, 1, 0.25);
    return slots;
  }

  // ---- opponents
  function carrozzaMesh() {
    if (!models) { models = buildModels(); carMat = makeMaterial(); }
    const m = new THREE.Mesh(models.carrozza, carMat); m.castShadow = !noShadow; return m;
  }
  function rigFor(spec, i) {
    const [kind, liv] = spec.split(':');
    if (kind === 'carrozza') { const m = carrozzaMesh(); scene.add(m); return { kind, root: m, mesh: m, pose() {}, dispose() { scene.remove(m); } }; }
    let look;
    if (kind === 'car') look = { type: 'tascia', livery: liv, parts: pick(TUNED) };
    else if (kind === 'lapa') look = { type: 'calessino', livery: liv, parts: { exhaust: 'tromba', rims: 'cromati' } };
    else if (kind === 'sulky') look = { type: 'sulky', livery: liv, parts: {} };
    else look = { type: SCOOTER_TYPES[i % SCOOTER_TYPES.length], livery: liv, parts: {} };
    const r = vehicle.buildVehicleModel(look); r.root.visible = true; for (const m of r.meshes) m.castShadow = !noShadow && m.castShadow;
    scene.add(r.root); r.kind = kind; return r;
  }
  function makeRivals(def) {
    return def.opp.map((spec, i) => {
      const kind = spec.split(':')[0], rig = rigFor(spec, i);
      return { kind, rig, vmax: VMAX[kind] * rand(0.94, 1.02), s: 0, v: 0, spin: 0, lat: 0, wob: rand(0, 6), done: false, doneT: 0, honk: rand(0.5, 3), total: 0, i };
    });
  }
  function disposeRivals(list) { for (const r of list) { if (r.rig.dispose) r.rig.dispose(); } list.length = 0; }

  // grid: two abreast, rows 7 m apart behind the line
  function gridSlot(k, trk) { const row = k >> 1, side = k & 1 ? 1 : -1, lat = clamp(trk.w * 0.18, 1.0, 2.2); return { s: -(5 + row * 7.5), lat: side * lat }; }
  function place(r, s, lat, ahead = 0) {
    const a = R ? R.trk.at(s) : stage.trk.at(s), x = a.x - a.tz * lat, z = a.z + a.tx * lat;
    r.rig.root.position.set(x, groundAt(x, z) + (r.kind === 'carrozza' ? 0 : 0), z); r.rig.root.rotation.y = Math.atan2(a.tx, a.tz); r.x = x; r.z = z;
  }

  // ---- crowd and escorts (the night race has both; the day races only a few spectators)
  function makeCrowd(trk, n) {
    const [gb, gh] = figureGeos(), col = new THREE.Color();
    const bodies = new THREE.InstancedMesh(gb, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n), heads = new THREE.InstancedMesh(gh, new THREE.MeshStandardMaterial({ color: '#d9a47a', roughness: 0.85 }), n);
    const shirts = ['#f27aa8', '#17131a', '#e8e2cc', '#c42f2a', '#2a63b0', '#f0c92a', '#4f8a55', '#9b4dff'], skins = ['#f0c8a0', '#d9a47a', '#b9835c', '#8a5a3a'], people = [];
    for (let i = 0; i < n; i++) {
      const fin = !trk.closed && i >= n * 0.7, s = fin ? trk.L - 14 + Math.random() * 36 : -12 + Math.random() * 60, side = Math.random() < 0.5 ? -1 : 1, off = trk.w / 2 + 1.4 + Math.random() * 3.2;
      const a = trk.at(s), x = a.x - a.tz * side * off, z = a.z + a.tx * side * off;
      people.push({ x, z, y: groundAt(x, z), ry: Math.atan2(a.tz * side, -a.tx * side) + (Math.random() - 0.5) * 0.8, ph: Math.random() * 6, sp: 5 + Math.random() * 4, h: 0.85 + Math.random() * 0.3 });
      col.set(shirts[i % shirts.length]); bodies.setColorAt(i, col); col.set(skins[(i * 7) % skins.length]); heads.setColorAt(i, col);
    }
    bodies.frustumCulled = heads.frustumCulled = false; scene.add(bodies, heads);
    return { bodies, heads, people, n };
  }
  const _o = new THREE.Object3D();
  function crowdUpdate(c, t, cheer) {
    if (!c) return;
    for (let i = 0; i < c.n; i++) {
      const p = c.people[i], hop = cheer ? Math.abs(Math.sin(t * p.sp + p.ph)) * 0.22 : Math.max(0, Math.sin(t * 2 + p.ph) - 0.8) * 0.1;
      _o.position.set(p.x, p.y + hop, p.z); _o.rotation.set(0, p.ry, 0); _o.scale.setScalar(p.h); _o.updateMatrix(); c.bodies.setMatrixAt(i, _o.matrix); c.heads.setMatrixAt(i, _o.matrix);
    }
    c.bodies.instanceMatrix.needsUpdate = true; c.heads.instanceMatrix.needsUpdate = true;
  }
  // day races: a few characters of the crowd system cheer beside the line (the night race has the instanced crowd above)
  function spectators(trk) {
    const ids = [], V = ['tifoso', 'tifosa', 'ragazzo', 'teen', 'motorino', 'tifoso_kid', 'skinny', 'teen2'];
    for (let k = 0; k < 8; k++) {
      const a = trk.at(-16 + k * 8 + Math.random() * 3), side = k % 2 ? 1 : -1, off = trk.w / 2 + 2.2 + Math.random() * 1.5, x = a.x - a.tz * side * off, z = a.z + a.tx * side * off;
      const id = X.pedestrians.spawnScripted(pick(V), x, z); if (id < 0) continue;
      X.pedestrians.face(id, a.x, a.z); X.pedestrians.setBounce(id, true); ids.push(id);
    }
    return ids;
  }
  const disposeSpec = l => { for (const id of l) X.pedestrians.remove(id); l.length = 0; };
  function disposeCrowd(c) { if (!c) return; scene.remove(c.bodies, c.heads); c.bodies.geometry.dispose(); c.heads.geometry.dispose(); c.bodies.material.dispose(); c.heads.material.dispose(); }
  const SC = [['vespa', 'rosso'], ['scooterone', 'nero'], ['motorino', 'arancio'], ['vespa', 'rosanero'], ['scooterone', 'perla'], ['motorino', 'verde']];
  function makeEscorts(trk) {
    const out = [], n = noShadow ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const [type, liv] = SC[i], rig = vehicle.buildVehicleModel({ type, livery: liv }); rig.root.visible = true; for (const m of rig.meshes) m.castShadow = !noShadow && m.castShadow; scene.add(rig.root);
      const s = -6 + i * 7 + Math.random() * 4, side = i % 2 ? 1 : -1, off = 3.4 + Math.random() * 1.6, a = trk.at(s);
      out.push({ rig, x: a.x - a.tz * side * off, z: a.z + a.tx * side * off, th: Math.atan2(a.tx, a.tz) + (Math.random() - 0.5) * 1.1 + (i % 2 ? 0.6 : -0.6), s, lat: side * (1.4 + Math.random() * 1.6), target: -1, so: -10 + Math.random() * 24, v: 0, spin: 0, honkT: 0.5 + Math.random() * 2, hop: 0, wob: Math.random() * 6 });
    }
    return out;
  }
  function escortsUpdate(list, dt, S, racing) {
    for (const sc of list) {
      const rg = sc.rig; let y;
      if (!racing) {
        y = groundAt(sc.x, sc.z); rg.root.position.set(sc.x, y, sc.z); rg.root.rotation.y = sc.th;
        rg.pose({ pitch: 0, roll: Math.sin(S.t * 31 + sc.wob) * 0.012, lean: 0, steer: Math.sin(S.t * 0.7 + sc.wob) * 0.12, spin: 0, t: S.t, speed: 0 });
      } else {
        const tg = sc.target === -1 ? R.total : R.rivals[sc.target].total, ts = tg + sc.so + (R.state === 'finish' ? 18 : 0);
        const prev = sc.s; sc.s += clamp((ts - sc.s) * 1.6, -8, 40) * dt;
        const v = (sc.s - prev) / Math.max(dt, 1e-3); sc.v += (v - sc.v) * Math.min(1, 6 * dt);
        const a = R.trk.at(sc.s), lat = sc.lat * (sc.s > R.trk.L ? 1.6 : 1);
        sc.x = a.x - a.tz * lat; sc.z = a.z + a.tx * lat; sc.th = Math.atan2(a.tx, a.tz) + Math.sin(S.t * 0.9 + sc.wob) * 0.04;
        y = groundAt(sc.x, sc.z); rg.root.position.set(sc.x, y, sc.z); rg.root.rotation.y = sc.th;
        sc.spin += sc.v * dt / (rg.A.wheelR || 0.25);
        rg.pose({ pitch: R.t < 1.4 && R.state === 'race' ? -0.35 * (1 - R.t / 1.4) : 0, roll: 0, lean: Math.sin(S.t * 1.3 + sc.wob) * 0.3, steer: Math.sin(S.t * 1.1 + sc.wob) * 0.1, spin: sc.spin, t: S.t, speed: sc.v });
      }
      sc.honkT -= dt;
      if (sc.honkT <= 0) { sc.honkT = racing ? 0.4 + Math.random() * 1.1 : 0.9 + Math.random() * 2.6; const d = Math.hypot(sc.x - camera.position.x, sc.z - camera.position.z); if (audio && audio.honk) audio.honk(clamp(1 - d / 80, 0, 1) * 0.8, 0.85 + Math.random() * 0.4); sc.hop = 1; }
      if (sc.hop > 0) { sc.hop = Math.max(0, sc.hop - dt * 4); rg.root.position.y += Math.sin(sc.hop * PI) * 0.05; }
    }
  }
  function disposeEscorts(list) { for (const s of list) s.rig.dispose(); list.length = 0; }

  // ---- staging at the start line (the call): racers parked on the grid, revving
  function stageUp(slot) {
    const def = slot.def, trk = trackOf(def);
    stage = { slot, def, trk, rivals: makeRivals(def), crowd: def.crowd ? makeCrowd(trk, 46) : null, spec: def.crowd ? [] : spectators(trk), escorts: null, t: 0, stop: 0 };
    if (def.crowd) stage.escorts = makeEscorts(trk);
    stage.rivals.forEach((r, k) => { const g = gridSlot(k + 1, trk); r.s = g.s; r.lat = g.lat; place(r, r.s, r.lat); });
  }
  function stageDown() { if (!stage) return; disposeRivals(stage.rivals); disposeCrowd(stage.crowd); disposeSpec(stage.spec); if (stage.escorts) disposeEscorts(stage.escorts); stage = null; }
  function stageUpdate(dt, allowed) {
    const S = stage, a = X.now();
    S.t += dt; S.slot.dist = Math.hypot(car.x - S.slot.x, car.z - S.slot.z);
    if (S.crowd) crowdUpdate(S.crowd, S.t, false);
    if (S.escorts) escortsUpdate(S.escorts, dt, S, false);
    for (const r of S.rivals) {
      r.rig.pose({ pitch: 0, roll: Math.sin(S.t * 31 + r.wob) * 0.01, lean: 0, steer: 0, spin: 0, t: S.t, speed: 0 });
      r.honk -= dt;
      if (r.honk <= 0) { r.honk = rand(2.5, 7); if (audio && audio.honk && r.kind !== 'carrozza') audio.honk(clamp(1 - S.slot.dist / 90, 0, 1) * 0.6, 0.8 + Math.random() * 0.5); if (r.kind !== 'carrozza' && r.kind !== 'sulky') vehicle.puff(r.x, groundAt(r.x, r.z) + 0.5, r.z, 0, 0, 0.5); }
    }
    const near = S.slot.dist < 70;
    if (near && allowed && X.now() >= S.slot.coolUntil) {
      const slow = Math.abs(car.vf) < 2.5 && S.slot.dist < JOIN_R && X.calls.armed() && X.held !== S.slot && !X.params.has('nojoin');
      S.stop = slow ? S.stop + dt : Math.max(0, S.stop - dt * 2);
      hud.set({ label: S.def.night ? T('Di notte', 'After dark') : T('Gara', 'Race'), title: T(S.def.name, S.def.en), sub: T('Fermati alla linea per partecipare', 'Stop at the line to join'), time: '', frac: S.stop / 1.1, target: S.slot });
      if (S.stop >= 1.1) { S.stop = 0; return S.slot; }
    } else S.stop = 0;
    return null;
  }

  // ---- the race
  const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '.' + String(Math.floor((t % 1) * 10));
  async function teleportTo(x, z, th) {
    if (X.world) await new Promise(res => { const t = setTimeout(res, 9000); X.world.teleport(x, z, () => { clearTimeout(t); res(); }); });
    vehicle.teleport(x, z, th);
  }
  function start(slot) {
    if (stage && stage.slot !== slot) stageDown();
    if (!stage) stageUp(slot);
    const S = stage, def = S.def, trk = S.trk;
    stage = null;                                                  // the race owns the staged things now
    const total = def.kind === 'laps' ? def.laps * trk.L : trk.L - 2;
    R = { slot, def, trk, rivals: S.rivals, crowd: S.crowd, spec: S.spec, escorts: S.escorts, state: 'prep', t: 0, clock: 0, total: 0, prevS: 0, laps: def.kind === 'laps' ? def.laps : 1, finishS: total, cps: [], cpi: 0, rank: 1, done: false, hudT: 0, tcount: 0, resultT: 0, order: 0, sulky: !!def.sulky };
    // checkpoints: four a lap (the line included), three on a sprint plus the finish
    const per = def.kind === 'laps' ? 4 : 4;
    for (let k = 1; k <= per * R.laps; k++) R.cps.push(k * (total / (per * R.laps)));
    X.setPhase('race');
    X.calls.hideBeacon(); if (startRing) startRing.show(false);
    { const tp = X.TRACKS[def.id].pts; let gp = tp.slice(); for (let l = 1; l < R.laps; l++) gp = gp.concat(tp.slice(2)); X.guide.path(gp, { fixed: true }); }   // the guide arrow and the minimap follow the racing line
    if (R.sulky) { vehicle.lockSwap(true); vehicle.preview({ type: 'sulky', livery: pick(['baio', 'sauro', 'morello', 'grigio']), parts: {} }); }
    vehicle.holdSim(true);
    const k0 = Math.floor(Math.random() * (def.opp.length + 1)), g0 = gridSlot(k0, trk);
    R.gridK = k0;
    // the grid: the player takes slot k0, the rivals fill the others in order
    let k = 0; R.rivals.forEach(r => { if (k === k0) k++; const g = gridSlot(k, trk); r.s = g.s; r.lat = g.lat; r.total = g.s; k++; });
    R.total = g0.s; R.prevS = trk.closed ? ((g0.s % trk.L) + trk.L) % trk.L : g0.s;
    X.transition(async () => {
      for (const r of R.rivals) place(r, r.s, r.lat);
      const a = trk.at(g0.s), x = a.x - a.tz * g0.lat, z = a.z + a.tx * g0.lat;
      await teleportTo(x, z, Math.atan2(a.tx, a.tz));
      vehicle.holdSim(true);
    }, { hold: 500 }).then(() => { if (R) { R.state = 'count'; R.t = 0; R.lastCount = 4; } });
  }

  function raceUpdate(dt) {
    const trk = R.trk, S = R;
    S.clock += dt;
    if (S.state === 'prep') { hud.set({ label: T(S.def.name, S.def.en), title: T('Alla griglia', 'To the grid'), sub: '', time: '', frac: null, target: null }); return; }
    S.t += dt;
    crowdUpdate(S.crowd, S.clock, S.state !== 'prep');
    if (S.escorts) escortsUpdate(S.escorts, dt, S, S.state === 'race' || S.state === 'finish');
    // player progress along the line (a signed, unwrapped distance)
    const ps = trk.project(car.x, car.z, S.prevS, 70, 60);
    if (ps >= 0) {
      let d = ps - S.prevS; if (trk.closed) { if (d > trk.L / 2) d -= trk.L; else if (d < -trk.L / 2) d += trk.L; }
      S.total += d; S.prevS = ps;
    }
    if (S.state === 'count') {
      const n = 3 - Math.floor(S.t - 0.3);
      if (S.t > 0.3 && n !== S.lastCount) { S.lastCount = n; if (n > 0) hud.count(String(n), T('Pronti', 'Ready')); }
      rivalsUpdate(dt, false);
      if (S.t >= 3.3) { S.state = 'race'; S.t = 0; vehicle.holdSim(false); hud.count(T('VIA!', 'GO!')); }
    } else {
      rivalsUpdate(dt, true);
      if (S.state === 'race') {
        let rank = 1; for (const r of S.rivals) if (r.done || r.total > S.total) rank++; S.rank = rank;
        while (S.cpi < S.cps.length - 1 && S.total >= S.cps[S.cpi]) { hud.toast(T('Checkpoint', 'Checkpoint'), fmtT(S.t)); S.cpi++; }
        if (S.total >= S.finishS) endRace(true); else if (S.t > 40 + S.finishS / 9) endRace(false);
      } else if (S.state === 'finish') {
        S.resultT -= dt;
        if (S.resultT <= 0) leave();
      }
    }
    // hud: position, lap and distance (the card is set every frame, its text only changes a few times a second)
    const cp = S.cps[Math.min(S.cpi, S.cps.length - 1)], a = trk.at(cp), ax = a.x, az = a.z;
    if ((S.hudT -= dt) <= 0 && S.state !== 'finish') {
      S.hudT = 0.1;
      const lap = S.laps > 1 ? clamp(Math.floor(Math.max(0, S.total) / trk.L) + 1, 1, S.laps) : 1, left = Math.max(0, S.finishS - S.total), n = S.rivals.length + 1;
      S.hudO = { label: T(S.def.name, S.def.en), title: (S.state === 'count' ? '' : S.rank + ' / ' + n) + (S.laps > 1 ? '   ' + T('Giro ', 'Lap ') + lap + '/' + S.laps : ''), sub: Math.round(left) + ' m', time: S.state === 'race' ? fmtT(S.t) : '', frac: clamp(S.total / S.finishS, 0, 1), target: { x: ax, z: az } };
    }
    if (S.hudO) { hud.set(S.hudO); if (S.hudO.target) { S.hudO.target.x = ax; S.hudO.target.z = az; X.aim(ax, az, S.state === 'race'); if (beacon) { beacon.set(ax, az); beacon.show(S.state === 'race'); } } }
  }
  function rivalsUpdate(dt, go) {
    const trk = R.trk;
    for (const r of R.rivals) {
      if (go) {
        if (!r.done) {
          const gap = r.total - R.total, rub = gap < -60 ? 1.08 : gap > 70 ? 0.93 : 1, look = trk.at(r.s + 14).cap;
          const vt = Math.min(r.vmax * rub, look * 1.05) * (0.96 + 0.04 * Math.sin(R.t * 0.8 + r.wob));
          r.v += clamp(vt - r.v, -9 * SS * dt, (r.kind === 'carrozza' ? 4 : 7) * SS * dt);
          r.total += r.v * dt; r.s = r.total;
          if (r.total >= R.finishS) { r.done = true; r.doneT = R.t; r.order = ++R.order; }
        } else { r.v = Math.max(0, r.v - 8 * SS * dt); r.total += r.v * dt; r.s = r.total; }
      } else r.v = 0;
      const lat = r.lat + Math.sin(R.t * 0.5 + r.wob) * 0.5 * Math.min(1, r.v / 8), a = trk.at(r.s);
      const x = a.x - a.tz * lat, z = a.z + a.tx * lat; r.x = x; r.z = z; r.spin += r.v * dt / (r.rig.A ? (r.rig.A.wheelR || 0.3) : 0.5);
      r.rig.root.position.set(x, groundAt(x, z) + (r.kind === 'carrozza' ? Math.abs(Math.sin(r.spin * 0.6)) * 0.07 * Math.min(1, r.v / 6) : 0), z); r.rig.root.rotation.y = Math.atan2(a.tx, a.tz);
      r.rig.pose({ pitch: 0, roll: 0, lean: 0, steer: 0, spin: r.spin, t: R.clock, speed: r.v });
    }
  }
  function endRace(finished) {
    const S = R; S.state = 'finish'; S.resultT = 6; X.setPhase('finish');
    const ahead = S.rivals.filter(r => r.done).length;
    S.place = finished ? ahead + 1 : S.rivals.length + 1;
    S.prize = finished ? (S.def.prize[S.place - 1] || 0) : 0;
    if (S.prize > 0) vehicle.garage.credit(S.prize);
    X.addRaceResult(S.def.id, finished && S.place === 1);
    S.hudO = { frac: null, target: null, label: T(S.def.name, S.def.en), title: finished ? T(S.place + '° posto!', 'Place ' + S.place + '!') : T('Tempo scaduto', 'Time is up'), sub: '', time: finished ? fmtT(S.t) : '' };
    hud.result(`<h3>${finished ? T(S.place + '° posto!', 'Place ' + S.place + '!') : T('Tempo scaduto', 'Time is up')}</h3>
      <div class="row"><span>${T('Tempo', 'Time')}</span><span>${finished ? fmtT(S.t) : '-'}</span></div>
      <div class="row tot"><span>${S.prize > 0 ? T('Premio', 'Prize') : T('Niente premio, ritenta', 'No prize, try again')}</span><span>${S.prize > 0 ? '€ ' + S.prize : ''}</span></div>`, 5.5);
    if (finished && S.place === 1) hud.burst();
    if (beacon) beacon.show(false);
  }
  async function leave() {
    const S = R; if (!S || S.leaving) return; S.leaving = true;
    // put the player back on the line, with their own vehicle
    await X.transition(async () => {
      if (S.sulky) { vehicle.lockSwap(false); vehicle.preview(null); }
      vehicle.holdSim(false);
      const a = S.trk.at(-12);
      await teleportTo(a.x, a.z, Math.atan2(a.tx, a.tz));
      for (let i = 0; i < 8; i++) vehicle.puff(car.x + (Math.random() - 0.5) * 2, groundAt(car.x, car.z) + 0.5, car.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.8);
    }, { hold: 350 });
    S.slot.coolUntil = X.now() + 12;
    if (R === S) { cleanRace(); X.endEvent(true); }
  }
  function cleanRace() {
    if (!R) return;
    disposeRivals(R.rivals); disposeCrowd(R.crowd); disposeSpec(R.spec); if (R.escorts) disposeEscorts(R.escorts);
    if (R.sulky) { vehicle.lockSwap(false); vehicle.preview(null); }
    vehicle.holdSim(false);
    if (beacon) beacon.show(false);
    R = null;
  }
  function stop() {
    if (R) cleanRace();
    stageDown();
  }

  function update(dt, allowed) {
    if (!beacon) { beacon = X.makeBeacon('#5ac8ff', 9); beacon.beam.scale.set(0.35, 1, 0.35); }
    if (R) { raceUpdate(dt); return null; }
    if (!allowed) { if (stage) stageDown(); startRing.show(false); return null; }
    // stage the nearest race that is in range (the night race only after dark)
    const night = X.isNight() || forcedNight();
    let best = null, bd = STAGE_R;
    for (const s of slots) { const d = Math.hypot(car.x - s.x, car.z - s.z); if (d < bd && (!s.def.night || night) && car.type !== 'sulky') { bd = d; best = s; } }
    if (stage && (!best || stage.slot !== best)) { if (!best && Math.hypot(car.x - stage.slot.x, car.z - stage.slot.z) < UNSTAGE_R && (!stage.def.night || night)) { /* keep it a while */ } else stageDown(); }
    if (!stage && best && X.now() >= (best.coolUntil || 0) - 4) { try { stageUp(best); } catch (e) { console.warn('[races] stage', best.id, e); stage = null; best.coolUntil = X.now() + 30; } }
    if (stage) {
      startRing.set(stage.slot.x, stage.slot.z); startRing.show(Math.hypot(car.x - stage.slot.x, car.z - stage.slot.z) < 180 && X.now() >= stage.slot.coolUntil);
      return stageUpdate(dt, allowed);
    }
    startRing.show(false);
    return null;
  }
  return { slots: () => slots, buildSlots, update, start, stop, active: () => !!R, staged: () => !!stage, get R() { return R; }, get stage() { return stage; } };
}
