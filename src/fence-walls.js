// What the mapped "fence" lines beside a street are. The Regione Siciliana CTR draws every enclosure line of a plot as a fence (E002), and tools/fences.py gave each a railing, wooden
// or mesh style by chance: 339 km of black railings and chain-link standing at the kerb, against 777 km of walls. In Palermo's streets (photos at Via Messina Marine, Via Filippo Paruta,
// Via Ciaculli, Cimitero Rotoli) the plot edge on the street is a wall: plastered or bare block, rough stone, a low wall with a rail on it, a hoarding round a lot. So every piece of a
// fence that stands within NEAR m of the edge of a carriageway is re-read here, per stretch of 22 to 60 m (a stretch is one property), from what the tile knows: how far a building stands
// from it (an open lot gets a hoarding or a block wall), the zone (the old town keeps plaster and stone), a hash of where it starts (so a tile always builds the same). A share stays a fence
// (railings of gardens, schools, yards; the style it had), the rest becomes a wall piece that src/fences.js builds in the wall mesh and collides as the fence did: same 2.5 m pieces on the same
// line, same breaking speed, same push-back (the `fence` flag), so only what you see changes. Away from the street, and short bits, stay as they were.
//
// The mapped walls (kind w, the CTR's E003 lines, which tools/fences.py gave an invented height of 1.8 to 2.6 m: the CTR has none) beside a carriageway are finished by what stands round them, too:
//   * beside a fast road (src/road-class.js isFastRoad: motorways, the expressways, the one-way carriageways of Viale Regione Siciliana, its side lanes where nothing is built beside them) a wall within FAST m of the asphalt is the road's steel guard rail in
//     the photos (nw30, nw29, zw33), so it becomes a rail, or is dropped where the rail rule already put one (`rails`: nothing is drawn twice); a wall over FAST m away is left as mapped;
//   * near the sea (open water within 70 m on either side, low ground) a wall is a parapet: 0.8 to 1.2 m, with a railing on it or in plain stone, so it never blocks the view of the water (nw19, nw22);
//   * in hill villages and the countryside (high ground, or open or green land beside the road) it is rubble stone, dry stone, lime wash or block, mostly lower, with a mesh over a low wall now and then;
//   * in a town it is lime wash (with and without a fallen patch), worn plaster, block or rubble, 1.5 to 2.1 m; the old town keeps its walls as mapped.
// They carry `bk: 'w'` (src/fences.js breakSpeed) so they break at the speed a wall of their new height did, not as the stone and block kinds, which stay solid.
import { sliceOver } from './slice.js';
import { histW } from './streets.js';
import { inPoly, groundY } from './core.js';
import { isFastRoad, fastParts } from './road-class.js';

const NEAR = 8, STEP = 3, FAST = 6, RAIL_NEAR = 6;
const DRIVE = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);
const GREEN = new Set(['green', 'forest', 'orchard', 'olive', 'farm', 'cemetery', 'pitch']);
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
const hh = Math.hypot;
function resample(p, step) { // flat polyline -> points about `step` apart, keeping the corners
  const out = [[p[0], p[1]]];
  for (let k = 2; k < p.length; k += 2) {
    const ax = p[k - 2], az = p[k - 1], bx = p[k], bz = p[k + 1], n = Math.max(1, Math.round(hh(bx - ax, bz - az) / step));
    for (let i = 1; i <= n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]);
  }
  return out;
}
const C = 32;   // metres per cell of the grids below
const cell = (x, z) => Math.floor(x / C) * 100003 + Math.floor(z / C);
function put(grid, x0, z0, x1, z1, v) {
  for (let i = Math.floor(Math.min(x0, x1) / C); i <= Math.floor(Math.max(x0, x1) / C); i++) for (let j = Math.floor(Math.min(z0, z1) / C); j <= Math.floor(Math.max(z0, z1) / C); j++) { const k = i * 100003 + j; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(v); }
}

// list: the tile's fences [{k, h, s, p}], roads, buildings and tram (its `r` rails): the tile's own. A fence within 7 m of a tram rail is the tram's railing and stays. rails: the guard rails the fast road rule made for this tile (src/expressway.js).
// Returns the list with the roadside fences and walls re-read (it is the same list when nothing changes).
export function* roadsideWalls(list, roads, buildings, tram, areas, rails) {
  if (!list || !list.length || !roads || !roads.length) return list;
  const rg = new Map(), bg = new Map(), xg = new Map(), vg = new Map();   // vg: the decks of viaducts: ground under one is not the roadside of its road   // xg: the fast roads (src/expressway.js): a fence beside one is the right-of-way fence, wire mesh, never a plastered wall
  for (const r of roads) {
    if (r.br && DRIVE.has(r.k) && r.p && r.p.length >= 4) for (let i = 0; i + 3 < r.p.length; i += 2) put(vg, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], (r.cw || r.w || 6) / 2 + 8]);
    if (!DRIVE.has(r.k) || r.tn || r.br || !r.p || r.p.length < 4) continue;   // (a viaduct is no street for the ground under it: a wall there was drawn across the view of the deck, nw24)
    const hw = (r.cw || r.w || 6) / 2, fast = isFastRoad(r);
    if (fast) { for (const [x0, z0, x1, z1, open] of fastParts(r)) put(open ? xg : rg, x0, z0, x1, z1, [x0, z0, x1, z1, hw]); }   // (a built-up stretch of a lane is a city street: its walls are finished as the street's)
    else for (let i = 0; i + 3 < r.p.length; i += 2) put(rg, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], hw]);
  }
  if (!rg.size && !xg.size) return list;
  for (const b of buildings || []) { // the outline of every building, a point every 6 m
    const p = b.p; for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length, n = Math.max(1, Math.ceil(hh(p[j] - p[i], p[j + 1] - p[i + 1]) / 6));
      for (let q = 0; q < n; q++) { const x = p[i] + (p[j] - p[i]) * q / n, z = p[i + 1] + (p[j + 1] - p[i + 1]) * q / n; put(bg, x, z, x, z, [x, z]); }
    }
  }
  const veg = (areas || []).filter(a => GREEN.has(a.k) && a.p && a.p.length >= 6).map(a => { const pts = []; for (let i = 0; i < a.p.length; i += 2) pts.push([a.p[i], a.p[i + 1]]); return pts; });   // land cover that is green or open
  const rg2 = new Map();   // the rails already there: the rule's rails of this tile
  for (const q of rails || []) for (let i = 0; i + 1 < q.p.length; i += 2) put(rg2, q.p[i], q.p[i + 1], q.p[i], q.p[i + 1], [q.p[i], q.p[i + 1]]);
  const railNear = (x, z, d) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = rg2.get((Math.floor(x / C) + i) * 100003 + Math.floor(z / C) + j); if (a) for (const q of a) if (hh(x - q[0], z - q[1]) < d) return true; }
    return false;
  };
  const tg = new Map();
  for (const r of (tram && tram.r) || []) for (let i = 0; i + 3 < r.p.length; i += 2) { const n = Math.max(1, Math.ceil(hh(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]) / 4)); for (let q = 0; q <= n; q++) { const x = r.p[i] + (r.p[i + 2] - r.p[i]) * q / n, z = r.p[i + 1] + (r.p[i + 3] - r.p[i + 1]) * q / n; put(tg, x, z, x, z, [x, z]); } }
  const tramNear = (x, z) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = tg.get((Math.floor(x / C) + i) * 100003 + Math.floor(z / C) + j); if (a) for (const q of a) if (hh(x - q[0], z - q[1]) < 7) return true; }
    return false;
  };
  const gap = (x, z, g = rg) => { // metres from the edge of the nearest carriageway
    let best = 1e9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = g.get((Math.floor(x / C) + i) * 100003 + Math.floor(z / C) + j); if (!a) continue;
      for (const s of a) {
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
        const d = hh(x - s[0] - dx * t, z - s[1] - dz * t) - s[4]; if (d < best) best = d;
      }
    }
    return best;
  };
  const underDeck = (x, z) => vg.size > 0 && gap(x, z, vg) < 0;   // inside the footprint of a viaduct deck (and 8 m round it): the fences there stay as mapped
  const bld = (x, z) => { // metres to the nearest building outline (up to 32)
    let best = 32;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = bg.get((Math.floor(x / C) + i) * 100003 + Math.floor(z / C) + j); if (!a) continue;
      for (const q of a) { const d = hh(x - q[0], z - q[1]); if (d < best) best = d; }
    }
    return best;
  };
  const out = []; let changed = false;
  const flat = pts => { const f = []; for (const q of pts) f.push(Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10); return f; };
  for (const r of list) {
    if (sliceOver()) yield;
    if (r.k === 'w' && !r.fence && r.p.length >= 4) { const o = mapped(r); if (o) { out.push(...o); changed = true; } else out.push(r); continue; }
    if (r.k !== 'f' || r.p.length < 4) { out.push(r); continue; }
    if (xg.size && r.s !== 2 && gap(r.p[0], r.p[1], xg) < 12 && gap(r.p[r.p.length - 2], r.p[r.p.length - 1], xg) < 12) { out.push({ ...r, s: 2 }); changed = true; continue; }
    const pts = resample(r.p, STEP), road = pts.map(q => gap(q[0], q[1]) < NEAR && !tramNear(q[0], q[1]) && !underDeck(q[0], q[1]));
    if (!road.some(Boolean)) { out.push(r); continue; }
    changed = true;
    const cls = []; for (let k = 0; k + 1 < pts.length; k++) cls.push(road[k] || road[k + 1]);   // a piece of fence is a street fence if either end is within reach
    for (let i = 0; i < cls.length;) {   // runs of pieces beside the road, and runs away from it
      let j = i; while (j + 1 < cls.length && cls[j + 1] === cls[i]) j++;
      const run = pts.slice(i, j + 2), beside = cls[i]; i = j + 1;
      if (!beside || run.length < 4) { out.push({ k: 'f', s: r.s, h: r.h, p: flat(run) }); continue; }
      // stretches of one property: 22 to 60 m, each its own kind of wall
      let a = 0;
      while (a < run.length - 1) {
        let len = 0, b = a; const want = 22 + 38 * hash(run[a][0] * 0.37, run[a][1] * 0.61);
        while (b + 1 < run.length && len < want) { len += hh(run[b + 1][0] - run[b][0], run[b + 1][1] - run[b][1]); b++; }
        if (run.length - 1 - b < 3) b = run.length - 1;   // no stump of a stretch at the end
        out.push(...stretch(run.slice(a, b + 1), len, r));
        a = b;
      }
    }
  }
  return changed ? out : list;

  // a mapped wall (kind w) beside a road: runs of it beside a fast road (a rail, or nothing where a rail stands), runs beside a street (finished by what stands round it, stretch by stretch), and the rest as mapped.
  // Returns the new pieces, or null when none of it is within reach of a road.
  function mapped(r) {
    const pts = resample(r.p, STEP), n = pts.length - 1, cls = [];   // 0 as mapped, 1 beside a fast road, 2 beside a street
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[k + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (underDeck(mx, mz)) cls.push(0);
      else if (xg.size && Math.min(gap(a[0], a[1], xg), gap(b[0], b[1], xg), gap(mx, mz, xg)) < FAST) cls.push(1);
      else if (rg.size && Math.min(gap(a[0], a[1]), gap(b[0], b[1]), gap(mx, mz)) < NEAR && !tramNear(mx, mz)) cls.push(2);
      else cls.push(0);
    }
    if (!cls.some(Boolean)) return null;
    const res = [];
    for (let i = 0; i < n;) {
      let j = i; while (j + 1 < n && cls[j + 1] === cls[i]) j++;
      const run = pts.slice(i, j + 2), c = cls[i]; i = j + 1;
      if (c === 0 || run.length < 2) { res.push({ ...r, p: flat(run) }); continue; }
      if (c === 1) { res.push(...railRun(run)); continue; }
      let a = 0;   // a street: stretches of one property, 22 to 60 m
      while (a < run.length - 1) {
        let len = 0, b = a; const want = 22 + 38 * hash(run[a][0] * 0.37, run[a][1] * 0.61);
        while (b + 1 < run.length && len < want) { len += hh(run[b + 1][0] - run[b][0], run[b + 1][1] - run[b][1]); b++; }
        if (run.length - 1 - b < 3) b = run.length - 1;
        res.push(...wallStretch(run.slice(a, b + 1), len, r));
        a = b;
      }
    }
    return res;
  }
  // beside a fast road: a piece of 3 m with a rail of the rule near it is dropped (the rail is there already), any other becomes a single W-beam
  function railRun(run) {
    const res = []; let cur = null;
    for (let k = 0; k + 1 < run.length; k++) {
      const a = run[k], b = run[k + 1], has = railNear((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, RAIL_NEAR);
      if (has) { cur = null; continue; }
      if (!cur) { cur = [a]; res.push({ k: 'g', h: 0.8, s: 3, p: [] , pts: cur }); }
      cur.push(b);
    }
    for (const q of res) { q.p = flat(q.pts); delete q.pts; }
    return res.filter(q => q.p.length >= 6);
  }
  // open water within 70 m on either side of the stretch, on low ground (the ground height is 0 or below at sea: asked of the tile's own grid, so a neighbour that has not streamed in may hide it, which leaves the wall as a street wall)
  function seaside(pts) {
    const m = pts[pts.length >> 1], e = pts[pts.length - 1], dx = e[0] - pts[0][0], dz = e[1] - pts[0][1], l = hh(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    if (groundY(m[0], m[1]) > 9) return false;
    for (const d of [25, 45, 70]) if (groundY(m[0] + nx * d, m[1] + nz * d) < 0.3 || groundY(m[0] - nx * d, m[1] - nz * d) < 0.3) return true;
    return false;
  }
  function wallStretch(pts, len, r) {
    const m = pts[pts.length >> 1], x = m[0], z = m[1], u = hash(pts[0][0], pts[0][1]), v = hash(pts[0][1] * 1.3, pts[0][0] * 0.7), w = hash(x * 0.19, z * 0.83), p = flat(pts);
    const bd = Math.min(bld(x, z), bld(pts[0][0], pts[0][1]), bld(pts[pts.length - 1][0], pts[pts.length - 1][1])), open = bd > 14;
    const gy = groundY(x, z), old = histW(x, z) > 0.5;
    let green = false;
    if (veg.length) { const e = pts[pts.length - 1], dx = e[0] - pts[0][0], dz = e[1] - pts[0][1], l = hh(dx, dz) || 1, nx = -dz / l * 5, nz = dx / l * 5; green = veg.some(a => inPoly(a, x + nx, z + nz) || inPoly(a, x - nx, z - nz)); }
    const o = { p, ...(r.k === 'f' ? { fence: 1 } : { bk: 'w' }) }, H = (a, b) => Math.round((a + (b - a) * w) * 10) / 10;
    const piece = (k, h, extra) => ({ ...o, k, h, ...extra });
    if (!old && seaside(pts)) {   // a parapet over the water
      if (u < 0.45) return [piece('n', H(0.8, 1.1), { rail: { s: 0, h: H(0.95, 1.2) } })];
      if (u < 0.75) return [piece('s', H(0.7, 1.0))];
      return [{ k: 'f', s: 0, h: H(1.0, 1.2), p }];
    }
    const hill = gy > 90, rural = !old && (hill || open || green) && histW(x, z) < 0.5;
    if (rural) {   // hill villages and the countryside: stone first
      if (u < 0.4) return [piece('s', H(1.0, hill ? 1.9 : 1.5))];
      if (u < 0.55) return [piece('d', H(0.9, 1.4))];
      if (u < 0.72) return [piece('n', H(1.3, 1.9))];
      if (u < 0.82) return [piece('q', H(1.6, 2.0))];
      return [piece('n', H(0.5, 0.8), { rail: { s: 2, h: H(0.9, 1.1) } })];   // mesh over a low wall
    }
    if (old) return [{ ...r, p }];   // the old town keeps its mapped walls
    // a town: lime wash with and without the fallen patch, worn plaster, rubble, block, a low wall with a railing
    if (u < 0.3) return [piece('n', H(1.5, 2.1))];
    if (u < 0.45) return [piece('w', H(1.5, 2.1))];
    if (u < 0.55) return [piece(len >= 12 && v < 0.6 ? 'x' : 'n', H(1.5, 2.0))];
    if (u < 0.7) return [piece('q', H(1.6, 2.1))];
    if (u < 0.85) return [piece('s', H(1.1, 1.9))];
    return [piece('n', H(0.6, 1.1), { rail: { s: 0, h: H(0.9, 1.2) } })];
  }

  function stretch(pts, len, r) {
    const m = pts[pts.length >> 1], x = m[0], z = m[1], u = hash(pts[0][0], pts[0][1]), v = hash(pts[0][1] * 1.3, pts[0][0] * 0.7), w = hash(x * 0.19, z * 0.83);
    const old = histW(x, z) > 0.5, open = Math.min(bld(x, z), bld(pts[0][0], pts[0][1]), bld(pts[pts.length - 1][0], pts[pts.length - 1][1])) > 14;   // open: nothing built within 14 m of it
    let green = false;   // a park, a field, a pitch or scrub on either side: railings and chain-link are what stands there
    if (veg.length) { const e = pts[pts.length - 1], dx = e[0] - pts[0][0], dz = e[1] - pts[0][1], l = hh(dx, dz) || 1, nx = -dz / l * 5, nz = dx / l * 5; green = veg.some(a => inPoly(a, x + nx, z + nz) || inPoly(a, x - nx, z - nz)); }
    const p = flat(pts), keep = { k: 'f', s: r.s, h: r.h, p };
    let kind;
    if (old) kind = u < 0.6 ? 'keep' : u < 0.82 ? 'plaster' : u < 0.94 ? 'low' : 'stone';   // the old town's mapped fences are mostly real railings (gardens, Via della Liberta)
    else if (green) kind = u < 0.85 ? 'keep' : u < 0.93 ? 'low' : u < 0.97 ? 'stone' : 'plaster';
    else if (open) kind = u < 0.55 ? 'keep' : u < 0.73 ? 'low' : u < 0.85 ? 'block' : u < 0.93 ? 'stone' : u < 0.97 && len <= 30 ? 'hoarding' : 'plaster';   // a hoarding is rare and short: a lot being built on
    else kind = u < 0.25 ? 'keep' : u < 0.58 ? 'plaster' : u < 0.80 ? 'low' : u < 0.92 ? 'stone' : 'block';
    if (kind === 'keep') return [keep];
    if (!old && (green || open || groundY(x, z) > 90 || seaside(pts))) return wallStretch(pts, len, r);   // a parapet by the sea, stone and lime wash in the countryside and the hill villages (the same finishes as the mapped walls); the town's mix below
    const o = { fence: 1, p };
    if (kind === 'plaster') return [{ ...o, k: len >= 12 && v < 0.45 && histW(x, z) > 0.2 ? 'x' : !old && v > 0.5 ? 'n' : 'w', h: Math.round((old ? 1.7 + 0.9 * w : 1.5 + 0.6 * w) * 10) / 10 }];   // beyond the old town no torn posters (they were on every camp-site and village wall), lime wash with and without a fallen patch, a little lower
    if (kind === 'low') return [{ ...o, k: 'w', h: Math.round((0.6 + 0.5 * w) * 10) / 10, rail: { s: r.s === 2 ? 2 : 0, h: Math.round((0.9 + 0.3 * v) * 10) / 10 } }];
    if (kind === 'stone') return [{ ...o, k: 's', h: Math.round((1.3 + 1.1 * w) * 10) / 10 }];
    if (kind === 'block') return [{ ...o, k: 'q', h: Math.round((1.9 + 0.9 * w) * 10) / 10 }];
    return [{ ...o, k: 'p', h: Math.round((2.0 + 0.6 * w) * 10) / 10 }];
  }
}
