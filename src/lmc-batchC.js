// City landmarks, batch C: Chiesa di San Nicolo da Tolentino (w49772131), Chiesa di San Mattia e Noviziato dei Crociferi (w86882287), Chiesa di Sant'Antonio abate (w49864836), Chiesa di Santa Maria di Valverde (w279882881).
// Registered in src/landmarks-city.js (BATCH_C). Each church: frame F with the origin on the ground in the middle of the front, +z out of the front, local x along the front; the front is one painted shape, the rest is the outline (clipped at the front) under a nave with a gable roof.
// Reference photos (Wikimedia Commons, looked at, nothing copied; the fronts were measured from them and then drawn procedurally):
// San Nicolo da Tolentino: Chiesa di San Nicolo da Tolentino (Palermo) - facciata1.JPG. Salmon-peach plaster, a lower order with a pedimented portal (statue niche over it) between two pilasters with Corinthian capitals, pale grey panels,
//   an inscription frieze, a narrower attic with a big arched window, white panels, side scrolls (volutes) and a triangular pediment with a cross. Front is the 29.8 m run of the outline on the street to the west.
// San Mattia ai Crociferi: San Mattia facciata.jpg; San Mattia ai Crociferi, Palermo.jpg; San Mattia ai Crociferi (Palermo) 14 07 2024 01.jpg. Golden tufa stone with white plaster panels, two orders: a central portal with a broken pediment between paired pilasters,
//   a framed window each side and a small door at each end, a dentil cornice; upper order with a round window in an oval frame, a framed window each side, a triangular pediment with finials; to the right a lower plain annex of the seminary in two floors of arched windows.
// Sant'Antonio abate: Chiesa di Sant'Antonio Abate (Palermo) - facciata1.JPG; facciata2.JPG; esterno3.JPG. Gothic Revival front in sandy stone, two orders: three pointed portals (the middle one big, two statues on pedestals), a rose window with a small statue under it
//   and a pointed window each side in the upper order, pilaster strips, a flat parapet with a cross; a stone bell tower stands behind on the right. A balustraded terrace in front (not drawn).
// Santa Maria di Valverde: Palermo-Maria-Valverde-bjs2007-01.jpg; Santa Maria in Valverde esterno.jpg; Santa Maria in Valverde (Palermo) 25 10 2020 01.jpg. Pink plastered flank (the long south wall) with a grey stone baroque portal (volutes, a shield),
//   two arched windows high up, a cream corner block with painted red pilasters on the right, a stone bell tower at the west end (the small west outline).
// Not known and not drawn: the roofs behind the fronts (tiles assumed), the side and rear walls (plain), the Tolentino nave width (read off the attic), the Valverde tower height (read off the 2007 photo), the staircase terrace of Sant'Antonio.
import * as THREE from 'three';
import { PI, bx, sphere, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue } from './lmc-kit.js';

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
  defMat(S.pre + 'Body', 128, 256, [4.5, S.EAVE], (g, w, h) => paintWall(g, w, h, S.EAVE, false, S.seed, S.C));
  defMat(S.pre + 'Nave', 128, 256, [4.5, S.NT - S.EAVE], (g, w, h) => paintWall(g, w, h, S.NT - S.EAVE, true, S.seed + 10, S.C));
  begin(y0);
  const body = clipFront(fr, pts, -0.1);
  prism(S.pre + 'Body', body, Math.min(gr.lo, y0) - 1.5, y0 + S.EAVE, { uvo: [0, -y0 / S.EAVE] });
  prism('flat', body, y0 + S.EAVE, y0 + S.EAVE + 0.12, { c: '#a39a8c' });
  const solids = [[S.p, null, y0 + S.EAVE]];
  if (S.nave) {
    const n = S.nave;
    bx(S.pre + 'Nave', F, n.x0, n.x1, S.EAVE, S.NT, n.z0, n.z1, { uvo: [0, -(y0 + S.EAVE) / (S.NT - S.EAVE)] });
    gable('tile', S.pre + 'Nave', mul(at((n.x0 + n.x1) / 2, 0, (n.z0 + n.z1) / 2), n.rot ? rotY(PI / 2) : tr(0, 0, 0)), n.rot ? n.z0 - n.z1 : n.x1 - n.x0, n.rot ? n.x1 - n.x0 : n.z0 - n.z1, S.NT, n.rise, { ov: 0.35, c: '#b8744f', wc: S.C.wall });
    const ring = [W(n.x0, n.z0), W(n.x1, n.z0), W(n.x1, n.z1), W(n.x0, n.z1)].flat();
    solids.push([ring, null, y0 + S.NT + n.rise]);
  }
  const hw = S.FW / 2, s = new THREE.Shape(); S.shape(s, hw);
  extrude(S.pre + 'Front', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / S.FW, 1 / S.FH], uvo: [0.5, 0], cs: 8, noao: true });
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
// 3. Sant'Antonio abate (front south, 18.7 m, Gothic Revival; stone bell tower behind on the right)
// =====================================================================================================
const AN = { id: 'w49864836', p: [196.7, -158.9, 203.8, -141.4, 212.5, -144.8, 221.2, -148.4, 217, -158.9, 216.2, -160.8, 214.1, -165.9] };
const AFW = 18.7, AFH = 14.0, ALOW = 6.6, AUP = 12.2;
const AC = { wall: '#d2b788', stn: '#b99a68', hi: '#cdb284' };
function paintAnt(g, w, h) {
  const { X, Y, sx, sy, R, point, circ } = tools(g, w, h, AFW, AFH);
  const ST = '#cdb07e', STH = '#dcc394', STD = '#9a7e52', GL = '#26303a', DK = '#34261c';
  g.fillStyle = ST; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 25, 2, 7301, ['rgba(120,90,50,0.16)', 'rgba(240,225,180,0.16)', 'rgba(90,65,35,0.12)']);
  for (let y = 0.6; y < AUP + 1.4; y += 0.55) R(-AFW / 2, y, AFW / 2, y + 0.05, 'rgba(80,60,30,0.3)');
  for (let y = 0.6, r = 0; y < AUP + 1.4; y += 0.55, r++) for (let x = -AFW / 2 + (r % 2) * 0.9; x < AFW / 2; x += 1.8) R(x, y, x + 0.04, y + 0.55, 'rgba(80,60,30,0.2)');
  R(-AFW / 2, 0, AFW / 2, 0.6, '#8a7656');
  // pilaster strips (flat, slightly lighter, with a dark slot) and the two string courses
  for (const x of [-8.7, -4.3, 4.3, 8.7]) { R(x - 0.5, 0, x + 0.5, AUP, STH); R(x - 0.18, 0.8, x + 0.18, ALOW - 0.9, STD); if (Math.abs(x) > 5) R(x - 0.18, ALOW + 1.0, x + 0.18, AUP - 0.9, STD); }
  R(-AFW / 2, ALOW - 0.35, AFW / 2, ALOW + 0.25, STH); R(-AFW / 2, ALOW - 0.35, AFW / 2, ALOW - 0.25, 'rgba(60,40,20,0.4)');
  R(-AFW / 2, AUP - 0.5, AFW / 2, AUP + 0.45, STH); for (let x = -AFW / 2; x < AFW / 2; x += 0.9) R(x, AUP - 0.35, x + 0.4, AUP - 0.1, 'rgba(60,40,20,0.35)');
  // lower portals, pointed: the middle one big with a tracery fan, the two sides smaller
  const portal = (x, ww, hh) => { point(x, 0.6, hh + 0.6, ww + 1.1, STH); point(x, 0.6, hh + 0.4, ww + 0.5, STD); point(x, 0.6, hh, ww, DK); };
  portal(0, 2.6, 4.8); portal(-6.6, 1.9, 3.6); portal(6.6, 1.9, 3.6);
  g.strokeStyle = 'rgba(190,170,130,0.9)'; g.lineWidth = Math.max(1, sx * 0.07); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(X(0), Y(4.3)); g.lineTo(X(i * 0.34), Y(5.1)); g.stroke(); }
  R(-0.04, 0.6, 0.04, 3.4, '#241810'); for (const x of [-6.6, 6.6]) R(x - 0.04, 0.6, x + 0.04, 2.6, '#241810');
  // upper order: the rose window with a small statue under it, a pointed window each side
  circ(0, 9.6, 1.5, STH); circ(0, 9.6, 1.2, STD); circ(0, 9.6, 1.0, '#3a3430'); g.strokeStyle = 'rgba(200,185,150,0.95)'; g.lineWidth = Math.max(1, sx * 0.08);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI; g.beginPath(); g.moveTo(X(0), Y(9.6)); g.lineTo(X(Math.cos(a) * 1.0), Y(9.6 + Math.sin(a) * 1.0)); g.stroke(); }
  circ(0, 9.6, 0.5, '#d8cdb0'); R(-0.12, 7.2, 0.12, 8.0, '#e6e0d0'); circ(0, 8.2, 0.14, '#e6e0d0');
  for (const x of [-6.5, 6.5]) { point(x, 7.8, 11.4, 2.0, STH); point(x, 7.9, 11.3, 1.6, STD); point(x, 8.0, 11.1, 1.3, GL); R(x - 0.04, 8.0, x + 0.04, 10.4, '#6b5a40'); R(x - 0.5, 9.2, x + 0.5, 9.26, '#6b5a40'); }
  // the parapet: three plain panels
  for (const x of [-6.5, 0, 6.5]) R(x - 2.4, AUP + 0.55, x + 2.4, AUP + 1.2, 'rgba(110,80,45,0.3)');
  softShadow(g, w, h, Y, sy, [ALOW + 0.2, AUP + 0.45], 0.3); streaks(g, w, h, 26, 7302, 0.1, 100, '70,50,35'); groundShadow(g, w, h, Y, sy);
}
function buildAntonio() {
  return buildChurch({
    ...AN, pre: 'an', name: "Chiesa di Sant'Antonio abate", O: [212.5, -144.9], N: [0.373, 0.927], FW: AFW, FH: AFH, EAVE: AUP, NT: AUP + 1.5, seed: 7321, C: AC, paint: paintAnt,
    gx: [[-8, 2], [8, 2], [0, 3]],
    nave: { x0: -5.5, x1: 5.5, z0: -1.5, z1: -14, rise: 2.8 },
    shape(s, hw) {
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, AUP + 1.2); s.lineTo(-hw, AUP + 1.2); s.lineTo(-hw, 0);
    },
    extra({ F, at }) {
      const stn = '#d6bb8a';
      bx('flat', F, -AFW / 2 - 0.15, AFW / 2 + 0.15, AUP + 0.45, AUP + 0.75, -1.35, 0.4, { c: '#dcc394', noao: true });
      bx('flat', F, -AFW / 2 - 0.1, AFW / 2 + 0.1, ALOW - 0.3, ALOW + 0.25, -1.35, 0.25, { c: '#dcc394', noao: true });
      for (const x of [-8.7, -4.3, 4.3, 8.7]) bx('flat', F, x - 0.5, x + 0.5, 0.6, AUP, -0.05, 0.2, { c: stn, noao: true });
      for (const x of [-1.9, 1.9]) { bx('stone', F, x - 0.45, x + 0.45, 0.0, 0.5, 0.1, 0.9, { c: '#d6c9a8' }); statue('flat', at(x, 0.5, 0.5), 2.1, { c: '#ece6d6' }); }
      bx('flat', F, -0.12, 0.12, AUP + 0.7, AUP + 2.0, -0.8, -0.55, { c: '#e6e0d0', noao: true }); bx('flat', F, -0.5, 0.5, AUP + 1.3, AUP + 1.45, -0.8, -0.55, { c: '#e6e0d0', noao: true });
      // the bell tower behind on the right: sandy stone, a belfry with dark openings, a crown
      const tx0 = 4.0, tx1 = 9.2, tz0 = -9.5, tz1 = -4.5, TH = 16.0;
      bx('anBody', F, tx0, tx1, 0, TH, tz0, tz1, {});
      bx('flat', F, tx0 - 0.2, tx1 + 0.2, TH, TH + 0.4, tz0 - 0.2, tz1 + 0.2, { c: '#bfa270' });
      for (const [a, b] of [[tx0 + 0.2, tx0 + 1.2], [tx1 - 1.2, tx1 - 0.2]]) for (const [c, d] of [[tz0 + 0.2, tz0 + 1.2], [tz1 - 1.2, tz1 - 0.2]]) bx('flat', F, a, b, TH + 0.4, TH + 1.4, c, d, { c: '#bfa270' });
      for (const z of [tz1 + 0.01]) bx('dark', F, tx0 + 1.2, tx1 - 1.2, TH - 4.2, TH - 0.8, z, z + 0.06, { c: '#2a1f18', noao: true });
      bx('dark', F, tx0 - 0.04, tx0 + 0.02, TH - 4.2, TH - 0.8, tz0 + 1.2, tz1 - 1.2, { c: '#2a1f18', noao: true });
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
  { name: "Chiesa di Sant'Antonio abate", x: 208, z: -152, radius: 40, skipIds: [AN.id], build: buildAntonio },
  { name: 'Chiesa di Santa Maria di Valverde', x: 222, z: -508, radius: 45, skipIds: [VL.id], build: buildValverde },
];
