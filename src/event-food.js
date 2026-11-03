// The food collect event: "Benny ha perso le sue pizzette! Aiutalo a ritrovarle". Phase 1, a timed hunt for ten items lying close together in the streets
// round the place (positions baked in src/event-routes.js HUNT by assets/missions/snap-places.mjs). Phase 2, bring everything back to the place. (The runaway
// scooter that used to drop the rest was taken out: it confused the players.) One event type, many places (src/event-places.js FOOD_PLACES), each with its
// own item. Items are one InstancedMesh with a light column each.
// createFood(X) -> { start(slot), update(dt), stop(), active() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOOD } from '../assets/missions/lines.js';
import { esc } from './esc.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const HUNT_N = 10, R_PICK2 = 3.6 * 3.6;
const HUNT_TIME = 100;

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
  const iname = it => T(it.it, it.en);   // the name of the item in the language shown (the card's label already says it that way)
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
    const y = groundAt(x, z), it = { x, z, y, ph: Math.random() * 6, got: false, marker: X.addMarker(x, z, '#ffd24a', 5, 'diamond') };
    const i = list.length; list.push(it); return i;
  }
  function start(slot) {
    const P = slot.food, item = X.ITEMS[slot.item], H = X.HUNT[slot.pid];
    e = { slot, P, item, phase: 'hunt', left: HUNT_TIME, items: [], got: 0, huntGot: 0, cap: HUNT_N, t: 0, thanks: 0, restT: 0 };
    e.mesh = new THREE.InstancedMesh(itemGeo(item.shape, item.c[0], item.c[1]), itemMat, HUNT_N);
    e.beams = new THREE.InstancedMesh(beamGeo, beamMat, HUNT_N);
    e.mesh.frustumCulled = e.beams.frustumCulled = false; e.beams.renderOrder = 5;
    e.mesh.count = e.beams.count = 0;
    scene.add(e.mesh, e.beams);
    for (let k = 0; k + 1 < H.hunt.length && e.items.length < HUNT_N; k += 2) addItem(H.hunt[k], H.hunt[k + 1], e.items);
    e.mesh.count = e.beams.count = e.items.length;
    e.total = e.items.length;
    X.calls.hideBeacon();
    X.setPhase('hunt');
    hud.toast(T('Attruova ' + item.it + '!', 'Find the ' + item.en + '!'), slot.name);
  }

  function nearestLeft() {
    let b = null, bd = 1e12;
    for (const it of e.items) if (!it.got) { const d = (it.x - car.x) ** 2 + (it.z - car.z) ** 2; if (d < bd) { bd = d; b = it; } }
    return b || { x: e.slot.x, z: e.slot.z };
  }
  function startReturn() {
    e.phase = 'return'; X.setPhase('return'); X.guide.off();
    for (const it of e.items) if (!it.got && it.marker) { X.dropMarker(it.marker); it.marker = null; }
    // what is left on the road is gone
    for (const it of e.items) if (!it.got) it.got = true;
    setItems(e.mesh, e.beams, e.items);
    if (e.got === 0) { say(pick(FOOD.none)[0], () => ({ x: e.slot.kerb.x, y: groundAt(e.slot.kerb.x, e.slot.kerb.z) + 2, z: e.slot.kerb.z }), 0); finish(false); return; }
    homeBeacon.set(e.slot.x, e.slot.z); homeBeacon.show(true); e.homeMarker = X.addMarker(e.slot.x, e.slot.z, '#6bbf59', 8, 'target');
    hud.toast(T('Puaittali a ' + e.slot.who, 'Take them back to ' + e.slot.who), e.got + ' ' + iname(e.item));
  }

  function finish(ok) {
    e.phase = 'done'; e.thanks = 5.5; X.setPhase('done');
    homeBeacon.show(false); X.dropMarker(e.homeMarker); e.homeMarker = null;
    if (!ok) { hud.result(`<h3>${T('Nienti ri puaittari', 'Nothing to bring back')}</h3>`, 3); e.pay = 0; return; }
    const base = Math.round(e.got * 1.5 * 2) / 2, bonus = e.got >= e.total ? 10 : 0;
    const total = base + bonus; e.pay = total;
    X.addFare(total, 'food');
    say(pick(FOOD.thanks)[0], () => ({ x: e.slot.kerb.x, y: groundAt(e.slot.kerb.x, e.slot.kerb.z) + 2, z: e.slot.kerb.z }), 0.6);
    hud.result(`<h3>${esc(e.slot.name)}</h3>
      <div class="row"><span>${T('Attruvati', 'Found')} ${iname(e.item)}</span><span>${e.got} / ${e.total}</span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Tutti quanti!', 'All of them!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.2);
    hud.burst();
  }


  function collect() {
    const sp = speed();
    for (const it of e.items) {
      if (it.got) continue;
      const dx = it.x - car.x, dz = it.z - car.z;
      if (dx * dx + dz * dz < R_PICK2) {
        it.got = true; e.got++; e.huntGot++;
        if (it.marker) { X.dropMarker(it.marker); it.marker = null; }
        hud.toast('+1', iname(e.item) + ' ' + e.got + '/' + e.total);
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
      if (e.left <= 0 || (e.huntGot >= HUNT_N && rest === 0)) { startReturn(); return; }
      const nl = nearestLeft(); X.aim(nl.x, nl.z, true);
      const m = Math.max(0, e.left);
      hud.set({ label: T('Attruova ' + e.item.it, 'Find the ' + e.item.en), title: iname(e.item) + '  ' + e.got + ' / ' + HUNT_N, sub: e.slot.name, time: Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), low: m < 15, frac: e.left / HUNT_TIME, target: nl });
    } else if (e.phase === 'return') {
      X.aim(e.slot.x, e.slot.z, true);
      hud.set({ label: T('Puaittali narrè', 'Take them back'), title: e.slot.who, sub: e.got + ' ' + iname(e.item), time: '', frac: null, target: e.slot });
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
    homeBeacon.show(false); if (e.homeMarker) X.dropMarker(e.homeMarker);
    X.guide.off();
    e = null;
  }
  return { start, update, stop, active: () => !!e, get got() { return e ? e.got : 0; }, get items() { return e ? e.items : []; }, get state() { return e; } };
}
