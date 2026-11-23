// Piazza Castelnuovo and Piazza Ruggero Settimo (Piazza Politeama), Palermo: everything fixed in the piazza outside the Teatro Politeama itself.
// Each model was drawn from Wikimedia Commons photographs (only proportions and colours were read from them, nothing is copied into the game):
//   Tempietto / Palchetto della Musica (Salvatore Valenti, 1874-75, white Carrara marble, Corinthian): Palchetto della Musica, Palermo, Sicily, Italy (9455643959).jpg;
//     Piazza Castelnuovo - panoramio (1).jpg (front, the measuring photo); Palermo Sicily Italy - Creative Commons by gnuckx (3492485256), (3492486040), (3492486572).jpg (capitals, frieze);
//     Benedetto Civiletti Lavoro SAM 0166.JPG (the side colonnade); Palchetto della Musica at night, Palermo, Sicily, Italy (9458312090).jpg
//   Monumento a Ruggero Settimo (Benedetto De Lisi, 1865): Ruggero Settimo statua.jpg; Politeama Garibaldi e monumento a Ruggiero Settimo.jpg; Ruggero Settimo e la quadriga.jpg
//   Monumento a Carlo Cottone (Costantino, 1868): Carlo Cottone Monument (Palermo) 1.jpg; Piazza Politeama - panoramio.jpg (the whole group with its railing)
//   Nautica (Mario Rutelli): Mario Rutelli Nautica SAM 0172.JPG; Palermo Sicily Italy - Creative Commons by gnuckx (3491666519).jpg
//   Lavoro (Benedetto Civiletti): Benedetto Civiletti Lavoro SAM 0166.JPG; Il Lavoro, statua di Benedetto Civiletti di Palermo.jpg
//   I Senzatetto (Pasquale Civiletti): Palchetto della Musica, Palermo, Sicily, Italy (9455643959).jpg
//   Chiosco Ribaudo (Liberty kiosk): Chiosco Ribaudo Palermo1.jpg
// Where things stand: the OSM building w194689842 "Palchetto della musica" is the Tempietto (its position, -580, -949, equals the Commons geotag 38.12430752 N 13.35463252 E to the metre, and the
// front of the model faces the Politeama along the axis that also carries the Settimo and Cottone monuments). The Settimo monument is the 5.8 m square railing in the OSM fences (-461.8, -1010.3).
// The Cottone monument has no OSM node: it stands on that axis at the centre of Piazza Castelnuovo (Commons geotag of the piazza 38.12456619 N 13.35530334 E).
import * as THREE from 'three';
import {
  PI, bx, box, cyl, lathe, sphere, cone, panel, prism, begin, end, defMat, mul, tr, rotY, frame, initShared,
  noiseDots, streaks, RNG, pairsOf, groundRange, groundY, balus, gable,
} from './lmc-kit.js';

// ---------------------------------------------------------------------------------------------------
// textures (every key starts with 'pz')
// ---------------------------------------------------------------------------------------------------
function paintMarble(g, w, h, seed, base, vein) {
  const r = RNG(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {   // soft grey and cream clouds: the Carrara marble is not one white
    const x = r() * w, y = r() * h, rx = 20 + r() * 60, ry = 8 + r() * 30;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.fillStyle = r() < 0.5 ? 'rgba(120,125,135,0.07)' : 'rgba(238,224,190,0.12)'; g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, 7); g.fill(); }
  }
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {   // blue-grey veins
    let x = r() * w, y = r() * h; g.strokeStyle = vein; g.lineWidth = 0.8 + r() * 1.4; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 36; y += (r() - 0.5) * 36; g.lineTo(x, y); }
    g.stroke();
  }
  noiseDots(g, w, h, w * h / 120, 1.6, seed + 3, ['rgba(80,70,55,0.10)', 'rgba(255,255,248,0.12)']);
  streaks(g, w, h, 8, seed + 5, 0.07, 70, '60,52,40');   // soot under every ledge
}

function setup() {
  initShared();
  defMat('pzMar', 256, 256, [3, 3], (g, w, h) => paintMarble(g, w, h, 4411, '#e2ded2', 'rgba(110,122,140,0.16)'));
  // fluted shaft: the canvas is one turn of the column (cyl maps u round the circumference) and 1.8 m of height; twelve flutes
  defMat('pzCol', 192, 256, [0.94, 1.9], (g, w, h) => {
    paintMarble(g, w, h, 4412, '#e6e2d6', 'rgba(104,118,142,0.22)');
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = i * w / n; g.fillStyle = 'rgba(70,70,70,0.20)'; g.fillRect(x, 0, 3, h);
      const gr = g.createLinearGradient(x + 3, 0, x + w / n, 0); gr.addColorStop(0, 'rgba(60,60,60,0.16)'); gr.addColorStop(0.5, 'rgba(255,255,250,0.0)'); gr.addColorStop(1, 'rgba(255,255,250,0.10)'); g.fillStyle = gr; g.fillRect(x + 3, 0, w / n - 3, h);
    }
  });
  // pietra di Billiemi, the grey limestone of the podium: ashlar courses 0.55 m, long blocks, soot and damp at the foot
  defMat('pzLime', 256, 256, [2.8, 2.8], (g, w, h) => {
    const r = RNG(4413); g.fillStyle = '#7d7a70'; g.fillRect(0, 0, w, h);
    const rows = 5, bh = h / rows;
    for (let j = 0; j < rows; j++) { let x = -r() * 60; while (x < w) { const bw = 80 + r() * 70, k = 0.93 + r() * 0.12; g.fillStyle = `rgb(${Math.round(186 * k)},${Math.round(182 * k)},${Math.round(168 * k)})`; g.fillRect(x + 1, j * bh + 1, bw - 2, bh - 2); x += bw; } }
    noiseDots(g, w, h, 2200, 2, 4414, ['rgba(70,64,52,0.14)', 'rgba(235,228,205,0.18)', 'rgba(60,70,50,0.08)']);
    streaks(g, w, h, 22, 4415, 0.16, 110, '50,44,34');
  });
  // the ceiling of the Tempietto: coffers, cream with terracotta and ochre borders and a gilt rosette in each
  defMat('pzCeil', 256, 256, [2.4, 2.4], (g, w, h) => {
    g.fillStyle = '#efe4c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64, y = j * 64; g.fillStyle = '#c9a070'; g.fillRect(x + 4, y + 4, 56, 56); g.fillStyle = '#f2e8cb'; g.fillRect(x + 9, y + 9, 46, 46);
      g.fillStyle = '#c0735a'; g.fillRect(x + 13, y + 13, 38, 38); g.fillStyle = '#eddcab'; g.fillRect(x + 17, y + 17, 30, 30);
      g.fillStyle = '#c79a3a'; g.beginPath(); g.arc(x + 32, y + 32, 8, 0, 7); g.fill(); g.fillStyle = '#7e5a2a'; g.beginPath(); g.arc(x + 32, y + 32, 3, 0, 7); g.fill();
    }
    noiseDots(g, w, h, 900, 2, 4416, ['rgba(90,70,40,0.16)', 'rgba(255,245,215,0.14)']);
    streaks(g, w, h, 8, 4417, 0.14, 60, '70,60,40');
  });
  // bronze with verdigris: dark brown-black metal under teal-green runs and crusts, as in the photographs of Nautica, Lavoro and the Senzatetto
  defMat('pzBron', 128, 128, [1.2, 1.2], (g, w, h) => {
    const r = RNG(4418); g.fillStyle = '#34423c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${86 + r() * 30},${150 + r() * 30},${130 + r() * 30},${0.22 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 20, 5 + r() * 14, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 30; i++) { const x = r() * w, y = r() * h, l = 14 + r() * 40; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(120,190,165,0.45)'); gr.addColorStop(1, 'rgba(120,190,165,0)'); g.fillStyle = gr; g.fillRect(x, y, 1.5 + r() * 2.5, l); }
    noiseDots(g, w, h, 500, 2, 4419, ['rgba(20,24,22,0.25)', 'rgba(140,200,180,0.22)']);
  });
  // wrought iron railing, drawn on a transparent panel one post-to-post bay wide (1.5 m x 1.2 m): lyre scrolls between rails with a garland, as on the Settimo monument
  defMat('pzIron', 192, 128, [1, 1], (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#5c6470'; g.fillStyle = '#5c6470'; g.lineCap = 'round';
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, h - 12); g.lineTo(w, h - 12); g.stroke(); g.beginPath(); g.moveTo(0, 14); g.lineTo(w, 14); g.stroke();
    g.lineWidth = 6;   // the two crossing lyre arms
    g.beginPath(); g.moveTo(8, h - 14); g.bezierCurveTo(60, h - 14, 70, 26, 96, 26); g.bezierCurveTo(122, 26, 132, h - 14, 184, h - 14); g.stroke();
    g.beginPath(); g.moveTo(8, 18); g.bezierCurveTo(60, 18, 70, h - 28, 96, h - 28); g.bezierCurveTo(122, h - 28, 132, 18, 184, 18); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(96, h / 2, 13, 0, 7); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#4b535e'; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(w / 2, 70, w, 30); g.stroke();   // garland swag
    g.fillStyle = '#5c6470'; for (const x of [4, w - 4]) g.fillRect(x - 3, 0, 6, h);
  }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  // the Liberty kiosk: cream paint, gilt lines, turquoise and white tile strips
  defMat('pzKio', 256, 256, [2.4, 2.4], (g, w, h) => {
    g.fillStyle = '#eadfc2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 700, 2, 4420, ['rgba(110,90,60,0.10)', 'rgba(255,252,238,0.14)']);
    g.fillStyle = '#7fb6ae'; g.fillRect(24, 24, 36, h - 48); g.fillStyle = '#d4c590'; g.fillRect(20, 24, 3, h - 48); g.fillRect(61, 24, 3, h - 48);
    g.fillStyle = '#e8efe2'; for (let y = 34; y < h - 34; y += 28) { g.beginPath(); g.arc(42, y, 7, 0, 7); g.fill(); }
    g.fillStyle = '#7fb6ae'; g.fillRect(w - 60, 24, 36, h - 48); g.fillStyle = '#d4c590'; g.fillRect(w - 64, 24, 3, h - 48); g.fillRect(w - 23, 24, 3, h - 48);
    g.fillStyle = '#e8efe2'; for (let y = 34; y < h - 34; y += 28) { g.beginPath(); g.arc(w - 42, y, 7, 0, 7); g.fill(); }
    streaks(g, w, h, 14, 4421, 0.14, 90, '60,50,36');
  });
}

// ---------------------------------------------------------------------------------------------------
// shared parts
// ---------------------------------------------------------------------------------------------------
const AX = [0.8883, -0.4592];   // front of the Tempietto and axis of the piazza (the Politeama is at the +z end); unit vector, bearing 63 degrees

// a line of iron railing from (x0,z0) to (x1,z1) in frame M, h metres tall: panels and a post with a spear head every bay (about 1.5 m)
function ironRun(M, x0, z0, x1, z1, h, y = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.5)), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  panel('pzIron', L, h, { M: mul(M, mul(tr((x0 + x1) / 2, y, (z0 + z1) / 2), rotY(Math.atan2(-dz, dx)))), uvk: [n, 1], noao: true });
  for (let i = 0; i <= n; i++) {
    const px = x0 + dx * L * i / n, pz = z0 + dz * L * i / n;
    box('pzIron', 0.07, h + 0.12, 0.07, { M, p: [px, y, pz], noao: true, uv: 'keep', uvk: [0.02, 0.5], uvo: [0.5, 0.1] });
    cone('pzIron', 0.06, 0.22, 4, { M, p: [px, y + h + 0.1, pz], noao: true, uv: 'keep', uvk: [0.02, 0.2], uvo: [0.5, 0.1] });
  }
}
function corinthian(M, x, y, z) {   // base, fluted shaft, Corinthian capital: 2.3 m in all
  const c = '#ebe7db';
  cyl('pzMar', 0.215, 0.22, 0.1, 10, { M, p: [x, y, z], c });
  cyl('pzMar', 0.185, 0.2, 0.08, 10, { M, p: [x, y + 0.1, z], c });
  cyl('pzCol', 0.145, 0.16, 1.9, 12, { M, p: [x, y + 0.18, z], noao: false });
  cyl('pzMar', 0.16, 0.16, 0.04, 10, { M, p: [x, y + 2.08, z], c });
  lathe('pzMar', [[0, 0], [0.15, 0], [0.19, 0.08], [0.22, 0.2], [0.26, 0.3], [0, 0.3]], 10, { M, p: [x, y + 2.1, z], c });   // the acanthus bell
  box('pzMar', 0.5, 0.06, 0.5, { M, p: [x, y + 2.38, z], c });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sphere('pzMar', 0.07, { M, p: [x + sx * 0.21, y + 2.32, z + sz * 0.21], seg: 6, c, noao: true });   // volutes
}
function sculptureBase(M, w, d, h, steps = 1) {
  for (let i = 0; i < steps; i++) bx('pzMar', M, -w / 2 - 0.2 * (steps - i), w / 2 + 0.2 * (steps - i), h * i / steps, h * (i + 1) / steps, -d / 2 - 0.2 * (steps - i), d / 2 + 0.2 * (steps - i), { c: '#ddd9cc' });
}

// a standing man in a long overcoat, h metres tall, on y = 0 of M: legs, coat, one hand on the chest, the other behind, a collar, a head (the Settimo and Cottone statues)
function figure(M, h, c, o = {}) {
  const k = h, na = true;
  for (const sx of [-1, 1]) { box('pzMar', 0.1 * k, 0.04 * k, 0.2 * k, { M, p: [sx * 0.05 * k, 0, 0.03 * k], c, noao: na }); box('pzMar', 0.075 * k, 0.28 * k, 0.075 * k, { M, p: [sx * 0.05 * k, 0.04 * k, 0], c, noao: na }); }
  lathe('pzMar', [[0, 0.28 * k], [0.125 * k, 0.28 * k], [0.14 * k, 0.4 * k], [0.125 * k, 0.55 * k], [0.12 * k, 0.66 * k], [0, 0.66 * k]], 8, { M, c, noao: na });   // the coat skirts
  box('pzMar', 0.3 * k, 0.2 * k, 0.17 * k, { M, p: [0, 0.62 * k, 0], c, noao: na });   // chest and shoulders
  box('pzMar', 0.07 * k, 0.2 * k, 0.07 * k, { M, p: [0.17 * k, 0.6 * k, 0.0], rz: 0.1, c, noao: na });   // the arm behind the back
  box('pzMar', 0.07 * k, 0.17 * k, 0.07 * k, { M, p: [-0.17 * k, 0.62 * k, 0.03 * k], rz: -0.1, c, noao: na });   // the arm bent to the chest
  box('pzMar', 0.18 * k, 0.07 * k, 0.07 * k, { M, p: [-0.07 * k, 0.72 * k, 0.1 * k], c, noao: na });   // the forearm and hand on the chest
  box('pzMar', 0.12 * k, 0.05 * k, 0.1 * k, { M, p: [0, 0.81 * k, 0], c, noao: na });   // collar
  sphere('pzMar', 0.062 * k, { M, p: [0, 0.86 * k, 0.005 * k], seg: 7, ky: 1.15, c, noao: na });
  if (o.scroll) box('pzMar', 0.06 * k, 0.14 * k, 0.06 * k, { M, p: [0.21 * k, 0.5 * k, 0.07 * k], rx: -0.5, c, noao: na });
}
function ground4(pts) { return groundRange(pts); }

// ---------------------------------------------------------------------------------------------------
// the Tempietto
// ---------------------------------------------------------------------------------------------------
const TEMP = [[-581.6, -942.6], [-586.5, -951.9], [-582.4, -954.0], [-578.4, -956.1], [-573.5, -946.9], [-577.5, -944.8]];   // OSM w194689842
const TC = [(TEMP[0][0] + TEMP[3][0]) / 2, (TEMP[0][1] + TEMP[3][1]) / 2];
function buildTempietto() {
  setup();
  const gr = ground4(TEMP), gy = gr.lo;   // the ground falls 0.8 m towards the front: the deck stands 1.05 m over the front pavement, the back foundation runs down into the slope
  const W = 8.9, D = 9.1, H0 = 1.05;            // podium (stairs take the remaining 0.8 m each side inside the 10.5 m of the footprint), deck height
  const M = frame(TC[0], gy, TC[1], AX[0], AX[1]);
  begin(gy);
  const z0 = -D / 2, z1 = D / 2, x1 = W / 2;
  // podium: grey limestone, a plinth course and a cornice
  bx('pzLime', M, -x1, x1, -1.2, H0, z0, z1);
  bx('pzLime', M, -x1 - 0.12, x1 + 0.12, -1.2, 0.18, z0 - 0.12, z1 + 0.12, { c: '#cfcab8' });
  bx('pzMar', M, -x1 - 0.1, x1 + 0.1, H0 - 0.12, H0, z0 - 0.1, z1 + 0.1, { c: '#d6d2c4' });
  bx('pzLime', M, -x1 + 0.1, x1 - 0.1, H0, H0 + 0.01, z0 + 0.1, z1 - 0.1, { c: '#cbc6b6' });
  // balustrade round the deck: pillars carrying a shield medallion, baluster panels between (the deck is open at the stair heads)
  const bh = 0.62, pill = (x, z) => { bx('pzMar', M, x - 0.15, x + 0.15, H0, H0 + bh + 0.08, z - 0.15, z + 0.15, { c: '#e0dcd0' }); bx('pzMar', M, x - 0.19, x + 0.19, H0 + bh + 0.08, H0 + bh + 0.16, z - 0.19, z + 0.19, { c: '#e6e2d6' }); };
  const zf = z1 - 0.2;
  for (const x of [-x1 + 0.2, -3.2, -2.15, -0.77, 0.77, 2.15, 3.2, x1 - 0.2]) { pill(x, zf); box('dark', 0.13, 0.2, 0.03, { M, p: [x, H0 + 0.26, zf + 0.16], c: '#6e6a60', noao: true }); }
  const run = (xa, xb, z) => { for (let a = Math.min(xa, xb); a < Math.max(xa, xb) - 0.01; ) { const b = Math.min(a + 1.4, Math.max(xa, xb)); balus(mul(M, tr((a + b) / 2, H0, z)), b - a - 0.3, bh, { c: '#d8d4c6' }); a = b; } };
  run(-x1 + 0.2, -3.2, zf); run(-3.2, -2.15, zf); run(-2.15, -0.77, zf); run(-0.77, 0.77, zf); run(0.77, 2.15, zf); run(2.15, 3.2, zf); run(3.2, x1 - 0.2, zf);
  const zb = z0 + 0.2; for (const x of [-x1 + 0.2, 0, x1 - 0.2]) pill(x, zb);
  run(-x1 + 0.2, 0, zb); run(0, x1 - 0.2, zb);
  for (const sg of [-1, 1]) {   // side balustrades, open for the stair head between z = 0.6 and 2.0
    const xs = sg * (x1 - 0.2), side = (za, zc) => balus(mul(M, mul(tr(xs, H0, (za + zc) / 2), rotY(PI / 2))), Math.abs(zc - za) - 0.3, bh, { c: '#d8d4c6' });
    for (const z of [z0 + 2.5, 0.6, 2.0]) pill(xs, z);
    side(zb, z0 + 2.5); side(z0 + 2.5, 0.6); side(2.0, zf);
    // the lateral flight outside the side wall: climbs towards the back from the front corner, 0.8 m wide, with an iron-and-stone parapet
    const n = 6, run0 = 3.7, zA = z1 - 0.05, rise = H0 / n;
    for (let i = 0; i < n; i++) bx('pzLime', M, sg * x1, sg * (x1 + 0.8), 0, rise * (i + 1), zA - run0 * (i + 1) / n, zA - run0 * i / n, { c: '#d4cfbf' });
    bx('pzMar', M, sg * (x1 + 0.7), sg * (x1 + 0.8), 0, 0.3 + 0.0, zA - run0, zA, { c: '#d8d4c6' });
    for (let i = 0; i <= 3; i++) { const z = zA - run0 * i / 3, y = rise * Math.max(1, i * 2); box('pzIron', 0.05, 0.9, 0.05, { M, p: [sg * (x1 + 0.75), y, z - 0.02], noao: true, uv: 'keep', uvk: [0.02, 0.5], uvo: [0.5, 0.1] }); }
  }
  // the colonnade (corner columns, a coupled pair each side of a wide central bay), set on the front edge of the deck
  const cxs = [-2.15, -1.37, -0.77, 0.77, 1.37, 2.15], zfc = 4.0 - 0.1, zbc = zfc - 6.8;
  const zs = [zfc, zfc - 0.8, zfc - 1.4, zbc + 1.4, zbc + 0.8, zbc];
  const cols = [];
  for (const x of cxs) cols.push([x, zfc], [x, zbc]);
  for (const z of zs) if (z !== zfc && z !== zbc) cols.push([-2.15, z], [2.15, z]);
  cols.push([-2.15, zfc], [2.15, zfc], [-2.15, zbc], [2.15, zbc]);
  const seen = new Set();
  for (const [x, z] of cols) { const k = x.toFixed(2) + ',' + z.toFixed(2); if (seen.has(k)) continue; seen.add(k); corinthian(mul(M, tr(0, H0, 0)), x, 0, z); }
  // entablature: architrave, a frieze with its panel, a dentilled cornice; then the flat roof with a dark cresting, and a pediment at each end
  const EY = H0 + 2.48, xe = 2.15 + 0.38, ze0 = zbc - 0.38, ze1 = zfc + 0.38;
  bx('pzMar', M, -xe, xe, EY, EY + 0.22, ze0, ze1, { c: '#e0dcd0' });
  bx('pzMar', M, -xe - 0.04, xe + 0.04, EY + 0.22, EY + 0.46, ze0 - 0.04, ze1 + 0.04, { c: '#d6d2c4' });
  bx('pzMar', M, -xe - 0.2, xe + 0.2, EY + 0.46, EY + 0.62, ze0 - 0.2, ze1 + 0.2, { c: '#e2ded2' });
  bx('pzMar', M, -xe - 0.2, xe + 0.2, EY + 0.62, EY + 0.70, ze0 - 0.2, ze1 + 0.2, { c: '#d4d0c2' });
  for (let i = -5; i <= 5; i++) {   // dentils under the cornice on the front and the back
    for (const z of [ze1 + 0.1, ze0 - 0.1]) box('pzMar', 0.1, 0.1, 0.1, { M, p: [i * 0.45, EY + 0.37, z], c: '#d8d4c6' });
  }
  box('pzCeil', xe * 2 - 0.1, 0.05, ze1 - ze0 - 0.1, { M, p: [0, H0 + 2.46, (ze0 + ze1) / 2], noao: true, uv: 'world' });   // the coffered ceiling under the beams
  for (const x of [-0.77 - 0.3, 0, 0.77 + 0.3]) bx('pzMar', M, x - 0.07, x + 0.07, H0 + 2.38, H0 + 2.48, ze0 + 0.3, ze1 - 0.3, { c: '#d6d2c4' });
  bx('flat', M, -xe - 0.12, xe + 0.12, EY + 0.70, EY + 0.76, ze0 - 0.12, ze1 + 0.12, { c: '#69665e' });
  for (const sg of [-1, 1]) for (let i = 0; i < 12; i++) {   // dark cresting of palmettes along the roof edge
    const x = sg * (xe + 0.05), z = ze0 + (ze1 - ze0) * (i + 0.5) / 12;
    cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, z], c: '#4a4a46', noao: true });
  }
  for (let i = 0; i < 9; i++) { const x = -xe + (2 * xe) * (i + 0.5) / 9; cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, ze1 + 0.08], c: '#4a4a46', noao: true }); cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, ze0 - 0.08], c: '#4a4a46', noao: true }); }
  // central gable over the four coupled columns: roof running front to back, a tympanum at each end
  const GW = 3.85, GR = 0.62;
  gable('lead', 'pzMar', mul(M, tr(0, 0, (ze0 + ze1) / 2)), GW, ze1 - ze0 + 0.1, EY + 0.76, GR, { ov: 0.1, th: 0.1, c: '#8f9690', wc: '#e0dcd0' });
  for (const z of [ze1 + 0.1, ze0 - 0.1]) bx('pzMar', M, -GW / 2 - 0.1, GW / 2 + 0.1, EY + 0.76, EY + 0.86, z - 0.14, z + 0.14, { c: '#d8d4c6' });
  sphere('pzMar', 0.13, { M, p: [0, EY + 0.76 + GR + 0.15, ze1 + 0.05], seg: 6, c: '#d6d2c4', noao: true }); cone('dark', 0.12, 0.3, 4, { M, p: [0, EY + 0.76 + GR + 0.15, ze1 + 0.05], c: '#4a4a46', noao: true });
  const o = end('Tempietto (Palchetto della Musica)');
  return o;
}
export const TEMPIETTO = { name: 'Tempietto (Palchetto della Musica)', x: TC[0], z: TC[1], radius: 16, skipIds: ['w194689842'], build: buildTempietto };

// ---------------------------------------------------------------------------------------------------
// Monumento a Ruggero Settimo: three steps, a plinth, a plain pedestal with a wreath frieze under a cornice, the marble statue; inside a 5.8 m square of grey iron railing
// ---------------------------------------------------------------------------------------------------
const SET = [-461.8, -1010.3], SETN = [-AX[0], -AX[1]];   // the inscription (and the statue) face away from the theatre
function buildSettimo() {
  setup();
  const gy = groundY(SET[0], SET[1]);
  const M = frame(SET[0], gy, SET[1], SETN[0], SETN[1]);
  begin(gy);
  // steps 0.3 m each (3.5, 3.2, 2.9 square), plinth 3.0 x 1.55, shaft 2.2 x 2.35, moulding, cornice 3.0 x 0.55, top plinth 1.25, statue 2.9
  for (let i = 0; i < 3; i++) { const s = 1.75 - i * 0.15; bx('pzMar', M, -s, s, i * 0.3 - 0.4, (i + 1) * 0.3, -s, s, { c: '#d2cec2' }); }
  bx('pzMar', M, -1.5, 1.5, 0.9, 2.45, -1.5, 1.5, { c: '#dcd8cc' });
  bx('pzMar', M, -1.62, 1.62, 2.45, 2.62, -1.62, 1.62, { c: '#e2ded2' });
  bx('pzMar', M, -1.1, 1.1, 2.62, 4.97, -1.1, 1.1, { c: '#e6e2d6' });
  bx('pzMar', M, -1.2, 1.2, 4.97, 5.1, -1.2, 1.2, { c: '#dcd8cc' });
  bx('pzMar', M, -1.15, 1.15, 5.1, 5.38, -1.15, 1.15, { c: '#d8d4c8' });   // the wreath frieze band
  for (let i = 0; i < 5; i++) { sphere('pzMar', 0.13, { M, p: [-0.9 + i * 0.45, 5.25, 1.17], seg: 6, ky: 0.8, c: '#cfcbbd', noao: true }); }
  bx('pzMar', M, -1.5, 1.5, 5.38, 5.96, -1.5, 1.5, { c: '#e2ded2' });
  bx('pzMar', M, -1.62, 1.62, 5.96, 6.1, -1.62, 1.62, { c: '#dedace' });
  bx('pzMar', M, -0.75, 0.75, 6.1, 6.32, -0.7, 0.7, { c: '#dcd8cc' });
  box('dark', 1.4, 0.4, 0.03, { M, p: [0, 3.5, 1.11], c: '#a9a598', noao: true });   // the lettering block on the front of the shaft
  figure(mul(M, tr(0, 6.32, 0)), 2.9, '#e6e2d6');
  box('pzMar', 0.55, 0.5, 0.4, { M, p: [-0.05, 6.32, -0.3], c: '#d9d5c8', noao: true });   // the support behind the legs
  // the railing round it: 5.8 m square, ornate panels, spear posts at the corners
  const q = 2.9, h = 1.3;
  ironRun(M, -q, q, q, q, h, 0); ironRun(M, q, q, q, -q, h, 0); ironRun(M, q, -q, -q, -q, h, 0); ironRun(M, -q, -q, -q, q, h, 0);
  return end('Monumento a Ruggero Settimo');
}
export const SETTIMO = {
  name: 'Monumento a Ruggero Settimo', x: SET[0], z: SET[1], radius: 10, skipIds: [], build: buildSettimo,
  clearFences: (f) => f.filter(o => !(o.p && o.s === 1 && Math.hypot(o.p[0] - SET[0], o.p[1] - SET[1]) < 6)),   // the OSM square fence round it, which the railing of the model replaces
};

// ---------------------------------------------------------------------------------------------------
// Monumento a Carlo Cottone: statue of the Prince of Castelnuovo on a pedestal with a dentilled cornice and a medusa frieze, two steps, stone corner posts and iron panels round it
// ---------------------------------------------------------------------------------------------------
const COT = [-526.95, -976.95];   // the centre of the 6.8 m square OSM fence round it, on the axis 59.8 m from the Tempietto
function buildCottone() {
  setup();
  const gy = groundY(COT[0], COT[1]);
  const M = frame(COT[0], gy, COT[1], AX[0], AX[1]);
  begin(gy);
  for (let i = 0; i < 2; i++) { const s = 1.6 - i * 0.12; bx('pzMar', M, -s, s, i * 0.28 - 0.3, (i + 1) * 0.28, -s, s, { c: '#bfbbb0' }); }
  bx('pzMar', M, -1.35, 1.35, 0.56, 1.5, -1.35, 1.35, { c: '#cbc7bb' });
  bx('pzMar', M, -1.25, 1.25, 1.5, 1.72, -1.25, 1.25, { c: '#dedacd' });
  bx('pzMar', M, -1.0, 1.0, 1.72, 4.1, -1.0, 1.0, { c: '#e6e2d6' });
  bx('pzMar', M, -1.12, 1.12, 4.1, 4.28, -1.12, 1.12, { c: '#e0dcd0' });
  bx('pzMar', M, -1.0, 1.0, 4.28, 4.66, -1.0, 1.0, { c: '#d8d4c8' });   // frieze with the medusa head
  sphere('pzMar', 0.17, { M, p: [0, 4.47, 1.02], seg: 6, c: '#cfcbbd', noao: true });
  bx('pzMar', M, -1.45, 1.45, 4.66, 4.96, -1.45, 1.45, { c: '#e2ded2' });
  for (let i = -3; i <= 3; i++) box('pzMar', 0.1, 0.12, 0.1, { M, p: [i * 0.42, 4.54, 1.4], c: '#d4d0c4', noao: true });   // the dentils
  bx('pzMar', M, -0.9, 0.9, 4.96, 5.18, -0.9, 0.9, { c: '#dcd8cc' });
  figure(mul(M, tr(0, 5.18, 0)), 2.8, '#e2ded2', { scroll: true });
  // the enclosure: stone posts at the corners (a lantern on each) and iron panels between them, a gap in the middle of the front and the back
  const q = 3.42, hp = 1.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bx('pzMar', M, sx * q - 0.25, sx * q + 0.25, 0, hp, sz * q - 0.25, sz * q + 0.25, { c: '#d6d2c6' });
    bx('pzMar', M, sx * q - 0.31, sx * q + 0.31, hp, hp + 0.12, sz * q - 0.31, sz * q + 0.31, { c: '#e0dcd0' });
    box('pzBron', 0.2, 0.3, 0.2, { M, p: [sx * q, hp + 0.12, sz * q], noao: true });
  }
  ironRun(M, -q + 0.3, q, -0.9, q, 1.0); ironRun(M, 0.9, q, q - 0.3, q, 1.0);
  ironRun(M, -q + 0.3, -q, -0.9, -q, 1.0); ironRun(M, 0.9, -q, q - 0.3, -q, 1.0);
  ironRun(M, q, q - 0.3, q, -q + 0.3, 1.0); ironRun(M, -q, q - 0.3, -q, -q + 0.3, 1.0);
  return end('Monumento a Carlo Cottone');
}
const sq = (cx, cz, r) => [[cx - r, cz - r, cx + r, cz - r], [cx + r, cz - r, cx + r, cz + r], [cx + r, cz + r, cx - r, cz + r], [cx - r, cz + r, cx - r, cz - r]];
export const COTTONE = { name: 'Monumento a Carlo Cottone', x: COT[0], z: COT[1], radius: 10, skipIds: [], build: buildCottone,
  clearFences: (f) => f.filter(o => !(o.p && o.s === 1 && Math.hypot(o.p[0] - COT[0], o.p[1] - COT[1]) < 6)) };   // the OSM fence square round it (its collision stays)

// ---------------------------------------------------------------------------------------------------
// the three bronzes of Piazza Castelnuovo (positions are the OSM nodes): Nautica, I Senzatetto, Lavoro. The OSM node of each is also drawn as a generic obelisk by src/props.js.
// The figures are simplified masses read from the photographs: verdigris bronze on a white marble base.
// ---------------------------------------------------------------------------------------------------
function bronze(M, sx, sy, sz, p, o = {}) { box('pzBron', sx, sy, sz, { M, p, noao: true, uv: 'world', ...o }); }
function buildNautica() {   // a seated woman in a long dress, a cloak flying behind, one hand held out, on a coil of rope on a plinth
  setup();
  const P = [-568.7, -974.6], gy = groundY(P[0], P[1]), M = frame(P[0], gy, P[1], AX[0], AX[1]);
  begin(gy);
  sculptureBase(M, 2.2, 1.5, 0.5, 2);
  bronze(M, 1.5, 0.28, 1.0, [0, 0.5, 0]);   // the bronze slab
  for (let i = 0; i < 4; i++) cyl('pzBron', 0.5 - i * 0.02, 0.52 - i * 0.02, 0.15, 9, { M, p: [-0.15, 0.78 + i * 0.13, -0.05], noao: true });   // the coil of rope
  bronze(M, 0.8, 0.5, 0.55, [-0.1, 1.3, 0.2], { rx: -0.1 });   // lap
  bronze(M, 0.75, 1.0, 0.8, [-0.2, 1.3, 0.1], { ry: 0.1 });   // skirt falling over the coil
  bronze(M, 0.55, 0.85, 0.4, [-0.25, 1.55, -0.1], { rx: 0.35 });   // torso, leaning forward
  bronze(M, 0.3, 0.9, 0.1, [-0.35, 1.45, -0.55], { rx: -0.25 });   // cloak flying behind
  sphere('pzBron', 0.17, { M, p: [-0.25, 2.5, 0.2], seg: 6, noao: true });
  bronze(M, 0.12, 0.12, 0.8, [-0.1, 1.9, 0.6], { rx: -0.15 });   // the outstretched arm
  return end('Nautica');
}
function buildSenzatetto() {   // two boys: one seated with his chin on his fist, one asleep against the other, on a rough bronze block, with a stepped marble base
  setup();
  const P = [-560.7, -960.7], gy = groundY(P[0], P[1]), M = frame(P[0], gy, P[1], AX[0], AX[1]);
  begin(gy);
  sculptureBase(M, 2.2, 1.7, 0.55, 3);
  bronze(M, 2.0, 0.65, 1.3, [0, 0.55, 0]);
  bronze(M, 0.5, 0.8, 0.4, [-0.45, 1.2, 0], { rx: -0.1 });   // seated boy: torso
  bronze(M, 0.45, 0.35, 0.8, [-0.45, 1.2, 0.3]); bronze(M, 0.16, 0.7, 0.16, [-0.45, 0.55, 0.75]);
  sphere('pzBron', 0.2, { M, p: [-0.42, 2.15, 0.1], seg: 6, noao: true }); bronze(M, 0.14, 0.45, 0.14, [-0.35, 1.7, 0.3], { rx: -0.9 });
  bronze(M, 0.55, 0.45, 0.9, [0.5, 1.2, 0], { rz: 0.3 });   // sleeping boy folded against him
  bronze(M, 0.55, 0.45, 0.4, [0.35, 1.7, 0], { rz: 0.5 }); sphere('pzBron', 0.18, { M, p: [0.25, 1.95, 0.1], seg: 6, noao: true });
  bronze(M, 0.18, 0.3, 0.8, [0.7, 1.1, 0.7]);
  return end('I Senzatetto');
}
function buildLavoro() {   // a kneeling labourer with a hammer raised in his right hand, over an anvil, on a rough block
  setup();
  const P = [-552.2, -943.8], gy = groundY(P[0], P[1]), M = frame(P[0], gy, P[1], AX[0], AX[1]);
  begin(gy);
  sculptureBase(M, 2.0, 1.6, 0.45, 2);
  bronze(M, 1.5, 0.35, 1.2, [0, 0.45, 0]);
  bronze(M, 0.55, 0.55, 0.4, [0.25, 0.8, 0.1]); bronze(M, 0.45, 0.35, 0.7, [-0.1, 1.15, 0.2]);   // anvil on its block
  bronze(M, 0.5, 0.55, 0.4, [0.25, 0.8, 0.8]);   // the base of the anvil is bronze like the rest
  bronze(M, 0.55, 0.95, 0.4, [-0.3, 1.35, -0.2], { rx: 0.25 });   // torso bent over
  bronze(M, 0.3, 0.55, 0.3, [-0.3, 0.85, 0.25], { rx: -0.6 }); bronze(M, 0.2, 0.7, 0.2, [-0.55, 0.8, -0.2]);   // knees
  sphere('pzBron', 0.2, { M, p: [-0.25, 2.2, 0.3], seg: 6, noao: true });
  bronze(M, 0.14, 0.95, 0.14, [-0.55, 1.9, -0.05], { rx: 0.2, rz: 0.3 });   // the raised arm
  bronze(M, 0.12, 0.45, 0.12, [-0.9, 2.65, -0.05]); bronze(M, 0.3, 0.14, 0.14, [-0.9, 3.05, -0.05]);   // hammer
  bronze(M, 0.14, 0.6, 0.14, [0.0, 1.3, 0.45], { rx: -0.9 });   // the other arm, to the anvil
  return end('Lavoro');
}
export const NAUTICA = { name: 'Nautica (Rutelli)', x: -568.7, z: -974.6, radius: 6, skipIds: [], build: buildNautica, walls: sq(-568.7, -974.6, 1.2) };
export const SENZATETTO = { name: 'I Senzatetto (Civiletti)', x: -560.7, z: -960.7, radius: 6, skipIds: [], build: buildSenzatetto, walls: sq(-560.7, -960.7, 1.2) };
export const LAVORO = { name: 'Lavoro (Civiletti)', x: -552.2, z: -943.8, radius: 6, skipIds: [], build: buildLavoro, walls: sq(-552.2, -943.8, 1.1) };

// ---------------------------------------------------------------------------------------------------
// Chiosco Ribaudo: the Liberty kiosk at the corner of the piazza (OSM w204272307, 5.0 x 3.9 m): a cream body with canted corners and a shuttered arched door on each face, under a wide
// roof with rounded corners, a coffered underside and a scroll bracket at each corner, a balustrade of strapwork and an urn at each end on top
// ---------------------------------------------------------------------------------------------------
const KIO = [[-487.2, -943.8], [-482.7, -946.1], [-481.0, -942.6], [-485.5, -940.4]];
function buildRibaudo() {
  setup();
  const gr = ground4(KIO), gy = gr.hi, c = [(KIO[0][0] + KIO[2][0]) / 2, (KIO[0][1] + KIO[2][1]) / 2];
  const ex = [KIO[1][0] - KIO[0][0], KIO[1][1] - KIO[0][1]], L = Math.hypot(ex[0], ex[1]), nx = ex[0] / L, nz = ex[1] / L;   // long axis; the model faces along its normal
  const M = frame(c[0], gy, c[1], -nz, nx);   // local x along the long side
  begin(gy);
  const RW = 5.0, RD = 3.9, BW = 3.2, BD = 2.2, BH = 2.9;
  bx('pzKio', M, -BW / 2 - 0.15, BW / 2 + 0.15, -0.8, 0.45, -BD / 2 - 0.15, BD / 2 + 0.15, { c: '#b7b2a6' });   // stone plinth
  bx('pzKio', M, -BW / 2, BW / 2, 0.45, BH, -BD / 2, BD / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx('pzKio', M, sx * BW / 2 - 0.12 + (sx > 0 ? 0.08 : -0.08), sx * BW / 2 + 0.12 + (sx > 0 ? 0.08 : -0.08), 0.45, BH + 0.1, sz * BD / 2 - 0.12 + (sz > 0 ? 0.08 : -0.08), sz * BD / 2 + 0.12 + (sz > 0 ? 0.08 : -0.08), { c: '#f2e8cc' });   // corner pilasters
  for (const sz of [-1, 1]) { box('dark', 1.5, 1.9, 0.05, { M, p: [0, 0.55, sz * (BD / 2 + 0.025)], c: '#33332f', noao: true }); box('dark', 0.9, 0.4, 0.05, { M, p: [0, 2.45, sz * (BD / 2 + 0.025)], c: '#2f332f', noao: true }); }
  for (const sx of [-1, 1]) box('dark', 1.0, 1.9, 0.05, { M, p: [0, 0.55, 0], c: '#33332f', noao: true, ry: 0, s: [1, 1, 1], uv: 'world' });
  bx('pzKio', M, -BW / 2 - 0.1, BW / 2 + 0.1, BH, BH + 0.25, -BD / 2 - 0.1, BD / 2 + 0.1, { c: '#e2d6b8' });   // cornice with the sign band
  box('pzKio', BW * 0.5, 0.25, 0.05, { M, p: [0, BH + 0.5, BD / 2 + 0.05], c: '#b79a4a', noao: true, uv: 'world' });
  // roof: slab of the whole footprint, coffered underside, thin edge, top a dull patina
  bx('pzCeil', M, -RW / 2, RW / 2, BH + 0.2, BH + 0.26, -RD / 2, RD / 2, { noao: true });
  bx('pzKio', M, -RW / 2 + 0.1, RW / 2 - 0.1, BH + 0.26, BH + 0.5, -RD / 2 + 0.1, RD / 2 - 0.1, { c: '#d8c8a2' });
  bx('flat', M, -RW / 2 - 0.05, RW / 2 + 0.05, BH + 0.5, BH + 0.62, -RD / 2 - 0.05, RD / 2 + 0.05, { c: '#c9bda0' });
  bx('dark', M, -RW / 2 + 0.2, RW / 2 - 0.2, BH + 0.62, BH + 0.66, -RD / 2 + 0.2, RD / 2 - 0.2, { c: '#6c6a5c', noao: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx('pzKio', M, sx * (RW / 2 - 0.6) - 0.12, sx * (RW / 2 - 0.6) + 0.12, BH - 0.1, BH + 0.25, sz * (RD / 2 - 0.5) - 0.12, sz * (RD / 2 - 0.5) + 0.12, { c: '#e2d6b8' });   // scroll brackets
  // balustrade of strapwork on the top, with a ball-urn at each end
  bx('pzKio', M, -1.6, 1.6, BH + 0.66, BH + 0.74, -0.5, 0.5, { c: '#e6dcc2' });
  box('pzKio', 3.2, 0.5, 0.05, { M, p: [0, BH + 0.74, 0.5], c: '#e2d6b8', noao: true, uv: 'world' });
  for (const sx of [-1, 1]) { cyl('pzKio', 0.14, 0.18, 0.7, 8, { M, p: [sx * 1.6, BH + 0.66, 0.45], c: '#e6dcc2' }); sphere('pzKio', 0.24, { M, p: [sx * 1.6, BH + 1.62, 0.45], seg: 7, c: '#d9c9a0' }); }
  return end('Chiosco Ribaudo');
}
export const RIBAUDO = { name: 'Chiosco Ribaudo', x: (KIO[0][0] + KIO[2][0]) / 2, z: (KIO[0][1] + KIO[2][1]) / 2, radius: 8, skipIds: ['w204272307'], build: buildRibaudo };

export const PIAZZA = [TEMPIETTO, SETTIMO, COTTONE, NAUTICA, SENZATETTO, LAVORO, RIBAUDO];
