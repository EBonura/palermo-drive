// Street surfaces: asphalt, stone paving, raised sidewalks with curbs, grass, sand and water, draped on the terrain.
// Moved out of main.js so the centro map (D.streets) and the streamed world tiles (src/world.js) build the same way.
// buildStreets(streets, opts) returns a Group; streetsIter is the same thing as a generator that yields every few polygons,
// so the world streamer can spread a tile over several frames.
import * as THREE from 'three';
import { groundY, Buf, pairs, canvasTex, rnd, speckle } from './core.js';

export const CURB = 0.15;

// ---------- tiled ground materials (procedural, world-space UVs) ----------
export const TEX = {
  asphalt: canvasTex(512, (g, S) => {
    // Palermo asphalt is sun-bleached and patched, never black (style guide: base #7e7c76).
    g.fillStyle = '#7e7c76'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) { // rectangular repair patches
      g.fillStyle = `rgba(90,89,85,${rnd(0.35, 0.6)})`;
      g.save(); g.translate(rnd(0, S), rnd(0, S)); g.rotate(rnd(-0.2, 0.2)); g.fillRect(0, 0, rnd(40, 160), rnd(30, 110)); g.restore();
    }
    for (let i = 0; i < 12; i++) { // stains
      g.fillStyle = `rgba(${Math.random() < 0.6 ? '70,68,64' : '150,147,138'},${rnd(0.08, 0.2)})`;
      g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(20, 90), rnd(15, 60), rnd(0, 3), 0, 7); g.fill();
    }
    speckle(g, S, 9000, ['#8c8a83', '#6c6a65', '#9a978f', '#74726c'], 1, 3);
    g.strokeStyle = 'rgba(55,54,50,0.6)'; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { // cracks
      let x = rnd(0, S), y = rnd(0, S); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 12; k++) { x += rnd(-14, 14); y += rnd(-14, 14); g.lineTo(x, y); } g.stroke();
    }
  }, 6),
  balate: canvasTex(512, (g, S) => { // worn limestone slabs in running courses of irregular length
    g.fillStyle = '#4f4a43'; g.fillRect(0, 0, S, S);
    const rows = 5, h = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(0, 120);
      while (x < S) {
        const w = rnd(110, 230), v = rnd(-0.08, 0.08), base = [166, 158, 146].map(c => Math.round(c * (1 + v)));
        g.fillStyle = `rgb(${base})`;
        for (const dx of [0, S]) g.fillRect(x + 2 - dx, r * h + 2, w - 4, h - 4); // wraps horizontally
        if (Math.random() < 0.2) { // cracked through
          g.strokeStyle = 'rgba(60,55,50,0.6)'; g.lineWidth = 1.2; g.beginPath();
          g.moveTo(x + rnd(10, w - 10), r * h + 2); g.lineTo(x + rnd(10, w - 10), r * h + h - 2); g.stroke();
        }
        x += w;
      }
    }
    speckle(g, S, 5000, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.09)'], 1, 3);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(60,55,48,${rnd(0.06, 0.14)})`; g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(10, 35), rnd(8, 25), 0, 0, 7); g.fill(); }
  }, 3),
  sidewalk: canvasTex(512, (g, S) => { // pale grey stone slabs
    g.fillStyle = '#8d8e86'; g.fillRect(0, 0, S, S);
    const n = 4, w = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = rnd(-9, 9); g.fillStyle = `rgb(${[193, 195, 184].map(x => Math.round(x + v))})`;
      g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
    }
    speckle(g, S, 6000, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.10)'], 1, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(40,35,30,${rnd(0.05, 0.12)})`; g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(10, 40), rnd(8, 30), 0, 0, 7); g.fill(); }
  }, 2),
  grass: canvasTex(256, (g, S) => {
    g.fillStyle = '#6f8a45'; g.fillRect(0, 0, S, S);
    speckle(g, S, 7000, ['#7f9a52', '#5f7a3a', '#8aa35c', '#6b7f40'], 1, 3);
  }, 3),
  sand: canvasTex(128, (g, S) => { // beaches of the world tiles (Mondello)
    g.fillStyle = '#d6c79f'; g.fillRect(0, 0, S, S);
    speckle(g, S, 2600, ['#e2d5b0', '#c9ba90', '#d0c196', '#e8dcba'], 1, 2);
  }, 4),
};

// ---------- street geometry ----------
// Triangulated street polygons have long triangles that would cut through the terrain between
// their corners; split them until every edge is short enough to follow the lidar ground.
const DRAPE_MAX = 5;
// Only split a ground triangle when the ground under it actually bends (measured by the perf work: 2.33M -> 1.25M visible
// triangles at Quattro Canti for a 0.05-0.08% pixel difference); very long triangles are split anyway.
const FLAT_TOL = 0.04, SPLIT_ANYWAY = 40;
function bends(a, b, c) {
  const ga = groundY(a.x, a.y), gb = groundY(b.x, b.y), gc = groundY(c.x, c.y);
  return Math.abs(groundY((a.x + b.x) / 2, (a.y + b.y) / 2) - (ga + gb) / 2) > FLAT_TOL
    || Math.abs(groundY((b.x + c.x) / 2, (b.y + c.y) / 2) - (gb + gc) / 2) > FLAT_TOL
    || Math.abs(groundY((c.x + a.x) / 2, (c.y + a.y) / 2) - (gc + ga) / 2) > FLAT_TOL
    || Math.abs(groundY((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3) - (ga + gb + gc) / 3) > FLAT_TOL;
}
function drape(buf, a, b, c, lift, col, m, max, depth = 0) {
  const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a), longest = Math.max(ab, bc, ca);
  if (longest > max && depth < 8 && (longest > SPLIT_ANYWAY || bends(a, b, c))) {
    // split the longest edge; winding is preserved in both halves
    if (longest === ab) { const d = a.clone().lerp(b, 0.5); drape(buf, a, d, c, lift, col, m, max, depth + 1); drape(buf, d, b, c, lift, col, m, max, depth + 1); }
    else if (longest === bc) { const d = b.clone().lerp(c, 0.5); drape(buf, a, b, d, lift, col, m, max, depth + 1); drape(buf, a, d, c, lift, col, m, max, depth + 1); }
    else { const d = c.clone().lerp(a, 0.5); drape(buf, a, b, d, lift, col, m, max, depth + 1); drape(buf, d, b, c, lift, col, m, max, depth + 1); }
    return;
  }
  for (const p of [a, b, c]) buf.v(p.x, groundY(p.x, p.y) + lift, p.y, 0, 1, 0, col, p.x / m, p.y / m);
}
export const LAYERS = { asphalt: 0.0, paving: 0.01, sand: 0.005, water: -0.25, raised: CURB, green: CURB + 0.01 };
// World tiles are seen from far away: pull each layer towards the camera in depth so 0.15 m of lift doesn't z-fight at 1 km.
const POLY_OFFSET = { asphalt: [-2, -2], sand: [-1, -1], paving: [-3, -3], water: [0, 0], raised: [-4, -4], green: [-5, -5] };

const matCache = new Map();
function layerMaterial(layer, offset) {
  const key = layer + (offset ? '+' : '');
  let mat = matCache.get(key);
  if (mat) return mat;
  const tex = { asphalt: TEX.asphalt, paving: TEX.balate, raised: TEX.sidewalk, green: TEX.grass, sand: TEX.sand }[layer];
  mat = layer === 'water'
    ? new THREE.MeshStandardMaterial({ color: '#2a6f8c', roughness: 0.1 })
    : new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: layer === 'asphalt' ? 0.85 : 0.95 });
  if (offset) { const [f, u] = POLY_OFFSET[layer]; mat.polygonOffset = true; mat.polygonOffsetFactor = f; mat.polygonOffsetUnits = u; }
  matCache.set(key, mat);
  return mat;
}
let curbMat = null;
const WHITE = new THREE.Color(1, 1, 1);

// opts: layers (names to build, default all of LAYERS), curbs (default true), offset (depth offset for streamed tiles).
export function* streetsIter(streets, group, opts = {}) {
  const layers = opts.layers || Object.keys(LAYERS), offset = !!opts.offset, dmax = opts.drape || DRAPE_MAX, chunk = opts.chunk === undefined ? 250 : opts.chunk; // opts.drape: longest triangle edge (m); streamed tiles use more
  let tris = 0, n = 0;
  for (const layer of layers) {
    const polys = streets[layer];
    if (!polys || !polys.length) continue;
    const tex = { asphalt: TEX.asphalt, paving: TEX.balate, raised: TEX.sidewalk, green: TEX.grass, sand: TEX.sand }[layer];
    const m = tex ? tex.metres : 1, lift = LAYERS[layer], bufs = new Map();
    for (const poly of polys) {
      // one mesh per chunk (opts.chunk metres, default 250; 0 = a single mesh, as the streamed world tiles want) so frustum culling helps
      const ck = chunk ? Math.floor(poly[0][0] / chunk) * 100003 + Math.floor(poly[0][1] / chunk) : 0;
      let buf = bufs.get(ck); if (!buf) bufs.set(ck, buf = new Buf());
      const contour = pairs(poly[0]).map(p => new THREE.Vector2(p[0], p[1]));
      const holes = poly.slice(1).map(h => pairs(h).map(p => new THREE.Vector2(p[0], p[1])));
      let tris3;
      try { tris3 = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { continue; }
      const all = contour.concat(...holes);
      for (const t of tris3) {
        let [a, b, c] = t.map(i => all[i]);
        if ((b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y) < 0) [b, c] = [c, b];
        drape(buf, a, b, c, lift, WHITE, m, dmax);
      }
      if ((++n & 7) === 0) yield;
    }
    for (const buf of bufs.values()) {
      if (!buf.p.length) continue;
      const mesh = buf.mesh(layerMaterial(layer, offset));
      mesh.receiveShadow = true;
      mesh.name = 'street_' + layer;
      tris += buf.p.length / 9;
      group.add(mesh);
    }
    yield;
  }
  // Curbs: the road is on the left of each line. Vertical face plus a stone top strip.
  if (opts.curbs !== false && streets.curbs && streets.curbs.length) {
    const curb = new Buf(), stone = new THREE.Color('#d6d1cb'), TOP = 0.28;
    for (const flat of streets.curbs) {
      const p = pairs(flat);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.01) continue;
        const nx = -dz / len, nz = dx / len; // towards the road
        const ga = groundY(a[0], a[1]), gb = groundY(b[0], b[1]);
        const A0 = [a[0], ga, a[1]], B0 = [b[0], gb, b[1]], A1 = [a[0], ga + CURB + 0.005, a[1]], B1 = [b[0], gb + CURB + 0.005, b[1]];
        for (const q of [A0, B0, A1, B0, B1, A1]) curb.v(q[0], q[1], q[2], nx, 0, nz, stone, 0, 0, 0.8);
        const Ai = [a[0] - nx * TOP, ga + CURB + 0.005, a[1] - nz * TOP], Bi = [b[0] - nx * TOP, gb + CURB + 0.005, b[1] - nz * TOP];
        for (const q of [A1, B1, Ai, B1, Bi, Ai]) curb.v(q[0], q[1], q[2], 0, 1, 0, stone);
      }
      if ((++n & 15) === 0) yield;
    }
    if (curb.p.length) {
      curbMat = curbMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      const curbMesh = curb.mesh(curbMat);
      curbMesh.receiveShadow = true;
      curbMesh.name = 'street_curbs';
      tris += curb.p.length / 9;
      group.add(curbMesh);
    }
  }
  group.userData.tris = (group.userData.tris || 0) + tris;
  return group;
}

export function buildStreets(streets, opts) {
  const group = new THREE.Group();
  const it = streetsIter(streets, group, opts);
  while (!it.next().done);
  return group;
}
