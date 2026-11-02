// Pedestrians: 4-direction billboard sprites walking sidewalks, pedestrian streets and piazze. Owned by the pedestrian work.
// createPedestrians(env) with env = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, traffic, world }.
// Returns { update(dt, camera), collidePlayer(car), setQuality('low'|'medium'|'high'), stats }.
//
// How it works
// - Art: assets/peds/ draws the characters with a small software rasteriser from a parametric model (assets/peds/model.js): every person is a spec (face, hair, outfit)
//   made by the generator (people.js) from a type of the cast (sprites.js: nonna, vendor, tourist, metalhead...). Cells are 24 x 54 design units, 3 directions x 6 poses.
//   Two 16-bit atlases (assets/peds/atlas.js): the whole cast at 1 texel per unit (far), built a few cells per frame, and a few slots at 3 texels per unit (near)
//   for the people close enough to the camera for the extra detail to show, built on demand and recycled.
// - Rendering: two InstancedBufferGeometry draws (sprites, blob shadows) fed by the same per-instance buffers.
//   The vertex shader billboards around the vertical axis only; the CPU picks the atlas cell from the angle between
//   the camera and the walking direction and from the walk phase.
// - Walkability: per full-detail world tile (world.onTile), a lazily drawn raster mask (0.5 m cells, 62.5 m blocks around the camera) made
//   from the tile's street polygons, the minor roads and footways, zebra strips and the building footprints. Freed when the tile drops. Cell classes: 0 blocked, 1 sidewalk/paving/piazza,
//   2 minor carriageway or grass (allowed, disliked), 3 zebra crossing.
// - Crowd: hand-stamped hot spots in the centro (markets, Maqueda, Cassaro, piazze) and, everywhere else, a profile per district (districts.js
//   zoneAt): beachgoers at Mondello and the lido, shoppers on Via Liberta, locals and kids at the ZEN and CEP, joggers and dog walkers in the
//   Favorita, a handful of pilgrims on Monte Pellegrino. People spawn and despawn in a disc around the camera, only on full-detail tiles.
// - Night: after dark (window event 'pd-time' {hour, isNight, dusk}, or env.game.time; daytime when neither exists) a second
//   density map and crowd mix take over: Piazza Sant'Anna and the Vucciria fill with young people standing and chatting in
//   groups (zone 5), Ballaro and the Capo get a smaller evening crowd, vendors go home and tourists thin out. api.night() tells
//   other modules (src/missions.js) whether it is night.
import { FLEW } from './shouts.js';
import * as THREE from 'three';
import { zoneAt as districtAt } from './districts.js';
import { VARIANTS as ALL_VARIANTS, CELL_W as CELL_W0, CELL_H as CELL_H0, GROUND as GROUND0, POSES, CELLS_PER_ENTRY, POSE_SIT, POSE_SIT_SIP } from '../assets/peds/sprites.js';
import { LPC_CELL, LPC_GROUND, LPC_PX, LPC_HIP } from '../assets/peds/lpc/cast.js';
import { createLpcAtlas } from '../assets/peds/lpc/atlas.js';
import { createPedAtlas } from '../assets/peds/atlas.js';
import { LK } from '../assets/peds/model.js';
const hyp2 = (a, b) => Math.sqrt(a * a + b * b); // [perf pass] Math.hypot boxes a heap number per call; this runs thousands of times per frame

const TAU = Math.PI * 2;
const CPM = 2;                                           // mask cells per metre
const PX0 = 0.0438;                                       // metres per design unit (an adult is about 37 units = 1.6 m: big head, short body); far cells have one texel per unit, near cells three
const WALK = 0, IDLE = 1, WAIT = 2, DODGE = 3, FLY = 4, LIE = 5, GETUP = 6;
const QUALITIES = { low: { cap: 100, R: 75 }, medium: { cap: 240, R: 100 }, high: { cap: 380, R: 120 } };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

export function createPedestrians(env) {
  const { scene, camera, car, groundY, raisedMask, CURB, walls2d, D, world } = env;   // world: the tile streamer (src/world.js), always present
  const params = new URLSearchParams(location.search);
  // The people are drawn from layers of the Universal LPC Spritesheet Character Generator plus our own painted details, prebuilt into one atlas by tools/lpc/build.mjs
  // (assets/peds/lpc, credits in assets/peds/lpc/CREDITS.md). ?pedgen draws them with the generated renderer of assets/peds (raster.js, model.js, atlas.js) instead.
  const LPC = !params.has('pedgen');
  const PX = LPC ? LPC_PX : PX0, CELL_W = LPC ? LPC_CELL[0] : CELL_W0, CELL_H = LPC ? LPC_CELL[1] : CELL_H0, GROUND = LPC ? LPC_GROUND : GROUND0;
  const VARIANTS = ALL_VARIANTS;
  const variantsOf = id => { const r = []; for (let i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].id === id) r.push(i); return r; };
  let quality = QUALITIES.medium; // the default tier on every device (main.js applySettings sets it from the options)
  if (params.has('peds')) quality = { cap: Math.max(0, +params.get('peds') | 0), R: quality.R };
  const CAP = 420;
  const stats = { ms: 0, avgMs: 0, maxMs: 0, count: 0, target: 0, tileMs: 0, tiles: 0 };
  if (!world) return { update() {}, collidePlayer() {}, setQuality() {}, stats, spawnScripted: () => -1, spawnCrowd: () => [], removeCrowd() {}, crowdFamilies: () => [], walkTo() {}, face() {}, attachTo() {}, detach() {}, remove() {}, info: () => null, setBounce() {}, near: () => 0, onKnock() {}, night: () => ({ night: false, k: 0, hour: null }) };

  // ======================================================================== walkability mask (per world tile)
  // One mask per full-detail world tile (500 m), made from that tile's own street polygons (paving, raised sidewalks, green, sand, water to
  // avoid), its building footprints, the minor roads and footways, and zebra strips laid from the tile's crossing nodes. The tile is
  // indexed when it reaches full detail (world.onTile 'full', one tile per frame) and freed when it drops. The 0.5 m cells are not
  // rasterised up front: 62.5 m blocks are drawn on demand around the camera (so no 1000 x 1000 read-back stalls a frame), and blocks that
  // fall far behind are freed. Cell classes: 0 blocked or no tile, 1 sidewalk/paving/piazza, 2 minor carriageway, grass or sand (allowed,
  // disliked), 3 zebra.
  const WTS = 500, BC = 125, BM = BC / CPM, DZ = 31.25;                 // world tile size, cells per block side, block size in metres, district cell
  const wkey = (i, j) => (i + 512) * 1024 + (j + 512);
  const wts = new Map(), pendingTiles = [];
  let lwt = null;                                         // last tile looked up (agents cluster, so this hits almost always)
  const wtAt = (x, z) => {
    const w = lwt; if (w !== null && x >= w.x0 && x < w.x1 && z >= w.z0 && z < w.z1) return w;
    const n = wts.get(wkey(Math.floor(x / WTS), Math.floor(z / WTS)));
    if (n === undefined) return null; lwt = n; return n;
  };
  const bbox = flat => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < flat.length; i += 2) { const x = flat[i], z = flat[i + 1]; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; } return [a, b, c, d]; };
  const MINOR = new Set(['residential', 'living_street', 'service', 'unclassified']), WALKWAY = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'pier']);
  const RG = 32, rgk = (i, j) => i * 100003 + j, IG = 24;
  const IDLE_KINDS = new Set(['cafe', 'bench', 'busstop', 'fountain', 'monument']);

  // index a tile's data into a mask holder (nothing is rasterised yet)
  function register(t) {
    const d = t.data, st = d.streets || {}, x0 = t.i * WTS, z0 = t.j * WTS, nb = WTS * CPM / BC;
    const w = { t, x0, z0, x1: x0 + WTS, z1: z0 + WTS, i: t.i, j: t.j, blocks: new Array(nb * nb).fill(null), bi: new Array(nb * nb).fill(null), bld: [], idle: new Map(), dz: new Uint8Array((WTS / DZ) * (WTS / DZ)).fill(255) };
    // passes: 0 class-2 fill, 1 class-1 fill, 2 class-3 fill, 3 erase
    const add = (it, bx, own) => {
      it.a = bx[0]; it.b = bx[1]; it.c = bx[2]; it.d = bx[3];
      const i0 = Math.max(0, Math.floor((bx[0] - x0) / BM)), i1 = Math.min(nb - 1, Math.floor((bx[2] - x0) / BM));
      const j0 = Math.max(0, Math.floor((bx[1] - z0) / BM)), j1 = Math.min(nb - 1, Math.floor((bx[3] - z0) / BM));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nb + i; (w.bi[k] || (w.bi[k] = [])).push(it); }
      if (own) w.bld.push(it);
    };
    const poly = (g, rings, own) => add({ g, rings, line: null, w: 0 }, bbox(rings[0]), own);
    const line = (g, p, wd) => { const b = bbox(p), m = wd / 2 + 1; add({ g, rings: null, line: p, w: wd }, [b[0] - m, b[1] - m, b[2] + m, b[3] + m], false); };
    for (const p of st.green || []) poly(0, p, false);
    for (const p of st.sand || []) poly(0, p, false);
    for (const p of st.paving || []) poly(1, p, false);
    for (const p of st.raised || []) poly(1, p, false);
    for (const p of st.water || []) poly(3, p, false);
    for (const b of d.buildings || []) poly(3, b.holes && b.holes.length ? [b.p, ...b.holes] : [b.p], true);
    const roadSegs = new Map();                           // 32 m grid of carriageway segments for the zebra builder
    for (const r of d.roads || []) {
      if (r.tn) continue;                                 // tunnels
      if (MINOR.has(r.k)) line(0, r.p, Math.min(r.w || 5, 5));
      else if (WALKWAY.has(r.k)) line(1, r.p, Math.max(r.w || 2, 2));
      if (r.k === 'pier' || WALKWAY.has(r.k) || r.k === 'track') continue;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        const s = [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w || 6];
        for (let ix = Math.floor(Math.min(s[0], s[2]) / RG); ix <= Math.floor(Math.max(s[0], s[2]) / RG); ix++)
          for (let iz = Math.floor(Math.min(s[1], s[3]) / RG); iz <= Math.floor(Math.max(s[1], s[3]) / RG); iz++) { const k = rgk(ix, iz); let a = roadSegs.get(k); if (!a) roadSegs.set(k, a = []); a.push(s); }
      }
    }
    for (const it of (d.props && d.props.items) || []) {
      if (IDLE_KINDS.has(it.k)) { const k = rgk(Math.floor(it.x / IG), Math.floor(it.z / IG)); let a = w.idle.get(k); if (!a) w.idle.set(k, a = []); a.push(it); }
      if (it.k !== 'crossing' || it.cr === 'unmarked' || it.den === 'unmarked') continue;
      let best = null, bd = 6;
      for (let ix = Math.floor((it.x - 6) / RG); ix <= Math.floor((it.x + 6) / RG); ix++) for (let iz = Math.floor((it.z - 6) / RG); iz <= Math.floor((it.z + 6) / RG); iz++) {
        const a = roadSegs.get(rgk(ix, iz)); if (!a) continue;
        for (const s of a) {
          const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; if (!l2) continue;
          const u = clamp(((it.x - s[0]) * dx + (it.z - s[1]) * dz) / l2, 0, 1), dd = hyp2(it.x - s[0] - dx * u, it.z - s[1] - dz * u);
          if (dd < bd) { bd = dd; best = [s[0] + dx * u, s[1] + dz * u, dx, dz, s[4]]; }
        }
      }
      if (!best) continue;
      const l = hyp2(best[2], best[3]), tx = best[2] / l, tz = best[3] / l, nx = -tz, nz = tx, hl = Math.max(best[4] / 2 + 2.5, 4), hw = 1.5, cx0 = best[0], cz0 = best[1];
      poly(2, [[cx0 + tx * hw + nx * hl, cz0 + tz * hw + nz * hl, cx0 - tx * hw + nx * hl, cz0 - tz * hw + nz * hl, cx0 - tx * hw - nx * hl, cz0 - tz * hw - nz * hl, cx0 + tx * hw - nx * hl, cz0 + tz * hw - nz * hl]], false);
    }
    wts.set(wkey(t.i, t.j), w); lwt = null;
    return w;
  }
  function unregister(t) {
    const k = wkey(t.i, t.j), w = wts.get(k), pi = pendingTiles.indexOf(t);
    if (pi >= 0) pendingTiles.splice(pi, 1);
    if (!w) return;
    wts.delete(k); lwt = null;
    // whoever stands on the tile leaves with it (the despawn loop removes them)
    for (let i = 0; i < N.n; i++) if (X[i] >= w.x0 && X[i] < w.x1 && Z[i] >= w.z0 && Z[i] < w.z1) AGE[i] = -999;
    for (const c of chairs) if (c.x >= w.x0 && c.x < w.x1 && c.z >= w.z0 && c.z < w.z1) c.dead = true;
  }

  const tcv = document.createElement('canvas'); tcv.width = tcv.height = BC;
  const tg = tcv.getContext('2d', { willReadFrequently: true });
  const PASS_COL = ['#00ff00', '#ff0000', '#0000ff'];
  let curPass = 0;
  const drawItem = it => {
    tg.beginPath();
    if (it.line) { const p = it.line; tg.lineWidth = it.w; tg.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) tg.lineTo(p[i], p[i + 1]); tg.stroke(); }
    else { for (const ring of it.rings) { tg.moveTo(ring[0], ring[1]); for (let i = 2; i < ring.length; i += 2) tg.lineTo(ring[i], ring[i + 1]); tg.closePath(); } tg.fill('evenodd'); if (curPass === 3) tg.stroke(); }
  };
  function buildBlock(w, bx, bz) {
    const t0 = performance.now(), nb = WTS * CPM / BC;
    const x0 = w.x0 + bx * BM, z0 = w.z0 + bz * BM, list = w.bi[bz * nb + bx] || [];
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, BC, BC);
    tg.setTransform(CPM, 0, 0, CPM, -x0 * CPM, -z0 * CPM); tg.lineJoin = 'round'; tg.lineCap = 'round';
    for (let pass = 0; pass < 4; pass++) {
      curPass = pass;
      if (pass === 3) { tg.globalCompositeOperation = 'destination-out'; tg.strokeStyle = '#000'; tg.lineWidth = 0.9; tg.fillStyle = '#000'; }
      else { tg.fillStyle = PASS_COL[pass]; tg.strokeStyle = PASS_COL[pass]; }
      for (let q = 0; q < list.length; q++) if (list[q].g === pass) drawItem(list[q]);
      if (pass === 3) {   // footprints of the neighbouring tile that reach over the border into this block
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          if ((!a && !b) || (a < 0 && bx > 0) || (a > 0 && bx < nb - 1) || (b < 0 && bz > 0) || (b > 0 && bz < nb - 1)) continue;
          const n = wts.get(wkey(w.i + a, w.j + b)); if (!n) continue;
          for (let q = 0; q < n.bld.length; q++) { const it = n.bld[q]; if (it.c >= x0 - 1 && it.a <= x0 + BM + 1 && it.d >= z0 - 1 && it.b <= z0 + BM + 1) drawItem(it); }
        }
      }
    }
    const d = tg.getImageData(0, 0, BC, BC).data, m = new Uint8Array(BC * BC);
    for (let i = 0, j = 3; i < m.length; i++, j += 4) {
      if (d[j] < 128) continue;
      const r = d[j - 3], g = d[j - 2], b = d[j - 1];
      m[i] = r >= g && r >= b ? 1 : b > g ? 3 : 2;
    }
    w.blocks[bz * nb + bx] = m; stats.tiles++; stats.tileMs += performance.now() - t0;
  }
  // mask class at a world position; tiles that are not at full detail, and blocks not drawn yet, read as blocked
  function cell(x, z) {
    const w = wtAt(x, z); if (w === null) return 0;
    const gx = ((x - w.x0) * CPM) | 0, gz = ((z - w.z0) * CPM) | 0, bx = (gx / BC) | 0, bz = (gz / BC) | 0;
    const m = w.blocks[bz * 8 + bx]; return m === null ? 0 : m[(gz - bz * BC) * BC + gx - bx * BC];
  }
  // draw the blocks within r of (x, z), nearest first, until the time budget is spent (at least one when any is missing)
  const mW = new Array(64).fill(null), mK = new Int32Array(64), mD = new Float32Array(64);
  function ensureBlocks(x, z, r, budgetMs) {
    const t0 = performance.now(), xe = x + r, ze = z + r; let n = 0, built = 0;
    for (let pz = z - r; ; pz += BM) {
      const zz = pz > ze ? ze : pz;
      for (let px = x - r; ; px += BM) {
        const xx = px > xe ? xe : px, w = wtAt(xx, zz);
        if (w !== null && n < 64) {
          const bx = ((xx - w.x0) / BM) | 0, bz = ((zz - w.z0) / BM) | 0, k = bz * 8 + bx;
          if (w.blocks[k] === null) {
            let dup = false; for (let q = 0; q < n; q++) if (mW[q] === w && mK[q] === k) { dup = true; break; }
            if (!dup) { mW[n] = w; mK[n] = k; mD[n] = hyp2(w.x0 + (bx + 0.5) * BM - x, w.z0 + (bz + 0.5) * BM - z); n++; }
          }
        }
        if (px >= xe) break;
      }
      if (pz >= ze) break;
    }
    while (n > 0) {
      let bq = 0; for (let q = 1; q < n; q++) if (mD[q] < mD[bq]) bq = q;
      if (built && performance.now() - t0 > budgetMs) break;
      buildBlock(mW[bq], mK[bq] & 7, mK[bq] >> 3); built++;
      n--; mW[bq] = mW[n]; mK[bq] = mK[n]; mD[bq] = mD[n];
    }
    for (let q = 0; q < 64; q++) mW[q] = null;
    return n;
  }
  // free blocks that are far from the camera (a drive across the city must not keep every block it ever drew)
  function evictBlocks(x, z, r) {
    wts.forEach(w => {
      for (let k = 0; k < w.blocks.length; k++) {
        if (w.blocks[k] === null) continue;
        if (hyp2(w.x0 + ((k & 7) + 0.5) * BM - x, w.z0 + ((k >> 3) + 0.5) * BM - z) > r) w.blocks[k] = null;
      }
    });
  }
  world.onTile((kind, t) => { if (kind === 'full') pendingTiles.push(t); else unregister(t); });
  const idleAt = (x, z) => { const w = wtAt(x, z); return w === null ? undefined : w.idle.get(rgk(Math.floor(x / IG), Math.floor(z / IG))); };
  // ======================================================================== density map (people per m2 of walkable ground)
  const [AX0, AZ0, AX1, AZ1] = D.streets.aoi;               // the baked centro: where the hand-stamped crowd hot spots live
  const DC = 8, DNX = Math.ceil((AX1 - AX0) / DC), DNZ = Math.ceil((AZ1 - AZ0) / DC);
  const BASE = 0.005, dens = new Float32Array(DNX * DNZ).fill(BASE), zone = new Uint8Array(DNX * DNZ), stD = new Uint8Array(DNX * DNZ);   // zones: 0 vicoli, 1 main street, 2 market, 3 tourist, 4 match-day
  const stamp = (x, z, r, v, zn, dn = dens, zo = zone, fl = stD) => {
    const i0 = Math.max(0, Math.floor((x - r - AX0) / DC)), i1 = Math.min(DNX - 1, Math.floor((x + r - AX0) / DC));
    const j0 = Math.max(0, Math.floor((z - r - AZ0) / DC)), j1 = Math.min(DNZ - 1, Math.floor((z + r - AZ0) / DC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = hyp2(AX0 + (i + 0.5) * DC - x, AZ0 + (j + 0.5) * DC - z); if (d > r) continue;
      const f = 1 - d / r, vv = BASE + (v - BASE) * Math.min(1, f * 1.6), k = j * DNX + i;
      if (vv > dn[k]) { dn[k] = vv; zo[k] = zn; fl[k] = 1; }
    }
  };
  {
    const KX = Math.cos(38.11572 * Math.PI / 180) * 111320, KZ = 110540, pr = (la, lo) => [(lo - 13.36126) * KX, -(la - 38.11572) * KZ];
    const hot = (la, lo, r, v, zn) => { const [x, z] = pr(la, lo); stamp(x, z, r, v, zn); };
    hot(38.115684, 13.36146, 100, 0.05, 1);    // Quattro Canti
    hot(38.1151, 13.3622, 60, 0.05, 3);        // Piazza Pretoria
    hot(38.1199, 13.3573, 85, 0.05, 3);        // Teatro Massimo
    hot(38.1146, 13.3558, 70, 0.04, 3);       // Cattedrale
    hot(38.1092, 13.3655, 60, 0.03, 1);        // Stazione
    stamp(-60, 410, 105, 0.14, 2);             // Ballaro
    stamp(260, -220, 110, 0.14, 2);            // Vucciria / Garraffello
    stamp(-390, -245, 90, 0.1, 2);            // Capo
    stamp(-450, -930, 120, 0.06, 4);           // Politeama / Via Liberta: match-day crowds in pink
    const MAIN = /Maqueda|Vittorio Emanuele|Via Roma/i, MARKET = /Ballar|Albergheria|Bandiera|Sant'Agostino|Beati Paoli|Maccheronai|Chiavettieri|Garraffello|Materassai|Tavola Tonda|Caracciolo|Lattarini/i;
    const FANS = /Ruggero Settimo|Mariano Stabile|Principe di Belmonte|Magliocco|Michele Amari|Liberta|Libert/i;
    for (const r of D.roads || []) {
      let v = 0, zn = 0, rad = 14;
      if (r.n && FANS.test(r.n)) { v = r.k === 'pedestrian' ? 0.05 : 0.03; zn = 4; rad = 20; }
      else if (r.n && MAIN.test(r.n)) { v = r.k === 'pedestrian' ? 0.05 : 0.025; zn = 1; rad = 22; }
      else if (r.n && MARKET.test(r.n)) { v = 0.12; zn = 2; rad = 18; }
      else if (r.k === 'pedestrian') { v = 0.02; zn = 1; rad = 12; }
      if (!v) continue;
      const p = r.p;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l = hyp2(dx, dz), n = Math.max(1, Math.ceil(l / 8));
        for (let s = 0; s <= n; s++) stamp(p[i] + dx * s / n, p[i + 1] + dz * s / n, rad, v, zn);
      }
    }
  }
  // after dark: quieter streets, an empty market, and the movida (zone 5) around Piazza Sant'Anna and the Vucciria
  const densN = new Float32Array(dens.length), zoneN = zone.slice(), stN = stD.slice();
  {
    const SCN = [0.55, 0.6, 0.3, 0.45, 0.4, 1], KX = Math.cos(38.11572 * Math.PI / 180) * 111320, KZ = 110540, pr = (la, lo) => [(lo - 13.36126) * KX, -(la - 38.11572) * KZ];
    for (let k = 0; k < dens.length; k++) densN[k] = Math.max(0.0025, dens[k] * SCN[zone[k]]);
    const hotN = (la, lo, r, v, zn) => { const [x, z] = pr(la, lo); stamp(x, z, r, v, zn, densN, zoneN, stN); };
    hotN(38.1149181, 13.3651434, 80, 0.07, 5);      // side streets around Piazza Sant'Anna (Kalsa)
    hotN(38.1149181, 13.3651434, 36, 0.24, 5);      // Piazza Sant'Anna: packed
    hotN(38.1179401, 13.3649292, 55, 0.14, 5);      // Piazza Garraffello (Vucciria)
    hotN(38.1176395, 13.363446, 40, 0.18, 5);       // Taverna Azzurra, Discesa Maccheronai
    hotN(38.1113556, 13.3615778, 95, 0.10, 2);      // Ballaro: busy with the evening crowd
    hotN(38.1186189, 13.3540701, 80, 0.06, 2);      // Capo
  }
  let nightCrowd = false;                                 // which map and mix are live (see setTime below)
  // ======================================================================== district crowds
  // Outside the hand-stamped centro hot spots (above), the crowd comes from the district under the camera: districts.js zoneAt gives the
  // neighbourhood, DPROF maps it to one of the profiles below, and a profile is a day/night density, how willing people are to walk on
  // grass or sand, and a multiplier table over the variant weights of the base zone column (0 vicoli, 1 main street, 2 market, 3 tourist).
  // Zone codes 0..5 are the stamped centro zones, 6 + n is profile n.
  const GROUPS = {
    market: ['vendor', 'vendor2', 'fruttivendolo', 'pescivendolo', 'macellaio'],
    tour: ['tourist', 'tourist2', 'suora', 'priest', 'vigile', 'cameriere'],
    beach: ['beach_m', 'beach_w', 'amico1_mondello', 'amico2_mondello'],
    fans: ['tifoso', 'tifoso2', 'tifosa', 'tifoso_kid', 'tifoso_nonno', 'amico1_rosanero', 'amico2_rosanero'],
    kids: ['kid', 'kid2', 'scuola', 'mamma'],
    young: ['teen', 'teen2', 'ragazzo', 'ragazzo2', 'skinny', 'tuta', 'motorino', 'motorina'],
    elders: ['nonna', 'nonna2', 'nonna3', 'nonno', 'nonno_gilet', 'coppola', 'coppola2'],
    biz: ['suit', 'suit2', 'signora', 'signora2', 'shopper', 'borsa'],
    law: ['carabiniere', 'vigile'],
    run: ['jogger', 'jogger2'],
    dogs: ['dogwalker', 'dogwalker2', 'dogwalker3'],
  };
  //          row: base zone column; day / night: people per m2 of walkable ground; g: [density factor on grass or sand, chance of stepping back off it, path penalty]
  //          m: [[group or variant id, multiplier], ...]; add: absolute day weights; addN: absolute night weights
  const PROFILES = {
    main:   { row: 1, day: 0.012, night: 0.007, g: [0.35, 0.7, 0.7], m: [], add: { dogwalker: 0.4 }, addN: { dogwalker: 0.5 } },
    vicoli: { row: 0, day: 0.006, night: 0.0035, g: [0.35, 0.7, 0.7], m: [['market', 0.3]], add: { dogwalker: 0.3 }, addN: { dogwalker: 0.3 } },
    // Via della Liberta and the grid behind it: shoppers and office workers, no market, few tourists
    lib:    { row: 1, day: 0.007, night: 0.0045, g: [0.35, 0.7, 0.7], m: [['market', 0.08], ['tour', 0.35], ['shopper', 4], ['signora', 2], ['signora2', 2], ['borsa', 2], ['suit', 1.8], ['suit2', 1.8], ['fans', 0.5], ['young', 1.2]], add: { dogwalker: 0.5, jogger: 0.4 }, addN: { dogwalker: 0.6 } },
    // working-class quarters of Noce, Zisa, Oreto, Brancaccio, Uditore, Rigano, the outskirts: locals, elders, kids
    local:  { row: 0, day: 0.0055, night: 0.003, g: [0.4, 0.6, 0.6], m: [['tour', 0.12], ['law', 0.5], ['market', 0.35], ['biz', 0.55], ['kids', 1.4], ['elders', 1.4], ['fans', 0.8]], add: { dogwalker: 0.5 }, addN: { dogwalker: 0.4 } },
    // ZEN: kids and teenagers outside, mopeds, no tourists, nobody in a suit
    zen:    { row: 0, day: 0.008, night: 0.0045, g: [0.6, 0.35, 0.35], m: [['tour', 0.03], ['law', 0.3], ['biz', 0.2], ['market', 0.25], ['kids', 3], ['young', 2.6], ['elders', 0.9], ['mamma', 1.5], ['fans', 1.3]], add: {}, addN: {} },
    // CEP and Borgo Nuovo: the same, a little calmer
    cep:    { row: 0, day: 0.0065, night: 0.003, g: [0.5, 0.4, 0.4], m: [['tour', 0.05], ['law', 0.4], ['biz', 0.4], ['market', 0.3], ['kids', 2], ['young', 1.7], ['elders', 1.1], ['fans', 1]], add: { dogwalker: 0.3 }, addN: {} },
    // Mondello: bathers in swimwear and straw hats, families, ice cream
    beach:  { row: 3, day: 0.011, night: 0.004, g: [1, 0.05, 0.1], m: [['tour', 0.35], ['law', 0.3], ['biz', 0.3], ['beach', 9], ['kids', 2.5], ['elders', 0.5], ['fans', 0], ['market', 0.4], ['young', 1.2]], add: { jogger: 0.8, dogwalker: 0.6 }, addN: { dogwalker: 0.8 } },
    // the lido and the Mondello seafront in summer: packed
    lido:   { row: 3, day: 0.026, night: 0.006, g: [1, 0.03, 0.1], m: [['tour', 0.2], ['law', 0.3], ['biz', 0.2], ['beach', 14], ['kids', 3.5], ['elders', 0.4], ['fans', 0], ['market', 0.5], ['young', 1.5]], add: { jogger: 0.6 }, addN: {} },
    // Sferracavallo, Arenella, Acquasanta: fishing villages, seafront walkers
    coast:  { row: 0, day: 0.0065, night: 0.003, g: [0.8, 0.2, 0.3], m: [['tour', 0.4], ['law', 0.4], ['biz', 0.45], ['beach', 3], ['elders', 1.6], ['pescivendolo', 3], ['macellaio', 0], ['fruttivendolo', 0.2], ['fans', 0.8]], add: { dogwalker: 0.6, jogger: 0.5 }, addN: { dogwalker: 0.4 } },
    // La Favorita: joggers, dog walkers, families, pensioners
    park:   { row: 0, def: 0.22, day: 0.0028, night: 0.0012, g: [1, 0.04, 0.05], m: [['market', 0], ['tour', 0.25], ['law', 0.2], ['biz', 0.1], ['kids', 1.6], ['elders', 1.4], ['young', 1.1], ['fans', 0.3], ['tuta', 3], ['scuola', 0.2]], add: { jogger: 7, jogger2: 6, dogwalker: 7, dogwalker2: 6, dogwalker3: 4 }, addN: { dogwalker: 1.2, dogwalker2: 1, jogger: 0.4 } },
    // Monte Pellegrino and the countryside: a few pilgrims, hikers and a kiosk
    rural:  { row: 3, def: 0.6, day: 0.0013, night: 0.0003, g: [1, 0.03, 0.03], m: [['tour', 2], ['priest', 2], ['market', 0.3], ['biz', 0.1], ['beach', 0.2], ['kids', 0.4], ['fans', 0.1], ['young', 0.6], ['elders', 1.2]], add: { jogger: 0.6 }, addN: {} },
    // the port, the shipyards and Brin: workers on foot, few strollers
    port:   { row: 1, day: 0.004, night: 0.0015, g: [0.5, 0.5, 0.5], m: [['market', 0.2], ['tour', 0.4], ['kids', 0.3], ['biz', 0.6], ['tuta', 3], ['motorino', 2], ['fans', 0.4]], add: {}, addN: {} },
  };
  const PNAMES = Object.keys(PROFILES), NZ = 6 + PNAMES.length;
  const DPROF = { corso: 'main', roma: 'main', centro: 'main', politeama: 'main', stazione: 'main', corsoMille: 'main', old: 'vicoli', alberg: 'vicoli', kalsa: 'vicoli', borgoV: 'vicoli',
    noce: 'local', zisa: 'local', oreto: 'local', brancaccio: 'local', uditore: 'local', rigano: 'local', periph: 'local', tn: 'local', valdesi: 'local', viaLib: 'lib', sacco: 'lib', resut: 'lib', fiera: 'lib',
    zen: 'zen', cep: 'cep', mondello: 'beach', lido: 'lido', sferra: 'coast', arenella: 'coast', acquasanta: 'coast', favorita: 'park', rural: 'rural', porto: 'port', brin: 'port' };
  const PIDX = {}; for (const n in DPROF) PIDX[n] = PNAMES.indexOf(DPROF[n]);
  const DEFP = PNAMES.indexOf('local');
  const profDay = new Float32Array(PNAMES.length), profNight = new Float32Array(PNAMES.length);
  PNAMES.forEach((n, p) => { profDay[p] = PROFILES[n].day; profNight[p] = PROFILES[n].night; });
  const MAXD = 0.14;
  // variant weights by zone, in the order of VARIANTS (nonna, coppola, vendor, tourist, kid, teen, priest, carabiniere, signora, suit, nonno, borsa, ragazzo, fruttivendolo, then the colour variants)
  const VW = [0, 1, 2, 3, 4, 5].map(z => VARIANTS.map(v => v.w[z]));    // crowd mix per zone by day, set in assets/peds/sprites.js
  const VWN = [0, 1, 2, 3, 4, 5].map(z => VARIANTS.map(v => v.wn[z]));  // and after dark
  const GK = new Float32Array(NZ).fill(0.35), GE = new Float32Array(NZ).fill(0.7), GP = new Float32Array(NZ).fill(0.7);   // grass: density factor, chance of stepping back off it, path penalty per cell
  GK[2] = 1; GE[2] = 0.1;
  PNAMES.forEach(n => {
    const P = PROFILES[n], mul = {};
    const dm = P.def ?? 1;   // def: multiplier on every variant (a park is mostly joggers and dogs, not the whole city); the table multiplies on top
    for (const [g, f] of P.m) for (const id of GROUPS[g] || [g]) mul[id] = (mul[id] ?? dm) * f;
    VW.push(VARIANTS.map(v => v.w[P.row] * (mul[v.id] ?? dm) + (P.add[v.id] || 0) / v.n));
    VWN.push(VARIANTS.map(v => v.wn[P.row] * (mul[v.id] ?? dm) + (P.addN[v.id] || 0) / v.n));
    const z = VW.length - 1; GK[z] = P.g[0]; GE[z] = P.g[1]; GP[z] = P.g[2];
  });
  const VWsum = VW.map(w => w.reduce((a, b) => a + b, 0)), VWNsum = VWN.map(w => w.reduce((a, b) => a + b, 0));
  const WCV = VARIANTS.findIndex(v => v.id === 'wheelchair'), HEALV = VARIANTS.findIndex(v => v.id === 'healed'), CHAIRV = VARIANTS.findIndex(v => v.id === 'chair_empty');
  const STRIDE = VARIANTS.map(v => v.run ? 3 : 1.5); STRIDE[HEALV] = 3.2;   // metres per walk cycle: runners take longer strides
  const chairs = [];                                      // empty wheelchairs left behind by the miracle (see heal())
  // a person of the crowd mix; entries the far atlas has not drawn yet are asked for first and replaced by one that is ready (a few frames at the start)
  const pickVariant = zn => {
    const w = nightCrowd ? VWN[zn] : VW[zn], sum = nightCrowd ? VWNsum[zn] : VWsum[zn];
    for (let tries = 0; tries < 12; tries++) {
      let r = Math.random() * sum, i = 0; for (; i < w.length; i++) if ((r -= w[i]) <= 0) break;
      if (i >= w.length) i = 0;
      if (atlas.farDone[i]) return i;
      atlas.prioritise(i);
    }
    for (let i = 0; i < w.length; i++) if (atlas.farDone[i] && w[i] > 0) return i;
    return -1;
  };
  const IDLE_RATE = new Float32Array(NZ).fill(0.03); IDLE_RATE.set([0.015, 0.03, 0.08, 0.05, 0.06, 0.12]);            // chance per second of stopping for a while
  for (const n of ['park', 'beach', 'lido']) IDLE_RATE[6 + PNAMES.indexOf(n)] = 0.05;
  // district of a spot, cached per 31 m cell of its tile (zoneAt scans every district seed)
  const distAt = (x, z) => {
    const w = wtAt(x, z); if (w === null) return DEFP;
    const k = (((z - w.z0) / DZ) | 0) * (WTS / DZ) + (((x - w.x0) / DZ) | 0);
    let p = w.dz[k]; if (p === 255) { const q = PIDX[districtAt(x, z, '', 999)]; w.dz[k] = p = q === undefined ? DEFP : q; }
    return p;
  };
  // people per m2 and zone code at a spot: the centro hot spots where one is stamped, the district profile elsewhere
  const densAt = (x, z) => {
    const i = Math.floor((x - AX0) / DC), j = Math.floor((z - AZ0) / DC);
    if (i >= 0 && j >= 0 && i < DNX && j < DNZ) { const k = j * DNX + i; if (nightCrowd ? stN[k] : stD[k]) return (nightCrowd ? densN : dens)[k]; }
    const p = distAt(x, z); return nightCrowd ? profNight[p] : profDay[p];
  };
  const zoneCode = (x, z) => {
    const i = Math.floor((x - AX0) / DC), j = Math.floor((z - AZ0) / DC);
    if (i >= 0 && j >= 0 && i < DNX && j < DNZ) { const k = j * DNX + i; if (nightCrowd ? stN[k] : stD[k]) return (nightCrowd ? zoneN : zone)[k]; }
    return 6 + distAt(x, z);
  };

  // ======================================================================== time of day
  // The day/night work publishes game.time {hour, isNight, dusk} and fires window 'pd-time' {hour, isNight, dusk}; both are read
  // defensively and the default is daytime. nightCrowd flips the crowd map and mix; nightK (0..1) eases the sprites' light.
  let nightTarget = 0, nightK = 0, hourNow = null, purgeT = 0, purgeAt = 0, lastNight, lastIsNight;
  const setCrowdNight = b => { if (b === nightCrowd) return; nightCrowd = b; targetT = 0; purgeT = 45; };
  function setTime(t) {
    if (!t || typeof t !== 'object') return;
    if (Number.isFinite(t.hour)) hourNow = t.hour;
    // game.time (src/daynight.js): night 0..1 (1 = dark), isNight, dusk 0..1; older shapes with only isNight/dusk/hour still work
    const n = typeof t.night === 'number' ? clamp(t.night, 0, 1) : t.isNight === true ? 1 : typeof t.dusk === 'number' ? t.dusk * 0.5 : t.dusk ? 0.5 : 0;
    const night = typeof t.isNight === 'boolean' ? t.isNight : n >= 0.5;
    nightTarget = night ? Math.max(n, 0.9) : n; setCrowdNight(night || n >= 0.35);
  }
  let gameRef = env.game || null;
  addEventListener('pd-time', e => setTime(e.detail));
  const AMB_D = new THREE.Color(0.66, 0.68, 0.72), AMB_N = new THREE.Color(0.4, 0.43, 0.56), SUN_D = new THREE.Color(0.62, 0.5, 0.36), SUN_N = new THREE.Color(0, 0, 0);

  // ======================================================================== sprite rendering
  let rendererRef = null;                                  // the renderer reaches us through onBeforeRender (main.js does not hand it over); atlas uploads wait for it
  const NEAR_CELLS = params.has('pednear') ? Math.max(0, +params.get('pednear') | 0) * 16 : (matchMedia('(pointer: coarse)').matches ? 136 : 238);   // near atlas size in cells (about 16 per person); ?pednear=n people
  const atlas = LPC ? createLpcAtlas(VARIANTS, new URL('../assets/peds/lpc/', import.meta.url).href) : createPedAtlas(VARIANTS, { nearCells: Math.max(NEAR_CELLS, 18) });
  const hasNear = !LPC && NEAR_CELLS > 0;
  const farSz = atlas.farSz || new THREE.Vector2(atlas.farW, atlas.farH);
  stats.atlas = atlas.stats;
  const quadPos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), quadUv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);   // column, row, size, roll
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);   // fade, sun, brightness
  const mkGeo = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(quadPos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(quadUv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', aPos); g.setAttribute('iA', aA); g.setAttribute('iB', aB);
    g.instanceCount = 0; return g;
  };
  const spriteMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapFar: { value: atlas.far }, mapNear: { value: atlas.near }, uFarSz: { value: farSz }, uNearSz: { value: new THREE.Vector2(atlas.nearW, atlas.nearH) }, uPx: { value: PX },
      uAmb: { value: new THREE.Color(0.66, 0.68, 0.72) }, uSun: { value: new THREE.Color(0.62, 0.5, 0.36) } }]),
    vertexShader: `
      attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB;
      uniform vec2 uFarSz; uniform vec2 uNearSz; uniform float uPx;
      varying vec2 vUvF; varying vec2 vUvN; varying float vNear; varying float vFade; varying float vSun; varying float vBright; varying float vY; varying float vClip;
      #include <fog_pars_vertex>
      void main() {
        vY = position.y; vClip = iB.w;   // iB.w: hide the lower part of the sprite (seated passengers show no legs); 0 for the crowd
        vec2 t = cameraPosition.xz - iPos.xz; float l = length(t);
        t = l > 1e-4 ? t / l : vec2(0.0, 1.0);
        vec3 right = vec3(t.y, 0.0, -t.x);
        vec2 loc = vec2(position.x * ${CELL_W}.0 * uPx * iA.z, position.y * ${CELL_H}.0 * uPx * iA.z - ${GROUND}.0 * uPx * iA.z);
        float c = cos(iA.w), s = sin(iA.w);
        vec2 r = vec2(c * loc.x - s * loc.y, s * loc.x + c * loc.y);
        vec3 wp = iPos + right * r.x + vec3(0.0, 1.0, 0.0) * r.y;
        // iA.x: texel x of the cell + 4096 when mirrored + 8192 when it lives in the near atlas; iA.y: texel y of the cell
        float code = iA.x, near = step(8192.0, code); code -= near * 8192.0; float mir = step(4096.0, code); code -= mir * 4096.0;
        float ux = mix(uv.x, 1.0 - uv.x, mir);
        vUvF = (vec2(code, iA.y) + vec2(ux * ${CELL_W}.0, (1.0 - uv.y) * ${CELL_H}.0)) / uFarSz;
        vUvN = (vec2(code, iA.y) + vec2(ux * ${CELL_W * 3}.0, (1.0 - uv.y) * ${CELL_H * 3}.0)) / uNearSz;
        vNear = near;
        vFade = iB.x; vSun = iB.y; vBright = iB.z;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D mapFar; uniform sampler2D mapNear; uniform vec3 uAmb; uniform vec3 uSun;
      varying vec2 vUvF; varying vec2 vUvN; varying float vNear; varying float vFade; varying float vSun; varying float vBright; varying float vY; varying float vClip;
      #include <fog_pars_fragment>
      void main() {
        if (vY < vClip) discard;
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (vFade < ign) discard;
        vec4 cf = texture2D(mapFar, vUvF), cn = texture2D(mapNear, vUvN);
        vec4 c = vNear > 0.5 ? cn : cf;
        if (c.a < 0.4) discard;
        c.rgb = pow(c.rgb, vec3(2.2));   // the atlases hold sRGB in 5 bits per channel: back to linear
        gl_FragColor = vec4(c.rgb * (uAmb + uSun * vSun) * vBright, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  spriteMat.uniforms.mapFar.value = atlas.far; spriteMat.uniforms.mapNear.value = atlas.near; spriteMat.uniforms.uFarSz.value = farSz;   // UniformsUtils.merge clones textures: the atlases must be the very ones the uploads go into
  const sprites = new THREE.Mesh(mkGeo(), spriteMat); sprites.frustumCulled = false; sprites.renderOrder = 2; scene.add(sprites);
  sprites.onBeforeRender = r => { rendererRef = r; };
  // soft blob shadow lying on the ground, pushed away from the sun
  const shadowUniforms = { uSunDir: { value: new THREE.Vector2(0.92, -0.38) } };
  const shadowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, shadowUniforms]),
    vertexShader: `
      attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB; uniform vec2 uSunDir;
      varying vec2 vP; varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vec2 q = vec2(position.x * 2.0, position.y * 2.0 - 1.0);
        vec2 along = uSunDir, across = vec2(-uSunDir.y, uSunDir.x);
        vec2 off = (along * q.y * 0.85 + across * q.x * 0.5) * iA.z + along * 0.3;
        vec3 wp = vec3(iPos.x + off.x, iPos.y + 0.03, iPos.z + off.y);
        vP = q; vA = iB.x * mix(0.14, 0.5, iB.y) * (iA.w == 0.0 ? 1.0 : 0.6);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec2 vP; varying float vA;
      #include <fog_pars_fragment>
      void main() {
        float d = dot(vP, vP); if (d > 1.0) discard;
        gl_FragColor = vec4(0.05, 0.04, 0.06, vA * (1.0 - d));
        #include <fog_fragment>
      }`,
  });
  const shadows = new THREE.Mesh(mkGeo(), shadowMat); shadows.frustumCulled = false; shadows.renderOrder = 1; scene.add(shadows);

  // ======================================================================== simulation state
  const N = { n: 0 };
  const F = n => new Float32Array(n), U = n => new Uint8Array(n);
  const X = F(CAP), Z = F(CAP), Y = F(CAP), TH = F(CAP), THT = F(CAP), NUDGE = F(CAP), V = F(CAP), V0 = F(CAP), PH = F(CAP), AGE = F(CAP);
  const VX = F(CAP), VZ = F(CAP), VY = F(CAP), HOP = F(CAP), ROLL = F(CAP), RD = F(CAP), TMR = F(CAP), STEER = F(CAP), TRAV = F(CAP), NEXTT = F(CAP);
  const SHT = F(CAP), SHC = F(CAP), BRI = F(CAP), SIZE = F(CAP), REACT = F(CAP), WAITT = F(CAP), TFLY = F(CAP);
  const ST = U(CAP), VAR = U(CAP), ZN = U(CAP), CLS = U(CAP), TICK = U(CAP), NEARF = U(CAP);
  const LEAVE = F(CAP).fill(-1);                        // >= 0: fading out (a day crowd member going home at dusk, or the reverse at dawn)
  const MIR = F(CAP);                                   // team-bus miracle countdown (seconds left standing up), 0 when seated
  const BUS = U(CAP);                                   // 1: waiting at a bus stop (moans about the bus when the lapa drives by)
  const copyArrs = [X, Z, Y, TH, THT, NUDGE, V, V0, PH, AGE, VX, VZ, VY, HOP, ROLL, RD, TMR, STEER, TRAV, NEXTT, SHT, SHC, BRI, SIZE, REACT, WAITT, TFLY, ST, VAR, ZN, CLS, TICK, NEARF, MIR, LEAVE, BUS];
  // ======================================================================== level of detail
  // The near atlas has three texels per design unit; it only helps when a near texel covers about a screen pixel or more, so the people close enough for that
  // (this depends on the screen: a phone at 1.25 pixel ratio gets about 8 m, a desktop at 1.5 about 17 m) ask for a near slot of their cast entry, and use it once built.
  let lodX = 0, lodY = 0, lodSee = true, lodNear = false, lodK = 1, lodFrame = 0, lodClock = 0, lodFwdX = 0, lodFwdZ = 1, lodCx = 0, lodCz = 0;
  const NEAR_IN = 0.8, NEAR_OUT = 0.6;
  function lodBegin(cam) {
    const H = rendererRef ? rendererRef.domElement.height : innerHeight * devicePixelRatio;
    lodK = H * 0.5 * cam.projectionMatrix.elements[5] * (PX / 3); lodFrame++; lodFwdX = camFwdX; lodFwdZ = camFwdZ; lodCx = cam.position.x; lodCz = cam.position.z;
  }
  function lodPick(v, dir, pose, dist, size, prevNear) {
    const m = dir === 3 ? 4096 : 0, c6 = dir === 3 ? 2 : dir; let cid = c6 * POSES + pose;
    if (!atlas.farDone[v]) { atlas.prioritise(v); if (rendererRef) atlas.buildNow(rendererRef, v); }
    lodNear = false;
    if (hasNear) {
      const tp = lodK * size / dist;
      if (tp >= (prevNear ? NEAR_OUT : NEAR_IN)) {
        if (lodSee && tp >= NEAR_IN * 0.95 && atlas.farDone[v]) atlas.want(v, dist);
        if (atlas.nearReady(v)) {
          let a = atlas.nearIdx[v * CELLS_PER_ENTRY + cid]; if (a < 0) { cid = c6 * POSES; a = atlas.nearIdx[v * CELLS_PER_ENTRY + cid]; }
          if (a >= 0) { lodNear = true; lodX = (a % atlas.nearCol) * atlas.NCW + m + 8192; lodY = Math.floor(a / atlas.nearCol) * atlas.NCH; return; }
        }
      }
    }
    let a = atlas.farIdx[v][cid]; if (a < 0 && pose === POSE_SIT_SIP) { cid = c6 * POSES + POSE_SIT; a = atlas.farIdx[v][cid]; } if (a < 0) { cid = c6 * POSES; a = atlas.farIdx[v][cid]; }
    lodX = (a % atlas.farCol) * atlas.FCW + m; lodY = Math.floor(a / atlas.farCol) * atlas.FCH;
  }
  function lodEnd(dt) {
    lodClock += dt;
    if ((lodFrame & 3) === 0) atlas.settle();
    const nr = atlas.stats.farBuilt, boot = atlas.pending() > 0 && !started;
    atlas.pump(rendererRef, 2, boot ? 10 : nr < 400 ? 4 : 1.2);
  }

  // Supplied by the owner, born in Palermo: keep them exactly as written.
  const BUS_LINES = ["minchia avi ru uri c'aspiattu", "quannu passò l'uittimu?"];
  let busT = 3;
  const removeAt = i => { const l = --N.n; if (i !== l) for (const a of copyArrs) a[i] = a[l]; };

  // sun direction (horizontal, towards the sun) from the scene's directional light, for the "am I in a building's shade" test
  let sunH = [-0.92, 0.38], sunTan = Math.tan(26 * Math.PI / 180), sunLight = null, sunScanned = false;
  const readSun = () => {
    if (!sunScanned) { sunScanned = true; scene.traverse(o => { if (o.isDirectionalLight && !sunLight) sunLight = o; }); }
    if (!sunLight) return;
    const dx = sunLight.position.x - sunLight.target.position.x, dy = sunLight.position.y - sunLight.target.position.y, dz = sunLight.position.z - sunLight.target.position.z;
    const l = hyp2(dx, dz); if (l < 1e-3 || dy <= 0) return;
    sunH = [dx / l, dz / l]; sunTan = dy / l;
    shadowUniforms.uSunDir.value.set(-sunH[0], -sunH[1]);
  };
  let sunHit = false;
  const segHit = s => {
    // ray from (rx,rz) along sunH for rl metres against wall segment s
    const ex = s[2] - s[0], ez = s[3] - s[1], den = sunH[0] * ez - sunH[1] * ex; if (Math.abs(den) < 1e-6) return;
    const ax = s[0] - rx0, az = s[1] - rz0, t = (ax * ez - az * ex) / den, u = (ax * sunH[1] - az * sunH[0]) / den;
    if (t > 0.3 && t < rl0 && u >= 0 && u <= 1) sunHit = true;
  };
  let rx0 = 0, rz0 = 0, rl0 = 0;
  const inSun = (x, z) => {
    rx0 = x; rz0 = z; rl0 = 14 / sunTan * 0.75 + 4; if (rl0 > 28) rl0 = 28; sunHit = false;
    const ex = x + sunH[0] * rl0, ez = z + sunH[1] * rl0;
    walls2d.query(Math.min(x, ex), Math.min(z, ez), Math.max(x, ex), Math.max(z, ez), segHit);
    return sunHit ? 0 : 1;
  };

  // free distance (metres) along a heading, 0.5 m steps; runPen counts carriageway cells crossed
  let runPen = 0;
  const run = (x, z, a, maxd) => {
    const sx = Math.sin(a) * 0.5, sz = Math.cos(a) * 0.5; runPen = 0;
    for (let d = 0.5; d <= maxd; d += 0.5) { x += sx; z += sz; const c = cell(x, z); if (!c) return d - 0.5; if (c === 2) runPen++; }
    return maxd;
  };
  const bestHeading = (x, z, base, offs, maxd, pk) => {
    let best = base + Math.PI, bs = 0.4;
    for (const o of offs) {
      const a = base + o, r = run(x, z, a, maxd), s = r - runPen * pk - Math.abs(o) * 0.25 + Math.random() * 1.3;
      if (r >= 1.5 && s > bs) { bs = s; best = a; }
    }
    return best;
  };
  const TURN_OFFS = [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 0.25, -0.25];

  // ======================================================================== spawn / despawn
  let jumpedNow = false, cx = 0, cz = 0, camFwdX = 0, camFwdZ = -1, lastCx = 1e9, lastCz = 1e9, targetN = 0, targetT = 0, started = false, frameNo = 0;
  const idleTmp = [];
  function spawn(initial) {
    if (N.n >= CAP) return false;
    const R = quality.R;
    const a = Math.random() * TAU, rmin = initial ? 8 : R * 0.45, r = Math.sqrt(rmin * rmin + Math.random() * (R * R - rmin * rmin));
    let x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!initial) { const dx = x - cx, dz = z - cz, l = hyp2(dx, dz) || 1; if ((dx * camFwdX + dz * camFwdZ) / l > 0.5 && r < R * 0.85) return false; }
    let atIdle = false, face = 0, bus = false;
    if (Math.random() < 0.28) {               // cluster around a cafe, bench or bus stop
      const arr = idleAt(x, z);
      if (arr) {
        const it = arr[(Math.random() * arr.length) | 0], b = Math.random() * TAU, d = rand(1.2, 2.6);
        const nx = it.x + Math.cos(b) * d, nz = it.z + Math.sin(b) * d;
        if (hyp2(nx - cx, nz - cz) < R && cell(nx, nz) === 1) { x = nx; z = nz; atIdle = true; bus = it.k === 'busstop'; face = Math.atan2(it.x - nx, it.z - nz) + rand(-0.6, 0.6); }
      }
    }
    const cl = cell(x, z); if (!cl) return false;
    if (!atIdle) {
      // streets get more people per m2 than open piazze (crowds line up along streets)
      let open = 0; for (let k = 0; k < 8; k++) if (cell(x + Math.cos(k * 0.785) * 5, z + Math.sin(k * 0.785) * 5)) open++;
      const dn = densAt(x, z) * (cl === 2 ? GK[zoneCode(x, z)] : cl === 3 ? 0.5 : 1) * (2.1 - open * 0.17);
      if (Math.random() * MAXD > dn) return false;
    }
    if (hyp2(x - car.x, z - car.z) < 3.5) return false;
    // not on top of someone else
    for (let j = 0; j < N.n; j++) if (Math.abs(X[j] - x) < 0.5 && Math.abs(Z[j] - z) < 0.5) return false;
    const zn = zoneCode(x, z), chat = nightCrowd && zn === 5 && cl === 1 && !atIdle && Math.random() < 0.75;
    if (chat) { atIdle = true; face = Math.random() * TAU; }
    if (addAgent(x, z, cl, zn, atIdle, face, chat ? rand(25, 90) : rand(6, 40)) < 0) return false;
    if (bus) BUS[N.n - 1] = 1;
    if (chat) {   // a few friends around, standing in a ring and chatting
      const k = 1 + ((Math.random() * 3) | 0);
      for (let m = 0; m < k && N.n < CAP; m++) {
        const b = Math.random() * TAU, d = rand(0.8, 1.3), nx = x + Math.cos(b) * d, nz = z + Math.sin(b) * d;
        if (cell(nx, nz) !== 1 || hyp2(nx - car.x, nz - car.z) < 3.5) continue;
        let ok = true; for (let j = 0; j < N.n; j++) if (Math.abs(X[j] - nx) < 0.5 && Math.abs(Z[j] - nz) < 0.5) { ok = false; break; }
        if (ok) addAgent(nx, nz, 1, zn, true, Math.atan2(x - nx, z - nz) + rand(-0.4, 0.4), rand(25, 90));
      }
    }
    return true;
  }
  function addAgent(x, z, cl, zn, atIdle, face, tmr) {
    const vi = pickVariant(zn); if (vi < 0) return -1;
    const i = N.n++, v = VARIANTS[vi];
    BUS[i] = 0;
    X[i] = x; Z[i] = z; Y[i] = groundY(x, z) + (raisedMask(x, z) ? CURB : 0); VAR[i] = vi; ZN[i] = zn; CLS[i] = cl; LEAVE[i] = -1; MIR[i] = 0;
    TH[i] = atIdle ? face : bestHeading(x, z, Math.random() * TAU, [0, 0.4, -0.4, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.1], 8, GP[zn]);
    THT[i] = TH[i]; NUDGE[i] = 0; V[i] = 0; V0[i] = (v.speed || 1.1) * rand(0.85, 1.15); PH[i] = Math.random(); AGE[i] = !started || jumpedNow ? 5 : 0;
    VX[i] = VZ[i] = VY[i] = HOP[i] = ROLL[i] = 0; RD[i] = 1; TMR[i] = atIdle ? tmr : 0; STEER[i] = Math.random() * 0.1; TRAV[i] = 0; NEXTT[i] = rand(10, 35);
    SHC[i] = SHT[i] = inSun(x, z); BRI[i] = rand(0.92, 1.08); SIZE[i] = rand(0.96, 1.04); REACT[i] = -1; WAITT[i] = 0; TFLY[i] = 0;
    ST[i] = atIdle ? IDLE : WALK; TICK[i] = (Math.random() * 5) | 0;
    if (!atIdle) V[i] = V0[i];
    return i;
  }

  // expected crowd from the density map over the walkable area around the camera
  function estimateTarget() {
    const R = quality.R; let sum = 0; const S = 56;
    for (let k = 0; k < S; k++) {
      const a = Math.random() * TAU, r = R * Math.sqrt(Math.random()), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, c = cell(x, z);
      if (c) sum += densAt(x, z) * (c === 2 ? GK[zoneCode(x, z)] : c === 3 ? 0.5 : 1);
    }
    const alt = camera.position.y - groundY(cx, cz), altK = clamp(1 - (alt - 40) / 200, 0.4, 1);
    return Math.min(quality.cap, Math.round(sum / S * Math.PI * R * R * altK * 1.8));
  }

  // ======================================================================== behaviour
  let agents = [], carSpd = 0;
  function trafficNear(x, z, rad) {
    for (let k = 0; k < agents.length; k++) { const a = agents[k], r = (a.r || 1.2) + rad, dx = a.x - x, dz = a.z - z; if (dx * dx + dz * dz < r * r) return true; }
    if (carSpd > 2 && (car.x - x) ** 2 + (car.z - z) ** 2 < (rad + 3.5) ** 2) return true;
    return false;
  }
  function steer(i, dt10) {
    const x = X[i], z = Z[i];
    let cl = cell(x, z); CLS[i] = cl;
    if (!cl) { // squeezed into a wall: find the nearest free cell
      for (let d = 0.5; d <= 3; d += 0.5) for (let k = 0; k < 8; k++) { const a = k * TAU / 8, nx = x + Math.sin(a) * d, nz = z + Math.cos(a) * d; if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; return; } }
      AGE[i] = -999; return;      // nowhere to go: despawn
    }
    if (++TICK[i] % 5 === 0) SHT[i] = inSun(x, z);
    const st = ST[i];
    if (st === IDLE) {
      TMR[i] -= dt10;
      if (TMR[i] <= 0) { ST[i] = WALK; THT[i] = TH[i] + (Math.random() < 0.5 ? rand(-0.5, 0.5) : Math.PI + rand(-0.6, 0.6)); V0[i] = (VARIANTS[VAR[i]].speed || 1.1) * rand(0.85, 1.15); }
      else if (Math.random() < 0.02) THT[i] = TH[i] + rand(-1.2, 1.2);
      return;
    }
    if (st === WAIT) {
      WAITT[i] += dt10;
      if (!trafficNear(x + Math.sin(TH[i]) * 3, z + Math.cos(TH[i]) * 3, 1.2) || WAITT[i] > 9) { ST[i] = WALK; WAITT[i] = -6; }
      return;
    }
    if (st !== WALK) return;
    // sometimes stop and look around
    if (Math.random() < IDLE_RATE[ZN[i]] * dt10 && cl === 1 && VAR[i] !== HEALV) { ST[i] = IDLE; TMR[i] = ZN[i] === 5 ? rand(15, 60) : rand(3, 14); return; }
    const t = THT[i], ah = run(x, z, t, 3.2), pen = runPen;
    const ahead = cell(x + Math.sin(t) * 1.4, z + Math.cos(t) * 1.4);
    // about to step off the pavement onto a carriageway: wait for the traffic
    if (cl === 1 && (ahead === 3 || ahead === 2) && WAITT[i] >= 0 && trafficNear(x + Math.sin(t) * 3.5, z + Math.cos(t) * 3.5, 1.5)) { ST[i] = WAIT; WAITT[i] = 0; return; }
    if (WAITT[i] < 0) WAITT[i] = Math.min(0, WAITT[i] + dt10);
    const edge = ah < 2.2 || (cl === 1 && ahead === 2 && Math.random() < GE[ZN[i]]);
    if (edge) { THT[i] = bestHeading(x, z, t, TURN_OFFS, 6, GP[ZN[i]]); TRAV[i] = 0; NEXTT[i] = rand(10, 35); NUDGE[i] = 0; return; }
    // random turn into a side street after a while
    if (TRAV[i] > NEXTT[i]) {
      TRAV[i] = 0; NEXTT[i] = rand(10, 35);
      if (Math.random() < 0.65) { const s = Math.random() < 0.5 ? 1 : -1; if (run(x, z, t + s * 1.57, 7) >= 6) THT[i] = t + s * 1.57; else if (run(x, z, t - s * 1.57, 7) >= 6) THT[i] = t - s * 1.57; }
    }
    // keep off the walls: nudge away from a blocked side
    const px = Math.cos(t), pz = -Math.sin(t), l = cell(x + px * 0.95, z + pz * 0.95), r = cell(x - px * 0.95, z - pz * 0.95);
    NUDGE[i] = !l && r ? -0.4 : l && !r ? 0.4 : 0;
    if (cl === 1 && pen === 0 && Math.random() < 0.02) THT[i] += rand(-0.3, 0.3);
  }

  const pushOut = (i, dx, dz, amt) => { // move a pedestrian along (dx,dz) if the ground allows it
    const nx = X[i] + dx * amt, nz = Z[i] + dz * amt;
    if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; return true; }
    return false;
  };

  // spatial hash for pedestrian-pedestrian spacing
  const HS = 1024, hHead = new Int16Array(HS), hNext = new Int16Array(CAP);
  const hkey = (ix, iz) => ((ix * 73856093) ^ (iz * 19349663)) & (HS - 1);

  function stepDodgeChecks(dt) {
    // car heading towards a pedestrian: hop out of the way after a short reaction time
    const cvx = car.vx, cvz = car.vz, c2 = cvx * cvx + cvz * cvz;
    if (c2 < 12) return;
    const cs = Math.sqrt(c2), ux = cvx / cs, uz = cvz / cs;
    for (let i = 0; i < N.n; i++) {
      const st = ST[i]; if (st >= DODGE) continue;
      const rx = X[i] - car.x, rz = Z[i] - car.z;
      if (rx * rx + rz * rz > 22 * 22) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      const along = rx * ux + rz * uz; if (along < 0.5 || along > cs * 1.7 + 4) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      const lat = rx * uz - rz * ux;               // + : pedestrian is to the left of the car's path (x right, z back)
      if (Math.abs(lat) > 2.0) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      if (REACT[i] === -2) continue;               // decided to stand its ground
      if (REACT[i] < 0) { // first notice
        const v = VARIANTS[VAR[i]]; REACT[i] = Math.random() < (v.phone ? 0.55 : v.chair ? 0 : 0.18) ? -2 : rand(0.1, v.phone ? 0.5 : 0.35); continue;
      }
      REACT[i] -= dt; if (REACT[i] > 0) continue;
      // hop sideways, away from the car's line
      const sg = lat >= 0 ? 1 : -1;       // unit vector perpendicular to the car, on the pedestrian's side
      const px = uz * sg, pz = -ux * sg;
      let dx = px, dz = pz, ok = cell(X[i] + dx * 1.3, Z[i] + dz * 1.3) && cell(X[i] + dx * 2.5, Z[i] + dz * 2.5);
      if (!ok) { dx = -px; dz = -pz; ok = cell(X[i] + dx * 1.3, Z[i] + dz * 1.3) && cell(X[i] + dx * 2.5, Z[i] + dz * 2.5); }
      if (!ok) { REACT[i] = -2; continue; }
      if (VAR[i] === WCV) { heal(i, dx, dz); continue; }
      ST[i] = DODGE; TMR[i] = 0; VX[i] = dx * 5.2; VZ[i] = dz * 5.2; TH[i] = THT[i] = Math.atan2(dx, dz); ROLL[i] = 0; V[i] = 0; REACT[i] = -2; env.shout?.(X[i], Y[i] + 1.9, Z[i], Math.random() < 0.3 ? FLEW : undefined, (() => { const id = i; return () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }); })());
    }
  }

  // The wheelchair gag: the rider leaps up (a dodge hop), the chair stays behind and he sprints off, then jogs.
  function heal(i, dx, dz) {
    if (chairs.length >= 10) chairs.shift();
    chairs.push({ x: X[i], z: Z[i], y: Y[i], th: TH[i], vx: car.vx * 0.3 + dx * 0.8, vz: car.vz * 0.3 + dz * 0.8, t: 0, rd: dx * car.vz - dz * car.vx >= 0 ? 1 : -1, ph: 0, sh: SHC[i] });
    VAR[i] = HEALV; ST[i] = DODGE; TMR[i] = 0; REACT[i] = -2; V0[i] = 6.2; V[i] = 0; VX[i] = dx * 6.2; VZ[i] = dz * 6.2; TH[i] = THT[i] = Math.atan2(dx, dz); NUDGE[i] = 0; WAITT[i] = -6;
    const id = i; env.shout?.(X[i], Y[i] + 1.9, Z[i], 'U PALIEMMU \u00C8 MIRACULUSU!', () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }));
  }
  function updateChairs(dt, cx0, cz0) {
    for (let k = chairs.length - 1; k >= 0; k--) {
      const c = chairs[k]; c.t += dt;
      const sp = hyp2(c.vx, c.vz);
      if (sp > 0.05) {
        const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
        if (cell(nx, nz)) { c.x = nx; c.z = nz; c.ph += sp * dt / 1.5; } else c.vx = c.vz = 0;
        const kf = Math.exp(-1.3 * dt); c.vx *= kf; c.vz *= kf;
      }
      const d = hyp2(c.x - cx0, c.z - cz0);
      if (c.dead || (c.keep && c.t > 3.2) || d > quality.R + 14 || (!c.keep && ((c.t > 30 && d > 35) || c.t > 150))) { chairs.splice(k, 1); continue; }
      c.y += (groundY(c.x, c.z) + (raisedMask(c.x, c.z) ? CURB : 0) - c.y) * Math.min(1, 14 * dt);
    }
  }
  function writeChairs(n, cpx, cpz, fadeStart) {
    const pos = aPos.array, A = aA.array, B = aB.array; let k = 0;
    for (const c of chairs) {
      const i = n + k; if (i >= CAP) break; k++;
      const dxc = cpx - c.x, dzc = cpz - c.z, dist = hyp2(dxc, dzc) || 1, wx = Math.sin(c.th), wz = Math.cos(c.th), tx = dxc / dist, tz = dzc / dist;
      const s = wx * tx + wz * tz, cc = wx * tz - wz * tx, dir = Math.abs(s) >= Math.abs(cc) ? (s > 0 ? 0 : 1) : (cc > 0 ? 3 : 2);
      const u = clamp((c.t - 0.3) / 0.6, 0, 1), tip = c.keep ? 0 : u * u * (3 - 2 * u) * 1.15 * c.rd;     // tips over after the rider bolts
      pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
      lodPick(CHAIRV, dir, hyp2(c.vx, c.vz) > 0.15 ? (Math.floor((c.ph % 1) * 4) & 3) + 1 : 0, dist, 1, false); A[i * 4] = lodX; A[i * 4 + 1] = lodY; A[i * 4 + 2] = 1; A[i * 4 + 3] = tip;
      B[i * 4] = clamp((fadeStart - dist) / 16, 0, 1); B[i * 4 + 1] = c.sh; B[i * 4 + 2] = 1;
    }
    return k;
  }

  // The team bus gag (src/gags.js): a wheelchair user within r of (x, z) stands up, shouts, hops for joy, then sits back down.
  // The empty chair waits beside him (c.keep stops it tipping over). Returns true when someone stood up.
  function miracle(x, z, r) {
    const r2 = r * r;
    for (let i = 0; i < N.n; i++) {
      if (VAR[i] !== WCV || MIR[i] > 0 || ST[i] > WAIT) continue;
      const dx = X[i] - x, dz = Z[i] - z; if (dx * dx + dz * dz > r2) continue;
      if (chairs.length >= 10) chairs.shift();
      const ch = { x: X[i], z: Z[i], y: Y[i], th: TH[i], vx: 0, vz: 0, t: 0, rd: 1, ph: 0, sh: SHC[i], keep: true };
      chairs.push(ch);
      VAR[i] = HEALV; ST[i] = IDLE; V[i] = 0; TMR[i] = 6; MIR[i] = 3.2;
      const id = i; env.shout?.(X[i], Y[i] + 1.9, Z[i], 'Oh Palermo \u00E8 miracoloso!', () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }));
      return true;
    }
    return false;
  }
  function seatAgain(i) {
    if (VAR[i] === HEALV) { VAR[i] = WCV; ST[i] = IDLE; TMR[i] = rand(2, 5); V[i] = 0; HOP[i] = 0; }
  }
  const knockCbs = [];
  function knock(i, nx, nz) {
    for (const f of knockCbs) { try { f(X[i], Z[i], VAR[i]); } catch (e) { /* listener failed: keep playing */ } }
    if (VAR[i] === WCV) { heal(i, nx, nz); return; }
    ST[i] = FLY; TMR[i] = 0; env.shout?.(X[i], Y[i] + 1.9, Z[i], Math.random() < 0.4 ? FLEW : undefined, (() => { const id = i; return () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }); })());
    // launched like a yeeted car (src/traffic.js): high, far and spinning, scaled by the lapa's speed
    const sp = Math.min(hyp2(car.vx, car.vz), 22);
    const vy = Math.min(12.5, Math.max(5.5, 4.5 + sp * 0.55));
    VX[i] = car.vx * 0.9 + nx * 3; VZ[i] = car.vz * 0.9 + nz * 3; VY[i] = vy; TFLY[i] = 2 * vy / 12;
    RD[i] = (car.vx * nz - car.vz * nx) >= 0 ? 1 : -1; ROLL[i] = 0; HOP[i] = 0.05; V[i] = 0;
  }

  // ======================================================================== per-frame update
  const camQ = new THREE.Vector3();
  function update(dt, cam) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.05); frameNo++;
    cam = cam || camera;
    { const gt = gameRef && gameRef.time; if (gt && (gt.night !== lastNight || gt.isNight !== lastIsNight)) { lastNight = gt.night; lastIsNight = gt.isNight; setTime(gt); } }   // only when it changes, so an event or a debug override is not undone every frame
    nightK += (nightTarget - nightK) * Math.min(1, 0.6 * dt);
    spriteMat.uniforms.uAmb.value.copy(AMB_D).lerp(AMB_N, nightK); spriteMat.uniforms.uSun.value.copy(SUN_D).lerp(SUN_N, nightK);
    lodBegin(cam);
    updateScripted(dt, cam);
    cx = cam.position.x; cz = cam.position.z;
    // someone waiting at a bus stop moans when the lapa comes by (the nearest within 20 m, now and then)
    if (gameRef?.state === 'play' && (busT -= dt) <= 0) {
      busT = 1.2; let best = -1, bd = 400;
      for (let i = 0; i < N.n; i++) if (BUS[i] && ST[i] === IDLE) { const d = (X[i] - cx) ** 2 + (Z[i] - cz) ** 2; if (d < bd) { bd = d; best = i; } }
      if (best >= 0 && Math.random() < 0.35) { busT = rand(9, 16); const id = best; env.shout?.(X[id], Y[id] + 1.9, Z[id], BUS_LINES[(Math.random() * BUS_LINES.length) | 0], () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] })); }
    }
    cam.getWorldDirection(camQ); const fl = hyp2(camQ.x, camQ.z); if (fl > 0.05) { camFwdX = camQ.x / fl; camFwdZ = camQ.z / fl; }
    const R = quality.R;
    if (quality.cap <= 0) { sprites.geometry.instanceCount = shadows.geometry.instanceCount = 0; lodEnd(dt); return; }
    if ((frameNo & 15) === 1) readSun();

    // tiles around the camera: all of them at once on the first frame or after a jump, otherwise on a time budget
    const jumped = hyp2(cx - lastCx, cz - lastCz) > 45;
    if (pendingTiles.length) {   // index tiles that reached full detail, one per frame (all of them while the first crowd is being placed)
      for (let n = !started || jumped ? 4 : 1; n > 0 && pendingTiles.length; n--) { const pt = pendingTiles.shift(); if (pt.data && !wts.has(wkey(pt.i, pt.j))) register(pt); }
    }
    if (!started || jumped) { ensureBlocks(cx, cz, 70, 60); }
    else if ((frameNo & 3) === 0) ensureBlocks(cx, cz, R + 25, 1.5);
    if ((frameNo & 127) === 0) evictBlocks(cx, cz, R + 190);
    lastCx = cx; lastCz = cz; jumpedNow = jumped;

    // despawn the far ones, and retarget the crowd size twice a second
    for (let i = N.n - 1; i >= 0; i--) { if (hyp2(X[i] - cx, Z[i] - cz) > R + 14 || AGE[i] < -100) removeAt(i); }
    // dusk or dawn: the crowd turns over. Whoever is not in the new mix leaves, and the others leave in proportion to how much the new mix
    // wants fewer of their kind (nonne at night, students by day), so the replacements spawn from the new weights. Unseen ones go at once,
    // visible ones dissolve after a while.
    if (purgeT > 0) {
      purgeT -= dt;
      const nw = nightCrowd ? VWN : VW, nsum = nightCrowd ? VWNsum : VWsum, ow = nightCrowd ? VW : VWN, osum = nightCrowd ? VWsum : VWNsum;
      for (let k = 0, left = 6; k < 10 && left > 0 && N.n > 0; k++) {
        const i = purgeAt = (purgeAt + 1) % N.n, vi = VAR[i];
        if (LEAVE[i] >= 0 || vi === HEALV || vi === CHAIRV || MIR[i] > 0) continue;
        const zn = ZN[i], oldShare = ow[zn][vi] / osum[zn], newShare = nw[zn][vi] / nsum[zn];
        if (oldShare > 0 && newShare >= oldShare) continue;
        if (oldShare > 0 && Math.random() < newShare / oldShare) continue;
        const dx = X[i] - cx, dz = Z[i] - cz, d = hyp2(dx, dz) || 1, seen = d < 70 && (dx * camFwdX + dz * camFwdZ) / d > 0.15;
        if (!seen || d > 55 || purgeT < 30) { LEAVE[i] = 1; left--; }
      }
    }
    targetT -= dt;
    if (targetT <= 0 || !started || jumped) { targetN = estimateTarget(); targetT = 0.5; stats.target = targetN; }
    // spawn (fill quickly when starting or after a jump, else a few per frame)
    const burst = !started || jumped || N.n < targetN * 0.35;
    const budget = !started || jumped ? 12 : burst ? 2.5 : 0.6, ts = performance.now(); let tries = 0, spawned = 0;
    while (N.n < targetN && tries < (burst ? 1500 : 24) && spawned < (burst ? 400 : 4)) {
      tries++; if (spawn(burst)) spawned++;
      if ((tries & 7) === 0 && performance.now() - ts > budget) break;
    }
    // slowly thin out when there are far too many (e.g. after the crowd density dropped)
    if (N.n > targetN * 1.25 + 6) { let far = -1, fd = 0; for (let i = 0; i < N.n; i++) { const d = hyp2(X[i] - cx, Z[i] - cz); if (d > fd) { fd = d; far = i; } } if (far >= 0 && fd > R * 0.7) AGE[far] = -999; }
    started = true;

    agents = env.traffic && env.traffic.agents ? env.traffic.agents() || [] : [];
    carSpd = hyp2(car.vx, car.vz);
    stepDodgeChecks(dt);

    // spatial hash
    hHead.fill(-1);
    for (let i = 0; i < N.n; i++) { const k = hkey(Math.floor(X[i] / 1.5), Math.floor(Z[i] / 1.5)); hNext[i] = hHead[k]; hHead[k] = i; }

    const sfx = Math.sin(car.th), sfz = Math.cos(car.th);
    for (let i = 0; i < N.n; i++) {
      AGE[i] += dt;
      if (MIR[i] > 0) { MIR[i] -= dt; HOP[i] = MIR[i] > 0 ? 0.1 * Math.abs(Math.sin(MIR[i] * 9)) : 0; if (MIR[i] <= 0) seatAgain(i); }
      let st = ST[i];
      // decision tick, staggered
      if ((STEER[i] -= dt) <= 0 && st <= WAIT) { STEER[i] = 0.1 + Math.random() * 0.04; steer(i, 0.12); st = ST[i]; }

      const x = X[i], z = Z[i];
      if (st === WALK || st === IDLE || st === WAIT) {
        // turn towards the intended heading (+ wall nudge), speed follows
        const goal = THT[i] + NUDGE[i], dh = angDiff(goal, TH[i]);
        TH[i] += clamp(dh, -5 * dt, 5 * dt);
        if (VAR[i] === HEALV && V0[i] > 2.7) V0[i] -= (V0[i] - 2.6) * Math.min(1, 0.35 * dt);
        const want = st === WALK ? V0[i] * Math.max(0.25, Math.cos(Math.min(1.4, Math.abs(dh)))) : 0;
        V[i] += clamp(want - V[i], -5 * dt, 3 * dt);
        if (st === IDLE && Math.abs(dh) > 0.01) TH[i] += clamp(dh, -2.5 * dt, 2.5 * dt);
        if (V[i] > 0.02) {
          const d = V[i] * dt, nx = x + Math.sin(TH[i]) * d, nz = z + Math.cos(TH[i]) * d;
          if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; TRAV[i] += d; PH[i] += d / STRIDE[VAR[i]]; }
          else { V[i] = 0; STEER[i] = 0; THT[i] += (Math.random() < 0.5 ? 1 : -1) * 1.2; }
        }
        // keep a little distance from the others and from the lapa
        const ix = Math.floor(X[i] / 1.5), iz = Math.floor(Z[i] / 1.5);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          for (let j = hHead[hkey(ix + a, iz + b)]; j >= 0; j = hNext[j]) {
            if (j === i) continue;
            const dx = X[i] - X[j], dz = Z[i] - Z[j], d2 = dx * dx + dz * dz;
            if (d2 < 0.49 && d2 > 1e-6) { const d = Math.sqrt(d2); pushOut(i, dx / d, dz / d, (0.7 - d) * 1.6 * dt); }
          }
        }
        const cdx = X[i] - car.x, cdz = Z[i] - car.z;
        if (cdx * cdx + cdz * cdz < 16) {
          // distance to the lapa's centre line (3.2 m long)
          const al = clamp(cdx * sfx + cdz * sfz, -1.2, 1.2), qx = cdx - sfx * al, qz = cdz - sfz * al, qd = hyp2(qx, qz);
          if (qd < 1.7 && qd > 1e-4) pushOut(i, qx / qd, qz / qd, (1.7 - qd) * (1.5 + carSpd * 0.25) * dt * (carSpd > 0.3 ? 1 : 0.3));
        }
        if (st === IDLE || st === WAIT) { V[i] = Math.max(0, V[i] - 4 * dt); }
      } else if (st === DODGE) {
        TMR[i] += dt;
        const u = TMR[i] / 0.5;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt;
        if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; } else { VX[i] = VZ[i] = 0; }
        HOP[i] = 4 * 0.42 * Math.min(1, u) * (1 - Math.min(1, u));
        if (u >= 1) { HOP[i] = 0; if (VAR[i] === HEALV) { ST[i] = WALK; V[i] = V0[i]; STEER[i] = 0; } else { ST[i] = IDLE; TMR[i] = rand(0.5, 1.1); THT[i] = TH[i] + rand(-0.7, 0.7); V[i] = 0; } }
      } else if (st === FLY) {
        TMR[i] += dt;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt;
        if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; } else { VX[i] *= -0.2; VZ[i] *= -0.2; }
        VY[i] -= 12 * dt; HOP[i] += VY[i] * dt;
        const k = Math.exp(-0.8 * dt); VX[i] *= k; VZ[i] *= k;
        ROLL[i] = RD[i] * Math.PI * (0.5 + 2 * Math.max(1, Math.round(1 + 1.5 * TFLY[i]))) * Math.min(1, TMR[i] / Math.max(0.2, TFLY[i]));   // whole turns, ending on the side (LIE)
        if (HOP[i] <= 0) {
          HOP[i] = 0;
          if (VY[i] < -2) { VY[i] = -VY[i] * 0.3; VX[i] *= 0.5; VZ[i] *= 0.5; } // a bounce or two
          else { ST[i] = LIE; TMR[i] = rand(1.4, 2.4); ROLL[i] = RD[i] * Math.PI / 2; }
        }
      } else if (st === LIE) {
        TMR[i] -= dt; const k = Math.exp(-5 * dt); VX[i] *= k; VZ[i] *= k;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt; if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; }
        if (TMR[i] <= 0) { ST[i] = GETUP; TMR[i] = 0; }
      } else if (st === GETUP) {
        TMR[i] += dt; const u = Math.min(1, TMR[i] / 0.45);
        ROLL[i] = RD[i] * Math.PI / 2 * (1 - u * u); HOP[i] = 0.25 * Math.sin(u * Math.PI);
        if (u >= 1) { ST[i] = WALK; ROLL[i] = 0; HOP[i] = 0; REACT[i] = -1; THT[i] = TH[i] = rand(0, TAU); V0[i] = (VARIANTS[VAR[i]].speed || 1.1) * 1.15; V[i] = 0; STEER[i] = 0; }
      }

      // ground height, eased so stepping onto a curb isn't a pop
      if (((i + frameNo) & 1) === 0) {   // every other frame is plenty for the height (tile-aware groundY is the dearest call here)
        const ty = groundY(X[i], Z[i]) + (raisedMask(X[i], Z[i]) ? CURB : 0);
        Y[i] += (ty - Y[i]) * Math.min(1, 28 * dt);
      }
    }

    // sun shading eases to its target
    for (let i = 0; i < N.n; i++) SHC[i] += (SHT[i] - SHC[i]) * Math.min(1, 4 * dt);

    // write the instance buffers
    const pos = aPos.array, A = aA.array, B = aB.array, n = N.n;
    const cpx = cam.position.x, cpz = cam.position.z, fadeStart = R + 12;
    for (let i = 0; i < n; i++) {
      const x = X[i], z = Z[i], st = ST[i], dxc = cpx - x, dzc = cpz - z, dist = hyp2(dxc, dzc) || 1;
      pos[i * 3] = x; pos[i * 3 + 1] = Y[i] + HOP[i]; pos[i * 3 + 2] = z;
      let dir, pose;
      if (st >= FLY) { dir = 0; pose = st === FLY ? 1 : 0; }
      else {
        // angle between the camera and the walking direction picks front / back / left / right
        const wx = Math.sin(TH[i]), wz = Math.cos(TH[i]), tx = dxc / dist, tz = dzc / dist;
        const s = wx * tx + wz * tz, c = wx * tz - wz * tx;     // c > 0: walking to the right on screen
        dir = Math.abs(s) >= Math.abs(c) ? (s > 0 ? 0 : 1) : (c > 0 ? 3 : 2);
        if (st === DODGE) pose = 1;
        else if (V[i] < 0.12) { pose = 0; if (VARIANTS[VAR[i]].drink && ((lodClock + i * 1.913) % 7.3) < 1.7) pose = 5; }   // idle: now and then a sip
        else { const ph = Math.floor((PH[i] % 1) * 4) & 3; pose = VAR[i] === WCV ? ph : ph + 1; }
      }
      lodSee = dxc * camFwdX + dzc * camFwdZ < 0;
      lodPick(VAR[i], dir, pose, dist, SIZE[i], NEARF[i]); NEARF[i] = lodNear;
      A[i * 4] = lodX; A[i * 4 + 1] = lodY; A[i * 4 + 2] = SIZE[i]; A[i * 4 + 3] = ROLL[i];
      if (LEAVE[i] >= 0) { LEAVE[i] -= dt / 1.4; if (LEAVE[i] <= 0) AGE[i] = -999; }
      const fade = clamp((fadeStart - dist) / 16, 0, 1) * clamp(AGE[i] / 0.8, 0, 1) * (LEAVE[i] >= 0 ? Math.max(0, LEAVE[i]) : 1);
      B[i * 4] = fade; B[i * 4 + 1] = SHC[i] * (1 - nightK); B[i * 4 + 2] = BRI[i];
    }
    updateChairs(dt, cpx, cpz); const nc = writeChairs(n, cpx, cpz, fadeStart);
    lodEnd(dt);
    aPos.needsUpdate = aA.needsUpdate = aB.needsUpdate = true;
    sprites.geometry.instanceCount = shadows.geometry.instanceCount = n + nc;
    stats.count = n;
    const ms = performance.now() - t0; stats.ms = ms; stats.avgMs += (ms - stats.avgMs) * 0.05; if (ms > stats.maxMs) stats.maxMs = ms;
  }

  // ======================================================================== the lapa meets a pedestrian (runs at 120 Hz)
  const COFF = [-1.0, 0, 1.0], CR = 0.72, PR = 0.3;
  function collidePlayer(c) {
    const n = N.n; if (!n) return;
    const spd = hyp2(c.vx, c.vz), sfx2 = Math.sin(c.th), sfz2 = Math.cos(c.th);
    for (let i = 0; i < n; i++) {
      const dx0 = X[i] - c.x, dz0 = Z[i] - c.z;
      if (dx0 > 3 || dx0 < -3 || dz0 > 3 || dz0 < -3 || ST[i] >= FLY) continue;
      for (let k = 0; k < 3; k++) {
        const dx = X[i] - (c.x + sfx2 * COFF[k]), dz = Z[i] - (c.z + sfz2 * COFF[k]), d2 = dx * dx + dz * dz, rr = CR + PR;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
        if (spd > 2.2) {
          knock(i, nx, nz);
          const f = 0.025; c.vx -= c.vx * f; c.vz -= c.vz * f;     // a pedestrian is a speed bump, not a wall
        } else pushOut(i, nx, nz, rr - d);
        break;
      }
    }
  }

  // ======================================================================== scripted characters (missions)
  // A few extra sprites steered by another module (src/missions.js), drawn with the same atlas and shader as the crowd.
  //   spawnScripted(variant, x, z) -> id     variant: index into VARIANTS or its id ('tourist', 'vendor'...); -1 when full
  //   walkTo(id, x, z, speed, onArrive)      straight-line walk (no pathfinding: keep it short), speed in m/s
  //   face(id, x, z)                         turn towards a point
  //   attachTo(id, fn, { seated, blend })    fn(out) fills out.x/out.y/out.z/out.th each frame (out.y = hip height when seated);
  //                                          a seated sprite shows no legs. blend: seconds to hop from where it stands to the seat
  //   detach(id)                             back to standing on the ground where it is
  //   setBounce(id, on)                      jump up and down on the spot (hailing a taxi)
  //   setSize(id, k)                         scale the sprite (1 = as the crowd)
  //   info(id) -> { x, y, z, state }         state: 'stand' | 'walk' | 'seat'
  //   remove(id); near(x, z, r) -> crowd members within r; onKnock(fn(x, z, variant)) when the lapa sends a crowd member flying
  const SC = 96;
  const sPos = new THREE.InstancedBufferAttribute(new Float32Array(SC * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const sA = new THREE.InstancedBufferAttribute(new Float32Array(SC * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const sB = new THREE.InstancedBufferAttribute(new Float32Array(SC * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const mkGeoS = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(quadPos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(quadUv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', sPos); g.setAttribute('iA', sA); g.setAttribute('iB', sB);
    g.instanceCount = 0; return g;
  };
  const sSprites = new THREE.Mesh(mkGeoS(), spriteMat); sSprites.frustumCulled = false; sSprites.renderOrder = 2; scene.add(sSprites);
  const sShadows = new THREE.Mesh(mkGeoS(), shadowMat); sShadows.frustumCulled = false; sShadows.renderOrder = 1; scene.add(sShadows);
  const scripted = new Map(); let nextScriptId = 1, scriptClock = 0;
  const vIndex = v => {   // a type id picks one of its people at random (a named one, like 'amico1_giacca', has just one)
    if (typeof v === 'number') return v;
    const l = variantsOf(v); const i = l.length ? l[(Math.random() * l.length) | 0] : 0;
    atlas.buildNow(rendererRef, i); return i;
  };
  const groundAt = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  function spawnScripted(variant, x, z) {
    if (scripted.size >= SC) return -1;
    const id = nextScriptId++, v = vIndex(variant);
    scripted.set(id, { id, v, x, z, y: groundAt(x, z), th: Math.random() * TAU, size: 1, state: 'stand', tx: x, tz: z, speed: 1.2, ph: Math.random(), cb: null,
      att: null, seated: false, blend: 0, bt: 0, from: null, hip: 0, bounce: false });
    return id;
  }
  const scriptedGet = id => scripted.get(id);
  function walkTo(id, x, z, speed, cb) { const c = scripted.get(id); if (!c) return; c.state = 'walk'; c.tx = x; c.tz = z; c.speed = speed || (VARIANTS[c.v].speed || 1.1); c.cb = cb || null; }
  function face(id, x, z) { const c = scripted.get(id); if (c) c.th = Math.atan2(x - c.x, z - c.z); }
  function attachTo(id, fn, o) {
    const c = scripted.get(id); if (!c) return;
    o = o || {}; c.att = fn; c.seated = !!o.seated; c.blend = o.blend || 0; c.bt = 0; c.from = c.blend ? { x: c.x, y: c.y, z: c.z } : null; c.state = 'seat';
  }
  function detach(id) { const c = scripted.get(id); if (!c) return; c.att = null; c.seated = false; c.state = 'stand'; c.y = c.hipY !== undefined ? c.hipY - ((LPC ? LPC_HIP : (VARIANTS[c.v].leg || 19) * LK - 1) * PX) : c.y; }
  function setBounce(id, on) { const c = scripted.get(id); if (c) c.bounce = !!on; }
  function setSize(id, k) { const c = scripted.get(id); if (c) c.size = k; }   // 1 is an adult of the crowd; the carriages' passengers are drawn a little smaller to fit the seats
  function remove(id) { scripted.delete(id); }
  // A named group at a spot (a crowd in front of a pub, a gang at a bench): spawnCrowd({ x, z, radius, count, mix, props }) -> array of ids
  //   pose: 'sit' puts them on the ground (knees up, hands on the knees or a drink in one hand, sipping now and then); only people who can sit are picked (those with a drink, the young everyday types)
  //   mix: { family or type id: weight, ... } over the families below or any type id ('nonna', 'metal_long'...); default everyday people. props: 'beer' picks people who hold a bottle
  //   or a pint (the night and metal looks do) and has them sip now and then. People stand in small knots facing one another and do not move; removeCrowd(ids) takes them away again.
  //   Needs the near scripted slots (96 in all, shared with the missions), so keep groups to a dozen or so. Members already placed are not moved if the call runs short of room.
  const FAMILIES = {
    metal: ['metal_long', 'metal_vest', 'metal_leather', 'metal_bald', 'metal_f', 'metal_f2'], night: ['nightboy', 'nightboy2', 'nightgirl', 'nightgirl2', 'nightgirl3', 'dj'],
    young: GROUPS.young, elders: GROUPS.elders, fans: GROUPS.fans, tourists: GROUPS.tour, locals: ['coppola', 'coppola2', 'nonno', 'ragazzo', 'ragazzo2', 'borsa', 'signora', 'suit'], beach: GROUPS.beach, market: GROUPS.market,
  };
  function spawnCrowd(o) {
    const out = [], R = Math.max(1, o.radius || 4), want = Math.max(1, o.count | 0 || 6), beer = o.props === 'beer', sit = o.pose === 'sit';
    const mix = o.mix && Object.keys(o.mix).length ? o.mix : { locals: 1 }, pool = [], wts = [];
    for (const k of Object.keys(mix)) for (const id of FAMILIES[k] || [k]) for (const vi of variantsOf(id)) { if (beer && !VARIANTS[vi].drink && Object.keys(mix).some(q => FAMILIES[q] && FAMILIES[q].some(i => variantsOf(i).some(j => VARIANTS[j].drink)))) continue; pool.push(vi); wts.push(mix[k] / (FAMILIES[k] ? FAMILIES[k].length : 1)); }
    if (sit) { const sp2 = pool.filter(vi => VARIANTS[vi].sit); if (sp2.length) { for (let k = pool.length - 1; k >= 0; k--) if (!VARIANTS[pool[k]].sit) { pool.splice(k, 1); wts.splice(k, 1); } } }
    if (!pool.length) return out;
    const sum = wts.reduce((a, b) => a + b, 0), spots = [];
    const knots = Math.max(1, Math.round(want / 4));
    for (let k = 0; k < knots; k++) { const a = Math.random() * TAU, d = R * Math.sqrt(Math.random()); spots.push([o.x + Math.cos(a) * d, o.z + Math.sin(a) * d]); }
    for (let n = 0; n < want; n++) {
      let r = Math.random() * sum, j = 0; for (; j < wts.length - 1; j++) if ((r -= wts[j]) <= 0) break;
      const vi = pool[j];
      let px = 0, pz = 0, ok = false;
      const kn = spots[n % knots];
      for (let t = 0; t < 14 && !ok; t++) {
        const a = Math.random() * TAU, d = 0.9 + Math.random() * 0.7 + t * 0.12; px = kn[0] + Math.cos(a) * d; pz = kn[1] + Math.sin(a) * d;
        if (hyp2(px - o.x, pz - o.z) > R + 1.5) continue;
        if (wtAt(px, pz) !== null && !cell(px, pz) && !o.anywhere) continue;
        ok = true; for (const id2 of out) { const c2 = scripted.get(id2); if (c2 && (c2.x - px) ** 2 + (c2.z - pz) ** 2 < 0.55) { ok = false; break; } }
      }
      if (!ok) continue;
      const id = spawnScripted(vi, px, pz); if (id < 0) break;
      const c = scripted.get(id); c.th = Math.atan2(kn[0] - px, kn[1] - pz) + (Math.random() - 0.5) * 0.9; c.size = 0.97 + Math.random() * 0.06; c.drinking = beer && !!VARIANTS[vi].drink; c.crowd = true; c.sit = sit && !!VARIANTS[vi].sit;
      out.push(id);
    }
    return out;
  }
  function removeCrowd(ids) { for (const id of ids || []) scripted.delete(id); }
  function info(id) { const c = scripted.get(id); return c ? { x: c.x, y: c.y, z: c.z, state: c.state } : null; }
  function near(x, z, r) {
    let n = 0; const r2 = r * r;
    for (let i = 0; i < N.n; i++) { if (ST[i] >= FLY) continue; const dx = X[i] - x, dz = Z[i] - z; if (dx * dx + dz * dz < r2) n++; }
    return n;
  }
  const attOut = { x: 0, y: 0, z: 0, th: 0 };
  function updateScripted(dt, cam) {
    dt = clamp(dt, 0, 0.05); scriptClock += dt;
    const cpx = cam.position.x, cpz = cam.position.z;
    const sp = sPos.array, sa = sA.array, sb = sB.array;
    let k = 0, seatedList = null;
    const order = [];
    for (const c of scripted.values()) {
      if (c.state === 'walk') {
        const dx = c.tx - c.x, dz = c.tz - c.z, d = hyp2(dx, dz), step = c.speed * dt;
        if (d <= step + 0.02) { c.x = c.tx; c.z = c.tz; c.state = 'stand'; const cb = c.cb; c.cb = null; if (cb) { try { cb(c.id); } catch (e) { /* ignore */ } } }
        else { c.x += dx / d * step; c.z += dz / d * step; c.ph += step / 1.5; c.th += clamp(angDiff(Math.atan2(dx, dz), c.th), -7 * dt, 7 * dt); }
      }
      if (c.att) {
        c.att(attOut);
        let ax = attOut.x, az = attOut.z, ay = attOut.y;
        if (c.from && c.blend > 0) { // hop from where it stood into the seat
          c.bt += dt; const u = Math.min(1, c.bt / c.blend), e = u * u * (3 - 2 * u);
          ax = c.from.x + (ax - c.from.x) * e; az = c.from.z + (az - c.from.z) * e; ay = c.from.y + (ay - c.from.y) * e + Math.sin(u * Math.PI) * 0.35;
          if (u >= 1) c.from = null;
        }
        c.x = ax; c.z = az; c.hipY = ay; c.th = attOut.th;
      } else {
        const ty = groundAt(c.x, c.z); c.y += (ty - c.y) * Math.min(1, 14 * dt);
      }
      order.push(c);
    }
    order.sort((a, b) => (a.state === 'seat' && a.seated) - (b.state === 'seat' && b.seated));   // standing first: only those get a ground shadow
    let standing = 0;
    for (const c of order) {
      const v = VARIANTS[c.v], i = k++, seatedNow = c.att && c.seated, leg = LPC ? LPC_HIP + 1 : (v.leg || 19) * LK;
      if (!seatedNow) standing++;
      const dxc = cpx - c.x, dzc = cpz - c.z, dist = hyp2(dxc, dzc) || 1;
      let y = seatedNow ? c.hipY - (leg - 1) * PX * c.size : (c.att ? c.hipY : c.y);
      if (c.bounce && !c.att) y += Math.abs(Math.sin(scriptClock * 6 + c.id)) * 0.16;
      sp[i * 3] = c.x; sp[i * 3 + 1] = y; sp[i * 3 + 2] = c.z;
      const wx = Math.sin(c.th), wz = Math.cos(c.th), tx = dxc / dist, tz = dzc / dist;
      const s = wx * tx + wz * tz, cc = wx * tz - wz * tx;
      const dir = Math.abs(s) >= Math.abs(cc) ? (s > 0 ? 0 : 1) : (cc > 0 ? 3 : 2);
      let pose = 0;
      if (c.state === 'walk') { const ph = Math.floor((c.ph % 1) * 4) & 3; pose = ph + 1; }
      if (c.sit && VARIANTS[c.v].sit) pose = c.drinking && VARIANTS[c.v].drink && ((lodClock + c.id * 2.31) % 6.1) < 1.7 ? POSE_SIT_SIP : POSE_SIT;
      else if (c.drinking && pose === 0 && VARIANTS[c.v].drink && ((lodClock + c.id * 2.31) % 6.1) < 1.7) pose = 5;
      lodSee = dxc * camFwdX + dzc * camFwdZ < 0;
      lodPick(c.v, dir, pose, dist, c.size, c.nr); c.nr = lodNear; sa[i * 4] = lodX; sa[i * 4 + 1] = lodY; sa[i * 4 + 2] = c.size; sa[i * 4 + 3] = 0;
      sb[i * 4] = 1; sb[i * 4 + 1] = 0.8 * (1 - nightK); sb[i * 4 + 2] = 1; sb[i * 4 + 3] = seatedNow ? (GROUND + leg - 1.3) / CELL_H : 0;
    }
    sPos.needsUpdate = sA.needsUpdate = sB.needsUpdate = true;
    sSprites.geometry.instanceCount = k; sShadows.geometry.instanceCount = standing;
  }

  function setQuality(q) { if (QUALITIES[q] && !params.has('peds')) { quality = QUALITIES[q]; targetT = 0; } }

  if (params.has('debug')) window.__peds = { setTime, stats, N, X, Z, ST, VAR, TH, TMR, ROLL, RD, HOP, V, cell, wts, quality: () => quality, knock, zoneCode, densAt, distAt, PNAMES, VW, VWN, VARIANTS };
  const api = { spawnCrowd, removeCrowd, crowdFamilies: () => Object.keys(FAMILIES), bindGame: g => { gameRef = g; }, night: () => ({ night: nightCrowd, k: nightK, hour: hourNow }), update, collidePlayer, setQuality, stats, spawnScripted, walkTo, face, attachTo, detach, remove, info, setBounce, setSize, near, miracle, onKnock: f => { knockCbs.push(f); } };
  if (params.has('debug')) { window.__peds.api = api; window.__peds.dbg = { sSprites, sPos, sA, sB, atlas, spriteMat, sprites }; }
  env.traffic?.bindPedestrians?.(api);   // police, lookouts, the team bus and the double-parking quarrels (src/police.js, src/gags.js) use this API
  return api;
}
