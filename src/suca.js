// SUCA and 800A: the spray-painted tags every Palermitano knows, as a collectible. Owned by the core.
// Tags go on walls that face a drivable street, across the whole city: each world tile that reaches full detail (world.onTile) picks its
// own from its building footprints and roads with a fixed seed (the same walls for everyone), denser in popular areas (src/districts.js
// zones: centro, Borgo Vecchio, ZEN), and drops them when it unloads. 800A uses the same eight spray styles as SUCA. Driving within 7 m of
// one collects it: the paint burns away (a noise dissolve with a glowing pink and amber edge, driven per tag by the `dis` vertex attribute)
// and leaves the greyed ghost with a check mark underneath, flecks of paint burst off the wall, a chime plays and the toast bounces
// ("SUCA 7/340"). Collected ids persist in localStorage.
// One atlas texture, one mesh for every live tag (rebuilt when a tile comes or goes). progress() is { found, total }: total counts the
// tags of every tile the player has seen so far (kept in localStorage), so it grows as the city streams in.
import * as THREE from 'three';
import { zone } from './hud.js';
import { groundY, pairs, signedArea, inPoly, rng, freeCanvas } from './core.js';
import { zoneAt } from './districts.js';

const KEY = 'palermoDrive.suca', R_COLLECT = 7, OFF = 0.04, CAP = 1024, T = 500, BUDGET = 0.9, WORDS = ['SUCA', '800A'];
// Never on the big landmarks (x, z, r): Quattro Canti, Pretoria, Aquile, Cattedrale, Teatro Massimo, Normanni, Porta Nuova, Martorana, Santa Caterina.
// The city landmark models (landmarks-city.js) and the manifest landmarks are added when they have loaded.
const KEEPOUT = [[17, 0, 45], [82, 69, 55], [-456, 151, 75], [-478, 124, 60], [-358, -491, 80], [-700, 502, 95], [-752, 396, 50], [141, 108, 40], [118, 27, 45], [157, 12, 45]];
// popularity of a district: 3 centro, Borgo Vecchio, ZEN; 2 busy quarters; 0 empty country; everything else 1. Per tile: tags wanted and the first minimum spacing (m)
const TIER = { old: 3, alberg: 3, kalsa: 3, corso: 3, roma: 3, politeama: 3, centro: 3, borgoV: 3, zen: 3, rural: 0, favorita: 0,
  noce: 2, zisa: 2, stazione: 2, cep: 2, viaLib: 2, sacco: 2, avenue: 2, resut: 2, cruillas: 2, calat: 2, oreto: 2, brancaccio: 2, corsoMille: 2 };
const QUOTA = [1, 4, 9, 18], SPACE = [260, 170, 110, 70];
// the collect effect, seconds since the tag was collected: a punch (0 to PUNCH), the dissolve (D0 to D0 + DD), then the ghost settles (until DUR)
const DUR = 1.4, D0 = .12, DD = 1.15, PUNCH = .22, EDGE = .22, NFLECK = 48, NDRIP = 6, NP = 360;

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
  const k = .625, cv = document.createElement('canvas'), cw = CW * k, ch = CH * k;
  cv.width = cw * COLS; cv.height = ch * ROWS;
  const g = cv.getContext('2d', { willReadFrequently: true }), paint = () => {
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
  } };
  paint();
  const tex = freeCanvas(new THREE.CanvasTexture(cv), paint);
  tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = true; tex.anisotropy = 4;
  return tex;
}

// ---------- the collect shader: the tag material with a per-quad dissolve ----------
// vDis is the time since the collect over DUR (0 = untouched). A noise field m (0 to 1, leaning left to right) is eaten by a front: where it has
// passed the paint is gone and the greyed cell of the atlas (four rows below) shows instead; just behind the front the paint glows pink, amber
// and white-hot (added after the lighting, so it also burns at night). The first moments light up the whole tag.
const f3 = n => n.toFixed(3);
const DISSOLVE = `
vec3 pdGlow = vec3(0.);
if (vDis > 0.) {
  float dp = clamp((vDis * ${f3(DUR)} - ${f3(D0)}) / ${f3(DD)}, 0., 1.);
  vec2 cell = vMapUv * vec2(${COLS}., ${ROWS}.), cu = fract(cell), q = cu * vec2(9., 4.5) + floor(cell) * 13.7;
  float n = .55 * pdNoise(q) + .3 * pdNoise(q * 2.1 + 7.) + .15 * pdNoise(q * 4.3 + 3.);
  float m = clamp((n * .7 + cu.x * .3 - .1) / .78, 0., 1.);
  float x = (dp * ${f3(1 + EDGE)} - m) / ${f3(EDGE)};
  float eat = smoothstep(.9, 1., x), heat = smoothstep(0., .45, x) * (1. - smoothstep(.88, 1., x));
  vec3 hot = mix(mix(vec3(.81, .09, .32), vec3(1., .42, .05), smoothstep(.1, .6, x)), vec3(1., .72, .3), smoothstep(.85, .98, x));
  float lit = 1. - smoothstep(0., .12, vDis);
  vec4 ghost = texture2D(map, vMapUv + vec2(0., -${f3(4 / ROWS)}));
  pdGlow = (hot * heat * 1.3 + vec3(1., .55, .15) * lit * .9) * diffuseColor.a * (1. - eat);
  diffuseColor = mix(diffuseColor, ghost, eat);
}
#include <alphamap_fragment>`;
const NOISE = `
varying float vDis;
float pdHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float pdNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(pdHash(i), pdHash(i + vec2(1., 0.)), f.x), mix(pdHash(i + vec2(0., 1.)), pdHash(i + vec2(1., 1.)), f.x), f.y);
}
#include <common>`;
function dissolve(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', 'attribute float dis;\nvarying float vDis;\n#include <common>').replace('#include <begin_vertex>', 'vDis = dis;\n#include <begin_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', NOISE).replace('#include <alphamap_fragment>', DISSOLVE).replace('#include <opaque_fragment>', 'outgoingLight += pdGlow;\n#include <opaque_fragment>');
  };
}

// ---------- the paint flecks: one Points mesh, a ring of NP particles flown entirely in the vertex shader ----------
// Each particle carries where it starts (position), its launch velocity (aV), when it starts and how long it lives, its size in metres and
// whether it is a drip (aT) and its colour (aC). The shader works out where it is from uTime, so a collect only writes a few array slots.
const FLECK_VS = `
attribute vec3 aV; attribute vec4 aT; attribute vec3 aC;
uniform float uTime, uPx;
varying vec3 vC; varying float vA, vK;
void main() {
  float age = uTime - aT.x;
  if (age < 0. || age > aT.y) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  float drip = step(.5, aT.w), k = mix(2.6, .0001, drip), g = mix(9., 1.6, drip), u = age / aT.y;
  vec3 p = position + aV * ((1. - exp(-k * age)) / k);
  p.y -= .5 * g * age * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aT.z * (1. - .45 * u) * projectionMatrix[1][1] * uPx / max(-mv.z, .5), 2., 46.);
  vC = aC; vK = drip; vA = 1. - smoothstep(.6, 1., u);
}`;
const FLECK_FS = `
varying vec3 vC; varying float vA, vK;
void main() {
  vec2 e = (gl_PointCoord - .5) * 2.; e.x *= 1. + 1.4 * vK;
  float a = (1. - smoothstep(.62, 1., length(e))) * vA;
  if (a < .02) discard;
  gl_FragColor = vec4(vC, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

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
export function createSuca({ scene, drivable, mapMarkers, skip, world = null, getVolume = () => .8 }) {
  const L = [], done = new Set(), seen = {}, cache = new Map(), queue = [], active = new Set(); // L: live tags of the tiles at full detail
  let seenTotal = 0, ready = false, keepAll = KEEPOUT.slice(), skipAll = new Set(skip), job = null, dirty = false, manifestDone = false;
  try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a)) for (const id of a) done.add(id); } catch (e) { /* private mode */ }
  try { const o = JSON.parse(localStorage.getItem(KEY + '.seen')) || {}; for (const k in o) if (o[k] > 0) { seen[k] = o[k]; seenTotal += o[k]; } } catch (e) { /* private mode */ }
  // city landmark models and manifest landmarks: more places to keep clear (tiles wait for them before placing)
  import('./landmarks-city.js').then(m => { for (const l of m.CITY_LANDMARKS || []) { keepAll.push([l.x, l.z, (l.radius || 40) + 15]); for (const id of l.skipIds || []) skipAll.add(id); } }).catch(() => {}).then(() => { ready = true; });

  const pos = new Float32Array(CAP * 12), nor = new Float32Array(CAP * 12), uv = new Float32Array(CAP * 8), col = new Float32Array(CAP * 12).fill(1), idx = new Uint16Array(CAP * 6);
  const dis = new Float32Array(CAP * 4); // per vertex: seconds since collected over DUR, 0 for a tag at rest (read by the dissolve shader)
  for (let i = 0; i < CAP; i++) idx.set([0, 1, 2, 0, 2, 3].map(j => j + i * 4), i * 6);
  const QS = [-1, -1, 1, -1, 1, 1, -1, 1];
  function quad(i, s = 1) {
    const t = L[i], w = t.hw * s, h = w / 2, cx = t.x + t.nx * OFF, cz = t.z + t.nz * OFF, tx = t.nz, tz = -t.nx;
    for (let k = 0; k < 4; k++) { const a = QS[k * 2], b = QS[k * 2 + 1], o = i * 12 + k * 3; pos[o] = cx + tx * a * w; pos[o + 1] = t.y + b * h; pos[o + 2] = cz + tz * a * w; }
  }
  // the collect animation of tag i at `a` seconds after the collect (a < 0: at rest): the punch scales the quad, the dissolve runs in the shader
  function fx(i, a) {
    quad(i, a < 0 ? 1 : 1 + .09 * Math.sin(Math.PI * Math.min(1, a / PUNCH)));
    const d = a < 0 ? 0 : Math.max(a / DUR, 1e-4);
    dis[i * 4] = dis[i * 4 + 1] = dis[i * 4 + 2] = dis[i * 4 + 3] = d;
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
  geo.setAttribute('dis', new THREE.BufferAttribute(dis, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5); // vertices move: never cull the one mesh
  const mat = new THREE.MeshLambertMaterial({ map: makeAtlas(), vertexColors: true, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  dissolve(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'suca'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  scene.add(mesh);

  // every live tag back into the buffers (a tile came or went)
  function rebuild() {
    dirty = false;
    if (L.length > CAP) L.length = CAP;
    for (let i = 0; i < L.length; i++) {
      const t = L[i]; fx(i, t.pop === undefined ? -1 : t.pop); cell(i);
      for (let k = 0; k < 4; k++) { nor.set([t.nx, 0, t.nz], i * 12 + k * 3); col.set([1, 1, 1], i * 12 + k * 3); }
    }
    geo.setDrawRange(0, L.length * 6);
    for (const a of ['position', 'normal', 'uv', 'color', 'dis']) geo.attributes[a].needsUpdate = true;
  }

  // the flecks: spawn writes a few slots of the ring, the vertex shader does the flying (see FLECK_VS)
  const fP = new Float32Array(NP * 3), fV = new Float32Array(NP * 3), fT = new Float32Array(NP * 4).fill(-1e6), fC = new Float32Array(NP * 3);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(fP, 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aV', new THREE.BufferAttribute(fV, 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aT', new THREE.BufferAttribute(fT, 4).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aC', new THREE.BufferAttribute(fC, 3).setUsage(THREE.DynamicDrawUsage));
  pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5);
  const fu = { uTime: { value: 0 }, uPx: { value: 400 } };
  const flecks = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: fu, vertexShader: FLECK_VS, fragmentShader: FLECK_FS, transparent: true, depthWrite: false, fog: false }));
  flecks.name = 'suca-flecks'; flecks.renderOrder = 3; flecks.frustumCulled = false; flecks.visible = false;
  const px = new THREE.Vector2();
  flecks.onBeforeRender = r => { r.getDrawingBufferSize(px); fu.uPx.value = px.y * .5; }; // point size in pixels from the world size
  scene.add(flecks);
  const PAL = VARIANTS.map(v => [new THREE.Color(v.fill), new THREE.Color(v.edge || v.fill)]);
  const SPARK = ['#ffb347', '#e8559a', '#fff1c2'].map(c => new THREE.Color(c));
  let clock = 0, head = 0, fxEnd = 0;
  function emit(t) {
    const tx = t.nz, tz = -t.nx, pal = PAL[t.v];
    for (let k = 0; k < NFLECK + NDRIP; k++, head = (head + 1) % NP) {
      const drip = k >= NFLECK, ux = .12 + .76 * Math.random(), s = (ux - .5) * 2 * t.hw, o = head * 3, o4 = head * 4;
      // the flecks leave where the dissolve front passes that part of the tag (about when the paint there is eaten)
      const m = (.25 + .3 * ux) / .78, delay = Math.max(0, D0 + (m + EDGE * .5) / (1 + EDGE) * DD + (Math.random() - .5) * .18 + (drip ? .12 : 0));
      const r = Math.random(), c = r < .46 ? pal[0] : r < .64 ? pal[1] : SPARK[(Math.random() * 3) | 0];
      fP[o] = t.x + t.nx * .12 + tx * s; fP[o + 1] = t.y + (drip ? -.2 * t.hw : (Math.random() - .4) * t.hw * .5); fP[o + 2] = t.z + t.nz * .12 + tz * s;
      const out = drip ? .04 : 1.1 + Math.random() * 3.6, side = drip ? 0 : (Math.random() - .5) * 3.4;
      fV[o] = t.nx * out + tx * side; fV[o + 1] = drip ? -.05 : -.3 + Math.random() * 3; fV[o + 2] = t.nz * out + tz * side;
      fT[o4] = clock + delay; fT[o4 + 1] = drip ? 1 + Math.random() * .5 : .55 + Math.random() * .55;
      fT[o4 + 2] = drip ? .11 : r < .64 ? .09 + Math.random() * .14 : .07 + Math.random() * .08; fT[o4 + 3] = drip ? 1 : 0;
      fC[o] = c.r; fC[o + 1] = c.g; fC[o + 2] = c.b;
    }
    for (const a of ['position', 'aV', 'aT', 'aC']) pg.attributes[a].needsUpdate = true;
    fxEnd = clock + 3; flecks.visible = true;
  }

  // a short reward sound: a spray hiss and two rising notes (own AudioContext, made on the first collect, so after a key press)
  let au = null, noise = null;
  function chime() {
    try {
      if (!au) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        au = new AC(); noise = au.createBuffer(1, au.sampleRate * .4, au.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const v = getVolume(); if (!(v > 0)) return;
      if (au.state === 'suspended') { au.resume().then(chime, () => {}); return; }   // a new context starts suspended: the first tag was always silent
      const t = au.currentTime, out = au.createGain(); out.gain.value = .2 * v; out.connect(au.destination);
      const hiss = au.createBufferSource(), band = au.createBiquadFilter(), env = au.createGain();
      hiss.buffer = noise; band.type = 'bandpass'; band.Q.value = .8; band.frequency.setValueAtTime(2600, t); band.frequency.exponentialRampToValueAtTime(7500, t + .38);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(.55, t + .03); env.gain.exponentialRampToValueAtTime(.001, t + .4);
      hiss.connect(band); band.connect(env); env.connect(out); hiss.start(t);
      [[784, 0], [1175, .09]].forEach(([f, dt]) => {
        const o = au.createOscillator(), e = au.createGain(); o.type = 'triangle'; o.frequency.value = f;
        e.gain.setValueAtTime(0, t + dt); e.gain.linearRampToValueAtTime(.7, t + dt + .012); e.gain.exponentialRampToValueAtTime(.001, t + dt + .45);
        o.connect(e); e.connect(out); o.start(t + dt); o.stop(t + dt + .5);
      });
    } catch (e) { /* no audio */ }
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

  // toast, the same dark capsule as the mission line; it has its own line under the mission card (src/hud.js), a new tag replaces the old one
  const style = document.createElement('style');
  style.textContent = `
.pd-suca-toast { display: none; opacity: 0; width: max-content; max-width: var(--wide); box-sizing: border-box; padding: 4px 16px 5px; border-radius: 16px; pointer-events: none; text-align: center;
  background: var(--capsule, rgba(13,7,10,.8)); box-shadow: 0 2px 10px rgba(0,0,0,.3); color: #fff;
  font: 600 13px/1.25 system-ui, -apple-system, sans-serif; text-shadow: none; transition: opacity .3s, display .3s allow-discrete; }
.pd-suca-toast.on { display: block; opacity: 1; @starting-style { opacity: 0; } }
.pd-suca-toast.bump { animation: pd-suca-bump .55s cubic-bezier(.2, 1.5, .4, 1); }
.pd-suca-toast.bump b { animation: pd-suca-num .55s ease-out; transform-origin: 0 50%; }
@keyframes pd-suca-bump { 0% { transform: scale(.9); } 28% { transform: scale(1.16); box-shadow: 0 0 22px rgba(232,85,154,.85); } 100% { transform: scale(1); box-shadow: 0 0 0 rgba(232,85,154,0); } }
@keyframes pd-suca-num { 0% { transform: scale(1); } 25% { transform: scale(1.4); color: #ffb347; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .pd-suca-toast.bump, .pd-suca-toast.bump b { animation: none; } }
.pd-suca-toast small { display: block; font: 800 9.5px/1 system-ui, -apple-system, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #e8559a; margin-bottom: 3px; }
.pd-suca-toast b { display: block; font-weight: 800; font-size: 15px; letter-spacing: .04em; }
@media (max-height: 460px) { .pd-suca-toast { font-size: 11px; padding: 4px 10px 5px 9px; } .pd-suca-toast b { font-size: 13px; } }
`;
  document.head.appendChild(style);
  const toast = document.createElement('div');
  toast.className = 'pd-suca-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  zone('pick').appendChild(toast);
  let toastTimer = 0;
  const progress = () => ({ found: done.size, total: Math.max(seenTotal, done.size) });
  function showToast(word) {
    const p = progress();
    toast.innerHTML = `<small>Graffiti</small><b>${word} ${p.found}/${p.total}</b>`;
    toast.classList.remove('bump'); void toast.offsetWidth; // restart the bounce when a second tag follows closely
    toast.classList.add('on', 'bump');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on', 'bump'), 2600);
  }

  // minimap: only the uncollected tags the map can show (~100 m), so the rim isn't a string of dots
  const markers = new Map();
  function syncMarkers(car) {
    for (const [t, m] of markers) if (done.has(t.id) || !L.includes(t) || (t.x - car.x) ** 2 + (t.z - car.z) ** 2 > 110 * 110) { const j = mapMarkers.indexOf(m); if (j >= 0) mapMarkers.splice(j, 1); markers.delete(t); }
    for (const t of L) {
      if (markers.has(t) || done.has(t.id) || (t.x - car.x) ** 2 + (t.z - car.z) ** 2 > 100 * 100) continue;
      const m = { x: t.x, z: t.z, color: '#ff4fd8', size: 3.5, shape: 'cross' }; markers.set(t, m); mapMarkers.push(m);
    }
  }

  function collect(i) {
    const t = L[i];
    done.add(t.id);
    try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* private mode */ }
    t.pop = 0;
    showToast(t.word); emit(t); chime();
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
    clock += dt; fu.uTime.value = clock;
    if (flecks.visible && clock > fxEnd) flecks.visible = false;
    let pop = false;
    for (let i = 0; i < L.length; i++) {
      const t = L[i];
      if (t.pop !== undefined) {
        const a = t.pop + dt;
        if (a >= DUR) { t.pop = undefined; fx(i, -1); cell(i); geo.attributes.uv.needsUpdate = true; } else { t.pop = a; fx(i, a); }
        pop = true; continue;
      }
      if (done.has(t.id)) continue;
      const dx = car.x - t.x, dz = car.z - t.z;
      if (dx * dx + dz * dz < R_COLLECT * R_COLLECT && dx * t.nx + dz * t.nz > 0) collect(i);
    }
    if (pop) geo.attributes.position.needsUpdate = geo.attributes.dis.needsUpdate = true;
  }

  return { update, tags: L, progress, get count() { return done.size; }, get total() { return progress().total; }, has: id => done.has(id), mesh };
}
