// Walls and fences of the world tiles (tile.fences from tools/fences.py: OSM barrier ways and the Regione Siciliana CTR walls).
//
//   * walls (kinds w wall, d dry-stone, r retaining, c city wall, j concrete barrier, h hedge): one merged mesh per tile. Their pieces go into
//     the wall grid, so cars, traffic and pedestrians all stop at them. Retaining walls read their height off the ground on both sides.
//     Garden and parcel walls (w, d) and hedges (h) are breakable like fences, in 4 m pieces, above a speed that grows with the mass (hedge 2.6 m/s, dry-stone 5.2,
//     wall 6.4 / 8 / 9.5 m/s by height): the piece's quads are collapsed in the tile mesh and flying chunks (stone, plaster) or a puff of leaves and clumps take its place.
//     Retaining walls, city walls and concrete barriers hold up ground or are too heavy and stay solid, so do the walls of buildings and landmarks (not in this file).
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
  h: { th: 0.95, col: ['#4c6b34', '#44622f', '#55723a', '#3e5c2d'] },   // hedges: a green block (solid)
};
const thrFor = (k, h) => k === 'h' ? 2.6 : k === 'd' ? 5.2 : h < 1.9 ? 6.4 : h < 2.4 ? 8.0 : 9.5;   // m/s into the piece; the fence panels break at BREAK_SPEED
const LOSS = { hedge: 0.12, low: 0.26, wall: 0.38 };            // share of the closing speed the car loses to a broken piece
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
// chunks of a broken wall and leaves of a broken hedge: two small instanced pools shared by the whole world
const CH = 150, LF = 240;
let chunkIM = null, leafIM = null;
const chunks = [], leafs = []; let chunkN = 0, leafN = 0, poolsDirty = false;
function debrisPools() {
  if (chunkIM) return;
  chunkIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }), CH); chunkIM.count = CH; chunkIM.frustumCulled = false; chunkIM.name = 'wall_debris'; chunkIM.castShadow = false;
  leafIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), LF); leafIM.count = LF; leafIM.frustumCulled = false; leafIM.name = 'hedge_debris';
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < CH; i++) { chunkIM.setMatrixAt(i, _m); chunkIM.setColorAt(i, _c.set('#ffffff')); }
  for (let i = 0; i < LF; i++) { leafIM.setMatrixAt(i, _m); leafIM.setColorAt(i, _c.set('#ffffff')); }
  root.add(chunkIM); root.add(leafIM);
}
const _c = new THREE.Color();
function spawnChunk(x, y, z, vx, vy, vz, sx, sy, sz, col, life) {
  const i = chunkN++ % CH; chunks[i] = { i, x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 12, wy: (Math.random() - 0.5) * 12, sx, sy, sz, age: 0, life, on: true };
  chunkIM.setColorAt(i, col); chunkIM.instanceColor.needsUpdate = true; poolsDirty = true;
}
function spawnLeaf(x, y, z, vx, vy, vz, s, col, life) {
  const i = leafN++ % LF; leafs[i] = { i, x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14, s, age: 0, life, on: true };
  leafIM.setColorAt(i, col); leafIM.instanceColor.needsUpdate = true; poolsDirty = true;
}
function stepDebris(dt) {
  if (!chunkIM) return;
  let any = false;
  for (const f of chunks) {
    if (!f || !f.on) continue; any = true;
    f.age += dt; f.vy -= 9.8 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.rx += f.wx * dt; f.ry += f.wy * dt;
    const g = groundY(f.x, f.z) + f.sy * 0.5;
    if (f.y < g) { f.y = g; f.vy *= -0.3; f.vx *= 0.65; f.vz *= 0.65; f.wx *= 0.5; f.wy *= 0.5; }
    if (f.age > f.life) { f.on = false; _m.makeScale(0, 0, 0); } else { _e.set(f.rx, f.ry, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(f.x, f.y, f.z); const k = Math.min(1, (f.life - f.age) * 2); _s.set(f.sx * k, f.sy * k, f.sz * k); _m.compose(_p, _q, _s); }
    chunkIM.setMatrixAt(f.i, _m);
  }
  for (const f of leafs) {
    if (!f || !f.on) continue; any = true;
    f.age += dt; f.vy -= 4.5 * dt; f.vx *= 1 - 0.8 * dt; f.vz *= 1 - 0.8 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.rx += f.wx * dt; f.ry += f.wy * dt;
    const g = groundY(f.x, f.z) + 0.03;
    if (f.y < g) { f.y = g; f.vy = 0; f.vx *= 0.6; f.vz *= 0.6; f.wx *= 0.4; f.wy *= 0.4; }
    if (f.age > f.life) { f.on = false; _m.makeScale(0, 0, 0); } else { _e.set(f.rx, f.ry, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(f.x, f.y, f.z); const k = Math.min(1, (f.life - f.age) * 2); _s.set(f.s * k, f.s * k, f.s * k); _m.compose(_p, _q, _s); }
    leafIM.setMatrixAt(f.i, _m);
  }
  if (any || poolsDirty) { chunkIM.instanceMatrix.needsUpdate = true; leafIM.instanceMatrix.needsUpdate = true; poolsDirty = false; }
}
export function tickFences(dt) {
  stepDebris(dt);
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

// a broken wall piece or hedge piece: the quads are collapsed in the tile mesh, chunks or leaves fly
const LEAFCOL = ['#4a7a30', '#5f8a3a', '#7aa04a', '#3f6a2a'].map(h => new THREE.Color(h));
function breakWall(f, vs, nx, nz, car) {
  f.gone = true; broken.add(f.id);
  const m = f.tile && f.tile.wall; if (m) { const pos = m.geometry.attributes.position; for (let i = f.v0; i < f.v1; i++) pos.setXYZ(i, f.x, f.y, f.z); pos.needsUpdate = true; }
  debrisPools();
  const k = 2 + vs * 0.45, hedge = f.kind === 'hedge', n = hedge ? 5 : 9;
  for (let q = 0; q < n; q++) {   // chunks (a hedge: green clumps of twigs)
    const t = (q + Math.random()) / n - 0.5, x = f.x + f.dx * t * f.len, z = f.z + f.dz * t * f.len, y = f.y + 0.2 + Math.random() * Math.max(0.5, f.h - 0.3), sz = hedge ? 0.5 + Math.random() * 0.5 : 0.22 + Math.random() * 0.4;
    const col = (hedge ? LEAFCOL[(Math.random() * 4) | 0] : f.col).clone().multiplyScalar(0.85 + Math.random() * 0.25);
    spawnChunk(x, y, z, -nx * k * (0.4 + Math.random() * 0.8) + car.vx * 0.35 + (Math.random() - 0.5) * 3, 2 + Math.random() * 4 + vs * 0.15, -nz * k * (0.4 + Math.random() * 0.8) + car.vz * 0.35 + (Math.random() - 0.5) * 3,
      sz * (0.8 + Math.random() * 0.6), sz * (0.6 + Math.random() * 0.6), sz * (0.8 + Math.random() * 0.6), col, hedge ? 3.2 + Math.random() * 1.5 : 3.8 + Math.random() * 2);
  }
  if (hedge) for (let q = 0; q < 26; q++) {   // a puff of leaves
    const t = Math.random() - 0.5, x = f.x + f.dx * t * f.len, z = f.z + f.dz * t * f.len;
    spawnLeaf(x, f.y + 0.3 + Math.random() * f.h, z, -nx * k * Math.random() * 0.7 + (Math.random() - 0.5) * 4, 1 + Math.random() * 3.5, -nz * k * Math.random() * 0.7 + (Math.random() - 0.5) * 4, 0.22 + Math.random() * 0.2, LEAFCOL[(Math.random() * 4) | 0], 2.4 + Math.random() * 2);
  }
  else for (let q = 0; q < 8; q++) {   // and dust-coloured flakes
    spawnLeaf(f.x + (Math.random() - 0.5) * f.len, f.y + Math.random() * f.h, f.z + (Math.random() - 0.5) * f.len, -nx * k * Math.random() * 0.5 + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.5, -nz * k * Math.random() * 0.5 + (Math.random() - 0.5) * 3, 0.14 + Math.random() * 0.14, f.col, 1.4 + Math.random());
  }
  const loss = LOSS[f.kind === 'hedge' ? 'hedge' : f.kind === 'low' ? 'low' : 'wall'];
  car.vx += nx * vs * loss; car.vz += nz * vs * loss;
  if (car.vf !== undefined) car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
  try { dispatchEvent(new CustomEvent('pd-fence', { detail: { x: f.x, z: f.z, kind: f.kind === 'hedge' ? 'hedge' : 'wall' } })); } catch (e) { /* no events */ }
}

// ---------- the collision hook ----------
// seg: a wall-grid segment carrying .fn (its panel); vs: the car's speed into it (m/s); (nx, nz): from the wall to the car.
function breakFence(seg, vs, nx, nz, car) {
  const f = seg.fn; if (!f || f.gone || vs < (f.thr || BREAK_SPEED)) return false;
  if (f.wk) { seg[0] = seg[1] = seg[2] = seg[3] = 1e7; breakWall(f, vs, nx, nz, car); return true; }   // a garden wall or a hedge piece (below)
  f.gone = true; broken.add(f.id);
  seg[0] = seg[1] = seg[2] = seg[3] = 1e7;                       // out of every query: the gap stays open
  const tile = f.tile; if (tile) { const m = tile.mesh[f.st]; _m.makeScale(0, 0, 0); m.setMatrixAt(f.i, _m); m.instanceMatrix.needsUpdate = true; }
  const sp = Math.hypot(car.vx, car.vz);
  flyers.push({ st: f.st, x: f.x, y: f.y, z: f.z, vx: -nx * (2.5 + vs * 0.5) + car.vx * 0.35, vz: -nz * (2.5 + vs * 0.5) + car.vz * 0.35, vy: 3 + Math.min(5, vs * 0.45),
    yaw: f.yaw, wy: (rnd01(f.x, f.z) - 0.5) * 9, tilt: 0, wt: 3 + sp * 0.2, len: f.len, h: f.h, age: 0 });
  if (flyers.length > POOL * 3) flyers.shift();
  car.vx += nx * vs * 0.22; car.vz += nz * vs * 0.22;            // the panel takes a little speed with it
  if (car.vf !== undefined) car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
  try { dispatchEvent(new CustomEvent('pd-fence', { detail: { x: f.x, z: f.z, kind: 'fence' } })); } catch (e) { /* no events */ }
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
  const wall = new Buf(), panels = [[], [], []], wallPieces = [];
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
    const breakable = r.k === 'w' || r.k === 'd' || r.k === 'h';   // garden and parcel walls, dry-stone, hedges; retaining and city walls and concrete barriers hold up ground or are too heavy
    for (let i = 0; i + 1 < V.length; i++) {
      const a = V[i], b = V[i + 1], wid = key + ':w' + li + ':' + i;
      if (breakable && broken.has(wid)) continue;   // smashed earlier in the session: the gap stays
      const vStart = wall.p.length / 3;
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
      const len = hh(b.x - a.x, b.z - a.z);
      if (len > 0.3) {
        let fn = null;
        if (breakable) {
          const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y0 = Math.min(a.y0, b.y0), hgt = r.h;
          fn = { id: wid, wk: true, kind: r.k === 'h' ? 'hedge' : (r.k === 'd' || hgt < 1.9) ? 'low' : 'wall', thr: thrFor(r.k, hgt), v0: vStart, v1: wall.p.length / 3, x: mx, z: mz, y: y0 + 0.45, h: hgt, len, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len, col: base, tile: null, gone: false };
          wallPieces.push(fn);
        }
        addSeg(a.x, a.z, b.x, b.z, fn);
      }
    }
  }
  const rec = { mesh: [null, null, null], wall: null };
  for (const f of wallPieces) f.tile = rec;
  if (wall.p.length) {
    const m = wall.mesh(WALL_MAT || (WALL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));
    m.castShadow = true; m.receiveShadow = true; group.add(m); rec.wall = m;
  }

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
