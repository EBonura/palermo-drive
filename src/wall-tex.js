// Textures of the baked walls (src/fences.js): one texture array with a layer per kind, drawn in code with a seeded generator (so every device gets the same pixels), and one shared material.
//
// Every layer is a 512 px square that stands for pw x ph real metres (`LAYER[k].pw/.ph`), and fences.js writes the uvs of the wall quads in those units (metres along the wall over pw,
// metres below the wall top over ph), so a stone is the size of a stone whatever the length of the wall; the array repeats natively, so there are no seams and the mip levels are right.
// The pixels are light, near neutral detail: the colour of a wall still comes from its vertex colour (per wall variation, the darker foot, the paler cap). A world space value noise in the
// shader breaks up the repeat. One material for every wall of every tile, and the flying chunks of a broken piece use the same one (instanced layer), so they show the same stone.
import * as THREE from 'three';
import { rng } from './core.js';

const S = 512;
// layer order is part of the contract with src/fences.js
export const LAYER = {
  w: { i: 0, pw: 4.0, ph: 3.0 },   // plaster with age stains: garden and parcel walls
  d: { i: 1, pw: 3.2, ph: 1.6 },   // dry-stone: stacked stones
  r: { i: 2, pw: 3.2, ph: 2.4 },   // retaining wall: rough rubble masonry in grey mortar
  c: { i: 3, pw: 3.6, ph: 2.7 },   // city wall: big tufa blocks
  j: { i: 4, pw: 3.0, ph: 1.5 },   // cast concrete, board marked, with panel seams
  h: { i: 5, pw: 2.4, ph: 2.4 },   // hedge: leafy clumps
  cap: { i: 6, pw: 2.0, ph: 2.0 }, // the top of a wall: coping stone
  x: { i: 7, pw: 4.0, ph: 3.0 },   // worn city wall: patched lime wash, torn posters and black-bordered notices, spray tags (long street walls, src/fence-walls.js)
  p: { i: 8, pw: 4.0, ph: 3.0 },   // hoarding: corrugated sheet on posts, rust, pasted bills, tags
};
const N_LAYERS = 9;

// run `fn(x, y)` for the element at (x, y) of size (w, h) and for its copies across the edges of the tile, so the texture repeats without a seam
function wrap(x, y, w, h, fn) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const X = x + dx * S, Y = y + dy * S;
    if (X > S || Y > S || X + w < 0 || Y + h < 0) continue;
    fn(X, Y);
  }
}
const speckles = (g, r, n, cols, a = 1) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = 1 + r() * 2; g.fillStyle = cols[i % cols.length]; wrap(r() * S, r() * S, s, s, (X, Y) => g.fillRect(X, Y, s, s)); } };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const jit = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));

// courses of stones: rows of height `rh` (metres, +-var), stones of width `sw` (+-var), colours from `pal`, joints in `joint`; `round` rounds the corners (px)
function courses(g, r, sx, sy, o) {
  g.fillStyle = o.joint; g.fillRect(0, 0, S, S);
  // row heights and stone widths are scaled to add up to exactly the tile, so the courses meet across the edges and the texture repeats without a seam
  const fit = (list) => { const t = list.reduce((a, v) => a + v, 0); return list.map(v => v * S / t); };
  const rows = []; let tot = 0; while (tot < S) { const v = o.rh * (1 + (r() - 0.5) * o.rv) * sy; rows.push(v); tot += v; }
  if (tot - S > rows[rows.length - 1] * 0.5) { rows.pop(); }
  let y = 0;
  for (const rh of fit(rows)) {
    const ws = []; let t = 0; while (t < S) { const v = o.sw * (1 + (r() - 0.5) * o.sv) * sx; ws.push(v); t += v; }
    if (t - S > ws[ws.length - 1] * 0.5) ws.pop();
    let x = 0;
    for (const sw of fit(ws)) {
      const k = 0.88 + r() * 0.24, c = jit(o.pal[(r() * o.pal.length) | 0], k), gap = o.gap;
      wrap(x, y, sw, rh, (X, Y) => {
        g.fillStyle = rgba(c, 1);
        g.beginPath(); if (g.roundRect) g.roundRect(X + gap, Y + gap, sw - 2 * gap, rh - 2 * gap, o.round); else g.rect(X + gap, Y + gap, sw - 2 * gap, rh - 2 * gap); g.fill();
        g.fillStyle = 'rgba(255,255,245,0.16)'; g.fillRect(X + gap + 1, Y + gap, sw - 2 * gap - 2, 2);          // the lit top edge
        g.fillStyle = 'rgba(30,24,16,0.20)'; g.fillRect(X + gap + 1, Y + rh - gap - 3, sw - 2 * gap - 2, 3);      // the shadow under it
        if (o.pits) for (let q = 0; q < o.pits; q++) { g.fillStyle = 'rgba(40,32,22,0.28)'; const px = X + gap + r() * (sw - 2 * gap), py = Y + gap + r() * (rh - 2 * gap), pr = 1 + r() * 2.2; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill(); }
      });
      x += sw;
    }
    y += rh;
  }
}

const PAINT = {
  w(g, r, sx, sy) {   // plaster: pale lime wash, soft mottling, rain streaks, damp, a patch where the plaster has fallen, hairline cracks
    g.fillStyle = '#ece6d7'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S, rx = 40 + r() * 90, ry = 30 + r() * 70, c = r() < 0.6 ? rgba([125, 104, 72], 0.015 + r() * 0.03) : rgba([255, 252, 240], 0.03 + r() * 0.05); wrap(x - rx, y - ry, 2 * rx, 2 * ry, (X, Y) => { g.fillStyle = c; g.beginPath(); g.ellipse(X + rx, Y + ry, rx, ry, r() * 3, 0, 7); g.fill(); }); }
    for (let i = 0; i < 44; i++) {   // rain streaks run down from a ledge or a crack
      const x = r() * S, y = r() * S * 0.55, len = (0.4 + r() * 1.4) * sy, w = (0.015 + r() * 0.05) * sx, a = 0.04 + r() * 0.09;
      wrap(x, y, w, len, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + len); gr.addColorStop(0, rgba([98, 82, 58], a)); gr.addColorStop(1, rgba([98, 82, 58], 0)); g.fillStyle = gr; g.fillRect(X, Y, w, len); });
    }
    for (let i = 0; i < 3; i++) {   // a patch where the plaster has come off: the stone under it
      const w = (0.25 + r() * 0.45) * sx, h = (0.2 + r() * 0.35) * sy, x = r() * S, y = r() * S;
      wrap(x, y, w, h, (X, Y) => {
        g.save(); g.beginPath(); g.moveTo(X, Y + h * 0.3); for (let q = 0; q <= 8; q++) g.lineTo(X + w * q / 8, Y + (q % 2 ? 0 : h * 0.12) + r() * h * 0.1); for (let q = 0; q <= 6; q++) g.lineTo(X + w - (q % 2 ? 0 : w * 0.06), Y + h * 0.3 + h * 0.7 * q / 6); for (let q = 8; q >= 0; q--) g.lineTo(X + w * q / 8, Y + h - (q % 2 ? 0 : h * 0.1)); g.closePath(); g.clip();
        g.fillStyle = '#a89d88'; g.fillRect(X, Y, w, h); const rr = rng(Math.floor(X * 7 + Y)); for (let q = 0; q < 16; q++) { g.fillStyle = rgba(jit([172, 160, 136], 0.8 + rr() * 0.4), 1); g.fillRect(X + rr() * w, Y + rr() * h, 0.1 * sx + rr() * 0.2 * sx, 0.07 * sy + rr() * 0.1 * sy); }
        g.restore(); g.strokeStyle = 'rgba(70,60,46,0.4)'; g.lineWidth = 1.5; g.stroke();
      });
    }
    g.strokeStyle = 'rgba(70,60,48,0.45)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 16; y += 6 + r() * 18; g.lineTo(x, y); } g.stroke(); }
    speckles(g, r, 5200, ['rgba(80,66,46,0.10)', 'rgba(255,255,248,0.10)', 'rgba(110,95,70,0.08)']);
  },
  d(g, r, sx, sy) {   // dry-stone: irregular stones stacked without mortar, dark gaps, a little moss
    courses(g, r, sx, sy, { joint: '#3d372e', rh: 0.27, rv: 0.85, sw: 0.62, sv: 1.1, gap: 3.5, round: 13, pits: 3, pal: [[170, 162, 142], [186, 176, 152], [150, 144, 128], [196, 184, 158], [160, 152, 134]] });
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, rr = 3 + r() * 9; wrap(x - rr, y - rr, 2 * rr, 2 * rr, (X, Y) => { g.fillStyle = rgba([86, 100, 56], 0.18 + r() * 0.2); g.beginPath(); g.ellipse(X, Y, rr, rr * 0.6, r() * 3, 0, 7); g.fill(); }); }
    speckles(g, r, 2500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.09)']);
  },
  r(g, r, sx, sy) {   // retaining wall: small rough rubble in pale grey mortar, darker at the damp foot of the tile
    courses(g, r, sx, sy, { joint: '#9a9484', rh: 0.17, rv: 0.6, sw: 0.3, sv: 0.8, gap: 2.4, round: 4, pits: 2, pal: [[142, 136, 122], [158, 150, 132], [126, 122, 110], [168, 158, 136], [136, 130, 118]] });
    for (let i = 0; i < 30; i++) { const x = r() * S, y = r() * S, w = (0.3 + r() * 0.9) * sx, a = 0.05 + r() * 0.1; wrap(x, y, w, S * 0.3, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + S * 0.3); gr.addColorStop(0, rgba([40, 36, 28], a)); gr.addColorStop(1, rgba([40, 36, 28], 0)); g.fillStyle = gr; g.fillRect(X, Y, w * 0.2, S * 0.3); }); }
    speckles(g, r, 3000, ['rgba(0,0,0,0.11)', 'rgba(255,255,255,0.08)']);
  },
  c(g, r, sx, sy) {   // city wall: big tufa blocks in running bond, honey colour, pitted, the odd repaired block
    courses(g, r, sx, sy, { joint: '#8d7b55', rh: 0.675, rv: 0.04, sw: 1.2, sv: 0.12, gap: 3.5, round: 5, pits: 22, pal: [[236, 220, 176], [226, 208, 162], [242, 228, 186], [218, 198, 152], [230, 214, 168]] });
    for (let i = 0; i < 26; i++) { const x = r() * S, w = (0.02 + r() * 0.05) * sx, len = (0.6 + r() * 1.4) * sy, y = r() * S; wrap(x, y, w, len, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + len); gr.addColorStop(0, 'rgba(70,56,34,0.16)'); gr.addColorStop(1, 'rgba(70,56,34,0)'); g.fillStyle = gr; g.fillRect(X, Y, w, len); }); }
    speckles(g, r, 4000, ['rgba(0,0,0,0.10)', 'rgba(255,250,230,0.10)']);
  },
  j(g, r, sx, sy) {   // cast concrete: board marks, panel seams every 1.5 m, tie holes, stains
    g.fillStyle = '#c4c1b6'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 0.15 * sy) { g.fillStyle = `rgba(${r() < 0.5 ? '60,58,52' : '255,255,250'},${0.03 + r() * 0.05})`; g.fillRect(0, y, S, 0.15 * sy * (0.4 + r() * 0.5)); }
    for (let x = 0; x < S; x += 1.5 * sx) { g.fillStyle = 'rgba(40,38,34,0.38)'; g.fillRect(x, 0, 2.5, S); g.fillStyle = 'rgba(255,255,250,0.2)'; g.fillRect(x + 2.5, 0, 1.5, S); }
    for (let x = 0.75 * sx; x < S; x += 1.5 * sx) for (const yy of [0.35, 1.1]) { g.fillStyle = 'rgba(40,38,34,0.5)'; g.beginPath(); g.arc(x, yy * sy, 3.2, 0, 7); g.fill(); g.fillStyle = 'rgba(120,70,40,0.25)'; g.fillRect(x - 1, yy * sy + 2, 2, 0.2 * sy); }
    for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S * 0.7, len = (0.2 + r() * 0.7) * sy, w = (0.02 + r() * 0.05) * sx, a = 0.04 + r() * 0.09; wrap(x, y, w, len, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + len); gr.addColorStop(0, rgba([60, 56, 48], a)); gr.addColorStop(1, rgba([60, 56, 48], 0)); g.fillStyle = gr; g.fillRect(X, Y, w, len); }); }
    speckles(g, r, 6000, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.10)']);
  },
  h(g, r, sx, sy) {   // clipped hedge: dense small leaves in clumps, dark between the clumps; near neutral so the vertex green colours it
    g.fillStyle = '#6c7a58'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, rr = 24 + r() * 46; wrap(x - rr, y - rr, 2 * rr, 2 * rr, (X, Y) => { g.fillStyle = rgba([r() < 0.5 ? 54 : 90, r() < 0.5 ? 66 : 100, 44], 0.35); g.beginPath(); g.ellipse(X, Y, rr, rr * 0.8, r() * 3, 0, 7); g.fill(); }); }
    const tones = [[196, 210, 170], [172, 190, 146], [214, 226, 188], [150, 170, 126], [228, 236, 200], [120, 140, 100]];
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S, w = 7 + r() * 11, h = 4 + r() * 6, a = r() * 6.28, c = jit(tones[(r() * tones.length) | 0], 0.9 + r() * 0.2);
      wrap(x - w, y - w, 2 * w, 2 * w, (X, Y) => { g.save(); g.translate(X, Y); g.rotate(a); g.fillStyle = rgba(c, 0.95); g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(20,28,12,0.28)'; g.fillRect(-w * 0.6, -0.5, w * 1.2, 1); g.restore(); });
    }
    for (let i = 0; i < 160; i++) { const x = r() * S, y = r() * S, rr = 4 + r() * 10; wrap(x - rr, y - rr, 2 * rr, 2 * rr, (X, Y) => { g.fillStyle = 'rgba(22,34,14,0.38)'; g.beginPath(); g.ellipse(X, Y, rr, rr * 0.6, r() * 3, 0, 7); g.fill(); }); }
  },
  x(g, r, sx, sy) {   // a worn street wall: the lime wash gone patchy, repairs in other washes, a band of torn posters and death notices at hand height, spray tags
    g.fillStyle = '#e6dfcf'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, rx = 30 + r() * 80, ry = 24 + r() * 60, c = r() < 0.6 ? rgba([125, 104, 72], 0.02 + r() * 0.04) : rgba([255, 252, 240], 0.03 + r() * 0.05); wrap(x - rx, y - ry, 2 * rx, 2 * ry, (X, Y) => { g.fillStyle = c; g.beginPath(); g.ellipse(X + rx, Y + ry, rx, ry, r() * 3, 0, 7); g.fill(); }); }
    const tones = [[212, 198, 168], [198, 198, 188], [226, 204, 194], [200, 184, 158], [188, 178, 160], [222, 214, 190]];
    for (let i = 0; i < 7; i++) {   // repair patches: ragged rectangles of a slightly different wash, a darker edge
      const w = (0.4 + r() * 1.1) * sx, h = (0.3 + r() * 0.8) * sy, x = r() * S, y = r() * S, c = tones[(r() * tones.length) | 0];
      wrap(x, y, w, h, (X, Y) => { g.beginPath(); g.moveTo(X, Y); for (let q = 1; q <= 6; q++) g.lineTo(X + w * q / 6, Y + (r() - 0.5) * 5); for (let q = 1; q <= 5; q++) g.lineTo(X + w + (r() - 0.5) * 5, Y + h * q / 5); for (let q = 5; q >= 0; q--) g.lineTo(X + w * q / 6, Y + h + (r() - 0.5) * 5); for (let q = 4; q >= 1; q--) g.lineTo(X + (r() - 0.5) * 5, Y + h * q / 5); g.closePath(); g.fillStyle = rgba(c, 0.85); g.fill(); g.strokeStyle = 'rgba(80,66,48,0.35)'; g.lineWidth = 1.2; g.stroke(); });
    }
    for (let i = 0; i < 34; i++) {   // rain streaks
      const x = r() * S, y = r() * S * 0.55, len = (0.4 + r() * 1.4) * sy, w = (0.015 + r() * 0.05) * sx, a = 0.05 + r() * 0.1;
      wrap(x, y, w, len, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + len); gr.addColorStop(0, rgba([98, 82, 58], a)); gr.addColorStop(1, rgba([98, 82, 58], 0)); g.fillStyle = gr; g.fillRect(X, Y, w, len); });
    }
    // posters: pasted over one another along a band 0.5 to 1.5 m below the top; an off-white bill, a yellow one, a red one, a blue one, and the black-bordered death notice
    const pal = [[238, 236, 226], [232, 206, 90], [208, 74, 64], [112, 150, 204], [240, 168, 90], [244, 244, 238], [226, 226, 220], [238, 236, 226]];
    let px = r() * 0.3 * sx;
    while (px < S - 0.2 * sx) {
      const pw = (0.45 + r() * 0.5) * sx, ph = (0.6 + r() * 0.6) * sy, py = (0.4 + r() * 0.45) * sy, notice = r() < 0.22, c = notice ? [244, 244, 238] : pal[(r() * pal.length) | 0];
      wrap(px, py, pw, ph, (X, Y) => {
        g.fillStyle = 'rgba(40,34,26,0.25)'; g.fillRect(X + 2, Y + 2, pw, ph);   // its shadow
        g.fillStyle = rgba(c, 1); g.fillRect(X, Y, pw, ph);
        if (notice) { g.strokeStyle = '#1c1b1a'; g.lineWidth = 3; g.strokeRect(X + 3, Y + 3, pw - 6, ph - 6); g.fillStyle = '#1c1b1a'; g.fillRect(X + pw * 0.38, Y + ph * 0.12, pw * 0.24, ph * 0.1); }   // the cross
        else { g.fillStyle = rgba(jit(c, 0.62), 0.9); g.fillRect(X + pw * 0.08, Y + ph * 0.08, pw * 0.84, ph * (0.18 + r() * 0.2)); }   // the headline
        for (let q = 0; q < 6; q++) { g.fillStyle = 'rgba(30,28,26,0.55)'; g.fillRect(X + pw * 0.1, Y + ph * (0.5 + q * 0.07), pw * (0.4 + r() * 0.45), 1.6); }   // lines of print
        if (r() < 0.7) { g.fillStyle = rgba([232, 224, 206], 1); g.beginPath(); const t = (0.15 + r() * 0.3) * Math.min(pw, ph); const c0 = r() < 0.5; g.moveTo(X + (c0 ? 0 : pw), Y + ph); g.lineTo(X + (c0 ? t : pw - t), Y + ph); g.lineTo(X + (c0 ? 0 : pw), Y + ph - t); g.fill(); }   // a torn corner, the wall showing
        g.strokeStyle = 'rgba(30,26,20,0.35)'; g.lineWidth = 1; g.strokeRect(X, Y, pw, ph);
      });
      px += pw * (r() < 0.4 ? 0.75 : 1.0) + (0.05 + r() * 0.9) * sx;
    }
    for (let i = 0; i < 4; i++) {   // spray tags: a loose scrawl and a stroke, low on the wall
      let x = r() * S, y = (1.1 + r() * 1.5) * sy; const col = ['rgba(20,20,22,0.85)', 'rgba(30,60,140,0.8)', 'rgba(170,30,30,0.8)', 'rgba(20,20,22,0.85)'][i];
      g.strokeStyle = col; g.lineWidth = 3 + r() * 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { x += (r() - 0.35) * 26; y += (r() - 0.5) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    g.lineCap = 'butt';
    speckles(g, r, 5000, ['rgba(80,66,46,0.10)', 'rgba(255,255,248,0.10)', 'rgba(110,95,70,0.08)']);
  },
  p(g, r, sx, sy) {   // hoarding: corrugated sheets (2 m wide) on dark posts, bolts and rust runs, a grid of pasted bills, a tag, dirt at the foot; near neutral so the vertex colour is the paint
    g.fillStyle = '#c8c6c0'; g.fillRect(0, 0, S, S);
    const rib = 0.1 * sx;
    for (let x = 0; x < S; x += rib) { g.fillStyle = 'rgba(255,255,250,0.18)'; g.fillRect(x, 0, rib * 0.35, S); g.fillStyle = 'rgba(30,28,24,0.2)'; g.fillRect(x + rib * 0.55, 0, rib * 0.4, S); }
    for (let i = 0; i < 30; i++) { const x = r() * S, y = r() * S, rx = 20 + r() * 70, ry = 20 + r() * 60; wrap(x - rx, y - ry, 2 * rx, 2 * ry, (X, Y) => { g.fillStyle = r() < 0.5 ? rgba([40, 34, 26], 0.05 + r() * 0.06) : rgba([255, 255, 248], 0.05 + r() * 0.06); g.beginPath(); g.ellipse(X + rx, Y + ry, rx, ry, r() * 3, 0, 7); g.fill(); }); }
    for (let x = 0; x < S; x += 2.0 * sx) {   // the posts every 2 m, the bolts down them
      g.fillStyle = 'rgba(36,34,30,0.8)'; g.fillRect(x - 0.05 * sx, 0, 0.1 * sx, S);
      for (const yy of [0.2, 1.0, 1.8, 2.6]) { g.fillStyle = 'rgba(20,18,16,0.7)'; g.beginPath(); g.arc(x + 0.12 * sx, yy * sy, 2.6, 0, 7); g.fill(); const gr = g.createLinearGradient(0, yy * sy, 0, yy * sy + 0.5 * sy); gr.addColorStop(0, 'rgba(140,70,30,0.45)'); gr.addColorStop(1, 'rgba(140,70,30,0)'); g.fillStyle = gr; g.fillRect(x + 0.1 * sx, yy * sy, 4, 0.5 * sy); }
    }
    for (let i = 0; i < 18; i++) { const x = r() * S, y = r() * S * 0.6, len = (0.3 + r() * 1.2) * sy, w = (0.02 + r() * 0.06) * sx; wrap(x, y, w, len, (X, Y) => { const gr = g.createLinearGradient(0, Y, 0, Y + len); gr.addColorStop(0, 'rgba(130,66,32,0.4)'); gr.addColorStop(1, 'rgba(130,66,32,0)'); g.fillStyle = gr; g.fillRect(X, Y, w, len); }); }
    // a run of identical pasted bills along one sheet, hand high, with a gap where one was torn off
    const bx = (r() < 0.5 ? 0.15 : 2.15) * sx, bw = 0.42 * sx, bh = 0.62 * sy, col = [[238, 234, 222], [238, 234, 222], [236, 224, 176], [228, 196, 184], [204, 216, 226]][(r() * 5) | 0];   // paper, not paint
    for (let k = 0; k < 4; k++) {
      if (k === 2 && r() < 0.6) continue;
      const X = bx + k * (bw + 0.02 * sx), Y = 0.9 * sy;
      g.fillStyle = rgba(col, 1); g.fillRect(X, Y, bw, bh); g.fillStyle = rgba(jit(col, 0.8), 0.9); g.fillRect(X + 3, Y + 3, bw - 6, bh * 0.3);
      for (let q = 0; q < 5; q++) { g.fillStyle = 'rgba(30,28,26,0.5)'; g.fillRect(X + 5, Y + bh * (0.45 + q * 0.09), bw * (0.4 + r() * 0.45), 1.5); }
      g.strokeStyle = 'rgba(30,26,20,0.35)'; g.strokeRect(X, Y, bw, bh);
    }
    let x = r() * S, y = (1.9 + r() * 0.8) * sy; g.strokeStyle = 'rgba(20,20,22,0.8)'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.3) * 24; y += (r() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke(); g.lineCap = 'butt';
    const gr = g.createLinearGradient(0, S * 0.8, 0, S); gr.addColorStop(0, 'rgba(60,50,38,0)'); gr.addColorStop(1, 'rgba(60,50,38,0.3)'); g.fillStyle = gr; g.fillRect(0, S * 0.8, S, S * 0.2);
    speckles(g, r, 4000, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.10)']);
  },
  cap(g, r, sx, sy) {   // coping: pale slabs with fine joints and a little weathering
    g.fillStyle = '#d9d3c4'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 1.0 * sy) for (let x = ((y / sy) % 2) * 0.5 * sx; x < S + sx; x += 1.0 * sx) { const k = 0.92 + r() * 0.14; g.fillStyle = `rgba(${Math.round(222 * k)},${Math.round(216 * k)},${Math.round(200 * k)},1)`; g.fillRect(x + 1, y + 1, 1.0 * sx - 2, 1.0 * sy - 2); }
    speckles(g, r, 3500, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.10)']);
  },
};

function pixels(kind, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }), L = LAYER[kind];
  PAINT[kind](g, rng(seed), S / L.pw, S / L.ph);
  return g.getImageData(0, 0, S, S).data;
}

const GLSL = `
float wtH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float wtN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( wtH( i ), wtH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( wtH( i + vec2( 0.0, 1.0 ) ), wtH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }`;

let MAT = null, TEX = null, DATA = null, DONE = 0;
const KINDS = Object.keys(LAYER);
// the layers are painted one per call, so the first tile with walls can spread the work (a generator step between layers) instead of stalling a frame for all seven
export function* wallTextureSteps() {
  if (TEX) return;
  if (!DATA) DATA = new Uint8Array(S * S * 4 * N_LAYERS);
  while (DONE < KINDS.length) { const k = KINDS[DONE]; DATA.set(pixels(k, 4100 + DONE * 37), LAYER[k].i * S * S * 4); DONE++; yield; }
}
export function wallTexture() {
  if (TEX) return TEX;
  for (const _ of wallTextureSteps()) { /* paint whatever is left, now */ }
  TEX = new THREE.DataArrayTexture(DATA, S, S, N_LAYERS);
  TEX.format = THREE.RGBAFormat; TEX.type = THREE.UnsignedByteType;
  TEX.wrapS = TEX.wrapT = THREE.RepeatWrapping; TEX.minFilter = THREE.LinearMipmapLinearFilter; TEX.magFilter = THREE.LinearFilter; TEX.generateMipmaps = true;
  TEX.anisotropy = 4; TEX.colorSpace = THREE.SRGBColorSpace; TEX.needsUpdate = true;
  return TEX;
}
// the one material of every wall mesh and of the flying chunks: attributes aUv (metres over the layer's size) and aLayer (the layer index)
export function wallMaterial() {
  if (MAT) return MAT;
  const tex = wallTexture();
  MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  MAT.onBeforeCompile = (sh) => {
    sh.uniforms.wallTex = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aUv; attribute float aLayer; varying vec2 vWUv; varying float vWL; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWUv = aUv; vWL = aLayer; vWP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform highp sampler2DArray wallTex; varying vec2 vWUv; varying float vWL; varying vec3 vWP;' + GLSL)
      .replace('#include <map_fragment>', `vec4 wtc = texture( wallTex, vec3( vWUv, floor( vWL + 0.5 ) ) );
        float wtm = 0.88 + 0.26 * wtN( vWP.xz * 0.11 + vWP.y * 0.05 ) * ( 0.6 + 0.4 * wtN( vWP.xz * 0.9 + 3.7 ) );   // two octaves of world value noise: patches of cleaner and dirtier wall
        diffuseColor.rgb *= wtc.rgb * wtm;`);
  };
  MAT.customProgramCacheKey = () => 'wall-array-v1';
  return MAT;
}
