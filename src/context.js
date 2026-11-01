// Far city: the whole map beyond the low detail ring, as flat-coloured boxes. Owned by the context work.
// tools/farcity.mjs bakes assets/world/far.bin from the world tiles: per 500 m tile the footprints are rasterised on a coarse grid, cells of
// similar height merged into rectangles, each rectangle one box (one colour, only the walls a neighbour does not hide). Here the boxes
// are extruded on the far terrain, 4 x 4 tiles (2 km) per mesh so the frustum culls them and one draw call covers a chunk. A tile's
// boxes are shown until the tile has real buildings (low or full detail, src/world.js), then its index range drops out of the chunk's draw range.
// Nothing here fetches tiles: the whole layer is one small file, so the horizon costs a few triangles per tile, not a tile download.
import * as THREE from 'three';

const HQ = [3, 5, 7.5, 10.5, 14, 18, 23, 30, 40, 55, 75]; // height classes, same table as tools/farcity.mjs
const SKIRT = 6;            // boxes reach this far below the lowest ground under them (the far grid is 100 m, real ground differs)
const CH = 4;               // tiles per chunk side
const WALL = 0.75;          // plain plaster vs the low detail facade texture (windows darken it on average)
const ROOF = new THREE.Color().setRGB(0.69, 0.66, 0.61, THREE.SRGBColorSpace);

// ground under far boxes: same triangulation as the far terrain mesh (world.js buildFar) and its 0.6 m drop
function farSurface(F) {
  const n = F.nx, h = F.h;
  return (x, z) => {
    const fx = Math.max(0, Math.min(F.nx - 1.001, (x - F.x0) / F.s)), fz = Math.max(0, Math.min(F.nz - 1.001, (z - F.z0) / F.s));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const h00 = h[j * n + i], h10 = h[j * n + i + 1], h01 = h[(j + 1) * n + i], h11 = h[(j + 1) * n + i + 1];
    return (tx + tz <= 1 ? h00 + (h10 - h00) * tx + (h01 - h00) * tz : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz)) - 0.6;
  };
}

// The old context city (OSM buildings of the playable box, src/context-select.js) is gone: the far city covers the whole map. main.js still
// calls this; it returns an empty group.
export function buildContext() { const g = new THREE.Group(); g.name = 'context'; return g; }

// root: where the chunk meshes go; F: the manifest's far grid; nk(i, j): the streamer's tile key; mat: a vertex-colour material
export function createFarCity({ root, F, T, nk, url, mat }) {
  const ground = farSurface(F);
  const dir = new Map();      // tile key -> { k, i, j, off, n, tris }
  const byChunk = new Map();  // chunk key -> [tile entries]
  const chunks = new Map();   // chunk key -> built chunk
  const hidden = new Set();
  let cols = null, pal = null, loaded = false, failed = false, loading = null, buildMs = 0, built = 0;
  const ck = (ci, cj) => (ci + 100) * 1000 + (cj + 100);

  function load() {
    if (loading) return loading;
    return loading = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(ab => {
      const u8 = new Uint8Array(ab), dv = new DataView(ab);
      if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'PFC2') throw new Error('bad far city file');
      const cell = u8[4], nc = u8[5], nt = dv.getUint16(6, true), nb = dv.getUint32(8, true);
      let o = 12;
      pal = []; for (let c = 0; c < nc; c++, o += 3) { const w = new THREE.Color().setRGB(u8[o] / 255, u8[o + 1] / 255, u8[o + 2] / 255, THREE.SRGBColorSpace); pal.push({ wall: w.clone().multiplyScalar(WALL), roof: ROOF.clone().lerp(w, 0.2) }); }
      let off = 0;
      for (let t = 0; t < nt; t++, o += 6) {
        const i = dv.getInt16(o, true), j = dv.getInt16(o + 2, true), n = dv.getUint16(o + 4, true);
        const e = { k: nk(i, j), i, j, off, n, tris: 0, c: ck(Math.floor(i / CH), Math.floor(j / CH)) };
        off += n; dir.set(e.k, e);
        let a = byChunk.get(e.c); if (!a) byChunk.set(e.c, a = []); a.push(e);
      }
      cols = {}; for (const name of ['x', 'z', 'w', 'd', 'q', 'c', 'm']) { cols[name] = u8.subarray(o, o + nb); o += nb; }
      cols.cell = cell;
      for (const e of dir.values()) { let tr = 0; for (let b = e.off; b < e.off + e.n; b++) { const m = cols.m[b]; tr += 2 + 2 * ((m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1)); } e.tris = tr; }
      loaded = true;
    }).catch(e => { failed = true; console.warn('[far city]', e); });
  }

  // one 2 km chunk: all its tiles' boxes in one geometry, index ranges per tile
  function* buildChunk(key) {
    const t0 = performance.now(), tiles = byChunk.get(key), { x: bx, z: bz, w: bw, d: bd, q: bq, c: bc, m: bm, cell } = cols;
    let nv = 0, ni = 0;
    for (const e of tiles) for (let b = e.off; b < e.off + e.n; b++) { const m = bm[b], s = (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1); nv += 4 + 4 * s; ni += 6 + 6 * s; }
    const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 4), col = new Float32Array(nv * 3), idx = new Uint32Array(ni), ranges = [];
    let v = 0, ii = 0, nbx = 0;
    const quad = (ax, ay, az, bx2, by, bz2, y1, y0, nx, ny, nz, c) => { // wall: bottom edge a->b, normal given; or roof when y0 === null
      const o = v * 3;
      pos[o] = ax; pos[o + 1] = y0; pos[o + 2] = az; pos[o + 3] = bx2; pos[o + 4] = y0; pos[o + 5] = bz2;
      pos[o + 6] = bx2; pos[o + 7] = y1; pos[o + 8] = bz2; pos[o + 9] = ax; pos[o + 10] = y1; pos[o + 11] = az;
      for (let k = 0; k < 4; k++) { nor[(v + k) * 4] = nx * 127; nor[(v + k) * 4 + 1] = ny * 127; nor[(v + k) * 4 + 2] = nz * 127; col[o + k * 3] = c.r; col[o + k * 3 + 1] = c.g; col[o + k * 3 + 2] = c.b; }
      idx[ii++] = v; idx[ii++] = v + 1; idx[ii++] = v + 2; idx[ii++] = v; idx[ii++] = v + 2; idx[ii++] = v + 3; v += 4;
    };
    for (const e of tiles) {
      const start = ii, x0 = e.i * T, z0 = e.j * T;
      for (let b = e.off; b < e.off + e.n; b++) {
        const xa = x0 + bx[b] * cell, za = z0 + bz[b] * cell, xb = Math.min(x0 + T, xa + bw[b] * cell), zb = Math.min(z0 + T, za + bd[b] * cell), m = bm[b], p = pal[bc[b]];
        const g = Math.min(ground(xa, za), ground(xb, za), ground(xa, zb), ground(xb, zb), ground((xa + xb) / 2, (za + zb) / 2));
        const top = g + HQ[bq[b]], bot = g - SKIRT;
        // roof: (xa,za) (xa,zb) (xb,zb) (xb,za) wound so the normal is +y (the quad helper takes a bottom edge, so write it by hand)
        { const o = v * 3;
          pos[o] = xa; pos[o + 1] = top; pos[o + 2] = za; pos[o + 3] = xa; pos[o + 4] = top; pos[o + 5] = zb; pos[o + 6] = xb; pos[o + 7] = top; pos[o + 8] = zb; pos[o + 9] = xb; pos[o + 10] = top; pos[o + 11] = za;
          for (let k = 0; k < 4; k++) { nor[(v + k) * 4 + 1] = 127; col[o + k * 3] = p.roof.r; col[o + k * 3 + 1] = p.roof.g; col[o + k * 3 + 2] = p.roof.b; }
          idx[ii++] = v; idx[ii++] = v + 1; idx[ii++] = v + 2; idx[ii++] = v; idx[ii++] = v + 2; idx[ii++] = v + 3; v += 4; }
        if (m & 1) quad(xb, 0, za, xa, 0, za, top, bot, 0, 0, -1, p.wall);
        if (m & 2) quad(xb, 0, zb, xb, 0, za, top, bot, 1, 0, 0, p.wall);
        if (m & 4) quad(xa, 0, zb, xb, 0, zb, top, bot, 0, 0, 1, p.wall);
        if (m & 8) quad(xa, 0, za, xa, 0, zb, top, bot, -1, 0, 0, p.wall);
        if ((++nbx & 255) === 0) yield;
      }
      ranges.push({ k: e.k, start, count: ii - start });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 4, true));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const live = idx.slice(); geo.setIndex(new THREE.BufferAttribute(live, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'farcity_' + key; mesh.matrixAutoUpdate = false;
    const ch = { key, mesh, geo, master: idx, live, ranges, tris: 0, ni };
    chunks.set(key, ch); root.add(mesh); built++; buildMs += performance.now() - t0;
    applyHidden(ch);
  }

  function applyHidden(ch) {
    let n = 0;
    for (const r of ch.ranges) if (!hidden.has(r.k)) { ch.live.set(ch.master.subarray(r.start, r.start + r.count), n); n += r.count; }
    ch.geo.setDrawRange(0, n); ch.geo.index.needsUpdate = true; ch.mesh.visible = n > 0; ch.tris = n / 3;
  }
  // keys: the Set of tile keys that have real buildings now (low or full detail)
  function hide(keys) {
    const dirty = new Set();
    for (const k of keys) if (!hidden.has(k)) { hidden.add(k); const e = dir.get(k); if (e) dirty.add(e.c); }
    for (const k of hidden) if (!keys.has(k)) { hidden.delete(k); const e = dir.get(k); if (e) dirty.add(e.c); }
    for (const c of dirty) { const ch = chunks.get(c); if (ch) applyHidden(ch); }
  }
  const dist = (key, fx, fz) => { const ci = Math.floor(key / 1000) - 100, cj = key % 1000 - 100, x0 = ci * CH * T, z0 = cj * CH * T, s = CH * T; return Math.hypot(Math.max(x0 - fx, 0, fx - x0 - s), Math.max(z0 - fz, 0, fz - z0 - s)); };
  const bounds = (key, fn) => { const x0 = (Math.floor(key / 1000) - 100) * CH * T, z0 = (key % 1000 - 100) * CH * T; return fn(x0, z0, x0 + CH * T, z0 + CH * T); };
  // Keep the chunks within R of (fx, fz) built, drop the ones beyond R + 1.5 km. A generator: the caller runs it in slices.
  // seen(x0, z0, x1, z1): optional, true for a chunk the camera can see; those are built first (nearest first), then the others.
  function* sync(fx, fz, R, seen) {
    if (!loaded) return;
    for (const [key, ch] of chunks) if (dist(key, fx, fz) > R + 1500) { ch.mesh.removeFromParent(); ch.geo.dispose(); chunks.delete(key); }
    for (;;) {
      let best = -1, bs = Infinity;
      for (const key of byChunk.keys()) {
        if (chunks.has(key)) continue;
        const d = dist(key, fx, fz); if (d > R) continue;
        const s = d + (seen && !bounds(key, seen) ? 1e6 : 0);
        if (s < bs) { bs = s; best = key; }
      }
      if (best < 0) return;
      yield* buildChunk(best); yield;
    }
  }
  // chunks within R of (fx, fz) that are not built yet and that seen(x0, z0, x1, z1) says are in view
  function missing(fx, fz, R, seen) {
    if (!loaded) return 0;
    let n = 0;
    for (const key of byChunk.keys()) if (!chunks.has(key) && dist(key, fx, fz) <= R && bounds(key, seen)) n++;
    return n;
  }
  return {
    load, sync, hide, missing,
    get loaded() { return loaded; }, get failed() { return failed; },
    // triangles the tile's boxes cost while they are shown (0 where the tile has no buildings or the file is not in)
    tris(k) { const e = dir.get(k); return e ? e.tris : 0; },
    // all far triangles within R of the point that are not in `skip` (a Set of tile keys): the part of the budget the far ring holds
    trisAround(fx, fz, R, skip) {
      let n = 0;
      for (const e of dir.values()) { if (skip.has(e.k)) continue; const x = (e.i + 0.5) * T - fx, z = (e.j + 0.5) * T - fz; if (x * x + z * z < R * R) n += e.tris; }
      return n;
    },
    stats() { let tris = 0, boxes = 0; for (const ch of chunks.values()) tris += ch.tris; for (const e of dir.values()) boxes += e.n; return { loaded, chunks: chunks.size, built, buildMs: +buildMs.toFixed(0), tris, boxes, tiles: dir.size }; },
  };
}
