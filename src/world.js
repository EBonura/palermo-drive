// World streaming (?world=1): the whole of Palermo and Mondello, baked by tools/tiles.py into world/manifest.json and
// world/tiles/i_j.json (500 m tiles, same field names as PALERMO_DATA). Format and plan: docs/TILES.md.
//
// Rings around the camera, per tile ("lod"). One profile for every device (docs/PERF.md): only the render scale follows the screen.
//   2  full detail  (< rFull)  terrain at 10 m, all street layers + curbs, src/buildings.js facades, wall collision, road names,
//                              raised-ground mask for the car
//   1  low detail   (< rLow)   terrain at 20 m, asphalt/paving/sand/water, simple extruded buildings with one plain facade texture
//   0  far city                the far terrain (this file, from the manifest's coarse grid) plus the baked boxes of src/context.js
//                              (assets/world/far.bin, no tile download) out to the fog; tiles with terrain punch a hole in the far
//                              terrain, tiles with buildings hide their boxes. Every tile in range is always covered by one of the three.
// Everything heavy is a generator stepped by a per-frame time budget (update()), nearest tile first, so streaming never
// hitches; fetches are limited to a few at a time, nearest first; parsed tiles that leave the radius sit in a small LRU;
// a budget of resident triangles decides who gets what (updateWanted): the tile under the car first, then low detail everywhere in
// its ring, then full detail nearest first. Geometry is disposed when parts go; materials are shared.
// Build order and readiness follow the camera (markView): tiles the camera can see (its frustum plus a margin for turning, and everything
// close) are built before the rest of the ring, and visiblePending() counts what those tiles and the far city chunks in view still need,
// so the loading screen and the start transition lift as soon as the view is complete instead of waiting for the whole ring.
import * as THREE from 'three';
import { D, hooks, groundY, inNear, pairs, signedArea, inPoly, canvasTex } from './core.js';
import { streetsIter, roadMarksIter, TEX as GROUND_TEX } from './streets.js';
import { buildBuildingsIter, warmBuildings } from './buildings.js';
import { applyDistrictHeights } from './districts.js';
import { createFarCity } from './context.js';
import { GARDEN_REGION as GR } from './gardens.js';

const T = 500;
const nk = (i, j) => (i + 200) * 1000 + (j + 200);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- configuration (URL overrides for tuning: rfull, rlow, tricap) ----------
const Q = new URLSearchParams(location.search);
const CFG = {
  rFull: +Q.get('rfull') || 450,
  rLow: +Q.get('rlow') || 1400,
  guard: 150,                             // tiles this close to the camera always get full detail (walls and the raised-ground mask only exist there)
  hyst: 120,
  triCap: +Q.get("tricap") || 1.2e6,
  conc: 3,
  budgetMs: +Q.get('wbudget') || 2,
  hurryMs: +Q.get('whurry') || 12,        // per-frame build budget while a loading screen or the start transition covers the game (world.hurry)
  viewMargin: 80,                         // metres the camera frustum is widened by when deciding what is in view (the car may turn)
  viewNear: 220,                          // tiles this close to the focus count as in view whichever way the camera points
  keepData: 6,
  farFog: 1.25,                           // far boxes are built out to farFog / fog density metres (the fog hides what is beyond)
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
  sand: new THREE.Color('#cdbb92'), plain: new THREE.Color('#b0a58a'), grove: new THREE.Color('#8a8a58'), scrub: new THREE.Color('#686d45'),
  rock: new THREE.Color('#c6c0b2'), rockLo: new THREE.Color('#aaa598'), urban: new THREE.Color('#9c968a'), garden: new THREE.Color('#76854c'), forest: new THREE.Color('#44603a'), green: new THREE.Color('#72844b'),
  beach: new THREE.Color('#e4dbc2'), shore: new THREE.Color('#9d978a'), dry: new THREE.Color('#a79d6c'),
  farm: new THREE.Color('#a8985f'), orchard: new THREE.Color('#6f8148'), cemetery: new THREE.Color('#98987a'), rail: new THREE.Color('#8c877c'),
  dirt: new THREE.Color('#a8967a'), pitch: new THREE.Color('#6d9b4f'),
};
// OSM land cover (tools/tiles.py areas[].k) that tints the terrain: colour, strength and priority (first match wins, lower = stronger claim)
const COVER = {
  sand: [C.beach, 0.92, 0], pitch: [C.pitch, 0.9, 1], rock: [C.rock, 0.9, 2], forest: [C.forest, 0.85, 3], orchard: [C.orchard, 0.8, 4],
  green: [C.green, 0.85, 5], scrub: [C.scrub, 0.85, 6], cemetery: [C.cemetery, 0.7, 7], farm: [C.farm, 0.8, 8], dirt: [C.dirt, 0.85, 9],
  rail: [C.rail, 0.8, 10], grass: [C.dry, 0.8, 11],
};
const _c = new THREE.Color(), _r = new THREE.Color(), HAZE = new THREE.Color('#7297b4');
// h: ground height (m), slope: |gradient|, noise 0..1 (low frequency), n2 0..1 (a second, finer pattern)
function terrainColor(out, h, slope, noise, n2 = 0.5) {
  if (h < 1.6) { out.copy(C.shore).lerp(C.sand, 0.25 * noise); return out; } // rocky or built-up shore; beaches are OSM sand polygons
  const hill = smooth(55, 130, h), steep = smooth(0.14, 0.4, slope);
  // lowland: dry grass, straw and olive-green patches; hills: dark olive scrub with dry tan clearings
  out.copy(C.plain).lerp(C.grove, noise * 0.55).lerp(C.dry, n2 * 0.35);
  _r.copy(C.scrub).lerp(C.dry, n2 * 0.4).lerp(C.grove, noise * 0.2);
  out.lerp(_r, Math.max(hill, steep * 0.8));
  // limestone: grey-ochre, paler on the high ledges, with faint strata bands
  const rock = smooth(0.38, 0.85, slope);
  if (rock > 0) {
    _r.copy(C.rockLo).lerp(C.rock, Math.min(1, 0.35 + noise * 0.5 + smooth(120, 420, h) * 0.3)).multiplyScalar(0.94 + 0.06 * Math.sin(h * 0.9));
    out.lerp(_r, rock);
  }
  return out;
}

// Terrain detail texture, triplanar on steep faces: the world-space (x, z) UVs smear along the fall line on cliffs (Monte Pellegrino), so
// once the slope passes ~45 degrees the detail is also projected on the x/y and z/y planes and blended in by the normal.
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: GROUND_TEX.terrain, vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  const k = (1 / GROUND_TEX.terrain.metres).toFixed(6);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTpPos; varying vec3 vTpNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTpPos = position; vTpNrm = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTpPos; varying vec3 vTpNrm;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        { float ny = abs( normalize( vTpNrm ).y ), side = 1.0 - smoothstep( 0.55, 0.85, ny );
          if ( side > 0.002 ) {
            vec3 an = abs( normalize( vTpNrm ) );
            vec4 tx = texture2D( map, vec2( vTpPos.z, vTpPos.y ) * ${k} ), tz = texture2D( map, vec2( vTpPos.x, vTpPos.y ) * ${k} );
            sampledDiffuseColor = mix( sampledDiffuseColor, mix( tz, tx, an.x / ( an.x + an.z + 1e-4 ) ), side );
          } }
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  m.customProgramCacheKey = () => 'terrain-triplanar';
  return m;
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
    terrain: terrainMaterial(),
    far: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), // the coarse far grid has no uvs
  };
  return lowMats;
}
const PLASTER = ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4', '#cfc3ab', '#d9c9a8'].map(c => new THREE.Color(c));
const ROOFS = ['#b4aa9c', '#a69d90', '#bdb4a4', '#9d958a'].map(c => new THREE.Color(c)), TERRACOTTA = new THREE.Color('#a8654c');

export function createWorld({ scene, camera, renderer, ctx, walls2d, streets, roadVerts, DRIVABLE }) {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const tiles = new Map(), cache = new Map(); // tiles: nk -> Tile; cache: parsed JSON of tiles that are not resident (LRU by insertion)
  const wallGrid = new SegGrid(16), nameGrid = new SegGrid(30);
  walls2d.ext = wallGrid; streets.ext = nameGrid;
  let M = null, farM = () => 0, world = null, landPoly = null, farCity = null, farTask = null, wantedOnce = false, visPending = 1, farMissing = 0;
  let tasks = [], pending = [], inflight = 0;
  // City landmarks (src/landmarks-city.js, written by the landmarks work): CITY_LANDMARKS = [{ name, x, z, radius, skipIds, build(ctx) -> Object3D }].
  // Instantiated with the full-detail tile that contains (x, z), their skipIds left out of that tile's generic buildings, disposed with the tile.
  // per-tile hooks for the modules that live on full-detail tiles (traffic, pedestrians, props, road wear, minimap):
  // fn('full', t) once a tile is at full detail (t.i, t.j, t.k, t.data), fn('drop', t) just before it leaves full detail
  const tileFns = new Set(), fullSet = new Set();
  const emit = (kind, t) => { if (kind === 'full') { if (fullSet.has(t)) return; fullSet.add(t); } else if (!fullSet.delete(t)) return; for (const f of tileFns) { try { f(kind, t); } catch (e) { console.error('[world] tile hook', e); } } };
  let CITY = [];
  import('./landmarks-city.js').then(m => { CITY = m.CITY_LANDMARKS || []; }).catch(e => console.warn('city landmarks', e));
  const cityIn = t => CITY.filter(l => Math.floor(l.x / T) === t.i && Math.floor(l.z / T) === t.j);
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
    { const pts = pairs(M.land); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      landPoly = { pts, x0, z0, x1, z1, islands: (M.islands || []).map(pairs) }; }
    buildFar();
    farCity = createFarCity({ root, F: M.far, T, nk, url: new URL('assets/world/far.bin', document.baseURI).href, mat: getLowMats().roof });
    farCity.load().then(() => { wantedTimer = 99; }); // the budget needs the far triangle counts
    // warm the facade atlas in slices while the first tiles download
    const warm = warmBuildings(); tasks.push({ t: { pd: -1 }, gen: warm, wait: null, name: 'atlas' });
    wantedTimer = 99;
    world.manifest = M;
  }).catch(e => console.error('[world] manifest failed', e));

  // ground: loaded tile near grid, else the manifest far grid; the centro keeps its baked grid until its tile is in
  let lastG = null;
  function tileGround(x, z) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastG;
    if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined || t.dead) { t = null; } else lastG = t; }
    if (t !== null) {
      if (!t.nearS && !(t.data || t.lod)) return inNear(x, z) ? undefined : farM(x, z);
      const g = t.nearS ? t.nearS(x, z) : farM(x, z), sh = t.shape;
      if (sh === null) return g;
      // road-following terrain shaping (see computeShape): pull the ground towards the smoothed road bench inside the corridor
      const fx = (x - sh.x0) / sh.s, fz = (z - sh.z0) / sh.s;
      if (fx < 0 || fz < 0 || fx >= sh.nx - 1 || fz >= sh.nz - 1) return g;
      const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * sh.nx + i, n = sh.nx, W = sh.W, H = sh.WH;
      const w = (W[k] * (1 - tx) + W[k + 1] * tx) * (1 - tz) + (W[k + n] * (1 - tx) + W[k + n + 1] * tx) * tz;
      if (w <= 0) return g;
      const wh = (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + n] * (1 - tx) + H[k + n + 1] * tx) * tz;
      return g * (1 - w) + wh;
    }
    return inNear(x, z) ? undefined : farM(x, z);
  }

  function buildFar() {
    const F = M.far, h = Float32Array.from(F.h), s = F.s;
    const CELLS = 40; // 8 tiles; tile edges land on cell edges because the grid origin and step are multiples of 100 m
    const H = (i, j) => h[Math.min(F.nz - 1, Math.max(0, j)) * F.nx + Math.min(F.nx - 1, Math.max(0, i))];
    const cs = Math.floor(F.x0 / (CELLS * s)), ce = Math.floor((F.x0 + (F.nx - 1) * s) / (CELLS * s));
    const rs = Math.floor(F.z0 / (CELLS * s)), re = Math.floor((F.z0 + (F.nz - 1) * s) / (CELLS * s));
    const mat = getLowMats().far;
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
        terrainColor(_c, y, Math.hypot(dx, dz), noise);
        if (y > 2) _c.lerp(HAZE, y > 90 ? 0.3 : 0.1); // distant hills read hazed blue (style guide section 6); the scene fog does the rest
        col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
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
        fetchP: null, fetchRes: null, failed: false, hasFull: false, vis: false, pd: 1e9, top: -1, raised: null, hard: undefined, shape: null, shaped: false, tint: null, dead: false, urban: 0 };
      tiles.set(k, t);
    }
    return t;
  }
  // Before a part is built its triangles are guessed from the manifest's building count (calibrated on the centro tiles); once built, the real number is used.
  const estimate = (t, lod) => {
    const b = t.meta ? t.meta.b : 0;
    const have = (n, f) => t.tris[n] !== undefined ? t.tris[n] : f;
    if (lod === 0) return farCity ? farCity.tris(t.k) : 0; // the baked boxes the tile shows while it has no buildings of its own
    const low = have('terrain', 1800) + have('streets', 2500 + b * 8) + have('bldLow', b * 45);
    return lod === 1 ? low : have('terrain', 5400) + have('streets', 2500 + b * 8) + have('streetsHi', 8000 + b * 40) + have('trees', 0) + have('bldFull', b * 230);
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
    // cells follow the near grid (5 m where the bake carved a road bench into it, else 10 m), twice as coarse at low detail
    const cell = t.nearStep || (t.shape ? 5 : 25), step = cell * stride, n = Math.round(T / step) + 1;
    const x0 = t.i * T, z0 = t.j * T, g = groundY;
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    const tint = t.tint, urban = t.urban, UVS = 1 / GROUND_TEX.terrain.metres;
    // Low detail cells cannot follow a road bench: on a steep hillside a coarse cell would cover the road for hundreds of metres (the
    // owner saw hidden roads under Monte Pellegrino). On benched tiles each low detail vertex drops to the lowest ground within 5 m,
    // so the terrain never rises above a road beside it; the notch this leaves is far below what is visible at that distance.
    const lowEnv = t.benched && stride > 1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step, z = z0 + j * step, k = (j * n + i) * 3;
        let y = g(x, z);
        if (lowEnv) for (let q = 0; q < 8; q++) { const a = q * 0.7853982, m = g(x + Math.cos(a) * 5, z + Math.sin(a) * 5); if (m < y) y = m; }
        const e = step;
        const dx = (g(x + e, z) - g(x - e, z)) / (2 * e), dz = (g(x, z + e) - g(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
        pos[k] = x; pos[k + 1] = y - 0.2; pos[k + 2] = z; nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        const noise = (Math.sin(x * 0.013 + z * 0.009) + Math.sin(x * 0.0037 - z * 0.013)) * 0.25 + 0.5;
        const n2 = (Math.sin(x * 0.061 + z * 0.043) + Math.sin(x * 0.027 - z * 0.071 + 1.7)) * 0.25 + 0.5, slope = Math.hypot(dx, dz);
        terrainColor(_c, y, slope, noise, n2);
        if (urban > 0) _c.lerp(x > GR.x0 && x < GR.x1 && z > GR.z0 && z < GR.z1 ? C.garden : C.urban, urban); // the villa quarters of Mondello read green from afar (src/gardens.js)
        if (tint) for (const a of tint) {
          if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 || !inPoly(a.pts, x, z)) continue;
          _c.lerp(a.col, a.s); // woods, scrub and lawns give way to bare limestone where the ground is steep
          if (a.cover !== 'sand' && slope > 0.45) { _r.copy(C.rockLo).lerp(C.rock, noise); _c.lerp(_r, smooth(0.45, 0.9, slope) * 0.8); }
          break;
        }
        col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
        const q = (j * n + i) * 2; uv[q] = x * UVS; uv[q + 1] = z * UVS;
      }
      if ((j & 1) === 1) yield;
    }
    // skirt: drop the border so cracks against neighbours (lidar vs coarse far grid, a low detail cell next to a full detail one) stay hidden.
    // On a cliff the two meshes of a tile border differ by more than the old 8 m, and the sky showed through as a bright blue sliver.
    const SKIRT = 30;
    const sk = [], at = (i, j) => (j * n + i);
    for (let i = 0; i < n; i++) { sk.push(at(i, 0), at(i, n - 1), at(0, i), at(n - 1, i)); }
    const nb = n * n, total = nb + sk.length;
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), Cc = new Float32Array(total * 3), UV = new Float32Array(total * 2);
    P.set(pos); N.set(nor); Cc.set(col); UV.set(uv);
    sk.forEach((v, q) => { const a = v * 3, b = (nb + q) * 3; P[b] = pos[a]; P[b + 1] = pos[a + 1] - SKIRT; P[b + 2] = pos[a + 2]; N[b] = nor[a]; N[b + 1] = nor[a + 1]; N[b + 2] = nor[a + 2]; Cc[b] = col[a]; Cc[b + 1] = col[a + 1]; Cc[b + 2] = col[a + 2]; UV[(nb + q) * 2] = uv[v * 2]; UV[(nb + q) * 2 + 1] = uv[v * 2 + 1]; });
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
    geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
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
      let sh = d.near ? 0 : -b.g; // survey heights (e): eave above the lowest ground under the building, see buildings.js
      if (b.e) { let lo = Infinity; for (let i = 0; i < b.p.length; i += 2) lo = Math.min(lo, groundY(b.p[i], b.p[i + 1])); sh = lo - b.g; }
      if (b.r === undefined) solids.push([b.p, null]);
      else if (!b.split) solids.push([b.p, b.r + sh]);
      else for (const [poly, rr] of b.parts || []) solids.push([poly, rr + sh]);
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
    // city landmarks may swap a footprint's walls for their own (the stadium's gate, the Politeama railing)
    const lms = cityIn(t), drop = new Set(lms.flatMap(l => l.dropWalls || []));
    for (const b of d.buildings) { if (drop.has(b.id)) continue; addRing(b.p); if (b.holes) b.holes.forEach(addRing); if ((++n & 63) === 0) yield; }
    for (const l of lms) for (const w of l.walls || []) wallGrid.addSeg(t.k, w, w[0], w[1], w[2], w[3]);
    for (const r of d.roads) {
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (r.n) nameGrid.addSeg(t.k, [a[0], a[1], b[0], b[1], r.n, r.w], a[0], a[1], b[0], b[1]);
        if (DRIVABLE.has(r.k) || r.k === 'track') { const v = [a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])]; v.t = t.k; roadVerts.push(v); }
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

  // ---------- surface masks: raised ground (sidewalks, grass: the car bumps up onto them) and hard ground (asphalt, paving, raised) ----------
  // 0.5 m cells, bit-packed, drawn band by band into one canvas: raised+green in the red channel, asphalt+paving+raised in green.
  // Anything not hard (park ground, dirt, hillside) is off-road for drivePlayer().
  const RK = 2, RW = T * RK, BAND = 50;
  let rcv = null, rg = null;
  function* buildRaised(t) {
    const st = t.data.streets, ext = poly => { let lo = 1e9, hi = -1e9; const r0 = poly[0]; for (let i = 1; i < r0.length; i += 2) { lo = Math.min(lo, r0[i]); hi = Math.max(hi, r0[i]); } return [lo, hi]; };
    const x0 = t.i * T, z0 = t.j * T, info = [];
    for (const [layers, col] of [[['raised', 'green'], '#f00'], [['asphalt', 'paving', 'raised', 'verge'], '#0f0']])
      for (const l of layers) for (const poly of st[l] || []) { const [lo, hi] = ext(poly); info.push({ poly, col, lo: (lo - z0) * RK, hi: (hi - z0) * RK }); }
    if (!info.length) { t.raised = null; t.hard = null; return; }
    if (!rcv) { rcv = document.createElement('canvas'); rcv.width = RW; rcv.height = BAND; rg = rcv.getContext('2d', { willReadFrequently: true }); }
    const bitsR = new Uint8Array(RW * RW / 8), bitsH = new Uint8Array(RW * RW / 8);
    for (let band = 0; band < RW / BAND; band++) {
      const y0 = band * BAND;
      rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'source-over'; rg.fillStyle = '#000'; rg.fillRect(0, 0, RW, BAND);
      rg.globalCompositeOperation = 'lighter';
      for (const { poly, col, lo, hi } of info) {
        if (hi < y0 || lo > y0 + BAND) continue;
        rg.fillStyle = col; rg.beginPath();
        for (const ring of poly) for (let i = 0; i < ring.length; i += 2) rg[i ? 'lineTo' : 'moveTo']((ring[i] - x0) * RK, (ring[i + 1] - z0) * RK - y0);
        rg.fill('evenodd');
      }
      const img = rg.getImageData(0, 0, RW, BAND).data, px = new Uint32Array(img.buffer, img.byteOffset, RW * BAND), base = band * BAND * RW;
      for (let q = 0, n = RW * BAND; q < n; q++) {
        if (px[q] === 0xff000000) continue; // opaque black: neither mask (little-endian RGBA)
        const b = base + q, o = q * 4;
        if (img[o] > 127) bitsR[b >> 3] |= 1 << (b & 7);
        if (img[o + 1] > 127) bitsH[b >> 3] |= 1 << (b & 7);
      }
      yield;
    }
    t.raised = bitsR; t.hard = bitsH;
  }
  let lastR = null;
  function maskAt(x, z, which) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastR;
    if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined) return undefined; lastR = t; }
    const bits = t[which]; if (bits === null || bits === undefined) return bits === null ? false : undefined;
    const b = (((z - j * T) * RK) | 0) * RW + (((x - i * T) * RK) | 0);
    return (bits[b >> 3] >> (b & 7) & 1) === 1;
  }
  const raised = (x, z) => maskAt(x, z, 'raised') === true;

  // Off the surfaced network (park ground, dirt tracks, hillside): less grip, a bumpy ride, a bit of drag. Called every physics step.
  let bumpPhase = 0;
  function drivePlayer(car, dt) {
    if (maskAt(car.x, car.z, 'hard') !== false) return;
    const v = Math.hypot(car.vx, car.vz);
    if (v < 1.5) return;
    car.gripLoss = Math.max(car.gripLoss || 0, 0.3);
    bumpPhase += v * dt;
    if (bumpPhase > 1.6) { bumpPhase = 0; car.hopV = Math.min(2.2, (car.hopV || 0) + 0.45 + 1.0 * Math.random() * Math.min(1, v / 12)); }
    const k = Math.exp(-0.12 * dt); car.vx *= k; car.vz *= k;
  }

  // ---------- road-following terrain shaping ----------
  // The ground under hill roads comes from a 100 m far grid (Monte Pellegrino has no usable lidar), which cannot follow a switchback. For
  // every drivable road on hilly or lidar-less tiles we sample a blurred copy of the ground along the centreline, and carve a level bench
  // at that height: full weight across the carriageway, easing back to the raw ground over SHAPE_EASE metres. The result is a pair of
  // grids (weight, weight*height) that tileGround() mixes in, so streets, curbs, props, buildings, the car and the terrain mesh all agree.
  // The target height depends only on position, so it is continuous across tile borders.
  const SHAPE_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'track']);
  const SHAPE_EASE = 11, SHAPE_S = 2;
  function* computeShape(t) {
    if (t.shaped) return;
    t.shaped = true;
    const roads = t.data.roads.filter(r => SHAPE_ROADS.has(r.k) && !r.tn && !r.br);
    if (!roads.length) return;
    // unshaped ground at any position, from whichever tile owns it (a tile's own grid clamps at its edge, which would put a step in the bench at tile borders)
    const base = (x, z) => { const o = tiles.get(nk(Math.floor(x / T), Math.floor(z / T))); return o && o.nearS ? o.nearS(x, z) : farM(x, z); };
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const y = base(t.i * T + i * T / 8, t.j * T + j * T / 8); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (t.nearS || hi - lo < 12) return; // near grids carry the bench baked by tools/tiles.py; only tiles without one are shaped here
    const blur = (x, z) => {
      let sum = base(x, z), n = 1;
      for (const r of [20, 45]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; sum += base(x + Math.cos(a) * r, z + Math.sin(a) * r); n++; }
      return sum / n;
    };
    let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
    const R = r => Math.max(r.w, 3) / 2 + 1.5 + SHAPE_EASE;
    for (const r of roads) for (let i = 0; i < r.p.length; i += 2) { const e = R(r); bx0 = Math.min(bx0, r.p[i] - e); bx1 = Math.max(bx1, r.p[i] + e); bz0 = Math.min(bz0, r.p[i + 1] - e); bz1 = Math.max(bz1, r.p[i + 1] + e); }
    bx0 = Math.max(bx0, t.i * T - 2); bz0 = Math.max(bz0, t.j * T - 2); bx1 = Math.min(bx1, (t.i + 1) * T + 2); bz1 = Math.min(bz1, (t.j + 1) * T + 2);
    const s = SHAPE_S, x0 = Math.floor(bx0 / s) * s, z0 = Math.floor(bz0 / s) * s, nx = Math.ceil((bx1 - x0) / s) + 2, nz = Math.ceil((bz1 - z0) / s) + 2;
    if (nx < 3 || nz < 3) return;
    const W = new Float32Array(nx * nz), WH = new Float32Array(nx * nz), best = new Float32Array(nx * nz).fill(1e9);
    let nr = 0;
    for (const r of roads) {
      const half = Math.max(r.w, 3) / 2, flat = half + 1.5, reach = R(r), p = pairs(r.p);
      // resample every ~3 m, with the blurred height at each sample
      const pts = [];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
        for (let k = i === 0 ? 0 : 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; pts.push([x, z, blur(x, z)]); if ((pts.length & 31) === 0) yield; }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
        const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - x0) / s)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0]) + reach - x0) / s));
        const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - z0) / s)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[1], b[1]) + reach - z0) / s));
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
          const px = x0 + ii * s, pz = z0 + j * s, tt = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          const d = Math.hypot(px - a[0] - dx * tt, pz - a[1] - dz * tt);
          if (d >= reach) continue;
          const c = j * nx + ii; if (d >= best[c]) continue;
          const e = d <= flat ? 1 : 1 - smooth(flat, reach, d);
          best[c] = d; W[c] = e; WH[c] = e * (a[2] + (b[2] - a[2]) * tt);
        }
        if ((++nr & 15) === 0) yield;
      }
    }
    t.shape = { x0, z0, s, nx, nz, W, WH };
  }

  // ---------- dirt tracks (highway=track, when the bake has them): a plain strip along the centreline ----------
  // (lifted just above the park grass layer, streets.js green = CURB + 0.01 with polygon offset -5, or tracks in parks would be buried)
  const TRACK_COL = new THREE.Color('#a48c66');
  let trackMat = null;
  function* buildTracks(t) {
    const roads = t.data.roads.filter(r => r.k === 'track'); if (!roads.length) return null;
    const P = [], N = [], Cc = [], I = [];
    for (const r of roads) {
      const p = pairs(r.p), hw = Math.max(r.w || 3.5, 2.5) / 2;
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
        const lx = p[i][0] + tz * hw, lz = p[i][1] - tx * hw, rx = p[i][0] - tz * hw, rz = p[i][1] + tx * hw;
        P.push(lx, groundY(lx, lz) + 0.17, lz, rx, groundY(rx, rz) + 0.17, rz); N.push(0, 1, 0, 0, 1, 0);
        const k = 0.92 + 0.08 * Math.sin(i * 1.7); Cc.push(TRACK_COL.r * k, TRACK_COL.g * k, TRACK_COL.b * k, TRACK_COL.r * k, TRACK_COL.g * k, TRACK_COL.b * k);
      }
    }
    // strip quads: vertices come in left/right pairs along each road (wound counter-clockwise seen from above)
    let base = 0;
    for (const r of roads) { const n = pairs(r.p).length; for (let i = 0; i < n - 1; i++) { const a = base + i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } base += n * 2; }
    yield;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1));
    trackMat = trackMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    const m = new THREE.Mesh(geo, trackMat); m.receiveShadow = true; m.name = 'tracks';
    const g = new THREE.Group(); g.add(m); g.userData.tris = I.length / 3;
    return g;
  }

  // ---------- trees: cheap instanced pines in forest areas, a few in parks (full-detail tiles only) ----------
  let treeGeo = null;
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  function getTreeGeo() {
    if (treeGeo) return treeGeo;
    const P = [], Nn = [], Cc = [], I = [];
    const col = (r, g, b) => new THREE.Color(r, g, b);
    const trunk = col(0.07, 0.045, 0.03), leafA = col(0.035, 0.085, 0.04), leafB = col(0.05, 0.115, 0.05); // linear values // Aleppo and stone pines read dark, almost blue-green
    const cone = (y0, y1, rad, sides, c) => {
      const base = P.length / 3;
      for (let i = 0; i < sides; i++) {
        const a0 = i / sides * 6.2832, a1 = (i + 1) / sides * 6.2832, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am), ny = rad / (y1 - y0);
        const l = Math.hypot(nx, ny, nz), k = P.length / 3;
        P.push(Math.cos(a0) * rad, y0, Math.sin(a0) * rad, Math.cos(a1) * rad, y0, Math.sin(a1) * rad, 0, y1, 0);
        for (let q = 0; q < 3; q++) { Nn.push(nx / l, ny / l, nz / l); Cc.push(c.r * (q === 2 ? 1.1 : 0.85), c.g * (q === 2 ? 1.1 : 0.85), c.b * (q === 2 ? 1.1 : 0.85)); }
        I.push(k, k + 2, k + 1);
      }
    };
    const prism = (y0, y1, rad, c) => {
      for (let i = 0; i < 4; i++) {
        const a0 = i / 4 * 6.2832 + 0.785, a1 = (i + 1) / 4 * 6.2832 + 0.785, am = (a0 + a1) / 2, k = P.length / 3;
        P.push(Math.cos(a0) * rad, y0, Math.sin(a0) * rad, Math.cos(a1) * rad, y0, Math.sin(a1) * rad, Math.cos(a1) * rad, y1, Math.sin(a1) * rad, Math.cos(a0) * rad, y1, Math.sin(a0) * rad);
        for (let q = 0; q < 4; q++) { Nn.push(Math.cos(am), 0, Math.sin(am)); Cc.push(c.r, c.g, c.b); }
        I.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
    };
    prism(0, 2.2, 0.28, trunk);
    cone(1.6, 6.2, 2.1, 7, leafA);
    cone(4.2, 8.6, 1.5, 7, leafB);
    treeGeo = new THREE.BufferGeometry();
    treeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    treeGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(Nn), 3));
    treeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3));
    treeGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(I), 1));
    return treeGeo;
  }
  const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  function* buildTrees(t) {
    const d = t.data, areas = (d.areas || []).filter(a => a.k === 'forest' || a.k === 'green').map(a => {
      const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { pts, x0, z0, x1, z1, p: a.k === 'forest' ? 0.9 : Math.min(x1 - x0, z1 - z0) > 160 ? 0.55 : 0.3 }; // a big park (the Favorita) is mostly trees
    });
    if (!areas.length) return null;
    // building footprints (bbox grid), so no tree grows through a house
    const BC = 30, bg = new Map();
    for (const b of d.buildings) {
      const pts = pairs(b.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      const e = { pts, x0, z0, x1, z1 };
      for (let cx = Math.floor(x0 / BC); cx <= Math.floor(x1 / BC); cx++) for (let cz = Math.floor(z0 / BC); cz <= Math.floor(z1 / BC); cz++) { const k = cx * 100003 + cz; let l = bg.get(k); if (!l) bg.set(k, l = []); l.push(e); }
    }
    const inBld = (x, z) => { const l = bg.get(Math.floor(x / BC) * 100003 + Math.floor(z / BC)); if (!l) return false; for (const e of l) if (x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1 && inPoly(e.pts, x, z)) return true; return false; };
    const SP = 14, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const mats = [], cols = [], MAX = 1400;
    for (let gz = t.j * T; gz < (t.j + 1) * T; gz += SP) {
      for (let gx = t.i * T; gx < (t.i + 1) * T; gx += SP) {
        const x = gx + hash2(gx, gz) * SP, z = gz + hash2(gz + 7.1, gx - 3.3) * SP;
        let pr = 0;
        for (const a of areas) if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && a.p > pr && inPoly(a.pts, x, z)) pr = a.p;
        if (pr === 0 || hash2(x * 1.3, z * 0.7) > pr) continue;
        if (maskAt(x, z, 'hard') === true || inBld(x, z)) continue;
        if (mats.length >= MAX) break;
        const s = 0.75 + hash2(x + 1.9, z + 4.2) * 0.8;
        q.setFromAxisAngle(up, hash2(x, z + 9.1) * 6.28); sc.set(s, s * (0.9 + hash2(z, x) * 0.3), s); pos.set(x, groundY(x, z) - 0.1, z);
        m4.compose(pos, q, sc); mats.push(m4.clone());
        const v = 0.7 + hash2(x - 5.5, z + 2.2) * 0.5; cols.push(col.setRGB(v * (1 + hash2(z, x) * 0.15), v * (0.95 + hash2(z, z) * 0.12), v * 0.85).clone());
      }
      yield;
    }
    if (!mats.length) return null;
    const mesh = new THREE.InstancedMesh(getTreeGeo(), treeMat, mats.length);
    mats.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, cols[i]); });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.name = 'trees';
    if (mesh.computeBoundingSphere) mesh.computeBoundingSphere(); else mesh.frustumCulled = false;
    const g = new THREE.Group(); g.add(mesh); g.userData.tris = mats.length * 22;
    return g;
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
      let bi = 0; for (let i = 1; i < pending.length; i++) if (pending[i].pd < pending[bi].pd) bi = i;
      const t = pending.splice(bi, 1)[0]; inflight++;
      // (the production build serves the .bin twin through a fetch shim, tools/build/runtime/loader.js: always go through r.json())
      fetch(url('tiles/' + t.id + '.json')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); stat.bytes += +r.headers.get('content-length') || 0; return r.json(); }).then(d => {
        t.data = d; stat.fetched++;
        applyDistrictHeights(d); // low and full detail agree on storeys, no height pop on LOD swap
        prepareTile(t);
      }).catch(e => { t.failed = true; stat.errors++; console.warn('[world] tile', t.id, e); })
        .finally(() => { inflight--; t.fetchP = null; t.fetchRes(); pump(); });
    }
  }
  function prepareTile(t) {
    const d = t.data;
    if (d.near) { t.nearS = gridSampler(d.near); t.nearStep = d.near.s; t.benched = !!d.near.bench; }
    t.urban = Math.min(1, (d.buildings.length) / 160) * 0.8;
    t.tint = (d.areas || []).filter(a => COVER[a.k]).sort((a, b) => COVER[a.k][2] - COVER[b.k][2]).map(a => {
      const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { pts, x0, z0, x1, z1, col: COVER[a.k][0], s: COVER[a.k][1], cover: a.k };
    });
  }
  function* ensureData(t) {
    if (t.data) return true;
    const c = cache.get(t.k);
    if (c) { cache.delete(t.k); t.data = c; if (t.tint === null) prepareTile(t); return true; } // a tile released earlier comes back without its near grid and tint
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
    t.stage = 'shape'; yield* computeShape(t);
    t.stage = 'terrain'; setPart(t, 'terrain', yield* terrainMesh(t, 2));
    yield;
    const g = new THREE.Group(); t.stage = 'streetsLow';
    yield* streetsIter(t.data.streets, g, { layers: ['asphalt', 'paving', 'sand', 'water'], curbs: false, offset: true, drape: 18, chunk: 0 });
    if (t.want === 0) { disposeObj(g); return; }
    setPart(t, 'streets', g);
    t.stage = 'bldLow'; const low = yield* lowBuildings(t);
    if (t.want === 0) { disposeObj(low); return; }
    setPart(t, 'bldLow', low);
    t.lod = 1; stat.built++;
  }
  function* buildFull(t) {
    t.hasFull = true;
    t.stage = 'physics'; yield* registerPhysics(t);
    if (t.want < 2) return;
    t.stage = 'masks'; yield* buildRaised(t);
    if (t.want < 2) return;
    t.stage = 'terrainFull'; setPart(t, 'terrain', yield* terrainMesh(t, 1));
    yield;
    const g = new THREE.Group(); t.stage = 'streetsHi';
    yield* streetsIter(t.data.streets, g, { layers: ['raised', 'verge', 'green'], curbs: true, offset: true, drape: 9, chunk: 0 });
    if (t.want < 2) { disposeObj(g); return; }
    setPart(t, 'streetsHi', g);
    t.stage = 'paint'; {
      const aoi = D.streets && D.streets.aoi, inC = aoi ? (x, z) => x > aoi[0] && x < aoi[2] && z > aoi[1] && z < aoi[3] : null; // the centro's paint is src/roadwear.js
      const mk = yield* roadMarksIter(t.data.roads, ((t.data.props || {}).items || []).filter(i => i.k === 'crossing'), inC);
      if (t.want < 2) { if (mk) disposeObj(mk); return; }
      if (mk) setPart(t, 'paint', mk);
    }
    t.stage = 'tracks'; { const tr = yield* buildTracks(t); if (tr) setPart(t, 'tracks', tr); }
    if (t.want < 2) return;
    t.stage = 'trees'; { const tg = yield* buildTrees(t); if (tg) setPart(t, 'trees', tg); }
    if (t.want < 2) return;
    t.stage = 'bldFull'; const bg = new THREE.Group(), lms = cityIn(t);
    const tctx = lms.length ? { ...ctx, skip: new Set([...ctx.skip, ...lms.flatMap(l => l.skipIds || [])]) } : ctx;
    yield* buildBuildingsIter(tctx, t.data, bg);
    for (const l of lms) { // landmark models standing in for those generic buildings
      try { const o = l.build(ctx); if (o) { bg.add(o); yield; } } catch (e) { console.error('[world] landmark', l.name, e); }
    }
    if (t.want < 2) { disposeObj(bg); return; }
    setPart(t, 'bldFull', bg);
    setPart(t, 'bldLow', null);
    t.lod = 2;
    emit('full', t);
  }
  function* downgrade(t) {
    emit('drop', t);
    setPart(t, 'bldFull', null); setPart(t, 'streetsHi', null); setPart(t, 'paint', null); setPart(t, 'tracks', null); setPart(t, 'trees', null);
    unregisterPhysics(t); t.raised = null; t.hard = undefined; t.hasFull = false;
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
    emit('drop', t);
    for (const n of Object.keys(t.parts)) setPart(t, n, null);
    unregisterPhysics(t); t.raised = null; t.hard = undefined;
    stash(t);
    t.dead = true; t.nearS = null; t.nearStep = 0; t.benched = false; t.lod = 0; t.hasFull = false;
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
  // Budget allocation. Every tile in range is always covered: the baked far boxes cost a few hundred triangles and never go away, so
  // a tile that gets nothing better is not a hole. Order of grants: (1) tiles within `guard` of the camera get full detail whatever it
  // costs, because wall collision and the raised-ground mask only exist there; (2) every tile of the low detail ring gets low detail,
  // nearest first, while the budget lasts; (3) full detail goes to the nearest tiles of the full ring, nearest first, until the next one
  // does not fit. Tiles that already have a level get 8 % of slack, so the estimate shifting as real triangle counts come in does not
  // make them flap. The far boxes outside the list count against the budget too (the ring that is not in the list, within the fog).
  function updateWanted(fx, fz) {
    const R = Math.ceil((CFG.rLow + CFG.hyst) / T) + 1, ci = Math.floor(fx / T), cj = Math.floor(fz / T);
    const list = [];
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      if (!M.tiles[i + '_' + j]) continue;
      const t = getTile(i, j); t.d = rectDist(fx, fz, t); list.push(t);
    }
    list.sort((a, b) => a.d - b.d);
    const inList = new Set(list), inKeys = new Set();
    wantedOnce = true;
    for (const t of tiles.values()) if (!inList.has(t)) { t.want = 0; t.d = rectDist(fx, fz, t); }
    // overview (the title flyover): only the tile under the camera gets full detail, so the budget goes to the low detail ring
    const rFull = world.overview ? 1 : CFG.rFull, guard = world.overview ? 1 : CFG.guard;
    let est = 0;
    for (const t of list) {
      inKeys.add(t.k); t.want = 0;
      t.dw = t.d < rFull + (t.lod === 2 ? CFG.hyst : 0) ? 2 : t.d < CFG.rLow + (t.lod >= 1 ? CFG.hyst : 0) ? 1 : 0;
      est += estimate(t, 0);
    }
    if (farCity) est += farCity.trisAround(fx, fz, farRadius(), inKeys);
    for (const t of list) if (t.d < guard) { t.want = 2; est += estimate(t, 2) - estimate(t, 0); }
    for (const t of list) {
      if (t.dw < 1 || t.want >= 1) continue;
      const dl = estimate(t, 1) - estimate(t, 0);
      if (est + dl <= CFG.triCap * (t.lod >= 1 ? 1.08 : 1)) { t.want = 1; est += dl; }
    }
    for (const t of list) {
      if (t.dw < 2 || t.want >= 2) continue;
      const dl = estimate(t, 2) - estimate(t, t.want);
      if (est + dl > CFG.triCap * (t.lod === 2 ? 1.08 : 1)) break;
      t.want = 2; est += dl;
    }
    markView();
    for (const t of tiles.values()) ensureTask(t);
    ensureFarTask(fx, fz);
    pump();
    world.estTris = est;
  }
  const farRadius = () => Math.min(14000, CFG.farFog / Math.max(1e-6, scene.fog ? scene.fog.density : 0.00014));
  // one task at a time keeps the far chunks around the camera built (src/context.js sync); it sits behind the tile work in the queue
  function ensureFarTask(fx, fz) {
    if (!farCity || (farTask && !farTask.done)) return;
    farTask = { t: { pd: 5e4 }, gen: (function* () { yield farCity.load(); yield* farCity.sync(fx, fz, farRadius(), seenBox); contextDirty = true; })(), wait: null, name: 'far' };
    tasks.push(farTask);
  }
  function ensureTask(t) {
    if (t.task || t.dead) return;
    if (t.want === t.lod && !(t.want === 1 && t.hasFull) && t.want !== 0) { if (t.want === 1 && t.data) stash(t); return; }
    if (t.want === 0 && t.lod === 0 && !Object.keys(t.parts).length && !t.data && !t.nearS) { t.dead = true; tiles.delete(t.k); return; }
    if (t.failed && t.want > 0 && !t.data && !cache.has(t.k)) return;
    const task = { t, gen: process(t), wait: null, name: t.id };
    t.task = task; tasks.push(task);
  }

  // ---------- what the camera sees: build order and the reveal counter ----------
  // markView (every frame, it is a few hundred box tests): flags the tiles the camera can see, and orders the work visible tiles first,
  // nearest first, then the rest of the ring nearest first (pd, the priority of tasks and fetches). A tile is in view when it is within
  // viewNear of the focus (so the tile under the car always is) or its box meets the camera frustum widened by viewMargin.
  // visiblePending counts, at the end of the frame, the in-view tiles that are below the detail they want plus the far city chunks in view
  // that are not built (and 1 until the manifest, the first allocation and the far city file are in): 0 means everything on screen is built.
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _bb = new THREE.Box3(), _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3();
  function seenBox(x0, z0, x1, z1, top = 200) { _v0.set(x0, -10, z0); _v1.set(x1, top, z1); return _fr.intersectsBox(_bb.set(_v0, _v1)); }
  function markView() {
    camera.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const p of _fr.planes) p.constant += CFG.viewMargin;
    for (const t of tiles.values()) {
      if (t.top < 0) t.top = Math.max(farM(t.cx, t.cz), farM(t.cx - 250, t.cz - 250), farM(t.cx + 250, t.cz - 250), farM(t.cx - 250, t.cz + 250), farM(t.cx + 250, t.cz + 250)) + 80;
      t.d = rectDist(focus.x, focus.z, t);
      t.vis = t.d < CFG.viewNear || seenBox(t.i * T, t.j * T, (t.i + 1) * T, (t.j + 1) * T, t.top);
      t.pd = t.vis ? t.d : t.d + 1e4;
    }
    if (farTask && !farTask.done) farTask.t.pd = farMissing > 0 ? 4e3 : 5e4; // the far chunks in view go before the tiles out of view
  }
  function countPending() {
    let n = 0;
    if (!M || !wantedOnce || (farCity && !farCity.loaded && !farCity.failed)) n++;
    for (const t of tiles.values()) {
      if (!t.vis || t.dead || t.want === 0) continue;
      if (t.failed && !t.data && !cache.has(t.k)) continue;
      if (t.lod < t.want || (t.want === 1 && t.hasFull)) n++;
    }
    farMissing = farCity ? farCity.missing(focus.x, focus.z, farRadius(), seenBox) : 0;
    return n + farMissing;
  }

  // ---------- scheduler ----------
  function runTasks(budget) {
    const t0 = performance.now();
    tasks.sort((a, b) => a.t.pd - b.t.pd);
    for (const k of tasks) {
      if (k.wait || k.done) continue;
      while (performance.now() - t0 < budget) {
        let r;
        const s0 = performance.now();
        try { r = k.gen.next(); } catch (e) { console.error('[world] task', k.name, e); r = { done: true }; if (k.t.id) { k.t.failed = true; k.t.want = 0; } }
        { const dtm = performance.now() - s0; if (dtm > 6 && k.t.id) { (stat.slow = stat.slow || []).push([+dtm.toFixed(1), k.t.id, k.t.stage]); if (stat.slow.length > 40) stat.slow.shift(); } }
        if (r.done) { k.done = true; if (k.t.id) k.t.task = null; break; }
        if (r.value && typeof r.value.then === 'function') { k.wait = r.value; r.value.then(() => { k.wait = null; }, () => { k.wait = null; }); break; }
      }
      if (performance.now() - t0 >= budget) break;
    }
    if (tasks.some(k => k.done)) tasks = tasks.filter(k => !k.done);
  }

  // ---------- far city (src/context.js): its boxes of a tile are hidden once the tile has real buildings ----------
  let contextDirty = false;
  const farHidden = new Set();
  function refreshContext() {
    contextDirty = false;
    if (!farCity) return;
    farHidden.clear();
    for (const t of tiles.values()) if (t.parts.bldLow || t.parts.bldFull) farHidden.add(t.k);
    farCity.hide(farHidden);
  }

  // ---------- public ----------
  let binding = null, tele = null, overviewOn = false;
  world = {
    manifest: null,
    estTris: 0,
    // set by main.js while the title is up (see updateWanted); a change asks for a new allocation at once, so leaving the title does not wait for the next 0.5 s tick
    get overview() { return overviewOn; }, set overview(v) { if (v !== overviewOn) { overviewOn = v; wantedTimer = 99; } },
    hurry: false,    // set while a loading screen or the start transition covers the game: the build budget goes up to cfg.hurryMs a frame
    get farCity() { return farCity; },
    raised,
    drivePlayer,
    // Dry land per the manifest coastline (the baked D.land only covers the centro). False until the manifest is in.
    isLand(x, z) {
      if (!landPoly) return false;
      if (x < landPoly.x0 || x > landPoly.x1 || z < landPoly.z0 || z > landPoly.z1) return false;
      return inPoly(landPoly.pts, x, z) || landPoly.islands.some(p => inPoly(p, x, z));
    },
    bind(b) { binding = b; applyAt(); },
    // Move the player somewhere far: stream the destination in first, then place the car (placeAt snaps to the nearest road vertex).
    onTile(fn) { tileFns.add(fn); for (const t of fullSet) fn('full', t); return () => tileFns.delete(fn); },
    fullTiles() { return [...fullSet]; },
    // Parsed data of tile (i, j) if it is resident or in the parsed-tile LRU (full or low detail), else null. Read-only (minimap).
    // How many in-view tiles and far chunks still need building (markView above); 0 = everything the camera can see is built.
    // Computed at the end of update(), so call it after a frame or two when the camera has just moved.
    visiblePending() { return visPending; },
    tileData(i, j) { const k = nk(i, j), t = tiles.get(k); return (t && t.data) || cache.get(k) || null; },
    teleport(x, z, done) { tele = { x, z, done }; wantedTimer = 99; },
    update(dt, cam) {
      if (!M) { if (tasks.length) runTasks(world.hurry ? CFG.hurryMs : CFG.budgetMs); return; }
      const t0 = performance.now();
      const f = tele || cam.position;
      focus.x = f.x; focus.z = f.z;
      wantedTimer += dt;
      if (wantedTimer > 0.5 || Math.hypot(focus.x - lastWanted.x, focus.z - lastWanted.z) > 30) {
        wantedTimer = 0; lastWanted.x = focus.x; lastWanted.z = focus.z;
        updateWanted(focus.x, focus.z);
      }
      markView();
      pump();
      runTasks(world.hurry ? CFG.hurryMs : CFG.budgetMs);
      for (const t of tiles.values()) if (!t.task && !t.dead) ensureTask(t);
      if (tele) {
        const t = tiles.get(nk(Math.floor(tele.x / T), Math.floor(tele.z / T)));
        if (t && t.lod === 2) { const d = tele.done; tele = null; d && d(); }
      }
      farUpdate();
      if (contextDirty) refreshContext();
      visPending = countPending();
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
        drawCalls: renderer.info.render.calls, rendTris: renderer.info.render.triangles, far: farCity ? farCity.stats() : null };
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
    overlay.textContent = `tiles ${s.lod2}/${s.lod1}/${s.lod0}  tris ${(s.tris / 1e3) | 0}k  queue ${s.queued}  net ${s.inflight}+${s.pending}  vis ${visPending}\nwork ${s.work.toFixed(1)}ms max ${s.workMax.toFixed(1)}  heap ${s.heapMB ?? '?'}MB`;
  }
  return world;
}
