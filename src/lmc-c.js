// City landmarks, group C: Mondello (Antico Stabilimento Balneare, entrance gate, beach front), the Gymnasium of the Orto Botanico (the Palazzina Cinese is in src/lmc-f.js),
// Villa Giulia's gate, Teatro Garibaldi, the Ucciardone walls, the Fiera del Mediterraneo gate, Villa Igiea, two Liberty villini, the Stazione Marittima.
// Each rebuilt model carries its photos and what is not verified above its builder; the photos were looked at only, nothing is stored.
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, archBay, prism, pyramid, gable,
  mul, tr, rotY, frame, pairsOf, obb, facing, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  statue, palm, rail, balus, extrude,
} from './lmc-kit.js';
import { FP, LINES } from './landmarks-city-data.js';
import { TREE_CLEAR } from './tree-clear.js';

const skirt = (key, M, w, d, lo, o = {}) => bx(key, M, -w / 2, w / 2, lo, 0.02, -d / 2, d / 2, o);
const ang = (nx, nz) => Math.atan2(nx, nz);

// ====================================================================================================
// Mondello: Antico Stabilimento Balneare, the Liberty pavilion on piles with its wings and the boardwalk out from the beach
// Pale yellow with maroon woodwork: between two towers (orange roundels, crowns of two little cupolas and masts) a colonnaded entrance, three tall arched windows over it and a curved gable
// with a round window; plain wings with small windows outside the towers; the long galleries of cabin fronts, the north block with knobs along its parapet; all on a concrete platform on
// round concrete columns; the boardwalk with yellow posts that carry orange discs.
// Photos: Wikimedia Commons "Antico Stabilimento Balneare di Mondello" (the front from the boardwalk), "Stabilimento Balneare, Mondello" (from the beach), "Stabilimento balneare - panoramio";
// Mapillary 2022 and 2018 from the boardwalk. Not verified: the sea side and the far ends, the exact heights, the carved heads and ironwork (plain).
// ====================================================================================================
function buildStabilimento() {
  initShared();
  const pts = pairsOf(FP.mondelloStab.p), ob = obb(pts), fr = facing(ob, -1, 0.35);
  const deck = 1.9, M = frame(ob.cx, 0, ob.cz, fr.nx, fr.nz);   // +z towards the beach, x along the coast, y = 0 at the sea surface
  begin(0);
  defMat('mnYellow', 256, 256, [8, 8], (g, w, h) => paintFacade(g, w, h, 8, 8, { base: '#efdfae', trim: '#fffaf0', glass: '#6a2c2c', seed: 801, plinth: { h: 0.6, c: '#ddca98' }, grime: 0,
    bands: [{ y: 4.0, h: 0.3, c: '#fff6e8' }, { y: 7.6, h: 0.4, c: '#fff6e8' }], rows: [{ y0: 0.9, y1: 3.4, xs: [2, 6], w: 1.2, kind: 'arch', fr: 0.22, sill: false }, { y0: 4.8, y1: 7.1, xs: [2, 6], w: 1.1, kind: 'arch', fr: 0.2, sill: false }] }));
  defMat('mnStripe', 128, 64, [7, 4.4], (g, w, h) => { g.fillStyle = '#f0e6c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a2a35'; for (let x = 0; x < w; x += 16) { g.fillRect(x, 8, 8, h - 8); } g.fillStyle = '#4a2028'; for (let x = 3; x < w; x += 16) g.fillRect(x, 26, 4, h - 26); g.fillStyle = '#e8d8b4'; g.fillRect(0, 0, w, 8); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 5, w, 5); });
  defMat('mnBlock', 256, 256, [14, 9], (g, w, h) => paintFacade(g, w, h, 14, 9, { base: '#eadcaa', trim: '#fff6e8', glass: '#5a2a2c', seed: 804, grime: 0, rows: [{ y0: 0.9, y1: 3.6, n: 5, m: 1.4, w: 1.3, kind: 'rect', fr: 0.12 }, { y0: 4.9, y1: 7.6, n: 5, m: 1.4, w: 1.3, kind: 'rect', fr: 0.12 }] }));
  defMat('mnShed', 256, 128, [14, 5], (g, w, h) => paintFacade(g, w, h, 14, 5, { base: '#ece0b0', trim: '#fff6e8', glass: '#3a2a26', seed: 802, grime: 0, rows: [{ y0: 0.8, y1: 3.4, n: 5, m: 1.6, w: 1.5, kind: 'rect', fr: 0.1 }] }));
  // the painted front of the pavilion between and outside the towers: the entrance between white columns, three arched windows over it, small windows in the plain outer wings
  const arcW = (g, X, Y, sx, sy, cx, wd, y0, y1, fill) => { g.fillStyle = '#fff6e0'; g.beginPath(); g.moveTo(X(cx - wd / 2 - 0.22), Y(y0)); g.lineTo(X(cx - wd / 2 - 0.22), Y(y1 - wd / 2)); g.ellipse(X(cx), Y(y1 - wd / 2), (wd / 2 + 0.22) * sx, (wd / 2 + 0.22) * sy, 0, PI, 0); g.lineTo(X(cx + wd / 2 + 0.22), Y(y0)); g.fill();
    g.fillStyle = fill; g.beginPath(); g.moveTo(X(cx - wd / 2), Y(y0)); g.lineTo(X(cx - wd / 2), Y(y1 - wd / 2)); g.ellipse(X(cx), Y(y1 - wd / 2), (wd / 2) * sx, (wd / 2) * sy, 0, PI, 0); g.lineTo(X(cx + wd / 2), Y(y0)); g.fill();
    g.fillStyle = 'rgba(255,246,224,0.75)'; for (let m = cx - wd / 2 + 0.55; m < cx + wd / 2 - 0.2; m += 0.55) g.fillRect(X(m), Y(y1 - wd * 0.2), 1.2, (y1 - wd * 0.2 - y0) * sy); g.fillRect(X(cx - wd / 2), Y(y1 - wd / 2), wd * sx, 1.5); };
  defMat('mnFront', 512, 176, [28, 9.4], (g, w, h) => {
    const sx = w / 28, sy = h / 9.4, X = (m) => (m + 14) * sx, Y = (m) => h - m * sy, R = (x0, x1, y0, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
    R(-14, 14, 0, 9.4, '#efdfae'); noiseDots(g, w, h, 600, 2, 805, ['rgba(150,120,60,0.10)', 'rgba(255,252,225,0.16)']); R(-14, 14, 0, 0.5, '#ddca98');
    R(-5.8, 5.8, 0, 4.1, '#4a2228'); R(-2.0, 2.0, 0, 3.4, '#1f0f12'); for (let m = -5.4; m < 5.5; m += 0.5) if (Math.abs(m) > 2.2) R(m, m + 0.07, 0.5, 3.8, '#8a4a50');
    for (const x of [-5.9, -2.35, 2.35, 5.9]) { R(x - 0.3, x + 0.3, 0, 4.1, '#f6ecc8'); R(x - 0.45, x + 0.45, 3.75, 4.1, '#fff6e0'); }
    for (const sg of [-1, 1]) { for (const x of [10.6, 12.6]) { R(sg * x - 0.55, sg * x + 0.55, 2.15, 3.35, '#fff6e0'); R(sg * x - 0.42, sg * x + 0.42, 2.25, 3.25, '#5a2c30'); } for (const x of [10.2, 11.6, 13.0]) { R(sg * x - 0.4, sg * x + 0.4, 6.0, 6.8, '#fff6e0'); R(sg * x - 0.3, sg * x + 0.3, 6.08, 6.72, '#5a2c30'); } R(sg * 10.6 - 0.6, sg * 10.6 + 0.6, 0, 1.9, '#6a2c34'); }
    R(-14, 14, 4.35, 4.7, '#fff6e0'); R(-6, 6, 4.7, 5.55, 'rgba(90,40,45,0.35)'); for (let m = -6; m < 6; m += 0.32) R(m, m + 0.07, 4.7, 5.5, '#5a2c30'); R(-6, 6, 5.45, 5.55, '#5a2c30');
    arcW(g, X, Y, sx, sy, 0, 4.4, 5.55, 8.55, '#6a2632'); for (const x of [-4.0, 4.0]) arcW(g, X, Y, sx, sy, x, 2.5, 5.55, 8.2, '#6a2632');
    R(-14, 14, 8.75, 9.0, '#fff6e0'); for (let m = -13.4; m < 13.5; m += 1.4) R(m, m + 0.3, 9.05, 9.3, '#e49a7a'); R(-14, 14, 7.55, 7.68, 'rgba(150,115,60,0.45)');
  });
  // a front tower's face: the ground arch, two small windows, the orange roundel in a white ring, pink pinstripes and a pale carved band under the cornice
  defMat('mnTowF', 128, 384, [4, 11.9], (g, w, h) => {
    const sx = w / 4, sy = h / 11.9, X = (m) => (m + 2) * sx, Y = (m) => h - m * sy, R = (x0, x1, y0, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
    R(-2, 2, 0, 11.9, '#efdfae'); noiseDots(g, w, h, 500, 2, 806, ['rgba(150,120,60,0.10)', 'rgba(255,252,225,0.16)']); R(-2, 2, 0, 0.5, '#ddca98');
    arcW(g, X, Y, sx, sy, 0, 1.2, 0.4, 3.4, '#6a2c34'); R(-2, 2, 4.35, 4.7, '#fff6e0'); for (const x of [-0.75, 0.75]) R(x - 0.35, x + 0.35, 5.3, 6.0, '#5a2c30');
    g.fillStyle = '#fff6e0'; g.beginPath(); g.ellipse(X(0), Y(7.55), 1.05 * sx, 1.05 * sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#d9704a'; g.beginPath(); g.ellipse(X(0), Y(7.55), 0.72 * sx, 0.72 * sy, 0, 0, 2 * PI); g.fill();
    for (let m = -1.5; m < 1.6; m += 0.5) R(m - 0.05, m + 0.05, 8.9, 10.5, '#dfa87c'); R(-2, 2, 10.55, 11.35, '#f8f4e6'); g.strokeStyle = 'rgba(110,100,80,0.7)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(X(-1.6 + i * 0.8), Y(10.95), 0.28 * sx, i % 2 ? 0 : PI, i % 2 ? PI : 2 * PI); g.stroke(); }
    R(-2, 2, 11.55, 11.9, '#fff6e0');
  });
  defMat('deck', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#9a7d58'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(60,40,20,0.45)'; g.fillRect(0, y, w, 2); } noiseDots(g, w, h, 300, 2, 803, ['rgba(60,40,20,0.2)', 'rgba(220,190,140,0.2)']); });
  const LEN = 112, DEP = 26, YEL = '#efdfae', CREAM = '#f6ecc8', CONC = '#b9b09a', PINK = '#e49a7a';
  bx('deck', M, -LEN / 2, LEN / 2, deck - 0.4, deck, -DEP / 2, DEP / 2, { noao: true });
  // the concrete edge of the platform and its round columns
  for (const z of [-DEP / 2, DEP / 2]) bx('flat', M, -LEN / 2 - 0.15, LEN / 2 + 0.15, deck - 0.95, deck - 0.05, z - 0.2, z + 0.2, { c: '#d5c9a6', noao: true });
  for (const x of [-LEN / 2, LEN / 2]) bx('flat', M, x - 0.2, x + 0.2, deck - 0.95, deck - 0.05, -DEP / 2, DEP / 2, { c: '#d5c9a6', noao: true });
  for (let x = -LEN / 2 + 1.5; x <= LEN / 2; x += 6.05) for (const z of [-DEP / 2 + 0.8, DEP / 2 - 0.8]) cyl('flat', 0.48, 0.55, deck + 2.5, 7, { M: mul(M, tr(x, -3.4, z)), c: CONC, noao: true });
  // central pavilion
  const CW = 28, CD = 20, CH = 9.4, FZ = CD / 2 - 2;
  bx('mnYellow', M, -CW / 2, CW / 2, deck, deck + CH, -CD / 2 - 2, FZ);
  bx('flat', M, -CW / 2 - 0.35, CW / 2 + 0.35, deck + CH, deck + CH + 0.3, -CD / 2 - 2.35, FZ + 0.35, { c: CREAM });
  for (const sg of [-1, 1]) {   // the parapets of the outer wings, their corners raised
    bx('flat', M, sg * 10.2, sg * CW / 2, deck + CH + 0.3, deck + CH + 0.85, FZ - 0.4, FZ, { c: YEL });
    bx('flat', M, sg * (CW / 2 - 1.2), sg * CW / 2, deck + CH + 0.3, deck + CH + 1.3, FZ - 0.5, FZ + 0.05, { c: YEL });
    bx('flat', M, sg * (CW / 2 - 0.45), sg * CW / 2, deck + CH + 0.3, deck + CH + 0.85, -CD / 2 - 2, FZ - 0.5, { c: YEL });
  }
  // the curved gable over the middle, edged in cream, its round window, the knobs and masts
  const gab = (k) => { const q = new THREE.Shape(); q.moveTo(-5.9 * k, 0); q.lineTo(-5.9 * k, 1.1 * k); q.quadraticCurveTo(-3.3 * k, 1.0 * k, -2.6 * k, 2.4 * k); q.quadraticCurveTo(0, 4.7 * k, 2.6 * k, 2.4 * k); q.quadraticCurveTo(3.3 * k, 1.0 * k, 5.9 * k, 1.1 * k); q.lineTo(5.9 * k, 0); q.closePath(); return q; };
  const Mg = mul(M, tr(0, deck + CH + 0.3, FZ - 0.5));
  extrude('flat', gab(1.05), 0.4, { M: Mg, c: CREAM, cs: 6 }); extrude('flat', gab(0.94), 0.5, { M: Mg, c: YEL, cs: 6 });
  const disc = (r, z, c) => cyl('flat', r, r, 0.08, 12, { M: mul(M, mul(tr(0, deck + CH + 2.15, z), new THREE.Matrix4().makeRotationX(PI / 2))), c, noao: true });
  disc(0.8, FZ - 0.0, '#fff6e0'); disc(0.52, FZ + 0.06, '#5a2c30');
  for (const [x, y] of [[-6.1, 1.5], [-2.8, 2.8], [0, 4.1], [2.8, 2.8], [6.1, 1.5]]) { sphere('flat', 0.3, { M: mul(Mg, tr(x, y, 0.25)), c: PINK, seg: 5 }); cyl('dark', 0.03, 0.04, x ? 1.8 : 2.8, 3, { M: mul(Mg, tr(x, y + 0.2, 0.25)), noao: true }); }
  const tower = (Mt, hgt, wd) => {
    bx('mnYellow', Mt, -wd, wd, 0, hgt, -wd, wd); bx('flat', Mt, -wd - 0.4, wd + 0.4, hgt, hgt + 0.55, -wd - 0.4, wd + 0.4, { c: CREAM });
    bx('flat', Mt, -wd * 0.7, wd * 0.7, hgt + 0.55, hgt + 1.3, -wd * 0.7, wd * 0.7, { c: YEL });
    // the crown: two little turrets with ball finials toward the front, a rounded crest between them
    for (const a of [-1, 1]) {
      bx('flat', Mt, a * wd * 0.62 - 0.42, a * wd * 0.62 + 0.42, hgt + 0.55, hgt + 2.0, wd * 0.2, wd * 0.2 + 0.84, { c: YEL }); bx('flat', Mt, a * wd * 0.62 - 0.55, a * wd * 0.62 + 0.55, hgt + 2.0, hgt + 2.2, wd * 0.2 - 0.13, wd * 0.2 + 0.97, { c: CREAM });
      sphere('flat', 0.36, { M: mul(Mt, tr(a * wd * 0.62, hgt + 2.55, wd * 0.2 + 0.42)), c: '#f2d68c', seg: 6 }); cyl('dark', 0.03, 0.04, 2.3, 3, { M: mul(Mt, tr(a * wd * 0.62, hgt + 2.85, wd * 0.2 + 0.42)), noao: true });
      sphere('flat', 0.24, { M: mul(Mt, tr(a * wd * 1.12, hgt + 0.45, wd * 1.1)), c: PINK, seg: 5 });
    }
    const cr = new THREE.Shape(); cr.moveTo(-wd * 0.42, 0); cr.quadraticCurveTo(-wd * 0.4, 1.25, 0, 1.3); cr.quadraticCurveTo(wd * 0.4, 1.25, wd * 0.42, 0); cr.closePath();
    extrude('flat', cr, 0.3, { M: mul(Mt, tr(0, hgt + 0.55, wd * 0.55)), c: CREAM, cs: 5 });
    cyl('dark', 0.04, 0.06, 3.9, 4, { M: mul(Mt, tr(0, hgt + 1.3, 0)), noao: true }); sphere('flat', 0.2, { M: mul(Mt, tr(0, hgt + 4.2, 0)), c: '#d9b45a', seg: 5 });
  };
  for (const sg of [-1, 1]) { const Mt = mul(M, tr(sg * 8.1, deck, FZ - 1.6)); tower(Mt, 11.9, 2.0); panel('mnTowF', 4.0, 11.9, { M: mul(Mt, tr(0, 0, 2.03)) }); }
  tower(mul(M, tr(0, deck, -CD / 2 + 0.6)), CH + 6.6, 2.4);
  box('dark', 4, 3.4, 0.2, { M: mul(M, tr(0, deck, FZ + 0.1)), noao: true, c: '#4a2a22' });
  panel('mnFront', CW, CH, { M: mul(M, tr(0, deck, FZ + 0.25)), noao: true });   // the painted front
  for (const x of [-5.9, -2.35, 2.35, 5.9]) cyl('flat', 0.27, 0.31, 4.1, 8, { M: mul(M, tr(x, deck, FZ + 0.75)), c: CREAM });
  bx('flat', M, -6.4, 6.4, deck + 4.2, deck + 4.65, FZ, FZ + 1.15, { c: CREAM }); rail(mul(M, tr(0, deck + 4.65, FZ + 1.1)), 12.6, 0.95, { c: '#7a3a40' });
  // wings, as on the photos: from the pavilion a long gallery of cabin fronts (maroon and cream stripes, doors) under a balustrade,
  // ending on the south side in a small box; on the north side the gallery runs into the big plain two-storey block on piles.
  const gal = (x0, x1) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    bx('mnStripe', M, lo, hi, deck, deck + 4.4, -2.0, 7.0);
    bx('flat', M, lo - 0.2, hi + 0.2, deck + 4.4, deck + 4.8, -2.2, 7.2, { c: '#f0e2c4' });
    balus(mul(M, tr((lo + hi) / 2, deck + 4.8, 7.0)), hi - lo, 0.9);
  };
  gal(CW / 2 + 0.6, LEN / 2 - 7); gal(-CW / 2 - 0.6, -CW / 2 - 17);
  bx('mnShed', M, LEN / 2 - 7, LEN / 2, deck, deck + 5.4, -2.0, 7.0); bx('flat', M, LEN / 2 - 7.3, LEN / 2 + 0.3, deck + 5.4, deck + 5.9, -2.3, 7.3, { c: '#f0e2c4' });
  bx('mnBlock', M, -LEN / 2, -CW / 2 - 17, deck, deck + 9.0, -3.2, 9.0);
  bx('flat', M, -LEN / 2 - 0.4, -CW / 2 - 16.6, deck + 9.0, deck + 9.55, -3.6, 9.4, { c: '#f0e2c4' });
  bx('flat', M, -LEN / 2 - 0.2, -CW / 2 - 16.8, deck + 9.55, deck + 10.0, -3.4, 9.2, { c: '#e9d8b8' });
  for (let x = -LEN / 2; x <= -CW / 2 - 17; x += 3.1) for (const z of [-3.3, 9.1]) sphere('flat', 0.3, { M: mul(M, tr(x, deck + 10.2, z)), c: CREAM, seg: 5 });
  // boardwalk to the beach gate
  const [gx, gz] = MG_PIER, sx = ob.cx + fr.nx * (CD / 2 + 1), sz = ob.cz + fr.nz * (CD / 2 + 1), dl = Math.hypot(gx - sx, gz - sz), gnx = (gx - sx) / dl, gnz = (gz - sz) / dl;
  const MG = frame(sx, 0, sz, gnx, gnz);
  bx('deck', MG, -2.4, 2.4, deck - 0.3, deck, 0, dl, { noao: true });
  for (let z = 0; z < dl; z += 7) for (const x of [-2.2, 2.2]) cyl('flat', 0.32, 0.38, deck + 3.1, 6, { M: mul(MG, tr(x, -3.4, z)), c: CONC, noao: true });
  for (const sg of [-1, 1]) { const Mr = mul(MG, mul(tr(sg * 2.4, deck, dl / 2), rotY(PI / 2))); rail(Mr, dl, 1.1, { c: '#c9c9c0' });
    for (let z = 3; z < dl - 1; z += 5.5) { bx('flat', MG, sg * 2.36 - 0.2, sg * 2.36 + 0.2, deck, deck + 1.25, z - 0.2, z + 0.2, { c: YEL, noao: true }); cyl('flat', 0.17, 0.17, 0.07, 8, { M: mul(MG, mul(tr(sg * 2.13, deck + 0.95, z), new THREE.Matrix4().makeRotationZ(PI / 2))), c: '#d9704a', noao: true }); } }
  return end('Antico Stabilimento Balneare');
}
export const STABILIMENTO = { name: 'Antico Stabilimento Balneare di Mondello', x: -2990, z: -9604, radius: 100, skipIds: [FP.mondelloStab.id], build: buildStabilimento };

// The Liberty entrance gate of the old beach establishment, on its own footprint (w370274804, the curved line of the gate): two tall square towers joined by a colonnade
// that bows towards the sea. Pale yellow; each tower with a rusticated foot, a chequer band, ochre stripes round a white carved frieze, and a crown of four terracotta
// knobs, a disc finial and a mast. The colonnade: square pillars under a curved architrave, a wide arched bay by the north tower, small finials and figures over the
// pillars, the little ticket kiosk and the iron railings between them.
// Photos (Mapillary frames from Viale Regina Elena, 2019 and 2022, among them 3376143939155265, 318693079770537, 207853607653586).
// Not verified: the sea side, the exact heights, the subjects of the carved frieze and of the figures.
const MG_C = [-3037.1, -9580.6], MG_N = [0.886, -0.463], MG_PIER = [-3031.6, -9583.5];   // middle of the chord between the towers, towards the sea; where the boardwalk lands
const MG_R = 7.05, MG_CZ = -1.65, MG_HALF = 6.85, MG_COLS = [-22, 12, 44].map((d) => d * PI / 180);
const mgArc = (a) => [MG_R * Math.sin(a), MG_CZ + MG_R * Math.cos(a)];
const mgW = (x, z) => [Math.round((MG_C[0] + x * MG_N[1] + z * MG_N[0]) * 10) / 10, Math.round((MG_C[1] - x * MG_N[0] + z * MG_N[1]) * 10) / 10];
const mgSeg = (x0, z0, x1, z1) => { const a = mgW(x0, z0), b = mgW(x1, z1); return [a[0], a[1], b[0], b[1]]; };
const mgSquare = (x, z, r) => [mgSeg(x - r, z - r, x + r, z - r), mgSeg(x + r, z - r, x + r, z + r), mgSeg(x + r, z + r, x - r, z + r), mgSeg(x - r, z + r, x - r, z - r)];
function nearPier(x, z) {   // within 3.5 m of the boardwalk from the pavilion to the gate
  const ob = obb(pairsOf(FP.mondelloStab.p)), fr = facing(ob, -1, 0.35), ax = ob.cx + fr.nx * 11, az = ob.cz + fr.nz * 11, dx = MG_PIER[0] - ax, dz = MG_PIER[1] - az;
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - u * dx, z - az - u * dz) < 3.5;
}
function paintMgTower(g, w, h) {   // one face of a tower, 2.1 m x 11.2 m
  const sx = w / 2.1, sy = h / 11.2, Y = (y) => h - y * sy;
  g.fillStyle = '#efdc9e'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 811, ['rgba(140,110,50,0.10)', 'rgba(255,250,215,0.16)']);
  g.fillStyle = 'rgba(120,95,45,0.45)'; for (let y = 0.35; y < 2.0; y += 0.36) g.fillRect(0, Y(y), w, 2);                       // the rusticated foot
  g.fillStyle = '#fbefc2'; g.fillRect(0, Y(2.2), w, 0.18 * sy);
  g.fillStyle = '#2c2a3a'; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0 && !(j === 0 && i % 4 === 2)) g.fillRect(i * w / 9, Y(4.35 - j * 0.23), w / 9, 0.23 * sy);   // the chequer band
  for (const [y0, y1] of [[6.2, 7.7], [8.55, 9.75]]) { g.fillStyle = '#d9ab6a'; for (let i = 0; i < 6; i++) g.fillRect(w * (0.07 + i * 0.155), Y(y1), w * 0.075, (y1 - y0) * sy); }
  g.fillStyle = '#fbf1c8'; g.fillRect(w * 0.43, Y(9.9), w * 0.14, 4.4 * sy);                                                    // the pale rib up the middle
  g.fillStyle = '#f4f1e6'; g.fillRect(0, Y(8.5), w, 0.75 * sy); g.strokeStyle = 'rgba(100,95,80,0.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w * (0.1 + i * 0.2), Y(8.3), w * 0.09, 0, PI); g.stroke(); g.beginPath(); g.arc(w * (0.2 + i * 0.2), Y(7.98), w * 0.06, PI, 2 * PI); g.stroke(); }
  g.fillStyle = '#2c2a3a'; g.fillRect(w * 0.42, Y(10.7), w * 0.16, 0.42 * sy);
  streaks(g, w, h, 8, 812, 0.10, 80);
}
function buildMondelloGate() {
  initShared();
  const gy = Math.max(groundY(MG_C[0], MG_C[1]), 0.6), M = frame(MG_C[0], gy, MG_C[1], MG_N[0], MG_N[1]);
  begin(gy);
  defMat('mnTower', 128, 384, [2.1, 11.2], paintMgTower);
  const Y = '#f0dc9c', PALE = '#fbeeb8', KNOB = '#dc9a74';
  const finial = (Mf, k) => { lathe('flat', [[0.2, 0], [0.14, 0.35], [0.66, 0.55], [0.72, 0.72], [0.3, 0.92], [0.12, 1.1], [0.24, 1.28], [0.01, 1.45]].map(([r, y]) => [r * k, y * k]), 8, { M: Mf, c: PALE, noao: true }); cyl('flat', 0.025, 0.035, 1.7 * k, 3, { M: mul(Mf, tr(0, 1.4 * k, 0)), c: '#2e2a24', noao: true }); };
  for (const sg of [-1, 1]) {
    const Mt = mul(M, tr(sg * MG_HALF, 0, 0));
    bx('flat', Mt, -1.0, 1.0, -1.0, 11.2, -1.0, 1.0, { c: Y });
    for (let q = 0; q < 4; q++) panel('mnTower', 2.1, 11.2, { M: mul(Mt, mul(rotY(q * PI / 2), tr(0, 0, 1.05))) });
    bx('flat', Mt, -1.22, 1.22, -0.5, 0.55, -1.22, 1.22, { c: PALE });
    bx('flat', Mt, -1.2, 1.2, 7.78, 8.0, -1.2, 1.2, { c: '#f4f1e6' });                                                           // the frieze stands out
    bx('flat', Mt, -1.3, 1.3, 11.2, 11.55, -1.3, 1.3, { c: PALE });
    for (const a of [-1, 1]) for (const b of [-1, 1]) sphere('flat', 0.3, { M: mul(Mt, tr(a * 1.18, 11.12, b * 1.18)), seg: 6, c: KNOB });
    bx('flat', Mt, -0.85, 0.85, 11.55, 12.15, -0.85, 0.85, { c: Y }); bx('flat', Mt, -0.6, 0.6, 12.15, 12.45, -0.6, 0.6, { c: PALE });
    finial(mul(Mt, tr(0, 12.45, 0)), 1.0);
  }
  // the pillars along the arc, each turned to the curve
  const at = (a, y = 0) => { const [x, z] = mgArc(a); return mul(M, mul(tr(x, y, z), rotY(a))); };
  MG_COLS.forEach((a, i) => {
    const Mc = at(a);
    bx('flat', Mc, -0.5, 0.5, -0.5, 1.0, -0.5, 0.5, { c: PALE }); bx('flat', Mc, -0.32, 0.32, 1.0, 6.4, -0.32, 0.32, { c: Y }); bx('flat', Mc, -0.48, 0.48, 6.3, 6.8, -0.48, 0.48, { c: PALE });
    if (i === 0) { bx('flat', Mc, -0.42, 0.42, 7.9, 9.0, -0.42, 0.42, { c: Y }); finial(mul(Mc, tr(0, 9.0, 0)), 0.75); }
    else { bx('flat', Mc, -0.28, 0.28, 7.9, 8.4, -0.28, 0.28, { c: PALE }); statue('flat', mul(Mc, tr(0, 8.4, 0)), 1.1, { c: '#eeeade' }); }
  });
  // the curved architrave from tower to tower
  const A0 = -64 * PI / 180, A1 = 64 * PI / 180, N = 12;
  for (let i = 0; i < N; i++) {
    const p = mgArc(A0 + (A1 - A0) * i / N), q = mgArc(A0 + (A1 - A0) * (i + 1) / N), l = Math.hypot(q[0] - p[0], q[1] - p[1]), Mm = mul(M, mul(tr((p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2), rotY(Math.atan2(-(q[1] - p[1]), q[0] - p[0]))));
    bx('flat', Mm, -l / 2 - 0.04, l / 2 + 0.04, 6.8, 7.65, -0.32, 0.32, { c: Y }); bx('flat', Mm, -l / 2 - 0.06, l / 2 + 0.06, 7.65, 7.9, -0.45, 0.45, { c: PALE });
  }
  // the wide arched bay by the north tower, and the low scallops over the narrow ones
  const crest = (a0, a1, rise, key = Y) => { const p = mgArc(a0), q = mgArc(a1), l = Math.hypot(q[0] - p[0], q[1] - p[1]), sh = new THREE.Shape(); sh.moveTo(-l / 2, 0); sh.quadraticCurveTo(-l / 2 + 0.2, rise * 1.7, 0, rise * 1.5); sh.quadraticCurveTo(l / 2 - 0.2, rise * 1.7, l / 2, 0); sh.lineTo(-l / 2, 0);
    const mx = MG_R * Math.sin((a0 + a1) / 2), mz = MG_CZ + MG_R * Math.cos((a0 + a1) / 2);
    extrude('flat', sh, 0.4, { M: mul(M, mul(tr(mx, 7.9, mz), mul(rotY((a0 + a1) / 2), tr(0, 0, -0.2)))), c: key, cs: 6 }); };
  crest(-62 * PI / 180, -28 * PI / 180, 1.05);
  crest(-14 * PI / 180, 5 * PI / 180, 0.35); crest(20 * PI / 180, 37 * PI / 180, 0.35); crest(51 * PI / 180, 63 * PI / 180, 0.3);
  finial(at(-45 * PI / 180, 9.4), 0.4);
  // the ticket kiosk and the railings
  const Mk = at(28 * PI / 180);
  bx('flat', Mk, -1.05, 1.05, -0.7, 2.6, -0.55, 0.55, { c: Y }); bx('flat', Mk, -1.2, 1.2, 2.6, 2.9, -0.7, 0.7, { c: PALE });
  for (const s of [-1, 1]) panel('flat', 0.8, 1.15, { M: mul(Mk, mul(tr(0, 1.0, s * 0.57), rotY(s > 0 ? 0 : PI))), c: '#6a2c2c' });
  for (const [a0, a1] of [[48 * PI / 180, 66 * PI / 180], [36.5 * PI / 180, 40 * PI / 180], [15 * PI / 180, 19.5 * PI / 180]]) {
    const p = mgArc(a0), q = mgArc(a1), l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    rail(mul(M, mul(tr((p[0] + q[0]) / 2, -0.45, (p[1] + q[1]) / 2), rotY(Math.atan2(-(q[1] - p[1]), q[0] - p[0])))), l, 2.6, { c: '#ffffff' });
  }
  return end('Mondello gate');
}
const MG_WALLS = [
  ...mgSquare(-MG_HALF, 0, 1.2), ...mgSquare(MG_HALF, 0, 1.2), ...MG_COLS.flatMap((a) => mgSquare(...mgArc(a), 0.45)),
  ...[[12, 44], [44, 68]].map(([a, b]) => mgSeg(...mgArc(a * PI / 180), ...mgArc(b * PI / 180))),
];
export const MONDELLO_GATE = { name: 'Mondello beach gate', x: -3037, z: -9580, radius: 40, skipIds: ['w370274804'], dropWalls: ['w370274804'], walls: MG_WALLS, build: buildMondelloGate };

// the beach itself: rows of umbrellas and sunbeds along the waterline, lifeguard stands
function buildMondelloBeach() {
  initShared();
  const rn = RNG(821), wl = (z) => { for (let x = -3200; x < -2900; x += 2) if (groundY(x, z) < 0.3) return x; return -3000; };
  begin(0);
  const cols = ['#f2c230', '#2f6fb5', '#2f6fb5', '#f2f0e6', '#f2c230', '#e8473b', '#2f6fb5'];   // each lido's stretch in its own colour (Commons "Torre di Mondello 1": blocks of yellow and of blue umbrellas)
  defMat('stilt', 0, 0, [1, 1], null, {});
  let n = 0;
  for (let z = -9790; z <= -9440; z += 5.5) {
    const xw = wl(z);
    for (let row = 0; row < 3; row++) {
      if (rn() < 0.22) continue;
      const x = xw - 11 - row * 7.5 + (rn() - 0.5) * 1.6, zz = z + (rn() - 0.5) * 1.5, y = groundY(x, zz);
      if (y < 0.5 || Math.hypot(x - MG_C[0], zz - MG_C[1]) < 18 || nearPier(x, zz)) continue;
      rn(); const c = cols[((Math.floor((z + 9790) / 66) * 2) % cols.length + cols.length) % cols.length];   // (the number is still drawn, so the beds and the offsets stay where they were)
      cyl('flat', 0.04, 0.04, 2.2, 4, { p: [x, y, zz], c: '#cfcfcf', noao: true });
      cone('flat', 1.3, 0.55, 8, { p: [x, y + 2.05, zz], c, noao: true });
      const ry = rn() * PI; for (const dx of [-0.8, 0.8]) bx('marble', tr(x, y, zz), dx - 0.3, dx + 0.3, 0.05, 0.35, -0.9, 0.9, { c: rn() < 0.5 ? '#f2f0e6' : '#8cb6d8', noao: true });
      n++;
    }
  }
  for (const z of [-9740, -9660, -9560]) {
    const x = wl(z) - 16, y = groundY(x, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl('trunk', 0.1, 0.12, 2.6, 4, { p: [x + dx, y, z + dz], noao: true });
    bx('marble', tr(x, y, z), -1.5, 1.5, 2.6, 4.0, -1.5, 1.5, { c: '#f0e8d8' }); pyramid('tile', 3.6, 3.6, 0.9, { p: [x, y + 4.0, z], c: '#c8584a' });
    bx('flat', tr(x, y, z), -1.4, 1.4, 2.0, 2.6, -1.4, 1.4, { c: '#c8584a' });
  }
  ensureTrunk();
  return end('Mondello beach');
}
export const MONDELLO_BEACH = { name: 'Mondello beach front', x: -3060, z: -9640, radius: 180, skipIds: [], build: () => { ensureTrunk(); return buildMondelloBeach(); } };

// ====================================================================================================
// Orto Botanico: the Gymnasium (Doric portico, sphinxes, low red dome) and Villa Giulia's entrance gate
// ====================================================================================================
function buildGymnasium() {
  initShared();
  const pts = pairsOf(FP.gymnasium.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.48, 0.88);
  const gy = gr.hi + 0.15, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = Math.min(fr.w, 23.5), Dp = Math.min(fr.d, 23), H = 11.8;
  defMat('gymWall', 256, 256, [6, 6], (g, w, h) => { paintAshlar(g, w, h, 6, 6, 0.5, 1.2, '#e4ad6c', '#b98a52', 841, 2, 0.05); }, {});
  defMat('gymFront', 256, 128, [9, 5], (g, w, h) => { g.fillStyle = '#7e2f2c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 842, ['rgba(255,255,255,0.05)']); g.fillStyle = '#2b1a14'; g.fillRect(100, 40, 56, 88); g.fillStyle = '#d6b078'; g.fillRect(96, 34, 64, 6); });
  skirt('stone', M, W + 2, Dp + 2, -(gr.hi - gr.lo) - 2.5, { c: '#c2a67a' });
  bx('gymWall', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.1);
  // entablature with a triglyph frieze round the building
  bx('flat', M, -W / 2 - 0.4, W / 2 + 0.4, H - 1.8, H, -Dp / 2 - 0.4, Dp / 2 + 0.4, { c: '#e9c996' });
  bx('flat', M, -W / 2 - 0.9, W / 2 + 0.9, H, H + 0.6, -Dp / 2 - 0.9, Dp / 2 + 0.9, { c: '#f0d8aa' });
  for (let q = 0; q < 4; q++) for (let i = 0; i < Math.floor((q % 2 ? Dp : W) / 1.6); i++) bx('flat', mul(M, mul(rotY(q * PI / 2), tr(-(q % 2 ? Dp : W) / 2 + 0.8 + i * 1.6, 0, (q % 2 ? W : Dp) / 2 + 0.41))), 0, 0.5, H - 1.5, H - 0.3, 0, 0.12, { c: '#b8935c', noao: true });
  // portico of four Doric columns, a few steps and two sphinxes
  const PD = 4.2, MP = mul(M, tr(0, 0, Dp / 2));
  bx('gymFront', MP, -W / 2 + 4.5, W / 2 - 4.5, 0.4, H - 1.8, -0.02, 0.05, { noao: true });
  bx('flat', MP, -W / 2 + 3.4, W / 2 - 3.4, H - 1.8, H, 0, PD + 0.4, { c: '#e9c996' }); bx('flat', MP, -W / 2 + 3.0, W / 2 - 3.0, H, H + 0.6, -0.2, PD + 0.8, { c: '#f0d8aa' });
  for (let i = 0; i < 4; i++) { const x = -W / 2 + 4.6 + i * (W - 9.2) / 3; cyl('gymWall', 0.62, 0.78, H - 2.4, 12, { M: mul(MP, tr(x, 0.5, PD)), c: '#f2c88c' }); bx('flat', mul(MP, tr(x, 0, PD)), -0.95, 0.95, 0.0, 0.5, -0.95, 0.95, { c: '#e9c996' }); bx('flat', mul(MP, tr(x, 0, PD)), -1.0, 1.0, H - 1.9, H - 1.8, -1.0, 1.0, { c: '#f0d8aa' }); }
  for (let i = 0; i < 5; i++) bx('stone', MP, -W * 0.3 - i * 0.2, W * 0.3 + i * 0.2, 0, 0.5 - i * 0.1, PD + 0.6 + i * 0.4, PD + 1.0 + i * 0.4 + 0.2, { c: '#cbbf9f' });
  for (const sg of [-1, 1]) { const Ms = mul(MP, tr(sg * (W * 0.3 + 1.4), 0, PD + 3.2)); bx('stone', Ms, -0.9, 0.9, 0, 1.2, -1.2, 1.2, { c: '#d8cdb2' }); bx('marble', Ms, -0.45, 0.45, 1.2, 2.1, 0.0, 1.5, { c: '#b8c0c8' }); bx('marble', Ms, -0.5, 0.5, 1.2, 1.8, -1.6, 0.4, { c: '#b8c0c8' }); }
  // the low red dome with its drum behind the portico
  cyl('gymWall', 4.6, 4.8, 1.4, 14, { M: mul(M, tr(0, H + 0.6, -1)), c: '#f0d8aa' });
  lathe('red', [[4.8, 0], [4.5, 0.5], [3.6, 1.5], [2.0, 2.4], [0.01, 2.9]], 14, { M: mul(M, tr(0, H + 2.0, -1)), noao: true });
  return end('Gymnasium, Orto Botanico');
}
export const GYMNASIUM = { name: 'Gymnasium, Orto Botanico', x: 1053, z: 248, radius: 50, skipIds: [FP.gymnasium.id], build: buildGymnasium };

// Villa Giulia's entrance on Via Lincoln, in the gap the map's railing leaves: two ochre Doric lodges (two fluted columns between broad antae, entablature, cornice, a plain
// attic with a carved trophy on top), a tall square pier with a projecting cap on the gate side of each, the iron gate standing open between them, and the white stone
// pillars with their urns along the railing.
// Photos (Mapillary frames from Via Lincoln, 2021: 180028927364131, 179655860712222, 556565072170176, 326586379072750).
// Not verified: the backs of the lodges, their depth, the carved trophy's subject.
const VG_O = [1191.9, 138.75], VG_N = [-0.512, -0.859];   // the middle of the gap; towards Via Lincoln
const vgSeg = (x0, z0, x1, z1) => { const w = (x, z) => [Math.round((VG_O[0] + x * VG_N[1] + z * VG_N[0]) * 10) / 10, Math.round((VG_O[1] - x * VG_N[0] + z * VG_N[1]) * 10) / 10]; const a = w(x0, z0), b = w(x1, z1); return [a[0], a[1], b[0], b[1]]; };
const vgRect = (x0, x1, z0, z1) => [vgSeg(x0, z0, x1, z0), vgSeg(x1, z0, x1, z1), vgSeg(x1, z1, x0, z1), vgSeg(x0, z1, x0, z0)];
function buildVillaGiuliaGate() {
  initShared();
  const y = groundY(VG_O[0], VG_O[1]), M = frame(VG_O[0], y, VG_O[1], VG_N[0], VG_N[1]);
  begin(y);
  defMat('vgStone', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#bd9779'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 520, 2.5, 851, ['rgba(95,70,50,0.18)', 'rgba(235,210,185,0.16)']); streaks(g, w, h, 16, 852, 0.26, 80); g.fillStyle = 'rgba(80,55,38,0.12)'; for (let k = 0; k < h; k += 26) g.fillRect(0, k, w, 1); });
  const TRIM = '#a8896f', LO = -0.8;
  for (const sg of [-1, 1]) {
    const x = sg * 9.15, Ml = mul(M, tr(x, 0, 0));
    for (const s of [-1, 1]) bx('vgStone', Ml, Math.min(s * 2.0, s * 4.25), Math.max(s * 2.0, s * 4.25), LO, 5.4, -3.2, 0.4);        // the antae
    bx('vgStone', Ml, -2.0, 2.0, LO, 5.4, -3.2, -1.7);                                                                             // the back of the porch
    bx('flat', Ml, -2.0, 2.0, LO, 0.18, -1.7, 0.55, { c: '#a89a86' });
    for (const cx of [-0.72, 0.72]) { cyl('vgStone', 0.4, 0.52, 4.95, 12, { M: mul(Ml, tr(cx, 0.18, -0.08)), c: '#fff0e0' }); bx('vgStone', Ml, cx - 0.57, cx + 0.57, 5.13, 5.4, -0.65, 0.48, { c: '#fff0e0' }); }
    panel('flat', 4.0, 5.2, { M: mul(Ml, tr(0, 0.18, -1.68)), c: '#2a1c14' });
    rail(mul(Ml, tr(0, 0.18, -0.75)), 4.0, 2.7, { c: '#ffffff' });
    bx('vgStone', Ml, -4.3, 4.3, 5.4, 6.5, -3.25, 0.45);                                                                          // the entablature, its triglyphs, the cornice
    for (let i = -4; i <= 4; i++) bx('flat', Ml, i * 0.95 - 0.17, i * 0.95 + 0.17, 5.72, 6.3, 0.45, 0.52, { c: TRIM });
    bx('flat', Ml, -4.35, 4.35, 5.62, 5.72, -3.3, 0.54, { c: TRIM });
    bx('flat', Ml, -4.7, 4.7, 6.5, 6.72, -3.65, 0.85, { c: TRIM }); bx('flat', Ml, -4.5, 4.5, 6.72, 6.88, -3.45, 0.65, { c: '#bd9779' });
    bx('vgStone', Ml, -4.2, 4.2, 6.88, 8.0, -3.15, 0.2);
    bx('flat', Ml, -1.0, 1.0, 6.88, 7.2, 0.2, 0.62, { c: '#8f7460' });                                                             // the trophy
    sphere('flat', 0.45, { M: mul(Ml, tr(0, 7.55, 0.35)), c: '#8a705c', seg: 6, ky: 1.2, kz: 0.5 });
    for (const s of [-1, 1]) box('flat', 1.0, 0.28, 0.22, { M: Ml, p: [s * 0.65, 7.2, 0.35], rz: -s * 0.45, c: '#80675a' });
    // the pier on the gate side
    const Mp = mul(M, tr(sg * 3.95, 0, -0.45));
    bx('vgStone', Mp, -0.95, 0.95, LO, 1.25, -0.95, 0.95, { c: '#ece0d4' }); bx('vgStone', Mp, -0.85, 0.85, 1.25, 8.3, -0.85, 0.85);
    bx('flat', Mp, -1.2, 1.2, 8.3, 8.55, -1.2, 1.2, { c: TRIM }); bx('vgStone', Mp, -0.9, 0.9, 8.55, 9.1, -0.9, 0.9);
    cyl('flat', 0.36, 0.36, 0.05, 10, { M: mul(Mp, mul(tr(0, 3.7, 0.86), new THREE.Matrix4().makeRotationX(PI / 2))), c: '#4a2c30', noao: true });
    // the open gate leaf
    rail(mul(M, mul(tr(sg * 2.98, 0.05, -2.35), rotY(PI / 2))), 2.7, 4.0, { c: '#ffffff' });
    // white pillars with urns along the railing
    for (let i = 0; i < 3; i++) {
      const Mw = mul(M, tr(sg * (14.9 + i * 3.4), 0, 0));
      bx('flat', Mw, -0.32, 0.32, LO, 2.7, -0.32, 0.32, { c: '#e8e4da' }); bx('flat', Mw, -0.44, 0.44, 2.7, 2.92, -0.44, 0.44, { c: '#e8e4da' });
      lathe('flat', [[0.16, 0], [0.1, 0.15], [0.36, 0.5], [0.4, 0.62], [0.2, 0.72], [0.01, 0.8]], 8, { M: mul(Mw, tr(0, 2.92, 0)), c: '#d8d2c6', noao: true });
    }
  }
  return end('Villa Giulia gate');
}
const VG_WALLS = [-1, 1].flatMap((sg) => [
  ...vgRect(Math.min(sg * 4.9, sg * 13.4), Math.max(sg * 4.9, sg * 13.4), -3.2, 0.5),
  ...vgRect(sg * 3.95 - 0.95, sg * 3.95 + 0.95, -1.4, 0.5),
  ...[0, 1, 2].flatMap((i) => vgRect(sg * (14.9 + i * 3.4) - 0.32, sg * (14.9 + i * 3.4) + 0.32, -0.32, 0.32)),
]);
TREE_CLEAR.push([VG_O[0], VG_O[1], 15]);   // the photos show open pavement and the open gate: no generic tree across them
export const VILLA_GIULIA_GATE = { name: 'Villa Giulia gate', x: 1192, z: 139, radius: 40, skipIds: [], walls: VG_WALLS, build: buildVillaGiuliaGate };

// ====================================================================================================
// Teatro Garibaldi (street front on the old footprint)
// ====================================================================================================
function buildTeatroGaribaldi() {
  initShared();
  const pts = pairsOf(FP.garibaldiTheatre.p), gr = groundRange(pts), ob = obb(pts), fr = facing(ob, 0.89, -0.45);
  const gy = gr.hi + 0.1, M = frame(ob.cx, gy, ob.cz, fr.nx, fr.nz);
  begin(gy);
  const W = fr.w, Dp = fr.d, H = 19.0;
  defMat('tgFront', 256, 512, [W, H], (g, w, h) => paintFacade(g, w, h, W, H, { base: '#e1c79a', trim: '#f2e8d0', glass: '#2c2a2a', seed: 861, plinth: { h: 1.2, c: '#b8a07c' }, pil: { xs: [0.6, W - 0.6, W / 2 - 3.2, W / 2 + 3.2], w: 0.9, c: '#efe2c4' },
    bands: [{ y: 6.4, h: 0.4, c: '#f2e8d0' }, { y: 12.6, h: 0.4, c: '#f2e8d0' }, { y: 17.8, h: 0.8, c: '#f2e8d0' }],
    rows: [{ y0: 1.8, y1: 5.2, xs: [W * 0.2, W * 0.8], w: 1.4, kind: 'arch', fr: 0.2 }, { y0: 1.4, y1: 5.6, xs: [W / 2], w: 2.6, kind: 'door', glass: '#241c18' }, { y0: 7.4, y1: 11.4, xs: [W * 0.2, W / 2, W * 0.8], w: 1.4, kind: 'rect', ped: true, balc: true }, { y0: 13.4, y1: 16.6, xs: [W * 0.2, W / 2, W * 0.8], w: 1.3, kind: 'arch' }] }));
  skirt('stone', M, W + 1, Dp + 1, -(gr.hi - gr.lo) - 2, { c: '#a89c88' });
  bx('plaster', M, -W / 2, W / 2, 0, H, -Dp / 2, Dp / 2 - 0.02);
  panel('tgFront', W, H, { M: mul(M, tr(0, 0, Dp / 2 + 0.01)) });
  bx('flat', M, -W / 2 - 0.3, W / 2 + 0.3, H, H + 0.7, -Dp / 2, Dp / 2 + 0.5, { c: '#efe3c8' });
  const sh = new THREE.Shape(); sh.moveTo(-W * 0.2, 0); sh.lineTo(W * 0.2, 0); sh.lineTo(0, 2.2); sh.lineTo(-W * 0.2, 0);
  { const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }); part2('flat', g, mul(M, tr(0, H + 0.7, Dp / 2 - 0.4)), '#efe3c8'); }
  return end('Teatro Garibaldi');
}
function part2(key, g, M, c) { part(key, g, { M, c }); }
export const TEATRO_GARIBALDI = { name: 'Teatro Garibaldi', x: 669, z: 175, radius: 40, skipIds: [FP.garibaldiTheatre.id], build: buildTeatroGaribaldi };

// ====================================================================================================
// Ucciardone: the prison's perimeter wall: weathered tufa that batters out at the foot up to a rounded string course, a plain parapet above it, low rounded bulwarks at the sharp corners,
// glazed guard boxes on top and, over the front on Via Piano dell'Ucciardone, a long glazed gallery.
// Photos: Wikimedia Commons "Palermo-Sicilia-Italy - Creative Commons by gnuckx (3627550991)" (a bulwark, the string course, the guard boxes); Mapillary 2022 frames 998170054166227 and
// 3110038322579140 (the wall and the gallery from the road).
// Not verified: which corners besides the photographed kind have a bulwark, the places of the guard boxes, the heights, the south and west sides. Not built: the square pavilion seen above the
// wall from the north-east road, the steel palisade along the north-east, the gate.
// ====================================================================================================
// the wall line's edges: A, B, length, middle, unit normal pointing out of the prison
const UCC_EDGES = LINES.ucciardone.slice(0, -1).map((A, i) => { const B = LINES.ucciardone[i + 1], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); return { i, A, B, l, m: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], nx: dz / l, nz: -dx / l }; });
// corners sharp enough for a bulwark
const UCC_BULWARKS = UCC_EDGES.reduce((out, E, i) => { const F = UCC_EDGES[(i + 1) % UCC_EDGES.length], turn = Math.abs(Math.atan2(E.nx * F.nz - E.nz * F.nx, E.nx * F.nx + E.nz * F.nz)); if (turn > 0.9 && !out.some(t => Math.hypot(t[0] - E.B[0], t[1] - E.B[1]) < 18)) out.push(E.B); return out; }, []);
const UCC_ROADSIDE = new Set([1, 2, 3, 4, 17, 18, 19, 20, 36, 37, 38, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53]);   // edges a road runs against or crosses: no collision of ours there (the mapped walls stay as they are)
const UCC_WALLS = UCC_EDGES.filter(E => !UCC_ROADSIDE.has(E.i) && E.l >= 0.8).map(E => { const r = (v) => Math.round(v * 10) / 10; return [r(E.A[0] + E.nx * 0.9), r(E.A[1] + E.nz * 0.9), r(E.B[0] + E.nx * 0.9), r(E.B[1] + E.nz * 0.9)]; });
function buildUcciardone() {
  initShared();
  begin(0);
  defMat('uccTufa', 256, 256, [7, 7], (g, w, h) => { paintAshlar(g, w, h, 7, 7, 0.44, 0.95, '#c4a97c', '#8f774f', 871, 2, 0.14); noiseDots(g, w, h, 900, 4, 873, ['rgba(92,70,42,0.22)', 'rgba(238,214,168,0.2)']); streaks(g, w, h, 46, 872, 0.2, 150); }, {});
  const CY = 5.6, TOP = 8.1, CORD = '#cfb78a', COPE = '#bfa87e';
  const lows = (P) => groundY(P[0], P[1]);
  for (const E of UCC_EDGES) {
    if (E.l < 0.8) continue;
    const gA = lows(E.A), gB = lows(E.B), lo = Math.min(gA, gB) - 1.2, hi = Math.max(gA, gB), h = E.l / 2 + 0.3;
    const M = frame(E.m[0], 0, E.m[1], E.nx, E.nz);   // +z out of the prison, x along the wall
    bx('uccTufa', M, -h, h, lo, hi + CY, -0.7, 0.5);
    const q = new THREE.BufferGeometry();   // the battered outer face, from the foot to the string course
    q.setAttribute('position', new THREE.Float32BufferAttribute([-h, lo, 1.05, h, lo, 1.05, h, hi + CY, 0.55, -h, lo, 1.05, h, hi + CY, 0.55, -h, hi + CY, 0.55], 3)); q.computeVertexNormals(); q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    part('uccTufa', q, { M });
    bx('flat', M, -h, h, hi + CY, hi + CY + 0.32, -0.75, 0.8, { c: CORD });
    bx('uccTufa', M, -h, h, hi + CY + 0.32, hi + TOP, -0.55, 0.5);
    bx('flat', M, -h, h, hi + TOP, hi + TOP + 0.2, -0.65, 0.65, { c: COPE });
  }
  // a glazed box on the wall top: x along the wall, length by depth
  const guard = (M, len, dep, y) => {
    bx('flat', M, -len / 2, len / 2, y, y + 0.55, -dep / 2, dep / 2, { c: '#cfd2ca', noao: true });
    bx('flat', M, -len / 2 + 0.08, len / 2 - 0.08, y + 0.55, y + 1.85, -dep / 2 + 0.08, dep / 2 - 0.08, { c: '#5f948a', noao: true });
    const n = Math.max(1, Math.round(len / 1.2));
    for (let k = 0; k <= n; k++) { const x = -len / 2 + 0.06 + k * (len - 0.12) / n; for (const s of [-1, 1]) bx('flat', M, x - 0.05, x + 0.05, y + 0.55, y + 1.85, s * dep / 2 - 0.07, s * dep / 2 - 0.01, { c: '#dfe2da', noao: true }); }
    bx('flat', M, -len / 2 - 0.25, len / 2 + 0.25, y + 1.85, y + 2.05, -dep / 2 - 0.25, dep / 2 + 0.25, { c: '#bfc3bc', noao: true });
  };
  for (const B of UCC_BULWARKS) {
    const gy = groundY(B[0], B[1]), lo = gy - 1.2;
    cyl('uccTufa', 3.7, 4.35, gy + CY - lo, 10, { p: [B[0], lo, B[1]] });
    cyl('flat', 4.05, 4.05, 0.32, 10, { p: [B[0], gy + CY, B[1]], c: CORD });
    cyl('uccTufa', 3.65, 3.65, TOP - CY - 0.32, 10, { p: [B[0], gy + CY + 0.32, B[1]] });
    cyl('flat', 3.85, 3.85, 0.2, 10, { p: [B[0], gy + TOP, B[1]], c: COPE });
  }
  for (const k of [0, 2, 4, 6]) { const B = UCC_BULWARKS[k]; if (B) guard(frame(B[0], 0, B[1], 0, 1), 2.3, 2.3, groundY(B[0], B[1]) + TOP + 0.2); }
  for (const E of UCC_EDGES) if (E.l > 55) { const hi = Math.max(lows(E.A), lows(E.B)); guard(frame(E.m[0] + (E.B[0] - E.A[0]) * 0.22, 0, E.m[1] + (E.B[1] - E.A[1]) * 0.22, E.nx, E.nz), 2.4, 1.6, hi + TOP + 0.2); }
  { const E = UCC_EDGES.find(E => Math.hypot(E.B[0] + 148.1, E.B[1] + 1862.5) < 1);   // the long gallery, between about z -1913 and -1901
    if (E) { const x = E.A[0] + (E.B[0] - E.A[0]) * 0.42, z = E.A[1] + (E.B[1] - E.A[1]) * 0.42; guard(frame(x, 0, z, E.nx, E.nz), 12.5, 1.7, Math.max(lows(E.A), lows(E.B)) + TOP + 0.2); } }
  return end('Ucciardone walls');
}
export const UCCIARDONE = { name: 'Ucciardone walls', x: -300, z: -1900, radius: 250, skipIds: [], walls: UCC_WALLS, build: buildUcciardone };

// ====================================================================================================
// Fiera del Mediterraneo: the tall white pylon at the corner of the fair's wall by Piazza Generale Cascino, the thing seen from the street at this spot: a square white
// shaft with posters on its foot, then a stack of thin white blades in tiers that narrow to a point.
// Photos (Mapillary frames from Via Ammiraglio Rizzo, 2019: 1242231369535150, 194606842397237).
// Not verified: its height (judged from the traffic lights beside it), the far faces. Which entrance of the fair the old two-pylon model stood for is not verified either; no photo
// showed it at this corner, so it is gone.
// ====================================================================================================
const FI_O = [-336.3, -3052.0], FI_N = [0.98, 0.2];
function buildFieraGate() {
  initShared();
  const y = groundY(FI_O[0], FI_O[1]), M = frame(FI_O[0], y, FI_O[1], FI_N[0], FI_N[1]);
  begin(y);
  defMat('fiFoot', 96, 256, [2.4, 6.5], (g, w, h) => {
    g.fillStyle = '#e8e6df'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,90,85,0.28)'; for (let x = 8; x < w; x += 12) g.fillRect(x, 0, 2, h * 0.55);
    for (const [x, yy, ww, hh, c] of [[8, 150, 38, 54, '#c9c3b4'], [52, 148, 36, 44, '#2c3038'], [52, 196, 36, 40, '#d8cbb8'], [10, 208, 34, 28, '#a8503c']]) { g.fillStyle = c; g.fillRect(x, yy, ww, hh); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 4, yy + 6, ww - 8, 4); g.fillRect(x + 4, yy + 14, ww - 14, 2); }
    streaks(g, w, h, 6, 881, 0.14, 70);
  });
  bx('flat', M, -1.15, 1.15, -0.8, 6.5, -1.15, 1.15, { c: '#e8e6df' });
  for (let q = 0; q < 4; q++) panel('fiFoot', 2.34, 6.5, { M: mul(M, mul(rotY(q * PI / 2), tr(0, 0, 1.17))) });
  [[2.2, 4], [1.9, 4], [1.6, 3], [1.25, 3], [0.9, 2], [0.55, 2]].forEach(([wd, n], t) => {
    const y0 = 6.5 + t * 3.35, r = wd / 2;
    bx('flat', M, -r * 0.55, r * 0.55, y0, y0 + 3.4, -r * 0.55, r * 0.55, { c: '#b9bcbc', noao: true });
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      if (i > 0 && i < n - 1 && k > 0 && k < n - 1) continue;
      const x = -r + wd * i / (n - 1), z = -r + wd * k / (n - 1), top = y0 + 3.8 + ((i * 2 + k) % 3) * 0.35;
      bx('flat', M, x - 0.11, x + 0.11, y0 - 0.1, top, z - 0.11, z + 0.11, { c: '#f2f2ee', noao: true });
    }
    bx('flat', M, -r - 0.06, r + 0.06, y0, y0 + 0.14, -r - 0.06, r + 0.06, { c: '#dcdcd6', noao: true });
  });
  cone('flat', 0.18, 2.4, 4, { M: mul(M, tr(0, 26.9, 0)), c: '#f2f2ee', noao: true });
  return end('Fiera del Mediterraneo gate');
}
const FI_WALLS = (() => { const p = [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]].map(([x, z]) => [Math.round((FI_O[0] + x * FI_N[1] + z * FI_N[0]) * 10) / 10, Math.round((FI_O[1] - x * FI_N[0] + z * FI_N[1]) * 10) / 10]); return p.map((a, i) => { const b = p[(i + 1) % 4]; return [a[0], a[1], b[0], b[1]]; }); })();
export const FIERA_GATE = { name: 'Fiera del Mediterraneo gate', x: -336, z: -3052, radius: 40, skipIds: [], walls: FI_WALLS, build: buildFieraGate };

// ====================================================================================================
// Villa Igiea (Acquasanta): the golden tufa castle-villa on the bay. Pointed windows on the two lower floors, square ones with iron balconies above, bands of tile
// between them, battlements on every wall, square towers rising over the sea front, a slender octagonal turret with its balcony at the north end, palms in the garden.
// Photos (Wikimedia Commons): "Villa Igiea a Palermo lato giardino", "Villa Igiea Palermo lato nord", "VillaIgiea2", "Villa igiea".
// Not verified: which wings of the footprint carry the towers and the turret, the street side, the garden's terraces and pool (not built).
// ====================================================================================================
const IG_H = 15.7;
function paintIgiea(g, w, h) {   // one bay, 7 m x IG_H
  const sx = w / 7, sy = h / IG_H, X = (m) => m * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, 7, IG_H, 0.45, 0.9, '#d6a866', '#a97f4a', 891, 1.2, 0.08);
  const tile = (y) => { g.fillStyle = '#efe2c4'; g.fillRect(0, Y(y + 0.55), w, 0.55 * sy); g.fillStyle = '#44688a'; for (let x = 0; x < 7; x += 0.4) { g.beginPath(); g.moveTo(X(x), Y(y + 0.27)); g.lineTo(X(x + 0.2), Y(y + 0.48)); g.lineTo(X(x + 0.4), Y(y + 0.27)); g.lineTo(X(x + 0.2), Y(y + 0.07)); g.fill(); } };
  tile(5.0); tile(10.1);
  const point = (cx, ww, y0, y1) => {
    const path = (ex) => { const r = ww / 2 + ex, hs = y1 - ww * 0.7; g.beginPath(); g.moveTo(X(cx - r), Y(y0 - ex)); g.lineTo(X(cx - r), Y(hs)); g.quadraticCurveTo(X(cx - r * 0.82), Y(hs + (y1 - hs) * 0.6 + ex), X(cx), Y(y1 + ex * 1.6)); g.quadraticCurveTo(X(cx + r * 0.82), Y(hs + (y1 - hs) * 0.6 + ex), X(cx + r), Y(hs)); g.lineTo(X(cx + r), Y(y0 - ex)); g.closePath(); };
    path(0.22); g.fillStyle = '#f0dfba'; g.fill(); path(0); g.fillStyle = '#2c2824'; g.fill(); g.fillStyle = 'rgba(190,210,225,0.3)'; g.fillRect(X(cx - ww / 2) + 2, Y(y1 - ww * 0.7), ww * sx - 4, (y1 - y0 - ww * 0.7) * sy * 0.55); g.fillStyle = '#e8dcc0'; g.fillRect(X(cx) - 1, Y(y1 - 0.5), 2, (y1 - y0 - 0.5) * sy);
  };
  for (const cx of [1.75, 5.25]) {
    point(cx, 1.5, 1.2, 4.4); point(cx, 1.35, 6.2, 9.5);
    g.fillStyle = '#f0dfba'; g.fillRect(X(cx - 0.82), Y(13.55), 1.64 * sx, 2.6 * sy); g.fillStyle = '#26301f'; g.fillRect(X(cx - 0.62), Y(13.35), 1.24 * sx, 2.25 * sy); g.fillStyle = '#cfd6d4'; g.fillRect(X(cx) - 1, Y(13.35), 2, 2.25 * sy);
    g.fillStyle = '#2a2a30'; g.fillRect(X(cx - 1.15), Y(12.05), 2.3 * sx, 2); for (let k = 0; k <= 8; k++) g.fillRect(X(cx - 1.15 + k * 0.2875), Y(12.05), 1.5, 0.95 * sy); g.fillStyle = '#efe2c4'; g.fillRect(X(cx - 1.25), Y(11.1), 2.5 * sx, 0.22 * sy);
  }
  for (const [cx, cy] of [[3.5, 3.4], [3.5, 8.3], [3.5, 12.6], [0.05, 8.3], [6.95, 8.3]]) { g.fillStyle = '#f0dfba'; g.beginPath(); g.moveTo(X(cx), Y(cy + 0.42)); g.lineTo(X(cx + 0.34), Y(cy)); g.lineTo(X(cx), Y(cy - 0.42)); g.lineTo(X(cx - 0.34), Y(cy)); g.fill(); }
  g.fillStyle = '#b98a50'; g.fillRect(0, Y(15.2), w, 0.35 * sy); g.fillStyle = '#7e5c34'; for (let x = 0.1; x < 7; x += 0.5) g.fillRect(X(x), Y(14.85), 0.24 * sx, 0.4 * sy);   // the corbels under the battlements
  streaks(g, w, h, 16, 892, 0.12, 80);
}
function buildIgiea() {
  initShared(); ensureTrunk();
  const p = FP.igiea, pts = pairsOf(p.p), gr = groundRange(pts), gy = gr.hi + 0.1, H = IG_H, TUFA = '#d6a866';
  begin(gy);
  defMat('igWall', 224, 384, [7, H], paintIgiea);
  prism('tufa', pts, gr.lo - 2, gy, { c: '#d2ac76' });
  prism('igWall', pts, gy, gy + H, { uvo: [0, -gy / H] });
  prism('flat', pts, gy + H, gy + H + 0.15, { c: '#b98a64' });
  const merlons = (M, l) => panel('cren', l, 1.1, { M, uvk: [l / 1.25, 1], c: TUFA });
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    const Mw = frame((A[0] + B[0]) / 2, gy + H, (A[1] + B[1]) / 2, -dz / l, dx / l);
    bx('flat', Mw, -l / 2, l / 2, -0.1, 0.35, -0.3, 0.3, { c: '#e6c792' });
    merlons(mul(Mw, tr(0, 0.35, 0)), l);
  }
  // the towers over the sea front (flush with their wings) and the octagonal turret
  for (const [cx, cz, half, ang, th] of [[789.7, -3237.3, 5.12, Math.atan2(-0.868, -0.5), 20.6], [824.9, -3314.7, 4.62, Math.atan2(-0.851, -0.526), 19.8]]) {
    const T = mul(tr(cx, gy, cz), rotY(ang));
    bx('igWall', T, -half, half, H, th, -half, half, { uvo: [0, -gy / H] });
    bx('flat', T, -half - 0.35, half + 0.35, th, th + 0.45, -half - 0.35, half + 0.35, { c: '#e6c792' });
    for (let q = 0; q < 4; q++) merlons(mul(T, mul(rotY(q * PI / 2), tr(0, th + 0.45, half + 0.3))), 2 * half + 0.7);
  }
  const Mo = tr(794.2, gy, -3339.2);
  cyl('igWall', 2.1, 2.1, 20.5, 8, { M: Mo });
  cyl('tufa', 2.1, 2.1, gy - gr.lo + 1.5, 8, { M: mul(Mo, tr(0, gr.lo - gy - 1.5, 0)), c: '#d2ac76' });
  for (const [yy, r] of [[H + 0.2, 2.9], [20.5, 2.55]]) { cyl('flat', r, r - 0.3, 0.45, 8, { M: mul(Mo, tr(0, yy, 0)), c: '#e6c792' }); }
  cyl('flat', 2.82, 2.82, 0.08, 8, { M: mul(Mo, tr(0, H + 1.55, 0)), open: true, c: '#2a2a30', noao: true });
  for (let i = 0; i < 8; i++) box('flat', 0.07, 0.95, 0.07, { M: mul(Mo, mul(rotY(i * PI / 4 + PI / 8), tr(0, H + 0.65, 2.78))), c: '#2a2a30', noao: true });
  cyl('cren', 2.45, 2.45, 1.1, 8, { M: mul(Mo, tr(0, 20.95, 0)), open: true, c: TUFA, noao: true });
  for (const [x, z, hh, r] of [[814, -3262, 10, 0], [823, -3289, 11.5, 1], [807, -3222, 9, 2], [837, -3299, 9.5, 0.5], [818, -3276, 8, 1.5]]) palm(x, groundY(x, z), z, hh, { r });
  return end('Villa Igiea');
}
export const IGIEA = { name: 'Villa Igiea', x: 786, z: -3282, radius: 90, skipIds: [FP.igiea.id], build: buildIgiea };

// ====================================================================================================
// Villino Florio all'Olivuzza (Ernesto Basile, 1899-1902): warm grey stone; the front, towards Viale Regina Margherita, has the tall bay with the deep arched porch over a
// rusticated basement, a row of little arched windows and a steep gable under dark timber eaves with carved braces; the octagonal bay with its flared roof on its left, the
// sweeping stone stair up to the porch, the basin in front; steep pale stone-tiled roofs, and the round turret with its wide dark hat at the back.
// Photos (Wikimedia Commons): "Villino Florio", "Villino Florio (Palermo) 01", "15", "17", "18", "20" to "23", "Villino florio", "Villino florio 2".
// Not verified: the south and rear faces (plain windows), the exact corner of the turret, the plan of the roofs behind the gable.
// ====================================================================================================
const VF_O = [-1554.15, -427.6], VF_N = [-0.899, 0.437];
const localAt = (O, N, x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const ringSegsAt = (O, N, p) => p.map((a, i) => { const q = localAt(O, N, ...a), r = localAt(O, N, ...p[(i + 1) % p.length]); return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10, Math.round(r[0] * 10) / 10, Math.round(r[1] * 10) / 10]; });
const VF_STAIR = [[-1.9, 1.3], [-4.6, 2.9], [-7.4, 4.0], [-9.0, 5.8]];
function buildFlorio() {
  initShared(); ensureTrunk();
  const pts = pairsOf(FP.florio.p), gr = groundRange(pts), gy = gr.hi + 0.1, M = frame(VF_O[0], gy, VF_O[1], VF_N[0], VF_N[1]);
  begin(gy);
  const STONE = '#c9b99a', TRIM = '#ddd0b4', WOOD = '#4a3428';
  const rustic = (g, w, y0, y1) => { const r = RNG(903); for (let y = y0; y < y1; y += 11) for (let x = -r() * 18; x < w;) { const bw = 12 + r() * 16; g.fillStyle = `hsl(36,${14 + r() * 10}%,${56 + r() * 20}%)`; g.fillRect(x + 1, y + 1, bw - 2, 9); x += bw; } };
  defMat('vfSide', 192, 256, [5.4, 11.6], (g, w, h) => {
    paintAshlar(g, w, h, 5.4, 11.6, 0.42, 0.95, '#c6b696', '#97886c', 901, 1.2, 0.07);
    const sx = w / 5.4, sy = h / 11.6, Y = (y) => h - y * sy;
    g.fillStyle = '#8a7c62'; g.fillRect(0, Y(3.1), w, 3.1 * sy); rustic(g, w, Y(3.1), h);
    g.fillStyle = TRIM; g.fillRect(0, Y(3.35), w, 0.25 * sy); g.fillRect(0, Y(7.75), w, 0.2 * sy); g.fillRect(0, Y(11.6), w, 0.35 * sy);
    for (const cx of [1.45, 3.95]) for (const [y0, y1, arch] of [[0.9, 2.2, true], [4.3, 6.8, true], [8.5, 10.4, false]]) {
      g.fillStyle = TRIM; g.fillRect((cx - 0.65) * sx, Y(y1 + 0.25), 1.3 * sx, (y1 - y0 + 0.4) * sy); g.fillStyle = '#33261f';
      g.beginPath(); g.moveTo((cx - 0.48) * sx, Y(y0)); g.lineTo((cx - 0.48) * sx, Y(arch ? y1 - 0.45 : y1)); if (arch) g.quadraticCurveTo(cx * sx, Y(y1 + 0.35), (cx + 0.48) * sx, Y(y1 - 0.45)); else g.lineTo((cx + 0.48) * sx, Y(y1)); g.lineTo((cx + 0.48) * sx, Y(y0)); g.fill();
      g.fillStyle = '#8a5a38'; g.fillRect(cx * sx - 1, Y(y1 - 0.2), 2, (y1 - y0 - 0.2) * sy); g.fillRect((cx - 0.48) * sx, Y(y0 + (y1 - y0) * 0.55), 0.96 * sx, 1.5);
    }
    streaks(g, w, h, 12, 902, 0.12, 60);
  });
  defMat('vfFront', 192, 384, [7.2, 14.2], (g, w, h) => {
    paintAshlar(g, w, h, 7.2, 14.2, 0.42, 0.95, '#cbbb9b', '#9b8c70', 904, 1.2, 0.06);
    const sx = w / 7.2, sy = h / 14.2, X = (m) => (m + 3.6) * sx, Y = (y) => h - y * sy;
    g.fillStyle = '#8a7c62'; g.fillRect(0, Y(3.3), w, 3.3 * sy); rustic(g, w, Y(3.3), h);
    g.fillStyle = TRIM; g.fillRect(0, Y(3.5), w, 0.25 * sy);
    g.fillStyle = '#2a201a'; g.beginPath(); g.ellipse(X(0), Y(1.0), 1.2 * sx, 1.1 * sy, 0, PI, 0); g.lineTo(X(1.2), Y(0.3)); g.lineTo(X(-1.2), Y(0.3)); g.fill();      // the basement arch
    g.fillStyle = '#32231c'; g.fillRect(X(-2.0), Y(6.1), 4.0 * sx, 2.65 * sy); g.beginPath(); g.ellipse(X(0), Y(6.1), 2.0 * sx, 2.0 * sy, 0, PI, 0); g.fill();           // the porch, in shadow
    g.fillStyle = '#8a4f2c'; g.fillRect(X(-1.05), Y(5.7), 2.1 * sx, 2.25 * sy); g.beginPath(); g.ellipse(X(0), Y(5.7), 1.05 * sx, 1.15 * sy, 0, PI, 0); g.fill();
    g.fillStyle = '#d8c49c'; g.fillRect(X(0) - 1, Y(6.8), 2, 3.3 * sy); g.fillRect(X(-1.05), Y(5.7), 2.1 * sx, 2);
    g.fillStyle = TRIM; g.fillRect(X(-3.0), Y(9.1), 6.0 * sx, 0.28 * sy); g.fillRect(X(-1.2), Y(11.15), 2.4 * sx, 0.2 * sy);
    g.fillStyle = TRIM; g.fillRect(X(-0.95), Y(10.85), 1.9 * sx, 1.65 * sy); g.fillStyle = '#6a3a26'; for (const x of [-0.8, 0.05]) g.fillRect(X(x), Y(10.7), 0.75 * sx, 1.4 * sy);
    g.fillStyle = TRIM; g.fillRect(X(-2.5), Y(13.65), 5.0 * sx, 1.6 * sy);
    for (let i = 0; i < 5; i++) { const cx = (i - 2) * 0.92; g.fillStyle = '#33261f'; g.beginPath(); g.moveTo(X(cx - 0.3), Y(12.2)); g.lineTo(X(cx - 0.3), Y(13.0)); g.ellipse(X(cx), Y(13.0), 0.3 * sx, 0.36 * sy, 0, PI, 0); g.lineTo(X(cx + 0.3), Y(12.2)); g.fill(); }
    g.fillStyle = TRIM; g.beginPath(); g.ellipse(X(0), Y(11.55), 0.7 * sx, 0.28 * sy, 0, 0, 2 * PI); g.fill();
    streaks(g, w, h, 10, 905, 0.12, 80);
  });
  defMat('vfRoof', 64, 64, [2.2, 2.2], (g, w, h) => { g.fillStyle = '#b9b4a8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,66,58,0.55)'; g.lineWidth = 1.5; for (let y = 0; y < h; y += 8) for (let x = (y % 16) / 2; x < w + 8; x += 8) { g.beginPath(); g.arc(x, y + 2, 4.4, 0, PI); g.stroke(); } }, { side: THREE.DoubleSide });
  const SW = 5.4, SH = 11.6;
  const walls = (x0, x1, z0, z1, top) => {   // a block with the side texture, its cornice
    bx('vfSide', M, x0, x1, 0, top, z0, z1, { c: '#ffffff', uvo: [0, -gy / SH] });
    bx('flat', M, x0 - 0.18, x1 + 0.18, top, top + 0.35, z0 - 0.18, z1 + 0.18, { c: TRIM });
  };
  bx('flat', M, -7.95, 7.95, gr.lo - gy - 1.5, 0.02, -17.2, 0.0, { c: '#948568' });
  walls(-7.9, 5.0, -17.2, -0.4, 11.6); walls(5.0, 7.85, -17.2, -0.2, 9.3); walls(2.0, 7.85, -25.6, -17.2, 9.6);
  // the gabled bay, painted front, the porch arch standing out of it with its balustrade
  bx('vfSide', M, -2.2, 5.0, 0, 14.2, -9.0, 0.2, { uvo: [0, -gy / SH] });
  panel('vfFront', 7.2, 14.2, { M: mul(M, tr(1.4, 0, 0.23)) });
  archBay('vfSide', 5.2, 5.2, 4.1, 4.7, 0.55, { M: mul(M, tr(1.4, 3.5, 0.2)), c: '#fff6e4' });
  balus(mul(M, tr(1.4, 3.55, 1.95)), 4.6, 0.95);
  const GW = 7.2, GR = 3.9, GY = 14.2;
  gable('vfRoof', 'vfSide', mul(M, tr(1.4, 0, -4.35)), GW, 9.3, GY, GR, { ov: 0.9, th: 0.22 });
  const slope = Math.atan2(GR, GW / 2 + 0.9), SL = Math.hypot(GR, GW / 2 + 0.9);
  for (const sg of [-1, 1]) {   // the dark bargeboards and the carved braces under them
    box('flat', SL + 0.15, 0.36, 0.2, { M: M, p: [1.4 + sg * (GW / 2 + 0.9) / 2, GY + GR / 2 - 0.12, 1.2], rz: -sg * slope, c: WOOD, noao: true });
    box('flat', 3.1, 0.17, 0.12, { M: M, p: [1.4 + sg * 1.35, GY + 0.75, 0.5], rz: sg * 0.38, c: WOOD, noao: true });
    box('flat', 2.1, 0.13, 0.12, { M: M, p: [1.4 + sg * 0.62, GY + 1.45, 0.5], rz: sg * 1.0, c: WOOD, noao: true });
  }
  box('flat', 0.18, 2.7, 0.12, { M: M, p: [1.4, GY + 0.7, 0.5], c: WOOD, noao: true });
  cyl('flat', 0.06, 0.1, 1.7, 4, { M: mul(M, tr(1.4, GY + GR - 0.05, 1.15)), c: WOOD, noao: true }); sphere('flat', 0.26, { M: mul(M, tr(1.4, GY + GR + 0.7, 1.15)), c: WOOD, seg: 5, noao: true });
  // the roofs behind and the chimneys with their iron hats
  pyramid('vfRoof', 6.4, 12.5, 3.2, { M: mul(M, tr(-4.4, 11.95, -9.6)), noao: true });
  pyramid('vfRoof', 5.6, 7.6, 2.4, { M: mul(M, tr(4.8, 9.95, -21.4)), noao: true });
  for (const [x, z, top] of [[-2.9, -7.0, 16.0], [-3.4, -13.5, 15.4], [4.9, -10.5, 17.0]]) { bx('vfSide', M, x - 0.35, x + 0.35, 11.6, top, z - 0.35, z + 0.35, { c: '#fff6e4' }); cone('flat', 0.75, 0.7, 4, { M: mul(M, tr(x, top, z)), c: WOOD, noao: true }); }
  // the octagonal bay on the left, its windows and flared roof
  const Mk = mul(M, tr(-5.1, 0, -0.9)), KR = 2.7, KF = KR * Math.cos(PI / 8);
  cyl('vfSide', KR, KR, 8.7, 8, { M: Mk, t0: PI / 8 });
  cyl('flat', KR + 0.25, KR + 0.25, 0.3, 8, { M: mul(Mk, tr(0, 8.6, 0)), t0: PI / 8, c: TRIM });
  cyl('vfRoof', 0.12, KR + 1.0, 1.9, 8, { M: mul(Mk, tr(0, 8.95, 0)), t0: PI / 8, noao: true });
  cyl('flat', KR + 1.03, KR + 1.0, 0.18, 8, { M: mul(Mk, tr(0, 8.82, 0)), t0: PI / 8, c: WOOD, noao: true });
  cone('flat', 0.14, 1.2, 4, { M: mul(Mk, tr(0, 10.75, 0)), c: WOOD, noao: true });
  // the round turret at the back
  const Mt = mul(M, tr(-7.0, 0, -15.6));
  cyl('vfSide', 1.35, 1.5, 17.0, 10, { M: Mt, c: '#fff6e4' });
  cyl('flat', 1.75, 1.4, 0.45, 10, { M: mul(Mt, tr(0, 16.8, 0)), c: TRIM }); cyl('flat', 1.2, 1.25, 2.2, 10, { M: mul(Mt, tr(0, 17.25, 0)), c: STONE });
  for (let q = 0; q < 8; q++) panel('flat', 0.55, 1.25, { M: mul(Mt, mul(rotY(q * PI / 4), tr(0, 17.7, 1.25))), c: '#30241e' });
  lathe('flat', [[1.3, 0], [2.5, 0.15], [2.4, 0.35], [1.1, 0.9], [0.2, 1.6], [0.01, 1.7]], 10, { M: mul(Mt, tr(0, 19.35, 0)), c: '#4a4038', noao: true });
  cyl('flat', 0.03, 0.05, 2.2, 3, { M: mul(Mt, tr(0, 20.95, 0)), c: '#2a241e', noao: true });
  // the landing, the stair sweeping down to the left with its stone parapet, the basin
  bx('vfSide', M, -2.3, 4.2, -0.4, 3.45, 0.2, 2.0, { c: '#e8dcc6', uvo: [0, -gy / SH] });
  panel('flat', 2.3, 1.9, { M: mul(M, tr(1.4, 0, 2.02)), c: '#2a201a' });
  const N = 14, path = (t) => { const k = Math.min(VF_STAIR.length - 2, Math.floor(t * (VF_STAIR.length - 1))), u = t * (VF_STAIR.length - 1) - k, a = VF_STAIR[k], b = VF_STAIR[k + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  for (let i = 0; i < N; i++) {
    const a = path(i / N), b = path((i + 1) / N), l = Math.hypot(b[0] - a[0], b[1] - a[1]), top = 3.45 * (1 - (i + 0.5) / N), Ms = mul(M, mul(tr((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2), rotY(Math.atan2(-(b[1] - a[1]), b[0] - a[0]))));
    bx('flat', Ms, -l / 2 - 0.12, l / 2 + 0.12, -0.4, top, -0.95, 0.95, { c: '#a99a7e' });
    for (const s of [-1, 1]) bx('flat', Ms, -l / 2 - 0.05, l / 2 + 0.05, top, top + 0.62, s * 0.95 - 0.14, s * 0.95 + 0.14, { c: '#c6b89c' });
  }
  cyl('flat', 1.5, 1.3, 1.15, 12, { M: mul(M, tr(1.4, -0.4, 3.9)), c: '#b8aa8e' }); cyl('flat', 1.2, 1.2, 0.04, 12, { M: mul(M, tr(1.4, 0.75, 3.9)), c: '#5f8fa0', noao: true });
  for (const [x, z, hh] of [[-12.5, 1.5, 8], [10.8, 3.5, 9.5], [11.0, -15, 7.5]]) { const q = localAt(VF_O, VF_N, x, z); palm(q[0], groundY(q[0], q[1]), q[1], hh, { r: x }); }
  for (const [x, z, r] of [[-9.5, -3.0, 1.1], [6.6, 1.6, 0.9], [9.4, -5, 1.2], [-10, -9, 1.3]]) sphere('flat', r, { M: mul(M, tr(x, r * 0.5, z)), seg: 6, ky: 0.8, c: '#4a6e32', noao: true });
  return end('Villino Florio');
}
const VF_WALLS = ringSegsAt(VF_O, VF_N, [[4.3, -0.2], [4.3, 2.1], [2.9, 3.0], [2.9, 5.4], [-0.1, 5.4], [-0.9, 2.5], [-2.9, 3.2], [-6.9, 5.2], [-8.6, 7.0], [-10.4, 5.9], [-8.4, 2.8], [-8.0, 0.0], [-7.0, 1.7], [-3.3, 1.7], [-2.4, -0.2]]);
TREE_CLEAR.push([...localAt(VF_O, VF_N, -2, 9), 11]);   // the photos look at the front across open ground
export const FLORIO = { name: 'Villino Florio', x: -1542, z: -433, radius: 40, skipIds: [FP.florio.id], walls: VF_WALLS, build: buildFlorio };

// ====================================================================================================
// Villino Ida (Ernesto Basile's own house, Via Siracusa corner Via Principe di Villafranca, 1904): white plaster on a pink brick base, tall windows with dark shutters, flat
// pilasters that rise past the parapet into small capped pinnacles with a band of painted tiles between them, the taller corner pier on a rusticated stone quoin with its
// iron balcony, and a taller stair block at the far end.
// Photos (Wikimedia Commons): "Villino Ida Basile", "Palermo - Villino Ida Basile (13901)", "(13821)", "VillinoBasile1", "VillinoBasile2", "VillinoBasile5".
// Not verified: the faces away from the two streets (plain), where the carved entrance sits on them (not built), the stair block's exact place.
// ====================================================================================================
const ID_C = [-917.8, -1276.5];   // the street corner
const ID_FACES = [[[-928.2, -1297.8], ID_C], [ID_C, [-897.9, -1286.1]]];   // each from left to right as seen from its street
function buildIda() {
  initShared();
  const pts = pairsOf(FP.ida.p), gr = groundRange(pts), gy = gr.hi + 0.1, H = 11.6, L = 23.7, WHITE = '#eeeade', CAP = '#f6f3ea';
  begin(gy);
  defMat('idFront', 512, 256, [L, H], (g, w, h) => {
    const sx = w / L, sy = h / H, X = (m) => m * sx, Y = (y) => h - y * sy, bay = L / 5;
    g.fillStyle = '#ece7da'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 1100, 2, 906, ['rgba(120,110,90,0.08)', 'rgba(255,255,250,0.14)']);
    g.fillStyle = '#bd8268'; g.fillRect(0, Y(2.6), w, 2.6 * sy);
    g.strokeStyle = 'rgba(235,215,195,0.5)'; g.lineWidth = 1; for (let y = 0.2; y < 2.6; y += 0.24) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); }
    g.fillStyle = '#d8d0c0'; g.fillRect(0, Y(2.85), w, 0.25 * sy); g.fillRect(0, Y(6.7), w, 0.18 * sy); g.fillRect(0, Y(10.45), w, 0.2 * sy);
    for (let i = 0; i < 5; i++) {
      const cx = (i + 0.5) * bay;
      for (const [y0, y1] of [[3.1, 5.75], [7.0, 9.7]]) {
        g.fillStyle = '#d6cfc0'; g.fillRect(X(cx - 0.82), Y(y1 + 0.3), 1.64 * sx, (y1 - y0 + 0.3) * sy);
        g.fillStyle = '#243029'; g.fillRect(X(cx - 0.65), Y(y1), 1.3 * sx, (y1 - y0) * sy);
        g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = y0 + 0.12; y < y1; y += 0.17) g.fillRect(X(cx - 0.65), Y(y), 1.3 * sx, 1); g.fillRect(X(cx) - 1, Y(y1), 2, (y1 - y0) * sy);
      }
      g.fillStyle = '#2a2420'; g.fillRect(X(cx - 0.4), Y(1.7), 0.8 * sx, 0.9 * sy);
      g.fillStyle = '#2e4c7a'; g.fillRect(X(cx - 1.65), Y(11.38), 3.3 * sx, 0.82 * sy); g.fillStyle = '#efe6cc'; g.fillRect(X(cx - 1.65), Y(11.25), 3.3 * sx, 0.56 * sy);   // the tile band
      for (let k = 0; k < 5; k++) { const x = cx - 1.32 + k * 0.66; g.fillStyle = '#d8a022'; g.beginPath(); g.arc(X(x), Y(10.97), 0.23 * sx, 0, 2 * PI); g.fill(); g.fillStyle = '#2e4c7a'; g.beginPath(); g.arc(X(x), Y(10.97), 0.08 * sx, 0, 2 * PI); g.fill(); }
    }
    streaks(g, w, h, 34, 907, 0.12, 60);
  });
  prism('flat', pts, gr.lo - 2, gy, { c: '#8f8474' });
  prism('flat', pts, gy, gy + H, { c: '#e8e3d6' });
  prism('flat', pts, gy + H, gy + H + 0.15, { c: '#9c978c' });
  ID_FACES.forEach(([A, B], f) => {
    const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), Mf = frame((A[0] + B[0]) / 2, gy, (A[1] + B[1]) / 2, -dz / l, dx / l);
    panel('idFront', l, H, { M: mul(Mf, tr(0, 0, 0.02)), uvk: [l / L, 1] });
    bx('flat', Mf, -l / 2, l / 2, H - 0.05, H + 0.3, -0.35, 0.18, { c: CAP });
    for (let i = 0; i <= 5; i++) {
      if (i === (f ? 0 : 5)) continue;                                                                    // the corner pier stands there
      const x = Math.max(-l / 2 + 0.3, Math.min(l / 2 - 0.3, -l / 2 + i * l / 5));
      bx('flat', Mf, x - 0.27, x + 0.27, 2.8, 12.45, -0.3, 0.2, { c: WHITE }); bx('flat', Mf, x - 0.38, x + 0.38, 12.45, 12.75, -0.42, 0.32, { c: CAP });
    }
    // the iron balcony turning the corner
    const e = f ? -1 : 1, x0 = e * (l / 2 - 4.2), x1 = e * (l / 2 + 0.85);
    bx('flat', Mf, Math.min(x0, x1), Math.max(x0, x1), 6.45, 6.72, 0, 0.95, { c: '#d6cfc0' });
    rail(mul(Mf, tr((x0 + x1) / 2, 6.72, 0.92)), Math.abs(x1 - x0), 1.05, { c: '#ffffff' });
    for (let k = 0; k < 3; k++) bx('flat', Mf, x0 + e * (0.5 + k * 1.5) - 0.13, x0 + e * (0.5 + k * 1.5) + 0.13, 5.95, 6.45, 0, 0.7, { c: '#d6cfc0' });
  });
  // the corner pier and its rusticated foot
  const [A, B] = ID_FACES[0], Mc = mul(tr(ID_C[0], gy, ID_C[1]), rotY(Math.atan2(B[0] - A[0], B[1] - A[1])));
  bx('flat', Mc, -0.62, 0.62, 2.8, 13.2, -0.62, 0.62, { c: WHITE }); bx('flat', Mc, -0.84, 0.84, 13.2, 13.55, -0.84, 0.84, { c: CAP }); bx('flat', Mc, -0.55, 0.55, 13.55, 13.9, -0.55, 0.55, { c: WHITE });
  for (let k = 0; k < 6; k++) { const r = k % 2 ? 0.74 : 0.86; bx('flat', Mc, -r, r, k ? k * 0.47 : gr.lo - gy - 0.5, k * 0.47 + 0.43, -r, r, { c: '#d9d5ca' }); }
  // the stair block at the far end of the Villafranca face
  const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), Ms = frame(A[0] + dx / l * 3.0, gy, A[1] + dz / l * 3.0, -dz / l, dx / l);
  bx('flat', Ms, -2.4, 2.4, H, 14.6, -4.6, -0.5, { c: WHITE }); bx('flat', Ms, -2.6, 2.6, 14.6, 14.9, -4.8, -0.3, { c: CAP });
  for (const x of [-1.0, 0, 1.0]) panel('flat', 0.55, 1.5, { M: mul(Ms, tr(x, 12.4, -0.48)), c: '#2c3430' });
  return end('Villino Ida');
}
export const IDA = { name: 'Villino Ida', x: -913, z: -1292, radius: 40, skipIds: [FP.ida.id], build: buildIda };
