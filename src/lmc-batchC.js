// City landmarks, batch C: Chiesa di San Nicolo da Tolentino (w49772131), Chiesa di San Mattia e Noviziato dei Crociferi (w86882287), Chiesa di Sant'Antonio abate (w49864836), Chiesa di Santa Maria di Valverde (w279882881).
// Registered in src/landmarks-city.js (BATCH_C). Each church: frame F with the origin on the ground in the middle of the front, +z out of the front, local x along the front; the front is one painted shape, the rest is the outline (clipped at the front) under a nave with a gable roof.
// Reference photos (Wikimedia Commons, looked at, nothing copied; the fronts were measured from them and then drawn procedurally):
// San Nicolo da Tolentino: Chiesa di San Nicolo da Tolentino (Palermo) - facciata1.JPG. Salmon-peach plaster, a lower order with a pedimented portal (statue niche over it) between two pilasters with Corinthian capitals, pale grey panels,
//   an inscription frieze, a narrower attic with a big arched window, white panels, side scrolls (volutes) and a triangular pediment with a cross. Front is the 29.8 m run of the outline on the street to the west.
// San Mattia ai Crociferi: San Mattia facciata.jpg; San Mattia ai Crociferi, Palermo.jpg; San Mattia ai Crociferi (Palermo) 14 07 2024 01.jpg. Golden tufa stone with white plaster panels, two orders: a central portal with a broken pediment between paired pilasters,
//   a framed window each side and a small door at each end, a dentil cornice; upper order with a round window in an oval frame, a framed window each side, a triangular pediment with finials; to the right a lower plain annex of the seminary in two floors of arched windows.
// Sant'Antonio abate: Chiesa di Sant'Antonio Abate (Palermo) - facciata1.JPG; facciata2.JPG; esterno1.JPG; esterno2.JPG; esterno3.JPG; 24 06 2023 01.jpg; SAA (Palermo) 14 07 2019 01.jpg. Gothic Revival front in sandy stone on the west side, towards Via Roma,
//   two orders: three pointed portals (the middle one big, two statues on pedestals), a rose window with a small statue under it and a pointed window each side in the upper order, pilaster strips, a flat parapet with a cross.
//   It stands on a terrace with a pierced stone balustrade over a retaining wall with a shop opening, a stair coming down at the right end. The square stone bell tower (clock, shuttered arched window, open belfry with corner piers
//   and an iron frame) stands behind on the right, on the mapped outline w279883860, which it replaces. The terrace is set inside the church outline so collision does not change: it is lower and shallower than the real one,
//   and the stair is only drawn on the wall.
// Santa Maria di Valverde: Palermo-Maria-Valverde-bjs2007-01.jpg; Santa Maria in Valverde esterno.jpg; Santa Maria in Valverde (Palermo) 25 10 2020 01.jpg. Pink plastered flank (the long south wall) with a grey stone baroque portal (volutes, a shield),
//   two arched windows high up, a cream corner block with painted red pilasters on the right, a stone bell tower at the west end (the small west outline).
// Not known and not drawn: the roofs behind the fronts (tiles assumed; Sant'Antonio flat), the side and rear walls (plain; Sant'Antonio's flank windows read off its south side), the Tolentino nave width (read off the attic), the Valverde tower height (read off the 2007 photo).
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, panel, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue, archShape } from './lmc-kit.js';

// ---------- shared helpers ----------
const mk = (O, N) => ({
  O, N,
  W: (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]],
  L: (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; },
});
function clipFront(fr, pts, zmax) {
  const L = pts.map(fr.L), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => fr.W(q[0], q[1]));
}
// drawing tools for a front of FW x FH metres on a w x h canvas (x from the middle of the front, y up from the ground)
function tools(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  return {
    X, Y, sx, sy,
    R: (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); },
    arch: (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); },
    point: (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r * 1.4)); g.quadraticCurveTo(X(x - r), Y(y1 - r * 0.6), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(y1 - r * 0.6), X(x + r), Y(y1 - r * 1.4)); g.lineTo(X(x + r), Y(y0)); g.fill(); },
    tri: (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); },
    circ: (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); },
  };
}
// a side bay of 4.5 m (the sides of the body and of the nave): plaster, a pilaster half at each edge, an arched window high up, a cornice
function paintWall(g, w, h, hm, win, seed, C) {
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = C.wall; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 70, 2, seed, ['rgba(150,110,60,0.09)', 'rgba(255,245,215,0.08)']);
  R(0, 0, 0.5, hm, C.stn); R(4.0, 0, 4.5, hm, C.stn);
  if (win) { arch(2.25, hm - 5.4, hm - 1.3, 1.7, C.stn); arch(2.25, hm - 5.15, hm - 1.55, 1.2, '#2b3540'); }
  else { R(0, 0, 4.5, 1.0, '#a98259'); arch(2.25, 4.6, 8.0, 1.4, C.stn); arch(2.25, 4.8, 7.8, 1.0, '#2b3540'); }
  R(0, hm - 0.7, 4.5, hm, C.hi); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(50,30,15,0.28)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '70,50,35');
}
const softShadow = (g, w, h, Y, sy, ys, a) => { for (const y of ys) { const gs = g.createLinearGradient(0, Y(y - 1.4), 0, Y(y - 3.0)); gs.addColorStop(0, `rgba(60,35,15,${a})`); gs.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y - 1.4), w, 1.4 * sy); } };
const groundShadow = (g, w, h, Y, sy) => { const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(40,28,18,0.32)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy); };

// the common build: the outline (clipped at the front) up to EAVE, a nave under a gable roof (or a custom roof), the front as one extruded shape, then the church's own details
function buildChurch(S) {
  initShared();
  const pts = pairsOf(S.p), gr = groundRange(pts), fr = mk(S.O, S.N), W = fr.W;
  const y0 = Math.min(...S.gx.map(([x, z]) => groundY(...W(x, z))));
  const F = frame(S.O[0], y0, S.O[1], S.N[0], S.N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  const hFront = Math.round(384 * S.FH / S.FW);
  defMat(S.pre + 'Front', 384, hFront, [S.FW, S.FH], S.paint);
  defMat(S.pre + 'Body', 128, 256, [4.5, S.EAVE], S.side || ((g, w, h) => paintWall(g, w, h, S.EAVE, false, S.seed, S.C)));
  if (S.nave) defMat(S.pre + 'Nave', 128, 256, [4.5, S.NT - S.EAVE], (g, w, h) => paintWall(g, w, h, S.NT - S.EAVE, true, S.seed + 10, S.C));
  begin(y0);
  const back = S.back || 0, up = S.up || 0;   // a front set back from the outline and standing on a terrace
  const body = clipFront(fr, pts, -0.1 - back);
  prism(S.pre + 'Body', body, Math.min(gr.lo, y0) - 1.5, y0 + S.EAVE, { uvo: [0, -y0 / S.EAVE] });
  prism('flat', body, y0 + S.EAVE, y0 + S.EAVE + 0.12, { c: '#a39a8c' });
  const solids = [[back ? body.flat() : S.p, null, y0 + S.EAVE]];
  if (S.nave) {
    const n = S.nave;
    bx(S.pre + 'Nave', F, n.x0, n.x1, S.EAVE, S.NT, n.z0, n.z1, { uvo: [0, -(y0 + S.EAVE) / (S.NT - S.EAVE)] });
    gable('tile', S.pre + 'Nave', mul(at((n.x0 + n.x1) / 2, 0, (n.z0 + n.z1) / 2), n.rot ? rotY(PI / 2) : tr(0, 0, 0)), n.rot ? n.z0 - n.z1 : n.x1 - n.x0, n.rot ? n.x1 - n.x0 : n.z0 - n.z1, S.NT, n.rise, { ov: 0.35, c: '#b8744f', wc: S.C.wall });
    const ring = [W(n.x0, n.z0), W(n.x1, n.z0), W(n.x1, n.z1), W(n.x0, n.z1)].flat();
    solids.push([ring, null, y0 + S.NT + n.rise]);
  }
  const hw = S.FW / 2, s = new THREE.Shape(); S.shape(s, hw);
  extrude(S.pre + 'Front', s, 1.3, { M: at(0, up, -1.35 - back), uv: 'keep', uvk: [1 / S.FW, 1 / S.FH], uvo: [0.5, 0], cs: 8, noao: true });
  S.extra({ F, at, y0, W, hw, solids });
  const o = end(S.name);
  o.userData.solids = solids;
  return o;
}

// =====================================================================================================
// 1. San Nicolo da Tolentino (front west, 29.8 m; nave 11.4 m wide behind the attic)
// =====================================================================================================
const TL = { id: 'w49772131', p: [131.5, 192.4, 131.9, 194.5, 136.9, 223.9, 188.9, 215.2, 188.2, 210.6, 185.3, 193.8, 174.1, 195.7, 172.1, 183.5, 160.2, 185.5, 160.5, 187.6, 141.8, 190.5] };
const TFW = 29.8, TFH = 21.6, TLOW = 12.4, TUP = 17.0, TNW = 5.7;
const TC = { wall: '#dcb08c', stn: '#d9967a', hi: '#e6b494' };
function paintTol(g, w, h) {
  const { X, Y, sx, sy, R, arch, tri, circ } = tools(g, w, h, TFW, TFH);
  const PEACH = '#e0a583', PEACHH = '#ecbf9f', PEACHD = '#c4876a', PAN = '#cfc1b2', WHITE = '#efe7dc';
  g.fillStyle = PEACH; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 60, 2, 7101, ['rgba(160,100,70,0.08)', 'rgba(255,240,220,0.09)', 'rgba(120,70,50,0.06)']);
  R(-TFW / 2, 0, TFW / 2, 0.9, '#a98259');
  // lower order: panels in the bays, pilasters
  const panel = (x0, x1, y0, y1) => { R(x0 - 0.15, y0 - 0.15, x1 + 0.15, y1 + 0.15, PEACHD); R(x0, y0, x1, y1, PAN); };
  for (const s of [-1, 1]) {
    panel(s * 5.4 - 1.5, s * 5.4 + 1.5, 2.4, 9.0); panel(s * 9.2 - 1.6, s * 9.2 + 1.6, 2.4, 9.0); panel(s * 12.6 - 1.2, s * 12.6 + 1.2, 2.4, 9.0);
    R(s * 4.3 - 0.8, 0.9, s * 4.3 + 0.8, TLOW - 1.7, PEACHH); R(s * 4.3 - 0.8, 0.9, s * 4.3 - 0.65, TLOW - 1.7, 'rgba(255,240,215,0.4)'); R(s * 4.3 + 0.6, 0.9, s * 4.3 + 0.8, TLOW - 1.7, 'rgba(70,35,20,0.3)');
    R(s * 4.3 - 1.05, TLOW - 2.5, s * 4.3 + 1.05, TLOW - 1.7, '#c98d6b'); R(s * 4.3 - 0.95, TLOW - 1.7, s * 4.3 + 0.95, TLOW - 1.45, PEACHH);
    R(s * 14.3 - 0.8, 0.9, s * 14.3 + 0.8, TLOW - 1.7, PEACHH);
  }
  R(-TFW / 2, TLOW - 1.7, TFW / 2, TLOW, PEACHH); R(-TFW / 2, TLOW - 1.7, TFW / 2, TLOW - 1.5, 'rgba(70,35,20,0.4)'); R(-TFW / 2, TLOW - 1.1, TFW / 2, TLOW - 0.5, '#d7a283'); R(-TFW / 2, TLOW - 0.4, TFW / 2, TLOW, PEACHH);
  for (let x = -TFW / 2; x < TFW / 2; x += 0.7) R(x, TLOW - 0.55, x + 0.3, TLOW - 0.3, 'rgba(90,50,30,0.35)');
  // the portal: a stone surround, the dark door, a pediment broken for the statue niche
  R(-2.1, 0.9, 2.1, 6.4, '#d8d3c8'); R(-1.75, 0.9, 1.75, 6.0, '#3a2a20'); R(-0.04, 0.9, 0.04, 6.0, '#241810');
  for (let y = 1.5; y < 5.8; y += 1.4) { R(-1.65, y, -0.1, y + 1.2, 'rgba(0,0,0,0.12)'); R(0.1, y, 1.65, y + 1.2, 'rgba(0,0,0,0.12)'); }
  tri(-3.4, -0.2, 6.4, 1.0, '#c98d6b'); tri(0.2, 3.4, 6.4, 1.0, '#c98d6b'); R(-3.4, 6.3, 3.4, 6.55, '#c98d6b'); R(-0.5, 7.0, 0.5, 7.2, PEACHH);
  arch(0, 7.2, 10.1, 1.8, PEACHH); arch(0, 7.4, 9.9, 1.4, '#9a8672'); R(-0.3, 7.5, 0.3, 9.1, '#e8e2d2'); circ(0, 9.3, 0.3, '#e8e2d2');
  R(-4.0, 10.1, 4.0, 10.45, PEACHH);
  // the attic: two pilasters with the scrolls below, white panels, the arched window with its fan, pediment
  R(-TNW, TLOW, TNW, TUP, PEACH); R(-TNW - 0.1, TLOW, -TNW + 1.0, TUP, PEACHH); R(TNW - 1.0, TLOW, TNW + 0.1, TUP, PEACHH);
  for (const s of [-1, 1]) {
    R(s * 3.6 - 1.2, 13.8, s * 3.6 + 1.2, 16.2, '#e8dfd2'); R(s * 3.6 - 1.2, 13.8, s * 3.6 - 1.05, 16.2, PEACHD); R(s * 3.6 + 1.05, 13.8, s * 3.6 + 1.2, 16.2, PEACHD);
    g.fillStyle = PEACHH; g.beginPath(); g.moveTo(X(s * TNW), Y(TLOW)); g.bezierCurveTo(X(s * (TNW + 1.4)), Y(TLOW), X(s * (TNW + 2.6)), Y(TLOW), X(s * (TNW + 2.6)), Y(TLOW + 0.9)); g.lineTo(X(s * (TNW + 2.6)), Y(TLOW + 1.9)); g.lineTo(X(s * TNW), Y(TLOW + 1.9)); g.fill();
    R(s * (TNW + 1.6) - 0.9, TLOW + 0.3, s * (TNW + 1.6) + 0.9, TLOW + 1.6, '#e8b08e'); R(s * (TNW + 1.6) - 0.55, TLOW + 0.6, s * (TNW + 1.6) + 0.55, TLOW + 1.3, PEACHD);
  }
  R(-1.9, 13.6, 1.9, 14.0, PEACHH); R(-1.7, 14.0, 1.7, 17.9, PEACHD); arch(0, 14.0, 17.9, 3.4, PEACHD);
  R(-1.3, 14.3, 1.3, 16.6, '#2e2a2a'); arch(0, 14.3, 17.6, 2.6, '#2e2a2a'); R(-0.04, 14.3, 0.04, 17.3, '#6b5438'); for (const y of [15.2, 16.2]) R(-1.3, y, 1.3, y + 0.06, '#6b5438');
  R(-TNW, TUP - 0.9, TNW, TUP + 0.1, PEACHH); R(-TNW - 0.4, TUP + 0.1, TNW + 0.4, TUP + 0.55, PEACHH);
  tri(-TNW - 0.5, TNW + 0.5, TUP + 0.55, 3.0, PEACHH); tri(-TNW + 0.4, TNW - 0.4, TUP + 0.8, 2.5, WHITE); circ(0, 19.6, 0.55, '#d4b99c');
  softShadow(g, w, h, Y, sy, [TLOW, TUP + 0.1], 0.3); streaks(g, w, h, 30, 7102, 0.09, 110, '90,50,35'); groundShadow(g, w, h, Y, sy);
}
function buildTolentino() {
  return buildChurch({
    ...TL, pre: 'tn', name: 'Chiesa di San Nicolo da Tolentino', O: [134.4, 209.2], N: [-0.986, 0.168], FW: TFW, FH: TFH, EAVE: TLOW, NT: TUP, seed: 7121, C: TC, paint: paintTol,
    gx: [[-12, 2], [12, 2], [0, 3]],
    nave: { x0: -TNW, x1: TNW, z0: -1.5, z1: -46, rise: 3.6 },
    shape(s, hw) {
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, TLOW); s.lineTo(TNW + 2.6, TLOW); s.lineTo(TNW + 2.6, TLOW + 1.9); s.lineTo(TNW, TLOW + 1.9); s.lineTo(TNW + 0.4, TUP + 0.55);
      s.lineTo(0, TUP + 3.6); s.lineTo(-TNW - 0.4, TUP + 0.55); s.lineTo(-TNW, TLOW + 1.9); s.lineTo(-TNW - 2.6, TLOW + 1.9); s.lineTo(-TNW - 2.6, TLOW); s.lineTo(-hw, TLOW); s.lineTo(-hw, 0);
    },
    extra({ F, at }) {
      const st = '#e0a583';
      bx('flat', F, -hwOf(TFW) - 0.2, hwOf(TFW) + 0.2, TLOW - 0.15, TLOW + 0.15, -1.35, 0.5, { c: '#e8b494', noao: true });
      bx('flat', F, -TNW - 0.5, TNW + 0.5, TUP + 0.1, TUP + 0.4, -1.35, 0.5, { c: '#e8b494', noao: true });
      for (const sg of [-1, 1]) { bx('flat', F, sg * 4.3 - 0.9, sg * 4.3 + 0.9, 0.9, TLOW - 1.7, -0.05, 0.3, { c: st, noao: true }); bx('flat', F, sg * 14.3 - 0.9, sg * 14.3 + 0.9, 0.9, TLOW - 1.7, -0.05, 0.22, { c: st, noao: true }); sphere('flat', 0.4, { M: at(sg * 3.0, 6.9, -0.4), seg: 6, c: '#e8b494' }); }
      bx('stone', F, -2.2, 2.2, -0.2, 0.2, -0.05, 0.6, { c: '#d9d1be' }); bx('stone', F, -2.0, 2.0, 0.2, 0.4, -0.05, 0.3, { c: '#d9d1be' });
      bx('flat', F, -0.12, 0.12, TUP + 3.5, TUP + 5.0, -0.8, -0.55, { c: '#3a3836', noao: true }); bx('flat', F, -0.55, 0.55, TUP + 4.2, TUP + 4.35, -0.8, -0.55, { c: '#3a3836', noao: true });
    },
  });
}
const hwOf = (fw) => fw / 2;

// =====================================================================================================
// 2. San Mattia ai Crociferi (front north-east on the street, 28.9 m; the church 20.5 m on the left, the seminary annex 8.4 m on the right)
// =====================================================================================================
const MT = { id: 'w86882287', p: [987.9, -117.9, 993.9, -121.4, 998.5, -124.1, 1010.3, -131, 1018, -136.7, 1020.7, -133.2, 1023.2, -135.3, 1023.6, -134.4, 1040.7, -111.1, 1004.2, -92.7] };
const MFW = 28.9, MFH = 21.0, MLOW = 9.6, MUP = 17.0, MANN = 17.6, MCX = -4.2, MSPL = 6.0, MBODY = 15.5;
const MC = { wall: '#d6b98c', stn: '#a98a5a', hi: '#c0a272' };
function paintMat(g, w, h) {
  const { X, Y, sx, sy, R, arch, tri, circ } = tools(g, w, h, MFW, MFH);
  const ST = '#ab8c5c', STH = '#c2a674', STD = '#836a42', WH = '#eee8da', GL = '#26303a';
  g.fillStyle = ST; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 30, 2, 7201, ['rgba(110,80,40,0.16)', 'rgba(235,215,170,0.16)', 'rgba(80,60,30,0.12)']);
  for (let y = 0.7; y < MUP + 1; y += 0.62) R(-MFW / 2, y, MSPL, y + 0.05, 'rgba(70,50,25,0.28)');
  R(-MFW / 2, 0, MFW / 2, 0.8, '#7f6a4a');
  const frame = (x, y0, y1, ww) => { R(x - ww / 2 - 0.35, y0 - 0.2, x + ww / 2 + 0.35, y1 + 0.35, STH); R(x - ww / 2, y0, x + ww / 2, y1, GL); R(x - 0.04, y0, x + 0.04, y1, '#5a4631'); R(x - ww / 2, (y0 + y1) / 2, x + ww / 2, (y0 + y1) / 2 + 0.06, '#5a4631'); };
  // church lower order: white panels, pilasters (stone), windows, doors
  const panelW = (x0, x1, y0, y1) => { R(x0, y0, x1, y1, WH); };
  for (const dx of [-8.6, 0.2]) panelW(MCX + dx - 1.6, MCX + dx + 1.6, 2.2, MLOW - 1.8);
  for (const dx of [-12.4, 4.0]) panelW(MCX + dx - 1.0, MCX + dx + 1.0, 1.0, MLOW - 1.8);
  for (const dx of [-8.6, 0.2]) frame(MCX + dx, 3.2, 6.6, 1.5);
  for (const dx of [-12.6, 4.2]) { R(MCX + dx - 0.9, 0.8, MCX + dx + 0.9, 4.0, STH); R(MCX + dx - 0.65, 0.8, MCX + dx + 0.65, 3.7, '#3a2a20'); }
  // portal with a broken pediment and cherubs
  R(MCX - 2.0, 0.8, MCX + 2.0, 6.6, STH); R(MCX - 1.5, 0.8, MCX + 1.5, 6.1, '#2f241b'); R(MCX - 0.04, 0.8, MCX + 0.04, 6.1, '#1c140e');
  tri(MCX - 3.0, MCX - 0.1, 6.6, 1.0, STH); tri(MCX + 0.1, MCX + 3.0, 6.6, 1.0, STH); R(MCX - 1.0, 7.3, MCX + 1.0, 8.4, '#d6c8a6'); circ(MCX, 7.9, 0.45, '#c2b08a');
  for (const sg of [-1, 1]) for (const x of [2.4, 6.5]) { R(MCX + sg * x - 0.6, 0.8, MCX + sg * x + 0.6, MLOW - 1.7, STH); R(MCX + sg * x - 0.6, 0.8, MCX + sg * x - 0.48, MLOW - 1.7, 'rgba(255,240,200,0.35)'); R(MCX + sg * x + 0.45, 0.8, MCX + sg * x + 0.6, MLOW - 1.7, 'rgba(60,40,20,0.35)'); }
  R(-MFW / 2, 0.8, -MFW / 2 + 0.9, MLOW - 1.7, STH); R(MSPL - 0.9, 0.8, MSPL, MLOW - 1.7, STH);
  R(-MFW / 2, MLOW - 1.7, MSPL, MLOW, STH); R(-MFW / 2, MLOW - 1.7, MSPL, MLOW - 1.5, 'rgba(60,40,20,0.4)'); R(-MFW / 2, MLOW - 1.0, MSPL, MLOW - 0.55, STD);
  for (let x = -MFW / 2; x < MSPL; x += 0.55) R(x, MLOW - 0.55, x + 0.25, MLOW - 0.3, 'rgba(60,40,20,0.4)');
  // upper order: the round window in an oval frame, a window each side, pilasters, white panels, pediment with finials
  for (const dx of [-5.9, 5.9]) panelW(MCX + dx - 1.0, MCX + dx + 1.0, MLOW + 0.7, MUP - 1.0);
  panelW(MCX - 4.2, MCX + 4.2, MLOW + 0.7, MUP - 1.0);
  for (const dx of [-4.4, 4.4]) frame(MCX + dx, MLOW + 2.6, MLOW + 6.0, 1.4);
  circ(MCX, MLOW + 5.2, 2.0, STH); circ(MCX, MLOW + 5.2, 1.65, STD); circ(MCX, MLOW + 5.2, 1.25, '#4a3a2a');
  for (const sg of [-1, 1]) for (const x of [2.4, 6.6]) { R(MCX + sg * x - 0.55, MLOW, MCX + sg * x + 0.55, MUP - 0.9, STH); R(MCX + sg * x - 0.55, MLOW, MCX + sg * x - 0.43, MUP - 0.9, 'rgba(255,240,200,0.35)'); }
  R(-MFW / 2, MLOW, -MFW / 2 + 0.8, MUP, STH); R(MSPL - 0.8, MLOW, MSPL, MUP, STH);
  R(-MFW / 2, MUP - 0.9, MSPL, MUP + 0.15, STH); R(-MFW / 2, MUP - 0.9, MSPL, MUP - 0.75, 'rgba(60,40,20,0.4)');
  tri(-MFW / 2, MSPL, MUP + 0.15, 3.2, STH); tri(-MFW / 2 + 1.5, MSPL - 1.5, MUP + 0.4, 2.3, WH);
  // the annex: pale plaster, two floors of arched windows, quoins, a cornice
  R(MSPL, 0, MFW / 2, MANN, '#e2d6b8'); R(MSPL, 0, MSPL + 0.3, MANN, 'rgba(60,40,20,0.35)');
  noiseDots(g, w, h, w * h / 90, 2, 7202, ['rgba(150,110,60,0.08)']);
  R(MSPL, 0, MFW / 2, 0.8, '#7f6a4a'); R(MSPL + 0.3, 0.8, MSPL + 1.0, MANN, STH); R(MFW / 2 - 0.7, 0.8, MFW / 2, MANN, STH);
  for (const x of [8.4, 12.2]) { arch(x, 1.4, 4.8, 1.5, STH); arch(x, 1.6, 4.6, 1.1, GL); arch(x, 6.2, 9.6, 1.5, STH); arch(x, 6.4, 9.4, 1.1, GL); R(x - 0.8, 11.4, x + 0.8, 14.6, STH); R(x - 0.55, 11.6, x + 0.55, 14.4, GL); R(x - 0.8, 15.3, x + 0.8, 16.6, STH); R(x - 0.5, 15.5, x + 0.5, 16.4, GL); }
  R(MSPL, 10.3, MFW / 2, 10.7, STH); R(MSPL, MANN - 0.6, MFW / 2, MANN, STH); R(MSPL, 5.2, MFW / 2, 5.4, 'rgba(70,50,25,0.3)');
  softShadow(g, w, h, Y, sy, [MLOW, MUP + 0.1], 0.32); streaks(g, w, h, 40, 7203, 0.12, 120, '70,50,35'); groundShadow(g, w, h, Y, sy);
}
function buildMattia() {
  return buildChurch({
    ...MT, pre: 'mt', name: 'Chiesa di San Mattia ai Crociferi', O: [1032.15, -122.75], N: [0.806, -0.592], FW: MFW, FH: MFH, EAVE: MBODY, NT: MUP + 0.0, seed: 7221, C: MC, paint: paintMat,
    gx: [[-12, 2], [12, 2], [0, 3]],
    nave: { x0: MCX - 7, x1: MCX + 7, z0: -1.5, z1: -24, rise: 3.3 },
    shape(s, hw) {
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, MANN); s.lineTo(MSPL, MANN); s.lineTo(MSPL, MUP + 0.15); s.lineTo(MCX + 0.9, MUP + 3.35); s.lineTo(-hw, MUP + 0.15); s.lineTo(-hw, 0);
    },
    extra({ F, at }) {
      const st = '#c4a672';
      bx('flat', F, -MFW / 2 - 0.2, MSPL + 0.2, MLOW - 0.15, MLOW + 0.15, -1.35, 0.55, { c: '#cdb284', noao: true });
      bx('flat', F, -MFW / 2 - 0.2, MSPL + 0.2, MUP - 0.0, MUP + 0.3, -1.35, 0.5, { c: '#cdb284', noao: true });
      bx('flat', F, MSPL, MFW / 2 + 0.2, MANN - 0.1, MANN + 0.3, -1.35, 0.4, { c: '#cdb284', noao: true });
      for (const sg of [-1, 1]) for (const x of [2.4, 6.6]) { bx('flat', F, MCX + sg * x - 0.7, MCX + sg * x + 0.7, 0.8, MLOW - 1.7, -0.05, 0.28, { c: st, noao: true }); bx('flat', F, MCX + sg * x - 0.65, MCX + sg * x + 0.65, MLOW, MUP - 0.9, -0.05, 0.22, { c: st, noao: true }); }
      bx('stone', F, MCX - 2.1, MCX + 2.1, -0.2, 0.2, -0.05, 0.6, { c: '#c9b88e' }); bx('stone', F, MCX - 1.9, MCX + 1.9, 0.2, 0.4, -0.05, 0.3, { c: '#c9b88e' });
      for (const sg of [-1, 1]) sphere('flat', 0.45, { M: at(sg === 1 ? MSPL - 0.3 : -MFW / 2 + 0.3, MUP + 0.7, -0.3), seg: 6, c: '#cdb284' });
      sphere('flat', 0.4, { M: at(MCX + 0.9, MUP + 3.6, -0.3), seg: 6, c: '#cdb284' });
    },
  });
}

// =====================================================================================================
// 3. Sant'Antonio abate (front west towards Via Roma, 18.9 m, Gothic Revival, on a balustraded terrace; stone bell tower behind on the right)
// =====================================================================================================
const AN = { id: 'w49864836', tower: 'w279883860', p: [196.7, -158.9, 203.8, -141.4, 212.5, -144.8, 221.2, -148.4, 217, -158.9, 216.2, -160.8, 214.1, -165.9] };
const AN_O = [200.25, -150.15], AN_N = [-0.927, 0.376];
const AN_TOWER = [221.2, -148.4, 222.9, -144.0, 223.4, -142.8, 214.4, -140.8, 212.5, -144.8];
// heights above the street: the terrace floor, then above it the string course, the upper cornice and the parapet top; AN_BACK is how far the front stands behind the terrace wall
const AFW = 18.9, AFH = 13.0, ALOW = 6.5, AUP = 11.4, APAR = 12.6, AN_UP = 3.4, AN_BACK = 2.6;
const AC = { wall: '#c9b08a', stn: '#a98d66', hi: '#d8c298' };
const AN_PORT = [[0, 3.1, 5.1], [-6.2, 2.2, 4.4], [6.2, 2.2, 4.4]];   // [x, width, apex] of the doors
const AN_WIN = [[-5.8, 1.75, 7.0, 9.9], [5.8, 1.75, 7.0, 9.9]];   // [x, width, sill, apex]
function paintAnt(g, w, h) {
  const { X, Y, sx, sy, R, point, circ } = tools(g, w, h, AFW, AFH);
  const ST = '#cdb384', STH = '#dfcaa0', STD = '#8f744d', DOOR = '#5c2e28';
  g.fillStyle = ST; g.fillRect(0, 0, w, h);
  const r = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  // big blocks of sandstone, each its own tone
  for (let y = 0, k = 0; y < AFH; y += 0.62, k++) for (let x = -AFW / 2 - (k % 2) * 0.8, i = 0; x < AFW / 2; x += 1.6, i++) {
    const v = r(k * 31 + i * 7 + 3); R(x, y, x + 1.58, y + 0.6, v < 0.3 ? 'rgba(235,210,160,0.45)' : v < 0.52 ? 'rgba(140,105,65,0.28)' : v < 0.6 ? 'rgba(120,110,95,0.3)' : 'rgba(0,0,0,0)');
    R(x, y, x + 0.04, y + 0.62, 'rgba(80,60,30,0.22)'); R(x, y, x + 1.6, y + 0.04, 'rgba(80,60,30,0.28)');
  }
  noiseDots(g, w, h, w * h / 30, 2, 7301, ['rgba(120,90,50,0.14)', 'rgba(245,230,190,0.14)']);
  // pilaster strips with their long sunk panels
  for (const x of [-8.55, -3.1, 3.1, 8.55]) for (const [a, b] of [[1.2, ALOW - 0.7], [ALOW + 0.5, AUP - 0.55]]) { R(x - 0.6, a - 0.5, x + 0.6, b + 0.4, 'rgba(225,205,160,0.35)'); R(x - 0.36, a, x + 0.36, b, STD); R(x - 0.27, a + 0.08, x + 0.3, b - 0.08, '#d6bf90'); }
  R(-AFW / 2, ALOW - 0.3, AFW / 2, ALOW + 0.2, STH); R(-AFW / 2, ALOW - 0.45, AFW / 2, ALOW - 0.3, 'rgba(60,40,20,0.45)');
  R(-AFW / 2, AUP - 0.35, AFW / 2, AUP + 0.25, STH); R(-AFW / 2, AUP - 0.5, AFW / 2, AUP - 0.35, 'rgba(60,40,20,0.45)');
  for (const x of [-5.8, 0, 5.8]) { R(x - 2.0, AUP + 0.45, x + 2.0, APAR - 0.2, 'rgba(120,90,55,0.22)'); }
  // the portals: three orders of pointed archivolt, colonnettes, a panelled reddish door; tracery over the middle one
  for (const [x, ww, apex] of AN_PORT) {
    point(x, 0, apex + 0.75, ww + 1.2, STH); point(x, 0, apex + 0.5, ww + 0.8, STD); point(x, 0, apex + 0.25, ww + 0.45, '#cbb184'); point(x, 0, apex, ww, '#33201a');
    const dw = ww * 0.72, dh = apex - ww * 0.75;
    R(x - dw / 2, 0, x + dw / 2, dh, DOOR); R(x - 0.035, 0, x + 0.035, dh, '#241210');
    for (let y = 0.35; y < dh - 0.45; y += 0.62) for (const s of [-1, 1]) for (const q of [0.14, 0.34]) { R(x + s * dw * q - 0.12, y, x + s * dw * q + 0.12, y + 0.42, 'rgba(20,6,4,0.35)'); R(x + s * dw * q - 0.07, y + 0.3, x + s * dw * q + 0.07, y + 0.4, 'rgba(255,190,160,0.14)'); }
    R(x - dw / 2 - 0.1, dh, x + dw / 2 + 0.1, dh + 0.18, STH);
    for (const s of [-1, 1]) for (const q of [0.08, 0.3]) { const cx = x + s * (ww / 2 + q); R(cx - 0.07, 0, cx + 0.07, apex - ww * 0.62, '#e2d0a8'); R(cx - 0.12, apex - ww * 0.62 - 0.22, cx + 0.12, apex - ww * 0.62, STD); }
    if (!x) { g.strokeStyle = '#cdb384'; g.lineWidth = Math.max(1, sx * 0.09); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(X(0), Y(dh + 0.2)); g.quadraticCurveTo(X(i * 0.12), Y(dh + 0.8), X(i * 0.36), Y(apex - 0.35 - Math.abs(i) * 0.2)); g.stroke(); } for (const [cx, cy] of [[-0.55, dh + 0.55], [0.55, dh + 0.55], [0, dh + 1.05]]) { g.beginPath(); g.arc(X(cx), Y(cy), 0.27 * sx, 0, 2 * PI); g.stroke(); } }
  }
  // the rose window and the small statue under it
  circ(0, 8.45, 1.15, STH); circ(0, 8.45, 0.98, STD); circ(0, 8.45, 0.82, '#2e2a28'); g.strokeStyle = '#d2bd92'; g.lineWidth = Math.max(1, sx * 0.07);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(0), Y(8.45)); g.lineTo(X(Math.cos(a) * 0.82), Y(8.45 + Math.sin(a) * 0.82)); g.stroke(); g.beginPath(); g.arc(X(Math.cos(a) * 0.6), Y(8.45 + Math.sin(a) * 0.6), 0.17 * sx, 0, 2 * PI); g.stroke(); }
  circ(0, 8.45, 0.2, '#d2bd92');
  for (const [x, ww, sill, apex] of AN_WIN) {
    point(x, sill - 0.1, apex + 0.45, ww + 0.65, STH); point(x, sill, apex + 0.2, ww + 0.25, STD); point(x, sill, apex, ww * 0.84, '#3a241e');
    R(x - 0.04, sill, x + 0.04, apex - 1.0, '#241210'); for (let y = sill + 0.3; y < apex - 1.1; y += 0.3) R(x - ww * 0.36, y, x + ww * 0.36, y + 0.05, 'rgba(150,90,70,0.5)');
    g.strokeStyle = '#d2bd92'; g.lineWidth = Math.max(1, sx * 0.08); for (const [cx, cy, rr] of [[-0.28, apex - 0.85, 0.27], [0.28, apex - 0.85, 0.27], [0, apex - 0.45, 0.2]]) { g.beginPath(); g.arc(X(x + cx), Y(cy), rr * sx, 0, 2 * PI); g.stroke(); }
    for (const s of [-1, 1]) R(x + s * (ww / 2 + 0.12) - 0.07, sill, x + s * (ww / 2 + 0.12) + 0.07, apex - 0.95, '#e2d0a8');
  }
  softShadow(g, w, h, Y, sy, [ALOW + 0.1, AUP + 0.1], 0.25); streaks(g, w, h, 26, 7302, 0.1, 100, '70,50,35'); groundShadow(g, w, h, Y, sy);
}
// the flank: tan plaster, a tall pointed window with its hood in each bay, a drain pipe, the cornice
function paintAnSide(g, w, h) {
  const H = AN_UP + AUP, sx = w / 4.5, sy = h / H, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  g.fillStyle = '#bd9a70'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2.5, 7331, ['rgba(130,85,45,0.14)', 'rgba(240,215,170,0.12)', 'rgba(90,80,70,0.1)']);
  arch(2.25, AN_UP + 4.6, AN_UP + 9.5, 1.75, '#a58a66'); arch(2.25, AN_UP + 4.75, AN_UP + 9.3, 1.35, '#cdb388'); arch(2.25, AN_UP + 4.9, AN_UP + 8.9, 0.85, '#2c2a28');
  R(1.2, AN_UP + 4.35, 3.3, AN_UP + 4.6, '#8f7658');
  R(0.3, 0, 0.46, H - 0.9, '#4e4338');
  R(0, H - 0.55, 4.5, H, '#d3bd94'); R(0, H - 0.8, 4.5, H - 0.55, 'rgba(50,30,15,0.35)');
  R(0, 0, 4.5, AN_UP - 0.2, 'rgba(120,105,90,0.55)'); for (let y = 0.4; y < AN_UP - 0.2; y += 0.5) R(0, y, 4.5, y + 0.05, 'rgba(60,45,30,0.4)');
  streaks(g, w, h, 12, 7332, 0.13, 100, '70,50,35');
}
// a pointed archivolt standing out of a front: the band between two pointed arches, from the springing up
function anHood(M, ww, ys, apex, band, d, c) {
  const path = (s, r, a, rev) => { const h = a - ys; if (!rev) { s.lineTo(-r, ys); s.quadraticCurveTo(-r, ys + h * 0.62, 0, a); s.quadraticCurveTo(r, ys + h * 0.62, r, ys); } else { s.lineTo(r, ys); s.quadraticCurveTo(r, ys + h * 0.62, 0, a); s.quadraticCurveTo(-r, ys + h * 0.62, -r, ys); } };
  const s = new THREE.Shape(); s.moveTo(-ww / 2 - band, ys); path(s, ww / 2 + band, apex + band * 1.4, false); path(s, ww / 2, apex, true); s.lineTo(-ww / 2 - band, ys);
  extrude('flat', s, d, { M, c, cs: 5, noao: true });
}
function buildAntonio() {
  defMat('anRail', 64, 64, [1.05, 1.05], (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#d9cfba'; g.fillRect(0, 0, w, 9); g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, 11, h); g.fillRect(w - 3, 0, 3, h);
    g.strokeStyle = '#c3b69c'; g.lineWidth = 3.2; g.beginPath();
    for (const x of [11, 36]) { g.moveTo(x, 9); g.lineTo(x + 25, h - 10); g.moveTo(x + 25, 9); g.lineTo(x, h - 10); g.moveTo(x + 12.5, 9); g.lineTo(x + 12.5, h - 10); }
    g.moveTo(11, 31.5); g.lineTo(w, 31.5); g.stroke();
  }, { alphaTest: 0.5, side: THREE.DoubleSide });
  return buildChurch({
    ...AN, pre: 'an', name: "Chiesa di Sant'Antonio abate", O: AN_O, N: AN_N, FW: AFW, FH: AFH, EAVE: AN_UP + AUP, NT: 0, seed: 7321, C: AC, paint: paintAnt, side: paintAnSide,
    gx: [[-8, 2], [8, 2], [0, 3]], back: AN_BACK, up: AN_UP,
    shape(s, hw) {
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, APAR); s.lineTo(7.9, APAR); s.lineTo(7.9, APAR - 0.2); s.lineTo(3.75, APAR - 0.2); s.lineTo(3.75, APAR); s.lineTo(2.45, APAR); s.lineTo(2.45, APAR - 0.2);
      s.lineTo(-2.45, APAR - 0.2); s.lineTo(-2.45, APAR); s.lineTo(-3.75, APAR); s.lineTo(-3.75, APAR - 0.2); s.lineTo(-7.9, APAR - 0.2); s.lineTo(-7.9, APAR); s.lineTo(-hw, APAR); s.lineTo(-hw, 0);
    },
    extra({ F, at, y0, solids }) {
      const lit = '#d8c298', pil = '#c6ab7c', U = AN_UP, Z = -AN_BACK;   // U: terrace floor, Z: the face of the front
      const A = (x, y, z) => at(x, U + y, Z + z);
      // relief on the front: pilasters on their plinths, the two cornices, archivolts, the ring of the rose window
      for (const x of [-8.55, -3.1, 3.1, 8.55]) { bx('flat', A(x, 0, 0), -0.55, 0.55, 0, ALOW - 0.4, -0.1, 0.16, { c: pil, noao: true }); bx('flat', A(x, 0, 0), -0.5, 0.5, ALOW + 0.25, AUP - 0.35, -0.1, 0.13, { c: pil, noao: true });
        for (const [a, b] of [[1.25, ALOW - 0.75], [ALOW + 0.6, AUP - 0.65]]) { bx('flat', A(x, 0, 0), -0.29, 0.29, a, b, -0.1, Math.abs(a - 1.25) < 0.01 ? 0.19 : 0.16, { c: '#e0cba2', noao: true }); }
        bx('flat', A(x, 0, 0), -0.75, 0.75, 0, 0.9, -0.1, 0.34, { c: '#bea274', noao: true }); }
      bx('flat', A(0, 0, 0), -AFW / 2 - 0.02, AFW / 2 + 0.02, ALOW - 0.25, ALOW + 0.2, -1.2, 0.38, { c: lit, noao: true });
      bx('flat', A(0, 0, 0), -AFW / 2 - 0.02, AFW / 2 + 0.02, AUP - 0.25, AUP + 0.22, -1.2, 0.45, { c: lit, noao: true });
      for (const x of [-8.55, -3.1, 3.1, 8.55]) bx('flat', A(x, 0, 0), -0.68, 0.68, APAR - 0.12, APAR + 0.12, -1.3, 0.12, { c: lit, noao: true });
      for (const [x, ww, apex] of AN_PORT) { anHood(A(x, 0, -0.02), ww + 0.75, apex - ww * 0.62, apex + 0.42, 0.24, 0.2, lit); for (const s of [-1, 1]) bx('flat', A(x, 0, 0), s * (ww / 2 + 0.5) - 0.13, s * (ww / 2 + 0.5) + 0.13, 0, apex - ww * 0.62, -0.1, 0.17, { c: '#e0cba2', noao: true }); }
      for (const [x, ww, sill, apex] of AN_WIN) { anHood(A(x, 0, -0.02), ww + 0.25, apex - 0.95, apex + 0.18, 0.2, 0.17, lit); bx('flat', A(x, 0, 0), -ww / 2 - 0.4, ww / 2 + 0.4, sill - 0.2, sill, -0.1, 0.24, { c: lit, noao: true }); }
      { const s = new THREE.Shape(); s.absarc(0, 0, 1.2, 0, 2 * PI, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.94, 0, 2 * PI, true); s.holes.push(hole); extrude('flat', s, 0.18, { M: A(0, 8.45, -0.02), c: lit, cs: 10, noao: true }); }
      statue('flat', A(0, ALOW + 0.2, 0.2), 0.85, { c: '#e6e0d0' });
      for (const x of [-3.15, 3.15]) { bx('flat', A(x, 0, 0), -0.55, 0.55, 0, 1.75, -0.05, 0.95, { c: '#cbb890' }); bx('flat', A(x, 0, 0), -0.66, 0.66, 1.75, 1.95, -0.05, 1.05, { c: '#ddcca8' }); statue('flat', A(x, 1.95, 0.5), 2.0, { c: '#ece6d6' }); }
      bx('flat', A(0, 0, 0), -0.45, 0.45, APAR - 0.2, APAR + 0.45, -0.75, -0.15, { c: lit, noao: true });
      bx('flat', A(0, 0, 0), -0.09, 0.09, APAR + 0.45, APAR + 1.75, -0.5, -0.34, { c: '#eee8da', noao: true }); bx('flat', A(0, 0, 0), -0.48, 0.48, APAR + 1.15, APAR + 1.33, -0.5, -0.34, { c: '#eee8da', noao: true });
      // the terrace: retaining wall, string course, the pierced balustrade between stone posts, a shop opening, an arched door, the stair drawn on the wall at the right
      bx('tufa', F, -AFW / 2, AFW / 2, -1.2, U - 0.25, -AN_BACK - 0.2, -0.42, { c: '#a4967e' });
      bx('flat', F, -AFW / 2, AFW / 2, U - 0.25, U + 0.04, -AN_BACK - 0.2, -0.08, { c: '#bdb096' });
      panel('anRail', AFW, 1.05, { M: at(0, U + 0.04, -0.3), uvk: [18, 1], c: '#d6ccb8' });
      for (let i = 0; i <= 6; i++) { const x = -AFW / 2 + 0.22 + i * (AFW - 0.44) / 6; bx('flat', F, x - 0.22, x + 0.22, U + 0.04, U + 1.14, -0.46, -0.12, { c: '#c0b49c', noao: true }); }
      bx('flat', F, -AFW / 2, AFW / 2, U + 1.07, U + 1.2, -0.42, -0.18, { c: '#c9bea6', noao: true });
      for (const [x, ww, hh] of [[-6.4, 2.7, 2.35], [-3.3, 1.4, 2.35]]) { bx('dark', F, x - ww / 2, x + ww / 2, 0, hh, -0.5, -0.39, { c: '#241c18', noao: true }); bx('flat', F, x - ww / 2 - 0.15, x + ww / 2 + 0.15, hh, hh + 0.42, -0.5, -0.28, { c: '#8e2f28', noao: true }); }
      extrude('dark', archShape(1.5, 2.5), 0.1, { M: at(1.2, 0, -0.47), c: '#2a201a', cs: 6, noao: true }); anHood(at(1.2, 0, -0.43), 1.5, 1.7, 2.5, 0.18, 0.12, '#bfae8e');
      { const x0 = 3.4, x1 = AFW / 2 - 0.05, top = U - 0.1, s = new THREE.Shape(); s.moveTo(x0, -0.3); s.lineTo(x1, -0.3); s.lineTo(x1, 0.35); s.lineTo(x0, top); s.lineTo(x0, -0.3);
        extrude('tufa', s, 0.36, { M: at(0, 0, -0.43), c: '#b2a48a' });
        const len = Math.hypot(x1 - x0, top - 0.35), M = mul(at((x0 + x1) / 2, (top + 0.35) / 2, -0.1), new THREE.Matrix4().makeRotationZ(-Math.atan2(top - 0.35, x1 - x0)));
        panel('anRail', len, 0.9, { M: mul(M, tr(0, 0.04, -0.02)), uvk: [len, 1], c: '#d6ccb8' }); bx('flat', M, -len / 2, len / 2, 0.9, 1.04, -0.1, 0.06, { c: '#c9bea6', noao: true }); bx('flat', M, -len / 2, len / 2, -0.14, 0.06, -0.1, 0.08, { c: '#c0b49c', noao: true });
        for (const k of [0.02, 0.5, 0.98]) { const x = x0 + (x1 - x0) * k, y = top + (0.35 - top) * k; bx('flat', F, x - 0.16, Math.min(x + 0.16, AFW / 2), y - 0.05, y + 1.1, -0.16, -0.02, { c: '#c0b49c', noao: true }); } }
      // the flanks: cornice and low parapet
      for (const [a, b] of [[[-9.45, -AN_BACK - 1.3], [-9.39, -18.76]], [[9.45, -AN_BACK - 1.3], [9.5, -9.34]]]) { const x = (a[0] + b[0]) / 2, sg = Math.sign(x); bx('flat', F, x - 0.25 + sg * 0.0, x + 0.25, U + AUP - 0.15, U + AUP + 0.55, b[1], a[1], { c: '#c9ad82', noao: true }); }
      // the bell tower: its outline carried up as a lower block, then the square shaft with clock and shuttered window, and the open belfry between four piers
      const T = pairsOf(AN_TOWER), tgr = groundRange(T);
      prism('tufa', T, Math.min(tgr.lo, y0) - 1.5, y0 + 12.2, { c: '#c6b494' });
      prism('flat', T, y0 + 12.2, y0 + 12.35, { c: '#a39a8c' });
      const tx0 = 9.62, tx1 = 14.35, tz0 = -14.6, tz1 = -9.7, cx = (tx0 + tx1) / 2, cz = (tz0 + tz1) / 2, SH = 21.6, TH = 26.8, C = '#cabc9e';
      bx('tufa', F, tx0, tx1, 12.0, SH, tz0, tz1, { c: C });
      for (const y of [14.6, 19.5, SH - 0.1]) bx('flat', F, tx0 - 0.14, tx1 + 0.14, y, y + 0.28, tz0 - 0.14, tz1 + 0.14, { c: '#a89374', noao: true });
      for (const [a, b] of [[tx0, tx0 + 1.45], [tx1 - 1.45, tx1]]) for (const [c, d] of [[tz0, tz0 + 1.45], [tz1 - 1.45, tz1]]) { bx('tufa', F, a, b, SH, TH, c, d, { c: C }); bx('flat', F, a - 0.08, b + 0.08, TH, TH + 0.3, c - 0.08, d + 0.08, { c: '#a89374', noao: true }); bx('flat', F, a + 0.4, b - 0.4, TH + 0.3, TH + 0.6, c + 0.4, d - 0.4, { c: '#b7a184', noao: true }); }
      bx('tufa', F, tx0 + 0.05, tx1 - 0.05, SH, SH + 1.0, tz0 + 0.05, tz1 - 0.05, { c: '#bcae92' });
      for (const z of [tz0 + 0.7, tz1 - 0.7]) bx('dark', F, tx0 + 1.3, tx1 - 1.3, TH - 0.7, TH - 0.5, z - 0.08, z + 0.08, { c: '#33291f', noao: true });
      for (const x of [tx0 + 0.7, tx1 - 0.7]) bx('dark', F, x - 0.08, x + 0.08, TH - 0.7, TH - 0.5, tz0 + 1.3, tz1 - 1.3, { c: '#33291f', noao: true });
      bx('bronze', F, cx - 0.5, cx + 0.5, SH + 2.6, SH + 3.7, cz - 0.5, cz + 0.5, { c: '#3f4438', noao: true }); bx('dark', F, cx - 0.12, cx + 0.12, SH + 3.7, TH - 0.5, cz - 0.12, cz + 0.12, { c: '#33291f', noao: true });
      for (const [M] of [[at(cx, 0, tz1)], [mul(at(tx0, 0, cz), rotY(-PI / 2))], [mul(at(tx1, 0, cz), rotY(PI / 2))]]) {
        extrude('flat', archShape(1.75, 2.75), 0.08, { M: mul(M, tr(0, 14.9, -0.03)), c: '#b49d7c', cs: 6, noao: true });
        extrude('dark', archShape(1.25, 2.45), 0.1, { M: mul(M, tr(0, 14.92, -0.02)), c: '#6e3f2a', cs: 6, noao: true });
        bx('dark', M, -0.03, 0.03, 14.95, 17.2, 0.07, 0.1, { c: '#2a160e', noao: true });
        const face = (r, d, c) => extrude('flat', new THREE.Shape().absarc(0, 0, r, 0, 2 * PI, false), d, { M: mul(M, tr(0, 18.3, -0.02)), c, cs: 10, noao: true });
        face(0.78, 0.08, '#6b5c46'); face(0.66, 0.11, '#ede7d8');
        bx('dark', M, -0.04, 0.04, 18.3, 18.85, 0.09, 0.12, { c: '#222018', noao: true }); bx('dark', M, 0, 0.4, 18.27, 18.34, 0.09, 0.12, { c: '#222018', noao: true });
      }
      solids.push([AN_TOWER, null, y0 + 12.2], [[[tx0, tz0], [tx1, tz0], [tx1, tz1], [tx0, tz1]].flatMap(([x, z]) => [AN_O[0] + x * AN_N[1] + z * AN_N[0], AN_O[1] - x * AN_N[0] + z * AN_N[1]]), null, y0 + SH]);
    },
  });
}

// =====================================================================================================
// 4. Santa Maria di Valverde (front the long south wall, 27.5 m; bell tower at the west end)
// =====================================================================================================
const VL = { id: 'w279882881', p: [204.6, -507, 208.2, -508.8, 212.7, -509.9, 212.4, -511, 233.2, -515.1, 240.4, -516.5, 242.7, -505.5, 229.4, -502.8, 224.4, -501.6, 215.2, -499.6, 214.8, -500.2, 210.4, -499.4, 207, -499.4, 203.9, -502.8] };
const VFW = 27.5, VFH = 12.4, VEAVE = 11.2, VPX = 0.0;
const VC = { wall: '#dba98f', stn: '#e4c4a8', hi: '#ead2b8' };
function paintVal(g, w, h) {
  const { X, Y, sx, sy, R, arch, circ } = tools(g, w, h, VFW, VFH);
  const PINK = '#dca88e', CREAM = '#eadcc0', GREY = '#9c9c98', GREYH = '#b6b6b0', GL = '#3a342f';
  g.fillStyle = PINK; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 55, 2, 7401, ['rgba(150,90,60,0.09)', 'rgba(255,235,215,0.1)', 'rgba(120,70,50,0.07)']);
  for (let i = 0; i < 5; i++) { const cx = X(-12 + i * 5.5), cy = Y(3 + (i % 3) * 3), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * sx); gr.addColorStop(0, 'rgba(150,100,70,0.16)'); gr.addColorStop(1, 'rgba(150,100,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-VFW / 2, 0, VFW / 2, 0.9, '#9c7a62');
  // thin vertical drain pipe lines, the cornice
  R(-VFW / 2, VEAVE - 0.8, VFW / 2, VEAVE + 0.1, '#e9c9b0'); R(-VFW / 2, VEAVE - 0.8, VFW / 2, VEAVE - 0.68, 'rgba(70,40,25,0.4)');
  // the two arched windows high up (shuttered), one over the portal
  for (const x of [-9.6, 0.4]) { arch(x, 6.7, 10.0, 2.1, CREAM); arch(x, 6.85, 9.85, 1.7, '#7a5a40'); for (let k = -3; k <= 3; k++) R(x + k * 0.22 - 0.02, 6.9, x + k * 0.22 + 0.02, 9.6, 'rgba(40,25,15,0.5)'); }
  // the portal: a grey stone surround with two pilasters, scrolls and a shield above
  R(-1.1 + VPX - 1.0, 0.9, 1.1 + VPX + 1.0, 5.6, GREYH);
  const px = VPX + 0.4;
  R(px - 2.2, 0.9, px + 2.2, 5.6, GREYH); R(px - 1.55, 0.9, px + 1.55, 5.0, '#5a3a24'); arch(px, 3.6, 5.2, 3.1, '#5a3a24'); R(px - 0.04, 0.9, px + 0.04, 5.0, '#2a1810');
  for (let y = 1.3; y < 4.8; y += 0.95) { R(px - 1.45, y, px - 0.1, y + 0.8, 'rgba(0,0,0,0.12)'); R(px + 0.1, y, px + 1.45, y + 0.8, 'rgba(0,0,0,0.12)'); }
  R(px - 2.4, 5.6, px + 2.4, 6.1, GREY); R(px - 0.9, 6.1, px + 0.9, 7.3, '#d8cfb8'); circ(px, 7.8, 0.75, '#d8cfb8'); circ(px - 1.9, 6.9, 0.5, GREYH); circ(px + 1.9, 6.9, 0.5, GREYH);
  // the cream corner block on the right with painted red pilasters
  R(8.4, 0, VFW / 2, VEAVE + 0.1, CREAM); R(8.4, 0, 8.55, VEAVE, 'rgba(90,50,30,0.35)'); R(8.4, 0, VFW / 2, 0.9, '#a98f74');
  for (const x of [9.6, 12.0]) R(x - 0.3, 1.0, x + 0.3, VEAVE - 1.0, '#c9604e');
  R(8.9, 4.6, 11.4, 8.4, '#d6a28e'); R(9.1, 4.8, 11.2, 8.2, '#c9604e'); circ(10.15, 6.5, 0.7, '#e8c9a0');
  R(12.6, 1.0, 13.7, 5.8, '#3a2a20'); R(12.4, 5.8, 13.9, 6.1, GREYH);
  softShadow(g, w, h, Y, sy, [VEAVE + 0.1], 0.25); streaks(g, w, h, 30, 7402, 0.09, 100, '90,55,40'); groundShadow(g, w, h, Y, sy);
}
function buildValverde() {
  return buildChurch({
    ...VL, pre: 'vv', name: 'Chiesa di Santa Maria di Valverde', O: [228.95, -502.55], N: [0.21, 0.978], FW: VFW, FH: VFH, EAVE: VEAVE, NT: VEAVE + 1.5, seed: 7421, C: VC, paint: paintVal,
    gx: [[-8, 2], [8, 2], [0, 3]],
    nave: { x0: -13.0, x1: 13.0, z0: -1.2, z1: -11.0, rise: 2.4, rot: true },
    shape(s, hw) { s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, VEAVE + 0.1); s.lineTo(-hw, VEAVE + 0.1); s.lineTo(-hw, 0); },
    extra({ F, at }) {
      bx('flat', F, -VFW / 2 - 0.2, VFW / 2 + 0.2, VEAVE - 0.1, VEAVE + 0.3, -1.35, 0.45, { c: '#ecd0b8', noao: true });
      bx('stone', F, -1.85, 2.65, -0.2, 0.2, -0.05, 0.6, { c: '#b8b4aa' });
      for (const x of [-1.8, 2.6]) { bx('flat', F, x - 0.45, x + 0.45, 0.9, 5.6, -0.05, 0.3, { c: '#a8a8a2', noao: true }); }
      // the bell tower at the west end (stone, belfry with dark openings, a balustrade crown)
      const x0 = -24.0, x1 = -15.0, z0 = -11.5, z1 = -1.5, TH = 20.0;
      bx('stone', F, x0, x1, 0, TH, z0, z1, { c: '#d9bd86' });
      bx('flat', F, x0 - 0.25, x1 + 0.25, TH, TH + 0.5, z0 - 0.25, z1 + 0.25, { c: '#cdb078' });
      bx('flat', F, x0 - 0.1, x1 + 0.1, TH + 0.5, TH + 1.5, z0 - 0.1, z0 + 0.3, { c: '#c4a670' }); bx('flat', F, x0 - 0.1, x1 + 0.1, TH + 0.5, TH + 1.5, z1 - 0.3, z1 + 0.1, { c: '#c4a670' });
      bx('flat', F, x0 - 0.1, x0 + 0.3, TH + 0.5, TH + 1.5, z0, z1, { c: '#c4a670' }); bx('flat', F, x1 - 0.3, x1 + 0.1, TH + 0.5, TH + 1.5, z0, z1, { c: '#c4a670' });
      bx('dark', F, x0 + 2.0, x1 - 2.0, TH - 5.0, TH - 1.4, z1, z1 + 0.06, { c: '#2a1f18', noao: true });
      bx('dark', F, x1, x1 + 0.06, TH - 5.0, TH - 1.4, z0 + 2.5, z1 - 2.5, { c: '#2a1f18', noao: true });
      bx('flat', F, x0 - 0.2, x1 + 0.2, 9.8, 10.2, z0 - 0.2, z1 + 0.2, { c: '#cdb078' });
    },
  });
}

export const BATCH_C = [
  { name: 'Chiesa di San Nicolo da Tolentino', x: 160, z: 205, radius: 50, skipIds: [TL.id], build: buildTolentino },
  { name: 'Chiesa di San Mattia e Noviziato dei Crociferi', x: 1014, z: -113, radius: 50, skipIds: [MT.id], build: buildMattia },
  { name: "Chiesa di Sant'Antonio abate", x: 208, z: -152, radius: 40, skipIds: [AN.id, AN.tower], build: buildAntonio },
  { name: 'Chiesa di Santa Maria di Valverde', x: 222, z: -508, radius: 45, skipIds: [VL.id], build: buildValverde },
];
