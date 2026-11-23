// City landmark: the Chiesa di San Domenico (Piazza San Domenico, the Pantheon of the illustrious Palermitans). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49754802 (a stepped lidar outline, which left the church a blank brown block with slit windows).
// Frame F: origin on the ground at the middle between the two tower axes, +z out of the front (west-south-west, onto the piazza), +x towards the south-south-east (to the right seen from the piazza).
// Measured from the footprint and the lidar parts (the two towers stand at the ends of a front about 39 m wide; the nave runs 66 m back from it).
// Read from Wikimedia Commons photos: "Chiesa di San Domenico-Palermo.JPG" (front through the column, towers), "Palermo-San-Domenico-bjs2007-01.jpg" (whole front and both towers), "San domenico.JPG" (close front, columns, windows).
// ("Facciata della chiesa di San Domenico.jpg" turned out to be another church, in Modena, and was not used.)
// From those: a baroque front of cream plaster panels framed in golden ochre limestone, in two orders; lower order with a big central portal (green door, cartouche above) and a smaller green door each side with a small window over it,
// pairs of free-standing grey marble columns each side of the portal and at the outer ends; upper order with a round-headed window in a frame between pairs of grey columns, a niche with a white statue in each side bay, a balustrade over each side wing;
// above the middle a curved crown with a niche and statue, a cross on top; two towers at the ends of the front, ochre with cream panels, a sundial on the shaft, a belfry arch with a bell, a lantern, then a small cream bulb dome with a ball finial.
// NO main dome: the roof is a plain gable (tiles) behind the front. Not known and not drawn: the carved inscriptions and reliefs, the exact statues (a white silhouette stands for each), the clock faces, the tile colour.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

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
const FW = 25.2, FH = 24.4, FZ = 5.5, TX = 16.1, TW = 7.0, TH = 27.0, EAVE = 14.5, NAVE_TOP = 20.6, NW = 10.0, NZ0 = -66, NZ1 = 3.6;
const OCH = '#d3a65e', OCHD = '#b78a47', CREAM = '#f1ead9', GREY = '#a9aaa7', GREEN = '#2f6a47', DARKGLASS = '#262f3a', WHITE = '#f4efe3';
const WING = 17.3, UPPER = 20.7, TOPY = 24.3;   // wing top (with balustrade), upper entablature top, crown top
const COLS_LO = [-6.6, -3.8, 3.8, 6.6], COLS_UP = [-5.8, -3.4, 3.4, 5.8];

function statueP(g, X, Y, sx, sy, x, y0, h) {   // a white stone figure standing on y0, h tall
  g.fillStyle = WHITE; g.beginPath(); g.ellipse(X(x), Y(y0 + h * 0.4), 0.38 * sx, h * 0.4 * sy, 0, 0, 2 * PI); g.fill();
  g.beginPath(); g.arc(X(x), Y(y0 + h * 0.88), 0.2 * sx, 0, 2 * PI); g.fill(); g.fillRect(X(x - 0.28), Y(y0 + 0.22), 0.56 * sx, 0.22 * sy);
  g.fillStyle = 'rgba(60,45,30,0.25)'; g.fillRect(X(x + 0.1), Y(y0 + h * 0.75), 0.25 * sx, h * 0.75 * sy);
}
function paintFront(g, w, h) {   // 25.2 m wide, 24.4 m tall from the ground
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const cart = (x, y, rx, ry) => { g.fillStyle = '#d9d3c4'; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); g.strokeStyle = 'rgba(70,55,40,0.5)'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(70,55,40,0.3)'; g.beginPath(); g.ellipse(X(x), Y(y), rx * 0.55 * sx, ry * 0.5 * sy, 0, 0, 2 * PI); g.fill(); };
  g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 80, 2, 4101, ['rgba(150,110,70,0.06)', 'rgba(255,255,245,0.08)']);
  R(-FW / 2, 0, FW / 2, 0.9, OCHD);                                                                // plinth
  R(-FW / 2, 8.5, FW / 2, 9.6, OCH); R(-FW / 2, 8.5, FW / 2, 8.62, 'rgba(60,40,20,0.35)');           // the lower entablature
  for (const sg of [-1, 1]) R(sg * 11.6, 0.9, sg * 12.6, WING, OCH);                                // the corner strips against the towers
  for (const x of COLS_LO) R(x - 0.62, 0.9, x + 0.62, 8.5, OCH);                                    // ochre pilasters behind the lower columns
  for (const x of COLS_UP) R(x - 0.55, 9.6, x + 0.55, 19.6, OCH);
  for (const sg of [-1, 1]) R(sg * 9.0, 9.6, sg * 9.7, UPPER, OCH);                                 // the edge of the middle bay
  // lower order: the central portal (green door, ochre frame, cartouche), a smaller door with a small window over it each side
  R(-2.5, 0.9, 2.5, 7.4, OCH); R(-1.9, 0.9, 1.9, 6.3, GREEN); R(-0.04, 0.9, 0.04, 6.3, '#1d4630'); R(-1.9, 4.1, 1.9, 4.16, '#1d4630'); cart(0, 7.8, 1.2, 0.55);
  for (const sg of [-1, 1]) {
    const x = sg * 9.7; R(x - 1.2, 0.9, x + 1.2, 5.2, OCH); R(x - 0.85, 0.9, x + 0.85, 4.6, GREEN); R(x - 0.04, 0.9, x + 0.04, 4.6, '#1d4630');
    R(x - 0.9, 5.7, x + 0.9, 7.3, OCH); R(x - 0.65, 5.95, x + 0.65, 7.05, '#3a352e'); R(x - 0.02, 5.95, x + 0.02, 7.05, '#8a8270'); R(x - 0.65, 6.5, x + 0.65, 6.54, '#8a8270');
  }
  // upper order: a round-headed window in a frame, a cartouche over it, a niche with a white statue each side, a balustrade over each wing
  arch(0, 12.0, 18.3, 3.8, OCH); arch(0, 12.6, 17.8, 2.6, DARKGLASS); R(-0.04, 12.6, 0.04, 16.4, '#8a8270'); R(-0.7, 14.4, 0.7, 14.48, '#8a8270'); cart(0, 19.0, 1.0, 0.4);
  for (const sg of [-1, 1]) {
    const x = sg * 10.6; arch(x, 11.0, 15.6, 2.4, OCH); arch(x, 11.5, 15.3, 1.7, '#ddd3bb'); statueP(g, X, Y, sx, sy, x, 11.6, 3.3);
    statueP(g, X, Y, sx, sy, sg * 12.0, 12.2, 3.3); R(sg * 12.0 - 0.45, 10.6, sg * 12.0 + 0.45, 12.2, OCHD);
    const x0 = sg > 0 ? 9.7 : -11.6, x1 = sg > 0 ? 11.6 : -9.7;
    R(x0, 16.3, x1, WING, '#8d6b3c'); for (let x = x0 + 0.05; x < x1 - 0.1; x += 0.42) R(x, 16.45, x + 0.2, 17.1, '#ece5d2'); R(x0, 16.25, x1, 16.45, '#ece5d2'); R(x0, 17.05, x1, WING, '#ece5d2');
  }
  R(-9.8, 19.6, 9.8, UPPER, OCH); R(-9.8, 19.6, 9.8, 19.72, 'rgba(60,40,20,0.35)');
  // the crown: an ochre curved outline round a cream field with a niche and a white statue
  g.strokeStyle = OCH; g.lineWidth = 0.7 * sx; g.beginPath(); g.moveTo(X(-9.4), Y(UPPER)); g.bezierCurveTo(X(-8.8), Y(21.6), X(-6.4), Y(23.4), X(0), Y(24.0)); g.bezierCurveTo(X(6.4), Y(23.4), X(8.8), Y(21.6), X(9.4), Y(UPPER)); g.stroke();
  arch(0, 21.2, 23.4, 2.2, OCH); arch(0, 21.5, 23.2, 1.5, '#ddd3bb'); statueP(g, X, Y, sx, sy, 0, 21.6, 1.5);
  for (const y of [8.5, 19.6]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.6)); gs.addColorStop(0, 'rgba(30,22,14,0.28)'); gs.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.6 * sy); }
  streaks(g, w, h, 30, 4102, 0.07, 110, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintTower(g, w, h) {   // one face of a tower: 7 m wide, 27 m tall
  const sx = w / TW, sy = h / TH, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = OCH; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 90, 2, 4111, ['rgba(120,80,40,0.08)', 'rgba(255,240,200,0.08)']);
  R(0, 0, TW, 0.9, OCHD);
  // lower order: a cream panel between the ochre edges, a small window
  R(0.7, 1.4, TW - 0.7, 8.0, CREAM); R(2.6, 4.6, 4.4, 6.6, OCH); R(2.8, 4.8, 4.2, 6.4, '#3a352e'); R(3.45, 4.8, 3.55, 6.4, '#8a8270');
  R(0, 8.5, TW, 9.6, OCH); R(0, 8.5, TW, 8.62, 'rgba(60,40,20,0.35)');
  // the shaft: a cream panel, a sundial disc, a small niche
  R(0.9, 10.4, TW - 0.9, 18.2, CREAM); R(2.9, 10.8, 4.1, 12.4, OCH); R(3.05, 10.95, 3.95, 12.25, '#3a352e');
  g.fillStyle = '#e6dcc0'; g.beginPath(); g.arc(X(3.5), Y(15.4), 1.2 * sx, 0, 2 * PI); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.1 * sx; g.beginPath(); g.arc(X(3.5), Y(15.4), 1.2 * sx, 0, 2 * PI); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(3.5 + Math.cos(a) * 0.55), Y(15.4 + Math.sin(a) * 0.55)); g.lineTo(X(3.5 + Math.cos(a) * 1.05), Y(15.4 + Math.sin(a) * 1.05)); g.stroke(); }
  R(0, 19.0, TW, 19.8, OCH); R(0, 19.0, TW, 19.12, 'rgba(60,40,20,0.35)');
  // the belfry: an ochre pier each side, a big round-headed opening with a bell
  R(0.5, 19.8, 1.2, 25.4, OCHD); R(TW - 1.2, 19.8, TW - 0.5, 25.4, OCHD);
  arch(3.5, 19.8, 25.4, 3.4, CREAM); arch(3.5, 19.8, 25.0, 2.6, '#14100c'); g.fillStyle = '#7d6236'; g.beginPath(); g.arc(X(3.5), Y(22.4), 0.55 * sx, PI, 0); g.lineTo(X(4.1), Y(21.6)); g.lineTo(X(2.9), Y(21.6)); g.fill();
  R(0, 25.6, TW, TH, OCH); R(0, 25.6, TW, 25.72, 'rgba(60,40,20,0.35)'); for (let x = 0.3; x < TW; x += 0.5) R(x, 25.8, x + 0.22, 26.8, '#ece5d2');
  streaks(g, w, h, 14, 4112, 0.08, 120, '55,48,40');
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

function buildSanDomenico() {
  initShared();
  const pts = pairsOf(SD.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-12, FZ + 1)), groundY(...W(12, FZ + 1)), groundY(...W(0, FZ + 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('sdFront', 512, 512, [FW, FH], paintFront);
  defMat('sdTower', 192, 704, [TW, TH], paintTower);
  defMat('sdBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 4121));
  defMat('sdNave', 128, 256, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 4131));
  begin(y0);
  // the body: the whole OSM footprint up to the aisle eaves (chapels and aisles), a flat roof over it
  const body = clipFront(pts, FZ - 0.1);   // (not in front of the front: the OSM outline steps out up to 2 m past it)
  prism('sdBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
  // the nave on top of it, under a gable roof of tiles; the ridge (26.4 m) stays under the crest (27.6 m) of the front
  bx('sdNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  gable('tile', 'sdNave', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ1 - NZ0, NAVE_TOP, 3.2, { ov: 0.4, c: '#b8744f', wc: '#d2b078' });
  // the front: one shape (the two wings, the raised middle with a curved crown) with the painted front on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, WING); s.lineTo(9.6, WING); s.lineTo(9.6, UPPER); s.bezierCurveTo(9.0, 21.6, 6.5, 23.6, 0, TOPY); s.bezierCurveTo(-6.5, 23.6, -9.0, 21.6, -9.6, UPPER); s.lineTo(-9.6, WING); s.lineTo(-hw, WING); s.lineTo(-hw, 0);
  extrude('sdFront', s, 1.6, { M: at(0, 0, FZ - 1.6), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // cornices that stand out of the front, a cross on the crown
  bx('flat', F, -hw - 0.3, hw + 0.3, 8.5, 9.6, FZ - 0.1, FZ + 0.5, { c: OCH, noao: true });
  bx('flat', F, -9.9, 9.9, 19.6, UPPER, FZ - 0.1, FZ + 0.5, { c: OCH, noao: true });
  bx('flat', F, -0.1, 0.1, TOPY, TOPY + 1.9, FZ - 0.9, FZ - 0.7, { c: '#3e3a36', noao: true }); bx('flat', F, -0.5, 0.5, TOPY + 1.1, TOPY + 1.3, FZ - 0.9, FZ - 0.7, { c: '#3e3a36', noao: true });
  // the free-standing grey columns: two pairs round the portal and a pair at each tower, two pairs round the upper window
  const col = (x, y0, y1, r) => {
    bx('flat', F, x - r * 1.5, x + r * 1.5, y0, y0 + 0.3, FZ + 0.15, FZ + 0.15 + r * 3, { c: OCH, noao: true });
    cyl('flat', r, r * 1.08, y1 - y0 - 0.6, 10, { M: at(x, y0 + 0.3, FZ + 0.15 + r * 1.5), c: GREY, noao: true });
    bx('flat', F, x - r * 1.5, x + r * 1.5, y1 - 0.3, y1, FZ + 0.15, FZ + 0.15 + r * 3, { c: OCH, noao: true });
  };
  for (const x of [...COLS_LO, -TX - 1.4, -TX + 1.4, TX - 1.4, TX + 1.4]) col(x, 0.9, 8.5, 0.42);
  for (const x of COLS_UP) col(x, 9.6, 19.6, 0.37);
  for (let i = 0; i < 3; i++) bx('stone', F, -5.2 - i * 0.2, 5.2 + i * 0.2, -0.3, 0.18 * (3 - i), FZ + 0.6, FZ + 0.6 + 0.35 * (i + 1), { c: '#d8cfb8' });
  // the two bell towers: four painted faces round a core, cornices between the stages, a lantern, a cream bulb dome, a ball and a cross
  for (const tx of [-TX, TX]) {
    const T = at(tx, 0, FZ - TW / 2 + 0.05);
    for (const a of [0, PI / 2, PI, -PI / 2]) panel('sdTower', TW, TH, { M: mul(mul(T, rotY(a)), tr(0, 0, TW / 2 + 0.02)) });
    bx('flat', T, -TW / 2 + 0.1, TW / 2 - 0.1, 0, TH, -TW / 2 + 0.1, TW / 2 - 0.1, { c: OCH, noao: true });
    for (const [ya, yb, o] of [[9.1, 9.8, 0.3], [18.9, 19.6, 0.3], [TH - 1.4, TH - 0.8, 0.32]]) bx('flat', T, -TW / 2 - o, TW / 2 + o, ya, yb, -TW / 2 - o, TW / 2 + o, { c: OCH });
    bx('flat', T, -TW / 2 - 0.1, TW / 2 + 0.1, TH - 0.8, TH, -TW / 2 - 0.1, TW / 2 + 0.1, { c: OCHD });
    bx('flat', T, -2.0, 2.0, TH, TH + 2.6, -2.0, 2.0, { c: CREAM, noao: true });
    for (const [px, pz, wx, wz] of [[0, 1, 1.0, 0.04], [0, -1, 1.0, 0.04], [1, 0, 0.04, 1.0], [-1, 0, 0.04, 1.0]]) bx('flat', T, px * 2.0 - wx / 2 + (px ? 0 : 0), px * 2.0 + wx / 2 + (px ? 0 : 0), TH + 0.5, TH + 2.1, pz * 2.0 - wz / 2, pz * 2.0 + wz / 2, { c: '#1c1814', noao: true });
    bx('flat', T, -2.4, 2.4, TH + 2.6, TH + 2.9, -2.4, 2.4, { c: OCH });
    lathe('flat', [[0, 0], [2.2, 0], [2.4, 0.4], [2.1, 1.2], [1.4, 2.0], [0.7, 2.6], [0.28, 3.1], [0.12, 3.4], [0, 3.5]], 10, { M: mul(T, tr(0, TH + 2.9, 0)), c: '#ece2c8', noao: true });
    sphere('flat', 0.3, { M: mul(T, tr(0, TH + 6.6, 0)), seg: 6, c: '#c9a05a' });
    bx('flat', T, -0.07, 0.07, TH + 6.8, TH + 7.8, -0.07, 0.07, { c: '#3e3a36', noao: true }); bx('flat', T, -0.35, 0.35, TH + 7.2, TH + 7.34, -0.07, 0.07, { c: '#3e3a36', noao: true });
  }
  const o = end('Chiesa di San Domenico');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SD.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_TOP + 3.2], [ring(-TX - TW / 2, -TX + TW / 2, FZ - TW, FZ), null, y0 + TH + 7], [ring(TX - TW / 2, TX + TW / 2, FZ - TW, FZ), null, y0 + TH + 7]];
  return o;
}
export const SAN_DOMENICO = { name: 'Chiesa di San Domenico', x: 190, z: -380, radius: 80, skipIds: [SD.id], build: buildSanDomenico };
