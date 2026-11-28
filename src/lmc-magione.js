// City landmark: La Magione (Chiesa della Santissima Trinita, Palermo, 12th century Norman). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49769029. Frame F: origin on the ground in the middle of the front (the 15.8 m edge from point 0 to point 2, facing the garden to the west-north-west), +z out of the front.
// Reference photos (Wikimedia Commons, looked at, nothing copied): "Chiesa della magione o della ss trinita2008.jpg", "Magione - facade.jpg", "Palermo-Magione-bjs-1.jpg", "La Magione Palermo.JPG", and for the south flank and the east end: "La Magione (Palermo) - Exterior-msu-0686.jpg".
// Read from them: a flat wide front of golden sand-coloured limestone in even courses, as tall as it is wide at the gable (aisle wall about 0.66 of the width, ridge about 0.96);
// three pointed portals on the ground (a big one in the middle with a ring of chevron voussoirs and a hood, a smaller one each side); a middle row of five pointed blind arches, the two outer ones holding a barred window;
// the nave rising in the middle as a block about half the front wide, with three nested pointed arches (the middle one a window) and a very low gable.
// The south flank: the aisle wall with big blind arches on the ground and windows in pointed arches over them, the nave's clerestory above; the eastern part stands up as one tall flat topped wall
// with three rows of pointed arches (five on the ground, the first holding a small door; two windows and two blind ones; four windows and one blind one), a low flat block on its roof at the east end,
// and beyond it a rounded apse a little lower, with two rows of narrow blind arches.
// Not verified: the north flank (the aisle bays are repeated there, the tall part is plain), the faces of the tall part and of the roof block that the photo does not show (plain), the depth of the roof block,
// the middle of the back of the apse, any side apses (none drawn), the roofs, the cloister. No dome, lantern or tower over the crossing shows in the photos, so none is drawn beyond that flat block.
import * as THREE from 'three';
import { PI, bx, panel, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

const MG = { id: 'w49769029', p: [659.8, 237, 665.1, 242.4, 670.8, 248.3, 683.5, 236.4, 685.2, 234.8, 693.8, 226.6, 691, 223.9, 691.2, 220.1, 688.9, 218, 685.2, 218.1, 682.4, 215.2, 673.3, 223.6] };
const O = [665.3, 242.65], N = [-0.7165, 0.6975];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {   // the footprint cut off where it stands out in front of the front (Sutherland-Hodgman against z = zmax, keeping z <= zmax)
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FW = 15.8, HM = 10.4, HR = 13.9, APEX = 15.2, NX = 0.35, NHW = 3.8, NZ1 = -0.45;
const TZ = -18.4, HT = 14.4, AH = 13.0;   // the tall eastern part: where it starts, its roof, the top of the apse
const AW = 13.2, PW = 1.6, CW = 4.6, TW = AW + PW + CW;   // the east atlas, metres across: the tall wall, one apse face, one clerestory bay over plain ashlar
const STONE = '#cdb68a', JOINT = '#a69171', DOOR = '#2b211b', GRATE = '#6e4129', LIGHT = '#dcc99d';

function paintFront(g, w, h) {   // 15.8 x 15.8 m
  const sx = w / FW, sy = h / FW, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  // pointed arch of half width a on springing height ys: a filled region (apex = ys + 1.732 a), built from two arcs of radius 2a
  const arch = (cx, ys, a, y0, c) => {
    const Rr = 2 * a, n = 16; g.fillStyle = c; g.beginPath(); g.moveTo(X(cx - a), Y(y0)); g.lineTo(X(cx - a), Y(ys));
    for (let i = 1; i <= n; i++) { const ang = PI - (PI / 3) * (i / n); g.lineTo(X(cx + a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    for (let i = 1; i <= n; i++) { const ang = (PI / 3) * (1 - i / n); g.lineTo(X(cx - a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    g.lineTo(X(cx + a), Y(y0)); g.closePath(); g.fill();
  };
  // a ring of chevron voussoirs round an opening: inner half width a, thickness t, alternating light and dark wedges (each half drawn about the springing point of the other)
  const ring = (cx, ys, a, t) => {
    const Ri = 2 * a, Ro = Ri + t, n = 20;
    for (const s of [-1, 1]) {
      g.save(); g.beginPath(); if (s > 0) g.rect(X(cx), 0, w, h); else g.rect(0, 0, X(cx), h); g.clip();
      const pt = (A, r) => [X(cx - s * a + s * r * Math.cos(A)), Y(ys + r * Math.sin(A))];
      for (let i = 0; i < n; i++) {
        const A0 = (PI / 3) * (i / n), A1 = (PI / 3) * ((i + 1) / n), p1 = pt(A0, Ri), p2 = pt(A0, Ro), p3 = pt(A1, Ro), p4 = pt(A1, Ri);
        g.fillStyle = i % 2 ? '#a88f64' : '#e0cfa4'; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.fill();
      }
      g.restore();
    }
  };
  paintAshlar(g, w, h, FW, FW, 0.3, 0.75, STONE, JOINT, 5101, 1.0, 0.05);
  for (let i = 0; i < 6; i++) { const cx = X(-6 + i * 2.4), cy = Y(2 + (i % 3) * 4.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 3.4 * sx); gr.addColorStop(0, 'rgba(140,110,70,0.16)'); gr.addColorStop(1, 'rgba(140,110,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // the stringcourse under the middle row, and the one at the foot of the nave block
  R(-FW / 2, 5.7, FW / 2, 5.95, LIGHT); R(-FW / 2, 5.55, FW / 2, 5.7, 'rgba(60,45,25,0.25)');
  R(-3.8, HM - 0.05, 3.8, HM + 0.2, LIGHT);
  // ground row: the big portal (hood, chevron ring, door) and a smaller one each side
  const portal = (cx, ys, a, t, hood) => {
    arch(cx, ys - 0.05, a + t + hood, 0, LIGHT); arch(cx, ys - 0.05, a + t + hood - 0.12, 0, STONE);
    arch(cx, ys, a + t, 0, '#cbb78a'); ring(cx, ys, a, t); arch(cx, ys, a, 0, DOOR);
    const R0 = 2 * a; R(cx - 0.04, 0, cx + 0.04, ys + R0 * 0.5, '#15100d');
    for (let y = 0.5; y < ys + 0.3; y += 0.62) { R(cx - a, y, cx + a, y + 0.05, 'rgba(0,0,0,0.35)'); }
  };
  portal(0, 2.4, 1.2, 1.0, 0.45);
  for (const s of [-1, 1]) portal(s * 5.5, 2.2, 0.75, 0.8, 0.3);
  // the middle row: five pointed blind arches; the outer two hold a barred window
  for (const x of [-2.8, 0, 2.8]) { arch(x, 6.9, 1.25, 6.7, LIGHT); arch(x, 6.9, 1.1, 6.7, '#b9a176'); arch(x, 6.9, 0.65, 6.7, '#a58d63'); }
  for (const s of [-1, 1]) {
    arch(s * 5.4, 6.8, 1.35, 6.6, LIGHT); arch(s * 5.4, 6.8, 1.2, 6.6, '#b9a176');
    arch(s * 5.4, 6.8, 0.55, 6.6, GRATE); g.strokeStyle = 'rgba(30,18,10,0.7)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(X(s * 5.4 + k * 0.2), Y(6.6)); g.lineTo(X(s * 5.4 + k * 0.2), Y(8.2)); g.stroke(); }
    for (let y = 6.9; y < 8.1; y += 0.22) R(s * 5.4 - 0.55, y, s * 5.4 + 0.55, y + 0.025, 'rgba(30,18,10,0.6)');
  }
  // the nave block: three nested arches, the middle one a window
  for (const x of [-2.55, 2.55]) { arch(x, 11.9, 1.1, 10.7, LIGHT); arch(x, 11.9, 0.95, 10.7, '#b9a176'); arch(x, 11.9, 0.38, 10.7, '#7d6847'); }
  arch(0, 12.1, 1.25, 10.7, LIGHT); arch(0, 12.1, 1.1, 10.7, '#b9a176'); arch(0, 12.1, 0.6, 10.7, GRATE);
  for (let y = 10.9; y < 12.3; y += 0.22) R(-0.6, y, 0.6, y + 0.025, 'rgba(30,18,10,0.6)');
  streaks(g, w, h, 30, 5102, 0.09, 110, '70,55,35');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,22,12,0.3)'); gb.addColorStop(1, 'rgba(30,22,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintSide(g, w, h, hm) {   // one aisle bay, 5 m wide: a big blind pointed arch on the ground, a window in a pointed arch over the string course
  const sx = w / 5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (cx, ys, a, y0, c) => {
    const Rr = 2 * a, n = 12; g.fillStyle = c; g.beginPath(); g.moveTo(X(cx - a), Y(y0)); g.lineTo(X(cx - a), Y(ys));
    for (let i = 1; i <= n; i++) { const ang = PI - (PI / 3) * (i / n); g.lineTo(X(cx + a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    for (let i = 1; i <= n; i++) { const ang = (PI / 3) * (1 - i / n); g.lineTo(X(cx - a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    g.lineTo(X(cx + a), Y(y0)); g.closePath(); g.fill();
  };
  paintAshlar(g, w, h, 5, hm, 0.3, 0.75, STONE, JOINT, 5111, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, 5113, ['rgba(110,85,55,0.07)', 'rgba(255,250,235,0.06)']);
  arch(2.5, 2.0, 1.55, 0, LIGHT); arch(2.5, 2.0, 1.38, 0, '#b9a176'); arch(2.5, 2.0, 1.05, 0, '#bea77c');
  R(0, 5.7, 5, 5.95, LIGHT); arch(2.5, 6.9, 1.15, 6.5, LIGHT); arch(2.5, 6.9, 1.0, 6.5, '#b9a176'); arch(2.5, 6.9, 0.45, 6.6, GRATE);
  R(0, hm - 0.25, 5, hm, LIGHT);
  streaks(g, w, h, 8, 5114, 0.1, 80, '60,48,32');
}
function paintEast(g, w, h) {   // TW x HT metres, v = 0 at the ground: [0, AW] the tall south wall (west to east), [AW, AW + PW] an apse face, the rest a clerestory bay over plain ashlar
  const sx = w / TW, sy = h / HT, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (cx, ys, a, y0, c) => {
    const Rr = 2 * a, n = 12; g.fillStyle = c; g.beginPath(); g.moveTo(X(cx - a), Y(y0)); g.lineTo(X(cx - a), Y(ys));
    for (let i = 1; i <= n; i++) { const ang = PI - (PI / 3) * (i / n); g.lineTo(X(cx + a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    for (let i = 1; i <= n; i++) { const ang = (PI / 3) * (1 - i / n); g.lineTo(X(cx - a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    g.lineTo(X(cx + a), Y(y0)); g.closePath(); g.fill();
  };
  // an arch in two recessed orders; inner is 'win' (a grated window from yw), or blind
  const bay = (cx, ys, a, y0, win, yw) => { arch(cx, ys, a, y0, LIGHT); arch(cx, ys, a - 0.13, y0, '#a98d62'); arch(cx, ys, a - 0.32, y0, '#c4a678'); if (win) arch(cx, ys + 0.1, 0.42, yw, GRATE); };
  paintAshlar(g, w, h, TW, HT, 0.3, 0.75, '#cab184', '#9c8660', 5121, 1.0, 0.08);
  noiseDots(g, w, h, w * h / 90, 2.5, 5122, ['rgba(110,75,45,0.1)', 'rgba(255,245,220,0.06)']);
  for (let i = 0; i < 5; i++) {
    const cx = (i + 0.5) * AW / 5;
    bay(cx, 2.0, 1.26, 0, false);
    bay(cx, 11.3, 0.9, 9.5, i !== 3, 10.2);
    if (i !== 1) bay(i === 4 ? cx + 0.3 : cx, 6.1, 1.04, 4.9, i === 0 || i === 2, 5.2);
  }
  arch(AW / 10, 1.5, 0.55, 0, DOOR);
  const am = AW + PW / 2; arch(am, 11.3, 0.55, 9.4, LIGHT); arch(am, 11.3, 0.4, 9.4, '#ab8f63'); arch(am, 7.4, 0.7, 5.8, LIGHT); arch(am, 7.4, 0.54, 5.8, '#ab8f63');
  const cm = AW + PW + CW / 2; arch(cm, HM + 1.9, 0.75, HM + 0.6, LIGHT); arch(cm, HM + 1.9, 0.62, HM + 0.6, '#a98d62'); arch(cm, HM + 1.9, 0.36, HM + 0.8, GRATE);
  for (const y of [HT, AH]) R(y === HT ? 0 : AW, y - 0.28, y === HT ? AW : AW + PW, y, LIGHT);
  R(AW + PW, HR - 0.22, TW, HR, LIGHT);
  streaks(g, w, h, 40, 5123, 0.1, 90, '60,44,28');
}
function buildMagione() {
  initShared();
  const pts = pairsOf(MG.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-5, 2)), groundY(...W(5, 2)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('mgFront', 512, 512, [FW, FW], paintFront);
  defMat('mgSide', 160, 332, [5, HM], (g, w, h) => paintSide(g, w, h, HM));
  defMat('mgEast', 384, 288, [TW, HT], paintEast);
  begin(y0);
  // a painted wall from p to q (frame x, z; p is its left end seen from outside) between heights ya and yb, showing the atlas from u metres across, uw metres of it
  const face = (p, q, ya, yb, u, uw, v = ya) => {
    const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
    panel('mgEast', l, yb - ya, { M: at((p[0] + q[0]) / 2 + nx * 0.05, ya, (p[1] + q[1]) / 2 + nz * 0.05), ry: Math.atan2(nx, nz), uvk: [uw / TW, (yb - ya) / HT], uvo: [u / TW, v / HT], noao: ya > 0 });
  };
  // the same cut in equal pieces no wider than a bay, so the courses and the clerestory windows keep their size; v picks the height in the atlas (2 m: plain ashlar)
  const run = (p, q, ya, yb, v) => {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(l / (CW + 0.2)), m = (k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n];
    for (let i = 0; i < n; i++) face(m(i), m(i + 1), ya, yb, AW + PW, Math.min(CW, l / n), v);
  };
  const roof = (q, y, c) => prism('flat', q.map(v => W(v[0], v[1])), y, y + 0.12, { c });
  // the body under the aisle eaves (the footprint without the two points of the apse), then the nave and its low tile gable up to the tall part
  const body = clipFront(pts.filter((_, i) => i !== 7 && i !== 8), -0.45);
  prism('mgSide', body, Math.min(gr.lo, y0) - 1.5, y0 + HM, { uvo: [0, -y0 / HM] });
  prism('flat', body, y0 + HM, y0 + HM + 0.12, { c: '#9c9283' });
  for (const s of [-1, 1]) { const x = NX + s * NHW; if (s > 0) run([x, NZ1], [x, TZ], HM, HR); else run([x, TZ], [x, NZ1], HM, HR); }
  gable('tile', 'flat', at(NX, 0, (TZ + NZ1) / 2), NHW * 2, NZ1 - TZ, HR, APEX - HR, { ov: 0.15, c: '#b07a5c', wc: '#c6a979' });
  // the tall eastern part: the photographed south wall from the ground, the other faces plain above the aisles, and the flat block on its roof
  const SW = [8.27, TZ], SE = [8.4, -31.6], NE = [-8.0, -31.55], NW = [-8.1, TZ];
  face(SW, SE, 0, HT, 0, AW);
  run(SE, NE, HM, HT, 2); run(NE, NW, HM, HT, 2); run(NW, SW, HM, HT, 2);
  roof([SW, SE, NE, NW], y0 + HT - 0.12, '#9c9283');
  const BK = [[8.05, -27.2], [8.05, -31.45], [-3.4, -31.45], [-3.4, -27.2]];
  for (let i = 0; i < 4; i++) run(BK[i], BK[(i + 1) % 4], HT, HT + 1.2, 2);
  roof(BK, y0 + HT + 1.08, '#a89878');
  // the apse: a rounded half drum behind the east wall, one narrow arched face to each side. Its corners keep just inside the footprint's apse, which is where the lapa stops
  const apse = [[4.45, -31.5], [3.45, -32.6], [2.4, -33.7], [1.5, -34.22], [0.4, -34.19], [-0.8, -34.07], [-1.75, -33.4], [-2.75, -32.35], [-3.68, -31.5]];
  for (let i = 0; i < 8; i++) face(apse[i], apse[i + 1], 0, AH, AW, PW);
  roof(apse, y0 + AH - 0.12, '#a89878');
  const sk = Math.min(gr.lo, y0) - 1.5 - y0;
  if (sk < 0) { for (let i = 0; i < 8; i++) face(apse[i], apse[i + 1], sk, 0, AW, PW); face(SW, SE, sk, 0, 0, AW); }
  // the front: one shape (the aisle wall, the raised nave block and the low gable) with the painted face on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, HM); s.lineTo(NHW + NX, HM); s.lineTo(NHW + NX, HR); s.lineTo(NX, APEX); s.lineTo(-NHW + NX, HR); s.lineTo(-NHW + NX, HM); s.lineTo(-hw, HM); s.lineTo(-hw, 0);
  extrude('mgFront', s, 0.5, { M: at(0, 0, -0.5), uv: 'keep', uvk: [1 / FW, 1 / FW], uvo: [0.5, 0], cs: 8, noao: true });
  // a thin string course along the aisle tops, and two low steps at the big portal
  bx('flat', F, -hw - 0.05, hw + 0.05, HM - 0.05, HM + 0.2, -0.45, 0.1, { c: '#d9c697', noao: true });
  for (let i = 0; i < 2; i++) bx('stone', F, -2.6 - i * 0.2, 2.6 + i * 0.2, -0.3, 0.14 * (2 - i), 0, 0.35 * (i + 1), { c: '#d2c3a0' });
  const o = end('La Magione');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[MG.p, null, y0 + HM], [ring(NX - NHW, NX + NHW, TZ, NZ1), null, y0 + APEX], [ring(-8.0, 8.3, -31.5, TZ), null, y0 + HT]];
  return o;
}
export const MAGIONE = { name: 'La Magione (Santissima Trinita)', x: 676, z: 230, radius: 40, skipIds: [MG.id], build: buildMagione };
