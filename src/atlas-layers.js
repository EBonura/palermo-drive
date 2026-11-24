// The painters of the buildings' wall atlas: every layer of it (facades, roofs, railings, the weathering noise) drawn with canvas 2D on a 256 px tile, and the groups of variant layers the building shader picks
// from. No THREE, no game data and no DOM beyond document.createElement('canvas'), so the same file runs on the main thread (src/buildings.js) and in a pool worker (src/atlas-task.js, src/work-pool.js: the worker
// gives itself a document that makes OffscreenCanvas). Every layer is seeded by its index (paintLayer): the same pixels come back wherever it is drawn.
import { heroLayers } from './hero-facades.js';
import { rng } from './rng.js';


export const T = 256;
export const LAYERS = [], LID = {};
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
  g.shadowColor = 'rgba(40,30,20,.3)'; g.shadowBlur = 5; g.strokeStyle = 'rgba(70,52,34,.22)'; g.lineWidth = 1; g.stroke(); g.shadowBlur = 0; g.clip();
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
  sm.width = sm.height = 0;   // (on iOS a canvas nobody holds still counts until the collector finds it)
}
function plaster(g, r, base = '#e7e1d3', o = {}) {
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  softNoise(g, r, 5, '120,92,58', .2); softNoise(g, r, 9, '255,250,236', .22); softNoise(g, r, 14, '90,70,45', .12);
  softNoise(g, r, 3, '70,60,50', .16, 2.4); // vertical grime bands
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(90,70,50,.10)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * T, r() * T, 1 + r() * 1.6, 1 + r() * 1.6); }
  const np = o.peel === undefined ? (r() < .1 ? 1 : 0) : o.peel;   // [texround2] was .38: one tan patch per tile read as a stamp repeating down a wall
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
layer('blank', (g, r) => { plaster(g, r, '#e7e1d3', { peel: 0 }); for (let i = 0; i < 3; i++) streak(g, 30 + r() * 190, r() * 80, 100 + r() * 100, 6 + r() * 10, .09); });
layer('blank_g', (g, r) => { plaster(g, r, '#e2dccd', { peel: 0 }); dado(g, 60, .4); });   // [texround2] the walls use the groups blank_v and g_blank (below), these two stay for the roof furniture
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
// garage doors in four states (a group, GMAP g_garage): light metal, brown, green, and one rolled up on a dark box with a car in it
const garageDoor = (col, up) => (g, r) => {
  plaster(g, r, '#e0d9c8', { peel: 0 }); g.fillStyle = '#ebe4d2'; g.fillRect(16, 60, 224, T - 60);
  if (up) { g.fillStyle = '#17120e'; g.fillRect(26, 70, 204, 186); g.fillStyle = 'rgba(220,190,120,.35)'; g.fillRect(150, 120, 70, 136); g.fillStyle = '#6a6c70'; g.fillRect(46, 190, 100, 50); g.fillStyle = '#4a4c52'; g.fillRect(64, 164, 62, 30); g.fillStyle = 'rgba(190,210,230,.3)'; g.fillRect(70, 170, 50, 18); rollShutter(g, r, 26, 70, 204, 22, col); }
  else rollShutter(g, r, 26, 70, 204, 186, col);
  g.fillStyle = '#2a2a2a'; g.fillRect(26, 62, 204, 8);
  dado(g, 30, .35);
};
const GARS = [garageDoor('#a6a8a2'), garageDoor('#6a5a4a'), garageDoor('#50705a'), garageDoor('#7a7b76', 1)];
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

// ---- shopfront variety (board item 2): a bar, a tabaccheria, a bakery, a greengrocer with goods outside, a palazzo portone, a chemist, and the market fronts with the shutter rolled up.
// Text is drawn with the canvas font; the atlas is painted once at load.
function lettering(g, txt, x, y, size, col, w) {
  g.save(); g.translate(x, y); g.scale(-1, 1);   // the facade strips run their u against the reading direction: paint the lettering mirrored so it reads right on the wall
  g.font = `bold ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(txt, 0, 0, w); g.restore();
}
function glassFront(g, x, y, w, h, lit = '#e8c88a', dark = '#6a4a2c') {   // a shop window: warm interior behind dark metal frames
  g.fillStyle = '#3a342c'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, lit); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(190,210,230,.17)'; g.beginPath(); g.moveTo(x, y + h * .6); g.lineTo(x + w * .55, y); g.lineTo(x + w * .8, y); g.lineTo(x, y + h * .95); g.fill();
}
function stripedAwning(g, x, y, w, h, c0, c1, scallop = 8) {
  const n = Math.round(w / 18), sw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c1 : c0; g.fillRect(x + i * sw, y, sw, h);
    g.beginPath(); g.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, Math.PI); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + h - 5, w, 5); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 3);
}
function crateRow(g, r, x0, x1, y, h, cols) {   // crates of produce standing in front of a shop: wooden box, heap on top
  for (let x = x0; x + 34 <= x1; x += 38) {
    g.fillStyle = '#9a7c4c'; g.fillRect(x, y + h * .45, 34, h * .55); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + h * .45, 34, 3); g.fillRect(x, y + h * .75, 34, 2);
    g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.moveTo(x + 2, y + h * .5); g.quadraticCurveTo(x + 17, y - 2, x + 32, y + h * .5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 8, y + h * .3, 5, 3);
  }
}
const PRODUCE = ['#e0771c', '#c8301c', '#e8c82a', '#5d8a35', '#7a2c60', '#d84a1c', '#8aaa38'];
layer('g_bar', (g, r) => {   // caffe / bar: sign, green-white awning, warm glass front with the counter and the bottle shelf, a chalkboard on the pavement
  plaster(g, r, '#e0d9c6', { peel: 0 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  g.fillStyle = '#5a1f26'; g.fillRect(24, 14, 208, 40); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(24, 14, 208, 3);
  lettering(g, 'BAR', 128, 36, 34, '#f1e6c0', 190);
  stripedAwning(g, 22, 58, 212, 26, '#2f6a45', '#efe9d8');
  glassFront(g, 28, 96, 128, 128, '#f0d090', '#7a5a34');
  g.fillStyle = '#2a1e16'; g.fillRect(28, 186, 128, 38); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(28, 186, 128, 3);   // the counter
  for (let i = 0; i < 9; i++) { g.fillStyle = ['#2a6a4a', '#8a2a24', '#c8a838', '#3a5a8a', '#d8d4c4'][i % 5]; g.fillRect(36 + i * 13, 132, 7, 18 + (i % 3) * 4); }   // bottles on the shelf
  g.fillStyle = '#c8c4b8'; g.fillRect(58, 166, 40, 18); g.fillStyle = '#8a8a86'; g.fillRect(66, 158, 24, 8);                         // espresso machine
  g.fillStyle = '#2a2420'; g.fillRect(168, 96, 62, 128); g.fillStyle = 'rgba(210,225,240,.2)'; g.fillRect(172, 100, 54, 120); g.fillStyle = '#c8c0a0'; g.fillRect(172, 156, 3, 18);   // glass door
  g.fillStyle = '#1c1c1c'; g.fillRect(206, 184, 40, 56); g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 5; i++) g.fillRect(210, 190 + i * 9, 20 + (i * 7) % 12, 2);   // the chalkboard menu
  g.fillStyle = '#b9ae98'; g.fillRect(12, 236, 232, 20); dado(g, 30, .3);
});
layer('g_tabacchi', (g, r) => {   // tabaccheria: the navy plate with the white T, the lotto board, a window of posters, a glass door
  plaster(g, r, '#d8d1c0', { peel: 1 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  g.fillStyle = '#16213c'; g.fillRect(28, 14, 76, 76); g.strokeStyle = '#d8d4c4'; g.lineWidth = 3; g.strokeRect(32, 18, 68, 68);
  lettering(g, 'T', 66, 54, 62, '#f4f1e8', 60);
  g.fillStyle = '#c8281e'; g.fillRect(118, 20, 110, 28); lettering(g, 'LOTTO', 173, 34, 22, '#f4f1e8', 100);
  g.fillStyle = '#e8c830'; g.fillRect(118, 52, 110, 26); lettering(g, 'SUPERENALOTTO', 173, 65, 14, '#2a2420', 104);
  glassFront(g, 28, 104, 100, 122, '#cfc7b0', '#8a7e64');
  for (let i = 0; i < 6; i++) { g.fillStyle = ['#d8302a', '#2a5aa8', '#e8c830', '#f2eee4', '#3a8a4a', '#d8702a'][i]; g.fillRect(36 + (i % 3) * 30, 112 + ((i / 3) | 0) * 50, 24, 42); }   // posters and lottery slips
  g.fillStyle = '#2a2420'; g.fillRect(142, 104, 86, 122); g.fillStyle = 'rgba(210,225,240,.22)'; g.fillRect(146, 108, 78, 114); g.fillStyle = '#b8b09a'; g.fillRect(150, 150, 3, 22);
  g.fillStyle = '#16213c'; g.fillRect(190, 112, 30, 16); lettering(g, 'SALI', 205, 120, 10, '#f4f1e8', 26);
  g.fillStyle = '#b9ae98'; g.fillRect(12, 236, 232, 20); dado(g, 30, .35);
});
layer('g_pane', (g, r) => {   // panificio: cream plate with the name, a big lit window with loaves and trays, a wooden door
  plaster(g, r, '#e6dbc0', { peel: 0 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  g.fillStyle = '#7a4a22'; g.fillRect(26, 14, 204, 44); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(26, 14, 204, 3);
  lettering(g, 'PANIFICIO', 128, 37, 30, '#f6e2a8', 190);
  glassFront(g, 24, 74, 150, 150, '#fbe6a8', '#c08a44');
  for (const y of [112, 156, 198]) { g.fillStyle = '#6a4a2a'; g.fillRect(24, y, 150, 5); }
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const x = 34 + i * 24 + (row % 2) * 8, y = [100, 144, 186][row]; g.fillStyle = ['#b8742a', '#c88a3a', '#9a5a22', '#d8a458'][(i + row) % 4]; g.beginPath(); g.ellipse(x + 8, y + 6, 11, 7, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,230,160,.45)'; g.fillRect(x + 2, y + 1, 7, 2); }
  g.fillStyle = '#4a2c18'; g.fillRect(186, 74, 46, 150); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(190, 80, 38, 66); g.fillRect(190, 152, 38, 66); g.fillStyle = '#c9a24a'; g.fillRect(193, 148, 6, 5);
  g.fillStyle = '#b9ae98'; g.fillRect(12, 236, 232, 20); dado(g, 30, .3);
});
layer('g_bottega', (g, r) => {   // alimentari / frutta e verdura: shutter half up, a small awning, crates of produce on the pavement
  plaster(g, r, '#e0d6bc', { peel: 1 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  g.fillStyle = '#2f5a35'; g.fillRect(24, 12, 208, 36); lettering(g, 'FRUTTA E VERDURA', 128, 30, 20, '#f1e6c0', 196);
  g.fillStyle = '#6c6c6a'; g.fillRect(26, 52, 204, 20); g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = 55; y < 70; y += 4) g.fillRect(26, y, 204, 2);   // the shutter rolled up under its box
  g.fillStyle = '#241c14'; g.fillRect(26, 72, 204, 128);
  for (let i = 0; i < 7; i++) { g.fillStyle = PRODUCE[(r() * PRODUCE.length) | 0]; g.fillRect(34 + i * 28, 90 + (i % 2) * 22, 20, 16); }   // shelves inside
  g.fillStyle = 'rgba(255,220,140,.4)'; g.fillRect(26, 72, 204, 6);
  stripedAwning(g, 22, 80, 212, 22, '#d8721c', '#efe9d8');
  crateRow(g, r, 20, 240, 196, 52, PRODUCE);
  g.fillStyle = '#b9ae98'; g.fillRect(12, 244, 232, 12); dado(g, 24, .3);
});
layer('g_portone', (g, r) => {   // palazzo portone: ashlar jambs, a round arch with a carved keystone, two tall studded leaves shut
  plaster(g, r, '#ddd4be', { peel: 0 });
  ashlar(g, r, 0, 0, 56, T, '#ece4cf', 30, 56); ashlar(g, r, 200, 0, T, T, '#ece4cf', 30, 56);
  g.fillStyle = '#d4c9ae'; g.beginPath(); g.moveTo(52, T); g.lineTo(52, 112); g.arc(128, 112, 76, Math.PI, 0); g.lineTo(204, T); g.fill();   // the arch ring
  g.fillStyle = '#f2ead4'; g.fillRect(114, 22, 28, 28); g.fillStyle = 'rgba(60,45,30,.4)'; g.fillRect(114, 22, 2, 28); g.fillRect(140, 22, 2, 28);   // keystone
  g.fillStyle = '#3a2418'; g.beginPath(); g.moveTo(64, T); g.lineTo(64, 116); g.arc(128, 116, 64, Math.PI, 0); g.lineTo(192, T); g.fill();   // the wood
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(126, 56, 4, T - 56);
  for (const x of [72, 134]) for (let y = 112; y < T - 14; y += 24) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, 50, 18); g.fillStyle = '#b8924a'; for (const dx of [8, 24, 40]) g.fillRect(x + dx, y + 6, 3, 3); }   // panels and studs
  g.fillStyle = '#c9a24a'; g.fillRect(116, 150, 6, 22); g.fillRect(134, 150, 6, 22);                                                                      // ring handles
  g.fillStyle = '#d8d0b8'; g.fillRect(206, 120, 30, 42); g.fillStyle = '#4a4a46'; for (let i = 0; i < 4; i++) g.fillRect(212, 126 + i * 8, 18, 4);          // the buzzer plate
  g.fillStyle = '#b9ae98'; g.fillRect(40, T - 10, 176, 10); dado(g, 40, .35);
});
layer('g_farm', (g, r) => {   // farmacia: white plate with the green letters, the green cross, a window of boxes, a glass door
  plaster(g, r, '#dcd8cc', { peel: 0 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  g.fillStyle = '#f4f2ea'; g.fillRect(24, 14, 208, 46); g.strokeStyle = '#8a8a82'; g.lineWidth = 2; g.strokeRect(24, 14, 208, 46);
  lettering(g, 'FARMACIA', 150, 38, 30, '#1f8a46', 140);
  g.fillStyle = '#1f9a4c'; g.fillRect(36, 22, 14, 30); g.fillRect(28, 30, 30, 14);   // the cross
  glassFront(g, 28, 80, 112, 146, '#dce8e4', '#8aa098');
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) { g.fillStyle = ['#f4f2ea', '#3a78b8', '#1f8a46', '#e8e4d8', '#d8302a'][(i + row) % 5]; g.fillRect(36 + i * 20, 92 + row * 42, 14, 26); }
  g.fillStyle = '#6a6a66'; g.fillRect(28, 124, 112, 3); g.fillRect(28, 166, 112, 3);
  g.fillStyle = '#2a2a28'; g.fillRect(154, 80, 76, 146); g.fillStyle = 'rgba(210,230,236,.26)'; g.fillRect(158, 84, 68, 138); g.fillStyle = '#c8c8c0'; g.fillRect(162, 146, 3, 24);
  g.fillStyle = '#b9ae98'; g.fillRect(12, 236, 232, 20); dado(g, 30, .3);
});
function marketFront(g, r, o) {   // the shutter rolled up, the front open to the street: goods on shelves and hooks, bulbs, crates on the ground
  plaster(g, r, '#dcd2ba', { peel: 1 });
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 10, T); g.fillRect(T - 10, 0, 10, T);
  g.fillStyle = o.sign; g.fillRect(22, 14, 212, 32); lettering(g, o.name, 128, 30, 20, '#f4ecd0', 200);
  g.fillStyle = '#6c6c6a'; g.fillRect(22, 50, 212, 22); g.fillStyle = 'rgba(0,0,0,.32)'; for (let y = 53; y < 70; y += 4) g.fillRect(22, y, 212, 2);   // the rolled shutter
  g.fillStyle = '#4b4b49'; g.fillRect(22, 70, 212, 4);
  g.fillStyle = '#1e1812'; g.fillRect(22, 74, 212, 150);
  const gr = g.createLinearGradient(0, 74, 0, 224); gr.addColorStop(0, 'rgba(255,214,140,.45)'); gr.addColorStop(1, 'rgba(120,80,40,.1)'); g.fillStyle = gr; g.fillRect(22, 74, 212, 150);
  for (let i = 0; i < 9; i++) { g.fillStyle = '#fff0bc'; g.fillRect(30 + i * 24, 78, 6, 6); }   // string of bulbs
  o.inside(g, r);
  if (o.awn) stripedAwning(g, 18, 84, 220, 22, o.awn[0], o.awn[1]);
  o.front(g, r);
  g.fillStyle = '#b9ae98'; g.fillRect(10, 244, 236, 12); dado(g, 24, .3);
}
layer('g_mk_a', (g, r) => marketFront(g, r, { name: 'FRUTTA', sign: '#2f5a35', awn: ['#c8281e', '#efe9d8'],
  inside: (g, r) => { for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) { g.fillStyle = PRODUCE[(r() * PRODUCE.length) | 0]; g.fillRect(30 + i * 26, 120 + row * 26, 20, 16); } },
  front: (g, r) => crateRow(g, r, 16, 244, 196, 54, PRODUCE) }));
layer('g_mk_b', (g, r) => marketFront(g, r, { name: 'MACELLERIA', sign: '#7a1f24', awn: null,
  inside: (g, r) => { g.fillStyle = '#d8d4c8'; g.fillRect(30, 190, 196, 34); for (let i = 0; i < 10; i++) { g.fillStyle = ['#8a3a2c', '#c46a58', '#7a2c24', '#b85a48'][i % 4]; const x = 36 + i * 19, l = 36 + (i % 3) * 14; g.fillRect(x, 92, 8, l); g.fillStyle = '#e8e0d0'; g.fillRect(x + 3, 88, 2, 6); } for (let i = 0; i < 4; i++) { g.fillStyle = '#e6c866'; g.beginPath(); g.ellipse(52 + i * 46, 206, 16, 8, 0, 0, 6.3); g.fill(); } },
  front: (g, r) => { g.fillStyle = '#efe9d8'; g.fillRect(24, 214, 208, 30); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(24, 240, 208, 4); for (let i = 0; i < 6; i++) { g.fillStyle = ['#b83030', '#c85048', '#e8a8a0'][i % 3]; g.fillRect(34 + i * 33, 218, 26, 14); } } }));
layer('g_mk_c', (g, r) => marketFront(g, r, { name: 'PESCHERIA', sign: '#1f4a72', awn: ['#2a5aa0', '#efe9d8'],
  inside: (g, r) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#b8c4cc', '#6c8ca8', '#d8604a', '#e8a8a0'][i % 4]; g.beginPath(); g.ellipse(46 + i * 24, 150 + (i % 2) * 10, 12, 5, 0, 0, 6.3); g.fill(); } g.fillStyle = 'rgba(210,230,240,.35)'; g.fillRect(30, 178, 196, 30); },
  front: (g, r) => { g.fillStyle = '#dfe9ee'; g.fillRect(22, 206, 212, 38); g.fillStyle = '#f4f8fa'; g.fillRect(24, 206, 208, 6); for (let i = 0; i < 9; i++) { g.fillStyle = ['#b8c4cc', '#6c8ca8', '#d8604a', '#e8a8a0', '#8aa0b0'][i % 5]; g.beginPath(); g.ellipse(40 + i * 22, 218 + (i % 3) * 6, 10, 4, 0, 0, 6.3); g.fill(); } } }));

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

// ---- church / civic stone
// Church walls, drawn the way a Palermo church wall reads from the street: dressed limestone in fine courses, a pilaster at each bay edge (half a pier on each side of the tile, so two bays meet in one),
// a plinth, a deep modillion cornice with the tall arched clerestory window under it, a monumental portal with a pediment and a rose window over it. One storey of the nave wall is 6.4 m (a tile).
// (ch_low stays the plain ashlar of every stone building's party walls; the church ground floor is ch_base.)
layer('ch_low', (g, r) => { ashlar(g, r, 0, 0, T, T, '#e6e1d3', 36, 72); dado(g, 50, .35); for (let i = 0; i < 4; i++) streak(g, r() * T, r() * 60, 120, 10, .12); });
function chStone(g, r) {   // dressed limestone: tight courses, soft warm and cool wash, damp bands, a few lighter replacement stones
  ashlar(g, r, 0, 0, T, T, '#eae5d7', 32, 64, .13);
  softNoise(g, r, 3, '150,112,80', .1); softNoise(g, r, 6, '98,84,66', .1); softNoise(g, r, 3, '60,52,44', .08, 2.4); softNoise(g, r, 11, '255,252,240', .08);
  for (let i = 0; i < 5; i++) { const x = ((r() * 4) | 0) * 64 + 3, y = ((r() * 8) | 0) * 32 + 2; g.fillStyle = 'rgba(255,248,226,.16)'; g.fillRect(x, y, 61, 30); }
}
function chPiers(g, w = 15, cap = 0) {   // half a pilaster on each side of the tile: lit left edge, shaded right edge and a soft shadow thrown on the wall to the right of it; cap: y of its capital (0: none)
  for (const x of [0, T - w]) {
    g.fillStyle = 'rgba(255,250,236,.17)'; g.fillRect(x, 0, w, T);
    if (x) { g.fillStyle = 'rgba(255,252,240,.5)'; g.fillRect(x, 0, 2.2, T); }
    else { g.fillStyle = 'rgba(50,38,24,.42)'; g.fillRect(w - 2.8, 0, 2.8, T); const gr = g.createLinearGradient(w, 0, w + 14, 0); gr.addColorStop(0, 'rgba(40,30,18,.26)'); gr.addColorStop(1, 'rgba(40,30,18,0)'); g.fillStyle = gr; g.fillRect(w, 0, 14, T); }
    if (cap) { g.fillStyle = 'rgba(255,250,236,.4)'; g.fillRect(x - (x ? 4 : 0), cap, w + 4, 9); g.fillStyle = 'rgba(40,30,18,.42)'; g.fillRect(x - (x ? 4 : 0), cap + 9, w + 4, 3); }
  }
}
function chGlass(g, x, y, w, h) {   // dark glass with a faint reflection, bluish dark so the night shader lights it
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(200,215,230,.13)'; g.beginPath(); g.moveTo(x, y + h * .6); g.lineTo(x + w * .6, y); g.lineTo(x + w, y); g.lineTo(x, y + h * .95); g.fill();
}
layer('ch_base', (g, r) => {   // the church ground floor: courses of ashlar, a moulded plinth, a stone string course along the top; mostly blind
  chStone(g, r);
  chPiers(g);
  g.fillStyle = 'rgba(70,56,40,.22)'; g.fillRect(0, T - 52, T, 52);                                       // plinth: darker, grimed stone
  g.fillStyle = '#ece5d1'; g.fillRect(0, T - 58, T, 7); g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(0, T - 58, T, 1.6); g.fillStyle = 'rgba(40,30,20,.36)'; g.fillRect(0, T - 51, T, 4);
  for (let i = 0; i < 3; i++) streak(g, r() * T, r() * 80, 130, 10, .13);
  g.fillStyle = '#ece5d1'; g.fillRect(0, 0, T, 6); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, 6, T, 4);   // the string course that closes the ground floor
});
layer('ch_mid', (g, r) => { chStone(g, r); chPiers(g); for (let i = 0; i < 3; i++) streak(g, 40 + r() * 170, r() * 120, 120, 10, .13); });   // plain pilastered nave wall (also the church's party walls)
layer('ch_top', (g, r) => {   // the clerestory: a modillion cornice under the roof, a tall round-arched window with a moulded surround and a keystone, a sill
  chStone(g, r);
  chPiers(g, 15, 34);
  const gr = g.createLinearGradient(0, 40, 0, 96); gr.addColorStop(0, 'rgba(40,30,18,.34)'); gr.addColorStop(1, 'rgba(40,30,18,0)'); g.fillStyle = gr; g.fillRect(0, 40, T, 56);   // the cornice's shadow on the wall
  g.fillStyle = '#efe9d6'; g.fillRect(0, 0, T, 10); g.fillStyle = 'rgba(255,255,250,.6)'; g.fillRect(0, 0, T, 2); g.fillStyle = 'rgba(40,30,18,.3)'; g.fillRect(0, 10, T, 5);
  g.fillStyle = '#e4dcc6'; g.fillRect(0, 15, T, 24);
  for (let x = 4; x < T; x += 16) { g.fillStyle = '#efe9d6'; g.fillRect(x, 15, 9, 19); g.fillStyle = 'rgba(40,30,18,.4)'; g.fillRect(x + 9, 15, 3, 19); g.fillStyle = 'rgba(40,30,18,.28)'; g.fillRect(x - 1, 34, 11, 5); }
  g.fillStyle = 'rgba(255,255,250,.45)'; g.fillRect(0, 39, T, 2); g.fillStyle = 'rgba(40,30,18,.38)'; g.fillRect(0, 41, T, 3);
  const cx = 128, sp = 128, hw = 30, sill = 214, fr = 12;
  g.save(); g.shadowColor = 'rgba(40,30,20,.45)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4; g.fillStyle = '#efe8d5'; archPath(g, cx, sp, hw + fr, sill + fr); g.fill(); g.restore();
  g.fillStyle = '#efe8d5'; archPath(g, cx, sp, hw + fr, sill + fr); g.fill();
  g.fillStyle = 'rgba(255,252,240,.5)'; g.fillRect(cx - hw - fr, sp, 2.5, sill - sp + fr); g.fillStyle = 'rgba(60,45,30,.3)'; g.fillRect(cx + hw + fr - 2.5, sp, 2.5, sill - sp + fr);
  g.fillStyle = '#16120f'; archPath(g, cx, sp, hw, sill); g.fill();
  g.save(); archPath(g, cx, sp, hw - 5, sill); g.clip(); chGlass(g, cx - hw, sp - hw, hw * 2, sill - sp + hw); g.fillStyle = '#e4ddcc'; g.fillRect(cx - 1.5, sp - hw, 3, sill - sp + hw); g.fillRect(cx - hw, sp + 28, hw * 2, 2.5); g.restore();
  g.fillStyle = '#e4dbc2'; g.beginPath(); g.moveTo(cx - 10, sp - hw - fr + 3); g.lineTo(cx + 10, sp - hw - fr + 3); g.lineTo(cx + 13, sp - hw - fr - 12); g.lineTo(cx - 13, sp - hw - fr - 12); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,45,30,.5)'; g.lineWidth = 1.4; g.stroke();   // keystone
  g.fillStyle = '#f2ecdd'; g.fillRect(cx - hw - fr - 7, sill + fr, 2 * (hw + fr) + 14, 7); g.fillStyle = 'rgba(40,30,20,.4)'; g.fillRect(cx - hw - fr - 7, sill + fr + 7, 2 * (hw + fr) + 14, 4);
  g.fillStyle = 'rgba(70,58,44,.16)'; g.fillRect(cx - hw - fr, sill + fr + 11, 2 * (hw + fr), 28);
  for (let i = 0; i < 2; i++) streak(g, 40 + r() * 170, 120 + r() * 60, 90, 10, .12);
});
layer('ch_door', (g, r) => {   // the portal: two columns on plinths carrying an entablature and a curved pediment, wooden doors under a glazed lunette, three steps
  chStone(g, r); chPiers(g);
  const cx = 128;
  g.save(); g.shadowColor = 'rgba(40,30,20,.45)'; g.shadowBlur = 7; g.shadowOffsetX = 4; g.shadowOffsetY = 4; g.fillStyle = '#efe8d5'; g.fillRect(36, 70, 184, T - 70); g.restore();   // the aedicule stands proud
  g.fillStyle = '#ece4cf'; g.fillRect(36, 70, 184, T - 70);
  for (const x of [38, 186]) {   // columns: lit and shaded side, capital, base
    const cg = g.createLinearGradient(x, 0, x + 32, 0); cg.addColorStop(0, '#f6f0df'); cg.addColorStop(.4, '#eae2cd'); cg.addColorStop(1, '#a89f8a'); g.fillStyle = cg; g.fillRect(x, 92, 32, T - 92);
    g.fillStyle = '#efe8d5'; g.fillRect(x - 4, 86, 40, 10); g.fillStyle = 'rgba(40,30,18,.4)'; g.fillRect(x - 4, 96, 40, 3); g.fillStyle = '#e0d7c0'; g.fillRect(x - 5, T - 28, 42, 28); g.fillStyle = 'rgba(40,30,18,.3)'; g.fillRect(x - 5, T - 28, 42, 3);
  }
  g.fillStyle = '#efe8d5'; g.fillRect(28, 62, 200, 26); g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(28, 62, 200, 2); g.fillStyle = 'rgba(40,30,18,.4)'; g.fillRect(28, 88, 200, 4);   // entablature
  g.fillStyle = 'rgba(40,30,18,.26)'; g.beginPath(); g.moveTo(26, 64); g.quadraticCurveTo(cx, 6, 230, 64); g.closePath(); g.fill();   // pediment: shadow, stone, dark tympanum
  g.fillStyle = '#efe8d5'; g.strokeStyle = 'rgba(60,45,30,.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(24, 62); g.quadraticCurveTo(cx, 0, 232, 62); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(70,55,40,.42)'; g.beginPath(); g.moveTo(44, 58); g.quadraticCurveTo(cx, 18, 212, 58); g.closePath(); g.fill();
  g.fillStyle = '#e4dbc2'; g.beginPath(); g.arc(cx, 40, 8, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,45,30,.5)'; g.stroke();
  g.fillStyle = '#16120f'; archPath(g, cx, 130, 38, T - 18); g.fill();   // the doorway: dark arched opening, glazed lunette, two timber leaves
  g.save(); archPath(g, cx, 130, 33, T - 18); g.clip(); chGlass(g, cx - 38, 92, 76, 40); oleaf(g, r, cx - 38, 138, 38, T - 156, WOOD[0]); oleaf(g, r, cx, 138, 38, T - 156, WOOD[0]); g.fillStyle = '#e4ddcc'; g.fillRect(cx - 38, 134, 76, 5); g.restore();
  g.fillStyle = 'rgba(255,252,240,.4)'; g.fillRect(cx - 41, 128, 3, T - 146); g.fillStyle = 'rgba(40,30,18,.4)'; g.fillRect(cx + 38, 128, 3, T - 146);
  for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#d8cfb8' : '#e6dec9'; g.fillRect(24 - i * 4, T - 18 + i * 6, 208 + i * 8, 6); g.fillStyle = 'rgba(40,30,18,.3)'; g.fillRect(24 - i * 4, T - 18 + i * 6 + 5, 208 + i * 8, 1.5); }   // steps
});
layer('ch_rose', (g, r) => {   // the storey over the portal: a rose window in a stone ring with spokes, pier edges either side
  chStone(g, r); chPiers(g);
  const cx = 128, cy = 128, R = 54;
  g.save(); g.shadowColor = 'rgba(40,30,20,.45)'; g.shadowBlur = 7; g.shadowOffsetX = 4; g.shadowOffsetY = 4; g.fillStyle = '#efe8d5'; g.beginPath(); g.arc(cx, cy, R + 13, 0, 7); g.fill(); g.restore();
  g.fillStyle = '#efe8d5'; g.beginPath(); g.arc(cx, cy, R + 13, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,45,30,.4)'; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, R + 8, 0, 7); g.stroke();
  g.fillStyle = '#16120f'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R - 5, 0, 7); g.clip(); chGlass(g, cx - R, cy - R, 2 * R, 2 * R); g.restore();
  g.strokeStyle = '#e4ddcc'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  g.beginPath(); g.arc(cx, cy, R * .5, 0, 7); g.stroke(); g.fillStyle = '#e4ddcc'; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
  g.fillStyle = 'rgba(70,58,44,.16)'; g.fillRect(cx - R - 10, cy + R + 16, 2 * R + 20, 24);
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

// ---- district layers: Liberty villas, 1960s-70s "sacco di Palermo" blocks, ZEN insulae, fishermen's houses, sheds and silos, ruins, beach clubs.
// Colours here stay light and neutral where the zone palette should tint them (see the atlas shader); shutters, awnings and ironwork are painted at full colour.
Object.assign(SH, { l: ['#4f7a9e', '#3a5c7a'], w: ['#ebe7dc', '#cfc9ba'], d: ['#6a4a30', '#4a3220'], p: ['#6f8f62', '#566f4c'], s: ['#9a8466', '#7c6a50'] });
function tapp(g, x, y, w, h, col) { // roller blind (tapparella): slats, dark gaps, bottom bar
  g.fillStyle = col; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,.26)'; for (let yy = y + 4; yy < y + h - 4; yy += 6) g.fillRect(x, yy, w, 2);
  g.fillStyle = 'rgba(255,255,255,.1)'; for (let yy = y + 6; yy < y + h - 4; yy += 6) g.fillRect(x, yy, w, 1);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, y + h - 5, w, 5); g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
}
function awnDrop(g, x, y, w, h, c1, c2 = '#f2eee4') { // vertical drop awning (tenda a caduta), striped, scalloped hem
  const n = 8, sw = w / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(x + i * sw, y, sw + .5, h); g.beginPath(); g.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, Math.PI); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y, w, 5); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + w - 6, y, 6, h);
}
function acUnit(g, x, y) { g.fillStyle = '#eceae4'; g.fillRect(x, y, 44, 24); g.fillStyle = '#9a9a94'; g.fillRect(x + 4, y + 8, 36, 2.5); g.fillRect(x + 4, y + 14, 36, 2.5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 24, 44, 4); }
function shutterBox(g, x, y, w, h = 22) { g.fillStyle = '#d9d3c4'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + h, w, 4); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, y, w, 2); }

layer('rail_c', (g, r) => { // 1960s balcony: solid painted parapet below, thin iron bars above, flower pots
  g.clearRect(0, 0, T, T);
  g.fillStyle = '#e9e5db'; g.fillRect(0, 100, T, T - 100);
  g.fillStyle = '#f6f3ea'; g.fillRect(0, 92, T, 10); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 102, T, 5);
  g.fillStyle = 'rgba(70,60,50,.1)'; for (let i = 0; i < 5; i++) g.fillRect(r() * T, 108 + r() * 120, 30 + r() * 60, 40);
  g.fillStyle = '#34343a'; g.fillRect(0, 10, T, 9);
  for (let x = 8; x < T; x += 24) g.fillRect(x, 19, 4, 74);
  for (const x of [40 + r() * 40, 150 + r() * 60]) { g.fillStyle = '#4f7a3a'; g.beginPath(); g.arc(x, 82, 14, 0, 6.3); g.arc(x + 12, 76, 10, 0, 6.3); g.fill(); g.fillStyle = '#8a5a40'; g.fillRect(x - 10, 90, 22, 14); }
});
layer('rail_g', (g, r) => { // 1990s+ balcony: anodised aluminium frame, tinted glass panels, a low solid kerb (Lazio, Strasburgo, Uditore condos)
  g.clearRect(0, 0, T, T);
  g.fillStyle = '#e4e1d8'; g.fillRect(0, 214, T, T - 214); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 214, T, 4);
  g.fillStyle = '#8f9894'; g.fillRect(0, 10, T, 8); g.fillStyle = '#7d8682'; g.fillRect(0, 202, T, 12);
  for (let x = 0; x < T; x += 64) {
    const gr = g.createLinearGradient(x, 18, x + 64, 202); gr.addColorStop(0, '#9fb8b2'); gr.addColorStop(.5, '#7f9a98'); gr.addColorStop(1, '#a9bfba');
    g.fillStyle = gr; g.fillRect(x + 3, 18, 58, 184);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x + 6, 190); g.lineTo(x + 34, 24); g.lineTo(x + 48, 24); g.lineTo(x + 18, 196); g.fill();
    g.fillStyle = '#8f9894'; g.fillRect(x, 18, 4, 184);
  }
  g.fillStyle = '#8f9894'; g.fillRect(T - 4, 18, 4, 184);
});
layer('rail_l', (g) => { // Liberty ironwork: whiplash curves and lyre scrolls
  g.clearRect(0, 0, T, T); g.fillStyle = '#26262c'; g.strokeStyle = '#26262c';
  g.fillRect(0, 12, T, 9); g.fillRect(0, T - 22, T, 11);
  for (let x = 0; x < T; x += 64) {
    g.lineWidth = 5; g.beginPath(); g.moveTo(x + 2, 21); g.lineTo(x + 2, T - 22); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x + 32, 40); g.bezierCurveTo(x + 62, 60, x + 8, 120, x + 32, 150); g.bezierCurveTo(x + 50, 175, x + 48, 205, x + 30, 214); g.stroke();
    g.beginPath(); g.moveTo(x + 32, 40); g.bezierCurveTo(x + 2, 60, x + 56, 120, x + 32, 150); g.bezierCurveTo(x + 14, 175, x + 16, 205, x + 34, 214); g.stroke();
    g.beginPath(); g.arc(x + 32, 36, 6, 0, 6.3); g.fill();
    g.lineWidth = 3; g.beginPath(); g.arc(x + 32, 224, 9, 0, 6.3); g.stroke();
  }
});

// ---- Liberty (stile floreale): ornate stucco frames, whiplash lintels, polychrome bands, wooden doors
function libFrame(g, x, y, w, h, c = '#f4eedc') { // window with a segmental floral hood
  g.fillStyle = c; g.beginPath(); g.moveTo(x - 12, y + h + 6); g.lineTo(x - 12, y - 2); g.quadraticCurveTo(x + w / 2, y - 40, x + w + 12, y - 2); g.lineTo(x + w + 12, y + h + 6); g.fill();
  g.fillStyle = 'rgba(60,45,30,.3)'; g.beginPath(); g.moveTo(x - 4, y + h); g.lineTo(x - 4, y + 2); g.quadraticCurveTo(x + w / 2, y - 24, x + w + 4, y + 2); g.lineTo(x + w + 4, y + h); g.fill();
  g.fillStyle = '#f9f4e6'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + w * (0.1 + 0.2 * i), y - 12 + Math.sin(i / 4 * 3.14) * -8, 4, 0, 6.3); g.fill(); }
}
layer('lib_up_a', (g, r) => {
  plaster(g, r, '#e8dfca', { peel: 0 });
  g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T); g.fillStyle = 'rgba(60,45,30,.25)'; g.fillRect(14, 0, 3, T); g.fillRect(T - 17, 0, 3, T);
  libFrame(g, 88, 70, 80, 130);
  win(g, 88, 70, 80, 130, { sh: 'g', st: 'open', fr: 5, frc: '#f3ecd8', sill: false });
  g.fillStyle = '#c9a24a'; g.fillRect(0, 12, T, 6); g.fillStyle = '#4f7a6a'; for (let x = 4; x < T; x += 22) { g.beginPath(); g.arc(x + 8, 30, 6, 0, 6.3); g.fill(); } // majolica frieze
  g.fillStyle = '#f1eadb'; g.fillRect(0, T - 14, T, 14); streak(g, 98, 205, 40, 9); streak(g, 160, 205, 40, 8);
});
layer('lib_up_b', (g, r) => { // twin arched windows on a slender column (bifora)
  plaster(g, r, '#e8dfca', { peel: 1 });
  g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, 12, T); g.fillRect(T - 12, 0, 12, T);
  for (const x of [66, 146]) {
    g.fillStyle = '#f5efde'; g.beginPath(); g.moveTo(x - 8, 210); g.lineTo(x - 8, 100); g.arc(x + 22, 100, 30, Math.PI, 0); g.lineTo(x + 52, 210); g.fill();
    g.fillStyle = '#26303a'; g.beginPath(); g.moveTo(x, 210); g.lineTo(x, 102); g.arc(x + 22, 102, 22, Math.PI, 0); g.lineTo(x + 44, 210); g.fill();
    g.fillStyle = '#e6dfcf'; g.fillRect(x + 20, 102, 3, 108);
  }
  g.fillStyle = '#d8cfb8'; g.fillRect(122, 96, 8, 120); g.fillStyle = '#f2ebd8'; g.fillRect(118, 90, 16, 8);
  g.fillStyle = '#4f7a6a'; for (let x = 4; x < T; x += 22) { g.beginPath(); g.arc(x + 8, 30, 5, 0, 6.3); g.fill(); }
  band(g, T - 9, 6, '#f2ecdd'); streak(g, 76, 210, 40, 9);
});
layer('lib_nob', (g, r) => { // piano nobile: tall window under a carved hood, garland
  plaster(g, r, '#e8dfca', { peel: 0 });
  g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T);
  libFrame(g, 78, 66, 100, 168, '#f6f0df');
  win(g, 78, 66, 100, 168, { sh: 'g', st: 'open', fr: 6, frc: '#f6f0df', sill: false });
  g.strokeStyle = '#6f8a5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 24); g.quadraticCurveTo(128, 60, 216, 24); g.stroke();
  g.fillStyle = '#c9a24a'; g.fillRect(0, 6, T, 5);
  band(g, T - 8, 5, '#f1ead8'); streak(g, 90, 236, 20, 9);
});
layer('g_lib', (g, r) => { // rusticated base, arched window with iron grille, carved doorway
  ashlar(g, r, 0, 0, T, T, '#e2dac6', 34, 68, .3);
  g.fillStyle = '#d7ceb6'; g.beginPath(); g.moveTo(40, T); g.lineTo(40, 112); g.arc(128, 112, 88, Math.PI, 0); g.lineTo(216, T); g.fill();
  g.fillStyle = '#4a3322'; g.beginPath(); g.moveTo(54, T); g.lineTo(54, 116); g.arc(128, 116, 74, Math.PI, 0); g.lineTo(202, T); g.fill();
  g.fillStyle = '#8a7a5a'; g.beginPath(); g.arc(128, 100, 54, Math.PI, 0); g.lineTo(182, 118); g.lineTo(74, 118); g.fill();
  g.fillStyle = '#1d242a'; g.beginPath(); g.arc(128, 104, 46, Math.PI, 0); g.lineTo(174, 118); g.lineTo(82, 118); g.fill();
  g.strokeStyle = '#c9a24a'; g.lineWidth = 3; for (let x = 92; x < 170; x += 14) { g.beginPath(); g.moveTo(x, 118); g.lineTo(x, 66); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(126, 130, 4, T - 130);
  g.fillStyle = '#b9ae98'; g.fillRect(34, T - 10, 188, 10); dado(g, 40, .35);
});

// ---- post-war blocks, 1950s to 1980s (sacco di Palermo): a concrete frame with render panels, a French window and a deep balcony in the living-room bay, plain windows in the others, tapparelle in every state.
// Variants are gathered in groups (PWD balcony-door bays, PWW plain bays, PWBD and PWBW the same on exposed brick, PWG shop fronts); the shader picks one per bay and floor. Balconies are geometry (buildings.js, pwBalc).
function pwRender(g, r) {   // the render panel of one flat: neutral light render (no warm blotches, the building colour tints it), a lighter slab band at the foot, a shadow under the slab above
  g.fillStyle = '#ebe8e1'; g.fillRect(0, 0, T, T); softNoise(g, r, 5, '110,102,92', .14); softNoise(g, r, 9, '255,255,250', .2); softNoise(g, r, 3, '70,66,60', .14, 2.4);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? 'rgba(80,74,66,.10)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * T, r() * T, 1 + r() * 1.6, 1 + r() * 1.6); }
  g.fillStyle = '#f3f0e8'; g.fillRect(0, T - 24, T, 24); g.fillStyle = 'rgba(40,34,28,.3)'; g.fillRect(0, T - 24, T, 3);
  const gr = g.createLinearGradient(0, 0, 0, 34); gr.addColorStop(0, 'rgba(40,34,28,.22)'); gr.addColorStop(1, 'rgba(40,34,28,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 34);
  for (let i = 0; i < 2; i++) streak(g, 20 + r() * 216, 0, 60 + r() * 90, 6 + r() * 12, .1);
  pwFrame(g, r);
}
// [texround2] the concrete frame of a post-war block: a pier on each side of the bay (two of them side by side between flats), a shade darker and greyer than the painted infill, board marks, a shadow line where the infill is set back,
// and a rust stain at the foot of the pier. The slab band is already at the foot of the tile.
function pwFrame(g, r, pw = 17) {
  for (const x of [0, T - pw]) {
    g.fillStyle = 'rgba(122,118,108,.34)'; g.fillRect(x, 0, pw, T);
    g.fillStyle = 'rgba(40,36,30,.07)'; for (let y = 6; y < T; y += 9 + (r() * 4 | 0)) g.fillRect(x, y, pw, 1.4);   // board marks
    g.fillStyle = 'rgba(30,26,20,.3)'; g.fillRect(x === 0 ? pw : x - 2.5, 0, 2.5, T - 24);                           // the infill set back from the pier
    g.fillStyle = 'rgba(255,255,248,.22)'; g.fillRect(x === 0 ? 0 : T - 2, 0, 2, T);
    if (r() < .6) streak(g, x + pw / 2, T - 24 - 50, 56 + r() * 40, 4 + r() * 4, .2);
  }
}
function sillStain(g, r, x, y, w, k = 1) {   // rain runs off a sill and leaves two or three dirty streaks below it, wider at the ends
  for (let i = 0; i < 3; i++) { const sx = x + (i === 1 ? .5 : i === 0 ? .08 : .92) * w + (r() - .5) * 6; streak(g, sx, y, (36 + r() * 70) * k, 5 + r() * 9, .13 + r() * .1); }
}
function potRow(g, r, x, y, n = 3) {   // flower pots on a ledge
  for (let i = 0; i < n; i++) { const px = x + i * 22 + r() * 6; g.fillStyle = '#a4573a'; g.fillRect(px, y - 11, 14, 11); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px, y - 3, 14, 3);
    g.fillStyle = ['#4f7a3a', '#5f8a45', '#3f6a30'][(r() * 3) | 0]; g.beginPath(); g.arc(px + 7, y - 15, 8, 0, 6.3); g.arc(px + 2, y - 11, 5, 0, 6.3); g.arc(px + 12, y - 11, 5, 0, 6.3); g.fill(); if (r() < .5) { g.fillStyle = ['#c8302a', '#e8c830', '#e8e4d8'][(r() * 3) | 0]; g.beginPath(); g.arc(px + 4 + r() * 6, y - 18, 2.4, 0, 6.3); g.fill(); } }
}
function dishAt(g, x, y) { g.fillStyle = '#d6d4cc'; g.beginPath(); g.ellipse(x, y, 14, 11, -0.5, 0, 6.3); g.fill(); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 2, y + 1, 8, 6, -0.5, 0, 6.3); g.fill(); g.fillStyle = '#6a6a66'; g.fillRect(x + 9, y - 9, 2, 14); g.fillRect(x - 1, y + 9, 3, 9); }   // a satellite dish
function grilleAt(g, x, y, w, h) { g.fillStyle = '#26262a'; for (let xx = x + 3; xx < x + w; xx += 11) g.fillRect(xx, y, 3, h); g.fillRect(x, y + h * .4, w, 3); g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3); }   // iron window grille
const BRICKS = ['#a65e46', '#9a5440', '#b06a4e', '#8f4f3c', '#b87454', '#a0604a', '#9c7a62'];
function pwBrick(g, r) {   // exposed facing brick (klinker) in running bond, a concrete slab band at the foot
  g.fillStyle = '#b9ae9e'; g.fillRect(0, 0, T, T);
  const rows = 42, rh = T / rows, nb = 13, bw = T / nb;
  for (let j = 0; j < rows; j++) for (let i = 0; i < nb; i++) {
    const x = i * bw + (j % 2) * bw / 2, c = BRICKS[(r() * BRICKS.length) | 0];
    g.fillStyle = c; g.fillRect(x + .8, j * rh + .6, bw - 1.6, rh - 1.2); if (x + bw > T) g.fillRect(x - T + .8, j * rh + .6, bw - 1.6, rh - 1.2);
  }
  softNoise(g, r, 6, '40,20,10', .18); softNoise(g, r, 4, '255,240,220', .1);
  g.fillStyle = '#d9d5ca'; g.fillRect(0, T - 24, T, 24); g.fillStyle = 'rgba(40,34,28,.3)'; g.fillRect(0, T - 24, T, 3);
  const gr = g.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, 'rgba(30,20,14,.28)'); gr.addColorStop(1, 'rgba(30,20,14,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 30);
}
function pwWin(g, r, x, y, w, h, o = {}) {   // a flat's window or French window: frame set in the wall, glass, then tapparella, louvred shutters, curtain
  const fr = o.fr ?? 5, fc = o.frame || '#e4e0d4';
  g.fillStyle = 'rgba(30,24,18,.34)'; g.fillRect(x - fr + 3, y - fr + 4, w + 2 * fr, h + 2 * fr);
  g.fillStyle = fc; g.fillRect(x - fr, y - fr, w + 2 * fr, h + 2 * fr);
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(200,215,230,.15)'; g.beginPath(); g.moveTo(x, y + h * .55); g.lineTo(x + w * .6, y); g.lineTo(x + w, y); g.lineTo(x, y + h * .9); g.fill();
  g.fillStyle = fc; const n = o.leaves || 1; for (let i = 1; i < n; i++) g.fillRect(x + w * i / n - 1.5, y, 3, h);
  if (o.door) g.fillRect(x, y + h * .22, w, 3);
  if (o.curt) { g.fillStyle = 'rgba(240,235,222,.6)'; g.fillRect(x, y, w * o.curt, h * .8); }
  if (o.blind) { shutterBox(g, x - fr, y - fr - 17, w + 2 * fr, 17); tapp(g, x - 1, y - 2, w + 2, h * o.down + 2, o.blind); }
  if (o.perc) { const c = SH[o.perc], lw = w / 2 + .5; if (o.pst === 'open') { leaf(g, x - fr - lw, y, lw, h, c); leaf(g, x + w + fr, y, lw, h, c); } else { leaf(g, x, y, lw, h, c); leaf(g, x + w - lw, y, lw, h, c); } }
  if (o.sill) { sillStain(g, r, x - fr, y + h + fr + 8, w + 2 * fr); g.fillStyle = '#eeeae0'; g.fillRect(x - fr - 5, y + h + fr, w + 2 * fr + 10, 6); g.fillStyle = 'rgba(30,20,10,.35)'; g.fillRect(x - fr - 5, y + h + fr + 6, w + 2 * fr + 10, 3); }
  if (o.grille) grilleAt(g, x, y, w, h);
}
function pwLaundry(g, r, y) { g.strokeStyle = '#555'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, y); g.lineTo(216, y + 5); g.stroke(); const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2', '#6aa05a']; for (let i = 0; i < 5; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(48 + i * 34, y + 1 + i, 16 + r() * 10, 26 + r() * 20); } }
const PWBL = ['#7f8588', '#7a5a3e', '#4d6a4e', '#8c8a80', '#6a4e3a'];   // tapparella colours: grey, brown, green, putty, dark brown
const pwBl = r => PWBL[(r() * PWBL.length) | 0];
const PWD = [   // bays with the balcony door
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, blind: pwBl(r), down: 1 }); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, blind: pwBl(r), down: .45 }); acUnit(g, 186, 96); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, curt: .5, perc: r() < .5 ? 'w' : 'g', pst: 'open' }); },
  (g, r) => { pwRender(g, r); g.fillStyle = '#d8dad6'; g.fillRect(34, 62, 188, 172); const gr = g.createLinearGradient(0, 68, 0, 230); gr.addColorStop(0, '#6a7f94'); gr.addColorStop(1, '#222d3a'); g.fillStyle = gr; g.fillRect(40, 68, 176, 162);   // a balcony closed in with aluminium and glass (veranda)
    g.fillStyle = '#d8dad6'; for (const x of [84, 128, 172]) g.fillRect(x - 2, 68, 4, 162); g.fillRect(40, 124, 176, 4); g.fillStyle = 'rgba(240,235,222,.55)'; g.fillRect(44, 72, 38, 100); g.fillRect(132, 72, 36, 70); g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(40, 220); g.lineTo(120, 68); g.lineTo(150, 68); g.lineTo(40, 230); g.fill(); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, blind: pwBl(r), down: .2 }); pwLaundry(g, r, 128); },
  // [texround2] more bays with the balcony door, so a column of balconies does not repeat one flat
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, perc: 'w', pst: 'open', curt: .3 }); potRow(g, r, 26, T - 24, 2); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, blind: '#4d6a4e', down: 1 }); acUnit(g, 186, 70); dishAt(g, 38, 88); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 66, 88, 168, { door: 1, leaves: 2, curt: .35 }); awnDrop(g, 66, 46, 124, 70 + r() * 40, ['#c9803a', '#2f6a8a', '#b8322e', '#d8c070'][(r() * 4) | 0]); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, blind: '#8c8a80', down: .75 }); g.fillStyle = '#eceae4'; g.fillRect(30, 150, 26, 22); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(30, 172, 26, 3); g.fillStyle = '#7a8088'; g.fillRect(34, 156, 18, 2.5); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 58, 88, 176, { door: 1, leaves: 2, perc: 'g', pst: 'closed' }); pwLaundry(g, r, 112); },
];
const PWW = [   // plain bays
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 70, 88, 118, { blind: pwBl(r), down: .7, sill: 1 }); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 70, 88, 118, { leaves: 2, perc: 'w', pst: 'closed', sill: 1 }); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 108, 98, 40, 54, { fr: 4 }); g.fillStyle = '#9a9a92'; g.fillRect(190, 0, 7, T - 24); g.fillStyle = '#d4d0c4'; g.fillRect(52, 150, 26, 36); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(52, 186, 26, 3); },   // a stair or bathroom window, a drainpipe, a meter box
  (g, r) => { pwRender(g, r); pwWin(g, r, 50, 78, 156, 104, { leaves: 3, blind: pwBl(r), down: .4, sill: 1 }); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 86, 88, 112, { curt: .4, sill: 1 }); awnDrop(g, 70, 52, 116, 40 + r() * 50, ['#c9803a', '#4f7a5c', '#b8322e', '#d8c070'][(r() * 4) | 0]); },
  // [texround2] more plain bays: a grille, pots on the sill, two small windows with a split unit, a dish on the wall, a wide window with white persiane
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 70, 88, 118, { blind: pwBl(r), down: .35, sill: 1 }); potRow(g, r, 70, 70 + 118 + 5 + 2, 4); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 56, 90, 50, 70, { fr: 4, sill: 1, blind: pwBl(r), down: .6 }); pwWin(g, r, 148, 90, 50, 70, { fr: 4, sill: 1, leaves: 2, perc: 'w', pst: 'closed' }); acUnit(g, 104, 176); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 80, 88, 104, { leaves: 2, grille: 1, sill: 1 }); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 50, 78, 156, 104, { leaves: 3, perc: 'w', pst: 'open', sill: 1 }); dishAt(g, 224, 56); },
  (g, r) => { pwRender(g, r); pwWin(g, r, 84, 70, 88, 118, { blind: pwBl(r), down: 1, sill: 1 }); acUnit(g, 182, 130); g.strokeStyle = '#6a6a66'; g.lineWidth = 2; g.beginPath(); g.moveTo(190, 156); g.lineTo(190, 200); g.stroke(); },
];
const brickBay = (door, o) => (g, r) => {
  pwBrick(g, r); const y = door ? 58 : 70, h = door ? 176 : 118; g.fillStyle = '#e4e0d4'; g.fillRect(70, y - 22, 116, 12); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(70, y - 10, 116, 3);   // a concrete lintel
  pwWin(g, r, 84, y, 88, h, { ...o, door: door ? 1 : 0, leaves: door ? 2 : 1, frame: '#e8e4da' });
};
const PWBD = [brickBay(1, { blind: '#7f8588', down: .5 }), brickBay(1, { curt: .5, perc: 'g', pst: 'open' })];
const PWBW = [brickBay(0, { blind: '#7a5a3e', down: .6, sill: 1 }), brickBay(0, { perc: 'w', pst: 'closed', sill: 1 })];
function pwShop(g, r, o) {   // a glass shop front under the slab: coloured fascia with the name, a big window, a glass door
  plaster(g, r, '#e4e0d6', { peel: 0 });
  g.fillStyle = '#cfccc2'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T);
  g.fillStyle = o.sign; g.fillRect(20, 22, 216, 44); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(20, 22, 216, 3); lettering(g, o.txt, 128, 45, 28, o.ink, 196);
  glassFront(g, 26, 82, 148, 150, o.lit, o.dark);
  g.fillStyle = '#3a342c'; for (const x of [75, 124]) g.fillRect(x - 2, 82, 4, 150);
  for (let i = 0; i < 5; i++) { g.fillStyle = o.goods[(r() * o.goods.length) | 0]; g.fillRect(34 + i * 28, 168 + (i % 2) * 8, 20, 36 - (i % 2) * 8); }
  g.fillStyle = '#2a2420'; g.fillRect(184, 82, 46, 150); g.fillStyle = 'rgba(210,225,240,.2)'; g.fillRect(188, 86, 38, 142); g.fillStyle = '#c8c0a0'; g.fillRect(192, 150, 3, 18);
  g.fillStyle = '#b9b4a6'; g.fillRect(14, 236, 228, 20); dado(g, 30, .25);
}
const PWG = [
  { txt: 'OTTICA', sign: '#1f3f6e', ink: '#f1ede0', lit: '#e8dcb8', dark: '#6a6a5a', goods: ['#cfd4d8', '#8a9aa6', '#e8e4d8'] },
  { txt: 'ABBIGLIAMENTO', sign: '#7a1f24', ink: '#f1ede0', lit: '#f0d8a8', dark: '#7a5a3c', goods: ['#3a5a8a', '#c8423a', '#e8e0d0', '#2a2a2e'] },
  { txt: 'PARRUCCHIERE', sign: '#1c1c1e', ink: '#d8b25a', lit: '#f0e4c8', dark: '#8a7a5a', goods: ['#d8c8b0', '#a85a4a', '#3a3a3e'] },
  { txt: 'FIORI E PIANTE', sign: '#2f5f35', ink: '#f1ede0', lit: '#dce8c0', dark: '#4a6a3a', goods: ['#c8302a', '#e8c830', '#5d8a35', '#d86aa0'] },
].map(o => (g, r) => pwShop(g, r, o));
layer('rail_s', (g, r) => {   // solid parapet, rendered and capped, with a trailing plant (tinted by the building colour)
  g.clearRect(0, 0, T, T); g.fillStyle = '#e6e2d8'; g.fillRect(0, 34, T, T - 34); g.fillStyle = '#f4f1ea'; g.fillRect(0, 24, T, 14); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 38, T, 6);
  g.fillStyle = 'rgba(70,60,50,.1)'; for (let i = 0; i < 5; i++) g.fillRect(r() * T, 50 + r() * 150, 30 + r() * 60, 30);
  for (const x of [30 + r() * 60, 150 + r() * 70]) { g.fillStyle = '#4f7a3a'; for (const [dx, dy, rr] of [[0, 20, 12], [14, 14, 9], [-12, 26, 8]]) { g.beginPath(); g.arc(x + dx, dy, rr, 0, 6.3); g.fill(); } }
});
layer('rail_m', (g, r) => {   // white aluminium posts and three tubes
  g.clearRect(0, 0, T, T); g.fillStyle = '#d8dad6'; for (const y of [20, 100, 180]) g.fillRect(0, y, T, 8);
  for (let x = 0; x < T; x += 128) g.fillRect(x, 20, 10, T - 20);
  g.fillStyle = '#e4e1d8'; g.fillRect(0, 226, T, 30); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 226, T, 4);
});
layer('rail_x', (g, r) => {   // painted iron lattice (ringhiera a losanghe) over a low kerb
  g.clearRect(0, 0, T, T); g.fillStyle = '#2c2c30'; g.strokeStyle = '#2c2c30'; g.fillRect(0, 12, T, 9); g.fillRect(0, 196, T, 8); g.lineWidth = 4;
  for (let x = -T; x < T * 2; x += 43) { g.beginPath(); g.moveTo(x, 204); g.lineTo(x + 192, 21); g.stroke(); g.beginPath(); g.moveTo(x + 192, 204); g.lineTo(x, 21); g.stroke(); }
  g.fillStyle = '#e4e1d8'; g.fillRect(0, 204, T, 52); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 204, T, 4);
});
layer('g_pilot', (g, r) => { // open ground floor on pilotis: dark garage, two concrete columns, parked scooter
  plaster(g, r, '#e0dccf', { peel: 0 });
  g.fillStyle = '#d6d2c6'; g.fillRect(0, 0, T, 34);
  const gr = g.createLinearGradient(0, 34, 0, T); gr.addColorStop(0, '#16130f'); gr.addColorStop(1, '#3a342c'); g.fillStyle = gr; g.fillRect(24, 34, 208, T - 34);
  g.fillStyle = 'rgba(200,190,160,.35)'; g.fillRect(104, 150, 60, 106);
  g.fillStyle = '#c9c5b8'; g.fillRect(0, 34, 24, T - 34); g.fillRect(232, 34, 24, T - 34);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(20, 34, 4, T - 34); g.fillRect(232, 34, 4, T - 34);
  g.fillStyle = '#4a4a4e'; g.fillRect(46, 214, 40, 22); g.fillRect(52, 200, 28, 14); // scooter silhouette
  dado(g, 40, .3);
});
layer('g_lobby', (g, r) => { // marble-clad entrance hall, glass doors, brass plates, canopy
  plaster(g, r, '#e0dccf', { peel: 0 });
  g.fillStyle = '#ddd8cc'; g.fillRect(48, 36, 160, T - 36); g.fillStyle = 'rgba(80,70,60,.15)'; for (let y = 50; y < T; y += 40) g.fillRect(48, y, 160, 2); for (let x = 88; x < 208; x += 40) g.fillRect(x, 36, 2, T - 36);
  g.fillStyle = '#2a323a'; g.fillRect(74, 70, 108, T - 70); g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(74, 200); g.lineTo(120, 70); g.lineTo(150, 70); g.lineTo(74, 240); g.fill();
  g.fillStyle = '#9a9a94'; g.fillRect(126, 70, 4, T - 70); g.fillRect(74, 70, 108, 4);
  g.fillStyle = '#c9a24a'; g.fillRect(194, 110, 10, 40); g.fillStyle = '#d6d2c6'; g.fillRect(40, 24, 176, 12); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(40, 36, 176, 4);
  g.fillStyle = '#b9b4a6'; g.fillRect(40, T - 10, 176, 10); dado(g, 30, .25);
});

// ---- ZEN / large housing insulae: prefab concrete, ribbon windows, exterior stairwells, graffiti
function concrete(g, r, base = '#cfcdc6') {
  g.fillStyle = base; g.fillRect(0, 0, T, T);
  softNoise(g, r, 6, '255,255,250', .22); softNoise(g, r, 9, '60,56,50', .24); softNoise(g, r, 3, '50,46,40', .2, 2.4);
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() < .5 ? 'rgba(60,56,50,.1)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * T, r() * T, 1.5, 1.5); }
  g.fillStyle = 'rgba(40,36,32,.3)'; g.fillRect(0, 0, 3, T); g.fillRect(0, T - 3, T, 3); // panel joints
}
const zenA = (g, r) => { // ribbon window with aluminium roller blind, rust streaks
  concrete(g, r);
  g.fillStyle = '#a9a69d'; g.fillRect(26, 70, 204, 84); const gr = g.createLinearGradient(0, 74, 0, 150); gr.addColorStop(0, '#56646e'); gr.addColorStop(1, '#262c32'); g.fillStyle = gr; g.fillRect(32, 76, 192, 72);
  g.fillStyle = '#a9a69d'; g.fillRect(94, 76, 4, 72); g.fillRect(158, 76, 4, 72);
  tapp(g, 100, 70, 54, 36 + r() * 30, '#b8b2a2');
  g.fillStyle = 'rgba(120,70,40,.35)'; for (let i = 0; i < 4; i++) g.fillRect(30 + r() * 190, 154, 4 + r() * 4, 30 + r() * 60);
  streak(g, 128, 156, 90, 160, .08);
};
layer('zen_a', zenA);
const zenB = (g, r) => { // recessed loggia: dark gap behind a concrete rail, laundry
  concrete(g, r, '#c8c5bc');
  g.fillStyle = '#26221e'; g.fillRect(24, 40, 208, 150); g.fillStyle = 'rgba(190,180,150,.2)'; g.fillRect(34, 50, 70, 130);
  g.fillStyle = '#d4d0c6'; g.fillRect(14, 186, 228, 22); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(14, 208, 228, 6);
  g.strokeStyle = '#4a4a4e'; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 76); g.lineTo(220, 82); g.stroke();
  const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2']; for (let i = 0; i < 5; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(44 + i * 34, 78 + i * .8, 16 + r() * 8, 26 + r() * 24); }
  for (let i = 0; i < 3; i++) streak(g, 30 + r() * 190, 214, 40, 12, .16);
};
layer('zen_b', zenB);
layer('zen_stair', (g, r) => { // exterior stairwell: concrete frame, diagonal flights, rail
  concrete(g, r, '#c4c1b8');
  g.fillStyle = '#1e1c1a'; g.fillRect(40, 20, 176, T - 40);
  g.fillStyle = 'rgba(200,190,160,.18)'; g.fillRect(44, 24, 168, 90);
  g.strokeStyle = '#b8b4a8'; g.lineWidth = 10; g.beginPath(); g.moveTo(44, T - 30); g.lineTo(212, 110); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#3a3a3e'; g.beginPath(); g.moveTo(44, T - 70); g.lineTo(212, 70); g.stroke();
  g.fillStyle = '#b8b4a8'; g.fillRect(40, 120, 176, 10); g.fillRect(40, T - 36, 176, 10);
  g.fillStyle = '#d4d0c6'; g.fillRect(0, 0, 40, T); g.fillRect(216, 0, 40, T); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(36, 20, 4, T - 40);
});
layer('zen_g', (g, r) => { // ground floor: bricked-up and shuttered, spray tags
  concrete(g, r, '#c6c3ba');
  g.fillStyle = '#7a7a76'; g.fillRect(30, 60, 196, T - 60); rollShutter(g, r, 36, 66, 184, T - 66, '#76766f');
  for (let i = 0; i < 3; i++) { g.fillStyle = ['#d8741f', '#2f6aa8', '#c8423a', '#e8e0c0'][(r() * 4) | 0]; g.beginPath(); g.moveTo(50 + r() * 120, 90 + r() * 90); g.bezierCurveTo(80 + r() * 120, 60 + r() * 100, 100 + r() * 100, 130 + r() * 80, 70 + r() * 150, 150 + r() * 70); g.lineWidth = 6; g.strokeStyle = g.fillStyle; g.stroke(); }
  dado(g, 40, .4);
});

// [texround2] The housing insulae took ONE of zen_a / zen_b for a whole building (up: ['zen_a', 'zen_b', 'zen_a']), so a block read as one window pasted in every bay. The group zen_up (STYLES.ins) mixes these and the new ones per bay and floor;
// each has the concrete frame (piers, a slab line), stains under the sills and in some a balcony slab with its railing, shutters or a roller blind.
function zenFrame(g, r) {
  g.fillStyle = 'rgba(50,46,40,.14)'; g.fillRect(0, 0, 15, T); g.fillRect(T - 15, 0, 15, T);   // the piers, a shade darker
  g.fillStyle = 'rgba(30,26,20,.28)'; g.fillRect(15, 0, 2.5, T); g.fillRect(T - 17.5, 0, 2.5, T);
  g.fillStyle = 'rgba(30,26,20,.2)'; g.fillRect(0, T - 22, T, 3); g.fillStyle = 'rgba(255,255,248,.18)'; g.fillRect(0, T - 19, T, 2);   // the slab edge
  if (r() < .7) streak(g, 7 + (r() < .5 ? 0 : T - 14), T - 90, 70 + r() * 30, 5, .22);
}
function zenSill(g, r, x, y, w) { g.fillStyle = '#b4b0a6'; g.fillRect(x - 6, y, w + 12, 7); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 6, y + 7, w + 12, 3); sillStain(g, r, x - 6, y + 10, w + 12, 1.2); }
function zenRail(g, x, y, w, h, solid) {   // a balcony: the concrete slab, and a painted rail on it (bars or a solid parapet)
  g.fillStyle = '#c8c4ba'; g.fillRect(x - 8, y + h, w + 16, 12); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 8, y + h + 12, w + 16, 4);
  if (solid) { g.fillStyle = '#d6d2c6'; g.fillRect(x - 8, y + h * .35, w + 16, h * .65); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x - 8, y + h * .35, w + 16, 4); }
  else { g.fillStyle = '#34343a'; g.fillRect(x - 8, y + h * .3, w + 16, 4); g.fillRect(x - 8, y + h - 3, w + 16, 3); for (let xx = x - 4; xx < x + w + 8; xx += 9) g.fillRect(xx, y + h * .3, 2.5, h * .7); }
}
const ZENUP = [
  (g, r) => { zenA(g, r); zenFrame(g, r); sillStain(g, r, 26, 160, 204); },
  (g, r) => { zenB(g, r); zenFrame(g, r); },
  (g, r) => { concrete(g, r, '#cac7be'); g.fillStyle = '#a9a69d'; g.fillRect(78, 54, 100, 140); const gr = g.createLinearGradient(0, 60, 0, 190); gr.addColorStop(0, '#56646e'); gr.addColorStop(1, '#262c32'); g.fillStyle = gr; g.fillRect(84, 60, 88, 128);
    g.fillStyle = '#a9a69d'; g.fillRect(126, 60, 4, 128); tapp(g, 84, 56, 88, 40 + r() * 70, r() < .5 ? '#7f8588' : '#8c8a80'); zenRail(g, 70, 150, 116, 46, false); zenFrame(g, r); },   // a French window on a balcony slab, iron rail
  (g, r) => { concrete(g, r, '#c6c3ba'); for (const x of [46, 156]) { g.fillStyle = '#a9a69d'; g.fillRect(x, 84, 56, 80); g.fillStyle = '#2a3238'; g.fillRect(x + 5, 89, 46, 70); leaf(g, x + 5, 89, 23, 70, SH.g); leaf(g, x + 28, 89, 23, 70, SH.g); zenSill(g, r, x, 164, 56); } acUnit(g, 104, 112); zenFrame(g, r); },   // two shuttered windows and a split unit between
  (g, r) => { concrete(g, r, '#c9c6bd'); g.fillStyle = '#a9a69d'; g.fillRect(34, 70, 188, 90); const gr = g.createLinearGradient(0, 76, 0, 154); gr.addColorStop(0, '#5d6c76'); gr.addColorStop(1, '#2a3036'); g.fillStyle = gr; g.fillRect(40, 76, 176, 78);
    g.fillStyle = '#a9a69d'; for (const x of [84, 128, 172]) g.fillRect(x - 2, 76, 4, 78); tapp(g, 44, 72, 38, 30 + r() * 40, '#b8b2a2'); tapp(g, 132, 72, 38, 20 + r() * 60, '#b8b2a2'); zenSill(g, r, 34, 160, 188); zenFrame(g, r); },   // a four-part ribbon window, two blinds at different heights
  (g, r) => { concrete(g, r, '#c8c5bc'); g.fillStyle = '#26221e'; g.fillRect(26, 50, 204, 138); g.fillStyle = 'rgba(190,180,150,.16)'; g.fillRect(36, 60, 60, 118); zenRail(g, 26, 140, 204, 48, true);
    const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2']; g.strokeStyle = '#4a4a4e'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 78); g.lineTo(216, 84); g.stroke(); for (let i = 0; i < 4; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(52 + i * 40, 80 + i * .8, 16 + r() * 8, 24 + r() * 20); } zenFrame(g, r); },   // a loggia with a solid parapet and washing
  (g, r) => { concrete(g, r, '#cdcac2'); g.fillStyle = '#a9a69d'; g.fillRect(104, 100, 48, 56); g.fillStyle = '#2a3238'; g.fillRect(109, 105, 38, 46); zenSill(g, r, 104, 156, 48); g.fillStyle = '#9a9a92'; g.fillRect(190, 0, 8, T - 22); g.fillStyle = '#d4d0c4'; g.fillRect(50, 160, 26, 36); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(50, 196, 26, 3); dishAt(g, 216, 70); zenFrame(g, r); },   // a plain panel: a stair window, a drainpipe, a meter box, a dish
];
// ---- fishermen's houses and summer houses: whitewash, painted wood doors, pastel shutters
function fisBase(g, r, base = '#ece6d6') { plaster(g, r, base, { peel: r() < .5 ? 1 : 0 }); g.fillStyle = 'rgba(60,70,90,.14)'; g.fillRect(0, T - 46, T, 46); }
layer('fis_door', (g, r) => {
  fisBase(g, r);
  const dc = ['#2f5f8a', '#3f7a5a', '#8a5a3a', '#b0442e'][(r() * 4) | 0];
  g.fillStyle = '#f6f2e6'; g.fillRect(84, 78, 88, T - 78); g.fillStyle = dc; g.fillRect(92, 86, 72, T - 86);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(98, 94, 26, 60); g.fillRect(132, 94, 26, 60); g.fillRect(98, 164, 26, 60); g.fillRect(132, 164, 26, 60);
  g.fillStyle = '#c9a24a'; g.fillRect(124, 160, 8, 6);
  win(g, 192, 108, 38, 56, { sh: 'l', st: 'closed', fr: 3, sill: true });
  g.fillStyle = '#c8c0a8'; g.fillRect(80, T - 8, 96, 8);
});
layer('fis_win', (g, r) => {
  fisBase(g, r);
  win(g, 38, 92, 56, 90, { sh: 'l', st: 'open', fr: 5, frc: '#f8f4ea' });
  win(g, 150, 92, 56, 90, { sh: r() < .5 ? 'l' : 'g', st: 'half', fr: 5, frc: '#f8f4ea' });
  g.strokeStyle = '#666'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10, 40); g.lineTo(246, 48); g.stroke();
  const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2']; for (let i = 0; i < 5; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(24 + i * 44, 42 + i, 16 + r() * 8, 22 + r() * 16); }
});
layer('fis_a', (g, r) => { // upper floor: shutters, small iron balcony painted on
  fisBase(g, r, '#eee8d8');
  win(g, 94, 60, 68, 126, { sh: r() < .5 ? 'l' : 'p', st: 'half', fr: 5, frc: '#f8f4ea', sill: false });
  g.fillStyle = '#d8d0bc'; g.fillRect(60, 190, 136, 10); g.fillStyle = '#26262c'; g.fillRect(64, 152, 128, 4); for (let x = 68; x < 190; x += 10) g.fillRect(x, 152, 3, 38);
  g.fillStyle = '#c0392b'; g.beginPath(); g.arc(84, 146, 8, 0, 6.3); g.arc(170, 143, 7, 0, 6.3); g.fill();
});

// ---- industrial sheds, silos
layer('ind_a', (g, r) => { // corrugated sheet cladding, band of windows, rust at the foot
  g.fillStyle = '#c9cbc8'; g.fillRect(0, 0, T, T);
  for (let x = 0; x < T; x += 10) { g.fillStyle = x % 20 ? 'rgba(255,255,255,.35)' : 'rgba(40,44,48,.22)'; g.fillRect(x, 0, 5, T); }
  softNoise(g, r, 6, '255,255,250', .2); softNoise(g, r, 8, '60,56,50', .26); softNoise(g, r, 3, '120,70,40', .3, 2.4);
  const gr = g.createLinearGradient(0, T - 70, 0, T); gr.addColorStop(0, 'rgba(120,70,40,0)'); gr.addColorStop(1, 'rgba(110,64,36,.45)'); g.fillStyle = gr; g.fillRect(0, T - 70, T, 70);
  g.fillStyle = '#2a3036'; g.fillRect(20, 18, 216, 26); g.fillStyle = 'rgba(160,190,210,.35)'; g.fillRect(24, 22, 208, 8);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, T, 3);
});
layer('ind_b', (g, r) => { // prefab concrete panels and a roller door with hazard stripe
  concrete(g, r, '#c9c7c0'); g.fillStyle = 'rgba(30,28,24,.25)'; for (let x = 0; x < T; x += 128) g.fillRect(x, 0, 3, T);
  rollShutter(g, r, 52, 74, 152, T - 74, '#8a8e92');
  g.fillStyle = '#d8b020'; for (let x = 52; x < 204; x += 24) { g.beginPath(); g.moveTo(x, T); g.lineTo(x + 12, T); g.lineTo(x + 24, T - 14); g.lineTo(x + 12, T - 14); g.fill(); }
  g.fillStyle = '#e8e4d8'; g.fillRect(100, 40, 56, 22); g.fillStyle = '#c8423a'; g.fillRect(106, 46, 44, 10);
});
layer('ind_roll', (g, r) => { // loading bays
  g.fillStyle = '#d4d2cb'; g.fillRect(0, 0, T, T); softNoise(g, r, 6, '255,255,250', .18); softNoise(g, r, 8, '60,56,50', .22);
  for (const x of [10, 134]) rollShutter(g, r, x, 60, 112, T - 60, r() < .5 ? '#7a7e70' : '#8c8a84');
  g.fillStyle = '#2a2a2a'; g.fillRect(0, 56, T, 6); dado(g, 30, .3);
});
layer('silo', (g, r) => { // slip-formed concrete silo: pale, horizontal pour joints, vertical weathering
  g.fillStyle = '#dcdad2'; g.fillRect(0, 0, T, T);
  for (let y = 12; y < T; y += 32) { g.fillStyle = 'rgba(40,36,30,.25)'; g.fillRect(0, y, T, 2); }
  softNoise(g, r, 6, '255,255,250', .2); softNoise(g, r, 5, '60,56,50', .24); softNoise(g, r, 3, '50,46,40', .3, 3);
  for (let i = 0; i < 10; i++) streak(g, r() * T, 0, 120 + r() * 120, 3 + r() * 8, .2);
});
layer('roof_metal', (g, r) => { // corrugated roof sheet
  g.fillStyle = '#a9aeb0'; g.fillRect(0, 0, T, T);
  for (let y = 0; y < T; y += 16) { g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, y, T, 5); g.fillStyle = 'rgba(30,34,38,.28)'; g.fillRect(0, y + 8, T, 5); }
  softNoise(g, r, 6, '255,255,250', .2); softNoise(g, r, 8, '110,70,44', .3); softNoise(g, r, 12, '40,40,40', .2);
});

// ---- ruins and bombed gaps (Kalsa, Albergheria): bare tufa and brick, black openings, weeds
layer('ruin_wall', (g, r) => {
  ashlar(g, r, 0, 0, T, T, '#d6c7a4', 30, 58, .34);
  for (let i = 0; i < 6; i++) { g.fillStyle = r() < .6 ? 'rgba(150,80,60,.35)' : 'rgba(40,34,28,.28)'; g.fillRect(r() * T, r() * T, 20 + r() * 40, 14 + r() * 28); } // brick patches and soot
  g.fillStyle = '#e4d8bb'; g.fillRect(0, 0, 90 + r() * 60, 26 + r() * 40);
  for (const x of [40, 152]) { g.fillStyle = '#100e0c'; g.beginPath(); g.moveTo(x, 214); g.lineTo(x, 100); g.lineTo(x + 26, 84); g.lineTo(x + 60, 100 + r() * 14); g.lineTo(x + 56, 214); g.fill(); }
  g.fillStyle = '#4f7a3a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(r() * T, 214 + r() * 40, 6 + r() * 12, 0, 6.3); g.fill(); }
  for (let i = 0; i < 4; i++) streak(g, r() * T, r() * 60, 130, 12, .2); dado(g, 50, .4);
});
layer('rubble', (g, r) => {
  g.fillStyle = '#9a9488'; g.fillRect(0, 0, T, T);
  for (let i = 0; i < 700; i++) { const k = r(); g.fillStyle = k < .4 ? 'rgba(60,54,46,.45)' : k < .75 ? 'rgba(200,190,160,.5)' : 'rgba(150,80,60,.4)'; g.fillRect(r() * T, r() * T, 2 + r() * 8, 2 + r() * 6); }
  g.fillStyle = '#5f8a3a'; for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(r() * T, r() * T, 3 + r() * 9, 0, 6.3); g.fill(); }
  softNoise(g, r, 6, '40,36,30', .3);
});

// ---- beach clubs and summer cabins (Mondello lido)
layer('bch_a', (g, r) => { // white wooden cabin, teal trim, louvred door
  g.fillStyle = '#f0ede4'; g.fillRect(0, 0, T, T); for (let x = 0; x < T; x += 22) { g.fillStyle = 'rgba(60,70,80,.1)'; g.fillRect(x, 0, 2, T); }
  softNoise(g, r, 6, '255,255,250', .2); softNoise(g, r, 8, '60,70,80', .15);
  g.fillStyle = '#2f8f9a'; g.fillRect(0, 0, T, 16); g.fillRect(0, T - 18, T, 18);
  g.fillStyle = '#2f8f9a'; g.fillRect(84, 52, 88, T - 70); g.fillStyle = '#f4f2ea'; g.fillRect(92, 60, 72, T - 86);
  g.fillStyle = 'rgba(47,143,154,.55)'; for (let y = 66; y < T - 30; y += 10) g.fillRect(96, y, 64, 4);
});
layer('bch_b', (g, r) => { // cabana front: striped awning over an open counter
  g.fillStyle = '#ece8dc'; g.fillRect(0, 0, T, T); softNoise(g, r, 6, '255,255,250', .2);
  const c1 = r() < .5 ? '#2f6f9a' : '#d8741f';
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#f6f4ec' : c1; g.fillRect(i * 21.4, 20, 21.5, 52); g.beginPath(); g.arc(i * 21.4 + 10.7, 72, 10.7, 0, Math.PI); g.fill(); }
  g.fillStyle = '#2a2622'; g.fillRect(22, 92, 212, 120); g.fillStyle = 'rgba(230,200,140,.35)'; g.fillRect(30, 100, 196, 36);
  g.fillStyle = '#d9d0bc'; g.fillRect(14, 212, 228, 14); g.fillStyle = '#2f8f9a'; g.fillRect(0, T - 18, T, 18);
});
layer('deck', (g, r) => { // timber deck roofs and terraces
  g.fillStyle = '#a58a66'; g.fillRect(0, 0, T, T);
  for (let y = 0; y < T; y += 21) { g.fillStyle = 'rgba(40,28,16,.5)'; g.fillRect(0, y, T, 2); }
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < .5 ? 'rgba(255,240,210,.12)' : 'rgba(40,28,16,.14)'; g.fillRect(r() * T, r() * T, 8 + r() * 30, 1.5); }
  softNoise(g, r, 6, '255,245,220', .2); softNoise(g, r, 8, '50,34,20', .22);
});

// ---- old town (Kalsa, Albergheria, Capo, Vucciria, Quattro Canti): aged lime render in repainted patches, stone trim, tall windows in every state of repair, wooden doors, dark painted skirts.
// Every tile here starts from the same render (obase), so neighbouring bays and tiles meet without a seam. Variant layers are gathered in groups (GROUPS below): the shader picks one per bay and floor,
// so a facade does not repeat one window. Colour stays near neutral: the plaster is tinted per building by the vertex colour, the shutters and wood keep their own.
Object.assign(SH, { x: ['#7d8ba2', '#5d6b84'], r: ['#6e3b30', '#522a22'], v: ['#46604a', '#324738'], o: ['#8a5a34', '#6a4224'] });
let OBASE = null, OSTONE = null, STONEF = false;   // STONEF: a stone variant of the old-town tiles is being drawn (below, `stonify`): obase gives dressed ashlar and not lime render
function obase(g) {
  if (STONEF) {
    if (!OSTONE) { OSTONE = document.createElement('canvas'); OSTONE.width = OSTONE.height = T; const c = OSTONE.getContext('2d'), r = rng(4243); ashlar(c, r, 0, 0, T, T, '#e6e1d3', 32, 64, .22); softNoise(c, r, 3, '150,112,80', .1); softNoise(c, r, 7, '98,84,66', .12); }
    g.drawImage(OSTONE, 0, 0); return;
  }
  if (!OBASE) {
    OBASE = document.createElement('canvas'); OBASE.width = OBASE.height = T;
    const c = OBASE.getContext('2d'), r = rng(31337);
    c.fillStyle = '#e8e1d0'; c.fillRect(0, 0, T, T);
    softNoise(c, r, 3, '150,112,80', .16);            // broad warm mottling: lime wash repainted here and there
    softNoise(c, r, 5, '255,250,236', .22);
    softNoise(c, r, 8, '98,84,66', .14);              // damp and grime
    softNoise(c, r, 13, '255,252,240', .10);
    softNoise(c, r, 3, '60,52,44', .1, 2.4);          // vertical grime bands
    for (let i = 0; i < 170; i++) {                   // trowel marks: short, faint, mostly horizontal strokes (wrapped so the tile repeats)
      const x = r() * T, y = r() * T, w = 10 + r() * 30, h = 1 + r() * 2.2, k = r() < .5;
      wrapped(x, y, w, (X, Y) => { c.fillStyle = k ? 'rgba(255,255,248,.10)' : 'rgba(80,64,46,.07)'; c.fillRect(X, Y, w, h); });
    }
    for (let i = 0; i < 1100; i++) { c.fillStyle = r() < .5 ? 'rgba(90,70,50,.10)' : 'rgba(255,255,255,.12)'; c.fillRect(r() * T, r() * T, 1 + r() * 1.6, 1 + r() * 1.6); }
  }
  g.drawImage(OBASE, 0, 0);
}
function opatch(g, r, n, pk = [.15, .55], sc = 1) {   // [texround2] stone showing was 42% of the patches, a hard marked blob on most tiles that read as a stamp down a facade: now 15%, a lighter outline, and `sc` makes the odd one big // pk: cumulative shares of the three kinds (stone showing, fresh wash, damp); the blind walls ask for hardly any stone   // ageing inside the tile: the stone showing where the render has gone (with a lip of render and a shadow), a patch of fresh wash, a damp stain; every call draws other shapes
  for (let i = 0; i < n; i++) {
    const k = r(), w = (24 + r() * 44) * sc, h = (18 + r() * 34) * sc, x = 18 + r() * (T - 36 - w), y = 18 + r() * (T - 36 - h);
    const blob = (jag) => { g.beginPath(); const m = 11; for (let q = 0; q < m; q++) { const a = q / m * 6.283, rr = .55 + r() * jag; g[q ? 'lineTo' : 'moveTo'](x + w / 2 + Math.cos(a) * w / 2 * rr, y + h / 2 + Math.sin(a) * h / 2 * rr); } g.closePath(); };
    if (k < pk[0]) {        // missing render: tufa blocks underneath, shadow along the top and left edge, the lip of render thick along the bottom and right
      g.save(); blob(.5); g.clip();
      g.fillStyle = r() < .5 ? '#b3a07c' : '#a8977a'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
      for (let yy = y - 2, row = 0; yy < y + h + 4; yy += 11 + r() * 4, row++) { g.fillStyle = 'rgba(60,46,30,.38)'; g.fillRect(x - 4, yy, w + 8, 1.6); for (let xx = x - (row % 2) * 14; xx < x + w + 4; xx += 28 + r() * 10) g.fillRect(xx, yy, 1.6, 12); g.fillStyle = `rgba(${r() < .5 ? '255,244,214' : '80,60,38'},${.06 + r() * .1})`; g.fillRect(x - 4, yy + 2, w + 8, 9); }
      const sh = g.createLinearGradient(x, y, x + w * .5, y + h * .6); sh.addColorStop(0, 'rgba(30,22,14,.55)'); sh.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = sh; g.fillRect(x - 4, y - 4, w + 8, h + 8);
      g.restore();
      blob(.5); g.lineWidth = 2.2; g.strokeStyle = 'rgba(70,54,38,.3)'; g.stroke(); g.translate(1.6, 1.8); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,250,232,.3)'; g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
    } else if (k < pk[1]) { // fresh wash over an older one: paler or warmer, a soft edge
      blob(.35); g.fillStyle = r() < .5 ? 'rgba(255,246,224,.30)' : 'rgba(196,150,108,.16)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(90,72,52,.18)'; g.stroke();
    } else {              // a damp stain: dark soft cloud, a tide line along its upper edge
      const gr = g.createRadialGradient(x + w / 2, y + h * .6, 2, x + w / 2, y + h * .6, w * .7); gr.addColorStop(0, 'rgba(70,58,44,.20)'); gr.addColorStop(1, 'rgba(70,58,44,0)');
      g.fillStyle = gr; g.fillRect(x - w * .2, y - h * .3, w * 1.4, h * 1.6);
    }
  }
}
function oskirt(g, h = 44, col = '#2f2c2a') {   // the dark painted skirt (zoccolo) of an old-town ground floor
  g.fillStyle = col; g.fillRect(0, T - h, T, h);
  const gr = g.createLinearGradient(0, T - h, 0, T); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = gr; g.fillRect(0, T - h, T, h);
  g.fillStyle = 'rgba(214,204,184,.6)'; g.fillRect(0, T - h - 3, T, 3); g.fillStyle = 'rgba(40,32,24,.3)'; g.fillRect(0, T - h, T, 3);
  g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 40; i++) g.fillRect((i * 53) % T, T - h + 6 + (i * 29) % (h - 10), 3 + i % 5, 1.5);   // chipped paint, fixed positions
  g.fillStyle = 'rgba(70,58,44,.22)'; for (let x = 0; x < T; x += 9) g.fillRect(x, T - h - 11 - ((x * 7) % 9), 9, 9);   // rising damp: a ragged tide mark above the skirt
}
function archPath(g, cx, y0, hw, base) { g.beginPath(); g.moveTo(cx - hw, base); g.lineTo(cx - hw, y0); g.arc(cx, y0, hw, Math.PI, 0); g.lineTo(cx + hw, base); g.closePath(); }
function ovouss(g, cx, y0, rin, rout) {   // the voussoirs of an arch ring (radial joints) and a keystone that stands out
  g.strokeStyle = 'rgba(60,46,30,.5)'; g.lineWidth = 1.6;
  const n = 9;
  for (let i = 1; i < n; i++) { const a = Math.PI + i / n * Math.PI, ca = Math.cos(a), sa = Math.sin(a); g.beginPath(); g.moveTo(cx + ca * rin, y0 + sa * rin); g.lineTo(cx + ca * rout, y0 + sa * rout); g.stroke(); }
  g.fillStyle = 'rgba(255,248,226,.3)'; g.beginPath(); g.moveTo(cx - 9, y0 - rin + 2); g.lineTo(cx + 9, y0 - rin + 2); g.lineTo(cx + 12, y0 - rout - 7); g.lineTo(cx - 12, y0 - rout - 7); g.closePath(); g.fill(); g.stroke();
}
function orust(g, r, x0, y0, x1, y1, stone = '#e6dcc4', rowH = 40, bw = 64) {   // rusticated ashlar: big blocks, bevelled channel joints, each a little different, pitted (bw divides the tile, so it repeats)
  g.fillStyle = stone; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  let row = 0;
  for (let y = y0; y < y1; y += rowH, row++) {
    const h = Math.min(rowH, y1 - y);
    for (let x = x0 - (row % 2) * bw / 2; x < x1; x += bw) {
      const xa = Math.max(x0, x), xb = Math.min(x1, x + bw); if (xb <= xa) continue;
      g.fillStyle = r() < .5 ? `rgba(255,248,226,${.05 + r() * .12})` : `rgba(88,64,36,${.04 + r() * .12})`; g.fillRect(xa, y, xb - xa, h);
      g.fillStyle = 'rgba(255,250,235,.26)'; g.fillRect(xa + 3, y + 3, xb - xa - 5, 2);
      g.fillStyle = 'rgba(60,44,26,.36)'; g.fillRect(xa, y + h - 4, xb - xa, 4);
      g.fillStyle = 'rgba(60,44,26,.28)'; g.fillRect(xb - 3, y, 3, h); g.fillStyle = 'rgba(255,250,235,.18)'; g.fillRect(xa, y, 2, h);
      for (let q = 0; q < 7; q++) { g.fillStyle = 'rgba(70,52,34,.22)'; g.fillRect(xa + 6 + r() * Math.max(1, xb - xa - 12), y + 8 + r() * Math.max(1, h - 14), 1.6, 1.6); }
    }
  }
}
function oleaf(g, r, x, y, w, h, c) {   // a wooden door leaf: boards, a darker panel frame, grain
  g.fillStyle = c; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h); g.fillRect(x, y, w, 3);
  for (let yy = y + 14; yy < y + h - 20; yy += 38 + r() * 20) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 6, yy, w - 12, 3); g.fillStyle = 'rgba(255,230,190,.08)'; g.fillRect(x + 6, yy + 3, w - 12, 1.5); }
  for (let i = 0; i < 9; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,220,170,.08)'; g.fillRect(x + 4 + r() * (w - 8), y + r() * h * .9, 1.5, 12 + r() * 40); }
}
const WOOD = ['#5b3a24', '#3b2a20', '#7a5232', '#3d5642', '#4a3326', '#34393a'];   // the last one is a grey-green, not blue: a dark bluish texel is read by the night shader as window glass and would light up a door
function oshut(g, x, y, w, h, c) {   // a closed shutter leaf: frame, slats with a lit top edge and a dark gap, a middle rail, light from the left
  g.fillStyle = c[1]; g.fillRect(x, y, w, h);
  for (let yy = y + 4; yy < y + h - 6; yy += 6.5) {
    g.fillStyle = c[0]; g.fillRect(x + 3, yy, w - 6, 4.6);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x + 3, yy, w - 6, 1);
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(x + 3, yy + 4.6, w - 6, 1.9);
  }
  g.fillStyle = c[1]; g.fillRect(x, y + h * .5 - 2, w, 4); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y + h * .5 - 2, w, 1);
  g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h); g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 3, y + 3, 1.5, h - 6);
}
function oshutOpen(g, x, y, w, h, c, side) {   // a shutter swung back against the wall: seen nearly edge on, a narrow wedge with foreshortened slats and a shadow on the wall
  const vw = w * .44, near = x + (side < 0 ? vw : 0), far = x + (side < 0 ? 0 : vw), dy = h * .045;
  g.fillStyle = 'rgba(30,22,14,.24)'; g.beginPath(); g.moveTo(near + side * 3, y + 2); g.lineTo(far + side * 7, y + dy + 4); g.lineTo(far + side * 7, y + h - dy + 4); g.lineTo(near + side * 3, y + h + 2); g.closePath(); g.fill();
  g.fillStyle = c[0]; g.beginPath(); g.moveTo(near, y); g.lineTo(far, y + dy); g.lineTo(far, y + h - dy); g.lineTo(near, y + h); g.closePath(); g.fill();
  g.save(); g.clip();
  for (let yy = y + 4; yy < y + h - 4; yy += 6.5) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, yy + 4.6, vw, 1.9); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, yy, vw, 1); }
  const sh = g.createLinearGradient(x, 0, x + vw, 0); sh.addColorStop(side < 0 ? 0 : 1, 'rgba(0,0,0,.35)'); sh.addColorStop(side < 0 ? 1 : 0, 'rgba(255,255,255,.08)'); g.fillStyle = sh; g.fillRect(x, y, vw, h);
  g.restore();
}
function oped(g, x, yb, w, type, col) {   // a window pediment: moulded raking cornice, a dark tympanum, a shadow below
  g.fillStyle = 'rgba(40,30,20,.3)'; g.beginPath();
  if (type === 'tri') { g.moveTo(x - 6, yb + 3); g.lineTo(x + w / 2, yb - 26); g.lineTo(x + w + 12, yb + 3); } else { g.moveTo(x - 6, yb + 3); g.quadraticCurveTo(x + w / 2, yb - 42, x + w + 12, yb + 3); }
  g.closePath(); g.fill();
  g.fillStyle = col; g.strokeStyle = 'rgba(60,45,30,.55)'; g.lineWidth = 1.5; g.beginPath();
  if (type === 'tri') { g.moveTo(x - 10, yb); g.lineTo(x + w / 2, yb - 30); g.lineTo(x + w + 10, yb); } else { g.moveTo(x - 10, yb); g.quadraticCurveTo(x + w / 2, yb - 48, x + w + 10, yb); }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(70,55,40,.4)'; g.beginPath();
  if (type === 'tri') { g.moveTo(x + 2, yb - 5); g.lineTo(x + w / 2, yb - 21); g.lineTo(x + w - 2, yb - 5); } else { g.moveTo(x + 2, yb - 5); g.quadraticCurveTo(x + w / 2, yb - 34, x + w - 2, yb - 5); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,252,240,.55)'; g.fillRect(x - 10, yb - 3, w + 20, 1.6);   // the lit top of the cornice below it
  g.fillStyle = 'rgba(60,45,30,.5)'; for (let xx = x - 6; xx < x + w + 8; xx += 6) g.fillRect(xx, yb - 1, 3, 3);   // dentils
}
function owin(g, r, x, y, w, h, o = {}) {   // a tall old-town window: moulded stone surround, a recessed opening with a deep reveal, glazing bars, shutters in some state, a bracketed sill
  const fr = o.fr ?? 9, st = o.st || 'none', stn = o.stone || '#efe8d5';
  g.save(); g.shadowColor = 'rgba(40,30,20,.45)'; g.shadowBlur = 7; g.shadowOffsetX = 4; g.shadowOffsetY = 5; g.fillStyle = stn; g.fillRect(x - fr, y - fr, w + 2 * fr, h + 2 * fr); g.restore();   // the surround stands proud: soft shadow down and to the right
  if (o.ped) oped(g, x - fr + 3, y - fr, w + 2 * fr - 6, o.ped, stn);
  g.fillStyle = stn; g.fillRect(x - fr, y - fr, w + 2 * fr, h + 2 * fr);
  g.fillStyle = 'rgba(255,252,240,.5)'; g.fillRect(x - fr, y - fr, 2.5, h + 2 * fr); g.fillRect(x - fr, y - fr, w + 2 * fr, 2.5);          // lit left and top edge
  g.fillStyle = 'rgba(60,45,30,.3)'; g.fillRect(x + w + fr - 2.5, y - fr, 2.5, h + 2 * fr); g.fillRect(x - fr, y + h + fr - 2.5, w + 2 * fr, 2.5);   // shaded right and bottom
  g.strokeStyle = 'rgba(60,45,30,.28)'; g.lineWidth = 1.2; g.strokeRect(x - fr + 4.5, y - fr + 4.5, w + 2 * fr - 9, h + 2 * fr - 9);               // the moulding
  if (o.hood) { g.fillStyle = stn; g.fillRect(x - fr - 7, y - fr - 10, w + 2 * fr + 14, 10); g.fillStyle = 'rgba(40,30,20,.4)'; g.fillRect(x - fr - 7, y - fr, w + 2 * fr + 14, 4); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - fr - 7, y - fr - 10, w + 2 * fr + 14, 2); g.fillStyle = 'rgba(60,45,30,.45)'; for (let xx = x - fr - 5; xx < x + w + fr + 5; xx += 7) g.fillRect(xx, y - fr - 2, 3.5, 3); }
  g.fillStyle = '#16120f'; g.fillRect(x, y, w, h);                                             // the opening
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e');
  g.fillStyle = gr; g.fillRect(x + 6, y + 7, w - 6, h - 7);                                    // the glass, set back: a deep reveal left and top
  g.fillStyle = 'rgba(200,215,230,.14)'; g.beginPath(); g.moveTo(x + 6, y + h * .55); g.lineTo(x + w * .62, y + 7); g.lineTo(x + w, y + 7); g.lineTo(x + 6, y + h * .9); g.fill();
  g.fillStyle = '#e4ddcc'; g.fillRect(x + w / 2 - 1.5, y + 7, 3, h - 7); if (h > 110) g.fillRect(x + 6, y + h * .3, w - 6, 2.5);
  g.fillStyle = 'rgba(255,255,248,.35)'; g.fillRect(x + w / 2 - 1.5, y + 7, 1, h - 7);
  if (o.curt) { g.fillStyle = 'rgba(238,232,214,.62)'; g.fillRect(x + 6, y + 7, (w - 6) * .5, h * .72); }
  if (o.blind) tapp(g, x + 3, y + 3, w - 3, h * (.3 + r() * .5), o.blind);
  if (st !== 'none') {
    const c = SH[o.sh || 'g'], lw = w / 2 + .5;
    if (st === 'closed') { oshut(g, x, y, lw, h, c); oshut(g, x + w - lw, y, lw, h, c); }
    else if (st === 'half') { oshut(g, x, y, lw, h, c); oshutOpen(g, x + w + fr, y, lw, h, c, 1); }
    else { oshutOpen(g, x - fr - lw * .44, y, lw, h, c, -1); oshutOpen(g, x + w + fr, y, lw, h, c, 1); }
  }
  if (o.sill) {
    g.fillStyle = '#f2ecdd'; g.fillRect(x - fr - 7, y + h + fr, w + 2 * fr + 14, 7); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - fr - 7, y + h + fr, w + 2 * fr + 14, 1.6);
    g.fillStyle = 'rgba(30,20,10,.4)'; g.fillRect(x - fr - 7, y + h + fr + 7, w + 2 * fr + 14, 4);
    for (const bx of [x - fr - 3, x + w + fr - 7]) { g.fillStyle = stn; g.beginPath(); g.moveTo(bx, y + h + fr + 7); g.lineTo(bx + 10, y + h + fr + 7); g.lineTo(bx + 8, y + h + fr + 22); g.lineTo(bx + 2, y + h + fr + 15); g.closePath(); g.fill(); g.fillStyle = 'rgba(60,45,30,.35)'; g.fillRect(bx + 7, y + h + fr + 7, 3, 12); }   // the two brackets under it
    g.fillStyle = 'rgba(70,58,44,.16)'; g.fillRect(x - fr, y + h + fr + 11, w + 2 * fr, 40);   // rain stain under the sill, fading
  }
  if (o.pots) for (let i = 0; i < 3; i++) { const px = x + 6 + i * (w - 12) / 2.2 + r() * 6; g.fillStyle = '#9a5a3e'; g.fillRect(px - 7, y + h + fr - 12, 15, 12); g.fillStyle = ['#4f7a3a', '#5a8a44', '#c8423a'][i % 3]; g.beginPath(); g.arc(px, y + h + fr - 18, 9, 0, 7); g.fill(); }
  if (o.ac) acUnit(g, x + w + fr + 6, y + h * .5);
}
function lintelShade(g) { const gr = g.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, 'rgba(40,30,20,.28)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 30); }
function ofloor(g, r, line = true) {   // the render of a floor: aged, a shadow under the string course above, and the string course (a projecting band) along the bottom
  obase(g); opatch(g, r, 1 + (r() < .5 ? 1 : 0)); lintelShade(g);
  if (line) {
    g.fillStyle = 'rgba(40,30,20,.20)'; g.fillRect(0, T - 14, T, 3);
    g.fillStyle = '#ece5d1'; g.fillRect(0, T - 11, T, 7); g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(0, T - 11, T, 1.6);
    g.fillStyle = 'rgba(40,30,20,.34)'; g.fillRect(0, T - 4, T, 4);
    const gr = g.createLinearGradient(0, T - 40, 0, T - 14); gr.addColorStop(0, 'rgba(70,58,44,0)'); gr.addColorStop(1, 'rgba(70,58,44,.10)'); g.fillStyle = gr; g.fillRect(0, T - 40, T, 26);
  }
}
function wash(g, r, n) {   // broad soft clouds of a warmer, cooler, darker or paler wash over the render: large, low contrast, nothing with an edge
  for (let i = 0; i < n; i++) {
    const x = r() * T, y = r() * T, rad = 50 + r() * 80, k = r(), col = k < .3 ? '170,120,84' : k < .55 ? '255,248,232' : k < .8 ? '110,100,86' : '150,160,150', a = .05 + r() * .09;
    wrapped(x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 1, X, Y, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, 2 * rad, 2 * rad); });
  }
}
function crack(g, r) {   // a hairline crack, faint
  g.strokeStyle = 'rgba(60,48,36,.28)'; g.lineWidth = 1; let x = 40 + r() * 170, y = 20 + r() * 40; g.beginPath(); g.moveTo(x, y);
  for (let k = 0; k < 8; k++) { x += (r() - .5) * 14; y += 8 + r() * 14; g.lineTo(x, y); } g.stroke();
}
const F0 = 34, FH = 188;   // a French window: from the top of the cell to the floor
// upper floors (one bay of one floor each)
const OUP = [
  (g, r) => owin(g, r, 90, F0, 76, FH, { st: 'closed', sh: 'g', hood: 1 }),
  (g, r) => owin(g, r, 90, F0, 76, FH, { st: 'open', sh: 'o', curt: 1, ped: 'seg' }),
  (g, r) => owin(g, r, 90, F0, 76, FH, { st: 'half', sh: 'x', hood: 1 }),
  (g, r) => owin(g, r, 90, F0, 76, FH, { blind: '#cfc8b6', ac: r() < .5, hood: 1 }),
  (g, r) => owin(g, r, 92, 62, 72, 138, { st: 'closed', sh: 'o', sill: 1, pots: 1 }),
  (g, r) => { owin(g, r, 92, 62, 72, 138, { sill: 1, curt: 1 }); g.strokeStyle = '#666'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 30); g.lineTo(248, 38); g.stroke(); const cl = ['#e8e8e0', '#c8423a', '#3a64a8', '#e8c43a', '#f2f2f2', '#6aa05a']; for (let i = 0; i < 6; i++) { g.fillStyle = cl[(r() * cl.length) | 0]; g.fillRect(16 + i * 38, 32 + i * 1.3, 16 + r() * 12, 24 + r() * 22); } },
  (g, r) => owin(g, r, 90, F0, 76, FH, { st: 'closed', sh: 'x', hood: 1 }),
  (g, r) => { g.fillStyle = '#f1ebdb'; g.fillRect(78, 54, 100, 160); g.fillStyle = 'rgba(40,30,20,.14)'; g.fillRect(88, 64, 80, 140); g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(88, 64, 80, 5); g.fillRect(88, 64, 5, 140); },   // a painted-in blind window
].map((f, i) => (g, r) => { ofloor(g, r); f(g, r); streak(g, 100 + (i % 3) * 20, 214, 34, 9, .14); streak(g, 60 + i * 12, 0, 50, 12, .12); });
const ONOB = [
  (g, r) => owin(g, r, 74, 56, 108, 190, { st: 'open', sh: 'v', ped: 'tri', fr: 10 }),
  (g, r) => owin(g, r, 74, 56, 108, 190, { st: 'closed', sh: 'o', ped: 'seg', fr: 10 }),
  (g, r) => owin(g, r, 70, 46, 116, 200, { st: 'half', sh: 'x', hood: 1, fr: 10 }),
  (g, r) => { owin(g, r, 54, 52, 62, 194, { st: 'open', sh: 'g', ped: 'seg', fr: 8 }); owin(g, r, 140, 52, 62, 194, { st: 'closed', sh: 'g', ped: 'seg', fr: 8 }); },
].map(f => (g, r) => { ofloor(g, r); f(g, r); g.fillStyle = '#e2d9c2'; g.fillRect(0, T - 12, T, 6); });
const OTOP = [
  (g, r) => owin(g, r, 98, 74, 60, 88, { st: 'closed', sh: 'g', sill: 1, fr: 7 }),
  (g, r) => { owin(g, r, 54, 84, 40, 60, { st: 'closed', sh: 'o', fr: 6 }); owin(g, r, 162, 84, 40, 60, { fr: 6, curt: 1 }); },
  (g, r) => owin(g, r, 96, 70, 64, 100, { st: 'half', sh: 'x', sill: 1, pots: 1, fr: 7 }),
].map(f => (g, r) => { ofloor(g, r, false); const gr = g.createLinearGradient(0, 0, 0, 46); gr.addColorStop(0, 'rgba(40,30,20,.32)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 46); f(g, r); });
// ground floors: doors, small shops, low windows
const ODOOR = [
  (g, r) => {   // arched double door in a stone ring
    obase(g); orust(g, r, 0, 0, T, T - 44, '#e9e0c9'); oskirt(g);
    g.fillStyle = '#d9cfb6'; archPath(g, 128, 112, 78, T - 44); g.fill(); ovouss(g, 128, 112, 64, 78);
    g.fillStyle = '#17120e'; archPath(g, 128, 116, 64, T - 44); g.fill(); const c = WOOD[(r() * 3) | 0];
    g.save(); archPath(g, 128, 116, 62, T - 44); g.clip(); oleaf(g, r, 66, 54, 61, T, c); oleaf(g, r, 129, 54, 61, T, c); g.restore();
    g.fillStyle = '#c9a24a'; g.fillRect(116, 150, 5, 20); g.fillRect(135, 150, 5, 20); g.fillStyle = '#b9ae98'; g.fillRect(50, T - 50, 156, 7);
  },
  (g, r) => {   // a plain wooden door under a flat lintel with a pediment, a barred window beside it
    obase(g); opatch(g, r, 1); oskirt(g); g.fillStyle = '#f2ecdd'; g.fillRect(82, 56, 92, T - 100); ped(g, 82, 56, 92, 'seg', '#f2ecdd');
    g.fillStyle = '#17120e'; g.fillRect(92, 66, 72, T - 110); oleaf(g, r, 92, 66, 72, T - 110, WOOD[(r() * WOOD.length) | 0]); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(127, 66, 3, T - 110); g.fillStyle = '#c9a24a'; g.fillRect(118, 140, 5, 16);
    g.fillStyle = '#1b1612'; g.fillRect(190, 96, 44, 70); g.strokeStyle = '#26262c'; g.lineWidth = 3; for (let x = 198; x < 232; x += 10) { g.beginPath(); g.moveTo(x, 96); g.lineTo(x, 166); g.stroke(); } g.beginPath(); g.moveTo(190, 130); g.lineTo(234, 130); g.stroke();
    g.fillStyle = '#e4dcc4'; g.fillRect(184, 166, 56, 7); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(184, 173, 56, 3);
  },
  (g, r) => {   // a carriage door (portone carrabile): tall arch, studded boards, a wicket
    obase(g); orust(g, r, 0, 0, T, T - 44, '#e6dcc2'); oskirt(g);
    g.fillStyle = '#d4c9ae'; archPath(g, 128, 100, 90, T - 44); g.fill(); ovouss(g, 128, 100, 78, 90); g.fillStyle = '#17120e'; archPath(g, 128, 104, 78, T - 44); g.fill();
    g.save(); archPath(g, 128, 104, 76, T - 44); g.clip(); const c = WOOD[(r() * WOOD.length) | 0]; oleaf(g, r, 50, 26, 77, T, c); oleaf(g, r, 129, 26, 77, T, c); g.restore();
    for (let y = 70; y < T - 60; y += 28) for (const x of [66, 100, 150, 184]) { g.fillStyle = '#9a7a44'; g.fillRect(x, y, 4, 4); }
    g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(126, 28, 4, T - 72); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(142, 140, 36, 70); g.fillStyle = '#b8924a'; g.fillRect(148, 170, 5, 5);
  },
  (g, r) => {   // an open passage to a courtyard (androne)
    obase(g); oskirt(g); g.fillStyle = '#e3d9bf'; archPath(g, 128, 108, 72, T - 44); g.fill();
    const gr = g.createLinearGradient(0, 70, 0, T); gr.addColorStop(0, '#120f0c'); gr.addColorStop(1, '#2c261f'); g.fillStyle = gr; archPath(g, 128, 112, 60, T - 44); g.fill();
    g.fillStyle = 'rgba(205,185,140,.55)'; g.fillRect(104, 138, 48, 74); g.fillStyle = 'rgba(80,66,46,.6)'; g.fillRect(104, 190, 48, 22); g.fillStyle = '#d8cdb0'; g.fillRect(56, T - 50, 144, 7);
  },
  (g, r) => {   // a plain door in a stone frame
    obase(g); opatch(g, r, 1); oskirt(g); g.fillStyle = '#e4dcc6'; g.fillRect(86, 94, 84, T - 138); g.fillStyle = '#17120e'; g.fillRect(94, 102, 68, T - 146); oleaf(g, r, 94, 102, 68, T - 146, WOOD[(r() * 3) | 0]);
    g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(84, 90, 88, 4);
  },
];
const OSHOP = [
  (g, r) => {   // a little bottega shut behind dark wooden folding shutters
    obase(g); oskirt(g); g.fillStyle = '#e8dfc8'; g.fillRect(34, 40, 188, T - 84); g.fillStyle = '#16120e'; g.fillRect(42, 50, 172, T - 100);
    for (let x = 42; x < 214; x += 43) oleaf(g, r, x, 50, 43, T - 100, '#4a3426');
    g.fillStyle = r() < .5 ? '#6a2a24' : '#2f4a38'; g.fillRect(42, 20, 172, 22); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(42, 20, 172, 3);
  },
  (g, r) => {   // a metal roller shutter in a plain frame, worn and rusty, tagged
    obase(g); oskirt(g); g.fillStyle = '#e9e1cd'; g.fillRect(30, 46, 196, T - 90); rollShutter(g, r, 40, 56, 176, T - 100, r() < .5 ? '#7a7b74' : '#6b5f52');
    g.fillStyle = '#4a4a47'; g.fillRect(40, 44, 176, 14); g.fillStyle = 'rgba(150,80,40,.25)'; for (let i = 0; i < 5; i++) g.fillRect(50 + r() * 150, 120 + r() * 70, 5, 30 + r() * 30);
  },
  (g, r) => {   // an open small shop: lit window, goods, a striped awning
    obase(g); oskirt(g); g.fillStyle = '#e8dfc8'; g.fillRect(24, 30, 208, T - 74); glassFront(g, 34, 70, 120, T - 140, '#f0d090', '#7a5a34');
    for (let i = 0; i < 6; i++) { g.fillStyle = PRODUCE[(r() * PRODUCE.length) | 0]; g.fillRect(44 + i * 18, 150 + (i % 2) * 10, 14, 24); }
    g.fillStyle = '#2a2420'; g.fillRect(164, 70, 56, T - 140); g.fillStyle = 'rgba(210,225,240,.2)'; g.fillRect(168, 74, 48, T - 148);
    const c = [['#c8281e', '#efe9d8'], ['#2f6a45', '#efe9d8'], ['#d8721c', '#efe9d8'], ['#2a5aa0', '#efe9d8']][(r() * 4) | 0]; stripedAwning(g, 26, 36, 204, 24, c[0], c[1]);
  },
  (g, r) => {   // a low arched shop opening onto a dark room, crates in front
    obase(g); oskirt(g); g.fillStyle = '#ddd2b6'; archPath(g, 128, 112, 84, T - 44); g.fill(); g.fillStyle = '#1b160f'; archPath(g, 128, 116, 72, T - 44); g.fill();
    g.fillStyle = 'rgba(255,214,140,.3)'; g.fillRect(74, 120, 108, 60); for (let i = 0; i < 6; i++) { g.fillStyle = PRODUCE[(r() * PRODUCE.length) | 0]; g.fillRect(80 + i * 16, 132 + (i % 2) * 18, 12, 14); }
    crateRow(g, r, 60, 200, T - 100, 54, PRODUCE);
  },
];
const OLOW = [
  (g, r) => { obase(g); oskirt(g); opatch(g, r, 1); owin(g, r, 88, 70, 80, 98, { st: 'half', sh: 'g', sill: 1, fr: 8 }); g.strokeStyle = '#26262c'; g.lineWidth = 3.5; for (let x = 96; x < 168; x += 14) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 168); g.stroke(); } },
  (g, r) => { obase(g); oskirt(g); opatch(g, r, 1); owin(g, r, 50, 78, 56, 84, { st: 'closed', sh: 'o', fr: 7 }); owin(g, r, 150, 78, 56, 84, { st: 'open', sh: 'o', curt: 1, fr: 7 }); },
  (g, r) => { obase(g); oskirt(g); g.fillStyle = 'rgba(40,30,20,.1)'; g.fillRect(0, 0, T, T - 44); opatch(g, r, 2); g.fillStyle = '#d8d0bc'; g.fillRect(180, 90, 34, 40); g.fillStyle = '#6a6a66'; g.fillRect(186, 96, 22, 4); g.fillRect(186, 104, 22, 4); g.fillStyle = '#9a9a92'; g.fillRect(40, 40, 7, T - 84); },   // blank wall: meter box, drainpipe
];
const OWALL = [   // blind side and party walls: worn plaster with soft tonal variation, a few stains and a patch or two; no hard features, so a run of tiles does not show a grid (the group picks another variant per tile)
  (g, r) => { obase(g); wash(g, r, 4); opatch(g, r, 2, [0, .5]); },
  (g, r) => { obase(g); wash(g, r, 5); for (let i = 0; i < 3; i++) streak(g, 30 + r() * 190, r() * 60, 90 + r() * 90, 8 + r() * 14, .12); opatch(g, r, 1, [0, .3]); },
  (g, r) => { obase(g); wash(g, r, 3); opatch(g, r, 1, [.3, .6]); crack(g, r); },
  (g, r) => { obase(g); wash(g, r, 4); opatch(g, r, 1, [0, .4]); g.fillStyle = 'rgba(70,58,44,.10)'; g.fillRect(96, 50, 64, 110); g.fillStyle = 'rgba(40,32,24,.14)'; g.fillRect(96, 50, 64, 3); g.fillRect(96, 50, 3, 110); g.fillStyle = 'rgba(214,202,176,.35)'; g.fillRect(92, 160, 72, 4); },   // a bricked-up opening, hardly there
  (g, r) => { obase(g); wash(g, r, 6); opatch(g, r, 2, [0, .2]); for (let i = 0; i < 2; i++) streak(g, 20 + r() * 210, 0, 120 + r() * 90, 14 + r() * 20, .09); },
  // [oldtown] the blind faces are not all blind: a flank wall that stands above its neighbour has the odd small window, a drainpipe, the ghost of a house that is gone. Three variants of those, so an exposed flank has some relief
  (g, r) => { obase(g); wash(g, r, 3); owin(g, r, 112, 64, 34, 70, { fr: 5, st: r() < .5 ? 'closed' : 'none', sh: r() < .5 ? 'g' : 'o' }); if (r() < .6) grilleAt(g, 112, 64, 34, 70); opatch(g, r, 1, [0, .3]); },   // a stair or bathroom window, small, in a plain frame (some with an iron grille)
  (g, r) => { obase(g); wash(g, r, 4); const x = 50 + r() * 150; g.fillStyle = 'rgba(40,32,24,.28)'; g.fillRect(x + 5, 0, 8, T); g.fillStyle = '#8c887c'; g.fillRect(x, 0, 8, T); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x, 0, 2, T); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 20; y < T; y += 70) g.fillRect(x - 2, y, 12, 4);   // a drainpipe with its brackets, a meter box, a cable
    g.fillStyle = '#d4cdba'; g.fillRect(x + 22, 118, 30, 38); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 22, 156, 30, 3); g.fillStyle = 'rgba(30,26,22,.55)'; g.fillRect(x + 8, 128, 14, 1.6); g.fillRect(x + 52, 135, 60 + r() * 60, 1.6); opatch(g, r, 1, [0, .2]); },
  (g, r) => { obase(g); wash(g, r, 3); const cut = 70 + r() * 80; g.fillStyle = 'rgba(255,248,230,.20)'; g.beginPath(); g.moveTo(-4, T + 4); g.lineTo(-4, cut); g.lineTo(T * (.55 + r() * .3), cut + 50 * (r() - .5)); g.lineTo(T * (.55 + r() * .3), T + 4); g.closePath(); g.fill();   // the ghost of a demolished neighbour: a paler patch with the slope of its roof, the line of its floors
    g.strokeStyle = 'rgba(70,56,40,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, cut); g.lineTo(T * .7, cut + 8); g.stroke(); g.fillStyle = 'rgba(70,56,40,.12)'; for (let y = cut + 70; y < T; y += 92) g.fillRect(0, y, T * .62, 3); },
];
// [texround2] Plain walls (party walls and short edges: L.blank, 4 m tiles; the blind ground floors of the suburbs: blank_g) used to be one tile with one tan patch, so the patch came back every 4 m in a grid.
// Now groups of seven and six variants on the same render (obase, so the tiles meet without a seam): big soft clouds of wash, damp and rain, the odd crack, and one variant in seven with a single large patch of stone.
const BLANKW = [
  (g, r) => { obase(g); wash(g, r, 4); },
  (g, r) => { obase(g); wash(g, r, 5); for (let i = 0; i < 2; i++) streak(g, 30 + r() * 190, r() * 40, 120 + r() * 90, 18 + r() * 24, .08); },
  (g, r) => { obase(g); wash(g, r, 3); opatch(g, r, 1, [0, .5]); },
  (g, r) => { obase(g); wash(g, r, 4); crack(g, r); },
  (g, r) => { obase(g); wash(g, r, 6); const gr = g.createLinearGradient(0, T * .55, 0, T); gr.addColorStop(0, 'rgba(70,58,44,0)'); gr.addColorStop(1, 'rgba(70,58,44,.14)'); g.fillStyle = gr; g.fillRect(0, T * .55, T, T * .45); },
  (g, r) => { obase(g); wash(g, r, 3); opatch(g, r, 1, [0, .25]); for (let i = 0; i < 2; i++) streak(g, 20 + r() * 210, 0, 100 + r() * 100, 14 + r() * 20, .08); },
  (g, r) => { obase(g); wash(g, r, 3); opatch(g, r, 1, [1, 1], 1.7); },
];
const BLANKG = [   // the blind ground floor: the same, with the damp foot of the wall
  (g, r) => { obase(g); wash(g, r, 3); dado(g, 70, .38); },
  (g, r) => { obase(g); wash(g, r, 4); dado(g, 54, .46); streak(g, 40 + r() * 170, 0, 120 + r() * 80, 20 + r() * 20, .08); },
  (g, r) => { obase(g); wash(g, r, 3); dado(g, 80, .34); opatch(g, r, 1, [0, .4]); },
  (g, r) => { obase(g); wash(g, r, 5); dado(g, 60, .42); crack(g, r); },
  (g, r) => { obase(g); wash(g, r, 4); dado(g, 64, .4); g.fillStyle = 'rgba(70,58,44,.10)'; for (let x = 0; x < T; x += 8) g.fillRect(x, T - 92 - ((x * 7) % 11), 8, 11); },   // a ragged tide mark of rising damp
  (g, r) => { obase(g); wash(g, r, 3); dado(g, 58, .4); opatch(g, r, 1, [1, 1], 1.5); },
];
const SHOPS = [   // the plain street shop (g_shop_s) in four states: shutters of different colours, one half raised on a lit window
  (g, r) => { plaster(g, r, '#e2dccd', { peel: 0 }); g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T); sign(g, r, 24, 24, 208, 40); g.fillStyle = '#d9d2c0'; g.fillRect(20, 66, 216, 4); rollShutter(g, r, 26, 70, 204, 170, '#8f8e86'); g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16); dado(g, 30, .3); },
  (g, r) => { plaster(g, r, '#e2dccd', { peel: 0 }); g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T); sign(g, r, 24, 24, 208, 40); g.fillStyle = '#d9d2c0'; g.fillRect(20, 66, 216, 4); glassFront(g, 28, 96, 200, 138, '#ecd49a', '#7a5a34'); for (let i = 0; i < 7; i++) { g.fillStyle = PRODUCE[(r() * PRODUCE.length) | 0]; g.fillRect(40 + i * 26, 160 + (i % 2) * 14, 18, 22); } rollShutter(g, r, 26, 70, 204, 30, '#7a7a74'); g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16); dado(g, 30, .3); },
  (g, r) => { plaster(g, r, '#e2dccd', { peel: 0 }); g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T); sign(g, r, 24, 24, 208, 40); g.fillStyle = '#d9d2c0'; g.fillRect(20, 66, 216, 4); rollShutter(g, r, 26, 70, 204, 170, '#74695a'); g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16); dado(g, 30, .3); },
  (g, r) => { plaster(g, r, '#e2dccd', { peel: 0 }); g.fillStyle = '#f1ebdb'; g.fillRect(0, 0, 14, T); g.fillRect(T - 14, 0, 14, T); sign(g, r, 24, 24, 208, 40); g.fillStyle = '#d9d2c0'; g.fillRect(20, 66, 216, 4); rollShutter(g, r, 26, 70, 204, 170, '#5f7062'); g.fillStyle = '#c6bda7'; g.fillRect(14, 240, 228, 16); dado(g, 30, .3); },
];
export const GMAP = { g_shop_s: 'g_shops', g_garage: 'g_gars', blank_g: 'g_blank' };   // ground-floor layer -> its group
// Stone fronts of the old town (isStone: a third or more of the buildings in the oldest zones) had the plain stoneUp window, one pane in a flat frame, whatever the street: here are the same windows, surrounds, shutters
// and hoods as the rendered fronts, on ashlar (fewer variants, to keep the atlas small), for the storeys, the piano nobile, the top floor and the blind walls.
const stonify = list => list.map(f => (g, r) => { STONEF = true; try { f(g, r); } finally { STONEF = false; } });
const OSTUP = stonify(OUP.slice(0, 5)), OSTNOB = stonify(ONOB.slice(0, 3)), OSTTOP = stonify(OTOP.slice(0, 2));
const OSTWALL = stonify([(g, r) => { obase(g); wash(g, r, 2); }, OWALL[5], OWALL[6], (g, r) => { obase(g); wash(g, r, 3); opatch(g, r, 1, [0, .3]); }]);
const OGROUPS = { zen_up: ZENUP, blank_v: BLANKW, g_blank: BLANKG, old_wall: OWALL, g_shops: SHOPS, old_up: OUP, old_nob: ONOB, old_top: OTOP, og_door: ODOOR, og_shop: OSHOP, og_low: OLOW, g_gars: GARS, pwd: PWD, pww: PWW, pwbd: PWBD, pwbw: PWBW, pwg: PWG, ost_up: OSTUP, ost_nob: OSTNOB, ost_top: OSTTOP, ost_wall: OSTWALL };
// the hand-drawn facades of the best known buildings (src/hero-facades.js): layers named hr_*, used by the walls whose spec says so (`bl`)
for (const [name, fn] of heroLayers({ T, obase, opatch, ofloor, owin, orust, ovouss, oskirt, archPath, oleaf, oshut, oshutOpen, oped, softNoise, wash, streak, SH })) layer(name, fn);
layer('wxnoise', (g, r) => {   // not a facade: smooth tiling noise for the weathering in the building shader (R broad patches, G vertical streaks); stored so that the linear value after sRGB decoding is the noise itself
  const im = g.createImageData(T, T), a = Array.from({ length: 64 }, () => r()), b = Array.from({ length: 128 }, () => r()), sm = t => t * t * (3 - 2 * t);
  const f = (G, nx, ny, x, y) => { const u = x / T * nx, v = y / T * ny, i = Math.floor(u), j = Math.floor(v), fu = sm(u - i), fv = sm(v - j), at = (ii, jj) => G[(jj % ny) * nx + (ii % nx)]; return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv; };
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const k = (y * T + x) * 4; im.data[k] = 255 * Math.pow(f(a, 8, 8, x, y), 1 / 2.2); im.data[k + 1] = 255 * Math.pow(f(b, 32, 4, x, y), 1 / 2.2); im.data[k + 3] = 255; }
  g.putImageData(im, 0, 0);
});
export const GROUPS = [], GROUP_SPAN = [];   // aLayer = 200 + index picks a group; uGrp[index] = (first layer, count) and the shader chooses the variant per bay and floor
for (const [name, list] of Object.entries(OGROUPS)) { list.forEach((fn, i) => layer(name + '_' + i, fn)); LID[name] = 200 + GROUPS.length; GROUP_SPAN.push([LID[name + '_0'], list.length]); GROUPS.push(name); }
// runs of consecutive layers that used to be one window type per building become groups too: each bay and floor picks its own (blinds, awnings and shutters differ from flat to flat)
export const UPGRP = {};
for (const [name, first, n] of [['res_up', 'res_a', 5], ['n19_up', 'n19_up_g', 3], ['bar_up', 'bar_up_g', 2], ['lib_up', 'lib_up_a', 2], ['bar_nobs', 'bar_nob_tri', 2]]) {
  LID[name] = 200 + GROUPS.length; GROUP_SPAN.push([LID[first], n]); GROUPS.push(name);
  for (let i = 0; i < n; i++) UPGRP[LAYERS[LID[first] + i].name] = name;
}


// one layer drawn on g (a T x T canvas): cleared first, seeded by its place in the atlas
export function paintLayer(g, i) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, T, T);
  LAYERS[i].fn(g, rng(9100 + i * 131));
}
// the painters' own canvases (the old-town render and the stone one): made again by the next layer that needs them
export function releaseLayerCanvases() { for (const c of [OBASE, OSTONE]) if (c) c.width = c.height = 0; OBASE = OSTONE = null; }
