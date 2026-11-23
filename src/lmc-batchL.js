// City landmarks, batch L: three buildings of Palermo drawn from reference photos. Registered in src/landmarks-city.js as BATCH_L.
// Teatro Biondo (Via Roma), Palazzo Comitini (Via Maqueda), Stazione di Palermo Notarbartolo. A fourth, Palazzo Francavilla (w230569846, Via Ruggero Settimo 8), is NOT built: no usable
// photo of its exterior exists on Wikimedia Commons (searches by name, by street and by category found nothing), so it stays a generic building.
// Frame of a front: origin on the ground at the middle of the front edge, +z out of the front, +x to the right seen from the street. Fronts are painted per bay on canvases (at most 512 px).
// Reference photos (Wikimedia Commons, looked at, nothing copied; proportions and colours read, then drawn procedurally):
//   Biondo: "Facciata del Teatro Biondo.jpg", "Teatro Biondo facciata.jpg", "Teatro Biondo Palermo.JPG", "Teatro Biondo.jpg"
//     read: two storeys in warm sand-grey stone; ground floor rusticated, round-arched shuttered openings in the wings, the middle a wide opening with two grey marble columns, a flat lintel and an iron gate;
//     upper floor: tall round-arched windows with archivolts over pierced stone balustrades; the middle block has three arches between two fluted pilasters each side, a frieze with the lettering TEATRO BIONDO and
//     a triangular pediment with scrolled acroteria; wings with arched windows between rusticated piers; the Via Venezia side is warmer ochre, round-arched ground floor and square windows with small pediments.
//   Comitini: "Palazzo Comitini.jpg", "Palazzo Gravina di Comitini.JPG", "Palazzo Comitini (Palermo) 20 06 2026 01.jpg"
//     read: four rows of windows on white plaster with ochre stone frames and wide ochre corner pilasters; barred ground floor windows with arched frames; plain balcony windows on the first floor; tall
//     shuttered french windows with triangular or segmental hoods and bellied iron balconies on stone brackets on the piano nobile; smaller balcony windows on top; the portal is an arch between grey stone columns under a balcony.
//   Notarbartolo: "Stazione Notarbartolo Palermo.JPG", "Stazione Palermo Notarbartolo - 1972.jpg", "Stazione di Palermo Notarbartolo, 3 ottobre 2024.jpg", "Stazione di Palermo Notarbartolo - Ingresso via Umberto Giordano.jpg"
//     read: a 1960s concrete station, one deep flat canopy slab projecting over the whole front, under it a glass curtain wall with steel mullions; cream concrete body above and behind with horizontal window strips.
// Footprints in world/tiles: Biondo w143740363 (tile 0_-1, anonymous; chosen by position: its 47 m east edge runs along Via Roma, the corner at Via Venezia matches the photo of the corner, and the existing facade spec names it Teatro Biondo;
//   the named "Kursaal Biondo" w215618518 is a different building near Via Dante), Comitini r4779716.0 (tile 0_0, anonymous; found by position: the bus stop "Maqueda - Palazzo Comitini" stands 4 m from its Via Maqueda edge,
//   the footprint is a four storey courtyard block), Notarbartolo w24890500 (named).
// Not verified: Comitini's footprint (the OSM block may cover only part of the real palace), which end of the Notarbartolo front the taller volume stands at (not drawn), the back and side walls of all three, the Biondo corner pavilion's curved pediments (not drawn).
import { PI, bx, box, cyl, extrude, begin, end, defMat, mul, tr, frame, prism, panel, pairsOf, groundRange, groundY, initShared, noiseDots, streaks, RNG } from './lmc-kit.js';
import * as THREE from 'three';

// ---------- shared helpers ----------
const mk = (g, w, h, wm, hm) => { const sx = w / wm, sy = h / hm, X = x => x * sx, Y = y => h - y * sy; return { sx, sy, X, Y, R: (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); } }; };
const blotch = (g, w, h, n, seed, cols, bw, bh) => { const r = RNG(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(r() * w, r() * h, bw * (0.4 + r()), bh * (0.4 + r())); } };
function wear(g, w, h, seed, o = {}) {   // stains, soot and lime streaks, grime at the foot, grain
  blotch(g, w, h, Math.round(w * h / 4000), seed + 1, ['rgba(255,238,205,0.10)', 'rgba(60,38,22,0.12)', 'rgba(255,248,230,0.07)'], w / 7, h / 12);
  streaks(g, w, h, o.lime === undefined ? 8 : o.lime, seed + 2, 0.22, h * 0.3, '244,236,218');
  streaks(g, w, h, o.soot === undefined ? 14 : o.soot, seed + 3, 0.2, h * 0.3, '34,26,18');
  noiseDots(g, w, h, w * h / 50, 1.7, seed + 4, ['rgba(38,26,16,0.13)', 'rgba(252,238,208,0.10)']);
  const fh = o.foot === undefined ? h * 0.1 : o.foot, gb = g.createLinearGradient(0, h, 0, h - fh); gb.addColorStop(0, 'rgba(26,19,13,0.42)'); gb.addColorStop(1, 'rgba(26,19,13,0)'); g.fillStyle = gb; g.fillRect(0, h - fh, w, fh);
}
function archPath(g, m, cx, y0, y1, hw) {   // a round-headed opening, from y0 to y1 (the top of the arch), half width hw
  g.beginPath(); g.moveTo(m.X(cx - hw), m.Y(y0)); g.lineTo(m.X(cx - hw), m.Y(y1 - hw)); g.ellipse(m.X(cx), m.Y(y1 - hw), hw * m.sx, hw * m.sy, 0, PI, 0); g.lineTo(m.X(cx + hw), m.Y(y0)); g.closePath();
}
function edgeF(A, B, cen, y0) {   // frame of the edge A->B with +z out of the footprint
  const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz); let nx = -dz / L, nz = dx / L; const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  if ((mx - cen[0]) * nx + (mz - cen[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const F = frame(mx, y0, mz, nx, nz);
  return { L, nx, nz, mx, mz, F, at: (x, y, z) => mul(F, tr(x, y, z)), toLocal: p => [(p[0] - mx) * nz - (p[1] - mz) * nx, (p[0] - mx) * nx + (p[1] - mz) * nz], toWorld: (x, z) => [mx + x * nz + z * nx, mz - x * nx + z * nz] };
}
function corniceRing(pts, top, c, o = {}) {   // a cornice straddling every edge but the skipped ones
  for (let i = 0; i < pts.length; i++) {
    if (o.skip && o.skip(i)) continue;
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez); if (l < 1.5) continue;
    const Fe = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -ez / l, ex / l), d = o.d || 0.3;
    bx('flat', Fe, -l / 2, l / 2, top - 0.95, top + 0.1, -d, d, { c, noao: true });
    bx('flat', Fe, -l / 2, l / 2, top - 1.35, top - 0.95, -d * 0.5, d * 0.5, { c: o.c2 || '#7f7461', noao: true });
  }
}
const cenOf = pts => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };

// ====================================================================================================
// 1. Teatro Biondo
// ====================================================================================================
const BI = { id: 'w143740363', p: [138.2, -211.3, 148.8, -214.3, 167.1, -171.1, 119.6, -167.8, 116.7, -175.2, 127.5, -178.8, 138.8, -182, 144.2, -184.6, 147.3, -188.6, 149.4, -192.5, 149.9, -196.3, 149.2, -200.7, 147, -204.4, 143.5, -207.7, 140.3, -210.6] };
const BH = 16.8, BGF = 7.0, BNB = 15.2, BCW = 15, BWW = 15.95, BPITCH = 5.0;
const B_STONE = '#d3bf98', B_LIGHT = '#e1d0aa', B_DARK = '#a68d66';
function bGround(g, m, w0, w1, y1) {   // rusticated ground floor: grooved courses
  const { R } = m; for (let y = 0.7; y < y1; y += 0.7) { R(w0, y, w1, y + 0.06, 'rgba(70,52,30,0.38)'); R(w0, y + 0.06, w1, y + 0.1, 'rgba(255,245,215,0.3)'); }
}
function bPierced(g, m, x0, x1, y0, y1) {   // a pierced stone balustrade panel
  const { R } = m; R(x0, y0, x1, y1, B_LIGHT); R(x0, y0, x1, y0 + 0.12, B_DARK); R(x0, y1 - 0.12, x1, y1, B_DARK);
  for (let x = x0 + 0.25; x < x1 - 0.3; x += 0.42) for (let y = y0 + 0.28; y < y1 - 0.3; y += 0.42) R(x, y, x + 0.2, y + 0.2, 'rgba(60,44,26,0.55)');
}
function bArchWin(g, m, cx, y0, y1, hw, ring) {   // a tall arched window with its archivolt, glass and bars
  const { R, X, Y, sx, sy } = m;
  g.fillStyle = 'rgba(40,28,14,0.3)'; archPath(g, m, cx + 0.12, y0, y1 + ring, hw + ring); g.fill();
  g.fillStyle = B_LIGHT; archPath(g, m, cx, y0, y1 + ring, hw + ring); g.fill();
  g.strokeStyle = 'rgba(80,60,36,0.55)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#9c8458'; archPath(g, m, cx, y0, y1 + 0.12, hw + 0.1); g.fill();
  const gl = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gl.addColorStop(0, '#33504a'); gl.addColorStop(1, '#223632'); g.fillStyle = gl; archPath(g, m, cx, y0, y1, hw); g.fill();
  g.save(); archPath(g, m, cx, y0, y1, hw); g.clip();
  R(cx - 0.05, y0, cx + 0.05, y1, '#c9c4b4'); for (const dx of [-hw * 0.5, hw * 0.5]) R(cx + dx - 0.03, y0, cx + dx + 0.03, y1 - hw * 0.7, '#a9aea4');
  R(cx - hw, y1 - hw - 0.55, cx + hw, y1 - hw - 0.47, '#c9c4b4'); R(cx - hw, y0 + (y1 - y0) * 0.45, cx + hw, y0 + (y1 - y0) * 0.45 + 0.07, '#a9aea4');
  const sh = g.createLinearGradient(0, Y(y1), 0, Y(y0)); sh.addColorStop(0, 'rgba(190,210,200,0.22)'); sh.addColorStop(1, 'rgba(190,210,200,0)'); g.fillStyle = sh; g.fillRect(X(cx - hw), Y(y1), 2 * hw * sx, (y1 - y0) * sy);
  g.restore();
  R(cx - hw - ring, y0 - 0.12, cx + hw + ring, y0, '#cdbb92');   // sill
}
function paintBCent(g, w, h) {
  const m = mk(g, w, h, BCW, BH), { R, X, Y, sx, sy } = m, cx = BCW / 2;
  R(0, 0, BCW, BH, B_STONE); noiseDots(g, w, h, w * h / 30, 1.8, 7101, ['rgba(110,86,52,0.10)', 'rgba(255,244,214,0.10)']);
  bGround(g, m, 0, BCW, BGF);
  R(0, BGF - 0.05, BCW, BGF + 0.55, B_LIGHT); R(0, BGF - 0.1, BCW, BGF - 0.04, 'rgba(40,28,14,0.5)');   // the string course
  // entrance: a wide opening with a flat lintel, dark hall with a warm glow, an iron gate; the two marble columns are geometry
  R(1.7, 0, 13.3, 6.2, B_DARK); R(2.1, 0, 12.9, 6.2, '#1a150f');
  { const gl = g.createLinearGradient(0, Y(6.2), 0, Y(0)); gl.addColorStop(0, 'rgba(240,190,110,0.05)'); gl.addColorStop(1, 'rgba(240,190,110,0.5)'); g.fillStyle = gl; g.fillRect(X(2.1), Y(6.2), 10.8 * sx, 6.2 * sy); }
  g.fillStyle = '#0f0c09'; for (const x of [4.6, 7.5, 10.4]) g.fillRect(X(x - 0.45), Y(5.4), 0.9 * sx, 4.4 * sy);   // the doors seen through
  g.fillStyle = '#17171b'; for (let x = 2.3; x < 12.9; x += 0.3) g.fillRect(X(x), Y(4.1), 0.05 * sx, 3.9 * sy);
  R(2.1, 1.9, 12.9, 1.97, '#17171b'); R(2.1, 3.9, 12.9, 3.97, '#17171b'); R(2.1, 0.3, 12.9, 0.37, '#17171b');
  for (let k = 0; k < 4; k++) { g.strokeStyle = '#17171b'; g.lineWidth = 1.4; g.beginPath(); g.arc(X(2.9 + k * 3.0), Y(2.9), 0.55 * sx, 0, 7); g.stroke(); }
  R(1.6, 6.2, 13.4, 7.0, B_LIGHT); R(1.6, 6.15, 13.4, 6.22, 'rgba(40,28,14,0.55)');
  for (const s of [-1, 1]) { R(s < 0 ? 0.6 : 13.6, 0.2, s < 0 ? 1.7 : 14.7, 4.6, '#5a2a2a'); R(s < 0 ? 0.75 : 13.75, 0.4, s < 0 ? 1.55 : 14.55, 4.4, '#e8dfc8'); }   // the two playbill frames
  // piano nobile: three arches over pierced balustrades, paired fluted pilasters each side
  for (const dx of [-3.4, 0, 3.4]) { bPierced(g, m, cx + dx - 1.55, cx + dx + 1.55, BGF + 0.6, BGF + 2.2); bArchWin(g, m, cx + dx, BGF + 2.2, 14.5, 1.3, 0.38); }
  for (const dx of [-1.7, 1.7]) for (const s of [-1, 1]) { const x = cx + s * 3.4 + dx; if (Math.abs(x - cx) < 5.4) { R(x - 0.14, BGF + 2.2, x + 0.14, 13.2, '#e8dcb8'); R(x - 0.2, 13.2, x + 0.2, 13.5, B_LIGHT); } }
  for (const s of [-1, 1]) for (const [a, b] of [[4.9, 5.9], [6.1, 7.1]]) {
    const x0 = s < 0 ? cx - b : cx + a; R(x0, BGF + 0.6, x0 + 1.0, 15.2, '#d9c8a0'); R(x0 - 0.1, BGF + 0.6, x0 + 1.1, BGF + 1.0, B_LIGHT);
    for (let f = 0; f < 4; f++) R(x0 + 0.15 + f * 0.22, BGF + 1.0, x0 + 0.2 + f * 0.22, 14.6, 'rgba(70,52,30,0.4)');
    R(x0 - 0.1, 14.6, x0 + 1.1, 15.2, B_LIGHT);
  }
  // entablature: architrave, the lettering, a frieze, dentils
  R(0, 15.2, BCW, 16.8, '#dccaa2'); R(0, 15.15, BCW, 15.25, 'rgba(40,28,14,0.5)'); R(0, 16.0, BCW, 16.06, 'rgba(70,52,30,0.4)');
  g.fillStyle = 'rgba(66,50,30,0.8)'; for (let x = 0.1; x < BCW; x += 0.5) g.fillRect(X(x), Y(16.75), 0.25 * sx, 0.5 * sy);
  R(3.4, 15.4, 11.6, 15.95, '#e4d6b4'); g.fillStyle = 'rgba(60,46,28,0.85)'; g.font = `bold ${Math.round(0.45 * sy)}px "Times New Roman", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  { const t = 'TEATRO BIONDO'; for (let i = 0; i < t.length; i++) if (t[i] !== ' ') g.fillText(t[i], X(cx + (i - 6) * 0.5 - 0.15), Y(15.7)); }
  wear(g, w, h, 7110, { foot: h * 0.12 });
}
function paintBWing(g, w, h) {   // x = 0 is the outer end of the wing, x = BWW the middle block
  const m = mk(g, w, h, BWW, BH), { R, X, Y, sx, sy } = m, XS = [3.3, 8.3, 13.3];
  R(0, 0, BWW, BH, B_STONE); noiseDots(g, w, h, w * h / 30, 1.8, 7201, ['rgba(110,86,52,0.10)', 'rgba(255,244,214,0.10)']);
  bGround(g, m, 0, BWW, BGF);
  for (const x of XS) {   // round-arched shuttered openings in the rustication, with voussoirs
    g.fillStyle = 'rgba(40,28,14,0.3)'; archPath(g, m, x + 0.1, 0.9, 6.1, 1.8); g.fill();
    g.fillStyle = B_LIGHT; archPath(g, m, x, 0.9, 6.1, 1.7); g.fill();
    g.fillStyle = '#4d5a50'; archPath(g, m, x, 0.9, 5.7, 1.35); g.fill();
    g.save(); archPath(g, m, x, 0.9, 5.7, 1.35); g.clip(); for (let y = 1.0; y < 5.7; y += 0.14) R(x - 1.4, y, x + 1.4, y + 0.05, 'rgba(15,25,20,0.5)'); g.restore();
    g.strokeStyle = 'rgba(70,52,30,0.5)'; g.lineWidth = 1; for (let a = 0; a < 9; a++) { const t = PI + a / 8 * PI; g.beginPath(); g.moveTo(X(x + Math.cos(t) * 1.35), Y(4.35 - Math.sin(t) * 1.35)); g.lineTo(X(x + Math.cos(t) * 1.7), Y(4.35 - Math.sin(t) * 1.7)); g.stroke(); }
  }
  R(0, BGF - 0.05, BWW, BGF + 0.55, B_LIGHT); R(0, BGF - 0.1, BWW, BGF - 0.04, 'rgba(40,28,14,0.5)');
  for (const x of XS) { bPierced(g, m, x - 1.5, x + 1.5, BGF + 0.6, BGF + 2.2); bArchWin(g, m, x, BGF + 2.2, 14.4, 1.2, 0.4); }
  for (const [a, b] of [[0, 1.8], [4.3, 7.3], [9.3, 12.3], [14.8, BWW]]) {   // rusticated piers between the windows
    R(a, BGF + 0.6, b, 15.2, '#d5c19a'); for (let y = BGF + 1.2; y < 15.2; y += 0.7) { R(a, y, b, y + 0.05, 'rgba(70,52,30,0.4)'); R(a, y + 0.05, b, y + 0.09, 'rgba(255,245,215,0.28)'); }
  }
  R(0, 15.2, BWW, 16.8, '#dccaa2'); R(0, 15.15, BWW, 15.25, 'rgba(40,28,14,0.5)'); R(0, 16.0, BWW, 16.06, 'rgba(70,52,30,0.4)');
  g.strokeStyle = 'rgba(80,60,36,0.6)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 8; k++) { const x0 = X(k * 2.0), x1 = X(k * 2.0 + 2.0); g.moveTo(x0, Y(16.6)); g.quadraticCurveTo((x0 + x1) / 2, Y(15.4), x1, Y(16.6)); } g.stroke();   // swags in the frieze
  g.fillStyle = 'rgba(66,50,30,0.8)'; for (let x = 0.1; x < BWW; x += 0.5) g.fillRect(X(x), Y(16.78), 0.25 * sx, 0.4 * sy);
  wear(g, w, h, 7210, { foot: h * 0.12 });
}
function paintBWall(g, w, h) {   // the Via Venezia side and the rear: warmer plaster, arched ground floor, square windows with small pediments; one bay of BPITCH
  const m = mk(g, w, h, BPITCH, BH), { R, X, Y, sx, sy } = m, cx = BPITCH / 2;
  R(0, 0, BPITCH, BH, '#d8c08a'); noiseDots(g, w, h, w * h / 30, 1.8, 7301, ['rgba(110,80,40,0.10)', 'rgba(255,244,214,0.10)']);
  for (let y = 0.8; y < BGF; y += 0.8) R(0, y, BPITCH, y + 0.05, 'rgba(70,50,26,0.25)');
  g.fillStyle = B_LIGHT; archPath(g, m, cx, 0.9, 6.0, 1.7); g.fill(); g.fillStyle = '#505c50'; archPath(g, m, cx, 0.9, 5.6, 1.35); g.fill();
  g.save(); archPath(g, m, cx, 0.9, 5.6, 1.35); g.clip(); for (let y = 1.0; y < 5.6; y += 0.14) R(cx - 1.4, y, cx + 1.4, y + 0.05, 'rgba(15,25,20,0.5)'); g.restore();
  R(0, BGF - 0.05, BPITCH, BGF + 0.5, '#e4d2a6'); R(0, BGF - 0.1, BPITCH, BGF - 0.04, 'rgba(40,28,14,0.5)');
  R(cx - 1.0, 9.4, cx + 1.0, 13.4, '#e4d2a6'); R(cx - 0.8, 9.6, cx + 0.8, 13.2, '#2d4540'); R(cx - 0.03, 9.6, cx + 0.03, 13.2, '#c9c4b4'); R(cx - 0.8, 11.3, cx + 0.8, 11.37, '#c9c4b4');
  g.fillStyle = '#e4d2a6'; g.beginPath(); g.moveTo(X(cx - 1.35), Y(13.4)); g.lineTo(X(cx), Y(14.55)); g.lineTo(X(cx + 1.35), Y(13.4)); g.closePath(); g.fill(); g.strokeStyle = 'rgba(70,52,30,0.5)'; g.stroke();
  R(cx - 1.2, 9.25, cx + 1.2, 9.4, '#cdbb92');
  R(0, 15.2, BPITCH, 16.8, '#e0cd9f'); R(0, 15.15, BPITCH, 15.25, 'rgba(40,28,14,0.5)');
  g.fillStyle = 'rgba(66,50,30,0.75)'; for (let x = 0.1; x < BPITCH; x += 0.5) g.fillRect(X(x), Y(16.75), 0.25 * sx, 0.5 * sy);
  wear(g, w, h, 7310);
}
function buildBiondo() {
  initShared();
  const pts = pairsOf(BI.p), gr = groundRange(pts), cen = cenOf(pts);
  const y0 = groundY((pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2), E = edgeF(pts[1], pts[2], cen, y0), at = E.at, F = E.F, L = E.L;
  defMat('blbCent', 512, 512, [BCW, BH], paintBCent);
  defMat('blbWing', 512, 512, [BWW, BH], paintBWing);
  defMat('blbWall', 256, 512, [BPITCH, BH], paintBWall);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + BH;
  prism('blbWall', pts, lo, top, { uvo: [0, -y0 / BH] });
  prism('flat', pts, top, top + 0.15, { c: '#8e867a' });
  corniceRing(pts, top + 0.1, '#d6c49c', { d: 0.35, skip: i => i === 1, c2: '#8a7a5c' });
  // the front: the middle block and the two wings (the right wing mirrored), cornice, string course
  const wx = BCW / 2 + BWW / 2;
  panel('blbCent', BCW, BH, { M: at(0, 0, 0.04), uvk: [1, 1] });
  panel('blbWing', BWW, BH, { M: at(-wx, 0, 0.04), uvk: [1, 1] });
  panel('blbWing', BWW, BH, { M: at(wx, 0, 0.04), uvk: [-1, 1], uvo: [1, 0] });
  bx('flat', F, -L / 2, L / 2, BH - 0.95, BH + 0.1, 0, 0.8, { c: '#d6c49c', noao: true });
  bx('flat', F, -L / 2, L / 2, BH - 1.35, BH - 0.95, 0, 0.45, { c: '#8a7a5c', noao: true });
  bx('flat', F, -L / 2, L / 2, BGF - 0.1, BGF + 0.5, 0, 0.3, { c: '#d9c7a0', noao: true });
  // the entrance: two grey marble columns on bases, steps, the lintel carried forward
  for (const s of [-1, 1]) {
    cyl('marble', 0.4, 0.42, 6.0, 14, { M: at(s * 1.65, 0.3, 0.55), c: '#cfcbc0' });
    bx('flat', F, s * 1.65 - 0.6, s * 1.65 + 0.6, 0, 0.3, -0.05 + 0.0, 1.15, { c: '#b9ae92', noao: true });
    bx('flat', F, s * 1.65 - 0.6, s * 1.65 + 0.6, 6.3, 6.6, -0.05, 1.15, { c: '#d3c19a', noao: true });
  }
  bx('flat', F, -5.6, 5.6, 6.2, 7.0, 0, 1.15, { c: '#dccaa2', noao: true });
  bx('flat', F, -6.2, 6.2, 0, 0.2, 0.9, 2.1, { c: '#bdb298', noao: true }); bx('flat', F, -6.6, 6.6, 0, 0.1, 1.9, 2.9, { c: '#b5aa90', noao: true });
  // the pediment over the middle block, with a raking cornice and a mask at the apex
  const PW = 8.6, PR = 3.1, ang = Math.atan2(PR, PW), sl = Math.hypot(PW, PR);
  const sh = new THREE.Shape(); sh.moveTo(-PW, 0); sh.lineTo(PW, 0); sh.lineTo(0, PR); sh.lineTo(-PW, 0);
  extrude('tufa', sh, 0.9, { M: F, p: [0, BH + 0.1, -0.1], c: '#dccaa2', noao: true });
  for (const s of [-1, 1]) {
    box('flat', sl, 0.38, 1.15, { M: F, p: [s * PW / 2, BH + 0.1 + PR / 2 - 0.1, -0.25], rz: -s * ang, c: '#d6c49c', noao: true });
    box('flat', sl, 0.18, 0.95, { M: F, p: [s * PW / 2, BH + 0.1 + PR / 2 - 0.32, -0.25], rz: -s * ang, c: '#8a7a5c', noao: true });
  }
  bx('flat', F, -0.5, 0.5, BH + PR + 0.0, BH + PR + 0.75, 0, 0.5, { c: '#cdb98f', noao: true });
  const o = end('Teatro Biondo');
  o.userData.solids = [[BI.p, null, top + 0.15]];
  return o;
}
export const BIONDO = { name: 'Teatro Biondo', x: 140, z: -191, radius: 45, skipIds: [BI.id], build: buildBiondo };

// ====================================================================================================
// 2. Palazzo Comitini
// ====================================================================================================
const CO = { id: 'r4779716.0', p: [117.5, 269.2, 127.6, 267.5, 144.7, 263.8, 156.8, 286.4, 139.8, 295.1, 141.8, 298.8, 137.3, 301.3, 133.2, 303.6, 132, 304.6, 131.6, 303.9, 129.6, 300.3, 134.6, 298.5, 130.3, 290.7, 126.4, 284.3, 129, 282.6, 117.1, 270.7],
  holes: [[137.4, 287, 143.9, 283.9, 140.8, 278.2, 134.2, 281.9]] };
const CH = 19.6, CBW = 5.0, C_WHITE = '#e9e2d0', C_OCHRE = '#cf9f58', C_OCHRE_L = '#dbb374', C_IRON = '#1d1b1c';
function cBalcony(g, m, cx, y, w, big) {   // a bellied iron balcony on stone brackets, drawn in front of the window
  const { R, X, Y, sx, sy } = m, hw = w / 2;
  R(cx - hw - 0.1, y - 0.28, cx + hw + 0.1, y, C_OCHRE_L); R(cx - hw - 0.1, y - 0.3, cx + hw + 0.1, y - 0.26, 'rgba(40,28,14,0.5)');
  for (const dx of [-hw * 0.7, 0, hw * 0.7]) { R(cx + dx - 0.12, y - 0.8, cx + dx + 0.12, y - 0.28, C_OCHRE); }
  g.strokeStyle = C_IRON; g.lineWidth = 1.6; g.beginPath(); const hh = big ? 1.1 : 0.95;
  g.moveTo(X(cx - hw), Y(y)); g.lineTo(X(cx - hw), Y(y + hh)); g.moveTo(X(cx + hw), Y(y)); g.lineTo(X(cx + hw), Y(y + hh)); g.moveTo(X(cx - hw), Y(y + hh)); g.lineTo(X(cx + hw), Y(y + hh)); g.moveTo(X(cx - hw), Y(y + 0.5)); g.lineTo(X(cx + hw), Y(y + 0.5));
  for (let x = cx - hw + 0.12; x < cx + hw; x += 0.16) { g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y + hh)); } g.stroke();
}
function cWindow(g, m, cx, y0, y1, w, o = {}) {   // a window with an ochre frame; o.arch, o.bars, o.hood ('tri' | 'seg'), o.shut
  const { R, X, Y, sx, sy } = m, hw = w / 2;
  if (o.arch) { g.fillStyle = C_OCHRE; archPath(g, m, cx, y0 - 0.25, y1 + 0.3, hw + 0.3); g.fill(); g.fillStyle = 'rgba(30,20,10,0.35)'; archPath(g, m, cx + 0.05, y0 - 0.1, y1 + 0.1, hw + 0.05); g.fill(); g.fillStyle = o.bars ? '#15130f' : '#3a2e24'; archPath(g, m, cx, y0, y1, hw); g.fill(); }
  else { R(cx - hw - 0.28, y0 - 0.2, cx + hw + 0.28, y1 + 0.28, C_OCHRE); R(cx - hw, y0, cx + hw, y1, '#3a2e24'); R(cx - hw - 0.28, y0 - 0.2, cx - hw - 0.2, y1 + 0.28, 'rgba(255,240,200,0.25)'); }
  if (o.bars) { g.fillStyle = '#6d6e6a'; for (let x = cx - hw + 0.1; x < cx + hw; x += 0.2) g.fillRect(X(x), Y(y1 - 0.15), 0.05 * sx, (y1 - y0 - 0.2) * sy); for (let y = y0 + 0.2; y < y1 - 0.3; y += 0.4) g.fillRect(X(cx - hw), Y(y), 2 * hw * sx, 0.05 * sy); }
  else if (o.shut) { g.save(); g.beginPath(); g.rect(X(cx - hw), Y(y1), 2 * hw * sx, (y1 - y0) * sy); g.clip(); for (let y = y0; y < y1; y += 0.12) R(cx - hw, y, cx + hw, y + 0.05, 'rgba(10,6,2,0.55)'); R(cx - 0.02, y0, cx + 0.02, y1, 'rgba(0,0,0,0.5)'); g.restore(); }
  if (o.hood) {
    const hh = o.hood === 'tri' ? 0.75 : 0.65, ww = hw + 0.55;
    g.fillStyle = C_OCHRE_L; g.beginPath(); g.moveTo(X(cx - ww), Y(y1 + 0.28)); if (o.hood === 'tri') g.lineTo(X(cx), Y(y1 + 0.28 + hh)); else g.quadraticCurveTo(X(cx), Y(y1 + 0.28 + hh * 2), X(cx + ww), Y(y1 + 0.28)); g.lineTo(X(cx + ww), Y(y1 + 0.28)); g.closePath(); g.fill();
    if (o.hood === 'tri') { g.beginPath(); g.moveTo(X(cx - ww), Y(y1 + 0.28)); g.lineTo(X(cx), Y(y1 + 0.28 + hh)); g.lineTo(X(cx + ww), Y(y1 + 0.28)); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(70,48,24,0.55)'; g.lineWidth = 1.2; g.stroke(); R(cx - ww, y1 + 0.2, cx + ww, y1 + 0.32, C_OCHRE);
    g.fillStyle = 'rgba(30,20,10,0.25)'; g.fillRect(X(cx - hw), Y(y1 + 0.2), 2 * hw * sx, 0.5 * sy * 0.6);
  }
}
function cBase(g, m, w, h) {   // white plaster with grooved courses, a grey stone plinth, an ochre cornice and string courses
  const { R } = m; R(0, 0, CBW, CH, C_WHITE);
  noiseDots(g, w, h, w * h / 40, 1.6, 7401, ['rgba(120,100,70,0.08)', 'rgba(255,255,250,0.10)']);
  for (let y = 1.8; y < 4.9; y += 0.65) R(0, y, CBW, y + 0.05, 'rgba(90,75,50,0.28)');
  R(0, 0, CBW, 1.1, '#8f877a'); R(0, 1.1, CBW, 1.2, 'rgba(40,30,20,0.4)');
  for (const y of [4.9, 9.8, 15.4]) { R(0, y - 0.07, CBW, y + 0.12, C_OCHRE_L); R(0, y - 0.1, CBW, y - 0.06, 'rgba(60,40,20,0.4)'); }
  R(0, 18.85, CBW, 19.6, C_OCHRE_L); R(0, 18.8, CBW, 18.86, 'rgba(40,28,14,0.5)'); R(0, 19.45, CBW, 19.6, C_OCHRE);
}
function paintCBay(g, w, h, i = 0) {
  const m = mk(g, w, h, CBW, CH), { R } = m, cx = CBW / 2; cBase(g, m, w, h);
  cWindow(g, m, cx, 1.9, 4.2, 1.6, { arch: true, bars: true });
  cWindow(g, m, cx, 5.9, 8.5, 1.3, { shut: true }); cBalcony(g, m, cx, 5.6, 2.0, false);
  cWindow(g, m, cx, 10.4, 14.0, 1.5, { shut: true, hood: i % 2 ? 'seg' : 'tri' }); cBalcony(g, m, cx, 10.2, 2.9, true);
  cWindow(g, m, cx, 16.1, 18.3, 1.3, { shut: true }); cBalcony(g, m, cx, 15.9, 2.0, false);
  wear(g, w, h, 7410 + i);
}
function paintCPortal(g, w, h) {
  const m = mk(g, w, h, CBW, CH), { R, X, Y, sx, sy } = m, cx = CBW / 2; cBase(g, m, w, h);
  g.fillStyle = C_OCHRE; archPath(g, m, cx, 0, 5.2, 1.9); g.fill();   // the portal arch and its dark door
  g.fillStyle = '#17110c'; archPath(g, m, cx, 0, 4.9, 1.55); g.fill();
  const gd = g.createLinearGradient(0, Y(4.9), 0, Y(0)); gd.addColorStop(0, 'rgba(250,200,120,0)'); gd.addColorStop(1, 'rgba(250,200,120,0.4)'); g.fillStyle = gd; archPath(g, m, cx, 0, 4.9, 1.55); g.fill();
  g.save(); archPath(g, m, cx, 0, 4.9, 1.55); g.clip(); g.fillStyle = '#5a3d24'; g.fillRect(X(cx - 1.4), Y(3.6), 2.8 * sx, 3.6 * sy); for (let x = cx - 1.4; x < cx + 1.4; x += 0.5) R(x, 0, x + 0.04, 3.6, 'rgba(15,8,3,0.5)'); g.restore();
  R(cx - 0.5, 5.05, cx + 0.5, 5.9, '#b8ad96');
  cWindow(g, m, cx - 1.9, 1.9, 4.0, 0.9, { arch: true, bars: true }); cWindow(g, m, cx + 1.9, 1.9, 4.0, 0.9, { arch: true, bars: true });
  cWindow(g, m, cx, 10.4, 14.0, 1.6, { shut: true, hood: 'seg' }); cBalcony(g, m, cx, 10.2, 3.4, true);
  cWindow(g, m, cx, 16.1, 18.3, 1.3, { shut: true }); cBalcony(g, m, cx, 15.9, 2.0, false);
  cWindow(g, m, cx - 1.7, 6.0, 8.5, 1.0, { shut: true }); cWindow(g, m, cx + 1.7, 6.0, 8.5, 1.0, { shut: true });
  wear(g, w, h, 7420);
}
function buildComitini() {
  initShared();
  const pts = pairsOf(CO.p), holes = [CO.holes[0].length ? pairsOf(CO.holes[0]) : []], gr = groundRange(pts), cen = cenOf(pts);
  const fronts = [[pts[2], pts[3], true], [pts[3], pts[4], false]];   // the Via Maqueda front (with the portal) and the south side
  const y0 = groundY((pts[2][0] + pts[3][0]) / 2, (pts[2][1] + pts[3][1]) / 2);
  defMat('blcBay', 192, 512, [CBW, CH], paintCBay);
  defMat('blcBay1', 192, 512, [CBW, CH], (g, w, h) => paintCBay(g, w, h, 1));
  defMat('blcPortal', 256, 512, [CBW, CH], paintCPortal);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + CH;
  prism('blcBay', pts, lo, top, { holes, uvo: [0, -y0 / CH] });
  prism('flat', pts, top, top + 0.15, { holes, c: '#8e8576' });
  corniceRing(pts, top + 0.1, '#d6a860', { d: 0.4, c2: '#9b7d52' });
  for (const [A, B, main] of fronts) {
    const E = edgeF(A, B, cen, y0), n = Math.max(2, Math.round(E.L / CBW)), bw = E.L / n, F = E.F;
    for (let i = 0; i < n; i++) {
      const x = -E.L / 2 + bw * (i + 0.5), key = main && i === Math.floor(n / 2) ? 'blcPortal' : i % 2 ? 'blcBay1' : 'blcBay';
      panel(key, bw, CH, { M: E.at(x, 0, 0.04), uvk: [1, 1] });
      for (const [yy, d] of [[5.6, 0.7], [10.2, 0.95], [15.9, 0.7]]) {   // the balcony slabs stand out of the wall
        const wdt = (yy === 10.2 ? (key === 'blcPortal' ? 3.4 : 2.9) : 2.0) + 0.2;
        bx('stone', F, x - wdt / 2, x + wdt / 2, yy - 0.28, yy, 0, d, { c: '#d9b377', noao: true });
      }
    }
    for (const s of [-1, 1]) bx('flat', F, s * E.L / 2 - (s > 0 ? 0.9 : 0), s * E.L / 2 + (s > 0 ? 0 : 0.9), 1.1, CH - 0.8, 0, 0.18, { c: C_OCHRE, noao: true });   // the ochre corner pilasters
    bx('flat', F, -E.L / 2, E.L / 2, CH - 0.8, CH + 0.1, 0, 0.7, { c: '#d6a860', noao: true });
    bx('flat', F, -E.L / 2, E.L / 2, 4.88, 5.02, 0, 0.18, { c: '#dbb374', noao: true });
    if (main) {   // two grey stone columns on bases carrying the balcony over the portal
      const xp = -E.L / 2 + bw * (Math.floor(n / 2) + 0.5);
      for (const s of [-1, 1]) { cyl('marble', 0.27, 0.3, 4.6, 12, { M: E.at(xp + s * 1.45, 0.3, 0.75), c: '#9c9889' }); bx('stone', F, xp + s * 1.45 - 0.4, xp + s * 1.45 + 0.4, 0, 0.3, 0.35, 1.15, { c: '#8f877a', noao: true }); bx('stone', F, xp + s * 1.45 - 0.4, xp + s * 1.45 + 0.4, 4.9, 5.2, 0.35, 1.15, { c: '#d9b377', noao: true }); }
      bx('stone', F, xp - 1.9, xp + 1.9, 5.2, 5.5, 0, 1.2, { c: '#d9b377', noao: true });
    }
  }
  const o = end('Palazzo Comitini');
  o.userData.solids = [[CO.p, null, top + 0.15]];
  return o;
}
export const COMITINI = { name: 'Palazzo Comitini', x: 135, z: 282, radius: 35, skipIds: [CO.id], build: buildComitini };

// ====================================================================================================
// 3. Stazione di Palermo Notarbartolo
// ====================================================================================================
const NS = { id: 'w24890500', p: [-1692, -1808.2, -1688.9, -1809.2, -1668.7, -1815.4, -1679.4, -1848.6, -1689.9, -1881, -1698.5, -1878.3, -1710.3, -1874.6, -1713.1, -1873.7, -1704.1, -1846, -1768.3, -1825.6, -1766.5, -1820.3, -1764.9, -1815.3, -1700.9, -1835.8] };
const NH = 11.7, NREC = 10.0, NGLASS = 7.4, NCAN = 8.5;
function paintNGlass(g, w, h) {   // curtain wall: steel mullions, transoms, dark tinted glass with sky reflections and the warm light of the hall
  const T = 3.5, m = mk(g, w, h, T, NGLASS), { R, X, Y, sx, sy } = m;
  const gl = g.createLinearGradient(0, 0, 0, h); gl.addColorStop(0, '#5f7885'); gl.addColorStop(0.5, '#3f5461'); gl.addColorStop(1, '#2b3a45'); g.fillStyle = gl; g.fillRect(0, 0, w, h);
  const rf = RNG(7501); for (let i = 0; i < 5; i++) { const x = rf() * T, ww = 0.4 + rf() * 0.8; const gg = g.createLinearGradient(X(x), 0, X(x + ww), 0); gg.addColorStop(0, 'rgba(200,220,235,0)'); gg.addColorStop(0.5, 'rgba(200,220,235,0.16)'); gg.addColorStop(1, 'rgba(200,220,235,0)'); g.fillStyle = gg; g.fillRect(X(x), 0, ww * sx, h); }
  R(0, 1.2, T, 2.9, 'rgba(255,214,150,0.26)'); R(0, 4.3, T, 5.6, 'rgba(255,214,150,0.12)');
  R(0, 0, T, 0.9, '#3d3f41'); R(0, 0.9, T, 0.97, '#9da1a4');   // a low solid base
  for (const y of [3.2, 5.3]) R(0, y, T, y + 0.1, '#a9adb0');
  R(0, 0, 0.1, NGLASS, '#b4b8bb'); R(T - 0.1, 0, T, NGLASS, '#b4b8bb'); R(0.1, 0, 0.16, NGLASS, 'rgba(0,0,0,0.3)');
  noiseDots(g, w, h, w * h / 160, 1.5, 7502, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.08)']);
}
function paintNWall(g, w, h) {   // cream concrete with two horizontal window strips; one tile is 6 m wide
  const T = 6, m = mk(g, w, h, T, NH), { R, X, Y, sx, sy } = m;
  R(0, 0, T, NH, '#cdc7b5'); noiseDots(g, w, h, w * h / 24, 1.8, 7601, ['rgba(90,82,68,0.10)', 'rgba(255,252,238,0.12)']);
  R(0, 0, T, 1.3, '#85827a'); R(0, 1.3, T, 1.4, 'rgba(30,26,20,0.35)');
  for (const [a, b] of [[3.4, 5.2], [7.2, 9.0]]) for (const x0 of [0.4, 3.4]) { R(x0 - 0.06, a - 0.08, x0 + 2.2 + 0.06, b + 0.08, '#a9a597'); R(x0, a, x0 + 2.2, b, '#3b4852'); R(x0 + 1.1, a, x0 + 1.13, b, '#aab0b2'); R(x0, a, x0 + 2.2, a + 0.5, 'rgba(180,205,220,0.25)'); }
  for (const x of [0, 3]) R(x - 0.03, 1.4, x + 0.03, NH, 'rgba(60,54,44,0.28)');
  R(0, NH - 0.5, T, NH, '#bfb9a8'); R(0, NH - 0.52, T, NH - 0.48, 'rgba(30,26,20,0.4)');
  wear(g, w, h, 7610, { lime: 4, soot: 16 });
}
function clipHalf(pts, keepLow, z0) {   // Sutherland-Hodgman against the line z = z0 in a frame (keepLow: keep z <= z0)
  const out = [], f = p => keepLow ? z0 - p[1] : p[1] - z0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
  return out;
}
function buildNotar() {
  initShared();
  const pts = pairsOf(NS.p), gr = groundRange(pts), cen = cenOf(pts);
  const A = pts[2], B = pts[4], y0 = groundY((A[0] + B[0]) / 2, (A[1] + B[1]) / 2), E = edgeF(A, B, cen, y0), F = E.F, at = E.at, L = E.L;
  defMat('blnGlass', 256, 512, [3.5, NGLASS], paintNGlass);
  defMat('blnWall', 256, 512, [6, NH], paintNWall);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + NH, Lp = pts.map(E.toLocal);
  const body = clipHalf(Lp, true, -NREC).map(q => E.toWorld(q[0], q[1])), strip = clipHalf(Lp, false, -NREC).map(q => E.toWorld(q[0], q[1]));
  prism('blnWall', body, lo, top, { uvo: [0, -y0 / NH] });
  prism('flat', body, top, top + 0.15, { c: '#9a958a' });
  // the glass wall under the canopy, across the width the footprint has at that depth
  const xs = clipHalf(Lp, true, -NREC).filter(q => Math.abs(q[1] + NREC) < 0.02).map(q => q[0]), xa = Math.min(...xs), xb = Math.max(...xs), gw = xb - xa;
  panel('blnGlass', gw, NGLASS, { M: at((xa + xb) / 2, 0, -NREC + 0.06), uvk: [gw / 3.5, 1], noao: true });
  bx('flat', F, xa, xb, NGLASS - 0.15, NGLASS + 0.12, -NREC, -NREC + 0.3, { c: '#8a8e91', noao: true });
  for (let x = xa + 6; x < xb - 3; x += 8.6) bx('flat', F, x - 0.25, x + 0.25, 0, NGLASS, -NREC + 0.45, -NREC + 0.95, { c: '#a3a7aa', noao: true });
  // the canopy: one deep flat slab over the whole front, a thicker fascia on its edge
  prism('flat', strip, y0 + NGLASS, y0 + NCAN, { c: '#dad8d0' });
  bx('flat', F, -L / 2, L / 2, NGLASS - 0.45, NCAN + 0.25, -0.55, 0, { c: '#e3e1da', noao: true });
  bx('flat', F, -L / 2, L / 2, NGLASS - 0.55, NGLASS - 0.45, -0.55, 0, { c: '#7c7f82', noao: true });
  bx('flat', F, xa, xb, 0, 0.18, -NREC, -NREC + 1.6, { c: '#9c978c', noao: true });   // a low step along the glass
  const o = end('Stazione Notarbartolo');
  o.userData.solids = [[NS.p, null, top + 0.15]];
  return o;
}
export const NOTAR = { name: 'Stazione di Palermo Notarbartolo', x: -1705, z: -1848, radius: 70, skipIds: [NS.id], build: buildNotar };

export const BATCH_L = [BIONDO, COMITINI, NOTAR];
