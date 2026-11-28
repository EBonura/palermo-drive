// City landmarks, group D: signature places outside the centro that had only a generic extrusion before.
// Albergo delle Povere, Palazzo di Giustizia, Villa Niscemi, Villa Castelnuovo with the Teatro di Verdura pavilion, Castello di Maredolce,
// Tonnara Florio, Convento dei Cappuccini (catacombs) and its church. (Porta Felice is built by src/landmarks.js.)
// Footprints come from src/landmarks-city-data2.js (world tiles, OSM); coordinates of the places were checked against Wikipedia (see docs/faithfulness/landmarks.md).
import * as THREE from 'three';
import {
  PI, bx, begin, end, defMat, part, box, cyl, lathe, sphere, cone, panel, archBay, prism, extrude, gable,
  mul, tr, rotY, frame, pairsOf, centroid, obb, groundRange, groundY, initShared, ensureTrunk, paintAshlar, paintFacade, noiseDots, streaks, RNG,
  statue, palm, crenel, rail, balus,
} from './lmc-kit.js';
import { FP2 } from './landmarks-city-data2.js';

// ---------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------
// farthest hit of a ray from (cx,cz) with a ring
function rayFar(ring, cx, cz, dx, dz) {
  let best = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ez - (a[1] - cz) * ex) / den, s = ((a[0] - cx) * dz - (a[1] - cz) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best;
}
// the footprint's front: the box axis closest to the direction of the nearest road, and the frame on the wall in that direction (local +z outward)
function front(key) {
  const f = FP2[key], pts = pairsOf(f.p), holes = (f.holes || []).map(pairsOf), ob = obb(pts), c = centroid(pts), fc = f.face || [0, 1];
  let n = null;
  for (const [nx, nz] of [[ob.ux, ob.uz], [-ob.ux, -ob.uz], [ob.vx, ob.vz], [-ob.vx, -ob.vz]]) { const d = nx * fc[0] + nz * fc[1]; if (!n || d > n.d) n = { nx, nz, d }; }
  // use the ray through the middle of the box on that side so that wings and notches do not mislead it
  const hit = rayFar(pts, ob.cx, ob.cz, n.nx, n.nz);
  const x = ob.cx + n.nx * hit, z = ob.cz + n.nz * hit;
  const across = Math.abs(n.nx * ob.ux + n.nz * ob.uz) > 0.7 ? ob.d : ob.w;   // box extent along the front wall
  return { pts, holes, ob, c, nx: n.nx, nz: n.nz, hit, across, at: (y) => frame(x, y, z, n.nx, n.nz), x, z };
}
// storey facade texture: one bay of bayW metres, H metres tall, repeated along every wall (v starts at the base, see body())
function facadeMat(key, bayW, H, spec, px = 40) {
  defMat(key, Math.max(64, Math.round(bayW * px / 16) * 16), Math.max(128, Math.round(H * px / 16) * 16), [bayW, H], (g, w, h) => paintFacade(g, w, h, bayW, H, spec));
}
// the building mass: optional foundation, walls with the repeating facade (v aligned to the base), flat roof cap, cornice round every edge
function body(key, bayW, H, pts, holes, y0, o = {}) {
  if (o.lo !== undefined && o.lo < y0) prism('stone', pts, o.lo, y0, { holes, c: o.footC || '#d8d0bc' });
  prism(key, pts, y0, y0 + H, { holes, uvo: [0, -y0 / H] });
  prism('flat', pts, y0 + H, y0 + H + 0.2, { holes, c: o.roof || '#8f8a82' });
  const rings = [pts, ...(o.holeCornice ? holes : [])];
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    bx('flat', frame((A[0] + B[0]) / 2, y0 + H - 0.5, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, o.cornH || 0.8, -(o.cornD || 0.5), o.cornD || 0.5, { c: o.cc || '#e6d9bc' });
  }
}
// arcade along the inside of a courtyard ring: bays of `bay` metres, ground storey and first floor, towards the courtyard centre
function arcade(ring, y0, o = {}) {
  let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
  const bay = o.bay || 3.6; let n = 0;
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 5) continue;
    let nx = -dz / l, nz = dx / l; if (nx * (cx - (A[0] + B[0]) / 2) + nz * (cz - (A[1] + B[1]) / 2) < 0) { nx = -nx; nz = -nz; }
    const nb = Math.floor(l / bay), bw = l / nb;
    for (let q = 0; q < nb; q++) {
      const t = (q + 0.5) * bw, px = A[0] + dx / l * t, pz = A[1] + dz / l * t;
      for (let fl = 0; fl < (o.floors || 2); fl++) {
        const M = frame(px, y0 + fl * 4.9, pz, nx, nz);
        archBay('marble', bw, 4.6, bw - 1.1, 3.9, 0.9, { M, c: o.c || '#f0e6cc' });
        bx('flat', M, -bw / 2, bw / 2, 4.6, 4.9, 0, 1.0, { c: o.cc || '#e6d9bc', noao: true });
        n++;
      }
    }
  }
  return n;
}

// ====================================================================================================
// Albergo delle Povere (Corso Calatafimi): the long 18th-century poorhouse in golden brown tufa. Tall arched windows with iron lattices on the ground floor, a first floor of windows in stone
// frames, small oval windows under the cornice and a pale attic band that carries the name over the middle. The portal, in the middle of the front on Corso Calatafimi: an arched door between
// two columns, a broken pediment round a white marble shield, a curved iron balcony and a window with a pointed pediment. Two-storey arcades round the courtyards.
// Photos: Wikimedia Commons "Reale albergo delle povere (Palermo - c.so Calatafimi)", "RAP 17 07 2019 03" (the portal and its bays); Mapillary 168124611892840, 441006383682054,
// 918033495655517 (the long front from the road, which side it is on).
// Not verified: the number of bays, the other fronts (given the same bays), the courtyards. The church seen in the main courtyard is not built (it does not show from the street).
// ====================================================================================================
const AP_C = [-1344, 686.5], AP_N = [0.457, 0.89], AP_BAY = 4.4, AP_H = 15.0;   // the middle of the front on Corso Calatafimi and the way it faces
const apAt = (x, z) => [Math.round((AP_C[0] + x * AP_N[1] + z * AP_N[0]) * 10) / 10, Math.round((AP_C[1] - x * AP_N[0] + z * AP_N[1]) * 10) / 10];
function paintApBay(g, w, h) {
  const sx = w / AP_BAY, sy = h / AP_H, X = (m) => m * sx, Y = (y) => h - y * sy, c = AP_BAY / 2;
  paintAshlar(g, w, h, AP_BAY, AP_H, 0.5, 1.1, '#b48d59', '#8a6a44', 951, 1.5, 0.13); noiseDots(g, w, h, 800, 3.5, 952, ['rgba(84,56,28,0.18)', 'rgba(236,206,152,0.18)']);
  const R = (x0, x1, y0, y1, col) => { g.fillStyle = col; g.fillRect(X(x0), Y(y1), X(x1 - x0), (y1 - y0) * sy); };
  const head = (hw, y0, y1, rise, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(X(c - hw), Y(y0)); g.lineTo(X(c - hw), Y(y1 - rise)); g.quadraticCurveTo(X(c), Y(y1 + rise), X(c + hw), Y(y1 - rise)); g.lineTo(X(c + hw), Y(y0)); g.closePath(); g.fill(); };
  R(0, AP_BAY, 0, 1.15, 'rgba(70,48,26,0.35)');
  // the ground floor window under its iron lattice
  head(1.28, 2.55, 6.85, 0.45, '#caa56e'); head(0.92, 2.9, 6.45, 0.4, '#2c241e'); R(c - 1.4, c + 1.4, 2.4, 2.65, '#caa56e'); R(c - 0.15, c + 0.15, 6.55, 7.0, '#d6b47c');
  g.save(); g.beginPath(); g.rect(X(c - 0.92), Y(6.35), X(1.84), 3.45 * sy); g.clip(); g.strokeStyle = 'rgba(150,112,80,0.75)'; g.lineWidth = 1;
  for (let k = -12; k < 20; k++) { g.beginPath(); g.moveTo(X(c - 0.92), Y(2.9 + k * 0.42)); g.lineTo(X(c + 0.92), Y(2.9 + k * 0.42 + 2.3)); g.moveTo(X(c - 0.92), Y(2.9 + k * 0.42)); g.lineTo(X(c + 0.92), Y(2.9 + k * 0.42 - 2.3)); g.stroke(); }
  g.restore(); R(c - 0.04, c + 0.04, 2.9, 6.5, '#5a3c28');
  // the string course and the first floor window in its frame
  R(0, AP_BAY, 7.35, 7.55, '#cfab74'); R(0, AP_BAY, 7.2, 7.35, 'rgba(60,38,18,0.45)');
  head(1.1, 8.3, 11.65, 0.28, '#caa56e'); head(0.7, 8.6, 11.3, 0.22, '#6e4a34'); head(0.58, 8.7, 11.15, 0.18, '#39434a'); R(c - 0.05, c + 0.05, 8.6, 11.25, '#6e4a34'); for (const y of [9.35, 10.1, 10.7]) R(c - 0.65, c + 0.65, y, y + 0.06, '#6e4a34'); R(c - 1.25, c + 1.25, 8.15, 8.4, '#d2ae77');
  // the oval window of the attic storey
  g.fillStyle = '#c9a46d'; g.beginPath(); g.ellipse(X(c), Y(12.45), X(0.75), 0.48 * sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#241d18'; g.beginPath(); g.ellipse(X(c), Y(12.45), X(0.52), 0.28 * sy, 0, 0, 2 * PI); g.fill();
  R(0, AP_BAY, 13.1, 13.55, '#c19b66'); R(0, AP_BAY, 12.98, 13.1, 'rgba(55,35,18,0.55)');
  R(0, AP_BAY, 13.55, AP_H, '#d3bf9d'); R(0, AP_BAY, 14.85, AP_H, '#b9a27e'); noiseDots(g, w, Math.round(1.45 * sy), 90, 2, 953, ['rgba(120,96,60,0.16)', 'rgba(250,236,208,0.2)']);
  streaks(g, w, h, 16, 954, 0.16, 150);
}
function buildPovere() {
  initShared();
  const F = front('povere'), gr = groundRange(F.pts), gy = groundY(...apAt(0, 1.5)) + 0.05, H = AP_H;   // the floor is the pavement in front of the portal; the ground rises behind and to the west
  begin(gy);
  defMat('apWall', 192, 640, [AP_BAY, AP_H], paintApBay);
  defMat('apTitle', 256, 32, [8, 1], (g, w, h) => { g.fillStyle = '#d3bf9d'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 60, 2, 955, ['rgba(120,96,60,0.16)', 'rgba(250,236,208,0.2)']); g.fillStyle = '#2f3038'; g.font = '700 18px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R. ALBERGO DELLE POVERE', w / 2, h / 2 + 1, w - 6); });
  defMat('apDoor', 128, 216, [3.2, 5.4], (g, w, h) => {
    const sx = w / 3.2, sy = h / 5.4, Y = (y) => h - y * sy; g.fillStyle = '#c4a06a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d1713'; g.beginPath(); g.moveTo(0.18 * sx, Y(0)); g.lineTo(0.18 * sx, Y(3.7)); g.ellipse(w / 2, Y(3.7), 1.42 * sx, 1.42 * sy, 0, PI, 0); g.lineTo(3.02 * sx, Y(0)); g.fill();
    g.strokeStyle = 'rgba(190,160,110,0.7)'; g.lineWidth = 1; for (let k = 1; k < 12; k++) { const a = PI * k / 12; g.beginPath(); g.moveTo(w / 2, Y(3.75)); g.lineTo(w / 2 + Math.cos(a) * 1.4 * sx, Y(3.75) - Math.sin(a) * 1.4 * sy); g.stroke(); }
    for (const r of [0.45, 0.95]) { g.beginPath(); g.ellipse(w / 2, Y(3.75), r * sx, r * sy, 0, PI, 0); g.stroke(); }
    g.fillStyle = '#5e4130'; g.fillRect(0.18 * sx, Y(3.7), 2.84 * sx, 3.7 * sy); g.strokeStyle = 'rgba(25,15,8,0.65)'; g.lineWidth = 2;
    for (const x of [0.18, 0.89, 1.6, 2.31, 3.02]) { g.beginPath(); g.moveTo(x * sx, Y(0)); g.lineTo(x * sx, Y(3.7)); g.stroke(); } for (const y of [1.1, 2.6, 3.68]) { g.beginPath(); g.moveTo(0.18 * sx, Y(y)); g.lineTo(3.02 * sx, Y(y)); g.stroke(); }
    g.fillStyle = '#15100d'; g.fillRect(0.95 * sx, Y(2.55), 0.65 * sx, 2.55 * sy);   // the wicket standing open
  });
  const u0 = AP_C[0] * AP_N[1] - AP_C[1] * AP_N[0];   // so that a bay of the texture is centred on the portal
  if (gr.lo - 2 < gy) prism('stone', F.pts, gr.lo - 2, gy, { holes: F.holes, c: '#a8916a' });
  prism('apWall', F.pts, gy, gy + H, { holes: F.holes, uvo: [0.5 - (u0 / AP_BAY - Math.floor(u0 / AP_BAY)), -gy / H] });
  prism('flat', F.pts, gy + H, gy + H + 0.2, { holes: F.holes, c: '#9c8e7a' });
  for (const ring of [F.pts, ...F.holes]) for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    const Me = frame((A[0] + B[0]) / 2, gy, (A[1] + B[1]) / 2, -dz / l, dx / l);
    bx('flat', Me, -l / 2, l / 2, 13.15, 13.55, -0.45, 0.45, { c: '#bd9b68' }); bx('flat', Me, -l / 2, l / 2, H - 0.05, H + 0.25, -0.2, 0.2, { c: '#bfa781' });
  }
  // courtyards: arcades on the three largest, within a triangle budget
  let bays = 0;
  [...F.holes].sort((a, b) => b.length - a.length).slice(0, 3).forEach(h => { if (bays < 90) bays += arcade(h, gy, { bay: 4.0 }); });
  // the portal and the name over it
  const M = frame(AP_C[0], gy, AP_C[1], AP_N[0], AP_N[1]), ST = '#e2bd84', SD = '#c39a62';
  panel('apTitle', 8.0, 1.0, { M: mul(M, tr(0, 13.7, 0.06)) });
  bx('tufa', M, -3.1, 3.1, -1.2, 7.9, -0.1, 0.12, { c: '#d9b47c' });
  panel('apDoor', 3.2, 5.4, { M: mul(M, tr(0, 0, 0.14)) });
  for (const sg of [-1, 1]) {
    const x = sg * 2.25;
    bx('tufa', M, x - 0.48, x + 0.48, -1.2, 1.15, 0.1, 1.05, { c: ST });
    cyl('tufa', 0.3, 0.37, 4.35, 10, { M: mul(M, tr(x, 1.15, 0.6)), c: '#f0cf9a' });
    bx('tufa', M, x - 0.5, x + 0.5, 5.5, 5.8, 0.1, 1.05, { c: ST }); bx('tufa', M, x - 0.42, x + 0.42, 5.8, 6.2, 0.1, 0.9, { c: SD }); bx('tufa', M, x - 0.65, x + 0.65, 6.2, 6.4, 0.1, 1.15, { c: ST });
    const sh = new THREE.Shape(); sh.moveTo(sg * 2.9, 6.4); sh.quadraticCurveTo(sg * 2.45, 7.65, sg * 1.1, 7.7); sh.lineTo(sg * 1.1, 7.32); sh.quadraticCurveTo(sg * 2.05, 7.2, sg * 2.4, 6.4); sh.closePath();   // the two halves of the broken pediment
    extrude('tufa', sh, 0.55, { M: mul(M, tr(0, 0, 0.1)), c: ST, cs: 5 });
  }
  bx('tufa', M, -1.8, 1.8, 5.75, 6.15, 0.1, 0.5, { c: SD });
  const arms = new THREE.Shape(); arms.moveTo(0, 6.15); arms.quadraticCurveTo(0.95, 6.3, 0.62, 6.9); arms.quadraticCurveTo(0.8, 7.6, 0, 7.65); arms.quadraticCurveTo(-0.8, 7.6, -0.62, 6.9); arms.quadraticCurveTo(-0.95, 6.3, 0, 6.15);
  extrude('flat', arms, 0.3, { M: mul(M, tr(0, 0, 0.35)), c: '#e9e5da', cs: 5 });
  bx('tufa', M, -2.7, 2.7, 7.85, 8.15, 0, 1.25, { c: SD }); for (const x of [-2.2, 2.2]) bx('tufa', M, x - 0.22, x + 0.22, 7.45, 7.85, 0, 0.8, { c: SD });
  rail(mul(M, tr(0, 8.15, 1.28)), 5.4, 1.05, { c: '#2a2a2a' }); for (const sg of [-1, 1]) rail(mul(M, mul(tr(sg * 2.7, 8.15, 0.65), rotY(PI / 2))), 1.25, 1.05, { c: '#2a2a2a' });
  bx('tufa', M, -1.2, 1.2, 8.15, 11.65, 0, 0.16, { c: ST }); bx('flat', M, -0.75, 0.75, 8.2, 11.3, 0.16, 0.19, { c: '#33383c', noao: true });
  for (const x of [-0.75, 0, 0.75]) bx('flat', M, x - 0.05, x + 0.05, 8.2, 11.35, 0.18, 0.22, { c: '#6e4a34', noao: true }); for (const y of [9.2, 10.2, 11.3]) bx('flat', M, -0.78, 0.78, y, y + 0.07, 0.18, 0.22, { c: '#6e4a34', noao: true });
  bx('tufa', M, -1.75, 1.75, 11.65, 11.9, 0, 0.5, { c: SD });
  const ped = new THREE.Shape(); ped.moveTo(-1.75, 11.9); ped.lineTo(1.75, 11.9); ped.lineTo(0, 12.9); ped.closePath();
  extrude('tufa', ped, 0.4, { M, c: ST });
  return end('Albergo delle Povere');
}
const AP_WALLS = (() => { const p = [[-2.75, 0], [-2.75, 1.1], [2.75, 1.1], [2.75, 0]].map(([x, z]) => apAt(x, z)); return p.slice(1).map((b, i) => [...p[i], ...b]); })();
export const POVERE = { name: 'Albergo delle Povere', x: -1382, z: 633, radius: 130, skipIds: [FP2.povere.id], walls: AP_WALLS, build: buildPovere };

// ====================================================================================================
// Palazzo di Giustizia (Piazza Vittorio Emanuele Orlando; Ernesto and Gaetano Rapisardi, 1938 to 1957): pale travertine. The entrance front faces north over the square: the
// central block, taller than the wings, with eight free-standing flat piers the full height before a dark glazed wall, the name cut in the architrave above them and a
// stone portal in the middle; plain stone either side of it; the wings with pilaster strips, four rows of tall windows and a row of small ones under the cornice; roof boxes
// with the flagpoles. A travertine base and steps take up the fall of the ground.
// Photos (Wikimedia Commons): "Palazzo di Giustizia (Palermo) 19 06 2026 01" to "04"; Mapillary frames 3210637175736982, 1189007502262508, 4278877168809848.
// Not verified: the south front (given the wings' windows), the courtyards; the square's own sunken level and its wall are not built.
// ====================================================================================================
const PG_C = [-817.85, -348.55], PG_N = [-0.151, -0.988], PG_HW = 21.5;   // the middle of the entrance front, towards the square; half its width
function buildGiustizia() {
  initShared();
  const F = front('giustizia'), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 22.2, HC = 25.2, STONE = '#e2d8c2', PIER = '#d6d3c8';
  begin(gy);
  const joints = (g, w, h, m) => { g.fillStyle = 'rgba(110,96,72,0.22)'; for (let y = 0; y < h; y += m) g.fillRect(0, y, w, 1); };
  defMat('pgStone', 128, 128, [4, 4], (g, w, h) => { paintAshlar(g, w, h, 4, 4, 0.5, 1.3, '#dcd2bc', '#bcb098', 962, 1, 0.05); streaks(g, w, h, 6, 963, 0.08, 60); });
  defMat('pgWall', 128, 624, [4.5, H], (g, w, h) => {
    const sx = w / 4.5, sy = h / H, Y = (y) => h - y * sy;
    g.fillStyle = '#ddd3be'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 700, 2.5, 961, ['rgba(120,100,70,0.09)', 'rgba(255,252,240,0.12)']); joints(g, w, h, 0.62 * sy);
    g.fillStyle = '#ebe3d0'; g.fillRect(0, Y(17.7), 0.5 * sx, 15.3 * sy); g.fillRect(w - 0.5 * sx, Y(17.7), 0.5 * sx, 15.3 * sy); g.fillRect(0, Y(18.1), w, 0.4 * sy); g.fillRect(0, Y(2.4), w, 0.3 * sy);
    const win = (y0, y1, ww) => { const x = (4.5 - ww) / 2 * sx; g.fillStyle = '#efe8d8'; g.fillRect(x - 3, Y(y1) - 3, ww * sx + 6, (y1 - y0) * sy + 8); g.fillStyle = '#46555e'; g.fillRect(x, Y(y1), ww * sx, (y1 - y0) * sy); g.fillStyle = 'rgba(20,24,26,0.45)'; g.fillRect(x, Y(y1), ww * sx, (y1 - y0) * sy * 0.3); g.fillStyle = '#c9cdc8'; g.fillRect(w / 2 - 1, Y(y1), 2, (y1 - y0) * sy); g.fillRect(x, Y(y0 + (y1 - y0) * 0.55), ww * sx, 1.5); };
    win(0.7, 1.8, 1.5); for (const y of [3.2, 6.9, 10.6, 14.3]) win(y, y + 2.7, 1.9); win(19.0, 20.3, 1.4);
    streaks(g, w, h, 12, 964, 0.07, 120);
  });
  defMat('pgGlass', 96, 352, [5.8, 21], (g, w, h) => {   // the glazed wall behind the piers, one bay: five floors of dark windows in a thin frame
    g.fillStyle = '#33414a'; g.fillRect(0, 0, w, h); const sy = h / 21;
    for (let f = 0; f < 5; f++) { const y = h - (f * 4.1 + 4.0) * sy; g.fillStyle = 'rgba(150,185,210,0.28)'; g.fillRect(0, y, w, 1.5 * sy); g.fillStyle = '#aaa89e'; g.fillRect(0, y + 3.5 * sy, w, 0.6 * sy); g.fillStyle = '#1c2428'; for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 1, y, 2, 3.5 * sy); g.fillRect(0, y + 1.5 * sy, w, 2); }
  });
  defMat('pgTitle', 512, 40, [43, 3], (g, w, h) => { g.fillStyle = '#ded4bf'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 965, ['rgba(120,100,70,0.1)', 'rgba(255,252,240,0.12)']); g.fillStyle = '#6d6250'; g.font = '500 17px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P A L A Z Z O   D I   G I U S T I Z I A', w / 2, h / 2 + 1); });
  prism('pgStone', F.pts, gr.lo - 3, gy, { holes: F.holes });
  prism('pgWall', F.pts, gy, gy + H, { holes: F.holes, uvo: [0, -gy / H] });
  prism('flat', F.pts, gy + H, gy + H + 0.2, { holes: F.holes, c: '#b8b0a0' });
  for (const ring of [F.pts, ...F.holes]) for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue;
    bx('flat', frame((A[0] + B[0]) / 2, gy + H - 0.4, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, 0.9, -0.55, 0.55, { c: '#d8cdb6' });
  }
  const M = frame(PG_C[0], gy, PG_C[1], PG_N[0], PG_N[1]);
  // plain stone either side of the centre: over the two set-back wall pieces of the footprint
  for (const [A, B, flag] of [[[-849.4, -338.6], [-838.4, -340.3], ['#2a4a9a']], [[-795.7, -346.3], [-783.9, -348.1], ['#2f7a46', '#eeeeea', '#c23a32']]]) {   // west, east
    const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), Mf = frame((A[0] + B[0]) / 2, gy, (A[1] + B[1]) / 2, dz / l, -dx / l);
    bx('pgStone', Mf, -l / 2, l / 2, 0, H - 0.4, -0.05, 0.12);
    const T = mul(Mf, tr(0, H, -2.6)); bx('pgStone', T, -4.0, 4.0, 0, 2.2, -2.0, 2.0); bx('flat', T, -4.3, 4.3, 2.2, 2.45, -2.3, 2.3, { c: '#d8cdb6' });
    cyl('flat', 0.07, 0.09, 5.5, 4, { M: mul(T, tr(0, 2.4, 1.6)), c: '#d8d8d8', noao: true });
    flag.forEach((c, i) => { const fw = 2.2 / flag.length; box('flat', fw, 1.35, 0.05, { M: mul(T, tr(0.07 + fw * (i + 0.5), 6.5, 1.6)), c, noao: true }); });
  }
  // the central block: the glazed wall, eight piers, the architrave with the name, the portal and its steps
  const LO = gr.lo - gy - 1.0;   // the square falls away below the floor: a travertine base under the piers
  bx('pgStone', M, -PG_HW - 0.35, PG_HW + 0.35, LO, 0, -0.4, 1.65);
  panel('pgGlass', 2 * PG_HW - 1.4, 21.0, { M: mul(M, tr(0, 0.3, 0.06)), uvk: [(2 * PG_HW - 1.4) / 5.8, 1] });
  for (let i = 0; i < 8; i++) bx('pgStone', M, (i - 3.5) * 5.75 - 0.7, (i - 3.5) * 5.75 + 0.7, -0.1, 21.4, 0.1, 1.5, { c: PIER });
  for (const sg of [-1, 1]) bx('pgStone', M, Math.min(sg * (PG_HW - 0.75), sg * (PG_HW + 0.25)), Math.max(sg * (PG_HW - 0.75), sg * (PG_HW + 0.25)), LO, 21.4, -0.3, 1.5);
  bx('pgStone', M, -PG_HW - 0.25, PG_HW + 0.25, 21.4, HC, -3.0, 1.5);
  panel('pgTitle', 2 * PG_HW, 3.0, { M: mul(M, tr(0, 21.7, 1.52)) });
  bx('flat', M, -PG_HW - 0.55, PG_HW + 0.55, HC, HC + 0.35, -3.2, 1.85, { c: '#d3c8b0' });
  for (const sg of [-1, 1]) bx('pgStone', M, Math.min(sg * 3.3, sg * 5.2), Math.max(sg * 3.3, sg * 5.2), LO, 5.6, 1.2, 3.4, { c: STONE });
  bx('pgStone', M, -5.5, 5.5, 5.6, 6.9, 1.2, 3.6, { c: STONE });
  panel('flat', 6.6, 5.6, { M: mul(M, tr(0, 0, 2.2)), c: '#1f2a2e' });
  for (const x of [-1.65, 0, 1.65]) bx('flat', M, x - 0.06, x + 0.06, 0, 5.6, 2.2, 2.27, { c: '#8a9496' });
  bx('pgStone', M, -3.3, 3.3, LO, 0, 1.6, 2.4, { c: '#d6cfbc' });
  for (let i = 0; i < 7; i++) bx('pgStone', M, -3.3, 3.3, LO, -i * 0.2, 2.4 + i * 0.45, 2.85 + i * 0.45, { c: '#d6cfbc' });
  return end('Palazzo di Giustizia');
}
const PG_WALLS = (() => { const p = [[-PG_HW - 0.35, 0], [-PG_HW - 0.35, 1.7], [-5.3, 1.7], [-5.3, 3.5], [-3.35, 3.5], [-3.35, 5.6], [3.35, 5.6], [3.35, 3.5], [5.3, 3.5], [5.3, 1.7], [PG_HW + 0.35, 1.7], [PG_HW + 0.35, 0]].map(([x, z]) => [Math.round((PG_C[0] + x * PG_N[1] + z * PG_N[0]) * 10) / 10, Math.round((PG_C[1] - x * PG_N[0] + z * PG_N[1]) * 10) / 10]);
  return p.slice(1).map((b, i) => [p[i][0], p[i][1], b[0], b[1]]); })();
export const GIUSTIZIA = { name: 'Palazzo di Giustizia', x: -806, z: -330, radius: 110, skipIds: [FP2.giustizia.id], walls: PG_WALLS, build: buildGiustizia };

// ====================================================================================================
// Villa Niscemi (Piana dei Colli): cream baroque villa with stone balconies, a low service wing with a balustraded terrace and orange pergola cloths.
// ====================================================================================================
function buildNiscemi() {
  initShared(); ensureTrunk();
  const F = front('niscemi'), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 13.2;
  begin(gy);
  facadeMat('nsWall', 4.6, H, { base: '#ecdfb9', trim: '#f7efd8', glass: '#2a2422', seed: 971, plinth: { h: 0.9, c: '#d8c89e' }, grime: 1,
    bands: [{ y: 4.5, h: 0.3, c: '#f4ead0' }, { y: 9.0, h: 0.3, c: '#f4ead0' }, { y: 12.4, h: 0.5, c: '#f4ead0' }],
    rows: [{ y0: 1.4, y1: 3.6, xs: [2.3], w: 1.1, kind: 'rect', fr: 0.16 }, { y0: 5.4, y1: 8.2, xs: [2.3], w: 1.2, kind: 'rect', ped: true, balc: true, shut: 'open' }, { y0: 9.9, y1: 11.9, xs: [2.3], w: 1.1, kind: 'rect', shut: 'open' }], shut: '#3a2f28' });
  body('nsWall', 4.6, H, F.pts, F.holes, gy, { lo: gr.lo - 1.5, roof: '#b6704f', cc: '#f4ead0' });
  const M = F.at(gy);   // the arched entrance and its balcony
  archBay('tufa', 3.4, 4.0, 2.0, 3.4, 0.5, { M: mul(M, tr(0, 0, 0.0)), c: '#f2e8c8' });
  bx('dark', M, -0.9, 0.9, 0, 3.0, 0.1, 0.18, { noao: true });
  bx('flat', M, -1.9, 1.9, 5.0, 5.4, 0, 1.0, { c: '#e8dcc0' });
  balus(mul(M, tr(0, 5.4, 1.0)), 3.8, 0.9);
  // palms and a stone urn at the entrance
  palm(F.x + F.nx * 12 + F.nz * 9, groundY(F.x + F.nx * 12, F.z + F.nz * 12), F.z + F.nz * 12 - F.nx * 9, 11, { r: 1 });
  palm(F.x + F.nx * 11 - F.nz * 10, groundY(F.x + F.nx * 11, F.z + F.nz * 11), F.z + F.nz * 11 + F.nx * 10, 12, { r: 2 });
  return end('Villa Niscemi');
}
export const NISCEMI = { name: 'Villa Niscemi', x: -2354, z: -5420, radius: 70, skipIds: [FP2.niscemi.id], build: buildNiscemi };

// ====================================================================================================
// Villa Castelnuovo (the Istituto Agrario, the "Ginnasio Castelnuovo"): a low neoclassical building, one tall storey of pale plaster with brown shutters under a Doric frieze
// and a plain attic that carries the lettering; in the middle of each long front a deep open porch through the building with fluted yellow Doric columns, steps between
// two statues; a low saucer dome behind the attic. "Istituto Castelnuovo" on the front towards the south-west, "...alla sicura agricoltura" on the other. Date palms round it.
// Photos (Wikimedia Commons): "Villa Castelnuovo, Palermo 1", "3", "4".
// Not verified: which of the two inscriptions faces which way (judged from the mountain behind the Istituto front), the words before "alla", the short sides (plain), the
// windows of the north-east front (given the same as the other).
// ====================================================================================================
const CNU_C = [-2314.45, -4742.1], CNU_N = [-0.812, 0.584], CNU_W = 40.3, CNU_D = 19.35;
function buildCastelnuovo() {
  initShared(); ensureTrunk();
  const F = front('castelnuovo'), gr = groundRange(F.pts), gy = gr.hi + 0.1, M = frame(CNU_C[0], gy, CNU_C[1], CNU_N[0], CNU_N[1]);
  const W = CNU_W, D = CNU_D, H = 6.6, PH = 4.0, PALE = '#ece2c8', TRIM = '#f4eede';
  begin(gy);
  defMat('cnuWall', 512, 112, [W, 7.7], (g, w, h) => {   // the wall with its shutters and, along the top 1.1 m, the Doric frieze
    const sx = w / W, sy = h / 7.7, X = (m) => (m + W / 2) * sx, Y = (y) => h - y * sy;
    g.fillStyle = '#e9ddc0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 900, 3, 981, ['rgba(170,130,80,0.13)', 'rgba(255,250,235,0.18)']);
    g.fillStyle = '#d4c4a2'; g.fillRect(0, Y(1.0), w, 1.0 * sy);
    for (const x of [-16.6, -11.8, -7.2, 7.2, 11.8, 16.6]) { g.fillStyle = '#f4eede'; g.fillRect(X(x - 1.0), Y(4.5), 2.0 * sx, 3.1 * sy); g.fillStyle = '#7a4632'; g.fillRect(X(x - 0.78), Y(4.3), 1.56 * sx, 2.8 * sy); g.fillStyle = 'rgba(40,18,10,0.45)'; for (let y = 1.7; y < 4.2; y += 0.3) g.fillRect(X(x - 0.78), Y(y), 1.56 * sx, 1); g.fillRect(X(x) - 1, Y(4.3), 2, 2.8 * sy); }
    streaks(g, w, h, 30, 982, 0.12, 40);
    g.fillStyle = '#eee6d2'; g.fillRect(0, 0, w, 1.1 * sy); g.fillStyle = '#c9bc9c'; g.fillRect(0, Y(6.72), w, 2); for (let x = -W / 2; x < W / 2; x += 1) for (let k = 0; k < 3; k++) g.fillRect(X(x + 0.12 + k * 0.15), Y(7.55), 1, 0.65 * sy);
  });
  defMat('cnuText', 512, 64, [18, 2], (g, w, h) => { g.fillStyle = '#ece2c8'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 260, 2, 983, ['rgba(170,130,80,0.14)', 'rgba(255,250,235,0.18)']); g.fillStyle = '#5a4c3a'; g.font = '600 21px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ISTITUTO  CASTELNUOVO', w / 2, 17); g.fillText('ALLA  SICURA  AGRICOLTURA', w / 2, 49); });
  bx('flat', M, -W / 2, W / 2, gr.lo - gy - 1.2, 0.02, -D / 2, D / 2, { c: '#a89c80' });
  for (const sg of [-1, 1]) bx('flat', M, Math.min(sg * PH, sg * W / 2), Math.max(sg * PH, sg * W / 2), 0, H, -D / 2, D / 2, { c: PALE });   // the two wings
  bx('flat', M, -PH, PH, 5.3, H, -D / 2, D / 2, { c: TRIM });                                                                          // the ceiling over the passage
  bx('flat', M, -PH, PH, 0, 0.6, -D / 2, D / 2, { c: '#aca28c' });
  for (const s of [-1, 1]) {   // the two long fronts: s = 1 towards the south-west
    const Ms = mul(M, mul(rotY(s > 0 ? 0 : PI), tr(0, 0, D / 2)));
    for (const sg of [-1, 1]) panel('cnuWall', W / 2 - PH, H, { M: mul(Ms, tr(sg * (W / 2 + PH) / 2, 0, 0.02)), uvk: [(W / 2 - PH) / W, H / 7.7], uvo: [sg < 0 ? 0 : (W / 2 + PH) / W, 0] });
    for (const x of [-1.45, 1.45]) { cyl('flat', 0.4, 0.54, 4.35, 12, { M: mul(Ms, tr(x, 0.6, -0.65)), c: '#e6c676' }); cyl('flat', 0.62, 0.45, 0.2, 12, { M: mul(Ms, tr(x, 4.95, -0.65)), c: TRIM }); bx('flat', Ms, x - 0.65, x + 0.65, 5.15, 5.32, -1.3, 0, { c: TRIM }); }
    panel('cnuWall', W, 1.1, { M: mul(Ms, tr(0, H, 0.12)), uvk: [1, 1.1 / 7.7], uvo: [0, H / 7.7] });
    panel('cnuText', 18, 0.95, { M: mul(Ms, tr(0, 8.12, 0.0)), uvk: [1, 0.5], uvo: [0, s > 0 ? 0.5 : 0] });
    for (let i = 0; i < 4; i++) bx('flat', Ms, -4.4 - i * 0.2, 4.4 + i * 0.2, -0.8, 0.6 - i * 0.15, i * 0.35, 0.4 + i * 0.35, { c: '#c4baa2' });
    for (const x of [-5.4, 5.4]) { bx('flat', Ms, x - 0.45, x + 0.45, -0.6, 1.1, 0.4, 1.3, { c: '#c4baa2' }); statue('flat', mul(Ms, tr(x, 1.1, 0.85)), 1.5); }
  }
  for (const sg of [-1, 1]) panel('flat', 1.2, 2.8, { M: mul(M, mul(tr(sg * (PH - 0.02), 0.6, 3.6), rotY(-sg * PI / 2))), c: '#5a3628' });
  bx('flat', M, -W / 2 - 0.12, W / 2 + 0.12, H, H + 1.1, -D / 2 - 0.1, D / 2 + 0.1, { c: TRIM });
  bx('flat', M, -W / 2 - 0.5, W / 2 + 0.5, 7.7, 7.98, -D / 2 - 0.5, D / 2 + 0.5, { c: '#e2d8c0' });
  bx('flat', M, -W / 2 - 0.1, W / 2 + 0.1, 7.98, 8.05, -D / 2 - 0.1, D / 2 + 0.1, { c: '#a89a80' });
  for (const s of [-1, 1]) bx('flat', M, -10.5, 10.5, 7.98, 9.15, Math.min(s * (D / 2 - 0.6), s * (D / 2 - 0.02)), Math.max(s * (D / 2 - 0.6), s * (D / 2 - 0.02)), { c: PALE });   // the lettered attic (the text lies on its face)
  // the dome
  cyl('flat', 4.6, 4.8, 2.0, 16, { M: mul(M, tr(0, 8.0, 0)), c: PALE });
  lathe('flat', [[4.9, 0], [4.7, 0.25], [4.2, 0.35], [3.8, 1.2], [2.9, 2.0], [1.6, 2.6], [0.5, 2.9], [0.3, 3.4], [0.01, 3.5]], 16, { M: mul(M, tr(0, 10.0, 0)), c: '#c9a468', noao: true });
  cyl('flat', 0.04, 0.06, 2.6, 3, { M: mul(M, tr(0, 13.4, 0)), c: '#3a342a', noao: true });
  for (const [x, z, hh] of [[-10.5, 13.0, 9], [10.8, 12.6, 10.5], [-15.5, -12.8, 11], [-6.5, -13.2, 9.5], [14.5, -12.6, 10]]) { const wx = CNU_C[0] + x * CNU_N[1] + z * CNU_N[0], wz = CNU_C[1] - x * CNU_N[0] + z * CNU_N[1]; palm(wx, groundY(wx, wz), wz, hh, { r: x }); }
  return end('Villa Castelnuovo');
}
const CNU_WALLS = [-1, 1].flatMap((s) => { const p = [[-6.0, CNU_D / 2], [-6.0, CNU_D / 2 + 1.45], [6.0, CNU_D / 2 + 1.45], [6.0, CNU_D / 2]].map(([x, z]) => [Math.round((CNU_C[0] + s * (x * CNU_N[1] + z * CNU_N[0])) * 10) / 10, Math.round((CNU_C[1] + s * (-x * CNU_N[0] + z * CNU_N[1])) * 10) / 10]);
  return p.slice(1).map((b, i) => [p[i][0], p[i][1], b[0], b[1]]); });
export const CASTELNUOVO = { name: 'Villa Castelnuovo', x: -2314, z: -4742, radius: 50, skipIds: [FP2.castelnuovo.id], walls: CNU_WALLS, build: buildCastelnuovo };

// ====================================================================================================
// The entrance pavilion of the Teatro di Verdura on Viale del Fante: a neoclassical pronaos with two herms under a pediment; the gate in front is flanked by stone sphinxes.
// ====================================================================================================
function buildVerdura() {
  initShared();
  const F = front('verdura'), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 7.2, M = F.at(gy);
  begin(gy);
  defMat('vdWall', 128, 128, [3, 3], (g, w, h) => { g.fillStyle = '#e2cf92'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 991, ['rgba(110,85,50,0.10)', 'rgba(255,250,220,0.10)']); streaks(g, w, h, 8, 992, 0.08, 60); });
  const W = F.across, D = Math.min(F.ob.d, F.ob.w);
  body('vdWall', 3, H, F.pts, [], gy, { lo: gr.lo - 1.0, roof: '#a89878', cc: '#d8c680', cornH: 1.0 });
  // pronaos: shallow porch with two herms (telamones) carrying the architrave, a pediment above
  bx('dark', M, -W * 0.22, W * 0.22, 0, H - 1.2, -0.02, 0.4, { c: '#2c2622', noao: true });
  for (const sx of [-1, 1]) {
    bx('vdWall', M, sx * W * 0.34 - 0.55, sx * W * 0.34 + 0.55, 0, H - 1.2, 0, 1.3);
    bx('marble', M, sx * W * 0.1 - 0.4, sx * W * 0.1 + 0.4, 0.3, H - 1.8, 0.3, 1.1, { c: '#d9d3c2' });     // herm shaft
    sphere('marble', 0.38, { M: mul(M, tr(sx * W * 0.1, H - 1.9, 0.7)), c: '#d9d3c2', seg: 6 });             // head
  }
  bx('vdWall', M, -W / 2 - 0.3, W / 2 + 0.3, H - 1.2, H, 0, 1.6, { c: '#efe3b8' });
  const sh = new THREE.Shape(); sh.moveTo(-W * 0.52, 0); sh.lineTo(W * 0.52, 0); sh.lineTo(0, 1.7); sh.lineTo(-W * 0.52, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), { M: mul(M, tr(0, H, 0.6)), c: '#efe3b8' });
  // the gate on the street, with two sphinx pillars and a low iron railing
  const MG = mul(M, tr(0, 0, 9));
  for (const sx of [-1, 1]) {
    bx('tufa', MG, sx * 3.2 - 0.8, sx * 3.2 + 0.8, 0, 2.2, -0.8, 0.8, { c: '#cfc3a0' });
    bx('marble', MG, sx * 3.2 - 0.4, sx * 3.2 + 0.4, 2.2, 2.9, -0.9, 0.6, { c: '#bdb6a4' });              // sphinx body
    box('marble', 0.5, 0.7, 0.5, { M: MG, p: [sx * 3.2, 2.2, 0.8], c: '#bdb6a4' });                           // raised head
    bx('flat', MG, sx * 3.2 - 0.3, sx * 3.2 + 0.3, 0.05, 3.5, 0.9, 1.1, { c: '#6a6a60', noao: true });          // lantern post
  }
  rail(mul(MG, tr(-7.5, 0, 0)), 8.5, 1.6, { c: '#ffffff' }); rail(mul(MG, tr(7.5, 0, 0)), 8.5, 1.6, { c: '#ffffff' });
  return end('Teatro di Verdura (entrance)');
}
export const VERDURA = { name: 'Teatro di Verdura (entrance pavilion)', x: -2362, z: -4953, radius: 40, skipIds: [FP2.verdura.id], build: buildVerdura };

// ====================================================================================================
// Castello di Maredolce (Palazzo della Favara, Brancaccio): plain blocky sandstone Norman pleasure palace with tall blind pointed arches on the
// long walls, narrow slit windows, a crenellated top and a round tower on one corner.
// ====================================================================================================
function buildMaredolce() {
  initShared();
  const F = front('maredolce'), gr = groundRange(F.pts), gy = gr.hi + 0.1, H = 11.5;
  begin(gy);
  defMat('mdWall', 512, 256, [14, H], (g, w, h) => {
    const sx = w / 14, sy = h / H, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, 14, H, 0.42, 1.0, '#c4aa7c', '#8f7a54', 1001, 2, 0.06);
    for (const cx of [3.5, 10.5]) {
      g.beginPath(); g.moveTo(X(cx - 2.2), Y(0.4)); g.lineTo(X(cx - 2.2), Y(7.2)); g.quadraticCurveTo(X(cx - 2.2), Y(9.3), X(cx), Y(10.2)); g.quadraticCurveTo(X(cx + 2.2), Y(9.3), X(cx + 2.2), Y(7.2)); g.lineTo(X(cx + 2.2), Y(0.4)); g.closePath();
      g.fillStyle = '#b39967'; g.fill(); g.strokeStyle = 'rgba(60,45,25,0.55)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#2a2219'; g.fillRect(X(cx - 0.18), Y(7.2), 0.36 * sx, 1.6 * sy); g.fillRect(X(cx - 0.18), Y(3.6), 0.36 * sx, 1.4 * sy);
    }
    streaks(g, w, h, 40, 1002, 0.22, 200);
  });
  body('mdWall', 14, H, F.pts, [], gy, { lo: gr.lo - 2.5, roof: '#a89a7a', cc: '#cdb98e', cornH: 0.6, cornD: 0.35 });
  for (let i = 0; i < F.pts.length; i++) {   // crenellation along every wall
    const A = F.pts[i], B = F.pts[(i + 1) % F.pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 2) continue;
    crenel(frame((A[0] + B[0]) / 2, gy + H + 0.2, (A[1] + B[1]) / 2, -dz / l, dx / l), l, { c: '#cdb98e' });
  }
  // the round tower on the corner nearest the road
  const o = F.ob, cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.cx + o.ux * a * o.w / 2 + o.vx * b * o.d / 2, o.cz + o.uz * a * o.w / 2 + o.vz * b * o.d / 2]);
  let best = cs[0]; for (const c of cs) if (Math.hypot(c[0] - F.x, c[1] - F.z) < Math.hypot(best[0] - F.x, best[1] - F.z)) best = c;
  const tx = best[0] - (best[0] - o.cx) * 0.06, tz = best[1] - (best[1] - o.cz) * 0.06;
  cyl('stone', 2.7, 3.0, H + 5.5, 10, { p: [tx, gy - 0.5, tz], c: '#d6c39a' });
  cyl('flat', 3.1, 3.1, 0.5, 10, { p: [tx, gy + H + 5.0, tz], c: '#cdb98e' });
  return end('Castello di Maredolce');
}
export const MAREDOLCE = { name: 'Castello di Maredolce', x: 2288, z: 2587, radius: 50, skipIds: [FP2.maredolce.id], build: buildMaredolce };

// ====================================================================================================
// Tonnara Florio (Arenella): the long cream-plastered houses of the old tuna works round its court (two rows of windows with green shutters, arched doors, flat roofs), the
// round reddish mill tower with its gallery and narrower top, and at the corner by the harbour the Palazzina dei Quattro Pizzi: the golden neo-gothic house with an
// octagonal turret at each corner ending in a tall pinnacle, pairs of tall pointed windows upstairs, small ones below, bands of little arches and a crested parapet.
// Photos (Wikimedia Commons): "Tonnara Florio Arenella", "Palazzina dei Quattro Pizzi 01" to "05".
// Not verified: the sheds' faces towards the sea, the far faces of the Palazzina (given the same windows), the slipway and the boats (not built).
// ====================================================================================================
const QP_C = [1156.0, -3917.25], QP_N = [-0.534, 0.845], QP_HW = 4.6, QP_HD = 5.8;   // the Palazzina's footprint (w278801120): middle, the axis of its long sides, half sizes
function paintQuattro(g, w, h) {   // one face, 9.2 m (stretched on the long sides) x 12 m
  const sx = w / 9.2, sy = h / 12, X = (m) => (m + 4.6) * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, 9.2, 12, 0.45, 0.8, '#bd9870', '#86684a', 1016, 1.2, 0.14);
  noiseDots(g, w, h, 500, 7, 1017, ['rgba(80,58,36,0.2)', 'rgba(232,200,150,0.18)', 'rgba(150,120,90,0.16)']);
  const point = (cx, ww, y0, y1, fill = '#35271c') => { const path = (ex) => { const r = ww / 2 + ex, hs = y1 - ww * 0.75; g.beginPath(); g.moveTo(X(cx - r), Y(y0 - ex)); g.lineTo(X(cx - r), Y(hs)); g.quadraticCurveTo(X(cx - r * 0.82), Y(hs + (y1 - hs) * 0.62 + ex), X(cx), Y(y1 + ex * 1.6)); g.quadraticCurveTo(X(cx + r * 0.82), Y(hs + (y1 - hs) * 0.62 + ex), X(cx + r), Y(hs)); g.lineTo(X(cx + r), Y(y0 - ex)); g.closePath(); };
    path(0.26); g.fillStyle = '#e2c290'; g.fill(); path(0.12); g.fillStyle = '#8e6a44'; g.fill(); path(0); g.fillStyle = fill; g.fill(); };
  for (const cx of [-1.45, 1.45]) { point(cx, 1.1, 1.5, 3.6); point(cx, 2.0, 5.2, 9.2); g.fillStyle = '#d8b884'; g.fillRect(X(cx) - 1.5, Y(8.0), 3, 2.8 * sy); g.fillRect(X(cx - 1.0), Y(7.6), 2.0 * sx, 2); g.strokeStyle = '#d8b884'; g.lineWidth = 2; for (const d of [-0.5, 0.5]) { g.beginPath(); g.arc(X(cx + d), Y(7.85), 0.42 * sx, PI, 0); g.stroke(); } }
  for (const [y, hh] of [[4.1, 0.6], [10.0, 0.8]]) { g.fillStyle = '#e0bf8a'; g.fillRect(0, Y(y + hh + 0.12), w, 0.14 * sy); g.fillStyle = '#7c5a3a'; for (let x = -4.4; x < 4.6; x += 0.55) { g.beginPath(); g.moveTo(X(x - 0.18), Y(y)); g.lineTo(X(x - 0.18), Y(y + hh * 0.55)); g.quadraticCurveTo(X(x), Y(y + hh * 1.15), X(x + 0.18), Y(y + hh * 0.55)); g.lineTo(X(x + 0.18), Y(y)); g.fill(); } }
  g.fillStyle = '#e0bf8a'; g.fillRect(0, Y(11.5), w, 0.2 * sy); g.fillStyle = 'rgba(60,45,30,0.3)'; g.fillRect(0, Y(1.1), w, 1.1 * sy);
  streaks(g, w, h, 40, 1018, 0.2, 80);
}
function buildTonnara() {
  initShared();
  const keys = ['tonnara', 'tonnara2'];
  const all = keys.map(k => pairsOf(FP2[k].p)), gr = groundRange([].concat(...all)), gy = gr.hi + 0.1;
  begin(gy);
  defMat('tnWall', 384, 168, [16, 7], (g, w, h) => {
    const sx = w / 16, sy = h / 7, X = (s) => s * sx, Y = (y) => h - y * sy;
    g.fillStyle = '#e4d3b0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 1100, 3, 1011, ['rgba(150,115,70,0.13)', 'rgba(255,248,230,0.16)']);
    g.fillStyle = '#c9b08a'; g.fillRect(0, Y(0.7), w, 0.7 * sy); g.fillStyle = '#f0e4c8'; g.fillRect(0, Y(7.0), w, 0.3 * sy);
    for (let i = 0; i < 4; i++) {
      const cx = 2 + i * 4;
      g.fillStyle = '#f2e8d0'; g.fillRect(X(cx - 0.75), Y(5.95), 1.5 * sx, 1.9 * sy); g.fillStyle = '#3c6048'; g.fillRect(X(cx - 0.58), Y(5.8), 1.16 * sx, 1.6 * sy); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X(cx) - 1, Y(5.8), 2, 1.6 * sy);
      if (i % 2) { g.fillStyle = '#f2e8d0'; g.beginPath(); g.arc(X(cx), Y(2.0), 1.1 * sx, PI, 0); g.lineTo(X(cx + 1.1), Y(0)); g.lineTo(X(cx - 1.1), Y(0)); g.fill(); g.fillStyle = '#4a3424'; g.beginPath(); g.arc(X(cx), Y(2.0), 0.9 * sx, PI, 0); g.lineTo(X(cx + 0.9), Y(0)); g.lineTo(X(cx - 0.9), Y(0)); g.fill(); }
      else { g.fillStyle = '#f2e8d0'; g.fillRect(X(cx - 0.7), Y(2.75), 1.4 * sx, 1.7 * sy); g.fillStyle = '#34503c'; g.fillRect(X(cx - 0.55), Y(2.6), 1.1 * sx, 1.4 * sy); }
    }
    streaks(g, w, h, 30, 1012, 0.14, 90);
  });
  for (const pts of all) {
    prism('tufa', pts, gr.lo - 1.5, gy, { c: '#a89a7c' });
    prism('tnWall', pts, gy, gy + 7, { uvo: [0, -gy / 7] });
    prism('flat', pts, gy + 7, gy + 7.15, { c: '#b49a80' });
    for (let i = 0; i < pts.length; i++) { const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz); if (l < 1.2) continue; bx('flat', frame((A[0] + B[0]) / 2, gy + 6.9, (A[1] + B[1]) / 2, -dz / l, dx / l), -l / 2, l / 2, 0, 0.55, -0.22, 0.22, { c: '#e8d8b8' }); }
  }
  // the mill tower: round and tapering to the gallery, a narrower drum above under a flat cap
  const mt = pairsOf(FP2.mulino.p), mc = centroid(mt), mg = groundY(mc[0], mc[1]), RED = '#c98c66';
  cyl('tufa', 3.7, 4.8, 10.5, 12, { p: [mc[0], mg - 1, mc[1]], c: RED });
  cyl('flat', 4.5, 4.0, 0.4, 12, { p: [mc[0], mg + 9.3, mc[1]], c: '#d8b896' });
  cyl('flat', 4.42, 4.42, 0.09, 12, { p: [mc[0], mg + 10.7, mc[1]], open: true, c: '#2c2a28', noao: true });
  for (let i = 0; i < 12; i++) box('flat', 0.08, 1.0, 0.08, { p: [mc[0] + Math.sin(i * PI / 6) * 4.38, mg + 9.7, mc[1] + Math.cos(i * PI / 6) * 4.38], c: '#2c2a28', noao: true });
  cyl('tufa', 2.9, 3.2, 4.0, 12, { p: [mc[0], mg + 9.7, mc[1]], c: RED });
  cyl('flat', 3.3, 3.0, 0.45, 12, { p: [mc[0], mg + 13.7, mc[1]], c: '#a8785c' });
  for (let q = 0; q < 4; q++) panel('flat', 0.9, 1.5, { M: mul(tr(mc[0], mg + 10.6, mc[1]), mul(rotY(q * PI / 2 + 0.4), tr(0, 0, 3.15))), c: '#3a281e' });
  // the Palazzina dei Quattro Pizzi
  const qg = Math.max(...pairsOf([1155.2, -3924.6, 1163.0, -3919.7, 1156.8, -3909.9, 1148.9, -3914.8]).map(([x, z]) => groundY(x, z))) + 0.05, Q = frame(QP_C[0], qg, QP_C[1], QP_N[0], QP_N[1]), GOLD = '#c4a07a';
  defMat('qpFace', 256, 336, [9.2, 12], paintQuattro);
  bx('tufa', Q, -QP_HW, QP_HW, -2.5, 11.6, -QP_HD, QP_HD, { c: '#bd9870' });
  for (let q = 0; q < 4; q++) {
    const fw = 2 * (q % 2 ? QP_HD : QP_HW), Mf = mul(Q, mul(rotY(q * PI / 2), tr(0, 0, (q % 2 ? QP_HW : QP_HD) + 0.02)));
    panel('qpFace', fw, 12.0, { M: Mf });
    for (let i = 0, k = Math.floor((fw - 1.8) / 0.62); i <= k; i++) { const x = -(fw - 1.8) / 2 + i * (fw - 1.8) / k; box('flat', 0.3, 0.55, 0.18, { M: Mf, p: [x, 11.95, -0.14], c: GOLD }); }
    const sh = new THREE.Shape(); sh.moveTo(-1.1, 0); sh.lineTo(1.1, 0); sh.lineTo(0, 1.35); sh.lineTo(-1.1, 0);
    extrude('flat', sh, 0.25, { M: mul(Mf, tr(0, 11.95, -0.28)), c: '#c89c6c' });
  }
  bx('flat', Q, -QP_HW - 0.12, QP_HW + 0.12, 11.75, 12.0, -QP_HD - 0.12, QP_HD + 0.12, { c: '#dcb888' });
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const T = mul(Q, tr(a * (QP_HW - 0.3), 0, b * (QP_HD - 0.3)));
    cyl('tufa', 0.82, 0.92, 13.9, 8, { M: mul(T, tr(0, -1.0, 0)), c: GOLD });
    for (const y of [0.9, 4.4, 11.0, 12.8]) cyl('flat', 1.05, 0.98, 0.26, 8, { M: mul(T, tr(0, y, 0)), c: '#dcb888' });
    cyl('tufa', 0.58, 0.64, 1.75, 8, { M: mul(T, tr(0, 13.0, 0)), c: GOLD });
    for (let q = 0; q < 4; q++) { panel('flat', 0.32, 0.9, { M: mul(T, mul(rotY(q * PI / 2), tr(0, 13.4, 0.62))), c: '#42301f' }); cone('flat', 0.3, 0.85, 4, { M: mul(T, mul(rotY(q * PI / 2), tr(0, 14.6, 0.62))), c: '#d4ae7e', noao: true }); }
    cyl('flat', 0.78, 0.66, 0.2, 8, { M: mul(T, tr(0, 14.7, 0)), c: '#dcb888' });
    cone('flat', 0.66, 2.7, 8, { M: mul(T, tr(0, 14.9, 0)), c: '#b8a088', noao: true });
    sphere('flat', 0.16, { M: mul(T, tr(0, 17.65, 0)), c: '#8a7460', seg: 5, noao: true });
  }
  return end('Tonnara Florio');
}
export const TONNARA = { name: 'Tonnara Florio', x: 1162, z: -3971, radius: 90, skipIds: [FP2.tonnara.id, FP2.tonnara2.id, FP2.mulino.id, 'w278801120'], build: buildTonnara };

// ====================================================================================================
// Convento dei Cappuccini (the catacombs): pale plastered convent round a cloister and its plain neoclassical church with a portico.
// ====================================================================================================
function buildCappuccini() {
  initShared();
  const F = front('cappuccini'), Fc = front('cappChiesa'), gr = groundRange([...F.pts, ...Fc.pts]), gy = gr.hi + 0.1, Hc = 12.0, Hh = 14.5;
  begin(gy);
  facadeMat('cpWall', 4.4, Hc, { base: '#e4d4aa', trim: '#f2e8cc', glass: '#2a2624', seed: 1031, plinth: { h: 0.8, c: '#c8b88e' }, grime: 1,
    bands: [{ y: 4.3, h: 0.25, c: '#f0e4c0' }, { y: 8.4, h: 0.25, c: '#f0e4c0' }, { y: 11.4, h: 0.5, c: '#f0e4c0' }],
    rows: [{ y0: 1.3, y1: 3.4, xs: [2.2], w: 1.0, kind: 'arch', fr: 0.14 }, { y0: 5.2, y1: 7.5, xs: [2.2], w: 1.0, kind: 'rect', shut: 'open' }, { y0: 9.2, y1: 10.8, xs: [2.2], w: 0.9, kind: 'rect', shut: 'open' }], shut: '#5a6a4a' });
  body('cpWall', 4.4, Hc, F.pts, F.holes, gy, { lo: gr.lo - 2, roof: '#b6704f', cc: '#f0e4c0', holeCornice: true });
  // church: taller nave under a low gabled roof, a pedimented portico on the road side
  facadeMat('cpChurch', 5.0, Hh, { base: '#e6d6ae', trim: '#f4ead0', glass: '#2a2624', seed: 1032, plinth: { h: 1.0, c: '#c8b88e' }, grime: 1,
    bands: [{ y: 13.6, h: 0.8, c: '#f0e4c0' }], rows: [{ y0: 6.2, y1: 10.8, xs: [2.5], w: 1.3, kind: 'arch', fr: 0.18, sill: false }] });
  body('cpChurch', 5.0, Hh, Fc.pts, [], gy, { lo: gr.lo - 2, roof: '#a89a7a', cc: '#f0e4c0' });
  const M = Fc.at(gy), PW = Math.min(Fc.across * 0.7, 12);
  for (let i = 0; i < 4; i++) cyl('marble', 0.4, 0.46, 8.2, 10, { M: mul(M, tr(-PW / 2 + 0.6 + i * (PW - 1.2) / 3, 0.4, 3.2)), c: '#efe6cc' });
  bx('flat', M, -PW / 2, PW / 2, 8.6, 9.6, 0, 3.8, { c: '#efe6cc' });
  const sh = new THREE.Shape(); sh.moveTo(-PW / 2, 0); sh.lineTo(PW / 2, 0); sh.lineTo(0, 2.0); sh.lineTo(-PW / 2, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }), { M: mul(M, tr(0, 9.6, 3.2)), c: '#efe6cc' });
  bx('dark', M, -1.3, 1.3, 0.4, 5.4, 0.02, 0.1, { c: '#3a2c22', noao: true });
  for (let i = 0; i < 4; i++) bx('stone', M, -PW / 2 + 0.4 - i * 0.2, PW / 2 - 0.4 + i * 0.2, 0, 0.5 - i * 0.12, 3.6 + i * 0.4, 4.0 + i * 0.4, { c: '#cfc7b4' });
  return end('Convento dei Cappuccini');
}
export const CAPPUCCINI = { name: 'Convento dei Cappuccini', x: -1898, z: 413, radius: 90, skipIds: [FP2.cappuccini.id, FP2.cappChiesa.id], build: buildCappuccini };
