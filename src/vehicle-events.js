// Two local-colour events that change the player's vehicle. Owned by the driving work; created by src/vehicle.js, updated from its updateVisual().
//
//  1. THE ZEN GAG. Drive into the ZEN (San Filippo Neri, north-west Palermo) and, a few seconds later, the screen darkens (a vignette closing in,
//     the colour draining, the vehicle sounds muffled), goes black for a beat, and you wake up parked just outside the district, facing away,
//     with the vehicle stripped to the bare frame and wheels (canvas, roof, doors, seats, lights, mirrors, stickers, tuning parts gone). It stays
//     drivable. Five minutes of game time later everything is back. Purely cosmetic: garage ownership is untouched. Position based, so it only
//     happens where the world streaming lets you drive (?world=1).
//
//  2. "CORSE CLANDESTINE". At night a crowd and scooters gather on Viale delle Scienze in front of the University. Stop at the start to join:
//     you swap to a horse and sulky (calesse da corsa), race down the avenue against three rival sulkies with scooters escorting and honking
//     around you, and win a cash prize for the Garage wallet. Cartoon only, the horse is always fine. Afterwards you get your vehicle back.
//
// Night comes from the day/night cycle's 'pd-time' event ({ isNight }); ?night=1 forces it. Test links: ?at=x,z puts the car there,
// ?corse=join starts the race straight away, ?corsefreeze=SECONDS freezes everything that long after the start of the race.
import * as THREE from 'three';
import { Kit, box, sph } from './vehicle-kit.js';
import { buildVehicleModel } from './vehicle-models.js';
import { hooks } from './core.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const Q = new URLSearchParams(location.search);
const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
const T2 = (it, en) => lang() === 0 ? [it, en] : [en, it];

// ---------- places (metres in the game's projection: x east, z south) ----------
// The ZEN: Via Costante Girardengo, Via Fausto Coppi, Via Rocky Marciano and Via Primo Carnera are its streets in the OSM data.
const ZEN = [[-4260, -7720], [-3640, -7720], [-3640, -6740], [-4260, -6740]];
const ZEN_C = [-3950, -7230];
// Viale delle Scienze, from the University's front (Edifici 2 and 3) south-west to the Engineering buildings: the race track.
const TRACK = [[-815, 1000], [-868, 1057], [-910, 1106], [-1000, 1209], [-1108, 1336], [-1212, 1445]];

function polyDist(poly, x, z) { // distance to the outline
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0, d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }

const CSS = `
.vz-fade { position: fixed; inset: 0; z-index: 450; pointer-events: none; opacity: 0; --r: 120; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, transparent calc(var(--r) * 1%), #000 calc(var(--r) * 1% + 30%)); }
.vz-fade.on { opacity: 1; }
.vz-fade b { font: 400 clamp(34px, 9vh, 70px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .3em; color: #f5a9c9; opacity: 0; transition: opacity .3s; }
.vz-fade.dots b { opacity: .85; }
.cr { font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; pointer-events: none; }
.cr-prompt { position: fixed; z-index: 61; left: 50%; top: max(60px, 9vh); transform: translateX(-50%) skewX(-6deg); min-width: min(330px, 70vw); padding: 7px 18px 11px; text-align: center; display: none;
  background: linear-gradient(90deg, rgba(11,7,9,.86), rgba(60,14,40,.82)); border-left: 5px solid #e8559a; box-shadow: 0 3px 16px rgba(0,0,0,.5); overflow: hidden; }
.cr-prompt.on { display: block; } .cr-prompt > * { transform: skewX(6deg); }
.cr-prompt h4 { margin: 0; font: 400 clamp(16px, 3.6vh, 24px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .08em; color: #fff; text-shadow: 0 0 10px #e8559a; }
.cr-prompt p { margin: 3px 0 0; font-weight: 700; font-size: clamp(11px, 2.6vh, 15px); letter-spacing: .12em; color: #f5a9c9; }
.cr-prompt small { display: block; font-weight: 600; font-size: .8em; opacity: .75; }
.cr-prompt .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,.14); transform: none; }
.cr-prompt .bar i { display: block; height: 100%; width: 100%; transform-origin: left; transform: scaleX(0); background: linear-gradient(90deg, #f5a9c9, #e8559a); }
.cr-hud { position: fixed; z-index: 60; left: 50%; top: max(60px, 9vh); transform: translateX(-50%) skewX(-6deg); width: min(330px, 46vw); display: none;
  background: linear-gradient(90deg, rgba(11,7,9,.82), rgba(40,12,28,.76)); border-left: 5px solid #e8559a; box-shadow: 0 3px 12px rgba(0,0,0,.4); padding: 5px 10px 8px 8px; }
.cr-hud.on { display: block; } .cr-hud > * { transform: skewX(6deg); }
.cr-hud .row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cr-hud .pos { font: 400 clamp(22px, 5.4vh, 34px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; text-shadow: 0 0 10px #e8559a; }
.cr-hud .pos small { font-size: .5em; opacity: .75; margin-left: 3px; }
.cr-hud .lab { font-weight: 600; font-size: 10px; letter-spacing: .16em; color: #f5a9c9; text-align: right; }
.cr-hud .dist { font: 400 clamp(15px, 3.4vh, 20px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; text-align: right; display: block; }
.cr-track { position: relative; height: 10px; margin: 6px 4px 2px; background: rgba(255,255,255,.14); border-radius: 5px; }
.cr-track::after { content: ''; position: absolute; right: -2px; top: -4px; width: 4px; height: 18px; background: repeating-linear-gradient(#fff 0 3px, #000 3px 6px); }
.cr-dot { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #aaa; box-shadow: 0 0 0 2px rgba(0,0,0,.6); }
.cr-dot.me { background: #e8559a; width: 16px; height: 16px; margin: -8px 0 0 -8px; box-shadow: 0 0 0 2px #fff, 0 0 10px #e8559a; z-index: 2; }
.cr-count { position: fixed; z-index: 62; left: 50%; top: 32%; transform: translate(-50%, -50%) skewX(-8deg); font: 400 clamp(60px, 22vh, 170px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif;
  color: #fff; -webkit-text-stroke: 3px #0b0709; paint-order: stroke fill; text-shadow: 0 0 24px #e8559a, 0 6px 10px rgba(0,0,0,.6); display: none; text-align: center; }
.cr-count.on { display: block; animation: cr-pop .9s ease-out; } .cr-count small { display: block; font-size: .16em; letter-spacing: .2em; -webkit-text-stroke: 0; }
@keyframes cr-pop { 0% { transform: translate(-50%, -50%) scale(1.6) skewX(-8deg); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1) skewX(-8deg); } }
.cr-result { position: fixed; z-index: 62; left: 50%; top: 22%; transform: translate(-50%, 0) skewX(-6deg); min-width: min(300px, 60vw); padding: 10px 20px 12px; text-align: center; display: none;
  background: linear-gradient(180deg, rgba(11,7,9,.9), rgba(60,14,40,.88)); border: 2px solid #e8559a; box-shadow: 0 0 30px rgba(232,85,154,.5); }
.cr-result.on { display: block; } .cr-result > * { transform: skewX(6deg); }
.cr-result h3 { margin: 0 0 6px; font: 400 clamp(20px, 4.6vh, 32px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; text-shadow: 0 0 12px #e8559a; }
.cr-result p { margin: 0; font-weight: 700; font-size: clamp(14px, 3.2vh, 20px); letter-spacing: .12em; color: #f5a9c9; }
@media (max-height: 520px) { .cr-hud { top: 56px; width: min(280px, 40vw); } .cr-prompt { top: 56px; } }
`;

export function createVehicleEvents({ scene, camera, car, groundY, roadVerts, api, audio, mobile }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = (cls, html, parent = document.body) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; parent.append(e); return e; };
  const log = (...a) => { if (Q.has('evlog')) console.warn('[ev]', ...a); };
  let gameT = 0;   // seconds of simulated play: every timer below runs on it, so a pause freezes everything
  const view = document.getElementById('view');

  // =============================================================================================== the ZEN
  const vz = el('vz-fade', '<b>...</b>');
  const Z = { state: 'out', t: 0, restoreAt: -1, cool: 0, wokeBalloon: false };
  const ZEN_LINES = ['Ti ficiru u tagliando completo!', 'Ma unni sunnu i sedili?!', 'Chi bellu telaio, pulitu pulitu!', 'Bentornato! Pi furtuna c\'è u telaio.'];
  const ZS = Q.has('zenfast') ? 0.15 : 1, FADE = 3.2 * ZS, BLACK = 1.5 * ZS, WAKE = 2.4 * ZS, GRACE = 2.5 * ZS;   // zenfast: a test link that plays the sequence in a fraction of the time
  const zf = Q.get('zenfreeze'), zk = +Q.get('zenk') || 0.5;   // test: freeze in state zf (fade|black|wake) once it is zk of the way through
  function zenVisual(level, dots) { // level 0 clear .. 1 black
    vz.classList.toggle('on', level > 0.002); vz.classList.toggle('dots', !!dots);
    vz.style.setProperty('--r', (120 - 150 * level).toFixed(1));
    if (view) view.style.filter = level > 0.002 ? `grayscale(${Math.min(1, level * 1.4).toFixed(2)}) brightness(${(1 - 0.45 * level).toFixed(2)})` : '';
    audio.setMuffle(level);
  }
  function zenTeleport() {
    // nearest road point well outside the district; wake up there, facing away from the ZEN
    let best = null, bd = Infinity;
    for (let i = 0; i < roadVerts.length; i++) {
      const v = roadVerts[i], d = (v[0] - car.x) ** 2 + (v[1] - car.z) ** 2;
      if (d < bd && !inPoly(ZEN, v[0], v[1]) && polyDist(ZEN, v[0], v[1]) > 22) { bd = d; best = v; }
    }
    let x, z, th;
    if (best) { x = best[0]; z = best[1]; th = best[2]; }
    else { // roads not loaded: a point 40 m outside the outline, straight away from the centre
      const dx = car.x - ZEN_C[0], dz = car.z - ZEN_C[1], l = Math.hypot(dx, dz) || 1; x = car.x; z = car.z;
      for (let k = 0; k < 400 && (inPoly(ZEN, x, z) || polyDist(ZEN, x, z) < 40); k++) { x += dx / l * 5; z += dz / l * 5; }
      th = Math.atan2(dx, dz);
    }
    const ax = x - ZEN_C[0], az = z - ZEN_C[1];   // face away from the centre
    if (Math.sin(th) * ax + Math.cos(th) * az < 0) th += PI;
    api.teleport(x, z, th);
  }
  function zenUpdate(dt) {
    if (car.type === 'sulky') return;
    if (zf && Z.state === zf && Z.t >= zk * ({ fade: FADE, black: BLACK, wake: WAKE }[zf])) { frozenRace = true; return; }
    Z.cool = Math.max(0, Z.cool - dt);
    switch (Z.state) {
      case 'out':
        if (Z.cool <= 0 && inPoly(ZEN, car.x, car.z)) { Z.state = 'in'; Z.t = 0; log('zen in'); }
        break;
      case 'in':
        if (!inPoly(ZEN, car.x, car.z)) { Z.state = 'out'; break; }
        if ((Z.t += dt) >= GRACE) { Z.state = 'fade'; Z.t = 0; log('zen fade'); }
        break;
      case 'fade': {
        Z.t += dt; const k = clamp(Z.t / FADE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (Z.t >= FADE) { Z.state = 'black'; Z.t = 0; zenVisual(1, true); api.holdSim(true); zenTeleport(); api.setStripped(true); log('zen black, woke at', Math.round(car.x), Math.round(car.z), 'th', car.th.toFixed(2), 'inside?', inPoly(ZEN, car.x, car.z)); Z.restoreAt = gameT + 300; Z.wokeBalloon = false; }
        break;
      }
      case 'black':
        if ((Z.t += dt) >= BLACK) { Z.state = 'wake'; Z.t = 0; api.holdSim(false); zenVisual(1, false); }
        break;
      case 'wake': {
        Z.t += dt; const k = 1 - clamp(Z.t / WAKE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (!Z.wokeBalloon && Z.t > 1.1) { Z.wokeBalloon = true; const sn = Math.sin(car.th), cs = Math.cos(car.th); const x = car.x + cs * 3.2 + sn * 2, z = car.z - sn * 3.2 + cs * 2;
          dispatchEvent(new CustomEvent('pd-shout', { detail: { x, y: groundY(x, z) + 1.75, z, text: ZEN_LINES[Math.floor(Math.random() * ZEN_LINES.length)] } })); }
        if (Z.t >= WAKE) { log('zen done'); Z.state = 'out'; Z.cool = 20; zenVisual(0); }
        break;
      }
    }
    if (api.stripped && Z.restoreAt > 0 && gameT >= Z.restoreAt && Z.state === 'out') { // five minutes later everything is back
      api.setStripped(false); Z.restoreAt = -1;
      for (let i = 0; i < 10; i++) api.puff(car.x + (Math.random() - 0.5) * 1.6, groundY(car.x, car.z) + 0.6, car.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.9);
    }
  }

  // =============================================================================================== the race
  const cum = [0]; for (let i = 1; i < TRACK.length; i++) cum.push(cum[i - 1] + Math.hypot(TRACK[i][0] - TRACK[i - 1][0], TRACK[i][1] - TRACK[i - 1][1]));
  const L = cum[cum.length - 1];
  const P = { x: 0, z: 0, tx: 0, tz: 1 };   // scratch result of at()
  function at(s) { // point and unit tangent at distance s along the track (extrapolated before the start and after the finish)
    let i = 0; if (s > 0) while (i < TRACK.length - 2 && s > cum[i + 1]) i++;
    const a = TRACK[i], b = TRACK[i + 1], l = cum[i + 1] - cum[i], u = (s - cum[i]) / l;
    P.tx = (b[0] - a[0]) / l; P.tz = (b[1] - a[1]) / l; P.x = a[0] + (b[0] - a[0]) * u; P.z = a[1] + (b[1] - a[1]) * u; return P;
  }
  function project(x, z) { // distance along the track of the nearest point
    let best = Infinity, bs = 0;
    for (let i = 0; i < TRACK.length - 1; i++) {
      const a = TRACK[i], b = TRACK[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
      const d = (x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2; if (d < best) { best = d; bs = cum[i] + t * Math.sqrt(l2); }
    }
    return bs;
  }
  const startPt = at(0), SX = startPt.x, SZ = startPt.z;

  const R = { state: 'off', t: 0, stop: 0, cool: 0, crowd: null, scoots: [], rivals: [], prize: 0, rank: 0, started: false, prevHud: '' };
  let night = Q.get('night') === '1';
  addEventListener('pd-time', e => { night = Q.get('night') === '1' || !!(e.detail && e.detail.isNight); });
  const prompt = el('cr cr-prompt', ''), hud = el('cr cr-hud', ''), count = el('cr cr-count', ''), result = el('cr cr-result', '');
  hud.innerHTML = '<div class="row"><span class="pos"></span><span class="lab"></span></div><div class="cr-track"><i class="cr-dot"></i><i class="cr-dot"></i><i class="cr-dot"></i><i class="cr-dot me"></i></div>';
  const hudPos = hud.querySelector('.pos'), hudLab = hud.querySelector('.lab'), dots = [...hud.querySelectorAll('.cr-dot')];
  const noShadow = !!(mobile && mobile.mobile);

  // ---- the crowd: instanced little people, hopping and cheering ----
  function figureGeos() {
    const K = new Kit(), m = {}; K.group('b', [0, 0, 0]).group('h', [0, 0, 0]);
    const B = K.on('b'), H = K.on('h');
    B.add(m, box(0.36, 0.62, 0.22), 0, 1.0, 0); for (const sx of [-1, 1]) { B.add(m, box(0.13, 0.72, 0.15), sx * 0.09, 0.36, 0); B.add(m, box(0.1, 0.5, 0.1), sx * 0.25, 1.05, 0, 0, 0, sx * 0.25); }
    H.add(m, sph(0.125, 8, 6), 0, 1.52, 0);
    const f = K.finish(); return [f.b[0].geom, f.h[0].geom];
  }
  function spawnCrowd() {
    const [gb, gh] = figureGeos(), N = 46;
    const bodies = new THREE.InstancedMesh(gb, new THREE.MeshStandardMaterial({ roughness: 0.9 }), N), heads = new THREE.InstancedMesh(gh, new THREE.MeshStandardMaterial({ color: '#d9a47a', roughness: 0.85 }), N);
    const col = new THREE.Color(), shirts = ['#f27aa8', '#17131a', '#e8e2cc', '#c42f2a', '#2a63b0', '#f0c92a', '#4f8a55', '#9b4dff'], skins = ['#f0c8a0', '#d9a47a', '#b9835c', '#8a5a3a'];
    const people = [];
    for (let i = 0; i < N; i++) {
      const finish = i >= 32, s = finish ? L - 14 + Math.random() * 36 : -12 + Math.random() * 60, side = Math.random() < 0.5 ? -1 : 1, off = 4.3 + Math.random() * 3.5;
      at(s); const x = P.x - P.tz * side * off, z = P.z + P.tx * side * off;   // normal to the track
      people.push({ x, z, y: groundY(x, z), ry: Math.atan2(P.tz * side, -P.tx * side) + (Math.random() - 0.5) * 0.8, ph: Math.random() * 6, sp: 5 + Math.random() * 4, h: 0.85 + Math.random() * 0.3 });
      col.set(shirts[i % shirts.length]); bodies.setColorAt(i, col); col.set(skins[(i * 7) % skins.length]); heads.setColorAt(i, col);
    }
    bodies.frustumCulled = heads.frustumCulled = false; scene.add(bodies, heads);
    R.crowd = { bodies, heads, people, N };
  }
  const _o = new THREE.Object3D();
  function crowdUpdate(t, cheer) {
    const c = R.crowd; if (!c) return;
    for (let i = 0; i < c.N; i++) {
      const p = c.people[i], hop = cheer ? Math.abs(Math.sin(t * p.sp + p.ph)) * 0.22 : Math.max(0, Math.sin(t * 2 + p.ph) - 0.8) * 0.1;
      _o.position.set(p.x, p.y + hop, p.z); _o.rotation.set(0, p.ry, 0); _o.scale.setScalar(p.h); _o.updateMatrix(); c.bodies.setMatrixAt(i, _o.matrix); c.heads.setMatrixAt(i, _o.matrix);
    }
    c.bodies.instanceMatrix.needsUpdate = true; c.heads.instanceMatrix.needsUpdate = true;
  }

  // ---- scooters ----
  const SC_TYPES = [['vespa', 'rosso'], ['scooterone', 'nero'], ['motorino', 'arancio'], ['vespa', 'rosanero'], ['scooterone', 'perla'], ['motorino', 'verde']];
  function mkRig(type, liv, shadows) { const r = buildVehicleModel({ type, livery: liv }); r.root.visible = true; for (const m of r.meshes) m.castShadow = shadows && m.castShadow; scene.add(r.root); return r; }
  function spawnScooters() {
    const n = noShadow ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const [ty, lv] = SC_TYPES[i], s = -6 + i * 7 + Math.random() * 4, side = i % 2 ? 1 : -1, off = 3.4 + Math.random() * 1.6;
      at(s); const x = P.x - P.tz * side * off, z = P.z + P.tx * side * off;
      R.scoots.push({ rig: mkRig(ty, lv, !noShadow), x, z, th: Math.atan2(P.tx, P.tz) + (Math.random() - 0.5) * 1.1 + (i % 2 ? 0.6 : -0.6), s, lat: side * (1.4 + Math.random() * 1.6), target: -1, so: -10 + Math.random() * 24, v: 0, spin: 0, honkT: 0.5 + Math.random() * 2, hop: 0, wob: Math.random() * 6, type: ty });
    }
  }
  function scootersUpdate(dt, racing) {
    for (const sc of R.scoots) {
      const rg = sc.rig; let y;
      if (!racing) { // parked and revving at the start
        y = groundY(sc.x, sc.z); rg.root.position.set(sc.x, y, sc.z); rg.root.rotation.y = sc.th;
        rg.pose({ pitch: 0, roll: Math.sin(gameT * 31 + sc.wob) * 0.012, lean: 0, steer: Math.sin(gameT * 0.7 + sc.wob) * 0.12, spin: 0, t: gameT, speed: 0 });
      } else { // riding alongside a racer
        const tg = sc.target === -1 ? Pl.s : R.rivals[sc.target].s, ts = tg + sc.so + (R.state === 'finish' || R.state === 'done' ? 18 : 0);
        const prev = sc.s; sc.s += clamp((ts - sc.s) * 1.6, -8, 40) * dt; sc.s = Math.min(sc.s, L + 30);
        const v = (sc.s - prev) / Math.max(dt, 1e-3); sc.v += (v - sc.v) * Math.min(1, 6 * dt);
        at(sc.s); const lat = sc.lat * (sc.s > L ? 1.6 : 1), nx = -P.tz, nz = P.tx;
        sc.x = P.x + nx * lat; sc.z = P.z + nz * lat; sc.th = Math.atan2(P.tx, P.tz) + Math.sin(gameT * 0.9 + sc.wob) * 0.04;
        y = groundY(sc.x, sc.z); rg.root.position.set(sc.x, y, sc.z); rg.root.rotation.y = sc.th;
        sc.spin += sc.v * dt / (rg.A.wheelR || 0.25);
        const wheelie = R.t < 1.4 && R.state === 'race' ? -0.35 * (1 - R.t / 1.4) : 0;
        rg.pose({ pitch: wheelie, roll: 0, lean: Math.sin(gameT * 1.3 + sc.wob) * 0.3, steer: Math.sin(gameT * 1.1 + sc.wob) * 0.1, spin: sc.spin, t: gameT, speed: sc.v });
      }
      sc.honkT -= dt;
      if (sc.honkT <= 0) {
        sc.honkT = racing ? 0.4 + Math.random() * 1.1 : 0.9 + Math.random() * 2.6;
        const d = Math.hypot(sc.x - camera.position.x, sc.z - camera.position.z); audio.honk(clamp(1 - d / 80, 0, 1) * 0.8, 0.85 + Math.random() * 0.4);
        sc.hop = 1;
      }
      if (sc.hop > 0) { sc.hop = Math.max(0, sc.hop - dt * 4); rg.root.position.y += Math.sin(sc.hop * PI) * 0.05; }
    }
  }

  // ---- rivals ----
  const Pl = { s: 0, rank: 1, done: false };
  const RIV = [{ liv: 'sauro', vmax: 22.0, lat: -1.5, row: 0 }, { liv: 'morello', vmax: 23.0, lat: 1.5, row: 0 }, { liv: 'grigio', vmax: 21.0, lat: 0.0, row: -4 }];
  function spawnRivals() {
    R.rivals = RIV.map((d, i) => ({ ...d, rig: mkRig('sulky', d.liv, true), s: d.row, v: 0, spin: 0, seed: Math.random() * 6, done: false, doneT: 0, i }));
  }
  function rivalsUpdate(dt) {
    for (const r of R.rivals) {
      if (R.state === 'race' || R.state === 'finish') {
        if (!r.done) {
          const rub = Pl.s - r.s > 45 ? 1.1 : r.s - Pl.s > 50 ? 0.92 : 1;   // a little rubber band so the race stays a race
          const vt = r.vmax * rub * (0.94 + 0.06 * Math.sin(R.t * 0.8 + r.seed));
          r.v += clamp(vt - r.v, -8 * dt, 6 * dt); r.s += r.v * dt;
          if (r.s >= L) { r.done = true; r.doneT = R.t; }
        } else { r.v = Math.max(0, r.v - 8 * dt); r.s += r.v * dt; }
      } else r.v = 0;
      at(r.s); const x = P.x - P.tz * r.lat, z = P.z + P.tx * r.lat; r.spin += r.v * dt / 0.5;
      r.rig.root.position.set(x, groundY(x, z), z); r.rig.root.rotation.y = Math.atan2(P.tx, P.tz);
      r.rig.pose({ pitch: 0, roll: 0, lean: 0, steer: 0, spin: r.spin, t: gameT, speed: r.v });
    }
  }

  function dispose() {
    const c = R.crowd; if (c) { scene.remove(c.bodies, c.heads); c.bodies.geometry.dispose(); c.heads.geometry.dispose(); c.bodies.material.dispose(); c.heads.material.dispose(); R.crowd = null; }
    for (const s of R.scoots) { s.rig.dispose(); } R.scoots.length = 0;
    for (const r of R.rivals) r.rig.dispose(); R.rivals.length = 0;
    prompt.classList.remove('on'); hud.classList.remove('on'); count.classList.remove('on'); result.classList.remove('on');
  }
  const fmtPos = n => ['1', '2', '3', '4'][n - 1];
  function setHud() {
    hud.classList.add('on');
    const rank = Pl.rank; hudPos.innerHTML = `${fmtPos(rank)}<small>/4</small>`;
    const left = Math.max(0, L - Pl.s); hudLab.innerHTML = `${T2('Corse clandestine', 'Night race')[0]}<span class="dist">${Math.round(left)} m</span>`;
    dots[3].style.left = (clamp(Pl.s / L, 0, 1) * 100).toFixed(1) + '%';
    for (let i = 0; i < 3; i++) dots[i].style.left = (clamp(R.rivals[i].s / L, 0, 1) * 100).toFixed(1) + '%';
  }
  function showCount(big, sub) { count.innerHTML = `${big}${sub ? `<small>${sub}</small>` : ''}`; count.classList.remove('on'); void count.offsetWidth; count.classList.add('on'); R.countUntil = gameT + 1.1; }

  function startRace() {
    log('race start');
    R.state = 'count'; R.t = 0; R.started = false; Pl.s = 0; Pl.done = false; Pl.rank = 1; R.lastCount = 4;
    if (!R.rivals.length) spawnRivals();
    api.lockSwap(true); api.preview({ type: 'sulky', livery: ['baio', 'sauro', 'morello', 'grigio'][Math.floor(Math.random() * 4)], parts: {} });
    at(2); const th = Math.atan2(P.tx, P.tz), lat = 0.0;
    api.teleport(P.x - P.tz * lat, P.z + P.tx * lat, th);
    api.holdSim(true); prompt.classList.remove('on');
    for (const sc of R.scoots) sc.target = Math.floor(Math.random() * 4) - 1;
  }
  function endRace() {
    R.state = 'done'; R.cool = 240; api.holdSim(false); api.lockSwap(false); api.preview(null);   // your own vehicle comes back
    hud.classList.remove('on'); result.classList.remove('on');
    for (let i = 0; i < 8; i++) api.puff(car.x + (Math.random() - 0.5) * 2, groundY(car.x, car.z) + 0.5, car.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.8);
  }

  const forceJoin = Q.get('corse') === 'join', freezeAt = Q.has('corsefreeze') ? +Q.get('corsefreeze') : -1;
  let frozenRace = false, forced = false;
  function raceUpdate(dt) {
    const d2 = (car.x - SX) ** 2 + (car.z - SZ) ** 2, dist = Math.sqrt(d2);
    R.cool = Math.max(0, R.cool - dt);
    switch (R.state) {
      case 'off':
        if ((night && R.cool <= 0 && dist < 420 && car.type !== 'sulky') || (forceJoin && !forced && gameT > 3 && (!Q.has('world') || hooks.ground))) { spawnCrowd(); spawnScooters(); R.state = 'gather'; if (forceJoin) { forced = true; startRace(); } }
        break;
      case 'gather': {
        crowdUpdate(gameT, false); scootersUpdate(dt, false);
        if (Q.has('gatherfreeze') && (R.g = (R.g || 0) + dt) > 0.6) frozenRace = true;   // test link
        if (!night && dist > 120) { dispose(); R.state = 'off'; break; }
        if (dist > 800) { dispose(); R.state = 'off'; break; }
        const near = dist < 60; prompt.classList.toggle('on', near && R.cool <= 0);
        if (near && R.cool <= 0) {
          const slow = Math.abs(car.vf) < 2.5 && dist < 24 && !Q.has('nojoin'); R.stop = slow ? R.stop + dt : Math.max(0, R.stop - dt * 2);
          const t = T2('Corse clandestine', 'Night street race'), s = T2('Fermati qui per partecipare', 'Stop here to join'), pr = prompt.dataset.k;
          if (pr !== 'x' + lang()) { prompt.dataset.k = 'x' + lang(); prompt.innerHTML = `<h4>${t[0]}</h4><p>${s[0]}<small>${s[1]}</small></p><div class="bar"><i></i></div>`; }
          prompt.querySelector('.bar i').style.transform = `scaleX(${clamp(R.stop / 1.1, 0, 1)})`;
          if (R.stop >= 1.1) { R.stop = 0; startRace(); }
        }
        break;
      }
      case 'count': {
        R.t += dt; crowdUpdate(gameT, true); scootersUpdate(dt, false);
        const n = 3 - Math.floor(R.t); if (n !== R.lastCount) { R.lastCount = n; if (n > 0) showCount(String(n), T2('Pronti', 'Ready')[0]); }
        rivalsUpdate(dt); Pl.s = project(car.x, car.z); setHud();
        if (R.t >= 3) { R.state = 'race'; R.t = 0; api.holdSim(false); showCount(T2('VIA!', 'GO!')[0]); }
        break;
      }
      case 'race': case 'finish': {
        R.t += dt; crowdUpdate(gameT, true);
        Pl.s = project(car.x, car.z);
        let rank = 1; for (const r of R.rivals) if (r.s > Pl.s) rank++; Pl.rank = rank;
        scootersUpdate(dt, true); rivalsUpdate(dt); setHud();
        if (R.state === 'race' && (Pl.s >= L - 3 || R.t > 110)) {
          const won = Pl.s >= L - 3; let finished = 0; for (const r of R.rivals) if (r.done) finished++;
          R.rank = won ? finished + 1 : 4; log('race finish rank', R.rank, 'prize', won ? [60, 25, 10, 0][finished] : 0); R.prize = won ? [60, 25, 10, 0][R.rank - 1] : 0; R.state = 'finish'; R.t = 0;
          if (R.prize > 0) api.garage.credit(R.prize);
          const h = won ? T2(`${R.rank}° posto!`, `Place ${R.rank}!`) : T2('Tempo scaduto', 'Time is up');
          const pz = R.prize > 0 ? T2(`Premio € ${R.prize}`, `Prize € ${R.prize}`) : T2('Niente premio, ritenta', 'No prize, try again');
          result.innerHTML = `<h3>${h[0]}</h3><p>${pz[0]}</p>`; result.classList.add('on'); count.classList.remove('on');
        }
        if (R.state === 'finish' && R.t > 5) endRace();
        break;
      }
      case 'done':
        crowdUpdate(gameT, R.cool > 230); scootersUpdate(dt, true);
        if (dist > 700 || (!night && dist > 120)) { dispose(); R.state = 'off'; }
        break;
    }
  }

  let atDone = false;
  return {
    stripped: () => api.stripped,
    update(dt, active) {
      if (!atDone && Q.has('at') && (!Q.has('world') || hooks.ground)) {   // test: wait for the streamed terrain, or the car would drop into the sea
 atDone = true; const [x, z] = Q.get('at').split(',').map(Number); api.teleport(x, z, +Q.get('atth') || 0); }
      if (!active) return;
      gameT += dt;
      if (frozenRace) return;
      zenUpdate(dt);
      raceUpdate(dt);
      if (R.countUntil && gameT > R.countUntil) { count.classList.remove('on'); R.countUntil = 0; }
      if (freezeAt >= 0 && R.state === 'race' && R.t >= freezeAt) { frozenRace = true; api.holdSim(true); }
      if (Q.has('corsewin') && R.state === 'race' && R.t > 1.5 && !R.warped) { R.warped = true; at(L - 60); api.teleport(P.x, P.z, Math.atan2(P.tx, P.tz)); }   // test: jump to the finish
      if (Q.has('resultfreeze') && R.state === 'finish' && R.t > 0.6) { frozenRace = true; }
    },
    state: () => ({ zen: Z.state, race: R.state }),
  };
}
