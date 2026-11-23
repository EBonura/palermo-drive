// City landmark: the Chiesa di Santa Maria della Pieta (Via Alloro / Via Torremuzza, Kalsa, Palermo), baroque, front finished about 1699. Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49786080. Frame F: origin on the ground in the middle of the short east-north-east edge (21.6 m, the end that looks onto Via Torremuzza), +z out of the front.
// Reference photos (Wikimedia Commons, looked at, nothing copied): "Santa Maria della Pieta (Palermo) 14 07 2019 09.jpg", "Santa Maria della Pieta (Palermo) 14 07 2024 01.jpg", "Santa Maria Pieta.jpg",
// "Kalsa, Palermo, Italy - panoramio (21).jpg", "Via torremuzza.jpg", "Crèsia di Santa Marìa dâ Piatati.jpg".
// Read from them: a front of honey-brown tufa with white marble columns in two orders; lower order three columns each side (a pair beside the portal, one on the outside) on tall plinths, a big door in a surround with a curved hood
// and cartouche, a statue on a globe over it, a shell niche with a statue between pair and outer column and another outside the outer one, a round window over each of the two inner niches;
// upper order narrower, three columns each side (a pair and a single), a big round window in an ornate frame over an inscription plate, a niche with a statue each side, barred windows, scrolls joining the orders,
// a broken crown with a small triangular pediment in the middle. The long side is a plain ochre wall without pilasters, lower than the front, with two rows of windows.
// Not verified, not drawn: any dome (none is visible from the street in the photos), the real nave roof (a flat cap stands for it), the back of the church, the carved ornament (painted as light shapes).
import * as THREE from 'three';
import { PI, bx, cyl, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange } from './lmc-kit.js';

const PT = { id: 'w49786080', p: [889.7, -129.5, 897.3, -114.4, 898, -114.7, 898.1, -114.2, 898.9, -114.6, 903.6, -116.8, 905.2, -113, 948.4, -135.1, 938.5, -154.3] };
const O = [943.45, -144.7], N = [0.8888, -0.4583];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {   // the footprint cut off where it stands out in front of the front (Sutherland-Hodgman against z = zmax, keeping z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 21.6, FH = 25.7, EAVE = 16.0, PL = 4.6, LE = 14.8, LT = 17.4, UP = 19.0, UC = 22.9, UT = 23.7, SIDE_T = 18.4;
const TUFA = '#b98f5e', JOINT = '#8c6b47', STONEL = '#d2c3a2', DARK = '#1f1a16', GLASS = '#252c38', MARB = '#dedacd';

function paintFront(g, w, h) {   // 21.6 x 25.7 m, y up from the ground
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const statue = (x, y0, hh) => { g.fillStyle = '#d6cdb9'; g.beginPath(); g.moveTo(X(x - 0.42), Y(y0)); g.lineTo(X(x - 0.3), Y(y0 + hh * 0.62)); g.lineTo(X(x + 0.3), Y(y0 + hh * 0.62)); g.lineTo(X(x + 0.42), Y(y0)); g.fill(); circ(x, y0 + hh * 0.78, 0.2, '#d6cdb9'); R(x - 0.3, y0 + hh * 0.62, x + 0.3, y0 + hh * 0.7, '#d6cdb9'); };
  const niche = (x, y0, y1, ww) => { arch(x, y0 - 0.25, y1 + 0.35, ww + 0.45, STONEL); arch(x, y0, y1, ww, '#5d4630'); g.fillStyle = '#c9b793'; g.beginPath(); g.ellipse(X(x), Y(y1 - ww * 0.25), ww * 0.3 * sx, ww * 0.22 * sy, 0, PI, 0); g.fill(); statue(x, y0 + 0.2, (y1 - y0) * 0.62); };
  paintAshlar(g, w, h, FW, FH, 0.5, 1.2, TUFA, JOINT, 5201, 1.0, 0.07);
  for (let i = 0; i < 7; i++) { const cx = X(-9 + i * 3), cy = Y(3 + (i % 4) * 5.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4.5 * sx); gr.addColorStop(0, 'rgba(60,40,25,0.2)'); gr.addColorStop(1, 'rgba(60,40,25,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // pale marble panels on the plinths, the entablature and the crown
  for (const x of [-8.0, -4.05, 4.05, 8.0]) { const ww = Math.abs(x) > 6 ? 1.2 : 2.5; R(x - ww / 2, 0.8, x + ww / 2, PL - 0.4, '#c9c4b4'); R(x - ww / 2 + 0.1, 0.9, x + ww / 2 - 0.1, PL - 0.5, '#d6d1c2'); }
  // the portal: green door of square panels, a stone surround, a curved hood over a cartouche, a statue on a globe
  R(-2.5, 0, 2.5, 9.3, STONEL); R(-2.3, 0, 2.3, 9.1, '#8d7b5f'); R(-1.85, 0, 1.85, 8.3, '#66775a');
  g.strokeStyle = 'rgba(25,40,25,0.7)'; g.lineWidth = 1.4; for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) { const x0 = -1.7 + i * 0.85, y0 = 0.25 + j * 1.1; g.strokeRect(X(x0), Y(y0 + 0.9), 0.7 * sx, 0.9 * sy); }
  R(-0.04, 0, 0.04, 8.3, '#20301f');
  g.fillStyle = STONEL; g.beginPath(); g.moveTo(X(-3.0), Y(9.2)); g.lineTo(X(-3.0), Y(10.4)); g.ellipse(X(0), Y(10.4), 3.0 * sx, 1.9 * sy, 0, PI, 0); g.lineTo(X(3.0), Y(9.2)); g.fill();
  g.fillStyle = '#8f7d60'; g.beginPath(); g.moveTo(X(-2.5), Y(9.3)); g.lineTo(X(-2.5), Y(10.3)); g.ellipse(X(0), Y(10.3), 2.5 * sx, 1.3 * sy, 0, PI, 0); g.lineTo(X(2.5), Y(9.3)); g.fill();
  circ(0, 10.0, 0.8, '#d9d0bc'); circ(0, 10.0, 0.5, '#a89878'); R(-0.5, 9.3, 0.5, 9.6, '#d9d0bc');
  circ(0, 12.35, 0.62, '#cfc6b0'); statue(0, 12.8, 2.2);
  // niches with statues between the pair and the outer column, and outside the outer column; a round window over each inner niche
  for (const s of [-1, 1]) { niche(s * 6.55, 5.7, 10.6, 1.5); niche(s * 9.85, 6.0, 10.4, 1.2); circ(s * 6.55, 12.3, 1.0, STONEL); circ(s * 6.55, 12.3, 0.78, '#6b5a43'); circ(s * 6.55, 12.3, 0.62, GLASS); }
  // the lower entablature and the string course under the upper order
  R(-FW / 2, LE, FW / 2, LT, '#a98258'); R(-FW / 2, LE + 1.25, FW / 2, LE + 1.4, 'rgba(250,235,205,0.35)'); R(-FW / 2, LT - 0.15, FW / 2, LT, 'rgba(40,28,18,0.45)');
  for (let x = -FW / 2 + 0.5; x < FW / 2 - 0.3; x += 0.9) R(x, LT - 0.8, x + 0.4, LT - 0.2, 'rgba(60,40,25,0.4)');   // the dentils
  // the upper order: the plate with its inscription, the big round window in an ornate frame, niches, windows
  R(-1.9, 17.55, 1.9, 18.35, STONEL); R(-1.7, 17.7, 1.7, 17.75, '#6d5a42'); R(-1.7, 17.95, 1.7, 18.0, '#6d5a42'); R(-1.7, 18.2, 1.7, 18.25, '#6d5a42');
  g.fillStyle = '#c7b48f'; g.beginPath(); g.ellipse(X(0), Y(19.9), 2.8 * sx, 2.5 * sy, 0, 0, 2 * PI); g.fill();
  for (const s of [-1, 1]) { circ(s * 2.4, 18.7, 0.55, '#cdbb97'); circ(s * 2.2, 21.2, 0.5, '#cdbb97'); circ(s * 1.1, 21.7, 0.45, '#cdbb97'); }
  circ(0, 19.9, 1.9, STONEL); circ(0, 19.9, 1.6, '#a68c64'); circ(0, 19.9, 1.35, GLASS);
  g.strokeStyle = '#8c6e4d'; g.lineWidth = 1.2; for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(Math.cos(a) * 0.25), Y(19.9 + Math.sin(a) * 0.25)); g.lineTo(X(Math.cos(a) * 1.35), Y(19.9 + Math.sin(a) * 1.35)); g.stroke(); }
  arch(0, 21.9, 23.3, 1.4, STONEL); arch(0, 22.0, 23.2, 1.0, '#3a3430'); g.strokeStyle = 'rgba(120,110,95,0.6)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(X(i * 0.2), Y(22.0)); g.lineTo(X(i * 0.2), Y(23.0)); g.stroke(); }
  for (const s of [-1, 1]) { niche(s * 4.85, 18.9, 21.9, 1.3); R(s * 5.5 - 0.6, 22.2, s * 5.5 + 0.6, 23.3, STONEL); R(s * 5.5 - 0.45, 22.35, s * 5.5 + 0.45, 23.2, '#2c2824'); g.strokeStyle = 'rgba(130,120,105,0.6)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(X(s * 5.5 + i * 0.2), Y(22.35)); g.lineTo(X(s * 5.5 + i * 0.2), Y(23.2)); g.stroke(); } }
  // the scrolls that join the orders, and the crown
  for (const s of [-1, 1]) { circ(s * 8.9, 19.7, 0.85, '#c9b690'); circ(s * 8.9, 19.7, 0.55, '#8f7655'); circ(s * 8.9, 19.7, 0.28, '#c9b690'); g.fillStyle = '#c0aa82'; g.beginPath(); g.moveTo(X(s * 9.7), Y(SIDE_T)); g.quadraticCurveTo(X(s * 9.2), Y(20.3), X(s * 7.6), Y(21.8)); g.lineTo(X(s * 7.6), Y(SIDE_T)); g.fill(); }
  R(-7.6, UC, 7.6, UT, '#a98258'); R(-7.6, UT - 0.15, 7.6, UT, 'rgba(40,28,18,0.45)');
  g.fillStyle = '#b79a6c'; g.beginPath(); g.moveTo(X(-3.2), Y(UT)); g.lineTo(X(0), Y(25.5)); g.lineTo(X(3.2), Y(UT)); g.fill();
  R(-1.0, 23.9, 1.0, 24.5, '#2c2824');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3.5)); gb.addColorStop(0, 'rgba(25,18,10,0.35)'); gb.addColorStop(1, 'rgba(25,18,10,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.5), w, 3.5 * sy);
  streaks(g, w, h, 36, 5202, 0.1, 110, '55,40,28');
}
function paintWall(g, w, h) {   // a side bay, 5 m wide, EAVE m tall: ochre plaster with two rows of windows and a cornice
  const sx = w / 5, sy = h / EAVE, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#c3a176'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, 5211, ['rgba(110,80,50,0.12)', 'rgba(240,220,185,0.12)', 'rgba(70,55,40,0.1)']);
  R(0, 0, 5, 1.1, '#a38762');
  for (const [y0, y1] of [[4.2, 6.4], [9.4, 11.8]]) { R(1.7, y0 - 0.15, 3.3, y1 + 0.2, '#d0bb92'); R(1.85, y0, 3.15, y1, '#2d2a28'); R(2.45, y0, 2.55, y1, '#7b6a52'); }
  R(1.55, 4.05, 3.45, 4.2, '#b9a47c');
  R(0, EAVE - 0.8, 5, EAVE, '#cdb78d'); R(0, EAVE - 1.0, 5, EAVE - 0.8, 'rgba(40,28,18,0.3)');
  streaks(g, w, h, 9, 5212, 0.12, 90, '60,45,30');
}

function buildPieta() {
  initShared();
  const pts = pairsOf(PT.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-6, 3)), groundY(...W(6, 3)), groundY(...W(0, 5)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('pdFront', 512, 512, [FW, FH], paintFront);
  defMat('pdWall', 128, 384, [5, EAVE], paintWall);
  begin(y0);
  const body = clipFront(pts, -0.6);
  prism('pdWall', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9a9084' });
  // the front: one shape (the wide lower order, the narrower upper order, the scrolls and the crown with a small pediment) with the painted face on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, SIDE_T); s.lineTo(9.6, SIDE_T); s.quadraticCurveTo(9.2, 20.3, 7.6, 21.8); s.lineTo(7.6, 24.4); s.lineTo(3.2, 24.4); s.lineTo(0, FH); s.lineTo(-3.2, 24.4); s.lineTo(-7.6, 24.4); s.lineTo(-7.6, 21.8);
  s.quadraticCurveTo(-9.2, 20.3, -9.6, SIDE_T); s.lineTo(-hw, SIDE_T); s.lineTo(-hw, 0);
  extrude('pdFront', s, 0.6, { M: at(0, 0, -0.6), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // the real depth of the orders: plinths, white marble columns with capitals, broken entablatures
  const col = (x, yb, yt, r, z) => { cyl('marble', r * 0.92, r, yt - yb, 12, { M: at(x, yb, z), c: '#ebe8de' }); bx('flat', F, x - r * 1.45, x + r * 1.45, yt, yt + 0.8, z - r * 1.45, z + r * 1.45, { c: '#c8b48a', noao: true }); bx('flat', F, x - r * 1.25, x + r * 1.25, yb - 0.15, yb, z - r * 1.25, z + r * 1.25, { c: '#d9d3c2', noao: true }); };
  for (const sg of [-1, 1]) {
    for (const [cx, w] of [[sg * 8.0, 2.1], [sg * 4.0, 3.7]]) { bx('flat', F, cx - w / 2, cx + w / 2, 0.4, PL, -0.1, 1.3, { c: '#c5b896', noao: true }); bx('flat', F, cx - w / 2 - 0.12, cx + w / 2 + 0.12, PL, PL + 0.28, -0.1, 1.42, { c: '#d3c8aa', noao: true }); }
    for (const x of [sg * 8.0, sg * 4.8, sg * 3.2]) col(x, PL + 0.28, LE - 0.8, 0.65, 0.75);
    for (const [cx, w] of [[sg * 5.7, 1.5], [sg * 3.12, 2.35]]) bx('flat', F, cx - w / 2, cx + w / 2, LT, UP - 0.2, -0.1, 0.8, { c: '#c5b896', noao: true });
    for (const x of [sg * 5.7, sg * 3.7, sg * 2.55]) col(x, UP - 0.2, UC - 0.8, 0.45, 0.5);
  }
  bx('flat', F, -hw - 0.1, hw + 0.1, LE, LE + 1.3, -0.1, 0.55, { c: '#bd9f72', noao: true });      // architrave and frieze
  bx('flat', F, -hw - 0.2, hw + 0.2, LE + 1.3, LT, -0.1, 1.2, { c: '#bfa175', noao: true });       // the cornice, standing out
  bx('flat', F, -7.7, 7.7, UC - 0.8, UC, -0.1, 0.5, { c: '#bd9f72', noao: true });
  bx('flat', F, -7.8, 7.8, UC, UT, -0.1, 0.9, { c: '#bfa175', noao: true });
  bx('flat', F, -3.4, 3.4, 24.4, 24.7, -0.1, 0.5, { c: '#bfa175', noao: true });
  // the front steps
  for (let i = 0; i < 3; i++) bx('stone', F, -hw + 0.5 - i * 0.15, hw - 0.5 + i * 0.15, -0.35, 0.17 * (3 - i), 1.2, 1.2 + 0.4 * (i + 1), { c: '#c8bfa9' });
  const o = end('Chiesa di Santa Maria della Pieta');
  o.userData.solids = [[PT.p, null, y0 + EAVE]];
  return o;
}
export const PIETA = { name: 'Chiesa di Santa Maria della Pieta', x: 915, z: -135, radius: 45, skipIds: [PT.id], build: buildPieta };
