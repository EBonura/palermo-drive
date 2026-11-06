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
// World streaming (src/world.js): hooks.ground(x, z) answers from the loaded tiles' near grids and the
// whole-city far grid, or returns undefined to fall through to the baked centro data below. hooks.bounds is the driveable box.
export const WORLD = true; // the whole city always streams in tiles (kept for modules that still read it)
export const hooks = { ground: null, bounds: D.bounds, level: null, fall: null, breakFence: null, tick: null, plunge: null };   // level(x, z, yRef): deck or tunnel floor under a car (src/bridges.js); fall(car, ball): jump-spot tick; plunge(car, ball): the sphere model's last word on the ball (src/discarica.js: the lapa goes over the rim of the landfill pit)
export const groundY = (x, z) => {
  if (hooks.ground) { const y = hooks.ground(x, z); if (y !== undefined) return y; }
  return inNear(x, z) ? nearH(x, z) : farH(x, z);
};


// ---------- geometry helpers ----------
// A growing Float32Array: geometry is written a vertex at a time into one of these instead of a JS array of doubles that is copied every time it doubles and once more at the end (most of the garbage of the tile building).
export class Grow {
  constructor(cap = 256) { this.a = new Float32Array(cap); this.length = 0; }
  room(n) { if (this.length + n > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.length + n)); b.set(this.a.subarray(0, this.length)); this.a = b; } }
  push(x) { this.room(1); this.a[this.length++] = x; }
  push2(x, y) { this.room(2); const a = this.a, l = this.length; a[l] = x; a[l + 1] = y; this.length = l + 2; }
  push3(x, y, z) { this.room(3); const a = this.a, l = this.length; a[l] = x; a[l + 1] = y; a[l + 2] = z; this.length = l + 3; }
  done() { return this.a.slice(0, this.length); }
}
export class Buf {
  constructor() { this.p = new Grow(); this.n = new Grow(); this.c = new Grow(); this.uv = new Grow(); }
  v(x, y, z, nx, ny, nz, col, u = 0, w = 0, k = 1) {
    this.p.push3(x, y, z); this.n.push3(nx, ny, nz);
    this.c.push3(col.r * k, col.g * k, col.b * k); this.uv.push2(u, w);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.done(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.n.done(), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.done(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.done(), 2));
    return new THREE.Mesh(g, mat);
  }
}

// Buf without the garbage, for the big street layers: a plain array grown by push leaves its old copies behind on every doubling, and a tile has hundreds of thousands of numbers
export class FBuf {
  constructor() { this.cap = 1024; this.n = 0; this.p = new Float32Array(3072); this.nr = new Float32Array(3072); this.c = new Float32Array(3072); this.uv = new Float32Array(2048); }
  v(x, y, z, nx, ny, nz, col, u = 0, w = 0, k = 1) {
    if (this.n === this.cap) { const c = this.cap *= 2, f = (a, m) => { const b = new Float32Array(c * m); b.set(a); return b; }; this.p = f(this.p, 3); this.nr = f(this.nr, 3); this.c = f(this.c, 3); this.uv = f(this.uv, 2); }
    const i = this.n++, a = i * 3, b = i * 2, P = this.p, N = this.nr, C = this.c;
    P[a] = x; P[a + 1] = y; P[a + 2] = z; N[a] = nx; N[a + 1] = ny; N[a + 2] = nz; C[a] = col.r * k; C[a + 1] = col.g * k; C[a + 2] = col.b * k; this.uv[b] = u; this.uv[b + 1] = w;
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry(), n = this.n;
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nr.slice(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, n * 2), 2));
    return new THREE.Mesh(g, mat);
  }
}

// Exactly equal vertices shared through an index: the same triangles in the same order with the same values, but the GPU shades each vertex once instead of three or six times, and the vertex buffers shrink.
// Only for float attributes (anything else is left alone); bit for bit, no tolerance. Fast enough for a tile's geometry: an open hash table over the raw words, no strings.
export function weld(g) {
  const names = Object.keys(g.attributes), n = g.attributes.position.count, A = names.map(k => g.attributes[k]), old = g.index ? g.index.array : null;
  if (n < 12 || A.some(a => !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute)) return g;
  const W = A.map(a => new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length)), S = A.map(a => a.itemSize), m = A.length;
  let bits = 16; while ((1 << bits) < n * 2) bits++;
  const size = 1 << bits, mask = size - 1, table = new Int32Array(size).fill(-1), map = new Uint32Array(n), keep = new Uint32Array(n);
  let u = 0;
  for (let i = 0; i < n; i++) {
    let h = 0x811c9dc5 | 0;
    for (let a = 0; a < m; a++) { const w = W[a], s = S[a], o = i * s; for (let c = 0; c < s; c++) { h ^= w[o + c]; h = Math.imul(h, 16777619); h ^= h >>> 13; } }
    let t = h & mask, j;
    for (;;) {
      j = table[t];
      if (j < 0) { table[t] = u; keep[u] = i; map[i] = u; u++; break; }
      const q = keep[j]; let same = true;
      for (let a = 0; a < m && same; a++) { const w = W[a], s = S[a], o = i * s, p = q * s; for (let c = 0; c < s; c++) if (w[o + c] !== w[p + c]) { same = false; break; } }
      if (same) { map[i] = j; break; }
      t = (t + 1) & mask;
    }
  }
  const nt = old ? old.length : n, idx = u < 65536 ? new Uint16Array(nt) : new Uint32Array(nt);
  for (let i = 0; i < nt; i++) idx[i] = map[old ? old[i] : i];
  A.forEach((a, k) => { const s = S[k], src = a.array, dst = new Float32Array(u * s); for (let i = 0; i < u; i++) { const o = keep[i] * s, p = i * s; for (let c = 0; c < s; c++) dst[p + c] = src[o + c]; } g.setAttribute(names[k], new THREE.BufferAttribute(dst, s, a.normalized)); });
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
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
// A painted texture that never changes needs its canvas only until it is on the GPU: the canvas then shrinks to a pixel (a canvas's pixels are memory the JS heap does not even show), and a lost GL context
// (phones can do this in the background) paints it again before the next frame. paint(g, w, h) must be able to run again on the same canvas.
// The upload does not wait for the first draw (a texture of something behind the camera would hold its canvas until then): one texture a frame goes up from a queue, so a landmark's dozen textures do not all land in one frame.
const repaint = [], queue = [];
let glr = null, toUpload = [], pumping = false;
document.getElementById('view')?.addEventListener('webglcontextrestored', () => { for (const f of repaint) f(); });   // (this listener runs before three's own: the uploads wait for the next frame, by the queue)
export function setCanvasRenderer(r) { glr = r; for (const t of toUpload) r.initTexture(t); toUpload = []; }   // main.js, once there is a renderer: what the modules painted before it goes up now
const pump = () => {
  const t = queue.shift();
  if (t) { if (!glr) toUpload.push(t); else if (!glr.getContext().isContextLost()) glr.initTexture(t); }
  if (queue.length) requestAnimationFrame(pump); else pumping = false;
};
const uploadSoon = t => { queue.push(t); if (!pumping) { pumping = true; requestAnimationFrame(pump); } };
export function freeCanvas(t, paint) {
  const c = t.image, w = c.width, h = c.height;
  const again = () => { c.width = w; c.height = h; paint(c.getContext('2d'), w, h); t.needsUpdate = true; uploadSoon(t); };
  t.onUpdate = () => { c.width = c.height = 1; };
  uploadSoon(t);
  t.addEventListener('dispose', again);   // (disposed and used later: three uploads it again from the canvas)
  repaint.push(again);
  return t;
}
export function canvasTex(size, draw, metres) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = freeCanvas(new THREE.CanvasTexture(cv), draw);
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
// One canvas for all of it (a new 1024 canvas per call was 4 MB each until the collector came by), and the last few answers kept: a tile asks for the same asphalt up to four times (guard rails, direction signs, road paint, props).
// rasterMaskIter yields between bands of rows; rasterMask is the same thing in one go, and answers at once when the iterator has just done the job.
const RM_BAND = 128, rmLast = [];
let rmCv = null, rmG = null;
export function* rasterMaskIter(layers, aoi, k) {
  for (const m of rmLast) if (m.k === k && m.aoi[0] === aoi[0] && m.aoi[1] === aoi[1] && m.aoi[2] === aoi[2] && m.aoi[3] === aoi[3] && m.layers.length === layers.length && m.layers.every((l, i) => l === layers[i])) return m.fn;
  const [x0, z0, x1, z1] = aoi, W = Math.ceil((x1 - x0) * k), H = Math.ceil((z1 - z0) * k), TS = 1024;
  const bits = new Uint8Array((W * H + 7) >> 3);
  const items = [];
  for (const polys of layers) for (const poly of polys) {
    const r = poly[0]; let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (let i = 0; i < r.length; i += 2) { const x = (r[i] - x0) * k, z = (r[i + 1] - z0) * k; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; }
    items.push([poly, a, b, c, d]);
  }
  yield;
  if (!rmCv) { rmCv = document.createElement('canvas'); rmCv.width = TS; rmCv.height = RM_BAND; rmG = rmCv.getContext('2d'); }   // GPU canvas on purpose: same rasteriser (and edge pixels) as the old whole-map canvas
  const g = rmG;
  for (let ty = 0; ty < H; ty += RM_BAND) for (let tx = 0; tx < W; tx += TS) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TS, RM_BAND); g.fillStyle = '#fff';
    let any = false;
    for (const [poly, a, b, c, d] of items) {
      if (c < tx - 2 || a > tx + TS + 2 || d < ty - 2 || b > ty + RM_BAND + 2) continue;
      g.beginPath();
      for (const ring of poly) for (let i = 0; i < ring.length; i += 2) g[i ? 'lineTo' : 'moveTo']((ring[i] - x0) * k - tx, (ring[i + 1] - z0) * k - ty);
      g.fill('evenodd'); any = true;
    }
    if (!any) continue;
    const w = Math.min(TS, W - tx), h = Math.min(RM_BAND, H - ty), px = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer);
    for (let j = 0; j < h; j++) for (let i = 0, o = j * w; i < w; i++) {
      if ((px[o + i] >>> 24) > 127) { const n = (ty + j) * W + tx + i; bits[n >> 3] |= 1 << (n & 7); }
    }
    yield;
  }
  const fn = (x, z) => { const i = ((x - x0) * k) | 0, j = ((z - z0) * k) | 0; if (i < 0 || j < 0 || i >= W || j >= H) return false; const n = j * W + i; return (bits[n >> 3] >> (n & 7) & 1) === 1; };
  rmLast.unshift({ layers, aoi: [x0, z0, x1, z1], k, fn }); if (rmLast.length > 4) rmLast.pop();
  return fn;
}
export function rasterMask(layers, aoi, k) {
  const it = rasterMaskIter(layers, aoi, k);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
