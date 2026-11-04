// Offline road graph over the world tiles (world/tiles/*.json), shared by snap-places.mjs. Node only, never loaded by the game.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
export const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
export const unproj = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];
export const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);

// ---- what the game builds, from the same tiles: the street surfaces the car drives on, the building footprints that are solid, the bridge and tunnel decks.
// The tiles list every OpenStreetMap road, but the game only draws and collides what the street polygons and the footprints say (src/world.js buildRaised, registerPhysics, src/bridges.js).
// A road in the data that is not on a street surface (no asphalt, paving, pavement or verge under it) or that runs through a building footprint is not a road the car can drive,
// so the routing network leaves it out (opts.built = false keeps every road).
export const BUILT = {
  STEP: 1,            // m between the samples along a road segment (1: a thin building is not stepped over)
  HARD_MIN: 0.5,      // a road segment needs at least this share of its samples on hard ground (or a deck), else it is not built
  BLD_DEPTH: 0.8,     // a sample this far inside a footprint (m) is in the building (the footprint ring is a wall)
  BLD_RUN: 1,         // m: a run of samples this long inside a footprint blocks the segment (a wall across the middle of the road stops the car even when the building is a thin one)
};
const inRing = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; return c; };
const inPoly = (poly, x, z) => { let c = false; for (const r of poly) if (inRing(r, x, z)) c = !c; return c; };
const dRing = (r, x, z) => { let d = 1e9; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const ax = r[j], az = r[j + 1], dx = r[i] - ax, dz = r[i + 1] - az, l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; const e = Math.hypot(x - ax - dx * u, z - az - dz * u); if (e < d) d = e; } return d; };
const bbox = r => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < r.length; i += 2) { if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i]; if (r[i + 1] < z0) z0 = r[i + 1]; if (r[i + 1] > z1) z1 = r[i + 1]; } return [x0, x1, z0, z1]; };
const TILE = 500, tk = (x, z) => Math.floor(x / TILE) + '_' + Math.floor(z / TILE);
const HARD_LAYERS = ['asphalt', 'paving', 'raised', 'median', 'verge'];   // the layers of the hard-ground mask in src/world.js buildRaised
export function makeGeo() {
  const hardT = new Map(), bldT = new Map(), decks = new Map();
  const geo = {
    add(key, t) {
      const H = [], B = [];
      for (const l of HARD_LAYERS) for (const poly of t.streets[l] || []) H.push({ poly, b: bbox(poly[0]) });
      for (const b of t.buildings) B.push({ p: b.p, holes: b.holes || [], b: bbox(b.p), id: b.id });
      hardT.set(key, H); bldT.set(key, B);
      for (const s of t.structs || []) { const k = s.id; if (!decks.has(k)) decks.set(k, s); }
    },
    hardAt(x, z) { const L = hardT.get(tk(x, z)); if (!L) return false; for (const q of L) if (x >= q.b[0] && x <= q.b[1] && z >= q.b[2] && z <= q.b[3] && inPoly(q.poly, x, z)) return true; return false; },
    // hard ground as the car sees it: a seam of a few tenths of a metre between street polygons is not off road (src/world.js surfaceAt: within 0.9 m)
    hard(x, z) { return geo.hardAt(x, z) || geo.hardAt(x + 0.9, z) || geo.hardAt(x - 0.9, z) || geo.hardAt(x, z + 0.9) || geo.hardAt(x, z - 0.9); },
    // how far inside a building footprint (outer ring, not a courtyard hole) the point is; 0 when it is not in one
    depthAt(x, z) { const L = bldT.get(tk(x, z)); if (!L) return 0; for (const q of L) if (x >= q.b[0] && x <= q.b[1] && z >= q.b[2] && z <= q.b[3] && inRing(q.p, x, z) && !q.holes.some(h => inRing(h, x, z))) return Math.min(dRing(q.p, x, z), ...q.holes.map(h => dRing(h, x, z))); return 0; },
    onDeck(x, z) { for (const s of decks.values()) { const p = s.p, hw = (s.w || 8) / 2 + 1; for (let i = 0; i + 3 < p.length; i += 2) { const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; if (Math.hypot(x - ax - dx * u, z - az - dz * u) <= hw) return true; } } return false; },
    // a straight stretch a to b is clear when every 2 m sample is on hard ground (or a deck) and at most BLD_DEPTH inside a footprint
    clear(ax, az, bx, bz) { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / BUILT.STEP)); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; if (geo.depthAt(x, z) > BUILT.BLD_DEPTH) return false; if (!geo.hard(x, z) && !geo.onDeck(x, z)) return false; } return true; },
    // is this road segment something the game builds? (see BUILT)
    built(ax, az, bx, bz) {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / BUILT.STEP)); let hard = 0, run = 0, maxRun = 0;
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (geo.hard(x, z) || geo.onDeck(x, z)) hard++; if (geo.depthAt(x, z) > BUILT.BLD_DEPTH) { run++; if (run > maxRun) maxRun = run; } else run = 0; }
      return hard / n >= BUILT.HARD_MIN && maxRun * (Math.hypot(bx - ax, bz - az) / n) < BUILT.BLD_RUN;
    },
  };
  return geo;
}

export function loadNet(opts = {}) {   // opts.extra: a RegExp of street names that are added even when not drivable in the tiles (pedestrian ways such as Via Maqueda); the default is the plain network. opts.built = false: roads the game does not build stay
  const dir = path.join(ROOT, 'world/tiles'), roads = [], blds = new Map(), geo = makeGeo(), cut = { segs: 0, kept: 0 };
  for (const f of fs.readdirSync(dir)) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const r of t.roads) if ((DRIVE.has(r.k) || (opts.extra && opts.extra.test(r.n || ''))) && r.p.length >= 4) roads.push(r);
    blds.set(f.replace('.json', ''), t.buildings.map(b => b.p));
    geo.add(f.replace('.json', ''), t);
  }
  const id = new Map(), nodes = [], adj = [], edges = [];
  const node = (x, z) => { const k = Math.round(x / 0.4) + ',' + Math.round(z / 0.4); let i = id.get(k); if (i === undefined) { i = nodes.length; id.set(k, i); nodes.push([x, z]); adj.push([]); } return i; };
  for (const r of roads) {
    const p = r.p; let prev = node(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) {
      if (opts.built !== false && !geo.built(p[i - 2], p[i - 1], p[i], p[i + 1])) { cut.segs++; prev = node(p[i], p[i + 1]); continue; }   // not built: no edge (the nodes stay, as junctions of what is)
      const n = node(p[i], p[i + 1]); if (n === prev) continue;
      const l = Math.hypot(nodes[n][0] - nodes[prev][0], nodes[n][1] - nodes[prev][1]);
      const e = { a: prev, b: n, l, r, one: !!r.o }; edges.push(e); adj[prev].push({ to: n, e, fwd: true }); adj[n].push({ to: prev, e, fwd: false });
      prev = n;
    }
  }
  // biggest connected piece
  const comp = new Int32Array(nodes.length).fill(-1), sizes = [];
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0) continue; let c = 0; const st = [s]; comp[s] = sizes.length;
    while (st.length) { const u = st.pop(); c++; for (const { to } of adj[u]) if (comp[to] < 0) { comp[to] = sizes.length; st.push(to); } }
    sizes.push(c);
  }
  let big = 0; sizes.forEach((c, i) => { if (c > sizes[big]) big = i; });
  const main = i => comp[i] === big;
  return { roads, nodes, adj, edges, main, blds, geo, cut };
}

// nearest point on a road of the main network. opts.name: prefer a road whose name contains it.
export function snap(net, x, z, opts = {}) {
  let best = null, bd = Infinity;
  for (const e of net.edges) {
    if (!net.main(e.a)) continue;
    const nm = e.r.n || '';
    if (opts.name && !nm.includes(opts.name)) continue;
    const A = net.nodes[e.a], B = net.nodes[e.b], dx = B[0] - A[0], dz = B[1] - A[1], l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / l2)) : 0, qx = A[0] + dx * t, qz = A[1] + dz * t;
    let d = Math.hypot(x - qx, z - qz);
    if (!nm) d += 40;
    if (e.r.w < 5) d += 25;
    if (d < bd) { bd = d; const l = Math.sqrt(l2) || 1; best = { x: qx, z: qz, dx: dx / l, dz: dz / l, w: e.r.w, n: nm, k: e.r.k, d, e, t }; }
  }
  return best;
}

// nearest graph node to a snapped point
export function nodeNear(net, s) {
  const a = net.nodes[s.e.a], b = net.nodes[s.e.b];
  return Math.hypot(s.x - a[0], s.z - a[1]) < Math.hypot(s.x - b[0], s.z - b[1]) ? s.e.a : s.e.b;
}

// Dijkstra between nodes. opts.oneway: obey one-way edges. opts.cost(e, fwd) -> multiplier (Infinity forbids)
export function route(net, a, b, opts = {}) {
  const n = net.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const heap = []; // binary heap of [d, node]
  const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[a] = 0; push(0, a);
  while (heap.length) {
    const [d, u] = pop(); if (d > dist[u]) continue; if (u === b) break;
    for (const { to, e, fwd } of net.adj[u]) {
      if (opts.oneway && e.one && !fwd) continue;
      const m = opts.cost ? opts.cost(e, fwd) : 1; if (!isFinite(m)) continue;
      const nd = d + e.l * m; if (nd < dist[to]) { dist[to] = nd; prev[to] = u; push(nd, to); }
    }
  }
  if (!isFinite(dist[b])) return null;
  const path = []; for (let u = b; u >= 0; u = prev[u]) path.push(u);
  return path.reverse();
}

export const pts = (net, path) => path.map(i => net.nodes[i]);
export const plen = P => { let s = 0; for (let i = 1; i < P.length; i++) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return s; };

// Douglas-Peucker on [[x,z],...]
export function simplify(P, tol) {
  if (P.length < 3) return P.slice();
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); let md = 0, mi = -1;
    const ax = P[i][0], az = P[i][1], dx = P[j][0] - ax, dz = P[j][1] - az, l2 = dx * dx + dz * dz;
    for (let k = i + 1; k < j; k++) {
      const t = l2 ? Math.max(0, Math.min(1, ((P[k][0] - ax) * dx + (P[k][1] - az) * dz) / l2)) : 0;
      const d = Math.hypot(P[k][0] - ax - dx * t, P[k][1] - az - dz * t); if (d > md) { md = d; mi = k; }
    }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([i, mi], [mi, j]); }
  }
  return P.filter((_, i) => keep[i]);
}

// Douglas-Peucker that never cuts a corner through the world: a stretch is only replaced by a straight chord when the chord stays within tol of the road AND is clear
// (hard ground and outside the building footprints, geo.clear). Where the chord is not clear the road's own vertices stay. Plain simplify(P, 6) turned the corners of the
// old town into diagonals through the houses (the pink line then ran over walls); this keeps the long straights cheap and the bends exact.
export function simplifyClear(P, tol, geo) {
  if (P.length < 3) return P.slice();
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); if (j - i < 2) continue;
    let md = 0, mi = -1;
    const ax = P[i][0], az = P[i][1], dx = P[j][0] - ax, dz = P[j][1] - az, l2 = dx * dx + dz * dz;
    for (let k = i + 1; k < j; k++) {
      const t = l2 ? Math.max(0, Math.min(1, ((P[k][0] - ax) * dx + (P[k][1] - az) * dz) / l2)) : 0;
      const d = Math.hypot(P[k][0] - ax - dx * t, P[k][1] - az - dz * t); if (d > md) { md = d; mi = k; }
    }
    if (md > tol || !geo.clear(ax, az, P[j][0], P[j][1])) { if (mi < 0) mi = (i + j) >> 1; keep[mi] = 1; st.push([i, mi], [mi, j]); }
  }
  return P.filter((_, i) => keep[i]);
}

// Which nodes can reach `target` driving the legal way (one-way streets obeyed)? Uint8Array over the nodes. The lost items of a hunt are only put where the way back to the place
// exists, so that the guide (which obeys one-ways) always has a line to draw from the last item.
export function reachTo(net, target) {
  const ok = new Uint8Array(net.nodes.length); ok[target] = 1; const st = [target];
  while (st.length) {
    const u = st.pop();
    for (const { to, e, fwd } of net.adj[u]) { if (ok[to]) continue; if (e.one && fwd) continue; ok[to] = 1; st.push(to); }   // to -> u is against a one-way edge when u is the edge's far end (fwd)
  }
  return ok;
}
