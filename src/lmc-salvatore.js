// City landmark: the Chiesa del Santissimo Salvatore (Corso Vittorio Emanuele, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w49750035 (a lidar outline whose roof reads 53.9 m, inflated by the neighbours): the baroque front on the Corso, the body behind it, and the low dome on a twelve sided drum.
// Frame F: origin on the ground in the middle of the front wall (the footprint edge facing the Corso, north-north-west), +z out of the front, +x towards the west-south-west (the right hand seen from the Corso).
// Measured from the footprint: the front is 26.3 m wide, the body runs about 33 m back from it, a narrower sacristy tail reaches 43 m.
// Reference photos (Wikimedia Commons, viewed): Chiesa del Santissimo Salvatore (Palermo) - Facciata1.JPG; Chiesa del Santissimo Salvatore (Palermo) - facciata2.JPG; SS.Salvatore facciata.jpg; Santissimo Salvatore (Palermo) 25.jpg; SS PA 15 07 2018 01.jpg.
// Read from them: golden tufa stone dressings with grey stone door frame; a lower order whose centre is a wide plain white plastered panel (a plain rectangular grey stone portal in it, two small diamond studs)
// between two pairs of Corinthian pilasters on tall pedestals, side bays each with a framed window and a niche with a shell under a small window, a deep modillion cornice over the lower order;
// an upper order: wings with a framed window and a balustrade with finials, a central block with a framed window with balcony, three arched windows over a balustrade, shell cartouches, paired pilasters,
// crowned by a segmental (curved) pediment. The drum (seen from behind) is a many sided polygon with big arched openings and white terraces around; the dome plan is a dodecagon with an elliptical dome (it.wikipedia).
// Not verified: the exact pilaster count at the corners, the dome profile (no photo shows it), the number of drum sides beyond what it.wikipedia states, the statues (omitted).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange } from './lmc-kit.js';

const SV = { id: 'w49750035', p: [-239.2, 141.8, -215.7, 129.9, -198.3, 158.3, -204.9, 161.8, -207.4, 163.4, -203.4, 171.7, -213, 175.6, -216.4, 168, -221.1, 166.3, -224.7, 161.2, -229.5, 163.7, -233.3, 155.2] };
const O = [-227.45, 135.85], N = [-0.4518, -0.8921];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const FW = 26.4, FH = 25.0, EAVE = 14.0, DZ = -17.0, DRX = 10.5, DRZ = 13.0, DRUM = 5.2;
const STONE = '#cfab72', DARKGLASS = '#262f3a', WHITE = '#eee8da';

function paintFront(g, w, h) {   // 26.4 m wide, 24 m tall
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  const tri = (x0, x1, y0, ya, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X((x0 + x1) / 2), Y(ya)); g.lineTo(X(x1), Y(y0)); g.closePath(); g.fill(); };
  const shell = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), 0.6 * sx, 0.5 * sy, 0, PI, 0); g.fill(); R(x - 0.25, y - 0.7, x + 0.25, y - 0.1, c); };
  paintAshlar(g, w, h, FW, FH, 0.6, 1.4, '#cba66d', '#a38559', 4601, 1.0, 0.07);
  for (let i = 0; i < 6; i++) { const cx = X(-11 + i * 4.4), cy = Y(4 + (i % 3) * 6), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 5 * sx); gr.addColorStop(0, 'rgba(80,55,30,0.2)'); gr.addColorStop(1, 'rgba(80,55,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  R(-FW / 2, 0, FW / 2, 1.5, '#9d8b6d');                                                           // dark base course
  // lower order: the wide plain white panel in the middle with the grey stone portal and two diamond studs, a white ground in each side bay
  R(-5.6, 1.5, 5.6, 10.0, WHITE); for (const s of [-1, 1]) R(s > 0 ? 7.7 : -12.2, 1.5, s > 0 ? 12.2 : -7.7, 10.0, WHITE);
  R(-2.4, 1.5, 2.4, 7.4, '#8f8a7e'); R(-2.0, 1.5, 2.0, 7.0, '#3b2619'); R(-0.04, 1.5, 0.04, 7.0, '#1d120a'); R(-2.5, 7.0, 2.5, 7.45, '#a7a295');
  for (let yy = 2.0; yy < 6.9; yy += 0.7) R(-1.9, yy, 1.9, yy + 0.04, 'rgba(0,0,0,0.3)');
  for (const s of [-1, 1]) { g.save(); g.translate(X(s * 3.3), Y(7.8)); g.rotate(PI / 4); g.fillStyle = '#4a3d33'; g.fillRect(-0.28 * sx, -0.28 * sx, 0.56 * sx, 0.56 * sx); g.restore(); }
  // the side bays: a framed window with an arched cap low down, a niche with a shell, a small framed window under the cornice
  for (const s of [-1, 1]) {
    const cx = s * 9.9;
    R(cx - 1.0, 3.0, cx + 1.0, 6.0, '#b99362'); R(cx - 0.75, 3.25, cx + 0.75, 5.75, '#2a2e36'); arch(cx, 5.7, 6.7, 2.2, '#b99362');
    R(cx - 1.0, 6.9, cx + 1.0, 8.9, '#b99362'); arch(cx, 7.1, 8.8, 1.5, '#8d7452'); shell(cx, 8.0, '#d9c196');
    R(cx - 0.7, 9.2, cx + 0.7, 9.9, '#b99362'); R(cx - 0.5, 9.35, cx + 0.5, 9.75, '#e0dccc');
  }
  // the paired pilasters (lighter stone, tall pedestals, Corinthian capitals) on both sides of the white panel and at the corners
  const pil = (x, y0, y1) => { R(x - 0.5, y0, x + 0.5, y1, '#d2b07a'); R(x + 0.5, y0, x + 0.64, y1, 'rgba(60,45,30,0.3)'); R(x - 0.5, y0, x - 0.43, y1, 'rgba(255,245,220,0.4)'); R(x - 0.7, y1 - 0.7, x + 0.7, y1, '#c4a06a'); R(x - 0.62, y1 - 0.3, x + 0.62, y1 - 0.2, 'rgba(60,45,30,0.4)'); };
  for (const x of [-7.35, -6.2, 6.2, 7.35, -12.6, 12.6]) { R(x - 0.7, 1.5, x + 0.7, 3.2, '#bb986a'); pil(x, 3.2, 10.0); }
  // the deep cornice over the lower order: an architrave, a frieze with modillions, a heavy projecting top
  R(-FW / 2, 10.0, FW / 2, 11.6, '#cfab72'); R(-FW / 2, 10.0, FW / 2, 10.15, 'rgba(50,35,20,0.5)'); R(-FW / 2, 11.35, FW / 2, 11.6, '#dcbd86');
  for (let x = -13.0; x < 13.0; x += 0.55) { R(x, 10.5, x + 0.28, 11.2, '#a98a58'); R(x, 10.15, x + 0.2, 10.4, 'rgba(50,35,20,0.35)'); }
  // upper order, wings: a framed window each side of the centre, a balustrade
  for (const s of [-1, 1]) {
    const cx = s * 9.6; R(cx - 0.9, 12.2, cx + 0.9, 14.2, '#b99362'); R(cx - 0.65, 12.4, cx + 0.65, 14.0, '#2a2e36');
    R(cx - 3.2, 14.2, cx + 3.2, 14.5, '#cfab72'); R(cx - 3.2, 14.5, cx + 3.2, 15.0, '#b8935f'); for (let x = cx - 3.0; x < cx + 3.1; x += 0.5) R(x, 14.5, x + 0.2, 15.0, '#e2c892');
  }
  // upper order, centre: paired pilasters at each edge, a framed window with a balcony, shell cartouches, three arched windows over a balustrade
  for (const x of [-6.6, -5.55, 5.55, 6.6]) pil(x, 11.6, 19.4);
  R(-1.4, 11.9, 1.4, 15.6, '#b99362'); R(-1.1, 12.2, 1.1, 15.3, '#2a2e36'); R(-0.04, 12.2, 0.04, 15.3, '#6b6a66'); R(-1.6, 15.3, 1.6, 15.6, '#cfab72');
  shell(-3.4, 13.8, '#d9c196'); shell(3.4, 13.8, '#d9c196');
  R(-4.6, 15.6, 4.6, 16.3, '#c9a56b'); for (let x = -4.4; x < 4.5; x += 0.45) R(x, 15.7, x + 0.18, 16.3, '#e2c892');
  for (const x of [-3.0, 0, 3.0]) { arch(x, 16.4, 19.4, 2.1, '#b99362'); arch(x, 16.5, 19.1, 1.6, '#4b3524'); }
  R(-7.6, 19.4, 7.6, 20.4, '#cfab72'); R(-7.6, 19.4, 7.6, 19.55, 'rgba(50,35,20,0.45)');
  // the segmental pediment crowning the centre: a band curving over a pale plastered ground
  g.fillStyle = WHITE; g.beginPath(); g.moveTo(X(-7.0), Y(20.4)); g.quadraticCurveTo(X(0), Y(25.6), X(7.0), Y(20.4)); g.closePath(); g.fill();
  g.strokeStyle = '#cfab72'; g.lineWidth = 0.55 * sx; g.beginPath(); g.moveTo(X(-7.0), Y(20.4)); g.quadraticCurveTo(X(0), Y(25.6), X(7.0), Y(20.4)); g.stroke();
  for (const y of [10.0, 19.4]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.5)); gs.addColorStop(0, 'rgba(30,22,14,0.34)'); gs.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.5 * sy); }
  streaks(g, w, h, 30, 4602, 0.1, 110, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h) {   // a side bay: 4.5 m wide, EAVE m tall; a window under the cornice
  const sx = w / 4.5, sy = h / EAVE, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, EAVE, 0.9, 2.4, '#e4ddc9', '#d9d1bb', 4611, 0.6, 0.03);
  noiseDots(g, w, h, w * h / 120, 2, 4614, ['rgba(120,90,60,0.07)', 'rgba(255,250,235,0.06)']);
  R(0, 0, 4.5, 1.1, '#c2b8a0'); R(0, 0, 0.45, EAVE, 'rgba(255,250,235,0.18)'); R(4.05, 0, 4.5, EAVE, 'rgba(60,45,30,0.14)');
  arch(2.25, 8.4, 12.0, 1.5, '#ece4cf'); arch(2.25, 8.6, 11.8, 1.1, '#16120f'); arch(2.25, 8.6, 11.6, 0.9, DARKGLASS);
  R(0, EAVE - 0.7, 4.5, EAVE, '#e9e1cc'); R(0, EAVE - 1.1, 4.5, EAVE - 0.7, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, 4615, 0.1, 80, '55,48,40');
}
function paintDrum(g, w, h) {   // one facet of the twelve sided drum: 5.4 m wide, DRUM m tall, a tall arched opening, a cornice
  const sx = w / 5.4, sy = h / DRUM, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 5.4, DRUM, 0.6, 1.4, '#cba66d', '#a38559', 4621, 1.0, 0.06);
  R(0, 0, 0.45, DRUM, '#d6b680'); R(4.95, 0, 5.4, DRUM, '#d6b680');
  arch(2.7, 0.7, 4.3, 2.9, '#b99362'); arch(2.7, 0.9, 4.1, 2.3, '#241c16');
  R(0, DRUM - 0.5, 5.4, DRUM, '#dcbd86'); R(0, DRUM - 0.8, 5.4, DRUM - 0.5, 'rgba(40,30,18,0.3)');
}

function buildSalvatore() {
  initShared();
  const pts = pairsOf(SV.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-12, 2)), groundY(...W(12, 2)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('svFront', 512, 512, [FW, FH], paintFront);
  defMat('svWall', 128, 256, [4.5, EAVE], paintWall);
  defMat('svDrum', 192, 128, [5.4, DRUM], paintDrum);
  begin(y0);
  // the body: the whole OSM footprint up to the eaves, a flat roof over it
  prism('svWall', pts, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', pts, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
  // the front: one shape (low wings with a balustrade, the centre rising to a segmental pediment) with the painted front on it
  const s = new THREE.Shape(), hw = FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 15.0); s.lineTo(7.6, 15.0); s.lineTo(7.6, 20.4); s.lineTo(7.0, 20.4);
  s.quadraticCurveTo(0, 25.6, -7.0, 20.4); s.lineTo(-7.6, 20.4); s.lineTo(-7.6, 15.0); s.lineTo(-hw, 15.0); s.lineTo(-hw, 0);
  extrude('svFront', s, 1.4, { M: at(0, 0, -0.9), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // the deep cornice of the lower order and the top of the centre stand out of the front; a finial on each wing end and on each side of the centre
  bx('flat', F, -hw - 0.3, hw + 0.3, 11.2, 11.75, -0.1, 1.0, { c: STONE, noao: true });
  bx('flat', F, -hw - 0.2, hw + 0.2, 9.9, 10.2, -0.1, 0.5, { c: '#cfab72', noao: true });
  bx('flat', F, -7.9, 7.9, 20.3, 20.75, -0.1, 0.8, { c: STONE, noao: true });
  for (const x of [-7.35, -6.2, 6.2, 7.35, -12.6, 12.6]) bx('flat', F, x - 0.58, x + 0.58, 3.2, 10.0, -0.05, 0.28, { c: '#d2b07a', noao: true });
  for (const x of [-7.35, -6.2, 6.2, 7.35, -12.6, 12.6]) bx('flat', F, x - 0.75, x + 0.75, 1.4, 3.2, -0.05, 0.4, { c: '#bb986a', noao: true });
  for (const sg of [-1, 1]) for (const fx of [12.8, 7.9]) { bx('flat', F, sg * fx - 0.3, sg * fx + 0.3, 15.0, 15.6, -0.2, 0.2, { c: '#d6b680' }); sphere('flat', 0.38, { M: at(sg * fx, 16.0, 0), ky: 1.4, seg: 6, c: '#d6b680' }); }
  for (let i = 0; i < 3; i++) bx('stone', F, -2.9 - i * 0.2, 2.9 + i * 0.2, -0.3, 0.16 * (3 - i), 0, 0.35 * (i + 1), { c: '#d8cfb8' });
  // the oval: a drum (a cylinder squashed to an ellipse), the low lead dome on it and the lantern
  const D = at(0, EAVE, DZ), ky = DRZ / DRX;
  const dm = (k) => ({ M: D, s: [1, 1, ky], ...k });
  cyl('svDrum', DRX, DRX, DRUM, 12, { ...dm(), noao: true, uvk: [12, 1] });
  cyl('flat', DRX + 0.45, DRX + 0.45, 0.45, 12, { ...dm({ p: [0, DRUM - 0.1, 0] }), c: '#e9e1cc', noao: true });
  lathe('lead', [[DRX + 0.1, 0], [DRX - 0.4, 0.5], [DRX - 1.8, 1.6], [DRX - 4.2, 2.9], [DRX - 6.6, 3.7], [DRX - 8.5, 4.2], [2.3, 4.6], [2.0, 4.6]], 28, { ...dm({ p: [0, DRUM + 0.2, 0] }), c: '#b8bcb8', noao: true });
  const LY = DRUM + 0.2 + 4.6;
  cyl('svDrum', 2.0, 2.0, 2.8, 12, { M: D, p: [0, LY, 0], noao: true, s: [1, 1, 1], uvk: [3, 1] });
  lathe('lead', [[0, 0], [2.3, 0], [2.0, 0.4], [1.2, 1.1], [0.4, 1.8], [0.12, 2.5], [0, 2.8]], 12, { M: D, p: [0, LY + 2.8, 0], c: '#b8bcb8', noao: true });
  bx('flat', D, -0.08, 0.08, LY + 5.4, LY + 6.6, -0.08, 0.08, { c: '#3e3a36', noao: true });
  bx('flat', D, -0.45, 0.45, LY + 6.0, LY + 6.15, -0.08, 0.08, { c: '#3e3a36', noao: true });
  const o = end('Chiesa del Santissimo Salvatore');
  o.userData.solids = [[SV.p, null, y0 + EAVE]];
  return o;
}
export const SALVATORE = { name: 'Chiesa del Santissimo Salvatore', x: -217, z: 160, radius: 60, skipIds: [SV.id], build: buildSalvatore };
