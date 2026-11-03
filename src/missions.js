// Free roam: the objectives of the world, plus the stigghiulari (grill vendors with smoke plumes and nitro refills), the pollanche vendors on
// Monte Pellegrino and the night gags of src/missions-night.js. Owned by the missions work.
//
// There are no modes any more. Events start when people call the lapa: a character waves and shouts from the kerb (src/event-calls.js); stop next
// to them to accept. Every event place is a slot built from src/event-places.js (lat/lon, owner-editable) and src/event-routes.js (baked by
// assets/missions/snap-places.mjs: road points, taxi routes, hunt items, race tracks).
//   fares (src/event-fares.js)  tourists in the centro, regular taxi rides, "a pulle" (Viale Diana, the old A Favorita), urgent long runs; timer + tip
//   food (src/event-food.js)    "Benny ha perso le sue pizzette": hunt the items close by, bring them back; one event type for many places
//   races (src/races.js)        sprint and lap races with a grid start, plus the night Corse clandestine
// The overlay is src/event-hud.js (top centre). Screen changes go through src/transition.js.
//
// createMissions(env) -> { mode ('free'), setMode() (no-op, kept for compatibility), update(dt), stop(), events(), progress(), busy() }
//   events() -> [{ id, kind: 'fare'|'urgent'|'food'|'race', name, x, z, night? }]  (x, z: a road point next to the caller; the start map pins them)
//   progress() -> { food: { done, total }, races: { won, total }, fares }   (localStorage 'palermoDrive.events.v1')
//   busy() -> true while an event runs
//   status(id) -> { done, tried, best }, ready(id) -> [x, z, th] (the caller is there at once and accepts without a drive-off first): used by the Missioni screen (src/ui.js); the done events are also kept in prog.done
//   stand(id) -> [x, z, th]: the same spot, the caller there, but nothing starts: the big map (src/ui.js) asks first, ready(id) is the yes. arrive(): any other jump from the map, a caller next to it does not accept either
//   env: { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, shout, game, vehicle, pedestrians, traffic, mapMarkers, mapRoute, world, placeAt, proj }
// Test links: ?event=food:benny | fare:qc | urgent:u-stadio | race:olimpo puts the lapa at that event (add &auto to accept at once; race:corse forces night).
// Speech uses env.shout (src/shouts.js). Lines live in assets/missions/lines.js (review copy: lines.md).
import * as THREE from 'three';
import { DRIVER, VENDOR, VENDOR_SERVE, DESTS, VENDORS, POLLANCHE, FAVORITA } from '../assets/missions/lines.js';
import { WORLD } from './core.js';
import { createNightLife } from './missions-night.js';
import { createEventHud } from './event-hud.js';
import { createCalls, KIND_COLOR } from './event-calls.js';
import { createFares } from './event-fares.js';
import { createFood } from './event-food.js';
import { createRaces } from './races.js';
import { createPubs } from './pubs.js';
import { createRave } from './rave.js';
import { createRaveEvents } from './event-rave.js';
import { createHornsEvents } from './event-horns.js';
import { createAchievements } from './achievements.js';
import { ITEMS, FOOD_PLACES, TAXI_DESTS, FARE_SPOTS, PULLE_DEST, URGENT, RACES, RAVE, HORNS } from './event-places.js';
import { SNAP, ROUTES, HUNT, TRACKS } from './event-routes.js';
import { transition } from './transition.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const eur = v => '€ ' + v.toFixed(2).replace('.', ',');
const PROG_KEY = 'palermoDrive.events.v1';

export function createMissions(env) {
  const api = { mode: 'free', setMode() {}, update() {}, stop() {}, events: () => [], progress: () => ({ food: { done: 0, total: 0 }, races: { won: 0, total: 0 }, fares: 0 }), busy: () => false };
  try { return build(env); } catch (e) { console.error('[missions] disabled:', e); return api; }
}

function build(env) {
  const { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, game, vehicle, pedestrians, traffic, mapMarkers, shout } = env;
  const mapRoute = env.mapRoute || [];
  pedestrians.bindGame?.(game);   // the crowd reads game.time (day/night) from here
  const params = new URLSearchParams(location.search);
  const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian']);
  const groundAt = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'it');
  const T = (it, en) => (lang() === 'en' ? en : it);
  const now = () => performance.now() / 1000;
  const worldOn = () => WORLD || !!window.PALERMO_WORLD;                       // the whole-city tiles (Favorita, Monte Pellegrino) are streamed in
  const isNight = () => !!(pedestrians.night && pedestrians.night().night);   // day/night via the pedestrians module (game.time), daytime if unknown


  // ------------------------------------------------------------------------------------ places
  const segs = [];
  for (const r of D.roads) {
    if (!DRIVABLE.has(r.k)) continue;
    const p = r.p;
    for (let i = 0; i + 3 < p.length; i += 2) segs.push([p[i], p[i + 1], p[i + 2], p[i + 3], r.w || 6, r.k]);
  }
  // nearest point on a drivable centreline: { x, z, dx, dz (unit direction), w, d }
  function snapRoad(x, z) {
    let best = null, bd = Infinity;
    for (const s of segs) {
      const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz;
      const t = l2 ? clamp(((x - s[0]) * dx + (z - s[1]) * dz) / l2, 0, 1) : 0;
      const qx = s[0] + dx * t, qz = s[1] + dz * t, d = Math.hypot(x - qx, z - qz) + (s[5] === 'pedestrian' ? 4 : 0);
      if (d < bd) { bd = d; const l = Math.sqrt(l2) || 1; best = { x: qx, z: qz, dx: dx / l, dz: dz / l, w: s[4], d }; }
    }
    return best || { x, z, dx: 0, dz: 1, w: 6, d: 0 };
  }
  const wallDist = (x, z) => {
    let m = 3;
    walls2d.query(x - 3, z - 3, x + 3, z + 3, s => { const [qx, qz] = closestOnSeg(x, z, s); m = Math.min(m, Math.hypot(x - qx, z - qz)); });
    return m;
  };
  // a spot beside the road, on the side that is pavement (or at least not against a wall)
  function sideSpot(sn, off) {
    let best = null, bs = -Infinity;
    for (const s of [1, -1]) {
      const x = sn.x - sn.dz * s * off, z = sn.z + sn.dx * s * off;
      const sc = (raisedMask(x, z) ? 1.5 : 0) + Math.min(wallDist(x, z), 1.6);
      if (sc > bs) { bs = sc; best = { x, z, s, sc }; }
    }
    return best;
  }
  const place = (o, extra) => {
    const [vx, vz] = env.proj(o.lat, o.lon), sn = snapRoad(vx, vz);
    return { ...o, ...extra, vx, vz, x: sn.x, z: sn.z, road: sn };
  };

  // ------------------------------------------------------------------------------------ the event overlay (src/event-hud.js)
  const hud = createEventHud({ camera, car, groundY });
  let hudUsed = false;
  const hudSetRaw = hud.set; hud.set = o => { hudUsed = true; hudSetRaw(o); };   // a module that wants the card calls set() every frame, otherwise it is hidden
  const toast = hud.toast, burst = hud.burst;

  // ------------------------------------------------------------------------------------ speech (env.shout)
  const talkQ = []; let talkClock = 0, lastTalk = -9;
  // lines: array of strings or [text, gloss]; pos(): { x, y, z } anchor, delay in seconds
  function say(line, pos, delay = 0) {
    if (!shout || !line) return;
    talkQ.push({ at: talkClock + delay, text: Array.isArray(line) ? line[0] : line, pos });
  }
  // a fare (phases board / ride / drop, src/event-fares.js) puts the balloons in focus: only the passenger (seatPos) speaks, one line at a time
  const fareTalk = () => !!S.ev && (S.phase === 'board' || S.phase === 'ride' || S.phase === 'drop');
  function updateTalk(dt) {
    talkClock += dt;
    const focus = fareTalk(); shout?.focus?.(focus);
    if (!talkQ.length || talkClock - lastTalk < (focus ? 2.2 : 0.55)) return;
    const i = talkQ.findIndex(q => q.at <= talkClock);
    if (i < 0) return;
    const q = talkQ.splice(i, 1)[0];
    if (talkClock - q.at > 5) return;
    if (focus && q.pos !== seatPos) return;
    const p = q.pos();
    shout(p.x, p.y, p.z, q.text, undefined, focus ? { pax: true } : undefined);
    lastTalk = talkClock;
  }
  const driverPos = () => ({ x: car.x, y: groundY(car.x, car.z) + car.lift - 0.3, z: car.z });
  const seatPos = () => ({ x: car.x, y: groundY(car.x, car.z) + car.lift - 0.1, z: car.z });

  // ------------------------------------------------------------------------------------ beacons: ground ring + light beam
  const RING_V = `attribute vec2 aP; varying vec2 vP; void main() { vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const RING_F = `uniform float uTime; uniform vec3 uCol; uniform float uAlpha; varying vec2 vP;
    void main() {
      float r = length(vP);
      float rim = smoothstep(0.84, 0.9, r) * (1.0 - smoothstep(0.985, 1.0, r));
      float halo = exp(-max(r - 1.0, 0.0) * 9.0) * step(1.0, r);
      float inner = 1.0 - smoothstep(0.0, 0.86, r);
      float wave = 0.5 + 0.5 * sin(uTime * 3.2 - r * 7.0);
      float rip = smoothstep(0.045, 0.0, abs(r - (0.2 + 0.7 * fract(uTime * 0.55)))) * 0.55 * (1.0 - fract(uTime * 0.55));
      float a = rim * 0.95 + halo * (0.45 + 0.25 * wave) + inner * (0.14 + 0.10 * wave) + rip;
      vec3 c = mix(uCol, vec3(1.0), clamp(rim * 0.55 + halo * 0.25 + rip, 0.0, 1.0));
      gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uAlpha);
      #include <colorspace_fragment>
    }`;
  const BEAM_V = `varying float vH; void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const BEAM_F = `uniform float uTime; uniform vec3 uCol; uniform float uAlpha; varying float vH;
    void main() {
      float a = smoothstep(0.0, 0.12, vH) * pow(1.0 - vH, 1.2) * 0.55 * (0.8 + 0.2 * sin(uTime * 2.0 + vH * 9.0));
      gl_FragColor = vec4(uCol, a * uAlpha);
      #include <colorspace_fragment>
    }`;
  const beacons = [];
  function makeBeacon(col, R, opt = {}) {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const seg = 44, fr = [0, 0.35, 0.7, 0.88, 0.96, 1.0, 1.06, 1.2, 1.4], nv = 1 + (fr.length - 1) * seg;
    const pos = new Float32Array(nv * 3), ap = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i < fr.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, f = fr[i + 1];
      ap[(1 + i * seg + j) * 2] = Math.cos(a) * f; ap[(1 + i * seg + j) * 2 + 1] = Math.sin(a) * f;
      const j2 = (j + 1) % seg, v0 = i === 0 ? 0 : 1 + (i - 1) * seg, a0 = i === 0 ? 0 : v0 + j, a1 = i === 0 ? 0 : v0 + j2, b0 = 1 + i * seg + j, b1 = 1 + i * seg + j2;
      if (i === 0) idx.push(0, b1, b0); else idx.push(a0, a1, b1, a0, b1, b0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aP', new THREE.BufferAttribute(ap, 2)); geo.setIndex(idx);
    const u = { uTime: { value: 0 }, uCol: { value: new THREE.Color(col) }, uAlpha: { value: 1 } };
    const ring = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_V, fragmentShader: RING_F, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    ring.frustumCulled = false; ring.renderOrder = 3; group.add(ring);
    let beam = null;
    if (opt.beam !== false) {
      const H = opt.height || 90, bg = new THREE.CylinderGeometry(1.8, 1.3, H, 20, 1, true); bg.translate(0, H / 2, 0);
      beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: u, vertexShader: BEAM_V, fragmentShader: BEAM_F, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      beam.frustumCulled = false; beam.renderOrder = 4; group.add(beam);
    }
    const b = {
      x: 0, z: 0, R, group, u, ring, beam,
      set(x, z) {
        b.x = x; b.z = z;
        const p = geo.attributes.position.array;
        p.set([x, groundAt(x, z) + 0.14, z], 0);
        for (let i = 0; i < fr.length - 1; i++) for (let j = 0; j < seg; j++) {
          const a = (j / seg) * TAU, f = fr[i + 1], px = x + Math.cos(a) * f * R, pz = z + Math.sin(a) * f * R;
          p.set([px, groundAt(px, pz) + 0.14, pz], (1 + i * seg + j) * 3);
        }
        geo.attributes.position.needsUpdate = true;
        if (beam) beam.position.set(x, groundAt(x, z), z);
      },
      show(on) { group.visible = on; },
    };
    ring.onBeforeRender = () => { u.uTime.value = now() % 1000; };
    beacons.push(b);
    return b;
  }

  // ------------------------------------------------------------------------------------ guidance
  // A route is a baked polyline (src/event-routes.js) of flat x,z. The big arrow over the lapa points ~32 m ahead along it, so it turns with the
  // streets, and the minimap draws it (mapRoute). Without a route the arrow points straight at the target.
  const route = { pts: null, cum: null, len: 0, cursor: 0, s0: 0 };
  function setRoute(pts) {
    route.pts = pts; route.cum = [0];
    for (let i = 2; i < pts.length; i += 2) route.cum.push(route.cum[route.cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
    route.len = route.cum[route.cum.length - 1]; route.cursor = 0; route.s0 = 0;
    mapRoute.length = 0;
    for (let i = 0; i < pts.length; i += 2) mapRoute.push([pts[i], pts[i + 1]]);
  }
  function clearRoute() { route.pts = null; mapRoute.length = 0; }
  const _p = { x: 0, z: 0 };
  function routeAt(s) {   // position at arc length s along the route
    const c = route.cum, pts = route.pts; let i = clamp(route.cursor, 0, c.length - 2);
    while (i > 0 && c[i] > s) i--;
    while (i < c.length - 2 && c[i + 1] < s) i++;
    const seg = c[i + 1] - c[i] || 1, u = clamp((s - c[i]) / seg, 0, 1);
    _p.x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * u; _p.z = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * u;
    return _p;
  }
  const guide = { path: setRoute, off: clearRoute };
  const aim = { on: false, x: 0, z: 0 };

  // 3D guide arrow hovering over the lapa. It points along the computed route ~32 m ahead (so it turns
  // with the streets), or straight at the target until a route exists. Drawn on top of everything.
  const arrow3d = new THREE.Group();
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.25); sh.lineTo(0.95, 0.05); sh.lineTo(0.38, 0.05); sh.lineTo(0.38, -1.0);
    sh.lineTo(-0.38, -1.0); sh.lineTo(-0.38, 0.05); sh.lineTo(-0.95, 0.05); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0); // lies flat, tip towards -z after rotateX; flip to +z below
    geo.rotateY(Math.PI);
    // outline (inverted hull) first, pink body on top: with depthTest off, draw order decides
    const mk = (color, scale, side, order) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 }));
      m.scale.setScalar(scale); m.renderOrder = order; return m;
    };
    arrow3d.add(mk('#120a0e', 1.14, THREE.BackSide, 50), mk('#ff4fa3', 1.0, THREE.FrontSide, 51));
    arrow3d.scale.setScalar(0.36);
  }
  arrow3d.visible = false; arrow3d.renderOrder = 50; scene.add(arrow3d);
  let arrowYaw = 0, arrowT = 0;
  const _ad = new THREE.Vector3(), _an = new THREE.Vector3(), _ax = new THREE.Vector3(), _am = new THREE.Matrix4();
  const _arrowTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.42);
  function updateArrow3d(dt, show, tx, tz) {
    arrow3d.visible = show;
    if (!show) return;
    arrowT += dt;
    let ax = tx, az = tz;
    if (route.pts && route.len > 0) { const p = routeAt(Math.min(route.len, route.s0 + 32)); ax = p.x; az = p.z; }
    const want = Math.atan2(ax - car.x, az - car.z);
    let d = want - arrowYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    arrowYaw += d * Math.min(1, dt * 8);
    arrow3d.position.set(car.x, groundY(car.x, car.z) + (car.lift || 0) + 3.1 + Math.sin(arrowT * 3) * 0.1, car.z);
    // Face the camera (y axis = towards the eye) and turn the chevron within that plane towards the route
    // heading projected onto it: straight on points up, a left turn points left, behind points down.
    // A flat arrow pointing along the road is foreshortened to a bar from the chase camera; this never is.
    _ad.set(Math.sin(arrowYaw), 0, Math.cos(arrowYaw));
    _an.copy(camera.position).sub(arrow3d.position).normalize();
    _ad.addScaledVector(_an, -_ad.dot(_an));
    if (_ad.lengthSq() < 1e-6) _ad.set(0, 1, 0).addScaledVector(_an, -_an.y); // heading straight at the camera
    _ad.normalize();
    _ax.crossVectors(_an, _ad);
    _am.makeBasis(_ax, _an, _ad);
    arrow3d.quaternion.setFromRotationMatrix(_am).multiply(_arrowTilt); // small roll shows the extruded thickness
  }
  // progress along the route: a window around the cursor, the whole line when the lapa has been moved
  function updateGuide() {
    if (!route.pts) return;
    const pts = route.pts, c = route.cum, n = c.length - 1;
    const scan = (i0, i1) => {
      let bd = Infinity, bs = route.s0;
      for (let i = i0; i < i1; i++) {
        const ax = pts[i * 2], az = pts[i * 2 + 1], dx = pts[i * 2 + 2] - ax, dz = pts[i * 2 + 3] - az, l2 = dx * dx + dz * dz;
        const u = l2 ? clamp(((car.x - ax) * dx + (car.z - az) * dz) / l2, 0, 1) : 0, d = Math.hypot(car.x - ax - dx * u, car.z - az - dz * u);
        if (d < bd) { bd = d; bs = c[i] + u * Math.sqrt(l2); route.cursor = i; }
      }
      return [bd, bs];
    };
    let [bd, bs] = scan(Math.max(0, route.cursor - 6), Math.min(n, route.cursor + 40));
    if (bd > 60) [bd, bs] = scan(0, n);
    route.s0 = bs;
  }

  // ------------------------------------------------------------------------------------ minimap markers
  const addMarker = (x, z, color, size, shape) => { const m = { x, z, color, size, shape }; mapMarkers.push(m); return m; };
  const dropMarker = m => { if (!m) return; const i = mapMarkers.indexOf(m); if (i >= 0) mapMarkers.splice(i, 1); };

  // ------------------------------------------------------------------------------------ stigghiulari
  const vendors = [];
  const V = { sign: null };
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
    const g = cv.getContext('2d');
    g.fillStyle = '#eadfc2'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#b8322a'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
    g.fillStyle = '#b8322a'; g.font = '700 96px "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('STIGGHIOLA', 256, 84);
    g.fillStyle = '#2f6b49'; g.fillRect(40, 132, 432, 6);
    V.sign = new THREE.CanvasTexture(cv); V.sign.colorSpace = THREE.SRGBColorSpace; V.sign.anisotropy = 4;
  }
  function signTexture(text, col, line) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const g = cv.getContext('2d');
    g.fillStyle = '#eadfc2'; g.fillRect(0, 0, 512, 160); g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
    g.fillStyle = col; g.font = '700 84px "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 84);
    g.fillStyle = line; g.fillRect(40, 132, 432, 6);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const std = (c, r = 0.85, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const M = {
    steel: std('#2a2624', 0.6, { metalness: 0.4 }), rust: std('#7a3b2a', 0.9), wood: std('#8a6a44', 0.9), pale: std('#d8c8a0', 0.9),
    coal: new THREE.MeshBasicMaterial({ color: 0xff6a22 }), skewer: std('#6b4a2b', 0.9), green: std('#4f7a3a', 0.9), pole: std('#bdbab2', 0.5, { metalness: 0.5 }),
    sign: new THREE.MeshBasicMaterial({ map: V.sign, toneMapped: false }), signCorn: new THREE.MeshBasicMaterial({ map: signTexture('POLLANCHE', '#a8680e', '#2f6b49'), toneMapped: false }), umbrella: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
  };
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,200,110,1)'); gr.addColorStop(0.35, 'rgba(255,110,40,.55)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const umbrellaGeo = (() => {
    const g = new THREE.ConeGeometry(1.7, 0.55, 12, 1, true).toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#e9e0c8'), b = new THREE.Color('#2f6b49');
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const c = (Math.floor((Math.atan2(cz, cx) + Math.PI) / (TAU / 12)) % 2) ? a : b;
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  })();
  const box = (w, h, d, mat, x, y, z, parent, shadow = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m; };
  const cyl = (r, h, mat, x, y, z, parent, rz = 0, shadow = false) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = shadow; parent.add(m); return m; };

  function buildVendor(o) {
    const pl = place(o);
    const sn = pl.road, side = sideSpot(sn, sn.w / 2 + 1.3);
    return buildVendorAt(o, pl, side.x, side.z, Math.atan2(sn.dx, sn.dz) + (side.s < 0 ? Math.PI : 0));
  }
  // kind 'pollanche': the same cart with corn cobs instead of skewers (Monte Pellegrino, whole-city tiles; see the pollanche block below)
  function buildVendorAt(o, pl, px, pz, theta, kind) {
    const corn = kind === 'pollanche';
    const gy = groundAt(px, pz);
    const g = new THREE.Group(); g.position.set(px, gy, pz); g.rotation.y = theta; scene.add(g);
    // brazier on legs (front = +x, the road side)
    box(0.55, 0.28, 1.1, M.steel, 0, 0.9, 0, g, true);
    for (const [lx, lz] of [[-0.22, -0.48], [0.22, -0.48], [-0.22, 0.48], [0.22, 0.48]]) cyl(0.03, 0.78, M.steel, lx, 0.39, lz, g);
    const coal = box(0.46, 0.04, 1.0, M.coal, 0, 1.03, 0, g);
    const NSK = corn ? 9 : 16, sk = new THREE.InstancedMesh(corn ? new THREE.CylinderGeometry(0.045, 0.04, 0.42, 7) : new THREE.CylinderGeometry(0.014, 0.014, 0.52, 5), M.skewer, NSK), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), col = new THREE.Color();
    for (let i = 0; i < NSK; i++) {
      m4.compose(new THREE.Vector3(0.0, corn ? 1.1 : 1.08, -0.46 + i * (corn ? 0.115 : 0.061)), q, new THREE.Vector3(1, 1, 1)); sk.setMatrixAt(i, m4);
      sk.setColorAt(i, col.set(corn ? (i % 3 === 0 ? '#e2b92e' : i % 3 === 1 ? '#c98f22' : '#7a4a1e') : i % 3 === 0 ? '#4f7a3a' : i % 3 === 1 ? '#7a4a2a' : '#8a5a34'));
    }
    g.add(sk);
    // counter on the road side with the sign and a pile of skewers
    box(0.42, 0.05, 1.3, M.wood, 0.68, 0.86, 0, g, true);
    for (const lz of [-0.55, 0.55]) { cyl(0.03, 0.84, M.wood, 0.5, 0.42, lz, g); cyl(0.03, 0.84, M.wood, 0.86, 0.42, lz, g); }
    box(0.3, 0.07, 0.36, M.pale, 0.62, 0.92, -0.35, g); box(0.26, 0.05, 0.3, M.green, 0.66, 0.97, -0.3, g); box(0.2, 0.06, 0.4, M.skewer, 0.7, 0.93, 0.3, g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), corn ? M.signCorn : M.sign); sign.position.set(0.9, 0.62, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
    // umbrella
    cyl(0.025, 2.3, M.pole, -0.15, 1.15, 0.0, g);
    const um = new THREE.Mesh(umbrellaGeo, M.umbrella); um.position.set(0.05, 2.35, 0); um.castShadow = true; g.add(um);
    // glowing coals
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
    glow.scale.set(2.0, 1.2, 1); glow.position.set(0, 1.15, 0); g.add(glow);
    // vendor
    const vx0 = Math.sin(theta + Math.PI / 2), vz0 = Math.cos(theta + Math.PI / 2);   // world direction of local +x
    const cid = pedestrians.spawnScripted(o.skin || 'vendor', px - vx0 * 0.95, pz - vz0 * 0.95);
    if (cid >= 0) pedestrians.face(cid, px + vx0, pz + vz0);
    // collision: a small box around brazier and counter
    {
      const lx = [-0.4, 1.0], lz = [-0.7, 0.7], cs = Math.cos(theta), sS = Math.sin(theta);
      const W = (a, b) => [px + a * cs + b * sS, pz - a * sS + b * cs];
      const c = [W(lx[0], lz[0]), W(lx[1], lz[0]), W(lx[1], lz[1]), W(lx[0], lz[1])];
      for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
    }
    const v = { o, pl, kind, x: px, z: pz, gy, g, coal, glow, cid, cd: 0, ring: null, marker: null, shoutT: rand(2, 8), seed: Math.random() * 10 };
    v.ring = makeBeacon('#ff9d2e', 4.5, { beam: false }); v.ring.set(px + vx0 * 1.7, pz + vz0 * 1.7); v.ring.show(true);
    v.sx = px + vx0 * 1.7; v.sz = pz + vz0 * 1.7;
    v.marker = o.marker || addMarker(px, pz, '#ff7a1a', 4);
    return v;
  }
  for (const o of VENDORS) { try { vendors.push(buildVendor(o)); } catch (e) { console.warn('[missions] vendor', o.id, e); } }

  // smoke plumes: GPU-animated camera-facing quads, one instance per puff
  const PUFFS = 110, PLUME_H = 120;
  // pts: [{ x, y, z }], one smoke column each; returns { mesh, setY(i, y) } (the base height can follow terrain that streams in)
  function makePlume(pts) {
    const n = pts.length * PUFFS, geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    const base = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    pts.forEach((v, vi) => { for (let i = 0; i < PUFFS; i++) { const k = vi * PUFFS + i; base.set([v.x, v.y, v.z], k * 3); seed.set([(i + Math.random() * 0.9) / PUFFS, Math.random(), Math.random()], k * 3); } });
    const iBase = new THREE.InstancedBufferAttribute(base, 3); geo.setAttribute('iBase', iBase); geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 3)); geo.instanceCount = n;
    const u = { uTime: { value: 0 }, uH: { value: PLUME_H }, uWind: { value: new THREE.Vector2(0.3, 0.1) }, uFog: { value: new THREE.Color('#a9c4da') }, uFogD: { value: 0.00014 }, uLight: { value: 1 } };
    const plume = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `
        attribute vec3 iBase; attribute vec3 iSeed; uniform float uTime; uniform float uH; uniform vec2 uWind;
        varying vec2 vUv; varying float vA; varying float vT; varying float vDist;
        void main() {
          float age = fract(uTime / 30.0 + iSeed.x);
          vec3 p = iBase + vec3(0.0, age * uH, 0.0);
          p.xz += uWind * (age * age * uH) + vec2(sin(uTime * 0.4 + iSeed.y * 6.28), cos(uTime * 0.33 + iSeed.z * 6.28)) * (0.4 + age * 6.0);
          float size = mix(2.0, 40.0, pow(age, 0.5)) * (0.75 + 0.5 * iSeed.y);
          vec3 c = (viewMatrix * vec4(p, 1.0)).xyz;
          float ang = iSeed.z * 6.283 + uTime * (0.08 + iSeed.y * 0.1);
          vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * position.xy;
          gl_Position = projectionMatrix * vec4(c + vec3(q * size, 0.0), 1.0);
          vDist = length(c); vUv = uv; vT = age;
          vA = smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.1) * 0.9 * smoothstep(2.5, 15.0, vDist);
        }`,
      fragmentShader: `
        uniform vec3 uFog; uniform float uFogD; uniform float uLight; varying vec2 vUv; varying float vA; varying float vT; varying float vDist;
        void main() {
          float d = length(vUv * 2.0 - 1.0); if (d > 1.0) discard;
          float a = smoothstep(1.0, 0.0, d) * vA;
          vec3 col = mix(vec3(0.30, 0.28, 0.27), vec3(0.80, 0.80, 0.82), smoothstep(0.0, 0.55, vT));
          col *= uLight;   // smoke is lit by the sky: dark at night, when only the glow of the coals lights its base
          col += vec3(0.55, 0.24, 0.08) * (1.0 - uLight) * pow(1.0 - vT, 2.2);
          col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * vDist * vDist));
          gl_FragColor = vec4(col, a);
        }`,
    }));
    plume.frustumCulled = false; plume.renderOrder = 6;
    plume.onBeforeRender = () => {
      u.uTime.value = now() % 5000;
      if (scene.fog) { u.uFogD.value = scene.fog.density; if (scene.fog.color) { u.uFog.value.copy(scene.fog.color); u.uLight.value = Math.min(1, Math.max(0.1, (0.3 * scene.fog.color.r + 0.59 * scene.fog.color.g + 0.11 * scene.fog.color.b) / 0.65)); } }   // follows the day/night haze
    };
    scene.add(plume);
    return { mesh: plume, setY(vi, y) { for (let i = 0; i < PUFFS; i++) base[(vi * PUFFS + i) * 3 + 1] = y; iBase.needsUpdate = true; } };
  }
  const plumeStig = vendors.length ? makePlume(vendors.map(v => ({ x: v.x, y: v.gy + 1.1, z: v.z }))) : null;


  // ------------------------------------------------------------------------------------ pollanche (corn on the cob), Monte Pellegrino
  // Carts at the Santuario di Santa Rosalia, built like the stigghiulari: brazier, umbrella, a vendor sprite, a minimap marker, a smoke
  // plume you can see from the city, "POLLANCHEEEE" now and then, and a nitro top-up when you stop. They live in the whole-city tiles,
  // so they are built lazily: the plume and the marker at once, the cart and the vendor when the lapa comes within 420 m.
  const polls = [];
  let pollPlume = null;
  if (worldOn()) {
    for (const o of POLLANCHE.sites) {
      const [px0, pz0] = env.proj(o.lat, o.lon);
      polls.push({ o, x: px0, z: pz0, gy: groundAt(px0, pz0), built: false, v: null, marker: addMarker(px0, pz0, '#ff7a1a', 5, 'triangle') });
    }
    pollPlume = makePlume(polls.map(p => ({ x: p.x, y: p.gy + 1.1, z: p.z })));
  }
  let pollT = 0;
  function updatePoll(dt) {
    if (!polls.length) return;
    pollT -= dt; if (pollT > 0) return;
    pollT = 1.5;
    polls.forEach((p, i) => {
      const gy = groundAt(p.x, p.z);
      if (Math.abs(gy - p.gy) > 0.25) { p.gy = gy; pollPlume.setY(i, gy + 1.1); if (p.v) p.v.g.position.y = gy; }   // terrain refines as tiles stream in
      if (!p.built && Math.hypot(car.x - p.x, car.z - p.z) < 420) {
        p.built = true;
        try { const v = buildVendorAt({ ...p.o, marker: p.marker }, null, p.x, p.z, Math.atan2(p.o.rx, p.o.rz) - Math.PI / 2, 'pollanche'); vendors.push(v); p.v = v; }
        catch (e) { console.warn('[missions] pollanche', p.o.id, e); }
      }
    });
  }


  // ------------------------------------------------------------------------------------ spots for characters
  const segCross = (ax, az, bx, bz, w) => {
    const d1x = bx - ax, d1z = bz - az, d2x = w[2] - w[0], d2z = w[3] - w[1], den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return false;
    const t = ((w[0] - ax) * d2z - (w[1] - az) * d2x) / den, u = ((w[0] - ax) * d1z - (w[1] - az) * d1x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  function pathClear(ax, az, bx, bz) {
    let ok = true;
    walls2d.query(Math.min(ax, bx) - 0.5, Math.min(az, bz) - 0.5, Math.max(ax, bx) + 0.5, Math.max(az, bz) + 0.5, w => { if (ok && segCross(ax, az, bx, bz, w)) ok = false; });
    return ok;
  }
  // a free spot for a character, minD..maxD from the lapa, with a clear straight path to it; pavement preferred, ahead of the lapa if asked.
  // Position-based on purpose: the baked road list only covers the centro, the streamed tiles do not appear in it.
  function findSpot(minD, maxD, ahead) {
    let best = null, bs = -Infinity;
    for (let k = 0; k < 48; k++) {
      let x, z;
      if (ahead) { const d = rand(minD, maxD), lat = (Math.random() < 0.5 ? 1 : -1) * rand(3.5, 6.5); x = car.x + Math.sin(car.th) * d + Math.cos(car.th) * lat; z = car.z + Math.cos(car.th) * d - Math.sin(car.th) * lat; }   // beside the road ahead
      else { const a = rand(0, TAU), d = rand(minD, maxD); x = car.x + Math.sin(a) * d; z = car.z + Math.cos(a) * d; }
      const wd = wallDist(x, z); if (wd < 0.9 || !pathClear(car.x, car.z, x, z)) continue;
      const sc = (raisedMask(x, z) ? 3 : 0) + Math.min(wd, 2.5) + rand(0, 0.6);
      if (sc > bs) { bs = sc; best = { x, z }; }
    }
    return best;
  }

  // ------------------------------------------------------------------------------------ events
  const prog = { fares: 0, food: {}, races: {}, pubs: {}, done: {}, earned: 0 };   // done: id -> { n, best } for every event that was paid (the Missioni screen); food, races and pubs keep their own maps too
  try { const p = JSON.parse(localStorage.getItem(PROG_KEY) || 'null'); if (p && typeof p === 'object') { if (Number.isFinite(p.fares)) prog.fares = p.fares; if (p.food && typeof p.food === 'object') prog.food = p.food; if (p.races && typeof p.races === 'object') prog.races = p.races; if (p.pubs && typeof p.pubs === 'object') prog.pubs = p.pubs; if (p.done && typeof p.done === 'object') prog.done = p.done; } } catch (e) { /* storage unavailable */ }
  const saveProg = () => { try { localStorage.setItem(PROG_KEY, JSON.stringify({ fares: prog.fares, food: prog.food, races: prog.races, pubs: prog.pubs, done: prog.done })); } catch (e) { /* ignore */ } };
  let session = 0;
  const S = { ev: null, phase: 'off', t: 0 };
  const speed = () => Math.hypot(car.vx, car.vz);
  const dline = (key, delay = 1.4) => say(pick(DRIVER[key]), driverPos, delay);
  const charHead = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; };
  const SEAT_X = [-0.26, 0.26], SEAT_Z = -1.1, SEAT_Y = 1.04;
  const seatFn = i => out => {
    // Seats come from the vehicle being driven (src/vehicle.js: lape have two on the bench, bikes have one pillion seat); the constants are the fallback.
    const vs = vehicle && vehicle.seats, sv = vs && vs.length ? vs[i % vs.length] : null;
    const sn = Math.sin(car.th), cs = Math.cos(car.th), lx = sv ? sv.x : SEAT_X[i % 2], sz = sv ? sv.z : SEAT_Z, sy = sv ? sv.y : SEAT_Y;
    out.x = car.x + sn * sz + cs * lx; out.z = car.z + cs * sz - sn * lx;
    out.y = groundY(car.x, car.z) + car.lift + sy + Math.sin(now() * 17 + i) * 0.012 * clamp(speed() / 10, 0, 1); out.th = car.th;
  };
  const destBeacon = makeBeacon('#ffb3d9', 8.5); destBeacon.beam.scale.set(0.35, 1, 0.35);   // thin: a wide column fills half the screen when the lapa stops in the ring
  const destInfo = id => {
    const d = DESTS.find(x => x.id === id) || TAXI_DESTS.find(x => x.id === id) || (id === PULLE_DEST.id ? PULLE_DEST : null) || (FARE_SPOTS.find(f => f.dest && f.dest.id === id) || {}).dest;
    const s = SNAP['dest:' + id], [vx, vz] = env.proj(d.lat, d.lon);
    return { ...d, id, x: s[0], z: s[1], dx: s[2], dz: s[3], vx, vz };
  };
  const URGENT_DEF = Object.fromEntries(URGENT.map(u => ['urgent:' + u.id, u]));
  const slots = [];
  const mkSlot = (o, key) => { const s = SNAP[key]; if (!s) { console.warn('[missions] no road point for', key, '(run assets/missions/snap-places.mjs)'); return; } slots.push({ ...o, key, x: s[0], z: s[1], dx: s[2], dz: s[3], w: s[4], road: s[5], callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null }); };
  FOOD_PLACES.forEach((p, i) => mkSlot({ id: 'food:' + p.id, kind: 'food', sub: 'food', num: i, item: p.item, who: p.who, g: p.g, name: p.name, food: p, pid: p.id }, 'food:' + p.id));
  FARE_SPOTS.forEach(f => mkSlot({ id: 'fare:' + f.id, kind: 'fare', sub: f.kind, name: f.name, ...(f.nc ? { nc: f.nc, night: !f.day } : {}) }, 'fare:' + f.id));   // nc: a night client (assets/missions/lines.js NIGHT_CLIENTS)
  URGENT.forEach(u => mkSlot({ id: 'urgent:' + u.id, kind: 'urgent', sub: 'urgent', name: u.name }, 'urgent:' + u.id));
  // the rave missions (night): the sound man at the centro sociale ExKarcere, and the friend at the rave (docs/rave.md). Each brings its own leash area.
  mkSlot({ id: 'rave:karcere', kind: 'rave', sub: 'rave', name: RAVE.karcere.name, night: true, leash: () => { const a = SNAP['rave:karcere'], b = SNAP['rave:site']; return { a: [a[0], a[1]], b: [b[0], b[1]], r: 650 }; } }, 'rave:karcere');
  mkSlot({ id: 'leaf:rave', kind: 'leaf', sub: 'leaf', name: 'Fuogghi allegri', night: true, leash: () => { const a = SNAP['rave:site'], b = SNAP['rave:leaf']; return { a: [a[0], a[1]], b: [b[0], b[1]], r: 700 }; } }, 'rave:site');
  // the horns mission (day or night): the citizen in Piazza Pretoria, the arch of Cutò (docs/horns.md)
  mkSlot({ id: 'horns:cuto', kind: 'horns', sub: 'horns', name: 'U Sinnacu a primavera', leash: () => { const a = SNAP['horns:start'], b = SNAP['horns:arch']; return { a: [a[0], a[1]], b: [b[0], b[1]], r: 330 }; } }, 'horns:start');
  for (const r of RACES) if (TRACKS[r.id]) mkSlot({ id: 'race:' + r.id, kind: 'race', sub: 'race', def: r, name: r.name, night: !!r.night }, 'race:' + r.id);
  // the shell asks for the pins in the language it shows
  const secrets = createAchievements({ game, car, groundY });   // secret achievements (src/achievements.js), listed in Collezioni through progress().secrets
  let pubs = null;   // the pubs and their night errands (src/pubs.js), made below once X exists
  const events = () => [...slots.map(s => ({ id: s.id, kind: s.kind, name: s.kind === 'race' ? T(s.def.name, s.def.en) : s.name, x: s.x, z: s.z, ...(s.night ? { night: true } : {}) })),
    ...(pubs ? pubs.slots.filter(s => s.hours).map(s => ({ id: s.id, kind: 'pub', name: s.name, x: s.x, z: s.z, night: true })) : [])];
  // the Missioni screen (src/ui.js): done / tried / best pay of one event by id, and ready(id) so the caller is there at once (an event just left or finished waits out a cooldown)
  const status = id => {
    const k = id.slice(0, id.indexOf(':')), r = k === 'race' ? prog.races[id.slice(5)] : 0, d = prog.done[id];
    return { done: r === 1 || !!d || (k === 'food' && !!prog.food[id.slice(5)]) || (k === 'pub' && !!prog.pubs[id]), tried: r === 2, best: d && d.best > 0 ? d.best : 0 };
  };
  const arrive = () => { calls.disarm(); pubs?.disarm(); };
  const stand = id => {   // -> [x, z, th]: where the lapa stands, in the road at the caller's spot
    const s = slots.find(x => x.id === id) || (pubs && pubs.slots.find(x => x.id === id)); if (!s) return null;
    s.coolUntil = 0; arrive(); X.held = s;   // held: this one waits for the answer, and does not take a "no" back until the lapa has left (update below)
    for (const o of [...slots, ...(pubs ? pubs.slots : [])]) if (o !== s && o.kind !== 'race' && Math.hypot(o.x - s.x, o.z - s.z) < 30) o.coolUntil = Math.max(o.coolUntil, now() + 60);   // another caller on the same spot does not take the lapa first
    return [s.x, s.z, Math.atan2(s.dx, s.dz)];   // the middle of the road: at the lane offset of the ?event link a wall was 0.7 m away on a narrow street
  };
  const ready = id => { const at = stand(id); X.held = null; calls.arm(); pubs?.arm(); return at; };
  const progress = () => ({ secrets: secrets.list(), pubs: { done: pubs ? pubs.slots.filter(s => s.hours && prog.pubs[s.id]).length : 0, total: pubs ? pubs.slots.filter(s => s.hours).length : 0 }, food: { done: FOOD_PLACES.filter(p => prog.food[p.id]).length, total: FOOD_PLACES.length }, races: { won: RACES.filter(r => prog.races[r.id] === 1).length, total: RACES.length }, fares: prog.fares });

  const X = {
    scene, camera, car, vehicle, pedestrians, traffic, params, world: env.world, groundAt, T, lang, now, isNight, hud, eur, speed, say, driverPos, seatPos, seatFn, toast,
    makeBeacon, addMarker, dropMarker, guide, destBeacon, destMarker: null, vendors, charHead, ITEMS, ROUTES, HUNT, TRACKS, URGENT_DEF, destInfo, transition, phone: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches),
    URGENT_TIGHT: Object.fromEntries(URGENT.map(u => ['urgent:' + u.id, u.tight])), FAVORITA_FLAG: FAVORITA.client.flag,
    sideSpot,
    aim: (x, z, on) => { aim.x = x; aim.z = z; aim.on = on; },
    setPhase: p => { S.phase = p; },
    earned: () => session,
    addFare(total, what) { session += total; if (what !== 'food') { prog.fares++; saveProg(); } dispatchEvent(new CustomEvent('pd-fare', { detail: { amount: total } })); },   // the Garage wallet listens (src/garage.js)
    addRaceResult(id, won) { if (won) prog.races[id] = 1; else if (!prog.races[id]) prog.races[id] = 2; saveProg(); },
    endEvent: (ok, aborted) => endEvent(ok, aborted),
  };
  const calls = X.calls = createCalls(X);
  calls.setSlots(slots);
  const rave = createRave({ scene, camera, car, game, pedestrians, groundY: groundAt, isNight, walls2d });   // the rave in the woods of the Favorita: dance floor, stage, lights, crowd and music at night
  const fares = createFares(X), food = createFood(X), races = createRaces(X), raves = createRaveEvents(X, rave), horns = createHornsEvents(X, { game });
  pubs = createPubs(X, { game });
  races.buildSlots(slots.filter(s => s.kind === 'race'));
  for (const s of slots) if (s.kind === 'race') s.coolUntil = 0;

  function startEvent(slot) {
    if (S.ev) return;
    calls.release(slot);
    S.ev = { slot, s0: session };
    dispatchEvent(new CustomEvent('pd-event-busy', { detail: true }));   // src/vehicle-events.js: the ZEN gag waits
    talkQ.length = 0;
    if (slot.kind === 'fare' || slot.kind === 'urgent') fares.start(slot);
    else if (slot.kind === 'food') food.start(slot);
    else if (slot.kind === 'pub') pubs.start(slot);
    else if (slot.kind === 'rave' || slot.kind === 'leaf') raves.start(slot);
    else if (slot.kind === 'horns') horns.start(slot);
    else races.start(slot);
  }
  function endEvent(ok, aborted) {
    const ev = S.ev; if (!ev) return;
    fares.stop(); food.stop(); pubs.stop(); raves.stop(); horns.stop();
    if (aborted && ev.slot.kind === 'race') races.stop();
    if (ev.slot.kind === 'food' && ok) { prog.food[ev.slot.pid] = 1; saveProg(); }
    if (ev.slot.kind === 'pub' && ok) { prog.pubs[ev.slot.id] = 1; saveProg(); }
    if (ok && ev.slot.kind !== 'race') { const d = prog.done[ev.slot.id] || (prog.done[ev.slot.id] = { n: 0, best: 0 }); d.n++; d.best = Math.max(d.best, Math.round((session - ev.s0) * 100) / 100); saveProg(); }   // a race is told by prog.races (won or tried)
    ev.slot.coolUntil = now() + (ok ? (ev.slot.kind === 'race' ? 12 : 150) : 40);
    dispatchEvent(new CustomEvent('pd-event-busy', { detail: false }));
    calls.disarm(); S.ev = null; S.phase = 'off'; aim.on = false; guide.off(); hud.clear(); hud.leash(false); leash.out = false; leash.t = LEASH_T; destBeacon.show(false);
  }
  // Driving into the sea (src/sea.js) ends the current ride like running out of time: no fare.
  addEventListener('pd-drowned', () => fares.drowned());

  // ------------------------------------------------------------------------------------ stigghiola
  function eatStigghiola(v) {
    v.cd = 50;
    car.nos = Math.min(car.nosMax, car.nos + 0.8); car.nosLock = false;   // 0.8 on top of what you have, past a full bar (an overcharge); a pollanche is 0.5 up to full
    toast('STIGGHIOLA!', T('Nitro in più, anche oltre il pieno', 'Extra nitro, even past full')); burst();
    say(pick(VENDOR_SERVE), () => ({ x: v.x, y: v.gy + 0.2, z: v.z }), 0);
    dline('stig', 2.0);
    fares.stigghiola();
  }
  function eatPollanche(v) {   // a small bonus: half a tank of nitro
    v.cd = 45;
    car.nos = Math.min(1, car.nos + 0.5); car.nosLock = false;
    toast('POLLANCHE!', T('Un po\' di nitro', 'A bit of nitro'));
    say(pick(POLLANCHE.serve), () => ({ x: v.x, y: v.gy + 0.2, z: v.z }), 0);
  }
  function updateVendors(dt) {
    const sp = speed();
    for (const v of vendors) {
      v.cd = Math.max(0, v.cd - dt);
      v.seed += dt;
      const d = Math.hypot(v.sx - car.x, v.sz - car.z);
      // coals breathe
      v.glow.material.opacity = 0.75 + 0.2 * Math.sin(v.seed * 7) * Math.sin(v.seed * 2.3);
      v.ring.u.uAlpha.value = v.cd > 0 ? 0.25 : 1;
      v.marker.color = v.cd > 0 ? '#8a6a44' : v.kind === 'pollanche' ? '#e8b92e' : '#ff7a1a';
      if (v.cd <= 0 && d < 4.5 && sp < 2.2) (v.kind === 'pollanche' ? eatPollanche : eatStigghiola)(v);
      // street cries when the lapa is close
      v.shoutT -= dt;
      if (v.shoutT <= 0 && d < (v.kind === 'pollanche' ? 80 : 38)) { v.shoutT = rand(7, 13); say(pick(v.kind === 'pollanche' ? POLLANCHE.cry : VENDOR), () => ({ x: v.x, y: v.gy + 0.3, z: v.z }), 0); }
    }
    coalPulse();
  }
  let coalT = 0;
  function coalPulse() { coalT = now(); M.coal.color.setRGB(1, 0.32 + 0.16 * Math.sin(coalT * 6.3) * Math.sin(coalT * 2.1), 0.1); }

  // ------------------------------------------------------------------------------------ the leash (every event)
  // Each event has an area (a ride: the corridor from the pick-up to the destination; the food and pub hunts: the place; a race: its track; the rave missions say their own, slot.leash()).
  // Leave it by more than the radius and the HUD tells you to come back, with a countdown; the countdown runs out and the mission is over (a failure: no pay, the usual result card).
  const LEASH_T = 20, LEASH_BACK = 45;   // seconds to come back; metres of margin to be counted as back inside
  const leash = { t: LEASH_T, out: false };
  const segDist = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l2, 0, 1) : 0; return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); };
  function leashArea(s) {
    if (s.leash) return s.leash();
    if (s.kind === 'fare' || s.kind === 'urgent') {   // the corridor from the pick-up to the destination, wide enough for the baked road, which can bend far from the straight line
      const f = fares.state, d = f && f.dest, A = [s.x, s.z], B = d ? [d.x, d.z] : A;
      if (f && f.pts && !f.leashR) { let m = 0; for (let i = 0; i + 1 < f.pts.length; i += 2) m = Math.max(m, segDist(f.pts[i], f.pts[i + 1], A, B)); f.leashR = Math.max(520, m + 300); }
      return { a: A, b: B, r: f && f.leashR || 520 };
    }
    if (s.kind === 'race') { const T0 = TRACKS[s.def.id], p = T0 && T0.pts; if (p && p.length > 1) { let cx = 0, cz = 0; for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; } cx /= p.length / 2; cz /= p.length / 2; let r = 0; for (let i = 0; i < p.length; i += 2) r = Math.max(r, Math.hypot(p[i] - cx, p[i + 1] - cz)); return { a: [cx, cz], b: [cx, cz], r: r + 320 }; } }
    return { a: [s.x, s.z], b: [s.x, s.z], r: s.kind === 'pub' ? 480 : 520 };
  }
  function failEvent() {   // too far for too long: the card, a short pause, then the event is over like any failed one
    const ev = S.ev; if (!ev || ev.failT > 0) return;
    ev.failT = 3.6; leash.t = LEASH_T; leash.out = false; hud.leash(false); aim.on = false; S.phase = 'done';
    hud.result(`<h3>${T('Finiu a missioni', 'Mission over')}</h3><div class="row"><span>${T("Ma runni stai iennu? Cos'inutili!", 'Where are you going? You useless thing!')}</span></div>`, 3.2);
    say(pick(LEASH_LINES), driverPos, 0.2); raves.leashed(); horns.leashed();   // a friend riding along (src/event-rave.js) gets out
  }
  const LEASH_LINES = [['Unni stai iennu?! Era ri dda banna!', 'Where are you going?! It was somewhere else!'], ['Vabbè, lassamu piaiddiri. Un mi puazzu firari i nuddu.', 'Fine, I give up. You cannot count on anyone.']];
  function updateLeash(dt) {
    const ev = S.ev; if (!ev || S.phase === 'done' || ev.failT > 0) { if (leash.out) { leash.out = false; leash.t = LEASH_T; hud.leash(false); } return; }
    const A = leashArea(ev.slot), d = segDist(car.x, car.z, A.a, A.b);
    if (!leash.out && d > A.r) { leash.out = true; leash.t = LEASH_T; }
    else if (leash.out && d < A.r - LEASH_BACK) { leash.out = false; leash.t = LEASH_T; hud.leash(false); }
    if (!leash.out) return;
    leash.t -= dt;
    hud.leash(true, T("Cosa 'nutile unni stai ieannu? ", 'Where are you going, you useless thing? ') + Math.max(0, Math.ceil(leash.t)), T('Tuinna cca ai a finiri a missiuani!!!', 'Come back, you have to finish the mission!!!') + ' · ' + Math.round(Math.max(0, d - A.r + LEASH_BACK) / 10) * 10 + ' m');
    if (leash.t <= 0) failEvent();
  }

  // ------------------------------------------------------------------------------------ test links: ?event=kind:id
  const wantEv = params.get('event');
  let evSlot = null, evPlaced = false;
  async function placeAtEvent(slot) {
    const th = Math.atan2(slot.dx, slot.dz);
    await new Promise(res => { const t = setTimeout(res, 15000); if (env.world) env.world.teleport(slot.x, slot.z, () => { clearTimeout(t); res(); }); else res(); });
    vehicle.teleport(slot.x - slot.dz * slot.w * 0.18, slot.z + slot.dx * slot.w * 0.18, th);
  }

  // ------------------------------------------------------------------------------------ main update
  function update(dt) {
    dt = clamp(dt, 0, 0.1);
    S.t += dt; hudUsed = false; aim.on = false;
    if (X.held && Math.hypot(car.x - X.held.x, car.z - X.held.z) > 40) X.held = null;
    if (wantEv && !evPlaced && S.t > 1.2) { evPlaced = true; evSlot = slots.find(s => s.id === wantEv) || pubs.slots.find(s => s.id === wantEv) || null; if (evSlot) placeAtEvent(evSlot).then(() => { evSlot.testReady = S.t + 2.5; }); else console.warn('[missions] ?event=', wantEv, 'is not an event; ids:', slots.map(s => s.id).join(' ')); }
    updateVendors(dt); updatePoll(dt); secrets.update(dt); rave.update(dt);
    night.update(dt, !S.ev);
    const idle = !S.ev;
    const accepted = calls.update(dt, idle), raceGo = races.update(dt, idle), pubGo = pubs.update(dt, idle);
    if (idle) {
      if (evSlot && evSlot.testReady && S.t > evSlot.testReady && params.has('auto') && (evSlot.kind === 'race' || evSlot.kind === 'pub' || evSlot.callers.length)) { const s = evSlot; evSlot = null; startEvent(s); }
      else if (accepted) startEvent(accepted);
      else if (raceGo) startEvent(raceGo);
      else if (pubGo) startEvent(pubGo);
    } else if (S.ev.failT > 0) { if ((S.ev.failT -= dt) <= 0) endEvent(false, S.ev.slot.kind === 'race'); }
    else { fares.update(dt); food.update(dt); pubs.updateEvent(dt); raves.update(dt); horns.update(dt); updateLeash(dt); }
    updateTalk(dt);
    hud.update(dt);
    if (!hudUsed) hud.hide();
    updateGuide();
    updateArrow3d(dt, aim.on && S.phase !== 'board' && S.phase !== 'finish' && S.phase !== 'done', aim.x, aim.z);
  }

  function setMode() { /* no modes any more: kept so older callers keep working */ }
  // stop(): end whatever runs (the shell calls it when leaving the game or changing the start point)
  function stop() {
    if (S.ev) endEvent(false, true);
    else { races.stop(); }
    calls.clear(); guide.off(); aim.on = false; hud.clear(); talkQ.length = 0;
  }

  const night = createNightLife({ env, say, groundAt, findSpot, isNight, worldOn, driverPos });
  const api = { mode: 'free', setMode, update, stop, events, progress, busy: () => !!S.ev, state: S, pubs, rave, status, ready, stand, arrive };   // pubs and rave: src/drunk.js reads their doors and the stage
  if (params.has('debug')) window.__missions = { S, slots, prog, polls, api, night, calls, fares, food, races, pubs, secrets, X, rave, raves, horns };
  return api;
}
