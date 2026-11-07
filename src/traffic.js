// Traffic: vehicles driving the OSM road graph. Owned by the traffic work.
// createTraffic(env) with env = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D }.
// Returns { update(dt, camera), collidePlayer(car), agents(), setVolume(v) }.
//
// Design in one paragraph: the road centrelines of the full-detail world tiles become a directed graph (src/traffic-graph.js: it
// grows and shrinks with the tiles, borders join on the clipped endpoints, one-ways respected). Each vehicle holds a short route of directed edges, follows the lane line of
// its current edge with pure pursuit, and brakes with the Intelligent Driver Model for leaders (found
// along its route, in a forward corridor, and the player), corners, junction priority (rank of the road
// class, then yield to the right). Vehicles are spawned out of
// view around the camera, despawned out of view, and drawn with one InstancedMesh per model. A knot that nobody can untie (each waits for the next, round in a
// ring) is broken by unjam(); a vehicle that has stood in one place too long is taken away once nobody sees it (cull). tools/perf/gridlock.mjs counts gridlocks.
// A vehicle stopped behind something that is not going to move (the lapa standing still, a double-parked car, a bus at its stop) goes round it when there is room (planOt).
import * as THREE from 'three';
import { proj, freeCanvas } from './core.js';
import { topY } from './bridges.js';   // the highest deck at a point: traffic on a bridge road drives on it
import { parked } from './props.js';   // the cars parked along the kerbs: obstacles to steer round, and to run into
import { createGraph, CLASS } from './traffic-graph.js';
import { signalSites, light as signalLight, clock as signalClock, STOP_BACK } from './signals.js';   // the signals: which approach each one governs, and its light on the shared wall clock
import { buildModels, makeMaterial, busSignGeometry } from '../assets/traffic/models.js';
import { BUS_ROUTES, BUS_STOPS } from '../assets/traffic/bus-routes.js';
import { buildPoliceModels, makePoliceDecal } from '../assets/traffic/police-models.js';
import { makeCarrettoDecal } from '../assets/traffic/carretto-art.js';   // the painted boards of the Sicilian cart
import { createPolice, createBeacons } from './police.js';   // wanted system, police chase, siren, HUD
import { createGags } from './gags.js';                         // lookouts, the team bus, double-parking quarrels
import { createCarrozze } from './carrozze.js';                 // the tourist carrozze: their loop, coachman and passengers
import { createVendors } from './vendors.js';                   // the Apes and carrozze that call out now and then
import { createArrotini } from './arrotini.js';             // the knife-grinders: several, each on a loop of his own in a quarter of the city, by day only

// ---------- tuning ----------
const hyp2 = (a, b) => Math.sqrt(a * a + b * b); // [perf pass] Math.hypot boxes a heap number per call; this runs thousands of times per frame
const R_SPAWN_MIN = 35, R_SPAWN_MAX = 215, R_FAR = 125, R_DESPAWN = 235, R_KEEP_UNSEEN = 150; // out of view: spawn within R_KEEP_UNSEEN, despawn beyond it
const STEP = 1 / 30;
const LANE_PER_CAR = 36; // metres of drivable lane (weighted by road class) per vehicle within 140 m of the camera

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
    rmin: 9.5, vcap: 11, bus: true, transit: true, minW: 6, cols: [['#f2c316', 5], ['#e9b80d', 3], ['#f5cf3b', 2]],
    yeetV: 14, yeetK: 0.3, yeetJ: 0.5 },   // heavy: pushed like the rest (it barely budges), but only knocked over (tipped, a short hop) above 14 m/s of closing speed; the lapa loses 0.5 of it
  vespa: { model: 'vespa', L: 1.8, W: 0.7, mass: 0.28, circ: [[0.5, 0.45], [-0.4, 0.45]], vf: 1.08, a: 3.4, T: 0.7, s0: 1.2, rmin: 2.8, scooter: true, ped: true,
    cols: [['#c8301f', 3], ['#2f6f9a', 3], ['#e6e2d0', 3], ['#2a2a2c', 3], ['#5a7a4a', 1], ['#d9a21f', 1], ['#bcbcbc', 2]] },
  apePick: { model: 'apePick', L: 3.2, W: 1.4, mass: 0.8, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.75, a: 1.5, rmin: 3.6, vcap: 9, ped: true,
    cols: [['#e9e4d2', 3], ['#7fa3c0', 3], ['#c2362c', 2], ['#4e7a4c', 2], ['#f4f4f0', 3]] },
  apeCrate: { model: 'apeCrate', L: 3.2, W: 1.4, mass: 0.9, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.7, a: 1.4, rmin: 3.6, vcap: 8.5, ped: true,
    cols: [['#e9e4d2', 3], ['#d6a24a', 2], ['#7fa3c0', 2], ['#4e7a4c', 2]] },
  apeFrutta: { model: 'apeFrutta', hy: 2.1, L: 3.2, W: 1.4, mass: 0.9, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.7, a: 1.4, rmin: 3.6, vcap: 8.5, ped: true,
    cols: [['#e9e4d2', 3], ['#d6a24a', 2], ['#7fa3c0', 2], ['#4e7a4c', 2], ['#c2362c', 1]] },
  apeSfincione: { model: 'apeSfincione', hy: 2.7, L: 3.2, W: 1.4, mass: 1.0, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.65, a: 1.3, rmin: 3.6, vcap: 8, ped: true,
    cols: [['#efe3c8', 3], ['#e8c46a', 2], ['#8fb3a0', 1]] },
  apeFood: { model: 'apeFood', hy: 2.7, L: 3.2, W: 1.4, mass: 1.0, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.65, a: 1.3, rmin: 3.6, vcap: 8, ped: true,
    cols: [['#efe3c8', 3], ['#e8c46a', 2], ['#c2362c', 1]] },
  carrozza: { model: 'carrozzaTour', hy: 2.5, L: 6.7, W: 1.3, mass: 1.5, circ: [[2.6, 0.7], [0.8, 0.8], [-0.8, 0.8]], vf: 0.4, vcap: 2.7, a: 0.8, b: 2.2, T: 1.4, s0: 2.0, rmin: 6, ped: true,
    cols: [['#5a3a24', 4], ['#2a2220', 2], ['#8a5a34', 3], ['#a9a49a', 1]] },
  carretto: { model: 'carretto', hy: 2.9, L: 5.9, W: 1.9, mass: 1.2, circ: [[1.9, 0.7], [0.0, 0.85], [-0.85, 0.85]], vf: 0.4, vcap: 2.3, a: 0.8, b: 2.2, T: 1.4, s0: 2.0, rmin: 5, ped: true,
    cols: [['#2e2a26', 2], ['#6a4a30', 2]] },
};
TYPES.vespaB = { ...TYPES.vespa, model: 'vespaB' };
TYPES.bus.hy = 3.6;
// Police (src/police.js): copV is the speed they reach when boxing the lapa in off the road graph.
TYPES.polizia = { model: 'polizia', L: 4.5, W: 1.78, mass: 1.3, circ: [[1.4, 0.95], [0, 0.95], [-1.4, 0.95]], cols: [['#f2f2f0', 1]], rmin: 4.8, copV: 25 };
TYPES.carab = { ...TYPES.polizia, model: 'carab', cols: [['#1f2f5c', 1]] };
TYPES.apePol = { model: 'apePol', L: 3.2, W: 1.4, mass: 0.9, circ: [[0.8, 0.78], [-0.7, 0.78]], vf: 0.75, a: 1.8, rmin: 3.6, vcap: 12, ped: true, copV: 12, cols: [['#e3ebf3', 1]] };
// Lookouts and the team bus (src/gags.js)
TYPES.monopattino = { model: 'monopattino', L: 1.2, W: 0.55, mass: 0.2, circ: [[0.3, 0.4], [-0.2, 0.4]], vf: 1.15, a: 3.0, T: 0.7, s0: 1.0, rmin: 2.2, scooter: true, ped: true, hy: 1.95,
  cols: [['#c23b3b', 2], ['#2f6f9a', 2], ['#2a2a2c', 2], ['#d8c36a', 1], ['#5a7a4a', 1], ['#e8559a', 1]] };
TYPES.teamBus = { ...TYPES.bus, model: 'teamBus', cols: [['#ee6aa6', 1]] };
TYPES.arrotino = { ...TYPES.apeCrate, cols: [['#c2362c', 1]], vcap: 7 };   // l'arrotino, the knife-grinder (src/arrotini.js, his loudspeaker is src/city-audio.js): an Ape that goes round a loop of its own
for (const t of Object.values(TYPES)) {
  Object.assign(t, { vf: 1, a: 2.6, b: 3.2, T: 0.95, s0: 1.6, rmin: 4.2, vcap: 99, minW: 0 }, { ...t });
  t.cls = t.bus ? 2 : t.ped ? (t.vcap < 15 || t.scooter ? 3 : 1) : 0; // 0 cars (no pedestrian streets), 1 walking-pace capable (vans), 2 buses, 3 slow ones (apes, scooters, carts: no motorways)
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
  // one profile for every device (docs/PERF.md): same traffic on desktop and phone
  const MAXV = 60;
  let densK = 1;   // graphics setQuality(): a share of MAXV (src/perf.js lowers it last, on a device that cannot hold the frame rate)
  const CAPS = { bus: 3, carrozza: 2, carretto: 1 };

  // ---------- road graph ----------
  // Tiles stream in and out (env.world.onTile); their roads are added in time slices and the vehicles on a dropped tile go with it.
  const world = env.world;
  const G = createGraph();
  const { NX, NZ, NOUT, NIN, NDEG, NBOX, NOCC, EDGES } = G;
  if (D.roads) G.setBaked(D.roads);   // the baked centro roads know the one-ways and roundabouts that the tile roads lack
  const baseAllowed = G.baseAllowed;
  const addQ = [], building = new Set();   // tiles waiting for their roads / being built
  let graphDirty = false, dirtyAt = 0, stepping = null;
  // ---------- AMAT bus lines (OSM route relations, baked in assets/traffic/bus-routes.js) ----------
  // Each route piece is matched onto the graph into a plan: the directed edges in travel order, plus the stops that lie on it.
  // Buses only run these plans. Plans are rebuilt whenever tiles under the routes come or go; a route that runs into a tile that
  // is not loaded just ends there (the bus stops and is removed once nobody sees it). The routes are baked for the centro only.
  const findEdge = (a, b) => NOUT[a].find(c => c.b === b);
  const findNode = (x, z) => G.nearestNode(x, z, 6, false);
  function gapPath(a, b) { // shortest hop path over any edges, to bridge a missing link in a route
    const prev = new Map([[a, null]]); let front = [a];
    for (let h = 0; h < 12 && front.length; h++) {
      const nf = [];
      for (const n of front) for (const c of NOUT[n]) if (!prev.has(c.b)) { prev.set(c.b, c); if (c.b === b) { const out = []; for (let e = c; e; e = prev.get(e.a)) out.unshift(e); return out; } nf.push(c.b); }
      front = nf;
    }
    return null;
  }
  let PLANS = [];
  const ROWS = [];
  for (const r of BUS_ROUTES) if (ROWS.findIndex(q => q.ref === r.ref && q.to === r.to) < 0) ROWS.push({ ref: r.ref, to: r.to });
  function* planJob() {   // a generator: the caller steps it a little each frame (the routes now cover the whole city)
    const plans = []; let t0 = performance.now();
    const tired = () => performance.now() - t0 > 1.5;
    for (const r of BUS_ROUTES) {
      const row = ROWS.findIndex(q => q.ref === r.ref && q.to === r.to);
      const rstops = []; for (let i = 0; i + 1 < r.stops.length; i += 2) rstops.push([r.stops[i], r.stops[i + 1]]);
      for (const pc of r.pieces) {
        let edges = [];
        const flush = () => { if (edges.length >= 6) plans.push({ ref: r.ref, to: r.to, row, edges, stops: [], rstops }); edges = []; };
        let prevN = -1, lti = 1e9, ltj = 1e9, res = false;
        for (let i = 0; i + 1 < pc.length; i += 2) {
          const ti = Math.floor(pc[i] / 500), tj = Math.floor(pc[i + 1] / 500);
          if (ti !== lti || tj !== ltj) { lti = ti; ltj = tj; res = G.tiles.has(ti + '_' + tj); }
          const n = res ? findNode(pc[i], pc[i + 1]) : -1;
          if (n < 0) { if (prevN >= 0) flush(); prevN = -1; continue; }   // not resident: the plan ends here
          if (n === prevN) continue;
          if (prevN >= 0) {
            const e = findEdge(prevN, n);
            if (e) edges.push(e);
            else { const g = gapPath(prevN, n); if (g) edges.push(...g); else flush(); }
          }
          prevN = n;
        }
        flush();
        if (tired()) { yield; t0 = performance.now(); }
      }
    }
    for (const pl of plans) {
      if (tired()) { yield; t0 = performance.now(); } // stops: the relation's own plus every OSM bus stop within a few metres of the line
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const e of pl.edges) { x0 = Math.min(x0, NX[e.a]); x1 = Math.max(x1, NX[e.a]); z0 = Math.min(z0, NZ[e.a]); z1 = Math.max(z1, NZ[e.a]); }
      const cand = pl.rstops.slice(); for (let i = 0; i + 1 < BUS_STOPS.length; i += 2) cand.push([BUS_STOPS[i], BUS_STOPS[i + 1]]);
      const found = [];
      for (const [sx, sz] of cand) {
        if (sx < x0 - 30 || sx > x1 + 30 || sz < z0 - 30 || sz > z1 + 30) continue;
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
    PLANS = plans;
  }

  // ---------- instanced meshes ----------
  const MODELS = buildModels(), MAT = makeMaterial();
Object.assign(MODELS, buildPoliceModels());
  const CAP = MAXV + 16, MESH = {};
  for (const name of Object.keys(MODELS)) {
    const m = new THREE.InstancedMesh(MODELS[name], MAT, CAP);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    scene.add(m); MESH[name] = m;
  }
  const DECAL = makePoliceDecal(MESH.apePol, CAP); scene.add(DECAL);   // the word POLIZIA on the lapino
  const CART_DECAL = makeCarrettoDecal(MESH.carretto, CAP); scene.add(CART_DECAL);   // the painted boards of the Sicilian cart
  const TEAM_ROW = ROWS.length; if (BUS_ROUTES.length) ROWS.push({ ref: '', to: 'ROSANERO' });   // the team bus's LED board
  // LED destination boards: one atlas row per line, picked per instance
  const SIGN_ROW = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  let SIGN = null, SIGN_T = null;
  if (ROWS.length) {
    const cv = document.createElement('canvas'), W = 128, H = 16;
    cv.width = W * 2; cv.height = H * 2 * ROWS.length;
    const g = cv.getContext('2d'), tmp = document.createElement('canvas'), tg = tmp.getContext('2d');
    tmp.width = W; tmp.height = H; g.imageSmoothingEnabled = false;
    const paintRows = () => { g.imageSmoothingEnabled = false; ROWS.forEach((r, i) => {
      tg.fillStyle = '#080604'; tg.fillRect(0, 0, W, H);
      const text = (r.ref + ' ' + r.to).trim().toUpperCase().replace(/^(PARCHEGGIO|PIAZZALE|STAZIONE) /, m => m.slice(0, 4) + '. ');
      let px = 11; tg.textBaseline = 'middle';
      do { tg.font = `bold ${px}px monospace`; px--; } while (tg.measureText(text).width > W - 6 && px > 6);
      tg.fillStyle = '#ffae1a'; tg.fillText(text, 3, H / 2 + 1);
      g.drawImage(tmp, 0, i * H * 2, W * 2, H * 2);
    }); };
    paintRows();
    const tex = freeCanvas(new THREE.CanvasTexture(cv), paintRows); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
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
    const geoT = busSignGeometry(); geoT.setAttribute('row', new THREE.InstancedBufferAttribute(new Float32Array(CAP).fill(TEAM_ROW), 1));
    SIGN_T = new THREE.InstancedMesh(geoT, mat, CAP);
    SIGN_T.instanceMatrix = MESH.teamBus.instanceMatrix; SIGN_T.count = 0; SIGN_T.frustumCulled = false; scene.add(SIGN_T);
  }
  for (const t of Object.values(TYPES)) t.colObjs = t.cols.map(([h, w]) => [new THREE.Color(h), w]);

  // ---------- state ----------
  const vs = [];
  let time = 0, nextCand = 0, candCum = [], candEdges = [], candX = 1e9, candZ = 1e9, frames = 0;
  const frustum = new THREE.Frustum(), fm = new THREE.Matrix4(), fs = new THREE.Sphere(new THREE.Vector3(), 5), inv = new THREE.Matrix4();
  const SITES = [proj(38.1146, 13.3558), proj(38.1199, 13.3573), proj(38.115684, 13.361460)];
  const nearSite = (x, z) => SITES.some(s => hyp2(s[0] - x, s[1] - z) < 280);
  const counts = {};
  let nextId = 0;
  const agentsOut = [];
  const PK_OBS = [], PK_NEAR = [], PK_NEAR2 = [];   // scratch: the parked cars beside a vehicle's lane
  let police = null, gags = null, arrotini = null, peds = null;   // created at the end of createTraffic (peds: src/pedestrians.js, bound later)

  const allowed = (c, ty) => baseAllowed(c, ty.cls) && G.alive[ty.cls][c.id] === 1 && (c.ped || c.w >= ty.minW);
  function pickNext(e, ty, v) {
    const outs = NOUT[e.b]; let tot = 0, any = null;
    const ws = [], guided = v && v.rt && !v.rt.lost;   // a knife-grinder on his loop may take any road of it that the class allows, alive or not: near the edge of the resident tiles the graph has dead ends that are not real
    for (const c of outs) {
      if (c.id === e.rev || !(guided ? baseAllowed(c, ty.cls) : allowed(c, ty))) { ws.push(0); continue; }
      const cos = e.dx * c.dx + e.dz * c.dz;
      let w = ty.bus ? 1 : c.pw;
      w *= cos > 0.9 ? 2.2 : cos > 0.3 ? 1.0 : cos > -0.3 ? 0.9 : cos > -0.5 ? 0.35 : 0.01;   // a turn sharper than 120 degrees only when there is no other way: a car cannot make it inside its lane, it swings into the oncoming one and the two lock
      if (c.name && c.name === e.name) w *= 1.8;
      if (c.ped) w *= 0.4;
      ws.push(w); tot += w; any = c;
    }
    if (v) { biasRoute(v, outs, ws); if (guided && v.rt.lost) for (let i = 0; i < outs.length; i++) if (ws[i] > 0 && !allowed(outs[i], ty)) ws[i] = 0; tot = 0; for (const w of ws) tot += w; }   // (a knife-grinder who has lost his loop roams like the rest)
    if (tot <= 0) {   // a bus off its line (replan) with no bus road on: a road a car may take, straight on or a main road (tertiary and up), never a sharp turn into a back street
      if (!(ty.bus && v && !v.plan)) return null;
      let best = null, bs = -9;
      for (const c of outs) {
        const cos = e.dx * c.dx + e.dz * c.dz, sc = cos + (c.rank >= 3 ? 0.5 : 0);
        if (c.id !== e.rev && (cos > 0.7 || (c.rank >= 3 && cos > -0.3)) && sc > bs && allowed(c, TYPES.panda)) { bs = sc; best = c; }
      }
      return best;
    }
    let r = Math.random() * tot;
    for (let i = 0; i < outs.length; i++) if ((r -= ws[i]) <= 0 && ws[i] > 0) return outs[i];
    return any;
  }
  // Route choice with an aim: police head for the lapa, scared lookouts away from it, lookouts at ease stay near their market.
  function biasRoute(v, outs, ws) {
    if (v.rt && arrotini) { arrotini.guide(v, outs, ws); return; }   // a knife-grinder keeps to his loop (src/arrotini.js)
    let gx, gz, away = false;
    if (v.cop && v.cop.pursue) { gx = car.x; gz = car.z; }
    else if (v.flee) { gx = car.x; gz = car.z; away = true; }
    else if (v.home && (v.x - v.home[0]) ** 2 + (v.z - v.home[1]) ** 2 > 90 * 90) { gx = v.home[0]; gz = v.home[1]; }
    else return;
    let lo = 1e9, hi = 0; const ds = [];
    for (let i = 0; i < outs.length; i++) if (ws[i] > 0) { const d = ds[i] = hyp2(NX[outs[i].b] - gx, NZ[outs[i].b] - gz); if (d < lo) lo = d; if (d > hi) hi = d; }
    for (let i = 0; i < outs.length; i++) if (ws[i] > 0) ws[i] *= away ? Math.exp(-(hi - ds[i]) / 40) : Math.exp(-(ds[i] - lo) / 30);
  }
  function extendRoute(v) {
    const r = v.route;
    if (v.plan) {
      const pl = v.plan;
      while (r.length < 4) {
        let i = v.pidx + 1;
        if (i >= pl.edges.length) { if (!pl.closed) break; i = 0; }
        if (pl.edges[i].dead) break;
        r.push(pl.edges[i]); v.pidx = i;
      }
      return;
    }
    while (r.length < 4) { const n = pickNext(r[r.length - 1], v.ty, v); if (!n) break; r.push(n); }
  }
  // A bus whose line ran out (its plan was matched while the tiles further on were not in): onto the line's new plan if that goes on from where it is, else it drives
  // on like any other vehicle, its board unchanged. Without this it stands at the end of its old plan with a queue behind it until it is culled.
  function replan(v) {
    const r = v.route, last = r[r.length - 1], old = v.plan;
    if (old.closed || (v.pidx + 1 < old.edges.length && !old.edges[v.pidx + 1].dead)) return;
    for (const pl of PLANS) {
      if (pl === old || pl.ref !== old.ref || pl.to !== old.to) continue;
      const i = pl.edges.indexOf(last); if (i < 0 || (i + 1 >= pl.edges.length && !pl.closed)) continue;
      const n = pl.edges.length; v.plan = pl; v.pidx = i; v.cur = ((i - (r.length - 1)) % n + n) % n;
      v.si = 0; while (v.si < pl.stops.length && pl.stops[v.si].i <= v.cur) v.si++;
      return;
    }
    v.row = old.row; v.plan = null;
  }
  const laneOff = (e, v) => e.ow ? (e.w < 7 ? 0.55 : v.pref * Math.min(e.w / 4, 2.6)) : Math.min(e.w / 4, 2.6);

  // ---------- spawning ----------
  let candAcc = 0, candLane = 0, candCx = 0, candCz = 0;
  const candVisit = e => { // one edge near the camera: counts towards the traffic target and the spawn lottery
    if (!e.alive) return;
    const mx = (NX[e.a] + NX[e.b]) / 2 - candCx, mz = (NZ[e.a] + NZ[e.b]) / 2 - candCz, d2 = mx * mx + mz * mz;
    if (!e.ped && d2 < 140 * 140) candLane += e.len * e.den;
    if (d2 < R_SPAWN_MIN * R_SPAWN_MIN || d2 > R_SPAWN_MAX * R_SPAWN_MAX) return;
    candAcc += e.len * e.pw; candEdges.push(e); candCum.push(candAcc);
  };
  function rebuildCandidates(cx, cz) {
    candEdges.length = 0; candCum.length = 0; candAcc = 0; candLane = 0; candCx = cx; candCz = cz;
    G.eachEdgeNear(cx, cz, R_SPAWN_MAX, candVisit);
    candX = cx; candZ = cz;
    target = clamp(Math.round(candLane / LANE_PER_CAR), 6, Math.max(6, Math.round(MAXV * densK)));
  }
  function chooseType(e) {
    const c = counts;
    const room = k => (c[k] || 0) < CAPS[k];
    if (e.ped) {
      if (e.transit) return pickW([['apePick', 2], ['van', 1], ['vespa', 2]]);
      return pickW([['apeCrate', 2], ['apeFrutta', 2], ['apePick', 2], ['van', 3], ['apeFood', 1.3], ['apeSfincione', 1.3], ['vespa', 2]]);
    }
    if (e.fast) return pickW([['panda', 24], ['punto', 22], ['smart', 4], ['taxi', 4], ['van', 8]]);
    const near = nearSite(NX[e.a], NZ[e.a]);
    const opts = [['panda', 24], ['punto', 22], ['smart', 8], ['taxi', 5], ['van', e.w >= 3.5 ? 7 : 0], ['vespa', 14], ['vespaB', 7],
      ['apePick', 2.2], ['apeCrate', 1.4], ['apeFrutta', 1.6], ['apeFood', 1.1], ['apeSfincione', 1.1]];   // the carrozze are not here: they run their own loop (tourPlan below)
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
    const dc = hyp2(x - camera.position.x, z - camera.position.z);
    if (dc < R_SPAWN_MIN) return false;
    if (dc < R_FAR && inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3)) return false;
    if (dc > R_KEEP_UNSEEN - 10 && !inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3)) return false; // would be culled at once
    if (hyp2(x - car.x, z - car.z) < 18) return false;
    for (const o of vs) if (Math.abs(o.x - x) < 14 && Math.abs(o.z - z) < 14 && hyp2(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 4) return false;
    const v = {
      id: ++nextId, ty, name, x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref,
      lat: 0, latT: 0, drv: 0.88 + Math.random() * 0.26, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0, sigW: 0, sigHold: false, rv: 0, ot: null, otW: 0, otNext: 0, gap: 1e9,
      yaw: 0, roll: 0, col: pickW(ty.colObjs), age: 0, blocker: null,
    };
    extendRoute(v);
    if (v.route.length < 2 && e.len < 40) return false;
    vs.push(v); counts[name] = (counts[name] || 0) + 1;
    return true;
  }
  let busCand = [], busStopCand = [], nextBus = 0, target = 30;
  function rebuildBusCandidates(cx, cz) {
    busCand.length = 0; busStopCand.length = 0;
    for (const pl of PLANS) for (let i = 0; i < pl.edges.length; i++) {
      const e = pl.edges[i], dx = (NX[e.a] + NX[e.b]) / 2 - cx, dz = (NZ[e.a] + NZ[e.b]) / 2 - cz, d2 = dx * dx + dz * dz;
      if (!e.dead && d2 > R_SPAWN_MIN * R_SPAWN_MIN && d2 < R_SPAWN_MAX * R_SPAWN_MAX && e.len > 14) { busCand.push([pl, i]); if (pl.stops.some(st => st.i > i && st.i <= i + 2)) busStopCand.push([pl, i]); }
    }
  }
  function trySpawnBus(name = 'bus', cands = null) {   // cands: [plan, edge index] pairs to choose from instead of the bus lines (the tourist carrozze)
    if (!cands && !busCand.length) return false;
    const list = cands || (name === 'bus' && busStopCand.length && Math.random() < 0.7 ? busStopCand : busCand); // most buses start a little before a stop
    const [pl, i] = list[(Math.random() * list.length) | 0], e = pl.edges[i], ty = TYPES[name];
    const t = ty.L * 0.5 + 1 + Math.random() * Math.max(0, e.len - ty.L - 2);
    const x = NX[e.a] + e.dx * t + e.rx * Math.min(e.w / 4, 2.6), z = NZ[e.a] + e.dz * t + e.rz * Math.min(e.w / 4, 2.6);
    const dc = hyp2(x - camera.position.x, z - camera.position.z);
    if (dc < R_SPAWN_MIN || hyp2(x - car.x, z - car.z) < 25) return false;
    if (dc < R_FAR && inView(x, groundY(x, z) + 1.5, z, 9)) return false;
    if (dc > R_KEEP_UNSEEN - 10 && !inView(x, groundY(x, z) + 1.5, z, 9)) return false;
    for (const o of vs) if (hyp2(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 5) return false;
    let si = 0; while (si < pl.stops.length && (pl.stops[si].i < i || (pl.stops[si].i === i && pl.stops[si].t < t + 8))) si++;
    const v = {
      id: ++nextId, ty, name, x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref: 1,
      lat: 0, latT: 0, drv: 0.92 + Math.random() * 0.16, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0, sigW: 0, sigHold: false, rv: 0, ot: null, otW: 0, otNext: 0, gap: 1e9, yaw: 0, roll: 0,
      col: pickW(ty.colObjs), age: 0, blocker: null, plan: pl, cur: i, pidx: i, si: name === 'bus' ? si : pl.stops.length, dwell: 0,
    };
    extendRoute(v); vs.push(v); counts[name] = (counts[name] || 0) + 1;
    return v;
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
  const S = v => v.jamT || 0;   // jam time (integrate): unlike stuck it is not reset by a moment's creep, so a breaker that lets a vehicle go keeps letting it go until it has moved
  function mustHold(v, e, rem, exitSpace) {
    const n = e.b, ty = v.ty, sg = e.sg;   // sg: the junction is signalled, and the light is green for this vehicle (red and amber stop it before it gets here)
    if (NDEG[n] < 3) return false;
    if (sg ? S(v) > 3.5 : v.wait > 9) return false;               // gridlock breaker (at a signal: stopped for 3.5 s on green, the green is not to be wasted)
    const gh = v.ghost && v.ghost.until > time ? v.ghost.set : null;
    if (exitSpace < ty.L + 1.2 && v.wait < 2 && !(gh && gh.has(v.exitO))) { v.why2 = v.exitO; return true; } // keep the box clear, briefly
    const occ = NOCC[n]; if (!occ) return false;
    const en = v.route[1];
    const eager = v.wait > 2.5;
    for (let i = 0; i < occ.length; i++) {
      const o = occ[i]; if (o === v || (gh && gh.has(o))) continue;
      const oe = o.route[0];
      if (oe.b !== n) { // already past the node and still inside it
        if (oe.a === n && o.t < 4.5 && oe !== en && o.v > 0.3 && Math.abs(oe.dx * e.dx + oe.dz * e.dz) < 0.75 && v.wait < 6) { v.why2 = o; return true; }
        continue;
      }
      if (oe === e) continue;
      const remO = oe.len - o.t, ot = o.route[1];
      if (o.sigHold) continue;                                          // it waits at its red light: it is not coming
      if (remO > 3 && remO / Math.max(o.v, 2.5) > 3.8) continue;       // far away
      if (!pathsCross(e, en, oe, ot)) continue;                         // nothing to give way to
      if (remO < 2.5 && (o.v > 0.3 || remO < 1.2)) { if (!eager) { v.why2 = o; return true; } continue; } // it is in the box already
      if (eager) continue;
      if (sg) {   // the other phases wait at their lights; what is left is this phase's own turns: straight on goes before a turn across it, otherwise first come
        const og = oe.sg; if (og && og.g !== sg.g) continue;
        const vs = !en || e.dx * en.dx + e.dz * en.dz > 0.85, os = !ot || oe.dx * ot.dx + oe.dz * ot.dz > 0.85;
        if (vs && !os) continue;
        if (!vs && os) { v.why2 = o; return true; }
        const d = (remO / Math.max(o.v, 2.5) - o.wait) - (rem / Math.max(v.v, 2.5) - v.wait);
        if (d < -0.4 || (d < 0.4 && o.id < v.id)) { v.why2 = o; return true; }
        continue;
      }
      const rightDot = oe.dx * e.rx + oe.dz * e.rz;
      if (oe.rank > e.rank) { v.why2 = o; return true; }
      if (oe.rank === e.rank) { // first come first served, the right-hand rule breaks ties
        const d = (remO / Math.max(o.v, 2.5) - o.wait) - (rem / Math.max(v.v, 2.5) - v.wait);
        if (d < -0.4 || (d < 0.4 && (rightDot < -0.35 ? (oe.dx * e.rx + oe.dz * e.rz > -0.35 || o.id < v.id) : o.id < v.id && rightDot < 0.35))) { v.why2 = o; return true; }
      }
    }
    return false;
  }

  // ---------- going round a stopped obstacle ----------
  // In Palermo nobody waits behind a double-parked car or an Ape that has stopped: after a beat (and often a horn) they pull out round it. The first vehicle stopped right
  // behind something that will stand there a while (stopped) asks planOt for a way round: on a two-way road through the oncoming lane, on a one-way road on whichever side
  // has room. There is none when the asphalt is too narrow, a parked car, a wall or someone on foot is in the way, the oncoming lane is not clear for long enough, or there
  // is no free room to get back into its lane past the obstacle before the next junction (so it never jumps a queue at a light or a give-way: the queue is in that room).
  // Anything stopped in that room is gone round in the same go. v.ot then holds the manoeuvre (stepOt): ph 0 backs off a metre or two when it stopped too close to swing
  // out, 1 out and past (it gives up while its nose is not yet past the obstacle if the oncoming lane fills or the obstacle moves off), 2 back into its lane.
  let pStill = 0;   // seconds the lapa has stood still
  const OT = { tried: 0, started: 0, done: 0, aborted: 0, why: {}, no: {} };   // (?debug: traffic.debug.OT; why: the reasons for giving up, counted)
  const otGiveUp = k => { OT.aborted++; OT.why[k] = (OT.why[k] || 0) + 1; };
  const otNo = k => { OT.no[k] = (OT.no[k] || 0) + 1; return null; };   // (why a look for a way round found none, counted)
  const oX = o => o === 'player' ? car.x : o.x, oZ = o => o === 'player' ? car.z : o.z, oV = o => o === 'player' ? hyp2(car.vx, car.vz) : o.v;
  const otExt = (o, dx, dz) => {   // half extents along and across a road of direction (dx, dz)
    const h = o === 'player' ? car.th : o.h, hl = o === 'player' ? 1.5 : o.ty.L / 2, hw = o === 'player' ? 0.75 : o.ty.W / 2;
    const cj = Math.abs(Math.sin(h) * dx + Math.cos(h) * dz), sj = Math.sqrt(Math.max(0, 1 - cj * cj));
    return [cj * hl + sj * hw, sj * hl + cj * hw];
  };
  function stopped(o) {   // it will stand there a while: the lapa still for 3 s, a double-parked car, a bus at its stop, a vehicle stood for 8 s with nothing in front of it
    if (o === 'player') return pStill > 3;
    if (o.fly || o.cop || o.ot) return false;
    if (o.hold2 === 2 || o.dwell > 0) return true;
    return o.v < 0.3 && S(o) > 8 && !o.sigHold && !o.hold && o.gap > 8 && !!o.route[1];
  }
  function laneFree(v, p, short) {   // nothing in the strip it passes along: oncoming that would get there before it is back in, anything ahead in the strip, anything coming up fast behind
    const ty = v.ty, L2 = ty.L / 2, tv = (v.x - p.ax) * p.dx + (v.z - p.az) * p.dz, end = p.front + ty.L + 3 - tv, T = short ? (p.front + 2 - tv) / 3 + 1 : end / 3 + 2;   // (short: already on its way out, is it still worth going on)
    const inWay = (x, z, h, sp, hl0, hw0) => {
      const a = (x - p.ax) * p.dx + (z - p.az) * p.dz - tv, b = (x - p.ax) * p.rx + (z - p.az) * p.rz;
      const cj0 = Math.sin(h) * p.dx + Math.cos(h) * p.dz, cj = Math.abs(cj0), sj = Math.sqrt(Math.max(0, 1 - cj * cj)), ha = cj * hl0 + sj * hw0, hw = sj * hl0 + cj * hw0;
      if (Math.abs(b - p.lat) >= hw + ty.W / 2 + 0.4) return false;
      if (cj0 < -0.3) return a + ha > -L2 && a - ha < (short ? p.front + 2 - tv : end) + sp * T + 6;
      if (a + ha < -L2) return cj0 > 0.3 && sp > 1.5 && a + ha > -L2 - 3 - sp * 2.5;   // (a queue standing behind it is not in its way)
      return a - ha < end + 2;
    };
    for (let i = 0; i < vs.length; i++) {
      const o = vs[i]; if (o === v || p.o.includes(o)) continue;
      if (Math.abs(o.x - v.x) > 110 || Math.abs(o.z - v.z) > 110) continue;
      if (inWay(o.x, o.z, o.h, o.v, o.ty.L / 2, o.ty.W / 2)) return false;
    }
    return p.o.includes('player') || !inWay(car.x, car.z, car.th, hyp2(car.vx, car.vz), 1.5, 0.75);
  }
  function planOt(v, e0, o0) {
    OT.tried++;
    const ty = v.ty, L2 = ty.L / 2, ax = NX[e0.a], az = NZ[e0.a], dx = e0.dx, dz = e0.dz, rx = e0.rx, rz = e0.rz, own = laneOff(e0, v), tv = v.t;
    // back in before the next junction and its stop line (or the one after, when the road only bends at a vertex)
    const n = e0.b, e1 = v.route[1];
    let lim = e0.len - Math.max(NBOX[n], 2) - 2 - (e0.sg ? STOP_BACK : 0);
    if (e1 && NDEG[n] === 2 && e1.dx * dx + e1.dz * dz > 0.94 && e1.ow === e0.ow) lim = e0.len + e1.len - Math.max(NBOX[e1.b], 2) - 2 - (e1.sg ? STOP_BACK : 0);
    // the obstacle, and whatever else stands in its lane in the room it needs to get back in: stopped, it is gone round too; anything else, there is no way back in
    const set = [o0];
    let back = 1e9, front = -1e9, lo = 1e9, hi = -1e9;
    const take = o => { const [ha, hw] = otExt(o, dx, dz), c = (oX(o) - ax) * dx + (oZ(o) - az) * dz, l = (oX(o) - ax) * rx + (oZ(o) - az) * rz;
      back = Math.min(back, c - ha); front = Math.max(front, c + ha); lo = Math.min(lo, l - hw); hi = Math.max(hi, l + hw); };
    take(o0);
    for (let it = 0; ; it++) {
      let add = null, bad = false;
      const chk = o => {
        if (set.includes(o)) return 0;
        const ox = oX(o), oz = oZ(o); if (Math.abs(ox - v.x) > 80 || Math.abs(oz - v.z) > 80) return 0;
        const [ha, hw] = otExt(o, dx, dz), c = (ox - ax) * dx + (oz - az) * dz, l = (ox - ax) * rx + (oz - az) * rz;
        if (c - ha > front + ty.L + 4 || c + ha < front - 0.5) return 0;
        if (l + hw < own - ty.W / 2 - 0.3 || l - hw > own + ty.W / 2 + 0.3) return 0;
        if (stopped(o)) { add = o; return 1; }
        bad = true; return -1;
      };
      for (let i = 0; i < vs.length && !add && !bad; i++) if (vs[i] !== v) chk(vs[i]);
      if (!add && !bad) chk('player');
      if (bad || (add && it >= 3)) return otNo('queue');
      if (!add) break;
      set.push(add); take(add);
    }
    if (front + ty.L + 4 > lim) return otNo('junction');
    if (back - tv - L2 < 1.2 && !roomBehind(v)) return otNo('close');
    // which side: the oncoming lane on a two-way road, either on a one-way road; on the asphalt with a margin from the kerb
    const hwR = e0.w / 2 - 0.3, left = lo - 0.7 - ty.W / 2, right = hi + 0.7 + ty.W / 2;   // (0.7 m clear of it: a car at an angle sticks out)
    const sides = [];
    if (left - ty.W / 2 >= -hwR) sides.push(left);
    if (e0.ow && right + ty.W / 2 <= hwR) sides.push(right);
    if (sides.length === 2 && Math.abs(sides[1] - own) < Math.abs(sides[0] - own)) sides.reverse();
    const s0 = tv - L2, s1 = front + ty.L + 3, mid = (s0 + s1) / 2;
    next: for (const lat of sides) {
      // parked cars along the strip
      const nc = parked.near(ax + dx * mid + rx * lat, az + dz * mid + rz * lat, (s1 - s0) / 2 + 4, PK_NEAR);
      for (let ci = 0; ci < nc; ci++) {
        const c = PK_NEAR[ci], oa = (c.x - ax) * dx + (c.z - az) * dz, ol = (c.x - ax) * rx + (c.z - az) * rz;
        const cj = Math.abs(Math.sin(c.rot) * dx + Math.cos(c.rot) * dz), sj = Math.abs(Math.sin(c.rot) * rx + Math.cos(c.rot) * rz);
        if (oa + cj * c.sp.L / 2 + sj * c.sp.W / 2 < s0 || oa - cj * c.sp.L / 2 - sj * c.sp.W / 2 > s1) continue;
        if (Math.abs(ol - lat) < sj * c.sp.L / 2 + cj * c.sp.W / 2 + ty.W / 2 + 0.25) { otNo('parked'); continue next; }
      }
      // walls (the road widths of the map are not always right), and people on foot
      const r = ty.W / 2 + 0.25;
      let ok = true;
      for (let s = s0; s <= s1 + 0.01 && ok; s += 2) {
        const px = ax + dx * s + rx * lat, pz = az + dz * s + rz * lat;
        walls2d.query(px - r, pz - r, px + r, pz + r, seg => { if (!ok || seg.lv !== undefined) return; const q = closestOnSeg(px, pz, seg); if (hyp2(px - q[0], pz - q[1]) < r) ok = false; });
        if (ok && peds && peds.near(px, pz, r + 0.8) > 0) ok = false;
      }
      if (ok && peds) for (const sc of gags.scenes) for (const id of [sc.ida, sc.idb]) {   // the drivers of a double-parking quarrel, out on the road
        const i = id > 0 && sc.state !== 'done' ? peds.info(id) : null; if (!i) continue;
        const a = (i.x - ax) * dx + (i.z - az) * dz, b = (i.x - ax) * rx + (i.z - az) * rz;
        if (a > s0 - 1 && a < s1 + 1 && Math.abs(b - lat) < r + 0.8) ok = false;
      }
      if (!ok) { otNo('wall/foot'); continue; }
      const p = { o: set, lat, ax, az, dx, dz, rx, rz, back, front, ph: back - tv - L2 < 3 ? 0 : 1, t0: time, tb: time, com: false, vmax: 2.5, st: 0, backs: 0, re: false };
      if (!laneFree(v, p)) { otNo('lane'); continue; }
      return p;
    }
    return sides.length ? null : otNo('narrow');
  }
  function circGap(v, o, ahead) {   // the least distance between the collision circles of v (moved ahead metres on) and of o (the lapa: its two circles)
    const s = Math.sin(v.h), c = Math.cos(v.h), vx = v.x + s * ahead, vz = v.z + c * ahead, pl = o === 'player', os = Math.sin(pl ? car.th : o.h), oc = Math.cos(pl ? car.th : o.h), oc2 = pl ? null : o.ty.circ;
    let m = 1e9;
    for (const [zo, r] of v.ty.circ) for (let j = 0, nj = pl ? 2 : oc2.length; j < nj; j++) {
      const zo2 = pl ? (j ? -PAX : PAX) : oc2[j][0], r2 = pl ? PR : oc2[j][1], ox = (pl ? car.x : o.x) + os * zo2, oz = (pl ? car.z : o.z) + oc * zo2;
      const d = hyp2(vx + s * zo - ox, vz + c * zo - oz) - r - r2; if (d < m) m = d;
    }
    return m;
  }
  function swingGap(v, o) {   // how far v may go on along its present heading before it comes within 0.08 m of o (its collision circles: a little fat at the corners)
    for (let s = 0; s <= 3; s += 0.25) if (circGap(v, o, s) < 0.08) return s;
    return 99;
  }
  const otTouch = (v, p) => { let m = 1e9; for (const o of p.o) if (o === 'player' || !o.dead) m = Math.min(m, circGap(v, o, 0)); return m; };
  function roomBehind(v) {   // room to back off a little: not into the junction behind, the vehicle behind or the lapa
    const e = v.route[0], L2 = v.ty.L / 2;
    if (v.t - L2 < 2.5) return false;
    for (const o of e.veh) if (o !== v && o.t < v.t && v.t - L2 - (o.t + o.ty.L / 2) < 1.2) return false;
    const dx = car.x - v.x, dz = car.z - v.z, fx = Math.sin(v.h), fz = Math.cos(v.h), al = dx * fx + dz * fz;
    return !(al < 0 && al > -(L2 + 3.5) && Math.abs(dx * fz - dz * fx) < 2);
  }
  function stepOt(v, p) {   // false: done or given up (v.ot is cleared)
    const L2 = v.ty.L / 2;
    if (time - p.t0 > 25) { otGiveUp('time'); return false; }
    const vA = (v.x - p.ax) * p.dx + (v.z - p.az) * p.dz;
    if (p.ph === 0) {
      const gap = p.back - vA - L2, room = roomBehind(v);
      if (p.re ? time - p.tb > 1.5 || !room || otTouch(v, p) > 0.7 : gap >= 3.6 || time - p.tb > 3 || !room) {
        if (!p.re && gap < 1.2) { otGiveUp('close'); v.otNext = time + 3; return false; }
        p.ph = 1; p.st = 0;
      } else v.rv = 0.9;
      return true;
    }
    if (p.ph === 1) {
      if (v.v < 0.1 && otTouch(v, p) < 0.2) {   // stuck with a corner against it: back off a little and try again, twice at most
        if (!p.st) p.st = time;
        else if (time - p.st > 1.5) { if (++p.backs > 2) { otGiveUp('stall'); v.otNext = time + 4; return false; } p.ph = 0; p.re = true; p.tb = time; return true; }
      } else p.st = 0;
      p.vmax = vA - L2 > p.back ? 7 : 2.5;   // slowly until its tail is past the obstacle's
      if (!p.com) {
        if (vA + L2 > p.back - 0.8) p.com = true;   // up to it with the nose out: it goes
        else {
          let gone = false; for (const o of p.o) if (o !== 'player' && (o.dead || o.fly)) gone = true; else if (oV(o) > 1) gone = true;
          if (gone || ((stepN + v.id) % 3 === 0 && !laneFree(v, p, true))) { otGiveUp(gone ? 'moved' : 'lane'); v.otNext = time + 2; return false; }
        }
      }
      if (vA - L2 > p.front + 1.2) p.ph = 2;
      return true;
    }
    if (Math.abs(v.lat) < 0.3 || vA - L2 > p.front + 25) { OT.done++; return false; }
    return true;
  }

  function control(v, dt) {
    const ty = v.ty, route = v.route, e0 = route[0], rem = e0.len - v.t, L2 = ty.L / 2;
    const sp = v.v, a = ty.a, b = ty.b, sab = 2 * Math.sqrt(a * b);
    v.rv = 0;
    const bo = v.boost || 1; // police and scared lookouts drive faster than the road allows
    let v0 = Math.min(e0.v * ty.vf * v.drv * bo, ty.vcap * bo);
    const vbase = v0;
    let dist = rem;
    for (let k = 0; k + 1 < route.length; k++) {
      const ek = route[k], en = route[k + 1];
      const ang = Math.acos(clamp(ek.dx * en.dx + ek.dz * en.dz, -1, 1));
      let vt = ang < 0.12 ? 99 : Math.max(3.2, vbase * (1 - 0.75 * Math.min(1, (ang - 0.12) / 1.3)));
      if (k === 0 && ek.slowJ) vt = Math.min(vt, ek.giveWay ? 5.5 : 7.5);
      vt = Math.min(vt, en.v * ty.vf * 1.05 * bo, ty.vcap * bo);
      v0 = Math.min(v0, Math.sqrt(vt * vt + 6 * Math.max(0, dist - L2)));
      dist += en.len;
      if (dist > 70) break;
    }
    if (v.hornT > 0) { v.hornT -= dt; v0 *= 0.55; }
    v0 = Math.max(v0, 0.6);
    if (v.hold2) { v.acc = v.hold2 === 2 ? -Math.min(b * 2.2, sp * 4 + 1) : -clamp(sp * 1.1 + 0.6, 0, 4.5); return; } // double-parked (src/gags.js): 1 pulling up, 2 stopped
    if (v.stopT > 0) { v.acc = -Math.min(b * 2.2, sp * 4 + 1); return; }
    if (v.dwell > 0) { v.dwell -= dt; if (v.dwell <= 0) v.si++; v.acc = -Math.min(b * 2.2, sp * 4 + 1); return; }

    let minI = 0, minGap = 1e9, blocker = null, exitSpace = 1e9;
    const filt = ty.scooter && v.filtO && Math.abs(v.lat) > 1.0;
    const ot = v.ot && v.ot.ph ? v.ot.o : null;   // going round these (planOt): not leaders on the route, and close up to them while the nose swings out
    const interact = (gap, vl, o) => {
      if (o && !ot && (o === 'player' ? pStill > 3 : o.hold2 === 2 || o.dwell > 0)) gap -= 2;   // stop two metres further back from what will stand there a while: room to pull out round it
      const sStar = ty.s0 + Math.max(0, sp * ty.T + sp * (sp - vl) / sab), g = gap > 0.05 ? gap : 0.05;
      const term = -a * (sStar / g) * (sStar / g);
      if (term < minI) minI = term;
      if (gap < minGap) { minGap = gap; blocker = o; }
    };
    // leaders along the route
    const gh = v.ghost && v.ghost.until > time ? v.ghost.set : null;   // a deadlock being broken (unjam): the vehicles of the knot do not see one another for a moment
    let base = -v.t;
    for (let k = 0; k < route.length && k < 3; k++) {
      const list = route[k].veh;
      for (let i = 0; i < list.length; i++) {
        const o = list[i]; if (o === v) continue;
        const d = base + o.t;
        if (k === 0 && d <= 0) continue;
        if (gh && gh.has(o)) continue;
        if (k === 1 && o.v < 2 && o.t - o.ty.L / 2 < exitSpace) { exitSpace = o.t - o.ty.L / 2; v.exitO = o; } // free room past the node
        if ((filt && o === v.filtO) || (o.hold && o.why2 === v) || (v.stuck > 20 && o.stuck > 10 && !o.qP) || (ot && ot.includes(o))) continue;
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
      if (gh && gh.has(o)) continue;
      if (ot && ot.includes(o)) { interact(swingGap(v, o) + ty.s0 - 0.2, 0, o); continue; }   // the nose is not out yet: on as long as its line takes it clear
      if ((filt && o === v.filtO) || (o.hold && o.why2 === v) || (v.stuck > 20 && o.stuck > 10 && !o.qP)) continue;
      if (cj < 0.45 && S(v) > 3 && v.id < o.id) continue; // crossing or oncoming standoff: the lower id drives on
      interact(al - L2 - hl, (o.v) * cj, o);
    }
    { // the player
      const dx = car.x - v.x, dz = car.z - v.z;
      if (Math.abs(dx) < 30 && Math.abs(dz) < 30) {
        const al = dx * fx + dz * fz;
        if (al > 0 && al < reach + L2 + 2) {
          const pfx = Math.sin(car.th), pfz = Math.cos(car.th), cj = pfx * fx + pfz * fz, sj = Math.abs(pfx * rx + pfz * rz), acj = Math.abs(cj);
          const hl = acj * 1.5 + sj * 0.75, hw = sj * 1.5 + acj * 0.75, lt = dx * rx + dz * rz;
          if (Math.abs(lt) < hw + ty.W / 2 + 0.2) interact(ot && ot.includes('player') ? swingGap(v, 'player') + ty.s0 - 0.2 : al - L2 - hl, (car.vx * fx + car.vz * fz), 'player');
        }
      }
    }
    // parked cars (src/props.js) beside the lane: steer round them (psh: the sideways shift that clears all of them, towards the edge's right when positive),
    // stop short of them when there is not room for it. All in the frame of the edge the vehicle is on (a vehicle that is turning at a junction would see the
    // cars of the cross street straight ahead); the cars of the next edge count once it is on it.
    let psh = 0;
    if (!e0.br) {   // (a bridge deck is above them)
      let ub = 1e9, lb = -1e9, cg = 1e9, ok = false;
      const obs = PK_OBS; obs.length = 0;
      const ax = NX[e0.a], az = NZ[e0.a], vl = (v.x - ax) * e0.rx + (v.z - az) * e0.rz, rr = reach + L2 + 5;
      const nc = parked.near(v.x + fx * rr * 0.5, v.z + fz * rr * 0.5, rr * 0.5 + 6, PK_NEAR);
      for (let ci = 0; ci < nc; ci++) {
        const c = PK_NEAR[ci], pL = c.sp.L, pW = c.sp.W, oa = (c.x - ax) * e0.dx + (c.z - az) * e0.dz, al = oa - v.t;
        if (oa < -pL / 2 || oa > e0.len + pL / 2 || al > reach + L2 + pL / 2 || al < -(L2 + pL / 2)) continue;
        const lt = (c.x - ax) * e0.rx + (c.z - az) * e0.rz - vl, ofx = Math.sin(c.rot), ofz = Math.cos(c.rot), cj = Math.abs(ofx * e0.dx + ofz * e0.dz), sj = Math.abs(ofx * e0.rx + ofz * e0.rz);
        const need = sj * pL / 2 + cj * pW / 2 + ty.W / 2;   // lateral distance that just clears it (plus MARGIN below)
        if (Math.abs(lt) >= need + 2.5) continue;
        obs.push(lt, need); if (Math.abs(lt) < need && al > 0.5) cg = Math.min(cg, al - L2 - (cj * pL / 2 + sj * pW / 2));
      }
      for (let mi = 0; mi < 3; mi++) {   // as much room as it can have (0.35 m), down to a scrape
        const margin = 0.35 - mi * 0.225; ub = 1e9; lb = -1e9;
        for (let i = 0; i < obs.length; i += 2) { const lt = obs[i], need = obs[i + 1] + margin; if (lt >= 0) ub = Math.min(ub, lt - need); else lb = Math.max(lb, lt + need); }
        if (lb <= ub && Math.abs(clamp(0, lb, ub)) <= 2.4) { psh = clamp(0, lb, ub); ok = true; break; }
      }
      if (obs.length && !ok) {   // no room for it: crawl past on the best line, and what it touches gets pushed aside (bumpParked), never launched at this speed
        psh = clamp(lb > ub ? (lb + ub) / 2 : clamp(0, lb, ub), -2.4, 2.4);
        if (cg < 6) v0 = Math.min(v0, 4.5);
      }
      if (psh !== 0 && !e0.ow) psh = Math.max(psh, ty.W / 2 + 0.1 - (laneOff(e0, v) + v.lat));   // a two-way road: keep to its own half, the oncoming traffic needs the other
    }
    // junction: hold at the stop line when someone has priority, the light is red or the exit is blocked
    let hold = false;
    if (rem < 40 && !(v.cop && v.cop.pursue)) hold = mustHold(v, e0, rem, exitSpace); // sirens skip the stop lines
    if (hold) {
      const sg = rem - L2 - NBOX[e0.b];
      if (sg > -1.2 && sp * sp / (2 * Math.max(sg, 0.1)) < 6.5) interact(sg, 0, null);
      if (sp < 0.5 && sg < 4) v.wait += dt;
    } else if (sp > 3) v.wait = 0;   // (not at once: when a breaker below lets it go it must stay let go, or it holds again the next step and never moves; reset as it passes the node)
    // traffic signals: stop at the line on red, and on amber when it can be done without standing on the brake. A light that has held a vehicle for a minute lets it go: a jam
    // that never clears is worse than one run light, and the queue behind it must not outlast the clock.
    let lit = false;
    if (!(v.cop && v.cop.pursue)) {
      for (let k = 0, dd = rem; k < 2 && k < route.length && dd < 70; k++) {
        const sg = route[k].sg;
        if (sg) {
          const st = signalLight(sg.site, sg.g, sigT);
          if (st && v.sigW < 60) {
            const gap = dd - L2 - STOP_BACK - 0.4;
            if (gap > -0.5 && sp * sp / (2 * Math.max(gap, 0.1)) < (st === 1 ? 4 : 6.5)) { interact(gap, 0, null); lit = true; break; }
          }
        }
        if (k + 1 < route.length) dd += route[k + 1].len;
      }
    }
    if (lit) v.sigW += dt; else if (v.sigW < 60) v.sigW = 0; else if ((v.sigW += dt) > 66) v.sigW = 0;
    v.sigHold = lit;
    if (route.length < 4 && (stepN + v.id) % 30 === 0) { if (v.plan && !v.tour) replan(v); extendRoute(v); }   // a route cut short (the road on was not loaded yet, or not judged usable yet): look again now and then
    if (!route[1] && rem < 60) interact(rem - L2 - 0.4, 0, null); // end of the road
    if (v.plan) { // the next bus stop on the line: pull up with the front door at the pole, wait, go on
      const pl = v.plan, n = pl.edges.length;
      let st = pl.stops[v.si];
      while (st && st.i < v.cur) st = pl.stops[++v.si];
      if (st) for (let k = 0, d0 = -v.t; k < 3 && k < route.length; k++) {
        if ((v.cur + k) % n === st.i) {
          const gap = d0 + st.t - L2 + 3.5;
          if (gap < -2) v.si++;
          else if (gap < 70) { interact(gap, 0, null); if (sp < 0.4 && gap < 4) { v.dwell = 6 + Math.random() * 6; } }
          break;
        }
        d0 = k === 0 ? rem : d0 + route[k].len; // distance to the start of route[k + 1]
      }
    }
    v.blocker = blocker; v.hold = hold; v.gap = minGap;
    v.qP = blocker === 'player' || !!(blocker && (blocker.qP || blocker.hold2));   // in a queue behind the lapa or a double-parked car: the ones behind do not give up on it and drive through
    if (!v.filtO) { // make room for a honking lapa: edge towards the kerb where the road allows
      let room = 0; if (v.hornT > 0) room = clamp(e0.w / 2 - 0.45 - ty.W / 2 - laneOff(e0, v), 0, 1.3);
      v.latT = room;
    }
    if (psh !== 0) v.latT = clamp(v.lat + psh, -2.4, 2.4);
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
    // going round a stopped obstacle: a beat behind it first, then out when planOt finds the room and the lane clear
    if (v.ot) {
      const p = v.ot;
      if (!stepOt(v, p)) v.ot = null;
      else if (p.ph === 0) v0 = 0.6;
      else { v.filtO = null; v.latT = p.ph === 1 ? clamp(p.lat - laneOff(e0, v), -5, 5) : 0; if (p.ph === 1) v0 = Math.min(v0, p.vmax); }
    } else if (blocker && minGap < 9 && sp < 1 && !hold && !lit && !v.cop && !v.hold2 && !v.dp && !v.filtO && !e0.br && stopped(blocker)) {
      v.otW = (v.otW || 0) + dt;   // the beat: 1.2 to 2.8 s, longer behind a double-parker (time for the quarrel of src/gags.js)
      if (v.otW > 1.2 + (v.id % 5) * 0.4 + (blocker.dp ? 3.5 : 0) && time >= (v.otNext || 0)) {
        v.otNext = time + 0.6;
        const p = planOt(v, e0, blocker);
        if (p) { v.ot = p; OT.started++; v.otW = 0; if (!(blocker === 'player' || blocker.dp) && Math.random() < 0.5) honk(v); }   // (behind the lapa and a double-parker it honks already)
      }
    } else v.otW = 0;
    let acc = a * (1 - Math.pow(sp / v0, 4)) + minI;
    if (v.ot && v.ot.ph === 0) acc = -3;
    v.acc = clamp(acc, -9, a);
  }

  function integrate(v, dt) {
    if (v.fly) { stepFly(v, dt); return; }
    if (v.cop && v.cop.mode === 'direct') { police.drive(v, dt); return; }   // boxing the lapa in, off the road graph
    const ty = v.ty, route = v.route;
    v.stopT = Math.max(0, v.stopT - dt);
    v.v = Math.max(0, v.v + (v.acc || 0) * dt);
    if (v.v < 0.25) v.stuck += dt; else if (v.v > 1) v.stuck = 0;
    if (v.hold2 || v.sigHold) v.stuck = 0;   // (held at a red light is not stuck)
    // steer: pure pursuit on the lane line
    let e0 = route[0];
    v.lat += (v.latT - v.lat) * Math.min(1, 3 * dt);
    const Ld = v.ot && v.ot.ph === 1 && !v.ot.com ? 1.6 : Math.max(2.5, 2.0 + v.v * 0.55), s = v.t + Ld;   // (pulling out round an obstacle: a sharper turn)
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
    v.x += (Math.sin(v.h) * (v.v - v.rv) + v.ex) * dt; v.z += (Math.cos(v.h) * (v.v - v.rv) + v.ez) * dt;   // (rv: backing off a little before going round, stepOt)
    const damp = Math.exp(-4 * dt); v.ex *= damp; v.ez *= damp;
    // progress along the route
    let t = (v.x - NX[e0.a]) * e0.dx + (v.z - NZ[e0.a]) * e0.dz;
    for (let g = 0; g < 2 && t > e0.len - 0.3 && route[1]; g++) {
      route.shift(); v.wait = 0; if (v.plan) { v.cur = (v.cur + 1) % v.plan.edges.length; if (v.cur === 0) v.si = 0; } extendRoute(v); e0 = route[0];
      t = (v.x - NX[e0.a]) * e0.dx + (v.z - NZ[e0.a]) * e0.dz;
    }
    v.t = t;
    // jam time: how long it has stood within 6 m of one spot, not counting a red light, a bus stop or pulling up to double-park
    if (!(Math.abs(v.x - v.jx) < 6 && Math.abs(v.z - v.jz) < 6)) { v.jx = v.x; v.jz = v.z; v.jamT = 0; }
    else if (!(v.sigHold || v.hold2 || v.dwell > 0)) v.jamT += dt;
    if (ty.scooter) v.roll += (clamp(-v.yaw * v.v * 0.05, -0.38, 0.38) - v.roll) * Math.min(1, 6 * dt);
    v.age += dt;
    // honks: the player is in the way, or a delayed one after a bump
    if (v.v < 0.5 && !v.hold2 && (v.blocker === 'player' || (v.blocker && v.blocker.dp))) { // stuck behind the lapa or behind a double-parker
      v.blockT += dt;
      if (v.blockT > 2.2) { v.blockT = -1.2; honk(v); if (Math.random() < 0.5) shoutAt(v); }
    } else if (v.blockT > 0) v.blockT = 0; else if (v.blockT < 0) v.blockT = Math.min(0, v.blockT + dt);
    if (v.honkAt > 0 && time >= v.honkAt) { v.honkAt = -1; honk(v); }
  }

  function buildOcc() {
    for (const n of touchedNodes) NOCC[n].length = 0;
    touchedNodes.length = 0;
    for (const e of touchedEdges) e.veh.length = 0;
    touchedEdges.length = 0;
    for (const v of vs) {
      if (v.fly || (v.cop && v.cop.mode === 'direct')) continue;
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
    const d = hyp2(v.x - camera.position.x, v.z - camera.position.z), g = Math.max(0, 1 - d / 90);
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

  // ---------- the player's horn: vehicles ahead make room and sometimes answer ----------
  addEventListener('pd-horn', ev => {
    const d = ev.detail || {}, px = d.x ?? car.x, pz = d.z ?? car.z, r = d.r ?? 30, fx = Math.sin(car.th), fz = Math.cos(car.th);
    for (const v of vs) {
      if (v.fly) continue;
      const dx = v.x - px, dz = v.z - pz, d2 = dx * dx + dz * dz;
      if (d2 > r * r || d2 < 1) continue;
      const al = dx * fx + dz * fz, lt = dx * -fz + dz * fx;
      if (al < 2 || Math.abs(lt) > 7) continue; // only those ahead of the lapa, roughly in its way
      v.hornT = 3.2;
      const roll = Math.random();
      if (roll < 0.25) v.honkAt = time + 0.25 + Math.random() * 0.8;
      else if (roll < 0.34) shoutAt(v);
    }
  });

  // ---------- step ----------
  function stepAll(dt) {
    time += dt; sigT = signalClock.now();
    pStill = hyp2(car.vx, car.vz) < 0.5 ? pStill + dt : 0;
    buildOcc(); stepN++;
    // the driver of a vehicle far away or out of view thinks at half the rate (it goes on moving on its last decision): nobody can see the difference, and this is most of the cost of the traffic
    for (let i = 0; i < vs.length; i++) { const v = vs[i]; if (!v.fly && !(v.cop && v.cop.mode === 'direct')) { if (!v.lazy) control(v, dt); else if ((v.id + stepN) & 1) control(v, dt * 2); } }
    for (let i = 0; i < vs.length; i++) integrate(vs[i], dt);
    for (let i = 0; i < vs.length; i++) { const v = vs[i]; if (!v.fly && (!v.lazy || ((v.id + stepN) & 1))) bumpParked(v); }
    if (stepN % 15 === 0) unjam();
  }
  // Deadlock: follow who each standing vehicle waits for (the leader it brakes for, else the one it gives way to at the junction). When that comes back round to
  // itself, every vehicle in the ring has stood for seconds and none is at a red light or behind the lapa, nobody in the ring will ever move: they stop seeing
  // one another for a few seconds and drive on (they pass through each other, which is less odd than a knot that never clears).
  const CHAIN = [];
  let ujStamp = 0;
  function unjam() {
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i]; if (!(v.jamT > 5) || (v.ghost && v.ghost.until > time)) continue;
      CHAIN.length = 0; ujStamp++;
      for (let o = v, k = 0; k < 64; k++) {   // (a ring can be long: a one-way loop round a square full of cars)
        const at = o.ujS === ujStamp ? o.ujK : -1;
        if (at >= 0) {
          const ring = CHAIN.slice(at);
          if (ring.length > 1 && ring.every(m => m.jamT > 4 && !m.sigHold)) { const set = new Set(ring); for (const m of ring) m.ghost = { until: time + 4, set }; }
          break;
        }
        o.ujS = ujStamp; o.ujK = CHAIN.length; CHAIN.push(o);
        const nx = o.blocker === 'player' ? null : o.blocker || (o.hold ? o.why2 : null);
        if (!nx || nx.dead || nx.sigHold || nx.fly || nx.hold2 || nx.dwell > 0) break;   // (a red light, a double-parked car, a bus at its stop: they will move)
        o = nx;
      }
    }
  }
  function markLazy(cx, cz, camY) {
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], dx = v.x - cx, dz = v.z - cz, d2 = dx * dx + dz * dz;
      v.lazy = !v.cop && d2 > 70 * 70 && (d2 > 150 * 150 || !inView(v.x, camY, v.z, v.ty.L * 0.6 + 8));
    }
  }
  // a vehicle that does run into a parked car (it came out of a turn, was boxed in, the police ram): the car is pushed, or launched at 4 m/s and more, and the
  // vehicle loses speed. Quiet: no police chaos, the lapa did not do it.
  function bumpParked(v) {
    if (v.route[0].br) return;
    const ty = v.ty, s = Math.sin(v.h), c = Math.cos(v.h), circ = ty.circ;
    const nc = parked.near(v.x, v.z, ty.L / 2 + 3.5, PK_NEAR2);
    for (let ci = 0; ci < nc; ci++) {
      const pc = PK_NEAR2[ci], ps = Math.sin(pc.rot), pcs = Math.cos(pc.rot), pcirc = pc.sp.c;
      next: for (let i = 0; i < circ.length; i++) {
        const zo = circ[i][0], r = circ[i][1], cx = v.x + s * zo, cz = v.z + c * zo;
        for (let j = 0; j < pcirc.length; j++) {
          const pzo = pcirc[j][1], pr = pcirc[j][2];
          let nx = cx - (pc.x + ps * pzo), nz = cz - (pc.z + pcs * pzo), d = hyp2(nx, nz);
          const rs = r + pr; if (d >= rs) continue;
          if (d < 1e-4) { nx = -s; nz = -c; d = 1e-4; } else { nx /= d; nz /= d; }
          const pen = rs - d, vvx = s * v.v + v.ex, vvz = c * v.v + v.ez, rel = Math.max(0, -(vvx * nx + vvz * nz));
          const res = parked.bump(pc, nx, nz, pen, rel, vvx, vvz, ty.mass, true), k = pc.sp.m / (ty.mass + pc.sp.m);
          if (res) { v.x += nx * pen * k; v.z += nz * pen * k; v.v *= res === 2 ? 0.55 : 0.9; if (res === 2) v.honkAt = time + 0.3; }
          break next;   // one contact per parked car and step
        }
      }
    }
  }
  function cull(cx, cz) {
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i], dx = v.x - cx, dz = v.z - cz, d2 = dx * dx + dz * dz;
      const keep = (v.cop && v.cop.keep) || (v.lifeEnd && d2 < 360 * 360) || (v.roam && d2 < 330 * 330);   // police in a chase stay however far they are; the team bus tours the city, the knife-grinder is heard from a few streets away
      let kill = (!keep && d2 > R_DESPAWN * R_DESPAWN) || v.route[0].dead;
      const lat = Math.abs((v.x - NX[v.route[0].a]) * v.route[0].rx + (v.z - NZ[v.route[0].a]) * v.route[0].rz);
      if (lat > 8 && !(v.cop && v.cop.mode === 'direct')) kill = true;
      // the safety net: stopped for 35 s, or less than 6 m on in 30 s (jamT), goes as soon as it is out of sight; after 140 s even in sight, unless the camera is right there
      if (!kill && (v.stuck > 35 || v.jamT > 30 || (!v.route[1] && v.stuck > 6) || v.age > 600)) {
        const vis = d2 < 45 * 45 || inView(v.x, 1, v.z, v.ty.L * 0.6);
        if (!vis || v.stuck > 140 || v.jamT > 140) kill = d2 > 30 * 30;
      }
      if (!kill && !keep && d2 > R_KEEP_UNSEEN * R_KEEP_UNSEEN && !inView(v.x, groundY(v.x, v.z) + 1, v.z, v.ty.L * 0.6 + 2)) kill = true;
      if (v.hide && !inView(v.x, groundY(v.x, v.z) + 1, v.z, v.ty.L * 0.6)) kill = true;
      if (kill) removeAt(i);
    }
  }

  function writeInstances() {
    for (const k in MESH) MESH[k].count = 0;
    let nOut = 0;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], m = MESH[v.ty.model], n = m.count++;
      const c = Math.cos(v.h), s = Math.sin(v.h), cr = Math.cos(v.roll), sr = Math.sin(v.roll), pi = v.pitch || 0, cp = Math.cos(pi), sp = Math.sin(pi), o = n * 16, A = m.instanceMatrix.array;
      A[o] = c * cr + s * sr * sp; A[o + 1] = sr * cp; A[o + 2] = -s * cr + c * sr * sp; A[o + 3] = 0;
      A[o + 4] = -c * sr + s * cr * sp; A[o + 5] = cr * cp; A[o + 6] = s * sr + c * cr * sp; A[o + 7] = 0;
      A[o + 8] = s * cp; A[o + 9] = -sp; A[o + 10] = c * cp; A[o + 11] = 0;
      // the simulation steps 30 times a second: on a faster screen the vehicle is drawn where it has got to since the last step, or it would judder against the camera
      const ahead = v.fly ? 0 : v.v * acc, px = v.x + s * ahead, pz = v.z + c * ahead;
      A[o + 12] = px; const dk = v.route[0] && v.route[0].br ? topY(px, pz) : NaN; A[o + 13] = (dk === dk ? dk : groundY(px, pz)) + (v.fly ? v.fly.y : 0); A[o + 14] = pz; A[o + 15] = 1;
      if (v.name === 'bus') SIGN_ROW.array[n] = v.plan ? v.plan.row : v.row || 0;
      const O = m.userData.owner || (m.userData.owner = new Int32Array(CAP));   // (a colour only goes to the GPU when another vehicle takes the slot)
      if (O[n] !== v.id) { O[n] = v.id; const C = m.instanceColor.array; C[n * 3] = v.col.r; C[n * 3 + 1] = v.col.g; C[n * 3 + 2] = v.col.b; m.instanceColor.needsUpdate = true; }
      for (let q = 0, circ = v.ty.circ; q < circ.length; q++) {   // (objects kept from frame to frame: this runs for every vehicle in every frame)
        const a = agentsOut[nOut] || (agentsOut[nOut] = { x: 0, z: 0, r: 0 }); nOut++;
        a.x = v.x + s * circ[q][0]; a.z = v.z + c * circ[q][0]; a.r = circ[q][1];
      }
    }
    agentsOut.length = nOut;
    for (const k in MESH) { const m = MESH[k]; if (!m.count) continue; const q = m.instanceMatrix; q.clearUpdateRanges(); q.addUpdateRange(0, m.count * 16); q.needsUpdate = true; }   // only the slots in use, and nothing for a model with no vehicle on the road
    if (SIGN) { SIGN.count = MESH.bus.count; if (SIGN.count) SIGN_ROW.needsUpdate = true; SIGN_T.count = MESH.teamBus.count; }
    DECAL.count = MESH.apePol.count; CART_DECAL.count = MESH.carretto.count;
  }

  // ---------- tiles: roads in as tiles reach full detail, out when they drop ----------
  let plansDirty = false, planGen = null;   // bus plans are rebuilt (in slices) after any change of the road graph
  function killOnDeadEdges() {
    for (let i = vs.length - 1; i >= 0; i--) { const r = vs[i].route; for (let k = 0; k < r.length; k++) if (r[k].dead) { removeAt(i); break; } }
  }
  // ---------- traffic signals (src/signals.js) ----------
  // The sites of every resident tile; each approach edge of a signal's node carries sg = { site, g } (the phase group) so that a vehicle finds its light in one lookup. Node and
  // edge ids are recycled when tiles drop, so the tags are laid again whenever the graph changes.
  const sigSites = new Map(), sigEdges = [];
  let sigVer = -1, sigT = 0;
  function tagSignals() {
    for (const e of sigEdges) e.sg = null;
    sigEdges.length = 0; sigVer = G.version;
    for (const sites of sigSites.values()) for (const site of sites) {
      const n = G.nearestNode(site.x, site.z, 1.2, false); if (n < 0 || NDEG[n] < 2) continue;
      for (const e of NIN[n]) {
        if (e.ped || e.rank === 6) continue;   // (not on a pedestrian street, nor at a roundabout)
        let bi = -1, bd = 0.93;
        for (let i = 0; i < site.legs.length; i++) { const l = site.legs[i]; if (!l.inb) continue; const d = -(e.dx * l.ax + e.dz * l.az); if (d > bd) { bd = d; bi = i; } }
        if (bi >= 0) { e.sg = { site, g: site.legs[bi].g }; sigEdges.push(e); }
      }
    }
  }
  world.onTile((kind, t) => {
    const key = t.i + '_' + t.j;
    if (kind === 'full') {
      if (t.data && t.data.roads && t.data.roads.length) {
        addQ.push(t);
        const items = t.data.props && t.data.props.items;
        if (items && items.some(i => i.k === 'signal')) sigSites.set(key, signalSites(t.data.roads, items));
      }
      return;
    }
    sigSites.delete(key);
    const qi = addQ.indexOf(t); if (qi >= 0) addQ.splice(qi, 1);
    if (stepping && stepping.key === key) stepping = null;
    if (G.dropTile(key)) { killOnDeadEdges(); if (!graphDirty) dirtyAt = time; graphDirty = true; plansDirty = true; planGen = null; }
  });
  let tileMs = 0, aliveMs = 0, aliveMax = 0;
  function tiles(cx, cz) {
    if (!stepping && addQ.length) { // nearest waiting tile first
      let bi = 0, bd = 1e18;
      for (let i = 0; i < addQ.length; i++) { const t = addQ[i], dx = (t.i + 0.5) * 500 - cx, dz = (t.j + 0.5) * 500 - cz, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
      const t = addQ.splice(bi, 1)[0];
      stepping = G.addTile(t.i + '_' + t.j, t.data.roads, t.i * 500, t.j * 500); stepping.src = t; planGen = null;
    }
    if (stepping) {
      const t0 = performance.now();
      if (G.stepTile(stepping, 2)) { if (!graphDirty) dirtyAt = time; graphDirty = true; plansDirty = true; planGen = null; stepping = null; }
      tileMs = performance.now() - t0;
    } else tileMs = 0;
    // judge the new roads once the burst of tiles is in (or after a second at the latest)
    if (graphDirty && !stepping && (!addQ.length || time - dirtyAt > 1.5)) {
      const t0 = performance.now(); G.recomputeAlive(); graphDirty = false; nextCand = 0;
      aliveMs = performance.now() - t0; if (aliveMs > aliveMax) aliveMax = aliveMs;
    }
    if (sigVer !== G.version && !stepping) tagSignals();
    if (plansDirty && !stepping && !addQ.length && !graphDirty) { planGen = planJob(); plansDirty = false; }
    if (planGen && !stepping && planGen.next().done) planGen = null;
  }

  let acc = 0, stepN = 0;
  function update(dt, cam) {
    frames++;
    cam = cam || camera;
    cam.updateMatrixWorld();
    inv.copy(cam.matrixWorld).invert();
    fm.multiplyMatrices(cam.projectionMatrix, inv); frustum.setFromProjectionMatrix(fm);
    const cx = cam.position.x, cz = cam.position.z;
    acc += Math.min(dt, 0.1);
    if (acc >= STEP) markLazy(cx, cz, cam.position.y);
    while (acc >= STEP) { acc -= STEP; stepAll(STEP); }
    tiles(cx, cz);
    cull(cx, cz);
    if (time >= nextCand || hyp2(cx - candX, cz - candZ) > 40) { rebuildCandidates(cx, cz); nextCand = time + 0.7; }
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
    arrotini.update(Math.min(dt, 0.1));   // the knife-grinders: where each one is on his loop, and one that comes within range takes shape on the road (src/arrotini.js)
    fx.begin(); police.update(Math.min(dt, 0.1), fx); gags.update(Math.min(dt, 0.1), fx); fx.end();
    carrozze.update(Math.min(dt, 0.1)); vendors.update(Math.min(dt, 0.1));
    writeInstances();
  }

  // ---------- speech balloons ----------
  const headY = v => groundY(v.x, v.z) + (v.fly ? v.fly.y : 0) + (v.ty.hy || 1.4);
  const shoutAt = (v, text) => env.shout?.(v.x, headY(v), v.z, text, () => v.dead ? null : { x: v.x, y: headY(v), z: v.z });

  // ---------- yeet: a hit vehicle is launched, tumbles, bounces, slides, rights itself ----------
  const GRAV = 9.81;
  function launch(v, vx, vz, vy, chain, tame = 1) {   // tame < 1: a heavy vehicle (bus) rocks over rather than tumbling
    const sg = () => Math.random() < 0.5 ? -1 : 1;
    v.fly = { vx, vz, vy, y: 0.15, yaw: sg() * (2 + Math.random() * 4) * tame, sp: (Math.random() - 0.5) * 7 * tame, sr: sg() * (3 + Math.random() * 6) * tame,
      bounces: 0, phase: 0, t: 0, chain, hit: new Set() };
    v.v = 0; v.dwell = 0; v.filtO = null; v.stopT = 0; v.latT = 0; v.ot = null; v.rv = 0;
  }
  function stepFly(v, dt) {
    const f = v.fly, ty = v.ty;
    f.t += dt;
    const restY = 0.5 * (Math.abs(Math.sin(v.roll)) * ty.W * 0.9 + Math.abs(Math.sin(v.pitch || 0)) * ty.L * 0.2);
    if (f.phase === 0) { // in the air or sliding
      f.vy -= GRAV * dt; f.y += f.vy * dt;
      v.x += f.vx * dt; v.z += f.vz * dt;
      v.h += f.yaw * dt; v.pitch = (v.pitch || 0) + f.sp * dt; v.roll += f.sr * dt;
      const speed = hyp2(f.vx, f.vz);
      if (f.y <= restY) {
        f.y = restY;
        if (f.vy < -1.8) { f.vy = -f.vy * 0.42; f.vx *= 0.72; f.vz *= 0.72; f.yaw *= 0.6; f.sp *= 0.5; f.sr *= 0.55; f.bounces++; }
        else {
          f.vy = 0; const k = Math.exp(-2.4 * dt); f.vx *= k; f.vz *= k; f.yaw *= Math.exp(-3 * dt); f.sp *= Math.exp(-5 * dt); f.sr *= Math.exp(-5 * dt);
          if (speed < 0.6) { f.phase = 1; f.t = 0; v.roll = wrapPi(v.roll); v.pitch = wrapPi(v.pitch); }
        }
      }
      if (f.y < 1.2 && speed > 5) { // chain reaction: hit another vehicle on the way
        for (const o of vs) {
          if (o === v || o.fly || f.hit.has(o.id) || f.chain >= 3 || o.ty.mass > 5) continue;
          const dx = o.x - v.x, dz = o.z - v.z, rr = (ty.L + o.ty.L) * 0.32;
          if (dx * dx + dz * dz > rr * rr) continue;
          f.hit.add(o.id);
          const k = (o.ty.mass <= 1.3 ? 0.8 : 0.5) * (ty.mass >= 1.5 ? 1.1 : 1), d = hyp2(dx, dz) || 1;
          launch(o, (f.vx * 0.7 + dx / d * speed * 0.3) * k, (f.vz * 0.7 + dz / d * speed * 0.3) * k, (3.2 + speed * 0.25) * k, f.chain + 1);
          f.vx *= 0.55; f.vz *= 0.55;
          shoutAt(o); police.chaos(o.cop ? 'hitcop' : 'chain');
          break;
        }
      }
      if (f.y <= restY + 0.01) wallPush(v);
    } else if (f.phase === 1) { // lying there for a moment, then the driver rights it with a hop
      const tilted = Math.abs(v.roll) > 0.35 || Math.abs(v.pitch) > 0.35;
      if (f.t > (tilted ? 1.8 : 0.5)) { f.phase = 2; f.t = 0; f.r0 = v.roll; f.p0 = v.pitch; }
    } else {
      const u = Math.min(1, f.t / 0.7), e = u * u * (3 - 2 * u);
      v.roll = f.r0 * (1 - e); v.pitch = f.p0 * (1 - e);
      f.y = 0.45 * Math.sin(u * Math.PI);
      if (u >= 1) {
        v.fly = null; v.roll = 0; v.pitch = 0; v.v = 0; v.stopT = 0.4; v.stuck = 0; v.honkAt = time + 0.3;
        const e0 = v.route[0], lat = Math.abs((v.x - NX[e0.a]) * e0.rx + (v.z - NZ[e0.a]) * e0.rz);
        if (lat > 6) v.hide = true; // too far off the road: goes away once nobody is looking
      }
    }
  }

  // ---------- the player ----------
  const PR = 0.74, PAX = 0.72, I_YAW = 1.7, E = 0.25;
  function wallPush(v) {
    const s = Math.sin(v.h), c = Math.cos(v.h);
    for (const [zo, r] of v.ty.circ) {
      const cx = v.x + s * zo, cz = v.z + c * zo;
      walls2d.query(cx - r, cz - r, cx + r, cz + r, seg => {
        if (seg.lv !== undefined) return;   // a parapet or tunnel wall on its own level (src/bridges.js)
        const q = closestOnSeg(v.x + s * zo, v.z + c * zo, seg);
        const dx = v.x + s * zo - q[0], dz = v.z + c * zo - q[1], d = hyp2(dx, dz);
        if (d < r && d > 1e-4) { v.x += dx / d * (r - d); v.z += dz / d * (r - d); }
      });
    }
  }
  function collidePlayer(pc) {
    police.collide(pc);
    const sn = Math.sin(pc.th), cs = Math.cos(pc.th);
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], ty = v.ty, dx = v.x - pc.x, dz = v.z - pc.z, reach = ty.L / 2 + 2.6;
      if (v.fly || dx * dx + dz * dz > reach * reach) continue;
      let touched = false;
      const vsn = Math.sin(v.h), vcs = Math.cos(v.h);
      for (let sg = 0; sg < 2; sg++) {
        const a = sg ? -PAX : PAX;
        for (let k = 0; k < ty.circ.length; k++) {
          const px = pc.x + sn * a, pz = pc.z + cs * a, zo = ty.circ[k][0], r = ty.circ[k][1];
          let nx = px - (v.x + vsn * zo), nz = pz - (v.z + vcs * zo), d = hyp2(nx, nz);
          const rs = PR + r;
          if (d >= rs) continue;
          touched = true;
          if (d < 1e-4) { nx = sn; nz = cs; d = 1e-4; } else { nx /= d; nz /= d; }
          const pen = rs - d, mp = 1, mv = ty.mass, lx = cs, lz = -sn;
          const vn = (pc.vx + pc.w * a * lx - (vsn * v.v + v.ex)) * nx + (pc.vz + pc.w * a * lz - (vcs * v.v + v.ez)) * nz;
          const heavy = mv >= 5;   // a bus: knocked over only by a real hit (ty.yeetV), a short hop, tipping rather than tumbling
          if (vn < -(heavy ? ty.yeetV || 1e9 : 4)) { // YEET: the vehicle is launched, the lapa only gets a light knock
            const rel = -vn, sc = heavy ? ty.yeetK : mv <= 1.3 ? 1 : 0.65, pv = hyp2(pc.vx, pc.vz) || 1;
            let ux = -nx * 0.45 + pc.vx / pv * 0.55, uz = -nz * 0.45 + pc.vz / pv * 0.55; const um = hyp2(ux, uz) || 1; ux /= um; uz /= um;
            const hs = clamp(rel * 1.3 + 3, 6, 28) * sc;
            launch(v, ux * hs, uz * hs, clamp(4.5 + rel * 0.55, 5.5, 12.5) * sc, 0, heavy ? 0.35 : 1);
            v.x -= nx * pen; v.z -= nz * pen;
            const j = (ty.yeetJ || 0.1) * rel; pc.vx += nx * j; pc.vz += nz * j; pc.vf = pc.vx * sn + pc.vz * cs;
            shoutAt(v); v.honkAt = time + 0.5; police.chaos(v.cop ? 'hitcop' : 'yeet');
            return;
          }
          const shP = mv / (mp + mv), shV = mp / (mp + mv);
          pc.x += nx * pen * shP; pc.z += nz * pen * shP; v.x -= nx * pen * shV; v.z -= nz * pen * shV;
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
        if (v.dp) gags.bump(v);
        if (v.cop && hyp2(pc.vx, pc.vz) > 6) police.chaos('hitcop');
        if (v.stopT <= 0) { v.honkAt = time + 0.35 + Math.random() * 0.3; shoutAt(v); }
        v.stopT = Math.max(v.stopT, 1.0 + Math.random() * 0.8);
        wallPush(v);
      }
    }
  }

  // ---------- the tourist carrozze (src/carrozze.js): a closed loop between the Cattedrale, the Quattro Canti and the Teatro Massimo ----------
  // Out along the shortest way the horse may take, back by other streets where there are any (else the same street's other lane). Found in the resident graph when asked for, kept until the graph changes.
  // Two loops of the same kind: the carrozze (Cattedrale, Quattro Canti, Teatro Massimo) and the Sicilian cart's, short, in the market quarter: Piazza Sant'Anna (the Ballaro side), Piazza Garraffello and Piazza Caracciolo (the Vucciria). Ballaro's own node cannot be a stop: the graph only lets you leave it.
  const TOURS = {
    carrozza: { stops: [proj(38.1146, 13.3558), proj(38.115684, 13.36146), proj(38.1199, 13.3573)], pl: null, ver: -1 },
    carretto: { stops: [proj(38.1149181, 13.3651434), proj(38.1179401, 13.3649292), proj(38.1183, 13.3637)], pl: null, ver: -1 },
  };
  function shortest(a, b, ty, banned) {   // Dijkstra over the edges a carrozza may use, skipping the banned edge ids; the edges in order, or null
    const dist = new Map([[a, 0]]), prev = new Map(), open = [[0, a]];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, n] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (n === b) break;
      if (d > dist.get(n) || dist.size > 4000) continue;
      for (const c of NOUT[n]) { if (c.dead || !allowed(c, ty) || (banned && banned.has(c.id))) continue; const nd = d + c.len; if (nd < (dist.get(c.b) ?? 1e9)) { dist.set(c.b, nd); prev.set(c.b, c); open.push([nd, c.b]); } }
    }
    if (!prev.has(b)) return null;
    const out = []; for (let e = prev.get(b); e; e = prev.get(e.a)) out.unshift(e); return out;
  }
  function tourPlan(kind = 'carrozza') {
    const T_ = TOURS[kind];
    if (T_.pl && T_.ver === G.version && !T_.pl.edges.some(e => e.dead)) return T_.pl;
    T_.pl = null; T_.ver = G.version;
    const ty = TYPES[kind], ns = T_.stops.map(p => G.nearestNode(p[0], p[1], 70, false));
    if (ns.some(n => n < 0) || ns[0] === ns[1] || ns[1] === ns[2]) return null;
    const out = [...(shortest(ns[0], ns[1], ty) || []), ...(shortest(ns[1], ns[2], ty) || [])];
    if (out.length < 4) return null;
    const ban = new Set(); for (const e of out) { ban.add(e.id); if (e.rev >= 0) ban.add(e.rev); }
    const back = shortest(ns[2], ns[0], ty, ban) || [...(shortest(ns[2], ns[1], ty) || []), ...(shortest(ns[1], ns[0], ty) || [])];
    const edges = [...out, ...back];
    if (back.length < 2 || edges[edges.length - 1].b !== edges[0].a) return null;
    return (T_.pl = { edges, stops: [], closed: true, row: 0 });
  }
  function spawnTour(kind = 'carrozza') {   // a carrozza (or the Sicilian cart) on its loop, out of view
    const pl = tourPlan(kind); if (!pl) return null;
    const cands = [], cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < pl.edges.length; i++) {
      const e = pl.edges[i], dx = (NX[e.a] + NX[e.b]) / 2 - cx, dz = (NZ[e.a] + NZ[e.b]) / 2 - cz, d2 = dx * dx + dz * dz;
      if (!e.dead && e.len > 14 && d2 > R_SPAWN_MIN * R_SPAWN_MIN && d2 < R_SPAWN_MAX * R_SPAWN_MAX) cands.push([pl, i]);
    }
    if (!cands.length) return null;
    for (let k = 0; k < 8; k++) { const v = trySpawnBus(kind, cands); if (v) { v.tour = true; return v; } }
    return null;
  }
  const baseY = v => { const dk = v.route[0] && v.route[0].br ? topY(v.x, v.z) : NaN; return (dk === dk ? dk : groundY(v.x, v.z)) + (v.fly ? v.fly.y : 0); };   // where the vehicle's wheels are (bridge decks too)

  // ---------- police, lookouts, team bus, double parking: they steer ordinary vehicles through this small interface ----------
  function spawnOffscreen(name, dmin, dmax, edgeOk) { // a new vehicle out of view, dmin..dmax metres from the lapa, on an edge edgeOk(midX, midZ, edge) accepts
    if (!candEdges.length) return null;
    const ty = TYPES[name], tot = candCum[candCum.length - 1];
    for (let k = 0; k < 40; k++) {
      let lo = 0, hi = candCum.length - 1; const r = Math.random() * tot;
      while (lo < hi) { const m = (lo + hi) >> 1; if (candCum[m] < r) lo = m + 1; else hi = m; }
      const e = candEdges[lo]; if (!allowed(e, ty) || (ty.copV && e.ped)) continue;
      if (edgeOk && !edgeOk((NX[e.a] + NX[e.b]) / 2, (NZ[e.a] + NZ[e.b]) / 2, e)) continue;
      const t = Math.min(e.len - 0.5, ty.L * 0.5 + 0.5 + Math.random() * Math.max(0, e.len - ty.L - 1)), pref = Math.random() < 0.55 ? 1 : -1;
      const off = laneOff(e, { pref, ty }), x = NX[e.a] + e.dx * t + e.rx * off, z = NZ[e.a] + e.dz * t + e.rz * off;
      const dp = hyp2(x - car.x, z - car.z); if (dp < dmin || dp > dmax) continue;
      if (hyp2(x - camera.position.x, z - camera.position.z) < R_SPAWN_MIN || inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3)) continue;
      let clear = true; for (const o of vs) if (hyp2(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 4) { clear = false; break; }
      if (!clear) continue;
      const v = { id: ++nextId, ty, name, x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref,
        lat: 0, latT: 0, drv: 0.9 + Math.random() * 0.15, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0, sigW: 0, sigHold: false, rv: 0, ot: null, otW: 0, otNext: 0, gap: 1e9, yaw: 0, roll: 0, col: pickW(ty.colObjs), age: 0, blocker: null };
      extendRoute(v);
      if (v.route.length < 2 && e.len < 40) continue;
      vs.push(v); counts[name] = (counts[name] || 0) + 1;
      return v;
    }
    return null;
  }
  function spawnAt(name, e, t, init) { // a new vehicle on edge e, t metres along it, not in the lapa's way nor in view close by (the knife-grinders take shape on their loops, src/arrotini.js); init(v) runs before its route is built
    const ty = TYPES[name]; if (!allowed(e, ty)) return null;
    const pref = Math.random() < 0.55 ? 1 : -1, off = laneOff(e, { pref, ty }), x = NX[e.a] + e.dx * t + e.rx * off, z = NZ[e.a] + e.dz * t + e.rz * off;
    const dc = hyp2(x - camera.position.x, z - camera.position.z);
    if (dc < R_SPAWN_MIN || hyp2(x - car.x, z - car.z) < 18 || (dc < R_FAR && inView(x, groundY(x, z) + 1, z, ty.L * 0.6 + 3))) return null;
    for (const o of vs) if (Math.abs(o.x - x) < 14 && Math.abs(o.z - z) < 14 && hyp2(o.x - x, o.z - z) < (ty.L + o.ty.L) * 0.5 + 4) return null;
    const v = { id: ++nextId, ty, name, x, z, h: Math.atan2(e.dx, e.dz), v: Math.min(e.v * ty.vf, ty.vcap) * 0.7, ex: 0, ez: 0, route: [e], t, pref,
      lat: 0, latT: 0, drv: 0.9 + Math.random() * 0.15, stopT: 0, honkAt: -1, blockT: 0, wait: 0, stuck: 0, sigW: 0, sigHold: false, rv: 0, ot: null, otW: 0, otNext: 0, gap: 1e9, yaw: 0, roll: 0, col: pickW(ty.colObjs), age: 0, blocker: null };
    if (init) init(v);
    extendRoute(v); vs.push(v); counts[name] = (counts[name] || 0) + 1;
    return v;
  }
  // put a vehicle that left the graph (police boxing in) back on the nearest edge pointing its way
  function snap(v) {
    let best = null, bs = 1e9, bt = 0; const fx = Math.sin(v.h), fz = Math.cos(v.h);
    G.eachEdgeNear(v.x, v.z, 16, e => {
      if (!allowed(e, v.ty)) return;
      const ax = NX[e.a], az = NZ[e.a], t = (v.x - ax) * e.dx + (v.z - az) * e.dz;
      if (t < 0 || t > e.len) return;
      const cs = e.dx * fx + e.dz * fz; if (cs < 0.2) return;
      const al = Math.abs((v.x - ax) * e.rx + (v.z - az) * e.rz - laneOff(e, v)); if (al > 14) return;
      const sc = al + (1 - cs) * 8; if (sc < bs) { bs = sc; best = e; bt = t; }
    });
    if (!best) return false;
    v.route = [best]; v.t = bt; v.lat = 0; v.latT = 0; v.wait = 0; v.stuck = 0; v.blocker = null; extendRoute(v);
    return true;
  }
  const fx = createBeacons(scene, camera);
  const T = { vs, TYPES, car, camera, groundY, shoutAt, inView, snap, wallPush, stepFly, spawnOffscreen, spawnAt,
    spawnCop: (name, dmin, dmax, toward) => spawnOffscreen(name, dmin, dmax, toward ? (mx, mz, e) => hyp2(NX[e.b] - car.x, NZ[e.b] - car.z) < hyp2(NX[e.a] - car.x, NZ[e.a] - car.z) - 5 : null),
    uturn(v) { // a police car heading away from the lapa swings round on a two-way road
      const e = v.route[0]; if (!e || e.rev < 0 || v.cop.mode !== 'road') return false;
      const r = EDGES[e.rev]; v.route = [r]; v.t = clamp(r.len - v.t, 0, r.len); v.pref = -v.pref; v.blocker = null; extendRoute(v); return true;
    },
    spawnTeamBus() { rebuildBusCandidates(camera.position.x, camera.position.z); for (let k = 0; k < 12; k++) { const v = trySpawnBus('teamBus'); if (v) return v; } return null; },
    spawnTour, baseY,
    removeVehicle(v) { const i = vs.indexOf(v); if (i >= 0) removeAt(i); } };
  police = createPolice(env, T);
  addEventListener('pd-yeet', e => police.chaos((e.detail && e.detail.kind) || 'yeet'));
  addEventListener('pd-fence', e => police.chaos((e.detail && e.detail.kind) || 'fence'));   // a smashed fence panel, garden wall or hedge (src/fences.js, src/props.js): a little chaos   // the lapa launched a parked car (src/props.js): the same chaos as launching a traffic car
  // the lookouts of a gang (src/danger.js): when you are told to get out, the scooters near you shout it; if there is none in sight, one balloon from the roadside ahead
  addEventListener('pd-lookout', e => {
    const text = e.detail && e.detail.text; if (!text) return;
    let n = 0;
    for (const v of vs) if (n < 2 && v.ty.scooter && !v.dead && !v.fly && hyp2(v.x - car.x, v.z - car.z) < 45 && inView(v.x, 1, v.z, 2)) { shoutAt(v, text); n++; }
    if (!n) { const sn = Math.sin(car.th), cs = Math.cos(car.th), x = car.x + sn * 14 + cs * 5, z = car.z + cs * 14 - sn * 5; env.shout?.(x, groundY(x, z) + 1.8, z, text); }
  });
  gags = createGags(env, T, police);
  const carrozze = createCarrozze(env, T), vendors = createVendors(env, T);
  arrotini = createArrotini(T, { NX, NZ, NOUT, nearestNode: G.nearestNode });

  return {
    update, collidePlayer,
    agents: () => agentsOut,
    vehicles: vs, arrotini: arrotini.list, bindClock: arrotini.bindClock,   // src/city-audio.js: the vehicles to hear, and the knife-grinders (each on duty has x, z, h and v, his vehicle once he is near enough to have one); bindClock(game.time): they work from 07:30 to 20:00
    setQuality(q) { densK = q === 'low' ? 0.5 : 1; },   // 'low' halves the cap on cars (the cars already there leave as they pass out of range); low / medium / high from main.js applySettings
    setVolume(v) { audio.vol = clamp(+v || 0, 0, 1); if (audio.master) audio.master.gain.value = audio.vol * 0.12; police.setVolume(v); },
    bindPedestrians(api) { peds = api; police.bindPedestrians(api); gags.bindPedestrians(api); carrozze.bindPedestrians(api); },   // called by pedestrians.js once it is built
    // The cross-tile road graph, for routing (missions, minimap route line). Only tiles at full detail are in it.
    //   nearestNode(x, z, maxDist = 60, drivable = true) -> node id or -1
    //   nodePos(n) -> [x, z]
    //   path(x0, z0, x1, z1) -> { pts: [x, z, ...], len (m), complete, nodes } | null: A* over drivable edges, one-ways respected; when the
    //     destination is not resident (or unreachable) the path ends at the reachable node closest to it and complete is false
    //   plan(x, z, hx, hz, targets, opts), edgeFor(x, z, hx, hz, maxd, out), tileLoaded(x, z): the guidance queries of src/route-guide.js (see traffic-graph.js)
    //   ready(x, z, r = 120) -> true when drivable roads are resident within r metres
    //   version: bumps whenever tiles are added or dropped; stats() -> { nodes, edges, tiles, vehicles, tileMs }
    debug: { vs, police, gags, carrozze, vendors, arrotini, tourPlan, TYPES, G, TOURS, shortest, OT },   // ?debug probes
    graph: {
      nearestNode: G.nearestNode, path: G.path, nodePos: n => [NX[n], NZ[n]],
      plan: G.plan, edgeFor: G.edgeFor, tileLoaded: G.tileLoaded,   // route guidance (src/route-guide.js): the way on from the car to several targets, with a head start each
      ready(x, z, r = 120) { let ok = false; G.eachEdgeNear(x, z, r, e => { if (!e.ped) ok = true; }); return ok; },
      get version() { return G.version; },
      stats: () => { let ow = 0, alive = 0; for (const e of EDGES) if (e) { if (e.ow) ow++; if (e.alive) alive++; } return { nodes: NX.length, edges: EDGES.length, oneway: ow, alive, tiles: G.tiles.size, vehicles: vs.length, target, cands: candEdges.length, plans: PLANS.length, buses: counts.bus || 0, tileMs, aliveMs: +aliveMs.toFixed(1), aliveMax: +aliveMax.toFixed(1) }; },
    },
  };
}
