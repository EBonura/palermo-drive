// Offline road graph over the world tiles (world/tiles/*.json), shared by snap-places.mjs. Node only, never loaded by the game.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
export const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
export const unproj = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];
export const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);

export function loadNet() {
  const dir = path.join(ROOT, 'world/tiles'), roads = [], blds = new Map();
  for (const f of fs.readdirSync(dir)) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const r of t.roads) if (DRIVE.has(r.k) && r.p.length >= 4) roads.push(r);
    blds.set(f.replace('.json', ''), t.buildings.map(b => b.p));
  }
  const id = new Map(), nodes = [], adj = [], edges = [];
  const node = (x, z) => { const k = Math.round(x / 0.4) + ',' + Math.round(z / 0.4); let i = id.get(k); if (i === undefined) { i = nodes.length; id.set(k, i); nodes.push([x, z]); adj.push([]); } return i; };
  for (const r of roads) {
    const p = r.p; let prev = node(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) {
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
  return { roads, nodes, adj, edges, main, blds };
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
