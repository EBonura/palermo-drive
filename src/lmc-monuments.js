// Monuments that had no model of their own (a small generic obelisk, or nothing, stood in their place): two equestrian statues, the war memorial with its colonnades, the column of the Immacolata,
// the obelisk of Piazza Indipendenza, the two stelae of Capaci on the A29 and the Fontana d'Ercole. Same toolkit as the other city landmarks (src/lmc-kit.js).
// One small kit of horse, rider and figures serves all of them: low polygon solids, read as silhouettes from the road. Registered in src/landmarks-city.js; src/props.js leaves their OSM nodes alone.
//
// Photos (Wikimedia Commons unless said; only shapes, colours and proportions were read from them), positions and sizes checked on the OSM geometry and, in the city, the Regione Siciliana orthophoto:
//   Vittorio Emanuele II (Benedetto Civiletti, OSM n9714511529): "Palermo Monumento Vittorio Emanuele II.jpg", "Monumento equestre Vittorio Emanuele II.jpg", "VE II Palermo.jpg" (from behind, the inscribed face),
//     "Delisi Monumento VEII.jpg" (the relief), "Piazza Giulio Cesare (Palermo) 14 07 2024 02.jpg" (taken from the station side: the horse looks north, to Via Roma); Mapillary 5446206962119793.
//   Caduti e Libertà (n2595735306, w253675735, colonnades w253675733 and w253675736): "Monumento caduti palermo.jpg", "Monumento ai Caduti, Palermo.1.JPG" and ".2.JPG".
//   Garibaldi (Vincenzo Ragusa, reliefs and lion by Mario Rutelli, n5334144679): "Monumento equestre Garibaldi.jpg", "Monumento a G.Garibaldi.jpg", "Monumento a Garibaldi visto dal basso.jpg",
//     "Monumento a Garibaldi particolare.jpg", "Leone bronzeo di Mario Rutelli.jpg"; Mapillary 222462339638122 and 2860060104118865 (the horse faces Via Libertà).
//   Immacolata (n9603045596): "Palermo-Colonna-Immacolata-bjs2007-01.jpg", "Colonna dell'Immacolata - Piazza San Domenico - Palermo - Italy 2015.JPG", "Colonna Immacolata.jpg" (from above),
//     "Palermo - Colonna dell'Immacolata 0477.jpg", "Statue of Pius IX - ... 2015.JPG"; Mapillary 140206201859435. The iron railing round it is the OSM fence the game already draws.
//   Obelisco ai martiri dell'indipendenza (w354088624): the photo in blogsicilia.it, "monumento piazza indipendenza" (steps, railing, pedestal), "Palermo-Sicily-Italy - Creative Commons by gnuckx
//     (3491930457), (3491935791), (3492752356).jpg" (the whole shaft and its point); its height from its shadow in the orthophoto.
//   Capaci (n410606723 and its twin n410606725 across the motorway): "Capaci (Palermo) Monumento a Falcone, alla moglie e alla scorta - panoramio.jpg"; Mapillary 1108907850315830, 451709110592783,
//     982842680085589, 332473358985023, 183258603644669. Each stele faces the traffic of its own carriageway, as reported for the 2004 monument.
//   Fontana d'Ercole (w552486011): "2012-11-03 Fontana d Ercole - Parco della Favorita - Palermo (Italy).jpg".
// Not verified, and left plain or simplified: the backs of the Caduti memorial and of the Garibaldi pedestal; every relief, inscription and carved garland (painted as shapes without readable text, except the
// date and names on the Capaci stelae); the faces and drapery of all statues; which way the popes and angels of the Immacolata face; the heights, estimated from photos.
// The mural of Falcone and Borsellino at the Cala (n8543862917) is not painted: a hand drawn copy of two real faces would not be a fit likeness. Its wall stays as it is.
import * as THREE from 'three';
import { TREE_CLEAR } from './tree-clear.js';
import { PI, bx, box, cyl, lathe, panel, extrude, begin, end, defMat, part, mul, tr, rotY, frame, groundY, initShared, rail, noiseDots, streaks, paintAshlar, RNG } from './lmc-kit.js';

// ---------------------------------------------------------------------------------------------------
// materials: one near white grain that every stone and bronze part tints (so a monument is one or two draws), an ashlar for large walls, and one sheet of painted details
// ---------------------------------------------------------------------------------------------------
const AT = 512;
const RG = {   // regions of the detail sheet [x, y, w, h]
  veRelief: [0, 0, 256, 128], veText: [256, 0, 128, 128], plaque: [384, 0, 128, 128],
  frieze: [0, 128, 512, 128],
  names: [0, 256, 256, 256], emblem: [256, 256, 128, 128], cadText: [384, 256, 128, 128],
  shields: [256, 384, 128, 64], garland: [256, 448, 128, 64], medal: [384, 384, 128, 128],
};
const RUST = '#8c4638';

// a standing figure painted as a few shapes (reliefs)
function relFig(g, x, y0, h, c) {
  g.fillStyle = c; g.beginPath(); g.ellipse(x, y0 - h * 0.42, h * 0.13, h * 0.38, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, y0 - h * 0.86, h * 0.095, 0, 7); g.fill();
  g.fillRect(x - h * 0.09, y0 - h * 0.2, h * 0.06, h * 0.2); g.fillRect(x + h * 0.03, y0 - h * 0.2, h * 0.06, h * 0.2);
}
function textLines(g, x, y, w, n, dy, seed, c) { const r = RNG(seed); g.fillStyle = c; for (let i = 0; i < n; i++) { const lw = w * (0.55 + r() * 0.45); let u = x + (w - lw) / 2; while (u < x + (w + lw) / 2 - 3) { const k = 3 + r() * 9; g.fillRect(u, y + i * dy, Math.min(k, x + (w + lw) / 2 - u), dy * 0.38); u += k + 2.5; } } }
function swag(g, x, y, w, h, c, d) {
  const n = 3; for (let i = 0; i < n; i++) { const x0 = x + i * w / n, x1 = x0 + w / n; for (let k = 0; k <= 12; k++) { const t = k / 12, u = x0 + (x1 - x0) * t, v = y + h * 0.25 + Math.sin(t * PI) * h * 0.42; g.fillStyle = k % 2 ? c : d; g.beginPath(); g.arc(u, v, h * (0.1 + 0.09 * Math.sin(t * PI)), 0, 7); g.fill(); } }
}
function paintDetails(g) {
  const R = (k, f) => { const [x, y, w, h] = RG[k]; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); f(w, h); g.restore(); };
  g.fillStyle = RUST; g.fillRect(0, 0, AT, AT);
  R('veRelief', (w, h) => {
    g.fillStyle = '#d9d7cf'; g.fillRect(0, 0, w, h); const r = RNG(1201);
    for (let i = 0; i < 40; i++) relFig(g, 14 + r() * (w - 28), 78 + r() * 8, 30 + r() * 14, '#c2c0b8');
    for (let i = 0; i < 26; i++) { const x = 10 + i * 9.4 + r() * 4; relFig(g, x + 2, h - 14, 46 + r() * 16, 'rgba(90,88,80,0.35)'); relFig(g, x, h - 16, 46 + r() * 16, '#e8e6de'); }
    g.strokeStyle = '#9b988e'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  R('veText', (w, h) => { g.fillStyle = '#dedcd4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a6a39a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); textLines(g, 18, 24, w - 36, 9, 10, 1202, '#6d6a62'); });
  R('plaque', (w, h) => { g.fillStyle = '#e4e2da'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b4b0a4'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); textLines(g, 14, 30, w - 28, 5, 17, 1203, '#77736a'); });
  R('frieze', (w, h) => {
    g.fillStyle = '#26312d'; g.fillRect(0, 0, w, h); const r = RNG(1204);
    for (let i = 0; i < 60; i++) relFig(g, r() * w, h * 0.62 + r() * 12, 40 + r() * 26, '#3a4a43');
    for (let i = 0; i < 6; i++) { const x = 40 + r() * (w - 80), y = 36 + r() * 20; g.fillStyle = '#51665b'; g.beginPath(); g.ellipse(x, y + 20, 24, 14, -0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 22, y + 2, 7, 16, 0.6, 0, 7); g.fill(); }
    for (let i = 0; i < 46; i++) { const x = i * 11.3 + r() * 6, hh = 56 + r() * 40, y = h - 4 - r() * 10; relFig(g, x + 3, y, hh, '#17201d'); relFig(g, x, y - 2, hh, r() < 0.5 ? '#647a6d' : '#566a60'); }
  });
  R('names', (w, h) => {
    g.fillStyle = RUST; g.fillRect(0, 0, w, h); g.fillStyle = '#f2eee6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['23 MAGGIO 1992', 'GIOVANNI FALCONE', 'FRANCESCA MORVILLO', 'ROCCO DICILLO', 'ANTONIO MONTINARO', 'VITO SCHIFANI'].forEach((t, i) => {
      g.font = '500 23px Georgia, "Times New Roman", serif'; const k = Math.min(1, (w - 12) / g.measureText(t).width); g.save(); g.translate(w / 2, 26 + i * 41); g.scale(k, 1.12); g.fillText(t, 0, 0); g.restore();
    });
  });
  R('emblem', (w, h) => {   // the emblem of the Republic: a star on a toothed wheel between two branches, a ribbon below
    g.fillStyle = RUST; g.fillRect(0, 0, w, h); const cx = w / 2, cy = h * 0.46; g.strokeStyle = g.fillStyle = '#eceae4';
    g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 27, 0, 7); g.stroke(); for (let i = 0; i < 20; i++) { const a = i * PI / 10; g.fillRect(cx + Math.cos(a) * 31 - 3, cy + Math.sin(a) * 31 - 3, 6, 6); }
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? 11 : 28; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
    for (const sg of [-1, 1]) for (let i = 0; i < 11; i++) { const a = PI / 2 + sg * (0.35 + i * 0.22); g.beginPath(); g.ellipse(cx + Math.cos(a) * 45, cy + Math.sin(a) * 47, 9, 4, a + sg * 0.9, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(14, h - 26); g.quadraticCurveTo(cx, h - 2, w - 14, h - 26); g.lineTo(w - 22, h - 12); g.quadraticCurveTo(cx, h + 10, 22, h - 12); g.closePath(); g.fill();
  });
  R('cadText', (w, h) => { g.fillStyle = '#d5c19b'; g.fillRect(0, 0, w, h); textLines(g, 8, 10, w - 16, 12, 9.4, 1205, '#5d4e36'); });
  R('shields', (w, h) => { g.fillStyle = '#d8d6ce'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { const x = 5 + i * 31; g.fillStyle = '#b3b0a6'; g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 25, 12); g.lineTo(x + 25, 34); g.quadraticCurveTo(x + 22, 50, x + 12, 56); g.quadraticCurveTo(x + 3, 50, x, 34); g.fill(); g.fillStyle = '#e2e0d9'; g.fillRect(x + 5, 18, 15, 24); textLines(g, x + 5, 25, 15, 2, 7, 1210 + i, '#77736a'); } });
  R('garland', (w, h) => { g.fillStyle = '#d8d3c4'; g.fillRect(0, 0, w, h); swag(g, 0, 4, w, h - 8, '#bdb6a2', '#efeadc'); });
  R('medal', (w, h) => {   // a carved wreath with two hanging ribbons
    g.fillStyle = '#d9c7a2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { const a = i * PI / 15; for (const [dr, c] of [[3, '#a28c64'], [-2, '#eee0bd']]) { g.fillStyle = c; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * (32 + dr), h * 0.42 + Math.sin(a) * (30 + dr), 9, 5, a + 1.15, 0, 7); g.fill(); } }
    g.strokeStyle = '#a9936b'; g.lineWidth = 6; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, h * 0.68); g.quadraticCurveTo(w / 2 + sg * 38, h * 0.72, w / 2 + sg * 26, h * 0.97); g.stroke(); }
  });
}

export function setup() {
  initShared();
  defMat('mnStone', 128, 128, [2.6, 2.6], (g, w, h) => { g.fillStyle = '#f4f3f0'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 520, 2.4, 1101, ['rgba(80,70,55,0.10)', 'rgba(255,255,255,0.55)', 'rgba(110,100,80,0.08)']); streaks(g, w, h, 9, 1102, 0.07, 55, '70,58,42'); });
  defMat('mnAsh', 128, 128, [3.0, 3.0], (g, w, h) => { paintAshlar(g, w, h, 3.0, 3.0, 0.5, 1.25, '#f0eee9', '#b4afa3', 1103, 1.2, 0.06); streaks(g, w, h, 12, 1104, 0.12, 60, '66,54,38'); });
  defMat('mnDec', AT, AT, [1, 1], (g) => paintDetails(g), { roughness: 0.85 });
}
// a painted detail: region k, w x h metres, base centre at (x, y, z) of the frame M, facing +z turned by ry
function dec(k, M, w, h, x, y, z, ry = 0, o = {}) {
  const [rx, ry0, rw, rh] = RG[k];
  panel('mnDec', w, h, { M, p: [x, y, z], ry, uvk: [(rw - 1) / AT, (rh - 1) / AT], uvo: [(rx + 0.5) / AT, 1 - (ry0 + rh - 0.5) / AT], ...o });
}

// ---------------------------------------------------------------------------------------------------
// solids
// ---------------------------------------------------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
// a tapered round limb from a to b (radius ra at a, rb at b)
export function limb(M, a, b, ra, rb, c, seg = 5, key = 'mnStone') {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _v.length(); if (len < 1e-4) return;
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, 1, false); g.translate(0, len / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(UP, _v.multiplyScalar(1 / len))); g.translate(a[0], a[1], a[2]);
  part(key, g, { M, c, noao: true });
}
// an ellipsoid of few faces (det 0: 20 triangles, det 1: 80)
export function blob(M, p, r, c, det = 0, rx = 0, rz = 0, key = 'mnStone') {
  const g = new THREE.IcosahedronGeometry(1, det); g.scale(r[0], r[1], r[2]); g.rotateZ(rz); g.rotateX(rx); g.computeVertexNormals(); part(key, g, { M, p, c, noao: true });
}
// a square (or oblong) tapered block: half sizes a0 x b0 at y0, a1 x b1 at y1, centred on (x, z)
export function taper(M, x, z, y0, y1, a0, b0, a1, b1, c, key = 'mnStone') {
  const g = new THREE.CylinderGeometry(Math.SQRT2, Math.SQRT2, 1, 4, 1); g.rotateY(PI / 4);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, x + p.getX(i) * (top ? a1 : a0), top ? y1 : y0, z + p.getZ(i) * (top ? b1 : b0)); }
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); part(key, ng, { M, c, noao: true });
}
const ball = (M, p, r, c) => blob(M, p, [r, r, r], c, 0);

// ---------------------------------------------------------------------------------------------------
// the horse, the rider, the figures
// ---------------------------------------------------------------------------------------------------
// A horse facing +z, standing on y = 0 of M under the middle of its body; about 1.7 high at the withers and 3 long. walk: the left foreleg raised and the others in stride.
function horse(M, c, dk, walk) {
  blob(M, [0, 1.38, -0.05], [0.4, 0.43, 0.92], c, 1);
  blob(M, [0, 1.43, 0.55], [0.39, 0.47, 0.44], c, 1);
  blob(M, [0, 1.47, -0.66], [0.43, 0.46, 0.47], c, 1);
  limb(M, [0, 1.5, 0.66], [0, 2.14, 1.08], 0.33, 0.19, c, 7);                       // neck, arched, the head carried low and near upright
  limb(M, [0, 2.14, 1.08], [0, 2.28, 1.24], 0.19, 0.16, c, 7);
  limb(M, [0, 2.31, 1.19], [0, 1.82, 1.55], 0.19, 0.085, c, 6);
  blob(M, [0, 2.13, 1.29], [0.16, 0.2, 0.2], c);
  for (const s of [-1, 1]) limb(M, [s * 0.11, 2.34, 1.13], [s * 0.14, 2.58, 1.1], 0.065, 0.005, c, 4);
  limb(M, [0, 1.84, 0.64], [0, 2.38, 1.07], 0.1, 0.09, dk, 4); limb(M, [0, 2.38, 1.07], [0, 2.34, 1.34], 0.08, 0.03, dk, 4);   // mane and forelock
  limb(M, [0, 1.65, -1.03], [0, 1.58, -1.38], 0.1, 0.19, dk, 6); limb(M, [0, 1.58, -1.38], [0, 1.08, -1.6], 0.19, 0.14, dk, 6); limb(M, [0, 1.08, -1.6], [0, 0.62, -1.62], 0.14, 0.02, dk, 6);
  const leg = (pts, radii) => { for (let i = 0; i < pts.length - 1; i++) limb(M, pts[i], pts[i + 1], radii[i], radii[i + 1], c, 5); const f = pts[pts.length - 1], p = pts[pts.length - 2], d = [p[0] - f[0], p[1] - f[1], p[2] - f[2]], l = Math.hypot(...d); limb(M, f, [f[0] + d[0] / l * 0.14, f[1] + d[1] / l * 0.14, f[2] + d[2] / l * 0.14], 0.11, 0.085, dk, 6); ball(M, pts[1], radii[1] * 1.15, c); };
  const fore = [0.17, 0.095, 0.065], hind = [0.23, 0.11, 0.07];
  if (walk) {
    leg([[0.22, 1.28, 0.66], [0.24, 1.03, 1.24], [0.24, 0.47, 1.1]], fore);
    leg([[-0.22, 1.28, 0.62], [-0.23, 0.65, 0.66], [-0.23, 0.02, 0.62]], fore);
    leg([[0.26, 1.36, -0.62], [0.26, 0.72, -0.72], [0.26, 0.02, -0.5]], hind);
    leg([[-0.26, 1.36, -0.66], [-0.26, 0.72, -1.02], [-0.26, 0.02, -1.14]], hind);
  } else {
    leg([[0.22, 1.28, 0.62], [0.23, 0.65, 0.68], [0.23, 0.02, 0.7]], fore);
    leg([[-0.22, 1.28, 0.58], [-0.23, 0.65, 0.58], [-0.23, 0.02, 0.5]], fore);
    leg([[0.26, 1.36, -0.64], [0.26, 0.72, -0.92], [0.26, 0.02, -0.78]], hind);
    leg([[-0.26, 1.36, -0.66], [-0.26, 0.72, -0.98], [-0.26, 0.02, -0.96]], hind);
  }
  blob(M, [0, 1.77, -0.04], [0.45, 0.1, 0.46], dk);                                 // saddle cloth
  limb(M, [0, 1.92, 1.48], [0.02, 2.16, 0.4], 0.018, 0.018, dk, 3);                 // reins
}
// A rider seated on horse(). hat 'bicorne' (plumed, sabre at the side) or 'cap' (with a beard); arm 'rein' (right hand at the side) or 'point' (right arm raised, pointing ahead)
function rider(M, c, dk, hat, arm) {
  limb(M, [0, 1.82, -0.06], [0, 2.46, -0.04], 0.22, 0.28, c, 7);
  blob(M, [0, 2.46, -0.04], [0.36, 0.19, 0.22], c);
  limb(M, [0, 2.52, -0.02], [0, 2.68, 0], 0.09, 0.09, c, 5);
  blob(M, [0, 2.79, 0.02], [0.15, 0.17, 0.16], c, 1);
  limb(M, [0, 2.0, -0.16], [0, 1.68, -0.58], 0.24, 0.3, c, 6);                      // coat tail over the horse's back
  for (const s of [-1, 1]) {
    limb(M, [s * 0.2, 1.88, -0.02], [s * 0.48, 1.62, 0.4], 0.16, 0.12, c, 5);
    limb(M, [s * 0.48, 1.62, 0.4], [s * 0.5, 1.0, 0.28], 0.12, 0.08, dk, 5);
    limb(M, [s * 0.5, 1.0, 0.24], [s * 0.5, 0.93, 0.46], 0.08, 0.06, dk, 4);
  }
  const a = (pts) => { limb(M, pts[0], pts[1], 0.11, 0.085, c, 5); limb(M, pts[1], pts[2], 0.085, 0.055, c, 5); ball(M, pts[2], 0.065, c); };
  a([[0.31, 2.46, -0.03], [0.4, 2.08, 0.1], [0.12, 2.13, 0.42]]);
  if (arm === 'point') a([[-0.31, 2.47, -0.03], [-0.6, 2.84, 0.16], [-0.74, 3.36, 0.46]]);
  else a([[-0.31, 2.46, -0.03], [-0.45, 2.06, -0.02], [-0.44, 1.82, 0.26]]);
  if (hat === 'bicorne') {
    blob(M, [0, 2.96, 0.0], [0.32, 0.12, 0.14], dk); blob(M, [0, 3.02, 0.0], [0.16, 0.12, 0.15], dk); limb(M, [0, 3.04, 0.04], [0, 3.16, -0.14], 0.07, 0.015, dk, 4);
    limb(M, [0.34, 1.92, -0.05], [0.58, 0.9, -0.62], 0.035, 0.02, dk, 4);
  } else {
    limb(M, [0, 2.89, 0.01], [0, 3.03, -0.01], 0.17, 0.14, dk, 7); blob(M, [0, 2.7, 0.14], [0.11, 0.13, 0.08], dk);
    blob(M, [0, 2.38, -0.08], [0.42, 0.14, 0.3], dk);                               // the poncho thrown back on the shoulders
  }
}
// A standing figure h tall on y = 0 of M, facing +z. robe: a long gown, else two bare legs; arms: [right, left] each [elbow, hand] in units of h (right is -x)
export function figure(M, h, c, o = {}) {
  const P = (a) => [a[0] * h, a[1] * h, a[2] * h];
  if (o.robe !== false) lathe('mnStone', [[0.001, 0], [0.19, 0], [0.165, 0.16], [0.12, 0.45], [0.1, 0.6], [0.13, 0.7], [0.001, 0.74]].map(P), 8, { M, c, noao: true });
  else {
    limb(M, P([-0.075, 0, 0]), P([-0.065, 0.47, 0]), 0.035 * h, 0.065 * h, c, 5); limb(M, P([0.11, 0, 0.07]), P([0.07, 0.47, 0.01]), 0.035 * h, 0.065 * h, c, 5);
    limb(M, P([0, 0.45, 0]), P([0.015, 0.74, 0]), 0.095 * h, 0.125 * h, c, 7);
  }
  blob(M, P([0.01, 0.74, 0]), [0.17 * h, 0.07 * h, 0.1 * h], c);
  blob(M, P([0.01, 0.875, 0.01]), [0.068 * h, 0.08 * h, 0.072 * h], c, 1);
  limb(M, P([0.01, 0.76, 0]), P([0.01, 0.84, 0]), 0.035 * h, 0.035 * h, c, 5);
  const arms = o.arms || [[[-0.2, 0.55, 0.02], [-0.14, 0.43, 0.1]], [[0.2, 0.55, 0.02], [0.1, 0.55, 0.14]]];
  arms.forEach(([e, w], i) => { const s = i ? [0.15, 0.74, 0] : [-0.13, 0.74, 0]; limb(M, P(s), P(e), 0.048 * h, 0.036 * h, c, 5); limb(M, P(e), P(w), 0.036 * h, 0.024 * h, c, 5); });
}
// a pair of wings behind a figure of height h
function wings(M, h, c, spread = 1) {
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); [[0.04, 0.68], [0.2, 0.9], [0.46, 0.98], [0.4, 0.78], [0.3, 0.64], [0.2, 0.46], [0.08, 0.5]].forEach(([x, y], i) => { const X = s * x * h * spread; if (i) sh.lineTo(X, y * h); else sh.moveTo(X, y * h); });
    extrude('mnStone', sh, 0.035 * h, { M, p: [0, 0, -0.13 * h], c, noao: true });
  }
}
// a lion lying with its head up, facing +z, about 2.8 long
function lion(M, c, dk) {
  blob(M, [0, 0.48, -0.35], [0.44, 0.42, 0.86], c, 1);
  for (const s of [-1, 1]) {
    blob(M, [s * 0.36, 0.36, -0.82], [0.26, 0.36, 0.42], c, 1); limb(M, [s * 0.44, 0.14, -0.74], [s * 0.5, 0.1, -0.1], 0.13, 0.1, c);
    limb(M, [s * 0.27, 0.5, 0.3], [s * 0.3, 0.14, 0.52], 0.2, 0.12, c); limb(M, [s * 0.3, 0.14, 0.52], [s * 0.3, 0.1, 1.24], 0.12, 0.1, c); blob(M, [s * 0.3, 0.1, 1.28], [0.14, 0.1, 0.16], c);
  }
  blob(M, [0, 0.82, 0.32], [0.47, 0.56, 0.42], dk, 1);                               // mane
  blob(M, [0, 1.18, 0.55], [0.36, 0.37, 0.3], dk, 1);
  blob(M, [0, 1.2, 0.78], [0.22, 0.23, 0.2], c, 1); blob(M, [0, 1.12, 0.97], [0.13, 0.11, 0.13], c);
  limb(M, [0.2, 0.18, -1.18], [0.62, 0.1, -0.75], 0.075, 0.05, c); limb(M, [0.62, 0.1, -0.75], [0.74, 0.09, -0.28], 0.05, 0.09, dk);
}
// an eagle with its wings half open, facing +z, about 1.3 high
export function eagle(M, c) {
  blob(M, [0, 0.55, 0], [0.24, 0.42, 0.27], c); blob(M, [0, 1.02, 0.14], [0.13, 0.15, 0.15], c); limb(M, [0, 1.02, 0.24], [0, 0.94, 0.4], 0.07, 0.01, c, 4);
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); [[0.1, 0.3], [0.32, 0.55], [0.62, 1.28], [0.38, 1.12], [0.12, 0.84]].forEach(([x, y], i) => { if (i) sh.lineTo(s * x, y); else sh.moveTo(s * x, y); }); extrude('mnStone', sh, 0.12, { M, p: [0, 0, -0.14], c, noao: true }); limb(M, [s * 0.12, 0.28, 0.08], [s * 0.15, 0, 0.14], 0.07, 0.05, c, 4); }
}

// ---------------------------------------------------------------------------------------------------
// placement: a site is its centre O and the front normal N (local +z; local +x is (nz, -nx))
// ---------------------------------------------------------------------------------------------------
const r1 = (v) => Math.round(v * 10) / 10;
export const unit = (x, z) => { const l = Math.hypot(x, z); return [x / l, z / l]; };
export const wpt = (S, x, z) => [r1(S.O[0] + x * S.N[1] + z * S.N[0]), r1(S.O[1] - x * S.N[0] + z * S.N[1])];
const lineSegs = (pts, closed = true) => { const o = []; for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; o.push([a[0], a[1], b[0], b[1]]); } return o; };
export const siteSegs = (S, loc) => lineSegs(loc.map(([x, z]) => wpt(S, x, z)));
export const siteRect = (S, x0, x1, z0, z1) => siteSegs(S, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
const siteRing = (S, r, n, a0 = PI / n) => siteSegs(S, Array.from({ length: n }, (_, i) => [Math.cos(a0 + i * 2 * PI / n) * r, Math.sin(a0 + i * 2 * PI / n) * r]));
// begins a model: returns the frame on the highest ground under the radius r, and how far below it the lowest ground is (for the foundations)
export function open(S, r) {
  setup(); let lo = 1e9, hi = -1e9;
  for (const [x, z] of [[0, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) { const p = wpt(S, x, z), y = groundY(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  begin(hi);
  return { M: frame(S.O[0], hi, S.O[1], S.N[0], S.N[1]), drop: hi - lo + 0.5 };
}
export const at = (M, x, y, z, a = 0, s = 1) => mul(M, mul(tr(x, y, z), mul(rotY(a), new THREE.Matrix4().makeScale(s, s, s))));
export const SQ = (M, key, a, y0, y1, c, x = 0, z = 0, b = a) => bx(key, M, x - a, x + a, y0, y1, z - b, z + b, { c, noao: true });

// ====================================================================================================
// 1. Vittorio Emanuele II, Piazza Giulio Cesare: a white marble pedestal in two stages (eagles at the corners of the lower one, a relief on each long side, the inscription towards the station),
//    and on it the king in a plumed bicorne on a standing horse, dark bronze, facing north to Via Roma.
// ====================================================================================================
const VE = { O: [470.0, 584.8], N: unit(-0.52, -0.854) };
function buildVittorio() {
  const { M, drop } = open(VE, 3.2), W = '#dfddd5', W2 = '#cfccc2', B = '#39403b', BD = '#272c29', S = 'mnStone';
  bx(S, M, -2.2, 2.2, -drop, 0.25, -3.1, 3.1, { c: '#a9a59b' }); bx(S, M, -1.98, 1.98, 0.25, 0.5, -2.88, 2.88, { c: '#b6b2a8' });
  SQ(M, S, 1.84, 0.5, 0.82, W2, 0, 0, 2.7); SQ(M, S, 1.68, 0.82, 2.18, W, 0, 0, 2.52); SQ(M, S, 1.88, 2.18, 2.42, W2, 0, 0, 2.72);
  for (const s of [-1, 1]) {
    dec('shields', M, 3.9, 0.95, s * 1.7, 1.02, 0, s * PI / 2);
    dec('garland', M, 3.3, 0.55, s * 1.78, 2.4, 0, s * PI / 2); dec('shields', M, 2.4, 0.95, 0, 1.02, s * 2.54, s < 0 ? PI : 0);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) eagle(at(M, sx * 1.45, 2.42, sz * 2.3, Math.atan2(sx * 0.7, sz), 0.95), W);
  SQ(M, S, 1.42, 2.42, 2.78, W2, 0, 0, 2.02); SQ(M, S, 1.24, 2.78, 5.2, W, 0, 0, 1.82); SQ(M, S, 1.38, 5.2, 5.35, W2, 0, 0, 1.96); SQ(M, S, 1.56, 5.35, 5.62, W, 0, 0, 2.14);
  SQ(M, S, 1.05, 5.62, 5.82, W2, 0, 0, 1.75);
  for (const s of [-1, 1]) dec('veRelief', M, 3.0, 1.6, s * 1.26, 3.25, 0, s * PI / 2);
  dec('veText', M, 1.9, 1.75, 0, 3.15, -1.84, PI);
  box(S, 1.1, 0.12, 3.1, { M, p: [0, 5.8, 0], c: BD });
  const H = at(M, 0, 5.9, 0.05, 0, 1.18); horse(H, B, BD, false); rider(H, B, BD, 'bicorne', 'rein');
  return end('Monumento a Vittorio Emanuele II');
}

// ====================================================================================================
// 2. Monumento ai Caduti e alla Libertà (the "Statua"), Piazza Vittorio Veneto: a screen wall between two pylons with a long bronze relief, the group of Liberty on a round pedestal at the head
//    of a flight of steps, the obelisk behind with the winged Victory, and the two curved colonnades round the back of the circus (the OSM walls w253675733 and w253675736).
// ====================================================================================================
const CAD = { O: [-1680.0, -3301.75], N: unit(0.485, 0.874) };   // O: the middle of the front face of the wall
const COLONNADES = [
  [[-1653.8, -3314.2], [-1657.7, -3320.2], [-1661.6, -3324.5], [-1666.5, -3327.8], [-1671.9, -3330.0], [-1677.7, -3331.0], [-1683.5, -3330.7], [-1688.2, -3329.5]],
  [[-1694.5, -3326.2], [-1699.4, -3322.4], [-1703.0, -3317.9], [-1705.7, -3312.7], [-1707.1, -3307.2], [-1707.3, -3301.4], [-1706.2, -3295.7], [-1703.6, -3289.5]],
];
function colonnade(line) {
  const ST = '#d6c6a6', COL = '#e6e0d2', S = 'mnStone';
  const L = [0]; for (let i = 1; i < line.length; i++) L.push(L[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const at_ = (s) => { let i = 0; while (i < line.length - 2 && L[i + 1] < s) i++; const u = (s - L[i]) / (L[i + 1] - L[i]); return [line[i][0] + (line[i + 1][0] - line[i][0]) * u, line[i][1] + (line[i + 1][1] - line[i][1]) * u]; };
  let top = -1e9; for (const p of line) top = Math.max(top, groundY(p[0], p[1]));
  const I = new THREE.Matrix4();
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], l = L[i + 1] - L[i], F = frame((a[0] + b[0]) / 2, top, (a[1] + b[1]) / 2, -(b[1] - a[1]) / l, (b[0] - a[0]) / l);
    bx(S, F, -l / 2 - 0.12, l / 2 + 0.12, Math.min(groundY(a[0], a[1]), groundY(b[0], b[1])) - top - 0.3, 0.95, -0.5, 0.5, { c: '#c4b99f', noao: true });
    bx(S, F, -l / 2 - 0.1, l / 2 + 0.1, 4.95, 5.55, -0.42, 0.42, { c: ST, noao: true }); bx(S, F, -l / 2 - 0.15, l / 2 + 0.15, 5.55, 5.8, -0.55, 0.55, { c: '#c9b996', noao: true });
  }
  const total = L[L.length - 1], n = Math.round((total - 1.6) / 2.6);
  for (let k = 0; k <= n; k++) {
    const p = at_(0.8 + (total - 1.6) * k / n), m = mul(I, tr(p[0], top, p[1]));
    if (k === 0 || k === n) {   // the square piers that close each wing
      SQ(m, S, 0.62, 0.95, 6.3, ST); SQ(m, S, 0.76, 6.3, 6.55, '#c9b996'); SQ(m, S, 0.45, 6.55, 7.0, ST); continue;
    }
    cyl(S, 0.25, 0.31, 3.7, 8, { M: m, p: [0, 1.05, 0], c: COL, open: true, noao: true });
    SQ(m, S, 0.4, 0.95, 1.1, ST); SQ(m, S, 0.38, 4.72, 4.95, ST);
    if (k % 2 === 0) SQ(m, S, 0.24, 5.8, 6.3, ST);
  }
}
function buildCaduti() {
  const { M, drop } = open(CAD, 6), ST = '#d3bf98', ST2 = '#bfac87', PALE = '#e2dac6', B = '#33463e', S = 'mnStone';
  // the low platform and the steps up to the group
  bx(S, M, -11.8, 11.8, -drop, 0.18, -2.8, 7.6, { c: '#cfc8b8', noao: true }); bx(S, M, -9.6, 9.6, 0.18, 0.36, -2.8, 6.4, { c: '#d6cfbe', noao: true });
  for (let i = 0; i < 9; i++) bx(S, M, -4.7 + i * 0.3, 4.7 - i * 0.3, 0.36 + i * 0.3, 0.66 + i * 0.3, 0, 5.0 - i * 0.42, { c: i % 2 ? '#d9d2c0' : '#cdc5b2', noao: true });
  // wall: plinth, body, frieze, cornice
  bx(S, M, -7.9, 7.9, -drop, 1.5, -2.55, 0.45, { c: ST2 }); bx('mnAsh', M, -7.3, 7.3, 1.5, 7.8, -2.0, 0, { c: ST });
  bx(S, M, -7.4, 7.4, 3.85, 4.25, -2.1, 0.28, { c: PALE }); bx(S, M, -7.45, 7.45, 7.8, 8.2, -2.25, 0.25, { c: ST2 });
  for (const s of [-1, 1]) {
    dec('frieze', M, 4.6, 2.55, s * 3.15, 4.3, 0.06, 0, { uvk: [255 / AT, 127 / AT], uvo: [(s < 0 ? 0.5 : 256.5) / AT, 1 - 255.5 / AT] });
    dec('garland', M, 4.5, 0.75, s * 3.15, 6.98, 0.05, 0, { c: '#efd9ae' });
    for (let k = 0; k < 5; k++) { const x = s * (1.4 + k * 0.85); figure(at(M, x, 4.3, 0.12, -s * 0.25, 1), 1.5 + (k % 2) * 0.35, B, { arms: k % 2 ? [[[-0.22, 0.8, 0.05], [-0.18, 1.0, 0.1]], [[0.2, 0.55, 0.05], [0.14, 0.45, 0.1]]] : undefined }); }
    // pylons
    SQ(M, S, 1.22, -drop, 1.9, ST2, s * 6.45, -1.0, 1.55); SQ(M, 'mnAsh', 1.0, 1.9, 8.7, ST, s * 6.45, -1.0, 1.3); SQ(M, S, 1.18, 8.7, 9.0, ST2, s * 6.45, -1.0, 1.48); SQ(M, S, 0.9, 9.0, 9.35, ST, s * 6.45, -1.0, 1.15);
    dec('medal', M, 1.5, 1.5, s * 6.45, 6.75, 0.32);
  }
  // the central field, the round pedestal and Liberty with the second figure
  SQ(M, S, 0.95, 4.25, 7.75, PALE, 0, 0.05, 0.12);
  cyl(S, 1.25, 1.4, 0.5, 14, { M, p: [0, 3.0, 0.95], c: PALE, noao: true }); cyl(S, 0.95, 1.15, 0.95, 14, { M, p: [0, 3.5, 0.95], c: '#ece6d6', noao: true });
  figure(at(M, -0.3, 4.45, 0.9), 3.35, '#2d3a34', { arms: [[[-0.24, 0.86, 0.03], [-0.22, 1.02, 0.06]], [[0.2, 0.56, 0.08], [0.2, 0.46, 0.14]]] });
  figure(at(M, 0.55, 4.45, 1.0, -0.2), 2.8, '#35463d', { arms: [[[-0.18, 0.56, 0.08], [-0.1, 0.62, 0.16]], [[0.32, 0.7, 0.03], [0.46, 0.76, 0.06]]] });
  // the obelisk behind the wall
  const Z = -3.0;
  SQ(M, 'mnAsh', 2.0, -drop, 8.2, ST, 0, Z, 1.6); SQ(M, S, 1.9, 8.2, 8.55, ST2, 0, Z, 1.9); SQ(M, S, 1.6, 8.55, 9.75, ST, 0, Z, 1.6); SQ(M, S, 1.75, 9.75, 10.0, ST2, 0, Z, 1.75);
  taper(M, 0, Z, 10.0, 21.2, 1.38, 1.38, 1.02, 1.02, ST); SQ(M, S, 1.2, 21.2, 21.55, ST2, 0, Z, 1.2);
  dec('medal', M, 1.9, 1.5, 0, 10.05, Z + 1.43, 0, { rx: -0.03 }); dec('cadText', M, 1.85, 2.6, 0, 11.9, Z + 1.34, 0, { rx: -0.032 }); dec('medal', M, 1.7, 1.7, 0, 19.2, Z + 1.12, 0, { rx: -0.032 });
  blob(M, [0, 21.85, Z], [0.4, 0.4, 0.4], B, 1);
  const V = at(M, 0, 22.15, Z);
  figure(V, 2.8, '#2f3d36', { arms: [[[-0.2, 0.92, 0.04], [-0.14, 1.1, 0.08]], [[0.28, 0.66, 0.1], [0.38, 0.7, 0.18]]] }); wings(V, 2.8, '#2f3d36', 1.15);
  part(S, new THREE.TorusGeometry(0.34, 0.07, 4, 10), { M: V, p: [-0.42, 3.38, 0.22], c: '#2f3d36', noao: true });
  for (const line of COLONNADES) colonnade(line);
  return end('Monumento ai Caduti e alla Libertà');
}
function colonnadeWalls() {
  const o = [];
  for (const line of COLONNADES) {
    const side = (k) => line.map((p, i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [r1(p[0] - (b[1] - a[1]) / l * k), r1(p[1] + (b[0] - a[0]) / l * k)]; });
    o.push(...lineSegs([...side(0.6), ...side(-0.6).reverse()]));
  }
  return o;
}
const isColonnadeFence = (f) => f.p && COLONNADES.some(l => Math.hypot(f.p[0] - l[0][0], f.p[1] - l[0][1]) < 1);

// ====================================================================================================
// 3. Garibaldi, in the garden on Via Libertà: a rock mound with Rutelli's lion in front, a white marble pedestal with a rounded front and a bronze relief on each side,
//    and Ragusa's horse walking, Garibaldi in cap and beard with his right arm raised. It faces the street (east-north-east).
// ====================================================================================================
const GAR = { O: [-902.7, -1738.0], N: unit(0.9, -0.43) };
function buildGaribaldi() {
  const { M, drop } = open(GAR, 3.5), W = '#dcdad2', W2 = '#c9c6bc', B = '#4d5240', BD = '#353a2e', S = 'mnStone';
  bx(S, M, -2.1, 2.1, -drop, 0.5, -2.9, 1.7, { c: W2 }); SQ(M, S, 1.75, 0.5, 1.9, W, 0, -0.75, 1.9); SQ(M, S, 1.9, 1.9, 2.15, W2, 0, -0.75, 2.05); SQ(M, S, 1.55, 2.15, 2.55, W, 0, -0.8, 1.75);
  const drum = (r, y0, h, c) => { SQ(M, S, r, y0, y0 + h, c, 0, -0.85, 1.4 + (r - 1.2)); cyl(S, r, r, h, 10, { M, p: [0, y0, 0.55 + (r - 1.2)], c, t0: -PI / 2, tl: PI, noao: true }); cyl(S, r, r, 0.01, 10, { M, p: [0, y0 + h, 0.55 + (r - 1.2)], c, t0: -PI / 2, tl: PI, noao: true }); };
  drum(1.38, 2.55, 0.3, W2); drum(1.2, 2.85, 2.9, W); drum(1.3, 5.75, 0.4, '#e4e2da'); drum(1.52, 6.15, 0.3, W2); drum(1.62, 6.45, 0.25, W); drum(1.2, 6.7, 0.22, W2);
  for (const s of [-1, 1]) { bx(S, M, s * 1.19, s * 1.27, 3.25, 5.15, -1.95, 0.35, { c: BD, noao: true }); dec('frieze', M, 2.1, 1.65, s * 1.285, 3.37, -0.8, s * PI / 2, { uvk: [150 / AT, 120 / AT], uvo: [(s < 0 ? 60 : 300) / AT, 1 - 252 / AT], c: '#d8d0b0' }); }
  dec('veText', M, 1.25, 1.4, 0, 3.7, 1.77);
  // the rocks, then the lion on them, in front
  const r = RNG(1301);
  for (const [x, y, z, k] of [[-1.5, 0.35, 2.5, 0.85], [0.1, 0.45, 2.7, 1.1], [1.55, 0.3, 2.4, 0.8], [-0.8, 0.3, 3.8, 0.7], [0.8, 0.25, 3.95, 0.75], [-2.2, 0.2, 1.5, 0.65], [2.15, 0.2, 1.4, 0.6], [-0.7, 1.0, 2.2, 0.75], [0.8, 0.95, 2.15, 0.7], [0.05, 0.2, 4.35, 0.5]]) {
    const g = new THREE.IcosahedronGeometry(1, 0); g.scale(k * (0.9 + r() * 0.4), k * (0.65 + r() * 0.3), k * (0.8 + r() * 0.4)); g.rotateY(r() * 6); g.rotateX(r() * 0.6); g.computeVertexNormals();
    part(S, g, { M, p: [x, y, z], c: r() < 0.5 ? '#9c9a92' : '#87857e', noao: true });
  }
  box(S, 1.5, 0.14, 2.7, { M, p: [0, 1.42, 2.75], c: '#2c302c' });
  lion(at(M, 0, 1.54, 2.75, -0.12, 0.98), '#313631', '#242825');
  const H = at(M, 0, 6.9, -0.45, 0, 1.3); horse(H, B, BD, true); rider(H, B, BD, 'cap', 'point');
  return end('Monumento a Giuseppe Garibaldi');
}

// ====================================================================================================
// 4. Colonna dell'Immacolata, Piazza San Domenico: steps of grey Billiemi stone, four marble angels on corner pedestals, a baroque marble base in two stages with the bronze popes before and behind,
//    a slender grey marble column with a Corinthian capital and the bronze Immacolata with her ring of stars, looking at the church.
// ====================================================================================================
const IMM = { O: [142.2, -332.4], N: unit(0.868, -0.496) };
function buildImmacolata() {
  const { M, drop } = open(IMM, 5.2), W = '#d6d0bf', W2 = '#bdb6a2', G = '#8f8d86', SH = '#d2d0c8', B = '#38423b', WH = '#e8e5da', S = 'mnStone';
  for (let i = 0; i < 4; i++) SQ(M, S, 5.2 - i * 0.55, i ? i * 0.3 : -drop, 0.3 + i * 0.3, i % 2 ? '#9b988f' : G);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 3.9, z = sz * 3.9, a = Math.atan2(sx, sz);
    SQ(M, S, 0.62, 0.6, 1.1, W2, x, z); SQ(M, S, 0.46, 1.1, 2.55, W, x, z); SQ(M, S, 0.6, 2.55, 2.75, W2, x, z);
    const F = at(M, x, 2.75, z, a); figure(F, 2.0, WH, { arms: [[[-0.26, 0.66, 0.1], [-0.3, 0.84, 0.16]], [[0.18, 0.56, 0.08], [0.08, 0.6, 0.15]]] }); wings(F, 2.0, WH, 0.9);
  }
  // first stage of the base, with its panels and the great scrolls at the corners
  SQ(M, S, 2.75, 1.2, 1.75, W2); SQ(M, 'mnAsh', 2.35, 1.75, 4.5, W); SQ(M, S, 2.7, 4.5, 4.75, W2); SQ(M, S, 2.9, 4.75, 5.0, W);
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    dec('plaque', K, 2.2, 1.7, 0, 2.25, 2.37);
    const D = mul(M, rotY(PI / 4 + k * PI / 2));
    taper(D, 0, 3.05, 1.2, 3.6, 0.36, 0.55, 0.28, 0.25, W2); blob(D, [0, 1.7, 3.5], [0.36, 0.48, 0.42], W); blob(D, [0, 3.8, 3.0], [0.34, 0.34, 0.36], W); blob(D, [0, 5.2, 2.5], [0.28, 0.42, 0.3], W2);
  }
  SQ(M, S, 1.75, 5.0, 6.7, W); SQ(M, S, 2.05, 6.7, 6.95, W2);
  for (const sz of [-1, 1]) { SQ(M, S, 0.52, 5.0, 6.4, W2, 0, sz * 2.15); SQ(M, S, 0.66, 6.4, 6.6, W, 0, sz * 2.15); figure(at(M, 0, 6.6, sz * 2.15, sz > 0 ? 0 : PI), 2.2, B); limb(M, [0, 8.55, sz * 2.16], [0, 9.0, sz * 2.16], 0.18, 0.03, B, 6); }
  for (const sx of [-1, 1]) { blob(M, [sx * 1.75, 5.7, 0], [0.45, 0.75, 0.6], W2); blob(M, [sx * 1.9, 7.2, 0], [0.38, 0.42, 0.45], W); }
  // the swelling pedestal, the shaft, the capital
  lathe(S, [[1.5, 0], [1.62, 0.28], [1.28, 0.5], [1.38, 0.95], [1.2, 1.4], [0.82, 1.8], [0.98, 2.0], [0.98, 2.2], [0.74, 2.35], [0.86, 2.55], [0.74, 2.7]], 12, { M, p: [0, 6.95, 0], c: W, noao: true });
  cyl(S, 0.53, 0.72, 9.75, 12, { M, p: [0, 9.65, 0], c: SH, open: true, noao: true });
  lathe(S, [[0.53, 0], [0.62, 0.08], [0.55, 0.18], [0.68, 0.55], [0.62, 0.62], [0.95, 1.05], [0.01, 1.05]], 10, { M, p: [0, 19.4, 0], c: W, noao: true });
  for (let k = 0; k < 8; k++) { const a = k * PI / 4; blob(M, [Math.sin(a) * 0.68, 19.95 + (k % 2) * 0.28, Math.cos(a) * 0.68], [0.16, 0.25, 0.16], W2); }
  SQ(M, S, 0.85, 20.45, 20.68, W2); cyl(S, 0.45, 0.58, 0.28, 10, { M, p: [0, 20.68, 0], c: B, noao: true });
  const V = at(M, 0, 20.96, 0);
  figure(V, 2.7, '#2c342f', { arms: [[[-0.17, 0.58, 0.07], [-0.03, 0.66, 0.15]], [[0.17, 0.58, 0.07], [0.04, 0.68, 0.15]]] });
  part(S, new THREE.TorusGeometry(0.55, 0.028, 4, 16), { M: V, p: [0, 2.45, -0.08], c: '#4a4a34', noao: true });
  for (let k = 0; k < 12; k++) { const a = k * PI / 6; blob(V, [Math.sin(a) * 0.55, 2.45 + Math.cos(a) * 0.55, -0.08], [0.075, 0.075, 0.05], '#8a7c42'); }
  return end("Colonna dell'Immacolata");
}

// ====================================================================================================
// 5. Obelisk to the martyrs of independence, in the garden of Piazza Indipendenza: golden limestone on steps inside a low iron railing, a tall pedestal with a marble tablet on each face,
//    a second block, the shaft with a bronze wreath on each face.
// ====================================================================================================
const OBE = { O: [-893.4, 560.1], N: unit(0.917, 0.4) };
function buildObelisco() {
  const { M, drop } = open(OBE, 4.2), Y = '#cbb48a', Y2 = '#b29c73', P = '#cdc7b8', S = 'mnStone';
  for (let i = 0; i < 3; i++) SQ(M, S, 3.5 - i * 0.55, i ? i * 0.25 : -drop, 0.25 + i * 0.25, i % 2 ? '#bdb7a8' : P);
  for (let k = 0; k < 4; k++) { const K = mul(M, rotY(k * PI / 2)); rail(at(K, 0, 0, 3.95), 7.9, 1.0); bx(S, K, 3.88, 4.02, -drop, 1.2, 3.88, 4.02, { c: '#2a2a2c', noao: true }); }
  taper(M, 0, 0, 0.75, 1.35, 1.48, 1.48, 1.38, 1.38, Y); taper(M, 0, 0, 1.35, 1.6, 1.38, 1.38, 1.1, 1.1, Y2);
  SQ(M, 'mnAsh', 1.05, 1.6, 3.8, Y); SQ(M, S, 1.2, 3.8, 3.96, Y2); SQ(M, S, 1.34, 3.96, 4.15, Y);
  SQ(M, S, 0.92, 4.15, 4.95, Y); SQ(M, S, 1.1, 4.95, 5.15, Y2);
  taper(M, 0, 0, 5.15, 16.45, 0.79, 0.79, 0.49, 0.49, Y, 'mnAsh'); taper(M, 0, 0, 16.45, 17.35, 0.49, 0.49, 0.02, 0.02, Y2);
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    dec('plaque', K, 1.65, 1.15, 0, 2.15, 1.07); dec('plaque', K, 1.1, 0.55, 0, 4.28, 0.93);
    part(S, new THREE.TorusGeometry(0.36, 0.075, 4, 10), { M: K, p: [0, 10.0, 0.67], rx: -0.027, c: '#4f5637', noao: true });
  }
  return end('Obelisco di Piazza Indipendenza');
}

// ====================================================================================================
// 6. The Capaci memorial on the A29: on each side of the motorway a tall tapering slab of rust red steel with the emblem of the Republic and the date and names, towards its own traffic.
//    Local +x of both is away from the road, so the slanting edge is on the road side.
// ====================================================================================================
const CAPS = { O: [-10157.7, -7434.5], N: unit(-0.76, 0.65) };     // beside the north-east bound carriageway, facing south-west
const CAPN = { O: [-10211.7, -7425.2], N: unit(0.79, -0.62) };     // beside the south-west bound carriageway, facing north-east
function stele(S) {
  const p = wpt(S, 0, 0), y = groundY(p[0], p[1]), M = frame(S.O[0], y, S.O[1], S.N[0], S.N[1]);
  bx('mnStone', M, -1.5, 1.25, -2.5, 0.35, -0.75, 0.75, { c: '#bdb6a4', noao: true });
  // eight corners: the front face stays upright, the back leans in towards the top, the road side edge slants, the top rises away from the road
  const F = [[-1.18, 0.35, 0.4], [0.9, 0.35, 0.4], [0.78, 9.45, 0.4], [-0.46, 9.05, 0.4]], K = [[-1.18, 0.35, -0.48], [0.9, 0.35, -0.48], [0.78, 9.45, 0.02], [-0.46, 9.05, 0.02]];
  const pos = [], q = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  q(F[0], F[1], F[2], F[3]); q(K[1], K[0], K[3], K[2]); q(K[0], F[0], F[3], K[3]); q(F[1], K[1], K[2], F[2]); q(F[3], F[2], K[2], K[3]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2).fill(0), 2)); g.computeVertexNormals();
  part('mnDec', g, { M, uv: 'keep', uvk: [0, 0], uvo: [4 / AT, 1 - 260 / AT], noao: true });   // one texel of the plain rust of the names panel
  dec('emblem', M, 0.86, 0.86, 0.2, 7.75, 0.415);
  dec('names', M, 1.56, 1.95, -0.02, 1.0, 0.415);
}
function buildCapaci() {
  setup(); begin(groundY(CAPS.O[0], CAPS.O[1]));
  stele(CAPS); stele(CAPN);
  return end('Stele di Capaci');
}

// ====================================================================================================
// 7. Fontana d'Ercole, at the head of the Viale d'Ercole in the Favorita: a round basin with a low rim (the OSM outline, 28 m across; its water is the map's), a stone drum with four sphinx heads
//    inside an iron railing, a fluted Doric column with a lion's head under each side of the abacus, two stone rounds and Hercules leaning on his club.
// ====================================================================================================
const ERC = { O: [-2286.4, -5857.6], N: unit(0.48, 0.877) };
function buildErcole() {
  const { M, drop } = open(ERC, 6), C = '#c9c1ac', C2 = '#aaa28e', D = '#a49f91', H = '#e6d6b6', S = 'mnStone';
  const N = 32, R = 14.0;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) * 2 * PI / N, p = wpt(ERC, Math.sin(a) * R, Math.cos(a) * R), q = wpt(ERC, 0, 0), dy = groundY(p[0], p[1]) - (groundY(q[0], q[1])), K = at(M, Math.sin(a) * R, 0, Math.cos(a) * R, a);
    bx(S, K, -R * PI / N - 0.06, R * PI / N + 0.06, Math.min(dy, 0) - drop, 0.6, -0.32, 0.32, { c: i % 2 ? '#aca695' : '#b6b0a0', noao: true });
  }
  cyl('mnAsh', 5.15, 5.25, 1.75 + drop, 28, { M, p: [0, -drop, 0], c: D, noao: true }); cyl(S, 5.4, 5.4, 0.18, 28, { M, p: [0, 1.75, 0], c: C2, noao: true });
  const NR = 20; for (let i = 0; i < NR; i++) { const a = (i + 0.5) * 2 * PI / NR, RR = 6.0; rail(at(M, Math.sin(a) * RR, 0, Math.cos(a) * RR, a), 2 * RR * Math.sin(PI / NR) + 0.02, 1.15); }
  for (let k = 0; k < 4; k++) {   // the sphinx heads on the rim, on the diagonals
    const a = PI / 4 + k * PI / 2, K = at(M, Math.sin(a) * 4.4, 1.93, Math.cos(a) * 4.4, a);
    bx(S, K, -0.72, 0.72, 0, 0.22, -0.75, 0.65, { c: C2, noao: true }); blob(K, [0, 0.4, -0.15], [0.46, 0.34, 0.48], C, 1);
    taper(K, 0, -0.12, 0.3, 1.5, 0.66, 0.24, 0.34, 0.2, C2);                                                     // the head cloth, wide on the shoulders
    for (const s of [-1, 1]) limb(K, [s * 0.34, 1.2, 0.08], [s * 0.44, 0.34, 0.28], 0.14, 0.12, C, 5);          // its two falls beside the face
    blob(K, [0, 1.05, 0.24], [0.28, 0.37, 0.27], H, 1); blob(K, [0, 1.44, 0.04], [0.38, 0.2, 0.34], C);
  }
  // the fluted shaft: 32 sides, every other corner drawn in
  const g = new THREE.CylinderGeometry(1.0, 1.36, 8.2, 32, 1, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if ((i % 33) % 2) p.setXYZ(i, p.getX(i) * 0.9, p.getY(i), p.getZ(i) * 0.9);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); part(S, ng, { M, p: [0, 1.9 + 4.1, 0], c: C, noao: true });
  cyl(S, 1.3, 1.45, 0.25, 16, { M, p: [0, 1.85, 0], c: C2, noao: true });
  lathe(S, [[1.0, 0], [1.1, 0.1], [1.05, 0.18], [1.45, 0.72], [1.45, 0.8]], 16, { M, p: [0, 10.1, 0], c: C, noao: true });
  for (let k = 0; k < 4; k++) { const K = mul(M, rotY(k * PI / 2)); blob(K, [0, 10.55, 1.34], [0.36, 0.36, 0.24], H, 1); blob(K, [0, 10.45, 1.58], [0.17, 0.16, 0.18], H); }
  SQ(M, S, 1.48, 10.9, 11.7, C2);
  cyl(S, 1.18, 1.22, 0.62, 18, { M, p: [0, 11.7, 0], c: C, noao: true }); cyl(S, 0.88, 0.92, 0.55, 18, { M, p: [0, 12.32, 0], c: C2, noao: true });
  const F = at(M, -0.2, 12.87, 0);
  figure(F, 2.15, H, { robe: false, arms: [[[-0.22, 0.58, -0.05], [-0.08, 0.5, -0.1]], [[0.24, 0.6, 0.04], [0.27, 0.46, 0.1]]] });
  limb(F, [0.66, 0, 0.16], [0.58, 1.02, 0.18], 0.2, 0.09, '#d2b98e', 6); blob(F, [0.66, 0.14, 0.12], [0.3, 0.2, 0.28], '#d2b98e');
  return end("Fontana d'Ercole");
}

// ====================================================================================================
// No tree (the map's, the parks' scatter or the Favorita's wood) within these circles [x, z, radius]: it would stand in a model or hide it. The photos show open paving or a clearing round each.
// (Added to the list of src/tree-clear.js, which both tree makers ask, as this module loads with the landmarks, before any tile is built in full.)
TREE_CLEAR.push([VE.O[0], VE.O[1], 11], [CAD.O[0], CAD.O[1], 25], [GAR.O[0], GAR.O[1], 12], [IMM.O[0], IMM.O[1], 11], [OBE.O[0], OBE.O[1], 13], [CAPS.O[0], CAPS.O[1], 8], [CAPN.O[0], CAPN.O[1], 8],
  [ERC.O[0], ERC.O[1], 19], [ERC.O[0] + ERC.N[0] * 25, ERC.O[1] + ERC.N[1] * 25, 12]);
TREE_CLEAR.push([-295, -513, 2]);   // the OSM tree that falls on the Teatro Massimo's front stair (src/landmarks.js): the generic one stood sunk in the steps

const spec = (name, S, build, walls, more = {}) => ({ name, x: S.O[0], z: S.O[1], radius: 20, skipIds: [], build, walls, ...more });
export const MONUMENTS = [
  spec('Monumento a Vittorio Emanuele II', VE, buildVittorio, siteRect(VE, -2.2, 2.2, -3.1, 3.1)),
  spec('Monumento ai Caduti e alla Libertà', CAD, buildCaduti, [...siteSegs(CAD, [[-11.8, -2.8], [-8.0, -4.2], [-2.1, -4.7], [2.1, -4.7], [8.0, -4.2], [11.8, -2.8], [11.8, 7.6], [-11.8, 7.6]]), ...colonnadeWalls()],
    { skipIds: ['w253675735'], dropWalls: ['w253675735'], radius: 40, clearFences: (f) => f.filter(o => !isColonnadeFence(o)) }),
  spec('Monumento a Giuseppe Garibaldi', GAR, buildGaribaldi, siteSegs(GAR, [[-2.2, -3.0], [2.2, -3.0], [2.8, 1.6], [1.4, 4.7], [-1.4, 4.7], [-2.8, 1.6]])),
  spec("Colonna dell'Immacolata", IMM, buildImmacolata, siteRect(IMM, -5.2, 5.2, -5.2, 5.2)),
  spec('Obelisco di Piazza Indipendenza', OBE, buildObelisco, siteRect(OBE, -4.0, 4.0, -4.0, 4.0)),
  spec('Stele di Capaci', CAPS, buildCapaci, [...siteRect(CAPS, -1.4, 1.2, -0.7, 0.65), ...siteRect(CAPN, -1.4, 1.2, -0.7, 0.65)]),
  spec("Fontana d'Ercole", ERC, buildErcole, siteRing(ERC, 14.2, 24), { radius: 30 }),
];
