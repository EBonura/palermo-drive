// City landmarks, batch B: four churches rebuilt from reference photos. Registered through BATCH_B in src/landmarks-city.js.
// Each replaces its OSM footprint (skipIds). Frame F per church: origin on the ground in the middle of the front, +z out of the front, local x along the front.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions and colours read):
//  San Giorgio dei Genovesi: Chiesa San Giorgio dei Genovesi (Palermo).jpg; Chiesa di San Giorgio dei Genovesi, Palermo.jpg. Front on the west end (the harbour is behind, the street ring is on the other three sides).
//   Read: honey limestone ashlar in large blocks; two orders. Lower: four pilasters on high pedestals (a corner one at each end), three doors (a tall carved middle door, a small one each side), a lattice window with a pedimentless frame over each small door,
//   a heavy carved entablature. Upper: a narrow nave front with two pilasters, an oval oculus in a scrolled cartouche, a big concave scroll each side, a flat attic block with a carved frieze (no pediment). Octagonal drum with a tile cap and a ball behind.
//  Santa Maria la Nova: Santa Maria la Nova (Palermo)-msu-1606.jpg; Santa Maria La Nova (Palermo).jpg; Santa Maria la Nova, Palermo.jpg. Front on the west end onto the piazza.
//   Read: a two storey block 1.05 times as tall as wide. Lower: a porch of three round arches on two marble columns, a pier with two arched niches at each end, weathered stone. Upper: ochre plaster, three recessed pointed windows
//   between fluted pilasters (a pair at each end), a heavy cornice with a frieze of shell brackets. The nave behind is lower, a plain stone wall.
//  Sant'Eulalia dei Catalani: Cresia di Sant'Eulalia du Catalani.jpg (and its detail file); SEdeiC PA 03 11 2014 01.jpg; Instituto Cervantes en Palermo.jpg. Front on the arm of the cross that meets the pedestrian way off Via Argenteria.
//   Read: three storeys of tan ashlar. Ground: a shop arch each side and a pedimentless portal with an entablature in the middle. Middle: two glazed arches and a blind arch with the coat of arms between them. Top: four wreath roundels with busts.
//   Two free shafts rise through all three storeys, an edge pilaster each end, a flat roof line with a cornice. The church behind was bombed in 1943 (only the front stands): the body is a plain block on the footprint.
//  San Sebastiano: Chiesa di San Sebastiano (Palermo).JPG; Palermo-AP-p1070602.jpg; Palermo-AP-p1070603.jpg. Front on the east end onto Via della Cala.
//   Read: pink plaster with stone pilasters. Lower: four pilasters (honey ashlar at the corners), a tall door under a broken curved pediment with a crown, a lattice panel over it, a framed lattice window with a triangular pediment each side,
//   a blind niche door below each. Heavy dark entablature. Upper: an attic band with panels, a narrow nave front (two fluted pilasters, a round window in a shaped frame), a triangular pediment with two balls and a cross, a scroll each side.
// Not known and not drawn: the roofs and side walls behind each front (tile gables and plain walls are assumed), the interiors, the dome of San Giorgio beyond its drum.
import * as THREE from 'three';
import { PI, bx, box, cyl, sphere, cone, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, paintAshlar } from './lmc-kit.js';

// ---------- shared helpers ----------
function mk(id, p, O, N, name, x, z, radius, build) {
  const toWorld = (a, b) => [O[0] + a * N[1] + b * N[0], O[1] - a * N[0] + b * N[1]];
  const toLocal = (q) => { const dx = q[0] - O[0], dz = q[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
  const clipFront = (pts, zmax) => {   // the footprint cut where it stands out in front of z = zmax (keeps z <= zmax)
    const L = pts.map(toLocal), out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out.map(q => toWorld(q[0], q[1]));
  };
  const c = { id, p, O, N, toWorld, clipFront };
  return { name, x, z, radius, skipIds: [id], build: () => build(c) };
}
function stage(c, fw) {
  initShared();
  const pts = pairsOf(c.p), gr = groundRange(pts), W = c.toWorld;
  const y0 = Math.min(groundY(...W(-fw * 0.3, 2)), groundY(...W(fw * 0.3, 2)), groundY(...W(0, 3)));
  const F = frame(c.O[0], y0, c.O[1], c.N[0], c.N[1]);
  return { pts, gr, W, y0, F, at: (x, y, z) => mul(F, tr(x, y, z)) };
}
const ringOf = (W, x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
// drawing tools on a canvas that covers FW x FH metres, x centred (-FW/2..FW/2), y up from the base
function tools(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const pointed = (x, y0, ys, ww, ya, c) => { const r = ww / 2, yc = ys + (ya - ys) * 0.55; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(yc), X(x), Y(ya)); g.quadraticCurveTo(X(x + r), Y(yc), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const ell = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, 2 * PI); g.fill(); };
  const pil = (x, y0, y1, ww, c, ch = '#d8c298') => {
    R(x - ww / 2, y0, x + ww / 2, y1, c); R(x - ww / 2, y0, x - ww / 2 + 0.12, y1, 'rgba(255,240,200,0.35)'); R(x + ww / 2 - 0.14, y0, x + ww / 2, y1, 'rgba(60,40,20,0.35)');
    R(x - ww / 2 - 0.12, y1 - 0.5, x + ww / 2 + 0.12, y1, ch); R(x - ww / 2 - 0.1, y0, x + ww / 2 + 0.1, y0 + 0.35, ch);
  };
  return { sx, sy, X, Y, R, arch, pointed, tri, ell, pil };
}
const finish = (g, w, h, t, seed, ys, col = '70,50,35') => {
  for (const y of ys) { const gs = g.createLinearGradient(0, t.Y(y - 1.4), 0, t.Y(y - 2.9)); gs.addColorStop(0, 'rgba(50,30,15,0.26)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, t.Y(y - 1.4), w, 1.5 * t.sy); }
  streaks(g, w, h, 30, seed, 0.1, 100, col);
  const gb = g.createLinearGradient(0, t.Y(0), 0, t.Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, t.Y(3), w, 3 * t.sy);
};
// a side wall bay bw x hm metres: ashlar or plaster, a half pilaster at each edge, optional windows, a cornice at the top
function paintBay(g, w, h, bw, hm, o) {
  const t = tools(g, w, h, bw, hm), { R } = t;
  if (o.ashlar) paintAshlar(g, w, h, bw, hm, o.course || 0.5, o.block || 1.1, o.base, o.joint, o.seed, 1.2, 0.07);
  else { g.fillStyle = o.base; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 70, 2, o.seed, ['rgba(120,80,50,0.08)', 'rgba(255,245,225,0.09)']); }
  R(-bw / 2, 0, -bw / 2 + 0.4, hm, o.pc); R(bw / 2 - 0.4, 0, bw / 2, hm, o.pc);
  for (const q of o.wins || []) { R(-q.w / 2 - 0.3, q.y0 - 0.25, q.w / 2 + 0.3, q.y1 + 0.5, o.fc || o.pc); R(-q.w / 2, q.y0, q.w / 2, q.y1, '#262c33'); R(-q.w / 2, (q.y0 + q.y1) / 2, q.w / 2, (q.y0 + q.y1) / 2 + 0.07, '#6a6256'); R(-0.04, q.y0, 0.04, q.y1, '#6a6256'); }
  R(-bw / 2, hm - 0.8, bw / 2, hm, o.cc || o.pc); R(-bw / 2, hm - 1.15, bw / 2, hm - 0.8, 'rgba(50,30,15,0.28)');
  streaks(g, w, h, 10, o.seed + 5, 0.1, 70, '70,50,35');
}
const gableOn = (M, w, d, y, rise, wallKey, wc) => gable('tile', wallKey, M, w, d, y, rise, { ov: 0.35, c: '#b8744f', wc });

// ====================================================================================================
// San Giorgio dei Genovesi
// ====================================================================================================
const GV = { FW: 18.6, FH: 18.4, LOW: 11.6, TOP: 18.0, EAVE: 11.4, NT: 14.0, NW: 6.0, RISE: 3.2, DZ: -15.5, NZ1: -29.8 };
function gvFront(g, w, h) {
  const { FW, FH, LOW, TOP } = GV, t = tools(g, w, h, FW, FH), { R, tri, pil, ell, X, Y, sx, sy } = t;
  paintAshlar(g, w, h, FW, FH, 0.55, 1.25, '#d5ba8b', '#a08863', 7101, 1.2, 0.07);
  for (let i = 0; i < 7; i++) { const cx = X(-8 + i * 2.7), cy = Y(2 + (i % 4) * 4.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * sx); gr.addColorStop(0, 'rgba(150,100,55,0.15)'); gr.addColorStop(1, 'rgba(150,100,55,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.8, '#b49a70');
  for (const s of [-1, 1]) {
    for (const [x, ww] of [[8.2, 1.8], [3.9, 1.2]]) { R(s * x - ww / 2 - 0.15, 0, s * x + ww / 2 + 0.15, 1.6, '#c4a97c'); pil(s * x, 1.6, LOW - 1.5, ww, '#cdb283'); }
    // small door and the lattice window over it
    const x = s * 6.05;
    R(x - 0.95, 0, x + 0.95, 3.3, '#d6bf93'); R(x - 0.65, 0, x + 0.65, 2.9, '#5b4129'); R(x - 0.65, 1.4, x + 0.65, 1.45, '#3b2a1b');
    R(x - 1.2, 3.8, x + 1.2, 4.9, '#cfb589');
    R(x - 1.25, 5.4, x + 1.25, 9.8, '#d8c294'); R(x - 0.72, 5.9, x + 0.72, 9.2, '#262c33'); g.strokeStyle = 'rgba(150,150,145,0.55)'; g.lineWidth = 1;
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(X(x - 0.72), Y(5.9 + (k + 4) * 0.4)); g.lineTo(X(x + 0.72), Y(5.9 + (k + 5) * 0.4)); g.stroke(); g.beginPath(); g.moveTo(X(x + 0.72), Y(5.9 + (k + 4) * 0.4)); g.lineTo(X(x - 0.72), Y(5.9 + (k + 5) * 0.4)); g.stroke(); }
    R(x - 1.45, 9.2, x + 1.45, 9.8, '#d2ba8e'); R(x - 1.45, 5.15, x + 1.45, 5.55, '#cfb589');
  }
  // the entablature: architrave, carved frieze with a row of brackets, cornice
  R(-FW / 2, LOW - 1.5, FW / 2, LOW, '#c3a977'); R(-FW / 2, LOW - 1.5, FW / 2, LOW - 1.35, 'rgba(60,40,20,0.4)'); R(-FW / 2, LOW - 0.45, FW / 2, LOW, '#dcc59a');
  for (let x = -FW / 2 + 0.3; x < FW / 2; x += 0.55) R(x, LOW - 1.2, x + 0.22, LOW - 0.55, 'rgba(70,50,30,0.35)');
  // the middle door
  R(-1.6, 0, 1.6, 5.3, '#dcc597'); R(-1.25, 0, 1.25, 4.8, '#6b4a2e'); R(-0.04, 0, 0.04, 4.8, '#2a1d12');
  for (const y of [0.4, 1.9, 3.4]) { R(-1.15, y, -0.1, y + 1.3, 'rgba(0,0,0,0.16)'); R(0.1, y, 1.15, y + 1.3, 'rgba(0,0,0,0.16)'); }
  R(-1.7, 4.8, 1.7, 5.3, '#d2ba8e'); R(-2.05, 5.3, 2.05, 5.6, '#cfb589');
  // upper order: two pilasters, the oval oculus in its cartouche, the scrolled wings, the attic frieze
  for (const s of [-1, 1]) pil(s * 3.6, LOW, TOP - 1.95, 0.9, '#cdb283');
  ell(0, 14.0, 1.45, 1.8, '#cdb288'); ell(0, 14.0, 1.15, 1.5, '#b9a073'); ell(0, 14.0, 0.7, 0.98, '#252a30'); R(-0.04, 13.0, 0.04, 15.0, '#6a6256');
  g.strokeStyle = '#8f7650'; g.lineWidth = 1.3; for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * 4.0), Y(LOW + 3.9), 0.5 * sx, 0, 2 * PI); g.stroke(); g.beginPath(); g.arc(X(s * 6.5), Y(LOW + 0.7), 0.4 * sx, 0, 2 * PI); g.stroke(); }
  R(-5.3, TOP - 1.9, 5.3, TOP - 0.85, '#b69b6c'); for (let x = -5.0; x < 5.0; x += 0.42) { R(x, TOP - 1.7, x + 0.18, TOP - 1.05, 'rgba(70,50,30,0.38)'); }
  finish(g, w, h, t, 7102, [LOW, TOP - 0.85]);
}
function buildGenovesi(c) {
  const { FW, LOW, TOP, EAVE, NT, NW, RISE, DZ, NZ1 } = GV, s = stage(c, FW), { F, at, W, y0 } = s;
  defMat('gvFront', 384, 384, [FW, GV.FH], gvFront);
  defMat('gvWall', 128, 256, [5, NT], (g, w, h) => paintBay(g, w, h, 5, NT, { ashlar: true, base: '#cfb485', joint: '#9a835f', pc: '#c4a978', fc: '#d6bf93', cc: '#d2ba8e', seed: 7121, wins: [{ w: 1.2, y0: 6.3, y1: 9.2 }] }));
  begin(y0);
  const body = c.clipFront(s.pts, -0.1);
  prism('gvWall', body, Math.min(s.gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / NT] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  bx('gvWall', F, -NW, NW, EAVE, NT, -1.5, NZ1, { uvo: [0, -y0 / NT] });
  for (const [z0, z1] of [[-1.5, DZ + 5.5], [DZ - 5.5, NZ1]]) gableOn(at(0, 0, (z0 + z1) / 2), NW * 2, z0 - z1, NT, RISE, 'gvWall', '#cfb485');
  bx('flat', F, -NW - 0.3, NW + 0.3, NT, NT + 0.2, DZ - 5.5, DZ + 5.5, { c: '#a39a8c' });
  // the front as one shape: lower order, the concave scrolls, the narrow nave front, the flat attic
  const hw = FW / 2, sh = new THREE.Shape();
  sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, LOW); sh.lineTo(6.9, LOW); sh.bezierCurveTo(5.5, LOW + 0.15, 4.5, LOW + 1.6, 4.4, LOW + 4.5);
  sh.lineTo(4.4, TOP - 1.9); sh.lineTo(5.3, TOP - 1.9); sh.lineTo(5.3, TOP); sh.lineTo(-5.3, TOP); sh.lineTo(-5.3, TOP - 1.9); sh.lineTo(-4.4, TOP - 1.9); sh.lineTo(-4.4, LOW + 4.5);
  sh.bezierCurveTo(-4.5, LOW + 1.6, -5.5, LOW + 0.15, -6.9, LOW); sh.lineTo(-hw, LOW); sh.lineTo(-hw, 0);
  extrude('gvFront', sh, 1.4, { M: at(0, 0, -1.45), uv: 'keep', uvk: [1 / FW, 1 / GV.FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.25, hw + 0.25, LOW - 0.4, LOW + 0.1, -1.45, 0.5, { c: '#c8ad80', noao: true });
  bx('flat', F, -hw - 0.1, hw + 0.1, LOW - 1.6, LOW - 1.4, -1.45, 0.25, { c: '#c0a574', noao: true });
  bx('flat', F, -5.7, 5.7, TOP - 0.85, TOP + 0.15, -1.45, 0.55, { c: '#c8ad80', noao: true });
  for (const sg of [-1, 1]) {
    for (const [x, ww] of [[8.2, 1.8], [3.9, 1.2]]) {
      bx('flat', F, sg * x - ww / 2 - 0.15, sg * x + ww / 2 + 0.15, 0, 1.6, -0.05, 0.4, { c: '#bfa371', noao: true });
      bx('flat', F, sg * x - ww / 2, sg * x + ww / 2, 1.6, LOW - 1.55, -0.05, 0.3, { c: '#c4a978', noao: true });
      bx('flat', F, sg * x - ww / 2 - 0.12, sg * x + ww / 2 + 0.12, LOW - 2.05, LOW - 1.55, -0.05, 0.4, { c: '#d5bd90', noao: true });
    }
    bx('flat', F, sg * 3.6 - 0.45, sg * 3.6 + 0.45, LOW, TOP - 1.95, -0.05, 0.25, { c: '#c4a978', noao: true });
    bx('flat', F, sg * 6.05 - 1.5, sg * 6.05 + 1.5, 9.75, 10.1, -0.05, 0.35, { c: '#d1b98c', noao: true });
    bx('flat', F, sg * 6.05 - 1.35, sg * 6.05 + 1.35, 5.2, 5.5, -0.05, 0.3, { c: '#cfb589', noao: true });
    sphere('flat', 0.42, { M: at(sg * 7.1, LOW + 0.5, -0.4), seg: 6, c: '#cdb48a' });
  }
  bx('flat', F, -1.8, 1.8, 4.8, 5.3, -0.05, 0.35, { c: '#d2ba8e', noao: true });
  for (let i = 0; i < 3; i++) bx('stone', F, -2.0 - i * 0.2, 2.0 + i * 0.2, -0.3, 0.17 * (3 - i), -0.05, 0.4 * (i + 1), { c: '#d6c9a8' });
  // the octagonal drum with its tile cap and ball, over the crossing
  const DC = at(0, NT - 0.5, DZ), DR = 4.6;
  cyl('gvWall', DR, DR, 4.8, 8, { M: mul(DC, rotY(PI / 8)), c: '#e0c9a0' });
  cyl('flat', DR + 0.4, DR + 0.4, 0.5, 8, { M: mul(DC, mul(tr(0, 4.8, 0), rotY(PI / 8))), c: '#c8ad80' });
  cone('tile', DR + 0.5, 2.3, 8, { M: mul(DC, mul(tr(0, 5.3, 0), rotY(PI / 8))), c: '#b8744f', noao: true });
  sphere('flat', 0.5, { M: mul(DC, tr(0, 7.8, 0)), seg: 8, c: '#bfa87e' }); bx('flat', DC, -0.06, 0.06, 8.2, 9.6, -0.06, 0.06, { c: '#3e3a36', noao: true });
  for (let i = 0; i < 4; i++) { const M = mul(DC, mul(rotY(i * PI / 2), tr(0, 0, DR * 0.924 + 0.02))); bx('dark', M, -0.5, 0.5, 1.3, 3.7, -0.05, 0.1, { c: '#2a2f34', noao: true }); bx('flat', M, -0.75, 0.75, 3.6, 3.9, -0.05, 0.2, { c: '#d2ba8e', noao: true }); }
  const o = end('Chiesa di San Giorgio dei Genovesi');
  o.userData.solids = [[c.p, null, y0 + EAVE], [ringOf(W, -NW, NW, NZ1, -1.5), null, y0 + NT + RISE], [ringOf(W, -DR, DR, DZ - DR, DZ + DR), null, y0 + NT + 7.2]];
  return o;
}

// ====================================================================================================
// Santa Maria la Nova
// ====================================================================================================
const SM = { FW: 16.9, FH: 18.0, BD: 9.0, STR: 9.5, COR: 16.1, EAVE: 11.0, NT: 13.6, NW: 5.0, RISE: 3.2, AX: -0.0745 };
const SM_HOLES = [[-5.75, -2.5, 5.0], [-1.9, 1.9, 5.2], [2.5, 5.75, 5.0]];   // x0, x1, springing
function smFront(g, w, h) {
  const { FW, FH, STR, COR } = SM, t = tools(g, w, h, FW, FH), { R, arch, pointed, X, Y, sx, sy, pil } = t;
  paintAshlar(g, w, h, FW, FH, 0.5, 1.1, '#c9ae80', '#92795a', 7201, 1.2, 0.07);
  for (let i = 0; i < 9; i++) { const cx = X(-7.5 + i * 1.9), cy = Y(3 + (i * 5) % 6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 2.6 * sx); gr.addColorStop(0, 'rgba(120,135,140,0.22)'); gr.addColorStop(1, 'rgba(120,135,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // upper storey in ochre plaster
  R(-FW / 2, STR + 0.2, FW / 2, COR, '#d8b684'); noiseDots(g, w, h, 500, 2, 7202, ['rgba(150,100,50,0.1)', 'rgba(255,240,205,0.1)']);
  R(-FW / 2, STR, FW / 2, STR + 0.35, '#dbc39d'); R(-FW / 2, STR - 0.12, FW / 2, STR, 'rgba(50,30,15,0.35)');
  // the piers: moulded edge, two arched niches
  for (const s of [-1, 1]) {
    const x = s * 7.1; R(x - 1.3, 0, x + 1.3, STR, '#c3a87a'); R(x - 1.3, 0, x - 1.15, STR, 'rgba(255,240,200,0.3)'); R(x + 1.15, 0, x + 1.3, STR, 'rgba(50,30,15,0.3)');
    for (const [y0, y1] of [[1.7, 4.5], [5.8, 8.4]]) { arch(x, y0, y1, 1.8, '#d6bd96'); arch(x, y0 + 0.15, y1 - 0.15, 1.35, '#9d8a6c'); R(x - 0.25, y0 + 0.15, x + 0.25, y0 + 1.2, '#cdbb99'); }
    R(x - 1.4, 4.8, x + 1.4, 5.1, '#d9c19b'); R(x - 1.4, 0, x + 1.4, 0.7, '#b3996d');
  }
  // archivolts round the three arches (the openings are cut through the shape)
  g.lineCap = 'butt';
  for (const [x0, x1, ys] of SM_HOLES) { const r = (x1 - x0) / 2, cx = (x0 + x1) / 2; for (const [off, wd, col] of [[0.27, 0.54, '#d9c19b'], [0.55, 0.08, 'rgba(60,40,20,0.45)']]) { g.strokeStyle = col; g.lineWidth = wd * sx; g.beginPath(); g.moveTo(X(cx - r - off), Y(0.35)); g.lineTo(X(cx - r - off), Y(ys)); g.arc(X(cx), Y(ys), (r + off) * sx, PI, 0); g.lineTo(X(cx + r + off), Y(0.35)); g.stroke(); } }
  // upper storey: three recessed pointed windows between fluted pilasters
  for (const s of [-1, 1]) { for (const d of [6.3, 7.5]) pil(s * d, STR + 0.35, COR - 0.35, 0.6, '#d9bf91', '#e0c9a2'); pil(s * 2.2, STR + 0.35, COR - 0.35, 0.6, '#d9bf91', '#e0c9a2'); for (const d of [6.3, 7.5, 2.2]) for (let k = -1; k <= 1; k += 2) R(s * d + k * 0.12 - 0.02, STR + 0.8, s * d + k * 0.12 + 0.02, COR - 0.8, 'rgba(70,45,20,0.3)'); }
  for (const x of [-4.2, 0, 4.2]) {
    pointed(x, STR + 0.7, 13.6, 2.7, 15.6, '#e0c9a0'); pointed(x, STR + 0.85, 13.6, 2.35, 15.4, '#d0a876');
    R(x - 0.7, 10.7, x + 0.7, 13.9, '#e3d4b4'); R(x - 0.55, 10.9, x + 0.55, 13.7, '#6b3a2c'); R(x - 0.45, 11.0, x + 0.45, 13.1, '#d7dee0'); R(x - 0.45, 13.2, x + 0.45, 13.6, '#d7dee0'); R(x - 0.04, 11.0, x + 0.04, 13.6, '#6b3a2c'); R(x - 0.45, 12.0, x + 0.45, 12.06, '#6b3a2c');
    g.strokeStyle = '#a9855a'; g.lineWidth = 1.3; g.beginPath(); g.arc(X(x), Y(14.5), 0.36 * sx, 0, 2 * PI); g.stroke();
  }
  // cornice with a frieze of shell brackets
  R(-FW / 2, COR, FW / 2, FH, '#d2b98e'); R(-FW / 2, COR, FW / 2, COR + 0.2, 'rgba(50,30,15,0.4)');
  for (let x = -FW / 2 + 0.25; x < FW / 2 - 0.1; x += 0.5) { R(x, COR + 0.4, x + 0.2, COR + 1.1, '#8a7656'); g.fillStyle = '#e1cba4'; g.beginPath(); g.arc(X(x + 0.1), Y(COR + 1.15), 0.26 * sx, PI, 0); g.fill(); }
  R(-FW / 2, FH - 0.3, FW / 2, FH, '#dcc7a0');
  finish(g, w, h, t, 7203, [STR, COR]);
}
function smDoor(g, w, h) { g.fillStyle = '#7b6a52'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 7231, ['rgba(40,30,20,0.2)', 'rgba(200,185,150,0.18)']); }
function buildNova(c) {
  const { FW, FH, BD, STR, COR, EAVE, NT, NW, RISE, AX } = SM, s = stage(c, FW), { F, at, W, y0 } = s, hw = FW / 2;
  defMat('smFront', 384, 384, [FW, FH], smFront);
  defMat('smWall', 128, 256, [5, FH], (g, w, h) => paintBay(g, w, h, 5, FH, { ashlar: true, base: '#c4a97c', joint: '#8d7655', pc: '#bfa574', fc: '#d3b98d', cc: '#d2b98e', seed: 7221, wins: [{ w: 1.0, y0: 6.0, y1: 8.4 }, { w: 1.0, y0: 12.5, y1: 15.0 }] }));
  begin(y0);
  const body = c.clipFront(s.pts, -BD);
  prism('smWall', body, Math.min(s.gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / FH] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  // the front block: the porch (three arches), the walls behind it
  const hole = ([x0, x1, ys]) => { const r = (x1 - x0) / 2, p = new THREE.Path(); p.moveTo(x0, 0.35); p.lineTo(x0, ys); p.absarc((x0 + x1) / 2, ys, r, PI, 0, true); p.lineTo(x1, 0.35); p.lineTo(x0, 0.35); return p; };
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, FH); sh.lineTo(-hw, FH); sh.lineTo(-hw, 0); for (const h of SM_HOLES) sh.holes.push(hole(h));
  extrude('smFront', sh, 1.0, { M: at(0, 0, -1.05), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  const uvb = { uvo: [0, -y0 / FH] };
  bx('smWall', F, -hw, hw, 0, FH, -BD, -3.6, uvb);
  bx('smWall', F, -hw, hw, 7.4, FH, -3.6, -1.0, uvb);
  for (const sg of [-1, 1]) bx('smWall', F, sg > 0 ? 5.7 : -hw, sg > 0 ? hw : -5.7, 0, 7.4, -3.6, -1.0, uvb);
  bx('flat', F, -hw, hw, FH, FH + 0.12, -BD, 0, { c: '#a39a8c' });
  bx('dark', F, -0.75, 0.75, 0, 3.2, -3.62, -3.5, { c: '#3a2a1e', noao: true }); bx('flat', F, -1.0, 1.0, 3.2, 3.5, -3.65, -3.45, { c: '#cdb893', noao: true });
  bx('flat', F, -hw - 0.3, hw + 0.3, FH - 0.5, FH + 0.1, -BD, 0.5, { c: '#d0b78c', noao: true });
  bx('flat', F, -hw - 0.15, hw + 0.15, STR - 0.2, STR + 0.15, -1.05, 0.25, { c: '#d5bd94', noao: true });
  bx('flat', F, -hw - 0.15, hw + 0.15, COR - 0.05, COR + 0.3, -1.05, 0.3, { c: '#c9ae80', noao: true });
  for (const sg of [-1, 1]) {   // the two marble columns with their capitals, and the edge pilasters
    cyl('marble', 0.29, 0.31, 4.6, 10, { M: at(sg * 2.2, 0.35, -0.3), c: '#e8e2d2' });
    bx('flat', F, sg * 2.2 - 0.45, sg * 2.2 + 0.45, 4.95, 5.45, -0.75, 0.15, { c: '#ddd2b8', noao: true });
    bx('flat', F, sg * 2.2 - 0.42, sg * 2.2 + 0.42, 0.3, 0.6, -0.72, 0.12, { c: '#ddd2b8', noao: true });
    for (const d of [6.3, 7.5, 2.2]) bx('flat', F, sg * d - 0.3, sg * d + 0.3, STR + 0.35, COR - 0.35, -0.05, 0.18, { c: '#d9bf91', noao: true });
  }
  bx('stone', F, -2.0, 2.0, -0.2, 0.2, -0.3, 0.9, { c: '#d6c9a8' });
  // the nave behind: lower, a plain stone box on a slightly turned axis with a tile gable
  const NF = mul(F, rotY(AX)), z0 = -BD, z1 = -44.5;
  bx('smWall', NF, -NW, NW, EAVE, NT, z0, z1, uvb);
  gableOn(mul(NF, tr(0, 0, (z0 + z1) / 2)), NW * 2, z0 - z1, NT, RISE, 'smWall', '#c4a97c');
  const o = end('Chiesa di Santa Maria la Nova');
  o.userData.solids = [[c.p, null, y0 + EAVE], [ringOf(W, -hw, hw, -BD, 0), null, y0 + FH]];
  return o;
}

// ====================================================================================================
// Sant'Eulalia dei Catalani
// ====================================================================================================
const EU = { FW: 10.8, FH: 13.6, BH: 12.2 };
function euFront(g, w, h) {
  const { FW, FH } = EU, t = tools(g, w, h, FW, FH), { R, arch, tri, ell, X, Y, sx, sy, pil } = t;
  paintAshlar(g, w, h, FW, FH, 0.5, 1.0, '#cbb28a', '#8f7a5a', 7301, 1.2, 0.08);
  for (let i = 0; i < 6; i++) { const cx = X(-4.5 + i * 1.8), cy = Y(2 + (i * 7) % 11), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 2.4 * sx); gr.addColorStop(0, 'rgba(100,80,50,0.2)'); gr.addColorStop(1, 'rgba(100,80,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.6, '#a89070');
  // ground floor: a shop arch each side, the portal in the middle
  for (const s of [-1, 1]) { const x = s * 3.85; arch(x, 0.6, 4.8, 3.3, '#d1b98f'); arch(x, 0.75, 4.6, 2.95, '#5b2f31'); for (const dx of [-0.75, 0.75]) R(x + dx - 0.04, 0.75, x + dx + 0.04, 3.4, '#2b1b16'); R(x - 1.45, 2.5, x + 1.45, 2.58, '#2b1b16'); R(x - 1.2, 0.75, x + 1.2, 1.3, '#4a2f20'); }
  R(-1.95, 0.6, 1.95, 5.2, '#cdb289'); R(-1.3, 0.6, 1.3, 4.4, '#1d1a18'); R(-1.3, 3.6, 1.3, 4.4, '#2a2522'); g.strokeStyle = '#6a625a'; g.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(X(k * 0.4), Y(3.6)); g.lineTo(X(k * 0.4), Y(4.4)); g.stroke(); }
  R(-3.4, 4.7, 3.4, 5.3, '#bfa57b'); R(-3.4, 4.7, 3.4, 4.82, 'rgba(50,30,15,0.4)');
  // middle storey: two glazed arches, the blind arch with the arms between them
  R(-FW / 2, 5.3, FW / 2, 5.75, '#c4aa80');
  for (const s of [-1, 1]) { const x = s * 3.85; arch(x, 5.75, 9.1, 3.3, '#c4aa80'); arch(x, 5.9, 8.95, 2.95, '#7d95a0'); const gr = g.createLinearGradient(0, Y(9), 0, Y(5.9)); gr.addColorStop(0, 'rgba(210,230,235,0.35)'); gr.addColorStop(1, 'rgba(20,30,40,0.3)'); g.fillStyle = gr; g.fillRect(X(x - 1.5), Y(9), 3 * sx, 3.1 * sy); }
  arch(0, 5.75, 9.4, 4.4, '#c4aa80'); arch(0, 6.1, 9.2, 3.7, '#e0d3b6'); R(-1.9, 5.75, 1.9, 6.3, '#8d7c60');
  for (const s of [-1, 1]) for (const dx of [0.5, 1.1]) R(s * dx - 0.07, 6.5, s * dx + 0.07, 8.0, '#cbbfa5');
  ell(0, 7.6, 0.5, 0.55, '#b9ad94'); tri(-0.8, 0.8, 8.0, 0.5, '#b9ad94'); R(-0.4, 6.4, 0.4, 7.0, '#b0a58c');
  R(-FW / 2, 9.4, FW / 2, 9.95, '#c4aa80'); R(-FW / 2, 9.4, FW / 2, 9.52, 'rgba(50,30,15,0.4)');
  // top storey: four wreath roundels with busts
  for (const x of [-3.85, -0.95, 0.95, 3.85]) { ell(x, 11.3, 0.78, 0.78, '#a89270'); ell(x, 11.3, 0.52, 0.52, '#6f634e'); ell(x, 11.15, 0.2, 0.26, '#d8d0bc'); R(x - 0.3, 10.75, x + 0.3, 11.0, '#cdc4ae'); }
  // shafts and edge pilasters (painted shading under the solid ones), the top frieze
  for (const s of [-1, 1]) { pil(s * 5.15, 0.6, 12.3, 0.6, '#c4aa7e'); }
  R(-FW / 2, 12.3, FW / 2, FH, '#c0a77c'); R(-FW / 2, 12.3, FW / 2, 12.42, 'rgba(50,30,15,0.4)'); for (let x = -FW / 2 + 0.2; x < FW / 2; x += 0.4) R(x, 12.6, x + 0.16, 13.1, 'rgba(70,50,30,0.35)');
  finish(g, w, h, t, 7302, [5.3, 9.95, 13.0], '60,45,30');
}
function buildEulalia(c) {
  const { FW, FH, BH } = EU, s = stage(c, FW), { F, at, W, y0 } = s, hw = FW / 2;
  defMat('euFront', 320, 384, [FW, FH], euFront);
  defMat('euWall', 128, 256, [5, BH], (g, w, h) => paintBay(g, w, h, 5, BH, { ashlar: true, base: '#c8b08a', joint: '#8f7a5a', pc: '#bda47a', cc: '#c4ab80', seed: 7321 }));
  begin(y0);
  const body = c.clipFront(s.pts, -0.1);
  prism('euWall', body, Math.min(s.gr.lo, y0) - 1.5, y0 + BH, { uvo: [0, -y0 / BH] });
  prism('flat', body, y0 + BH, y0 + BH + 0.12, { c: '#a39a8c' });
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, FH); sh.lineTo(-hw, FH); sh.lineTo(-hw, 0);
  extrude('euFront', sh, 1.2, { M: at(0, 0, -1.25), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.3, hw + 0.3, 12.9, FH + 0.1, -1.25, 0.5, { c: '#c4ab80', noao: true });
  bx('flat', F, -hw - 0.15, hw + 0.15, 9.5, 9.85, -1.25, 0.3, { c: '#cbb288', noao: true });
  bx('flat', F, -3.6, 3.6, 4.9, 5.3, -1.25, 0.5, { c: '#cbb288', noao: true });
  for (const sg of [-1, 1]) {
    cyl('flat', 0.25, 0.28, 11.8, 10, { M: at(sg * 2.2, 0.6, 0.25), c: '#cdb487' });
    for (const [y, hh] of [[4.5, 0.5], [9.2, 0.45], [12.0, 0.4]]) bx('flat', F, sg * 2.2 - 0.4, sg * 2.2 + 0.4, y, y + hh, -0.1, 0.55, { c: '#d6bf93', noao: true });
    bx('flat', F, sg * 5.15 - 0.3, sg * 5.15 + 0.3, 0.6, 12.3, -0.05, 0.22, { c: '#c4aa7e', noao: true });
    bx('flat', F, sg * 3.85 - 1.6, sg * 3.85 + 1.6, 0.3, 0.6, -0.05, 0.4, { c: '#b59d78', noao: true });
  }
  bx('stone', F, -1.9, 1.9, -0.2, 0.2, -0.05, 0.7, { c: '#d6c9a8' });
  const o = end("Chiesa di Sant'Eulalia dei Catalani");
  o.userData.solids = [[c.p, null, y0 + BH]];
  return o;
}

// ====================================================================================================
// San Sebastiano
// ====================================================================================================
const SB = { FW: 16.6, FH: 17.7, LOW: 11.0, ATT: 11.9, UP: 15.2, ENT: 16.0, TOP: 17.5, EAVE: 10.8, NT: 13.4, NW: 5.2, RISE: 3.0, NZ1: -31.5 };
function sbFront(g, w, h) {
  const { FW, FH, LOW, ATT, UP, ENT, TOP } = SB, t = tools(g, w, h, FW, FH), { R, tri, ell, X, Y, sx, sy, pil } = t, PL = '#e0c0a6', ST = '#bfa88a', DK = '#9d8d79';
  g.fillStyle = PL; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 55, 2, 7401, ['rgba(150,90,60,0.09)', 'rgba(255,240,225,0.1)', 'rgba(110,70,50,0.07)']);
  for (let i = 0; i < 6; i++) { const cx = X(-7 + i * 2.8), cy = Y(2 + (i * 5) % 9), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 3.5 * sx); gr.addColorStop(0, 'rgba(190,150,120,0.22)'); gr.addColorStop(1, 'rgba(190,150,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 0.5, '#a98a6c');
  // corner pilasters in honey ashlar, inner pilasters in grey-brown stone, all on pedestals
  for (const s of [-1, 1]) {
    R(s * 7.7 - 0.7, 0, s * 7.7 + 0.7, 1.2, '#c2a47a'); pil(s * 7.7, 1.2, LOW - 1.3, 1.0, '#d9a851', '#dcc08a'); for (let y = 1.5; y < LOW - 1.5; y += 0.55) R(s * 7.7 - 0.5, y, s * 7.7 + 0.5, y + 0.04, 'rgba(90,50,10,0.35)');
    R(s * 3.4 - 0.55, 0, s * 3.4 + 0.55, 1.2, '#b8a387'); pil(s * 3.4, 1.2, LOW - 1.3, 0.8, ST, '#cdb89a');
    // window with a triangular pediment, a blind niche door under the other side
    const x = s * 5.55;
    R(x - 1.15, 4.7, x + 1.15, 7.9, '#cdb89a'); R(x - 0.62, 5.2, x + 0.62, 7.5, '#2a2828'); g.strokeStyle = 'rgba(150,140,130,0.5)'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(X(x - 0.62 + k * 0.25), Y(5.2)); g.lineTo(X(x + 0.62), Y(5.2 + (1.24 - k * 0.25) * 1.85)); g.stroke(); }
    R(x - 0.62, 5.2, x - 0.5, 7.5, '#bfae95'); R(x + 0.5, 5.2, x + 0.62, 7.5, '#bfae95'); R(x - 1.35, 4.95, x + 1.35, 5.25, '#b9a58a'); R(x - 1.35, 7.5, x + 1.35, 7.85, '#b9a58a'); tri(x - 1.5, x + 1.5, 7.85, 1.0, '#b9a58a'); tri(x - 1.0, x + 1.0, 7.95, 0.6, PL);
    const nx = s * 5.8; R(nx - 1.2, 0.3, nx + 1.2, 3.7, '#cdb89a'); R(nx - 0.85, 0.3, nx + 0.85, 3.4, '#c7a07e'); R(nx - 1.35, 3.7, nx + 1.35, 4.0, '#b9a58a'); tri(nx - 1.45, nx + 1.45, 4.0, 0.5, '#b9a58a');
  }
  // the portal: tall door, fluted jambs, lintel, broken curved pediment, crown
  R(-1.9, 0, 1.9, 4.5, '#cdb89a'); R(-1.2, 0, 1.2, 4.1, '#8b3f27'); R(-0.04, 0, 0.04, 4.1, '#3b1b10'); for (const y of [0.3, 1.7, 3.0]) { R(-1.1, y, -0.1, y + 1.1, 'rgba(0,0,0,0.14)'); R(0.1, y, 1.1, y + 1.1, 'rgba(0,0,0,0.14)'); }
  R(-2.1, 4.1, 2.1, 4.9, '#b9a58a'); R(-1.7, 4.9, 1.7, 5.3, '#a89478'); g.fillStyle = '#b9a58a';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 2.1), Y(4.9)); g.quadraticCurveTo(X(s * 1.3), Y(5.0), X(s * 0.4), Y(6.2)); g.lineTo(X(s * 0.4), Y(5.7)); g.quadraticCurveTo(X(s * 1.3), Y(4.6), X(s * 2.1), Y(4.5)); g.fill(); }
  R(-0.35, 5.7, 0.35, 6.9, '#b0997b'); ell(0, 7.1, 0.35, 0.4, '#a38a66'); R(-0.3, 7.4, 0.3, 7.6, '#9b8359');
  // the lattice panel over the door
  R(-1.65, 7.3, 1.65, 9.5, '#b8a68a'); R(-1.4, 7.55, 1.4, 9.25, '#c07a58'); g.strokeStyle = 'rgba(70,35,20,0.5)'; g.lineWidth = 1; for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(X(k * 0.23 - 1.0), Y(7.55)); g.lineTo(X(k * 0.23 + 1.0), Y(9.25)); g.stroke(); g.beginPath(); g.moveTo(X(k * 0.23 + 1.0), Y(7.55)); g.lineTo(X(k * 0.23 - 1.0), Y(9.25)); g.stroke(); }
  // heavy entablature
  R(-FW / 2, LOW - 1.3, FW / 2, LOW, DK); R(-FW / 2, LOW - 1.3, FW / 2, LOW - 1.15, 'rgba(30,20,10,0.4)'); for (let x = -FW / 2 + 0.3; x < FW / 2; x += 0.8) R(x, LOW - 1.0, x + 0.3, LOW - 0.35, 'rgba(40,30,20,0.4)');
  // attic band with panels, the oculus in its shaped frame, the upper pilasters, the pediment
  R(-FW / 2 + 0.3, LOW, FW / 2 - 0.3, ATT, PL); for (const s of [-1, 1]) for (const [a, b] of [[1.9, 4.0], [4.3, 7.0]]) { R(s * a - (s < 0 ? 0 : 0), LOW + 0.2, s * b, ATT - 0.2, 'rgba(150,90,60,0.35)'); R(s * a + (s < 0 ? -0.0 : 0), LOW + 0.2, s * b, ATT - 0.2, 'rgba(180,120,90,0.25)'); }
  for (const s of [-1, 1]) R(s * 7.7 - 0.4, LOW, s * 7.7 + 0.4, ATT, ST);
  R(-3.0, LOW + 0.3, 3.0, 14.0, '#e6c8b0'); tri(-3.0, 3.0, 14.0, 0.0, PL);
  ell(0, 12.3, 1.35, 1.35, '#bda98c'); ell(0, 12.3, 1.05, 1.05, '#a8957a'); ell(0, 12.3, 0.85, 0.85, '#2c3a50'); g.strokeStyle = '#8a5a3a'; g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { const a = k * 2 * PI / 5; g.beginPath(); g.moveTo(X(0), Y(12.3)); g.lineTo(X(Math.cos(a) * 0.85), Y(12.3 + Math.sin(a) * 0.85)); g.stroke(); }
  g.strokeStyle = '#bfae95'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(-2.0), Y(LOW + 1.0)); g.lineTo(X(-2.0), Y(13.2)); g.quadraticCurveTo(X(-2.0), Y(13.9), X(-1.0), Y(13.9)); g.quadraticCurveTo(X(0), Y(14.3), X(1.0), Y(13.9)); g.quadraticCurveTo(X(2.0), Y(13.9), X(2.0), Y(13.2)); g.lineTo(X(2.0), Y(LOW + 1.0)); g.stroke();
  for (const s of [-1, 1]) pil(s * 3.3, ATT, UP, 0.85, ST, '#cdb89a');
  R(-3.9, UP, 3.9, ENT, '#a89478'); for (let x = -3.7; x < 3.8; x += 0.3) R(x, UP + 0.15, x + 0.12, ENT - 0.15, 'rgba(50,35,20,0.4)');
  tri(-4.15, 4.15, ENT, TOP - ENT, '#a39075'); tri(-3.55, 3.55, ENT + 0.2, TOP - ENT - 0.6, '#e0c4aa');
  finish(g, w, h, t, 7402, [LOW, ENT], '70,45,35');
}
function buildSebastiano(c) {
  const { FW, FH, LOW, ATT, UP, ENT, TOP, EAVE, NT, NW, RISE, NZ1 } = SB, s = stage(c, FW), { F, at, W, y0 } = s, hw = FW / 2;
  defMat('sbFront', 384, 384, [FW, FH], sbFront);
  defMat('sbWall', 128, 256, [5, NT], (g, w, h) => paintBay(g, w, h, 5, NT, { ashlar: false, base: '#dcbca2', pc: '#c9b090', cc: '#b4a086', seed: 7421 }));
  begin(y0);
  const body = c.clipFront(s.pts, -0.1);
  prism('sbWall', body, Math.min(s.gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / NT] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  bx('sbWall', F, -NW, NW, EAVE, NT, -1.3, NZ1, { uvo: [0, -y0 / NT] });
  gableOn(at(0, 0, (NZ1 - 1.3) / 2), NW * 2, -1.3 - NZ1, NT, RISE, 'sbWall', '#dcbca2');
  // the front: lower order, attic band, scrolls, the narrow upper order, the pediment
  const sh = new THREE.Shape();
  sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, ATT); sh.lineTo(7.5, ATT); sh.bezierCurveTo(6.0, ATT + 0.1, 4.2, ATT + 1.1, 3.9, ATT + 2.9);
  sh.lineTo(3.9, ENT); sh.lineTo(4.15, ENT); sh.lineTo(0, TOP); sh.lineTo(-4.15, ENT); sh.lineTo(-3.9, ENT); sh.lineTo(-3.9, ATT + 2.9);
  sh.bezierCurveTo(-4.2, ATT + 1.1, -6.0, ATT + 0.1, -7.5, ATT); sh.lineTo(-hw, ATT); sh.lineTo(-hw, 0);
  extrude('sbFront', sh, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.25, hw + 0.25, LOW - 0.5, LOW + 0.1, -1.35, 0.5, { c: '#9d8d79', noao: true });
  bx('flat', F, -hw - 0.05, hw + 0.05, ATT - 0.1, ATT + 0.15, -1.35, 0.3, { c: '#a89478', noao: true });
  bx('flat', F, -4.3, 4.3, ENT - 0.05, ENT + 0.35, -1.35, 0.4, { c: '#a89478', noao: true });
  const rl = Math.hypot(4.15, TOP - ENT), ra = Math.atan2(TOP - ENT, 4.15);
  for (const sg of [-1, 1]) {
    box('flat', rl, 0.28, 0.65, { M: F, p: [sg * 2.07, ENT + 0.4 + (TOP - ENT) / 2 - 0.2, -0.45], rz: -sg * ra, c:'#a89478', noao: true });
    bx('flat', F, sg * 7.7 - 0.7, sg * 7.7 + 0.7, 0, 1.2, -0.05, 0.4, { c: '#c2a47a', noao: true });
    bx('flat', F, sg * 7.7 - 0.5, sg * 7.7 + 0.5, 1.2, LOW - 1.3, -0.05, 0.3, { c: '#d9a851', noao: true });
    bx('flat', F, sg * 3.4 - 0.55, sg * 3.4 + 0.55, 0, 1.2, -0.05, 0.4, { c: '#b8a387', noao: true });
    bx('flat', F, sg * 3.4 - 0.4, sg * 3.4 + 0.4, 1.2, LOW - 1.3, -0.05, 0.3, { c: '#bfa88a', noao: true });
    bx('flat', F, sg * 3.3 - 0.42, sg * 3.3 + 0.42, ATT, UP, -0.05, 0.28, { c: '#bfa88a', noao: true });
    bx('flat', F, sg * 5.55 - 1.35, sg * 5.55 + 1.35, 7.5, 7.85, -0.05, 0.35, { c: '#b9a58a', noao: true });
    bx('flat', F, sg * 5.55 - 1.2, sg * 5.55 + 1.2, 4.95, 5.25, -0.05, 0.35, { c: '#b9a58a', noao: true });
    cyl('flat', 0.17, 0.19, 3.7, 8, { M: at(sg * 1.5, 0.2, 0.05), c: '#c5b08e' });
    sphere('flat', 0.36, { M: at(sg * 4.2, ENT + 0.55, -0.3), seg: 6, c: '#c8b496' }); sphere('flat', 0.4, { M: at(sg * 8.0, ATT + 0.4, -0.5), seg: 6, c: '#c8b496' });
    box('flat', 1.8, 0.3, 0.6, { M: F, p: [sg * 1.2, 4.5, 0.0], rz: -sg * 0.45, c: '#b9a58a', noao: true });
  }
  bx('flat', F, -2.15, 2.15, 4.1, 4.9, -0.05, 0.4, { c: '#b9a58a', noao: true });
  bx('flat', F, -0.07, 0.07, TOP, TOP + 1.7, -0.7, -0.55, { c: '#3e3a36', noao: true }); bx('flat', F, -0.5, 0.5, TOP + 0.9, TOP + 1.05, -0.7, -0.55, { c: '#3e3a36', noao: true });
  bx('stone', F, -2.2, 2.2, -0.2, 0.2, -0.05, 0.6, { c: '#d6c9a8' }); bx('stone', F, -2.0, 2.0, 0.2, 0.4, -0.05, 0.3, { c: '#d6c9a8' });
  const o = end('Chiesa di San Sebastiano');
  o.userData.solids = [[c.p, null, y0 + EAVE], [ringOf(W, -NW, NW, NZ1, -1.3), null, y0 + NT + RISE]];
  return o;
}

export const BATCH_B = [
  mk('w86877286', [266.3, -653.2, 294.9, -662.8, 289, -680.4, 260.3, -670.9], [263.3, -662.05], [-0.947, 0.321], 'Chiesa di San Giorgio dei Genovesi', 277, -666, 40, buildGenovesi),
  mk('w86886700', [343.4, -397.5, 349, -381.8, 393.7, -396.1, 389.9, -408.3, 386.9, -407.6, 385.7, -410], [346.2, -389.65], [-0.942, 0.336], 'Chiesa di Santa Maria la Nova', 368, -399, 45, buildNova),
  mk('w86886724', [238.3, -232.6, 245.2, -236.6, 250, -228.6, 252.6, -230.2, 254, -231, 255.5, -231.8, 259.4, -234.1, 254.7, -242, 261.6, -246.1, 255.6, -256.3, 249.1, -252.6, 244.6, -260.2, 234.5, -254.3, 239.1, -246.6, 232.3, -242.7], [254.7, -231.35], [0.505, 0.863], "Chiesa di Sant'Eulalia dei Catalani", 247, -244, 40, buildEulalia),
  mk('w86886706', [421.6, -439.4, 425.1, -423.1, 456.8, -429.8, 453.3, -446.1, 423.2, -439.9], [455.05, -437.95], [0.976, -0.21], 'Chiesa di San Sebastiano', 439, -434, 35, buildSebastiano),
];
