// Heads for the pedestrian sprites: skin, ears, eyes, brows, nose, mouth, stubble and beards, glasses, hair styles and hats,
// in front, back and side (facing left) views. Owned by the pedestrian work. Coordinates are in 48 x 96 cell pixels; the head is centred on x = 24.
import { sh, mix, T, hs, row, ell } from './px.js';

const CX = 24;
const INK = '#2a1c1a', WHITE = '#ece6df';

// half width of the front-facing head on row j (0 = top): rounded crown, full cheeks, narrowing jaw
export function headHalf(j, hh, hw) {
  const u = (j + 0.5) / hh, H2 = hw / 2; let f;
  if (u < 0.28) { const t = (0.28 - u) / 0.28; f = Math.sqrt(1 - t * t * 0.9); }
  else if (u < 0.58) f = 1;
  else { const t = (u - 0.58) / 0.42; f = 1 - 0.5 * Math.pow(t, 1.6); }
  return Math.max(2, Math.round(H2 * f));
}
// front and back insets of the side-facing head on row j (the face looks to the left)
function sideIn(j, hh, ws) {
  const u = (j + 0.5) / hh; let fi = 0, bi = 0;
  if (u < 0.24) { const t = (0.24 - u) / 0.24, r = 1 - Math.sqrt(1 - t * t * 0.92); fi = Math.round(r * ws * 0.42); bi = Math.round(r * ws * 0.4); }
  if (u > 0.55) { const t = (u - 0.55) / 0.45; fi += Math.round(3.2 * Math.pow(t, 1.7)); bi += Math.round(6 * Math.pow(t, 1.4)); }
  return [fi, bi];
}

// fill hair spans [y, x0, x1) with strand texture: streaks, shine and a shaded side and underside
function paintHair(P, S, c, o = {}) {
  if (!S.length) return;
  const t = T(c), str = o.str || 2, sn = o.shine; let xmin = 99, xmax = -99, ymax = -99;
  for (const [y, a, b] of S) { if (a < xmin) xmin = a; if (b > xmax) xmax = b; if (y > ymax) ymax = y; }
  for (const [y, a, b] of S) for (let x = a; x < b; x++) {
    const n = hs(x * 7 + (o.seed || 0), Math.floor(y / str)), n2 = hs(x, y);
    let col = c;
    if (n < 0.2) col = t.d; else if (n > 0.9) col = t.l;
    if (sn) { const dx = (x - sn[0]) / sn[2], dy = (y - sn[1]) / sn[3], r = dx * dx + dy * dy; if (r < 1 && n2 < (r < 0.45 ? 0.85 : 0.5)) col = r < 0.3 && n2 < 0.5 ? sh(c, 1.5) : t.l; }
    if (x >= xmax - 2 && col !== t.l) col = t.d;
    if (o.dark && y >= o.dark) col = n < 0.4 ? t.dd : t.d;
    P(x, y, 1, 1, col);
  }
}

// ---------- front and back ----------
export function headFront(g, v, ht, hw, hh, back, skin, hairC) {
  const P = (x, y, w, h, c) => g.P(x, y, w, h, c), sk = T(skin), hf = j => headHalf(j, hh, hw);
  const ey = ht + Math.round(hh * 0.5), my = ey + (hh >= 18 ? 5 : 4), hs_ = v.hairStyle || 'short';
  const browC = sh(v.beard || hairC, 0.85);
  // skull
  for (let j = 0; j < hh; j++) {
    const h = hf(j), x0 = CX - h, x1 = CX + h, y = ht + j;
    row(P, y, x0, x1, skin);
    if (h > 3) { P(x0, y, 1, 1, sh(skin, 1.06)); P(x1 - 2, y, 2, 1, sk.d); if (j > hh * 0.6) P(x1 - 3, y, 1, 1, sk.d); }
    if (j >= hh - 2) row(P, y, x0 + 1, x1 - 1, j === hh - 1 ? sk.d : sh(skin, 0.93));
  }
  P(CX - 6, ht + 3, 4, 2, sh(skin, 1.07));                               // forehead highlight
  // ears
  for (const s of [-1, 1]) { const h = hf(ey - ht), ex = s < 0 ? CX - h - 1 : CX + h - 1; P(ex, ey - 1, 2, 4, s < 0 ? skin : sk.d); P(ex + (s < 0 ? 0 : 1), ey, 1, 2, sk.dd); }
  if (back) { P(CX - 3, ht + hh - 3, 6, 3, sk.d); return; }
  // eyes (3 x 2), brows, nose, mouth
  const eyeL = CX - 5, eyeR = CX + 2, iris = v.eyes || '#3a2a20';
  for (const ex of [eyeL, eyeR]) {
    P(ex, ey, 3, 1, INK); P(ex, ey + 1, 3, 1, WHITE); P(ex + 1, ey + 1, 1, 1, iris);
    P(ex - 1, ey - 3, 5, 1, browC); P(ex + (ex === eyeL ? 3 : -1), ey - 2, 1, 1, sh(browC, 1.1));
    P(ex, ey + 2, 3, 1, sk.d);                                            // lower lid and eye bag
  }
  P(CX - 1, ey + 1, 1, 3, sh(skin, 1.1)); P(CX, ey + 1, 1, 3, sk.d);      // nose bridge light, side shade
  P(CX - 2, ey + 3, 1, 1, sk.d); P(CX + 1, ey + 3, 1, 1, sk.d); P(CX - 1, ey + 4, 2, 1, sk.dd);
  P(CX - 5, ey + 3, 2, 1, mix(skin, '#e07a72', 0.3)); P(CX + 3, ey + 3, 2, 1, mix(skin, '#e07a72', 0.25));   // cheeks
  const lip = mix(skin, '#b0484a', 0.4), lipD = mix(skin, '#5a2428', 0.55);
  if (v.beard) {                                                          // full beard with a dithered top edge, the mouth left clear
    for (let j = ey + 3 - ht; j < hh; j++) {
      const h = hf(j), y = ht + j;
      for (let x = CX - h; x < CX + h; x++) { if (j === ey + 3 - ht && (x + y) & 1) continue; const n = hs(x, y); P(x, y, 1, 1, x >= CX + h - 3 ? sh(v.beard, 0.8) : n < 0.2 ? sh(v.beard, 1.5) : n > 0.8 ? sh(v.beard, 0.8) : v.beard); }
    }
    P(CX - 3, my - 1, 6, 3, mix(skin, v.beard, 0.15)); P(CX - 3, my + 2, 6, 1, sk.d);
  } else if (v.stubble) {
    const sc = mix(skin, v.stubble, 0.45);
    for (let j = ey + 3 - ht; j < hh; j++) { const h = hf(j), y = ht + j; for (let x = CX - h + 1; x < CX + h - 1; x++) if (((x + y) & 1) === 0 && !(Math.abs(x - 23.5) < 3 && y >= my - 1 && y <= my + 1)) P(x, y, 1, 1, sc); }
  }
  if (v.smile === 2) { P(CX - 3, my, 1, 1, lipD); P(CX + 2, my, 1, 1, lipD); P(CX - 2, my, 4, 1, lipD); P(CX - 2, my + 1, 4, 1, '#f4efe6'); P(CX - 2, my + 2, 4, 1, lip); P(CX - 3, my + 1, 1, 1, lipD); P(CX + 2, my + 1, 1, 1, lipD); }
  else if (v.smile) { P(CX - 3, my, 1, 1, lipD); P(CX + 2, my, 1, 1, lipD); P(CX - 2, my + 1, 4, 1, lipD); P(CX - 1, my + 2, 2, 1, lip); }
  else { P(CX - 2, my, 4, 1, lipD); P(CX - 2, my + 1, 4, 1, lip); }
  hairFront(g, v, ht, hw, hh, ey, false, skin, hairC, hs_);
  if (v.eyes !== undefined || true) glassesFront(g, v, ey, hw);
}

function glassesFront(g, v, ey, hw) {
  const P = (x, y, w, h, c) => g.P(x, y, w, h, c), tint = '#cfe0ee';
  if (v.bigGlasses) {                                                      // dark sunglasses
    const c = v.bigGlasses, hx0 = CX - hw / 2;
    for (const lx of [hx0, hx0 + hw - 7]) { P(lx, ey - 1, 7, 4, c); P(lx + 1, ey - 1, 2, 1, sh(c, 2.6)); P(lx + 1, ey, 1, 1, sh(c, 2.1)); P(lx, ey + 2, 7, 1, sh(c, 0.8)); }
    P(CX - 1, ey - 1, 2, 1, c); P(hx0 - 1, ey - 1, 1, 1, c); P(hx0 + hw, ey - 1, 1, 1, c);
  } else if (v.glasses) {
    const c = v.glasses, hx0 = CX - hw / 2, round = v.glassStyle === 'round', lensY = ey - 2;
    for (const lx of [hx0 + 1, hx0 + hw - 7]) {
      if (round) {                                                         // 6 x 6 tortoiseshell rings
        const ring = [[1, 0, 4], [0, 1, 1], [5, 1, 1], [0, 2, 1], [5, 2, 1], [0, 3, 1], [5, 3, 1], [0, 4, 1], [5, 4, 1], [1, 5, 4]];
        for (const [dx, dy, w] of ring) for (let k = 0; k < w; k++) { const n = hs(lx + dx + k, lensY + dy); P(lx + dx + k, lensY + dy, 1, 1, v.tortoise ? (n < 0.35 ? '#c98a3c' : n < 0.6 ? '#7a4220' : '#3a1c0c') : c); }
        P(lx + 1, lensY + 1, 1, 1, '#ffffff'); P(lx + 2, lensY + 1, 1, 1, tint); P(lx + 1, lensY + 2, 1, 1, tint);
      } else {                                                             // 6 x 5 rectangular frames, thick top bar
        P(lx, lensY - 1, 6, 2, c); P(lx, lensY + 4, 6, 1, c); P(lx, lensY + 1, 1, 3, c); P(lx + 5, lensY + 1, 1, 3, c);
        P(lx + 1, lensY + 1, 1, 1, '#ffffff'); P(lx + 2, lensY + 2, 1, 1, tint); P(lx + 1, lensY + 3, 1, 1, mix(tint, '#ffffff', 0.3));
      }
    }
    const bc = v.tortoise ? '#7a4220' : c;
    P(CX - 1, ey - 1, 2, 1, bc); P(hx0 - 1, ey - 1, 2, 1, bc); P(hx0 + hw - 1, ey - 1, 2, 1, bc);   // bridge and temple arms
  }
}

// ---------- hair, front view ----------
function hairFront(g, v, ht, hw, hh, ey, _x, skin, c, st) {
  const P = (x, y, w, h, c2) => g.P(x, y, w, h, c2), hf = j => headHalf(j, hh, hw), S = [], add = (y, a, b) => { if (b > a) S.push([y, a, b]); };
  const sil = (j, vol, fat, shift = 0) => { // silhouette half width on row j (j may be negative: crown above the head)
    const h0 = hf(0) + fat; if (j >= 0) return hf(j) + fat; const t = (-j) / (vol + 1); return Math.max(2, Math.round(h0 * Math.sqrt(Math.max(0, 1 - t * t * 0.95)) + shift * 0));
  };
  const full = (j0, j1, vol, fat, shift = 0) => { for (let j = j0; j <= j1; j++) { const h = sil(j, vol, fat); add(ht + j, CX - h + shift, CX + h + shift); } };
  const sides = (j0, j1, fat, wd) => { for (let j = j0; j <= j1; j++) { const h = hf(j) + fat; add(ht + j, CX - h, CX - h + wd); add(ht + j, CX + h - wd, CX + h); } };
  const eyj = ey - ht, o = { shine: [CX - 3, ht - 1, 6, 3], str: 2 };
  const fade = (j0, j1, wd) => { for (let j = j0; j <= j1; j++) for (const s of [-1, 1]) for (let k = 0; k < wd; k++) { const h = hf(j), x = s < 0 ? CX - h + k : CX + h - 1 - k, n = hs(x, ht + j), a = (1 - (j - j0) / (j1 - j0 + 2)) * 0.8 - k * 0.12; P(x, ht + j, 1, 1, mix(skin, c, n < a ? 0.62 : 0.3)); } };
  let part = false;
  switch (st) {
    case 'bald': sides(3, eyj - 1, 0, 3); sides(eyj, eyj + 2, 0, 1); P(CX - 5, ht + 1, 5, 2, sh(skin, 1.14)); P(CX - 4, ht, 3, 1, sh(skin, 1.22)); break;
    case 'fade': full(-1, 2, 1, 0); for (let j = 3; j <= 3; j++) add(ht + j, CX - hf(j) + 2, CX + hf(j) - 2); fade(3, eyj - 1, 4); o.shine = [CX - 3, ht, 5, 2]; break;
    case 'quiff': { const vol = 6; for (let j = -vol; j <= -1; j++) { const h = Math.max(2, Math.round(7.5 * Math.sqrt(1 - Math.pow((-j - 1) / (vol + 1.3), 2) * 0.9)) ); add(ht + j, CX - h - 1, CX + h - 1 - (j < -4 ? 1 : 0)); }
      full(0, 2, 0, 0); add(ht + 3, CX - hf(3) + 1, CX + hf(3) - 1); add(ht + 4, CX - 7, CX - 4); add(ht + 4, CX + 4, CX + 7); fade(4, eyj - 1, 3); o.shine = [CX - 3, ht - 3, 5, 5]; o.str = 3; break; }
    case 'slick': full(-2, 2, 2, 0); add(ht + 3, CX - hf(3), CX - 5); add(ht + 3, CX + 5, CX + hf(3)); sides(4, eyj - 2, 0, 2); o.shine = [CX - 3, ht - 1, 7, 2]; o.str = 4; break;
    case 'fringe': full(-1, 4, 1, 1); add(ht + 5, CX - hf(5) - 1, CX + 5); add(ht + 6, CX - hf(6) - 1, CX); sides(5, eyj - 1, 1, 2); add(ht + 5, CX + 7, CX + hf(5) + 1); o.shine = [CX - 4, ht, 6, 2]; break;
    case 'curly': for (let j = -4; j <= 3; j++) { const h = sil(j, 3, 3); for (let x = CX - h; x < CX + h; x++) if (j > -4 || (x - CX + 24) % 4 > 0) add(ht + j, x, x + 1); } S.length = 0;
      for (let j = -4; j <= 3; j++) { const h = sil(j, 3, 3) + (hs(j, 5) < 0.5 ? 1 : 0); add(ht + j, CX - h, CX + h); }
      add(ht + 4, CX - 10, CX - 4); add(ht + 4, CX + 4, CX + 10); sides(5, eyj, 3, 3); o.shine = [CX - 4, ht - 2, 6, 3]; o.str = 2; break;
    case 'bun': full(-1, 3, 1, 1); add(ht + 4, CX - hf(4) - 1, CX - 5); add(ht + 4, CX + 5, CX + hf(4) + 1); sides(5, eyj - 1, 1, 2); break;
    case 'long': case 'wavy': {
      const wavy = st === 'wavy', vol = 2, wd = wavy ? 6 : 5; full(-vol, 3, vol, 1);
      part = true;
      const shY = ht + hh + 3, endY = shY + (wavy ? 20 : 17);
      for (let y = ht + 4; y <= endY; y++) for (const s of [-1, 1]) {
        const j = y - ht, wv = Math.round(Math.sin(y * (wavy ? 0.62 : 0.4) + (s < 0 ? 0 : 1.7)) * (wavy ? 1.6 : 0.8));
        const inner = j < hh ? hf(j) - 1 : j < hh + 6 ? hf(hh - 1) + 1 : 5 + Math.round((y - ht - hh - 6) * 0.15);
        let outer = (j < hh ? hf(j) + 1 : 11) + (wavy ? 2 : 1) + wv, tail = endY - y;
        if (tail < 4) outer -= (4 - tail);
        const a = s < 0 ? CX - outer : CX + inner, b = s < 0 ? CX - inner : CX + outer;
        add(y, a, b);
      }
      o.shine = [CX - 6, ht + 1, 5, 3]; o.str = 3; break; }
    case 'ponytail': full(-1, 3, 1, 1); add(ht + 4, CX - hf(4) - 1, CX - 5); add(ht + 4, CX + 5, CX + hf(4) + 1); sides(5, eyj - 1, 1, 2); break;
    default: full(-1, 3, 1, 1); add(ht + 4, CX - hf(4) - 1, CX - 5); add(ht + 4, CX + 5, CX + hf(4) + 1); sides(5, eyj - 1, 1, 2);
  }
  paintHair(P, S, c, o);
  if (part) P(CX - 1, ht - 1, 1, 5, sh(c, 0.6));
  if (st === 'bun') { ell(P, CX - 5, ht - 9, 10, 8, c); P(CX - 4, ht - 8, 3, 2, sh(c, 1.4)); P(CX - 2, ht - 6, 4, 1, sh(c, 0.7)); P(CX + 1, ht - 4, 3, 1, sh(c, 0.7)); }
  if (st === 'quiff') for (let k = 0; k < 5; k++) P(CX - 5 + k * 2, ht - 5 + (k >> 1), 1, 3, sh(c, k % 2 ? 1.5 : 0.7));
  if (st === 'slick') for (let k = 0; k < 4; k++) P(CX - 6 + k * 3, ht - 1, 1, 4, sh(c, 1.45));
  if (st === 'curly') for (let k = 0; k < 6; k++) P(CX - 8 + k * 3, ht - 3 + (k % 2) * 2, 2, 1, sh(c, 1.5));
}

// ---------- hair, back view ----------
export function hairBack(g, v, ht, hw, hh, skin, c, st) {
  const P = (x, y, w, h, c2) => g.P(x, y, w, h, c2), hf = j => headHalf(j, hh, hw), S = [], add = (y, a, b) => { if (b > a) S.push([y, a, b]); }, sk = T(skin);
  const o = { shine: [CX - 3, ht + 1, 6, 3], str: 2 };
  const cap = (vol, fat, to, shiftTop = 0) => { for (let j = -vol; j <= to; j++) { let h; if (j >= 0) h = hf(j) + fat; else { const t = -j / (vol + 1); h = Math.max(2, Math.round((hf(0) + fat) * Math.sqrt(Math.max(0, 1 - t * t * 0.95)))); } add(ht + j, CX - h + (j < 0 ? shiftTop : 0), CX + h + (j < 0 ? shiftTop : 0)); } };
  switch (st) {
    case 'bald': for (let j = 3; j < hh - 3; j++) { const h = hf(j); add(ht + j, CX - h, CX - h + 3); add(ht + j, CX + h - 3, CX + h); } for (let k = 0; k < 4; k++) add(ht + hh - 5, CX - 5 + k, CX - 4 + k); P(CX - 5, ht + 1, 4, 2, sh(skin, 1.14)); break;
    case 'fade': cap(1, 0, 5); for (let j = 6; j < hh - 1; j++) { const h = hf(j); for (let x = CX - h + 1; x < CX + h - 1; x++) if (hs(x, ht + j) < 0.6 - (j - 6) * 0.05) P(x, ht + j, 1, 1, mix(skin, c, 0.55)); } break;
    case 'quiff': cap(6, 0, 6); for (let j = 7; j < hh - 1; j++) { const h = hf(j); for (let x = CX - h + 1; x < CX + h - 1; x++) if (hs(x, ht + j) < 0.55) P(x, ht + j, 1, 1, mix(skin, c, 0.5)); } o.shine = [CX - 3, ht - 3, 5, 5]; break;
    case 'curly': for (let j = -4; j <= hh - 3; j++) { const h = (j < 0 ? Math.round((hf(0) + 3) * Math.sqrt(Math.max(0, 1 - (j / -5) ** 2 * 0.95))) : hf(j) + 3) + (hs(j, 9) < 0.5 ? 1 : 0); add(ht + j, CX - h, CX + h); } break;
    case 'long': case 'wavy': {
      const wavy = st === 'wavy', endY = ht + hh + (wavy ? 24 : 20);
      cap(2, 1, 3);
      for (let y = ht + 4; y <= endY; y++) {
        const j = y - ht, wv = Math.round(Math.sin(y * (wavy ? 0.62 : 0.4)) * (wavy ? 1.6 : 0.8));
        let h = (j < hh - 3 ? hf(j) + 1 : j < hh + 4 ? hf(hh - 4) + 2 + (j - hh + 3) : 11 + (wavy ? 1 : 0)) + wv; const tail = endY - y; if (tail < 4) h -= 4 - tail;
        add(y, CX - h, CX + h);
      }
      o.str = 3; o.dark = endY - 3; break; }
    case 'bun': cap(1, 1, hh - 5); break;
    case 'ponytail': cap(1, 1, hh - 5); break;
    case 'slick': cap(2, 0, hh - 6); break;
    default: cap(1, 1, hh - 5);
  }
  paintHair(P, S, c, o);
  if (st === 'long' || st === 'wavy') for (let k = 0; k < 4; k++) P(CX - 6 + k * 4, ht + hh + 2, 1, 14, sh(c, k % 2 ? 1.35 : 0.7));
  if (st === 'bun') { ell(P, CX - 5, ht - 9, 10, 8, c); P(CX - 4, ht - 8, 3, 2, sh(c, 1.4)); P(CX - 2, ht - 6, 4, 1, sh(c, 0.7)); }
  if (st === 'ponytail') { P(CX - 2, ht + 2, 4, 2, sh(c, 0.6)); for (let y = ht + 4; y < ht + hh + 12; y++) { const w = y < ht + hh + 6 ? 5 : 5 - (y - ht - hh - 5); P(CX - w / 2, y, w, 1, y % 3 ? c : sh(c, 0.75)); } P(CX - 3, ht + 4, 1, 12, sh(c, 1.4)); }
  if (st === 'quiff') for (let k = 0; k < 5; k++) P(CX - 5 + k * 2, ht - 5 + (k >> 1), 1, 3, sh(c, k % 2 ? 1.5 : 0.7));
  if (st === 'slick') for (let k = 0; k < 4; k++) P(CX - 6 + k * 3, ht - 1, 1, 5, sh(c, 1.45));
}

// ---------- side view (facing left) ----------
export function headSide(g, v, ht, hw, hh, st, skin, c) {
  const P = (x, y, w, h, c2) => g.P(x, y, w, h, c2), sk = T(skin), ws = hw - 1, sx0 = CX - 8 - (v.stoop ? v.stoop * 2 : 0) + 1;
  const ey = ht + Math.round(hh * 0.5), my = ey + (hh >= 18 ? 5 : 4), S = [], add = (y, a, b) => { if (b > a) S.push([y, a, b]); };
  const earX = sx0 + ws - 7, hideEar = st === 'long' || st === 'wavy' || st === 'curly';
  const front = j => sx0 + sideIn(j, hh, ws)[0], backx = j => sx0 + ws - sideIn(j, hh, ws)[1];
  for (let j = 0; j < hh; j++) {
    const a = front(j), b = backx(j), y = ht + j; row(P, y, a, b, skin);
    P(a, y, 1, 1, sh(skin, 1.06)); if (j > hh * 0.62) row(P, y, b - 4, b, sk.d); if (j >= hh - 2) row(P, y, a + 1, b - 1, sk.d);
  }
  // nose, brow, eye, mouth (placed on the profile of their own row)
  P(sx0 - 2, ey + 2, 2, 2, skin); P(sx0 - 1, ey + 1, 1, 1, skin); P(sx0 - 2, ey + 4, 3, 1, sk.d); P(sx0 - 1, ey + 3, 1, 1, sh(skin, 1.1));
  P(sx0, ey - 2, 1, 1, sk.d);
  const iris = v.eyes || '#3a2a20', browC = sh(v.beard || c, 0.85);
  P(sx0 + 1, ey - 3, 4, 1, browC); P(sx0 + 2, ey, 3, 1, INK); P(sx0 + 2, ey + 1, 1, 1, iris); P(sx0 + 3, ey + 1, 2, 1, WHITE);
  P(sx0 + 3, ey + 3, 2, 1, mix(skin, '#e07a72', 0.3));
  const lip = mix(skin, '#b0484a', 0.4), lipD = mix(skin, '#5a2428', 0.55), my2 = my, mx = front(my - ht);
  P(mx, my2, 1, 1, lip); P(mx + 1, my2, 3, 1, lipD); P(mx + 1, my2 + 1, 2, 1, lip);
  if (v.smile) P(mx + 4, my2 - 1, 1, 1, lipD);
  if (v.beard) {
    for (let j = ey + 3 - ht; j < hh; j++) for (let x = front(j) - (j > ey - ht + 4 ? 0 : 0); x < backx(j) - (j < hh - 3 ? 4 : 0) + (j > hh - 6 ? 0 : 0); x++) { if (j === ey + 3 - ht && (x + j) & 1) continue; const n = hs(x, ht + j); P(x, ht + j, 1, 1, n < 0.2 ? sh(v.beard, 1.5) : n > 0.8 ? sh(v.beard, 0.8) : v.beard); }
    P(mx + 1, my - 1, 3, 3, mix(skin, v.beard, 0.2)); P(mx + 1, my, 3, 1, lipD); P(mx + 1, my + 1, 2, 1, lip);
  } else if (v.stubble) { const sc = mix(skin, v.stubble, 0.45); for (let j = ey + 3 - ht; j < hh; j++) for (let x = front(j) + 1; x < backx(j) - 4; x++) if (((x + j) & 1) === 0) P(x, ht + j, 1, 1, sc); }
  // hair
  const vol = { quiff: 6, bun: 1, curly: 4, long: 2, wavy: 2, slick: 2 }[st] || 1;
  const o = { shine: [sx0 + 5, ht - 1, 6, 3], str: 2 };
  const fh = j => st === 'bald' ? 99 : sx0 + 2 + (j < 4 ? 0 : j < 6 ? 1 : 2);   // hairline start per row
  if (st === 'bald') {
    for (let j = 3; j < hh - 3; j++) add(ht + j, Math.max(backx(j) - 4, sx0 + ws - 9), backx(j));
    S.length && paintHair(P, S, c, o); P(sx0 + 5, ht + 1, 5, 2, sh(skin, 1.14)); P(sx0 + 6, ht, 3, 1, sh(skin, 1.22));
  } else {
    for (let j = -vol; j < hh - 4; j++) {
      let a, b;
      if (j < 0) { const t = -j / (vol + 1), r = Math.sqrt(Math.max(0, 1 - t * t * 0.95)); a = Math.round(sx0 + 2 + (1 - r) * ws * 0.4) + (st === 'quiff' ? -1 - (j < -3 ? 0 : 0) : 0); b = Math.round(sx0 + ws - (1 - r) * ws * 0.4) + 1; }
      else { a = Math.max(front(j), fh(j)) - (st === 'curly' ? 1 : 0); b = backx(j) + 1; if (st === 'fade' || st === 'quiff') b = j < 5 ? b : b - 0; }
      if (st === 'curly') { a -= 1; b += 1 + (hs(j, 2) < 0.5 ? 1 : 0); }
      if (st === 'fringe' && j >= 3 && j < 7) a = sx0 - (j < 6 ? 1 : 0);
      if (st === 'quiff' && j >= 0 && j < 3) a = sx0 + 1 - (j === 0 ? 1 : 0);
      add(ht + j, a, b);
    }
    // sideburn in front of the ear
    for (let j = 4; j <= ey - ht + 1; j++) add(ht + j, earX - 3, earX);
    if (st === 'fade' || st === 'quiff') { S.splice(S.findIndex(s => s[0] === ht + 5), 0); }
    paintHair(P, S, c, o);
    if (st === 'fade' || st === 'quiff') for (let j = 5; j < hh - 2; j++) for (let x = Math.max(earX - 4, front(j)); x < backx(j); x++) if (hs(x, ht + j) < 0.5 - (j - 5) * 0.04) P(x, ht + j, 1, 1, mix(skin, c, 0.5));
  }
  if (!hideEar) { P(earX, ey - 1, 4, 5, skin); P(earX, ey - 1, 1, 5, sh(skin, 0.9)); P(earX + 1, ey, 2, 3, sk.dd); P(earX + 1, ey + 3, 2, 1, sk.d); }
  if (st === 'long' || st === 'wavy') {            // falls behind the shoulder
    const endY = ht + hh + (st === 'wavy' ? 24 : 20), S2 = [];
    for (let y = ht + 4; y <= endY; y++) { const wv = Math.round(Math.sin(y * (st === 'wavy' ? 0.62 : 0.4)) * 1.4), tail = endY - y; const a = sx0 + ws - 9 + (y > ht + hh ? 2 : 0), b = sx0 + ws + 2 + wv - (tail < 4 ? 4 - tail : 0) + (y > ht + hh ? 1 : 0); S2.push([y, a, b]); }
    paintHair(P, S2, c, { str: 3, dark: endY - 3, seed: 5 });
  }
  if (st === 'ponytail') { for (let y = ht + 3; y < ht + hh + 14; y++) { const k = y - ht - 3, x = sx0 + ws - 1 + Math.round(Math.sin(k * 0.3) * 1.5 + Math.min(k, 12) * 0.35), w = k < 12 ? 5 : 5 - (k - 11); P(x, y, w, 1, y % 3 ? c : sh(c, 0.75)); } P(sx0 + ws - 1, ht + 3, 4, 2, sh(c, 0.6)); }
  if (st === 'bun') { ell(P, sx0 + ws - 8, ht - 8, 9, 8, c); P(sx0 + ws - 7, ht - 7, 3, 2, sh(c, 1.4)); P(sx0 + ws - 6, ht - 4, 4, 1, sh(c, 0.7)); }
  if (st === 'quiff') for (let k = 0; k < 5; k++) P(sx0 + 1 + k * 2, ht - 6 + (k >> 1), 1, 4 - (k >> 1), sh(c, k % 2 ? 1.5 : 0.7));
  if (st === 'curly') for (let k = 0; k < 5; k++) P(sx0 + 1 + k * 3, ht - 3 + (k % 2) * 2, 2, 1, sh(c, 1.5));
  // glasses in profile: lens edge at the front, temple arm to the ear
  if (v.bigGlasses) { const g2 = v.bigGlasses; P(sx0 - 1, ey - 1, 4, 4, g2); P(sx0, ey - 1, 1, 1, sh(g2, 2.4)); P(sx0 + 3, ey, ws - 8, 1, g2); }
  else if (v.glasses) { const g2 = v.tortoise ? '#6a3a1c' : v.glasses; P(sx0 - 1, ey - 2, 3, 6, g2); P(sx0, ey - 1, 1, 1, '#dfeeff'); P(sx0, ey + 1, 1, 1, '#cfe0ee'); P(sx0 + 2, ey - 1, ws - 8, 1, g2); }
  return { sx0, ws, ey, ht, hh };
}

// ---------- hats ----------
export function hat(g, v, dir, ht, hw, hh, st) {
  const P = (x, y, w, h, c) => g.P(x, y, w, h, c), back = dir === 1, side = dir >= 2, hat = v.hat;
  const hf = j => headHalf(j, hh, hw), sx0 = CX - 8 - (v.stoop ? v.stoop * 2 : 0) + 1, ws = hw - 1;
  if (v.headphones) {
    const hc = v.headphones, t = T(hc);
    if (side) { P(sx0 + ws - 8, ht - 3, 10, 2, hc); P(sx0 + ws - 10, ht - 1, 2, 5, hc); ell(P, sx0 + ws - 9, ht + 5, 7, 9, hc); P(sx0 + ws - 8, ht + 6, 5, 7, t.d); P(sx0 + ws - 8, ht + 6, 2, 2, t.l); }
    else { P(CX - 9, ht - 3, 18, 2, hc); P(CX - 9, ht - 1, 2, 5, hc); P(CX + 7, ht - 1, 2, 5, hc); for (const x of [CX - 11, CX + 6]) { P(x, ht + 3, 5, 8, hc); P(x + (x < CX ? 0 : 3), ht + 3, 2, 8, t.d); P(x + 1, ht + 4, 2, 2, t.l); } }
  }
  if (!hat) return;
  const c = hat.col, t = T(c), c2 = hat.col2 || sh(c, 0.7), noise = (x, y, c0) => hs(x, y) < 0.25 ? sh(c0, 0.93) : hs(x + 9, y) > 0.88 ? sh(c0, 1.07) : c0;
  const dome = (y0, y1, half, base, tex = true) => { for (let y = y0; y <= y1; y++) { const h = half(y); for (let x = CX - h; x < CX + h; x++) P(x, y, 1, 1, tex ? noise(x, y, base) : base); P(CX + h - 3, y, 3, 1, sh(base, 0.8)); P(CX - h, y, 1, 1, sh(base, 1.18)); } };
  const sdome = (y0, y1, x0, x1, base, tex = true) => { for (let y = y0; y <= y1; y++) for (let x = x0(y); x < x1(y); x++) P(x, y, 1, 1, tex ? noise(x, y, base) : base); };
  switch (hat.type) {
    case 'flatcap': // coppola: tweed with a short stiff peak and a button
      if (side) { sdome(ht - 4, ht + 4, y => y < ht - 1 ? sx0 + 5 : sx0, y => sx0 + ws + 2, c); P(sx0 + ws - 3, ht - 4, 5, 9, t.d); P(sx0 - 5, ht + 3, 8, 2, t.dd); P(sx0 - 4, ht + 3, 6, 1, sh(c, 0.95)); P(sx0 + 1, ht - 3, 8, 1, t.l); P(sx0 + 4, ht - 5, 2, 1, t.d); }
      else { dome(ht - 4, ht + 4, y => y < ht - 2 ? 8 : y < ht ? 10 : 11, c); P(CX - 1, ht - 5, 2, 1, t.d); if (!back) { P(CX - 7, ht + 4, 14, 2, t.dd); P(CX - 6, ht + 4, 12, 1, sh(c, 0.95)); } else P(CX - 10, ht + 3, 20, 2, t.d);
        P(CX - 6, ht - 3, 1, 5, t.d); P(CX + 5, ht - 3, 1, 5, t.d); P(CX - 1, ht - 3, 1, 7, t.d); }
      break;
    case 'straw':
      if (side) { sdome(ht - 5, ht + 2, y => sx0 + 2, y => sx0 + ws + 1, c); ell(P, sx0 - 6, ht + 1, ws + 13, 5, sh(c, 0.88)); P(sx0 - 3, ht + 2, ws + 8, 1, c); P(sx0 + 1, ht, ws - 1, 2, hat.col2); P(sx0 + 3, ht - 3, 5, 1, t.l); }
      else { dome(ht - 5, ht + 1, y => y < ht - 3 ? 6 : 8, c); ell(P, CX - 15, ht + 1, 30, 6, sh(c, 0.88)); ell(P, CX - 14, ht + 1, 28, 4, c); P(CX - 8, ht - 1, 16, 2, hat.col2); P(CX + 8, ht - 1, 4, 2, sh(hat.col2, 0.7)); P(CX - 5, ht - 4, 3, 1, t.l); }
      break;
    case 'peaked': // carabiniere / vigile: tall crown, hat band, black visor, badge
      if (side) { sdome(ht - 6, ht + 2, y => sx0 + 2, y => sx0 + ws + 2, c, false); P(sx0 + 2, ht - 6, ws, 1, t.l); P(sx0 + 2, ht, ws, 2, c2); P(sx0 + 2, ht - 3, ws, 1, t.d); P(sx0 - 5, ht + 3, 9, 2, '#0c0c10'); P(sx0 - 4, ht + 3, 7, 1, '#26262c'); P(sx0 + 1, ht - 2, 3, 3, hat.col2); }
      else { dome(ht - 6, ht + 2, y => y < ht - 4 ? 9 : 11, c, false); P(CX - 10, ht - 6, 20, 1, t.l); P(CX - 11, ht, 22, 2, c2); P(CX - 11, ht - 3, 22, 1, t.d);
        if (!back) { P(CX - 10, ht + 3, 20, 2, '#0c0c10'); P(CX - 9, ht + 3, 18, 1, '#26262c'); P(CX - 2, ht - 4, 4, 5, hat.col2); P(CX - 1, ht - 3, 2, 3, sh(hat.col2, 0.6)); P(CX - 2, ht - 4, 1, 1, sh(hat.col2, 1.3)); } else P(CX - 10, ht + 2, 20, 1, t.dd); }
      break;
    case 'helmet':
      if (side) { sdome(ht - 4, ht + 4, y => sx0 + 1, y => sx0 + ws + 3, c, false); P(sx0 + 3, ht - 4, 8, 1, t.l); P(sx0 + 3, ht - 3, 4, 1, sh(c, 1.1)); P(sx0 - 3, ht + 3, 6, 2, '#2a2a30'); P(sx0 + ws - 5, ht + 4, 6, 8, t.d); P(sx0 + ws - 4, ht + 11, 2, 4, '#2a2a30'); P(sx0 + 1, ht + 2, ws + 1, 1, t.d); }
      else { dome(ht - 4, ht + 4, y => y < ht - 2 ? 9 : 11, c, false); P(CX - 6, ht - 4, 6, 1, t.l); P(CX - 4, ht - 3, 3, 1, sh(c, 1.2)); if (!back) { P(CX - 10, ht + 3, 20, 2, '#2a2a30'); P(CX - 11, ht + 4, 3, 8, t.d); P(CX + 8, ht + 4, 3, 8, t.dd); P(CX - 1, ht - 4, 1, 4, t.d); } }
      break;
    case 'cap': // baseball cap, optionally worn back to front
      if (side) { sdome(ht - 4, ht + 3, y => sx0 + 3, y => sx0 + ws + 2, c, false); P(sx0 + 3, ht - 4, 9, 1, t.l); P(sx0 + ws - 3, ht - 3, 5, 6, t.d); if (hat.back) P(sx0 + ws + 1, ht + 1, 6, 2, t.dd); else P(sx0 - 5, ht + 2, 9, 2, t.dd); P(sx0 + 6, ht - 5, 2, 1, t.d); }
      else { dome(ht - 4, ht + 3, y => y < ht - 2 ? 8 : 10, c, false); P(CX - 7, ht - 4, 5, 1, t.l); P(CX - 1, ht - 5, 2, 1, t.d); P(CX - 1, ht - 4, 1, 7, t.d);
        if (!hat.back && !back) { P(CX - 8, ht + 3, 16, 2, t.dd); P(CX - 7, ht + 3, 14, 1, sh(c, 0.95)); } else if (hat.back && !back) P(CX - 10, ht + 3, 20, 1, t.d); else if (hat.back && back) { P(CX - 8, ht + 3, 16, 2, t.dd); } else P(CX - 10, ht + 2, 20, 1, t.d); }
      break;
    case 'hood': // hood up: the face sits in shadow
      if (side) { sdome(ht - 4, ht + hh - 1, y => y < ht + 2 ? sx0 + 1 : sx0 - 1, y => sx0 + ws + 4, c, false); P(sx0 - 1, ht + 3, 4, 9, t.dd); P(sx0, ht + 4, 2, 6, '#0a0a0d'); P(sx0 + 2, ht - 4, 8, 1, t.l); P(sx0 + ws, ht + 4, 4, hh - 4, t.d); }
      else if (back) { dome(ht - 4, ht + hh + 1, y => y < ht - 1 ? 9 : 12, c, false); P(CX - 1, ht + 2, 2, hh - 2, t.d); P(CX - 8, ht - 4, 8, 1, t.l); }
      else { dome(ht - 4, ht + 3, y => y < ht - 1 ? 9 : 12, c, false); for (let y = ht + 4; y < ht + hh + 1; y++) { P(CX - 12, y, 4, 1, c); P(CX + 8, y, 4, 1, c); } P(CX - 12, ht + 4, 1, hh - 3, t.l); P(CX + 11, ht + 4, 1, hh - 3, t.dd);
        P(CX - 8, ht + 3, 16, hh - 6, sh(c, 0.3)); P(CX - 8, ht + 3, 16, 1, sh(c, 0.18)); P(CX - 8, ht - 4, 8, 1, t.l); }
      break;
    case 'scarf': // headscarf tied under the chin (nonne, suora)
      if (side) { sdome(ht - 3, ht + 5, y => sx0 + 1, y => sx0 + ws + 2, c, true); sdome(ht + 6, ht + hh - 2, y => sx0 + ws - 6, y => sx0 + ws + 3, c, true); P(sx0 + 1, ht + 3, ws, 1, c2); P(sx0 + 1, ht - 3, 8, 1, t.l); P(sx0 + ws - 7, ht + hh - 4, 8, 5, t.d); P(sx0 + 2, ht + 4, 3, 1, t.dd); }
      else if (back) { dome(ht - 3, ht + hh + 2, y => y < ht + 6 ? hf(Math.max(0, y - ht)) + 2 : hf(hh - 5) + 2, c, true); P(CX - 1, ht + hh - 2, 2, 5, t.d); }
      else { dome(ht - 3, ht + 4, y => hf(Math.max(0, y - ht)) + 2, c, true); P(CX - 10, ht + 3, 20, 1, c2); for (let y = ht + 5; y < ht + hh - 2; y++) { const h = hf(y - ht); for (let k = 0; k < 3; k++) { P(CX - h - 3 + k, y, 1, 1, noise(CX - h + k, y, c)); P(CX + h + k - 1, y, 1, 1, noise(CX + h + k, y, c)); } }
        P(CX - 11, ht + 5, 3, hh - 2, c); P(CX + 8, ht + 5, 3, hh - 2, t.d); P(CX - 9, ht + hh - 2, 18, 3, c); P(CX - 4, ht + hh - 1, 8, 4, t.d); P(CX - 1, ht + hh, 2, 5, t.dd); P(CX - 7, ht + 4, 3, 1, v.hair); P(CX + 4, ht + 4, 3, 1, v.hair); }
      break;
  }
}
