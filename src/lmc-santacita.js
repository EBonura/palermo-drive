// City landmark: the Chiesa di Santa Cita (Via Squarcialupo, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49790462. Frame F: origin on the ground in the middle of the front, +z out of the front (south onto Via Squarcialupo), local x along the front.
// The front is the 30.3 m run of the outline that stands at z = -2.3 in the automatic detector's frame (the other 20 m run, 2.5 m further out, is the annexe to the west and stays a plain body).
// Reference photos (Wikimedia Commons, looked at, nothing copied): Palermo-Santa-Cita-bjs2007-01.jpg (the whole front, from the left); Via Squarcialupo, Palermo 2026.jpg (the front in the street, from the west).
// Read from the first photo: a plastered front in warm ochre with golden-orange stone pilasters, in two orders. Lower order: a corner pilaster each end, a small pedimented door near each end with a relief panel over it
// (the right one big and framed), a group of three narrow pilasters each side of the middle, a tall double door in the middle under a curved lintel with a stone dog on top, a long entablature with an inscription band.
// Upper order (the nave): a narrow front with a pair of fluted pilasters each side, one framed window with a pediment, plain panels, a cornice, a low triangular pediment with a cartouche and garlands,
// and a concave scroll with a garland each side down to the lower cornice. Heights relative to the width (30.3 m): lower cornice about 0.34, upper cornice about 0.56, pediment top about 0.70.
// Not known and not drawn: the roofs behind the front (tiles are assumed), the side walls (the aisles were bombed in the last war: plain walls), the bell tower if there is one.
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue } from './lmc-kit.js';

const SC = { id: 'w49790462', p: [176.1, -600.6, 176.9, -594.1, 172.3, -593.6, 173.1, -586.7, 169.4, -586.2, 165.9, -582.6, 166.7, -575.1, 171, -572.5, 174.5, -572.9, 175.5, -564.5, 183.6, -565.5, 184.2, -560.3, 204.1, -562.7, 203.8, -565.2, 233.9, -568.8, 230.6, -595.2, 218.3, -593.7, 216.9, -605.5] };
const N = [0.1189, 0.9929], FX = 14.25, FZ0 = -2.3;   // the front line is at z = -2.3 from the origin (205, -563); FX centres the front in x
const O0 = [205, -563];
const O = [O0[0] + FX * N[1] + FZ0 * N[0], O0[1] - FX * N[0] + FZ0 * N[1]];
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
const FW = 30.3, FH = 21.6, LOW = 10.2, UPC = 17.0, EAVE = 10.2, NAVE_TOP = 17.2, NW = 7.25, NZ0 = -1.6, NZ1 = -27, RISE = 3.6;
const PLAS = '#e6d09c', STN = '#c99a5a', STNH = '#dcb578', DARK = '#1b1612', GLASS = '#2b3540';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  g.fillStyle = PLAS; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 60, 2, 6101, ['rgba(150,110,60,0.08)', 'rgba(255,245,215,0.08)', 'rgba(110,80,40,0.06)']);
  for (let i = 0; i < 7; i++) { const cx = X(-12 + i * 4), cy = Y(4 + (i % 3) * 6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 5 * sx); gr.addColorStop(0, 'rgba(160,110,60,0.16)'); gr.addColorStop(1, 'rgba(160,110,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.8, '#a98259');
  const pil = (x, y0, y1, ww) => { R(x - ww / 2, y0, x + ww / 2, y1, STN); R(x - ww / 2, y0, x - ww / 2 + 0.1, y1, 'rgba(255,235,190,0.35)'); R(x + ww / 2 - 0.12, y0, x + ww / 2, y1, 'rgba(60,35,20,0.32)'); R(x - ww / 2 - 0.12, y1 - 0.45, x + ww / 2 + 0.12, y1, STNH); R(x - ww / 2 - 0.08, y0, x + ww / 2 + 0.08, y0 + 0.35, STNH); };
  // lower order
  for (const s of [-1, 1]) { pil(s * 14.55, 0.8, LOW - 1.5, 1.3); for (const d of [-1.15, 0, 1.15]) pil(s * 6.3 + d, 0.8, LOW - 1.5, 0.85); }
  R(-FW / 2, LOW - 1.6, FW / 2, LOW, STN); R(-FW / 2, LOW - 1.6, FW / 2, LOW - 1.45, 'rgba(60,35,20,0.4)'); R(-FW / 2, LOW - 0.4, FW / 2, LOW, STNH); R(-9, LOW - 1.1, 9, LOW - 0.65, '#cdb283');
  // the middle portal: a tall double door under a curved lintel, the dog on top
  R(-2.4, 0.8, 2.4, 7.4, STN); R(-1.9, 0.8, 1.9, 6.9, '#4a3220'); R(-0.04, 0.8, 0.04, 6.9, '#2a1d12'); for (let y = 1.6; y < 6.8; y += 1.5) { R(-1.8, y, -0.1, y + 1.3, 'rgba(0,0,0,0.12)'); R(0.1, y, 1.8, y + 1.3, 'rgba(0,0,0,0.12)'); }
  g.fillStyle = STNH; g.beginPath(); g.moveTo(X(-3.0), Y(7.4)); g.quadraticCurveTo(X(0), Y(9.9), X(3.0), Y(7.4)); g.closePath(); g.fill(); g.fillStyle = PLAS; g.beginPath(); g.moveTo(X(-2.4), Y(7.5)); g.quadraticCurveTo(X(0), Y(9.3), X(2.4), Y(7.5)); g.closePath(); g.fill();
  // the side doors with a triangular pediment and a relief panel over each
  for (const s of [-1, 1]) {
    const x = s * 11.1;
    R(x - 1.3, 0.8, x + 1.3, 3.9, STN); R(x - 0.95, 0.8, x + 0.95, 3.6, '#4a3220'); tri(x - 1.7, x + 1.7, 3.9, 0.95, STNH); tri(x - 1.0, x + 1.0, 4.0, 0.5, PLAS);
    R(x - 2.0, 5.2, x + 2.0, 8.4, STN); R(x - 1.8, 5.4, x + 1.8, 8.2, '#d8c4a0'); R(x - 0.6, 5.9, x + 0.6, 7.5, '#bda47c'); g.fillStyle = '#bda47c'; g.beginPath(); g.arc(X(x), Y(7.8), 0.4 * sx, 0, 2 * PI); g.fill();
  }
  // upper order
  for (const s of [-1, 1]) for (const d of [-0.7, 0.7]) pil(s * 6.2 + d * s, LOW, UPC - 0.9, 0.9);
  R(-7.2, UPC - 0.95, 7.2, UPC + 0.1, STN); R(-7.5, UPC + 0.1, 7.5, UPC + 0.75, STNH);
  R(-1.5, 12.1, 1.5, 16.3, STN); R(-1.15, 12.45, 1.15, 15.9, GLASS); for (const y of [13.5, 14.7]) R(-1.15, y, 1.15, y + 0.08, '#6b5438'); R(-0.04, 12.45, 0.04, 15.9, '#6b5438'); R(-1.9, 11.8, 1.9, 12.1, STN); R(-1.9, 16.3, 1.9, 16.55, STNH);
  for (const s of [-1, 1]) { R(s * 4.5 - 1.1, 11.7, s * 4.5 + 1.1, 15.8, 'rgba(120,85,45,0.18)'); R(s * 4.5 - 0.95, 11.85, s * 4.5 + 0.95, 15.65, PLAS); }
  tri(-7.8, 7.8, UPC + 0.75, 2.5, STNH); tri(-6.6, 6.6, UPC + 1.0, 2.0, PLAS);
  g.fillStyle = '#d9c9a2'; g.beginPath(); g.ellipse(X(0), Y(19.0), 0.9 * sx, 0.6 * sy, 0, 0, 2 * PI); g.fill();
  for (const y of [LOW, UPC + 0.1]) { const gs = g.createLinearGradient(0, Y(y - 1.6), 0, Y(y - 3.2)); gs.addColorStop(0, 'rgba(60,35,15,0.28)'); gs.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y - 1.6), w, 1.6 * sy); }
  streaks(g, w, h, 36, 6102, 0.1, 110, '70,50,35');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.32)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, win, seed) {
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = '#dcc48c'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, seed, ['rgba(150,110,60,0.09)', 'rgba(255,245,215,0.08)']);
  R(0, 0, 0.5, hm, STN); R(4.0, 0, 4.5, hm, STN);
  if (win) { arch(2.25, hm - 5.4, hm - 1.3, 1.7, STN); arch(2.25, hm - 5.15, hm - 1.55, 1.2, GLASS); }
  else { R(0, 0, 4.5, 1.0, '#a98259'); arch(2.25, 4.6, 8.0, 1.4, STN); arch(2.25, 4.8, 7.8, 1.0, GLASS); }
  R(0, hm - 0.7, 4.5, hm, STNH); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(50,30,15,0.28)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '70,50,35');
}

function buildSantaCita() {
  initShared();
  const pts = pairsOf(SC.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-12, 2)), groundY(...W(12, 2)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('scFront', 512, 364, [FW, FH], paintFront);
  defMat('scBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 6121));
  defMat('scNave', 128, 256, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 6131));
  begin(y0);
  const body = clipFront(pts, -0.1);
  prism('scBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  bx('scNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  gable('tile', 'scNave', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ0 - NZ1, NAVE_TOP, RISE, { ov: 0.35, c: '#b8744f', wc: '#dcc48c' });
  const hw = FW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, LOW); s.lineTo(11.5, LOW); s.bezierCurveTo(9.6, LOW + 0.2, 7.7, LOW + 2.2, 7.4, UPC - 0.3); s.lineTo(7.6, UPC + 0.75); s.lineTo(0, UPC + 3.3);
  s.lineTo(-7.6, UPC + 0.75); s.lineTo(-7.4, UPC - 0.3); s.bezierCurveTo(-7.7, LOW + 2.2, -9.6, LOW + 0.2, -11.5, LOW); s.lineTo(-hw, LOW); s.lineTo(-hw, 0);
  extrude('scFront', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.2, hw + 0.2, LOW - 0.15, LOW + 0.15, -1.35, 0.5, { c: '#d2a868', noao: true });
  bx('flat', F, -8.0, 8.0, UPC + 0.1, UPC + 0.4, -1.35, 0.45, { c: '#d2a868', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 14.55 - 0.7, sg * 14.55 + 0.7, 0.8, LOW - 1.55, -0.05, 0.3, { c: '#c99a5a', noao: true });
    for (const d of [-1.15, 0, 1.15]) bx('flat', F, sg * 6.3 + d - 0.45, sg * 6.3 + d + 0.45, 0.8, LOW - 1.55, -0.05, 0.22, { c: '#c99a5a', noao: true });
    for (const d of [-0.7, 0.7]) bx('flat', F, sg * 6.2 + d * sg - 0.5, sg * 6.2 + d * sg + 0.5, LOW, UPC - 0.85, -0.05, 0.22, { c: '#c99a5a', noao: true });
    sphere('flat', 0.45, { M: at(sg * 8.1, UPC + 0.9, -0.3), seg: 6, c: '#d2a868' });
  }
  bx('stone', F, -2.0, 2.0, -0.2, 0.2, -0.05, 0.6, { c: '#d6c9a8' }); bx('stone', F, -1.8, 1.8, 0.2, 0.4, -0.05, 0.3, { c: '#d6c9a8' });
  for (const sg of [-1, 1]) { bx('stone', F, sg * 11.1 - 1.3, sg * 11.1 + 1.3, -0.2, 0.2, -0.05, 0.7, { c: '#cfc2a4' }); bx('stone', F, sg * 11.1 - 1.1, sg * 11.1 + 1.1, 0.2, 0.4, -0.05, 0.35, { c: '#cfc2a4' }); }
  statue('flat', at(0, LOW + 0.1, -0.5), 1.1, { c: '#e6e0d0' });
  bx('flat', F, -0.12, 0.12, UPC + 3.2, UPC + 4.6, -0.8, -0.55, { c: '#4a4036', noao: true }); bx('flat', F, -0.55, 0.55, UPC + 3.9, UPC + 4.05, -0.8, -0.55, { c: '#4a4036', noao: true });
  const o = end('Chiesa di Santa Cita');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[SC.p, null, y0 + EAVE], [ring(-NW, NW, NZ1, NZ0), null, y0 + NAVE_TOP + RISE]];
  return o;
}
export const SANTA_CITA = { name: 'Chiesa di Santa Cita', x: 205, z: -580, radius: 50, skipIds: [SC.id], build: buildSantaCita };
