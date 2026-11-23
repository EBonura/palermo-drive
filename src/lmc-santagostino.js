// City landmark: the Chiesa di Sant'Agostino (Via Sant'Agostino, Capo market side). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49786078 (a lidar outline whose 32 to 38 m height comes from the neighbours, which left a tall blank block):
// the footprint prism up to the aisle roofs, the raised nave with a gable roof of tiles, and a painted Gothic front in honey limestone with a large pointed portal, a pediment over it and a rose window.
// (stepped front outline: low aisle shoulders, a raised nave front under a gable)
// Frame F: origin on the ground at the middle of the short west wall of the footprint, +z out of the front (west, onto Via Sant'Agostino), +x to the right seen from the street (south).
// Measured from the footprint: the front is the short west edge (13.9 m wide), the nave runs about 47 m back from it, in a straight line.
// Reference photos (Wikimedia Commons, viewed): Sant'Agostino (Palermo) 02.jpg; Palermo-San-Agostino-bjs.jpg; Sant'Agostino (Palermo) 15 07 2019 01.jpg (the file Sant'Agostino-facade 1.jpg is another town's church and was not used).
// Read from them: a plain tall front of honey limestone ashlar with dark weathering, a raised nave front with a pale plastered gable over lower aisle shoulders, no buttresses, parapet or bell gable;
// one large pointed portal (about 0.6 of the nave width, apex about 1.2 times its width) of carved bands over three colonnettes a side with capitals, stone steps up to it, a small gable with a blind arch over it,
// a carved rose window with twelve spokes above, and a small square rosette each side of the portal at the springing height.
// Not verified: the exact height of the side shoulders and the gable, the true carving (bands are painted flat), the steps count, the roof (hidden behind the front).
import * as THREE from 'three';
import { PI, bx, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, crenel } from './lmc-kit.js';

const SA = { id: 'w49786078', p: [-343, -257.1, -336.6, -258.7, -296.8, -269, -293.2, -257.6, -292.5, -255.2, -339.5, -243.7] };
const O = [-341.25, -250.4], N = [-0.9675, 0.2527];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {   // the footprint cut off where it stands out in front of the front (keeps z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 13.9, FH = 18.0, AIS = 12.6, EAVE = 14.8, RISE = 3.2, GW = 10.4, NH = GW / 2;
const DARKGLASS = '#262f3a';

function paintFront(g, w, h) {   // 13.9 m wide, 18 m tall from the ground; the shape cut from it is the real stepped outline
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const geo = (x, y1, ww) => { const r = ww / 2, rho = 1.5 * r, h = Math.sqrt(rho * rho - (r - rho) * (r - rho)); return { r, rho, ys: y1 - h, a2: Math.atan2(-h, r - rho) + 2 * PI, a3: Math.atan2(-h, rho - r) }; };
  const point = (x, y0, y1, ww, c) => {   // a pointed (two-centre) arch: straight sides up to the springing, two arcs meeting at y1
    const { r, rho, ys, a2, a3 } = geo(x, y1, ww); g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys));
    g.arc(X(x - r + rho), Y(ys), rho * sx, PI, a2, false); g.arc(X(x + r - rho), Y(ys), rho * sx, a3, 0, false); g.lineTo(X(x + r), Y(y0)); g.fill();
  };
  const dots = (x, y1, ww, c, rr, n) => {   // a row of small carved dots along a pointed arch
    const { r, rho, ys, a2, a3 } = geo(x, y1, ww); g.fillStyle = c;
    for (let i = 0; i <= n; i++) {
      const t = i / n, ang = PI + (a2 - PI) * t, ang2 = a3 * (1 - t);
      for (const [cx, an] of [[x - r + rho, ang], [x + r - rho, ang2]]) { g.beginPath(); g.arc(X(cx + Math.cos(an) * rho), Y(ys - Math.sin(an) * rho), rr * sx, 0, 2 * PI); g.fill(); }
    }
  };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  paintAshlar(g, w, h, FW, FH, 0.45, 1.0, '#cdae7e', '#a58a62', 5101, 1.0, 0.07);
  // darker weathering on the lower half and under the rose window, as in the photos
  for (let i = 0; i < 7; i++) { const cx = X(-6 + i * 2.1), cy = Y(3 + (i * 7 % 9)), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 3.4 * sx); gr.addColorStop(0, 'rgba(70,52,34,0.22)'); gr.addColorStop(1, 'rgba(70,52,34,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // the pale plastered upper part of the front: the nave gable and a band under it
  R(-FW / 2, 13.4, FW / 2, FH, '#dccaa0');
  const gp = g.createLinearGradient(0, Y(14.2), 0, Y(13.0)); gp.addColorStop(0, 'rgba(220,202,160,1)'); gp.addColorStop(1, 'rgba(220,202,160,0)'); g.fillStyle = gp; g.fillRect(0, Y(14.2), w, 1.2 * sy);
  R(-FW / 2, 0, FW / 2, 0.6, '#b59a70');                                                           // plinth
  // the two small carved square rosettes on each side of the portal
  for (const sg of [-1, 1]) { const cx = sg * 4.4, cy = 6.3; g.save(); g.translate(X(cx), Y(cy)); g.rotate(PI / 4); g.fillStyle = '#6f5a40'; g.fillRect(-0.42 * sx, -0.42 * sx, 0.84 * sx, 0.84 * sx); g.fillStyle = '#c4aa7c'; g.fillRect(-0.28 * sx, -0.28 * sx, 0.56 * sx, 0.56 * sx); g.restore(); }
  // the portal: a tall pointed arch of carved bands over three colonnettes a side, stone steps in front
  R(-3.1, 0.6, -1.7, 4.1, '#d2bb90'); R(1.7, 0.6, 3.1, 4.1, '#d2bb90');
  for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) { const x0 = sg > 0 ? 1.75 + k * 0.45 : -3.05 + k * 0.45; R(x0, 0.6, x0 + 0.06, 4.1, 'rgba(70,52,34,0.45)'); }
  R(-3.1, 3.95, -1.6, 4.35, '#a98d62'); R(1.6, 3.95, 3.1, 4.35, '#a98d62');                           // capitals
  point(0, 4.1, 7.7, 6.2, '#c7ae83'); point(0, 4.1, 7.4, 5.7, '#8d7452'); point(0, 4.1, 7.1, 5.2, '#cbb288');
  point(0, 4.1, 6.8, 4.6, '#8d7452'); point(0, 4.1, 6.5, 4.1, '#c3a97c'); point(0, 4.1, 6.3, 3.5, '#8d7452');
  dots(0, 7.55, 5.95, '#e2cfa4', 0.11, 22); dots(0, 6.95, 4.9, '#e2cfa4', 0.1, 20);
  R(-1.7, 0.6, 1.7, 4.2, '#8d7452'); point(0, 0.6, 6.1, 3.3, '#4a3220');
  R(-0.05, 0.6, 0.05, 4.4, '#2a1c10'); R(-0.5, 0.6, 0.5, 2.5, '#15110d');
  // the small gable over the portal, with a blind arch, and the cornice it stands on
  g.fillStyle = '#d8c79f'; g.beginPath(); g.moveTo(X(-2.9), Y(8.15)); g.lineTo(X(0), Y(9.9)); g.lineTo(X(2.9), Y(8.15)); g.fill();
  g.strokeStyle = '#6b5841'; g.lineWidth = 0.2 * sx; g.beginPath(); g.moveTo(X(-3.05), Y(8.15)); g.lineTo(X(0), Y(9.95)); g.lineTo(X(3.05), Y(8.15)); g.stroke();
  R(-3.3, 7.95, 3.3, 8.25, '#7b6649'); R(-3.3, 8.18, 3.3, 8.25, '#d8c79f');
  point(0, 8.25, 9.35, 1.5, '#8a7458'); point(0, 8.25, 9.2, 1.1, '#b9a37b');
  // the rose window: a carved ring, a wide ring of leaves, dark glass, twelve spokes round a hub
  const ry = 11.5;
  circ(0, ry, 1.85, '#6f5c44'); circ(0, ry, 1.68, '#cfb88c'); circ(0, ry, 1.42, '#a58b63'); circ(0, ry, 1.15, DARKGLASS);
  g.strokeStyle = '#a58b63'; g.lineWidth = 0.07 * sx; for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * 2 * PI; g.beginPath(); g.arc(X(Math.cos(a) * 1.0), Y(ry + Math.sin(a) * 1.0), 0.34 * sx, 0, 2 * PI); g.stroke(); }
  g.strokeStyle = '#eadfc2'; g.lineWidth = 0.1 * sx;
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(Math.cos(a) * 0.3), Y(ry + Math.sin(a) * 0.3)); g.lineTo(X(Math.cos(a) * 1.15), Y(ry + Math.sin(a) * 1.15)); g.stroke(); }
  circ(0, ry, 0.3, '#eadfc2');
  // soft grime at the foot, rain streaks
  streaks(g, w, h, 26, 5102, 0.1, 120, '60,45,30');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,30,20,0.3)'); gb.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h) {   // a side bay: 4.5 m wide, plain honey limestone, a cornice
  const sx = w / 4.5, sy = h / EAVE, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, 4.5, EAVE, 0.45, 1.0, '#c9aa7a', '#a58a62', 5111, 1.0, 0.07);
  noiseDots(g, w, h, w * h / 120, 2, 5114, ['rgba(80,55,30,0.08)', 'rgba(255,240,210,0.06)']);
  R(0, 0, 4.5, 0.6, '#b59a70');
  R(0, EAVE - 0.4, 4.5, EAVE, '#d6c196'); R(0, EAVE - 0.6, 4.5, EAVE - 0.4, 'rgba(40,30,18,0.25)');
  streaks(g, w, h, 8, 5115, 0.12, 80, '55,42,30');
}

function buildSantAgostino() {
  initShared();
  const pts = pairsOf(SA.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-4, 2)), groundY(...W(4, 2)), groundY(...W(0, 4)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  const zFar = Math.min(...pts.map(p => toLocal(p)[1])), L = -zFar - 1.2;
  defMat('saFront', 512, 512, [FW, FH], paintFront);
  defMat('agWall', 128, 256, [4.5, EAVE], paintWall);
  begin(y0);
  // the body: the whole footprint up to the aisle roofs (not in front of the front), the nave raised above it
  const body = clipFront(pts, -0.1);
  prism('agWall', body, Math.min(gr.lo, y0) - 1.5, y0 + AIS, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + AIS, y0 + AIS + 0.12, { c: '#9b958b' });
  bx('agWall', F, -NH, NH, AIS, EAVE, -L - 0.6, -0.1, { c: '#c9aa7a' });
  // the gable roof of tiles along the nave; the ridge stays under the apex of the front
  gable('tile', 'agWall', at(0, 0, -L / 2 - 0.6), GW, L, EAVE, RISE, { ov: 0.2, c: '#b8744f', wc: '#d6c196' });
  // the front: one slab with the painted front on it, in the real stepped outline (low aisles, a raised nave with a gable)
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, AIS); s.lineTo(NH, AIS); s.lineTo(NH, EAVE); s.lineTo(0, EAVE + RISE); s.lineTo(-NH, EAVE); s.lineTo(-NH, AIS); s.lineTo(-hw, AIS); s.lineTo(-hw, 0);
  extrude('saFront', s, 1.3, { M: at(0, 0, -1.3), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 4, noao: true });
  for (let i = 0; i < 4; i++) bx('stone', F, -3.5 - i * 0.12, 3.5 + i * 0.12, -0.2, 0.18 * (4 - i), 0, 0.45 * (i + 1), { c: '#bdb09a' });   // four stone steps up to the portal
  const o = end("Chiesa di Sant'Agostino");
  o.userData.solids = [[SA.p, null, y0 + EAVE + RISE]];
  return o;
}
export const SANT_AGOSTINO = { name: "Chiesa di Sant'Agostino", x: -317, z: -257, radius: 40, skipIds: [SA.id], build: buildSantAgostino };
