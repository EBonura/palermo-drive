// Buildings: facade styles, ground floors, balconies, cornices, rooftops. Owned by the facades/buildings work.
//
// One 2D-array texture holds every facade/roof tile (painted procedurally below). Walls are emitted as
// a few tiled strips per wall (ground-floor runs, piano nobile, repeated upper floors), so the tile
// repeats with RepeatWrapping. Geometry is merged per 400 m chunk into one opaque mesh plus one
// alpha-tested mesh (balcony railings).
import * as THREE from 'three';
import { D, HAS_NEAR, groundY, proj, pairs, signedArea, rng, inPoly } from './core.js';
import SPECS from '../assets/facades/specs.js';

const T = 256;

// =====================================================================================
// Tile painting
// =====================================================================================
const LAYERS = [], LID = {};
function layer(name, fn) { LID[name] = LAYERS.length; LAYERS.push({ name, fn }); }

const SH = { g: ['#4c5c51', '#36443b'], b: ['#3c2724', '#2a1a17'], t: ['#547174', '#3f5759'], k: ['#2f3a35', '#222b27'] };

function wrapped(x, y, rad, fn) {
  for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) {
    const X = x + dx, Y = y + dy;
    if (X + rad > 0 && X - rad < T && Y + rad > 0 && Y - rad < T) fn(X, Y);
  }
}
function peel(g, r, cx, cy, s) {
  g.save(); g.beginPath();
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283, rr = s * (.45 + r() * .75), x = cx + Math.cos(a) * rr * 1.3, y = cy + Math.sin(a) * rr * .8;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath(); g.fillStyle = '#cdb68e'; g.fill();
  g.shadowColor = 'rgba(40,30,20,.5)'; g.shadowBlur = 4; g.strokeStyle = 'rgba(70,52,34,.4)'; g.lineWidth = 1; g.stroke(); g.shadowBlur = 0; g.clip();
  // exposed ashlar underneath
  for (let y = cy - s; y < cy + s; y += 9) { g.fillStyle = 'rgba(80,58,34,.35)'; g.fillRect(cx - s * 2, y, s * 4, 1.5); const off = (((y - cy) / 9) | 0) % 2 * 9; for (let x = cx - s * 2 + off; x < cx + s * 2; x += 18) g.fillRect(x, y, 1.5, 9); }
  for (let i = 0; i < 12; i++) { g.fillStyle = r() < .5 ? 'rgba(140,108,70,.3)' : 'rgba(226,208,168,.35)'; g.fillRect(cx + (r() - .5) * s * 2.8, cy + (r() - .5) * s * 1.8, 5 + r() * 12, 4 + r() * 6); }
  g.restore();
}
function streak(g, x, y0, len, w, a = .13) {
  const gr = g.createLinearGradient(0, y0, 0, y0 + len);
  gr.addColorStop(0, `rgba(45,38,30,${a})`); gr.addColorStop(1, 'rgba(45,38,30,0)');
  g.fillStyle = gr; g.fillRect(x - w / 2, y0, w, len);
}
// Smooth, seamlessly tiling blotches: a tiny random grid tiled 3x3 and bilinearly upscaled.
function softNoise(g, r, cells, rgb, amax, sy = 1) {
  const n = cells, sm = document.createElement('canvas'); sm.width = n * 3; sm.height = Math.max(1, Math.round(n * sy)) * 3;
  const sg = sm.getContext('2d'), rows = sm.height / 3;
  for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) {
    sg.fillStyle = `rgba(${rgb},${r() * amax})`;
    for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) sg.fillRect(i + tx * n, j + ty * rows, 1, 1);
  }
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(sm, 0, 0, sm.width, sm.height, -T, -T, 3 * T, 3 * T); g.restore();
}
function plaster(g, r, base = '#e7e1d3', o = {}) {
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  softNoise(g, r, 5, '120,92,58', .2); softNoise(g, r, 9, '255,250,236', .22); softNoise(g, r, 14, '90,70,45', .12);
  softNoise(g, r, 3, '70,60,50', .16, 2.4); // vertical grime bands
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(90,70,50,.10)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * T, r() * T, 1 + r() * 1.6, 1 + r() * 1.6); }
  const np = o.peel === undefined ? (r() < .38 ? 1 : 0) : o.peel;
  for (let i = 0; i < np; i++) { const s = 10 + r() * 16; peel(g, r, 1.7 * s + r() * (T - 3.4 * s), 1.7 * s + r() * (T - 3.4 * s), s); }
}
function dado(g, h = 30, a = .3) {
  const gr = g.createLinearGradient(0, T - h, 0, T); gr.addColorStop(0, 'rgba(60,48,36,0)'); gr.addColorStop(1, `rgba(60,48,36,${a})`);
  g.fillStyle = gr; g.fillRect(0, T - h, T, h);
}
function leaf(g, x, y, w, h, c) {
  g.fillStyle = c[0]; g.fillRect(x, y, w, h);
  g.fillStyle = c[1]; for (let yy = y + 5; yy < y + h - 3; yy += 6) g.fillRect(x + 3, yy, w - 6, 2.5);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h); g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2);
}
function ped(g, x, yb, w, type, col = '#f2ecdd') {
  g.fillStyle = col; g.strokeStyle = 'rgba(60,45,30,.5)'; g.lineWidth = 1.5; g.beginPath();
  if (type === 'tri') { g.moveTo(x - 9, yb); g.lineTo(x + w / 2, yb - 28); g.lineTo(x + w + 9, yb); }
  else { g.moveTo(x - 9, yb); g.quadraticCurveTo(x + w / 2, yb - 44, x + w + 9, yb); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(70,55,40,.35)'; g.beginPath();
  if (type === 'tri') { g.moveTo(x + 4, yb - 4); g.lineTo(x + w / 2, yb - 19); g.lineTo(x + w - 4, yb - 4); }
  else { g.moveTo(x + 4, yb - 4); g.quadraticCurveTo(x + w / 2, yb - 30, x + w - 4, yb - 4); }
  g.closePath(); g.fill();
}
function win(g, x, y, w, h, o = {}) {
  const fr = o.fr ?? 7;
  g.fillStyle = 'rgba(40,30,20,.35)'; g.fillRect(x - fr + 3, y - fr + 3, w + 2 * fr, h + 2 * fr);
  g.fillStyle = o.frc || '#f8f4ea'; g.fillRect(x - fr, y - fr, w + 2 * fr, h + 2 * fr);
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, o.lit ? '#d8b878' : '#46525e'); gr.addColorStop(1, o.lit ? '#9a7a48' : '#1c2228');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(190,210,230,.16)'; g.beginPath(); g.moveTo(x, y + h * .5); g.lineTo(x + w * .6, y); g.lineTo(x + w, y); g.lineTo(x, y + h * .85); g.fill();
  g.fillStyle = '#e6e0d2'; g.fillRect(x + w / 2 - 1.5, y, 3, h); if (h > 90) g.fillRect(x, y + h * .35, w, 2.5);
  if (o.curtain) { g.fillStyle = 'rgba(240,235,220,.6)'; g.fillRect(x, y, w * .45, h * .8); }
  if (o.sill !== false) {
    g.fillStyle = '#f2ecdf'; g.fillRect(x - fr - 6, y + h + fr, w + 2 * fr + 12, 6);
    g.fillStyle = 'rgba(30,20,10,.35)'; g.fillRect(x - fr - 6, y + h + fr + 6, w + 2 * fr + 12, 3);
  }
  if (o.sh) {
    const c = SH[o.sh], st = o.st || 'open', lw = w / 2 + .5;
    if (st === 'closed') { leaf(g, x, y, lw, h, c); leaf(g, x + w - lw, y, lw, h, c); }
    else if (st === 'half') { leaf(g, x, y, lw, h, c); leaf(g, x + w + fr, y, lw, h, c); }
    else { leaf(g, x - fr - lw, y, lw, h, c); leaf(g, x + w + fr, y, lw, h, c); }
  }
}
function ashlar(g, r, x0, y0, x1, y1, base, rowH = 32, bw = 64, dark = .26) {
  g.fillStyle = base; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  let row = 0;
  for (let y = y0; y < y1; y += rowH, row++) {
    const h = Math.min(rowH, y1 - y);
    for (let x = x0 - (row % 2) * bw / 2; x < x1; x += bw) {
      const xa = Math.max(x0, x), xb = Math.min(x1, x + bw);
      if (xb <= xa) continue;
      g.fillStyle = r() < .5 ? `rgba(255,245,220,${r() * .08})` : `rgba(90,65,35,${r() * .1})`; g.fillRect(xa, y, xb - xa, h);
      g.fillStyle = `rgba(70,50,30,${dark + .06})`; g.fillRect(xa, y, 3, h);
    }
    g.fillStyle = `rgba(70,50,30,${dark})`; g.fillRect(x0, y, x1 - x0, 2);
  }
}
function pilaster(g, x, w, base = '#f1ebdb') {
  g.fillStyle = base; g.fillRect(x, 0, w, T);
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(80,60,40,.25)'); gr.addColorStop(.25, 'rgba(0,0,0,0)'); gr.addColorStop(.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,45,30,.3)');
  g.fillStyle = gr; g.fillRect(x, 0, w, T);
}
function band(g, y, h, col = '#f4eee0') {
  g.fillStyle = col; g.fillRect(0, y, T, h); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, y + h, T, 3);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y, T, 1.5);
}
function sign(g, r, x, y, w, h) {
  const cols = ['#27384f', '#5a1f26', '#1f4a36', '#2d2d2f', '#6b5524', '#3b2a4d'];
  g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, w, 3);
  g.fillStyle = r() < .5 ? '#e9e0c0' : '#e8b83a';
  let xx = x + 10 + r() * 14;
  while (xx < x + w - 16) { const lw = 5 + r() * 12; g.fillRect(xx, y + h * .3, lw, h * .4); xx += lw + 4 + r() * 4; }
}
function rollShutter(g, r, x, y, w, h, col = '#6c6c6a') {
  g.fillStyle = col; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,.28)'; for (let yy = y + 3; yy < y + h; yy += 5) g.fillRect(x, yy, w, 2);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let yy = y + 5; yy < y + h; yy += 5) g.fillRect(x, yy, w, 1);
  for (let i = 0; i < 5; i++) streak(g, x + r() * w, y + r() * h * .4, h * .5, 6 + r() * 12, .2);
  if (r() < .6) { g.fillStyle = `rgba(${(r() * 200) | 0},${(r() * 200) | 0},${(r() * 200) | 0},.45)`; for (let i = 0; i < 4; i++) g.fillRect(x + r() * (w - 40), y + h * (.3 + r() * .5), 14 + r() * 30, 3 + r() * 4); }
  g.fillStyle = '#4b4b49'; g.fillRect(x, y + h - 5, w, 5);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
}

// ---- generic
layer('blank', (g, r) => { plaster(g, r, '#e7e1d3'); for (let i = 0; i < 3; i++) streak(g, 30 + r() * 190, r() * 80, 100 + r() * 100, 6 + r() * 10, .09); });
layer('blank_g', (g, r) => { plaster(g, r, '#e2dccd', { peel: 1 }); dado(g, 60, .4); });
layer('cornice', (g, r) => {
  g.fillStyle = '#efe8d6'; g.fillRect(0, 0, T, T);
  let gr = g.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(60,45,30,.3)'); g.fillStyle = gr; g.fillRect(0, 0, T, 70);
  for (let x = 6; x < T; x += 32) { g.fillStyle = '#e4dcc6'; g.fillRect(x, 78, 20, 56); g.fillStyle = 'rgba(40,30,20,.45)'; g.fillRect(x + 20, 78, 12, 56); }
  gr = g.createLinearGradient(0, 138, 0, T); gr.addColorStop(0, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(50,38,26,.35)'); g.fillStyle = gr; g.fillRect(0, 138, T, T - 138);
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(90,70,50,.1)'; g.fillRect(r() * T, r() * T, 2, 2); }
});
layer('terrace_b', (g, r) => { // bitumen membrane
  g.fillStyle = '#8c8984'; g.fillRect(0, 0, T, T);
  softNoise(g, r, 6, '200,200,196', .3); softNoise(g, r, 8, '40,38,36', .25); softNoise(g, r, 16, '60,58,56', .15);
  g.fillStyle = 'rgba(30,30,30,.25)'; for (let x = 0; x < T; x += 64) g.fillRect(x, 0, 2, T);
  for (let i = 0; i < 1200; i++) { g.fillStyle = r() < .5 ? 'rgba(30,30,30,.15)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * T, r() * T, 1.5, 1.5); }
});
layer('terrace_c', (g, r) => { // cotto / cement tiles
  g.fillStyle = '#b4745a'; g.fillRect(0, 0, T, T);
  for (let y = 0; y < T; y += 32) for (let x = 0; x < T; x += 32) { g.fillStyle = `rgba(${r() < .5 ? '255,220,190' : '60,30,20'},${r() * .12})`; g.fillRect(x, y, 32, 32); }
  g.fillStyle = 'rgba(60,40,30,.5)'; for (let i = 0; i < T; i += 32) { g.fillRect(i, 0, 1.5, T); g.fillRect(0, i, T, 1.5); }
  softNoise(g, r, 8, '230,220,200', .2); softNoise(g, r, 10, '50,30,20', .15);
});
layer('terrace', (g, r) => {
  g.fillStyle = '#d3ccbf'; g.fillRect(0, 0, T, T);
  softNoise(g, r, 6, '255,252,244', .25); softNoise(g, r, 8, '80,70,60', .2); softNoise(g, r, 16, '90,80,70', .1);
  for (let i = 0; i < 1500; i++) { g.fillStyle = r() < .5 ? 'rgba(70,60,50,.1)' : 'rgba(255,255,255,.14)'; g.fillRect(r() * T, r() * T, 1.5, 1.5); }
  g.strokeStyle = 'rgba(60,55,50,.3)'; g.lineWidth = 1.5; g.strokeRect(0, 0, T, T); g.beginPath(); g.moveTo(T / 2, 0); g.lineTo(T / 2, T); g.moveTo(0, T / 2); g.lineTo(T, T / 2); g.stroke();
  g.strokeStyle = 'rgba(50,45,40,.45)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); let x = r() * T, y = r() * T; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 30; y += (r() - .3) * 20; g.lineTo(x, y); } g.stroke(); }
});
function tilesPaint(g, r, base) {
  g.fillStyle = '#6b3b2a'; g.fillRect(0, 0, T, T);
  const rowH = 21, cw = 32;
  for (let row = 0, y = 0; y < T + rowH; y += rowH, row++) {
    for (let x = -(row % 2) * cw / 2; x < T + cw; x += cw) {
      const k = r(), c = k < .12 ? '#8a6a52' : k < .2 ? '#9c4f33' : base[(r() * base.length) | 0];
      g.fillStyle = c; g.fillRect(x + 1, y + 1, cw - 2, rowH - 1);
      g.fillStyle = 'rgba(255,230,200,.16)'; g.fillRect(x + 1, y + 1, cw - 2, 3);
      g.fillStyle = 'rgba(30,10,0,.32)'; g.fillRect(x + 1, y + rowH - 4, cw - 2, 4);
      g.fillStyle = 'rgba(30,10,0,.18)'; g.fillRect(x + cw / 2 - 1, y + 4, 2, rowH - 8);
    }
  }
  for (let i = 0; i < 6; i++) streak(g, r() * T, r() * T, 70, 14, .15);
}
layer('tiles', (g, r) => tilesPaint(g, r, ['#b5623f', '#c06c45', '#a95a3a', '#b9663f', '#c4784f']));
layer('tiles_grey', (g, r) => tilesPaint(g, r, ['#7d7f80', '#85878a', '#74777a', '#8a8b88']));
layer('rail_a', g => { // plain iron verticals on a transparent tile
  g.clearRect(0, 0, T, T); g.fillStyle = '#26262c';
  g.fillRect(0, 22, T, 9); g.fillRect(0, T - 20, T, 9); g.fillRect(0, 70, T, 4);
  for (let x = 16; x < T; x += 32) { g.fillRect(x - 3, 22, 6, T - 20); g.beginPath(); g.moveTo(x - 5, 22); g.lineTo(x, 8); g.lineTo(x + 5, 22); g.fill(); }
});
layer('rail_b', g => { // bellied / scrolled wrought iron
  g.clearRect(0, 0, T, T); g.fillStyle = '#26262c'; g.strokeStyle = '#26262c'; g.lineWidth = 5;
  g.fillRect(0, 14, T, 10); g.fillRect(0, T - 22, T, 10);
  for (let x = 0; x < T; x += 64) {
    g.lineWidth = 6; g.beginPath(); g.moveTo(x + 4, 24); g.lineTo(x + 4, T - 22); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x + 4, 40); g.bezierCurveTo(x + 62, 30, x + 62, 110, x + 32, 130); g.bezierCurveTo(x + 4, 150, x + 2, 200, x + 30, 215); g.stroke();
    g.beginPath(); g.arc(x + 32, 132, 16, 0, 6.3); g.stroke();
    g.beginPath(); g.arc(x + 32, 132, 5, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(x + 64 + 4, 40); g.bezierCurveTo(x + 6, 30, x + 6, 110, x + 36, 130); g.stroke();
  }
});

// ---- ground floors (one bay each; the tile is the real ground-floor height)
layer('g_arch', (g, r) => {
  plaster(g, r, '#e0d8c4', { peel: 0 });
  ashlar(g, r, 0, 0, 52, T, '#f0e8d4', 30, 52); ashlar(g, r, 204, 0, T, T, '#f0e8d4', 30, 52);
  g.fillStyle = '#d8cdb2'; g.beginPath(); g.moveTo(40, T); g.lineTo(40, 104); g.arc(128, 104, 88, Math.PI, 0); g.lineTo(216, T); g.fill(); // voussoir ring
  const gr = g.createLinearGradient(0, 40, 0, T); gr.addColorStop(0, '#15110e'); gr.addColorStop(1, '#3a2f26');
  g.fillStyle = gr; g.beginPath(); g.moveTo(58, T); g.lineTo(58, 108); g.arc(128, 108, 70, Math.PI, 0); g.lineTo(198, T); g.fill();
  g.fillStyle = 'rgba(190,170,130,.5)'; g.fillRect(100, 190, 56, 66); // courtyard daylight far inside
  g.fillStyle = '#f4ecd8'; g.fillRect(112, 20, 32, 30); g.fillStyle = 'rgba(60,45,30,.4)'; g.fillRect(112, 20, 2, 30); g.fillRect(142, 20, 2, 30); // keystone
  g.fillStyle = '#b9ae98'; g.fillRect(40, T - 8, 176, 8);
  dado(g, 40, .35);
});
layer('g_shop_s', (g, r) => {
  plaster(g, r, '#e2dccd', { peel: r() < .4 ? 1 : 0 });
  g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T);
  sign(g, r, 24, 24, 208, 40);
  g.fillStyle = '#d9d2c0'; g.fillRect(20, 66, 216, 4);
  rollShutter(g, r, 26, 70, 204, 170);
  g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16);
  dado(g, 30, .3);
});
layer('g_shop_o', (g, r) => {
  plaster(g, r, '#e2dccd', { peel: 0 });
  g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  sign(g, r, 22, 20, 212, 36);
  const col = r() < .5 ? ['#b8322e', '#f2eee4'] : ['#2f5f9a', '#f2eee4']; // striped awning
  for (let i = 0; i < 12; i++) { g.fillStyle = col[i % 2]; g.fillRect(22 + i * 17.7, 58, 17.7, 26); g.beginPath(); g.arc(22 + i * 17.7 + 8.85, 84, 8.85, 0, Math.PI); g.fill(); }
  const gr = g.createLinearGradient(0, 96, 0, 240); gr.addColorStop(0, '#e8c88a'); gr.addColorStop(1, '#8a6a3c');
  g.fillStyle = '#3a342c'; g.fillRect(22, 96, 212, 144); g.fillStyle = gr; g.fillRect(28, 100, 200, 136);
  g.fillStyle = 'rgba(40,25,10,.55)'; for (let i = 0; i < 4; i++) g.fillRect(36 + i * 48, 130 + r() * 30, 36, 60 + r() * 30);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(28, 100, 60, 136);
  g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16); dado(g, 30, .3);
});
layer('g_door', (g, r) => {
  plaster(g, r, '#e2dccd', { peel: 1 });
  g.fillStyle = '#f4eedd'; g.fillRect(78, 54, 100, T - 54); ped(g, 78, 54, 100, 'tri');
  g.fillStyle = '#3d2c22'; g.fillRect(90, 70, 76, T - 70);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(96, 78, 28, 80); g.fillRect(132, 78, 28, 80); g.fillRect(96, 168, 28, 70); g.fillRect(132, 168, 28, 70);
  g.fillStyle = '#c9a24a'; g.fillRect(124, 160, 8, 5); g.fillStyle = '#111'; g.fillRect(100, 62, 56, 6);
  g.fillStyle = '#b9ae98'; g.fillRect(70, T - 12, 116, 12);
  win(g, 20, 108, 36, 70, { fr: 4, sill: false }); g.strokeStyle = '#222'; g.lineWidth = 3; for (let x = 28; x < 56; x += 9) { g.beginPath(); g.moveTo(x, 108); g.lineTo(x, 178); g.stroke(); }
  dado(g, 40, .35);
});
layer('g_door2', (g, r) => {
  plaster(g, r, '#e0d9c8', { peel: 1 });
  g.fillStyle = '#d4cab4'; g.fillRect(82, 70, 92, T - 70);
  g.fillStyle = r() < .5 ? '#3f5a4a' : '#5a3b2a'; g.fillRect(90, 78, 76, T - 78);
  g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = 90; y < T - 20; y += 26) g.fillRect(96, y, 64, 3);
  g.fillStyle = '#d8d0b8'; g.fillRect(150, 150, 6, 6);
  g.fillStyle = '#efe9d3'; g.fillRect(100, 40, 56, 22); g.fillStyle = '#222'; g.fillRect(104, 46, 48, 10);
  win(g, 190, 100, 40, 66, { sh: 'g', st: 'closed', fr: 4, sill: true });
  dado(g, 50, .45);
});
layer('g_garage', (g, r) => {
  plaster(g, r, '#e0d9c8', { peel: 0 });
  g.fillStyle = '#ebe4d2'; g.fillRect(16, 60, 224, T - 60);
  rollShutter(g, r, 26, 70, 204, 186, r() < .5 ? '#6a5a4a' : '#6c6c6a');
  g.fillStyle = '#2a2a2a'; g.fillRect(26, 62, 204, 8);
  dado(g, 30, .35);
});
layer('g_win', (g, r) => {
  plaster(g, r, '#dfd8c6', { peel: 1 });
  win(g, 84, 92, 88, 96, { sh: r() < .5 ? 'g' : 'b', st: 'half', fr: 8 });
  g.strokeStyle = '#1e1e22'; g.lineWidth = 3.5; for (let x = 92; x < 170; x += 14) { g.beginPath(); g.moveTo(x, 92); g.lineTo(x, 188); g.stroke(); }
  g.beginPath(); g.moveTo(84, 140); g.lineTo(172, 140); g.stroke();
  dado(g, 70, .45);
});
layer('pw_shop', (g, r) => {
  plaster(g, r, '#e6e1d6', { peel: 0 });
  g.fillStyle = '#cfcabd'; g.fillRect(0, 0, T, 64);
  sign(g, r, 18, 24, 220, 30);
  g.fillStyle = '#9aa0a4'; g.fillRect(10, 70, 236, 174);
  const gr = g.createLinearGradient(0, 78, 0, 238); gr.addColorStop(0, '#6a7d8c'); gr.addColorStop(1, '#2c3238'); g.fillStyle = gr; g.fillRect(16, 76, 224, 162);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(16, 200); g.lineTo(110, 76); g.lineTo(160, 76); g.lineTo(16, 238); g.fill();
  g.fillStyle = '#9aa0a4'; g.fillRect(126, 76, 4, 162); g.fillRect(16, 120, 224, 3);
  g.fillStyle = 'rgba(255,230,160,.5)'; g.fillRect(150, 140, 70, 60);
  dado(g, 24, .25);
});

// ---- upper floors: baroque palazzo
function barUp(g, r, sh) {
  plaster(g, r, '#e6dcc6');
  pilaster(g, 0, 20); pilaster(g, T - 20, 20);
  band(g, T - 8, 5, '#f1ead8');
  win(g, 88, 44, 80, 150, { sh, st: r() < .6 ? 'closed' : 'half', fr: 8 });
  g.fillStyle = '#f4eedd'; g.fillRect(118, 28, 20, 18); g.fillStyle = 'rgba(60,45,30,.4)'; g.fillRect(118, 28, 2, 18);
  streak(g, 100, 214, 36, 9); streak(g, 158, 214, 40, 8); streak(g, 60, 0, 50, 14, .16); streak(g, 196, 0, 44, 10, .14);
}
layer('bar_up_g', (g, r) => barUp(g, r, 'g'));
layer('bar_up_b', (g, r) => barUp(g, r, 'b'));
function barNob(g, r, type) {
  plaster(g, r, '#e6dcc6');
  pilaster(g, 0, 20); pilaster(g, T - 20, 20);
  band(g, T - 8, 5, '#f1ead8');
  ped(g, 74, 52, 108, type);
  win(g, 74, 58, 108, 188, { sh: 'g', st: 'open', fr: 9, sill: false, curtain: r() < .3 });
  g.fillStyle = '#d8cfba'; g.fillRect(56, 246, 144, 10); // balcony slab edge painted for far views
  streak(g, 90, 8, 40, 9); streak(g, 168, 8, 30, 8);
}
layer('bar_nob_tri', (g, r) => barNob(g, r, 'tri'));
layer('bar_nob_seg', (g, r) => barNob(g, r, 'seg'));

// ---- 19th century palazzo
function n19Up(g, r, sh) {
  plaster(g, r, '#e5dfd0');
  band(g, T - 9, 6, '#f2ecdd');
  win(g, 90, 34, 76, 190, { sh, st: ['closed', 'half', 'open'][(r() * 3) | 0], fr: 7, sill: false });
  g.fillStyle = '#f2ecdd'; g.fillRect(78, 22, 100, 8); // flat lintel
  streak(g, 100, 226, 30, 8); streak(g, 156, 226, 30, 8); streak(g, 40, 0, 56, 12, .16); streak(g, 210, 0, 40, 9, .14);
}
layer('n19_up_g', (g, r) => n19Up(g, r, 'g'));
layer('n19_up_b', (g, r) => n19Up(g, r, 'b'));
layer('n19_up_t', (g, r) => n19Up(g, r, 't'));
layer('n19_nob', (g, r) => {
  plaster(g, r, '#e5dfd0');
  band(g, T - 9, 6, '#f2ecdd');
  ped(g, 82, 52, 92, 'seg');
  win(g, 82, 58, 92, 190, { sh: 'b', st: 'open', fr: 8, sill: false });
  streak(g, 90, 6, 34, 9);
});

// ---- plain residential
layer('res_a', (g, r) => { plaster(g, r, '#e7e0d0', { peel: 1 }); win(g, 98, 56, 60, 112, { sh: 'g', st: 'closed', fr: 4, frc: '#d9d0bc' }); streak(g, 110, 190, 50, 10); });
layer('res_b', (g, r) => { plaster(g, r, '#e7e0d0', { peel: 1 }); win(g, 98, 56, 60, 112, { sh: 'b', st: 'open', fr: 4, frc: '#d9d0bc' }); streak(g, 150, 190, 60, 10); });
layer('res_c', (g, r) => { // laundry
  plaster(g, r, '#e5dfcf', { peel: 1 }); win(g, 98, 70, 60, 112, { sh: 'g', st: 'open', fr: 4, frc: '#d9d0bc' });
  g.strokeStyle = '#555'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 30); g.lineTo(248, 38); g.stroke();
  const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2', '#6aa05a'];
  for (let i = 0; i < 6; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(18 + i * 38, 32 + i * 1.3, 18 + r() * 10, 26 + r() * 20); }
});
layer('res_d', (g, r) => { // roller blind + AC unit
  plaster(g, r, '#e7e0d0', { peel: 1 }); win(g, 98, 60, 60, 106, { fr: 4, frc: '#d9d0bc' });
  g.fillStyle = '#d4d0c4'; g.fillRect(94, 56, 68, 64); g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 60; y < 118; y += 5) g.fillRect(94, y, 68, 2);
  g.fillStyle = '#eceae4'; g.fillRect(176, 150, 46, 26); g.fillStyle = '#777'; g.fillRect(180, 160, 38, 3); g.fillRect(180, 166, 38, 3);
});
layer('res_e', (g, r) => { // painted balcony
  plaster(g, r, '#e7e0d0', { peel: 1 }); win(g, 94, 40, 68, 150, { sh: 'g', st: 'open', fr: 5, frc: '#d9d0bc', sill: false });
  g.fillStyle = '#cfc6b2'; g.fillRect(52, 186, 152, 12); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(52, 198, 152, 5);
  g.fillStyle = '#26262c'; g.fillRect(56, 146, 144, 4); for (let x = 60; x < 200; x += 10) g.fillRect(x, 146, 3, 40);
  g.fillStyle = '#4f7a3a'; g.beginPath(); g.arc(78, 138, 12, 0, 6.3); g.arc(176, 134, 10, 0, 6.3); g.fill();
});

// ---- post-war concrete block
layer('pw_a', (g, r) => {
  plaster(g, r, '#e4e0d6', { peel: 0 });
  g.fillStyle = '#d6d2c6'; g.fillRect(0, 200, T, 56); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 200, T, 4);
  g.fillStyle = '#c9c5b8'; g.fillRect(44, 46, 168, 24); g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 48; y < 68; y += 4) g.fillRect(44, y, 168, 1.5);
  g.fillStyle = '#9ca3a8'; g.fillRect(44, 70, 168, 96);
  const gr = g.createLinearGradient(0, 74, 0, 160); gr.addColorStop(0, '#5f6e7a'); gr.addColorStop(1, '#2a3036'); g.fillStyle = gr; g.fillRect(49, 74, 158, 88);
  g.fillStyle = '#9ca3a8'; g.fillRect(126, 74, 4, 88);
  g.fillStyle = '#e8e6df'; g.fillRect(180, 176, 40, 20); g.fillStyle = '#888'; g.fillRect(184, 184, 32, 2);
  streak(g, 128, 168, 70, 80, .07);
});
layer('pw_b', (g, r) => {
  plaster(g, r, '#e4e0d6', { peel: 0 });
  g.fillStyle = '#f0ede4'; g.fillRect(0, 150, T, 96); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 246, T, 10); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 150, T, 3);
  g.fillStyle = '#b8b4a8'; g.fillRect(0, 150, T, 6);
  win(g, 70, 36, 116, 100, { fr: 5, frc: '#c9c5b8', sill: false });
  g.fillStyle = '#bdb9ac'; g.fillRect(64, 28, 128, 20); g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 30; y < 46; y += 4) g.fillRect(64, y, 128, 1.5);
  streak(g, 40, 246, 10, 40, .0);
});

// ---- church / civic stone
layer('ch_low', (g, r) => { ashlar(g, r, 0, 0, T, T, '#e6e1d3', 36, 72); dado(g, 50, .35); for (let i = 0; i < 4; i++) streak(g, r() * T, r() * 60, 120, 10, .12); });
layer('ch_door', (g, r) => {
  ashlar(g, r, 0, 0, T, T, '#e6e1d3', 36, 72);
  g.fillStyle = '#f2e9d0'; g.beginPath(); g.moveTo(60, T); g.lineTo(60, 120); g.quadraticCurveTo(128, 0, 196, 120); g.lineTo(196, T); g.fill();
  g.fillStyle = '#3a2a1e'; g.beginPath(); g.moveTo(76, T); g.lineTo(76, 126); g.quadraticCurveTo(128, 30, 180, 126); g.lineTo(180, T); g.fill();
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(126, 90, 4, T - 90);
  g.fillStyle = '#b9ae98'; g.fillRect(56, T - 10, 144, 10); dado(g, 40, .3);
});
layer('ch_mid', (g, r) => {
  ashlar(g, r, 0, 0, T, T, '#e6e1d3', 36, 72);
  g.fillStyle = '#d8cba8'; g.beginPath(); g.moveTo(52, T); g.lineTo(52, 90); g.quadraticCurveTo(128, -20, 204, 90); g.lineTo(204, T); g.fill();
  g.fillStyle = '#e9dec3'; g.beginPath(); g.moveTo(62, T); g.lineTo(62, 94); g.quadraticCurveTo(128, -2, 194, 94); g.lineTo(194, T); g.fill();
  g.fillStyle = '#1d2227'; g.beginPath(); g.moveTo(112, 190); g.lineTo(112, 100); g.quadraticCurveTo(128, 60, 144, 100); g.lineTo(144, 190); g.fill();
  g.fillStyle = '#c9bd9c'; g.fillRect(104, 190, 48, 6);
  for (let i = 0; i < 3; i++) streak(g, 60 + r() * 140, 100 + r() * 60, 100, 10, .14);
});
layer('ch_top', (g, r) => {
  ashlar(g, r, 0, 0, T, T, '#e6e1d3', 36, 72);
  for (const x of [64, 192]) { g.fillStyle = '#d4c7a2'; g.beginPath(); g.moveTo(x - 24, 150); g.lineTo(x - 24, 90); g.arc(x, 90, 24, Math.PI, 0); g.lineTo(x + 24, 150); g.fill(); g.fillStyle = '#20262c'; g.beginPath(); g.moveTo(x - 16, 150); g.lineTo(x - 16, 92); g.arc(x, 92, 16, Math.PI, 0); g.lineTo(x + 16, 150); g.fill(); }
  band(g, T - 18, 10, '#f3ead2');
});


// ---- stone (exposed tufa) upper floors, arched / pedimented windows, rusticated ground floor
function stoneUp(g, r, sh, kind) {
  ashlar(g, r, 0, 0, T, T, '#e6e2d6', 32, 64, .22);
  band(g, T - 8, 5, '#efe6cf');
  if (kind === 'arch') {
    g.fillStyle = '#f2ead4'; g.beginPath(); g.moveTo(74, 214); g.lineTo(74, 80); g.arc(128, 80, 54, Math.PI, 0); g.lineTo(182, 214); g.fill();
    g.fillStyle = '#242a31'; g.beginPath(); g.moveTo(84, 214); g.lineTo(84, 82); g.arc(128, 82, 44, Math.PI, 0); g.lineTo(172, 214); g.fill();
    g.fillStyle = '#d9d0bc'; g.fillRect(124, 40, 8, 8); g.fillStyle = '#c9bfa8'; g.fillRect(68, 214, 120, 7);
    if (sh) { leaf(g, 48, 90, 24, 124, SH[sh]); leaf(g, 184, 90, 24, 124, SH[sh]); }
  } else win(g, 88, 44, 80, 150, { sh, st: 'half', fr: 9, frc: '#efe6cf' });
  streak(g, 100, 214, 36, 9); streak(g, 60, 0, 50, 14, .16);
}
layer('st_up_g', (g, r) => stoneUp(g, r, 'g', 'rect'));
layer('st_up_b', (g, r) => stoneUp(g, r, 'b', 'rect'));
layer('st_arch_up', (g, r) => stoneUp(g, r, null, 'arch'));
function archUp(g, r, sh) {
  plaster(g, r, '#e5dfd0'); band(g, T - 9, 6, '#f2ecdd');
  g.fillStyle = '#f6f1e4'; g.beginPath(); g.moveTo(80, 220); g.lineTo(80, 84); g.arc(128, 84, 48, Math.PI, 0); g.lineTo(176, 220); g.fill();
  g.fillStyle = '#2a3038'; g.beginPath(); g.moveTo(90, 220); g.lineTo(90, 86); g.arc(128, 86, 38, Math.PI, 0); g.lineTo(166, 220); g.fill();
  g.fillStyle = '#e6e0d2'; g.fillRect(126, 48, 4, 172); g.fillRect(90, 130, 76, 3);
  leaf(g, 54, 84, 24, 136, SH[sh]); leaf(g, 178, 84, 24, 136, SH[sh]);
  streak(g, 100, 226, 28, 8); streak(g, 44, 0, 50, 12, .15);
}
layer('arch_up_g', (g, r) => archUp(g, r, 'g'));
layer('arch_up_b', (g, r) => archUp(g, r, 'b'));
layer('ped_up', (g, r) => {
  plaster(g, r, '#e5dfd0'); band(g, T - 9, 6, '#f2ecdd');
  ped(g, 82, 60, 92, r() < .5 ? 'tri' : 'seg');
  win(g, 82, 64, 92, 150, { sh: 'b', st: 'open', fr: 8, sill: true });
  streak(g, 90, 8, 34, 9);
});
layer('g_rust_win', (g, r) => {
  ashlar(g, r, 0, 0, T, T, '#e0dcd0', 36, 72, .3);
  win(g, 90, 92, 76, 84, { fr: 9, frc: '#d8cdb0', sill: false });
  g.strokeStyle = '#1e1e22'; g.lineWidth = 3.5; for (let x = 98; x < 166; x += 13) { g.beginPath(); g.moveTo(x, 92); g.lineTo(x, 176); g.stroke(); }
  dado(g, 50, .4);
});

// Build the 2D-array texture once (a generator that yields per layer, so the world streamer can warm it up in slices).
function* buildAtlasIter() {
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(T * T * 4 * LAYERS.length);
  const sheet = /[?&]atlas=1/.test(location.search) ? document.createElement('canvas') : null; // debug contact sheet
  if (sheet) { sheet.width = 8 * 160; sheet.height = Math.ceil(LAYERS.length / 8) * 160; sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#7a8a9a'; document.body.appendChild(sheet); }
  for (let i = 0; i < LAYERS.length; i++) {
    const L = LAYERS[i];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, T, T);
    L.fn(g, rng(9100 + i * 131));
    if (sheet) sheet.getContext('2d').drawImage(cv, (i % 8) * 160, ((i / 8) | 0) * 160, 160, 160);
    const px = g.getImageData(0, 0, T, T).data;
    for (let y = 0; y < T; y++) data.set(px.subarray(y * T * 4, (y + 1) * T * 4), (i * T + (T - 1 - y)) * T * 4); // flip: v = 1 is the top
    yield;
  }
  const tex = new THREE.DataArrayTexture(data, T, T, LAYERS.length);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function atlasMaterial(tex, cutout, photo) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, side: cutout ? THREE.DoubleSide : THREE.FrontSide, alphaTest: cutout ? 0.45 : 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTex = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying float vLayer;\nvarying vec2 vTileUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = aLayer; vTileUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uTex;\nvarying float vLayer;\nvarying vec2 vTileUv;')
      .replace('#include <color_fragment>', `
        vec4 tc = texture(uTex, vec3(vTileUv, floor(vLayer + 0.5)));
        float lum = dot(tc.rgb, vec3(0.3333));
        float vl = dot(vColor.rgb, vec3(0.3333)); // vColor is a vec4 since r180 (.rgb works on the old vec3 too)
        ${photo ? 'diffuseColor.rgb *= tc.rgb * vl * 0.9;' : 'diffuseColor.rgb *= tc.rgb * mix(vec3(vl * 1.15), vColor.rgb, smoothstep(0.15, 0.32, lum));'}
        ${cutout ? 'diffuseColor.a *= tc.a;' : ''}`);
  };
  m.customProgramCacheKey = () => 'bldg' + (cutout ? 'c' : 'o') + (photo ? 'p' : '');
  return m;
}

// Atlas and materials are built once and shared by every call (the centro and each streamed world tile).
let SHARED = null, SHARING = false;
function* sharedIter() {
  if (!SHARED) {
    if (SHARING) { while (!SHARED) yield; } // another generator (the world warm-up) is already building it
    else { SHARING = true; const atlas = yield* buildAtlasIter(); SHARED = { atlas, matMain: atlasMaterial(atlas, false), matRail: atlasMaterial(atlas, true) }; }
  }
  return SHARED;
}
export function* warmBuildings() { yield* sharedIter(); } // world.js: build the facade atlas ahead of the first tile

// =====================================================================================
// Geometry buffers
// =====================================================================================
class GB {
  constructor() {
    this.cap = 4096; this.n = 0; this.ni = 0;
    this.P = new Float32Array(this.cap * 3); this.N = new Float32Array(this.cap * 3); this.C = new Float32Array(this.cap * 3);
    this.U = new Float32Array(this.cap * 2); this.L = new Float32Array(this.cap); this.I = new Uint32Array(this.cap * 6);
  }
  grow() {
    const c = this.cap * 2, f = (a, k) => { const b = new (a.constructor)(c * k); b.set(a); return b; };
    this.P = f(this.P, 3); this.N = f(this.N, 3); this.C = f(this.C, 3); this.U = f(this.U, 2); this.L = f(this.L, 1); this.I = f(this.I, 6); this.cap = c;
  }
  v(p, nx, ny, nz, col, layerIdx) {
    if (this.n + 4 > this.cap) this.grow();
    const i = this.n++, k = p[5];
    this.P[i * 3] = p[0]; this.P[i * 3 + 1] = p[1]; this.P[i * 3 + 2] = p[2];
    this.N[i * 3] = nx; this.N[i * 3 + 1] = ny; this.N[i * 3 + 2] = nz;
    this.C[i * 3] = col.r * k; this.C[i * 3 + 1] = col.g * k; this.C[i * 3 + 2] = col.b * k;
    this.U[i * 2] = p[3]; this.U[i * 2 + 1] = p[4]; this.L[i] = layerIdx;
    return i;
  }
  // quad bl, br, tr, tl with outward normal n
  q(p0, p1, p2, p3, nx, ny, nz, layerIdx, col) {
    const ux = p2[0] - p0[0], uy = p2[1] - p0[1], uz = p2[2] - p0[2], vx = p1[0] - p0[0], vy = p1[1] - p0[1], vz = p1[2] - p0[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx), d = this.v(p3, nx, ny, nz, col, layerIdx);
    const I = this.I; let j = this.ni;
    if (gx * nx + gy * ny + gz * nz >= 0) { I[j++] = a; I[j++] = c; I[j++] = b; I[j++] = a; I[j++] = d; I[j++] = c; }
    else { I[j++] = a; I[j++] = b; I[j++] = c; I[j++] = a; I[j++] = c; I[j++] = d; }
    this.ni = j;
  }
  // triangle facing upwards
  tUp(p0, p1, p2, layerIdx, col) {
    let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
    let ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
    let nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ny < 0) { [p1, p2] = [p2, p1]; nx = -nx; ny = -ny; nz = -nz; }
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx);
    this.I[this.ni++] = a; this.I[this.ni++] = b; this.I[this.ni++] = c;
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry(), n = this.n;
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.slice(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.slice(0, n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.U.slice(0, n * 2), 2));
    g.setAttribute('aLayer', new THREE.BufferAttribute(this.L.slice(0, n), 1));
    g.setIndex(new THREE.BufferAttribute(this.I.slice(0, this.ni), 1));
    return new THREE.Mesh(g, mat);
  }
}

// =====================================================================================
// Styles
// =====================================================================================
const C = c => new THREE.Color(c);
const PAL = {
  bar: ['#c2a878', '#b9a185', '#c9b087', '#bfa27a', '#cdb892', '#b49a72', '#d0b88c', '#c9a58a', '#d4b894'].map(C),
  n19: ['#d9cab7', '#c9a293', '#d8c48a', '#c4b09a', '#dcc9a6', '#cfa88d', '#e0d2b8', '#c7a373', '#af9c8d', '#d8b0a0', '#e3d28f', '#e9e2d2', '#d99a78', '#bba898'].map(C),
  res: ['#c7a373', '#d8c48a', '#cf9a6b', '#e2d8c4', '#b8aea0', '#c98f78', '#d6b58a', '#bfae8e', '#dcc7a0', '#9fb0a6', '#d99a78', '#e3d28f', '#cdb8a0', '#c4a6a0', '#e8e0cc', '#a9b6a2'].map(C),
  pw: ['#d0cbc2', '#b9b5ab', '#d8cdb5', '#d9bfa0', '#c8c2b4'].map(C),
  church: ['#b09062', '#a6875b', '#bda37a'].map(C),
};
const STYLES = {
  bar: { pal: 'bar', bay: 4.2, g0: 4.9, fh: 4.4, parapet: 0.9, corn: 0.6, nobile: true, up: ['bar_up_g', 'bar_up_b'], nob: ['bar_nob_tri', 'bar_nob_seg'], rail: 'rail_b', balcUpper: 0.2, pitch: 0.12,
    ground: [['g_arch', 3], ['g_shop_s', 3], ['g_shop_o', 2], ['g_door', 2]] },
  n19: { pal: 'n19', bay: 3.8, g0: 4.4, fh: 3.9, parapet: 0.9, corn: 0.42, nobile: true, up: ['n19_up_g', 'n19_up_b', 'n19_up_t'], nob: ['n19_nob'], rail: 'rail_a', balcUpper: 0.4, pitch: 0.22,
    ground: [['g_shop_s', 4], ['g_shop_o', 3], ['g_arch', 1.4], ['g_door', 2]] },
  res: { pal: 'res', bay: 3.3, g0: 3.5, fh: 3.3, parapet: 0.8, corn: 0.2, nobile: false, up: ['res_a', 'res_b', 'res_c', 'res_d', 'res_e'], rail: 'rail_a', balcUpper: 0, pitch: 0.5,
    ground: [['g_door2', 2], ['g_shop_s', 2.5], ['g_garage', 1.5], ['g_win', 2], ['g_door', 1], ['g_shop_o', 1]] },
  pw: { pal: 'pw', bay: 3.6, g0: 3.8, fh: 3.1, parapet: 0.7, corn: 0.0, nobile: false, up: ['pw_a', 'pw_b'], rail: 'rail_a', balcUpper: 0, pitch: 0.0,
    ground: [['pw_shop', 3], ['g_shop_s', 3], ['g_door2', 1.5], ['g_garage', 1]] },
  church: { pal: 'church', rail: 'rail_a', bay: 5.0, g0: 5.2, fh: 6.4, parapet: 0.0, corn: 0.3, nobile: false, up: ['ch_mid'], church: true, pitch: 0.6,
    ground: [['ch_low', 6], ['ch_door', 1]] },
  low: { pal: 'res', bay: 4.0, g0: 99, fh: 3.3, parapet: 0.6, corn: 0.0, nobile: false, up: ['res_a'], rail: 'rail_a', balcUpper: 0, pitch: 0.4,
    ground: [['g_shop_s', 3], ['g_garage', 2], ['g_door2', 1.5], ['blank_g', 1]] },
};
const REPEATABLE = new Set(['g_shop_s', 'g_shop_o', 'g_win', 'pw_shop', 'g_garage', 'ch_low', 'blank_g']);

// =====================================================================================
// Spatial lookups
// =====================================================================================
function buildLookups(data = D) {
  const BC = 30, bgrid = new Map(), binfo = [];
  data.buildings.forEach((b, i) => {
    const pts = pairs(b.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    binfo.push({ pts, x0, z0, x1, z1 });
    for (let cx = Math.floor(x0 / BC); cx <= Math.floor(x1 / BC); cx++) for (let cz = Math.floor(z0 / BC); cz <= Math.floor(z1 / BC); cz++) {
      const k = cx * 100003 + cz; let l = bgrid.get(k); if (!l) bgrid.set(k, l = []); l.push(i);
    }
  });
  const inBuilding = (x, z) => {
    const l = bgrid.get(Math.floor(x / BC) * 100003 + Math.floor(z / BC)); if (!l) return false;
    for (const i of l) { const q = binfo[i]; if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && inPoly(q.pts, x, z)) return true; }
    return false;
  };
  const RC = 24, rgrid = new Map();
  for (const r of data.roads) {
    if (r.k === 'pier' || r.k === 'cycleway' || r.k === 'path') continue;
    const p = r.p, hw = r.w / 2;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const s = { x1: p[i], z1: p[i + 1], x2: p[i + 2], z2: p[i + 3], hw, r };
      const x0 = Math.min(s.x1, s.x2) - hw - 6, x1 = Math.max(s.x1, s.x2) + hw + 6, z0 = Math.min(s.z1, s.z2) - hw - 6, z1 = Math.max(s.z1, s.z2) + hw + 6;
      for (let cx = Math.floor(x0 / RC); cx <= Math.floor(x1 / RC); cx++) for (let cz = Math.floor(z0 / RC); cz <= Math.floor(z1 / RC); cz++) {
        const k = cx * 100003 + cz; let l = rgrid.get(k); if (!l) rgrid.set(k, l = []); l.push(s);
      }
    }
  }
  // distance from the carriageway edge to the nearest street, and that street
  const roadNear = (x, z) => {
    const l = rgrid.get(Math.floor(x / RC) * 100003 + Math.floor(z / RC)); let best = 1e9, br = null;
    if (!l) return { d: best, r: br };
    for (const s of l) {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1, L2 = dx * dx + dz * dz;
      let t = L2 > 0 ? ((x - s.x1) * dx + (z - s.z1) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) - s.hw;
      if (d < best) { best = d; br = s.r; }
    }
    return { d: best, r: br };
  };
  return { inBuilding, roadNear };
}

const hh = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const pick = (list, r) => { let t = 0; for (const e of list) t += e[1]; t *= r(); for (const e of list) { t -= e[1]; if (t <= 0) return e[0]; } return list[0][0]; };
const MAIN_ST = /Maqueda|Vittorio Emanuele|^Via Roma|Cavour|Libert|Ruggero Settimo|Mazzini|Butera|Alloro|Garibaldi|Cassaro/;
const GRAND = /Palazzo|Villa|Teatro|Museo|Tribunale|Universit|Convento|Monastero|Collegio|Banco|Ospedale|Conservatorio|Liceo/;

// Neighbourhood palettes, calibrated against Commons photos (Corso Vittorio Emanuele 2024, Via Roma, Ballaro, Albergheria,
// Vucciria): the Corso/Maqueda fronts are cream, buff and pinkish plaster with stone frames; Via Roma is grey-beige; the old
// quarters (Capo, Albergheria, Vucciria, Kalsa) show bare golden-brown tufa and heavily weathered, desaturated plaster.
const ZONES = {
  corso: { plaster: ['#e0d4b8', '#d6c6a6', '#cdbba0', '#d3b8a2', '#c7a58b', '#e4d9c2', '#c8b08c', '#d9c9a8', '#cfa890'], stone: ['#b79d74', '#c2aa82', '#a88e66', '#b8a07a'], pStone: 0.3, grime: 0.25,
    w: { bar: .3, n19: .5, res: .08, pw: .12 } },
  roma: { plaster: ['#cfc3ab', '#c4b59b', '#d2c7b0', '#bdae96', '#c9b79e', '#b9ad9b', '#d6cab4'], stone: ['#b5a68a', '#a89a80'], pStone: 0.2, grime: 0.3,
    w: { bar: .15, n19: .5, res: .05, pw: .3 } },
  old: { plaster: ['#cdb690', '#c8aa84', '#bf9f7c', '#d3c096', '#c49f7c', '#b9a587', '#d6c4a0', '#b98f72', '#c9b8a0', '#d0b9a2'], stone: ['#9d8560', '#a98f68', '#8f7a58', '#b49a74'], pStone: 0.45, grime: 0.6,
    w: { bar: .06, n19: .16, res: .66, pw: .12 } },
  liberta: { plaster: ['#e2d6bd', '#d8c4a0', '#d3a98f', '#c5b49c', '#c9a49a', '#e6dcc8', '#d9ccb0', '#bba898'], stone: ['#b9a07a'], pStone: 0.1, grime: 0.15,
    w: { bar: .06, n19: .4, res: .2, pw: .34 } },
  centro: { plaster: ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4'], stone: ['#b09870', '#bfa67e', '#a58b64'], pStone: 0.3, grime: 0.4,
    w: { bar: .1, n19: .3, res: .45, pw: .15 } },
};
const ZONE_SEEDS = [ // [zone, lat, lon]
  ['old', 38.1170, 13.3550], ['old', 38.1105, 13.3577], ['old', 38.1188, 13.3648], ['old', 38.1150, 13.3690], ['old', 38.1190, 13.3687], ['old', 38.1137, 13.3705],
  ['liberta', 38.1265, 13.3545], ['liberta', 38.1235, 13.3575], ['roma', 38.1090, 13.3650], ['roma', 38.1125, 13.3635],
  ['corso', 38.1157, 13.3613], ['corso', 38.1195, 13.3572], ['corso', 38.1148, 13.3562], ['corso', 38.1160, 13.3650],
].map(([z, la, lo]) => { const p = proj(la, lo); return [z, p[0], p[1]]; });
function zoneOf(cx, cz, near) {
  const n = near && near.r && near.r.n || '';
  if (/^Via Roma$/.test(n)) return 'roma';
  if (/Maqueda|Vittorio Emanuele|Cassaro|Bologni|Pretoria|Verdi|Quattro Canti|San Domenico/.test(n)) return 'corso';
  let best = 'centro', bd = 330 * 330;
  for (const [z, x, zz] of ZONE_SEEDS) { const d = (cx - x) ** 2 + (cz - zz) ** 2; if (d < bd) { bd = d; best = z; } }
  return best;
}
function chooseStyle(b, H, area, zone, r) {
  if (b.k === 'church' || b.t === 'church' || b.t === 'cathedral' || b.am === 'place_of_worship') return 'church';
  if (H < 5.2) return 'low';
  const name = b.n || '';
  if (b.hi || GRAND.test(name) || ['university', 'government', 'civic', 'museum', 'hotel', 'monastery', 'castle', 'public'].includes(b.t) || b.am === 'courthouse' || b.am === 'college')
    return r() < 0.6 ? 'bar' : 'n19';
  const ZW = (ZONES[zone] || ZONES.centro).w;
  const w = H >= 17 && zone !== 'corso' ? { ...ZW, pw: ZW.pw + .1, res: Math.max(0.05, ZW.res - .1) } : ZW;
  let t = r() * (w.bar + w.n19 + w.res + w.pw); for (const k of ['bar', 'n19', 'res', 'pw']) { t -= w[k]; if (t <= 0) return k; }
  return 'res';
}
const NAMED = { white: '#e6e3da', tan: '#c9ad82', beige: '#d6c9a8', yellow: '#dcc88a', red: '#b8705a', brown: '#9a7a5a', grey: '#b5b0a5', gray: '#b5b0a5', pink: '#d4a89a', orange: '#d49a6a' };
function osmColour(v) { if (!v) return null; const c = NAMED[String(v).toLowerCase()] || v; try { return new THREE.Color(c); } catch (e) { return null; } }

// =====================================================================================
// Build
// =====================================================================================
// buildBuildings(ctx, data = D) builds every building of `data` (the baked centro by default, or one world tile, which has the
// same field names) and returns a Group (added to ctx.scene for the centro call). buildBuildingsIter is the same as a
// generator that yields every few buildings so the world streamer (src/world.js) can spread a tile over several frames.
export function buildBuildings(ctx, data = D) {
  const group = new THREE.Group(), it = buildBuildingsIter(ctx, data, group);
  while (!it.next().done);
  return group;
}
export function* buildBuildingsIter(ctx, data = D, group = new THREE.Group()) {
  const tile = data !== D, scene = tile ? null : ctx.scene;
  if (scene) scene.add(group);
  const t0 = performance.now();
  const { matMain, matRail } = yield* sharedIter();
  const { inBuilding, roadNear } = buildLookups(data);
  const white = new THREE.Color(1, 1, 1);

  let chunks = new Map(); const CH = tile ? 250 : 400;
  const chunkOf = (x, z) => { const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); let c = chunks.get(k); if (!c) chunks.set(k, c = { m: new GB(), r: new GB(), p: new GB() }); return c; };
  let matPhoto = null, photoData = null;

  const stats = { styles: {}, balconies: 0, tanks: 0, tiled: 0, flat: 0 };

  // ---------- rooftop furniture ----------
  function boxAt(gb, cx, cz, w, d, ang, y0, y1, col, k) {
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2, L = LID.blank;
    const cn = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]);
    for (let i = 0; i < 4; i++) {
      const a = cn[i], b = cn[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = dz / l, nz = -dx / l;
      // ring is counter-clockwise in x/z so this normal points outward
      gb.q([a[0], y0, a[1], 0, 0, k * .85], [b[0], y0, b[1], l / 2, 0, k * .85], [b[0], y1, b[1], l / 2, (y1 - y0) / 2, k], [a[0], y1, a[1], 0, (y1 - y0) / 2, k], nx, 0, nz, L, col);
    }
    gb.q([cn[0][0], y1, cn[0][1], 0, 0, k], [cn[1][0], y1, cn[1][1], 1, 0, k], [cn[2][0], y1, cn[2][1], 1, 1, k], [cn[3][0], y1, cn[3][1], 0, 1, k], 0, 1, 0, L, col);
  }
  function cylAt(gb, cx, cz, rad, y0, y1, col, k, sides = 8) {
    const L = LID.blank;
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * 6.2832, a1 = (i + 1) / sides * 6.2832, am = (a0 + a1) / 2;
      const x0 = cx + Math.cos(a0) * rad, z0 = cz + Math.sin(a0) * rad, x1 = cx + Math.cos(a1) * rad, z1 = cz + Math.sin(a1) * rad;
      gb.q([x0, y0, z0, 0, 0, k * .8], [x1, y0, z1, .5, 0, k * .8], [x1, y1, z1, .5, .5, k], [x0, y1, z0, 0, .5, k], Math.cos(am), 0, Math.sin(am), L, col);
      gb.tUp([cx, y1, cz, .5, .5, k], [x0, y1, z0, 0, 0, k], [x1, y1, z1, 1, 0, k], L, col);
    }
  }
  const tankCols = [C('#e8e8e0'), C('#e2e2da'), C('#58687a'), C('#2c2e30'), C('#7a8f7c'), C('#d9d4c4')];
  function roofProps(gb, outer, holes, y, area, r) {
    if (area < 40) return;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of outer) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const rings = [outer, ...holes];
    const clear = (x, z) => {
      let m = 1e9;
      for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        let t = L2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        m = Math.min(m, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
      }
      return m;
    };
    const spot = (cl) => {
      for (let i = 0; i < 14; i++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (!inPoly(outer, x, z)) continue;
        if (holes.some(h => inPoly(h, x, z))) continue;
        if (clear(x, z) >= cl) return [x, z];
      }
      return null;
    };
    const k = 0.9 + r() * 0.1;
    if (area > 70 && r() < 0.55) { // stair / lift box
      const s = spot(2.4); if (s) boxAt(gb, s[0], s[1], 2 + r() * 1.4, 2.2 + r() * 1.6, r() * 3.14, y, y + 2.3 + r() * 0.4, C('#d9d0bc').multiplyScalar(1.1), k);
    }
    const nt = r() < 0.65 ? 1 + (r() < 0.5) + (r() < 0.2) : 0;
    for (let i = 0; i < nt; i++) {
      const rad = 0.65 + r() * 0.35, s = spot(rad + 1.0); if (!s) continue;
      const col = tankCols[(r() * tankCols.length) | 0];
      boxAt(gb, s[0], s[1], rad * 1.5, rad * 1.5, 0, y, y + 0.35, C('#8a8a86'), 0.9); // stand
      cylAt(gb, s[0], s[1], rad, y + 0.35, y + 0.35 + 1.1 + r() * 0.6, col, 1.0, 8);
      stats.tanks++;
    }
    if (r() < 0.35) { // antenna mast
      const s = spot(1.0); if (s) { boxAt(gb, s[0], s[1], .08, .08, 0, y, y + 3.2 + r() * 1.5, C('#444'), 1); boxAt(gb, s[0], s[1], 1.1, .05, r() * 3, y + 3.0, y + 3.06, C('#444'), 1); }
    }
  }

  // ---------- one solid (footprint extruded to a roof elevation) ----------
  function emitSolid(B, flat, holes, roofY) {
    const S = B.S, r = B.r, ch = B.ch, gbuf = ch.m;
    const outerPts = pairs(flat);
    let lo = Infinity, hi = -Infinity;
    for (const p of outerPts) { const y = groundY(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    roofY = Math.max(roofY, hi + 2.5);
    let area = signedArea(outerPts); if (area < 0) outerPts.reverse(); area = Math.abs(area);

    // convex small footprints may get a hipped tile roof
    let pitched = false, rise = 0, ax = 1, az = 0, ridge = null;
    const nHole = (holes || []).length;
    if (S.pitch > 0 && !nHole && area < 520 && outerPts.length <= 14) {
      let convex = true;
      for (let i = 0; i < outerPts.length; i++) {
        const p = outerPts[i], q = outerPts[(i + 1) % outerPts.length], s = outerPts[(i + 2) % outerPts.length];
        if ((q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0]) < -0.02) { convex = false; break; }
      }
      const H0 = roofY - lo, prob = H0 < 9 ? 0.7 : H0 < 15 ? 0.38 : 0.2;
      if (convex && r() < prob * (S.church ? 1.2 : 1)) pitched = true;
    }
    if (pitched) {
      let bl = 0;
      for (let i = 0; i < outerPts.length; i++) { const p = outerPts[i], q = outerPts[(i + 1) % outerPts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; ax = (q[0] - p[0]) / l; az = (q[1] - p[1]) / l; } }
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of outerPts) { const u = p[0] * ax + p[1] * az, v = -p[0] * az + p[1] * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const hw = (v1 - v0) / 2; rise = Math.min(hw * 0.42, 3.2);
      if (rise < 0.9) pitched = false;
      else { const mid = (u0 + u1) / 2, half = Math.max(0, (u1 - u0) / 2 - hw); ridge = { ua: mid - half, ub: mid + half, vm: (v0 + v1) / 2 }; }
    }
    if (pitched) stats.tiled++; else stats.flat++;
    const parH = pitched ? 0 : S.parapet;
    const yTop = roofY - (pitched ? rise : parH);
    const sp = B.spec || NOSPEC;
    const F = calcFloors(S, yTop - lo, B.lv, sp);
    let yg = lo + F.g0;
    if (yg < hi + 1.6 && F.nUp > 0) yg = Math.min(hi + 1.6, yTop - 1);
    const nUp = F.nUp, fh = nUp ? (yTop - yg) / nUp : 0;
    const hasNob = (S.nobile || sp.nobH) && nUp > 0;
    const fh1 = hasNob ? Math.min(sp.nobH || fh, yTop - yg) : fh, fhU = nUp > 1 && hasNob ? (yTop - yg - fh1) / (nUp - 1) : fh;
    const floorBase = f => yg + (f === 1 ? 0 : (hasNob ? fh1 + (f - 2) * fhU : (f - 1) * fh));
    // footprint edge lookup for per-wall specs and photo facades (matches collinear edges of the building's own outline)
    const bpEdge = (ax, az, bx, bz) => {
      const P = B.bp; if (!P) return null;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz; if (l2 < 1e-6) continue;
        const l = Math.sqrt(l2), t = (x, z) => ((x - p[0]) * dx + (z - p[1]) * dz) / l2, off = (x, z) => Math.abs((x - p[0]) * dz - (z - p[1]) * dx) / l;
        if (off(ax, az) > 0.45 || off(bx, bz) > 0.45) continue;
        const ta = t(ax, az), tb = t(bx, bz); if (ta < -0.03 || ta > 1.03 || tb < -0.03 || tb > 1.03) continue;
        return { i, ta, tb };
      }
      return null;
    };

    const rings = [{ pts: outerPts, hole: false }];
    for (const h of holes || []) { const pts = pairs(h); if (signedArea(pts) > 0) pts.reverse(); rings.push({ pts, hole: true }); }

    function edge(E) {
      const { ax, az, bx, bz, dx, dz, ux, uz, nx, nz, len, kind } = E;
      const col = B.col, L = LID;
      const kc = t => (t === 0 && E.reflexA) || (t === 1 && E.reflexB) ? 0.86 : 1;
      const strip = (t0, t1, yb0, yb1, yt0, yt1, v0, v1, lay, k0, k1, u0, u1) => {
        const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
        const c0 = kc(t0), c1 = kc(t1), j0 = 0.95 + 0.1 * hh(x0, z0), j1 = 0.95 + 0.1 * hh(x1, z1);
        gbuf.q([x0, yb0, z0, u0, v0, k0 * c0 * j0], [x1, yb1, z1, u1, v0, k0 * c1 * j1], [x1, yt1, z1, u1, v1, k1 * c1 * j1], [x0, yt0, z0, u0, v1, k1 * c0 * j0], nx, 0, nz, lay, col);
      };
      const foot0 = E.ga - 0.3, foot1 = E.gb - 0.3;
      let W = sp, ph = null, bm = null;
      if ((B.spec && B.spec.walls) || B.photo) {
        bm = bpEdge(ax, az, bx, bz);
        if (bm) { const w = B.spec && B.spec.walls && B.spec.walls[bm.i]; if (w) W = { ...sp, ...w }; if (B.photo) ph = B.photo[bm.i] || null; }
      }
      if (kind === 'party' || len < 2.6) {
        strip(0, 1, foot0, foot1, yTop, yTop, 0, (yTop - Math.min(foot0, foot1)) / 4, B.stoneWall ? L.ch_low : L.blank, 0.72, 0.97, 0, len / 4);
      } else if (ph) {
        // photo-rectified facade: one quad from the pavement to the cornice
        const U = t => ph.u0 + (ph.u1 - ph.u0) * t;
        ch.p.q([ax, foot0, az, U(bm.ta), ph.v0, 0.8], [bx, foot1, bz, U(bm.tb), ph.v0, 0.8], [bx, yTop, bz, U(bm.tb), ph.v1, 1], [ax, yTop, az, U(bm.ta), ph.v1, 1], nx, 0, nz, ph.layer, white);
      } else {
        const nb = W.bays ? Math.max(1, W.bays | 0) : Math.max(1, Math.round(len / (W.bay || S.bay))), bw = len / nb;
        const upT = W.up || B.up, nobT = W.nob || B.nob || 'n19_nob', gmode = W.ground;
        // ground floor runs
        const runs = [];
        const addRun = lay => { const q = runs[runs.length - 1]; if (q && q.lay === lay && REPEATABLE.has(lay)) q.n++; else runs.push({ lay, n: 1 }); };
        if (S.church) for (let i = 0; i < nb; i++) addRun(nb > 2 && i === (nb >> 1) && kind === 'street' && r() < 0.7 ? 'ch_door' : 'ch_low');
        else if (kind === 'street') {
          let prev = null;
          const GL = GROUND_MODES[gmode] || S.ground;
          for (let i = 0; i < nb; i++) {
            let lay = prev && REPEATABLE.has(prev) && r() < 0.6 ? prev : pick(GL, r);
            if (lay === prev && !REPEATABLE.has(lay)) lay = pick(GL, r);
            if (W.portal && W.portal.bay === i && (W.portal.wall === undefined || (bm && W.portal.wall === bm.i))) lay = 'g_arch';
            addRun(lay); prev = lay;
          }
        } else for (let i = 0; i < nb; i++) { const q = r(); addRun(q < 0.12 ? 'g_door2' : q < 0.25 ? 'g_win' : 'blank_g'); }
        let i0 = 0;
        for (const run of runs) {
          const t0 = i0 / nb, t1 = (i0 + run.n) / nb;
          strip(t0, t1, foot0 + (foot1 - foot0) * t0, foot0 + (foot1 - foot0) * t1, Math.max(yg, foot0 + 1), Math.max(yg, foot1 + 1), 0, 1, L[run.lay], 0.64, 0.9, 0, run.n);
          i0 += run.n;
        }
        // upper floors
        if (nUp > 0) {
          if (S.church) {
            if (nUp >= 2) strip(0, 1, yg, yg, yg + fh * (nUp - 1), yg + fh * (nUp - 1), 0, nUp - 1, L.ch_mid, 0.95, 0.97, 0, nb);
            strip(0, 1, yg + fh * (nUp - 1), yg + fh * (nUp - 1), yTop, yTop, 0, 1, nUp >= 2 ? L.ch_top : L.ch_mid, 0.97, 0.93, 0, nb);
          } else {
            let start = 1, y0 = yg;
            if (hasNob && kind === 'street') { strip(0, 1, yg, yg, yg + fh1, yg + fh1, 0, 1, L[nobT], 0.94, 0.98, 0, nb); start = 2; y0 = yg + fh1; }
            if (nUp >= start) strip(0, 1, y0, y0, yTop, yTop, 0, nUp - start + 1, L[upT], 0.97, 0.93, 0, nb);
          }
        }
        // balconies on street fronts (per-spec pattern, otherwise palazzi styles get the default pattern)
        const bmode = W.balc || (S.rail && S.nobile ? 'default' : 'none'), rail = W.rail || S.rail || 'rail_a';
        if (kind === 'street' && bmode !== 'none' && bw >= (W.balc ? 2.6 : 2.9) && nUp > 0) {
          if (bmode === 'cont') {
            for (let f = 1; f <= (W.contFloors || 1) && f <= nUp; f++) balcony(0.5, floorBase(f), Math.max(0.8, len / 2 - 0.5), true, Math.max(nb, Math.round((len - 1) / 1.3)), rail);
          } else {
            const upper = bmode === 'default' ? hh(ax * 1.3, az * 0.7) < S.balcUpper : bmode === 'every' || bmode === 'alt';
            for (let f = 1; f <= nUp; f++) {
              if (f > 1 && !upper) break;
              if (bmode === 'nobile' && f > 1) break;
              for (let i = 0; i < nb; i++) {
                if ((i === 0 && E.reflexA) || (i === nb - 1 && E.reflexB)) continue;
                if (f > 1 && (bmode === 'default' || bmode === 'alt') && i % 2) continue;
                if (bmode === 'alt' && f === 1 && i % 2) continue;
                balcony((i + 0.5) / nb, floorBase(f), Math.min(1.55, bw * 0.36), f === 1, 0, rail);
              }
            }
          }
        }
        function balcony(t, yFloor, w2, brackets, nBr, rl0) {
          const cx = ax + dx * t, cz = az + dz * t, dp = 0.78, th = 0.16, yb = yFloor + 0.09, yt = yb + th;
          const px0 = cx - ux * w2, pz0 = cz - uz * w2, px1 = cx + ux * w2, pz1 = cz + uz * w2;
          const qx0 = px0 + nx * dp, qz0 = pz0 + nz * dp, qx1 = px1 + nx * dp, qz1 = pz1 + nz * dp, sl = B.slab, LB = L.blank;
          gbuf.q([px0, yt, pz0, 0, 0, 1], [px1, yt, pz1, 1, 0, 1], [qx1, yt, qz1, 1, .3, 1], [qx0, yt, qz0, 0, .3, 1], 0, 1, 0, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .5], [px1, yb, pz1, 1, 0, .5], [qx1, yb, qz1, 1, .3, .5], [qx0, yb, qz0, 0, .3, .5], 0, -1, 0, LB, sl);
          gbuf.q([qx0, yb, qz0, 0, 0, .85], [qx1, yb, qz1, 1, 0, .85], [qx1, yt, qz1, 1, .1, .95], [qx0, yt, qz0, 0, .1, .95], nx, 0, nz, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .8], [qx0, yb, qz0, .3, 0, .8], [qx0, yt, qz0, .3, .1, .9], [px0, yt, pz0, 0, .1, .9], -ux, 0, -uz, LB, sl);
          gbuf.q([px1, yb, pz1, 0, 0, .8], [qx1, yb, qz1, .3, 0, .8], [qx1, yt, qz1, .3, .1, .9], [px1, yt, pz1, 0, .1, .9], ux, 0, uz, LB, sl);
          if (brackets) {
            const offs = nBr ? Array.from({ length: nBr + 1 }, (_, k) => -w2 + 0.3 + (2 * w2 - 0.6) * k / nBr) : [-w2 + 0.25, w2 - 0.25];
            for (const o of offs) {
              const bx0 = cx + ux * o, bz0 = cz + uz * o, bx1 = bx0 + nx * dp, bz1 = bz0 + nz * dp;
              for (const sgn of [1, -1]) gbuf.q([bx0, yb - 0.42, bz0, 0, 0, .4], [bx1, yb, bz1, .1, .1, .5], [bx0, yb, bz0, 0, .1, .5], [bx0, yb, bz0, 0, .1, .5], ux * sgn, 0, uz * sgn, L.blank, B.iron);
            }
          }
          const rl = L[rl0], rb = yt, rt = yt + 1.0, ins = 0.05, rx0 = qx0 - nx * ins, rz0 = qz0 - nz * ins, rx1 = qx1 - nx * ins, rz1 = qz1 - nz * ins, wu = w2 * 2 / 1.6, du = dp / 1.6;
          ch.r.q([rx0, rb, rz0, 0, 0, 1], [rx1, rb, rz1, wu, 0, 1], [rx1, rt, rz1, wu, 1, 1], [rx0, rt, rz0, 0, 1, 1], nx, 0, nz, rl, white);
          ch.r.q([px0 + ux * ins, rb, pz0 + uz * ins, 0, 0, 1], [rx0 + ux * ins, rb, rz0 + uz * ins, du, 0, 1], [rx0 + ux * ins, rt, rz0 + uz * ins, du, 1, 1], [px0 + ux * ins, rt, pz0 + uz * ins, 0, 1, 1], -ux, 0, -uz, rl, white);
          ch.r.q([px1 - ux * ins, rb, pz1 - uz * ins, 0, 0, 1], [rx1 - ux * ins, rb, rz1 - uz * ins, du, 0, 1], [rx1 - ux * ins, rt, rz1 - uz * ins, du, 1, 1], [px1 - ux * ins, rt, pz1 - uz * ins, 0, 1, 1], ux, 0, uz, rl, white);
          stats.balconies++;
        }
      }
      // projecting cornice at the roof line
      if (kind !== 'party' && len >= 2.5 && S.corn > 0) {
        const d = S.corn, ext = len > 4 * d ? d : 0, sA = E.reflexA ? 0 : ext, sB = E.reflexB ? 0 : ext;
        const x0 = ax - ux * sA, z0 = az - uz * sA, x1 = bx + ux * sB, z1 = bz + uz * sB, yb = yTop - 0.42, yt = yTop + 0.02, ox0 = x0 + nx * d, oz0 = z0 + nz * d, ox1 = x1 + nx * d, oz1 = z1 + nz * d, ll = len / 1.2, st = B.stone;
        gbuf.q([ox0, yb, oz0, 0, 0, .95], [ox1, yb, oz1, ll, 0, .95], [ox1, yt, oz1, ll, 1, 1], [ox0, yt, oz0, 0, 1, 1], nx, 0, nz, L.cornice, st);
        gbuf.q([x0, yb, z0, 0, 0, .55], [x1, yb, z1, 1, 0, .55], [ox1, yb, oz1, 1, .3, .55], [ox0, yb, oz0, 0, .3, .55], 0, -1, 0, L.blank, st);
        gbuf.q([x0, yt, z0, 0, 0, 1], [x1, yt, z1, 1, 0, 1], [ox1, yt, oz1, 1, .3, 1], [ox0, yt, oz0, 0, .3, 1], 0, 1, 0, L.blank, st);
      }
      // parapet around the terrace
      if (!pitched && parH > 0 && kind !== 'party' && len >= 1.5) {
        const t = 0.25, ext = len > 1 ? t : 0, sA = E.reflexA ? 0 : ext, sB = E.reflexB ? 0 : ext;
        strip(0, 1, yTop, yTop, yTop + parH, yTop + parH, 0, parH / 4, L.blank, 0.9, 1, 0, len / 4);
        const x0 = ax - ux * sA, z0 = az - uz * sA, x1 = bx + ux * sB, z1 = bz + uz * sB, ix0 = x0 - nx * t, iz0 = z0 - nz * t, ix1 = x1 - nx * t, iz1 = z1 - nz * t;
        gbuf.q([ix0, yTop, iz0, 0, 0, .85], [ix1, yTop, iz1, len / 4, 0, .85], [ix1, yTop + parH, iz1, len / 4, parH / 4, 1], [ix0, yTop + parH, iz0, 0, parH / 4, 1], -nx, 0, -nz, L.blank, col);
        gbuf.q([x0, yTop + parH, z0, 0, 0, 1], [x1, yTop + parH, z1, 1, 0, 1], [ix1, yTop + parH, iz1, 1, .2, 1], [ix0, yTop + parH, iz0, 0, .2, 1], 0, 1, 0, L.blank, B.stone);
      }
    }

    for (const ring of rings) {
      const pts = ring.pts, N = pts.length;
      for (let i = 0; i < N; i++) {
        const a = pts[i], b = pts[(i + 1) % N], pa = pts[(i + N - 1) % N], pb = pts[(i + 2) % N];
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
        const crossA = (a[0] - pa[0]) * dz - (a[1] - pa[1]) * dx, crossB = dx * (pb[1] - b[1]) - dz * (pb[0] - b[0]);
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        let kind;
        if (ring.hole) kind = 'court';
        else if (inBuilding(mx + nx * 0.6, mz + nz * 0.6) || inBuilding(mx + nx * 1.3, mz + nz * 1.3)) kind = 'party';
        else kind = roadNear(mx + nx * 2.2, mz + nz * 2.2).d < 3.2 ? 'street' : 'back';
        edge({ ax: a[0], az: a[1], bx: b[0], bz: b[1], dx, dz, ux, uz, nx, nz, len, reflexA: crossA < -0.05, reflexB: crossB < -0.05, kind, ga: groundY(a[0], a[1]), gb: groundY(b[0], b[1]) });
      }
    }

    // ----- roof -----
    if (!pitched) {
      const hp = rings.slice(1).map(h => h.pts);
      try {
        const contour = outerPts.map(p => new THREE.Vector2(p[0], p[1])), hs = hp.map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
        const tris = THREE.ShapeUtils.triangulateShape(contour, hs), all = contour.concat(...hs);
        const k = B.roofK, V = i => [all[i].x, yTop, all[i].y, all[i].x / 3.5, all[i].y / 3.5, k];
        for (const t of tris) gbuf.tUp(V(t[0]), V(t[1]), V(t[2]), B.terrLay, B.roofCol);
      } catch (e) { /* skip broken ring */ }
      roofProps(gbuf, outerPts, hp, yTop, area, r);
    } else {
      const { ua, ub, vm } = ridge, lay = B.greyRoof ? LID.tiles_grey : LID.tiles, k = B.roofK;
      const RP = p => { const u = p[0] * ax + p[1] * az, uc = Math.min(ub, Math.max(ua, u)); return [uc * ax - vm * az, uc * az + vm * ax, uc]; };
      const Eave = p => { const u = p[0] * ax + p[1] * az, v = -p[0] * az + p[1] * ax, uc = Math.min(ub, Math.max(ua, u)); return [p[0], yTop, p[1], u / 3, Math.hypot(u - uc, v - vm) * 1.15 / 3, k]; };
      const Rid = (p, q) => [q[0], roofY, q[1], q[2] / 3, 0, k];
      const N = outerPts.length;
      for (let i = 0; i < N; i++) {
        const a = outerPts[i], b = outerPts[(i + 1) % N], ra = RP(a), rb = RP(b);
        gbuf.tUp(Eave(a), Eave(b), Rid(b, rb), lay, B.roofCol);
        if (Math.hypot(ra[0] - rb[0], ra[1] - rb[1]) > 0.05) gbuf.tUp(Eave(a), Rid(b, rb), Rid(a, ra), lay, B.roofCol);
      }
    }
  }

  // ---------- all buildings ----------
  const grey = l => new THREE.Color(l, l, l);
  let meshesOut = [];
  function* run(photo) {
    chunks = new Map(); let nb = 0;
    const tStart = performance.now();
    stats.styles = {}; stats.balconies = 0; stats.tanks = 0; stats.tiled = 0; stats.flat = 0; stats.specs = 0; stats.photo = 0; stats.osmCol = 0;
    for (const b of data.buildings) {
      if (ctx.skip.has(b.id)) continue;
      if ((++nb & 7) === 0) yield;
      const r = rng(b.c * 7919 + 13);
      const solids = [];
      const shift = b.r !== undefined && !data.near ? -b.g : 0;
      const pts0 = pairs(b.p);
      if (b.r === undefined) {
        const street = Math.max(...pts0.map(p => groundY(p[0], p[1])));
        solids.push([b.p, b.holes, street + b.h]);
      } else {
        if (!b.split) solids.push([b.p, b.holes, b.r + shift]);
        for (const [poly, rr] of b.parts || []) solids.push([poly, null, rr + shift]);
      }
      let cx = 0, cz = 0, bestD = 1e9, near = null;
      for (const p of pts0) { cx += p[0]; cz += p[1]; const q = roadNear(p[0], p[1]); if (q.d < bestD) { bestD = q.d; near = q; } }
      cx /= pts0.length; cz /= pts0.length;
      const area = Math.abs(signedArea(pts0)), H0 = b.r !== undefined ? b.r - b.g : b.h;
      const spec = SPECS[b.id] || null;
      const zone = zoneOf(cx, cz, near), Z = ZONES[zone] || ZONES.centro;
      const key = spec && spec.style || chooseStyle(b, H0, area, zone, r);
      let S = STYLES[key];
      if (spec) { stats.specs++; S = { ...S }; if (spec.bay) S.bay = spec.bay; if (spec.fh) S.fh = spec.fh; if (spec.corn !== undefined) S.corn = spec.corn; if (spec.rail) S.rail = spec.rail; }
      stats.styles[key] = (stats.styles[key] || 0) + 1;
      // colour: spec table, then OSM building:colour, then the zone palette (stone or plaster)
      const isStone = key === 'church' || (spec && spec.stone !== undefined ? spec.stone : (key === 'bar' || key === 'res' || key === 'n19') && r() < Z.pStone * (key === 'bar' ? 1.3 : key === 'res' ? 1 : 0.5));
      const osm = osmColour(b.col);
      let base;
      if (spec && spec.col) base = new THREE.Color(spec.col);
      else if (osm) { base = osm; stats.osmCol++; }
      else if (key === 'pw') base = PAL.pw[b.c % PAL.pw.length].clone();
      else if (key === 'church') base = PAL.church[b.c % PAL.church.length].clone();
      else { const list = isStone ? Z.stone : Z.plaster; base = new THREE.Color(list[b.c % list.length]); }
      const grime = spec && spec.grime !== undefined ? spec.grime : Z.grime, gr = grime * r();
      const col = base.multiplyScalar(1.3 * (0.94 + 0.1 * r()) * (1 - 0.2 * gr));
      col.lerp(grey((col.r + col.g + col.b) / 3), 0.12 + 0.28 * gr);
      const stone = new THREE.Color(1, 1, 1).lerp(col, 0.3).multiplyScalar(1.15);
      const B = {
        S, r, ch: chunkOf(cx, cz), col, stone, slab: stone.clone().multiplyScalar(0.92), iron: C('#24242a'), lv: Number(b.lv) || spec && spec.floors || 0,
        up: S.up[(r() * S.up.length) | 0], nob: S.nob ? S.nob[(r() * S.nob.length) | 0] : null, greyRoof: S.church && r() < 0.35, roofK: 1,
        spec, bp: spec && spec.walls || photo && photo.byId[b.id] ? pts0 : null, photo: photo && photo.byId[b.id] || null, stoneWall: isStone,
      };
      if (B.photo) stats.photo++;
      if (isStone && !S.church && S.up.length && key !== 'low') { const sh = r() < 0.6 ? 'g' : 'b'; B.up = 'st_up_' + sh; }
      if (spec && spec.win && spec.win !== 'rect' && WIN_TILES[spec.win]) { const [u, n] = WIN_TILES[spec.win](isStone, r() < 0.6 ? 'g' : 'b'); B.up = u; B.nob = n; }
      { const q = r(); B.terrLay = q < 0.16 ? LID.terrace_b : q < 0.27 ? LID.terrace_c : LID.terrace; }
      const flatTint = 0.88 + 0.2 * r();
      B.roofCol = new THREE.Color(flatTint, flatTint * 0.97, flatTint * 0.92);
      for (const [flat, holes, roofY] of solids) emitSolid(B, flat, holes, roofY);
    }
    let tris = 0, nm = 0;
    for (const m of meshesOut) { group.remove(m); m.geometry.dispose(); }
    meshesOut = [];
    for (const c of chunks.values()) {
      for (const [gb, mat, shadow] of [[c.m, matMain, true], [c.r, matRail, false], [c.p, matPhoto, true]]) {
        if (!gb.n || !mat) continue;
        const m = gb.mesh(mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); meshesOut.push(m);
        tris += gb.ni / 3; nm++;
      }
      yield;
    }
    group.userData.tris = tris;
    if (!tile) { window.__bld = { tris, meshes: nm, stats, ms: performance.now() - tStart }; console.log('[buildings]', JSON.stringify(window.__bld)); }
  }
  yield* run(null);

  // Photo-rectified facades (optional): assets/facades/photo/map.json = { buildingId: [{ wall, texture, u0, u1, v0, v1, credit }] }.
  // wall = index of the footprint edge in b.p (start vertex), u runs from that vertex to the next, v from the pavement (v0) to the
  // cornice (v1), with v = 0 at the bottom of the image. Loaded after the first build, then the buildings are rebuilt once.
  if (!tile) (async () => { // (centro only: streamed tiles skip the photo facades for now)
    try {
      const resp = await fetch(new URLSearchParams(location.search).get('photomap') || 'assets/facades/photo/map.json', { cache: 'no-cache' });
      if (!resp.ok) return;
      const map = await resp.json(), byId = {}, urls = [];
      for (const id of Object.keys(map)) for (const e of map[id]) {
        if (!D.buildings.some(b => b.id === id) || ctx.skip.has(id)) continue;
        let u = e.texture; if (!/^(https?:|\/|assets\/)/.test(u)) u = 'assets/facades/photo/' + u;
        let li = urls.indexOf(u); if (li < 0) { li = urls.length; urls.push(u); }
        (byId[id] = byId[id] || {})[e.wall] = { layer: li, u0: e.u0 ?? 0, u1: e.u1 ?? 1, v0: e.v0 ?? 0, v1: e.v1 ?? 1 };
      }
      if (!urls.length) return;
      const PS = 1024, cv = document.createElement('canvas'); cv.width = cv.height = PS;
      const g = cv.getContext('2d', { willReadFrequently: true }), data = new Uint8Array(PS * PS * 4 * Math.min(urls.length, 32));
      for (let i = 0; i < Math.min(urls.length, 32); i++) {
        const img = new Image(); img.src = urls[i];
        try { await img.decode(); } catch (e) { console.warn('[buildings] photo failed', urls[i]); continue; }
        g.clearRect(0, 0, PS, PS); g.drawImage(img, 0, 0, PS, PS);
        const px = g.getImageData(0, 0, PS, PS).data;
        for (let y = 0; y < PS; y++) data.set(px.subarray(y * PS * 4, (y + 1) * PS * 4), (i * PS + (PS - 1 - y)) * PS * 4);
      }
      const tex = new THREE.DataArrayTexture(data, PS, PS, Math.min(urls.length, 32));
      tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
      matPhoto = atlasMaterial(tex, false, true); photoData = { byId, tex };
      { const it = run(photoData); while (!it.next().done); }
    } catch (e) { /* no photo map: procedural facades only */ }
  })();
  return group;
}

function calcFloors(S, Hw, lv, sp) {
  const g0 = sp && sp.g0 || S.g0;
  if (Hw < g0 * 1.2) return { g0: Hw, nUp: 0 };
  if (sp && sp.floors) return { g0, nUp: Math.max(1, sp.floors - 1) };
  let nUp = Math.max(1, Math.round((Hw - g0) / S.fh));
  if (lv > 1 && lv <= 9) { const f = (Hw - g0) / (lv - 1); if (f > S.fh * 0.7 && f < S.fh * 1.3) nUp = lv - 1; }
  return { g0, nUp };
}
const NOSPEC = {};
const GROUND_MODES = {
  shops: [['g_shop_s', 3], ['g_shop_o', 2]], arcade: [['g_arch', 1]], blind: [['blank_g', 3], ['g_win', 1]], rustic: [['g_rust_win', 1]],
};
const WIN_TILES = { // window type -> [upper tile(s), nobile tile]
  arch: (stone, sh) => [stone ? 'st_arch_up' : sh === 'b' ? 'arch_up_b' : 'arch_up_g', 'bar_nob_seg'],
  ped: () => ['ped_up', 'n19_nob'],
};
