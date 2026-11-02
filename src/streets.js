// Street surfaces: asphalt, stone paving, raised sidewalks with curbs, road verges, grass, sand and water, draped on the terrain.
// Moved out of main.js so the centro map (D.streets) and the streamed world tiles (src/world.js) build the same way.
// buildStreets(streets, opts) returns a Group; streetsIter is the same thing as a generator that yields every few polygons,
// so the world streamer can spread a tile over several frames.
import * as THREE from 'three';
import { groundY, Buf, pairs, canvasTex, rnd, speckle } from './core.js';
import { gardenDraw, gardenPatch } from './gardens.js';

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
  median: canvasTex(256, (g, S) => { // the concrete strip between the two roadways of a dual carriageway: cast slabs, grey, not a pavement
    g.fillStyle = '#6f706b'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const v = rnd(-7, 7); g.fillStyle = `rgb(${[132, 133, 128].map(c => Math.round(c + v))})`; g.fillRect(i * (S / 4) + 2, j * (S / 2) + 2, S / 4 - 4, S / 2 - 4); }
    speckle(g, S, 5000, ['rgba(0,0,0,0.14)', 'rgba(255,255,255,0.07)'], 1, 2);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(30,28,25,${rnd(0.06, 0.14)})`; g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(10, 36), rnd(6, 20), 0, 0, 7); g.fill(); }
  }, 2),
  verge: canvasTex(256, (g, S) => { // the strip between kerb-less asphalt and the fields: trodden dry grass, grit and dust
    g.fillStyle = '#9a8d62'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '128,114,72' : '160,142,92'},${rnd(0.12, 0.3)})`; g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(14, 46), rnd(8, 28), rnd(0, 3), 0, 7); g.fill(); }
    speckle(g, S, 7000, ['#aa9c70', '#867a52', '#b3a67a', '#7a6e4a', '#938558'], 1, 3);
  }, 3),
  grass: canvasTex(256, (g, S) => { // park lawn: Palermo's grass is never lime, it is olive with dry straw patches
    g.fillStyle = '#6b7c43'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${Math.random() < 0.6 ? '150,140,86' : '70,92,50'},${rnd(0.12, 0.3)})`; g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(14, 50), rnd(10, 34), rnd(0, 3), 0, 7); g.fill(); }
    speckle(g, S, 7000, ['#7c8a4c', '#5a6e38', '#8c9356', '#667840', '#9a9560'], 1, 3);
  }, 3),
  sand: canvasTex(256, (g, S) => { // beaches of the world tiles (Mondello: pale, fine, slightly rippled sand)
    g.fillStyle = '#ddd3b9'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { // wind ripples and footprints-sized dimples
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '190,172,132' : '236,226,196'},${rnd(0.08, 0.2)})`;
      g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(14, 46), rnd(3, 8), rnd(-0.3, 0.3), 0, 7); g.fill();
    }
    speckle(g, S, 3600, ['#e6dab6', '#c9ba90', '#d3c49a', '#ece2c2', '#bfae84'], 1, 2);
  }, 6),
  // Detail multiplied over the vertex-coloured terrain of the world tiles (world-space UVs, 48 m repeat). Near white on purpose:
  // the land cover colour comes from the vertices, this only breaks the flat colour up with rock flecks, scrub clumps and tufts.
  // On steep faces the world UVs stretch along the fall line, which reads as limestone weathering streaks.
  terrain: canvasTex(512, (g, S) => {
    g.fillStyle = '#f0eee6'; g.fillRect(0, 0, S, S);
    const wrap = (fn) => { for (const dx of [0, -S]) for (const dy of [0, -S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    for (let i = 0; i < 70; i++) { // large soft blotches (patches of drier or greener ground)
      const x = rnd(0, S), y = rnd(0, S), rx = rnd(30, 110), ry = rnd(24, 80), a = rnd(0, 3), dark = Math.random() < 0.55;
      g.fillStyle = dark ? `rgba(70,66,48,${rnd(0.05, 0.12)})` : `rgba(255,252,236,${rnd(0.08, 0.18)})`;
      wrap(() => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); });
    }
    for (let i = 0; i < 900; i++) { // scrub clumps: small dark olive blobs with a lighter tuft beside them
      const x = rnd(0, S), y = rnd(0, S), r = rnd(1.5, 4.5);
      g.fillStyle = `rgba(${Math.random() < 0.7 ? '92,86,52' : '112,98,60'},${rnd(0.16, 0.34)})`;
      wrap(() => { g.beginPath(); g.ellipse(x, y, r, r * rnd(0.6, 1), rnd(0, 3), 0, 7); g.fill(); });
      g.fillStyle = 'rgba(255,248,214,0.18)';
      wrap(() => { g.beginPath(); g.ellipse(x + r * 0.9, y - r * 0.6, r * 0.6, r * 0.35, 0.4, 0, 7); g.fill(); });
    }
    for (let i = 0; i < 160; i++) { // pale limestone flecks and cracks
      const x = rnd(0, S), y = rnd(0, S), w = rnd(3, 11), h = rnd(2, 5);
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,250' : '120,112,98'},${rnd(0.2, 0.4)})`;
      wrap(() => g.fillRect(x, y, w, h));
    }
    speckle(g, S, 9000, ['rgba(60,56,44,0.16)', 'rgba(255,255,245,0.16)', 'rgba(110,100,70,0.12)'], 1, 2);
  }, 48),
};

// ---------- street geometry ----------
// Triangulated street polygons have long triangles that would cut through the terrain between
// their corners; split them until every edge is short enough to follow the lidar ground.
const DRAPE_MAX = 5;
// Only split a ground triangle when the ground under it actually bends (measured by the perf work: 2.33M -> 1.25M visible
// triangles at Quattro Canti for a 0.05-0.08% pixel difference); very long triangles are split anyway.
const FLAT_TOL = 0.04, SPLIT_ANYWAY = 40;
// On benched hill tiles (opts.fine) a triangle over 5 m is split as soon as the ground under it is more than 10 cm off its plane, whatever the
// 18 m cap says: a road that climbs and turns (a hairpin, a gully crossing) otherwise gets a long triangle that cuts across the bench, banked
// by metres and hanging off the ground the car drives on. Everywhere else the gate above is unchanged.
const FINE_MIN = 5, FINE_TOL = 0.1;
let GROUND = groundY, FINE = false;   // set per streetsIter call: the ground to drape on (a tile's own, see src/world.js groundFor) and the fine split above
function bends(a, b, c, tol = FLAT_TOL) {
  const ga = GROUND(a.x, a.y), gb = GROUND(b.x, b.y), gc = GROUND(c.x, c.y);
  return Math.abs(GROUND((a.x + b.x) / 2, (a.y + b.y) / 2) - (ga + gb) / 2) > tol
    || Math.abs(GROUND((b.x + c.x) / 2, (b.y + c.y) / 2) - (gb + gc) / 2) > tol
    || Math.abs(GROUND((c.x + a.x) / 2, (c.y + a.y) / 2) - (gc + ga) / 2) > tol
    || Math.abs(GROUND((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3) - (ga + gb + gc) / 3) > tol;
}
function drape(buf, a, b, c, lift, col, m, max, depth = 0) {
  const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a), longest = Math.max(ab, bc, ca);
  if (depth < 8 && ((longest > max && (longest > SPLIT_ANYWAY || bends(a, b, c))) || (FINE && longest > FINE_MIN && bends(a, b, c, FINE_TOL)))) {
    // split the longest edge; winding is preserved in both halves
    if (longest === ab) { const d = a.clone().lerp(b, 0.5); drape(buf, a, d, c, lift, col, m, max, depth + 1); drape(buf, d, b, c, lift, col, m, max, depth + 1); }
    else if (longest === bc) { const d = b.clone().lerp(c, 0.5); drape(buf, a, b, d, lift, col, m, max, depth + 1); drape(buf, a, d, c, lift, col, m, max, depth + 1); }
    else { const d = c.clone().lerp(a, 0.5); drape(buf, a, b, d, lift, col, m, max, depth + 1); drape(buf, d, b, c, lift, col, m, max, depth + 1); }
    return;
  }
  for (const p of [a, b, c]) buf.v(p.x, GROUND(p.x, p.y) + lift, p.y, 0, 1, 0, TINT ? TINT(p.x, p.y) : col, p.x / m, p.y / m);
}
let TINT = null;   // opts.tint(layer) -> (x, z) -> THREE.Color: the colours of the orthophotos relative to the layer's own texture (tile.gt, src/world.js)
export const LAYERS = { asphalt: 0.0, paving: 0.01, sand: 0.005, verge: 0.004, water: -0.25, raised: CURB, median: CURB, green: CURB + 0.01 };
// World tiles are seen from far away: pull each layer towards the camera in depth so 0.15 m of lift doesn't z-fight at 1 km.
const POLY_OFFSET = { asphalt: [-2, -2], sand: [-1, -1], verge: [-1, -1], paving: [-3, -3], water: [0, 0], raised: [-4, -4], median: [-4, -4], green: [-5, -5] };

const matCache = new Map();
function layerMaterial(layer, offset) {
  const key = layer + (offset ? '+' : '');
  let mat = matCache.get(key);
  if (mat) return mat;
  const tex = { asphalt: TEX.asphalt, paving: TEX.balate, raised: TEX.sidewalk, median: TEX.median, green: TEX.grass, sand: TEX.sand, verge: TEX.verge }[layer];
  mat = layer === 'water'
    ? new THREE.MeshStandardMaterial({ color: '#2a6f8c', roughness: 0.1 })
    : new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: layer === 'asphalt' ? 0.85 : 0.95 });
  if (offset && layer === 'raised') gardenPatch(mat, TEX.grass);   // Mondello's villa yards are gardens, see src/gardens.js
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
  const g0 = opts.ground || groundY, f0 = !!opts.fine;   // (set again after every yield: another tile's build may have run in between)
  GROUND = g0; FINE = f0;
  if (offset) gardenDraw(streets);
  for (const layer of layers) {
    const polys = streets[layer];
    if (!polys || !polys.length) continue;
    const tex = { asphalt: TEX.asphalt, paving: TEX.balate, raised: TEX.sidewalk, median: TEX.median, green: TEX.grass, sand: TEX.sand, verge: TEX.verge }[layer];
    const m = tex ? tex.metres : 1, lift = LAYERS[layer], bufs = new Map();
    TINT = opts.tint ? opts.tint(layer) : null;
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
      if ((++n & 7) === 0) { yield; GROUND = g0; FINE = f0; }
    }
    for (const buf of bufs.values()) {
      if (!buf.p.length) continue;
      const mesh = buf.mesh(layerMaterial(layer, offset));
      mesh.receiveShadow = true;
      mesh.name = 'street_' + layer;
      tris += buf.p.length / 9;
      group.add(mesh);
    }
    yield; GROUND = g0; FINE = f0;
  }
  TINT = null; FINE = false;
  // Curbs: the road is on the left of each line. Vertical face plus a stone top strip.
  if (opts.curbs !== false && streets.curbs && streets.curbs.length) {
    const curb = new Buf(), stone = new THREE.Color('#d6d1cb'), TOP = 0.28;
    for (const flat of streets.curbs) {
      const p = pairs(flat);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.01) continue;
        const nx = -dz / len, nz = dx / len; // towards the road
        const ga = GROUND(a[0], a[1]), gb = GROUND(b[0], b[1]);
        const A0 = [a[0], ga, a[1]], B0 = [b[0], gb, b[1]], A1 = [a[0], ga + CURB + 0.005, a[1]], B1 = [b[0], gb + CURB + 0.005, b[1]];
        for (const q of [A0, B0, A1, B0, B1, A1]) curb.v(q[0], q[1], q[2], nx, 0, nz, stone, 0, 0, 0.8);
        const Ai = [a[0] - nx * TOP, ga + CURB + 0.005, a[1] - nz * TOP], Bi = [b[0] - nx * TOP, gb + CURB + 0.005, b[1] - nz * TOP];
        for (const q of [A1, B1, Ai, B1, Bi, Ai]) curb.v(q[0], q[1], q[2], 0, 1, 0, stone);
      }
      if ((++n & 15) === 0) { yield; GROUND = g0; }
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
  GROUND = groundY;
  group.userData.tris = (group.userData.tris || 0) + tris;
  return group;
}

export function buildStreets(streets, opts) {
  const group = new THREE.Group();
  const it = streetsIter(streets, group, opts);
  while (!it.next().done);
  return group;
}

// ---------- road paint outside the centro: lane lines, edge lines and zebra crossings (world tiles) ----------
// Palermo's surfaced roads outside the centro storico carry white paint (worn, never fresh). Roads under 5.5 m wide (vicoli, service
// roads) get none. Dashes are left out wherever another road crosses or joins, so junctions stay clear.
const CAR_W = { motorway: 8, motorway_link: 4.5, trunk: 9, trunk_link: 4.5, primary: 10, primary_link: 4.5, secondary: 9, secondary_link: 4.5,
  tertiary: 8, tertiary_link: 4.5, unclassified: 6, residential: 5.5, living_street: 4.5, service: 3.5 };
const EDGE_LINED = new Set(['motorway', 'trunk', 'primary']);
const PAINT = new THREE.Color('#dedbd0');
let paintMat = null;
// roads: tile roads[]; crossings: tile props items (k 'crossing', x, z). Returns a Group (or null when there is nothing to paint).
export function* roadMarksIter(roads, crossings, skip) { // skip(x, z) -> true where something else already paints the road (the centro, src/roadwear.js)
  const cell = 24, grid = new Map(), segs = [];
  const cw = r => r.cw || CAR_W[r.k] || 0;
  roads.forEach((r, id) => {
    const w = cw(r); if (!w || r.tn) return;
    const p = r.p;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const sg = { x0: p[i], z0: p[i + 1], x1: p[i + 2], z1: p[i + 3], hw: w / 2, id };
      segs.push(sg);
      for (let ix = Math.floor(Math.min(sg.x0, sg.x1) / cell); ix <= Math.floor(Math.max(sg.x0, sg.x1) / cell); ix++)
        for (let iz = Math.floor(Math.min(sg.z0, sg.z1) / cell); iz <= Math.floor(Math.max(sg.z0, sg.z1) / cell); iz++) {
          const k = ix * 100003 + iz; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(sg);
        }
    }
  });
  const distSeg = (x, z, s) => {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.x0) * dx + (z - s.z0) * dz) / l2)) : 0, qx = s.x0 + dx * t - x, qz = s.z0 + dz * t - z;
    return Math.sqrt(qx * qx + qz * qz);
  };
  const clear = (x, z, id, extra) => { // true when no other road overlaps this spot
    const a = grid.get(Math.floor(x / cell) * 100003 + Math.floor(z / cell)); if (!a) return true;
    for (const s of a) if (s.id !== id && distSeg(x, z, s) < s.hw + extra) return false;
    return true;
  };
  const P = [], N = [], Cc = [];
  let nq = 0;
  const quad = (x0, z0, x1, z1, hw, shade) => { // a strip from (x0,z0) to (x1,z1), 2*hw wide
    const dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz); if (l < 0.01) return;
    const nx = -dz / l * hw, nz = dx / l * hw, c = PAINT, k = shade;
    const A = [x0 + nx, z0 + nz], B = [x0 - nx, z0 - nz], C2 = [x1 - nx, z1 - nz], D = [x1 + nx, z1 + nz];
    for (const q of [A, C2, B, A, D, C2]) { P.push(q[0], groundY(q[0], q[1]) + 0.035, q[1]); N.push(0, 1, 0); Cc.push(c.r * k, c.g * k, c.b * k); }
    nq++;
  };
  // paints a line offset `off` m to the left of the centreline: dashed (dash, gap) or continuous in 6 m pieces
  const line = (r, id, off, dash, gap, hw, rng) => {
    const p = r.p, d = dash || 6, per = d + (dash ? gap : 0); let arc = 0;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], dx = bx - ax, dz = bz - az, L = Math.sqrt(dx * dx + dz * dz);
      if (L < 0.3) continue;
      const tx = dx / L, tz = dz / L, nx = -tz, nz = tx;
      for (let k = Math.floor(arc / per); k * per < arc + L; k++) { // pattern periods are laid on the arc length, so dashes run on round bends
        const u0 = Math.max(0, k * per - arc), u1 = Math.min(L, k * per + d - arc);
        if (u1 - u0 < 0.6) continue;
        const mx = ax + tx * (u0 + u1) / 2 + nx * off, mz = az + tz * (u0 + u1) / 2 + nz * off;
        if ((skip && skip(mx, mz)) || !clear(mx, mz, id, hw + 2.2) || rng() < 0.07) continue; // junctions stay clear; a few dashes have worn away
        quad(ax + tx * u0 + nx * off, az + tz * u0 + nz * off, ax + tx * u1 + nx * off, az + tz * u1 + nz * off, hw, 0.78 + 0.22 * rng());
      }
      arc += L;
    }
  };
  let seed = 12345; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let n = 0;
  for (let id = 0; id < roads.length; id++) {
    const r = roads[id], w = cw(r);
    if (!w || r.tn || r.br || r.j === 'roundabout' || w < 5.5 || r.p.length < 4) continue;
    const lanes = r.l || Math.max(1, Math.round(w / 3.2));
    if (r.o) {
      for (let i = 1; i < lanes; i++) line(r, id, (i - lanes / 2) * (w / lanes), 3, 6, 0.075, rng); // lane dividers, dashed
    } else if (w >= 11) {
      line(r, id, 0, 0, 0, 0.09, rng); // four lanes or more: solid centre line, dashed lane lines either side
      line(r, id, w / 4, 3, 6, 0.075, rng); line(r, id, -w / 4, 3, 6, 0.075, rng);
    } else {
      line(r, id, 0, 3, 6, 0.075, rng); // two lanes: dashed white centre line
    }
    if (EDGE_LINED.has(r.k) && w >= 7) { line(r, id, w / 2 - 0.3, 0, 0, 0.06, rng); line(r, id, -w / 2 + 0.3, 0, 0, 0.06, rng); }
    if ((++n & 15) === 0) yield;
  }
  // zebra crossings at OSM crossing nodes: bars 0.5 m wide, 3 m long, along the road, across its whole width
  for (const c of crossings || []) {
    let best = null, bd = 6;
    const a = grid.get(Math.floor(c.x / cell) * 100003 + Math.floor(c.z / cell)) || [];
    for (const s of a) { const d = distSeg(c.x, c.z, s); if (d < bd && s.hw >= 2.5 && !(roads[s.id].br || roads[s.id].j === 'roundabout')) { bd = d; best = s; } }
    if (!best || (skip && skip(c.x, c.z))) continue;
    const dx = best.x1 - best.x0, dz = best.z1 - best.z0, L = Math.sqrt(dx * dx + dz * dz) || 1, tx = dx / L, tz = dz / L, nx = -tz, nz = tx;
    const half = best.hw, bars = Math.max(2, Math.floor(half * 2 / 1.0));
    // snap the centre of the zebra onto the centreline
    const t0 = Math.max(0, Math.min(L, (c.x - best.x0) * tx + (c.z - best.z0) * tz)), cx = best.x0 + tx * t0, cz = best.z0 + tz * t0;
    for (let b = 0; b < bars; b++) {
      const off = -half + 0.5 + b * ((half * 2 - 1) / Math.max(1, bars - 1));
      const sx = cx + nx * off, sz = cz + nz * off;
      quad(sx - tx * 1.6, sz - tz * 1.6, sx + tx * 1.6, sz + tz * 1.6, 0.25, 0.82 + 0.18 * rng());
    }
    if ((++n & 7) === 0) yield;
  }
  if (!nq) return null;
  const idx = new Uint32Array(P.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3));
  geo.setIndex(new THREE.BufferAttribute(idx.length < 65536 ? new Uint16Array(idx) : idx, 1));
  paintMat = paintMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3.5, polygonOffsetUnits: -3.5 });
  const m = new THREE.Mesh(geo, paintMat); m.name = 'road_paint'; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); g.userData.tris = P.length / 9;
  return g;
}
