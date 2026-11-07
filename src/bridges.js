// Bridges, viaducts and tunnels of the world tiles (records `structs` of tools/structures.py, written into every tile they touch).
//
// What it does, per structure (one copy per id, however many tiles hold it):
//   * registers, as soon as a tile's data is parsed (registerStructs, called by src/world.js): the deck or tunnel floor as a "level"
//     (levelY: a second ground the car can stand on above the terrain), the terrain trench under a bridge and the cutting at tunnel mouths
//     (carve, applied inside hooks.ground so the terrain mesh, streets, props and the car all agree), and the parapet and tunnel walls
//     in the wall grid (tagged with their height level, so a car under a deck is not stopped by the parapet above it);
//   * builds the meshes while a tile is at full detail (onTileFull / onTileDrop): deck slab, asphalt, pavements, parapets, piers and
//     abutments, the river with its bed, and tunnel walls, ceiling and floor.
// Deck heights are linear between the ground heights at the two ends baked by tools/structures.py (y0, y1), so they do not depend on which
// tiles happen to be loaded. A flyover (ov) climbs RISE m between its ends and ramps; a bridge over water or a valley stays level and the
// terrain below is cut down to the river bed (dep metres under the deck, from the TINITALY DEM).
//
// The one place that has to know about levels besides this file is the sphere driving model (src/vehicle-sphere.js): it asks
// hooks.level(x, z, yRef) for the surface the ball stands on. Everything else keeps reading groundY (the terrain), which is what
// props, streets and pedestrians want; the car's height above the terrain simply grows by the deck height (car.lift, car.deck).
//
// Secret spot: LANDMARK_ZONES. Falling off the Ponte Corleone (Viale Regione Siciliana over the Oreto, next to Baby Luna) fires
// window event 'pd-landmark' with { id: 'baby-luna-jump', x, z, fall } once per fall, and calls the listeners of onLandmarkEvent().
import * as THREE from 'three';
import { Buf } from './core.js';
import { TEX } from './streets.js';

export const LANDMARK_ZONES = [
  // OSM ways 81030481 and 81030484 (Viale Regione Siciliana Sud Est, bridge=yes, layer 1), 40 to 50 m from the bar Baby Luna (way 81030476).
  // A fall counts when the car leaves the deck over the parapet (vaulting it at speed, see `jump`) and drops at least `minFall` metres.
  { id: 'baby-luna-jump', structs: ['b81030481', 'b81030484'], minFall: 4, jump: true, label: 'Bba ieccati ru baby luna' },
];
const listeners = new Set();
export const onLandmarkEvent = fn => { listeners.add(fn); return () => listeners.delete(fn); };

const RIVER_DIG = 0.9;                 // metres the river channel is cut under the floor of the valley
const RISE = 5.4, RAMP = 28;           // flyovers: clearance above the road below, and the length of each ramp
const DIP = 2.7, DIP_FLAT = 6, DIP_RAMP = 42;   // a road that passes under a flyover (rec.ud, its line and ground, from the bake) sinks DIP m, level for DIP_FLAT m beyond the deck's edge and back to the ground over DIP_RAMP m: the deck then climbs RISE - DIP, not RISE
const END_OPEN = 12, END_OPEN_RISE = 1.0;   // flyover ends: no parapet collider within END_OPEN m of an end until the deck stands END_OPEN_RISE m above its starting line
const PLATEAU = 9, RAMP_LOCAL = 36;    // a long flyover (rec.oc, the metres along it where roads pass under it) is lifted only this far from each crossing, then falls back over RAMP_LOCAL m to follow the ground
const CLEAR_IN = 12;                   // a long viaduct's clearance over the ground (0.4 m) eases in over this many metres from each end
const SLAB = 0.9, KERB = 0.15, PARAPET_H = 1.0, SIDEWALK = 1.2, PARAPET_W = 0.5;
const CELL = 24;
const hh = (a, b) => Math.hypot(a, b);

// ---------- registry ----------
let walls = null, rawGround = null;
const S = new Map();                   // id -> structure state
const byTile = new Map();              // tile key -> Set of ids
const levelGrid = new Map(), chanGrid = new Map();
const ck = (ix, iz) => ix * 100003 + iz;
function gridAdd(grid, x0, z0, x1, z1, item) {
  for (let ix = Math.floor(Math.min(x0, x1) / CELL); ix <= Math.floor(Math.max(x0, x1) / CELL); ix++)
    for (let iz = Math.floor(Math.min(z0, z1) / CELL); iz <= Math.floor(Math.max(z0, z1) / CELL); iz++) { const k = ck(ix, iz); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(item); }
}
function gridDel(grid, id) {
  for (const [k, a] of grid) { let w = 0; for (let i = 0; i < a.length; i++) if (a[i].id !== id) a[w++] = a[i]; if (w) a.length = w; else grid.delete(k); }
}

export function initStructs({ wallGrid, ground }) { walls = wallGrid; rawGround = ground; }

// y along the centreline (vertex k, cumulative length s)
function profile(st) {
  const r = st.rec, n = r.p.length / 2, cum = new Float32Array(n), ys = new Float32Array(n);
  for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + hh(r.p[2 * k] - r.p[2 * k - 2], r.p[2 * k + 1] - r.p[2 * k - 1]);
  const L = cum[n - 1] || 1, y0 = r.y0, y1 = r.y1;
  for (let k = 0; k < n; k++) {
    const s = cum[k];
    let y = y0 + (y1 - y0) * s / L;
    if (r.k === 'b' && r.ov) {
      const q = Math.min(1, s / Math.min(RAMP, L / 2), (L - s) / Math.min(RAMP, L / 2));   // ramps at both ends (the whole of a short bridge is ramp)
      let rise = q * q * (3 - 2 * q);
      if (r.oc && r.oc.length) {   // the roads below are known: lift only around them (the interchange ramps of Isola delle Femmine were slabs 5 m above the field for 190 m)
        let b = 0; for (const c of r.oc) b = Math.max(b, Math.min(1, Math.max(0, 1 - (Math.abs(s - c) - PLATEAU) / RAMP_LOCAL)));
        rise = Math.min(rise, b * b * (3 - 2 * b));
      }
      y += (r.ud && r.oc && r.ud.length === r.oc.length ? RISE - DIP : RISE) * rise;
    }
    ys[k] = y;
  }
  st.cum = cum; st.ys = ys; st.L = L;
  return st;
}
const yAt = (st, s) => { // linear along the polyline
  const cum = st.cum, n = cum.length; let k = 1; while (k < n - 1 && cum[k] < s) k++;
  const t = Math.max(0, Math.min(1, (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1))); return st.ys[k - 1] + (st.ys[k] - st.ys[k - 1]) * t;
};

// tunnel floor: level between the portals where the ground above is a hill, dipping where the ground is flat (an underpass), see floorOf
const TUN_H = 5.2, TUN_ROOF = 0.8, TUN_SLOPE = 0.1, TUN_COVER = TUN_H + 0.6;   // ceiling height, roof thickness of a flat underpass, steepest ramp, ground-over-floor that counts as covered
const XC_ALONG = 1.5, XC_MARGIN = 0.5;   // a road over a tunnel (rec.xc): the floor is kept TUN_COVER + XC_MARGIN under its ground (rec.xg) across its width plus XC_ALONG each side

// The roads that cross over a tunnel at ground level (rec.xc, and the lowest ground round each, rec.xg, from the bake). Where the floor is not deep enough under
// one of them, the cutting of the tunnel's mouth takes that road's ground away: a short underpass dips only in its middle, so a road crossing it off centre
// stood over a 5 to 7 m trench (the Viale Regione Siciliana over Via Emily Balch, x -1300, z 3016, and the motorways over the short underpasses of Via De
// Gasperi or Viale Leone). The floor goes down to TUN_COVER + XC_MARGIN under each such road, level across it, climbing back at TUN_SLOPE; where that leaves
// it lower than a mouth, the ramp down to it is on the road outside (rec.ap), as in a real underpass (OSM's tunnel way is the covered part): st.ramp.
function tunnelDip(st) {   // floor: portal grades, plus a dip where the terrain above is not a hill
  const r = st.rec, p = r.p, n = p.length / 2;
  let minG = 1e9;
  if (r.pg) {   // the baked ground along the tunnel: the same whichever tiles have loaded
    // Not over the climb at either end where the ground rises steadily from the mouth until it covers the floor: under a hill that climb is the open cutting,
    // and counted as the lowest ground it sank every hill tunnel 6 m or more under the grade between its mouths (7 to 13 m in eight tunnels, 6.9 m in
    // the Galleria Sferracavallo). A flat underpass never gets that cover, so it still dips under the lowest of all its ground.
    const g = r.pg, m = g.length, grade = k => r.y0 + (r.y1 - r.y0) * k / ((m - 1) || 1), over = k => g[k] - grade(k) >= TUN_COVER + 0.5;
    let i0 = 0, i1 = m - 1;
    while (i0 < m - 1 && !over(i0) && g[i0 + 1] >= g[i0] - 0.1) i0++;
    while (i1 > 0 && !over(i1) && g[i1 - 1] >= g[i1] - 0.1) i1--;
    if (over(i0) && over(i1) && i0 <= i1) {   // a hill: the floor follows the grade, down only where the ground in between does not cover it
      let need = 0; for (let k = i0; k <= i1; k++) need = Math.max(need, grade(k) + TUN_COVER + 0.5 - g[k]);
      minG = (r.y0 + r.y1) / 2 + TUN_COVER + 0.5 - need;
    } else for (const v of g) minG = Math.min(minG, v);
  } else for (let k = 0; k < n; k++) { const g = rawGround(p[2 * k], p[2 * k + 1]); if (g !== undefined) minG = Math.min(minG, g); }   // undefined: that tile has no ground yet
  const base = (r.y0 + r.y1) / 2;
  const dip = Math.min(14, Math.max(0, base - (minG - TUN_COVER - 0.5)));   // a flat underpass: the floor sits so that the ground over it is a roof everywhere; a hill covers a level road by itself
  st.dip = dip; const R = dip > 0 ? Math.min(st.L / 2, dip / TUN_SLOPE) : 0; st.R = R;
  for (let k = 0; k < n; k++) { const s = st.cum[k], q = R > 0 ? Math.min(1, s / R, (st.L - s) / R) : 1; st.ys[k] -= dip * Math.max(0, q); }
}
// the first o metres of a line (vertices every 4 m at most, without its first point), and the rest of it from there
function cutLine(f, o) {
  const head = [], rest = []; let acc = 0, k = 2;
  for (; k < f.length; k += 2) {
    const ax = f[k - 2], az = f[k - 1], l = hh(f[k] - ax, f[k + 1] - az);
    if (acc + l >= o) { const t = (o - acc) / (l || 1), x = ax + (f[k] - ax) * t, z = az + (f[k + 1] - az) * t; head.push(...densify([ax, az, x, z], 4).slice(2)); rest.push(x, z, ...f.slice(k)); break; }
    head.push(...densify([ax, az, f[k], f[k + 1]], 4).slice(2)); acc += l;
  }
  if (!rest.length) rest.push(f[f.length - 2], f[f.length - 1], f[f.length - 2] + 1e-3, f[f.length - 1]);
  return [head, rest];
}
function underRoads(st) {
  const r = st.rec, x0 = r.__x0 || 0;   // (__x0: metres a previous registration of this record carried its start on by)
  const need = r.xc.map(([s, w], i) => [s + x0, w / 2 + XC_ALONG, r.xg[i] - TUN_COVER - XC_MARGIN]);   // [metres along, half width, the highest floor that leaves that road its ground]
  const B = s => { let b = Infinity; for (const [c, hc, y] of need) b = Math.min(b, y + TUN_SLOPE * Math.max(0, Math.abs(s - c) - hc)); return b; };
  // a road wider than the tunnel way reaches past a mouth that has to go down (the motorway over Via De Gasperi, 14 m wide 5 m from the mouth): carry the
  // tunnel on under it along the road out of that mouth, or the ramp outside would cut the edge of that road
  if (!r.__ap) {
    const L = st.L, o0 = B(0) < r.y0 - 0.05 ? Math.max(0, ...need.map(([c, hc]) => hc + 1 - c)) : 0, o1 = B(L) < r.y1 - 0.05 ? Math.max(0, ...need.map(([c, hc]) => c + hc + 1 - L)) : 0;
    r.__ap = r.ap.slice(); r.__x0 = 0; r.__x1 = 0;
    if (o0 > 0) { const [h, rest] = cutLine(r.ap[0], o0), pre = []; for (let k = h.length - 2; k >= 0; k -= 2) pre.push(h[k], h[k + 1]); r.p = pre.concat(r.p); r.__ap[0] = rest; r.__x0 = o0; for (const q of need) q[0] += o0; }
    if (o1 > 0) { const [h, rest] = cutLine(r.ap[1], o1); r.p = r.p.concat(h); r.__ap[1] = rest; r.__x1 = o1; }
    if (o0 > 0 || o1 > 0) { profile(st); tunnelDip(st); }
  }
  const n = st.ys.length;
  for (let k = 0; k < n; k++) st.ys[k] = Math.min(st.ys[k], B(st.cum[k]));
  const long = f => { let l = 0; for (let k = 2; k < f.length; k += 2) l += hh(f[k] - f[k - 2], f[k + 1] - f[k - 1]); return l > 2; };   // (a road out that is no road: the mouth of the next tunnel)
  st.ramp = [st.ys[0] < r.y0 - 0.05 && long(r.__ap[0]) ? st.ys[0] : null, st.ys[n - 1] < r.y1 - 0.05 && long(r.__ap[1]) ? st.ys[n - 1] : null];   // the floor at a mouth that is below the ground there
}

// ---------- the open cutting of a tunnel: retaining walls and portals ----------
// A tunnel is one path for this: the road out of its start mouth where that is a ramp (st.ramp, reversed), the tunnel line, the ramp out of its end mouth.
// Every vertex has a floor (st.ys; a ramp climbs at TUN_SLOPE from the floor at its mouth) and the ground over it from the bake (rec.pg along the tunnel,
// rec.ag along the roads out), so the same cutting comes out whichever tiles have loaded. A stretch of the tunnel line with less than TUN_COVER of ground over
// its floor, and every ramp below the ground, is an open cutting; the rest of the tunnel line is covered, and a portal stands where one meets the other.
// The cutting is walled: within its walls (CUT_T thick, their inner face on the line of the tunnel's lining) the ground is the floor (carve), outside them it is
// the ground as it is. On a 2.5 m terrain grid that step was a band of tilted triangles from the floor to the top, over the tunnel's mouth as well; now the
// terrain mesh is cut along the walls (cutPieces, src/world.js) and so are the street layers (src/streets.js), and buildTunnel draws the walls, the floor of
// the ramps and a concrete headwall over every portal.
const PG_STEP = 4;                     // rec.pg: a sample every PG_STEP m of the tunnel's baked line (tools/structures.py)
const CUT_T = 0.5, CUT_PAR = 1.0;      // retaining wall thickness; parapet over the ground at the top of a deep cutting (a shallow one gets less)
const cutGrid = new Map();
const lin = (xs, ys, s) => {   // piecewise linear, held at the ends
  const n = xs.length; if (!n) return undefined; if (s <= xs[0]) return ys[0]; if (s >= xs[n - 1]) return ys[n - 1];
  let a = 0, b = n - 1; while (b - a > 1) { const m = (a + b) >> 1; if (xs[m] <= s) a = m; else b = m; }
  return ys[a] + (ys[b] - ys[a]) * (s - xs[a]) / ((xs[b] - xs[a]) || 1);
};
const cumOf = f => { const c = [0]; for (let k = 2; k < f.length; k += 2) c.push(c[c.length - 1] + hh(f[k] - f[k - 2], f[k + 1] - f[k - 1])); return c; };
const parOf = d => Math.max(0.15, Math.min(CUT_PAR, d * 0.4));   // the parapet over the top of a wall d m high
function cutPath(st) {
  const r = st.rec, p = r.p, n = p.length / 2, x0 = r.__x0 || 0, L0 = st.L - x0 - (r.__x1 || 0);
  const pg = r.pg, pgS = pg ? pg.map((_, k) => Math.min(k * PG_STEP, L0)) : null;
  const ag = e => r.ap && r.ap[e] && r.ag && r.ag[e] ? [cumOf(r.ap[e]), r.ag[e]] : null, A = [ag(0), ag(1)];
  const raw = (x, z, f) => { const g = rawGround(x, z); return g === undefined ? f + TUN_COVER : g; };   // (no bake data: the ground as loaded, covered where there is none yet)
  const G = (s, x, z, f) => {   // the ground at metres s along the tunnel line
    const u = s - x0;
    if (u < 0 && A[0]) return lin(A[0][0], A[0][1], -u);
    if (u > L0 && A[1]) return lin(A[1][0], A[1][1], u - L0);
    return pg ? lin(pgS, pg, u) : raw(x, z, f);
  };
  const P = [];
  const ramp = e => {   // the vertices of the ramp out of mouth e, from the mouth outward
    const y = st.ramp ? st.ramp[e] : null; if (y === null || y === undefined) return [];
    const f = densify(r.__ap[e], 4), c = cumOf(f), o = e ? r.__x1 || 0 : x0, out = [];
    for (let k = 1; k < c.length; k++) { const x = f[2 * k], z = f[2 * k + 1], fl = y + TUN_SLOPE * c[k]; out.push({ x, z, f: fl, g: A[e] ? lin(A[e][0], A[e][1], c[k] + o) : raw(x, z, fl), t: 0 }); }
    return out;
  };
  P.push(...ramp(0).reverse());
  for (let k = 0; k < n; k++) P.push({ x: p[2 * k], z: p[2 * k + 1], f: st.ys[k], g: G(st.cum[k], p[2 * k], p[2 * k + 1], st.ys[k]), t: 1 });
  P.push(...ramp(1));
  // the points where the depth of the floor under the ground crosses TUN_COVER (a portal) or 0 (where a cutting runs out)
  const Q = [P[0]];
  for (let k = 1; k < P.length; k++) {
    const a = P[k - 1], b = P[k], da = a.g - a.f, db = b.g - b.f, ts = [];
    if (a.t && b.t && (da - TUN_COVER) * (db - TUN_COVER) < 0) ts.push((TUN_COVER - da) / (db - da));
    if (da * db < 0) ts.push(-da / (db - da));
    ts.sort((u, v) => u - v);
    for (const t of ts) if (t > 0.01 && t < 0.99) Q.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, f: a.f + (b.f - a.f) * t, g: a.g + (b.g - a.g) * t, t: a.t && b.t ? 1 : 0 });
    Q.push(b);
  }
  const m = Q.length; if (m < 2) return null;
  for (let k = 0; k < m; k++) {   // mitred left normal, metres along
    const a = Q[Math.max(0, k - 1)], b = Q[Math.min(m - 1, k + 1)], l = hh(b.x - a.x, b.z - a.z) || 1;
    Q[k].nx = -(b.z - a.z) / l; Q[k].nz = (b.x - a.x) / l; Q[k].s = k ? Q[k - 1].s + hh(Q[k].x - Q[k - 1].x, Q[k].z - Q[k - 1].z) : 0;
  }
  // per segment: 2 covered (inside the tunnel, the ground a roof over it), 1 open cutting, 0 at the ground (nothing to cut)
  const seg = new Uint8Array(m - 1);
  for (let k = 0; k + 1 < m; k++) {
    const a = Q[k], b = Q[k + 1], da = a.g - a.f, db = b.g - b.f;
    seg[k] = a.t && b.t && Math.min(da, db) >= TUN_COVER - 1e-3 ? 2 : Math.max(da, db) > 0.02 && Math.min(da, db) > -1e-3 ? 1 : 0;
  }
  const hw = r.w / 2 - 0.3, W = hw + CUT_T, quads = [];
  for (let k = 0; k + 1 < m; k++) {
    if (seg[k] !== 1) continue;
    const a = Q[k], b = Q[k + 1];
    let c = [a.x + a.nx * W, a.z + a.nz * W, b.x + b.nx * W, b.z + b.nz * W, b.x - b.nx * W, b.z - b.nz * W, a.x - a.nx * W, a.z - a.nz * W];
    let ar = 0; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; ar += c[2 * i] * c[2 * j + 1] - c[2 * j] * c[2 * i + 1]; }
    if (ar < 0) c = [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];   // counter-clockwise (x right, z down the screen of the formula)
    const pl = [];   // inside: nx * x + nz * z <= d for each edge
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, ex = c[2 * j] - c[2 * i], ez = c[2 * j + 1] - c[2 * i + 1], l = hh(ex, ez) || 1, nx = ez / l, nz = -ex / l; pl.push(nx, nz, nx * c[2 * i] + nz * c[2 * i + 1]); }
    const xs = [c[0], c[2], c[4], c[6]], zs = [c[1], c[3], c[5], c[7]];
    quads.push({ id: r.id, st, k, ax: a.x, az: a.z, dx: b.x - a.x, dz: b.z - a.z, l2: (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1, fa: a.f, fb: b.f, hw, c, pl,
      bx0: Math.min(...xs), bz0: Math.min(...zs), bx1: Math.max(...xs), bz1: Math.max(...zs) });
  }
  return { Q, seg, hw, W, quads };
}
const inQuad = (q, x, z) => { const p = q.pl; return p[0] * x + p[1] * z <= p[2] + 1e-6 && p[3] * x + p[4] * z <= p[5] + 1e-6 && p[6] * x + p[7] * z <= p[8] + 1e-6 && p[9] * x + p[10] * z <= p[11] + 1e-6; };
const quadFloor = (q, x, z) => q.fa + (q.fb - q.fa) * Math.max(0, Math.min(1, ((x - q.ax) * q.dx + (z - q.az) * q.dz) / q.l2));
// is (x, z) on the floor of another tunnel's open cutting (the walls of two cuttings side by side, the carriageways of the Viale over Via Emily Balch, stand in each other's road)
function inOtherCut(id, x, z) {
  const a = cutGrid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return false;
  for (const q of a) {
    if (q.id === id || x < q.bx0 || x > q.bx1 || z < q.bz0 || z > q.bz1) continue;
    const t = ((x - q.ax) * q.dx + (z - q.az) * q.dz) / q.l2; if (t < 0 || t > 1) continue;
    if (hh(x - q.ax - q.dx * t, z - q.az - q.dz * t) < q.hw - 0.05) return true;
  }
  return false;
}
// is (x, z) within the walls of an open cutting?
export function inCut(x, z) {
  const a = cutGrid.size ? cutGrid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))) : null; if (!a) return false;
  for (const q of a) if (x >= q.bx0 && x <= q.bx1 && z >= q.bz0 && z <= q.bz1 && inQuad(q, x, z)) return true;
  return false;
}
// any cutting within the box?
export function cutTouches(x0, z0, x1, z1) {
  if (!cutGrid.size) return false;
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
    const a = cutGrid.get(ck(ix, iz)); if (a) for (const q of a) if (q.bx1 >= x0 && q.bx0 <= x1 && q.bz1 >= z0 && q.bz0 <= z1) return true;
  }
  return false;
}
// a convex polygon [x, z, ...] cut by the line nx * x + nz * z = d: the part with nx * x + nz * z <= d (keep 1) or >= d (keep -1)
function clipPoly(P, nx, nz, d, keep) {
  const out = [], n = P.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = P[2 * i], az = P[2 * i + 1], bx = P[2 * j], bz = P[2 * j + 1];
    const sa = (nx * ax + nz * az - d) * keep, sb = (nx * bx + nz * bz - d) * keep;
    if (sa <= 0) out.push(ax, az);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) { const t = sa / (sa - sb); out.push(ax + (bx - ax) * t, az + (bz - az) * t); }
  }
  return out;
}
const polyArea = P => { let a = 0; const n = P.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += P[2 * i] * P[2 * j + 1] - P[2 * j] * P[2 * i + 1]; } return Math.abs(a) / 2; };
// A triangle of a ground-draped mesh, cut along the walls of every open cutting it crosses: null where it crosses none, else { out: polygons outside every
// cutting, in: polygons inside one } (convex, [x, z, ...], the triangle's winding). The terrain keeps `out` only; the street layers drape both.
export function cutPieces(ax, az, bx, bz, cx, cz) {
  if (!cutGrid.size) return null;
  const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
  let qs = null;
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
    const a = cutGrid.get(ck(ix, iz)); if (a) for (const q of a) if (q.bx1 >= x0 && q.bx0 <= x1 && q.bz1 >= z0 && q.bz0 <= z1) (qs || (qs = new Set())).add(q);
  }
  if (!qs) return null;
  let out = [[ax, az, bx, bz, cx, cz]], hit = false; const ins = [];
  for (const q of qs) {
    const next = [];
    for (const P of out) {
      const pieces = []; let rest = P;
      for (let i = 0; i < 4 && rest.length >= 6; i++) {
        const o = clipPoly(rest, q.pl[3 * i], q.pl[3 * i + 1], q.pl[3 * i + 2], -1);
        if (o.length >= 6 && polyArea(o) > 1e-4) pieces.push(o);
        rest = clipPoly(rest, q.pl[3 * i], q.pl[3 * i + 1], q.pl[3 * i + 2], 1);
      }
      if (rest.length >= 6 && polyArea(rest) > 1e-4) { next.push(...pieces); ins.push(rest); hit = true; }
      else next.push(P);   // (it does not reach into this one: kept whole)
    }
    out = next;
  }
  return hit ? { out, in: ins } : null;
}

function densify(p, step) {
  const out = [p[0], p[1]];
  for (let k = 2; k < p.length; k += 2) {
    const ax = p[k - 2], az = p[k - 1], bx = p[k], bz = p[k + 1], n = Math.max(1, Math.round(hh(bx - ax, bz - az) / step));
    for (let i = 1; i <= n; i++) out.push(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
  }
  return out;
}

export function registerStructs(d, key) {
  const list = d && d.structs; if (!list) return;
  const mine = new Set(), fresh = [];
  for (const rec of list) {
    // a footway underpass is a short tunnel that cannot get its 5.8 m of cover where the road above lies in a hollow: it would stay an open trench across the road (the sprint's line at Viale Regione, x -2790, z 263) and nobody drives through it
    if (rec.k === 't' && rec.f) continue;
    if (rec.id === 'b699377602') continue;   // Ponte dell'Ammiraglio: the stone landmark is the bridge (src/lmc-g.js), a generic deck would show through its arches
    mine.add(rec.id);
    let st = S.get(rec.id);
    if (st) { st.tiles.add(key); continue; }
    if (rec.y0 === undefined) continue;
    if (rec.k === 'b' && rec.ly >= 1 && !rec.rv && !rec.ov && Math.abs(rec.y1 - rec.y0) < 2.5) {   // a flat layer-1 bridge that is not over water and is short: a flyover whose road below was not flagged (tools/structures.py misses it when the road under it is split at the crossing). Left flat its deck lay on the ground and its parapets walled the road off (Viale Regione at Piazza Einstein, the sprint's line)
      let L = 0; for (let k = 2; k < rec.p.length; k += 2) L += hh(rec.p[k] - rec.p[k - 2], rec.p[k + 1] - rec.p[k - 1]);
      if (L >= 25 && L <= 260) rec.ov = 1;
    }
    rec.p = densify(rec.p, rec.k === 't' ? 4 : 6);   // the profile (ramps, a dip) needs vertices
    st = profile({ id: rec.id, rec, tiles: new Set([key]), meshes: null, full: new Set() });
    const r = rec;
    if (r.k === 't') { tunnelDip(st); if (r.xc && r.xg && r.ap) underRoads(st); }   // (underRoads may carry the tunnel on past a mouth: p is read after it)
    const p = r.p, n = p.length / 2;
    if (r.k === 'b' && st.L > 150 && (!r.ov || r.oc)) for (let k = 1; k < n - 1; k++) {   // a long viaduct crosses hills as well as valleys: never under the ground. The two ends keep the baked height
      // (the ground the road arrives on) and the clearance eases in over CLEAR_IN m: lifted to the ground + 0.4 there, 23 deck ends stood 0.4 to 2 m above their approach
      const g = rawGround(p[2 * k], p[2 * k + 1]); if (g !== undefined) st.ys[k] = Math.max(st.ys[k], g + 0.4 * Math.min(1, st.cum[k] / CLEAR_IN, (st.L - st.cum[k]) / CLEAR_IN));
    }
    S.set(rec.id, st);
    // level surface (levelY): one entry per centreline segment
    for (let k = 0; k + 1 < n; k++) {
      const e = { id: rec.id, x0: p[2 * k], z0: p[2 * k + 1], x1: p[2 * k + 2], z1: p[2 * k + 3], y0: st.ys[k], y1: st.ys[k + 1], hw: r.w / 2 - PARAPET_W - 0.1, st, tun: r.k === 't' };
      e.dx = e.x1 - e.x0; e.dz = e.z1 - e.z0; e.l2 = e.dx * e.dx + e.dz * e.dz || 1;
      gridAdd(levelGrid, e.x0 - e.hw, e.z0 - e.hw, e.x1 + e.hw, e.z1 + e.hw, e);
    }
    // terrain: river trench under a bridge, cutting at a tunnel's mouths
    const chans = [];
    if (r.k === 'b' && r.rv) {
      const depth = r.dep || 5, bed = (r.y0 + r.y1) / 2 - SLAB - depth;
      if (!r.rf) r.rv = r.rv.map(v => densify(v, 8));   // (the bake cuts the lines into pieces and measures the floor under each vertex: rf)
      r.rv.forEach((rv, li) => chans.push(makeChannel(r.id, rv, r.rw, bed, null, Infinity, 'river', r, r.rf ? r.rf[li] : null)));
      st.bed = Math.min(...chans.map(c => c.bedY[c.si]));
    } else if (r.k === 't' && (st.cut = cutPath(st))) for (const q of st.cut.quads) { st.carve = true; gridAdd(cutGrid, q.bx0, q.bz0, q.bx1, q.bz1, q); }   // the open cutting at its mouths, walled
    if (r.k === 'b' && r.ov && r.ud && r.oc && r.ud.length === r.oc.length) for (const u of r.ud) chans.push(makeChannel(r.id, u.p, u.w, 0, null, Infinity, 'dip', r, u.f, u));
    st.chans = chans;
    for (const c of chans) { st.carve = true; gridAdd(chanGrid, c.bx0, c.bz0, c.bx1, c.bz1, c); }
    fresh.push(st);
  }
  for (const st of fresh) addWalls(st);   // after every deck of the tile is a level, so that a parapet can tell when it stands in another deck's lane
  byTile.set(key, mine);
}

export const tileCarved = key => { const m = byTile.get(key); if (!m) return 0; let r = 0; for (const id of m) { const st = S.get(id); if (st && st.carve) r = Math.max(r, st.rec.k === 't' ? 2 : 1); } return r; };   // 0 none, 1 river trench (5 m cells), 2 tunnel cutting (2.5 m cells)   // the terrain mesh of this tile needs fine cells

export function unregisterStructs(key) {
  const mine = byTile.get(key); if (!mine) return;
  byTile.delete(key);
  for (const id of mine) {
    const st = S.get(id); if (!st) continue;
    st.tiles.delete(key);
    if (st.tiles.size) continue;
    S.delete(id); gridDel(levelGrid, id); gridDel(chanGrid, id); gridDel(cutGrid, id);
    if (walls) walls.removeTile('s' + id);
    disposeMeshes(st);
  }
}

// ---------- the terrain trench ----------
function makeChannel(id, flat, width, bed, st, thr, kind, rec, rf, dip) {
  const n = flat.length / 2, cum = new Float32Array(n), bedY = new Float32Array(n), bedOld = new Float32Array(n);
  for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + hh(flat[2 * k] - flat[2 * k - 2], flat[2 * k + 1] - flat[2 * k - 1]);
  const hw = kind === 'river' ? width / 2 + 1.2 : kind === 'dip' ? width / 2 + 2.5 : width / 2 + 0.6;
  let sc = 0;
  if (kind === 'dip') {   // the lower road under a flyover: the baked ground under every vertex, minus DIP where the road is under the deck and a little beyond it
    const half = rec.w / 2 + DIP_FLAT;
    for (let k = 0; k < n; k++) { const t = Math.max(0, Math.abs(cum[k] - dip.c) - half) / DIP_RAMP, f = Math.max(0, 1 - t); bedY[k] = rf[k] - DIP * f * f * (3 - 2 * f); bedOld[k] = bedY[k]; }
  }
  if (kind === 'river') { // the crossing: where the river line passes the deck centreline
    let best = 1e9; const rp = rec.p;
    for (let k = 0; k < n; k++) { const dd = distSegs(rp, flat[2 * k], flat[2 * k + 1]); if (dd < best) { best = dd; sc = cum[k]; } }
    // bed: dug RIVER_DIG under the floor of the ground as it is (the DEM has its own valley since t8, and the river runs along its bottom), and never
    // above the old rule: DEP under the deck at the crossing, shallowing out slowly and closing at the ends of the window (where the ground is a plain
    // or a lidar DTM that lost the valley under the deck, this is what makes the trench)
    for (let k = 0; k < n; k++) {
      const d = Math.abs(cum[k] - sc), a = flat[2 * Math.max(0, k - 1)], b = flat[2 * Math.min(n - 1, k + 1)], c = flat[2 * Math.max(0, k - 1) + 1], e = flat[2 * Math.min(n - 1, k + 1) + 1];
      const l = hh(b - a, e - c) || 1, nx = -(e - c) / l, nz = (b - a) / l, x = flat[2 * k], z = flat[2 * k + 1], o = Math.max(2, width / 2);
      const floor = rf ? rf[k] : Math.min(...[rawGround(x, z), rawGround(x + nx * o, z + nz * o), rawGround(x - nx * o, z - nz * o)].filter(v => v !== undefined));   // no ground yet at all: Infinity, and the old rule below takes over
      bedOld[k] = bed + Math.max(0, d - 30) * 0.05 + Math.max(0, d - 150) * 0.3;
      bedY[k] = Math.min(floor - RIVER_DIG, bedOld[k]);
    }
  }
  const m = hw + 30;
  let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
  for (let k = 0; k < n; k++) { bx0 = Math.min(bx0, flat[2 * k]); bx1 = Math.max(bx1, flat[2 * k]); bz0 = Math.min(bz0, flat[2 * k + 1]); bz1 = Math.max(bz1, flat[2 * k + 1]); }
  let si = 0; if (kind === 'river') for (let k = 0; k < n; k++) if (Math.abs(cum[k] - sc) < Math.abs(cum[si] - sc)) si = k;
  return { id, kind, pts: flat, n, cum, bedY, bedOld, hw, thr, st, bx0: bx0 - m, bz0: bz0 - m, bx1: bx1 + m, bz1: bz1 + m, sc, si };
}
function distSegs(flat, x, z) {
  let best = 1e9;
  for (let k = 0; k + 3 < flat.length; k += 2) {
    const ax = flat[k], az = flat[k + 1], dx = flat[k + 2] - ax, dz = flat[k + 3] - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, hh(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
// nearest point of a channel's line: [distance, bed height there]
function nearest(c, x, z) {
  let best = 1e9, bh = 0;
  for (let k = 0; k + 1 < c.n; k++) {
    const ax = c.pts[2 * k], az = c.pts[2 * k + 1], dx = c.pts[2 * k + 2] - ax, dz = c.pts[2 * k + 3] - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = Math.sqrt(ex * ex + ez * ez);   // (no Math.hypot: this runs for every terrain sample near a river trench or a flyover)
    if (d < best) { best = d; bh = c.bedY[k] + (c.bedY[k + 1] - c.bedY[k]) * t; }
  }
  c.d = best; return bh;
}
// noCut: leave the tunnels' open cuttings out (the terrain mesh of a full detail tile, which is cut away there instead: src/world.js)
export function carve(x, z, y, noCut) {
  const cell = ck(Math.floor(x / CELL), Math.floor(z / CELL));
  const a = chanGrid.size ? chanGrid.get(cell) : null;
  if (a) for (const c of a) {
    if (x < c.bx0 || x > c.bx1 || z < c.bz0 || z > c.bz1) continue;
    const bh = nearest(c, x, z), w = Math.max(0, c.d - c.hw) * 0.9;
    if (bh + w < y) y = bh + w;
  }
  const q = !noCut && cutGrid.size ? cutGrid.get(cell) : null;
  if (q) for (const c of q) {   // a tunnel's open cutting: the floor within its walls, the ground untouched outside them
    if (x < c.bx0 || x > c.bx1 || z < c.bz0 || z > c.bz1 || !inQuad(c, x, z)) continue;
    const f = quadFloor(c, x, z); if (f < y) y = f;
  }
  return y;
}

// ---------- the level the car stands on ----------
// yRef: where the car is now (its ball height); the answer is the highest deck or tunnel floor not more than a step above it, or NaN.
export function levelY(x, z, yRef) {
  if (levelGrid.size === 0) return NaN;
  const a = levelGrid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return NaN;
  let best = NaN;
  for (const e of a) {
    const t = ((x - e.x0) * e.dx + (z - e.z0) * e.dz) / e.l2;
    if (t < -0.002 || t > 1.002) continue;
    const px = e.x0 + e.dx * t, pz = e.z0 + e.dz * t;
    if (hh(x - px, z - pz) > e.hw) continue;
    const y = e.y0 + (e.y1 - e.y0) * Math.max(0, Math.min(1, t));
    if (e.tun && yRef > y + TUN_H && yRef < 1e8) continue;   // a car above the tunnel's ceiling is on the road over it (every car driving over a covered tunnel fell to its floor); topY (1e9) still gets the floor
    if (y <= yRef + 1.2 && !(y <= best)) best = y;
  }
  return best;
}
// the highest deck at a point whatever the caller's height (traffic on a bridge road)
export const topY = (x, z) => levelY(x, z, 1e9);

// ---------- walls (parapets, tunnel lining) ----------
// is (x, z) inside the lane of another deck within 2.6 m of the height y (the level tolerance of a parapet, src/vehicle-sphere.js)?
function inOtherLane(id, x, z, y) {
  const a = levelGrid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return false;
  for (const e of a) {
    if (e.id === id) continue;
    const t = Math.max(0, Math.min(1, ((x - e.x0) * e.dx + (z - e.z0) * e.dz) / e.l2));
    if (hh(x - e.x0 - e.dx * t, z - e.z0 - e.dz * t) < e.hw - 0.3 && Math.abs(e.y0 + (e.y1 - e.y0) * t - y) < 2.6) return true;
  }
  return false;
}
function addWalls(st) {
  if (!walls) return;
  const r = st.rec, p = r.p, n = p.length / 2, off = r.w / 2 - PARAPET_W * 0.5, jump = r.k === 'b' && LANDMARK_ZONES.some(z => z.jump && z.structs.includes(r.id));
  for (let k = 0; k + 1 < n; k++) {
    if (r.ov && Math.min(st.cum[k], st.L - st.cum[k + 1]) < END_OPEN) {   // where a flyover starts, the deck is still on the ground and roads join it from the side (the ring of Piazza Einstein): a wall there closes the junction, so no wall until the deck is a metre up
      const m = (st.cum[k] + st.cum[k + 1]) / 2; if ((st.ys[k] + st.ys[k + 1]) / 2 - (r.y0 + (r.y1 - r.y0) * m / st.L) < END_OPEN_RISE) continue;
    }
    const dx = p[2 * k + 2] - p[2 * k], dz = p[2 * k + 3] - p[2 * k + 1], l = hh(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const sg of [1, -1]) {
      const a = [p[2 * k] + nx * off * sg, p[2 * k + 1] + nz * off * sg, p[2 * k + 2] + nx * off * sg, p[2 * k + 3] + nz * off * sg];
      a.lv = (st.ys[k] + st.ys[k + 1]) / 2; if (jump) a.jump = true;
      if (inOtherLane(r.id, (a[0] + a[2]) / 2, (a[1] + a[3]) / 2, a.lv)) continue;   // where two ramps merge or part, one's parapet would stand across the other's lane
      walls.addSeg('s' + r.id, a, a[0], a[1], a[2], a[3]);
    }
  }
}

// ---------- meshes ----------
const CONC = new THREE.Color('#b4afa3'), CONC2 = new THREE.Color('#9d988c'), PAVE = new THREE.Color('#c4c1b6'), DARK = new THREE.Color('#58564f');
let matConc = null, matAsph = null, matWater = null, matBed = null;
function mats() {
  if (matConc) return;
  matConc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  matAsph = new THREE.MeshStandardMaterial({ map: TEX.asphalt, vertexColors: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  matWater = new THREE.MeshStandardMaterial({ color: '#4c7c78', roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.82 });
  matBed = new THREE.MeshStandardMaterial({ color: '#7a7260', roughness: 1 });
}
function quad(b, a, bb, c, d, nx, ny, nz, col, uv = null, k = 1) { // a b c d counter-clockwise seen from the normal side
  const u = uv || [0, 0, 1, 0, 1, 1, 0, 1];
  b.v(a[0], a[1], a[2], nx, ny, nz, col, u[0], u[1], k); b.v(bb[0], bb[1], bb[2], nx, ny, nz, col, u[2], u[3], k); b.v(c[0], c[1], c[2], nx, ny, nz, col, u[4], u[5], k);
  b.v(a[0], a[1], a[2], nx, ny, nz, col, u[0], u[1], k); b.v(c[0], c[1], c[2], nx, ny, nz, col, u[4], u[5], k); b.v(d[0], d[1], d[2], nx, ny, nz, col, u[6], u[7], k);
}

function buildDeck(st) {
  const r = st.rec, g = new THREE.Group(); g.name = 'struct_' + r.id;
  const p = r.p, n = p.length / 2, ys = st.ys, cw = r.f ? 0 : r.cw, ph = cw / 2 + (r.f ? 0 : SIDEWALK), po = r.w / 2;
  const conc = new Buf(), asph = new Buf(), M = TEX.asphalt.metres;
  const T = [], N = [];
  for (let k = 0; k < n; k++) { // tangent and left normal per vertex (mitred)
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
    let dx = p[2 * b] - p[2 * a], dz = p[2 * b + 1] - p[2 * a + 1]; const l = hh(dx, dz) || 1; dx /= l; dz /= l;
    T.push([dx, dz]); N.push([-dz, dx]);
  }
  const at = (k, off, y) => [p[2 * k] + N[k][0] * off, y, p[2 * k + 1] + N[k][1] * off];
  for (let k = 0; k + 1 < n; k++) {
    const y0 = ys[k], y1 = ys[k + 1], seg = hh(p[2 * k + 2] - p[2 * k], p[2 * k + 3] - p[2 * k + 1]);
    const A = (off, dy0, dy1 = dy0) => [at(k, off, y0 + dy0), at(k + 1, off, y1 + dy1)];
    const strip = (o0, o1, dy, col, up = true, buf = conc, uvm = 4) => { // horizontal strip between lateral offsets
      const [a0, a1] = A(o0, dy), [b0, b1] = A(o1, dy);
      const v0 = st.cum[k] / uvm, v1 = st.cum[k + 1] / uvm;
      if (up) quad(buf, a0, b0, b1, a1, 0, 1, 0, col, [o0 / uvm, v0, o0 / uvm, v1, o1 / uvm, v1, o1 / uvm, v0]);
      else quad(buf, a0, a1, b1, b0, 0, -1, 0, col);
    };
    const wall = (off, dy0, dy1, col, outward) => { // vertical face at lateral offset, normal outward (+1 left, -1 right) or inward
      const [t0, t1] = A(off, dy0), [h0, h1] = A(off, dy1), s = Math.sign(off) * outward;
      const nx = N[k][0] * s, nz = N[k][1] * s;
      if (s > 0) quad(conc, t0, t1, h1, h0, nx, 0, nz, col, null, 0.92); else quad(conc, t1, t0, h0, h1, nx, 0, nz, col, null, 0.92);
    };
    if (!r.f) {
      strip(-cw / 2, cw / 2, 0, new THREE.Color(1, 1, 1), true, asph, M);
      for (const sg of [1, -1]) {
        wall(sg * cw / 2, 0, KERB, PAVE, -1);                               // kerb face towards the road
        sg > 0 ? strip(cw / 2, ph, KERB, PAVE) : strip(-ph, -cw / 2, KERB, PAVE);
        wall(sg * ph, KERB, KERB + PARAPET_H, CONC, -1);                    // parapet inner face
        sg > 0 ? strip(ph, po, KERB + PARAPET_H, CONC2) : strip(-po, -ph, KERB + PARAPET_H, CONC2);   // cap
        wall(sg * po, -SLAB, KERB + PARAPET_H, CONC, 1);                    // outer face down to the underside of the slab
      }
    } else {
      strip(-po + PARAPET_W, po - PARAPET_W, 0, PAVE);
      for (const sg of [1, -1]) {
        wall(sg * (po - PARAPET_W), 0, PARAPET_H, CONC, -1);
        sg > 0 ? strip(po - PARAPET_W, po, PARAPET_H, CONC2) : strip(-po, -po + PARAPET_W, PARAPET_H, CONC2);
        wall(sg * po, -SLAB * 0.6, PARAPET_H, CONC, 1);
      }
    }
    strip(-po, po, -SLAB, CONC2, false);                                       // underside
    if (seg > 14 && !r.f) { // lane paint: edge lines, and a dashed centre line on two-way decks
      const ln = new THREE.Color('#d9d6cb');
      for (const off of [-cw / 2 + 0.25, cw / 2 - 0.25]) {
        const [a0, a1] = A(off - 0.07, 0.012), [b0, b1] = A(off + 0.07, 0.012);
        quad(asph, a0, b0, b1, a1, 0, 1, 0, ln, [0, 0, 0, 0, 0, 0, 0, 0], 1);
      }
      if (!r.ow && cw >= 6) for (let s = 1; s + 3 < seg; s += 8) {
        const t0 = s / seg, t1 = (s + 3) / seg, lerp = (a, b, t) => a + (b - a) * t;
        const px = o => at(k, o, 0), qx = o => at(k + 1, o, 0);
        const pt = (o, t) => { const a = px(o), b = qx(o); return [lerp(a[0], b[0], t), lerp(y0, y1, t) + 0.014, lerp(a[2], b[2], t)]; };
        quad(asph, pt(-0.08, t0), pt(0.08, t0), pt(0.08, t1), pt(-0.08, t1), 0, 1, 0, ln, [0, 0, 0, 0, 0, 0, 0, 0], 1);
      }
    }
  }
  // ends: the slab's cross-section and the abutment walls down to the ground, and the ends of the pavements and parapets. Only the parapets rise above the road: a face
  // across the whole width up to the parapet top stood 1.15 m above the deck where the road runs on, and from the approach every bridge read as a grey wall with the
  // lane paint showing through it (Via Palmerino, b81531217, viewpoint su17)
  for (const end of [0, n - 1]) {
    const k = end, y = ys[k];
    const gy = Math.min(rawGround(p[2 * k], p[2 * k + 1]), y) - 0.5;
    const face = (o0, o1, ya, yb) => { // both sides: seen from the approach and, for the parapet ends, from the deck
      const L = at(k, o0, 0), Rr = at(k, o1, 0), s = Math.sign(o0 - o1), fx = T[k][0] * s, fz = T[k][1] * s;   // (the first winding faces along the tangent when o0 > o1)
      quad(conc, [L[0], ya, L[2]], [Rr[0], ya, Rr[2]], [Rr[0], yb, Rr[2]], [L[0], yb, L[2]], fx, 0, fz, CONC, null, 0.85);
      quad(conc, [Rr[0], ya, Rr[2]], [L[0], ya, L[2]], [L[0], yb, L[2]], [Rr[0], yb, Rr[2]], -fx, 0, -fz, CONC, null, 0.85);
    };
    face(po, -po, gy, y);   // the slab and the abutment from the deck down to below the ground (hidden inside the embankment)
    if (!r.f) for (const sg of [1, -1]) {
      face(sg * po, sg * cw / 2, y, y + KERB);                    // pavement
      face(sg * po, sg * ph, y + KERB, y + KERB + PARAPET_H);     // parapet
    } else for (const sg of [1, -1]) face(sg * po, sg * (po - PARAPET_W), y, y + PARAPET_H);
  }
  // piers
  if (r.k === 'b' && !r.f && st.L > 40 && (!r.ov || r.oc)) {
    const bed = r.rv && st.bed !== undefined ? st.bed : null, np = Math.max(1, Math.round(st.L / 30)) ;
    for (let i = 1; i < np + 0; i++) {
      const s = st.L * i / np, k = (() => { let q = 1; while (q < n - 1 && st.cum[q] < s) q++; return q; })();
      const t = (s - st.cum[k - 1]) / ((st.cum[k] - st.cum[k - 1]) || 1), x = p[2 * k - 2] + (p[2 * k] - p[2 * k - 2]) * t, z = p[2 * k - 1] + (p[2 * k + 1] - p[2 * k - 1]) * t;
      const top = yAt(st, s) - SLAB, bot = bed !== null ? bed - 0.3 : rawGround(x, z) - 0.3;
      if (top - bot < 1.5) continue;
      if (r.oc && r.oc.some(c => Math.abs(s - c) < PLATEAU + 6)) continue;   // a pier never stands on the road that passes under a flyover
      const tx = T[k][0], tz = T[k][1], nx = -tz, nz = tx, hl = 0.8, hn = po - 0.8;
      const c = (a, b) => [x + tx * a + nx * b, 0, z + tz * a + nz * b];
      const crn = [c(-hl, -hn), c(hl, -hn), c(hl, hn), c(-hl, hn)];
      for (let q = 0; q < 4; q++) {
        const a = crn[q], b = crn[(q + 1) % 4], ex = b[0] - a[0], ez = b[2] - a[2], l = hh(ex, ez), pnx = ez / l, pnz = -ex / l;
        quad(conc, [a[0], bot, a[2]], [b[0], bot, b[2]], [b[0], top, b[2]], [a[0], top, a[2]], pnx, 0, pnz, CONC2, null, 0.9);
      }
    }
  }
  mats();
  const mc = conc.mesh(matConc), ma = asph.mesh(matAsph);
  mc.castShadow = true; mc.receiveShadow = true; ma.receiveShadow = true;
  g.add(mc, ma);
  // the river: a bed strip and the water, under the deck
  if (r.rv) {
    const water = new Buf(), bedb = new Buf();
    for (const rv of r.rv) {
      const m = rv.length / 2;
      for (let k = 0; k + 1 < m; k++) {
        const ax = rv[2 * k], az = rv[2 * k + 1], bx = rv[2 * k + 2], bz = rv[2 * k + 3], l = hh(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l;
        const ca = chanBed(st, rv, k), cb = chanBed(st, rv, k + 1), hw = r.rw * 0.4;
        if (waterHangs(ax, az, ca) || waterHangs(bx, bz, cb)) continue;   // past the end of the trench the water would hang in the air
        const w = new THREE.Color(1, 1, 1);
        quad(water, [ax + nx * hw, ca + WATER_UP, az + nz * hw], [bx + nx * hw, cb + WATER_UP, bz + nz * hw], [bx - nx * hw, cb + WATER_UP, bz - nz * hw], [ax - nx * hw, ca + WATER_UP, az - nz * hw], 0, 1, 0, w, [0, 0, 1, 0, 1, 1, 0, 1]);
        const hb = r.rw / 2 + 1.0;
        quad(bedb, [ax + nx * hb, ca + 0.04, az + nz * hb], [bx + nx * hb, cb + 0.04, bz + nz * hb], [bx - nx * hb, cb + 0.04, bz - nz * hb], [ax - nx * hb, ca + 0.04, az - nz * hb], 0, 1, 0, w);
      }
    }
    const mw = water.mesh(matWater), mb = bedb.mesh(matBed); mw.renderOrder = 2; mb.receiveShadow = true;
    g.add(mb, mw);
  }
  return g;
}
let matTun = null, matLamp = null;
function buildTunnel(st) {
  const r = st.rec, g = new THREE.Group(); g.name = 'struct_' + r.id;
  const { Q, seg, hw, W } = st.cut, m = Q.length, buf = new Buf(), road = new Buf(), lamps = new Buf(), M = TEX.asphalt.metres;
  const white = new THREE.Color(1, 1, 1), wallC = new THREE.Color('#b5b0a2'), band = new THREE.Color('#8d897d'), ceil = new THREE.Color('#7e7a70'), lampC = new THREE.Color('#ffe2a8');
  const A = (q, o, y) => [q.x + q.nx * o, y, q.z + q.nz * o];
  const rawAt = (x, z, q) => { const v = rawGround(x, z); return v === undefined ? q.g : v; };   // (a tile not loaded yet: the baked ground)
  const flat = (b, a0, a1, b1, b0, col) => quad(b, a0, a1, b1, b0, 0, 1, 0, col, [a0[0] / M, a0[2] / M, a1[0] / M, a1[2] / M, b1[0] / M, b1[2] / M, b0[0] / M, b0[2] / M]);   // (world uvs: two floors that overlap match)
  // the top of the wall on side sg at vertex q: the ground just outside it, plus the parapet
  const topAt = (q, sg) => { const x = q.x + q.nx * sg * (W + 0.3), z = q.z + q.nz * sg * (W + 0.3), t = rawAt(x, z, q); return [t + parOf(t - q.f), t]; };
  let nextLamp = 6;
  for (let k = 0; k + 1 < m; k++) {
    const a = Q[k], b = Q[k + 1], s = seg[k];
    if (a.t && b.t) flat(road, A(a, -hw, a.f + 0.01), A(a, hw, a.f + 0.01), A(b, hw, b.f + 0.01), A(b, -hw, b.f + 0.01), white);   // the tunnel's road, covered or open
    else if (s === 1) for (const [o0, o1] of [[-hw, 0], [0, hw]]) {   // the floor of a ramp's cutting, under the street layers (carved ground: what the car drives on)
      const y = (q, o) => { const x = q.x + q.nx * o, z = q.z + q.nz * o; return carve(x, z, rawAt(x, z, q)) - 0.02; };
      flat(road, A(a, o0, y(a, o0)), A(a, o1, y(a, o1)), A(b, o1, y(b, o1)), A(b, o0, y(b, o0)), white);
    }
    if (s === 2) {   // covered: lining, ceiling, lamps
      for (const sg of [1, -1]) {
        const o = hw * sg;
        quad(buf, A(a, o, a.f), A(b, o, b.f), A(b, o, b.f + TUN_H), A(a, o, a.f + TUN_H), -a.nx * sg, 0, -a.nz * sg, wallC, null, 0.95);
        quad(buf, A(a, o, a.f + 0.9), A(b, o, b.f + 0.9), A(b, o, b.f + 1.15), A(a, o, a.f + 1.15), -a.nx * sg, 0, -a.nz * sg, band, null, 0.9);
      }
      quad(buf, A(a, -hw, a.f + TUN_H), A(a, hw, a.f + TUN_H), A(b, hw, b.f + TUN_H), A(b, -hw, b.f + TUN_H), 0, -1, 0, ceil, null, 0.8);
      while (nextLamp < a.s) nextLamp += 12;
      for (; nextLamp <= b.s; nextLamp += 12) {   // lamps every 12 m, two rows
        const t = (nextLamp - a.s) / ((b.s - a.s) || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.f + (b.f - a.f) * t + TUN_H - 0.05, tx = a.nz, tz = -a.nx;
        for (const o of [-hw * 0.45, hw * 0.45]) {
          const c = (a2, b2) => [x + a.nx * (o + a2) + tx * b2, y, z + a.nz * (o + a2) + tz * b2];
          quad(lamps, c(-0.25, -0.5), c(0.25, -0.5), c(0.25, 0.5), c(-0.25, 0.5), 0, -1, 0, lampC, null, 1);
        }
      }
    } else if (s === 0 && a.t && b.t) for (const sg of [1, -1]) {   // the tunnel's line at or over the ground: a low wall, where its lining stops a car
      const o = hw * sg; quad(buf, A(a, o, a.f - 0.3), A(b, o, b.f - 0.3), A(b, o, b.f + 0.6), A(a, o, a.f + 0.6), -a.nx * sg, 0, -a.nz * sg, wallC, null, 0.95);
    } else if (s === 1) for (const sg of [1, -1]) {   // open cutting: a retaining wall each side, its coping a parapet over the ground beside it
      const mx = (a.x + b.x) / 2 + (a.nx + b.nx) / 2 * sg * hw, mz = (a.z + b.z) / 2 + (a.nz + b.nz) / 2 * sg * hw;
      if (inOtherCut(r.id, mx, mz)) continue;   // inside the next carriageway's cutting
      const [ta, ga] = topAt(a, sg), [tb, gb] = topAt(b, sg), o = hw * sg, O = W * sg, nx = a.nx * sg, nz = a.nz * sg;
      const p0 = A(a, o, a.f - 0.3), p1 = A(b, o, b.f - 0.3), p2 = A(b, o, tb), p3 = A(a, o, ta), kb = 0.72, kt = 1;   // darker at the foot (grime off the road)
      for (const [q, k] of [[p0, kb], [p1, kb], [p2, kt], [p0, kb], [p2, kt], [p3, kt]]) buf.v(q[0], q[1], q[2], -nx, 0, -nz, wallC, 0, 0, k);
      quad(buf, A(a, o, ta), A(b, o, tb), A(b, O, tb), A(a, O, ta), 0, 1, 0, CONC2, null, 1);
      quad(buf, A(a, O, ga - 0.6), A(b, O, gb - 0.6), A(b, O, tb), A(a, O, ta), nx, 0, nz, wallC, null, 0.9);
    }
  }
  // the ends of the walls where a cutting runs out at the ground
  for (let k = 0; k < m; k++) {
    const before = k > 0 ? seg[k - 1] : -1, after = k + 1 < m ? seg[k] : -1;
    if ((before === 1) === (after === 1) || before === 2 || after === 2) continue;
    const q = Q[k], tx = q.nz, tz = -q.nx;
    for (const sg of [1, -1]) {
      const [t] = topAt(q, sg);
      quad(buf, A(q, hw * sg, q.f - 0.3), A(q, W * sg, q.f - 0.3), A(q, W * sg, t), A(q, hw * sg, t), before === 1 ? tx : -tx, 0, before === 1 ? tz : -tz, wallC, null, 0.9);
    }
  }
  // portals: where the cutting meets the covered tunnel, two piers and a lintel, and over them a concrete headwall up to the ground and its parapet
  for (let k = 0; k < m; k++) {
    const before = k > 0 ? seg[k - 1] : -1, after = k + 1 < m ? seg[k] : -1;
    if ((before === 2) === (after === 2)) continue;
    const q = Q[k], nb = after === 2 ? 1 : -1, fx = q.nz * nb, fz = -q.nx * nb;   // from the portal into the tunnel
    const c = (o, y, d) => [q.x + q.nx * o + fx * d, y, q.z + q.nz * o + fz * d];
    const box = (x0, x1, y0, y1) => { // a slab across the width between lateral offsets x0..x1 and heights y0..y1, 0.9 m deep
      quad(buf, c(x0, y0, 0), c(x1, y0, 0), c(x1, y1, 0), c(x0, y1, 0), -fx, 0, -fz, band, null, 1);
      quad(buf, c(x0, y1, 0), c(x1, y1, 0), c(x1, y1, 0.9), c(x0, y1, 0.9), 0, 1, 0, band, null, 1);
    };
    const yl = q.f + TUN_H, yh = yl + 1.1;
    box(-W, -hw + 0.1, q.f, yh); box(hw - 0.1, W, q.f, yh);   // piers
    box(-W, W, yl, yh);                                        // lintel
    const N = 4, os = [], ts = [], gs = [];
    for (let i = 0; i <= N; i++) { const o = -W + 2 * W * i / N, p = c(o, 0, 0.5), t = rawAt(p[0], p[2], q); os.push(o); gs.push(t); ts.push(Math.max(yh, t + CUT_PAR)); }
    for (let i = 0; i < N; i++) {
      const o0 = os[i], o1 = os[i + 1], mid = c((o0 + o1) / 2, 0, 0.45);
      if (ts[i] <= yh + 0.01 && ts[i + 1] <= yh + 0.01) continue;
      if (inOtherCut(r.id, mid[0], mid[2])) continue;
      quad(buf, c(o0, yh, 0), c(o1, yh, 0), c(o1, ts[i + 1], 0), c(o0, ts[i], 0), -fx, 0, -fz, CONC, null, 0.95);            // face
      quad(buf, c(o0, ts[i], 0), c(o1, ts[i + 1], 0), c(o1, ts[i + 1], 0.9), c(o0, ts[i], 0.9), 0, 1, 0, CONC2, null, 1);       // coping
      quad(buf, c(o0, Math.min(yh, gs[i] - 0.6), 0.9), c(o1, Math.min(yh, gs[i + 1] - 0.6), 0.9), c(o1, ts[i + 1], 0.9), c(o0, ts[i], 0.9), fx, 0, fz, CONC, null, 0.9);   // back (its parapet shows from above)
    }
    for (const [i, sg] of [[0, -1], [N, 1]]) quad(buf, c(os[i], gs[i] - 0.6, 0), c(os[i], gs[i] - 0.6, 0.9), c(os[i], ts[i], 0.9), c(os[i], ts[i], 0), q.nx * sg, 0, q.nz * sg, CONC, null, 0.9);   // its ends
  }
  if (!matLamp) matLamp = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  if (!matTun) matTun = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  mats();
  const mt = buf.mesh(matTun), mr = road.mesh(matAsph); mt.castShadow = true; mt.receiveShadow = true; mr.receiveShadow = true;
  g.add(mt, mr);
  if (lamps.p.length) g.add(lamps.mesh(matLamp));
  return g;
}

const WATER_UP = 0.4;
const waterHangs = (x, z, bedY) => !(rawGround(x, z) >= bedY + 0.15);   // the ground is not above the bed here: the river is not dug into anything
function chanBed(st, rv, k) {
  const c = (st.chans || []).find(q => q.pts === rv); return c ? c.bedY[k] : 0;
}

function disposeMeshes(st) {
  if (!st.meshes) return;
  st.meshes.parent && st.meshes.parent.remove(st.meshes);
  st.meshes.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  st.meshes = null;
}

let root = null;
export function setStructRoot(r) { root = r; }
// the ground is undefined where a near tile is still loading, and every mesh below reads it (abutments, piers, tunnel roofs): a struct that is built over
// such a point gets NaN vertices (three.js then warns "Computed radius is NaN"). It waits until its whole line has ground; its other tiles call onTileFull too.
const groundReady = st => { const p = st.rec.p; for (let k = 0; k < p.length; k += 2) if (rawGround(p[k], p[k + 1]) === undefined) return false; return true; };
export function onTileFull(key) {
  const mine = byTile.get(key); if (!mine || !root) return;
  for (const id of mine) {
    const st = S.get(id); if (!st) continue;
    st.full.add(key);
    if (!st.meshes && (st.cut || groundReady(st))) { try { st.meshes = st.rec.k === 'b' ? buildDeck(st) : st.cut ? buildTunnel(st) : null; if (st.meshes) root.add(st.meshes); } catch (e) { console.error('[bridges]', id, e); } }   // (a tunnel reads its cutting from the bake, and the baked ground where a tile is not loaded)
  }
}
export function onTileDrop(key) {
  const mine = byTile.get(key); if (!mine) return;
  for (const id of mine) { const st = S.get(id); if (!st) continue; st.full.delete(key); if (!st.full.size) disposeMeshes(st); }
}

// ---------- falling off a jump bridge ----------
const track = { zone: null, on: 0, y: 0, fired: false };
export function carTick(car, ball) { // called by the sphere model every step with the ball state
  const deck = car.deck || 0;
  if (deck > 2) { // on a deck: which one?
    for (const z of LANDMARK_ZONES) for (const id of z.structs) { const st = S.get(id); if (!st) continue; const y = levelY(car.x, car.z, ball.y + 0.5); if (y === y && Math.abs(y - ball.y) < 1.5 && distSegs(st.rec.p, car.x, car.z) < st.rec.w) { track.zone = z; track.y = y; track.on = performance.now(); track.fired = false; } }
  }
  if (track.zone && !track.fired) {
    const now = performance.now();
    if (ball.air && track.y - ball.y >= track.zone.minFall && now - track.on < 6000) {
      track.fired = true;
      const detail = { id: track.zone.id, label: track.zone.label, x: car.x, z: car.z, y: ball.y, fall: track.y - ball.y };
      window.dispatchEvent(new CustomEvent('pd-landmark', { detail }));
      for (const fn of listeners) { try { fn(detail); } catch (e) { console.error(e); } }
    } else if (now - track.on > 6000) track.zone = null;
  }
}

export const structStats = () => ({ n: S.size, levels: levelGrid.size, chans: chanGrid.size });
export const dbgStruct = id => S.get(id);

// debug: per loaded river bridge, how many of its water segments near the deck would be drawn (rule 'new' = this file, 'old' = before t8)
export const waterReport = rule => { const out = []; for (const [id, st] of S) { if (!st.chans || !st.rec.rv) continue; let n = 0, tot = 0; for (const c of st.chans) for (let k = 0; k + 1 < c.n; k++) { const mx = (c.pts[2 * k] + c.pts[2 * k + 2]) / 2, mz = (c.pts[2 * k + 1] + c.pts[2 * k + 3]) / 2; if (distSegs(st.rec.p, mx, mz) > 25) continue; tot++; const hang = rule === 'old' ? (rawGround(c.pts[2 * k], c.pts[2 * k + 1]) < c.bedOld[k] + 1.2 || rawGround(c.pts[2 * k + 2], c.pts[2 * k + 3]) < c.bedOld[k + 1] + 1.2) : (waterHangs(c.pts[2 * k], c.pts[2 * k + 1], c.bedY[k]) || waterHangs(c.pts[2 * k + 2], c.pts[2 * k + 3], c.bedY[k + 1])); if (!hang) n++; } out.push({ id, n, tot }); } return out; };
