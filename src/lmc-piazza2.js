// City landmarks around Piazza Ruggero Settimo / Piazza Castelnuovo (Palermo), drawn from reference photos. Registered in src/landmarks-city.js as PIAZZA2.
// Reference photos (Wikimedia Commons, looked at, nothing copied, only proportions and colours read):
//   Kursaal Biondo (w215618518, OSM name "Kursaal Biondo"): "Kursaal Biondo.jpg" (frontal from above, whole front and both end piers),
//     "Palermo-AP-p1070702.jpg" (frontal at street level, centre bay). Read: a 22.4 m wide front of cream plaster and golden ochre stone, four piers (two wide end piers
//     with a green rosette cap, two inner piers taller with a garland cap), two side panels each with one pedimented window, a central bay with an arched portal (archivolt, two
//     flanking pilasters), two tall windows beside it, a main cornice with a red frieze lettered TEATRO NAZIONALE BIONDO 1914, a balustrade with two statues, above it a pedimented
//     group of three windows, then a stepped gable wall with a red rake band, two round windows in stepped panels, and a small block on the ridge. Heights relative to the width
//     (22.4 m): main cornice 0.40, inner pier caps 0.50, eaves of the gable wall 0.66, ridge 0.77, ridge block 0.84. The roof behind is not visible in any photo (assumed tiles).
//   Chiosco Ribaudo (w204272307, OSM name "chiosco Ribaudo"): "Chiosco Ribaudo Palermo1.jpg" (front and chamfered side). Read: a small Liberty kiosk, grey marble plinth,
//     cream faces with a tall door under an ogee arch and a rolling shutter, narrow mosaic panels on the chamfered corners, a big rounded canopy with a coffered underside, a pierced
//     balustrade on top between two urn posts, the name RIBAUDO over the door. Which long side faces which street is not visible in the photos.
//   Corner palazzo at the tip of the block w204272306 (found by position: the kiosk stands against it): "Piazza Ruggero Settimo - Palermo - panoramio - kajikawa (3).jpg" (2002, grey-green,
//     the corner seen from Piazza Castelnuovo) and "Chiosco Ribaudo Palermo1.jpg" (recent, cream with a grey rusticated base). Read: a grey stone shop base of two levels, then four floors of
//     shuttered windows, arched windows with balconies on the two middle floors, Greek-key railings and a Greek-key balcony shelf over the base, a cornice and a roof terrace. Bay counts
//     (5 on the short face, 13 on the long one) are counted from the 2002 photo and are approximate. Only the two street faces seen in the photos are drawn, as a veneer 0.15 m
//     off the generic wall; the rest of the block stays generic.
// Not identified from photos and therefore not built: the other palazzi around the two squares (see the report).
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, groundRange, gable, statue, panel, balus, paintAshlar } from './lmc-kit.js';

// ------------------------------------------------------------------------------------------------
// shared: a frame from a world point and an outward normal; local +z out of the face, local +x to the viewer's right
// ------------------------------------------------------------------------------------------------
const mk = (O, N) => ({ O, N, X: [N[1], -N[0]], toW: (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]] });
const gMin = (pts) => Math.min(...pts.map(p => groundY(p[0], p[1])));

// ================================================================================================
// KURSAAL BIONDO
// ================================================================================================
const KP = [-404.7, -975.1, -390.2, -982.4, -384.7, -985.1, -365.2, -946.7, -385.1, -936.7];
const KF = mk([-394.7, -980.1], [-0.447, -0.894]);
const KW = 22.4, KD = 43, KH = 19.2, KCORN = 9.0, KEAVE = 14.7, KRIDGE = 17.2, KTOP = 18.9, KHALL = 9.6;
const OCH = '#d3a96b', OCHL = '#e0bb82', CREAM = '#e7dab4', RED = '#8e3b2d', PAT = '#7fa793', DARKW = '#2a2e35';

function paintKurFront(g, w, h) {
  const sx = w / KW, sy = h / KH, X = x => (x + KW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 7101, ['rgba(150,110,60,0.09)', 'rgba(255,248,225,0.09)', 'rgba(110,80,40,0.06)']);
  // lower zone: plinth, panels
  R(-KW / 2, 0, KW / 2, 0.9, '#c9b48a');
  // outer piers and inner piers: ochre ashlar with joints
  const pier = (x0, x1, y0, y1) => { R(x0, y0, x1, y1, OCH); for (let y = y0 + 0.7; y < y1 - 0.2; y += 0.7) R(x0, y, x1, y + 0.05, 'rgba(90,60,30,0.35)'); R(x0, y0, x0 + 0.08, y1, 'rgba(255,235,190,0.4)'); R(x1 - 0.1, y0, x1, y1, 'rgba(60,35,15,0.3)'); };
  for (const s of [-1, 1]) {
    const a = s > 0 ? 8.9 : -11.2, b = s > 0 ? 11.2 : -8.9;
    pier(a, b, 0.9, 9.6); R(a - 0.1, 8.6, b + 0.1, 9.7, OCHL); g.fillStyle = PAT; g.beginPath(); g.arc(X((a + b) / 2), Y(9.1), 0.38 * sx, 0, 2 * PI); g.fill();
    // end tower above the pier, up to the gable wall's top corner
    R(s > 0 ? 9.6 : -11.2, 9.7, s > 0 ? 11.2 : -9.6, 15.0, OCH); R(s > 0 ? 9.5 : -11.3, 14.5, s > 0 ? 11.3 : -9.5, 15.3, OCHL);
    g.fillStyle = PAT; g.beginPath(); g.arc(X(s * 10.4), Y(14.2), 0.4 * sx, 0, 2 * PI); g.fill();
    const ia = s > 0 ? 3.75 : -5.6, ib = s > 0 ? 5.6 : -3.75;
    pier(ia, ib, 0.9, 10.3); R(ia - 0.15, 10.3, ib + 0.15, 11.1, OCHL); g.fillStyle = PAT; g.fillRect(X(ia - 0.1), Y(10.9), (ib - ia + 0.2) * sx, 0.18 * sy);
    // side panel window: grille, ochre frame, pediment
    const wx = s * 7.25;
    R(wx - 0.95, 1.5, wx + 0.95, 4.9, OCH); R(wx - 0.62, 1.8, wx + 0.62, 4.5, DARKW); for (let y = 2.3; y < 4.4; y += 0.45) R(wx - 0.62, y, wx + 0.62, y + 0.05, '#555b64'); R(wx - 0.03, 1.8, wx + 0.03, 4.5, '#555b64');
    g.fillStyle = OCHL; g.beginPath(); g.moveTo(X(wx - 1.25), Y(4.9)); g.lineTo(X(wx), Y(5.9)); g.lineTo(X(wx + 1.25), Y(4.9)); g.fill(); g.fillStyle = CREAM; g.beginPath(); g.moveTo(X(wx - 0.8), Y(5.0)); g.lineTo(X(wx), Y(5.6)); g.lineTo(X(wx + 0.8), Y(5.0)); g.fill();
    R(wx - 1.1, 1.3, wx + 1.1, 1.55, OCHL);
    // tall window beside the portal
    const tx = s * 3.15; R(tx - 0.7, 2.8, tx + 0.7, 7.5, DARKW); R(tx - 0.72, 2.8, tx - 0.62, 7.5, OCH); R(tx + 0.62, 2.8, tx + 0.72, 7.5, OCH);
    for (let y = 3.6; y < 7.3; y += 1.2) R(tx - 0.7, y, tx + 0.7, y + 0.06, '#4a515b');
    // round window in a stepped panel on the gable wall
    const rx = s * 6.5, ry = 12.4; R(rx - 1.3, ry - 1.3, rx + 1.3, ry + 1.3, '#d3b684'); R(rx - 0.95, ry - 0.95, rx + 0.95, ry + 0.95, CREAM); g.fillStyle = OCH; g.beginPath(); g.arc(X(rx), Y(ry), 0.78 * sx, 0, 2 * PI); g.fill(); g.fillStyle = DARKW; g.beginPath(); g.arc(X(rx), Y(ry), 0.58 * sx, 0, 2 * PI); g.fill();
    // portal columns
    pier(s * 1.7 + (s > 0 ? 0 : -0.6), s * 1.7 + (s > 0 ? 0.6 : 0), 1.0, 7.3);
  }
  // portal
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  arch(0, 1.0, 7.4, 4.0, OCH); arch(0, 1.0, 7.0, 3.1, '#1c1b1c'); R(-1.55, 1.0, 1.55, 4.2, '#25201c'); for (let y = 1.6; y < 4.2; y += 0.8) R(-1.5, y, 1.5, y + 0.04, 'rgba(210,180,120,0.35)');
  R(-0.5, 7.4, 0.5, 8.0, OCHL); g.fillStyle = '#6a2c20'; g.font = Math.round(0.4 * sy) + 'px serif'; g.textAlign = 'center'; g.fillText('1914', X(0), Y(7.9));
  // main cornice, red frieze with the name
  R(-KW / 2, 7.8, KW / 2, 9.0, CREAM); R(-KW / 2, 8.0, KW / 2, 8.8, RED); R(-KW / 2, 8.0, KW / 2, 8.08, '#6a2c20'); R(-KW / 2, 8.8, KW / 2, 9.0, OCHL); R(-KW / 2, 7.8, KW / 2, 8.0, OCHL);
  g.fillStyle = '#e8d6a8'; g.font = 'bold ' + Math.round(0.5 * sy) + 'px serif'; g.textAlign = 'center'; g.fillText('TEATRO  NAZIONALE  BIONDO', X(0), Y(8.2), 7.4 * sx);
  // balustrade band and the three-window group with a pediment
  R(-3.75, 9.0, 3.75, 9.95, '#d8c79c'); for (let x = -3.5; x < 3.6; x += 0.5) R(x, 9.15, x + 0.22, 9.85, '#b99d66');
  R(-2.1, 10.9, 2.1, 13.5, OCH); for (const dx of [-1.25, 0, 1.25]) { R(dx - 0.45, 11.1, dx + 0.45, 13.1, DARKW); R(dx - 0.03, 11.1, dx + 0.03, 13.1, OCH); R(dx - 0.45, 12.1, dx + 0.45, 12.16, OCH); }
  R(-2.3, 13.5, 2.3, 13.75, OCHL); g.fillStyle = OCHL; g.beginPath(); g.moveTo(X(-2.5), Y(13.75)); g.lineTo(X(0), Y(14.95)); g.lineTo(X(2.5), Y(13.75)); g.fill(); g.fillStyle = CREAM; g.beginPath(); g.moveTo(X(-2.0), Y(13.9)); g.lineTo(X(0), Y(14.7)); g.lineTo(X(2.0), Y(13.9)); g.fill();
  // red band under the rake, stepped, and the ridge block
  g.fillStyle = RED; g.beginPath(); g.moveTo(X(-9.6), Y(KEAVE)); g.lineTo(X(-1.9), Y(KRIDGE)); g.lineTo(X(-1.9), Y(KRIDGE - 0.45)); g.lineTo(X(-9.6), Y(KEAVE - 0.45)); g.fill();
  g.beginPath(); g.moveTo(X(9.6), Y(KEAVE)); g.lineTo(X(1.9), Y(KRIDGE)); g.lineTo(X(1.9), Y(KRIDGE - 0.45)); g.lineTo(X(9.6), Y(KEAVE - 0.45)); g.fill();
  g.fillStyle = OCHL; for (let i = 0; i < 6; i++) { const x = 1.9 + i * 1.25, y = KRIDGE - (i * 1.25) * (KRIDGE - KEAVE) / 7.7 - 0.9; for (const s of [-1, 1]) g.fillRect(X(s * x - 0.55), Y(y - 0.0), 1.1 * sx, 0.3 * sy); }
  R(-1.9, KRIDGE - 0.3, 1.9, KTOP, OCH); R(-1.5, KRIDGE + 0.4, -0.2, KTOP - 0.35, CREAM); R(0.2, KRIDGE + 0.4, 1.5, KTOP - 0.35, CREAM); R(-2.1, KTOP - 0.2, 2.1, KTOP, OCHL);
  // weathering
  for (let i = 0; i < 9; i++) { const cx = X(-10 + i * 2.5), cy = Y(2 + (i * 5) % 14), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * sx); gr.addColorStop(0, 'rgba(120,85,45,0.14)'); gr.addColorStop(1, 'rgba(120,85,45,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, 40, 7102, 0.1, 120, '70,50,35');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintKurWall(g, w, h) {
  g.fillStyle = '#dfcfa6'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 40, 2, 7111, ['rgba(150,110,60,0.1)', 'rgba(255,248,225,0.09)']);
  g.fillStyle = 'rgba(110,80,45,0.35)'; g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(255,240,200,0.3)'; g.fillRect(3, 0, 1, h);
  streaks(g, w, h, 10, 7112, 0.1, 80, '70,50,35');
}

function buildKursaal() {
  initShared();
  const pts = [[KP[0], KP[1]], [KP[2], KP[3]], [KP[4], KP[5]], [KP[6], KP[7]], [KP[8], KP[9]]], W = KF.toW;
  const y0 = Math.min(gMin(pts), groundY(...W(0, 3))), gr = groundRange(pts);
  const F = frame(KF.O[0], y0, KF.O[1], KF.N[0], KF.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('pwKurFront', 512, 460, [KW, KH], paintKurFront);
  defMat('pwKurWall', 128, 128, [5, 5], paintKurWall);
  defMat('pwKurStone', 128, 128, [2.2, 2.2], (g, w, h) => paintAshlar(g, w, h, 2.2, 2.2, 0.7, 1.1, '#d6ad70', '#a07a46', 7121, 1.5, 0.05));
  begin(y0);
  const lo = Math.min(gr.lo, y0) - y0 - 1.5, hw = KW / 2;
  // body: the lower block over the whole footprint, the hall above it, the gable roof (roof not visible in any photo)
  bx('pwKurWall', F, -hw, hw, lo, KCORN, -KD, -0.3);
  bx('pwKurWall', F, -KHALL, KHALL, KCORN, KEAVE, -KD, -0.3);
  gable('tile', 'pwKurWall', at(0, 0, -KD / 2), KHALL * 2, KD - 0.1, KEAVE, KRIDGE - KEAVE, { ov: 0.3, c: '#b8744f', wc: '#dfcfa6' });
  // the painted front, one extruded shape (end towers, stepped gable wall, ridge block)
  const s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 15.3); s.lineTo(9.6, 15.3); s.lineTo(9.6, KEAVE); s.lineTo(1.9, KRIDGE); s.lineTo(1.9, KTOP); s.lineTo(-1.9, KTOP); s.lineTo(-1.9, KRIDGE);
  s.lineTo(-9.6, KEAVE); s.lineTo(-9.6, 15.3); s.lineTo(-hw, 15.3); s.lineTo(-hw, 0);
  extrude('pwKurFront', s, 0.5, { M: at(0, 0, -0.55), uv: 'keep', uvk: [1 / KW, 1 / KH], uvo: [0.5, 0], cs: 4, noao: true });
  // relief: piers, caps, cornice slabs, portal pilasters, balustrade, statues, the rosettes' blocks
  const st = (x0, x1, y0, y1, d, c) => bx(c === OCH ? 'pwKurStone' : 'flat', F, x0, x1, y0, y1, -0.1, -0.05 + d, { c: c === OCH ? '#ffffff' : c, noao: true });
  for (const sg of [-1, 1]) {
    st(sg > 0 ? 8.9 : -11.2, sg > 0 ? 11.2 : -8.9, 0.9, 9.6, 0.38, OCH);
    st(sg > 0 ? 8.8 : -11.3, sg > 0 ? 11.3 : -8.8, 8.7, 9.8, 0.46, OCHL);
    st(sg > 0 ? 3.75 : -5.6, sg > 0 ? 5.6 : -3.75, 0.9, 10.3, 0.38, OCH);
    st(sg > 0 ? 3.6 : -5.75, sg > 0 ? 5.75 : -3.6, 10.3, 11.1, 0.48, OCHL);
    st(sg > 0 ? 1.7 : -2.3, sg > 0 ? 2.3 : -1.7, 1.0, 7.3, 0.3, OCH);
    st(sg > 0 ? 9.6 : -11.2, sg > 0 ? 11.2 : -9.6, 9.8, 15.0, 0.3, OCH);
    st(sg > 0 ? 9.45 : -11.35, sg > 0 ? 11.35 : -9.45, 14.5, 15.3, 0.4, OCHL);
    st(sg > 0 ? 5.6 : -8.9, sg > 0 ? 8.9 : -5.6, 4.9, 5.1, 0.2, OCHL);
    statue('flat', at(sg * 2.1, 9.95, 0.15), 2.0, { c: '#b9ab92', noao: true });
  }
  st(-hw - 0.2, hw + 0.2, 8.85, 9.15, 0.52, OCHL);
  st(-hw - 0.1, hw + 0.1, 7.9, 8.1, 0.36, OCHL);
  st(-3.75, 3.75, 9.0, 9.1, 0.3, '#d8c79c');
  balus(at(0, 9.1, 0.15), 7.5, 0.85, { noao: true });
  st(-2.4, 2.4, 13.5, 13.8, 0.26, OCHL);
  const o = end('Kursaal Biondo');
  o.userData.solids = [[KP, null, y0 + KRIDGE]];
  return o;
}
export const KURSAAL = { name: 'Kursaal Biondo', x: -385, z: -961, radius: 36, skipIds: ['w215618518'], build: buildKursaal };

// ================================================================================================
// CHIOSCO RIBAUDO
// ================================================================================================
const RP = [-487.2, -943.8, -482.7, -946.1, -481, -942.6, -485.5, -940.4];
const RC = [(RP[0] + RP[2] + RP[4] + RP[6]) / 4, (RP[1] + RP[3] + RP[5] + RP[7]) / 4];
const RF = mk(RC, [-0.455, -0.89]);   // local x along the 5.05 m side, +z out of the 3.9 m wide side facing north-west

function paintRib(g, w, h) {
  // left half: a door face (ogee arch, rolling shutter); right half: a chamfer face (mosaic panel, narrow window)
  g.fillStyle = '#eadfc4'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 50, 1.5, 7201, ['rgba(150,110,60,0.08)', 'rgba(255,248,225,0.12)']);
  const hw = w / 2, k = h / 2.5;   // 2.5 m tall faces, 1.9 m wide door face
  g.fillStyle = '#c9b48a'; g.fillRect(0, 0, hw, 0.12 * k);
  // door: ochre frame, ogee top, dark shutter with slats
  g.fillStyle = '#c8ab72'; g.beginPath(); g.moveTo(hw * 0.2, h); g.lineTo(hw * 0.2, h * 0.34); g.quadraticCurveTo(hw * 0.2, h * 0.12, hw * 0.5, h * 0.04); g.quadraticCurveTo(hw * 0.8, h * 0.12, hw * 0.8, h * 0.34); g.lineTo(hw * 0.8, h); g.fill();
  g.fillStyle = '#2f3034'; g.beginPath(); g.moveTo(hw * 0.27, h); g.lineTo(hw * 0.27, h * 0.38); g.quadraticCurveTo(hw * 0.27, h * 0.2, hw * 0.5, h * 0.12); g.quadraticCurveTo(hw * 0.73, h * 0.2, hw * 0.73, h * 0.38); g.lineTo(hw * 0.73, h); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = h * 0.5; y < h; y += 5) g.fillRect(hw * 0.27, y, hw * 0.46, 1.5);
  g.fillStyle = '#7f8a6a'; g.fillRect(hw * 0.35, h * 0.02, hw * 0.3, h * 0.05);
  // chamfer face: two mosaic strips and a shuttered slit
  g.fillStyle = '#d5c8a6'; g.fillRect(hw + hw * 0.1, h * 0.12, hw * 0.8, h * 0.84);
  for (const x of [0.16, 0.66]) { const m = g.createLinearGradient(0, 0, 0, h); g.fillStyle = '#6f8f86'; g.fillRect(hw + hw * x, h * 0.2, hw * 0.18, h * 0.62); g.fillStyle = '#b05a46'; for (let y = h * 0.22; y < h * 0.8; y += 6) g.fillRect(hw + hw * x + 2, y, hw * 0.18 - 4, 2); }
  g.fillStyle = '#34353a'; g.fillRect(hw + hw * 0.42, h * 0.25, hw * 0.16, h * 0.6);
  streaks(g, w, h, 12, 7202, 0.1, 40, '70,50,35');
}

function buildRibaudo() {
  initShared();
  const pts = [[RP[0], RP[1]], [RP[2], RP[3]], [RP[4], RP[5]], [RP[6], RP[7]]];
  const y0 = gMin(pts), W = RF.toW;
  const F = frame(RF.O[0], y0, RF.O[1], RF.N[0], RF.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('pwRibBody', 512, 256, [1.9, 2.5], paintRib);
  defMat('pwRibMarble', 64, 64, [2, 2], (g, w, h) => { g.fillStyle = '#a9a69c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 160, 2, 7211, ['rgba(60,60,55,0.18)', 'rgba(240,240,230,0.22)']); });
  begin(y0);
  // plinth in grey marble: octagonal body outline grown by 0.12
  const HX = 1.5, HZ = 1.2, C = 0.55;
  const ring = (gx, gz, c) => [[-gx + c, -gz], [gx - c, -gz], [gx, -gz + c], [gx, gz - c], [gx - c, gz], [-gx + c, gz], [-gx, gz - c], [-gx, -gz + c]].map(p => W(p[0], p[1]));
  prism('pwRibMarble', ring(HX + 0.14, HZ + 0.14, C + 0.1), -0.5, 0.65, { uvo: [0, 0] });
  prism('pwRibMarble', ring(HX + 0.04, HZ + 0.04, C + 0.04), 0.65, 0.75);
  // faces: 2 long door faces (+z, -z), 2 short door faces, 4 chamfers with the mosaic region
  const FH = 2.45, fy = 0.75;
  const face = (cx, cz, ry, wd, doorface) => panel('pwRibBody', wd, FH, { M: mul(F, tr(cx, fy, cz)), ry, uvk: [0.5, 1], uvo: [doorface ? 0 : 0.5, 0], noao: true });
  face(0, HZ, 0, 2 * (HX - C), true); face(0, -HZ, PI, 2 * (HX - C), true);
  face(HX, 0, PI / 2, 2 * (HZ - C), true); face(-HX, 0, -PI / 2, 2 * (HZ - C), true);
  const dg = C * Math.SQRT2;
  face(HX - C / 2, HZ - C / 2, PI / 4, dg, false); face(-HX + C / 2, HZ - C / 2, -PI / 4, dg, false);
  face(HX - C / 2, -HZ + C / 2, 3 * PI / 4, dg, false); face(-HX + C / 2, -HZ + C / 2, -3 * PI / 4, dg, false);
  // body core (so the faces have a back and the roof a base), cream
  prism('flat', ring(HX - 0.02, HZ - 0.02, C), 0.7, fy + FH, { c: '#e2d6b8', noao: true });
  // canopy: rounded rectangle slab 5.05 x 3.9, a thin cream cap, a coffered darker underside, brackets
  const cano = (ax, az, r, y1, y2, c) => { const p = []; const cs = [[ax - r, az - r, 0], [-ax + r, az - r, PI / 2], [-ax + r, -az + r, PI], [ax - r, -az + r, 3 * PI / 2]]; for (const [cx, cz, a] of cs) for (let k = 0; k <= 5; k++) { const t = a + k * PI / 10; p.push(W(cx + r * Math.cos(t), cz + r * Math.sin(t))); } prism('flat', p, y1, y2, { c, noao: true }); };
  cano(2.52, 1.95, 0.9, 3.2, 3.32, '#cdb98f');
  cano(2.5, 1.93, 0.9, 3.32, 3.6, '#e6dabc');
  // brackets (scrolls) under the canopy
  for (const [x, z, ry] of [[0, HZ, 0], [0, -HZ, PI], [HX, 0, PI / 2], [-HX, 0, -PI / 2]]) bx('flat', mul(F, tr(x, 3.0, z)), -0.3, 0.3, 0, 0.2, -0.1, 0.4, { ry, c: '#d9c9a0', noao: true });
  // the pierced balustrade on top between two urn posts (front, the +z side), and the name board over the door
  const posts = [-1.2, 1.2];
  for (const x of posts) { bx('flat', F, x - 0.12, x + 0.12, 3.6, 4.4, 1.55, 1.79, { c: '#e0d1ac', noao: true }); sphere('flat', 0.2, { M: F, p: [x, 4.55, 1.67], seg: 8, c: '#d8c8a2' }); }
  balus(mul(F, tr(0, 3.62, 1.67)), 2.1, 0.7, { noao: true });
  bx('flat', F, -0.8, 0.8, 2.95, 3.2, HZ, HZ + 0.06, { c: '#8a7a52', noao: true });
  const o = end('Chiosco Ribaudo');
  o.userData.solids = [[RP, null, y0 + 3.7]];
  return o;
}
export const RIBAUDO = { name: 'Chiosco Ribaudo', x: RC[0], z: RC[1], radius: 14, skipIds: ['w204272307'], build: buildRibaudo };

// ================================================================================================
// CORNER PALAZZO at the tip of the block w204272306 (veneer on the two street faces seen in the photos)
// ================================================================================================
const PH = 24.8, BAYW = 3.7;
const PA = { a: [-491.6, -934.3], b: [-475.9, -943.2], n: [-0.49, -0.87], bays: 5 };   // short face onto Piazza Castelnuovo, kiosk against it
const PB = { a: [-475.9, -943.2], b: [-454.3, -899.0], n: [0.9, -0.44], bays: 13 };    // long face on the west side of Via Ruggero Settimo

function paintBay(g, w, h) {
  // one bay, BAYW m wide, PH m tall: grey rusticated base (2 levels), then four floors, cornice
  const sx = w / BAYW, sy = h / PH, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const STONE = '#8c8a85', UP = '#d8cf9e', DK = '#5c5e60', SH = '#8a5a3c';
  g.fillStyle = UP; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 30, 1.5, 7301, ['rgba(150,120,70,0.1)', 'rgba(255,250,225,0.1)']);
  // base: two levels of grey stone, 0 to 7.6 m
  R(0, 0, BAYW, 7.6, STONE); for (let y = 0.9; y < 7.6; y += 0.9) R(0, y, BAYW, y + 0.05, 'rgba(40,40,40,0.35)');
  R(0.3, 0.5, BAYW - 0.3, 4.3, '#2b2f33'); R(0.3, 3.9, BAYW - 0.3, 4.3, '#6c6e70'); R(0.3, 4.6, BAYW - 0.3, 4.65, '#444'); R(0.7, 5.1, BAYW - 0.7, 6.9, SH); for (let y = 5.2; y < 6.9; y += 0.18) R(0.7, y, BAYW - 0.7, y + 0.03, 'rgba(30,20,10,0.35)');
  R(-0.01, 7.6, BAYW + 0.01, 8.1, DK); for (let x = 0.2; x < BAYW; x += 0.6) R(x, 7.7, x + 0.3, 7.95, '#8c8f90');   // Greek-key shelf over the base
  // floors: 8.1 to 24.8; floor height 4.0 for the two middle floors, 3.8 for the others
  const FL = [[8.1, 12.4, true], [12.4, 16.7, true], [16.7, 20.6, false], [20.6, 24.0, false]];
  for (const [f0, f1, arched] of FL) {
    const cx = BAYW / 2;
    if (arched) { arch(cx, f0 + 0.9, f1 - 0.45, 1.5, '#c8bd8a'); arch(cx, f0 + 1.0, f1 - 0.55, 1.2, SH); R(cx - 0.02, f0 + 1.0, cx + 0.02, f1 - 1.3, '#4c3020'); R(cx - 0.8, f0 + 0.45, cx + 0.8, f0 + 0.95, DK); for (let x = cx - 0.8; x < cx + 0.8; x += 0.18) R(x, f0 + 0.5, x + 0.05, f0 + 0.95, '#2a2a2c'); R(cx - 0.9, f0 + 0.95, cx + 0.9, f0 + 1.0, '#2a2a2c'); }
    else { R(cx - 0.65, f0 + 0.9, cx + 0.65, f1 - 0.7, '#c8bd8a'); R(cx - 0.55, f0 + 1.0, cx + 0.55, f1 - 0.8, SH); R(cx - 0.8, f0 + 0.5, cx + 0.8, f0 + 0.9, DK); }
    R(0, f1 - 0.1, BAYW, f1, '#c4ba86');   // string course
  }
  // cornice and parapet
  R(0, 24.0, BAYW, 24.8, '#c9bf8c'); R(0, 24.45, BAYW, 24.8, '#b9ae7a');
  R(0, 0, 0.18, 24.8, 'rgba(255,250,225,0.25)'); R(BAYW - 0.14, 0, BAYW, 24.8, 'rgba(60,40,20,0.14)');
  streaks(g, w, h, 8, 7302, 0.12, 60, '70,50,35');
}

function buildPalazzo() {
  initShared();
  defMat('pwCorBay', 128, 512, [BAYW, PH], paintBay);
  const faces = [PA, PB];
  const y0 = Math.min(...faces.flatMap(f => [groundY(...f.a), groundY(...f.b)]));
  begin(y0);
  for (const f of faces) {
    const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], len = Math.hypot(dx, dz);
    const mid = [(f.a[0] + f.b[0]) / 2 + f.n[0] * 0.15, (f.a[1] + f.b[1]) / 2 + f.n[1] * 0.15];
    const F = frame(mid[0], y0, mid[1], f.n[0], f.n[1]);
    // the local +x is to the viewer's right: with the outward normal given, the face runs from the viewer's left end; the bay pattern is symmetric so only the length matters
    panel('pwCorBay', len, PH, { M: mul(F, tr(0, -0.3, 0)), uvk: [f.bays, 1], uvo: [0, 0], noao: false });
  }
  return end('Palazzo angolo Piazza Castelnuovo');
}
export const PALAZZO_ANGOLO = { name: 'Palazzo angolo Piazza Castelnuovo', x: -476, z: -925, radius: 40, skipIds: [], build: buildPalazzo };

export const PIAZZA2 = [KURSAAL, PALAZZO_ANGOLO];   // (the Ribaudo kiosk is in src/lmc-piazza.js)
