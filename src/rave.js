// The rave in the woods of Monte Pellegrino (the clearing of src/rave-ground.js, the site in src/event-places.js RAVE): a round slab of a dance floor you drive onto along a gravel track
// through the pines, a stage with two speaker stacks and a DJ booth on the far side of it, six coloured searchlight beams and two flashing floor discs that follow the beat, a ring
// of lamps, a crowd of dancing people that scatters from the lapa, and a thumping house loop made with the Web Audio oscillators (a kick, a clap, an off-beat hat and a bass line:
// nothing recorded, nothing copyrighted). The slab and the track are there day and night; the rest exists at night (src/event-rave.js adds the delivery of the speakers: once they
// are in, the stage is "powered": louder, brighter, more people). Built when the lapa is near, thrown away when it is far; the beams are four to six additive meshes and the
// crowd is the pedestrians' own scripted slots, so a night at the rave costs a few draws and a dozen scripted people. Only the stage is solid.
// createRave(env) -> { update(dt), setPowered(on), site: { x, z } (the middle of the floor), stage: { x, z }, live(), powered() }
import * as THREE from 'three';
import { createRadio } from './radio.js';
import { CURB } from './streets.js';
import { FLOOR, FLOOR_R, TRACK } from './rave-ground.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const BPM = 138, BUILD_R = 560, CROWD_R = 300, CROWD_DROP = 380, HEAR_R = 360, FAR = 1e7;
const COLS = [0xff2fa0, 0x32e0ff, 0x7dff3a, 0xffb02e, 0xb16bff, 0xff4a3a];
const TAU = Math.PI * 2;
const LIFT = CURB + 0.03;   // the floor and the track are drawn over the forest floor (a layer CURB over the ground) and count as raised ground (src/world.js): the lapa and the dancers stand this high over the ground

export function createRave(env) {
  const { scene, camera, car, game, pedestrians, groundY, isNight, walls2d } = env;
  const site = { x: FLOOR.x, z: FLOOR.z };
  const trackSig = () => { let s = 0; for (const d of [0, TRACK.len / 2, TRACK.len]) s += groundY(TRACK.x0 + TRACK.ux * d, TRACK.z0 + TRACK.uz * d); return s; };   // the ground under the track: when it changes the strip is drawn again
  // the frame of the site: a along the track towards the stage, b across it; W(a, b) is the world x, z
  const ux = FLOOR.ux, uz = FLOOR.uz, vx = -uz, vz = ux, W = (a, b) => [site.x + ux * a + vx * b, site.z + uz * a + vz * b];
  // the stage is solid (a box round the platform, the truss poles and the speaker stacks): its four walls are in play while it is drawn and sit out of play (at FAR) the rest of the time
  const stageWalls = [];
  { const k = [W(7.6, -4.8), W(12.4, -4.8), W(12.4, 4.8), W(7.6, 4.8)];
    for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4], seg = [a[0], a[1], b[0], b[1]]; seg.o = seg.slice(); stageWalls.push(seg); walls2d.addSeg(seg, a[0], a[1], b[0], b[1]); seg[0] = seg[1] = seg[2] = seg[3] = FAR; } }
  const wakeStage = on => { for (const s of stageWalls) { const a = on ? s.o : [FAR, FAR, FAR, FAR]; s[0] = a[0]; s[1] = a[1]; s[2] = a[2]; s[3] = a[3]; } };
  let floor = null, built = null, crowd = [], crowdKind = '', powered = false, wasLive = false, tick = 0, t = 0, dtF = 0.016;
  const radio = () => { try { return createRadio({ game }); } catch (e) { return null; } };
  const mv = () => Number.isFinite(game?.settings?.musicVolume) ? game.settings.musicVolume : 0.5;
  const live = () => !!isNight();

  // ------------------------------------------------------------------ the music: a four-on-the-floor loop, scheduled a little ahead of the audio clock
  let ac = null, master = null, timer = 0, nextT = 0, step = 0, noiseBuf = null;
  function audioStart() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ac = new AC(); master = ac.createGain(); master.gain.value = 0;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      nextT = ac.currentTime + 0.1; step = 0;
      timer = setInterval(schedule, 30);
    } catch (e) { ac = null; }
  }
  function audioStop() { if (timer) { clearInterval(timer); timer = 0; } if (ac) { try { ac.close(); } catch (e) { /* ignore */ } ac = null; master = null; } }
  const BASS = [55, 55, 82.4, 55, 65.4, 55, 73.4, 82.4];   // A1 line, one note per eighth
  function schedule() {
    if (!ac) return;
    const sixteenth = 60 / BPM / 4;
    while (nextT < ac.currentTime + 0.2) {
      const s = step & 15, T0 = nextT;
      if (s % 4 === 0) kick(T0);
      if (s % 8 === 4) clap(T0);
      if (s % 4 === 2) hat(T0, 0.5); else if (s % 2 === 1) hat(T0, 0.18);
      if (s % 2 === 0) bass(T0, BASS[(s >> 1) & 7] * (((step >> 4) & 3) === 3 ? 1.122 : 1), sixteenth * 1.7);
      step++; nextT += sixteenth;
    }
  }
  function kick(t0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
    g.gain.setValueAtTime(1, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.34);
  }
  function noise(t0, len, freq, q, level, type) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + len + 0.02);
  }
  const clap = t0 => noise(t0, 0.18, 1500, 1.2, 0.5, 'bandpass');
  const hat = (t0, lv) => noise(t0, 0.05, 7500, 0.8, lv, 'highpass');
  function bass(t0, f, len) {
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t0); fl.frequency.exponentialRampToValueAtTime(140, t0 + len); fl.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.32, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    o.connect(fl); fl.connect(g); g.connect(master); o.start(t0); o.stop(t0 + len + 0.02);
  }

  // ------------------------------------------------------------------ the scene
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const dropGroup = g => { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); };
  // the slab of the dance floor (its top a hair over the grass layer; the ground is level inside it, src/rave-ground.js) and the gravel track to the road: day and night
  function buildFloor() {
    const g = new THREE.Group(); g.name = 'RaveFloor'; const top = FLOOR.y + LIFT;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R + 0.25, 0.7, 48, 1), mat(0xb4a27c, { flatShading: true })); slab.position.set(site.x, top - 0.35, site.z); slab.receiveShadow = true; g.add(slab);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 48), mat(0xa8946c, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })); cap.rotation.x = -Math.PI / 2; cap.position.set(site.x, top + 0.01, site.z); cap.receiveShadow = true; g.add(cap);
    // the track: a strip draped on the ground every 2 m, running a little under the rim of the slab
    const n = Math.ceil((TRACK.len + 0.5) / 2), P = [], I = [], hw = TRACK.w / 2, ox = -TRACK.uz * hw, oz = TRACK.ux * hw;
    for (let i = 0; i <= n; i++) {
      const d = Math.min(i * 2, TRACK.len + 0.5), x = TRACK.x0 + TRACK.ux * d, z = TRACK.z0 + TRACK.uz * d;
      P.push(x - ox, groundY(x - ox, z - oz) + LIFT, z - oz, x + ox, groundY(x + ox, z + oz) + LIFT, z + oz);
      if (i) { const b = (i - 1) * 2; I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const trk = new THREE.Mesh(geo, mat(0x9c8a68, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide })); trk.receiveShadow = true; g.add(trk);
    g.userData.sig = trackSig();
    scene.add(g);
    return g;
  }
  // the night scene, in the frame of the site (local +x along the track towards the stage, +z across it)
  function build() {
    const top = FLOOR.y + LIFT;
    const g = new THREE.Group(); g.name = 'Rave'; g.position.set(site.x, 0, site.z); g.rotation.y = Math.atan2(-uz, ux);
    // stage on the side away from the road: floor, back wall, a truss over it, two speaker stacks, the DJ booth with a laser-bright screen
    const st = new THREE.Group(); st.position.set(10, top, 0); st.rotation.y = -Math.PI / 2; g.add(st);   // +z of the group looks along -x, to the crowd and the road beyond it
    const box = (w, h, d, x, y, z, c, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y, z); m.castShadow = true; st.add(m); return m; };
    box(9, 0.9, 4.4, 0, 0.45, 0, 0x26262c); box(9, 5, 0.4, 0, 3.4, -2, 0x16161a);
    for (const sg of [-1, 1]) { box(0.3, 6, 0.3, sg * 4.5, 3, 2, 0x303036); }
    box(9.3, 0.3, 0.3, 0, 6, 2, 0x303036); box(9.3, 0.3, 0.3, 0, 6, -1.8, 0x303036);
    const screen = box(5, 2.6, 0.12, 0, 3.4, -1.75, 0xffffff, { emissive: new THREE.Color(0xff2fa0), emissiveIntensity: 1.2 });
    const cones = [];
    for (const sg of [-1, 1]) {
      box(1.5, 3.2, 1.4, sg * 3.6, 2.5, 0.2, 0x0c0c0e);
      for (const y of [1.6, 3.4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 14), mat(0x2c2c34, { emissive: new THREE.Color(0x111118) })); c.rotation.x = Math.PI / 2; c.position.set(sg * 3.6, y, 0.95); st.add(c); cones.push(c); }
    }
    box(2.2, 1.0, 0.9, 0, 1.4, 0.4, 0x1a1a20); box(1.6, 0.06, 0.5, 0, 1.93, 0.35, 0x909098);
    // lights: six beams from the truss, two floor discs; additive, no depth write
    const beams = [], bm = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, fog: false });
    const bgeo = new THREE.ConeGeometry(1.7, 26, 14, 1, true).translate(0, -13, 0);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(bgeo, bm(COLS[i])); b.position.set((i - 2.5) * 1.7, 6, 1.6); b.userData.i = i; st.add(b); beams.push(b); }
    const discs = [];
    for (let i = 0; i < 2; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(6.5, 28), new THREE.MeshBasicMaterial({ color: COLS[i * 2], transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); d.rotation.x = -Math.PI / 2; d.position.set(-1.5 - i * 2, top + 0.06, i ? -3 : 3); g.add(d); discs.push(d); }
    // a ring of small coloured lamps round the rim of the floor (one instanced mesh, the colours follow the beat)
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16), lm = new THREE.Matrix4(), lc = new THREE.Color();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; lm.makeTranslation(Math.cos(a) * 14.4, top + 0.5, Math.sin(a) * 14.4); lamps.setMatrixAt(k, lm); lamps.setColorAt(k, lc.setHex(COLS[k % 6])); }
    lamps.frustumCulled = false; g.add(lamps);
    scene.add(g);
    wakeStage(true);
    return { g, st, screen, beams, discs, cones, top, lamps };
  }
  function dispose() {
    if (!built) return;
    dropGroup(built.g); wakeStage(false);
    built = null;
  }

  // ------------------------------------------------------------------ the crowd: scripted people (src/pedestrians.js) placed on the floor every frame (attachTo), jumping on the beat
  // They are not solid: when the lapa comes close they step away from it, and when it touches them at speed they are knocked flying (a short throw, spinning, as the street crowd is)
  // and walk back to their place a moment later.
  const POOL = ['nightboy', 'nightgirl', 'nightboy2', 'nightgirl2', 'nightgirl3', 'metal_long', 'metal_f', 'metal_vest', 'nightboy', 'nightgirl'];
  const SCARE_R = 5.5, KNOCK_R = 1.02, ROOM = 7.5, G_FLY = 12;
  // one dancer's position this frame: home on the beat, stepping away from the lapa, in the air, or on the way back
  function dance(c, out, bt) {
    const hop = powered ? 0.28 * Math.abs(Math.sin((bt + c.ph) * Math.PI)) : 0.04 * Math.pow(1 - (bt % 1), 3);
    const cx = car.x - c.x, cz = car.z - c.z, d = Math.hypot(cx, cz) || 0.01, sp = Math.hypot(car.vx || 0, car.vz || 0), dt = dtF;
    if (c.fly > 0) {   // knocked: up and over, spinning, then dazed for a moment
      c.fly -= dt; c.vy -= G_FLY * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.spin += dt * 9;
      const gy = groundY(c.x, c.z) + LIFT; if (c.y <= gy && c.vy < 0) { c.y = gy; c.fly = 0; c.daze = 1.6; c.vx = c.vz = 0; }
      out.x = c.x; out.z = c.z; out.y = c.y; out.th = c.spin; return;
    }
    if (c.daze > 0) { c.daze -= dt; out.x = c.x; out.z = c.z; out.y = groundY(c.x, c.z) + LIFT; out.th = c.spin; return; }
    if (sp > 2.2 && d < 4) for (const o of [-1, 0, 1]) {   // hit by the nose, the middle or the tail of a moving lapa (the street crowd's three circles, src/pedestrians.js)
      const px = c.x - (car.x + Math.sin(car.th) * o), pz = c.z - (car.z + Math.cos(car.th) * o), pd = Math.hypot(px, pz);
      if (pd < KNOCK_R) { c.fly = 1; c.vy = clamp(4.5 + sp * 0.55, 5.5, 11); c.vx = (car.vx || 0) * 0.9 + px / (pd || 1) * 3; c.vz = (car.vz || 0) * 0.9 + pz / (pd || 1) * 3; c.y = groundY(c.x, c.z) + LIFT; c.spin = out.th || 0; return dance(c, out, bt); }
    }
    // where the dancer wants to be: home, or pushed away from a lapa that is near and moving (not further than ROOM from home)
    let tx = c.hx, tz = c.hz;
    if (d < SCARE_R && sp > 1) { const k = Math.min(1, (SCARE_R - d) / SCARE_R * 1.4); tx = c.hx - cx / d * ROOM * k; tz = c.hz - cz / d * ROOM * k; }
    const mx = tx - c.x, mz = tz - c.z, md = Math.hypot(mx, mz), step = Math.min(md, (d < SCARE_R && sp > 1 ? 4.5 : 1.8) * dt);
    if (md > 0.001) { c.x += mx / md * step; c.z += mz / md * step; }
    out.x = c.x; out.z = c.z; out.y = groundY(c.x, c.z) + LIFT + hop + (md > 0.3 ? 0.12 * Math.abs(Math.sin(t * 14 + c.ph * 9)) : 0);
    out.th = md > 0.3 ? Math.atan2(mx, mz) : Math.atan2(c.fx - c.x, c.fz - c.z) + Math.sin(t * 2 + c.ph) * 0.25; c.spin = out.th;
  }
  function spawnPeople() {
    if (!built) return;
    const n = powered ? 22 : 12, [fx, fz] = W(10, 0);
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399) % TAU, r = 1.5 + 7.2 * Math.sqrt((i + 0.5) / n), [hx, hz] = W(-2 + Math.cos(a) * r, Math.sin(a) * r), c = { id: -1, x: hx, z: hz, hx, hz, fx, fz, ph: i * 0.37, fly: 0, daze: 0, vx: 0, vy: 0, vz: 0, y: 0, spin: 0 };
      c.id = pedestrians.spawnScripted(i === 0 && powered ? 'dj' : POOL[i % POOL.length], c.x, c.z); if (c.id < 0) break;
      pedestrians.face(c.id, fx, fz);
      pedestrians.attachTo(c.id, out => dance(c, out, beatNow()), {});
      crowd.push(c);
    }
    // the DJ behind the decks on the stage
    const [jx, jz] = W(9.2, -0.3), dj = pedestrians.spawnScripted('dj', jx, jz); if (dj >= 0) { pedestrians.attachTo(dj, out => { out.x = jx; out.z = jz; out.y = built ? built.top + 0.9 : 0; out.th = Math.atan2(-ux, -uz); }, {}); crowd.push({ id: dj }); }
    crowdKind = powered ? 'on' : 'off';
  }
  function dropPeople() { for (const c of crowd) pedestrians.remove(c.id); crowd = []; crowdKind = ''; }
  const beatNow = () => ac ? (ac.currentTime * BPM / 60) : (performance.now() / 1000 * BPM / 60);
  const beatK = () => Math.pow(1 - (beatNow() % 1), 3);

  function update(dt) {
    t += dt; tick -= dt; dtF = clamp(dt, 0, 0.05);
    const d = Math.hypot(camera.position.x - site.x, camera.position.z - site.z), on = live();
    if (on !== wasLive) { wasLive = on; if (!on) { powered = false; audioStop(); dropPeople(); dispose(); radio()?.duckFor?.(0); } }
    // build / drop with the distance: the slab and the track by day and by night, the stage at night
    if (!floor && d < BUILD_R) floor = buildFloor();
    else if (floor && d > BUILD_R + 120) { dropGroup(floor); floor = null; }
    else if (floor && Math.abs(trackSig() - floor.userData.sig) > 0.3) { dropGroup(floor); floor = buildFloor(); }   // the ground under the track changed: the tiles there streamed in (the strip is draped on it when built, and the mountain is far from the coarse far grid)
    if (!on) return;
    if (!built && d < BUILD_R) built = build();
    else if (built && d > BUILD_R + 120) { dispose(); }
    // the beat (from the audio clock when it runs, else the wall clock), the beams and the discs
    if (built) {
      const beat = beatNow(), ph = beat % 1, k = Math.pow(1 - ph, 3), lv = powered ? 1 : 0.55;
      built.screen.material.emissiveIntensity = (0.4 + 1.6 * k) * lv + 0.1; built.screen.material.emissive.setHex(COLS[Math.floor(beat / 4) % 6]);
      for (const b of built.beams) { const i = b.userData.i; b.rotation.z = Math.sin(t * 0.7 + i * 1.1) * 0.9; b.rotation.x = Math.cos(t * 0.5 + i * 0.8) * 0.55 - 0.1; b.material.opacity = (0.14 + 0.32 * (0.35 + 0.65 * k)) * lv * (0.7 + 0.3 * Math.sin(t * 2 + i)); }
      built.discs.forEach((m, i) => { m.material.opacity = (0.12 + 0.4 * k) * lv; m.material.color.setHex(COLS[(Math.floor(beat / 2) + i * 2) % 6]); });
      for (const c of built.cones) c.scale.setScalar(1 + 0.12 * k * lv);
    }
    if (tick > 0) return; tick = 0.4;
    // the crowd
    if (!crowd.length && d < CROWD_R && built) spawnPeople();
    else if (crowd.length && (d > CROWD_DROP || crowdKind !== (powered ? 'on' : 'off'))) dropPeople();
    // the sound: starts when it can be heard, is a fraction of the distance, ducks the car radio
    const att = clamp(1 - (d - 25) / HEAR_R, 0, 1), level = att * att * (powered ? 1 : 0.45) * clamp(mv() * 2, 0.15, 1);
    if (att > 0.01) { audioStart(); if (master && ac) master.gain.setTargetAtTime(level * 0.9, ac.currentTime, 0.25); radio()?.duckFor?.(clamp(level * 1.3, 0, 1)); }
    else if (ac) { master && master.gain.setTargetAtTime(0, ac.currentTime, 0.2); if (d > HEAR_R + 80) { audioStop(); radio()?.duckFor?.(0); } }
  }
  return { update, setPowered(on) { powered = !!on; tick = 0; }, site, stage: { x: W(10, 0)[0], z: W(10, 0)[1] }, live, powered: () => powered, get built() { return built; }, get crowdSize() { return crowd.length; }, get flying() { return crowd.filter(c => c.fly > 0 || c.daze > 0).length; } };
}
