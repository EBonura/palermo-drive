// Night extras of the missions work (owned by the missions work): two position-based gags that only exist after dark.
//   1. the Easter egg "u spacciaturi": stop for a few seconds at night in Ballarò, the Vucciria, the Capo, the Zisa or the Noce and a
//      hooded guy walks up to the lapa; a balloon says the owner's line, the driver answers dismissively. There is nothing to buy, no
//      items, no mechanics: the player can only drive off.
//   2. the "appartati": cars parked at Monte Pellegrino's lookouts and in quiet corners of the Favorita, windows steamed up at night and
//      the car gently rocking on its suspension. Strictly innuendo: the fog hides the glass, nobody is visible. Only the horn sounding
//      nearby disturbs them (the rocking stops, the windows flash and somebody yells); the headlights do nothing. They need the whole-city
//      tiles, so they are built only when the lapa gets near.
// createNightLife(h) -> { update(dt, allowed), inZone() }. h = { env, say, groundAt, findSpot, isNight, worldOn, driverPos }
// (helpers from src/missions.js). Lines and places: assets/missions/lines.js (SPACCIA, SPACCIA_ZONES, APPARTATI).
import * as THREE from 'three';
import { createNotes } from './pub-notes.js';
import { SPACCIA, SPACCIA_ZONES, APPARTATI } from '../assets/missions/lines.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

export function createNightLife(h) {
  const { env, say, groundAt, findSpot, isNight, worldOn, driverPos } = h;
  const { scene, car, walls2d, pedestrians } = env;

  // ==================================================================================== u spacciaturi
  const zones = SPACCIA_ZONES.map(zn => { const [x, z] = env.proj(zn.lat, zn.lon); return { ...zn, x, z }; });
  const inZone = () => zones.find(zn => Math.hypot(car.x - zn.x, car.z - zn.z) < zn.r) || null;
  const sp = { phase: 'idle', stopT: 0, armed: true, cool: 8, id: -1, t: 0, from: null };
  const headOf = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; };
  function endSpaccia() { if (sp.id >= 0) pedestrians.remove(sp.id); sp.id = -1; sp.phase = 'idle'; sp.cool = 75; sp.stopT = 0; }
  function leave() {
    sp.phase = 'leave'; sp.t = 0;
    if (sp.from) pedestrians.walkTo(sp.id, sp.from.x, sp.from.z, 2.0, endSpaccia); else endSpaccia();   // back the way he came
  }
  function updateSpaccia(dt, allowed) {
    const spd = Math.hypot(car.vx, car.vz);
    if (spd > 4) sp.armed = true;
    sp.cool = Math.max(0, sp.cool - dt);
    if (sp.phase === 'idle') {
      sp.stopT = spd < 0.8 ? sp.stopT + dt : 0;
      if (!allowed || sp.cool > 0 || !sp.armed || sp.stopT < 3.5 || !isNight() || !inZone()) return;
      const spot = findSpot(9, 14, false);
      if (!spot) { sp.stopT = 2.5; return; }                                   // nowhere to stand: look again in a second
      const id = pedestrians.spawnScripted('hooded', spot.x, spot.z); if (id < 0) return;
      const d = Math.hypot(spot.x - car.x, spot.z - car.z) || 1, tx = car.x + (spot.x - car.x) / d * 2.3, tz = car.z + (spot.z - car.z) / d * 2.3;
      sp.id = id; sp.from = { x: spot.x, z: spot.z }; sp.phase = 'come'; sp.t = 0; sp.armed = false;
      pedestrians.face(id, car.x, car.z);
      pedestrians.walkTo(id, tx, tz, 1.8, () => {
        sp.phase = 'talk'; sp.t = 0; pedestrians.face(id, car.x, car.z);
        say(SPACCIA.hail, headOf(id), 0);                                       // the owner's line, as written
        say(pick(SPACCIA.driver), driverPos, 2.2);
      });
      return;
    }
    sp.t += dt;
    if (sp.phase === 'come') { if ((spd > 3.5 && Math.hypot(car.x - sp.from.x, car.z - sp.from.z) > 6) || sp.t > 16) leave(); }
    else if (sp.phase === 'talk') { if (sp.t > 6 || spd > 2.5) leave(); }
    else if (sp.phase === 'leave' && sp.t > 14) endSpaccia();
  }

  // ==================================================================================== appartati
  const fogTex = heart => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(206,221,228,0.82)'; g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${230 + (i % 3) * 8},240,245,${0.05 + (i % 5) * 0.03})`; g.beginPath(); g.arc((i * 37) % 128, (i * 53) % 64, 2 + (i % 4), 0, TAU); g.fill(); }
    for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(150,170,180,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(8 + i * 14, 6); g.lineTo(8 + i * 14 + (i % 2 ? 1 : -1), 12 + (i * 11) % 40); g.stroke(); }
    if (heart) {   // somebody drew a heart on the steamed glass
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,0.9)';
      g.beginPath(); g.moveTo(64, 50); g.bezierCurveTo(40, 34, 44, 14, 58, 20); g.bezierCurveTo(62, 22, 64, 26, 64, 28); g.bezierCurveTo(64, 26, 66, 22, 70, 20); g.bezierCurveTo(84, 14, 88, 34, 64, 50); g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  let texPlain = null, texHeart = null;
  const sites = [];
  if (worldOn()) for (const o of APPARTATI.sites) { const [x, z] = env.proj(o.lat, o.lon); sites.push({ o, x, z, built: false, near: false }); }

  function buildCar(s) {
    texPlain = texPlain || fogTex(false); texHeart = texHeart || fogTex(true);
    const o = s.o, gy = groundAt(s.x, s.z), th = Math.atan2(o.dx, o.dz) + (Math.random() < 0.5 ? 0 : Math.PI);
    const g = new THREE.Group(); g.position.set(s.x, gy, s.z); g.rotation.y = th; scene.add(g);
    const body = new THREE.Group(); g.add(body);
    const paint = new THREE.MeshStandardMaterial({ color: o.col, roughness: 0.5, metalness: 0.25 }), dark = new THREE.MeshStandardMaterial({ color: '#1a1b1f', roughness: 0.9 });
    const lampF = new THREE.MeshBasicMaterial({ color: '#f4efe0' }), lampR = new THREE.MeshBasicMaterial({ color: '#8a1b1b' });
    const box = (w, hh, d, m, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; body.add(mesh); return mesh; };
    box(1.62, 0.55, 3.5, paint, 0, 0.64, 0);        // lower body, front = +z
    box(1.46, 0.52, 1.95, paint, 0, 1.17, -0.2);    // cabin
    box(1.7, 0.1, 3.6, dark, 0, 0.4, 0);            // bumpers and sills
    for (const sx of [-0.55, 0.55]) { box(0.3, 0.14, 0.05, lampF, sx, 0.78, 1.76); box(0.3, 0.14, 0.05, lampR, sx, 0.78, -1.76); }
    for (const [wx, wz] of [[-0.8, 1.1], [0.8, 1.1], [-0.8, -1.1], [0.8, -1.1]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.22, 10), dark); wh.rotation.z = Math.PI / 2; wh.position.set(wx, 0.29, wz); g.add(wh);
    }
    const glass = [];
    const pane = (w, hh, x, y, z, ry, tex) => {
      const m = new THREE.MeshStandardMaterial({ map: tex, color: '#e4edf0', transparent: true, opacity: 0.3, roughness: 0.35, emissive: '#8fa6b0', emissiveIntensity: 0.1, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), m); mesh.position.set(x, y, z); mesh.rotation.y = ry; body.add(mesh); glass.push(m);
    };
    pane(1.62, 0.4, 0.745, 1.2, -0.2, Math.PI / 2, texPlain); pane(1.62, 0.4, -0.745, 1.2, -0.2, -Math.PI / 2, texHeart);
    pane(1.25, 0.4, 0, 1.2, 0.782, 0, texPlain); pane(1.25, 0.4, 0, 1.2, -1.182, Math.PI, texPlain);
    // collision: the car is a solid box on the verge
    const cs = Math.cos(th), sn = Math.sin(th), W = (a, b) => [s.x + a * cs + b * sn, s.z - a * sn + b * cs], c = [W(-0.85, -1.8), W(0.85, -1.8), W(0.85, 1.8), W(-0.85, 1.8)];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
    Object.assign(s, { g, body, glass, gy, built: true, fog: 0, state: 'rock', at: 0, cd: 0, horn: false, ph: Math.random() * TAU, amp: 0, flash: 0, gT: 0, th });
  }
  addEventListener('pd-horn', e => { const d = e.detail; if (!d) return; for (const s of sites) if (s.built && isNight() && Math.hypot(s.x - d.x, s.z - d.z) < 45) s.horn = true; });

  // hearts floating out of a rocking car, seen from nearby: the notes effect of src/pub-notes.js with a heart in its first atlas cell
  const heartAtlas = () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    const heart = () => { g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(8, 72, 12, 16, 46, 16); g.bezierCurveTo(56, 16, 62, 24, 64, 34); g.bezierCurveTo(66, 24, 72, 16, 82, 16); g.bezierCurveTo(116, 16, 120, 72, 64, 112); g.closePath(); };
    g.lineJoin = 'round'; g.strokeStyle = '#120a0a'; g.lineWidth = 9; heart(); g.stroke(); g.fillStyle = '#fff'; heart(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
  };
  const HEART_OPTS = { glyphs: [0], atlas: heartAtlas, tints: [[1, 0.13, 0.25], [1, 0.3, 0.55], [1, 0.45, 0.65]] };

  function disturb(s) {
    s.state = 'angry'; s.at = 0; s.cd = 40; s.horn = false;
    const head = () => ({ x: s.x, y: s.gy + 2.1, z: s.z });
    say(pick(APPARTATI.yell), head, 0.35);
    if (Math.random() < 0.6) say(pick(APPARTATI.yell), head, 2.6);
  }
  function updateAppartati(dt) {
    if (!sites.length) return;
    const night = isNight();
    for (const s of sites) {
      const dx = s.x - car.x, dz = s.z - car.z, d = Math.hypot(dx, dz);
      if (!s.built) { if (d < 600) { try { buildCar(s); } catch (e) { console.warn('[missions] appartati', s.o.id, e); s.built = true; s.g = null; } } continue; }
      if (!s.g) continue;
      s.gT -= dt; if (s.gT <= 0) { s.gT = 2; const gy = groundAt(s.x, s.z); if (Math.abs(gy - s.gy) > 0.1) { s.gy = gy; s.g.position.y = gy; } }   // terrain refines as tiles stream in
      s.cd = Math.max(0, s.cd - dt);
      s.g.visible = d < 900;
      if (!s.g.visible) continue;
      s.fog += ((night ? 1 : 0) - s.fog) * Math.min(1, 0.5 * dt);
      if (s.horn) { if (night && s.cd <= 0 && s.state === 'rock' && d < 32) disturb(s); s.horn = false; }   // only the horn (flagged by pd-horn) disturbs them; a horn heard out of range or in their cooldown is forgotten
      let target = night && s.state === 'rock' ? 1 : 0;
      if (s.state === 'angry') { s.at += dt; s.flash = s.at < 2.6 ? Math.max(0, Math.sin(s.at * 15)) * Math.exp(-s.at * 0.55) : 0; if (s.at > 8 || (s.at > 5 && d > 30)) { s.state = 'calm'; s.at = 0; } }
      else if (s.state === 'calm') { s.at += dt; s.flash = 0; if (s.at > 4) s.state = 'rock'; }
      s.amp += (target - s.amp) * Math.min(1, (target ? 0.6 : 6) * dt);
      if (d < 150 && !s.hearts) s.hearts = createNotes(scene, HEART_OPTS);
      if (s.hearts) { s.hearts.update(dt, d < 150 ? s.amp : 0, s.x, s.gy + 1.7, s.z, Math.cos(s.th) * 0.3, -Math.sin(s.th) * 0.3); if (d > 220 && !s.hearts.alive) { s.hearts.dispose(); s.hearts = null; } }
      if (s.amp > 0.01) {   // rocking on the suspension, unmistakable and a little uneven
        s.ph += dt * TAU * 2.3;
        const w = Math.sin(s.ph) * 0.9 + Math.sin(s.ph * 0.37) * 0.4;
        s.body.rotation.z = w * 0.05 * s.amp; s.body.rotation.x = Math.sin(s.ph * 0.5 + 1) * 0.018 * s.amp; s.body.position.y = Math.abs(w) * 0.07 * s.amp;
      } else { s.body.rotation.z = s.body.rotation.x = 0; s.body.position.y = 0; }
      for (const m of s.glass) { m.opacity = 0.3 + 0.62 * s.fog; m.emissiveIntensity = 0.1 + 0.35 * s.fog + 1.9 * s.flash; }
    }
  }

  return { update(dt, allowed) { updateSpaccia(dt, allowed); updateAppartati(dt); }, inZone, sites };
}
