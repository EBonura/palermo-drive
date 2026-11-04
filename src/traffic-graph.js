// Traffic road graph. Owned by the traffic work (src/traffic.js builds on it).
//
// A directed graph of road edges that grows and shrinks with the world tiles: `addTile` takes one tile's `roads[]`
// (same fields as D.roads: p flat [x,z,...], k class, w width, o oneway, j junction flag, n name; tools/tiles.py only
// writes w, k, n, tn, br, p) and builds it in small time slices, `dropTile` removes it again. Tile borders join on
// matching clipped endpoints (within about 0.4 m).
//
// Nodes are recycled through a free list and edges too (ids index typed arrays in the consumers), so nothing grows
// while the player drives around. Every query that runs per frame in traffic.js touches plain arrays only.
//
// Public pieces (see createGraph's return value): the arrays NX/NZ/NOUT/NIN/NDEG, edge objects, `alive` (which edges
// a class of vehicle may use: no dead ends, no isolated fragments), cell queries, nearest node and an A* path.

import { UNBUILT } from './unbuilt-roads.js';   // road segments the game does not build (assets/missions/snap-unbuilt.mjs): the graph leaves them out

export const CLASS = { // r: priority rank, v: free speed in m/s, w: spawn weight per metre, d: density of cars per lane metre (1 = old centro value)
  motorway: { r: 5, v: 24, w: 3.2, d: 1.1, fast: true, ow: true }, motorway_link: { r: 4, v: 15, w: 1, d: 0.8, ow: true },
  trunk: { r: 5, v: 19, w: 3, d: 1.1, fast: true }, trunk_link: { r: 4, v: 13, w: 1, d: 0.8, ow: true },
  primary: { r: 5, v: 14, w: 3, d: 1.3 }, primary_link: { r: 4, v: 11, w: 1.2, d: 0.9, ow: true },
  secondary: { r: 4, v: 13, w: 3, d: 1.3 }, secondary_link: { r: 3, v: 10, w: 1, d: 0.8, ow: true },
  tertiary: { r: 3, v: 11.5, w: 2.5, d: 1.2 }, tertiary_link: { r: 3, v: 9.5, w: 1, d: 0.7, ow: true },
  unclassified: { r: 2, v: 10, w: 1.4, d: 0.8 }, residential: { r: 2, v: 8.5, w: 1.5, d: 0.9 }, living_street: { r: 1, v: 5.5, w: 0.6, d: 0.4 },
  service: { r: 1, v: 5, w: 0.35, d: 0.2 }, pedestrian: { r: 0, v: 2.8, w: 0.05, d: 0 },
};
const TRANSIT = /^(Via Maqueda|Via Vittorio Emanuele|Corso Vittorio Emanuele)$/; // pedestrian-tagged but buses and taxis run here
// The market lanes (stall lines on both sides, src/markets.js): no vehicle drives through them, the crowd and the stalls have them
const MARKET_ST = /^(Piazza Ballar.|Piazzetta Ballar.|Via Chiappara al Carmine|Via Casa Professa|Discesa Maccheronai|Via Argenteria (Nuova|Vecchia)|Via Cassari|Via Materassai|Via Coltellieri|Via Chiavettieri|Piazza Garraffello|Via Garraffello|Piazza Caracciolo|Via Sant'Agostino|Via Beati Paoli|Via Cappuccinelle|Via Porta Carini)$/;
const hyp2 = (a, b) => Math.sqrt(a * a + b * b);
// UNBUILT as a lookup: 16 m cells of the segments' ends; a road segment is unbuilt when both its ends are within 0.3 m of the ends of one of them (either way round)
let unbuiltCells = null;
function isUnbuilt(ax, az, bx, bz) {
  if (!unbuiltCells) {
    unbuiltCells = new Map();
    const add = (x, z, seg) => { const ks = new Set(); for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) ks.add(Math.floor((x + dx) / 16) * 65536 + Math.floor((z + dz) / 16)); for (const k of ks) { let a = unbuiltCells.get(k); if (!a) unbuiltCells.set(k, a = []); a.push(...seg); } };   // in the cells of both ends, widened by the 0.3 m of the match
    for (const run of UNBUILT) for (let i = 0; i + 3 < run.length; i += 2) { const seg = [run[i], run[i + 1], run[i + 2], run[i + 3]]; add(seg[0], seg[1], seg); add(seg[2], seg[3], seg); }
  }
  const a = unbuiltCells.get(Math.floor(ax / 16) * 65536 + Math.floor(az / 16)); if (!a) return false;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - ax) < 0.3 && Math.abs(a[i + 1] - az) < 0.3 && Math.abs(a[i + 2] - bx) < 0.3 && Math.abs(a[i + 3] - bz) < 0.3) return true;
    if (Math.abs(a[i + 2] - ax) < 0.3 && Math.abs(a[i + 3] - az) < 0.3 && Math.abs(a[i] - bx) < 0.3 && Math.abs(a[i + 1] - bz) < 0.3) return true;
  }
  return false;
}
const TS = 500;                 // tile size, as in src/world.js
const NUDGE = [0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4];
const CELL = 64;                // edge grid cell per tile
const NCELL = 16;               // node grid cell
const pk = (x, z) => (Math.round(x * 10) + 400000) * 1000000 + (Math.round(z * 10) + 400000);
const ck = (ix, iz) => (ix + 4000) * 8192 + (iz + 4000);
const nck = (ix, iz) => (ix + 2000) * 4096 + (iz + 2000);

export function createGraph() {
  // ---------- nodes ----------
  const NX = [], NZ = [], NOUT = [], NIN = [], NDEG = [], NBOX = [], NOCC = [], NKEY = [];
  const nodeIdx = new Map(), freeN = [], ngrid = new Map();
  const G = { NX, NZ, NOUT, NIN, NDEG, NBOX, NOCC, EDGES: [], tiles: new Map(), version: 0, alive: [new Uint8Array(0), new Uint8Array(0), new Uint8Array(0), new Uint8Array(0)] };
  const EDGES = G.EDGES, freeE = [];

  function gridAdd(i) {
    const k = nck(Math.floor(NX[i] / NCELL), Math.floor(NZ[i] / NCELL)); let a = ngrid.get(k);
    if (!a) ngrid.set(k, a = []); a.push(i);
  }
  function gridDel(i) {
    const k = nck(Math.floor(NX[i] / NCELL), Math.floor(NZ[i] / NCELL)), a = ngrid.get(k); if (!a) return;
    const p = a.indexOf(i); if (p >= 0) { a[p] = a[a.length - 1]; a.pop(); }
    if (!a.length) ngrid.delete(k);
  }
  function node(x, z) {
    let i = nodeIdx.get(pk(x, z));
    if (i !== undefined) return i;
    // a point on a tile border: the neighbour tile clipped the same line, its endpoint can differ by one rounding step
    const bx = Math.abs(x - Math.round(x / TS) * TS) < 0.06, bz = Math.abs(z - Math.round(z / TS) * TS) < 0.06;
    if (bx) for (let n = 0; n < NUDGE.length; n++) { i = nodeIdx.get(pk(x, z + NUDGE[n])); if (i !== undefined && Math.abs(NX[i] - x) < 0.06) return i; }
    if (bz) for (let n = 0; n < NUDGE.length; n++) { i = nodeIdx.get(pk(x + NUDGE[n], z)); if (i !== undefined && Math.abs(NZ[i] - z) < 0.06) return i; }
    if (freeN.length) {
      i = freeN.pop(); NX[i] = x; NZ[i] = z; NDEG[i] = 0; NBOX[i] = 2.5; if (NOCC[i]) NOCC[i].length = 0;
    } else { i = NX.length; NX.push(x); NZ.push(z); NOUT.push([]); NIN.push([]); NDEG.push(0); NBOX.push(2.5); NOCC.push(null); NKEY.push(0); }
    NKEY[i] = pk(x, z); nodeIdx.set(NKEY[i], i); gridAdd(i);
    return i;
  }
  function releaseNode(i) {
    if (NKEY[i] < 0 || NOUT[i].length || NIN[i].length || NDEG[i] > 0) return;
    nodeIdx.delete(NKEY[i]); gridDel(i); NKEY[i] = -1; freeN.push(i);
  }

  // ---------- oneway / roundabout flags for tiles (tools/tiles.py does not write o and j yet) ----------
  // The baked centro roads carry them; a tile segment that matches a baked segment inherits them. Built lazily from D.roads.
  let baked = null;
  function bakedFlags(roads) {
    baked = new Map();
    for (const r of roads) {
      if (!r.o && r.j !== 'roundabout') continue;
      const p = r.p;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const k = pk(p[i], p[i + 1]);
        baked.set(k, { nk: pk(p[i + 2], p[i + 3]), o: r.o || 0, j: r.j, nxt: baked.get(k) });
      }
    }
  }
  function flagsOf(r, out) { // fills out.o, out.j for a tile road without them
    out.o = r.o; out.j = r.j;
    if (out.o !== undefined || !baked) return;
    const p = r.p;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ka = pk(p[i], p[i + 1]), kb = pk(p[i + 2], p[i + 3]);
      for (let e = baked.get(ka); e; e = e.nxt) if (e.nk === kb) { out.o = e.o; out.j = e.j; return; }
      for (let e = baked.get(kb); e; e = e.nxt) if (e.nk === ka) { out.o = -e.o; out.j = e.j; return; }
    }
  }

  // ---------- edges ----------
  function addEdge(tile, a, b, road, cls, ped, transit, round) {
    const dx = NX[b] - NX[a], dz = NZ[b] - NZ[a], len = hyp2(dx, dz);
    const e = {
      id: 0, a, b, len, dx: dx / len, dz: dz / len, rx: -dz / len, rz: dx / len, w: road.w || 4,
      rank: round ? 6 : cls.r, ow: !!road.o, ped, transit, name: road.n || '', pw: cls.w, den: cls.d, rev: -1, bus: false, fast: !!cls.fast, svc: !!road.svc,
      br: road.br, v: Math.min(cls.v, road.ms ? road.ms / 3.6 * 1.08 : 99), veh: [], giveWay: false, slowJ: false, sg: null, alive: false, dead: false, seg: false, tile, q: 0,
    };
    if (round) e.v = Math.min(e.v, 6.5);
    if (transit) e.v = 5;
    e.bus = !ped && e.rank >= 3 && e.w >= 8 || transit;
    if (freeE.length) { e.id = freeE.pop(); EDGES[e.id] = e; } else { e.id = EDGES.length; EDGES.push(e); }
    for (let k = 0; k < 4; k++) if (e.id < G.alive[k].length) G.alive[k][e.id] = 0; // not judged yet
    NOUT[a].push(e); NIN[b].push(e);
    tile.edges.push(e);
    const x0 = Math.min(NX[a], NX[b]), x1 = Math.max(NX[a], NX[b]), z0 = Math.min(NZ[a], NZ[b]), z1 = Math.max(NZ[a], NZ[b]);
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
      const k = ck(ix, iz); let c = tile.cells.get(k); if (!c) tile.cells.set(k, c = []); c.push(e);
    }
    return e;
  }
  const tmp = { o: undefined, j: undefined };
  function addRoad(tile, r) {
    const cls = CLASS[r.k]; if (!cls || r.tn) return;
    if (MARKET_ST.test(r.n || '')) return;
    const ped = r.k === 'pedestrian', transit = ped && TRANSIT.test(r.n || ''), p = r.p;
    flagsOf(r, tmp);
    const o = tmp.o === undefined ? (cls.ow ? 1 : 0) : tmp.o, round = tmp.j === 'roundabout';
    const road = { w: r.w, n: r.n, o, ms: r.ms, br: r.br ? 1 : 0, svc: r.k === 'service' };
    for (let i = 0; i + 3 < p.length; i += 2) {
      const dxx = p[i + 2] - p[i], dzz = p[i + 3] - p[i + 1];
      if (dxx * dxx + dzz * dzz < 0.25 || isUnbuilt(p[i], p[i + 1], p[i + 2], p[i + 3])) continue;
      const a = node(p[i], p[i + 1]), b = node(p[i + 2], p[i + 3]);
      if (a === b) continue;
      NDEG[a]++; NDEG[b]++;
      const f = o === -1 ? null : addEdge(tile, a, b, road, cls, ped, transit, round), g = o === 1 ? null : addEdge(tile, b, a, road, cls, ped, transit, round);
      (f || g).seg = true;
      if (f && g) { f.rev = g.id; g.rev = f.id; }
    }
  }

  // ---------- tiles ----------
  // Build a tile's roads in slices. addTile registers it, stepTile(tile, ms) returns true when the last road is in.
  G.addTile = function (key, roads, x0, z0) {
    if (G.tiles.has(key)) G.dropTile(key);   // tile keys are 'i_j'
    const tile = { key, roads, ri: 0, done: false, edges: [], cells: new Map(), x0, z0 };
    G.tiles.set(key, tile);
    return tile;
  };
  G.stepTile = function (tile, ms) {
    if (tile.done) return true;
    const t0 = performance.now(), roads = tile.roads;
    while (tile.ri < roads.length) {
      for (let n = 0; n < 24 && tile.ri < roads.length; n++) addRoad(tile, roads[tile.ri++]);
      if (performance.now() - t0 > ms) break;
    }
    if (tile.ri >= roads.length) { tile.done = true; tile.roads = null; G.version++; }
    return tile.done;
  };
  G.hasTile = key => G.tiles.has(key);
  // Removes a tile's edges. Returns the number removed. Vehicles still on them must be removed by the caller (edge.dead is set).
  G.dropTile = function (key) {
    const tile = G.tiles.get(key); if (!tile) return 0;
    G.tiles.delete(key);
    for (const e of tile.edges) {
      e.dead = true; e.veh.length = 0;
      if (e.seg) { NDEG[e.a]--; NDEG[e.b]--; }
      let l = NOUT[e.a], p = l.indexOf(e); if (p >= 0) { l[p] = l[l.length - 1]; l.pop(); }
      l = NIN[e.b]; p = l.indexOf(e); if (p >= 0) { l[p] = l[l.length - 1]; l.pop(); }
      EDGES[e.id] = null; freeE.push(e.id);
    }
    for (const e of tile.edges) { releaseNode(e.a); releaseNode(e.b); }
    const n = tile.edges.length; tile.edges.length = 0; tile.cells.clear();
    G.version++;
    return n;
  };
  G.setBaked = bakedFlags;

  // ---------- usable edges ----------
  // Which edges a vehicle class may use. A vehicle never U-turns, so an edge is only usable if, going forward, it reaches
  // more road: dead ends, one-way spurs and edges that lead into a tile that is not loaded are peeled off (a queue
  // sweep from the edges with no way on), then fragments of fewer than MINCOMP edges are dropped.
  // classes: 0 cars (no pedestrian streets), 1 anything with walking-pace capability, 2 buses, 3 slow ones (no fast roads)
  const MINCOMP = 40;
  G.baseAllowed = (c, k) => k === 0 ? !c.ped : k === 1 ? true : k === 2 ? c.bus : !c.fast;
  G.recomputeAlive = function () {
    const N = EDGES.length, out = [];
    const par = new Int32Array(NX.length), cnt = new Int32Array(N), dead = new Uint8Array(N), q = new Int32Array(N), csize = new Int32Array(NX.length);
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let k = 0; k < 4; k++) {
      let qh = 0, qt = 0;
      dead.fill(0);
      for (let i = 0; i < N; i++) {
        const e = EDGES[i]; if (!e || !G.baseAllowed(e, k)) { dead[i] = 1; continue; }
        let c = 0; const outs = NOUT[e.b];
        for (let n = 0; n < outs.length; n++) if (outs[n].id !== e.rev && G.baseAllowed(outs[n], k)) c++;
        cnt[i] = c; if (!c) { dead[i] = 1; q[qt++] = i; }
      }
      while (qh < qt) {
        const c = EDGES[q[qh++]], ins = NIN[c.a];
        for (let n = 0; n < ins.length; n++) {
          const p = ins[n]; if (dead[p.id] || c.id === p.rev) continue;
          if (--cnt[p.id] === 0) { dead[p.id] = 1; q[qt++] = p.id; }
        }
      }
      for (let i = 0; i < par.length; i++) { par[i] = i; csize[i] = 0; }
      for (let i = 0; i < N; i++) if (!dead[i]) { const e = EDGES[i], a = find(e.a), b = find(e.b); if (a !== b) par[a] = b; }
      for (let i = 0; i < N; i++) if (!dead[i]) csize[find(EDGES[i].a)]++;
      const good = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (!dead[i] && csize[find(EDGES[i].a)] >= MINCOMP) good[i] = 1;
      out.push(good);
    }
    for (let i = 0; i < N; i++) { const e = EDGES[i]; if (e) e.alive = !!(out[0][i] || out[1][i] || out[2][i] || out[3][i]); }
    G.alive = out;
  };

  // ---------- queries ----------
  let qstamp = 0;
  // fn(edge) for every edge with some part in the cells that touch the circle (cx, cz, r); each edge once
  G.eachEdgeNear = function (cx, cz, r, fn) {
    qstamp++;
    const i0 = Math.floor((cx - r) / TS), i1 = Math.floor((cx + r) / TS), j0 = Math.floor((cz - r) / TS), j1 = Math.floor((cz + r) / TS);
    for (let ti = i0; ti <= i1; ti++) for (let tj = j0; tj <= j1; tj++) {
      const tile = G.tiles.get(ti + '_' + tj); if (!tile) continue;
      for (let ix = Math.floor((cx - r) / CELL); ix <= Math.floor((cx + r) / CELL); ix++) for (let iz = Math.floor((cz - r) / CELL); iz <= Math.floor((cz + r) / CELL); iz++) {
        const c = tile.cells.get(ck(ix, iz)); if (!c) continue;
        for (let n = 0; n < c.length; n++) { const e = c[n]; if (e.q !== qstamp) { e.q = qstamp; fn(e); } }
      }
    }
  };

  G.nearestNode = function (x, z, maxd = 60, drivable = true) {
    let best = -1, bd = maxd * maxd;
    const ix0 = Math.floor((x - maxd) / NCELL), ix1 = Math.floor((x + maxd) / NCELL), iz0 = Math.floor((z - maxd) / NCELL), iz1 = Math.floor((z + maxd) / NCELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const a = ngrid.get(nck(ix, iz)); if (!a) continue;
      for (let n = 0; n < a.length; n++) {
        const i = a[n], d = (NX[i] - x) * (NX[i] - x) + (NZ[i] - z) * (NZ[i] - z);
        if (d >= bd) continue;
        if (drivable) { let ok = false; const o = NOUT[i], m = NIN[i]; for (let k = 0; k < o.length && !ok; k++) ok = !o[k].ped; for (let k = 0; k < m.length && !ok; k++) ok = !m[k].ped; if (!ok) continue; }
        bd = d; best = i;
      }
    }
    return best;
  };

  // A* over the drivable edges of the resident tiles (one-ways respected, no pedestrian streets), cost = travel time.
  // Returns { pts: [x, z, ...], len, complete, nodes } or null when there is no road near the start. When the destination
  // is not resident (or not reachable) the path ends at the reachable node closest to it and `complete` is false.
  G.path = function (x0, z0, x1, z1, maxExpand = 40000) {
    const s = G.nearestNode(x0, z0, 80), g = G.nearestNode(x1, z1, 60);
    if (s < 0) return null;
    const n = NX.length, gc = new Float32Array(n).fill(1e9), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const gx = g >= 0 ? NX[g] : x1, gz = g >= 0 ? NZ[g] : z1;
    const heap = [], hf = []; // binary heap of node ids keyed by f
    const push = (i, f) => { let c = heap.length; heap.push(i); hf.push(f); while (c > 0) { const p = (c - 1) >> 1; if (hf[p] <= hf[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hf[p], hf[c]] = [hf[c], hf[p]]; c = p; } };
    const pop = () => {
      const top = heap[0], li = heap.pop(), lf = hf.pop();
      if (heap.length) { heap[0] = li; hf[0] = lf; let c = 0; for (;;) { let l = c * 2 + 1, r = l + 1, m = c; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hf[m], hf[c]] = [hf[c], hf[m]]; c = m; } }
      return top;
    };
    const h = i => hyp2(NX[i] - gx, NZ[i] - gz) / 22;
    gc[s] = 0; push(s, h(s));
    let bestN = s, bestH = h(s), found = false, expanded = 0;
    while (heap.length && expanded++ < maxExpand) {
      const i = pop(); if (closed[i]) continue; closed[i] = 1;
      if (i === g) { found = true; break; }
      const hi = h(i); if (hi < bestH) { bestH = hi; bestN = i; }
      const outs = NOUT[i];
      for (let k = 0; k < outs.length; k++) {
        const e = outs[k]; if (e.ped && !e.transit) continue;
        const c = gc[i] + e.len / Math.max(2, e.v);
        if (c < gc[e.b]) { gc[e.b] = c; prev[e.b] = e.id; push(e.b, c + h(e.b)); }
      }
    }
    const end = found ? g : bestN, pts = [], rev = [];
    let len = 0;
    for (let i = end; i !== s && prev[i] >= 0;) { const e = EDGES[prev[i]]; rev.push(i); len += e.len; i = e.a; }
    pts.push(NX[s], NZ[s]);
    for (let k = rev.length - 1; k >= 0; k--) pts.push(NX[rev[k]], NZ[rev[k]]);
    return { pts, len, complete: found, nodes: rev.length + 1 };
  };

  // ---------- guidance: where the car is on the road graph, and the best way on from there (src/route-guide.js) ----------
  G.tileLoaded = (x, z) => { const t = G.tiles.get(Math.floor(x / TS) + '_' + Math.floor(z / TS)); return !!(t && t.done); };

  // The directed edge a car at (x, z) heading (hx, hz) is driving along: near, and pointing the way it points, so on a dual carriageway
  // it is the carriageway the car is on, not the nearest centreline of the other one. Pedestrian streets are not roads (Via Maqueda
  // and the like, which taxis use, are). Fills `out` { e, t (metres along the edge), d (metres off it) }; false when none is within maxd.
  const EF = { best: 1e9, e: null, t: 0, d: 0 };
  G.edgeFor = function (x, z, hx, hz, maxd, out) {
    EF.best = 1e9; EF.e = null;
    G.eachEdgeNear(x, z, maxd, e => {
      if (e.ped && !e.transit) return;
      const ax = NX[e.a], az = NZ[e.a], t = Math.max(0, Math.min(e.len, (x - ax) * e.dx + (z - az) * e.dz));
      const d = hyp2(x - ax - e.dx * t, z - az - e.dz * t); if (d > maxd) return;
      const sc = d + 16 * (1 - (e.dx * hx + e.dz * hz));
      if (sc < EF.best) { EF.best = sc; EF.e = e; EF.t = t; EF.d = d; }
    });
    if (!EF.e) return false;
    out.e = EF.e; out.t = EF.t; out.d = EF.d; return true;
  };

  // plan(x, z, hx, hz, tg, o): the quickest way from a car at (x, z) heading (hx, hz) to any of several targets, each with a head start:
  // tg is flat [tx, tz, cost, ...] where cost (seconds) is what remains to be driven once the target is reached (0 for a destination, the
  // rest of a baked route for a point on it), so the winner has the lowest driving time to it plus what follows it. One search, run from
  // the targets back to the car (edges taken in reverse), A* with the straight-line time to the car as the guess. The car goes on along its
  // own edge; turning back costs UTURN seconds and is only possible on a two-way street. One-ways are respected, pedestrian streets are not
  // used, service roads cost more. Bounded to o.max node expansions (12000 by default; measured about 0.8 ms per thousand, and the resident graph of 4 tiles has about 1400 nodes).
  // Returns o { pts: [x, z, ...] from the car to the winning target's node, ti (index in tg / 3), cost, len, expanded, why } or null (o.why:
  // 'noroad' none within 35 m of the car, 'notarget' none near a road, 'noway' no way through, 'cap' the bound was hit).
  let sg = new Float32Array(0), sn = new Int32Array(0), ss = new Uint32Array(0), sT = new Int32Array(0), sc = new Uint32Array(0), stamp = 0;
  const hI = [], hF = [], SE = { e: null, t: 0, d: 0 }, PLAN = { pts: null, ti: -1, cost: 0, len: 0, expanded: 0, why: '' };
  const SVC = 2.5, UTURN = 12, SEED_MAX = 16, NN = new Int32Array(SEED_MAX), NND = new Float32Array(SEED_MAX);
  function nodesNear(x, z, r, kmax) {   // the kmax drivable nodes nearest to (x, z) within r into NN (ids) and NND (metres), nearest first; how many
    let m = 0;
    for (let ix = Math.floor((x - r) / NCELL); ix <= Math.floor((x + r) / NCELL); ix++) for (let iz = Math.floor((z - r) / NCELL); iz <= Math.floor((z + r) / NCELL); iz++) {
      const a = ngrid.get(nck(ix, iz)); if (!a) continue;
      for (let n = 0; n < a.length; n++) {
        const i = a[n], d = hyp2(NX[i] - x, NZ[i] - z); if (d > r || (m === kmax && d >= NND[m - 1])) continue;
        let ok = false; const o = NOUT[i], q = NIN[i]; for (let k = 0; k < o.length && !ok; k++) ok = !o[k].ped; for (let k = 0; k < q.length && !ok; k++) ok = !q[k].ped; if (!ok) continue;
        let j = m < kmax ? m++ : m - 1; while (j > 0 && NND[j - 1] > d) { NN[j] = NN[j - 1]; NND[j] = NND[j - 1]; j--; }
        NN[j] = i; NND[j] = d;
      }
    }
    return m;
  }
  G.plan = function (x, z, hx, hz, tg, o) {
    const res = o || PLAN, max = res.max || 12000, seedR = res.seedR || 40, seedN = Math.min(SEED_MAX, res.seeds || 4); res.why = ''; res.expanded = 0;
    if (!G.edgeFor(x, z, hx, hz, 35, SE)) { res.why = 'noroad'; return null; }
    if (sg.length < NX.length) { const m = Math.max(NX.length + 256, sg.length * 2); sg = new Float32Array(m); sn = new Int32Array(m); ss = new Uint32Array(m); sT = new Int32Array(m); sc = new Uint32Array(m); }
    stamp++;
    hI.length = hF.length = 0;
    const push = (i, f) => { let c = hI.length; hI.push(i); hF.push(f); while (c > 0) { const p = (c - 1) >> 1; if (hF[p] <= hF[c]) break; const ti = hI[p], tf = hF[p]; hI[p] = hI[c]; hF[p] = hF[c]; hI[c] = ti; hF[c] = tf; c = p; } };
    const pop = () => {
      const top = hI[0], li = hI.pop(), lf = hF.pop();
      if (hI.length) { hI[0] = li; hF[0] = lf; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < hI.length && hF[l] < hF[m]) m = l; if (r < hI.length && hF[r] < hF[m]) m = r; if (m === c) break; const ti = hI[m], tf = hF[m]; hI[m] = hI[c]; hF[m] = hF[c]; hI[c] = ti; hF[c] = tf; c = m; } }
      return top;
    };
    const h = i => hyp2(NX[i] - x, NZ[i] - z) / 22;
    let seeded = 0;
    for (let k = 0; k + 2 < tg.length; k += 3) {   // each target starts the search from the o.seeds (4) drivable nodes nearest to it within o.seedR (40 m): the very nearest can be a spur nobody can leave, or on the far side of a tile that is not here
      const m = nodesNear(tg[k], tg[k + 1], seedR, seedN);
      for (let q = 0; q < m; q++) {
        const n = NN[q], c0 = tg[k + 2] + NND[q] / 8;
        if (ss[n] === stamp && sg[n] <= c0) continue;
        ss[n] = stamp; sg[n] = c0; sn[n] = -1; sT[n] = k / 3; seeded++; push(n, c0 + h(n));
      }
    }
    if (!seeded) { res.why = 'notarget'; return null; }
    const e0 = SE.e, v0 = Math.max(2, e0.v), nb = e0.b, na = e0.rev >= 0 ? e0.a : -1;
    const offB = (e0.len - SE.t) / v0, offA = SE.t / v0 + UTURN;
    let best = 1e9, start = -1, expanded = 0;
    while (hI.length && expanded < max) {
      const f = hF[0], i = pop();
      if (f >= best) break;
      if (sc[i] === stamp) continue;
      sc[i] = stamp; expanded++;
      if (i === nb || i === na) { const tot = sg[i] + (i === nb ? offB : offA); if (tot < best) { best = tot; start = i; } }
      const ins = NIN[i], gi = sg[i];
      for (let k = 0; k < ins.length; k++) {
        const e = ins[k]; if (e.ped && !e.transit) continue;
        const a = e.a; if (sc[a] === stamp) continue;
        const c = gi + e.len / Math.max(2, e.v) * (e.svc ? SVC : 1);
        if (ss[a] !== stamp || c < sg[a]) { ss[a] = stamp; sg[a] = c; sn[a] = e.id; push(a, c + h(a)); }
      }
    }
    res.expanded = expanded;
    if (start < 0) { res.why = expanded >= max ? 'cap' : 'noway'; return null; }
    const pts = [x, z, NX[start], NZ[start]]; let n = start, len = hyp2(NX[start] - x, NZ[start] - z);
    for (let g = 0; sn[n] >= 0 && g < 4000; g++) { const e = EDGES[sn[n]]; n = e.b; pts.push(NX[n], NZ[n]); len += e.len; }
    res.pts = pts; res.ti = sT[n]; res.cost = best; res.len = len;
    return res;
  };
  return G;
}
