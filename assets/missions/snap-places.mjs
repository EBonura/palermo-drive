// Bakes src/event-routes.js from src/event-places.js and assets/missions/lines.js, using the world tiles (world/tiles/*.json).
//   node assets/missions/snap-places.mjs            (about a minute; prints the resolved places)
// For every event place: the nearest drivable road point (and the road's direction, width and name), the baked taxi routes, the hunt items and the
// hunt items of every food place (ten, close together: the scooter chase was taken out), and the race tracks. Nothing here runs in the game.
import fs from 'fs';
import path from 'path';
import { ROOT, loadNet, snap, nodeNear, route, pts, plen, simplify, proj } from './roadnet.mjs';
import { FOOD_PLACES, TAXI_DESTS, FARE_SPOTS, PULLE_DEST, URGENT, RACES, RAVE, HORNS } from '../../src/event-places.js';
import { DESTS } from './lines.js';

const net = loadNet();
console.log('network', net.nodes.length, 'nodes', net.edges.length, 'edges');
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0, (s & 0xffffff) / 0x1000000); };

const SNAP = {}, ROUTES = {}, HUNT = {}, TRACKS = {}, report = [];
function place(id, lat, lon, name) {
  const [x, z] = proj(lat, lon), s = snap(net, x, z, name ? { name } : {});
  SNAP[id] = [r1(s.x), r1(s.z), r2(s.dx), r2(s.dz), s.w, s.n || ''];
  report.push({ id, road: s.n || '(unnamed ' + s.k + ')', off: Math.round(s.d), x: r1(s.x), z: r1(s.z) });
  return s;
}
const flat = P => P.flatMap(p => [r1(p[0]), r1(p[1])]);
const nodeOf = s => nodeNear(net, s);

// ---- food places: snapped point and the hunt items around it, ten of them within about 200 m, in a loop of the neighbourhood
const pointsAround = (cx, cz, r0, r1_) => {
  const out = [];
  for (const e of net.edges) {
    if (!net.main(e.a) || e.r.w < 5) continue;
    const A = net.nodes[e.a], B = net.nodes[e.b], n = Math.max(1, Math.round(e.l / 25));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, d = Math.hypot(x - cx, z - cz);
      if (d >= r0 && d <= r1_) out.push({ x, z, d, ang: Math.atan2(z - cz, x - cx), w: e.r.w, e });
    }
  }
  return out;
};
for (const f of FOOD_PLACES) {
  const s = place('food:' + f.id, f.lat, f.lon, f.onStreet);
  const rnd = rng(hash(f.id)), N = 10, cands = pointsAround(s.x, s.z, 50, 230), chosen = [];
  const near = (c, d) => chosen.every(q => Math.hypot(q.x - c.x, q.z - c.z) >= d);
  const radii = [80, 130, 190];
  for (let k = 0; k < N; k++) {
    const a0 = -Math.PI + (k / N) * 2 * Math.PI, a1 = a0 + 2 * Math.PI / N, want = radii[k % 3];
    const inSec = cands.filter(c => c.ang >= a0 && c.ang < a1 && near(c, 40));
    if (inSec.length) { inSec.sort((p, q) => Math.abs(p.d - want) - Math.abs(q.d - want)); chosen.push(inSec[Math.min(inSec.length - 1, Math.floor(rnd() * 2))]); }
  }
  for (let spacing = 40; chosen.length < N && spacing >= 20; spacing -= 10) {
    const rest = cands.filter(c => near(c, spacing)); rest.sort(() => rnd() - 0.5);
    while (chosen.length < N && rest.length) { const c = rest.pop(); if (near(c, spacing)) chosen.push(c); }
  }
  // the order the items are taken in: nearest neighbour from the place, so the baked list reads as a tour of the quarter
  const tour = []; { let cur = { x: s.x, z: s.z }; const left = chosen.slice(); while (left.length) { let bi = 0, bd = 1e12; left.forEach((c, i) => { const d = Math.hypot(c.x - cur.x, c.z - cur.z); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; tour.push(cur); } }
  HUNT[f.id] = { hunt: flat(tour.map(c => [c.x, c.z])) };
  console.log(f.id.padEnd(14), 'items', tour.length, 'farthest', Math.round(Math.max(...tour.map(c => Math.hypot(c.x - s.x, c.z - s.z)))), 'm');
}

// ---- fares
const foodDests = DESTS.map(d => ({ id: d.id, name: d.name, lat: d.lat, lon: d.lon }));
for (const d of foodDests) place('dest:' + d.id, d.lat, d.lon);
for (const d of TAXI_DESTS) place('dest:' + d.id, d.lat, d.lon);
// night clients' streets; one that is only a pedestrian way in the tiles (Via Bandiera) is snapped and routed in a network with that street added (dest.ped: a RegExp source)
const netFor = {};
for (const f of FARE_SPOTS) if (f.dest) {
  const d = f.dest, nx = d.ped ? (netFor[d.id] = loadNet({ extra: new RegExp(d.ped) })) : net, [x, z] = proj(d.lat, d.lon), s = snap(nx, x, z, { name: d.onStreet });
  SNAP['dest:' + d.id] = [r1(s.x), r1(s.z), r2(s.dx), r2(s.dz), s.w, s.n || '']; report.push({ id: 'dest:' + d.id, road: s.n, off: Math.round(s.d), x: r1(s.x), z: r1(s.z) });
}
place('dest:' + PULLE_DEST.id, PULLE_DEST.lat, PULLE_DEST.lon);
function routeBetween(aId, bId, nx = net) {
  const A = SNAP[aId], B = SNAP[bId];
  const sa = snap(nx, A[0], A[1]), sb = snap(nx, B[0], B[1]);
  const p = route(nx, nodeNear(nx, sa), nodeNear(nx, sb)); if (!p) return null;
  const P = [[A[0], A[1]], ...pts(nx, p), [B[0], B[1]]];
  return { len: plen(P), pts: simplify(P, 6) };
}
for (const f of FARE_SPOTS) {
  place('fare:' + f.id, f.lat, f.lon);
  const out = [];
  const pool = f.kind === 'tourist' ? foodDests : f.kind === 'taxi' ? TAXI_DESTS : f.dest ? [f.dest] : [PULLE_DEST];
  const lo = f.kind === 'tourist' ? 300 : f.kind === 'taxi' ? 1200 : 0, hi = f.kind === 'tourist' ? 1700 : f.kind === 'taxi' ? 7000 : 1e9;
  const cs = [];
  for (const d of pool) { const r = routeBetween('fare:' + f.id, 'dest:' + d.id, netFor[d.id] || net); if (r && r.len >= lo && r.len <= hi) cs.push({ d, r }); }
  const mid = f.kind === 'tourist' ? 800 : 3000;
  cs.sort((p, q) => Math.abs(p.r.len - mid) - Math.abs(q.r.len - mid));
  for (const c of cs.slice(0, f.kind === 'pulle' ? 1 : 4)) out.push([c.d.id, Math.round(c.r.len), flat(c.r.pts)]);
  ROUTES['fare:' + f.id] = out;
  console.log('fare', f.id.padEnd(14), out.map(o => o[0] + ':' + o[1]).join(' '));
}
for (const u of URGENT) {
  place('urgent:' + u.id, u.from.lat, u.from.lon);
  const r = routeBetween('urgent:' + u.id, 'dest:' + u.to);
  ROUTES['urgent:' + u.id] = r ? [[u.to, Math.round(r.len), flat(r.pts)]] : [];
  console.log('urgent', u.id.padEnd(14), r ? Math.round(r.len) + ' m' : 'NO ROUTE');
}

// ---- the rave missions: the centro sociale, the rave site, Via Cipressi; the route between them; the leaves around Via Cipressi
// The dance floor is off the road, in the woods (src/rave-ground.js): its track leaves Viale Ercole at RAVE.access (the road point 'rave:mouth', dropped from the output) and runs
// straight to the middle of the floor. The place of the missions, SNAP['rave:site'], is on the floor, 7 m short of its middle on the track's axis, looking along the track;
// the baked routes run on the road to the mouth and then up the track to it.
for (const k of ['karcere', 'leaf']) { const r = RAVE[k]; place('rave:' + k, r.lat, r.lon, r.onStreet); }
const raveMouth = place('rave:mouth', RAVE.access.lat, RAVE.access.lon, RAVE.access.onStreet);
const [raveFx, raveFz] = proj(RAVE.site.lat, RAVE.site.lon), raveL = Math.hypot(raveFx - raveMouth.x, raveFz - raveMouth.z), raveUx = (raveFx - raveMouth.x) / raveL, raveUz = (raveFz - raveMouth.z) / raveL;
const raveP = [raveFx - raveUx * 7, raveFz - raveUz * 7];
SNAP['rave:site'] = [r1(raveP[0]), r1(raveP[1]), r2(raveUx), r2(raveUz), 6, raveMouth.n || ''];
report.push({ id: 'rave:site', road: raveMouth.n, off: Math.round(Math.hypot(raveP[0] - raveMouth.x, raveP[1] - raveMouth.z)), x: r1(raveP[0]), z: r1(raveP[1]) });
// the road from a place to the mouth: through the end of the mouth's street segment that is on the way (the nearest graph node is often the far end, and the arrow would overshoot and double back)
const mouthLeg = id => {
  const A = SNAP[id], na = nodeOf(snap(net, A[0], A[1])); let best = null;
  for (const nb of [raveMouth.e.a, raveMouth.e.b]) {
    const p = route(net, na, nb); if (!p) continue;
    const P = [[A[0], A[1]], ...pts(net, p), [raveMouth.x, raveMouth.z]], L = plen(P); if (!best || L < best.L) best = { L, P };
  }
  return best && simplify(best.P, 6);
};
for (const [id, from, to] of [['rave:karcere', 'rave:karcere', true], ['rave:leaf', 'rave:leaf', false]]) {
  const leg = mouthLeg(from); let out = [];
  if (leg) { const P = to ? [...leg, raveP] : [raveP, ...leg.slice().reverse()]; out = [[to ? 'site' : 'leaf', Math.round(plen(P)), flat(P)]]; }
  ROUTES[id] = out; console.log(id.padEnd(14), out.length ? out[0][1] + ' m' : 'NO ROUTE');
}
delete SNAP['rave:mouth'];
{
  const s = SNAP['rave:leaf'], cx = s[0], cz = s[1], rnd = rng(hash('leaf')), chosen = [], N = 7;
  const cands = pointsAround(cx, cz, 25, 150).filter(c => c.w >= 4);
  const near = (c, d) => chosen.every(q => Math.hypot(q.x - c.x, q.z - c.z) >= d);
  cands.sort(() => rnd() - 0.5);
  for (const c of cands) { if (chosen.length >= N) break; if (near(c, 38)) chosen.push(c); }
  const tour = []; { let cur = { x: cx, z: cz }; const left = chosen.slice(); while (left.length) { let bi = 0, bd = 1e12; left.forEach((c, i) => { const d = Math.hypot(c.x - cur.x, c.z - cur.z); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; tour.push(cur); } }
  HUNT.leaf = { hunt: flat(tour.map(c => [c.x, c.z])) };
  console.log('leaf items', tour.length, 'farthest', Math.round(Math.max(...tour.map(c => Math.hypot(c.x - cx, c.z - cz)))), 'm');
}

// ---- the horns mission: the citizen in Piazza Pretoria, the arch (a road point just inside the arch of Via Chiappara al Carmine and the direction of travel towards Ballarò), the route.
// Via Maqueda is a pedestrian way in the tiles (not in the drivable network), so this uses its own network with Via Maqueda added; the other bakes are not touched.
{
  const netH = loadNet({ extra: /^Via Maqueda$/ }), put = (id, lat, lon, name) => { const [x, z] = proj(lat, lon), s = snap(netH, x, z, name ? { name } : {}); SNAP[id] = [r1(s.x), r1(s.z), r2(s.dx), r2(s.dz), s.w, s.n || '']; report.push({ id, road: s.n, off: Math.round(s.d), x: r1(s.x), z: r1(s.z) }); return s; };
  const a = put('horns:start', HORNS.start.lat, HORNS.start.lon, HORNS.start.onStreet);
  const g = put('horns:arch', HORNS.arch.lat, HORNS.arch.lon, HORNS.arch.onStreet), [tx, tz] = proj(HORNS.arch.toLat, HORNS.arch.toLon);
  const fwd = g.dx * (tx - g.x) + g.dz * (tz - g.z) >= 0, dx = fwd ? g.dx : -g.dx, dz = fwd ? g.dz : -g.dz;   // towards Ballarò
  SNAP['horns:arch'] = [r1(g.x), r1(g.z), r2(dx), r2(dz), g.w, g.n || ''];
  const na = nodeNear(netH, a), nb = nodeNear(netH, g), p = route(netH, na, nb);
  if (p) { const P = [[a.x, a.z], ...pts(netH, p), [g.x, g.z]]; ROUTES['horns'] = [['arch', Math.round(plen(P)), flat(simplify(P, 4))]]; console.log('horns route', Math.round(plen(P)), 'm; gate', SNAP['horns:arch'].join(' '), 'start', SNAP['horns:start'].join(' ')); }
  else { ROUTES['horns'] = []; console.log('horns NO ROUTE'); }
}

// ---- race tracks
function follow(start, name, len, hint) {
  const path = [start]; let cur = start, total = 0, last = null;
  while (total < len) {
    let best = null, bs = -Infinity;
    for (const { to, e, fwd } of net.adj[cur]) {
      if (!(e.r.n || '').includes(name) || (e.one && !fwd) || path.includes(to)) continue;
      const A = net.nodes[cur], B = net.nodes[to], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1;
      const sc = last ? (dx * last[0] + dz * last[1]) / l / Math.hypot(last[0], last[1]) : hint ? (dx * hint[0] + dz * hint[1]) / l : 0;
      if (sc > bs) { bs = sc; best = { to, l, v: [dx, dz] }; }
    }
    if (!best) break; path.push(best.to); total += best.l; last = best.v; cur = best.to;
  }
  return path;
}
const widthOf = path => { const w = []; for (let i = 1; i < path.length; i++) w.push(net.adj[path[i - 1]].find(a => a.to === path[i]).e.r.w); w.sort((a, b) => a - b); return w[w.length >> 1] || 8; };
for (const r of RACES) {
  let P, closed = false, w = 8, nodesPath = null;
  if (r.track) { P = r.track.map(p => p.slice()); w = 9; }
  else if (r.kind === 'sprint') {
    // the carriageway that runs in `dir`: try every node of that road near `near`, keep the longest straight run
    let bestP = [];
    for (let i = 0; i < net.nodes.length; i++) {
      if (Math.hypot(net.nodes[i][0] - r.near[0], net.nodes[i][1] - r.near[1]) > 250 || !net.adj[i].some(a => (a.e.r.n || '').includes(r.road))) continue;
      const p = follow(i, r.road, r.len, r.dir); if (p.length > 1) { const L = plen(pts(net, p)); if (L > (bestP.L || 0)) { bestP = p; bestP.L = L; } }
    }
    nodesPath = bestP; P = pts(net, nodesPath); w = widthOf(nodesPath);
  } else {
    const A = nodeOf(snap(net, r.loopA[0], r.loopA[1], { name: r.road })), B = nodeOf(snap(net, r.loopB[0], r.loopB[1], { name: r.road }));
    const p1 = route(net, A, B, { oneway: true }), p2 = route(net, B, A, { oneway: true });
    if (!p1 || !p2) { console.log('NO LOOP', r.id); continue; }
    let cyc = p1.concat(p2.slice(1, -1));
    // rotate so that index 0 is the vertex nearest to r.start
    let bi = 0, bd = Infinity; cyc.forEach((n, i) => { const d = Math.hypot(net.nodes[n][0] - r.start[0], net.nodes[n][1] - r.start[1]); if (d < bd) { bd = d; bi = i; } });
    cyc = cyc.slice(bi).concat(cyc.slice(0, bi)); nodesPath = cyc.concat([cyc[0]]);
    P = pts(net, nodesPath); closed = true; w = widthOf(nodesPath);
  }
  const S = simplify(P, 1.2), L = plen(S);
  TRACKS[r.id] = { closed, w, len: Math.round(L), pts: flat(S) };
  console.log('track', r.id.padEnd(10), Math.round(L), 'm', S.length, 'pts', closed ? 'loop' : 'A-B', 'w', w, 'from', S[0].map(Math.round), 'to', S[S.length - 1].map(Math.round));
  SNAP['race:' + r.id] = [r1(S[0][0]), r1(S[0][1]), r2((S[1][0] - S[0][0]) / Math.hypot(S[1][0] - S[0][0], S[1][1] - S[0][1])), r2((S[1][1] - S[0][1]) / Math.hypot(S[1][0] - S[0][0], S[1][1] - S[0][1])), w, r.road || 'Viale delle Scienze'];
}

const out = `// GENERATED by assets/missions/snap-places.mjs from src/event-places.js and the world tiles. Do not edit by hand: edit event-places.js and run the script again.
// SNAP[id] = [x, z, dx, dz, width, road name]: the drivable road point of a place, with the road direction.
// ROUTES[id] = [[destination id, length m, flat x,z polyline], ...]: baked taxi routes (the guide arrow follows them).
// HUNT[food id] = { hunt: flat x,z of the lost items }.
// TRACKS[race id] = { closed, w, len, pts: flat x,z of the racing line }.
export const SNAP = ${JSON.stringify(SNAP)};
export const ROUTES = ${JSON.stringify(ROUTES)};
export const HUNT = ${JSON.stringify(HUNT)};
export const TRACKS = ${JSON.stringify(TRACKS)};
`;
fs.writeFileSync(path.join(ROOT, 'src/event-routes.js'), out);
fs.writeFileSync('/private/tmp/claude-501/palermo-events/resolved.json', JSON.stringify(report, null, 1));
console.log('wrote src/event-routes.js', (out.length / 1024).toFixed(0) + ' KB');
