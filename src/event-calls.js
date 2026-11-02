// The people who call the lapa (free-roam events): a fare on the kerb, an urgent passenger, a food seller who lost the goods. Every event place is a
// slot (src/missions.js builds them from src/event-places.js and the baked src/event-routes.js). A character is spawned only when the lapa is
// near, bounces and shouts from the kerb; stop next to them to accept. Races have no caller: src/races.js puts the racers at the start line.
// createCalls(X) -> { slots, setSlots(list), update(dt, allowed) -> accepted slot | null, release(slot), clear(), hideBeacon() }
import { CALL, FRIEND } from '../assets/missions/lines.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const TOURIST_POOL = ['tourist', 'tourist2', 'tourist', 'tourist2', 'borsa', 'signora2', 'teen2', 'kid2'];
const LOCAL_POOL = ['suit', 'suit2', 'signora', 'signora2', 'borsa', 'shopper', 'ragazzo', 'ragazzo2', 'nonno', 'coppola', 'teen'];
const NIGHT_POOL = ['nightboy', 'nightgirl', 'nightboy2', 'nightgirl2', 'nightgirl3'];
const FRIEND_OUTFITS = ['giacca', 'tuta', 'mercato', 'rosanero', 'mondello'], FRIEND_CHANCE = 0.1;   // now and then a regular fare is one of the two cameo friends (assets/peds/sprites.js)
const OWNER_POOL = ['vendor', 'vendor2', 'cameriere', 'fruttivendolo', 'vendor'];
const COLORS = { fare: '#ff3d9a', urgent: '#ff4a3a', food: '#ffd24a', race: '#5ac8ff', rave: '#b16bff', leaf: '#7ad65a' };
const SPAWN_R = 210, DROP_R = 330, MAX_CALLERS = 6, ACCEPT_R = 8;
export const KIND_COLOR = COLORS;

export function createCalls(X) {
  const { car, pedestrians, speed, say } = X;
  let slots = [], tcool = 0, markT = 0, armed = false;   // armed: the lapa has been driven since the last event (starting next to a caller does not accept at once)
  const callBeacon = X.makeBeacon('#ff3d9a', 6);
  callBeacon.beam.scale.set(0.15, 1, 0.15);   // a thin column: the lapa often starts right next to it
  let beaconSlot = null;
  const present = () => { let n = 0; for (const s of slots) n += s.callers.length; return n; };
  const headOf = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: X.groundAt(car.x, car.z) + 2.4, z: car.z }; };

  function variantFor(s) {
    const night = X.isNight();
    if (s.kind === 'food') return OWNER_POOL[s.num % OWNER_POOL.length];
    if (s.kind === 'rave') return 'dj';
    if (s.kind === 'leaf') return 'nightboy2';
    if (s.kind === 'urgent') return pick(['suit', 'suit2', 'borsa', 'ragazzo', 'signora2']);
    if (s.sub === 'pulle') return night ? 'client' : pick(TOURIST_POOL);
    if (s.sub !== 'tourist' && Math.random() < FRIEND_CHANCE) return 'amico' + (1 + (Math.random() < 0.5 ? 0 : 1)) + '_' + pick(FRIEND_OUTFITS);
    if (night && Math.random() < 0.7) return pick(NIGHT_POOL);
    return s.sub === 'tourist' ? pick(TOURIST_POOL) : pick(LOCAL_POOL);
  }
  function spawn(s) {
    if (!s.kerb) {
      const sp = X.sideSpot({ x: s.x, z: s.z, dx: s.dx, dz: s.dz, w: s.w }, s.w / 2 + 1.5);
      s.kerb = { x: sp.x, z: sp.z };
    }
    const v = variantFor(s), id = pedestrians.spawnScripted(v, s.kerb.x, s.kerb.z); if (id < 0) return;
    s.friend = v.startsWith('amico') ? v.slice(0, 6) : null;   // 'amico1' / 'amico2': their own lines, here and in the ride (src/event-fares.js)
    pedestrians.face(id, s.x, s.z);
    s.callers.push(id); s.shoutT = rand(1, 4);
  }
  function despawn(s) { for (const id of s.callers) pedestrians.remove(id); s.callers.length = 0; }
  function lineFor(s) {
    if (s.friend && s.kind === 'fare') return pickLine(FRIEND[s.friend].hail);
    const L = s.kind === 'rave' ? CALL.rave : s.kind === 'leaf' ? CALL.leaf : s.kind === 'food' ? CALL.food : s.kind === 'urgent' ? [X.URGENT_DEF[s.id].say] : s.sub === 'tourist' ? CALL.tourist : s.sub === 'pulle' ? (X.isNight() ? X.FAVORITA_FLAG : CALL.pulle) : CALL.taxi;
    return pickLine(L, s);
  }
  function pickLine(L, s) {
    const l = pick(L), txt = Array.isArray(l) ? (X.lang() === 'en' && l[1] ? l[1] : l[0]) : l;
    if (!s) return txt;
    return s.kind === 'food' ? txt.replace('{items}', X.ITEMS[s.item][X.lang()]) : txt;
  }

  function update(dt, allowed) {
    let accepted = null, nearest = null, nd = 1e9;
    tcool -= dt; if (allowed && speed() > 4) armed = true;
    const doSpawn = tcool <= 0; if (doSpawn) tcool = 0.4;
    const t = X.now(), night = X.isNight();
    for (const s of slots) {
      if (s.kind === 'race') continue;
      const d = Math.hypot(car.x - s.x, car.z - s.z), ready = allowed && t >= s.coolUntil && (!s.night || night);
      if (!ready) { if (s.callers.length) despawn(s); continue; }
      if (s.callers.length) {
        if (d > DROP_R) { despawn(s); continue; }
        for (const id of s.callers) pedestrians.setBounce(id, d < 130);
        s.shoutT -= dt;
        if (s.shoutT <= 0 && d < 75) { s.shoutT = rand(6, 10); say(lineFor(s), headOf(s.callers[0]), 0); }
        if (d < nd) { nd = d; nearest = s; }
        if (armed && d < ACCEPT_R && speed() < 2.2) { s.holdT = (s.holdT || 0) + dt; if (s.holdT > 0.35) accepted = s; } else s.holdT = 0;
      } else if (doSpawn && d < SPAWN_R && present() < MAX_CALLERS && car.type !== 'sulky') spawn(s);
    }
    // the nearest caller gets the pink ring
    if (nearest && nd < 200 && !accepted) {
      if (beaconSlot !== nearest) { beaconSlot = nearest; callBeacon.set(nearest.kerb.x * 0.5 + nearest.x * 0.5, nearest.kerb.z * 0.5 + nearest.z * 0.5); callBeacon.u.uCol.value.set(COLORS[nearest.kind]); }
      callBeacon.show(true);
    } else { callBeacon.show(false); beaconSlot = null; }
    // minimap markers for what is within reach
    markT -= dt;
    if (markT <= 0) {
      markT = 1;
      for (const s of slots) {
        const d = Math.hypot(car.x - s.x, car.z - s.z), want = allowed && d < 750 && t >= s.coolUntil && (!s.night || night);
        if (want && !s.marker) s.marker = X.addMarker(s.x, s.z, COLORS[s.kind], 6);
        else if (!want && s.marker) { X.dropMarker(s.marker); s.marker = null; }
      }
    }
    return accepted;
  }
  // the event takes the callers over (the passengers stay in the world)
  function release(s) { armed = false; callBeacon.show(false); beaconSlot = null; if (s.marker) { X.dropMarker(s.marker); s.marker = null; } }
  function clear() { for (const s of slots) { despawn(s); if (s.marker) { X.dropMarker(s.marker); s.marker = null; } } callBeacon.show(false); beaconSlot = null; }
  return { get slots() { return slots; }, setSlots(l) { slots = l; }, update, release, clear, hideBeacon: () => callBeacon.show(false), armed: () => armed, disarm: () => { armed = false; } };
}
