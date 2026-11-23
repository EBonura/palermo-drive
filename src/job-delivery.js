// Tekkamancia deliveries (the director's job type 'delivery', docs/missions-director.md). Tekkamancia is an invented delivery company (a stand-in for the real ones, no brand is named
// anywhere): all its riders are busy, so its dispatcher rings the lapa. The order is a food place near the lapa (the owner stands outside as the caller, once the call is answered),
// the customer a place across town: the Palazzo di Giustizia, or one of the TAXI_DESTS. The signature run is the pani ca meusa to the tribunale.
//   call: answer it (Q, a tap, X on a pad), the route leads to the shop. Stop next to the owner: the parcel goes on the lapa (a Tekkamancia box with the place's own food on it,
//   one small merged mesh, built when the job starts and thrown away when it ends), the clock starts, the guide leads to the customer, the ring is the destination: stop in it.
//   pay: a taxi ride of the same length, plus a bonus for the time left (src/event-fares.js basePay and speedTip, without the small tips): base = (4 + len / 110) * PAY_X, to the half
//   euro; bonus = base * 0.9 * (time left / time given). The card shows the base. Late is a clean failure: the food is cold, no pay.
//   len is not baked for these rides (the baked routes are the fares'), so it is the straight line times ROAD_K, the same number gives the pay and the time (len / 8.4 + 25 seconds).
// DELIVERY_SHOPS: the FOOD_PLACES that are delivery pickups. HUNT_PLACES (src/event-places.js): the ones that keep the lost food hunt (src/event-food.js); Rocky and Nino are both. The hunt used to be at 41
// places and dominated the director; src/missions.js makes the hunt slots from HUNT_PLACES only. Nothing is built while the job is not running (setup makes plain slot records only).
// Words are [italian, english] pairs; the first is Palermitan in the owner's spelling, drafted from his rulings and passed by him on 22 Nov 2026 (the document "new mission lines to rewrite").
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAY_X } from './economy.js';
import { JOBS, KIND_COLOR } from './event-calls.js';
import { FOOD_PLACES, TAXI_DESTS, ITEMS, HUNT_PLACES } from './event-places.js';
import { SNAP } from './event-routes.js';
import { esc } from './esc.js';

const BOTH = ['rocky', 'nino'];                                                                               // and these two are delivery shops as well (pani ca meusa: the signature run)
export const DELIVERY_SHOPS = FOOD_PLACES.map(p => p.id).filter(id => !HUNT_PLACES.has(id) || BOTH.includes(id));

const COL = '#19d3b2';                              // Tekkamancia teal: the call card, the box, the poster
const GIUSTIZIA = { id: 'giustizia', name: 'Palazzo di Giustizia', lat: 38.1186, lon: 13.3519 };   // Piazza Vittorio Emanuele Orlando, 38.1186 N 13.3519 E (it.wikipedia, docs/faithfulness/landmarks.md; OSM relation r1241799); its road point is found with X.snapRoad
const ROAD_K = 1.45, V_AVG = 8.4, SLACK = 25;       // straight line to road length; the average speed the time is given for; seconds on top
const MIN_D = 350, MAX_D = 2600;                    // straight metres from the shop to the customer for an ordinary run
const TRIB_MIN = 200, TRIB_MAX = 3000, TRIB_P = 0.85;   // the tribunale for a shop that sells meusa: this range, and this often
const LOAD_T = 1.3, DROP_T = 4;                     // seconds at the shop before the clock; seconds of the result card
const OWNER_POOL = ['vendor', 'vendor2', 'cameriere', 'fruttivendolo', 'vendor'];

// ---- the words
const CARD = [   // the dispatcher on the call card: {items} {shop} {dest}
  ['I rider su tutti accupati! Ci su {items} ri {shop} ri puaittari a {dest}.', 'Every rider is busy! Order: {items} from {shop}, for {dest}.'],
  ['Ordini urgenti pi {dest}: {items}. Pigghiali nni {shop}.', 'Urgent order for {dest}: {items}. Pick up at {shop}.'],
  ['Un c’è mancu un rider libiru. I puaitti tu {items}? Vannu a {dest}.', 'No rider is free. Can you deliver the {items}? Destination: {dest}.'],
];
const SHOUT = [   // the owner on the kerb, once the call is answered
  ['Tekkamancia? Vuavutri siti? Haiu {items} pronti!', 'Tekkamancia? Is that you? I have the {items} ready!'],
  ['Ccà pi Tekkamancia! {items} cavuri, un i fari arrifriddari!', 'Here for Tekkamancia! Hot {items}, do not let them go cold!'],
];
const HAND = [['Te’, su ancora cavuri! Curri!', 'Here, they are still hot! Run!']];   // the owner when the parcel goes on
const THANKS = [['Finalmenti! Ancora cavuri, grazzi!', 'At last! Still hot, thank you!'], ['Giustu giustu, arrivasti a tiempu. Grazzi!', 'Perfect, just in time. Thank you!']];   // the customer
const L = {
  loaded: ['Ordini pigghiatu!', 'Order picked up!'], late: ['Truappu taiddu!', 'Too late!'], cold: ['U manciari s’arrifriddò: nianti picciuli', 'The food went cold: no pay'],
  label: ['Cunsigna Tekkamancia', 'Tekkamancia delivery'], note: ['cchiù u bonus pû tiempu', 'plus a time bonus'], base: ['Cunsigna', 'Delivery'], bonus: ['Bonus pû tiempu', 'Time bonus'], total: ['Tutali', 'Total'],
};   // Palermitan: the owner passed these on 22 Nov 2026
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fill = (s, o) => s.replace('{items}', o.items).replace('{shop}', o.shop).replace('{dest}', o.dest);

// the parcel: a Tekkamancia box with the place's own colours on it, one geometry, vertex colours (the shapes of src/event-food.js are not exported, so a box and a tray)
function parcelGeo(c0, c1) {
  const part = (w, h, d, x, y, z, hex) => {
    let g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  return mergeGeometries([part(0.9, 0.62, 0.8, 0, 0.31, 0, COL), part(0.94, 0.07, 0.84, 0, 0.62, 0, '#0b3a34'), part(0.5, 0.1, 0.42, 0.05, 0.71, 0, c0), part(0.38, 0.07, 0.3, 0.05, 0.79, 0, c1), part(0.9, 0.1, 0.02, 0, 0.3, 0.41, '#ffffff')]);
}

export default function setup(X) {
  const { car, T, hud, eur, speed, say, groundAt, pedestrians } = X;
  const tx = a => T(a[0], a[1]);                                  // a pair in the language shown
  JOBS.add('delivery'); KIND_COLOR.delivery = COL;

  // ---- the shops: one slot each, shaped like the ones mkSlot makes (src/missions.js), on the baked road point of the food place
  const slots = [];
  FOOD_PLACES.forEach((p, i) => {
    if (!DELIVERY_SHOPS.includes(p.id)) return;
    const s = SNAP['food:' + p.id]; if (!s) return;
    const it = ITEMS[p.item], callLine = SHOUT.map(l => [l[0].replace('{items}', it.it), l[1].replace('{items}', it.en)]);   // the owner's own item in both languages (src/event-calls.js only fills {items} for the hunt)
    slots.push({ id: 'delivery:' + p.id, kind: 'delivery', sub: 'delivery', key: 'food:' + p.id, num: i, item: p.item, who: p.who, g: p.g, name: p.name, ped: OWNER_POOL[i % OWNER_POOL.length], callLine,
      x: s[0], z: s[1], dx: s[2], dz: s[3], w: s[4], road: s[5], callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null,
      leash: () => { const r = run; return r ? { a: [r.slot.x, r.slot.z], b: [r.dest.x, r.dest.z], r: Math.max(520, r.d * 0.35 + 250) } : { a: [car.x, car.z], b: [car.x, car.z], r: 520 }; } });
  });
  for (const s of slots) X.slots.push(s);

  // ---- the customers: the tribunale (its road point found once) and the TAXI_DESTS that have one
  let trib = null;
  const tribunale = () => {
    if (!trib) { const [vx, vz] = X.proj(GIUSTIZIA.lat, GIUSTIZIA.lon), sn = X.snapRoad(vx, vz); trib = { id: GIUSTIZIA.id, name: GIUSTIZIA.name, x: sn.x, z: sn.z, dx: sn.dx, dz: sn.dz, w: sn.w }; }
    return trib;
  };
  const taxi = TAXI_DESTS.filter(d => SNAP['dest:' + d.id] && d.id !== 'aeroporto');   // (the airfield is the urgent run's)
  const destOf = d => { const s = SNAP['dest:' + d.id]; return { id: d.id, name: d.name, x: s[0], z: s[1], dx: s[2], dz: s[3], w: s[4] }; };
  // the customer for a shop: the tribunale for meusa when it is a sensible distance, else a random one of the others in range
  function customer(s) {
    const t = tribunale(), dt = Math.hypot(t.x - s.x, t.z - s.z);
    if (s.item === 'meusa' && dt >= TRIB_MIN && dt <= TRIB_MAX && Math.random() < TRIB_P) return t;
    const c = []; for (const d of taxi) { const o = destOf(d), r = Math.hypot(o.x - s.x, o.z - s.z); if (r >= MIN_D && r <= MAX_D) c.push(o); }
    if (dt >= MIN_D && dt <= MAX_D) c.push(t);
    return c.length ? pick(c) : null;
  }
  const pay = len => Math.round((4 + len / 110) * PAY_X * 2) / 2;   // the taxi fare of that length (src/event-fares.js basePay)

  // ---- the call
  let run = null;   // the running job
  X.director.add('delivery', far => {
    const s = X.director.place('delivery', far, k => !!customer(k)); if (!s) return null;
    const dest = customer(s), d = Math.hypot(dest.x - s.x, dest.z - s.z), len = d * ROAD_K, it = ITEMS[s.item];
    s.quoted = { dest, d, len, pay: pay(len) };
    const f = { items: X.lang() === 'en' ? it.en : it.it, shop: s.name, dest: dest.name };
    return { slot: s, ped: X.director.face(s), col: COL, tag: tx(['Cunsigna', 'Delivery']), who: 'Tekkamancia', line: fill(tx(pick(CARD)), f), pay: s.quoted.pay, note: tx(L.note), where: '→ ' + dest.name, drop: () => { s.quoted = null; s.offerPed = null; s.offerV = -1; } };
  });

  // ---- the event
  const beacon = X.destBeacon, hudO = { label: '', title: '', sub: '', time: '', low: false, frac: 0, target: null, ledger: null };
  X.kinds.delivery = {
    start(slot) {
      const q = slot.quoted || (() => { const dest = customer(slot) || tribunale(), d = Math.hypot(dest.x - slot.x, dest.z - slot.z); return { dest, d, len: d * ROAD_K, pay: pay(d * ROAD_K) }; })();
      slot.quoted = null;
      const it = ITEMS[slot.item], g = parcelGeo(it.c[0], it.c[1]), m = new THREE.MeshBasicMaterial({ vertexColors: true }), mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false; mesh.rotation.order = 'YXZ'; mesh.scale.setScalar(0.001); mesh.visible = true; X.scene.add(mesh);
      run = { slot, dest: q.dest, d: q.d, len: q.len, base: q.pay, limit: q.len / V_AVG + SLACK, left: 0, phase: 'load', t: 0, mesh, g, m, owner: slot.callers.slice(), customer: -1, marker: null, total: 0, ok: false, said: false };
      slot.callers = [];   // the owner stays in the world until the job is over (src/event-fares.js does the same with its passengers)
      run.left = run.limit;
      X.calls.hideBeacon(); X.setPhase('board');
      for (const id of run.owner) pedestrians.face(id, car.x, car.z);
      if (run.owner.length) say(tx(pick(HAND)), () => { const i = pedestrians.info(run.owner[0]); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; }, 0.2);
      hud.toast(tx(L.loaded), run.dest.name);
    },
    update(dt) {
      const r = run; if (!r) return;
      r.t += dt; place(r);
      if (r.phase === 'load') {
        r.mesh.scale.setScalar(Math.min(1, r.t / 0.35) ** 0.6);   // the parcel pops onto the lapa
        hudO.label = tx(L.label); hudO.title = r.slot.name; hudO.sub = ''; hudO.time = ''; hudO.low = false; hudO.frac = null; hudO.target = null; hudO.ledger = null; hud.set(hudO); X.aim(0, 0, false);
        if (r.t >= LOAD_T) {
          r.phase = 'ride'; r.t = 0; X.setPhase('ride');
          X.guide.to(r.dest.x, r.dest.z); beacon.set(r.dest.x, r.dest.z); beacon.show(true); r.marker = X.addMarker(r.dest.x, r.dest.z, COL, 8, 'target');
          r.ledger = [tx(L.base) + ' ' + eur(r.base)];
        }
        return;
      }
      if (r.phase === 'ride') {
        r.left -= dt;
        const d = Math.hypot(car.x - r.dest.x, car.z - r.dest.z), m = Math.max(0, r.left);
        hudO.label = tx(L.label); hudO.title = r.dest.name; hudO.sub = ITEMS[r.slot.item][X.lang()] + '  ·  ' + (d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m');
        hudO.time = Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'); hudO.low = m < 12; hudO.frac = r.left / r.limit; hudO.target = r.dest; hudO.ledger = r.ledger; hud.set(hudO);
        X.aim(r.dest.x, r.dest.z, true);
        if (d < beacon.R && speed() < 2.0) finish(r, true); else if (r.left <= 0) finish(r, false);
        return;
      }
      if ((r.drop -= dt) <= 0) X.endEvent(r.ok);   // the result card is up
    },
    stop() {
      const r = run; if (!r) return; run = null;
      X.scene.remove(r.mesh); r.g.dispose(); r.m.dispose();
      for (const id of r.owner) pedestrians.remove(id);
      if (r.customer >= 0) pedestrians.remove(r.customer);
      beacon.show(false); if (r.marker) X.dropMarker(r.marker); X.guide.off();
    },
  };
  addEventListener('pd-drowned', () => { if (run && run.phase === 'ride') finish(run, false); });   // the sea ends the run like the clock

  // the parcel rides behind the seat, yaw and lift as the passengers do (src/missions.js seatFn)
  function place(r) {
    const vs = X.vehicle && X.vehicle.seats, sv = vs && vs.length ? vs[0] : null, sn = Math.sin(car.th), cs = Math.cos(car.th), sz = (sv ? sv.z : -1.1) - 0.1, sy = (sv ? sv.y : 1.04) - 0.55;
    r.mesh.position.set(car.x + sn * sz, groundAt(car.x, car.z) + car.lift + sy, car.z + cs * sz); r.mesh.rotation.y = car.th;
  }
  function finish(r, ok) {
    r.phase = 'drop'; r.ok = ok; r.drop = ok ? DROP_T : 3.2; X.setPhase('drop');
    beacon.show(false); if (r.marker) { X.dropMarker(r.marker); r.marker = null; } X.guide.off(); X.aim(0, 0, false);
    if (!ok) {
      r.mesh.visible = false;
      hud.result(`<h3>${esc(tx(L.late))}</h3><div class="row"><span>${esc(tx(L.cold))}</span></div>`, 3);
      return;
    }
    const bonus = Math.round(r.base * 0.9 * clamp(r.left / r.limit, 0, 1) * 2) / 2, total = r.base + bonus; r.total = total; X.addFare(total);
    r.mesh.visible = false;
    const d = r.dest, sp = X.sideSpot({ x: d.x, z: d.z, dx: d.dx, dz: d.dz, w: d.w }, d.w / 2 + 1.5);   // the customer waits on the kerb and takes the parcel
    if (sp) { r.customer = pedestrians.spawnScripted(pick(['suit', 'suit2', 'signora', 'ragazzo', 'shopper', 'nonno']), sp.x, sp.z); if (r.customer >= 0) { pedestrians.face(r.customer, car.x, car.z); say(tx(pick(THANKS)), () => { const i = pedestrians.info(r.customer); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: groundAt(car.x, car.z) + 2.4, z: car.z }; }, 0.4); } }
    hud.result(`<h3>${esc(d.name)}</h3>
      <div class="row"><span>${esc(tx(L.base))}</span><span>${eur(r.base)}</span></div>
      <div class="row"><span>${esc(tx(L.bonus))}</span><span>+ ${eur(bonus)}</span></div>
      <div class="row tot"><span>${esc(tx(L.total))}</span><span>${eur(total)}</span></div>`, 4.2);
    if (bonus >= r.base * 0.5) hud.burst();
  }
}
