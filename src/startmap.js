// Start picker map: an illustrated 2D map of the whole city, drawn from the game's own baked data. Owned by the game-shell work.
//   - sea, coastline and islands, and the terrain grid (Monte Pellegrino and the hills shaded) come from world/manifest.json (world.manifest);
//   - roads in three tiers, parks / woods / farmland / sand, and a built-up haze come from assets/ui/startmap.json (tools/startmap.py bakes
//     it from the world tiles, the tiles themselves are far too big to fetch for an overview); the centro's building footprints are D.buildings.
// Pan (drag), pinch zoom, mouse wheel, +/- buttons. Start points are pins (spots); tap one for a popup with "Parti da qui". A second layer shows
// the events from missions.events() with their own icons and a show/hide toggle. Pins that would overlap on screen (the Quattro Canti have a dozen places and events within 400 m) are merged
// into one numbered badge; tap it for a list of the pins under it (tap one for its start popup, or "Zoom in here" for one modest zoom step), they come apart as the map zooms. Redraws only when something changed.
//
//   const map = createStartMap({ host, world, D, spots, quarters, getLang, getCar, getEvents, onStart });
//   map.show() / map.hide()      the screen opened / closed (loads the data on first use)
//   map.key(code, shift)         keyboard: arrows pan, +/- zoom, Tab cycles the pins, E toggles events; returns true when it used the key
//   map.startSelected()          what the popup button does: calls onStart(x, z, info)
//   map.applyLang()              the language changed
// spots: [{ name, x, z, q }], quarters: [{ name, x, z }], getEvents(): [{ id, kind, name, x, z, night? }], getCar(): { x, z, th } | null.

import { esc } from './esc.js';
const ASSET = new URL('../assets/ui/startmap.json', import.meta.url).href;
const CELL = 1000;                     // metres per road/area cell
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const OPEN_SPAN = 6000;               // metres across the shorter side of the map when it opens
const K_MAX = 1.4;                     // px per metre at full zoom (a street is wide)
const EV_KEY = 'palermoDrive.mapEvents';

const L = {
  here: ['Amunì, parti ri ccà', 'Start here'], there: ['Portami lì', 'Take me there'], events: ['Eventi', 'Events'], you: ['Sei qui', 'You are here'],
  fare: ['Cliente', 'Fare'], urgent: ['Corsa urgente', 'Urgent fare'], food: ['Cibo', 'Food'], pub: ['Pub', 'Pub'], race: ['Gara', 'Race'], rave: ['Rave', 'Rave'], leaf: ['Fuogghi', 'Leaves'], horns: ['Missione', 'Mission'], dump: ['Discarica', 'Landfill'], penna: ['Pinni', 'Pens'], night: ['di notte', 'at night'],
  zin: ['Ingrandisci', 'Zoom in'], zout: ['Riduci', 'Zoom out'], zinh: ['Ingrandisci qui', 'Zoom in here'], places: ['luoghi', 'places'], place1: ['luogo', 'place'],
  hint: ['Frecce: muovi · + e −: zoom · Tab: luoghi · E: eventi · L: lista', 'Arrows: pan · + and −: zoom · Tab: places · E: events · L: list'],
};
const KIND = { fare: '#ffc83d', urgent: '#ff4a3a', food: '#ff8a3d', pub: '#ffb02e', race: '#fdfdfd', rave: '#b16bff', leaf: '#7ad65a', horns: '#ffb02e', dump: '#8a6a3a', penna: '#3a8dde' };

// palette: warm paper land, pale sea, rosanero only for the pins and the major roads
const C = {
  sea: '#9fcde0', shelf: '#b9dcea', land: '#f2ead7', green: '#c4daa2', forest: '#aecb8f', farm: '#e0e5b8', water: '#9fcde0', sand: '#f4e3b4',
  haze: [204, 168, 124], bld: '#d9bf97', label: '#6a5843', halo: 'rgba(250,244,230,.92)',
  roadA: ['#e8559a', '#ffe2ef'], roadB: ['#cdb98f', '#fffdf6'], roadC: ['#ddd0b2', '#ffffff'],
};

export function createStartMap({ host, world, D, spots, quarters, getLang, getCar, getEvents, getPlayers, onStart }) {
  host.innerHTML = `<canvas class="pd-mp-cv" aria-hidden="true"></canvas>
    <button class="pd-mp-ev" type="button" data-nav data-map="events" aria-pressed="true"><i></i><span data-t="events"></span></button>
    <div class="pd-mp-tools"><button class="pd-mp-btn" type="button" data-nav data-map="zin" data-t="zin" data-a="1">+</button><button class="pd-mp-btn" type="button" data-nav data-map="zout" data-t="zout" data-a="1">&minus;</button></div>
    <div class="pd-mp-pop" hidden><div class="pd-mp-pt"></div><div class="pd-mp-ps"></div>
      <button class="pd-btn sm drive" type="button" data-nav data-do="mapgo"><span class="pd-in"><span class="pd-l1" data-t="here"></span></span></button></div>
    <div class="pd-mp-cl" hidden><div class="pd-mp-clt"></div><div class="pd-mp-cll" role="list"></div>
      <button class="pd-btn sm" type="button" data-nav data-map="clzoom"><span class="pd-in"><span class="pd-l1" data-t="zinh"></span></span></button></div>
    <div class="pd-mp-hint"></div>`;
  const cv = host.querySelector('.pd-mp-cv'), g = cv.getContext('2d');
  const pop = host.querySelector('.pd-mp-pop'), popT = pop.querySelector('.pd-mp-pt'), popS = pop.querySelector('.pd-mp-ps'), hint = host.querySelector('.pd-mp-hint');
  const evBtn = host.querySelector('.pd-mp-ev');
  const clEl = host.querySelector('.pd-mp-cl'), clT = clEl.querySelector('.pd-mp-clt'), clList = clEl.querySelector('.pd-mp-cll');
  const li = () => getLang() === 'it' ? 0 : 1;

  // ---------- state ----------
  let playersT = 0, W = 0, H = 0, dpr = 1, k = 0.03, vx = 0, vz = 0, kMin = 0.01, shown = false, dirty = false, raf = 0;
  let sel = null, cl = null, events = [], showEvents = true, evTick = 0, popW = 0, popH = 0, clW = 0, clH = 0, ptrKind = 'mouse';
  try { showEvents = localStorage.getItem(EV_KEY) !== '0'; } catch (e) { /* private mode */ }
  const pins = []; // reused: { x, z, kind: 'spot'|'event', ref }
  let M = null, landPath = null, terrain = null, terrainJob = null, built = null, data = null, loading = false, bldPath = null, haveBld = false;
  const roads = { a: null, b: null, c: null }, areas = {};

  // ---------- data: coast and terrain from the manifest ----------
  function pairsPath(flat, p) { p.moveTo(flat[0], flat[1]); for (let i = 2; i < flat.length - 1; i += 2) p.lineTo(flat[i], flat[i + 1]); p.closePath(); }
  function prepManifest() {
    if (M || !world || !world.manifest) return !!M;
    M = world.manifest;
    landPath = new Path2D(); pairsPath(M.land, landPath);
    for (const isl of M.islands || []) if (isl && isl.length >= 6) pairsPath(isl, landPath);
    if (M.far && M.far.h) terrainJob = buildTerrain(M.far);
    return true;
  }
  // Hillshade of the far terrain grid, bicubic-upsampled 3x so the 100 m cells do not show, built in slices (a few ms per frame).
  function buildTerrain(far) {
    const U = 3, nx = far.nx, nz = far.nz, W2 = (nx - 1) * U + 1, H2 = (nz - 1) * U + 1, cell = far.s / U, src = far.h;
    const wt = [0, 1, 2].map(i => { const t = i / U; return [(-t * t * t + 2 * t * t - t) / 2, (3 * t * t * t - 5 * t * t + 2) / 2, (-3 * t * t * t + 4 * t * t + t) / 2, (t * t * t - t * t) / 2]; });
    const tmp = new Float32Array(W2 * nz), hh = new Float32Array(W2 * H2), out = new ImageData(W2, H2);
    const s = (ix, iz) => src[clamp(iz, 0, nz - 1) * nx + clamp(ix, 0, nx - 1)];
    const az = 40 * Math.PI / 180, lx = -Math.cos(az) * 0.7071, lz = -Math.cos(az) * 0.7071, ly = Math.sin(az), flat = ly, E = 2.4;
    let stage = 0, row = 0;
    const step = budget => {
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        if (stage === 0) { // along x for every source row
          for (let ix = 0; ix < nx; ix++) for (let u = 0; u < (ix < nx - 1 ? U : 1); u++) {
            const w = wt[u]; tmp[row * W2 + ix * U + u] = w[0] * s(ix - 1, row) + w[1] * s(ix, row) + w[2] * s(ix + 1, row) + w[3] * s(ix + 2, row);
          }
          if (++row >= nz) { stage = 1; row = 0; }
        } else if (stage === 1) { // along z for every output row
          const iz = Math.floor(row / U), u = row % U, w = wt[u], z0 = clamp(iz - 1, 0, nz - 1), z1 = iz, z2 = clamp(iz + 1, 0, nz - 1), z3 = clamp(iz + 2, 0, nz - 1);
          for (let x = 0; x < W2; x++) hh[row * W2 + x] = w[0] * tmp[z0 * W2 + x] + w[1] * tmp[z1 * W2 + x] + w[2] * tmp[z2 * W2 + x] + w[3] * tmp[z3 * W2 + x];
          if (++row >= H2) { stage = 2; row = 1; }
        } else if (stage === 2) { // shade
          const d = out.data;
          for (let x = 1; x < W2 - 1; x++) {
            const i = row * W2 + x, h = hh[i];
            const hx = (hh[i + 1] - hh[i - 1]) / (2 * cell), hz = (hh[i + W2] - hh[i - W2]) / (2 * cell);
            const nl = 1 / Math.sqrt(hx * hx * E * E + hz * hz * E * E + 1);
            const sh = (-hx * E * lx - hz * E * lz + ly) * nl - flat; // flat ground shades to 0
            const gate = clamp((h - 25) / 90, 0, 1), a1 = Math.min(0.5, Math.abs(sh) * 1.25) * gate * gate * (3 - 2 * gate), c1 = sh > 0 ? 255 : 60; // the flat plain gets no shading, only the hills
            const te = clamp((h - 40) / 420, 0, 1), at = te * te * (3 - 2 * te) * 0.3; // elevation tint: olive-brown
            const a = a1 + at * (1 - a1), o = i * 4;
            if (a <= 0.004 || h < 1) { d[o + 3] = 0; continue; }
            d[o] = (c1 * a1 + 128 * at * (1 - a1)) / a; d[o + 1] = (c1 * a1 + 138 * at * (1 - a1)) / a; d[o + 2] = (c1 * a1 + 88 * at * (1 - a1)) / a; d[o + 3] = a * 255;
          }
          if (++row >= H2 - 1) stage = 3;
        } else {
          const c = document.createElement('canvas'); c.width = W2; c.height = H2; c.getContext('2d').putImageData(out, 0, 0);
          terrain = { c, x: far.x0 - cell / 2, z: far.z0 - cell / 2, w: W2 * cell, h: H2 * cell };
          return true;
        }
      }
      return false;
    };
    return step;
  }

  // ---------- data: roads, areas, built-up haze ----------
  function cellsOf(list, q) {
    const m = new Map();
    for (const a of list) {
      const n = a[0], p = new Float32Array(2 * n); let x = a[1] * q, z = a[2] * q; p[0] = x; p[1] = z;
      for (let j = 1; j < n; j++) { x += a[1 + 2 * j] * q; z += a[2 + 2 * j] * q; p[2 * j] = x; p[2 * j + 1] = z; }
      const key = ckey(Math.floor(x / CELL), Math.floor(z / CELL)); let c = m.get(key); if (!c) m.set(key, c = { list: [], path: null }); c.list.push(p);
    }
    return m;
  }
  const ckey = (cx, cz) => (cx + 64) * 256 + (cz + 64);
  function pathOf(c, closed) {
    if (!c.path) {
      const p = new Path2D();
      for (const a of c.list) { p.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) p.lineTo(a[i], a[i + 1]); if (closed) p.closePath(); }
      c.path = p; c.list = null;
    }
    return c.path;
  }
  function load() {
    if (data || loading) return; loading = true;
    fetch(ASSET).then(r => r.json()).then(j => {
      data = true;   // (a flag: the raw lists are kept as the cells below, typed)
      for (const t of ['a', 'b', 'c']) roads[t] = cellsOf(j.roads[t] || [], j.q);
      for (const t in j.areas) areas[t] = cellsOf(j.areas[t], j.q);
      const b = j.built, c = document.createElement('canvas'); c.width = b.nx; c.height = b.nz;
      const id = new ImageData(b.nx, b.nz), d = id.data, n = b.nx * b.nz;
      let a = new Float32Array(n), t = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = (b.d.charCodeAt(i) - 97) / 15;
      for (let pass = 0; pass < 2; pass++) { // two 3x3 box blurs (separable): the 40 m cells would show as speckle otherwise
        for (let z = 0; z < b.nz; z++) for (let x = 0; x < b.nx; x++) { const i = z * b.nx + x; t[i] = (a[x > 0 ? i - 1 : i] + a[i] + a[x < b.nx - 1 ? i + 1 : i]) / 3; }
        for (let z = 0; z < b.nz; z++) for (let x = 0; x < b.nx; x++) { const i = z * b.nx + x; a[i] = (t[z > 0 ? i - b.nx : i] + t[i] + t[z < b.nz - 1 ? i + b.nx : i]) / 3; }
      }
      for (let i = 0; i < n; i++) { const v = Math.sqrt(a[i]); if (v < 0.02) continue; const o = i * 4; d[o] = C.haze[0]; d[o + 1] = C.haze[1]; d[o + 2] = C.haze[2]; d[o + 3] = Math.round(v * 0.62 * 255); }
      c.getContext('2d').putImageData(id, 0, 0); built = { c, x: b.x0, z: b.z0, w: b.nx * b.s, h: b.nz * b.s };
      dirty = true; schedule();
      setTimeout(centroBuildings, 300); // the one big Path2D, built now rather than in the frame that first needs it
    }).catch(e => { loading = false; console.warn('[startmap] data', e); });
  }
  function centroBuildings() { // the centro's own footprints (D.buildings), one Path2D
    if (bldPath || !D || !D.buildings) return;
    bldPath = new Path2D();
    for (const b of D.buildings) { const p = b.p; if (!p || p.length < 6) continue; bldPath.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) bldPath.lineTo(p[i], p[i + 1]); bldPath.closePath(); }
    haveBld = true;
  }

  // ---------- view ----------
  const sx = x => (x - vx) * k + W / 2, sy = z => (z - vz) * k + H / 2;
  function fit() { // opens on the city centre (the world origin is the Quattro Canti), not on the middle of all the pins, which sits far north towards Mondello
    const top = Math.min(90, H * 0.2);   // the top bar covers the upper edge
    k = clamp(Math.min(W, H - top) / OPEN_SPAN, kMin, K_MAX);
    vx = 0; vz = -top / 2 / k;
  }
  function limits() {
    const b = (M && M.bbox) || [-11000, -12600, 8200, 7800];
    kMin = Math.min(W / (b[2] - b[0]), H / (b[3] - b[1])) * 0.9;
    return b;
  }
  function clampView() {
    const b = limits(); k = clamp(k, kMin, K_MAX);
    vx = clamp(vx, b[0], b[2]); vz = clamp(vz, b[1], b[3]);
  }
  function zoomAt(f, px, py) { // keep the world point under (px, py) fixed
    closeCl();
    const wx = vx + (px - W / 2) / k, wz = vz + (py - H / 2) / k;
    k = clamp(k * f, kMin, K_MAX); vx = wx - (px - W / 2) / k; vz = wz - (py - H / 2) / k;
    clampView(); mark();
  }
  function resize() {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2); W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); limits(); mark();
  }

  // ---------- drawing ----------
  const labels = new Float32Array(4 * 64); let nLab = 0;
  function labelFree(x, y, w, h) { // x, y: centre; true when it overlaps nothing placed so far (and claims the spot)
    for (let i = 0; i < nLab; i++) { const o = i * 4; if (Math.abs(x - labels[o]) < (w + labels[o + 2]) / 2 && Math.abs(y - labels[o + 1]) < (h + labels[o + 3]) / 2) return false; }
    if (nLab < 64) { const o = nLab++ * 4; labels[o] = x; labels[o + 1] = y; labels[o + 2] = w; labels[o + 3] = h; }
    return true;
  }
  function text(str, x, y, size, weight = 700, fill = C.label) {
    g.font = `${weight} ${size}px 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`;
    const w = g.measureText(str).width;
    if (!labelFree(x, y, w + 4, size + 2)) return false;
    g.lineWidth = 3.5; g.strokeStyle = C.halo; g.strokeText(str, x, y); g.fillStyle = fill; g.fillText(str, x, y);
    return true;
  }
  function visibleCells(map, fn, margin) {
    const x0 = vx - W / 2 / k - margin, x1 = vx + W / 2 / k + margin, z0 = vz - H / 2 / k - margin, z1 = vz + H / 2 / k + margin;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) { const c = map.get(ckey(cx, cz)); if (c) fn(c); }
  }
  const PIN = (() => { const p = new Path2D(); p.moveTo(0, 0); p.bezierCurveTo(-5, -8, -9, -12, -9, -17); p.arc(0, -17, 9, Math.PI, 0); p.bezierCurveTo(9, -12, 5, -8, 0, 0); p.closePath(); return p; })();

  function drawRoads(tier, cas, fill, wM, minPx) {
    const m = roads[tier]; if (!m) return;
    const w = Math.max(wM, minPx / k);
    g.lineCap = g.lineJoin = 'round';
    g.lineWidth = w * 1.0 + 1.6 / k; g.strokeStyle = cas; visibleCells(m, c => g.stroke(pathOf(c, false)), 900);
    g.lineWidth = w; g.strokeStyle = fill; visibleCells(m, c => g.stroke(pathOf(c, false)), 900);
  }
  function draw() {
    dirty = false; if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.sea; g.fillRect(0, 0, W, H);
    nLab = 0;
    // world space
    g.save(); g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 - vx * k), dpr * (H / 2 - vz * k));
    if (landPath) {
      g.lineJoin = 'round';
      for (const [px, col] of [[26, 'rgba(185,220,234,.38)'], [15, 'rgba(185,220,234,.55)'], [7, 'rgba(206,232,242,.9)']]) { g.lineWidth = px / k; g.strokeStyle = col; g.stroke(landPath); }
      g.fillStyle = C.land; g.fill(landPath);
      g.save(); g.clip(landPath);
      if (built) { g.globalAlpha = k > 0.2 ? Math.max(0.1, 1 - (k - 0.2) * 2.2) : 1; g.imageSmoothingEnabled = true; g.drawImage(built.c, built.x, built.z, built.w, built.h); g.globalAlpha = 1; }
      for (const [t, col] of [['sand', C.sand], ['farm', C.farm], ['forest', C.forest], ['green', C.green]]) {
        const m = areas[t]; if (!m) continue;
        g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.2 / k;
        visibleCells(m, c => { const p = pathOf(c, true); g.fill(p); g.stroke(p); }, 700);
      }
      if (areas.water) { g.fillStyle = C.water; visibleCells(areas.water, c => g.fill(pathOf(c, true)), 700); }
      if (terrain) { g.imageSmoothingEnabled = true; g.drawImage(terrain.c, terrain.x, terrain.z, terrain.w, terrain.h); }
      g.restore();
    }
    if (k > 0.2) { centroBuildings(); if (bldPath) { g.fillStyle = C.bld; g.fill(bldPath); } }
    if (roads.c && k >= 0.1) drawRoads('c', C.roadC[0], C.roadC[1], 4.5, 1.1);
    if (roads.b && k >= 0.035) drawRoads('b', C.roadB[0], C.roadB[1], 9, 1.5);
    if (roads.a) drawRoads('a', C.roadA[0], C.roadA[1], 14, 2.4);
    g.restore();
    // screen space: labels, pins
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (k < 0.3 && k > 0.012) {
      const size = clamp(10 + k * 24, 10, 14);
      g.save(); g.globalAlpha = k < 0.02 ? (k - 0.012) / 0.008 : 1;
      for (const q of quarters) { const x = sx(q.x), y = sy(q.z); if (x < -40 || y < -10 || x > W + 40 || y > H + 10) continue; text(q.name.toUpperCase(), x, y, size, 600, '#8a7660'); }
      g.restore();
    }
    drawPins();
    drawPlayers();
    drawCar();
  }
  function buildPins() { // spots first, events over them
    pins.length = 0;
    for (const s of spots) pins.push({ x: s.x, z: s.z, kind: 'spot', ref: s });
    if (showEvents) for (const e of events) pins.push({ x: e.x, z: e.z, kind: 'event', ref: e });
  }
  // ---------- clusters: pins closer than CLUSTER_R pixels on screen share one badge (the selected pin always stands alone) ----------
  const CLUSTER_R = 19, clusters = [];
  function layout() {
    clusters.length = 0;
    const merge = k < K_MAX * 0.85;
    for (const p of pins) {
      const x = sx(p.x), y = sy(p.z); if (x < -40 || y < -50 || x > W + 40 || y > H + 40) continue;
      let c = null;
      if (merge && !(sel && sel.ref === p.ref)) for (const q of clusters) if (!q.solo && (q.x - x) ** 2 + (q.y - (y - 12)) ** 2 < CLUSTER_R * CLUSTER_R) { c = q; break; }
      if (c) { c.m.push(p); c.sx += x; c.sy += y - 12; c.x = c.sx / c.m.length; c.y = c.sy / c.m.length; }
      else clusters.push({ x, y: y - 12, sx: x, sy: y - 12, m: [p], solo: !!(sel && sel.ref === p.ref) });
    }
  }
  function drawCluster(c) {
    const n = c.m.length, ev = c.m.some(p => p.kind === 'event'), r = 13 + Math.min(4, n / 6);
    g.save(); g.translate(c.x, c.y);
    g.shadowColor = 'rgba(20,8,16,.35)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
    g.fillStyle = '#e8559a'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.shadowColor = 'transparent';
    g.lineWidth = 2.4; g.strokeStyle = '#fff'; g.stroke();
    if (ev) { g.fillStyle = '#ffc83d'; g.beginPath(); g.arc(r * 0.72, -r * 0.72, 4.5, 0, 7); g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#0b0709'; g.stroke(); }
    g.fillStyle = '#fff'; g.font = "700 14px 'Barlow Condensed', system-ui, sans-serif"; g.fillText(String(n), 0, 0.5);
    g.restore();
  }
  // Tap on a badge: a popup lists the pins under it (tap one to open its own start popup) with a "Zoom in" button that takes a modest step towards them
  // (the map no longer jumps to fit them all). The list scrolls inside the room the map has; it stays on its world point when the map is panned and closes when it is zoomed.
  const kindColour = p => p.kind === 'spot' ? '#e8559a' : KIND[p.ref.kind] || '#ffc83d';
  function openCluster(c) {
    closePop();
    let wx = 0, wz = 0; for (const p of c.m) { wx += p.x; wz += p.z; } wx /= c.m.length; wz /= c.m.length;
    const items = c.m.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'spot' ? -1 : 1) || String(itemOf(a).name).localeCompare(String(itemOf(b).name)));
    cl = { m: items, wx, wz }; fillCl(); clEl.hidden = false;
    // the list takes the room there is on the roomier side of the badge (the phone's landscape map is under 300 px high), at least two rows, at most 300 px
    clList.style.setProperty('--cl-h', '400px'); const fixed = clEl.offsetHeight - clList.offsetHeight, by = sy(wz) - 12;
    clList.style.setProperty('--cl-h', clamp(Math.max(by - 56 - 28, H - by - 30) - fixed, 88, 300) + 'px');
    clW = clEl.offsetWidth; clH = clEl.offsetHeight; placeCl(); mark();
  }
  function fillCl() {
    if (!cl) return;
    const n = cl.m.length;
    clT.textContent = n + ' ' + (n === 1 ? L.place1 : L.places)[li()];
    clList.innerHTML = cl.m.map((p, i) => { const it = itemOf(p); return `<button class="pd-mp-row" type="button" role="listitem" data-nav data-i="${i}"><i style="background:${kindColour(p)}"></i><span>${esc(it.name)}</span>${it.sub ? `<em>${esc(it.sub)}</em>` : ''}</button>`; }).join('');
  }
  function closeCl() { if (!cl) return false; cl = null; clEl.hidden = true; mark(); return true; }
  function placeCl() {
    if (!cl || clEl.hidden) return;
    const x = sx(cl.wx), y = sy(cl.wz) - 12, up = 20, top = y - up - clH - 8 < 56;
    const px = clamp(x, clW / 2 + 8, W - clW / 2 - 8), py = top ? y + 18 : y - up - 8;
    clEl.style.transform = `translate(${Math.round(px - clW / 2)}px, ${Math.round(clamp(top ? py : py - clH, 4, Math.max(4, H - clH - 4)))}px)`;
    clEl.style.setProperty('--tx', clamp(x - (px - clW / 2), 16, clW - 16) + 'px');
    clEl.classList.toggle('below', top);
  }
  function zoomCluster() { // the button: one modest step, centred on the pins under the badge
    if (!cl) return; const { wx, wz } = cl; closeCl();
    k = clamp(k * 1.8, kMin, K_MAX); vx = wx; vz = wz; clampView(); mark();
  }
  function drawPins() {
    const sz = clamp(0.8 + k * 1.2, 0.8, 1.15);
    layout();
    for (const c of clusters) {
      if (c.m.length > 1) { drawCluster(c); continue; }
      const p = c.m[0];
      const x = sx(p.x), y = sy(p.z);
      const on = sel && sel.ref === p.ref;
      g.save(); g.translate(x, y); g.scale(on ? sz * 1.25 : sz, on ? sz * 1.25 : sz);
      if (p.kind === 'spot') {
        g.shadowColor = 'rgba(20,8,16,.35)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
        g.fillStyle = on ? '#ff7ab8' : '#e8559a'; g.fill(PIN); g.shadowColor = 'transparent';
        g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(PIN);
        g.fillStyle = '#0b0709'; g.beginPath(); g.arc(0, -17, 3.6, 0, 7); g.fill();
      } else eventPin(p.ref, on);
      g.restore();
      if (k >= 0.12 && p.kind === 'spot') text(p.ref.name.replace(/ \(.*/, ''), x, y + 11, 12, 700, '#3a2a30');
    }
    if (sel) { const x = sx(sel.x), y = sy(sel.z); if (!(k >= 0.12 && sel.kind === 'spot')) text(sel.name.replace(/ \(.*/, ''), x, y + 12, 13, 700, '#3a2a30'); }
  }
  function eventPin(e, on) { // own shape and glyph per kind; a night event gets a dark ring and a moon
    const col = KIND[e.kind] || '#e8559a', night = !!e.night;
    g.shadowColor = 'rgba(20,8,16,.4)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
    g.fillStyle = col; g.strokeStyle = night ? '#1d2a5a' : '#0b0709'; g.lineWidth = night ? 3 : 2.2; g.lineJoin = 'round';
    g.beginPath();
    if (e.kind === 'urgent') { g.moveTo(0, -27); g.lineTo(13, -4); g.lineTo(-13, -4); g.closePath(); }
    else if (e.kind === 'food' || e.kind === 'pub') { if (g.roundRect) g.roundRect(-11, -26, 22, 22, 6); else g.rect(-11, -26, 22, 22); }
    else if (e.kind === 'race') { g.rect(-11, -27, 22, 22); }
    else g.arc(0, -14, 12, 0, 7);
    g.fill(); g.shadowColor = 'transparent'; g.stroke();
    g.fillStyle = '#0b0709'; g.strokeStyle = '#0b0709'; g.lineWidth = 2;
    if (e.kind === 'fare') { g.font = "700 15px 'Barlow Condensed', system-ui, sans-serif"; g.fillText('€', 0, -14); }
    else if (e.kind === 'urgent') { g.fillRect(-1.6, -21, 3.2, 8); g.fillRect(-1.8, -10.5, 3.6, 3.6); }
    else if (e.kind === 'food') { g.beginPath(); g.moveTo(-6, -22); g.lineTo(6, -22); g.lineTo(0, -8); g.closePath(); g.fillStyle = '#7a2a12'; g.fill(); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(-1, -18, 1.6, 0, 7); g.arc(2, -16, 1.4, 0, 7); g.fill(); }
    else if (e.kind === 'pub') { g.fillStyle = '#fff8e0'; g.fillRect(-6, -22, 10, 12); g.strokeStyle = '#0b0709'; g.lineWidth = 2; g.beginPath(); g.arc(5, -16, 3.4, -1.5, 1.5); g.stroke(); g.fillStyle = '#7a4a12'; g.fillRect(-6, -22, 10, 4); }
    else if (e.kind === 'rave') { for (let i = 0; i < 4; i++) g.fillRect(-9 + i * 5, -14 - (i % 2 ? 7 : 4), 3.2, (i % 2 ? 14 : 8)); }
    else if (e.kind === 'leaf') { g.beginPath(); g.ellipse(0, -14, 4.5, 9, 0.6, 0, 7); g.fill(); }
    else if (e.kind === 'horns') { g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8, -24); g.quadraticCurveTo(-8, -12, 0, -11); g.quadraticCurveTo(8, -12, 8, -24); g.stroke(); }
    else if (e.kind === 'dump') { g.fillRect(-8, -18, 16, 3); g.beginPath(); g.moveTo(-8, -15); g.lineTo(-5, -8); g.lineTo(5, -8); g.lineTo(8, -15); g.closePath(); g.fill(); }
    else if (e.kind === 'penna') { g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, -7); g.lineTo(6, -21); g.stroke(); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -7); g.lineTo(-8.5, -4.5); g.stroke(); }   // a pen, nib down
    else if (e.kind === 'race') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) g.fillRect(-9 + i * 4.5, -25 + j * 4.5, 4.5, 4.5); }
    if (night) { g.fillStyle = '#c8d4ff'; g.beginPath(); g.arc(12, -26, 6, 0, 7); g.fill(); g.fillStyle = '#1d2a5a'; g.beginPath(); g.arc(14.5, -27.5, 5, 0, 7); g.fill(); }
    if (on) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  }
  // Other players, the ones we are connected to (rooms of 500 m around the lapa, src/p2p/p2p.js): so a far player is not on the map, we simply do not know where it is. A cyan ring like the minimap's, the name beside it (canvas text only: the names come from strangers).
  function drawPlayers() {
    const list = getPlayers && getPlayers(); if (!list || !list.length) return;
    for (const p of list) {
      const x = sx(p.x), y = sy(p.z); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const c = getCar && getCar(), d = c ? Math.hypot(p.x - c.x, p.z - c.z) : 1e9, rr = 6 + 3.5 * clamp((500 - d) / 460, 0, 1);   // 6 px from 500 m out, 9.5 px inside 40 m (the lapa's own arrow stays visible through the ring)
      g.lineWidth = rr * 0.9 + 1; g.strokeStyle = '#0b0709'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.lineWidth = rr * 0.5 + 1; g.strokeStyle = '#00e1ff'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke();
      g.textAlign = x > W - 120 ? 'right' : 'left'; text(String(p.name || '').slice(0, 16), x + (x > W - 120 ? -14 : 14), y, 13, 700, '#04566b'); g.textAlign = 'center';
    }
  }
  function drawCar() { // where the lapa is now (when the picker is opened from the side menu)
    const c = getCar && getCar(); if (!c) return;
    const x = sx(c.x), y = sy(c.z); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) return;
    g.save(); g.translate(x, y); g.rotate(-c.th + Math.PI);
    g.fillStyle = '#c41e2a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    text(L.you[li()], x, y + 20, 12, 700, '#8a1020');
  }

  // ---------- frame loop (only while something changed) ----------
  function mark() { dirty = true; schedule(); }
  function schedule() { if (!raf && shown) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0; if (!shown) return;
    if (!M) prepManifest();
    if (terrainJob) { if (terrainJob(5)) { terrainJob = null; } dirty = true; }
    if (M && !data) load();
    if (dirty) draw();
    placePop(); placeCl();
    if (terrainJob || !M || !data) schedule();
  }

  // ---------- popup ----------
  function placePop() {
    if (!sel || pop.hidden) return;
    const x = sx(sel.x), y = sy(sel.z), up = sel.kind === 'event' ? 32 : 30, top = y - up - popH - 8 < 56;
    const px = clamp(x, popW / 2 + 8, W - popW / 2 - 8), py = top ? y + 12 : y - up - 8;
    pop.style.transform = `translate(${Math.round(px - popW / 2)}px, ${Math.round(top ? py : py - popH)}px)`;
    pop.style.setProperty('--tx', clamp(x - (px - popW / 2), 16, popW - 16) + 'px');
    pop.classList.toggle('below', top);
  }
  function openPop(item, focus) {
    closeCl(); sel = item; fillPop(); pop.hidden = false;
    popW = pop.offsetWidth; popH = pop.offsetHeight; placePop(); mark();
    if (focus) pop.querySelector('button').focus({ preventScroll: true });
  }
  function closePop() { const c = closeCl(); if (!sel) return c; sel = null; pop.hidden = true; mark(); return true; }
  function fillPop() {
    if (!sel) return;
    popT.textContent = sel.name;
    popS.textContent = sel.sub;
    const lab = L[sel.kind === 'event' ? 'there' : 'here'];   // a mission does not start from here: the game asks on arrival (src/ui.js)
    pop.querySelector('.pd-l1').textContent = lab[li()];   // one language: the one shown
  }
  function pick(px, py, thr) { // a pin, or a cluster badge ({ m: [pins] })
    layout();
    let best = null, bd = thr * thr;
    for (const c of clusters) {
      const y = c.m.length > 1 ? c.y : c.y + (c.m[0].kind === 'event' ? -2 : 0), d = (c.x - px) * (c.x - px) + (y - py) * (y - py);
      if (d <= bd) { bd = d; best = c.m.length > 1 ? c : c.m[0]; }
    }
    return best;
  }
  function itemOf(p) {
    if (p.kind === 'spot') return { kind: 'spot', ref: p.ref, x: p.x, z: p.z, name: p.ref.name, sub: p.ref.q || '' };
    const e = p.ref, kn = L[e.kind] ? L[e.kind][li()] : '';
    return { kind: 'event', ref: e, x: p.x, z: p.z, name: e.title || e.name || kn, sub: kn + (e.title && e.name ? ' · ' + e.name : '') + (e.night ? ' · ' + L.night[li()] : '') };
  }

  // ---------- input ----------
  const ptrs = new Map(); let tap = null, pinch = 0;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); ptrKind = e.pointerType || 'mouse';
    tap = ptrs.size === 1 ? { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: false } : null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
    if (ptrs.size === 1) {
      if (tap && !tap.moved && Math.hypot(e.offsetX - tap.x, e.offsetY - tap.y) > 6) tap.moved = true;
      if (!tap || tap.moved) { vx -= dx / k; vz -= dy / k; clampView(); mark(); }
      p.x = e.offsetX; p.y = e.offsetY;
    } else if (ptrs.size === 2) {
      p.x = e.offsetX; p.y = e.offsetY;
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch > 0 && d > 0) zoomAt(d / pinch, mx, my);
      pinch = d; vx -= dx / 2 / k; vz -= dy / 2 / k; clampView(); mark();
    }
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); pinch = 0;
    if (tap && !tap.moved && e.type === 'pointerup' && performance.now() - tap.t < 700) {
      const hit = pick(tap.x, tap.y, ptrKind === 'mouse' ? 18 : 26);
      if (hit && hit.m) openCluster(hit); else if (hit) openPop(itemOf(hit), false); else closePop();
    }
    tap = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.offsetX, e.offsetY); }, { passive: false });
  cv.addEventListener('dblclick', e => zoomAt(2, e.offsetX, e.offsetY));
  clList.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.pd-mp-row'); if (!b || !cl) return; const p = cl.m[+b.dataset.i]; if (p) openPop(itemOf(p), false); });
  host.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-map]'); if (!b) return;
    if (b.dataset.map === 'zin') zoomAt(1.6, W / 2, H / 2);
    else if (b.dataset.map === 'zout') zoomAt(1 / 1.6, W / 2, H / 2);
    else if (b.dataset.map === 'events') toggleEvents();
    else if (b.dataset.map === 'clzoom') zoomCluster();
  });
  function toggleEvents(v) {
    showEvents = v === undefined ? !showEvents : v; evBtn.setAttribute('aria-pressed', String(showEvents));
    try { localStorage.setItem(EV_KEY, showEvents ? '1' : '0'); } catch (e) { /* private mode */ }
    if (!showEvents && sel && sel.kind === 'event') closePop();
    buildPins(); mark();
  }
  function cycle(dir) { // Tab: next / previous pin in the order spots, events
    if (!pins.length) return;
    let i = sel ? pins.findIndex(p => p.ref === sel.ref) : -1;
    i = (i + dir + pins.length) % pins.length;
    const p = pins[i];
    vx = p.x; vz = p.z; if (k < 0.08) k = 0.08; clampView();
    openPop(itemOf(p), true);
  }
  function pan(dx, dz) { vx += dx / k; vz += dz / k; clampView(); mark(); }

  function applyLang() {
    for (const e of host.querySelectorAll('[data-t]')) {
      const key = e.dataset.t, i = li();
      if (e.dataset.a) e.setAttribute('aria-label', L[key][i]);
      else e.textContent = L[key][i];
    }
    evBtn.setAttribute('aria-label', L.events[li()]);
    hint.textContent = L.hint[li()];
    host.querySelector('.pd-mp-pop .pd-l1').textContent = L.here[li()];
    if (sel) { sel = itemOf({ kind: sel.kind, ref: sel.ref, x: sel.x, z: sel.z }); fillPop(); }
    if (cl) { fillCl(); clW = clEl.offsetWidth; clH = clEl.offsetHeight; placeCl(); }
    mark();
  }

  return {
    show() {
      shown = true; closePop(); clearInterval(playersT); playersT = setInterval(() => { if (shown && getPlayers && getPlayers().length) mark(); }, 700);   // the others keep moving while this is open
      events = (getEvents && getEvents()) || []; evBtn.hidden = !events.length; buildPins();
      evBtn.setAttribute('aria-pressed', String(showEvents));
      prepManifest(); applyLang(); load();
      // the screen may still be hidden or mid-transition when this runs: fit and centre only once the map has a real size
      let tries = 0;
      const place = () => { W = 0; resize(); if (!W && shown && tries++ < 60) { requestAnimationFrame(place); return; } limits(); fit(); clampView(); mark(); };
      place();
    },
    hide() { shown = false; clearInterval(playersT); closePop(); if (raf) { cancelAnimationFrame(raf); raf = 0; } cv.width = cv.height = 1; },   // a full-screen canvas is 15 MB at pixel ratio 2: show() sizes it again
    resize,
    applyLang,
    isOpenPop: () => !!sel || !!cl,
    closePop,
    key(code, shift) {
      const step = 60;
      switch (code) {
        case 'ArrowLeft': case 'KeyA': pan(-step, 0); return true;
        case 'ArrowRight': case 'KeyD': pan(step, 0); return true;
        case 'ArrowUp': case 'KeyW': pan(0, -step); return true;
        case 'ArrowDown': case 'KeyS': pan(0, step); return true;
        case 'Equal': case 'NumpadAdd': case 'Plus': zoomAt(1.4, W / 2, H / 2); return true;
        case 'Minus': case 'NumpadSubtract': zoomAt(1 / 1.4, W / 2, H / 2); return true;
        case 'Tab': cycle(shift ? -1 : 1); return true;
        case 'KeyE': toggleEvents(); return true;
      }
      return false;
    },
    startSelected() { if (sel && onStart) onStart(sel.x, sel.z, sel); },
    // test hook (?mapdebug): view state and the screen position of every pin
    debug: () => ({ W, H, k, vx, vz, terrain: !terrainJob && !!terrain, data: !!data, clusters: (layout(), clusters.map(c => ({ n: c.m.length, x: Math.round(c.x), y: Math.round(c.y) }))), pins: pins.map(p => ({ n: p.ref.name || p.ref.kind, kind: p.kind, x: Math.round(sx(p.x)), y: Math.round(sy(p.z)) })), setView(x, z, kk) { vx = x; vz = z; k = kk; clampView(); mark(); } }),
  };
}
