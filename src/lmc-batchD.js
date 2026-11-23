// City landmarks, batch D: Chiesa di Sant'Orsola (w279886914), Chiesa della Madonna del Lume (w86886719), Chiesa di Sant'Antonio di Padova (w49772130),
// Chiesa di Santa Maria della Grotta al Cassaro (w926581675). Registered through BATCH_D in src/landmarks-city.js; each one replaces its OSM footprint.
// Frame F of each church: origin on the ground in the middle of the front, +z out of the front, local x along the front (to the right seen from the street). Collision stays the footprint.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions and colours read):
//   Sant'Orsola: Palermo - chiesa di Sant'Orsola - 2026-09-03 10-05-02 001.jpg; SO PA 14 09 2018 01.jpg; Chiesa di Sant'Orsola, Palermo - facciata.JPG
//   Madonna del Lume: Madonna del Lume (Palermo) 14 07 2024 01.jpg; Chiesa di Santa Maria del Lume (Palermo) - facciata.JPG
//   Sant'Antonio di Padova: PA SAP 17 04 2018.jpg; Sant'Antonio di Padova (Palermo) 14 07 2024 22.jpg
//   Santa Maria della Grotta: Santa Maria della Grotta (Palermo) 14 07 2024 01.jpg; SMG PA 15 07 2018 01.jpg
// Read from the photos, Sant'Orsola: white plastered front with ochre stone pilasters, two orders (pilaster pairs each side of a grey marble portal with a broken curved pediment; above, a framed window with two angels
//   and an arched belfry opening with a balustrade at each end), a triangular pediment, the bell tower on the right (seen from the street) rising behind the front. Heights relative to the width (12.8 m): lower cornice 0.73, upper 1.1, apex 1.2.
// Madonna del Lume: grey-brown tufa front in two orders: lower with a door under a triangular pediment, a niche each side and pilaster pairs, a plain attic with a garland panel, a narrower upper order (framed window under a
//   curved hood, pilaster pairs), concave scroll wings, a triangular pediment with urns and a cross. Heights relative to the width (11.2 m): lower cornice 0.68, upper cornice 1.1, apex 1.27.
// Sant'Antonio di Padova: narrow front on the north-east end of the long nave, white with ochre corner pilasters in one order: portal with a curved broken pediment, a window with scrolls over it, a frieze of blocks, a triangular
//   pediment with an oculus; a lower wing each side (oculus). The front is the short end that faces the piazza at Corso Tukory (the long wall along the avenue is not a front).
// Santa Maria della Grotta: weathered grey-tan stone front on Corso Vittorio Emanuele in two orders: a big door under a triangular pediment with garlands, two pilaster pairs each side, a balustrade, an arched window with
//   pilaster groups, scroll wings, a curved broken top with a central cartouche and two big volutes.
// Not known and not drawn: the roofs and side walls behind the fronts (plain walls, tile roofs assumed), the interiors, iron work, the sculpture (painted as relief shapes).
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, pyramid, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, archShape, balus, cyl } from './lmc-kit.js';

// ---------- shared helpers ----------
function makeFrame(O, N) {
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
  return { toWorld, clipFront };
}
// canvas painter in metres: x from the middle of the front, y up from the ground
function P(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const pil = (x, y0, y1, ww, c, hi = 'rgba(255,240,205,0.30)', sh = 'rgba(50,30,15,0.30)') => { R(x - ww / 2, y0, x + ww / 2, y1, c); R(x - ww / 2, y0, x - ww / 2 + 0.1, y1, hi); R(x + ww / 2 - 0.12, y0, x + ww / 2, y1, sh); R(x - ww / 2 - 0.1, y1 - 0.4, x + ww / 2 + 0.1, y1, c); R(x - ww / 2 - 0.1, y1 - 0.4, x + ww / 2 + 0.1, y1 - 0.34, sh); };
  const shade = (yTop, len) => { const gs = g.createLinearGradient(0, Y(yTop), 0, Y(yTop - len)); gs.addColorStop(0, 'rgba(50,30,15,0.28)'); gs.addColorStop(1, 'rgba(50,30,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(yTop), w, len * sy); };
  const foot = () => { const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.32)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy); };
  return { sx, sy, X, Y, R, arch, tri, circ, pil, shade, foot };
}
// side wall bay 4.5 m wide: plaster, a stone pilaster edge each side, one arched window, a cornice
function paintWall(g, w, h, hm, seed, base, stone, trim) {
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, seed, ['rgba(130,105,70,0.09)', 'rgba(255,248,230,0.08)']);
  R(0, 0, 0.5, hm, stone); R(4.0, 0, 4.5, hm, stone);
  if (hm > 6) { R(0, 0, 4.5, 0.9, 'rgba(70,55,40,0.35)'); arch(2.25, hm - 5.6, hm - 1.7, 1.5, stone); arch(2.25, hm - 5.35, hm - 1.95, 1.0, '#2b3540'); }
  else { arch(2.25, hm * 0.2, hm - 0.8, 1.3, stone); arch(2.25, hm * 0.2 + 0.2, hm - 1.0, 0.9, '#2b3540'); }
  R(0, hm - 0.6, 4.5, hm, trim); R(0, hm - 0.95, 4.5, hm - 0.6, 'rgba(50,30,15,0.28)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '70,50,35');
}
function jambs(F, xi, xo, y0, y1, d, c) {   // door surround: two jambs and a lintel, the door itself stays flat
  for (const sg of [-1, 1]) bx('flat', F, sg > 0 ? xi : -xo, sg > 0 ? xo : -xi, y0, y1, -0.05, d, { c, noao: true });
  bx('flat', F, -xo, xo, y1 - 0.4, y1, -0.05, d, { c, noao: true });
}
function rake(F, hx, y, rise, depth, z0, c) {   // raking cornice of a triangular pediment (two tilted slabs) with its base at height y
  const len = Math.hypot(hx, rise) + 0.3, ang = Math.atan2(rise, hx);
  for (const sg of [-1, 1]) bx('flat', mul(F, mul(tr(sg * hx / 2, y + rise / 2, z0), new THREE.Matrix4().makeRotationZ(-sg * ang))), -len / 2, len / 2, -0.17, 0.17, 0, depth, { c, noao: true });
}

// C: id, name, p (footprint ring), O, N (the front line), hw (half width of the front), eave, nave { w, z0, z1, top, rise } or roof { w, z0, z1, rise },
// front (key prefix, texture size, FH, painter, shape(s) callback), trims(env), extra(env) -> extra solids
function build(C) {
  initShared();
  const { toWorld: W, clipFront } = makeFrame(C.O, C.N), pts = pairsOf(C.p), gr = groundRange(pts), hw = C.hw;
  const y0 = Math.min(groundY(...W(-hw * 0.8, 2)), groundY(...W(hw * 0.8, 2)), groundY(...W(0, 3)));
  const F = frame(C.O[0], y0, C.O[1], C.N[0], C.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  const k = C.k, EAVE = C.eave, nv = C.nave, naveH = nv ? nv.top - EAVE : 0;
  defMat(k + 'F', C.tex[0], C.tex[1], [hw * 2, C.FH], C.paint);
  defMat(k + 'B', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, C.seed, C.wall, C.stone, C.trim));
  if (nv) defMat(k + 'N', 128, 256, [4.5, naveH], (g, w, h) => paintWall(g, w, h, naveH, C.seed + 20, C.wall, C.stone, C.trim));
  begin(y0);
  const body = clipFront(pts, -0.1);
  prism(k + 'B', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  if (nv) {
    const zm = (nv.z0 + nv.z1) / 2;
    bx(k + 'N', F, -nv.w / 2, nv.w / 2, EAVE, nv.top, nv.z1, nv.z0, { uvo: [0, -(y0 + EAVE) / naveH] });
    gable('tile', k + 'N', at(0, 0, zm), nv.w, nv.z0 - nv.z1, nv.top, nv.rise, { ov: 0.35, c: '#b8744f', wc: C.wall });
  } else {
    const rf = C.roof, zm = (rf.z0 + rf.z1) / 2;
    gable('tile', k + 'B', at(0, 0, zm), rf.w, rf.z0 - rf.z1, EAVE, rf.rise, { ov: 0.35, c: '#b8744f', wc: C.wall });
  }
  const s = new THREE.Shape(); C.shape(s);
  extrude(k + 'F', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / (hw * 2), 1 / C.FH], uvo: [0.5, 0], cs: 8, noao: true });
  const env = { F, at, y0, hw, W };
  C.trims(env);
  const o = end(C.name);
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  const solids = [[C.p, null, y0 + EAVE]];
  if (nv) solids.push([ring(-nv.w / 2, nv.w / 2, nv.z1, nv.z0), null, y0 + nv.top + nv.rise]);
  for (const e of C.solids || []) solids.push([ring(e[0], e[1], e[2], e[3]), null, y0 + e[4]]);
  o.userData.solids = solids;
  return o;
}
const cen = (p) => { let x = 0, z = 0; const n = p.length / 2; for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; } return [Math.round(x / n), Math.round(z / n)]; };
const reg = (C) => { const c = cen(C.p); return { name: C.name, x: c[0], z: c[1], radius: 50, skipIds: [C.id], build: () => build(C) }; };

// =====================================================================================================
// Sant'Orsola (Via Maqueda): front 12.8 m, tower on the right wing
// =====================================================================================================
const SO_HW = 6.4, SO_LOW = 9.3, SO_UPC = 14.2, SO_APEX = 15.8, SO_STN = '#c7a064', SO_WH = '#efe8d9', SO_MAR = '#b9b3a6';
function paintSO(g, w, h) {
  const { R, arch, tri, circ, pil, shade, foot, X, Y, sx } = P(g, w, h, 12.8, SO_APEX);
  g.fillStyle = SO_WH; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 7101, ['rgba(150,125,90,0.08)', 'rgba(255,250,240,0.10)']);
  R(-6.4, 0, 6.4, 1.0, '#a89880');
  for (const sg of [-1, 1]) {
    for (const [c, ww] of [[2.5, 1.2], [4.5, 1.8]]) {
      const x = sg * c; pil(x, 1.0, SO_LOW - 1.3, ww, SO_STN);
      R(x - ww / 2 + 0.22, 1.6, x + ww / 2 - 0.22, 2.9, '#b78e55'); R(x - ww / 2 + 0.22, 3.4, x + ww / 2 - 0.22, SO_LOW - 1.9, 'rgba(120,85,45,0.28)');
    }
  }
  R(-6.4, SO_LOW - 1.3, 6.4, SO_LOW, SO_STN); R(-6.4, SO_LOW - 1.3, 6.4, SO_LOW - 1.2, 'rgba(50,30,15,0.4)');
  for (let x = -5.6; x <= 5.7; x += 1.6) R(x - 0.25, SO_LOW - 1.15, x + 0.25, SO_LOW - 0.45, '#b78e55');
  R(-6.4, SO_LOW - 0.25, 6.4, SO_LOW, '#d9b278');
  // portal: grey marble, door, broken curved pediment
  R(-2.0, 1.0, 2.0, 6.0, SO_MAR); R(-1.1, 1.0, 1.1, 5.8, '#3b2b20'); R(-0.03, 1.0, 0.03, 5.8, '#1d140d');
  for (let y = 1.6; y < 5.6; y += 1.2) { R(-1.0, y, -0.1, y + 1.0, 'rgba(0,0,0,0.14)'); R(0.1, y, 1.0, y + 1.0, 'rgba(0,0,0,0.14)'); }
  R(-2.4, 5.9, 2.4, 6.5, '#a8a396'); R(-1.95, 6.5, 1.95, 6.7, '#8f8a7e');
  for (const sg of [-1, 1]) { g.fillStyle = SO_MAR; g.beginPath(); g.moveTo(X(sg * 2.2), Y(6.6)); g.quadraticCurveTo(X(sg * 1.6), Y(7.6), X(sg * 0.9), Y(7.5)); g.quadraticCurveTo(X(sg * 1.3), Y(7.2), X(sg * 1.5), Y(6.6)); g.fill(); }
  circ(-1.7, 4.3, 0.28, '#8f8a7e'); circ(1.7, 4.3, 0.28, '#8f8a7e'); R(-2.0, 0.0, 2.0, 1.0, '#9d978a');
  // upper order
  R(-6.4, SO_LOW, 6.4, SO_UPC, SO_WH);
  for (const sg of [-1, 1]) {
    R(sg * 4.8 - 1.55, SO_LOW, sg * 4.8 + 1.55, SO_LOW + 1.3, SO_STN); R(sg * 4.8 - 1.4, SO_LOW + 0.2, sg * 4.8 + 1.4, SO_LOW + 1.1, '#d6ccb8');
    pil(sg * 3.2, SO_LOW + 1.3, SO_UPC - 0.9, 0.75, SO_STN); pil(sg * 6.0, SO_LOW + 1.3, SO_UPC - 0.9, 0.7, SO_STN);
    arch(sg * 4.65, SO_LOW + 1.4, 13.9, 1.9, SO_STN); arch(sg * 4.65, SO_LOW + 1.5, 13.6, 1.35, '#27221d');
    R(sg * 4.65 - 0.65, SO_LOW + 1.5, sg * 4.65 + 0.65, SO_LOW + 2.4, '#d9cdb4'); for (let b = -0.5; b <= 0.5; b += 0.25) R(sg * 4.65 + b - 0.04, SO_LOW + 1.55, sg * 4.65 + b + 0.04, SO_LOW + 2.35, '#6a5c4a');
  }
  R(-2.9, 9.8, 2.9, 13.4, SO_STN); R(-2.65, 10.05, 2.65, 13.15, '#e6dcc6');
  R(-1.15, 9.7, 1.15, 13.0, SO_STN); R(-0.8, 9.95, 0.8, 12.4, '#2f3d4c'); for (const y of [10.7, 11.5]) R(-0.8, y, 0.8, y + 0.06, '#8d7b5f'); R(-0.03, 9.95, 0.03, 12.4, '#8d7b5f');
  g.fillStyle = SO_STN; g.beginPath(); g.ellipse(X(0), Y(12.95), 1.5 * sx, 0.55 * sx, 0, PI, 0); g.fill(); R(-1.5, 12.9, 1.5, 13.0, '#a98250');
  for (const sg of [-1, 1]) { R(sg * 1.65 - 0.45, 10.0, sg * 1.65 + 0.45, 12.4, '#bd9660'); circ(sg * 1.65, 10.15, 0.4, '#a98250'); circ(sg * 1.65, 12.0, 0.25, '#d2ac74'); }
  R(-6.4, SO_UPC - 0.9, 6.4, SO_UPC, SO_STN); R(-6.4, SO_UPC - 0.95, 6.4, SO_UPC - 0.88, 'rgba(50,30,15,0.4)');
  tri(-4.4, 4.4, SO_UPC, 1.6, SO_STN); tri(-3.7, 3.7, SO_UPC + 0.22, 1.15, SO_WH); circ(0, SO_UPC + 0.75, 0.45, '#b8956a');
  shade(SO_LOW, 1.6); shade(SO_UPC, 1.4); streaks(g, w, h, 30, 7102, 0.1, 100, '70,50,35'); foot();
}
const SO = {
  id: 'w279886914', name: "Chiesa di Sant'Orsola", k: 'so',
  p: [158.6, 289.9, 160.5, 293.5, 166.3, 304.9, 141.4, 317.4, 139.9, 314.4, 136.9, 315.1, 134.5, 313.9, 132.9, 310.1, 133.3, 308, 134.8, 306.4, 133.2, 303.6, 137.3, 301.3, 141.8, 298.8, 154.6, 291.9],
  O: [163.4, 299.2], N: [0.891, -0.453], hw: SO_HW, eave: SO_LOW, FH: SO_APEX, tex: [304, 376], paint: paintSO, seed: 7121, wall: '#e6dcc4', stone: SO_STN, trim: '#d4b078',
  nave: { w: 11.8, z0: -1.0, z1: -27, top: 12.8, rise: 2.9 },
  shape(s) { s.moveTo(-6.4, 0); s.lineTo(6.4, 0); s.lineTo(6.4, SO_UPC); s.lineTo(4.4, SO_UPC); s.lineTo(0, SO_UPC + 1.6); s.lineTo(-4.4, SO_UPC); s.lineTo(-6.4, SO_UPC); s.lineTo(-6.4, 0); },
  trims({ F, at, y0 }) {
    bx('flat', F, -6.6, 6.6, SO_LOW - 1.3, SO_LOW + 0.05, -1.35, 0.5, { c: '#c9a468', noao: true });
    bx('flat', F, -6.6, 6.6, SO_UPC - 0.9, SO_UPC + 0.05, -1.35, 0.5, { c: '#c9a468', noao: true });
    for (const sg of [-1, 1]) {
      for (const [c, ww] of [[2.5, 1.2], [4.5, 1.8]]) bx('flat', F, sg * c - ww / 2, sg * c + ww / 2, 1.0, SO_LOW - 1.3, -0.05, 0.28, { c: SO_STN, noao: true });
      bx('flat', F, sg * 3.2 - 0.38, sg * 3.2 + 0.38, SO_LOW + 1.3, SO_UPC - 0.9, -0.05, 0.2, { c: SO_STN, noao: true }); bx('flat', F, sg * 6.0 - 0.35, sg * 6.0 + 0.35, SO_LOW + 1.3, SO_UPC - 0.9, -0.05, 0.2, { c: SO_STN, noao: true });
      balus(at(sg * 4.65, SO_LOW + 1.5, 0.12), 1.2, 0.9);
    }
    bx('flat', F, -2.3, 2.3, 5.9, 6.6, -0.05, 0.55, { c: '#aaa597', noao: true }); jambs(F, 1.1, 2.0, 1.0, 5.9, 0.25, SO_MAR);
    rake(F, 4.4, SO_UPC, 1.6, 0.5, -1.0, '#c9a468');
    bx('flat', F, -0.4, 0.4, SO_UPC + 1.5, SO_UPC + 2.0, -0.9, -0.4, { c: '#c9a468', noao: true });
    bx('flat', F, -0.06, 0.06, SO_UPC + 2.0, SO_UPC + 3.4, -0.7, -0.6, { c: '#3e3a36', noao: true }); bx('flat', F, -0.5, 0.5, SO_UPC + 2.8, SO_UPC + 2.92, -0.7, -0.6, { c: '#3e3a36', noao: true });
    sphere('flat', 0.32, { M: at(-4.7, SO_UPC + 0.35, -0.6), seg: 6, c: '#c9a468' }); sphere('flat', 0.32, { M: at(4.7, SO_UPC + 0.35, -0.6), seg: 6, c: '#c9a468' });
    // the bell tower, on the right wing behind the front
    const T0 = 6.6, T1 = 10.3, TZ0 = -4.5, TZ1 = -0.3, TT = 17.9;
    bx('tufa', F, T0, T1, SO_LOW - 0.5, TT, TZ0, TZ1, { c: '#dcb97e' });
    bx('flat', F, T0 - 0.2, T1 + 0.2, TT, TT + 0.55, TZ0 - 0.2, TZ1 + 0.2, { c: '#c9a468', noao: true });
    bx('flat', F, T0 - 0.15, T1 + 0.15, SO_UPC + 0.1, SO_UPC + 0.4, TZ0 - 0.15, TZ1 + 0.15, { c: '#c9a468', noao: true });
    for (const [x, z, ry] of [[(T0 + T1) / 2, TZ1 - 0.02, 0], [T1 + 0.02, (TZ0 + TZ1) / 2, PI / 2]]) {
      extrude('dark', archShape(1.5, 2.8), 0.1, { M: mul(at(x, SO_UPC + 0.6, z), rotY(ry)), p: [0, 0, -0.08], noao: true });
      bx('flat', mul(at(x, SO_UPC + 0.6, z), rotY(ry)), -0.9, 0.9, -0.12, 0.0, -0.1, 0.1, { c: '#c9a468', noao: true });
    }
    for (const [cx, cz] of [[T0, TZ1], [T1, TZ1], [T0, TZ0], [T1, TZ0]]) bx('flat', F, cx - 0.22, cx + 0.22, SO_UPC + 0.4, TT, cz - 0.22, cz + 0.22, { c: '#c9a468', noao: true });
    pyramid('lead', (T1 - T0) + 0.6, (TZ1 - TZ0) + 0.6, 1.3, { M: F, p: [(T0 + T1) / 2, TT + 0.55, (TZ0 + TZ1) / 2], c: '#b9b8ae' });
    bx('flat', F, (T0 + T1) / 2 - 0.05, (T0 + T1) / 2 + 0.05, TT + 1.85, TT + 3.0, (TZ0 + TZ1) / 2 - 0.05, (TZ0 + TZ1) / 2 + 0.05, { c: '#3e3a36', noao: true });
  },
  solids: [[6.6, 10.4, -4.5, 0, 18.5]]
};

// =====================================================================================================
// Madonna del Lume (Via Francesco Matera): front 11.2 m, grey tufa
// =====================================================================================================
const LU_HW = 5.6, LU_LOW = 7.6, LU_ATT = 9.0, LU_UPC = 12.2, LU_APEX = 14.2, LU_ST = '#a89680', LU_LT = '#b9a68a', LU_DK = '#7d6e5a', LU_PL = '#d4b98f';
function paintLU(g, w, h) {
  const { R, arch, tri, circ, pil, shade, foot, X, Y, sx } = P(g, w, h, 11.2, LU_APEX);
  g.fillStyle = LU_ST; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 45, 2, 7201, ['rgba(70,55,38,0.12)', 'rgba(235,220,190,0.10)', 'rgba(40,30,20,0.10)']);
  g.fillStyle = 'rgba(60,45,30,0.12)'; for (let y = 1.7; y < LU_LOW - 1.5; y += 0.55) g.fillRect(0, Y(y), w, 1);
  R(-5.6, 0, 5.6, 1.7, '#8c7c66');
  for (const sg of [-1, 1]) {
    pil(sg * 2.05, 1.7, LU_LOW - 1.4, 0.8, LU_LT); pil(sg * 3.25, 1.7, LU_LOW - 1.4, 0.8, LU_LT); pil(sg * 5.3, 1.7, LU_LOW - 1.4, 0.6, LU_LT);
    R(sg * 4.3 - 0.5, 1.7, sg * 4.3 + 0.5, 3.0, LU_DK); arch(sg * 4.3, 1.9, 3.9, 1.0, '#5b4e3d'); arch(sg * 4.3, 2.1, 3.7, 0.7, '#3d3429');
    R(sg * 4.3 - 0.5, 4.7, sg * 4.3 + 0.5, 6.0, 'rgba(70,55,38,0.3)');
  }
  R(-1.3, 0, 1.3, 4.0, LU_LT); R(-1.0, 0, 1.0, 3.7, '#4a3626'); R(-0.03, 0, 0.03, 3.7, '#2a1d12'); for (let y = 0.5; y < 3.5; y += 1.0) { R(-0.9, y, -0.08, y + 0.8, 'rgba(0,0,0,0.14)'); R(0.08, y, 0.9, y + 0.8, 'rgba(0,0,0,0.14)'); }
  tri(-1.8, 1.8, 4.0, 1.1, LU_LT); tri(-1.3, 1.3, 4.12, 0.7, LU_DK);
  R(-5.6, LU_LOW - 1.4, 5.6, LU_LOW, LU_LT); R(-5.6, LU_LOW - 1.4, 5.6, LU_LOW - 1.3, 'rgba(40,30,20,0.4)'); R(-5.6, LU_LOW - 1.0, 5.6, LU_LOW - 0.6, LU_DK);
  for (const sg of [-1, 1]) { R(sg * 2.65 - 0.65, LU_LOW - 1.2, sg * 2.65 + 0.65, LU_LOW - 0.5, '#8c7c66'); R(sg * 5.3 - 0.4, LU_LOW - 1.2, sg * 5.3 + 0.4, LU_LOW - 0.5, '#8c7c66'); }
  // attic with the garland panel
  R(-5.4, LU_LOW, 5.4, LU_ATT, LU_ST); R(-2.5, LU_LOW + 0.3, 2.5, LU_ATT - 0.2, '#9a8870');
  g.strokeStyle = LU_DK; g.lineWidth = 1.5; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(X(sg * 2.2), Y(8.7)); g.quadraticCurveTo(X(sg * 1.1), Y(7.8), X(0), Y(8.7)); g.stroke(); }
  R(-5.4, LU_ATT - 0.2, 5.4, LU_ATT, LU_LT);
  // scroll wings in plaster, upper order in stone
  R(-5.6, LU_ATT, 5.6, LU_UPC, LU_PL);
  noiseDots(g, w, h, w * h / 70, 2, 7202, ['rgba(130,100,60,0.10)', 'rgba(255,245,220,0.10)']);
  R(-3.3, LU_ATT, 3.3, LU_UPC, LU_ST);
  for (const sg of [-1, 1]) { pil(sg * 2.1, LU_ATT, LU_UPC - 0.6, 0.55, LU_LT); pil(sg * 2.9, LU_ATT, LU_UPC - 0.6, 0.55, LU_LT); }
  R(-0.95, 9.6, 0.95, 11.9, LU_LT); R(-0.7, 9.8, 0.7, 11.7, '#3a3a32'); R(-0.03, 9.8, 0.03, 11.7, '#8d7b5f'); R(-0.7, 10.7, 0.7, 10.75, '#8d7b5f');
  g.fillStyle = LU_LT; g.beginPath(); g.ellipse(X(0), Y(11.9), 1.35 * sx, 0.5 * sx, 0, PI, 0); g.fill(); R(-1.35, 11.85, 1.35, 11.95, LU_DK);
  R(-3.6, LU_UPC - 0.55, 3.6, LU_UPC, LU_LT); R(-3.6, LU_UPC - 0.6, 3.6, LU_UPC - 0.53, 'rgba(40,30,20,0.4)');
  tri(-3.7, 3.7, LU_UPC, 2.0, LU_LT); tri(-3.0, 3.0, LU_UPC + 0.18, 1.55, '#9a8870'); circ(0, LU_UPC + 0.85, 0.38, LU_DK);
  shade(LU_LOW, 1.5); shade(LU_UPC, 1.2); streaks(g, w, h, 34, 7203, 0.12, 100, '60,45,30'); foot();
}
const LU = {
  id: 'w86886719', name: 'Chiesa della Madonna del Lume', k: 'lu',
  p: [380.7, -313, 391.4, -316.2, 404, -290.3, 385.5, -281.6, 378.5, -305.6, 377.3, -309.8],
  O: [386, -314.6], N: [-0.287, -0.958], hw: LU_HW, eave: LU_LOW, FH: LU_APEX, tex: [300, 380], paint: paintLU, seed: 7221, wall: '#d2b98f', stone: '#a89680', trim: '#b9a68a',
  nave: { w: 10.0, z0: -1.0, z1: -27, top: 12.4, rise: 3.0 },
  shape(s) {
    s.moveTo(-5.6, 0); s.lineTo(5.6, 0); s.lineTo(5.6, LU_LOW); s.lineTo(5.4, LU_LOW); s.lineTo(5.4, LU_ATT); s.bezierCurveTo(4.6, LU_ATT + 0.1, 3.5, LU_ATT + 1.0, 3.3, LU_ATT + 2.6); s.lineTo(3.3, LU_UPC);
    s.lineTo(3.7, LU_UPC); s.lineTo(0, LU_UPC + 2.0); s.lineTo(-3.7, LU_UPC); s.lineTo(-3.3, LU_UPC); s.lineTo(-3.3, LU_ATT + 2.6);
    s.bezierCurveTo(-3.5, LU_ATT + 1.0, -4.6, LU_ATT + 0.1, -5.4, LU_ATT); s.lineTo(-5.4, LU_LOW); s.lineTo(-5.6, LU_LOW); s.lineTo(-5.6, 0);
  },
  trims({ F, at }) {
    bx('flat', F, -5.8, 5.8, LU_LOW - 1.4, LU_LOW + 0.05, -1.35, 0.5, { c: '#b9a68a', noao: true });
    bx('flat', F, -3.55, 3.55, LU_UPC - 0.55, LU_UPC + 0.05, -1.35, 0.5, { c: '#b9a68a', noao: true });
    for (const sg of [-1, 1]) {
      for (const c of [2.05, 3.25]) bx('flat', F, sg * c - 0.4, sg * c + 0.4, 1.7, LU_LOW - 1.4, -0.05, 0.2, { c: '#b9a68a', noao: true });
      bx('flat', F, sg * 5.3 - 0.3, sg * 5.3 + 0.3, 1.7, LU_LOW - 1.4, -0.05, 0.2, { c: '#b9a68a', noao: true });
      for (const c of [2.1, 2.9]) bx('flat', F, sg * c - 0.27, sg * c + 0.27, LU_ATT, LU_UPC - 0.6, -0.05, 0.16, { c: '#b9a68a', noao: true });
      cyl('flat', 0.18, 0.3, 0.5, 6, { M: at(sg * 4.1, LU_UPC + 0.6, -0.6), c: '#c0ad8e' }); sphere('flat', 0.3, { M: at(sg * 4.1, LU_UPC + 1.2, -0.6), seg: 6, ky: 1.1, c: '#c0ad8e' });
      cyl('flat', 0.15, 0.25, 0.4, 6, { M: at(sg * 3.15, LU_UPC + 1.6, -0.6), c: '#c0ad8e' }); sphere('flat', 0.25, { M: at(sg * 3.15, LU_UPC + 2.05, -0.6), seg: 6, ky: 1.1, c: '#c0ad8e' });
    }
    bx('flat', F, -1.6, 1.6, 4.0, 4.15, -0.05, 0.55, { c: '#b9a68a', noao: true }); rake(F, 1.8, 4.0, 1.1, 0.3, 0.2, '#b9a68a');
    jambs(F, 1.0, 1.3, 0, 4.0, 0.14, '#b9a68a');
    rake(F, 3.7, LU_UPC, 2.0, 0.5, -1.0, '#b9a68a');
    bx('flat', F, -0.45, 0.45, LU_UPC + 1.9, LU_UPC + 2.8, -0.9, -0.3, { c: '#b9a68a', noao: true }); bx('flat', F, -0.07, 0.07, LU_UPC + 2.8, LU_UPC + 4.4, -0.7, -0.6, { c: '#3e3a36', noao: true }); bx('flat', F, -0.55, 0.55, LU_UPC + 3.7, LU_UPC + 3.82, -0.7, -0.6, { c: '#3e3a36', noao: true });
  }
};

// =====================================================================================================
// Sant'Antonio di Padova (north-east end of the long nave, towards Corso Tukory): front 17.1 m, centre 9.4 m
// =====================================================================================================
const AN_HW = 8.55, AN_CW = 4.7, AN_WING = 9.6, AN_ENT = 13.0, AN_TOP = 14.2, AN_APEX = 16.8, AN_OC = '#d4a65a', AN_WH = '#f0eadc';
function paintAN(g, w, h) {
  const { R, arch, tri, circ, pil, shade, foot, X, Y, sx } = P(g, w, h, 17.1, AN_APEX);
  g.fillStyle = AN_WH; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 7301, ['rgba(150,125,90,0.08)', 'rgba(255,250,240,0.10)']);
  R(-8.55, 0, 8.55, 1.1, '#a89880');
  // wings: ochre end pilaster, cornice, oculus
  for (const sg of [-1, 1]) {
    pil(sg * 8.0, 1.1, AN_WING - 1.0, 1.1, AN_OC); R(sg * 6.4 - 1.6, AN_WING - 1.0, sg * 6.4 + 1.6, AN_WING, AN_OC); R(sg * 6.4 - 1.6, AN_WING - 1.05, sg * 6.4 + 1.6, AN_WING - 0.98, 'rgba(50,30,15,0.4)');
    circ(sg * 6.5, 6.4, 0.95, AN_OC); circ(sg * 6.5, 6.4, 0.7, '#2b3540'); R(sg * 6.5 - 1.2, 3.6, sg * 6.5 + 1.2, 3.75, 'rgba(0,0,0,0.05)');
  }
  // central front: corner pilasters, entablature with a frieze of blocks, pediment with an oculus
  for (const sg of [-1, 1]) { pil(sg * 4.05, 1.1, AN_ENT - 0.3, 1.3, AN_OC); R(sg * 4.05 - 0.45, 1.8, sg * 4.05 + 0.45, AN_ENT - 1.5, 'rgba(120,85,45,0.22)'); }
  R(-4.7, AN_ENT, 4.7, AN_TOP, AN_OC); R(-4.7, AN_ENT + 0.2, 4.7, AN_TOP - 0.45, AN_WH);
  for (let x = -4.2; x <= 4.3; x += 1.2) { R(x - 0.25, AN_ENT + 0.2, x + 0.25, AN_TOP - 0.45, AN_OC); R(x - 0.15, AN_ENT + 0.35, x - 0.1, AN_TOP - 0.55, 'rgba(120,85,45,0.5)'); R(x + 0.1, AN_ENT + 0.35, x + 0.15, AN_TOP - 0.55, 'rgba(120,85,45,0.5)'); }
  tri(-4.7, 4.7, AN_TOP, 2.6, AN_OC); tri(-4.0, 4.0, AN_TOP + 0.28, 2.05, AN_WH); circ(0, AN_TOP + 1.05, 0.62, AN_OC); circ(0, AN_TOP + 1.05, 0.42, '#2b3540');
  // portal, curved broken pediment, window with scrolls
  R(-1.9, 1.1, 1.9, 5.6, AN_OC); R(-1.2, 1.1, 1.2, 5.3, '#2d4a52'); R(-0.03, 1.1, 0.03, 5.3, '#12222a');
  for (let y = 1.6; y < 5.0; y += 0.9) for (const x of [-0.95, -0.4, 0.4, 0.95]) circ(x, y, 0.06, '#9ab0b0');
  circ(0, 5.95, 0.4, '#8c6a3c'); R(-2.4, 5.6, 2.4, 6.3, '#c39648'); R(-2.5, 6.25, 2.5, 6.4, 'rgba(50,30,15,0.45)');
  for (const sg of [-1, 1]) { g.fillStyle = AN_OC; g.beginPath(); g.moveTo(X(sg * 2.5), Y(6.4)); g.quadraticCurveTo(X(sg * 2.3), Y(7.4), X(sg * 0.6), Y(7.5)); g.lineTo(X(sg * 0.6), Y(6.9)); g.quadraticCurveTo(X(sg * 1.5), Y(6.9), X(sg * 1.8), Y(6.4)); g.fill(); }
  R(-0.7, 6.4, 0.7, 7.6, '#c39648');
  R(-1.0, 7.6, 1.0, 11.0, AN_OC); R(-0.7, 7.85, 0.7, 10.75, '#31404a'); R(-0.03, 7.85, 0.03, 10.75, '#7a6a52'); for (const y of [8.7, 9.7]) R(-0.7, y, 0.7, y + 0.05, '#7a6a52');
  R(-1.35, 10.95, 1.35, 11.4, '#c39648'); g.fillStyle = '#c39648'; g.beginPath(); g.moveTo(X(-0.8), Y(11.4)); g.lineTo(X(0), Y(11.9)); g.lineTo(X(0.8), Y(11.4)); g.fill();
  for (const sg of [-1, 1]) { circ(sg * 1.5, 7.9, 0.4, AN_OC); circ(sg * 1.5, 7.9, 0.2, AN_WH); R(sg * 1.5 - 0.1, 7.9, sg * 1.5 + 0.1, 8.9, AN_OC); }
  shade(AN_ENT, 1.5); shade(AN_WING, 1.2); streaks(g, w, h, 30, 7302, 0.09, 100, '70,50,35'); foot();
}
const AN = {
  id: 'w49772130', name: "Chiesa di Sant'Antonio di Padova", k: 'an',
  p: [307.8, 640.1, 301, 644.9, 271.9, 666.5, 266.1, 670.8, 276, 684, 317.5, 654.2],
  O: [312.65, 647.15], N: [0.822, -0.569], hw: AN_HW, eave: AN_WING, FH: AN_APEX, tex: [380, 376], paint: paintAN, seed: 7321, wall: '#ece4d2', stone: AN_OC, trim: '#d4a65a',
  nave: { w: 9.2, z0: -1.0, z1: -42, top: 13.0, rise: 2.6 },
  shape(s) {
    s.moveTo(-8.55, 0); s.lineTo(8.55, 0); s.lineTo(8.55, AN_WING); s.lineTo(4.7, AN_WING); s.lineTo(4.7, AN_TOP); s.lineTo(0, AN_APEX); s.lineTo(-4.7, AN_TOP); s.lineTo(-4.7, AN_WING); s.lineTo(-8.55, AN_WING); s.lineTo(-8.55, 0);
  },
  trims({ F, at }) {
    bx('flat', F, -8.75, 8.75, AN_WING - 1.0, AN_WING + 0.05, -1.35, 0.4, { c: '#d4a65a', noao: true });
    bx('flat', F, -4.9, 4.9, AN_ENT, AN_TOP + 0.05, -1.35, 0.5, { c: '#d4a65a', noao: true });
    for (const sg of [-1, 1]) {
      bx('flat', F, sg * 4.05 - 0.65, sg * 4.05 + 0.65, 1.1, AN_ENT - 0.3, -0.05, 0.3, { c: '#d4a65a', noao: true });
      bx('flat', F, sg * 8.0 - 0.55, sg * 8.0 + 0.55, 1.1, AN_WING - 1.0, -0.05, 0.2, { c: '#d4a65a', noao: true });
    }
    bx('flat', F, -2.4, 2.4, 5.6, 6.3, -0.05, 0.5, { c: '#c39648', noao: true }); jambs(F, 1.2, 1.9, 1.1, 5.6, 0.22, '#d4a65a');
    bx('flat', F, -1.35, 1.35, 10.95, 11.4, -0.05, 0.4, { c: '#c39648', noao: true });
    rake(F, 4.7, AN_TOP, 2.6, 0.5, -1.0, '#d4a65a');
    bx('flat', F, -0.07, 0.07, AN_APEX + 0.2, AN_APEX + 2.0, -0.7, -0.6, { c: '#3e3a36', noao: true }); bx('flat', F, -0.55, 0.55, AN_APEX + 1.3, AN_APEX + 1.42, -0.7, -0.6, { c: '#3e3a36', noao: true });
  }
};

// =====================================================================================================
// Santa Maria della Grotta al Cassaro (Corso Vittorio Emanuele): front 13.0 m, two orders, scroll wings, curved broken top
// =====================================================================================================
const GR_HW = 6.5, GR_LOW = 10.4, GR_BAL = 11.4, GR_UPC = 16.8, GR_TOP = 19.4, GR_ST = '#988b76', GR_LT = '#b0a288', GR_DK = '#6f6352';
function paintGR(g, w, h) {
  const { R, arch, tri, circ, pil, shade, foot, X, Y, sx } = P(g, w, h, 13.0, GR_TOP);
  g.fillStyle = GR_ST; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 40, 2, 7401, ['rgba(60,48,34,0.14)', 'rgba(225,212,184,0.10)', 'rgba(40,30,20,0.12)']);
  g.fillStyle = 'rgba(50,40,28,0.12)'; for (let y = 1.6; y < GR_LOW - 1.4; y += 0.6) g.fillRect(0, Y(y), w, 1);
  R(-6.5, 0, 6.5, 1.5, '#7f725d');
  for (const sg of [-1, 1]) {
    pil(sg * 3.25, 1.5, GR_LOW - 1.5, 0.95, GR_LT); pil(sg * 5.0, 1.5, GR_LOW - 1.5, 1.0, GR_LT);
    R(sg * 3.25 - 0.3, 3.0, sg * 3.25 + 0.3, GR_LOW - 2.4, 'rgba(60,48,34,0.25)'); R(sg * 5.0 - 0.3, 3.0, sg * 5.0 + 0.3, GR_LOW - 2.4, 'rgba(60,48,34,0.25)');
    R(sg * 6.0 - 0.45, 2.0, sg * 6.0 + 0.45, 4.2, 'rgba(60,48,34,0.3)');
    R(sg * 3.25 - 0.7, GR_LOW - 1.5, sg * 3.25 + 0.7, GR_LOW - 1.0, GR_DK); R(sg * 5.0 - 0.7, GR_LOW - 1.5, sg * 5.0 + 0.7, GR_LOW - 1.0, GR_DK);
  }
  // portal, door, garlands, triangular pediment
  R(-2.5, 1.5, 2.5, 6.2, GR_LT); R(-1.6, 1.5, 1.6, 5.7, '#5b3330'); R(-0.03, 1.5, 0.03, 5.7, '#2a1412');
  for (let y = 1.8; y < 5.5; y += 0.8) { R(-1.5, y, -0.08, y + 0.65, 'rgba(0,0,0,0.16)'); R(0.08, y, 1.5, y + 0.65, 'rgba(0,0,0,0.16)'); }
  R(-2.7, 6.2, 2.7, 6.4, GR_DK);
  g.strokeStyle = GR_DK; g.lineWidth = 2; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(X(sg * 0.2), Y(7.2)); g.quadraticCurveTo(X(sg * 1.2), Y(6.3), X(sg * 2.3), Y(7.1)); g.stroke(); circ(sg * 1.2, 7.0, 0.22, GR_LT); }
  tri(-3.1, 3.1, 7.4, 1.75, GR_LT); tri(-2.4, 2.4, 7.55, 1.3, GR_ST);
  for (const sg of [-1, 1]) { circ(sg * 2.9, 3.4, 0.4, GR_LT); circ(sg * 2.9, 3.4, 0.2, GR_DK); }
  R(-6.5, GR_LOW - 1.5, 6.5, GR_LOW, GR_LT); R(-6.5, GR_LOW - 1.5, 6.5, GR_LOW - 1.4, 'rgba(40,30,20,0.4)'); R(-6.5, GR_LOW - 1.1, 6.5, GR_LOW - 0.7, GR_DK);
  // balustrade band, upper order
  R(-6.5, GR_LOW, 6.5, GR_BAL, GR_ST);
  for (const sg of [-1, 1]) { tri(sg * 4.6 - 0.9, sg * 4.6 + 0.9, GR_LOW + 0.25, 0.4, 'rgba(60,48,34,0.35)'); circ(sg * 4.6, GR_LOW + 0.6, 0.12, GR_DK); }
  R(-1.9, GR_LOW, 1.9, GR_BAL, '#c9bda3'); for (let x = -1.7; x <= 1.7; x += 0.34) R(x - 0.07, GR_LOW + 0.1, x + 0.07, GR_BAL - 0.1, '#7a6e5a');
  R(-6.5, GR_BAL, 6.5, GR_UPC, GR_ST);
  for (const sg of [-1, 1]) { pil(sg * 3.4, GR_BAL, GR_UPC - 0.9, 0.9, GR_LT); pil(sg * 4.7, GR_BAL, GR_UPC - 0.9, 0.9, GR_LT); circ(sg * 5.95, 13.6, 0.5, GR_LT); circ(sg * 5.95, 13.6, 0.28, GR_DK); }
  R(-1.95, GR_BAL, 1.95, 15.3, GR_LT); arch(0, 11.6, 16.4, 4.0, GR_LT); arch(0, 11.9, 15.9, 3.1, '#8a9aa6'); R(-1.55, 11.9, 1.55, 14.0, '#8a9aa6'); R(-0.04, 11.9, 0.04, 14.0, '#4a4034'); R(-1.55, 13.2, 1.55, 13.25, '#4a4034'); R(-0.04, 14.0, 0.04, 15.9, '#4a4034');
  R(-6.5, GR_UPC - 0.7, 6.5, GR_UPC, GR_LT); R(-6.5, GR_UPC - 0.75, 6.5, GR_UPC - 0.68, 'rgba(40,30,20,0.4)');
  // curved broken top, cartouche and volutes
  g.fillStyle = GR_LT; g.beginPath(); g.moveTo(X(-5.4), Y(GR_UPC)); g.quadraticCurveTo(X(-4.0), Y(18.6), X(-1.4), Y(18.5)); g.lineTo(X(1.4), Y(18.5)); g.quadraticCurveTo(X(4.0), Y(18.6), X(5.4), Y(GR_UPC)); g.fill();
  g.fillStyle = GR_ST; g.beginPath(); g.moveTo(X(-4.8), Y(GR_UPC + 0.1)); g.quadraticCurveTo(X(-3.8), Y(18.1), X(-1.4), Y(18.05)); g.lineTo(X(1.4), Y(18.05)); g.quadraticCurveTo(X(3.8), Y(18.1), X(4.8), Y(GR_UPC + 0.1)); g.fill();
  circ(0, 18.4, 1.0, GR_LT); circ(0, 18.4, 0.7, GR_DK); for (const sg of [-1, 1]) { circ(sg * 1.7, 18.5, 0.65, GR_LT); circ(sg * 1.7, 18.5, 0.35, GR_DK); }
  shade(GR_LOW, 1.5); shade(GR_UPC, 1.4); streaks(g, w, h, 40, 7402, 0.14, 110, '50,38,26'); foot();
}
const GR = {
  id: 'w926581675', name: 'Chiesa di Santa Maria della Grotta al Cassaro', k: 'gr',
  p: [-337, 139.9, -317.1, 170.3, -305.6, 164.3, -322.7, 133.3],
  O: [-311.4, 167.3], N: [0.463, 0.887], hw: GR_HW, eave: 16.0, FH: GR_TOP, tex: [256, 384], paint: paintGR, seed: 7421, wall: '#bfae90', stone: '#9a8c72', trim: '#b0a288',
  roof: { w: 11.4, z0: -1.0, z1: -34, rise: 2.6 },
  shape(s) {
    s.moveTo(-6.5, 0); s.lineTo(6.5, 0); s.lineTo(6.5, GR_LOW); s.lineTo(6.1, GR_LOW); s.lineTo(6.1, GR_BAL); s.bezierCurveTo(5.9, 12.6, 5.5, 14.4, 5.4, GR_UPC);
    s.quadraticCurveTo(4.0, 18.6, 1.4, 18.5); s.lineTo(1.4, GR_TOP - 0.4); s.lineTo(-1.4, GR_TOP - 0.4); s.lineTo(-1.4, 18.5); s.quadraticCurveTo(-4.0, 18.6, -5.4, GR_UPC);
    s.bezierCurveTo(-5.5, 14.4, -5.9, 12.6, -6.1, GR_BAL); s.lineTo(-6.1, GR_LOW); s.lineTo(-6.5, GR_LOW); s.lineTo(-6.5, 0);
  },
  trims({ F, at }) {
    bx('flat', F, -6.7, 6.7, GR_LOW - 1.5, GR_LOW + 0.05, -1.35, 0.6, { c: '#b0a288', noao: true });
    bx('flat', F, -5.6, 5.6, GR_UPC - 0.7, GR_UPC + 0.05, -1.35, 0.55, { c: '#b0a288', noao: true });
    for (const sg of [-1, 1]) {
      for (const c of [3.25, 5.0]) bx('flat', F, sg * c - 0.5, sg * c + 0.5, 1.5, GR_LOW - 1.5, -0.05, 0.3, { c: '#b0a288', noao: true });
      for (const c of [3.4, 4.7]) bx('flat', F, sg * c - 0.45, sg * c + 0.45, GR_BAL, GR_UPC - 0.9, -0.05, 0.22, { c: '#b0a288', noao: true });
    }
    bx('flat', F, -2.65, 2.65, 6.2, 6.4, -0.05, 0.4, { c: '#9b8d76', noao: true }); jambs(F, 1.6, 2.5, 1.5, 6.2, 0.22, '#b0a288');
    rake(F, 3.1, 7.4, 1.75, 0.35, 0.2, '#b0a288');
    balus(at(0, GR_LOW, 0.2), 3.8, 1.0);
    for (const sg of [-1, 1]) { cyl('flat', 0.5, 0.5, 0.5, 8, { M: mul(at(sg * 1.7, 18.2, -0.6), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#b0a288' }); }
    sphere('flat', 0.3, { M: at(0, GR_TOP - 0.1, -0.7), seg: 6, c: '#b0a288' });
  }
};

export const BATCH_D = [reg(SO), reg(LU), reg(AN), reg(GR)];
