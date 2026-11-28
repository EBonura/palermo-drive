// City landmarks, batch I: four churches of Palermo drawn from reference photos. Registered in src/landmarks-city.js as BATCH_I.
// Each replaces one OSM footprint (skipIds) and stays inside it. Frame of a front: origin on the ground in the middle of the front edge, +z out of the front, +x to the right seen from the street.
// Reference photos (Wikimedia Commons, looked at, nothing copied; proportions and colours read, then drawn procedurally):
//   Santo Spirito "dei Vespri" (inside the Sant'Orsola cemetery): "Santo Spirito, Palermo.jpg" (the west front and the south side wall, from the south-west), "Palermo - Chiesa dei Vespri (Santo Spirito).jpg (an en dash in the real name)" (an old engraving of the apse end, used only for the apse arcades).
//     NOT used: "Chiesasspirito.jpg" (it shows the brick 1938 church of the Spirito Santo in Olivuzza, a different building).
//     read: a plain gabled front in horizontal courses of pale tufa and dark lava, buttress strips at the corners, one small door with a flat lintel, a round window with a stone ring high in the gable; the long side in tufa with a row of
//     tall blind pointed arches (banded black and white voussoirs, a narrow lancet in each, about 11 along the nave) over a plain base, a tier of small round-headed windows above, red tile roof; aisles lower than the nave.
//   Santa Maria di Monserrato (Viale della Liberta, "chiesa delle Croci"): "Chiesa di Santa Maria di Monserrato.JPG" (the whole front, straight on).
//     read: white plaster front with ochre stone trim: a loggia of three round arches (about 4.5 m clear) on ochre piers, doors inside, a frieze with small cartouches, an ochre entablature, a white balustrade, an attic with a cornice and eight pinnacles
//     on the roof line (the outer ones lower, on the balustrade corners), a small bell on the left; low white walls with ochre edge strips to each side; an open stair on both sides in front (not drawn).
//   San Carlo Borromeo (San Carlo dei Milanesi, Fieravecchia): "San Carlo facciata.jpg" (the whole front, from below and the side). ("San Carlo Borromeo (Palermo) 15 07 2019 01.jpg" is mislabelled and was not used.)
//     read: a baroque front in two orders in grey-ochre stone and plaster: a lower order with pilaster pairs, a tall central portal with a curved pediment on pilasters, a small pedimented door and a barred window with a frame at each end, a deep frieze of carved garlands and a heavy cornice;
//     an upper order, narrower, with a big window and a niche each side with curved hoods, a triangular pediment, concave scroll walls down to the wings, spheres on the wings, side wings with panels; the plaster is soot dark below and yellow-ochre above.
//   Santa Lucia al Monte: "Chiesa di Santa Lucia al Monte (Palermo) - facciata.JPG" (the front from below, oblique, the right edge cut by a neighbour).
//     read: a tall baroque front in two orders, dark grey-brown plaster with ochre pilasters below (corner pilasters with Corinthian capitals, a framed portal with a triangular hood and a window with a triangular hood and scrolls above it, narrow bays with garland panels), a deep dentilled cornice,
//     a narrower yellow-ochre upper order with a big window and two statue niches with curved hoods, concave scrolls, a broken top with a round crest and a cross, caged finials on the corners.
// Not verified: the number of bays on every side wall, the real roof shapes behind the fronts, the rear parts. Footprints (world/tiles): w49786257, w82636568, w86889402, w215618520; the front direction of each is the footprint edge facing the street.
import * as THREE from 'three';
import { PI, bx, sphere, cone, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, box, paintAshlar } from './lmc-kit.js';

// ---------- shared helpers ----------
const mk = (g, w, h, wm, hm, cx) => {   // metre canvas: x from -cx (centred fronts) or 0, y up from the base
  const sx = w / wm, sy = h / hm, X = x => (x + cx) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const seg = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.quadraticCurveTo(X((x0 + x1) / 2), Y(y + 2 * hh), X(x1), Y(y)); g.closePath(); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const ogive = (x, y0, ys, hw, rise, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x - hw), Y(y0)); g.lineTo(X(x - hw), Y(ys)); g.quadraticCurveTo(X(x - hw), Y(ys + rise * 0.95), X(x), Y(ys + rise)); g.quadraticCurveTo(X(x + hw), Y(ys + rise * 0.95), X(x + hw), Y(ys)); g.lineTo(X(x + hw), Y(y0)); g.fill(); };
  return { sx, sy, X, Y, R, arch, tri, seg, circ, ogive };
};
function wear(g, w, h, m, seed, o = {}) {   // stains, soot and lime runs, dirt at the foot, a shadow under each cornice in o.sh (metres)
  const hm = h / m.sy, wm = w / m.sx;
  noiseDots(g, w, h, w * h / 55, 1.8, seed, ['rgba(40,28,18,0.13)', 'rgba(255,244,215,0.10)', 'rgba(110,80,50,0.08)']);
  for (let i = 0; i < (o.stains || 6); i++) { const cx = ((i * 0.37 + 0.13) % 1) * w, cy = ((i * 0.61 + 0.2) % 1) * h, gr = g.createRadialGradient(cx, cy, 0, cx, cy, w / 6); gr.addColorStop(0, o.stain || 'rgba(70,50,30,0.14)'); gr.addColorStop(1, 'rgba(70,50,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, o.lime === undefined ? 8 : o.lime, seed + 1, 0.2, h * 0.3, '244,236,218');
  streaks(g, w, h, o.soot === undefined ? 16 : o.soot, seed + 2, o.sa || 0.22, h * 0.3, '34,26,18');
  for (const y of o.sh || []) { const gs = g.createLinearGradient(0, m.Y(y), 0, m.Y(y - 1.3)); gs.addColorStop(0, 'rgba(40,26,14,0.30)'); gs.addColorStop(1, 'rgba(40,26,14,0)'); g.fillStyle = gs; g.fillRect(0, m.Y(y), w, 1.3 * m.sy); }
  const fh = o.foot || 2.4, gb = g.createLinearGradient(0, m.Y(0), 0, m.Y(fh)); gb.addColorStop(0, 'rgba(26,19,13,0.40)'); gb.addColorStop(1, 'rgba(26,19,13,0)'); g.fillStyle = gb; g.fillRect(0, m.Y(fh), w, fh * m.sy);
}
function banded(g, m, pts, lw, light, dark, dash) {   // a banded arch ring along pts (metres)
  g.save(); g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(m.X(p[0]), m.Y(p[1])) : g.moveTo(m.X(p[0]), m.Y(p[1]))); g.lineWidth = lw * m.sx; g.strokeStyle = light; g.stroke();
  g.setLineDash([dash * m.sx, dash * m.sx]); g.strokeStyle = dark; g.stroke(); g.restore();
}
function ogivePts(x, ys, hw, rise, n = 14) {   // a pointed arch outline: left spring, apex, right spring
  const o = [], q = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  for (let i = 0; i <= n; i++) { const t = i / n; o.push([q(x - hw, x - hw, x, t), q(ys, ys + rise * 0.95, ys + rise, t)]); }
  for (let i = 1; i <= n; i++) { const t = i / n; o.push([q(x, x + hw, x + hw, t), q(ys + rise, ys + rise * 0.95, ys, t)]); }
  return o;
}

// One church: S = { name, id, p (footprint), O (middle of the front edge), N (outward normal), x, z, r, FW (front width), FH (front height),
//   EAVE (wall height), roof { rw, z0, z1, rise, c, wc, y (where it sits, EAVE unless a nave wall stands higher) }, wall { key, w, h, paint }, front { key, w, h, paint, shape(THREE, hw) }, extra(ctx) }
function church(S) {
  const pts = pairsOf(S.p), N = S.N, O = S.O;
  const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
  const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
  const clipFront = (zmax) => {
    const L = pts.map(toLocal), out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out.map(q => toWorld(q[0], q[1]));
  };
  function build() {
    initShared();
    const gr = groundRange(pts), W = toWorld, hw = S.FW / 2;
    const y0 = Math.min(groundY(...W(-hw * 0.6, 1.5)), groundY(...W(hw * 0.6, 1.5)), groundY(...W(0, 2)));
    const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
    const wl = S.wall, fr = S.front, EAVE = S.EAVE;
    defMat(fr.key, fr.w, fr.h, [S.FW, S.FH], fr.paint);
    defMat(wl.key, wl.w, wl.h, [wl.tw, EAVE], wl.paint);
    begin(y0);
    const body = clipFront(S.clip || -0.1);
    prism(wl.key, body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
    prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
    const R = S.roof, rd = R.z0 - R.z1, RY = R.y ?? EAVE;
    for (const sg of [-1, 1]) { const run = R.rw / 2 + 0.3 + 0 * sg, len = Math.hypot(R.rw / 2 + 0.3, R.rise), ang = Math.atan2(R.rise, R.rw / 2 + 0.3); box('tile', len, 0.25, rd + 0.6, { M: at(0, 0, (R.z0 + R.z1) / 2), p: [sg * run / 2, RY + R.rise / 2, 0], rz: -sg * ang, c: R.c, noao: true, uv: 'world' }); }
    const sh = new THREE.Shape(); sh.moveTo(-R.rw / 2, 0); sh.lineTo(R.rw / 2, 0); sh.lineTo(0, R.rise); sh.lineTo(-R.rw / 2, 0);
    for (const zz of [R.z1, R.z0 - 0.3]) extrude('plaster', sh, 0.3, { M: at(0, 0, 0), p: [0, RY, zz], c: R.wc, uv: 'world', noao: true });
    extrude(fr.key, fr.shape(THREE, hw), 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / S.FW, 1 / S.FH], uvo: [0.5, 0], cs: 8, noao: true });
    S.extra({ F, at, y0, THREE });
    const o = end(S.name);
    const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
    o.userData.solids = [[S.p, null, y0 + EAVE], [ring(-R.rw / 2, R.rw / 2, R.z1, R.z0), null, y0 + EAVE + R.rise]];
    return o;
  }
  return { name: S.name, x: S.x, z: S.z, radius: S.r, skipIds: [S.id], build };
}

// ---------- 1. Santo Spirito dei Vespri ----------
const SS = { id: 'w49786257', p: [122.9, 1771.1, 128.6, 1787.8, 159.3, 1776.2, 159, 1772, 161.1, 1768.9, 159.6, 1765.2, 156.4, 1763.7, 153.3, 1760.7], O: [125.75, 1779.45], N: [-0.94639, 0.32302] };
const SS_A = 6.0, SS_N = 7.8, SS_T = 9.6;   // aisle wall, nave wall, ridge
function ssFront(g, w, h) {
  const m = mk(g, w, h, 17.6, SS_T, 8.8), R = m.R;
  for (let y = 0; y < SS_T; y += 0.7) { R(-9, y, 9, y + 0.5, '#c2a26f'); R(-9, y + 0.5, 9, y + 0.7, '#9a8265'); }
  noiseDots(g, w, h, w * h / 30, 1.8, 6501, ['rgba(120,85,50,0.12)', 'rgba(255,240,205,0.10)', 'rgba(40,28,18,0.10)']);
  for (const s of [-1, 1]) { const a = s * 8.8, b = s * 7.5; R(Math.min(a, b), 0, Math.max(a, b), 6.2, 'rgba(235,212,160,0.35)'); R(s * 7.5 - (s > 0 ? 0.06 : -0.06) - 0.06, 0, s * 7.5 + 0.06, 6.2, 'rgba(40,28,18,0.35)'); }
  R(-1.6, 0, 1.6, 3.5, '#cdb283'); R(-1.15, 0, 1.15, 3.1, '#5b4431'); R(-0.03, 0, 0.03, 3.1, '#2a1d12'); for (let y = 0.6; y < 3; y += 0.7) { R(-1.05, y, -0.08, y + 0.5, 'rgba(0,0,0,0.14)'); R(0.08, y, 1.05, y + 0.5, 'rgba(0,0,0,0.14)'); }
  m.circ(0, 6.2, 1.45, '#cdb283'); m.circ(0, 6.2, 1.1, '#3f3344'); m.R(-0.04, 5.1, 0.04, 7.3, '#a48e68'); m.R(-1.1, 6.16, 1.1, 6.24, '#a48e68');
  wear(g, w, h, m, 6511, { lime: 5, soot: 14 });
}
function ssWall(g, w, h) {   // 6 m of the aisle wall: plain base, two blind pointed arches with banded rings and a lancet, a cornice
  const m = mk(g, w, h, 6, SS_A, 0), R = m.R;
  paintAshlar(g, w, h, 6, SS_A, 0.45, 0.9, '#bd9d6c', '#8c7350', 6521, 1.2, 0.09);
  for (const cx of [1.5, 4.5]) {
    banded(g, m, ogivePts(cx, 3.9, 1.25, 1.6), 0.4, '#d9c196', '#3b3028', 0.3);
    m.ogive(cx, 3.9, 3.9, 1.0, 1.4, '#a98a5c'); m.ogive(cx, 3.9, 3.9, 0.55, 1.2, '#2e2620');
    R(cx - 1.3, 3.5, cx + 1.3, 3.9, '#cdb283');
  }
  R(0, 5.65, 6, 6.0, '#6c5a47'); R(0, 5.55, 6, 5.65, 'rgba(30,20,10,0.35)');
  wear(g, w, h, m, 6522, { lime: 3, soot: 6, foot: 1.2 });
}
function ssNave(g, w, h) {   // 6 m of the nave clerestory: two small round-headed windows
  const m = mk(g, w, h, 6, 1.8, 0);
  paintAshlar(g, w, h, 6, 1.8, 0.4, 0.9, '#b8996a', '#86704f', 6531, 1.2, 0.09);
  for (const cx of [1.5, 4.5]) { m.arch(cx, 0.55, 1.45, 0.75, '#cdb283'); m.arch(cx, 0.6, 1.4, 0.5, '#2e2620'); }
  noiseDots(g, w, h, w * h / 90, 1.6, 6532, ['rgba(40,28,18,0.12)', 'rgba(255,240,205,0.09)']);
}
const SANTO_SPIRITO = church({
  name: 'Chiesa del Santo Spirito (dei Vespri)', id: SS.id, p: SS.p, O: SS.O, N: SS.N, x: 141, z: 1772, r: 46, FW: 17.6, FH: SS_T, EAVE: SS_A,
  roof: { rw: 11, z0: -1.6, z1: -33, y: SS_N, rise: SS_T - SS_N, c: '#cf8f6b', wc: '#bf9f6c' },
  wall: { key: 'bissW', w: 384, h: 384, tw: 6, paint: ssWall },
  front: {
    key: 'bissF', w: 384, h: 210, paint: ssFront,
    shape: (T, hw) => { const s = new T.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, SS_A); s.lineTo(5.5, SS_N); s.lineTo(0, SS_T); s.lineTo(-5.5, SS_N); s.lineTo(-hw, SS_A); s.lineTo(-hw, 0); return s; },
  },
  extra: ({ F, at, y0 }) => {
    defMat('bissN', 384, 120, [6, 1.8], ssNave);
    bx('bissN', F, -5.5, 5.5, SS_A, SS_N, -1.6, -33, { uvo: [0, -(y0 + SS_A) / 1.8] });
    for (const sg of [-1, 1]) {   // the aisle roofs, a lean-to each side
      const run = 3.3, rise = SS_N - SS_A, len = Math.hypot(run, rise) + 0.3, ang = Math.atan2(rise, run);
      box('tile', len, 0.22, 31.6, { M: at(0, 0, -17.3), p: [sg * (8.8 - run / 2), SS_A + rise / 2 - 0.05, 0], rz: -sg * ang, c: '#cf8f6b', noao: true, uv: 'world' });
    }
    bx('flat', F, -0.07, 0.07, SS_T + 0.1, SS_T + 1.4, -0.9, -0.75, { c: '#3e3a36', noao: true }); bx('flat', F, -0.45, 0.45, SS_T + 0.8, SS_T + 0.92, -0.9, -0.75, { c: '#3e3a36', noao: true });
    bx('flat', F, -2.1, 2.1, -0.2, 0.15, -0.05, 0.9, { c: '#cdb283' });
  },
});

// ---------- 2. Santa Maria di Monserrato ----------
const MO = { id: 'w82636568', p: [-786.3, -1675.9, -789.3, -1673.4, -790.5, -1672.6, -789.3, -1670.4, -785.7, -1671.3, -776.7, -1650.8, -779.7, -1649.1, -776.3, -1641.1, -778, -1639.8, -775, -1634.5, -769.6, -1637.5, -767.8, -1633.7, -752.2, -1641.7, -772.6, -1681.2, -780, -1677.6], O: [-760, -1637.7], N: [0.456, 0.89] };
const MO_FH = 11.6, MO_E = 8.2, MO_C = [-5.35, 0, 5.35];
function moFront(g, w, h) {
  const m = mk(g, w, h, 17.6, MO_FH, 8.8), R = m.R, PL = '#ece5d6', OC = '#d1ac6a', OL = '#e2c98f';
  R(-9, 0, 9, MO_FH, PL);
  noiseDots(g, w, h, w * h / 50, 1.8, 6601, ['rgba(150,110,60,0.08)', 'rgba(255,248,230,0.10)']);
  R(-8.8, 0, -7.55, 7.7, OC); R(7.55, 0, 8.8, 7.7, OC); for (const s of [-1, 1]) { R(s * 8.8 - 0.05 - (s > 0 ? 1.25 : 0), 0, s * 8.8 + 0.05 - (s > 0 ? 1.25 : 0) + (s > 0 ? 0 : 1.25), 7.7, OC); R(Math.min(s * 7.4, s * 8.9), 5.0, Math.max(s * 7.4, s * 8.9), 5.3, OL); }
  for (const c of MO_C) { m.arch(c, 0, 7.45 + 0.55, 5.4, OC); }
  for (const s of [-1, 1]) { R(s * 2.25 - 0.45, 0, s * 2.25 + 0.45, 5.2, OL); R(s * 2.7 - 0.5, 4.9, s * 2.7 + 0.5, 5.3, OC); }
  for (const x of [-5.35, 0, 5.35]) { m.circ(x, 8.0, 0.28, OC); }
  for (const x of [-2.7, 2.7]) { R(x - 0.3, 7.5, x + 0.3, 8.1, OC); }
  R(-8.8, 8.3, 8.8, 9.0, OC); R(-8.8, 8.28, 8.8, 8.34, 'rgba(60,40,15,0.35)');
  for (let x = -8.6; x < 8.7; x += 0.4) { R(x, 9.0, x + 0.2, 9.9, '#f1e9d6'); R(x + 0.2, 9.0, x + 0.4, 9.9, '#a8997f'); }
  R(-8.8, 9.0, 8.8, 9.2, OC); R(-8.8, 9.9, 8.8, 10.1, OC);
  R(-8, 10.1, 8, 11.3, PL); R(-7.6, 10.3, -4.2, 11.0, '#f5efe2'); R(4.2, 10.3, 7.6, 11.0, '#f5efe2'); R(-3.6, 10.3, 3.6, 11.0, '#f5efe2'); m.circ(0, 10.65, 0.5, '#d9c9a2'); m.circ(-7.0, 10.65, 0.3, OC); m.circ(7.0, 10.65, 0.3, OC);
  R(-8.2, 11.1, 8.2, 11.6, OC); R(-8.2, 11.05, 8.2, 11.1, 'rgba(60,40,15,0.35)');
  wear(g, w, h, m, 6611, { stain: 'rgba(120,95,60,0.12)', lime: 4, soot: 8, sa: 0.12, foot: 2.2, sh: [9.0, 10.1] });
}
function moWall(g, w, h) {
  const m = mk(g, w, h, 4.4, MO_E, 0), R = m.R;
  R(0, 0, 4.4, MO_E, '#e6dfd0'); noiseDots(g, w, h, w * h / 50, 1.8, 6621, ['rgba(150,110,60,0.08)', 'rgba(255,248,230,0.10)']);
  R(0, 0, 0.4, MO_E, '#d1ac6a'); R(4.0, 0, 4.4, MO_E, '#d1ac6a'); R(0, MO_E - 0.5, 4.4, MO_E, '#d1ac6a');
  m.arch(2.2, 3.7, 7.0, 1.7, '#d1ac6a'); m.arch(2.2, 3.9, 6.8, 1.3, '#3a3d44');
  wear(g, w, h, m, 6622, { lime: 3, soot: 5, sa: 0.12, foot: 2 });
}
const MONSERRATO = church({
  name: 'Chiesa di Santa Maria di Monserrato', id: MO.id, p: MO.p, O: MO.O, N: MO.N, x: -770, z: -1655, r: 30, FW: 17.6, FH: MO_FH, EAVE: MO_E, clip: -1.45,
  roof: { rw: 17.2, z0: -1.6, z1: -44, rise: 2.4, c: '#c0764f', wc: '#e6dfd0' },
  wall: { key: 'biMoW', w: 128, h: 256, tw: 4.4, paint: moWall },
  front: {
    key: 'biMoF', w: 384, h: 252, paint: moFront,
    shape: (T, hw) => {
      const s = new T.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 10.1); s.lineTo(8.0, 10.1); s.lineTo(8.0, MO_FH); s.lineTo(-8.0, MO_FH); s.lineTo(-8.0, 10.1); s.lineTo(-hw, 10.1); s.lineTo(-hw, 0);
      for (const c of MO_C) { const p = new T.Path(), r = 2.25; p.moveTo(c - r, 0.0); p.lineTo(c - r, 5.2); p.absarc(c, 5.2, r, PI, 0, true); p.lineTo(c + r, 0.0); p.lineTo(c - r, 0.0); s.holes.push(p); }
      return s;
    },
  },
  extra: ({ F, at }) => {
    bx('flat', F, -7.7, 7.7, 0, 7.6, -1.5, -1.42, { c: '#b49872', noao: true });
    for (const c of MO_C) { bx('flat', F, c - 1.7, c + 1.7, 0, 4.9, -1.42, -1.3, { c: '#9d9788', noao: true }); bx('dark', F, c - 1.4, c - 0.1, 3.2, 4.6, -1.3, -1.26, { c: '#33363c', noao: true }); bx('dark', F, c + 0.1, c + 1.4, 3.2, 4.6, -1.3, -1.26, { c: '#33363c', noao: true }); }
    for (const [x, y] of [[-6.6, 11.6], [-4.4, 11.6], [-2.2, 11.6], [0, 11.6], [2.2, 11.6], [4.4, 11.6], [6.6, 11.6], [-8.0, 10.1], [8.0, 10.1]]) {
      bx('flat', F, x - 0.3, x + 0.3, y, y + 0.35, -0.6, -0.05 - 0.3 + 0.35, { c: '#d1ac6a', noao: true }); cone('flat', 0.22, 0.8, 6, { M: at(x, y + 0.35, -0.3), c: '#d1ac6a' }); sphere('flat', 0.16, { M: at(x, y + 1.2, -0.3), seg: 6, c: '#d1ac6a' });
    }
  },
});

// ---------- 3. San Carlo Borromeo ----------
const SC = { id: 'w86889402', p: [474.6, 146, 471.5, 142.5, 486, 127.6, 489.8, 131.1, 492.6, 130.4, 509.8, 152.7, 500.7, 162.8, 497.9, 159.8, 493.4, 164.2], O: [478.8, 135.1], N: [-0.717, -0.697] };
const SC_FH = 14.8, SC_L = 8.4, SC_E = 9.6, SC_U = 12.6;
function scFront(g, w, h) {
  const m = mk(g, w, h, 20.8, SC_FH, 10.4), R = m.R, PLD = '#a99880', LGT = '#d2c6ac', STN = '#b99d70', STH = '#d6bc8a', YEL = '#d8b278';
  R(-10.4, 0, 10.4, SC_E, PLD); R(-10.4, SC_E, 10.4, SC_FH, YEL);
  noiseDots(g, w, h, w * h / 50, 1.8, 6701, ['rgba(110,80,45,0.10)', 'rgba(255,244,215,0.10)', 'rgba(40,30,20,0.09)']);
  R(-5.4, 0, 5.4, SC_L, LGT);
  for (const s of [-1, 1]) { R(s * 3.5 - 0.9, 0, s * 3.5 + 0.9, SC_L - 0.6, STN); R(Math.min(s * 5.4, s * 3.5 + s * 0.9) - 0.05, 0, Math.max(s * 5.4, s * 3.5 + s * 0.9) + 0.05, 0.3, STH); R(s * 4.4 - 1.1, SC_L - 1.3, s * 4.4 + 1.1, SC_L - 0.6, STH); R(Math.min(s * 9.2, s * 10.4), 0, Math.max(s * 9.2, s * 10.4), SC_L - 0.6, STN); R(s * 9.8 - 0.8, SC_L - 1.3, s * 9.8 + 0.8, SC_L - 0.6, STH); }
  // portal: tall door, jamb pilasters, curved hood and a light field above
  R(-1.45, 0, 1.45, 5.0, '#46301f'); R(-0.03, 0, 0.03, 5.0, '#2a1d12'); for (let y = 0.5; y < 4.8; y += 1.5) { R(-1.35, y, -0.1, y + 1.2, 'rgba(0,0,0,0.12)'); R(0.1, y, 1.35, y + 1.2, 'rgba(0,0,0,0.12)'); }
  R(-2.0, 0, -1.45, 5.3, STH); R(1.45, 0, 2.0, 5.3, STH); R(-2.4, 5.0, 2.4, 5.35, STH); m.seg(-3.0, 3.0, 5.35, 1.35, STH); m.seg(-2.3, 2.3, 5.45, 0.9, LGT);
  R(-2.5, 6.9, 2.5, 7.4, STH);
  // side doors with hood and a framed barred window above
  for (const s of [-1, 1]) { const x = s * 7.6; R(x - 1.1, 0, x + 1.1, 2.5, '#46301f'); R(x - 1.35, 2.5, x + 1.35, 2.8, STH); m.seg(x - 1.5, x + 1.5, 2.8, 0.55, STH);
    R(x - 1.1, 4.5, x + 1.1, 7.0, STH); R(x - 0.75, 4.85, x + 0.75, 6.65, '#2b2622'); for (let k = -1; k <= 1; k++) R(x + k * 0.35 - 0.03, 4.85, x + k * 0.35 + 0.03, 6.65, '#8a8070'); R(x - 1.3, 7.0, x + 1.3, 7.25, STH); }
  // frieze with garlands, deep cornice
  R(-10.4, 7.7, 10.4, SC_E - 0.9, '#9a876c'); for (let x = -9.8; x < 9.9; x += 1.4) { g.fillStyle = '#c7b48e'; g.beginPath(); g.ellipse(m.X(x), m.Y(8.35), 0.55 * m.sx, 0.28 * m.sy, 0, 0, 2 * PI); g.fill(); }
  R(-10.4, SC_E - 0.9, 10.4, SC_E, STH); R(-10.4, SC_E - 0.92, 10.4, SC_E - 0.86, 'rgba(40,26,14,0.4)');
  // upper order
  for (const s of [-1, 1]) { R(s * 5.6 - 0.6, SC_E, s * 5.6 + 0.6, SC_U - 0.5, STH); R(s * 2.5 - 0.25, SC_E + 0.2, s * 2.5 + 0.25, SC_U - 0.5, STH); }
  R(-1.3, 10.3, 1.3, 12.0, '#7a6a58'); R(-1.5, 10.1, 1.5, 12.2, '#e8dfc8'); R(-1.1, 10.3, 1.1, 11.95, '#3a3027'); for (const y of [10.9, 11.5]) R(-1.1, y, 1.1, y + 0.05, '#8a7a60'); R(-0.03, 10.3, 0.03, 11.95, '#8a7a60'); m.seg(-1.9, 1.9, 12.2, 0.55, '#e8dfc8');
  for (const s of [-1, 1]) { const x = s * 4.0; R(x - 0.85, 10.0, x + 0.85, 12.2, '#e8dfc8'); m.arch(x, 10.15, 12.0, 1.4, '#6e6252'); R(x - 0.2, 10.3, x + 0.2, 11.3, '#d6cdb8'); m.circ(x, 11.5, 0.2, '#d6cdb8'); m.seg(x - 1.1, x + 1.1, 12.2, 0.4, '#e8dfc8'); R(x - 1.0, 9.9, x + 1.0, 10.15, '#e8dfc8'); }
  for (const s of [-1, 1]) { R(Math.min(s * 6.2, s * 8.2), SC_E, Math.max(s * 6.2, s * 8.2), 10.8, '#cdb07a'); R(s * 7.2 - 0.7, 9.9, s * 7.2 + 0.7, 10.5, '#e8dfc8'); }
  R(-6.8, SC_U - 0.5, 6.8, SC_U, STH); m.tri(-6.9, 6.9, SC_U, 2.0, YEL); m.tri(-5.6, 5.6, SC_U + 0.2, 1.4, '#e6d9bc'); m.circ(0, 13.6, 0.35, '#c7b48e');
  for (const s of [-1, 1]) { R(Math.min(s * 8.3, s * 10.4), 10.2, Math.max(s * 8.3, s * 10.4), 10.6, STH); R(s * 9.4 - 0.5, 10.6, s * 9.4 + 0.5, 11.0, STH); }
  wear(g, w, h, m, 6711, { stain: 'rgba(50,38,26,0.18)', soot: 26, sa: 0.3, lime: 6, foot: 3, sh: [SC_E, 12.6] });
}
function scWall(g, w, h) {
  const m = mk(g, w, h, 5.2, SC_E, 0), R = m.R;
  R(0, 0, 5.2, SC_E, '#a79680'); noiseDots(g, w, h, w * h / 50, 1.8, 6721, ['rgba(110,80,45,0.10)', 'rgba(255,244,215,0.08)', 'rgba(30,22,14,0.10)']);
  R(0, 0, 0.5, SC_E, '#b99d70'); R(4.7, 0, 5.2, SC_E, '#b99d70'); R(0, SC_E - 0.8, 5.2, SC_E, '#d6bc8a');
  m.arch(2.6, 5.0, 8.0, 1.5, '#d6bc8a'); m.arch(2.6, 5.2, 7.8, 1.1, '#2b2622');
  wear(g, w, h, m, 6722, { soot: 14, sa: 0.25, foot: 2.5 });
}
const SAN_CARLO = church({
  name: 'Chiesa di San Carlo Borromeo', id: SC.id, p: SC.p, O: SC.O, N: SC.N, x: 490, z: 146, r: 32, FW: 20.8, FH: SC_FH, EAVE: SC_E,
  roof: { rw: 20.2, z0: -1.6, z1: -30, rise: 3.2, c: '#b8704c', wc: '#c9b48c' },
  wall: { key: 'biScW', w: 128, h: 256, tw: 5.2, paint: scWall },
  front: {
    key: 'biScF', w: 384, h: 273, paint: scFront,
    shape: (T, hw) => {
      const s = new T.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 10.7); s.lineTo(8.3, 10.7); s.quadraticCurveTo(6.5, 10.9, 6.5, 12.3); s.lineTo(6.9, SC_U); s.lineTo(0, SC_FH);
      s.lineTo(-6.9, SC_U); s.lineTo(-6.5, 12.3); s.quadraticCurveTo(-6.5, 10.9, -8.3, 10.7); s.lineTo(-hw, 10.7); s.lineTo(-hw, 0); return s;
    },
  },
  extra: ({ F, at }) => {
    bx('flat', F, -10.8, 10.8, SC_E - 0.5, SC_E + 0.1, -1.35, 0.55, { c: '#cdb07a', noao: true });
    bx('flat', F, -7.3, 7.3, SC_U - 0.2, SC_U + 0.3, -1.35, 0.45, { c: '#d6bc8a', noao: true });
    for (const sg of [-1, 1]) {
      sphere('flat', 0.5, { M: at(sg * 9.4, 11.3, -0.5), seg: 6, c: '#d6bc8a' });
      bx('stone', F, sg * 7.6 - 1.3, sg * 7.6 + 1.3, -0.2, 0.2, -0.05, 0.5, { c: '#cfc2a4' });
    }
    bx('stone', F, -2.0, 2.0, -0.2, 0.2, -0.05, 0.6, { c: '#d6c9a8' }); bx('stone', F, -1.8, 1.8, 0.2, 0.4, -0.05, 0.3, { c: '#d6c9a8' });
    bx('flat', F, -0.1, 0.1, SC_FH, SC_FH + 1.4, -0.8, -0.6, { c: '#3e3a36', noao: true }); bx('flat', F, -0.5, 0.5, SC_FH + 0.8, SC_FH + 0.92, -0.8, -0.6, { c: '#3e3a36', noao: true });
  },
});

// ---------- 4. Santa Lucia al Monte ----------
const SL = { id: 'w215618520', p: [-440.8, -903.9, -411.3, -918.7, -406.7, -917.8, -404.2, -914.4, -403.1, -910.3, -404.8, -906, -434.2, -891.2], O: [-437.5, -897.5], N: [-0.887, 0.461] };
const SL_FH = 17.4, SL_L = 7.6, SL_E = 10.2, SL_U = 14.4;
function slFront(g, w, h) {
  const m = mk(g, w, h, 14.4, SL_FH, 7.2), R = m.R, PLD = '#8f7c66', STN = '#b49a6e', STH = '#d2b684', YEL = '#d6aa5e', CRM = '#e4cb94';
  R(-7.2, 0, 7.2, SL_E, PLD); R(-7.2, SL_E, 7.2, SL_FH, YEL);
  noiseDots(g, w, h, w * h / 45, 1.8, 6801, ['rgba(90,65,38,0.12)', 'rgba(255,238,200,0.09)', 'rgba(30,22,14,0.10)']);
  // lower order: corner pilasters, a pair each side of the portal bay, narrow garland bays
  for (const s of [-1, 1]) { R(Math.min(s * 6.1, s * 7.2), 0, Math.max(s * 6.1, s * 7.2), SL_L, STN); R(Math.min(s * 5.9, s * 7.3), SL_L - 0.5, Math.max(s * 5.9, s * 7.3), SL_L, STH); R(Math.min(s * 2.8, s * 4.1), 0, Math.max(s * 2.8, s * 4.1), SL_L, STN); R(Math.min(s * 2.7, s * 4.2), SL_L - 0.5, Math.max(s * 2.7, s * 4.2), SL_L, STH);
    R(s * 5.1 - 0.35, 1.6, s * 5.1 + 0.35, 6.4, '#6a5a48'); for (let y = 2.0; y < 6.2; y += 0.7) m.circ(s * 5.1, y, 0.22, '#8a785e'); }
  R(-2.8, 0, 2.8, SL_L, '#a29078');
  R(-1.45, 0, 1.45, 4.2, '#42301f'); R(-0.03, 0, 0.03, 4.2, '#2a1d12'); for (let y = 0.5; y < 4.0; y += 1.2) { R(-1.35, y, -0.1, y + 1.0, 'rgba(0,0,0,0.13)'); R(0.1, y, 1.35, y + 1.0, 'rgba(0,0,0,0.13)'); }
  R(-1.9, 0, -1.45, 4.5, STH); R(1.45, 0, 1.9, 4.5, STH); R(-2.2, 4.2, 2.2, 4.6, STH); m.tri(-2.6, 2.6, 4.6, 1.0, STH); m.tri(-1.9, 1.9, 4.7, 0.65, '#a29078');
  R(-1.25, 5.6, 1.25, 7.2, '#cdb283'); R(-0.95, 5.85, 0.95, 7.0, '#2b2622'); m.tri(-1.7, 1.7, 7.2, 0.5, STH);
  // deep entablature: architrave, a carved frieze, a dentilled cornice
  R(-7.2, SL_L, 7.2, SL_L + 0.5, '#9d8a6a'); R(-7.2, SL_L + 0.5, 7.2, SL_E - 1.1, '#7d6c58'); for (let x = -6.6; x < 6.7; x += 0.9) { g.fillStyle = '#a89479'; g.beginPath(); g.ellipse(m.X(x), m.Y(8.55), 0.34 * m.sx, 0.22 * m.sy, 0, 0, 2 * PI); g.fill(); }
  R(-7.2, SL_E - 1.1, 7.2, SL_E, STH); for (let x = -7.1; x < 7.1; x += 0.3) R(x, SL_E - 0.75, x + 0.15, SL_E - 0.45, 'rgba(60,40,20,0.35)');
  // upper order
  R(-5.3, SL_E, 5.3, SL_U, YEL);
  for (const s of [-1, 1]) { R(Math.min(s * 5.3, s * 4.6), SL_E, Math.max(s * 5.3, s * 4.6), SL_U - 0.5, STH); R(Math.min(s * 1.9, s * 2.5), SL_E + 0.1, Math.max(s * 1.9, s * 2.5), SL_U - 0.5, STH); }
  R(-0.95, 10.8, 0.95, 13.0, '#3a3027'); R(-1.2, 10.6, 1.2, 13.2, CRM); R(-0.95, 10.8, 0.95, 13.0, '#3a3027'); R(-0.03, 10.8, 0.03, 13.0, '#8a7a60'); R(-1.5, 10.4, 1.5, 10.6, CRM); m.seg(-1.6, 1.6, 13.2, 0.55, CRM);
  for (const s of [-1, 1]) { const x = s * 3.65; m.arch(x, 10.9, 13.0, 1.4, CRM); m.arch(x, 11.05, 12.9, 1.05, '#6e6150'); R(x - 0.18, 11.1, x + 0.18, 12.2, '#d9d0bc'); m.circ(x, 12.4, 0.2, '#d9d0bc'); m.seg(x - 0.95, x + 0.95, 13.3, 0.35, CRM); R(x - 0.9, 10.5, x + 0.9, 10.8, CRM); }
  R(-5.6, SL_U - 0.5, 5.6, SL_U, STH); R(-5.9, SL_U, 5.9, SL_U + 0.35, '#c7ab77'); R(-5.0, SL_U + 0.35, 5.0, SL_U + 1.5, YEL); R(-3.9, SL_U + 0.5, 3.9, SL_U + 1.4, '#e0cc9a'); m.arch(0, SL_U + 1.5, SL_U + 2.4, 1.6, '#c7ab77');
  // wings with the concave scroll
  for (const s of [-1, 1]) { R(Math.min(s * 5.3, s * 7.2), SL_E, Math.max(s * 5.3, s * 7.2), 10.9, '#cb9f54'); R(s * 6.3 - 0.45, 9.2, s * 6.3 + 0.45, 10.8, '#e0cc9a'); }
  wear(g, w, h, m, 6811, { stain: 'rgba(50,38,26,0.18)', soot: 26, sa: 0.3, lime: 6, foot: 3, sh: [SL_E, SL_U] });
}
function slWall(g, w, h) {
  const m = mk(g, w, h, 4.5, SL_E, 0), R = m.R;
  R(0, 0, 4.5, SL_E, '#a98e66'); noiseDots(g, w, h, w * h / 50, 1.8, 6821, ['rgba(110,80,45,0.10)', 'rgba(255,244,215,0.08)', 'rgba(30,22,14,0.10)']);
  R(0, 0, 0.45, SL_E, '#b99d70'); R(4.05, 0, 4.5, SL_E, '#b99d70'); R(0, SL_E - 0.8, 4.5, SL_E, '#d2b684');
  m.arch(2.25, 5.6, 8.6, 1.4, '#d2b684'); m.arch(2.25, 5.8, 8.4, 1.0, '#2b2622');
  wear(g, w, h, m, 6822, { soot: 14, sa: 0.25, foot: 2.5 });
}
const SANTA_LUCIA = church({
  name: 'Chiesa di Santa Lucia al Monte', id: SL.id, p: SL.p, O: SL.O, N: SL.N, x: -422, z: -905, r: 40, FW: 14.4, FH: SL_FH, EAVE: SL_E,
  roof: { rw: 14.0, z0: -1.6, z1: -32, rise: 3.0, c: '#b8704c', wc: '#c9ad7c' },
  wall: { key: 'biSlW', w: 128, h: 256, tw: 4.5, paint: slWall },
  front: {
    key: 'biSlF', w: 320, h: 384, paint: slFront,
    shape: (T, hw) => {
      const s = new T.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 10.9); s.lineTo(6.5, 10.9); s.quadraticCurveTo(5.5, 11.2, 5.4, 13.0); s.lineTo(5.9, SL_U); s.lineTo(5.9, SL_U + 0.35);
      s.lineTo(5.0, SL_U + 0.35); s.lineTo(5.0, SL_U + 1.5); s.lineTo(0, SL_FH - 0.4); s.lineTo(-5.0, SL_U + 1.5); s.lineTo(-5.0, SL_U + 0.35); s.lineTo(-5.9, SL_U + 0.35); s.lineTo(-5.9, SL_U);
      s.lineTo(-5.4, 13.0); s.quadraticCurveTo(-5.5, 11.2, -6.5, 10.9); s.lineTo(-hw, 10.9); s.lineTo(-hw, 0); return s;
    },
  },
  extra: ({ F, at }) => {
    bx('flat', F, -7.6, 7.6, SL_E - 0.5, SL_E + 0.1, -1.35, 0.55, { c: '#cdb07a', noao: true });
    bx('flat', F, -6.0, 6.0, SL_U - 0.2, SL_U + 0.35, -1.35, 0.4, { c: '#d2b684', noao: true });
    for (const sg of [-1, 1]) {
      sphere('flat', 0.45, { M: at(sg * 6.5, 11.3, -0.5), seg: 6, c: '#cdb07a' });
    }
    bx('stone', F, -1.9, 1.9, -0.2, 0.2, -0.05, 0.6, { c: '#d6c9a8' });
    bx('flat', F, -0.1, 0.1, SL_FH - 0.4, SL_FH + 1.0, -0.8, -0.6, { c: '#3e3a36', noao: true }); bx('flat', F, -0.5, 0.5, SL_FH + 0.4, SL_FH + 0.52, -0.8, -0.6, { c: '#3e3a36', noao: true });
  },
});

export const BATCH_I = [SANTO_SPIRITO, MONSERRATO, SAN_CARLO, SANTA_LUCIA];
