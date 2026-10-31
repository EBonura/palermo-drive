// Low-detail context city beyond the playable area. Owned by the context work.
// Data comes from context-data.js (tools/context.py): OSM buildings and major roads around the
// playable box. Everything is merged into a few chunked meshes: windowed walls, flat grey roofs,
// dark road ribbons draped on the coarse far terrain.
import * as THREE from 'three';
import { D, groundY, inNear, canvasTex, rng } from './core.js';
import { decodeBuildings, chooseBuildings } from './context-select.js';

const CHUNK = 1000;                 // metres per mesh chunk (frustum culling)
const FLOOR_H = 3.3;
const TEX_BAYS = 3, TEX_FLOORS = 4, BAY_M = 3.4;   // one facade texture tile: 3 bays x 4 floors
const TILE_W = TEX_BAYS * BAY_M, TILE_H = TEX_FLOORS * FLOOR_H;

// ---------- ground under context objects ----------
// Same triangulation as the far terrain mesh in main.js (and its 0.6 m drop), so ribbons and
// wall bases sit on the real surface instead of the bilinear approximation.
const F = D.far;
function farSurface(x, z) {
  if (!F) return 0;
  const fx = Math.max(0, Math.min(F.nx - 1.001, (x - F.x0) / F.s)), fz = Math.max(0, Math.min(F.nz - 1.001, (z - F.z0) / F.s));
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, n = F.nx, h = F.h;
  const h00 = h[j * n + i], h10 = h[j * n + i + 1], h01 = h[(j + 1) * n + i], h11 = h[(j + 1) * n + i + 1];
  const y = tx + tz <= 1 ? h00 + (h10 - h00) * tx + (h01 - h00) * tz : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  return y - 0.6;
}
const ground = (x, z) => inNear(x, z) ? groundY(x, z) : farSurface(x, z);

// ---------- facade texture: rows of windows, white-ish so plaster colour comes from vertices ----------
function facadeTexture() {
  const t = canvasTex(128, (g, S) => {
    g.fillStyle = '#f1eee7'; g.fillRect(0, 0, S, S);
    const bw = S / TEX_BAYS, fh = S / TEX_FLOORS;
    for (let f = 0; f < TEX_FLOORS; f++) {
      // slab / balcony line at each floor level
      g.fillStyle = '#d3cfc6'; g.fillRect(0, f * fh + fh - 6, S, 5);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, f * fh + fh - 1, S, 1);
      for (let b = 0; b < TEX_BAYS; b++) {
        const x = b * bw + bw * 0.24, y = f * fh + fh * 0.16, w = bw * 0.52, h = fh * 0.62;
        g.fillStyle = '#e4e0d6'; g.fillRect(x - 3, y - 3, w + 6, h + 6);        // frame / surround
        g.fillStyle = '#3f4a55'; g.fillRect(x, y, w, h);                        // glass
        g.fillStyle = '#6f7d88'; g.fillRect(x, y, w, h * 0.3);                  // sky reflection
        if ((f + b * 2) % 3 === 0) { g.fillStyle = '#7a6d56'; g.fillRect(x, y, w, h * 0.45); } // shutter half down
        g.fillStyle = '#aeb0ad'; g.fillRect(x - 5, y + h + 3, w + 10, 4);      // balcony rail
      }
    }
    // subtle streaks so large walls aren't clinical
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,50,40,${0.02 + Math.random() * 0.04})`; g.fillRect(Math.random() * S, 0, 2 + Math.random() * 6, S); }
  }, TILE_W);
  t.anisotropy = 4;
  return t;
}

// ---------- palettes ----------
const hex = h => new THREE.Color(h);
const WALLS = {
  res: ['#dcd6c8', '#d2c4a4', '#cba66f', '#aaa7a0', '#cfa898', '#d9c58f', '#e2ddd0', '#c9b896', '#b9b2a4'].map(hex),
  ind: ['#b8b6b0', '#d6d6d2', '#a9b1b5', '#c4bfb2'].map(hex),
  low: ['#dcd2bd', '#d8c490', '#cfa985', '#e0dbcf', '#c2b8a2'].map(hex),
  villa: ['#e4d6b8', '#d9a98e', '#d3b27a', '#c9c1a8'].map(hex),
  civic: ['#bfa982', '#d8ccb2', '#c9b896', '#ddd8cc'].map(hex),
};
const ROOFS = ['#bdbab3', '#c8c5be', '#aeaba4', '#d2cfc8', '#a7a49f', '#b7b3ab', '#c4a89a'].map(hex);
const SHED_ROOFS = ['#cfd3d3', '#b9bec1', '#d8d8d4', '#a5aaad'].map(hex);
const KIND_PAL = ['res', 'ind', 'low', 'villa', 'civic', 'ind'];

// ---------- merged-geometry builder ----------
class Chunk {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; this.tris = 0; }
  quad(a, b, c, d, nx, ny, nz, col, uv) { // vertices a..d in order, uv = [[u,v]x4]
    const o = this.p.length / 3;
    for (let k = 0; k < 4; k++) {
      const v = [a, b, c, d][k];
      this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz);
      const s = k < 2 ? col.bot : col.top; // darker at the foot
      this.c.push(s.r, s.g, s.b); this.uv.push(uv[k][0], uv[k][1]);
    }
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3); this.tris += 2;
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}

export function buildContext(ctx) {
  const C = window.PALERMO_CONTEXT;
  if (!C) return;
  const scene = ctx.scene;
  const stats = { buildings: 0, tris: 0, roadTris: 0, candidates: 0 };

  // ----- choose what to draw -----
  const all = decodeBuildings(C.b);
  stats.candidates = all.length;
  // Importance ranking, far-field rectangles and the triangle budget live in context-select.js so the
  // production build (tools/build) can prune the baked data with exactly the same rule.
  const chosen = chooseBuildings(all);

  // ----- build chunks -----
  const wallC = new Map(), roofC = new Map();
  const get = (m, cx, cz) => { const k = cx * 4096 + cz; let c = m.get(k); if (!c) m.set(k, c = new Chunk()); return c; };
  const col = { top: new THREE.Color(), bot: new THREE.Color() }, rc = { top: new THREE.Color(), bot: new THREE.Color() };
  for (const b of chosen) {
    const r = rng((b.ox * 73856093) ^ (b.oz * 19349663) ^ b.pts.length);
    const pts = b.pts, n = pts.length;
    // ground from the footprint corners (+ centre); walls stand on the lowest point
    let gmin = 1e9;
    for (const p of pts) gmin = Math.min(gmin, ground(p[0], p[1]));
    gmin = Math.min(gmin, ground(b.cx, b.cz));
    gmin = Math.max(gmin, 0.6);               // port sheds shouldn't sit under the sea
    const yBase = gmin - 1.5, yTop = gmin + b.h;
    const wcs = WALLS[KIND_PAL[b.k]] || WALLS.res;
    const base = wcs[(r() * wcs.length) | 0], j = 0.94 + r() * 0.12;
    col.top.copy(base).multiplyScalar(j); col.bot.copy(col.top).multiplyScalar(0.86);
    const cx = Math.floor(b.cx / CHUNK), cz = Math.floor(b.cz / CHUNK);
    const wc = get(wallC, cx, cz), rcn = get(roofC, cx, cz);
    const uOff = r() * 5;
    let u = uOff;
    const vTop = (yTop - yBase) / TILE_H;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      if (L < 0.2) continue;
      // footprint is CCW in (x, z): outward normal is (dz, -dx)
      const nx = dz / L, nz = -dx / L;
      const u1 = u + L / TILE_W;
      // quad order q-bot, p-bot, p-top, q-top winds so the face looks along (dz, -dx)
      wc.quad([q[0], yBase, q[1]], [p[0], yBase, p[1]], [p[0], yTop, p[1]], [q[0], yTop, q[1]], nx, 0, nz, col,
        [[u1, 0], [u, 0], [u, vTop], [u1, vTop]]);
      u = u1;
    }
    // roof
    const roofCols = b.k === 1 || b.k === 5 ? SHED_ROOFS : ROOFS;
    const rb = roofCols[(r() * roofCols.length) | 0];
    rc.top.copy(rb).multiplyScalar(0.95 + r() * 0.1); rc.bot.copy(rc.top);
    const o = rcn.p.length / 3;
    for (const p of pts) { rcn.p.push(p[0], yTop, p[1]); rcn.n.push(0, 1, 0); rcn.c.push(rc.top.r, rc.top.g, rc.top.b); rcn.uv.push(0, 0); }
    if (n === 4) {
      const tri = [[0, 1, 2], [0, 2, 3]];
      for (const t of tri) pushUp(rcn, o, pts, t);
    } else {
      const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const t of tris) pushUp(rcn, o, pts, t);
    }
    stats.buildings++;
  }

  const wallTex = facadeTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, vertexColors: true, roughness: 1, metalness: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const group = new THREE.Group(); group.name = 'context';
  for (const c of wallC.values()) { group.add(c.mesh(wallMat)); stats.tris += c.tris; }
  for (const c of roofC.values()) { group.add(c.mesh(roofMat)); stats.tris += c.i.length / 3; }

  // ----- roads -----
  const roadMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: '#7a7873', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const WIDTH = [22, 18, 13, 11, 9];
  const roadChunks = new Map();
  for (const row of C.r) {
    const w = WIDTH[row[0]] || 9, ox = row[1], oz = row[2];
    let pts = [];
    for (let i = 3; i < row.length; i += 2) pts.push([ox + row[i] / 10, oz + row[i + 1] / 10]);
    pts = resample(pts, 45);
    if (pts.length < 2) continue;
    const cx = Math.floor(pts[0][0] / CHUNK), cz = Math.floor(pts[0][1] / CHUNK);
    const rcn = get(roadChunks, cx, cz);
    let prevL = null, prevR = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      const lx = pts[i][0] + tz * w / 2, lz = pts[i][1] - tx * w / 2, rx = pts[i][0] - tz * w / 2, rz = pts[i][1] + tx * w / 2;
      const L3 = [lx, ground(lx, lz) + 0.35, lz], R3 = [rx, ground(rx, rz) + 0.35, rz];
      if (prevL) {
        const o = rcn.p.length / 3;
        rcn.p.push(...prevL, ...prevR, ...R3, ...L3);
        for (let k = 0; k < 4; k++) { rcn.n.push(0, 1, 0); rcn.c.push(1, 1, 1); rcn.uv.push(0, 0); }
        // ensure upward-facing
        const ax = prevR[0] - prevL[0], az = prevR[2] - prevL[2], bx = R3[0] - prevL[0], bz = R3[2] - prevL[2];
        if (az * bx - ax * bz > 0) rcn.i.push(o, o + 1, o + 2, o, o + 2, o + 3); else rcn.i.push(o, o + 2, o + 1, o, o + 3, o + 2);
        stats.roadTris += 2;
      }
      prevL = L3; prevR = R3;
    }
  }
  for (const c of roadChunks.values()) group.add(c.mesh(roadMat));

  group.frustumCulled = true;
  scene.add(group);
  window.__contextStats = stats;
  console.info('context:', JSON.stringify(stats), 'tri total', stats.tris + stats.roadTris);
  return group;
}

function pushUp(chunk, o, pts, t) {
  const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
  if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) chunk.i.push(o + t[0], o + t[2], o + t[1]);
  else chunk.i.push(o + t[0], o + t[1], o + t[2]);
}

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
