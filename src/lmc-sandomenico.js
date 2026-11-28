// City landmark: the Chiesa di San Domenico (Piazza San Domenico, the Pantheon of the illustrious Palermitans). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49754802 (a stepped lidar outline, which left the church a blank brown block with slit windows).
// Frame F: origin on the ground at the middle between the two tower axes, +z out of the front (west-south-west, onto the piazza), +x towards the south-south-east (to the right seen from the piazza).
// Measured from the footprint and the lidar parts (the two towers stand at the ends of a front about 39 m wide; the nave runs 66 m back from it; the roof stands about 31 m above the lidar ground).
// Read from Wikimedia Commons photos: "San Domenico (Palermo) 21 06 2026 01.jpg", "... 02.jpg", "... 04.jpg" (the whole front), "... 06.jpg", "... 08.jpg", "Chiesa di San Domenico-Palermo.JPG",
// "Palermo-San-Domenico-bjs2007-01.jpg" (front, towers, the column), "San domenico.JPG". ("Facciata della chiesa di San Domenico.jpg" turned out to be another church, in Modena, and was not used.)
// From those: a baroque front as wide as both towers, white plaster panels framed in a grey ochre stone, in two orders; free-standing grey marble columns in pairs below, at the middle and under the towers,
// and in two pairs round the upper window, each pair under its own forward piece of the entablature; a big green door under a white relief, a smaller door with a grated window over it in each side bay; upper
// niches with white statues, statues on pedestals in front of the towers, a balustrade each side of a tall crown with two shoulders, a niche with a statue and a broken curved pediment under an iron cross;
// the two towers above it: a stage with a sundial, a bell arch, a cornice with finials, a smaller stage, a bulb cap of ochre and white, a green ball.
// NO main dome: the roof is a plain gable (tiles) behind the front. The column of the Immacolata in the square is drawn by src/lmc-monuments.js.
// Not verified: heights (read off the photos by eye), the carving and the statues (white silhouettes), the flanks and back, the clock faces, the tile colour.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, balus } from './lmc-kit.js';

const SD = { id: 'w49754802', p: [158.1, -369.6, 165.7, -375.2, 191.3, -393, 195.9, -396.3, 195.1, -397.4, 200.3, -401.3, 208.3, -407.1, 218.2, -393.8, 233.2, -405.4, 239.8, -406.7, 243.2, -404.4, 245.4, -400.3, 245.9, -395.8, 243.3, -391.8, 246, -387.6, 238.5, -382.8, 242.6, -377.3, 234.5, -371.7, 237.1, -368.7, 223.7, -359.9, 220, -364.4, 180.5, -336.3, 171.3, -349.9] };
const O = [175, -355], N = [-0.868, 0.496];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };   // x along the front, z out of it
function clipFront(pts, zmax) {   // the footprint cut off where it stands out in front of the front (Sutherland-Hodgman against z = zmax, keeping z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
// FW: the front's width; E1, E2: top of the lower and the upper entablature; CT: top of the crown; TX, TW: tower axes and width; UW: width of the towers above the front
const FW = 39.2, FZ = 5.5, TX = 16.15, TW = 7.0, UW = 5.9, E1 = 12.1, E2 = 23.8, CT = 32.4, TH = 33, EAVE = 17, NAVE_TOP = 25.5, RISE = 3.2, NW = 10.0, NZ0 = -66, NZ1 = 3.6;
const OCH = '#bfa57c', OCHD = '#a58c66', CREAM = '#ece7da', GREY = '#b6b8b8', GREEN = '#5c7048', DARKGLASS = '#262f3a', WHITE = '#efebe1', LEDGE = '#d3c2a0';
const PAIRS = [-18.0, -14.3, -6.6, -3.9, 3.9, 6.6, 14.3, 18.0], UPCOL = [-6.4, -3.7, 3.7, 6.4];
// the columns and the steps stand out of the footprint on the right-hand half of the front
const SD_WALLS = [[-19.9, 5.0], [-19.9, 7.35], [19.9, 7.35], [19.9, 4.4]].map(q => toWorld(q[0], q[1])).flatMap((q, i, a) => i ? [[...a[i - 1], ...q]] : []);

function paintFront(g, w, h) {   // FW m wide, TH m tall from the ground
  const sx = w / FW, sy = h / TH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const panelW = (x0, y0, x1, y1) => { R(x0 - 0.22, y0 - 0.22, x1 + 0.22, y1 + 0.22, OCHD); R(x0, y0, x1, y1, CREAM); R(x0, y1 - 0.2, x1, y1, 'rgba(80,60,35,0.22)'); };
  g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2.5, 4101, ['rgba(125,105,75,0.10)', 'rgba(255,255,248,0.12)']);
  const stone = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, OCH); R(x0, y0, x0 + 0.14, y1, 'rgba(255,246,222,0.35)'); R(x1 - 0.2, y0, x1, y1, 'rgba(70,52,30,0.28)'); for (let y = y0 + 0.9; y < y1; y += 0.9) R(x0, y, x1, y + 0.05, 'rgba(80,60,35,0.18)'); };
  for (const [y0, y1] of [[1.4, 10.1], [E1, 22.2]]) {
    // grey ochre stone behind the columns, in strips beside the wings and at the two ends
    for (const s of [-1, 1]) for (const [a, b] of [[2.7, 4.85], [5.65, 7.7], [8.0, 8.5], [12.4, 12.9], [13.3, 15.35], [17.0, FW / 2]]) stone(Math.min(s * a, s * b), y0, Math.max(s * a, s * b), y1);
  }
  R(-FW / 2, 0, FW / 2, 1.4, '#9a9285'); R(-FW / 2, E1, FW / 2, 14.7, '#c4ae88'); R(-FW / 2, 23.8, FW / 2, 24.4, OCH);
  for (const s of [-1, 1]) {
    // the white panels of the pedestal course, the crown's shoulders in stone
    for (const [x, hw] of [[2.15, 0.5], [10.45, 2.6], [16.15, 0.75]]) panelW(s * x - hw, 12.75, s * x + hw, 13.95);
    stone(Math.min(s * 4.8, s * 8.2), E2, Math.max(s * 4.8, s * 8.2), 28.4);
    panelW(s * 6.4 - 0.85, 24.5, s * 6.4 + 0.85, 27.2); R(s * 6.4 - 0.18, 24.7, s * 6.4 + 0.18, 26.9, WHITE); R(s * 6.4 - 0.07, 24.8, s * 6.4 + 0.07, 26.8, '#c9c1ad');
    panelW(s * 3.4 - 1.1, 24.5, s * 3.4 + 1.1, 28.6);
    // the side door under its grated window
    const x = s * 10.45; R(x - 1.55, 1.0, x + 1.55, 4.9, '#b9bab6'); R(x - 1.15, 1.0, x + 1.15, 4.5, GREEN); R(x - 0.05, 1.0, x + 0.05, 4.5, '#34432a'); for (const y of [1.3, 2.9]) for (const q of [-0.95, 0.2]) R(x + q, y, x + q + 0.75, y + 1.35, 'rgba(20,35,15,0.25)');
    R(x - 1.4, 5.9, x + 1.4, 8.1, OCHD); R(x - 1.05, 6.2, x + 1.05, 7.8, '#33302a'); for (let k = -0.8; k < 1; k += 0.35) R(x + k, 6.2, x + k + 0.06, 7.8, '#847c6c'); R(x - 1.05, 6.95, x + 1.05, 7.05, '#847c6c');
    // the wing niche with its hood
    arch(x, 14.9, 20.0, 3.1, LEDGE); arch(x, 15.3, 19.4, 2.2, '#8f8878'); arch(x + 0.15, 15.3, 19.1, 1.8, '#a59e8c');
    g.strokeStyle = WHITE; g.lineWidth = 0.28 * sx; g.beginPath(); g.moveTo(X(x - 1.8), Y(20.0)); g.quadraticCurveTo(X(x), Y(21.6), X(x + 1.8), Y(20.0)); g.stroke();
  }
  // the middle: the white field over the door, the door, the upper window, the niche of the crown
  R(-2.65, 0, 2.65, 7.55, '#bcbdb9'); R(-2.05, 1.0, 2.05, 6.9, GREEN); R(-0.06, 1.0, 0.06, 6.9, '#34432a'); for (const y of [1.35, 4.2]) for (const q of [-1.75, 0.3]) R(q, y, q + 1.45, y + 2.4, 'rgba(20,35,15,0.28)');
  panelW(-1.45, 12.75, 1.45, 13.95);
  arch(0, 14.7, 20.5, 3.5, LEDGE); arch(0, 15.2, 19.9, 2.5, OCHD); arch(0, 15.4, 19.6, 2.0, DARKGLASS); R(-0.05, 15.4, 0.05, 18.8, '#8a8270'); for (const y of [16.5, 17.7]) R(-1.0, y, 1.0, y + 0.08, '#8a8270'); panelW(-1.3, 20.9, 1.3, 21.7);
  R(-2.55, 24.4, 2.55, 29.9, CREAM); arch(0, 24.6, 29.6, 3.3, LEDGE); arch(0, 25.1, 29.0, 2.3, '#8f8878'); arch(0.15, 25.1, 28.7, 1.9, '#a59e8c');
  arch(0, 29.7, 31.4, 3.4, CREAM);
  // the two entablatures: a frieze, a shadow under each ledge
  for (const [y0, y1] of [[10.1, E1], [22.2, E2]]) {
    R(-FW / 2, y0, FW / 2, y1, '#cdbb98'); R(-FW / 2, y0, FW / 2, y0 + 0.2, 'rgba(70,50,28,0.4)'); R(-FW / 2, y0 + 0.65, FW / 2, y0 + 1.15, '#b39a73'); for (let x = -19.4; x < 19.5; x += 0.8) R(x, y0 + 0.7, x + 0.35, y0 + 1.1, 'rgba(60,42,24,0.3)');
    const gs = g.createLinearGradient(0, Y(y0), 0, Y(y0 - 1.6)); gs.addColorStop(0, 'rgba(40,28,14,0.34)'); gs.addColorStop(1, 'rgba(40,28,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y0), w, 1.6 * sy);
  }
  streaks(g, w, h, 40, 4102, 0.09, 110, '70,55,38');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3.5)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.5), w, 3.5 * sy);
}
function paintTower(g, w, h) {   // one face of a tower above the front: UW m wide, from E2 up 8.4 m
  const sx = w / UW, sy = h / 8.4, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const m = UW / 2;
  g.fillStyle = OCH; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, 4111, ['rgba(110,80,45,0.16)', 'rgba(255,240,205,0.14)']);
  R(0.35, 0, 0.9, 8.4, LEDGE); R(UW - 0.9, 0, UW - 0.35, 8.4, LEDGE);
  // the sundial on its white panel
  R(1.35, 0.35, UW - 1.35, 2.85, CREAM);
  g.strokeStyle = '#6f6250'; g.lineWidth = 0.06 * sx; g.beginPath(); g.arc(X(m), Y(1.6), 0.72 * sx, 0, 2 * PI); g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(m + Math.cos(a) * 0.2), Y(1.6 + Math.sin(a) * 0.2)); g.lineTo(X(m + Math.cos(a) * (i % 2 ? 0.55 : 0.95)), Y(1.6 + Math.sin(a) * (i % 2 ? 0.55 : 0.95))); g.stroke(); }
  R(0, 3.05, UW, 3.55, LEDGE); R(0, 2.9, UW, 3.05, 'rgba(60,40,20,0.35)');
  // the bell arch
  arch(m, 3.6, 7.5, 2.9, CREAM); arch(m, 3.6, 7.15, 2.15, '#15110d'); g.fillStyle = '#6f5a36'; g.beginPath(); g.arc(X(m), Y(5.6), 0.55 * sx, PI, 0); g.lineTo(X(m + 0.65), Y(4.75)); g.lineTo(X(m - 0.65), Y(4.75)); g.fill(); R(m - 1.08, 5.95, m + 1.08, 6.1, '#5a4a30');
  R(0, 7.7, UW, 8.4, LEDGE); R(0, 7.5, UW, 7.7, 'rgba(60,40,20,0.35)');
  streaks(g, w, h, 12, 4112, 0.1, 90, '55,48,40');
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay of the body or of the nave: 4.5 m wide, hm m tall, a tall arched window high up and a cornice
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.6, 1.4, '#d2b078', '#b08d56', seed, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, seed + 3, ['rgba(120,90,60,0.07)', 'rgba(255,250,235,0.06)']);
  R(0, 0.0, 0.5, hm, 'rgba(255,250,235,0.18)'); R(4.0, 0, 4.5, hm, 'rgba(60,45,30,0.14)');   // a pilaster half at each edge
  if (win) { arch(2.25, 0.6, hm - 1.0, 1.9, '#e6d3a8'); arch(2.25, 0.9, hm - 1.3, 1.3, '#16120f'); arch(2.25, 0.9, hm - 1.5, 1.1, DARKGLASS); R(2.2, 0.9, 2.3, hm - 2.4, '#d9d0b8'); }
  else { R(0, 0, 4.5, 1.1, '#b8975c'); R(0, 6.6, 4.5, 7.2, '#e2c88f'); arch(2.25, 3.0, 6.2, 1.4, '#cfb27c'); arch(2.25, 3.2, 6.0, 1.0, '#2a2420'); }
  R(0, hm - 0.7, 4.5, hm, '#e2c88f'); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '55,48,40');
}


// a white stone figure, h tall, standing on y = 0 of M: a draped body, shoulders and a head
function figureW(M, h) {
  lathe('flat', [[0.24 * h, 0], [0.17 * h, 0.35 * h], [0.2 * h, 0.62 * h], [0.06 * h, 0.76 * h]], 5, { M, c: WHITE, noao: true });
  sphere('flat', 0.1 * h, { M, p: [0, 0.84 * h, 0], seg: 5, c: WHITE, noao: true });
}

function frontRelief(F) {
  const at = (x, y, z) => mul(F, tr(x, y, FZ + z));
  const B = (x, hw, y0, y1, d, c) => bx('flat', F, x - hw, x + hw, y0, y1, FZ - 0.1, FZ + d, { c, noao: true });
  const column = (x, y0, y1, r) => {
    cyl('flat', r * 0.86, r, y1 - y0 - 0.85, 9, { M: at(x, y0, 0.95), c: GREY, open: true, noao: true });
    lathe('flat', [[r * 0.86, 0], [r * 1.45, 0.7], [r * 1.45, 0.85], [0, 0.85]], 6, { M: at(x, y1 - 0.85, 0.95), c: WHITE, noao: true });
  };
  // the entablatures: a ledge across the whole front, and over each pair of columns a piece standing forward above them
  for (const [y, d] of [[E1, 0.55], [E2, 0.65]]) B(0, FW / 2 + 0.2, y - 0.4, y + 0.05, d, LEDGE);
  for (const sg of [-1, 1]) {
    for (const [a, b] of [[3.9, 6.6], [14.3, 18.0]]) {
      for (const x of [a, b]) {
        B(sg * x, 0.78, 0, 2.0, 1.7, '#a9a292'); B(sg * x, 0.68, 2.0, 2.35, 1.6, LEDGE);
        column(sg * x, 2.35, 10.15, 0.6);
        B(sg * x, 0.9, 10.15, E1 - 0.4, 1.7, '#c6b290'); B(sg * x, 1.08, E1 - 0.4, E1 + 0.1, 2.0, LEDGE);
      }
    }
    for (const x of [3.7, 6.4]) {
      B(sg * x, 0.65, E1, 14.7, 1.4, '#c9b794'); B(sg * x, 0.42, 12.55, 14.2, 1.45, CREAM);
      column(sg * x, 14.7, 22.2, 0.45);
      B(sg * x, 0.74, 22.2, E2 - 0.4, 1.35, '#c6b290'); B(sg * x, 0.95, E2 - 0.4, E2 + 0.15, 1.7, LEDGE);
    }
    // the statues on pedestals in front of the towers, a smaller group beside the inner one
    for (const x of [14.3, 18.0]) { B(sg * x, 0.6, E1, 14.9, 1.25, '#c9b794'); sphere('flat', 0.5, { M: at(sg * x, 13.7, 1.25), ky: 1.3, kz: 0.4, seg: 5, c: WHITE, noao: true }); figureW(at(sg * x, 14.9, 0.7), 4.1); }
    sphere('flat', 0.8, { M: at(sg * 15.3, 17.6, 0.15), ky: 1.1, kz: 0.45, seg: 5, c: WHITE, noao: true });
    // the wing niche: its statue, its sill
    figureW(at(sg * 10.45, 15.55, 0.4), 3.4); B(sg * 10.45, 1.4, 14.75, 15.45, 0.6, WHITE);
    // the balustrade between the crown and the tower
    balus(at(sg * 10.55, E2, 0.1), 4.7, 1.75, { c: '#ddd0b4' });
    // the shoulders of the crown: their cornice and a scroll on each side
    B(sg * 6.45, 1.55, 27.7, 28.35, 0.85, LEDGE); B(sg * 6.45, 1.3, 28.35, 28.75, 0.6, '#c6b290');
    for (const x of [5.45, 7.35]) { B(sg * x, 0.3, E2, 27.7, 0.45, LEDGE); cyl('flat', 0.42, 0.42, 0.4, 7, { M: at(sg * x, 24.6, 0.25), rx: PI / 2, c: '#c9b794', noao: true }); }
  }
  // the broken curved pediment: two thick curved ledges that stop short of the middle, a block between them with the iron cross
  for (const sg of [-1, 1]) {
    const q = new THREE.Shape(); q.moveTo(sg * 5.5, 28.5); q.quadraticCurveTo(sg * 5.0, 31.6, sg * 1.1, 32.55); q.lineTo(sg * 1.0, 31.75); q.quadraticCurveTo(sg * 4.1, 31.0, sg * 4.55, 28.5); q.lineTo(sg * 5.5, 28.5);
    extrude('flat', q, 2.0, { M: at(0, 0, -1.2), c: LEDGE, noao: true, cs: 5 });
    B(sg * 2.15, 0.28, 24.2, 29.7, 0.5, LEDGE);
  }
  B(0, 1.05, 31.2, 32.35, 0.55, '#c9b794'); B(0, 0.5, 32.35, 33.1, 0.3, LEDGE);
  B(0, 1.7, 29.6, 30.0, 0.65, LEDGE);
  bx('flat', F, -0.09, 0.09, 33.0, 36.4, FZ - 0.1, FZ + 0.06, { c: '#2f2c29', noao: true }); bx('flat', F, -0.9, 0.9, 35.05, 35.23, FZ - 0.1, FZ + 0.06, { c: '#2f2c29', noao: true });
  figureW(at(0, 25.55, 0.45), 3.2); B(0, 1.3, 24.9, 25.5, 0.7, WHITE);
  // the white reliefs: the great one over the door, one over the upper window, one over the crown niche
  for (const [y, r, d] of [[8.55, 1.35, 0.15], [21.0, 0.85, 0.1], [29.45, 0.6, 0.4]]) { sphere('flat', r, { M: at(0, y, d), ky: 1.05, kz: 0.32, seg: 6, c: WHITE, noao: true }); for (const sg of [-1, 1]) sphere('flat', r * 0.55, { M: at(sg * r * 0.95, y - r * 0.35, d), ky: 0.8, kz: 0.4, seg: 5, c: WHITE, noao: true }); }
  B(0, 2.85, 7.05, 7.55, 0.5, '#c9c9c4'); for (const sg of [-1, 1]) B(sg * 2.35, 0.28, 0, 7.05, 0.35, '#bdbeba');
  for (let i = 0; i < 4; i++) bx('flat', F, -2.9 - i * 0.2, 2.9 + i * 0.2, -0.4, 0.25 * (4 - i), FZ, FZ + 0.5 + 0.34 * i, { c: i % 2 ? '#a9a395' : '#bcb6a6' });
}

function towerTop(F, tx) {
  const T = mul(F, tr(tx, E2, FZ - UW / 2 - 0.25));
  for (const a of [0, PI / 2, PI, -PI / 2]) panel('sdTower', UW, 8.4, { M: mul(mul(T, rotY(a)), tr(0, 0, UW / 2)) });
  const slab = (y0, y1, o, c) => bx('flat', T, -UW / 2 - o, UW / 2 + o, y0, y1, -UW / 2 - o, UW / 2 + o, { c, noao: true });
  slab(3.1, 3.5, 0.25, LEDGE); slab(7.75, 8.4, 0.5, LEDGE); slab(8.4, 8.7, 0.15, OCHD);
  const urn = (x, y, z, k) => lathe('flat', [[0.14 * k, 0], [0.36 * k, 0.45 * k], [0.1 * k, 0.8 * k], [0, 1.45 * k]], 5, { M: mul(T, tr(x, y, z)), c: WHITE, noao: true });
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    urn(a * 2.75, 8.7, b * 2.75, 1.15);
    cyl('flat', 0.22, 0.26, 4.0, 5, { M: mul(T, tr(a * (UW / 2 + 0.05), 3.5, b * (UW / 2 + 0.05))), c: LEDGE, open: true, noao: true });
  }
  // the smaller eight sided stage with its openings, the bulb cap, the green ball and the vane
  cyl('flat', 1.9, 2.05, 2.7, 8, { M: mul(T, mul(tr(0, 8.7, 0), rotY(PI / 8))), c: '#d9ccb0', open: true, noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(T, mul(rotY(k * PI / 2), tr(0, 9.1, 1.88))); const o = new THREE.Shape(); o.moveTo(-0.45, 0); o.lineTo(0.45, 0); o.lineTo(0.45, 1.2); o.absarc(0, 1.2, 0.45, 0, PI, false); o.lineTo(-0.45, 0); extrude('flat', o, 0.08, { M, c: '#1d1813', noao: true, cs: 3 }); }
  cyl('flat', 2.3, 2.15, 0.4, 8, { M: mul(T, mul(tr(0, 11.4, 0), rotY(PI / 8))), c: LEDGE, noao: true });
  lathe('flat', [[1.75, 0], [1.98, 0.6], [1.7, 1.35], [0.95, 2.0], [0.5, 2.5]], 8, { M: mul(T, tr(0, 11.8, 0)), c: '#cfae6c', noao: true });
  for (let k = 0; k < 4; k++) sphere('flat', 0.55, { M: mul(T, mul(rotY(k * PI / 2), tr(0, 12.75, 1.72))), ky: 0.9, kz: 0.35, seg: 5, c: WHITE, noao: true });
  lathe('flat', [[0.5, 0], [0.68, 0.25], [0.28, 0.65], [0.2, 1.1], [0, 1.2]], 8, { M: mul(T, tr(0, 14.3, 0)), c: WHITE, noao: true });
  sphere('flat', 0.42, { M: mul(T, tr(0, 15.8, 0)), seg: 6, c: '#4f7a5c', noao: true });
  bx('flat', T, -0.06, 0.06, 16.1, 17.3, -0.06, 0.06, { c: '#2f2c29', noao: true }); bx('flat', T, -0.34, 0.34, 16.75, 16.87, -0.06, 0.06, { c: '#2f2c29', noao: true });
}

function buildSanDomenico() {
  initShared();
  const pts = pairsOf(SD.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-12, FZ + 1)), groundY(...W(12, FZ + 1)), groundY(...W(0, FZ + 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('sdFront', 512, 448, [FW, TH], paintFront);
  defMat('sdTower', 128, 192, [UW, 8.4], paintTower);
  defMat('sdBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 4121));
  defMat('sdNave', 128, 256, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 4131));
  begin(y0);
  // the body: the whole OSM footprint up to the aisle eaves (chapels and aisles), a flat roof over it
  const body = clipFront(pts, FZ - 0.1);   // (not in front of the front: the OSM outline steps out up to 2 m past it)
  prism('sdBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
  // the nave on top of it, under a gable roof of tiles; the ridge stays under the crown of the front
  bx('sdNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  gable('tile', 'sdNave', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ1 - NZ0, NAVE_TOP, RISE, { ov: 0.4, c: '#b8744f', wc: '#d2b078' });
  // the front: one shape (the two orders from tower to tower, the shouldered crown over the middle) with the painted front on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, E2); s.lineTo(8.1, E2); s.lineTo(7.7, 28.0); s.lineTo(5.2, 28.4); s.bezierCurveTo(4.8, 30.8, 2.8, 31.9, 0, 32.2);
  s.bezierCurveTo(-2.8, 31.9, -4.8, 30.8, -5.2, 28.4); s.lineTo(-7.7, 28.0); s.lineTo(-8.1, E2); s.lineTo(-hw, E2); s.lineTo(-hw, 0);
  extrude('sdFront', s, 1.6, { M: at(0, 0, FZ - 1.6), uv: 'keep', uvk: [1 / FW, 1 / TH], uvo: [0.5, 0], cs: 6, noao: true });
  frontRelief(F);
  // the bases of the towers behind the front, their cornices carried round the sides, and the towers above it
  for (const sg of [-1, 1]) {
    const T = at(sg * TX, 0, FZ - TW / 2 - 0.1), half = FW / 2 - TX - 0.02;
    bx('flat', T, -half, half, 0, E2 - 0.05, -TW / 2, TW / 2 - 1.2, { c: OCH });
    for (const y of [E1, E2]) bx('flat', T, -half - 0.35, half + 0.35, y - 0.4, y, -TW / 2 - 0.35, TW / 2 - 1.2, { c: LEDGE, noao: true });
    towerTop(F, sg * TX);
  }
  const o = end('Chiesa di San Domenico');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SD.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_TOP + RISE], [ring(-FW / 2, FW / 2, FZ - TW, FZ), null, y0 + E2],
    [ring(-8.1, 8.1, FZ - 1.6, FZ), null, y0 + 32.5], [ring(-TX - UW / 2, -TX + UW / 2, FZ - TW, FZ), null, y0 + E2 + 16], [ring(TX - UW / 2, TX + UW / 2, FZ - TW, FZ), null, y0 + E2 + 16]];
  return o;
}
export const SAN_DOMENICO = { name: 'Chiesa di San Domenico', x: 190, z: -380, radius: 80, skipIds: [SD.id], build: buildSanDomenico, walls: SD_WALLS };
