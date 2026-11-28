// Round 2 landmarks, batch M1. Registered through src/lmc-r2.js. Seven monuments that were missing or stood as the small generic obelisk: the statues of Vincenzo Florio, Ignazio Florio, Francesco Crispi
// and Charles V, the steel memorial to the fallen in the fight against the mafia, the obelisk of the thirteen victims of 14 April 1860 and the Teatro Marmoreo of Philip V.
// The figure kit is the one of src/lmc-monuments.js. Each place is at most three meshes: the shared stone grain (every stone and bronze part is a tint of it), one painted sheet shared by the seven
// (lettering, a few carved panels, balusters, the labyrinth) and the shared iron railing. props-data nodes of Crispi and Charles V are listed in MODELLED (src/props.js).
//
// Photos (only shapes, colours, proportions and lettering were read from them). Positions were set on the Regione Siciliana orthophoto and the OSM geometry, heights estimated from the posed street
// photos where there are some, so treat both as good to about a metre (the heights of Crispi and of Ignazio Florio to rather less).
//   Vincenzo Florio (Piazza at Porta dei Greci, Foro Italico): Wikimedia Commons "Monument, Palermo, Italy (9455508981).jpg"; Mapillary 1120097051846634, 366280058109525.
//     The long inscription cannot be read in them: faint strokes.
//   Ignazio Florio (Benedetto Civiletti, w1553192647): Commons "Ignazio Florio Palermo.jpg" (the inscribed front, from which the lettering was copied), "Piazza Ignazio Florio, Palermo.jpg"; the photo of
//     balarm.it "Restaurato il monumento a Ignazio Florio" (the whole monument behind its cast iron railing).
//   Francesco Crispi (Mario Rutelli, n2045983481): the photos of balarm.it ("imbrattata la statua di Crispi") and blogsicilia.it ("vernice rossa statua Crispi", the base and its inscription);
//     Mapillary 173532381308239.
//   Memorial to the fallen in the fight against the mafia (Mario Pecoraino, w558134031): the photo of balarm.it "il labirinto di Palermo" (the lettering; about 12 m tall, as that page says);
//     Mapillary 127267399905302, 153051446786450, 384601206904813; Commons "Obelisco alle Tredici Vittime, Castellammare, Palermo, Sicily, Italy - panoramio.jpg" (it shows this memorial);
//     the white labyrinth on the lawn traced from the orthophoto.
//     (The Commons picture linked from Wikidata, "No Mafia Memorial Palermo.jpg", shows a museum front on Corso Vittorio Emanuele, not this monument, and was not used.)
//   Obelisk of the thirteen victims (w558136931): Commons "Obelisk, Piazza XIII Vittime, Palermo, Sicily, Italy.jpg"; Mapillary 733993500947647, 299206918416688.
//   Charles V (Scipione Li Volsi, n3737388525): Commons "Monument to Charles V (Palermo) 20 06 2026 01.jpg" and "04.jpg", "Statua di Carlo V (Palermo) 14 07 2024 01.jpg", "0472 - Palermo - Scipione
//     Li Volsi - Monumento a Carlo V (1630) - Foto Giovanni Dall'Orto, 28-Sept-2006.jpg"; Mapillary 237891461582278. It was drawn by no other model.
//   Teatro Marmoreo (w1185594967): Commons "Marmoreo.jpg", "Teatro Marmoreo di Re Filippo V di Spagna (Palermo) 14 07 2024 01.jpg"; Mapillary 1001761625448413, 689351683955855; it.wikipedia
//     "Teatro marmoreo" for the four pairs of allegories on the four sides.
// Not verified, and plain or simplified: the faces and drapery of every statue and the poses of the allegories; all carving (shapes only); the backs of the pedestals; the sides of the Vincenzo Florio
// die; which way Ignazio Florio looks (taken as east north east, towards Via Roma); the exact bearing of the lettered side of the steel memorial (west, read from the cranes and hills behind it in the
// photos) and the plan of its folded plates (two dihedra, from how they look from the north, west and south west); the lamps of the Ignazio Florio railing (only its corner bases and plain posts).
// The names of the thirteen victims and the Latin of the Charles V cartouche are not lettered: they cannot be read in the photos.
import * as THREE from 'three';
import { TREE_CLEAR } from './tree-clear.js';
import { PI, bx, box, lathe, panel, extrude, begin, end, defMat, part, gridMesh, mul, rotY, tr, frame, groundY, rail, RNG } from './lmc-kit.js';
import { setup, limb, blob, taper, figure, eagle, unit, wpt, siteSegs, siteRect, open, at, SQ } from './lmc-monuments.js';

const S = 'mnStone', D = 'r2m1';

// ---------------------------------------------------------------------------------------------------
// the painted sheet: transparent where nothing is painted (the lettering on the steel and the labyrinth lie on what is behind them)
// ---------------------------------------------------------------------------------------------------
const AT = 512;
const RG = {   // [x, y, w, h]
  ifText: [0, 0, 256, 320], cvText: [256, 0, 160, 224], cartouche: [416, 0, 96, 128], relief: [416, 128, 96, 160],
  crText: [256, 224, 160, 64], ifFrieze: [256, 288, 256, 48], balus: [256, 336, 256, 48], trophy: [0, 320, 256, 64],
  mfText: [0, 384, 192, 128], maze: [192, 384, 128, 128], vfFrieze: [320, 384, 192, 48], faint: [320, 432, 128, 80],
};
const MAZE = { x: 306.2, z: -781.8, a: 6.1 };   // centre and half side of the labyrinth, along the map axes
function words(g, w, lines, c, weight = 500) {   // [text, centre y, size, align left x]
  g.fillStyle = c; g.textBaseline = 'middle';
  for (const [t, y, size, left] of lines) {
    g.font = `${weight} ${size}px ${weight > 600 ? 'Helvetica, Arial, sans-serif' : 'Georgia, "Times New Roman", serif'}`; const k = Math.min(1, (w - 12) / g.measureText(t).width);
    g.save(); g.translate(left === undefined ? w / 2 : left, y); g.scale(k, 1); g.textAlign = left === undefined ? 'center' : 'left'; g.fillText(t, 0, 0); g.restore();
  }
}
function strokes(g, x, y, w, n, dy, seed, c) { const r = RNG(seed); g.fillStyle = c; for (let i = 0; i < n; i++) { const lw = w * (0.6 + r() * 0.4); let u = x + (w - lw) / 2; while (u < x + (w + lw) / 2 - 2) { const k = 2 + r() * 6; g.fillRect(u, y + i * dy, Math.min(k, x + (w + lw) / 2 - u), Math.max(1, dy * 0.28)); u += k + 2; } } }
const ell = (g, x, y, rx, ry, c, a = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); };
function marble(g, w, h, seed, c = '#dcd8cc') {
  g.fillStyle = c; g.fillRect(0, 0, w, h); const r = RNG(seed);
  for (let i = 0; i < w * h / 70; i++) { g.fillStyle = r() < 0.5 ? 'rgba(110,100,82,0.07)' : 'rgba(255,255,250,0.25)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 3); }
}
function paintSheet(g) {
  const R = (k, f) => { const [x, y, w, h] = RG[k]; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); f(w, h); g.restore(); };
  g.clearRect(0, 0, AT, AT);
  R('ifText', (w, h) => {
    marble(g, w, h, 4101);
    words(g, w, [['MDCCCXCVII', 52, 15], ['QUESTA EFFIGIE D’IGNAZIO FLORIO', 86, 18], ['A SPESE DI POPOLO', 108, 15], ['VUOL RICORDARE IL BENE E L’ONORE', 131, 16], ['FATTI ALLA PATRIA', 153, 15], ['ATTIVANDONE', 174, 15], ['LE INDUSTRIE E I COMMERCI', 196, 15], ['N. MDCCCXXXVIII M. MDCCCXCI', 233, 15]], '#55524a');
    g.fillRect(w / 2 - 22, 67, 44, 1.5); g.fillRect(w / 2 - 22, 214, 44, 1.5);
  });
  R('cvText', (w, h) => {
    marble(g, w, h, 4102, '#cfccc2');
    words(g, w, [['D · O · M', 18, 20], ['CAROLO V', 41, 18], ['HASSIACO SAXONICO', 62, 12], ['GERMANICO HISPANICO GALLICO', 78, 12], ['AFRICANO TURCICO', 94, 12], ['IMPERATORI TER MAXIMO', 126, 12]], '#4c4940');
    strokes(g, 10, 108, w - 20, 1, 12, 4103, '#6e6a5f'); strokes(g, 10, 140, w - 20, 6, 13, 4104, '#7a766a');
  });
  R('faint', (w, h) => { marble(g, w, h, 4105, '#d3cfc3'); strokes(g, 8, 7, w - 16, 8, 9, 4106, '#8a8578'); });
  R('crText', (w, h) => { marble(g, w, h, 4107); words(g, w, [['«LA MONARCHIA', 13, 17], ['CI UNISCE»', 32, 17], ['CRISPI', 52, 14]], '#4a4a40'); });
  R('mfText', (w, h) => { words(g, w, [['AI CADUTI', 18, 27, 6], ['NELLA LOTTA', 49, 27, 6], ['CONTRO', 80, 27, 6], ['LA MAFIA', 111, 27, 6]], '#1c0d08', 700); });
  R('maze', (w) => {   // traced on the orthophoto: pixel positions of a 900 px picture 14 m wide, centred on the labyrinth
    const k = w / (2 * MAZE.a * 64.3), P = (x, y) => [(x - 450) * k + w / 2, (y - 450) * k + w / 2];
    g.strokeStyle = '#e9e6da'; g.lineWidth = 3.4; g.lineJoin = 'miter';
    for (const L of [
      [[140, 95], [455, 122], [445, 265], [522, 270], [533, 130], [825, 160], [778, 790], [140, 755], [140, 95]],
      [[195, 150], [390, 168], [374, 330], [565, 347], [580, 188], [765, 205], [728, 690], [450, 668], [455, 592], [640, 605], [668, 270]],
      [[195, 150], [175, 640], [390, 655], [400, 580], [235, 568]],
      [[255, 215], [325, 220], [312, 385], [628, 405], [640, 262], [705, 268]],
      [[255, 215], [235, 505], [560, 535], [600, 548], [612, 462], [295, 446]],
      [[480, 722], [765, 745]], [[205, 700], [395, 712], [395, 760]],
    ]) { g.beginPath(); L.forEach((q, i) => i ? g.lineTo(...P(...q)) : g.moveTo(...P(...q))); g.stroke(); }
  });
  R('balus', (w, h) => { g.fillStyle = '#e2ddcf'; for (let i = 0; i < 16; i++) { const x = i * 16 + 8; g.fillRect(x - 3, 0, 6, h); ell(g, x, h * 0.62, 6.2, 12, '#e2ddcf'); ell(g, x, h * 0.24, 4.2, 4, '#e2ddcf'); g.fillStyle = '#b9b2a0'; g.fillRect(x + 2, h * 0.5, 2, h * 0.3); g.fillStyle = '#e2ddcf'; } g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); });
  R('relief', (w, h) => {
    marble(g, w, h, 4108, '#d3ccba'); g.strokeStyle = '#a79e88'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
    const r = RNG(4109);
    for (let i = 0; i < 9; i++) { const x = 20 + r() * (w - 40), y = 40 + r() * (h - 62), hh = 34 + r() * 30; for (const [dx, c] of [[3, '#9d937c'], [0, '#ece6d6']]) { ell(g, x + dx, y + 4, hh * 0.17, hh * 0.4, c, r() * 0.5 - 0.25); ell(g, x + dx, y - hh * 0.44, hh * 0.12, hh * 0.13, c); ell(g, x + dx + hh * 0.22, y - hh * 0.1, hh * 0.24, hh * 0.06, c, r() * 2 - 1); } }
  });
  R('cartouche', (w, h) => {
    marble(g, w, h, 4110, '#d3ccba');
    for (let i = 0; i < 26; i++) { const a = i / 26 * 2 * PI; ell(g, w / 2 + Math.cos(a) * 33, h / 2 + Math.sin(a) * 47, 11, 7, i % 2 ? '#a69c86' : '#ede7d8', a + 1); }
    ell(g, w / 2, h / 2, 27, 40, '#8f8c84'); ell(g, w / 2, h / 2 + 3, 20, 31, '#aaa69c'); ell(g, w / 2, 16, 20, 10, '#a69c86');
  });
  R('ifFrieze', (w, h) => {   // three shells and two sea creatures
    marble(g, w, h, 4111);
    const shell = (x, rr) => { ell(g, x, h * 0.62, rr, rr * 0.95, '#c1bba9'); g.strokeStyle = '#85806f'; g.lineWidth = 1.5; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(x, h * 0.9); g.lineTo(x + i * rr * 0.24, h * 0.62 - rr * 0.9 + Math.abs(i) * 1.7); g.stroke(); } };
    shell(18, 15); shell(w / 2, 20); shell(w - 18, 15);
    for (const s of [-1, 1]) { const cx = w / 2 + s * 60; g.strokeStyle = '#8f897767'; g.lineWidth = 11; g.beginPath(); g.moveTo(cx - s * 34, h * 0.66); g.bezierCurveTo(cx - s * 10, h * 0.05, cx + s * 2, h * 1.05, cx + s * 30, h * 0.6); g.stroke(); ell(g, cx + s * 30, h * 0.6, 9, 7, '#9d9786'); }
    g.fillStyle = '#9d9786'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  R('trophy', (w, h) => {   // a breastplate, a round shield, a drum, spears
    marble(g, w, h, 4112); g.strokeStyle = '#968f7c'; g.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [[10, 56, 110, 12], [20, 10, 100, 54], [150, 52, 246, 14], [160, 10, 236, 56]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    for (const [dx, c] of [[3, '#8f8875'], [0, '#e9e5d8']]) { ell(g, 58 + dx, 34, 24, 19, c, -0.3); ell(g, 34 + dx, 44, 14, 8, c, 0.5); ell(g, 128 + dx, 32, 23, 23, c); g.save(); g.translate(196 + dx, 32); g.rotate(0.35); g.fillStyle = c; g.fillRect(-24, -18, 48, 36); g.restore(); }
    for (const rr of [16, 8]) { g.beginPath(); g.arc(128, 32, rr, 0, 7); g.stroke(); }
    g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(186 + i * 9, 18); g.lineTo(204 + i * 9, 48); g.stroke(); }
  });
  R('vfFrieze', (w, h) => {   // flutes between wheels and anchors
    marble(g, w, h, 4113); g.fillStyle = '#a69f8c'; for (let x = 2; x < w; x += 7) g.fillRect(x, 7, 3, h - 14);
    for (let i = 0; i < 4; i++) {
      const x = 24 + i * 48; ell(g, x, h / 2, 15, 17, '#dcd8cc'); g.strokeStyle = '#7d7766'; g.lineWidth = 2.5; g.beginPath();
      if (i % 2) { g.moveTo(x, 9); g.lineTo(x, 39); g.moveTo(x - 7, 15); g.lineTo(x + 7, 15); g.moveTo(x - 11, 28); g.quadraticCurveTo(x, 48, x + 11, 28); }
      else { g.arc(x, h / 2, 12, 0, 7); for (let k = 0; k < 4; k++) { const a = k * PI / 4; g.moveTo(x - Math.cos(a) * 12, h / 2 - Math.sin(a) * 12); g.lineTo(x + Math.cos(a) * 12, h / 2 + Math.sin(a) * 12); } }
      g.stroke();
    }
    g.fillStyle = '#b4ad9a'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  });
}
function define() { setup(); defMat(D, AT, AT, [1, 1], (g) => paintSheet(g), { alphaTest: 0.5, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }); }
const LAWN = 0.16;   // the map draws its lawns this far above the ground (the green layer of src/streets.js)
const uvOf = (k) => { const [x, y, w, h] = RG[k]; return { uvk: [(w - 1) / AT, (h - 1) / AT], uvo: [(x + 0.5) / AT, 1 - (y + h - 0.5) / AT] }; };
// region k painted w x h metres, base centre at (x, y, z) of the frame M, facing +z turned by ry
const dec = (k, M, w, h, x, y, z, ry = 0, o = {}) => panel(D, w, h, { M, p: [x, y, z], ry, ...uvOf(k), ...o });

// ---------------------------------------------------------------------------------------------------
// solids
// ---------------------------------------------------------------------------------------------------
// a block on the plan pts [[x, z], ...] from y0 to y1
function block(M, pts, y0, y1, c) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-PI / 2); g.translate(0, y0, 0);
  part(S, g, { M, c, noao: true });
}
// eight corners: the faces on the axes are a out, the faces on the diagonals d out (in order of rising angle from +x towards +z)
const oct = (a, d) => { const t = Math.abs(a - d * Math.SQRT2), o = []; for (let k = 0; k < 4; k++) { const c = Math.cos(k * PI / 2), s = Math.sin(k * PI / 2); for (const [x, z] of [[a, -t], [a, t]]) o.push([x * c - z * s, x * s + z * c]); } return o; };
const cham = (a, ch) => [[a, -a + ch], [a, a - ch], [a - ch, a], [-a + ch, a], [-a, a - ch], [-a, -a + ch], [-a + ch, -a], [a - ch, -a]];
// the sides of a tapering block: plan p0 at y0 to plan p1 at y1
function loft(M, p0, y0, p1, y1, c) { gridMesh(S, [p0.map(p => [p[0], y0, p[1]]), p1.map(p => [p[0], y1, p[1]])], (i, j, p) => [(p[0] + p[2]) / 2.6, p[1] / 2.6], { wrap: true, flip: true, M, c, noao: true }); }
const drape = (M, pts, z, d, c) => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); extrude(S, s, d, { M, p: [0, 0, z], c, noao: true }); };
const ring = (M, p, r, t, c, o = {}) => part(S, new THREE.TorusGeometry(r, t, 3, o.n || 8), { M, p, c, noao: true, rx: o.rx || 0, ry: o.ry || 0 });
// a man standing in a long coat, h tall on y = 0 of M, facing +z. arms [right, left] as in figure(); hem: the coat's lower edge, flare: how wide it hangs there (shares of h)
function coatMan(M, h, c, arms, o = {}) {
  figure(M, h, c, { robe: false, arms });
  const hem = o.hem || 0.27, fl = o.flare || 0.17;
  lathe(S, [[0.001, hem], [fl, hem], [0.13, 0.45], [0.108, 0.58], [0.14, 0.72], [0.06, 0.775], [0.001, 0.775]].map(p => [p[0] * h, p[1] * h]), 8, { M, s: [1, 1, 0.72], c, noao: true });
  for (const s of [-1, 1]) blob(M, [s * 0.07 * h, 0.015 * h, 0.04 * h], [0.042 * h, 0.022 * h, 0.075 * h], c);
  if (o.beard) blob(M, [0.01 * h, 0.835 * h, 0.065 * h], [0.052 * h, 0.06 * h, 0.036 * h], o.beard);
}
// a smaller robed figure of about 120 triangles; pose picks the arms
const POSES = [
  [[[-0.2, 0.56, 0.04], [-0.12, 0.45, 0.12]], [[0.22, 0.62, 0.08], [0.16, 0.76, 0.16]]],
  [[[-0.24, 0.66, 0.1], [-0.2, 0.84, 0.14]], [[0.19, 0.55, 0.02], [0.12, 0.45, 0.1]]],
  [[[-0.2, 0.56, 0.08], [-0.05, 0.62, 0.15]], [[0.24, 0.58, 0.04], [0.3, 0.5, 0.14]]],
  [[[-0.26, 0.6, 0.06], [-0.36, 0.64, 0.14]], [[0.18, 0.55, 0.08], [0.04, 0.58, 0.15]]],
];
function small(M, h, c, pose) {
  lathe(S, [[0.001, 0], [0.19, 0], [0.12, 0.42], [0.095, 0.6], [0.13, 0.71], [0.001, 0.76]].map(p => [p[0] * h, p[1] * h]), 5, { M, c, s: [1, 1, 0.82], noao: true });
  blob(M, [0, 0.862 * h, 0.01 * h], [0.07 * h, 0.092 * h, 0.075 * h], c);
  POSES[pose % 4].forEach(([e, w], i) => { const s = [i ? 0.13 : -0.13, 0.72, 0], P = (a) => [a[0] * h, a[1] * h, a[2] * h]; limb(M, P(s), P(e), 0.05 * h, 0.036 * h, c, 3); limb(M, P(e), P(w), 0.036 * h, 0.022 * h, c, 3); });
}

// ====================================================================================================
// Vincenzo Florio: a white stone statue on a tall pedestal with cut corners, in the middle of the small square lawn before Porta dei Greci, facing the Foro Italico
// ====================================================================================================
const VF = { O: [1117.4, -78.7], N: unit(0.71, -0.70) };
function buildVincenzo() {
  define(); const { M, drop } = open(VF, 2.4), W = '#d9d3c2', W2 = '#c6bfac', ST = '#d6cfbc';
  block(M, cham(2.1, 0.7), -drop, 0.35, W2); block(M, cham(1.85, 0.65), 0.35, 0.65, '#bcb6a5');
  block(M, cham(1.56, 0.55), 0.65, 1.6, W); block(M, cham(1.74, 0.62), 1.6, 1.82, W2); loft(M, cham(1.62, 0.58), 1.82, cham(1.34, 0.46), 2.3, W); block(M, cham(1.36, 0.46), 2.3, 2.42, W2);
  loft(M, cham(1.29, 0.44), 2.42, cham(1.17, 0.4), 5.0, W);
  block(M, cham(1.23, 0.42), 5.0, 5.46, W2);
  for (let k = 0; k < 4; k++) dec('vfFrieze', mul(M, rotY(k * PI / 2)), 1.6, 0.44, 0, 5.01, 1.245);
  dec('faint', M, 1.35, 1.8, 0, 2.8, 1.275, 0, { rx: -0.047 });
  loft(M, cham(1.26, 0.43), 5.46, cham(1.62, 0.56), 5.66, W); block(M, cham(1.66, 0.58), 5.66, 5.82, W); loft(M, cham(1.55, 0.54), 5.82, cham(1.08, 0.36), 6.02, W2);
  block(M, cham(0.98, 0.32), 6.02, 6.32, W); block(M, cham(1.1, 0.36), 6.32, 6.46, W2); SQ(M, S, 0.62, 6.46, 6.62, W);
  const F = at(M, 0, 6.62, 0, 0.12);
  coatMan(F, 3.0, ST, [[[-0.2, 0.58, 0.03], [-0.13, 0.54, 0.17]], [[0.19, 0.56, -0.06], [0.07, 0.49, -0.11]]], { hem: 0.25, flare: 0.175 });
  limb(F, [-0.36, 1.58, 0.52], [-0.5, 1.7, 0.6], 0.06, 0.06, '#c9c1ac', 5);   // the rolled paper in his right hand
  return end('Monumento a Vincenzo Florio');
}

// ====================================================================================================
// Ignazio Florio: bronze on a marble pedestal with the inscription and a frieze of shells and sea creatures, inside a cast iron railing with a stone base at each corner
// ====================================================================================================
const IF = { O: [-89.0, -1009.5], N: unit(0.89, -0.45) };
function buildIgnazio() {
  define(); const { M, drop } = open(IF, 3.6), W = '#dcd8cc', W2 = '#c8c3b4', B = '#313b34', IR = '#23252a';
  SQ(M, S, 2.2, -drop, 0.35, '#b4b0a4'); SQ(M, S, 1.82, 0.35, 0.65, W2);
  SQ(M, S, 1.5, 0.65, 1.3, W); SQ(M, S, 1.62, 1.3, 1.46, W2); taper(M, 0, 0, 1.46, 1.86, 1.46, 1.46, 1.22, 1.22, '#cbc5b2'); SQ(M, S, 1.28, 1.86, 2.02, W);
  taper(M, 0, 0, 2.02, 4.5, 1.12, 1.12, 1.0, 1.0, W);
  dec('ifText', M, 1.9, 2.36, 0, 2.08, 1.128, 0, { rx: -0.048 });
  SQ(M, S, 1.1, 4.5, 4.62, W2); SQ(M, S, 1.04, 4.62, 5.07, W);
  for (const k of [0, 1, 3]) dec('ifFrieze', mul(M, rotY(k * PI / 2)), 2.04, 0.43, 0, 4.63, 1.05);
  SQ(M, S, 1.16, 5.07, 5.2, W2); taper(M, 0, 0, 5.2, 5.38, 1.18, 1.18, 1.34, 1.34, W); SQ(M, S, 1.36, 5.38, 5.47, W2); SQ(M, S, 1.05, 5.47, 5.58, W);
  SQ(M, S, 0.7, 5.58, 5.76, '#2a302b', 0, 0, 0.55);
  const F = at(M, 0, 5.76, 0);
  coatMan(F, 2.85, B, [[[-0.21, 0.6, 0.07], [-0.02, 0.645, 0.135]], [[0.2, 0.575, 0], [0.19, 0.43, 0.06]]], { hem: 0.3, flare: 0.2, beard: '#232b26' });
  drape(F, [[0.3, 2.05], [0.62, 0.9], [0.34, 0.82], [0.2, 1.4]], -0.12, 0.1, '#29322c');   // the open coat swinging out on his left
  // the railing: panels, posts with a wreath, the eagles' spread wings between them, the four corner bases with their posts
  const A = 3.5;
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    rail(at(K, 0, 0.02, A), 2 * A - 0.7, 1.15);
    for (const x of [-1.75, 0, 1.75]) { bx(S, K, x - 0.05, x + 0.05, -drop, 1.35, A - 0.05, A + 0.05, { c: IR, noao: true }); ring(K, [x, 1.52, A], 0.17, 0.04, IR, { n: 6 }); }
    for (const x of [-0.88, 0.88]) for (const s of [-1, 1]) drape(K, [[x, 1.1], [x + s * 0.42, 1.36], [x + s * 0.38, 1.16], [x + s * 0.08, 0.98]], A - 0.025, 0.05, IR);
    SQ(K, S, 0.36, -drop, 0.95, W2, A, A); SQ(K, S, 0.44, 0.95, 1.08, W, A, A);
    limb(K, [A, 1.08, A], [A, 2.3, A], 0.1, 0.045, IR, 6); blob(K, [A, 2.42, A], [0.16, 0.2, 0.16], IR);
  }
  return end('Monumento a Ignazio Florio');
}

// ====================================================================================================
// Francesco Crispi: steps, a broad sloping base with an eagle in a wreath, the inscribed block with the bronze group of three before a narrow upper pedestal, and Crispi on it with his arms folded.
// Towards Via Libertà.
// ====================================================================================================
const CR = { O: [-776.6, -1602.2], N: unit(-0.87, 0.49) };
function buildCrispi() {
  define(); const { M, drop } = open(CR, 3.1), W = '#d6d4cc', W2 = '#c2c0b7', B = '#59655b', B2 = '#49544b', B3 = '#6a766b';
  SQ(M, S, 3.15, -drop, 0.4, '#b5b3aa', 0, 0, 2.9); SQ(M, S, 2.85, 0.4, 0.75, W2, 0, 0, 2.6);
  SQ(M, S, 2.6, 0.75, 1.3, W, 0, 0, 2.35); taper(M, 0, 0, 1.3, 2.05, 2.6, 2.35, 1.38, 1.3, '#cdcbc2');
  SQ(M, S, 1.24, 2.05, 3.25, W, 0, 0, 1.14); SQ(M, S, 1.34, 3.25, 3.4, W2, 0, 0, 1.22);
  dec('crText', M, 2.0, 0.8, 0, 2.2, 1.152);
  // the eagle and its wreath on the slope
  ring(M, [0, 1.62, 2.06], 0.5, 0.11, '#8b9084', { rx: -1.0, n: 12 }); eagle(mul(at(M, 0, 1.4, 2.2), new THREE.Matrix4().makeRotationX(-0.75).scale(new THREE.Vector3(0.62, 0.62, 0.62))), '#8b9084');
  // the upper pedestal and Crispi
  taper(M, 0, -0.5, 3.4, 5.85, 0.72, 0.62, 0.62, 0.52, W); SQ(M, S, 0.82, 5.85, 6.08, W2, 0, -0.5, 0.72); SQ(M, S, 0.62, 6.08, 6.2, W, 0, -0.5, 0.55);
  coatMan(at(M, 0, 6.2, -0.5), 2.7, B, [[[-0.18, 0.6, 0.07], [0.08, 0.645, 0.135]], [[0.18, 0.6, 0.07], [-0.08, 0.615, 0.15]]], { hem: 0.28, flare: 0.16 });
  // the group: a seated woman in the middle, another standing with a banner on her left, a figure leaning in from her right, drapery falling over the front of the block
  blob(M, [0, 3.65, 0.55], [0.78, 0.42, 0.75], B2, 1); limb(M, [-0.15, 3.68, 0.9], [-0.25, 3.2, 1.33], 0.3, 0.16, B, 6); limb(M, [0.2, 3.65, 0.9], [0.3, 3.42, 1.3], 0.28, 0.15, B, 6);
  const W1 = at(M, 0.02, 3.3, 0.48); lathe(S, [[0.001, 0.4], [0.42, 0.4], [0.27, 0.95], [0.36, 1.35], [0.12, 1.55], [0.001, 1.55]], 8, { M: W1, c: B, s: [1, 1, 0.75], noao: true });
  blob(W1, [0, 1.8, 0.04], [0.19, 0.23, 0.2], B3, 1); limb(W1, [-0.28, 1.38, 0], [-0.62, 1.08, 0.28], 0.13, 0.09, B, 5); limb(W1, [-0.62, 1.08, 0.28], [-0.5, 0.82, 0.55], 0.09, 0.06, B3, 5);
  limb(W1, [0.28, 1.38, 0], [0.56, 1.24, 0.3], 0.13, 0.09, B, 5); limb(W1, [0.56, 1.24, 0.3], [0.34, 1.12, 0.52], 0.09, 0.06, B3, 5);
  figure(at(M, 0.85, 3.35, 0.05, -0.25), 2.25, B2, { arms: [[[-0.2, 0.62, 0.1], [-0.06, 0.66, 0.18]], [[0.25, 0.72, 0.04], [0.22, 0.88, 0.08]]] });
  limb(M, [1.12, 3.4, 0.2], [1.5, 6.35, 0.05], 0.05, 0.03, B2, 5); drape(M, [[1.36, 5.25], [1.5, 6.25], [1.05, 5.95], [0.72, 5.2], [1.0, 5.35], [1.05, 4.85]], -0.02, 0.14, B);
  blob(M, [-0.9, 3.75, 0.55], [0.5, 0.45, 0.45], B, 1); limb(M, [-0.82, 3.95, 0.55], [-0.62, 4.55, 0.42], 0.3, 0.2, B2, 6); blob(M, [-0.58, 4.8, 0.45], [0.17, 0.2, 0.18], B3);
  limb(M, [-0.82, 4.4, 0.5], [-1.45, 4.55, 0.75], 0.12, 0.08, B, 5); limb(M, [-1.45, 4.55, 0.75], [-1.75, 4.3, 0.85], 0.08, 0.055, B3, 5); limb(M, [-1.0, 3.6, 0.8], [-1.35, 3.0, 1.2], 0.25, 0.1, B2, 5);
  drape(M, [[-1.55, 3.55], [-1.06, 3.55], [-1.1, 2.65], [-1.33, 2.4], [-1.5, 2.9]], 1.16, 0.08, B2);
  return end('Monumento a Francesco Crispi');
}

// ====================================================================================================
// The memorial to the fallen in the fight against the mafia: two tall folded plates of weathering steel side by side, the lower part lighter and lettered, in a triangle of planting on the lawn of
// Piazza XIII Vittime, with the labyrinth of white stone lines laid out beside it
// ====================================================================================================
const MF = { O: [304.9, -772.2], N: unit(-0.97, 0.26) };
const MFT = [[300.4, -776.0], [311.2, -775.2], [304.8, -767.3]];   // the corners of the triangle
function buildMafia() {
  define(); const { M, drop } = open(MF, 1.6), UP = '#5b3022', LO = '#a2562a', SEAM = '#2f1912';
  const plate = (a, b, h) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), o = { M, p: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2], ry: Math.atan2(-dz, dx), noao: true };
    box(S, len, 2.7 + drop, 0.09, { ...o, p: [o.p[0], -drop, o.p[2]], c: LO }); box(S, len, h - 2.7, 0.09, { ...o, p: [o.p[0], 2.7, o.p[2]], c: UP });
    for (const y of [5.6, 8.7]) box(S, len + 0.01, 0.035, 0.105, { ...o, p: [o.p[0], y, o.p[2]], c: SEAM });
  };
  // two dihedra back to back, a narrow gap between them: seen from any side, two tall panels
  const g = 0.17, L = 2.15;
  plate([-L, g], [-g, g], 12.0); plate([-g, g], [-g, 1.35], 12.0);
  plate([g, -g], [L, -g], 11.55); plate([g, -1.8], [g, -g], 11.55);
  // the lettering, low on the panel to the left as one stands before it
  dec('mfText', M, 1.5, 1.0, -L + 0.81, 1.35, g + 0.06);
  // the kerb of the triangle and the plants along it (in map coordinates)
  const r = RNG(4201), y = (p) => groundY(p[0], p[1]);
  for (let i = 0; i < 3; i++) {
    const a = MFT[i], b = MFT[(i + 1) % 3], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ya = y(a), yb = y(b);
    box(S, len, 0.5, 0.28, { p: [(a[0] + b[0]) / 2, (ya + yb) / 2 + LAWN - 0.32, (a[1] + b[1]) / 2], ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), rz: Math.atan2(yb - ya, len), c: '#d2cfc2', noao: true });
    for (let k = 1; k < 6; k++) { const u = k / 6 + (r() - 0.5) * 0.06, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, cx = (MFT[0][0] + MFT[1][0] + MFT[2][0]) / 3, cz = (MFT[0][1] + MFT[1][1] + MFT[2][1]) / 3, px = x + (cx - x) * 0.14, pz = z + (cz - z) * 0.14, s = 0.3 + r() * 0.25; blob(undefined, [px, groundY(px, pz) + LAWN + s * 0.5, pz], [s * 1.2, s * 0.8, s * 1.2], r() < 0.5 ? '#46632f' : '#587a38'); }
  }
  // the labyrinth, flat on the lawn
  const N = 12, P = [];
  for (let i = 0; i <= N; i++) { const row = []; for (let j = 0; j <= N; j++) { const x = MAZE.x - MAZE.a + 2 * MAZE.a * j / N, z = MAZE.z - MAZE.a + 2 * MAZE.a * i / N; row.push([x, groundY(x, z) + LAWN + 0.05, z]); } P.push(row); }
  const [mx, my, mw, mh] = RG.maze;
  gridMesh(D, P, (i, j) => [(mx + 0.5 + (mw - 1) * j / N) / AT, 1 - (my + 0.5 + (mh - 1) * i / N) / AT], { flip: true, noao: true });
  const o = end('Monumento ai caduti nella lotta contro la mafia');
  o.getObjectByName('Monumento ai caduti nella lotta contro la mafia:' + D).castShadow = false;
  return o;
}

// ====================================================================================================
// The obelisk of the thirteen victims of 14 April 1860: a high square platform, three stepped tiers, a panelled die, a frieze of wreaths, the shaft with a dark framed panel low on each face and
// the bronze star with its leaves on the point
// ====================================================================================================
const OB = { O: [295.9, -734.7], N: unit(0.13, -0.99) };
function buildObelisco() {
  define(); const { M, drop } = open(OB, 3.7), W = '#cdc9bc', W2 = '#b7b2a4', DK = '#8d897d', BR = '#3c4636';
  SQ(M, S, 3.6, -drop, 1.35, '#a39f93'); SQ(M, S, 3.8, 1.35, 1.65, W2);
  SQ(M, S, 2.08, 1.65, 2.35, W); SQ(M, S, 2.14, 2.35, 2.5, W2); SQ(M, S, 1.78, 2.5, 3.3, W); SQ(M, S, 1.52, 3.3, 3.9, W2); taper(M, 0, 0, 3.9, 4.5, 1.46, 1.46, 1.12, 1.12, W);
  SQ(M, S, 1.05, 4.5, 6.9, W);
  taper(M, 0, 0, 6.9, 7.15, 1.07, 1.07, 1.34, 1.34, W2); SQ(M, S, 1.4, 7.15, 7.45, W);
  SQ(M, S, 0.94, 7.45, 8.5, W); SQ(M, S, 1.08, 8.5, 8.68, W2); taper(M, 0, 0, 8.68, 9.15, 0.94, 0.94, 0.64, 0.64, W);
  taper(M, 0, 0, 9.15, 15.2, 0.6, 0.6, 0.34, 0.34, W); taper(M, 0, 0, 15.2, 15.9, 0.34, 0.34, 0.02, 0.02, W2);
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    for (const x of [-0.82, 0, 0.82]) bx(S, K, x - 0.025, x + 0.025, 4.65, 6.75, 1.045, 1.065, { c: W2, noao: true });
    for (const x of [-0.42, 0.42]) ring(K, [x, 7.98, 0.96], 0.28, 0.075, DK);
    blob(K, [0, 7.8, 0.96], [0.12, 0.22, 0.07], DK);
    // the framed panel on the shaft, leaning with the face
    const lean = -0.043, T = mul(K, mul(tr(0, 9.3, 0.6), new THREE.Matrix4().makeRotationX(lean)));
    drape(T, [[-0.34, 0], [0.34, 0], [0.26, 2.75], [-0.26, 2.75]], -0.012, 0.03, '#a8a395');
    for (const s of [-1, 1]) limb(T, [s * 0.42, 0.05, 0.04], [s * 0.3, 2.9, 0.03], 0.05, 0.02, BR, 4);
    ring(T, [0, 0.42, 0.04], 0.19, 0.06, '#8f8b7c', { n: 6 });
  }
  limb(M, [0, 15.85, 0], [0, 16.45, 0], 0.04, 0.04, BR, 5);
  const star = [], leaf = (a, r, w) => [[Math.cos(a - w) * 0.2, 16.75 + Math.sin(a - w) * 0.2], [Math.cos(a) * r, 16.75 + Math.sin(a) * r], [Math.cos(a + w) * 0.2, 16.75 + Math.sin(a + w) * 0.2]];
  for (let i = 0; i < 12; i++) { const a = PI / 2 + i * PI / 6, rr = i % 2 ? 0.2 : 0.55; star.push([Math.cos(a) * rr, 16.75 + Math.sin(a) * rr]); }
  drape(M, star, -0.06, 0.12, '#56654a');
  for (let i = 0; i < 6; i++) { const a = PI / 3 + i * PI / 3; for (const d of [-0.13, 0, 0.13]) drape(M, leaf(a + d, d ? 0.68 : 0.8, 0.12), -0.025, 0.05, BR); }
  return end('Obelisco alle Tredici Vittime');
}

// ====================================================================================================
// Charles V in Piazza Bologni: four marble steps, a grey plinth, a band of carved arms, the die with its Latin inscription towards the Corso, corner volutes and a cartouche under the cornice,
// the two headed eagle before and behind, and the bronze emperor with the laurel, the Roman skirt and cloak, his right hand held out and his left on a staff
// ====================================================================================================
const CV = { O: [-103.8, 81.9], N: unit(-0.47, -0.88) };
function buildCarlo() {
  define(); const { M, drop } = open(CV, 2.8), W = '#d8d6cc', W2 = '#c2c0b6', G = '#b4b4ac', B = '#3b4a44', B2 = '#2c3733';
  for (let i = 0; i < 4; i++) SQ(M, S, 2.75 - i * 0.32, i ? i * 0.26 : -drop, 0.26 + i * 0.26, i % 2 ? '#bab8ae' : '#c8c6bc');
  SQ(M, S, 1.44, 1.04, 1.55, G); SQ(M, S, 1.38, 1.55, 2.2, '#bdbdb6');
  SQ(M, S, 1.24, 2.2, 2.92, W);
  for (let k = 0; k < 4; k++) dec('trophy', mul(M, rotY(k * PI / 2)), 2.4, 0.66, 0, 2.23, 1.248);
  SQ(M, S, 1.34, 2.92, 3.06, W2); SQ(M, S, 1.12, 3.06, 3.22, W); SQ(M, S, 0.98, 3.22, 3.42, W2);
  SQ(M, S, 0.82, 3.42, 5.32, W);
  dec('cvText', M, 1.3, 1.82, 0, 3.46, 0.828); for (const k of [1, 2, 3]) dec('faint', mul(M, rotY(k * PI / 2)), 1.2, 1.7, 0, 3.55, 0.828);
  for (let k = 0; k < 4; k++) { const K = mul(M, rotY(k * PI / 2)); for (const s of [-1, 1]) bx(S, K, s * 0.72, s * 0.86, 3.42, 5.32, 0.8, 0.87, { c: W2, noao: true }); }
  SQ(M, S, 0.86, 5.32, 5.98, W);
  for (const k of [0, 2]) { const K = mul(M, rotY(k * PI / 2)); dec('faint', K, 1.0, 0.42, 0, 5.42, 0.868); for (const s of [-1, 1]) { blob(K, [s * 0.62, 5.72, 0.9], [0.2, 0.24, 0.12], '#e4e1d6'); blob(K, [s * 0.52, 5.38, 0.89], [0.14, 0.14, 0.09], W2); } blob(K, [0, 5.9, 0.9], [0.16, 0.14, 0.1], '#e4e1d6'); }
  for (let k = 0; k < 4; k++) { const K = mul(M, rotY(PI / 4 + k * PI / 2)); blob(K, [0, 5.72, 1.26], [0.2, 0.34, 0.24], W2); blob(K, [0, 5.3, 1.18], [0.14, 0.24, 0.16], W); }
  taper(M, 0, 0, 5.98, 6.14, 0.9, 0.9, 1.16, 1.16, W2); SQ(M, S, 1.2, 6.14, 6.28, W); SQ(M, S, 0.78, 6.28, 6.4, W2); SQ(M, S, 0.66, 6.4, 6.6, W);
  for (const k of [0, 2]) {   // the eagle with two heads
    const K = mul(M, rotY(k * PI / 2));
    blob(K, [0, 6.46, 1.0], [0.1, 0.18, 0.1], '#e6e2d4');
    for (const s of [-1, 1]) { drape(K, [[s * 0.06, 6.38], [s * 0.38, 6.52], [s * 0.35, 6.68], [s * 0.08, 6.54]], 0.96, 0.06, '#ded9ca'); limb(K, [s * 0.02, 6.58, 1.02], [s * 0.1, 6.72, 1.05], 0.045, 0.03, '#e6e2d4', 5); blob(K, [s * 0.12, 6.74, 1.06], [0.045, 0.04, 0.055], '#e6e2d4'); }
  }
  const h = 2.7, F = at(M, 0, 6.6, 0.22);
  figure(F, h, B, { robe: false, arms: [[[-0.21, 0.665, 0.13], [-0.22, 0.655, 0.34]], [[0.24, 0.59, 0.03], [0.265, 0.475, 0.13]]] });
  lathe(S, [[0.001, 0.36], [0.17, 0.36], [0.125, 0.47], [0.105, 0.56], [0.13, 0.71], [0.001, 0.75]].map(p => [p[0] * h, p[1] * h]), 9, { M: F, s: [1, 1, 0.72], c: B, noao: true });
  drape(F, [[-0.3, 2.02], [0.32, 2.02], [0.44, 1.4], [0.34, 0.92], [-0.06, 1.15], [-0.28, 1.6]], -0.27, 0.1, B2); blob(F, [0.25, 1.96, -0.03], [0.2, 0.15, 0.18], B2);
  ring(F, [0.027, 2.43, 0.02], 0.19, 0.04, '#39463c', { rx: PI / 2 - 0.2 });
  blob(F, [0.027, 2.19, 0.17], [0.12, 0.13, 0.08], B2);
  limb(F, [0.72, 1.3, 0.34], [0.6, 0.02, 0.44], 0.035, 0.035, B2, 5); limb(F, [0.28, 1.25, -0.12], [0.62, 0.3, -0.34], 0.045, 0.02, B2, 4);
  return end('Monumento a Carlo V');
}

// ====================================================================================================
// The Teatro Marmoreo in Piazza del Parlamento: an iron railing round an eight sided flight of grey steps; on top four white balustrades facing north, east, south and west, each with a pair of
// statues on its end pedestals; in the middle the eight sided pedestal with carved faces, kneeling figures on its cornice, the upper stage with shields and Philip V in armour, wig and cloak
// ====================================================================================================
const FV = { O: [-593.5, 482.6], N: [0, -1] };
const FA = 10.4, FD = 8.7;   // the railing: how far out its sides on the axes and on the diagonals stand
function buildFilippo() {
  define();
  // The ground of the game falls about 3 m across this square, from the Palazzo side to the east. The flight of steps stands level a little above the ground at its middle, on a base wall
  // where the ground is lower; the railing rises onto the ground where that is higher.
  const gy = (x, z) => { const p = wpt(FV, x, z); return groundY(p[0], p[1]); };
  const y0 = gy(0, 0) + 0.4, drop = y0 - Math.min(...oct(FA + 0.14, FD + 0.14).map(p => gy(p[0], p[1]))) + 0.5, M = frame(FV.O[0], y0, FV.O[1], FV.N[0], FV.N[1]);
  begin(y0);
  const W = '#e0dacb', W2 = '#cbc4b2', W3 = '#b8b19f', STEP = '#8e8b84', IR = '#1f2024';
  block(M, oct(FA + 0.14, FD + 0.14), -drop, 0.16, '#9c988e');
  const NS = 7;
  for (let i = 0; i < NS; i++) { const u = i / (NS - 1); block(M, oct(9.75 - 2.05 * u, 8.2 - 0.95 * u), 0.16 + i * 0.2, 0.36 + i * 0.2, i % 2 ? '#98958d' : STEP); }
  const Y = 0.16 + NS * 0.2;   // the floor
  const F = oct(FA, FD);
  F.forEach((a, i) => {
    const b = F[(i + 1) % F.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, x = a[0] + dx * u, z = a[1] + dz * u, e = [k / n, (k + 1) / n].map(v => gy(a[0] + dx * v, a[1] + dz * v) - y0);
      const base = Math.max(0.14, (e[0] + e[1]) / 2 + LAWN), m = at(M, x, base, z, ry);
      rail(m, len / n, 1.75);
      bx(S, m, -len / n / 2 - 0.05, -len / n / 2 + 0.05, -0.8, 1.92, -0.05, 0.05, { c: IR, noao: true });
    }
  });
  for (let k = 0; k < 4; k++) {
    const K = mul(M, rotY(k * PI / 2));
    // the balustrade of this side: the straight run, its two returns, a pedestal at each corner and a statue on each end one
    for (const [a, b] of [[[-2.0, 7.15], [2.0, 7.15]], [[2.0, 7.15], [3.2, 6.1]], [[-3.2, 6.1], [-2.0, 7.15]]]) {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), m = at(K, (a[0] + b[0]) / 2, Y, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
      bx(S, m, -len / 2, len / 2, 0, 0.18, -0.18, 0.18, { c: W2, noao: true }); bx(S, m, -len / 2, len / 2, 0.82, 0.98, -0.2, 0.2, { c: W, noao: true });
      const [rx, ry, rw, rh] = RG.balus, share = Math.min(1, len / 4.4);
      for (const side of [0, PI]) panel(D, len, 0.66, { M: m, p: [0, 0.17, side ? -0.06 : 0.06], ry: side, uvk: [(rw * share - 1) / AT, (rh - 1) / AT], uvo: [(rx + 0.5) / AT, 1 - (ry + rh - 0.5) / AT] });
    }
    for (const s of [-1, 1]) {
      SQ(K, S, 0.28, Y, Y + 1.2, W, s * 2.0, 7.15);
      SQ(K, S, 0.44, Y, Y + 1.2, W, s * 3.2, 6.1); SQ(K, S, 0.52, Y + 1.2, Y + 1.36, W2, s * 3.2, 6.1);
      small(at(K, s * 3.2, Y + 1.36, 6.1, s * 0.3), 2.55, s < 0 ? '#ddd6c4' : '#d6cebb', k + (s < 0 ? 0 : 1));
    }
    // the faces of the pedestal on this side: the cartouche on the axis, a relief on the diagonal
    dec('cartouche', K, 1.4, 2.2, 0, 3.8, 2.585); blob(K, [0, 3.35, 2.7], [0.42, 0.5, 0.25], W2); blob(K, [0, 6.35, 2.62], [0.32, 0.34, 0.2], W3);
    const Q = mul(M, rotY(PI / 4 + k * PI / 2));
    dec('relief', Q, 1.9, 3.1, 0, 3.35, 2.385);
    for (const s of [-1, 1]) ring(Q, [s * 1.12, 3.0, 2.5], 0.34, 0.16, W, { n: 7 });
    blob(Q, [0, 6.95, 2.5], [0.55, 0.28, 0.22], W3);
    // the kneeling figure on the cornice, on a bracket
    blob(K, [0, 8.55, 2.55], [0.5, 0.26, 0.45], W2);
    small(at(K, 0, 8.58, 2.45), 1.7, '#ddd6c4', k + 2);
    // the shield and garland of the upper stage
    dec('cartouche', Q, 0.95, 1.35, 0, 8.95, 1.425); blob(Q, [0, 8.8, 1.5], [0.65, 0.24, 0.26], W3); blob(K, [0, 10.95, 1.72], [0.3, 0.2, 0.2], W3);
  }
  block(M, oct(3.65, 3.45), Y, Y + 0.45, W2); block(M, oct(3.1, 2.9), Y + 0.45, 2.9, W);
  block(M, oct(2.56, 2.36), 2.9, 7.2, W);
  loft(M, oct(2.58, 2.38), 7.2, oct(3.05, 2.85), 7.85, W2); block(M, oct(3.15, 2.95), 7.85, 8.25, W); block(M, oct(2.4, 2.2), 8.25, 8.55, W2);
  block(M, oct(1.52, 1.4), 8.55, 10.35, W); loft(M, oct(1.52, 1.4), 10.35, oct(1.88, 1.74), 10.75, W2); block(M, oct(1.92, 1.78), 10.75, 10.98, W);
  block(M, oct(1.1, 1.02), 10.98, 11.5, W2); block(M, oct(0.86, 0.8), 11.5, 11.75, W);
  const h = 3.2, V = at(M, 0, 11.75, 0), K1 = '#e4dece', K2 = '#d4ccb9';
  figure(V, h, K1, { robe: false, arms: [[[-0.22, 0.6, 0.03], [-0.27, 0.48, 0.14]], [[0.25, 0.6, -0.02], [0.12, 0.54, 0.08]]] });
  lathe(S, [[0.001, 0.4], [0.15, 0.4], [0.105, 0.52], [0.105, 0.58], [0.14, 0.71], [0.001, 0.75]].map(p => [p[0] * h, p[1] * h]), 9, { M: V, s: [1, 1, 0.75], c: K1, noao: true });
  drape(V, [[-0.42, 2.38], [0.46, 2.38], [0.7, 1.3], [0.62, 0.2], [0.1, 0.5], [-0.34, 1.2]], -0.42, 0.18, K2);
  blob(V, [0.03, 2.78, -0.08], [0.3, 0.33, 0.24], K2, 1); for (const s of [-1, 1]) blob(V, [0.03 + s * 0.24, 2.55, 0], [0.15, 0.27, 0.17], K2);
  limb(V, [-0.86, 1.54, 0.45], [-0.8, 0.9, 0.5], 0.05, 0.05, K2, 5); blob(V, [0.55, 0.22, 0.1], [0.3, 0.24, 0.28], K2);
  return end('Teatro Marmoreo di Filippo V');
}
// the fence and wall pieces the map draws where the model stands (the balustrades as walls, the railing's diagonal sides): all within 12.5 m of the middle
const inFilippo = (f) => { if (!f.p) return false; for (let i = 0; i < f.p.length; i += 2) if (Math.hypot(f.p[i] - FV.O[0], f.p[i + 1] - FV.O[1]) > 12.5) return false; return true; };

// ====================================================================================================
// No tree or bollard within these circles [x, z, radius]: it would stand in a model or hide it (see the end of src/lmc-monuments.js). The photos show an open lawn round the steel memorial and open
// ground round the others; the trees round Crispi are real and stay outside its base.
TREE_CLEAR.push([VF.O[0], VF.O[1], 8], [IF.O[0], IF.O[1], 11], [CR.O[0], CR.O[1], 4], [305.5, -778, 34], [OB.O[0], OB.O[1], 13], [CV.O[0], CV.O[1], 7], [FV.O[0], FV.O[1], 21]);

const spec = (name, Q, build, walls, more = {}) => ({ name, x: Q.O[0], z: Q.O[1], radius: 20, skipIds: [], build, walls, ...more });
export const R2_M1 = [
  spec('Monumento a Vincenzo Florio', VF, buildVincenzo, siteSegs(VF, cham(2.1, 0.7))),
  spec('Monumento a Ignazio Florio', IF, buildIgnazio, siteRect(IF, -3.85, 3.85, -3.85, 3.85)),
  spec('Monumento a Francesco Crispi', CR, buildCrispi, siteRect(CR, -3.15, 3.15, -2.9, 2.9)),
  spec('Monumento ai caduti nella lotta contro la mafia', MF, buildMafia, siteRect(MF, -2.2, 2.2, -1.85, 1.4)),
  spec('Obelisco alle Tredici Vittime', OB, buildObelisco, siteRect(OB, -3.8, 3.8, -3.8, 3.8)),
  spec('Monumento a Carlo V', CV, buildCarlo, siteRect(CV, -2.75, 2.75, -2.75, 2.75)),
  spec('Teatro Marmoreo di Filippo V', FV, buildFilippo, siteSegs(FV, oct(FA, FD)), { radius: 25, clearFences: (f) => f.filter(o => !inFilippo(o)) }),
];
