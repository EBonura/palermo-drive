// Our own pixel art on top of the LPC layers: the Palermo details LPC does not have (caps, hats, fazzoletto, glasses, stubble, band logos, tattoos, vests, scarves, bags, bottles, dog,
// pram, wheelchair...). Drawn per 64x64 frame in the LPC manner (dark outline, tones from the generator's own cloth ramps) and placed from where the head, the garments and the hands are
// in that frame (A = the anchors of one frame, see anchorsOf).
import { ramp } from './lib.mjs';
export const F = 64;
const a = (f, x, y) => (x < 0 || y < 0 || x >= F || y >= F) ? 0 : f[(y * F + x) * 4 + 3];
const put = (f, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= F || y >= F) return; const i = (y * F + x) * 4; f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2]; f[i + 3] = 255; };
const putOn = (f, mask, x, y, c) => { if (x >= 0 && y >= 0 && x < F && y < F && mask && mask[y * F + x]) put(f, x, y, c); };
export function bbox(f) { let x0 = F, y0 = F, x1 = -1, y1 = -1; for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) if (f[(y * F + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x0, y0, x1, y1, cx: (x0 + x1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
export const maskOf = f => { const m = new Uint8Array(F * F); for (let i = 0; i < F * F; i++) m[i] = f[i * 4 + 3] ? 1 : 0; return m; };
const key = (x, y) => x + y * 100;
function shape(f, pts, tone, outline) {
  const set = new Set(pts.map(p => key(p[0], p[1]))), out = [];
  for (const [x, y] of pts) put(f, x, y, tone(x, y));
  if (outline) for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(key(x + dx, y + dy))) out.push([x + dx, y + dy]);
  for (const [x, y] of out) put(f, x, y, outline);
}
const ellipse = (cx, cy, rx, ry) => { const p = []; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / (rx + 0.3)) ** 2 + ((y - cy) / (ry + 0.3)) ** 2 <= 1) p.push([x, y]); return p; };
const rect = (x0, y0, x1, y1) => { const p = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.push([x, y]); return p; };
const lit = (R, cx, cy) => (x, y) => { const k = (x - cx) * 0.35 + (y - cy) * 0.5; return R[k < -2 ? 4 : k < 0 ? 3 : k < 2 ? 2 : 1]; };
const sideOf = dir => dir === 'left' ? -1 : dir === 'right' ? 1 : 0;

// ---------- headwear ----------
export function peakedCap(f, A, col = 'white', band = 'navy') {   // the vigile's cap: a white crown, a dark band with a gold badge, a black visor
  const { hd: h, dir } = A, s = sideOf(dir), cx = Math.round(h.cx), top = h.y0 - 2, w = h.w, white = col === 'white';
  const R = white ? [[70, 72, 84], [172, 176, 188], [222, 224, 232], [244, 244, 248], [255, 255, 255]] : ramp('cloth', col).slice(1), N = [[14, 18, 36], [30, 38, 70], [52, 62, 104]], V = [[10, 10, 14], [30, 30, 38], [58, 58, 68]], GOLD = [[120, 84, 20], [214, 170, 56], [250, 224, 120]];
  const x0 = Math.round(cx - w / 2) - 1, x1 = Math.round(cx + w / 2) + 1;
  shape(f, ellipse(cx + s, top + 4, w / 2 + 1.7, 4.6).filter(p => p[1] <= top + 5), lit(R.length > 4 ? R : [R[0], ...R], cx - 3, top + 1), R[0]);   // the crown, a little wider than the head
  for (let y = top + 6; y <= top + 7; y++) for (let x = x0 + (dir === 'front' ? 0 : 1); x <= x1 - (dir === 'front' ? 0 : 1); x++) put(f, x, y, y === top + 6 ? N[2] : N[1]);   // the dark band
  for (let x = x0; x <= x1; x++) put(f, x, top + 8, N[0]);
  if (dir === 'front') {
    shape(f, rect(cx - 1, top + 5, cx + 1, top + 7), (x, y) => y === top + 5 ? GOLD[2] : GOLD[1], GOLD[0]);   // the badge
    shape(f, rect(cx - Math.round(w / 3), top + 9, cx + Math.round(w / 3), top + 10), (x, y) => y === top + 9 ? V[2] : V[1], V[0]);   // the visor
  } else if (dir !== 'back') {
    const vx = cx + s * (Math.round(w / 2) - 1); shape(f, rect(s < 0 ? vx - 5 : vx, top + 8, s < 0 ? vx : vx + 5, top + 9), (x, y) => y === top + 8 ? V[2] : V[1], V[0]);
    put(f, cx + s * 2, top + 6, GOLD[1]);
  }
}
export function strawHat(f, A, col = 'tan', band = 'red') {
  const { hd: h } = A, R = ramp('cloth', col), Bd = ramp('cloth', band), top = h.y0 - 3, cx = h.cx, w = h.w;
  shape(f, ellipse(cx, top + 6, w / 2 + 5, 2.4), (x, y) => ((x + y) & 1) ? R[3] : R[2], R[0]); shape(f, ellipse(cx, top + 3, w / 2 - 0.5, 3.2).filter(p => p[1] <= top + 5), lit(R, cx - 2, top), R[0]);
  for (let x = Math.round(cx - w / 2 + 1); x <= Math.round(cx + w / 2 - 1); x++) put(f, x, top + 5, Bd[3]);
}
export function flatCap(f, A, col = 'brown') {   // the coppola
  const { hd: h, dir } = A, R = ramp('cloth', col), top = h.y0 - 1, cx = h.cx, w = h.w, s = sideOf(dir);
  shape(f, ellipse(cx + s, top + 3, w / 2 + 1.5, 3.2).filter(p => p[1] <= top + 4), lit(R, cx - 2, top), R[0]);
  if (dir !== 'back') shape(f, rect(Math.round(cx + s * 2 - 3), top + 5, Math.round(cx + s * 2 + 3), top + 5), () => R[1], R[0]);
  for (let x = Math.round(cx - w / 2); x < cx + w / 2; x += 2) put(f, x, top + 1, R[4]);
}
export function helmet(f, A, col = 'white') {
  const { hd: h, dir } = A, R = ramp('cloth', col), top = h.y0 - 2, cx = h.cx, w = h.w, s = sideOf(dir), D = ramp('cloth', 'charcoal');
  shape(f, ellipse(cx, top + 6, w / 2 + 1.5, 6.3).filter(p => p[1] <= top + (dir === 'front' ? 10 : 12)), lit(R, cx - 3, top + 1), R[0]);
  if (dir === 'front') { for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) put(f, x, top + 10, D[1]); shape(f, rect(Math.round(cx - 2), top + 10, Math.round(cx + 2), top + 11), () => D[2], D[0]); }
  if (dir === 'left' || dir === 'right') { for (let x = Math.round(cx - w / 2 + 3); x <= Math.round(cx + w / 2); x++) put(f, x, top + 11, D[1]); }
}
export function dark_cap(f, A, col = 'black') {   // a baseball cap worn backwards
  const { hd: h, dir } = A, R = ramp('cloth', col), top = h.y0 - 1, cx = h.cx, w = h.w, s = sideOf(dir);
  shape(f, ellipse(cx, top + 3, w / 2 + 1, 3.4).filter(p => p[1] <= top + 4), lit(R, cx - 2, top), R[0]);
  const bx = dir === 'front' ? null : dir === 'back' ? [Math.round(cx - 3), Math.round(cx + 3)] : [Math.round(cx - s * (w / 2) + (s < 0 ? 0 : -3)), Math.round(cx - s * (w / 2) + (s < 0 ? 3 : 0))];
  if (bx) shape(f, rect(bx[0], top + 4, bx[1], top + 4), () => R[1], R[0]);
}
// the nonna's fazzoletto: a black cloth over the hair, knotted under the chin
export function fazzoletto(f, A, col = 'black') {
  const { hd: h, dir } = A, R = ramp('cloth', col), s = sideOf(dir), cx = Math.round(h.cx), y0 = h.y0 - 1, y1 = h.y1, pts = [], rx = h.w / 2 + 0.8, browY = y0 + Math.round(h.h * 0.34);
  for (let y = y0; y <= y1 - 1; y++) for (let x = Math.floor(h.x0 - 1); x <= Math.ceil(h.x1 + 1); x++) {
    const dx = (x - h.cx) / rx; let inside;
    if (dir === 'front') { const lim = browY - Math.abs(dx) * 3.2 + (Math.abs(dx) > 0.6 ? 1 : 0); inside = (y <= lim && Math.abs(dx) <= 1.06) || (Math.abs(x - h.cx) > rx - 2.4 && y >= y0 + 2 && y <= y1 - 1 && Math.abs(dx) <= 1.06); }
    else if (dir === 'back') inside = y <= y1 - 1 && Math.abs(dx) <= 1.06 && y >= y0 + (Math.abs(dx) > 0.85 ? 2 : 0);
    else { const back = (x - h.cx) * s < 0.5; inside = Math.abs(dx) <= 1.06 && y >= y0 + (Math.abs(dx) > 0.8 ? 2 : 0) && ((back && y <= y1 - 1) || y <= browY - Math.abs(dx) * 1.5); }
    if (inside && a(f, x, y)) pts.push([x, y]);
  }
  shape(f, pts, lit(R, h.cx - 3, y0), null);
  const set = new Set(pts.map(p => key(p[0], p[1])));
  for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(key(x + dx, y + dy)) && a(f, x + dx, y + dy)) put(f, x + dx, y + dy, R[0]);
  // the knot under the chin: a band across the jaw, a fat knot and two tails, in lighter cloth tones than the head so that it reads against the black dress
  const K = [[6, 6, 10], [56, 58, 74], [108, 114, 136], [176, 182, 204]], knot = (kx, ky, tails) => {
    shape(f, [[kx - 1, ky], [kx, ky], [kx + 1, ky], [kx - 2, ky + 1], [kx - 1, ky + 1], [kx, ky + 1], [kx + 1, ky + 1], [kx + 2, ky + 1], [kx - 1, ky + 2], [kx, ky + 2], [kx + 1, ky + 2]], (x, y) => (x - kx + y - ky < 0 ? K[3] : (x - kx) + (y - ky) > 2 ? K[1] : K[2]), K[0]);
    for (const t of tails) shape(f, [[kx + t * 3, ky + 3], [kx + t * 4, ky + 3], [kx + t * 3, ky + 4], [kx + t * 4, ky + 4], [kx + t * 4, ky + 5], [kx + t * 5, ky + 5]], (x, y) => (y <= ky + 3 ? K[3] : K[2]), K[0]);   // the two ends, splayed
  };
  if (dir === 'front') { for (let x = cx - 4; x <= cx + 4; x++) put(f, x, y1, Math.abs(x - cx) > 2 ? R[2] : K[2]); knot(cx, y1, [-1, 1]); }
  else if (dir === 'back') shape(f, [[cx - 1, y1 - 1], [cx, y1 - 1], [cx + 1, y1 - 1], [cx - 1, y1], [cx, y1], [cx + 1, y1], [cx, y1 + 1]], (x, y) => y < y1 ? K[2] : K[1], K[0]);
  else { const kx = s < 0 ? Math.round(h.x0) + 5 : Math.round(h.x1) - 5; for (let x = kx - 3; x <= kx + 3; x++) put(f, x, y1, R[2]); knot(kx, y1, [-s]); }
}
// ---------- glasses, stubble ----------
const GL = [[18, 14, 20], [58, 34, 24], [150, 96, 44], [236, 236, 244]];   // near-black frame, a tortoiseshell brown, amber flecks, the glint on the lens
export function roundGlasses(f, A, tort = true) {   // round frames, big enough to read: two rings of 5 pixels wide, a bridge and temples
  const { hd: h, dir } = A, ey = h.y0 + Math.round(h.h * 0.5), cx = Math.round(h.cx);
  const ring = (x, y) => { for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-2, -1]]) put(f, x + dx, y + dy, (dx === -1 && dy === -2 || dx === 2 && dy === 1) && tort ? GL[2] : GL[0]); put(f, x - 1, y - 1, GL[3]); };
  if (dir === 'back') return;
  if (dir === 'front') { ring(cx - 4, ey); ring(cx + 4, ey); put(f, cx - 1, ey - 1, GL[0]); put(f, cx, ey - 1, GL[0]); put(f, cx + 1, ey - 1, GL[0]); put(f, cx - 7, ey - 1, GL[0]); put(f, cx + 7, ey - 1, GL[0]); }
  else { const s = sideOf(dir); ring(cx + s * 3, ey); for (let k = 0; k < 6; k++) put(f, cx + s * (5 + k), ey - 1, GL[0]); }
}
export function rectGlasses(f, A) {   // big dark rectangular frames, thick on the top
  const { hd: h, dir } = A, ey = h.y0 + Math.round(h.h * 0.5), cx = Math.round(h.cx), K = GL[0], Br = GL[1];
  const box = (x, y, w) => { for (let i = 0; i < w; i++) { put(f, x + i, y - 3, K); put(f, x + i, y - 2, K); put(f, x + i, y + 1, Br); } for (const yy of [-1, 0]) { put(f, x, y + yy, K); put(f, x + w - 1, y + yy, K); } put(f, x + 1, y - 1, GL[3]); };
  if (dir === 'back') return;
  if (dir === 'front') { box(cx - 7, ey, 6); box(cx + 1, ey, 6); put(f, cx - 1, ey - 2, K); put(f, cx, ey - 2, K); put(f, cx - 8, ey - 2, K); put(f, cx + 7, ey - 2, K); }
  else { const s = sideOf(dir); box(s < 0 ? cx - 7 : cx + 2, ey, 5); for (let k = 0; k < 6; k++) put(f, cx + s * (3 + k), ey - 2, K); }
}
export function stubble(f, A, skin) {
  const { hd: h, dir } = A; if (dir === 'back') return; const D = [skin[1], skin[0]], y0 = h.y0 + Math.round(h.h * 0.62), y1 = h.y1 - 1;
  for (let y = y0; y <= y1; y++) for (let x = Math.round(h.x0); x <= Math.round(h.x1); x++) {
    const i = (y * F + x) * 4; if (f[i + 3] === 0) continue;
    if (!A.skinAt(x, y)) continue; if (((x * 7 + y * 13) % 7) < 2) put(f, x, y, D[((x + y) >> 1) & 1]);
  }
}
// ---------- garments (clipped to the torso mask) ----------
const LOGO = {
  letters: [[-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0], [-3, 1], [-1, 1], [1, 1], [3, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [-3, 3], [3, 3], [-2, 4], [-1, 4], [1, 4], [2, 4]],
  skull: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-3, 1], [-2, 1], [0, 1], [2, 1], [3, 1], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2], [-2, 3], [0, 3], [2, 3], [-1, 4], [1, 4]],
  stripe: [[-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [-4, 2], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
};
export function bandPrint(f, A, kind = 'letters', col = 'white', back = false) {
  const { hd: h, dir, torso } = A; if (dir === 'left' || dir === 'right' || (dir === 'back' && !back)) return; const R = ramp('cloth', col), cx = Math.round(h.cx), cy = h.y1 + 5;
  const t = dir === 'back' ? LOGO.stripe : LOGO[kind] || LOGO.letters;
  for (const [dx, dy] of t) putOn(f, torso, cx + dx, cy + dy, R[dy === 1 ? 3 : 4]);
}
export function suitFront(f, A, tie = 'red') {   // a white shirt V and a tie between the dark jacket edges
  const { hd: h, dir, torso } = A; if (dir === 'back') return; const cx = Math.round(h.cx) + (dir === 'front' ? 0 : -sideOf(dir)), W = ramp('cloth', 'white'), T = ramp('cloth', tie), y = h.y1;
  if (dir === 'front') { for (let k = 0; k < 6; k++) for (let dx = -Math.max(0, 2 - (k >> 1)); dx <= Math.max(0, 2 - (k >> 1)); dx++) putOn(f, torso, cx + dx, y + 2 + k, W[4]); }
  for (let k = 0; k < 9; k++) putOn(f, torso, cx, y + 3 + k, k < 2 ? T[4] : T[3]); putOn(f, torso, cx, y + 12, T[2]);
}
export function leatherJacket(f, A, col = 'black') {   // a sheen on the shoulders and arms, a zip, a collar: leather over the plain long-sleeve layer
  const { hd: h, dir, torso } = A, R = ramp('cloth', col), cx = Math.round(h.cx), y1 = h.y1;
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) if (torso[y * F + x] && y >= y1 + 1 && y <= y1 + 4 && ((x + y) % 3 === 0)) put(f, x, y, R[4]);
  if (dir !== 'back') for (let y = y1 + 3; y < y1 + 15; y++) putOn(f, torso, cx + (dir === 'front' ? 0 : -sideOf(dir)), y, y % 2 ? [150, 150, 160] : R[1]);
  if (dir === 'front') { putOn(f, torso, cx - 2, y1 + 2, R[4]); putOn(f, torso, cx + 2, y1 + 2, R[4]); putOn(f, torso, cx - 1, y1 + 3, R[5]); putOn(f, torso, cx + 1, y1 + 3, R[5]); }
  for (let y = y1 + 5; y < y1 + 15; y++) for (let x = 0; x < F; x++) if (torso[y * F + x] && (!torso[y * F + x - 1] || !torso[y * F + x + 1]) && (x + y) % 2) put(f, x, y, R[3]);
}
export function patches(f, A, cols = ['red', 'white', 'sky', 'yellow']) {   // patches on a denim vest, most on the back
  const { hd: h, dir, torso } = A; if (dir === 'left' || dir === 'right') return; const y1 = h.y1, cx = Math.round(h.cx), n = dir === 'back' ? 6 : 3;
  for (let k = 0; k < n; k++) { const R = ramp('cloth', cols[k % cols.length]), px = cx + ((k * 7) % 9) - 4, py = y1 + 4 + ((k * 5) % 7); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) putOn(f, torso, px + dx, py + dy, dx + dy === 0 ? R[4] : R[3]); }
}
export function rosaScarf(f, A, c1 = 'rosanero', c2 = 'black') {   // the match-day scarf: pink and black bars around the neck and two tails down the chest
  const { hd: h, dir, torso } = A, P = ramp('cloth', c1), K = ramp('cloth', c2), cx = Math.round(h.cx), y = h.y1 - 1;
  const w = dir === 'front' || dir === 'back' ? 4 : 3; for (let x = cx - w; x <= cx + w; x++) for (let k = 0; k < 3; k++) put(f, x, y + k, (Math.floor((x + 40) / 2) & 1) ? P[3] : K[2]);
  if (dir === 'front') for (const dx of [-1, 1]) for (let k = 0; k < 7; k++) putOn(f, torso, cx + dx, y + 3 + k, ((k >> 1) & 1) ? K[2] : P[3]);
}
export function bandolier(f, A, col = 'white') {
  const { hd: h, torso } = A, R = ramp('cloth', col), cx = h.cx, y1 = h.y1; for (let k = 0; k < 12; k++) for (const dy of [0, 1]) putOn(f, torso, Math.round(cx - 5 + k * 0.9), y1 + 3 + k * 0.8 + dy, k % 2 ? R[4] : R[3]);
}
export function chain(f, A, col = 'yellow') {
  const { hd: h, dir } = A; if (dir === 'back') return; const R = ramp('cloth', col), cx = Math.round(h.cx), y = h.y1; for (const [dx, dy] of [[-3, 0], [-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1], [3, 0]]) put(f, cx + dx - (dir === 'front' ? 0 : sideOf(dir) * 2), y + dy + 1, R[4]);
}
export function stripe(f, A, col = 'white') {   // the tracksuit stripe on the outer edge of sleeves and legs
  const { dir, torso, bodyMask } = A; if (dir === 'left' || dir === 'right') return; const R = ramp('cloth', col);
  for (const m of [torso, bodyMask]) if (m) for (let y = 0; y < F; y++) { let x0 = -1, x1 = -1; for (let x = 0; x < F; x++) if (m[y * F + x]) { if (x0 < 0) x0 = x; x1 = x; } if (x0 >= 0 && y > A.hd.y1 + 5 && y < A.hd.y1 + 30) { put(f, x0 + 1, y, R[4]); put(f, x1 - 1, y, R[4]); } }
}
export function ripKnees(f, A, skin) {
  const { hd: h, dir } = A; if (dir !== 'front') return; const cy = h.y1 + 20, cx = Math.round(h.cx);
  for (const dx of [-4, 3]) for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]]) if (a(f, cx + dx + x, cy + y)) put(f, cx + dx + x, cy + y, skin[3]);
}
export function tattoo(f, A, where = 'arms', ink = [[40, 52, 84], [70, 86, 120]]) {   // ink over the skin of the arms (and the neck)
  const { hd: h, dir } = A; const y0 = where === 'neck' ? h.y1 - 1 : h.y1 + 4, y1 = where === 'neck' ? h.y1 + 2 : h.y1 + 24;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < F; x++) {
    if (!A.skinAt(x, y)) continue; if (where === 'neck' && Math.abs(x - h.cx) > 3) continue;
    if (((x * 3 + y * 5) % 7 < 3) || y % 4 === 0) put(f, x, y, ink[(x + y) & 1]);
  }
}
export function earring(f, A, col = 'silver') { const { hd: h, dir } = A; if (dir === 'back') return; const y = h.y0 + Math.round(h.h * 0.62); put(f, Math.round(h.x0) + (dir === 'right' ? 12 : 0), y, [225, 225, 235]); if (dir === 'front') put(f, Math.round(h.x1), y, [225, 225, 235]); }
// ---------- things in the hand ----------
export function bottle(f, x, y, col = 'forest', tilt = 0) {
  const R = ramp('cloth', col); for (let k = 0; k < 5; k++) put(f, x + (k > 3 ? tilt : 0), y - k, k < 2 ? R[3] : R[2]); put(f, x + tilt, y - 5, R[1]); put(f, x + tilt, y - 6, R[0]); put(f, x + 1, y - 2, R[4]); put(f, x - 1, y - 2, R[1]);
}
export function glass(f, x, y, col = 'orange') { const R = ramp('cloth', col); shape(f, rect(x - 1, y - 4, x + 1, y), (px, py) => (py === y - 4 ? [245, 240, 230] : R[3]), R[0]); }
export function bag(f, x, y, col = 'forest') { const R = ramp('cloth', col); shape(f, rect(x - 2, y, x + 2, y + 5), (px, py) => (py === y ? R[1] : R[3]), R[0]); put(f, x - 1, y - 1, R[0]); put(f, x + 1, y - 1, R[0]); put(f, x - 1, y - 2, R[0]); put(f, x + 1, y - 2, R[0]); }
export function purse(f, x, y, col = 'brown') { const R = ramp('cloth', col); shape(f, rect(x - 2, y, x + 2, y + 3), (px, py) => (py === y ? R[1] : R[3]), R[0]); put(f, x, y + 1, [230, 200, 80]); }
export function briefcase(f, x, y, col = 'walnut') { const R = ramp('cloth', col); shape(f, rect(x - 3, y, x + 3, y + 5), (px, py) => (py === y + 2 ? R[1] : R[3]), R[0]); put(f, x, y + 2, [230, 200, 80]); put(f, x - 1, y - 1, R[0]); put(f, x, y - 1, R[0]); put(f, x + 1, y - 1, R[0]); }
export function phone(f, x, y) { shape(f, rect(x, y, x + 1, y + 2), (px, py) => (py === y ? [200, 230, 255] : [40, 40, 50]), [10, 10, 14]); }
export function helmetHand(f, x, y, col = 'white') { const R = ramp('cloth', col); shape(f, ellipse(x, y + 3, 3, 2.6), lit(R, x - 1, y + 1), R[0]); put(f, x, y + 4, [30, 30, 36]); }
export function backpack(f, A, col = 'rose') {
  const { hd: h, dir } = A, R = ramp('cloth', col), cx = Math.round(h.cx), y = h.y1 + 3, s = sideOf(dir);
  if (dir === 'back') shape(f, rect(cx - 5, y, cx + 5, y + 11), (px, py) => (py > y + 7 ? R[2] : R[3]), R[0]);
  else if (dir === 'front') { for (let k = 0; k < 9; k++) { put(f, cx - 4, y + k, R[1]); put(f, cx + 4, y + k, R[1]); } put(f, cx - 6, y + 7, R[3]); put(f, cx + 6, y + 7, R[3]); }
  else shape(f, rect(cx - s * 6 - (s < 0 ? 0 : 3), y + 1, cx - s * 6 + (s < 0 ? 3 : 0), y + 11), (px, py) => (py > y + 7 ? R[2] : R[3]), R[0]);
}
// the dog on its lead (a small trotting dog just in front of the walker's feet)
export function dog(f, A, col = 'tan', pose = 0) {   // a small dog on a lead beside the walker, about 0.4 m high
  const { hd: h, dir } = A, R = ramp('cloth', col), dark = ramp('cloth', 'charcoal'), s = dir === 'front' || dir === 'back' ? 0 : sideOf(dir), fy = Math.min(62, h.y1 + 26), cx = Math.round(h.cx), step = pose === 1 ? 1 : pose === 3 ? -1 : 0;
  const tone = (x, y, top) => (y <= top ? R[4] : y >= top + 3 ? R[2] : R[3]);
  if (s) {   // from the side, facing the same way as the walker: u runs to the front of the dog, v up from the ground
    const fx = cx + s * 9, X = u => fx + s * u, Y = v => fy - 1 - v, put2 = (u, v, c) => put(f, X(u), Y(v), c), at = (u0, v0, u1, v1) => rect(Math.min(X(u0), X(u1)), Y(v1), Math.max(X(u0), X(u1)), Y(v0));
    for (const [u, k] of [[-4, 1], [-3, -1], [2, -1], [3, 1]]) { const x = X(u) + step * k; shape(f, [[x, Y(0)], [x, Y(1)], [x, Y(2)], [x, Y(3)]], (px, py) => py === Y(0) ? R[1] : R[2], R[0]); }   // four legs, swinging
    shape(f, at(-5, 4, 3, 8), (x, y) => tone(x, y, Y(8)), R[0]);                                  // the body
    shape(f, at(4, 6, 7, 10), (x, y) => tone(x, y, Y(10)), R[0]);                                  // the head
    shape(f, at(7, 6, 8, 8), () => R[2], R[0]); put2(8, 8, dark[1]);                              // the snout and its nose
    shape(f, at(3, 10, 4, 12), () => R[1], R[0]); put2(6, 9, dark[0]);                             // the ear and the eye
    shape(f, [[X(-6), Y(8)], [X(-7), Y(9)], [X(-7), Y(10)]], () => R[3], R[0]);                    // the tail up
    for (let u = -4; u <= 2; u += 2) put2(u, 8, R[5] || R[4]);
  } else if (dir === 'front') {
    const fx = cx + 8;
    shape(f, rect(fx - 3, fy - 8, fx + 3, fy - 4), (x, y) => tone(x, y, fy - 8), R[0]);                 // the chest
    shape(f, rect(fx - 3, fy - 3, fx - 2, fy - 1), (x, y) => y === fy - 1 ? R[1] : R[2], R[0]); shape(f, rect(fx + 2, fy - 3, fx + 3, fy - 1), (x, y) => y === fy - 1 ? R[1] : R[2], R[0]);
    shape(f, rect(fx - 2, fy - 12, fx + 2, fy - 8), (x, y) => tone(x, y, fy - 12), R[0]);               // the head
    shape(f, [[fx - 3, fy - 13], [fx - 3, fy - 12], [fx - 3, fy - 11]], () => R[1], R[0]); shape(f, [[fx + 3, fy - 13], [fx + 3, fy - 12], [fx + 3, fy - 11]], () => R[1], R[0]);   // the ears
    put(f, fx - 1, fy - 10, dark[0]); put(f, fx + 1, fy - 10, dark[0]); put(f, fx, fy - 8, dark[1]);
  } else {
    const fx = cx + 8;
    shape(f, rect(fx - 3, fy - 9, fx + 3, fy - 4), (x, y) => tone(x, y, fy - 9), R[0]);
    shape(f, rect(fx - 3, fy - 3, fx - 2, fy - 1), (x, y) => y === fy - 1 ? R[1] : R[2], R[0]); shape(f, rect(fx + 2, fy - 3, fx + 3, fy - 1), (x, y) => y === fy - 1 ? R[1] : R[2], R[0]);
    shape(f, rect(fx - 2, fy - 12, fx + 2, fy - 10), (x, y) => R[3], R[0]); shape(f, [[fx, fy - 10], [fx + 1, fy - 11], [fx + 1, fy - 12]], () => R[3], R[0]);   // the head over the shoulder, the tail
  }
}
export function stroller(f, A, c1 = 'sky', c2 = 'navy') {   // a pram pushed in front of the mother, nearly as high as her hip
  const { hd: h, dir } = A, R = ramp('cloth', c1), S = ramp('cloth', c2), s = dir === 'front' || dir === 'back' ? 0 : sideOf(dir), fy = Math.min(62, h.y1 + 27), cx = Math.round(h.cx), wheel = [[34, 34, 42], [58, 58, 68]], ink = [10, 10, 14];
  if (s) {
    const px = cx + s * 12, X = u => px + s * u, Y = v => fy - 1 - v, at = (u0, v0, u1, v1) => rect(Math.min(X(u0), X(u1)), Y(v1), Math.max(X(u0), X(u1)), Y(v0));
    for (let k = 0; k < 9; k++) put(f, X(-6 - k), Y(10 + (k >> 1)), [20, 20, 26]);                                            // the handle, back to the mother's hands
    put(f, X(-6), Y(9), [20, 20, 26]);
    shape(f, at(-6, 4, 6, 9), (x, y) => (y === Y(9) ? S[4] : y === Y(4) ? S[1] : S[2]), S[0]);                                // the basket
    shape(f, ellipse(X(-2), Y(11), 5.2, 3), lit(R, X(-2) - 2, Y(13)), R[0]);                                                   // the hood
    shape(f, rect(X(-3) < X(3) ? X(-3) : X(3), Y(3), X(-3) < X(3) ? X(3) : X(-3), Y(3)), () => [90, 90, 100], ink);            // the frame
    for (const u of [-4, 4]) { shape(f, ellipse(X(u), Y(1.5), 2.4, 2.4), (x, y) => (x + y) & 1 ? wheel[0] : wheel[1], ink); put(f, X(u), Y(1), [190, 190, 200]); }   // two wheels
  } else {
    const px = cx;
    shape(f, rect(px - 6, fy - 10, px + 6, fy - 5), (x, y) => (y === fy - 10 ? S[4] : y === fy - 5 ? S[1] : S[2]), S[0]);
    shape(f, ellipse(px, fy - 12, 6, 3), lit(R, px - 2, fy - 14), R[0]);
    for (const dx of [-6, 6]) shape(f, ellipse(px + dx, fy - 2, 2.2, 2.2), (x, y) => (x + y) & 1 ? wheel[0] : wheel[1], ink);
    shape(f, rect(px - 5, fy - 4, px + 5, fy - 4), () => [90, 90, 100], ink);
  }
}
// ---------- hands and anchors ----------
export function handsOf(f, A, y0, y1) {
  const { hd: h, dir } = A, found = [];
  for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = 2; x < F - 2; x++) if (A.skinAt(x, y)) found.push([x, y]);
  if (!found.length) return { l: { x: Math.round(h.cx - 9), y: Math.round(h.y1 + 20) }, r: { x: Math.round(h.cx + 9), y: Math.round(h.y1 + 20) } };
  const lowest = pts => pts.reduce((b, p) => (!b || p[1] > b[1] || (p[1] === b[1] && Math.abs(p[0] - h.cx) > Math.abs(b[0] - h.cx))) ? p : b, null);
  if (dir === 'left' || dir === 'right') { const p = lowest(found); return { l: { x: p[0], y: p[1] }, r: { x: p[0], y: p[1] } }; }
  const L = found.filter(p => p[0] < h.cx), Rr = found.filter(p => p[0] >= h.cx), pl = L.length ? lowest(L) : [h.cx - 9, h.y1 + 20], pr = Rr.length ? lowest(Rr) : [h.cx + 9, h.y1 + 20];
  return { l: { x: pl[0], y: pl[1] }, r: { x: pr[0], y: pr[1] } };
}
// a bottle held up to the mouth: a 2 pixel body, a neck and a cap, outlined, so it reads as a bottle and not as a line across the face
function bottleUp(f, x, y, col) {
  const R = ramp('cloth', col), pts = [...rect(x - 1, y - 4, x, y), [x, y - 5], [x, y - 6]];
  shape(f, pts, (px, py) => py <= y - 5 ? R[2] : px === x - 1 ? R[4] : R[2], R[0]); put(f, x, y - 6, [230, 220, 190]); put(f, x - 1, y - 1, R[5]);
}
// the arm that raises a drink to the mouth. The hanging forearm of the LPC pose is taken away and redrawn bent up: a thick, outlined forearm in the colour of the sleeve (or the skin),
// a fist, and the bottle or glass at the mouth. Standing: the elbow stays where it was. Sitting (A.sit): the hand that rests on the knee brings the drink up.
export function sip(f, A, hand, skin, kind, col) {
  const { hd: h, dir } = A, s = sideOf(dir), cx = Math.round(h.cx), sit = !!A.sit, my = h.y0 + Math.round(h.h * 0.72), shown = dir !== 'back';
  const skinAt = (x, y) => A.skinAt(x, y), runMid = (x, y) => { let a0 = x, a1 = x; while (skinAt(a0 - 1, y)) a0--; while (skinAt(a1 + 1, y)) a1++; return Math.round((a0 + a1) / 2); };
  let hx = runMid(hand.x, hand.y), hy = hand.y;
  if (sit) {   // the hand on the knee: the skin below the chin that sticks out furthest to the front
    const pts = []; for (let y = Math.round(h.y1) + 1; y <= Math.round(h.y1) + 14; y++) for (let x = 2; x < F - 2; x++) if (skinAt(x, y)) pts.push([x, y]);
    if (pts.length) { const fx0 = pts.reduce((m, p) => Math.min(m, s > 0 ? -p[0] : p[0]), 1e9), near = pts.filter(p => (s > 0 ? -p[0] : p[0]) <= fx0 + 4); hx = Math.round(near.reduce((t, p) => t + p[0], 0) / near.length); hy = Math.round(near.reduce((t, p) => t + p[1], 0) / near.length); }
  }
  const side = s || (hx >= cx ? 1 : -1), ex = hx, ey = sit ? hy : hy - 5, base = my + (kind === 'glass' ? 4 : 6);
  const fx = dir === 'front' ? cx + side * 2 : dir === 'back' ? cx + side * 6 : (s < 0 ? Math.round(h.x0) + 3 : Math.round(h.x1) - 3);
  // the colour of the arm: the sleeve or skin just above the elbow
  let ac = [skin[3][0], skin[3][1], skin[3][2]], sleeve = false;
  for (let k = 2; k < 8 && !sit; k++) { const i = ((ey - k) * F + hx) * 4; if (ey - k >= 0 && f[i + 3]) { ac = [f[i], f[i + 1], f[i + 2]]; sleeve = !skinAt(hx, ey - k); break; } }
  // take the hanging forearm away
  if (!sit) {
    if (dir === 'front' || dir === 'back') { for (let y = ey + 1; y <= hy + 2; y++) for (let x = 0; x < F; x++) if (side * (x - cx) >= 9) f[(y * F + x) * 4 + 3] = 0; }
    else {
      const kill = []; for (let y = ey + 1; y <= hy + 2; y++) for (let x = hx - 3; x <= hx + 3; x++) if (skinAt(x, y)) kill.push([x, y]);
      const ks = new Set(kill.map(p => key(p[0], p[1])));
      for (const [x, y] of kill) { let c = null; for (let d = 1; d < 9 && !c; d++) for (const sx of [x - d, x + d]) { if (sx < 0 || sx >= F || ks.has(key(sx, y)) || skinAt(sx, y)) continue; const i = (y * F + sx) * 4; if (f[i + 3]) { c = [f[i], f[i + 1], f[i + 2]]; break; } } const i = (y * F + x) * 4; if (c) { f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2]; } else f[i + 3] = 0; }
    }
  }
  // the forearm: a thick stroke from the elbow to the fist, light on its upper edge, dark on its lower edge, outlined
  const tx = fx, ty = base - 1, n = Math.max(Math.abs(tx - ex), Math.abs(ty - ey), 1), pts = [], seen = new Set();
  for (let k = 0; k <= n; k++) { const px = ex + (tx - ex) * k / n, py = ey + (ty - ey) * k / n; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = Math.round(px) + dx, y = Math.round(py) + dy; if ((x - px) ** 2 + (y - py) ** 2 <= 2.6 && !seen.has(key(x, y))) { seen.add(key(x, y)); pts.push([x, y]); } } }
  const light = ac.map(v => Math.min(255, v + 26)), dark = ac.map(v => Math.round(v * 0.78)), line = sleeve ? ac.map(v => Math.round(v * 0.3)) : skin[0];
  shape(f, pts, (x, y) => (!seen.has(key(x - 1, y - 1)) || !seen.has(key(x, y - 1))) ? light : (!seen.has(key(x + 1, y + 1)) || !seen.has(key(x, y + 1))) ? dark : ac, line);
  if (shown) {
    shape(f, rect(fx - 1, base - 2, fx + 1, base), (x, y) => (y === base - 2 ? skin[4] : skin[3]), skin[0]);   // the fist round the bottle
    if (kind === 'glass') glass(f, fx, base - 1, col); else bottleUp(f, fx, base, col);
  } else shape(f, rect(fx - 1, base - 1, fx + 1, base + 1), () => skin[3], skin[0]);
}
// ---------- the officina's mechanic (assets/peds/lpc/garage.png only) ----------
export function wrench(f, x, y, s = 1) {   // an open-ended spanner held up, a little forward
  const M = [[44, 48, 56], [120, 126, 136], [178, 184, 194], [232, 236, 244]];
  for (let k = 0; k < 8; k++) { const px = x + Math.round(s * k * 0.25); put(f, px, y - 1 - k, M[2]); put(f, px + 1, y - 1 - k, M[1]); put(f, px - 1, y - 1 - k, M[0]); }
  const hx = x + Math.round(s * 2), hy = y - 10;
  shape(f, [[hx - 1, hy], [hx - 1, hy + 1], [hx, hy + 1], [hx + 1, hy + 1], [hx + 2, hy + 1], [hx + 2, hy], [hx - 1, hy - 1], [hx + 2, hy - 1]], (px, py) => py === hy - 1 ? M[3] : M[2], M[0]);
}
export function rag(f, A, col = 'red') {   // a rag in the back pocket, hanging at the hip
  const { hd: h, dir } = A, R = ramp('cloth', col), s = sideOf(dir), x = dir === 'back' ? Math.round(h.cx) + 5 : dir === 'front' ? Math.round(h.cx) - 7 : Math.round(h.cx) + (s < 0 ? 5 : -5), y = Math.round(h.y1) + 12;
  shape(f, [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1], [x + 1, y + 2]], (px, py) => (py === y ? R[4] : R[3]), R[0]);
}
export function bib(f, A, col = 'navy') {   // the bib of the dungarees: a darker panel with a pocket, and the straps over the shoulders
  const { hd: h, dir } = A; if (dir === 'left' || dir === 'right') return;
  const R = ramp('cloth', col), cx = Math.round(h.cx), y0 = Math.round(h.y1) + 3, y1 = y0 + 8;
  for (let y = y0 - 3; y <= y1; y++) for (let x = cx - 5; x <= cx + 5; x++) {
    const strap = y < y0 && (Math.abs(x - cx) === 4 || Math.abs(x - cx) === 5), panel = y >= y0 && Math.abs(x - cx) <= 4 && dir === 'front';
    if ((strap || panel) && A.torso[y * F + x]) put(f, x, y, strap ? R[2] : (y === y0 ? R[1] : R[2]));
  }
  if (dir === 'front') { for (let x = cx - 2; x <= cx + 2; x++) { put(f, x, y0 + 2, R[1]); put(f, x, y0 + 5, R[1]); } put(f, cx - 2, y0 + 3, R[1]); put(f, cx + 2, y0 + 3, R[1]); put(f, cx - 4, y0 - 1, [236, 200, 90]); put(f, cx + 4, y0 - 1, [236, 200, 90]); }
}
export const GLASSY = { GL };
