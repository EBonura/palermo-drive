// "U Sinnacu a primavera": a Palermo joke made into a mission (docs/horns.md). A citizen waits in Piazza Pretoria, hands the lapa a comically huge pair of Viking-style horns that
// sit on its roof (wobbling with the driving, on every vehicle), and the lapa must pass under the Arco di Cutò, the arch over Via Chiappara al Carmine at Via Maqueda 26, coming in from the
// Maqueda side. The horns are obviously too wide: at the arch there is a big scrape, sparks, a comic screech and a line about scratching your head, and they squeeze through. Too careful (crawling)
// or too careless (flat out) is funny and pays less (the horns even break off); the clock is generous. Day or night. The joke is the real saying that nobody passes under the arch of Cutò
// without scratching their head, and no one is named or drawn; while the horns are on, the street shouts the bleeped line HORNS_LINES.bip: the lines are in assets/missions/lines.js (HORNS_LINES) and the T(...) calls below, Palermitan drafts for the owner to correct.
// The arch itself is modelled by another agent (src/lmc-*.js): the trigger is a gate across Via Chiappara al Carmine at the road point baked in src/event-routes.js (SNAP['horns:arch']: x, z and
// the direction of travel towards Ballarò), so it works with or without the model.
// createHornsEvents(X, { game }) -> { start(slot), update(dt), stop(), leashed(), active() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HORNS_LINES as HL } from '../assets/missions/lines.js';
import { HORNS } from './event-places.js';
import { SNAP } from './event-routes.js';
import { CUTO_PASSAGE } from './lmc-cuto.js';   // the arch model's own axis: the gate sits in the middle of its passage

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const GATE_HALF = 4.6, SLOW = 4, FAST = 13, GIVE_T = 4.4, PASS_T = 2.2, SPARKS = 56;

// the horns: two big tapering curved horns and a leather plate, in one coloured geometry (cream at the root, darker at the tip); the whole is about 3.6 m wide, wider than any arch
function hornsGeo() {
  const col = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const P = [], up = new THREE.Vector3(0, 1, 0), root = new THREE.Color('#f4ead0'), tip = new THREE.Color('#9a7a4a'), tmp = new THREE.Color();
  const curve = new THREE.CatmullRomCurve3([[0.25, 0.15, 0], [0.8, 0.12, 0], [1.4, 0.3, 0], [1.8, 0.8, 0], [1.85, 1.4, 0], [1.6, 1.85, 0]].map(p => new THREE.Vector3(...p)));
  const N = 16, pts = curve.getPoints(N);
  for (const sx of [-1, 1]) for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1], t0 = i / N, t1 = (i + 1) / N, r0 = 0.19 * (1 - t0) + 0.03, r1 = 0.19 * (1 - t1) + 0.03;
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), l = dir.length(); dir.normalize();
    const g = new THREE.CylinderGeometry(r1, r0, l * 1.06, 8, 1, false); const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); if (sx < 0) g.scale(-1, 1, 1);
    P.push(col(g, '#' + tmp.copy(root).lerp(tip, Math.pow((t0 + t1) / 2, 1.4)).getHexString()));
  }
  P.push(col(new THREE.CylinderGeometry(0.5, 0.55, 0.14, 14).translate(0, 0.02, 0), '#5a3b22'), col(new THREE.TorusGeometry(0.5, 0.045, 6, 18).rotateX(Math.PI / 2).translate(0, 0.1, 0), '#d9a441'));
  const g = mergeGeometries(P); g.scale(1.12, 0.95, 0.95); return g;   // about 4.3 m across, wider than the 3.9 m clear way of the arch (src/lmc-cuto.js), so the tips really reach into its jambs
}

export function createHornsEvents(X, opts = {}) {
  const { scene, car, pedestrians, T, hud, eur, speed, say, groundAt, vehicle } = X;
  const game = opts.game;
  let e = null;
  const hornsMesh = new THREE.Mesh(hornsGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })); hornsMesh.visible = false; hornsMesh.frustumCulled = false;
  const rig = new THREE.Group(); rig.add(hornsMesh); rig.visible = false; scene.add(rig);
  // sparks: one Points object, a ring of particles
  const sp = { pos: new Float32Array(SPARKS * 3), vel: new Float32Array(SPARKS * 3), life: new Float32Array(SPARKS), k: 0 };
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffd24a, size: 0.15, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  sp.pos.fill(-9999);
  const mmss = m => Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const dist = (x, z) => { const d = Math.hypot(x - car.x, z - car.z); return d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m'; };
  const headOf = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; };

  // ------------------------------------------------------------------ sound: a screech and a laugh, from Web Audio oscillators (nothing recorded)
  let ac = null, noise = null;
  const vol = () => 0.55 * (game && game.settings && Number.isFinite(game.settings.volume) ? game.settings.volume : 0.8);
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ac = new AC(); noise = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (er) { ac = null; }
    return ac;
  }
  function beep() {   // the censor's tone for the two blanks of the bleeped line
    const c = audio(); if (!c) return;
    for (const [at, len] of [[0, 0.16], [0.42, 0.22]]) {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at; o.type = 'sine'; o.frequency.value = 1000;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.01); g.gain.setValueAtTime(0.07, t + len - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + len + 0.02);
    }
  }
  function audioStop() { if (ac) { try { ac.close(); } catch (er) { /* ignore */ } ac = null; noise = null; } }
  function screech(dur, hard) {
    const c = audio(); if (!c) return; const t = c.currentTime, g = c.createGain(), v = vol() * (hard ? 1 : 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.05); g.gain.setValueAtTime(0.5 * v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(c.destination);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2100, t); o.frequency.exponentialRampToValueAtTime(620, t + dur); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 5; o.connect(bp); bp.connect(g); o.start(t); o.stop(t + dur + 0.05);
    const lf = c.createOscillator(); lf.frequency.value = 26; const lg = c.createGain(); lg.gain.value = 140; lf.connect(lg); lg.connect(o.frequency); lf.start(t); lf.stop(t + dur + 0.05);   // the scrape's shudder
    const n = c.createBufferSource(); n.buffer = noise; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.04); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.connect(hp); hp.connect(ng); ng.connect(c.destination); n.start(t); n.stop(t + dur + 0.05);
  }
  function laugh(n = 6, delay = 0) {   // "ha ha ha": short voiced bursts falling in pitch, through a vowel-ish band
    const c = audio(); if (!c) return; const v = vol();
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + delay + i * 0.17, o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), f0 = 300 - i * 12 + Math.random() * 20;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.11); bp.type = 'bandpass'; bp.frequency.value = 850 + Math.random() * 200; bp.Q.value = 2.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * v * (1 - i / (n * 1.6)), t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(bp); bp.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.15);
    }
  }

  // ------------------------------------------------------------------ the horns on the lapa
  const rig_ = { roll: 0, rollV: 0, pitch: 0, pitchV: 0, pvx: 0, pvz: 0, t: 0, appear: 0, broken: 0, wx: 0 };
  function roofY() { const s = vehicle && vehicle.seats && vehicle.seats[0], sy = s ? s.y : 1.0; return sy + (car.kind === 'bike' ? 0.8 : 1.0); }
  function placeHorns(dt) {
    const R = rig_; R.t += dt;
    const th = car.th, sn = Math.sin(th), cs = Math.cos(th), ax = dt > 0 ? (car.vx - R.pvx) / dt : 0, az = dt > 0 ? (car.vz - R.pvz) / dt : 0; R.pvx = car.vx; R.pvz = car.vz;
    const aFwd = clamp(ax * sn + az * cs, -25, 25), aLat = clamp(ax * cs - az * sn, -25, 25);
    // two damped springs (about 1.3 Hz, lightly damped: it wobbles) pushed by the accelerations and a little by the road
    R.rollV += (-70 * R.roll - 3.2 * R.rollV + aLat * 0.075 + Math.sin(R.t * 7.3) * 0.5 * clamp(speed() / 12, 0, 1)) * dt; R.roll = clamp(R.roll + R.rollV * dt, -0.7, 0.7);
    R.pitchV += (-70 * R.pitch - 3.2 * R.pitchV - aFwd * 0.05) * dt; R.pitch = clamp(R.pitch + R.pitchV * dt, -0.6, 0.6);
    R.appear = Math.min(1, R.appear + dt / 0.6); const a = R.appear, sc = a >= 1 ? 1 : 1 - Math.exp(-7 * a) * Math.cos(15 * a);
    rig.position.set(car.x, groundAt(car.x, car.z) + (car.lift || 0) + roofY(), car.z);
    rig.rotation.set(R.pitch, th, R.roll, 'YXZ'); hornsMesh.scale.setScalar(Math.max(0.01, sc)); hornsMesh.visible = R.broken <= 0;
    rig.visible = true;
  }
  function burst(x, y, z, n, spd) {
    for (let i = 0; i < n; i++) {
      const k = sp.k = (sp.k + 1) % SPARKS, a = Math.random() * 6.283, s = spd * (0.4 + Math.random());
      sp.pos[k * 3] = x; sp.pos[k * 3 + 1] = y; sp.pos[k * 3 + 2] = z; sp.vel[k * 3] = Math.cos(a) * s; sp.vel[k * 3 + 1] = 1 + Math.random() * 3; sp.vel[k * 3 + 2] = Math.sin(a) * s; sp.life[k] = 0.5 + Math.random() * 0.5;
    }
    sparks.visible = true;
  }
  function updateSparks(dt) {
    let any = false;
    for (let k = 0; k < SPARKS; k++) {
      if (sp.life[k] <= 0) continue; sp.life[k] -= dt; any = true;
      if (sp.life[k] <= 0) { sp.pos[k * 3 + 1] = -9999; continue; }
      sp.vel[k * 3 + 1] -= 9 * dt; sp.pos[k * 3] += sp.vel[k * 3] * dt; sp.pos[k * 3 + 1] += sp.vel[k * 3 + 1] * dt; sp.pos[k * 3 + 2] += sp.vel[k * 3 + 2] * dt;
    }
    if (any) sGeo.attributes.position.needsUpdate = true; else if (sparks.visible) { sparks.visible = false; sGeo.attributes.position.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ the mission
  function start(slot) {
    const R = X.ROUTES.horns[0], G = SNAP['horns:arch'], limit = R[1] / 5 + 90;
    e = { slot, phase: 'give', len: R[1], limit, left: limit, t: 0, cit: slot.callers[0] !== undefined ? slot.callers[0] : -1, pass: null, passT: 0, armed: false, prevS: null, wrongT: 0, thanks: 0, pay: 0, kind: '', fx: 0,
      gate: CUTO_PASSAGE ? { x: CUTO_PASSAGE.x, z: CUTO_PASSAGE.z, ux: Math.sin(CUTO_PASSAGE.thIn), uz: Math.cos(CUTO_PASSAGE.thIn) } : { x: G[0], z: G[1], ux: G[2], uz: G[3] }, crowd: [], crowdMade: false, passer: -1, gave: false, laughed: false };
    slot.callers = [];
    if (e.cit < 0 || !pedestrians.info(e.cit)) e.cit = pedestrians.spawnScripted('nonno', car.x + Math.cos(car.th) * 2.6, car.z - Math.sin(car.th) * 2.6);
    if (e.cit >= 0) { pedestrians.face(e.cit, car.x, car.z); pedestrians.setBounce?.(e.cit, true); }
    e.passer = pedestrians.spawnScripted('signora2', car.x - Math.cos(car.th) * 6, car.z + Math.sin(car.th) * 6); if (e.passer >= 0) pedestrians.face(e.passer, car.x, car.z);
    X.calls.hideBeacon(); X.setPhase('give');
    rig_.appear = 0; rig_.roll = rig_.pitch = rig_.rollV = rig_.pitchV = 0; rig_.pvx = car.vx; rig_.pvz = car.vz; rig_.broken = 0; rig_.t = 0;
    hud.toast(T('Teni i cuorna!', 'Take the horns!'), T('Piazza Pretoria', 'Piazza Pretoria'));
    audio();   // made now, while the key press that stopped the lapa still counts as a gesture
  }
  function begin() {
    const R = X.ROUTES.horns[0], g = e.gate;
    e.phase = 'go'; e.left = e.limit; X.setPhase('go'); X.guide.path(R[2]);
    X.destBeacon.set(g.x, g.z); X.destBeacon.show(true); X.destMarker = X.addMarker(g.x, g.z, '#ffb02e', 8);
    hud.toast(T('Va’ ô Cutò', 'Go to the Cutò arch'), T('Pi Via Maqueda', 'By Via Maqueda'));
  }
  function makeCrowd() {   // two people waiting beyond the arch, towards Ballarò: they laugh when the horns come through
    e.crowdMade = true; const g = e.gate;
    for (const [k, v] of [[12, 'shopper'], [16, 'ragazzo']]) { const id = pedestrians.spawnScripted(v, g.x + g.ux * k + g.uz * 1.6 * (k > 13 ? -1 : 1), g.z + g.uz * k - g.ux * 1.6 * (k > 13 ? -1 : 1)); if (id >= 0) { pedestrians.face(id, g.x, g.z); e.crowd.push(id); } }
  }
  function tipsAt() {   // the world position of the horn tips, for the sparks
    const sn = Math.sin(car.th), cs = Math.cos(car.th), y = groundAt(car.x, car.z) + (car.lift || 0) + roofY() + 0.5, s = e.fx % 2 ? 1 : -1, lx = 1.95 * s;   // the jambs of the arch are 1.95 m from its axis
    return [car.x + cs * lx + sn * 0.2, y + Math.random() * 1.4, car.z - sn * lx + cs * 0.2];
  }
  function updateE(dt) {
    e.t += dt;
    if (e.phase === 'give') {
      if (!e.gave && e.t > 0.3) { e.gave = true; if (e.cit >= 0) { say(pick(HL.bip), headOf(e.cit), 0); beep(); say(pick(HL.give), headOf(e.cit), 1.6); say(pick(HL.notme), headOf(e.cit), 3.2); } }
      if (!e.laughed && e.t > 2.2) { e.laughed = true; if (e.passer >= 0) { pedestrians.setBounce?.(e.passer, true); say(pick(HL.passers), headOf(e.passer), 0.2); } laugh(5, 0.1); }
      X.aim(0, 0, false);
      hud.set({ label: T('U Sinnacu a primavera', 'The Mayor in Spring'), title: T('Mittiti i cuorna', 'Put on the horns'), sub: '', time: '', frac: null, target: null });
      if (e.t > GIVE_T) begin();
      return;
    }
    if (e.phase === 'go') {
      e.left -= dt;
      const g = e.gate, dx = car.x - g.x, dz = car.z - g.z, s = dx * g.ux + dz * g.uz, lat = -dx * g.uz + dz * g.ux, near = Math.hypot(dx, dz);
      if (!e.crowdMade && near < 160) makeCrowd();
      if (s < -2 && near < 80) e.armed = true;   // the lapa is on the Maqueda side, in front of the arch (the street turns off Via Maqueda only a few metres before it)
      if (e.prevS !== null && Math.abs(lat) < GATE_HALF) {
        if (e.prevS < 0 && s >= 0 && e.armed && (car.vx * g.ux + car.vz * g.uz) > 0.3) { crossed(); return; }
        if (e.prevS >= 0 && s < 0 && e.wrongT <= 0) { e.wrongT = 6; hud.toast(T('Di ddà un vali!', 'Not from that side!'), T('Trasi di Maqueda', 'Come in from Maqueda')); }
      }
      e.wrongT -= dt; e.prevS = s;
      // the street has seen the horns: people along the way shout the line
      if ((e.bipT = (e.bipT ?? 0.8) - dt) <= 0) {
        e.bipT = 1.3 + Math.random() * 1.5;
        const p = pedestrians.personNear?.(car.x, car.z, 4, 34);
        if (p) { say(pick(HL.bip), () => p, 0); if ((e.bipN = (e.bipN || 0) + 1) % 3 === 1) beep(); }
      }
      if (e.left <= 0) { finish(false, 'late'); return; }
      X.aim(g.x, g.z, true);
      hud.set({ label: T('U Sinnacu a primavera', 'The Mayor in Spring'), title: T('Arcu ri Cutò', 'Arco di Cutò'), sub: dist(g.x, g.z), time: mmss(Math.max(0, e.left)), low: e.left < 40, frac: e.left / e.limit, target: g });
      return;
    }
    if (e.phase === 'pass') {
      e.passT += dt; e.fx += dt * 30;
      const k = Math.floor(e.fx); if (k !== e.lastFx) { e.lastFx = k; const p = tipsAt(); burst(p[0], p[1], p[2], e.kind === 'careless' ? 6 : 4, 5); }
      rig_.rollV += (Math.sin(e.passT * 38) * 12) * dt;
      if (e.passT > 0.1 && !e.said1) { e.said1 = true; say(pick(HL.scrape), X.driverPos, 0); }
      if (e.passT > 1.0 && !e.said2) { e.said2 = true; say(pick(HL.head), X.driverPos, 0); }
      if (e.passT > PASS_T) finish(true);
      return;
    }
    // done: the card; the people beyond the arch laugh; then the mission ends
    X.aim(0, 0, false);
    hud.set({ label: e.pay > 0 ? T('Bravu!', 'Well done!') : T('Finiu', 'Over'), title: T('Arcu ri Cutò', 'Arco di Cutò'), sub: '', time: '', frac: null, target: null });
    if ((e.thanks -= dt) <= 0) X.endEvent(e.pay > 0);
  }
  function crossed() {
    const v = speed(), kind = v < SLOW ? 'careful' : v > FAST ? 'careless' : 'good';
    e.kind = kind; e.phase = 'pass'; e.passT = 0; e.pass = v; X.setPhase('pass');
    // the horns squeeze through: the lapa slows, flies sparks, screeches; flat out they break
    const k = kind === 'careless' ? 0.3 : kind === 'careful' ? 0.8 : 0.5; car.vx *= k; car.vz *= k;
    screech(kind === 'careless' ? 0.8 : kind === 'careful' ? 1.9 : 1.3, kind !== 'careful');
    const p = tipsAt(); burst(p[0], p[1], p[2], 18, 7);
    rig_.rollV += 6; rig_.pitchV += 3;
    if (kind === 'careless') { rig_.broken = 1; for (let i = 0; i < 24; i++) { const q = tipsAt(); burst(q[0], q[1], q[2], 1, 8); } hud.toast(T('Cuorna a pezzi!', 'Horns in pieces!'), T('Troppu prestu!', 'Far too fast!')); say(pick(HL.careless), X.driverPos, 1.4); }
    else if (kind === 'careful') { hud.toast(T('Chianu chianu...', 'Slowly, slowly...'), ''); say(pick(HL.careful), X.driverPos, 1.4); }
    else hud.toast(T('Craaac!', 'Craaack!'), T('Gràttiti a testa!', 'Scratch your head!'));
    // the people beyond the arch
    for (let i = 0; i < e.crowd.length; i++) { pedestrians.setBounce?.(e.crowd[i], true); say(pick(HL.passers), headOf(e.crowd[i]), 0.9 + i * 0.7); }
    laugh(7, 0.9);
    X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off();
  }
  function finish(ok, why) {
    e.phase = 'done'; X.setPhase('done'); X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; } X.guide.off();
    if (!ok) {
      e.thanks = 3.6; rig_.broken = 1; hornsMesh.visible = false; burst(car.x, groundAt(car.x, car.z) + roofY() + 0.6, car.z, 14, 4);
      hud.result(`<h3>${T('Taiddu assai!', 'Far too late!')}</h3><div class="row"><span>${T('I cuorna si li pigghiau n’autru', 'Somebody else took the horns')}</span></div>`, 3);
      say(pick(HL.fail), X.driverPos, 0.4); return;
    }
    const base = e.kind === 'good' ? 10 : 7, bonus = e.kind === 'good' ? Math.round(6 * clamp(e.left / e.limit, 0, 1) * 2) / 2 : 0, total = base + bonus;
    e.pay = total; e.thanks = 5; X.addFare(total, 'food');
    dispatchEvent(new CustomEvent('pd-horns', { detail: { kind: e.kind } }));   // the secret of src/achievements.js
    const what = e.kind === 'good' ? T('Pulitu, cû cuorna!', 'Clean, with the horns!') : e.kind === 'careful' ? T('Troppu chianu', 'Far too slow') : T('Troppu prestu: cuorna rutti', 'Far too fast: broken horns');
    hud.result(`<h3>${T('U Sinnacu a primavera', 'The Mayor in Spring')}</h3>
      <div class="row"><span>${what}</span><span></span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Priestu!', 'In good time!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.4);
    hud.burst();
  }
  function update(dt) {
    updateSparks(dt);
    if (!e) { if (rig.visible) rig.visible = false; return; }
    placeHorns(dt); updateE(dt);
  }
  function stop() {
    if (!e) return;
    for (const id of e.crowd) pedestrians.remove(id);
    if (e.cit >= 0) pedestrians.remove(e.cit);
    if (e.passer >= 0) pedestrians.remove(e.passer);
    X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; }
    X.guide.off(); rig.visible = false; hornsMesh.visible = false; sp.life.fill(0); sp.pos.fill(-9999); sGeo.attributes.position.needsUpdate = true; sparks.visible = false;
    audioStop(); e = null;
  }
  // the leash ended the mission (src/missions.js failEvent): the horns come off at once
  function leashed() { if (e && e.phase !== 'done') { rig_.broken = 1; hornsMesh.visible = false; burst(car.x, groundAt(car.x, car.z) + roofY() + 0.6, car.z, 12, 4); say(pick(HL.fail), X.driverPos, 0.3); } }
  return { start, update, stop, leashed, active: () => !!e, shown: () => rig.visible && hornsMesh.visible, get state() { return e; } };
}
