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
// Santa Maria della Grotta: weathered grey-tan stone front on Corso Vittorio Emanuele, heavily carved: a plinth; a pair of pilasters with carved capitals each side of the door and one at each corner; a tall panelled door between consoles with
//   hanging fruit, a frieze of garlands, a deep triangular pediment; a barred window in a scrolled frame each side; a carved frieze and cornice; an attic with garlands, diamond panels and a little balustrade; above, an arched window with fan
//   glazing, paired pilasters with shell capitals, scrolled wings, and a broken curved pediment with two scrolls round a coat of arms. Behind rises the plain cream block with an iron rail on its roof. Further photos: Palermo - Biblioteca centrale
//   della Regione Siciliana - 2025-09-29 15-38-43 001.JPG; Biblioteca centrale della Regione siciliana, Palermo.1.JPG; Santa Maria della Grotta (Palermo) 14 07 2024 03.jpg; Festa Santa Rosalia PA 15 07 2019 20.jpg.
//   The carving is blocked out (scrolls, swags and bosses), not copied; the front stands half a metre inside the outline so the relief does not reach the pavement; the niche bay to its right (part of the neighbour) is not drawn.
// Not known and not drawn: the roofs and side walls behind the fronts (plain walls, tile roofs assumed but for the flat topped block at the Grotta, whose windows are placed by eye), the interiors, iron work, the sculpture (painted as relief shapes).
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, panel, pyramid, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, archShape, balus, cyl } from './lmc-kit.js';

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
  defMat(k + 'B', 128, 256, [4.5, EAVE], C.side || ((g, w, h) => paintWall(g, w, h, EAVE, C.seed, C.wall, C.stone, C.trim)));
  const back = C.back || 0;   // a front standing behind the outline, so that its deep relief stays inside it
  if (nv) defMat(k + 'N', 128, 256, [4.5, naveH], (g, w, h) => paintWall(g, w, h, naveH, C.seed + 20, C.wall, C.stone, C.trim));
  begin(y0);
  const body = clipFront(pts, -0.1 - back);
  prism(k + 'B', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  if (nv) {
    const zm = (nv.z0 + nv.z1) / 2;
    bx(k + 'N', F, -nv.w / 2, nv.w / 2, EAVE, nv.top, nv.z1, nv.z0, { uvo: [0, -(y0 + EAVE) / naveH] });
    gable('tile', k + 'N', at(0, 0, zm), nv.w, nv.z0 - nv.z1, nv.top, nv.rise, { ov: 0.35, c: '#b8744f', wc: C.wall });
  } else if (C.roof) {
    const rf = C.roof, zm = (rf.z0 + rf.z1) / 2;
    gable('tile', k + 'B', at(0, 0, zm), rf.w, rf.z0 - rf.z1, EAVE, rf.rise, { ov: 0.35, c: '#b8744f', wc: C.wall });
  }
  const s = new THREE.Shape(); C.shape(s);
  extrude(k + 'F', s, 1.3, { M: at(0, 0, -1.35 - back), uv: 'keep', uvk: [1 / (hw * 2), 1 / C.FH], uvo: [0.5, 0], cs: 8, noao: true });
  const env = { F, at: back ? (x, y, z) => at(x, y, z - back) : at, y0, hw, W, k, body };
  C.trims(env);
  const o = end(C.name);
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  const solids = [[back ? body.flat() : C.p, null, y0 + EAVE]];
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
// Santa Maria della Grotta al Cassaro (Corso Vittorio Emanuele): front 13.0 m of carved grey-tan stone, two orders, an attic with a balustrade, volutes, a broken curved pediment round a coat of arms
// =====================================================================================================
const GR_HW = 6.5, GR_LOW = 10.2, GR_BAL = 11.9, GR_UPC = 16.9, GR_TOP = 19.4, GR_BACK = 0.55, GR_SIDE = 20.8, GR_ST = '#9d8e74', GR_LT = '#b3a489', GR_DK = '#625542';
const GR_PIL = [2.62, 3.5, 6.12], GR_UPIL = [2.3, 3.05];   // pilaster centres: the pair and the corner one below, the pair above
function paintGR(g, w, h) {
  const { R, arch, tri, circ, shade, foot, X, Y, sx, sy } = P(g, w, h, 13.0, GR_TOP);
  g.fillStyle = GR_ST; g.fillRect(0, 0, w, h);
  const r = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let y = 0, j = 0; y < GR_TOP; y += 0.55, j++) { for (let x = -6.5 - (j % 2) * 0.6, i = 0; x < 6.5; x += 1.25, i++) { const v = r(j * 41 + i * 13 + 5); if (v < 0.42) R(x, y, x + 1.22, y + 0.52, v < 0.2 ? 'rgba(226,208,170,0.3)' : 'rgba(80,66,46,0.2)'); } R(-6.5, y, 6.5, y + 0.035, 'rgba(60,46,30,0.22)'); }
  noiseDots(g, w, h, w * h / 28, 2, 7401, ['rgba(60,48,34,0.2)', 'rgba(228,214,184,0.14)', 'rgba(40,30,20,0.14)']);
  const sunk = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, 'rgba(70,56,38,0.42)'); R(x0 + 0.08, y0, x1, y1 - 0.08, 'rgba(210,192,155,0.4)'); };
  const leaves = (x0, y0, x1, y1, n, seed) => { for (let i = 0; i < n; i++) { const x = x0 + r(seed + i) * (x1 - x0), y = y0 + r(seed + i * 7 + 3) * (y1 - y0); circ(x + 0.04, y - 0.05, 0.1, 'rgba(50,38,24,0.55)'); circ(x, y, 0.09, r(seed + i * 3) < 0.5 ? '#dccba8' : '#b5a283'); } };
  const swag = (x0, x1, y, drop) => { for (let i = 0; i <= 12; i++) { const t = i / 12, x = x0 + (x1 - x0) * t, yy = y - drop * 4 * t * (1 - t), rr = 0.08 + 0.1 * Math.sin(PI * t); circ(x + 0.04, yy - 0.06, rr, 'rgba(46,34,22,0.5)'); circ(x, yy, rr, i % 2 ? '#d8c6a0' : '#bba886'); } };
  const volute = (x, y, rr) => { g.strokeStyle = 'rgba(58,45,28,0.8)'; g.lineWidth = Math.max(1, sx * 0.09); g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * 4.6 * PI, q = rr * (1 - i / 66); const px = X(x + Math.sign(x) * Math.cos(a) * q), py = Y(y + Math.sin(a) * q); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); };
  // plinth with its panels
  R(-6.5, 0, 6.5, 1.75, '#948773'); R(-6.5, 1.6, 6.5, 1.75, GR_LT); for (const x of [-5.0, -3.06, 3.06, 5.0]) sunk(x - 0.6, 0.35, x + 0.6, 1.3);
  // the lower order: pilasters with sunk shafts and carved capitals
  for (const sg of [-1, 1]) for (const c of GR_PIL) { const x = sg * c, hw_ = 0.36; R(x - hw_, 1.75, x + hw_, 8.6, GR_LT); sunk(x - 0.2, 2.1, x + 0.2, 7.6); R(x - hw_ - 0.07, 1.75, x + hw_ + 0.07, 2.0, '#d0c0a0'); R(x - hw_ - 0.07, 7.85, x + hw_ + 0.07, 8.6, '#b9a888'); leaves(x - hw_, 7.9, x + hw_, 8.45, 14, 100 + c * 17 + sg); R(x - hw_ - 0.1, 8.45, x + hw_ + 0.1, 8.62, '#d8c8a6'); }
  // side windows in their scrolled frames
  for (const sg of [-1, 1]) { const x = sg * 4.8; R(x - 0.86, 3.35, x + 0.86, 6.45, GR_LT); R(x - 0.68, 3.5, x + 0.68, 6.3, '#7a6c56'); R(x - 0.5, 3.65, x + 0.5, 6.1, '#1e1b18'); g.strokeStyle = '#6e6456'; g.lineWidth = 1; for (let i = -6; i <= 10; i++) { g.save(); g.beginPath(); g.rect(X(x - 0.5), Y(6.1), sx, 2.45 * sy); g.clip(); g.beginPath(); g.moveTo(X(x - 0.5 + i * 0.25), Y(3.65)); g.lineTo(X(x - 0.5 + i * 0.25 + 1.2), Y(6.1)); g.moveTo(X(x + 0.5 - i * 0.25), Y(3.65)); g.lineTo(X(x - 0.7 - i * 0.25), Y(6.1)); g.stroke(); g.restore(); }
    swag(x - 0.8, x + 0.8, 7.1, 0.3); leaves(x - 0.7, 6.5, x + 0.7, 6.85, 14, 300 + sg); leaves(x - 0.6, 2.7, x + 0.6, 3.25, 14, 320 + sg); circ(x, 7.45, 0.18, '#d4c29e'); }
  // the door and its frame: consoles with hanging fruit, a frieze of garlands and heads, a triangular pediment
  R(-1.75, 0.9, 1.75, 6.5, GR_LT); R(-1.45, 0.9, 1.45, 6.25, GR_DK); R(-1.2, 0.9, 1.2, 6.0, '#3e2620'); R(-0.025, 0.9, 0.025, 6.0, '#180c08');
  for (let y = 1.15; y < 5.6; y += 0.82) for (const x of [-1.08, -0.56, 0.1, 0.62]) { R(x, y, x + 0.46, y + 0.66, 'rgba(14,6,4,0.45)'); R(x + 0.08, y + 0.08, x + 0.4, y + 0.58, '#4c3027'); R(x + 0.08, y + 0.53, x + 0.4, y + 0.58, 'rgba(255,200,170,0.15)'); }
  for (const sg of [-1, 1]) { leaves(sg * 1.98 - 0.25, 2.0, sg * 1.98 + 0.25, 4.6, 34, 400 + sg); volute(sg * 1.98, 4.95, 0.36); }
  R(-1.9, 6.45, 1.9, 7.4, '#a08f72'); swag(-1.75, -0.2, 7.15, 0.38); swag(0.2, 1.75, 7.15, 0.38); for (const x of [-1.0, 1.0]) circ(x, 7.15, 0.2, '#ded0ae'); R(-0.18, 6.35, 0.18, 7.45, '#d6c5a1'); leaves(-0.18, 6.5, 0.18, 7.35, 8, 450);
  R(-2.2, 7.45, 2.2, 7.7, '#d8c8a6'); tri(-2.2, 2.2, 7.7, 1.45, GR_LT); tri(-1.6, 1.6, 7.82, 0.95, '#8d7c60'); tri(-1.45, 1.45, 7.82, 0.82, '#a99877');
  for (const sg of [-1, 1]) { R(sg * 4.8 - 0.85, 8.0, sg * 4.8 + 0.85, 8.5, '#9b8b6e'); circ(sg * 4.8, 8.25, 0.14, '#d8c8a6'); }
  // the carved frieze and the main cornice
  R(-6.5, 8.62, 6.5, 9.35, '#b6a585'); for (const [a, b] of [[-6.4, -2.2], [2.2, 6.4]]) leaves(a, 8.7, b, 9.25, 70, 500 + a); for (const sg of [-1, 1]) for (const c of GR_PIL) { circ(sg * c, 8.98, 0.24, '#ded0ae'); circ(sg * c, 8.98, 0.1, GR_DK); }
  R(-6.5, 9.35, 6.5, GR_LOW, GR_LT); R(-6.5, 9.35, 6.5, 9.47, 'rgba(40,30,18,0.55)'); R(-6.5, 9.75, 6.5, 9.85, 'rgba(40,30,18,0.35)');
  // the attic: panels with garlands, diamond panels over the pilasters, the little balustrade in the middle
  R(-6.5, GR_LOW, 6.5, GR_BAL, '#ad9d80');
  for (const sg of [-1, 1]) { sunk(sg * 4.85 - 1.1, 10.4, sg * 4.85 + 1.1, 11.55); swag(sg * 4.85 - 0.85, sg * 4.85 + 0.85, 11.3, 0.45); const x = sg * 2.65; sunk(x - 0.7, 10.4, x + 0.7, 11.55); g.strokeStyle = '#dccba8'; g.lineWidth = Math.max(1, sx * 0.08); g.beginPath(); g.moveTo(X(x - 0.55), Y(10.98)); g.lineTo(X(x), Y(11.45)); g.lineTo(X(x + 0.55), Y(10.98)); g.lineTo(X(x), Y(10.5)); g.closePath(); g.stroke(); circ(x, 10.98, 0.13, '#dccba8'); }
  R(-1.55, GR_LOW, 1.55, GR_BAL, '#3a3128'); for (let x = -1.3; x <= 1.31; x += 0.37) { R(x - 0.075, 10.35, x + 0.075, 11.65, GR_LT); circ(x, 10.85, 0.14, GR_LT); }
  R(-1.55, GR_LOW, 1.55, 10.38, GR_LT); R(-1.55, 11.6, 1.55, GR_BAL, GR_LT); R(-6.5, GR_BAL - 0.18, 6.5, GR_BAL + 0.1, '#d3c3a1');
  // the upper order: the arched window with its fan of glazing bars, paired pilasters with shell capitals and drops, the scrolled wings
  R(-5.4, GR_BAL + 0.1, 5.4, GR_UPC, GR_ST); noiseDots(g, w, Y(GR_BAL), w * 70, 2, 7403, ['rgba(60,48,34,0.16)', 'rgba(228,214,184,0.12)']);
  for (const sg of [-1, 1]) { for (const c of GR_UPIL) { const x = sg * c; R(x - 0.31, GR_BAL + 0.1, x + 0.31, 16.1, GR_LT); sunk(x - 0.17, 12.3, x + 0.17, 14.2); leaves(x - 0.25, 14.3, x + 0.25, 15.1, 14, 600 + c * 9 + sg); circ(x, 15.62, 0.33, '#d8c8a6'); for (let a = -2; a <= 2; a++) { g.strokeStyle = 'rgba(70,54,32,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(x), Y(15.35)); g.lineTo(X(x + a * 0.14), Y(15.9)); g.stroke(); } } volute(sg * 4.35, 12.95, 0.78); leaves(sg * 3.9 - 0.35, 13.9, sg * 3.9 + 0.35, 15.2, 18, 650 + sg); }
  arch(0, GR_BAL, 16.35, 3.5, GR_LT); arch(0, GR_BAL, 16.1, 3.0, '#8a7a5e'); arch(0, GR_BAL, 15.85, 2.5, '#5a4c3a'); arch(0, GR_BAL + 0.1, 15.65, 2.15, '#56656e');
  { const gr_ = g.createLinearGradient(0, Y(15.6), 0, Y(12)); gr_.addColorStop(0, 'rgba(190,205,215,0.5)'); gr_.addColorStop(1, 'rgba(190,205,215,0.05)'); arch(0, GR_BAL + 0.1, 15.65, 2.15, gr_); }
  g.strokeStyle = '#3a3026'; g.lineWidth = Math.max(1, sx * 0.07); for (const x of [-0.45, 0.45]) R(x - 0.035, GR_BAL, x + 0.035, 14.55, '#3a3026'); R(-1.075, 14.5, 1.075, 14.6, '#3a3026'); for (let i = 1; i < 6; i++) { const a = i / 6 * PI; g.beginPath(); g.moveTo(X(0), Y(14.55)); g.lineTo(X(Math.cos(a) * 1.05), Y(14.55 + Math.sin(a) * 1.05)); g.stroke(); } g.beginPath(); g.arc(X(0), Y(14.55), 0.55 * sx, PI, 2 * PI); g.stroke();
  R(-0.15, 16.0, 0.15, 16.5, '#ddceac');
  R(-3.7, 16.1, 3.7, GR_UPC, GR_LT); R(-3.7, 16.1, 3.7, 16.2, 'rgba(40,30,18,0.5)'); R(-3.7, 16.5, 3.7, 16.58, 'rgba(40,30,18,0.35)');
  // the broken curved pediment, the two scrolls and the coat of arms between them
  R(-3.9, GR_UPC, 3.9, GR_TOP, GR_ST);
  for (const sg of [-1, 1]) { g.strokeStyle = GR_LT; g.lineWidth = 0.42 * sx; g.beginPath(); g.moveTo(X(sg * 3.75), Y(17.05)); g.quadraticCurveTo(X(sg * 2.9), Y(18.45), X(sg * 1.35), Y(18.55)); g.stroke(); volute(sg * 1.15, 18.25, 0.48); leaves(sg * 2.2 - 0.6, 17.1, sg * 2.2 + 0.6, 17.6, 16, 700 + sg); }
  circ(0, 18.05, 0.8, '#d8c8a6'); circ(0, 18.05, 0.55, '#a8977a'); leaves(-0.75, 17.15, 0.75, 18.9, 34, 750); g.fillStyle = '#ded0ae'; g.beginPath(); g.ellipse(X(0), Y(18.05), 0.36 * sx, 0.5 * sy, 0, 0, 2 * PI); g.fill();
  shade(GR_LOW - 0.85, 0.9); shade(GR_UPC - 0.8, 0.7); streaks(g, w, h, 44, 7402, 0.17, 120, '44,34,24'); foot();
}
// the plain cream flank of the block the church stands in: three floors of small windows
function paintGrSide(g, w, h) {
  const sx = w / 4.5, sy = h / GR_SIDE, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#d6c4a2'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2.5, 7431, ['rgba(130,105,70,0.1)', 'rgba(255,248,230,0.1)']);
  R(0, 0, 4.5, 2.2, 'rgba(105,92,72,0.45)');
  for (const y of [6.2, 11.4, 16.4]) { R(1.55, y - 0.15, 2.95, y + 2.05, '#bda882'); R(1.75, y, 2.75, y + 1.85, '#4a4238'); R(2.22, y, 2.28, y + 1.85, '#8d7f66'); }
  R(0, GR_SIDE - 0.4, 4.5, GR_SIDE, '#bca780'); streaks(g, w, h, 12, 7432, 0.13, 110, '80,62,42');
}
const GR = {
  id: 'w926581675', name: 'Chiesa di Santa Maria della Grotta al Cassaro', k: 'gr',
  p: [-337, 139.9, -317.1, 170.3, -305.6, 164.3, -322.7, 133.3],
  O: [-311.4, 167.3], N: [0.463, 0.887], hw: GR_HW, eave: GR_SIDE, FH: GR_TOP, tex: [320, 448], paint: paintGR, side: paintGrSide, back: GR_BACK, seed: 7421, wall: '#d6c4a2', stone: '#9a8c72', trim: '#c4b496',
  shape(s) {
    s.moveTo(-6.5, 0); s.lineTo(6.5, 0); s.lineTo(6.5, GR_BAL + 0.1); s.lineTo(5.35, GR_BAL + 0.1); s.bezierCurveTo(5.45, 14.2, 3.9, 13.4, 3.75, 15.6); s.lineTo(3.75, GR_UPC);
    s.lineTo(3.95, GR_UPC); s.quadraticCurveTo(3.0, 18.75, 1.35, 18.8); s.quadraticCurveTo(0.8, 19.1, 0.55, 18.75); s.lineTo(0, GR_TOP); s.lineTo(-0.55, 18.75); s.quadraticCurveTo(-0.8, 19.1, -1.35, 18.8); s.quadraticCurveTo(-3.0, 18.75, -3.95, GR_UPC);
    s.lineTo(-3.75, GR_UPC); s.lineTo(-3.75, 15.6); s.bezierCurveTo(-3.9, 13.4, -5.45, 14.2, -5.35, GR_BAL + 0.1); s.lineTo(-6.5, GR_BAL + 0.1); s.lineTo(-6.5, 0);
  },
  trims({ F, at }) {
    // everything is set from the face of the front (at() already stands GR_BACK inside the outline); nothing low down comes further out than that
    const LT = '#b3a387', MID = '#968669', c0 = { noao: true };
    const slab = (x0, x1, y0, y1, d, c = LT) => bx('flat', at(0, 0, 0), x0, x1, y0, y1, -0.1, d, { c, ...c0 });
    const poly = (pts, d, c, x = 0, y = 0, z = -0.05) => { const s = new THREE.Shape(); pts(s); extrude('flat', s, d, { M: at(x, y, z), c, cs: 4, ...c0 }); };
    const disc = (x, y, r, d, c, z = -0.05) => poly(s => s.absarc(0, 0, r, 0, 2 * PI, false), d, c, x, y, z);
    const scroll = (x, y, r, d) => { disc(x, y, r, d, MID); poly(s => { s.absarc(0, 0, r * 0.74, 0, 2 * PI, false); const h = new THREE.Path(); h.absarc(0, 0, r * 0.46, 0, 2 * PI, true); s.holes.push(h); }, 0.07, LT, x, y, d - 0.05); knob(x, y, r * 0.24, d + 0.02, LT); };
    const swag = (x, y, hw_, drop, d = 0.15) => poly(s => { s.moveTo(-hw_, 0); s.quadraticCurveTo(0, -2 * drop, hw_, 0); s.quadraticCurveTo(0, -drop * 0.6, -hw_, 0); }, d, '#a39477', x, y);
    const knob = (x, y, r, d, c = '#a89879') => sphere('flat', r * 0.88, { M: at(x, y, d), seg: 4, kz: 0.6, c, noao: true });
    for (const sg of [-1, 1]) {
      for (const c of GR_PIL) { const x = sg * c; slab(x - 0.47, x + 0.47, 0, 1.6, 0.4, MID); slab(x - 0.52, x + 0.52, 1.6, 1.82, 0.46); slab(x - 0.36, x + 0.36, 1.82, 7.85, 0.22); slab(x - 0.17, x + 0.17, 2.15, 7.55, 0.3, MID); slab(x - 0.41, x + 0.41, 7.85, 8.45, 0.34, MID); slab(x - 0.5, x + 0.5, 8.45, 8.66, 0.44); for (const k of [-0.22, 0.22]) knob(x + k, 8.18, 0.19, 0.36); knob(x, 8.98, 0.22, 0.14); }
      for (const [a, b] of [[2.14, 3.98], [5.64, 6.5]]) { slab(sg > 0 ? a : -b, sg > 0 ? b : -a, GR_LOW - 0.55, GR_LOW + 0.04, 0.55); slab(sg > 0 ? a + 0.06 : -b + 0.06, sg > 0 ? b - 0.06 : -a - 0.06, GR_BAL - 0.16, GR_BAL + 0.12, 0.34); }
      // side windows: the frame, its sill on brackets, the scrolls and the garland over it
      const w = sg * 4.8; for (const s2 of [-0.76, 0.76]) slab(w + s2 - 0.11, w + s2 + 0.11, 3.35, 6.45, 0.18); slab(w - 0.98, w + 0.98, 6.3, 6.56, 0.28); slab(w - 0.98, w + 0.98, 3.22, 3.46, 0.3); swag(w, 3.2, 0.7, 0.34); swag(w, 7.15, 0.75, 0.3); for (const s2 of [-0.66, 0.66]) scroll(w + s2, 6.78, 0.22, 0.2); knob(w, 7.45, 0.2, 0.08); knob(w, 2.75, 0.17, 0.06);
      // the door: jambs, the consoles with their drops
      slab(sg > 0 ? 1.28 : -1.62, sg > 0 ? 1.62 : -1.28, 0.9, 6.45, 0.24); scroll(sg * 1.98, 4.95, 0.36, 0.3); poly(s => { s.moveTo(-0.24, 0); s.quadraticCurveTo(-0.42, -1.4, 0.0, -2.9); s.quadraticCurveTo(0.34, -1.4, 0.24, 0); s.lineTo(-0.24, 0); }, 0.14, MID, sg * 1.98, 4.7); for (let i = 0; i < 3; i++) knob(sg * 1.98, 4.25 - i * 0.62, 0.17 - i * 0.03, 0.1); scroll(sg * 1.72, 6.2, 0.2, 0.26);
      swag(sg * 0.98, 7.25, 0.78, 0.4, 0.2); knob(sg * 0.98, 7.2, 0.2, 0.22);
      // attic: garlands and the diamond panels
      swag(sg * 4.85, 11.35, 0.85, 0.48); knob(sg * 4.0, 11.35, 0.15, 0.1); knob(sg * 5.7, 11.35, 0.15, 0.1); bx('flat', mul(at(sg * 2.65, 10.98, 0), new THREE.Matrix4().makeRotationZ(PI / 4)), -0.34, 0.34, -0.34, 0.34, -0.1, 0.12, { c: MID, ...c0 }); knob(sg * 2.65, 10.98, 0.17, 0.14);
      // upper order: pilasters with shells and drops, the scrolled wings
      for (const c of GR_UPIL) { const x = sg * c; slab(x - 0.31, x + 0.31, GR_BAL + 0.1, 15.2, 0.2); slab(x - 0.37, x + 0.37, 15.2, 15.35, 0.34); disc(x, 15.66, 0.34, 0.36, MID); knob(x, 15.5, 0.16, 0.36, LT); knob(x, 14.75, 0.17, 0.22); knob(x, 14.35, 0.12, 0.22); }
      poly(s => { s.moveTo(sg * 3.4, GR_BAL + 0.1); s.lineTo(sg * 5.3, GR_BAL + 0.1); s.bezierCurveTo(sg * 5.35, 14.0, sg * 3.9, 13.4, sg * 3.72, 15.4); s.lineTo(sg * 3.4, 15.4); s.lineTo(sg * 3.4, GR_BAL + 0.1); }, 0.2, MID); scroll(sg * 4.42, 12.95, 0.76, 0.3);
      // top: the curved halves of the broken pediment and their scrolls
      poly(s => { s.moveTo(sg * 3.98, GR_UPC); s.quadraticCurveTo(sg * 3.0, 18.78, sg * 1.35, 18.82); s.lineTo(sg * 1.35, 18.38); s.quadraticCurveTo(sg * 2.75, 18.3, sg * 3.55, GR_UPC); s.lineTo(sg * 3.98, GR_UPC); }, 0.5, LT);
      scroll(sg * 1.15, 18.28, 0.46, 0.58);
      slab(sg > 0 ? 2.0 : -3.4, sg > 0 ? 3.4 : -2.0, 16.1, 16.6, 0.4);
    }
    slab(-6.55, 6.55, GR_LOW - 0.42, GR_LOW - 0.12, 0.34); slab(-6.55, 6.55, GR_LOW - 0.12, GR_LOW + 0.04, 0.46);
    slab(-6.55, 6.55, 8.6, 8.72, 0.26, MID); slab(-3.8, 3.8, 16.58, GR_UPC + 0.05, 0.5);
    // door lintel, keystone, the deep triangular pediment
    slab(-1.9, 1.9, 6.2, 6.45, 0.34); slab(-0.2, 0.2, 6.2, 7.45, 0.3); knob(0, 6.95, 0.24, 0.3);
    slab(-2.35, 2.35, 7.46, 7.72, 0.55); poly(s => { s.moveTo(-2.35, 0); s.lineTo(0, 1.55); s.lineTo(2.35, 0); s.lineTo(1.75, 0); s.lineTo(0, 1.14); s.lineTo(-1.75, 0); s.lineTo(-2.35, 0); }, 0.58, LT, 0, 7.68);
    // the balustrade before the window, the arch of the window on its imposts
    balus(at(0, 10.35, 0.16), 2.95, 1.3, { c: '#b9aa8c' }); slab(-1.62, 1.62, 11.6, 11.84, 0.3); slab(-1.62, 1.62, GR_LOW + 0.02, 10.36, 0.3);
    poly(s => { s.moveTo(1.62, 0); s.absarc(0, 0, 1.62, 0, PI, false); s.lineTo(-1.2, 0); s.absarc(0, 0, 1.2, PI, 0, true); s.lineTo(1.62, 0); }, 0.3, LT, 0, 14.6);
    for (const sg of [-1, 1]) { slab(sg * 1.41 - 0.21, sg * 1.41 + 0.21, GR_BAL + 0.1, 14.45, 0.22, MID); slab(sg * 1.41 - 0.3, sg * 1.41 + 0.3, 14.42, 14.64, 0.36); }
    slab(-0.17, 0.17, 15.9, 16.55, 0.44, MID);
    // the coat of arms
    disc(0, 18.05, 0.78, 0.3, MID); sphere('flat', 0.48, { M: at(0, 18.05, 0.25), seg: 8, ky: 1.3, kz: 0.45, c: LT, noao: true }); for (const [x, y] of [[-0.55, 18.7], [0.55, 18.7], [-0.62, 17.45], [0.62, 17.45], [0, 18.95], [0, 17.25]]) knob(x, y, 0.2, 0.28);
    // the iron rail on the roof of the block behind
    panel('rail', 11.0, 1.0, { M: at(0, GR_SIDE + 0.12, -1.3), uvk: [11, 1], c: '#6c675e' });
  }
};

export const BATCH_D = [reg(SO), reg(LU), reg(AN), reg(GR)];
