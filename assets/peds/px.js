// Software pixel canvas and colour helpers for the pedestrian sprite generator (no DOM needed, so the art also renders under node).
// Owned by the pedestrian work. Cells are CELL_W x CELL_H RGBA buffers; everything is drawn with integer rectangles.
export const CELL_W = 48, CELL_H = 96;

const hexRGB = new Map();
export const rgb = c => { let v = hexRGB.get(c); if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; hexRGB.set(c, v); } return v; };
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// shade: k < 1 darkens (a touch cooler), k > 1 lightens (a touch warmer, with a lift so near-black cloth still shows a highlight)
const shCache = new Map();
export const sh = (c, k) => {
  const key = c + k; let r = shCache.get(key); if (r) return r;
  const [R, G, B] = rgb(c);
  r = k < 1 ? hex(R * k * 0.98, G * k, B * Math.pow(k, 0.8)) : hex(R * k + (k - 1) * 70, G * k * 0.99 + (k - 1) * 66, B * k * 0.96 + (k - 1) * 58);
  shCache.set(key, r); return r;
};
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
// four tones of one colour: light, base, shade, deep shade
const toneCache = new Map();
export const T = c => { let t = toneCache.get(c); if (!t) toneCache.set(c, t = { l: sh(c, 1.28), b: c, d: sh(c, 0.78), dd: sh(c, 0.55) }); return t; };
export const lum = c => { const [r, g, b] = rgb(c); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
// deterministic value noise in 0..1
export const hs = (x, y) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

export class Img {
  constructor() { this.d = new Uint8ClampedArray(CELL_W * CELL_H * 4); this.ox = 0; }
  // fill a rectangle
  P(x, y, w, h, c) {
    const [r, g, b] = rgb(c), d = this.d, W = CELL_W;
    x = Math.round(x) + this.ox; y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const xa = Math.max(0, x), xb = Math.min(W, x + w), ya = Math.max(0, y), yb = Math.min(CELL_H, y + h);
    for (let j = ya; j < yb; j++) for (let i = xa, k = (j * W + xa) * 4; i < xb; i++, k += 4) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
  }
  // fill a rectangle only where something is already drawn (folds, stripes and stitching that must not spill past the garment)
  Q(x, y, w, h, c) {
    const [r, g, b] = rgb(c), d = this.d, W = CELL_W;
    x = Math.round(x) + this.ox; y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const xa = Math.max(0, x), xb = Math.min(W, x + w), ya = Math.max(0, y), yb = Math.min(CELL_H, y + h);
    for (let j = ya; j < yb; j++) for (let i = xa, k = (j * W + xa) * 4; i < xb; i++, k += 4) if (d[k + 3]) { d[k] = r; d[k + 1] = g; d[k + 2] = b; }
  }
  clr(x, y, w, h) {
    const d = this.d, W = CELL_W; x = Math.round(x) + this.ox; y = Math.round(y);
    for (let j = Math.max(0, y); j < Math.min(CELL_H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) d[(j * W + i) * 4 + 3] = 0;
  }
  has(x, y) { x = Math.round(x) + this.ox; return x >= 0 && y >= 0 && x < CELL_W && y < CELL_H && this.d[(y * CELL_W + x) * 4 + 3] > 0; }
}

// horizontal spans: fill [x0, x1) on row y
export const row = (P, y, x0, x1, c) => { if (x1 > x0) P(x0, y, x1 - x0, 1, c); };
// filled ellipse in the box (x, y, w, h)
export function ell(P, x, y, w, h, c) {
  for (let j = 0; j < h; j++) { const t = (j + 0.5) / h * 2 - 1, half = w / 2 * Math.sqrt(Math.max(0, 1 - t * t)), a = Math.round(x + w / 2 - half), b = Math.round(x + w / 2 + half); row(P, y + j, a, Math.max(b, a + 1), c); }
}
// tapered limb between two joints, shaded across (light left, dark right)
export function limb(P, x0, y0, x1, y1, w0, w1, c, o = {}) {
  const n = Math.max(1, y1 - y0), t = T(c), l = o.l || t.l, d = o.d || t.d;
  for (let y = y0; y <= y1; y++) {
    const f = (y - y0) / n, xc = x0 + (x1 - x0) * f, w = Math.max(2, Math.round(w0 + (w1 - w0) * f)), xl = Math.round(xc - w / 2);
    P(xl, y, w, 1, c);
    if (o.stripe) P(o.sx < 0 ? xl + 1 : xl + w - 3, y, 2, 1, o.stripe);
    if (w >= 4) { P(xl, y, 1, 1, l); P(xl + w - 1, y, 1, 1, d); if (w >= 7) P(xl + w - 2, y, 1, 1, d); }
  }
}
// rectangle with light left edge and shaded right and bottom edge
export function block(P, x, y, w, h, c, hl = 1, sd = 2) {
  const t = T(c);
  P(x, y, w, h, c); if (hl) P(x, y, hl, h, t.l); if (sd && w > hl + sd) P(x + w - sd, y, sd, h, t.d); if (h > 4) P(x, y + h - 1, w, 1, t.d);
}
