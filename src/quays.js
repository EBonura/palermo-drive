// The quays, moles and piers of the harbour (board item n10). The bake (tools/quays.py, docs/TILES.md) puts a "quays" record in the tiles round the port:
//   d  decks [h, top, blend, ring (flat x, z), wall flags per edge]: flat ground at height h inside the ring; `top` rings are drawn here (a 2 m band over the water and the piers),
//      the others are the apron strip on the land side, paved by the street layers; `blend` rings fade into the terrain over BLEND m
//   w  wall pieces [x0, z0, x1, z1, h]: the seaward edges of the decks, minus the slipways and the free end of a long pier
// What this module does with them:
//   carve(x, z, y)   the ground: flat inside a deck, blended into the town beyond a strip, dredged beside a wall (so the sea floor cannot show in front of the wall), applied inside hooks.ground
//   walls            stone quay wall from the deck down to the sea floor, a coping stone along the top, bollards every 20 m, and the wall pieces are collision (the lapa stops at the edge
//                    except at a slipway or the end of a pier, where there is no wall and the ground falls away: the sea module takes the lapa from there)
//   freight          in the commercial port: gantry cranes on the long quays and container stacks on the apron (also collision)
import * as THREE from 'three';
import { groundY, pairs } from './core.js';

const BLEND = 8, DREDGE = 6, SEA_FLOOR = -2.4, CELL = 16;
const hh = Math.hypot;
export const FREIGHT = [500, -3300, 1300, -1900];   // the commercial port (the same box as tools/quays.py)

// ---------- registry ----------
let walls = null;
const byTile = new Map();      // tile key -> { rings, wallSegs, data, group }
const grid = new Map();        // cell -> rings whose box (grown by the reach of the carve) meets it
const ck = (ix, iz) => ix * 100003 + iz;
export function initQuays({ wallGrid }) { walls = wallGrid; }

function inRing(p, x, z) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function registerQuays(d, key) {
  unregisterQuays(key);
  const q = d.quays; if (!q) return;
  const rings = [], segs = [];
  for (const [h, top, blend, flat, flags] of q.d) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (let i = 0; i < flat.length; i += 2) { x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i]); z0 = Math.min(z0, flat[i + 1]); z1 = Math.max(z1, flat[i + 1]); }
    const r = { h, top, blend, p: flat, flags, x0, z0, x1, z1 }; rings.push(r);
    const m = BLEND + 1;
    for (let ix = Math.floor((x0 - m) / CELL); ix <= Math.floor((x1 + m) / CELL); ix++) for (let iz = Math.floor((z0 - m) / CELL); iz <= Math.floor((z1 + m) / CELL); iz++) {
      const k = ck(ix, iz); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(r);
    }
  }
  if (walls) for (const w of q.w) { const s = [w[0], w[1], w[2], w[3]]; walls.addSeg('q' + key, s, w[0], w[1], w[2], w[3]); segs.push(s); }   // (its own tile key: the physics of the tile coming and going leaves them alone)
  byTile.set(key, { rings, segs, data: d, group: null });
}
export function unregisterQuays(key) {
  const t = byTile.get(key); if (!t) return;
  if (walls) { walls.removeTile('q' + key); walls.removeTile('q' + key + 'f'); }
  const gone = new Set(t.rings);
  for (const [k, a] of grid) { let w = 0; for (let i = 0; i < a.length; i++) if (!gone.has(a[i])) a[w++] = a[i]; if (w) a.length = w; else grid.delete(k); }
  byTile.delete(key);
}
export const tileQuays = key => byTile.has(key);

// ---------- the ground ----------
export function carve(x, z, y) {
  if (grid.size === 0) return y;
  const a = grid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return y;
  let inside = -1e9, best = 1e9, bw = false, bh = 0, bb = 0;
  for (const r of a) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && inRing(r.p, x, z)) { if (r.h > inside) inside = r.h; continue; }
    if (x < r.x0 - BLEND || x > r.x1 + BLEND || z < r.z0 - BLEND || z > r.z1 + BLEND) continue;
    const p = r.p, n = p.length;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n, ax = p[i], az = p[i + 1], dx = p[j] - ax, dz = p[j + 1] - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = hh(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bw = r.flags.charCodeAt(i >> 1) === 49; bh = r.h; bb = r.blend; }
    }
  }
  if (inside > -1e8) return inside;
  if (best >= BLEND) return y;
  if (bw) return best < DREDGE ? Math.min(y, SEA_FLOOR) : y;
  if (bb) { const t = best / BLEND; return bh * (1 - t * t * (3 - 2 * t)) + y * (t * t * (3 - 2 * t)); }
  return y;
}
const landSide = (x, z) => { const a = grid.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return false; for (const r of a) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && inRing(r.p, x, z)) return true; return false; };

// ---------- the meshes ----------
let matDeck = null, matWall = null, matProp = null;
function mats() {
  if (matDeck) return;
  const tex = (w, h, paint, rep) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  matDeck = new THREE.MeshStandardMaterial({ roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: tex(128, 128, (g, w, h) => {
    g.fillStyle = '#9d9a92'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,58,52,0.10)' : 'rgba(235,230,215,0.10)'; g.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5); }
    g.strokeStyle = 'rgba(50,48,44,0.45)'; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);                 // the slab joints
  }) });
  matWall = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide, map: tex(128, 256, (g, w, h) => {
    g.fillStyle = '#8c8a82'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,38,34,0.55)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 32) & 1) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
    for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(50,48,42,0.12)' : 'rgba(230,225,210,0.10)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    const gr = g.createLinearGradient(0, h * 0.62, 0, h); gr.addColorStop(0, 'rgba(40,70,40,0)'); gr.addColorStop(1, 'rgba(36,66,38,0.7)'); g.fillStyle = gr; g.fillRect(0, h * 0.62, w, h * 0.38);   // weed and wet stone below the waterline
  }) });
  matProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 });
}
const C = h => new THREE.Color(h);
const SHADE = (c, k) => new THREE.Color(c.r * k, c.g * k, c.b * k);

class Bf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  tri(a, b, c, n, col, uv) { for (const [v, i] of [[a, 0], [b, 1], [c, 2]]) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col.r, col.g, col.b); this.u.push(uv ? uv[i][0] : 0, uv ? uv[i][1] : 0); } }
  quad(a, b, c, d, n, col, uv) { this.tri(a, b, c, n, col, uv && [uv[0], uv[1], uv[2]]); this.tri(a, c, d, n, col, uv && [uv[0], uv[2], uv[3]]); }
  // an axis-aligned box rotated about y by `ry` (the local x runs along the quay): centre (x, z), base y0, size sx, sy, sz
  box(x, y0, z, sx, sy, sz, ry, col) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c], hx = sx / 2, hz = sz / 2;
    const v = [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)];
    const f = (a, b, cc, d, n, k) => this.quad(v[a], v[b], v[cc], v[d], n, SHADE(col, k));
    f(4, 7, 6, 5, [0, 1, 0], 1.0);
    f(3, 7, 4, 0, [-c, 0, s], 0.8); f(1, 5, 6, 2, [c, 0, -s], 0.85); f(0, 4, 5, 1, [-s, 0, -c], 0.75); f(2, 6, 7, 3, [s, 0, c], 0.9);
  }
  cyl(x, y0, z, r, h, seg, col) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), k = SHADE(col, 0.8 + 0.2 * Math.cos((a0 + a1) / 2));
      this.quad([x + c0 * r, y0, z + s0 * r], [x + c1 * r, y0, z + s1 * r], [x + c1 * r, y0 + h, z + s1 * r], [x + c0 * r, y0 + h, z + s0 * r], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], k);
      this.tri([x, y0 + h, z], [x + c0 * r, y0 + h, z + s0 * r], [x + c1 * r, y0 + h, z + s1 * r], [0, 1, 0], col);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return new THREE.Mesh(g, mat);
  }
}
function rng(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const inFreight = (x, z) => x > FREIGHT[0] && x < FREIGHT[2] && z > FREIGHT[1] && z < FREIGHT[3];

export function buildQuayMeshes(key, tile) {
  const t = byTile.get(key); if (!t) return null;
  if (t.group) return t.group;
  mats();
  const g = new THREE.Group(); g.name = 'quays ' + key;
  if (walls && t.freightWalls) walls.removeTile('q' + key + 'f');
  const deck = new Bf(), wall = new Bf(), prop = new Bf();
  const white = C('#ffffff');
  // the decks over the water: flat tops
  for (const r of t.rings) {
    if (!r.top) continue;
    const pts = pairs(r.p).map(p => new THREE.Vector2(p[0], p[1])), tri = THREE.ShapeUtils.triangulateShape(pts, []);
    for (const f of tri) {
      let a = pts[f[0]], b = pts[f[1]], c = pts[f[2]];
      if ((b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y) < 0) [b, c] = [c, b];
      const y = r.h + 0.02;
      deck.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], [0, 1, 0], white, [[a.x / 4, a.y / 4], [b.x / 4, b.y / 4], [c.x / 4, c.y / 4]]);
    }
  }
  // the walls: stone face from the deck to the sea floor, coping along the top, bollards
  const stone = C('#c9c4b6'), iron = C('#2d2f33'), carry = { v: 3 };
  for (const w of t.data.quays.w) {
    const [x0, z0, x1, z1, h] = w, L = hh(x1 - x0, z1 - z0); if (L < 0.4) continue;
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L; let nx = uz, nz = -ux;   // a normal: make it point out to sea (the side that is not deck or land)
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (landSide(mx + nx * 0.5, mz + nz * 0.5) || (!landSide(mx - nx * 0.5, mz - nz * 0.5) && groundY(mx + nx * 3, mz + nz * 3) > groundY(mx - nx * 3, mz - nz * 3))) { nx = -nx; nz = -nz; }
    const yt = h + 0.02, yb = SEA_FLOOR - 0.2, nn = [nx, 0, nz];
    wall.quad([x0, yb, z0], [x1, yb, z1], [x1, yt, z1], [x0, yt, z0], nn, white, [[0, 0], [L / 4, 0], [L / 4, (yt - yb) / 4], [0, (yt - yb) / 4]]);
    // coping: a 0.45 m wide light stone course on the land side of the edge
    const ry = Math.atan2(-uz, ux);
    prop.box(mx - nx * 0.22, yt - 0.02, mz - nz * 0.22, L + 0.02, 0.26, 0.45, ry, stone);
    // bollards
    carry.v -= L;
    while (carry.v < 0 && L > 3) { const s = L + carry.v, px = x0 + ux * s - nx * 1.0, pz = z0 + uz * s - nz * 1.0; prop.cyl(px, yt, pz, 0.24, 0.5, 8, iron); prop.cyl(px, yt + 0.5, pz, 0.32, 0.12, 8, iron); carry.v += 20; }
    if (carry.v < 0) carry.v = 0;
  }
  if (deck.p.length) { const m = deck.mesh(matDeck); m.receiveShadow = true; g.add(m); }
  if (wall.p.length) { const m = wall.mesh(matWall); m.receiveShadow = true; g.add(m); }
  freight(key, t, prop);
  if (prop.p.length) { const m = prop.mesh(matProp); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  t.group = g;
  return g;
}
export function disposeQuayMeshes(key) {
  const t = byTile.get(key); if (!t || !t.group) return;
  t.group.removeFromParent(); t.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  t.group = null;
  if (walls) walls.removeTile('q' + key + 'f'); t.freightWalls = false;
}

// ---------- the commercial port: gantry cranes and container stacks ----------
const BOX_COL = ['#b5452f', '#2f5f8f', '#d8a62b', '#3f7a52', '#8a8d92', '#c9c4b6', '#a2351f', '#274a6b'];
function freight(key, t, prop) {
  const data = t.data, W = data.quays.w;
  const rn = rng(key.length * 7919 + (t.rings[0] ? Math.round(t.rings[0].x0) : 1));
  const blds = (data.buildings || []).map(b => { const p = b.p; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); } return { p, x0, z0, x1, z1 }; });
  const roads = (data.roads || []).filter(r => r.k !== 'pier').map(r => ({ p: r.p, w: (r.w || 6) / 2 + 3 }));
  const free = (x, z, r) => {
    for (const b of blds) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) { if (inRing(b.p, x, z) || inRing(b.p, x + r, z) || inRing(b.p, x - r, z) || inRing(b.p, x, z + r) || inRing(b.p, x, z - r)) return false; }
    for (const rd of roads) { const p = rd.p; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, tt = Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2)); if (hh(x - p[i] - dx * tt, z - p[i + 1] - dz * tt) < rd.w + r) return false; } }
    return true;
  };
  let cranes = 0, stacks = 0, since = 60; const placedHere = [];
  for (const w of W) {
    const [x0, z0, x1, z1, h] = w, L = hh(x1 - x0, z1 - z0); if (h < 1.5 || L < 6) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; if (!inFreight(mx, mz)) continue;
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L; let nx = uz, nz = -ux;
    if (landSide(mx + nx * 0.5, mz + nz * 0.5)) { nx = -nx; nz = -nz; }   // out to sea
    // a wall of a long quay only: the pieces are chopped by the 50 m grid, so look at the deck wall's neighbours: both ends have to be on the same line
    since += L;
    // container stacks: a row of 6.1 m boxes along the quay, 5 m back from the edge (on the apron strip), two or three high, with gaps
    if (L >= 12 && rn() < 0.7) {
      const ry = Math.atan2(-uz, ux), n = Math.floor((L - 2) / 6.4);
      for (let k = 0; k < n; k++) {
        if (rn() < 0.28) continue;
        const s = 1.4 + k * 6.4 + 3.1, px = x0 + ux * s - nx * 5.2, pz = z0 + uz * s - nz * 5.2;
        if (!free(px, pz, 3.2) || !landSide(px - nx * 1.4, pz - nz * 1.4)) continue;
        const hgt = 1 + Math.floor(rn() * 3), y0 = h - 0.1 + groundOffset(px, pz, h), col = C(BOX_COL[Math.floor(rn() * BOX_COL.length)]);
        for (let q = 0; q < hgt; q++) prop.box(px, y0 + q * 2.6, pz, 6.1, 2.6, 2.44, ry, SHADE(col, 0.9 + 0.2 * rn()));
        const wx = Math.cos(ry) * 3.05, wz = -Math.sin(ry) * 3.05, sx = Math.sin(ry) * 1.22, sz = Math.cos(ry) * 1.22;
        const q = [[px - wx - sx, pz - wz - sz], [px + wx - sx, pz + wz - sz], [px + wx + sx, pz + wz + sz], [px - wx + sx, pz - wz + sz]];
        if (walls) for (let a = 0; a < 4; a++) { const b = q[(a + 1) % 4], sg = [r1(q[a][0]), r1(q[a][1]), r1(b[0]), r1(b[1])]; walls.addSeg('q' + key + 'f', sg, sg[0], sg[1], sg[2], sg[3]); t.freightWalls = true; }
        stacks++;
      }
    }
    // a gantry crane every 150 m of straight quay, over a 16 m gauge: seaward legs at the edge, landward legs 14 m back, a boom out over the water and up
    if (L >= 20 && since >= 150 && stacks < 400) {
      const px = mx - nx * 2.2, pz = mz - nz * 2.2;
      if (free(px - nx * 7, pz - nz * 7, 6) && !crowded(placedHere, px, pz)) { since = 0; cranes++; crane(key, t, prop, px, pz, nx, nz, ux, uz, h, rn); }
    }
  }
}
const crowded = (list, x, z) => { for (const p of list) if (hh(p[0] - x, p[1] - z) < 90) return true; list.push([x, z]); return false; };
const r1 = v => Math.round(v * 10) / 10;
const groundOffset = (x, z, h) => 0;
function crane(key, t, prop, px, pz, nx, nz, ux, uz, h, rn) {
  t.freightWalls = true;
  const blue = C('#2d5f9c'), grey = C('#8a8f95'), dark = C('#3a3d42'), ry = Math.atan2(-uz, ux);   // local x along the quay
  const at = (a, b) => [px + ux * a + nx * b, pz + uz * a + nz * b];   // a along the quay, b out to sea
  const H = 38, G = 15;                                                  // girder height, gauge along the quay
  for (const a of [-G / 2, G / 2]) for (const b of [1.5, -13.0]) {       // four legs: two at the edge, two 14 m inland
    const [lx, lz] = at(a, b); const gy = Math.max(groundY(lx, lz), h - 0.1);
    prop.box(lx, gy, lz, 1.6, H + (h - gy), 1.6, ry, blue);
    if (walls) for (const [ax, az, bx, bz] of [[lx - 0.8, lz - 0.8, lx + 0.8, lz - 0.8], [lx + 0.8, lz - 0.8, lx + 0.8, lz + 0.8], [lx + 0.8, lz + 0.8, lx - 0.8, lz + 0.8], [lx - 0.8, lz + 0.8, lx - 0.8, lz - 0.8]]) { const s = [r1(ax), r1(az), r1(bx), r1(bz)]; walls.addSeg('q' + key + 'f', s, s[0], s[1], s[2], s[3]); }
  }
  for (const b of [1.5, -13.0]) { const [cx, cz] = at(0, b); prop.box(cx, h + H - 3.4, cz, G + 1.6, 3.4, 2.0, ry, grey); }   // the portal beams across the front and the back
  for (const a of [-G / 2, G / 2]) { const [cx, cz] = at(a, -5.75); prop.box(cx, h + H - 3.4, cz, 1.8, 3.4, 15.0, ry, blue); }   // and the girders joining them
  // the boom: out over the water 38 m, raised 25 degrees would be a lifted boom: drawn horizontal and lifted a little, plus the boom's backstay
  const [bx, bz] = at(0, 14);
  prop.box(bx, h + H + 0.2, bz, 52, 2.6, 3.4, ry + Math.PI / 2, grey);
  const [mx, mz] = at(0, -4); prop.box(mx, h + H + 0.2, mz, 8, 5.2, 7, ry, dark);         // the machinery house
  const [tx, tz] = at(0, -13); prop.box(tx, h + H - 0.2, tz, 3.0, 12, 3.0, ry, blue);     // the A-frame at the back
  // the trolley and spreader at the end of the boom
  const [sx, sz] = at(0, 30); prop.box(sx, h + H - 3, sz, 2.4, 3, 2.4, ry, dark); prop.box(sx, h + H - 12, sz, 6.1, 0.6, 2.44, ry, dark);
  prop.box(sx, h + H - 0.2, sz, 0.14, 0.2, 0.14, ry, dark);
}
