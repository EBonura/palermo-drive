// Walls and fences of the world tiles (tile.fences from tools/fences.py: OSM barrier ways and the Regione Siciliana CTR walls).
//
//   * walls (kinds w wall, d dry-stone, r retaining, c city wall, j concrete barrier, h hedge): one merged mesh per tile with one shared material (src/wall-tex.js: a texture array,
//     a layer per kind, uvs in real metres). Their pieces go into the wall grid, so cars, traffic and pedestrians all stop at them. Retaining walls read their height off the ground
//     on both sides. Walls break in 4 m pieces, like fences, above a speed that grows with the mass (see `breakSpeed`): hedges, dry-stone and garden walls easily, a concrete barrier
//     only when hit hard, a retaining wall only when it holds up almost no ground (under 0.8 m of difference between its two sides). Walls that hold up ground, city walls and the
//     walls of buildings and landmarks stay solid. The speed counts the glancing part too (`effective`), so a scrape along a wall at speed breaks it. A broken piece's quads are
//     collapsed in the tile mesh and flying chunks (the same texture, the same colour) or a puff of leaves and clumps take its place; the gap stays for the session.
//   * fences (f, g guard rail): 2.5 m panels in at most three instanced meshes per tile (railing, wooden, mesh: alpha-tested textures), also in the
//     wall grid, tagged with their panel (seg.fn). A car that meets one at breakSpeed or more (the sphere and classic collide() ask
//     hooks.breakFence before pushing back) smashes it: the panel flies off as a spinning piece, the gap stays for the rest of the session (the
//     `broken` set survives a tile being unloaded and loaded again). Slower, a fence is a wall.
// Everything is baked at full detail only (like the building walls); the draw cost is four calls per tile at most.
import * as THREE from 'three';
import { Buf, groundY, hooks } from './core.js';
import { wallMaterial, wallTextureSteps, LAYER } from './wall-tex.js';

const BREAK_SPEED = 2.6, PANEL = 2.5, MAX_PANELS = 1400, POOL = 10;
const KIND = {
  w: { th: 0.35, col: ['#d6caa8', '#cdbe98', '#c4b594', '#ddd2b6', '#c9bba0', '#d3c3a4'] },
  d: { th: 0.55, col: ['#b0a995', '#a39c88', '#b5ae98', '#9f9985'] },
  r: { th: 0.5, col: ['#b4afa2', '#a8a396', '#bcb6a6', '#a29d90'] },
  c: { th: 1.3, col: ['#d6bd8e', '#cdb486', '#dcc597'] },
  j: { th: 0.55, col: ['#c2c0b6', '#b8b6ac'] },
  h: { th: 0.95, col: ['#4c6b34', '#44622f', '#55723a', '#3e5c2d'] },   // hedges: leafy clumps (the texture), a green block
};
// the speed (m/s, effective, see below) at which a piece breaks. Hedge lightest, dry-stone and a low wall next, a taller wall more, a concrete barrier the most; a retaining wall that holds up
// real ground (a drop of 0.8 m or more between its two sides) and a city wall do not break at all (0)
const breakSpeed = (k, h, drop) => k === 'h' ? 1.8 : k === 'd' ? 3.6 : k === 'w' ? (h < 1.6 ? 4.0 : h < 2.2 ? 5.2 : 6.6) : k === 'r' ? (drop < 0.8 ? 5.4 : 0) : k === 'j' ? 9.0 : 0;
const HOLDS = 0.8;   // metres of ground between the two sides of a retaining wall that make it hold something up
const LOSS = { hedge: 0.12, low: 0.26, wall: 0.38, barrier: 0.5 };            // share of the closing speed the car loses to a broken piece
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
let chunkLayer = null;
function debrisPools() {
  if (chunkIM) return;
  const g = new THREE.BoxGeometry(1, 1, 1), n = g.attributes.position.count, uv = g.attributes.uv, au = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { au[i * 2] = uv.getX(i) * 0.16; au[i * 2 + 1] = uv.getY(i) * 0.16; }   // a chunk shows a hand-sized piece of the layer
  g.setAttribute('aUv', new THREE.BufferAttribute(au, 2)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  chunkLayer = new THREE.InstancedBufferAttribute(new Float32Array(CH), 1); g.setAttribute('aLayer', chunkLayer);
  g.deleteAttribute('uv');
  chunkIM = new THREE.InstancedMesh(g, wallMaterial(), CH); chunkIM.count = CH; chunkIM.frustumCulled = false; chunkIM.name = 'wall_debris'; chunkIM.castShadow = false;
  leafIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), LF); leafIM.count = LF; leafIM.frustumCulled = false; leafIM.name = 'hedge_debris';
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < CH; i++) { chunkIM.setMatrixAt(i, _m); chunkIM.setColorAt(i, _c.set('#ffffff')); }
  for (let i = 0; i < LF; i++) { leafIM.setMatrixAt(i, _m); leafIM.setColorAt(i, _c.set('#ffffff')); }
  root.add(chunkIM); root.add(leafIM);
}
const _c = new THREE.Color();
function spawnChunk(x, y, z, vx, vy, vz, sx, sy, sz, col, life, layer) {
  const i = chunkN++ % CH; chunks[i] = { i, x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 12, wy: (Math.random() - 0.5) * 12, sx, sy, sz, age: 0, life, on: true };
  chunkIM.setColorAt(i, col); chunkIM.instanceColor.needsUpdate = true; chunkLayer.setX(i, layer); chunkLayer.needsUpdate = true; poolsDirty = true;
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
const HEDGECOL = ['#4c6b34', '#44622f', '#55723a', '#3e5c2d'].map(h => new THREE.Color(h));   // the hedge's own greens, for the chunks (the leaf texture lightens them as on the wall)
function breakWall(f, vs, nx, nz, car, vsIn) {
  f.gone = true; broken.add(f.id);
  const m = f.tile && f.tile.wall; if (m) { const pos = m.geometry.attributes.position; for (let i = f.v0; i < f.v1; i++) pos.setXYZ(i, f.x, f.y, f.z); pos.needsUpdate = true; }
  debrisPools();
  const k = 2 + vs * 0.45, hedge = f.kind === 'hedge', n = hedge ? 5 : 9;
  for (let q = 0; q < n; q++) {   // chunks (a hedge: green clumps of twigs)
    const t = (q + Math.random()) / n - 0.5, x = f.x + f.dx * t * f.len, z = f.z + f.dz * t * f.len, y = f.y + 0.2 + Math.random() * Math.max(0.5, f.h - 0.3), sz = hedge ? 0.5 + Math.random() * 0.5 : 0.22 + Math.random() * 0.4;
    const col = (hedge ? HEDGECOL[(Math.random() * 4) | 0] : f.col).clone().multiplyScalar(0.85 + Math.random() * 0.25);
    spawnChunk(x, y, z, -nx * k * (0.4 + Math.random() * 0.8) + car.vx * 0.35 + (Math.random() - 0.5) * 3, 2 + Math.random() * 4 + vs * 0.15, -nz * k * (0.4 + Math.random() * 0.8) + car.vz * 0.35 + (Math.random() - 0.5) * 3,
      sz * (0.8 + Math.random() * 0.6), sz * (0.6 + Math.random() * 0.6), sz * (0.8 + Math.random() * 0.6), col, hedge ? 3.2 + Math.random() * 1.5 : 3.8 + Math.random() * 2, f.layer);
  }
  if (hedge) for (let q = 0; q < 26; q++) {   // a puff of leaves
    const t = Math.random() - 0.5, x = f.x + f.dx * t * f.len, z = f.z + f.dz * t * f.len;
    spawnLeaf(x, f.y + 0.3 + Math.random() * f.h, z, -nx * k * Math.random() * 0.7 + (Math.random() - 0.5) * 4, 1 + Math.random() * 3.5, -nz * k * Math.random() * 0.7 + (Math.random() - 0.5) * 4, 0.22 + Math.random() * 0.2, LEAFCOL[(Math.random() * 4) | 0], 2.4 + Math.random() * 2);
  }
  else for (let q = 0; q < 8; q++) {   // and dust-coloured flakes
    spawnLeaf(f.x + (Math.random() - 0.5) * f.len, f.y + Math.random() * f.h, f.z + (Math.random() - 0.5) * f.len, -nx * k * Math.random() * 0.5 + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.5, -nz * k * Math.random() * 0.5 + (Math.random() - 0.5) * 3, 0.14 + Math.random() * 0.14, f.col, 1.4 + Math.random());
  }
  const loss = LOSS[f.kind];
  const sp0 = Math.hypot(car.vx, car.vz), share = sp0 > 0.1 ? Math.min(1, Math.max(0.3, vsIn / sp0 + 0.25)) : 1;   // a square hit costs the full share of the speed, a scrape less
  car.vx *= 1 - loss * share; car.vz *= 1 - loss * share;
  if (car.vf !== undefined) car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
  try { dispatchEvent(new CustomEvent('pd-fence', { detail: { x: f.x, z: f.z, kind: f.kind === 'hedge' ? 'hedge' : 'wall' } })); } catch (e) { /* no events */ }
}

// ---------- the collision hook ----------
// seg: a wall-grid segment carrying .fn (its panel); vs: the car's speed into it (m/s); (nx, nz): from the wall to the car.
function breakFence(seg, vs, nx, nz, car) {
  const f = seg.fn; if (!f || f.gone) return false;
  // effective speed: the speed into the wall plus part of the speed along it (a scrape at speed breaks a piece; a head-on hit counts in full)
  const sp2 = car.vx * car.vx + car.vz * car.vz, vt = Math.sqrt(Math.max(0, sp2 - vs * vs)), eff = Math.hypot(vs, 0.55 * vt);
  if (eff < (f.thr || BREAK_SPEED)) return false;
  const vsIn = vs; vs = Math.max(vs, eff * 0.8);   // the debris flies as if hit at about the effective speed
  if (f.wk) { seg[0] = seg[1] = seg[2] = seg[3] = 1e7; breakWall(f, vs, nx, nz, car, vsIn); return true; }   // a garden wall or a hedge piece (below)
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

// the wall mesh: Buf plus a texture layer per vertex; uvs are in layer units (src/wall-tex.js), attributes aUv and aLayer
class WBuf extends Buf {
  constructor() { super(); this.ly = []; this.layer = 0; }
  v(x, y, z, nx, ny, nz, col, u, w, k) { super.v(x, y, z, nx, ny, nz, col, u, w, k); this.ly.push(this.layer); }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aUv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('aLayer', new THREE.Float32BufferAttribute(this.ly, 1));
    return new THREE.Mesh(g, mat);
  }
}
const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofences');   // ?nofences: debug, the world as it was before walls and fences
export function* buildFences(list, key) {
  if (!list || !list.length || !wallGrid || OFF) return null;
  panelAssets();
  yield* wallTextureSteps();   // the wall textures, a layer per step, the first time only
  const group = new THREE.Group(); group.name = 'fences';
  const wall = new WBuf(), panels = [[], [], []], wallPieces = [];
  let nPanels = 0, n = 0, nBreak = 0, nSolid = 0;
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
    // solid and breakable walls
    const K = KIND[r.k] || KIND.w, hw = K.th / 2, base = new THREE.Color(K.col[(rnd01(r.p[0], r.p[1]) * K.col.length) | 0]);
    const top = new THREE.Color().copy(base).multiplyScalar(1.1), foot = 0.76, LY = LAYER[r.k] || LAYER.w, CAP = LAYER.cap;
    let sAcc = 0;
    const V = pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = hh(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i) sAcc += hh(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
      const g = groundY(q[0], q[1]);
      let y0 = g - 0.45, y1 = g + r.h, drop = 0;
      if (r.k === 'r') { const gl = groundY(q[0] + nx * 1.6, q[1] + nz * 1.6), gr = groundY(q[0] - nx * 1.6, q[1] - nz * 1.6); drop = Math.abs(gl - gr); y0 = Math.min(gl, gr, g) - 0.4; y1 = Math.max(gl, gr, g) + 0.3; if (y1 - y0 < 1.4) y1 = y0 + 1.4; }
      return { x: q[0], z: q[1], nx, nz, y0, y1, s: sAcc, drop };
    });
    for (let i = 0; i + 1 < V.length; i++) {
      const a = V[i], b = V[i + 1], wid = key + ':w' + li + ':' + i, hgt = r.k === 'r' ? Math.max(a.y1 - a.y0, b.y1 - b.y0) : r.h;
      const thr = breakSpeed(r.k, hgt, Math.max(a.drop, b.drop)), breakable = thr > 0;   // see breakSpeed: a wall that holds up ground, a city wall stay solid
      if (breakable && broken.has(wid)) continue;   // smashed earlier in the session: the gap stays
      const vStart = wall.p.length / 3, E = [a, b];
      const L = [[a.x + a.nx * hw, a.z + a.nz * hw], [b.x + b.nx * hw, b.z + b.nz * hw]], R = [[a.x - a.nx * hw, a.z - a.nz * hw], [b.x - b.nx * hw, b.z - b.nz * hw]];
      // one vertex: end e (0 a, 1 b) of the face P at height y; u over the layer's width along the wall, v over its height below the wall top (so a stone course follows the wall)
      const vt = (P, e, y, nx, nz, k) => wall.v(P[e][0], y, P[e][1], nx, 0, nz, base, E[e].s / LY.pw, (E[e].y1 - y) / LY.ph, k);
      wall.layer = LY.i;
      for (const [e, yy, k] of [[0, 0, foot], [1, 0, foot], [1, 1, 1], [0, 0, foot], [1, 1, 1], [0, 1, 1]]) vt(L, e, yy ? E[e].y1 : E[e].y0, a.nx, a.nz, k);      // left face
      for (const [e, yy, k] of [[1, 0, foot], [0, 0, foot], [0, 1, 1], [1, 0, foot], [0, 1, 1], [1, 1, 1]]) vt(R, e, yy ? E[e].y1 : E[e].y0, -a.nx, -a.nz, k);   // right face
      // the two ends: inside the wall until a neighbouring piece is smashed, then they are what you see of it (a wall is solid, not a hollow shell)
      { const dx = b.x - a.x, dz = b.z - a.z, dl = hh(dx, dz) || 1;
        for (const [e, sg] of [[0, -1], [1, 1]]) {
          const ev = (P, top, u, k) => { const y = top ? E[e].y1 : E[e].y0; wall.v(P[e][0], y, P[e][1], dx / dl * sg, 0, dz / dl * sg, base, E[e].s / LY.pw + u, (E[e].y1 - y) / LY.ph, k); }, tu = 2 * hw / LY.pw;
          ev(L, 0, 0, foot); ev(R, 0, tu, foot); ev(R, 1, tu, 1); ev(L, 0, 0, foot); ev(R, 1, tu, 1); ev(L, 1, 0, 1);
        } }
      wall.layer = CAP.i;   // the cap
      for (const [P, e] of [[L, 0], [L, 1], [R, 1], [L, 0], [R, 1], [R, 0]]) wall.v(P[e][0], E[e].y1, P[e][1], 0, 1, 0, top, P[e][0] / CAP.pw, P[e][1] / CAP.ph, 1);
      const len = hh(b.x - a.x, b.z - a.z);
      if (len > 0.3) {
        let fn = null;
        if (breakable) {
          const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y0 = Math.min(a.y0, b.y0);
          fn = { id: wid, wk: true, kind: r.k === 'h' ? 'hedge' : r.k === 'j' ? 'barrier' : (r.k === 'd' || r.k === 'r' || hgt < 1.9) ? 'low' : 'wall', thr, layer: LY.i, v0: vStart, v1: wall.p.length / 3, x: mx, z: mz, y: y0 + 0.45, h: hgt, len, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len, col: base, tile: null, gone: false };
          wallPieces.push(fn); nBreak += len;
        } else nSolid += len;
        addSeg(a.x, a.z, b.x, b.z, fn);
      }
    }
  }
  const rec = { mesh: [null, null, null], wall: null };
  for (const f of wallPieces) f.tile = rec;
  if (wall.p.length) {
    const m = wall.mesh(wallMaterial());
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
  totals.breakM += nBreak; totals.solidM += nSolid;
  return group;
}
const totals = { breakM: 0, solidM: 0 };

export function dropFences(key) { if (wallGrid) wallGrid.removeTile('f' + key); }
export const fenceStats = () => ({ broken: broken.size, flying: flyers.length, breakableMetres: Math.round(totals.breakM), solidMetres: Math.round(totals.solidM) });
