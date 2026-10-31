// SUCA: the spray-painted tag every Palermitano knows, as a collectible. Owned by the core.
// ~40 decals are stuck flat on ground-floor walls of the baked centro that face a drivable street (picked once from the building
// footprints with a fixed seed, so everyone gets the same walls). Driving within 6 m of one collects it: it pops, greys out with a
// check mark, and a toast says "SUCA 7/40". Collected ids persist in localStorage. One atlas texture, one merged mesh.
// With ?world=1 only the centro tags exist, and each one hides while its tile has no buildings built.
import * as THREE from 'three';
import { groundY, pairs, signedArea, inPoly, rng } from './core.js';
import { QUALITY } from './mobile.js';

const KEY = 'palermoDrive.suca', WANT = 40, R_COLLECT = 6, RADIUS = 900, OFF = 0.04, POP = 0.55;
// Never on the big landmarks (x, z, r): Quattro Canti, Pretoria, Aquile, Cattedrale, Teatro Massimo, Normanni, Porta Nuova, Martorana, Santa Caterina.
const KEEPOUT = [[17, 0, 45], [82, 69, 55], [-456, 151, 75], [-478, 124, 60], [-358, -491, 80], [-700, 502, 95], [-752, 396, 50], [141, 108, 40], [118, 27, 45], [157, 12, 45]];

// ---------- the atlas: 4 x 2 spray-paint variants, then the same 8 greyed out with a check ----------
const CW = 512, CH = 256, COLS = 4, ROWS = 4;
const VARIANTS = [
  { fill: '#16161a', edge: null },
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
};
const polyPt = (ps, r) => { const s = ps[(r() * ps.length) | 0], i = Math.min(s.length - 2, (r() * (s.length - 1)) | 0), t = r(); return [s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t]; };

function paintTag(g, V, r) {
  const S = 84, gap = 24, total = 4 * S + 3 * gap, x0 = (CW - total) / 2, slant = (r() - .5) * .1, W = 21;
  const ps = [];
  [...'SUCA'].forEach((ch, i) => {
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
  const k = QUALITY.mobile ? .5 : 1, cv = document.createElement('canvas');
  cv.width = CW * COLS * k; cv.height = CH * ROWS * k;
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (let v = 0; v < VARIANTS.length; v++) for (const done of [0, 1]) {
    const cx = (v % COLS) * CW * k, cy = (Math.floor(v / COLS) + done * 2) * CH * k;
    g.save(); g.beginPath(); g.rect(cx, cy, CW * k, CH * k); g.clip(); g.translate(cx, cy); g.scale(k, k);
    paintTag(g, VARIANTS[v], rng(7001 + v * 131));
    g.restore();
    if (!done) continue;
    // collected: grey and faint, with a green check in the corner
    const im = g.getImageData(cx, cy, CW * k, CH * k), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) * .75 + 50; d[i] = d[i + 1] = d[i + 2] = l; d[i + 3] *= .5; }
    g.putImageData(im, cx, cy);
    g.save(); g.beginPath(); g.rect(cx, cy, CW * k, CH * k); g.clip(); g.translate(cx + 452 * k, cy + 52 * k); g.scale(k, k);
    g.lineCap = g.lineJoin = 'round';
    for (const [w, c] of [[13, 'rgba(16,16,20,.7)'], [7, '#6fd68a']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(-17, 1); g.lineTo(-5, 14); g.lineTo(18, -15); g.stroke(); }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = true; tex.anisotropy = QUALITY.mobile ? 2 : 8;
  return tex;
}

// ---------- placement: walls of the centro that face a drivable street ----------
function pickWalls({ D, skip, drivable }) {
  const rand = rng(31337), bp = D.buildings.map(b => pairs(b.p));
  const gridAdd = (m, cell, x0, z0, x1, z1, item) => {
    for (let i = Math.floor(Math.min(x0, x1) / cell); i <= Math.floor(Math.max(x0, x1) / cell); i++)
      for (let j = Math.floor(Math.min(z0, z1) / cell); j <= Math.floor(Math.max(z0, z1) / cell); j++) { const k = i * 100003 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(item); }
  };
  const roads = new Map(), blds = new Map();
  for (const r of D.roads) {
    if (!drivable.has(r.k)) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) gridAdd(roads, 30, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w, r.k]);
  }
  const bbox = D.buildings.map((b, i) => {
    let a = 1e9, c = 1e9, e = -1e9, f = -1e9;
    for (const [x, z] of bp[i]) { if (x < a) a = x; if (x > e) e = x; if (z < c) c = z; if (z > f) f = z; }
    gridAdd(blds, 32, a, c, e, f, i);
    return [a, c, e, f];
  });
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
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)) : 0;
        const qx = s[0] + dx * t, qz = s[1] + dz * t, d = Math.hypot(x - qx, z - qz);
        if (d < bd) { bd = d; best = { d, qx, qz, w: s[4], k: s[5] }; }
      }
    }
    return best;
  };
  const plazas = D.areas.filter(a => a.k === 'plaza').map(a => pairs(a.p));
  // keep clear of every footprint a landmark model replaced
  const keep = KEEPOUT.slice();
  D.buildings.forEach((b, i) => { if (skip.has(b.id)) { const c = bp[i]; keep.push([c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length, 35]); } });
  const out = [];
  D.buildings.forEach((b, bi) => {
    if (skip.has(b.id) || !(b.h >= 3.5)) return;
    const pts = bp[bi], n = pts.length, sa = signedArea(pts), q = bbox[bi];
    if (Math.hypot((q[0] + q[2]) / 2, (q[1] + q[3]) / 2) > RADIUS) return;
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 5) continue;
      const sc = .85 + rand() * .3, hw = 1.65 * sc, margin = hw + .7;
      if (L < 2 * margin + .5) continue;
      const u = margin + rand() * (L - 2 * margin), tx0 = dx / L, tz0 = dz / L;
      let nx = sa > 0 ? tz0 : -tz0, nz = sa > 0 ? -tx0 : tx0;
      const x = a[0] + tx0 * u, z = a[1] + tz0 * u;
      if (inPoly(pts, x + nx * .4, z + nz * .4)) { nx = -nx; nz = -nz; }
      if (keep.some(k => Math.hypot(x - k[0], z - k[1]) < k[2])) continue;
      const px = x + nx * .4, pz = z + nz * .4;
      if (solid(px, pz) || solid(px + tx0 * hw, pz + tz0 * hw) || solid(px - tx0 * hw, pz - tz0 * hw)) continue;
      const rd = nearRoad(px, pz);
      if (!rd || rd.d > 7.5 || rd.d - rd.w / 2 < .2) continue;
      const vx = (rd.qx - x) / rd.d, vz = (rd.qz - z) / rd.d;
      if (vx * nx + vz * nz < .5) continue;
      let clear = true;
      for (let s = .8; s < rd.d - .3 && clear; s += 1) if (solid(x + vx * s, z + vz * s)) clear = false;
      if (!clear) continue;
      let score = rand() * 1.5;
      if (rd.k === 'pedestrian' || rd.k === 'living_street') score += 1.4;
      else if (rd.k === 'residential' || rd.k === 'service') score += .9;
      if (rd.w < 7) score += .5;
      const fx = x + nx * 4, fz = z + nz * 4;
      if (plazas.some(p => inPoly(p, fx, fz))) score += .9;
      out.push({ id: b.id + ':' + i, x, z, nx, nz, hw, score });
    }
  });
  out.sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1));
  const chosen = [];
  for (let sp = 170; chosen.length < WANT && sp > 25; sp *= .85) {
    for (const c of out) {
      if (chosen.length >= WANT) break;
      if (!chosen.includes(c) && chosen.every(o => Math.hypot(o.x - c.x, o.z - c.z) >= sp)) chosen.push(c);
    }
  }
  return chosen.sort((p, q) => (p.id < q.id ? -1 : 1));
}

// ---------- the collectible ----------
export function createSuca({ scene, D, skip, drivable, mapMarkers, world = null }) {
  const tags = pickWalls({ D, skip, drivable }), N = tags.length;
  const rand = rng(4242);
  for (const t of tags) {
    t.y = Math.max(groundY(t.x, t.z), groundY(t.x + t.nx * 1.5, t.z + t.nz * 1.5)) + 1.55 + rand() * .4;
    t.v = (rand() * 8) | 0;
  }
  let done = new Set();
  try { done = new Set((JSON.parse(localStorage.getItem(KEY)) || []).filter(id => tags.some(t => t.id === id))); } catch (e) { /* private mode */ }

  const pos = new Float32Array(N * 12), nor = new Float32Array(N * 12), uv = new Float32Array(N * 8), col = new Float32Array(N * 12).fill(1), idx = new Uint16Array(N * 6);
  tags.forEach((t, i) => {
    for (let k = 0; k < 4; k++) nor.set([t.nx, 0, t.nz], i * 12 + k * 3);
    idx.set([0, 1, 2, 0, 2, 3].map(j => j + i * 4), i * 6);
  });
  const shown = new Uint8Array(N).fill(world ? 0 : 1);
  function quad(i, s = 1) {
    const t = tags[i], w = shown[i] ? t.hw * s : 0, h = w / 2, cx = t.x + t.nx * OFF, cz = t.z + t.nz * OFF, tx = t.nz, tz = -t.nx;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], k) => pos.set([cx + tx * a * w, t.y + b * h, cz + tz * a * w], i * 12 + k * 3));
  }
  function cell(i) {
    const t = tags[i], c = t.v % COLS, r = Math.floor(t.v / COLS) + (done.has(t.id) && !pops.has(i) ? 2 : 0);
    uv.set([c / COLS, 1 - (r + 1) / ROWS, (c + 1) / COLS, 1 - (r + 1) / ROWS, (c + 1) / COLS, 1 - r / ROWS, c / COLS, 1 - r / ROWS], i * 8);
  }
  const pops = new Map();
  for (let i = 0; i < N; i++) { quad(i); cell(i); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5); // vertices move: never cull the one mesh
  const mat = new THREE.MeshLambertMaterial({ map: makeAtlas(), vertexColors: true, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'suca'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  scene.add(mesh);

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
.pd-suca-toast span { display: block; font-weight: 500; font-size: 11.5px; opacity: .78; margin-top: 1px; }
@media (max-height: 460px) { .pd-suca-toast { font-size: 11px; padding: 5px 10px 6px 9px; max-width: min(300px, 46vw); } .pd-suca-toast b { font-size: 13px; } .pd-suca-toast span { font-size: 10px; } }
`;
  document.head.appendChild(style);
  const toast = document.createElement('div');
  toast.className = 'pd-suca-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function showToast() {
    const all = done.size === N;
    toast.innerHTML = `<small>Graffiti</small><b>SUCA ${done.size}/${N}</b>${all ? '<span>Tutte trovate · All found</span>' : ''}`;
    let top = 8;
    for (const el of document.querySelectorAll('#pm-hud.on, .pd-radio-toast.on')) top = Math.max(top, el.getBoundingClientRect().bottom + 8);
    toast.style.top = top > 8 ? `${Math.round(top)}px` : '';
    toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), all ? 4500 : 2200);
  }

  // minimap: only the uncollected tags the map can show (~120 m), so the rim isn't a string of dots
  const markers = new Map();
  function syncMarkers(car) {
    for (let i = 0; i < N; i++) {
      const t = tags[i], want = !done.has(t.id) && shown[i] && Math.hypot(t.x - car.x, t.z - car.z) < 120;
      if (want && !markers.has(i)) { const m = { x: t.x, z: t.z, color: '#ffe14a', size: 3.5 }; markers.set(i, m); mapMarkers.push(m); }
      else if (!want && markers.has(i)) { const j = mapMarkers.indexOf(markers.get(i)); if (j >= 0) mapMarkers.splice(j, 1); markers.delete(i); }
    }
  }

  function collect(i) {
    done.add(tags[i].id);
    try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* private mode */ }
    pops.set(i, 0);
    showToast();
  }

  let slow = 0;
  function update(dt, car) {
    if ((slow -= dt) <= 0) {
      slow = .5;
      if (world) for (let i = 0; i < N; i++) {
        const T = world.manifest?.T || 500, t = world.tiles.get((Math.floor(tags[i].x / T) + 200) * 1000 + Math.floor(tags[i].z / T) + 200), on = t && !t.dead && t.lod >= 1 ? 1 : 0;
        if (on !== shown[i]) { shown[i] = on; quad(i); geo.attributes.position.needsUpdate = true; }
      }
      syncMarkers(car);
    }
    for (let i = 0; i < N; i++) {
      const t = tags[i];
      if (!shown[i] || done.has(t.id)) continue;
      const dx = car.x - t.x, dz = car.z - t.z;
      if (dx * dx + dz * dz < R_COLLECT * R_COLLECT && dx * t.nx + dz * t.nz > 0) collect(i);
    }
    if (pops.size) {
      for (const [i, age] of pops) {
        const a = age + dt, f = Math.min(1, a / POP), k = 1 + 1.4 * (1 - f);
        quad(i, 1 + .3 * Math.sin(Math.PI * f));
        for (let v = 0; v < 4; v++) col.set([k, k, k], i * 12 + v * 3);
        if (f >= 1) { pops.delete(i); cell(i); geo.attributes.uv.needsUpdate = true; } else pops.set(i, a);
      }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    }
  }

  return { update, tags, get count() { return done.size; }, get total() { return N; }, has: id => done.has(id), mesh };
}
