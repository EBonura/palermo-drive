// City landmark: the Chiesa del Gesu (Casa Professa), Piazza Casa Professa, Palermo. Registered in src/landmarks-city.js.
// It replaces the OSM footprint w332578307 (a stepped lidar outline). Frame F: origin on the ground in the middle of the front, +z out of the front (north-north-west onto the piazza), local x along the front.
// Front direction taken from the footprint (a flat run of the outline 27.9 m wide, with the walls stepping back 8 to 9 m at each end) and from the piazza in the top-down shot, not from the automatic detector.
// Reference photos (Wikimedia Commons, looked at, nothing copied): Casa Professa (Palermo) - Facciata1.JPG; Chiesa del Gesù di Casa Professa.jpg (not retrievable here, rate limited); Palermo, église du Gesù (façade).JPG (not retrievable here).
// Read from the first photo: a plastered front in warm cream with tan stone pilasters, in two orders. Lower order: corner pilaster each end and a pair of pilasters on each side of the middle,
// three portals (a tall middle one with a pedimented surround, a Madonna niche and a JESUS tablet over it; a small pedimented door each side with a round-arched statue niche over it),
// a heavy entablature. Upper order: a narrow nave front with a pair of pilasters each side, one window with a pediment, a cornice, a low pediment with a shield (IHS, crown) and scrolls,
// and a big concave scroll each side that joins the upper order to the lower cornice, a statue at the foot of each scroll. Behind: a drum and a dome in blue and yellow majolica with a small lantern.
// Heights relative to the width (27.9 m): lower cornice about 0.47, upper cornice about 0.71, pediment top about 0.88. Not known and not drawn: the exact position of the dome along the nave (put over the crossing by eye), the apse and chapel roofs (flat), the inscriptions.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue } from './lmc-kit.js';

const GP = { id: 'w332578307', p: [41.5, 296.1, 46.8, 304.9, 49.1, 303.5, 54.1, 311.8, 57.8, 318.2, 48.1, 319.5, 47.2, 318.8, 45.9, 318.1, 43.8, 319.3, 45.9, 322.9, 49.2, 328.5, 49.4, 330.8, 49.5, 332.9, 49.7, 335.1, 49.8, 336.6, 49, 338.3, 47.4, 339.7, 45.1, 340.4, 42.7, 339.8, 40.6, 338.4, 37.8, 336.5, 35.4, 333.3, 24, 341.5, 2.3, 312, -7.5, 299, -1.1, 294.3, -6.2, 287.5, 0.7, 282.5, 3, 280.9, 5.5, 279.1, 6.3, 278.4, 11.7, 274.8, 16.7, 271.5, 22, 279.3, 28.2, 275.1, 29.8, 277.6, 33.6, 283.4] };
const O = [5.183, 279.455], N = [-0.5707, -0.8211];
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
const FW = 27.9, FH = 24.6, LOW = 13.0, UPC = 19.7, EAVE = 13.0, NAVE_TOP = 20.0, NW = 6.4, NZ0 = -1.5, NZ1 = -54, RISE = 4.0, DZ = -27;
const CREAM = '#e8d29c', PIL = '#a9784c', PILH = '#c79d6c', DARK = '#1b1612', GLASS = '#26303a';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 60, 2, 5101, ['rgba(150,110,60,0.07)', 'rgba(255,245,215,0.08)', 'rgba(120,80,50,0.05)']);
  for (let i = 0; i < 6; i++) { const cx = X(-11 + i * 4.4), cy = Y(5 + (i % 3) * 7), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 5 * sx); gr.addColorStop(0, 'rgba(170,120,70,0.16)'); gr.addColorStop(1, 'rgba(170,120,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.9, '#a98259');
  const pil = (x, y0, y1, ww) => { R(x - ww / 2, y0, x + ww / 2, y1, PIL); R(x - ww / 2, y0, x - ww / 2 + 0.12, y1, 'rgba(255,235,190,0.35)'); R(x + ww / 2 - 0.14, y0, x + ww / 2, y1, 'rgba(60,35,20,0.32)'); R(x - ww / 2 - 0.15, y1 - 0.5, x + ww / 2 + 0.15, y1, PILH); R(x - ww / 2 - 0.1, y0, x + ww / 2 + 0.1, y0 + 0.4, PILH); };
  // lower order
  for (const s of [-1, 1]) { pil(s * 12.9, 0.9, LOW - 1.6, 2.1); pil(s * 4.8, 0.9, LOW - 1.6, 1.5); pil(s * 7.4, 0.9, LOW - 1.6, 1.5); }
  R(-FW / 2, LOW - 1.7, FW / 2, LOW, PIL); R(-FW / 2, LOW - 1.7, FW / 2, LOW - 1.55, 'rgba(60,35,20,0.4)'); R(-FW / 2, LOW - 0.4, FW / 2, LOW, PILH); R(-FW / 2, LOW - 1.15, FW / 2, LOW - 0.85, '#a97a4f');
  // main portal: a tall door, a pedimented surround, the Madonna niche and the JESUS tablet
  R(-1.9, 0.9, 1.9, 5.9, '#d9c89a'); R(-1.5, 0.9, 1.5, 5.4, '#4a3321'); R(-0.04, 0.9, 0.04, 5.4, '#2a1d12'); R(-1.7, 5.4, 1.7, 5.9, '#c9ad7c'); tri(-2.4, 2.4, 5.9, 1.3, '#d9c89a'); tri(-1.8, 1.8, 6.0, 0.9, '#bda070');
  R(-1.7, 6.95, 1.7, 7.3, '#c9ad7c'); R(-1.3, 7.3, 1.3, 7.75, '#e6ddc6'); arch(0, 7.75, 11.0, 2.3, '#cdbd96'); arch(0, 7.85, 10.8, 1.9, '#2e3a46'); R(-0.5, 7.85, 0.5, 9.2, '#e8e2d2'); circ(0, 9.9, 0.34, '#e8e2d2');
  // side doors and the statue niches over them
  for (const s of [-1, 1]) {
    const x = s * 10.1;
    R(x - 1.2, 0.9, x + 1.2, 3.5, '#d9c89a'); R(x - 0.85, 0.9, x + 0.85, 3.2, '#3e2b1c'); tri(x - 1.55, x + 1.55, 3.5, 0.9, '#d9c89a'); tri(x - 0.95, x + 0.95, 3.6, 0.5, '#bda070');
    R(x - 0.55, 4.5, x + 0.55, 4.8, '#c9ad7c'); arch(x, 5.6, 10.2, 2.1, '#b78758'); arch(x, 5.8, 10.0, 1.7, '#a38a66'); R(x - 0.3, 6.2, x + 0.3, 8.8, '#e2dccb'); circ(x, 9.1, 0.32, '#e2dccb'); R(x - 1.2, 5.45, x + 1.2, 5.8, '#b78758');
  }
  // upper order
  for (const s of [-1, 1]) { pil(s * 3.8, LOW, UPC - 0.9, 1.1); pil(s * 5.6, LOW, UPC - 0.9, 1.1); }
  R(-6.4, UPC - 0.95, 6.4, UPC + 0.1, PIL); R(-6.7, UPC + 0.1, 6.7, UPC + 0.9, PILH);
  R(-1.7, 14.1, 1.7, 18.6, '#b78758'); R(-1.35, 14.45, 1.35, 18.0, GLASS); R(-0.04, 14.45, 0.04, 18.0, '#8a6a45'); R(-0.8 - 0.8, 16.2, 1.6, 16.3, '#8a6a45'); tri(-2.1, 2.1, 18.6, 0.8, '#b78758'); R(-2.0, 13.8, 2.0, 14.1, '#b78758');
  // pediment (cut by the outline) with the shield
  tri(-7.0, 7.0, UPC + 0.9, 3.2, '#cfa774'); tri(-5.9, 5.9, UPC + 1.2, 2.5, CREAM);
  circ(0, 22.3, 1.1, '#e8e0cf'); circ(0, 22.3, 0.85, '#d1c7ae'); R(-0.1, 21.9, 0.1, 22.8, '#6b5a44'); R(-0.5, 22.4, 0.5, 22.55, '#6b5a44');
  // soft shadows and dirt
  for (const y of [LOW, UPC + 0.1]) { const gs = g.createLinearGradient(0, Y(y - 1.7), 0, Y(y - 3.4)); gs.addColorStop(0, 'rgba(50,30,15,0.28)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y - 1.7), w, 1.7 * sy); }
  streaks(g, w, h, 34, 5102, 0.09, 110, '70,50,35');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay, 4.5 m wide: warm plaster, a pilaster half at each edge, an arched window high up (nave) or a small one (body), a cornice
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = '#dcc48c'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, seed, ['rgba(150,110,60,0.08)', 'rgba(255,245,215,0.08)']);
  R(0, 0, 0.55, hm, PIL); R(3.95, 0, 4.5, hm, PIL);
  if (win) { arch(2.25, hm - 5.6, hm - 1.4, 1.7, '#b78758'); arch(2.25, hm - 5.35, hm - 1.65, 1.2, GLASS); }
  else { R(0, 0, 4.5, 1.0, '#a98259'); arch(2.25, 5.2, 9.0, 1.4, '#b78758'); arch(2.25, 5.4, 8.8, 1.0, GLASS); }
  R(0, hm - 0.7, 4.5, hm, PILH); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(50,30,15,0.28)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '70,50,35');
}

function buildGesu() {
  initShared();
  const pts = pairsOf(GP.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-12, 2)), groundY(...W(12, 2)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('gsFront', 512, 448, [FW, FH], paintFront);
  defMat('gsBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 5121));
  defMat('gsNave', 128, 256, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 5131));
  defMat('gsDome', 128, 128, [1, 1], (g, w, h) => { g.fillStyle = '#2f8aa0'; g.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { if ((i + j) % 2) { g.fillStyle = '#e8bf3a'; g.beginPath(); g.moveTo(i * 16 + 8, j * 16); g.lineTo(i * 16 + 16, j * 16 + 8); g.lineTo(i * 16 + 8, j * 16 + 16); g.lineTo(i * 16, j * 16 + 8); g.fill(); } } noiseDots(g, w, h, 300, 2, 5141, ['rgba(255,255,255,0.1)', 'rgba(0,30,40,0.1)']); });
  begin(y0);
  const body = clipFront(pts, -0.1);
  prism('gsBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  // the nave: a gable roof in front of the crossing and another behind it, a flat piece under the drum between them
  const nz = (a, b) => ({ z0: a, z1: b });
  bx('gsNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  for (const { z0, z1 } of [nz(NZ0, DZ + 8.5), nz(DZ - 8.5, NZ1)]) gable('tile', 'gsNave', at(0, 0, (z0 + z1) / 2), NW * 2, z0 - z1, NAVE_TOP, RISE, { ov: 0.35, c: '#b8744f', wc: '#dcc48c' });
  bx('flat', F, -NW - 0.3, NW + 0.3, NAVE_TOP, NAVE_TOP + 0.2, DZ - 8.5, DZ + 8.5, { c: '#a39a8c' });
  // the front: one shape (lower order, concave scrolls, upper order, pediment) with the painted face on it
  const hw = FW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, LOW); s.lineTo(11.4, LOW); s.bezierCurveTo(8.6, LOW + 0.2, 6.5, LOW + 2.8, 6.5, UPC - 0.4); s.lineTo(6.7, UPC + 0.9); s.lineTo(0, UPC + 4.2);
  s.lineTo(-6.7, UPC + 0.9); s.lineTo(-6.5, UPC - 0.4); s.bezierCurveTo(-6.5, LOW + 2.8, -8.6, LOW + 0.2, -11.4, LOW); s.lineTo(-hw, LOW); s.lineTo(-hw, 0);
  extrude('gsFront', s, 1.4, { M: at(0, 0, -1.45), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // stone that stands out of the front: the entablatures, the pilasters, the raking cornice of the pediment, the scroll ends
  bx('flat', F, -hw - 0.2, hw + 0.2, LOW - 0.15, LOW + 0.15, -1.45, 0.55, { c: '#c9a070', noao: true });
  bx('flat', F, -7.1, 7.1, UPC + 0.1, UPC + 0.4, -1.45, 0.5, { c: '#c9a070', noao: true });
  for (const sg of [-1, 1]) {
    for (const x of [12.9, 7.4, 4.8]) bx('flat', F, sg * x - (x > 10 ? 1.05 : 0.75), sg * x + (x > 10 ? 1.05 : 0.75), 0.9, LOW - 1.65, -0.05, 0.3, { c: '#c49766', noao: true });
    for (const x of [3.8, 5.6]) bx('flat', F, sg * x - 0.55, sg * x + 0.55, LOW, UPC - 0.9, -0.05, 0.25, { c: '#c49766', noao: true });
    sphere('flat', 0.6, { M: at(sg * 11.7, LOW + 0.5, -0.5), seg: 6, c: '#c9a070' });
    statue('flat', at(sg * 12.4, LOW + 0.15, -0.9), 3.2, { c: '#e6e0d0' });
  }
  for (let i = 0; i < 3; i++) bx('stone', F, -3.2 - i * 0.2, 3.2 + i * 0.2, -0.3, 0.18 * (3 - i), -0.05, 0.4 * (i + 1), { c: '#d6c9a8' });
  bx('flat', F, -0.15, 0.15, UPC + 4.1, UPC + 5.6, -0.9, -0.6, { c: '#4a4036', noao: true }); bx('flat', F, -0.6, 0.6, UPC + 4.9, UPC + 5.1, -0.9, -0.6, { c: '#4a4036', noao: true });
  // the drum and the majolica dome with its lantern, over the crossing
  const DC = at(0, NAVE_TOP + 0.2, DZ);
  cyl('flat', 5.7, 5.9, 5.0, 16, { M: DC, c: '#dcc48c' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI + PI / 8, M = mul(DC, mul(new THREE.Matrix4().makeRotationY(a), tr(0, 0, 5.85))); bx('flat', M, -0.45, 0.45, 0.6, 4.6, -0.05, 0.3, { c: '#bd8d5c', noao: true }); bx('dark', M, -0.45, 0.45, 1.5, 3.9, 0.05, 0.12, { c: '#26303a', noao: true }); }
  lathe('flat', [[5.95, 5.0], [5.95, 5.35], [5.4, 5.45], [5.4, 5.5]], 16, { M: DC, c: '#c9a070' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI * 0.5; prof.push([5.4 * Math.cos(a), 5.5 + 5.6 * Math.sin(a)]); }
  lathe('gsDome', prof, 16, { M: DC, noao: true, uv: 'keep', uvk: [10, 1] });
  cyl('flat', 1.2, 1.4, 2.6, 8, { M: mul(DC, tr(0, 11.0, 0)), c: '#dcc48c' }); sphere('gsDome', 1.3, { M: mul(DC, tr(0, 13.6, 0)), ky: 1.2, seg: 8, noao: true });
  bx('flat', DC, -0.08, 0.08, 14.6, 16.4, -0.08, 0.08, { c: '#3e3a36', noao: true }); bx('flat', DC, -0.5, 0.5, 15.5, 15.65, -0.08, 0.08, { c: '#3e3a36', noao: true });
  const o = end('Chiesa del Gesu');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[GP.p, null, y0 + EAVE], [ring(-NW, NW, NZ1, NZ0), null, y0 + NAVE_TOP + RISE], [ring(-6, 6, DZ - 6, DZ + 6), null, y0 + NAVE_TOP + 11]];
  return o;
}
export const GESU = { name: 'Chiesa del Gesu (Casa Professa)', x: 20, z: 305, radius: 60, skipIds: [GP.id], build: buildGesu };
