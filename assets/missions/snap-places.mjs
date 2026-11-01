// Bakes src/event-routes.js from src/event-places.js and assets/missions/lines.js, using the world tiles (world/tiles/*.json).
//   node assets/missions/snap-places.mjs            (about a minute; prints the resolved places)
// For every event place: the nearest drivable road point (and the road's direction, width and name), the baked taxi routes, the hunt items and the
// scooter chase route of every food place, and the race tracks. Nothing here runs in the game.
import fs from 'fs';
import path from 'path';
import { ROOT, loadNet, snap, nodeNear, route, pts, plen, simplify, proj } from './roadnet.mjs';
import { FOOD_PLACES, TAXI_DESTS, FARE_SPOTS, PULLE_DEST, URGENT, RACES } from '../../src/event-places.js';
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

// ---- food places: snapped point, hunt items around it, a chase route through the neighbourhood
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
  const rnd = rng(hash(f.id)), N = 12, cands = pointsAround(s.x, s.z, 70, 430), chosen = [];
  const near = (c, d) => chosen.every(q => Math.hypot(q.x - c.x, q.z - c.z) >= d);
  const radii = [150, 280, 380];
  for (let k = 0; k < N; k++) {
    const a0 = -Math.PI + (k / N) * 2 * Math.PI, a1 = a0 + 2 * Math.PI / N, want = radii[k % 3];
    const inSec = cands.filter(c => c.ang >= a0 && c.ang < a1 && near(c, 45));
    if (inSec.length) { inSec.sort((p, q) => Math.abs(p.d - want) - Math.abs(q.d - want)); chosen.push(inSec[Math.min(inSec.length - 1, Math.floor(rnd() * 2))]); }
  }
  for (let spacing = 45; chosen.length < N && spacing >= 20; spacing -= 10) {
    const rest = cands.filter(c => near(c, spacing)); rest.sort(() => rnd() - 0.5);
    while (chosen.length < N && rest.length) { const c = rest.pop(); if (near(c, spacing)) chosen.push(c); }
  }
  // chase route: through the neighbourhood, passing close to the shop
  let chase = null;
  for (let tries = 0; tries < 24 && !chase; tries++) {
    const th = rnd() * Math.PI * 2, R = 380 + tries * 12, F = snap(net, s.x + Math.cos(th) * R, s.z + Math.sin(th) * R), G = snap(net, s.x - Math.cos(th) * R, s.z - Math.sin(th) * R);
    const p = route(net, nodeOf(F), nodeOf(G)); if (!p) continue;
    const P = pts(net, p), L = plen(P);
    if (L > 800 && L < 2200) chase = simplify(P, 3);
  }
  HUNT[f.id] = { hunt: flat(chosen.map(c => [c.x, c.z])), chase: chase ? flat(chase) : [] };
  console.log(f.id.padEnd(14), 'items', chosen.length, 'chase', chase ? Math.round(plen(chase)) + ' m' : 'NONE');
}

// ---- fares
const foodDests = DESTS.map(d => ({ id: d.id, name: d.name, lat: d.lat, lon: d.lon }));
for (const d of foodDests) place('dest:' + d.id, d.lat, d.lon);
for (const d of TAXI_DESTS) place('dest:' + d.id, d.lat, d.lon);
place('dest:' + PULLE_DEST.id, PULLE_DEST.lat, PULLE_DEST.lon);
function routeBetween(aId, bId) {
  const A = SNAP[aId], B = SNAP[bId];
  const sa = snap(net, A[0], A[1]), sb = snap(net, B[0], B[1]);
  const p = route(net, nodeOf(sa), nodeOf(sb)); if (!p) return null;
  const P = [[A[0], A[1]], ...pts(net, p), [B[0], B[1]]];
  return { len: plen(P), pts: simplify(P, 6) };
}
for (const f of FARE_SPOTS) {
  place('fare:' + f.id, f.lat, f.lon);
  const out = [];
  const pool = f.kind === 'tourist' ? foodDests : f.kind === 'taxi' ? TAXI_DESTS : [PULLE_DEST];
  const lo = f.kind === 'tourist' ? 300 : f.kind === 'taxi' ? 1200 : 0, hi = f.kind === 'tourist' ? 1700 : f.kind === 'taxi' ? 7000 : 1e9;
  const cs = [];
  for (const d of pool) { const r = routeBetween('fare:' + f.id, 'dest:' + d.id); if (r && r.len >= lo && r.len <= hi) cs.push({ d, r }); }
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
// HUNT[food id] = { hunt: flat x,z of the lost items, chase: flat x,z of the scooter's route }.
// TRACKS[race id] = { closed, w, len, pts: flat x,z of the racing line }.
export const SNAP = ${JSON.stringify(SNAP)};
export const ROUTES = ${JSON.stringify(ROUTES)};
export const HUNT = ${JSON.stringify(HUNT)};
export const TRACKS = ${JSON.stringify(TRACKS)};
`;
fs.writeFileSync(path.join(ROOT, 'src/event-routes.js'), out);
fs.writeFileSync('/private/tmp/claude-501/palermo-events/resolved.json', JSON.stringify(report, null, 1));
console.log('wrote src/event-routes.js', (out.length / 1024).toFixed(0) + ' KB');
