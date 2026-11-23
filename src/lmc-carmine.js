// City landmark: the Chiesa del Carmine Maggiore (Ballaro, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49773335: the plain front in two orders, the small bell tower beside it, the nave, and above all the dome with its majolica tiles.
// Frame F: origin on the ground in the middle of the front edge of the footprint, +z out of the front (north-north-east, onto the market square), local x runs along the front (to the right seen from the square).
// Reference photos (Wikimedia Commons): Carmine Maggiore facciata.jpg (the front square on), Chiesa del Carmine Maggiore, Palermo.jpg (the dome and the nave from behind),
// Crèsia di lu Càrminu - cùpula.jpg (the dome close up), Palermo - panoramio (1).jpg (the dome seen down a street, tiles in yellow and cream).
// Read from them: the front is 25.4 m wide (footprint) and about 21 m to the pediment; a lower order of 11.5 m in ochre plaster with five pilaster strips, a door under a niche with a white Madonna in the middle bay,
// a window over a small door in each side bay; a cornice; a narrower upper order (about 9 m) with two pilasters, one window, two pale panels, a medallion, a plain triangular pediment with an urn each side,
// concave ramps down to the low wings, urns on the wings, a small square bell tower with one arch at the left. Behind: a plain nave under a gable roof, a square base, then the dome:
// a cream stucco drum with four atlantes between paired columns, a salmon band, the dome tiled in rib bands of blue chains with fish scale fields in green, yellow and cream, a cream lantern with a cap, a ball and an iron cross.
// Not verified and not drawn: the exact position of the dome along the nave (put over the middle), the tiles' real pattern (a pattern in those colours is painted), the statues (white silhouettes), the transepts, the roofs of the chapels (flat).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, archBay, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, RNG } from './lmc-kit.js';

const CA = { id: 'w49773335', p: [-4.3, 523, 15.6, 488.4, 37.7, 501, 17.8, 535.6, 14.2, 533.5, 11.4, 538.5, 5.7, 538.7, -3.6, 532.1, 0.3, 525.5] };
const O = [26.6, 494.7], N = [0.495, -0.869];
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
const FW = 25.4, FH = 21.4, FZ = -0.55, LO = 11.0, WING = 12.6, EAVE = 10.6, NAVE_EAVE = 13.4, NW = 8.4, DZ = -27, DR = 6.2;
const OCHRE = '#b98a53', STONE = '#cfae7e', CREAM = '#e6d6b4', UPPER = '#d9c6a0';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const r_ = RNG(7301);
  paintAshlar(g, w, h, FW, FH, 0.7, 1.6, '#b98a53', '#a37a47', 7301, 0.8, 0.05);
  // the upper order and the ramps: paler plaster over the ashlar
  R(-FW / 2, LO, FW / 2, FH, UPPER); R(-FW / 2, LO, FW / 2, WING, '#cdb083');
  // damp and peeling patches, lighter where the plaster has gone
  for (let i = 0; i < 16; i++) { const cx = X((r_() - 0.5) * 24), cy = Y(1 + r_() * 20), rr = (1.2 + r_() * 2.6) * sx, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); const lo = i % 3 === 0; gr.addColorStop(0, lo ? 'rgba(214,190,150,0.35)' : 'rgba(110,72,40,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, 2 * rr, 2 * rr); }
  R(-FW / 2, 0, FW / 2, 0.9, '#a07c4c');
  // pilaster strips of the lower order (real boxes stand on them too)
  for (const [a, b] of [[-11.9, -10.1], [-5.5, -4.0], [2.7, 4.6], [7.3, 9.1], [10.6, 12.2]]) { R(a, 0.9, b, LO, '#c6a672'); R(b - 0.18, 0.9, b, LO, 'rgba(60,40,20,0.25)'); R(a, 0.9, a + 0.15, LO, 'rgba(255,240,200,0.3)'); }
  // side bays: a window over a small door
  for (const x of [-7.1, 6.1]) {
    R(x - 1.15, 4.7, x + 1.15, 8.3, '#d6bd8c'); R(x - 0.85, 5.0, x + 0.85, 8.0, '#262c34'); for (const y of [6.0, 7.0]) R(x - 0.85, y, x + 0.85, y + 0.07, '#a98d5c'); R(x - 0.04, 5.0, x + 0.04, 8.0, '#a98d5c');
    R(x - 1.0, 2.9, x + 1.0, 3.1, '#d6bd8c'); R(x - 0.8, 0.9, x + 0.8, 2.9, x < 0 ? '#3a2e24' : '#6d4a35');
  }
  // the middle bay: a door with a cornice, over it an arched niche with the white Madonna
  R(-2.3, 0.9, 0.7, 4.3, '#d6bd8c'); R(-2.0, 0.9, 0.4, 4.0, '#6a3f2c'); R(-0.8 - 0.03, 0.9, -0.8 + 0.03, 4.0, '#3a2418'); R(-2.5, 4.3, 0.9, 4.75, '#d6bd8c');
  arch(-0.8, 5.4, 9.5, 1.9, '#d6bd8c'); arch(-0.8, 5.6, 9.3, 1.5, '#e8cf94');
  g.fillStyle = '#f1ece0'; g.beginPath(); g.ellipse(X(-0.8), Y(7.3), 0.42 * sx, 1.2 * sy, 0, 0, 2 * PI); g.fill(); g.beginPath(); g.arc(X(-0.8), Y(8.7), 0.26 * sx, 0, 2 * PI); g.fill(); R(-1.5, 5.4, -0.1, 5.65, '#c9ad78');
  // the cornice between the orders and the band of the wings
  R(-FW / 2, LO, FW / 2, LO + 0.8, '#d8bf8c'); R(-FW / 2, LO - 0.12, FW / 2, LO, 'rgba(50,30,10,0.35)');
  R(-FW / 2, WING - 0.5, FW / 2, WING, '#c9ab78');
  // the upper order: pilasters, one window, two pale panels, a medallion, the pediment
  for (const [a, b] of [[-4.7, -3.8], [3.5, 4.5]]) { R(a, LO + 0.8, b, 19.0, '#cbae7c'); R(b - 0.14, LO + 0.8, b, 19.0, 'rgba(60,40,20,0.22)'); }
  R(-3.7, 13.0, -1.7, 17.6, '#ece1c8'); R(1.0, 13.0, 3.0, 17.6, '#ece1c8');
  R(-1.45, 12.6, 0.55, 16.0, '#d6bd8c'); R(-1.2, 12.85, 0.3, 15.75, '#262c34'); R(-0.45 - 0.04, 12.85, -0.45 + 0.04, 15.75, '#a98d5c'); R(-1.7, 16.0, 0.8, 16.35, '#d6bd8c');
  g.fillStyle = '#d6bd8c'; g.beginPath(); g.arc(X(-0.45), Y(17.1), 0.75 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#b98a53'; g.beginPath(); g.arc(X(-0.45), Y(17.1), 0.5 * sx, 0, 2 * PI); g.fill();
  R(-5.2, 19.0, 5.2, 19.35, '#d8bf8c');
  g.fillStyle = '#d3b982'; g.beginPath(); g.moveTo(X(-5.2), Y(19.35)); g.lineTo(X(0), Y(21.0)); g.lineTo(X(5.2), Y(19.35)); g.closePath(); g.fill();
  g.strokeStyle = '#e0c994'; g.lineWidth = 0.28 * sx; g.beginPath(); g.moveTo(X(-5.2), Y(19.35)); g.lineTo(X(0), Y(21.0)); g.lineTo(X(5.2), Y(19.35)); g.stroke();
  for (const y of [LO]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.4)); gs.addColorStop(0, 'rgba(40,25,10,0.3)'); gs.addColorStop(1, 'rgba(40,25,10,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.4 * sy); }
  streaks(g, w, h, 30, 7302, 0.1, 110, '70,50,30');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,22,12,0.3)'); gb.addColorStop(1, 'rgba(30,22,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay, 4.5 m wide, rough yellow-brown tuff
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, 4.5, hm, 0.5, 1.1, '#b3905e', '#8e6f45', seed, 1.2, 0.09);
  noiseDots(g, w, h, w * h / 80, 2, seed + 3, ['rgba(80,55,30,0.12)', 'rgba(230,205,160,0.1)']);
  if (win) { R(1.6, hm - 3.4, 2.9, hm - 0.9, '#d6bd8c'); R(1.8, hm - 3.2, 2.7, hm - 1.1, '#262c34'); }
  else { R(1.6, 6.0, 2.9, 8.4, '#d6bd8c'); R(1.8, 6.2, 2.7, 8.2, '#262c34'); }
  R(0, hm - 0.45, 4.5, hm, '#c9ab78'); R(0, hm - 0.75, 4.5, hm - 0.45, 'rgba(40,25,10,0.3)');
  streaks(g, w, h, 8, seed + 5, 0.1, 80, '70,50,30');
}
function paintDome(g, w, h) {   // u round the dome (8 ribs), v from the base (canvas bottom) to the crown; blue chain bands on the ribs, fish scale fields between
  const ribs = 8, cw = w / ribs, r_ = RNG(7311);
  g.fillStyle = '#d8cfae'; g.fillRect(0, 0, w, h);
  const cols = ['#5f9a6a', '#d9b94a', '#e9e2c8', '#4f8f9a', '#d9b94a', '#e9e2c8'];
  for (let k = 0; k < ribs; k++) {
    const x0 = k * cw + cw * 0.13, x1 = (k + 1) * cw - cw * 0.13, sc = 9;
    for (let row = 0, y = h; y > -sc; row++, y -= sc * 0.55) for (let x = x0 - (row % 2) * sc * 0.5; x < x1; x += sc) {
      const cx = x + sc / 2; if (cx < x0 || cx > x1) continue;
      g.fillStyle = cols[(row + k) % cols.length]; g.beginPath(); g.arc(cx, y, sc * 0.55, 0, PI); g.fill();
      g.strokeStyle = 'rgba(30,50,90,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, y, sc * 0.55, 0, PI); g.stroke();
    }
    const bx0 = k * cw - cw * 0.13, bw = cw * 0.26;   // the band on the rib edge
    g.fillStyle = '#e9e2c8'; g.fillRect(bx0, 0, bw, h); g.fillStyle = '#2f55a0'; g.fillRect(bx0 + 2, 0, bw - 4, h);
    g.strokeStyle = '#e9e2c8'; g.lineWidth = 2; g.beginPath(); for (let y = 0; y < h; y += 6) { g.moveTo(bx0 + 3, y); g.quadraticCurveTo(bx0 + bw / 2, y + 4, bx0 + bw - 3, y + 6); } g.stroke();
  }
  g.fillStyle = '#d8cfae'; g.fillRect(0, 0, w, 0);
  noiseDots(g, w, h, 400, 2, 7312, ['rgba(40,40,30,0.12)', 'rgba(255,255,240,0.1)']);
}

function buildCarmine() {
  initShared();
  const pts = pairsOf(CA.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-8, 2)), groundY(...W(8, 2)), groundY(...W(0, 4)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('cmFront', 512, 512, [FW, FH], paintFront);
  defMat('cmWall', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 7321));
  defMat('caDome', 512, 256, [1, 1], paintDome);
  begin(y0);
  const body = clipFront(pts, FZ - 0.2);
  prism('cmWall', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b8f7d' });
  // the nave: two gable roofs, the one over the front bays and the one over the choir, with the square base of the dome between them
  const rz = [[-1.2, DZ + DR + 0.6], [DZ - DR - 0.6, -45.5]];
  for (const [za, zb] of rz) {
    bx('cmWall', F, -NW, NW, EAVE, NAVE_EAVE, zb, za, { uvo: [0, -(y0 + EAVE) / EAVE] });
    gable('tile', 'plaster', at(0, 0, (za + zb) / 2), NW * 2, za - zb, NAVE_EAVE, 3.4, { ov: 0.35, c: '#b8704c', wc: '#b3905e' });
  }
  bx('cmWall', F, -NW, NW, EAVE, NAVE_EAVE + 0.4, DZ - DR - 0.6, DZ + DR + 0.6, { uvo: [0, -(y0 + EAVE) / EAVE] });
  bx('flat', F, -NW - 0.2, NW + 0.2, NAVE_EAVE + 0.4, NAVE_EAVE + 0.65, DZ - DR - 0.8, DZ + DR + 0.8, { c: '#c9ab78' });
  // the front: one shape, lower order, low wings, concave ramps, the narrower upper order, the pediment
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, WING); s.lineTo(8.8, WING); s.bezierCurveTo(6.6, WING + 0.5, 4.9, 14.6, 4.7, 17.0); s.lineTo(4.7, 19.0); s.lineTo(5.2, 19.0); s.lineTo(0, 21.0); s.lineTo(-5.2, 19.0); s.lineTo(-4.7, 19.0); s.lineTo(-4.7, 17.0);
  s.bezierCurveTo(-4.9, 14.6, -6.6, WING + 0.5, -8.8, WING); s.lineTo(-hw, WING); s.lineTo(-hw, 0);
  extrude('cmFront', s, 0.7, { M: at(0, 0, FZ - 0.7), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // cornices and strips that stand out of the front, an urn each side of the pediment and on the wings
  bx('flat', F, -hw - 0.1, hw + 0.1, LO, LO + 0.25, FZ - 0.7, 0.0, { c: '#d8bf8c', noao: true });
  bx('flat', F, -hw - 0.1, hw + 0.1, WING, WING + 0.25, FZ - 0.7, 0.0, { c: '#c9ab78', noao: true });
  bx('flat', F, -5.4, 5.4, 19.0, 19.25, FZ - 0.7, 0.0, { c: '#d8bf8c', noao: true });
  for (const [a, b] of [[-11.9, -10.1], [-5.5, -4.0], [2.7, 4.6], [7.3, 9.1], [10.6, 12.2]]) bx('flat', F, a, b, 0.9, LO, FZ, 0.0, { c: '#c6a672', noao: true });
  for (const [a, b] of [[-4.7, -3.8], [3.5, 4.5]]) bx('flat', F, a, b, LO + 0.8, 19.0, FZ, 0.0, { c: '#cbae7c', noao: true });
  for (const [ux, uy] of [[-5.1, 19.35], [5.1, 19.35], [-8.7, WING + 0.25], [8.1, WING + 0.25], [10.7, WING + 0.25], [11.4, WING + 0.25]]) { bx('flat', F, ux - 0.35, ux + 0.35, uy, uy + 0.5, -1.2, -0.5, { c: '#c9b080' }); sphere('flat', 0.42, { M: at(ux, uy + 1.0, -0.85), ky: 1.3, seg: 6, c: '#d2ba88' }); }
  bx('flat', F, -0.4, 0.4, 21.0, 21.35, -1.1, -0.3, { c: '#c9b080' });
  // the small bell tower at the left, behind the front: a plain brick-coloured block with one arched opening on the front
  { const tx = -6.35;
    bx('flat', F, tx - 1.55, tx + 1.55, WING, WING + 4.3, -3.6, -1.0, { c: '#bd9462' });
    bx('flat', F, tx - 0.5, tx + 0.5, WING + 1.0, WING + 3.1, -1.05, -0.95, { c: '#1f1812', noao: true });
    bx('flat', F, tx - 1.7, tx + 1.7, WING + 4.3, WING + 4.6, -3.8, -0.8, { c: '#cdb084' });
  }
  // the dome: a square base was drawn above; here the drum, the salmon band, the majolica dome, the lantern
  const Dm = at(0, NAVE_EAVE + 0.65, DZ);
  cyl('flat', DR, DR + 0.35, 0.9, 20, { M: Dm, c: '#d9c8a4' });
  cyl('flat', DR - 0.35, DR - 0.35, 5.0, 20, { M: mul(Dm, tr(0, 0.9, 0)), c: '#e6d6b4' });
  for (let i = 0; i < 4; i++) {   // the four atlantes between paired columns, and a window in each of the sides between
    const a = i * PI / 2 + PI / 4, M = mul(Dm, new THREE.Matrix4().makeRotationY(a));
    bx('flat', M, -0.45, 0.45, 1.2, 4.9, DR - 0.5, DR + 0.15, { c: '#f1ece0' });
    for (const dx of [-1.05, 1.05]) cyl('flat', 0.22, 0.24, 3.8, 6, { M: mul(M, tr(dx, 1.2, DR - 0.25)), c: '#e0d0aa' });
    const M2 = mul(Dm, new THREE.Matrix4().makeRotationY(i * PI / 2));
    bx('flat', M2, -0.7, 0.7, 2.0, 4.2, DR - 0.45, DR - 0.25, { c: '#262c34', noao: true }); bx('flat', M2, -0.95, 0.95, 1.8, 4.4, DR - 0.4, DR - 0.3, { c: '#d6bd8c', noao: true });
  }
  cyl('flat', DR + 0.25, DR - 0.3, 0.7, 20, { M: mul(Dm, tr(0, 5.9, 0)), c: '#d9c8a4' });   // the drum cornice
  cyl('flat', DR - 0.35, DR - 0.35, 1.1, 20, { M: mul(Dm, tr(0, 6.6, 0)), c: '#cf8a64' });   // the salmon band
  const prof = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * PI / 2 * 0.98; prof.push([Math.max(0.001, (DR - 0.4) * Math.cos(a)), 5.0 * Math.sin(a)]); }
  lathe('caDome', prof, 16, { M: mul(Dm, tr(0, 7.7, 0)), uv: 'keep', uvk: [1, 1], noao: true });
  cyl('flat', 1.25, 1.45, 2.4, 8, { M: mul(Dm, tr(0, 12.5, 0)), c: '#e0cfa8' });
  for (let i = 0; i < 4; i++) { const M = mul(Dm, new THREE.Matrix4().makeRotationY(i * PI / 2)); bx('flat', M, -0.28, 0.28, 13.2, 14.4, 1.05, 1.3, { c: '#2a2f38', noao: true }); }
  lathe('flat', [[0, 0], [1.55, 0], [1.55, 0.25], [1.0, 0.9], [0.45, 1.5], [0, 1.7]], 8, { M: mul(Dm, tr(0, 14.8, 0)), c: '#c9b690', noao: true });
  sphere('flat', 0.35, { M: mul(Dm, tr(0, 16.7, 0)), seg: 6, c: '#b9ac80' });
  bx('flat', Dm, -0.07, 0.07, 17.0, 18.8, -0.07, 0.07, { c: '#3a342e', noao: true }); bx('flat', Dm, -0.5, 0.5, 18.0, 18.14, -0.07, 0.07, { c: '#3a342e', noao: true });
  const o = end('Chiesa del Carmine Maggiore');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[CA.p, null, y0 + EAVE], [ring(-NW, NW, -45.5, -1.2), null, y0 + NAVE_EAVE + 3.4], [ring(-DR, DR, DZ - DR, DZ + DR), null, y0 + NAVE_EAVE + 0.65 + 18]];
  return o;
}
export const CARMINE = { name: 'Chiesa del Carmine Maggiore', x: 17, z: 515, radius: 45, skipIds: [CA.id], build: buildCarmine };
