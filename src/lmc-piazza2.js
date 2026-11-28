// City landmarks around Piazza Ruggero Settimo / Piazza Castelnuovo (Palermo), drawn from reference photos. Registered in src/landmarks-city.js as PIAZZA2.
// Reference photos (Wikimedia Commons, looked at, nothing copied, only proportions and colours read):
//   Kursaal Biondo (w215618518, OSM name "Kursaal Biondo"): "Kursaal Biondo.jpg" (frontal from above, whole front and both end piers),
//     "Palermo-AP-p1070702.jpg" (frontal at street level, centre bay). Read: a 22.4 m wide front of cream plaster and golden ochre stone, four piers (two wide end piers
//     with a green rosette cap, two inner piers taller with a garland cap), two side panels each with one pedimented window, a central bay with an arched portal (archivolt, two
//     flanking pilasters), two tall windows beside it, a main cornice with a red frieze lettered TEATRO NAZIONALE BIONDO 1914, a balustrade with two statues, above it a pedimented
//     group of three windows, then a stepped gable wall with a red rake band, two round windows in stepped panels, and a small block on the ridge carrying an open steel frame with four discs;
//     wrought iron lamps on the four piers, flower boxes on the terraces, posters and a lower board either side of the portal, the name over the glazed door. Heights relative to the width
//     (22.4 m): main cornice 0.40, inner pier caps 0.50, eaves of the gable wall 0.66, ridge 0.77, ridge block 0.84. The roof is seen only from the air (Regione Siciliana
//     orthophoto: faded terracotta tiles, pale piers along both long eaves). The flanks are not visible and stay plain. The pictures on the posters are not reproduced.
//   Corner palazzo at the tip of the block w204272306 (found by position: the kiosk stands against it): "Piazza Ruggero Settimo - Palermo - panoramio - kajikawa (3).jpg" (2002, grey-green,
//     the corner seen from Piazza Castelnuovo) and "Chiosco Ribaudo Palermo1.jpg" (recent, cream with a grey rusticated base). Read: a grey stone shop base of two levels, then four floors of
//     shuttered windows, arched windows with balconies on the two middle floors, Greek-key railings and a Greek-key balcony shelf over the base, a cornice and a roof terrace. Bay counts
//     (5 on the short face, 13 on the long one) are counted from the 2002 photo and are approximate. Only the two street faces seen in the photos are drawn, as a veneer 0.15 m
//     off the generic wall; the rest of the block stays generic.
// Not identified from photos and therefore not built: the other palazzi around the two squares (see the report).
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, extrude, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, groundRange, gable, statue, panel, balus, paintAshlar } from './lmc-kit.js';

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
    const tx = s * 3.15; R(tx - 0.7, 4.8, tx + 0.7, 7.5, DARKW); R(tx - 0.72, 4.8, tx - 0.62, 7.5, OCH); R(tx + 0.62, 4.8, tx + 0.72, 7.5, OCH);
    for (let y = 5.7; y < 7.3; y += 0.9) R(tx - 0.7, y, tx + 0.7, y + 0.06, '#4a515b');
    for (const dx of [-0.23, 0.23]) R(tx + dx - 0.025, 4.8, tx + dx + 0.025, 7.5, '#4a515b');
    // a framed poster (a yellow sheet, a figure shape, the name on a white band) and a smaller board under it
    const px_ = s * 3.0, word = (t, y, px, c) => { g.fillStyle = c; g.font = 'bold ' + Math.round(px * sy) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(t, X(px_), Y(y), 1.1 * sx); };
    R(px_ - 0.68, 1.9, px_ + 0.68, 4.35, '#2c3036'); R(px_ - 0.6, 1.98, px_ + 0.6, 4.27, '#e2b23c');
    g.fillStyle = s < 0 ? '#c4607a' : '#45689a'; g.beginPath(); g.ellipse(X(px_), Y(3.35), 0.3 * sx, 0.55 * sy, s * 0.25, 0, 2 * PI); g.fill(); g.fillStyle = '#c99a7c'; g.beginPath(); g.arc(X(px_ + s * 0.1), Y(3.95), 0.2 * sx, 0, 2 * PI); g.fill();
    R(px_ - 0.6, 2.35, px_ + 0.6, 2.85, '#f1ead8'); word('KURSAAL', 2.48, 0.3, '#8e2c24');
    R(px_ - 0.68, 0.98, px_ + 0.68, 1.72, '#2c3036'); R(px_ - 0.6, 1.05, px_ + 0.6, 1.65, '#ecdfae'); word('SALA BINGO', 1.22, 0.24, '#2f3a52');
    // round window in a stepped panel on the gable wall
    const rx = s * 6.5, ry = 12.4; R(rx - 1.3, ry - 1.3, rx + 1.3, ry + 1.3, '#d3b684'); R(rx - 0.95, ry - 0.95, rx + 0.95, ry + 0.95, CREAM); g.fillStyle = OCH; g.beginPath(); g.arc(X(rx), Y(ry), 0.78 * sx, 0, 2 * PI); g.fill(); g.fillStyle = DARKW; g.beginPath(); g.arc(X(rx), Y(ry), 0.58 * sx, 0, 2 * PI); g.fill();
    // portal columns
    pier(s * 1.7 + (s > 0 ? 0 : -0.6), s * 1.7 + (s > 0 ? 0.6 : 0), 1.0, 7.3);
  }
  // portal
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  arch(0, 1.0, 7.4, 4.0, OCH); arch(0, 1.0, 7.0, 3.1, '#c39a62'); arch(0, 1.0, 6.82, 2.75, '#232a31');
  g.strokeStyle = '#6d7782'; g.lineWidth = 0.05 * sx; for (const a of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(X(0), Y(5.45)); g.lineTo(X(-Math.cos(a * PI) * 1.37), Y(5.45 + Math.sin(a * PI) * 1.37)); g.stroke(); }
  g.beginPath(); g.arc(X(0), Y(5.45), 0.7 * sx, PI, 0); g.stroke(); R(-1.38, 5.4, 1.38, 5.48, '#6d7782');
  R(-1.38, 4.45, 1.38, 5.3, '#3b4046'); g.fillStyle = '#eef0ee'; g.font = 'italic ' + Math.round(0.62 * sy) + 'px Georgia, serif'; g.textAlign = 'center'; g.fillText('Kursaal', X(-0.3), Y(4.66), 1.7 * sx); R(0.78, 4.6, 1.18, 5.15, '#d8dce2'); R(0.84, 4.72, 1.12, 5.0, '#b23b30');
  R(-1.38, 3.75, 1.38, 4.4, '#15171a'); R(-1.38, 1.0, 1.38, 3.72, '#1e2226'); for (const x of [-1.34, -0.7, -0.02, 0.66, 1.3]) R(x, 1.0, x + 0.05, 3.7, '#59606a'); R(-1.38, 3.0, 1.38, 3.06, '#59606a');
  for (const x of [-0.5, 0.18]) R(x, 1.3, x + 0.34, 2.9, 'rgba(150,175,190,0.16)');
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
  defMat('pwKurRoof', 64, 64, [2.4, 2.4], (g, w, h) => { g.fillStyle = '#c09a82'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 150, 2.2, 7131, ['rgba(150,90,60,0.20)', 'rgba(232,210,180,0.24)', 'rgba(90,80,66,0.12)']); g.fillStyle = 'rgba(100,60,40,0.22)'; for (let y = 3; y < h; y += 8) g.fillRect(0, y, w, 1); });
  defMat('pwKurStone', 128, 128, [2.2, 2.2], (g, w, h) => paintAshlar(g, w, h, 2.2, 2.2, 0.7, 1.1, '#d6ad70', '#a07a46', 7121, 1.5, 0.05));
  begin(y0);
  const lo = Math.min(gr.lo, y0) - y0 - 1.5, hw = KW / 2;
  // body: the lower block over the whole footprint, the hall above it, the gable roof (roof not visible in any photo)
  bx('pwKurWall', F, -hw, hw, lo, KCORN, -KD, -0.3);
  bx('pwKurWall', F, -KHALL, KHALL, KCORN, KEAVE, -KD, -0.3);
  gable('pwKurRoof', 'pwKurWall', at(0, 0, -KD / 2 - 0.15), KHALL * 2, KD - 0.9, KEAVE, KRIDGE - KEAVE, { ov: 0.3, wc: '#dfcfa6' });   // (its front edge stops behind the gable wall, whose red rake band shows)
  bx('flat', F, -0.22, 0.22, KRIDGE + 0.08, KRIDGE + 0.26, -KD + 0.3, -0.6, { c: '#d6c3ac', noao: true });   // the pale ridge
  for (const sg of [-1, 1]) for (let z = -5; z > -KD + 1; z -= 5.4) bx('flat', F, sg * (KHALL - 0.15), sg * (KHALL + 0.45), KCORN, KEAVE + 0.45, z - 0.35, z + 0.35, { c: '#e4d8bc', noao: true });   // the piers along the long sides (orthophoto)
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
  // the open steel frame with four discs over the ridge block
  const IRON = { c: '#4a4c50', noao: true };
  for (const y of [KTOP + 0.5, KTOP + 1.2]) bx('flat', F, -3.0, 3.0, y, y + 0.08, -0.34, -0.26, IRON);
  for (const x of [-2.96, -1.5, 0, 1.5, 2.96]) bx('flat', F, x - 0.04, x + 0.04, Math.abs(x) > 2 ? KTOP + 0.5 : KTOP, KTOP + 1.28, -0.34, -0.26, IRON);
  for (const x of [-2.1, -0.7, 0.7, 2.1]) cyl('flat', 0.4, 0.4, 0.07, 10, { M: F, p: [x, KTOP + 0.72, -0.24], rx: PI / 2, c: '#e8e6de', noao: true });
  // the wrought iron lamps on the four piers: an arm, a cage and a bell shade with its globe
  for (const x of [-10.05, -4.68, 4.68, 10.05]) {
    box('flat', 0.07, 0.07, 0.62, { M: F, p: [x, 7.35, 0.6], ...IRON });
    for (const dy of [6.95, 7.55]) box('flat', 0.62, 0.06, 0.08, { M: F, p: [x, dy, 0.38], ...IRON });
    for (const dx of [-0.3, 0, 0.3]) box('flat', 0.05, 0.66, 0.06, { M: F, p: [x + dx, 6.95, 0.38], ...IRON });
    box('flat', 0.04, 0.8, 0.04, { M: F, p: [x, 6.58, 0.88], ...IRON });
    cone('flat', 0.27, 0.32, 8, { M: F, p: [x, 6.28, 0.88], ...IRON }); box('flat', 0.2, 0.16, 0.2, { M: F, p: [x, 6.14, 0.88], c: '#f2eedc', noao: true });
  }
  // flower boxes along the two terraces, and the small merlons of the middle parapet
  for (const x of [-8.1, -7.0, -5.9, 5.9, 7.0, 8.1]) bx('flat', F, x - 0.38, x + 0.38, 9.15, 9.5, -0.02, 0.34, { c: '#a8624a', noao: true });
  for (const x of [-1.05, 0, 1.05]) bx('flat', F, x - 0.38, x + 0.38, 9.95, 10.22, -0.04, 0.24, { c: '#a8624a', noao: true });
  for (let x = -3.5; x <= 3.51; x += 0.7) if (Math.abs(Math.abs(x) - 2.1) > 0.45 && Math.abs(x) > 1.5) bx('flat', F, x - 0.14, x + 0.14, 9.93, 10.3, 0.05, 0.27, { c: '#d8c79c', noao: true });
  const o = end('Kursaal Biondo');
  o.userData.solids = [[KP, null, y0 + KRIDGE]];
  return o;
}
export const KURSAAL = { name: 'Kursaal Biondo', x: -385, z: -961, radius: 36, skipIds: ['w215618518'], build: buildKursaal };

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
