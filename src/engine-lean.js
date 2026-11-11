// The same picture from less work, on top of three.js (docs/PERF-ENGINE.md has the measurements and the reasoning). On by default; ?engine=off leaves three.js to itself, for comparing.
//   occ     street-canyon culling: a fan of rays over a height grid of the buildings says what the walls hide, computed on the CPU in the same frame (no readback, no lag),
//           and three.js walks a flat list of what is left instead of the whole scene graph
//   shadow  the static casters (tiles, props, markets) are drawn into a cached depth map once a second or so, a few per frame; every frame only copies it and adds what moves
//   walk    the per-frame matrix walk skips the static part of the scene
//   sort    opaque draws front to back instead of by material, for GPUs that shade before the depth test has seen everything
// The default is occ, shadow and walk; ?lean=occ,sort picks parts by name for measuring. game.lean.stats() with ?debug.
import * as THREE from 'three';
import { hooks } from './core.js';

const T = 500;                        // tile size (src/world.js)
const CELL = 4, NC = T / CELL;        // occluder cells: a cell blocks only if every sample in it is inside a solid, so an alley stays open
const SP = CELL / 2, NS = NC * 2 + 1; // raster samples of a tile (3 x 3 per cell, shared along the edges)
const NEAR_STEP = CELL, NEAR_R = 100, FAR_STEP = CELL * 2, MAXR = 450;   // ray march: a skipped cell only means a wall that does not occlude, and past the walls of the street little more is hidden (further out a street fits between two rays: a run to 1400 m let the hills' pixels fall through such gaps)
const EYE_R = 10;                     // metres
const CD = CELL * Math.SQRT2;         // a cell's diagonal: a sample anywhere in a cell, the roof counts at the far side of the cell when it is above the eye, at the near side when below
const RAYS = 320, REC = 24;           // rays are even in screen x, so at the centre of a 2.2 : 1 screen they are about 0.45 degrees apart, 3.5 m at 450 m
const EMPTY = -1e9, BOX = 6;          // a box: x0, z0, x1, z1, top, bottom
const key = (i, j) => (i + 2048) * 4096 + j + 2048;

// The order of the opaque draws, for every path (src/main.js sets it, with or without the engine): three's own, by material, except that the cut-outs (alphaTest: the shader may discard a pixel)
// come after the solid draws of the same renderOrder. A tile-based GPU (every iPhone) shades a solid pixel only if nothing solid ends up in front of it, in whatever order; a pixel that may be
// discarded is shaded wherever nothing drawn before it is in front. So, as Apple advises: solid, then cut-out, then transparent (docs/PERF-ENGINE.md, "Cut-outs after the solid draws").
// Where a cut-out and a solid cross, the odd sample has the same depth in both and the later draw wins it, so a material with userData.keepOrder stays where three puts it (the fence panels,
// src/fences.js). ?order=off leaves three's order, for comparing; ?order=all moves those too.
const ORDER = new URLSearchParams(location.search).get('order');
const kind = [];   // by material id: 1 solid, 2 cut-out. Asked once per material: alphaTest is a getter, and reading it at every comparison cost more than the rest of the sort
const mark = m => kind[m.id] = m.alphaTest > 0 && (ORDER === 'all' || !m.userData.keepOrder) ? 2 : 1;
const cut = ORDER === 'off' ? () => 0 : m => kind[m.id] || mark(m);
export const cutoutsLast = ORDER === 'off' ? null : (a, b) => {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ma = a.material, mb = b.material, ia = ma.id, ib = mb.id;
  if (ia !== ib) return (kind[ia] || mark(ma)) - (kind[ib] || mark(mb)) || ia - ib;
  return a.materialVariant - b.materialVariant || a.z - b.z || a.id - b.id;
};

export function createLeanEngine({ renderer, scene, camera, sun, world, parts }) {
  const on = { occ: parts.includes('occ'), shadow: parts.includes('shadow'), walk: parts.includes('walk'), sort: parts.includes('sort'), parts: parts.includes('occ') && !parts.includes('noparts') };
  const st = { rays: 0, steps: 0, tested: 0, hidden: 0, outside: 0, drawn: 0, leaves: 0, groups: 0, always: 0, rebuilds: 0, statics: 0, refreshes: 0, cullMs: 0, rasterMs: 0, grids: 0, pendingBoxes: 0, fanT: 0, leafT: 0, fr: 0 };

  // ---------- occluder grids, one per full detail tile, from the same solids the building generator emits ----------
  const grids = new Map(), rasterQueue = [];
  if (on.occ) hooks.occ = {
    begin() { const solids = []; return { solids, add(flat, holes, roofY) { solids.push(flat, holes, roofY); } }; },
    end(t, job) { rasterQueue.push({ i: t.i, j: t.j, k: key(t.i, t.j), solids: job.solids }); },
    drop(t) { grids.delete(key(t.i, t.j)); if (rasterJob && rasterJob.k === key(t.i, t.j)) rasterJob = null; for (let q = rasterQueue.length - 1; q >= 0; q--) if (rasterQueue[q].k === key(t.i, t.j)) rasterQueue.splice(q, 1); },
  };
  let rasterJob = null;
  const row = new Float64Array(256);
  function rasterStep(budget) {   // a few ms of solids per frame at most; until a tile is done it just does not occlude
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
      if (!rasterJob) {
        const q = rasterQueue.shift(); if (!q) return;
        rasterJob = { ...q, n: 0, s: new Float32Array(NS * NS).fill(EMPTY) };
      }
      const J = rasterJob, S = J.s, x0 = J.i * T, z0 = J.j * T;
      for (let b = 0; b < 30 && J.n < J.solids.length; b++, J.n += 3) rasterSolid(S, x0, z0, J.solids[J.n], J.solids[J.n + 1], J.solids[J.n + 2]);
      if (J.n < J.solids.length) continue;
      const g = new Float32Array(NC * NC);
      for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
        let m = Infinity;
        for (let b = 0; b <= 2; b++) for (let a = 0; a <= 2; a++) { const v = S[(j * 2 + b) * NS + i * 2 + a]; if (v < m) m = v; }
        g[j * NC + i] = m;
      }
      grids.set(J.k, g); rasterJob = null;
    }
  }
  function rasterSolid(S, x0, z0, flat, holes, roofY) {
    let lo = Infinity, hi = -Infinity;
    for (let q = 1; q < flat.length; q += 2) { if (flat[q] < lo) lo = flat[q]; if (flat[q] > hi) hi = flat[q]; }
    const j0 = Math.max(0, Math.ceil((lo - z0) / SP)), j1 = Math.min(NS - 1, Math.floor((hi - z0) / SP));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + j * SP; let n = 0;
      n = crossings(flat, z, n);
      if (holes) for (let h = 0; h < holes.length; h++) n = crossings(holes[h], z, n);
      if (n < 2) continue;
      for (let a = 1; a < n; a++) { const v = row[a]; let b = a - 1; while (b >= 0 && row[b] > v) { row[b + 1] = row[b]; b--; } row[b + 1] = v; }
      for (let q = 0; q + 1 < n; q += 2) {
        const i0 = Math.max(0, Math.ceil((row[q] - x0) / SP)), i1 = Math.min(NS - 1, Math.floor((row[q + 1] - x0) / SP));
        for (let i = i0, o = j * NS + i0; i <= i1; i++, o++) if (S[o] < roofY) S[o] = roofY;
      }
    }
  }
  function crossings(r, z, n) {
    for (let q = 0, m = r.length, p = m - 2; q < m; p = q, q += 2) {
      const za = r[p + 1], zb = r[q + 1];
      if ((za > z) !== (zb > z) && n < 256) row[n++] = r[p] + (z - za) / (zb - za) * (r[q] - r[p]);
    }
    return n;
  }

  // ---------- the scene as flat lists ----------
  // leaves: static meshes with a box that can be tested. always: anything that moves, is not a mesh, or asks not to be frustum culled (kept whole, children and all).
  // groups: the frozen nodes in between; a change in any of them is noticed the frame it happens and the lists are rebuilt before anything stale is drawn.
  const worldRoot = world ? scene.children.find(o => o.name === 'world') : null;
  let leaves = [], leafGroup = [], boxes = new Float32Array(0), always = [], groups = [], groupOk = new Uint8Array(0), groupParent = new Int32Array(0), groupKids = new Int32Array(0), groupLast = [], boxQueue = [];
  const isStaticRoot = o => o === worldRoot || (o.isGroup && /^props_/.test(o.name));
  function rebuild() {
    st.rebuilds++;
    if (worldRoot && worldRoot.matrixAutoUpdate) { worldRoot.updateMatrix(); worldRoot.matrixAutoUpdate = false; }
    leaves = []; leafGroup = []; always = []; groups = []; groupLast = []; boxQueue = [];
    const gp = [], gk = [];
    const addGroup = (o, parent) => { const n = groups.length; groups.push(o); gp.push(parent); gk.push(o.children.length); groupLast.push(o.children[o.children.length - 1]); return n; };
    const walk = (o, g, under) => {
      if (under && o.matrixAutoUpdate && o.isMesh && /^(far_|hills_)/.test(o.name)) { o.updateMatrix(); o.matrixAutoUpdate = false; }   // the far terrain and hill chunks never move; they were left out when the tile parts were frozen
      if (o.matrixAutoUpdate || !(o.isMesh || o.isGroup || o.type === 'Object3D')) { always.push(o); return; }
      if (o.matrixWorldNeedsUpdate) o.updateMatrixWorld(true);
      if (o.isMesh) {
        if (!o.frustumCulled || o.children.length || o.isSkinnedMesh) { always.push(o); return; }
        leaves.push(o); leafGroup.push(g); return;
      }
      const n = addGroup(o, g);
      for (const c of o.children) walk(c, n, under);
    };
    const r = addGroup(scene, -1);
    for (const c of scene.children) {
      if (isStaticRoot(c)) walk(c, r, c === worldRoot);
      else if (c.isMesh && !c.matrixAutoUpdate && c.frustumCulled && !c.children.length) { if (c.matrixWorldNeedsUpdate) c.updateMatrixWorld(true); leaves.push(c); leafGroup.push(r); }
      else always.push(c);
    }
    groupOk = new Uint8Array(groups.length); groupParent = Int32Array.from(gp); groupKids = Int32Array.from(gk);
    if (boxes.length < leaves.length * BOX) boxes = new Float32Array(leaves.length * 2 * BOX);
    subQueue.length = 0;
    for (let n = 0; n < leaves.length; n++) { boxes[n * BOX] = NaN; const l = leaves[n]; const bb = boxFor(l, n); if (!bb) boxQueue.push(n); if (l.userData.leanSub === undefined) subQueue.push(l); }
    st.leaves = leaves.length; st.groups = groups.length; st.always = always.length;
    staticsDirty = true;
  }
  const _box = new THREE.Box3(), _m = new THREE.Matrix4(), subQueue = [], st_ = { subs: 0 };
  function boxFor(l, n, again) {   // the world box of a leaf, kept on the leaf (the lists are rebuilt several times a second while tiles stream in); a big geometry's box is computed later, a little at a time, and the leaf stays visible until then
    const o = n * BOX; let c = l.userData.leanBox;
    if (!c || again) {
      const geo = l.geometry; let b;
      if (l.isInstancedMesh) { if (!geo.boundingBox) { if (geo.attributes.position.count > 20000) return false; geo.computeBoundingBox(); } l.computeBoundingBox(); l.userData.leanV = l.instanceMatrix.version * 65536 + l.count; b = l.boundingBox; }
      else { if (!geo.boundingBox) { if (geo.attributes.position && geo.attributes.position.count > 8000) return false; geo.computeBoundingBox(); } b = geo.boundingBox; }
      _box.copy(b); _box.applyMatrix4(l.matrixWorld);
      c = l.userData.leanBox = [_box.min.x, _box.min.z, _box.max.x, _box.max.z, _box.max.y, _box.min.y];
      if (again) { l.userData.leanSub = undefined; l.userData.leanJob = null; l.userData.leanLast = 0; l.userData.leanRuns = null; subQueue.push(l); }
    }
    boxes[o] = c[0]; boxes[o + 1] = c[1]; boxes[o + 2] = c[2]; boxes[o + 3] = c[3]; boxes[o + 4] = c[4]; boxes[o + 5] = c[5];
    return true;
  }
  // A single box round a 250 m chunk or a whole market catches one open street and the lot is drawn. So big leaves also get boxes per part of their area, each grown to hold whole triangles
  // or instances (none of them is cut, so there is no gap between them), and a leaf is hidden when every part is. The far terrain and far city change their index ranges as tiles come and go: they keep the one box.
  let frameNo = 0;
  const SUB_MIN = 96, SUB_DIV = 5, SUB_TRIS = 1500, MAX_TRIS_STEP = 40000;   // under SUB_TRIS triangles a draw costs less than testing its parts
  function subBoxes(l, budget) {
    const u = l.userData, geo = l.geometry, pos = geo.attributes.position;
    if (u.leanSub !== undefined) return budget;
    if (!pos || !pos.array) { u.leanSub = null; return budget; }   // (a tile mesh that has given up its arrays, src/world.js)
    const c = u.leanBox, tris = (geo.index ? geo.index.count : pos.count) / 3 * (l.isInstancedMesh ? l.count : 1);
    if (!c || tris < SUB_TRIS || (c[2] - c[0] < SUB_MIN && c[3] - c[1] < SUB_MIN) || /^(far_|hills_|farcity)/.test(l.name)) { u.leanSub = null; return budget; }
    let J = u.leanJob;
    if (!J) J = u.leanJob = { i: 0, cell: Math.max(32, Math.max(c[2] - c[0], c[3] - c[1]) / SUB_DIV), m: new Map() };
    const m = J.m, cell = J.cell, add = (cx, cz, x0, z0, x1, z1, y, yb) => {
      const k = Math.floor(cx / cell) * 65536 + Math.floor(cz / cell); let b = m.get(k);
      if (!b) { m.set(k, b = [x0, z0, x1, z1, y, yb]); b.part = m.size - 1; }
      else { if (x0 < b[0]) b[0] = x0; if (z0 < b[1]) b[1] = z0; if (x1 > b[2]) b[2] = x1; if (z1 > b[3]) b[3] = z1; if (y > b[4]) b[4] = y; if (yb < b[5]) b[5] = yb; }
      return b.part;
    };
    const P = pos.array, st = pos.itemSize, idx = geo.index ? geo.index.array : null;
    if (l.isInstancedMesh) {
      const A = l.instanceMatrix.array, gb = geo.boundingBox, n = l.count;
      for (; J.i < n; J.i++) {
        const o = J.i * 16; _m.fromArray(A, o); _box.copy(gb).applyMatrix4(_m);
        add((_box.min.x + _box.max.x) / 2, (_box.min.z + _box.max.z) / 2, _box.min.x, _box.min.z, _box.max.x, _box.max.z, _box.max.y, _box.min.y);
      }
    } else {
      const me = l.matrixWorld.elements, ox = me[12], oy = me[13], oz = me[14];
      if (me[0] !== 1 || me[5] !== 1 || me[10] !== 1 || me[1] || me[2] || me[4] || me[6] || me[8] || me[9]) { u.leanSub = null; u.leanJob = null; return budget; }
      const dr = geo.drawRange, n = idx ? idx.length : pos.count, end = Math.min(n, dr.start + (dr.count === Infinity ? n : dr.count));
      if (!J.i) J.i = dr.start;
      const whole = !!idx && dr.start === 0 && end === n && !geo.groups.length;   // an index can be sorted by part, so that only the parts in view are drawn
      if (whole && !J.tp) J.tp = new Uint16Array(n / 3);
      for (; J.i + 2 < end && budget > 0; J.i += 3, budget--) {
        const a = idx ? idx[J.i] : J.i, b = idx ? idx[J.i + 1] : J.i + 1, d = idx ? idx[J.i + 2] : J.i + 2;
        const ax = P[a * st], ay = P[a * st + 1], az = P[a * st + 2], bx = P[b * st], by = P[b * st + 1], bz = P[b * st + 2], dx = P[d * st], dy = P[d * st + 1], dz = P[d * st + 2];
        const part = add((ax + bx + dx) / 3 + ox, (az + bz + dz) / 3 + oz, Math.min(ax, bx, dx) + ox, Math.min(az, bz, dz) + oz, Math.max(ax, bx, dx) + ox, Math.max(az, bz, dz) + oz, Math.max(ay, by, dy) + oy, Math.min(ay, by, dy) + oy);
        if (whole) J.tp[J.i / 3] = part;
      }
      if (J.i + 2 < end) return budget;
      if (whole && m.size > 1 && on.parts) sortByPart(u, geo, J.tp, m.size);
    }
    const F = new Float32Array(m.size * BOX); let q = 0; for (const b of m.values()) { F[q] = b[0]; F[q + 1] = b[1]; F[q + 2] = b[2]; F[q + 3] = b[3]; F[q + 4] = b[4]; F[q + 5] = b[5]; q += BOX; }
    u.leanSub = F; u.leanJob = null; st_.subs++;
    return budget;
  }
  // The triangles of an indexed mesh in the order of their parts (within a part as they were), with where each part's run lies in the index. Each frame only the runs in view are drawn, as one draw.
  function sortByPart(u, geo, tp, parts) {
    const idx = geo.index.array, start = new Int32Array(parts), count = new Int32Array(parts);
    for (let t = 0; t < tp.length; t++) count[tp[t]] += 3;
    for (let p = 1; p < parts; p++) start[p] = start[p - 1] + count[p - 1];
    const put = start.slice(), out = new idx.constructor(idx.length);
    for (let t = 0; t < tp.length; t++) { const q = put[tp[t]]; put[tp[t]] = q + 3; out[q] = idx[t * 3]; out[q + 1] = idx[t * 3 + 1]; out[q + 2] = idx[t * 3 + 2]; }
    idx.set(out); geo.index.needsUpdate = true;
    // the array goes up again the next time this mesh is drawn; if src/world.js has freed the geometry's arrays by then, this one goes after that upload
    const ix = geo.index, was = ix.onUploadCallback;
    u.leanSorting = true;
    ix.onUpload(function () { was.call(this); u.leanSorting = false; if (u.freed) this.array = null; });
    u.leanRuns = { start, count, frame: -1, n: 0, firsts: new Int32Array(parts), counts: new Int32Array(parts) };
  }
  function boxStep() {   // the big ones, about a tile's worth of vertices a frame
    let left = 60000;
    while (boxQueue.length && left > 0) {
      const n = boxQueue.pop(), l = leaves[n], geo = l.geometry;
      if (!geo.boundingBox) { left -= geo.attributes.position.count; geo.computeBoundingBox(); }
      boxFor(l, n);
    }
    st.pendingBoxes = boxQueue.length;
    if (on.occ) {
      let budget = MAX_TRIS_STEP;
      while (subQueue.length && budget > 0) { const l = subQueue[subQueue.length - 1]; budget = subBoxes(l, budget); if (l.userData.leanSub !== undefined) subQueue.pop(); }
    }
  }
  function structureChanged() {
    for (let n = 0; n < groups.length; n++) {
      const o = groups[n], c = o.children;
      if (c.length !== groupKids[n] || c[c.length - 1] !== groupLast[n]) return true;
      if (n && o.parent !== groups[groupParent[n]]) return true;
    }
    return false;
  }

  // ---------- the fan of rays ----------
  const recD = new Float32Array((RAYS + 1) * REC), recS = new Float32Array((RAYS + 1) * REC), recN = new Int32Array(RAYS + 1);
  const _c = new THREE.Vector3(), _f = new THREE.Vector3();
  const sTop = new Float32Array(RAYS + 1), sBot = new Float32Array(RAYS + 1);   // per ray: the slope of the top and the bottom of the view along it
  const topA = new THREE.Vector3(), topB = new THREE.Vector3(), botA = new THREE.Vector3(), botB = new THREE.Vector3(), _nT = new THREE.Vector3(), _nB = new THREE.Vector3();
  let camX = 0, camY = 0, camZ = 0, fx = 0, fz = 1, X = 1, fanOK = false;
  function setupFan(cam) {
    cam.getWorldPosition(_c); camX = _c.x; camY = _c.y; camZ = _c.z;
    cam.getWorldDirection(_f);
    const h = Math.hypot(_f.x, _f.z);
    fanOK = h > 0.5; if (!fanOK) return;   // looking steeply up or down: no fan, everything is tested by three as usual
    fx = _f.x / h; fz = _f.z / h;
    // the four corners of the view, on the horizontal plane (a pitched camera sees wider than its forward slice) and in elevation
    const v = cam.projectionMatrixInverse.elements, w = cam.matrixWorld.elements; let mx = 0;
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
      const ww = v[3] * a + v[7] * b + v[11] + v[15], px = (v[0] * a + v[4] * b + v[8] + v[12]) / ww, py = (v[1] * a + v[5] * b + v[9] + v[13]) / ww, pz = (v[2] * a + v[6] * b + v[10] + v[14]) / ww;
      const dx = w[0] * px + w[4] * py + w[8] * pz, dy = w[1] * px + w[5] * py + w[9] * pz, dz = w[2] * px + w[6] * py + w[10] * pz;
      const f = dx * fx + dz * fz; if (f <= 0) { fanOK = false; return; }
      const r = dx * -fz + dz * fx; if (Math.abs(r / f) > mx) mx = Math.abs(r / f);
      (b > 0 ? a > 0 ? topA : topB : a > 0 ? botA : botB).set(dx, dy, dz);
    }
    X = mx * 1.02;
    _nT.crossVectors(topB, topA); _nB.crossVectors(botA, botB);   // the top and bottom planes of the view, through the eye. On a plane the slope along a horizontal direction is a straight sum, so it is known ray by ray
    const nearlyFlat = Math.abs(_nT.y) < 1e-4 * _nT.length() || Math.abs(_nB.y) < 1e-4 * _nB.length();
    let steps = 0;
    for (let e = 0; e <= RAYS; e++) {
      const sx = -X + 2 * X * e / RAYS, q = 1 / Math.sqrt(1 + sx * sx), dx = (fx - fz * sx) * q, dz = (fz + fx * sx) * q, base = e * REC;
      const top = nearlyFlat ? Infinity : -(_nT.x * dx + _nT.z * dz) / _nT.y + 0.002; sTop[e] = top; sBot[e] = nearlyFlat ? -Infinity : -(_nB.x * dx + _nB.z * dz) / _nB.y - 0.002;
      let n = 0, cur = -Infinity, gx0 = 1e9, gx1 = -1e9, gz0 = 0, gz1 = 0, g = null, open = false, step = NEAR_STEP;
      for (let d = 0; d < MAXR; d += step) {
        if (d >= NEAR_R) step = FAR_STEP;
        const x = camX + dx * d, z = camZ + dz * d;
        if (!(x >= gx0 && x < gx1 && z >= gz0 && z < gz1)) { const i = Math.floor(x / T), j = Math.floor(z / T); gx0 = i * T; gx1 = gx0 + T; gz0 = j * T; gz1 = gz0 + T; g = grids.get(key(i, j)) || null; }
        steps++;
        if (g === null) { open = true; continue; }
        const h = g[((z - gz0) / CELL | 0) * NC + ((x - gx0) / CELL | 0)];
        if (h === EMPTY || h !== h) { open = true; continue; }
        if (d < EYE_R) open = false;   // a solid this close may have the eye in it (the high camera in a narrow street stands in the buildings, and their walls are not drawn from inside): the first one a ray meets does not count
        if (!open) continue;
        const y = h - camY, sl = y >= 0 ? y / (d + CD) : y / Math.max(1, d - CD);
        if (sl > cur + 0.01) {
          cur = sl;
          if (n < REC) { recD[base + n] = d + CD; recS[base + n] = sl; n++; } else break;
          if (cur >= top) break;
        }
      }
      recN[e] = n;
    }
    st.steps = steps;
  }
  // 0 visible, 1 behind the walls, 2 outside the fan
  function test(B, o) {
    const x0 = B[o], z0 = B[o + 1], x1 = B[o + 2], z1 = B[o + 3], top = B[o + 4], bot = B[o + 5];
    const nx = camX < x0 ? x0 : camX > x1 ? x1 : camX, nz = camZ < z0 ? z0 : camZ > z1 ? z1 : camZ, ndx = nx - camX, ndz = nz - camZ, d0 = Math.sqrt(ndx * ndx + ndz * ndz);
    if (d0 < 1) return 0;
    let lo = Infinity, hi = -Infinity, behind = 0, far = 0;
    for (let c = 0; c < 4; c++) {
      const dx = (c & 1 ? x1 : x0) - camX, dz = (c & 2 ? z1 : z0) - camZ, f = dx * fx + dz * fz, dd = dx * dx + dz * dz;
      if (dd > far) far = dd;
      if (f <= 0.1) { behind++; continue; }
      const s = (dx * -fz + dz * fx) / f; if (s < lo) lo = s; if (s > hi) hi = s;
    }
    if (behind === 4) return 2;
    if (behind) return 0;   // across the camera plane: left to three
    if (hi < -X || lo > X) return 2;
    let e0 = Math.floor((lo + X) / (2 * X) * RAYS) - 1, e1 = Math.ceil((hi + X) / (2 * X) * RAYS) + 1;
    if (e0 < 0) e0 = 0; if (e1 > RAYS) e1 = RAYS;
    const y = top - camY, yb = bot - camY, fd = Math.sqrt(far), tan = y >= 0 ? y / d0 : y / fd, tanB = yb >= 0 ? yb / fd : yb / d0;
    for (let e = e0; e <= e1; e++) {
      // along this ray all of it above the top of the view or below its bottom: from the high camera that is the hills and the far city, drawn for nothing
      const st = sTop[e], t = tan < st ? tan : st;
      if (tan < sBot[e] || tanB > st) continue;
      const base = e * REC; let k = recN[e] - 1;
      if (k < 0 || recS[base + k] <= t) return 0;
      while (k >= 0 && recD[base + k] > d0) k--;
      if (k < 0 || recS[base + k] <= t) return 0;
    }
    return 1;
  }

  // The same with the parts of a big object: the whole box in view, is any part of it? U.leanLast: the part that was visible last frame goes first, it usually still is.
  function verdict(B, o, F, U) {
    const v = test(B, o); if (v !== 0 || !F) return v;
    const last = U.leanLast | 0;
    if (test(F, last) === 0) return 0;
    for (let q = 0; q < F.length; q += BOX) if (q !== last && test(F, q) === 0) { U.leanLast = q; return 0; }
    return 1;
  }

  // The parts of a mesh sorted by part: which runs of its index to draw this frame. Neighbouring runs in view join up.
  function pickRuns(B, o, F, R) {
    const v = test(B, o); if (v !== 0) return v;
    let n = 0, tot = 0;
    const { start, count, firsts, counts } = R;
    for (let p = 0, q = 0; q < F.length; p++, q += BOX) {
      if (test(F, q) !== 0) continue;
      tot += count[p];
      if (n && firsts[n - 1] + counts[n - 1] === start[p]) counts[n - 1] += count[p];
      else { firsts[n] = start[p]; counts[n] = count[p]; n++; }
    }
    if (!n) return 1;
    R.n = n; R.frame = frameNo; st.runTris += tot / 3; st.runWhole += (start[start.length - 1] + count[count.length - 1]) / 3;
    return 0;
  }

  // ---------- each frame, after the props' distance cull and before three walks the scene ----------
  const trueChildren = { saved: null }, flat = [];
  const hiddenNow = [];   // what occ removed this frame (read by the validator in tools/build/enginebench.mjs)
  const prevBR = scene.onBeforeRender, prevAR = scene.onAfterRender;
  scene.onBeforeRender = function (r, sc, cam, ...rest) {
    prevBR.call(this, r, sc, cam, ...rest);
    if (cam !== camera || api.bypass) return;
    const t0 = performance.now();
    if (!groups.length || structureChanged()) rebuild();
    if (boxQueue.length || subQueue.length) boxStep();
    groupOk[0] = 1;
    for (let n = 1; n < groups.length; n++) groupOk[n] = groups[n].visible && groupOk[groupParent[n]] ? 1 : 0;
    if (on.occ) {
      if (rasterQueue.length || rasterJob) { const t1 = performance.now(); rasterStep(1); st.rasterMs += performance.now() - t1; }
      st.grids = grids.size;
      const t2 = performance.now();
      setupFan(cam);
      const t3 = performance.now(); st.fanT += t3 - t2;
      flat.length = 0; hiddenNow.length = 0; frameNo++; st.runTris = 0; st.runWhole = 0;
      for (let n = 0; n < always.length; n++) {
        const a = always[n]; if (a.isInstancedMesh && a.count === 0) continue;   // an empty pool still costs three a full program setup
        const m = a.userData.leanMover;   // something that moves but stays inside known boxes (src/sea.js, the boats)
        if (m && fanOK && a.visible && verdict(m.box, 0, m.parts, m) !== 0) { hiddenNow.push(a); continue; }
        flat.push(a);
      }
      let hid = 0, out = 0, tested = 0;
      for (let n = 0; n < leaves.length; n++) {
        const l = leaves[n];
        if (l.matrixWorldNeedsUpdate) { l.updateMatrixWorld(true); boxFor(l, n, true); staticsDirty = true; }   // a frozen object that was moved
        if (!l.visible || !groupOk[leafGroup[n]]) continue;
        if (l.isInstancedMesh && l.userData.leanV !== l.instanceMatrix.version * 65536 + l.count) { boxFor(l, n, true); staticsDirty = true; }   // placed or knocked about since the box was made (markets lay their stalls out when they come into range): the box and the cached shadow follow
        const o = n * BOX;
        if (fanOK && boxes[o] === boxes[o]) {
          tested++;
          const U = l.userData, runs = U.leanRuns;
          const v = runs ? pickRuns(boxes, o, U.leanSub, runs) : verdict(boxes, o, U.leanSub, U);
          if (v === 1) { hid++; hiddenNow.push(l); continue; }
          if (v === 2) { out++; hiddenNow.push(l); continue; }
        }
        flat.push(l);
      }
      st.leafT += performance.now() - t3; st.fr++;
      st.tested = tested; st.hidden = hid; st.outside = out; st.drawn = flat.length - always.length;
      trueChildren.saved = scene.children; scene.children = flat;
    }
    st.cullMs = performance.now() - t0;
  };
  scene.onAfterRender = function (...a) { restore(); prevAR.apply(this, a); };
  const restore = () => { if (trueChildren.saved) { scene.children = trueChildren.saved; trueChildren.saved = null; } };

  // ---------- drawing only the runs in view ----------
  // Between three's own call and GL: its render of a mesh with runs picked this frame becomes a few plain draws with no state change in between, for the main view only.
  if (on.parts) {
    const gl0 = renderer.getContext(), de = gl0.drawElements.bind(gl0), rbd = renderer.renderBufferDirect;
    let cur = null;
    renderer.renderBufferDirect = function (c, sc, g, mat, ob, grp) {
      const R = ob.userData.leanRuns;
      cur = R && R.frame === frameNo && c === camera && !api.bypass && !api.wholeParts && !mat.isMeshDepthMaterial && !mat.isMeshDistanceMaterial ? R : null;
      rbd.call(this, c, sc, g, mat, ob, grp);
      cur = null;
    };
    gl0.drawElements = function (mode, cnt, type, off) {
      if (!cur) return de(mode, cnt, type, off);
      const R = cur, b = type === gl0.UNSIGNED_INT ? 4 : type === gl0.UNSIGNED_SHORT ? 2 : 1; cur = null;
      for (let i = 0; i < R.n; i++) de(mode, R.counts[i], type, R.firsts[i] * b);   // plain draws: WEBGL_multi_draw lost the 16-bit meshes (the ground) on an older iPhone
    };
  }

  // ---------- the matrix walk ----------
  if (on.walk) {
    const uwm = scene.updateMatrixWorld;
    scene.updateMatrixWorld = function (force) {
      if (force || !groups.length) return uwm.call(this, force);
      this.matrixWorldNeedsUpdate = false;
      for (let n = 0; n < always.length; n++) always[n].updateMatrixWorld();
      if (!on.occ) for (let n = 0; n < leaves.length; n++) if (leaves[n].matrixWorldNeedsUpdate) leaves[n].updateMatrixWorld(true);
    };
  }

  // ---------- front to back ----------
  if (on.sort) renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || cut(a.material) - cut(b.material) || a.z - b.z || a.id - b.id);

  // ---------- the cached shadow map ----------
  let origRender = null;
  const gl = renderer.getContext(), noop = () => {};
  const MOVE = 16, ANG = Math.cos(0.3 * Math.PI / 180), SLICES = 6, MAXAGE = 1000;   // a new static map when the car has gone 16 m (half a street) from the last one's centre, the sun has turned 0.3 degrees, or the world has changed
  let staticsDirty = true, liveRT = null, staticRT = null, pendRT = null, poseReady = false, statics = [], job = null, lastRefresh = -1e9, size = 0;
  const pose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
  const lightAt = () => { const l = new THREE.Object3D(); l.target = new THREE.Object3D(); l.isPointLight = false; l.name = 'lean'; return l; };
  const liveLight = lightAt(), pendLight = lightAt();
  pendLight.shadow = new THREE.DirectionalLight().shadow; liveLight.shadow = sun.shadow;
  const dynGroup = new THREE.Group(), staGroup = new THREE.Group();
  const mkRT = s => {
    const rt = new THREE.WebGLRenderTarget(s, s, { format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
    const d = new THREE.DepthTexture(s, s, THREE.UnsignedIntType); d.format = THREE.DepthFormat; d.compareFunction = THREE.LessEqualCompare; d.minFilter = d.magFilter = THREE.LinearFilter; rt.depthTexture = d;
    return rt;
  };
  function ensureMaps() {
    const s = sun.shadow.mapSize.x;
    if (s === size && sun.shadow.map === liveRT) return;
    size = s;
    for (const rt of [liveRT, staticRT, pendRT]) if (rt) { rt.depthTexture.dispose(); rt.dispose(); }
    if (sun.shadow.map && sun.shadow.map !== liveRT) { sun.shadow.map.depthTexture?.dispose(); sun.shadow.map.dispose(); }
    liveRT = mkRT(s); staticRT = mkRT(s); pendRT = mkRT(s);
    sun.shadow.map = liveRT; pendLight.shadow.map = pendRT; poseReady = false; job = null;
    const a = sun.shadow.camera, b = pendLight.shadow.camera;
    Object.assign(b, { left: a.left, right: a.right, top: a.top, bottom: a.bottom, near: a.near, far: a.far }); b.updateProjectionMatrix(); a.updateProjectionMatrix();
    pendLight.shadow.mapSize.copy(sun.shadow.mapSize); pendLight.shadow.bias = sun.shadow.bias; pendLight.shadow.normalBias = sun.shadow.normalBias;
    for (const rt of [liveRT, staticRT, pendRT]) renderer.initRenderTarget(rt);
  }
  const setLight = (l, p) => {
    l.matrixWorld.makeTranslation(p.x + p.dx, p.y + p.dy, p.z + p.dz);
    l.target.matrixWorld.makeTranslation(p.x, p.y, p.z);
  };
  // The centre lands on whole shadow texels of the light's view, so a new map at a new centre draws the same edges in the same places (three's own map slides under the texels every frame).
  function snapped(out, cx, cy, cz, dx, dy, dz) {
    const len = Math.hypot(dx, dy, dz), zx = dx / len, zy = dy / len, zz = dz / len;
    let rx = zz, rz = -zx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // up x z of three's lookAt, up = +y
    const ux = zy * rz, uy = zz * rx - zx * rz, uz = -zy * rx;
    const tx = (sun.shadow.camera.right - sun.shadow.camera.left) / size;
    const a = rx * cx + rz * cz, b = ux * cx + uy * cy + uz * cz, sa = parts.includes('nosnap') ? 0 : Math.round(a / tx) * tx - a, sb = parts.includes('nosnap') ? 0 : Math.round(b / tx) * tx - b;
    out.x = cx + rx * sa + ux * sb; out.y = cy + uy * sb; out.z = cz + rz * sa + uz * sb; out.dx = dx; out.dy = dy; out.dz = dz;
  }
  function collectStatics() {
    statics.length = 0;
    for (let n = 0; n < leaves.length; n++) { const l = leaves[n]; if (l.castShadow && l.visible && groupOk[leafGroup[n]]) statics.push(l); }
  }
  const shadowRender = function (lights, sc, cam) {
    restore();   // what occ took out of the main view may still cast a shadow into it
    if (this.autoUpdate === false && this.needsUpdate === false) return;
    if (!on.shadow || api.bypass || sc !== scene || !this.enabled || !lights.length || lights[0] !== sun || !groups.length) return origRender.call(this, lights, sc, cam);
    ensureMaps();
    const now = performance.now(), tx = sun.target.position, sx = sun.position.x - tx.x, sy = sun.position.y - tx.y, sz = sun.position.z - tx.z;
    const moved = !poseReady || Math.hypot(tx.x - pose.x, tx.z - pose.z) > MOVE;
    const turned = poseReady && (sx * pose.dx + sy * pose.dy + sz * pose.dz) / (Math.hypot(sx, sy, sz) * Math.hypot(pose.dx, pose.dy, pose.dz)) < ANG;
    if (!job && (moved || turned || (staticsDirty && now - lastRefresh > MAXAGE))) {
      job = { n: 0, pose: {}, first: true }; snapped(job.pose, tx.x, tx.y, tx.z, sx, sy, sz); setLight(pendLight, job.pose);
      collectStatics(); staticsDirty = false; st.statics = statics.length; lastRefresh = now;
    }
    const clear = renderer.clear;
    if (job) {   // a slice of the static casters into the map that is on its way; the very first map, or a jump, is drawn whole
      const per = poseReady ? Math.ceil(statics.length / SLICES) : statics.length;
      staGroup.children = statics.slice(job.n, job.n + per); job.n += per;
      if (!job.first) renderer.clear = noop;
      origRender.call(this, [pendLight], staGroup, cam);
      renderer.clear = clear; job.first = false;
      if (job.n >= statics.length) { const r = staticRT; staticRT = pendRT; pendRT = r; pendLight.shadow.map = pendRT; Object.assign(pose, job.pose); setLight(liveLight, pose); poseReady = true; job = null; st.refreshes++; }
    }
    if (!poseReady) return;
    // the static map, then what moves on top of it
    const P = renderer.properties, S = renderer.state;
    S.setScissorTest(false);
    S.bindFramebuffer(gl.READ_FRAMEBUFFER, P.get(staticRT).__webglFramebuffer);
    S.bindFramebuffer(gl.DRAW_FRAMEBUFFER, P.get(liveRT).__webglFramebuffer);
    gl.blitFramebuffer(0, 0, size, size, 0, 0, size, size, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    S.bindFramebuffer(gl.READ_FRAMEBUFFER, null); S.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    dynGroup.children = always;
    renderer.clear = noop;
    origRender.call(this, [liveLight], dynGroup, cam);
    renderer.clear = clear;
  };

  const hookShadows = () => { origRender = renderer.shadowMap.render; renderer.shadowMap.render = shadowRender; };
  hookShadows();
  // A lost GL context takes the render targets with it (phones can do this when the app goes to the background) and three comes back with a new shadow map object: hook it again, the maps start over.
  renderer.domElement.addEventListener('webglcontextrestored', () => { hookShadows(); liveRT = staticRT = pendRT = null; sun.shadow.map = null; pendLight.shadow.map = null; size = 0; poseReady = false; job = null; staticsDirty = true; });

  const api = {
    bypass: false,   // set by the bench: one render exactly as without this module (the whole scene, three's own shadow pass)
    wholeParts: false,   // set by the bench: draw every part of a mesh sorted by part
    parts: on,
    stats: () => ({ ...st, subs: st_.subs, subPending: subQueue.length }),
    hiddenNow,
    debug: { recN, recD, recS, grids, leaves: () => leaves, always: () => always, pose, view: () => ({ X, fanOK, camY, sTop, sBot }) },
  };
  return api;
}
