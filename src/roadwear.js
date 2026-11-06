// Road wear: potholes, repair trenches and patches, cracks, sunken manholes, worn zebra paint and tyre marks on the asphalt.
// Owned by the road-wear work.
//
// Per world tile (src/world.js): when a tile reaches full detail (world.onTile 'full') its wear is generated from the tile's own
// roads (centrelines resampled every metre), an exact 1 m raster of its streets.asphalt (core.js rasterMask) and its props
// (zebra crossings), with random numbers seeded from the tile id and the road, so the same hole is always in the same place. The
// work is a generator stepped a couple of milliseconds per frame, nearest tile first; when the tile drops from full detail
// ('drop') everything it made (cells, meshes, collision records) is disposed. Features never cross a tile border (each tile only
// sees its own asphalt), which keeps the result independent of the order tiles load in.
// Density follows the district (districts.js zoneAt): worse in Brancaccio, ZEN, Borgo Vecchio and Albergheria, better on Via Liberta. Each road also has
// a condition of its own (some streets are simply kept up), and the fast roads (expressway.js isFastRoad) are almost clean.
// Shapes: a hole is a ragged star shaped outline (per vertex radius and angle, a bite now and then), never a regular polygon, mostly small; a repair is a
// ribbon that follows the road (a long utility trench, a strip along the kerb, a cut across) or a small ragged blob, with edges that wander; a crack runs
// along the road and drifts across it.
// The decals are streamed in 100 m cells around the camera (one cell = a few merged meshes), so a battered city only ever has a
// few tens of thousands of wear triangles resident.
//   - wear mesh per cell: opaque, vertex coloured, world-space grain texture, sits 4 cm over the road (polygonOffset)
//   - water mesh per cell: glossy puddles that mirror the sky gradient (only for the wet holes)
//   - marks mesh per cell: old black skid marks, alpha blended
// Holes are fake-3D: crumbled lip, dark wall whose normals tilt towards the hole so the low sun lights one side and
// shades the other, dark floor shaded by the sun side. No geometry goes below the road, so nothing z-fights.
// Physics: collidePlayer() tests the lapa's wheels against the drawn outlines of the holes and calls vehicle.bump() plus a little
// speed loss, yaw kick, forced two-wheel lean and loss of grip. Dynamic tyre marks come from car.skid (vehicle.js) and work anywhere.
import * as THREE from 'three';
import { pairs, rng, rasterMaskIter } from './core.js';
import { zoneAt } from './districts.js';
import { isFastRoad } from './expressway.js';
const hyp2 = (a, b) => Math.sqrt(a * a + b * b); // [perf pass] Math.hypot boxes a heap number per call; this runs thousands of times per frame

const MINHIT = 0.11;   // holes smaller than this are only drawn: a wheel does not feel a hole under a hand's width
const TAU = Math.PI * 2, CELL = 100, TS = 500, LIFT = 0.04, UVM = 2.2, MARK_LIFT = 0.041;
const SUNH = [-0.924, 0.381];   // horizontal direction towards the sun (WSW), as set in main.js
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const hash = (a, b, c = 0) => {
  let h = Math.imul(Math.round(a * 100) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.round(b * 100) + c, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
};
const hf = (a, b, c = 0) => hash(a, b, c) / 4294967296;
const C = h => new THREE.Color(h);

// colours (hex, converted to linear by THREE.Color)
const COL = {
  crumbOut: [C('#8f8c84'), C('#85827b'), C('#96928a')], crumbIn: C('#6c6964'),   // holes read as shallow worn asphalt: base-course grey, not black pits
  rim: C('#55524d'), wall: C('#494743'), floor: C('#54514c'), centre: C('#4e4b46'),
  patchDark: [C('#6f7272'), C('#727575'), C('#6b6e6e')], patchLight: [C('#7e8180'), C('#838685')], seam: C('#676969'),   // repairs sit a few per cent off the asphalt, not a different material (the grain map warms whatever it covers, so these are a shade cool)
  crack: C('#57544f'), worn: C('#7b7a74'), mhFrame: C('#55514b'), mhCover: [C('#6a645b'), C('#5d5851')], mhGap: C('#232220'),
  water: C('#5d6165'),
};
// per class, per metre of centreline: holes, repair patches (trenches, kerb strips, cuts, blobs), cracks, manholes
const DENS = {
  primary: [0.032, 0.006, 0.02, 0.02], secondary: [0.048, 0.009, 0.024, 0.02], tertiary: [0.08, 0.0135, 0.03, 0.03],
  unclassified: [0.095, 0.015, 0.034, 0.02], residential: [0.135, 0.021, 0.044, 0.03], service: [0.11, 0.015, 0.04, 0.015],
  living_street: [0.11, 0.018, 0.034, 0.02], pedestrian: [0.055, 0.0075, 0.025, 0.01],
};
const FAST = 0.12;   // wear multiplier on the fast roads: kept up, nearly clean
const MARKETS = [[-60, 410, 110], [260, -220, 110], [-390, -245, 90]];   // Ballaro, Vucciria, Capo
// how much the district neglects its asphalt (multiplies every density); anything not listed is 1
const ZW = { brancaccio: 1.65, zen: 1.7, borgoV: 1.5, alberg: 1.5, kalsa: 1.2, oreto: 1.25, corsoMille: 1.2, zisa: 1.15, cep: 1.2, noce: 1.1,
  viaLib: 0.4, politeama: 0.7, sacco: 0.8, mondello: 0.7, lido: 0.7, valdesi: 0.75, favorita: 0.8 };

// ---------- mesh builder: indexed, vertex coloured, optional alpha ----------
class Mb {
  constructor(alpha) { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; this.nv = 0; this.alpha = alpha; }
  v(x, y, z, nx, ny, nz, c, k = 1, a = 1) {
    this.p.push(x, y, z);
    const l = Math.hypot(nx, ny, nz) || 1; this.n.push(nx / l, ny / l, nz / l);
    if (this.alpha) this.c.push(c.r * k, c.g * k, c.b * k, a); else this.c.push(c.r * k, c.g * k, c.b * k);
    this.uv.push(x / UVM, z / UVM);
    return this.nv++;
  }
  t(a, b, c) { this.i.push(a, b, c); }
  get tris() { return this.i.length / 3; }
  mesh(mat) {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, this.alpha ? 4 : 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}

export function createRoadWear(env) {
  const { scene, camera, car, groundY, vehicle, world } = env;
  const T0 = performance.now();
  const gy = (x, z) => groundY(x, z) + LIFT;

  // ---------- helpers ----------
  const NL = 70;   // smooth 0..1 value noise on a 70 m lattice (hash based, so it covers the whole city): some streets are simply worse
  const vnoise = (x, z) => {
    const fx = x / NL, fz = z / NL, ix = Math.floor(fx), iz = Math.floor(fz);
    let tx = fx - ix, tz = fz - iz; tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
    const a = hf(ix, iz, 5), b = hf(ix + 1, iz, 5), c = hf(ix, iz + 1, 5), d = hf(ix + 1, iz + 1, 5);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  const neglect = (x, z) => {
    let m = 0.75 + 1.1 * vnoise(x, z) ** 1.3;
    for (const [mx, mz, mr] of MARKETS) { const dx = x - mx, dz = z - mz; if (dx * dx + dz * dz < 9 * mr * mr) { const d2 = (dx * dx + dz * dz) / (mr * mr); m *= 1 + 1.6 * Math.exp(-d2); } }
    return m;
  };
  const zoneMul = (x, z, name) => ZW[zoneAt(x, z, name, 0)] || 1;

  // ---------- storage: one record per full-detail tile ----------
  const live = new Map();    // tile key -> W { t, cells: Map, recs, ready, dead }
  const pending = [];        // tiles waiting for their wear to be generated
  const stats = { tiles: 0, holes: 0, water: 0, big: 0, clusters: 0, patches: 0, trenches: 0, strips: 0, cuts: 0, blobs: 0, cracks: 0, manholes: 0, sunken: 0, marks: 0, crossings: 0, junctions: 0, genMs: 0, genTiles: 0, genMax: 0 };

  const cg = new Map(), CGS = 6;   // collision grid of holes and sunken manholes (all tiles)
  const cgKey = rec => Math.floor(rec.x / CGS) * 8192 + Math.floor(rec.z / CGS);
  const cgAdd = (W, rec) => { const k = cgKey(rec); let a = cg.get(k); if (!a) cg.set(k, a = []); a.push(rec); W.recs.push(rec); };
  const cgRemove = rec => { const k = cgKey(rec), a = cg.get(k); if (!a) return; const i = a.indexOf(rec); if (i >= 0) a.splice(i, 1); if (!a.length) cg.delete(k); };

  // ---------- one tile: scatter features along its roads ----------
  function* genTile(W) {
    const t = W.t, data = t.data, st = data.streets || {}, tx0 = t.i * TS, tz0 = t.j * TS;
    const seedT = hash(t.i, t.j, 77);
    const aoi = [tx0, tz0, tx0 + TS, tz0 + TS];
    const asph = yield* rasterMaskIter([st.asphalt || []], aoi, 1);
    const block = yield* rasterMaskIter([st.paving || [], st.raised || [], st.green || []], aoi, 1);
    const onRoad = (x, z) => asph(x, z) && !block(x, z);
    const cellAt = (x, z) => {
      const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL), k = (ix + 4096) * 8192 + (iz + 4096);
      let c = W.cells.get(k);
      if (!c) W.cells.set(k, c = { ix, iz, x0: ix * CELL, z0: iz * CELL, holes: [], patches: [], cracks: [], mhs: [], blots: [], marks: [], polish: [], built: null });
      return c;
    };
    const HG = 3, hgrid = new Map(), hgk = (x, z) => Math.floor(x / HG) * 8192 + Math.floor(z / HG);
    const hgAdd = (x, z, r, rec) => { const k = hgk(x, z); let a = hgrid.get(k); if (!a) hgrid.set(k, a = []); a.push([x, z, r, rec]); };
    const hgNear = (x, z, r) => {   // anything (hole, manhole, patch) whose disc overlaps this disc?
      const ix = Math.floor(x / HG), iz = Math.floor(z / HG), reach = Math.ceil((r + 2.5) / HG);
      for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
        const l = hgrid.get((ix + a) * 8192 + iz + b); if (!l) continue;
        for (const o of l) if (hyp2(o[0] - x, o[1] - z) < o[2] + r) return true;
      }
      return false;
    };

    function addHole(x, z, r, rot, el, dep, water, q, hostR = null) {
      const rm = r * 1.4 * Math.max(1, el) + 0.15;
      if (!onRoad(x, z) || !onRoad(x + rm, z) || !onRoad(x - rm, z) || !onRoad(x, z + rm) || !onRoad(x, z - rm)) return null;
      if (hgNear(x, z, rm * 0.7)) return null;
      const rec = { x, z, r, rot, el, dep, water, q: r > 0.3 ? q * 0.4 : q, seed: hash(x, z, 9), kind: 0, sh: null };
      cellAt(x, z).holes.push(rec); hgAdd(x, z, rm * 0.8, rec); if (r >= MINHIT) cgAdd(W, rec);
      stats.holes++; if (water) stats.water++; if (r > 0.3) stats.big++;
      if (r > 0.3 && hostR) {   // alligator cracks radiating from the big ones
        const n = 2 + Math.floor(hostR() * 3);
        for (let i = 0; i < n; i++) {
          const a = hostR() * TAU, len = 0.8 + hostR() * 1.6, pts = [], sx = x + Math.cos(a) * r * el * 1.1, sz = z + Math.sin(a) * r * 1.1;
          let px = sx, pz = sz, h = a;
          for (let k = 0; k < 4; k++) { if (!onRoad(px, pz)) break; pts.push(px, pz, 0.02 - k * 0.004); h += (hostR() - 0.5) * 0.9; px += Math.cos(h) * len / 4; pz += Math.sin(h) * len / 4; }
          if (pts.length >= 6) { cellAt(x, z).cracks.push({ pts, q: rec.q }); stats.cracks++; }
        }
      }
      return rec;
    }
    // a ribbon of repair along the road samples: [x, z, half width left, half width right] per point, edges that wander, ends that taper; null when it does not fit on the asphalt
    const ribbon = (smp, n, i0, len, off0, wid, rag, step, R) => {
      const pts = []; let off = off0, hl = wid / 2, hr = wid / 2;
      for (let j = 0, k = i0; j <= len && k < n; j += step, k += step) {
        const tx = smp[k * 4 + 2], tz = smp[k * 4 + 3], nx = -tz, nz = tx;
        off += (R() - 0.5) * 0.05 * step;
        hl = clamp(hl + (R() - 0.5) * rag * step, wid * 0.3, wid * 0.75); hr = clamp(hr + (R() - 0.5) * rag * step, wid * 0.3, wid * 0.75);
        const cx = smp[k * 4] + nx * off, cz = smp[k * 4 + 1] + nz * off;
        if (!onRoad(cx, cz) || !onRoad(cx + nx * (hl + 0.15), cz + nz * (hl + 0.15)) || !onRoad(cx - nx * (hr + 0.15), cz - nz * (hr + 0.15)) || hgNear(cx, cz, 0.1)) break;
        pts.push(cx, cz, hl, hr);
      }
      return pts.length >= 12 ? pts : null;
    };
    const addRibbon = (pts, kind, R) => {
      const rec = { pts, blob: null, light: R() < 0.25, v: Math.floor(R() * 3), q: R(), seed: hash(pts[0], pts[1], 3) };
      cellAt(pts[0], pts[1]).patches.push(rec); stats.patches++; stats[kind]++;
      for (let i = 0; i < pts.length; i += 4) hgAdd(pts[i], pts[i + 1], Math.max(pts[i + 2], pts[i + 3]) + 0.3, rec);
    };
    // a small ragged repair: 7 to 9 corners, each at its own radius
    const addBlob = (px, pz, rot, ax, az, R) => {
      const rr = Math.max(ax, az) * 1.25 + 0.15;
      for (const [u, v] of [[0, 0], [rr, 0], [-rr, 0], [0, rr], [0, -rr]]) if (!onRoad(px + u, pz + v) || hgNear(px + u, pz + v, 0.1)) return;
      const m = 7 + Math.floor(R() * 3), k = []; for (let i = 0; i < m; i++) k.push(0.7 + 0.55 * R());
      const rec = { x: px, z: pz, blob: { rot, ax, az, k }, pts: null, light: R() < 0.25, v: Math.floor(R() * 3), q: R(), seed: hash(px, pz, 3) };
      cellAt(px, pz).patches.push(rec); stats.patches++; stats.blobs++; hgAdd(px, pz, Math.max(ax, az) * 1.1 + 0.2, rec);
    };
    // a crack that follows the road: [x, z, width] per point, drifting across the lane, thinning out; null when too short
    const crackAlong = (smp, n, i0, len, off0, w0, R, hw) => {
      const pts = []; let off = off0, w = w0;
      for (let j = 0, k = i0; j <= len && k < n; ) {
        const st = R() < 0.35 ? 2 : 1, nx = -smp[k * 4 + 3], nz = smp[k * 4 + 2];
        off = clamp(off + (R() - 0.5) * 0.22 * st, -hw, hw);
        const x = smp[k * 4] + nx * (off + (R() - 0.5) * 0.06), z = smp[k * 4 + 1] + nz * (off + (R() - 0.5) * 0.06);
        if (!onRoad(x, z)) break;
        pts.push(x, z, w); w = Math.max(0.01, w * (0.975 + R() * 0.02));
        j += st; k += st;
      }
      return pts.length >= 9 ? pts : null;
    };

    // ---- roads: resample every metre and scatter features
    const roadList = [];
    const SX = [], SZ = [], STX = [], STZ = [];   // resampled samples for the nearest-road lookup of the crossings
    const sgrid = new Map(), SGC = 16;
    let work = 0;
    for (const r of data.roads || []) {
      const rk = r.k.endsWith('_link') ? r.k.slice(0, -5) : r.k, dens = DENS[rk]; if (!dens) continue;
      const P = pairs(r.p); if (P.length < 2) continue;
      const R = rng(hash(P[0][0], P[0][1], P.length) ^ seedT);
      const hw = (r.w || 4) / 2 * 0.9, narrow = r.w < 5 ? 1.2 : 1;
      const fast = isFastRoad(r), fm = fast ? FAST : 1, cond = 0.35 + 1.55 * hf(P[0][0], P[0][1], P.length) ** 1.5;   // cond: this road's own upkeep, 0.35 (kept up) to 1.9 (neglected), 1 on average
      const smp = [];   // x, z, tx, tz
      let next = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1], L = hyp2(bx - ax, bz - az); if (L < 1e-3) continue;
        const tx = (bx - ax) / L, tz = (bz - az) / L;
        let s = next;
        for (; s < L; s += 1) smp.push(ax + tx * s, az + tz * s, tx, tz);
        next = s - L;
      }
      const n = smp.length / 4; if (n < 2) continue;
      roadList.push({ smp, w: r.w || 4, k: rk, n });
      let zf = 1;
      for (let i = 0; i < n; i++) {
        const x = smp[i * 4], z = smp[i * 4 + 1], tx = smp[i * 4 + 2], tz = smp[i * 4 + 3];
        const gk = Math.floor(x / SGC) * 8192 + Math.floor(z / SGC); let ga = sgrid.get(gk); if (!ga) sgrid.set(gk, ga = []); ga.push(SX.length);
        SX.push(x); SZ.push(z); STX.push(tx); STZ.push(tz);
        if (i % 30 === 0) zf = zoneMul(x, z, r.n);
        const ng = neglect(x, z) * narrow * zf * cond, eg = ng ** 1.3, nx = -tz, nzz = tx;
        const lat = () => R() < 0.4 ? (R() < 0.5 ? 1 : -1) * hw * (0.35 + R() * 0.3) : (R() * 2 - 1) * hw;
        // potholes: mostly small, a big one is rare
        if (R() < Math.min(0.4, dens[0] * eg * fm)) {
          const u = R(); let rad;
          if (u < 0.55) rad = 0.06 + R() * 0.08; else if (u < 0.85) rad = 0.12 + R() * 0.12; else if (u < 0.97) rad = 0.22 + R() * 0.16; else rad = 0.34 + R() * 0.2;
          const off = lat(), px = x + nx * off, pz = z + nzz * off;
          const el = rad > 0.3 ? 1 + R() * 0.6 : 1 + R() * 0.35, rot = Math.atan2(tz, tx) + (R() - 0.5) * 0.8;
          const dep = 0.02 + 0.16 * Math.min(1, rad / 0.5) * (0.6 + 0.4 * R());
          const water = rad >= 0.18 ? R() < 0.2 : R() < 0.02;
          const main = addHole(px, pz, rad, rot, el, dep, water, R(), R);
          if (main && !fast && rad >= 0.12 && R() < 0.07) {   // a cluster of smaller ones around it
            stats.clusters++;
            const m = 3 + Math.floor(R() * 3);
            for (let k = 0; k < m; k++) {
              const a = R() * TAU, d = 0.4 + R() * 1.8, rr = 0.05 + R() * 0.12;
              addHole(px + Math.cos(a) * d, pz + Math.sin(a) * d, rr, R() * TAU, 1 + R() * 0.3, 0.02 + R() * 0.06, R() < 0.08, main.q + R() * 0.15);
            }
          }
        }
        // repairs: long utility trenches along the road, strips along the kerb, narrow cuts across, small ragged patches
        if (R() < dens[1] * eg * fm) {
          const kind = R(), ang = Math.atan2(tz, tx);
          if (kind < 0.34) {   // a trench: long and thin, a little off the centre or in a wheel track
            const len = 4 + 30 * R() ** 1.7, off = (R() < 0.5 ? (R() < 0.5 ? 1 : -1) * (0.15 + 0.3 * R()) : (R() * 2 - 1) * 0.8) * hw;
            const pts = ribbon(smp, n, i, len, off, 0.35 + 0.55 * R(), 0.14, 2, R); if (pts) addRibbon(pts, 'trenches', R);
          } else if (kind < 0.58) {   // a strip along the kerb, ragged on the road side
            const len = 3 + 14 * R() ** 1.5, side = R() < 0.5 ? 1 : -1, wid = 0.4 + 0.6 * R();
            const pts = ribbon(smp, n, i, len, side * (hw - wid / 2) * (0.92 + 0.08 * R()), wid, 0.3, 2, R); if (pts) addRibbon(pts, 'strips', R);
          } else if (kind < 0.66) {   // a cut across the road for a pipe
            const wid = 0.3 + 0.25 * R(), a = ang + Math.PI / 2 + (R() - 0.5) * 0.3, c = Math.cos(a), s = Math.sin(a), pts = [];
            for (let u = -hw; u <= hw + 0.01; u += 2) {
              const px = x + c * u, pz = z + s * u, hh = wid / 2 * (0.8 + 0.4 * R());
              if (!onRoad(px, pz) || hgNear(px, pz, 0.1)) { pts.length = 0; break; }
              pts.push(px, pz, hh, hh);
            }
            if (pts.length >= 12) addRibbon(pts, 'cuts', R);
          } else addBlob(x + nx * lat(), z + nzz * lat(), ang + (R() - 0.5) * 0.5, 0.4 + 1.0 * R() ** 1.5, 0.3 + 0.6 * R(), R);
        }
        // cracks: long ones follow the road, short ones cross it
        if (R() < dens[2] * ng * Math.sqrt(fm)) {
          const w0 = 0.014 + R() * 0.012;
          if (R() < 0.7) {
            const pts = crackAlong(smp, n, i, 5 + 22 * R() ** 1.4, (R() * 2 - 1) * hw, w0, R, hw);
            if (pts) { cellAt(pts[0], pts[1]).cracks.push({ pts, q: R() }); stats.cracks++; }
          } else {
            const px0 = x + nx * (R() * 2 - 1) * hw, pz0 = z + nzz * (R() * 2 - 1) * hw, pts = []; let px = px0, pz = pz0, h = Math.atan2(tz, tx) + Math.PI / 2 + (R() - 0.5) * 1.0, w = w0;
            for (let d = 0, len = 1 + R() * 4; d <= len; d += 0.7) {
              if (!onRoad(px, pz)) break;
              pts.push(px, pz, w); w = Math.max(0.008, w * 0.96); h += (R() - 0.5) * 0.45; px += Math.cos(h) * 0.7; pz += Math.sin(h) * 0.7;
            }
            if (pts.length >= 9) { cellAt(px0, pz0).cracks.push({ pts, q: R() }); stats.cracks++; }
          }
        }
        // manholes and drain grates
        if (R() < dens[3] * ng * 0.8) {
          const off = (R() < 0.5 ? (R() * 2 - 1) * hw * 0.7 : (R() < 0.5 ? 1 : -1) * hw * 0.9), px = x + nx * off, pz = z + nzz * off;
          const grate = R() < 0.35, rad = grate ? 0.5 : 0.27 + R() * 0.07;
          if (onRoad(px, pz) && onRoad(px + nx * 0.4, pz + nzz * 0.4) && onRoad(px - nx * 0.4, pz - nzz * 0.4) && !hgNear(px, pz, rad + 0.2)) {
            const sunk = !grate && R() < 0.4, rot = Math.atan2(tz, tx), q = R();
            const rec = { x: px, z: pz, r: rad, rot, grate, sunk, dep: sunk ? 0.04 + R() * 0.07 : 0, q, seed: hash(px, pz, 4), kind: 1, el: 1 };
            cellAt(px, pz).mhs.push(rec); hgAdd(px, pz, rad + 0.1, rec); stats.manholes++;
            if (sunk) { cgAdd(W, rec); stats.sunken++; }
          }
        }
      }
      work += n;
      if (work > 700) { work = 0; yield; if (W.dead) return; }
    }
    yield; if (W.dead) return;
    const sNear = (x, z, r) => {   // nearest resampled road sample within r
      let best = -1, bd = r * r;
      const ix = Math.floor(x / SGC), iz = Math.floor(z / SGC), reach = Math.ceil(r / SGC);
      for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
        const l = sgrid.get((ix + a) * 8192 + iz + b); if (!l) continue;
        for (const i of l) { const d = (SX[i] - x) ** 2 + (SZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
      return best;
    };

    // ---- tyre marks baked on the road: before zebra crossings, at junctions and in bends ----
    // A mark is a pair of tracks; each track is a list of x, z, alpha. 'brake' fades in and stops dead, 'arc' is a bell.
    function addMarks(path, kind, R, track = 1.35, w = 0.17) {
      // path: [x, z, ...] centreline at about 0.6 m spacing. Cut at the first point off the asphalt.
      const n = path.length / 2; if (n < 6) return;
      const q = R();
      for (const side of [-0.5, 0.5]) {
        const pts = []; let wob = R() * 6, ok = 0;
        for (let i = 0; i < n; i++) {
          const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
          let dx = path[j1 * 2] - path[j0 * 2], dz = path[j1 * 2 + 1] - path[j0 * 2 + 1]; const l = hyp2(dx, dz) || 1; dx /= l; dz /= l;
          wob += 0.35;
          const o = side * track + Math.sin(wob) * 0.04, x = path[i * 2] - dz * o, z = path[i * 2 + 1] + dx * o;
          if (!onRoad(x, z) || env.raisedMask(x, z)) break;
          const u = i / (n - 1);
          let a = kind === 'brake' ? Math.min(1, u * 3) * (0.4 + 0.2 * Math.sin(u * 9 + wob)) : Math.sin(u * Math.PI) ** 0.7 * 0.5;
          a *= 0.8 + 0.2 * Math.sin(i * 1.7 + side * 4);
          pts.push(x, z, a); ok++;
        }
        if (ok >= 5) { cellAt(pts[0], pts[1]).marks.push({ pts, q, w: w * (0.85 + R() * 0.3) }); stats.marks++; }
      }
    }
    const line = (x0, z0, x1, z1, step = 0.6) => {
      const L = hyp2(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / step)), out = [];
      for (let i = 0; i <= n; i++) out.push(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
      return out;
    };
    const bez = (p0, p1, p2, step = 0.6) => {
      const L = hyp2(p1[0] - p0[0], p1[1] - p0[1]) + hyp2(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(4, Math.round(L / step)), out = [];
      for (let i = 0; i <= n; i++) { const tt = i / n, a = (1 - tt) * (1 - tt), b = 2 * tt * (1 - tt), c = tt * tt; out.push(a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]); }
      return out;
    };
    {   // zebra crossings: worn paint, polished tracks, late braking
      const R = rng(77123 ^ seedT), done = [];
      for (const it of (data.props && data.props.items) || []) {
        if (it.k !== 'crossing' || it.cr === 'unmarked' || it.den === 'unmarked') continue;
        if (done.some(d => hyp2(d[0] - it.x, d[1] - it.z) < 10)) continue;
        const si = sNear(it.x, it.z, 5); if (si < 0) continue;
        const tx = STX[si], tz = STZ[si], nx = -tz, nzz = tx;
        // nearest point on the centreline (project the node on the sample's tangent)
        const s = (it.x - SX[si]) * tx + (it.z - SZ[si]) * tz, cx = SX[si] + tx * s, cz = SZ[si] + tz * s;
        if (!onRoad(cx, cz)) continue;
        const march = (dx, dz) => { let d = 0; while (d < 9 && onRoad(cx + dx * (d + 0.25), cz + dz * (d + 0.25))) d += 0.25; return d; };
        const e1 = march(nx, nzz), e2 = march(-nx, -nzz);
        if (e1 + e2 < 4.5 || e1 + e2 > 16) continue;
        done.push([it.x, it.z]); stats.crossings++;
        const cell = cellAt(cx, cz);
        const stripes = Math.max(1, Math.round((e1 + e2 - 0.9) / 0.95)), nb = Math.min(36, stripes * 3 + 2);
        for (let b = 0; b < nb; b++) {
          const k = Math.floor(R() * stripes), u = -e2 + 0.45 + k * 0.95 + (R() - 0.5) * 0.3, v = (R() - 0.5) * 3.0;
          cell.blots.push({ x: cx + nx * u + tx * v, z: cz + nzz * u + tz * v, ax: 0.2 + R() * 0.55, az: 0.1 + R() * 0.2, rot: Math.atan2(tz, tx), seed: (R() * 1e9) | 0, q: R() });
        }
        for (const o of [(e1 - e2) / 2 - 1.5, (e1 - e2) / 2 + 1.5]) cell.polish.push({ pts: line(cx + nx * o - tx * 1.9, cz + nzz * o - tz * 1.9, cx + nx * o + tx * 1.9, cz + nzz * o + tz * 1.9, 0.95), w: 0.28, a: 0.1 + R() * 0.08, q: R() });
        // black skid marks leading up to the stripes on either approach: everyone brakes late in Palermo
        for (const dir of [1, -1]) {
          if (R() > 0.35) continue;
          const off = dir > 0 ? e1 * 0.5 : -e2 * 0.5, len = 4 + R() * 9, d0 = 1.9 + R() * 1.4;
          const lat = off + (R() - 0.5) * (Math.abs(off) * 0.6);
          addMarks(line(cx + nx * lat - tx * dir * (d0 + len), cz + nzz * lat - tz * dir * (d0 + len), cx + nx * (lat + (R() - 0.5) * 0.5) - tx * dir * d0, cz + nzz * (lat + (R() - 0.5) * 0.5) - tz * dir * d0), 'brake', R);
        }
      }
    }
    yield; if (W.dead) return;
    {   // junctions: late braking on the arms, and the odd swerve through the middle
      const R = rng(4421 ^ seedT), jm = new Map(), key = (x, z) => Math.round(x * 5) * 100003 + Math.round(z * 5);
      for (const r of data.roads || []) {
        const rk = r.k.endsWith('_link') ? r.k.slice(0, -5) : r.k;
        if (!DENS[rk] || rk === 'pedestrian') continue;
        const P = pairs(r.p);
        for (let i = 0; i < P.length; i++) {
          const arms = [];
          for (const dir of [-1, 1]) {
            let j = i + dir;
            while (j >= 0 && j < P.length && hyp2(P[j][0] - P[i][0], P[j][1] - P[i][1]) < 4) j += dir;
            if (j >= 0 && j < P.length) { const L = hyp2(P[j][0] - P[i][0], P[j][1] - P[i][1]); arms.push([(P[j][0] - P[i][0]) / L, (P[j][1] - P[i][1]) / L, r.w || 4, rk]); }
          }
          if (!arms.length) continue;
          const k = key(P[i][0], P[i][1]); let e = jm.get(k); if (!e) jm.set(k, e = { x: P[i][0], z: P[i][1], arms: [] });
          e.arms.push(...arms);
        }
      }
      for (const j of jm.values()) {
        if (j.arms.length < 3) continue;
        stats.junctions++;
        const arms = j.arms, minor = arms.some(a => a[3] === 'primary' || a[3] === 'secondary' || a[3] === 'tertiary') ? 0.25 : 0.15;
        for (const a of arms) {
          if (R() > minor) continue;
          const ax = a[0], az = a[1], w = a[2], fx = -ax, fz = -az, rx = -fz, rz = fx, lat = w / 4 + (R() - 0.5) * 0.5;   // travelling towards the junction, in the right-hand lane
          const d0 = 3 + R() * 2, len = 4 + R() * 8;
          addMarks(line(j.x + ax * (d0 + len) + rx * lat, j.z + az * (d0 + len) + rz * lat, j.x + ax * d0 + rx * lat, j.z + az * d0 + rz * lat), 'brake', R);
        }
        if (R() < 0.12) {   // a swerving turn through the junction
          const a = arms[Math.floor(R() * arms.length)], b = arms[Math.floor(R() * arms.length)];
          if (a !== b && Math.abs(a[0] * b[0] + a[1] * b[1]) < 0.9) {
            const la = a[2] / 4, lb = b[2] / 4, arx = a[1], arz = -a[0], brx = -b[1], brz = b[0];
            addMarks(bez([j.x + a[0] * 9 + arx * la, j.z + a[1] * 9 + arz * la], [j.x + (R() - 0.5), j.z + (R() - 0.5)], [j.x + b[0] * 9 + brx * lb, j.z + b[1] * 9 + brz * lb]), 'arc', R);
          }
        }
      }
    }
    yield; if (W.dead) return;
    {   // bends: a track along the outside of the curve
      const R = rng(9981 ^ seedT);
      for (const rd of roadList) {
        if (rd.k === 'pedestrian' || rd.k === 'service') continue;
        const { smp, n, w } = rd; let skip = 0;
        for (let i = 8; i < n - 8; i++) {
          if (--skip > 0) continue;
          const a0 = Math.atan2(smp[(i - 6) * 4 + 3], smp[(i - 6) * 4 + 2]), a1 = Math.atan2(smp[(i + 6) * 4 + 3], smp[(i + 6) * 4 + 2]);
          let da = a1 - a0; da -= TAU * Math.round(da / TAU);
          if (Math.abs(da) < 0.5 || R() > 0.15) continue;
          skip = 40;
          const path = [], sgn = da > 0 ? 1 : -1, lane = (w / 4) * (R() < 0.5 ? 1 : -1) + sgn * 0.3;
          for (let k = i - 7; k <= i + 8; k++) { const tx = smp[k * 4 + 2], tz = smp[k * 4 + 3]; path.push(smp[k * 4] - tz * lane, smp[k * 4 + 1] + tx * lane); }
          addMarks(path, 'arc', R);
        }
      }
    }
    stats.genTiles++;
  }

  // ---------- cell meshes ----------
  const grain = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), R = rng(31337);
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2400; i++) { const v = 205 + Math.floor(R() * 50); g.fillStyle = `rgb(${v},${v},${v - 3})`; const s = 1 + R() * 2; g.fillRect(R() * 128, R() * 128, s, s); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const po = (f, u) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: u });
  const wearMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.92, metalness: 0, ...po(-4, -8) });
  const waterMat = new THREE.MeshStandardMaterial({ color: COL.water, roughness: 0.12, metalness: 0.4, envMapIntensity: 0.6, ...po(-5, -10) });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0, ...po(-6, -12) });

  const TRI_CAP = 140000;   // resident wear triangles never go past this, whatever the density
  const QF = { low: 0.35, medium: 0.7, high: 1 }, RAD = { low: 110, medium: 160, high: 210 };
  let qf = 1, rad = 210, qname = 'high';
  const mix = (a, b, t) => new THREE.Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

  // The outline of a hole: a star shaped polygon in the hole's own frame (angle and radius per corner, from its seed), shared by the drawing and by the
  // wheel test, so a wheel feels what is drawn. Corner angles are unevenly spaced and the radii wander (two low lobes, jitter, now and then a bite), so no
  // hole reads as a regular hexagon. a[i] ascends from a[0] over one turn; k[i] is the radius as a multiple of h.r.
  function shapeOf(h) {
    if (h.sh) return h.sh;
    const R = rng(h.seed ^ 0x51ed), n = h.r < 0.15 ? 6 : h.r < 0.3 ? 9 : 12, a = new Float32Array(n), k = new Float32Array(n), cs = new Float32Array(n), sn = new Float32Array(n), gap = [];
    let acc = 0; for (let i = 0; i < n; i++) { gap.push(0.55 + 0.9 * R()); acc += gap[i]; }
    const p1 = R() * TAU, p2 = R() * TAU, A1 = 0.1 + 0.2 * R(), A2 = 0.06 + 0.12 * R();
    let t = R() * TAU;
    for (let i = 0; i < n; i++) {
      a[i] = t; t += TAU * gap[i] / acc;
      k[i] = 1 + A1 * Math.cos(a[i] - p1) + A2 * Math.cos(2 * a[i] - p2) + (R() - 0.5) * 0.45;
    }
    if (R() < 0.35) k[Math.floor(R() * n)] *= 0.6;   // a bite
    for (let i = 0; i < n; i++) { k[i] = clamp(k[i], 0.5, 1.4); cs[i] = Math.cos(a[i]); sn[i] = Math.sin(a[i]); }
    return h.sh = { n, a, k, cs, sn };
  }
  function inHole(h, x, z, pad) {   // is the point inside the drawn outline, grown by pad metres
    const dx = x - h.x, dz = z - h.z, rm = h.r * 1.4 * Math.max(1, h.el) + pad; if (dx * dx + dz * dz > rm * rm) return false;
    const c = Math.cos(h.rot), s = Math.sin(h.rot), px = (dx * c + dz * s) / h.el, pz = -dx * s + dz * c, sh = shapeOf(h), n = sh.n, a0 = sh.a[0];
    let da = Math.atan2(pz, px) - a0; da -= TAU * Math.floor(da / TAU);
    let i = n - 1; for (let j = 1; j < n; j++) if (sh.a[j] - a0 > da) { i = j - 1; break; }
    const j = (i + 1) % n, ri = sh.k[i] * h.r + pad, rj = sh.k[j] * h.r + pad, ax = sh.cs[i] * ri, az = sh.sn[i] * ri;
    return (sh.cs[j] * rj - ax) * (pz - az) - (sh.sn[j] * rj - az) * (px - ax) >= 0;   // left of the edge i to j: inside
  }

  function buildHole(B, W, h) {
    const R = rng(h.seed), sh = shapeOf(h), n = sh.n, cr = Math.cos(h.rot), sr = Math.sin(h.rot), full = h.r >= 0.15, wc0 = 0.02 + 0.14 * h.r;
    const X = [], Z = [], OX = [], OZ = [];
    for (let i = 0; i < n; i++) {
      const lx = sh.cs[i] * sh.k[i] * h.r * h.el, lz = sh.sn[i] * sh.k[i] * h.r, wx = lx * cr - lz * sr, wz = lx * sr + lz * cr, ol = hyp2(wx, wz) || 1;
      X.push(h.x + wx); Z.push(h.z + wz); OX.push(wx / ol); OZ.push(wz / ol);
    }
    const pt = (px, pz, nx, ny, nz, c, k) => B.v(px, gy(px, pz), pz, nx, ny, nz, c, k);
    if (!full) {   // a speck: the lip fades into a dark middle
      const ring = []; for (let i = 0; i < n; i++) ring.push(pt(X[i], Z[i], 0, 1, 0, COL.crumbIn, 0.92 + 0.16 * R()));
      const cc = pt(h.x, h.z, 0, 1, 0, COL.floor, 1);
      for (let i = 0; i < n; i++) B.t(ring[i], cc, ring[(i + 1) % n]);
      if (h.water) { const wat = []; for (let i = 0; i < n; i++) wat.push(W.v(h.x + (X[i] - h.x) * 0.9, gy(X[i], Z[i]) + 0.004, h.z + (Z[i] - h.z) * 0.9, 0, 1, 0, COL.water, 1)); const wc = W.v(h.x, gy(h.x, h.z) + 0.004, h.z, 0, 1, 0, COL.water, 1); for (let i = 0; i < n; i++) W.t(wat[i], wc, wat[(i + 1) % n]); }
      return;
    }
    const C0 = [], C1 = [], R1 = [], R2 = [], F2 = [], wat = [], mx = h.x + (R() - 0.5) * h.r * 0.3, mz = h.z + (R() - 0.5) * h.r * 0.3;   // the floor's middle sits a little off the outline's middle
    for (let i = 0; i < n; i++) {
      const sf = OX[i] * SUNH[0] + OZ[i] * SUNH[1];   // sf +1: on the sunward (west) side
      const wcw = wc0 * (0.4 + 1.5 * R()), f = 0.55 + 0.25 * R(), p2x = mx + (X[i] - mx) * f, p2z = mz + (Z[i] - mz) * f;
      C0.push(pt(X[i] + OX[i] * wcw, Z[i] + OZ[i] * wcw, OX[i] * 0.2, 1, OZ[i] * 0.2, COL.crumbOut[i % 3], 0.88 + 0.2 * R()));
      C1.push(pt(X[i], Z[i], OX[i] * 0.5, 1, OZ[i] * 0.5, COL.crumbIn, 0.9 + 0.2 * R()));
      const lit = 1 - 0.3 * sf;
      R1.push(pt(X[i], Z[i], -OX[i] * 0.9, 1, -OZ[i] * 0.9, COL.rim, lit));
      R2.push(pt(p2x, p2z, -OX[i] * 0.9, 1, -OZ[i] * 0.9, COL.wall, lit * 0.9));
      F2.push(pt(p2x, p2z, 0, 1, 0, COL.floor, 1 - 0.4 * sf));
      if (h.water) wat.push(W.v(mx + (X[i] - mx) * 0.93 * f, gy(X[i], Z[i]) + 0.004, mz + (Z[i] - mz) * 0.93 * f, 0, 1, 0, COL.water, 1));
    }
    const cc = pt(mx, mz, 0, 1, 0, COL.centre, 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      B.t(C0[i], C1[j], C0[j]); B.t(C0[i], C1[i], C1[j]);
      B.t(R1[i], R2[j], R1[j]); B.t(R1[i], R2[i], R2[j]);
      B.t(F2[i], cc, F2[j]);
    }
    if (h.water) {
      const wc = W.v(mx, gy(mx, mz) + 0.004, mz, 0, 1, 0, COL.water, 1);
      for (let i = 0; i < n; i++) W.t(wat[i], wc, wat[(i + 1) % n]);
    }
  }

  function ribbonMesh(B, pts, grow, c0, c1, y, R, taper) {   // [x, z, half width left, half width right] points: quads along the polyline, colour c0 to c1 along it, grow widens both edges
    const n = pts.length / 4, ids = [];
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      let dx = pts[j1 * 4] - pts[j0 * 4], dz = pts[j1 * 4 + 1] - pts[j0 * 4 + 1]; const l = hyp2(dx, dz) || 1; dx /= l; dz /= l;
      const e = i === 0 || i === n - 1 ? taper : 1, hl = pts[i * 4 + 2] * e + grow, hr = pts[i * 4 + 3] * e + grow, x = pts[i * 4], z = pts[i * 4 + 1], c = n > 1 ? mix(c0, c1, i / (n - 1)) : c0;
      ids.push(B.v(x - dz * hl, gy(x - dz * hl, z + dx * hl) + y, z + dx * hl, 0, 1, 0, c, 0.95 + 0.1 * R()), B.v(x + dz * hr, gy(x + dz * hr, z - dx * hr) + y, z - dx * hr, 0, 1, 0, c, 0.95 + 0.1 * R()));
    }
    for (let i = 0; i < n - 1; i++) { const a = ids[i * 2], b = ids[i * 2 + 1], c = ids[i * 2 + 2], d = ids[i * 2 + 3]; B.t(a, c, b); B.t(b, c, d); }
  }
  function blobMesh(B, p, grow, c, y, R) {   // a ragged patch: a fan round its middle
    const { rot, ax, az, k } = p.blob, m = k.length, cr = Math.cos(rot), sr = Math.sin(rot), ids = [];
    for (let i = 0; i < m; i++) {
      const a = TAU * i / m + (k[(i * 5) % m] - 1) * 0.3, lx = Math.cos(a) * (ax * k[i] + grow), lz = Math.sin(a) * (az * k[i] + grow), x = p.x + cr * lx - sr * lz, z = p.z + sr * lx + cr * lz;
      ids.push(B.v(x, gy(x, z) + y, z, 0, 1, 0, c, 0.95 + 0.1 * R()));
    }
    const cc = B.v(p.x, gy(p.x, p.z) + y, p.z, 0, 1, 0, c, 1);
    for (let i = 0; i < m; i++) B.t(ids[i], cc, ids[(i + 1) % m]);
  }

  function strip(B, pts, step, width, col, alphaFn) {   // ribbon along x, z[, w] triples; used for cracks, marks, polish
    const n = pts.length / step, ids = [];
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      let dx = pts[j1 * step] - pts[j0 * step], dz = pts[j1 * step + 1] - pts[j0 * step + 1]; const l = hyp2(dx, dz) || 1; dx /= l; dz /= l;
      const w = typeof width === 'function' ? width(i, pts) : width, x = pts[i * step], z = pts[i * step + 1], a = alphaFn ? alphaFn(i, pts) : 1;
      const yl = groundY(x - dz * w, z + dx * w) + (alphaFn ? MARK_LIFT : LIFT + 0.004), yr = groundY(x + dz * w, z - dx * w) + (alphaFn ? MARK_LIFT : LIFT + 0.004);
      ids.push(B.v(x - dz * w, yl, z + dx * w, 0, 1, 0, col, 1, a), B.v(x + dz * w, yr, z - dx * w, 0, 1, 0, col, 1, a));
    }
    for (let i = 0; i < n - 1; i++) { const a = ids[i * 2], b = ids[i * 2 + 1], c = ids[i * 2 + 2], d = ids[i * 2 + 3]; B.t(a, c, b); B.t(b, c, d); }
  }

  function quad(B, cx, cz, rot, hl, hw, c0, c1, jit, R, k = 1, y = 0) {   // rectangle with jittered corners, colour fades c0 -> c1 along its length
    const c = Math.cos(rot), s = Math.sin(rot), ids = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const la = a * hl + (jit ? (R() - 0.5) * jit : 0), lb = b * hw + (jit ? (R() - 0.5) * jit : 0), x = cx + c * la - s * lb, z = cz + s * la + c * lb;
      ids.push(B.v(x, gy(x, z) + y, z, 0, 1, 0, a < 0 ? c0 : c1, k));
    }
    B.t(ids[0], ids[2], ids[1]); B.t(ids[0], ids[3], ids[2]);
  }

  function buildCell(cell) {
    const B = new Mb(false), W = new Mb(false), M = new Mb(true);
    for (const h of cell.holes) if (h.q < qf) buildHole(B, W, h);
    for (const p of cell.patches) {
      if (p.q > qf) continue;
      const R = rng(p.seed), c = p.light ? COL.patchLight[p.v % 2] : COL.patchDark[p.v % 3];
      if (p.blob) { blobMesh(B, p, 0.03, COL.seam, 0, R); blobMesh(B, p, 0, c, 0.003, R); }
      else { ribbonMesh(B, p.pts, 0.03, COL.seam, COL.seam, 0, R, 0.6); ribbonMesh(B, p.pts, 0, c, mix(c, COL.worn, 0.3), 0.003, R, 0.6); }
    }
    for (const c of cell.cracks) if (c.q < qf) strip(B, c.pts, 3, (i, p) => p[i * 3 + 2] * 0.6, COL.crack);
    for (const m of cell.mhs) {
      if (m.q > qf) continue;
      const R = rng(m.seed);
      if (m.grate) {
        quad(B, m.x, m.z, m.rot, 0.46, 0.27, COL.mhGap, COL.mhGap, 0, R, 1);
        for (let b = 0; b < 4; b++) { const o = -0.34 + b * 0.227; const c = Math.cos(m.rot), s = Math.sin(m.rot); quad(B, m.x + c * o, m.z + s * o, m.rot, 0.045, 0.23, COL.mhFrame, COL.mhFrame, 0, R, 1, 0.005); }
      } else {
        const n = 8, ring = [], outer = [], inner = [];
        for (let i = 0; i < n; i++) {
          const a = TAU * i / n + 0.3, ox = Math.cos(a), oz = Math.sin(a), sf = ox * SUNH[0] + oz * SUNH[1];
          const gap = m.sunk ? 0.15 + 0.1 * m.dep * 10 : 0.07;
          outer.push(B.v(m.x + ox * m.r * (1 + gap), gy(m.x + ox * m.r * (1 + gap), m.z + oz * m.r * (1 + gap)), m.z + oz * m.r * (1 + gap), m.sunk ? -ox * 0.6 : 0, 1, m.sunk ? -oz * 0.6 : 0, COL.mhGap, 1 - (m.sunk ? 0.3 * sf : 0)));
          inner.push(B.v(m.x + ox * m.r, gy(m.x + ox * m.r, m.z + oz * m.r) + 0.004, m.z + oz * m.r, 0, 1, 0, COL.mhFrame, 1 - (m.sunk ? 0.25 * sf : 0)));
          ring.push(B.v(m.x + ox * m.r * 0.78, gy(m.x + ox * m.r * 0.78, m.z + oz * m.r * 0.78) + 0.006, m.z + oz * m.r * 0.78, 0, 1, 0, COL.mhCover[i & 1], 1 - (m.sunk ? 0.2 * sf : 0)));
        }
        const cc = B.v(m.x, gy(m.x, m.z) + 0.006, m.z, 0, 1, 0, COL.mhCover[0], 0.9);
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; B.t(outer[i], inner[j], outer[j]); B.t(outer[i], inner[i], inner[j]); B.t(inner[i], ring[j], inner[j]); B.t(inner[i], ring[i], ring[j]); B.t(ring[i], cc, ring[j]); }
      }
    }
    for (const b of cell.blots) {   // worn-away zebra paint
      if (b.q > qf) continue;
      const R = rng(b.seed), n = 6, c = Math.cos(b.rot), s = Math.sin(b.rot), ids = [], col = mix(COL.worn, COL.patchDark[0], R() * 0.3);
      for (let i = 0; i < n; i++) {
        const a = TAU * i / n + R() * 0.5, f = 0.7 + 0.5 * R(), lx = Math.cos(a) * b.ax * f, lz = Math.sin(a) * b.az * f, x = b.x + c * lx - s * lz, z = b.z + s * lx + c * lz;
        ids.push(B.v(x, gy(x, z) - 0.008, z, 0, 1, 0, col, 0.95 + 0.1 * R()));
      }
      const cc = B.v(b.x, gy(b.x, b.z) - 0.008, b.z, 0, 1, 0, col, 1);
      for (let i = 0; i < n; i++) B.t(ids[i], cc, ids[(i + 1) % n]);
    }
    for (const m of cell.marks) if (m.q < qf) strip(M, m.pts, 3, m.w * 0.5, MARK_COL, (i, p) => p[i * 3 + 2] * 0.32);   // baked skids at a third of full strength
    for (const p of cell.polish) if (p.q < qf) strip(M, p.pts, 2, p.w, MARK_COL, () => p.a * 0.7);
    const out = { meshes: [], tris: B.tris + W.tris + M.tris };
    const mw = B.mesh(wearMat), mwa = W.mesh(waterMat), mm = M.mesh(markMat);
    if (mm) mm.renderOrder = 1;
    if (mwa) mwa.renderOrder = 0;
    for (const m of [mw, mwa, mm]) if (m) { scene.add(m); out.meshes.push(m); world.freeAfterUpload(m); }   // (a lost GL context: built again, below)
    return out;
  }
  const MARK_COL = C('#1c1b1b');

  // ---------- streaming: tiles come and go with the streamer, cells with the camera ----------
  function unload(cell) {
    if (!cell.built) return;
    for (const m of cell.built.meshes) { scene.remove(m); m.geometry.dispose(); }
    totalTris -= cell.built.tris; cell.built = null;
  }
  let totalTris = 0, lastX = 1e9, lastZ = 1e9, lastHigh = false, dirty = true, queue = [], active = null;

  function onTile(kind, t) {
    if (kind === 'full') {
      if (live.has(t.k)) return;
      const W = { t, cells: new Map(), recs: [], ready: false, dead: false };
      live.set(t.k, W); pending.push(W); stats.tiles++;
    } else {
      const W = live.get(t.k); if (!W) return;
      W.dead = true; live.delete(t.k); stats.tiles--;
      const i = pending.indexOf(W); if (i >= 0) pending.splice(i, 1);
      if (active && active.W === W) active = null;
      for (const c of W.cells.values()) unload(c);
      for (const rec of W.recs) cgRemove(rec);
      W.cells.clear(); W.recs.length = 0; queue = []; dirty = true;
    }
  }
  world.onTile(onTile);   // replays 'full' for the tiles already in
  document.getElementById('view')?.addEventListener('webglcontextrestored', () => { for (const W of live.values()) for (const c of W.cells.values()) unload(c); queue = []; dirty = true; });

  function generate(ms) {   // a few ms per frame of tile generation, nearest tile first
    const t0 = performance.now(), cp = camera.position;
    while (performance.now() - t0 < ms) {
      if (!active) {
        if (!pending.length) return;
        let bi = 0, bd = 1e18;
        for (let i = 0; i < pending.length; i++) { const t = pending[i].t, dx = (t.i + 0.5) * TS - cp.x, dz = (t.j + 0.5) * TS - cp.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
        const W = pending.splice(bi, 1)[0]; active = { W, gen: genTile(W) };
      }
      const s0 = performance.now(), done = active.gen.next().done, ds = performance.now() - s0;
      stats.genMs += ds; if (ds > stats.genMax) stats.genMax = ds;   // genMax: the longest single slice
      if (done) { active.W.ready = true; active = null; dirty = true; }
    }
  }

  function stream() {
    const cp = camera.position, high = cp.y - groundY(cp.x, cp.z) > 320;   // nothing is visible from a very high flyover
    if (dirty || high !== lastHigh || (cp.x - lastX) ** 2 + (cp.z - lastZ) ** 2 > 36) {
      dirty = false; lastX = cp.x; lastZ = cp.z; lastHigh = high;
      const R = high ? -1 : rad;
      queue = [];
      for (const W of live.values()) {
        if (!W.ready) continue;
        for (const c of W.cells.values()) {
          const dx = Math.max(c.x0 - cp.x, 0, cp.x - (c.x0 + CELL)), dz = Math.max(c.z0 - cp.z, 0, cp.z - (c.z0 + CELL)), d = hyp2(dx, dz);
          c.dist = d;
          if (d <= R) { if (!c.built) queue.push(c); } else if (c.built && (R < 0 || d > R + 70)) unload(c);
        }
      }
      queue.sort((a, b) => b.dist - a.dist);   // nearest last, popped first
    }
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 3 && totalTris < TRI_CAP) {
      const c = queue.pop(); if (c.built) continue;
      c.built = buildCell(c); totalTris += c.built.tris;
    }
  }

  // ---------- dynamic tyre marks of the player's lapa: a capped ring of quads, fading out ----------
  const DN = 900, dpos = new Float32Array(DN * 4 * 3), dcol = new Float32Array(DN * 4 * 4), dnrm = new Float32Array(DN * 4 * 3), dbirth = new Float32Array(DN), dpeak = new Float32Array(DN);
  const didx = new Uint16Array(DN * 6);
  for (let i = 0; i < DN; i++) { const b = i * 4; didx.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], i * 6); for (let k = 0; k < 4; k++) { dnrm[(b + k) * 3 + 1] = 1; dcol[(b + k) * 4] = dcol[(b + k) * 4 + 1] = dcol[(b + k) * 4 + 2] = 0.03; } }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3).setUsage(THREE.DynamicDrawUsage));
  dgeo.setAttribute('normal', new THREE.BufferAttribute(dnrm, 3));
  dgeo.setAttribute('color', new THREE.BufferAttribute(dcol, 4).setUsage(THREE.DynamicDrawUsage));
  dgeo.setIndex(new THREE.BufferAttribute(didx, 1));
  const dmesh = new THREE.Mesh(dgeo, markMat); dmesh.frustumCulled = false; dmesh.receiveShadow = true; dmesh.renderOrder = 2;
  scene.add(dmesh);
  let dhead = 0, dlive = 0, tNow = 0, fadeAcc = 0;
  const FADE0 = 20, FADE1 = 55;
  const wheels = [{ px: 0, pz: 0, has: false, t: 0, o: 0.66 }, { px: 0, pz: 0, has: false, t: 0, o: -0.66 }];
  function marks(dt) {
    tNow += dt;
    const sn = Math.sin(car.th), cs = Math.cos(car.th), sk = car.skid || 0, speed = Math.abs(car.vf || 0);
    for (const w of wheels) {
      const x = car.x - sn * 0.7 + cs * w.o, z = car.z - cs * 0.7 - sn * w.o;
      if (sk > 0.12 && speed > 2.5 && !env.raisedMask(x, z)) {
        w.t += dt;
        if (w.has) {
          const dx = x - w.px, dz = z - w.pz, l = hyp2(dx, dz);
          if (l > 0.16) {
            if (l < 3) {   // a long jump (teleport, respawn) starts a new line instead
              const i = dhead; dhead = (dhead + 1) % DN; dlive = Math.min(DN, dlive + 1);
              const nx = -dz / l * 0.085, nz = dx / l * 0.085, y0 = groundY(w.px, w.pz) + MARK_LIFT, y1 = groundY(x, z) + MARK_LIFT, b = i * 4;
              dpos.set([w.px + nx, y0, w.pz + nz, w.px - nx, y0, w.pz - nz, x + nx, y1, z + nz, x - nx, y1, z - nz], b * 3);
              const a = clamp(sk, 0, 1) * Math.min(1, 0.35 + w.t * 1.4) * 0.7;
              dpeak[i] = a; dbirth[i] = tNow;
              for (let k = 0; k < 4; k++) dcol[(b + k) * 4 + 3] = a;
              dgeo.attributes.position.needsUpdate = true; dgeo.attributes.color.needsUpdate = true;
            }
            w.px = x; w.pz = z;
          }
        } else { w.has = true; w.px = x; w.pz = z; w.t = 0; }
      } else { w.has = false; w.t = 0; }
    }
    fadeAcc += dt;
    if (dlive && fadeAcc > 0.25) {   // fade old marks out
      fadeAcc = 0; let any = false;
      for (let i = 0; i < DN; i++) {
        if (dpeak[i] <= 0) continue;
        const age = tNow - dbirth[i], f = age < FADE0 ? 1 : age > FADE1 ? 0 : 1 - (age - FADE0) / (FADE1 - FADE0), a = dpeak[i] * f, b = i * 4;
        if (f === 0) dpeak[i] = 0;
        for (let k = 0; k < 4; k++) dcol[(b + k) * 4 + 3] = a;
        any = true;
      }
      if (any) dgeo.attributes.color.needsUpdate = true;
    }
  }

  // ---------- physics: the lapa's wheels against the holes ----------
  const WH = [{ lx: 0, fz: 1.15, side: 0, pitch: 1 }, { lx: 0.66, fz: -0.7, side: 1, pitch: -1 }, { lx: -0.66, fz: -0.7, side: -1, pitch: -1 }];
  // The current vehicle's wheels (vehicle.js sets car.wheelPts: 2 for bikes, 3 for lape, 4 for the car).
  const wheelSet = () => car.wheelPts || WH;
  const ws = [0, 1, 2, 3].map(() => ({ rec: null, cool: 0 }));
  function holeAt(x, z) {   // the deepest hole whose drawn outline (grown by the wheel's width) holds the point; sunken manholes are circles
    const ix = Math.floor(x / CGS), iz = Math.floor(z / CGS); let best = null;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = cg.get((ix + a) * 8192 + iz + b); if (!l) continue;
      for (const h of l) {
        if (h.q >= qf) continue;
        if (h.kind ? (x - h.x) ** 2 + (z - h.z) ** 2 < (h.r * 0.9 + 0.08) ** 2 : inHole(h, x, z, 0.05)) { if (!best || h.dep > best.dep) best = h; }   // a wheel is a few centimetres wide, hence the pad
      }
    }
    return best;
  }
  function impact(rec, wi, k) {
    const sp = Math.abs(car.vf || 0), w = wheelSet()[wi] || WH[0];
    const size = rec.kind ? 0.25 : clamp((rec.r - 0.04) / 0.6, 0.05, 1.3), dep = clamp(rec.dep / 0.14, 0.4, 1.4);
    const I = size * dep * clamp(sp / 13, 0.12, 1.4) * k;
    if (I < 0.02) return;
    const loss = clamp(0.01 + 0.04 * I, 0, 0.09), keep = 1 - loss;
    car.vx *= keep; car.vz *= keep; car.vf *= keep;
    car.w += (w.side * 0.4 + (Math.random() - 0.5) * 1.3) * Math.min(I, 1.3) * 1.5 * (wi === 0 ? 1.3 : 1);
    if (vehicle && vehicle.bump) vehicle.bump(I * 1.1, w.side, w.pitch);
    if (I > 0.55 && sp > 8) { car.kickT = Math.max(car.kickT || 0, clamp((I - 0.4) * 0.9, 0, 1)); car.kickSgn = w.side || (Math.random() < 0.5 ? 1 : -1); }
    if (I > 0.8 && sp > 11) car.gripLoss = Math.max(car.gripLoss || 0, clamp(I - 0.5, 0.3, 1));
  }
  function collidePlayer(c, dt) {
    const sn = Math.sin(c.th), cs = Math.cos(c.th), moving = Math.abs(c.vf || 0) > 0.8;
    const W = wheelSet();
    for (let i = 0; i < Math.min(W.length, ws.length); i++) {
      const w = W[i], st = ws[i], x = c.x + sn * w.fz + cs * w.lx, z = c.z + cs * w.fz - sn * w.lx;
      st.cool -= dt;
      const rec = holeAt(x, z);
      if (rec !== st.rec) {
        if (moving && st.cool <= 0) {
          if (rec) { impact(rec, i, 1); st.cool = 0.09; }
          else if (st.rec.dep > 0.07) { impact(st.rec, i, 0.35); st.cool = 0.09; }   // climbing out
        }
        st.rec = rec;
      }
    }
  }

  // ---------- public ----------
  const api = {
    update(dt) {
      generate(1.5);
      stream();
      marks(dt);
    },
    collidePlayer,
    nearHoles(x, z, r) {   // test hook (only reachable with ?debug): the holes a wheel can feel within r metres, with their size, depth and whether they hold water
      const out = [];
      for (const l of cg.values()) for (const h of l) if (!h.kind && hyp2(h.x - x, h.z - z) < r) out.push({ x: h.x, z: h.z, r: h.r, dep: h.dep, water: h.water, rot: h.rot });
      return out.sort((a, b) => hyp2(a.x - x, a.z - z) - hyp2(b.x - x, b.z - z));
    },
    setQuality(q) {
      const nq = QF[q] ? q : 'high';
      if (nq === qname) return;
      qname = nq; qf = QF[nq]; rad = RAD[nq];
      for (const W of live.values()) for (const c of W.cells.values()) unload(c);
      dirty = true;
    },
    stats() {
      let cells = 0, built = 0;
      for (const W of live.values()) for (const c of W.cells.values()) { cells++; if (c.built) built++; }
      return { ...stats, pending: pending.length, cells, built, trisResident: totalTris, initMs: Math.round(initMs) };
    },
  };
  const initMs = performance.now() - T0;
  if (location.search.includes('debug')) window.__roadwear = api; // timings for tests
  return api;
}
