// Chase camera under ceilings. The camera sits behind and above the lapa, so a tunnel, a gate, a flyover or the stadium's entrance passage puts it inside the roof slab
// (the high camera is 7 m up, a flyover deck is 6 to 8 m, a gate vault 5 to 8 m) and the wall pull-in lifts it a further 2 m. This keeps the line from the car to the
// camera, and the camera itself, under whatever hangs over them; it looks ahead of the car, so the camera drops before the mouth and eases back out after it.
//
// The ceilings come from the models themselves, so a new gate or tunnel needs nothing registered: every landmark group (src/lmc-kit.js end(), src/landmarks.js) and every bridge,
// viaduct or tunnel group ("struct_...", src/bridges.js) near the car has its downward-facing triangles binned into 16 m
// tiles (a little each frame, under BUDGET_MS), and a tile is rasterised to 1 m cells the first time the camera asks about it, keeping the three lowest undersides of each
// cell. A query reads a handful of cells and wants three of the four neighbours to be ceiling too, so a pole, a rail, a lamp bracket or a tree (none of them covers that
// much of a 1 m grid) is ignored. The terrain and the generic buildings are not in the index (the wall pull-in and the ground clamp in src/vehicle.js cover those).
// ?noclear switches it off (before and after pictures).
import * as THREE from 'three';

const TILE = 16, TN = 16, SLOTS = 3;   // a tile is 16 m, rasterised to 16 x 16 one-metre cells
const MIN_UP = 2.4;                    // an underside lower than this over the car's floor is the deck it stands on or a parapet, not a ceiling
const WIN_LO = -40, WIN_HI = 14;       // undersides kept: height over the terrain at the triangle (a tunnel roof lies under the terrain; the stands' upper tiers are above the window)
const NEAR = 170, DOWN = 0.35;         // a group is indexed when the car is this close to it; a face counts as an underside when its normal points down this much
const BUDGET_MS = 0.8, AHEAD = 1.5;
const TS = [1, 0.5, 0.75, 0.3];        // samples along the line from the look point to the camera, the camera first
// the groups that are models of places: bridges and tunnels, the landmarks of src/landmarks.js ("landmark ...") and of src/lmc-kit.js end() (meshes named "<group>:<material>")
const isSrc = o => o.name !== '' && (o.name.startsWith('struct_') || o.name.startsWith('landmark ') || (o.children.length > 0 && o.children[0].name.startsWith(o.name + ':')));

export function createCameraClear({ scene, groundY }) {
  const off = location.search.includes('noclear');
  const groups = new Map();   // Object3D -> record
  let world = null, scanT = 9, seen = 0, ms = 0, frames = 0, worst = 0;
  const near = [], st = { h: 99, hh: 99, k: 1 }, _b = new THREE.Box3();

  function scan() {
    if (!world) world = scene.getObjectByName('world'); if (!world) return;
    seen++;
    const visit = o => {
      if (isSrc(o)) { let r = groups.get(o); if (!r) groups.set(o, r = { o, box: null, state: 0, mi: 0, ti: 0, meshes: null, tris: new Float32Array(9 * 2048), n: 0, bins: new Map(), ras: new Map(), n3: 0, seen }); r.seen = seen; return; }
      if (!o.isMesh) for (const c of o.children) visit(c);
    };
    visit(world);
    for (const [o, r] of groups) if (r.seen !== seen) groups.delete(o);
  }

  // bin the downward-facing triangles of a group (resumable: mesh index mi, triangle index ti); false when the time ran out
  function bin(r, deadline) {
    if (!r.meshes) { r.meshes = []; r.o.updateWorldMatrix(true, true); r.o.traverse(m => { if (m.isMesh && m.geometry.attributes.position && !m.isInstancedMesh && !m.isSkinnedMesh) r.meshes.push(m); }); }
    while (r.mi < r.meshes.length) {
      const m = r.meshes[r.mi], geo = m.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index, e = m.matrixWorld.elements;
      const ident = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
      const count = (idx ? idx.count : pos.count) / 3;
      for (; r.ti < count; r.ti++) {
        if ((r.ti & 127) === 0 && performance.now() > deadline) return false;
        const ia = idx ? idx.getX(r.ti * 3) : r.ti * 3, ib = idx ? idx.getX(r.ti * 3 + 1) : r.ti * 3 + 1, ic = idx ? idx.getX(r.ti * 3 + 2) : r.ti * 3 + 2;
        let ax = pos.getX(ia), ay = pos.getY(ia), az = pos.getZ(ia), bx = pos.getX(ib), by = pos.getY(ib), bz = pos.getZ(ib), cx = pos.getX(ic), cy = pos.getY(ic), cz = pos.getZ(ic);
        if (!ident) {
          let t = ax * e[0] + ay * e[4] + az * e[8] + e[12], u = ax * e[1] + ay * e[5] + az * e[9] + e[13], w = ax * e[2] + ay * e[6] + az * e[10] + e[14]; ax = t; ay = u; az = w;
          t = bx * e[0] + by * e[4] + bz * e[8] + e[12]; u = bx * e[1] + by * e[5] + bz * e[9] + e[13]; w = bx * e[2] + by * e[6] + bz * e[10] + e[14]; bx = t; by = u; bz = w;
          t = cx * e[0] + cy * e[4] + cz * e[8] + e[12]; u = cx * e[1] + cy * e[5] + cz * e[9] + e[13]; w = cx * e[2] + cy * e[6] + cz * e[10] + e[14]; cx = t; cy = u; cz = w;
        }
        // an underside: the stored normals when there are some (that is what the light sees), else the winding
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
        if (nl < 0.1) continue;   // a sliver: it covers no cell centre worth having
        if (!((nor && ident ? (nor.getY(ia) + nor.getY(ib) + nor.getY(ic)) / 3 : ny / nl) < -DOWN)) continue;
        const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
        if (x1 - x0 > 80 || z1 - z0 > 80) continue;
        const rel = (ay + by + cy) / 3 - groundY((ax + bx + cx) / 3, (az + bz + cz) / 3);
        if (!(rel > WIN_LO && rel < WIN_HI)) continue;
        if ((r.n + 1) * 9 > r.tris.length) { const t = new Float32Array(r.tris.length * 2); t.set(r.tris); r.tris = t; }
        const o = r.n * 9, T = r.tris; T[o] = ax; T[o + 1] = ay; T[o + 2] = az; T[o + 3] = bx; T[o + 4] = by; T[o + 5] = bz; T[o + 6] = cx; T[o + 7] = cy; T[o + 8] = cz;
        for (let i = Math.floor(x0 / TILE); i <= Math.floor(x1 / TILE); i++) for (let j = Math.floor(z0 / TILE); j <= Math.floor(z1 / TILE); j++) { const k = i * 65536 + j; let l = r.bins.get(k); if (!l) r.bins.set(k, l = []); l.push(r.n); }
        r.n++;
      }
      r.mi++; r.ti = 0;
    }
    r.state = 2; r.meshes = null;
    return true;
  }

  // one 16 m tile of a group to cells: the SLOTS lowest undersides over each cell centre
  function tile(r, i, j) {
    const key = i * 65536 + j; let R = r.ras.get(key); if (R) return R;
    R = new Float32Array(TN * TN * SLOTS).fill(Infinity); r.ras.set(key, R);
    const list = r.bins.get(key); if (!list) return R;
    const X0 = i * TILE, Z0 = j * TILE, T = r.tris;
    for (const id of list) {
      const o = id * 9, ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(det) < 1e-6) continue;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - X0)), i1 = Math.min(TN - 1, Math.floor(Math.max(ax, bx, cx) - X0));
      const j0 = Math.max(0, Math.floor(Math.min(az, bz, cz) - Z0)), j1 = Math.min(TN - 1, Math.floor(Math.max(az, bz, cz) - Z0));
      for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const px = X0 + ii + 0.5, pz = Z0 + jj + 0.5;
        const l0 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det, l1 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det, l2 = 1 - l0 - l1;
        if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
        const y = l0 * ay + l1 * by + l2 * cy, c = (jj * TN + ii) * SLOTS;
        let s = 0; while (s < SLOTS && R[c + s] < y - 0.15) s++;   // sorted; coplanar duplicates (the two faces of a slab) collapse into one
        if (s < SLOTS && Math.abs(R[c + s] - y) > 0.15) { for (let q = SLOTS - 1; q > s; q--) R[c + q] = R[c + q - 1]; R[c + s] = y; }
      }
    }
    r.n3++;
    return R;
  }

  // the lowest underside over (x, z) that is at least MIN_UP over `floor`, Infinity when there is none
  function cell(x, z, floor) {
    let best = Infinity;
    for (const r of near) {
      const b = r.box; if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      const fi = Math.floor(x / TILE), fj = Math.floor(z / TILE), R = tile(r, fi, fj), c = (Math.floor(z - fj * TILE) * TN + Math.floor(x - fi * TILE)) * SLOTS;
      for (let s = 0; s < SLOTS; s++) { const y = R[c + s]; if (y >= floor + MIN_UP) { if (y < best) best = y; break; } }
    }
    return best;
  }
  // ... and only where it is a real roof: three of the four cells around have one within 2.5 m of it (a vault falls away steeply at its sides); the lowest of them
  function roof(x, z, floor) {
    const c = cell(x, z, floor); if (c === Infinity) return c;
    let n = 0, lo = c;
    for (let q = 0; q < 4; q++) { const d = cell(x + (q === 0 ? 1 : q === 1 ? -1 : 0), z + (q === 2 ? 1 : q === 3 ? -1 : 0), floor); if (Math.abs(d - c) < 2.5) { n++; if (d < lo) lo = d; } }
    return n >= 3 ? lo : Infinity;   // (the lowest of the five: the camera is not a point, and a vault falls away at its sides)
  }

  // the highest the camera may be at fraction k of its offset (rx, rz) from the look point (ox, oy, oz): the line to it and the camera itself stay under the roofs
  function room(ox, oz, oy, rx, rz, k, floor, mCam, ns) {
    let lim = Infinity;
    for (let i = 0; i < ns; i++) {
      const t = TS[i], c = roof(ox + rx * k * t, oz + rz * k * t, floor); if (c === Infinity) continue;
      const l = oy + (c - (i === 0 ? mCam : 0.3) - oy) / t; if (l < lim) lim = l;
    }
    return lim;
  }

  // p: the camera position the chase code wants (changed in place); gy: the floor under the car; extra: the shake and hop that are added after this
  function apply(p, car, gy, dt, extra) {
    if (off) return;
    const t0 = performance.now();
    if ((scanT += dt) > 0.5) { scanT = 0; scan(); }
    near.length = 0;
    for (const r of groups.values()) {
      if (!r.box) { _b.setFromObject(r.o); if (_b.isEmpty()) continue; r.box = _b.clone().expandByScalar(1); }
      const b = r.box; if (car.x < b.min.x - NEAR || car.x > b.max.x + NEAR || car.z < b.min.z - NEAR || car.z > b.max.z + NEAR) continue;
      if (r.state < 2) { r.state = 1; if (!bin(r, t0 + BUDGET_MS)) continue; }   // indexed a little each frame: until then it is simply not a ceiling
      near.push(r);
    }
    const h0 = p.y - gy;
    if (!near.length) { st.h = st.hh = Math.max(st.h, h0 + 2); st.k = 1; track(t0); return; }
    const ox = car.x, oz = car.z, oy = gy + 1.3, rx = p.x - ox, rz = p.z - oz, mCam = 0.8 + extra;
    // now, and every 1.5 m of the way the car will cover in the next 1.2 s (a gate's wall is 2 m deep, a step of seconds would step over it): the camera is already lower when it gets there
    const v = Math.hypot(car.vx, car.vz), ux = v > 3 ? car.vx / v : 0, uz = v > 3 ? car.vz / v : 0, reach = v > 3 ? Math.min(40, v * 1.2) : 0;
    let y0 = room(ox, oz, oy, rx, rz, 1, gy, mCam, 4), hT = y0;
    for (let a = AHEAD; a <= reach; a += AHEAD) { const lim = room(ox + ux * a, oz + uz * a, oy, rx, rz, 1, gy, mCam, 2); if (lim < hT) hT = lim; }
    // down in about half a second, back up a little slower; lower also means a little nearer, the more it has had to give up
    const want = Math.min(hT - gy, h0 + 2);
    st.h += (want - st.h) * (1 - Math.exp(-(want < st.h ? 4.5 : 2.2) * dt));
    const kc = Math.max(0.55, 1 - 0.09 * Math.max(0, h0 - st.h));
    st.k += (kc - st.k) * (1 - Math.exp(-(kc < st.k ? 4.5 : 2.2) * dt));
    const k = Math.min(st.k, 1);
    const hard = k < 0.999 ? room(ox, oz, oy, rx, rz, k, gy, mCam, 4) : y0;   // whatever the smoothing says, the camera at its real place is under the roof: down at once, back up over a third of a second
    const hr = Math.min(hard - gy, h0 + 2);
    st.hh = hr < st.hh ? hr : st.hh + (hr - st.hh) * (1 - Math.exp(-3 * dt));
    const y = Math.min(p.y, gy + st.h, gy + st.hh);
    if (k < 0.999) { p.x = ox + rx * k; p.z = oz + rz * k; }
    p.y = Math.min(p.y, Math.max(y, gy + 1.4));
    track(t0);
  }
  function track(t0) { const d = performance.now() - t0; ms += d; frames++; if (d > worst) worst = d; }
  const api = {
    apply,
    roofAt: (x, z, floor) => roof(x, z, floor),   // test hook
    stats() { const g = [...groups.values()], s = { groups: g.length, indexed: g.filter(r => r.state === 2).length, tris: g.reduce((a, r) => a + r.n, 0), tiles: g.reduce((a, r) => a + r.n3, 0), avgMs: frames ? ms / frames : 0, worstMs: worst, frames }; ms = 0; frames = 0; worst = 0; return s; },
  };
  if (location.search.includes('debug')) window.__camClear = api;   // test hook: api.stats() is the cost per frame and what is indexed
  return api;
}
