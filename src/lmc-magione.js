// City landmark: La Magione (Chiesa della Santissima Trinita, Palermo, 12th century Norman). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49769029. Frame F: origin on the ground in the middle of the front (the 15.8 m edge from point 0 to point 2, facing the garden to the west-north-west), +z out of the front.
// Reference photos (Wikimedia Commons, looked at, nothing copied): "Chiesa della magione o della ss trinita2008.jpg", "Magione - facade.jpg", "Palermo-Magione-bjs-1.jpg", "La Magione Palermo.JPG".
// Read from them: a flat wide front of golden sand-coloured limestone in even courses, as tall as it is wide at the gable (aisle wall about 0.66 of the width, ridge about 0.96);
// three pointed portals on the ground (a big one in the middle with a ring of chevron voussoirs and a hood, a smaller one each side); a middle row of five pointed blind arches, the two outer ones holding a barred window;
// the nave rising in the middle as a block about half the front wide, with three nested pointed arches (the middle one a window) and a very low gable; the side walls carry the same blind arches.
// Not verified, drawn plain: the apse (no photo of the back; the footprint shows it as a half hexagon as wide as the nave), the roof colours, the cloister and the tower or lantern at the crossing (none drawn).
import * as THREE from 'three';
import { PI, bx, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable } from './lmc-kit.js';

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
const FW = 15.8, HM = 10.4, HR = 13.9, APEX = 15.2, NX = 0.35, NHW = 3.8, NZ0 = -31.5, NZ1 = -0.45;
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
function paintSide(g, w, h, hm, nave) {   // one side bay, 5 m wide: the aisle wall (blind pointed arch over a plain ground course) or the nave wall (a slit window)
  const sx = w / 5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (cx, ys, a, y0, c) => {
    const Rr = 2 * a, n = 12; g.fillStyle = c; g.beginPath(); g.moveTo(X(cx - a), Y(y0)); g.lineTo(X(cx - a), Y(ys));
    for (let i = 1; i <= n; i++) { const ang = PI - (PI / 3) * (i / n); g.lineTo(X(cx + a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    for (let i = 1; i <= n; i++) { const ang = (PI / 3) * (1 - i / n); g.lineTo(X(cx - a + Rr * Math.cos(ang)), Y(ys + Rr * Math.sin(ang))); }
    g.lineTo(X(cx + a), Y(y0)); g.closePath(); g.fill();
  };
  paintAshlar(g, w, h, 5, hm, 0.3, 0.75, STONE, JOINT, nave ? 5112 : 5111, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, 5113, ['rgba(110,85,55,0.07)', 'rgba(255,250,235,0.06)']);
  if (nave) { arch(2.5, 1.9, 0.5, 0.7, LIGHT); arch(2.5, 1.9, 0.38, 0.7, GRATE); }
  else { R(0, 5.7, 5, 5.95, LIGHT); arch(2.5, 6.9, 1.15, 6.5, LIGHT); arch(2.5, 6.9, 1.0, 6.5, '#b9a176'); arch(2.5, 6.9, 0.55, 6.5, '#a58d63'); }
  R(0, hm - 0.25, 5, hm, LIGHT);
  streaks(g, w, h, 8, 5114, 0.1, 80, '60,48,32');
}

function buildMagione() {
  initShared();
  const pts = pairsOf(MG.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-5, 2)), groundY(...W(5, 2)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('mgFront', 512, 512, [FW, FW], paintFront);
  defMat('mgSide', 160, 332, [5, HM], (g, w, h) => paintSide(g, w, h, HM, false));
  defMat('mgNave', 160, 112, [5, HR - HM], (g, w, h) => paintSide(g, w, h, HR - HM, true));
  begin(y0);
  const body = clipFront(pts, -0.45);
  prism('mgSide', body, Math.min(gr.lo, y0) - 1.5, y0 + HM, { uvo: [0, -y0 / HM] });
  prism('flat', body, y0 + HM, y0 + HM + 0.12, { c: '#9c9283' });
  // the nave and the apse: the nave under a very low gable of tiles, the apse (a half hexagon behind it) to the same wall height
  bx('mgNave', F, NX - NHW, NX + NHW, HM, HR, NZ0, NZ1, { uvo: [0, -(y0 + HM) / (HR - HM)] });
  gable('tile', 'mgNave', at(NX, 0, (NZ0 + NZ1) / 2), NHW * 2, NZ1 - NZ0, HR, APEX - HR, { ov: 0.15, c: '#b07a5c', wc: '#cdb68a' });
  const apse = [[4.5, -31.5], [1.9, -34.3], [-1.2, -34.1], [-3.7, -31.4]].map(q => W(q[0], q[1]));
  prism('mgNave', apse, y0 + HM, y0 + HR, { uvo: [0, -(y0 + HM) / (HR - HM)] });
  prism('flat', apse, y0 + HR, y0 + HR + 0.15, { c: '#a8735a' });
  // the front: one shape (the aisle wall, the raised nave block and the low gable) with the painted face on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, HM); s.lineTo(NHW + NX, HM); s.lineTo(NHW + NX, HR); s.lineTo(NX, APEX); s.lineTo(-NHW + NX, HR); s.lineTo(-NHW + NX, HM); s.lineTo(-hw, HM); s.lineTo(-hw, 0);
  extrude('mgFront', s, 0.5, { M: at(0, 0, -0.5), uv: 'keep', uvk: [1 / FW, 1 / FW], uvo: [0.5, 0], cs: 8, noao: true });
  // a thin string course along the aisle tops, and two low steps at the big portal
  bx('flat', F, -hw - 0.05, hw + 0.05, HM - 0.05, HM + 0.2, -0.45, 0.1, { c: '#d9c697', noao: true });
  for (let i = 0; i < 2; i++) bx('stone', F, -2.6 - i * 0.2, 2.6 + i * 0.2, -0.3, 0.14 * (2 - i), 0, 0.35 * (i + 1), { c: '#d2c3a0' });
  const o = end('La Magione');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[MG.p, null, y0 + HM], [ring(NX - NHW, NX + NHW, NZ0, NZ1), null, y0 + APEX]];
  return o;
}
export const MAGIONE = { name: 'La Magione (Santissima Trinita)', x: 676, z: 230, radius: 40, skipIds: [MG.id], build: buildMagione };
