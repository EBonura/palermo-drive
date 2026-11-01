// Bakes src/pub-routes.js from src/pub-places.js and the world tiles (world/tiles/*.json), the pubs' counterpart of snap-places.mjs.
//   node assets/missions/snap-pubs.mjs            (about a minute; prints what it found for every pub)
// For every pub: the facade (the building edge nearest to the OSM point that faces open ground and the street: door point, outward normal, edge
// length), the nearest drivable road point (for the lapa, the offer and the return ring), the errand items spread over the nearby streets and a
// route that visits them (the guide arrow follows it). Nothing here runs in the game.
import fs from 'fs';
import path from 'path';
import { ROOT, loadNet, snap, nodeNear, route, pts, plen, simplify, proj } from './roadnet.mjs';
import { PUBS } from '../../src/pub-places.js';

const net = loadNet();
console.log('network', net.nodes.length, 'nodes', net.edges.length, 'edges');
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0, (s & 0xffffff) / 0x1000000); };
const flat = P => P.flatMap(p => [r1(p[0]), r1(p[1])]);

// building rings as { p, bb } for a fast point-in-building test
const rings = [];
for (const list of net.blds.values()) for (const p of list) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); }
  rings.push({ p, x0, x1, z0, z1 });
}
const inRing = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < (p[j] - p[i]) * (z - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
const inAny = (x, z) => rings.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && inRing(r.p, x, z));

// the facade: every building edge within 45 m of the point, scored by distance to the point plus distance of the open ground in front to a road
function facade(x, z, roadPt, faceTo) {
  let best = null;
  for (const r of rings) {
    if (r.x0 > x + 45 || r.x1 < x - 45 || r.z0 > z + 45 || r.z1 < z - 45) continue;
    const p = r.p;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length, ax = p[i], az = p[i + 1], bx = p[j], bz = p[j + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 3) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L))), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
      if (d > 45) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let nx = dz / L, nz = -dx / L;
      if (inRing(p, mx + nx * 0.3, mz + nz * 0.3)) { nx = -nx; nz = -nz; }          // outward
      if (inAny(qx + nx * 1.2, qz + nz * 1.2) || inAny(qx + nx * 2.5, qz + nz * 2.5)) continue;   // faces another building: not a street front
      const fx = qx + nx * 4, fz = qz + nz * 4, dr = Math.hypot(fx - roadPt.x, fz - roadPt.z);
      if (faceTo && (x - mx) * nx + (z - mz) * nz <= 0) continue;           // piazzas: only a wall that looks at the point
      const score = d + (faceTo ? 0.05 : 0.6) * dr - Math.min(L, 12) * 0.25;
      if (!best || score < best.score) best = { score, ax, az, dx: dx / L, dz: dz / L, L, nx, nz, t, d, dr };
    }
  }
  return best;
}

const OUT = {};
for (const v of PUBS) {
  const [vx, vz] = proj(v.lat, v.lon), s = snap(net, vx, vz, v.onStreet ? { name: v.onStreet } : {});
  const f = facade(vx, vz, s, !!v.scene);
  if (!f) { console.log(v.id, 'NO FACADE near', Math.round(vx), Math.round(vz)); continue; }
  // door: the closest point of the edge to the OSM point, kept at least 1.8 m from the corners, then shifted along the facade. The model's +x is to
  // the right as seen from the street, i.e. along (nz, -nx); the edge direction may run the other way, hence the sign.
  const lo = Math.min(1.8, f.L / 2), sgn = Math.sign(f.dx * f.nz - f.dz * f.nx) || 1;
  const dpos = Math.max(lo, Math.min(f.L - lo, f.t * f.L + (v.along || 0) * sgn));
  const door2 = [r1(f.ax + f.dx * dpos), r1(f.az + f.dz * dpos)];
  const o = { door: door2, n: [r2(f.nx), r2(f.nz)], len: r1(f.L), road: [r1(s.x), r1(s.z), r2(s.dx), r2(s.dz), s.w, s.n || ''], off: r1(Math.hypot(vx - door2[0], vz - door2[1])) };
  if (v.crowd && v.crowd.atVenue) o.crowdAt = [r1(vx), r1(vz)];   // the crowd sits at the point itself, not in front of the door (Piazza Magione)

  // errand items on the main roads around the pub, one per sector at three radii; then a greedy tour through them
  if (v.errand) {
    const N = v.errand.n, rnd = rng(hash(v.id)), cands = [];
    for (const e of net.edges) {
      if (!net.main(e.a) || e.r.w < 5) continue;
      const A = net.nodes[e.a], B = net.nodes[e.b], n = Math.max(1, Math.round(e.l / 20));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, d = Math.hypot(x - s.x, z - s.z);
        if (d >= 55 && d <= (v.errand.radius || 250)) cands.push({ x, z, d, ang: Math.atan2(z - s.z, x - s.x) });
      }
    }
    const chosen = [], far = (c, d) => chosen.every(q => Math.hypot(q.x - c.x, q.z - c.z) >= d), radii = [90, 150, 220];
    for (let k = 0; k < N; k++) {
      const a0 = -Math.PI + (k / N) * 2 * Math.PI, a1 = a0 + 2 * Math.PI / N, want = radii[k % 3];
      const inSec = cands.filter(c => c.ang >= a0 && c.ang < a1 && far(c, 45));
      if (inSec.length) { inSec.sort((p, q) => Math.abs(p.d - want) - Math.abs(q.d - want)); chosen.push(inSec[Math.min(inSec.length - 1, Math.floor(rnd() * 2))]); }
    }
    for (let spacing = 45; chosen.length < N && spacing >= 20; spacing -= 10) {
      const rest = cands.filter(c => far(c, spacing)); rest.sort(() => rnd() - 0.5);
      while (chosen.length < N && rest.length) { const c = rest.pop(); if (far(c, spacing)) chosen.push(c); }
    }
    // nearest-neighbour order starting at the pub, routed along the streets
    const order = []; let cur = { x: s.x, z: s.z }; const left = chosen.slice();
    while (left.length) { let bi = 0, bd = 1e12; left.forEach((c, i) => { const d = Math.hypot(c.x - cur.x, c.z - cur.z); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; order.push(cur); }
    let tour = [], prev = nodeNear(net, s);
    for (const c of order) {
      const nn = nodeNear(net, snap(net, c.x, c.z)), p = route(net, prev, nn); if (!p) continue;
      const P = pts(net, p); tour = tour.concat(tour.length ? P.slice(1) : P); prev = nn;
    }
    const back = route(net, prev, nodeNear(net, s)); if (back) tour = tour.concat(pts(net, back).slice(1));
    o.items = flat(order.map(c => [c.x, c.z]));
        o.tourLen = Math.round(plen(tour));
  }
  OUT[v.id] = o;
  console.log(v.id.padEnd(14), 'door', o.door.join(','), 'n', o.n.join(','), 'edge', o.len, 'm, door is', o.off, 'm from the OSM point; road', o.road[5] || '(unnamed)', 'w', o.road[4], v.errand ? `items ${o.items.length / 2} tour ${o.tourLen} m` : '');
}

const out = `// GENERATED by assets/missions/snap-pubs.mjs from src/pub-places.js and the world tiles. Do not edit by hand: edit pub-places.js and run the script again.
// PUB_ROUTES[id] = { door: [x, z] on the facade, n: [nx, nz] outward normal, len: facade edge length, road: [x, z, dx, dz, width, name] drivable road point,
//   items: flat x,z of the errand items, tourLen: length in metres of a route that visits them and comes back, crowdAt: [x, z] when the crowd is not at the door }.
export const PUB_ROUTES = ${JSON.stringify(OUT)};
`;
fs.writeFileSync(path.join(ROOT, 'src/pub-routes.js'), out);
console.log('wrote src/pub-routes.js', (out.length / 1024).toFixed(1) + ' KB');
