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
// The pieces are a fixed set of canvases made at startup and never freed, so they are not the ones that fail when Safari on iOS runs out of canvas memory (new canvases then stay blank). Older iPhones also showed a piece with black roads,
// as if its context had been reset while it was painted: every paint sets the whole state, a style that does not read back or a lost context paints the piece again. A piece is checked after painting and now and then afterwards: a blank one
// is painted again, and while one stays blank the land is drawn directly under the pieces, so the map is never solid sea.
//

const W = 200; // canvas size in px (the CSS size varies, see ui/mobile css)
const T = 500; // tile size in metres (docs/TILES.md)
const SEA = '#3a8bb5', LAND = '#e4dccb', BLD = '#b98f62', TRACK = '#d6c7a2';
const AREA = { green: '#93b46a', forest: '#86a862', water: SEA, plaza: '#f2ead8', pier: '#bdbab2', sand: '#ece0bc' };
const PRE = 130; // metres beyond the visible radius that are painted ahead of time
const EXTRA_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

export function createMinimap({ canvas, car, world, DRIVABLE, mapMarkers, mapRoute }) {
  const mini = canvas.getContext('2d');
  const RES = 256, S = RES / T, CAP = 18; // px per tile side, px per metre, pieces kept
  let zoom = 0.75; // px per metre on screen; eased towards the speed-dependent target
  const stats = { pieces: 0, painted: 0, detailed: 0, lastMs: 0, maxMs: 0, sumMs: 0, drawMs: 0, drawMax: 0, frames: 0, blanks: 0, dead: 0, resets: 0, lost: 0 };

  // ---------- per tile pieces ----------
  const pieces = new Map(); // key -> { c, g, i, j, detail } (insertion order = LRU order)
  const pool = []; // the free canvases of the fixed set
  const onLost = e => { e.preventDefault(); stats.lost++; };   // preventDefault: the browser may give the context back (contextrestored below)
  const onBack = e => { for (const p of pieces.values()) if (p.c === e.target) { p.detail = false; p.g = p.c.getContext('2d'); paintBase(p); } };
  for (let n = 0; n < CAP; n++) {
    const c = document.createElement('canvas'); c.width = c.height = RES; const g = c.getContext('2d');
    c.addEventListener('contextlost', onLost); c.addEventListener('contextrestored', onBack);
    if (g) { g.fillRect(0, 0, 1, 1); pool.push({ c, g }); }   // (drawn on, so the memory is really theirs from now on)
  }
  let active = []; // pieces around the car, refreshed by scan()
  let landPath = null, bbox = null;
  let scanT = 0, scanI = 1e9, scanJ = 1e9, sinceDraw = 1, lastSig = NaN;
  const key = (i, j) => i * 4096 + j;

  // a marker's shape says what it is: round (default) someone to meet, target where to go now, diamond something to pick up, cross a graffiti to spray, triangle a food stall
  function drawMarker(x, y, r, shape, color) {
    mini.fillStyle = color; mini.strokeStyle = '#000'; mini.lineWidth = 1.5; mini.beginPath();
    if (shape === 'diamond') { mini.moveTo(x, y - r * 1.2); mini.lineTo(x + r, y); mini.lineTo(x, y + r * 1.2); mini.lineTo(x - r, y); mini.closePath(); }
    else if (shape === 'triangle') { mini.moveTo(x, y - r * 1.2); mini.lineTo(x + r * 1.1, y + r * 0.9); mini.lineTo(x - r * 1.1, y + r * 0.9); mini.closePath(); }
    else if (shape === 'cross') {
      mini.moveTo(x - r, y - r); mini.lineTo(x + r, y + r); mini.moveTo(x + r, y - r); mini.lineTo(x - r, y + r);
      mini.lineCap = 'round'; mini.lineWidth = 4.5; mini.stroke(); mini.strokeStyle = color; mini.lineWidth = 2.2; mini.stroke(); mini.lineCap = 'butt'; return;
    }
    else if (shape === 'ring') {   // another player: a hollow ring, dark edges, a bright colour (src/remotes.js)
      mini.arc(x, y, r + 1, 0, Math.PI * 2); mini.lineWidth = 6.5; mini.strokeStyle = '#0b0709'; mini.stroke(); mini.lineWidth = 3.4; mini.strokeStyle = color; mini.stroke(); return;
    }
    else if (shape === 'target') {
      mini.arc(x, y, r + 1, 0, Math.PI * 2); mini.fillStyle = '#fff'; mini.fill(); mini.stroke();
      mini.beginPath(); mini.arc(x, y, Math.max(2, r * 0.55), 0, Math.PI * 2); mini.fillStyle = color; mini.fill(); mini.stroke(); return;
    }
    else mini.arc(x, y, r, 0, Math.PI * 2);
    mini.fill(); mini.stroke();
  }
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
    g.setTransform(S, 0, 0, S, -p.i * T * S, -p.j * T * S); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]); g.lineCap = g.lineJoin = 'round';   // the whole state, every time: a context may have been reset
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
    let reset = false;
    for (const b of order) { g.strokeStyle = b.col; g.lineWidth = b.w; g.stroke(b.path); if (g.strokeStyle !== b.col) reset = true; }   // (a style that does not read back: the context was reset under us, the owner's phone drew such roads black)
    // buildings
    if (d.buildings && d.buildings.length) {
      const bp = new Path2D();
      for (const b of d.buildings) { if (b.p.length < 6) continue; poly(bp, b.p); bp.closePath(); }
      g.fillStyle = BLD; g.fill(bp);
    }
    if (reset || g.lineWidth === 1 && order.length && order[order.length - 1].w !== 1 || (g.isContextLost && g.isContextLost())) { stats.resets++; p.tries = (p.tries || 0) + 1; p.detail = p.tries > 3; paintBase(p); return; }   // try again on a later frame, a few times
    p.detail = true; stats.detailed++;
    if (isBlank(p)) verify(p);
  }
  function getPiece(i, j) {
    const k = key(i, j); let p = pieces.get(k);
    if (p) { pieces.delete(k); pieces.set(k, p); return p; }
    if (!pool.length) for (const [q, o] of pieces) if (!active.includes(o)) { pieces.delete(q); pool.push({ c: o.c, g: o.g }); if (o.blank) { o.blank = false; stats.dead--; } break; }   // the oldest piece not in use (the view uses at most 9 of the 18)
    if (!pool.length) return null;
    const s = pool.pop();
    p = { c: s.c, g: s.g, i, j, detail: false, blank: false };
    pieces.set(k, p);
    paintBase(p); stats.painted++;
    verify(p);
    return p;
  }
  // A blank canvas reads back transparent: paintBase covers every pixel with something opaque. The canvas gets a new backing and the piece is painted again (the detail follows in upgradeOne).
  function isBlank(p) { try { return (p.g.isContextLost && p.g.isContextLost()) || p.g.getImageData(RES >> 1, RES >> 1, 1, 1).data[3] === 0; } catch (e) { return true; } }
  function verify(p) {
    if (!isBlank(p)) { if (p.blank) { p.blank = false; stats.dead--; } return; }
    stats.blanks++;
    p.c.width = p.c.height = RES; p.g = p.c.getContext('2d') || p.g; p.detail = false; p.tries = 0; paintBase(p);
    const b = isBlank(p); if (b !== p.blank) { p.blank = b; stats.dead += b ? 1 : -1; }
  }
  let checkI = 0, checkT = 0;
  function scan(R) { // pieces for every tile in the visible disc plus a margin
    if (!landPath) { if (world.manifest) buildLand(world.manifest); else return; }
    const r = R + PRE, i0 = Math.floor((car.x - r) / T), i1 = Math.floor((car.x + r) / T), j0 = Math.floor((car.z - r) / T), j1 = Math.floor((car.z + r) / T);
    active.length = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      if ((i + 1) * T < bbox[0] || i * T > bbox[2] || (j + 1) * T < bbox[1] || j * T > bbox[3]) continue; // pure sea outside the baked area
      const p = getPiece(i, j); if (p) active.push(p);
    }
    stats.pieces = pieces.size;
    if ((checkT -= 0.2) <= 0 && active.length) { checkT = 2; verify(active[checkI++ % active.length]); }   // one piece every 2 s: a canvas can also lose its pixels later
  }
  function upgradeOne() { // at most one detail paint per frame
    for (const p of active) {
      if (p.detail || p.blank) continue;
      const d = world.tileData(p.i, p.j);
      if (!d) continue;
      const t0 = performance.now();
      try { paintDetail(p, d); } catch (e) { p.detail = true; console.warn('[minimap] tile', p.i, p.j, e); }
      const ms = performance.now() - t0; stats.lastMs = ms; stats.sumMs += ms; if (ms > stats.maxMs) stats.maxMs = ms;
      return true;
    }
    return false;
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
      if (upgradeOne()) sinceDraw = 1;
    }
    // A canvas drawn every frame goes through the page's compositing every frame (on Safari that is the dear part): 30 times a second while anything moves, a heading up map turning at that rate
    // looks the same, and twice a second while nothing does (standing still), which also catches what the sum below cannot see, such as a marker changing colour.
    sinceDraw += dt || 0.016;
    let sig = Math.round(car.x * 4) * 1.7 + Math.round(car.z * 4) * 2.3 + Math.round(car.th * 200) * 31 + Math.round(zoom * 500) * 97 + mapRoute.length + (mapRoute.i0 || 0);
    for (const m of mapMarkers) sig += m.x * 0.7 + m.z * 1.3 + (m.size || 0);
    if (sinceDraw < (sig !== lastSig ? 0.03 : 0.5)) return;
    sinceDraw = 0; lastSig = sig;
    mini.save();
    mini.clearRect(0, 0, W, W);
    mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
    mini.fillStyle = SEA; mini.fillRect(0, 0, W, W);
    mini.translate(W / 2, W / 2);
    mini.rotate(car.th - Math.PI);
    mini.scale(zoom, zoom);
    if (stats.dead > 0 && landPath) { mini.translate(-car.x, -car.z); mini.fillStyle = LAND; mini.fill(landPath); mini.translate(car.x, car.z); }   // pieces that stay blank (see the top of this file): at least the land
    drawTiles(R);
    mini.restore();
    // Markers from other modules (missions, stigghiulari, other players), drawn after restore() in plain
    // screen space: rotate each offset by the same angle as the map (heading up), scale like the map.
    // Off-map markers are pinned to the rim so the direction still reads.
    const a = car.th - Math.PI, ca = Math.cos(a), sa = Math.sin(a), k = zoom;
    if (mapRoute.length > 1) {
      mini.save(); mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
      mini.lineCap = mini.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {   // outline, then pink; only the part still to drive, from the car (mapRoute.i0 and .px/.pz: src/route-guide.js)
        mini.strokeStyle = pass ? '#e8559a' : '#120a0e'; mini.lineWidth = pass ? 4 : 7; mini.beginPath(); mini.moveTo(W / 2, W / 2);
        if (mapRoute.i0 > 0) { const dx = (mapRoute.px - car.x) * k, dz = (mapRoute.pz - car.z) * k; mini.lineTo(W / 2 + dx * ca - dz * sa, W / 2 + dx * sa + dz * ca); }
        for (let i = mapRoute.i0 || 0; i < mapRoute.length; i++) { const m = mapRoute[i], dx = (m[0] - car.x) * k, dz = (m[1] - car.z) * k; mini.lineTo(W / 2 + dx * ca - dz * sa, W / 2 + dx * sa + dz * ca); }
        mini.stroke();
      }
      mini.restore();
    }
    let near = null, nearD = 1e9;   // the nearest other player on the map: its name is written beside it when the map is big enough to read it
    for (const m of mapMarkers) {
      const dx = (m.x - car.x) * k, dz = (m.z - car.z) * k;
      let px = dx * ca - dz * sa, pz = dx * sa + dz * ca;
      const r = Math.hypot(px, pz), rim = W / 2 - 8, off = r > rim;
      if (off) { px *= rim / r; pz *= rim / r; }
      // another player's ring grows as the player comes near: 3.5 px (200 px canvas) from 400 m out, 6.5 px inside 40 m, never more, so it stays a thin ring round the arrow and clear of a mission mark
      const rs = m.player ? 3.5 + 3 * Math.min(1, Math.max(0, (400 - Math.hypot(m.x - car.x, m.z - car.z)) / 360)) : m.size || 5;
      drawMarker(W / 2 + px, W / 2 + pz, off ? 4 : rs, m.shape, m.color || '#e8559a');
      if (m.player && !off && r < nearD) { nearD = r; near = [m, W / 2 + px, W / 2 + pz]; }
    }
    // On a phone the map is about 98 px wide, a 200 px canvas shown at half size: a name would be 5 px tall. So there it is the dot only; from 150 px up, the nearest player gets a name.
    if (near && near[0].name && canvas.clientWidth >= 150) {
      const [m, x, y] = near; mini.font = "700 12px 'Barlow Condensed', system-ui, sans-serif"; mini.textBaseline = 'middle'; mini.lineJoin = 'round';
      const w = mini.measureText(m.name).width, left = x + 12 + w > W - 6; mini.textAlign = left ? 'right' : 'left';
      const tx = left ? x - 12 : x + 12; mini.lineWidth = 3.5; mini.strokeStyle = 'rgba(11,7,9,.85)'; mini.strokeText(m.name, tx, y); mini.fillStyle = '#e8fbff'; mini.fillText(m.name, tx, y); mini.textAlign = 'start';
    }
    mini.fillStyle = '#c41e2a'; mini.strokeStyle = '#fff'; mini.lineWidth = 2;
    mini.beginPath(); mini.moveTo(W / 2, W / 2 - 9); mini.lineTo(W / 2 + 6, W / 2 + 7); mini.lineTo(W / 2 - 6, W / 2 + 7); mini.closePath(); mini.fill(); mini.stroke();
    const ms = performance.now() - t0; stats.frames++; stats.drawMs += ms; if (ms > stats.drawMax) stats.drawMax = ms;
  }

  const api = { draw, pieces, stats: () => ({ ...stats, zoom, active: active.length, res: RES, cap: CAP, avgDrawMs: stats.drawMs / Math.max(1, stats.frames) }) };
  if (location.search.includes('debug')) window.__pdMinimap = api;
  return api;
}
