// Hill detail for the far terrain (assets/world/hills.bin, tools/hills_far.py). The manifest's far grid is 100 m and turns Monte Pellegrino's and Monte Gallo's
// walls into ramps; the 25 m TINITALY heights of every 500 m tile with relief are in one small file, and this builds a finer far mesh from them: 2 km chunks (4 x 4
// tiles), 25 m cells within HI_R of the camera, 50 m beyond, one draw call a chunk. The coarse far cells of a tile are left out (world.js reads `fine`) while a fine mesh
// stands on them, and so are the tiles that stream in as real terrain (`hidden`). Heights only: the manifest and the tiles are not touched, and ground() stays the coarse grid.
import * as THREE from 'three';

const T = 500, STEP = 25, N = 21, CT = 4;   // tile side, node spacing, nodes per tile side, tiles per chunk side
const HI_R = 4500, SKIRT = 60, HYST = 400;
const nk = (i, j) => (i + 200) * 1000 + (j + 200);

// node index (in a chunk's nn x nn grid) of node q of edge e of tile (tu, tv): 0 the -z side, 1 +x, 2 +z, 3 -x
const edgeNode = (tu, tv, e, q, c, nn) => (e === 0 ? tv * c : e === 2 ? (tv + 1) * c : tv * c + q) * nn + (e === 3 ? tu * c : e === 1 ? (tu + 1) * c : tu * c + q);

export function createHills({ root, url, mat, farM, colour }) {
  const tiles = new Map();   // nk -> Float32Array(N * N) metres
  const chunks = new Map();  // a * 1000 + b -> { mesh, level, active: Set of tile keys, ver, a, b, tris }
  const fine = new Set();    // keys of the tiles a fine mesh stands on now
  let loaded = false, failed = false, loading = null, fineVer = 0, trisNow = 0, pendingVis = 1;

  function load() {
    if (loading) return loading;
    return loading = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(ab => {
      const dv = new DataView(ab);
      if (dv.getUint32(0, false) !== 0x50484c31) throw new Error('hills.bin: bad magic');
      const n = dv.getUint16(4, true), body = 6 + 4 * n, d = new Int16Array(ab.slice(body, body + n * N * N * 2));
      for (let t = 0; t < n; t++) {
        const i = dv.getInt16(6 + 4 * t, true), j = dv.getInt16(8 + 4 * t, true), a = new Float32Array(N * N), o = t * N * N, q = new Int32Array(N * N);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const e = d[o + r * N + c], k = r * N + c;
          q[k] = r === 0 ? (c === 0 ? e : q[k - 1] + e) : c === 0 ? q[k - N] + e : q[k - 1] + q[k - N] - q[k - N - 1] + e;
          a[k] = q[k] * 0.5;
        }
        tiles.set(nk(i, j), a);
      }
      loaded = true;
    }).catch(e => { failed = true; pendingVis = 0; console.warn('[hills]', e); });
  }

  // height at a 25 m node (gi, gj are global node indices), the coarse grid where no tile of the file has it
  function H(gi, gj) {
    const i = Math.floor(gi / 20), j = Math.floor(gj / 20);
    let a = tiles.get(nk(i, j)), r = gj - j * 20, c = gi - i * 20;
    if (a === undefined && c === 0) { a = tiles.get(nk(i - 1, j)); c = 20; }
    if (a === undefined && r === 0) { a = tiles.get(nk(i, j - 1)); r = 20; if (a === undefined && c === 20) a = tiles.get(nk(i - 1, j - 1)); }
    return a !== undefined ? a[r * N + c] : farM(gi * STEP, gj * STEP);
  }

  function* build(ch, level) {
    const { a, b } = ch, c = 20 / level, nn = CT * c + 1, step = STEP * level, gi0 = a * CT * 20, gj0 = b * CT * 20;
    const act = new Set(); for (let u = 0; u < CT; u++) for (let v = 0; v < CT; v++) { const k = nk(a * CT + u, b * CT + v); if (tiles.has(k)) act.add(k); }
    ch.level = level; ch.act = act;
    const nb = nn * nn, ns = CT * CT * 4 * (c + 1), nv = nb + ns;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    let y0 = 1e9, y1 = -1e9;
    for (let j = 0; j < nn; j++) {
      for (let i = 0; i < nn; i++) {
        const gi = gi0 + i * level, gj = gj0 + j * level, k = (j * nn + i) * 3, y = H(gi, gj);
        const e = step, dx = (H(gi + level, gj) - H(gi - level, gj)) / (2 * e), dz = (H(gi, gj + level) - H(gi, gj - level)) / (2 * e), l = Math.hypot(dx, 1, dz);
        pos[k] = gi * STEP; pos[k + 1] = y - 0.6; pos[k + 2] = gj * STEP;
        nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        colour(col, k, pos[k], y, pos[k + 2], dx, dz);
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if ((j & 7) === 7) yield;
    }
    // skirt vertices of every edge of every tile of the chunk (the index decides which are used)
    let s = nb;
    for (let tu = 0; tu < CT; tu++) for (let tv = 0; tv < CT; tv++) for (let e = 0; e < 4; e++) for (let q = 0; q <= c; q++, s++) {
      const k = edgeNode(tu, tv, e, q, c, nn) * 3, w = s * 3;
      pos[w] = pos[k]; pos[w + 1] = pos[k + 1] - SKIRT; pos[w + 2] = pos[k + 2]; nor[w] = nor[k]; nor[w + 1] = nor[k + 1]; nor[w + 2] = nor[k + 2]; col[w] = col[k]; col[w + 1] = col[k + 1]; col[w + 2] = col[k + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ch.idx = new Uint16Array(nb * 6 + CT * CT * 4 * c * 6);
    geo.setIndex(new THREE.BufferAttribute(ch.idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3((gi0 + CT * 10) * STEP, (y0 + y1) / 2, (gj0 + CT * 10) * STEP), Math.hypot(CT * T / 2, (y1 - y0) / 2) + 80);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'hills_' + a + '_' + b; mesh.receiveShadow = true; mesh.frustumCulled = true;
    if (ch.mesh) { root.remove(ch.mesh); ch.mesh.geometry.dispose(); }
    ch.mesh = mesh; ch.nn = nn; ch.c = c; ch.nb = nb; ch.ver = -1;
    root.add(mesh);
  }

  // which tiles of a built chunk show: those with data that the streamer has not replaced by real terrain
  function index(ch, hidden) {
    const { a, b, c, nn, nb, idx } = ch; let n = 0;
    const on = (u, v) => u >= 0 && v >= 0 && u < CT && v < CT && ch.act.has(nk(a * CT + u, b * CT + v)) && !hidden.has(nk(a * CT + u, b * CT + v));
    for (let u = 0; u < CT; u++) for (let v = 0; v < CT; v++) {
      if (!on(u, v)) continue;
      for (let j = v * c; j < (v + 1) * c; j++) for (let i = u * c; i < (u + 1) * c; i++) {
        const k = j * nn + i; idx[n++] = k; idx[n++] = k + nn; idx[n++] = k + 1; idx[n++] = k + 1; idx[n++] = k + nn; idx[n++] = k + nn + 1;
      }
      const sk0 = nb + (u * CT + v) * 4 * (c + 1);
      for (let e = 0; e < 4; e++) {
        if (on(u + (e === 1 ? 1 : e === 3 ? -1 : 0), v + (e === 2 ? 1 : e === 0 ? -1 : 0))) continue;
        const s0 = sk0 + e * (c + 1);
        for (let q = 0; q < c; q++) {
          const p = edgeNode(u, v, e, q, c, nn), p2 = edgeNode(u, v, e, q + 1, c, nn);
          idx[n++] = p; idx[n++] = p2; idx[n++] = s0 + q; idx[n++] = p2; idx[n++] = s0 + q + 1; idx[n++] = s0 + q;
        }
      }
    }
    ch.mesh.geometry.setDrawRange(0, n); ch.mesh.geometry.index.needsUpdate = true; ch.mesh.visible = n > 0; ch.tris = n / 3; ch.ver = 0;
  }

  // generator for the world's far task: builds, rebuilds (another level) and drops chunks around (fx, fz) within R; visible chunks first
  function* sync(fx, fz, R, hidden, hiddenVer, seen) {
    if (!loading) load();
    if (!loaded) { yield loading; if (!loaded) return; }
    const want = [];
    const ca = Math.floor(fx / (CT * T)), cb = Math.floor(fz / (CT * T)), r = Math.ceil((R + CT * T) / (CT * T));
    for (let a = ca - r; a <= ca + r; a++) for (let b = cb - r; b <= cb + r; b++) {
      let any = false; for (let u = 0; u < CT && !any; u++) for (let v = 0; v < CT; v++) if (tiles.has(nk(a * CT + u, b * CT + v))) { any = true; break; }
      if (!any) continue;
      const cx = (a + 0.5) * CT * T, cz = (b + 0.5) * CT * T, d = Math.max(0, Math.hypot(cx - fx, cz - fz) - CT * T * 0.7), ch = chunks.get(a * 1000 + b);
      const lim = R + (ch ? HYST : 0);
      if (d > lim) continue;
      const lv = d < HI_R + (ch && ch.level === 1 ? HYST : -HYST) ? 1 : 2;
      want.push({ a, b, d, lv, vis: seen(a * CT * T, b * CT * T, (a + 1) * CT * T, (b + 1) * CT * T, 800) });
    }
    want.sort((p, q) => (q.vis - p.vis) || (p.d - q.d));
    pendingVis = want.filter(w => w.vis && (chunks.get(w.a * 1000 + w.b) || { level: 0 }).level !== w.lv).length;
    const keep = new Set();
    for (const w of want) {
      const key = w.a * 1000 + w.b; keep.add(key);
      let ch = chunks.get(key);
      if (!ch) { ch = { a: w.a, b: w.b, mesh: null, level: 0, act: null, ver: -1, tris: 0 }; chunks.set(key, ch); }
      if (ch.level !== w.lv) { yield* build(ch, w.lv); if (w.vis) pendingVis--; }
    }
    for (const [key, ch] of chunks) if (!keep.has(key)) { root.remove(ch.mesh); ch.mesh.geometry.dispose(); chunks.delete(key); dirty = true; }
    refresh(hidden, hiddenVer);
  }

  // cheap, every frame: index again the chunks whose tiles changed (terrain streamed in or out), and tell the coarse far mesh which tiles a fine mesh covers
  let lastVer = -1, dirty = false;
  function refresh(hidden, hiddenVer) {
    if (hiddenVer !== lastVer) { lastVer = hiddenVer; for (const ch of chunks.values()) ch.ver = -1; }
    let t = 0;
    for (const ch of chunks.values()) {
      if (!ch.mesh) continue;
      if (ch.ver !== 0) { index(ch, hidden); dirty = true; }
      t += ch.tris;
    }
    trisNow = t;
    if (dirty) {
      dirty = false; fine.clear();
      for (const ch of chunks.values()) if (ch.mesh && ch.mesh.visible) for (const k of ch.act) if (!hidden.has(k)) fine.add(k);
      fineVer++;
    }
  }
  return { load, sync, refresh, fine, get ver() { return fineVer; }, get loaded() { return loaded; }, get failed() { return failed; }, missing: () => (loaded || failed ? Math.max(0, pendingVis) : loading ? 1 : 0), tris: () => trisNow, stats: () => ({ chunks: chunks.size, tiles: tiles.size, tris: trisNow, fine: fine.size }) };
}
