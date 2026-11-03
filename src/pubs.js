// The pubs of the night life: a drawn front on the real facade (src/pub-fronts.js), a crowd of fitting people in front (pedestrians.spawnCrowd), the
// song of the house where there is one (Krust plays Terrorage), and the night errand each pub asks (src/event-pubs.js). Owned by the missions work.
// Everything is built or spawned only when the lapa is near and goes away again when it is not; nothing is loaded for a venue that is far.
//   venue: { def (src/pub-places.js), route (src/pub-routes.js), door {x,z}, n {x,z}, slot (the event slot), front, crowd [ids], caller id }
// createPubs(X, { game }) -> { venues, slots, update(dt, idle) -> accepted slot | null, start(slot), updateEvent(dt), stop(), cheer(venue), music }
//   Window event 'pd-pub-stop' { id, name, hour }: the lapa stood still at a pub's door after dark (src/achievements can listen).
//   X is the helper object of src/missions.js. Test links: ?event=pub:krust (puts the lapa at the pub), &auto accepts at once.
import * as THREE from 'three';
import { PUBS } from './pub-places.js';
import { PUB_ROUTES } from './pub-routes.js';
import { buildFront } from './pub-fronts.js';
import { createErrand } from './event-pubs.js';
import { createRadio } from './radio.js';
import { createNotes } from './pub-notes.js';
import { onAudioRecover } from './audio-recover.js';

const BUILD_R = 320, SHOW_R = 460, DROP_R = 900;                  // front: build, show, throw away (metres)
const CROWD_R = 140, CROWD_DROP = 210;                            // people in front
const OFFER_R = 150, ACCEPT_R = 11;                               // the caller appears, the lapa stops next to them
const MUSIC_URL = id => new URL('../assets/music/' + id + '.m4a', import.meta.url).href;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const inHours = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);

// ------------------------------------------------------------------------------------------------ the house song
// One <audio> element routed through a gain and a stereo pan, created when the lapa gets within LOAD m and released again beyond DROP m. The level follows the
// distance to the door (full inside NEAR, silent beyond FAR: a few metres from the door, gone by about 28 m) and fades; the car radio is ducked by the same amount
// (radio.duckFor) and its card is borrowed while the song is audible (radio.takeover / release, themed 'metal', the bars follow an analyser tapped before the gain).
function createMusic(def, door, game, car, camera) {
  const NEAR = 5, FAR = 28, LOAD = 90, DROP = 170, url = MUSIC_URL(def.music), info = def.musicInfo || { label: def.name, title: def.name, artist: '' };
  let el = null, ctx = null, gain = null, pan = null, ana = null, lvl = 0, wantPlay = false, taken = false;
  const radio = () => { try { return createRadio({ game }); } catch (e) { return null; } };
  const mv = () => Number.isFinite(game?.settings?.musicVolume) ? game.settings.musicVolume : 0.5;
  function open() {
    if (el) return;
    el = new Audio(); el.preload = 'auto'; el.loop = true; el.setAttribute('playsinline', ''); el.src = url;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(el); gain = ctx.createGain(); gain.gain.value = 0;
      ana = ctx.createAnalyser(); ana.fftSize = 256; ana.smoothingTimeConstant = 0.6; src.connect(ana);   // only read (the radio card's bars), never connected on
      src.connect(gain); if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); gain.connect(pan); pan.connect(ctx.destination); } else gain.connect(ctx.destination);
    } catch (e) { gain = null; pan = null; ana = null; }
  }
  function close() {
    if (!el) return;
    el.pause(); el.removeAttribute('src'); el.load(); el = null; gain = null; pan = null; ana = null; wantPlay = false; lvl = 0; duck(0); borrow(false);
  }
  function duck(k) {   // k: 0 (ours is silent) .. 1 (ours is full): the radio goes down to 12 % of its own volume (src/radio.js duckFor)
    radio()?.duckFor?.(k > 0.02 ? k : 0);
  }
  function borrow(on) {   // the radio card goes "possessed" while the song is audible (radio.takeover / release), one call per change
    if (on === taken) return; taken = on;
    const r = radio(); if (!r) return;
    if (on) r.takeover?.({ label: info.label, title: info.title, artist: info.artist, theme: 'metal', analyser: ana, level: () => lvl }); else r.release?.();
  }
  function tick(dt) {
    const d = Math.hypot(car.x - door.x, car.z - door.z);
    if (d > DROP) { close(); return; }
    if (d < LOAD) open();
    if (!el) return;
    const playing = game.state === 'play', t = d <= NEAR ? 1 : d >= FAR ? 0 : (1 - (d - NEAR) / (FAR - NEAR)) ** 2;
    const goal = t * (playing ? 1 : 0.25) * (document.hidden ? 0 : 1);
    lvl += (goal - lvl) * Math.min(1, dt * 1.6);
    if (lvl < 0.004 && goal === 0) lvl = 0;
    if (lvl > 0.01 && !wantPlay) { wantPlay = true; ctx?.resume?.().catch?.(() => {}); const p = el.play(); if (p && p.catch) p.catch(() => { wantPlay = false; }); }   // refused before the first tap: tried again next tick
    else if (lvl === 0 && wantPlay) { wantPlay = false; el.pause(); }
    const v = lvl * mv() * 0.9;
    if (gain) { gain.gain.setTargetAtTime(v, ctx.currentTime, 0.08); if (pan) pan.pan.value = clamp(Math.sin(Math.atan2(door.x - camera.position.x, door.z - camera.position.z) - camYaw(camera)) * 0.55, -0.6, 0.6); }   // door to the right of the view: sound to the right
    else el.volume = clamp(v, 0, 1);
    duck(lvl);
    borrow(taken ? lvl > 0.03 : lvl > 0.08);
  }
  const fwd = new THREE.Vector3();
  function camYaw(cam) { cam.getWorldDirection(fwd); return Math.atan2(fwd.x, fwd.z); }
  let last = performance.now();
  const timer = setInterval(() => { const n = performance.now(), dt = Math.min(0.5, (n - last) / 1000); last = n; try { tick(dt); } catch (e) { /* keep ticking */ } }, 100);
  // the browser pauses the song in the background: the contexts come back by themselves (src/audio-recover.js), the element is started again here
  const unhook = onAudioRecover(() => { if (el && wantPlay && el.paused) el.play().catch(() => { wantPlay = false; }); });
  return { get level() { return lvl; }, get loaded() { return !!el; }, get element() { return el; }, get taken() { return taken; }, destroy() { clearInterval(timer); unhook(); close(); } };
}

// ------------------------------------------------------------------------------------------------ the venues
export function createPubs(X, { game }) {
  const { scene, car, pedestrians, groundAt, speed, say, now } = X;
  const venues = [];
  for (const def of PUBS) {
    const R = PUB_ROUTES[def.id]; if (!R) { console.warn('[pubs] no baked route for', def.id, '(run assets/missions/snap-pubs.mjs)'); continue; }
    const door = { x: R.door[0], z: R.door[1] }, n = { x: R.n[0], z: R.n[1] };
    const slot = { id: 'pub:' + def.id, kind: 'pub', sub: 'pub', name: def.name, x: R.road[0], z: R.road[1], dx: R.road[2], dz: R.road[3], w: R.road[4], night: false, hours: def.errand ? def.errand.window : null, coolUntil: 0, marker: null, holdT: 0 };
    const v = { def, route: R, door, n, slot, front: null, shown: false, crowd: [], crowdKind: '', crowdTry: 0, caller: -1, shoutT: 0, ring: null, y: 0, yT: 0, music: null, d: 1e9, cheerT: 0, stopT: 0, stopFired: false, notes: null };
    slot.venue = v; venues.push(v);
  }
  const errand = createErrand(X);
  let armed = false, tick = 0, markT = 0;
  const hour = () => game.time ? game.time.hour : 12;
  const winOpen = v => !!v.def.errand && inHours(hour(), v.def.errand.window);
  const isOpen = v => inHours(hour(), v.def.open);

  function place(v) {   // the front stands on the real facade; the ground height follows the terrain as tiles refine
    const f = v.front.group, gy = groundAt(v.door.x + v.n.x * 0.8, v.door.z + v.n.z * 0.8);
    f.position.set(v.door.x + v.n.x * 0.06, gy, v.door.z + v.n.z * 0.06);   // the tile walls stand 3 to 4 cm proud of the footprint edge
    f.rotation.y = Math.atan2(v.n.x, v.n.z); v.y = gy;
  }
  function spawnCrowd(v) {
    const C = v.def.crowd, open = isOpen(v), count = open ? C.night : C.day, at = v.route.crowdAt;
    v.crowdKind = open ? 'night' : 'day';
    const x = at ? at[0] : v.door.x + v.n.x * 2.8, z = at ? at[1] : v.door.z + v.n.z * 2.8;   // Piazza Magione: the crowd sits on the lawn, not at the bar
    v.crowd = pedestrians.spawnCrowd({ x, z, radius: C.r, count, mix: C.mix, props: C.props, pose: C.pose, anywhere: C.anywhere });   // pose: 'sit' (on the ground) where the record says so
    v.crowdTry = v.crowd.length >= count * 0.6 ? 9 : v.crowdTry + 1;
  }
  function dropCrowd(v) { if (v.crowd.length) pedestrians.removeCrowd(v.crowd); v.crowd = []; v.crowdKind = ''; v.crowdTry = 0; }
  function dropCaller(v) { if (v.caller >= 0) pedestrians.remove(v.caller); v.caller = -1; if (v.ring) v.ring.show(false); }

  function spawnCaller(v) {
    const k = { x: v.door.x + v.n.x * 1.9 + v.n.z * 1.3, z: v.door.z + v.n.z * 1.9 - v.n.x * 1.3 };
    const id = pedestrians.spawnScripted(v.def.caller || 'nightboy', k.x, k.z); if (id < 0) return;
    pedestrians.face(id, v.slot.x, v.slot.z); v.caller = id; v.shoutT = 1 + Math.random() * 3; v.kerb = k;
    if (!v.ring) { v.ring = X.makeBeacon('#ffb02e', 6); v.ring.beam.scale.set(0.15, 1, 0.15); }
    v.ring.set(k.x, k.z);
  }
  const headOf = v => () => { const i = v.caller >= 0 ? pedestrians.info(v.caller) : null; return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; };
  const lineOf = l => { const a = l[Math.floor(Math.random() * l.length)]; return Array.isArray(a) ? (X.lang() === 'en' && a[1] ? a[1] : a[0]) : a; };

  // idle: true while no event runs. Returns the slot of a pub whose errand the lapa has just accepted.
  function update(dt, idle) {
    if (idle && speed() > 4) armed = true;
    tick -= dt; const slow = tick <= 0; if (slow) tick = 0.5;
    const t = now(); let accepted = null, nearest = null, nd = 1e9;
    for (const v of venues) {
      const d = v.d = Math.hypot(car.x - v.door.x, car.z - v.door.z);
      // front: built when near, hidden when a bit further, thrown away when far
      if (slow) {
        if (!v.front && d < BUILD_R) { v.front = buildFront(v.def.front); if (v.front) { scene.add(v.front.group); place(v); } }
        if (v.front) {
          const sh = d < SHOW_R; if (sh !== v.shown) { v.shown = sh; v.front.group.visible = sh; }
          if (d > DROP_R) { scene.remove(v.front.group); v.front.dispose(); v.front = null; v.shown = false; }
          else if ((v.yT -= 0.5) <= 0) { v.yT = 3; const gy = groundAt(v.door.x + v.n.x * 0.8, v.door.z + v.n.z * 0.8); if (Math.abs(gy - v.y) > 0.2) place(v); }
        }
        // people in front: the crowd of the hour, replaced when the hour changes from day to open
        const kind = isOpen(v) ? 'night' : 'day';
        if (v.crowd.length && (d > CROWD_DROP || kind !== v.crowdKind)) dropCrowd(v);
        if (!v.crowd.length && d < CROWD_R && v.crowdTry < 4 && v.front) spawnCrowd(v);
        if (v.cheerT > 0 && (v.cheerT -= 0.5) <= 0) for (const id of v.crowd) pedestrians.setBounce(id, false);
      }
      // "the player stopped at the door at night" for the achievements: 'pd-pub-stop' { id, name, hour } once per visit (re-armed beyond 30 m)
      if (d < 7 && speed() < 1.2 && game.time && game.time.night > 0.5) { if (!v.stopFired && (v.stopT += dt) > 1.5) { v.stopFired = true; dispatchEvent(new CustomEvent('pd-pub-stop', { detail: { id: v.def.id, name: v.def.name, hour: game.time.hour } })); } }
      else { v.stopT = 0; if (d > 30) v.stopFired = false; }
      // notes, sound lines and horns drifting out of the door while the house song is audible
      if (v.music) { const lv = v.music.level; if (lv > 0.04 && !v.notes) v.notes = createNotes(scene); if (v.notes && (lv > 0.04 || v.notes.alive)) v.notes.update(dt, lv, v.door.x + v.n.x * 0.5, v.y + 1.7, v.door.z + v.n.z * 0.5, v.n.x, v.n.z); }
      if (v.front && v.shown) { const g = game.time || {}; v.front.update(g.night || 0, isOpen(v), t); }
      // the offer: a caller outside the door, only in the window of the errand
      const E = v.def.errand, ready = !!E && idle && t >= v.slot.coolUntil && winOpen(v);
      if (!ready) { if (v.caller >= 0) dropCaller(v); }
      else if (v.caller >= 0) {
        if (d > OFFER_R * 1.6) { dropCaller(v); continue; }
        pedestrians.setBounce(v.caller, d < 110);
        if ((v.shoutT -= dt) <= 0 && d < 75) { v.shoutT = 6 + Math.random() * 4; say(lineOf(E.call), headOf(v), 0); }
        const dc = Math.hypot(car.x - v.kerb.x, car.z - v.kerb.z);
        v.ring.show(dc < 200);
        if (dc < nd) { nd = dc; nearest = v; }
        // Taverna, Magione and Monkey have their door in a piazza 20 to 50 m from the road, which the lapa cannot reach from it: there the road point (the pin on the map, where the errand ends) counts too
        const here = dc < ACCEPT_R || (Math.hypot(v.kerb.x - v.slot.x, v.kerb.z - v.slot.z) > ACCEPT_R && Math.hypot(car.x - v.slot.x, car.z - v.slot.z) < ACCEPT_R);
        if (armed && X.held !== v.slot && here && speed() < 2.2) { v.slot.holdT += dt; if (v.slot.holdT > 0.35) accepted = v.slot; } else v.slot.holdT = 0;
      } else if (slow && d < OFFER_R && car.type !== 'sulky') spawnCaller(v);
    }
    // minimap pins for the pubs within reach
    markT -= dt;
    if (markT <= 0) {
      markT = 1;
      for (const v of venues) {
        const s = v.slot, want = idle && !!v.def.errand && v.d < 750 && t >= s.coolUntil && winOpen(v);
        if (want && !s.marker) s.marker = X.addMarker(s.x, s.z, '#ffb02e', 6);
        else if (!want && s.marker) { X.dropMarker(s.marker); s.marker = null; }
      }
    }
    return accepted;
  }

  function start(slot) {
    const v = slot.venue; armed = false;
    if (slot.marker) { X.dropMarker(slot.marker); slot.marker = null; }
    if (v.ring) v.ring.show(false);
    errand.start(v);
  }
  function stop() {
    errand.stop();
    for (const v of venues) if (v.ring) v.ring.show(false);
  }
  function cheer(v) { for (const id of v.crowd) pedestrians.setBounce(id, true); v.cheerT = 12; }
  function clear() { for (const v of venues) { dropCaller(v); dropCrowd(v); if (v.slot.marker) { X.dropMarker(v.slot.marker); v.slot.marker = null; } } }
  // the music of the houses that have one: made on first use, they load their file only when the lapa is close
  for (const v of venues) if (v.def.music) v.music = createMusic(v.def, v.door, game, car, X.camera);
  const api = { venues, slots: venues.map(v => v.slot), update, start, updateEvent: dt => errand.update(dt), stop, clear, cheer, errand, arm: () => { armed = true; }, disarm: () => { armed = false; } };
  X.pubs = api;
  return api;
}
