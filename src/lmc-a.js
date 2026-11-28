// City landmarks, group A: Politeama Garibaldi (with its piazza monument), Stadio Renzo Barbera, Castello Utveggio, Santuario di Santa Rosalia.
import * as THREE from 'three';
import {
  PI, bx, gridMesh, begin, end, setBase, defMat, part, box, cyl, lathe, sphere, cone, panel, extrude, archBay, archShape, rectShape, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, facing, groundRange, ringSegs, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  balus, rail, statue, horse, palm, crenel, crag,
} from './lmc-kit.js';
import { FP } from './landmarks-city-data.js';
import { PITCH_Y } from './stadium-ground.js';
import { buildCrowd } from './stadium-crowd.js';

// grey-ochre limestone of the Pellegrino cliffs (the Utveggio footing; the Santuario has its own rock): mottled ochre and lichen-grey patches, short horizontal bedding cracks with a pale lip
// under each, a few vertical joints and dark scrub specks. No long vertical streaks (they read as wood grain).
function cliffMat() {
  defMat('cliff', 256, 256, [9, 9], (g, w, h) => {
    const r = RNG(391), wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    g.fillStyle = '#c3bba7'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 34; i++) {   // soft patches: ochre weathering, grey lichen, pale fresh rock
      const x = r() * w, y = r() * h, rx = 14 + r() * 40, ry = 8 + r() * 22, c = i % 3 === 0 ? '184,156,104' : i % 3 === 1 ? '120,116,106' : '236,230,212', a = 0.08 + r() * 0.1;
      wrap(() => { g.fillStyle = `rgba(${c},${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.3, 0, 7); g.fill(); });
    }
    noiseDots(g, w, h, 1800, 3, 392, ['rgba(80,74,64,0.16)', 'rgba(238,232,214,0.30)', 'rgba(140,132,114,0.20)']);
    for (let i = 0; i < 16; i++) {   // bedding cracks: short, nearly horizontal, with a pale lip below
      let x = r() * w, y = r() * h; const len = 30 + r() * 80; g.lineCap = 'round';
      const pts = [[x, y]]; for (let k = 0; k < 6; k++) { x += len / 6; y += (r() - 0.5) * 5; pts.push([x, y]); }
      for (const [dy, col, lw] of [[2, 'rgba(236,230,212,0.30)', 2.4], [0, 'rgba(52,47,40,0.42)', 1.4]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0], q[1] + dy) : g.moveTo(q[0], q[1] + dy)); g.stroke(); }
    }
    g.strokeStyle = 'rgba(52,47,40,0.30)'; g.lineWidth = 1.1;
    for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 8 + r() * 22); g.stroke(); }   // short vertical joints
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, s = 1.5 + r() * 2.5; g.fillStyle = `rgba(${r() < 0.5 ? '84,90,58' : '108,96,62'},${0.22 + r() * 0.2})`; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 7); g.fill(); }   // scrub in the ledges
  });
}

// partial cylinder band (outer wall), facing outward, over the angle range [a0, a1] measured from +z towards +x
function arcWall(key, r, y0, y1, a0, a1, seg, o = {}) { cyl(key, r, r, y1 - y0, seg, { open: true, t0: a0, tl: a1 - a0, p: [0, y0, 0], noao: o.noao, ...o }); }
// annulus sector facing up (or down) at height y, between angles a0..a1 measured from +z towards +x
function deck(key, r0, r1, y, a0, a1, seg, o = {}, down = false) {
  const g = down ? new THREE.RingGeometry(r0, r1, seg, 1, PI / 2 - a1, a1 - a0) : new THREE.RingGeometry(r0, r1, seg, 1, a0 - PI / 2, a1 - a0);
  g.rotateX(down ? PI / 2 : -PI / 2);
  part(key, g, { p: [0, y, 0], ...o });
}
function band(key, r0, r1, y0, y1, a0, a1, seg, o = {}) { arcWall(key, r1, y0, y1, a0, a1, seg, o); deck(key, r0, r1, y1, a0, a1, seg, o); deck(key, r0, r1, y0, a0, a1, seg, { ...o, noao: true }, true); }

// ====================================================================================================
// 1. Teatro Politeama Garibaldi (Damiani Almeyda, 1874), redrawn from Commons photos (names only):
//    Palermo Teatro Politeama BW 2012-10-09 16-44-27.jpg (3/4 view: arch block, ground portico, first gallery, drum, dome, end pavilion),
//    Politeama Garibaldi arco centrale.jpg (arch from below: archivolt, angels, eagle corbel, stained glass, cornice, frieze, quadriga),
//    Politeama portico.jpg (red-footed fluted ground columns, teal Pompeian wall, orange band), Palermo-Politeama-bjs-1.jpg, Teatro Politeama Garibaldi.jpg,
//    Politeama Palermo.jpg, Palermo, Teatro Politeama.jpg (front and side views, column counts and spacing), Politeama Garibaldi quadriga bronzea.jpg and
//    Teatro Politeama, Palermo, frontón sobre arco, Sicilia, Italia, 2015.JPG (palmette crest, putti frieze, inscription, trophy panels, terracotta antefixes),
//    Palermo-AP-p1070686.jpg (rear side of the rotunda, tall end pavilion, polychrome band), Palermo-Politeama-bjs-2.jpg (Ionic capitals, ochre Pompeian wall, dark figure frieze).
// Not seen in any photo: the stage house behind, the rear block and the side streets' walls (kept as plain walls); the exact column count (read as 9 per side from the photos).
// ====================================================================================================
const PG_D = PI / 180;
const rotXm = (a) => new THREE.Matrix4().makeRotationX(a);
const pgRegion = (x0, y0, w, h) => ({ uvk: [w / 512, h / 512], uvo: [x0 / 512, 1 - (y0 + h) / 512] });   // a piece of the 512x512 relief atlas, y0 from the top
function pgSoil(g, w, h, seed, lite = '255,246,222', dark = '70,50,30', n = 22, a = 0.16) {   // soft patches of soot and bleached stone plus rain streaks
  const r = RNG(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = (0.1 + r() * 0.22) * Math.max(w, h), c = r() < 0.6 ? dark : lite, al = a * (0.4 + r() * 0.8);
    const gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${c},${al})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  streaks(g, w, h, Math.round(w / 12), seed + 3, 0.1, h * 0.45, dark);
  noiseDots(g, w, h, w * h / 120, 1.6, seed + 5, ['rgba(70,50,30,0.10)', 'rgba(255,246,222,0.08)']);
}
function pgMats() {
  defMat('pgtPlast', 256, 256, [3.2, 3.2], (g, w, h) => { g.fillStyle = '#e8d6ae'; g.fillRect(0, 0, w, h); pgSoil(g, w, h, 701, '255,246,222', '70,50,30', 18, 0.1); });
  defMat('pgtStone', 512, 512, [6.4, 6.4], (g, w, h) => { paintAshlar(g, w, h, 6.4, 6.4, 0.8, 1.5, '#e2cda2', '#b39a6c', 711, 2, 0.05); pgSoil(g, w, h, 712, '255,246,222', '70,50,30', 24, 0.1); });
  // fluted shaft, one turn of the cylinder per tile
  defMat('pgtCol', 128, 256, [2.4, 6], (g, w, h) => {
    g.fillStyle = '#ebe0c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { const x = i * 8, gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(90,70,40,0.42)'); gr.addColorStop(0.5, 'rgba(255,250,235,0.12)'); gr.addColorStop(1, 'rgba(90,70,40,0.30)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); }
    pgSoil(g, w, h, 721, '255,246,222', '80,60,36', 10, 0.18);
  });
  // first-floor gallery wall, one bay per tile (2.5 m wide, 6.4 m tall): dado, ochre field with window and a floating figure, dark figured frieze at the top
  defMat('pgtPomp', 256, 512, [2.5046, 6.4], (g, w, h) => {
    const Y = (m) => (6.4 - m) * 80, r = RNG(731);
    g.fillStyle = '#d4a03c'; g.fillRect(0, 0, w, h); pgSoil(g, w, h, 732, '240,205,120', '120,70,20', 16, 0.22);
    g.fillStyle = '#5a2b22'; g.fillRect(0, Y(0.9), w, 0.9 * 80); g.fillStyle = '#c0502f'; g.fillRect(0, Y(0.9), w, 4);
    g.strokeStyle = '#b04a30'; g.lineWidth = 3; g.strokeRect(14, Y(0.75), w - 28, 0.55 * 80);
    g.fillStyle = '#4a221e'; g.fillRect(0, 0, w, Y(4.8)); g.fillStyle = '#e6d3a8'; g.fillRect(0, Y(4.8), w, 4); g.fillStyle = '#b04a30'; g.fillRect(0, Y(4.8) + 4, w, 3);
    for (const fx of [48, 128, 208]) { g.fillStyle = r() < 0.5 ? '#c9814a' : '#e0c9a0'; g.beginPath(); g.ellipse(fx, 62, 9, 24, (r() - 0.5) * 0.5, 0, 7); g.fill(); g.beginPath(); g.arc(fx + 2, 30, 7, 0, 7); g.fill(); g.fillRect(fx - 22, 48 + r() * 8, 44, 3); }
    // window
    const wx = (w - 133) / 2, wy = Y(4.4), wh = 3.4 * 80;
    g.fillStyle = '#e4d3aa'; g.fillRect(wx - 9, wy - 9, 151, wh + 18); g.fillStyle = '#2e3a40'; g.fillRect(wx, wy, 133, wh * 0.62); g.fillStyle = '#241c18'; g.fillRect(wx, wy + wh * 0.62, 133, wh * 0.38);
    g.fillStyle = '#6a2a2a'; g.fillRect(wx + 6, wy + wh * 0.62, 18, wh * 0.38); g.fillRect(wx + 109, wy + wh * 0.62, 18, wh * 0.38);
    g.fillStyle = 'rgba(15,12,10,0.8)'; g.fillRect(wx + 65, wy, 3, wh); g.fillRect(wx, wy + wh * 0.62, 133, 3);
    g.fillStyle = '#e4d3aa'; g.fillRect(wx - 12, wy - 14, 157, 6);
    // floating figure, left of the window
    g.fillStyle = '#e9a687'; g.beginPath(); g.ellipse(32, 275, 9, 34, -0.35, 0, 7); g.fill(); g.beginPath(); g.arc(38, 238, 6, 0, 7); g.fill();
    g.strokeStyle = '#f0c8a8'; g.lineWidth = 4; g.beginPath(); g.moveTo(24, 262); g.quadraticCurveTo(10, 250, 8, 232); g.stroke();
    g.fillStyle = 'rgba(176,74,48,0.5)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  });
  // ground wall: teal Pompeian field, dark panelled dado with an orange band, maroon band at the top, glazed door in each bay (6.9 m tall)
  defMat('pgtPompG', 256, 512, [2.5046, 6.9], (g, w, h) => {
    const k = h / 6.9, Y = (m) => h - m * k;
    g.fillStyle = '#2f5b57'; g.fillRect(0, 0, w, h); pgSoil(g, w, h, 741, '150,190,170', '10,30,28', 18, 0.25);
    g.fillStyle = '#1d2528'; g.fillRect(0, Y(1.0), w, 1.0 * k); g.strokeStyle = '#b04a30'; g.lineWidth = 3; g.strokeRect(14, Y(0.85), w - 28, 0.7 * k);
    g.fillStyle = '#d78a2c'; g.fillRect(0, Y(1.35), w, 0.35 * k); g.fillStyle = '#8a3a22'; g.fillRect(0, Y(1.35), w, 3);
    g.fillStyle = '#6d2f27'; g.fillRect(0, 0, w, Y(5.5)); g.fillStyle = '#d6a64a'; g.fillRect(0, Y(5.5), w, 5);
    const dw = 1.5 * w / 2.5046, dx = (w - dw) / 2, dy = Y(3.5);
    g.fillStyle = '#b89a6a'; g.fillRect(dx - 8, dy - 8, dw + 16, Y(0) - dy + 8); g.fillStyle = '#1b1714'; g.fillRect(dx, dy, dw, Y(0) - dy);
    g.fillStyle = 'rgba(120,150,160,0.25)'; g.fillRect(dx + 6, dy + 6, dw / 2 - 9, (Y(0) - dy) * 0.5); g.fillRect(dx + dw / 2 + 3, dy + 6, dw / 2 - 9, (Y(0) - dy) * 0.5);
    g.fillStyle = 'rgba(184,154,106,0.9)'; g.fillRect(dx + dw / 2 - 1.5, dy, 3, Y(0) - dy); g.fillRect(dx, dy + (Y(0) - dy) * 0.55, dw, 3);
  });
  // polychrome frieze (ground entablature, impost cornices and the end pavilions): ochre with turquoise metopes, cream triglyphs
  defMat('pgtFrieze', 512, 128, [6.0, 1.2], (g, w, h) => {
    g.fillStyle = '#d8ac4c'; g.fillRect(0, 0, w, h); pgSoil(g, w, h, 751, '245,225,160', '110,70,20', 8, 0.2);
    for (let x = 0; x < w; x += 60) {
      g.fillStyle = '#3f8279'; g.fillRect(x + 8, 22, 30, 84); g.fillStyle = '#cfe3d6'; g.beginPath(); g.arc(x + 23, 64, 8, 0, 7); g.fill();
      g.fillStyle = '#efe0b6'; for (let t = 0; t < 3; t++) g.fillRect(x + 40 + t * 5, 22, 3, 84);
    }
    g.fillStyle = '#8a3b2a'; g.fillRect(0, 8, w, 6); g.fillRect(0, h - 14, w, 6);
  });
  // relief atlas 512x512 (rows from the top): 0-128 putti frieze, 128-192 palmette crest, 192-320 trophy and two angels, 320-352 inscription, 352-384 dentils
  defMat('pgtRelief', 512, 512, [1, 1], (g, w, h) => {
    const r = RNG(761);
    g.fillStyle = '#d9c29a'; g.fillRect(0, 0, w, h); pgSoil(g, w, h, 762, '255,246,222', '70,50,30', 16, 0.14);
    // putti frieze
    g.fillStyle = '#c4a876'; g.fillRect(6, 10, w - 12, 108);
    for (let x = 18; x < w - 20; x += 22) {
      const hh = 34 + r() * 14, y = 100 - hh;
      for (const [dx, dy, col] of [[2, 2, '#8f7650'], [0, 0, '#ecdcb6']]) {
        g.fillStyle = col; g.beginPath(); g.arc(x + dx, y + dy, 7, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + dx, y + dy + 20, 7, 13, (r() - 0.5) * 0.5, 0, 7); g.fill();
        g.fillRect(x - 12 + dx, y + 12 + dy - r() * 8, 24, 3); g.fillRect(x - 5 + dx, y + 30 + dy, 3, 18); g.fillRect(x + 3 + dx, y + 30 + dy, 3, 18);
      }
    }
    // palmette crest
    g.fillStyle = '#d4b480'; g.fillRect(0, 132, w, 56);
    for (let i = 0; i < 8; i++) {
      const cx = i * 64 + 32; g.strokeStyle = '#8d7650'; g.fillStyle = '#ecd9ae'; g.lineWidth = 2;
      for (let j = -3; j <= 3; j++) { g.save(); g.translate(cx, 184); g.rotate(j * 0.34); g.beginPath(); g.ellipse(0, -24, 5.5, 20, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    }
    // trophy panel (lyre) 0..128 x 192..320
    g.fillStyle = '#cfb687'; g.fillRect(0, 192, 128, 128); g.strokeStyle = '#8f7650'; g.lineWidth = 6; g.strokeRect(6, 198, 116, 116);
    g.strokeStyle = '#efdfba'; g.lineWidth = 5; g.beginPath(); g.arc(64, 262, 28, 0.2, PI - 0.2, false); g.moveTo(42, 250); g.lineTo(42, 222); g.moveTo(86, 250); g.lineTo(86, 222); g.stroke();
    g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(48 + k * 8, 232); g.lineTo(48 + k * 8, 276); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(24, 300); g.lineTo(104, 214); g.moveTo(104, 300); g.lineTo(24, 214); g.stroke();
    // two angels (184x128 each), facing each other: head, tilted draped body, big wing, arm holding a wreath
    for (const x0 of [128, 312]) {
      g.save(); g.translate(x0, 192); g.fillStyle = '#cfb687'; g.fillRect(0, 0, 184, 128); g.strokeStyle = '#8f7650'; g.lineWidth = 4; g.strokeRect(3, 3, 178, 122);
      for (const [dx, dy, col] of [[2, 2, '#8f7650'], [0, 0, '#efdfba']]) {
        g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
        g.beginPath(); g.ellipse(dx + 96, dy + 40, 12, 46, 0.9, 0, 7); g.fill(); g.beginPath(); g.ellipse(dx + 112, dy + 34, 11, 40, 1.05, 0, 7); g.fill();   // wing
        g.beginPath(); g.moveTo(dx + 40, dy + 86); g.lineTo(dx + 78, dy + 50); g.lineTo(dx + 116, dy + 112); g.closePath(); g.fill();                       // drapery
        g.lineWidth = 15; g.beginPath(); g.moveTo(dx + 62, dy + 76); g.lineTo(dx + 76, dy + 44); g.stroke();                                              // torso
        g.beginPath(); g.arc(dx + 72, dy + 30, 10, 0, 7); g.fill();                                                                                         // head
        g.lineWidth = 7; g.beginPath(); g.moveTo(dx + 72, dy + 52); g.quadraticCurveTo(dx + 46, dy + 46, dx + 28, dy + 62); g.stroke();                      // arm
        g.lineWidth = 5; g.beginPath(); g.arc(dx + 22, dy + 68, 11, 0, 7); g.stroke();                                                                      // wreath
      }
      g.restore();
    }
    // inscription 512x32 at y 320
    g.fillStyle = '#d9c49a'; g.fillRect(0, 320, w, 32); g.fillStyle = '#6c5232'; g.font = 'bold 24px serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText('★  POLITEAMA  ★  GARIBALDI  ★', w / 2, 337);
    g.strokeStyle = '#8d7650'; g.lineWidth = 3; for (const x of [28, w - 28]) { g.beginPath(); g.ellipse(x, 336, 16, 6, 0, 0, 7); g.stroke(); }
    // dentils at y 352
    g.fillStyle = '#c9ad7a'; g.fillRect(0, 352, w, 32); g.fillStyle = '#ead8b0'; for (let x = 0; x < w; x += 43) g.fillRect(x + 6, 354, 22, 26);
    g.fillStyle = 'rgba(60,40,20,0.35)'; for (let x = 0; x < w; x += 43) g.fillRect(x + 6, 376, 22, 4);
  });
  // stained glass of the entrance arch, 6.3 m x 11.5 m: blue sunburst over the springing, green and maroon lattice, leaded dark lattice below the 3 m mark
  defMat('pgtGlass', 256, 512, [1, 1], (g, w, h) => {
    const sy = h / 11.5, cy = (11.5 - 8.35) * sy;
    g.fillStyle = '#15171a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { const a0 = PI + i * PI / 18, a1 = a0 + PI / 18; g.fillStyle = ['#2d46a3', '#3a58b8', '#1f2f7a'][i % 3]; g.beginPath(); g.moveTo(w / 2, cy); g.arc(w / 2, cy, w * 0.5, a0, a1); g.closePath(); g.fill(); g.strokeStyle = '#10142a'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#8e8e96'; g.beginPath(); g.arc(w / 2, cy, 40, PI, 0); g.fill(); g.strokeStyle = '#3a3a44'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#5a5a66'; g.fillRect(w / 2 - 14, cy - 28, 28, 28);
    const y1 = (11.5 - 3.0) * sy;
    for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 8; gy++) {
      const x = gx * (w / 8), y = cy + gy * ((y1 - cy) / 8), cw = w / 8, ch = (y1 - cy) / 8;
      g.fillStyle = '#3f9a5d'; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); g.fillStyle = '#7a2f45'; g.fillRect(x + cw * 0.3, y + ch * 0.3, cw * 0.4, ch * 0.4); g.strokeStyle = '#15171a'; g.lineWidth = 2; g.strokeRect(x + cw * 0.3, y + ch * 0.3, cw * 0.4, ch * 0.4);
    }
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 6; gy++) {
      const x = gx * (w / 6) + (gy % 2 ? w / 12 : 0), y = y1 + gy * ((h - y1) / 6), cw = w / 6, ch = (h - y1) / 6;
      g.fillStyle = (gx + gy) % 3 === 0 ? '#b9953a' : (gx + gy) % 3 === 1 ? '#6d4a7a' : '#7a2f45'; g.beginPath(); g.moveTo(x, y + ch / 2); g.lineTo(x + cw / 2, y + 2); g.lineTo(x + cw, y + ch / 2); g.lineTo(x + cw / 2, y + ch - 2); g.closePath(); g.fill();
    }
  }, { roughness: 0.3 });
  // end pavilions: ashlar front with red arched door, first-floor window and attic window
  defMat('pgtPav', 512, 512, [6.8, 20.6], (g, w, h) => paintFacade(g, w, h, 6.8, 20.6, {
    base: '#d8c08f', trim: '#ecdcb6', glass: '#3a2a22', seed: 771, ashlar: { base: '#d9c293', joint: '#ab9468', course: 0.7, block: 1.4, seed: 772 },
    bands: [{ y: 5.9, h: 0.9, c: '#cfa24a' }, { y: 7.3, h: 0.3, c: '#e6d6b0' }, { y: 15.6, h: 0.8, c: '#e6d6b0' }], pil: { xs: [0.3, 6.5], w: 0.6, c: '#e4d3ac' },
    rows: [{ y0: 0, y1: 3.4, xs: [3.4], w: 1.4, kind: 'door', glass: '#9c3a28' }, { y0: 8.6, y1: 12.8, xs: [3.4], w: 1.6, kind: 'rect', ped: true }, { y0: 16.6, y1: 19.0, xs: [3.4], w: 1.4, kind: 'rect' }] }));
}

// bronze horse facing +z standing on its hind hooves at the origin of M, reared by phi (radians); about 3.4 m to the ears at phi = 0.9
function pgHorse(M0, phi, o = {}) {
  const M = mul(M0, new THREE.Matrix4().makeScale(1.3, 1.3, 1.3)), c = o.c || '#46604f', k = 'bronze', n = true, B = mul(M, mul(tr(0, 1.5, 0), rotXm(-phi)));
  box(k, 0.85, 1.0, 2.0, { M: B, p: [0, -0.55, -0.1], c, noao: n });
  box(k, 0.8, 1.1, 0.7, { M: B, p: [0, -0.6, 0.8], c, noao: n });
  box(k, 0.42, 1.3, 0.55, { M: B, p: [0, 0.0, 1.0], rx: 0.55, c, noao: n });
  box(k, 0.3, 0.85, 0.32, { M: B, p: [0, 1.05, 1.62], rx: 2.1, c, noao: n });
  box(k, 0.1, 1.25, 0.14, { M: B, p: [0, 0.08, 0.82], rx: 0.55, c: '#33463b', noao: n });
  for (const sx of [-1, 1]) {
    box(k, 0.07, 0.2, 0.07, { M: B, p: [sx * 0.12, 1.1, 1.38], rx: 0.2, c, noao: n });
    box(k, 0.2, 0.85, 0.24, { M: B, p: [sx * 0.28, -0.1, 0.85], rx: 2.2, c, noao: n });
    box(k, 0.15, 0.8, 0.17, { M: B, p: [sx * 0.28, -0.6, 1.54], rx: 3.4, c, noao: n });
    box(k, 0.3, 0.9, 0.4, { M, p: [sx * 0.3, 0.7, -0.1], rx: -0.35, c, noao: n });
    box(k, 0.18, 0.8, 0.2, { M, p: [sx * 0.3, 0, -0.35], rx: 0.3, c, noao: n });
    box(k, 0.22, 0.12, 0.34, { M, p: [sx * 0.3, 0, -0.25], c: '#2f3f35', noao: n });
  }
  box(k, 0.2, 1.1, 0.2, { M: B, p: [0, -0.2, -1.1], rx: -2.4, c: '#33463b', noao: n });
}
// nude rider seated on a horse built with pgHorse(M, phi): arm raised with a palm branch
function pgRider(M0, phi, o = {}) {
  const M = mul(M0, new THREE.Matrix4().makeScale(1.3, 1.3, 1.3)), c = o.c || '#46604f', k = 'bronze', n = true, B = mul(M, mul(tr(0, 1.5, 0), rotXm(-phi)));
  box(k, 0.45, 0.85, 0.3, { M: B, p: [0, 0.4, -0.15], c, noao: n });
  sphere(k, 0.17, { M: B, p: [0, 1.4, -0.12], c, seg: 6, noao: n });
  box(k, 0.12, 0.85, 0.12, { M: B, p: [0.28, 0.95, -0.12], rz: -0.55, c, noao: n });
  box(k, 0.04, 0.9, 0.04, { M: B, p: [0.65, 1.55, -0.12], rz: 0.35, c: '#5c7a52', noao: n });
  box(k, 0.12, 0.7, 0.12, { M: B, p: [-0.26, 0.55, -0.12], rz: 0.9, c, noao: n });
  for (const sx of [-1, 1]) box(k, 0.17, 0.75, 0.2, { M: B, p: [sx * 0.3, -0.35, -0.1], rz: sx * 0.35, c, noao: n });
}

// ====================================================================================================
// buildPolitea. Frame M: origin at the centre of the semicircle, +z out of the front (towards Piazza Ruggero Settimo), x across.
// From the front: ground portico of fluted columns (red-footed) in front of a teal Pompeian wall, polychrome frieze, first gallery of Ionic columns in front of an ochre
// Pompeian wall with a dark figured frieze, dentilled cornice, salmon drum with palmette crest, glazed copper dome; in the middle the arch block (archivolt, stained glass, eagle
// corbel, angels, inscription, putti frieze, trophy panels, palmette crest) carrying the quadriga and a horse-and-rider group at each corner; a tall pavilion at each end of the rotunda.
// ====================================================================================================
function buildPolitea(ctx) {
  initShared(); ensureTrunk(); pgMats();
  const fp = FP.politeama, pts = pairsOf(fp.p), gr = groundRange(pts);
  const FX = -0.891, FZ = 0.454;                          // front normal (towards Piazza Ruggero Settimo, west-south-west)
  const OX = -408.2, OZ = -1037.5;                        // centre of the semicircular colonnade
  const gy = gr.hi, M = frame(OX, gy, OZ, FX, FZ);
  begin(gy);
  defMat('polWall', 256, 512, [4.0, 8.0], (g, w, h) => paintFacade(g, w, h, 4.0, 8.0, { base: '#cf9b78', trim: '#ecdcb8', glass: '#33261f', seed: 401,
    bands: [{ y: 0, h: 0.5, c: '#bf8a68' }], rows: [{ y0: 1.6, y1: 5.8, xs: [2.0], w: 1.3, kind: 'arch', fr: 0.2, sill: false }] }));
  defMat('polBack', 256, 256, [6, 8], (g, w, h) => paintFacade(g, w, h, 6, 8, { base: '#dcc9a6', trim: '#efe3c8', glass: '#2c2b2c', seed: 402,
    bands: [{ y: 7.6, h: 0.4, c: '#eadcbc' }], rows: [{ y0: 0.9, y1: 3.3, xs: [1.5, 4.5], w: 1.1, kind: 'rect', ped: true }, { y0: 4.4, y1: 6.9, xs: [1.5, 4.5], w: 1.1, kind: 'rect', shut: 'open' }], shut: '#6a5a44' }));
  defMat('polFrieze', 512, 128, [15.7, 4.4], (g, w, h) => {
    g.fillStyle = '#dccba0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 411, ['rgba(110,90,60,0.1)']);
    g.fillStyle = '#c9b88c'; g.fillRect(8, 10, w - 16, h - 20); g.strokeStyle = '#8a7650'; g.lineWidth = 3; g.strokeRect(8, 10, w - 16, h - 20);
    const r = RNG(412); g.fillStyle = '#eee3c4'; for (let x = 22; x < w - 20; x += 22) { const hh = 30 + r() * 38; g.fillRect(x, h - 16 - hh, 9, hh); g.beginPath(); g.arc(x + 4, h - 20 - hh, 6, 0, 7); g.fill(); g.fillRect(x - 4, h - 16 - hh * 0.6, 17, 5); }
  });
  const PL = 'pgtPlast', ST = 'pgtStone', CREAM = '#ffffff';
  const A0 = -PI / 2, A1 = PI / 2, SEG = 48;
  // ---- foundations
  bx('tufa', M, -27, 27, -(gr.hi - gr.lo) - 1.5, -0.12, -50, 33, { c: '#b9a67c' });

  // ---- the rotunda. Radii: wall 17.5, columns 20.6, slab edge 22.3, cornice 22.8 (inside the footprint)
  const RW = 17.5, RC = 20.6, BAY = 8.2 * PG_D, K0 = 24 * PG_D, NCOL = 9;
  const colAng = []; for (const sg of [-1, 1]) for (let k = 0; k < NCOL; k++) colAng.push(sg * (K0 + k * BAY));
  const sideArcs = [[K0, K0 + (NCOL - 1) * BAY], [-(K0 + (NCOL - 1) * BAY), -K0]];
  // stylobate and ground wall
  band(PL, 17.2, 22.0, 0, 0.5, A0, A1, SEG, { M, c: '#cfc2a0' });
  for (const [a0, a1] of sideArcs) {
    arcWall('pgtPompG', RW, 0.5, 7.4, a0, a1, 24, { M });
    deck(PL, RW, RC + 0.9, 7.4, a0, a1, 24, { M, c: '#b8ad98', noao: true }, true);
  }
  // ground colonnade: fluted shafts, lower third painted red, simple abacus
  for (const a of colAng) {
    const x = Math.sin(a) * RC, z = Math.cos(a) * RC, Mc = mul(M, mul(tr(x, 0.5, z), rotY(a)));
    cyl('pgtCol', 0.4, 0.42, 1.6, 10, { M: Mc, c: '#b5503a' });
    cyl('pgtCol', 0.36, 0.4, 3.1, 10, { M: Mc, p: [0, 1.6, 0], c: CREAM, uvo: [0, 0.27] });
    box(PL, 1.0, 0.18, 1.0, { M: Mc, p: [0, 4.7, 0], c: '#efe3c4', noao: true }); cyl(PL, 0.5, 0.36, 0.28, 10, { M: Mc, p: [0, 4.45, 0], c: '#e8dbb8', noao: true });
    box(PL, 0.95, 0.2, 0.95, { M: Mc, p: [0, -0.0, 0], c: '#e6d8b4' });
  }
  // ground entablature (architrave, polychrome frieze) and the slab of the first gallery
  band(PL, 17.4, 21.6, 5.4, 5.9, A0, A1, SEG, { M, c: '#eadbb4' });
  arcWall('pgtFrieze', 21.7, 5.9, 6.8, A0, A1, SEG, { M, uvk: [(A1 - A0) * 21.7 / 6.0, 1], noao: true });
  band(PL, 17.4, 22.3, 6.8, 7.4, A0, A1, SEG, { M, c: '#e6d6ae' });

  // first gallery: ochre Pompeian wall, Ionic columns, entablature with dentils and cornice
  for (const [a0, a1] of sideArcs) arcWall('pgtPomp', RW, 7.4, 13.8, a0, a1, 24, { M });
  for (const a of colAng) {
    const x = Math.sin(a) * RC, z = Math.cos(a) * RC, Mc = mul(M, mul(tr(x, 7.4, z), rotY(a)));
    cyl('pgtCol', 0.34, 0.38, 5.4, 10, { M: Mc, p: [0, 0.35, 0], c: CREAM, uvk: [1, 0.9], uvo: [0, 0.05] });
    box(PL, 0.95, 0.35, 0.95, { M: Mc, c: '#efe3c4' }); cyl(PL, 0.42, 0.42, 0.25, 10, { M: Mc, p: [0, 0.3, 0], c: '#b5503a', noao: true });
    cyl(PL, 0.18, 0.18, 1.0, 8, { M: Mc, p: [0, 5.95, 0], rz: PI / 2, c: '#e6d8b4', noao: true });                  // Ionic bolster
    for (const sx of [-1, 1]) cyl(PL, 0.24, 0.24, 0.14, 10, { M: Mc, p: [sx * 0.5 + (sx > 0 ? 0.07 : -0.07), 5.76, 0], rz: PI / 2, c: '#79b4a2', noao: true });   // turquoise volutes
    box(PL, 1.1, 0.16, 1.1, { M: Mc, p: [0, 6.26, 0], c: '#efe3c4', noao: true });
  }
  band(PL, 17.4, 22.0, 13.8, 14.7, A0, A1, SEG, { M, c: '#e6d6ae' });                                               // architrave
  arcWall('pgtRelief', 22.1, 14.7, 15.05, A0, A1, SEG, { M, ...pgRegion(0, 352, 512, 32), uvk: [(A1 - A0) * 22.1 / 2.4, 32 / 512], noao: true });   // dentils
  band(PL, 17.4, 22.8, 15.05, 15.7, A0, A1, SEG, { M, c: '#eadbb4' });                                             // cornice
  // drum, palmette crest, glazed ring and dome
  arcWall(PL, 19.4, 15.7, 19.0, A0, A1, SEG, { M, c: '#f8b0a4', noao: false });
  for (let k = -4; k <= 4; k++) { const a = k * 19 * PG_D * 0.99, Mw = mul(M, mul(tr(Math.sin(a) * 19.45, 16.7, Math.cos(a) * 19.45), rotY(a))); box('pgtStone', 0.9, 1.5, 0.12, { M: Mw, c: '#ecdcb6', noao: true }); box('dark', 0.64, 1.2, 0.15, { M: Mw, p: [0, 0.15, 0.0], c: '#2a2d30', noao: true }); }
  band(PL, 17.4, 20.3, 19.0, 19.5, A0, A1, SEG, { M, c: '#eadbb4' });
  arcWall('pgtRelief', 20.3, 19.5, 20.2, A0, A1, SEG, { M, ...pgRegion(0, 128, 512, 64), uvk: [(A1 - A0) * 20.3 / 2.8, 64 / 512], noao: true });
  cyl('flat', 17.6, 17.6, 0.7, 40, { M, p: [0, 19.0, 0], c: '#8a857a', noao: true });                                 // roof of the drum, round the dome
  cyl('dark', 12.3, 12.3, 1.5, 32, { M, p: [0, 19.7, 0], c: '#3a4448', noao: true });
  lathe('lead', [[12.9, 0], [11.8, 1.0], [8.8, 2.6], [4.5, 3.6], [0.01, 3.9]], 32, { M, p: [0, 21.2, 0], c: '#a9bdad', noao: true });

  // ---- arch block (width 15.7 m, front at z = 26.9)
  const BW = 15.7, BZ1 = 26.9, BZ0 = 12, OW = 6.3, OH = 11.5, SP = OH - OW / 2, ZF = BZ1 - 1.0;
  bx(ST, M, -BW / 2, BW / 2, 0, 19.9, BZ0, ZF, { c: '#f6eed6' });
  archBay(ST, BW, 12.2, OW, OH - 7.3, 1.0, { M: mul(M, tr(0, 7.3, ZF)), c: '#f6eed6' });                                 // upper front wall with the arched opening
  for (const sg of [-1, 1]) {
    bx(PL, M, sg > 0 ? 3.15 : -7.85, sg > 0 ? 7.85 : -3.15, 0, 7.3, ZF, BZ1, { c: '#f2ead6' });                          // white piers each side of the portal
    bx(PL, M, sg * 5.2 - 1.1, sg * 5.2 + 1.1, 3.4, 5.3, BZ1, BZ1 + 0.05, { c: '#cfc19f' });                             // inscription plaque
    for (const x of [sg * 3.75, sg * 7.15]) {
      const Mc = mul(M, tr(x, 0, BZ1 + 0.5));
      box(PL, 1.0, 0.4, 1.0, { M: Mc, c: '#efe6d0' }); cyl('pgtCol', 0.36, 0.38, 5.1, 10, { M: Mc, p: [0, 0.4, 0], c: '#f4eddc' }); box(PL, 1.0, 0.3, 1.0, { M: Mc, p: [0, 5.5, 0], c: '#efe6d0' });
    }
    panel('pgtFrieze', 4.7, 0.9, { M: mul(M, tr(sg * 5.5, 5.9, BZ1 + 0.52)), uvk: [4.7 / 6.0, 0.75], uvo: [0, 0.1] });
    bx(PL, M, sg > 0 ? 3.1 : -7.9, sg > 0 ? 7.9 : -3.1, 6.8, 7.4, ZF, BZ1 + 0.5, { c: '#e6d6ae' });                      // impost cornice
    bx(PL, M, sg > 0 ? 7.3 : -7.85, sg > 0 ? 7.85 : -7.3, 7.9, 16.3, BZ1, BZ1 + 0.14, { c: '#ecdcb6' });                  // corner pilasters
    bx(PL, M, sg > 0 ? 2.85 : -3.45, sg > 0 ? 3.45 : -2.85, 7.4, 8.2, BZ1 - 0.1, BZ1 + 0.6, { c: '#e6d6ae' });              // impost blocks
    // side face of the block, past the rotunda: pilaster strips and a tall window
    bx(PL, M, sg > 0 ? BW / 2 : -BW / 2 - 0.12, sg > 0 ? BW / 2 + 0.12 : -BW / 2, 9.2, 13.2, 22.8, 25.2, { c: '#ecdcb6' }); box('dark', 0.1, 3.4, 1.3, { M: mul(M, tr(sg * (BW / 2 + 0.13), 9.6, 24.0)), c: '#2a2d30', noao: true });
    const sx0 = sg > 0 ? BW / 2 : -BW / 2 - 0.12, sx1 = sg > 0 ? BW / 2 + 0.12 : -BW / 2;
    bx(PL, M, sx0, sx1, 7.4, 16.3, 21.6, 22.3, { c: '#ecdcb6' }); bx(PL, M, sx0, sx1, 7.4, 16.3, 26.2, 26.9, { c: '#ecdcb6' });
    bx(PL, M, sg > 0 ? BW / 2 : -BW / 2 - 0.5, sg > 0 ? BW / 2 + 0.5 : -BW / 2, 6.8, 7.4, 20.5, BZ1 + 0.5, { c: '#e6d6ae' });
  }
  // steps
  bx(PL, M, -4.4, 4.4, 0, 0.3, BZ1 - 0.2, BZ1 + 1.4, { c: '#cfc6b0' }); bx(PL, M, -4.0, 4.0, 0.3, 0.6, BZ1 - 0.2, BZ1 + 0.8, { c: '#d8cfba' });
  // stained glass, set back in the opening, and the dark vestibule behind it
  extrude('pgtGlass', archShape(OW, OH), 0.06, { M: mul(M, tr(0, 0, ZF + 0.05)), uv: 'keep', uvk: [1 / OW, 1 / OH], uvo: [0.5, 0], noao: true });
  // archivolt: two stepped rings from the impost blocks over the springing
  for (const [ro, ri, d] of [[4.3, 3.15, 0.3], [5.4, 4.3, 0.14]]) {
    const s = new THREE.Shape(), y0 = 7.6; s.moveTo(-ro, y0); s.lineTo(ro, y0); s.lineTo(ro, SP); s.absarc(0, SP, ro, 0, PI, false); s.lineTo(-ro, y0);
    const hl = new THREE.Path(); hl.moveTo(-ri, y0); hl.lineTo(-ri, SP); hl.absarc(0, SP, ri, PI, 0, true); hl.lineTo(ri, y0); hl.lineTo(-ri, y0); s.holes.push(hl);
    extrude(PL, s, d, { M: mul(M, tr(0, 0, BZ1)), c: '#efe0ba' });
  }
  bx(PL, M, -BW / 2, BW / 2, 14.0, 15.6, BZ1 - 0.02, BZ1 + 0.03, { c: '#ead9b0' });                                    // smooth zone under the cornice
  bx(PL, M, -0.5, 0.5, 13.6, 14.7, BZ1, BZ1 + 0.6, { c: '#dcc79c' }); bx('bronze', M, -0.2, 0.2, 13.9, 14.4, BZ1 + 0.6, BZ1 + 0.75, { c: '#7a6a50' });   // eagle corbel
  for (const sg of [-1, 1]) panel('pgtRelief', 2.6, 2.0, { M: mul(M, tr(sg * 3.95, 12.0, BZ1 + 0.03)), uvk: [(sg > 0 ? -184 : 184) / 512, 128 / 512], uvo: [(sg > 0 ? 312 : 128) / 512, 1 - 320 / 512] });   // angels in the spandrels, facing each other
  panel('pgtRelief', 11.4, 0.7, { M: mul(M, tr(0, 15.65, BZ1 + 0.1)), ...pgRegion(0, 320, 512, 32) });                  // inscription POLITEAMA GARIBALDI
  panel('pgtRelief', BW + 0.6, 0.3, { M: mul(M, tr(0, 16.3, BZ1 + 0.1)), uvk: [(BW + 0.6) / 3.4 * 1.0, 32 / 512], uvo: [0, 1 - 384 / 512] });   // dentils under the cornice
  bx(PL, M, -BW / 2 - 0.5, BW / 2 + 0.5, 16.6, 17.2, BZ0, BZ1 + 0.8, { c: '#eadbb4' });
  bx(PL, M, -BW / 2 - 0.25, BW / 2 + 0.25, 16.3, 16.6, BZ0, BZ1 + 0.45, { c: '#e2d0a6' });
  // attic: putti frieze flanked by two trophy panels, framed by corner pilasters
  bx(PL, M, -BW / 2, BW / 2, 17.2, 19.5, BZ1 - 0.1, BZ1 - 0.0, { c: '#efe0ba' });
  bx(PL, M, -4.7, 4.7, 17.3, 19.4, BZ1, BZ1 + 0.05, { c: '#e2d0a6' });
  panel('pgtRelief', 9.0, 1.9, { M: mul(M, tr(0, 17.45, BZ1 + 0.08)), ...pgRegion(0, 0, 512, 128) });
  for (const sg of [-1, 1]) {
    panel('pgtRelief', 1.9, 1.9, { M: mul(M, tr(sg * 6.0, 17.45, BZ1 + 0.08)), ...pgRegion(0, 192, 128, 128) });
    bx(PL, M, sg * 5.0 - 0.15, sg * 5.0 + 0.15, 17.3, 19.4, BZ1, BZ1 + 0.1, { c: '#ecdcb6' }); bx(PL, M, sg * 7.0 - 0.15, sg * 7.0 + 0.15, 17.3, 19.4, BZ1, BZ1 + 0.1, { c: '#ecdcb6' });
    bx(PL, M, sg > 0 ? 7.45 : -7.85, sg > 0 ? 7.85 : -7.45, 17.2, 19.5, BZ1, BZ1 + 0.18, { c: '#ecdcb6' });
  }
  bx(PL, M, -BW / 2 - 0.3, BW / 2 + 0.3, 19.5, 19.9, BZ0, BZ1 + 0.5, { c: '#eadbb4' });
  // palmette crest on the front and the two sides, with terracotta antefixes at the corners
  panel('pgtRelief', BW + 0.6, 1.0, { M: mul(M, tr(0, 19.9, BZ1 + 0.42)), ...pgRegion(0, 128, 512, 64), uvk: [(BW + 0.6) / 2.8, 64 / 512] });
  for (const sg of [-1, 1]) panel('pgtRelief', BZ1 - BZ0 + 0.5, 1.0, { M: mul(M, mul(tr(sg * (BW / 2 + 0.28), 19.9, (BZ0 + BZ1 + 0.5) / 2), rotY(sg * PI / 2))), ...pgRegion(0, 128, 512, 64), uvk: [(BZ1 - BZ0 + 0.5) / 2.8, 64 / 512] });
  for (const sx of [-1, 1]) for (const z of [BZ1 + 0.4, BZ0]) box('tile', 0.45, 0.6, 0.3, { M: mul(M, tr(sx * (BW / 2 + 0.3), 19.9, z)), c: '#e0905c', noao: true });
  // the quadriga (four horses abreast and the charioteer with a palm) and a horse-and-rider group on each corner, in dark green bronze
  const MQ = mul(M, tr(0, 19.9, BZ1 - 4.2));
  bx(PL, M, -9.4, 9.4, 19.9, 20.2, BZ1 - 6.5, BZ1 - 1.2, { c: '#d9c89e' });
  for (let i = 0; i < 4; i++) pgHorse(mul(MQ, mul(tr((i - 1.5) * 2.2, 0.3, 1.2 - (i === 1 || i === 2 ? 0.2 : 0)), rotY((i === 0 ? 0.12 : i === 3 ? -0.12 : 0)))), i === 1 || i === 2 ? 0.7 : 0.95, { c: i % 2 ? '#425a4b' : '#4b6655' });
  box('bronze', 1.7, 1.1, 2.1, { M: MQ, p: [0, 0.3, -2.9], c: '#46604f', noao: true });
  for (const sx of [-1, 1]) cyl('bronze', 0.95, 0.95, 0.16, 12, { M: MQ, p: [sx * 0.95, 0.95, -2.9], rz: PI / 2 * sx, c: '#3d5446', noao: true });
  statue('bronze', mul(MQ, tr(0, 1.4, -2.9)), 3.5, { c: '#4b6655', noao: true });
  box('bronze', 0.16, 1.4, 0.16, { M: MQ, p: [0.6, 3.3, -2.9], rz: -0.35, c: '#4b6655', noao: true }); box('bronze', 0.06, 1.0, 0.06, { M: MQ, p: [1.0, 4.6, -2.9], rz: 0.3, c: '#5c7a52', noao: true });
  for (const sg of [-1, 1]) { const Mg = mul(M, mul(tr(sg * 6.7, 19.9, BZ1 - 2.6), rotY(sg * PI / 2))); pgHorse(Mg, 0.95, { c: '#4b6655' }); pgRider(Mg, 0.95, { c: '#4b6655' }); }

  // ---- end pavilions (tall, ashlar, red arched door, polychrome band) and the stage house behind
  const PW0 = 22.6, PW1 = 29.4, PH = 20.6, SZ0 = -1.0, SZ1 = -43.3, SW = 58.8;
  bx('polBack', M, -SW / 2, SW / 2, 0, PH, SZ1, SZ0);
  for (const sg of [-1, 1]) {
    panel('pgtPav', PW1 - PW0, PH, { M: mul(M, tr(sg * (PW0 + PW1) / 2, 0, SZ0 + 0.03)), noao: true });
    bx(PL, M, sg > 0 ? PW0 : -PW1, sg > 0 ? PW1 : -PW0, PH, PH + 0.5, SZ0 - 0.1, SZ0 + 0.5, { c: '#e4d3aa' });
  }
  bx(PL, M, -PW1 - 0.1, PW1 + 0.1, PH, PH + 0.5, SZ1 - 0.1, SZ0 + 0.1, { c: '#d9c89e' });
  bx('flat', M, -SW / 2 + 3, SW / 2 - 3, PH + 0.5, PH + 0.9, SZ1 + 3, SZ0 - 3, { c: '#9a948a' });
  bx('polBack', M, -21.3, 21.3, 0, 19, SZ1 - 9, SZ1 + 0.1);
  bx(PL, M, -21.7, 21.7, 19, 19.6, SZ1 - 9.4, SZ1 + 0.1, { c: '#d0c3a0' });
  return end('Politeama Garibaldi');
}

export const POLITEAMA = {
  name: 'Politeama Garibaldi', x: -409, z: -1039, radius: 70, skipIds: [FP.politeama.id],
  // iron railing round the monument (an octagon of r ~ 8.6 m centred 49 m in front of the colonnade)
  build: buildPolitea,
};

// ====================================================================================================
// 2. Stadio Renzo Barbera (front from Commons photos, names only: Stadio Barbera Palermo.jpg, Stadio comunale renzo barbera (PALERMO STADIUM).JPG, Stadio Renzo Barbera 2022 - 01.jpg:
//    teal roof edge, white twin-fin towers with blue banded stair drums, glass curtain wall, open stand structure, the gold name and a club banner; the advertising banner of the photos is not copied,
//    the exact tower spacing is not measured). The OSM ring (outer wall, hole = the playing area) becomes a two-tier bowl, canopies on the long sides,
//    four floodlight towers, a red running track round the pitch, and the vehicle gate: the main entrance in the middle of the front.
// ====================================================================================================
// The front is the covered Tribuna, the long side towards Viale del Fante (west-south-west): the OSM roof polygon (way 124120091) is that stand to the metre, the entrance=main nodes
// line that side, and Via Cassarà, its junction with Viale del Fante and the OSM service road run straight at the middle of its wall (the road ends 2 m along the pitch from the centre).
// (u, v): u along the pitch, v out from its centre towards the front; every x, z of the gate comes from them.
const SD = (() => {
  const outer = pairsOf(FP.stadio.p), hole = pairsOf(FP.stadio.holes[0]), ob = obb(hole), s = ob.ux > 0 ? 1 : -1, U = [ob.ux * s, ob.uz * s];
  return { outer, hole, ob, U, F: [-U[1], U[0]], cx: ob.cx, cz: ob.cz };
})();
const P = (u, v) => [SD.cx + SD.U[0] * u + SD.F[0] * v, SD.cz + SD.U[1] * u + SD.F[1] * v];
const lat = (x, z) => (x - SD.cx) * SD.U[0] + (z - SD.cz) * SD.U[1], dep = (x, z) => (x - SD.cx) * SD.F[0] + (z - SD.cz) * SD.F[1];
// u, halfW: where the gate is along the front and half its width; PD: how far the entrance block stands out of the wall; EX: how far the tunnel's walls and roof run on over the track
const GATE = { u: 2.0, halfW: 4.0, PD: 3.2, EX: 3.5 };
{ const g = P(GATE.u, 0); GATE.vOut = rayHit(SD.outer, g[0], g[1], SD.F[0], SD.F[1]); GATE.vIn = rayHit(SD.hole, g[0], g[1], SD.F[0], SD.F[1]); }   // v of the outer wall and of the pitch wall at the gate
function rayHit(ring, cx, cz, dx, dz) {
  let best = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ez - (a[1] - cz) * ex) / den, s = ((a[0] - cx) * dz - (a[1] - cz) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best;
}
// the entrance block in front of the gate, seen from above: a pier each side of the opening (PIER wide, GATE.PD out of the wall) and beyond it an arched side door (DOOR wide, DOOR_D out)
const PIER = 2.4, DOOR = 5.0, DOOR_D = 2.4;
function stadiumCollision() {
  const out = [], { outer, hole, ob } = SD, lo = GATE.u - GATE.halfW, hi = GATE.u + GATE.halfW;
  const clip = (s) => { // cut the gate's gap out of a segment of the front wall (both rings)
    const [x0, z0, x1, z1] = s, a = lat(x0, z0), b = lat(x1, z1);
    if (dep((x0 + x1) / 2, (z0 + z1) / 2) < 30 || Math.max(a, b) <= lo || Math.min(a, b) >= hi) return [s];
    if (Math.abs(b - a) < 1e-6) return [];
    const t1 = (lo - a) / (b - a), t2 = (hi - a) / (b - a), tl = Math.min(t1, t2), th = Math.max(t1, t2), at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t], r = [];
    if (tl > 0) r.push([x0, z0, ...at(Math.min(tl, 1))]);
    if (th < 1) r.push([...at(Math.max(th, 0)), x1, z1]);
    return r.filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) > 0.05);
  };
  for (const ring of [outer, hole]) for (const s of ringSegs(ring)) out.push(...clip(s));
  // the tunnel's two walls, from the front of the entrance block to where the roof ends over the track, and the block itself: the piers beside the gate and the two arched doors
  const v0 = GATE.vOut + GATE.PD, v1 = GATE.vIn - GATE.EX, seg = (l0, v0_, l1, v1_) => out.push([...P(l0, v0_), ...P(l1, v1_)]);
  for (const l of [lo, hi]) seg(l, v0, l, v1);
  for (const sg of [-1, 1]) {
    const e = sg < 0 ? lo : hi, e1 = e + sg * PIER, e2 = e1 + sg * DOOR;
    seg(e, v0, e1, v0); seg(e1, v0, e1, GATE.vOut);
    seg(e1, GATE.vOut + DOOR_D, e2, GATE.vOut + DOOR_D); seg(e2, GATE.vOut + DOOR_D, e2, GATE.vOut);
  }
  // the two goals are solid: a box over the mouth (7.4 m between the posts) and the net behind it (the models are at u = +-52.5 along the pitch, below)
  const Q = (u, v) => [ob.cx + ob.ux * u + ob.vx * v, ob.cz + ob.uz * u + ob.vz * v];
  for (const sg of [-1, 1]) { const a = Q(52.5 * sg, -3.7), b = Q(52.5 * sg, 3.7), c = Q(55.0 * sg, 3.7), d = Q(55.0 * sg, -3.7); out.push([...a, ...b], [...b, ...c], [...c, ...d], [...d, ...a]); }
  return out;
}

function buildStadio() {
  initShared();
  const fp = FP.stadio, outer = pairsOf(fp.p), hole = pairsOf(fp.holes[0]);
  const ob = obb(hole), cx = ob.cx, cz = ob.cz, N = 120;
  const gc = PITCH_Y - 0.8;   // about the terrain under the pitch (the playing area is a flat platform over it, src/stadium-ground.js)
  begin(gc);
  const U = [ob.ux, ob.uz], Vv = [ob.vx, ob.vz];
  // ---- textures. Real colours (Commons photos and the satellite view): teal-green and blue plastic seats, white concrete with teal roofs, rose concrete walkways.
  defMat('stSeats', 256, 256, [4, 4], (g, w, h) => {
    g.fillStyle = '#6d7d78'; g.fillRect(0, 0, w, h); const r = RNG(501);
    for (let row = 0; row < 5; row++) { const y = row * 51; g.fillStyle = '#b7b2a6'; g.fillRect(0, y, w, 12);
      for (let s = 0; s < 8; s++) { const k = r(); g.fillStyle = k < 0.07 ? '#c9d2d4' : k < 0.16 ? '#2f6f9a' : (k < 0.55 ? '#2c8f7f' : '#3aa08c'); g.fillRect(s * 32 + 3, y + 14, 26, 31); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(s * 32 + 3, y + 41, 26, 4); } }
  }, { side: THREE.DoubleSide });
  defMat('stConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#cfccc2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 502, ['rgba(60,60,55,0.12)', 'rgba(250,250,240,0.14)']); g.fillStyle = 'rgba(40,40,40,0.22)'; g.fillRect(0, 60, w, 2); }, { side: THREE.DoubleSide });
  defMat('stRing', 64, 64, [3, 3], (g, w, h) => { g.fillStyle = '#d4aaa0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 160, 2, 503, ['rgba(120,60,60,0.16)', 'rgba(255,225,215,0.18)']); }, { side: THREE.DoubleSide });
  defMat('stAds', 256, 64, [16, 1.5], (g, w, h) => { const r = RNG(504), cols = ['#14161a', '#e46fa0', '#f2f2ee', '#2e6fb8', '#f0c437', '#14161a', '#e46fa0']; let x = 0; while (x < w) { const bw = 20 + r() * 30; g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(x, 0, bw, h); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 4, 22, bw * 0.6, 5); g.fillRect(x + 4, 34, bw * 0.4, 4); x += bw; } }, { side: THREE.DoubleSide });
  // outer facade: pale concrete with a pylon every bay, rows of dark openings, a blue-teal band under the eaves
  defMat('stFacade', 256, 512, [13, 22], (g, w, h) => paintFacade(g, w, h, 13, 22, { base: '#dfdcd2', trim: '#c7c3b8', glass: '#35606c', seed: 505,
    bands: [{ y: 17.2, h: 3.4, c: '#2e7f94' }, { y: 8.6, h: 0.5, c: '#bdb9ae' }], pil: { xs: [0, 6.5], w: 1.0, c: '#efede6' },
    rows: [{ y0: 1.2, y1: 4.4, n: 3, m: 2.0, w: 1.6, kind: 'rect', fr: 0.1, glass: '#4a5560' }, { y0: 10.0, y1: 13.2, n: 3, m: 2.0, w: 2.2, kind: 'rect', fr: 0.1, glass: '#3f6a7a' }] }), { side: THREE.DoubleSide });
  // the main front towards Viale del Fante, one 13 m bay: cream plinth with doors, the green-blue curtain wall, a pale curved gallery, the open underside of the stand with its steel struts, a dark teal band
  defMat('stGlazed', 256, 512, [13, 22], (g, w, h) => {
    const X = (m) => m / 13 * w, Y = (m) => h - m / 22 * h, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), X(x1 - x0), Y(y0) - Y(y1)); };
    R(0, 0, 13, 22, '#d8d2bf'); for (let x = 0.7; x < 13; x += 3.2) R(x, 0, x + 1.9, 3.4, '#33383a'); R(0, 4.2, 13, 4.6, '#b9b3a2');
    R(0, 5.4, 13, 11.2, '#c9d4d2'); for (let x = 0.15; x < 13; x += 1.08) for (let y = 5.6; y < 11; y += 1.38) R(x, y, x + 0.94, y + 1.24, ['#4f8587', '#5f9a99', '#7cb0ab', '#3f6f78'][Math.floor(x * 3 + y * 7) % 4]);
    R(0, 11.2, 13, 12.9, '#d6d0bc'); R(0, 12.65, 13, 12.9, '#efe9d6'); for (let x = 0.2; x < 13; x += 0.65) R(x, 11.5, x + 0.4, 12.2, '#4a4e4c');
    R(0, 12.9, 13, 18.6, '#262b2c'); for (let k = 0; k < 5; k++) R(0, 13.6 + k * 1.05, 13, 13.8 + k * 1.05, '#4a4c47');
    g.strokeStyle = '#a7aaa4'; g.lineWidth = 3; for (let x = 0; x < 13; x += 3.25) { g.beginPath(); g.moveTo(X(x), Y(12.9)); g.lineTo(X(x + 1.6), Y(18.6)); g.lineTo(X(x + 3.25), Y(12.9)); g.moveTo(X(x + 1.6), Y(18.6)); g.lineTo(X(x + 1.6), Y(15.4)); g.stroke(); }
    R(0, 18.6, 13, 22, '#2b6f86'); R(0, 18.6, 13, 18.95, '#d6d0bc'); R(0, 20.8, 13, 21.1, '#4d93a6');
    noiseDots(g, w, h, 500, 2, 513, ['rgba(40,45,40,0.12)', 'rgba(250,250,240,0.10)']);
  }, { side: THREE.DoubleSide });
  // the board under the roof: the name, gold on dark teal, and the club's pink banner below it (it fills the right half of the gate's name canvas)
  const paintBoard = (g, w, h) => {
    g.fillStyle = '#1e4e5a'; g.fillRect(0, 0, w, 96); g.fillStyle = '#e2bb52'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 34px Arial, Helvetica, sans-serif'; g.fillText('S T A D I O   C O M U N A L E', w / 2, 26, w - 30); g.font = '900 46px Arial, Helvetica, sans-serif'; g.fillText('R E N Z O   B A R B E R A', w / 2, 70, w - 30);
    g.fillStyle = '#e387ab'; g.fillRect(0, 96, w, 96); g.fillStyle = '#17141a';
    g.save(); g.translate(70, 144); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-42, -26 + k * 13); g.lineTo(30 - k * 6, -22 + k * 13); g.lineTo(14 - k * 6, -13 + k * 13); g.closePath(); g.fill(); } g.beginPath(); g.moveTo(18, -30); g.lineTo(44, -14); g.lineTo(20, -8); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#ffffff'; g.font = '900 50px Arial, Helvetica, sans-serif'; g.fillText('#SIAMOAQUILE', w / 2 + 50, 146, w - 160);
  };
  defMat('stTeal', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#287a78'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,50,60,0.3)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); noiseDots(g, w, h, 200, 2, 506, ['rgba(255,255,255,0.08)']); }, { side: THREE.DoubleSide });
  defMat('stRoofTop', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#c3cdc8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(70,90,85,0.25)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); noiseDots(g, w, h, 200, 2, 509, ['rgba(255,255,255,0.12)']); }, { side: THREE.DoubleSide });
  defMat('stRoofUnder', 0, 0, [1, 1], null, { roughness: 1, side: THREE.DoubleSide });
  defMat('stSteel', 0, 0, [1, 1], null, { roughness: 0.6 });
  defMat('stLamp', 0, 0, [1, 1], null, { roughness: 1, emissive: new THREE.Color('#fff6d8'), emissiveIntensity: 0.9 });
  defMat('stFence', 64, 64, [1, 1], (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#8f9498'; g.fillRect(0, 2, w, 3); g.fillRect(0, h - 5, w, 3); for (let x = 4; x < w; x += 8) g.fillRect(x, 0, 2, h); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  const PW = ob.w + 4, PH = ob.d + 4;
  defMat('stPitch', 1024, Math.round(1024 * PH / PW), [1, 1], (g, w, h) => {   // the track (red, requested) round the grass; lifted 0.8 m over the raised layer (street_raised sits about 0.35 m over the terrain mesh here)
    const sx = w / PW, sy = h / PH, X = (m) => w / 2 + m * sx, Y = (m) => h / 2 + m * sy;
    g.fillStyle = '#b4584a'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 3000, 2, 507, ['rgba(80,30,20,0.18)', 'rgba(230,150,120,0.15)']);
    const gx0 = -57.5, gx1 = 57.5, gy0 = -37, gy1 = 37;
    g.fillStyle = '#4a8a3c'; g.fillRect(X(gx0), Y(gy0), (gx1 - gx0) * sx, (gy1 - gy0) * sy);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,30,0,0.10)'; g.fillRect(X(-52.5 + i * 7), Y(-34), 7 * sx, 68 * sy); }
    g.strokeStyle = '#eef2ea'; g.lineWidth = 3; g.strokeRect(X(-52.5), Y(-34), 105 * sx, 68 * sy);
    g.beginPath(); g.moveTo(X(0), Y(-34)); g.lineTo(X(0), Y(34)); g.stroke(); g.beginPath(); g.arc(X(0), Y(0), 9.15 * sx, 0, 7); g.stroke();
    for (const s of [-1, 1]) { g.strokeRect(s > 0 ? X(52.5 - 16.5) : X(-52.5), Y(-20.2), 16.5 * sx, 40.4 * sy); g.strokeRect(s > 0 ? X(52.5 - 5.5) : X(-52.5), Y(-9.2), 5.5 * sx, 18.4 * sy); }
  }, { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -12 });   // no slope factor: seen edge-on from outside it pulled the pitch through the stands as a green line
  // polar sampling of the two rings from the centre of the playing area
  const D = [], I = [], O = [], gI = [], gO = [];
  for (let k = 0; k < N; k++) {
    const a = k / N * 2 * PI, dx = Math.cos(a), dz = Math.sin(a), ri = rayHit(hole, cx, cz, dx, dz), ro = rayHit(outer, cx, cz, dx, dz);
    D.push([dx, dz]); I.push([cx + dx * ri, cz + dz * ri]); O.push([cx + dx * ro, cz + dz * ro]);
    gI.push(groundY(I[k][0], I[k][1])); gO.push(groundY(O[k][0], O[k][1]));
  }
  const arc = [0]; for (let k = 1; k <= N; k++) arc.push(arc[k - 1] + Math.hypot(I[k % N][0] - I[k - 1][0], I[k % N][1] - I[k - 1][1]));
  // two tiers (lower rake to a rose walkway at about 9 m, upper rake to the rim at about 21 m); t is the fraction of the way from the pitch wall to the outer wall
  const PROF = [[0.0, 1.4], [0.03, 1.5], [0.36, 8.6], [0.42, 8.9], [0.50, 8.9], [0.51, 10.0], [0.93, 21.0], [1.0, 21.4]], HT = 22.0;
  const ST = PROF.map(([t, h]) => I.map((p, k) => [p[0] + (O[k][0] - p[0]) * t, gI[k] + h, p[1] + (O[k][1] - p[1]) * t]));
  const dist = PROF.map(() => new Array(N + 1).fill(0));
  for (let i = 1; i < PROF.length; i++) for (let k = 0; k < N; k++) dist[i][k] = dist[i - 1][k] + Math.hypot(ST[i][k][0] - ST[i - 1][k][0], ST[i][k][1] - ST[i - 1][k][1], ST[i][k][2] - ST[i - 1][k][2]);
  // the gate's width on the front: the stands, the pitch wall and the facade leave out every cell that touches it; the bowl's cells are radial, so the cut is a little wider than the gate,
  // and ext is how far it reaches on each side (the tunnel's abutments below cover it)
  const lo = GATE.u - GATE.halfW, hi = GATE.u + GATE.halfW, ext = { lo, hi };
  const overGate = (track, ...p) => {
    let l0 = 1e9, l1 = -1e9; for (const q of p) { const l = lat(q[0], q[2]); l0 = Math.min(l0, l); l1 = Math.max(l1, l); }
    if (l1 <= lo || l0 >= hi || dep((p[0][0] + p[2][0]) / 2, (p[0][2] + p[2][2]) / 2) < 30) return false;
    if (track) { ext.lo = Math.min(ext.lo, l0); ext.hi = Math.max(ext.hi, l1); }
    return true;
  };
  const gateCut = (a, b, c, d) => (a[1] + b[1] + c[1] + d[1]) / 4 - gc < 6.4 && overGate(true, a, b, c, d);
  const band = (i0, i1, key, skip) => gridMesh(key, ST.slice(i0, i1 + 1), (i, j) => [arc[j] / 4, dist[i0 + i][j % N] / 4], { wrap: true, skip: skip ? (i, j, a, b, c, d) => gateCut(a, b, c, d) : undefined });
  band(0, 1, 'stSeats', true); band(1, 2, 'stSeats', true); band(2, 3, 'stConc', true); band(3, 4, 'stRing', true); band(4, 5, 'stConc'); band(5, 6, 'stSeats'); band(6, 7, 'stConc');
  // radial gangways (rose concrete) down both tiers, one every five samples
  for (let k = 2; k < N; k += 5) for (const [i0, i1] of [[1, 2], [5, 6]]) {
    const a = ST[i0][k], b = ST[i1][k], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (lat(a[0], a[2]) > ext.lo - 1.5 && lat(a[0], a[2]) < ext.hi + 1.5 && dep(a[0], a[2]) > 30) continue;
    box('stRing', 1.3, 0.12, len, { p: [a[0], a[1] + 0.04, a[2]], ry: Math.atan2(dx, dz), rx: -Math.asin(dy / len), noao: true });
  }
  // front wall with advertising boards
  gridMesh('stAds', [I.map((p, k) => [p[0], gI[k], p[1]]), I.map((p, k) => [p[0], gI[k] + 1.5, p[1]])], (i, j) => [arc[j] / 16, i], { wrap: true, skip: (i, j, a, b, c, d) => overGate(true, a, b, c, d) });
  // outer facade: lower band (the gate's opening cut out, strips filled in up to its edges) and an upper band that bridges the gate
  const HF = (k) => gI[k] + HT;
  const fa = (y) => O.map((p, k) => [p[0], y(k), p[1]]);
  const ac = [0]; for (let k = 1; k <= N; k++) ac.push(ac[k - 1] + Math.hypot(O[k % N][0] - O[k - 1][0], O[k % N][1] - O[k - 1][1]));
  const FL = 0.27;   // v of the lower band's top in the facade texture
  // the samples of the covered front (the long side towards Viale del Fante, WSW), in order along it
  const front = (() => { const sgn = Vv[0] < 0 ? 1 : -1, av = Math.atan2(Vv[1] * sgn, Vv[0] * sgn), o = []; for (let k = 0; k < N; k++) { let d = k / N * 2 * PI - av; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; if (Math.abs(d) < 0.95) o.push([d, k]); } return o.sort((p, q) => p[0] - q[0]).map(p => p[1]); })();
  const frontSet = new Set(front), isFront = (j) => frontSet.has(j % N) && frontSet.has((j + 1) % N);
  const fl = { l0: 1e9, l1: -1e9 };   // the cut's reach along the front, with the edge points [bottom, top, arc length] at both ends
  for (const key of ['stFacade', 'stGlazed']) gridMesh(key, [fa(k => gO[k] - 0.8), fa(k => Math.max(gO[k], gI[k]) + 5.6)], (i, j) => [ac[j] / 13, i * FL], { wrap: true, skip: (i, j, a, b, c, d) => {
    if (isFront(j) !== (key === 'stGlazed')) return true;
    if (!overGate(false, a, b, c, d)) return false;
    for (const [p, q, k] of [[a, d, j], [b, c, j + 1]]) { const l = lat(p[0], p[2]); if (l < fl.l0) { fl.l0 = l; fl.A = [p, q, ac[k]]; } if (l > fl.l1) { fl.l1 = l; fl.B = [p, q, ac[k]]; } }
    return true;
  } });
  for (const [c0, c1] of [[fl.l1, hi], [lo, fl.l0]]) {   // (the bowl's samples run towards smaller u, so the strip nearer the larger u comes first)
    const cols = [c0, c1].map(l => { const f = (l - fl.l0) / (fl.l1 - fl.l0), m = (a, b) => a + (b - a) * f, [A, B] = [fl.A, fl.B], at = (q) => [m(A[q][0], B[q][0]), m(A[q][1], B[q][1]), m(A[q][2], B[q][2])]; return { b: at(0), t: at(1), u: m(A[2], B[2]) }; });
    if (Math.abs(c1 - c0) > 0.05) gridMesh('stGlazed', [cols.map(c => c.b), cols.map(c => c.t)], (i, j) => [cols[j].u / 13, i * FL], {});
  }
  for (const key of ['stFacade', 'stGlazed']) gridMesh(key, [fa(k => Math.max(gO[k], gI[k]) + 5.6), fa(HF)], (i, j) => [ac[j] / 13, FL + i * (1 - FL)], { wrap: true, skip: (i, j) => isFront(j) !== (key === 'stGlazed') });
  gridMesh('stConc', [fa(HF), fa(k => HF(k) + 0.8)], (i, j) => [ac[j] / 2, i], { wrap: true });
  // pylons on the outside (every 4th sample) and the teal eave ring round the whole rim
  const atGate = (x, z, w) => Math.abs(lat(x, z) - GATE.u) < w && dep(x, z) > 30;   // in front of the entrance block, within w of the gate's axis
  const BLOCK = GATE.halfW + PIER + DOOR + 1;   // half the width of the entrance block, and a metre
  for (let k = 0; k < N; k += 4) { if (frontSet.has(k) || atGate(O[k][0], O[k][1], BLOCK)) continue; const Mk = frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]); bx('stConc', Mk, -0.6, 0.6, 0, HF(k) - gO[k] + 1.6, 0, 0.9, { c: '#efede6' }); }
  const eaveIn = (k, d, dy) => [O[k][0] - D[k][0] * d, HF(k) + dy, O[k][1] - D[k][1] * d], eaveOut = (k, d, dy) => [O[k][0] + D[k][0] * d, HF(k) + dy, O[k][1] + D[k][1] * d];
  gridMesh('stTeal', [O.map((p, k) => eaveIn(k, 1.2, 0.5)), O.map((p, k) => eaveOut(k, 2.6, -0.5))], (i, j) => [j * 1.2, i * 3], { wrap: true });
  gridMesh('stTeal', [O.map((p, k) => eaveOut(k, 2.6, -0.5)), O.map((p, k) => eaveOut(k, 2.6, -1.4))], (i, j) => [j * 1.2, i], { wrap: true });
  // the covered main stand (Tribuna, the long side towards Viale del Fante: the side of v = WSW): a deep cantilever roof, pale on top, dark underneath, a teal fascia and white pylons
  { const sgn = Vv[0] < 0 ? 1 : -1, SV = [Vv[0] * sgn, Vv[1] * sgn], av = Math.atan2(SV[1], SV[0]);
    const wrap = (a) => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
    const pick = (centre, half) => { const o = []; for (let k = 0; k < N; k++) { const d = wrap(k / N * 2 * PI - centre); if (Math.abs(d) < half) o.push([d, k]); } o.sort((p, q) => p[0] - q[0]); return o.map(p => p[1]); };
    const run = pick(av, 0.95);
    const row = (t, h, kk) => kk.map(k => [I[k][0] + (O[k][0] - I[k][0]) * t, gI[k] + h, I[k][1] + (O[k][1] - I[k][1]) * t]);
    const outerRow = (h, kk, over) => kk.map(k => [O[k][0] + D[k][0] * over, gI[k] + h, O[k][1] + D[k][1] * over]);
    if (run.length > 3) {
      const t0 = 0.28, h0 = 20.5, h1 = 29.5;
      gridMesh('stRoofTop', [row(t0, h0 + 0.35, run), outerRow(h1 + 0.35, run, 6)], (i, j) => [j * 2, i * 4], {});
      gridMesh('stRoofUnder', [row(t0, h0, run), outerRow(h1, run, 6)], () => [0, 0], { flip: true, noao: true, c: '#555c60' });
      gridMesh('stTeal', [row(t0, h0 - 0.4, run), row(t0, h0 + 0.8, run)], (i, j) => [j, i], {});            // front fascia
      gridMesh('stTeal', [outerRow(h1 - 3.4, run, 6.6), outerRow(h1 + 0.9, run, 5.4)], (i, j) => [j * 3, i], {});   // back fascia, the tall sloped teal edge seen from the street
      gridMesh('stTeal', [outerRow(h1 - 5.0, run, 5.6), outerRow(h1 - 3.4, run, 5.6)], (i, j) => [j, i], { c: '#9fb4c4' });   // and the darker band under it
    }
    // the other long side (Tribuna Montepellegrino) and both ends are open to the sky in the satellite view: no roof there
  }
  // the front's towers: two white concrete fins rising past the roof, a blue core between them with a rounded stair drum in blue and white bands and a glass-block window above it. Below 6 m the
  // fins stand 0.3 m out of the wall (the lapa has no collision with them); above it they step out
  for (let q = 2; q < front.length - 1; q += 5) {
    const k = front[q]; if (atGate(O[k][0], O[k][1], 17)) continue;
    const T = frame(O[k][0], gO[k] - 0.8, O[k][1], D[k][0], D[k][1]), y1 = gI[k] - gO[k] + 30.3, FIN = '#e9e7df', BL = '#2c6f98';
    for (const sg of [-1, 1]) { bx('stConc', T, sg * 2.3 - 0.35, sg * 2.3 + 0.35, 0, 6, -0.3, 0.3, { c: FIN }); bx('stConc', T, sg * 2.3 - 0.35, sg * 2.3 + 0.35, 6, y1, -0.3, 0.9, { c: FIN }); bx('stConc', T, sg * 2.3 - 0.3, sg * 2.3 + 0.3, 6, y1 + 1.6, 0.9, 6.9, { c: FIN }); bx('stConc', T, sg * 2.3 - 0.2, sg * 2.3 + 0.2, y1 + 1.6, y1 + 3.8, 5.4, 6.5, { c: FIN }); }
    bx('stSteel', T, -1.95, 1.95, 8, y1 - 1.0, 0, 6.0, { c: BL });
    for (let b = 0; b < 6; b++) cyl('stSteel', 1.75, 1.75, b % 2 ? 0.7 : 1.9, 8, { M: mul(T, tr(0, 8 + Math.ceil(b / 2) * 1.9 + Math.floor(b / 2) * 0.7, 5.9)), c: b % 2 ? FIN : '#3a82a8', open: true, t0: -PI / 2, tl: PI, noao: true });
    sphere('stSteel', 1.75, { M: mul(T, tr(0, 15.8, 5.9)), c: '#b9c4bc', ky: 0.55, seg: 8, noao: true });
    bx('stConc', T, -1.2, 1.2, 18.4, 24.2, 6.0, 6.08, { c: '#d9cfa8', noao: true });
    for (let y = 19.3; y < 24; y += 1.0) bx('stSteel', T, -1.25, 1.25, y, y + 0.12, 6.08, 6.12, { c: '#6d7468', noao: true });
    for (const x of [-0.4, 0.4]) bx('stSteel', T, x - 0.05, x + 0.05, 18.4, 24.2, 6.08, 6.13, { c: '#6d7468', noao: true });
  }
  // pitch and track, draped on the ground
  const PL = 0.2;   // the pitch is drawn this high over the (lifted) ground: over the raised and green layers of the streets (0.15, 0.16, and their depth offsets), and the lapa stands on it like on a kerb (CURB 0.15)
  const FS = [0, 0.25, 0.5, 0.7, 0.85, 0.9, 0.94, 0.97, 1], rows = [];   // from the centre out (the winding depends on it), finer near the ring where the platform ramps up over a few metres
  for (const f of FS) { rows.push(I.map((p, k) => { const x = cx + (p[0] - cx) * f, z = cz + (p[1] - cz) * f; return [x, groundY(x, z) + PL, z]; })); }
  gridMesh('stPitch', rows, (i, j, p) => { const dx = p[0] - ob.cx, dz = p[2] - ob.cz; return [(dx * U[0] + dz * U[1]) / PW + 0.5, (dx * Vv[0] + dz * Vv[1]) / PH + 0.5]; }, { wrap: true, noao: true });
  // goals
  for (const s of [-1, 1]) { const Mg = frame(ob.cx + U[0] * 52.5 * s, groundY(cx, cz) + PL, ob.cz + U[1] * 52.5 * s, -U[0] * s, -U[1] * s);
    bx('stSteel', Mg, -3.7, -3.6, 0, 2.44, 0, 0.12); bx('stSteel', Mg, 3.6, 3.7, 0, 2.44, 0, 0.12); bx('stSteel', Mg, -3.7, 3.7, 2.34, 2.44, 0, 0.12);
    bx('rail', Mg, -3.7, 3.7, 0, 2.4, -2.0, -1.9, { noao: true }); }
  // the gate, the main entrance: a concrete tunnel from the front to a little way over the track (a floor that follows the ground, two abutments that fill the cut in the stands, a roof slab), and
  // in front of it the entrance block: two piers and a lintel round the opening, an attic with the name, and an arched side door each side (the three arches of the 1932 front). Axis of the gate: u = GATE.u
  { const vf = GATE.vOut + GATE.PD, v1 = GATE.vIn - GATE.EX, go = P(GATE.u, GATE.vOut), Mg = frame(go[0], 0, go[1], SD.F[0], SD.F[1]);
    const gat = (v) => { const q = P(GATE.u, v); return groundY(q[0], q[1]); };
    const gb = (key, l0, l1, y0, y1, w0, w1, o) => bx(key, Mg, l0 - GATE.u, l1 - GATE.u, y0, y1, w0 - GATE.vOut, w1 - GATE.vOut, o);   // a box between laterals l0..l1, heights y0..y1 and v w0..w1
    const rb = Math.max(gat(GATE.vOut), gat(GATE.vIn)) + 5.6, yb = Math.min(gat(GATE.vOut), gat(vf)) - 0.8, yg = yb + 0.8, yl = rb + 1.2, yt = rb + 5.0;   // roof of the tunnel (= the top of the facade's lower band), the foot of the blocks, the ground, the lintel's top, the attic's top, attic top
    const grey = '#d2cfc6', pale = '#ffffff', w0 = GATE.vOut - 0.5, w1 = vf;
    defMat('stApron', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#cfccc2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 400, 2, 511, ['rgba(60,60,55,0.12)', 'rgba(250,250,240,0.14)']); g.fillStyle = 'rgba(40,40,40,0.28)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); },
      { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    defMat('stName', 1024, 384, [1, 1], (cg) => {
      const g = cg, w = 1024, h = 288;
      g.save(); g.translate(512, 0); g.scale(1, 2); paintBoard(g, 512, 192); g.restore();
      g.save(); g.scale(0.5, 384 / 288);
      g.fillStyle = '#e8e5db'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 512, ['rgba(60,60,55,0.10)', 'rgba(250,250,240,0.12)']);
      g.fillStyle = '#2e7f94'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillStyle = '#e46fa0'; g.fillRect(40, 118, w - 80, 4);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1f6a80';
      g.font = '700 64px Arial, Helvetica, sans-serif'; g.fillText('S T A D I O', w / 2, 74);
      let fs = 150, t = 'RENZO BARBERA'; do { g.font = `900 ${fs}px Arial, Helvetica, sans-serif`; fs -= 4; } while (g.measureText(t).width > w - 90); g.fillText(t, w / 2, 198);
      g.restore();
    });
    // floor
    const rows = [], nf = Math.ceil((vf - v1) / 4);
    for (let i = 0; i <= nf; i++) { const v = vf - (vf - v1) * i / nf; rows.push([lo, hi].map(l => { const q = P(l, v); return [q[0], groundY(q[0], q[1]) + 0.06, q[1]]; })); }
    gridMesh('stConc', rows, (i, j, q) => [lat(q[0], q[2]) / 4, dep(q[0], q[2]) / 4], { noao: true });
    // abutments (the stands' cut reaches a little beyond the gate's walls) and the roof slab
    gb('stConc', ext.lo - 0.05, lo, yb, rb + 0.8, v1, GATE.vOut, { c: grey }); gb('stConc', hi, ext.hi + 0.05, yb, rb + 0.8, v1, GATE.vOut, { c: grey });
    gb('stConc', ext.lo - 0.05, ext.hi + 0.05, rb, rb + 0.8, v1, GATE.vOut, { c: grey });
    // piers, lintel, attic with the name and its cornice
    gb('stConc', lo - PIER, lo, yb, rb, w0, w1, { c: pale }); gb('stConc', hi, hi + PIER, yb, rb, w0, w1, { c: pale });
    gb('stConc', lo - PIER, hi + PIER, rb, yl, w0, w1, { c: pale });
    gb('stTeal', lo - PIER - 0.1, hi + PIER + 0.1, rb + 0.25, rb + 0.85, w1, w1 + 0.08, { noao: true });
    gb('stConc', lo - PIER, hi + PIER, yl, yt, w0, w1, { c: pale });
    gb('stTeal', lo - PIER - 0.5, hi + PIER + 0.5, yt, yt + 0.55, w0, w1 + 0.5, { noao: true });
    panel('stName', hi - lo + 2 * PIER - 1.0, yt - yl - 0.5, { M: mul(Mg, tr(0, yl + 0.25, GATE.PD + 0.02)), uvk: [0.5, 1] });
    // the side doors: an arched recess in a block each side, dark inside
    for (const sg of [-1, 1]) {
      const xc = sg * (GATE.halfW + PIER + DOOR / 2), Md = mul(Mg, tr(xc, yb, -0.3)), oh = 0.8 + 4.6;
      archBay('stConc', DOOR, yl - yb, 2.8, oh, DOOR_D + 0.3, { M: Md, c: pale, oy0: 0.8 });
      extrude('stSteel', archShape(2.8, oh - 0.8), 0.05, { M: mul(Mg, tr(xc, yg, 0.05)), c: '#2a2622', noao: true });
      gb('stTeal', GATE.u + sg * (GATE.halfW + PIER) - (sg < 0 ? DOOR : 0) - 0.15, GATE.u + sg * (GATE.halfW + PIER) + (sg > 0 ? DOOR : 0) + 0.15, yl, yl + 0.35, w0, GATE.vOut + DOOR_D + 0.15, { noao: true });
    }
    // the forecourt: a concrete apron from the front of the block, level with the ground (the service road runs into it)
    const aw = 5, al = 11, ar = [];
    for (let i = 0; i <= 3; i++) ar.push([0, 1, 2, 3, 4, 5, 6].map(k => { const q = P(lo - aw + (hi - lo + 2 * aw) * k / 6, vf + al * i / 3); return [q[0], groundY(q[0], q[1]) + 0.03, q[1]]; }));
    gridMesh('stApron', ar, (i, j, q) => [lat(q[0], q[2]) / 4, dep(q[0], q[2]) / 4], { noao: true });
  }
  // the name and the banner under the roof, over the main entrance
  { const SW = 26, v = Math.max(...[-SW / 2, -SW / 4, 0, SW / 4, SW / 2].map(a => { const g0 = P(GATE.u + a, 0); return rayHit(SD.outer, g0[0], g0[1], SD.F[0], SD.F[1]); })) + 3.2, q = P(GATE.u, v), y = groundY(q[0], q[1]);
    const Ms = frame(q[0], y, q[1], SD.F[0], SD.F[1]);
    panel('stName', SW, 9.6, { M: mul(Ms, tr(0, 14.6, 0)), uvk: [0.5, 1], uvo: [0.5, 0] }); bx('stSteel', Ms, -SW / 2 - 0.2, SW / 2 + 0.2, 14.4, 24.4, -0.35, -0.04, { c: '#25363c', noao: true });
  }
  // perimeter fence 13 m outside the wall (Via del Fante side shows the sponsor boards on it), with a gate pier at each turnstile bay
  { const FO = 13;
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N, ax = O[k][0] + D[k][0] * FO, az = O[k][1] + D[k][1] * FO, bx_ = O[k1][0] + D[k1][0] * FO, bz = O[k1][1] + D[k1][1] * FO, l = Math.hypot(bx_ - ax, bz - az);
      if (l < 0.5 || (Math.abs(lat((ax + bx_) / 2, (az + bz) / 2) - GATE.u) < GATE.halfW + 6 + l / 2 && dep(ax, az) > 30)) continue;
      const y = Math.min(groundY(ax, az), groundY(bx_, bz)), Mf = frame((ax + bx_) / 2, y, (az + bz) / 2, -(bz - az) / l, (bx_ - ax) / l);
      panel('stFence', l, 2.2, { M: Mf, uvk: [l / 4, 1], c: '#d8dcde' });
      if (k % 2 === 0) panel('stAds', l, 1.0, { M: mul(Mf, tr(0, 0.9, 0.05)), uvk: [l / 16, 1] });
    }
  }
  // floodlight towers beyond the four corners
  for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let bk = 0, bd = -2; const tx = U[0] * 0.75 * sa + Vv[0] * 0.66 * sb, tz = U[1] * 0.75 * sa + Vv[1] * 0.66 * sb;
    for (let k = 0; k < N; k++) { const d = D[k][0] * tx + D[k][1] * tz; if (d > bd) { bd = d; bk = k; } }
    const x = O[bk][0] + D[bk][0] * 8, z = O[bk][1] + D[bk][1] * 8, y = groundY(x, z), Mt = frame(x, y - 0.5, z, -D[bk][0], -D[bk][1]);
    cyl('stSteel', 0.4, 0.8, 52, 8, { M: Mt, c: '#e4e6e8' });
    bx('stSteel', Mt, -4.8, 4.8, 50.5, 51.8, -1.2, 0.2, { c: '#cfd2d6', noao: true });
    bx('stSteel', Mt, -4.8, 4.8, 51.8, 55.6, -0.1, 0.12, { c: '#8d9298', noao: true });   // the frame the lamps are bolted to
    for (let r = 0; r < 3; r++) for (let q = 0; q < 7; q++) bx('stLamp', Mt, -4.5 + q * 1.5, -3.5 + q * 1.5, 51.8 + r * 1.3, 52.8 + r * 1.3, 0.1, 0.5, { noao: true });
  }
  // the crowd: rosanero fans on the seats of both tiers (src/stadium-crowd.js), none in the gate's tunnel or on the cut round it
  const grp = end('Stadio Renzo Barbera');
  grp.add(buildCrowd({ ST, I, O, tiers: [[1, 2, 0.1, 0.95], [5, 6, 0.04, 0.96]], skip: (x, y, z) => lat(x, z) > ext.lo - 0.5 && lat(x, z) < ext.hi + 0.5 && dep(x, z) > 30 && y - gc < 12 }));
  return grp;
}

// The real road is gated and fenced where it meets the stadium (the tile data has panels of fence and a retaining wall across the way in, which the world streams in): the game's entrance is open, so
// the pieces of them inside the strip in front of the gate (18 m wide, from the wall to the carriageway of Viale del Fante) are left out. src/world.js passes each tile's fences through here.
function clearFences(list) {
  if (!list) return list;
  const L0 = GATE.u - 9, L1 = GATE.u + 9, D0 = GATE.vOut - 2, D1 = 121;
  const outside = (ax, az, bx, bz) => {   // the parts [t0, t1] of a segment that lie outside the strip
    let t0 = 0, t1 = 1;
    for (const [a, b, l0, l1] of [[lat(ax, az), lat(bx, bz), L0, L1], [dep(ax, az), dep(bx, bz), D0, D1]]) {
      const d = b - a;
      if (Math.abs(d) < 1e-9) { if (a <= l0 || a >= l1) return [[0, 1]]; continue; }
      const s0 = (l0 - a) / d, s1 = (l1 - a) / d;
      t0 = Math.max(t0, Math.min(s0, s1)); t1 = Math.min(t1, Math.max(s0, s1));
    }
    return t0 >= t1 ? [[0, 1]] : [[0, t0], [t1, 1]].filter(r => r[1] - r[0] > 1e-6);
  };
  const res = [];
  for (const f of list) {
    const p = f.p, runs = []; let run = null, touched = false;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
      const parts = outside(ax, az, bx, bz);
      if (parts.length !== 1 || parts[0][0] > 0 || parts[0][1] < 1) touched = true;
      for (const [t0, t1] of parts) {
        const qa = [ax + (bx - ax) * t0, az + (bz - az) * t0], qb = [ax + (bx - ax) * t1, az + (bz - az) * t1];
        if (run && Math.hypot(run[run.length - 2] - qa[0], run[run.length - 1] - qa[1]) < 1e-6) run.push(qb[0], qb[1]);
        else { if (run) runs.push(run); run = [qa[0], qa[1], qb[0], qb[1]]; }
      }
    }
    if (run) runs.push(run);
    if (!touched) res.push(f); else for (const r of runs) res.push({ ...f, p: r });
  }
  return res;
}

export const STADIO = {
  name: 'Stadio Renzo Barbera', x: -1666, z: -4097, radius: 140, skipIds: [FP.stadio.id, 'w124120091'], dropWalls: [FP.stadio.id, 'w124120091'],
  walls: stadiumCollision(), clearFences,
  // the vehicle entrance: its mouth on the front wall (x, z), its mouth on the pitch wall (x1, z1), the way in (dx, dz) and half its width; the tunnel's clear height is about 5.5 m
  gate: (() => { const a = P(GATE.u, GATE.vOut), b = P(GATE.u, GATE.vIn); return { x: a[0], z: a[1], x1: b[0], z1: b[1], dx: -SD.F[0], dz: -SD.F[1], halfW: GATE.halfW }; })(),
  build: buildStadio,
};

// ====================================================================================================
// 3. Castello Utveggio on Monte Pellegrino: salmon-pink hotel castle, arcaded front, two crenellated end towers, round bastion at the foot
// ====================================================================================================
// lowest ground (world y) under the local rectangle u0..u1 x v0..v1 of the frame M, so a footing can be rooted below the slope in front of a building
function lowestGround(M, u0, u1, v0, v1) {
  const q = new THREE.Vector3(); let lo = Infinity;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { q.set(u0 + (u1 - u0) * i / 6, 0, v0 + (v1 - v0) * j / 6).applyMatrix4(M); lo = Math.min(lo, groundY(q.x, q.z)); }
  return lo;
}
function skirtDown(key, M, w, d, lo, o = {}) { bx(key, M, -w / 2, w / 2, lo, 0.02, -d / 2, d / 2, o); }

function buildUtveggio() {
  initShared();
  const pts = pairsOf(FP.utveggio.p), gr = groundRange(pts);
  const gy = gr.hi + 0.3;
  const nx = 0.985, nz = 0.17, cxw = -489.0, czw = -4019.4;
  const M = frame(cxw, gy, czw, nx, nz);
  begin(gy);
  const LW = 46.5, WD = 19, H = 17;
  defMat('utvWall', 256, 256, [8, 12], (g, w, h) => paintFacade(g, w, h, 8, 12, { base: '#dba892', trim: '#f0dfc6', glass: '#2d2f38', seed: 601, plinth: { h: 0.8, c: '#b98f7c' },
    bands: [{ y: 5.2, h: 0.35, c: '#ecd3bc' }, { y: 10.4, h: 0.35, c: '#ecd3bc' }],
    rows: [{ y0: 1.4, y1: 3.8, xs: [2, 6], w: 1.0, kind: 'rect' }, { y0: 6.6, y1: 9.0, xs: [2, 6], w: 1.0, kind: 'arch' }, { y0: 11.4, y1: 13.8, xs: [2, 6], w: 1.0, kind: 'rect', shut: 'open' }], shut: '#7a5a4a' }));
  defMat('utvFront', 1024, 512, [LW, 17], (g, w, h) => {
    const xs = []; for (let i = 0; i < 12; i++) xs.push(2.0 + i * 3.6);
    paintFacade(g, w, h, LW, 17, { base: '#dba892', trim: '#f0dfc6', glass: '#2d2f38', seed: 602, plinth: { h: 0.9, c: '#b98f7c' },
      bands: [{ y: 5.6, h: 0.4, c: '#ecd3bc' }, { y: 11.4, h: 0.4, c: '#ecd3bc' }, { y: 15.8, h: 0.5, c: '#ecd3bc' }],
      rows: [{ y0: 1.6, y1: 4.2, xs, w: 1.1, kind: 'rect' }, { y0: 6.6, y1: 10.2, xs: xs.slice(2, 10), w: 2.3, kind: 'arch', fr: 0.25, sill: false }, { y0: 6.8, y1: 9.4, xs: [xs[0], xs[1], xs[10], xs[11]], w: 1.1, kind: 'rect', shut: 'open' }, { y0: 12.2, y1: 14.8, xs, w: 1.1, kind: 'rect', shut: 'open' }], shut: '#7a5a4a' });
  });
  // the grey limestone crag the castle sits on, with a stone retaining base just under the walls
  cliffMat();
  const lowFront = lowestGround(M, -LW / 2 - 8, LW / 2 + 8, -WD / 2 - 6, WD / 2 + 34), drop = Math.min(120, gy - lowFront + 6);   // rooted below the slope in front, so no underside hangs in the air
  crag('cliff', mul(M, tr(0, -1.2, 0)), LW / 2 * 1.2 + 1.5, (WD / 2 + 2.5) * 1.3, drop, { spread: 1.55, seed: 3, jit: 0.24, rough: 0.1, rows: 9, seg: 22, cap: true });
  crag('cliff', mul(M, tr(-LW * 0.32, -4, -WD * 0.35)), 12, 9, drop * 0.7, { spread: 1.7, seed: 9, jit: 0.28, seg: 14, rough: 0.1, rows: 8, cap: true });
  skirtDown('cliff', M, LW + 2, WD + 3, -2.6, { c: '#e8e4d8' });
  // main wing: front texture panel, solid body, cornice, crenellations
  bx('utvWall', M, -LW / 2, LW / 2, 0, H, -WD / 2, WD / 2 - 0.02, { c: '#ffffff' });
  panel('utvFront', LW, 17, { M: mul(M, tr(0, 0, WD / 2 + 0.01)), uvk: [1, 1] });
  bx('flat', M, -LW / 2 - 0.4, LW / 2 + 0.4, H, H + 0.7, -WD / 2 - 0.4, WD / 2 + 0.5, { c: '#e5c4ae' });
  crenel(mul(M, tr(0, H + 0.7, WD / 2 + 0.4)), LW + 0.8, { c: '#e0b9a2' }); crenel(mul(M, mul(rotY(PI), tr(0, H + 0.7, WD / 2 + 0.4))), LW + 0.8, { c: '#e0b9a2' });
  // end towers
  for (const sg of [-1, 1]) {
    const Mt = mul(M, tr(sg * (LW / 2 - 4.2), 0, 1.5)), TH = sg < 0 ? 19.6 : 23.5;   // the right-hand tower is the tall one
    bx('utvWall', Mt, -4.8, 4.8, 0, TH, -5.4, 5.4, { c: '#ffffff' });
    bx('flat', Mt, -5.4, 5.4, TH, TH + 0.8, -6.0, 6.0, { c: '#e5c4ae' });
    for (let q = 0; q < 4; q++) crenel(mul(Mt, mul(rotY(q * PI / 2), tr(0, TH + 0.8, q % 2 ? 5.9 : 5.5))), q % 2 ? 11.6 : 10.8, { c: '#e0b9a2' });
  }
  // the round bastion and the terrace wall at the foot (north-west blob of the footprint)
  const bxw = -510.5, bzw = -3985.0, by = Math.max(gr.hi - 1.5, groundY(bxw, bzw));
  crag('cliff', tr(bxw, by + 1.7 - 1.5, bzw), 12.6, 12.6, by - groundY(bxw, bzw) + 6, { spread: 1.35, seed: 5, jit: 0.1 });
  cyl('stone', 12.5, 12.6, 3.2, 16, { p: [bxw, by - 1.5, bzw], c: '#b9ad98' });
  lathe('stone', [[12.5, 0], [12.5, 0.9], [11.5, 0.9]], 16, { p: [bxw, by + 1.7, bzw], c: '#c9bda7' });
  // a retaining wall in front of the castle with crenellated coping, standing on a rock footing that reaches down to the slope below it (a box that deep was a sheer prism)
  const Mw = mul(M, tr(0, 0, WD / 2 + 7));
  bx('cliff', Mw, -LW / 2 + 2, LW / 2 - 6, -5, 0.2, -1.0, 1.0, { c: '#eeeadc' });
  crag('cliff', mul(Mw, tr(-2, -3, 0)), (LW - 8) / 2 - 1, 4.2, Math.max(8, gy - lowestGround(Mw, -LW / 2 + 2, LW / 2 - 6, -4, 22) + 6), { spread: 1.9, seed: 14, jit: 0.3, rough: 0.12, seg: 20, rows: 8, cap: true });
  crenel(mul(Mw, tr(0, 0.2, 1.0)), LW - 8, { c: '#c4b8a0' });
  // roof terrace details
  box('flat', 8, 2.4, 6, { M: mul(M, tr(-6, H + 0.7, -3)), c: '#d6b49e' });
  return end('Castello Utveggio');
}
export const UTVEGGIO = { name: 'Castello Utveggio', x: -503, z: -4000, radius: 80, skipIds: [FP.utveggio.id], build: buildUtveggio };

// ====================================================================================================
// 4. Santuario di Santa Rosalia (Monte Pellegrino), redrawn from Commons photos (names only): Santuario Santa Rosalia.jpg, Santuario di santa Rosalia a Palermo.jpg, Santuario Santa Rosalia ext.JPG,
//    Monte Pellegrino BW 2012-10-09 15-27-29.JPG, Palermo Santuario di Santa Rosalia.jpg, Palermo - Santuario di Santa Rosalia - 2025-09-10 22-30-04 002.jpg; the 15 cm orthophoto of the Regione
//    Siciliana for the layout (front to the west, rock along the south side and behind).
//    Read: from the forecourt, a salmon-ochre convent wing on the left with balconies, green shutters and the Opera Don Orione lettering; on the right the cream church front with white stone pilasters
//    and two heavy cornices, the clock and bell gable over its left bay, the marble portal with columns on a raised terrace with a balustrade, a carved white niche with the saint above it; the pale
//    limestone cliff stands against the right end of the front and rises far above the roofs, with trees along its top.
//    Not seen in any photo: the back and north sides (plain walls with windows), the grotto inside, the long stair from the road below (not built: the forecourt is at the road's level here).
//    The front is as long as the mapped footprint (21.7 m), shorter than the real convent wing. The small mapped building at the south end (x25070) stands where the photos show rock: the cliff replaces it.
// ====================================================================================================
const SAN_A = [-0.291, 0.957], SAN_N = [-0.957, -0.291], SAN_MID = [-833.85, -5784.45];   // along the front towards the south (the viewer's right), out of the front, middle of the footprint's west edge
const SAN_P = (u, v) => [SAN_MID[0] + SAN_A[0] * u + SAN_N[0] * v, SAN_MID[1] + SAN_A[1] * u + SAN_N[1] * v];
const SAN_U = 10.85, SAN_LO = -1, SAN_HI = 19;   // the front canvas covers u -SAN_U..SAN_U, y SAN_LO..SAN_HI
function sanFrontPaint(g, w, h) {
  const sx = w / (2 * SAN_U), sy = h / (SAN_HI - SAN_LO), X = (u) => (u + SAN_U) * sx, Y = (y) => h - (y - SAN_LO) * sy;
  const R = (u0, y0, u1, y1, c) => { g.fillStyle = c; g.fillRect(X(u0), Y(y1), (u1 - u0) * sx, (y1 - y0) * sy); };
  const arch = (u, y0, y1, wd, c) => { const r = wd / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(u - r), Y(y0)); g.lineTo(X(u - r), Y(y1 - r)); g.ellipse(X(u), Y(y1 - r), r * sx, r * sy, 0, PI, 2 * PI); g.lineTo(X(u + r), Y(y0)); g.fill(); };
  const tri = (u, y, wd, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(u - wd / 2), Y(y)); g.lineTo(X(u), Y(y + hh)); g.lineTo(X(u + wd / 2), Y(y)); g.fill(); };
  const WHITE = '#ded8c8', SHADE = 'rgba(70,50,30,0.35)', GREEN = '#35604a', DKG = '#223f31';
  const shut = (u, y0, y1, wd) => {   // a framed window with louvred green shutters
    R(u - wd / 2 - 0.18, y0 - 0.18, u + wd / 2 + 0.18, y1 + 0.2, WHITE); R(u - wd / 2, y0, u + wd / 2, y1, GREEN); R(u - 0.04, y0, u + 0.04, y1, DKG);
    for (let y = y0 + 0.18; y < y1 - 0.05; y += 0.22) R(u - wd / 2 + 0.07, y, u + wd / 2 - 0.07, y + 0.06, DKG);
    R(u - wd / 2 - 0.3, y0 - 0.3, u + wd / 2 + 0.3, y0 - 0.18, SHADE);
  };
  const grille = (u, y0, y1, wd) => { R(u - wd / 2 - 0.18, y0 - 0.18, u + wd / 2 + 0.18, y1 + 0.18, WHITE); R(u - wd / 2, y0, u + wd / 2, y1, '#1f2224'); for (let a = u - wd / 2 + 0.2; a < u + wd / 2; a += 0.24) R(a, y0, a + 0.04, y1, '#8d8a80'); for (let y = y0 + 0.3; y < y1; y += 0.36) R(u - wd / 2, y, u + wd / 2, y + 0.05, '#8d8a80'); };
  // convent wing
  R(-SAN_U, SAN_LO, -4, SAN_HI, '#dcab83');
  R(-SAN_U, SAN_LO, -4, 0.8, '#b79a80');
  arch(-8.3, 0, 3.9, 2.4, '#e6c4a0'); for (let k = 0; k < 9; k++) { const a = PI + (k + 0.5) * PI / 9; g.strokeStyle = SHADE; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(-8.3) + Math.cos(a) * 0.9 * sx, Y(2.7) + Math.sin(a) * 0.9 * sy); g.lineTo(X(-8.3) + Math.cos(a) * 1.2 * sx, Y(2.7) + Math.sin(a) * 1.2 * sy); g.stroke(); }
  arch(-8.3, 0, 3.4, 1.6, '#2f6a50'); R(-8.34, 0, -8.26, 2.6, DKG); R(-9.1, 2.6, -7.5, 2.68, DKG);
  R(-10.55, 1.4, -9.65, 2.8, WHITE); for (let y = 1.6; y < 2.7; y += 0.22) R(-10.45, y, -9.75, y + 0.05, '#8d8a80');   // the stone plaque by the door
  grille(-5.6, 1.3, 3.1, 1.2); grille(-6.8, 1.3, 3.1, 0.7);
  R(-SAN_U, 4.35, -4, 4.6, '#e9d2b4');
  for (const u of [-9.0, -5.9]) { shut(u, 5.2, 7.7, 1.25); tri(u, 8.05, 2.0, 0.55, '#ecd9bc'); R(u - 1.0, 7.9, u + 1.0, 8.08, WHITE); shut(u, 9.3, 10.9, 1.0); }
  R(-SAN_U, 11.25, -4, 11.4, '#e9d2b4');
  g.fillStyle = '#7a5138'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(0.55 * sy)}px serif`; g.fillText('OPERA DON ORIONE', X(-7.4), Y(11.78), 6.2 * sx);
  // church front
  R(-4, SAN_LO, SAN_U, SAN_HI, '#e7c98e');
  R(-4, SAN_LO, SAN_U, 1.4, '#c4b8a0');
  R(-4, 8.0, SAN_U, 8.55, WHITE); R(-4, 7.85, SAN_U, 8.0, SHADE); R(-4, 12.25, SAN_U, 12.8, WHITE); R(-4, 12.1, SAN_U, 12.25, SHADE);
  for (const [u0, u1] of [[-4, -3.45], [-0.35, 0.3], [7.75, 8.3]]) { R(u0, 1.4, u1, 18, WHITE); R(u1 - 0.12, 1.4, u1, 18, SHADE); }
  // tower bay: grille with a stucco shell fan in a blind arch, balcony door, two small windows
  arch(-1.95, 3.2, 5.0, 2.3, '#d9bd8a'); for (let k = 0; k <= 8; k++) { const a = PI + k * PI / 8; g.strokeStyle = '#f0e2c0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(-1.95), Y(3.85)); g.lineTo(X(-1.95) + Math.cos(a) * 1.0 * sx, Y(3.85) + Math.sin(a) * 1.0 * sy); g.stroke(); }
  grille(-1.95, 1.7, 3.35, 1.5);
  shut(-1.95, 5.5, 7.45, 1.35); R(-2.9, 7.55, -1.0, 7.7, WHITE);
  shut(-2.75, 9.5, 10.85, 0.8); shut(-1.15, 9.5, 10.85, 0.8);
  // portal bay: the white marble surround round the door, side tablets, the window with its own pediment, the shutters either side of the niche
  R(2.0, 1.4, 6.0, 5.2, '#d6d1c4'); arch(4, 1.4, 5.0, 2.2, '#b9b2a2'); arch(4, 1.4, 4.8, 1.85, '#3a2a1e'); R(3.97, 1.4, 4.03, 3.9, '#140e0a');
  for (const u of [3.35, 3.7, 4.35, 4.7]) R(u - 0.03, 1.5, u + 0.03, 3.7, 'rgba(120,90,60,0.5)');
  for (const u of [1.05, 6.95]) { R(u - 0.55, 2.1, u + 0.55, 4.0, '#e2ddd0'); for (let y = 2.35; y < 3.9; y += 0.22) R(u - 0.4, y, u + 0.4, y + 0.05, '#9d978a'); }
  R(3.1, 5.55, 4.9, 6.95, WHITE); shut(4, 5.75, 6.7, 1.15); tri(4, 6.95, 2.6, 0.75, WHITE); tri(4, 7.03, 1.8, 0.45, '#cfc6b2');
  for (const u of [1.35, 6.65]) shut(u, 9.35, 11.35, 1.05);
  R(2.5, 8.55, 5.5, 12.2, '#e4dfd2'); { const r = RNG(615); for (let i = 0; i < 170; i++) { const u = 2.55 + r() * 2.9, y = 8.65 + r() * 3.5; g.fillStyle = r() < 0.5 ? 'rgba(110,100,85,0.45)' : 'rgba(255,252,240,0.6)'; g.beginPath(); g.ellipse(X(u), Y(y), 1 + r() * 3, 1 + r() * 2.5, r() * 3, 0, 7); g.fill(); } }
  shut(9.5, 9.35, 11.35, 0.95); shut(9.5, 5.6, 7.2, 0.9); grille(9.5, 2.3, 3.7, 0.9);
  // tower gable: two bell arches, cornice, clock
  for (const u of [-2.75, -1.2]) { arch(u, 13.15, 15.05, 1.1, WHITE); arch(u, 13.3, 14.9, 0.78, '#2b2018'); R(u - 0.24, 13.7, u + 0.24, 14.35, '#4a3a22'); }
  R(-4, 15.25, 0.3, 15.55, WHITE);
  g.fillStyle = WHITE; g.beginPath(); g.ellipse(X(-1.95), Y(16.65), 1.0 * sx, 1.0 * sy, 0, 0, 7); g.fill();
  g.fillStyle = '#f7f5ee'; g.beginPath(); g.ellipse(X(-1.95), Y(16.65), 0.74 * sx, 0.74 * sy, 0, 0, 7); g.fill(); g.strokeStyle = '#2a2420'; g.lineWidth = 2; g.stroke();
  for (let k = 0; k < 12; k++) { const a = k * PI / 6; g.fillStyle = '#2a2420'; g.fillRect(X(-1.95) + Math.cos(a) * 0.58 * sx - 1, Y(16.65) + Math.sin(a) * 0.58 * sy - 1, 2.5, 2.5); }
  g.beginPath(); g.moveTo(X(-1.95), Y(17.15)); g.lineTo(X(-1.95), Y(16.65)); g.lineTo(X(-1.55), Y(16.5)); g.stroke();
  streaks(g, w, h, 34, 616, 0.1, h * 0.22, '90,62,40');
  noiseDots(g, w, h, 1400, 2, 617, ['rgba(110,70,40,0.10)', 'rgba(255,240,215,0.10)']);
}
// pale limestone of the cliff over the sanctuary: vertical runs of ochre and dark grey, pale fresh faces, fissures, dark scrub in the cracks
function sanRockPaint(g, w, h) {
  const r = RNG(621), wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  g.fillStyle = '#c6c2b6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, rx = 3 + r() * 13, ry = 22 + r() * 70, k = r(), c = k < 0.3 ? '178,140,92' : k < 0.58 ? '104,104,100' : '234,231,222', a = 0.14 + r() * 0.22;
    wrap(() => { g.fillStyle = `rgba(${c},${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.12, 0, 7); g.fill(); });
  }
  noiseDots(g, w, h, 2200, 2.6, 622, ['rgba(70,68,60,0.20)', 'rgba(245,242,232,0.28)']);
  for (let i = 0; i < 22; i++) { let x = r() * w, y = r() * h; const pts = [[x, y]]; for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 12; y += 8 + r() * 14; pts.push([x, y]); } const lw = 0.8 + r() * 1.6; wrap(() => { g.strokeStyle = 'rgba(48,44,36,0.5)'; g.lineWidth = lw; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); }); }
  for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h; for (let k = 0; k < 7; k++) { const px = x + (r() - 0.5) * 14, py = y + (r() - 0.5) * 9, s = 1.5 + r() * 3; wrap(() => { g.fillStyle = `rgba(${r() < 0.5 ? '66,82,44' : '92,100,52'},0.7)`; g.beginPath(); g.arc(px, py, s, 0, 7); g.fill(); }); } }
}
// the rock wall, north to south: [u, v at the foot, v at the crest, crest height, foot height (null: on the ground)], heights over the forecourt
const SAN_CLIFF = [
  [-11.2, -17.5, -19.0, 14.5, 8], [-9.5, -14, -18.0, 20, 8], [-7.0, -11.5, -16.5, 22.5, 8], [-4.5, -9.5, -15, 26.5, 8], [-2.0, -9.0, -14.5, 23.5, 8], [0.5, -7.2, -13, 28, 8], [3.0, -6.4, -12, 30.5, 8], [5.5, -5.2, -11, 27, 8], [8.2, -4.8, -9.5, 32.5, 8],
  [10.75, -4.6, -9, 31, 8], [10.95, -2.2, -7, 32.5, null], [11.15, -0.4, -6, 33, null], [12.6, -0.15, -5.2, 36, null], [14.4, -0.7, -7, 33.5, null], [16.6, -0.2, -5.4, 35.5, null], [18.8, -1.1, -6.6, 31, null], [21.0, -0.35, -6.8, 27, null], [23.2, -0.6, -5.8, 20, null], [24.6, -2.2, -4.6, 12, null],
];
function sanCliff(M, y0) {
  const r = RNG(623), T = [0, 0.09, 0.2, 0.33, 0.47, 0.62, 0.76, 0.89, 1], q = new THREE.Vector3(), rows = T.map(() => []);
  const back = [[], []], crest = [];
  for (const [u, vb, vt, top, base] of SAN_CLIFF) {
    const gl = (a, b) => groundY(...SAN_P(a, b)) - y0, yb = base === null ? Math.min(...[-2, -1, 0, 1, 2].flatMap(a => [gl(u + a, vb), gl(u + a, vb - 2)])) - 1.5 : base, ledge = r() * 0.5;
    T.forEach((t, i) => {
      const free = i > 0, uu = u + (free && u !== 10.95 && u !== 11.15 ? (r() - 0.5) * 1.1 : 0), yy = yb + (top - yb) * t + (free && i < T.length - 1 ? (r() - 0.5) * 1.4 : i ? (r() - 0.5) * 2.2 : 0);
      let v = vb + (vt - vb) * Math.pow(t, 1.5) + (free ? (r() - 0.5) * 2.2 + ((i % 3 === (ledge < 0.25 ? 1 : 2)) ? 0.8 : 0) : 0);
      if (base !== null) v = Math.min(v, vb + 0.3);   // over the roofs the rock never comes through the front below
      else if (yy - gl(uu, v) < 4.5) v = Math.min(v, 0.1);   // and near the ground it stays behind the walls' line
      rows[i].push(q.set(uu, yy, v).applyMatrix4(M).toArray());
    });
    const v1 = Math.max(-20.2, vt - 2.6), v2 = Math.max(-20.3, vt - 7);
    back[0].push(q.set(u, top - 1.6, v1).applyMatrix4(M).toArray());
    back[1].push(q.set(u, Math.min(top - 7, gl(u, v2) - 1), v2).applyMatrix4(M).toArray());
    crest.push([u, top, vt]);
  }
  const arc = [0]; for (let j = 1; j < SAN_CLIFF.length; j++) arc.push(arc[j - 1] + Math.hypot(rows[0][j][0] - rows[0][j - 1][0], rows[0][j][2] - rows[0][j - 1][2]));
  const all = [...rows, ...back];
  gridMesh('sanRock', all, (i, j, p) => [arc[j] / 11 + i * 0.013, (p[1] - y0) / 13], { noao: true });
  // the two ends are closed down to the foot
  for (const j of [0, SAN_CLIFF.length - 1]) { const side = all.map(row => row[j]), core = side.map(p => [side[0][0] * 0.35 + back[1][j][0] * 0.65, p[1] - 0.5, side[0][2] * 0.35 + back[1][j][2] * 0.65]); gridMesh('sanRock', [side, core], (i, k, p) => [k / 6, (p[1] - y0) / 13], { noao: true, flip: j !== 0 }); }
  // pines and bushes along the crest (two or three small crowns in a clump) and tufts of scrub on the face
  for (let k = 1; k < crest.length - 1; k++) {
    const [u, top, vt] = crest[k], n = 1 + (k % 3);
    for (let a = 0; a < n; a++) { const q_ = 0.55 + r() * 0.75; sphere('flat', q_, { M, p: [u + (r() - 0.5) * 2.4, top - 0.7 + q_ * 0.35 - a * 0.5, vt - 1.0 + r() * 1.2], c: ['#4a5c32', '#3d4f29', '#5d6b3c'][(k + a) % 3], ky: 0.65 + r() * 0.3, ry: r() * 3, seg: 6, noao: true }); }
  }
  for (let k = 0; k < 18; k++) { const j = 1 + Math.floor(r() * (SAN_CLIFF.length - 2)), i = 4 + Math.floor(r() * 4), p = rows[i][j], q_ = 0.3 + r() * 0.45; sphere('flat', q_, { p: [p[0], p[1], p[2]], c: r() < 0.5 ? '#4f6234' : '#6a7444', ky: 0.6, seg: 6, noao: true }); }
}
function buildSantuario() {
  initShared();
  const y0 = groundY(...SAN_P(-2, 0.4)), M = frame(SAN_MID[0], y0, SAN_MID[1], SAN_N[0], SAN_N[1]);
  begin(y0);
  defMat('sanFront', 512, 384, [2 * SAN_U, SAN_HI - SAN_LO], sanFrontPaint);
  defMat('sanSide', 128, 128, [6, 4.2], (g, w, h) => paintFacade(g, w, h, 6, 4.2, { base: '#dcb188', trim: '#ecdcc0', glass: '#2c333b', seed: 612, rows: [{ y0: 1.2, y1: 3.0, xs: [3], w: 1.1, kind: 'rect', shut: 'closed' }], shut: '#3f6a50' }));
  defMat('sanRock', 256, 256, [11, 13], sanRockPaint);
  const WH = '#e0dacb', MB = '#d9d5c8', ST = '#948b79', low = -6;
  const face = (u0, u1, ya, yb, v) => panel('sanFront', u1 - u0, yb - ya, { M: mul(M, tr((u0 + u1) / 2, ya, v)), uvk: [(u1 - u0) / (2 * SAN_U), (yb - ya) / (SAN_HI - SAN_LO)], uvo: [(u0 + SAN_U) / (2 * SAN_U), (ya - SAN_LO) / (SAN_HI - SAN_LO)] });
  const side = (u0, u1, y1, v0, v1) => bx('sanSide', M, u0, u1, low, y1, v0, v1, { uvo: [0, -y0 / 4.2] });
  // bodies: convent wing flush with the footprint, church front set back 1.8 m behind its terrace, the rear block under the rock
  side(-SAN_U, -4, 12.4, -12, -0.03); side(-4, 10.7, 12.8, -4.2, -1.83); side(-10.8, -4, 11.6, -19.6, -12); side(-4, 6.6, 11.6, -19.6, -4.2);
  face(-SAN_U, -4, -1, 12.4, 0); face(-4, 10.75, -1, 12.8, -1.8);
  bx('flat', M, -SAN_U - 0.1, -3.9, 12.15, 12.55, -12, 0.32, { c: '#e6cfb0', noao: true });
  // church: pilasters, capitals and the two cornices
  for (const [u0, u1] of [[-3.98, -3.5], [-0.35, 0.3], [7.75, 8.3]]) { bx('flat', M, u0, u1, 1.4, 12.4, -1.85, -1.6, { c: WH }); for (const y of [7.55, 11.8]) bx('flat', M, u0 - 0.14, u1 + 0.14, y, y + 0.45, -1.85, -1.5, { c: WH, noao: true }); }
  bx('flat', M, -4.05, 10.75, 8.05, 8.5, -1.9, -1.35, { c: WH, noao: true }); bx('flat', M, -4.1, 10.8, 12.35, 12.8, -4.25, -1.25, { c: WH, noao: true });
  // convent balcony and the church's stone balcony in the tower bay
  bx('flat', M, -10.3, -4.7, 5.0, 5.16, -0.05, 0.6, { c: '#cfc6b2', noao: true }); rail(mul(M, tr(-7.5, 5.16, 0.57)), 5.6, 0.95);
  bx('flat', M, -3.4, -0.5, 5.15, 5.4, -1.85, -1.0, { c: WH, noao: true }); balus(mul(M, tr(-1.95, 5.4, -1.06)), 2.9, 0.9);
  // portal: columns, entablature, pediment, door recess
  for (const u of [2.35, 5.65]) { cyl('flat', 0.2, 0.25, 3.45, 8, { M: mul(M, tr(u, 1.65, -1.45)), c: MB }); bx('flat', M, u - 0.36, u + 0.36, 1.4, 1.65, -1.82, -1.1, { c: WH }); bx('flat', M, u - 0.34, u + 0.34, 5.05, 5.25, -1.82, -1.1, { c: WH, noao: true }); }
  bx('flat', M, 1.85, 6.15, 5.22, 5.55, -1.85, -1.12, { c: WH, noao: true });
  const ped = (u, y, wd, hh, v, d) => { const s = new THREE.Shape(); s.moveTo(-wd / 2, 0); s.lineTo(wd / 2, 0); s.lineTo(0, hh); s.lineTo(-wd / 2, 0); extrude('flat', s, d, { M: mul(M, tr(u, y, v)), c: MB, noao: true }); };
  ped(4, 6.95, 2.6, 0.75, -1.82, 0.28);
  extrude('flat', archShape(1.85, 3.4), 0.04, { M: mul(M, tr(4, 1.4, -1.79)), c: '#33241a', noao: true });
  // the niche with the saint over the portal, and the cross on the cornice
  for (const u of [2.8, 5.2]) bx('flat', M, u - 0.22, u + 0.22, 8.5, 11.35, -1.84, -1.5, { c: MB });
  bx('flat', M, 2.45, 5.55, 11.35, 11.65, -1.84, -1.4, { c: MB, noao: true }); ped(4, 11.65, 2.5, 0.55, -1.82, 0.3);
  extrude('flat', archShape(1.5, 2.45), 0.03, { M: mul(M, tr(4, 8.75, -1.79)), c: '#5d564c', noao: true });
  bx('flat', M, 3.3, 4.7, 8.5, 8.9, -1.84, -1.35, { c: MB }); statue('flat', mul(M, tr(4, 8.9, -1.55)), 1.8, { c: MB, noao: true });
  bx('flat', M, 3.93, 4.07, 12.8, 14.1, -1.65, -1.5, { c: MB, noao: true }); bx('flat', M, 3.55, 4.45, 13.55, 13.7, -1.65, -1.5, { c: MB, noao: true });
  // clock and bell gable: the shaft with its curved top, cornices, little bell frame
  { const s = new THREE.Shape(); s.moveTo(-4, 12.8); s.lineTo(0.3, 12.8); s.lineTo(0.3, 17.0); s.quadraticCurveTo(-0.55, 17.05, -0.65, 17.9); s.quadraticCurveTo(-1.0, 18.7, -1.85, 18.75); s.quadraticCurveTo(-2.7, 18.7, -3.05, 17.9); s.quadraticCurveTo(-3.15, 17.05, -4, 17.0); s.lineTo(-4, 12.8);
    extrude('sanFront', s, 1.2, { M: mul(M, tr(0, 0, -3.0)), uv: 'keep', uvk: [1 / (2 * SAN_U), 1 / (SAN_HI - SAN_LO)], uvo: [0.5, -SAN_LO / (SAN_HI - SAN_LO)], noao: true }); }
  bx('flat', M, -4.15, 0.45, 15.25, 15.55, -3.1, -1.65, { c: WH, noao: true }); bx('flat', M, -4.1, 0.4, 16.95, 17.2, -3.05, -1.7, { c: WH, noao: true });
  for (const u of [-2.3, -1.4]) bx('flat', M, u - 0.04, u + 0.04, 18.4, 19.6, -2.45, -2.37, { c: '#2c2a28', noao: true });
  bx('flat', M, -2.34, -1.36, 19.55, 19.63, -2.45, -2.37, { c: '#2c2a28', noao: true }); cone('flat', 0.25, 0.5, 6, { M: mul(M, tr(-1.85, 18.9, -2.41)), c: '#4a3f2a', noao: true });
  // the terrace before the portal: five steps up between two runs of balustrade, with potted palms
  bx('flat', M, 0.2, 10.75, low, 1.4, -1.84, -1.15, { c: ST });
  bx('flat', M, 0.2, 2.4, low, 1.4, -1.15, -0.08, { c: ST }); bx('flat', M, 5.6, 10.75, low, 1.4, -1.15, -0.08, { c: ST });
  for (let i = 0; i < 5; i++) bx('flat', M, 2.4, 5.6, low, 1.4 - (i + 1) * 0.26, -1.15 + i * 0.21, -1.15 + (i + 1) * 0.21, { c: i % 2 ? '#7d7565' : '#a69c89', noao: true });
  for (const [a, b] of [[0.25, 2.35], [5.65, 8.4]]) balus(mul(M, tr((a + b) / 2, 1.4, -0.14)), b - a, 0.95);
  for (const u of [-3.2, -0.6, 1.2, 6.8]) { const t = u > 0 ? 1.4 : 0, v = u > 0 ? -0.75 : -0.9; cyl('flat', 0.28, 0.2, 0.45, 7, { M: mul(M, tr(u, t, v)), c: '#a85e40' }); for (let a = 0; a < 3; a++) panel('palm', 1.5, 1.0, { M: mul(M, tr(u, t + 0.35, v)), ry: a * PI / 3, noao: true }); }
  // the rock
  sanCliff(M, y0);
  return end('Santuario di Santa Rosalia');
}
export const SANTUARIO = { name: 'Santuario di Santa Rosalia', x: -825, z: -5780, radius: 60, skipIds: [FP.santuario.id, 'x25070'], build: buildSantuario,
  walls: [[-837.0, -5774.1, -837.9, -5770.6]] };   // the foot of the rock between the two mapped footprints (their own walls stay)
