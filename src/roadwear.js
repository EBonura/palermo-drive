// Road wear: potholes, repair patches, cracks, sunken manholes, worn zebra paint and tyre marks on the asphalt.
// Owned by the road-wear work.
//
// Everything is generated once at start from D.roads (centrelines resampled every metre) and an exact
// 0.5 m raster of D.streets.asphalt, with seeded random numbers, so the same hole is always in the same place.
// The decals are streamed in 96 m cells around the camera (one cell = a few merged meshes), so the whole city can
// be battered while only a few tens of thousands of triangles are ever resident.
//   - wear mesh per cell: opaque, vertex coloured, world-space grain texture, sits 4 cm over the road (polygonOffset)
//   - water mesh per cell: glossy puddles that mirror the sky gradient (only for the wet holes)
//   - marks mesh per cell: old black skid marks, alpha blended
// Holes are fake-3D: crumbled lip, dark wall whose normals tilt towards the hole so the low sun lights one side and
// shades the other, dark floor shaded by the sun side. No geometry goes below the road, so nothing z-fights.
// Physics: collidePlayer() tests the lapa's three wheels against the holes and calls vehicle.bump() plus a little
// speed loss, yaw kick, forced two-wheel lean and loss of grip. Dynamic tyre marks come from car.skid (vehicle.js).
import * as THREE from 'three';
import { pairs, rng } from './core.js';

const TAU = Math.PI * 2, CELL = 96, LIFT = 0.04, UVM = 2.2, MARK_LIFT = 0.041;
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
  crumbOut: [C('#a7a49a'), C('#8d8a81'), C('#b4b0a4')], crumbIn: C('#6c6a65'),
  rim: C('#3a3836'), wall: C('#2b2a28'), floor: C('#1a1918'), centre: C('#121110'),
  patchDark: [C('#6a6862'), C('#726f69'), C('#615f5a')], patchLight: [C('#9a978e'), C('#a29f96')], seam: C('#4a4844'),
  crack: C('#3b3936'), worn: C('#7b7a74'), mhFrame: C('#55514b'), mhCover: [C('#6a645b'), C('#5d5851')], mhGap: C('#232220'),
  water: C('#8a9aa6'),
};
const K = { primary: 0, secondary: 1, tertiary: 2, unclassified: 3, residential: 4, service: 5, living_street: 6, pedestrian: 7 };
// per class, per metre of centreline: holes, repair patches, cracks, manholes
const DENS = {
  primary: [0.055, 0.012, 0.025, 0.02], secondary: [0.08, 0.015, 0.03, 0.02], tertiary: [0.14, 0.02, 0.04, 0.03],
  unclassified: [0.16, 0.02, 0.04, 0.02], residential: [0.24, 0.03, 0.05, 0.03], service: [0.2, 0.02, 0.05, 0.015],
  living_street: [0.2, 0.02, 0.04, 0.02], pedestrian: [0.09, 0.01, 0.03, 0.01],
};
const MARKETS = [[-60, 410, 110], [260, -220, 110], [-390, -245, 90]];   // Ballaro, Vucciria, Capo

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
  const { scene, camera, car, groundY, D, vehicle } = env;
  const T0 = performance.now();
  if (!D.streets || !D.streets.aoi) return { update() {}, collidePlayer() {}, setQuality() {} };
  const gy = (x, z) => groundY(x, z) + LIFT;

  // ---------- exact asphalt raster: 1 m cells, 1 bit each, drawn in tiles so memory stays small ----------
  const [AX0, AZ0, AX1, AZ1] = D.streets.aoi, S = 1, MW = Math.ceil((AX1 - AX0) * S), MH = Math.ceil((AZ1 - AZ0) * S);
  const mask = new Uint8Array((MW * MH + 7) >> 3);
  {
    const TS = 2048, cv = document.createElement('canvas'); cv.width = cv.height = TS;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const bb = polys => polys.map(poly => {
      const r = poly[0]; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let i = 0; i < r.length; i += 2) { if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i]; if (r[i + 1] < z0) z0 = r[i + 1]; if (r[i + 1] > z1) z1 = r[i + 1]; }
      return [poly, x0, z0, x1, z1];
    });
    const layers = { asphalt: bb(D.streets.asphalt), paving: bb(D.streets.paving), raised: bb(D.streets.raised), green: bb(D.streets.green) };
    for (let ty = 0; ty < MH; ty += TS) for (let tx = 0; tx < MW; tx += TS) {
      const wx0 = AX0 + tx / S, wz0 = AZ0 + ty / S, wx1 = wx0 + TS / S, wz1 = wz0 + TS / S;
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, TS, TS);
      for (const name of ['asphalt', 'paving', 'raised', 'green']) {
        g.globalCompositeOperation = name === 'asphalt' ? 'source-over' : 'destination-out'; g.fillStyle = '#fff';
        for (const [poly, x0, z0, x1, z1] of layers[name]) {
          if (x1 < wx0 || x0 > wx1 || z1 < wz0 || z0 > wz1) continue;
          g.beginPath();
          for (const ring of poly) for (let i = 0; i < ring.length; i += 2) g[i ? 'lineTo' : 'moveTo']((ring[i] - wx0) * S, (ring[i + 1] - wz0) * S);
          g.fill('evenodd');
        }
      }
      const d = new Uint32Array(g.getImageData(0, 0, TS, TS).data.buffer), w = Math.min(TS, MW - tx), h = Math.min(TS, MH - ty);
      for (let j = 0; j < h; j++) for (let i = 0, o = j * TS; i < w; i++) if (d[o + i] !== 0 && (d[o + i] >>> 24) > 127) { const k = (ty + j) * MW + tx + i; mask[k >> 3] |= 1 << (k & 7); }
    }
  }
  const onRoad = (x, z) => {
    const i = ((x - AX0) * S) | 0, j = ((z - AZ0) * S) | 0;
    if (i < 0 || j < 0 || i >= MW || j >= MH) return false;
    const k = j * MW + i; return (mask[k >> 3] >> (k & 7)) & 1;
  };

  // ---------- helpers ----------
  const NL = 70, NW = 64, lattice = new Float32Array(NW * NW);   // smooth 0..1 value noise on a 70 m lattice: some streets are simply worse
  for (let j = 0; j < NW; j++) for (let i = 0; i < NW; i++) lattice[j * NW + i] = hf(i, j, 5);
  const vnoise = (x, z) => {
    const fx = clamp(x / NL + 32, 0, NW - 1.01), fz = clamp(z / NL + 32, 0, NW - 1.01), ix = fx | 0, iz = fz | 0;
    let tx = fx - ix, tz = fz - iz; tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
    const a = lattice[iz * NW + ix], b = lattice[iz * NW + ix + 1], c = lattice[(iz + 1) * NW + ix], d = lattice[(iz + 1) * NW + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  const neglect = (x, z) => {
    let m = 0.75 + 1.1 * vnoise(x, z) ** 1.3;
    for (const [mx, mz, mr] of MARKETS) { const dx = x - mx, dz = z - mz; if (dx * dx + dz * dz < 9 * mr * mr) { const d2 = (dx * dx + dz * dz) / (mr * mr); m *= 1 + 1.6 * Math.exp(-d2); } }
    return m;
  };

  // ---------- feature storage ----------
  const cells = new Map();   // key -> { x0, z0, holes, patches, cracks, mhs, blots, marks, polish, built }
  const cellKey = (ix, iz) => (ix + 512) * 1024 + (iz + 512);
  const cellAt = (x, z) => {
    const ix = Math.floor((x - AX0) / CELL), iz = Math.floor((z - AZ0) / CELL), k = cellKey(ix, iz);
    let c = cells.get(k);
    if (!c) cells.set(k, c = { ix, iz, x0: AX0 + ix * CELL, z0: AZ0 + iz * CELL, holes: [], patches: [], cracks: [], mhs: [], blots: [], marks: [], polish: [], built: null });
    return c;
  };
  const HG = 3, hgrid = new Map(), hgk = (x, z) => Math.floor(x / HG) * 8192 + Math.floor(z / HG);
  const hgAdd = (x, z, r, rec) => { const k = hgk(x, z); let a = hgrid.get(k); if (!a) hgrid.set(k, a = []); a.push([x, z, r, rec]); };
  const hgNear = (x, z, r) => {   // anything (hole, manhole, patch) whose disc overlaps this disc?
    const ix = Math.floor(x / HG), iz = Math.floor(z / HG), reach = Math.ceil((r + 2.5) / HG);
    for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
      const l = hgrid.get((ix + a) * 8192 + iz + b); if (!l) continue;
      for (const o of l) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + r) return true;
    }
    return false;
  };
  const stats = { holes: 0, water: 0, big: 0, clusters: 0, patches: 0, cracks: 0, manholes: 0, sunken: 0, blots: 0, marks: 0, crossings: 0, junctions: 0 };

  const cg = new Map(), CGS = 6;   // collision grid of holes and sunken manholes
  const cgAdd = rec => { const k = Math.floor(rec.x / CGS) * 8192 + Math.floor(rec.z / CGS); let a = cg.get(k); if (!a) cg.set(k, a = []); a.push(rec); };

  function addHole(x, z, r, rot, el, dep, water, q, hostR = null) {
    const c = Math.cos(rot), s = Math.sin(rot), e = r * el + 0.15, f = r + 0.15;
    if (!onRoad(x, z) || !onRoad(x + c * e, z + s * e) || !onRoad(x - c * e, z - s * e) || !onRoad(x - s * f, z + c * f) || !onRoad(x + s * f, z - c * f)) return null;
    const rr = r * Math.max(1, el);
    if (hgNear(x, z, rr * 0.9)) return null;
    const rec = { x, z, r, rot, el, dep, water, q: r > 0.5 ? q * 0.4 : q, seed: hash(x, z, 9), kind: 0 };
    cellAt(x, z).holes.push(rec); hgAdd(x, z, rr * 1.1, rec); cgAdd(rec);
    stats.holes++; if (water) stats.water++; if (r > 0.5) stats.big++;
    if (r > 0.45 && hostR) {   // alligator cracks radiating from the big ones
      const n = 2 + Math.floor(hostR() * 3);
      for (let i = 0; i < n; i++) {
        const a = hostR() * TAU, len = 0.8 + hostR() * 1.8, pts = [], sx = x + Math.cos(a) * r * el * 1.1, sz = z + Math.sin(a) * r * 1.1;
        let px = sx, pz = sz, h = a;
        for (let k = 0; k < 4; k++) { if (!onRoad(px, pz)) break; pts.push(px, pz, 0.035 - k * 0.005); h += (hostR() - 0.5) * 0.9; px += Math.cos(h) * len / 4; pz += Math.sin(h) * len / 4; }
        if (pts.length >= 6) { cellAt(x, z).cracks.push({ pts, q: rec.q }); stats.cracks++; }
      }
    }
    return rec;
  }

  // ---------- roads: resample every metre and scatter features ----------
  const roadList = [];
  const SX = [], SZ = [], STX = [], STZ = [], SW = [], SK = [];   // global resampled samples for nearest-road lookups
  const sgrid = new Map(), SGC = 16;
  {
    for (const r of D.roads) {
      const dens = DENS[r.k]; if (!dens) continue;
      const P = pairs(r.p); if (P.length < 2) continue;
      const R = rng(hash(P[0][0], P[0][1], P.length));
      const hw = (r.w || 4) / 2 * 0.9, narrow = r.w < 5 ? 1.2 : 1;
      const smp = [];   // x, z, tx, tz
      let next = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
        const tx = (bx - ax) / L, tz = (bz - az) / L;
        let s = next;
        for (; s < L; s += 1) smp.push(ax + tx * s, az + tz * s, tx, tz);
        next = s - L;
      }
      const n = smp.length / 4; if (n < 2) continue;
      const ri = roadList.length; roadList.push({ smp, w: r.w || 4, k: r.k, n });
      for (let i = 0; i < n; i++) {
        const x = smp[i * 4], z = smp[i * 4 + 1], tx = smp[i * 4 + 2], tz = smp[i * 4 + 3];
        const gk = Math.floor(x / SGC) * 8192 + Math.floor(z / SGC); let ga = sgrid.get(gk); if (!ga) sgrid.set(gk, ga = []); ga.push(SX.length);
        SX.push(x); SZ.push(z); STX.push(tx); STZ.push(tz); SW.push(r.w || 4); SK.push(r.k);
        const ng = neglect(x, z) * narrow, nx = -tz, nzz = tx;
        const lat = () => R() < 0.4 ? (R() < 0.5 ? 1 : -1) * hw * (0.35 + R() * 0.3) : (R() * 2 - 1) * hw;
        // potholes
        if (R() < Math.min(0.9, dens[0] * ng)) {
          const u = R(); let rad;
          if (u < 0.6) rad = 0.11 + R() * 0.2; else if (u < 0.86) rad = 0.25 + R() * 0.25; else if (u < 0.97) rad = 0.5 + R() * 0.3; else rad = 0.8 + R() * 0.5;
          const off = lat(), px = x + nx * off, pz = z + nzz * off;
          const el = rad > 0.45 ? 1 + R() * 0.6 : 1 + R() * 0.2, rot = Math.atan2(tz, tx) + (R() - 0.5) * 0.8;
          const dep = 0.025 + 0.2 * Math.min(1, rad / 0.9) * (0.6 + 0.4 * R());
          const water = rad >= 0.25 ? R() < 0.22 : R() < 0.03;
          const main = addHole(px, pz, rad, rot, el, dep, water, R(), R);
          if (main && R() < 0.1) {   // a cluster of smaller ones around it
            stats.clusters++;
            const m = 3 + Math.floor(R() * 4);
            for (let k = 0; k < m; k++) {
              const a = R() * TAU, d = 0.5 + R() * 2.2, rr = 0.09 + R() * 0.22;
              addHole(px + Math.cos(a) * d, pz + Math.sin(a) * d, rr, R() * TAU, 1 + R() * 0.3, 0.03 + R() * 0.07, R() < 0.12, main.q + R() * 0.15);
            }
          }
        }
        // repair patches: long trench strips and square patches
        if (R() < dens[1] * ng) {
          const trench = R() < 0.6, len = trench ? 3 + R() * 10 : 1.2 + R() * 2.4, wid = trench ? 0.7 + R() * 0.6 : 1 + R() * 1.4;
          const off = clamp((R() * 2 - 1) * hw, -(hw - wid / 2), hw - wid / 2) * 0.9, px = x + nx * off, pz = z + nzz * off;
          const rot = Math.atan2(tz, tx) + (R() - 0.5) * 0.12, c = Math.cos(rot), s = Math.sin(rot);
          let ok = true;
          for (let a = -len / 2; a <= len / 2 + 0.01 && ok; a += Math.max(0.5, len / 8)) for (const b of [-wid / 2 - 0.1, 0, wid / 2 + 0.1]) {
            const wx = px + c * a - s * b, wz = pz + s * a + c * b;
            if (!onRoad(wx, wz) || hgNear(wx, wz, 0.1)) { ok = false; break; }
          }
          if (ok) {
            const pr = { x: px, z: pz, len, wid, rot, light: R() < 0.28, v: Math.floor(R() * 3), q: R(), seed: hash(px, pz, 3) };
            cellAt(px, pz).patches.push(pr); stats.patches++;
            const nn = Math.ceil(len / 2.5); for (let a = 0; a < nn; a++) { const t = (a + 0.5) / nn - 0.5; hgAdd(px + c * len * t, pz + s * len * t, Math.max(len / nn / 2 + 0.2, wid / 2 + 0.2), pr); }
          }
        }
        // cracks
        if (R() < dens[2] * ng) {
          const off = (R() * 2 - 1) * hw, sx = x + nx * off, sz = z + nzz * off;
          const crack = (px, pz, h, len, w0) => {
            const pts = []; let wl = w0;
            for (let d = 0; d <= len; d += 0.5 + R() * 0.4) {
              if (!onRoad(px, pz)) break;
              pts.push(px, pz, wl); wl = Math.max(0.012, wl * (0.93 + R() * 0.05));
              h += (R() - 0.5) * 0.9; px += Math.cos(h) * (0.5 + R() * 0.3); pz += Math.sin(h) * (0.5 + R() * 0.3);
            }
            return pts;
          };
          const h0 = R() < 0.7 ? Math.atan2(tz, tx) + (R() - 0.5) * 0.7 : R() * TAU, len = 1.5 + R() * 6;
          const pts = crack(sx, sz, h0, len, 0.03 + R() * 0.03);
          if (pts.length >= 9) {
            const cl = cellAt(sx, sz), q = R(); cl.cracks.push({ pts, q }); stats.cracks++;
            if (R() < 0.3) { const k = Math.floor(pts.length / 6) * 3, bp = crack(pts[k], pts[k + 1], h0 + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.5), len * 0.5, 0.02); if (bp.length >= 9) cl.cracks.push({ pts: bp, q }); }
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
            if (sunk) { cgAdd(rec); stats.sunken++; }
          }
        }
      }
    }
  }
  const sNear = (x, z, r) => {   // nearest resampled road sample within r
    let best = -1, bd = r * r;
    const ix = Math.floor(x / SGC), iz = Math.floor(z / SGC), reach = Math.ceil(r / SGC);
    for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
      const l = sgrid.get((ix + a) * 8192 + iz + b); if (!l) continue;
      for (const i of l) { const d = (SX[i] - x) ** 2 + (SZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    return best;
  };

  // ---------- tyre marks baked on the road: before zebra crossings, at junctions and in bends ----------
  // A mark is a pair of tracks; each track is a list of x, z, alpha. 'brake' fades in and stops dead, 'arc' is a bell.
  function addMarks(path, kind, R, track = 1.35, w = 0.17) {
    // path: [x, z, ...] centreline at about 0.6 m spacing. Cut at the first point off the asphalt.
    const n = path.length / 2; if (n < 6) return;
    const q = R();
    for (const side of [-0.5, 0.5]) {
      const pts = []; let wob = R() * 6, ok = 0;
      for (let i = 0; i < n; i++) {
        const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
        let dx = path[j1 * 2] - path[j0 * 2], dz = path[j1 * 2 + 1] - path[j0 * 2 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
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
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / step)), out = [];
    for (let i = 0; i <= n; i++) out.push(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
    return out;
  };
  const bez = (p0, p1, p2, step = 0.6) => {
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(4, Math.round(L / step)), out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; out.push(a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]); }
    return out;
  };
  const crossings = [];
  {
    const R = rng(77123), PR = window.PALERMO_PROPS;
    const done = [];
    for (const it of (PR && PR.items) || []) {
      if (it.k !== 'crossing' || it.cr === 'unmarked' || it.den === 'unmarked') continue;
      if (done.some(d => Math.hypot(d[0] - it.x, d[1] - it.z) < 10)) continue;
      const si = sNear(it.x, it.z, 5); if (si < 0) continue;
      const tx = STX[si], tz = STZ[si], nx = -tz, nzz = tx;
      // nearest point on the centreline (project the node on the sample's tangent)
      const s = (it.x - SX[si]) * tx + (it.z - SZ[si]) * tz, cx = SX[si] + tx * s, cz = SZ[si] + tz * s;
      if (!onRoad(cx, cz)) continue;
      const march = (dx, dz) => { let d = 0; while (d < 9 && onRoad(cx + dx * (d + 0.25), cz + dz * (d + 0.25))) d += 0.25; return d; };
      const e1 = march(nx, nzz), e2 = march(-nx, -nzz);
      if (e1 + e2 < 4.5 || e1 + e2 > 16) continue;
      done.push([it.x, it.z]); stats.crossings++;
      crossings.push({ cx, cz, tx, tz, nx, nz: nzz, e1, e2 });
      const cell = cellAt(cx, cz);
      // worn paint: ragged asphalt-coloured blotches eating the stripes, and tyre-polished tracks
      const stripes = Math.max(1, Math.round((e1 + e2 - 0.9) / 0.95)), nb = Math.min(36, stripes * 3 + 2);
      for (let b = 0; b < nb; b++) {
        const k = Math.floor(R() * stripes), u = -e2 + 0.45 + k * 0.95 + (R() - 0.5) * 0.3, v = (R() - 0.5) * 3.0;
        cell.blots.push({ x: cx + nx * u + tx * v, z: cz + nzz * u + tz * v, ax: 0.2 + R() * 0.55, az: 0.1 + R() * 0.2, rot: Math.atan2(tz, tx), seed: (R() * 1e9) | 0, q: R() });
      }
      for (const o of [(e1 - e2) / 2 - 1.5, (e1 - e2) / 2 + 1.5]) cell.polish.push({ pts: line(cx + nx * o - tx * 1.9, cz + nzz * o - tz * 1.9, cx + nx * o + tx * 1.9, cz + nzz * o + tz * 1.9, 0.95), w: 0.28, a: 0.1 + R() * 0.08, q: R() });
      // black skid marks leading up to the stripes on either approach: everyone brakes late in Palermo
      for (const dir of [1, -1]) {
        if (R() > 0.55) continue;
        const off = dir > 0 ? e1 * 0.5 : -e2 * 0.5, len = 4 + R() * 9, d0 = 1.9 + R() * 1.4;
        const lat = off + (R() - 0.5) * (Math.abs(off) * 0.6);
        addMarks(line(cx + nx * lat - tx * dir * (d0 + len), cz + nzz * lat - tz * dir * (d0 + len), cx + nx * (lat + (R() - 0.5) * 0.5) - tx * dir * d0, cz + nzz * (lat + (R() - 0.5) * 0.5) - tz * dir * d0), 'brake', R);
      }
    }
  }
  {   // junctions: late braking on the arms, and the odd swerve through the middle
    const R = rng(4421), jm = new Map(), key = (x, z) => Math.round(x * 5) * 100003 + Math.round(z * 5);
    for (const r of D.roads) {
      if (!DENS[r.k] || r.k === 'pedestrian') continue;
      const P = pairs(r.p);
      for (let i = 0; i < P.length; i++) {
        const arms = [];
        for (const dir of [-1, 1]) {
          let j = i + dir;
          while (j >= 0 && j < P.length && Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) < 4) j += dir;
          if (j >= 0 && j < P.length) { const L = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]); arms.push([(P[j][0] - P[i][0]) / L, (P[j][1] - P[i][1]) / L, r.w || 4, r.k]); }
        }
        if (!arms.length) continue;
        const k = key(P[i][0], P[i][1]); let e = jm.get(k); if (!e) jm.set(k, e = { x: P[i][0], z: P[i][1], arms: [] });
        e.arms.push(...arms);
      }
    }
    for (const j of jm.values()) {
      if (j.arms.length < 3) continue;
      stats.junctions++;
      const arms = j.arms, minor = arms.some(a => a[3] === 'primary' || a[3] === 'secondary' || a[3] === 'tertiary') ? 0.4 : 0.25;
      for (const a of arms) {
        if (R() > minor) continue;
        const [ax, az, w] = a, fx = -ax, fz = -az, rx = -fz, rz = fx, lat = w / 4 + (R() - 0.5) * 0.5;   // travelling towards the junction, in the right-hand lane
        const d0 = 3 + R() * 2, len = 4 + R() * 8;
        addMarks(line(j.x + ax * (d0 + len) + rx * lat, j.z + az * (d0 + len) + rz * lat, j.x + ax * d0 + rx * lat, j.z + az * d0 + rz * lat), 'brake', R);
      }
      if (R() < 0.22) {   // a swerving turn through the junction
        const a = arms[Math.floor(R() * arms.length)], b = arms[Math.floor(R() * arms.length)];
        if (a !== b && Math.abs(a[0] * b[0] + a[1] * b[1]) < 0.9) {
          const la = a[2] / 4, lb = b[2] / 4, arx = a[1], arz = -a[0], brx = -b[1], brz = b[0];
          addMarks(bez([j.x + a[0] * 9 + arx * la, j.z + a[1] * 9 + arz * la], [j.x + (R() - 0.5), j.z + (R() - 0.5)], [j.x + b[0] * 9 + brx * lb, j.z + b[1] * 9 + brz * lb]), 'arc', R);
        }
      }
    }
  }
  {   // bends: a track along the outside of the curve
    const R = rng(9981);
    for (const rd of roadList) {
      if (rd.k === 'pedestrian' || rd.k === 'service') continue;
      const { smp, n, w } = rd; let skip = 0;
      for (let i = 8; i < n - 8; i++) {
        if (--skip > 0) continue;
        const a0 = Math.atan2(smp[(i - 6) * 4 + 3], smp[(i - 6) * 4 + 2]), a1 = Math.atan2(smp[(i + 6) * 4 + 3], smp[(i + 6) * 4 + 2]);
        let da = a1 - a0; da -= TAU * Math.round(da / TAU);
        if (Math.abs(da) < 0.5 || R() > 0.3) continue;
        skip = 40;
        const path = [], sgn = da > 0 ? 1 : -1, lane = (w / 4) * (R() < 0.5 ? 1 : -1) + sgn * 0.3;
        for (let k = i - 7; k <= i + 8; k++) { const tx = smp[k * 4 + 2], tz = smp[k * 4 + 3]; path.push(smp[k * 4] - tz * lane, smp[k * 4 + 1] + tx * lane); }
        addMarks(path, 'arc', R);
      }
    }
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
  const waterMat = new THREE.MeshStandardMaterial({ color: COL.water, roughness: 0.04, metalness: 0.85, envMapIntensity: 1.1, ...po(-5, -10) });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0, ...po(-6, -12) });

  const TRI_CAP = 140000;   // resident wear triangles never go past this, whatever the density
  const QF = { low: 0.35, medium: 0.7, high: 1 }, RAD = { low: 110, medium: 160, high: 210 };
  let qf = 1, rad = 210, qname = 'high';
  const mix = (a, b, t) => new THREE.Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

  function buildHole(B, W, h) {
    const R = rng(h.seed), n = h.r < 0.2 ? 6 : h.r < 0.5 ? 8 : 10, cr = Math.cos(h.rot), sr = Math.sin(h.rot), a0 = R() * TAU;
    const crumble = h.r >= 0.17, wc0 = 0.03 + 0.2 * h.r;
    const C0 = [], C1 = [], R1 = [], R2 = [], F2 = [], wat = [];
    const pt = (px, pz, nx, ny, nz, c, k) => B.v(px, gy(px, pz), pz, nx, ny, nz, c, k);
    for (let i = 0; i < n; i++) {
      const a = a0 + TAU * i / n, lx = Math.cos(a) * h.el, lz = Math.sin(a), wx = lx * cr - lz * sr, wz = lx * sr + lz * cr;
      const rad = h.r * (0.78 + 0.44 * R()), ol = Math.hypot(wx, wz), ox = wx / ol, oz = wz / ol, sf = ox * SUNH[0] + oz * SUNH[1];   // sf +1: on the sunward (west) side
      const p1x = h.x + wx * rad, p1z = h.z + wz * rad, p2x = h.x + wx * rad * 0.68, p2z = h.z + wz * rad * 0.68;
      if (crumble) {
        const wcw = wc0 * (0.4 + 1.5 * R()), p0x = p1x + ox * wcw, p0z = p1z + oz * wcw;
        C0.push(pt(p0x, p0z, ox * 0.2, 1, oz * 0.2, COL.crumbOut[i % 3], 0.88 + 0.2 * R()));
        C1.push(pt(p1x, p1z, ox * 0.5, 1, oz * 0.5, COL.crumbIn, 0.9 + 0.2 * R()));
      }
      const lit = 1 - 0.3 * sf;
      R1.push(pt(p1x, p1z, -ox * 0.9, 1, -oz * 0.9, COL.rim, lit));
      R2.push(pt(p2x, p2z, -ox * 0.9, 1, -oz * 0.9, COL.wall, lit * 0.9));
      F2.push(pt(p2x, p2z, 0, 1, 0, COL.floor, 1 - 0.4 * sf));
      if (h.water) wat.push(W.v(h.x + wx * rad * 0.93, gy(h.x + wx * rad * 0.93, h.z + wz * rad * 0.93) + 0.004, h.z + wz * rad * 0.93, 0, 1, 0, COL.water, 1));
    }
    const cc = pt(h.x, h.z, 0, 1, 0, COL.centre, 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (crumble) { B.t(C0[i], C1[j], C0[j]); B.t(C0[i], C1[i], C1[j]); }
      B.t(R1[i], R2[j], R1[j]); B.t(R1[i], R2[i], R2[j]);
      B.t(F2[i], cc, F2[j]);
    }
    if (h.water) {
      const wc = W.v(h.x, gy(h.x, h.z) + 0.004, h.z, 0, 1, 0, COL.water, 1);
      for (let i = 0; i < n; i++) W.t(wat[i], wc, wat[(i + 1) % n]);
    }
  }

  function strip(B, pts, step, width, col, alphaFn) {   // ribbon along x, z[, w] triples; used for cracks, marks, polish
    const n = pts.length / step, ids = [];
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      let dx = pts[j1 * step] - pts[j0 * step], dz = pts[j1 * step + 1] - pts[j0 * step + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
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
      quad(B, p.x, p.z, p.rot, p.len / 2 + 0.05, p.wid / 2 + 0.05, COL.seam, COL.seam, 0.06, R, 1);
      quad(B, p.x, p.z, p.rot, p.len / 2 - 0.02, p.wid / 2 - 0.02, c, mix(c, COL.worn, 0.3), 0.05, R, 1, 0.003);
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
    for (const m of cell.marks) if (m.q < qf) strip(M, m.pts, 3, m.w * 0.5, MARK_COL, (i, p) => p[i * 3 + 2]);
    for (const p of cell.polish) if (p.q < qf) strip(M, p.pts, 2, p.w, MARK_COL, () => p.a);
    const out = { meshes: [], tris: B.tris + W.tris + M.tris };
    const mw = B.mesh(wearMat), mwa = W.mesh(waterMat), mm = M.mesh(markMat);
    if (mm) mm.renderOrder = 1;
    if (mwa) mwa.renderOrder = 0;
    for (const m of [mw, mwa, mm]) if (m) { scene.add(m); out.meshes.push(m); }
    return out;
  }
  const MARK_COL = C('#0c0b0c');

  function unload(cell) {
    if (!cell.built) return;
    for (const m of cell.built.meshes) { scene.remove(m); m.geometry.dispose(); }
    totalTris -= cell.built.tris; cell.built = null;
  }
  let totalTris = 0, lastX = 1e9, lastZ = 1e9, lastHigh = false, dirty = true, queue = [];

  function stream(first) {
    const cp = camera.position, high = cp.y - groundY(cp.x, cp.z) > 320;   // nothing is visible from a very high flyover
    if (dirty || high !== lastHigh || (cp.x - lastX) ** 2 + (cp.z - lastZ) ** 2 > 36) {
      dirty = false; lastX = cp.x; lastZ = cp.z; lastHigh = high;
      const R = high ? -1 : rad;
      queue = [];
      for (const c of cells.values()) {
        const dx = Math.max(c.x0 - cp.x, 0, cp.x - (c.x0 + CELL)), dz = Math.max(c.z0 - cp.z, 0, cp.z - (c.z0 + CELL)), d = Math.hypot(dx, dz);
        c.dist = d;
        if (d <= R) { if (!c.built) queue.push(c); } else if (c.built && (R < 0 || d > R + 70)) unload(c);
      }
      queue.sort((a, b) => b.dist - a.dist);   // nearest last, popped first
    }
    const budget = first ? 40 : 3, t0 = performance.now();
    while (queue.length && performance.now() - t0 < budget && totalTris < TRI_CAP) {
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
          const dx = x - w.px, dz = z - w.pz, l = Math.hypot(dx, dz);
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
  function holeAt(x, z) {
    const ix = Math.floor(x / CGS), iz = Math.floor(z / CGS); let best = null;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = cg.get((ix + a) * 8192 + iz + b); if (!l) continue;
      for (const h of l) {
        if (h.q >= qf) continue;
        const dx = x - h.x, dz = z - h.z, r = h.r * 0.9 + 0.08;
        if (dx * dx + dz * dz > (r * Math.max(1, h.el)) ** 2) continue;
        const c = Math.cos(h.rot), s = Math.sin(h.rot), lx = (dx * c + dz * s) / (r * h.el), lz = (-dx * s + dz * c) / r;
        if (lx * lx + lz * lz < 1 && (!best || h.dep > best.dep)) best = h;
      }
    }
    return best;
  }
  function impact(rec, wi, k) {
    const sp = Math.abs(car.vf || 0), w = wheelSet()[wi] || WH[0];
    const size = rec.kind ? 0.25 : clamp((rec.r - 0.08) / 0.75, 0.05, 1.3), dep = clamp(rec.dep / 0.14, 0.4, 1.4);
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
  let first = true;
  const api = {
    update(dt) {
      stream(first); first = false;
      marks(dt);
    },
    collidePlayer,
    setQuality(q) {
      const nq = QF[q] ? q : 'high';
      if (nq === qname) return;
      qname = nq; qf = QF[nq]; rad = RAD[nq];
      for (const c of cells.values()) unload(c);
      dirty = true;
    },
    stats() { return { ...stats, cells: cells.size, built: [...cells.values()].filter(c => c.built).length, trisResident: totalTris, initMs: Math.round(initMs) }; },
  };
  const initMs = performance.now() - T0;
  return api;
}
