// Bakes the SUCA and 800A wall tags (src/suca.js) for the whole city: exactly COUNT of them (both words together), the same for everyone,
// written to src/suca-tags.js, which ships in the bundle. Run it again whenever world/tiles is rebaked (walls move, buildings come and go):
//   node tools/suca-bake.mjs            bake src/suca-tags.js and print the tags per district tier
//   node tools/suca-bake.mjs --check    only check that src/suca-tags.js still matches the tiles (exit 1 if a tag lost its wall)
// Needs tools/build/node_modules (three.js): the landmark modules are imported for their positions and the footprints they replace.
//
// The rules are the ones the game used to run per tile at load time:
//  - a candidate is one spot per footprint edge (>= 5 m long) of a building at least 3.5 m tall that is not a church, civic, monastery,
//    historic or landmark footprint, facing a drivable road 0.2 to 7.5 m off the pavement edge with nothing solid in between, and outside the
//    keepouts (KEEPOUT below, the city landmark models, the manifest landmarks, 35 m around any footprint a landmark model replaces);
//  - the candidates of a tile are scored (stable dice per wall, district tier, quiet streets, a wall at the end of a street, a piazza in front)
//    and taken greedily in score order with a minimum spacing that starts at SPACE[tier] and shrinks by 15% per pass down to 24 m.
// That greedy order is the tile's ranking. The old game took the first QUOTA[tier] of each tile (tier of the tile centre); here the COUNT tags
// are shared out between the tiles in proportion to QUOTA[tier] (largest remainder, never more than a tile's ranking holds), and each tile
// takes the first q of its ranking. With q >= the old quota a tile keeps every tag it had, so saved ids stay valid wherever possible.
// Ids are `<building id>:<edge index>` as before. A saved id that is no longer a tag moves to the nearest new tag within MOVE_R metres if
// there is one (SUCA_MOVED in the output), otherwise the game drops it.
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'src/suca-tags.js'), CHECK = process.argv.includes('--check');
const THREE_DIR = path.join(HERE, 'build/node_modules/three/');
if (!fs.existsSync(THREE_DIR)) { console.error('missing ' + THREE_DIR + ': run npm install in tools/build (or symlink its node_modules)'); process.exit(1); }
// the game modules import 'three' and 'three/addons/...' through the page's import map: map them onto tools/build/node_modules
register('data:text/javascript,' + encodeURIComponent(`
const T = ${JSON.stringify('file://' + THREE_DIR)};
export async function resolve(s, c, n) {
  if (s === 'three') return { url: T + 'build/three.module.js', shortCircuit: true };
  if (s.startsWith('three/addons/')) return { url: T + 'examples/jsm/' + s.slice(13), shortCircuit: true };
  return n(s, c);
}`));
// just enough of a browser for the modules to load (nothing is drawn)
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : stub(), apply: () => stub(), construct: () => stub() });
globalThis.window = globalThis; globalThis.document = stub(); globalThis.addEventListener ??= () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.PALERMO_DATA = { bounds: [0, 0, 0, 0], buildings: [] };
const { pairs, signedArea, inPoly } = await import('../src/core.js');
const { zoneAt, applyDistrictHeights } = await import('../src/districts.js');
const { prepareLandmarks } = await import('../src/landmarks.js');
const { CITY_LANDMARKS } = await import('../src/landmarks-city.js');

const COUNT = 800, MOVE_R = 6, T = 500, MAXPER = 160;
const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian']); // as src/main.js
// Never on the big landmarks (x, z, r): Quattro Canti, Pretoria, Aquile, Cattedrale, Teatro Massimo, Normanni, Porta Nuova, Martorana, Santa Caterina.
const KEEPOUT = [[17, 0, 45], [82, 69, 55], [-456, 151, 75], [-478, 124, 60], [-358, -491, 80], [-700, 502, 95], [-752, 396, 50], [141, 108, 40], [118, 27, 45], [157, 12, 45]];
// popularity of a district: 3 centro, Borgo Vecchio, ZEN; 2 busy quarters; 0 empty country; everything else 1. Per tile: weight of its share, first minimum spacing (m)
const TIER = { old: 3, alberg: 3, kalsa: 3, corso: 3, roma: 3, politeama: 3, centro: 3, borgoV: 3, zen: 3, rural: 0, favorita: 0,
  noce: 2, zisa: 2, stazione: 2, cep: 2, viaLib: 2, sacco: 2, avenue: 2, resut: 2, cruillas: 2, calat: 2, oreto: 2, brancaccio: 2, corsoMille: 2 };
const QUOTA = [1, 4, 9, 18], SPACE = [260, 170, 110, 70];

const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/manifest.json'), 'utf8'));
const ctx = { skip: new Set() }; prepareLandmarks(ctx);
const skip = new Set(ctx.skip), keepAll = KEEPOUT.slice();
for (const l of CITY_LANDMARKS || []) { keepAll.push([l.x, l.z, (l.radius || 40) + 15]); for (const id of l.skipIds || []) skip.add(id); }
for (const l of M.landmarks || []) keepAll.push([l.x, l.z, 25]);

const gridAdd = (m, cell, x0, z0, x1, z1, item) => {
  for (let i = Math.floor(Math.min(x0, x1) / cell); i <= Math.floor(Math.max(x0, x1) / cell); i++)
    for (let j = Math.floor(Math.min(z0, z1) / cell); j <= Math.floor(Math.max(z0, z1) / cell); j++) { const k = i * 100003 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(item); }
};
// stable hashes: a wall always gets the same dice whatever else is in the tile
const hstr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const dice = (h, k) => { h = Math.imul(h ^ Math.imul(k + 1, 0x9E3779B1), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// one tile: its ranking (the greedy order with shrinking spacing), at most MAXPER long
function rankTile(ti, tj, d) {
  const B = d.buildings, N = B.length, x0 = ti * T, z0 = tj * T;
  const keep = keepAll.filter(k => k[0] > x0 - k[2] && k[0] < x0 + T + k[2] && k[1] > z0 - k[2] && k[1] < z0 + T + k[2]);
  const roads = new Map(), blds = new Map(), bp = new Array(N), bbox = new Array(N);
  for (const r of d.roads) {
    if (!DRIVABLE.has(r.k)) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) gridAdd(roads, 30, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w, r.k, r.n || '']);
  }
  for (let bi = 0; bi < N; bi++) {
    const pts = bp[bi] = pairs(B[bi].p);
    let a = 1e9, c = 1e9, e = -1e9, f = -1e9;
    for (const [x, z] of pts) { if (x < a) a = x; if (x > e) e = x; if (z < c) c = z; if (z > f) f = z; }
    gridAdd(blds, 32, a, c, e, f, bi); bbox[bi] = [a, c, e, f];
  }
  const solid = (x, z) => {
    const a = blds.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32));
    if (a) for (const i of a) { const q = bbox[i]; if (x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3] && inPoly(bp[i], x, z)) return true; }
    return false;
  };
  const nearRoad = (x, z) => {
    let best = null, bd = 1e9;
    for (let i = Math.floor((x - 9) / 30); i <= Math.floor((x + 9) / 30); i++) for (let j = Math.floor((z - 9) / 30); j <= Math.floor((z + 9) / 30); j++) {
      const a = roads.get(i * 100003 + j); if (!a) continue;
      for (const s of a) {
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)) : 0;
        const qx = s[0] + dx * u, qz = s[1] + dz * u, dd = Math.sqrt((x - qx) * (x - qx) + (z - qz) * (z - qz));
        if (dd < bd) { bd = dd; best = { d: dd, qx, qz, w: s[4], k: s[5], n: s[6], tx: dx / Math.sqrt(l2 || 1), tz: dz / Math.sqrt(l2 || 1) }; }
      }
    }
    return best;
  };
  const plazas = (d.areas || []).filter(a => a.k === 'plaza').map(a => pairs(a.p));
  // footprints a landmark model replaced keep clear too
  for (let bi = 0; bi < N; bi++) if (skip.has(B[bi].id)) { const c = bp[bi]; keep.push([c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length, 35]); }
  const tile = TIER[zoneAt(x0 + T / 2, z0 + T / 2, '', 1e9)] ?? 1, out = [];
  for (let bi = 0; bi < N; bi++) {
    const b = B[bi];
    if (skip.has(b.id) || !(b.h >= 3.5) || b.k === 'church' || b.hi || b.t === 'church' || b.t === 'civic' || b.t === 'monastery') continue;
    const pts = bp[bi], n = pts.length, sa = signedArea(pts), h0 = hstr(b.id);
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.sqrt(dx * dx + dz * dz);
      if (L < 5) continue;
      const hh = Math.imul(h0, 31) + i | 0, big = dice(hh, 0) < .16;
      let hw = 2.5 + dice(hh, 1) * 1.1 + (big ? 1.2 : 0);
      hw = Math.min(hw, (L - 1.4) / 2, b.h - 1.6);
      if (hw < 1.7) continue;
      const margin = hw + .7, u = margin + dice(hh, 2) * (L - 2 * margin), tx0 = dx / L, tz0 = dz / L;
      let nx = sa > 0 ? tz0 : -tz0, nz = sa > 0 ? -tx0 : tx0;
      const x = a[0] + tx0 * u, z = a[1] + tz0 * u;
      if (inPoly(pts, x + nx * .4, z + nz * .4)) { nx = -nx; nz = -nz; }
      let near = false;
      for (const k of keep) if ((x - k[0]) * (x - k[0]) + (z - k[1]) * (z - k[1]) < k[2] * k[2]) { near = true; break; }
      if (near) continue;
      const px = x + nx * .4, pz = z + nz * .4;
      if (solid(px, pz) || solid(px + tx0 * hw, pz + tz0 * hw) || solid(px - tx0 * hw, pz - tz0 * hw)) continue;
      const rd = nearRoad(px, pz);
      if (!rd || rd.d > 7.5 || rd.d - rd.w / 2 < .2) continue;
      const vx = (rd.qx - x) / rd.d, vz = (rd.qz - z) / rd.d;
      if (vx * nx + vz * nz < .5) continue;
      let clear = true;
      for (let s = .8; s < rd.d - .3 && clear; s += 1) if (solid(x + vx * s, z + vz * s)) clear = false;
      if (!clear) continue;
      const tier = TIER[zoneAt(x, z, rd.n, rd.d - rd.w / 2)] ?? 1;
      let score = dice(hh, 3) * 1.5 + tier * .6 + hw * .25;
      if (rd.k === 'pedestrian' || rd.k === 'living_street') score += 1.4;
      else if (rd.k === 'residential' || rd.k === 'service') score += .9;
      if (rd.w < 7) score += .5;
      const ah = Math.abs(rd.tx * nx + rd.tz * nz); // a wall at the end of a street is seen head on by everyone driving up it
      if (ah > .8) score += 1.8; else if (ah > .55) score += .6;
      if (plazas.some(p => inPoly(p, x + nx * 4, z + nz * 4))) score += .9;
      const wd = dice(hh, 4) < .55 ? 0 : 1;
      out.push({ id: b.id + ':' + i, x, z, nx, nz, hw, w: wd, v: (dice(hh, 5) * 8) | 0, tier, score });
    }
  }
  out.sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1));
  const chosen = [], taken = new Set();
  for (let sp = SPACE[tile]; chosen.length < MAXPER && sp > 24; sp *= .85) {
    for (const c of out) {
      if (chosen.length >= MAXPER) break;
      if (!taken.has(c) && chosen.every(o => (o.x - c.x) * (o.x - c.x) + (o.z - c.z) * (o.z - c.z) >= sp * sp)) { chosen.push(c); taken.add(c); }
    }
  }
  return { tier: tile, zone: zoneAt(x0 + T / 2, z0 + T / 2, '', 1e9), rank: chosen };
}

// every tile with buildings, in a fixed order
const ids = Object.keys(M.tiles).filter(k => fs.existsSync(path.join(ROOT, 'world/tiles', k + '.json'))).sort();
const tiles = [], t0 = Date.now();
for (const id of ids) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/tiles', id + '.json'), 'utf8'));
  if (!d.buildings?.length) continue;
  applyDistrictHeights(d); // world.js does this on load, before any module sees the tile (b.h decides which walls are tall enough)
  const [i, j] = id.split('_').map(Number);
  tiles.push({ id, d, ...rankTile(i, j, d) });
}
console.log(`${tiles.length} tiles with buildings ranked in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (CHECK) {
  // every baked tag still on a wall of its building, the edge it was baked on, and on a tile that has it
  const { SUCA_TAGS, SUCA_TOTAL } = await import('../src/suca-tags.js');
  const byTile = new Map(tiles.map(t => [t.id, t.d])); let n = 0, bad = 0;
  for (const [tid, list] of Object.entries(SUCA_TAGS)) for (const r of list) {
    n++;
    const d = byTile.get(tid), k = r[0].lastIndexOf(':'), b = d && d.buildings.find(q => q.id === r[0].slice(0, k));
    if (!b || !onEdge(pairs(b.p), +r[0].slice(k + 1), r[1], r[2])) { bad++; console.log('lost its wall:', tid, r[0]); }
  }
  console.log(`${n} tags (SUCA_TOTAL ${SUCA_TOTAL}), ${bad} off their walls`);
  process.exit(n === SUCA_TOTAL && n === COUNT && !bad ? 0 : 1);
}
function onEdge(pts, i, x, z) {
  if (!(i >= 0 && i < pts.length)) return false;
  const a = pts[i], c = pts[(i + 1) % pts.length], dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz;
  const u = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0;
  return u >= 0 && u <= 1 && Math.hypot(a[0] + dx * u - x, a[1] + dz * u - z) < .05;
}

// share COUNT out by QUOTA[tier], largest remainder, capped by what each tile's ranking holds
const cap = t => t.rank.length, wgt = t => QUOTA[t.tier];
const sumAt = s => tiles.reduce((a, t) => a + Math.min(cap(t), Math.floor(s * wgt(t))), 0);
const most = tiles.reduce((a, t) => a + cap(t), 0);
if (most < COUNT) { console.error(`only ${most} candidate walls in the city, fewer than ${COUNT}`); process.exit(1); }
let lo = 0, hi = 1;
while (sumAt(hi) < COUNT) hi *= 2;
for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (sumAt(m) <= COUNT) lo = m; else hi = m; }
for (const t of tiles) t.q = Math.min(cap(t), Math.floor(lo * wgt(t)));
let left = COUNT - tiles.reduce((a, t) => a + t.q, 0);
const order = tiles.filter(t => t.q < cap(t)).sort((a, b) => (lo * wgt(b) - Math.floor(lo * wgt(b))) - (lo * wgt(a) - Math.floor(lo * wgt(a))) || wgt(b) - wgt(a) || (a.id < b.id ? -1 : 1));
for (const t of order) { if (left <= 0) break; t.q++; left--; }
if (left) { console.error('could not place ' + left + ' tags'); process.exit(1); }

// what the old game had (first QUOTA[tier] of each tile), to keep saved ids
const picked = tiles.flatMap(t => t.rank.slice(0, t.q).map(p => ({ ...p, tile: t.id })));
const newIds = new Set(picked.map(p => p.id));
const old = tiles.flatMap(t => t.rank.slice(0, QUOTA[t.tier]));
const moved = {}; let kept = 0, dropped = 0;
for (const o of old) {
  if (newIds.has(o.id)) { kept++; continue; }
  let best = null, bd = MOVE_R * MOVE_R;
  for (const p of picked) { const dd = (p.x - o.x) ** 2 + (p.z - o.z) ** 2; if (dd < bd) { bd = dd; best = p; } }
  if (best) moved[o.id] = best.id; else dropped++;
}

// src/suca-tags.js
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const byTile = {};
for (const p of picked) (byTile[p.tile] ||= []).push([p.id, r2(p.x), r2(p.z), r1(Math.atan2(p.nz, p.nx) * 180 / Math.PI), r2(p.hw), p.w, p.v]);
for (const k in byTile) byTile[k].sort((a, b) => (a[0] < b[0] ? -1 : 1));
const src = `// Generated by tools/suca-bake.mjs from world/tiles: do not edit by hand, run \`node tools/suca-bake.mjs\` again after a tile rebake.
// The SUCA and 800A wall tags of the whole city (src/suca.js). SUCA_TAGS: tile id -> [[id, x, z, wall normal as an angle
// (degrees, nx = cos, nz = sin), half width, word (0 SUCA, 1 800A), variant 0..7], ...], exactly SUCA_TOTAL of them. SUCA_MOVED: saved ids of tags that are gone -> the new tag within ${MOVE_R} m that takes their place.
export const SUCA_TOTAL = ${picked.length};
export const SUCA_TAGS = {
${Object.keys(byTile).sort().map(k => JSON.stringify(k) + ':' + JSON.stringify(byTile[k])).join(',\n')}
};
export const SUCA_MOVED = ${JSON.stringify(moved)};
`;
fs.writeFileSync(OUT, src);

// report: tags per district tier and per zone, words, saved ids
const per = [0, 0, 0, 0], tilesPer = [0, 0, 0, 0], zones = {};
for (const t of tiles) { tilesPer[t.tier]++; per[t.tier] += t.q; if (t.q) zones[t.zone] = (zones[t.zone] || 0) + t.q; }
const words = [0, 0]; for (const p of picked) words[p.w]++;
console.log(`wrote ${path.relative(ROOT, OUT)}: ${picked.length} tags, ${(src.length / 1024).toFixed(1)} KB; SUCA ${words[0]}, 800A ${words[1]}; scale ${lo.toFixed(3)} of the old quotas`);
for (let k = 3; k >= 0; k--) console.log(`  tier ${k}: ${per[k]} tags over ${tilesPer[k]} tiles (old quota ${QUOTA[k]} a tile)`);
console.log('  by zone: ' + Object.entries(zones).sort((a, b) => b[1] - a[1]).map(([z, n]) => z + ' ' + n).join(', '));
console.log(`  old full-city total ${old.length}: ${kept} kept, ${Object.keys(moved).length} moved to a new tag within ${MOVE_R} m, ${dropped} dropped`);
