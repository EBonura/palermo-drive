// City landmarks, batch F: four palazzi and convents of the old centre, drawn from reference photos. Registered through src/landmarks-city.js (BATCH_F).
// Museo Archeologico Regionale Antonio Salinas (r20998804.0), Palazzo Arcivescovile (r403465.0), Monastero di Santa Caterina (r1291574.0), Palazzo Alliata di Villafranca (r20108989.0).
// Each footprint is kept as it is (collision unchanged), walls are skinned edge by edge with a painted bay texture (bays counted along each edge so windows line up with balconies and portals), cloisters get an arcade texture.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions, bay counts and colours read):
// Salinas: Museoarcheosalinas.JPG (the long front on Piazza Olivella: two floors, cream plaster over a honey stone plinth, a heavy stone cornice, honey stone corner quoins, big blue-glazed windows on the upper floor with alternating
//   triangular and segmental pediments, small barred windows in stone frames below, an arched stone portal with a balcony over it, the church of Sant'Ignazio at the right end); Museo Archeologico Salinas 2016.jpg (the cloister: round arches
//   on heavy round columns, an ornamented band, cream plaster over it with framed windows, one pierced Norman style window, a smaller top row).
// Arcivescovile: Palermo, Palazzo Arcivescovile.jpg and Palais archiepiscopal et Notre-Dame de l'Assomption.jpg (a very long front of honey sandstone ashlar, three levels: small windows at the bottom, a row of tall green-shuttered windows with
//   white balustrade balconies on brackets and alternating triangular and segmental pediments, a top row of small framed windows, yellow ochre frames and a yellow band under the cornice, a pointed carved portal, two bishop statues on pedestals
//   behind a low white balustrade, the cathedral towers at one end); Palazzo arcivescovile.JPG (fetched, same front).
// Santa Caterina: Santa Caterina (Palermo).JPG (the church front and the convent wall to its right: ochre plaster, framed barred windows, a heavy cornice, warm weathered stone); Monastero di Santa Caterina, palermo.jpg (the cloister:
//   round arches on plaster, a glazed wooden gallery above with an iron balcony under a tiled eave; grey photo, colours guessed from the church front); Santa Caterina (Palermo) 17 07 2019 10.jpg (inside of the church only, not used).
//   The church itself is not in this batch (it has its own landmark in src/landmarks.js).
// Alliata: Palazzo Alliata di Villafranca (Palermo) 14 07 2019 03.jpg (the portal: a round arch with a fanlight between two free grey columns and two statues in niches, an iron balcony over it with two shuttered windows with curved
//   pediments, a marble plaque, a huge stucco cartouche with the coat of arms, honey stone ashlar quoins, plaster flaking off in large patches, rust and water stains); Palermo piazza Bologni statua Carlo V.jpg (the front on the piazza,
//   four levels, iron balconies on every window row, shuttered windows, heavily weathered plaster).
// Not verified, not drawn: the roofs (hidden behind the cornices, drawn flat), the courtyards of Alliata and Arcivescovile (no photo), the Salinas side facing the church (no photo), the true storey heights (read from window to cornice ratios in the photos).
import * as THREE from 'three';
import { PI, bx, cyl, archBay, prism, panel, begin, end, defMat, mul, tr, frame, groundRange, initShared, noiseDots, streaks, pairsOf, statue, balus, rail, RNG, paintAshlar } from './lmc-kit.js';

// ---------- shared helpers ----------
function pip(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// walls: one panel per edge in front of the extruded body, bays counted along the edge; returns the edge records (F: frame at the edge middle on the ground, +z out of the wall, +x to the right seen from outside)
function skin(key, ring, hole, y0, H, bay, perTile, minLen = 3) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    let nx = dz / len, nz = -dx / len; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (pip([mx + nx * 0.6, mz + nz * 0.6], ring) !== hole) { nx = -nx; nz = -nz; }
    const n = Math.max(1, Math.round(len / bay)), F = frame(mx, y0, mz, nx, nz), e = { i, len, n, bw: len / n, F, nx, nz, mx, mz, hole };
    out.push(e); if (len < minLen) continue;
    panel(key, len, H, { M: mul(F, tr(0, 0, 0.04)), uvk: [n / perTile, 1] });
  }
  return out;
}
const at = (e, x, y, z) => mul(e.F, tr(x, y, z));
// cornice round every edge (projecting), over the whole outline
function cornice(edges, H, h, proj, c, key = 'flat') { for (const e of edges) if (e.len >= 1.5) bx(key, e.F, -e.len / 2 - 0.1, e.len / 2 + 0.1, H - h, H, -0.4, proj, { c, noao: true }); }
const wallTop = (pts, holes, top, c = '#8d8478') => prism('flat', pts, top, top + 0.2, { holes, c });

// painting kit: canvas covers tw x th metres, y up from the foot
function kit(g, w, h, tw, th) {
  const sx = w / tw, sy = h / th, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const seg = (x, y, ww, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x - ww / 2), Y(y)); g.quadraticCurveTo(X(x), Y(y + hh * 2), X(x + ww / 2), Y(y)); g.fill(); };
  const grid = (x0, y0, x1, y1, step, c, lw = 1) => { g.fillStyle = c; for (let x = x0; x <= x1 + 1e-6; x += step) g.fillRect(X(x) - lw / 2, Y(y1), lw, (y1 - y0) * sy); for (let y = y0; y <= y1 + 1e-6; y += step) g.fillRect(X(x0), Y(y) - lw / 2, (x1 - x0) * sx, lw); };
  return { sx, sy, X, Y, R, arch, tri, seg, grid };
}
// soft stains, plaster flaking to the stone underneath, water streaks, dirt at the foot. Run before the windows; wearTop() after them.
function wear(g, w, h, seed, o = {}) {
  const r = RNG(seed), sc = o.stain || '110,85,55';
  for (let i = 0; i < (o.blots ?? 10); i++) { const cx = r() * w, cy = r() * h, rad = (0.08 + r() * 0.18) * w, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, `rgba(${sc},${0.1 + r() * 0.12})`); gr.addColorStop(1, `rgba(${sc},0)`); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad); }
  for (let i = 0; i < (o.patches || 0); i++) {
    const cx = r() * w, cy = h * (o.p0 ?? 0) + r() * h * (o.p1 ?? 1), rad = (0.03 + r() * 0.07) * w; g.globalAlpha = 0.5; g.fillStyle = o.under || '#b59a70'; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = k / 10 * 2 * PI, rr = rad * (0.5 + r() * 0.8), px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr * 0.8; k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fill(); g.globalAlpha = 1; g.strokeStyle = 'rgba(70,50,28,0.18)'; g.lineWidth = 1; g.stroke();
  }
}
function wearTop(g, w, h, seed, o = {}) {
  streaks(g, w, h, o.streaks ?? 22, seed, 0.11, h * 0.22, o.sc || '55,40,26');
  const r = RNG(seed + 1); g.strokeStyle = 'rgba(50,38,26,0.3)'; g.lineWidth = 1;
  for (let i = 0; i < (o.cracks ?? 3); i++) { let x = r() * w, y = r() * h * 0.7; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 12; y += 8 + r() * 14; g.lineTo(x, y); } g.stroke(); }
  const gb = g.createLinearGradient(0, h, 0, h * 0.84); gb.addColorStop(0, 'rgba(32,24,15,0.34)'); gb.addColorStop(1, 'rgba(32,24,15,0)'); g.fillStyle = gb; g.fillRect(0, h * 0.84, w, h * 0.16);
}
const glassGrad = (g, k, x0, y0, x1, y1, a, b) => { const gr = g.createLinearGradient(0, k.Y(y1), 0, k.Y(y0)); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(k.X(x0), k.Y(y1), (x1 - x0) * k.sx, (y1 - y0) * k.sy); };
function sillDrip(g, k, cx, y, ww, seed) { const r = RNG(seed); for (let i = 0; i < 3; i++) { const x = k.X(cx - ww / 2 + r() * ww), gr = g.createLinearGradient(0, k.Y(y), 0, k.Y(y - 2.2)); gr.addColorStop(0, 'rgba(60,45,28,0.3)'); gr.addColorStop(1, 'rgba(60,45,28,0)'); g.fillStyle = gr; g.fillRect(x, k.Y(y), 2 + r() * 3, 2.2 * k.sy); } }
// cloister arcade: round arches on plaster over the lower part, an ornamented string band, then either glazed gallery or framed windows
function paintArcade(g, w, h, tw, th, pal, seed, gallery) {
  const k = kit(g, w, h, tw, th), { R, arch } = k;
  g.fillStyle = pal.wall; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 1.6, seed, ['rgba(140,105,65,0.09)', 'rgba(255,248,225,0.1)']);
  wear(g, w, h, seed + 1, { blots: 8, patches: 2, p0: 0.3, p1: 0.4, under: pal.under });
  const cx = tw / 2, aw = tw - 0.9;
  arch(cx, 0, 5.15, aw + 0.5, pal.stone); arch(cx, 0, 4.85, aw, '#2a2420');
  const gd = g.createLinearGradient(0, k.Y(4.8), 0, k.Y(0)); gd.addColorStop(0, 'rgba(120,100,70,0)'); gd.addColorStop(1, 'rgba(150,130,95,0.35)'); g.fillStyle = gd; g.fillRect(k.X(cx - aw / 2), k.Y(4.8), aw * k.sx, 4.8 * k.sy);
  R(0, 0, 0.45, 5.2, pal.stone); R(tw - 0.45, 0, tw, 5.2, pal.stone); R(0, 3.3, 0.6, 3.6, '#e4d4b0'); R(tw - 0.6, 3.3, tw, 3.6, '#e4d4b0'); R(0, 0, tw, 0.35, pal.under);
  R(0, 5.3, tw, 6.1, pal.stone); for (let x = 0.25; x < tw; x += 0.5) R(x, 5.45, x + 0.28, 5.95, 'rgba(70,50,28,0.3)'); R(0, 5.28, tw, 5.36, 'rgba(40,28,16,0.45)');
  const up = th - 6.1;
  if (gallery) { const y1 = 6.8 + up * 0.55; R(0.15, 7.1, tw - 0.15, y1, '#6a5a44'); R(0.3, 7.25, tw - 0.3, y1 - 0.15, '#2b333c'); glassGrad(g, k, 0.3, 7.25, tw - 0.3, y1 - 0.15, 'rgba(170,190,210,0.4)', 'rgba(170,190,210,0.05)'); k.grid(0.3, 7.25, tw - 0.3, y1 - 0.15, 0.7, 'rgba(95,78,55,0.85)', 2); R(0, 6.1, tw, 7.1, '#2b2622'); for (let x = 0.2; x < tw; x += 0.3) R(x, 6.15, x + 0.08, 7.05, '#161412'); R(0, y1, tw, y1 + 0.3, pal.stone); }
  else { R(cx - 0.75, 7.0, cx + 0.75, 10.2, pal.trim); R(cx - 0.52, 7.25, cx + 0.52, 9.95, '#242c36'); R(cx - 0.03, 7.25, cx + 0.03, 9.95, '#8a8070'); R(cx - 0.9, 6.85, cx + 0.9, 7.0, pal.stone); R(cx - 0.4, 11.4, cx + 0.4, 12.5 + (th - 14) * 0.4, '#2b2f36'); R(cx - 0.55, 11.3, cx + 0.55, 11.4, pal.trim); }
  R(0, th - 1.2, tw, th, pal.stone); R(0, th - 1.25, tw, th - 1.2, 'rgba(40,28,16,0.5)');
  wearTop(g, w, h, seed + 2, { streaks: 14 });
}

// ---------- the body, shared by the four ----------
function body(P, key, y0, H, lo) {
  const pts = pairsOf(P.p), holes = (P.holes || []).map(pairsOf);
  prism(key, pts, lo, y0 + H, { holes, uvo: [0, -y0 / H] }); wallTop(pts, holes, y0 + H);
  return { pts, holes };
}
function skins(key, ring, holes, y0, H, bay, per) { return { outer: skin(key, ring, false, y0, H, bay, per), inner: holes.map(h => skin(key, h, true, y0, H, bay, per)) }; }

// ===================================================================================================
// 1. Museo Archeologico Regionale Antonio Salinas
// ===================================================================================================
const SA = { id: 'r20998804.0', p: [-91, -574.6, 1.5, -598.5, 8.8, -558.6, -19, -550.9, -22, -562.5, -43.3, -557, -83.6, -546.5, -85.1, -552.3], holes: [[-69.6, -572.3, -81.9, -568.8, -77.7, -554.3, -65.4, -557.8], [-58.8, -574, -55.4, -561.7, -25.3, -569.7, -28.6, -582]] };
const SAH = 14, SAB = 5.5;
const HONEY = '#cdb184';
function paintSalWall(g, w, h) {
  const k = kit(g, w, h, 11, SAH), { R, tri, seg } = k;
  g.fillStyle = '#e8d9ba'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 1.8, 9101, ['rgba(150,115,70,0.08)', 'rgba(255,248,225,0.1)']);
  wear(g, w, h, 9102, { blots: 7, patches: 0 });
  R(0, 0, 11, 0.95, '#b79b6e'); R(0, 0.95, 11, 1.05, 'rgba(50,35,20,0.35)'); R(0, 5.4, 11, 5.58, '#cdb58a');
  for (let b = 0; b < 2; b++) {
    const cx = 2.75 + 5.5 * b;
    R(cx - 0.8, 1.9, cx + 0.8, 3.7, HONEY); R(cx - 0.55, 2.1, cx + 0.55, 3.5, '#1d1d20'); k.grid(cx - 0.55, 2.1, cx + 0.55, 3.5, 0.28, '#55524c', 1.5);
    R(cx - 0.95, 6.2, cx + 0.95, 9.6, HONEY); R(cx - 0.68, 6.45, cx + 0.68, 9.35, '#34506f'); glassGrad(g, k, cx - 0.68, 6.45, cx + 0.68, 9.35, 'rgba(180,205,230,0.5)', 'rgba(180,205,230,0.06)');
    R(cx - 0.03, 6.45, cx + 0.03, 9.35, '#1a2433'); R(cx - 0.68, 8.0, cx + 0.68, 8.05, '#1a2433');
    if (b === 0) tri(cx - 1.25, cx + 1.25, 9.6, 0.85, HONEY); else seg(cx, 9.6, 2.5, 0.75, HONEY);
    R(cx - 1.15, 5.95, cx + 1.15, 6.2, HONEY); R(cx - 1.15, 5.88, cx + 1.15, 5.95, 'rgba(40,28,16,0.4)'); sillDrip(g, k, cx, 5.9, 2, 9110 + b);
  }
  R(0, SAH - 1.5, 11, SAH, '#cbb086'); R(0, SAH - 1.55, 11, SAH - 1.5, 'rgba(40,28,16,0.55)'); for (let x = 0.2; x < 11; x += 0.6) R(x, SAH - 1.3, x + 0.3, SAH - 0.8, 'rgba(70,50,28,0.22)');
  const gs = g.createLinearGradient(0, k.Y(SAH - 1.5), 0, k.Y(SAH - 3.2)); gs.addColorStop(0, 'rgba(60,42,24,0.3)'); gs.addColorStop(1, 'rgba(60,42,24,0)'); g.fillStyle = gs; g.fillRect(0, k.Y(SAH - 1.5), w, 1.7 * k.sy);
  wearTop(g, w, h, 9120, {});
}
const SAL_PAL = { wall: '#e6d6b4', stone: '#c8ab7c', trim: '#dcc79e', under: '#b79d72' };
function buildSalinas() {
  initShared();
  const pts = pairsOf(SA.p), gr = groundRange(pts), y0 = gr.lo + 0.2;
  defMat('bfSalWall', 384, 384, [11, SAH], paintSalWall);
  defMat('bfSalClo', 192, 384, [3.6, SAH], (g, w, h) => paintArcade(g, w, h, 3.6, SAH, SAL_PAL, 9201, false));
  begin(y0);
  const { holes } = body(SA, 'bfSalWall', y0, SAH, Math.min(gr.lo, y0) - 1.5);
  const sk = skins('bfSalWall', pts, holes, y0, SAH, 5.5, 2);
  cornice(sk.outer, SAH, 0.9, 0.6, '#cdb48a');
  // the cloister walls are skinned again with the arcade texture on top of the plain skin
  for (const h of holes) { const ed = skin('bfSalClo', h, true, y0, SAH, 3.6, 1); cornice(ed, SAH, 0.7, 0.35, '#c8ab7c'); }
  // the front on Piazza Olivella: the two long runs 4 and 5 of the outline (22.0 and 41.6 m, facing the church end), portal in the 12th bay from the west
  const e4 = sk.outer[4], e5 = sk.outer[5];
  const px = -e4.len / 2 + e4.bw / 2;
  archBay('stone', 3.4, 5.3, 1.75, 3.7, 0.7, { M: at(e4, px, 0, 0), c: '#f0dcb0' });
  panel('dark', 1.75, 3.8, { M: at(e4, px, 0, 0.12) , c: '#17120e' });
  bx('flat', e4.F, px - 1.9, px + 1.9, 5.2, 5.5, -0.1, 1.1, { c: '#cdb48a', noao: true }); balus(at(e4, px, 5.5, 1.0), 3.6, 0.9, {});
  bx('flat', e4.F, px - 1.05, px + 1.05, 4.1, 4.5, 0.2, 0.75, { c: '#cdb48a', noao: true }); bx('flat', e4.F, px - 1.0, px + 1.0, 4.2, 4.4, 0.75, 0.78, { c: '#e8e0c8', noao: true });
  // honey stone corner quoins at the west end of the front, tall and heavy
  bx('stone', e5.F, -e5.len / 2, -e5.len / 2 + 2.5, 0, SAH, -0.1, 0.35, { c: '#e6c590', noao: true });
  bx('stone', e5.F, -e5.len / 2, -e5.len / 2 + 2.5, 0, 1.1, -0.1, 0.5, { c: '#b9996a', noao: true });
  const o = end('Museo Archeologico Regionale Antonio Salinas');
  o.userData.solids = [[SA.p, null, y0 + SAH + 0.4]];
  return o;
}
export const SALINAS = { name: 'Museo Archeologico Regionale Antonio Salinas', x: -41, z: -572, radius: 75, skipIds: [SA.id], build: buildSalinas };

// ===================================================================================================
// 2. Palazzo Arcivescovile
// ===================================================================================================
const AR = { id: 'r403465.0', p: [-538.8, 150.2, -519.9, 178.5, -519.3, 179.5, -515.4, 184.9, -511.2, 191.5, -492.3, 219.6, -472.9, 248.5, -488.7, 256.7, -523.3, 274.3, -536.7, 281.2, -558.4, 292.3, -565.2, 295.8, -580.8, 303.8, -596, 271.2, -572, 258.1, -554.9, 248.9, -557.1, 244.8, -550.9, 241.5, -553.8, 236, -547.6, 232.7, -542.3, 242.7, -547.6, 245.5, -535.5, 268.3, -528.4, 264.6, -522.9, 261.4, -529.1, 250, -532.4, 245.1, -531.4, 244.3, -546, 222.3, -543.9, 220.7, -545.2, 218.9, -539.2, 214.4, -540.4, 212.6, -530.1, 205.6, -531.6, 203, -524.6, 198.3, -529.7, 190.7, -523.9, 186.9, -525.9, 184, -526.7, 182.9, -538.2, 190.5, -547, 179.1, -552.9, 171.3],
  holes: [[-535.4, 217.8, -516.7, 204.4, -490.1, 244.4, -510.7, 255.4], [-578.9, 275.1, -573.8, 285.1, -562.8, 279.2, -567.8, 269.1], [-534.6, 180.5, -544.6, 167.6, -538.5, 163.5, -529.3, 176.7]] };
const ARH = 16;
const YEL = '#d9a640', GRN = '#4d6556';
function paintArWall(g, w, h) {
  const k = kit(g, w, h, 11.2, ARH), { R, tri, seg } = k;
  paintAshlar(g, w, h, 11.2, ARH, 0.62, 1.5, '#c9ab78', '#9a8358', 9301, 1.5, 0.09);
  wear(g, w, h, 9302, { blots: 14, stain: '90,66,38', patches: 0 });
  for (let i = 0; i < 6; i++) { const r = RNG(9310 + i), cx = r() * w, cy = r() * h, rad = (0.06 + r() * 0.1) * w, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, 'rgba(240,215,160,0.2)'); gr.addColorStop(1, 'rgba(240,215,160,0)'); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad); }
  R(0, 0, 11.2, 0.8, '#a88f62');
  for (let b = 0; b < 2; b++) {
    const cx = 2.8 + 5.6 * b;
    // ground: a small barred window in a yellow frame
    R(cx - 0.6, 2.5, cx + 0.6, 4.1, YEL); R(cx - 0.42, 2.7, cx + 0.42, 3.9, '#202225'); R(cx - 0.02, 2.7, cx + 0.02, 3.9, '#8a8478');
    // the tall window with shutters, frame, pediment
    R(cx - 0.92, 6.7, cx + 0.92, 10.5, YEL); R(cx - 0.66, 6.95, cx + 0.66, 10.25, GRN);
    for (let y = 7.1; y < 10.2; y += 0.2) R(cx - 0.66, y, cx + 0.66, y + 0.05, 'rgba(0,0,0,0.3)'); R(cx - 0.02, 6.95, cx + 0.02, 10.25, 'rgba(0,0,0,0.5)');
    if (b === 0) { seg(cx, 10.5, 2.3, 0.75, YEL); R(cx - 0.3, 11.1, cx + 0.3, 11.5, '#d8d0bc'); } else { tri(cx - 1.25, cx + 1.25, 10.5, 0.9, YEL); tri(cx - 0.8, cx + 0.8, 10.6, 0.55, '#a88f62'); }
    sillDrip(g, k, cx, 6.5, 1.8, 9320 + b);
    // top row: small framed window
    R(cx - 0.62, 12.6, cx + 0.62, 14.4, YEL); R(cx - 0.44, 12.8, cx + 0.44, 14.2, '#25282c'); R(cx - 0.02, 12.8, cx + 0.02, 14.2, '#9a9488'); sillDrip(g, k, cx, 12.55, 1.2, 9325 + b);
  }
  R(0, 14.9, 11.2, 15.9, '#e2b64e'); R(0, 14.85, 11.2, 14.9, 'rgba(40,28,16,0.45)'); R(0, 15.9, 11.2, ARH, '#c9ab78');
  R(5.55, 0, 5.67, ARH - 1, '#4b4540');   // a down pipe between the bays
  wearTop(g, w, h, 9330, { streaks: 26, sc: '45,32,20' });
}
function buildArciv() {
  initShared();
  const pts = pairsOf(AR.p), gr = groundRange(pts), y0 = gr.lo + 0.2;
  defMat('bfArcWall', 384, 384, [11.2, ARH], paintArWall);
  begin(y0);
  const { holes } = body(AR, 'bfArcWall', y0, ARH, Math.min(gr.lo, y0) - 1.5);
  const sk = skins('bfArcWall', pts, holes, y0, ARH, 5.6, 2);
  cornice(sk.outer, ARH, 0.9, 0.7, '#d4b57a'); for (const e of sk.inner) cornice(e, ARH, 0.9, 0.5, '#d4b57a');
  // balconies on the long front (runs 0, 2 to 5): a white slab on brackets and a balustrade under each tall window
  for (const i of [0, 2, 3, 4, 5]) {
    const e = sk.outer[i]; if (e.len < 3) continue;
    for (let b = 0; b < e.n; b++) {
      const cx = -e.len / 2 + e.bw * (b + 0.5);
      if (i === 3) continue;   // the portal run carries the portal instead
      bx('stone', e.F, cx - 1.15, cx + 1.15, 6.1, 6.4, 0, 1.0, { c: '#e6dfcc', noao: true });
      for (const s of [-0.9, 0.9]) bx('stone', e.F, cx + s - 0.1, cx + s + 0.1, 5.5, 6.1, 0.1, 0.75, { c: '#d8d0bc', noao: true });
      balus(at(e, cx, 6.4, 0.94), 2.3, 0.9, {});
    }
  }
  // the pointed carved portal on the short run 3, two bishop statues on pedestals behind a low balustrade to its left
  const e3 = sk.outer[3];
  archBay('stone', 4.8, 6.2, 2.6, 4.3, 0.7, { M: at(e3, 0, 0, 0), pointed: true, c: '#e8d3a0' });
  panel('dark', 2.6, 4.9, { M: at(e3, 0, 0, 0.14) , c: '#17120e' });
  const bal = (x) => at(e3, x, 0, 3.1);
  balus(mul(bal(-4), tr(0, 0, 0)), 10, 0.95, {});   // a stretch of low white balustrade in front of the portal side
  for (const x of [-8.5, -15.5]) { bx('stone', e3.F, x - 0.9, x + 0.9, 0, 2.2, 2.2, 4.0, { c: '#e0dccc', noao: true }); bx('stone', e3.F, x - 1.1, x + 1.1, 2.2, 2.45, 2.0, 4.2, { c: '#e6e2d4', noao: true }); statue('flat', at(e3, x, 2.45, 3.1), 3.4, { c: '#ece8dc' }); }
  for (const x of [-4, 6]) bx('stone', e3.F, x - 0.35, x + 0.35, 0, 1.2, 2.8, 3.4, { c: '#e0dccc', noao: true });
  const o = end('Palazzo Arcivescovile');
  o.userData.solids = [[AR.p, null, y0 + ARH + 0.9]];
  return o;
}
export const ARCIVESCOVILE = { name: 'Palazzo Arcivescovile', x: -534, z: 227, radius: 110, skipIds: [AR.id], build: buildArciv };

// ===================================================================================================
// 3. Monastero di Santa Caterina
// ===================================================================================================
const SC = { id: 'r1291574.0', p: [158.6, -25.1, 159.1, -16.2, 122.4, 1, 134.4, 41.9, 130.8, 43.3, 133.4, 53.4, 178.9, 41.8, 179.6, 16.7, 178.4, 1.1, 176.1, 1.2, 174.2, -26.6], holes: [[131.3, 15.6, 156.5, 4.3, 159.9, 32.6, 138.5, 38.8]] };
const SCH = 15;
function paintScWall(g, w, h) {
  const k = kit(g, w, h, 10.4, SCH), { R } = k;
  g.fillStyle = '#dcc59b'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 55, 1.8, 9401, ['rgba(150,110,65,0.09)', 'rgba(255,245,215,0.1)']);
  wear(g, w, h, 9402, { blots: 11, stain: '105,78,45', patches: 4, p0: 0.2, p1: 0.6, under: '#bd9f70' });
  // the foot: rusticated warm stone up to the string course
  const hs = Math.round(h * 5.2 / SCH);
  g.save(); g.beginPath(); g.rect(0, h - hs, w, hs); g.clip(); paintAshlar(g, w, h, 10.4, SCH, 0.7, 1.6, '#c6a672', '#8f7650', 9403, 1.4, 0.09); g.restore();
  g.fillStyle = 'rgba(0,0,0,0)'; R(0, 5.1, 10.4, 5.32, '#d3b784'); R(0, 5.05, 10.4, 5.1, 'rgba(40,28,16,0.45)');
  for (let b = 0; b < 2; b++) {
    const cx = 2.6 + 5.2 * b;
    R(cx - 0.7, 2.3, cx + 0.7, 4.0, '#d3b784'); R(cx - 0.5, 2.5, cx + 0.5, 3.8, '#1f1f22'); k.grid(cx - 0.5, 2.5, cx + 0.5, 3.8, 0.25, '#58544c', 1.5);
    for (const [y0, y1] of [[6.5, 9.4], [10.3, 13.0]]) { R(cx - 0.82, y0, cx + 0.82, y1, '#e8d8b6'); R(cx - 0.62, y0 + 0.2, cx + 0.62, y1 - 0.2, b === 0 ? '#3f2f22' : '#22282f'); R(cx - 0.02, y0 + 0.2, cx + 0.02, y1 - 0.2, 'rgba(0,0,0,0.5)'); if (b === 1) glassGrad(g, k, cx - 0.62, y0 + 0.2, cx + 0.62, y1 - 0.2, 'rgba(170,190,215,0.35)', 'rgba(170,190,215,0.04)'); else for (let y = y0 + 0.4; y < y1 - 0.2; y += 0.22) R(cx - 0.62, y, cx + 0.62, y + 0.05, 'rgba(0,0,0,0.3)'); R(cx - 0.95, y0 - 0.2, cx + 0.95, y0, '#d3b784'); sillDrip(g, k, cx, y0 - 0.25, 1.6, 9410 + b + y0); }
  }
  R(0, SCH - 1.35, 10.4, SCH, '#cdb07c'); R(0, SCH - 1.4, 10.4, SCH - 1.35, 'rgba(40,28,16,0.55)');
  wearTop(g, w, h, 9420, { streaks: 24 });
}
const SC_PAL = { wall: '#dac39a', stone: '#c9ac78', trim: '#e6d6b0', under: '#b99c6c' };
function buildSantaCaterina() {
  initShared();
  const pts = pairsOf(SC.p), gr = groundRange(pts), y0 = gr.lo + 0.2;
  defMat('bfCatWall', 384, 384, [10.4, SCH], paintScWall);
  defMat('bfCatClo', 192, 384, [3.6, SCH], (g, w, h) => paintArcade(g, w, h, 3.6, SCH, SC_PAL, 9501, true));
  begin(y0);
  const { holes } = body(SC, 'bfCatWall', y0, SCH, Math.min(gr.lo, y0) - 1.5);
  const sk = skins('bfCatWall', pts, holes, y0, SCH, 5.2, 2);
  cornice(sk.outer, SCH, 1.0, 0.65, '#cdb07c');
  for (const h of holes) { const ed = skin('bfCatClo', h, true, y0, SCH, 3.6, 1); cornice(ed, SCH, 0.7, 0.4, '#c9ac78'); }
  // the convent door on the front (run 5, towards the church piazza): a stone portal with a segmental pediment, a heavy door
  const e5 = sk.outer[5], px = 0;
  archBay('stone', 3.2, 4.8, 1.7, 3.5, 0.6, { M: at(e5, px, 0, 0), c: '#f0dcb0' });
  panel('dark', 1.7, 3.6, { M: at(e5, px, 0, 0.12) , c: '#17120e' });
  bx('flat', e5.F, px - 1.8, px + 1.8, 4.8, 5.1, -0.1, 0.8, { c: '#d3b784', noao: true });
  for (const x of [0, 8]) bx('stone', e5.F, e5.len / 2 - 3 - x - 1, e5.len / 2 - 3 - x, 0, 1.0, 0.2, 0.8, { c: '#b69a6c', noao: true });
  const o = end('Monastero di Santa Caterina');
  o.userData.solids = [[SC.p, null, y0 + SCH + 0.65]];
  return o;
}
export const MONASTERO_SC = { name: 'Monastero di Santa Caterina', x: 151, z: 13, radius: 60, skipIds: [SC.id], build: buildSantaCaterina };

// ===================================================================================================
// 4. Palazzo Alliata di Villafranca
// ===================================================================================================
const AL = { id: 'r20108989.0', p: [-87, 147.3, -84.5, 151.8, -88.3, 156.2, -89.8, 157.9, -100.5, 167.3, -105.7, 160.3, -113.2, 147.2, -110.9, 141.9, -117.3, 130.2, -123.8, 127.8, -124.3, 126.9, -132.7, 111.6, -121.3, 105.4, -122.1, 104, -118.9, 102.3, -117.5, 104.7, -111.4, 101.6, -110.7, 102.9, -95.6, 131.6],
  holes: [[-119.9, 121.3, -115.7, 119.1, -119.1, 112.2, -123.6, 114.6], [-102.2, 158, -94.5, 154.1, -95.8, 152.1, -99, 146.6, -106.4, 150.6]] };
const ALH = 18;
const STONE_AL = '#bf9f6c', PLASTER_AL = '#d9c9a5';
function paintAlWall(g, w, h) {
  const k = kit(g, w, h, 10, ALH), { R, tri, seg } = k;
  paintAshlar(g, w, h, 10, ALH, 0.65, 1.5, STONE_AL, '#8c7551', 9601, 1.4, 0.09);
  // plaster over the upper storeys, flaking off in large patches to the honey stone
  const py = Math.round(h * (1 - 5.2 / ALH)); g.fillStyle = PLASTER_AL; g.fillRect(0, 0, w, py); noiseDots(g, w, h, w * h / 70, 1.8, 9602, ['rgba(140,105,60,0.1)', 'rgba(255,248,230,0.12)']);
  wear(g, w, h, 9603, { blots: 14, stain: '100,76,44', patches: 0 });
  const r = RNG(9604);
  for (let i = 0; i < 9; i++) {   // flaked patches: stone showing through
    const cx = r() * w, cy = r() * py, rad = (0.05 + r() * 0.09) * w; g.beginPath();
    for (let q = 0; q < 12; q++) { const a = q / 12 * 2 * PI, rr = rad * (0.5 + r() * 0.9), px2 = cx + Math.cos(a) * rr * 1.2, py2 = cy + Math.sin(a) * rr * 0.9; q ? g.lineTo(px2, py2) : g.moveTo(px2, py2); }
    g.closePath(); g.fillStyle = 'rgba(190,158,108,0.85)'; g.fill(); g.strokeStyle = 'rgba(80,58,32,0.45)'; g.lineWidth = 1.2; g.stroke();
  }
  R(0, 0, 10, 0.9, '#a08462');
  for (let b = 0; b < 2; b++) {
    const cx = 2.5 + 5 * b;
    R(cx - 0.6, 1.9, cx + 0.6, 3.6, '#c9ab78'); R(cx - 0.42, 2.1, cx + 0.42, 3.4, '#1f1d1b'); k.grid(cx - 0.42, 2.1, cx + 0.42, 3.4, 0.22, '#5a5248', 1.5);
    for (const [y0, y1, sh] of [[6.5, 10.0, '#5a4533'], [10.9, 13.9, '#4c3b2c'], [14.7, 17.1, '#574433']]) {
      R(cx - 0.95, y0 - 0.1, cx + 0.95, y1 + 0.15, '#cbae7e'); R(cx - 0.72, y0, cx + 0.72, y1, sh); for (let y = y0 + 0.2; y < y1; y += 0.2) R(cx - 0.72, y, cx + 0.72, y + 0.05, 'rgba(0,0,0,0.28)'); R(cx - 0.02, y0, cx + 0.02, y1, 'rgba(0,0,0,0.5)');
      if (y0 < 7) { if (b === 0) seg(cx, y1 + 0.15, 2.5, 0.8, '#cbae7e'); else tri(cx - 1.3, cx + 1.3, y1 + 0.15, 0.85, '#cbae7e'); }
      sillDrip(g, k, cx, y0 - 0.15, 1.6, 9610 + b + y0);
    }
  }
  R(0, ALH - 1.2, 10, ALH, '#c8ab78'); R(0, ALH - 1.25, 10, ALH - 1.2, 'rgba(40,28,16,0.55)');
  wearTop(g, w, h, 9620, { streaks: 30, sc: '70,45,25', cracks: 5 });
  g.fillStyle = 'rgba(130,70,30,0.08)'; for (let i = 0; i < 6; i++) g.fillRect(r() * w, r() * h * 0.7, 3, 25 + r() * 40);   // rust runs
}
function paintAlCenter(g, w, h) {
  const TW = 10.8, k = kit(g, w, h, TW, ALH), { R, arch, tri, seg } = k, cx = TW / 2;
  paintAshlar(g, w, h, TW, ALH, 0.65, 1.5, STONE_AL, '#8c7551', 9701, 1.4, 0.09);
  const py = Math.round(h * (1 - 5.4 / ALH)); g.fillStyle = PLASTER_AL; g.fillRect(0, 0, w, py); noiseDots(g, w, h, w * h / 70, 1.8, 9702, ['rgba(140,105,60,0.1)', 'rgba(255,248,230,0.12)']);
  wear(g, w, h, 9703, { blots: 12, stain: '100,76,44', patches: 0 });
  const r = RNG(9704);
  for (let i = 0; i < 8; i++) { const x0 = r() * w, y0 = r() * py, rad = (0.05 + r() * 0.08) * w; g.beginPath(); for (let q = 0; q < 12; q++) { const a = q / 12 * 2 * PI, rr = rad * (0.5 + r() * 0.9), px2 = x0 + Math.cos(a) * rr * 1.2, py2 = y0 + Math.sin(a) * rr * 0.9; q ? g.lineTo(px2, py2) : g.moveTo(px2, py2); } g.closePath(); g.fillStyle = 'rgba(190,158,108,0.85)'; g.fill(); g.strokeStyle = 'rgba(80,58,32,0.45)'; g.stroke(); }
  // the portal: pale pilasters, a round arch with a fanlight, dark passage behind, two niches
  R(cx - 4.2, 0, cx + 4.2, 5.4, '#b8a07a'); R(cx - 4.2, 0, cx - 3.9, 5.4, 'rgba(255,240,200,0.25)');
  arch(cx, 0, 4.9, 3.9, '#a89066'); arch(cx, 0, 4.6, 3.4, '#1d1813'); arch(cx, 2.9, 4.6, 3.4, '#33281c'); for (let a = 0; a < 9; a++) { g.strokeStyle = 'rgba(190,160,110,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(k.X(cx), k.Y(2.9)); g.lineTo(k.X(cx + Math.cos(PI * a / 8) * 1.7), k.Y(2.9 + Math.sin(PI * a / 8) * 1.7)); g.stroke(); }
  for (const s of [-1, 1]) { arch(cx + s * 3.5, 1.2, 4.2, 1.1, '#6d5e48'); }
  // the iron balcony floor line and the two shuttered doors with curved pediments around the plaque
  R(cx - 4.6, 5.4, cx + 4.6, 5.75, '#a89066');
  for (const s of [-1, 1]) { const x = cx + s * 3.0; R(x - 1.05, 6.4, x + 1.05, 10.5, '#cbae7e'); R(x - 0.82, 6.6, x + 0.82, 10.3, '#5a4533'); for (let y = 6.8; y < 10.3; y += 0.2) R(x - 0.82, y, x + 0.82, y + 0.05, 'rgba(0,0,0,0.3)'); R(x - 0.02, 6.6, x + 0.02, 10.3, 'rgba(0,0,0,0.5)'); seg(x, 10.5, 2.4, 1.0, '#cbae7e'); }
  R(cx - 0.9, 6.9, cx + 0.9, 10.0, '#e8e4d8'); for (let y = 9.6; y > 7.4; y -= 0.34) R(cx - 0.65, y, cx + 0.65, y + 0.07, 'rgba(60,60,60,0.5)'); R(cx - 0.95, 10.0, cx + 0.95, 10.1, '#bdb6a0');
  // the stucco cartouche with the arms
  g.fillStyle = '#cdb88e'; g.beginPath(); g.moveTo(k.X(cx - 1.9), k.Y(12.3)); g.quadraticCurveTo(k.X(cx - 2.2), k.Y(16.9), k.X(cx), k.Y(17.1)); g.quadraticCurveTo(k.X(cx + 2.2), k.Y(16.9), k.X(cx + 1.9), k.Y(12.3)); g.quadraticCurveTo(k.X(cx), k.Y(11.4), k.X(cx - 1.9), k.Y(12.3)); g.fill();
  g.fillStyle = '#ece3cc'; g.beginPath(); g.ellipse(k.X(cx), k.Y(14.6), 1.1 * k.sx, 1.7 * k.sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#b7a583'; g.beginPath(); g.ellipse(k.X(cx), k.Y(14.4), 0.65 * k.sx, 1.0 * k.sy, 0, 0, 2 * PI); g.fill(); R(cx - 0.45, 16.3, cx + 0.45, 16.9, '#8d8068');
  R(0, ALH - 1.2, TW, ALH, '#c8ab78'); R(0, ALH - 1.25, TW, ALH - 1.2, 'rgba(40,28,16,0.55)');
  wearTop(g, w, h, 9720, { streaks: 28, sc: '70,45,25', cracks: 4 });
}
function buildAlliata() {
  initShared();
  const pts = pairsOf(AL.p), gr = groundRange(pts), y0 = gr.lo + 0.2;
  defMat('bfAliWall', 384, 384, [10, ALH], paintAlWall);
  defMat('bfAliMid', 384, 384, [10.8, ALH], paintAlCenter);
  begin(y0);
  const { holes } = body(AL, 'bfAliWall', y0, ALH, Math.min(gr.lo, y0) - 1.5);
  const sk = skins('bfAliWall', pts, holes, y0, ALH, 5.0, 2);
  cornice(sk.outer, ALH, 1.0, 0.75, '#c8ab78'); for (const e of sk.inner) cornice(e, ALH, 1.0, 0.5, '#c8ab78');
  // iron balconies under the shuttered windows of the front (runs 17 and 18; the first two storeys above the street)
  for (const i of [17, 18]) {
    const e = sk.outer[i];
    for (let b = 0; b < e.n; b++) {
      const cx = -e.len / 2 + e.bw * (b + 0.5); if (i === 17 && Math.abs(cx) < e.bw * 1.05) continue;   // the middle two bays of run 17 are the portal
      for (const yb of [6.1, 10.5, 14.3]) { bx('stone', e.F, cx - 1.2, cx + 1.2, yb, yb + 0.22, 0, 0.9, { c: '#c4b08a', noao: true }); rail(at(e, cx, yb + 0.22, 0.86), 2.4, 0.95, {}); }
    }
  }
  // the central portal on run 17: painted composition on two bays, two free columns, the balcony over them, two statues
  const e = sk.outer[17], bw = e.bw;
  panel('bfAliMid', bw * 2, ALH, { M: at(e, 0, 0, 0.07), uvk: [1, 1] });
  for (const s of [-1, 1]) { cyl('flat', 0.3, 0.34, 4.5, 10, { M: at(e, s * 2.45, 0.35, 0.75), c: '#a9a396' }); bx('stone', e.F, s * 2.45 - 0.5, s * 2.45 + 0.5, 0, 0.35, 0.3, 1.2, { c: '#b8ab92', noao: true }); bx('stone', e.F, s * 2.45 - 0.5, s * 2.45 + 0.5, 4.85, 5.2, 0.3, 1.2, { c: '#b8ab92', noao: true }); statue('flat', at(e, s * 3.5, 0.9, 0.35), 2.4, { c: '#cfc6b0' }); bx('stone', e.F, s * 3.5 - 0.35, s * 3.5 + 0.35, 0, 0.9, 0.1, 0.6, { c: '#b8ab92', noao: true }); }
  bx('stone', e.F, -3.6, 3.6, 5.2, 5.85, 0, 1.3, { c: '#c4b08a', noao: true }); rail(at(e, 0, 5.85, 1.24), 7.2, 1.0, {});
  const o = end('Palazzo Alliata di Villafranca');
  o.userData.solids = [[AL.p, null, y0 + ALH + 0.75]];
  return o;
}
export const ALLIATA = { name: 'Palazzo Alliata di Villafranca', x: -108, z: 135, radius: 60, skipIds: [AL.id], build: buildAlliata };

export const BATCH_F = [SALINAS, ARCIVESCOVILE, MONASTERO_SC, ALLIATA];
