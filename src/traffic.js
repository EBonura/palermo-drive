// Traffic: vehicles driving the OSM road graph. Owned by the traffic work.
// createTraffic(env) with env = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D }.
// Returns { update(dt, camera), collidePlayer(car), agents(), setVolume(v) }.
//
// Design in one paragraph: D.roads become a directed graph (nodes are identical rounded coordinates,
// one-ways respected). Each vehicle holds a short route of directed edges, follows the lane line of
// its current edge with pure pursuit, and brakes with the Intelligent Driver Model for leaders (found
// along its route, in a forward corridor, and the player), corners, junction priority (rank of the road
// class, then yield to the right) and optional traffic signals (D.signals). Vehicles are spawned out of
// view around the camera, despawned out of view, and drawn with one InstancedMesh per model.
import * as THREE from 'three';
import { proj } from './core.js';
import { buildModels, makeMaterial, busSignGeometry } from '../assets/traffic/models.js';
import { BUS_ROUTES, BUS_STOPS } from '../assets/traffic/bus-routes.js';

// ---------- tuning ----------
const CLASS = { // rank decides priority, v is the free speed in m/s, w the spawn weight per metre
  primary: { r: 5, v: 14, w: 3 }, secondary: { r: 4, v: 13, w: 3 }, tertiary: { r: 3, v: 11.5, w: 2.5 },
  unclassified: { r: 2, v: 10, w: 1.4 }, residential: { r: 2, v: 8.5, w: 1.5 }, living_street: { r: 1, v: 5.5, w: 0.6 },
  service: { r: 1, v: 5, w: 0.35 }, pedestrian: { r: 0, v: 2.8, w: 0.05 },
};
const TRANSIT = /^(Via Maqueda|Via Vittorio Emanuele|Corso Vittorio Emanuele)$/;                 // pedestrian-tagged but buses and taxis run here
const R_SPAWN_MIN = 35, R_SPAWN_MAX = 215, R_FAR = 125, R_DESPAWN = 235, R_KEEP_UNSEEN = 150; // out of view: spawn within R_KEEP_UNSEEN, despawn beyond it
const STEP = 1 / 30;
const LANE_PER_CAR = 36; // metres of drivable lane per vehicle within 140 m of the camera

// Vehicle types. L, W in metres, circ = collision circles [z offset, radius], mass relative to the player (1).
const hatchCols = [['#f2f2f0', 30], ['#c3c6cb', 22], ['#6e7378', 16], ['#1f2124', 12], ['#b3241e', 9], ['#8fb3cc', 6], ['#3d5a45', 3]];
const TYPES = {
  panda: { model: 'panda', L: 3.65, W: 1.64, mass: 0.95, circ: [[1.0, 0.85], [-1.0, 0.85]], cols: hatchCols },
  punto: { model: 'punto', L: 4.06, W: 1.69, mass: 1.1, circ: [[1.2, 0.9], [-1.2, 0.9]], cols: hatchCols },
  smart: { model: 'smart', L: 2.69, W: 1.56, mass: 0.8, circ: [[0.55, 0.8], [-0.55, 0.8]], cols: hatchCols, rmin: 3.2 },
  taxi: { model: 'taxi', L: 4.5, W: 1.78, mass: 1.3, circ: [[1.4, 0.95], [0, 0.95], [-1.4, 0.95]], cols: [['#ffffff', 1]], rmin: 4.8 },
  van: { model: 'van', L: 4.45, W: 1.82, mass: 2.0, circ: [[1.3, 0.95], [0, 0.95], [-1.3, 0.95]], vf: 0.92, a: 2.0, rmin: 5.5, ped: true, minW: 3.5,
    cols: [['#f2f2f0', 70], ['#c3c6cb', 12], ['#8fb3cc', 8], ['#d8d2b8', 10]] },
  bus: { model: 'bus', L: 11.8, W: 2.5, mass: 11, circ: [[4.4, 1.3], [2.2, 1.3], [0, 1.3], [-2.2, 1.3], [-4.4, 1.3]], vf: 0.85, a: 1.4, b: 3.0, T: 1.3, s0: 2.5,
    rmin: 9.5, vcap: 11, bus: true, transit: true, minW: 6, cols: [['#f2c316', 5], ['#e9b80d', 3], ['#f5cf3b', 2]] },
  vespa: { model: 'vespa', L: 1.8, W: 0.7, mass: 0.28, circ: [[0.5, 0.45], [-0.4, 0.45]], vf: 1.08, a: 3.4, T: 0.7, s0: 1.2, rmin: 2.8, scooter: true, ped: true,
    cols: [['#c8301f', 3], ['#2f6f9a', 3], ['#e6e2d0', 3], ['#2a2a2c', 3], ['#5a7a4a', 1], ['#d9a21f', 1], ['#bcbcbc', 2]] },
  apePick: { model: 'apePick', L: 3.2, W: 1.4, mass: 0.8, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.75, a: 1.5, rmin: 3.6, vcap: 9, ped: true,
    cols: [['#e9e4d2', 3], ['#7fa3c0', 3], ['#c2362c', 2], ['#4e7a4c', 2], ['#f4f4f0', 3]] },
  apeCrate: { model: 'apeCrate', L: 3.2, W: 1.4, mass: 0.9, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.7, a: 1.4, rmin: 3.6, vcap: 8.5, ped: true,
    cols: [['#e9e4d2', 3], ['#d6a24a', 2], ['#7fa3c0', 2], ['#4e7a4c', 2]] },
  apeFood: { model: 'apeFood', L: 3.2, W: 1.4, mass: 1.0, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.65, a: 1.3, rmin: 3.6, vcap: 8, ped: true,
    cols: [['#efe3c8', 3], ['#e8c46a', 2], ['#c2362c', 1]] },
  carrozza: { model: 'carrozza', L: 6.7, W: 1.3, mass: 1.5, circ: [[2.6, 0.7], [0.8, 0.8], [-0.8, 0.8]], vf: 0.4, vcap: 2.7, a: 0.8, b: 2.2, T: 1.4, s0: 2.0, rmin: 6, ped: true,
    cols: [['#5a3a24', 4], ['#2a2220', 2], ['#8a5a34', 3], ['#a9a49a', 1]] },
  carretto: { model: 'carretto', L: 5.0, W: 1.6, mass: 1.2, circ: [[1.6, 0.7], [-0.1, 0.85], [-0.9, 0.85]], vf: 0.4, vcap: 2.3, a: 0.8, b: 2.2, T: 1.4, s0: 2.0, rmin: 5, ped: true,
    cols: [['#2e2a26', 2], ['#6a4a30', 2]] },
};
TYPES.vespaB = { ...TYPES.vespa, model: 'vespaB' };
for (const t of Object.values(TYPES)) {
  Object.assign(t, { vf: 1, a: 2.6, b: 3.2, T: 0.95, s0: 1.6, rmin: 4.2, vcap: 99, minW: 0 }, { ...t });
  t.cls = t.bus ? 2 : t.ped ? 1 : 0; // 0 cars (no pedestrian streets), 1 walking-pace capable, 2 buses
}

const pickW = list => {
  let t = 0; for (const e of list) t += e[1];
  let r = Math.random() * t;
  for (const e of list) if ((r -= e[1]) <= 0) return e[0];
  return list[0][0];
};
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function createTraffic(env) {
  const { scene, camera, car, groundY, walls2d, closestOnSeg, D } = env;
  const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const MAXV = +(location.search.match(/[?&]tn=(\d+)/) || [])[1] || (COARSE ? 42 : 95);
  const CAPS = { bus: COARSE ? 2 : 4, carrozza: COARSE ? 1 : 2, carretto: COARSE ? 0 : 1 };
  const DEBUG = /[?&]trafficsim/.test(location.search);

  // ---------- road graph ----------
  const nodeIdx = new Map(), NX = [], NZ = [], NOUT = [], NIN = [], NDEG = [], NBOX = [], NOCC = [];
  const node = (x, z) => {
    const k = x + ',' + z; let i = nodeIdx.get(k);
    if (i === undefined) { i = NX.length; nodeIdx.set(k, i); NX.push(x); NZ.push(z); NOUT.push([]); NIN.push([]); NDEG.push(0); NBOX.push(2.5); NOCC.push(null); }
    return i;
  };
  const EDGES = [];
  function addEdge(a, b, road, cls, ped, transit) {
    const dx = NX[b] - NX[a], dz = NZ[b] - NZ[a], len = Math.hypot(dx, dz);
    const round = road.j === 'roundabout';
    const e = {
      id: EDGES.length, a, b, len, dx: dx / len, dz: dz / len, rx: -dz / len, rz: dx / len, w: road.w || 4,
      rank: round ? 6 : cls.r, ow: !!road.o, ped, transit, name: road.n || '', pw: cls.w, rev: -1, bus: false,
      v: Math.min(cls.v, road.ms ? road.ms / 3.6 * 1.08 : 99), veh: [], giveWay: false, slowJ: false,
    };
    if (round) e.v = Math.min(e.v, 6.5);
    if (transit) e.v = 5;
    e.bus = !ped && e.rank >= 3 && e.w >= 8 || transit;
    EDGES.push(e); NOUT[a].push(e); NIN[b].push(e);
    return e;
  }
  for (const r of D.roads) {
    const cls = CLASS[r.k]; if (!cls) continue;
    const ped = r.k === 'pedestrian', transit = ped && TRANSIT.test(r.n || '');
    const p = r.p;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const a = node(p[i], p[i + 1]), b = node(p[i + 2], p[i + 3]);
      if (a === b || Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) < 0.5) continue;
      NDEG[a]++; NDEG[b]++;
      const f = r.o === -1 ? null : addEdge(a, b, r, cls, ped, transit), g = r.o === 1 ? null : addEdge(b, a, r, cls, ped, transit);
      if (f && g) { f.rev = g.id; g.rev = f.id; }
    }
  }
  // Which edges a vehicle class may use. A vehicle never U-turns, so an edge is only usable if, going
  // forward, it reaches a big strongly connected part of the network: no routes into dead ends,
  // one-way spurs or isolated fragments. (Tarjan over edges, then a reverse sweep.)
  const baseAllowed = (c, k) => k === 0 ? !c.ped : k === 1 ? true : c.bus;
  const ALIVE = [0, 1, 2].map(k => {
    const N = EDGES.length, idx = new Int32Array(N).fill(-1), low = new Int32Array(N), onst = new Uint8Array(N), comp = new Int32Array(N).fill(-1);
    const st = [], sizes = []; let counter = 0;
    const succ = e => NOUT[e.b].filter(c => c.id !== e.rev && baseAllowed(c, k));
    for (let s0 = 0; s0 < N; s0++) {
      if (idx[s0] >= 0 || !baseAllowed(EDGES[s0], k)) continue;
      idx[s0] = low[s0] = counter++; st.push(s0); onst[s0] = 1;
      const work = [[s0, succ(EDGES[s0]), 0]];
      while (work.length) {
        const top = work[work.length - 1], v = top[0];
        if (top[2] < top[1].length) {
          const w = top[1][top[2]++].id;
          if (idx[w] < 0) { idx[w] = low[w] = counter++; st.push(w); onst[w] = 1; work.push([w, succ(EDGES[w]), 0]); }
          else if (onst[w]) low[v] = Math.min(low[v], idx[w]);
        } else {
          if (low[v] === idx[v]) { let n = 0, w; do { w = st.pop(); onst[w] = 0; comp[w] = sizes.length; n++; } while (w !== v); sizes.push(n); }
          work.pop();
          if (work.length) { const pn = work[work.length - 1][0]; low[pn] = Math.min(low[pn], low[v]); }
        }
      }
    }
    const good = new Uint8Array(N), q = [];
    for (let n = 0; n < N; n++) if (comp[n] >= 0 && sizes[comp[n]] >= 40) { good[n] = 1; q.push(n); }
    while (q.length) {
      const c = EDGES[q.pop()];
      for (const e of NIN[c.a]) if (e.id !== c.rev && baseAllowed(e, k) && !good[e.id]) { good[e.id] = 1; q.push(e.id); }
    }
    return good;
  });
  // optional traffic signals: D.signals = flat [x, z, ...] in local metres, snapped to the nearest junction
  const SIG = new Set();
  if (D.signals && D.signals.length) {
    for (let i = 0; i + 1 < D.signals.length; i += 2) {
      let best = -1, bd = 9;
      for (let n = 0; n < NX.length; n++) if (NDEG[n] >= 3) { const d = (NX[n] - D.signals[i]) ** 2 + (NZ[n] - D.signals[i + 1]) ** 2; if (d < bd) { bd = d; best = n; } }
      if (best >= 0) SIG.add(best);
    }
  }
  // ---------- AMAT bus lines (OSM route relations, baked in assets/traffic/bus-routes.js) ----------
  // Each route piece is matched onto the graph (nodes share rounded coordinates) into a plan: the
  // directed edges in travel order, plus the stops that lie on it. Buses only run these plans.
  const findEdge = (a, b) => NOUT[a].find(c => c.b === b);
  const nearestNode = (x, z) => { let best = -1, bd = 36; for (let n = 0; n < NX.length; n++) { const d = (NX[n] - x) ** 2 + (NZ[n] - z) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  function gapPath(a, b) { // shortest hop path over any edges, to bridge a missing link in a route
    const prev = new Map([[a, null]]); let front = [a];
    for (let h = 0; h < 12 && front.length; h++) {
      const nf = [];
      for (const n of front) for (const c of NOUT[n]) if (!prev.has(c.b)) { prev.set(c.b, c); if (c.b === b) { const out = []; for (let e = c; e; e = prev.get(e.a)) out.unshift(e); return out; } nf.push(c.b); }
      front = nf;
    }
    return null;
  }
  for (const e of EDGES) e.alive = !!(ALIVE[0][e.id] || ALIVE[2][e.id]);
  const PLANS = [], ROWS = [];
  for (const r of BUS_ROUTES) {
    let row = ROWS.findIndex(q => q.ref === r.ref && q.to === r.to);
    if (row < 0) { row = ROWS.length; ROWS.push({ ref: r.ref, to: r.to }); }
    const rstops = []; for (let i = 0; i + 1 < r.stops.length; i += 2) rstops.push([r.stops[i], r.stops[i + 1]]);
    for (const pc of r.pieces) {
      let edges = [];
      const flush = () => { if (edges.length >= 6) PLANS.push({ ref: r.ref, to: r.to, row, edges, stops: [], rstops }); edges = []; };
      let prevN = -1;
      for (let i = 0; i + 1 < pc.length; i += 2) {
        let n = nodeIdx.get(pc[i] + ',' + pc[i + 1]); if (n === undefined) n = nearestNode(pc[i], pc[i + 1]);
        if (n < 0 || n === prevN) continue;
        if (prevN >= 0) {
          const e = findEdge(prevN, n);
          if (e) edges.push(e);
          else { const g = gapPath(prevN, n); if (g) edges.push(...g); else { flush(); } }
        }
        prevN = n;
      }
      flush();
    }
  }
  for (const pl of PLANS) { // stops: the relation's own plus every OSM bus stop within a few metres of the line
    const cand = pl.rstops.slice(); for (let i = 0; i + 1 < BUS_STOPS.length; i += 2) cand.push([BUS_STOPS[i], BUS_STOPS[i + 1]]);
    const found = [];
    for (const [sx, sz] of cand) {
      let best = null, bd = 100;
      for (let i = 0; i < pl.edges.length; i++) {
        const e = pl.edges[i];
        if (Math.abs(NX[e.a] - sx) > e.len + 12 && Math.abs(NX[e.b] - sx) > e.len + 12) continue;
        const t = clamp((sx - NX[e.a]) * e.dx + (sz - NZ[e.a]) * e.dz, 0, e.len), d = (NX[e.a] + e.dx * t - sx) ** 2 + (NZ[e.a] + e.dz * t - sz) ** 2;
        if (d < bd) { bd = d; best = { i, t: clamp(t, 3, Math.max(3, e.len - 3)) }; }
      }
      if (best && bd < 100) found.push(best);
    }
    found.sort((a, b) => a.i - b.i || a.t - b.t);
    for (const f of found) { const l = pl.stops[pl.stops.length - 1]; if (!l || l.i !== f.i || f.t - l.t > 20) pl.stops.push(f); }
    pl.closed = pl.edges[pl.edges.length - 1].b === pl.edges[0].a;
    delete pl.rstops;
  }
  const green = (n, e, t) => {
    const ph = (t + n * 7.3) % 24, ax = Math.abs(e.dx) > Math.abs(e.dz) ? 0 : 1;
    return ax === 0 ? ph < 10 : ph >= 12 && ph < 22;
  };

  // ---------- instanced meshes ----------
  const MODELS = buildModels(), MAT = makeMaterial();
  const CAP = MAXV + 16, MESH = {};
  for (const name of Object.keys(MODELS)) {
    const m = new THREE.InstancedMesh(MODELS[name], MAT, CAP);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    scene.add(m); MESH[name] = m;
  }
  // LED destination boards: one atlas row per line, picked per instance
  const SIGN_ROW = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  let SIGN = null;
  if (ROWS.length) {
    const cv = document.createElement('canvas'), W = 128, H = 16;
    cv.width = W * 2; cv.height = H * 2 * ROWS.length;
    const g = cv.getContext('2d'), tmp = document.createElement('canvas'), tg = tmp.getContext('2d');
    tmp.width = W; tmp.height = H; g.imageSmoothingEnabled = false;
    ROWS.forEach((r, i) => {
      tg.fillStyle = '#080604'; tg.fillRect(0, 0, W, H);
      const text = (r.ref + ' ' + r.to).toUpperCase().replace(/^(PARCHEGGIO|PIAZZALE|STAZIONE) /, m => m.slice(0, 4) + '. ');
      let px = 11; tg.textBaseline = 'middle';
      do { tg.font = `bold ${px}px monospace`; px--; } while (tg.measureText(text).width > W - 6 && px > 6);
      tg.fillStyle = '#ffae1a'; tg.fillText(text, 3, H / 2 + 1);
      g.drawImage(tmp, 0, i * H * 2, W * 2, H * 2);
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float row;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.y = ( ${ROWS.length}.0 - row - 1.0 + uv.y ) / ${ROWS.length}.0;\n#endif`);
    };
    mat.customProgramCacheKey = () => 'bus-led-' + ROWS.length;
    const geo = busSignGeometry(); geo.setAttribute('row', SIGN_ROW);
    SIGN = new THREE.InstancedMesh(geo, mat, CAP);
    SIGN.instanceMatrix = MESH.bus.instanceMatrix; SIGN.count = 0; SIGN.frustumCulled = false;
    SIGN_ROW.setUsage(THREE.DynamicDrawUsage); scene.add(SIGN);
  }
  for (const t of Object.values(TYPES)) t.colObjs = t.cols.map(([h, w]) => [new THREE.Color(h), w]);

  // ---------- state ----------
  const vs = [];
  let time = 0, nextCand = 0, candCum = [], candEdges = [], candX = 1e9, candZ = 1e9, frames = 0;
  const frustum = new THREE.Frustum(), fm = new THREE.Matrix4(), fs = new THREE.Sphere(new THREE.Vector3(), 5), inv = new THREE.Matrix4();
  const SITES = [proj(38.1146, 13.3558), proj(38.1199, 13.3573), proj(38.115684, 13.361460)];
  const nearSite = (x, z) => SITES.some(s => Math.hypot(s[0] - x, s[1] - z) < 280);
  const counts = {};
  let nextId = 0;
  const agentsOut = [];

  const allowed = (c, ty) => baseAllowed(c, ty.cls) && ALIVE[ty.cls][c.id] === 1 && (c.ped || c.w >= ty.minW);
  function pickNext(e, ty) {
    const outs = NOUT[e.b]; let tot = 0, any = null;
    const ws = [];
    for (const c of outs) {
      if (c.id === e.rev || !allowed(c, ty)) { ws.push(0); continue; }
      const cos = e.dx * c.dx + e.dz * c.dz;
      let w = ty.bus ? 1 : c.pw;
      w *= cos > 0.9 ? 2.2 : cos > 0.3 ? 1.0 : cos > -0.3 ? 0.9 : 0.35;
      if (c.name && c.name === e.name) w *= 1.8;
      if (c.ped) w *= 0.4;
      ws.push(w); tot += w; any = c;
    }
    if (tot <= 0) return null;
    let r = Math.random() * tot;
    for (let i = 0; i < outs.length; i++) if ((r -= ws[i]) <= 0 && ws[i] > 0) return outs[i];
    return any;
  }
  function extendRoute(v) {
    const r = v.route;
    if (v.plan) {
      const pl = v.plan;
      while (r.length < 4) {
        let i = v.pidx + 1;
        if (i >= pl.edges.length) { if (!pl.closed) break; i = 0; }
        r.push(pl.edges[i]); v.pidx = i;
      }
      return;
    }
    while (r.length < 4) { const n = pickNext(r[r.length - 1], v.ty); if (!n) break; r.push(n); }
  }
  const laneOff = (e, v) => e.ow ? (e.w < 7 ? 0.55 : v.pref * Math.min(e.w / 4, 2.6)) : Math.min(e.w / 4, 2.6);

  // ---------- spawning ----------
  function rebuildCandidates(cx, cz) {
    candEdges.length = 0; candCum.length = 0; let acc = 0, lane = 0;
    for (const e of EDGES) {
      if (e.alive && !e.ped) { const mx = (NX[e.a] + NX[e.b]) / 2 - cx, mz = (NZ[e.a] + NZ[e.b]) / 2 - cz; if (mx * mx + mz * mz < 140 * 140) lane += e.len * (e.w >= 8 ? 1.3 : 1); }
      if (!(ALIVE[0][e.id] || ALIVE[1][e.id] || ALIVE[2][e.id])) continue;
      const mx = (NX[e.a] + NX[e.b]) / 2 - cx, mz = (NZ[e.a] + NZ[e.b]) / 2 - cz, d2 = mx * mx + mz * mz;
      if (d2 < R_SPAWN_MIN * R_SPAWN_MIN || d2 > R_SPAWN_MAX * R_SPAWN_MAX) continue;
      acc += e.len * e.pw; candEdges.push(e); candCum.push(acc);
    }
    candX = cx; candZ = cz;
    target = clamp(Math.round(lane / LANE_PER_CAR), 18, MAXV);
  }
  function chooseType(e) {
    const c = counts;
    const room = k => (c[k] || 0) < CAPS[k];
    if (e.ped) {
      if (e.transit) return pickW([['apePick', 2], ['van', 1], ['vespa', 2]]);
      return pickW([['apeCrate', 3], ['apePick', 2], ['van', 3], ['apeFood', 1], ['vespa', 2]]);
    }
    const near = nearSite(NX[e.a], NZ[e.a]);
    const opts = [['panda', 24], ['punto', 22], ['smart', 8], ['taxi', 5], ['van', e.w >= 3.5 ? 7 : 0], ['vespa', 14], ['vespaB', 7],
      ['apePick', 2.5], ['apeCrate', 1.8], ['apeFood', 0.9]];
    if (room('carrozza') && near) opts.push(['carrozza', 4]);
    if (room('carretto') && Math.random() < (near ? 0.04 : 0.006)) return 'carretto';
    return pickW(opts);
  }
  function inView(x, y, z, r) { fs.center.set(x, y, z); fs.radius = r; return frustum.intersectsSphere(fs); }
  function trySpawn() {
    if (!candEdges.length) return false;
    const tot = candCum[candCum.length - 1];
    let lo = 0, hi = candCum.length - 1; const r = Math.random() * tot;
    while (lo < hi) { const m = (lo + hi) >> 1; if (candCum[m] < r) lo = m + 1; else hi = m; }
    const e = candEdges[lo], name = chooseType(e), ty = TYPES[name];
    if (!allowed(e, ty)) return false;
    const t = Math.min(e.len - 0.5, ty.L * 0.5 + 0.5 + Math.random() * Math.max(0, e.len - ty.L - 1));
    const pref = Math.random() < 0.55 ? 1 : -1;
    const stub = { pref, ty };
    const off = laneOff(e, stub);
    const x = NX[e.a] + e.dx * t + e.rx * off, z = NZ[e.a] + e.dz * t + e.rz * off;
    const dc = Math.hypot(x - camera.position.x, z - camera.position.z);
    if (dc < R_SPAWN_MIN) return false;
    if (dc < R_FAR && inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3)) return false;
    if (dc > R_KEEP_UNSEEN - 10 && !inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3)) return false; // would be culled at once
    if (Math.hypot(x - car.x, z - car.z) < 18) return false;
    for (const o of vs) if (Math.abs(o.x - x) < 14 && Math.abs(o.z - z) < 14 && Math.hypot(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 4) return false;
    const v = {
      id: ++nextId, ty, name, x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref,
      lat: 0, latT: 0, drv: 0.88 + Math.random() * 0.26, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0,
      yaw: 0, roll: 0, col: pickW(ty.colObjs), age: 0, blocker: null,
    };
    extendRoute(v);
    if (v.route.length < 2 && e.len < 40) return false;
    vs.push(v); counts[name] = (counts[name] || 0) + 1;
    return true;
  }
  let busCand = [], busStopCand = [], nextBus = 0, target = 30, dbgDwell = 0, dbgBus = 0, dbgStopsSeen = 0;
  function rebuildBusCandidates(cx, cz) {
    busCand.length = 0; busStopCand.length = 0;
    for (const pl of PLANS) for (let i = 0; i < pl.edges.length; i++) {
      const e = pl.edges[i], dx = (NX[e.a] + NX[e.b]) / 2 - cx, dz = (NZ[e.a] + NZ[e.b]) / 2 - cz, d2 = dx * dx + dz * dz;
      if (d2 > R_SPAWN_MIN * R_SPAWN_MIN && d2 < R_SPAWN_MAX * R_SPAWN_MAX && e.len > 14) { busCand.push([pl, i]); if (pl.stops.some(st => st.i > i && st.i <= i + 2)) busStopCand.push([pl, i]); }
    }
  }
  function trySpawnBus() {
    if (!busCand.length) return false;
    const list = busStopCand.length && Math.random() < 0.7 ? busStopCand : busCand; // most buses start a little before a stop
    const [pl, i] = list[(Math.random() * list.length) | 0], e = pl.edges[i], ty = TYPES.bus;
    const t = ty.L * 0.5 + 1 + Math.random() * Math.max(0, e.len - ty.L - 2);
    const x = NX[e.a] + e.dx * t + e.rx * Math.min(e.w / 4, 2.6), z = NZ[e.a] + e.dz * t + e.rz * Math.min(e.w / 4, 2.6);
    const dc = Math.hypot(x - camera.position.x, z - camera.position.z);
    if (dc < R_SPAWN_MIN || Math.hypot(x - car.x, z - car.z) < 25) return false;
    if (dc < R_FAR && inView(x, groundY(x, z) + 1.5, z, 9)) return false;
    if (dc > R_KEEP_UNSEEN - 10 && !inView(x, groundY(x, z) + 1.5, z, 9)) return false;
    for (const o of vs) if (Math.hypot(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 5) return false;
    let si = 0; while (si < pl.stops.length && (pl.stops[si].i < i || (pl.stops[si].i === i && pl.stops[si].t < t + 8))) si++;
    const v = {
      id: ++nextId, ty, name: 'bus', x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref: 1,
      lat: 0, latT: 0, drv: 0.92 + Math.random() * 0.16, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0, yaw: 0, roll: 0,
      col: pickW(ty.colObjs), age: 0, blocker: null, plan: pl, cur: i, pidx: i, si, dwell: 0,
    };
    extendRoute(v); vs.push(v); counts.bus = (counts.bus || 0) + 1; dbgBus++;
    return true;
  }
  function removeAt(i) { const v = vs[i]; v.dead = true; counts[v.name]--; vs[i] = vs[vs.length - 1]; vs.pop(); }

  // ---------- driving ----------
  // Do the two paths through the junction cross or merge? Each path is a polyline in-lane, through
  // the node, out-lane (lane offsets from the road widths).
  const baseOff = e => e.ow ? (e.w < 7 ? 0.55 : 0) : Math.min(e.w / 4, 2.6);
  const PA = new Float64Array(6), PB = new Float64Array(6);
  function path(e, en, P) {
    const n = e.b, oi = baseOff(e), oo = en ? baseOff(en) : oi, ox = en ? en.dx : e.dx, oz = en ? en.dz : e.dz, orx = en ? en.rx : e.rx, orz = en ? en.rz : e.rz;
    P[0] = NX[n] - e.dx * 9 + e.rx * oi; P[1] = NZ[n] - e.dz * 9 + e.rz * oi;
    P[2] = NX[n] + (e.rx * oi + orx * oo) * 0.5; P[3] = NZ[n] + (e.rz * oi + orz * oo) * 0.5;
    P[4] = NX[n] + ox * 9 + orx * oo; P[5] = NZ[n] + oz * 9 + orz * oo;
  }
  const ccw = (ax, az, bx, bz, cx, cz) => (cz - az) * (bx - ax) > (bz - az) * (cx - ax);
  const segX = (a, i, b, j) => ccw(a[i], a[i + 1], b[j], b[j + 1], b[j + 2], b[j + 3]) !== ccw(a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3]) &&
    ccw(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1]) !== ccw(a[i], a[i + 1], a[i + 2], a[i + 3], b[j + 2], b[j + 3]);
  function pathsCross(e, en, oe, ot) {
    if (en && ot && en === ot) return true; // merging into the same road
    path(e, en, PA); path(oe, ot, PB);
    for (let i = 0; i < 4; i += 2) for (let j = 0; j < 4; j += 2) if (segX(PA, i, PB, j)) return true;
    return false;
  }
  function mustHold(v, e, rem, exitSpace) {
    const n = e.b, ty = v.ty;
    if (SIG.has(n) && !green(n, e, time)) { v.why = 'sig'; return true; }
    if (NDEG[n] < 3) return false;
    if (v.wait > 9) return false;                                    // gridlock breaker
    if (exitSpace < ty.L + 1.2 && v.wait < 2) { v.why = 'exit'; v.why2 = v.exitO; return true; } // keep the box clear, briefly
    const occ = NOCC[n]; if (!occ) return false;
    const en = v.route[1];
    const eager = v.wait > 2.5;
    for (let i = 0; i < occ.length; i++) {
      const o = occ[i]; if (o === v) continue;
      const oe = o.route[0];
      if (oe.b !== n) { // already past the node and still inside it
        if (oe.a === n && o.t < 4.5 && oe !== en && o.v > 0.3 && Math.abs(oe.dx * e.dx + oe.dz * e.dz) < 0.75 && v.wait < 6) { v.why = 'leaving'; v.why2 = o; return true; }
        continue;
      }
      if (oe === e) continue;
      const remO = oe.len - o.t, ot = o.route[1];
      if (remO > 3 && remO / Math.max(o.v, 2.5) > 3.8) continue;       // far away
      if (!pathsCross(e, en, oe, ot)) continue;                         // nothing to give way to
      if (remO < 2.5 && (o.v > 0.3 || remO < 1.2)) { if (!eager) { v.why = 'inbox'; v.why2 = o; return true; } continue; } // it is in the box already
      if (eager) continue;
      const rightDot = oe.dx * e.rx + oe.dz * e.rz;
      if (oe.rank > e.rank) { v.why = 'rank'; v.why2 = o; return true; }
      if (oe.rank === e.rank) { // first come first served, the right-hand rule breaks ties
        const d = (remO / Math.max(o.v, 2.5) - o.wait) - (rem / Math.max(v.v, 2.5) - v.wait);
        if (d < -0.4 || (d < 0.4 && (rightDot < -0.35 ? (oe.dx * e.rx + oe.dz * e.rz > -0.35 || o.id < v.id) : o.id < v.id && rightDot < 0.35))) { v.why = 'right'; v.why2 = o; return true; }
      }
    }
    return false;
  }

  function control(v, dt) {
    const ty = v.ty, route = v.route, e0 = route[0], rem = e0.len - v.t, L2 = ty.L / 2;
    const sp = v.v, a = ty.a, b = ty.b, sab = 2 * Math.sqrt(a * b);
    let v0 = Math.min(e0.v * ty.vf * v.drv, ty.vcap);
    const vbase = v0;
    let dist = rem;
    for (let k = 0; k + 1 < route.length; k++) {
      const ek = route[k], en = route[k + 1];
      const ang = Math.acos(clamp(ek.dx * en.dx + ek.dz * en.dz, -1, 1));
      let vt = ang < 0.12 ? 99 : Math.max(3.2, vbase * (1 - 0.75 * Math.min(1, (ang - 0.12) / 1.3)));
      if (k === 0 && ek.slowJ) vt = Math.min(vt, ek.giveWay ? 5.5 : 7.5);
      vt = Math.min(vt, en.v * ty.vf * 1.05, ty.vcap);
      v0 = Math.min(v0, Math.sqrt(vt * vt + 6 * Math.max(0, dist - L2)));
      dist += en.len;
      if (dist > 70) break;
    }
    v0 = Math.max(v0, 0.6);
    if (v.stopT > 0) { v.acc = -Math.min(b * 2.2, sp * 4 + 1); return; }
    if (v.dwell > 0) { v.dwell -= dt; if (v.dwell <= 0) v.si++; v.acc = -Math.min(b * 2.2, sp * 4 + 1); return; }

    let minI = 0, minGap = 1e9, blocker = null, exitSpace = 1e9;
    const filt = ty.scooter && v.filtO && Math.abs(v.lat) > 1.0;
    const interact = (gap, vl, o) => {
      const sStar = ty.s0 + Math.max(0, sp * ty.T + sp * (sp - vl) / sab), g = gap > 0.05 ? gap : 0.05;
      const term = -a * (sStar / g) * (sStar / g);
      if (term < minI) minI = term;
      if (gap < minGap) { minGap = gap; blocker = o; }
    };
    // leaders along the route
    let base = -v.t;
    for (let k = 0; k < route.length && k < 3; k++) {
      const list = route[k].veh;
      for (let i = 0; i < list.length; i++) {
        const o = list[i]; if (o === v) continue;
        const d = base + o.t;
        if (k === 0 && d <= 0) continue;
        if (k === 1 && o.v < 2 && o.t - o.ty.L / 2 < exitSpace) { exitSpace = o.t - o.ty.L / 2; v.exitO = o; } // free room past the node
        if ((filt && o === v.filtO) || (o.hold && o.why2 === v) || (v.stuck > 20 && o.stuck > 10)) continue;
        interact(d - L2 - o.ty.L / 2, o.v, o);
      }
      base = k === 0 ? rem : base + route[k].len;
    }
    // leaders and obstacles in the forward corridor (crossers, merging traffic)
    const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
    const reach = 6 + sp * 1.4;
    for (let i = 0; i < vs.length; i++) {
      const o = vs[i]; if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      if (dx > 30 || dx < -30 || dz > 30 || dz < -30) continue;
      const al = dx * fx + dz * fz; if (al <= 0 || al > reach + L2 + o.ty.L / 2) continue;
      const lt = dx * rx + dz * rz;
      const ofx = Math.sin(o.h), ofz = Math.cos(o.h), cj = ofx * fx + ofz * fz, sj = Math.abs(ofx * rx + ofz * rz), acj = Math.abs(cj);
      const hl = acj * o.ty.L / 2 + sj * o.ty.W / 2, hw = sj * o.ty.L / 2 + acj * o.ty.W / 2;
      if (Math.abs(lt) >= hw + ty.W / 2 + 0.15) continue;
      if ((filt && o === v.filtO) || (o.hold && o.why2 === v) || (v.stuck > 20 && o.stuck > 10)) continue;
      if (cj < 0.45 && v.stuck > 3 && v.id < o.id) continue; // crossing or oncoming standoff: the lower id drives on
      interact(al - L2 - hl, (o.v) * cj, o);
    }
    { // the player
      const dx = car.x - v.x, dz = car.z - v.z;
      if (Math.abs(dx) < 30 && Math.abs(dz) < 30) {
        const al = dx * fx + dz * fz;
        if (al > 0 && al < reach + L2 + 2) {
          const pfx = Math.sin(car.th), pfz = Math.cos(car.th), cj = pfx * fx + pfz * fz, sj = Math.abs(pfx * rx + pfz * rz), acj = Math.abs(cj);
          const hl = acj * 1.5 + sj * 0.75, hw = sj * 1.5 + acj * 0.75, lt = dx * rx + dz * rz;
          if (Math.abs(lt) < hw + ty.W / 2 + 0.2) interact(al - L2 - hl, (car.vx * fx + car.vz * fz), 'player');
        }
      }
    }
    // junction: hold at the stop line when someone has priority, the light is red or the exit is blocked
    let hold = false;
    if (rem < 40) hold = mustHold(v, e0, rem, exitSpace);
    if (hold) {
      const sg = rem - L2 - NBOX[e0.b];
      if (sg > -1.2 && sp * sp / (2 * Math.max(sg, 0.1)) < 6.5) interact(sg, 0, null);
      if (sp < 0.5 && sg < 4) v.wait += dt;
    } else v.wait = 0;
    if (!route[1] && rem < 60) interact(rem - L2 - 0.4, 0, null); // end of the road
    if (v.plan) { // the next bus stop on the line: pull up with the front door at the pole, wait, go on
      const pl = v.plan, n = pl.edges.length;
      let st = pl.stops[v.si];
      while (st && st.i < v.cur) st = pl.stops[++v.si];
      if (st) for (let k = 0, d0 = -v.t; k < 3 && k < route.length; k++) {
        if ((v.cur + k) % n === st.i) {
          const gap = d0 + st.t - L2 + 3.5;
          if (gap < -2) v.si++;
          else if (gap < 70) { interact(gap, 0, null); if (sp < 0.4 && gap < 4) { v.dwell = 6 + Math.random() * 6; dbgDwell++; } }
          break;
        }
        d0 = k === 0 ? rem : d0 + route[k].len; // distance to the start of route[k + 1]
      }
    }
    v.blocker = blocker; v.hold = hold; v.minGap = minGap; v.v0 = v0;
    // scooters slip past slow traffic where the road is wide enough
    if (ty.scooter) {
      const fo = v.filtO;
      if (fo) {
        if ((fo.x - v.x) * fx + (fo.z - v.z) * fz < -(fo.ty.L / 2 + 1.5) || fo.dead) { v.filtO = null; v.latT = 0; }
      } else if (blocker && blocker !== 'player' && !blocker.ty.scooter && minGap < 12 && blocker.v < 0.65 * v0 && e0.w >= 6) {
        const off = laneOff(e0, v), half = e0.w / 2 - 0.5;
        let want = 0;
        if (Math.abs(off + 1.75) < half && (e0.ow || e0.w >= 8)) want = 1.75;
        else if (e0.ow && Math.abs(off - 1.75) < half) want = -1.75;
        if (want) { v.latT = want; v.filtO = blocker; }
      }
    }
    let acc = a * (1 - Math.pow(sp / v0, 4)) + minI;
    v.acc = clamp(acc, -9, a);
  }

  function integrate(v, dt) {
    const ty = v.ty, route = v.route;
    v.stopT = Math.max(0, v.stopT - dt);
    v.v = Math.max(0, v.v + (v.acc || 0) * dt);
    if (v.v < 0.25) v.stuck += dt; else if (v.v > 1) v.stuck = 0;
    // steer: pure pursuit on the lane line
    let e0 = route[0];
    v.lat += (v.latT - v.lat) * Math.min(1, 3 * dt);
    const Ld = Math.max(2.5, 2.0 + v.v * 0.55), s = v.t + Ld;
    let tx, tz;
    if (s <= e0.len || !route[1]) {
      const o = laneOff(e0, v) + v.lat;
      tx = NX[e0.a] + e0.dx * s + e0.rx * o; tz = NZ[e0.a] + e0.dz * s + e0.rz * o;
    } else {
      const e1 = route[1], s2 = Math.min(s - e0.len, e1.len), o = laneOff(e1, v) + v.lat;
      tx = NX[e1.a] + e1.dx * s2 + e1.rx * o; tz = NZ[e1.a] + e1.dz * s2 + e1.rz * o;
    }
    const err = wrapPi(Math.atan2(tx - v.x, tz - v.z) - v.h), maxYaw = v.v / ty.rmin;
    v.yaw = clamp(err * 3.5, -maxYaw, maxYaw);
    v.h += v.yaw * dt;
    v.x += (Math.sin(v.h) * v.v + v.ex) * dt; v.z += (Math.cos(v.h) * v.v + v.ez) * dt;
    const damp = Math.exp(-4 * dt); v.ex *= damp; v.ez *= damp;
    // progress along the route
    let t = (v.x - NX[e0.a]) * e0.dx + (v.z - NZ[e0.a]) * e0.dz;
    for (let g = 0; g < 2 && t > e0.len - 0.3 && route[1]; g++) {
      route.shift(); if (v.plan) { v.cur = (v.cur + 1) % v.plan.edges.length; if (v.cur === 0) v.si = 0; } extendRoute(v); e0 = route[0];
      t = (v.x - NX[e0.a]) * e0.dx + (v.z - NZ[e0.a]) * e0.dz;
    }
    v.t = t;
    if (ty.scooter) v.roll += (clamp(-v.yaw * v.v * 0.05, -0.38, 0.38) - v.roll) * Math.min(1, 6 * dt);
    v.age += dt;
    // honks: the player is in the way, or a delayed one after a bump
    if (v.v < 0.5 && v.blocker === 'player') {
      v.blockT += dt;
      if (v.blockT > 2.2) { v.blockT = -1.2; honk(v); if (Math.random() < 0.5) env.shout?.(v.x, groundY(v.x, v.z) + 1.6, v.z); }
    } else if (v.blockT > 0) v.blockT = 0; else if (v.blockT < 0) v.blockT = Math.min(0, v.blockT + dt);
    if (v.honkAt > 0 && time >= v.honkAt) { v.honkAt = -1; honk(v); }
  }

  function buildOcc() {
    for (const n of touchedNodes) NOCC[n].length = 0;
    touchedNodes.length = 0;
    for (const e of touchedEdges) e.veh.length = 0;
    touchedEdges.length = 0;
    for (const v of vs) {
      const e = v.route[0];
      if (!e.veh.length) touchedEdges.push(e);
      e.veh.push(v);
      if (e.len - v.t < 34) occAdd(e.b, v);
      if (v.t < 9) occAdd(e.a, v);
    }
  }
  const touchedEdges = [], touchedNodes = [];
  function occAdd(n, v) {
    const l = NOCC[n] || (NOCC[n] = []);
    if (!l.length) touchedNodes.push(n);
    l.push(v);
  }

  // ---------- horn ----------
  const audio = { ctx: null, master: null, vol: 0.8, last: -9 };
  function startAudio() {
    if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { audio.ctx = new AC(); audio.master = audio.ctx.createGain(); audio.master.gain.value = audio.vol * 0.12; audio.master.connect(audio.ctx.destination); } catch (e) { audio.ctx = null; }
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, startAudio, { passive: true });
  function honk(v) {
    const a = audio, ctx = a.ctx;
    if (!ctx || ctx.state !== 'running' || a.vol <= 0) return;
    const now = ctx.currentTime;
    if (now - a.last < 0.8) return;
    const d = Math.hypot(v.x - camera.position.x, v.z - camera.position.z), g = Math.max(0, 1 - d / 90);
    if (g < 0.05) return;
    a.last = now;
    const f0 = v.ty.bus ? 185 : v.ty.scooter ? 520 : 330 + Math.random() * 70, beeps = Math.random() < 0.4 ? 2 : 1;
    for (let k = 0; k < beeps; k++) {
      const t0 = now + k * 0.3, dur = beeps === 2 ? 0.14 : 0.26 + Math.random() * 0.12;
      const out = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1500;
      out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(g * g, t0 + 0.02); out.gain.setValueAtTime(g * g, t0 + dur); out.gain.linearRampToValueAtTime(0, t0 + dur + 0.05);
      lp.connect(out); out.connect(a.master);
      for (const f of [f0, f0 * 1.26]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.08);
      }
    }
  }

  // ---------- step ----------
  function stepAll(dt) {
    time += dt;
    buildOcc();
    for (let i = 0; i < vs.length; i++) control(vs[i], dt);
    for (let i = 0; i < vs.length; i++) integrate(vs[i], dt);
  }
  function cull(cx, cz) {
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i], dx = v.x - cx, dz = v.z - cz, d2 = dx * dx + dz * dz;
      let kill = d2 > R_DESPAWN * R_DESPAWN;
      const lat = Math.abs((v.x - NX[v.route[0].a]) * v.route[0].rx + (v.z - NZ[v.route[0].a]) * v.route[0].rz);
      if (lat > 8) kill = true;
      if (!kill && (v.stuck > 35 || (!v.route[1] && v.stuck > 6) || v.age > 600)) {
        const vis = d2 < 45 * 45 || inView(v.x, 1, v.z, v.ty.L * 0.6);
        if (!vis || v.stuck > 140) kill = d2 > 30 * 30;
      }
      if (!kill && d2 > R_KEEP_UNSEEN * R_KEEP_UNSEEN && !inView(v.x, groundY(v.x, v.z) + 1, v.z, v.ty.L * 0.6 + 2)) kill = true;
      if (kill) removeAt(i);
    }
  }

  function writeInstances() {
    for (const k in MESH) MESH[k].count = 0;
    agentsOut.length = 0;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], m = MESH[v.ty.model], n = m.count++;
      const c = Math.cos(v.h), s = Math.sin(v.h), cr = Math.cos(v.roll), sr = Math.sin(v.roll), o = n * 16, A = m.instanceMatrix.array;
      A[o] = c * cr; A[o + 1] = sr; A[o + 2] = -s * cr; A[o + 3] = 0;
      A[o + 4] = -c * sr; A[o + 5] = cr; A[o + 6] = s * sr; A[o + 7] = 0;
      A[o + 8] = s; A[o + 9] = 0; A[o + 10] = c; A[o + 11] = 0;
      A[o + 12] = v.x; A[o + 13] = groundY(v.x, v.z); A[o + 14] = v.z; A[o + 15] = 1;
      if (v.plan) SIGN_ROW.array[n] = v.plan.row;
      const C = m.instanceColor.array; C[n * 3] = v.col.r; C[n * 3 + 1] = v.col.g; C[n * 3 + 2] = v.col.b;
      for (const [zo, r] of v.ty.circ) agentsOut.push({ x: v.x + s * zo, z: v.z + c * zo, r });
    }
    for (const k in MESH) { const m = MESH[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    if (SIGN) { SIGN.count = MESH.bus.count; SIGN_ROW.needsUpdate = true; }
  }

  let acc = 0;
  function update(dt, cam) {
    if (frozen) return;
    frames++;
    cam = cam || camera;
    cam.updateMatrixWorld();
    inv.copy(cam.matrixWorld).invert();
    fm.multiplyMatrices(cam.projectionMatrix, inv); frustum.setFromProjectionMatrix(fm);
    const cx = cam.position.x, cz = cam.position.z;
    acc += Math.min(dt, 0.1);
    while (acc >= STEP) { acc -= STEP; stepAll(STEP); }
    cull(cx, cz);
    if (time >= nextCand || Math.hypot(cx - candX, cz - candZ) > 40) { rebuildCandidates(cx, cz); nextCand = time + 0.7; }
    if (PLANS.length && (counts.bus || 0) < CAPS.bus && time >= nextBus) {
      nextBus = time + 1.2;
      rebuildBusCandidates(cx, cz);
      for (let k = 0; k < 8; k++) if (trySpawnBus()) break;
    }
    const deficit = target - vs.length;
    if (deficit > 0) {
      let tries = deficit > 12 ? 40 : 6, made = deficit > 12 ? 10 : 2;
      while (tries-- > 0 && made > 0) if (trySpawn()) made--;
    }
    writeInstances();
    if (DEBUG && !debugDone) { debugDone = true; runDebug(); }
  }

  // ---------- the player ----------
  const PR = 0.74, PAX = 0.72, I_YAW = 1.7, E = 0.25;
  function wallPush(v) {
    const s = Math.sin(v.h), c = Math.cos(v.h);
    for (const [zo, r] of v.ty.circ) {
      const cx = v.x + s * zo, cz = v.z + c * zo;
      walls2d.query(cx - r, cz - r, cx + r, cz + r, seg => {
        const q = closestOnSeg(v.x + s * zo, v.z + c * zo, seg);
        const dx = v.x + s * zo - q[0], dz = v.z + c * zo - q[1], d = Math.hypot(dx, dz);
        if (d < r && d > 1e-4) { v.x += dx / d * (r - d); v.z += dz / d * (r - d); }
      });
    }
  }
  function collidePlayer(pc) {
    const sn = Math.sin(pc.th), cs = Math.cos(pc.th);
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], ty = v.ty, dx = v.x - pc.x, dz = v.z - pc.z, reach = ty.L / 2 + 2.6;
      if (dx * dx + dz * dz > reach * reach) continue;
      let touched = false;
      const vsn = Math.sin(v.h), vcs = Math.cos(v.h);
      for (let sg = 0; sg < 2; sg++) {
        const a = sg ? -PAX : PAX;
        for (let k = 0; k < ty.circ.length; k++) {
          const px = pc.x + sn * a, pz = pc.z + cs * a, zo = ty.circ[k][0], r = ty.circ[k][1];
          let nx = px - (v.x + vsn * zo), nz = pz - (v.z + vcs * zo), d = Math.hypot(nx, nz);
          const rs = PR + r;
          if (d >= rs) continue;
          touched = true;
          if (d < 1e-4) { nx = sn; nz = cs; d = 1e-4; } else { nx /= d; nz /= d; }
          const pen = rs - d, mp = 1, mv = ty.mass, shP = mv / (mp + mv), shV = mp / (mp + mv);
          pc.x += nx * pen * shP; pc.z += nz * pen * shP; v.x -= nx * pen * shV; v.z -= nz * pen * shV;
          const lx = cs, lz = -sn;
          const vn = (pc.vx + pc.w * a * lx - (vsn * v.v + v.ex)) * nx + (pc.vz + pc.w * a * lz - (vcs * v.v + v.ez)) * nz;
          if (vn < 0) {
            const arm = a * (lx * nx + lz * nz), j = -(1 + E) * vn / (1 / mp + 1 / mv + arm * arm / I_YAW);
            pc.vx += j / mp * nx; pc.vz += j / mp * nz; pc.w = clamp(pc.w + clamp(j * arm / I_YAW * 0.7, -1.6, 1.6), -3.2, 3.2);
            pc.vf = pc.vx * sn + pc.vz * cs;
            const dvx = -j / mv * nx, dvz = -j / mv * nz, along = dvx * vsn + dvz * vcs;
            v.v = Math.max(0, v.v + along); v.ex += dvx - along * vsn; v.ez += dvz - along * vcs;
          }
        }
      }
      if (touched) {
        if (v.stopT <= 0) { v.honkAt = time + 0.35 + Math.random() * 0.3; env.shout?.(v.x, groundY(v.x, v.z) + 1.6, v.z); }
        v.stopT = Math.max(v.stopT, 1.0 + Math.random() * 0.8);
        wallPush(v);
      }
    }
  }

  // ---------- debug (removed after tuning) ----------
  let debugDone = false, frozen = false;
  function runDebug() {
    const cam = camera, cx = car.x, cz = car.z, log = [];
    const car0 = [car.x, car.z]; car.x = 9000; car.z = 9000; // park the player out of the way for the flow test
    cam.position.set(cx, 25, cz); cam.lookAt(cx, 0, cz + 1);
    const mask = document.createElement('canvas'), [x0, z0, x1, z1] = D.streets.aoi;
    mask.width = Math.ceil(x1 - x0); mask.height = Math.ceil(z1 - z0);
    const g = mask.getContext('2d'); g.fillStyle = '#fff';
    for (const layer of ['asphalt', 'paving']) for (const poly of D.streets[layer]) {
      g.beginPath();
      for (const ring of poly) for (let i = 0; i < ring.length; i += 2) g[i ? 'lineTo' : 'moveTo'](ring[i] - x0, ring[i + 1] - z0);
      g.fill('evenodd');
    }
    const md = g.getImageData(0, 0, mask.width, mask.height).data, onRoad = (x, z) => { const i = (x - x0) | 0, j = (z - z0) | 0; return md[(j * mask.width + i) * 4 + 3] > 127; };
    let tmax = 0, ttot = 0, tn = 0, off = 0, offN = 0, overl = 0, overlN = 0;
    const types = {}, ovk = {}, ovs = [];
    for (let s = 0; s < 1800; s++) {
      const t0 = performance.now();
      update(1 / 30, cam);
      const dtm = performance.now() - t0; ttot += dtm; tn++; if (s > 60 && dtm > tmax) tmax = dtm;
      if (s > 60) for (const v of vs) { offN++; if (!onRoad(v.x, v.z)) off++; }
      if (s > 60) for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
        const a = vs[i], b = vs[j]; if (Math.abs(a.x - b.x) > 6 || Math.abs(a.z - b.z) > 6) continue;
        let hit = false;
        for (const [za, ra] of a.ty.circ) for (const [zb, rb] of b.ty.circ)
          if (Math.hypot(a.x + Math.sin(a.h) * za - b.x - Math.sin(b.h) * zb, a.z + Math.cos(a.h) * za - b.z - Math.cos(b.h) * zb) < (ra + rb) * 0.75) hit = true;
        overlN++; if (hit) { overl++; const cj = Math.cos(a.h - b.h), k = (cj > 0.7 ? 'same' : cj < -0.7 ? 'opp' : 'cross') + (a.route[0] === b.route[0] ? '/sameEdge' : '') + (a.stuck > 20 || b.stuck > 20 ? '/ghost' : '') + (a.hold || b.hold ? '/hold' : '') + (a.ty.scooter || b.ty.scooter ? '/scooter' : ''); ovk[k] = (ovk[k] || 0) + 1; if (k === 'opp/hold' && ovs.length < 6 && s % 7 === 0) ovs.push(`${a.name}(${a.hold ? a.why : 'm'},v${a.v.toFixed(1)},${a.route[0].name}${a.route[0].ow ? '1w' : '2w'} w${a.route[0].w}) x ${b.name}(${b.hold ? b.why : 'm'},v${b.v.toFixed(1)},${b.route[0].name}${b.route[0].ow ? '1w' : '2w'}) @${a.x | 0},${a.z | 0}`); }
      }
      if (s % 150 === 149) {
        let sp = 0, stuck = 0, wait = 0; const cause = {};
        for (const v of vs) { sp += v.v; if (v.stuck > 20) stuck++; if (v.wait > 0.5) wait++; if (v.v < 0.5) { const k = v.hold ? 'H' + v.why : v.blocker ? 'follow' : 'free'; cause[k] = (cause[k] || 0) + 1; } }
        log.push(`t=${((s + 1) / 30) | 0}s n=${vs.length}/${target} avgV=${(sp / Math.max(1, vs.length)).toFixed(1)} stuck20=${stuck} waiting=${wait} ms=${(ttot / tn).toFixed(2)} ${JSON.stringify(cause)}`);
      }
    }
    car.x = car0[0]; car.z = car0[1];
    for (const v of vs) types[v.name] = (types[v.name] || 0) + 1;
    const dump = vs.filter(v => v.stuck > 15).slice(0, 14).map(v => `${v.name}@${v.x | 0},${v.z | 0} v=${v.v.toFixed(1)} v0=${v.v0.toFixed(1)} hold=${v.hold} wait=${v.wait.toFixed(0)} gap=${v.minGap.toFixed(1)} blk=${v.blocker ? (v.blocker === 'player' ? 'PLAYER' : v.blocker.name + '@' + (v.blocker.x | 0) + ',' + (v.blocker.z | 0)) : '-'} rem=${(v.route[0].len - v.t).toFixed(0)} e=${v.route[0].name}${v.route[0].ow ? '(1w)' : ''} ndeg=${NDEG[v.route[0].b]} routeN=${v.route.length}`);
    const hv = vs.filter(v => v.hold && (v.why === 'inbox' || v.why === 'exit')).slice(0, 8).map(v => { const o = v.why2; return `${v.id}:${v.name}@${v.x | 0},${v.z | 0} why=${v.why} rem=${(v.route[0].len - v.t).toFixed(0)} node=${v.route[0].b} wait=${v.wait.toFixed(1)} ${o && v.why === 'inbox' ? `<- ${o.id}:${o.name}@${o.x | 0},${o.z | 0} v=${o.v.toFixed(1)} remO=${(o.route[0].len - o.t).toFixed(1)} onNode=${o.route[0].b} hold=${o.hold}/${o.why} blk=${o.blocker && o.blocker.id}` : ''}`; });
    console.log('TRAFFIC holds ' + hv.join(' || '));
    const wf = v => v.hold ? v.why2 : (v.blocker && v.blocker !== 'player' ? v.blocker : null);
    const cycles = new Set();
    for (const v of vs) { if (v.v > 0.5) continue; let r = v, n = 0; const path = []; while (r && n++ < 60) { if (path.includes(r)) { cycles.add(path.slice(path.indexOf(r)).map(q => `${q.id}:${q.name}(${q.hold ? q.why : 'f'})@${q.x | 0},${q.z | 0}`).join('>')); break; } path.push(r); r = wf(r); } }
    console.log('TRAFFIC cycles ' + [...cycles].slice(0, 5).join(' || '));
    const roots = {};
    for (const v of vs) if (v.stuck > 15) { let r = v, n = 0; while (r.blocker && r.blocker !== 'player' && n++ < 40) r = r.blocker; const k = (r.blocker === 'player' ? 'PLAYER' : r.hold ? 'hold:' + r.why : 'free') + ' rank' + r.route[0].rank + ' deg' + NDEG[r.route[0].b]; roots[k] = (roots[k] || 0) + 1; }
    console.log('TRAFFIC buses ' + vs.filter(v => v.plan).map(v => `${v.plan.ref}>${v.plan.to}@${v.x | 0},${v.z | 0},h${v.h.toFixed(2)} stop${v.si}/${v.plan.stops.length} dwell${v.dwell.toFixed(0)} v${v.v.toFixed(1)}`).join(' | '));
    const camTarget = vs.find(v => v.name === (/trafficcam=(\w+)/.exec(location.search) || [])[1]);
    if (camTarget) {
      const o = camera.updateMatrixWorld.bind(camera), v = camTarget, fx = Math.sin(v.h), fz = Math.cos(v.h);
      frozen = true;
      camera.updateMatrixWorld = f => { camera.position.set(v.x + fx * 10 - fz * 1.2, groundY(v.x, v.z) + 3.4, v.z + fz * 10 + fx * 1.2); camera.lookAt(v.x, groundY(v.x, v.z) + 1.6, v.z); o(f); };
    }
    console.log('TRAFFIC busSpawned ' + dbgBus + ' dwells ' + dbgDwell + ' plans ' + PLANS.length + ' planStops ' + PLANS.reduce((q, p) => q + p.stops.length, 0) + ' ' + PLANS.map(p => p.ref + ':' + p.edges.length + 'e/' + p.stops.length + 's').join(' '));
    console.log('TRAFFIC ovsamples ' + ovs.join(' || '));
    console.log('TRAFFIC overlaps ' + JSON.stringify(ovk));
    console.log('TRAFFIC roots ' + JSON.stringify(roots));
    const rs = new Set();
    for (const v of vs) if (v.stuck > 15) { let r = v, n = 0; while (r.blocker && r.blocker !== 'player' && n++ < 40) r = r.blocker; if (!r.hold) rs.add(r); }
    const fr = [...rs].slice(0, 6).map(v => { const e = v.route[0]; return `${v.name}@${v.x | 0},${v.z | 0} ${e.name}${e.ow ? '(1w)' : ''} rank${e.rank} rem=${(e.len - v.t).toFixed(1)} route=${v.route.length} outs=${NOUT[e.b].map(c => (c.ped ? 'P' : '') + (allowed(c, v.ty) ? 'ok' : 'no') + c.rank).join(',')} v0=${v.v0.toFixed(1)} v=${v.v.toFixed(2)} gap=${v.minGap.toFixed(1)} stopT=${v.stopT.toFixed(1)} stuck=${v.stuck.toFixed(0)} blk=${v.blocker}`; });
    console.log('TRAFFIC free ' + fr.join(' || '));
    console.log('TRAFFIC stuck: ' + dump.join(' || '));
    console.log('TRAFFIC ' + log.join(' | '));
    console.log(`TRAFFIC mean update ${(ttot / tn).toFixed(2)} ms, max ${tmax.toFixed(2)} ms, offAsphalt ${(100 * off / Math.max(1, offN)).toFixed(1)}%, overlapPairs ${overl} of ${overlN} pair-frames, graph nodes ${NX.length} edges ${EDGES.length}, types ${JSON.stringify(types)}`);
  }

  return {
    update, collidePlayer,
    agents: () => agentsOut,
    setVolume(v) { audio.vol = clamp(+v || 0, 0, 1); if (audio.master) audio.master.gain.value = audio.vol * 0.12; },
  };
}
