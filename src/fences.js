// Walls and fences of the world tiles (tile.fences from tools/fences.py: OSM barrier ways and the Regione Siciliana CTR walls).
//
//   * walls (kinds w wall, d dry-stone, r retaining, c city wall, j concrete barrier): one merged mesh per tile, solid. Their pieces go into
//     the wall grid, so cars, traffic and pedestrians all stop at them. Retaining walls read their height off the ground on both sides.
//   * fences (f, g guard rail): 2.5 m panels in at most three instanced meshes per tile (railing, wooden, mesh: alpha-tested textures), also in the
//     wall grid, tagged with their panel (seg.fn). A car that meets one at breakSpeed or more (the sphere and classic collide() ask
//     hooks.breakFence before pushing back) smashes it: the panel flies off as a spinning piece, the gap stays for the rest of the session (the
//     `broken` set survives a tile being unloaded and loaded again). Slower, a fence is a wall.
// Everything is baked at full detail only (like the building walls); the draw cost is four calls per tile at most.
import * as THREE from 'three';
import { Buf, groundY, hooks } from './core.js';

const BREAK_SPEED = 3.0, PANEL = 2.5, MAX_PANELS = 1400, POOL = 10;
const KIND = {
  w: { th: 0.35, col: ['#d1c4a2', '#c8b992', '#bcae8f', '#d8cdb0', '#c2b59a'] },
  d: { th: 0.55, col: ['#a49e8c', '#97917f', '#aaa38f'] },
  r: { th: 0.5, col: ['#a8a397', '#9c978b', '#b0aa9c'] },
  c: { th: 1.3, col: ['#b9a070', '#b09768'] },
  j: { th: 0.55, col: ['#b9b7ae'] },
};
const rnd01 = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

let wallGrid = null, root = null;
const broken = new Set();          // ids of smashed panels, for the session
export function initFences({ wall, scene }) { wallGrid = wall; root = scene; }

// ---------- panel textures and geometry ----------
const STYLE = [
  { name: 'railing', draw: (g, W, H) => { g.fillStyle = '#2d2f2e'; for (let x = 6; x < W; x += 9) g.fillRect(x, 6, 3, H - 8); g.fillRect(0, 4, W, 5); g.fillRect(0, H * 0.55, W, 3); } },
  { name: 'wooden', draw: (g, W, H) => { for (let x = 6; x < W; x += 15) { g.fillStyle = (x / 15 | 0) % 2 ? '#7d5c3b' : '#6e5033'; g.fillRect(x, 2, 11, H - 2); } g.fillStyle = '#5a4128'; g.fillRect(0, H * 0.25, W, 4); g.fillRect(0, H * 0.7, W, 4); } },
  { name: 'mesh', draw: (g, W, H) => { g.strokeStyle = '#7d8286'; g.lineWidth = 1.6; for (let k = -H; k < W + H; k += 10) { g.beginPath(); g.moveTo(k, H); g.lineTo(k + H, 0); g.stroke(); g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke(); } g.fillStyle = '#5b6064'; g.fillRect(0, 0, W, 4); g.fillRect(0, H - 3, W, 3); } },
];
let GEO = null, MAT = null;
function panelAssets() {
  if (GEO) return;
  MAT = STYLE.map(s => {
    const W = 128, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.clearRect(0, 0, W, H); s.draw(g, W, H);
    g.fillStyle = '#4a4d4c'; g.fillRect(0, 0, 3, H);                       // an opaque column: the posts sample it
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  });
  const p = [], uv = [], idx = [];
  const quad = (a, b, c, d, u) => { const o = p.length / 3; p.push(...a, ...b, ...c, ...d); uv.push(...u); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const h = PANEL / 2;
  quad([-h, 0, 0], [h, 0, 0], [h, 1, 0], [-h, 1, 0], [0.04, 0, 1, 0, 1, 1, 0.04, 1]);
  for (const x of [-h + 0.04, h - 0.04]) {   // posts: two thin crossed slabs each
    quad([x - 0.04, 0, 0], [x + 0.04, 0, 0], [x + 0.04, 1.04, 0], [x - 0.04, 1.04, 0], [0.01, 0.5, 0.01, 0.5, 0.01, 0.5, 0.01, 0.5]);
    quad([x, 0, -0.04], [x, 0, 0.04], [x, 1.04, 0.04], [x, 1.04, -0.04], [0.01, 0.5, 0.01, 0.5, 0.01, 0.5, 0.01, 0.5]);
  }
  GEO = new THREE.BufferGeometry();
  GEO.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  GEO.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  GEO.setIndex(idx); GEO.computeVertexNormals();
}

// ---------- smashed panels in flight ----------
const flyers = [];                 // { st, x, y, z, vx, vy, vz, yaw, wy, tilt, wt, len, h, age }
let pools = null;
function flyPool() {
  if (pools) return pools;
  panelAssets();
  pools = STYLE.map((s, i) => { const m = new THREE.InstancedMesh(GEO, MAT[i], POOL); m.count = 0; m.frustumCulled = false; m.name = 'fence_debris_' + s.name; root.add(m); return m; });
  return pools;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function writeFlyers() {
  const P = flyPool(), n = [0, 0, 0];
  for (const f of flyers) {
    const m = P[f.st]; if (n[f.st] >= POOL) continue;
    _e.set(f.tilt, f.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(f.x, f.y, f.z); _s.set(f.len / PANEL, f.h, 1);
    m.setMatrixAt(n[f.st]++, _m.compose(_p, _q, _s));
  }
  for (let i = 0; i < 3; i++) { P[i].count = n[i]; P[i].instanceMatrix.needsUpdate = true; }
}
export function tickFences(dt) {
  if (!flyers.length) return;
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.age += dt; f.vy -= 9.8 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt;
    f.yaw += f.wy * dt; f.tilt += f.wt * dt;
    const g = groundY(f.x, f.z);
    if (f.y < g + 0.05) { f.y = g + 0.05; f.vy *= -0.25; f.vx *= 0.7; f.vz *= 0.7; f.wy *= 0.6; f.wt *= 0.5; if (f.tilt > 1.4) f.tilt = 1.5; }
    if (f.age > 6) flyers.splice(i, 1);
  }
  writeFlyers();
}

// ---------- the collision hook ----------
// seg: a wall-grid segment carrying .fn (its panel); vs: the car's speed into it (m/s); (nx, nz): from the wall to the car.
function breakFence(seg, vs, nx, nz, car) {
  const f = seg.fn; if (!f || f.gone || vs < BREAK_SPEED) return false;
  f.gone = true; broken.add(f.id);
  seg[0] = seg[1] = seg[2] = seg[3] = 1e7;                       // out of every query: the gap stays open
  const tile = f.tile; if (tile) { const m = tile.mesh[f.st]; _m.makeScale(0, 0, 0); m.setMatrixAt(f.i, _m); m.instanceMatrix.needsUpdate = true; }
  const sp = Math.hypot(car.vx, car.vz);
  flyers.push({ st: f.st, x: f.x, y: f.y, z: f.z, vx: -nx * (2.5 + vs * 0.5) + car.vx * 0.35, vz: -nz * (2.5 + vs * 0.5) + car.vz * 0.35, vy: 3 + Math.min(5, vs * 0.45),
    yaw: f.yaw, wy: (rnd01(f.x, f.z) - 0.5) * 9, tilt: 0, wt: 3 + sp * 0.2, len: f.len, h: f.h, age: 0 });
  if (flyers.length > POOL * 3) flyers.shift();
  car.vx += nx * vs * 0.22; car.vz += nz * vs * 0.22;            // the panel takes a little speed with it
  if (car.vf !== undefined) car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
  try { dispatchEvent(new CustomEvent('pd-fence', { detail: { x: f.x, z: f.z } })); } catch (e) { /* no events */ }
  return true;
}
hooks.breakFence = breakFence;
hooks.tick = tickFences;

// ---------- building a tile ----------
const hh = Math.hypot;
function resample(p, step) { // flat polyline -> points about `step` apart (at most 20 % longer), keeping the corners
  const out = [[p[0], p[1]]];
  for (let k = 2; k < p.length; k += 2) {
    const ax = p[k - 2], az = p[k - 1], bx = p[k], bz = p[k + 1], n = Math.max(1, Math.round(hh(bx - ax, bz - az) / step));
    for (let i = 1; i <= n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]);
  }
  return out;
}

const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofences');   // ?nofences: debug, the world as it was before walls and fences
export function* buildFences(list, key) {
  if (!list || !list.length || !wallGrid || OFF) return null;
  panelAssets();
  const group = new THREE.Group(); group.name = 'fences';
  const wall = new Buf(), panels = [[], [], []];
  let nPanels = 0, n = 0;
  const tk = 'f' + key;
  const addSeg = (ax, az, bx, bz, fn) => { const s = [ax, az, bx, bz]; if (fn) s.fn = fn; wallGrid.addSeg(tk, s, ax, az, bx, bz); };
  for (let li = 0; li < list.length; li++) {
    const r = list[li], pts = resample(r.p, r.k === 'f' || r.k === 'g' ? PANEL : 4);
    if ((++n & 7) === 0) yield;
    if (r.k === 'f' || r.k === 'g') {
      const st = r.k === 'g' ? 0 : r.s || 0;
      for (let i = 0; i + 1 < pts.length && nPanels < MAX_PANELS; i++) {
        const a = pts[i], b = pts[i + 1], len = hh(b[0] - a[0], b[1] - a[1]); if (len < 0.6) continue;
        const id = key + ':' + li + ':' + i; if (broken.has(id)) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        const f = { id, st, x: mx, z: mz, y: groundY(mx, mz) - 0.04, yaw, len, h: r.h, i: panels[st].length, tile: null, gone: false };
        panels[st].push(f); nPanels++;
        addSeg(a[0], a[1], b[0], b[1], f);
      }
      continue;
    }
    // solid walls
    const K = KIND[r.k] || KIND.w, hw = K.th / 2, base = new THREE.Color(K.col[(rnd01(r.p[0], r.p[1]) * K.col.length) | 0]);
    const top = new THREE.Color().copy(base).multiplyScalar(1.12), foot = 0.78;
    const V = pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = hh(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const g = groundY(q[0], q[1]);
      let y0 = g - 0.45, y1 = g + r.h;
      if (r.k === 'r') { const gl = groundY(q[0] + nx * 1.6, q[1] + nz * 1.6), gr = groundY(q[0] - nx * 1.6, q[1] - nz * 1.6); y0 = Math.min(gl, gr, g) - 0.4; y1 = Math.max(gl, gr, g) + 0.3; if (y1 - y0 < 1.4) y1 = y0 + 1.4; }
      return { x: q[0], z: q[1], nx, nz, y0, y1 };
    });
    for (let i = 0; i + 1 < V.length; i++) {
      const a = V[i], b = V[i + 1];
      const L = [[a.x + a.nx * hw, a.z + a.nz * hw], [b.x + b.nx * hw, b.z + b.nz * hw]], R = [[a.x - a.nx * hw, a.z - a.nz * hw], [b.x - b.nx * hw, b.z - b.nz * hw]];
      const v = (x, y, z, nx, ny, nz, c, k) => wall.v(x, y, z, nx, ny, nz, c, 0, 0, k);
      const side = (P, s) => { // one long face, normal s * n
        const nx = a.nx * s, nz = a.nz * s;
        for (const [x, y, z, k, c] of [[P[0][0], a.y0, P[0][1], foot, base], [P[1][0], b.y0, P[1][1], foot, base], [P[1][0], b.y1, P[1][1], 1, base], [P[0][0], a.y0, P[0][1], foot, base], [P[1][0], b.y1, P[1][1], 1, base], [P[0][0], a.y1, P[0][1], 1, base]])
          v(x, y, z, nx, 0, nz, c, k);
      };
      side(L, 1);                                          // left face (the material is double sided, so winding does not matter)
      // right face, then the cap
      const nxR = -a.nx, nzR = -a.nz;
      for (const [x, y, z, k] of [[R[1][0], b.y0, R[1][1], foot], [R[0][0], a.y0, R[0][1], foot], [R[0][0], a.y1, R[0][1], 1], [R[1][0], b.y0, R[1][1], foot], [R[0][0], a.y1, R[0][1], 1], [R[1][0], b.y1, R[1][1], 1]]) v(x, y, z, nxR, 0, nzR, base, k);
      for (const [x, y, z] of [[L[0][0], a.y1, L[0][1]], [L[1][0], b.y1, L[1][1]], [R[1][0], b.y1, R[1][1]], [L[0][0], a.y1, L[0][1]], [R[1][0], b.y1, R[1][1]], [R[0][0], a.y1, R[0][1]]]) v(x, y, z, 0, 1, 0, top, 1);
      const len = hh(b.x - a.x, b.z - a.z); if (len > 0.3) addSeg(a.x, a.z, b.x, b.z, null);
    }
  }
  if (wall.p.length) {
    const m = wall.mesh(WALL_MAT || (WALL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  const rec = { mesh: [null, null, null] };
  for (let s = 0; s < 3; s++) {
    const L = panels[s]; if (!L.length) continue;
    const m = new THREE.InstancedMesh(GEO, MAT[s], L.length); m.receiveShadow = true; m.frustumCulled = true;
    L.forEach((f, i) => {
      _e.set(0, f.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(f.x, f.y, f.z); _s.set(f.len / PANEL, f.h, 1);
      m.setMatrixAt(i, _m.compose(_p, _q, _s)); f.tile = rec;
    });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); rec.mesh[s] = m; group.add(m);
  }
  group.userData.tris = (wall.p.length / 9) + nPanels * 10;
  group.userData.panels = nPanels;
  return group;
}
let WALL_MAT = null;

export function dropFences(key) { if (wallGrid) wallGrid.removeTile('f' + key); }
export const fenceStats = () => ({ broken: broken.size, flying: flyers.length });
