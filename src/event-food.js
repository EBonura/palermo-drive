// The food collect/chase event: "Benny ha perso le sue pizzette! Aiutalo a ritrovarle". Phase 1, a timed hunt for a dozen items scattered in the
// streets near the place (positions baked in src/event-routes.js HUNT). Phase 2, a runaway scooter drops the rest as it rides its route (drive
// into it and it drops one early). Phase 3, bring everything back to the place. One event type, many places (src/event-places.js FOOD_PLACES),
// each with its own item. Items are one InstancedMesh with a light column each; the scooter is a vehicle model from src/vehicle-models.js.
// createFood(X) -> { start(slot), update(dt), stop(), active() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOOD } from '../assets/missions/lines.js';
import { esc } from './esc.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const HUNT_N = 12, CHASE_N = 8, R_PICK2 = 3.6 * 3.6;
const HUNT_TIME = 105, SCOOTER_V = 14.5;

// one coloured merged geometry per item shape, about a metre across
function itemGeo(shape, c0, c1) {
  const col = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  const at = (g, x, y, z) => g.translate(x, y, z);
  const P = [];
  switch (shape) {
    case 'disc': P.push(col(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 16), c0), col(at(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 16), 0, 0.09, 0), c1)); break;
    case 'cone': P.push(col(at(new THREE.ConeGeometry(0.46, 0.95, 12), 0, 0.1, 0), c0), col(at(new THREE.TorusGeometry(0.3, 0.05, 6, 12).rotateX(Math.PI / 2), 0, 0.05, 0), c1)); break;
    case 'slab': P.push(col(new THREE.BoxGeometry(1.0, 0.16, 0.72), c0), col(at(new THREE.BoxGeometry(0.82, 0.05, 0.56), 0, 0.1, 0), c1)); break;
    case 'log': P.push(col(new THREE.CylinderGeometry(0.2, 0.2, 0.95, 10).rotateZ(Math.PI / 2), c0), col(at(new THREE.CylinderGeometry(0.205, 0.205, 0.1, 10).rotateZ(Math.PI / 2), 0.2, 0, 0), c1)); break;
    case 'tube': P.push(col(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 10).rotateZ(Math.PI / 2).rotateY(0.4), c0), col(at(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 10).rotateZ(Math.PI / 2).rotateY(0.4), 0.46, 0, 0.19), c1), col(at(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 10).rotateZ(Math.PI / 2).rotateY(0.4), -0.46, 0, -0.19), c1)); break;
    case 'dome': P.push(col(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c0), col(at(new THREE.SphereGeometry(0.11, 8, 6), 0, 0.5, 0), c1)); break;
    case 'ball': P.push(col(new THREE.SphereGeometry(0.42, 12, 10), c0), col(new THREE.TorusGeometry(0.4, 0.05, 6, 14).rotateX(Math.PI / 2), c1)); break;
    default: P.push(col(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 0.6, 1), c0), col(at(new THREE.SphereGeometry(0.28, 10, 6).scale(1, 0.5, 1), 0, 0.28, 0), c1)); // bun
  }
  const g = mergeGeometries(P); g.translate(0, 0.62, 0); g.scale(1.5, 1.5, 1.5); return g;
}

export function createFood(X) {
  const { scene, car, pedestrians, vehicle, T, hud, eur, speed, say, groundAt } = X;
  let e = null;                                                 // the running event
  const beamGeo = new THREE.CylinderGeometry(0.3, 0.5, 60, 8, 1, true).translate(0, 30, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const itemMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const homeBeacon = X.makeBeacon('#6bbf59', 8); homeBeacon.beam.scale.set(0.35, 1, 0.35);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  function setItems(meshItems, beams, list) {
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.got) { _m.makeScale(0, 0, 0); meshItems.setMatrixAt(i, _m); beams.setMatrixAt(i, _m); continue; }
      const t = X.now() + it.ph, y = it.y + Math.sin(t * 2.4) * 0.14;
      _q.setFromAxisAngle(_up, t * 1.6); _p.set(it.x, y, it.z); _m.compose(_p, _q, _s); meshItems.setMatrixAt(i, _m);
      _p.set(it.x, it.y - 0.6, it.z); _q.identity(); _m.compose(_p, _q, _s); beams.setMatrixAt(i, _m);
    }
    meshItems.instanceMatrix.needsUpdate = true; beams.instanceMatrix.needsUpdate = true;
  }
  function addItem(x, z, list) {
    const y = groundAt(x, z), it = { x, z, y, ph: Math.random() * 6, got: false, marker: X.addMarker(x, z, '#ffd24a', 5) };
    const i = list.length; list.push(it); return i;
  }
  function start(slot) {
    const P = slot.food, item = X.ITEMS[slot.item], H = X.HUNT[slot.pid];
    e = { slot, P, item, phase: 'hunt', left: HUNT_TIME, items: [], got: 0, huntGot: 0, chaseGot: 0, scooter: null, chase: null, cap: HUNT_N + CHASE_N, t: 0, thanks: 0, restT: 0 };
    e.mesh = new THREE.InstancedMesh(itemGeo(item.shape, item.c[0], item.c[1]), itemMat, HUNT_N + CHASE_N);
    e.beams = new THREE.InstancedMesh(beamGeo, beamMat, HUNT_N + CHASE_N);
    e.mesh.frustumCulled = e.beams.frustumCulled = false; e.beams.renderOrder = 5;
    e.mesh.count = e.beams.count = 0;
    scene.add(e.mesh, e.beams);
    for (let k = 0; k + 1 < H.hunt.length && e.items.length < HUNT_N; k += 2) addItem(H.hunt[k], H.hunt[k + 1], e.items);
    e.mesh.count = e.beams.count = e.items.length;
    e.total = e.items.length + CHASE_N;
    X.calls.hideBeacon();
    X.setPhase('hunt');
    hud.toast(T('Cerca ' + item.it + '!', 'Find the ' + item.en + '!'), slot.name);
  }

  // ---- the scooter and its route
  function startChase() {
    e.phase = 'chase'; X.setPhase('chase');
    const H = X.HUNT[e.slot.pid].chase, n = H.length / 2, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(H[i * 2] - H[i * 2 - 2], H[i * 2 + 1] - H[i * 2 - 1]));
    let L = cum[n - 1], bi = 0, bd = 1e12;                                  // nearest route point to the lapa
    for (let i = 0; i < n; i++) { const d = (H[i * 2] - car.x) ** 2 + (H[i * 2 + 1] - car.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    const fwd = L - cum[bi] > cum[bi];                                       // run towards the longer side
    const pts = []; if (fwd) for (let i = bi; i < n; i++) pts.push(H[i * 2], H[i * 2 + 1]); else for (let i = bi; i >= 0; i--) pts.push(H[i * 2], H[i * 2 + 1]);
    const c2 = [0]; for (let i = 1; i < pts.length / 2; i++) c2.push(c2[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
    const rig = vehicle.buildVehicleModel({ type: 'motorino', livery: 'verde' }); rig.root.visible = true; scene.add(rig.root);
    const rem = c2[c2.length - 1], s0 = Math.min(70, rem * 0.15);
    e.chase = { pts, cum: c2, len: rem, s: s0, v: 0, spin: 0, drops: [], next: 0, rig, ended: false, cool: 0, bump: 0, voiced: 0 };
    for (let k = 1; k <= CHASE_N; k++) e.chase.drops.push(s0 + (rem - s0 - 40) * k / CHASE_N);
    chaseAt(e.chase, s0, _o); e.chase.x = _o.x; e.chase.z = _o.z;   // a position from the start, for the arrow and the voice
    X.guide.path(pts);                                                 // the escape route: the arrow follows it and the minimap draws it
    e.left = rem / SCOOTER_V + 14;
    hud.toast(T('Un motorino scappa con il resto!', 'A scooter runs off with the rest!'), T('Inseguilo', 'Chase it'));
    say(pick(FOOD.thief)[0], () => ({ x: e.chase.x, y: groundAt(e.chase.x, e.chase.z) + 2.2, z: e.chase.z }), 0.4);
  }
  function chaseAt(c, s, out) {
    const p = c.pts, cum = c.cum; let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const seg = cum[i + 1] - cum[i] || 1, u = clamp((s - cum[i]) / seg, 0, 1);
    out.x = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * u; out.z = p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * u; out.th = Math.atan2(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]);
  }
  const _o = { x: 0, z: 0, th: 0 };
  function updateChase(dt) {
    const c = e.chase;
    if (!c.ended) {
      const d = Math.hypot(car.x - c.x, car.z - c.z);
      const want = d > 150 ? 9 : d < 45 ? SCOOTER_V + 2.5 : SCOOTER_V;
      c.v += clamp(want - c.v, -6 * dt, 5 * dt); c.s += c.v * dt; c.spin += c.v * dt / 0.25;
      chaseAt(c, Math.min(c.s, c.len), _o); c.x = _o.x; c.z = _o.z;
      c.rig.root.position.set(c.x, groundAt(c.x, c.z), c.z); c.rig.root.rotation.y = _o.th;
      c.rig.pose({ pitch: 0, roll: 0, lean: 0, steer: 0, spin: c.spin, t: X.now(), speed: c.v });
      // drops along the route, and one early when the lapa rams it
      c.cool -= dt;
      if (c.next < c.drops.length && (c.s >= c.drops[c.next] || (d < 4.2 && speed() > c.v - 1 && c.cool <= 0 && c.next < c.drops.length - 1 && c.s > 30))) { c.cool = 2.2; drop(c.x, c.z); c.next++; }
      if (c.cool > 2.15) hud.toast(T('Preso!', 'Got him!'));
      c.voiced -= dt; if (c.voiced <= 0 && d < 60) { c.voiced = 7; say(pick(FOOD.thief)[0], () => ({ x: c.x, y: groundAt(c.x, c.z) + 2.2, z: c.z }), 0); }
      if (c.s >= c.len) { c.ended = true; scene.remove(c.rig.root); c.rig.dispose?.(); for (let i = 0; i < 6; i++) vehicle.puff(c.x + (Math.random() - 0.5), groundAt(c.x, c.z) + 0.6, c.z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.9); e.left = Math.min(e.left, 14); }
    }
    X.aim(c.ended ? nearestLeft().x : c.x, c.ended ? nearestLeft().z : c.z, true);
    if (e.left <= 0 || (c.ended && e.items.every(i => i.got))) startReturn();
  }
  function drop(x, z) {
    if (e.items.length >= e.cap) return;
    addItem(x, z, e.items); e.mesh.count = e.beams.count = e.items.length;
  }
  function nearestLeft() {
    let b = null, bd = 1e12;
    for (const it of e.items) if (!it.got) { const d = (it.x - car.x) ** 2 + (it.z - car.z) ** 2; if (d < bd) { bd = d; b = it; } }
    return b || { x: e.slot.x, z: e.slot.z };
  }
  function startReturn() {
    if (e.chase && !e.chase.ended) { scene.remove(e.chase.rig.root); e.chase.rig.dispose?.(); e.chase.ended = true; }
    e.phase = 'return'; X.setPhase('return'); X.guide.off();
    for (const it of e.items) if (!it.got && it.marker) { X.dropMarker(it.marker); it.marker = null; }
    // what is left on the road is gone
    for (const it of e.items) if (!it.got) it.got = true;
    setItems(e.mesh, e.beams, e.items);
    if (e.got === 0) { say(pick(FOOD.none)[0], () => ({ x: e.slot.kerb.x, y: groundAt(e.slot.kerb.x, e.slot.kerb.z) + 2, z: e.slot.kerb.z }), 0); finish(false); return; }
    homeBeacon.set(e.slot.x, e.slot.z); homeBeacon.show(true); e.homeMarker = X.addMarker(e.slot.x, e.slot.z, '#6bbf59', 8);
    hud.toast(T('Riportale da ' + e.slot.who, 'Take them back to ' + e.slot.who), e.got + ' ' + e.item.it);
  }

  function finish(ok) {
    e.phase = 'done'; e.thanks = 5.5; X.setPhase('done');
    homeBeacon.show(false); X.dropMarker(e.homeMarker); e.homeMarker = null;
    if (!ok) { hud.result(`<h3>${T('Niente da riportare', 'Nothing to bring back')}</h3>`, 3); e.pay = 0; return; }
    const base = Math.round(e.got * 1.5 * 2) / 2, bonus = e.got >= e.total ? 10 : 0;
    const total = base + bonus; e.pay = total;
    X.addFare(total, 'food');
    say(pick(FOOD.thanks)[0], () => ({ x: e.slot.kerb.x, y: groundAt(e.slot.kerb.x, e.slot.kerb.z) + 2, z: e.slot.kerb.z }), 0.6);
    hud.result(`<h3>${esc(e.slot.name)}</h3>
      <div class="row"><span>${T('Ritrovate', 'Found')} ${e.item.it}</span><span>${e.got} / ${e.total}</span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Tutte quante!', 'All of them!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.2);
    hud.burst();
  }


  function collect() {
    const sp = speed();
    for (const it of e.items) {
      if (it.got) continue;
      const dx = it.x - car.x, dz = it.z - car.z;
      if (dx * dx + dz * dz < R_PICK2) {
        it.got = true; e.got++; if (e.phase === 'hunt') e.huntGot++; else e.chaseGot++;
        if (it.marker) { X.dropMarker(it.marker); it.marker = null; }
        hud.toast('+1', e.item.it + ' ' + e.got + '/' + e.total);
        for (let k = 0; k < 3; k++) vehicle.puff(it.x + (Math.random() - 0.5), it.y + 0.8, it.z + (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.5);
      }
    }
  }

  function update(dt) {
    if (!e) return;
    e.t += dt;
    if (e.phase !== 'done') { collect(); setItems(e.mesh, e.beams, e.items); }
    if (e.phase === 'hunt') {
      e.left -= dt;
      const rest = e.items.filter(i => !i.got).length;
      if (e.left <= 0 || (e.huntGot >= HUNT_N && rest === 0)) { e.left0 = e.left; startChase(); }
      const nl = nearestLeft(); X.aim(nl.x, nl.z, true);
      const m = Math.max(0, e.left);
      hud.set({ label: T('Cerca ' + e.item.it, 'Find the ' + e.item.en), title: e.item.it + '  ' + e.got + ' / ' + HUNT_N, sub: e.slot.name, time: Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), low: m < 15, frac: e.left / HUNT_TIME, target: nl });
    } else if (e.phase === 'chase') {
      e.left -= dt; updateChase(dt);
      if (!e) return;
      if (e.chase.ended) { X.guide.off(); const nl = nearestLeft(); X.aim(nl.x, nl.z, true); } else X.aim(e.chase.x, e.chase.z, true);
      hud.set({ label: T('Insegui il motorino', 'Chase the scooter'), title: e.item.it + '  ' + e.got + ' / ' + e.total, sub: e.slot.name, time: Math.ceil(Math.max(0, e.left)) + 's', low: e.left < 8, frac: null, target: e.chase.ended ? nearestLeft() : e.chase });
    } else if (e.phase === 'return') {
      X.aim(e.slot.x, e.slot.z, true);
      hud.set({ label: T('Riportale indietro', 'Take them back'), title: e.slot.who, sub: e.got + ' ' + e.item.it, time: '', frac: null, target: e.slot });
      if (Math.hypot(car.x - e.slot.x, car.z - e.slot.z) < homeBeacon.R && speed() < 6) finish(true);
    } else if (e.phase === 'done') {
      X.aim(0, 0, false);
      hud.set({ label: T('Grazie!', 'Thank you!'), title: e.slot.who, sub: '', time: '', frac: null, target: null });
      if ((e.thanks -= dt) <= 0) X.endEvent(e.pay > 0);
    }
  }
  function stop() {
    if (!e) return;
    for (const it of e.items) if (it.marker) X.dropMarker(it.marker);
    scene.remove(e.mesh, e.beams); e.mesh.geometry.dispose(); e.mesh.dispose?.(); e.beams.dispose?.();
    if (e.chase && !e.chase.ended) { scene.remove(e.chase.rig.root); e.chase.rig.dispose?.(); }
    homeBeacon.show(false); if (e.homeMarker) X.dropMarker(e.homeMarker);
    X.guide.off();
    e = null;
  }
  return { start, update, stop, active: () => !!e, get got() { return e ? e.got : 0; }, get items() { return e ? e.items : []; }, get state() { return e; } };
}
