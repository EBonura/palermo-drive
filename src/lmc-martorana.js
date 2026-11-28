// City landmark: Santa Maria dell'Ammiraglio, "La Martorana" (Piazza Bellini, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w86870886: the concave baroque front across the western block, the Norman bell tower behind it to the west, and the Norman body with its small dome to the east.
// Frame F: origin on the ground in the middle of the north edge of the western block of the footprint, +z out of the front (north, onto Piazza Bellini), local +x to the right seen from the piazza (west).
// Placed from the footprint and the Regione Siciliana orthophoto: the front spans the 13.2 m north edge of the western block; the tower stands on the square that sticks out of that block to the west,
// about 8 to 13 m back from the front line; the Norman body runs 23 m to the east, set back 3.6 m, the dome over its western half.
// Reference photos (Wikimedia Commons, looked at, nothing copied): "Facade - La Martorana - Palermo - Italy 2015.JPG", Palermo-Martorana-bjs.jpg, "1143 wurde die Kirche Santa Maria dell Ammiraglio in
// Palermo erbaut. 01.jpg" (front, tower, north wall and dome from the piazza), "San Cataldo & Chiesa della Martorana (Palermo) 01.jpg" (from above: roofs, dome), "Palermo, Chiesa della Martorana,
// campanile.jpg" (the tower close), "Palermo, Chiesa della Martorana, esterno.jpg" (the east end).
// Read from them: a concave front of golden stone, corner piers with paired pilasters and big scrolls, a grey marble portal with paired columns, a cartouche and a broken curved pediment, a grey marble
// aedicule with a window, a pediment and a cross between two windows, a cornice that rises to the corners; a bell tower with pointed arches at its foot, an inlaid band, a stage with striped archivolts round
// a two-light window, and two stages of arches on colonnettes with round corner turrets; the Norman wall with tall stepped blind arches round small windows; an eight sided drum with a red dome.
// Not verified and not drawn: the carving and mosaic inlay beyond a pattern, the south side, the east end beyond a plain wall and its low roof, the terrace wall and railing in front (the map's own).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, pyramid, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, archShape } from './lmc-kit.js';
const MA = { id: 'w86870886', p: [126.3, 99.3, 139.4, 98, 139.8, 101.6, 156.4, 99.9, 156.7, 102.4, 162.8, 101.8, 163.6, 109.5, 157.4, 110.1, 157.7, 113, 141, 114.7, 141.3, 117.3, 127.8, 118.6, 127.1, 111.7, 122.8, 112.1, 122.6, 109.9, 122.4, 108.2, 127.2, 107.7] };
const O = [132.85, 98.65], N = [-0.0988, -0.9951];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 13.15, FH = 12.6, TX = 9.2, TZ = -10.7, TW = 4.6, TH = 18.0, TKY = 1.07, BODY = 8.4, WEST = 10.2, BAY = 3.9;
const ARCHES = [-8.9, -12.8, -16.7, -20.6], WALLZ = -3.6;   // the blind arches of the north wall
const DARK = '#1c1610', GLASS = '#233047', STONE = '#c7a671', STONEL = '#dabd8a', MARB = '#c4c4c2';
// the front in plan: the corner piers on the footprint's edge, the middle bowed 1.2 m back; and in height: the parapet dips between the piers
const FZ = (x) => { const k = Math.min(1, Math.max(0, (4.6 - Math.abs(x)) / 2.4)); return -1.2 * Math.sin(k * PI / 2); };
const TOP = (x) => Math.abs(x) >= 4.6 ? 12.45 : 10.95 + 1.1 * Math.pow(Math.abs(x) / 4.6, 3);
const XS = [-6.55, -4.61, -4.6, -4.0, -3.3, -2.6, -2.2, 0, 2.2, 2.6, 3.3, 4.0, 4.6, 4.61, 6.55];
// collision for what stands out of the footprint: the corner piers of the front and the arches of the north wall
const MA_WALLS = [[[-6.65, 0], [-6.65, 0.48], [-4.5, 0.48], [-4.5, 0]], [[4.5, 0], [4.5, 0.48], [6.65, 0.48], [6.65, 0]], [[-6.6, WALLZ], [-6.9, WALLZ + 0.3], [-22.5, WALLZ + 0.3], [-22.8, WALLZ]]]
  .flatMap(r => r.slice(1).map((q, i) => [...toWorld(...r[i]), ...toWorld(...q)]));

function painter(g, w, h, wm, hm, x0 = 0) {   // drawing helpers in metres
  const sx = w / wm, sy = h / hm, X = x => (x - x0) * sx, Y = y => h - y * sy;
  const R = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  const arch = (x, y0, y1, ww, col, point) => {
    const r = ww / 2, ys = y1 - r * (point ? 1.25 : 1); g.fillStyle = col; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys));
    if (point) { g.quadraticCurveTo(X(x - r), Y(y1 - r * 0.25), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(y1 - r * 0.25), X(x + r), Y(ys)); } else g.arc(X(x), Y(ys), r * sx, PI, 0);
    g.lineTo(X(x + r), Y(y0)); g.fill();
  };
  return { sx, sy, X, Y, R, arch };
}
function paintFront(g, w, h) {   // 13.15 m wide, 12.6 m tall
  const { sx, sy, X, Y, R, arch } = painter(g, w, h, FW, FH, -FW / 2);
  paintAshlar(g, w, h, FW, FH, 0.5, 1.2, '#c9a46a', '#92744a', 7501, 1.1, 0.1);
  noiseDots(g, w, h, w * h / 60, 2.5, 7502, ['rgba(80,55,25,0.15)', 'rgba(255,225,170,0.12)']);
  R(-FW / 2, 0, FW / 2, 0.9, '#9c8058');
  // the pale plaster of the upper order, the two side windows with their segmental hoods
  R(-4.2, 6.4, 4.2, 10.3, '#d9c49a');
  for (const s of [-1, 1]) {
    const x = s * 3.05; R(x - 0.7, 6.35, x + 0.7, 8.75, '#cdb381'); R(x - 0.5, 6.55, x + 0.5, 8.55, GLASS);
    for (let k = -0.35; k < 0.5; k += 0.23) R(x + k, 6.55, x + k + 0.035, 8.55, '#7a6a52'); for (let y = 6.85; y < 8.5; y += 0.34) R(x - 0.5, y, x + 0.5, y + 0.035, '#7a6a52');
    g.strokeStyle = '#8a6c44'; g.lineWidth = 0.14 * sx; g.beginPath(); g.moveTo(X(x - 0.75), Y(9.0)); g.quadraticCurveTo(X(x), Y(9.65), X(x + 0.75), Y(9.0)); g.stroke();
    for (const px of [5.15, 6.1]) { R(s * px - 0.36, 0.9, s * px + 0.36, 5.6, STONEL); R(s * px - 0.36, 6.4, s * px + 0.36, 11.6, STONEL); R(s * px - 0.36, 0.9, s * px - 0.27, 5.6, 'rgba(70,45,15,0.3)'); R(s * px - 0.36, 6.4, s * px - 0.27, 11.6, 'rgba(70,45,15,0.3)'); }
    R(s * 4.3 - 0.12, 0.9, s * 4.3 + 0.12, 10.4, 'rgba(70,45,15,0.28)');
  }
  // the grey marble portal: the arched recess, the carved wooden door, the cartouche in the arch
  R(-2.75, 0, 2.75, 5.6, '#b9b9b6'); noiseDots(g, w, h, 90, 3, 7504, ['rgba(90,95,105,0.2)', 'rgba(235,235,235,0.2)']);
  arch(0, 0.3, 4.9, 2.5, '#d4d3ce'); arch(0, 0.3, 4.65, 2.15, '#8e8f8f'); R(-0.95, 0.3, 0.95, 3.55, '#c9c8c2'); R(-0.8, 0.3, 0.8, 3.4, '#4a2f1c'); R(-0.03, 0.3, 0.03, 3.4, '#24160c');
  for (const x of [-0.68, 0.12]) for (const y of [0.55, 1.5, 2.45]) { R(x, y, x + 0.56, y + 0.75, '#5d3d25'); R(x + 0.16, y + 0.2, x + 0.4, y + 0.55, '#3a2415'); }
  g.fillStyle = '#d9cfae'; g.beginPath(); g.ellipse(X(0), Y(3.95), 0.45 * sx, 0.38 * sy, 0, 0, 2 * PI); g.fill(); R(-0.8, 3.65, 0.8, 3.8, '#d9cfae');
  // the aedicule of the middle window
  R(-1.65, 6.4, 1.65, 9.15, '#bcbcb8'); R(-0.75, 6.55, 0.75, 8.75, '#dcdbd5'); R(-0.55, 6.7, 0.55, 8.55, '#1f2733');
  for (let k = -0.35; k < 0.5; k += 0.23) R(k, 6.7, k + 0.035, 8.55, '#7a6a52'); for (let y = 7.0; y < 8.5; y += 0.34) R(-0.55, y, 0.55, y + 0.035, '#7a6a52');
  // the entablatures and their shadows
  R(-FW / 2, 5.6, FW / 2, 6.4, '#d3b27c'); R(-2.75, 5.6, 2.75, 6.4, '#c9c9c5'); R(-FW / 2, 5.6, FW / 2, 5.74, 'rgba(50,30,8,0.4)');
  R(-FW / 2, 10.1, FW / 2, 10.35, 'rgba(70,45,15,0.3)');
  for (let x = -4.0; x < 4.1; x += 1.6) R(x - 0.2, 9.8, x + 0.2, 10.1, STONEL);
  const gs = g.createLinearGradient(0, Y(5.6), 0, Y(4.3)); gs.addColorStop(0, 'rgba(30,18,6,0.3)'); gs.addColorStop(1, 'rgba(30,18,6,0)'); g.fillStyle = gs; g.fillRect(0, Y(5.6), w, 1.3 * sy);
  streaks(g, w, h, 24, 7503, 0.14, 100, '60,40,18');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,22,12,0.35)'); gb.addColorStop(1, 'rgba(30,22,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintTower(g, w, h) {   // one face of the tower, 4.6 m wide, 18 m tall (the upper stages show its middle)
  const { sx, sy, X, Y, R, arch } = painter(g, w, h, TW, TH);
  const m = TW / 2, col = (x, y0, y1, wd = 0.14) => { R(x - wd / 2, y0, x + wd / 2, y1, '#e7dcc0'); R(x + wd / 2 - 0.04, y0, x + wd / 2, y1, 'rgba(60,40,15,0.4)'); R(x - wd, y1, x + wd, y1 + 0.18, '#e7dcc0'); R(x - wd * 0.8, y0, x + wd * 0.8, y0 + 0.12, '#d9c9a4'); };
  const inlay = (y0, y1) => { R(0, y0, TW, y1, '#d8c8a2'); const hh = (y1 - y0) / 2; g.fillStyle = '#5d6670'; for (let x = 0.2; x < TW; x += 0.42) { g.beginPath(); g.moveTo(X(x - 0.17), Y(y0 + hh)); g.lineTo(X(x), Y(y1 - 0.08)); g.lineTo(X(x + 0.17), Y(y0 + hh)); g.lineTo(X(x), Y(y0 + 0.08)); g.fill(); } };
  paintAshlar(g, w, h, TW, TH, 0.42, 0.95, '#bd9c6a', '#86693f', 7511, 1.1, 0.12);
  noiseDots(g, w, h, w * h / 60, 2.5, 7512, ['rgba(60,40,20,0.15)', 'rgba(230,205,160,0.13)']);
  R(0, 0, TW, 0.5, '#8c7048');
  // the foot: a pointed arch open on each face, inside a moulded one, on short columns
  arch(m, 0.2, 5.5, 3.7, '#d2b889', true); arch(m, 0.2, 5.25, 3.3, '#8d7047', true); arch(m, 0.2, 5.05, 2.95, '#cfb283', true); arch(m, 0.2, 4.6, 2.3, DARK, true);
  for (const x of [m - 1.35, m + 1.35]) col(x, 0.4, 2.9, 0.2);
  inlay(5.75, 6.4);
  // the second stage: an arch with a striped archivolt round a two light window on a colonnette, inlaid stars in the corners
  arch(m, 6.65, 10.75, 3.5, '#d9c294', true);
  for (let k = 0; k <= 14; k++) { const a = PI * k / 14, yc = 8.6; g.strokeStyle = '#7e623c'; g.lineWidth = 0.13 * sx; g.beginPath(); g.moveTo(X(m - Math.cos(a) * 1.2), Y(yc + Math.sin(a) * 1.5)); g.lineTo(X(m - Math.cos(a) * 1.68), Y(yc + Math.sin(a) * 2.05)); g.stroke(); }
  for (let y = 6.9; y < 8.7; y += 0.34) for (const s of [-1, 1]) R(m + s * 1.46 - 0.24, y, m + s * 1.46 + 0.24, y + 0.13, '#7e623c');
  arch(m, 6.65, 9.95, 2.35, '#c4a576', true); for (const x of [m - 0.52, m + 0.52]) arch(x, 6.75, 9.0, 0.82, DARK, true);
  g.fillStyle = '#e2d2ac'; g.beginPath(); g.arc(X(m), Y(9.3), 0.26 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#5d6670'; g.beginPath(); g.arc(X(m), Y(9.3), 0.14 * sx, 0, 2 * PI); g.fill();
  col(m, 6.75, 8.45, 0.18); for (const x of [m - 1.05, m + 1.05]) col(x, 6.75, 8.5, 0.14);
  for (const [x, y] of [[0.34, 10.3], [TW - 0.34, 10.3], [0.34, 9.55], [TW - 0.34, 9.55]]) { R(x - 0.17, y - 0.17, x + 0.17, y + 0.17, '#5d6670'); R(x - 0.07, y - 0.07, x + 0.07, y + 0.07, '#e2d2ac'); }
  inlay(10.9, 11.4);
  // the third stage: a wide arch over two openings, colonnettes
  arch(m, 11.5, 14.45, 2.8, '#dcc595', true); arch(m, 11.5, 14.15, 2.4, '#8d7047', true); for (const x of [m - 0.5, m + 0.5]) arch(x, 11.6, 13.65, 0.78, DARK);
  for (const x of [m - 1.55, m - 1.05, m, m + 1.05, m + 1.55]) col(x, 11.55, 13.1, 0.14);
  R(0, 14.55, TW, 15.05, '#d6bf90');
  // the fourth stage: the same, smaller, and the worn crown
  arch(m, 15.15, 17.35, 2.1, '#dcc595', true); for (const x of [m - 0.42, m + 0.42]) arch(x, 15.2, 16.75, 0.62, DARK);
  for (const x of [m - 1.35, m, m + 1.35]) col(x, 15.2, 16.35, 0.13);
  R(0, 17.5, TW, TH, '#d6bf90'); for (let x = 0.2; x < TW; x += 0.46) R(x, 17.55, x + 0.2, 17.8, '#8d7047');
  for (const y of [5.75, 10.9, 14.55, 17.5]) R(0, y - 0.22, TW, y, 'rgba(40,25,8,0.35)');
  streaks(g, w, h, 16, 7513, 0.14, 120, '50,34,18');
}
function paintWall(g, w, h) {   // a bay of the Norman body, BAY m wide: golden stone, a tall blind arch of stepped orders round a small window, a notched crest
  const { R, arch } = painter(g, w, h, BAY, BODY), m = BAY / 2;
  paintAshlar(g, w, h, BAY, BODY, 0.45, 1.0, '#bf9d68', '#8a6c43', 7521, 1.1, 0.1);
  noiseDots(g, w, h, w * h / 70, 2.5, 7522, ['rgba(60,40,20,0.14)', 'rgba(230,205,160,0.12)']);
  R(0, 0, BAY, 0.6, '#8c7048');
  arch(m, 0.6, 7.1, 3.4, '#8a6b42', true); arch(m, 0.6, 6.9, 3.1, '#d2b282', true); arch(m, 0.6, 6.55, 2.6, '#92744a', true); arch(m, 0.6, 6.35, 2.3, '#c8a774', true); arch(m, 0.6, 6.0, 1.8, '#b39160', true);
  arch(m, 3.45, 5.35, 1.15, '#e0c796'); arch(m, 3.6, 5.2, 0.8, '#2a2f36'); R(m - 0.03, 3.6, m + 0.03, 5.0, '#7a6a52'); R(m - 0.4, 4.2, m + 0.4, 4.26, '#7a6a52');
  R(0, 7.35, BAY, 7.65, '#d7bc8c'); R(0, 7.15, BAY, 7.35, 'rgba(40,25,8,0.35)'); R(0, BODY - 0.3, BAY, BODY, '#d7bc8c'); for (let x = 0.1; x < BAY; x += 0.39) R(x, BODY - 0.55, x + 0.2, BODY - 0.3, '#8a6c43');
  streaks(g, w, h, 8, 7525, 0.13, 80, '50,34,18');
}

function baroqueFront(F) {
  const pt = (x, y, o = 0) => [x, y, FZ(x) + o];
  const rows = (ya, yb, o = 0, xs = XS) => [xs.map(x => pt(x, ya(x), o)), xs.map(x => pt(x, yb(x), o))];
  const flatc = (P, c, flip) => gridMesh('flat', P, () => [0, 0], { M: F, c, noao: true, flip });
  gridMesh('maFront', rows(() => -0.8, TOP), (i, j, p) => [p[0] / FW + 0.5, p[1] / FH], { M: F, noao: true });
  // the back, the top and the two ends of the front, which stands above the roof behind it
  const back = XS.map(x => [x, TOP(x), Math.min(FZ(x) - 0.7, -1.55)]), low = XS.map(x => [x, BODY - 0.3, Math.min(FZ(x) - 0.7, -1.55)]);
  flatc([low, back], '#a98a5c', true); flatc([XS.map(x => pt(x, TOP(x))), back], STONE);
  for (const [j, flip] of [[0, true], [XS.length - 1, false]]) { const x = XS[j]; flatc([[[x, -0.8, 0], [x, -0.8, -1.55]], [[x, TOP(x), 0], [x, TOP(x), -1.55]]], '#b4925f', flip); }
  // the cornices that stand out of it: the top one following the parapet, the one between the orders (broken by the portal)
  const band = (ya, yb, o, c, xs) => { flatc(rows(ya, yb, o, xs), c); flatc([xs.map(x => pt(x, yb(x))), xs.map(x => pt(x, yb(x), o))], c, true); flatc([xs.map(x => pt(x, ya(x))), xs.map(x => pt(x, ya(x), o))], '#8f7450'); };
  band(x => TOP(x) - 0.45, x => TOP(x) + 0.02, 0.4, STONEL, XS);
  for (const sg of [-1, 1]) band(() => 5.75, () => 6.4, 0.32, STONEL, XS.filter(x => x * sg > 2.5));
  const at = (x, y, o = 0) => mul(F, tr(x, y, FZ(x) + o));
  const B = (x, hw, y0, y1, d, c) => bx('flat', at(x, 0), -hw, hw, y0, y1, -0.1, d, { c, noao: true });
  for (const sg of [-1, 1]) {
    // the corner piers: paired pilasters with capitals in both orders, the great scrolls beside the upper one
    for (const x of [5.15, 6.1]) { B(sg * x, 0.34, 0.9, 5.4, 0.26, '#cfab72'); B(sg * x, 0.42, 5.3, 5.75, 0.42, '#c29d66'); B(sg * x, 0.32, 6.4, 11.55, 0.2, '#d6b47c'); B(sg * x, 0.4, 11.4, 12.0, 0.36, '#c29d66'); }
    B(sg * 5.6, 0.98, -0.5, 0.95, 0.42, '#a98a5c');
    cyl('flat', 0.52, 0.52, 0.34, 10, { M: at(sg * 5.95, 7.05, 0.12), rx: PI / 2, c: '#d8b880', noao: true }); cyl('flat', 0.2, 0.2, 0.12, 6, { M: at(sg * 5.95, 7.05, 0.46), rx: PI / 2, c: '#8d7047', noao: true });
    cyl('flat', 0.28, 0.28, 0.3, 8, { M: at(sg * 5.35, 7.75, 0.1), rx: PI / 2, c: '#d8b880', noao: true });
    // the paired grey columns of the portal, their pedestals, the entablature over each pair and half of the broken curved pediment
    for (const x of [1.65, 2.35]) { B(sg * x, 0.3, 0, 1.15, 0.72, '#b4b4b0'); cyl('flat', 0.2, 0.24, 3.9, 8, { M: at(sg * x, 1.15, 0.38), c: MARB, open: true, noao: true }); B(sg * x, 0.3, 5.0, 5.4, 0.66, '#dcdbd5'); }
    B(sg * 2.0, 0.75, 5.4, 6.35, 0.72, '#cfcfca'); B(sg * 2.0, 0.85, 6.35, 6.55, 0.9, '#dedcd5');
    const q = new THREE.Shape(); q.moveTo(sg * 2.75, 6.55); q.quadraticCurveTo(sg * 1.8, 6.7, sg * 1.2, 7.65); q.lineTo(sg * 1.2, 7.25); q.quadraticCurveTo(sg * 1.75, 6.5, sg * 2.75, 6.3); q.lineTo(sg * 2.75, 6.55);
    extrude('flat', q, 0.4, { M: at(0, 0, 0.12), c: '#dedcd5', noao: true, cs: 3 });
    B(sg * 1.15, 0.16, 6.45, 9.1, 0.28, '#d2d1cb');
  }
  sphere('flat', 0.42, { M: at(0, 4.15, 0.05), kz: 0.5, ky: 0.9, seg: 6, c: '#d8c7a0', noao: true });
  B(0, 1.55, 9.1, 9.38, 0.5, '#dedcd5');
  const t = new THREE.Shape(); t.moveTo(-1.65, 9.38); t.lineTo(1.65, 9.38); t.lineTo(0, 10.3); t.lineTo(-1.65, 9.38); extrude('flat', t, 0.34, { M: at(0, 0), c: '#d2d1cb', noao: true });
  B(0, 0.2, 10.2, 10.5, 0.3, '#dedcd5'); B(0, 0.08, 10.5, 11.45, 0.3, '#e8e8ea'); B(0, 0.33, 10.95, 11.11, 0.3, '#e8e8ea');
}
function tower(F) {
  const T = mul(F, mul(tr(TX, 0, TZ), new THREE.Matrix4().makeScale(1, TKY, 1)));   // (the tower's heights below are for TH; it stands TKY taller)
  // four stages, the upper two a little narrower, each face the matching part of the painted tower
  for (const [y0, y1, wd, cy] of [[-0.8, 6.0, TW, 6.4], [6.0, 11.1, TW - 0.08, 11.4], [11.1, 14.75, TW - 0.7, 15.05], [14.75, TH, TW - 1.1, TH]]) {
    for (const a of [0, PI / 2, PI, -PI / 2]) panel('maTower', wd, y1 - y0, { M: mul(mul(T, rotY(a)), tr(0, y0, wd / 2)), uvk: [wd / TW, (y1 - y0) / TH], uvo: [(1 - wd / TW) / 2, y0 / TH] });
    bx('flat', T, -wd / 2 - 0.14, wd / 2 + 0.14, cy - 0.22, cy, -wd / 2 - 0.14, wd / 2 + 0.14, { c: '#d6bf90', noao: true });
  }
  // the colonnettes that stand free in the windows, the round turrets at the corners of the two upper stages with their little shafts
  for (const a of [0, PI / 2, -PI / 2]) {
    const M = mul(T, rotY(a));
    for (const [y, ht, wd, xs] of [[6.75, 1.75, TW - 0.08, [0]], [11.5, 1.65, TW - 0.7, [-1.05, 0, 1.05]], [15.2, 1.2, TW - 1.1, [0]]]) for (const x of xs) {
      cyl('flat', 0.085, 0.1, ht, 5, { M: mul(M, tr(x, y, wd / 2 + 0.11)), c: '#eadfc2', open: true, noao: true }); if (Math.abs(x) < 0.5) bx('flat', M, x - 0.15, x + 0.15, y + ht, y + ht + 0.16, wd / 2 - 0.02, wd / 2 + 0.24, { c: '#eadfc2', noao: true });
    }
  }
  for (const [y0, y1, half, r] of [[11.4, 14.75, (TW - 0.7) / 2, 0.42], [15.05, TH + 0.35, (TW - 1.1) / 2, 0.38]]) for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const M = mul(T, tr(px * half, 0, pz * half));
    cyl('flat', r * 0.8, r * 0.8, y1 - y0, 8, { M: mul(M, tr(0, y0, 0)), c: '#b4935f', open: true, noao: true });
    for (const [dx, dz] of [[px * 0.92, pz * 0.4], [px * 0.4, pz * 0.92]]) cyl('flat', 0.065, 0.065, y1 - y0 - 0.55, 4, { M: mul(M, tr(dx * r, y0, dz * r)), c: '#e7dcc0', open: true, noao: true });
    lathe('flat', [[r * 1.15, 0], [r * 1.05, 0.25], [0, 0.55]], 6, { M: mul(M, tr(0, y1 - 0.55, 0)), c: '#d6bf90', noao: true });
  }
  bx('flat', T, -(TW - 1.3) / 2, (TW - 1.3) / 2, TH - 0.1, TH + 0.05, -(TW - 1.3) / 2, (TW - 1.3) / 2, { c: '#8e7448', noao: true });
}

function buildMartorana() {
  initShared();
  const pts = pairsOf(MA.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-3, 1.5)), groundY(...W(3, 1.5)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('maFront', 384, 384, [FW, FH], paintFront);
  defMat('maTower', 192, 768, [TW, TH], paintTower);
  defMat('maWall', 128, 256, [BAY, BODY], paintWall);
  begin(y0);
  // the body: the whole footprint up to the Norman eaves, a flat roof; the baroque front stands in front of the western block. The painted arches line up with the real ones on the north wall.
  const body = clipFront(pts, -1.5), a0 = W(ARCHES[0], WALLZ), u0 = (a0[0] * N[1] - a0[1] * N[0]) / BAY;
  prism('maWall', body, Math.min(gr.lo, y0) - 1.5, y0 + BODY, { uvo: [0.5 - u0 - Math.floor(0.5 - u0), -y0 / BODY] });
  prism('flat', body, y0 + BODY, y0 + BODY + 0.14, { c: '#c2ab88' });
  // the western block rises behind the front, under a low tiled roof
  prism('maWall', [W(-6.5, -1.5), W(6.5, -1.5), W(6.8, -19.2), W(-6.5, -19.2)], y0 + BODY, y0 + WEST, { uvo: [0, -(y0 + BODY - 6.4) / BODY] });
  pyramid('flat', 13.5, 18.0, 2.3, { M: at(0.05, WEST, -10.35), c: '#a8805c', noao: true });
  baroqueFront(F);
  tower(F);
  // the north wall of the Norman body: the outer order of each blind arch stands out of it (the inner ones are painted), a door under the one nearest the front
  const ring = (w, h, iw, ih) => { const s = archShape(w, h), p = archShape(iw, ih, new THREE.Path()); s.holes.push(p); return s; };
  for (const x of ARCHES) extrude('flat', ring(3.45, 6.95, 2.95, 6.65), 0.24, { M: at(x, 0.1, WALLZ - 0.02), c: '#c9a874', noao: true, cs: 5 });
  bx('flat', F, -23.2, -6.6, BODY - 0.35, BODY + 0.2, WALLZ - 0.15, WALLZ + 0.28, { c: '#d7bc8c', noao: true });
  bx('flat', F, ARCHES[0] - 0.62, ARCHES[0] + 0.62, -0.5, 2.7, WALLZ - 0.1, WALLZ + 0.06, { c: '#3b2616', noao: true });
  bx('flat', F, ARCHES[0] - 0.8, ARCHES[0] + 0.8, 2.7, 3.05, WALLZ - 0.1, WALLZ + 0.2, { c: '#dcd3bd', noao: true });
  // the dome: a square base on the roof, an eight sided drum with small arched windows, a smooth red dome
  { const D = at(-13.6, BODY + 0.14, -9.4), R = 2.6;
    bx('flat', D, -3.1, 3.1, 0, 0.9, -3.1, 3.1, { c: '#b89865', noao: true });
    cyl('flat', R, R, 2.5, 8, { M: mul(D, mul(tr(0, 0.9, 0), rotY(PI / 8))), c: '#c9ab78', open: true, noao: true });
    for (let k = 0; k < 8; k++) { const M = mul(D, mul(rotY(k * PI / 4), tr(0, 1.35, R * Math.cos(PI / 8) - 0.03))); panel('flat', 0.86, 1.5, { M: mul(M, tr(0, 0, 0.06)), c: '#e0c796' }); extrude('flat', archShape(0.52, 1.25), 0.1, { M: mul(M, tr(0, 0.12, 0)), c: '#2e2a26', noao: true, cs: 2 }); }
    cyl('flat', R + 0.22, R + 0.1, 0.34, 8, { M: mul(D, mul(tr(0, 3.4, 0), rotY(PI / 8))), c: '#dcc391', noao: true });
    const prof = []; for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; prof.push([Math.max(0.001, 2.45 * Math.cos(a)), 2.3 * Math.sin(a)]); }
    lathe('flat', prof, 14, { M: mul(D, tr(0, 3.74, 0)), c: '#b9583c', noao: true });
    sphere('flat', 0.22, { M: mul(D, tr(0, 6.2, 0)), seg: 6, c: '#c9a874', noao: true });
  }
  // the low pyramid roof over the east end
  pyramid('flat', 7.6, 7.6, 1.8, { M: at(-24.2, BODY + 0.14, -9.6), c: '#a8805c', noao: true });
  const o = end('Santa Maria dell’Ammiraglio (La Martorana)');
  const quad = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[MA.p, null, y0 + BODY], [quad(-6.55, 6.55, -19.3, 0), null, y0 + FH], [quad(TX - TW / 2, TX + TW / 2, TZ - TW / 2, TZ + TW / 2), null, y0 + TH * TKY + 0.5]];
  return o;
}
export const MARTORANA = { name: 'Santa Maria dell’Ammiraglio (La Martorana)', x: 143, z: 108, radius: 35, skipIds: [MA.id], build: buildMartorana, walls: MA_WALLS };
