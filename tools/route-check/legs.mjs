// Every leg of every mission that shows a pink guidance line (src/route-guide.js), from the same data the game reads.
//
// Who draws a line (grep "guide\.path\|guide\.to" src/*.js):
//   guide.path(baked polyline)  fares: tourist, taxi, pulle, night clients (nightc), urgent    src/event-fares.js   ROUTES['fare:<spot>'], ROUTES['urgent:<id>']  (the ride: pickup to destination)
//                               horns                                                           src/event-horns.js   ROUTES.horns
//                               the landfill: the road up Via Bellolampo and the track to the pit  src/event-dump.js    ROUTES.dump
//                               rave: the delivery and the ride to Via Cipressi                 src/event-rave.js    ROUTES['rave:karcere'], ROUTES['rave:leaf']
//                               races (fixed racing line, laps repeated)                        src/races.js         TRACKS[id]
//   guide.to(x, z)              food: the way back to the vendor from wherever the car is        src/event-food.js    start points = the ten HUNT items of the place
//                               pubs: the way back to the pub                                    src/event-pubs.js    start points = the errand items of PUB_ROUTES
//                               rave: the way to the pal in Via Cipressi                         src/event-rave.js    start points = the leaf items HUNT.leaf
// There is no guidance line from the car to a pickup: the person who waves is found by the beacon and the beam, not by the pink line. The food and pub hunts have no line either.
// The ride legs also have the line the guide computes when the car leaves it (replans): see check.mjs.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function loadLegs(root = ROOT) {   // root: the source tree whose data is read (default: this one; another checkout compares an older state)
  const load = rel => import(pathToFileURL(path.join(root, rel)).href);
  const [{ SNAP, ROUTES, HUNT, TRACKS }, places, { PUB_ROUTES }] = await Promise.all([load('src/event-routes.js'), load('src/event-places.js'), load('src/pub-routes.js')]);
  const kindOfFare = Object.fromEntries(places.FARE_SPOTS.map(f => ['fare:' + f.id, f.kind]));
  const baked = [], returns = [];
  for (const [key, arr] of Object.entries(ROUTES)) {
    const kind = key === 'horns' ? 'horns' : key === 'dump' ? 'dump' : key.startsWith('rave:') ? 'rave' : key.startsWith('urgent:') ? 'urgent' : kindOfFare[key] || 'fare';
    for (const [dest, len, flat] of arr) {
      const from = SNAP[key] || (key === 'horns' ? SNAP['horns:start'] : key === 'dump' ? SNAP['dump:start'] : null), to = SNAP['dest:' + dest] || (dest === 'arch' ? SNAP['horns:arch'] : dest === 'rim' ? SNAP['dump:rim'] : dest === 'site' ? SNAP['rave:site'] : dest === 'leaf' ? SNAP['rave:leaf'] : null);
      baked.push({ id: key + '>' + dest, kind, len, pts: flat, from: from ? [from[0], from[1]] : [flat[0], flat[1]], to: to ? [to[0], to[1]] : [flat[flat.length - 2], flat[flat.length - 1]], rave: kind === 'rave' });
    }
  }
  for (const [id, t] of Object.entries(TRACKS)) baked.push({ id: 'race:' + id, kind: 'race', len: t.len, pts: t.pts, from: [t.pts[0], t.pts[1]], to: [t.pts[t.pts.length - 2], t.pts[t.pts.length - 1]], closed: t.closed });
  // the way back to a place from each lost item (the guide works it out from the car's place, with the traffic graph)
  const ring = (id, kind, items, home, rave) => { for (let k = 0; k + 1 < items.length; k += 2) returns.push({ id: id + '#' + (k / 2 + 1), kind, from: [items[k], items[k + 1]], to: home, rave }); };
  for (const f of places.FOOD_PLACES) { const s = SNAP['food:' + f.id], h = HUNT[f.id]; if (s && h) ring('return:food:' + f.id, 'food', h.hunt, [s[0], s[1]]); }
  for (const [id, p] of Object.entries(PUB_ROUTES)) if (p.items && p.items.length) ring('return:pub:' + id, 'pub', p.items, [p.road[0], p.road[1]]);
  { const s = SNAP['rave:leaf'], h = HUNT.leaf; if (s && h) ring('return:rave-leaf', 'rave', h.hunt, [s[0], s[1]], true); }
  return { baked, returns, SNAP, ROUTES, HUNT, TRACKS, PUB_ROUTES, places };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { baked, returns } = await loadLegs(), by = {};
  for (const l of [...baked, ...returns]) by[l.kind] = (by[l.kind] || 0) + 1;
  console.log(baked.length, 'baked lines,', returns.length, 'return starts;', JSON.stringify(by));
}
