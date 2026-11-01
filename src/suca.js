// SUCA and 800A: the spray-painted tags every Palermitano knows, as a collectible. Owned by the core.
// Tags go on walls that face a drivable street, across the whole city: each world tile that reaches full detail (world.onTile) picks its
// own from its building footprints and roads with a fixed seed (the same walls for everyone), denser in popular areas (src/districts.js
// zones: centro, Borgo Vecchio, ZEN), and drops them when it unloads. 800A uses the same eight spray styles as SUCA. Driving within 7 m of
// one collects it: it pops, greys out with a check mark, and a toast says "SUCA 7/340". Collected ids persist in localStorage.
// One atlas texture, one mesh for every live tag (rebuilt when a tile comes or goes). progress() is { found, total }: total counts the
// tags of every tile the player has seen so far (kept in localStorage), so it grows as the city streams in.
import * as THREE from 'three';
import { groundY, pairs, signedArea, inPoly, rng } from './core.js';
import { zoneAt } from './districts.js';
import { QUALITY } from './mobile.js';

const KEY = 'palermoDrive.suca', R_COLLECT = 7, OFF = 0.04, POP = 0.55, CAP = 1024, T = 500, BUDGET = QUALITY.mobile ? 0.6 : 1.2, WORDS = ['SUCA', '800A'];
// Never on the big landmarks (x, z, r): Quattro Canti, Pretoria, Aquile, Cattedrale, Teatro Massimo, Normanni, Porta Nuova, Martorana, Santa Caterina.
// The city landmark models (landmarks-city.js) and the manifest landmarks are added when they have loaded.
const KEEPOUT = [[17, 0, 45], [82, 69, 55], [-456, 151, 75], [-478, 124, 60], [-358, -491, 80], [-700, 502, 95], [-752, 396, 50], [141, 108, 40], [118, 27, 45], [157, 12, 45]];
// popularity of a district: 3 centro, Borgo Vecchio, ZEN; 2 busy quarters; 0 empty country; everything else 1. Per tile: tags wanted and the first minimum spacing (m)
const TIER = { old: 3, alberg: 3, kalsa: 3, corso: 3, roma: 3, politeama: 3, centro: 3, borgoV: 3, zen: 3, rural: 0, favorita: 0,
  noce: 2, zisa: 2, stazione: 2, cep: 2, viaLib: 2, sacco: 2, avenue: 2, resut: 2, cruillas: 2, calat: 2, oreto: 2, brancaccio: 2, corsoMille: 2 };
const QUOTA = [1, 4, 9, 18], SPACE = [260, 170, 110, 70];

// ---------- the atlas: 4 x 2 spray-paint variants of each word, then the same 16 greyed out with a check ----------
const CW = 512, CH = 256, COLS = 4, ROWS = 8;
const VARIANTS = [
  { fill: '#16161a', edge: '#d9d3c0' },
  { fill: '#16161a', edge: '#e9e4d2', ul: true },
  { fill: '#c9202d', edge: '#16161a' },
  { fill: '#c9202d', edge: null, crown: true },
  { fill: '#2459c6', edge: '#f2f0e6', ul: true },
  { fill: '#2459c6', edge: null },
  { fill: '#e8559a', edge: '#16161a', crown: true },
  { fill: '#e8559a', edge: null, ul: true },
];
const bz = (a, b, c, d, n = 10) => {
  const o = [];
  for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]); }
  return o;
};
// letters in a 1 x 1.4 box, y down; each glyph is a list of strokes (polylines)
const GLYPH = {
  S: () => [[[.92, .22], ...bz([.92, .22], [.75, -.08], [.1, -.05], [.1, .33]), ...bz([.1, .33], [.1, .65], [.9, .75], [.9, 1.08]), ...bz([.9, 1.08], [.9, 1.48], [.2, 1.45], [.05, 1.1])]],
  U: () => [[[.1, 0], [.12, .95], ...bz([.12, .95], [.15, 1.5], [.85, 1.5], [.88, .95]), [.9, 0]]],
  C: () => [[[.92, .25], ...bz([.92, .25], [.7, -.1], [.08, -.05], [.08, .7]), ...bz([.08, .7], [.08, 1.45], [.75, 1.5], [.95, 1.1])]],
  A: () => [[[.05, 1.4], [.5, 0], [.95, 1.4]], [[.22, .95], [.78, .92]]],
  0: () => [Array.from({ length: 28 }, (_, i) => { const a = -2.1 + i / 27 * 6.65; return [.5 + .41 * Math.cos(a), .7 + .69 * Math.sin(a)]; })],
  8: () => [Array.from({ length: 44 }, (_, i) => { const t = .12 + i / 43 * 6.2; return [.5 + Math.sin(2 * t) * (.35 + .07 * (1 - Math.cos(t)) / 2), .7 - .69 * Math.cos(t)]; })],
};
const polyPt = (ps, r) => { const s = ps[(r() * ps.length) | 0], i = Math.min(s.length - 2, (r() * (s.length - 1)) | 0), t = r(); return [s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t]; };

function paintTag(g, V, r, word) {
  const S = 84, gap = 24, total = 4 * S + 3 * gap, x0 = (CW - total) / 2, slant = (r() - .5) * .1, W = 21;
  const ps = [];
  [...word].forEach((ch, i) => {
    const rot = (r() - .5) * .22 + slant, sc = .9 + r() * .2, cx = x0 + i * (S + gap) + S / 2, cy = 112 + (r() - .5) * 14, cs = Math.cos(rot), sn = Math.sin(rot);
    for (const st of GLYPH[ch]()) ps.push(st.map(([x, y]) => {
      const lx = (x - .5 + (r() - .5) * .05) * S * sc, ly = (y - .7 + (r() - .5) * .05) * S * sc;
      return [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs];
    }));
  });
  const stroke = (w, col, blur, a = 1, list = ps) => {
    g.save(); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = a;
    g.shadowColor = col; g.shadowBlur = blur;
    for (const s of list) { g.beginPath(); s.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.stroke(); }
    g.restore();
  };
  if (V.edge) stroke(W + 13, V.edge, 3);
  stroke(W, V.fill, 9, .85);
  stroke(W - 6, V.fill, 2);
  // overspray: a mist of dots around the strokes
  g.save(); g.fillStyle = V.fill;
  for (let i = 0; i < 260; i++) {
    const [x, y] = polyPt(ps, r), a = r() * 6.283, d = Math.abs(r() + r() + r() - 1.5) * 26, rad = .6 + r() * 1.1;
    g.globalAlpha = .12 + r() * .35; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad, 0, 6.283); g.fill();
  }
  g.restore();
  // drips from the lower half of the letters
  const low = ps.flat().filter(p => p[1] > 118);
  for (let i = 0, n = 3 + ((r() * 3) | 0); i < n && low.length; i++) {
    const [x, y] = low[(r() * low.length) | 0], len = 14 + r() * 46, w = 3.2 + r() * 2.6;
    g.save(); g.strokeStyle = g.fillStyle = V.fill; g.lineCap = 'round'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 2, y + len); g.stroke();
    g.beginPath(); g.arc(x, y + len, w * .8, 0, 6.283); g.fill(); g.restore();
  }
  if (V.ul) { // a quick underline swoosh
    const y = 196 + r() * 8, sw = [bz([x0 - 14, y + 6], [x0 + 120, y - 10], [x0 + 260, y + 10], [x0 + total + 18, y - 4], 24)];
    if (V.edge) stroke(14, V.edge, 3, 1, sw);
    stroke(8.5, V.fill, 4, 1, sw);
  }
  if (V.crown) { // a crown over the first letters
    const b = 52 + r() * 4, cx = x0 + S * 1.1 + gap / 2, sw = [[[cx - 28, b], [cx - 33, b - 30], [cx - 15, b - 14], [cx, b - 36], [cx + 15, b - 14], [cx + 33, b - 30], [cx + 28, b], [cx - 28, b]]];
    if (V.edge) stroke(13, V.edge, 3, 1, sw);
    stroke(7.5, V.fill, 3, 1, sw);
  }
}

function makeAtlas() {
  const k = QUALITY.mobile ? .5 : .75, cv = document.createElement('canvas'), cw = CW * k, ch = CH * k;
  cv.width = cw * COLS; cv.height = ch * ROWS;
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (let w = 0; w < 2; w++) for (let v = 0; v < VARIANTS.length; v++) {
    const cx = (v % COLS) * cw, cy = (Math.floor(v / COLS) + 2 * w) * ch;
    g.save(); g.beginPath(); g.rect(cx, cy, cw, ch); g.clip(); g.translate(cx, cy); g.scale(k, k);
    paintTag(g, VARIANTS[v], rng(7001 + v * 131 + w * 977), WORDS[w]);
    g.restore();
    // collected: grey and faint, with a green check in the corner (the bottom half of the atlas)
    const im = g.getImageData(cx, cy, cw, ch), d = im.data, dy = cy + 4 * ch;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) * .75 + 50; d[i] = d[i + 1] = d[i + 2] = l; d[i + 3] *= .5; }
    g.putImageData(im, cx, dy);
    g.save(); g.beginPath(); g.rect(cx, dy, cw, ch); g.clip(); g.translate(cx + 452 * k, dy + 52 * k); g.scale(k, k);
    g.lineCap = g.lineJoin = 'round';
    for (const [lw, c] of [[13, 'rgba(16,16,20,.7)'], [7, '#6fd68a']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-17, 1); g.lineTo(-5, 14); g.lineTo(18, -15); g.stroke(); }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = true; tex.anisotropy = QUALITY.mobile ? 2 : 8;
  return tex;
}


// ---------- placement: one world tile at a time, as a generator the update loop runs in small slices ----------
const gridAdd = (m, cell, x0, z0, x1, z1, item) => {
  for (let i = Math.floor(Math.min(x0, x1) / cell); i <= Math.floor(Math.max(x0, x1) / cell); i++)
    for (let j = Math.floor(Math.min(z0, z1) / cell); j <= Math.floor(Math.max(z0, z1) / cell); j++) { const k = i * 100003 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(item); }
};
// stable hashes: a wall always gets the same dice whatever else is in the tile
const hstr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const dice = (h, k) => { h = Math.imul(h ^ Math.imul(k + 1, 0x9E3779B1), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

function* pickTile(t, { skip, drivable, keepAll }) {
  const d = t.data, B = d.buildings, N = B.length, x0 = t.i * T, z0 = t.j * T;
  const keep = keepAll.filter(k => k[0] > x0 - k[2] && k[0] < x0 + T + k[2] && k[1] > z0 - k[2] && k[1] < z0 + T + k[2]);
  const roads = new Map(), blds = new Map(), bp = new Array(N), bbox = new Array(N);
  for (const r of d.roads) {
    if (!drivable.has(r.k)) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) gridAdd(roads, 30, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w, r.k, r.n || '']);
  }
  for (let bi = 0; bi < N; bi++) {
    const pts = bp[bi] = pairs(B[bi].p);
    let a = 1e9, c = 1e9, e = -1e9, f = -1e9;
    for (const [x, z] of pts) { if (x < a) a = x; if (x > e) e = x; if (z < c) c = z; if (z > f) f = z; }
    gridAdd(blds, 32, a, c, e, f, bi); bbox[bi] = [a, c, e, f];
    if ((bi & 63) === 63) yield;
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
    if ((bi & 15) === 15) yield;
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
      out.push({ id: b.id + ':' + i, x, z, nx, nz, hw, w: wd, v: (dice(hh, 5) * 8) | 0, bh: b.h, score });
    }
  }
  out.sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1));
  const want = QUOTA[tile], chosen = [];
  for (let sp = SPACE[tile]; chosen.length < want && sp > 24; sp *= .85) {
    for (const c of out) {
      if (chosen.length >= want) break;
      if (!chosen.includes(c) && chosen.every(o => (o.x - c.x) * (o.x - c.x) + (o.z - c.z) * (o.z - c.z) >= sp * sp)) chosen.push(c);
    }
    yield;
  }
  return chosen.sort((p, q) => (p.id < q.id ? -1 : 1));
}

// ---------- the collectible ----------
export function createSuca({ scene, drivable, mapMarkers, skip, world = null }) {
  const L = [], done = new Set(), seen = {}, cache = new Map(), queue = [], active = new Set(); // L: live tags of the tiles at full detail
  let seenTotal = 0, ready = false, keepAll = KEEPOUT.slice(), skipAll = new Set(skip), job = null, dirty = false, manifestDone = false;
  try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a)) for (const id of a) done.add(id); } catch (e) { /* private mode */ }
  try { const o = JSON.parse(localStorage.getItem(KEY + '.seen')) || {}; for (const k in o) if (o[k] > 0) { seen[k] = o[k]; seenTotal += o[k]; } } catch (e) { /* private mode */ }
  // city landmark models and manifest landmarks: more places to keep clear (tiles wait for them before placing)
  import('./landmarks-city.js').then(m => { for (const l of m.CITY_LANDMARKS || []) { keepAll.push([l.x, l.z, (l.radius || 40) + 15]); for (const id of l.skipIds || []) skipAll.add(id); } }).catch(() => {}).then(() => { ready = true; });

  const pos = new Float32Array(CAP * 12), nor = new Float32Array(CAP * 12), uv = new Float32Array(CAP * 8), col = new Float32Array(CAP * 12).fill(1), idx = new Uint16Array(CAP * 6);
  for (let i = 0; i < CAP; i++) idx.set([0, 1, 2, 0, 2, 3].map(j => j + i * 4), i * 6);
  function quad(i, s = 1) {
    const t = L[i], w = t.hw * s, h = w / 2, cx = t.x + t.nx * OFF, cz = t.z + t.nz * OFF, tx = t.nz, tz = -t.nx;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], k) => pos.set([cx + tx * a * w, t.y + b * h, cz + tz * a * w], i * 12 + k * 3));
  }
  function cell(i) {
    const t = L[i], c = t.v % COLS, r = Math.floor(t.v / COLS) + 2 * t.w + (done.has(t.id) && t.pop === undefined ? 4 : 0);
    uv.set([c / COLS, 1 - (r + 1) / ROWS, (c + 1) / COLS, 1 - (r + 1) / ROWS, (c + 1) / COLS, 1 - r / ROWS, c / COLS, 1 - r / ROWS], i * 8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5); // vertices move: never cull the one mesh
  const mat = new THREE.MeshLambertMaterial({ map: makeAtlas(), vertexColors: true, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'suca'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  scene.add(mesh);

  // every live tag back into the buffers (a tile came or went)
  function rebuild() {
    dirty = false;
    if (L.length > CAP) L.length = CAP;
    for (let i = 0; i < L.length; i++) {
      const t = L[i]; quad(i); cell(i);
      for (let k = 0; k < 4; k++) { nor.set([t.nx, 0, t.nz], i * 12 + k * 3); col.set([1, 1, 1], i * 12 + k * 3); }
    }
    geo.setDrawRange(0, L.length * 6);
    for (const a of ['position', 'normal', 'uv', 'color']) geo.attributes[a].needsUpdate = true;
  }
  // a tile's picks become live tags: height from the ground along the wall, a hand above the pavement
  function addTile(t, picks) {
    for (const p of picks) {
      const tx = p.nz, tz = -p.nx, g = Math.max(groundY(p.x, p.z), groundY(p.x + tx * p.hw, p.z + tz * p.hw), groundY(p.x - tx * p.hw, p.z - tz * p.hw), groundY(p.x + p.nx * 1.5, p.z + p.nz * 1.5));
      L.push({ id: p.id, x: p.x, z: p.z, nx: p.nx, nz: p.nz, hw: p.hw, w: p.w, v: p.v, word: WORDS[p.w], y: g + .4 + p.hw / 2, tile: t });
    }
    dirty = true;
  }
  const saveSeen = () => { try { localStorage.setItem(KEY + '.seen', JSON.stringify(seen)); } catch (e) { /* private mode */ } };
  function finish(t, picks) {
    cache.set(t.id, picks);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    if (seen[t.id] !== picks.length) { seenTotal += picks.length - (seen[t.id] || 0); if (picks.length) seen[t.id] = picks.length; else delete seen[t.id]; saveSeen(); }
    if (active.has(t)) addTile(t, picks);
  }
  function tileEvent(kind, t) {
    if (kind === 'full') {
      active.add(t);
      const c = cache.get(t.id);
      if (c) addTile(t, c); else queue.push(t);
    } else {
      active.delete(t);
      const q = queue.indexOf(t); if (q >= 0) queue.splice(q, 1);
      if (job && job.t === t) job = null;
      let w = 0; for (let i = 0; i < L.length; i++) if (L[i].tile !== t) L[w++] = L[i];
      if (w !== L.length) { L.length = w; dirty = true; }
    }
  }
  world?.onTile(tileEvent);

  // toast, same look as the radio's "now playing" card (top-left, below the mission panel / radio card)
  const style = document.createElement('style');
  style.textContent = `
.pd-suca-toast { position: fixed; z-index: 506; top: max(8px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); transform: translate(0, -8px);
  width: max-content; max-width: min(340px, 64vw); box-sizing: border-box; padding: 7px 12px 8px 11px; border-radius: 9px; pointer-events: none;
  background: rgba(11,7,9,.88); border: 1px solid rgba(232,85,154,.7); border-left: 4px solid #e8559a; color: #fff; opacity: 0;
  font: 600 13px/1.25 system-ui, -apple-system, sans-serif; text-shadow: none; transition: opacity .3s, transform .3s; }
.pd-suca-toast.on { opacity: 1; transform: translate(0, 0); }
.pd-suca-toast small { display: block; font: 800 9.5px/1 system-ui, -apple-system, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #e8559a; margin-bottom: 3px; }
.pd-suca-toast b { display: block; font-weight: 800; font-size: 15px; letter-spacing: .04em; }
@media (max-height: 460px) { .pd-suca-toast { font-size: 11px; padding: 5px 10px 6px 9px; max-width: min(300px, 46vw); } .pd-suca-toast b { font-size: 13px; } }
`;
  document.head.appendChild(style);
  const toast = document.createElement('div');
  toast.className = 'pd-suca-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  const progress = () => ({ found: done.size, total: Math.max(seenTotal, done.size) });
  function showToast(word) {
    const p = progress();
    toast.innerHTML = `<small>Graffiti</small><b>${word} ${p.found}/${p.total}</b>`;
    let top = 8;
    for (const el of document.querySelectorAll('#pm-hud.on, .pd-radio-toast.on')) top = Math.max(top, el.getBoundingClientRect().bottom + 8);
    toast.style.top = top > 8 ? `${Math.round(top)}px` : '';
    toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 2200);
  }

  // minimap: only the uncollected tags the map can show (~100 m), so the rim isn't a string of dots
  const markers = new Map();
  function syncMarkers(car) {
    for (const [t, m] of markers) if (done.has(t.id) || !L.includes(t) || (t.x - car.x) ** 2 + (t.z - car.z) ** 2 > 110 * 110) { const j = mapMarkers.indexOf(m); if (j >= 0) mapMarkers.splice(j, 1); markers.delete(t); }
    for (const t of L) {
      if (markers.has(t) || done.has(t.id) || (t.x - car.x) ** 2 + (t.z - car.z) ** 2 > 100 * 100) continue;
      const m = { x: t.x, z: t.z, color: '#ffe14a', size: 3.5 }; markers.set(t, m); mapMarkers.push(m);
    }
  }

  function collect(i) {
    const t = L[i];
    done.add(t.id);
    try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* private mode */ }
    t.pop = 0;
    showToast(t.word);
  }

  let slow = 0;
  function update(dt, car) {
    if (!manifestDone && world?.manifest) { manifestDone = true; for (const l of world.manifest.landmarks || []) keepAll.push([l.x, l.z, 25]); }
    if (ready && manifestDone && !job && queue.length) { // nearest waiting tile first
      let bi = 0, bd = 1e18;
      for (let i = 0; i < queue.length; i++) { const q = queue[i], d = (q.cx - car.x) ** 2 + (q.cz - car.z) ** 2; if (d < bd) { bd = d; bi = i; } }
      const t = queue.splice(bi, 1)[0];
      job = { t, gen: pickTile(t, { skip: skipAll, drivable, keepAll }) };
    }
    if (job) {
      const t0 = performance.now(), j = job;
      try {
        for (;;) {
          const r = j.gen.next();
          if (r.done) { if (job === j) { job = null; finish(j.t, r.value); } break; }
          if (job !== j || performance.now() - t0 > BUDGET) break;
        }
      } catch (e) { console.error('[suca] tile', e); if (job === j) job = null; }
    }
    if (dirty) rebuild();
    if ((slow -= dt) <= 0) { slow = .5; syncMarkers(car); }
    let pop = false;
    for (let i = 0; i < L.length; i++) {
      const t = L[i];
      if (t.pop !== undefined) {
        const a = t.pop + dt, f = Math.min(1, a / POP), k = 1 + 1.4 * (1 - f);
        quad(i, 1 + .3 * Math.sin(Math.PI * f));
        for (let v = 0; v < 4; v++) col.set([k, k, k], i * 12 + v * 3);
        if (f >= 1) { t.pop = undefined; cell(i); geo.attributes.uv.needsUpdate = true; } else t.pop = a;
        pop = true; continue;
      }
      if (done.has(t.id)) continue;
      const dx = car.x - t.x, dz = car.z - t.z;
      if (dx * dx + dz * dz < R_COLLECT * R_COLLECT && dx * t.nx + dz * t.nz > 0) collect(i);
    }
    if (pop) geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
  }

  return { update, tags: L, progress, get count() { return done.size; }, get total() { return progress().total; }, has: id => done.has(id), mesh };
}
