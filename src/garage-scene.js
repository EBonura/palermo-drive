// The Garage as a place of its own. Owned by the driving work; src/ui.js creates it, src/garage-ui.js drives it, src/main.js draws it.
// While it is open (game.garage is set) the city is neither simulated nor drawn: main.js renders this scene with this camera instead and the
// street stays exactly as it was (the title flyover clock is held, the chase camera and the vehicle are not touched), so leaving is a plain
// switch back. The vehicle shown here is a private copy (vehicle.buildVehicleModel) on a turntable: what you try on it changes nothing in the
// street until it is fitted or bought (src/garage.js), and fitted changes reach the street vehicle through garage.onChange as always.
//
// GARAGES is the list of places. A new garage is one entry: an id, names, an unlock rule and a builder (see src/garage-officina.js for what the
// builder returns). Only the officina exists so far. available() / select(id) are the stubs the unlock screen will use.
import * as THREE from 'three';
import { garage } from './garage.js';
import { tickShared } from './vehicle-models.js';
import { buildOfficina } from './garage-officina.js';
import { canvasTex, soft } from './garage-kit.js';

export const GARAGES = [
  { id: 'officina', name_it: 'Officina ru ziu Turiddu', name_en: 'Uncle Turiddu\'s workshop', unlock: () => true, build: buildOfficina },
  // { id: 'tamarro', name_it: 'Garage tamarro', name_en: 'Tamarro garage', unlock: g => g.ownsPart('neon', 'rosa'), build: buildTamarro },   // neon, pink and black floor, speakers
];
export const availableGarages = () => GARAGES.filter(d => d.unlock(garage));

const Q = new URLSearchParams(location.search);   // test links: ?garage=officina  ?gfix (no turning, no sway)  ?gnight / ?gday
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapA = a => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const angTo = (from, to) => from + wrapA(to - from);
// critically damped spring: x follows goal, v is kept between frames; exact for any dt
const spring = (s, goal, w, dt) => { const e = Math.exp(-w * dt), d = s.x - goal, t = s.v + w * d; s.x = goal + (d + t * dt) * e; s.v = (s.v - w * t * dt) * e; };
const FOV = 40, FAR = 1e7, TURN = 0.36, IDLE = 4;   // IDLE: seconds after the last drag before the slow turn (or the category's view) takes over again

export function createGarageScene({ renderer, vehicle, game }) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  scene.background = new THREE.Color('#14100c');
  let room = null, roomKey = '', current = Q.get('garage') || GARAGES[0].id, envRT = null, panelPx = () => 0, open = false;
  let rig = null, shownKey = '', shownLook = null, size = { len: 3.4, wid: 1.6, hgt: 1.5 }, kind = 'lapa';
  let focus = { mode: 'orbit', d: 8.4, h: 3.0, ly: 0.75 }, hornT = 0, savedExposure = 1;
  const S = { yaw: { x: 0.6, v: 0 }, az: { x: 0, v: 0 }, d: { x: 8, v: 0 }, ly: { x: 1, v: 0 }, el: { x: 0.25, v: 0 }, fresh: 3, plat: { x: 1, v: 0 } };
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: 0.7 }));
  blob.renderOrder = 3; blob.material.map = canvasTex(64, 64, g => soft(g, 32, 32, 32, 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0)'));
  const _box = new THREE.Box3(), _b = new THREE.Box3();
  // ---- the player's hands: drag to turn round the vehicle (and tilt a little), pinch or wheel to move in and out. The menu panel is not part of it. ----
  const U = { el: 0, zoom: 1, last: -1e9 }, ptrs = new Map();
  let inputEl = null, inputIgnore = null;
  const nowS = () => performance.now() / 1000;
  const onDown = e => {
    if (!open || (inputIgnore && inputIgnore.contains(e.target)) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); U.last = nowS();
    try { inputEl.setPointerCapture(e.pointerId); } catch (x) { /* not capturable: window listeners still see it */ }
    e.preventDefault();
  };
  const onMove = e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y, pts = [...ptrs.values()];
    if (ptrs.size >= 2) {   // pinch: the distance between the first two fingers
      const q = pts[0] === p ? pts[1] : pts[0], d0 = Math.hypot(p.x - q.x, p.y - q.y), d1 = Math.hypot(e.clientX - q.x, e.clientY - q.y);
      if (d0 > 8 && d1 > 8) U.zoom = clamp(U.zoom * d0 / d1, 0.65, 1.5);
    } else { S.yaw.x += dx * 0.009; S.yaw.v = 0; U.el = clamp(U.el + dy * 0.004, -0.12, 0.4); }
    p.x = e.clientX; p.y = e.clientY; U.last = nowS();
  };
  const onUp = e => { if (ptrs.delete(e.pointerId)) U.last = nowS(); };
  const onWheel = e => {
    if (!open || (inputIgnore && inputIgnore.contains(e.target))) return;
    U.zoom = clamp(U.zoom * Math.exp(e.deltaY * 0.0012), 0.65, 1.5); U.last = nowS(); e.preventDefault();
  };
  function setInput(el, ignore) {   // el: the full-screen element over the canvas; ignore: the panel inside it
    inputEl = el; inputIgnore = ignore; el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown); el.addEventListener('wheel', onWheel, { passive: false });
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  }

  const moodNow = () => Q.has('gnight') ? false : Q.has('gday') ? true : !(game && game.time && game.time.isNight);
  const defOf = id => GARAGES.find(d => d.id === id && d.unlock(garage)) || GARAGES.find(d => d.unlock(garage)) || GARAGES[0];

  // ---- the room: built on first entry (and again if the time of day flips between the two moods) ----
  function bakeEnv(env) {   // a coloured sphere seen from the middle, turned into reflections for paint and chrome
    const g = new THREE.SphereGeometry(50, 24, 12), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / 50, y = pos.getY(i) / 50, z = pos.getZ(i) / 50, c = env(x, y, z); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false }), es = new THREE.Scene(); es.add(new THREE.Mesh(g, m));
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.04); pm.dispose(); g.dispose(); m.dispose();
    return rt;
  }
  function buildRoom() {
    const def = defOf(current), day = moodNow(), key = def.id + (day ? ':day' : ':night');
    if (room && roomKey === key) return;
    teardown();
    room = def.build({ vehicle, day }); roomKey = key;
    scene.add(room.group, room.extras, room.turntable);
    for (const l of room.lights) scene.add(l);
    room.turntable.add(blob);
    envRT = bakeEnv(room.env); scene.environment = envRT.texture;
    S.fresh = 3; shownKey = '';
  }
  function teardown() {
    if (!room) return;
    dropRig();
    scene.remove(room.group, room.extras, room.turntable);
    for (const l of room.lights) scene.remove(l);
    room.dispose(); room = null; roomKey = '';
    if (envRT) { envRT.dispose(); envRT = null; scene.environment = null; }
  }

  // ---- the vehicle on the turntable ----
  function dropRig() { if (rig) { rig.dispose(); rig = null; } }
  function measure() {
    rig.root.updateMatrixWorld(true); _box.makeEmpty();
    for (const m of rig.meshes) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); _b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); _box.union(_b); }
    const s = _box.getSize(new THREE.Vector3());
    size = { len: s.z, wid: s.x, hgt: s.y };
  }
  function setLook(look) {
    if (!room || !look) return;
    const key = look.type + '|' + look.livery + '|' + JSON.stringify(look.parts || {});
    if (key === shownKey) return;
    shownKey = key; shownLook = look;
    const keepYaw = room.turntable.rotation.y;
    dropRig();
    rig = vehicle.buildVehicleModel(look);
    rig.root.position.y = room.top; room.turntable.add(rig.root); room.turntable.rotation.y = keepYaw;
    kind = rig.kind;
    rig.pose({ t: 0 }); measure();
    blob.scale.set(size.wid * 1.5 + 0.4, 1, size.len * 1.2 + 0.4); blob.position.set(0, room.top + 0.012, 0);
    if (room.onLook) room.onLook(look);
  }

  // ---- the camera: the turntable does the turning, the camera only stands, breathes and moves in on what is being looked at ----
  function frame(dt, sec) {
    if (!open || !room) return;
    const W = innerWidth, H = innerHeight, land = W > H * 1.1, pw = land ? clamp(panelPx(), 0, W * 0.8) : 0;
    const k = kind === 'bike' ? 0.72 : kind === 'car' ? 1.18 : 1, kh = k < 1 ? 0.8 : 1, fix = Q.has('gfix');
    // the turntable
    const Y = S.yaw, F = focus, azBase = room.cam.az;
    const held = ptrs.size > 0 || sec - U.last < IDLE, resume = held ? 0 : clamp((sec - U.last - IDLE) / 1.5, 0, 1);   // hands off: after IDLE seconds the turn eases back in
    if (!held) U.el *= Math.exp(-dt * 0.7);
    if (fix) { if (!ptrs.size && U.last < 0) Y.x = 0.7; Y.v = 0; }
    else if (held) Y.v = 0;
    else if (F.mode === 'orbit') { Y.x += TURN * resume * dt; Y.v = TURN * resume; }
    else {
      const sway = Math.sin(sec * 0.4) * (F.mode === 'rear' ? 0.45 : 0.3);
      const goal = F.mode === 'rear' ? azBase + Math.PI + sway : azBase - Math.PI / 2 + 0.3 + sway;
      spring(Y, angTo(Y.x, goal), 2.4, dt); Y.v = clamp(Y.v, -0.9, 0.9);
    }
    // framing: the vehicle fills the part of the screen the menu panel leaves free
    const rs = Math.max(0.5 * Math.hypot(size.len, size.wid) * 1.04, size.hgt * 0.62);
    const tv = Math.tan(FOV * Math.PI / 360), th = tv * (W - pw) / H, fit = rs / Math.sin(Math.atan(Math.min(tv, th))) * 1.5;
    const zoom = clamp(F.d / 8.4, 0.85, 1);
    const sk = clamp(size.hgt / 1.6, 0.6, 1.2);
    const dT = Math.max(fit * zoom * U.zoom, rs * 1.15), lyT = room.top + Math.max(F.ly * sk * 1.05, size.hgt * 0.4), elT = clamp(Math.atan2(F.h * kh - F.ly, F.d * k), 0.14, 0.3) + U.el;
    const azT = azBase + (fix ? 0 : Math.sin(sec * 0.21) * 0.07);
    if (S.fresh > 0) { S.fresh--; S.az.x = azT; S.d.x = dT; S.ly.x = lyT; S.el.x = elT; S.az.v = S.d.v = S.ly.v = S.el.v = 0; }
    else { spring(S.az, azT, 2.2, dt); spring(S.d, dT, 2.4, dt); spring(S.ly, lyT, 2.6, dt); spring(S.el, elT, 2.4, dt); }
    const d = S.d.x, hz = d * Math.cos(S.el.x), b = room.bounds;
    const px = clamp(Math.sin(S.az.x) * hz, b.x0, b.x1), pz = clamp(Math.cos(S.az.x) * hz, b.z0, b.z1), py = Math.min(S.ly.x + d * Math.sin(S.el.x) + (fix ? 0 : Math.sin(sec * 0.17) * 0.06), b.y1);
    if (room.platform) { const ps = clamp(0.5 * Math.hypot(size.len, size.wid) * 1.15 / room.radius, 0.7, 1.2); if (S.fresh > 0 || fix) S.plat.x = ps; else spring(S.plat, ps, 4, dt); room.platform.scale.set(S.plat.x, 1, S.plat.x); }   // the platform grows or shrinks to the vehicle
    room.turntable.rotation.y = Y.x;
    camera.aspect = W / H; camera.fov = FOV;
    if (pw > 1) camera.setViewOffset(W, H, pw / 2, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.position.set(px, py, pz); camera.lookAt(0, S.ly.x, 0);
    // the vehicle: wheels and rims that spin, a subwoofer that pumps, sounds
    if (rig) {
      rig.pose({ t: sec });
      const parts = (shownLook && shownLook.parts) || {};
      const audio = vehicle.audio;
      tickShared(sec);
      if (audio) {
        audio.bassUpdate(!!parts.sub, dt, FAR, FAR);
        hornT = Math.max(0, hornT - dt);
        audio.hornUpdate(parts.horn || '', hornT > 0, dt, FAR, FAR);
        const bp = parts.sub ? audio.bass.pulse : 0;
        if (rig.cone) { rig.cone.scale.set(1 + 0.12 * bp, 1 + 0.12 * bp, 1 + 0.9 * bp); rig.sub.scale.setScalar(1 + 0.025 * bp); }
      }
    }
    if (room.update) room.update(sec, dt);
  }

  const api = {
    scene, camera, frame,
    get room() { return room; },
    stats() { return room ? { tris: room.tris, draws: room.draws, texKB: room.texKB } : null; },
    // the menu panel's width in pixels (the vehicle is framed in the space left of it)
    setPanel(fn) { panelPx = fn; },
    available: availableGarages,
    select(id) { if (GARAGES.some(d => d.id === id && d.unlock(garage))) current = id; return current; },
    get selected() { return current; },
    setInput, setLook, testHorn() { hornT = 1.6; },
    // what the camera looks at: { mode: 'orbit' | 'side' | 'rear', d, h, ly } (the garage UI picks one per category)
    setFocus(f) { focus = f || { mode: 'orbit', d: 8.4, h: 3.0, ly: 0.75 }; },
    enter(look) {
      buildRoom();
      savedExposure = renderer.toneMappingExposure; renderer.toneMappingExposure = room.exposure;
      open = true; S.fresh = 3; game.garage = api; U.el = 0; U.zoom = 1; U.last = -1e9; ptrs.clear();
      setLook(look || garage.look());
      frame(0.016, 0);
      renderer.compile(scene, camera);
    },
    leave() {
      if (!open) return;
      open = false; game.garage = null; renderer.toneMappingExposure = savedExposure;
      dropRig(); shownKey = '';
      if (vehicle.audio) { vehicle.audio.bassUpdate(false, 0, FAR, FAR); vehicle.audio.hornUpdate('', false, 0, FAR, FAR); }
    },
  };
  return api;
}
