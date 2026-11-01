// The parametric character: a spec (see people.js for the fields and the generator) becomes a posed solid figure drawn into a raster.js Cell.
// Owned by the pedestrian work. Everything is in design units (adult 44), y up from the ground, x to the viewer's right facing the viewer, z forward.
// Poses: 0 idle, 1 step A (the near leg forward), 2 passing A (the far leg swings through), 3 step B, 4 passing B, 5 drink (the near forearm raises a bottle or glass).
import { Cell, ci, mixc, shade, lumi, hs, tonesOf } from './raster.js';

const rad = Math.PI / 180, SK = 1, HR = 2, HD = 3;   // tone styles: skin, hair, hard
const SOLE_DARK = 0x2a2624;
export const HK = 1.45, LK = 0.58, TK = 0.64;   // chibi proportions: the head (drawn in head units, then scaled by HK), the legs and the torso of the old 44 unit design shrink or grow by these

// ---------- the walk cycle: thigh pitch, knee bend, arm pitch (degrees, forward positive) for the near (x+) and far (x-) side ----------
const WALK = [
  null,
  { l: [26, 3], r: [-20, 16], al: -24, ar: 26 },
  { l: [-3, 0], r: [14, 52], al: -6, ar: 6 },
  { l: [-20, 16], r: [26, 3], al: 26, ar: -24 },
  { l: [14, 52], r: [-3, 0], al: 6, ar: -6 }];
const lerpPose = (a, b, t) => ({ l: [a.l[0] + (b.l[0] - a.l[0]) * t, a.l[1] + (b.l[1] - a.l[1]) * t], r: [a.r[0] + (b.r[0] - a.r[0]) * t, a.r[1] + (b.r[1] - a.r[1]) * t], al: a.al + (b.al - a.al) * t, ar: a.ar + (b.ar - a.ar) * t });
const IDLE = { l: [0, 0], r: [0, 0], al: 3, ar: -3 };

const D = (v, d) => v === undefined ? d : v;

// ---------- the head ----------
// Head profile: half width a(y), half depth b(y) and the z centre, for y measured from the head centre (chin at -hh/2). grow thickens it (hair, hats, beards).
function headKnots(f, hh, grow, yLo = -1e9, yHi = 1e9) {
  const fw = f.fw, jw = 2.35 + f.jaw * 1.35, out = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16, y = (t - 0.5) * hh;
    let a;
    if (t < 0.5) { const q = t / 0.5; a = q < 0.08 ? 0.5 + q * 6 : jw * (0.24 + 0.76 * Math.pow(Math.min(1, q / 0.62), 0.8)) + (fw - jw) * Math.max(0, (q - 0.62) / 0.38) * (f.cheek * 0.5 + 0.5); }
    else { const q = (t - 0.5) / 0.5; a = fw * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, q - 0.12) / 0.88, 2.1))); }
    if (k === 0) a = 0.35 + f.chinW;
    out.push([y, Math.max(0.25, a + grow * (t > 0.97 ? 0.4 : 1)), Math.max(0.3, a * 1.08 + 0.45 + grow - (t < 0.4 ? 0.5 * (0.4 - t) / 0.4 * 2 : 0)), 0, -0.45 + (t < 0.3 ? 0.35 * (0.3 - t) / 0.3 : 0)]);
  }
  return out.filter(k => k[0] >= yLo && k[0] <= yHi);
}
const halfW = (f, hh, y) => { const k = headKnots(f, hh, 0); for (let i = 1; i < k.length; i++) if (y <= k[i][0]) { const t = (y - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t; } return 0.5; };

function faceDeco(sp, f, hy, hz, S, skin) {
  const hh = sp.hhU, ey = f.eyeY - 0.35, eg = f.eyeGap, m = 1 / S;
  const white = ci('#efe9e0'), iris = ci(f.eyeCol), pupil = 0x15110f, lid = mixc(skin, '#2a1a14', 0.7), browC = ci(f.browCol), lipC = ci(f.lipCol), mouthC = mixc(skin, '#4a1f1f', 0.65);
  const stub = f.stubble ? mixc(skin, f.stubble, 0.62) : -1, sd = f.stubbleD, nostr = mixc(skin, '#3a1a14', 0.5), blush = mixc(skin, '#e07a7a', 0.38), wrink = mixc(skin, '#6a3a2a', 0.28);
  const ew = 0.95 * f.eyeSize * (f.eyeShape === 'wide' ? 1.12 : f.eyeShape === 'narrow' ? 1.05 : 1), eh = (f.eyeShape === 'round' ? 0.68 : f.eyeShape === 'wide' ? 0.8 : f.eyeShape === 'narrow' ? 0.4 : 0.52) * f.eyeSize, tilt = f.eyeTilt;
  const myy = -2.3 + f.mouthY, mw = f.mouthW / 2, bt = Math.max(f.browThick, m * 1.1), by = ey + 1.5 + f.browY, bl = 1.25 * f.eyeSize + 0.25;
  const ewE = Math.max(ew, 0.62 * m * 3.2), ehE = Math.max(eh, 0.55 * m * 2.0);
  return (mx, my, mz) => {
    const x = mx, y = my - hy, z = mz - hz, ax = x < 0 ? -x : x;
    if (z > 0.2) {
      // eyes
      const dx = ax - eg, dy = y - ey - tilt * dx * -1 * 0 - tilt * dx;
      const ex = dx / ewE, eyr = dy / ehE;
      if (ex * ex + eyr * eyr < 1) {
        if (eyr > 0.35) return lid;
        const ir = (dx * dx) / (0.5 * 0.5) + (dy * dy) / ((Math.min(0.62, ehE * 0.95)) ** 2);
        if (ir < 0.28) return pupil;
        if (ir < 1) return (dx < -0.12 && dx > -0.5 && dy > 0.02 && ehE > 0.5) ? white : iris;
        return white;
      }
      // brows
      const bdx = ax - eg, yb = by + f.browTilt * bdx + f.browArch * (1 - (bdx / bl) * (bdx / bl));
      if (bdx > -bl && bdx < bl && Math.abs(y - yb) < bt * 0.5 * (1 - 0.35 * Math.abs(bdx / bl))) return browC;
      // lid crease and eye bags (age)
      if (f.age > 0.55 && Math.abs(dx) < ew && y < ey - eh * 1.15 && y > ey - eh * 1.9 && ((mx * 7 + my * 3) % 2 < 1.2)) return wrink;
      // mouth
      const ym = myy + f.smile * 0.5 * (ax / mw) * (ax / mw);
      if (ax < mw && z > 1.0) {
        const dm = y - ym;
        if (Math.abs(dm) < Math.max(0.2, m * 0.9) * (1 - 0.5 * ax / mw)) return mouthC;
        if (f.smile > 0.55 && dm < 0 && dm > -0.55 && ax < mw * 0.7) return white;
        if (dm > 0 && dm < f.lip * 0.5 * (1 - ax / mw * 0.6)) return lipC;
        if (dm < 0 && dm > -f.lip * 0.75 * (1 - ax / mw * 0.5)) return lipC;
      }
      // nostrils, and the dimples of a smile
      const ny = -1.45 + f.noseY - 0.5;
      if (ax > 0.35 && ax < 0.85 && Math.abs(y - ny) < Math.max(0.28, m * 0.9) && z > 2.5) return nostr;
      if (f.smile > 0.7 && ax > mw + 0.1 && ax < mw + 0.55 && Math.abs(y - (ym + 0.2)) < 0.5) return wrink;
      if (f.blush && ax > 2.0 && ax < 3.4 && y < ey - 0.6 && y > ey - 2.0 && (hs((mx * S) | 0, (my * S) | 0) < 0.55)) return blush;
      if (f.freckles && ax > 0.6 && ax < 3.2 && y < ey && y > ey - 1.5 && hs((mx * S * 1.0) | 0, (my * S * 1.0 + 7) | 0) < 0.07) return mixc(skin, '#8a4a2a', 0.55);
      if (f.age > 0.4 && ax < 3.5 && y > ey + 2.3 + f.browY && y < ey + 3.3 && ((y * 2.6) % 1) < 0.28) return wrink;   // forehead lines
      if (f.age > 0.62 && ax > 1.0 && ax < 2.4 && y > ey - 2.7 && y < ey - 1.7 && ((ax + y) % 0.9) < 0.22) return wrink;
    }
    // stubble over the lower face: the jaw, the chin, the upper lip
    if (stub !== -1 && z > -1.8 && y < -0.2 - Math.max(0, 1.2 - ax * 0.4) * 0 && (y < myy + 1.1 || ax > 1.2) && y < ey - 0.6 && !(z > 1.0 && ax < mw && Math.abs(y - myy) < 0.5)) {
      if (hs(((mx + 20) * S) | 0, ((my + 20) * S + ((mz + 20) * S | 0) * 37) | 0) < sd) return stub;
    }
    return -1;
  };
}

// hair: a list of drawing steps on top of the head; hy/hz the head centre. The cap is the head profile grown a little and clipped by a hairline
function drawHair(c, sp, f, hy, hz, S) {
  const st = sp.hairStyle, col = sp.hair, hh = sp.hhU, fw = f.fw;
  if (st === 'bald' || (sp.hat && (sp.hat.type === 'scarf' || sp.hat.type === 'helmet' || sp.hat.type === 'hood' || sp.hat.type === 'beanie'))) return;
  const hc = ci(col), o = { col: hc, style: HR, part: 6 };
  const cap = (grow, hl, side, nape, xo, extra) => {
    grow *= 0.7;
    const knots = headKnots(f, hh, grow, side - 1.6).map(k => [k[0] + hy, k[1], k[2], k[3], k[4] + hz]);
    knots.push([hy + hh / 2 + grow * 0.6, 0.4, 0.5, 0, hz - 0.45]);
    c.sweep(knots, { ...o, bias: 0.1, deco: (mx, my, mz) => {
      const x = mx, y = my - hy, z = mz - hz, ax = x < 0 ? -x : x;
      const yf = hl - 1.5 * (ax / fw) * (ax / fw) + (extra ? extra(x, z) : 0) + 0.38 * Math.sin(ax * 3.4 + 1);   // a scalloped hairline
      let thr; if (z > 0.7) thr = yf; else if (z > -1.4) { const q = (z + 1.4) / 2.1; thr = side * (1 - q) + yf * q; } else thr = nape;
      if (y < thr) return -2;
      if (st === 'fade' && y < 1.9 && z < 1.5) return mixc(col, sp.skin, 0.38 + 0.2 * ((y < 0.2) ? 1 : 0));   // faded sides: skin showing through
      if (st === 'buzz') return mixc(col, sp.skin, 0.55);
      return -1;
    } });
  };
  const top = hy + hh / 2;
  const crown = (n = 3) => { for (let k = 0; k < n; k++) { const q = hs(k + 3, hc & 255), a = (k / n - 0.3) * 2.4; c.blob(Math.sin(a) * fw * 0.5, top - 0.9 - Math.abs(Math.sin(a)) * 0.5, hz + Math.cos(a) * 1.0 - 0.8, 1.7 + q * 0.4, 1.2, 1.9, { ...o, bias: 0.16 + q * 0.1, part: 6 }); } };
  if (st === 'short' || st === 'fade' || st === 'buzz' || st === 'quiff' || st === 'fringe' || st === 'comb') {
    const hl = st === 'fringe' ? 1.1 : st === 'quiff' ? 2.7 : 2.3;
    cap(st === 'buzz' ? 0.18 : 0.42, hl, 0.5, -3.4); if (st !== 'buzz') crown(st === 'fade' ? 2 : 3);
    if (st === 'quiff') { c.blob(0.2, top - 0.2, hz + 1.5, fw * 0.78, 1.55, 3.0, { ...o, bias: 0.05 }); c.blob(0.4, top + 0.1, hz + 0.3, fw * 0.6, 1.2, 2.5, { ...o, bias: 0.12 }); }
    if (st === 'comb') c.blob(-0.6, top - 0.4, hz + 0.5, fw * 0.8, 0.9, 3.4, o);
  } else if (st === 'swept') {   // short at the sides, longer on top and brushed up and back, the forehead clear
    cap(0.4, 3.1, 0.6, -3.2);
    c.blob(0.0, top - 0.25, hz + 0.4, fw * 0.82, 0.8, 3.5, { ...o, bias: 0.08 });
  } else if (st === 'curlylong') {   // shoulder-length waves with curled ends, parted, falling past the ears
    cap(0.5, 2.2, 0.1, -1.0, 0, (x, z) => (x > 0.3 ? 0.4 : -0.4));
    const bottom = hy - hh / 2 - 3.6;
    c.sweep([[hy + 1.5, fw + 0.6, 2.2, 0, hz - fw * 0.8], [hy - 1.5, fw + 0.8, 2.3, 0, hz - fw * 0.85], [bottom + 1.2, fw + 0.6, 1.8, 0, hz - fw * 0.85], [bottom, fw + 0.2, 1.2, 0, hz - fw * 0.9]], { ...o, part: 7 });
    for (const s of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const yy = hy + 1.6 - k * 1.45, ww = 1.45 - k * 0.05, xx = s * (fw + 0.55 + ((k * 7 + (s > 0 ? 3 : 0)) % 3) * 0.28);
        c.blob(xx, yy, hz - 0.5 - (k & 1) * 0.55, ww, 1.45, 1.55, { ...o, bias: (hs(k, s + 5) - 0.5) * 0.34, part: 6 });
      }
    }
    for (let k = 0; k < 7; k++) c.blob(-fw * 0.9 + k * fw * 0.3, bottom + 0.3 - (k & 1) * 0.5, hz - fw * 0.95 - 0.2, 1.25, 1.3, 1.2, { ...o, bias: (hs(k, 9) - 0.5) * 0.3, part: 6 });
    c.blob(1.2, top - 0.2, hz + 0.9, 1.7, 0.9, 1.5, { ...o, bias: 0.15, part: 6 }); c.blob(-1.6, top - 0.5, hz + 0.6, 1.5, 0.8, 1.3, { ...o, bias: -0.05, part: 6 });
  } else if (st === 'bun') {
    cap(0.42, 2.0, 0.6, -3.0); c.blob(0, top - 0.3, hz - 2.2, 2.0, 1.9, 2.0, o); c.blob(0, top - 0.8, hz - 2.2, 2.3, 0.6, 2.3, { ...o, bias: -0.1 });
  } else if (st === 'ponytail') {
    cap(0.42, 2.0, 0.6, -3.0); for (let i = 0; i < 6; i++) c.blob(0, hy + 0.8 - i * 1.5, hz - fw * 1.05 - i * 0.2, 1.2 - i * 0.07, 1.1, 1.3, o);
  } else if (st === 'long' || st === 'bob' || st === 'wavy') {
    cap(0.45, 1.8, 0.2, -1.2); crown(3);
    const bottom = st === 'bob' ? hy - hh / 2 + 0.8 : hy - hh / 2 - 2.4 - (sp.hairLen || 0), wv = st === 'wavy' ? 0.6 : 0.15;
    // the back: a rounded mass that narrows to uneven tips
    c.sweep([[hy + 1.2, fw + 0.3, 1.5, 0, hz - fw * 0.75], [hy - 1.5, fw + 0.5, 1.5, 0, hz - fw * 0.8], [bottom + 2.0, fw + 0.4 + wv * 0.5, 1.4, 0, hz - fw * 0.8], [bottom + 0.8, fw * 0.75, 1.0, 0, hz - fw * 0.85], [bottom, fw * 0.4, 0.6, 0, hz - fw * 0.85]], { ...o, part: 7 });
    for (let k = 0; k < 4; k++) c.blob((k - 1.5) * fw * 0.5, bottom + 0.8 - (k & 1) * 0.8, hz - fw * 0.85, 1.5, 1.5, 1.1, { ...o, bias: (hs(k, hc & 255) - 0.5) * 0.3, part: 6 });
    // locks framing the face: chains of blobs, a little wavy
    for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const yy = hy + 1.5 - k * (bottom < hy - hh / 2 ? 1.5 : 1.0), r = 1.4 - k * 0.07; if (yy < bottom + 0.8) break; c.blob(sd * (fw + 0.3 + Math.sin(k * 1.4 + (sd > 0 ? 1 : 0)) * wv), yy, hz - 0.2 - k * 0.1, r, 1.25, 1.5, { ...o, bias: (hs(k + 7, sd + 2) - 0.5) * 0.3, part: 7 + (sd > 0 ? 1 : 0) }); }
  } else if (st === 'curly') {
    cap(0.5, 2.2, 1.0, -0.8);
    const n = sp.curls || 44, long = sp.hairLong !== false;
    for (let i = 0; i < n; i++) {
      const r1 = hs(i, 11), r2 = hs(i, 29), r3 = hs(i, 57), a = r1 * Math.PI * 2, el = 0.15 + r2 * 0.85;
      const rx = fw + 0.35 + r3 * 0.35, ry = hh * 0.5 + 0.2;
      let x = Math.cos(a) * rx * Math.cos(el * 1.25), z = hz - 0.4 + Math.sin(a) * rx * Math.cos(el * 1.25) * 0.95, y = hy + Math.sin(el * 1.25) * ry * 0.9 - (long ? r3 * 1.5 : 0);
      if (z > hz + 1.2 && y < hy + 2.6) { z -= 2.4; }   // keep the face clear
      c.blob(x, y, z, 1.3 + r3 * 0.4, 1.3 + r2 * 0.4, 1.3 + r3 * 0.3, { ...o, bias: (r2 - 0.5) * 0.25, part: 6 });
    }
    if (long) for (let i = 0; i < 26; i++) {
      const r1 = hs(i, 71), r2 = hs(i, 93), s = i & 1 ? 1 : -1, x = s * (fw * (0.3 + r1 * 0.75)), y = hy - 1.2 - r2 * (hh * 0.7 + (sp.hairLen || 3)), z = hz - 1.2 - (i % 3) * 0.9 - (Math.abs(x) > fw * 0.8 ? -1.5 : 0.3) * 0;
      c.blob(x * (Math.abs(x) > fw * 0.82 ? 1.05 : 1), y, Math.abs(x) > fw * 0.9 ? hz - 0.4 : z, 1.35, 1.5, 1.4, { ...o, bias: (hs(i, 5) - 0.5) * 0.25, part: 6 });
    }
  } else if (st === 'monk') {   // bald on top, grey ring over the ears and the back
    c.sweep(headKnots(f, hh, 0.35, -2.4, 0.9).map(k => [k[0] + hy, k[1], k[2], k[3], k[4] + hz]), { ...o, deco: (mx, my, mz) => (mz - hz > 0.5 ? -2 : -1) });
  }
}

// ---------- hats ----------
function drawHat(c, sp, f, hy, hz) {
  const h = sp.hat; if (!h) return;
  const hh = sp.hhU, fw = f.fw, top = hy + hh / 2, col = ci(h.col), col2 = h.col2 ? ci(h.col2) : col, o = { col, part: 9, style: 0 };
  const brimPart = { ...o, part: 10, style: HD };
  switch (h.type) {
    case 'flatcap': c.blob(0, top - 1.35, hz + 0.1, fw + 0.55, 2.3, fw + 0.9, o); c.blob(0, hy + 1.35, hz + fw * 0.95, fw * 0.8, 0.45, 1.9, { ...o, col: shade(col, 0.82), part: 10 }); break;
    case 'peaked': c.blob(0, top - 1.2, hz - 0.1, fw + 0.55, 2.4, fw + 0.8, o); c.sweep([[hy + 1.5, fw + 0.55, fw + 0.8, 0, hz - 0.1], [hy + 2.2, fw + 0.5, fw + 0.7, 0, hz - 0.1]], { ...o, col: col2, part: 11 }); c.blob(0, hy + 1.2, hz + fw * 0.95, fw * 0.75, 0.4, 1.9, { ...brimPart, col: 0x15141a }); c.blob(0.0, hy + 2.7, hz + fw * 0.9, 0.9, 0.7, 0.4, { ...o, col: col2 }); break;
    case 'straw': {
      c.sweep([[hy + 1.2, fw * 2.1, fw * 2.1, 0, hz], [hy + 1.7, fw * 2.05, fw * 2.05, 0, hz], [hy + 2.3, fw * 1.4, fw * 1.4, 0, hz]], { ...o, col, part: 10, deco: (mx, my, mz) => ((((mx * 9) | 0) + ((mz * 9) | 0)) & 1) ? shade(col, 0.88) : -1 });
      c.blob(0, hy + 3.3, hz, fw * 0.95 + 0.4, 2.4, fw * 1.0 + 0.5, o); c.sweep([[hy + 2.0, fw + 0.5, fw + 0.55, 0, hz], [hy + 3.0, fw + 0.5, fw + 0.55, 0, hz]], { ...o, col: col2, part: 11 }); break;
    }
    case 'helmet': c.blob(0, hy + 0.9, hz - 0.1, fw + 0.9, hh * 0.5 + 0.5, fw + 1.0, { ...o, style: HD }); c.sweep([[hy - 1.4, fw + 0.7, fw + 0.9, 0, hz - 0.1], [hy - 0.5, fw + 0.9, fw + 1.0, 0, hz - 0.1]], { ...o, col: 0x202026, part: 11 }); c.blob(0, hy + 0.6, hz + fw * 1.02, fw * 0.6, 0.5, 0.6, { ...o, col: 0x55555c, part: 12 }); break;
    case 'cap': {
      c.blob(0, top - 1.2, hz + 0.1, fw + 0.5, 2.6, fw + 0.8, o);
      const back = h.back; c.blob(0, hy + 1.6, hz + (back ? -fw * 1.1 : fw * 1.0), fw * 0.7, 0.45, 1.7, { ...brimPart, col: shade(col, 0.85) });
      c.blob(0, top - 0.9, hz - (back ? 0 : 0), 0.6, 0.45, 0.6, { ...o, col: col2, part: 11 }); break;
    }
    case 'hood': {
      const k = headKnots(f, hh, 0.85, -hh / 2 + 0.6).map(q => [q[0] + hy, q[1], q[2] + 0.2, q[3], q[4] + hz]); k.push([hy + hh / 2 + 0.7, 0.4, 0.5, 0, hz - 0.45]);
      c.sweep(k, { ...o, deco: (mx, my, mz) => { const x = mx, y = my - hy, z = mz - hz, ax = x < 0 ? -x : x; if (z > 0.8 && ax < fw * 0.9 && y < hh * 0.5 - 0.7) return -2; return -1; } }); break;
    }
    case 'scarf': {   // a headscarf, knotted under the chin
      const k = headKnots(f, hh, 0.3, -hh / 2 + 0.3).map(q => [q[0] + hy, q[1], q[2] + 0.1, q[3], q[4] + hz]); k.push([hy + hh / 2 + 0.3, 1.2, 1.4, 0, hz - 0.45]);
      c.sweep(k, { ...o, deco: (mx, my, mz) => {
        const x = mx, y = my - hy, z = mz - hz, ax = x < 0 ? -x : x;
        if (z > 0.3 && (ax / (fw * 0.94)) ** 2 + ((y + 0.3) / (hh * 0.5)) ** 2 < 1) return -2;
        return h.col2 && ((Math.floor(mx * 2.2) + Math.floor(my * 2.2)) & 1) ? col2 : -1;
      } });
      c.blob(0, hy - hh / 2 - 0.1, hz + 1.2, 1.6, 1.0, 1.2, { ...o, part: 12 }); break;
    }
    case 'beanie': c.blob(0, top - 1.5, hz - 0.2, fw + 0.55, 2.6, fw + 0.8, o); c.sweep([[hy + 1.7, fw + 0.62, fw + 0.9, 0, hz - 0.15], [hy + 3.0, fw + 0.6, fw + 0.85, 0, hz - 0.15]], { ...o, col: shade(col, 0.8), part: 11 }); break;
  }
}

// ---------- the figure ----------
function pitchDir(p, side, ab) { const r = p * rad; return [side * Math.sin(ab * rad), -Math.cos(r), Math.sin(r)]; }

export function drawCharacter(c, sp, pose) {
  const S = c.S, f = sp.face, run = !!sp.run, bounce = !!sp.bounce;
  const leg = D(sp.leg, 19) * LK, tor = D(sp.tor, 14) * TK, hh = sp.hhU, tw = D(sp.tw, 12), stoop = D(sp.stoop, 0);
  const skin = ci(sp.skin), skT = tonesOf(skin, SK), top = ci(sp.top), B = sp.bottom, isRobe = B.type === 'robe', isSkirt = B.type === 'skirt', isShorts = B.type === 'shorts';
  const legCol = isRobe ? ci(B.col) : isSkirt ? ci(sp.legCol || sp.skin) : isShorts ? skin : ci(B.col), shoeC = ci(sp.shoes), sleeveLong = sp.sleeve !== 'short', fem = !!sp.fem;
  const AMP = run ? 1.75 : bounce ? 0.85 : sp.slow ? 0.7 : 1;
  let wp = pose === 0 || pose === 5 ? IDLE : WALK[pose];
  if (sp.chair) wp = { l: [86, 86], r: [86, 86], al: 20, ar: 20 };
  const sit = pose === 6 || pose === 7;   // on the ground, knees up
  if (sit) wp = { l: [100, 50], r: [113, 57], al: 12, ar: 12 };
  if (AMP !== 1 && wp !== IDLE) wp = lerpPose(IDLE, wp, AMP);
  // leg FK
  const hipJ = leg - 1, Lt = (hipJ - 2.1) * 0.5, Ls = (hipJ - 2.1) * 0.5, hx = 3.0 + (fem ? 0.1 : 0);
  const ank = [], kne = [];
  for (const [i, side] of [[0, 1], [1, -1]]) {
    const [th, kb] = i === 0 ? wp.l : wp.r;
    const a1 = th * rad, a2 = (th - kb) * rad;
    const kz = Math.sin(a1) * Lt, ky = -Math.cos(a1) * Lt, az = kz + Math.sin(a2) * Ls, ay = ky - Math.cos(a2) * Ls;
    const spl = sit || sp.chair ? 0 : 1.1 * Math.min(1, Math.abs(th) / 24);   // the feet step a little apart
    kne[i] = [side * (hx + spl * 0.5), ky, kz]; ank[i] = [side * (hx + spl), ay, az];
  }
  const reach = Math.min(ank[0][1], ank[1][1]);
  const bob = (pose === 2 || pose === 4) && !sp.chair ? (run ? 0.9 : 0.35) : 0, hipY = 2.1 - reach + bob + (sp.chair ? 2.4 : 0);   // the lowest ankle stands on the ground
  const shY = hipY + tor - 1, zl = y => stoop * 0.5 * Math.max(0, (y - hipY) / tor) * 3.2 + (run ? 0.35 * Math.max(0, y - hipY) / 3 : 0);   // forward lean
  const part = n => n;

  // ----- legs
  const legParts = [];
  for (const i of [1, 0]) {   // far leg first
    const side = i === 0 ? 1 : -1, h = [side * hx, hipY, 0], k = [kne[i][0], hipY + kne[i][1], kne[i][2]], a = [ank[i][0], hipY + ank[i][1], ank[i][2]];
    const tn = B.type === 'trousers' ? tonesOf(legCol, 0) : null;
    const dec = isShorts || (B.type === 'trousers' && (B.stripe || B.jeans || true)) ? (mx, my) => {
      if (B.stripe && ((side > 0) === (mx - side * hx > 0.4))) { const o = Math.abs(mx - side * hx); if (o > 1.3 && o < 2.2) return ci(B.stripe); }
      if (B.type === 'trousers' && (hs((my * 2) | 0, 3) < 0 && 0)) return -1;
      return -1;
    } : undefined;
    limb(c, h, k, 3.3, 2.8, 3.2, 2.8, legCol, { part: 20 + i * 2, style: isShorts ? SK : 0, deco: dec, cut: isShorts ? { at: 0.5 + (B.len || 8) * 0.07, col: ci(B.col) } : null, fold: B.type === 'trousers' });
    limb(c, k, a, 2.9, 2.2, 2.8, 2.2, legCol, { part: 21 + i * 2, style: isShorts ? SK : 0, fold: B.type === 'trousers', cuff: B.type === 'trousers', ripped: B.ripped ? skin : -1, skin: B.ripped ? sp.skin : undefined });
    // boots on top of the trousers
    if (sp.boots) limb(c, [a[0], a[1] + 3.2, a[2] - 0.2], a, 3.0, 2.7, 3.0, 2.7, ci(sp.boots), { part: 24 });

    // shoe
    const sx = a[0], sy = a[1] - 2.1, sz = a[2], big = i === 0 ? 1 : 0;
    const stC = tonesOf(shoeC, HD), light = lumi(shoeC) > 0.6, sole = light ? 0xc9c4b8 : mixc(shoeC, '#000000', 0.55);
    c.sweep([[sy, 2.1, 3.2, sx, sz + 1.7], [sy + 1.0, 2.6, 3.9, sx, sz + 1.7], [sy + 2.6, 2.4, 3.2, sx, sz + 1.2], [sy + 3.7, 2.3, 2.3, sx, sz + 0.2]],
      { col: shoeC, style: HD, part: 25 + i, deco: (mx, my, mz) => my < sy + 0.95 ? sole : (my > sy + 1.6 && mz > sz + 2.2 + 0.0 && my < sy + 2.5 && (Math.floor(mz * 2.5) & 1)) ? shade(shoeC, 1.35) : -1 });
  }

  // ----- skirt or robe
  if (isSkirt || isRobe) {
    const hem = isRobe ? 2.8 : Math.max(2.8, hipY - (B.len || 9) * 0.58), sway = pose === 1 || pose === 2 ? 0.45 : pose === 3 || pose === 4 ? -0.45 : 0, w0 = tw * 0.33, w1 = w0 + (isRobe ? 2.6 : 2.2 + (B.flare || 0)), bc = ci(B.col);
    c.sweep([[hem, w1, w1 * 0.8, 0, sway + 0.2], [hem + (hipY + 1 - hem) * 0.3, w0 + (w1 - w0) * 0.55, (w0 + (w1 - w0) * 0.55) * 0.78, 0, sway * 0.6 + 0.1], [hipY + 1, w0, w0 * 0.72, 0, 0]],
      { col: bc, part: 14, deco: (mx, my, mz) => { if (my < hem + 1.0) return shade(bc, 0.7); if (B.pattern === 'flower' && hs((mx * 1.2) | 0, (my * 1.2 + mz) | 0) < 0.22) return ci(B.col2 || '#f0eee8'); return ((Math.floor((mx + 30) * 1.7)) & 3) === 0 ? shade(bc, 0.9) : -1; } });
  }

  // ----- torso
  const hipW = tw * (fem ? 0.42 : 0.43), wstW = tw * (fem ? 0.28 : 0.31), chW = tw * (fem ? 0.31 : 0.355), shW = tw * (fem ? 0.33 : 0.37), dep = tw * (fem ? 0.22 : 0.25);
  const tcol = sp.vest && c.dir === 1 ? ci(sp.vest) : top, torsoOpt = { col: tcol, part: 15 };
  const hemY = sp.belt || isSkirt || isRobe ? hipY + 1 : hipY - D(sp.hem, 2.4);
  const bandolier = sp.bandolier ? ci(sp.bandolier) : -1, chain = sp.chain ? ci(sp.chain) : -1, tie = sp.tie ? ci(sp.tie) : -1, shirt = sp.shirt ? ci(sp.shirt) : -1, trim = sp.trim ? ci(sp.trim) : -1;
  const collarC = sp.collar ? ci(sp.collar) : -1, zip = sp.zip, apron = sp.apron ? ci(sp.apron) : -1, vest = sp.vest ? ci(sp.vest) : -1, belt = sp.belt ? ci(sp.belt) : -1, stain = sp.stain ? ci(sp.stain) : -1;
  const printC = sp.print ? ci(sp.print.col) : -1, tb = tonesOf(tcol, 0);
  const frontV = c.dir === 0;
  const torsoDeco = (mx, my, mz, dot) => {
    const y = my - hipY, xx = mx - 0, ax = xx < 0 ? -xx : xx, front = (c.dir === 0 && mz > 0) || (c.dir === 2 && mz > 1.5 && ax < 3);
    if (belt !== -1 && y < 1.8 && y > 0.2) return belt;
    if (c.dir === 0 || c.dir === 2) {
      if (mz > 0) {
        if (shirt !== -1 && vest === -1 && ax < 1.6 && my > shY - 2.0 && my < hipY + tor * 0.78) return shirt;       // shirt front showing between jacket edges
        if (shirt !== -1 && vest !== -1 && ax < tw * 0.2 && my > hipY + tor * 0.15) return shirt;
        if (tie !== -1 && ax < 0.75 && my < shY - 1.6 && my > hipY + 3.2) return tie;
        if (zip && ax < 0.28 && my < shY - 0.2 && my > hipY) return 0x1a1a1e;
        if (zip && ax > 3.4 && ax < 4.6 && y > 0.6 && y < 2.6 && ax > tw * 0.28 && c.dir === 0) return shade(tcol, 0.62);   // pockets
        if (chain !== -1 && ax < 2.2 && my < shY - 0.9 && my > shY - 0.9 - (2.2 - ax) * 1.4 - 0.2 && my > shY - 4.4 + ax * 0.0) return chain;
        if (sp.pocket && ax < 3.0 && y > 1.5 && y < 4.5 && c.dir === 0) return shade(tcol, 0.7);
      }
      if (bandolier !== -1) { const d = (xx * 0.9 + (my - (shY - 4.2)) * 0.62); if (Math.abs(d - 0.0) < 0.95 && mz > -1 && my < shY - 0.4 && my > hipY + 1) return bandolier; }
      if (trim !== -1 && mz > 0 && my > shY - 0.4 - 1.2 && ax < 2.9 && ax > 1.6 && c.dir === 0 && my > shY - 1.9 && my < shY - 0.3) return trim;
      if (printC !== -1 && sp.print && mz > 0 && my < shY - 2.2 && my > shY - 2.2 - sp.print.h && ax < sp.print.w / 2 && c.dir === 0) return printBand(sp.print, mx, my - (shY - 2.2 - sp.print.h), printC, tcol);
      if (stain !== -1 && mz > 0 && c.dir === 0 && hs((mx * 1.5) | 0, (my * 1.5) | 0) < 0.07 && my < shY - 3) return stain;
    } else if (printC !== -1 && sp.print && sp.print.back && my < shY - 2.2 && my > shY - 2.2 - sp.print.h && ax < sp.print.w / 2) return printBand(sp.print, mx, my - (shY - 2.2 - sp.print.h), printC, tcol);
    if (y < 0.6) return shade(tcol, 0.8);   // hem
    return -1;
  };
  const kn = [[hemY, hipW, dep * 0.9, 0, zl(hemY)], [hipY + tor * 0.38, wstW, dep * 0.82, 0, zl(hipY + tor * 0.38)], [hipY + tor * 0.78, chW, dep, 0, zl(hipY + tor * 0.78)], [shY - 0.3, shW, dep * 0.93, 0, zl(shY)], [shY + 0.75, shW * 0.6, dep * 0.7, 0, zl(shY + 0.5)]];
  c.sweep(kn, { ...torsoOpt, n: 4, deco: torsoDeco });
  // vest and apron as shells over the torso front/back
  if (vest !== -1 && sp.vestOver) c.sweep(kn.map(k => [k[0], k[1] + 0.25, k[2] + 0.25, k[3], k[4]]), { col: vest, part: 16, n: 4, deco: (mx, my, mz) => { if (c.dir !== 1 && Math.abs(mx) < 1.9 && mz > 0) return -2; if (c.dir === 1 && sp.patches && my > hipY + 3 && my < shY - 1 && hs(Math.floor(mx / 2.2) + 9, Math.floor((my - hipY) / 2.2) + 3) < 0.45 && Math.abs(mx) < chW - 1) return ci(['#b8382c', '#d9d4c6', '#6a7a98', '#c8a03a'][(Math.floor(mx / 2.2) * 7 + Math.floor((my - hipY) / 2.2) * 3 + 40) & 3]); return -1; } });
  if (apron !== -1) {
    const ya = hipY + tor * 0.74, yb = Math.max(3, hipY - 6 - (sp.apronLen || 0) * 0.3), ac = apron;
    c.sweep([[yb, hipW + 0.7, 0.8, 0, dep * 0.86 + 0.5 + zl(yb)], [ya, chW * 0.62 + 0.3, 0.8, 0, dep * 0.95 + 0.7 + zl(ya)], [ya + 0.8, chW * 0.45, 0.6, 0, dep * 0.95 + 0.7 + zl(ya)]], { col: ac, part: 17, n: 4, deco: (mx, my, mz) => (my < yb + 0.9 ? shade(ac, 0.8) : my > ya - 0.5 && Math.abs(mx) > chW * 0.28 ? -2 : (hs((mx * 1.3) | 0, (my * 1.3) | 0) < 0.04 ? shade(ac, 0.75) : -1)) });
    if (c.dir === 1) c.sweep([[ya + 0.2, chW * 0.8, 0.5, 0, -dep - 0.2], [ya + 0.9, chW * 0.8, 0.5, 0, -dep - 0.2]], { col: shade(ac, 0.85), part: 17 });   // the strap across the back
  }
  // neck, collar, scarf
  const neckY = shY + 0.5;
  c.sweep([[neckY - 0.5, 2.6, 2.4, 0, zl(neckY)], [neckY + 1.8, 2.4, 2.3, 0, zl(neckY + 1.8) + 0.2]], { col: skin, style: SK, part: 18, deco: (mx, my, mz, d) => (c.dir === 0 && sp.neckTattoo && Math.abs(mx) < 1.5 && my > neckY + 0.2 && ((my * 3 | 0) & 1) ? mixc(skin, sp.tattoo || '#3a4a5a', 0.85) : -1) });
  if (collarC !== -1) c.sweep([[neckY - 0.7, 2.7, 2.5, 0, zl(neckY)], [neckY + 0.7, 2.5, 2.3, 0, zl(neckY + 0.7)]], { col: collarC, part: 19, deco: (mx, my, mz) => (c.dir !== 1 && mz > 1.2 && Math.abs(mx) < 0.9 && my > neckY - 0.2 ? -2 : -1) });
  if (sp.hood) c.sweep([[neckY - 0.9, 3.6, 3.3, 0, zl(neckY) - 0.5], [neckY + 1.4, 3.2, 3.0, 0, zl(neckY + 1) - 0.8]], { col: top, part: 19 });
  if (sp.scarf) {
    const [s1, s2] = sp.scarf.map(ci);
    c.sweep([[neckY - 0.5, 3.0, 2.8, 0, zl(neckY)], [neckY + 1.5, 2.6, 2.5, 0, zl(neckY + 1)]], { col: s1, part: 19, deco: (mx, my) => ((Math.floor(my * 1.4) & 1) ? s2 : -1) });
    c.sweep([[hipY + tor * 0.45, 0.8, 0.45, 0.2, dep + 0.8 + zl(hipY + 8)], [shY - 0.3, 1.25, 0.5, 0.2, dep + 0.8 + zl(shY)]], { col: s1, part: 19, deco: (mx, my) => ((Math.floor(my * 1.4) & 1) ? s2 : -1) });
  }
  if (sp.headphones && 0) { /* below, with the head */ }

  // ----- arms
  const aw = tw * 0.36 + 1.7, sY = shY - 1.0, Lu = tor * 0.46, Lf = tor * 0.44;
  const armPose = (side) => {
    const near = side > 0, ap = near ? wp.al : wp.ar;
    let p1 = ap * AMP * 0 + ap, elb = run ? 85 : 30 + Math.abs(ap) * 0.55;
    if ((pose === 5 || pose === 7) && near) { p1 = 55; elb = 118; }                 // the drink: forearm raised to the mouth
    else if (pose === 6) { if (near) { p1 = sp.drink ? 28 : 18; elb = sp.drink ? 80 : 40; } else { p1 = 14; elb = 36; } }   // sitting: a drink held at the chest, or a hand on the knee
    else if (sp.hold && near) { p1 = 22; elb = 70; }
    if (sp.phoneUp && side < 0) { p1 = 50; elb = 105; }
    return [p1, elb];
  };
  const hands = [];
  for (const side of [-1, 1]) {
    const [p1, elb] = armPose(side), ab = 9, s0 = [side * aw, sY, zl(sY) + (c.dir === 2 ? 0 : 0)];
    const d1 = pitchDir(p1, side, ab), el = [s0[0] + d1[0] * Lu, s0[1] + d1[1] * Lu, s0[2] + d1[2] * Lu];
    const d2 = pitchDir(p1 + elb, side, ab * 0.5), wr = [el[0] + d2[0] * Lf, el[1] + d2[1] * Lf, el[2] + d2[2] * Lf];
    const sleeveEnd = sleeveLong ? 1.0 : 0.46, sc = ci(sp.sleeveCol || sp.top);
    const tattoo = sp.tattoo ? ci(sp.tattoo) : -1, braceletC = sp.bracelet;
    const sOpt = { part: side > 0 ? 30 : 32, deco: null };
    // upper arm: sleeve (or skin)
    limb(c, s0, el, 2.4, 2.15, 2.4, 2.15, sleeveEnd > 0.9 || true ? sc : skin, { part: sOpt.part, style: sp.sleeve === 'none' ? SK : 0, tattooSleeve: sp.sleeveTattoo && sp.sleeve === 'short' ? tattoo : -1, skinFrom: sp.sleeve === 'short' ? 0.5 : sp.sleeve === 'none' ? 0 : 1.1, skin, stripe: sp.sleeveStripe ? ci(sp.sleeveStripe) : -1, side, trimC: trim });
    // forearm
    limb(c, el, wr, 2.1, 1.8, 2.1, 1.8, sleeveLong && sp.sleeve !== 'none' ? sc : skin, { part: sOpt.part + 1, style: sleeveLong && sp.sleeve !== 'none' ? 0 : SK, skinFrom: sleeveLong ? 0.8 : 0, skin, tattooSleeve: tattoo !== -1 && sp.tattooForearm ? tattoo : -1, stripe: sp.sleeveStripe ? ci(sp.sleeveStripe) : -1, side, cuff: sleeveLong, braceletC });
    hands[side > 0 ? 0 : 1] = { wr, d: d2 };
    c.blob(wr[0], wr[1] - 1.1, wr[2] + 0.3, 2.0, 2.1, 1.9, { col: skin, style: SK, part: sOpt.part + 1 });
    if (sp.ring && side > 0) c.blob(wr[0], wr[1] - 2.0, wr[2] + 0.4, 2.0, 0.35, 1.95, { col: ci('#e8d48a'), style: HD, part: sOpt.part + 1 });
    // shoulder cap hides the seam
    c.blob(s0[0] * 0.97, sY - 0.1, s0[2], 2.35, 2.1, 2.35, { col: sleeveLong || sp.sleeve === 'short' ? sc : skin, style: sleeveLong || sp.sleeve === 'short' ? 0 : SK, part: sOpt.part });
  }
  // ----- carried things and extras
  carried(c, sp, hands, hipY, tor, pose, fem, run);
  // ----- head
  const headYr = neckY + 0.5 + hh * HK / 2, hzr = zl(headYr) + 0.4 + (stoop ? 1.0 : 0);
  c.ms = HK; const headY = headYr / HK, hz = hzr / HK, SH = S * HK;   // from here on everything is drawn in head units and scaled up
  const hk = headKnots(f, hh, 0).map(k => [k[0] + headY, k[1], k[2], k[3], k[4] + hz]);
  c.sweep(hk, { col: skin, style: SK, part: 40, bias: 0.22, deco: faceDeco(sp, f, headY, hz, SH, skin) });
  // ears
  const eaY = headY - 0.35, earW = f.earSize;
  for (const s of [-1, 1]) c.blob(s * (halfW(f, hh, -0.35) - 0.1 + 0.1), eaY, hz - 0.5, 0.4 + f.earOut * 0.35, 1.0 * earW, 0.8 * earW, { col: skin, style: SK, part: 41 });
  // nose: a wedge on the face
  const nz = hz - 0.45 + (halfW(f, hh, -1.3) * 1.08 + 0.45) - 0.3, nY = headY - 1.0 + f.noseY;
  c.blob(0, nY + 0.15, nz, 0.5 * f.noseW + 0.12, 0.8, 0.45 + f.noseLen * 0.5, { col: skin, style: SK, part: 42, bias: 0.04 });
  c.blob(0, nY - 0.35, nz + f.noseLen * 0.3, 0.62 * f.noseW + 0.1, 0.45, 0.45 + f.noseLen * 0.2, { col: skin, style: SK, part: 42 });
  // beard
  drawBeard(c, sp, f, headY, hz, hh, SH);
  // glasses
  if (sp.glasses) drawGlasses(c, sp, f, headY, hz, SH);
  drawHair(c, { ...sp, hhU: hh }, f, headY, hz, SH);
  drawHat(c, sp, f, headY, hz);
  if (sp.headphones) {
    const hp = ci(sp.headphones), hw2 = halfW(f, hh, 0) + 0.6;
    for (const s of [-1, 1]) c.blob(s * (hw2 + 0.3), headY - 0.2, hz - 0.5, 0.9, 2.0, 1.8, { col: hp, style: HD, part: 43 });
    c.sweep([[headY + hh / 2 + 0.3, hw2 + 0.1, 0.5, 0, hz - 0.5], [headY + 1.5, hw2 + 0.9, 0.5, 0, hz - 0.5]], { col: 0x1a1a1e, part: 43 });
  }
  if (sp.earring) for (const s of [-1, 1]) c.blob(s * (halfW(f, hh, -0.35) + 0.6), eaY - 1.3, hz - 0.3, 0.3, 0.7, 0.3, { col: ci('#d8d8e0'), style: HD, part: 44 });
  c.ms = 1;
}

function printBand(pr, mx, my, col, base) {   // a made-up chunky band logo: letters as blocks and a skull-ish blob, in pixel-hash noise
  const w = pr.w, u = (mx + w / 2) / w, v = my / pr.h;
  if (pr.kind === 'skull') { const dx = (mx) / (pr.w * 0.34), dy = (v - 0.62) / 0.3; if (dx * dx + dy * dy < 1) return ((Math.abs(dx) > 0.2 && Math.abs(dx) < 0.62 && Math.abs(dy + 0.1) < 0.28) || (Math.abs(dx) < 0.12 && dy > 0.1 && dy < 0.45)) ? base : col; if (v < 0.3 && Math.abs(mx) < pr.w * 0.3 && ((Math.floor(u * 9) & 1) === 0)) return col; return -1; }
  if (pr.kind === 'stripe') return v > 0.35 && v < 0.65 ? col : -1;
  // lettering: two lines of blocky glyphs
  const ln = v > 0.55 ? 0 : v < 0.45 ? 1 : -1; if (ln < 0) return -1; const g = Math.floor(u * (ln ? 9 : 6));
  return hs(g * 31 + ln * 7 + (pr.seed || 0), 5) < 0.72 && ((Math.floor(my * 3) % 3) !== 2 || hs(g, ln) < 0.5) ? col : -1;
}

// a limb from a to b: a vertical sweep when it is steep enough, a chain of blobs when it is not. opts: part, style, skinFrom (the arm part of the way from the top is skin), cuff, fold, tattooSleeve
function limb(c, a, b, ra0, ra1, rb0, rb1, col, o) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), dyv = a[1] - b[1];
  const skin = o.skin !== undefined ? ci(o.skin) : -1, base = ci(col), cutAt = o.cut ? o.cut.at : -1;
  // colour of the point at fraction t along the limb (0 top)
  const colAt = (t, mx, my, mz) => {
    if (o.cut && t > o.cut.at) return skin !== -1 ? skin : -1;
    if (o.skinFrom !== undefined && o.skinFrom <= 1.05 && t > o.skinFrom) {
      if (o.tattooSleeve > -1 && ((Math.floor(my * 2.4) + Math.floor(mz * 2.4 + mx * 2)) & 1) && hs(Math.floor(my * 3), Math.floor(mx * 3 + mz * 3)) < 0.8) return mixc(skin, o.tattooSleeve, 0.85);
      return skin;
    }
    if (o.tattooSleeve > -1 && o.skinFrom !== undefined && o.skinFrom < 0.9) return -1;
    if (o.cut && t > o.cut.at - 0.08) return shade(o.cut.col, 0.7);
    if (o.cuff && t > 0.88) return shade(base, 0.74);
    if (o.braceletC && t > 0.8) return ci(o.braceletC[Math.min(o.braceletC.length - 1, Math.floor((t - 0.8) / 0.2 * o.braceletC.length))]);
    if (o.stripe !== undefined && o.stripe !== -1) { const off = mx - (a[0] + (b[0] - a[0]) * t); if ((o.side > 0 ? off > 0.5 : off < -0.5)) return o.stripe; }
    if (o.ripped > -1 && t > 0.05 && t < 0.4 && mz > 0.8 && hs(Math.floor(mx * 2) + 5, Math.floor(my * 2.4)) < 0.45 && Math.abs(my - (a[1] + (b[1] - a[1]) * 0.18)) < 1.8) return o.ripped;
    if (o.fold && (Math.abs(t - 0.52) < 0.04 || Math.abs(t - 0.2) < 0.03)) return shade(base, 0.8);
    return -1;
  };
  const st = o.style || 0;
  if (o.cut) { /* shorts: the hem colour is the cut colour */ }
  if (dyv > len * 0.55) {
    const ra = (ra0 + rb0) / 2, rb = (ra1 + rb1) / 2, top = a[1], bot = b[1];
    const kn = [[top + 0.4, ra0 * 0.7, ra0 * 0.7, a[0], a[2]], [top - 0.5, ra0, ra0 * 0.96, a[0], a[2]], [bot, ra1, ra1 * 0.96, b[0], b[2]]];
    kn[0][3] = a[0] - (b[0] - a[0]) * 0.4 / Math.max(0.1, dyv); kn[0][4] = a[2] - (b[2] - a[2]) * 0.4 / Math.max(0.1, dyv);
    const ctr = o.cut ? o.cut.col : base;
    c.sweep(kn, { col: o.cut ? o.cut.col : base, style: o.cut ? 0 : st, part: o.part, deco: (mx, my, mz) => {
      const t = Math.max(0, Math.min(1, (top - my) / Math.max(0.01, dyv)));
      return colAt(t, mx, my, mz);
    } });
  } else {
    const n = Math.max(3, Math.ceil(len / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = ra0 + (ra1 - ra0) * t;
      c.blob(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r, r, r, { col: o.cut ? o.cut.col : base, style: o.cut ? 0 : st, part: o.part, deco: (mx, my, mz) => colAt(t, mx, my, mz) });
    }
  }
}

function drawBeard(c, sp, f, hy, hz, hh, S) {
  const b = f.beard; if (!b) return;
  const bc = ci(f.beardCol || sp.hair), fw = f.fw, mY = hy - 2.75 + f.mouthY, mw = f.mouthW / 2, o = { col: bc, style: HR, part: 45 };
  const prof = headKnots(f, hh, 0.32, -hh / 2 - 0.05, hy * 0 + 0.4).map(k => [k[0] + hy, k[1], k[2], k[3], k[4] + hz]);
  if (b === 'full' || b === 'goatee' || b === 'chinstrap') {
    c.sweep(prof, { ...o, deco: (mx, my, mz) => {
      const x = mx, y = my - hy, z = mz - hz, ax = x < 0 ? -x : x;
      if (z < -1.0) return -2;
      if (b === 'goatee' && !(ax < 1.5 && y < -2.1 && z > 0.5)) return -2;
      if (b === 'chinstrap' && !(y < -2.4 || (ax > fw * 0.8 && y < 0.2))) return -2;
      if (b === 'full') { const top = -1.0 - 0.7 * (1 - ax / fw) + (ax > fw * 0.8 ? 1.9 : 0); if (y > top) return -2; }
      if (z > 1.0 && ax < mw + 0.55 && y > mY - hy - 0.55 - f.lip * 0.5 && y < mY - hy + 0.5 + f.lip * 0.4) return -2;   // the mouth stays open
      if (hs(((mx + 30) * S) | 0, ((my + 30) * S) | 0) < 0.1) return shade(bc, 1.35);   // a few lighter hairs
      if (z > 1.0 && ax < mw + 0.5 && y > mY - hy + 0.3 && y < mY - hy + 1.0 && ax > 0.3) return -1;
      return -1;
    } });
  }
  if (b === 'moustache' || b === 'full' || b === 'goatee') c.blob(0, mY + 0.95, hz + halfW(f, hh, -2.0) * 1.08 + 0.1 - 0.15, Math.min(mw + 0.3, 1.9), 0.5, 0.65, { ...o, bias: -0.05 });
}

function drawGlasses(c, sp, f, hy, hz, S) {
  const g = sp.glasses, fr = ci(g.frame || '#18161a'), eg = f.eyeGap, ey = hy + f.eyeY - 0.35 + 0.05, m = 1 / S;
  const big = g.style === 'big', round = g.style === 'round', lw = (g.w || (big ? 1.75 : round ? 1.55 : 1.62)) * (0.9 + f.eyeSize * 0.1), lh = g.h || (big ? 1.7 : round ? 1.65 : 1.35), rim = Math.max((g.rim || 0.4) * 0.7, m * 1.05), n = round ? 2 : 4;
  const zf = hz - 0.45 + halfW(f, sp.hhU, f.eyeY - 0.35) * 1.08 + 0.45 + 0.35;
  const tort = g.tortoise, tcol = ci(g.tcol || '#9a5a24'), tdark = ci('#2a1a14');
  // the outline of a lens: an ellipse for round frames, a rectangle with rounded corners for the others
  const outline = x0 => { const k = [], N = round || big ? 12 : 8; for (let i = 0; i <= N; i++) { const t = -1 + 2 * i / N, e = round ? Math.sqrt(Math.max(0, 1 - t * t)) : big ? Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(t), 3))) : 1 - 0.3 * Math.pow(Math.max(0, (Math.abs(t) - 0.62) / 0.38), 2); k.push([ey + t * lh, Math.max(0.2, lw * e), 0.35, x0, zf]); } return k; };
  const ring = x0 => (mx, my) => {
    const u = (mx - x0) / (lw - rim), v = (my - ey) / (lh - rim), d = n === 2 ? u * u + v * v : Math.pow(Math.abs(u), 3) + Math.pow(Math.abs(v), 3);
    if (d < 1) return g.tint ? ci(g.tint) : -2;
    if (tort) return hs(Math.floor(mx * 1.6 + 40) * 3, Math.floor(my * 1.6 + 40) * 5 + (mx < x0 ? 1 : 0)) < 0.45 ? tdark : tcol;
    return -1;
  };
  for (const s of [-1, 1]) {
    c.sweep(outline(s * eg), { col: fr, style: HD, n: 2, part: 50 + (s > 0 ? 1 : 0), deco: ring(s * eg) });
    // temple arm from the outer edge back to the ear
    const ez = hz - 0.4, x0 = s * (eg + lw - 0.1);
    c.sweep([[ey + 0.55 + rim * 0.5, 0.28, (zf - ez) / 2, x0 + s * 0.15, (zf + ez) / 2], [ey + 0.55 - rim * 0.5, 0.28, (zf - ez) / 2, x0 + s * 0.15, (zf + ez) / 2]], { col: tort ? tcol : fr, style: HD, n: 4, part: 52, deco: undefined });
  }
  c.sweep([[ey + 0.75, eg - lw + 0.3, 0.3, 0, zf], [ey + 0.3, eg - lw + 0.3, 0.3, 0, zf]], { col: fr, style: HD, n: 4, part: 53 });
}

// ---------- the things people carry ----------
function carried(c, sp, hands, hipY, tor, pose, fem, run) {
  const hl = hands[0], hr = hands[1];
  const box = (x, y, z, w, h, d, col, o = {}) => c.sweep([[y - h / 2, w / 2, d / 2, x, z], [y + h / 2, w / 2, d / 2, x, z]], { col: ci(col), n: 4, part: 60, ...o });
  const hang = (kind, col, h) => {
    const [x, y, z] = h.wr, t = ci(col);
    if (kind === 'bag' || kind === 'tote') {
      const bh = kind === 'tote' ? 9 : 7, bw = kind === 'tote' ? 5 : 4.6;
      box(x, y - bh / 2 - 1.2, z + 0.4, bw, bh, 2.4, col, { deco: (mx, my) => (my > y - 2.2 ? shade(t, 0.7) : -1) });
      if (sp.produce || kind === 'tote') { c.blob(x - 0.8, y - 1.6, z + 0.4, 1.0, 1.2, 1.0, { col: 0x4f8f3a, part: 61 }); c.blob(x + 0.9, y - 1.4, z + 0.4, 1.0, 1.1, 1.0, { col: 0xe07a2a, part: 61 }); }
    } else if (kind === 'purse') box(x, y - 3.2, z + 0.5, 4.4, 3.6, 1.6, col, { deco: (mx, my) => (my > y - 2.0 ? shade(t, 0.75) : -1) });
    else if (kind === 'briefcase') box(x, y - 4.2, z + 0.6, 6.4, 5.4, 1.8, col, { style: HD, deco: (mx, my) => (Math.abs(my - (y - 3.0)) < 0.2 ? 0x2a2018 : -1) });
    else if (kind === 'helmet') c.blob(x, y - 3.0, z + 0.6, 2.6, 2.4, 2.8, { col: t, style: HD, part: 61 });
    else if (kind === 'bottle') { const hh2 = h; box(x, y + 0.6, z + 0.2, 1.3, 4.6, 1.3, col, { style: HD, n: 2, part: 61 }); box(x, y + 3.5, z + 0.2, 0.7, 2.2, 0.7, shade(t, 1.1), { style: HD, n: 2, part: 61 }); box(x, y + 0.2, z + 0.5, 1.4, 1.6, 1.4, '#ece6d6', { n: 2, part: 62 }); }
    else if (kind === 'glass') { box(x, y + 0.5, z + 0.2, 2.2, 3.6, 2.2, col, { n: 2, style: HD, part: 61 }); box(x, y + 2.5, z + 0.2, 2.3, 0.5, 2.3, '#f0ece4', { n: 2, part: 62 }); }
  };
  if (sp.bag) hang('bag', sp.bag, hl); if (sp.tote) hang('tote', sp.tote, hl); if (sp.purse) hang('purse', sp.purse, hl); if (sp.briefcase) hang('briefcase', sp.briefcase, hl);
  if (sp.bag2) hang('bag', sp.bag2, hr); if (sp.helmetHand) hang('helmet', sp.helmetHand, hl);
  if (sp.drink) {
    const raised = pose === 5 || pose === 6 || pose === 7, hnd = raised ? hl : hr, [x, y, z] = hnd.wr;
    if (raised) { const kind = sp.drink.type; if (kind === 'bottle') { box(x, y + 1.2, z + 0.9, 1.3, 4.2, 1.3, sp.drink.col, { style: HD, n: 2, part: 61 }); box(x, y + 3.5, z + 1.6, 0.7, 1.6, 0.7, shade(ci(sp.drink.col), 1.1), { style: HD, n: 2, part: 61 }); } else { box(x, y + 1.6, z + 0.8, 2.2, 3.6, 2.2, sp.drink.col, { n: 2, style: HD, part: 61 }); box(x, y + 3.5, z + 0.8, 2.3, 0.5, 2.3, '#f0ece4', { n: 2, part: 62 }); } }
    else hang(sp.drink.type, sp.drink.col, hnd);
  }
  if (sp.backpack) {
    const bw = 8, bh = 10; const zb = -(tor * 0.22) - 1.6;
    if (c.dir === 1 || c.dir === 2) box(0, hipY + tor * 0.55, zb - 0.5, bw, bh, 3.8, sp.backpack, { deco: (mx, my) => (my < hipY + tor * 0.55 - bh * 0.15 ? shade(ci(sp.backpack), 0.78) : -1) });
    else box(0, hipY + tor * 0.55, zb - 0.5, bw, bh, 3.8, sp.backpack, { part: 59 });
  }
  if (sp.phone && pose !== 5) { const [x, y, z] = hr.wr; box(x, y + 0.6, z + 0.6, 1.5, 2.2, 0.35, '#1a1a22', { part: 62 }); box(x, y + 0.6, z + 0.82, 1.2, 1.9, 0.1, sp.phone, { part: 63 }); }
}

// ---------- things that are not people: the dog on its lead, the wheelchair, the pram ----------
function drawDog(c, sp, pose) {
  const col = ci(sp.dog), dark = lumi(col) < 0.25, ear = dark ? shade(col, 1.6) : shade(col, 0.72), ph = pose === 1 ? 1 : pose === 3 ? -1 : 0, passing = pose === 2 || pose === 4;
  const z0 = 11.5, o = { col, part: 70, style: 0 };
  c.blob(0, 5.4, z0, 1.9, 2.1, 3.6, o);                                        // body
  c.blob(0, 6.9, z0 + 3.6, 1.35, 1.35, 1.6, { ...o, part: 71 });              // neck
  c.blob(0, 7.5, z0 + 5.0, 1.3, 1.25, 1.65, { ...o, part: 71 });              // head
  c.blob(0, 7.0, z0 + 6.6, 0.55, 0.5, 0.55, { col: 0x141214, style: 3, part: 72 });   // nose
  for (const s of [-1, 1]) c.blob(s * 1.35, 8.3, z0 + 4.4, 0.35, 0.9, 0.5, { col: ear, part: 72 });   // ears
  c.blob(0, 6.3, z0 - 3.9, 0.45, 1.5, 0.5, { ...o, part: 71 });              // tail
  for (const [lx, lz, d] of [[-1, 2.4, 1], [1, 2.4, -1], [-1, -2.4, -1], [1, -2.4, 1]]) {   // four legs, diagonal pairs swinging
    const sw = passing ? 0 : ph * d * 1.6, lift = passing && ((lx > 0) === (pose === 2)) ? 0.9 : 0;
    c.sweep([[0.4 + lift, 0.55, 0.55, lx * 1.1, z0 + lz + sw], [4.2, 0.75, 0.75, lx * 1.1, z0 + lz]], { col, part: 70 });
  }
}
function drawChair(c, sp, pose) {
  c.ms = 0.8;
  const empty = sp.chair === 'empty', dark = 0x2e2e34, frame = 0x4a4a52, cush = 0x2f3f6a, spin = pose === 0 ? 0 : (pose - 1) * 0.8;
  const hy = empty ? 8.5 : 12.5;
  for (const s of [-1, 1]) {
    const x = s * 5.2, R = 6.4, yc = R + 0.2;
    c.sweep([[yc - R, 0.55, 0.01 + 0.01, x, 0], [yc - R * 0.7, 0.55, R * 0.71, x, 0], [yc, 0.55, R, x, 0], [yc + R * 0.7, 0.55, R * 0.71, x, 0], [yc + R, 0.55, 0.01, x, 0]],
      { col: dark, style: HD, part: 80, deco: (mx, my, mz) => { const r = Math.hypot(my - yc, mz), a = Math.atan2(my - yc, mz) + spin; if (r < R - 0.9) return ((Math.floor(((a + 20) / (Math.PI / 4)) + 0.5) % 2) === 0 && r > 0.6 && Math.abs(Math.sin(a * 4)) > 0.9) ? 0x8a8a92 : -2; return -1; } });
    c.sweep([[hy - 2.2, 0.5, 5.2, s * 4.0, 0.2], [hy - 1.6, 0.5, 5.2, s * 4.0, 0.2]], { col: frame, style: HD, n: 4, part: 81 });   // the frame under the seat
    c.blob(s * 3.6, 2.0, 7.6, 0.7, 2.0, 0.7, { col: frame, part: 81 });   // the front caster
    c.blob(s * 2.8, 3.6, 6.8, 1.3, 0.3, 2.0, { col: frame, part: 81 });    // the footplate
  }
  c.sweep([[hy - 1.0, 4.2, 4.6, 0, 0.6], [hy - 0.1, 4.2, 4.6, 0, 0.6]], { col: cush, part: 82, n: 4 });   // the cushion
  c.sweep([[hy - 0.1, 4.2, 0.6, 0, -4.0], [hy + 8.0, 4.2, 0.6, 0, -4.2]], { col: cush, part: 82, n: 4 });   // the backrest
  for (const s of [-1, 1]) c.sweep([[hy + 7.4, 0.4, 1.4, s * 4.2, -5.4], [hy + 8.2, 0.4, 1.4, s * 4.2, -5.4]], { col: frame, part: 81 });
  c.ms = 1;
}
function drawStroller(c, sp) {
  const [c1, c2] = sp.stroller.map(ci), z0 = 9.5;
  c.sweep([[3.4, 4.0, 4.4, 0, z0], [7.2, 4.4, 5.2, 0, z0]], { col: c2, n: 4, part: 90 });
  c.blob(0, 8.6, z0 - 1.4, 3.8, 3.4, 3.4, { col: c1, part: 91 });                            // the hood
  c.sweep([[7.5, 0.4, 0.4, 0, z0 - 4.6], [11.2, 0.4, 0.4, 0, z0 - 6.5]], { col: 0x26262c, part: 92 });      // handle
  for (const s of [-1, 1]) c.blob(s * 3.9, 2.4, z0 + (c.dir === 2 ? 0 : 0), 0.7, 2.4, 2.4, { col: 0x1c1c20, style: HD, part: 92 });
}
export function drawEntry(c, sp, pose) {
  if (sp.pair) {
    const sw = p => (p === 1 ? 3 : p === 2 ? 4 : p === 3 ? 1 : p === 4 ? 2 : p);
    c.mox = -4.6; drawCharacter(c, sp.pair[0], pose); c.mox = 4.6; drawCharacter(c, sp.pair[1], sw(pose)); c.mox = 0; return;
  }
  if (sp.dog) drawDog(c, sp, pose);
  if (sp.chair !== 'empty') drawCharacter(c, sp, pose);
  if (sp.chair) drawChair(c, sp, pose);
  if (sp.stroller) drawStroller(c, sp);
}
