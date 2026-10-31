// Round minimap (top right, <canvas id="mini">): cream land, white roads, brown buildings, heading up, with markers and the
// mission route drawn on top in screen space.
//
// The map is made of one small canvas per 500 m tile ("piece"), painted on demand and kept in a LRU.
//   1. base   land / sea from the manifest coastline (one Path2D built once). Every tile near the car gets this at once, so the
//             map never goes blank, also for tiles whose data is not in yet.
//   2. detail once the tile's parsed data is available (full or low detail tile, world.tileData): green/water/plaza areas, drivable
//             roads by width, building footprints. Painted once, at most one piece per frame.
// Each frame is just a few drawImage calls of the pieces around the car (no getImageData, no per-frame tile rebuilds). A piece
// is painted slightly before it scrolls into view (margin PRE metres). The view widens a little at speed (zoom-out).
//
import { QUALITY } from './mobile.js';

const W = 200; // canvas size in px (the CSS size varies, see ui/mobile css)
const T = 500; // tile size in metres (docs/TILES.md)
const SEA = '#3a8bb5', LAND = '#e4dccb', BLD = '#b98f62', TRACK = '#d6c7a2';
const AREA = { green: '#93b46a', forest: '#86a862', water: SEA, plaza: '#f2ead8', pier: '#bdbab2', sand: '#ece0bc' };
const PRE = 130; // metres beyond the visible radius that are painted ahead of time
const EXTRA_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

export function createMinimap({ canvas, car, world, DRIVABLE, mapMarkers, mapRoute }) {
  const mini = canvas.getContext('2d');
  const MOBILE = !!QUALITY.mobile;
  const RES = MOBILE ? 192 : 384, S = RES / T, CAP = MOBILE ? 14 : 24; // px per tile side, px per metre, pieces kept
  let zoom = 0.75; // px per metre on screen; eased towards the speed-dependent target
  const stats = { pieces: 0, painted: 0, detailed: 0, lastMs: 0, maxMs: 0, sumMs: 0, drawMs: 0, drawMax: 0, frames: 0 };

  // ---------- per tile pieces ----------
  const pieces = new Map(); // key -> { c, g, i, j, detail } (insertion order = LRU order)
  const pool = []; // canvases of evicted pieces, reused
  let active = []; // pieces around the car, refreshed by scan()
  let landPath = null, bbox = null;
  let scanT = 0, scanI = 1e9, scanJ = 1e9;
  const key = (i, j) => i * 4096 + j;

  function buildLand(M) { // the coastline (and islands) as one Path2D in world metres, built once
    landPath = new Path2D();
    for (const flat of [M.land, ...(M.islands || [])]) {
      if (!flat || flat.length < 6) continue;
      landPath.moveTo(flat[0], flat[1]);
      for (let i = 2; i < flat.length; i += 2) landPath.lineTo(flat[i], flat[i + 1]);
      landPath.closePath();
    }
    bbox = M.bbox;
  }
  function paintBase(p) {
    const g = p.g;
    g.setTransform(S, 0, 0, S, -p.i * T * S, -p.j * T * S);
    g.fillStyle = SEA; g.fillRect(p.i * T, p.j * T, T, T);
    g.fillStyle = LAND; g.fill(landPath);
  }
  function poly(path, a) { path.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) path.lineTo(a[i], a[i + 1]); }
  function paintDetail(p, d) {
    const g = p.g;
    paintBase(p);
    // areas (parks, forest, water, plazas, piers)
    if (d.areas) for (const a of d.areas) {
      const col = AREA[a.k]; if (!col || !a.p || a.p.length < 6) continue;
      const pa = new Path2D(); poly(pa, a.p); pa.closePath(); g.fillStyle = col; g.fill(pa);
    }
    // roads: one stroke per colour and width
    g.lineCap = g.lineJoin = 'round';
    const buckets = new Map();
    if (d.roads) for (const r of d.roads) {
      const k = r.k; let col, w;
      if (k === 'pedestrian') { col = '#f6efe0'; w = r.w * 1.3; }
      else if (k === 'track') { col = TRACK; w = Math.max(2.5, r.w); }
      else if (k === 'pier') { col = AREA.pier; w = r.w * 1.3; }
      else if (DRIVABLE.has(k) || EXTRA_ROADS.has(k)) { col = '#ffffff'; w = r.w * 1.3; }
      else continue;
      const bk = col + w; let b = buckets.get(bk);
      if (!b) buckets.set(bk, b = { col, w, path: new Path2D(), ord: col === '#ffffff' ? 2 : col === '#f6efe0' ? 1 : 0 });
      poly(b.path, r.p);
    }
    const order = [...buckets.values()].sort((a, b) => a.ord - b.ord || a.w - b.w);
    for (const b of order) { g.strokeStyle = b.col; g.lineWidth = b.w; g.stroke(b.path); }
    // buildings
    if (d.buildings && d.buildings.length) {
      const bp = new Path2D();
      for (const b of d.buildings) { if (b.p.length < 6) continue; poly(bp, b.p); bp.closePath(); }
      g.fillStyle = BLD; g.fill(bp);
    }
    p.detail = true; stats.detailed++;
  }
  function getPiece(i, j) {
    const k = key(i, j); let p = pieces.get(k);
    if (p) { pieces.delete(k); pieces.set(k, p); return p; }
    const c = pool.pop() || document.createElement('canvas');
    if (c.width !== RES) c.width = c.height = RES;
    p = { c, g: c.getContext('2d'), i, j, detail: false };
    pieces.set(k, p);
    paintBase(p); stats.painted++;
    return p;
  }
  function evict() {
    if (pieces.size <= CAP) return;
    for (const [k, p] of pieces) {
      if (pieces.size <= CAP) break;
      if (active.includes(p)) continue;
      pieces.delete(k); pool.push(p.c);
    }
  }
  function scan(R) { // pieces for every tile in the visible disc plus a margin
    if (!landPath) { if (world.manifest) buildLand(world.manifest); else return; }
    const r = R + PRE, i0 = Math.floor((car.x - r) / T), i1 = Math.floor((car.x + r) / T), j0 = Math.floor((car.z - r) / T), j1 = Math.floor((car.z + r) / T);
    active.length = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      if ((i + 1) * T < bbox[0] || i * T > bbox[2] || (j + 1) * T < bbox[1] || j * T > bbox[3]) continue; // pure sea outside the baked area
      active.push(getPiece(i, j));
    }
    stats.pieces = pieces.size;
    evict();
  }
  function upgradeOne() { // at most one detail paint per frame
    for (const p of active) {
      if (p.detail) continue;
      const d = world.tileData(p.i, p.j);
      if (!d) continue;
      const t0 = performance.now();
      try { paintDetail(p, d); } catch (e) { p.detail = true; console.warn('[minimap] tile', p.i, p.j, e); }
      const ms = performance.now() - t0; stats.lastMs = ms; stats.sumMs += ms; if (ms > stats.maxMs) stats.maxMs = ms;
      return;
    }
  }

  function drawTiles(R) {
    const x0 = car.x - R, x1 = car.x + R, z0 = car.z - R, z1 = car.z + R, e = 1; // e: overlap in metres so rotated seams never show the sea
    for (const p of active) {
      const px = p.i * T, pz = p.j * T;
      if (px > x1 || px + T < x0 || pz > z1 || pz + T < z0) continue;
      mini.drawImage(p.c, px - car.x - e, pz - car.z - e, T + 2 * e, T + 2 * e);
    }
  }

  // ---------- frame ----------
  function draw(dt) {
    const t0 = performance.now();
    const v = Math.abs(car.vf || 0);
    // a bit wider above ~20 m/s (72 km/h), eased so the map never jumps
    const u = Math.min(1, Math.max(0, (v - 20) / 18)), target = 0.75 - 0.2 * u * u * (3 - 2 * u);
    zoom += (target - zoom) * Math.min(1, (dt || 0.016) * 1.5);
    const R = W / 2 / zoom;
    {
      const ci = Math.floor(car.x / T), cj = Math.floor(car.z / T);
      scanT -= dt || 0.016;
      if (scanT <= 0 || ci !== scanI || cj !== scanJ || !landPath) { scanT = 0.2; scanI = ci; scanJ = cj; scan(R); }
      upgradeOne();
    }
    mini.save();
    mini.clearRect(0, 0, W, W);
    mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
    mini.fillStyle = SEA; mini.fillRect(0, 0, W, W);
    mini.translate(W / 2, W / 2);
    mini.rotate(car.th - Math.PI);
    mini.scale(zoom, zoom);
    drawTiles(R);
    mini.restore();
    // Markers from other modules (missions, stigghiulari, other players), drawn after restore() in plain
    // screen space: rotate each offset by the same angle as the map (heading up), scale like the map.
    // Off-map markers are pinned to the rim so the direction still reads.
    const a = car.th - Math.PI, ca = Math.cos(a), sa = Math.sin(a), k = zoom;
    const toMap = (x, z) => { const dx = (x - car.x) * k, dz = (z - car.z) * k; return [W / 2 + dx * ca - dz * sa, W / 2 + dx * sa + dz * ca]; };
    if (mapRoute.length > 1) {
      mini.save(); mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
      mini.lineCap = mini.lineJoin = 'round';
      for (const [w, c] of [[7, '#120a0e'], [4, '#e8559a']]) {
        mini.strokeStyle = c; mini.lineWidth = w; mini.beginPath();
        mapRoute.forEach(([x, z], i) => { const [px, pz] = toMap(x, z); i ? mini.lineTo(px, pz) : mini.moveTo(px, pz); });
        mini.stroke();
      }
      mini.restore();
    }
    for (const m of mapMarkers) {
      const dx = (m.x - car.x) * k, dz = (m.z - car.z) * k;
      let px = dx * ca - dz * sa, pz = dx * sa + dz * ca;
      const r = Math.hypot(px, pz), rim = W / 2 - 8, off = r > rim;
      if (off) { px *= rim / r; pz *= rim / r; }
      mini.fillStyle = m.color || '#e8559a'; mini.strokeStyle = '#000'; mini.lineWidth = 1.5;
      mini.beginPath(); mini.arc(W / 2 + px, W / 2 + pz, off ? 4 : (m.size || 5), 0, Math.PI * 2); mini.fill(); mini.stroke();
    }
    mini.fillStyle = '#c41e2a'; mini.strokeStyle = '#fff'; mini.lineWidth = 2;
    mini.beginPath(); mini.moveTo(W / 2, W / 2 - 9); mini.lineTo(W / 2 + 6, W / 2 + 7); mini.lineTo(W / 2 - 6, W / 2 + 7); mini.closePath(); mini.fill(); mini.stroke();
    const ms = performance.now() - t0; stats.frames++; stats.drawMs += ms; if (ms > stats.drawMax) stats.drawMax = ms;
  }

  const api = { draw, stats: () => ({ ...stats, zoom, active: active.length, res: RES, cap: CAP, avgDrawMs: stats.drawMs / Math.max(1, stats.frames) }) };
  if (location.search.includes('debug')) window.__pdMinimap = api;
  return api;
}
