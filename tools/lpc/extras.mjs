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
export function peakedCap(f, A, col = 'white', band = 'yellow') {
  const { hd: h, dir } = A, R = ramp('cloth', col), B = ramp('cloth', band), top = h.y0 - 1, cx = h.cx, w = h.w, s = sideOf(dir);
  shape(f, ellipse(cx + s, top + 4, w / 2 + 1, 4.2).filter(p => p[1] <= top + 5), lit(R, cx - 2, top + 1), R[0]);
  for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) { put(f, x, top + 5, B[3]); put(f, x, top + 6, R[1]); }
  if (dir !== 'back') shape(f, dir === 'front' ? rect(Math.round(cx - w / 3), top + 6, Math.round(cx + w / 3), top + 7) : rect(Math.round(cx + s * (w / 2 - 1)) - (s < 0 ? 4 : 0), top + 6, Math.round(cx + s * (w / 2 - 1)) + (s > 0 ? 4 : 0), top + 7), () => R[1], R[0]);
  put(f, Math.round(cx), top + 5, B[5]);
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
  if (dir === 'front') { for (let x = cx - 3; x <= cx + 3; x++) put(f, x, y1, Math.abs(x - cx) > 2 ? R[1] : R[2]); shape(f, [[cx - 1, y1 + 1], [cx, y1 + 1], [cx + 1, y1 + 1], [cx - 2, y1 + 2], [cx + 2, y1 + 2]], (x, y) => R[3 - (y > y1 + 1 ? 1 : 0)], R[0]); }
  else if (dir === 'back') shape(f, [[cx - 1, y1 - 1], [cx, y1 - 1], [cx + 1, y1 - 1], [cx - 1, y1], [cx + 1, y1]], () => R[2], R[0]);
  else shape(f, [[Math.round(h.cx - s * 3), y1], [Math.round(h.cx - s * 3 - s), y1 + 1], [Math.round(h.cx - s * 3 + s), y1 + 1]], () => R[2], R[0]);
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
export function dog(f, A, col = 'tan', pose = 0) {
  const { hd: h, dir } = A, R = ramp('cloth', col), dark = ramp('cloth', 'charcoal'), s = dir === 'front' || dir === 'back' ? 0 : sideOf(dir), fy = Math.min(62, h.y1 + 26), fx = Math.round(h.cx) + (s ? s * 11 : 8), leg = pose === 1 || pose === 3 ? 1 : 0, sw = (pose === 1) ? 1 : (pose === 3) ? -1 : 0;
  if (s) { shape(f, rect(fx - 4, fy - 6, fx + 3, fy - 3), (x, y) => (y === fy - 6 ? R[4] : R[3]), R[0]); shape(f, rect(fx + (s < 0 ? -7 : 4), fy - 8, fx + (s < 0 ? -5 : 6), fy - 5), () => R[3], R[0]); put(f, fx + (s < 0 ? -8 : 7), fy - 6, dark[1]); for (const [dx, k] of [[-3, 1], [-1, -1], [1, 1], [3, -1]]) { put(f, fx + dx + sw * k, fy - 2, R[2]); put(f, fx + dx + sw * k, fy - 1, R[1]); } put(f, fx + (s < 0 ? 4 : -5), fy - 7, R[2]); }
  else { shape(f, rect(fx - 3, fy - 6, fx + 3, fy - 3), (x, y) => (y === fy - 6 ? R[4] : R[3]), R[0]); shape(f, rect(fx - 2, fy - 8, fx + 2, fy - 6), () => R[3], R[0]); put(f, fx - 3, fy - 2 + leg, R[1]); put(f, fx + 3, fy - 2 - leg, R[1]); }
}
export function stroller(f, A, c1 = 'sky', c2 = 'navy') {   // a pram pushed in front of the mother
  const { hd: h, dir } = A, R = ramp('cloth', c1), S = ramp('cloth', c2), s = dir === 'front' || dir === 'back' ? 0 : sideOf(dir), fy = Math.min(62, h.y1 + 27), cx = Math.round(h.cx), px = s ? cx + s * 10 : cx;
  if (s) { shape(f, rect(px - 5, fy - 9, px + 5, fy - 5), (x, y) => (y === fy - 9 ? S[4] : S[2]), S[0]); shape(f, ellipse(px - s * 2, fy - 11, 4, 2.2), lit(R, px - 2, fy - 12), R[0]); for (const dx of [-4, 4]) shape(f, ellipse(px + dx, fy - 2, 2, 2), () => [30, 30, 36], [10, 10, 14]); for (let k = 0; k < 6; k++) put(f, px - s * (6 + k), fy - 9 - (k >> 1), [20, 20, 26]); }
  else { shape(f, rect(px - 5, fy - 9, px + 5, fy - 5), (x, y) => (y === fy - 9 ? S[4] : S[2]), S[0]); shape(f, ellipse(px, fy - 11, 5, 2.4), lit(R, px - 2, fy - 12), R[0]); put(f, px - 5, fy - 2, [30, 30, 36]); put(f, px + 5, fy - 2, [30, 30, 36]); }
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
// the forearm that raises a drink to the mouth: a few skin pixels from the hand up to the chin, and the bottle on top
export function sip(f, A, hand, skin, kind, col) {
  const { hd: h, dir } = A, my = h.y0 + Math.round(h.h * 0.8), s = sideOf(dir), tx = dir === 'front' ? Math.round(h.cx) - 3 : dir === 'back' ? Math.round(h.cx) + 3 : Math.round(h.cx + s * -4);
  // the arm colour: whatever the forearm above the hand is made of (a sleeve or skin)
  let ac = [skin[3][0], skin[3][1], skin[3][2]]; for (let k = 3; k < 8; k++) { const i = ((hand.y - k) * F + hand.x) * 4; if (hand.y - k >= 0 && f[i + 3]) { ac = [f[i], f[i + 1], f[i + 2]]; break; } }
  const ex = hand.x + (tx > hand.x ? 1 : -1) * 1, ey = Math.max(my + 5, hand.y - 6);   // up first (the elbow stays at the side), then in to the mouth
  const seg = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; put(f, x, y, ac); put(f, x + (tx > hand.x ? 1 : -1), y, ac); } };
  seg(hand.x, hand.y - 1, ex, ey); seg(ex, ey, tx, my + 4); put(f, tx, my + 4, skin[3]); put(f, tx + 1, my + 4, skin[3]);
  if (kind === 'glass') glass(f, tx, my + 3, col); else bottle(f, tx, my + 4, col, 0);
}
export const GLASSY = { GL };
