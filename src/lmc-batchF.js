// City landmarks, batch F: four palazzi and convents of the old centre, drawn from reference photos. Registered through src/landmarks-city.js (BATCH_F).
// Museo Archeologico Regionale Antonio Salinas (r20998804.0), Palazzo Arcivescovile (r403465.0), Monastero di Santa Caterina (r1291574.0), Palazzo Alliata di Villafranca (r20108989.0).
// Each footprint is kept as it is (collision unchanged but for short walls round the Salinas portal and corner pilaster), walls are skinned edge by edge with a painted bay texture (bays counted along each edge so windows line up with balconies and portals), cloisters get an arcade texture.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions, bay counts and colours read):
// Salinas: Museoarcheosalinas.JPG (the front on Piazza Olivella, edges 6 and 7 of the outline, the church of Sant'Ignazio at its right end: two floors, cream plaster, a heavy stone cornice, a honey ashlar corner pilaster at the left end,
//   seven blue-glazed windows upstairs with alternating triangular and segmental pediments, small barred windows in stone frames below, in the middle an arched stone portal lettered MUSEO NAZIONALE with a stone balcony over it,
//   a red hanging banner left of the portal and a white one right of it); Facciata del Museo Salinas su via Roma.jpg (edge 1: whiter plaster over a beige plinth with grated basement openings, a loggia of seven round arches on honey
//   stone columns with glass behind, under it four small framed windows over four square barred ones, three hanging banners, and to the left windows with segmental pediments on iron balconies on stone brackets); Museo Archeologico Salinas 2016.jpg
//   (the cloister: round arches on heavy round columns, an ornamented band, cream plaster over it with framed windows, one pierced Norman style window, a smaller top row).
// Arcivescovile: Palermo, Palazzo Arcivescovile.jpg (the long front on Via Matteo Bonello from the cathedral garden); Palazzo arcivescovato palermo.JPG (the courtyard gate and the windows over it head on); Palazzo Arcivescovile di Palermo.jpg
//   (night: the Gothic window beside the south-east corner, the corner column under a balcony); Palazzo Arcivescovile (Palermo) 16 07 2019 01.jpg (a carved white window with a broken pediment on its balusters); Cathedral (Palermo) 07.jpg (the front running
//   up to the bell tower arches); Mapillary 819579658975988 and 1080153229142607 (the dark stone, iron balconies beyond the arches and on Via Vittorio Emanuele). Read from them: weathered golden ashlar, black low down, small barred windows below;
//   on the first floor green-grey shutters in ochre stone frames under triangular and curved pediments, each on a white balustraded balcony with brackets; small square windows on top; a deep cornice; the dark carved Gothic gate with the courtyard seen
//   through it, a wider balcony over it; a three light Gothic window. The bishop statues of the earlier model belong to the cathedral balustrade (mapped, drawn by src/props.js) and are gone.
// Santa Caterina: Santa Caterina (Palermo).JPG (the church front and the convent wall to its right: ochre plaster, framed barred windows, a heavy cornice, warm weathered stone); Monastero di Santa Caterina, palermo.jpg (the cloister:
//   round arches on plaster, a glazed wooden gallery above with an iron balcony under a tiled eave; grey photo, colours guessed from the church front); Santa Caterina (Palermo) 17 07 2019 10.jpg (inside of the church only, not used).
//   The church itself is not in this batch (it has its own landmark in src/landmarks.js). Round 2: Santa Caterina (Palermo).JPG (the wall right of the church: five rows of openings, grilles, stone frames, the eaves cornice, about 17 m);
//   Santa Caterina 2022 (Palermo) 14.jpg (from the dome: terracotta roofs on the wings round the cloister). The other street walls repeat the same bays (no photo found).
// Alliata: Palazzo Alliata di Villafranca (Palermo) 14 07 2019 03.jpg (the portal: a round arch with a fanlight between two free grey columns and two statues in niches, an iron balcony over it with two shuttered windows with curved
//   pediments, a marble plaque, a huge stucco cartouche with the coat of arms, honey stone ashlar quoins, plaster flaking off in large patches, rust and water stains); Palermo piazza Bologni statua Carlo V.jpg (the front on the piazza,
//   four levels, iron balconies on every window row, shuttered windows, heavily weathered plaster).
// Not verified, not drawn: the roofs (hidden behind the cornices; flat, the Arcivescovile one in terracotta), the courtyards of Alliata and Arcivescovile (only glimpsed through its gate), the Arcivescovile's other fronts (the same bays, few balconies), the place of its gate and corner window along the walls (read by eye), the true storey heights (read from window to cornice ratios in the photos).
// Salinas, not verified: no photo of the walls on the church side (edges 2 to 5, edge 5 being shared with the church) or of the long north wall on Via Bara all'Olivella (only its first windows show at the corner of the front photo), so they keep
//   the plain bay texture of the front. On Via Roma the photo covers about 24 m of the 40.6 m edge: it is placed against the north corner (which end it belongs to is assumed) and the rest is left blank plaster over the plinth.
//   Not drawn: the iron railing before the Olivella front (it would stand outside the collision outline), the flags over its portal, the lettering on the banners.
import * as THREE from 'three';
import { PI, bx, cyl, archBay, prism, panel, extrude, gable, begin, end, defMat, mul, tr, rotY, frame, groundY, groundRange, initShared, noiseDots, streaks, pairsOf, statue, balus, rail, RNG, paintAshlar } from './lmc-kit.js';

// ---------- shared helpers ----------
function pip(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// walls: one panel per edge in front of the extruded body, bays counted along the edge; returns the edge records (F: frame at the edge middle on the ground, +z out of the wall, +x to the right seen from outside)
function skin(key, ring, hole, y0, H, bay, perTile, minLen = 3, skip = []) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    let nx = dz / len, nz = -dx / len; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (pip([mx + nx * 0.6, mz + nz * 0.6], ring) !== hole) { nx = -nx; nz = -nz; }
    const n = Math.max(1, Math.round(len / bay)), F = frame(mx, y0, mz, nx, nz), e = { i, len, n, bw: len / n, F, nx, nz, mx, mz, hole };
    out.push(e); if (len < minLen || skip.includes(i)) continue;
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
function skins(key, ring, holes, y0, H, bay, per, skip) { return { outer: skin(key, ring, false, y0, H, bay, per, 3, skip), inner: holes.map(h => skin(key, h, true, y0, H, bay, per)) }; }

// ===================================================================================================
// 1. Museo Archeologico Regionale Antonio Salinas
// ===================================================================================================
const SA = { id: 'r20998804.0', p: [-91, -574.6, 1.5, -598.5, 8.8, -558.6, -19, -550.9, -22, -562.5, -43.3, -557, -83.6, -546.5, -85.1, -552.3], holes: [[-69.6, -572.3, -81.9, -568.8, -77.7, -554.3, -65.4, -557.8], [-58.8, -574, -55.4, -561.7, -25.3, -569.7, -28.6, -582]] };
const SAH = 14, SAB = 5.5;
const HONEY = '#cdb184';
function paintSalWall(g, w, h) {
  const k = kit(g, w, h, 11, SAH), { R, tri, seg } = k;
  g.fillStyle = '#e8d9ba'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 1.8, 9101, ['rgba(150,115,70,0.08)', 'rgba(255,248,225,0.1)']);
  wear(g, w, h, 9102, { blots: 3, patches: 0 });
  R(0, 0, 11, 0.95, '#b79b6e'); R(0, 0.95, 11, 1.05, 'rgba(50,35,20,0.35)');
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
  wearTop(g, w, h, 9120, { streaks: 5, cracks: 0 });   // restored and clean in the front photo (the key name keeps the shared weathering coat off)
}
// The Via Roma front and the small pieces of the Olivella front share one canvas, 32 x 14 m: u 0..4.1 m blank wall (repeated along the unphotographed part), 4.1..28.3 m the photographed front,
// and from 28.3 m a column holding the portal lettering and the two banners of the Olivella front.
const SR_TW = 32, SR_PW = 4.1, SR_CW = 24.2, SR_LOG = 7.6, SR_ARCH = 2.21;
const SR_SIGN = [28.5, 12.2, 31.8, 13.4], SR_RED = [28.5, 6.8, 29.7, 11.6], SR_WHITE = [30.2, 7.2, 31.4, 11.6];
function paintSalRoma(g, w, h) {
  const k = kit(g, w, h, SR_TW, SAH), { R, arch, seg, X, Y, sx, sy } = k, WALL = '#e9e4d8', FRAME = '#a89c88', STONE = '#c3a274', c0 = SR_PW;
  g.fillStyle = WALL; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 1.6, 9140, ['rgba(130,115,90,0.07)', 'rgba(255,252,240,0.1)']);
  R(0, 0, 28.3, 1.6, '#d2c4a4'); R(0, 1.6, 28.3, 1.68, 'rgba(70,55,35,0.3)'); R(0, 0, 28.3, 0.25, '#b9ab8d');
  // the loggia: glass in shade behind seven arches, honey columns, a stone ledge, a white parapet and the string course under it
  const l0 = c0 + SR_LOG, l1 = l0 + 7 * SR_ARCH;
  for (let i = 0; i < 7; i++) {
    const cx = l0 + SR_ARCH * (i + 0.5);
    arch(cx, 9.65, 12.62, SR_ARCH, STONE); arch(cx, 9.65, 12.28, SR_ARCH - 0.28, '#34403f'); arch(cx, 9.65, 11.6, SR_ARCH - 0.9, '#56666a');
    R(cx - SR_ARCH / 2 + 0.2, 9.65, cx + SR_ARCH / 2 - 0.2, 10.4, 'rgba(180,200,205,0.22)'); R(cx - 0.12, 12.45, cx + 0.12, 12.8, STONE);
  }
  for (let i = 0; i <= 7; i++) { const x = l0 + SR_ARCH * i; R(x - 0.14, 9.65, x + 0.14, 11.4, STONE); R(x - 0.24, 11.2, x + 0.24, 11.42, '#b08f62'); R(x - 0.2, 8.95, x + 0.2, 9.75, '#b99a6e'); }
  R(l0 - 0.2, 9.45, l1 + 0.2, 9.65, '#b08f62'); R(l0 - 0.2, 8.75, l1 + 0.2, 8.95, '#a58b66'); R(l0 - 0.2, 8.68, l1 + 0.2, 8.75, 'rgba(50,35,20,0.4)');
  // two rows of windows under the loggia, grated openings in the plinth
  for (const x of [8.78, 13.11, 17.5, 21.78]) {
    const cx = c0 + x;
    R(cx - 0.65, 6.27, cx + 0.65, 8.07, FRAME); R(cx - 0.45, 6.47, cx + 0.45, 7.87, '#5d3b2b'); R(cx - 0.36, 6.55, cx + 0.36, 7.8, '#33475c'); k.grid(cx - 0.36, 6.55, cx + 0.36, 7.8, 0.36, '#6a4330', 1.5); R(cx - 0.72, 6.17, cx + 0.72, 6.3, '#948976');
    R(cx - 0.83, 3.15, cx + 0.83, 5.15, FRAME); R(cx - 0.58, 3.4, cx + 0.58, 4.88, '#221c18'); k.grid(cx - 0.58, 3.4, cx + 0.58, 4.88, 0.19, '#6e6258', 1);
    R(cx - 0.6, 0.33, cx + 0.6, 0.98, '#26221d'); k.grid(cx - 0.6, 0.33, cx + 0.6, 0.98, 0.2, '#77705f', 1);
  }
  // the pedimented balcony windows to the left of the loggia (the slabs, brackets and top rails are geometry, the iron bars painted)
  for (const x of [1.69, 4.96]) {
    const cx = c0 + x;
    R(cx - 1.0, 9.35, cx + 1.0, 12.0, STONE); R(cx - 0.54, 9.35, cx + 0.54, 11.12, '#4a2c24'); R(cx - 0.44, 9.4, cx + 0.44, 11.02, '#3d5064'); R(cx - 0.03, 9.4, cx + 0.03, 11.02, '#4a2c24'); R(cx - 0.44, 10.45, cx + 0.44, 10.5, '#4a2c24');
    R(cx - 1.35, 11.9, cx + 1.35, 12.15, '#b08f62'); seg(cx, 12.12, 2.7, 1.05, STONE); seg(cx, 12.12, 1.9, 0.7, WALL);
    for (let i = 0; i <= 16; i++) R(cx - 1.4 + i * 0.175 - 0.025, 9.35, cx - 1.4 + i * 0.175 + 0.025, 10.2, '#26272a');
  }
  // three banners
  [[10.75, 3.85, 9.0, '#8fb43c'], [15.38, 3.85, 9.0, '#b92634'], [19.94, 3.7, 8.9, '#3d86c8']].forEach(([x, y0, y1, c]) => {
    const cx = c0 + x; R(cx - 0.48, y0, cx + 0.48, y1, c); R(cx - 0.48, y1 - 1.9, cx + 0.48, y1, 'rgba(40,24,16,0.35)'); R(cx - 0.3, y0 + 1.1, cx + 0.3, y0 + 1.75, 'rgba(255,255,255,0.7)'); R(cx - 0.6, y1, cx + 0.6, y1 + 0.08, '#4a4a48');
  });
  wearTop(g, w, h, 9160, { streaks: 4, sc: '80,66,46', cracks: 0 });
  // the lettering and the banners of the Olivella front
  const [a, b, c, d] = SR_SIGN; R(a, b, c, d, '#ead9b4');
  g.fillStyle = '#4a3a26'; g.font = `bold ${Math.round((d - b) * sy * 0.62)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MUSEO NAZIONALE', X((a + c) / 2), Y((b + d) / 2), (c - a) * sx - 2);
  for (const [r, col, pic] of [[SR_RED, '#8e2233', '#3b2620'], [SR_WHITE, '#e9e7e0', '#4d8fb8']]) { R(r[0] - 0.1, r[1] - 0.1, r[2] + 0.1, r[3] + 0.1, col); R(r[0] + 0.2, r[1] + (r === SR_RED ? 2.0 : 0.9), r[2] - 0.2, r[1] + (r === SR_RED ? 4.0 : 2.4), pic); R(r[0] + 0.25, r[1] + 0.45, r[2] - 0.25, r[1] + 0.6, 'rgba(90,70,60,0.7)'); }
}
// a quad showing the part r = [u0, v0, u1, v1] (canvas metres) of that canvas
const srPanel = (M, w, h, r) => panel('bfSalRoma', w, h, { M, uvk: [(r[2] - r[0]) / SR_TW, (r[3] - r[1]) / SAH], uvo: [r[0] / SR_TW, r[1] / SAH] });
const SAL_PAL = { wall: '#e6d6b4', stone: '#c8ab7c', trim: '#dcc79e', under: '#b79d72' };
function buildSalinas() {
  initShared();
  const pts = pairsOf(SA.p), gr = groundRange(pts), y0 = gr.lo + 0.2;
  defMat('bfSalPlaster', 384, 384, [11, SAH], paintSalWall);
  defMat('bfSalRoma', 768, 384, [SR_TW, SAH], paintSalRoma);
  defMat('bfSalClo', 192, 384, [3.6, SAH], (g, w, h) => paintArcade(g, w, h, 3.6, SAH, SAL_PAL, 9201, false));
  begin(y0);
  const { holes } = body(SA, 'bfSalPlaster', y0, SAH, Math.min(gr.lo, y0) - 1.5);
  const sk = skins('bfSalPlaster', pts, holes, y0, SAH, 5.5, 2, [1, 6, 7]);   // edges 1, 6 and 7 get their own fronts below
  cornice(sk.outer, SAH, 0.9, 0.6, '#cdb48a');
  // the cloister walls are skinned again with the arcade texture on top of the plain skin
  for (const h of holes) { const ed = skin('bfSalClo', h, true, y0, SAH, 3.6, 1); cornice(ed, SAH, 0.7, 0.35, '#c8ab7c'); }
  // the front on Piazza Olivella: edges 6 and 7 are one straight 29 m wall, seven bays (the wall texture alternates triangle and segment, so the pediments fall as in the photo), portal in the middle bay
  const A = pts[0], C = pts[6], wl = Math.hypot(C[0] - A[0], C[1] - A[1]), W = frame((A[0] + C[0]) / 2, y0, (A[1] + C[1]) / 2, -(C[1] - A[1]) / wl, (C[0] - A[0]) / wl), w = (x, y, z) => mul(W, tr(x, y, z));
  panel('bfSalPlaster', wl, SAH, { M: w(0, 0, 0.08), uvk: [7 / 2, 1] });
  archBay('flat', 3.4, 5.3, 1.75, 3.7, 0.7, { M: w(0, 0, 0.04), c: '#d6bc8e' });
  panel('dark', 1.75, 3.8, { M: w(0, 0, 0.16), c: '#17120e' });
  bx('flat', W, -1.9, 1.9, 5.2, 5.5, -0.1, 1.1, { c: '#cdb48a', noao: true }); balus(w(0, 5.5, 1.0), 3.6, 0.9, {});
  bx('flat', W, -1.2, 1.2, 4.1, 4.6, 0.2, 0.78, { c: '#cdb48a', noao: true }); srPanel(w(0, 4.13, 0.8), 2.2, 0.44, SR_SIGN);
  srPanel(w(-2.2, 3.1, 0.2), 0.85, 3.6, SR_RED); srPanel(w(2.2, 2.8, 0.2), 0.85, 3.3, SR_WHITE);
  // honey stone corner pilaster at the left (north) end
  bx('stone', W, -wl / 2 - 0.12, -wl / 2 + 1.7, 0, SAH, -0.1, 0.3, { c: '#fff0cc', noao: true });
  bx('stone', W, -wl / 2 - 0.2, -wl / 2 + 1.75, 0, 1.1, -0.1, 0.42, { c: '#d9bd8c', noao: true });
  // Via Roma (edge 1, +x is north): the photographed front against the north corner, blank wall south of it
  const e1 = sk.outer[1], c0 = e1.len / 2 - SR_CW, rest = c0 + e1.len / 2, np = Math.ceil(rest / SR_PW), pw = rest / np;
  srPanel(at(e1, c0 + SR_CW / 2, 0, 0.05), SR_CW, SAH, [SR_PW, 0, SR_PW + SR_CW, SAH]);
  for (let i = 0; i < np; i++) srPanel(at(e1, -e1.len / 2 + pw * (i + 0.5), 0, 0.05), pw, SAH, [0, 0, pw, SAH]);
  for (const x of [1.69, 4.96]) {
    const cx = c0 + x;
    bx('stone', e1.F, cx - 1.42, cx + 1.42, 9.05, 9.35, 0, 0.75, { c: '#fff2d4', noao: true });
    for (const s of [-1.0, 0, 1.0]) bx('stone', e1.F, cx + s - 0.11, cx + s + 0.11, 8.35, 9.05, 0, 0.5, { c: '#f4dfb6', noao: true });
    bx('flat', e1.F, cx - 1.4, cx + 1.4, 10.15, 10.23, 0.05, 0.13, { c: '#26272a', noao: true });
  }
  bx('stone', e1.F, c0 + SR_LOG - 0.2, c0 + SR_LOG + 7 * SR_ARCH + 0.2, 9.45, 9.65, 0, 0.22, { c: '#f4dfb6', noao: true });   // the loggia ledge
  const o = end('Museo Archeologico Regionale Antonio Salinas');
  o.userData.solids = [[SA.p, null, y0 + SAH + 0.4]];
  return o;
}
// the portal (0.74 m), the banners beside it (0.2 m) and the corner pilaster (0.42 m) stand out of the footprint: short walls round them, with slanted ends so the car slides off
const SAL_WALLS = (() => {
  const [ax, az, cx, cz] = [SA.p[0], SA.p[1], SA.p[12], SA.p[13]], wl = Math.hypot(cx - ax, cz - az), nx = -(cz - az) / wl, nz = (cx - ax) / wl;
  const at = ([x, z]) => [(ax + cx) / 2 + x * nz + z * nx, (az + cz) / 2 - x * nx + z * nz];
  return [[[-2.8, 0], [-2.68, 0.22], [-2.1, 0.22], [-1.72, 0.76], [1.72, 0.76], [2.1, 0.22], [2.68, 0.22], [2.8, 0]], [[-wl / 2 - 0.35, 0], [-wl / 2 - 0.22, 0.44], [-wl / 2 + 1.77, 0.44], [-wl / 2 + 2.0, 0]]]
    .flatMap(run => run.slice(1).map((q, i) => [...at(run[i]), ...at(q)]));
})();
export const SALINAS = { name: 'Museo Archeologico Regionale Antonio Salinas', x: -41, z: -572, radius: 75, skipIds: [SA.id], build: buildSalinas, walls: SAL_WALLS };

// ===================================================================================================
// 2. Palazzo Arcivescovile
// ===================================================================================================
const AR = { id: 'r403465.0', p: [-538.8, 150.2, -519.9, 178.5, -519.3, 179.5, -515.4, 184.9, -511.2, 191.5, -492.3, 219.6, -472.9, 248.5, -488.7, 256.7, -523.3, 274.3, -536.7, 281.2, -558.4, 292.3, -565.2, 295.8, -580.8, 303.8, -596, 271.2, -572, 258.1, -554.9, 248.9, -557.1, 244.8, -550.9, 241.5, -553.8, 236, -547.6, 232.7, -542.3, 242.7, -547.6, 245.5, -535.5, 268.3, -528.4, 264.6, -522.9, 261.4, -529.1, 250, -532.4, 245.1, -531.4, 244.3, -546, 222.3, -543.9, 220.7, -545.2, 218.9, -539.2, 214.4, -540.4, 212.6, -530.1, 205.6, -531.6, 203, -524.6, 198.3, -529.7, 190.7, -523.9, 186.9, -525.9, 184, -526.7, 182.9, -538.2, 190.5, -547, 179.1, -552.9, 171.3],
  holes: [[-535.4, 217.8, -516.7, 204.4, -490.1, 244.4, -510.7, 255.4], [-578.9, 275.1, -573.8, 285.1, -562.8, 279.2, -567.8, 269.1], [-534.6, 180.5, -544.6, 167.6, -538.5, 163.5, -529.3, 176.7]] };
const ARH = 15.2, ARB = 4.5;   // the height to the roof, one bay of the long front
const ARSTONE = '#c6a97c', ARJOINT = '#917a55', ARFR = '#bd955a', ARDK = '#3f3b36';
// two bays of the palace wall, 9 m: dark weathered stone with small barred windows below, the shuttered windows of the first floor in ochre stone frames under a triangular (left) and a curved (right) pediment, small square windows on top
function paintArWall(g, w, h) {
  const k = kit(g, w, h, 2 * ARB, ARH), { R, tri, seg, arch } = k;
  paintAshlar(g, w, h, 2 * ARB, ARH, 0.45, 1.0, ARSTONE, ARJOINT, 9301, 1.2, 0.09);
  wear(g, w, h, 9302, { blots: 12, stain: '90,66,38' });
  const dk = g.createLinearGradient(0, k.Y(0), 0, k.Y(6.4)); dk.addColorStop(0, 'rgba(38,34,28,0.62)'); dk.addColorStop(0.65, 'rgba(48,42,32,0.34)'); dk.addColorStop(1, 'rgba(60,50,35,0)'); g.fillStyle = dk; g.fillRect(0, k.Y(6.4), w, 6.4 * k.sy);
  { const r = RNG(9305); for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.7 ? 'rgba(34,30,24,0.19)' : 'rgba(215,190,145,0.2)'; g.fillRect(r() * w, k.Y(r() * 5.5 + 0.4), (0.3 + r() * 0.8) * k.sx, 0.42 * k.sy); } }
  R(0, 0, 2 * ARB, 0.9, '#6e6250'); R(0, 0.9, 2 * ARB, 1.05, '#a08a62');
  for (let b = 0; b < 2; b++) {
    const cx = ARB * (b + 0.5);
    if (b === 0) { R(cx - 0.8, 2.55, cx + 0.8, 4.45, '#94794f'); R(cx - 0.58, 2.8, cx + 0.58, 4.2, '#1c1b19'); for (let x = cx - 0.45; x < cx + 0.5; x += 0.22) R(x, 2.8, x + 0.05, 4.2, '#5c564c'); R(cx - 0.58, 3.45, cx + 0.58, 3.52, '#5c564c'); }
    else { arch(cx, 2.9, 4.5, 1.15, '#a58a5c'); arch(cx, 3.05, 4.3, 0.75, '#231f1a'); R(cx - 0.8, 2.7, cx + 0.8, 2.9, '#a58a5c'); }
    R(cx - 0.35, 0.35, cx + 0.35, 0.75, '#171512');
    // first floor
    R(cx - 1.12, 7.05, cx + 1.12, 10.55, ARFR); R(cx - 1.12, 7.05, cx - 0.98, 10.55, 'rgba(255,235,190,0.35)'); R(cx + 0.95, 7.05, cx + 1.12, 10.55, 'rgba(60,40,18,0.35)');
    R(cx - 0.76, 7.1, cx + 0.76, 9.95, '#47585b'); for (let y = 7.3; y < 9.9; y += 0.19) R(cx - 0.68, y, cx + 0.68, y + 0.06, 'rgba(8,16,18,0.45)'); R(cx - 0.04, 7.1, cx + 0.04, 9.95, '#1f2a2d'); R(cx - 0.76, 8.95, cx + 0.76, 9.03, '#1f2a2d');
    R(cx - 0.9, 10.08, cx + 0.9, 10.45, '#d3b178'); R(cx - 1.3, 10.5, cx + 1.3, 10.65, '#d6b47a');
    if (b === 0) { tri(cx - 1.35, cx + 1.35, 10.65, 0.9, ARFR); tri(cx - 0.85, cx + 0.85, 10.72, 0.52, '#9c7a48'); } else { seg(cx, 10.65, 2.7, 0.85, ARFR); seg(cx, 10.7, 1.8, 0.55, '#9c7a48'); }
    g.fillStyle = '#d9cfb8'; g.beginPath(); g.ellipse(k.X(cx), k.Y(11.05), 0.22 * k.sx, 0.28 * k.sy, 0, 0, 2 * PI); g.fill();
    sillDrip(g, k, cx, 6.7, 2.2, 9320 + b);
    // top floor
    R(cx - 0.82, 12.05, cx + 0.82, 13.8, ARFR); R(cx - 0.66, 12.18, cx + 0.66, 13.66, '#a5834c'); R(cx - 0.5, 12.32, cx + 0.5, 13.52, '#2a3036'); R(cx - 0.04, 12.32, cx + 0.04, 13.52, '#cfc8b8'); R(cx - 0.5, 12.9, cx + 0.5, 12.96, '#cfc8b8'); sillDrip(g, k, cx, 12.0, 1.4, 9325 + b);
  }
  R(0, 14.3, 2 * ARB, 14.55, '#8d7048'); R(0, 14.55, 2 * ARB, ARH, '#cfa966'); R(0, 14.2, 2 * ARB, 14.3, 'rgba(40,28,16,0.45)');
  R(8.82, 0, 8.94, 14.3, '#57504a');   // a down pipe
  wearTop(g, w, h, 9330, { streaks: 18, sc: '45,32,20' });
}
// left: the Catalan Gothic window of three lights in its stone (3.2 x 9.4 m, from 2.3 m up). right: the dark carved gate on the courtyard (5.2 x 6.9 m)
function paintArDet(g) {
  const area = (x0, y0, pw, ph, wm, hm, f) => { g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip(); g.translate(x0, y0); const k = kit(g, pw, ph, wm, hm); paintAshlar(g, pw, ph, wm, hm, 0.45, 1.0, ARSTONE, ARJOINT, 9340 + x0, 1.2, 0.09); f(k, wm, hm); g.restore(); };
  area(0, 0, 96, 256, 3.2, 9.4, (k) => {
    const { R, X, Y, sx } = k;
    const pt = (ww, y0, ys, ya, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(1.6 - ww / 2), Y(y0)); g.lineTo(X(1.6 - ww / 2), Y(ys)); g.quadraticCurveTo(X(1.6 - ww / 2), Y(ys + (ya - ys) * 0.65), X(1.6), Y(ya)); g.quadraticCurveTo(X(1.6 + ww / 2), Y(ys + (ya - ys) * 0.65), X(1.6 + ww / 2), Y(ys)); g.lineTo(X(1.6 + ww / 2), Y(y0)); g.fill(); };
    const gd = g.createLinearGradient(0, Y(0), 0, Y(5)); gd.addColorStop(0, 'rgba(38,34,28,0.55)'); gd.addColorStop(1, 'rgba(38,34,28,0)'); g.fillStyle = gd; g.fillRect(0, 0, k.X(3.2), k.Y(0));
    pt(3.0, 0.35, 4.6, 7.45, '#d3b684'); pt(2.6, 0.45, 4.6, 7.15, '#8f7450'); pt(2.3, 0.55, 4.6, 6.95, '#d8bd8c'); pt(1.95, 0.7, 4.6, 6.7, '#231f1c');
    g.strokeStyle = '#d8c298'; g.lineWidth = Math.max(1.4, sx * 0.075);
    for (const x of [1.275, 1.925]) { R(x - 0.05, 0.7, x + 0.05, 4.4, '#e2cfa6'); }
    for (const x of [0.95, 1.6, 2.25]) { g.beginPath(); g.moveTo(X(x - 0.32), Y(4.15)); g.quadraticCurveTo(X(x - 0.3), Y(4.65), X(x), Y(4.85)); g.quadraticCurveTo(X(x + 0.3), Y(4.65), X(x + 0.32), Y(4.15)); g.stroke(); }
    for (const [x, y] of [[1.275, 5.2], [1.925, 5.2], [0.95, 5.65], [1.6, 5.75], [2.25, 5.65], [1.35, 6.2], [1.85, 6.2]]) { g.beginPath(); g.ellipse(X(x), Y(y), 0.24 * sx, 0.36 * k.sy, (x - 1.6) * 0.5, 0, 2 * PI); g.stroke(); }
    R(0.1, 0.2, 3.1, 0.55, '#c9ac7a');
  });
  area(96, 0, 160, 208, 5.2, 6.9, (k) => {
    const { R, X, Y, sx, arch } = k;
    R(0, 0, 5.2, 2.2, 'rgba(38,34,28,0.5)');
    R(0.35, 0, 4.85, 6.15, '#4a4640'); R(0.35, 6.0, 4.85, 6.15, '#6a645a');
    g.fillStyle = '#4a4640'; g.beginPath(); g.moveTo(X(1.6), Y(6.15)); g.lineTo(X(2.6), Y(6.85)); g.lineTo(X(3.6), Y(6.15)); g.fill();
    g.fillStyle = '#777064'; { const r = RNG(9350); for (let i = 0; i < 520; i++) { const x = 0.45 + r() * 4.3, y = 3.1 + r() * 2.85; g.fillRect(X(x), Y(y), 1 + r() * 2.4, 1 + r() * 2.4); } }
    arch(2.6, 0, 5.3, 4.0, '#302d29'); arch(2.6, 0, 5.1, 3.6, '#6c665c'); arch(2.6, 0, 4.9, 3.2, '#242220');
    // through the gate: the courtyard, its far arch, palms, the iron leaves of the gate low down
    g.save(); g.beginPath(); g.moveTo(X(1.25), Y(0)); g.lineTo(X(1.25), Y(3.15)); g.arc(X(2.6), Y(3.15), 1.35 * sx, PI, 0); g.lineTo(X(3.95), Y(0)); g.clip();
    R(1.2, 0, 4.0, 4.6, '#d9d3c4'); R(1.2, 0, 4.0, 0.9, '#a9977a'); arch(2.75, 0.5, 3.1, 1.5, '#c39a55'); arch(2.75, 0.5, 2.85, 1.05, '#5d4a34'); R(2.25, 1.7, 3.25, 1.85, '#c39a55');
    g.fillStyle = '#456a34'; for (const [x, y, rr] of [[1.55, 1.9, 0.45], [1.4, 1.35, 0.4], [3.75, 2.3, 0.42]]) { g.beginPath(); g.ellipse(X(x), Y(y), rr * sx, rr * 0.8 * k.sy, 0, 0, 2 * PI); g.fill(); }
    R(1.2, 3.4, 4.0, 4.6, 'rgba(25,20,15,0.55)');
    for (let x = 1.3; x < 3.95; x += 0.19) R(x, 0, x + 0.05, 1.35, '#24221f'); R(1.2, 1.3, 4.0, 1.4, '#24221f'); R(1.2, 0.35, 4.0, 0.42, '#24221f');
    g.restore();
    g.fillStyle = '#d8ccb0'; g.beginPath(); g.arc(X(2.6), Y(5.65), 0.2 * sx, 0, 2 * PI); g.fill();
  });
}
function buildArciv() {
  initShared();
  const pts = pairsOf(AR.p), gr = groundRange(pts), y0 = gr.lo + 0.2, holes = AR.holes.map(pairsOf);
  defMat('bfArcWall', 320, 432, [2 * ARB, ARH], paintArWall);
  defMat('bfArcDet', 256, 256, [1, 1], paintArDet);
  begin(y0);
  prism('bfArcWall', pts, Math.min(gr.lo, y0) - 1.5, y0 + ARH, { holes, uvo: [0, -y0 / ARH] });
  prism('flat', pts, y0 + ARH, y0 + ARH + 0.2, { holes, c: '#a9765c' });   // terracotta roofs
  const NE = [0, 1, 2, 3, 4, 5];   // the six edges of the long straight front on Via Matteo Bonello, towards the cathedral
  const sk = skins('bfArcWall', pts, holes, y0, ARH, ARB, 2, NE);
  cornice(sk.outer, ARH + 0.15, 0.55, 0.65, '#c29c60'); cornice(sk.outer, ARH + 0.35, 0.2, 0.85, '#d9bb82'); for (const e of sk.inner) cornice(e, ARH + 0.15, 0.5, 0.4, '#c29c60');
  // the long front, laid out in one run from the corner on Via Vittorio Emanuele (x = 0) towards the bell tower of the cathedral and beyond
  const A = pts[6], B = pts[0], L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
  const F = frame(A[0], y0, A[1], -uz, ux), M = (x, y, z) => mul(F, tr(x, y, z));
  const n = Math.floor((L - 1.25) / ARB);
  panel('bfArcWall', 1.25, ARH, { M: M(0.625, 0, 0.04), uvk: [0.05, 1], uvo: [0.9, 0] });
  for (let i = 0; i <= n; i++) {
    const x0 = 1.25 + i * ARB, bw = Math.min(ARB, L - x0); if (bw < 0.2) break;
    panel('bfArcWall', bw, ARH, { M: M(x0 + bw / 2, 0, 0.04), uvk: [bw / (2 * ARB), 1], uvo: [(i % 2) / 2, 0] });
  }
  const PORTAL = 7, WHITE = '#ddd6c4';
  const hood = (m, hw, yy, rise, curved, c) => {   // a pediment standing out of the wall: a cornice with a triangle or a segment over it
    const s = new THREE.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); if (curved) s.quadraticCurveTo(0, rise * 2, -hw, 0); else { s.lineTo(0, rise); s.lineTo(-hw, 0); }
    extrude('flat', s, 0.26, { M: mul(m, tr(0, yy, 0)), c, cs: 6, noao: true });
    bx('flat', m, -hw - 0.08, hw + 0.08, yy - 0.16, yy + 0.03, 0, 0.36, { c: '#d3b075', noao: true });
  };
  for (let i = 0; i < n; i++) {
    const x = 1.25 + (i + 0.5) * ARB; if (i === 0 || x > L - 2.2) continue;
    const far = i > 16, wide = i === PORTAL ? 1.9 : 1.32, m = M(x, 0, 0);
    if (far) { bx('flat', m, -1.2, 1.2, 6.85, 7.05, 0, 0.7, { c: '#8f8678', noao: true }); rail(M(x, 7.05, 0.68), 2.4, 0.95, { c: '#8a857c' }); hood(m, 1.25, 10.6, 0.25, false, '#a8885a'); continue; }
    bx('flat', m, -wide, wide, 6.8, 7.06, 0, 0.9, { c: WHITE, noao: true });
    for (const s of [-wide + 0.25, 0, wide - 0.25]) { bx('flat', m, s - 0.13, s + 0.13, 6.3, 6.8, 0, 0.62, { c: '#8d8270', noao: true }); bx('flat', m, s - 0.1, s + 0.1, 5.95, 6.3, 0, 0.3, { c: '#7d7362', noao: true }); }
    balus(M(x, 7.06, 0.84), 2 * wide - 0.1, 0.92, {});
    bx('flat', m, -wide + 0.04, wide - 0.04, 7.93, 8.04, 0.78, 0.9, { c: WHITE, noao: true });
    if (i === PORTAL) { hood(m, 1.65, 10.65, 0.75, true, '#c9a468'); bx('flat', m, -0.34, 0.34, 11.2, 11.95, 0.2, 0.42, { c: '#e6e0d0', noao: true }); }
    else hood(m, 1.38, 10.65, i % 2 ? 0.58 : 0.86, !!(i % 2), '#bf985c');
    for (const s of [-1, 1]) bx('flat', m, s * 0.98 - 0.12, s * 0.98 + 0.12, 7.1, 10.5, 0, 0.14, { c: '#c9a468', noao: true });
  }
  { // the gate of the courtyard: its dark carved frame and arch stand out of the wall
    const x = 1.25 + (PORTAL + 0.5) * ARB, m = M(x, 0, 0);
    panel('bfArcDet', 5.2, 6.9, { M: M(x, 0, 0.07), uvk: [160 / 256, 208 / 256], uvo: [96 / 256, 48 / 256] });
    for (const s of [-1, 1]) { bx('flat', m, s * 2.05 - 0.22, s * 2.05 + 0.22, 0, 6.05, 0, 0.3, { c: '#46423c' }); bx('flat', m, s * 1.5 - 0.14, s * 1.5 + 0.14, 0, 3.15, 0, 0.42, { c: '#57524a' }); }
    const ring = new THREE.Shape(); ring.moveTo(1.72, 0); ring.absarc(0, 0, 1.72, 0, PI, false); ring.lineTo(-1.38, 0); ring.absarc(0, 0, 1.38, PI, 0, true); ring.lineTo(1.72, 0);
    extrude('flat', ring, 0.42, { M: M(x, 3.15, 0), c: '#57524a', cs: 8, noao: true });
    bx('flat', m, -2.35, 2.35, 5.98, 6.18, 0, 0.38, { c: '#5d574e', noao: true });
    for (const s of [-1, 1]) bx('flat', mul(M(x + s * 0.55, 6.45, 0), new THREE.Matrix4().makeRotationZ(-s * 0.55)), -0.68, 0.68, -0.09, 0.09, 0, 0.3, { c: '#57524a', noao: true });
  }
  { // the Gothic window beside the corner
    const x = 1.25 + 0.5 * ARB;
    panel('bfArcDet', 3.2, 9.4, { M: M(x, 2.3, 0.07), uvk: [96 / 256, 1], uvo: [0, 0] });
    const s = new THREE.Shape(), r0 = 1.28, r1 = 1.62; s.moveTo(-r1, 0); s.quadraticCurveTo(-r1, 2.25, 0, 3.4); s.quadraticCurveTo(r1, 2.25, r1, 0); s.lineTo(r0, 0); s.quadraticCurveTo(r0, 1.85, 0, 2.85); s.quadraticCurveTo(-r0, 1.85, -r0, 0); s.lineTo(-r1, 0);
    extrude('flat', s, 0.3, { M: M(x, 6.9, 0), c: '#d5ba88', cs: 6, noao: true });
    for (const sg of [-1, 1]) { cyl('flat', 0.12, 0.14, 4.4, 6, { M: M(x + sg * 1.45, 2.6, 0.18), c: '#cdb78c', noao: true }); bx('flat', F, x + sg * 1.45 - 0.22, x + sg * 1.45 + 0.22, 6.82, 7.06, 0, 0.4, { c: '#d5ba88', noao: true }); }
    bx('flat', F, x - 1.75, x + 1.75, 2.4, 2.66, 0, 0.42, { c: '#c9ac7a', noao: true });
  }
  { // the corner: a grey column under the balcony, and round it, on Via Vittorio Emanuele, the white carved window with its broken pediment
    cyl('flat', 0.24, 0.28, 5.5, 10, { M: M(0.02, 0, 0.1), c: '#9a968e' }); bx('flat', F, -0.45, 0.45, 5.5, 5.98, -0.3, 0.55, { c: '#c9c2b0', noao: true });
    const e = sk.outer[6], h = e.len / 2, x = h - 2.2, m = at(e, x, 0, 0);
    bx('flat', m, -2.0, 2.85, 6.75, 7.06, 0, 0.95, { c: WHITE, noao: true });
    for (const s of [-1.75, -0.6, 0.6, 1.75]) bx('flat', m, s - 0.13, s + 0.13, 6.05, 6.75, 0, 0.65, { c: '#a89e8a', noao: true });
    balus(at(e, x + 0.42, 7.06, 0.9), 4.8, 0.95, {});
    bx('flat', m, -0.82, 0.82, 7.06, 10.1, 0.02, 0.12, { c: '#36474b', noao: true }); bx('flat', m, -0.03, 0.03, 7.06, 10.1, 0.1, 0.15, { c: '#141d20', noao: true });
    for (const s of [-1, 1]) bx('flat', m, s * 1.1 - 0.28, s * 1.1 + 0.28, 7.06, 10.1, 0, 0.26, { c: '#e8e4d8', noao: true });
    bx('flat', m, -1.45, 1.45, 10.1, 10.65, 0, 0.3, { c: '#e8e4d8', noao: true }); bx('flat', m, -1.7, 1.7, 10.65, 10.82, 0, 0.45, { c: '#e8e4d8', noao: true });
    for (const s of [-1, 1]) bx('flat', mul(at(e, x + s * 1.05, 11.12, 0), new THREE.Matrix4().makeRotationZ(-s * 0.38)), -0.65, 0.65, -0.1, 0.12, 0, 0.36, { c: '#e8e4d8', noao: true });
    bx('flat', m, -0.38, 0.38, 10.82, 11.6, 0, 0.24, { c: '#e8e4d8', noao: true });
  }
  // iron balconies here and there along the rest of the front on Via Vittorio Emanuele
  for (const i of [6, 7, 9, 11]) {
    const e = sk.outer[i]; if (!e || e.len < 8) continue;
    for (let b = 1; b < e.n - 1; b += 3) { const cx = -e.len / 2 + e.bw * (b + 0.5); bx('flat', e.F, cx - 1.15, cx + 1.15, 6.85, 7.05, 0, 0.7, { c: '#6f685c', noao: true }); rail(at(e, cx, 7.05, 0.68), 2.3, 0.95, { c: '#8a857c' }); for (const s of [-0.85, 0.85]) bx('flat', e.F, cx + s - 0.11, cx + s + 0.11, 6.25, 6.85, 0, 0.45, { c: '#5d574e', noao: true }); }
  }
  const o = end('Palazzo Arcivescovile');
  o.userData.solids = [[AR.p, null, y0 + ARH + 0.2]];
  return o;
}
export const ARCIVESCOVILE = { name: 'Palazzo Arcivescovile', x: -534, z: 227, radius: 110, skipIds: [AR.id], build: buildArciv };

// ===================================================================================================
// 3. Monastero di Santa Caterina
// ===================================================================================================
const SC = { id: 'r1291574.0', p: [158.6, -25.1, 159.1, -16.2, 122.4, 1, 134.4, 41.9, 130.8, 43.3, 133.4, 53.4, 178.9, 41.8, 179.6, 16.7, 178.4, 1.1, 176.1, 1.2, 174.2, -26.6], holes: [[131.3, 15.6, 156.5, 4.3, 159.9, 32.6, 138.5, 38.8]] };
const SCH = 17, SCB = 2.9;   // the height to the roof, one column of windows
// two columns of the convent wall, 5.8 m: a dark stone foot with its doorways, blind arched openings in stone frames, a small arched window in a square frame, two rows of square windows behind iron grilles, the moulded eaves cornice
function paintScWall(g, w, h) {
  const k = kit(g, w, h, 2 * SCB, SCH), { R, arch, X, Y, sx, sy } = k, FR = '#bd9f72', FRH = '#d8c196', DK = '#27221d';
  g.fillStyle = '#d6c29c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 55, 1.8, 9401, ['rgba(150,110,65,0.1)', 'rgba(255,245,215,0.1)']);
  wear(g, w, h, 9402, { blots: 10, stain: '105,78,45', patches: 3, p0: 0.2, p1: 0.6, under: '#bfa378' });
  g.save(); g.beginPath(); g.rect(0, Y(3.6), w, 3.6 * sy); g.clip(); paintAshlar(g, w, h, 2 * SCB, SCH, 0.6, 1.4, '#a28a62', '#6f5c40', 9403, 1.3, 0.12); g.fillStyle = 'rgba(45,34,20,0.28)'; g.fillRect(0, 0, w, h); g.restore();
  R(0, 3.55, 2 * SCB, 3.78, FRH); R(0, 3.48, 2 * SCB, 3.55, 'rgba(40,28,16,0.5)');
  const bars = (x0, y0, x1, y1, c) => { R(x0, y0, x1, y1, DK); for (let x = x0 + 0.14; x < x1; x += 0.2) R(x, y0, x + 0.045, y1, c); for (let y = y0 + 0.22; y < y1; y += 0.3) R(x0, y, x1, y + 0.04, c); };
  for (let b = 0; b < 2; b++) {
    const c = SCB * (b + 0.5);
    if (b === 0) { R(c - 0.72, 0, c + 0.72, 2.85, FR); R(c - 0.5, 0, c + 0.5, 2.65, '#241a12'); R(c - 0.02, 0, c + 0.02, 2.65, '#0e0a06'); } else { R(c - 0.6, 1.1, c + 0.6, 2.5, FR); bars(c - 0.42, 1.28, c + 0.42, 2.32, '#4c4740'); }
    R(c - 0.72, 4.15, c + 0.72, 6.0, FR); if (b === 0) bars(c - 0.5, 4.35, c + 0.5, 5.8, '#514b42'); else R(c - 0.5, 4.35, c + 0.5, 5.8, '#cdb993');
    arch(c, 6.35, 8.75, 1.55, FR); arch(c, 6.55, 8.55, 1.12, b === 0 ? '#cfc4ae' : '#d3c29c'); if (b === 1) { R(c - 0.3, 6.55, c + 0.34, 7.6, '#3a332a'); } R(c - 0.9, 6.15, c + 0.9, 6.35, FRH);
    R(c - 0.74, 9.3, c + 0.74, 11.05, FR); arch(c, 9.5, 10.85, 1.0, b === 0 ? DK : '#2c3a34'); R(c - 0.03, 9.5, c + 0.03, 10.8, '#7a7060');
    R(c - 0.72, 11.65, c + 0.72, 13.35, FR); if (b === 0) bars(c - 0.5, 11.85, c + 0.5, 13.15, '#6a6154'); else { R(c - 0.5, 11.85, c + 0.5, 13.15, '#37564a'); for (let y = 12.0; y < 13.1; y += 0.18) R(c - 0.46, y, c + 0.46, y + 0.05, 'rgba(0,0,0,0.35)'); R(c - 0.02, 11.85, c + 0.02, 13.15, '#16241e'); }
    R(c - 0.82, 14.15, c + 0.82, 16.0, FR); R(c - 0.6, 14.35, c + 0.6, 15.8, DK);
    for (const y of [6.1, 11.6, 14.1]) sillDrip(g, k, c, y, 1.4, 9410 + b + y);
  }
  R(0, 16.12, 2 * SCB, SCH, '#c7ab7c'); R(0, 16.06, 2 * SCB, 16.12, 'rgba(40,28,16,0.55)'); for (let x = 0.1; x < 2 * SCB; x += 0.36) R(x, 16.15, x + 0.18, 16.42, 'rgba(60,42,22,0.5)');
  R(SCB - 0.05, 0, SCB + 0.07, 16.1, '#8f8576');   // a drain pipe
  wearTop(g, w, h, 9420, { streaks: 18 });
}
const SC_PAL = { wall: '#dac39a', stone: '#c9ac78', trim: '#e6d6b0', under: '#b99c6c' };
function buildSantaCaterina() {
  initShared();
  const pts = pairsOf(SC.p), gr = groundRange(pts), y0 = gr.lo + 0.2, holes = SC.holes.map(pairsOf);
  // one roof line over a sloping site (Piazza Bellini on the south stands four metres above the north end): the eaves are set from the piazza, each wall runs from the ground at its own middle up to them
  const foot = (a, b) => groundY((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) - 0.25, top = foot(pts[5], pts[6]) + SCH;
  defMat('bfCatWall', 256, 448, [2 * SCB, SCH], paintScWall);
  defMat('bfCatClo', 192, 384, [3.6, SCH], (g, w, h) => paintArcade(g, w, h, 3.6, SCH, SC_PAL, 9501, true));
  begin(y0);
  prism('bfCatWall', pts, Math.min(gr.lo, y0) - 1.5, top, { holes, uvo: [0, -(top - SCH) / SCH] });
  prism('flat', pts, top, top + 0.15, { holes, c: '#a06f58' });
  const sk = { outer: skin('bfCatWall', pts, false, y0, SCH, SCB, 2, 3, pts.map((_, i) => i)) };
  for (const e of sk.outer) {
    const base = foot(pts[e.i], pts[(e.i + 1) % pts.length]); e.H = top - base; e.F = frame(e.mx, base, e.mz, e.nx, e.nz);
    if (e.len >= 3) panel('bfCatWall', e.len, e.H, { M: mul(e.F, tr(0, 0, 0.04)), uvk: [e.n / 2, 1] });
    cornice([e], e.H + 0.05, 0.3, 0.5, '#bfa275'); cornice([e], e.H + 0.22, 0.17, 0.72, '#d2b98c');
  }
  for (const h of holes) { const hy = foot(h[0], h[2]), ed = skin('bfCatClo', h, true, hy, top - hy, 3.6, 1); cornice(ed, top - hy, 0.7, 0.4, '#c9ac78'); }
  // the terracotta roofs over the wings, seen from above and as a low line over the eaves: south, north and east of the cloister
  for (const [a, b, back, rise] of [[5, 6, 11.5, 2.0], [6, 7, 11, 1.7]]) {
    const e = sk.outer[a], len = e.len - (a === 6 ? 2 : 3);
    gable('flat', 'bfCatWall', mul(e.F, mul(tr(a === 6 ? 1.0 : 0, 0, -back / 2 - 0.9), rotY(PI / 2))), back, len, e.H + 0.12, rise, { ov: 0.3, c: '#b0765a', wc: '#d6c29c' });
  }
  // the front on Piazza Bellini, east of the church: iron grilles standing out from the two upper rows of windows, the sills under them
  { const e = sk.outer[5], k = e.H / SCH;
    for (let i = 0; i < e.n; i++) {
      const cx = -e.len / 2 + e.bw * (i + 0.5), ww = 1.2 * e.bw / SCB;
      for (const [y, hh, d] of [[14.3 * k, 1.55 * k, 0.3], [11.8 * k, 1.4 * k, 0.16]]) {
        if (y < 13 * k && i % 2) continue;
        rail(at(e, cx, y, d), ww, hh, { c: '#8a847a' }); for (const s of [-1, 1]) panel('rail', d, hh, { M: mul(at(e, cx + s * ww / 2, y, d / 2), rotY(PI / 2)), uvk: [d, 1], c: '#8a847a' });
        bx('flat', e.F, cx - ww / 2 - 0.15, cx + ww / 2 + 0.15, y - 0.17, y, 0, d + 0.05, { c: '#c2a779', noao: true });
      }
      bx('flat', e.F, cx - ww / 2 - 0.2, cx + ww / 2 + 0.2, 6.15 * k, 6.34 * k, 0, 0.16, { c: '#d2bb90', noao: true });
    }
    bx('flat', e.F, -e.len / 2, e.len / 2, 3.52 * k, 3.78 * k, 0, 0.14, { c: '#cdb48a', noao: true });
  }
  // the convent door on the front (run 5, towards the church piazza): a stone portal with a segmental pediment, a heavy door
  const e5 = sk.outer[5], px = 0;
  archBay('stone', 3.2, 4.8, 1.7, 3.5, 0.6, { M: at(e5, px, 0, 0), c: '#f0dcb0' });
  panel('flat', 1.7, 3.6, { M: at(e5, px, 0, 0.12) , c: '#17120e' });
  bx('flat', e5.F, px - 1.8, px + 1.8, 4.8, 5.1, -0.1, 0.8, { c: '#d3b784', noao: true });
  for (const x of [0, 8]) bx('stone', e5.F, e5.len / 2 - 3 - x - 1, e5.len / 2 - 3 - x, 0, 1.0, 0.2, 0.8, { c: '#b69a6c', noao: true });
  const o = end('Monastero di Santa Caterina');
  o.userData.solids = [[SC.p, SC.holes, top + 0.4]];
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
