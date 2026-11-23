// City landmarks, batch H: four palazzi of Palermo drawn from reference photos. Registered in src/landmarks-city.js as BATCH_H.
// Palazzo Abatellis (Via Alloro), Palazzo Mirto (Via Merlo), Palazzo Butera (Foro Italico), Palazzo Sclafani (Piazza San Giovanni Decollato). Each replaces one OSM footprint (skipIds) and stays inside it.
// Frame of a front: origin on the ground at the middle of the front edge, +z out of the front, +x to the right seen from the street (as in the Poste model). Every front is painted per bay on tiled canvases (at most 384 px, three materials per palazzo).
// Reference photos (Wikimedia Commons, looked at, nothing copied; proportions and colours read, then drawn procedurally):
//   Abatellis: "Palermo-Palazzo-Abatellis-bjs2007-01.jpg", "Palazzo Abatellis Palermo 384.jpg", "Palazzo Abatellis in Palermo, Sicily, Italy (7070686937).jpg", "PA PA 03 11 2014 01.jpg" (also "Palermo-AP-p1070643.jpg" listed)
//     read: two storeys; ground floor in dark weathered tufa ashlar with few big barred windows in stone frames; a Gothic-Catalan portal with twisted rope mouldings, clustered jamb shafts and three diamond medallions (arms in the middle, sunburst each side) over it;
//     string course; first floor honey tufa with triple-light Gothic windows (trefoil tracery, two white colonnettes); moulded cornice with gargoyles under a low crenellated parapet; a square machicolated crenellated tower at one end of the front.
//   Mirto: "Palermo-AP-p1070637.jpg", "Palermo-AP-p1070638.jpg" (the Palazzo Mirto category holds no photo of the street front; the front is NOT verified beyond the gate).
//     read: the street gate is a rusticated tufa frame with a round arch, a heavy cornice and an attic carrying the princely coat of arms (double eagle, crown) and a flaming urn at each end; behind and beside it the walls are pale ochre plaster with blue shutters and curved iron balconies.
//   Butera: "Palazzo Butera facciata.jpg", "Foro Italico 10.jpg", "Camminamento Mura delle Cattive.jpg", "Palermo - Palazzo Butera - 2026-09-03 10-50-04 001.jpg"
//     read: the long sea front stands behind a tall pink-ochre terrace wall (old city wall, plaster gone in patches, small barred windows) with a railing, urns on piers and a garden; above it a cream plastered palace with honey-stone strips and window frames,
//     a row of windows with curved hoods and iron balconies, a cornice and a balustrade with urns on the roof line; a square belvedere tower at the north end; the front bends slightly (four runs).
//   Sclafani: "Palermo-Palazzo-Sclafani-bjs-01.jpg", "Palermo-Palazzo-Sclafani-bjs-02.jpg", "Palermo, Palazzo Sclafani.jpg", "Palazzo Sclafani.jpg"
//     read: three floors of orange tufa ashlar with lime and soot runs; ground floor small barred windows, first floor small rectangular windows, a string course, then a top floor of nine tall blind pointed arches in two bands (black and white voussoirs),
//     each holding two arched windows with a colonnette, a rosette above; a pointed Gothic portal under a gable (about two thirds along the front), a pointed aedicule with shields over it and an eagle above; wires along the first string; flat parapet.
// Footprints identified in world/tiles: Abatellis w143737450 and Butera w86882286 and Mirto r403480.0 carry their names (n field) in tile 1_-1; Sclafani w279883571 is anonymous in tile -1_0, found by position
//   (next to the Palazzo dei Normanni side of Piazza della Vittoria, the 63 m edge runs 4 m off the road Piazza San Giovanni Decollato, and the real palace stands at 38.1125 N 13.3568 E).
// Not verified: the number of bays of Abatellis, Butera and Mirto beyond what the photos show, the side and back walls of all four, Mirto's street front, which end of the Abatellis front has the tower (right seen from the street), the exact Butera tower position.
import { PI, bx, cyl, lathe, sphere, begin, end, defMat, mul, tr, frame, prism, panel, pairsOf, groundRange, groundY, initShared, noiseDots, streaks, paintAshlar, crenel, balus, rail, RNG } from './lmc-kit.js';

// ---------- shared helpers ----------
const mk = (g, w, h, wm, hm) => { const sx = w / wm, sy = h / hm, X = x => x * sx, Y = y => h - y * sy; return { sx, sy, X, Y, R: (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); } }; };
const blotch = (g, w, h, n, seed, cols, bw, bh) => { const r = RNG(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(r() * w, r() * h, bw * (0.4 + r()), bh * (0.4 + r())); } };
function wear(g, w, h, seed, o = {}) {   // stained, soot-streaked, patched, dirty at the foot
  blotch(g, w, h, o.n || Math.round(w * h / 4500), seed + 1, o.cols || ['rgba(255,238,205,0.10)', 'rgba(60,38,22,0.11)', 'rgba(255,248,230,0.07)'], o.bw || w / 8, o.bh || h / 14);
  streaks(g, w, h, o.lime === undefined ? 8 : o.lime, seed + 2, 0.24, h * 0.3, '244,236,218');
  streaks(g, w, h, o.soot === undefined ? 10 : o.soot, seed + 3, 0.22, h * 0.28, '34,26,18');
  noiseDots(g, w, h, w * h / 55, 1.7, seed + 4, ['rgba(38,26,16,0.13)', 'rgba(252,238,208,0.10)']);
  const fh = o.foot === undefined ? h * 0.1 : o.foot, gb = g.createLinearGradient(0, h, 0, h - fh); gb.addColorStop(0, 'rgba(26,19,13,0.42)'); gb.addColorStop(1, 'rgba(26,19,13,0)'); g.fillStyle = gb; g.fillRect(0, h - fh, w, fh);
}
function archPts(cx, ys, hw, rise, n = 12) {   // pointed arch (two circular arcs), left spring to right spring, in metres
  const c = (rise * rise - hw * hw) / (2 * hw), r = c + hw, a1 = Math.atan2(rise, -c), a2 = Math.atan2(rise, c), out = [];
  for (let i = 0; i <= n; i++) { const a = PI + (a1 - PI) * i / n; out.push([cx + c + r * Math.cos(a), ys + r * Math.sin(a)]); }
  for (let i = 1; i <= n; i++) { const a = a2 * (1 - i / n); out.push([cx - c + r * Math.cos(a), ys + r * Math.sin(a)]); }
  return out;
}
function roundArchPts(cx, ys, hw, n = 12) { const o = []; for (let i = 0; i <= n; i++) { const a = PI - PI * i / n; o.push([cx + hw * Math.cos(a), ys + hw * Math.sin(a)]); } return o; }
function pathPts(g, m, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(m.X(p[0]), m.Y(p[1])) : g.moveTo(m.X(p[0]), m.Y(p[1]))); }
function fillPoly(g, m, pts, col) { pathPts(g, m, pts); g.closePath(); g.fillStyle = col; g.fill(); }
function bandPts(g, m, pts, lw, light, dark, dash) {   // a banded arch: pale stone with dark voussoir dashes
  g.save(); g.lineJoin = 'round'; pathPts(g, m, pts); g.lineWidth = lw * m.sx; g.strokeStyle = light; g.stroke();
  if (dark) { g.setLineDash([dash * m.sx, dash * m.sx]); g.strokeStyle = dark; g.stroke(); } g.restore();
}
function rope(g, m, pts, lw, light, dark) {   // twisted cord moulding along a polyline
  g.save(); g.lineJoin = 'round'; pathPts(g, m, pts); g.lineWidth = lw * m.sx; g.strokeStyle = light; g.stroke();
  g.setLineDash([lw * m.sx * 0.35, lw * m.sx * 0.5]); g.strokeStyle = dark; g.lineWidth = lw * m.sx * 0.9; g.stroke(); g.restore();
}
const cenOf = (pts) => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };
function edgeFrame(pts, i, cen, y0) {   // frame of the edge i->i+1, +z out of the footprint (the side away from cen)
  const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
  let nx = -dz / L, nz = dx / L; const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  if ((mx - cen[0]) * nx + (mz - cen[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const F = frame(mx, y0, mz, nx, nz);
  return { A, B, L, nx, nz, mx, mz, F, at: (x, y, z) => mul(F, tr(x, y, z)), W: (x, z) => [mx + x * nz + z * nx, mz - x * nx + z * nz] };
}
function corniceRing(pts, top, c, o = {}) {   // a cornice straddling every edge (orientation free)
  for (let i = 0; i < pts.length; i++) {
    if (o.skip && o.skip(i)) continue;
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez); if (l < 1.5) continue;
    const Fe = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -ez / l, ex / l);
    bx('flat', Fe, -l / 2, l / 2, top - 0.95, top + 0.1, -(o.d || 0.28), o.d || 0.28, { c, noao: true });
    bx('flat', Fe, -l / 2, l / 2, top - 1.35, top - 0.95, -(o.d || 0.28) * 0.5, (o.d || 0.28) * 0.5, { c: o.c2 || '#7f7461', noao: true });
  }
}
function urn(M, h, c) {
  lathe('stone', [[0, 0], [0.30 * h, 0], [0.32 * h, 0.08 * h], [0.22 * h, 0.16 * h], [0.34 * h, 0.40 * h], [0.30 * h, 0.58 * h], [0.20 * h, 0.66 * h], [0.10 * h, 0.72 * h], [0.15 * h, 0.80 * h], [0.0, 0.92 * h]], 8, { M, c, noao: true });
}
function lineX(p, d, q, e) { const den = d[0] * e[1] - d[1] * e[0], t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den; return [p[0] + t * d[0], p[1] + t * d[1]]; }

// ====================================================================================================
// 1. Palazzo Abatellis
// ====================================================================================================
const AB = { id: 'w143737450', p: [841.3, -103.6, 877.8, -121.4, 894.8, -85, 859.4, -68.4] };
const AB_H = 13.8, AB_GF = 6.6, AB_N = 8, AB_L = Math.hypot(36.5, 17.8), AB_BW = AB_L / AB_N, AB_TW = AB_BW * 2;
function abWin3(g, m, cx, y0, y1, w) {   // the triple-light Gothic window: label frame, trefoil band, two white colonnettes, bars, curtains
  const { R, X, Y, sx, sy } = m;
  R(cx - w / 2 - 0.32, y0 - 0.2, cx + w / 2 + 0.32, y1 + 0.55, '#d6bd90'); R(cx - w / 2 - 0.32, y0 - 0.2, cx - w / 2 - 0.2, y1 + 0.55, 'rgba(60,40,20,0.25)');
  R(cx - w / 2, y0, cx + w / 2, y1, '#3a3d44');
  const gl = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gl.addColorStop(0, 'rgba(235,230,220,0.55)'); gl.addColorStop(1, 'rgba(210,205,195,0.18)'); g.fillStyle = gl; g.fillRect(X(cx - w / 2), Y(y1), w * sx, (y1 - y0) * sy);
  for (const dx of [-w / 6, w / 6]) R(cx + dx - 0.05, y0, cx + dx + 0.05, y1, '#f0eadc');
  for (const yy of [y0 + (y1 - y0) * 0.38, y0 + (y1 - y0) * 0.7]) R(cx - w / 2, yy, cx + w / 2, yy + 0.05, '#272a2f');
  R(cx - w / 2, y1 - 0.62, cx + w / 2, y1, '#cdb286');   // the tracery band
  for (let k = 0; k < 3; k++) {
    const xc = cx - w / 3 + k * w / 3; g.fillStyle = '#e4cfa4'; g.beginPath(); g.ellipse(X(xc), Y(y1 - 0.3), 0.3 * sx, 0.27 * sy, 0, 0, 2 * PI); g.fill();
    g.fillStyle = '#4a4338'; for (const [a, b] of [[0, 0.1], [-0.1, -0.06], [0.1, -0.06]]) { g.beginPath(); g.ellipse(X(xc + a), Y(y1 - 0.3 + b), 0.075 * sx, 0.07 * sy, 0, 0, 2 * PI); g.fill(); }
  }
  R(cx - w / 2 - 0.2, y0 - 0.3, cx + w / 2 + 0.2, y0 - 0.12, '#c8ad80');
}
function paintAbFront(g, w, h) {
  const m = mk(g, w, h, AB_TW, AB_H), { R, X, Y, sx, sy } = m;
  paintAshlar(g, w, h, AB_TW, AB_H, 0.46, 1.05, '#cfae80', '#a58a62', 9101, 1.3, 0.09);   // honey tufa, first floor
  g.save(); g.beginPath(); g.rect(0, Y(AB_GF), w, AB_GF * sy); g.clip();
  paintAshlar(g, w, h, AB_TW, AB_H, 0.5, 1.15, '#8c7658', '#54432f', 9102, 1.6, 0.12);   // dark weathered tufa, ground floor
  blotch(g, w, h, 70, 9103, ['rgba(214,190,150,0.16)', 'rgba(40,28,18,0.14)'], w / 20, h / 40);
  g.restore();
  R(0, AB_GF - 0.1, AB_TW, AB_GF + 0.5, '#c3a67b'); R(0, AB_GF - 0.14, AB_TW, AB_GF - 0.08, 'rgba(35,24,14,0.5)'); R(0, AB_GF - 0.9, AB_TW, AB_GF - 0.14, 'rgba(30,20,12,0.12)'); { const gg = g.createLinearGradient(0, Y(AB_GF), 0, Y(0)); gg.addColorStop(0, 'rgba(25,18,10,0)'); gg.addColorStop(1, 'rgba(25,18,10,0.3)'); g.fillStyle = gg; g.fillRect(0, Y(AB_GF), w, AB_GF * sy); }
  // one big barred window in the ground floor of every second bay
  const gx = AB_BW * 0.5;
  R(gx - 1.0, 2.8, gx + 1.0, 5.2, '#bda583'); R(gx - 1.0, 2.8, gx - 0.88, 5.2, 'rgba(255,240,210,0.2)'); R(gx - 0.72, 3.15, gx + 0.72, 4.95, '#101214');
  for (let x = gx - 0.66; x < gx + 0.7; x += 0.15) R(x, 3.15, x + 0.045, 4.95, '#767b7e');
  for (let y = 3.45; y < 4.95; y += 0.38) R(gx - 0.72, y, gx + 0.72, y + 0.045, '#767b7e');
  R(gx - 1.2, 2.62, gx + 1.2, 3.1, '#c5ac84'); R(gx - 1.2, 2.58, gx + 1.2, 2.64, 'rgba(25,16,8,0.5)');
  for (let i = 0; i < 2; i++) abWin3(g, m, AB_BW * (i + 0.5), 7.9, 10.5, 2.3);
  // rust runs under the bars, soot under the sills
  for (const x of [gx - 0.6, gx + 0.1, gx + 0.6]) { const gr = g.createLinearGradient(0, Y(3.15), 0, Y(1.7)); gr.addColorStop(0, 'rgba(120,60,25,0.35)'); gr.addColorStop(1, 'rgba(120,60,25,0)'); g.fillStyle = gr; g.fillRect(X(x), Y(3.15), 5, 1.45 * sy); }
  for (let i = 0; i < 2; i++) { const cx = AB_BW * (i + 0.5), gr = g.createLinearGradient(0, Y(7.55), 0, Y(6.0)); gr.addColorStop(0, 'rgba(40,28,16,0.38)'); gr.addColorStop(1, 'rgba(40,28,16,0)'); g.fillStyle = gr; g.fillRect(X(cx - 1.3), Y(7.55), 2.6 * sx, 1.55 * sy); }
  wear(g, w, h, 9110, { lime: 6, soot: 12, foot: h * 0.09 });
}
function paintAbPortal(g, w, h) {   // 8.4 x 6.6 m, transparent around the carving
  const m = mk(g, w, h, 8.4, 6.6), { R, X, Y, sx, sy } = m, cx = 4.2;
  const rr = (d) => { const hw = 1.5 + d, top = 3.9 + d, r = Math.min(1.0 + d * 0.6, hw); return [[cx - hw, 0], [cx - hw, top - r], [cx - hw + r * 0.3, top - r * 0.3], [cx - hw + r, top], [cx + hw - r, top], [cx + hw - r * 0.3, top - r * 0.3], [cx + hw, top - r], [cx + hw, 0]]; };
  // plaques either side
  for (const sg of [-1, 1]) { R(cx + sg * 2.9 - (sg > 0 ? 0 : 1.2), 3.1, cx + sg * 2.9 + (sg > 0 ? 1.2 : 0), 5.15, '#e5decf'); for (let y = 3.4; y < 5.0; y += 0.22) R(cx + sg * 2.9 + (sg > 0 ? 0.12 : -1.08), y, cx + sg * 2.9 + (sg > 0 ? 1.08 : -0.12), y + 0.05, 'rgba(120,110,95,0.5)'); }
  // nested mouldings, outermost first
  fillPoly(g, m, rr(1.35), '#a8856a'); rope(g, m, rr(1.2), 0.3, '#c9a98a', '#6e5240');
  fillPoly(g, m, rr(0.95), '#9d7d64'); fillPoly(g, m, rr(0.62), '#b8957a');
  for (let k = 0; k < 6; k++) { const d = 0.64 + k * 0.05; g.strokeStyle = 'rgba(70,48,32,0.45)'; g.lineWidth = 1.5; pathPts(g, m, rr(d)); g.stroke(); }
  fillPoly(g, m, rr(0.3), '#8e7058'); rope(g, m, rr(0.16), 0.2, '#c2a184', '#5f4634');
  fillPoly(g, m, rr(0), '#0e0d0d');
  { const gg = g.createLinearGradient(0, Y(2.4), 0, Y(0)); gg.addColorStop(0, '#d9ceb8'); gg.addColorStop(1, '#6e6454'); g.fillStyle = gg; g.fillRect(X(cx - 1.0), Y(2.4), 2.0 * sx, 2.4 * sy); }   // sunlit court seen through the door
  for (let k = 0; k < 5; k++) R(cx - 1.5 + k * 0.62, 2.4, cx - 1.5 + k * 0.62 + 0.03, 3.9, '#2a2622');
  R(cx - 1.5, 2.4, cx + 1.5, 3.9, 'rgba(40,36,30,0.78)'); for (let x = cx - 1.4; x < cx + 1.4; x += 0.28) R(x, 2.5, x + 0.04, 3.8, 'rgba(120,105,80,0.5)');   // the grille over the door
  // jamb shafts and their capitals
  for (const sg of [-1, 1]) { for (let k = 0; k < 4; k++) { const x0 = cx + sg * (1.5 + 0.1 + k * 0.17); R(Math.min(x0, x0 + 0.13), 0, Math.max(x0, x0 + 0.13), 3.0, k % 2 ? '#9a7a60' : '#b99877'); } R(cx + (sg > 0 ? 1.45 : -2.45), 3.0, cx + (sg > 0 ? 2.45 : -1.45), 3.4, '#8a6c54'); for (let x = 0; x < 8; x++) R(cx + (sg > 0 ? 1.5 : -2.4) + x * 0.12, 3.05, cx + (sg > 0 ? 1.5 : -2.4) + x * 0.12 + 0.05, 3.35, 'rgba(40,26,16,0.5)'); }
  // three diamonds
  const dia = (x0, y0, d, border, fill) => { const pts = [[x0, y0 - d], [x0 + d, y0], [x0, y0 + d], [x0 - d, y0]]; fillPoly(g, m, pts, fill); rope(g, m, pts.concat([pts[0]]), 0.2, border, '#6a5340'); };
  dia(cx - 2.15, 5.55, 0.75, '#c8ab8c', '#cfc2aa'); dia(cx + 2.15, 5.55, 0.75, '#c8ab8c', '#cfc2aa'); dia(cx, 5.65, 0.92, '#c8ab8c', '#b8a688');
  g.strokeStyle = 'rgba(90,75,55,0.7)'; g.lineWidth = 1.3;
  for (const sx_ of [-2.15, 2.15]) for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(X(cx + sx_), Y(5.3)); g.lineTo(X(cx + sx_ + k * 0.14), Y(5.75)); g.stroke(); }
  fillPoly(g, m, [[cx - 0.32, 5.35], [cx + 0.32, 5.35], [cx + 0.32, 5.75], [cx, 6.05], [cx - 0.32, 5.75]], '#8d7a62');   // shield
  R(cx - 0.05, 5.5, cx + 0.05, 5.95, '#d8cdb5');
}
function buildAbatellis() {
  initShared();
  const pts = pairsOf(AB.p), gr = groundRange(pts), cen = cenOf(pts), E = edgeFrame(pts, 0, cen, 0);
  const y0 = groundY(E.mx, E.mz), F = E.F, at = (x, y, z) => mul(F, tr(x, y, z)), L = E.L;
  const Fy = frame(E.mx, y0, E.mz, E.nx, E.nz), aty = (x, y, z) => mul(Fy, tr(x, y, z));
  defMat('abFront', 384, 384, [AB_TW, AB_H], paintAbFront);
  defMat('abPortal', 384, 320, [8.4, 6.6], paintAbPortal, { alphaTest: 0.5 });
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + AB_H - 0.8;
  const ua = (E.mx * E.nz - E.mz * E.nx) / AB_TW;   // aligns the world-tiled walls with the front tile (the front itself is the panel below)
  prism('abFront', pts, lo, top, { uvo: [0, -y0 / AB_H] });
  prism('flat', pts, top, top + 0.15, { c: '#8b8272' });
  corniceRing(pts, top - 0.55, '#bda57b', { d: 0.4 });
  // the front: one painted panel, string course, cornice with gargoyles, crenellated parapet
  panel('abFront', L, AB_H - 0.8, { M: aty(0, 0, 0.04), uvk: [L / AB_TW, (AB_H - 0.8) / AB_H], uvo: [0, 0.8 / AB_H] });
  bx('flat', Fy, -L / 2, L / 2, AB_GF - 0.1, AB_GF + 0.42, 0, 0.3, { c: '#c4a77c', noao: true });
  bx('flat', Fy, -L / 2, L / 2, AB_GF - 0.28, AB_GF - 0.1, 0, 0.18, { c: '#8a7660', noao: true });
  for (const x of [-L / 2 + AB_BW * 1.5, -L / 2 + AB_BW * 4.5, L / 2 - AB_BW * 2.5]) bx('flat', Fy, x - 0.15, x + 0.15, AB_H - 2.9, AB_H - 1.9, 0.1, 1.1, { c: '#b59b72', noao: true });   // gargoyles
  crenel(aty(0, top - y0, -0.15), L, { c: '#c4a87c' });
  // the portal in the fifth bay: painted carving plus a proud lintel and jamb blocks
  const xp = -L / 2 + AB_BW * 5.5;
  panel('abPortal', 8.4, 6.6, { M: aty(xp, 0, 0.09), uvk: [1, 1] });
  for (const sg of [-1, 1]) bx('stone', Fy, xp + sg * 1.78 - 0.2, xp + sg * 1.78 + 0.2, 0, 3.4, 0.04, 0.3, { c: '#a68468', noao: true });
  bx('stone', Fy, xp - 2.0, xp + 2.0, 4.85, 5.05, 0.04, 0.3, { c: '#a68468', noao: true });
  // the tower at the right end: stone box above the roof, a ring of corbels and a crenellated top
  const TW = 6.8, TH = 5.6, tx0 = L / 2 - TW, tx1 = L / 2 - 0.05, tz0 = -6.8, tz1 = -0.05;
  bx('abFront', Fy, tx0, tx1, top - y0, top - y0 + TH, tz0, tz1, { uvo: [0, 7.0 / AB_H - top / AB_H] });
  bx('flat', Fy, tx0 - 0.3, tx1 + 0.3, top - y0 + TH - 1.1, top - y0 + TH - 0.7, tz0 - 0.3, tz1 + 0.3, { c: '#c0a478', noao: true });
  for (let k = 0; k < 9; k++) { const x = tx0 + (k + 0.5) * (tx1 - tx0) / 9; bx('flat', Fy, x - 0.2, x + 0.2, top - y0 + TH - 1.6, top - y0 + TH - 1.1, 0.0, 0.5, { c: '#b59b72', noao: true }); }
  bx('flat', Fy, tx0 - 0.3, tx1 + 0.3, top - y0 + TH, top - y0 + TH + 0.12, tz0 - 0.3, tz1 + 0.3, { c: '#8b8272', noao: true });
  for (const [x, z, len, ry] of [[(tx0 + tx1) / 2, tz1 + 0.15, tx1 - tx0 + 0.6, 0], [(tx0 + tx1) / 2, tz0 - 0.15, tx1 - tx0 + 0.6, PI], [tx0 - 0.15, (tz0 + tz1) / 2, tz1 - tz0 + 0.6, -PI / 2], [tx1 + 0.15, (tz0 + tz1) / 2, tz1 - tz0 + 0.6, PI / 2]])
    crenel(mul(aty(x, top - y0 + TH + 0.12, z), frame(0, 0, 0, Math.sin(ry), Math.cos(ry))), len, { c: '#c4a87c' });
  const o = end('Palazzo Abatellis');
  o.userData.solids = [[AB.p, null, top + 0.15], [boxRing(Fy, tx0, tx1, tz0, tz1, y0), null, top + TH]];
  return o;
}
function boxRing(Fm, x0, x1, z0, z1, y0) { const toW = (x, z) => { const e = Fm.elements; return [e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14]]; }; return [toW(x0, z0), toW(x1, z0), toW(x1, z1), toW(x0, z1)].flat(); }
export const ABATELLIS = { name: 'Palazzo Abatellis', x: 868, z: -95, radius: 45, skipIds: [AB.id], build: buildAbatellis };

// ====================================================================================================
// 2. Palazzo Mirto
// ====================================================================================================
const MI = { id: 'r403480.0', p: [579.5, -100.1, 599.8, -62, 621.9, -80.7, 617.8, -89.4, 609, -107.9], holes: [[598, -84.6, 601.7, -78.3, 609.3, -83.6, 605.4, -90.4], [592.7, -95.7, 595.4, -89.9, 602.8, -93.7, 600.3, -98.4]] };
const MI_H = 20.2, MI_L = Math.hypot(609 - 579.5, -107.9 + 100.1), MI_GW = MI_L / 3, MI_BW = MI_L / 6, MI_GH = 9.6;
function paintMiWall(g, w, h) {   // one bay 5.4 m wide, 20.2 m tall: ochre plaster, blue shutters, curved iron balconies
  const m = mk(g, w, h, MI_BW, MI_H), { R, X, Y, sx, sy } = m, cx = MI_BW / 2, r = RNG(9401);
  g.fillStyle = '#dbc08e'; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 420, 9402, ['rgba(255,236,190,0.10)', 'rgba(150,100,60,0.08)', 'rgba(225,195,150,0.12)'], w / 9, h / 38);
  R(0, 0, MI_BW, 1.7, '#a8946e'); for (let y = 0.45; y < 1.7; y += 0.45) R(0, y, MI_BW, y + 0.04, 'rgba(40,28,16,0.4)');   // tufa plinth
  R(0, 1.7, MI_BW, 1.95, '#c7ad7c');
  for (const y of [5.4, 10.8, 16.0]) { R(0, y - 0.15, MI_BW, y + 0.3, '#c8ae7e'); R(0, y - 0.2, MI_BW, y - 0.15, 'rgba(40,28,16,0.35)'); }
  R(0, 0, 0.3, MI_H, '#cdb384'); R(MI_BW - 0.3, 0, MI_BW, MI_H, '#cdb384');
  // ground floor: small barred windows
  R(cx - 0.75, 2.6, cx + 0.75, 4.4, '#b9a07a'); R(cx - 0.6, 2.75, cx + 0.6, 4.25, '#17140f'); for (let x = cx - 0.5; x < cx + 0.6; x += 0.16) R(x, 2.75, x + 0.04, 4.25, '#6c6f6f');
  // piano nobile, second floor: tall windows with open blue shutters and iron balconies
  for (const [y0, y1, bal] of [[6.3, 9.4, true], [11.6, 14.6, true], [17.0, 19.0, false]]) {
    R(cx - 0.9, y0 - 0.1, cx + 0.9, y1 + 0.25, '#cdb384'); R(cx - 0.62, y0, cx + 0.62, y1, '#232b36');
    const gl = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gl.addColorStop(0, 'rgba(170,190,205,0.35)'); gl.addColorStop(1, 'rgba(170,190,205,0.04)'); g.fillStyle = gl; g.fillRect(X(cx - 0.62), Y(y1), 1.24 * sx, (y1 - y0) * sy);
    R(cx - 0.03, y0, cx + 0.03, y1, '#6d7276');
    R(cx - 1.18, y0, cx - 0.64, y1, '#4b6a93'); R(cx + 0.64, y0, cx + 1.18, y1, '#4b6a93');   // shutters, open
    for (let y = y0 + 0.2; y < y1; y += 0.22) { R(cx - 1.16, y, cx - 0.66, y + 0.04, 'rgba(20,30,50,0.45)'); R(cx + 0.66, y, cx + 1.16, y + 0.04, 'rgba(20,30,50,0.45)'); }
    if (bal) {
      R(cx - 1.35, y0 - 0.1, cx + 1.35, y0 + 0.14, '#9c8f7e'); R(cx - 1.4, y0 - 0.3, cx + 1.4, y0 - 0.1, '#7e7364');
      g.strokeStyle = '#17181a'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(X(cx - 1.35), Y(y0 + 1.0)); g.lineTo(X(cx + 1.35), Y(y0 + 1.0)); g.stroke();
      for (let k = 0; k <= 14; k++) { const x = cx - 1.35 + k * 2.7 / 14; g.beginPath(); g.moveTo(X(x), Y(y0 + 0.14)); g.quadraticCurveTo(X(x + (k % 2 ? 0.06 : -0.06)), Y(y0 + 0.55), X(x), Y(y0 + 1.0)); g.stroke(); }
    }
    const gr = g.createLinearGradient(0, Y(y0 - 0.3), 0, Y(y0 - 1.5)); gr.addColorStop(0, 'rgba(50,34,18,0.34)'); gr.addColorStop(1, 'rgba(50,34,18,0)'); g.fillStyle = gr; g.fillRect(X(cx - 1.1), Y(y0 - 0.3), 2.2 * sx, 1.2 * sy);
  }
  R(0, MI_H - 1.3, MI_BW, MI_H - 0.5, '#cfb685'); R(0, MI_H - 1.35, MI_BW, MI_H - 1.3, 'rgba(40,28,16,0.4)');
  // plaster gone in patches, showing the tufa underneath
  for (let i = 0; i < 7; i++) { const x = r() * MI_BW * 0.8, y = 3 + r() * 15, pw = 0.5 + r() * 1.1, ph = 0.4 + r() * 0.9; R(x, y, x + pw, y + ph, i % 2 ? '#b99d73' : '#c4a883'); R(x, y, x + pw, y + 0.04, 'rgba(60,40,22,0.35)'); }
  wear(g, w, h, 9410, { lime: 6, soot: 12, foot: h * 0.07 });
}
function paintMiGate(g, w, h) {   // the street gate: 8.8 m wide, 8.2 m to the attic
  const m = mk(g, w, h, MI_GW, MI_GH), { R, X, Y, sx, sy } = m, cx = MI_GW / 2;
  paintAshlar(g, w, h, MI_GW, MI_GH, 0.55, 1.3, '#b99c62', '#7c653a', 9501, 1.7, 0.1);
  blotch(g, w, h, 110, 9502, ['rgba(220,190,120,0.18)', 'rgba(50,32,14,0.2)', 'rgba(110,120,70,0.12)'], w / 18, h / 26);
  for (let y = 0.35; y < 5.8; y += 0.9) { R(0, y, 2.3, y + 0.5, 'rgba(235,205,140,0.13)'); R(MI_GW - 2.3, y + 0.45, MI_GW, y + 0.95, 'rgba(235,205,140,0.13)'); }   // the jamb quoins
  const arch = roundArchPts(cx, 3.95, 2.1, 16);
  fillPoly(g, m, [[cx - 2.1, 0]].concat(arch, [[cx + 2.1, 0]]), '#16120d');
  // the court seen through: warm plaster, blue shutters, a balcony, the fan of iron spokes in the arch
  R(cx - 2.0, 0, cx + 2.0, 3.0, '#6e5a38'); R(cx - 2.0, 0, cx + 2.0, 0.9, '#3a3026');
  R(cx - 1.2, 1.0, cx + 1.8, 3.4, '#a58d5c'); for (let k = 0; k < 4; k++) R(cx - 1.0 + k * 0.75, 1.1, cx - 0.55 + k * 0.75, 2.7, '#4b5e78');
  g.save(); pathPts(g, m, [[cx - 2.1, 3.95]].concat(arch)); g.clip(); g.strokeStyle = 'rgba(190,200,190,0.55)'; g.lineWidth = 1.4;
  for (let k = 0; k <= 16; k++) { const a = PI * k / 16; g.beginPath(); g.moveTo(X(cx), Y(3.95)); g.lineTo(X(cx + 2.2 * Math.cos(a)), Y(3.95 + 2.2 * Math.sin(a))); g.stroke(); } g.restore();
  R(cx - 2.1, 3.9, cx + 2.1, 3.98, '#2c3a34');
  bandPts(g, m, roundArchPts(cx, 3.95, 2.3, 18), 0.38, '#b79660', 'rgba(50,34,14,0.55)', 0.42);   // voussoirs
  R(0, 6.15, MI_GW, 6.45, '#8c7342'); R(0, 6.45, MI_GW, 7.1, '#b09257'); R(0, 7.1, MI_GW, 7.28, '#8a7140');   // entablature
  for (let x = 0.3; x < MI_GW; x += 0.7) R(x, 6.2, x + 0.3, 6.45, 'rgba(40,28,12,0.4)');
  g.fillStyle = '#a5874f'; g.fillRect(0, Y(MI_GH), w, (MI_GH - 7.28) * sy);   // attic
  for (let y = 7.3; y < MI_GH; y += 0.38) R(0, y, MI_GW, y + 0.04, 'rgba(50,34,14,0.45)');
  R(cx - 2.2, 7.3, cx - 2.1, MI_GH, 'rgba(50,34,14,0.4)'); R(cx + 2.1, 7.3, cx + 2.2, MI_GH, 'rgba(50,34,14,0.4)');
  for (const x of [cx - 1.6, cx + 1.6]) { const gr = g.createLinearGradient(0, Y(6.2), 0, Y(4.6)); gr.addColorStop(0, 'rgba(90,110,40,0.45)'); gr.addColorStop(1, 'rgba(90,110,40,0)'); g.fillStyle = gr; g.fillRect(X(x), Y(6.2), 7, 1.5 * sy); }
  // carved masks over the springing, drapes in the spandrels
  for (const x of [cx - 2.9, cx + 2.9]) { g.fillStyle = '#c1a56f'; g.beginPath(); g.ellipse(X(x), Y(5.4), 0.3 * sx, 0.38 * sy, 0, 0, 2 * PI); g.fill(); R(x - 0.05, 4.3, x + 0.05, 5.0, '#7c6338'); }
  wear(g, w, h, 9510, { lime: 4, soot: 14, foot: h * 0.12 });
}
function buildMirto() {
  initShared();
  const pts = pairsOf(MI.p), holes = MI.holes.map(pairsOf), gr = groundRange(pts), cen = cenOf(pts), E = edgeFrame(pts, 4, cen, 0);
  const y0 = groundY(E.mx, E.mz), L = E.L, Fy = frame(E.mx, y0, E.mz, E.nx, E.nz), aty = (x, y, z) => mul(Fy, tr(x, y, z));
  defMat('miWall', 384, 384, [MI_BW, MI_H], paintMiWall);
  defMat('miGate', 384, 320, [MI_GW, MI_GH], paintMiGate);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + MI_H;
  prism('miWall', pts, lo, top, { holes, uvo: [0, -y0 / MI_H] });
  prism('flat', pts, top, top + 0.15, { holes, c: '#8f8678' });
  corniceRing(pts, top - 0.2, '#cfb685', { d: 0.4 });
  // the front: plaster bays either side, the gate in the middle (a little wider than the passage)
  const gx0 = -MI_GW / 2, gx1 = MI_GW / 2;
  for (let i = 0; i < 6; i++) {
    const x = -L / 2 + MI_BW * (i + 0.5), mid = i === 2 || i === 3, tn = ['#ffffff', '#f4eee2', '#ece4d4', '#faf4e8', '#f1e9da', '#fbf5ea'][i], fl = i % 2 ? -1 : 1;
    if (!mid) panel('miWall', MI_BW, MI_H, { M: aty(x, 0, 0.04), uvk: [fl, 1], uvo: [fl < 0 ? 1 : 0, 0], c: tn });
    else panel('miWall', MI_BW, MI_H - MI_GH, { M: aty(x, MI_GH, 0.04), uvk: [fl, (MI_H - MI_GH) / MI_H], uvo: [fl < 0 ? 1 : 0, MI_GH / MI_H], c: tn });   // above the gate the plaster carries on
  }
  bx('miWall', Fy, gx0, gx1, 0, MI_GH, -0.01, 0.04, { c: '#7a6a4a', noao: true });   // backing behind the gate, so no plaster shows round it
  panel('miGate', MI_GW, MI_GH, { M: aty(0, 0, 0.12), uvk: [1, 1] });
  bx('stone', Fy, -4.6, 4.6, 6.1, 6.5, 0.04, 0.7, { c: '#d2b27c', noao: true });   // proud cornice
  bx('stone', Fy, -4.5, 4.5, 7.28, 7.45, 0.04, 0.45, { c: '#cdab74', noao: true });
  for (const sg of [-1, 1]) bx('stone', Fy, sg * 3.4 - 0.55, sg * 3.4 + 0.55, 0, 6.1, 0.04, 0.35, { c: '#d6b680', noao: true });
  // the arms: a crowned shield with two spread wings, a flaming urn each end
  const c = '#d4b680';
  bx('stone', Fy, -1.1, 1.1, MI_GH, MI_GH + 2.1, 0.0, 0.5, { c, noao: true });
  for (const sg of [-1, 1]) { const a = Math.min(sg * 1.0, sg * 2.9), b = Math.max(sg * 1.0, sg * 2.9), a2 = Math.min(sg * 2.5, sg * 3.4), b2 = Math.max(sg * 2.5, sg * 3.4); bx('stone', Fy, a, b, MI_GH + 0.2, MI_GH + 1.0, 0.0, 0.35, { c, noao: true }); bx('stone', Fy, a2, b2, MI_GH + 0.6, MI_GH + 1.9, 0.0, 0.3, { c, noao: true }); bx('stone', mul(aty(sg * 2.7, MI_GH + 1.9, 0), frame(0, 0, 0, 0, 1)), -0.55, 0.55, 0, 0.5, 0, 0.28, { c, noao: true, rz: -sg * 0.6 }); }
  cyl('stone', 0.68, 0.78, 0.55, 8, { M: aty(0, MI_GH + 2.1, 0.25), c, noao: true }); sphere('stone', 0.42, { M: aty(0, MI_GH + 2.9, 0.25), c, seg: 6, noao: true });
  for (const sg of [-1, 1]) urn(aty(sg * 3.9, MI_GH, 0.3), 1.7, '#d4b680');
  const o = end('Palazzo Mirto');
  o.userData.solids = [[MI.p, MI.holes, top + 0.15]];
  return o;
}
export const MIRTO = { name: 'Palazzo Mirto', x: 600, z: -85, radius: 40, skipIds: [MI.id], build: buildMirto };

// ====================================================================================================
// 3. Palazzo Butera
// ====================================================================================================
const BU = { id: 'w86882286', p: [923.7, -269.7, 904.8, -256.5, 843.9, -361.5, 847.7, -362.6, 847.1, -365.8, 858.8, -370.7, 857, -377.4, 862.4, -378.8, 872.6, -351.9, 885.4, -320.9, 910.2, -283.2] };
const BU_TERR = 6.0, BU_PH = 15.0, BU_BAL = 1.5, BU_BP = 4.2, BU_TW = BU_BP * 2, BU_SET = 4.5;
function paintBuFront(g, w, h) {   // two bays 8.4 m wide, 15 m tall: cream plaster, honey stone strips and frames, curved hoods, iron balconies
  const m = mk(g, w, h, BU_TW, BU_PH), { R, X, Y, sx, sy } = m;
  g.fillStyle = '#e4d9c1'; g.fillRect(0, 0, w, h);
  blotch(g, w, h, 240, 9601, ['rgba(255,250,236,0.2)', 'rgba(170,140,100,0.12)', 'rgba(120,100,70,0.08)'], w / 6, h / 20);
  const STONE = '#c99e66', STONE2 = '#dab27c';
  R(0, 0, BU_TW, 0.5, '#b89466');
  for (const x of [0, BU_BP, BU_TW]) { const x0 = Math.max(0, x - 0.26), x1 = Math.min(BU_TW, x + 0.26); R(x0, 0.5, x1, BU_PH - 1.9, STONE); R(x0, 0.5, x0 + 0.05, BU_PH - 1.9, 'rgba(50,30,14,0.3)'); }
  for (const y of [5.3, 12.4]) { R(0, y, BU_TW, y + 0.28, STONE2); R(0, y - 0.05, BU_TW, y, 'rgba(50,30,14,0.35)'); }
  R(0, BU_PH - 1.9, BU_TW, BU_PH - 1.0, STONE2); R(0, BU_PH - 1.0, BU_TW, BU_PH, '#bd9560'); R(0, BU_PH - 1.95, BU_TW, BU_PH - 1.9, 'rgba(50,30,14,0.35)');
  for (let i = 0; i < 2; i++) {
    const cx = BU_BP * (i + 0.5);
    // lower row: windows with a curved hood
    R(cx - 0.8, 1.2, cx + 0.8, 4.1, STONE); R(cx - 0.62, 1.4, cx + 0.62, 3.9, '#20262e'); R(cx - 0.03, 1.4, cx + 0.03, 3.9, '#8d8f8a');
    g.fillStyle = STONE2; g.beginPath(); g.ellipse(X(cx), Y(4.1), 0.95 * sx, 0.7 * sy, 0, PI, 0); g.fill(); g.fillStyle = '#c4a272'; g.beginPath(); g.ellipse(X(cx), Y(4.1), 0.55 * sx, 0.4 * sy, 0, PI, 0); g.fill();
    // upper row: tall windows with shutters, hood and balcony on alternate bays
    R(cx - 0.95, 6.5, cx + 0.95, 11.9, STONE); R(cx - 0.72, 6.7, cx + 0.72, 11.7, '#1d222a'); R(cx - 0.03, 6.7, cx + 0.03, 11.7, '#8d8f8a');
    for (let y = 7.0; y < 11.6; y += 0.28) { R(cx - 0.7, y, cx - 0.04, y + 0.04, 'rgba(70,95,70,0.55)'); R(cx + 0.04, y, cx + 0.7, y + 0.04, 'rgba(70,95,70,0.55)'); }
    R(cx - 0.7, 6.7, cx - 0.04, 11.7, 'rgba(60,85,60,0.35)'); R(cx + 0.04, 6.7, cx + 0.7, 11.7, 'rgba(60,85,60,0.35)');
    g.fillStyle = STONE2; g.beginPath(); g.ellipse(X(cx), Y(11.9), 1.15 * sx, 0.72 * sy, 0, PI, 0); g.fill(); g.fillStyle = '#c4a272'; g.beginPath(); g.ellipse(X(cx), Y(11.9), 0.7 * sx, 0.42 * sy, 0, PI, 0); g.fill();
    if (i === 0) { R(cx - 1.25, 6.2, cx + 1.25, 6.5, '#9d9484'); g.strokeStyle = '#17181a'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(X(cx - 1.2), Y(7.4)); g.lineTo(X(cx + 1.2), Y(7.4)); g.stroke(); for (let k = 0; k <= 12; k++) { const x = cx - 1.2 + k * 2.4 / 12; g.beginPath(); g.moveTo(X(x), Y(6.5)); g.quadraticCurveTo(X(x + (k % 2 ? 0.06 : -0.06)), Y(6.95), X(x), Y(7.4)); g.stroke(); } }
    // wet streaks under the sills
    for (const [yy, ww] of [[1.2, 1.7], [6.5, 1.9]]) { const gr = g.createLinearGradient(0, Y(yy), 0, Y(yy - 1.3)); gr.addColorStop(0, 'rgba(60,44,28,0.32)'); gr.addColorStop(1, 'rgba(60,44,28,0)'); g.fillStyle = gr; g.fillRect(X(cx - ww / 2), Y(yy), ww * sx, 1.3 * sy); }
  }
  // flaking plaster
  const r = RNG(9610); for (let i = 0; i < 9; i++) { const x = r() * BU_TW * 0.85, y = 0.8 + r() * 11, pw = 0.5 + r() * 1.0, ph = 0.4 + r() * 0.8; R(x, y, x + pw, y + ph, i % 2 ? '#cfb88f' : '#bf9f72'); }
  wear(g, w, h, 9620, { lime: 6, soot: 10, foot: h * 0.05 });
}
function paintBuTerr(g, w, h) {   // the terrace wall, two bays 8.4 m wide, 6 m tall: pink-ochre plaster, tufa showing, small barred windows
  const m = mk(g, w, h, BU_TW, BU_TERR), { R, X, Y, sx, sy } = m;
  paintAshlar(g, w, h, BU_TW, BU_TERR, 0.5, 1.2, '#b39a6f', '#7e6a48', 9701, 1.4, 0.1);   // the old wall under the plaster
  const r = RNG(9702);
  for (let i = 0; i < 26; i++) { const x = r() * BU_TW, y = r() * BU_TERR, pw = 0.7 + r() * 1.9, ph = 0.5 + r() * 1.2; if (r() < 0.78) { R(x, y, x + pw, y + ph, ['#cb9f82', '#c4977a', '#d3a98c'][i % 3]); } }
  R(0, BU_TERR - 0.55, BU_TW, BU_TERR, '#cdb689'); R(0, BU_TERR - 0.6, BU_TW, BU_TERR - 0.55, 'rgba(40,26,14,0.45)');   // coping
  R(0, 0, BU_TW, 0.5, '#8d7a5c');
  for (const x of [0.4, BU_BP + 0.4]) { R(x + 0.4, 1.4, x + 1.9, 2.4, '#bfa87c'); R(x + 0.55, 1.55, x + 1.75, 2.25, '#0f0e0d'); for (let k = 0; k < 6; k++) R(x + 0.6 + k * 0.2, 1.55, x + 0.64 + k * 0.2, 2.25, '#6a6e6e'); }
  for (const x of [0, BU_TW]) { R(Math.max(0, x - 0.35), 0.5, Math.min(BU_TW, x + 0.35), BU_TERR - 0.6, 'rgba(210,190,150,0.35)'); }
  wear(g, w, h, 9710, { lime: 6, soot: 16, foot: h * 0.16, bw: w / 6, bh: h / 8 });
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(70,95,50,0.17)'; g.fillRect(r() * w, h - (0.2 + r() * 1.2) * m.sy, 20 + r() * 40, (0.3 + r() * 0.6) * m.sy); }   // damp at the foot
}
function buildButera() {
  initShared();
  const pts = pairsOf(BU.p), gr = groundRange(pts), cen = cenOf(pts), y0 = gr.avg;
  const roofY = y0 + BU_TERR + BU_PH;
  defMat('buFront', 384, 384, [BU_TW, BU_PH], paintBuFront);
  defMat('buTerr', 384, 256, [BU_TW, BU_TERR], paintBuTerr);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, tY = y0 + BU_TERR;
  // the palace ring: the sea front (edges 7 to 10) set back from the terrace wall
  const fe = [7, 8, 9, 10], off = {};
  for (const i of fe) { const E = edgeFrame(pts, i, cen, y0); off[i] = { p: [E.A[0] - E.nx * BU_SET, E.A[1] - E.nz * BU_SET], d: [E.B[0] - E.A[0], E.B[1] - E.A[1]] }; }
  const up = pts.map(p => p.slice());
  up[8] = lineX(off[7].p, off[7].d, off[8].p, off[8].d); up[9] = lineX(off[8].p, off[8].d, off[9].p, off[9].d); up[10] = lineX(off[9].p, off[9].d, off[10].p, off[10].d);
  up[7] = lineX(off[7].p, off[7].d, pts[6], [pts[7][0] - pts[6][0], pts[7][1] - pts[6][1]]); up[0] = lineX(off[10].p, off[10].d, pts[0], [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]);
  prism('buTerr', pts, lo, tY, { uvo: [0, -y0 / BU_TERR] });
  prism('flat', pts, tY, tY + 0.12, { c: '#85795c' });
  prism('buFront', up, tY, roofY - 0.1, { uvo: [0, -tY / BU_PH] });
  prism('flat', up, roofY - 0.1, roofY + 0.1, { c: '#8c8274' });
  corniceRing(up, roofY - 0.1, '#bd9560', { d: 0.4, c2: '#8a7655', skip: i => fe.indexOf(i) >= 0 });
  for (const i of fe) {
    const T = edgeFrame(pts, i, cen, y0), U = edgeFrame(up, i, cen, tY), n = Math.max(2, Math.round(T.L / BU_TW)), tw = T.L / n;
    // the terrace wall front, the palace front above it
    panel('buTerr', T.L, BU_TERR, { M: T.at(0, 0, 0.04), uvk: [T.L / BU_TW, 1] });
    bx('flat', T.F, -T.L / 2, T.L / 2, BU_TERR - 0.55, BU_TERR + 0.05, 0, 0.45, { c: '#cdb689', noao: true });
    panel('buFront', U.L, BU_PH, { M: U.at(0, 0, 0.04), uvk: [U.L / BU_TW, 1] });
    bx('flat', U.F, -U.L / 2, U.L / 2, BU_PH - 1.6, BU_PH - 0.9, 0, 0.5, { c: '#d6ad78', noao: true });
    bx('flat', U.F, -U.L / 2, U.L / 2, BU_PH - 0.9, BU_PH, 0, 0.62, { c: '#c49b66', noao: true });
    bx('flat', U.F, -U.L / 2, U.L / 2, 5.25, 5.6, 0, 0.3, { c: '#d6ad78', noao: true });
    balus(U.at(0, BU_PH, 0.2), U.L, BU_BAL, { c: '#e6dccb' });
    rail(T.at(0, BU_TERR + 0.12, 0.15), T.L, 1.1, {});
    for (let k = 0; k <= n; k++) {
      const x = -U.L / 2 + k * U.L / n; bx('flat', U.F, x - 0.3, x + 0.3, BU_PH, BU_PH + BU_BAL, 0.0, 0.6, { c: '#d6ad78', noao: true }); urn(U.at(x, BU_PH + BU_BAL, 0.3), 1.5, '#d9b98a');
      const xt = -T.L / 2 + k * T.L / n; bx('flat', T.F, xt - 0.4, xt + 0.4, BU_TERR + 0.12, BU_TERR + 1.4, 0.05, 0.8, { c: '#c9b184', noao: true }); urn(T.at(xt, BU_TERR + 1.4, 0.45), 1.6, '#cdb48a');
    }
  }
  // the belvedere tower at the north end of the front, rising above the roof
  const U7 = edgeFrame(up, 7, cen, tY), tx1 = U7.L / 2 - 0.1, tx0 = tx1 - 7.4, TH = 5.2;
  bx('buFront', U7.F, tx0, tx1, BU_PH, BU_PH + TH, -7.4, -0.1, { uvo: [0, 6.6 / BU_PH - roofY / BU_PH] });
  bx('flat', U7.F, tx0 - 0.3, tx1 + 0.3, BU_PH + TH - 0.5, BU_PH + TH + 0.15, -7.7, 0.2, { c: '#c49b66', noao: true });
  balus(U7.at((tx0 + tx1) / 2, BU_PH + TH + 0.15, 0.05), tx1 - tx0 + 0.6, 1.2, { c: '#e6dccb' });
  const o = end('Palazzo Butera');
  o.userData.solids = [[BU.p, null, roofY + 0.1]];
  return o;
}
export const BUTERA = { name: 'Palazzo Butera', x: 884, z: -320, radius: 80, skipIds: [BU.id], build: buildButera };

// ====================================================================================================
// 4. Palazzo Sclafani
// ====================================================================================================
const SC = { id: 'w279883571', p: [-413.4, 352.2, -407.1, 349, -400.9, 345.9, -397.6, 352.3, -395.3, 356.7, -382.8, 380.7, -357.6, 367.7, -347.8, 362.7, -343.3, 371.4, -354.8, 377.2, -410.6, 405.7, -420.5, 386.6, -411.8, 382.2, -408.9, 387.9, -393, 379.8, -403.8, 358.9, -419.4, 366.8, -414.9, 375.6, -423.8, 380.1, -431.5, 363, -417, 354.6] };
const SC_H = 23.1, SC_LOW = 12.9, SC_UP = SC_H - SC_LOW, SC_GF = 5.6, SC_N = 9, SC_L = Math.hypot(-410.6 + 354.8, 405.7 - 377.2), SC_BW = SC_L / SC_N, SC_PB = 6;   // portal bay (0-based)
function paintScLow(g, w, h) {   // one bay, 12.9 m: ground floor with barred windows, first floor with small windows, string course, wires
  const m = mk(g, w, h, SC_BW, SC_LOW), { R, X, Y, sx, sy } = m, cx = SC_BW / 2;
  paintAshlar(g, w, h, SC_BW, SC_LOW, 0.5, 1.1, '#c99a68', '#9b704d', 9301, 1.4, 0.1);
  g.save(); g.beginPath(); g.rect(0, Y(SC_GF), w, SC_GF * sy); g.clip();
  paintAshlar(g, w, h, SC_BW, SC_LOW, 0.5, 1.1, '#b98862', '#82593e', 9302, 1.5, 0.11); blotch(g, w, h, 40, 9303, ['rgba(210,160,110,0.18)', 'rgba(40,24,14,0.16)'], w / 7, h / 40); g.restore();
  R(0, SC_GF - 0.18, SC_BW, SC_GF + 0.2, '#c79a65'); R(0, SC_GF - 0.22, SC_BW, SC_GF - 0.18, 'rgba(30,20,12,0.55)');
  R(0, SC_GF + 0.2, 0.26, SC_LOW - 0.5, '#d4a36c'); R(SC_BW - 0.26, SC_GF + 0.2, SC_BW, SC_LOW - 0.5, '#d4a36c'); R(0.26, SC_GF + 0.2, 0.31, SC_LOW - 0.5, 'rgba(40,24,12,0.35)');
  // ground floor window: stone frame, dark glass behind iron bars
  R(cx - 0.95, 2.1, cx + 0.95, 4.5, '#bd8d63'); R(cx - 0.72, 2.3, cx + 0.72, 4.3, '#14110f');
  for (let x = cx - 0.64; x < cx + 0.7; x += 0.17) R(x, 2.3, x + 0.045, 4.3, '#7a7b76'); for (let y = 2.7; y < 4.3; y += 0.45) R(cx - 0.72, y, cx + 0.72, y + 0.045, '#7a7b76');
  R(cx - 1.05, 1.95, cx + 1.05, 2.3, '#c99a68');
  // first floor window: brown frame, blue glass, a stone surround
  R(cx - 0.9, 7.6, cx + 0.9, 10.6, '#cb9a64'); R(cx - 0.68, 7.8, cx + 0.68, 10.4, '#5b3a25'); R(cx - 0.6, 7.88, cx + 0.6, 10.32, '#2a3a56');
  const gl = g.createLinearGradient(0, Y(10.3), 0, Y(7.9)); gl.addColorStop(0, 'rgba(150,175,215,0.35)'); gl.addColorStop(1, 'rgba(20,30,50,0.2)'); g.fillStyle = gl; g.fillRect(X(cx - 0.6), Y(10.32), 1.2 * sx, 2.44 * sy);
  R(cx - 0.03, 7.88, cx + 0.03, 10.32, '#5b3a25'); R(cx - 0.6, 9.0, cx + 0.6, 9.06, '#5b3a25'); R(cx - 1.0, 7.45, cx + 1.0, 7.65, '#d6a870');
  // the cables along the string course
  g.strokeStyle = 'rgba(18,14,12,0.85)'; g.lineWidth = 1.6; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, Y(5.0 + k * 0.14)); g.quadraticCurveTo(w / 2, Y(4.82 + k * 0.14), w, Y(5.0 + k * 0.14)); g.stroke(); }
  R(0, SC_LOW - 0.55, SC_BW, SC_LOW, '#d3a56d'); R(0, SC_LOW - 0.6, SC_BW, SC_LOW - 0.55, 'rgba(25,15,8,0.6)'); R(0, SC_LOW - 0.55, SC_BW, SC_LOW - 0.45, 'rgba(255,230,180,0.25)');
  for (const x of [cx - 0.75, cx + 0.5]) { const gr = g.createLinearGradient(0, Y(7.45), 0, Y(5.9)); gr.addColorStop(0, 'rgba(40,25,14,0.34)'); gr.addColorStop(1, 'rgba(40,25,14,0)'); g.fillStyle = gr; g.fillRect(X(x), Y(7.45), 0.4 * sx, 1.55 * sy); }
  wear(g, w, h, 9310, { lime: 7, soot: 12, foot: h * 0.07 });
}
function paintScUp(g, w, h) {   // one bay, 10.2 m: the blind pointed arch with two arched windows, rosette and cross inlay
  const m = mk(g, w, h, SC_BW, SC_UP), { R, X, Y, sx, sy } = m, cx = SC_BW / 2;
  paintAshlar(g, w, h, SC_BW, SC_UP, 0.46, 0.95, '#d3a672', '#a97d52', 9401, 1.4, 0.1);
  const hwO = SC_BW / 2 - 0.4, outer = archPts(cx, 4.4, hwO, 5.45), inner = archPts(cx, 3.85, 1.6, 2.3);
  fillPoly(g, m, [[cx - hwO, 0.4]].concat(outer, [[cx + hwO, 0.4]]), 'rgba(240,205,150,0.16)');
  fillPoly(g, m, [[cx - 1.6, 0.4]].concat(inner, [[cx + 1.6, 0.4]]), 'rgba(250,215,165,0.18)');
  R(0, 0.35, 0.3, SC_UP, '#d9ac72'); R(SC_BW - 0.3, 0.35, SC_BW, SC_UP, '#d9ac72'); R(0.3, 0.35, 0.36, SC_UP, 'rgba(40,25,12,0.35)');
  bandPts(g, m, outer, 0.3, '#e1c595', '#2f241b', 0.3);
  bandPts(g, m, archPts(cx, 4.4, hwO + 0.22, 5.62), 0.1, '#b58654', null, 0);
  bandPts(g, m, inner, 0.3, '#e6d2a8', '#241b14', 0.26);
  for (const dx of [-0.6, 0.6]) {   // the two arched lights
    const xc = cx + dx, lr = 0.47;
    g.beginPath(); g.moveTo(X(xc - lr), Y(0.75)); g.lineTo(X(xc - lr), Y(3.5)); g.ellipse(X(xc), Y(3.5), lr * sx, lr * sy, 0, PI, 0); g.lineTo(X(xc + lr), Y(0.75)); g.closePath();
    const gl = g.createLinearGradient(0, Y(4.0), 0, Y(0.75)); gl.addColorStop(0, '#34476e'); gl.addColorStop(1, '#1a2540'); g.fillStyle = gl; g.fill(); g.lineWidth = 2; g.strokeStyle = '#5a3a25'; g.stroke();
    g.fillStyle = 'rgba(160,185,225,0.22)'; g.fill();
    bandPts(g, m, roundArchPts(xc, 3.5, lr + 0.15, 10), 0.16, '#e7d3a6', '#3a2d22', 0.14);
  }
  R(cx - 0.07, 0.75, cx + 0.07, 3.75, '#ebe1cf'); R(cx - 0.13, 3.55, cx + 0.13, 3.8, '#d8cbb0');
  g.fillStyle = '#e4d0a4'; g.beginPath(); g.ellipse(X(cx), Y(5.05), 0.34 * sx, 0.34 * sy, 0, 0, 2 * PI); g.fill();
  g.fillStyle = '#4a3a2c'; for (const [a, b] of [[0, 0.15], [0.15, 0], [0, -0.15], [-0.15, 0]]) { g.beginPath(); g.ellipse(X(cx + a), Y(5.05 + b), 0.11 * sx, 0.11 * sy, 0, 0, 2 * PI); g.fill(); }
  R(cx - 0.05, 6.55, cx + 0.05, 7.4, '#1f1914'); for (const [dx, dy] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, 0.7], [0.2, 0.7], [0, 0.97]]) R(cx + dx - 0.13, 6.55 + dy - 0.13, cx + dx + 0.13, 6.55 + dy + 0.13, '#3a2c20');
  R(cx - 0.05, 8.3, cx + 0.05, 8.7, '#1f1914');
  // lime running from the haunches, soot under the cornice
  for (const x of [cx - hwO - 0.1, cx + hwO + 0.1, cx - 1.0, cx + 1.1]) { const gr = g.createLinearGradient(0, Y(4.5), 0, Y(0.8)); gr.addColorStop(0, 'rgba(240,232,215,0.4)'); gr.addColorStop(1, 'rgba(240,232,215,0)'); g.fillStyle = gr; g.fillRect(X(x) - 3, Y(4.5), 6, 3.7 * sy); }
  wear(g, w, h, 9410, { lime: 6, soot: 6, foot: h * 0.03 });
  R(0, SC_UP - 0.35, SC_BW, SC_UP, '#c99a65'); R(0, SC_UP - 0.4, SC_BW, SC_UP - 0.35, 'rgba(25,15,8,0.5)');
}
function paintScPortal(g, w, h) {   // 3.6 x 9.6 m on a transparent ground: the pointed portal under its gable, the aedicule with shields, the eagle
  const m = mk(g, w, h, 3.6, 9.6), { R, X, Y, sx, sy } = m, cx = 1.8;
  const tri = (hw, y0, y1, col) => fillPoly(g, m, [[cx - hw, y0], [cx, y1], [cx + hw, y0]], col);
  tri(1.72, 2.85, 5.45, '#9a7550'); tri(1.55, 2.85, 5.15, '#c29866'); tri(1.38, 2.85, 4.85, '#b4895a');
  fillPoly(g, m, [[cx - 1.5, 0]].concat(archPts(cx, 2.55, 1.5, 2.2), [[cx + 1.5, 0]]), '#c19662');
  bandPts(g, m, archPts(cx, 2.55, 1.62, 2.4), 0.2, '#d1ab78', '#5a4028', 0.18);
  fillPoly(g, m, [[cx - 1.12, 0]].concat(archPts(cx, 2.55, 1.12, 1.8), [[cx + 1.12, 0]]), '#2f1e12');
  for (let x = cx - 1.05; x < cx + 1.1; x += 0.3) R(x, 0, x + 0.03, 3.0, 'rgba(110,80,50,0.5)');
  R(cx - 1.12, 1.5, cx + 1.12, 1.56, 'rgba(110,80,50,0.5)');
  for (const sg of [-1, 1]) { R(cx + sg * 1.28 - 0.08, 0, cx + sg * 1.28 + 0.08, 2.5, '#d6bd92'); R(cx + sg * 1.28 - 0.14, 2.45, cx + sg * 1.28 + 0.14, 2.7, '#cfb27f'); }
  g.strokeStyle = 'rgba(60,40,22,0.55)'; g.lineWidth = 2; pathPts(g, m, [[cx - 1.72, 2.85], [cx, 5.45], [cx + 1.72, 2.85]]); g.stroke();
  // memorial aedicule: a gable, a pointed arch on two shafts, three shields and a tablet
  R(cx - 0.62, 5.62, cx + 0.62, 6.0, '#b8694a'); for (let y = 5.68; y < 5.98; y += 0.1) R(cx - 0.55, y, cx + 0.55, y + 0.03, 'rgba(70,30,20,0.5)');
  tri(0.98, 6.0, 7.75, '#a8805a'); fillPoly(g, m, [[cx - 0.7, 6.0]].concat(archPts(cx, 6.8, 0.7, 0.85), [[cx + 0.7, 6.0]]), '#7a5a3e');
  for (const dx of [-0.42, 0, 0.42]) { g.fillStyle = '#c9b497'; g.beginPath(); g.ellipse(X(cx + dx), Y(6.55), 0.17 * sx, 0.2 * sy, 0, 0, 2 * PI); g.fill(); }
  for (const sg of [-1, 1]) R(cx + sg * 0.72 - 0.06, 6.0, cx + sg * 0.72 + 0.06, 6.9, '#cfb78c');
  // the eagle on a corbel
  fillPoly(g, m, [[cx - 0.25, 8.05], [cx + 0.25, 8.05], [cx + 0.12, 8.5], [cx - 0.12, 8.5]], '#8d6a45');
  g.fillStyle = '#ecdcc0'; g.beginPath(); g.ellipse(X(cx), Y(8.95), 0.18 * sx, 0.4 * sy, 0, 0, 2 * PI); g.fill();
  for (const sg of [-1, 1]) fillPoly(g, m, [[cx + sg * 0.12, 8.75], [cx + sg * 0.82, 9.35], [cx + sg * 0.66, 8.85], [cx + sg * 0.4, 8.6]], '#e6d4b4');
  g.fillStyle = '#ecdcc0'; g.beginPath(); g.ellipse(X(cx + 0.06), Y(9.4), 0.1 * sx, 0.1 * sy, 0, 0, 2 * PI); g.fill();
  const gr = g.createLinearGradient(0, Y(9.0), 0, Y(7.0)); gr.addColorStop(0, 'rgba(60,35,20,0.3)'); gr.addColorStop(1, 'rgba(60,35,20,0)'); g.fillStyle = gr; g.fillRect(X(cx - 0.4), Y(8.5), 0.8 * sx, 1.5 * sy);
  noiseDots(g, w, h, 600, 1.4, 9501, ['rgba(40,26,16,0.12)', 'rgba(240,226,196,0.1)']);
}
function buildSclafani() {
  initShared();
  const pts = pairsOf(SC.p), gr = groundRange(pts), cen = cenOf(pts), E = edgeFrame(pts, 9, cen, 0);
  const y0 = groundY(E.mx, E.mz), L = E.L, Fy = frame(E.mx, y0, E.mz, E.nx, E.nz), aty = (x, y, z) => mul(Fy, tr(x, y, z));
  defMat('scLow', 384, 384, [SC_BW, SC_LOW], paintScLow);
  defMat('scUp', 384, 384, [SC_BW, SC_UP], paintScUp);
  defMat('scPortal', 256, 384, [3.6, 9.6], paintScPortal, { alphaTest: 0.5 });
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + SC_H;
  prism('scLow', pts, lo, y0 + SC_LOW, { uvo: [0, -y0 / SC_LOW] });
  prism('scUp', pts, y0 + SC_LOW, top, { uvo: [0, -(y0 + SC_LOW) / SC_UP] });
  prism('flat', pts, top, top + 0.15, { c: '#8e8576' });
  corniceRing(pts, top + 0.1, '#c99a65', { d: 0.3, skip: i => i === 9 });
  // the front, bay by bay (alternate bays mirrored and tinted so the repeat reads less)
  const tint = ['#ffffff', '#f3e6d8', '#ead9c4', '#fbefe0', '#efdfca', '#f6e9d9', '#ffffff', '#ecdcc7', '#f7ebdb'];
  for (let i = 0; i < SC_N; i++) {
    const x = -L / 2 + SC_BW * (i + 0.5), fl = i % 2 ? -1 : 1, o = { uvk: [fl, 1], uvo: [fl < 0 ? 1 : 0, 0], c: tint[i] };
    panel('scLow', SC_BW, SC_LOW, { M: aty(x, 0, 0.04), ...o });
    panel('scUp', SC_BW, SC_UP, { M: aty(x, SC_LOW, 0.04), ...o });
  }
  bx('flat', Fy, -L / 2, L / 2, SC_LOW - 0.5, SC_LOW + 0.05, 0.04, 0.32, { c: '#cfa26b', noao: true });
  bx('flat', Fy, -L / 2, L / 2, SC_H - 0.55, SC_H + 0.1, 0.04, 0.34, { c: '#c99a65', noao: true });
  bx('flat', Fy, -L / 2, L / 2, SC_GF - 0.18, SC_GF + 0.2, 0.04, 0.12, { c: '#c79a65', noao: true });
  // the portal in the seventh bay and a plain patch over the window it replaces
  const xp = -L / 2 + SC_BW * (SC_PB + 0.5);
  panel('tufa', 2.1, 3.1, { M: aty(xp, 7.3, 0.07), uvk: [0.6, 0.9], c: '#ecc99c', noao: true });
  panel('scPortal', 3.6, 9.6, { M: aty(xp, 0, 0.1), uvk: [1, 1] });
  for (const sg of [-1, 1]) bx('stone', Fy, xp + sg * 1.45 - 0.2, xp + sg * 1.45 + 0.2, 0, 2.7, 0.04, 0.34, { c: '#b88d5e', noao: true });
  const o = end('Palazzo Sclafani');
  o.userData.solids = [[SC.p, null, top + 0.15]];
  return o;
}
export const SCLAFANI = { name: 'Palazzo Sclafani', x: -385, z: 375, radius: 55, skipIds: [SC.id], build: buildSclafani };

export const BATCH_H = [ABATELLIS, MIRTO, BUTERA, SCLAFANI];
