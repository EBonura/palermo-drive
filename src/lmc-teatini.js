// City landmark: the Chiesa di San Giuseppe dei Teatini (Corso Vittorio Emanuele and Via Maqueda, at the Quattro Canti, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w424559529. Frame F: origin on the ground in the middle of the main front, +z out of it (north-north-west, onto the Corso), local +x to the right seen from the Corso (west).
// Along the Corso the footprint has three runs: the concave south-west corner of the Quattro Canti (local x -17 to -8; its front is drawn by src/landmarks.js), the straight 15.5 m main front (x -8 to 8),
// and a second concave corner (x 8 to 18), the "quinto canto", the side front on the Piazzetta San Giuseppe that answers the first one. Via Maqueda runs along the east edge (local x about -16.5).
// Reference photos (Wikimedia Commons, looked at, nothing copied): San Giuseppe Teatini quinto canto.jpg and "Palermo - chiesa di San Giuseppe dei Teatini - 2026-09-24 13-52-34 001.JPG" (the quinto canto);
// Palermo-San-Giuseppe-dei-Teatini-bjs2007-01.jpg, "Facade - San Giuseppe dei Teatini - Palermo - Italy 2015.JPG", "Piazza Quattro Canti (6228008412).jpg" and "Palermo-Sicily-Italy - Creative Commons by gnuckx
// (3491864379).jpg" (the white main front, the Via Maqueda flank, the dome); "Side view - San Giuseppe dei Teatini - Palermo - Italy 2015.JPG" (balustrades, side chapel domes, buttresses, nave wall);
// "San Giuseppe dei Teatini, Albergaria, Palermo, Sicily, Italy - panoramio.jpg" (flank, portal, transept, bell tower); "Tower and dome - San Giuseppe dei Teatini - Palermo - Italy 2015.JPG".
// Positions along the nave (side domes, transept, dome, bell tower) from the Regione Siciliana orthophoto and the footprint. The Italian Wikipedia article names the parts.
// Read from them: main front of pale marble, two pairs of columns on tall pedestals round a dark green door under a broken curved pediment, a niche with San Giuseppe above, giant corner pilasters, a full-width
// triangular pediment with an iron cross. Quinto canto: stone, stairs, a square portal with a triangular pediment between two grey columns, an iron balcony on brackets, a statue in a niche in each upper order,
// shuttered windows, a curved top with a cartouche. Flank: stone with pale marble pilasters, small grated windows, a portal under the transept, a cornice, a double balustrade with dark vases, behind it a row of
// small pink domes with lanterns and sloping buttresses up to the nave; the nave wall has large arched windows and a dark tile roof. Dome in yellow majolica with blue-green chevrons; bell tower with an open
// eight-sided top under a low roof.
// Not verified: heights (read off the photos by eye against the Quattro Canti), the west flank beyond its side domes (seen only from above), the back, the carving, the twisted shafts of the bell tower (round here),
// the two arched links beside the main portal (not drawn), the iron work (a rail panel).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, panel, prism, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, statue, rail, balus } from './lmc-kit.js';

const TP = { id: 'w424559529', p: [28.5, 87.3, 41.1, 81.8, 48.6, 78.6, 44.9, 70.9, 32.2, 44.8, 19.4, 18.8, 14.8, 18.8, 12.5, 18.3, 10.8, 17.7, 6.8, 15.2, -7, 22.4, -6.6, 25.7, -8.7, 30.9, -12.5, 33.4, 4.8, 64.9, 13.3, 81.6, 21.4, 78, 24.9, 84.2] };
const O = [-0.075, 18.83], N = [-0.4627, -0.8865];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
// FW, FZ, MH, MENT: the main front; QW, FH ...: the quinto canto; EAVE: the aisle cornice; NW, NZ0, NZ1, RISE: the nave; BAY: the spacing of the pilasters and side domes
const FW = 15.5, FZ = -0.05, MH = 25.1, MENT = 21.2,   // the main front: width, face, apex of the pediment, top of its entablature
  QW = 13.5, FH = 24.0, BAL = 9.0, MID = 16.2, TOP = 22.0,   // the quinto canto: arc length, canvas height, balcony, middle cornice, top
  EAVE = 13.8, NAVE_TOP = 21.0, NW = 8.5, NZ0 = -4.3, NZ1 = -66, RISE = 3.2, BAY = 5.5,
  TZ0 = -53, TZ1 = -39, TT = 22.0, DZ = -46;   // the transept (back, front, top) and the dome's place along the nave
const CREAM = '#dcc79e', GREY = '#8f908a', GREEN = '#6c8a68', DARK = '#1a1511', MARB = '#e3ded0', MARBD = '#cbc6b8', PIL = '#cfcbbf', STONE = '#c9b68e';
// the quinto canto: a circular arc on the chord from (7.75, 0) to (17.75, -7.2), bowed 2.4 m back into the building; s runs along it, to the right seen from outside
const QR = 9.07, QSAG = 2.4, QM = [12.75, -3.6], QT = [0.812, -0.584], QN = [0.584, 0.812];
function qAt(s) {   // { p: point on the face, n: its outward normal } in F
  const a = s / QR, cx = QM[0] + QN[0] * (QR - QSAG), cz = QM[1] + QN[1] * (QR - QSAG);
  const n = [QN[0] * Math.cos(a) - QT[0] * Math.sin(a), QN[1] * Math.cos(a) - QT[1] * Math.sin(a)];
  return { p: [cx - n[0] * QR, cz - n[1] * QR], n };
}
// the Via Maqueda edge of the footprint, from the corner southwards; edgeAt(d) gives the point d m along it and the outward normal
const MQ = [[19.4, 18.8], [32.2, 44.8], [44.9, 70.9]];
function edgeAt(d) {
  let i = 0, a = MQ[0], b = MQ[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d > l) { d -= l; i = 1; a = MQ[1]; b = MQ[2]; l = Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
  return { x: a[0] + ux * d, z: a[1] + uz * d, nx: uz, nz: -ux };
}
const PILS = [0.4, 5.9, 11.4, 16.9, 22.4, 27.9, 44.2, 57.0], PORTAL = 33.2;   // distances along that edge: the flank's pilasters and its portal
// collision for what stands out of the footprint: the steps and columns of the two fronts, and the flank's pilasters and portal
const TEA_WALLS = (() => {
  const loc = (x, z) => toWorld(x, z);
  const q = (s, z) => { const a = qAt(s); return loc(a.p[0] + a.n[0] * z, a.p[1] + a.n[1] * z); };
  const front = [loc(-7.75, -0.1), loc(-7.7, 0.35), loc(-4.5, 0.35), loc(-4.5, 1.55), loc(4.5, 1.55), loc(4.5, 0.35), loc(7.7, 0.35), loc(7.75, -0.1)];
  const step = (x) => { const a = qAt(0); return loc(a.p[0] + a.n[0] * 2.25 + a.n[1] * x, a.p[1] + a.n[1] * 2.25 - a.n[0] * x); };
  const quinto = [q(-6.7, -0.1), q(-6.5, 0.38), q(-3.5, 0.38), q(-3.4, 1.05), step(-2.8), step(2.8), q(3.4, 1.05), q(3.5, 0.38), q(6.5, 0.38), q(6.7, -0.1)];
  const off = (d, o) => { const e = edgeAt(d); return [e.x + e.nx * o, e.z + e.nz * o]; };
  const flank = [off(0.4, 0), off(0.5, 0.2), off(PORTAL - 2.2, 0.2), off(PORTAL - 2.1, 0.8), off(PORTAL + 2.1, 0.8), off(PORTAL + 2.2, 0.2), off(57.5, 0.2), off(57.6, 0)];
  return [front, quinto, flank].flatMap(r => r.slice(1).map((b, i) => [...r[i], ...b]));
})();

const DOME_PAINT = (g, w, h) => { g.fillStyle = '#e3b93a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f8f86'; for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(0, j * 32 + 20); g.lineTo(64, j * 32 + 4); g.lineTo(128, j * 32 + 20); g.lineTo(128, j * 32 + 32); g.lineTo(64, j * 32 + 16); g.lineTo(0, j * 32 + 32); g.fill(); } noiseDots(g, w, h, 300, 2, 7141, ['rgba(255,255,255,0.1)', 'rgba(40,30,0,0.1)']); };

function paintFront(g, w, h) {   // the quinto canto, QW m along the arc and FH m high
  const sx = w / QW, sy = h / FH, X = x => (x + QW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const win = (x, y0, y1, ww, shut) => { R(x - ww / 2 - 0.3, y0 - 0.2, x + ww / 2 + 0.3, y1 + 0.2, '#e8dcc0'); R(x - ww / 2, y0, x + ww / 2, y1, shut); for (let y = y0 + 0.3; y < y1; y += 0.28) R(x - ww / 2, y, x + ww / 2, y + 0.06, 'rgba(0,0,0,0.22)'); R(x - 0.03, y0, x + 0.03, y1, 'rgba(0,0,0,0.35)'); tri(x - ww / 2 - 0.45, x + ww / 2 + 0.45, y1 + 0.2, 0.7, '#e8dcc0'); };
  // lower order: rusticated sandstone
  paintAshlar(g, w, h, QW, FH, 0.75, 1.9, '#bda37a', '#8f7a58', 7101, 1.2, 0.07);
  // the upper two orders: smooth warm plaster over the rustication
  R(-QW / 2, BAL, QW / 2, FH, CREAM); noiseDots(g, w, h, w * h / 70, 2, 7102, ['rgba(150,110,60,0.08)', 'rgba(255,245,215,0.1)']);
  for (let i = 0; i < 5; i++) { const cx = X(-5.4 + i * 2.7), cy = Y(10 + (i % 3) * 5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * sx); gr.addColorStop(0, 'rgba(150,110,60,0.14)'); gr.addColorStop(1, 'rgba(150,110,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // lower order: the portal (square, dark, pediment, medallion), two barred windows with balustrades
  R(-1.9, 0, 1.9, 6.3, '#d8c8a2'); R(-1.5, 1.2, 1.5, 5.9, DARK); R(-1.7, 5.9, 1.7, 6.3, '#d8c8a2'); tri(-2.6, 2.6, 6.3, 1.3, '#d8c8a2'); tri(-1.9, 1.9, 6.45, 0.85, '#bfa982'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(X(0), Y(7.0), 0.4 * sx, 0, 2 * PI); g.fill();
  for (const s of [-1, 1]) { const x = s * 4.7; R(x - 1.5, 2.8, x + 1.5, 6.6, '#d8c8a2'); R(x - 1.1, 3.2, x + 1.1, 6.2, '#272c33'); for (let k = -1; k <= 1; k++) R(x + k * 0.7 - 0.03, 3.2, x + k * 0.7 + 0.03, 6.2, '#8a8478'); R(x - 1.4, 1.4, x + 1.4, 3.0, '#d8c8a2'); for (let k = 0; k < 8; k++) R(x - 1.2 + k * 0.33, 1.6, x - 1.0 + k * 0.33, 2.8, '#eee4cc'); }
  // the bracketed cornice under the balcony
  R(-QW / 2, BAL - 1.3, QW / 2, BAL, '#c9b68e'); for (let x = -6.4; x < 6.4; x += 0.9) R(x, BAL - 1.3, x + 0.4, BAL - 0.2, 'rgba(60,40,20,0.35)'); R(-QW / 2, BAL - 1.4, QW / 2, BAL - 1.3, 'rgba(40,25,10,0.4)');
  // middle order
  for (const s of [-1, 1]) win(s * 4.7, 10.2, 14.6, 1.8, GREEN);
  arch(0, 9.6, 15.3, 2.5, '#e8dcc0'); arch(0, 9.8, 15.1, 2.1, '#6f6a60'); R(-0.6, 9.8, 0.6, 12.9, '#e2dccb'); R(-0.35, 12.9, 0.35, 13.7, '#e2dccb');
  R(-QW / 2, MID - 0.9, QW / 2, MID, '#e0d2b0'); R(-QW / 2, MID - 1.0, QW / 2, MID - 0.9, 'rgba(40,25,10,0.4)'); R(-QW / 2, MID, QW / 2, MID + 0.5, '#d0bd94');
  // attic
  for (const s of [-1, 1]) { R(s * 6.2 - 0.4, MID + 0.5, s * 6.2 + 0.4, TOP - 0.6, '#d9c59a'); R(s * 5.35 - 0.3, MID + 0.5, s * 5.35 + 0.3, TOP - 0.6, '#d9c59a'); win(s * 4.2, MID + 1.8, MID + 4.4, 1.5, GREEN); }
  arch(0, MID + 1.0, TOP - 0.7, 2.4, '#e8dcc0'); arch(0, MID + 1.2, TOP - 0.9, 2.0, '#6f6a60'); R(-0.5, MID + 1.2, 0.5, MID + 3.8, '#e2dccb');
  R(-QW / 2, TOP - 0.7, QW / 2, TOP, '#d0bd94'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(X(0), Y(TOP + 1.0), 1.5 * sx, 0.9 * sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#bfa982'; g.beginPath(); g.ellipse(X(0), Y(TOP + 1.0), 1.15 * sx, 0.65 * sy, 0, 0, 2 * PI); g.fill();
  for (const y of [BAL - 1.4, MID - 1.0]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.4)); gs.addColorStop(0, 'rgba(40,25,10,0.3)'); gs.addColorStop(1, 'rgba(40,25,10,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.4 * sy); }
  streaks(g, w, h, 30, 7103, 0.1, 100, '60,45,30');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,22,14,0.32)'); gb.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintMain(g, w, h) {   // the main front: FW m wide, MH m high, pale weathered marble
  const sx = w / FW, sy = h / MH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const panelR = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, '#b9b4a7'); R(x0 + 0.12, y0, x1, y1 - 0.12, '#d6d1c3'); };
  g.fillStyle = '#ddd8ca'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 50, 2, 7201, ['rgba(110,105,92,0.10)', 'rgba(255,253,244,0.14)']);
  for (let y = 0.9; y < MENT; y += 0.9) R(-FW / 2, y, FW / 2, y + 0.04, 'rgba(110,100,84,0.14)');   // courses
  R(-FW / 2, 0, FW / 2, 1.2, '#a9a394'); R(-FW / 2, 1.2, FW / 2, 1.35, '#ece8dc');
  for (const s of [-1, 1]) {
    panelR(s * 6.9 - 0.5, 1.6, s * 6.9 + 0.5, 4.2); panelR(s * 5.2 - 0.45, 3.4, s * 5.2 + 0.45, 11.4); panelR(s * 5.2 - 0.45, 13.4, s * 5.2 + 0.45, 19.4);
    R(s * 5.2 - 0.55, 19.4, s * 5.2 + 0.55, 20.2, '#ece8dc'); R(s * 5.2 - 0.55, 11.4, s * 5.2 + 0.55, 12.0, '#ece8dc');
    for (const x of [6.25, 7.55]) R(s * x - 0.04, 4.6, s * x + 0.04, 19.0, 'rgba(100,90,74,0.35)');
    panelR(s * 3.0 - 1.05, 13.8, s * 3.0 + 1.05, 18.6);
    panelR(s * 3.1 - 1.1, 0.35, s * 3.1 + 1.1, 2.8);
  }
  // the door: dark green leaves in a moulded frame, rows of studs
  R(-1.95, 1.2, 1.95, 8.75, '#b4aea0'); R(-1.75, 1.2, 1.75, 8.55, '#efebe0'); R(-1.5, 1.2, 1.5, 8.2, '#26362f'); R(-0.05, 1.2, 0.05, 8.2, '#131c18');
  for (let y = 1.6; y < 7.8; y += 0.95) for (const x of [-1.15, -0.45, 0.45, 1.15]) { R(x - 0.28, y, x + 0.28, y + 0.7, '#31463c'); R(x - 0.08, y + 0.27, x + 0.08, y + 0.43, '#0f1713'); }
  // the niche of San Giuseppe
  arch(0, 13.5, 18.2, 2.6, '#f0ece0'); arch(0, 13.5, 17.95, 2.15, '#77736a'); arch(0.12, 13.5, 17.7, 1.75, '#8d897e');
  // the two entablatures and the pediment field
  for (const [y0, y1] of [[11.7, 12.6], [20.2, MENT]]) { R(-FW / 2, y0, FW / 2, y1, '#e8e4d8'); R(-FW / 2, y0, FW / 2, y0 + 0.12, 'rgba(70,62,50,0.45)'); R(-FW / 2, y0 + 0.5, FW / 2, y0 + 0.58, 'rgba(90,82,68,0.3)'); for (let x = -7.6; x < 7.7; x += 0.42) R(x, y1 - 0.28, x + 0.2, y1 - 0.08, 'rgba(90,82,68,0.35)'); }
  g.fillStyle = '#c9c4b6'; g.beginPath(); g.moveTo(X(-6.2), Y(MENT + 0.45)); g.lineTo(X(0), Y(MH - 0.85)); g.lineTo(X(6.2), Y(MENT + 0.45)); g.fill();
  for (const y of [11.7, 20.2]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.4)); gs.addColorStop(0, 'rgba(50,42,30,0.28)'); gs.addColorStop(1, 'rgba(50,42,30,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.4 * sy); }
  streaks(g, w, h, 34, 7202, 0.12, 90, '90,80,62');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(4)); gb.addColorStop(0, 'rgba(50,42,28,0.34)'); gb.addColorStop(1, 'rgba(50,42,28,0)'); g.fillStyle = gb; g.fillRect(0, Y(4), w, 4 * sy);
}
function paintFlank(g, w, h) {   // one bay of the lower flank, BAY m wide, EAVE m high: grey-brown stone, a pale marble pilaster half at each edge, two small grated windows
  const sx = w / BAY, sy = h / EAVE, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, BAY, EAVE, 0.6, 1.2, '#b7a58a', '#8a7a64', 7121, 1.0, 0.12);
  noiseDots(g, w, h, w * h / 70, 2.5, 7123, ['rgba(80,60,40,0.16)', 'rgba(230,220,200,0.14)']);
  R(0, 0, BAY, 0.7, '#a29c90'); R(0, 3.0, BAY, 3.35, '#c6c1b4');
  for (const x of [0, BAY - 0.55]) { R(x, 0.7, x + 0.55, 12.6, PIL); R(x ? x : x + 0.5, 0.7, x ? x + 0.07 : x + 0.57, 12.6, 'rgba(70,55,35,0.35)'); }
  // the grated basement window and the segmental window high up
  const m = BAY / 2;
  R(m - 1.15, 0.95, m + 1.15, 2.45, '#c6c1b4'); R(m - 0.95, 1.1, m + 0.95, 2.3, '#26221d');
  g.fillStyle = '#cdc8bb'; g.beginPath(); g.moveTo(X(m - 1.3), Y(6.4)); g.lineTo(X(m - 1.3), Y(8.6)); g.quadraticCurveTo(X(m), Y(9.5), X(m + 1.3), Y(8.6)); g.lineTo(X(m + 1.3), Y(6.4)); g.fill();
  g.fillStyle = '#2a2724'; g.beginPath(); g.moveTo(X(m - 0.95), Y(6.75)); g.lineTo(X(m - 0.95), Y(8.4)); g.quadraticCurveTo(X(m), Y(9.05), X(m + 0.95), Y(8.4)); g.lineTo(X(m + 0.95), Y(6.75)); g.fill();
  for (let x = m - 0.7; x < m + 0.9; x += 0.34) { R(x, 6.75, x + 0.05, 8.6, 'rgba(180,170,150,0.55)'); R(x, 1.1, x + 0.05, 2.3, 'rgba(180,170,150,0.5)'); }
  R(0, EAVE - 1.2, BAY, EAVE, '#cbc4b2'); R(0, EAVE - 1.4, BAY, EAVE - 1.2, 'rgba(50,35,20,0.35)');
  streaks(g, w, h, 14, 7126, 0.14, 90, '60,45,30');
}
function paintNave(g, w, h) {   // one bay of the nave wall above the side domes: stone, a large arched window, a small square one under the cornice
  const hm = NAVE_TOP - EAVE, sx = w / BAY, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1) + r * sx); g.arc(X(x), Y(y1) + r * sx, r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, BAY, hm, 0.55, 1.1, '#cbbb9c', '#9c8c70', 7131, 1.0, 0.1);
  R(0, 0, 0.45, hm, '#d8d3c5'); R(BAY - 0.45, 0, BAY, hm, '#d8d3c5');
  const m = BAY / 2;
  arch(m, 0.5, 4.5, 3.0, '#ddd6c4'); arch(m, 0.5, 4.25, 2.45, '#252a31'); R(m - 0.04, 0.5, m + 0.04, 3.9, '#8a8272'); R(m - 1.2, 2.3, m + 1.2, 2.38, '#8a8272');
  R(m - 0.5, 5.35, m + 0.5, 6.2, '#ddd6c4'); R(m - 0.35, 5.48, m + 0.35, 6.07, '#252a31');
  R(0, 4.75, BAY, 5.0, '#ded8c8'); R(0, hm - 0.55, BAY, hm, '#e0d8c4'); R(0, hm - 0.75, BAY, hm - 0.55, 'rgba(50,35,20,0.3)');
  streaks(g, w, h, 8, 7136, 0.1, 60, '60,45,30');
}

function mainFront(F, at) {
  const hw = FW / 2, sh = new THREE.Shape();
  sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw, MENT); sh.lineTo(0, MH); sh.lineTo(-hw, MENT); sh.lineTo(-hw, 0);
  extrude('tbMarble', sh, 1.2, { M: at(0, 0, FZ - 1.2), uv: 'keep', uvk: [1 / FW, 1 / MH], uvo: [0.5, 0], noao: true });
  const B = (x0, x1, y0, y1, z0, z1, c, o = {}) => bx('flat', F, x0, x1, y0, y1, FZ + z0, FZ + z1, { c, noao: true, ...o });
  B(-hw - 0.25, hw + 0.25, 20.35, MENT + 0.1, -0.3, 0.65, MARB);
  const slope = Math.atan2(MH - MENT, hw + 0.25), len = Math.hypot(MH - MENT, hw + 0.25);
  for (const sg of [-1, 1]) bx('flat', mul(at(sg * (hw + 0.25) / 2, (MENT + MH) / 2 - 0.15, FZ + 0.12), new THREE.Matrix4().makeRotationZ(-sg * slope)), -len / 2, len / 2, 0, 0.42, -0.42, 0.42, { c: MARB, noao: true });
  lathe('flat', [[0.75, 0], [0.6, 0.35], [0.25, 0.65], [0, 0.7]], 8, { M: at(0, MH - 0.05, FZ - 0.35), c: '#6f6a60', noao: true });
  B(-0.1, 0.1, MH + 0.6, MH + 3.4, -0.45, -0.25, '#5a2c22'); B(-0.85, 0.85, MH + 2.35, MH + 2.55, -0.45, -0.25, '#5a2c22');
  for (const sg of [-1, 1]) {
    // the giant corner pilasters and their capitals
    B(sg * 6.9 - 0.6, sg * 6.9 + 0.6, 4.4, 19.3, 0, 0.28, MARBD); B(sg * 6.9 - 0.75, sg * 6.9 + 0.75, 0, 4.4, 0, 0.35, MARBD); B(sg * 6.9 - 0.82, sg * 6.9 + 0.82, 19.3, 20.35, 0, 0.5, MARB);
    // the paired columns of the portal on their pedestals, the inner one standing further out, and the entablature over each pair
    for (const [x, z] of [[2.4, 0.95], [3.75, 0.55]]) {
      B(sg * x - 0.5, sg * x + 0.5, 0, 3.15, 0, z + 0.45, MARBD);
      cyl('flat', 0.31, 0.37, 6.45, 8, { M: at(sg * x, 3.15, FZ + z), c: '#bfbdb6', open: true, noao: true });
      lathe('flat', [[0.31, 0], [0.4, 0.3], [0.55, 0.75], [0.55, 0.85], [0, 0.85]], 8, { M: at(sg * x, 9.6, FZ + z), c: MARB, noao: true });
    }
    B(sg * 3.1 - 1.25, sg * 3.1 + 1.25, 10.45, 11.75, 0, 1.15, MARB); B(sg * 3.1 - 1.4, sg * 3.1 + 1.4, 11.75, 12.1, 0, 1.4, '#efebe0');
    // the broken curved pediment over the door
    const q = new THREE.Shape(); q.moveTo(sg * 2.9, 12.1); q.quadraticCurveTo(sg * 1.5, 12.25, sg * 0.75, 13.55); q.lineTo(sg * 0.75, 12.95); q.quadraticCurveTo(sg * 1.6, 11.85, sg * 2.9, 11.65); q.lineTo(sg * 2.9, 12.1);
    extrude('flat', q, 0.55, { M: at(0, 0, FZ), c: '#efebe0', noao: true, cs: 3 });
    B(sg * 1.55 - 0.2, sg * 1.55 + 0.2, 13.5, 18.2, 0, 0.35, MARB);   // the frame of the niche
  }
  B(-1.8, 1.8, 8.75, 9.2, 0, 0.55, MARB);
  sphere('flat', 0.85, { M: at(0, 10.6, FZ + 0.1), ky: 1.15, kz: 0.45, seg: 6, c: '#e9e4d6', noao: true });
  B(-2.0, 2.0, 13.0, 13.5, 0, 0.75, MARB); B(-2.0, 2.0, 18.2, 18.55, 0, 0.55, MARB);
  const t = new THREE.Shape(); t.moveTo(-2.1, 18.55); t.lineTo(2.1, 18.55); t.lineTo(0, 19.6); t.lineTo(-2.1, 18.55);
  extrude('flat', t, 0.4, { M: at(0, 0, FZ), c: '#efebe0', noao: true });
  statue('flat', at(0, 13.5, FZ + 0.35), 3.6, { c: '#d9d5ca' });
  for (let i = 0; i < 3; i++) bx('flat', F, -1.7 - i * 0.25, 1.7 + i * 0.25, -0.3, 0.4 * (3 - i), FZ, 0.55 + 0.4 * i, { c: '#bdb5a4' });
}

function quintoCanto(F) {
  const N = 12, hs = QW / 2, ss = Array.from({ length: N + 1 }, (_, i) => -hs + QW * i / N);
  const top = (s) => Math.abs(s) > 6.3 ? MID + 0.9 : TOP + 1.3 * (1 - (s / 6.3) ** 2);
  const cols = [-hs, -6.31, -6.3, ...ss.slice(1, N), 6.3, 6.31, hs];
  const pt = (s, y, z) => { const a = qAt(s); return [a.p[0] + a.n[0] * z, y, a.p[1] + a.n[1] * z]; };
  const front = [cols.map(s => pt(s, -1.2, 0)), cols.map(s => pt(s, top(s), 0))];
  gridMesh('tbFront', front, (i, j, p) => [cols[j] / QW + 0.5, p[1] / FH], { M: F, noao: true });
  // its back and top, seen from behind and from Via Maqueda
  const back = [cols.map(s => pt(s, EAVE - 0.2, -1.0)), cols.map(s => pt(s, top(s), -1.0))];
  gridMesh('flat', back, () => [0, 0], { M: F, c: '#b9a888', noao: true, flip: true });
  gridMesh('flat', [front[1], back[1]], () => [0, 0], { M: F, c: STONE, noao: true });
  for (const [j, flip] of [[0, true], [cols.length - 1, false]]) gridMesh('flat', [[front[0][j], back[0][j]], [front[1][j], back[1][j]]], () => [0, 0], { M: F, c: '#b9a888', noao: true, flip });
  const M = (s, y = 0, z = 0) => { const a = qAt(s); return mul(F, mul(frame(a.p[0], 0, a.p[1], a.n[0], a.n[1]), tr(0, y, z))); };
  const arc = (s0, s1, n, y0, y1, z, c) => { const w = (s1 - s0) / n; for (let i = 0; i < n; i++) bx('flat', M(s0 + w * (i + 0.5)), -w / 2 - 0.02, w / 2 + 0.02, y0, y1, -0.15, z, { c, noao: true }); };
  arc(-hs, hs, 6, BAL - 0.2, BAL + 0.25, 1.1, STONE);
  const w = QW / 6; for (let i = 0; i < 6; i++) rail(M(-hs + w * (i + 0.5), BAL + 0.25, 1.05), w * 0.94, 1.1);
  for (const s of [-4.7, -1.5, 1.5, 4.7]) bx('flat', M(s), -0.18, 0.18, BAL - 1.05, BAL - 0.2, 0, 0.8, { c: '#a8946e', noao: true });
  arc(-hs, hs, 6, MID - 0.25, MID + 0.15, 0.4, '#d0bd94'); arc(-hs, hs, 6, MID + 0.15, MID + 0.5, 0.75, '#dccba2');
  arc(-6.25, 6.25, 5, TOP - 0.45, TOP, 0.5, '#d0bd94');
  for (const sg of [-1, 1]) {
    const s = sg * 2.75;
    bx('flat', M(s), -0.55, 0.55, 0, 2.0, 0, 1.0, { c: '#a9a38f', noao: true });
    cyl('flat', 0.35, 0.4, 5.6, 8, { M: M(s, 2.0, 0.55), c: GREY, open: true, noao: true }); bx('flat', M(s), -0.55, 0.55, 7.6, BAL - 0.2, 0, 1.05, { c: STONE, noao: true });
    bx('flat', M(s), -0.5, 0.5, BAL + 0.25, BAL + 1.15, 0, 0.95, { c: STONE, noao: true });
    cyl('flat', 0.29, 0.33, 4.35, 8, { M: M(s, BAL + 1.15, 0.5), c: GREY, open: true, noao: true }); bx('flat', M(s), -0.48, 0.48, MID - 0.75, MID - 0.25, 0, 0.9, { c: CREAM, noao: true });
    bx('flat', M(sg * 6.2), -0.5, 0.5, -0.5, BAL - 0.2, 0, 0.32, { c: '#bda57b', noao: true }); bx('flat', M(sg * 6.2), -0.42, 0.42, BAL, MID - 0.25, 0, 0.24, { c: '#d2bb8e', noao: true });
    bx('flat', M(sg * 5.35), -0.3, 0.3, MID + 0.5, TOP - 0.45, 0, 0.22, { c: '#dcc79e', noao: true });
    bx('flat', M(sg * 4.7), -1.45, 1.45, 3.0, 3.3, 0, 0.35, { c: STONE, noao: true });   // sill of the grated window
  }
  // the portal: dark doorway, stone jambs, a lintel and a triangular pediment
  const P = M(0, 0, 0.14);
  bx('flat', P, -1.5, 1.5, 1.2, 5.9, -0.05, 0.05, { c: DARK, noao: true });
  for (const sg of [-1, 1]) bx('flat', P, sg * 1.75 - 0.25, sg * 1.75 + 0.25, 1.2, 5.9, 0, 0.3, { c: '#c9c0aa', noao: true });
  bx('flat', P, -2.1, 2.1, 5.9, 6.45, 0, 0.45, { c: '#c9c0aa', noao: true });
  const tp = new THREE.Shape(); tp.moveTo(-2.35, 6.45); tp.lineTo(2.35, 6.45); tp.lineTo(0, 7.75); tp.lineTo(-2.35, 6.45);
  extrude('flat', tp, 0.45, { M: P, c: '#cfc5ab', noao: true });
  // the statues in their niches, the cartouche on the curved top and the two ornaments beside it
  bx('flat', P, -0.9, 0.9, BAL + 0.25, BAL + 0.7, 0, 0.7, { c: STONE, noao: true });
  statue('flat', M(0, BAL + 0.7, 0.4), 3.5, { c: '#e0dacb' });
  sphere('flat', 0.55, { M: M(0, 14.9, 0.15), ky: 0.7, kz: 0.45, seg: 6, c: '#d9d2bf', noao: true });
  bx('flat', P, -1.1, 1.1, MID + 0.8, MID + 1.2, 0, 0.6, { c: STONE, noao: true });
  statue('flat', M(0, MID + 1.2, 0.3), 2.7, { c: '#e0dacb' });
  cyl('flat', 1.1, 1.1, 0.3, 10, { M: mul(M(0, TOP + 1.6, -0.2), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#e2d6b8', noao: true });
  for (const sg of [-1, 1]) lathe('flat', [[0.35, 0], [0.2, 0.3], [0.4, 0.8], [0.12, 1.2], [0, 1.4]], 6, { M: M(sg * 5.6, top(5.6) - 0.1, -0.4), c: '#cfc0a0', noao: true });
  for (let i = 0; i < 5; i++) bx('flat', P, -1.9 - i * 0.2, 1.9 + i * 0.2, -0.4, 0.24 * (5 - i), -0.05, 0.4 * (i + 1), { c: i % 2 ? '#a9a293' : '#bdb5a4' });
}

// the south-west corner of the Quattro Canti (its front is a single sheet, src/landmarks.js): a back and a top for it above the aisle roof, so it is not seen through from behind
function cantoBack() {
  const C = [17.49, 4.0], Rf = 14.95, mid = 1.887;
  const cols = [-6.3, -4.7, -3.0, -2.99, -1.5, 0, 1.5, 2.99, 3.0, 4.7, 6.3];
  const gy = groundY(C[0] + Rf * Math.cos(mid), C[1] + Rf * Math.sin(mid));
  const pt = (s, y, r) => { const t = mid + s / Rf; return [C[0] + r * Math.cos(t), gy + y, C[1] + r * Math.sin(t)]; };
  const top = (s) => Math.abs(s) < 3.0 ? 25.45 : 22.85;
  const b0 = cols.map(s => pt(s, EAVE - 0.2, Rf + 0.9)), b1 = cols.map(s => pt(s, top(s), Rf + 0.9)), f1 = cols.map(s => pt(s, top(s), Rf + 0.02));
  // s runs to the right seen from the crossing, so the back, seen from the other side, is wound the other way
  gridMesh('flat', [b0, b1], () => [0, 0], { c: '#b09c78', noao: true, flip: true });
  gridMesh('flat', [f1, b1], () => [0, 0], { c: STONE, noao: true });
  for (const [j, flip] of [[0, false], [cols.length - 1, true]]) gridMesh('flat', [[b0[j], pt(cols[j], EAVE - 0.2, Rf + 0.02)], [b1[j], f1[j]]], () => [0, 0], { c: '#b09c78', noao: true, flip });
}

function flank(y0) {
  const E = (d, y = 0) => { const e = edgeAt(d); return frame(e.x, y0 + y, e.z, e.nx, e.nz); };
  for (const d of PILS) { const M = E(d); bx('flat', M, -0.45, 0.45, -1.2, 12.6, -0.1, 0.18, { c: PIL }); bx('flat', M, -0.6, 0.6, 12.0, 12.6, -0.1, 0.32, { c: '#dad5c6', noao: true }); }
  for (const [a, b] of [[0.2, 28.9], [29.1, 57.8]]) { const l = b - a; bx('flat', E((a + b) / 2), -l / 2, l / 2, 12.75, 13.15, -0.2, 0.3, { c: '#bdb4a0', noao: true }); bx('flat', E((a + b) / 2), -l / 2, l / 2, 13.55, EAVE + 0.15, -0.2, 0.55, { c: '#d2cab6', noao: true }); }
  // the double balustrade over the side chapels, a pedestal with a dark vase on each pilaster
  for (let i = 0; i < 5; i++) { const d = PILS[i] + BAY / 2; balus(mul(E(d, EAVE + 0.15), tr(0, 0, 0.1)), 4.7, 1.15, { c: '#e6ddc6' }); balus(mul(E(d, EAVE + 1.2), tr(0, 0, -1.5)), 4.7, 1.0, { c: '#e6ddc6' }); }
  for (const d of PILS.slice(0, 6)) {
    bx('flat', E(d, EAVE), -0.42, 0.42, 0, 1.55, -0.35, 0.35, { c: '#cdc5b0', noao: true });
    lathe('flat', [[0.12, 0], [0.34, 0.4], [0, 1.15]], 5, { M: E(d, EAVE + 1.55), c: '#3d3b36', noao: true });
    bx('flat', E(d, EAVE), -0.36, 0.36, 0, 2.5, -1.85, -1.25, { c: '#cdc5b0', noao: true });
  }
  // the portal under the transept, with a framed window over it
  const P = E(PORTAL);
  bx('flat', P, -1.15, 1.15, 0.5, 5.4, -0.05, 0.09, { c: '#2c352e', noao: true });
  for (const sg of [-1, 1]) { bx('flat', P, sg * 1.65 - 0.36, sg * 1.65 + 0.36, -0.5, 1.4, 0, 0.75, { c: '#a8a397', noao: true }); cyl('flat', 0.24, 0.28, 4.4, 6, { M: mul(P, tr(sg * 1.65, 1.4, 0.42)), c: GREY, open: true, noao: true }); }
  bx('flat', P, -2.2, 2.2, 5.8, 6.6, 0, 0.75, { c: PIL, noao: true });
  const t = new THREE.Shape(); t.moveTo(-2.3, 6.6); t.lineTo(2.3, 6.6); t.lineTo(0, 7.65); t.lineTo(-2.3, 6.6); extrude('flat', t, 0.45, { M: P, c: '#d6d0c0', noao: true });
  bx('flat', P, -1.2, 1.2, 8.1, 10.7, -0.05, 0.2, { c: PIL, noao: true }); bx('flat', P, -0.75, 0.75, 8.45, 10.35, 0, 0.23, { c: '#2a2724', noao: true });
  const t2 = new THREE.Shape(); t2.moveTo(-1.5, 10.7); t2.lineTo(1.5, 10.7); t2.lineTo(0, 11.5); t2.lineTo(-1.5, 10.7); extrude('flat', t2, 0.35, { M: P, c: '#d6d0c0', noao: true });
}

function upperWorks(F, at) {
  // the small domes over the side chapels (pink render, an eight sided lantern, a cap) and the sloping buttresses between them, on both sides
  for (const sg of [-1, 1]) for (let i = 0; i < 5; i++) {
    const z = -9 - PILS[i] - BAY / 2, C = at(sg * 12.1, EAVE + 0.1, z);   // (the first stands clear of the backs of the two corner fronts)
    lathe('flat', [[2.35, 0], [1.9, 0.9], [0.95, 1.4]], 7, { M: C, c: '#cc8f80', noao: true });
    cyl('flat', 1.05, 1.05, 1.9, 6, { M: mul(C, tr(0, 1.35, 0)), c: '#d9c9ae', open: true, noao: true });
    lathe('flat', [[1.35, 0], [0.9, 0.85], [0, 1.65]], 6, { M: mul(C, tr(0, 3.2, 0)), c: '#d29a8c', noao: true });
    if (sg < 0) for (const a of [-PI / 2, 0, PI]) panel('flat', 0.55, 1.15, { M: mul(mul(C, rotY(a)), tr(0, 1.65, 1.04)), c: '#262c34' });
    const run = 6.6, rise = 4.0, ang = Math.atan2(rise, run);
    bx('flat', mul(at(sg * (NW + run / 2), EAVE + 0.7 + rise / 2, z - BAY / 2), new THREE.Matrix4().makeRotationZ(-sg * ang)), -Math.hypot(run, rise) / 2, Math.hypot(run, rise) / 2, -0.3, 0.25, -0.35, 0.35, { c: '#8fa393', noao: true });
  }
  // the transept: as wide as the church, standing up to the foot of the drum, pale pilasters at its corners and a tall window at each end
  const T = [[-16.45, TZ1], [-16.0, TZ0], [16.85, TZ0], [16.85, TZ1]];
  for (let i = 0; i < 4; i++) {
    const a = T[i], b = T[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const M = mul(F, frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, dz / l, -dx / l));
    panel('flat', l, TT - EAVE, { M: mul(M, tr(0, EAVE, 0)), c: '#c9b797' });
    bx('flat', M, -l / 2 - 0.2, l / 2 + 0.2, TT - 0.5, TT + 0.15, -0.3, 0.45, { c: '#ded6c0', noao: true });
    for (const sg of [-1, 1]) bx('flat', M, sg * (l / 2 - 0.9) - 0.4, sg * (l / 2 - 0.9) + 0.4, EAVE, TT - 0.5, -0.1, 0.22, { c: '#d8d3c5', noao: true });
    if (l > 20) continue;
    extrude('flat', archShapeAt(3.0, 5.4), 0.2, { M: mul(M, tr(0, EAVE + 1.1, -0.02)), c: '#ded6c4', noao: true, cs: 4 });
    extrude('flat', archShapeAt(2.3, 4.9), 0.2, { M: mul(M, tr(0, EAVE + 1.4, 0.02)), c: '#262c34', noao: true, cs: 4 });
  }
  prism('tile', T.map(q => { const v = new THREE.Vector3(q[0], 0, q[1]).applyMatrix4(F); return [v.x, v.z]; }), F.elements[13] + TT - 0.05, F.elements[13] + TT + 0.1, { c: '#b8744f' });
  // the bell tower at the south corner on Via Maqueda: a stone shaft, cornices, an open eight sided bell stage on round shafts under a low wooden roof
  const B = at(-11.5, 0, -70.9);
  bx('flat', B, -3.5, 3.5, EAVE, 22.6, -3.5, 3.5, { c: '#bfa882', noao: true });
  for (const [ya, o] of [[17.6, 0.3], [22.2, 0.45]]) bx('flat', B, -3.5 - o, 3.5 + o, ya, ya + 0.5, -3.5 - o, 3.5 + o, { c: '#d8c8a4', noao: true });
  for (let k = 0; k < 4; k++) { const M = mul(B, rotY(k * PI / 2)); for (const [y, wd, ht] of [[14.4, 1.3, 2.4], [18.5, 1.9, 3.1]]) if (k !== 2) extrude('flat', archShapeAt(wd, ht), 0.1, { M: mul(M, tr(0, y, 3.46)), c: '#241d16', noao: true, cs: 3 }); }
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; cyl('flat', 0.3, 0.34, 3.9, 6, { M: mul(B, tr(Math.sin(a) * 2.75, 22.7, Math.cos(a) * 2.75)), c: '#c9ad7e', open: true, noao: true }); }
  cyl('flat', 1.2, 1.2, 3.9, 8, { M: mul(B, tr(0, 22.7, 0)), c: '#3a2e22', open: true, noao: true });
  cyl('flat', 3.35, 3.35, 0.7, 8, { M: mul(B, mul(tr(0, 26.6, 0), rotY(PI / 8))), c: '#cdb68c', noao: true });
  lathe('flat', [[3.5, 0], [0.3, 1.3], [0, 1.5]], 8, { M: mul(B, mul(tr(0, 27.3, 0), rotY(PI / 8))), c: '#6a4a36', noao: true });
}
const archShapeAt = (w, h) => { const r = w / 2, s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, PI, false); s.lineTo(-r, 0); return s; };

function buildTeatini() {
  initShared();
  const pts = pairsOf(TP.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-6, 1)), groundY(...W(6, 1)), groundY(...W(0, 2)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('tbFront', 320, 512, [QW, FH], paintFront);
  defMat('tbMarble', 256, 384, [FW, MH], paintMain);
  defMat('tbBody', 128, 256, [BAY, EAVE], paintFlank);
  defMat('tbNave', 128, 128, [BAY, NAVE_TOP - EAVE], paintNave);
  defMat('tbDome', 128, 128, [1, 1], DOME_PAINT);
  begin(y0);
  // the body: the footprint up to the aisle cornice, cut back behind the two fronts (the corner run on the west follows the arc of the quinto canto)
  const qs = [-6.2, -4.2, -2.1, 0, 2.1, 4.2, 6.2].map(s => { const a = qAt(s); return W(a.p[0] - a.n[0] * 0.35, a.p[1] - a.n[1] * 0.35); });
  const body = clipFront([...pts.slice(0, 10), ...qs, ...pts.slice(13)], -0.2);
  // the bays of the wall texture line up with the pilasters on Via Maqueda (and, below, on the nave)
  const e0 = edgeAt(PILS[0]), uBody = -(e0.x * e0.nz - e0.z * e0.nx) / BAY;
  prism('tbBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [uBody - Math.floor(uBody), -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  const nv = W(-NW, -9 - PILS[0]), uNave = -(nv[0] * e0.nz - nv[1] * e0.nx) / BAY;
  bx('tbNave', F, -NW, NW, EAVE, NAVE_TOP, NZ1, NZ0, { uvo: [uNave - Math.floor(uNave), -(y0 + EAVE) / (NAVE_TOP - EAVE)] });   // (z from the back to the front: bx with the ends swapped makes the box inside out)
  for (const [z0, z1] of [[NZ0, TZ1], [TZ0, NZ1]]) gable('tile', 'tbNave', at(0, 0, (z0 + z1) / 2), NW * 2, z0 - z1, NAVE_TOP, RISE, { ov: 0.35, c: '#9a6a50', wc: '#dcc79e' });
  mainFront(F, at);
  quintoCanto(F);
  cantoBack();
  flank(y0);
  upperWorks(F, at);
  // the drum with paired columns and the majolica dome, lantern and cross over the crossing
  const DC = at(0, TT, DZ), DR = 7.4;
  cyl('flat', DR, DR + 0.2, 5.4, 16, { M: DC, c: '#cdb68a' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI + PI / 8, M = mul(DC, mul(rotY(a), tr(0, 0, DR + 0.15))); bx('flat', M, -0.9, 0.9, 0.5, 4.8, -0.05, 0.25, { c: '#dcc79e', noao: true }); bx('flat', M, -0.5, 0.5, 1.3, 4.1, 0.2, 0.27, { c: '#272c33', noao: true }); }
  lathe('flat', [[DR + 0.55, 5.4], [DR + 0.55, 5.75], [DR - 0.2, 5.85], [DR - 0.2, 5.9]], 16, { M: DC, c: '#d0bd94' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI * 0.5; prof.push([(DR - 0.2) * Math.cos(a), 5.9 + 6.8 * Math.sin(a)]); }
  lathe('tbDome', prof, 16, { M: DC, noao: true, uv: 'keep', uvk: [8, 1] });
  cyl('flat', 1.3, 1.5, 3.2, 8, { M: mul(DC, tr(0, 12.5, 0)), c: '#dcc79e' }); sphere('tbDome', 1.4, { M: mul(DC, tr(0, 16.1, 0)), ky: 1.2, seg: 8, noao: true });
  bx('flat', DC, -0.09, 0.09, 17.2, 19.1, -0.09, 0.09, { c: '#3e3a36', noao: true }); bx('flat', DC, -0.55, 0.55, 18.2, 18.35, -0.09, 0.09, { c: '#3e3a36', noao: true });
  const o = end('Chiesa di San Giuseppe dei Teatini');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[TP.p, null, y0 + EAVE], [ring(-NW, NW, NZ1, NZ0), null, y0 + NAVE_TOP + RISE], [ring(-FW / 2, FW / 2, -1.25, 0), null, y0 + MH], [ring(-16.4, 16.8, TZ0, TZ1), null, y0 + TT],
    [ring(-7.5, 7.5, DZ - 7.5, DZ + 7.5), null, y0 + TT + 12], [ring(-15, -8, -74.4, -67.4), null, y0 + 28.8]];
  return o;
}
export const TEATINI = { name: 'Chiesa di San Giuseppe dei Teatini', x: 20, z: 52, radius: 60, skipIds: [TP.id], build: buildTeatini, walls: TEA_WALLS };
