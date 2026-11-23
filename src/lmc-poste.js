// City landmark: the Palazzo delle Poste (Via Roma, Palermo), the post office of 1934 by Angiolo Mazzoni. Registered in src/landmarks-city.js.
// It replaces the OSM footprint r10247654.0 (a lidar block with two courtyards). Frame F: origin on the ground at the middle of the long front (the 88 m edge, point 15 to point 0), +z out of the front onto Via Roma, +x to the right seen from the street.
// Reference photos (Wikimedia Commons, looked at, nothing copied): "Palazzo delle Poste (Palermo).JPG", "Central post office, Palermo, Sicily, Italy (9455414695).jpg", "Palazzo delle Poste Palermo.jpg",
// "Palermo - Palazzo delle Poste 0480.JPG", "Angiolo mazzoni, palazzo delle poste, palermo 1928-1934 (3661979013).jpg".
// Read from them (this replaces an earlier version drawn from memory, which had a clock tower and a central portal that the photos do not show): the whole middle of the front is a giant colonnade of 12 smooth round
// white-grey marble columns, as tall as the building minus a heavy entablature, standing on a broad flight of low steps; behind the columns a recessed wall painted brick red, over a dark grey stone base with round-arched doorways and rows of narrow windows;
// the entablature (stepped architrave, a frieze with the lettering POSTE E TELEGRAFI, a plain parapet band) runs over the colonnade and ends in a pier at each end; the wings each side are flat pale marble walls in horizontal courses
// with tall narrow windows (four rows: very tall on the ground floor, small, tall, small) in recessed bays between flat piers, each window on a projecting sill; the roof is flat, no tower and no clock on the front.
// Not verified, not drawn: the curved corner (no photo of it; the footprint keeps a plain corner), the winged relief figures at the ends of the frieze, the roof antennas, the exact stair depth and column count behind the first view (12 counted in the front photo).
import * as THREE from 'three';
import { PI, bx, cyl, begin, end, defMat, mul, tr, frame, prism, panel, pairsOf, groundRange, groundY, initShared, noiseDots, streaks, paintAshlar } from './lmc-kit.js';

const P = { id: 'r10247654.0', p: [11.1, -533.6, -5.1, -527.3, -9, -537.4, -33.8, -527.8, -25.5, -506.7, -29, -505.3, -20.2, -482.9, -27.8, -480, -19.4, -458.5, -12, -461.3, -6.3, -446.7, -0.6, -448.8, 3.1, -439.3, 25.3, -447.9, 26.4, -445.3, 43.2, -451.8],
  holes: [[-9.4, -492.7, 6.6, -498.8, 0.3, -515.1, -15.7, -509], [-1.9, -473.2, 4.9, -455.7, 21.7, -462.1, 15, -479.6]] };
const H = 26.2, REC = 7.0, PODIUM = 2.4, PITCH = 3.4, CW = 2.2, XC = 22.2, XW = 43.95, BAY = (XW - XC) / 5, COLTOP = 19.6;
const MARB = '#cfd0cc', GLASS = '#2c3947', RED = '#98473a';

function paintWall(g, w, h) {   // one wing bay, BAY m wide, H m tall (v = 0 at the ground)
  const sx = w / BAY, sy = h / H, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, BAY, H, 1.05, 2.2, MARB, '#b0b1ad', 6101, 1.0, 0.035);
  noiseDots(g, w, h, w * h / 70, 1.6, 6102, ['rgba(95,90,80,0.07)', 'rgba(255,255,250,0.08)']);
  R(0, 0, BAY, 1.4, '#86837d');   // the darker foot
  // flat piers each side of the bay, a recessed strip between them
  R(0, 1.4, 0.7, H - 1.9, '#d8dad8'); R(BAY - 0.7, 1.4, BAY, H - 1.9, '#d8dad8'); R(0.7, 1.4, 0.82, H - 1.9, 'rgba(40,36,30,0.25)'); R(BAY - 0.82, 1.4, BAY - 0.7, H - 1.9, 'rgba(255,255,250,0.3)');
  for (const [a, b] of [[1.8, 8.2], [10.6, 12.6], [14.6, 19.2], [21.6, 23.6]]) {
    const cx = BAY / 2, ww = 1.7;
    R(cx - ww / 2 - 0.16, a - 0.1, cx + ww / 2 + 0.16, b + 0.16, '#dcdedc');   // the frame
    R(cx - ww / 2, a, cx + ww / 2, b, GLASS);
    const gl = g.createLinearGradient(0, Y(b), 0, Y(a)); gl.addColorStop(0, 'rgba(170,195,220,0.34)'); gl.addColorStop(1, 'rgba(170,195,220,0.05)'); g.fillStyle = gl; g.fillRect(X(cx - ww / 2), Y(b), ww * sx, (b - a) * sy);
    R(cx - 0.03, a, cx + 0.03, b, '#a6a69f'); for (let y = a + 1.3; y < b - 0.5; y += 1.55) R(cx - ww / 2, y, cx + ww / 2, y + 0.07, '#a6a69f');
    R(cx - ww / 2 - 0.4, a - 0.32, cx + ww / 2 + 0.4, a - 0.1, '#e2e4e2'); R(cx - ww / 2 - 0.4, a - 0.45, cx + ww / 2 + 0.4, a - 0.32, 'rgba(40,36,30,0.3)');   // the sill
  }
  R(0, H - 1.9, BAY, H - 1.8, 'rgba(40,36,30,0.3)');
  streaks(g, w, h, 12, 6103, 0.08, 130, '70,66,58');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(0,0,0,0.25)'); gb.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintRed(g, w, h) {   // the recessed wall behind the colonnade: 2 x XC m wide, H m tall
  const WW = XC * 2, sx = w / WW, sy = h / H, X = x => (x + XC) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  R(-XC, 0, XC, H, RED); noiseDots(g, w, h, w * h / 40, 2, 6201, ['rgba(70,25,20,0.12)', 'rgba(210,130,110,0.1)']);
  R(-XC, 0, XC, 5.9, '#5e5d5b'); for (let y = 0.9; y < 5.9; y += 0.9) R(-XC, y, XC, y + 0.05, 'rgba(10,10,10,0.5)'); R(-XC, 5.9, XC, 6.1, '#7a7773');
  const gcs = []; for (let i = 0; i < 11; i++) gcs.push((i - 5) * PITCH);   // the gaps between the columns
  for (const x of [-2 * PITCH, -PITCH, 0, PITCH, 2 * PITCH]) {   // round-arched doorways on the ground
    const r = 1.2; g.fillStyle = '#17120f'; g.beginPath(); g.moveTo(X(x - r), Y(0)); g.lineTo(X(x - r), Y(4.2)); g.ellipse(X(x), Y(4.2), r * sx, r * sy, 0, PI, 0); g.lineTo(X(x + r), Y(0)); g.fill();
  }
  for (const x of gcs) for (const [a, b] of [[9.2, 12.4], [14.2, 17.4]]) { R(x - 0.85, a - 0.12, x + 0.85, b + 0.12, '#cfc5b5'); R(x - 0.7, a, x + 0.7, b, GLASS); R(x - 0.03, a, x + 0.03, b, '#9c9a92'); }
  streaks(g, w, h, 16, 6202, 0.1, 120, '40,20,15');
}
function paintFrieze(g, w, h) {   // the entablature front: 2 x XC m wide, COLTOP to H m tall
  const WW = XC * 2, HH = H - COLTOP, sx = w / WW, sy = h / HH, X = x => (x + XC) * sx, Y = y => h - (y - COLTOP) * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, WW, HH, 1.1, 3.2, MARB, '#b0b1ad', 6301, 1.0, 0.04);
  noiseDots(g, w, h, w * h / 60, 1.4, 6302, ['rgba(95,90,80,0.07)', 'rgba(255,255,250,0.08)']);
  R(-XC, COLTOP, XC, COLTOP + 1.9, '#ccc9c0'); R(-XC, COLTOP + 1.9, XC, COLTOP + 2.0, 'rgba(40,36,30,0.35)');
  for (const y of [COLTOP + 2.15, COLTOP + 2.35]) R(-XC, y, XC, y + 0.07, 'rgba(40,36,30,0.28)');
  for (const y of [24.55, 24.75]) R(-XC, y, XC, y + 0.07, 'rgba(40,36,30,0.28)');
  g.fillStyle = 'rgba(70,66,58,0.78)'; g.font = `bold ${Math.round(1.7 * sy)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = 'POSTE E TELEGRAFI', stepL = 2.0; for (let i = 0; i < txt.length; i++) if (txt[i] !== ' ') g.fillText(txt[i], X((i - (txt.length - 1) / 2) * stepL), Y(23.0));
  streaks(g, w, h, 10, 6303, 0.1, 40, '70,66,58');
}

function buildPoste() {
  initShared();
  const pts = pairsOf(P.p), holes = P.holes.map(pairsOf), gr = groundRange(pts);
  const A = pts[15], B = pts[0], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
  let nx = -dz / L, nz = dx / L; const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
  const y0 = groundY(mx, mz), F = frame(mx, y0, mz, nx, nz), at = (x, y, z) => mul(F, tr(x, y, z));
  const toWorld = (x, z) => [mx + x * nz + z * nx, mz - x * nx + z * nz];
  defMat('poWall', 256, 512, [BAY, H], paintWall);
  defMat('poRed', 512, 512, [XC * 2, H], paintRed);
  defMat('poFrieze', 512, 128, [XC * 2, H - COLTOP], paintFrieze);
  begin(y0);
  const lo = Math.min(gr.lo, y0) - 1.5, top = y0 + H;
  // the body behind the front 7 m: the footprint cut at z = -REC (Sutherland-Hodgman in the frame of the front)
  const toLocal = (p) => { const ddx = p[0] - mx, ddz = p[1] - mz; return [ddx * nz - ddz * nx, ddx * nx + ddz * nz]; };
  const clipped = (() => { const Lp = pts.map(toLocal), out = []; for (let i = 0; i < Lp.length; i++) { const a = Lp[i], b = Lp[(i + 1) % Lp.length], fa = -REC - a[1], fb = -REC - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out.map(q => toWorld(q[0], q[1])); })();
  prism('poWall', clipped, lo, top, { holes, uvo: [0, -y0 / H] });
  prism('flat', clipped, top, top + 0.15, { holes, c: '#9a948a' });
  // the cornice along every outer edge of the body (not along the front)
  for (let i = 0; i < pts.length; i++) {
    if (i === 15) continue;
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez); if (l < 1.5) continue;
    const Fe = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -ez / l, ex / l);
    bx('flat', Fe, -l / 2, l / 2, top - 0.9, top + 0.5, -0.3, 0.3, { c: '#dcdedc', noao: true });
    bx('flat', Fe, -l / 2, l / 2, top - 1.3, top - 0.9, -0.15, 0.15, { c: '#8b8a86', noao: true });
  }
  // the two wings of the front: flat marble walls with their painted bays, a cornice on top
  for (const sg of [-1, 1]) {
    const xa = sg > 0 ? XC : -XW, xb = sg > 0 ? XW : -XC, cxw = (xa + xb) / 2;
    bx('poWall', F, xa, xb, -(y0 - lo), H, -REC, 0, { uvo: [0, 0] });
    panel('poWall', XW - XC, H, { M: at(cxw, 0, 0.03), uvk: [(XW - XC) / BAY, 1] });
    bx('flat', F, xa - 0.1, xb + 0.1, H - 0.9, H + 0.5, -REC, 0.55, { c: '#dcdedc', noao: true });
    bx('flat', F, xa - 0.1, xb + 0.1, H - 1.3, H - 0.9, -REC, 0.25, { c: '#8b8a86', noao: true });
  }
  // the podium and the broad flight of low steps along the whole colonnade
  bx('stone', F, -XC, XC, -(y0 - lo), PODIUM, -REC, 0, { c: '#c4c0b6' });
  const NS = 14, TD = 0.62;
  for (let i = 0; i < NS; i++) bx('stone', F, -XC - 0.9 * (i / NS), XC + 0.9 * (i / NS), -(y0 - lo), PODIUM * (1 - (i + 1) / (NS + 1)) + 0.1, 0, TD * (i + 1), { c: '#bdb9af', noao: true });
  for (const sg of [-1, 1]) bx('flat', F, sg > 0 ? XC + 0.2 : -XC - 1.3, sg > 0 ? XC + 1.3 : -XC - 0.2, -(y0 - lo), PODIUM + 0.6, 0, TD * NS + 0.2, { c: '#cac6bc', noao: true });
  // the recessed wall (red, over a dark stone base) and the colonnade: 12 smooth marble columns
  panel('poRed', XC * 2, H, { M: at(0, 0, -REC + 0.05), uvk: [1, 1] });
  bx('flat', F, -XC, XC, PODIUM, PODIUM + 0.12, -REC, 0, { c: '#7d7a74', noao: true });
  for (let i = 0; i < 12; i++) {
    const x = (i - 5.5) * PITCH;
    cyl('marble', CW / 2 * 0.9, CW / 2 * 1.05, COLTOP - PODIUM, 16, { M: at(x, PODIUM, -2.4), c: '#d0d4da' });
    bx('flat', F, x - CW * 0.58, x + CW * 0.58, PODIUM, PODIUM + 0.3, -2.4 - CW * 0.58, -2.4 + CW * 0.58, { c: '#cbcdcb', noao: true });
    bx('flat', F, x - CW * 0.55, x + CW * 0.55, COLTOP - 0.35, COLTOP, -2.4 - CW * 0.55, -2.4 + CW * 0.55, { c: '#cbcdcb', noao: true });
  }
  // the piers at each end, and the entablature over the colonnade: stepped architrave, the frieze with the lettering, the parapet band
  for (const sg of [-1, 1]) bx('flat', F, sg > 0 ? XC - 3.3 : -XC, sg > 0 ? XC : -XC + 3.3, PODIUM, COLTOP, -REC, 0, { c: '#d4d6d4', noao: true });
  bx('flat', F, -XC, XC, COLTOP, H, -REC, 0, { c: '#d1d3d1', noao: true });
  panel('poFrieze', XC * 2, H - COLTOP, { M: at(0, COLTOP, 0.03), uvk: [1, 1] });
  bx('flat', F, -XC - 0.15, XC + 0.15, COLTOP + 1.9, COLTOP + 2.1, -REC, 0.45, { c: '#dadcda', noao: true });
  bx('flat', F, -XC - 0.1, XC + 0.1, H - 1.9, H + 0.55, -REC, 0.6, { c: '#dcdedc', noao: true });
  bx('flat', F, -XC - 0.1, XC + 0.1, H - 2.3, H - 1.9, -REC, 0.3, { c: '#8b8a86', noao: true });
  const o = end('Palazzo delle Poste');
  o.userData.solids = [[P.p, null, top + 0.55]];
  return o;
}
export const POSTE = { name: 'Palazzo delle Poste', x: -5, z: -481, radius: 70, skipIds: [P.id], build: buildPoste };
