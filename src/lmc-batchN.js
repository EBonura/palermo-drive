// City landmarks, batch N: Chiesa di Santa Venera (w279885668), Santa Maria dei Naufraghi (w232901239), Chiesa di Santa Rosalia (w278478111). Registered in src/landmarks-city.js.
// Santa Lucia Vergine Maria (w82636565) is not in this batch: no photo of its exterior is on Wikimedia Commons or Wikipedia. It was built later, from photos found elsewhere, in src/lmc-batchR.js.
// Each church has its own frame F: origin on the ground in the middle of the front, +z out of the front, local x along the front (to the right seen from outside). The front edge was chosen from the footprint and the streets.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions and colours were read):
// Santa Venera: Santa Venera facciata.jpg (the front, from the left: tuff ashlar, corner pilasters with projecting blocks, urn on the left corner, recessed panels, one door with a segmental pediment on consoles, a bold cornice, a narrower plastered attic with an arched window and a curved top);
//   Santa Venera.jpg and Santa Venera (Palermo) 24 05 2026 01.jpg and 03.jpg (the rear: rough rubble walls, gable roof of old tiles, a blind arch in the back wall, a small belfry with three arches to the right, low buildings round the foot).
// Santa Maria dei Naufraghi: Santa Maria dei Naufraghi (Palermo) 20 06 2026 01.jpg and 03.jpg (a golden sandstone front with pointed courses of ashlar and pale pointing: a nave front with two flat pilasters, a low pediment with a cross, one tall double door with a hood and a fanlight in an arch;
//   a plainer bay to the right with a blind arch, and over it a bell tower with two pointed belfry openings and a small pediment; plain flank wall on the left with a narrow window).
// Santa Rosalia: Chiesa di Santa Rosalia (Palermo) - Facciata.JPG, - Esterno.JPG (front and flank; red brick panels framed by pale limestone, a central bay with a pediment, a huge round-arched portal with a ring of voussoirs, an inscription band,
//   a statue in an arched niche, wings with two stacked panels and a balustrade band, corner piers with capitals; the flank in orange plaster with pilasters and tall arched windows, a tall drum with a majolica dome in orange and yellow and a lantern behind).
// Not known and not drawn: the roofs behind the fronts (tiles assumed), the inscription text, the steps and railings that stand outside the footprints.
import * as THREE from 'three';
import { PI, bx, box, cyl, lathe, sphere, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, paintAshlar, archShape } from './lmc-kit.js';

// ---- shared helpers
function mkFrame(O, N) {
  const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
  const clipFront = (pts, zmax) => {
    const L = pts.map(toLocal), out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out.map(q => toWorld(q[0], q[1]));
  };
  const ring = (x0, x1, z0, z1) => [toWorld(x0, z0), toWorld(x1, z0), toWorld(x1, z1), toWorld(x0, z1)].flat();
  return { toWorld, clipFront, ring };
}
// painter tools for a front of FW x FH metres, x from -FW/2, y up from the ground
function tools(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const point = (x, y0, y1, ww, c) => { const r = ww / 2, ys = y1 - 1.3 * r; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(ys + r * 1.05), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(ys + r * 1.05), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const foot = (hm, a) => { const gb = g.createLinearGradient(0, Y(0), 0, Y(hm)); gb.addColorStop(0, `rgba(40,28,18,${a})`); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(hm), w, hm * sy); };
  const under = (y, d, a) => { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - d)); gs.addColorStop(0, `rgba(40,28,15,${a})`); gs.addColorStop(1, 'rgba(40,28,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, d * sy); };
  const stains = (n, seed, col) => { const r = RNGs(seed); for (let i = 0; i < n; i++) { const cx = r() * w, cy = r() * h, rad = (0.08 + r() * 0.14) * Math.max(w, h), gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, `rgba(${col},${0.08 + r() * 0.1})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad); } };
  return { sx, sy, X, Y, R, arch, point, tri, foot, under, stains };
}
const RNGs = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
// a bay of flank wall, 4.5 m wide and hm tall: ashlar or rubble in the church's colour, a pilaster half at each edge, a plinth, an optional window, a cornice, wear
function paintBay(g, w, h, hm, o) {
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, o.course, o.block, o.base, o.joint, o.seed, o.jw || 1.2, o.vary || 0.07);
  noiseDots(g, w, h, w * h / 60, 2, o.seed + 3, ['rgba(120,85,45,0.1)', 'rgba(255,240,210,0.09)', 'rgba(60,40,25,0.08)']);
  if (o.stains) { for (let i = 0; i < 5; i++) { const cx = ((i * 0.37 + 0.1) % 1) * w, cy = ((i * 0.53 + 0.2) % 1) * h, gr = g.createRadialGradient(cx, cy, 0, cx, cy, 0.5 * w); gr.addColorStop(0, 'rgba(250,244,225,0.18)'); gr.addColorStop(1, 'rgba(250,244,225,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }
  R(0, 0, 4.5, 0.8, o.plinth);
  if (o.pil) { R(0, 0.8, 0.55, hm, o.pil); R(3.95, 0.8, 4.5, hm, o.pil); R(3.95, 0.8, 4.0, hm, 'rgba(50,30,15,0.25)'); }
  if (o.win === 'arch') { arch(2.25, hm - 6.4, hm - 2.0, 1.7, o.frame); arch(2.25, hm - 6.2, hm - 2.2, 1.25, '#242b33'); R(2.2, hm - 6.2, 2.3, hm - 3.0, 'rgba(120,120,110,0.5)'); R(0.6, 1.1, 3.9, 2.6, 'rgba(0,0,0,0)'); }
  else if (o.win === 'narrow') { R(1.85, hm - 5.9, 2.65, hm - 2.9, o.frame); R(1.95, hm - 5.8, 2.55, hm - 3.0, '#242b33'); }
  R(0, hm - 0.8, 4.5, hm, o.cornice); R(0, hm - 1.15, 4.5, hm - 0.8, 'rgba(50,30,15,0.3)');
  streaks(g, w, h, 12, o.seed + 5, 0.12, 90, '70,50,35');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.2)); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.2), w, 2.2 * sy);
}
// raking cornice of a pediment: two slabs over a span of w metres centred at x, base at y (frame M)
function rake(M, x, y, w, rise, depth, zc, c, th = 0.3) {
  const run = w / 2, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  for (const sg of [-1, 1]) box('flat', len, th, depth, { M, p: [x + sg * run / 2, y + rise / 2, zc], rz: -sg * ang, c, noao: true });
}
const urn = (M, x, y, z, k, c) => { lathe('flat', [[0, 0], [0.22 * k, 0], [0.22 * k, 0.12 * k], [0.12 * k, 0.2 * k], [0.3 * k, 0.5 * k], [0.34 * k, 0.75 * k], [0.2 * k, 0.95 * k], [0.12 * k, 1.0 * k], [0, 1.05 * k]], 8, { M: mul(M, tr(x, y, z)), c, noao: true }); };
const cross = (M, x, y, z, k, c) => { bx('flat', M, x - 0.06 * k, x + 0.06 * k, y, y + 1.0 * k, z - 0.06 * k, z + 0.06 * k, { c, noao: true }); bx('flat', M, x - 0.32 * k, x + 0.32 * k, y + 0.62 * k, y + 0.74 * k, z - 0.06 * k, z + 0.06 * k, { c, noao: true }); };

// =====================================================================================================================================
// SANTA VENERA: a small tuff chapel, 8 m front, nave 6 m wide and 26 m deep under a tile gable, low buildings round it
// =====================================================================================================================================
const VE = { id: 'w279885668', p: [645.5, 323.6, 650.6, 329.7, 629.8, 345.9, 622.8, 337.9, 618.5, 341.1, 616.4, 337.8], O: [648.05, 326.65], N: [0.7672, -0.6414] };
const VF = mkFrame(VE.O, VE.N);
const V_FW = 8, V_FH = 9.8, V_COR = 5.9, V_ATT = 8.6, V_EAVE = 6.2, V_NW = 3.0, V_RISE = 2.0, V_LOW = 3.8;
function paintVeneraFront(g, w, h) {
  const t = tools(g, w, h, V_FW, V_FH), { R, X, Y, arch, sx, sy } = t;
  paintAshlar(g, w, h, V_FW, V_FH, 0.42, 1.0, '#c8a164', '#9d7e4c', 8101, 1.4, 0.09);
  noiseDots(g, w, h, w * h / 40, 2, 8103, ['rgba(130,90,40,0.12)', 'rgba(255,235,190,0.1)', 'rgba(80,55,30,0.09)']);
  t.stains(10, 8104, '110,75,35');
  R(-4, 0, 4, 0.7, '#a98650');
  // the plastered attic over the cornice: lighter, narrower, a dark arched window, a curved top
  R(-3.0, V_COR + 0.5, 3.0, V_ATT, '#dcc08a'); g.fillStyle = '#dcc08a'; g.beginPath(); g.moveTo(X(-3.0), Y(V_ATT)); g.quadraticCurveTo(X(0), Y(V_ATT + 1.0), X(3.0), Y(V_ATT)); g.fill();
  arch(0, 6.9, 8.3, 1.6, '#e6d4a8'); arch(0, 7.0, 8.25, 1.3, '#232830'); for (const x of [-0.32, 0, 0.32]) R(x - 0.02, 7.0, x + 0.02, 7.6, '#5a5448');
  // the lower order: a corner pilaster each end, a narrow pilaster each side of the door, recessed panels, the door under a segmental pediment
  for (const s of [-1, 1]) {
    R(s * 3.5 - 0.5, 0.7, s * 3.5 + 0.5, V_COR - 0.55, '#d2ac6c'); R(s * 3.5 - 0.5 + (s > 0 ? 0.9 : 0), 0.7, s * 3.5 + 0.5 - (s < 0 ? 0.9 : 0), V_COR - 0.55, 'rgba(60,35,15,0.28)');
    R(s * 3.5 - 0.62, V_COR - 0.55, s * 3.5 + 0.62, V_COR - 0.1, '#dcb87a');
    R(s * 1.62 - 0.17, 0.7, s * 1.62 + 0.17, V_COR - 0.4, '#d2ac6c');
    const px = s * 2.55; R(px - 0.5, 1.2, px + 0.5, 4.8, 'rgba(95,65,30,0.3)'); R(px - 0.4, 1.3, px + 0.4, 4.7, '#c3995c'); R(px - 0.45, 4.7, px + 0.45, 4.8, 'rgba(255,235,190,0.35)');
  }
  R(-1.25, 0.7, 1.25, 4.15, '#d6b277'); R(-0.8, 0.7, 0.8, 3.6, '#17120e'); R(-0.8, 3.6, 0.8, 3.95, '#d6b277');
  g.fillStyle = '#dcb87a'; g.beginPath(); g.moveTo(X(-1.55), Y(4.15)); g.quadraticCurveTo(X(0), Y(5.5), X(1.55), Y(4.15)); g.closePath(); g.fill();
  g.fillStyle = '#c3995c'; g.beginPath(); g.moveTo(X(-1.1), Y(4.3)); g.quadraticCurveTo(X(0), Y(5.1), X(1.1), Y(4.3)); g.closePath(); g.fill();
  for (const s of [-1, 1]) R(s * 1.25 - 0.18, 3.5, s * 1.25 + 0.18, 4.15, '#d6b277');
  // the entablature: architrave, plain frieze, a projecting cornice
  R(-4, V_COR - 0.05, 4, V_COR + 0.5, '#c8a164'); R(-4, V_COR + 0.0, 4, V_COR + 0.08, 'rgba(60,35,15,0.4)');
  t.under(V_COR - 0.05, 1.3, 0.3);
  streaks(g, w, h, 18, 8102, 0.13, 100, '80,55,30');
  t.foot(2.5, 0.3);
}
function buildVenera() {
  initShared();
  const pts = pairsOf(VE.p), gr = groundRange(pts), W = VF.toWorld;
  const y0 = Math.min(groundY(...W(-3.5, 2)), groundY(...W(3.5, 2)), groundY(...W(0, 3)));
  const F = frame(VE.O[0], y0, VE.O[1], VE.N[0], VE.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bnveFront', 384, 384, [V_FW, V_FH], paintVeneraFront);
  defMat('bnveWall', 128, 256, [4.5, V_EAVE], (g, w, h) => paintBay(g, w, h, V_EAVE, { course: 0.5, block: 1.1, base: '#b79868', joint: '#8a7050', seed: 8121, plinth: '#9c8058', pil: null, win: 'none', cornice: '#c0a272', stains: true, vary: 0.1 }));
  defMat('bnveNave', 128, 256, [4.5, V_EAVE], (g, w, h) => paintBay(g, w, h, V_EAVE, { course: 0.5, block: 1.2, base: '#bb9c6a', joint: '#8a7050', seed: 8131, plinth: '#9c8058', pil: null, win: 'narrow', frame: '#d2b47c', cornice: '#c0a272', stains: true, vary: 0.1 }));
  begin(y0);
  const body = VF.clipFront(pts, -0.1);
  prism('bnveWall', body, Math.min(gr.lo, y0) - 1.5, y0 + V_LOW, { uvo: [0, -y0 / V_EAVE] });
  prism('flat', body, y0 + V_LOW, y0 + V_LOW + 0.1, { c: '#b3a387' });
  bx('bnveNave', F, -V_NW, V_NW, V_LOW, V_EAVE, -0.1, -26.0, { uvo: [0, -(y0 + V_LOW) / V_EAVE] });
  bx('bnveNave', F, -V_NW, V_NW, 0, V_LOW, -0.1, -26.0, { uvo: [0, -y0 / V_EAVE] });
  gable('tile', 'bnveWall', at(0, 0, -13.6), V_NW * 2, 24.8, V_EAVE, V_RISE, { ov: 0.3, c: '#a8704c', wc: '#b79868' });
  // the front: the painted tuff face with the narrower attic and its curved top
  const s = new THREE.Shape();
  s.moveTo(-4, 0); s.lineTo(4, 0); s.lineTo(4, V_COR + 0.5); s.lineTo(3.0, V_COR + 0.5); s.lineTo(3.0, V_ATT); s.quadraticCurveTo(0, V_ATT + 1.0, -3.0, V_ATT); s.lineTo(-3.0, V_COR + 0.5); s.lineTo(-4, V_COR + 0.5); s.lineTo(-4, 0);
  extrude('bnveFront', s, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / V_FW, 1 / V_FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -4.3, 4.3, V_COR - 0.35, V_COR + 0.55, -1.0, 0.45, { c: '#c8a164', noao: true });
  bx('flat', F, -4.45, 4.45, V_COR + 0.45, V_COR + 0.7, -1.0, 0.55, { c: '#d2ac6c', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 3.5 - 0.75, sg * 3.5 + 0.75, V_COR - 1.05, V_COR - 0.35, -0.9, 0.35, { c: '#d2ac6c', noao: true });
    bx('flat', F, sg * 3.7 - 0.5, sg * 3.7 + 0.5, V_COR + 0.65, V_COR + 1.05, -0.8, 0.3, { c: '#dcb87a', noao: true });
    urn(F, sg * 3.7, V_COR + 1.05, -0.25, 1.0, '#dcc08a');
    bx('flat', F, sg * 1.62 - 0.3, sg * 1.62 + 0.3, 0.7, 0.9, -0.05, 0.18, { c: '#c0985c', noao: true });
  }
  bx('flat', F, -1.2, 1.2, 0, 0.2, -0.05, 0.55, { c: '#cfc2a4', noao: true });
  // a small belfry with three arched openings, standing at the back on the low side buildings
  bx('bnveWall', F, 5.0, 7.4, V_LOW, V_LOW + 3.6, -21.9, -19.5, { uvo: [0, -(y0 + V_LOW) / V_EAVE] });
  for (const x of [5.45, 6.2, 6.95]) bx('dark', F, x - 0.2, x + 0.2, V_LOW + 1.5, V_LOW + 2.7, -19.55, -19.45, { c: '#1a1612', noao: true });
  bx('flat', F, 4.9, 7.5, V_LOW + 3.6, V_LOW + 3.85, -22.0, -19.4, { c: '#c0a272', noao: true });
  const o = end('Chiesa di Santa Venera');
  o.userData.solids = [[VE.p, null, y0 + V_LOW], [VF.ring(-V_NW, V_NW, -26.0, -0.1), null, y0 + V_EAVE + V_RISE]];
  return o;
}
export const SANTA_VENERA = { name: 'Chiesa di Santa Venera', x: 632, z: 335, radius: 30, skipIds: [VE.id], build: buildVenera };

// =====================================================================================================================================
// SANTA MARIA DEI NAUFRAGHI: golden sandstone, a nave front 8.4 m with a low pediment, a plain bay with a bell tower on the right, 13.1 m in all, 21 m deep
// =====================================================================================================================================
const NA = { id: 'w232901239', p: [705.6, 653.5, 696.5, 635.7, 708.5, 630.4, 718, 649.2, 710.5, 652.7, 709.9, 651.6], O: [702.5, 633.05], N: [-0.404, -0.9148] };
const NF = mkFrame(NA.O, NA.N);
const N_FW = 13.12, N_X0 = -6.56, N_XN = 1.95, N_EAVE = 8.0, N_APEX = 10.3, N_TOWER = 12.4, N_FH = 13.6, N_NCX = (N_X0 + N_XN) / 2, N_NW = N_XN - N_X0;
function paintNaufraghiFront(g, w, h) {
  const t = tools(g, w, h, N_FW, N_FH), { R, X, Y, arch, point, sx, sy } = t;
  paintAshlar(g, w, h, N_FW, N_FH, 0.4, 1.0, '#cf9f58', '#e6d3a4', 8201, 1.6, 0.06);
  noiseDots(g, w, h, w * h / 50, 2, 8203, ['rgba(150,100,40,0.1)', 'rgba(255,240,195,0.1)', 'rgba(90,60,25,0.08)']);
  t.stains(9, 8204, '95,65,30');
  R(-N_FW / 2, 0, N_FW / 2, 0.55, '#b9894a');
  const pil = (x, ww) => { R(x - ww / 2, 0.55, x + ww / 2, 6.8, '#d8ab66'); R(x + ww / 2 - 0.1, 0.55, x + ww / 2, 6.8, 'rgba(70,45,20,0.28)'); R(x - ww / 2 - 0.12, 6.8, x + ww / 2 + 0.12, 7.2, '#e0b974'); R(x - ww / 2, 0.55, x - ww / 2 + 0.06, 6.8, 'rgba(255,240,200,0.3)'); };
  pil(N_X0 + 0.6, 1.2); pil(N_XN - 0.55, 1.1);
  // the entablature under the pediment
  R(N_X0, 7.15, N_XN, N_EAVE, '#d8ab66'); R(N_X0, 7.15, N_XN, 7.25, 'rgba(60,40,20,0.4)'); R(N_X0, N_EAVE - 0.12, N_XN, N_EAVE, '#e2bd7a');
  // door: double doors of dark wood with diamond panels, a frame, a hood, and a fanlight in an arch
  const dx = N_NCX;
  R(dx - 1.6, 0.55, dx + 1.6, 4.5, '#dcb470'); R(dx - 1.3, 0.55, dx + 1.3, 4.25, '#4a2a1c'); R(dx - 0.03, 0.55, dx + 0.03, 4.25, '#1e120c');
  for (const x0 of [dx - 1.22, dx + 0.1]) for (let r = 0; r < 4; r++) { R(x0, 0.8 + r * 0.82, x0 + 1.12, 1.45 + r * 0.82, '#5a3524'); g.fillStyle = '#3a1f14'; g.beginPath(); const cx = X(x0 + 0.56), cy = Y(1.12 + r * 0.82); g.moveTo(cx, cy - 0.2 * sy); g.lineTo(cx + 0.18 * sx, cy); g.lineTo(cx, cy + 0.2 * sy); g.lineTo(cx - 0.18 * sx, cy); g.fill(); }
  R(dx - 1.85, 4.5, dx + 1.85, 4.85, '#e6c27e'); R(dx - 1.85, 4.45, dx + 1.85, 4.55, 'rgba(60,40,20,0.45)');
  arch(dx, 4.85, 6.55, 3.3, '#e0bc78'); arch(dx, 4.95, 6.4, 2.75, '#2a3640'); g.strokeStyle = '#8a8a80'; g.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const a = PI * (0.08 + i * 0.14); g.beginPath(); g.moveTo(X(dx), Y(4.95)); g.lineTo(X(dx + Math.cos(a) * 1.4), Y(4.95 + Math.sin(a) * 1.4)); g.stroke(); }
  // the plain bay on the right: a blind arch with a recessed panel under it
  const bxc = 4.45; arch(bxc, 0.7, 5.6, 2.6, 'rgba(110,75,35,0.35)'); arch(bxc, 0.7, 5.45, 2.3, '#c99b55'); R(bxc - 0.6, 0.7, bxc + 0.6, 3.6, 'rgba(90,60,25,0.2)');
  R(N_XN, 7.0, N_FW / 2, 7.5, '#e0b974'); R(N_XN, 7.0, N_FW / 2, 7.08, 'rgba(60,40,20,0.4)'); pil(N_FW / 2 - 0.5, 1.0);
  // the tower: two pointed belfry openings with bells, a corner pilaster each side, a cornice, a small pediment
  R(N_XN, 7.5, N_FW / 2, N_TOWER, '#d0a05a'); R(N_XN, 7.5, N_XN + 0.3, N_TOWER, 'rgba(70,45,20,0.2)');
  for (const x of [3.65, 5.35]) { point(x, 9.4, 12.0, 1.25, '#e6c27e'); point(x, 9.5, 11.85, 0.95, '#1d1814'); R(x - 0.05, 9.5, x + 0.05, 10.3, '#5a4a30'); g.fillStyle = '#6a5438'; g.beginPath(); g.arc(X(x), Y(10.3), 0.22 * sx, 0, PI); g.fill(); }
  R(N_XN, N_TOWER - 0.4, N_FW / 2, N_TOWER, '#e2bd7a'); R(N_XN, N_TOWER - 0.45, N_FW / 2, N_TOWER - 0.35, 'rgba(60,40,20,0.4)');
  g.fillStyle = '#e0b974'; g.beginPath(); g.moveTo(X(N_XN - 0.1), Y(N_TOWER)); g.lineTo(X((N_XN + N_FW / 2) / 2), Y(N_FH)); g.lineTo(X(N_FW / 2 + 0.1), Y(N_TOWER)); g.closePath(); g.fill();
  // the pediment of the nave: a pale raking band and a tympanum of ashlar
  g.fillStyle = '#e2bd7a'; g.beginPath(); g.moveTo(X(N_X0), Y(N_EAVE)); g.lineTo(X(N_NCX), Y(N_APEX)); g.lineTo(X(N_XN), Y(N_EAVE)); g.lineTo(X(N_XN), Y(N_EAVE - 0.22)); g.lineTo(X(N_NCX), Y(N_APEX - 0.28)); g.lineTo(X(N_X0), Y(N_EAVE - 0.22)); g.fill();
  t.under(7.15, 1.2, 0.25); t.under(N_TOWER - 0.4, 1.0, 0.2);
  streaks(g, w, h, 30, 8202, 0.13, 110, '80,55,30');
  t.foot(2.8, 0.34);
}
function buildNaufraghi() {
  initShared();
  const pts = pairsOf(NA.p), gr = groundRange(pts), W = NF.toWorld;
  const y0 = Math.min(groundY(...W(-6, 2)), groundY(...W(0, 3)), groundY(...W(6, 2)));
  const F = frame(NA.O[0], y0, NA.O[1], NA.N[0], NA.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bnnaFront', 384, 384, [N_FW, N_FH], paintNaufraghiFront);
  defMat('bnnaWall', 128, 256, [4.5, N_EAVE], (g, w, h) => paintBay(g, w, h, N_EAVE, { course: 0.4, block: 1.0, base: '#cc9c56', joint: '#e0cd9e', seed: 8221, plinth: '#b9894a', pil: '#d8ab66', win: 'narrow', frame: '#e2bd7a', cornice: '#e0b974', jw: 1.5, vary: 0.06, stains: true }));
  defMat('bnnaTower', 128, 256, [4.5, N_TOWER - N_EAVE], (g, w, h) => paintBay(g, w, h, N_TOWER - N_EAVE, { course: 0.4, block: 1.0, base: '#cc9c56', joint: '#e0cd9e', seed: 8231, plinth: '#cc9c56', pil: '#d8ab66', win: 'none', cornice: '#e0b974', jw: 1.5, vary: 0.06 }));
  begin(y0);
  const body = NF.clipFront(pts, -0.1);
  prism('bnnaWall', body, Math.min(gr.lo, y0) - 1.5, y0 + N_EAVE, { uvo: [0, -y0 / N_EAVE] });
  prism('flat', body, y0 + N_EAVE, y0 + N_EAVE + 0.12, { c: '#a39a8c' });
  gable('tile', 'bnnaWall', at(N_NCX, 0, -10.5), N_NW, 20.6, N_EAVE, N_APEX - N_EAVE, { ov: 0.3, c: '#b87450', wc: '#cc9c56' });
  bx('bnnaTower', F, N_XN, N_FW / 2, N_EAVE, N_TOWER, -4.7, -0.1, { uvo: [0, -(y0 + N_EAVE) / (N_TOWER - N_EAVE)] });
  gable('tile', 'bnnaTower', at((N_XN + N_FW / 2) / 2, 0, -2.4), N_FW / 2 - N_XN, 4.9, N_TOWER, N_FH - N_TOWER, { ov: 0.2, c: '#b87450', wc: '#d0a05a' });
  const s = new THREE.Shape(), hw = N_FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, N_TOWER); s.lineTo((N_XN + hw) / 2, N_FH); s.lineTo(N_XN, N_TOWER); s.lineTo(N_XN, N_EAVE); s.lineTo(N_NCX, N_APEX); s.lineTo(N_X0, N_EAVE); s.lineTo(-hw, 0);
  extrude('bnnaFront', s, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / N_FW, 1 / N_FH], uvo: [0.5, 0], cs: 8, noao: true });
  rake(F, N_NCX, N_EAVE, N_NW, N_APEX - N_EAVE, 0.7, -0.35, '#e0b974');
  bx('flat', F, N_X0 - 0.3, N_XN + 0.3, N_EAVE - 0.3, N_EAVE + 0.05, -1.0, 0.45, { c: '#e0b974', noao: true });
  bx('flat', F, N_XN - 0.1, hw + 0.15, 7.0, 7.4, -1.0, 0.3, { c: '#e0b974', noao: true });
  bx('flat', F, N_XN - 0.1, hw + 0.15, N_TOWER - 0.4, N_TOWER, -1.0, 0.25, { c: '#e2bd7a', noao: true });
  for (const x of [N_X0 + 0.6, N_XN - 0.55]) { bx('flat', F, x - 0.8, x + 0.8, 6.7, 7.25, -1.0, 0.3, { c: '#e0b974', noao: true }); bx('flat', F, x - 0.62, x + 0.62, 0.5, 0.95, -0.05, 0.25, { c: '#c99b55', noao: true }); }
  bx('flat', F, N_NCX - 1.95, N_NCX + 1.95, 4.45, 4.9, -0.05, 0.4, { c: '#e6c27e', noao: true });
  bx('flat', F, N_NCX - 1.6, N_NCX + 1.6, 0, 0.18, -0.05, 0.45, { c: '#cfc2a4', noao: true });
  cross(F, N_NCX, N_APEX + 0.05, -0.2, 1.5, '#4a4640');
  const o = end('Santa Maria dei Naufraghi');
  o.userData.solids = [[NA.p, null, y0 + N_EAVE], [NF.ring(N_X0, N_XN, -20.9, -0.1), null, y0 + N_APEX], [NF.ring(N_XN, hw, -4.7, -0.1), null, y0 + N_FH]];
  return o;
}
export const SANTA_MARIA_NAUFRAGHI = { name: 'Santa Maria dei Naufraghi', x: 707, z: 642, radius: 30, skipIds: [NA.id], build: buildNaufraghi };

// =====================================================================================================================================
// SANTA ROSALIA: red brick panels in pale limestone, a pedimented centre bay and a huge arched portal, a tall drum with a majolica dome behind
// =====================================================================================================================================
const RO = { id: 'w278478111', p: [-957.2, -1734.2, -975.9, -1728.4, -975.1, -1725.9, -979.5, -1724.5, -980.2, -1726.8, -980.6, -1728.1, -981.8, -1727.8, -984.5, -1736.5, -983.1, -1737, -983.8, -1739.4, -980.2, -1740.5, -979.5, -1738.2, -960.3, -1744.1], O: [-958.75, -1739.15], N: [0.9543, -0.2988] };
const RF = mkFrame(RO.O, RO.N);
const R_FW = 10.4, R_FH = 14.2, R_WING = 8.8, R_BASE = 11.9, R_APEX = 14.0, R_EAVE = 10.0, R_RISE = 2.2, R_DZ = -21.5;
const BRICK = '#a84c38', STONE = '#d9cfb8', STONEH = '#e6dec9';
function paintRosaliaFront(g, w, h) {
  const t = tools(g, w, h, R_FW, R_FH), { R, X, Y, arch, sx, sy } = t;
  paintAshlar(g, w, h, R_FW, R_FH, 0.55, 1.5, STONE, '#b9ae96', 8301, 1.0, 0.04);
  noiseDots(g, w, h, w * h / 50, 2, 8303, ['rgba(120,90,60,0.09)', 'rgba(255,250,235,0.08)', 'rgba(70,55,40,0.07)']);
  t.stains(8, 8304, '90,70,50');
  const panel = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, STONEH); R(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, BRICK); noiseDots(g, w, h, 0, 1, 1, ['#000']); for (let y = y0 + 0.15; y < y1 - 0.1; y += 0.22) R(x0 + 0.1, y, x1 - 0.1, y + 0.025, 'rgba(60,20,10,0.22)'); R(x0 + 0.1, y1 - 0.45, x1 - 0.1, y1 - 0.1, 'rgba(0,0,0,0.0)'); };
  R(-5.2, 0, 5.2, 0.6, '#c4baa2');
  // the wings: two stacked brick panels, a banded cornice with a balustrade, a pilaster at each outer end
  for (const s of [-1, 1]) {
    const a = s > 0 ? 2.8 : -5.2, b = s > 0 ? 5.2 : -2.8;
    panel(a + (s > 0 ? 0.2 : 1.0), 0.8, b - (s > 0 ? 1.0 : 0.2), 3.9); panel(a + (s > 0 ? 0.2 : 1.0), 4.7, b - (s > 0 ? 1.0 : 0.2), 7.5);
    R(a, 7.7, b, 8.0, STONEH); R(a, 8.0, b, R_WING, STONE); for (let x = a + 0.15; x < b - 0.1; x += 0.3) R(x, 8.1, x + 0.12, 8.6, '#c2b79f');
    R(s * 4.75 - 0.45, 0.6, s * 4.75 + 0.45, 8.0, STONEH); R(s * 4.75 + (s > 0 ? 0.35 : -0.45), 0.6, s * 4.75 + (s > 0 ? 0.45 : -0.35), 8.0, 'rgba(60,45,30,0.28)');
  }
  R(-5.2, 3.9, 5.2, 4.7, STONE); R(-5.2, 3.9, 5.2, 4.0, 'rgba(60,45,30,0.25)');
  // the centre bay: tall pilasters, a big portal with a ring of voussoirs, an inscription band, brick panels and a statue niche, the pediment
  for (const s of [-1, 1]) { R(s * 2.5 - 0.35, 0.6, s * 2.5 + 0.35, R_BASE, STONEH); for (const dx of [-0.15, 0, 0.15]) R(s * 2.5 + dx - 0.015, 1.0, s * 2.5 + dx + 0.015, R_BASE - 0.4, 'rgba(60,45,30,0.25)'); R(s * 2.5 - 0.45, R_BASE - 0.35, s * 2.5 + 0.45, R_BASE, STONEH); }
  R(-2.15, 0.6, 2.15, R_BASE, STONE);
  panel(-2.0, 8.9, -1.05, 11.5); panel(1.05, 8.9, 2.0, 11.5); R(-1.0, 8.8, 1.0, 12.0, STONEH);
  arch(0, 8.9, 11.9, 1.7, '#e4dcc7'); arch(0, 9.05, 11.75, 1.4, '#3a3028'); R(-0.25, 9.05, 0.25, 10.8, '#2a221c'); g.fillStyle = '#17120f'; g.beginPath(); g.ellipse(X(0), Y(10.15), 0.32 * sx, 0.75 * sy, 0, 0, 2 * PI); g.fill(); g.beginPath(); g.arc(X(0), Y(11.25), 0.2 * sx, 0, 2 * PI); g.fill(); R(-0.42, 8.9, 0.42, 9.1, '#cfc4a8');
  R(-2.15, 7.75, 2.15, 8.8, STONEH); for (let x = -1.8; x < 1.9; x += 0.16) R(x, 8.05, x + 0.05, 8.5, 'rgba(60,45,30,0.45)'); R(-2.15, 7.75, 2.15, 7.85, 'rgba(60,45,30,0.3)');
  panel(-2.0, 4.9, -1.5, 7.5); panel(1.5, 4.9, 2.0, 7.5);
  R(-2.15, 4.9, 2.15, 7.7, STONE); R(-2.0, 7.0, -1.45, 7.55, BRICK); R(1.45, 7.0, 2.0, 7.55, BRICK);
  g.fillStyle = '#e4dcc7'; g.beginPath(); g.moveTo(X(-2.1), Y(0.6)); g.lineTo(X(-2.1), Y(4.6)); g.arc(X(0), Y(4.6), 2.1 * sx, PI, 0); g.lineTo(X(2.1), Y(0.6)); g.fill();
  for (let i = 0; i < 17; i++) { const a = PI * (1 - i / 16); g.strokeStyle = 'rgba(70,55,40,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X(Math.cos(a) * 1.25), Y(4.6 + Math.sin(a) * 1.25)); g.lineTo(X(Math.cos(a) * 2.1), Y(4.6 + Math.sin(a) * 2.1)); g.stroke(); }
  g.fillStyle = '#1c1612'; g.beginPath(); g.moveTo(X(-1.2), Y(0.6)); g.lineTo(X(-1.2), Y(4.6)); g.arc(X(0), Y(4.6), 1.2 * sx, PI, 0); g.lineTo(X(1.2), Y(0.6)); g.fill();
  R(-1.2, 0.6, 1.2, 3.4, '#3a2618'); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) R(-1.15 + c * 0.6, 0.7 + r * 0.7, -0.67 + c * 0.6, 1.2 + r * 0.7, 'rgba(0,0,0,0.25)'); R(-0.03, 0.6, 0.03, 3.4, '#120c08');
  g.fillStyle = '#26303a'; g.beginPath(); g.moveTo(X(-1.1), Y(3.5)); g.lineTo(X(-1.1), Y(4.6)); g.arc(X(0), Y(4.6), 1.1 * sx, PI, 0); g.lineTo(X(1.1), Y(3.5)); g.fill();
  // the pediment: a pale frame, a plain tympanum, a pale raking band
  g.fillStyle = STONEH; g.beginPath(); g.moveTo(X(-2.85), Y(R_BASE)); g.lineTo(X(0), Y(R_APEX)); g.lineTo(X(2.85), Y(R_BASE)); g.closePath(); g.fill();
  g.fillStyle = STONE; g.beginPath(); g.moveTo(X(-2.3), Y(R_BASE + 0.25)); g.lineTo(X(0), Y(R_APEX - 0.55)); g.lineTo(X(2.3), Y(R_BASE + 0.25)); g.closePath(); g.fill();
  R(-2.5, R_BASE - 0.1, 2.5, R_BASE + 0.25, '#cfc4a8');
  t.under(R_BASE, 1.2, 0.22); t.under(R_WING, 1.3, 0.2); t.under(7.7, 1.0, 0.2);
  streaks(g, w, h, 36, 8302, 0.14, 120, '70,50,38');
  t.foot(3.0, 0.34);
}
function buildRosalia() {
  initShared();
  const pts = pairsOf(RO.p), gr = groundRange(pts), W = RF.toWorld;
  const y0 = Math.min(groundY(...W(-4, 2)), groundY(...W(4, 2)), groundY(...W(0, 3)));
  const F = frame(RO.O[0], y0, RO.O[1], RO.N[0], RO.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bnroFront', 384, 384, [R_FW, R_FH], paintRosaliaFront);
  defMat('bnroWall', 128, 256, [4.5, R_EAVE], (g, w, h) => paintBay(g, w, h, R_EAVE, { course: 0.9, block: 2.2, base: '#d79a68', joint: '#c08458', seed: 8321, plinth: '#c4baa2', pil: '#ddd2ba', win: 'arch', frame: '#e6dec9', cornice: '#ddd2ba', jw: 1.0, vary: 0.05, stains: true }));
  defMat('bnroDome', 128, 128, [1, 1], (g, w, h) => {
    g.fillStyle = '#e0a03a'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = i * 32 + (j % 2 ? 16 : 0), cy = j * 32 + 16; g.fillStyle = (i + j) % 2 ? '#d4702a' : '#e8c24c'; g.beginPath(); g.moveTo(cx, cy - 15); g.lineTo(cx + 15, cy); g.lineTo(cx, cy + 15); g.lineTo(cx - 15, cy); g.fill(); g.fillStyle = '#3b8c78'; g.beginPath(); g.arc(cx, cy, 3.5, 0, 2 * PI); g.fill(); }
    noiseDots(g, w, h, 300, 2, 8341, ['rgba(255,255,255,0.1)', 'rgba(60,30,0,0.12)']);
  });
  begin(y0);
  const body = RF.clipFront(pts, -0.1);
  prism('bnroWall', body, Math.min(gr.lo, y0) - 1.5, y0 + R_EAVE, { uvo: [0, -y0 / R_EAVE] });
  prism('flat', body, y0 + R_EAVE, y0 + R_EAVE + 0.12, { c: '#a39a8c' });
  gable('tile', 'bnroWall', at(0, 0, -9.3), 9.6, 17.6, R_EAVE, R_RISE, { ov: 0.3, c: '#b0704c', wc: '#d79a68' });
  bx('flat', F, -5.1, 5.1, R_EAVE, R_EAVE + 0.25, -0.1, -17.8, { c: '#ddd2ba', noao: true });   // (no taller than this, or its edges show through the roof along the eaves)
  const s = new THREE.Shape(), hw = R_FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, R_WING); s.lineTo(2.85, R_WING); s.lineTo(2.85, R_BASE); s.lineTo(0, R_APEX); s.lineTo(-2.85, R_BASE); s.lineTo(-2.85, R_WING); s.lineTo(-hw, R_WING); s.lineTo(-hw, 0);
  extrude('bnroFront', s, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / R_FW, 1 / R_FH], uvo: [0.5, 0], cs: 8, noao: true });
  rake(F, 0, R_BASE, 6.0, R_APEX - R_BASE, 0.7, -0.35, '#e6dec9', 0.34);
  bx('flat', F, -3.15, 3.15, R_BASE - 0.3, R_BASE + 0.05, -1.0, 0.5, { c: '#e6dec9', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 4.75 - 0.6, sg * 4.75 + 0.6, R_WING - 0.35, R_WING + 0.05, -1.0, 0.4, { c: '#e6dec9', noao: true });
    bx('flat', F, sg * 4.75 - 0.5, sg * 4.75 + 0.5, R_WING + 0.05, R_WING + 1.5, -0.95, -0.05, { c: '#ddd2ba', noao: true });
    bx('flat', F, sg * 4.75 - 0.62, sg * 4.75 + 0.62, R_WING + 1.5, R_WING + 1.8, -1.0, 0.1, { c: '#e6dec9', noao: true });
    bx('flat', F, sg * 4.75 - 0.4, sg * 4.75 + 0.4, R_WING + 1.8, R_WING + 2.0, -0.9, 0.0, { c: '#cfc4a8', noao: true });
    bx('flat', F, sg * 2.5 - 0.5, sg * 2.5 + 0.5, 0.6, 0.9, -0.05, 0.2, { c: '#c4baa2', noao: true });
  }
  bx('flat', F, -2.3, 2.3, 0, 0.2, -0.05, 0.45, { c: '#cfc2a4', noao: true });
  cross(F, 0, R_APEX + 0.05, -0.4, 1.7, '#d9cfb8');
  // the crossing: a square base, a tall drum with eight windows, the majolica dome, a lantern and a cross
  const DC = at(0, R_EAVE, R_DZ);
  bx('bnroWall', DC, -3.8, 3.8, 0, 2.2, -3.8, 3.8, { uvo: [0, -(y0 + R_EAVE) / R_EAVE] });
  bx('flat', DC, -3.95, 3.95, 2.2, 2.45, -3.95, 3.95, { c: '#ddd2ba', noao: true });
  for (const sx_ of [-1, 1]) for (const sz of [-1, 1]) bx('flat', DC, sx_ * 3.3 - 0.35, sx_ * 3.3 + 0.35, 2.45, 3.5, sz * 3.3 - 0.35, sz * 3.3 + 0.35, { c: '#d79a68', noao: true });
  const DR = 3.1, DY = 2.45;
  cyl('flat', DR, DR + 0.05, 3.0, 16, { M: mul(DC, tr(0, DY, 0)), c: '#d79a68' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI + PI / 8, M = mul(DC, mul(tr(0, DY, 0), mul(rotY(a), tr(0, 0, DR + 0.05)))); bx('flat', M, -0.5, 0.5, 0.5, 2.5, -0.05, 0.14, { c: '#e6dec9', noao: true }); bx('dark', M, -0.28, 0.28, 0.8, 2.2, 0.05, 0.16, { c: '#242b33', noao: true }); }
  lathe('flat', [[DR + 0.4, DY + 3.0], [DR + 0.4, DY + 3.25], [DR - 0.1, DY + 3.35]], 16, { M: DC, c: '#ddd2ba' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI * 0.5; prof.push([(DR - 0.1) * Math.cos(a), DY + 3.35 + 3.4 * Math.sin(a)]); }
  lathe('bnroDome', prof, 16, { M: DC, noao: true, uv: 'keep', uvk: [8, 1] });
  cyl('flat', 0.75, 0.85, 1.4, 8, { M: mul(DC, tr(0, DY + 6.7, 0)), c: '#d79a68' }); sphere('bnroDome', 0.8, { M: mul(DC, tr(0, DY + 8.2, 0)), ky: 1.15, seg: 8, noao: true });
  cross(DC, 0, DY + 9.0, 0, 1.5, '#3e3a36');
  const o = end('Chiesa di Santa Rosalia');
  o.userData.solids = [[RO.p, null, y0 + R_EAVE], [RF.ring(-4.8, 4.8, -17.8, -0.1), null, y0 + R_EAVE + R_RISE], [RF.ring(-3.8, 3.8, R_DZ - 3.8, R_DZ + 3.8), null, y0 + R_EAVE + 12]];
  return o;
}
export const SANTA_ROSALIA = { name: 'Chiesa di Santa Rosalia', x: -970, z: -1733, radius: 36, skipIds: [RO.id], build: buildRosalia };

export const BATCH_N = [SANTA_VENERA, SANTA_MARIA_NAUFRAGHI, SANTA_ROSALIA];
