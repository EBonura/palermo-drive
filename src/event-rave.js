// The two rave missions (night). "Casse pû rave": the sound man at the centro sociale ExKarcere (Via San Basilio) needs two speaker stacks taken to the rave in the woods of the Favorita
// (src/rave.js): a timed delivery of fragile cargo; every hard knock costs some of the speakers' health, at nothing left or with the clock out the rave is off; delivered, the
// stage goes full power for the night (louder, brighter, more people) and the pay follows the health that is left and the time. "Fuogghi allegri": a friend at the rave sends you
// to Via Cipressi (6 km away) for the happy leaves: drive there, hunt them close by, hand them to a pal on the street. Same pieces as the other events: slots and callers from
// src/missions.js and src/event-calls.js, baked routes and hunt items (src/event-routes.js, assets/missions/snap-places.mjs), the card, the arrow and the minimap of src/event-hud.js.
// The text is Palermitan, written by an agent: it is all in assets/missions/lines.js (RAVE_LINES, CALL.rave, CALL.leaf) and in the T(...) calls below, for the owner to correct.
// createRaveEvents(X, rave) -> { start(slot), update(dt), stop(), active() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RAVE_LINES as RL } from '../assets/missions/lines.js';
import { RAVE } from './event-places.js';
import { SNAP } from './event-routes.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const R_PICK2 = 3.6 * 3.6, HUNT_TIME = 85, HAND_TIME = 70;

// one coloured merged geometry: three green leaves on a stem with a little yellow smiling face over them (the "happy leaf": a wink, nothing more)
function leafGeo() {
  const col = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const P = [];
  for (const [k, a] of [[0, 0], [1, 1.0], [2, -1.0]]) P.push(col(new THREE.SphereGeometry(0.5, 8, 6).scale(0.3, 0.05, 0.95).rotateX(-0.5).translate(0, 0.45, 0.3).rotateY(a), k ? '#2f9a34' : '#46b83f'));
  P.push(col(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 6).translate(0, 0.25, 0), '#2a7a2c'));
  P.push(col(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.15, 0), '#ffd83a'), col(new THREE.SphereGeometry(0.03, 6, 4).translate(-0.075, 1.2, 0.185), '#1a1208'), col(new THREE.SphereGeometry(0.03, 6, 4).translate(0.075, 1.2, 0.185), '#1a1208'),
    col(new THREE.TorusGeometry(0.08, 0.015, 5, 10, Math.PI).rotateZ(Math.PI).translate(0, 1.14, 0.19), '#1a1208'));
  const g = mergeGeometries(P); g.translate(0, 0.3, 0); g.scale(1.5, 1.5, 1.5); return g;
}

export function createRaveEvents(X, rave) {
  const { scene, car, pedestrians, T, hud, eur, speed, say, groundAt, seatPos, seatFn } = X;
  let e = null, pedHit = false;
  if (pedestrians.onKnock) pedestrians.onKnock(() => { pedHit = true; });
  const beamGeo = new THREE.CylinderGeometry(0.3, 0.5, 60, 8, 1, true).translate(0, 30, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#7ad65a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const itemMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const homeBeacon = X.makeBeacon('#6bbf59', 8); homeBeacon.beam.scale.set(0.35, 1, 0.35);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const mmss = m => Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const dist = (x, z) => { const d = Math.hypot(x - car.x, z - car.z); return d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m'; };
  const headAt = (x, z, h = 2.4) => () => ({ x, y: groundAt(x, z) + h, z });

  // the two speaker stacks on the back of the lapa (they follow the vehicle's pose)
  function makeCargo() {
    const g = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.8 }), cm = new THREE.MeshStandardMaterial({ color: 0x55555e, roughness: 0.7 });
    for (const sx of [-0.32, 0.32]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.46), bm); b.position.set(sx, 0.42, 0); g.add(b);
      for (const y of [0.25, 0.62]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), cm); c.rotation.x = Math.PI / 2; c.position.set(sx, y, -0.24); g.add(c); }
    }
    g.visible = false; scene.add(g); return g;
  }
  function placeCargo() {
    const c = e.cargo, th = car.th;
    c.position.set(car.x - Math.sin(th) * 1.25, groundAt(car.x, car.z) + (car.lift || 0) + 0.95, car.z - Math.cos(th) * 1.25); c.rotation.y = th; c.visible = true;
  }

  // ---------------------------------------------------------------- 1. the delivery
  function startRave(slot) {
    const R = X.ROUTES['rave:karcere'][0], S = SNAP['rave:site'], limit = R[1] / 9 + 55;
    e = { kind: 'rave', slot, phase: 'drive', len: R[1], limit, left: limit, integ: 100, prevV: 0, cool: 0, dest: { x: S[0], z: S[1], name: RAVE.site.name }, cargo: makeCargo(), t: 0, thanks: 0, pay: 0 };
    X.calls.hideBeacon(); X.setPhase('drive'); X.guide.path(R[2]);
    X.destBeacon.set(S[0], S[1]); X.destBeacon.show(true); X.destMarker = X.addMarker(S[0], S[1], '#b16bff', 8, 'target');
    hud.toast(T('Carica i casse!', 'Load the speakers!'), RAVE.karcere.name);
  }
  function updateRave(dt) {
    if (e.phase === 'drive') {
      e.left -= dt; e.cool -= dt;
      const v = speed(), dv = e.prevV - v; e.prevV = v; placeCargo();
      if (e.cool <= 0 && dv > 4 && v < 0.75 * (v + dv)) {   // a knock: a sudden loss of speed
        e.integ = Math.max(0, e.integ - Math.min(34, dv * 3.4)); e.cool = 0.7;
        hud.toast(T('Crac!', 'Crack!'), T('Attientu a li casse', 'Mind the speakers'), true); say(pick(RL.hit), X.driverPos, 0.2);
      }
      if (e.integ <= 0) { finish(false, 'broken'); return; }
      if (e.left <= 0) { finish(false, 'late'); return; }
      if (Math.hypot(car.x - e.dest.x, car.z - e.dest.z) < 12 && v < 7) { finish(true); return; }
      X.aim(e.dest.x, e.dest.z, true);
      hud.set({ label: T('Casse pû rave', 'Speakers for the rave'), title: e.dest.name, sub: dist(e.dest.x, e.dest.z), time: mmss(Math.max(0, e.left)), low: e.left < 40, frac: e.left / e.limit, target: e.dest,
        ledger: [T('Casse ', 'Speakers ') + Math.round(e.integ) + '%'] });
    } else {
      X.aim(0, 0, false);
      hud.set({ label: ok_(e) ? T('Si abballa!', 'Let\'s dance!') : T('Finiu', 'Over'), title: RAVE.site.name, sub: '', time: '', frac: null, target: null });
      if ((e.thanks -= dt) <= 0) X.endEvent(e.pay > 0);
    }
  }
  const ok_ = ev => ev.pay > 0;
  function finishRave(ok, why) {
    e.phase = 'done'; e.thanks = ok ? 5.5 : 4; X.setPhase('done'); X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off(); e.cargo.visible = false;
    if (!ok) {
      hud.result(`<h3>${why === 'broken' ? T('Casse rutte!', 'Speakers broken!') : T('Taiddu assai!', 'Far too late!')}</h3><div class="row"><span>${why === 'broken' ? T('U rave un paiti', 'The rave is off') : T('A genti si ni iu', 'The people went home')}</span></div>`, 3.4);
      say(pick(why === 'broken' ? RL.broken : RL.late), X.driverPos, 0.4); return;
    }
    const base = Math.round((12 + e.len / 500) * 2) / 2, got = Math.round(base * e.integ / 100 * 2) / 2, bonus = Math.round(8 * clamp(e.left / e.limit, 0, 1) * 2) / 2, total = got + bonus;
    e.pay = total; X.addFare(total, 'food'); rave.setPowered(true);
    say(pick(RL.thanks), headAt(rave.stage.x, rave.stage.z, 2.6), 0.8);
    hud.result(`<h3>${T('Rave â Favorita', 'The rave at the Favorita')}</h3>
      <div class="row"><span>${T('Casse sani', 'Speakers intact')}</span><span>${Math.round(e.integ)}%</span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(got)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Priestu!', 'In good time!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.4);
    hud.burst();
  }

  // ---------------------------------------------------------------- 2. the leaves
  // The friend at the rave (the caller) rides along in the lapa: boards like a fare's passenger (the seat of src/missions.js), stays on through the hunt, and gets off with the pal at the end.
  // Pay, clocks and the leash are the ones the mission always had; the clock starts when the friend is in.
  function startLeaf(slot) {
    const R = X.ROUTES['rave:leaf'][0], L = SNAP['rave:leaf'], limit = R[1] / 9 + 60;
    e = { kind: 'leaf', slot, phase: 'board', len: R[1], limit, left: limit, anchor: { x: L[0], z: L[1], name: RAVE.leaf.name }, items: [], got: 0, total: 0, t: 0, thanks: 0, pay: 0, contact: -1,
      fr: { id: slot.callers[0] !== undefined ? slot.callers[0] : -1, seated: false, next: 0, t: 0, chat: 12, prevScrape: 0, prevSpeed: 0, cool: 0, fast: 0 }, leave: 0 };
    slot.callers = [];
    if (e.fr.id < 0 || !pedestrians.info(e.fr.id)) e.fr.id = pedestrians.spawnScripted('nightboy2', car.x + Math.cos(car.th) * 2.4, car.z - Math.sin(car.th) * 2.4);
    X.calls.hideBeacon(); X.setPhase('board');
    hud.toast(T('Si paiti!', 'Off we go!'), T('I fuogghi allegri', 'The happy leaves'));
  }
  function fsay(key, delay = 0) { const L = RL.friend[key]; if (e && e.fr && L && L.length) say(pick(L), seatPos, delay); }
  function seatFriend() {
    const F = e.fr; F.seated = true; pedHit = false; pedestrians.attachTo(F.id, seatFn(0), { seated: true, blend: 0.4 });
    const R = X.ROUTES['rave:leaf'][0], L = SNAP['rave:leaf'];
    e.phase = 'go'; e.left = e.limit; X.setPhase('ride'); X.guide.path(R[2]);
    X.destBeacon.set(L[0], L[1]); X.destBeacon.show(true); X.destMarker = X.addMarker(L[0], L[1], '#7ad65a', 8, 'target');
    hud.toast(T('Va’ a via Cipressi', 'Go to via Cipressi'), T('I fuogghi allegri', 'The happy leaves')); fsay('board', 0.4);
  }
  // the friend gets out and walks (ok: to the pal; else away from the lapa)
  function friendOff(ok) {
    const F = e.fr; if (!F || F.id < 0) return;
    pedestrians.detach(F.id); F.seated = false;
    if (ok && e.contact >= 0 && pedestrians.info(e.contact)) { const c = pedestrians.info(e.contact); pedestrians.walkTo(F.id, c.x + 0.9, c.z + 0.3, 2.4); }
    else pedestrians.walkTo(F.id, car.x + Math.sin(car.th + 1.5) * 9, car.z + Math.cos(car.th + 1.5) * 9, 3.2);
  }
  function updateBoard(dt) {
    const F = e.fr; F.t += dt;
    const info = F.id >= 0 ? pedestrians.info(F.id) : null;
    if (!info) { F.id = -1; e.left = e.limit; X.setPhase('ride'); const R = X.ROUTES['rave:leaf'][0], L = SNAP['rave:leaf']; e.phase = 'go'; X.guide.path(R[2]); X.destBeacon.set(L[0], L[1]); X.destBeacon.show(true); X.destMarker = X.addMarker(L[0], L[1], '#7ad65a', 8, 'target'); return; }
    const sn = Math.sin(car.th), cs = Math.cos(car.th), side = ((info.x - car.x) * cs - (info.z - car.z) * sn) >= 0 ? 1 : -1;
    const tx = car.x + sn * -1.0 + cs * side * 1.0, tz = car.z + cs * -1.0 - sn * side * 1.0;
    F.next -= dt; if (F.next <= 0) { pedestrians.walkTo(F.id, tx, tz, 2.8); F.next = 0.25; }
    // in at the door, or at once when the lapa pulls away (the friend must not be left behind)
    if (Math.hypot(info.x - tx, info.z - tz) < 0.6 || F.t > 4 || (speed() > 3.5 && Math.hypot(car.x - e.slot.x, car.z - e.slot.z) > 12)) seatFriend();
    X.aim(0, 0, false);
    hud.set({ label: T('Acchianunu', 'Boarding'), title: e.anchor.name, sub: '', time: '', frac: null, target: null });
  }
  // the friend on the way: chatter, a knock, a hard hit
  function friendTick(dt) {
    const F = e.fr; if (!F.seated || e.phase === 'done') return;
    const sp = speed(); F.cool -= dt; F.fast -= dt; F.chat -= dt;
    if (car.scrape > 5 && F.prevScrape <= 5 && F.prevSpeed > 5 && F.cool <= 0) { F.cool = 3; fsay(F.prevSpeed > 14 ? 'crash' : 'hitWall'); }
    else if (pedHit && F.cool <= 0) { F.cool = 3; fsay('hitPed', 0.4); }
    F.prevScrape = car.scrape; F.prevSpeed = sp; pedHit = false;
    if (sp > 21 && F.fast <= 0) { F.fast = 25; fsay('fast'); }
    if (F.chat <= 0) { F.chat = 14 + Math.random() * 10; if (e.phase !== 'done') fsay('ambient'); }
  }
  function startHunt() {
    const H = X.HUNT.leaf.hunt, n = Math.min(7, H.length / 2);
    e.phase = 'hunt'; e.left = HUNT_TIME; X.guide.off(); X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null;
    e.mesh = new THREE.InstancedMesh(leafGeo(), itemMat, n); e.beams = new THREE.InstancedMesh(beamGeo, beamMat, n); e.mesh.frustumCulled = e.beams.frustumCulled = false; e.beams.renderOrder = 5;
    scene.add(e.mesh, e.beams);
    for (let i = 0; i < n; i++) { const x = H[i * 2], z = H[i * 2 + 1], y = groundAt(x, z); e.items.push({ x, z, y, ph: Math.random() * 6, got: false, marker: X.addMarker(x, z, '#7ad65a', 5, 'diamond') }); }
    e.total = n; setItems();
    hud.toast(T('Attruova i fuogghi allegri!', 'Find the happy leaves!'), RAVE.leaf.name); fsay('arrive', 0.6);
  }
  function setItems() {
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i];
      if (it.got) { _m.makeScale(0, 0, 0); e.mesh.setMatrixAt(i, _m); e.beams.setMatrixAt(i, _m); continue; }
      const t = X.now() + it.ph; _q.setFromAxisAngle(_up, t * 1.6); _p.set(it.x, it.y + Math.sin(t * 2.4) * 0.14, it.z); _m.compose(_p, _q, _s); e.mesh.setMatrixAt(i, _m);
      _p.set(it.x, it.y - 0.6, it.z); _q.identity(); _m.compose(_p, _q, _s); e.beams.setMatrixAt(i, _m);
    }
    e.mesh.instanceMatrix.needsUpdate = true; e.beams.instanceMatrix.needsUpdate = true;
  }
  function nearestLeft() { let b = null, bd = 1e12; for (const it of e.items) if (!it.got) { const d = (it.x - car.x) ** 2 + (it.z - car.z) ** 2; if (d < bd) { bd = d; b = it; } } return b || e.anchor; }
  function startHand() {
    const L = SNAP['rave:leaf'];
    e.phase = 'hand'; e.left = HAND_TIME;
    for (const it of e.items) if (it.marker) { X.dropMarker(it.marker); it.marker = null; }
    for (const it of e.items) if (!it.got) it.got = true; setItems();
    const sp = X.sideSpot({ x: L[0], z: L[1], dx: L[2], dz: L[3], w: L[4] }, L[4] / 2 + 1.6);
    e.contact = pedestrians.spawnScripted('nightboy2', sp.x, sp.z); if (e.contact >= 0) { pedestrians.face(e.contact, L[0], L[1]); pedestrians.setBounce?.(e.contact, true); }
    X.guide.to(L[0], L[1]);   // the way to the pal, worked out from where the car is
    homeBeacon.set(L[0], L[1]); homeBeacon.show(true); e.homeMarker = X.addMarker(L[0], L[1], '#6bbf59', 8, 'target');
    hud.toast(T('Portali ô cumpari', 'Take them to the pal'), e.got + ' ' + T('fuogghi', 'leaves')); fsay('hand', 0.8);
  }
  function collectLeaf() {
    for (const it of e.items) {
      if (it.got) continue;
      if ((it.x - car.x) ** 2 + (it.z - car.z) ** 2 < R_PICK2) {
        it.got = true; e.got++; if (it.marker) { X.dropMarker(it.marker); it.marker = null; }
        hud.toast('+1', T('Fuogghi ', 'Leaves ') + e.got + '/' + e.total); if (e.got % 2 === 1) fsay('leaf', 0.3);
        for (let k = 0; k < 3; k++) X.vehicle.puff(it.x + (Math.random() - 0.5), it.y + 0.8, it.z + (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.5);
      }
    }
  }
  function updateLeaf(dt) {
    const A = e.anchor;
    if (e.phase === 'board') { updateBoard(dt); return; }
    friendTick(dt);
    if (e.phase === 'go') {
      e.left -= dt; X.aim(A.x, A.z, true);
      if (e.left <= 0) { finishLeaf(false, 'late'); return; }
      if (Math.hypot(car.x - A.x, car.z - A.z) < 140) { startHunt(); return; }
      hud.set({ label: T('I fuogghi allegri', 'The happy leaves'), title: A.name, sub: dist(A.x, A.z), time: mmss(Math.max(0, e.left)), low: e.left < 40, frac: e.left / e.limit, target: A });
    } else if (e.phase === 'hunt') {
      e.left -= dt; collectLeaf(); setItems();
      if (e.left <= 0 || e.got >= e.total) { if (e.got === 0) finishLeaf(false, 'none'); else startHand(); return; }
      const nl = nearestLeft(); X.aim(nl.x, nl.z, true);
      hud.set({ label: T('Attruova i fuogghi allegri', 'Find the happy leaves'), title: T('Fuogghi ', 'Leaves ') + e.got + ' / ' + e.total, sub: A.name, time: mmss(Math.max(0, e.left)), low: e.left < 15, frac: e.left / HUNT_TIME, target: nl });
    } else if (e.phase === 'hand') {
      e.left -= dt; X.aim(A.x, A.z, true);
      if (Math.hypot(car.x - A.x, car.z - A.z) < homeBeacon.R && speed() < 6) { finishLeaf(true); return; }
      if (e.left <= 0) { finishLeaf(false, 'late'); return; }
      hud.set({ label: T('Portali ô cumpari', 'Take them to the pal'), title: A.name, sub: e.got + ' ' + T('fuogghi', 'leaves'), time: mmss(Math.max(0, e.left)), low: e.left < 15, frac: e.left / HAND_TIME, target: A });
    } else {
      X.aim(0, 0, false); hud.set({ label: e.pay > 0 ? T('Grazie!', 'Thank you!') : T('Finiu', 'Over'), title: A.name, sub: '', time: '', frac: null, target: null });
      if (e.pay > 0 && !e.leave && e.thanks < 2.2) { e.leave = 1; leaveTogether(); }
      if ((e.thanks -= dt) <= 0) X.endEvent(e.pay > 0);
    }
  }
  // the friend and the pal walk off together along the kerb
  function leaveTogether() {
    const L = SNAP['rave:leaf'], x = L[0] + L[2] * 16, z = L[1] + L[3] * 16, c = pedestrians.info(e.contact), f = e.fr && pedestrians.info(e.fr.id);
    if (c) pedestrians.walkTo(e.contact, x, z, 1.6); if (f) pedestrians.walkTo(e.fr.id, x + 0.8, z + 0.3, 1.7);
  }
  function finishLeaf(ok, why) {
    e.phase = 'done'; e.thanks = ok ? 5 : 3.6; X.setPhase('done'); X.guide.off(); X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; homeBeacon.show(false); X.dropMarker(e.homeMarker); e.homeMarker = null;
    if (!ok) { friendOff(false); fsay('fail', 0.5); hud.result(`<h3>${why === 'none' ? T('Nienti da purtari', 'Nothing to bring') : T('Taiddu assai!', 'Far too late!')}</h3>`, 3); if (why === 'none') say(pick(RL.leafNone), X.driverPos, 2.6); return; }
    friendOff(true); fsay('off', 0.6);
    const L = SNAP['rave:leaf'], base = Math.round((6 + e.got * 3.5) * 2) / 2, bonus = e.got >= e.total ? 10 : 0, total = base + bonus; e.pay = total; X.addFare(total, 'food');
    say(pick(RL.leafThanks), headAt(L[0], L[1], 2.4), 3);
    hud.result(`<h3>${T('Fuogghi allegri', 'Happy leaves')}</h3>
      <div class="row"><span>${T('Purtati', 'Brought')}</span><span>${e.got} / ${e.total}</span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Tutti quanti!', 'All of them!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.2);
    hud.burst();
  }

  const finish = (ok, why) => e.kind === 'rave' ? finishRave(ok, why) : finishLeaf(ok, why);
  function start(slot) { if (slot.kind === 'rave') startRave(slot); else startLeaf(slot); }
  function update(dt) { if (!e) return; e.t += dt; if (e.kind === 'rave') updateRave(dt); else updateLeaf(dt); }
  function stop() {
    if (!e) return;
    for (const it of e.items || []) if (it.marker) X.dropMarker(it.marker);
    if (e.mesh) { scene.remove(e.mesh, e.beams); e.mesh.geometry.dispose(); e.mesh.dispose?.(); e.beams.dispose?.(); }
    if (e.cargo) { scene.remove(e.cargo); e.cargo.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    if (e.contact >= 0) pedestrians.remove(e.contact);
    if (e.fr && e.fr.id >= 0) { pedestrians.detach(e.fr.id); pedestrians.remove(e.fr.id); }
    homeBeacon.show(false); if (e.homeMarker) X.dropMarker(e.homeMarker);
    X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; }
    X.guide.off(); e = null;
  }
  // the leash ended the mission (src/missions.js failEvent): the friend gets out and complains
  function leashed() { if (e && e.kind === 'leaf' && e.fr && e.fr.seated) { friendOff(false); fsay('fail', 0.8); } }
  return { start, update, stop, leashed, active: () => !!e, get state() { return e; } };
}
