// City landmarks, batch G: Oratorio del Rosario di Santa Cita, Oratori di Porto e Riporto, Madonna dei Rimedi, Chiesa e Collegio di Santa Maria della Sapienza (Palermo). Registered in src/landmarks-city.js.
// Each replaces its OSM footprint (skipIds). Frame F per monument: origin on the ground in the middle of the front, +z out of the front, local x along the front. The real front was chosen from the footprint edge that faces the named street.
// Reference photos (Wikimedia Commons, looked at, nothing copied):
//  Madonna dei Rimedi: "Chiesa della Madonna dei Rimedi, Palermo.jpg" (the whole front from the left, afternoon light). Read: two orders of terracotta-pink stone on white plaster; lower order of seven bays (narrow, wide with a barred window, narrow with an arched niche, the arched portal between two columns, mirrored),
//   eight pilasters with carved capitals, a bracketed cornice, a frieze of pink cartouche panels over each side bay, an upper order with two pilasters each side of a tall barred window and a statue niche each side, a triangular pediment with pinnacles, concave scrolls down to the lower cornice, a peach plastered nave behind.
//   Heights relative to the width (21.1 m): lower cornice about 0.41, upper cornice about 0.71, pediment top about 0.86. Not known: the nave length and the roof behind the front, the cloister side (plain walls with windows).
//  Oratorio del Rosario di Santa Cita: "Oratorio del Rosario di Santa Cita 01.jpg" (the portal in Via Valverde, close, from the steps), "Oratorio del Rosario di Santa Cita 02.jpg" and "03.jpg" (the court with the two-storey arcade, looked at, only the colours used). Read: warm sandy stone, a moulded stone portal surround with a bracketed projecting cornice,
//   a stone cartouche with two putti and two crown finials on a plain plaster panel, a carved frieze band at the top, a stone corner pilaster, steps up to the door, iron door in dark brown, weathered paint and damp. The photo shows only about 5 m of the front: the rest of the 13 m front is plain weathered wall by assumption.
//  Oratori di Porto e Riporto and Santa Maria della Sapienza (Collegio, Piazza Magione): no photo of either exists on Commons (category search and file search found none), so both are kept simple and are NOT portraits: weathered plaster blocks in the palette of the other Kalsa photos, a stone portal, rows of windows.
import * as THREE from 'three';
import { PI, bx, cyl, cone, sphere, extrude, prism, shell, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue, paintAshlar, RNG } from './lmc-kit.js';

// ---- shared helpers ----
const mkFrame = (mid, n) => ({
  toW: (x, z) => [mid[0] + x * n[1] + z * n[0], mid[1] - x * n[0] + z * n[1]],
  toL: (p) => { const dx = p[0] - mid[0], dz = p[1] - mid[1]; return [dx * n[1] - dz * n[0], dx * n[0] + dz * n[1]]; },
});
function clipFront(loc, zmax, toW) {
  const out = [];
  for (let i = 0; i < loc.length; i++) {
    const a = loc[i], b = loc[(i + 1) % loc.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toW(q[0], q[1]));
}
function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function fitNave(loc, hwMax, minLen) {   // the widest straight box behind the front that fits in the footprint
  for (let hw = hwMax; hw >= 2.6; hw -= 0.5) {
    let len = 0;
    for (let z = -2; z > -80; z -= 1.5) { if (inPoly(loc, -hw, z) && inPoly(loc, hw, z) && inPoly(loc, 0, z)) len = -z; else break; }
    if (len >= minLen) return { hw, len: Math.min(len, 46) };
  }
  return null;
}
// a canvas toolbox in metres: x from the left edge, y up from the bottom
function tools(g, w, h, mw, mh, x0 = 0) {
  const sx = w / mw, sy = h / mh, X = x => (x - x0) * sx, Y = y => h - y * sy;
  const R = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  const arch = (x, y0, y1, ww, col) => { const r = ww / 2; g.fillStyle = col; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (a, c, y, hh, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(X(a), Y(y)); g.lineTo(X((a + c) / 2), Y(y + hh)); g.lineTo(X(c), Y(y)); g.fill(); };
  return { sx, sy, X, Y, R, arch, tri };
}
// wear: mottled stains, rain streaks, soot under ledges, damp at the foot and patches where the plaster has fallen and the stone shows through
function weather(g, w, h, T, seed, o = {}) {
  const r = RNG(seed), { sx, sy, X, Y } = T, mw = w / sx, mh = h / sy;
  for (let i = 0; i < (o.blots || 26); i++) {
    const cx = r() * w, cy = r() * h, rad = (1.2 + r() * 3.2) * sx, dark = r() < 0.6, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, dark ? 'rgba(80,58,36,0.15)' : 'rgba(255,244,215,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < (o.patches || 5); i++) {   // fallen plaster: stone coursed blocks showing, ragged edge
    const px = r() * (mw - 2), py = 0.8 + r() * (mh - 3), pw = 0.7 + r() * 1.7, ph = 0.5 + r() * 1.3;
    g.fillStyle = o.patch || '#bfa078'; g.beginPath(); g.moveTo(X(px), Y(py));
    for (let k = 1; k <= 6; k++) g.lineTo(X(px + pw * k / 6), Y(py + (r() - 0.5) * 0.25));
    for (let k = 1; k <= 4; k++) g.lineTo(X(px + pw + (r() - 0.5) * 0.25), Y(py + ph * k / 4));
    for (let k = 5; k >= 0; k--) g.lineTo(X(px + pw * k / 6), Y(py + ph + (r() - 0.5) * 0.25));
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,50,30,0.35)'; g.lineWidth = 1;
    for (let yy = py + 0.3; yy < py + ph; yy += 0.3) { g.beginPath(); g.moveTo(X(px + 0.05), Y(yy)); g.lineTo(X(px + pw - 0.05), Y(yy)); g.stroke(); }
    g.fillStyle = 'rgba(60,40,25,0.16)'; g.fillRect(X(px), Y(py + ph), pw * sx, 0.12 * sy);
  }
  streaks(g, w, h, o.streaks || 34, seed + 3, 0.11, 0.18 * h, '66,48,32');
  for (const y of o.ledges || []) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.6)); gs.addColorStop(0, 'rgba(45,32,20,0.30)'); gs.addColorStop(1, 'rgba(45,32,20,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.6 * sy); }
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3.2)); gb.addColorStop(0, 'rgba(36,26,16,0.38)'); gb.addColorStop(1, 'rgba(36,26,16,0)'); g.fillStyle = gb; g.fillRect(0, Y(3.2), w, 3.2 * sy);
  g.fillStyle = 'rgba(235,228,205,0.16)'; g.fillRect(0, Y(3.5), w, 0.18 * sy);   // the salt line above the damp
  noiseDots(g, w, h, w * h / 45, 1.6, seed + 4, ['rgba(70,50,30,0.10)', 'rgba(255,245,220,0.08)', 'rgba(110,80,50,0.07)']);
}
// side wall bay (4.5 m wide, hm high): plaster, plinth, a cornice, one arched window per row, worn
function paintBay(g, w, h, hm, o) {
  const T = tools(g, w, h, 4.5, hm), { R, arch } = T;
  g.fillStyle = o.base; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, o.seed, ['rgba(150,110,60,0.09)', 'rgba(255,245,215,0.08)']);
  R(0, 0, 4.5, 0.9, o.plinth); R(0, hm - 0.7, 4.5, hm, o.cornice); R(0, hm - 1.0, 4.5, hm - 0.7, 'rgba(50,30,15,0.30)');
  for (const y of o.rows) { arch(2.25, y, y + o.wh, 1.5, o.frame); arch(2.25, y + 0.2, y + o.wh - 0.15, 1.1, '#2b3238'); R(2.2, y + 0.2, 2.3, y + o.wh - 0.5, '#6b5a44'); R(0.8, y - 0.12, 3.7, y, o.frame); }
  weather(g, w, h, T, o.seed + 9, { patch: o.patch, patches: 3, blots: 12, streaks: 14, ledges: [hm - 0.7] });
}

// one church or oratory: body clipped behind the front, gable nave where it fits, the painted front slab, then trims(env)
function build(C) {
  initShared();
  const { toW, toL } = mkFrame(C.mid, C.n), pts = pairsOf(C.p), loc = pts.map(toL), gr = groundRange(pts);
  const y0 = Math.min(groundY(...toW(-C.FW / 2, 1)), groundY(...toW(C.FW / 2, 1)), groundY(...toW(0, 1)));
  const F = frame(C.mid[0], y0, C.mid[1], C.n[0], C.n[1]), at = (x, y, z) => mul(F, tr(x, y, z)), K = C.k;
  defMat(K + 'F', C.tw, C.th, [C.FW, C.FH], C.paint);
  defMat(K + 'W', 128, 256, [4.5, C.EAVE], (g, w, h) => paintBay(g, w, h, C.EAVE, C.wall));
  begin(y0);
  const body = clipFront(loc, -0.1, toW);
  prism(K + 'W', body, Math.min(gr.lo, y0) - 1.5, y0 + C.EAVE, { uvo: [0, -y0 / C.EAVE] });
  prism('flat', body, y0 + C.EAVE, y0 + C.EAVE + 0.12, { c: C.roof });
  const solids = [[C.p, null, y0 + C.EAVE]];
  const nave = C.nave ? fitNave(loc, C.nave[0], C.nave[1]) : null;
  if (nave) {
    bx(K + 'W', F, -nave.hw, nave.hw, C.EAVE, C.NT, -nave.len, -1.6, { uvo: [0, -(y0 + C.EAVE) / C.EAVE] });
    gable('tile', K + 'W', at(0, 0, -(nave.len + 1.6) / 2), nave.hw * 2, nave.len - 1.6, C.NT, C.RISE, { ov: 0.35, c: '#b0704c', wc: C.wall.base });
    solids.push([[[-nave.hw, -nave.len], [nave.hw, -nave.len], [nave.hw, -1.6], [-nave.hw, -1.6]].flatMap(q => toW(q[0], q[1])), null, y0 + C.NT + C.RISE]);
  }
  extrude(K + 'F', C.shape(), 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / C.FW, 1 / C.FH], uvo: [0.5, 0], cs: 8, noao: true });
  C.trims({ F, at, y0 });
  const o = end(C.name); o.userData.solids = solids; return o;
}

// =====================================================================================================
// Madonna dei Rimedi (w1185704646): front on the 21.1 m edge onto Piazza Indipendenza
// =====================================================================================================
const RM = { id: 'w1185704646', p: [-1010.7, 665.5, -996.7, 688.2, -983.1, 680.1, -968.2, 670.9, -970.1, 668, -949.4, 655.1, -948.9, 652.6, -959.9, 634.6, -961.7, 635.7], mid: [-954.4, 643.6], n: [0.853, -0.521] };
const RFW = 21.1, RLOW = 8.6, RUPC = 15.0, RPED = 2.8, RFH = 19.2;
const PINK = '#c4806a', PINKD = '#9f6552', PINKL = '#d99b86', WHT = '#ebe6de';
function paintRimedi(g, w, h) {
  const T = tools(g, w, h, RFW, RFH, -RFW / 2), { R, arch, tri, X, Y, sx, sy } = T;
  g.fillStyle = WHT; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, 8101, ['rgba(120,130,150,0.07)', 'rgba(255,255,255,0.10)', 'rgba(150,120,90,0.06)']);
  const pil = (x, y0, y1, ww) => { R(x - ww / 2, y0, x + ww / 2, y1, PINK); R(x - ww / 2, y0, x - ww / 2 + 0.1, y1, 'rgba(255,225,205,0.4)'); R(x + ww / 2 - 0.14, y0, x + ww / 2, y1, 'rgba(70,30,20,0.32)'); R(x - ww / 2 - 0.12, y1 - 0.55, x + ww / 2 + 0.12, y1, PINKL); R(x - ww / 2 - 0.1, y0, x + ww / 2 + 0.1, y0 + 0.45, PINKL); for (let k = 0; k < 4; k++) R(x - ww / 2 + 0.05, y1 - 0.5, x + ww / 2 - 0.05, y1 - 0.5 + 0.05 + k * 0.0, 'rgba(70,30,20,0.0)'); };
  R(-RFW / 2, 0, RFW / 2, 1.0, PINKD); R(-RFW / 2, 1.0, RFW / 2, 1.15, PINKL);
  // lower order
  for (const s of [-1, 1]) for (const x of [10.2, 8.5, 4.4, 2.75]) pil(s * x, 1.15, RLOW - 0.9, x > 9 ? 1.0 : 0.8);
  for (const s of [-1, 1]) {
    for (const x of [9.35, 3.6]) { arch(s * x, 2.4, 6.6, 1.4, PINKL); arch(s * x, 2.55, 6.4, 1.1, '#ddd6cc'); R(s * x - 0.4, 2.4, s * x + 0.4, 2.55, PINKL); }
    const wx = s * 6.45; R(wx - 1.25, 2.3, wx + 1.25, 6.6, PINK); R(wx - 0.9, 2.65, wx + 0.9, 6.25, '#2a2c31'); for (let k = -2; k <= 2; k++) R(wx + k * 0.36 - 0.03, 2.65, wx + k * 0.36 + 0.03, 6.25, '#7a6f60'); for (const y of [3.7, 4.9]) R(wx - 0.9, y, wx + 0.9, y + 0.05, '#7a6f60');
    tri(wx - 1.5, wx + 1.5, 6.6, 0.8, PINK); tri(wx - 1.0, wx + 1.0, 6.7, 0.5, WHT);
  }
  // the portal: arch in a pink surround between two columns, a small cross over it
  R(-2.7, 1.15, 2.7, 1.5, PINKL); arch(0, 1.15, 6.9, 3.2, PINK); arch(0, 1.5, 6.5, 2.5, '#4c2a22'); R(-0.04, 1.5, 0.04, 4.8, '#2a1510'); for (let y = 1.8; y < 4.6; y += 1.35) { R(-1.15, y, -0.1, y + 1.15, 'rgba(0,0,0,0.14)'); R(0.1, y, 1.15, y + 1.15, 'rgba(0,0,0,0.14)'); }
  R(-0.16, 7.3, 0.16, 8.1, '#f2eee6'); R(-0.45, 7.8, 0.45, 8.0, '#f2eee6'); tri(-2.1, -0.5, 7.0, 0.75, PINK); tri(0.5, 2.1, 7.0, 0.75, PINK);
  // entablature: frieze with a pink dentil run, bracketed cornice
  R(-RFW / 2, RLOW - 0.9, RFW / 2, RLOW, PINK); for (let x = -10.4; x < 10.4; x += 0.55) R(x, RLOW - 0.8, x + 0.28, RLOW - 0.35, PINKD); R(-RFW / 2, RLOW - 1.0, RFW / 2, RLOW - 0.9, 'rgba(60,25,15,0.4)'); R(-RFW / 2, RLOW, RFW / 2, RLOW + 0.45, PINKL);
  // wings: a frieze of cartouche panels over the side bays, white wall above
  for (const s of [-1, 1]) {
    R(s > 0 ? 4.7 : -10.6, RLOW + 0.45, s > 0 ? 10.6 : -4.7, RLOW + 1.9, PINK);
    for (let x = 5.2; x < 10.3; x += 1.3) { const cx = s * x; R(cx - 0.5, RLOW + 0.65, cx + 0.5, RLOW + 1.7, WHT); g.fillStyle = PINKL; g.beginPath(); g.ellipse(X(cx), Y(RLOW + 1.18), 0.3 * sx, 0.28 * sy, 0, 0, 2 * PI); g.fill(); }
  }
  // upper order
  for (const s of [-1, 1]) for (const x of [4.0, 1.55]) pil(s * x, RLOW + 0.45, RUPC - 0.6, 0.75);
  R(-1.15, 9.5, 1.15, 13.9, PINK); R(-0.8, 9.85, 0.8, 13.55, '#2a2c31'); for (let k = -1; k <= 1; k++) R(k * 0.5 - 0.03, 9.85, k * 0.5 + 0.03, 13.55, '#7a6f60'); for (const y of [11.0, 12.2]) R(-0.8, y, 0.8, y + 0.05, '#7a6f60'); R(-1.4, 13.9, 1.4, 14.25, PINKL);
  for (const s of [-1, 1]) { arch(s * 2.78, 9.7, 13.2, 1.15, PINK); arch(s * 2.78, 9.85, 13.05, 0.85, '#c9ccd1'); }
  R(-5.0, RUPC - 0.6, 5.0, RUPC, PINK); R(-5.2, RUPC, 5.2, RUPC + 0.3, PINKL);
  tri(-5.3, 5.3, RUPC + 0.3, RPED, PINK); tri(-4.3, 4.3, RUPC + 0.6, RPED - 0.7, WHT);
  for (const y of [RLOW + 0.45, RUPC]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(60,25,15,0.30)'); gs.addColorStop(1, 'rgba(60,25,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sy); }
  weather(g, w, h, T, 8102, { patch: '#c9a98a', patches: 4, blots: 30, ledges: [], streaks: 30 });
}
function rimediShape() {
  const hw = RFW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, RLOW + 1.9); s.lineTo(10.3, RLOW + 1.9);
  s.bezierCurveTo(8.2, RLOW + 2.0, 5.9, RLOW + 3.6, 5.2, RUPC + 0.3); s.lineTo(5.3, RUPC + 0.3); s.lineTo(0, RUPC + 0.3 + RPED); s.lineTo(-5.3, RUPC + 0.3); s.lineTo(-5.2, RUPC + 0.3);
  s.bezierCurveTo(-5.9, RLOW + 3.6, -8.2, RLOW + 2.0, -10.3, RLOW + 1.9); s.lineTo(-hw, RLOW + 1.9); s.lineTo(-hw, 0);
  return s;
}
function rimediTrims({ F, at }) {
  for (const s of [-1, 1]) {
    for (const x of [10.2, 8.5, 4.4, 2.75]) bx('flat', F, s * x - 0.45, s * x + 0.45, 1.15, RLOW - 0.9, -0.05, 0.2, { c: PINK, noao: true });
    for (const x of [4.0, 1.55]) bx('flat', F, s * x - 0.4, s * x + 0.4, RLOW + 0.45, RUPC - 0.6, -0.05, 0.18, { c: PINK, noao: true });
    cyl('flat', 0.26, 0.29, 5.6, 8, { M: at(s * 2.2, 1.15, 0.55), c: PINKL });
    sphere('flat', 0.42, { M: at(s * 10.3, RLOW + 2.3, -0.3), seg: 6, c: PINKL });
    cone('flat', 0.4, 0.9, 6, { M: at(s * 5.4, RUPC + 0.35, -0.3), c: PINKL });
    statue('flat', at(s * 2.78, 9.85, 0.0), 1.15, { c: '#f1eee6' });
  }
  bx('flat', F, -hwOf(), hwOf(), RLOW, RLOW + 0.4, -0.05, 0.5, { c: PINKL, noao: true });
  bx('flat', F, -5.3, 5.3, RUPC, RUPC + 0.3, -0.05, 0.45, { c: PINKL, noao: true });
  cone('flat', 0.45, 1.0, 6, { M: at(0, RUPC + 0.3 + RPED, -0.3), c: PINKL });
  bx('flat', F, -0.07, 0.07, RUPC + RPED + 1.2, RUPC + RPED + 2.6, -0.35, -0.2, { c: '#4a4036', noao: true }); bx('flat', F, -0.4, 0.4, RUPC + RPED + 2.0, RUPC + RPED + 2.15, -0.35, -0.2, { c: '#4a4036', noao: true });
}
const hwOf = () => RFW / 2 + 0.1;
const MADONNA_REMEDI = {
  name: 'Madonna dei Rimedi', x: -985, z: 656, radius: 62, skipIds: [RM.id],
  build: () => build({
    ...RM, k: 'rm', name: 'Madonna dei Rimedi', FW: RFW, FH: RFH, tw: 384, th: 352, paint: paintRimedi, shape: rimediShape, trims: rimediTrims,
    EAVE: 11, NT: 14.0, RISE: 3.4, nave: [8.2, 14], roof: '#a39a8c',
    wall: { base: '#dca07f', plinth: '#b9805f', cornice: '#e6c5a6', frame: '#d9b693', patch: '#bf9a72', rows: [2.4, 6.4], wh: 3.0, seed: 8121 },
  }),
};

// =====================================================================================================
// Oratorio del Rosario di Santa Cita (w143736591): front on the 13.1 m edge onto Via Valverde
// =====================================================================================================
const OR = { id: 'w143736591', p: [142.3, -584.6, 159, -591.1, 167.4, -569.8, 163, -568.1, 170.7, -548.8, 158.5, -544], mid: [164.6, -546.4], n: [0.366, 0.931] };
const OFW = 13.1, OFH = 8.6, OSTN = '#c3a276', OSTD = '#a98a60', OPAN = '#cbbd9c';
function paintOratorio(g, w, h) {
  const T = tools(g, w, h, OFW, OFH, -OFW / 2), { R, arch, X, Y, sx, sy } = T;
  paintAshlar(g, w, h, OFW, OFH, 0.42, 1.1, OSTN, '#917852', 8201, 2, 0.08);
  // the plaster panel of the middle and right, over the stone
  R(-2.4, 5.6, 6.3, 8.0, OPAN); R(-6.55, 0, -2.7, 8.6, 'rgba(0,0,0,0)');
  noiseDots(g, w, h, w * h / 90, 2, 8202, ['rgba(150,110,60,0.08)', 'rgba(255,245,215,0.07)']);
  // the portal: stepped moulded surround, dark iron door, bracketed cornice, carved cartouche at the keystone
  R(-2.6, 0.2, 2.6, 5.1, OSTD); R(-2.35, 0.2, 2.35, 4.95, OSTN); R(-2.1, 0.2, 2.1, 4.8, OSTD); R(-1.85, 0.2, 1.85, 4.6, OSTN); R(-1.55, 0.2, 1.55, 4.4, '#1e1612');
  R(0.0, 0.2, 1.55, 4.4, '#5b3f33'); R(0.0, 0.2, 0.06, 4.4, '#2a1c14'); R(0.1, 0.2, 1.45, 1.8, 'rgba(0,0,0,0.12)');
  R(-2.9, 5.1, 2.9, 5.45, '#b79868'); R(-3.4, 5.45, 3.4, 5.8, '#cdb184'); R(-3.4, 5.4, 3.4, 5.46, 'rgba(50,30,15,0.5)');
  for (const s of [-1, 1]) { R(s * 2.1 - 0.3, 4.5, s * 2.1 + 0.3, 5.1, '#cdb184'); R(s * 2.1 - 0.22, 4.6, s * 2.1 + 0.22, 4.7, 'rgba(60,40,20,0.4)'); }
  g.fillStyle = '#cdb184'; g.beginPath(); g.ellipse(X(0), Y(5.2), 0.45 * sx, 0.5 * sy, 0, 0, 2 * PI); g.fill();
  R(-1.3, 4.65, 1.3, 4.95, '#bda070');
  // above the cornice: the arms of the confraternity between two putti, two crowns, the carved frieze at the top
  g.fillStyle = '#ddd0b6'; g.beginPath(); g.ellipse(X(0), Y(6.9), 0.5 * sx, 0.6 * sy, 0, 0, 2 * PI); g.fill(); g.strokeStyle = '#a99a78'; g.lineWidth = 1.5; g.stroke();
  for (const s of [-1, 1]) { g.fillStyle = '#d6c8ae'; g.beginPath(); g.ellipse(X(s * 1.15), Y(6.8), 0.3 * sx, 0.45 * sy, 0, 0, 2 * PI); g.fill(); g.beginPath(); g.arc(X(s * 1.15), Y(7.35), 0.17 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#b9a07a'; g.beginPath(); g.arc(X(s * 2.2), Y(6.3), 0.32 * sx, PI, 0); g.fill(); R(s * 2.2 - 0.32, 5.9, s * 2.2 + 0.32, 6.3, '#a88c64'); }
  R(-2.6, 7.7, 6.3, 8.2, '#bfa073'); for (let x = -2.4; x < 6.2; x += 0.5) R(x, 7.78, x + 0.25, 8.1, 'rgba(70,50,30,0.35)');
  R(-6.55, 8.0, 6.55, 8.6, '#b79868');
  // the corner pilaster at the left
  R(-6.55, 0, -5.9, 8.6, '#b99b6c'); R(-5.95, 0, -5.9, 8.6, 'rgba(50,30,15,0.4)');
  R(-6.55, 0, 6.55, 0.5, '#9d8460');
  for (const y of [5.1]) { const gs = g.createLinearGradient(0, Y(y + 0.3), 0, Y(y - 1.0)); gs.addColorStop(0, 'rgba(45,32,20,0.35)'); gs.addColorStop(1, 'rgba(45,32,20,0)'); g.fillStyle = gs; g.fillRect(0, Y(y + 0.3), w, 1.3 * sy); }
  weather(g, w, h, T, 8203, { patch: '#a98a60', patches: 5, blots: 24, streaks: 36, ledges: [8.0] });
}
function rectFront(W, H) { const s = new THREE.Shape(), h = W / 2; s.moveTo(-h, 0); s.lineTo(h, 0); s.lineTo(h, H); s.lineTo(-h, H); s.lineTo(-h, 0); return s; }
const ORATORIO_SANTA_CITA = {
  name: 'Oratorio del Rosario di Santa Cita', x: 160, z: -565, radius: 32, skipIds: [OR.id],
  build: () => build({
    ...OR, k: 'or', name: 'Oratorio del Rosario di Santa Cita', FW: OFW, FH: OFH, tw: 384, th: 256, paint: paintOratorio, shape: () => rectFront(OFW, OFH),
    trims: ({ F, at }) => {
      bx('stone', F, -2.7, 2.7, -0.2, 0.05, -0.05, 0.75, { c: '#b6aa94', noao: true });
      bx('flat', F, -3.4, 3.4, 5.1, 5.45, -0.05, 0.8, { c: '#bfa377' }); bx('flat', F, -3.5, 3.5, 5.45, 5.8, -0.05, 0.85, { c: '#cdb184' });
      for (const s of [-1, 1]) sphere('flat', 0.4, { M: at(s * 2.2, 6.15, -0.2), seg: 6, c: '#b09366' });
    },
    EAVE: 9.2, NT: 9.2, RISE: 3.0, nave: [5.2, 12], roof: '#a39a8c',
    wall: { base: '#c9b087', plinth: '#a68a62', cornice: '#d2bb92', frame: '#b79c70', patch: '#a98a60', rows: [3.6], wh: 3.4, seed: 8221 },
  }),
};

// =====================================================================================================
// Oratori di Porto e Riporto (w223122620): no photo found, simple: front on the 14.1 m edge onto Via Merlo
// =====================================================================================================
const PR = { id: 'w223122620', p: [546.6, -116.4, 551.3, -118.3, 548, -128.9, 541.9, -146.8, 536.3, -144.7, 523.8, -139.8, 533.2, -111.9], mid: [539.9, -114.2], n: [0.318, 0.948] };
const PFW = 14.1, PFH = 9.2, PPL = '#d3bb8a', PST = '#bfa07a';
function paintPorto(g, w, h) {
  const T = tools(g, w, h, PFW, PFH, -PFW / 2), { R, arch, tri } = T;
  g.fillStyle = PPL; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, 8301, ['rgba(150,110,60,0.09)', 'rgba(255,245,215,0.08)']);
  R(-PFW / 2, 0, PFW / 2, 0.9, '#a98a62');
  for (const s of [-1, 1]) { R(s * 6.8 - 0.35, 0.9, s * 6.8 + 0.35, 7.4, PST); R(s * 2.9 - 0.3, 0.9, s * 2.9 + 0.3, 7.4, PST); arch(s * 4.85, 2.6, 6.0, 1.4, PST); arch(s * 4.85, 2.8, 5.8, 1.0, '#2b3238'); R(s * 4.85 - 0.8, 2.5, s * 4.85 + 0.8, 2.7, PST); }
  R(-1.7, 0.9, 1.7, 5.6, PST); arch(0, 0.9, 5.2, 2.5, '#1e1612'); R(-1.5, 5.4, 1.5, 5.8, PST); tri(-2.2, 2.2, 5.8, 0.9, PST);
  R(-PFW / 2, 7.4, PFW / 2, 8.2, PST); R(-PFW / 2, 8.2, PFW / 2, 8.35, 'rgba(60,40,20,0.35)'); tri(-3.6, 3.6, 8.2, 1.0, PST); tri(-3.0, 3.0, 8.3, 0.7, PPL);
  weather(g, w, h, T, 8302, { patch: '#b99a72', patches: 5, blots: 26, streaks: 32, ledges: [7.4] });
}
const ORATORI_PORTO = {
  name: 'Oratori di Porto e Riporto', x: 536, z: -130, radius: 28, skipIds: [PR.id],
  build: () => build({
    ...PR, k: 'pr', name: 'Oratori di Porto e Riporto', FW: PFW, FH: PFH, tw: 384, th: 256, paint: paintPorto, shape: () => rectFront(PFW, PFH),
    trims: ({ F }) => { bx('flat', F, -PFW / 2 - 0.1, PFW / 2 + 0.1, 7.35, 7.7, -0.05, 0.4, { c: '#cdb184', noao: true }); bx('stone', F, -1.8, 1.8, -0.2, 0.2, -0.05, 0.6, { c: '#c9bda3' }); },
    EAVE: 9.0, NT: 9.0, RISE: 2.6, nave: [4.8, 10], roof: '#a39a8c',
    wall: { base: '#d0b888', plinth: '#a98a62', cornice: '#d9c398', frame: '#bfa07a', patch: '#b59870', rows: [3.4], wh: 3.0, seed: 8321 },
  }),
};

// =====================================================================================================
// Chiesa e Collegio di Santa Maria della Sapienza (r6201052.0): no photo found. A plain college block round a court, a stone portal in the middle of the 29 m edge on the open side.
// =====================================================================================================
const SA = { id: 'r6201052.0', p: [717.9, 116.8, 744, 97.9, 762, 120.6, 764.4, 123.7, 767.2, 127.3, 761.2, 132.4, 754.3, 138.3, 745.9, 145.5], holes: [[732.4, 113.5, 748.6, 130.7, 755, 126.2, 738.7, 108.6]], mid: [753, 109.3], n: [0.784, -0.621] };
const SH = 12.4, SW = 9, SPH = 10.2;
function paintSapienzaFront(g, w, h) {
  const T = tools(g, w, h, SW, SPH, -SW / 2), { R, arch, tri } = T, ST = '#c2a47a', STD = '#a6875f';
  g.fillStyle = ST; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 2, 8401, ['rgba(150,110,60,0.10)', 'rgba(255,245,215,0.08)']);
  paintAshlar(g, w, h, SW, SPH, 0.4, 1.0, ST, '#8f7550', 8402, 1.5, 0.07);
  R(-1.6, 0.0, 1.6, 4.8, STD); R(-1.35, 0.0, 1.35, 4.6, ST); arch(0, 0.0, 4.0, 2.2, '#1e1612'); R(-1.9, 4.8, 1.9, 5.2, '#b6986c'); tri(-2.1, 2.1, 5.2, 0.9, STD);
  R(-0.9, 6.1, 0.9, 9.0, STD); R(-0.65, 6.35, 0.65, 8.7, '#2b3238'); R(-1.3, 5.6, 1.3, 6.1, STD); R(-1.2, 9.0, 1.2, 9.4, STD); tri(-1.4, 1.4, 9.4, 0.7, STD);
  for (const s of [-1, 1]) R(s * 4.2 - 0.3, 0, s * 4.2 + 0.3, SPH, STD);
  weather(g, w, h, T, 8403, { patch: '#a98a64', patches: 3, blots: 20, streaks: 24, ledges: [5.2] });
}
const SAPIENZA = {
  name: 'Chiesa e Collegio di Santa Maria della Sapienza', x: 742, z: 122, radius: 42, skipIds: [SA.id],
  build: () => {
    initShared();
    const { toW } = mkFrame(SA.mid, SA.n), pts = pairsOf(SA.p), holes = [pairsOf(SA.holes[0])], gr = groundRange(pts);
    const y0 = Math.min(groundY(...toW(-4, 1)), groundY(...toW(4, 1)), groundY(...toW(0, 1)));
    const F = frame(SA.mid[0], y0, SA.mid[1], SA.n[0], SA.n[1]), at = (x, y, z) => mul(F, tr(x, y, z));
    defMat('saF', 384, 384, [SW, SPH], paintSapienzaFront);
    defMat('saW', 128, 256, [4.5, SH], (g, w, h) => paintBay(g, w, h, SH, { base: '#d6b98c', plinth: '#a98a62', cornice: '#dcc79e', frame: '#c4a77c', patch: '#b59870', rows: [2.0, 6.6], wh: 2.8, seed: 8421 }));
    begin(y0);
    shell('saW', pts, holes, y0, SH, { lo: Math.min(gr.lo, y0) - 1.5, roof: '#a39a8c', cc: '#dcc79e' });
    extrude('saF', rectFront(SW, SPH), 0.5, { M: at(0, 0, -0.1), uv: 'keep', uvk: [1 / SW, 1 / SPH], uvo: [0.5, 0], noao: true });
    bx('flat', F, -SW / 2 - 0.2, SW / 2 + 0.2, SPH - 0.1, SPH + 0.3, -0.1, 0.6, { c: '#cdb184', noao: true });
    const o = end('Chiesa e Collegio di Santa Maria della Sapienza'); o.userData.solids = [[SA.p, SA.holes, y0 + SH]]; return o;
  },
};

// Oratori di Porto e Riporto and the Sapienza have no reference photo, so they are built but not registered (ORATORI_PORTO, SAPIENZA): the standing rule is not to draw a front we cannot check.
export const BATCH_G = [ORATORIO_SANTA_CITA, MADONNA_REMEDI];
