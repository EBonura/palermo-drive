// Rides from anywhere: a taxi passenger or an urgent run that does not wait on one of the fixed kerbs of src/event-places.js but is put on a road near the lapa, wherever it is.
// The fixed kerbs are few (18 taxi spots, 4 urgent ones) and most of the city has none within reach, so a call for a ride could only ring in the centre; with these the
// director (src/mission-director.js) can ring one in any quarter. The ride itself is the usual one (src/event-fares.js): only the pick-up and the route are different.
//   pick-up      a point on a street 180 to 420 m from the lapa, ahead of it when one is found there: an ordinary street (not a fast road, a bridge, a service road or a
//                pedestrian one) from the traffic graph, which has the roads of every loaded tile (the baked road list of src/missions.js covers the old centre only)
//   destination  a taxi ride goes to one of the four nearest of TAXI_DESTS that are 700 to 3800 m away (the far quarters have none nearer); an urgent run is one of the four of URGENT (its own words and its own destination)
//   route        there is no baked one: the length is the straight line times ROAD_K (what the roads add, about) and the guide finds the way as the lapa drives (guide.to)
// createStreetFares(X) -> { taxi(), urgent() }: each returns a slot ready to be offered (the same shape as the slots of src/missions.js, with `street: true` and
//   `ride: [destination id, length, null]` for fares.quote), or null when no street or no destination fits. One slot of each is kept and moved: they are in X.slots, so that
//   src/event-calls.js puts the passenger on the kerb once the call is answered. They are not listed among the missions (src/missions.js events() leaves `street` slots out).
import { TAXI_DESTS, URGENT } from './event-places.js';
import { SNAP } from './event-routes.js';

const NEAR = 180, FAR = 420, ROAD_K = 1.4;
const RIDE = [700, 3800], URGENT_RIDE = [1200, 6500];   // metres, as the crow flies, from the pick-up to the destination
const AIRFIELD = 'aeroporto';                            // only the urgent run goes there

export function createStreetFares(X) {
  const { car, T } = X, EF = { e: null, t: 0, d: 0 };
  const mk = (id, kind, sub) => ({ id, kind, sub, name: '', key: null, street: true, ride: null, x: 0, z: 0, dx: 0, dz: 1, w: 6, road: '', callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null });
  const taxiSlot = mk('fare:street', 'fare', 'taxi'), urgentSlot = mk('urgent:' + URGENT[0].id, 'urgent', 'urgent');
  X.slots.push(taxiSlot, urgentSlot);
  const dests = TAXI_DESTS.filter(d => SNAP['dest:' + d.id]).map(d => ({ id: d.id, name: d.name, x: SNAP['dest:' + d.id][0], z: SNAP['dest:' + d.id][1] }));
  // a street for the pick-up: a few tries ahead of the lapa, then any way round
  function street(s) {
    const tr = X.traffic, G = tr && tr.debug && tr.debug.G; if (!G || !tr.graph) return false;
    const th = car.th;
    for (let n = 0; n < 14; n++) {
      const a = th + (n < 9 ? (Math.random() - 0.5) * 2.2 : Math.random() * 6.283), d = NEAR + Math.random() * (FAR - NEAR), qx = car.x + Math.sin(a) * d, qz = car.z + Math.cos(a) * d;
      if (!tr.graph.edgeFor(qx, qz, 0, 0, 70, EF)) continue;
      const e = EF.e; if (e.ped || e.fast || e.fr || e.br || e.svc || e.dead || e.rank < 2 || e.rank > 5 || e.w < 5 || e.len < 12) continue;
      const t = Math.max(4, Math.min(e.len - 4, EF.t)), x = G.NX[e.a] + e.dx * t, z = G.NZ[e.a] + e.dz * t, dd = Math.hypot(x - car.x, z - car.z);
      if (dd < NEAR * 0.8 || dd > FAR * 1.25) continue;
      if (X.slots.some(o => o !== s && !o.street && Math.hypot(o.x - x, o.z - z) < 40)) continue;   // not on top of another caller's kerb
      s.x = x; s.z = z; s.dx = e.dx; s.dz = e.dz; s.w = e.w; s.road = e.name || ''; s.kerb = null; s.coolUntil = 0;
      return true;
    }
    return false;
  }
  const from = (s, id, lim) => { const d = dests.find(q => q.id === id), l = d ? Math.hypot(d.x - s.x, d.z - s.z) : -1; return l >= lim[0] && l <= lim[1] ? l : -1; };
  function taxi() {
    const s = taxiSlot; if (s.callers.length || !street(s)) return null;
    const c = dests.filter(d => d.id !== AIRFIELD && from(s, d.id, RIDE) > 0); if (!c.length) return null;
    c.sort((a, b) => from(s, a.id, RIDE) - from(s, b.id, RIDE));
    const d = c[(Math.random() * Math.min(4, c.length)) | 0];
    s.name = s.road || T('Un passiggeri', 'A passenger'); s.ride = [d.id, from(s, d.id, RIDE) * ROAD_K, null];
    return s;
  }
  function urgent() {
    const s = urgentSlot; if (s.callers.length || !street(s)) return null;
    const c = URGENT.filter(u => from(s, u.to, URGENT_RIDE) > 0); if (!c.length) return null;
    const u = c[(Math.random() * c.length) | 0];
    s.id = 'urgent:' + u.id; s.name = u.name; s.ride = [u.to, from(s, u.to, URGENT_RIDE) * ROAD_K, null];   // the id is the urgent run's own: its words and its clock go by it (src/event-fares.js)
    return s;
  }
  return { taxi, urgent };
}
