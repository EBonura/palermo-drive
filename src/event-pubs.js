// The pub errand, a night event: the pub has lost its stock ("Mi hanno rubato le casse di Moretti!"). A timed hunt for the lost crates spread over the
// streets around it (positions baked into src/pub-routes.js by assets/missions/snap-pubs.mjs), then bring them back to the door. Each venue has its own
// item, caller lines and pay (src/pub-places.js). Offered by src/pubs.js (a caller outside the door, only in the venue's hours); the guide arrow, the
// minimap markers, the card and the toasts are the ones of the other events (src/missions.js X, src/event-hud.js).
// createErrand(X) -> { start(venue), update(dt), stop(), active() }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEMS } from './pub-places.js';
import { esc } from './esc.js';

const R_PICK2 = 3.6 * 3.6;
const pick = a => a[(Math.random() * a.length) | 0];

// one coloured merged geometry per item shape, about a metre across (the beams light them from afar)
function itemGeo(shape) {
  const col = (g, h) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(h), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const P = [];
  if (shape === 'crate') {   // a red plastic crate of green bottles with gold caps
    P.push(col(new THREE.BoxGeometry(0.62, 0.32, 0.42).translate(0, 0.16, 0), '#c8312a'), col(new THREE.BoxGeometry(0.66, 0.05, 0.46).translate(0, 0.33, 0), '#8a1f1a'));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = -0.2 + i * 0.2, z = -0.1 + j * 0.2;
      P.push(col(new THREE.CylinderGeometry(0.05, 0.055, 0.28, 8).translate(x, 0.5, z), '#1f6b3a'), col(new THREE.CylinderGeometry(0.02, 0.05, 0.1, 8).translate(x, 0.69, z), '#1f6b3a'), col(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8).translate(x, 0.76, z), '#e0b84a'));
    }
  } else if (shape === 'bottle') {   // three amber bottles with black labels in a cardboard case
    P.push(col(new THREE.BoxGeometry(0.6, 0.25, 0.3).translate(0, 0.12, 0), '#a9803f'));
    for (let i = 0; i < 3; i++) { const x = -0.18 + i * 0.18; P.push(col(new THREE.CylinderGeometry(0.06, 0.065, 0.34, 8).translate(x, 0.42, 0), '#9a5a14'), col(new THREE.CylinderGeometry(0.025, 0.06, 0.12, 8).translate(x, 0.65, 0), '#9a5a14'), col(new THREE.BoxGeometry(0.13, 0.14, 0.135).translate(x, 0.4, 0), '#161212'), col(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).translate(x, 0.73, 0), '#d8b848')); }
  } else if (shape === 'flask') {   // a straw-bound wine flask with red wine
    P.push(col(new THREE.SphereGeometry(0.28, 12, 10).scale(1, 1.1, 1).translate(0, 0.32, 0), '#7a1822'), col(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 8).translate(0, 0.74, 0), '#7a1822'), col(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8).translate(0, 0.92, 0), '#d8b848'),
      col(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12).translate(0, 0.12, 0), '#c8a45a'), col(new THREE.TorusGeometry(0.29, 0.025, 6, 14).rotateX(Math.PI / 2).translate(0, 0.3, 0), '#8a6a30'));
  } else if (shape === 'vinyl') {   // a record leaning out of its sleeve
    P.push(col(new THREE.BoxGeometry(0.66, 0.66, 0.03).translate(0, 0.4, 0), '#2a2a30'), col(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 20).rotateX(Math.PI / 2).translate(0.12, 0.46, 0.02), '#0c0c0e'), col(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 14).rotateX(Math.PI / 2).translate(0.12, 0.46, 0.022), '#d94abf'));
  } else if (shape === 'keg') {   // a steel beer keg with two bands
    P.push(col(new THREE.CylinderGeometry(0.27, 0.27, 0.62, 14).translate(0, 0.31, 0), '#aeb4ba'), col(new THREE.TorusGeometry(0.27, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, 0.08, 0), '#6c7278'), col(new THREE.TorusGeometry(0.27, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, 0.54, 0), '#6c7278'), col(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8).translate(0, 0.65, 0), '#2a2a2e'));
  } else if (shape === 'guitar') {   // an electric guitar leaning up, body and neck
    P.push(col(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 14).scale(1, 1, 1.25).rotateX(Math.PI / 2).translate(0, 0.3, 0), '#c8312a'), col(new THREE.CylinderGeometry(0.15, 0.15, 0.085, 12).rotateX(Math.PI / 2).translate(0, 0.52, 0), '#c8312a'), col(new THREE.BoxGeometry(0.07, 0.6, 0.05).translate(0, 0.9, 0), '#7a4a22'), col(new THREE.BoxGeometry(0.1, 0.14, 0.05).translate(0, 1.26, 0), '#2a2a2e'), col(new THREE.BoxGeometry(0.12, 0.04, 0.1).translate(0, 0.32, 0.03), '#d8d4c8'));
  } else if (shape === 'mug') {   // a glass beer mug with a foam head and a handle
    P.push(col(new THREE.CylinderGeometry(0.17, 0.15, 0.4, 12).translate(0, 0.2, 0), '#e8a82a'), col(new THREE.CylinderGeometry(0.175, 0.175, 0.1, 12).translate(0, 0.45, 0), '#f6f2e4'), col(new THREE.TorusGeometry(0.1, 0.03, 6, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.17, 0.22, 0), '#d8dce0'));
  } else if (shape === 'barrel') {   // half-barrel of a table: wood staves, iron hoops
    P.push(col(new THREE.CylinderGeometry(0.34, 0.3, 0.7, 14).translate(0, 0.35, 0), '#8a5e30'), col(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 14).translate(0, 0.72, 0), '#b88a50'), col(new THREE.TorusGeometry(0.32, 0.025, 6, 14).rotateX(Math.PI / 2).translate(0, 0.14, 0), '#3a3a3e'), col(new THREE.TorusGeometry(0.325, 0.025, 6, 14).rotateX(Math.PI / 2).translate(0, 0.56, 0), '#3a3a3e'));
  } else P.push(col(new THREE.SphereGeometry(0.4, 10, 8).translate(0, 0.5, 0), '#e0b84a'));
  const g = mergeGeometries(P); g.translate(0, 0.62, 0); const k = shape === 'vinyl' ? 2.1 : shape === 'guitar' ? 1.2 : 1.5; g.scale(k, k, k); return g;
}

export function createErrand(X) {
  const { scene, car, vehicle, T, hud, eur, speed, say, groundAt } = X;
  let e = null;
  const beamGeo = new THREE.CylinderGeometry(0.3, 0.5, 60, 8, 1, true).translate(0, 30, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const itemMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const homeBeacon = X.makeBeacon('#6bbf59', 8); homeBeacon.beam.scale.set(0.35, 1, 0.35);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  const lineOf = l => (Array.isArray(l) ? (X.lang() === 'en' && l[1] ? l[1] : l[0]) : l);
  const T2 = a => T(a[0], a[1]);
  const headOf = () => { const p = e.venue.caller ? X.pedestrians.info(e.venue.caller) : null; return p ? { x: p.x, y: p.y + 1.95, z: p.z } : { x: e.venue.door.x + e.venue.n.x * 1.7, y: groundAt(e.venue.door.x, e.venue.door.z) + 2.2, z: e.venue.door.z + e.venue.n.z * 1.7 }; };

  function setItems() {
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i];
      if (it.got) { _m.makeScale(0, 0, 0); e.mesh.setMatrixAt(i, _m); e.beams.setMatrixAt(i, _m); continue; }
      const t = X.now() + it.ph, y = it.y + Math.sin(t * 2.4) * 0.14;
      _q.setFromAxisAngle(_up, t * 1.6); _p.set(it.x, y, it.z); _m.compose(_p, _q, _s); e.mesh.setMatrixAt(i, _m);
      _p.set(it.x, it.y - 0.6, it.z); _q.identity(); _m.compose(_p, _q, _s); e.beams.setMatrixAt(i, _m);
    }
    e.mesh.instanceMatrix.needsUpdate = true; e.beams.instanceMatrix.needsUpdate = true;
  }
  function nearestLeft() {
    let b = null, bd = 1e12;
    for (const it of e.items) if (!it.got) { const d = (it.x - car.x) ** 2 + (it.z - car.z) ** 2; if (d < bd) { bd = d; b = it; } }
    return b || e.venue.slot;
  }

  function start(venue) {
    const E = venue.def.errand, item = ITEMS[E.item], I = venue.route.items;
    e = { venue, E, item, phase: 'hunt', got: 0, items: [], total: I.length / 2, t: 0, thanks: 0, pay: 0 };
    e.time = Math.max(90, Math.min(200, Math.round(venue.route.tourLen / 8.5 + 25))); e.left = e.time;
    e.mesh = new THREE.InstancedMesh(itemGeo(item.shape), itemMat, e.total); e.beams = new THREE.InstancedMesh(beamGeo, beamMat, e.total);
    e.mesh.frustumCulled = e.beams.frustumCulled = false; e.beams.renderOrder = 5;
    scene.add(e.mesh, e.beams);
    for (let k = 0; k + 1 < I.length; k += 2) e.items.push({ x: I[k], z: I[k + 1], y: groundAt(I[k], I[k + 1]), ph: Math.random() * 6, got: false, marker: X.addMarker(I[k], I[k + 1], '#ffb02e', 5, 'diamond') });
    X.calls.hideBeacon();
    X.setPhase('hunt');
    hud.toast(T2(E.start), venue.def.name);
    say(pick(E.call), headOf, 0);
  }

  function startReturn() {
    e.phase = 'return'; X.setPhase('return');
    for (const it of e.items) if (!it.got && it.marker) { X.dropMarker(it.marker); it.marker = null; }
    for (const it of e.items) it.got = true;                      // what is left on the road is gone
    setItems();
    const v = e.venue;
    if (e.got === 0) { say(pick(e.E.none), headOf, 0); finish(false); return; }
    homeBeacon.set(v.slot.x, v.slot.z); homeBeacon.show(true); e.homeMarker = X.addMarker(v.slot.x, v.slot.z, '#6bbf59', 8, 'target');
    hud.toast(T((e.item.art === 'le' ? 'Riportale da ' : 'Riportali da ') + v.def.name, 'Take them back to ' + v.def.name), e.got + ' ' + e.item.it);
  }

  function finish(ok) {
    e.phase = 'done'; e.thanks = 5.5; X.setPhase('done');
    homeBeacon.show(false); X.dropMarker(e.homeMarker); e.homeMarker = null;
    if (!ok) { hud.result(`<h3>${T('Nienti ri puoitari', 'Nothing to bring back')}</h3>`, 3); e.pay = 0; return; }
    const base = Math.round(e.got * e.E.pay * 2) / 2, bonus = e.got >= e.total ? e.E.bonus : 0, total = base + bonus; e.pay = total;
    X.addFare(total, 'food');   // 'food' (not a fare): the pay counts in the wallet but not in the ride count
    say(pick(e.E.thanks), headOf, 0.6);
    X.pubs?.cheer(e.venue);
    hud.result(`<h3>${esc(e.venue.def.name)}</h3>
      <div class="row"><span>${T('Puoitati narrè', 'Brought back')} ${e.item.it}</span><span>${e.got} / ${e.total}</span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Tutti quanti!', 'All of them!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 4.2);
    hud.burst();
  }

  function collect() {
    for (const it of e.items) {
      if (it.got) continue;
      const dx = it.x - car.x, dz = it.z - car.z;
      if (dx * dx + dz * dz < R_PICK2) {
        it.got = true; e.got++;
        if (it.marker) { X.dropMarker(it.marker); it.marker = null; }
        hud.toast('+1', e.item.it + ' ' + e.got + '/' + e.total);
        for (let k = 0; k < 3; k++) vehicle.puff(it.x + (Math.random() - 0.5), it.y + 0.8, it.z + (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), 0.5);
      }
    }
  }

  function update(dt) {
    if (!e) return;
    e.t += dt;
    if (e.phase !== 'done') { collect(); setItems(); }
    const v = e.venue;
    if (e.phase === 'hunt') {
      e.left -= dt;
      if (e.left <= 0 || e.got >= e.total) startReturn();
      else {
        const nl = nearestLeft(); X.aim(nl.x, nl.z, true);
        const m = Math.max(0, e.left);
        hud.set({ label: T('Attruova ' + e.item.it, 'Find the ' + e.item.en), title: e.item.it + '  ' + e.got + ' / ' + e.total, sub: v.def.name, time: Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), low: m < 15, frac: e.left / e.time, target: nl });
      }
    } else if (e.phase === 'return') {
      X.aim(v.slot.x, v.slot.z, true);
      hud.set({ label: T('Puoitali narrè', 'Take them back'), title: v.def.name, sub: e.got + ' ' + e.item.it, time: '', frac: null, target: v.slot });
      if (Math.hypot(car.x - v.slot.x, car.z - v.slot.z) < homeBeacon.R && speed() < 6) finish(true);
    } else {
      X.aim(0, 0, false);
      hud.set({ label: T('Grazie!', 'Thank you!'), title: v.def.name, sub: '', time: '', frac: null, target: null });
      if ((e.thanks -= dt) <= 0) X.endEvent(e.pay > 0);
    }
  }
  function stop() {
    if (!e) return;
    for (const it of e.items) if (it.marker) X.dropMarker(it.marker);
    scene.remove(e.mesh, e.beams); e.mesh.geometry.dispose(); e.mesh.dispose?.(); e.beams.dispose?.();
    homeBeacon.show(false); if (e.homeMarker) X.dropMarker(e.homeMarker);
    e = null;
  }
  return { start, update, stop, active: () => !!e, get state() { return e; } };
}
