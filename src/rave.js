// The rave on Monte Pellegrino: a terrace cut into the first slope off Via Pietro Bonanno (the clearing of src/event-places.js RAVE.site), a stage with two speaker stacks
// and a DJ booth, six coloured searchlight beams and two flashing floor discs that follow the beat, a crowd of dancing people, and a thumping house loop made with the
// Web Audio oscillators (a kick, a clap, an off-beat hat and a bass line: nothing recorded, nothing copyrighted). It exists at night (src/event-rave.js adds the delivery
// of the speakers: once they are in, the stage is "powered": louder, brighter, more people). Built when the lapa is near, thrown away when it is far; the beams are four to
// six additive meshes and the crowd is the pedestrians' own scripted slots, so a night at the rave costs a few draws and a dozen scripted people.
// createRave(env) -> { update(dt), setPowered(on), site: { x, z }, live(), powered() }
import * as THREE from 'three';
import { createRadio } from './radio.js';
import { RAVE } from './event-places.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const BPM = 138, BUILD_R = 560, CROWD_R = 300, CROWD_DROP = 380, HEAR_R = 360;
const COLS = [0xff2fa0, 0x32e0ff, 0x7dff3a, 0xffb02e, 0xb16bff, 0xff4a3a];

export function createRave(env) {
  const { scene, camera, game, pedestrians, groundY, proj, isNight, walls2d } = env;
  const [sx, sz] = proj(RAVE.site.lat, RAVE.site.lon);
  const site = { x: sx, z: sz };
  if (walls2d) for (let k = 0; k < 16; k++) { const a0 = k * Math.PI / 8, a1 = (k + 1) * Math.PI / 8, x0 = sx + Math.cos(a0) * 16.2, z0 = sz + Math.sin(a0) * 16.2, x1 = sx + Math.cos(a1) * 16.2, z1 = sz + Math.sin(a1) * 16.2; walls2d.addSeg([x0, z0, x1, z1], x0, z0, x1, z1); }   // the terrace's retaining wall is a wall to the lapa
  let built = null, crowd = [], crowdKind = '', powered = false, wasLive = false, tick = 0, t = 0;
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
  function build() {
    const g = new THREE.Group(); g.name = 'Rave';
    // the terrace: a round platform 15 m across, its top over the highest ground on its rim, its flank buried down the slope
    let top = -1e9, low = 1e9; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, y = groundY(site.x + Math.cos(a) * 16, site.z + Math.sin(a) * 16); top = Math.max(top, y); low = Math.min(low, y); }
    top = Math.max(top, groundY(site.x, site.z)) + 0.12; const hh = top - low + 2.5;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.8, hh, 28, 1), mat(0xb4a27c, { flatShading: true })); plat.position.set(site.x, top - hh / 2, site.z); plat.receiveShadow = true; plat.castShadow = true; g.add(plat);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(15, 28), mat(0xa8946c)); cap.rotation.x = -Math.PI / 2; cap.position.set(site.x, top + 0.01, site.z); cap.receiveShadow = true; g.add(cap);
    // stage on the side away from the road: floor, back wall, a truss over it, two speaker stacks, the DJ booth with a laser-bright screen
    const st = new THREE.Group(); st.position.set(site.x + 10, top, site.z); st.rotation.y = -Math.PI / 2; g.add(st);   // +z of the group looks along -x, to the crowd and the road above it
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
    const beams = [], bm = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const bgeo = new THREE.ConeGeometry(1.7, 26, 14, 1, true).translate(0, -13, 0);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(bgeo, bm(COLS[i])); b.position.set((i - 2.5) * 1.7, 6, 1.6); b.userData.i = i; st.add(b); beams.push(b); }
    const discs = [];
    for (let i = 0; i < 2; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(6.5, 28), new THREE.MeshBasicMaterial({ color: COLS[i * 2], transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); d.rotation.x = -Math.PI / 2; d.position.set(site.x - 1.5 - i * 2, top + 0.06, site.z + (i ? -3 : 3)); g.add(d); discs.push(d); }
    // a ring of small coloured lamps round the rim of the terrace (one instanced mesh, the colours follow the beat)
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16), lm = new THREE.Matrix4(), lc = new THREE.Color();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; lm.makeTranslation(site.x + Math.cos(a) * 14.4, top + 0.5, site.z + Math.sin(a) * 14.4); lamps.setMatrixAt(k, lm); lamps.setColorAt(k, lc.setHex(COLS[k % 6])); }
    lamps.frustumCulled = false; g.add(lamps);
    scene.add(g);
    return { g, st, screen, beams, discs, cones, top, lamps };
  }
  function dispose() {
    if (!built) return;
    scene.remove(built.g);
    built.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    built = null;
  }

  // ------------------------------------------------------------------ the crowd: scripted people (src/pedestrians.js) placed on the terrace top every frame (attachTo), jumping on the beat
  const POOL = ['nightboy', 'nightgirl', 'nightboy2', 'nightgirl2', 'nightgirl3', 'metal_long', 'metal_f', 'metal_vest', 'nightboy', 'nightgirl'];
  function spawnPeople() {
    if (!built) return;
    const n = powered ? 22 : 12, top = built.top;
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399) % (Math.PI * 2), r = 1.5 + 7.2 * Math.sqrt((i + 0.5) / n), c = { id: -1, x: site.x - 2 + Math.cos(a) * r, z: site.z + Math.sin(a) * r, ph: i * 0.37 };
      c.id = pedestrians.spawnScripted(i === 0 && powered ? 'dj' : POOL[i % POOL.length], c.x, c.z); if (c.id < 0) break;
      pedestrians.face(c.id, site.x + 10, site.z);
      pedestrians.attachTo(c.id, out => { const k = beatK(); out.x = c.x; out.z = c.z; out.th = Math.atan2(site.x + 10 - c.x, site.z - c.z) + Math.sin(t * 2 + c.ph) * 0.25; out.y = top + (powered ? 0.28 * Math.abs(Math.sin((beatNow() + c.ph) * Math.PI)) : 0.04 * k); }, {});
      crowd.push(c);
    }
    // the DJ behind the decks on the stage
    const dj = pedestrians.spawnScripted('dj', site.x + 10, site.z); if (dj >= 0) { pedestrians.attachTo(dj, out => { out.x = site.x + 9.2; out.z = site.z - 0.3; out.y = top + 0.9; out.th = -Math.PI / 2; }, {}); crowd.push({ id: dj }); }
    crowdKind = powered ? 'on' : 'off';
  }
  function dropPeople() { for (const c of crowd) pedestrians.remove(c.id); crowd = []; crowdKind = ''; }
  const beatNow = () => ac ? (ac.currentTime * BPM / 60) : (performance.now() / 1000 * BPM / 60);
  const beatK = () => Math.pow(1 - (beatNow() % 1), 3);

  function update(dt) {
    t += dt; tick -= dt;
    const d = Math.hypot(camera.position.x - site.x, camera.position.z - site.z), on = live();
    if (on !== wasLive) { wasLive = on; if (!on) { powered = false; audioStop(); dropPeople(); dispose(); radio()?.duckFor?.(0); } }
    if (!on) return;
    // build / drop with the distance
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
  return { update, setPowered(on) { powered = !!on; tick = 0; }, site, live, powered: () => powered, get built() { return built; }, get crowdSize() { return crowd.length; } };
}
