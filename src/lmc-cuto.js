// City landmarks: the Arco di Cutò, the arched way through the front of the Palazzo Filangeri di Cutò (Via Maqueda 26, Albergheria). Registered in src/landmarks-city.js.
// What it is (en.wikipedia "Palazzo Filangeri-Cutò, Palermo", balarm.it article on the arch): the Baroque palace of the princes of Cutò, a front of about 65 m on Via Maqueda with
// two floors over the ground floor and three similar portals, each a round arch between two big grey marble Doric columns; the middle one is the Arco di Cutò, the public way
// under the palace from Via Maqueda into Via Chiappara al Carmine and the Ballarò market. Sources disagree on the dates (begun about 1721, finished 1760).
// Measured on the OSM footprints of the tiles (the same ones the game builds from): the front is a straight line along Via Maqueda (all six front vertices lie within 0.1 m of it) from
// (263.3, 500.2) to (291.6, 555.1), 61.8 m; the arch block (footprint w279884788) is 7.0 m wide on the front and 11.6 m deep, the OSM way under it (tunnel=building_passage) is 11.7 m, and the
// middle of its front edge is the middle of the whole front to 0.2 m. The way is square to the front to 1.3 degrees. The ground is flat there (17.2 m, the lidar tile).
// Estimated from the one free photo (Commons "Arco di Cutò.jpg", CC0, used for proportions and colour only, nothing of it is in the game): the clear opening 3.9 m wide and 5.8 m to the
// crown (springing 3.85 m, semicircular), the columns 0.75 m thick and 5.4 m apart on 1 m plinths, the balcony over them 7.2 m up, the three storeys 7.0 / 6.4 / 5.5 m, the cornice at 21.4 m.
// The rest of the front (the rhythm of the bays, the two outer portals at 19.4 m from the arch) follows the same photo and the style guide; it is a reading, not a survey.
// Collision is 2D against wall segments (src/vehicle.js): the footprint of the arch block is dropped (it would close the way) and two walls line the passage; the other five footprints keep
// theirs. The ceiling for the chase camera (src/camera-clear.js) is the underside of the vault, whose normals point down.
import * as THREE from 'three';
import {
  PI, bx, cyl, panel, part, prism, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, paintAshlar, RNG,
} from './lmc-kit.js';

// ---------------------------------------------------------------------------------------------------
// the place: a frame at the middle of the arch on the front, +z out to Via Maqueda (east), +x along the front to the north
// ---------------------------------------------------------------------------------------------------
const FA = [263.3, 500.2], FB = [291.6, 555.1];   // the two ends of the front
const FL = Math.hypot(FB[0] - FA[0], FB[1] - FA[1]), FD = [(FB[0] - FA[0]) / FL, (FB[1] - FA[1]) / FL];
export const CUTO = { c: [277.5, 527.8], n: [FD[1], -FD[0]], HW: 1.95, AH: 5.8, SP: 3.85, D: 11.7 };   // n: out of the front; the passage runs along -n (into Ballarò) for D metres
const C = CUTO.c, N = CUTO.n, HW = CUTO.HW, AH = CUTO.AH, SP = CUTO.SP, D = CUTO.D;
const H = 21.4, HL = FL / 2, BW = 3.75, XC = 8, BAY = 3.7, PW = HL - XC - 4 * BAY, XP = XC + 2 * BAY + PW / 2;   // front height, half front, half arch block, centre panel, bay, portal width and centre
const W2 = (lx, lz) => [C[0] + lx * N[1] + lz * N[0], C[1] - lx * N[0] + lz * N[1]];
const r1 = (v) => Math.round(v * 10) / 10;
const seg = (x0, z0, x1, z1) => { const a = W2(x0, z0), b = W2(x1, z1); return [r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]; };
// where the model stands: the middle of the passage and the headings along it (th as in src/vehicle.js: forward is (sin th, cos th))
export const CUTO_PASSAGE = (() => { const m = W2(0, -D / 2); return { x: r1(m[0]), z: r1(m[1]), thIn: Math.atan2(-N[0], -N[1]), thOut: Math.atan2(N[0], N[1]), len: D, width: 2 * HW, crown: AH }; })();

// the six OSM footprints of the palace front block (tile 0_1): the arch block is rebuilt by hand, the others are redrawn with the front pulled back behind the new front
const RINGS = {
  w279885875: [[263.3, 500.2], [275.9, 524.7], [273.9, 525.2], [262.5, 503.0], [247.8, 509.3], [247.0, 508.0]],
  w279886315: [[262.5, 503.0], [273.9, 525.2], [265.1, 529.0], [258.1, 516.1], [252.9, 518.8], [247.8, 509.3]],
  w279886103: [[258.1, 516.1], [265.1, 529.0], [257.2, 532.6], [254.3, 526.8], [256.6, 525.4], [252.9, 518.8]],
  w279883157: [[268.2, 535.5], [279.1, 530.9], [284.8, 542.1], [273.2, 547.8], [271.2, 543.6], [257.2, 550.9], [262.0, 560.3], [276.1, 553.8], [275.2, 551.8], [287.1, 546.4], [291.6, 555.1], [261.5, 569.7], [253.5, 552.5], [245.3, 556.1], [241.6, 549.0]],
  w279884041: [[284.8, 542.1], [287.1, 546.4], [275.2, 551.8], [273.2, 547.8]],
};
const ARCH_BLOCK = 'w279884788';

// ---------------------------------------------------------------------------------------------------
// painting. Canvas regions are in metres from the left edge of the part (x0), y up from the ground.
// ---------------------------------------------------------------------------------------------------
const STONE = '#bca882', JOINT = '#7f6e50', PLAST = '#d9d0bb', TRIM = '#d6caa9', SHUT = '#6b3b2d', IRON = '#26262b';
function region(g, ox, ow, h, x0, Wm, fn) {   // paint fn(k) into the pixel rectangle (ox, 0, ow, h) that stands for Wm metres from x0 and the whole height
  g.save(); g.translate(ox, 0); g.beginPath(); g.rect(0, 0, ow, h); g.clip();
  const sx = ow / Wm, sy = h / H; fn({ g, w: ow, h, sx, sy, Wm, X: (m) => (m - x0) * sx, Y: (y) => h - y * sy });
  g.restore();
}
function loss(k, xm, ym, rw, rh, seed, col) {   // a ragged patch where the plaster has come off
  const { g, X, Y, sx, sy } = k, r = RNG(seed); g.fillStyle = col || 'rgba(190,172,132,0.78)'; g.beginPath();
  for (let i = 0; i <= 16; i++) { const a = i / 16 * 2 * PI, q = 0.6 + r() * 0.55, x = X(xm) + Math.cos(a) * rw * sx * q, y = Y(ym) + Math.sin(a) * rh * sy * q; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,66,46,0.28)'; g.lineWidth = 1.2; g.stroke();
}
function wallBase(k, seed, o = {}) {   // plaster over rusticated stone, the string course, the frieze and the parapet, the dirt and the patches
  const { g, w, h, sx, sy, X, Y, Wm } = k, r = RNG(seed);
  g.fillStyle = o.plast || PLAST; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2.2, seed + 1, ['rgba(120,100,70,0.09)', 'rgba(255,252,240,0.11)', 'rgba(90,80,60,0.07)']);
  for (let i = 0, n = Math.round(Wm / 4.2); i < n; i++) loss(k, (r() + i) * Wm / n, 8.6 + r() * 10, 0.25 + r() * 0.45, 0.3 + r() * 0.6, seed + 10 + i);
  g.save(); g.beginPath(); g.rect(0, Y(7.0), w, 7.0 * sy); g.clip(); g.translate(0, Y(7.0));   // the rusticated ground floor
  paintAshlar(g, w, 7.0 * sy, Wm, 7.0, 0.62, 1.5, o.stone || STONE, JOINT, seed + 3, 2.2, 0.07); g.restore();
  g.fillStyle = 'rgba(55,42,26,0.25)'; g.fillRect(0, Y(0.9), w, 0.9 * sy);
  g.fillStyle = TRIM; g.fillRect(0, Y(7.45), w, 0.5 * sy); g.fillStyle = 'rgba(40,28,14,0.35)'; g.fillRect(0, Y(6.95), w, 2); g.fillRect(0, Y(7.45), w, 1.5);   // string course
  g.fillStyle = 'rgba(95,80,55,0.35)'; g.fillRect(0, Y(19.6), w, 0.5 * sy);                                                                                   // the frieze under the cornice
  g.fillStyle = TRIM; for (let m = 0.15; m < Wm; m += 0.45) g.fillRect(X(m), Y(19.15), 0.26 * sx, 0.4 * sy);                                                   // dentils
  g.fillStyle = 'rgba(150,135,105,0.55)'; g.fillRect(0, Y(H), w, (H - 20.6) * sy); g.fillStyle = 'rgba(40,30,18,0.3)'; g.fillRect(0, Y(20.6), w, 2);          // the parapet
  streaks(g, w, h, Math.round(Wm * 2.2), seed + 5, 0.16, 150, '45,36,24');
  for (let i = 0; i < Wm * 0.7; i++) { g.fillStyle = 'rgba(235,230,215,0.22)'; g.fillRect(r() * w, Y(1.2 + r() * 2.6), 6 + r() * 12, 2 + r() * 5); }       // salts on the stone
  const gb = g.createLinearGradient(0, h, 0, h - 3.2 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.38)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 3.2 * sy, w, 3.2 * sy);
}
function windowAt(k, cx, y0, y1, ww, o = {}) {   // a tall window: stone frame, dark glass, shutters (closed, ajar or open), a pediment or a lintel; o.bars for a barred ground-floor one
  const { g, X, Y, sx, sy } = k, l = cx - ww / 2, fr = o.fr || 0.17, trim = o.trim || TRIM;
  if (o.ped) { g.fillStyle = trim; g.beginPath(); g.moveTo(X(l - fr - 0.2), Y(y1 + fr)); if (o.ped === 'seg') g.quadraticCurveTo(X(cx), Y(y1 + fr + 0.95), X(l + ww + fr + 0.2), Y(y1 + fr)); else { g.lineTo(X(cx), Y(y1 + fr + 0.6)); g.lineTo(X(l + ww + fr + 0.2), Y(y1 + fr)); } g.fill(); }
  g.fillStyle = trim; g.fillRect(X(l - fr), Y(y1 + fr), (ww + 2 * fr) * sx, (y1 - y0 + fr) * sy);
  g.fillStyle = '#1b2027'; g.fillRect(X(l), Y(y1), ww * sx, (y1 - y0) * sy);
  const gl = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gl.addColorStop(0, 'rgba(150,175,200,0.3)'); gl.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gl; g.fillRect(X(l), Y(y1), ww * sx, (y1 - y0) * sy);
  if (o.bars) { g.fillStyle = IRON; for (let m = l + 0.12; m < l + ww; m += 0.17) g.fillRect(X(m), Y(y1), 2, (y1 - y0) * sy); g.fillRect(X(l), Y((y0 + y1) / 2), ww * sx, 2); return; }
  const open = o.open === undefined ? 0 : o.open, lw = ww / 2 * (1 - open * 0.7);   // shutter leaf width: ajar leaves show narrower, open ones are folded back on the wall
  for (const sg of [-1, 1]) {
    const x0 = sg < 0 ? l : cx + ww / 2 - lw;
    g.fillStyle = SHUT; g.fillRect(X(x0), Y(y1), lw * sx, (y1 - y0) * sy); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = y0 + 0.08; y < y1; y += 0.11) g.fillRect(X(x0), Y(y), lw * sx, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X(x0) + (sg < 0 ? lw * sx - 1.5 : 0), Y(y1), 1.5, (y1 - y0) * sy);
  }
  if (o.curtain) { g.fillStyle = 'rgba(230,225,205,0.4)'; g.fillRect(X(cx - ww * 0.18), Y(y1 - 0.2), ww * 0.36 * sx, (y1 - y0 - 1.2) * sy); }
  g.fillStyle = trim; g.fillRect(X(l - fr - 0.1), Y(y0), (ww + 2 * fr + 0.2) * sx, 0.14 * sy);   // sill
}
function archSurround(k, cx, hw, spring, band, o = {}) {   // the ring of light stone round a round arch, its voussoirs, the keystone and the impost blocks
  const { g, X, Y, sx, sy } = k, R = hw + band;
  g.beginPath(); g.moveTo(X(cx - R), Y(0)); g.lineTo(X(cx - R), Y(spring)); g.arc(X(cx), Y(spring), R * sx, PI, 0); g.lineTo(X(cx + R), Y(0)); g.lineTo(X(cx + hw), Y(0)); g.lineTo(X(cx + hw), Y(spring));
  g.arc(X(cx), Y(spring), hw * sx, 0, PI, true); g.lineTo(X(cx - hw), Y(0)); g.closePath(); g.fillStyle = o.col || '#cdb88c'; g.fill();
  g.strokeStyle = 'rgba(70,55,35,0.55)'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1.6;
  for (let a = 0.12; a < PI; a += 0.2) { g.beginPath(); g.moveTo(X(cx + Math.cos(a) * hw), Y(spring + Math.sin(a) * hw)); g.lineTo(X(cx + Math.cos(a) * R), Y(spring + Math.sin(a) * R)); g.stroke(); }
  for (let y = 0.62; y < spring; y += 0.62) for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(X(cx + sg * hw), Y(y)); g.lineTo(X(cx + sg * R), Y(y)); g.stroke(); }
  const kw = band * 0.62; g.fillStyle = '#dac89d'; g.beginPath(); g.moveTo(X(cx - kw * 0.8), Y(spring + hw)); g.lineTo(X(cx - kw), Y(spring + R + 0.35)); g.lineTo(X(cx + kw), Y(spring + R + 0.35)); g.lineTo(X(cx + kw * 0.8), Y(spring + hw)); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#d8c79b'; for (const sg of [-1, 1]) { g.fillRect(X(cx + sg * (hw + band * 0.5)) - 0.55 * sx, Y(spring + 0.12), 1.1 * sx, 0.24 * sy); }
}
function weatherUnder(k, xs, y, len, seed) {   // black water streaks that run down from a cornice or a balcony slab
  const { g, X, Y, sy } = k, r = RNG(seed);
  for (const x of xs) for (let i = 0; i < 3; i++) { const gx = X(x + (r() - 0.5) * 0.6), gy = Y(y), gr = g.createLinearGradient(0, gy, 0, gy + len * sy * (0.5 + r())); gr.addColorStop(0, 'rgba(35,28,20,0.4)'); gr.addColorStop(1, 'rgba(35,28,20,0)'); g.fillStyle = gr; g.fillRect(gx, gy, 3 + r() * 5, len * sy * 1.5); }
}
function cables(k, seed) {   // a couple of black cables across the front
  const { g, X, Y, Wm } = k, r = RNG(seed); g.strokeStyle = 'rgba(15,15,18,0.75)'; g.lineWidth = 1.6;
  for (const y of [9.3 + r() * 1.5, 15.7 + r() * 1.2]) { g.beginPath(); g.moveTo(X(0), Y(y)); g.quadraticCurveTo(X(Wm / 2), Y(y - 0.5), X(Wm), Y(y + 0.25 * (r() - 0.5))); g.stroke(); }
}

function paintCentre(g, w, h) {   // the middle 16 m of the front: the arch (its opening is cut in the geometry), the framing stone, the windows either side
  region(g, 0, w, h, -XC, 2 * XC, (k) => {
    const { X, Y, sx, sy } = k;
    wallBase(k, 611);
    for (const sg of [-1, 1]) {   // the rusticated pilaster each column stands against
      g.fillStyle = 'rgba(225,208,160,0.38)'; g.fillRect(X(sg * 2.7 - 0.85), Y(6.95), 1.7 * sx, 6.95 * sy); g.fillStyle = 'rgba(40,28,14,0.3)'; g.fillRect(X(sg * 2.7 + (sg > 0 ? 0.85 : -0.85)), Y(6.95), 2, 6.95 * sy);
    }
    archSurround(k, 0, HW, SP, 0.72);
    g.beginPath(); g.moveTo(X(-3.4), Y(6.55)); g.lineTo(X(3.4), Y(6.55)); g.lineTo(X(2.25), Y(AH + 1.05)); g.lineTo(X(-2.25), Y(AH + 1.05)); g.closePath();   // the framed panel over the arch
    g.fillStyle = 'rgba(255,250,228,0.11)'; g.fill(); g.strokeStyle = 'rgba(70,55,35,0.5)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(30,22,14,0.75)'; g.fillRect(X(-0.05), Y(6.45), 0.1 * sx, 0.5 * sy);
    windowAt(k, 0, 7.8, 11.5, 1.4, { ped: 'seg', open: 0.55, curtain: true });
    for (const sg of [-1, 1]) {
      windowAt(k, sg * 5.65, 7.8, 11.5, 1.25, { ped: sg < 0 ? 'tri' : 'seg', open: 0, fr: 0.16 });
      windowAt(k, sg * 5.65, 1.6, 3.3, 0.95, { bars: true }); windowAt(k, sg * 5.65, 4.4, 5.9, 0.85, { bars: true });
      windowAt(k, sg * 5.65, 14.15, 17.6, 1.15, { ped: 'tri', open: sg < 0 ? 0.4 : 0 });
    }
    windowAt(k, 0, 14.15, 17.6, 1.15, { ped: 'tri', open: 0 });
    weatherUnder(k, [-3.6, -1.5, 1.5, 3.6], 7.0, 2.6, 612); weatherUnder(k, [-5.65, 5.65], 11.4, 1.8, 613); cables(k, 614);
    loss(k, -3.1, 9.4, 0.7, 0.9, 615); loss(k, 3.6, 13.2, 0.6, 0.8, 616);   // the plaster off round the balcony, the stone showing
  });
}
function paintWing(g, w, h) {   // an atlas: the first quarter is a bay of the front, the second the back of the arch block, the right half an outer portal
  const q = w / 4;
  region(g, 0, q, h, 0, BAY, (k) => {
    const { X, Y, sx, sy } = k;
    wallBase(k, 621);
    g.fillStyle = 'rgba(232,222,196,0.4)'; g.fillRect(0, Y(19.1), 0.28 * sx, 11.7 * sy); g.fillRect(X(BAY) - 0.28 * sx, Y(19.1), 0.28 * sx, 11.7 * sy);   // the pilaster strips between the bays
    windowAt(k, BAY / 2, 1.6, 3.3, 0.95, { bars: true }); windowAt(k, BAY / 2, 4.4, 5.9, 0.85, { bars: true });
    windowAt(k, BAY / 2, 7.8, 11.5, 1.25, { ped: 'tri', open: 0.2, curtain: true }); windowAt(k, BAY / 2, 14.15, 17.6, 1.1, { ped: 'seg' });
    weatherUnder(k, [BAY / 2 - 0.9, BAY / 2 + 0.9], 7.0, 2.2, 622);
  });
  region(g, q, q, h, -BW, 2 * BW, (k) => {   // the back of the block over the passage, on Via Chiappara: plain, a window each side of the arch on every floor above it
    wallBase(k, 631, { plast: '#d3c6a6', stone: '#b59f74' });
    for (const y0 of [6.5, 10.8, 15.1]) for (const sg of [-1, 1]) windowAt(k, sg * 2.1, y0, y0 + 2.6, 1.0, { open: y0 > 10 ? 0.6 : 0, trim: '#d8cdb0', fr: 0.13 });
    loss(k, 0.4, 12.5, 0.8, 1.0, 632); cables(k, 633);
  });
  region(g, 2 * q, 2 * q, h, -PW / 2, PW, (k) => {   // an outer portal: the carriage arch is cut in the geometry, the framing stone and the windows over it
    const { X, Y, sx, sy } = k;
    wallBase(k, 641);
    for (const sg of [-1, 1]) { g.fillStyle = 'rgba(225,208,160,0.38)'; g.fillRect(X(sg * 2.1 - 0.8), Y(6.95), 1.6 * sx, 6.95 * sy); g.fillStyle = 'rgba(40,28,14,0.3)'; g.fillRect(X(sg * 2.1 + (sg > 0 ? 0.8 : -0.8)), Y(6.95), 2, 6.95 * sy); }
    archSurround(k, 0, 1.45, 3.15, 0.58);
    windowAt(k, 0, 7.8, 11.5, 1.3, { ped: 'seg', open: 0.3 }); windowAt(k, 0, 14.15, 17.6, 1.15, { ped: 'tri', open: 0.5, curtain: true });
    weatherUnder(k, [-2.5, -0.8, 0.8, 2.5], 7.0, 2.4, 642); loss(k, 2.2, 10.0, 0.7, 0.9, 643);
  });
}
function paintSide(g, w, h) {   // plain walls: 8.4 x 8.6 m, two floors of two windows each, a little different each
  g.fillStyle = '#cdb98f'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 50, 2.2, 651, ['rgba(110,90,60,0.1)', 'rgba(255,248,225,0.1)', 'rgba(80,70,50,0.07)']);
  const sx = w / 8.4, sy = h / 8.6, X = (m) => m * sx, Y = (y) => h - y * sy, r = RNG(652);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const cx = 2.1 + i * 4.2, y0 = 1.1 + j * 4.3, ww = 1.0, y1 = y0 + 2.4, shut = (i + j) % 2 ? '#5d6b57' : SHUT, l = cx - ww / 2;
    g.fillStyle = '#d9cfb2'; g.fillRect(X(l - 0.14), Y(y1 + 0.14), (ww + 0.28) * sx, (2.4 + 0.14) * sy); g.fillStyle = '#1c2128'; g.fillRect(X(l), Y(y1), ww * sx, 2.4 * sy);
    if ((i * 2 + j) % 3 !== 1) { g.fillStyle = shut; g.fillRect(X(l), Y(y1), ww * sx, 2.4 * sy); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = y0 + 0.08; y < y1; y += 0.1) g.fillRect(X(l), Y(y), ww * sx, 1); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X(cx) - 1, Y(y1), 2, 2.4 * sy); }
    else { g.fillStyle = shut; g.fillRect(X(l), Y(y1), 0.25 * sx, 2.4 * sy); g.fillRect(X(l + ww - 0.25), Y(y1), 0.25 * sx, 2.4 * sy); }
    g.fillStyle = '#d9cfb2'; g.fillRect(X(l - 0.2), Y(y0), (ww + 0.4) * sx, 0.12 * sy);
  }
  for (let i = 0; i < 3; i++) { const q = { g, X, Y, sx, sy }; loss(q, r() * 8.4, 1 + r() * 7, 0.5 + r() * 0.8, 0.5 + r(), 660 + i, '#bda77a'); }
  streaks(g, w, h, 14, 653, 0.15, 150, '45,36,24');
  g.fillStyle = 'rgba(55,42,26,0.2)'; g.fillRect(0, Y(0.9), w, 0.9 * sy);
}
function paintLining(g, w, h) {   // three bands: the south wall, the north wall (the little shop by the street end), the vault; 11.7 m across
  const band = h / 3, sx = w / D, kb = band / SP, ash = (y0, th, seed, base) => { g.save(); g.translate(0, y0); g.beginPath(); g.rect(0, 0, w, band); g.clip(); paintAshlar(g, w, band, D, th, 0.5, 1.1, base, '#34302a', seed, 2.2, 0.08); g.restore(); };
  ash(0, SP, 671, '#7a6f5b'); ash(band, SP, 672, '#766b57'); ash(band * 2, PI * HW, 673, '#6c624f');
  for (let i = 0; i < 3; i++) { const gr = g.createLinearGradient(0, i * band, 0, (i + 1) * band); gr.addColorStop(0, 'rgba(18,14,9,0.5)'); gr.addColorStop(1, 'rgba(18,14,9,0.12)'); g.fillStyle = gr; g.fillRect(0, i * band, w, band); }   // soot, darkest high
  streaks(g, w, band * 2, 14, 674, 0.2, 120, '15,12,8');
  g.fillStyle = 'rgba(66,68,70,0.9)'; g.fillRect(w * 0.18, 0, 0.13 * sx, band);   // a drain pipe down the south wall
  // the north wall (band 1): u runs to the street end, on the right. A small shop: lit window, a roller shutter beside it, a sign board over both
  const Yb = (y) => 2 * band - y * kb, ux = (m) => (D - m) * sx, R = (m0, m1, y0, y1, col) => { g.fillStyle = col; g.fillRect(ux(m1), Yb(y1), (m1 - m0) * sx, (y1 - y0) * kb); };
  R(0.5, 4.3, 0, 3.25, '#cdbf9c');                                                  // stone frame
  R(0.62, 4.18, 2.55, 3.15, '#e4d49b'); g.fillStyle = 'rgba(70,45,25,0.85)';          // sign board, its lettering as dark strokes
  for (let m = 0.9; m < 3.9; m += 0.34) g.fillRect(ux(m + 0.2), Yb(2.95), 0.2 * sx, 0.28 * kb);
  const wg = g.createLinearGradient(0, Yb(2.4), 0, Yb(0.9)); wg.addColorStop(0, '#f1dfa8'); wg.addColorStop(1, '#8a7650'); g.fillStyle = wg; g.fillRect(ux(4.0), Yb(2.4), 1.7 * sx, 1.5 * kb);   // the lit window
  g.fillStyle = 'rgba(40,30,18,0.7)'; for (const y of [1.3, 1.75, 2.15]) g.fillRect(ux(4.0), Yb(y), 1.7 * sx, 2);                                                                    // shelves
  R(2.3, 4.0, 0, 0.9, '#4a4036');                                                    // the counter below it
  R(0.7, 2.1, 0, 2.45, '#6e7274'); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0.1; y < 2.45; y += 0.13) g.fillRect(ux(2.1), Yb(y), 1.4 * sx, 1);   // the roller shutter
  g.fillStyle = 'rgba(12,10,8,0.75)'; g.fillRect(ux(5.2), Yb(3.5), 0.14 * sx, 0.25 * kb);
}
function paintFloor(g, w, h) {   // dark basalt flags, worn pale down the middle
  paintAshlar(g, w, h, 3, 3, 0.75, 1.0, '#8a8780', '#4a4742', 681, 2.5, 0.1);
  noiseDots(g, w, h, 500, 2.5, 682, ['rgba(30,25,20,0.2)', 'rgba(200,195,185,0.15)']);
}
function paintCol(g, w, h) {   // grey marble shaft (2.4 m round, 5 m high) with stains
  g.fillStyle = '#a7a59f'; g.fillRect(0, 0, w, h); const r = RNG(691);
  noiseDots(g, w, h, 900, 2.6, 692, ['rgba(70,68,62,0.16)', 'rgba(235,232,222,0.2)', 'rgba(120,110,95,0.14)']);
  g.strokeStyle = 'rgba(70,70,70,0.25)'; g.lineWidth = 1; for (let i = 0; i < 16; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 12; y += 12 + r() * 20; g.lineTo(x, y); } g.stroke(); }
  streaks(g, w, h, 8, 693, 0.3, 140, '60,50,40');
  const gb = g.createLinearGradient(0, h, 0, h - h * 0.4); gb.addColorStop(0, 'rgba(60,50,40,0.45)'); gb.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gb; g.fillRect(0, h - h * 0.4, w, h * 0.4);   // dirt from the pavement
}
function paintRail(g, w, h) {   // wrought iron, 1.2 x 1.05 m: top and bottom rails, interlaced oval links between uprights
  g.clearRect(0, 0, w, h); g.fillStyle = IRON; g.fillRect(0, 0, w, h * 0.07); g.fillRect(0, h * 0.9, w, h * 0.06); g.fillRect(0, h * 0.18, w, 2);
  g.strokeStyle = IRON; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) { const cx = (i + 0.5) * w / 4; g.beginPath(); g.ellipse(cx, h * 0.54, w / 8 * 1.05, h * 0.34, 0, 0, 2 * PI); g.stroke(); g.fillRect(i * w / 4 - 1.5, 0, 3, h); }
}

// ---------------------------------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------------------------------
function vaultGeo(r, len, n) {   // a half cylinder along -z with its normals pointing in, so the underside is a ceiling for src/camera-clear.js; uv: u along z, v along the arc
  const pos = [], nor = [], uv = [], A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a0 = PI * i / n, a1 = PI * (i + 1) / n, P = (a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    const q = [[P(a0, 0), 0, i / n], [P(a1, 0), 0, (i + 1) / n], [P(a1, -len), 1, (i + 1) / n], [P(a0, -len), 1, i / n]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const tri = [q[a], q[b], q[c]];
      A.set(...tri[0][0]); B.set(...tri[1][0]); Cc.set(...tri[2][0]); t1.subVectors(B, A); t2.subVectors(Cc, A); t1.cross(t2);
      const am = (a0 + a1) / 2; if (t1.x * -Math.cos(am) + t1.y * -Math.sin(am) < 0) tri.reverse();   // wind them so the face looks inward
      for (const [p, u, v] of tri) { pos.push(...p); const a_ = Math.atan2(p[1], p[0]); nor.push(-Math.cos(a_), -Math.sin(a_), 0); uv.push(u, v); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function archHole(r, spring, cx = 0) {   // the opening, as a hole path for a wall shape (clockwise)
  const p = new THREE.Path(); p.moveTo(cx - r, 0); p.lineTo(cx - r, spring); p.absarc(cx, spring, r, PI, 0, true); p.lineTo(cx + r, 0); p.lineTo(cx - r, 0); return p;
}
function wallShape(x0, x1, y1, hole) {
  const s = new THREE.Shape(); s.moveTo(x0, 0); s.lineTo(x1, 0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, 0); if (hole) s.holes.push(hole); return s;
}
const shapePart = (key, shape, M, uvk, uvo) => part(key, new THREE.ShapeGeometry(shape, 14), { M, uv: 'keep', uvk, uvo, noao: true });

// ---------------------------------------------------------------------------------------------------
// the model
// ---------------------------------------------------------------------------------------------------
function column(M, cx) {   // a grey marble Doric column on a plinth against the front, with its old lantern on the outer side
  const zc = 0.72;
  bx('stone', M, cx - 0.6, cx + 0.6, 0, 1.0, 0.0, 1.44, { c: '#bdb08f' });
  bx('flat', M, cx - 0.52, cx + 0.52, 1.0, 1.14, 0.06, 1.38, { c: '#cdbf9a' });
  cyl('stone', 0.5, 0.46, 0.2, 12, { M, p: [cx, 1.14, zc], c: '#b9b4a8', noao: true });
  cyl('cuCol', 0.36, 0.385, 4.95, 14, { M, p: [cx, 1.34, zc], ry: PI, noao: true });
  cyl('stone', 0.52, 0.37, 0.22, 12, { M, p: [cx, 6.29, zc], c: '#b9b4a8', noao: true });
  bx('flat', M, cx - 0.52, cx + 0.52, 6.51, 6.76, zc - 0.52, zc + 0.52, { c: '#cbbf9f' });
  bx('flat', M, cx - 0.8, cx + 0.8, 6.76, 7.3, 0.0, 1.5, { c: '#c9bb97' });
}
function lantern(M, cx, sg) {   // an old cast lantern on an iron arm from the column
  const x = cx + sg * 0.62;
  bx('dark', M, Math.min(cx + sg * 0.3, x), Math.max(cx + sg * 0.3, x) + 0.0, 3.35, 3.4, 0.68, 0.76, { c: IRON, noao: true });
  bx('cuLamp', M, x - 0.14, x + 0.14, 3.42, 3.92, 0.6, 0.88, { noao: true });
  bx('dark', M, x - 0.18, x + 0.18, 3.92, 3.98, 0.56, 0.92, { c: IRON, noao: true });
}
function balcony(M, x0, x1, y, depth, hi, brk) {   // a stone slab on its moulding, stone corbels under it and the railing on three sides
  bx('flat', M, x0, x1, y - 0.36, y, 0, depth, { c: '#cfc3a1' });
  bx('flat', M, x0 + 0.1, x1 - 0.1, y - 0.62, y - 0.36, 0, depth - 0.2, { c: '#c4b792' });
  const n = brk ? Math.max(2, Math.round((x1 - x0) / 1.1)) : 0;
  for (let i = 0; i < n; i++) { const xc = x0 + 0.3 + (x1 - x0 - 0.6) * (i / (n - 1)); bx('flat', M, xc - 0.11, xc + 0.11, y - 1.0, y - 0.62, 0.0, depth * 0.55, { c: '#c4b792' }); }
  const len = x1 - x0;
  panel('cuRail', len, hi, { M: mul(M, tr((x0 + x1) / 2, y, depth - 0.04)), uvk: [len / 1.2, 1] });
  for (const [xx, ry] of [[x0 + 0.04, -PI / 2], [x1 - 0.04, PI / 2]]) panel('cuRail', depth - 0.04, hi, { M: mul(M, mul(tr(xx, y, (depth - 0.04) / 2), rotY(ry))), uvk: [(depth - 0.04) / 1.2, 1] });
}
function cornice(M, x0, x1) {   // the main cornice and the dentil course under it, the string course; each ends where it is given
  bx('flat', M, x0, x1, 19.0, 19.55, 0, 0.32, { c: '#d3c7a6' });
  bx('flat', M, x0, x1, 19.55, 20.05, 0, 0.9, { c: '#cfc3a1' });
  bx('flat', M, x0, x1, 20.05, 20.6, 0, 1.15, { c: '#d6caa9' });
  bx('flat', M, x0, x1, 20.6, 20.85, 0.18, 0.7, { c: '#cfc3a1' });
}
// the footprint ring, the front vertices pulled back behind the new front so nothing shares a plane with it
function pulled(ring) { return ring.map(p => { const d = (p[0] - C[0]) * N[0] + (p[1] - C[1]) * N[1]; return Math.abs(d) < 0.6 ? [p[0] - N[0] * (d + 0.3), p[1] - N[1] * (d + 0.3)] : p; }); }

function buildCuto() {
  initShared();
  const gy = groundY(C[0], C[1]), M = frame(C[0], gy, C[1], N[0], N[1]);
  begin(gy);
  defMat('cuCentre', 768, 768, [16, H], paintCentre);
  defMat('cuWing', 512, 768, [1, 1], paintWing);
  defMat('cuSide', 256, 256, [8.4, 8.6], paintSide);
  defMat('cuLining', 384, 576, [1, 1], paintLining);
  defMat('cuFloor', 128, 128, [3, 3], paintFloor);
  defMat('cuCol', 128, 256, [2.4, 5.2], paintCol);
  defMat('cuRail', 128, 128, [1, 1], paintRail, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  defMat('cuLamp', 0, 0, [1, 1], null, { roughness: 0.5, emissive: new THREE.Color('#ffe2a0'), emissiveIntensity: 0.55 });

  // ---- the front: the middle panel with the arch cut out, the bays and the two outer portals each side
  shapePart('cuCentre', wallShape(-XC, XC, H, archHole(HW, SP)), M, [1 / 16, 1 / H], [0.5, 0]);
  const xb = [XC, XC + BAY, XC + 2 * BAY], xo = XC + 2 * BAY + PW;
  for (const s of [1, -1]) {
    for (const x0 of [xb[0], xb[1], xo, xo + BAY]) panel('cuWing', BAY, H, { M: mul(M, tr(s * (x0 + BAY / 2), 0, 0)), uvk: [0.25, 1], uvo: [0, 0] });
    shapePart('cuWing', wallShape(-PW / 2, PW / 2, H, archHole(1.45, 3.15)), mul(M, tr(s * XP, 0, 0)), [0.5 / PW, 1 / H], [0.75, 0]);
  }
  // the outer portals: reveals, a dark studded door set back, the columns, the lanterns are the middle one's only
  for (const s of [1, -1]) {
    const px = s * XP, rv = 0.8, r = 1.45, sp = 3.15, Mp = mul(M, tr(px, 0, 0));
    bx('stone', Mp, -r - 0.02, -r + 0.02, 0, sp, -rv, 0.02, { c: '#a89c80' }); bx('stone', Mp, r - 0.02, r + 0.02, 0, sp, -rv, 0.02, { c: '#a89c80' });
    const rg = vaultGeo(r, rv, 10); part('stone', rg, { M: mul(Mp, tr(0, sp, 0.0)), c: '#a89c80', noao: true, uv: 'world' });
    const door = new THREE.Shape(); door.moveTo(-r, 0); door.lineTo(r, 0); door.lineTo(r, sp); door.absarc(0, sp, r, 0, PI, false); door.lineTo(-r, 0);
    part('dark', new THREE.ShapeGeometry(door, 12), { M: mul(Mp, tr(0, 0, -rv)), c: '#3a281b', noao: true });
    bx('dark', Mp, -0.025, 0.025, 0, sp + r - 0.1, -rv + 0.01, -rv + 0.04, { c: '#1a120c', noao: true });
    for (const cs of [-1, 1]) column(M, px + cs * 2.1);
    balcony(M, px - 2.9, px + 2.9, 7.65, 1.45, 1.05);
  }
  // the middle: the columns, the balcony over them, the lanterns, the little balcony of the second floor
  for (const cs of [-1, 1]) { column(M, cs * 2.7); lantern(M, cs * 2.7, cs); }
  balcony(M, -4.1, 4.1, 7.65, 1.5, 1.05);
  // wing balconies: every window of the piano nobile has one, the second floor has smaller ones
  const wins = [XC + BAY / 2, XC + 1.5 * BAY, XC + 2 * BAY + PW + BAY / 2, XC + 2 * BAY + PW + 1.5 * BAY, 5.65];
  for (const s of [1, -1]) for (const cx of wins) { balcony(M, s * cx - 1.05, s * cx + 1.05, 7.65, 0.8, 1.0, true); balcony(M, s * cx - 0.8, s * cx + 0.8, 14.0, 0.62, 0.95, true); }
  for (const cx of [XP, -XP, 0]) balcony(M, cx - 0.8, cx + 0.8, 14.0, 0.62, 0.95, true);
  // string course either side of the columns, the cornice all along, the quoin at each end
  bx('flat', M, XC - 3.9, HL, 7.0, 7.4, 0, 0.3, { c: '#d3c7a6' }); bx('flat', M, -HL, -(XC - 3.9), 7.0, 7.4, 0, 0.3, { c: '#d3c7a6' });
  cornice(M, -HL - 0.2, HL + 0.2);
  for (const s of [1, -1]) bx('stone', M, s > 0 ? HL - 0.7 : -HL - 0.15, s > 0 ? HL + 0.15 : -HL + 0.7, 0, H, -0.45, 0.14, { c: '#cbbd98' });

  // ---- the arch block: the passage lining (south wall, north wall, vault, floor) and the back wall
  const Mw = (side) => mul(M, mul(tr(side * HW, 0, -D / 2), rotY(-side * PI / 2)));
  panel('cuLining', D, SP, { M: Mw(-1), uvk: [1, 1 / 3], uvo: [0, 2 / 3] });
  panel('cuLining', D, SP, { M: Mw(1), uvk: [1, 1 / 3], uvo: [0, 1 / 3] });   // its u runs to the street end, where the shop is
  part('cuLining', vaultGeo(HW - 0.01, D, 14), { M, p: [0, SP, 0], uv: 'keep', uvk: [1, 1 / 3], uvo: [0, 0], noao: true });
  shapePart('cuWing', wallShape(-BW, BW, H, archHole(HW, SP)), mul(M, mul(tr(0, 0, -D), rotY(PI))), [0.25 / (2 * BW), 1 / H], [0.375, 0]);
  bx('dark', M, -0.02, 0.02, AH - 0.6, AH - 0.05, -3.02, -2.98, { c: IRON, noao: true }); bx('cuLamp', M, -0.14, 0.14, AH - 1.1, AH - 0.6, -3.14, -2.86, { noao: true });   // one lantern hung from the vault
  const fl = [], NR = 6;   // the floor follows the ground
  for (let i = 0; i <= NR; i++) { const row = []; for (const lx of [-HW, -HW / 3, HW / 3, HW]) { const p = W2(lx, -D * i / NR); row.push([p[0], groundY(p[0], p[1]) + 0.03, p[1]]); } fl.push(row); }
  gridMesh('cuFloor', fl, (i, j, p) => [(p[0] * 0.8 + p[2] * 0.6) / 3, (p[2] * 0.8 - p[0] * 0.6) / 3], { noao: true, flip: false });
  // roofs and walls of the rest of the block
  const arch = [W2(-BW, 0), W2(BW, 0), W2(BW, -D), W2(-BW, -D)].map(p => [p[0], p[1]]);
  prism('flat', arch, gy + H, gy + H + 0.2, { c: '#8f8a82' });
  for (const id in RINGS) {
    const ring = pulled(RINGS[id]);
    prism('cuSide', ring, gy - 0.6, gy + H, { uvo: [0, -gy / 8.6] });
    prism('flat', ring, gy + H, gy + H + 0.2, { c: '#8f8a82' });
  }
  return end('Arco di Cutò');
}

// collision: the two walls of the passage and the stub of the front at each mouth, the plinths of the columns
const WALLS = [
  seg(HW, 0, HW, -D), seg(-HW, 0, -HW, -D),
  seg(HW, 0, BW, 0), seg(-HW, 0, -BW, 0), seg(HW, -D, BW, -D), seg(-HW, -D, -BW, -D),
];
for (const cx of [2.7, -2.7, XP - 2.1, XP + 2.1, -XP - 2.1, -XP + 2.1]) {   // each plinth, 1.2 x 1.44 m, as four walls
  const a = [cx - 0.6, 0], b = [cx + 0.6, 0], c = [cx + 0.6, 1.44], d = [cx - 0.6, 1.44];
  for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]]) WALLS.push(seg(p[0], p[1], q[0], q[1]));
}
export const ARCO_CUTO = {
  name: 'Arco di Cutò', x: C[0], z: C[1], radius: 48, skipIds: [...Object.keys(RINGS), ARCH_BLOCK], dropWalls: [ARCH_BLOCK], walls: WALLS, build: buildCuto,
};
