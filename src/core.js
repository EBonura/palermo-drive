// Shared data access, terrain lookup and geometry helpers. Owned by the core; modules import from here.
import * as THREE from 'three';

export const D = window.PALERMO_DATA;
export const FLOOR = 3.4, BAY = 3.6, TEX_FLOORS = 8;
export const LAT0 = 38.11572, LON0 = 13.36126;
export const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
export const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];


// ---------- terrain lookup ----------
// "near" is the lidar DTM around the playable area, "far" the coarse hills around the Conca d'Oro.
// Until the lidar terrain is baked, the near area is flat and buildings use relative heights.
export const HAS_NEAR = !!D.near;
export const NEAR = HAS_NEAR
  ? { x0: D.near.x0, z0: D.near.z0, x1: D.near.x0 + (D.near.nx - 1) * D.near.s, z1: D.near.z0 + (D.near.nz - 1) * D.near.s }
  : { x0: D.bounds[0] - 300, z0: D.bounds[1] - 300, x1: D.bounds[2] + 300, z1: D.bounds[3] + 300 };

function sampler(g) {
  return (x, z) => {
    const fx = Math.max(0, Math.min(g.nx - 1.001, (x - g.x0) / g.s));
    const fz = Math.max(0, Math.min(g.nz - 1.001, (z - g.z0) / g.s));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, h = g.h, n = g.nx;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
}
export const nearH = HAS_NEAR ? sampler(D.near) : () => 0;
export const farH = D.far ? sampler(D.far) : () => 0;
export const inNear = (x, z) => x >= NEAR.x0 && x <= NEAR.x1 && z >= NEAR.z0 && z <= NEAR.z1;
// World streaming (src/world.js, only with ?world=1): hooks.ground(x, z) answers from the loaded tiles' near grids and the
// whole-city far grid, or returns undefined to fall through to the baked centro data below. hooks.bounds is the driveable box.
export const WORLD = !/[?&]world=0/.test(location.search); // the whole city streams by default; ?world=0 is the old centro-only map
export const hooks = { ground: null, bounds: D.bounds };
export const groundY = (x, z) => {
  if (hooks.ground) { const y = hooks.ground(x, z); if (y !== undefined) return y; }
  return inNear(x, z) ? nearH(x, z) : farH(x, z);
};


// ---------- geometry helpers ----------
export class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  v(x, y, z, nx, ny, nz, col, u = 0, w = 0, k = 1) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz);
    this.c.push(col.r * k, col.g * k, col.b * k); this.uv.push(u, w);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return new THREE.Mesh(g, mat);
  }
}

export const pairs = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]); return out; };
export const signedArea = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

// Emit a horizontal triangle facing up regardless of input winding.
export function triUp(buf, a, b, c, y, col) {
  if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) [b, c] = [c, b];
  for (const p of [a, b, c]) buf.v(p[0], y, p[1], 0, 1, 0, col);
}

export function fillPoly(buf, flat, holes, y, col) {
  const contour = pairs(flat).map(p => new THREE.Vector2(p[0], p[1]));
  const hs = (holes || []).map(h => pairs(h).map(p => new THREE.Vector2(p[0], p[1])));
  const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
  const all = contour.concat(...hs).map(v => [v.x, v.y]);
  for (const t of tris) triUp(buf, all[t[0]], all[t[1]], all[t[2]], y, col);
}


// ---------- procedural texture helpers ----------
export function canvasTex(size, draw, metres) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.metres = metres;
  return t;
}
export const rnd = (a, b) => a + Math.random() * (b - a);
export function speckle(g, S, n, cols, r0, r1) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const r = rnd(r0, r1); g.fillRect(rnd(0, S), rnd(0, S), r, r); }
}

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// [perf pass] indexed reads instead of array destructuring: this runs millions of times at startup (props placement masks).
export function inPoly(pts, x, z) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const p = pts[i], q = pts[j], xi = p[0], zi = p[1], xj = q[0], zj = q[1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }

// [perf pass] Rasterise polygon layers into a bit-packed mask, one 1024 px tile at a time.
// The old way drew the whole map on one canvas (4100 x 4060 px at k = 2) and kept its RGBA read-back alive:
// ~66 MB of heap, close to the 16 M px canvas limit of iOS Safari. This keeps 1 bit per cell (about 2 MB) and a 4 MB scratch canvas.
// layers: array of polygon lists (each polygon = [outerRing, hole, ...], flat [x, z, ...]); aoi: [x0, z0, x1, z1]; k: cells per metre.
// Returns (x, z) => boolean, same answers as the old canvas version (even-odd fill per polygon, alpha > 127).
export function rasterMask(layers, aoi, k) {
  const [x0, z0, x1, z1] = aoi, W = Math.ceil((x1 - x0) * k), H = Math.ceil((z1 - z0) * k), TS = 1024;
  const bits = new Uint8Array((W * H + 7) >> 3);
  const items = [];
  for (const polys of layers) for (const poly of polys) {
    const r = poly[0]; let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (let i = 0; i < r.length; i += 2) { const x = (r[i] - x0) * k, z = (r[i + 1] - z0) * k; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; }
    items.push([poly, a, b, c, d]);
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const g = cv.getContext('2d');   // GPU canvas on purpose: same rasteriser (and edge pixels) as the old whole-map canvas
  for (let ty = 0; ty < H; ty += TS) for (let tx = 0; tx < W; tx += TS) {
    g.clearRect(0, 0, TS, TS); g.fillStyle = '#fff';
    let any = false;
    for (const [poly, a, b, c, d] of items) {
      if (c < tx - 2 || a > tx + TS + 2 || d < ty - 2 || b > ty + TS + 2) continue;
      g.beginPath();
      for (const ring of poly) for (let i = 0; i < ring.length; i += 2) g[i ? 'lineTo' : 'moveTo']((ring[i] - x0) * k - tx, (ring[i + 1] - z0) * k - ty);
      g.fill('evenodd'); any = true;
    }
    if (!any) continue;
    const w = Math.min(TS, W - tx), h = Math.min(TS, H - ty), px = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer);
    for (let j = 0; j < h; j++) for (let i = 0, o = j * w; i < w; i++) {
      if ((px[o + i] >>> 24) > 127) { const n = (ty + j) * W + tx + i; bits[n >> 3] |= 1 << (n & 7); }
    }
  }
  return (x, z) => { const i = ((x - x0) * k) | 0, j = ((z - z0) * k) | 0; if (i < 0 || j < 0 || i >= W || j >= H) return false; const n = j * W + i; return (bits[n >> 3] >> (n & 7) & 1) === 1; };
}
