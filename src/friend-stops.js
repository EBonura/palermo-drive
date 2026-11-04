// Stops of three ideas of a Palermo friend of the owner (Nov 2026), built like the stigghiulari and the granita kiosk of src/missions.js (the shared helpers come in through `h`):
//   "Pezzo nni Ganci"            a small shopfront with a sign at each confirmed branch of the Ganci rosticceria: stop and you get a pezzo, a nitro treat as the stigghiola's (cooldown 50 s)
//   "A preghiera alla santuzza"  a wayside shrine at the foot of the stair of the Santuario di Santa Rosalia, and the Festino carro drawn as a landmark with its own prayer stop. Stay still in the ring
//                                for PRAY_S seconds: the wanted level and the neighbourhood's trouble are wiped ('pd-blessed', src/police.js), then a shared cooldown of COOL_S seconds
//   "Cornetto i menzannuatti"    two cornetto kiosks (the kiosk of U Barettu in src/missions.js, buildKiosk), shuttered by day, open from CORNETTO_HOURS[0] to [1]: seller, a small queue of night people,
//                                a glow, a pin on the minimap and a nitro treat while open
// Where each one stands and where that comes from: src/friend-places.js and docs/friend-places.md. The lines (all drafts): assets/missions/lines.js GANCI, PREGHIERA, CORNETTO.
// Each kind of stop registers KIND[kind] = { build(s), update(s, dt) } below. A stop is built when the lapa comes within BUILD_R of it (they are all in the whole-city tiles); the pins are there from the
// start. createFriendStops(h) -> { update(dt), stops, debug }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GANCI } from '../assets/missions/lines.js';
import { GANCI_SITES } from './friend-places.js';
import { PREGHIERA } from '../assets/missions/lines.js';
import { SANTUZZA, COOL_S, PRAY_S, CARRO } from './friend-places.js';
import { trouble } from './danger.js';
import { CORNETTO } from '../assets/missions/lines.js';
import { CORNETTO_HOURS, CORNETTI } from './friend-places.js';

const BUILD_R = 420;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

export function createFriendStops(h) {
  const { env, scene, car, game, pedestrians, walls2d, groundAt, hud, toast, burst, T, say, busy, speed, driverPos, makeBeacon, addMarker, dropMarker, buildKiosk, nitroTreat, std, glowTex } = h;
  const stops = [], KIND = {};
  const nightK = () => (game.time && Number.isFinite(game.time.night) ? game.time.night : 0);
  const headAt = s => () => ({ x: s.x, y: s.gy + 0.4, z: s.z });
  const ownMat = (c, r = 0.85, extra) => std(c, r, extra);

  // ---------------------------------------------------------------------------------------------------- small drawing kit: boxes, cylinders and spheres merged per material
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function Bin() {
    const by = new Map();
    const add = (mat, geo, x, y, z, o = {}) => {
      const g = geo.clone(); _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)); g.applyMatrix4(_m);
      let l = by.get(mat); if (!l) by.set(mat, l = []); l.push(g);
    };
    return {
      box: (mat, w, hh, d, x, y, z, o) => add(mat, new THREE.BoxGeometry(w, hh, d), x, y, z, o),   // y: the centre
      cyl: (mat, rt, rb, hh, x, y, z, o, seg = 10) => add(mat, new THREE.CylinderGeometry(rt, rb, hh, seg), x, y, z, o),
      sph: (mat, r, x, y, z, o, seg = 8) => add(mat, new THREE.SphereGeometry(r, seg, Math.max(5, seg - 2)), x, y, z, o),
      build(parent, shadow = true) {
        for (const [mat, l] of by) { const m = new THREE.Mesh(mergeGeometries(l, false), mat); m.castShadow = shadow && !mat.transparent; m.receiveShadow = true; parent.add(m); for (const g of l) g.dispose(); }
        by.clear();
      },
    };
  }
  const plane = (w, hh, mat, x, y, z, ry, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const canvasTex = (w, hh, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; draw(cv.getContext('2d'), w, hh); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const M = {
    cream: ownMat('#efe2c4'), ivory: ownMat('#f1e8d2', 0.8), marble: ownMat('#f4f0e6', 0.6), red: ownMat('#9e2a26', 0.8), wood: ownMat('#6e4a2a', 0.9), dark: ownMat('#2a2420', 0.95), stone: ownMat('#c3b8a0', 0.95),
    gold: ownMat('#d4a73c', 0.45, { metalness: 0.5 }), rose: ownMat('#e0668f', 0.8), rose2: ownMat('#f3b6c9', 0.8), leaf: ownMat('#4f7a3a', 0.9), fry: ownMat('#d9a54a', 0.7), candle: ownMat('#f6efe0', 0.8),
    glass: new THREE.MeshStandardMaterial({ color: '#dbeef2', roughness: 0.1, transparent: true, opacity: 0.4 }), lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), iron: ownMat('#26282b', 0.7, { metalness: 0.4 }),
    rosePink: ownMat('#c9507a', 0.8), pot: ownMat('#a8603a', 0.9),
  };
  const glowMat = (c0, op) => new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false, color: c0 });
  const glows = [];   // [{ s: sprite, day, night }]: warm glows that grow with the dark
  function addGlow(parent, x, y, z, sx, sy, day, nightOp, col = 0xffffff) { const s = new THREE.Sprite(glowMat(col, nightOp)); s.scale.set(sx, sy, 1); s.position.set(x, y, z); parent.add(s); const gl = { s, day, night: nightOp }; glows.push(gl); return gl; }
  const wallBox = (px, pz, wl, lx, lz) => { const c = [wl(lx[0], lz[0]), wl(lx[1], lz[0]), wl(lx[1], lz[1]), wl(lx[0], lz[1])]; for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); } };

  // ---------------------------------------------------------------------------------------------------- a stop: where, the group, the ring, the pin
  function frame(o, kind, extra) {
    const [x, z] = env.proj(o.lat, o.lon);
    const th = Math.atan2(o.rx, o.rz) - Math.PI / 2, vx0 = Math.sin(th + Math.PI / 2), vz0 = Math.cos(th + Math.PI / 2), cs = Math.cos(th), sS = Math.sin(th);
    return { o, kind, x, z, th, vx0, vz0, wl: (a, b) => [x + a * cs + b * sS, z - a * sS + b * cs], gy: groundAt(x, z), built: false, g: null, cd: 0, ring: null, marker: null, shoutT: rand(2, 8), ...extra };
  }
  const place = s => { const g = new THREE.Group(); g.position.set(s.x, s.gy, s.z); g.rotation.y = s.th; scene.add(g); s.g = g; return g; };
  function stopRing(s, front, col, R = 4.5) { s.sx = s.x + s.vx0 * front; s.sz = s.z + s.vz0 * front; s.ring = makeBeacon(col, R, { beam: false }); s.ring.set(s.sx, s.sz); s.ring.show(true); }
  const dist = s => Math.hypot(s.sx - car.x, s.sz - car.z);
  // the nitro treat of a vendor-like stop: stop within 4.5 m of the ring at under 2.2 m/s, then 50 s before the next one; its cries are heard from `hear` m (the same rules as the stigghiola)
  function vendorUpdate(s, dt, d_) {
    s.cd = Math.max(0, s.cd - dt); const d = dist(s);
    s.ring.u.uAlpha.value = s.cd > 0 ? 0.25 : 1; if (s.marker) s.marker.color = s.cd > 0 ? '#8a6a44' : d_.pin;
    if (s.cd <= 0 && d < 4.5 && speed() < 2.2) { nitroTreat(s, d_.title, T(d_.L.toast[0], d_.L.toast[1]), d_.L.serve); say(pick(d_.L.driver), driverPos, 2.0); }
    s.shoutT -= dt; if (s.shoutT <= 0 && d < d_.hear) { s.shoutT = rand(7, 13); say(pick(d_.L.cry), headAt(s), 0); }
  }

  // ---------------------------------------------------------------------------------------------------- Ganci: a shopfront on the kerb with a sign
  const signTex = (a, b) => canvasTex(512, 160, (g, w, hh) => {
    g.fillStyle = '#f3ead2'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#8c1f22'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, hh - 16);
    g.fillStyle = '#8c1f22'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 104; g.font = `700 ${fs}px "Arial Narrow", Impact, sans-serif`; while (g.measureText(a).width > w - 60 && fs > 40) { fs -= 4; g.font = `700 ${fs}px "Arial Narrow", Impact, sans-serif`; }
    g.fillText(a, w / 2, b ? 66 : 82); if (b) { g.fillStyle = '#2f6b49'; g.font = '700 34px "Arial Narrow", Impact, sans-serif'; g.fillText(b, w / 2, 124); }
  });
  function buildGanci(s) {
    const o = s.o, g = place(s), B = Bin(), sign = new THREE.MeshBasicMaterial({ map: signTex(o.sign, o.sub), toneMapped: false, side: THREE.DoubleSide });
    B.box(M.cream, 0.14, 3.0, 3.6, -1.1, 1.5, 0); B.box(M.red, 0.16, 0.9, 3.6, -1.09, 0.45, 0);                    // the shop front behind the counter, with a dark red plinth
    B.box(M.wood, 0.9, 1.0, 3.2, 0.25, 0.5, 0); B.box(M.marble, 1.0, 0.06, 3.3, 0.28, 1.03, 0);                       // counter
    B.box(M.glass, 0.7, 0.42, 2.9, 0.1, 1.3, 0);                                                                       // the glass case on it, and the pezzi in it
    for (let i = 0; i < 9; i++) B.box(i % 3 ? M.fry : M.rose2, 0.28, 0.12, 0.26, 0.1, 1.15, -1.25 + i * 0.31, { ry: 0.3 * (i % 2 ? 1 : -1) });
    B.box(M.cream, 2.9, 0.1, 3.6, 0.4, 2.62, 0);                                                                       // flat awning over the counter, red and cream valance in front
    for (let i = 0; i < 9; i++) B.box(i % 2 ? M.cream : M.red, 0.06, 0.34, 0.4, 1.84, 2.42, -1.6 + i * 0.4);
    B.box(M.lamp, 0.08, 0.05, 3.2, 1.7, 2.3, 0);                                                                       // a strip lamp under the awning (a basic material: it glows)
    B.cyl(M.iron, 0.04, 0.04, 3.6, 1.9, 1.8, 1.85, {});                                                                // the pole of the blade sign
    B.build(g);
    plane(3.0, 0.66, sign, 1.88, 2.9, 0, Math.PI / 2, g);                                                              // the sign over the awning, facing the road
    plane(0.95, 0.95, sign, 1.9, 3.35, 1.86, 0, g); plane(0.95, 0.95, sign, 1.9, 3.35, 1.84, Math.PI, g);          // a blade sign on the corner, seen from along the street (one board each way, so the letters never read backwards)
    addGlow(g, 1.2, 1.5, 0, 4.2, 2.4, 0.18, 0.9, 0xffd9a0);
    const [vsx, vsz] = s.wl(-0.55, 0); s.cid = pedestrians.spawnScripted('vendor', vsx, vsz);
    if (s.cid >= 0) { pedestrians.attachTo(s.cid, out => { out.x = vsx; out.y = s.gy; out.z = vsz; out.th = Math.atan2(s.vx0, s.vz0); }); }
    wallBox(s.x, s.z, s.wl, [-1.2, 1.2], [-1.9, 1.9]);
    stopRing(s, 4.2, '#ff7a3a');
  }
  KIND.ganci = { build: buildGanci, update: (s, dt) => vendorUpdate(s, dt, { pin: '#ff5a36', title: 'PEZZO NNI GANCI!', L: GANCI, hear: 40 }) };
  for (const o of GANCI_SITES) stops.push(frame(o, 'ganci', { marker: addMarker(...env.proj(o.lat, o.lon), '#ff5a36', 5, 'triangle'), label: 'ganci:' + o.id }));

  // ---------------------------------------------------------------------------------------------------- a statue of Santa Rosalia: robe, head, a crown of roses, arms open with roses in the hands
  function statue(B, x, y, z, k) {   // k: scale; y: the feet
    B.cyl(M.ivory, 0.12 * k, 0.4 * k, 1.5 * k, x, y + 0.75 * k, z);                                   // robe
    B.cyl(M.ivory, 0.2 * k, 0.12 * k, 0.28 * k, x, y + 1.6 * k, z);                                   // shoulders
    B.sph(M.marble, 0.15 * k, x, y + 1.88 * k, z);                                                    // head
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; B.sph(M.rosePink, 0.05 * k, x + Math.cos(a) * 0.16 * k, y + 2.0 * k, z + Math.sin(a) * 0.16 * k, {}, 6); }   // the crown of roses
    for (const sd of [-1, 1]) { B.cyl(M.ivory, 0.045 * k, 0.05 * k, 0.7 * k, x, y + 1.45 * k, z + sd * 0.3 * k, { rx: sd * 0.9 }); B.sph(M.rose, 0.08 * k, x, y + 1.2 * k, z + sd * 0.62 * k, {}, 6); }   // the open arms and a rose in each hand
    B.cyl(M.gold, 0.3 * k, 0.3 * k, 0.03 * k, x - 0.1 * k, y + 1.9 * k, z, { rz: Math.PI / 2 }, 14);    // the halo behind the head
  }
  function rosesPot(B, x, z, n = 6) { B.cyl(M.pot, 0.2, 0.15, 0.3, x, 0.15, z); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; B.sph(i % 2 ? M.rose : M.rose2, 0.1, x + Math.cos(a) * 0.14, 0.42 + (i % 3) * 0.04, z + Math.sin(a) * 0.14, {}, 6); } B.sph(M.leaf, 0.2, x, 0.38, z, { sy: 0.6 }, 6); }

  // the shrine of the Santuario: a niche with the statue, a candle rack, roses, a kneeler
  function buildShrine(s) {
    const g = place(s), B = Bin();
    B.box(M.stone, 1.9, 0.3, 1.9, 0, 0.15, 0);                                                        // plinth
    B.box(M.stone, 0.5, 2.7, 1.9, -0.55, 1.65, 0);                                                    // the wall with the niche
    B.box(M.dark, 0.1, 1.9, 0.95, -0.27, 1.55, 0); B.cyl(M.dark, 0.475, 0.475, 0.1, -0.27, 2.5, 0, { rz: Math.PI / 2 }, 14);   // the niche, with a round top (a dark backdrop for the statue)
    B.box(M.rosePink, 0.9, 0.12, 2.2, -0.5, 3.05, 0); B.box(M.gold, 0.12, 0.16, 0.12, -0.5, 3.2, 0);   // a little roof of rose-coloured tiles, a gold finial
    statue(B, -0.02, 0.3, 0, 0.9);
    B.box(M.iron, 0.55, 0.06, 1.3, 0.55, 0.78, 0); for (const sz of [-0.6, 0.6]) B.cyl(M.iron, 0.03, 0.03, 0.78, 0.55, 0.39, sz);          // the candle rack
    for (let i = 0; i < 9; i++) B.cyl(M.candle, 0.035, 0.035, 0.18, 0.4 + (i % 2) * 0.25, 0.9, -0.55 + i * 0.14);
    rosesPot(B, 0.1, -1.0); rosesPot(B, 0.1, 1.0);
    B.box(M.wood, 0.5, 0.42, 1.3, 1.45, 0.21, 0); B.box(M.wood, 0.5, 0.1, 1.3, 1.15, 0.55, 0);        // the kneeler: a low bench with a rest
    B.build(g);
    for (let i = 0; i < 9; i++) addGlow(g, 0.4 + (i % 2) * 0.25, 1.05, -0.55 + i * 0.14, 0.5, 0.5, 0.5, 1, 0xffa840);   // the flames
    addGlow(g, 0.6, 1.3, 0, 3.2, 2.2, 0.0, 0.5, 0xffb870);
    wallBox(s.x, s.z, s.wl, [-0.8, 1.7], [-1.1, 1.1]);
    stopRing(s, 3.6, '#f5d77a', 4);
  }

  // the carro: the Festino float, drawn from the long side (local x towards the road, z along it)
  function buildCarro(s) {
    const g = place(s), B = Bin();
    for (const sx of [-2.6, 2.6]) for (const sz of [-3.6, 3.6]) { B.cyl(M.wood, 1.15, 1.15, 0.4, sx, 1.15, sz, { rz: Math.PI / 2 }, 16); B.cyl(M.gold, 0.35, 0.35, 0.5, sx, 1.15, sz, { rz: Math.PI / 2 }, 10); }   // four big wheels
    B.box(M.wood, 0.35, 0.35, 3.4, 0, 0.9, -7.4);                                                      // the draw-bar
    B.box(M.red, 5.6, 1.1, 11.4, 0, 1.6, 0); B.box(M.gold, 5.75, 0.14, 11.55, 0, 2.2, 0); B.box(M.gold, 5.75, 0.14, 11.55, 0, 1.05, 0);     // the base: red with gold trim
    B.box(M.ivory, 4.6, 3.0, 8.8, 0, 3.7, 0);                                                          // first tier
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) { B.cyl(M.gold, 0.18, 0.18, 3.0, sx * 2.35, 3.7, -4.0 + i * 1.6, {}, 8); B.box(M.rosePink, 0.06, 1.9, 1.15, sx * 2.32, 3.7, -3.2 + i * 1.6); }   // gilded pilasters, rose panels between
    B.box(M.gold, 5.0, 0.25, 9.2, 0, 5.32, 0);                                                         // cornice
    B.box(M.ivory, 3.4, 2.4, 6.2, 0, 6.65, 0);                                                         // second tier
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) B.cyl(M.gold, 0.15, 0.15, 2.4, sx * 1.7, 6.65, -2.6 + i * 1.3, {}, 8);
    B.box(M.gold, 3.8, 0.22, 6.6, 0, 7.96, 0);
    B.cyl(M.stone, 2.3, 2.3, 0.25, 0, 8.2, 0, {}, 20);                                                 // the round temple: a platform, eight columns, a ring, a dome
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.cyl(M.gold, 0.12, 0.12, 2.2, Math.cos(a) * 1.75, 9.4, Math.sin(a) * 1.75, {}, 8); }
    B.cyl(M.gold, 2.05, 2.05, 0.25, 0, 10.6, 0, {}, 20);
    B.sph(M.ivory, 1.9, 0, 10.7, 0, { sy: 0.75 }, 16); B.cyl(M.gold, 0.1, 0.1, 0.9, 0, 12.4, 0);
    statue(B, 0, 8.2, 0, 1.0);                                                                         // Santa Rosalia inside the temple, under the dome, roses at her hands
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) statue(B, sx * 2.0, 2.3, sz * 4.3, 0.55);       // four little saints at the corners of the first tier
    for (let i = 0; i < 22; i++) for (const sx of [-1, 1]) { B.sph(i % 3 ? M.rose : M.rose2, 0.2, sx * 2.9, 2.55, -5.3 + i * 0.5, {}, 6); if (i % 2) B.sph(M.leaf, 0.14, sx * 2.9, 2.35, -5.05 + i * 0.5, {}, 5); }   // garlands of roses along the base
    for (let i = 0; i < 18; i++) for (const sx of [-1, 1]) B.sph(M.lamp, 0.07, sx * 2.55, 5.5, -4.4 + i * 0.52, {}, 5);   // bulbs along the cornice (basic: they glow)
    B.build(g);
    for (let i = 0; i < 5; i++) addGlow(g, 0, 4 + i * 1.6, 0, 7, 3.2, 0.0, 0.35, 0xffc890);
    wallBox(s.x, s.z, s.wl, [-3.0, 3.0], [-5.9, 5.9]);
    stopRing(s, 6.8, '#f5d77a', 4.5);
  }

  // the prayer: stay still in the ring for PRAY_S seconds; the blessing wipes the wanted level (src/police.js) and the neighbourhoods' trouble (src/danger.js), then COOL_S seconds for both stops
  let blessCd = 0;
  function bless(s) {
    blessCd = COOL_S; s.pt = 0; s.said = false;
    const hadHeat = !!(env.traffic && env.traffic.debug && env.traffic.debug.police && env.traffic.debug.police.level() > 0), tr = trouble(), hadTrouble = tr.score > 0 || tr.stage > 1;
    dispatchEvent(new CustomEvent('pd-blessed'));   // src/police.js is listening (it also clears the neighbourhood score)
    if (hadHeat || hadTrouble) toast(PREGHIERA.toastDone[0], T(PREGHIERA.toastDone[1][0], PREGHIERA.toastDone[1][1]));
    else { car.nos = Math.min(car.nosMax, car.nos + 0.4); car.nosLock = false; toast(PREGHIERA.toastNone[0], T(PREGHIERA.toastNone[1][0], PREGHIERA.toastNone[1][1])); }
    burst(); say(pick(PREGHIERA.amen), driverPos, 0.6);
  }
  function updatePray(s, dt) {
    const inRing = dist(s) < 5.2 && speed() < 1.4 && !busy();
    s.ring.u.uAlpha.value = blessCd > 0 ? 0.25 : 1;
    if (!inRing) { s.pt = Math.max(0, s.pt - dt * 2); if (s.pt === 0) s.said = false; return; }
    if (blessCd > 0) { s.pt += dt; if (s.pt > 0.8) hud.set({ label: T('Preghiera', 'Prayer'), title: PREGHIERA.title, sub: T(PREGHIERA.cool[0], PREGHIERA.cool[1]) + ' ' + Math.ceil(blessCd) + ' s', time: '', frac: null, target: null }); return; }
    if (!s.said) { s.said = true; say(pick(PREGHIERA.pray), driverPos, 0.3); }
    s.pt += dt;
    hud.set({ label: T('Preghiera', 'Prayer'), title: PREGHIERA.title, sub: T('Fermati e prega', 'Stay still and pray'), time: '', frac: Math.min(1, s.pt / PRAY_S), target: null });
    if (s.pt >= PRAY_S) bless(s);
  }
  KIND.shrine = { build: buildShrine, update: updatePray, tick: dt => { blessCd = Math.max(0, blessCd - dt); } };
  KIND.carro = { build: buildCarro, update: updatePray, radius: 700 };
  const shrine = frame(SANTUZZA, 'shrine', { marker: addMarker(...env.proj(SANTUZZA.lat, SANTUZZA.lon), '#f5d77a', 5, 'diamond'), label: 'pray:' + SANTUZZA.id, pt: 0, said: false });
  stops.push(shrine);
  if (CARRO.on) stops.push(frame(CARRO, 'carro', { marker: addMarker(...env.proj(CARRO.lat, CARRO.lon), '#f5d77a', 5, 'diamond'), label: 'pray:' + CARRO.id, pt: 0, said: false }));

  // ---------------------------------------------------------------------------------------------------- cornetto kiosks: shuttered by day, open at night (CORNETTO_HOURS, game hours, wrapping midnight)
  const NIGHT_PEOPLE = ['nightboy', 'nightgirl', 'nightboy2', 'nightgirl2', 'nightgirl3'];
  const hourNow = () => (game.time && Number.isFinite(game.time.hour) ? game.time.hour : null);
  const inHours = (hr, [a, b]) => hr != null && (a <= b ? hr >= a && hr < b : hr >= a || hr < b);
  function buildCornetto(s) {
    const o = s.o, kiosk = buildKiosk({ id: o.id, marker: { color: '#ffb347' }, sign: [o.sign, '', '#8c1f22'], accent: '#8c1f22', hot: true, shutter: true, late: true, skin: 'vendor', ring: '#ffb347' }, s.x, s.z, s.th);
    s.k = kiosk; s.g = kiosk.g; s.ring = kiosk.ring; s.sx = kiosk.sx; s.sz = kiosk.sz;
    s.glow = addGlow(kiosk.g, 1.9, 1.6, 0, 6.5, 3.4, 0, 1, 0xffb86a);
    s.ground = addGlow(kiosk.g, 3.6, 0.6, 0, 9, 5, 0, 0.5, 0xffa850);   // a warm pool of light on the ground in front
    setOpen(s, s.open, true);
  }
  function setOpen(s, on, force) {
    if (!force && s.open === on) return;
    s.open = on;
    if (on && !s.marker) s.marker = addMarker(s.x, s.z, '#ffb347', 5, 'triangle');
    if (!on && s.marker) { dropMarker(s.marker); s.marker = null; }
    if (!s.built) return;
    const k = s.k;
    k.parts.shutter.visible = !on; k.parts.lamp.visible = on; s.glow.s.visible = s.ground.s.visible = on; s.ring.show(on);
    if (on && k.cid < 0) k.cid = k.mkSeller();
    if (!on && k.cid >= 0) { pedestrians.remove(k.cid); k.cid = -1; }
    for (const id of s.queue) pedestrians.remove(id); s.queue = [];
    if (on) for (let i = 0; i < 4; i++) {   // a small queue on the kerb beside the hatch, facing it
      const [qx, qz] = k.wl(2.4, 2.5 + i * 0.85), id = pedestrians.spawnScripted(pick(NIGHT_PEOPLE), qx, qz);
      if (id >= 0) { pedestrians.face(id, k.x + k.vx0 * 1.0, k.z + k.vz0 * 1.0); s.queue.push(id); }
    }
  }
  function updateCornetto(s, dt) {
    s.slowT = (s.slowT || 0) - dt; if (s.slowT <= 0) { s.slowT = 1; setOpen(s, inHours(hourNow(), CORNETTO_HOURS)); }   // the hours are looked at once a second
    if (s.open && s.built) vendorUpdate(s, dt, { pin: '#ffb347', title: 'CORNETTU!', L: CORNETTO, hear: 45 });
  }
  KIND.cornetto = { build: buildCornetto, update: updateCornetto, always: true };
  for (const o of CORNETTI) stops.push(frame(o, 'cornetto', { marker: null, open: false, queue: [], label: 'cornetto:' + o.id }));

  // ---------------------------------------------------------------------------------------------------- update
  let slowT = 0;
  function update(dt) {
    const nk = nightK();
    for (const gl of glows) { const op = gl.day + (gl.night - gl.day) * nk; if (gl.s.material.opacity !== op) gl.s.material.opacity = op; }
    for (const k of Object.values(KIND)) if (k.tick) k.tick(dt);
    slowT -= dt;
    if (slowT <= 0) { slowT = 1; for (const s of stops) if (s.built && s.g) { const gy = groundAt(s.x, s.z); if (Math.abs(gy - s.gy) > 0.25) { s.gy = gy; s.g.position.y = gy; } } }   // the terrain refines as tiles stream in
    for (const s of stops) {
      const K = KIND[s.kind];
      if (!s.built && Math.hypot(car.x - s.x, car.z - s.z) < (K.radius || BUILD_R)) {
        s.built = true; s.gy = groundAt(s.x, s.z);
        try { K.build(s); } catch (e) { console.warn('[friend-stops] build', s.label, e); }
      }
      if (s.built || K.always) K.update(s, dt);
    }
  }
  return { update, stops, debug: { bless: () => { blessCd = 0; bless(shrine); }, cd: () => blessCd, shrine } };
}
