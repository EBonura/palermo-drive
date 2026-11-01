// Software sprite rasteriser for the pedestrian art (no DOM, so the same code renders in the browser and under node). Owned by the pedestrian work.
//
// A character is a handful of solids (swept cross-sections for limbs, torso, head; ellipsoids for hands, hair curls, noses) seen from one of
// four sides, orthographically, and drawn into a G-buffer cell (depth, colour, part id). Shading is a four-tone cel ramp from one light, with
// pixel decals for faces, and a last pass puts the pixel-art outline on the silhouette and wherever one part stands clearly in front of another.
// Units are design units (1 unit = about 4.4 cm, an adult is 37) and S pixels per unit: S = 3 for the near cells, S = 1 for the far ones.
// Model axes: x to the viewer's right when the figure faces the viewer, y up, z forward (the way the figure looks).
export const CELL_U = { w: 28, h: 44, ground: 3 };      // cell size in units; the feet stand 3 units above the bottom edge (an adult is about 37 units tall: a big head on a short body)

// ---------- colours ----------
const hexMap = new Map();
export const ci = c => { if (typeof c === 'number') return c; let v = hexMap.get(c); if (v === undefined) { v = parseInt(c.slice(1), 16); hexMap.set(c, v); } return v; };
export const hexOf = v => '#' + (v & 0xffffff).toString(16).padStart(6, '0');
const pack = (r, g, b) => (r < 0 ? 0 : r > 255 ? 255 : r | 0) << 16 | (g < 0 ? 0 : g > 255 ? 255 : g | 0) << 8 | (b < 0 ? 0 : b > 255 ? 255 : b | 0);
export const mixc = (a, b, t) => { a = ci(a); b = ci(b); return pack((a >> 16) * (1 - t) + (b >> 16) * t, ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, (a & 255) * (1 - t) + (b & 255) * t); };
export const lumi = c => { c = ci(c); return (0.3 * (c >> 16) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255)) / 255; };
// shade k < 1 darkens (a touch cooler), k > 1 lightens (a touch warmer, with a lift so near-black cloth still shows a highlight)
export const shade = (c, k) => {
  c = ci(c); const R = c >> 16, G = (c >> 8) & 255, B = c & 255;
  return k < 1 ? pack(R * k * 0.98, G * k, B * Math.pow(k, 0.8)) : pack(R * k + (k - 1) * 70, G * k * 0.99 + (k - 1) * 66, B * k * 0.96 + (k - 1) * 58);
};
export const hs = (x, y) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
// four tones of a colour, darkest first: [deep shade, shade, base, light]. styles: 0 cloth, 1 skin (warm shadows), 2 hair (strong highlights), 3 hard (shoes, metal: contrasty)
const toneCache = new Map();
export function tonesOf(base, style = 0) {
  const key = base * 4 + style; let t = toneCache.get(key); if (t) return t;
  const R = base >> 16, G = (base >> 8) & 255, B = base & 255;
  // shadows slide towards blue-violet, highlights towards warm yellow: the flat ramp of hand-made pixel art
  if (style === 1) t = [pack(R * 0.62, G * 0.46, B * 0.52), pack(R * 0.86, G * 0.7, B * 0.72), base, pack(R * 1.04 + 12, G * 1.06 + 10, B * 1.04 + 8)];
  else if (style === 2) t = [pack(R * 0.46, G * 0.46, B * 0.62), pack(R * 0.72, G * 0.7, B * 0.86), base, pack(R * 1.2 + 26, G * 1.2 + 22, B * 1.1 + 14)];
  else if (style === 3) t = [pack(R * 0.42, G * 0.42, B * 0.58), pack(R * 0.68, G * 0.68, B * 0.84), base, pack(R * 1.4 + 40, G * 1.4 + 38, B * 1.3 + 36)];
  else t = [pack(R * 0.48, G * 0.48, B * 0.64), pack(R * 0.74, G * 0.72, B * 0.88), base, pack(R * 1.2 + 24, G * 1.2 + 22, B * 1.08 + 12)];
  toneCache.set(key, t); return t;
}
const EDGE = 0x14101a;

// light from the upper left, in front (view space: x right, y up, z towards the viewer)
const LL = Math.hypot(0.42, 0.62, 0.66), LX = -0.42 / LL, LY = 0.62 / LL, LZ = 0.66 / LL;

export class Cell {
  // dir 0 front, 1 back, 2 left (the figure walks to the left of the screen: we see its left side); right is the mirror of left and is not drawn
  constructor(S, dir) {
    this.S = S; this.W = CELL_U.w * S; this.H = CELL_U.h * S; this.ox = this.W / 2; this.oy = (CELL_U.h - CELL_U.ground) * S;
    const n = this.W * this.H;
    this.zb = new Float32Array(n).fill(-1e9); this.cb = new Int32Array(n); this.bb = new Int32Array(n); this.pb = new Uint8Array(n);
    this.mox = 0; this.ms = 1; this.part = 1; this.reset(dir);
  }
  // clear for another view (cells are reused: they are big)
  reset(dir) {
    this.zb.fill(-1e9); this.pb.fill(0);
    const phi = dir === 1 ? Math.PI : dir === 2 ? Math.PI / 2 : 0;
    this.vc = Math.round(Math.cos(phi)); this.vs = Math.round(Math.sin(phi)); this.swap = this.vs !== 0; this.dir = dir; this.mox = 0; this.ms = 1;
  }
  // Swept solid. kn: [[y, a, b, cx, cz], ...] half widths along x and z of a (super)ellipse cross-section centred on (cx, cz) at height y, linearly interpolated.
  // o: { col, n: 2 | 4 exponent, style, part, bias, deco(x, y, z) -> colour | -1 default | -2 skip }
  sweep(kn, o) {
    const c = this.vc, s = this.vs, sw = this.swap, len = kn.length, K = new Float64Array(len * 5), ms = this.ms;
    const ord = kn.slice().sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < len; i++) { const k = ord[i], cx = (k[3] || 0) * ms + this.mox, cz = (k[4] || 0) * ms; K[i * 5] = k[0] * ms; K[i * 5 + 1] = (sw ? k[2] : k[1]) * ms; K[i * 5 + 2] = (sw ? k[1] : k[2]) * ms; K[i * 5 + 3] = cx * c - cz * s; K[i * 5 + 4] = cx * s + cz * c; }
    const S = this.S, oy = this.oy, y0 = K[0], y1 = K[(len - 1) * 5];
    const j0 = Math.max(0, Math.ceil(oy - y1 * S - 0.5)), j1 = Math.min(this.H - 1, Math.floor(oy - y0 * S - 0.5));
    let q = len - 2;
    for (let j = j0; j <= j1; j++) {
      const ym = (oy - j - 0.5) / S;
      while (q > 0 && ym < K[q * 5]) q--;
      const p = q * 5, r = p + 5, dy = K[r] - K[p] || 1e-6, f = (ym - K[p]) / dy;
      const A = K[p + 1] + (K[r + 1] - K[p + 1]) * f, B = K[p + 2] + (K[r + 2] - K[p + 2]) * f;
      this._row(j, ym, K[p + 3] + (K[r + 3] - K[p + 3]) * f, K[p + 4] + (K[r + 4] - K[p + 4]) * f, A, B,
        (K[r + 1] - K[p + 1]) / dy, (K[r + 2] - K[p + 2]) / dy, (K[r + 3] - K[p + 3]) / dy, (K[r + 4] - K[p + 4]) / dy, o);
    }
  }
  // Ellipsoid with radii rx (x), ry (y), rz (z) at (cx, cy, cz)
  blob(cx, cy, cz, rx, ry, rz, o) {
    const c = this.vc, s = this.vs, sw = this.swap, S = this.S, oy = this.oy;
    const ms = this.ms; cx = cx * ms + this.mox; cy *= ms; cz *= ms; rx *= ms; ry *= ms; rz *= ms; const scx = cx * c - cz * s, scz = cx * s + cz * c, RA = sw ? rz : rx, RB = sw ? rx : rz;
    const j0 = Math.max(0, Math.ceil(oy - (cy + ry) * S - 0.5)), j1 = Math.min(this.H - 1, Math.floor(oy - (cy - ry) * S - 0.5));
    for (let j = j0; j <= j1; j++) {
      const ym = (oy - j - 0.5) / S, t = (ym - cy) / ry, k2 = 1 - t * t; if (k2 <= 0) continue;
      const k = Math.sqrt(k2), kk = Math.max(k, 0.14), dk = -t / (ry * kk);
      this._row(j, ym, scx, scz, RA * k, RB * k, RA * dk, RB * dk, 0, 0, o, true);
    }
  }
  _row(j, ym, scx, scz, A, B, dA, dB, dcx, dcz, o, viewSpace) {
    if (A <= 0.02 || B <= 0.02) return;
    const S = this.S, ox = this.ox, W = this.W, zb = this.zb, cb = this.cb, bb = this.bb, pb = this.pb, row = j * W;
    const n4 = o.n === 4, deco = o.deco, part = o.part || this.part, bias = o.bias || 0, style = o.style || 0;
    let i0 = Math.ceil(ox + (scx - A) * S - 0.5), i1 = Math.floor(ox + (scx + A) * S - 0.5);
    if (i0 < 0) i0 = 0; if (i1 >= W) i1 = W - 1;
    const invA = 1 / A, invB = 1 / B, ccx = dcx * invA, ccz = dcz * invB, aA = dA * invA, aB = dB * invB, vc = this.vc, vs = this.vs;
    const base0 = o.col === undefined ? 0 : ci(o.col), T0 = tonesOf(base0, style);
    for (let i = i0; i <= i1; i++) {
      const u = ((i + 0.5 - ox) / S - scx) * invA, w = 1 - (n4 ? (u * u) * (u * u) : u * u); if (w <= 0) continue;
      let v, pu, pv;
      if (n4) { v = Math.sqrt(Math.sqrt(w)); pu = u * u * u; pv = v * v * v; } else { v = Math.sqrt(w); pu = u; pv = v; }
      const sz = scz + v * B, idx = row + i; if (sz < zb[idx]) continue;
      const fx = pu * invA, fz = pv * invB, fy = -(pu * (ccx + u * aA) + pv * (ccz + v * aB));
      const dot = (fx * LX + fy * LY + fz * LZ) / Math.sqrt(fx * fx + fy * fy + fz * fz) + bias;
      let base = base0, T = T0;
      if (deco) {
        const Xv = scx + u * A, Zv = sz, mx = Xv * vc + Zv * vs, mz = -Xv * vs + Zv * vc, d = deco((mx - this.mox) / this.ms, ym / this.ms, mz / this.ms, dot);
        if (d === -2) continue; if (d !== -1) { base = d; T = tonesOf(d, style); }
      }
      zb[idx] = sz; bb[idx] = base; pb[idx] = part;
      cb[idx] = T[dot > 0.84 ? 3 : dot > 0.0 ? 2 : dot > -0.6 ? 1 : 0];
    }
  }
  // flat filled rectangle in model xy at depth z (for decals that must be exact: a stripe, a badge); front views only
  // Turn the G-buffer into RGBA bytes with the outline. edge = unit depth step that counts as "in front of".
  finish(out, thr = 1.1) {
    const W = this.W, H = this.H, zb = this.zb, cb = this.cb, bb = this.bb, pb = this.pb, th = thr, ER = EDGE >> 16, EG = (EDGE >> 8) & 255, EB = EDGE & 255;
    const halo = true;   // a closed outline: one pixel inside and one outside, dark. It keeps the silhouette readable at a distance, where the mip chain thins everything
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, o = k * 4;
      const L = x > 0 ? k - 1 : -1, R = x < W - 1 ? k + 1 : -1, U = y > 0 ? k - W : -1, D = y < H - 1 ? k + W : -1;
      if (zb[k] < -1e8) {
        let nb = -1;
        if (halo) nb = L >= 0 && zb[L] > -1e8 ? L : R >= 0 && zb[R] > -1e8 ? R : U >= 0 && zb[U] > -1e8 ? U : D >= 0 && zb[D] > -1e8 ? D : -1;
        if (nb >= 0) { const t = tonesOf(bb[nb], 0)[0]; out[o] = (t >> 16) * 0.32; out[o + 1] = ((t >> 8) & 255) * 0.32; out[o + 2] = (t & 255) * 0.4; out[o + 3] = 255; }
        else { out[o] = ER; out[o + 1] = EG; out[o + 2] = EB; out[o + 3] = 0; }
        continue;
      }
      let col = cb[k], edge = 0;
      if (L < 0 || R < 0 || U < 0 || D < 0 || zb[L] < -1e8 || zb[R] < -1e8 || zb[U] < -1e8 || zb[D] < -1e8) edge = 2;
      else {
        const z = zb[k], p = pb[k];
        if ((pb[L] !== p && zb[L] > z + th) || (pb[R] !== p && zb[R] > z + th) || (pb[U] !== p && zb[U] > z + th) || (pb[D] !== p && zb[D] > z + th)) edge = 1;
      }
      if (edge) {
        const t = tonesOf(bb[k], 0)[0], kk = edge === 2 ? 0.55 : 0.85;   // silhouette: the deep shade, darker; an inner edge: the deep shade
        col = pack((t >> 16) * kk, ((t >> 8) & 255) * kk, (t & 255) * kk);
      }
      out[o] = col >> 16; out[o + 1] = (col >> 8) & 255; out[o + 2] = col & 255; out[o + 3] = 255;
    }
    return out;
  }
}
