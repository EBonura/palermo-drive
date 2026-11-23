// City landmarks, batch K: four churches of Palermo drawn from reference photos. Registered in src/landmarks-city.js as BATCH_K.
// Each model is one frame F: origin on the ground in the middle of the real front, +z out of the front, local x to the right of a visitor facing the front. The front direction comes from the photos and the streets.
// Reference photos (Wikimedia Commons, looked at, nothing copied, only proportions and colours read):
// San Francesco Saverio: St. Francis Xavier church.JPG, SFS PA 15 07 2018 01.jpg, Chiesa di San Francesco Saverio.JPG. Read: a golden sandstone front with cream plaster panels, lower order of four niches, two pairs of detached columns and a central portal
//   with two twisted columns, a narrow upper order with a pediment, a bell tower on the right (east) of the front in four stages (clock, belfry with arches, small top), a balustraded roof, a big drum with paired pilasters and framed windows, a lead dome with a lantern, small red domes.
// Santa Maria della Mercede: Chiesa di Santa Maria della Mercede al Capo (Palermo).JPG, Chiesa di Santa Maria della Mercede al Capo - panoramio.jpg. Read: a narrow sand-coloured front, a rusticated pilaster strip at each corner, a framed portal with two half pediments and a Madonna niche over it,
//   a round window, an inscription band, a triangular pediment with a shield and a cross, a small bell gable with two arches behind on the left.
// Santa Maria dei Miracoli: Chiesa di Santa Maria dei Miracoli (Palermo) - facciata 1.JPG, facciata 2.JPG, Santa Maria dei Miracoli - Palermo - Italy 2015.JPG. Read: a pale limestone ashlar front in two storeys, two fluted columns and two corner pilasters, a portal with a blank lunette,
//   a framed window each side, a cartouche, a heavy cornice, a plain upper wall with one round window, a straight top cornice with a scrolled gable in the middle, stepped merlons at the back right.
// Sant'Andrea (degli Amalfitani, called Armatori in the map): Sant'Andrea - Facciata.jpg. Read: a white plastered front with golden stone pilasters, three bays and three doors (an arched middle portal, a small pedimented door each side), framed windows above, a narrow upper order
//   with a round window under a triangular pediment, a scroll each side, a bell gable behind on the left.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, panel, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, archShape, balus, paintAshlar, RNG } from './lmc-kit.js';

// ---------------------------------------------------------------------------- shared helpers
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
  return { toWorld, toLocal, clipFront, ring };
}
// a painter for a front covering FW x FH metres, x from xl, y up from the ground
function pen(g, w, h, FW, FH, xl) {
  const sx = w / FW, sy = h / FH, X = x => (x - xl) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const ell = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); };
  // a stone strip: body, a light edge on the left, a shaded edge on the right, courses every `cs` metres
  const strip = (x, y0, y1, ww, c, cs) => {
    R(x - ww / 2, y0, x + ww / 2, y1, c); R(x - ww / 2, y0, x - ww / 2 + 0.09, y1, 'rgba(255,240,205,0.35)'); R(x + ww / 2 - 0.1, y0, x + ww / 2, y1, 'rgba(50,32,18,0.3)');
    if (cs) for (let y = y0 + cs; y < y1 - 0.1; y += cs) R(x - ww / 2, y, x + ww / 2, y + 0.06, 'rgba(60,40,20,0.3)');
  };
  return { sx, sy, X, Y, R, arch, circ, tri, poly, ell, strip };
}
// wear on a painted surface: big soft stains, soot streaks from the ledges, grime at the foot, a fine grain
function wear(g, w, h, seed, k = 1) {
  const r = RNG(seed + 91);
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.25) * Math.max(w, h), q = r(), c = q < 0.55 ? '60,44,28' : q < 0.8 ? '255,246,224' : '120,100,70', a = (0.05 + r() * 0.09) * k;
    const gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  streaks(g, w, h, Math.round(w / 7), seed + 3, 0.13 * k, h * 0.4, '50,38,28');
  const gb = g.createLinearGradient(0, h, 0, h * 0.8); gb.addColorStop(0, `rgba(40,30,20,${0.3 * k})`); gb.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gb; g.fillRect(0, h * 0.8, w, h * 0.2);
  noiseDots(g, w, h, w * h / 80, 1.6, seed + 5, ['rgba(255,250,235,0.07)', 'rgba(50,40,28,0.09)']);
}
// a wall texture: ashlar blocks (or plain plaster when block is 0) plus wear
function paintWall(g, w, h, tw, th, base, joint, seed, block = 1.1) {
  if (block) paintAshlar(g, w, h, tw, th, 0.55, block, base, joint, seed, 1.2, 0.06);
  else { g.fillStyle = base; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, seed, ['rgba(150,120,80,0.09)', 'rgba(255,248,225,0.09)']); }
  wear(g, w, h, seed, 0.8);
}
// front slab: the painted outline `shape` (x from x0, width FW, height FH) extruded `d` deep, its face just in front of z = -0.05
function slab(F, key, shape, x0, FW, FH, d = 1.3) {
  extrude(key, shape, d, { M: mul(F, tr(0, 0, -d - 0.05)), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [-x0 / FW, 0], cs: 10, noao: true });
}
const arch3 = (key, M, w, h, d, o = {}) => extrude(key, archShape(w, h), d, { M, noao: true, ...o });

// ---------------------------------------------------------------------------- San Francesco Saverio
const SFS = { id: 'w49789495', name: 'Chiesa di San Francesco Saverio', O: [-240.4, 700.2], N: [0.388, 0.922], c: [-248, 686], r: 48, p: [-252.3, 679.6, -243.8, 673.2, -245.5, 670.5, -241.6, 668.1, -239.2, 672.2, -240.9, 673.2, -237.4, 678.4, -236, 677.7, -230.9, 685.9, -231.7, 686.4, -227, 693, -232.2, 696.7, -248.6, 703.6, -257.9, 707.7, -265.5, 691.1, -251.3, 681.5] };
const SXC = -5, SX0 = -19, SFW = 28, SFH = 21, SLO = 11.2;
function paintSfsFront(g, w, h) {
  const { R, arch, circ, tri, poly, ell, strip, X, Y, sx } = pen(g, w, h, SFW, SFH, SX0);
  const PL = '#eadcbc', ST = '#c9a468', STH = '#dcc08a', STD = '#a98350', xc = SXC;
  g.fillStyle = PL; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 8101, ['rgba(150,110,60,0.08)', 'rgba(255,248,225,0.09)', 'rgba(120,90,50,0.06)']);
  R(-19, 0, 9, 1.0, '#b08c5a'); R(-19, 1.0, 9, 1.15, 'rgba(50,30,15,0.3)');
  // lower order: corner pilasters, four niches in plaster panels, two pairs of columns, the portal bay
  for (const s of [-1, 1]) {
    strip(xc + s * 13.3, 1.0, 9.8, 1.5, ST, 0.7);
    for (const dx of [5.0, 11.0]) {
      const x = xc + s * dx;
      R(x - 1.55, 1.9, x + 1.55, 8.9, 'rgba(150,115,70,0.55)'); R(x - 1.4, 2.05, x + 1.4, 8.75, PL);
      arch(x, 2.6, 7.0, 1.7, '#b79c74'); arch(x, 2.75, 6.8, 1.35, '#8c7352'); R(x - 0.8, 2.6, x + 0.8, 2.75, STH);
    }
    for (const dx of [7.4, 8.6]) { const x = xc + s * dx; R(x - 0.55, 1.0, x + 0.55, 9.0, '#e2d2aa'); R(x - 0.55, 1.0, x - 0.4, 9.0, 'rgba(255,250,235,0.5)'); R(x + 0.38, 1.0, x + 0.55, 9.0, 'rgba(80,55,30,0.35)'); R(x - 0.7, 8.6, x + 0.7, 9.4, STH); R(x - 0.7, 1.0, x + 0.7, 1.35, STH); }
    R(xc + s * 8.0 - 1.3, 1.0, xc + s * 8.0 + 1.3, 1.1, ST);
  }
  R(-19, 9.4, 9, 11.2, ST); R(-19, 9.4, 9, 9.55, 'rgba(50,30,15,0.4)'); R(-19, 10.6, 9, 11.2, STH); for (let x = -19; x < 9; x += 0.7) R(x, 10.1, x + 0.35, 10.5, 'rgba(120,85,45,0.35)');
  // the portal: tall doorway, two twisted columns, relief and entablature over it
  R(xc - 2.5, 1.0, xc + 2.5, 8.4, PL);
  arch(xc, 1.0, 5.6, 3.2, '#c9aa6d'); arch(xc, 1.0, 5.2, 2.4, '#2d2217'); R(xc - 0.03, 1.0, xc + 0.03, 4.0, '#16100a');
  for (const s of [-1, 1]) { const x = xc + s * 1.75; R(x - 0.3, 1.0, x + 0.3, 5.4, '#e4d4aa'); for (let y = 1.2; y < 5.3; y += 0.45) poly([[x - 0.32, y], [x + 0.32, y + 0.28], [x + 0.32, y + 0.4], [x - 0.32, y + 0.12]], 'rgba(120,85,45,0.45)'); }
  R(xc - 2.7, 5.6, xc + 2.7, 6.3, STH); R(xc - 2.7, 5.6, xc + 2.7, 5.7, 'rgba(50,30,15,0.35)');
  ell(xc, 7.4, 1.05, 1.2, '#c9aa6d'); ell(xc, 7.4, 0.85, 1.0, '#e6dcc2'); R(xc - 0.3, 6.9, xc + 0.3, 8.0, '#cbbf9f'); circ(xc, 8.2, 0.2, '#cbbf9f');
  // upper order: narrow, paired columns, a framed window, entablature, pediment with a cartouche, scrolls down to the lower cornice
  poly([[xc - 8.3, SLO], [xc - 5.1, SLO + 0.3], [xc - 4.9, SLO + 4.6], [xc - 5.1, SLO + 6.2], [xc + 5.1, SLO + 6.2], [xc + 4.9, SLO + 4.6], [xc + 5.1, SLO + 0.3], [xc + 8.3, SLO]], PL);
  for (const s of [-1, 1]) {
    for (const dx of [4.0, 2.8]) strip(xc + s * dx, SLO + 0.5, SLO + 5.6, 0.85, ST, 0);
    poly([[xc + s * 5.0, SLO + 0.6], [xc + s * 6.6, SLO + 0.4], [xc + s * 8.2, SLO], [xc + s * 5.0, SLO]], ST);
    circ(xc + s * 6.0, SLO + 1.2, 0.5, STH); circ(xc + s * 6.0, SLO + 1.2, 0.28, STD);
  }
  R(xc - 1.2, 12.6, xc + 1.2, 16.6, ST); R(xc - 0.85, 12.95, xc + 0.85, 16.25, '#3a2f26'); R(xc - 0.03, 12.95, xc + 0.03, 16.25, '#7a5e3c'); R(xc - 0.85, 14.5, xc + 0.85, 14.56, '#7a5e3c'); tri(xc - 1.6, xc + 1.6, 16.6, 0.8, STH);
  R(xc - 5.3, 17.0, xc + 5.3, 17.8, ST); R(xc - 5.3, 17.0, xc + 5.3, 17.12, 'rgba(50,30,15,0.4)');
  tri(xc - 5.6, xc + 5.6, 17.8, 2.8, STH); tri(xc - 4.7, xc + 4.7, 18.0, 2.35, PL); ell(xc, 19.2, 0.9, 0.6, '#d8c9a2'); ell(xc, 19.2, 0.65, 0.4, '#b79c6c');
  for (const y of [9.4, 17.0]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.8)); gs.addColorStop(0, 'rgba(50,30,15,0.3)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.8 * w / SFW); }
  wear(g, w, h, 8102, 1);
}
function buildSfs() {
  initShared();
  const M = mkFrame(SFS.O, SFS.N), pts = pairsOf(SFS.p), gr = groundRange(pts), W = M.toWorld;
  const y0 = Math.min(groundY(...W(-15, 2)), groundY(...W(-5, 3)), groundY(...W(8, 2)));
  const F = frame(SFS.O[0], y0, SFS.O[1], SFS.N[0], SFS.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bkSfFront', 384, 288, [SFW, SFH], paintSfsFront);
  defMat('bkSfWall', 256, 256, [7, 7], (g, w, h) => paintWall(g, w, h, 7, 7, '#c9a56c', '#a8854f', 8111, 1.3));
  begin(y0);
  prism('bkSfWall', M.clipFront(pts, -0.1), Math.min(gr.lo, y0) - 1.5, y0 + SLO, { uvo: [0, -y0 / 7] });
  prism('flat', M.clipFront(pts, -0.1), y0 + SLO, y0 + SLO + 0.12, { c: '#a39a8c' });
  // front slab: lower order full width, upper order narrow with a pediment, concave scrolls between
  const xc = SXC, s = new THREE.Shape();
  s.moveTo(-19, 0); s.lineTo(9, 0); s.lineTo(9, SLO); s.lineTo(xc + 8.3, SLO); s.bezierCurveTo(xc + 6.2, SLO + 0.2, xc + 5.1, SLO + 1.4, xc + 5.0, SLO + 4.6); s.lineTo(xc + 5.1, SLO + 6.2); s.lineTo(xc + 5.6, SLO + 6.6);
  s.lineTo(xc, SLO + 9.4); s.lineTo(xc - 5.6, SLO + 6.6); s.lineTo(xc - 5.1, SLO + 6.2); s.lineTo(xc - 5.0, SLO + 4.6); s.bezierCurveTo(xc - 5.1, SLO + 1.4, xc - 6.2, SLO + 0.2, xc - 8.3, SLO); s.lineTo(-19, SLO); s.lineTo(-19, 0);
  slab(F, 'bkSfFront', s, SX0, SFW, SFH);
  // relief: entablatures, column pairs, twisted portal columns, pilasters
  bx('flat', F, -19.3, 9.3, 9.4, 11.2, -1.45, 0.55, { c: '#d3b67e', noao: true });
  bx('flat', F, xc - 5.8, xc + 5.8, 17.0, 17.8, -1.45, 0.4, { c: '#d3b67e', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, xc + sg * 13.3 - 0.75, xc + sg * 13.3 + 0.75, 1.0, 9.4, -0.05, 0.3, { c: '#c9a468', noao: true });
    for (const dx of [7.4, 8.6]) { cyl('plaster', 0.5, 0.55, 8.3, 10, { p: [xc + sg * dx, 1.0, 0.6], M: F, c: '#e6d6ae', noao: true }); bx('flat', F, xc + sg * dx - 0.7, xc + sg * dx + 0.7, 9.0, 9.4, -0.1, 1.3, { c: '#d9bf86', noao: true }); }
    bx('flat', F, xc + sg * 8.0 - 1.6, xc + sg * 8.0 + 1.6, 1.0, 1.4, -0.1, 1.3, { c: '#d9bf86', noao: true });
    cyl('plaster', 0.3, 0.3, 4.5, 8, { p: [xc + sg * 1.75, 1.0, 0.5], M: F, c: '#e6d6ae', noao: true }); bx('flat', F, xc + sg * 1.75 - 0.45, xc + sg * 1.75 + 0.45, 5.5, 5.9, 0.1, 0.9, { c: '#d9bf86', noao: true });
    for (const dx of [2.8, 4.0]) cyl('plaster', 0.4, 0.42, 5.0, 8, { p: [xc + sg * dx, SLO + 0.5, 0.35], M: F, c: '#e6d6ae', noao: true });
  }
  bx('flat', F, xc - 2.2, xc + 2.2, 5.5, 6.0, -0.1, 1.0, { c: '#d9bf86', noao: true });
  bx('dark', F, xc - 1.1, xc + 1.1, 0, 0.05, 0.1, 1.2, { c: '#6d6458', noao: true });
  // balustrade along the roof beside the upper order and along the west side
  balus(at(-14.6, SLO, -0.5), 8.8, 1.2, { c: '#ece0c4' }); balus(at(4.6, SLO, -0.5), 8.8, 1.2, { c: '#ece0c4' });
  balus(mul(F, mul(tr(-18.8, SLO, -9.5), rotY(-PI / 2))), 18, 1.2, { c: '#ece0c4' });
  // bell tower, four stages, in the east end of the front (x 9 to 15)
  const xt = 12.0, TW = 'bkSfWall', cap = '#d9bd86';
  bx(TW, F, 9.0, 15.0, 0, 13.0, -7.6, -1.4, { uvo: [0, -y0 / 7] });
  for (const sg of [9.0, 15.0]) bx('flat', F, sg - 0.35, sg + 0.35, 0, 13.0, -1.55, -1.3, { c: '#c9a468', noao: true });
  bx('flat', F, 8.8, 15.2, 13.0, 13.9, -7.8, -1.2, { c: cap });
  bx(TW, F, 9.5, 14.5, 13.9, 19.2, -7.0, -2.0);
  bx('flat', F, 9.3, 14.7, 19.2, 19.9, -7.2, -1.8, { c: cap });
  bx(TW, F, 9.9, 14.1, 19.9, 25.0, -6.6, -2.4);
  bx('flat', F, 9.7, 14.3, 25.0, 25.7, -6.8, -2.2, { c: cap });
  bx(TW, F, 10.5, 13.5, 25.7, 27.8, -6.0, -3.0);
  cyl('lead', 0.0, 2.1, 2.2, 8, { p: [xt, 27.8, -4.5], M: F, noao: true }); bx('flat', F, xt - 0.07, xt + 0.07, 29.8, 31.2, -4.57, -4.43, { c: '#3d3a36', noao: true }); bx('flat', F, xt - 0.4, xt + 0.4, 30.5, 30.62, -4.57, -4.43, { c: '#3d3a36', noao: true });
  // tower openings on the front and east faces
  for (const [sd, M2] of [['f', at(0, 0, -1.4)], ['e', mul(F, mul(tr(15.0, 0, -4.5), rotY(PI / 2)))]]) {
    const cx = sd === 'f' ? xt : 0;
    arch3('dark', mul(M2, tr(cx, 7.4, 0.01)), 1.3, 3.2, 0.06);
    arch3('flat', mul(M2, tr(cx, 7.1, 0)), 1.9, 3.7, 0.04, { c: '#c9a468' });
    for (const dx of [-0.85, 0.85]) arch3('dark', mul(M2, tr(cx + dx, 20.6, sd === 'f' ? -1.0 : -0.9)), 1.2, 3.2, 0.06);
    cyl('flat', 1.0, 1.0, 0.1, 18, { p: [cx, 16.2, sd === 'f' ? -0.62 : -0.52], M: M2, rx: PI / 2, c: '#f0e8d2', noao: true });
    cyl('flat', 0.12, 0.12, 0.12, 6, { p: [cx, 16.2, sd === 'f' ? -0.54 : -0.44], M: M2, rx: PI / 2, c: '#3a342c', noao: true });
  }
  // drum, lead dome, lantern
  const DX = -5, DZ = -13.4, DR = 6.7, yD = SLO + 0.1, yT = yD + 10.0;
  cyl('plaster', DR + 0.45, DR + 0.5, 0.7, 24, { p: [DX, yD, DZ], M: F, c: '#d9bf86' });
  cyl('plaster', DR, DR, 9.2, 24, { p: [DX, yD + 0.7, DZ], M: F, c: '#efe3c3' });
  cyl('plaster', DR + 0.6, DR + 0.6, 0.9, 24, { p: [DX, yT, DZ], M: F, c: '#d3b67e' });
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4 + PI / 8, wx = DX + Math.sin(a) * DR, wz = DZ + Math.cos(a) * DR, px = DX + Math.sin(a + PI / 8) * DR, pz = DZ + Math.cos(a + PI / 8) * DR;
    bx('flat', mul(F, mul(tr(wx, 0, wz), rotY(a))), -0.75, 0.75, yD + 2.6, yD + 7.2, -0.05, 0.35, { c: '#cfb07a', noao: true });
    bx('dark', mul(F, mul(tr(wx, 0, wz), rotY(a))), -0.5, 0.5, yD + 3.0, yD + 6.6, 0.3, 0.4, { c: '#40352a', noao: true });
    bx('flat', mul(F, mul(tr(wx, 0, wz), rotY(a))), -0.9, 0.9, yD + 7.2, yD + 7.6, -0.05, 0.5, { c: '#d3b67e', noao: true });
    bx('flat', mul(F, mul(tr(px, 0, pz), rotY(a + PI / 8))), -0.3, 0.3, yD + 0.7, yT, -0.05, 0.35, { c: '#d3b67e', noao: true });
  }
  const prof = []; for (let t = 0; t <= 8; t++) { const th = t / 8 * 1.2; prof.push([Math.cos(th) * (DR + 0.2), yT + 0.9 + Math.sin(th) * 6.2]); }
  prof.push([1.9, yT + 0.9 + 6.2 * Math.sin(1.25)]); lathe('lead', prof, 20, { M: mul(F, tr(DX, 0, DZ)), noao: true });
  const yL = yT + 0.9 + 6.2 * Math.sin(1.2) - 0.3;
  cyl('plaster', 1.75, 1.9, 0.5, 12, { p: [DX, yL, DZ], M: F, c: '#d3b67e', noao: true });
  cyl('plaster', 1.45, 1.5, 2.6, 12, { p: [DX, yL + 0.5, DZ], M: F, c: '#e6d6ae', noao: true });
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; bx('dark', mul(F, mul(tr(DX + Math.sin(a) * 1.46, 0, DZ + Math.cos(a) * 1.46), rotY(a))), -0.3, 0.3, yL + 1.1, yL + 2.6, 0, 0.08, { c: '#2c261f', noao: true }); }
  cyl('lead', 1.5, 1.7, 0.3, 12, { p: [DX, yL + 3.1, DZ], M: F, noao: true });
  lathe('lead', [[0, 0], [1.4, 0], [1.2, 0.5], [0.7, 1.2], [0.15, 1.7], [0, 1.9]], 10, { M: mul(F, tr(DX, yL + 3.4, DZ)), noao: true });
  bx('flat', F, DX - 0.06, DX + 0.06, yL + 5.2, yL + 6.7, DZ - 0.06, DZ + 0.06, { c: '#3d3a36', noao: true }); bx('flat', F, DX - 0.4, DX + 0.4, yL + 6.0, yL + 6.1, DZ - 0.06, DZ + 0.06, { c: '#3d3a36', noao: true });
  // two small red domes with lanterns on the side chapels
  for (const [px, pz] of [[-13.2, -8.0], [3.4, -8.0]]) {
    cyl('plaster', 2.2, 2.3, 1.6, 12, { p: [px, SLO + 0.1, pz], M: F, c: '#efe3c3' });
    sphere('red', 2.35, { M: mul(F, tr(px, SLO + 1.7, pz)), ky: 0.7, kz: 1, seg: 10 });
    cyl('plaster', 0.5, 0.55, 1.3, 8, { p: [px, SLO + 3.2, pz], M: F, c: '#e6d6ae', noao: true }); sphere('red', 0.6, { M: mul(F, tr(px, SLO + 4.5, pz)), ky: 1.1, seg: 6 });
  }
  const o = end(SFS.name); o.userData.solids = [[SFS.p, null, y0 + SLO + 1]];
  return o;
}
export const SAN_FRANCESCO_SAVERIO = { name: SFS.name, x: SFS.c[0], z: SFS.c[1], radius: SFS.r, skipIds: [SFS.id], build: buildSfs };

// ---------------------------------------------------------------------------- Santa Maria della Mercede
const MER = { id: 'w279881802', name: 'Chiesa di Santa Maria della Mercede', O: [-596.5, -184.8], N: [0.725, -0.689], c: [-604, -177], r: 30, p: [-600.3, -188.8, -592.6, -180.7, -591.4, -179.4, -590.8, -178.8, -592.8, -177.1, -595, -179.7, -601.5, -174.1, -611.2, -165.7, -616.6, -171.9, -617.6, -173.1] };
const MFW = 11.2, MFH = 14.9, MCO = 10.4;
function paintMerFront(g, w, h) {
  const { R, arch, circ, tri, poly, ell, strip, X, Y } = pen(g, w, h, MFW, MFH, -5.6);
  const PLM = '#c9ad86', ST = '#bf9f76', STH = '#d8c196', DK = '#4a3020';
  g.fillStyle = PLM; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 45, 2, 8201, ['rgba(140,100,60,0.08)', 'rgba(255,240,210,0.09)', 'rgba(100,70,40,0.07)']);
  R(-5.6, 0, 5.6, 0.7, '#a68763');
  for (const s of [-1, 1]) { const x = s * 4.75; strip(x, 0.7, MCO, 1.7, ST, 0.85); R(x - 0.85, MCO - 0.3, x + 0.85, MCO, STH); }
  // portal: door with raised panels, frame, frieze with garlands, two half pediments, niche with the Madonna, round window
  R(-1.4, 0.7, 1.4, 4.2, '#b39466'); R(-1.0, 0.7, 1.0, 3.75, DK);
  for (const x of [-0.5, 0.5]) for (let y = 1.0; y < 3.5; y += 0.85) { R(x - 0.38, y, x + 0.38, y + 0.7, 'rgba(120,80,50,0.5)'); R(x - 0.26, y + 0.1, x + 0.26, y + 0.6, 'rgba(20,10,5,0.35)'); }
  R(-0.03, 0.7, 0.03, 3.75, '#1d120a');
  R(-1.7, 3.8, 1.7, 4.5, STH); for (const x of [-1.1, 0, 1.1]) circ(x, 4.15, 0.22, '#b99a6a');
  poly([[-2.25, 4.5], [-0.35, 5.45], [-0.35, 4.5]], STH); poly([[2.25, 4.5], [0.35, 5.45], [0.35, 4.5]], STH);
  R(-0.95, 4.95, 0.95, 8.0, '#d2b98e'); arch(0, 5.0, 8.4, 1.9, '#d2b98e'); arch(0, 5.2, 8.2, 1.35, '#8fa0ad'); R(-0.32, 5.3, 0.32, 7.2, '#ece6d6'); circ(0, 7.0, 0.25, '#ece6d6');
  R(-1.1, 4.75, 1.1, 5.0, STH);
  circ(0, 9.0, 1.05, STH); circ(0, 9.0, 0.82, '#27375a'); for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.strokeStyle = 'rgba(150,170,205,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(Math.cos(a) * 0.1), Y(9.0 + Math.sin(a) * 0.1)); g.lineTo(X(Math.cos(a) * 0.8), Y(9.0 + Math.sin(a) * 0.8)); g.stroke(); }
  R(-5.6, MCO - 0.9, 5.6, MCO, STH); R(-5.6, MCO - 0.9, 5.6, MCO - 0.8, 'rgba(50,30,15,0.4)'); R(-3.4, MCO - 0.65, 3.4, MCO - 0.3, '#b99d74');
  tri(-5.8, 5.8, MCO, 2.9, STH); tri(-4.95, 4.95, MCO + 0.15, 2.45, PLM);
  ell(0, 11.3, 0.45, 0.6, '#d8d0bf'); R(-0.35, 11.0, 0.35, 11.15, '#9a8a6a');
  const gs = g.createLinearGradient(0, Y(MCO - 0.9), 0, Y(MCO - 2.6)); gs.addColorStop(0, 'rgba(50,30,15,0.3)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(MCO - 0.9), w, 1.7 * h / MFH);
  wear(g, w, h, 8202, 1.1);
}
function buildMer() {
  initShared();
  const M = mkFrame(MER.O, MER.N), pts = pairsOf(MER.p), gr = groundRange(pts), W = M.toWorld;
  const y0 = Math.min(groundY(...W(-4, 2)), groundY(...W(0, 2)), groundY(...W(4, 2)));
  const F = frame(MER.O[0], y0, MER.O[1], MER.N[0], MER.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  const EAVE = 9.8;
  defMat('bkMeFront', 288, 384, [MFW, MFH], paintMerFront);
  defMat('bkMeWall', 256, 256, [6, 6], (g, w, h) => paintWall(g, w, h, 6, 6, '#b99d78', '#8f7653', 8211, 1.2));
  begin(y0);
  prism('bkMeWall', M.clipFront(pts, -0.1), Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / 6] });
  prism('flat', M.clipFront(pts, -0.1), y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  gable('tile', 'bkMeWall', at(0, 0, -12), 8.8, 22.4, EAVE, 2.9, { ov: 0.3, c: '#b8744f', wc: '#c3a784' });
  const s = new THREE.Shape(); s.moveTo(-5.6, 0); s.lineTo(5.6, 0); s.lineTo(5.6, MCO); s.lineTo(0, MCO + 2.9); s.lineTo(-5.6, MCO); s.lineTo(-5.6, 0);
  slab(F, 'bkMeFront', s, -5.6, MFW, MFH);
  bx('flat', F, -5.9, 5.9, MCO - 0.9, MCO, -1.4, 0.3, { c: '#d8c196', noao: true });
  bx('flat', F, -1.7, 1.7, 3.8, 4.5, -0.05, 0.4, { c: '#d8c196', noao: true });
  bx('flat', F, -0.15, 0.15, MCO + 3.0, MCO + 4.0, -0.9, -0.6, { c: '#d8d0bf', noao: true }); bx('flat', F, -0.55, 0.55, MCO + 3.55, MCO + 3.8, -0.9, -0.6, { c: '#d8d0bf', noao: true });
  // bell gable with two arches, behind on the left
  bx('bkMeWall', F, -4.6, -1.8, EAVE, EAVE + 4.4, -6.6, -3.6, { uvo: [0, -(y0 + EAVE) / 6] });
  for (const x of [-3.9, -2.5]) arch3('dark', at(x, EAVE + 0.6, -3.55), 0.9, 1.9, 0.06);
  const bp = new THREE.Shape(); bp.moveTo(-4.9, 0); bp.lineTo(-1.5, 0); bp.lineTo(-3.2, 1.0); bp.lineTo(-4.9, 0);
  extrude('flat', bp, 3.2, { M: at(0, EAVE + 4.4, -6.7), c: '#c9ad86', noao: true });
  const o = end(MER.name); o.userData.solids = [[MER.p, null, y0 + EAVE + 3]];
  return o;
}
export const SANTA_MARIA_MERCEDE = { name: MER.name, x: MER.c[0], z: MER.c[1], radius: MER.r, skipIds: [MER.id], build: buildMer };

// ---------------------------------------------------------------------------- Santa Maria dei Miracoli
const MIR = { id: 'w49773340', name: 'Santa Maria dei Miracoli', O: [651.4, -108.5], N: [0.282, 0.959], c: [646, -114], r: 24, p: [635.6, -116.7, 637.4, -110.6, 638.1, -108.2, 643.2, -109.7, 644.2, -106.4, 658.5, -110.6, 655, -122.5] };
const IFW = 14.9, IFH = 17.6, ITOP = 14.2;
function paintMirFront(g, w, h) {
  const { R, arch, circ, poly, ell, X, Y, sx } = pen(g, w, h, IFW, IFH, -7.45);
  paintAshlar(g, w, h, IFW, IFH, 0.62, 1.3, '#cfc5ae', '#b0a68f', 8301, 1.2, 0.06);
  const ST = '#ddd1b6', STD = '#bfb195', DK = '#2b2f33';
  const col = (x, y0, y1, ww) => { R(x - ww / 2, y0, x + ww / 2, y1, ST); for (let k = -1; k <= 1; k++) R(x + k * ww * 0.28 - 0.04, y0, x + k * ww * 0.28 + 0.04, y1, 'rgba(70,55,35,0.3)'); R(x - ww / 2, y0, x - ww / 2 + 0.08, y1, 'rgba(255,250,235,0.5)'); R(x + ww / 2 - 0.1, y0, x + ww / 2, y1, 'rgba(60,45,30,0.3)'); };
  const cap = (x, y, ww) => { R(x - ww * 0.75, y, x + ww * 0.75, y + 0.65, ST); R(x - ww * 0.6, y + 0.5, x + ww * 0.6, y + 0.8, STD); };
  R(-7.45, 0, 7.45, 0.55, '#b9ab8f');
  for (const s of [-1, 1]) {
    col(s * 6.95, 0.5, 8.7, 0.85); cap(s * 6.95, 8.65, 0.85); col(s * 3.1, 0.5, 4.9, 0.8); cap(s * 3.1, 4.85, 0.8); col(s * 3.1, 6.35, 8.7, 0.6); cap(s * 3.1, 8.65, 0.6);
    const x = s * 5.15; R(x - 1.3, 2.4, x + 1.3, 6.6, STD); R(x - 1.1, 2.6, x + 1.1, 6.35, ST); R(x - 0.5, 3.0, x + 0.5, 5.9, DK); R(x - 1.5, 6.6, x + 1.5, 7.0, ST); R(x - 1.4, 2.25, x + 1.4, 2.45, ST);
  }
  // portal: door, plain frame, a blank lunette above
  R(-1.0, 0.5, 1.0, 3.7, '#3b2a22'); R(-1.2, 0.5, -1.0, 3.9, STD); R(1.0, 0.5, 1.2, 3.9, STD); R(-1.35, 3.8, 1.35, 4.15, ST); R(-1.7, 4.15, 1.7, 4.4, STD);
  arch(0, 4.4, 7.0, 3.1, 'rgba(120,105,80,0.28)'); arch(0, 4.4, 6.9, 2.9, 'rgba(255,250,235,0.1)');
  R(-3.8, 5.55, 3.8, 6.4, ST); R(-3.8, 6.4, 3.8, 6.5, 'rgba(60,45,30,0.3)'); R(-3.8, 5.55, 3.8, 5.62, 'rgba(60,45,30,0.3)');
  ell(0, 7.8, 0.85, 1.0, '#e0d6bd'); ell(0, 7.8, 0.6, 0.75, '#a79a80'); circ(0, 7.7, 0.2, '#e0d6bd');
  // main cornice, plain attic with the round window, top cornice
  R(-7.45, 9.65, 7.45, 10.9, ST); R(-7.45, 9.65, 7.45, 9.75, 'rgba(60,45,30,0.35)'); R(-7.45, 10.55, 7.45, 10.9, STD);
  circ(0, 12.2, 1.05, ST); circ(0, 12.2, 0.8, STD); circ(0, 12.2, 0.62, '#34404a');
  R(-7.45, ITOP - 0.5, 7.45, ITOP, ST); R(-7.45, ITOP - 0.5, 7.45, ITOP - 0.4, 'rgba(60,45,30,0.35)');
  for (const y of [9.65, ITOP - 0.5]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(50,35,20,0.28)'); gs.addColorStop(1, 'rgba(50,35,20,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sx); }
  wear(g, w, h, 8302, 1.2);
}
function buildMir() {
  initShared();
  const M = mkFrame(MIR.O, MIR.N), pts = pairsOf(MIR.p), gr = groundRange(pts), W = M.toWorld;
  const y0 = Math.min(groundY(...W(-6, 2)), groundY(...W(0, 2)), groundY(...W(6, 2)));
  const F = frame(MIR.O[0], y0, MIR.O[1], MIR.N[0], MIR.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bkMiFront', 336, 384, [IFW, IFH], paintMirFront);
  defMat('bkMiWall', 256, 256, [6, 6], (g, w, h) => paintWall(g, w, h, 6, 6, '#d0c3a5', '#aa9d83', 8311, 1.3));
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5;
  prism('bkMiWall', [W(-7.5, -0.1), W(7.4, -0.1), W(7.4, -12.4), W(-7.5, -12.4)], lo, y0 + ITOP - 0.4, { uvo: [0, -y0 / 6] });
  prism('flat', [W(-7.5, -0.1), W(7.4, -0.1), W(7.4, -12.4), W(-7.5, -12.4)], y0 + ITOP - 0.4, y0 + ITOP - 0.28, { c: '#a39a8c' });
  prism('bkMiWall', [W(-12.8, -3.5), W(-7.4, -3.5), W(-7.4, -12.3), W(-12.8, -12.3)], lo, y0 + 9.0, { uvo: [0, -y0 / 6] });
  prism('flat', [W(-12.8, -3.5), W(-7.4, -3.5), W(-7.4, -12.3), W(-12.8, -12.3)], y0 + 9.0, y0 + 9.12, { c: '#a39a8c' });
  // front slab with the scrolled gable
  const s = new THREE.Shape();
  s.moveTo(-7.45, 0); s.lineTo(7.45, 0); s.lineTo(7.45, ITOP); s.lineTo(3.3, ITOP); s.quadraticCurveTo(2.6, ITOP + 0.1, 2.5, ITOP + 0.7); s.quadraticCurveTo(2.2, ITOP + 1.5, 1.4, ITOP + 1.9);
  s.quadraticCurveTo(0.9, ITOP + 2.5, 0.2, ITOP + 2.6); s.quadraticCurveTo(-0.5, ITOP + 2.5, -1.0, ITOP + 2.3); s.quadraticCurveTo(-2.0, ITOP + 1.8, -2.5, ITOP + 0.9); s.quadraticCurveTo(-2.8, ITOP + 0.2, -3.5, ITOP);
  s.lineTo(-7.45, ITOP); s.lineTo(-7.45, 0);
  slab(F, 'bkMiFront', s, -7.45, IFW, IFH);
  bx('flat', F, -7.7, 7.7, 9.65, 10.9, -1.4, 0.5, { c: '#d9ccb0', noao: true });
  bx('flat', F, -7.7, 7.7, ITOP - 0.5, ITOP + 0.1, -1.4, 0.35, { c: '#d9ccb0', noao: true });
  for (const sg of [-1, 1]) {
    cyl('plaster', 0.36, 0.4, 4.35, 10, { p: [sg * 3.1, 0.5, 0.5], M: F, c: '#e4dac2', noao: true });
    bx('flat', F, sg * 3.1 - 0.5, sg * 3.1 + 0.5, 4.85, 5.5, 0.1, 0.9, { c: '#e4dac2', noao: true });
    bx('flat', F, sg * 6.95 - 0.5, sg * 6.95 + 0.5, 0.5, 8.7, -0.05, 0.3, { c: '#e0d6bd', noao: true });
  }
  bx('flat', F, -3.9, 3.9, 5.55, 6.5, 0.1, 0.8, { c: '#d9ccb0', noao: true });
  sphere('flat', 0.32, { M: at(-6.9, ITOP + 0.4, -0.5), c: '#d9ccb0', seg: 6, ky: 1.5 });
  // stepped merlons at the back right
  for (let i = 0; i < 3; i++) bx('bkMiWall', F, 5.2, 7.2, ITOP - 0.4, ITOP + 1.6 - i * 0.5, -3.0 - i * 2.8, -4.6 - i * 2.8, { uvo: [0, -(y0 + ITOP) / 6] });
  const o = end(MIR.name); o.userData.solids = [[MIR.p, null, y0 + ITOP]];
  return o;
}
export const SANTA_MARIA_MIRACOLI = { name: MIR.name, x: MIR.c[0], z: MIR.c[1], radius: MIR.r, skipIds: [MIR.id], build: buildMir };

// ---------------------------------------------------------------------------- Sant'Andrea degli Armatori (Amalfitani)
const AND = { id: 'w86886711', name: "Chiesa di Sant'Andrea degli Armatori", O: [215.2, -290.7], N: [-0.906, 0.423], c: [223, -296], r: 22, p: [213, -295.3, 218.3, -297.7, 216, -302.7, 222.3, -305.6, 224.7, -300.6, 230.1, -303.1, 234.4, -293.9, 217.3, -286.1] };
const AFW = 10.1, AFH = 15.4, ALO = 8.6;
function paintAndFront(g, w, h) {
  const { R, arch, circ, tri, poly, ell, strip, Y, sx } = pen(g, w, h, AFW, AFH, -5.05);
  const PL = '#ede6d4', ST = '#bd9b66', STH = '#d6ba88', STD = '#a07d4e';
  g.fillStyle = PL; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 50, 2, 8401, ['rgba(150,120,80,0.08)', 'rgba(255,250,235,0.1)']);
  R(-5.05, 0, 5.05, 0.5, '#b08c5a');
  for (const x of [-4.6, 4.6]) { strip(x, 0.5, ALO, 0.9, ST, 0.7); R(x - 0.55, ALO - 0.4, x + 0.55, ALO, STH); }
  for (const x of [-1.75, 1.75]) { strip(x, 0.5, 12.0, 0.8, ST, 0.7); R(x - 0.5, ALO - 0.4, x + 0.5, ALO, STH); }
  // lower cornice
  R(-5.05, ALO - 0.5, 5.05, ALO + 0.5, ST); R(-5.05, ALO + 0.3, 5.05, ALO + 0.5, STH); R(-5.05, ALO - 0.5, 5.05, ALO - 0.38, 'rgba(50,30,15,0.4)');
  // middle portal: arched opening, frame, columns, half pediments, a framed window above
  arch(0, 0.5, 3.6, 2.2, ST); arch(0, 0.5, 3.2, 1.6, '#2a2018'); R(-1.25, 0.5, -1.0, 3.3, '#d3b179'); R(1.0, 0.5, 1.25, 3.3, '#d3b179');
  poly([[-1.9, 3.7], [-0.15, 4.5], [-0.15, 3.7]], STH); poly([[1.9, 3.7], [0.15, 4.5], [0.15, 3.7]], STH); R(-1.7, 3.55, 1.7, 3.8, ST);
  R(-1.0, 5.0, 1.0, 7.0, ST); R(-0.72, 5.25, 0.72, 6.75, '#40352b'); R(-0.03, 5.25, 0.03, 6.75, '#7a5e3c'); R(-1.15, 7.0, 1.15, 7.25, STH); R(-1.15, 4.8, 1.15, 5.0, STH);
  // the two small doors with a triangular pediment and the framed windows over them
  for (const s of [-1, 1]) {
    const x = s * 3.15;
    R(x - 0.75, 0.5, x + 0.75, 2.55, ST); R(x - 0.5, 0.5, x + 0.5, 2.35, '#3e2d20'); tri(x - 1.0, x + 1.0, 2.55, 0.55, STH); tri(x - 0.6, x + 0.6, 2.62, 0.3, PL);
    R(x - 0.65, 4.2, x + 0.65, 6.7, ST); R(x - 0.42, 4.4, x + 0.42, 6.5, '#3a3228'); R(x - 0.8, 6.7, x + 0.8, 6.95, STH); R(x - 0.8, 4.05, x + 0.8, 4.2, STH);
  }
  // upper order: round window, entablature, pediment
  circ(0, 10.5, 0.8, ST); circ(0, 10.5, 0.6, '#3a4048'); R(-0.03, 9.9, 0.03, 11.1, '#6b5a44');
  R(-2.45, 12.0, 2.45, 12.5, ST); tri(-2.7, 2.7, 12.5, 2.65, ST); tri(-2.2, 2.2, 12.65, 2.15, PL);
  // wings: a volute scroll each side, a stone knob at the corner
  for (const s of [-1, 1]) { const x = s * 4.2; circ(x, 9.8, 0.55, ST); circ(x, 9.8, 0.3, STD); R(s > 0 ? x - 0.1 : x - 0.1, 9.0, x + 0.1, 9.4, STD); circ(s * 4.7, 9.9, 0.32, STH); }
  // bell gable on the left: two arches
  R(-4.5, 9.3, -2.4, 12.8, PL); poly([[-4.5, 12.8], [-3.45, 13.4], [-2.4, 12.8]], STH);
  arch(-3.8, 10.2, 12.1, 0.8, '#40352b'); arch(-3.1, 10.2, 12.1, 0.8, '#40352b');
  for (const y of [ALO + 0.5]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(50,30,15,0.28)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sx); }
  wear(g, w, h, 8402, 1.0);
}
function buildAnd() {
  initShared();
  const M = mkFrame(AND.O, AND.N), pts = pairsOf(AND.p), gr = groundRange(pts), W = M.toWorld;
  const y0 = Math.min(groundY(...W(-4, 2)), groundY(...W(0, 2)), groundY(...W(4, 2)));
  const F = frame(AND.O[0], y0, AND.O[1], AND.N[0], AND.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bkAnFront', 256, 384, [AFW, AFH], paintAndFront);
  defMat('bkAnWall', 128, 256, [4, 8], (g, w, h) => paintWall(g, w, h, 4, 8, '#e6dcc4', '#c9bea4', 8411, 0));
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, main = [W(-5.1, -0.1), W(5.1, -0.1), W(5.1, -18.7), W(-5.0, -18.7)], ann = [W(-10.5, -5.8), W(-4.9, -5.8), W(-4.9, -12.8), W(-10.5, -12.8)];
  prism('bkAnWall', main, lo, y0 + ALO, { uvo: [0, -y0 / 8] }); prism('flat', main, y0 + ALO, y0 + ALO + 0.12, { c: '#a39a8c' });
  prism('bkAnWall', ann, lo, y0 + 7.4, { uvo: [0, -y0 / 8] }); prism('flat', ann, y0 + 7.4, y0 + 7.52, { c: '#a39a8c' });
  // nave: narrow walls above the aisles, gable roof
  bx('bkAnWall', F, -2.3, 2.3, ALO, 12.0, -18.2, -0.8, { uvo: [0, -(y0 + ALO) / 8] });
  gable('tile', 'bkAnWall', at(0, 0, -9.5), 4.6, 17.4, 12.0, 1.7, { ov: 0.3, c: '#b8744f', wc: '#e6dcc4' });
  // front slab: three bays in the lower order, scrolls, narrow upper order with a pediment
  const s = new THREE.Shape();
  s.moveTo(-5.05, 0); s.lineTo(5.05, 0); s.lineTo(5.05, 9.3); s.quadraticCurveTo(3.4, 9.5, 2.3, 11.7); s.lineTo(2.3, 12.0); s.lineTo(2.7, 12.0); s.lineTo(0, 14.9); s.lineTo(-2.7, 12.0); s.lineTo(-2.3, 12.0);
  s.lineTo(-2.3, 11.7); s.quadraticCurveTo(-3.4, 9.5, -5.05, 9.3); s.lineTo(-5.05, 0);
  slab(F, 'bkAnFront', s, -5.05, AFW, AFH, 1.0);
  const bg = new THREE.Shape(); bg.moveTo(-4.5, 9.3); bg.lineTo(-2.4, 9.3); bg.lineTo(-2.4, 12.8); bg.lineTo(-3.45, 13.4); bg.lineTo(-4.5, 12.8); bg.lineTo(-4.5, 9.3);
  extrude('bkAnFront', bg, 0.7, { M: at(0, 0, -2.2), uv: 'keep', uvk: [1 / AFW, 1 / AFH], uvo: [5.05 / AFW, 0], noao: true });
  bx('flat', F, -5.3, 5.3, ALO - 0.5, ALO + 0.5, -1.2, 0.4, { c: '#d3b67e', noao: true });
  for (const sg of [-1, 1]) {
    sphere('flat', 0.33, { M: at(sg * 4.7, 9.6, -0.4), c: '#d9bd86', seg: 6 });
  }
  bx('flat', F, -0.1, 0.1, 17.6, 18.6, -0.35, -0.2, { c: '#8d8472', noao: true }); bx('flat', F, -0.4, 0.4, 18.1, 18.3, -0.35, -0.2, { c: '#8d8472', noao: true });
  const o = end(AND.name); o.userData.solids = [[AND.p, null, y0 + ALO]];
  return o;
}
export const SANT_ANDREA = { name: AND.name, x: AND.c[0], z: AND.c[1], radius: AND.r, skipIds: [AND.id], build: buildAnd };

export const BATCH_K = [SAN_FRANCESCO_SAVERIO, SANTA_MARIA_MERCEDE, SANTA_MARIA_MIRACOLI, SANT_ANDREA];
