// The tourist carrozze: horse carriages that go round a loop between the Cattedrale, the Quattro Canti and the Teatro Massimo at a walking horse's pace, with a coachman on the box
// (and the Sicilian cart, the carretto, with its carrettiere on a short loop in the market quarter, Piazza Sant'Anna to the Vucciria: one at a time, same system, no passengers)
// and one to three tourists on the seat. Owned by the traffic work; driven by src/traffic.js (createCarrozze(env, T)). The carriage is an ordinary traffic vehicle (type 'carrozza',
// model 'carrozzaTour', which follows the closed plan T.spawnTour makes); the people are scripted pedestrians (src/pedestrians.js) attached to its seats, so they are the same
// LPC sprites as the crowd. Their balloons ("Giru in carrozza, signuri!") are src/vendors.js.
const rand = (a, b) => a + Math.random() * (b - a);
const TOURISTS = ['tourist', 'tourist2'];
// seats in the carriage's own frame: x to its left (the model's +x), z forward, y the hip height (the coachman's box top, the seat cushion)
const BOX = { x: 0, z: -1.05, y: 1.5 }, BENCH = [{ x: 0.25, z: -2.25, y: 1.45 }, { x: -0.25, z: -2.25, y: 1.45 }];
const MAX_CARRIAGES = 2, MAX_CARTS = 1;
const CART_BOX = { x: 0, z: -1.05, y: 1.14 };   // the carrettiere's plank on the Sicilian cart (the model's frame: CARRETTO in assets/traffic/models.js, centred by SH)

export function createCarrozze(env, T) {
  const { camera } = env, vs = T.vs;
  let peds = null, time = 0, tickT = 0, next = 4, nextCart = 9;
  const crews = new Map();   // vehicle -> sprite ids

  function seatFn(v, seat, look) {
    return out => {
      const c = Math.cos(v.h), s = Math.sin(v.h);
      out.x = v.x + c * seat.x + s * seat.z; out.z = v.z - s * seat.x + c * seat.z;
      out.y = T.baseY(v) + seat.y + Math.sin(time * 6.5 + seat.x * 9) * 0.012 * Math.min(1, v.v / 2);
      out.th = v.h + (look ? Math.sin(time * 0.35 + look) * 0.55 : 0);   // the tourists look about them
    };
  }
  function crew(v) {
    if (!peds) return;
    const ids = [];
    const add = (variant, seat, look) => { const id = peds.spawnScripted(variant, v.x, v.z); if (id >= 0) { peds.setSize?.(id, 0.84); peds.attachTo(id, seatFn(v, seat, look), { seated: true }); ids.push(id); } };
    add('cocchiere', BOX, 0);
    const n = 1 + (Math.random() < 0.75 ? 1 : 0);
    for (let i = 0; i < n; i++) add(TOURISTS[(Math.random() * TOURISTS.length) | 0], BENCH[i], rand(1, 6));
    crews.set(v, ids);
  }
  function crewCart(v) {
    if (!peds) return;
    const id = peds.spawnScripted('carrettiere', v.x, v.z); if (id < 0) return;
    peds.setSize?.(id, 0.84); peds.attachTo(id, seatFn(v, CART_BOX, 0), { seated: true }); crews.set(v, [id]);
  }
  function drop(v) { for (const id of crews.get(v) || []) peds.remove(id); crews.delete(v); }

  function update(dt) {
    time += dt; tickT += dt; if (tickT < 0.5) return; tickT = 0;
    if (!peds) return;
    for (const v of [...crews.keys()]) if (v.dead || vs.indexOf(v) < 0) drop(v);
    let n = 0, nc = 0; for (const v of vs) if (v.tour && !v.dead) { if (v.name === 'carretto') nc++; else n++; }
    if (n < MAX_CARRIAGES && time >= next) {
      const v = T.spawnTour();
      if (v) { crew(v); next = time + rand(18, 40); } else next = time + 3;
    }
    if (nc < MAX_CARTS && time >= nextCart) {
      const v = T.spawnTour('carretto');
      if (v) { crewCart(v); nextCart = time + rand(40, 90); } else nextCart = time + 4;
    }
  }
  return { update, bindPedestrians(api) { peds = api; }, crews };
}
