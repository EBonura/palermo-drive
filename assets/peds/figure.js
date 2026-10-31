// Pedestrian figure renderer: draws one 48 x 96 cell (a character, a direction, a walk pose) into a software pixel buffer,
// adds a selective outline, and packs all cells into the atlas. Owned by the pedestrian work. Works in the browser and under node.
//
// Poses: 0 idle, 1 step A (near leg forward), 2 passing A (far leg swings through), 3 step B (far leg forward), 4 passing B (near leg swings through).
// Directions: front, back, left; right is the mirrored left cell. The feet stand on pixel row FY. Dimensions in the variant data
// (leg, tor, head, hw, tw, hem lengths) stay in the old 24 x 48 design units; this file doubles them.
import { CELL_W, CELL_H, Img, sh, mix, T, hs, lum, row, ell, limb, block } from './px.js';
import { headFront, hairBack, headSide, hat, headHalf } from './head.js';
export { CELL_W, CELL_H };
export const SCALE = 2, POSES = 5, DIRS = 4, COLS = POSES * DIRS, PACK = 4;
export const FRONT = 0, BACK = 1, LEFT = 2, RIGHT = 3;
const FY = 93, CX = 24;
const GOLD = '#d9b44a';

// carried and worn things that hang from a hand; (x, y) is the hand, view 'f' front/back, 's' side
function item(P, kind, c, x, y, view, v) {
  const t = T(c), w = view === 's' ? 8 : 11;
  if (kind === 'bag' || kind === 'tote') {                                 // shopping bag with handles, optionally full of produce
    const h = kind === 'tote' ? 17 : 14, bw = kind === 'tote' ? w + 1 : w, bx = x - (bw >> 1), by = y + 1;
    if (v.produce || kind === 'tote') {
      P(bx + 1, by - 5, 3, 6, '#4f8f3a'); P(bx + 2, by - 7, 2, 3, '#78b04a'); P(bx + 5, by - 4, 3, 5, '#e07a2a'); P(bx + 5, by - 4, 1, 2, '#f0a04a'); P(bx + 3, by - 6, 1, 5, '#d9a95a');
      if (bw > 8) P(bx + bw - 4, by - 5, 3, 5, '#b8382c');
    }
    P(x - 1, y - 3, 1, 5, t.dd); P(x + 1, y - 3, 1, 5, t.dd); P(bx + 1, by - 1, bw - 2, 1, t.dd);
    block(P, bx, by, bw, h, c, 1, 2); P(bx, by, bw, 1, t.dd); P(bx + 2, by + 4, bw - 4, 2, kind === 'tote' ? '#a8442c' : t.l); P(bx + 2, by + 8, bw - 5, 1, t.d);
    if (kind === 'tote') for (let k = 0; k < 3; k++) P(bx + 2 + k * 3, by + h - 4, 1, 3, t.d);
  } else if (kind === 'purse') {
    const bx = x - 4, by = y + 2; P(x - 1, y - 2, 1, 5, t.dd); P(x + 1, y - 2, 1, 5, t.dd); block(P, bx, by, 9, 8, c, 1, 2); P(bx, by, 9, 2, t.d); P(bx + 3, by + 2, 3, 2, GOLD); P(bx + 1, by + 5, 4, 1, t.l);
  } else if (kind === 'briefcase') {
    const bx = x - (view === 's' ? 4 : 6), bw = view === 's' ? 8 : 13, by = y + 3; P(x - 3, y - 1, 6, 1, t.dd); P(x - 3, y - 1, 1, 4, t.dd); P(x + 2, y - 1, 1, 4, t.dd);
    block(P, bx, by, bw, 10, c, 1, 2); P(bx, by + 3, bw, 1, t.dd); P(bx + (bw >> 1) - 1, by + 2, 3, 3, GOLD); P(bx + 1, by + 1, bw - 3, 1, t.l);
  } else if (kind === 'helmet') {
    const bx = x - 5; ell(P, bx, y + 1, 11, 9, c); P(bx + 1, y + 2, 4, 2, t.l); P(bx, y + 7, 11, 2, '#202026'); P(bx + 2, y + 8, 7, 1, '#55555c'); P(bx + 8, y + 3, 2, 4, t.d);
  } else if (kind === 'bottle') {
    P(x - 1, y - 12, 3, 14, c); P(x - 1, y - 12, 1, 14, sh(c, 1.35)); P(x, y - 17, 2, 5, sh(c, 1.1)); P(x, y - 18, 2, 1, '#d9d4c6'); P(x - 1, y - 6, 3, 4, '#ece6d6'); P(x - 1, y - 5, 3, 1, '#b8382c');
  } else if (kind === 'glass') {
    for (let j = 0; j < 9; j++) { const hw = 5 - (j > 5 ? 0 : 0); P(x - 3, y - 9 + j, 6, 1, j < 1 ? '#f0ece4' : c); } P(x - 3, y - 8, 1, 7, sh(c, 1.35)); P(x + 2, y - 8, 1, 7, sh(c, 0.8)); P(x - 1, y - 7, 1, 2, '#ffffff'); P(x, y - 11, 1, 5, '#e8e0a0'); P(x - 1, y - 11, 1, 1, '#e8553c'); P(x - 3, y, 6, 1, '#d8e6f0');
  }
}

// ---------- the figure ----------
function figure(g, v, dir, pose) {
  const P = (x, y, w, h, c) => g.P(x, y, w, h, c), Q = (x, y, w, h, c) => g.Q(x, y, w, h, c);
  const legH = (v.leg || 19) * 2, torH = (v.tor || 14) * 2, hh = (v.head || 10) * 2 - 2, hw = (v.hw || 10) * 2 - 4, tw = (v.tw || 12) * 2, neckH = 3;
  const run = !!v.run, pass = pose === 2 || pose === 4, bob = pass ? (run ? -5 : -2) : pose === 0 ? 0 : 0;
  const hipY = FY - legH + bob, shY = hipY - torH, ht = shY - neckH - hh;
  const skin = v.skin, sk = T(skin), hair = v.hair, top = v.top, tt = T(top), B = v.bottom, st = v.hairStyle || 'short';
  const isRobe = B.type === 'robe', isSkirt = B.type === 'skirt', isShorts = B.type === 'shorts', stoop = v.stoop || 0;
  const legCol = isSkirt || isRobe ? (v.legCol || skin) : isShorts ? skin : B.col, lt = T(legCol);
  const hemY = isRobe ? FY - 7 : isSkirt ? hipY + B.len * 2 : 0;
  const shoeC = v.shoes, light = lum(shoeC) > 0.6, sole = light ? '#c4bfb4' : sh(shoeC, 0.42);
  const sleeveLong = v.sleeve !== 'short', hem = v.belt ? 0 : (v.hem !== undefined ? v.hem : 6);
  const armLen = torH + 4;                                                  // shoulder to fingertip
  const tattoo = v.tattoo, bracelet = v.bracelet;

  // a forearm with optional tattoo ink and wrist bands, x/y of its top left, w wide
  const forearm = (x, y, w, h, s) => {
    block(P, x, y, w, h, skin, 1, 1);
    if (tattoo) { const ink = mix(skin, tattoo, 0.7); for (let k = 0; k < h - 3; k++) { const n = hs(k, 7), xx = x + 1 + (k * 2 + (s < 0 ? 1 : 0)) % (w - 1); P(xx, y + 1 + k, n < 0.5 ? 2 : 1, 1, ink); if (k % 4 === 0) P(x + (s < 0 ? 0 : 1), y + 1 + k, w - 1, 1, ink); } }
    if (bracelet) { bracelet.forEach((bc, i) => P(x - 0, y + h - 5 + i * 2, w, 1 + (i === 0 ? 1 : 0), bc)); }
  };
  const hand = (x, y, w, s, grip) => {                                      // x,y top left of the hand, w wide, 6 tall
    P(x, y, w, 6, skin); P(x, y, 1, 6, sh(skin, 1.08)); P(x + w - 1, y, 1, 6, sk.d); P(x, y + 5, w, 1, sk.d);
    if (!grip) { P(x + 1, y + 3, 1, 3, sk.d); P(x + 3, y + 3, 1, 3, sk.d); } else P(x, y + 2, w, 1, sk.d);
    P(s < 0 ? x + w - 1 : x, y + 1, 1, 3, sk.d);                           // thumb edge
  };

  if (dir === FRONT || dir === BACK) {
    const back = dir === BACK, x0 = CX - tw / 2, x1 = CX + tw / 2;
    const lifts = run ? [[0, 0], [0, 7], [0, 12], [7, 0], [12, 0]] : [[0, 0], [0, 3], [0, 5], [3, 0], [5, 0]];
    const [liftL, liftR] = lifts[pose];
    // ----- legs and shoes
    for (const s of [-1, 1]) {
      const lift = s < 0 ? liftL : liftR, ay = FY - lift - 5, xc = CX + s * 5, xb = CX + s * 4.5, n = Math.max(1, ay - hipY);
      const lx = y => { const f = (y - hipY) / n, w = Math.round(10 - 3 * f); return [Math.round(xc + (xb - xc) * f - w / 2), w]; };
      limb(P, xc, hipY, xb, ay, 10, 7, legCol, { stripe: B.stripe, sx: s });
      if (!isSkirt && !isRobe) {
        const ky = hipY + (ay - hipY) * 0.5 | 0, [kx, kw] = lx(ky), [tx, tw2] = lx(hipY + 8);
        if (!isShorts) {
          Q(kx + 1, ky, kw - 3, 1, lt.d); Q(kx + 2, ky + 3, kw - 4, 1, lt.d); Q(kx + 1, ky - 1, kw - 3, 1, lt.l);
          Q(tx + 1, hipY + 8, 2, 1, lt.d); Q(tx + tw2 - 4, hipY + 12, 2, 1, lt.d); Q(kx, ay - 3, kw, 1, lt.d); Q(kx, ay - 2, kw, 1, lt.dd);
          if (B.jeans) { Q(tx + 2, hipY + 6, tw2 - 5, 10, sh(legCol, 1.14)); for (let y = hipY + 2; y < ay - 2; y += 3) { const [ox, ow] = lx(y); P(s < 0 ? ox + 1 : ox + ow - 2, y, 1, 1, '#c9a24a'); } }
        } else { Q(kx + 1, ky - 2, kw - 3, 1, lt.d); P(kx + 2, ay - 4, 2, 2, sk.d); }
        if (back) Q(tx, hipY + 14, tw2, 1, lt.d);
      }
      if (isShorts) {                                                       // shorts over the thighs: hem, folds
        const sl = B.len * 2 + 2, bt = T(B.col), [kx, kw] = lx(hipY + sl);
        limb(P, xc, hipY, xc + (xb - xc) * sl / n, hipY + sl, 11, 10, B.col); P(kx - 1, hipY + sl - 1, kw + 2, 1, bt.dd); Q(kx + 1, hipY + 8, 2, 1, bt.d); Q(kx + 3, hipY + sl - 5, 2, 1, bt.d);
      }
      if (v.boots) { const [bx, bw] = lx(ay - 12); block(P, bx - 1, ay - 12, bw + 3, 14, v.boots, 1, 2); P(bx - 1, ay - 12, bw + 3, 1, T(v.boots).d); }
      // shoe
      const x = s < 0 ? CX - 10 : CX + 1, yb = FY - lift, big = (s < 0 ? liftL : liftR) === 0 && pose !== 0 ? 1 : 0;
      P(x, yb - 6 - big, 9, 4 + big, shoeC); P(x, yb - 6 - big, 1, 4 + big, sh(shoeC, 1.2)); P(x + 7, yb - 6 - big, 2, 4 + big, sh(shoeC, 0.78));
      P(x - 0, yb - 2, 9, 2, sole); P(x, yb - 1, 9, 1, sh(sole, 0.7));
      if (!back) { P(x + 3, yb - 6 - big, 3, 1, light ? '#a09c92' : sh(shoeC, 1.7)); P(x + 1, yb - 4, 7, 1, light ? '#b8b4aa' : sh(shoeC, 0.8)); if (!light) P(x + 1, yb - 5, 2, 1, sh(shoeC, 1.9)); }
      else P(x + 1, yb - 5, 7, 1, sh(shoeC, 0.8));
    }
    Q(24, hipY + 6, 1, FY - hipY - 14, sh(legCol, 0.5));
    // ----- skirt / cassock
    if (isSkirt || isRobe) {
      const ex = isRobe ? 6 : 4, wh = tw / 2 - 3, sway = pose === 1 || pose === 2 ? 1 : pose === 3 || pose === 4 ? -1 : 0, ct = T(B.col);
      for (let y = hipY - 1; y < hemY; y++) {
        const f = (y - hipY) / Math.max(1, hemY - hipY), h = Math.round(wh + f * ex), o = y > hemY - 4 ? sway : 0;
        P(CX - h + o, y, h * 2, 1, B.col); P(CX - h + o, y, 1, 1, ct.l); P(CX + h - 3 + o, y, 3, 1, ct.d);
        for (let k = 3; k < h * 2 - 4; k += 4) if (((y + k) >> 2) & 1) Q(CX - h + k + o, y, 1, 1, ct.d); else Q(CX - h + k + o + 1, y, 1, 1, ct.l);
      }
      P(CX - wh - ex - 1 + sway, hemY - 2, (wh + ex + 1) * 2, 2, ct.dd); for (let k = 0; k < (wh + ex) * 2; k += 3) P(CX - wh - ex + k + sway, hemY, 2, 1, ct.d);
      if (isRobe && !back) { P(CX, hipY + 2, 1, hemY - hipY - 2, ct.l); for (let y = hipY + 4; y < hemY - 4; y += 6) P(CX - 1, y, 3, 1, ct.dd); }
    }
    // ----- neck and torso
    block(P, CX - 4, shY - neckH - 1, 8, neckH + 3, skin, 1, 2); P(CX - 4, shY - neckH - 1, 8, 3, sk.d); P(CX + 1, shY - neckH - 1, 3, neckH + 3, sk.d);
    const waist = torH * 0.5, base = back && v.vest ? v.vest : top, bt = T(base), half0 = tw / 2;
    const halfAt = r => r < 1 ? half0 - 4 : r < 2 ? half0 - 2 : r < 3 ? half0 - 1 : r < waist ? half0 : half0 - Math.round((r - waist) / (torH + hem - waist) * 3);
    for (let y = shY; y < hipY + hem; y++) {
      const r = y - shY, h = halfAt(r);
      P(CX - h, y, h * 2, 1, base); if (r > 2) P(CX - h, y, 1, 1, bt.l); P(CX + h - 3, y, 3, 1, bt.d); if (r > 3) P(CX + h - 1, y, 1, 1, bt.dd);
      if (y >= hipY + hem - 2) Q(CX - h, y, h * 2, 1, bt.d);
    }
    // soft folds: from the chest down, three slanting creases and an armpit shade
    for (let k = 0; k < 3; k++) Q(x0 + 3 + k * 6, shY + torH - 8 + (k & 1) * 2, 4, 1, bt.d);
    Q(x0 + 1, shY + 4, 2, 5, bt.d); Q(x1 - 3, shY + 4, 2, 5, bt.dd);
    if (back) for (let y = shY + 5; y < hipY + hem - 2; y += 2) Q(CX - 1, y, 1, 1, bt.d);
    if (v.vest) {
      if (!back) { for (const s of [-1, 1]) for (let y = shY; y < hipY + hem; y++) { const r = y - shY, h = halfAt(r); P(s < 0 ? CX - h : CX + 3, y, h - 3, 1, v.vest); } const vt = T(v.vest); Q(x0, shY + 2, 1, hipY - shY, vt.l); Q(CX - 3, shY + 2, 1, hipY - shY + hem - 4, vt.dd); Q(CX + 2, shY + 2, 1, hipY - shY + hem - 4, vt.dd); for (let k = 0; k < 3; k++) P(CX - 7, shY + 8 + k * 7, 2, 2, GOLD); }
    }
    if (v.stain) { P(x0 + 4, shY + 8, 5, 3, v.stain); P(x0 + 5, shY + 11, 2, 3, sh(v.stain, 0.8)); P(x1 - 9, shY + 16, 4, 5, v.stain); P(x1 - 8, shY + 21, 2, 2, v.stain); P(x0 + 9, shY + 20, 3, 2, sh(v.stain, 1.2)); }
    if (v.trim && !sleeveLong) { /* sleeve trims are drawn with the arms */ }
    if (v.shirt && !back) {                                                  // shirt under an open jacket, with collar and tie
      const sc = T(v.shirt); P(CX - 5, shY, 10, 1, v.shirt);
      for (let y = shY + 1; y < shY + 14; y++) { const h = Math.max(2, 5 - ((y - shY) >> 2)); P(CX - h, y, h * 2, 1, v.shirt); P(CX - h, y, 1, 1, sc.l); P(CX + h - 2, y, 2, 1, sc.d); }
      P(CX - 6, shY - 1, 4, 3, sc.d); P(CX + 2, shY - 1, 4, 3, sc.d); P(CX - 5, shY - 1, 3, 2, v.shirt); P(CX + 2, shY - 1, 3, 2, v.shirt);
      if (v.tie) { const tc = T(v.tie); P(CX - 2, shY + 1, 4, 3, v.tie); P(CX - 1, shY + 4, 3, 12, v.tie); P(CX - 2, shY + 16, 5, 3, v.tie); P(CX - 1, shY + 4, 1, 14, tc.l); P(CX + 1, shY + 4, 1, 14, tc.d); P(CX - 2, shY + 1, 4, 1, tc.d); for (let k = 0; k < 3; k++) P(CX - 1 + (k & 1), shY + 7 + k * 4, 2, 1, tc.dd); }
      P(CX - 1, shY + 3 + 16, 1, 1, tt.dd);
      Q(CX - 6, shY + 12, 1, torH - 14, tt.dd); Q(CX + 5, shY + 12, 1, torH - 14, tt.dd);    // jacket lapel edges
      P(CX - 6, shY + 1, 2, 10, tt.l); P(CX + 4, shY + 1, 2, 10, tt.d);
    } else if (v.collar && !back) {                                          // polo / collared shirt: flaps and placket
      const cc = v.collar === v.top ? tt.l : v.collar, ct = T(cc);
      P(CX - 4, shY - 1, 8, 2, sk.d); P(CX - 7, shY - 1, 4, 3, cc); P(CX + 3, shY - 1, 4, 3, cc); P(CX - 6, shY + 2, 3, 1, ct.d); P(CX + 3, shY + 2, 3, 1, ct.d); P(CX - 7, shY - 1, 4, 1, ct.l);
      P(CX - 1, shY + 1, 2, 8, ct.d); P(CX, shY + 3, 1, 1, '#f0eee8'); P(CX, shY + 6, 1, 1, '#f0eee8'); P(CX - 4, shY, 8, 1, sk.dd);
    } else if (!back && !v.hood && !v.scarf) {                               // crew neck: rim, skin opening
      P(CX - 4, shY, 8, 1, sk.d); P(CX - 3, shY + 1, 6, 1, sk.d); P(CX - 5, shY + 2, 10, 1, tt.dd); P(CX - 4, shY + 2, 8, 1, tt.d); P(CX - 5, shY + 1, 1, 1, tt.d); P(CX + 4, shY + 1, 1, 1, tt.dd);
    } else if (back && !v.hood && !v.scarf) { P(CX - 4, shY, 8, 2, tt.d); P(CX - 4, shY + 1, 8, 1, tt.dd); }
    if (v.hood) {                                                            // hood bunched at the neck; strings in front
      P(CX - 8, shY - 2, 16, 4, sh(top, 0.7)); P(CX - 8, shY - 2, 16, 1, sh(top, 1.15)); P(CX - 7, shY + 2, 14, 2, sh(top, 0.62));
      if (!back) { P(CX - 4, shY, 8, 3, sk.d); P(CX - 4, shY + 3, 1, 8, tt.l); P(CX + 3, shY + 3, 1, 8, tt.l); P(CX - 4, shY + 11, 1, 2, '#d8d4cc'); P(CX + 3, shY + 11, 1, 2, '#d8d4cc'); }
    }
    if (v.zip && !back) { for (let y = shY + 2; y < hipY + hem - 1; y++) P(CX, y, 1, 1, y & 1 ? '#9a9aa4' : '#3a3a42'); P(CX - 1, shY + 2, 3, 1, '#b8b8c2'); P(CX - 1, shY + 3, 3, 3, '#7a7a86'); Q(CX - 1, shY + 6, 1, hipY + hem - shY - 8, tt.dd); P(CX - 5, shY - 2, 10, 3, tt.b); P(CX - 5, shY - 2, 10, 1, tt.l); P(CX - 5, shY, 10, 1, tt.d); P(CX - 4, shY - 1, 8, 1, sk.d); P(CX - 1, shY - 2, 2, 3, tt.d); }
    else if (v.zip && back) { P(CX - 5, shY - 2, 10, 3, tt.b); P(CX - 5, shY - 2, 10, 1, tt.l); P(CX - 5, shY, 10, 1, tt.d); }
    if (v.zip) { P(x0, hipY + hem - 3, tw, 3, tt.d); for (let k = 0; k < tw; k += 2) P(x0 + k, hipY + hem - 3, 1, 3, tt.dd); }   // ribbed hem
    if (v.chain && !back) { const ch = [[-4, 1], [-4, 2], [-3, 3], [-3, 4], [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 4], [2, 3], [3, 2], [3, 1]]; for (const [dx, dy] of ch) P(CX + dx, shY + dy + 1, 1, 1, dx < 0 ? sh(GOLD, 1.3) : GOLD); P(CX - 1, shY + 7, 2, 2, sh(GOLD, 1.35)); P(CX, shY + 8, 1, 1, sh(GOLD, 0.7)); }
    if (v.pocket && !back) { P(x0 + 4, shY + torH - 12, tw - 8, 8, sh(top, 0.8)); P(x0 + 4, shY + torH - 12, tw - 8, 1, tt.d); P(x0 + 4, shY + torH - 12, 1, 8, tt.dd); P(x0 + 5, shY + torH - 10, 1, 6, tt.l); P(CX - 1, shY + torH - 12, 2, 8, tt.dd); }
    if (v.scarf) {                                                           // football scarf: bands round the neck, a hanging end
      const [sa, sb] = v.scarf;
      for (let y = shY - 3; y < shY + 3; y++) for (let x = CX - 9; x < CX + 9; x++) { const hh2 = y < shY - 1 ? 7 : 9; if (Math.abs(x - 23.5) > hh2) continue; P(x, y, 1, 1, ((x >> 1) & 1) ? sb : sa); }
      P(CX - 9, shY + 2, 18, 1, T(sa).d); P(CX - 7, shY - 3, 14, 1, T(sa).l);
      if (!back) for (let k = 0; k < 8; k++) { const y = shY + 3 + k * 2; P(CX - 1, y, 6, 2, k & 1 ? sb : sa); P(CX + 4, y, 1, 2, T(k & 1 ? sb : sa).d); } if (!back) for (let k = 0; k < 6; k++) P(CX - 1 + k, shY + 19, 1, 2, k & 1 ? sb : sa);
      else { P(CX - 4, shY + 3, 6, 10, sa); }
    }
    if (v.belt) { P(x0, hipY - 3, tw, 2, v.belt); P(x0, hipY - 3, tw, 1, sh(v.belt, 1.3)); if (!back) { P(CX - 2, hipY - 4, 4, 4, GOLD); P(CX - 1, hipY - 3, 2, 2, sh(GOLD, 0.6)); } }
    if (v.bandolier) {                                                       // cross-body strap with a small bag at the hip
      const bc = v.bandolier, bt2 = T(bc), n = tor => tor;
      for (let i = 0; i < torH - 4; i++) { const x = back ? x1 - 5 - i * 0.85 : x0 + 2 + i * 0.85; P(x, shY + 1 + i, 3, 1, bc); P(x, shY + 1 + i, 1, 1, bt2.l); }
      if (!back) { P(x1 - 8, hipY - 6, 9, 8, bc); P(x1 - 8, hipY - 6, 9, 1, bt2.l); P(x1 - 8, hipY - 3, 9, 1, bt2.dd); P(x1 - 4, hipY - 4, 2, 2, GOLD); }
    }
    if (v.apron) {
      const ac = v.apron, at = T(ac), bot = hipY + 20;
      if (!back) {
        P(x0 + 3, shY + 5, tw - 6, bot - shY - 5, ac); P(x0 + 3, shY + 5, 1, bot - shY - 5, at.l); P(x1 - 6, shY + 5, 3, bot - shY - 5, at.d); P(x0 + 3, bot - 2, tw - 6, 2, at.d);
        P(x0 + 5, shY + 1, tw - 10, 5, ac); P(x0 + 5, shY + 1, 1, 5, at.l); P(x1 - 8, shY + 1, 3, 5, at.d); P(x0 + 5, shY + 1, tw - 10, 1, at.d);
        P(x0 + 5, shY - 1, 2, 3, at.dd); P(x1 - 7, shY - 1, 2, 3, at.dd);       // neck straps
        P(x0 + 3, hipY - 4, tw - 6, 2, at.dd); P(x0 + 6, hipY + 4, tw - 12, 8, at.d); P(x0 + 6, hipY + 4, tw - 12, 1, at.l); P(CX - 1, hipY + 4, 2, 8, at.dd);
        if (v.stain) { P(x0 + 6, shY + 12, 4, 3, v.stain); P(x1 - 10, hipY + 14, 3, 3, v.stain); }
      } else { P(x0 + 1, hipY - 5, tw - 2, 2, at.dd); P(x0 + 3, hipY - 3, 2, 8, ac); P(x1 - 5, hipY - 3, 2, 8, ac); P(x0 + 5, shY + 1, 2, 5, at.dd); P(x1 - 7, shY + 1, 2, 5, at.dd); }
    }
    if (v.sparkle) { for (let k = 0; k < 10; k++) P(x0 + 2 + ((k * 5) % (tw - 4)), shY + 2 + ((k * 7) % (torH - 4)), 1, 1, v.sparkle); P(x0 + 6, shY + 8, 3, 1, v.sparkle); P(x1 - 9, shY + 15, 3, 1, v.sparkle); }
    if (v.backpack) {
      const kc = v.backpack, kt = T(kc);
      if (back) { block(P, x0 + 1, shY + 1, tw - 2, torH - 6, kc, 1, 3); P(x0 + 4, shY + 5, tw - 8, 7, kt.d); P(x0 + 4, shY + 5, tw - 8, 1, kt.l); P(CX - 1, shY + 6, 2, 3, kt.dd); P(x0 + 1, shY + torH - 6, tw - 2, 1, kt.dd); }
      else { P(x0 + 3, shY, 3, 16, kt.d); P(x1 - 6, shY, 3, 16, kt.d); P(x0 + 3, shY, 1, 16, kt.l); P(x1 - 6, shY, 1, 16, kt.l); }
    }
    if (v.tote && !back) P(x0 + 3, shY, 2, hipY - shY, T(v.tote).d);
    if (v.stroller) {
      const [c1, c2] = v.stroller;
      if (back) P(x0 + 2, hipY + 2, tw - 4, 3, '#26262c');
      else { P(11, hipY + 4, 26, 6, '#26262c'); block(P, 12, hipY + 8, 24, 10, c1, 1, 3); block(P, 13, hipY + 16, 22, FY - hipY - 24, c2, 1, 3); P(12, hipY + 14, 24, 1, sh(c1, 1.4)); P(13, FY - 9, 5, 7, '#1c1c20'); P(30, FY - 9, 5, 7, '#1c1c20'); P(14, FY - 6, 3, 3, '#9a9aa2'); P(31, FY - 6, 3, 3, '#9a9aa2'); P(15, hipY + 20, 18, 4, sh(c1, 0.8)); }
    }

    // ----- arms
    const sh1 = (pose === 1 || pose === 2) ? 3 : 0, sh2 = (pose === 3 || pose === 4) ? 3 : 0;        // the arm opposite the leading leg swings back, hand a little higher
    const phoneUp = v.phone && !back;
    for (const s of [-1, 1]) {
      const ax = s < 0 ? x0 - 4 : x1 - 1, shorten = s < 0 ? sh1 : sh2, y0 = shY, len = armLen - shorten;
      if (s < 0 && phoneUp) {
        block(P, ax, y0, 5, 12, top, 1, 2); P(ax, y0 + 10, 5, 2, tt.d);
        limb(P, ax + 3, y0 + 11, ax + 8, ht + hh - 4, 5, 4, sleeveLong ? top : skin);
        hand(ax + 7, ht + hh - 8, 5, s, true); P(ax + 9, ht + hh - 14, 5, 11, '#1c1c22'); P(ax + 10, ht + hh - 13, 3, 8, v.phone); P(ax + 10, ht + hh - 13, 1, 3, '#ffffff'); P(ax + 8, ht + hh - 6, 4, 3, skin);
        continue;
      }
      if (run) {                                                             // arms pumping, forearms up
        const up = (s < 0 ? (pose === 1 || pose === 2 ? 1 : -1) : (pose === 3 || pose === 4 ? 1 : -1)) * 5;
        block(P, ax + (s < 0 ? -1 : 1), y0 + 1 - up, 6, 12, top, 1, 2); if (v.sleeveStripe) P(ax + (s < 0 ? -1 : 6), y0 + 1 - up, 1, 11, v.sleeveStripe);
        block(P, ax + (s < 0 ? -2 : 2), y0 - 9 - up, 5, 11, top, 1, 2); hand(ax + (s < 0 ? -2 : 2), y0 - 14 - up, 5, s, true); continue;
      }
      // shoulder cap, sleeve, forearm, hand
      const upperEnd = sleeveLong ? y0 + len - 7 : y0 + 12;
      block(P, ax, y0, 5, upperEnd - y0, top, 1, 2); P(ax + (s < 0 ? 1 : 0), y0 - 1, 4, 1, top);
      g.clr(ax + (s < 0 ? 0 : 4), y0, 1, 1);
      if (v.trim && !sleeveLong) P(ax, upperEnd - 2, 5, 2, v.trim); else P(ax, upperEnd - 2, 5, 1, tt.d);
      Q(ax + (s < 0 ? 1 : 0), y0 + 4, 3, 1, tt.d); Q(ax + (s < 0 ? 0 : 1), y0 + 8, 4, 1, tt.d);
      if (v.sleeveStripe) P(ax + (s < 0 ? 0 : 4), y0 + 1, 1, upperEnd - y0 - 2, v.sleeveStripe), P(ax + (s < 0 ? 1 : 3), y0 + 1, 0, 0, v.sleeveStripe);
      if (sleeveLong) {
        const cuffC = v.shirt && !back ? v.shirt : null;
        P(ax, upperEnd - 1, 5, 1, tt.d);
        if (cuffC) P(ax, upperEnd, 5, 2, cuffC);
        forearm(ax + 1, upperEnd + (cuffC ? 2 : 0), 4, y0 + len - 6 - upperEnd - (cuffC ? 2 : 0), s);
        // the long sleeve covers the forearm: draw it over
        P(ax, y0 + 1 + 12, 5, upperEnd - y0 - 12, top); P(ax, y0 + 1 + 12, 1, upperEnd - y0 - 12, tt.l); P(ax + 4, y0 + 1 + 12, 1, upperEnd - y0 - 12, tt.d);
        if (v.sleeveStripe) P(ax + (s < 0 ? 0 : 4), y0 + 1, 1, upperEnd - y0 - 2, v.sleeveStripe);
        P(ax, upperEnd - 1, 5, 2, tt.d); P(ax + 1, upperEnd + 1, 3, 1, tt.dd);
        if (cuffC) P(ax, upperEnd, 5, 2, cuffC);
        if (v.hood) P(ax, upperEnd - 3, 5, 1, tt.dd);
      } else forearm(ax + 1, upperEnd, 4, y0 + len - 6 - upperEnd, s);
      hand(ax + 1, y0 + len - 6, 4, s, false);
    }
    const hl = { x: x0 - 2, y: shY + armLen - shortenOf(sh1) }, hr = { x: x1 + 3, y: shY + armLen - shortenOf(sh2) };
    if (v.bag) item(P, 'bag', v.bag, hl.x, hl.y - 2, 'f', v);
    if (v.tote) item(P, 'tote', v.tote, hl.x, hl.y - 2, 'f', v);
    if (v.purse) item(P, 'purse', v.purse, hr.x, hr.y - 2, 'f', v);
    if (v.briefcase) item(P, 'briefcase', v.briefcase, hr.x, hr.y - 2, 'f', v);
    if (v.bag2) item(P, 'bag', v.bag2, hr.x, hr.y - 2, 'f', v);
    if (v.helmetHand) item(P, 'helmet', v.helmetHand, hr.x, hr.y - 2, 'f', v);
    if (v.drink) item(P, v.drink.type, v.drink.col, hr.x, hr.y - 1, 'f', v);
    // ----- head
    headFront(g, v, ht, hw, hh, back, skin, hair);
    if (back) hairBack(g, v, ht, hw, hh, skin, hair, st);
    hat(g, v, dir, ht, hw, hh, st);
  } else {
    // ================= side view, facing left =================
    const hipX = CX, torW = Math.max(12, Math.round(tw * 0.62)), tx0 = hipX - (torW >> 1) - 1, tx1 = tx0 + torW;
    const S = run ? 14 : v.bounce ? 6 : 9, hipJ = hipY + 3;
    const legPose = [
      [{ dx: 0, lift: 0, k: 0 }, { dx: 1, lift: 0, k: 0 }],
      [{ dx: -S, lift: 0, k: -1 }, { dx: S, lift: run ? 7 : 4, k: -3 }],
      [{ dx: 0, lift: 0, k: 0 }, { dx: -3, lift: run ? 14 : 9, k: -8 }],
      [{ dx: S, lift: run ? 7 : 4, k: -3 }, { dx: -S, lift: 0, k: -1 }],
      [{ dx: -3, lift: run ? 14 : 9, k: -8 }, { dx: 0, lift: 0, k: 0 }],
    ][pose];
    const [nearL, farL] = legPose;
    const leg = (L, dark) => {
      const c = dark ? sh(legCol, 0.72) : legCol, ax = hipX + L.dx, ay = FY - L.lift - 6;
      const kx = Math.round(hipX + L.dx * 0.5 + L.k), ky = Math.round((hipJ + ay) / 2) + (L.lift > 6 ? 3 : 0);
      limb(P, hipX, hipJ, kx, ky, 12, 9, c, { stripe: B.stripe && !dark ? B.stripe : null, sx: -1 }); limb(P, kx, ky, ax, ay, 9, 6, c, { stripe: B.stripe && !dark ? B.stripe : null, sx: -1 });
      if (!isSkirt && !isRobe && !isShorts) { const ct = T(c); Q(kx - 4, ky, 8, 1, ct.d); Q(kx - 3, ky + 3, 6, 1, ct.d); Q(ax - 3, ay - 2, 7, 1, ct.d); if (B.jeans) Q(kx - 2, ky - 8, 4, 6, sh(c, 1.14)); }
      if (isShorts) { const sl = B.len * 2 + 2, bc = dark ? sh(B.col, 0.72) : B.col; limb(P, hipX, hipJ, hipX + (kx - hipX) * sl / (ky - hipJ), hipJ + sl, 13, 11, bc); P(hipX - 6, hipJ + sl - 1, 13, 1, T(bc).dd); }
      if (v.boots) block(P, ax - 4, ay - 8, 9, 16, dark ? sh(v.boots, 0.75) : v.boots, 1, 2);
      // shoe: heel at ax+4, toe 9 px in front; a raised heel tilts the shoe toe-down
      for (let k = 0; k < 14; k++) {
        const x = ax + 5 - k, up = L.dx > 0 && L.lift > 0 ? Math.round(L.lift * (1 - k / 13)) : L.lift, yb = FY - up;
        const th = k > 10 ? 3 + (k > 12 ? -1 : 0) : 5, yt = yb - th - (k < 3 ? 0 : 0);
        P(x, yt, 1, th - 2, dark ? sh(shoeC, 0.75) : shoeC); P(x, yb - 2, 1, 2, dark ? sh(sole, 0.75) : sole);
        if (!dark && k === 1) P(x, yt, 1, th - 2, sh(shoeC, 0.8));
        if (!dark && k >= 5 && k <= 9 && !light) P(x, yt, 1, 1, sh(shoeC, 1.6));
        if (!dark && light && k >= 4 && k <= 9 && k % 2) P(x, yt + 1, 1, 1, '#a09c92');
      }
    };
    if (v.stroller) { const [c1, c2] = v.stroller; block(P, 2, hipY + 6, 17, 12, c2, 1, 3); block(P, 0, hipY + 2, 14, 8, c1, 1, 3); P(14, hipY + 1, 10, 2, '#26262c'); P(18, hipY + 1, 2, 12, '#26262c'); P(2, FY - 8, 8, 8, '#1c1c20'); P(15, FY - 8, 8, 8, '#1c1c20'); P(5, FY - 5, 3, 3, '#8a8a90'); P(18, FY - 5, 3, 3, '#8a8a90'); }
    leg(farL, true);
    // far arm behind the torso
    const sx = hipX - 1, sy = shY + 4, aN = [0, 1, 0, -1, 0][pose], amp = run ? 1.5 : v.bounce ? 0.8 : 1;
    const armJ = a => {                                                       // elbow and wrist for swing a (-1 forward .. +1 back)
      if (run) return a > 0 ? { ex: sx + 6, ey: sy + 11, wx: sx + 9, wy: sy + 21 } : a < 0 ? { ex: sx - 7, ey: sy + 8, wx: sx - 13, wy: sy + 1 } : { ex: sx - 1, ey: sy + 12, wx: sx - 8, wy: sy + 11 };
      const k = Math.abs(a) * amp;
      return a >= 0 ? { ex: sx + Math.round(5 * k), ey: sy + 13, wx: sx + Math.round(9 * k) - (1 - k > 0 ? Math.round((1 - k) * 1) : 0), wy: sy + 26 - Math.round(k) }
        : { ex: sx - Math.round(5 * k), ey: sy + 12, wx: sx - Math.round(11 * k), wy: sy + 21 };
    };
    const sideArm = (a, dark, near) => {
      const j = armJ(a), c = dark ? sh(top, 0.7) : top, sc = dark ? sh(skin, 0.75) : skin, tc = T(c);
      limb(P, sx, sy, j.ex, j.ey, 6, 5, c); if (v.sleeveStripe) { Q(sx - 2, sy + 1, 1, 12, v.sleeveStripe); }
      if (sleeveLong) { limb(P, j.ex, j.ey, j.wx, j.wy - 5, 5, 4, c); Q(j.wx - 2, j.wy - 8, 4, 1, tc.d); P(j.wx - 2, j.wy - 6, 4, 2, tc.d); }
      else { P(j.ex - 3, j.ey - 5, 6, 1, v.trim || tc.d); limb(P, j.ex, j.ey, j.wx, j.wy - 5, 4, 4, sc); if (tattoo && !dark) { const ink = mix(skin, tattoo, 0.7); for (let k = 0; k < 7; k++) P(j.ex + (j.wx - j.ex) * k / 7 - 1 + (k % 2), j.ey + 1 + k * 1.2, 2, 1, ink); } }
      if (bracelet && !dark) bracelet.forEach((bc, i) => P(j.wx - 2, j.wy - 8 + i * 2, 4, 1 + (i === 0 ? 1 : 0), bc));
      P(j.wx - 2, j.wy - 5, 4, 6, sc); P(j.wx - 2, j.wy - 5, 1, 6, dark ? sc : sh(skin, 1.08)); P(j.wx + 1, j.wy - 3, 1, 4, dark ? sh(sc, 0.8) : sk.d); P(j.wx - 2, j.wy + 1, 4, 1, dark ? sh(sc, 0.8) : sk.d);
      return j;
    };
    if (!(v.phone)) sideArm(-aN, true, false); else sideArm(0, true, false);
    // neck and torso
    const hx0 = CX - 8 - stoop * 2 + 1;
    block(P, hx0 + 6, shY - neckH - 2, 8 + stoop, neckH + 4, skin, 1, 2); P(hx0 + 6, shY - neckH - 2, 8 + stoop, 3, sk.d);
    if (v.backpack) { const kt = T(v.backpack); block(P, tx1 - 1, shY + 2, 8, torH - 7, v.backpack, 1, 2); P(tx1 + 1, shY + 6, 5, 6, kt.d); P(tx1, shY + 3, 3, 1, kt.l); }
    if (v.hood) block(P, tx1 - 3, shY - 3, 6, 8, sh(top, 0.7), 1, 2);
    if (isSkirt || isRobe) {
      const ct = T(B.col), ex = isRobe ? 4 : 3;
      for (let y = hipY - 1; y < hemY; y++) { const f = (y - hipY) / Math.max(1, hemY - hipY), e = Math.round(f * ex), o = y > hemY - 4 ? (pose === 1 || pose === 2 ? -1 : pose ? 1 : 0) : 0; P(tx0 - e + o, y, torW + 1 + e * 2, 1, B.col); P(tx0 - e + o, y, 1, 1, ct.l); P(tx1 + e - 2 + o, y, 3, 1, ct.d); }
      for (let k = 3; k < torW; k += 4) Q(tx0 + k, hipY + 4, 1, hemY - hipY - 6, ct.d); P(tx0 - ex - 1, hemY - 2, torW + ex * 2 + 3, 2, ct.dd);
    }
    leg(nearL, false);
    if (isSkirt || isRobe) { const ct = T(B.col); for (let y = hipY - 1; y < Math.min(hemY, hipY + 8); y++) { P(tx0 - 1, y, torW + 2, 1, B.col); } P(tx1 - 2, hipY, 3, 8, ct.d); }
    const base = v.vest || top, bt = T(base);
    for (let y = shY; y < hipY + hem; y++) {
      const r = y - shY, f0 = tx0 + (r < 3 ? 2 : r < 6 ? 0 : 0) + (r > torH - 5 ? 1 : 0), b0 = tx1 + (r > torH - 7 ? 1 : 0) + (r < 3 ? -2 : 0);
      P(f0, y, b0 - f0, 1, base); P(f0, y, 1, 1, bt.l); P(b0 - 3, y, 3, 1, bt.d); if (y >= hipY + hem - 2) Q(f0, y, b0 - f0, 1, bt.d);
    }
    Q(tx0 + 2, shY + torH - 9, 5, 1, bt.d); Q(tx0 + 3, shY + torH - 6, 5, 1, bt.d); Q(tx1 - 7, shY + 5, 3, 1, bt.d);
    if (v.vest) { Q(tx0, shY + 2, 3, torH - 2, v.vest); }
    if (v.stain) { P(tx0 + 3, shY + 8, 4, 3, v.stain); P(tx0 + 2, shY + 18, 5, 3, v.stain); }
    if (v.shirt) { P(tx0 + 1, shY + 1, 3, 12, v.shirt); P(tx0, shY, 2, 4, T(v.shirt).d); if (v.tie) P(tx0 + 1, shY + 3, 2, 14, v.tie); }
    if (v.collar && v.collar !== v.top) { P(tx0 + 1, shY - 1, 5, 3, v.collar); P(tx0 + 1, shY + 2, 3, 1, T(v.collar).d); }
    else if (!v.hood && !v.scarf) { P(tx0 + 2, shY, 5, 1, sk.d); P(tx0 + 2, shY + 1, 4, 1, tt.dd); }
    if (v.zip) { P(tx0 + 3, shY - 2, 6, 3, tt.b); P(tx0 + 3, shY - 2, 6, 1, tt.l); for (let y = shY + 2; y < hipY + hem - 1; y++) P(tx0, y, 1, 1, y & 1 ? '#9a9aa4' : '#3a3a42'); P(tx0, hipY + hem - 3, torW, 3, tt.d); }
    if (v.chain) { P(tx0, shY + 2, 1, 4, GOLD); P(tx0 - 1, shY + 6, 2, 2, sh(GOLD, 1.3)); }
    if (v.pocket) { P(tx0 + 3, shY + torH - 12, torW - 6, 7, tt.d); P(tx0 + 3, shY + torH - 12, torW - 6, 1, tt.dd); }
    if (v.scarf) { const [sa, sb] = v.scarf; for (let y = shY - 3; y < shY + 3; y++) for (let x = tx0 - 1; x < tx0 + 10; x++) P(x, y, 1, 1, ((x >> 1) & 1) ? sb : sa); for (let k = 0; k < 8; k++) P(tx0 - 3, shY + 3 + k * 2, 3, 2, k & 1 ? sb : sa); }
    if (v.belt) { P(tx0, hipY - 3, torW, 2, v.belt); }
    if (v.bandolier) { const bc = v.bandolier; for (let i = 0; i < torH - 4; i++) P(tx0 + 1 + (i >> 1), shY + 1 + i, 3, 1, bc); P(tx0 - 2, hipY - 6, 6, 8, bc); P(tx0 - 2, hipY - 6, 6, 1, T(bc).l); }
    if (v.apron) { const at = T(v.apron); P(tx0 - 2, shY + 4, 4, hipY - shY + 16, v.apron); P(tx0 - 2, shY + 4, 1, hipY - shY + 16, at.l); P(tx0 + 1, shY + 4, 1, hipY - shY + 16, at.d); P(tx0 - 2, hipY + 18, 4, 2, at.d); P(tx0 + 1, shY + 1, 2, 5, v.apron); P(tx0 - 1, hipY - 3, torW - 2, 2, at.dd); }
    if (v.sparkle) for (let k = 0; k < 6; k++) P(tx0 + 1 + ((k * 3) % Math.max(1, torW - 2)), shY + 2 + ((k * 7) % (torH - 4)), 1, 1, v.sparkle);
    if (v.tote) P(tx0 + 3, shY, 2, 12, T(v.tote).d);
    if (v.purse) P(tx1 - 3, hipY - 2, 5, 7, v.purse);
    // head
    const hd = headSide(g, v, ht, hw, hh, st, skin, hair);
    hat(g, v, dir, ht, hw, hh, st);
    // near arm in front of the torso
    const j = sideArm(v.phone ? 0 : aN, false, true);
    if (v.phone) {                                                           // raised hand with a phone at the ear
      const ex = sx - 3, ey2 = sy + 12, wx = hd.sx0 + hd.ws - 6, wy = hd.ey + 6;
      limb(P, sx, sy, ex, ey2, 6, 5, top); limb(P, ex, ey2, wx, wy, 5, 4, sleeveLong ? top : skin); P(wx - 2, wy - 5, 4, 7, skin); P(wx - 4, wy - 12, 4, 10, '#1c1c22'); P(wx - 4, wy - 11, 1, 6, v.phone);
    }
    const hx = j.wx, hy = j.wy;
    if (v.bag) item(P, 'bag', v.bag, hx, hy + 1, 's', v);
    if (v.tote) item(P, 'tote', v.tote, hx, hy + 1, 's', v);
    if (v.briefcase) item(P, 'briefcase', v.briefcase, hx, hy + 1, 's', v);
    if (v.bag2) item(P, 'bag', v.bag2, hx + 3, hy + 1, 's', v);
    if (v.helmetHand) item(P, 'helmet', v.helmetHand, hx, hy + 1, 's', v);
    if (v.drink) item(P, v.drink.type, v.drink.col, hx - 1, hy, 's', v);
  }
}
const shortenOf = s => s;

// Wheelchair (and the empty one): wheels turn with the pose, spokes in profile, dashes along the rim head-on.
function chairParts(g, v, dir, pose) {
  const P = (x, y, w, h, c) => g.P(x, y, w, h, c), empty = v.chair === 'empty', HY = FY - 28, dark = '#2e2e34', frame = '#4a4a52', cush = '#2f3f6a';
  const B = v.bottom, hipX = CX, shY = HY - (v.tor || 14) * 2, ph = pose;
  const wheelSide = (cx, cy, r) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d >= r - 2 && d <= r + 0.5) P(cx + x, cy + y, 1, 1, d >= r - 0.8 ? '#222226' : '#9a9aa2'); }
    P(cx - r, cy - 1, 1, 1, '#222226');
    for (let k = 0; k < 6; k++) { const a = ph * 0.5 + k * Math.PI / 3; for (let t = 2; t < r - 2; t++) P(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1, '#6c6c74'); }
    ell(P, cx - 2, cy - 2, 4, 4, '#c8c8d0'); P(cx - 1, cy - 1, 2, 2, '#6c6c74');
  };
  const wheelFront = x => { for (let y = FY - 34; y < FY; y++) P(x, y, 3, 1, ((y + ph * 3) % 8) < 4 ? '#9a9aa2' : '#222226'); P(x, FY - 34, 3, 1, '#222226'); };
  if (dir === FRONT || dir === BACK) {
    wheelFront(2); wheelFront(43);
    if (empty) {
      P(13, FY - 60, 22, 36, dark); P(8, FY - 40, 4, 10, frame); P(36, FY - 40, 4, 10, frame); P(12, FY - 30, 24, 6, cush); P(13, FY - 30, 22, 1, '#4a5a8a');
      P(13, FY - 24, 4, 18, frame); P(31, FY - 24, 4, 18, frame); if (dir === FRONT) { P(13, FY - 6, 22, 4, '#3a3a40'); P(14, FY - 6, 20, 1, '#5a5a62'); }
    } else if (dir === BACK) { P(14, shY + 8, 20, 20, dark); P(10, shY + 4, 4, 6, dark); P(34, shY + 4, 4, 6, dark); P(14, shY + 8, 20, 1, '#4a4a52'); }
    else { P(8, HY + 2, 6, 4, frame); P(34, HY + 2, 6, 4, frame); P(8, HY + 2, 6, 1, '#6a6a72'); P(34, HY + 2, 6, 1, '#6a6a72'); }
  } else {
    if (!empty) {
      g.clr(0, HY, 48, 96 - HY);
      block(P, hipX - 18, HY - 2, 22, 8, B.col, 1, 2); block(P, hipX - 18, HY + 6, 8, 16, B.col, 1, 2); block(P, hipX - 22, FY - 8, 12, 5, v.shoes, 1, 1); P(hipX - 22, FY - 4, 12, 2, '#3a3a40');
      P(hipX + 8, shY + 6, 4, HY - shY + 8, dark); P(hipX + 10, shY + 4, 8, 2, dark); P(hipX - 16, HY + 6, 24, 2, dark); P(hipX - 20, HY + 6, 6, 2, frame);
    } else {
      P(hipX + 8, FY - 64, 4, 40, dark); P(hipX + 10, FY - 64, 8, 2, dark); block(P, hipX - 14, FY - 30, 24, 6, cush, 1, 2); P(hipX - 16, FY - 24, 4, 20, frame); P(hipX - 22, FY - 6, 10, 4, '#3a3a40');
    }
    wheelSide(hipX + 2, FY - 20, 16);
  }
}

// ---------- cell: draw, mirror for right, add the outline ----------
// outline colour = a dark version of the neighbouring pixel (selective outline), light rim on the top-left edge and a shaded bottom-right
const edgeK = [0.3, 0.28, 0.36];
function finish(img) {
  const d = img.d, W = CELL_W, H = CELL_H, out = new Uint8ClampedArray(d.length), a = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3] > 127 ? 1 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (a(x, y)) {
      let k = 1;
      if (!a(x - 1, y) || !a(x, y - 1)) k = 1.08; else if (!a(x + 1, y) || !a(x, y + 1)) k = 0.9;
      const edge = !a(x - 1, y) || !a(x + 1, y) || !a(x, y - 1) || !a(x, y + 1);
      if (edge) { out[i] = d[i] * k * 0.78; out[i + 1] = d[i + 1] * k * 0.76; out[i + 2] = d[i + 2] * k * 0.82; } else { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; }
      out[i + 3] = 255;
    } else {
      let j = -1;
      if (a(x - 1, y)) j = i - 4; else if (a(x + 1, y)) j = i + 4; else if (a(x, y - 1)) j = i - W * 4; else if (a(x, y + 1)) j = i + W * 4;
      if (j >= 0) { out[i] = d[j] * edgeK[0] + 8; out[i + 1] = d[j + 1] * edgeK[1] + 6; out[i + 2] = d[j + 2] * edgeK[2] + 12; out[i + 3] = 255; }
    }
  }
  return out;
}
function flipX(buf) {
  const W = CELL_W, H = CELL_H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W >> 1; x++) for (let c = 0; c < 4; c++) { const i = (y * W + x) * 4 + c, j = (y * W + (W - 1 - x)) * 4 + c, t = buf[i]; buf[i] = buf[j]; buf[j] = t; }
}
export function cellData(v, dir, pose) {
  const img = new Img();
  if (v.pair) { // a couple: two figures side by side, walking out of step
    const sw = p => (p === 1 ? 3 : p === 2 ? 4 : p === 3 ? 1 : p === 4 ? 2 : p);
    img.ox = -8; figure(img, v.pair[0], dir === RIGHT ? LEFT : dir, pose); img.ox = 8; figure(img, v.pair[1], dir === RIGHT ? LEFT : dir, sw(pose)); img.ox = 0;
  } else {
    const dd = dir === RIGHT ? LEFT : dir;
    if (v.chair !== 'empty') figure(img, v, dd, pose);
    if (v.chair) chairParts(img, v, dd, pose);
  }
  const out = finish(img);
  if (dir === RIGHT) flipX(out);
  return out;
}

// ---------- atlas ----------
// Variant r sits in block column r % PACK and block row floor(r / PACK); a block is COLS cells wide (direction x pose), one cell high.
export function atlasSize(rows, scale = 1) { return { w: PACK * COLS * CELL_W * scale, h: Math.ceil(rows / PACK) * CELL_H * scale }; }
export function buildAtlasData(variants, scale = 1) {
  const { w, h } = atlasSize(variants.length, 1), data = new Uint8ClampedArray(w * h * 4);
  variants.forEach((v, r) => {
    const ox = (r % PACK) * COLS * CELL_W, oy = Math.floor(r / PACK) * CELL_H;
    for (let d = 0; d < DIRS; d++) for (let p = 0; p < POSES; p++) {
      const cell = cellData(v, d, p), cx0 = ox + (d * POSES + p) * CELL_W;
      for (let y = 0; y < CELL_H; y++) data.set(cell.subarray(y * CELL_W * 4, (y + 1) * CELL_W * 4), ((oy + y) * w + cx0) * 4);
    }
  });
  if (scale === 0.5) return halve(data, w, h);
  return { data, w, h };
}
// alpha-weighted 2 x 2 box downscale for phones
function halve(src, w, h) {
  const w2 = w >> 1, h2 = h >> 1, out = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = ((y * 2 + dy) * w + x * 2 + dx) * 4, al = src[i + 3]; r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; }
    const o = (y * w2 + x) * 4; if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a >= 510 ? 255 : a * 0.5 >= 100 ? 255 : 0; }
  }
  return { data: out, w: w2, h: h2 };
}
