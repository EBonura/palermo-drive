// City landmark: the Chiesa di Santa Teresa alla Kalsa (Piazza Santa Teresa, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49786082 (a lidar block): the baroque front in two orders with its projecting centre, the lower wings, the nave behind it, the small cupola.
// Frame F: origin on the ground in the middle of the front edge of the footprint, +z out of the front (east-south-east, onto the piazza), local x runs along the front (to the right seen from the piazza).
// Reference photos (Wikimedia Commons): Santa Teresa alla Kalsa (Palermo).jpg (oblique view of the front: two orders, paired columns, scroll ramps, bell gable on a wing, golden sandstone),
// Kalsa, Palermo, Italy - panoramio (18).jpg (the front square on: the projecting centre about two thirds of the width, lower order about 45 percent of the crest height, statues beside the upper window, wings lower than the centre),
// Palermo-AP-p1070649.jpg (the rear: gable end, arched window, nave under a low roof behind a cornice, small cupola with a cross over the middle).
// Read from them: front 32.2 m wide (footprint), projecting centre 22.4 m with six columns on the lower order and a portal, two niches with white statues, an upper order about 16 m wide with one tall arched window,
// two statue niches and four columns, a triangular pediment with a round coat of arms, a scroll ramp each side; colour a warm golden sandstone.
// Not verified and not drawn: which wing carries the bell gable (the left one seen from the piazza is assumed), the carved ornament, the festive iron arch, the exact roof of the nave (a low tiled gable is assumed), the flying arches of the sides.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, archBay, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

const ST = { id: 'w49786082', p: [974.3, -16, 1019.9, -41.5, 1035.1, -13.1, 989.7, 12.3] };
const O = [1027.5, -27.3], N = [0.882, -0.472];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {   // the footprint cut off in front of z = zmax (Sutherland-Hodgman, keeping z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 32.2, BW = 22.4, BH = 21.8, WZ = -2.4, WH = 12.6, EAVE = 12.4, NAVE_TOP = 17.6, NW = 9.8, NZ0 = -50, NZ1 = -3;
const GOLD = '#cfae78', CREAM = '#e4d3ae', DARKGLASS = '#2a2f38';

function paintBlock(g, w, h) {   // the projecting centre, 22.4 m wide, 21.8 m tall (to the crest of the pediment)
  const sx = w / BW, sy = h / BH, X = x => (x + BW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  paintAshlar(g, w, h, BW, BH, 0.6, 1.5, '#c8a468', '#a07f4c', 6101, 1.0, 0.05);
  for (let i = 0; i < 5; i++) { const cx = X(-8 + i * 4), cy = Y(4 + (i % 3) * 6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4.5 * sx); gr.addColorStop(0, 'rgba(140,100,60,0.16)'); gr.addColorStop(1, 'rgba(140,100,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-BW / 2, 0, BW / 2, 1.2, '#b79a68');                                                       // plinth
  // lower order: corner pilasters, a portal in the middle between two pairs of columns (the columns themselves are real geometry), two niches with a white statue
  for (const s of [-1, 1]) {
    R(s * 10.7 - 0.7, 1.2, s * 10.7 + 0.7, 10.4, '#dcc795'); R(s * 10.7 + (s > 0 ? -0.7 : 0.56), 1.2, s * 10.7 + (s > 0 ? -0.56 : 0.7), 10.4, 'rgba(60,40,20,0.25)');
    arch(s * 8.2, 2.4, 7.4, 2.0, '#e4d3ae'); arch(s * 8.2, 2.6, 7.2, 1.6, '#6e5f48');
    g.fillStyle = '#f1ece0'; g.beginPath(); g.ellipse(X(s * 8.2), Y(4.9), 0.42 * sx, 1.35 * sy, 0, 0, 2 * PI); g.fill(); circ(s * 8.2, 6.5, 0.32, '#f1ece0'); R(s * 8.2 - 0.6, 2.4, s * 8.2 + 0.6, 3.0, '#d9c79c');
  }
  arch(0, 1.2, 7.8, 4.4, '#e4d3ae'); arch(0, 1.2, 7.3, 3.6, '#2b2118'); arch(0, 1.2, 5.6, 3.3, '#4e3a26'); R(-0.04, 1.2, 0.04, 5.4, '#2a1e14'); arch(0, 5.5, 7.1, 3.3, DARKGLASS);
  R(-1.5, 8.0, 1.5, 8.5, '#e4d3ae'); circ(0, 9.2, 0.6, '#e4d3ae'); circ(0, 9.2, 0.4, '#9a8460');   // a cartouche over the portal
  R(-BW / 2, 10.4, BW / 2, 11.4, '#e4d3ae'); R(-BW / 2, 10.4, BW / 2, 10.5, 'rgba(60,40,20,0.35)');   // entablature
  for (let x = -BW / 2 + 0.3; x < BW / 2 - 0.2; x += 0.6) R(x, 10.1, x + 0.3, 10.4, 'rgba(70,50,30,0.3)');   // dentils
  // upper order
  R(-8.0, 11.4, 8.0, 18.4, '#d6b97f');
  for (const s of [-1, 1]) { R(s * 7.5 - 0.5, 11.4, s * 7.5 + 0.5, 18.4, '#e0c994'); R(s * 7.5 + (s > 0 ? -0.5 : 0.4), 11.4, s * 7.5 + (s > 0 ? -0.4 : 0.5), 18.4, 'rgba(60,40,20,0.25)'); }
  arch(0, 12.8, 17.4, 3.0, '#e4d3ae'); arch(0, 13.1, 17.1, 2.3, '#17120e'); arch(0, 13.1, 16.9, 2.1, DARKGLASS); R(-0.04, 13.1, 0.04, 16.4, '#d6c394'); R(-1.0, 14.9, 1.0, 15.0, '#d6c394');
  for (const s of [-1, 1]) {
    arch(s * 4.7, 13.0, 17.2, 1.7, '#a98d5c'); arch(s * 4.7, 13.0, 16.9, 1.35, '#6e5f48');
    g.fillStyle = '#f1ece0'; g.beginPath(); g.ellipse(X(s * 4.7), Y(14.9), 0.34 * sx, 1.15 * sy, 0, 0, 2 * PI); g.fill(); circ(s * 4.7, 16.2, 0.28, '#f1ece0');
  }
  R(-8.2, 18.4, 8.2, 19.2, '#e4d3ae'); R(-8.2, 18.4, 8.2, 18.5, 'rgba(60,40,20,0.35)');
  // pediment, a round coat of arms in it
  g.fillStyle = '#dbc18a'; g.beginPath(); g.moveTo(X(-8.2), Y(19.2)); g.lineTo(X(0), Y(21.8)); g.lineTo(X(8.2), Y(19.2)); g.closePath(); g.fill();
  g.strokeStyle = '#e4d3ae'; g.lineWidth = 0.35 * sx; g.beginPath(); g.moveTo(X(-8.2), Y(19.2)); g.lineTo(X(0), Y(21.8)); g.lineTo(X(8.2), Y(19.2)); g.stroke();
  circ(0, 19.9, 0.9, '#e4d3ae'); circ(0, 19.9, 0.62, '#8a7452');
  for (const y of [10.4, 18.4]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(40,25,10,0.3)'); gs.addColorStop(1, 'rgba(40,25,10,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sy); }
  streaks(g, w, h, 30, 6102, 0.09, 110, '70,50,30');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,22,12,0.3)'); gb.addColorStop(1, 'rgba(30,22,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWing(g, w, h) {   // a lower wing of the front, 4.9 m wide, WH metres tall: plaster, a window, a cornice
  const sx = w / 4.9, sy = h / WH, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, 4.9, WH, 0.6, 1.5, '#d9c49a', '#b69d70', 6111, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, 6114, ['rgba(120,90,60,0.07)', 'rgba(255,245,220,0.06)']);
  R(0, 0, 4.9, 1.0, '#b79a68'); R(0, 0, 0.5, WH, 'rgba(255,245,220,0.2)'); R(4.4, 0, 4.9, WH, 'rgba(60,40,20,0.14)');
  R(1.45, 3.0, 3.45, 5.4, '#e4d3ae'); R(1.65, 3.2, 3.25, 5.2, '#2a2f38'); R(1.65, 4.2, 3.25, 4.3, '#c9b588');
  R(1.45, 7.6, 3.45, 9.8, '#e4d3ae'); R(1.65, 7.8, 3.25, 9.6, '#2a2f38'); R(1.65, 8.7, 3.25, 8.8, '#c9b588');
  R(0, WH - 0.9, 4.9, WH, '#e4d3ae'); R(0, WH - 1.3, 4.9, WH - 0.9, 'rgba(40,25,10,0.3)');
  streaks(g, w, h, 8, 6115, 0.1, 80, '70,50,30');
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay, 4.5 m wide
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.6, 1.5, '#cdb487', '#a88f62', seed, 1.0, 0.06);
  noiseDots(g, w, h, w * h / 120, 2, seed + 3, ['rgba(120,90,60,0.08)', 'rgba(255,245,220,0.06)']);
  R(0, 0, 0.5, hm, 'rgba(255,245,220,0.18)'); R(4.0, 0, 4.5, hm, 'rgba(60,40,20,0.15)');
  if (win) { arch(2.25, hm - 5.6, hm - 1.2, 1.7, '#e0cfa6'); arch(2.25, hm - 5.3, hm - 1.4, 1.2, '#2a2f38'); }
  else { R(0, 0, 4.5, 1.0, '#b79a68'); arch(2.25, 5.6, 9.4, 1.3, '#d9c79c'); arch(2.25, 5.8, 9.2, 0.9, '#2a2f38'); }
  R(0, hm - 0.7, 4.5, hm, '#e0cfa6'); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,25,10,0.3)');
  streaks(g, w, h, 8, seed + 5, 0.1, 80, '70,50,30');
}

function buildSantaTeresa() {
  initShared();
  const pts = pairsOf(ST.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-8, 2)), groundY(...W(8, 2)), groundY(...W(0, 4)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('stBlock', 512, 512, [BW, BH], paintBlock);
  defMat('stWing', 128, 256, [4.9, WH], paintWing);
  defMat('stWall', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 6121));
  defMat('stNave', 128, 256, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 6131));
  begin(y0);
  const body = clipFront(pts, WZ - 0.1);
  prism('stWall', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a79b84' });
  bx('stNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  gable('tile', 'plaster', at(0, 0, (NZ0 + NZ1) / 2), NW * 2, NZ1 - NZ0, NAVE_TOP, 2.4, { ov: 0.35, c: '#b97a55', wc: '#cdb487' });
  // the wings: two lower faces either side of the centre, at the plane z = WZ, a cornice on top
  const hw = FW / 2, bw = BW / 2;
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? bw : -hw;
    panel('stWing', hw - bw, WH, { M: at(x0 + (hw - bw) / 2, 0, WZ) });
    bx('flat', F, x0 - (s < 0 ? 0.1 : 0), x0 + (hw - bw) + (s > 0 ? 0.1 : 0), WH, WH + 0.3, WZ - 0.2, WZ + 0.3, { c: '#e0cfa6', noao: true });
  }
  // the bell gable on the left wing: a small wall with two arched openings, a pediment, a cross
  { const gx = -hw + 2.45, gz = WZ - 0.35;
    archBay('stWall', 3.4, 2.7, 1.0, 2.0, 0.7, { M: at(gx - 0.95, WH + 0.3, gz), uv: 'world' });
    archBay('stWall', 3.4, 2.7, 1.0, 2.0, 0.7, { M: at(gx + 0.95, WH + 0.3, gz), uv: 'world' });
    bx('flat', F, gx - 1.7, gx + 1.7, WH + 3.0, WH + 3.25, gz - 0.1, gz + 0.8, { c: '#e0cfa6' });
    bx('flat', F, gx - 0.1, gx + 0.1, WH + 3.25, WH + 4.2, gz + 0.2, gz + 0.4, { c: '#3a342e' }); bx('flat', F, gx - 0.4, gx + 0.4, WH + 3.9, WH + 4.05, gz + 0.2, gz + 0.4, { c: '#3a342e' });
    for (const dx of [-0.95, 0.95]) sphere('dark', 0.28, { M: at(gx + dx, WH + 1.5, gz + 0.35), ky: 1.2, seg: 6 });
  }
  // the projecting centre: one shape (lower block, scroll ramps, the narrower upper order, the pediment) with the painted front on it
  const s = new THREE.Shape();
  s.moveTo(-bw, 0); s.lineTo(bw, 0); s.lineTo(bw, 11.4); s.lineTo(9.6, 11.4); s.bezierCurveTo(9.1, 12.6, 8.6, 14.8, 8.2, 16.2); s.lineTo(8.2, 19.2); s.lineTo(0, 21.8); s.lineTo(-8.2, 19.2); s.lineTo(-8.2, 16.2);
  s.bezierCurveTo(-8.6, 14.8, -9.1, 12.6, -9.6, 11.4); s.lineTo(-bw, 11.4); s.lineTo(-bw, 0);
  extrude('stBlock', s, -WZ - 0.6, { M: at(0, 0, WZ), uv: 'keep', uvk: [1 / BW, 1 / BH], uvo: [0.5, 0], cs: 8, noao: true });
  // cornices that stand out of the front, the columns (real cylinders) and the steps
  bx('flat', F, -bw - 0.3, bw + 0.3, 10.4, 10.6, WZ + 1.0, 0.0, { c: '#e4d3ae', noao: true });
  bx('flat', F, -8.5, 8.5, 18.4, 18.6, WZ + 1.0, -0.2, { c: '#e4d3ae', noao: true });
  for (const x of [-5.3, -2.7, 2.7, 5.3]) { cyl('flat', 0.55, 0.6, 8.4, 10, { M: at(x, 1.2, -0.45), c: '#d9c496' }); bx('flat', F, x - 0.75, x + 0.75, 9.6, 10.4, -1.2, 0.1, { c: '#e4d3ae' }); bx('flat', F, x - 0.75, x + 0.75, 1.0, 1.5, -1.2, 0.1, { c: '#c9b280' }); }
  for (const x of [-7.4, 7.4]) { cyl('flat', 0.42, 0.46, 5.6, 8, { M: at(x, 12.0, -0.3), c: '#e0cc9c' }); }
    for (let i = 0; i < 3; i++) bx('stone', F, -3.2 - i * 0.2, 3.2 + i * 0.2, -0.3, 0.18 * (3 - i), -0.6, 0, { c: '#d8c8a2' });
  // the small cupola over the middle of the nave: an octagonal drum, a lead cap, a ball and a cross
  {
    cyl('flat', 1.5, 1.8, 2.8, 8, { M: at(0, NAVE_TOP + 1.0, -28), c: '#d6bd8c' });
    lathe('lead', [[0, 0], [1.9, 0], [1.9, 0.2], [1.5, 0.8], [0.8, 1.6], [0.25, 2.2], [0, 2.4]], 8, { M: at(0, NAVE_TOP + 3.8, -28), c: '#9aa09a', noao: true });
    bx('flat', F, -0.08, 0.08, NAVE_TOP + 6.2, NAVE_TOP + 7.6, -28.08, -27.92, { c: '#3a342e', noao: true }); bx('flat', F, -0.5, 0.5, NAVE_TOP + 6.9, NAVE_TOP + 7.05, -28.08, -27.92, { c: '#3a342e', noao: true });
  }
  const o = end('Chiesa di Santa Teresa alla Kalsa');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[ST.p, null, y0 + EAVE], [ring(-NW, NW, NZ0, NZ1), null, y0 + NAVE_TOP + 2.4]];
  return o;
}
export const SANTA_TERESA = { name: 'Chiesa di Santa Teresa alla Kalsa', x: 1005, z: -14, radius: 45, skipIds: [ST.id], build: buildSantaTeresa };
