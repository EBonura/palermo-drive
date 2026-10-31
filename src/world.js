// World streaming (?world=1): the whole of Palermo and Mondello, baked by tools/tiles.py into world/manifest.json and
// world/tiles/i_j.json (500 m tiles, same field names as PALERMO_DATA). Format and plan: docs/TILES.md.
//
// Rings around the camera, per tile ("lod"):
//   2  full detail  (< rFull)  terrain at 10 m, all street layers + curbs, src/buildings.js facades, wall collision, road names,
//                              raised-ground mask for the car
//   1  low detail   (< rLow)   terrain at 20 m, asphalt/paving/sand/water, simple extruded buildings with one plain facade texture
//   0  nothing                 the far terrain (this file, from the manifest's coarse grid) shows through; tiles with terrain
//                              punch a hole in it. The old context city (src/context.js) is hidden wherever tiles are loaded.
// Everything heavy is a generator stepped by a per-frame time budget (update()), nearest tile first, so streaming never
// hitches; fetches are limited to a few at a time, nearest first; parsed tiles that leave the radius sit in a small LRU;
// a hard cap on resident triangles shrinks the rings (phones). Geometry is disposed when parts go; materials are shared.
import * as THREE from 'three';
import { D, hooks, groundY, inNear, pairs, signedArea, inPoly, canvasTex } from './core.js';
import { streetsIter } from './streets.js';
import { buildBuildingsIter, warmBuildings } from './buildings.js';
import { QUALITY } from './mobile.js';

const T = 500;
const nk = (i, j) => (i + 200) * 1000 + (j + 200);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- configuration (URL overrides for tuning: rfull, rlow, tricap) ----------
const Q = new URLSearchParams(location.search);
const MOBILE = !!QUALITY.mobile;
const CFG = {
  rFull: +Q.get('rfull') || (MOBILE ? 380 : 650),
  rLow: +Q.get('rlow') || (MOBILE ? 1300 : 2200),
  hyst: 120,
  triCap: +Q.get('tricap') || (MOBILE ? 650e3 : 2.8e6),
  conc: MOBILE ? 3 : 4,
  budgetMs: +Q.get('wbudget') || (MOBILE ? 2 : 3.5),
  keepData: MOBILE ? 4 : 10,
  base: Q.get('worldurl') || 'world/',
};

// ---------- grids ----------
function gridSampler(g, h = Float32Array.from(g.h)) {
  const { x0, z0, s, nx, nz } = g;
  return (x, z) => {
    const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / s)), fz = Math.max(0, Math.min(nz - 1.001, (z - z0) / s));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * nx + i;
    return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + nx] * (1 - tx) + h[k + nx + 1] * tx) * tz;
  };
}

// ---------- segment grid with per-tile removal (walls and street names) ----------
class SegGrid {
  constructor(cell) { this.cell = cell; this.m = new Map(); this.byTile = new Map(); }
  addSeg(tile, seg, x0, z0, x1, z1) {
    const c = this.cell; seg.t = tile;
    let keys = this.byTile.get(tile); if (!keys) this.byTile.set(tile, keys = new Set());
    for (let ix = Math.floor(Math.min(x0, x1) / c); ix <= Math.floor(Math.max(x0, x1) / c); ix++)
      for (let iz = Math.floor(Math.min(z0, z1) / c); iz <= Math.floor(Math.max(z0, z1) / c); iz++) {
        const k = ix * 100003 + iz; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(seg); keys.add(k);
      }
  }
  removeTile(tile) {
    const keys = this.byTile.get(tile); if (!keys) return;
    for (const k of keys) {
      const a = this.m.get(k); if (!a) continue;
      let w = 0; for (let r = 0; r < a.length; r++) if (a[r].t !== tile) a[w++] = a[r];
      if (w) a.length = w; else this.m.delete(k);
    }
    this.byTile.delete(tile);
  }
  query(x0, z0, x1, z1, fn) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) { const a = this.m.get(ix * 100003 + iz); if (a) for (const s of a) fn(s); }
  }
}

// ---------- terrain colours (same palette as the old far mesh in main.js) ----------
const C = {
  sand: new THREE.Color('#cdbb92'), plain: new THREE.Color('#b3a993'), grove: new THREE.Color('#7f8f5c'), scrub: new THREE.Color('#77804f'),
  rock: new THREE.Color('#b9b0a1'), urban: new THREE.Color('#9c968a'), forest: new THREE.Color('#5f7d48'), green: new THREE.Color('#7a9a55'),
  beach: new THREE.Color('#d6c79f'),
};
const _c = new THREE.Color();
function terrainColor(out, h, slope, noise) {
  if (h < 2) out.copy(C.sand);
  else if (h < 90 && slope < 0.15) out.copy(C.plain).lerp(C.grove, noise * 0.6);
  else out.copy(C.scrub).lerp(C.rock, Math.min(1, slope * 1.4));
  return out;
}

// ---------- low-detail facade: one plain tile, two bays by two floors ----------
let lowMats = null;
function getLowMats() {
  if (lowMats) return lowMats;
  const tex = canvasTex(128, (g, S) => {
    g.fillStyle = '#efeadc'; g.fillRect(0, 0, S, S);
    for (let f = 0; f < 2; f++) for (let b = 0; b < 2; b++) {
      const x = b * S / 2 + S * 0.11, y = f * S / 2 + S * 0.1, w = S * 0.28, h = S * 0.3;
      g.fillStyle = '#d9d3c4'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = '#4b5560'; g.fillRect(x, y, w, h);
    }
    g.fillStyle = '#cfc9ba'; g.fillRect(0, S / 2 - 3, S, 3); g.fillRect(0, S - 3, S, 3);
  }, 7);
  tex.anisotropy = 2;
  lowMats = {
    wall: new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  return lowMats;
}
const PLASTER = ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4', '#cfc3ab', '#d9c9a8'].map(c => new THREE.Color(c));
const ROOFS = ['#b4aa9c', '#a69d90', '#bdb4a4', '#9d958a'].map(c => new THREE.Color(c)), TERRACOTTA = new THREE.Color('#a8654c');

export function createWorld({ scene, camera, renderer, ctx, walls2d, streets, roadVerts, DRIVABLE, context }) {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const tiles = new Map(), cache = new Map(); // tiles: nk -> Tile; cache: parsed JSON of tiles that are not resident (LRU by insertion)
  const wallGrid = new SegGrid(16), nameGrid = new SegGrid(30);
  walls2d.ext = wallGrid; streets.ext = nameGrid;
  let M = null, farM = () => 0, world = null;
  let tasks = [], pending = [], inflight = 0;
  let focus = { x: 0, z: 0 }, lastWanted = { x: 1e9, z: 1e9 }, wantedTimer = 0, forced = null;
  const stat = { frames: 0, work: 0, workMax: 0, workSum: 0, hitches: 0, fetched: 0, bytes: 0, built: 0, errors: 0, parseMax: 0 };

  // ---------- manifest and far terrain ----------
  const far = { chunks: new Map(), hidden: new Set() };
  const url = p => new URL(CFG.base + p, document.baseURI).href;

  fetch(url('manifest.json')).then(r => r.json()).then(m => {
    M = m;
    farM = gridSampler(M.far);
    hooks.bounds = [M.bbox[0], M.bbox[1], M.bbox[2], M.bbox[3]];
    hooks.ground = tileGround;
    buildFar();
    // warm the facade atlas in slices while the first tiles download
    const warm = warmBuildings(); tasks.push({ t: { d: -1 }, gen: warm, wait: null, name: 'atlas' });
    wantedTimer = 99;
    world.manifest = M;
  }).catch(e => console.error('[world] manifest failed', e));

  // ground: loaded tile near grid, else the manifest far grid; the centro keeps its baked grid until its tile is in
  let lastG = null;
  function tileGround(x, z) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastG;
    if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined || t.dead) { t = null; } else lastG = t; }
    if (t !== null) return t.nearS ? t.nearS(x, z) : (t.data || t.lod ? farM(x, z) : (inNear(x, z) ? undefined : farM(x, z)));
    return inNear(x, z) ? undefined : farM(x, z);
  }

  function buildFar() {
    const F = M.far, h = Float32Array.from(F.h), s = F.s;
    const CELLS = 40; // 8 tiles; tile edges land on cell edges because the grid origin and step are multiples of 100 m
    const H = (i, j) => h[Math.min(F.nz - 1, Math.max(0, j)) * F.nx + Math.min(F.nx - 1, Math.max(0, i))];
    const cs = Math.floor(F.x0 / (CELLS * s)), ce = Math.floor((F.x0 + (F.nx - 1) * s) / (CELLS * s));
    const rs = Math.floor(F.z0 / (CELLS * s)), re = Math.floor((F.z0 + (F.nz - 1) * s) / (CELLS * s));
    const mat = getLowMats().terrain;
    for (let a = cs; a <= ce; a++) for (let b = rs; b <= re; b++) {
      const ci0 = Math.max(0, Math.round((a * CELLS * s - F.x0) / s)), ci1 = Math.min(F.nx - 1, Math.round(((a + 1) * CELLS * s - F.x0) / s));
      const cj0 = Math.max(0, Math.round((b * CELLS * s - F.z0) / s)), cj1 = Math.min(F.nz - 1, Math.round(((b + 1) * CELLS * s - F.z0) / s));
      const vx = ci1 - ci0 + 1, vz = cj1 - cj0 + 1; if (vx < 2 || vz < 2) continue;
      const pos = new Float32Array(vx * vz * 3), nor = new Float32Array(vx * vz * 3), col = new Float32Array(vx * vz * 3);
      for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
        const gi = ci0 + i, gj = cj0 + j, k = (j * vx + i) * 3, y = H(gi, gj);
        pos[k] = F.x0 + gi * s; pos[k + 1] = y - 0.6; pos[k + 2] = F.z0 + gj * s;
        const dx = (H(gi + 1, gj) - H(gi - 1, gj)) / (2 * s), dz = (H(gi, gj + 1) - H(gi, gj - 1)) / (2 * s), l = Math.hypot(dx, 1, dz);
        nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        const noise = (Math.sin(gi * 1.7 + gj * 0.9) + Math.sin(gi * 0.37 - gj * 1.3)) * 0.25 + 0.5;
        terrainColor(_c, y, Math.hypot(dx, dz), noise); col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
      }
      const idx = new Uint16Array((vx - 1) * (vz - 1) * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(F.x0 + (ci0 + ci1) / 2 * s, 100, F.z0 + (cj0 + cj1) / 2 * s), Math.hypot(vx, vz) * s * 0.75 + 800);
      const mesh = new THREE.Mesh(geo, mat); mesh.name = 'far_' + a + '_' + b; mesh.receiveShadow = true;
      root.add(mesh);
      far.chunks.set(a * 1000 + b, { mesh, idx, ci0, cj0, vx, vz, dirty: true });
    }
    farUpdate();
  }
  function farUpdate() {
    if (!M) return;
    const F = M.far, s = F.s;
    for (const c of far.chunks.values()) {
      if (!c.dirty) continue;
      c.dirty = false;
      let n = 0; const idx = c.idx;
      for (let j = 0; j < c.vz - 1; j++) for (let i = 0; i < c.vx - 1; i++) {
        const x = F.x0 + (c.ci0 + i) * s, z = F.z0 + (c.cj0 + j) * s;
        if (far.hidden.has(nk(Math.floor(x / T), Math.floor(z / T)))) continue;
        const k = j * c.vx + i;
        idx[n++] = k; idx[n++] = k + c.vx; idx[n++] = k + 1; idx[n++] = k + 1; idx[n++] = k + c.vx; idx[n++] = k + c.vx + 1;
      }
      c.mesh.geometry.setDrawRange(0, n);
      c.mesh.geometry.index.needsUpdate = true;
      c.mesh.visible = n > 0;
    }
  }
  function farHole(t, on) {
    const k = nk(t.i, t.j);
    if (on === far.hidden.has(k)) return;
    on ? far.hidden.add(k) : far.hidden.delete(k);
    const c = far.chunks.get(Math.floor(t.i / 8) * 1000 + Math.floor(t.j / 8)); if (c) c.dirty = true;
  }

  // ---------- tiles ----------
  function getTile(i, j) {
    const k = nk(i, j); let t = tiles.get(k);
    if (!t) {
      t = { i, j, k, id: i + '_' + j, cx: (i + 0.5) * T, cz: (j + 0.5) * T, meta: M.tiles[i + '_' + j], want: 0, lod: 0, d: 1e9, data: null, nearS: null, parts: {}, tris: {}, task: null,
        fetchP: null, fetchRes: null, failed: false, hasFull: false, raised: null, tint: null, dead: false, urban: 0 };
      tiles.set(k, t);
    }
    return t;
  }
  const estimate = (t, lod) => {
    const b = t.meta ? t.meta.b : 0;
    const have = (n, f) => t.tris[n] !== undefined ? t.tris[n] : f;
    if (lod === 0) return 0;
    const low = have('terrain', 5000) + have('streets', 3000 + b * 12) + have('bldLow', b * 28);
    return lod === 1 ? low : low - have('bldLow', b * 28) + have('streetsHi', 3000 + b * 30) + have('bldFull', b * 420);
  };
  const triCount = t => { let n = 0; for (const k in t.tris) n += t.tris[k]; return n; };

  function disposeObj(o) {
    o.removeFromParent();
    o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  }
  function setPart(t, name, obj, tris) {
    const old = t.parts[name];
    if (old) disposeObj(old);
    if (obj) { t.parts[name] = obj; t.tris[name] = tris !== undefined ? tris : (obj.userData.tris || 0); root.add(obj); }
    else { delete t.parts[name]; delete t.tris[name]; }
    if (name === 'terrain') farHole(t, !!obj);
    contextDirty = true;
  }

  // ---------- terrain mesh of a tile ----------
  function* terrainMesh(t, stride) {
    const useNear = !!t.nearS, step = (useNear ? 10 : 25) * stride, n = Math.round(T / step) + 1;
    const x0 = t.i * T, z0 = t.j * T, g = groundY;
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    const tint = t.tint, urban = t.urban;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step, z = z0 + j * step, y = g(x, z), k = (j * n + i) * 3;
        const e = step;
        const dx = (g(x + e, z) - g(x - e, z)) / (2 * e), dz = (g(x, z + e) - g(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
        pos[k] = x; pos[k + 1] = y - 0.2; pos[k + 2] = z; nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        const noise = (Math.sin(x * 0.013 + z * 0.009) + Math.sin(x * 0.0037 - z * 0.013)) * 0.25 + 0.5;
        terrainColor(_c, y, Math.hypot(dx, dz), noise);
        if (urban > 0) _c.lerp(C.urban, urban);
        if (tint) for (const a of tint) {
          if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 || !inPoly(a.pts, x, z)) continue;
          _c.lerp(a.col, 0.85); break;
        }
        col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
      }
      if ((j & 7) === 7) yield;
    }
    // skirt: drop the border so cracks against neighbours (lidar vs coarse far grid) stay hidden
    const sk = [], at = (i, j) => (j * n + i);
    for (let i = 0; i < n; i++) { sk.push(at(i, 0), at(i, n - 1), at(0, i), at(n - 1, i)); }
    const nb = n * n, total = nb + sk.length;
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), Cc = new Float32Array(total * 3);
    P.set(pos); N.set(nor); Cc.set(col);
    sk.forEach((v, q) => { const a = v * 3, b = (nb + q) * 3; P[b] = pos[a]; P[b + 1] = pos[a + 1] - 8; P[b + 2] = pos[a + 2]; N[b] = nor[a]; N[b + 1] = nor[a + 1]; N[b + 2] = nor[a + 2]; Cc[b] = col[a]; Cc[b + 1] = col[a + 1]; Cc[b + 2] = col[a + 2]; });
    const idx = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const k = j * n + i; idx.push(k, k + n, k + 1, k + 1, k + n, k + n + 1); }
    // skirt quads, one strip per side (double-sided material, so winding does not matter)
    for (let i = 0; i < n - 1; i++) {
      const s0 = nb + i * 4, s1 = nb + (i + 1) * 4;
      for (let side = 0; side < 4; side++) { const a = sk[i * 4 + side], b = sk[(i + 1) * 4 + side], sa = s0 + side, sb = s1 + side; idx.push(a, b, sa, b, sb, sa); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    geo.setIndex(new THREE.BufferAttribute(total < 65536 ? new Uint16Array(idx) : new Uint32Array(idx), 1));
    const m = new THREE.Mesh(geo, getLowMats().terrain); m.receiveShadow = true; m.name = 'terrain_' + t.id;
    m.userData.tris = idx.length / 3;
    return m;
  }

  // ---------- low-detail buildings: plain extrusions ----------
  function* lowBuildings(t) {
    const d = t.data, skip = ctx.skip;
    const wp = [], wn = [], wc = [], wu = [], wi = [], rp = [], rn = [], rc = [], ri = [];
    let nb = 0, wv = 0, rv = 0;
    const solids = [];
    for (const b of d.buildings) {
      if (skip.has(b.id)) continue;
      if ((++nb & 15) === 0) yield;
      solids.length = 0;
      if (b.r === undefined) solids.push([b.p, null]);
      else if (!b.split) solids.push([b.p, b.r + (d.near ? 0 : -b.g)]);
      else for (const [poly, rr] of b.parts || []) solids.push([poly, rr + (d.near ? 0 : -b.g)]);
      for (const [flat, roofAbs] of solids) {
        const pts = pairs(flat); if (pts.length < 3) continue;
        let area = signedArea(pts); if (Math.abs(area) < 12) continue;
        if (area < 0) pts.reverse();
        const gs = pts.map(p => groundY(p[0], p[1]));
        let gmax = -1e9, gmin = 1e9; for (const y of gs) { gmax = Math.max(gmax, y); gmin = Math.min(gmin, y); }
        const roof = Math.max(roofAbs === null ? gmax + b.h : roofAbs, gmax + 2.5);
        const col = PLASTER[b.c % PLASTER.length], v = 0.92 + ((b.c >> 4) % 9) * 0.02;
        let acc = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], bb = pts[(i + 1) % pts.length], dx = bb[0] - a[0], dz = bb[1] - a[1], len = Math.hypot(dx, dz);
          if (len < 0.3) continue;
          const nx = dz / len, nz = -dx / len, ya = gs[i] - 0.6, yb = gs[(i + 1) % pts.length] - 0.6, base = Math.min(ya, yb);
          const u0 = acc / 7.2, u1 = (acc + len) / 7.2, v0a = (ya - base) / 6.6, v0b = (yb - base) / 6.6, vt = (roof - base) / 6.6;
          wp.push(a[0], ya, a[1], bb[0], yb, bb[1], bb[0], roof, bb[1], a[0], roof, a[1]);
          for (let q = 0; q < 4; q++) { wn.push(nx, 0, nz); wc.push(col.r * v, col.g * v, col.b * v); }
          wu.push(u0, v0a, u1, v0b, u1, vt, u0, vt);
          wi.push(wv, wv + 2, wv + 1, wv, wv + 3, wv + 2); wv += 4;
          acc += len;
        }
        try {
          const contour = pts.map(p => new THREE.Vector2(p[0], p[1])), tris = THREE.ShapeUtils.triangulateShape(contour, []);
          const rcol = (roof - gmin < 9 && (b.c & 3) === 0) ? TERRACOTTA : ROOFS[b.c % ROOFS.length];
          for (const tr of tris) {
            let [a, bq, c] = tr.map(i => pts[i]);
            if ((bq[1] - a[1]) * (c[0] - a[0]) - (bq[0] - a[0]) * (c[1] - a[1]) < 0) [bq, c] = [c, bq];
            for (const p of [a, bq, c]) { rp.push(p[0], roof, p[1]); rn.push(0, 1, 0); rc.push(rcol.r * v, rcol.g * v, rcol.b * v); ri.push(rv++); }
          }
        } catch (e) { /* skip broken ring */ }
      }
    }
    const g = new THREE.Group();
    const mk = (P, N, Cc, U, I, mat, name) => {
      if (!I.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3));
      if (U) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U), 2));
      geo.setIndex(new THREE.BufferAttribute(P.length / 3 < 65536 ? new Uint16Array(I) : new Uint32Array(I), 1));
      const m = new THREE.Mesh(geo, mat); m.name = name; m.matrixAutoUpdate = false;
      g.add(m);
    };
    mk(wp, wn, wc, wu, wi, getLowMats().wall, 'low_walls');
    yield;
    mk(rp, rn, rc, null, ri, getLowMats().roof, 'low_roofs');
    g.userData.tris = (wi.length + ri.length) / 3;
    return g;
  }

  // ---------- physics: wall segments, street names, road vertices (full-detail tiles only) ----------
  function* registerPhysics(t) {
    const d = t.data; let n = 0;
    const addRing = flat => {
      const p = pairs(flat);
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; wallGrid.addSeg(t.k, [a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
    };
    for (const b of d.buildings) { addRing(b.p); if (b.holes) b.holes.forEach(addRing); if ((++n & 63) === 0) yield; }
    for (const r of d.roads) {
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (r.n) nameGrid.addSeg(t.k, [a[0], a[1], b[0], b[1], r.n, r.w], a[0], a[1], b[0], b[1]);
        if (DRIVABLE.has(r.k)) { const v = [a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])]; v.t = t.k; roadVerts.push(v); }
      }
    }
    t.phys = true;
  }
  function unregisterPhysics(t) {
    if (!t.phys) return;
    wallGrid.removeTile(t.k); nameGrid.removeTile(t.k);
    let w = 0; for (let r = 0; r < roadVerts.length; r++) if (roadVerts[r].t !== t.k) roadVerts[w++] = roadVerts[r];
    roadVerts.length = w;
    t.phys = false;
  }

  // ---------- raised-ground mask (sidewalks and grass the car bumps up onto), 0.5 m cells, bit-packed ----------
  const RK = 2, RW = T * RK, BAND = 250;
  let rcv = null, rg = null;
  function* buildRaised(t) {
    const st = t.data.streets, polys = [...(st.raised || []), ...(st.green || [])];
    if (!polys.length) { t.raised = null; return; }
    if (!rcv) { rcv = document.createElement('canvas'); rcv.width = RW; rcv.height = BAND; rg = rcv.getContext('2d', { willReadFrequently: true }); }
    const bits = new Uint8Array(RW * RW / 8), x0 = t.i * T, z0 = t.j * T;
    // bounding boxes in canvas rows, so each band only draws the polygons that touch it
    const info = polys.map(poly => { let lo = 1e9, hi = -1e9; const r0 = poly[0]; for (let i = 1; i < r0.length; i += 2) { lo = Math.min(lo, r0[i]); hi = Math.max(hi, r0[i]); } return { poly, lo: (lo - z0) * RK, hi: (hi - z0) * RK }; });
    for (let band = 0; band < RW / BAND; band++) {
      const y0 = band * BAND;
      rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, RW, BAND); rg.fillStyle = '#fff';
      for (const { poly, lo, hi } of info) {
        if (hi < y0 || lo > y0 + BAND) continue;
        rg.beginPath();
        for (const ring of poly) for (let i = 0; i < ring.length; i += 2) rg[i ? 'lineTo' : 'moveTo']((ring[i] - x0) * RK, (ring[i + 1] - z0) * RK - y0);
        rg.fill('evenodd');
      }
      const px = rg.getImageData(0, 0, RW, BAND).data, base = band * BAND * RW;
      for (let q = 0, n = RW * BAND; q < n; q++) if (px[q * 4 + 3] > 127) { const b = base + q; bits[b >> 3] |= 1 << (b & 7); }
      yield;
    }
    t.raised = bits;
  }
  let lastR = null;
  function raised(x, z) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastR;
    if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined) return false; lastR = t; }
    const bits = t.raised; if (bits === null) return false;
    const b = (((z - j * T) * RK) | 0) * RW + (((x - i * T) * RK) | 0);
    return (bits[b >> 3] >> (b & 7) & 1) === 1;
  }

  // ---------- fetching ----------
  function fetchTile(t) {
    if (t.fetchP) return t.fetchP;
    t.fetchP = new Promise(res => { t.fetchRes = res; });
    pending.push(t);
    return t.fetchP;
  }
  function pump() {
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].want === 0) { const t = pending[i]; pending.splice(i, 1); t.fetchP = null; t.fetchRes(); }
    while (inflight < CFG.conc && pending.length) {
      let bi = 0; for (let i = 1; i < pending.length; i++) if (pending[i].d < pending[bi].d) bi = i;
      const t = pending.splice(bi, 1)[0]; inflight++;
      fetch(url('tiles/' + t.id + '.json')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(txt => {
        const p0 = performance.now(); stat.bytes += txt.length;
        const d = JSON.parse(txt); stat.parseMax = Math.max(stat.parseMax, performance.now() - p0);
        t.data = d; stat.fetched++;
        if (d.near) t.nearS = gridSampler(d.near);
        prepareTile(t);
      }).catch(e => { t.failed = true; stat.errors++; console.warn('[world] tile', t.id, e); })
        .finally(() => { inflight--; t.fetchP = null; t.fetchRes(); pump(); });
    }
  }
  function prepareTile(t) {
    const d = t.data;
    t.urban = Math.min(1, (d.buildings.length) / 160) * 0.8;
    const kinds = { forest: C.forest, green: C.green, sand: C.beach };
    t.tint = (d.areas || []).filter(a => kinds[a.k]).map(a => {
      const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { pts, x0, z0, x1, z1, col: kinds[a.k] };
    });
  }
  function* ensureData(t) {
    if (t.data) return true;
    const c = cache.get(t.k);
    if (c) { cache.delete(t.k); t.data = c; return true; }
    if (t.failed) return false;
    yield fetchTile(t);
    return !!t.data;
  }
  function stash(t) { // park the parsed tile in the LRU instead of holding it
    if (!t.data) return;
    cache.delete(t.k); cache.set(t.k, t.data); t.data = null;
    while (cache.size > CFG.keepData) cache.delete(cache.keys().next().value);
  }

  // ---------- LOD stages ----------
  function* buildLow(t) {
    if (t.want === 0) return;
    setPart(t, 'terrain', yield* terrainMesh(t, 2));
    yield;
    const g = new THREE.Group();
    yield* streetsIter(t.data.streets, g, { layers: ['asphalt', 'paving', 'sand', 'water'], curbs: false, offset: true, drape: 18 });
    if (t.want === 0) { disposeObj(g); return; }
    setPart(t, 'streets', g);
    const low = yield* lowBuildings(t);
    if (t.want === 0) { disposeObj(low); return; }
    setPart(t, 'bldLow', low);
    t.lod = 1; stat.built++;
  }
  function* buildFull(t) {
    t.hasFull = true;
    yield* registerPhysics(t);
    if (t.want < 2) return;
    yield* buildRaised(t);
    if (t.want < 2) return;
    setPart(t, 'terrain', yield* terrainMesh(t, 1));
    yield;
    const g = new THREE.Group();
    yield* streetsIter(t.data.streets, g, { layers: ['raised', 'green'], curbs: true, offset: true, drape: 9 });
    if (t.want < 2) { disposeObj(g); return; }
    setPart(t, 'streetsHi', g);
    const bg = new THREE.Group();
    yield* buildBuildingsIter(ctx, t.data, bg);
    if (t.want < 2) { disposeObj(bg); return; }
    setPart(t, 'bldFull', bg);
    setPart(t, 'bldLow', null);
    t.lod = 2;
  }
  function* downgrade(t) {
    setPart(t, 'bldFull', null); setPart(t, 'streetsHi', null);
    unregisterPhysics(t); t.raised = null; t.hasFull = false;
    if (t.lod === 2 || !t.parts.bldLow) {
      if (yield* ensureData(t)) {
        if (!t.parts.bldLow) setPart(t, 'bldLow', yield* lowBuildings(t));
        setPart(t, 'terrain', yield* terrainMesh(t, 2));
      }
    }
    t.lod = 1;
    stash(t);
  }
  function release(t) {
    for (const n of Object.keys(t.parts)) setPart(t, n, null);
    unregisterPhysics(t); t.raised = null;
    stash(t);
    t.dead = true; t.nearS = null; t.lod = 0; t.hasFull = false;
    tiles.delete(t.k);
    if (lastG === t) lastG = null; if (lastR === t) lastR = null;
    farHole(t, false);
    contextDirty = true;
  }
  function* process(t) {
    for (;;) {
      const want = t.want;
      if (want === 0) { release(t); return; }
      if (t.lod === want && !(want === 1 && t.hasFull)) { if (want === 1) stash(t); return; }
      if (!(yield* ensureData(t))) { if (t.want === 0) continue; return; }
      if (t.want !== want) continue;
      if (t.lod === 0) { yield* buildLow(t); continue; }
      if (want === 2 && t.lod < 2) { yield* buildFull(t); continue; }
      if (want === 1 && (t.lod === 2 || t.hasFull)) { yield* downgrade(t); continue; }
      return;
    }
  }

  // ---------- which tile wants which lod ----------
  function rectDist(x, z, t) {
    const x0 = t.i * T, z0 = t.j * T, dx = Math.max(x0 - x, 0, x - (x0 + T)), dz = Math.max(z0 - z, 0, z - (z0 + T));
    return Math.hypot(dx, dz);
  }
  function updateWanted(fx, fz) {
    const R = Math.ceil((CFG.rLow + CFG.hyst) / T) + 1, ci = Math.floor(fx / T), cj = Math.floor(fz / T);
    const list = [];
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      if (!M.tiles[i + '_' + j]) continue;
      const t = getTile(i, j); t.d = rectDist(fx, fz, t); list.push(t);
    }
    list.sort((a, b) => a.d - b.d);
    const inList = new Set(list);
    for (const t of tiles.values()) if (!inList.has(t)) { t.want = 0; t.d = rectDist(fx, fz, t); }
    let est = 0;
    for (const t of list) {
      let w = t.d < CFG.rFull + (t.lod === 2 ? CFG.hyst : 0) ? 2 : t.d < CFG.rLow + (t.lod >= 1 ? CFG.hyst : 0) ? 1 : 0;
      // hard cap on resident triangles: demote what does not fit (nearest tiles claim their budget first)
      while (w > 0 && est + estimate(t, w) > CFG.triCap) w--;
      est += estimate(t, w);
      t.want = w;
    }
    for (const t of tiles.values()) ensureTask(t);
    pump();
    world.estTris = est;
  }
  function ensureTask(t) {
    if (t.task || t.dead) return;
    if (t.want === t.lod && !(t.want === 1 && t.hasFull) && t.want !== 0) { if (t.want === 1 && t.data) stash(t); return; }
    if (t.want === 0 && t.lod === 0 && !Object.keys(t.parts).length && !t.data && !t.nearS) { t.dead = true; tiles.delete(t.k); return; }
    if (t.failed && t.want > 0 && !t.data && !cache.has(t.k)) return;
    const task = { t, gen: process(t), wait: null, name: t.id };
    t.task = task; tasks.push(task);
  }

  // ---------- scheduler ----------
  function runTasks(budget) {
    const t0 = performance.now();
    tasks.sort((a, b) => a.t.d - b.t.d);
    for (const k of tasks) {
      if (k.wait || k.done) continue;
      while (performance.now() - t0 < budget) {
        let r;
        try { r = k.gen.next(); } catch (e) { console.error('[world] task', k.name, e); r = { done: true }; if (k.t.id) { k.t.failed = true; k.t.want = 0; } }
        if (r.done) { k.done = true; if (k.t.id) k.t.task = null; break; }
        if (r.value && typeof r.value.then === 'function') { k.wait = r.value; r.value.then(() => { k.wait = null; }, () => { k.wait = null; }); break; }
      }
      if (performance.now() - t0 >= budget) break;
    }
    if (tasks.some(k => k.done)) tasks = tasks.filter(k => !k.done);
  }

  // ---------- context city (src/context.js): hide its chunks wherever real tiles are standing ----------
  let contextDirty = false;
  const ctxMeshes = [];
  if (context) context.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new THREE.Vector3());
    ctxMeshes.push({ o, x: c.x, z: c.z });
  });
  function refreshContext() {
    contextDirty = false;
    for (const m of ctxMeshes) {
      const t = tiles.get(nk(Math.floor(m.x / T), Math.floor(m.z / T)));
      m.o.visible = !(t && (t.parts.bldLow || t.parts.bldFull));
    }
  }

  // ---------- public ----------
  let binding = null, tele = null;
  world = {
    manifest: null,
    estTris: 0,
    raised,
    bind(b) { binding = b; applyAt(); },
    // Move the player somewhere far: stream the destination in first, then place the car (placeAt snaps to the nearest road vertex).
    teleport(x, z, done) { tele = { x, z, done }; wantedTimer = 99; },
    update(dt, cam) {
      if (!M) { if (tasks.length) runTasks(CFG.budgetMs); return; }
      const t0 = performance.now();
      const f = tele || cam.position;
      focus.x = f.x; focus.z = f.z;
      wantedTimer += dt;
      if (wantedTimer > 0.5 || Math.hypot(focus.x - lastWanted.x, focus.z - lastWanted.z) > 30) {
        wantedTimer = 0; lastWanted.x = focus.x; lastWanted.z = focus.z;
        updateWanted(focus.x, focus.z);
      }
      pump();
      runTasks(CFG.budgetMs);
      for (const t of tiles.values()) if (!t.task && !t.dead) ensureTask(t);
      if (tele) {
        const t = tiles.get(nk(Math.floor(tele.x / T), Math.floor(tele.z / T)));
        if (t && t.lod === 2) { const d = tele.done; tele = null; d && d(); }
      }
      farUpdate();
      if (contextDirty) refreshContext();
      const w = performance.now() - t0;
      stat.frames++; stat.work = w; stat.workSum += w; if (w > stat.workMax) stat.workMax = w; if (w > 8) stat.hitches++;
      if (overlay) overlayUpdate(dt);
    },
    stats() {
      const by = [0, 0, 0]; let tris = 0, bld = 0;
      for (const t of tiles.values()) { by[t.lod]++; tris += triCount(t); }
      return { tiles: tiles.size, lod0: by[0], lod1: by[1], lod2: by[2], tris, estTris: world.estTris, queued: tasks.length, pending: pending.length, inflight, cache: cache.size,
        walls: wallGrid.m.size, roadVerts: roadVerts.length, ...stat, avgWork: stat.workSum / Math.max(1, stat.frames), kbFetched: Math.round(stat.bytes / 1024),
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        drawCalls: renderer.info.render.calls, rendTris: renderer.info.render.triangles };
    },
    resetStats() { stat.frames = 0; stat.workSum = 0; stat.workMax = 0; stat.hitches = 0; },
    tiles, cfg: CFG,
  };

  // ?at=x,z puts the car somewhere once the world around it has streamed in
  function applyAt() {
    const at = Q.get('at'); if (!at || !binding) return;
    const [x, z] = at.split(',').map(Number);
    if (M) world.teleport(x, z, () => binding.placeAt(x, z)); else setTimeout(applyAt, 200);
  }

  // ?wstats overlay
  let overlay = null, ot = 0;
  if (Q.has('wstats')) { overlay = document.createElement('pre'); overlay.style.cssText = 'position:fixed;left:6px;bottom:6px;margin:0;z-index:50;color:#fff;background:rgba(0,0,0,.55);font:11px monospace;padding:4px 6px;pointer-events:none'; document.body.appendChild(overlay); }
  function overlayUpdate(dt) {
    if ((ot += dt) < 0.5) return; ot = 0;
    const s = world.stats();
    overlay.textContent = `tiles ${s.lod2}/${s.lod1}/${s.lod0}  tris ${(s.tris / 1e3) | 0}k  queue ${s.queued}  net ${s.inflight}+${s.pending}\nwork ${s.work.toFixed(1)}ms max ${s.workMax.toFixed(1)}  heap ${s.heapMB ?? '?'}MB`;
  }
  return world;
}
