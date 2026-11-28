// Round 2 landmarks, batch C3: Altofonte, Monreale, Baida and Santa Maria di Gesù. Registered through src/lmc-r2.js.
// Photos were only looked at, nothing is copied. Positions along the ground come from the footprints (the building outlines of the tiles; OpenStreetMap for the Altofonte parish church and the cloister).
// Heights were read from the proportions of the photos and, at Baida and Santa Maria di Gesù, checked against the surveyed roof levels in the tiles, so treat them as good to a metre or so.
// The ground under these places is steep in the game, so walls run down to the lowest ground beside them and each front stands on the level of its own ground.
// Each place has one painted texture plus the shared flat colour (and the shared roof tile at the cloister, the shared railing at the Municipio). Collision is the footprints; walls are added only round the
// Altofonte parish church (it has no building in the tiles), the Collegiata's bell tower, the fountain and the portal steps at Santa Maria di Gesù, and the tower and gateway of the Archbishop's palace.
// Apart from these, the cloister and shallow mouldings, nothing outside the footprints is drawn.
//
// Chiesa Madre di Santa Maria, Altofonte (OSM w1189157544). Front to the south on Via Vittorio Emanuele, the other end on a lane to the north. Wikimedia Commons "Altofonte02" (front) and "Altofonte05" (lane).
//  Read: cream plaster, orange corner pilasters and entablature, a round window in a moulded ring, a stone coat of arms and tablet, a portal with orange pilasters under a broken pediment, a green bronze door;
//  at the north end a plain wall with cornices, a round window, a brown door and a small bell turret with a pinkish cap and an iron cross. Not drawn: the front garden, its railing, the palm.
//  Not verified: the long sides, the roofs, the heights at the north end.
// Cappella Normanna di San Michele Arcangelo, Altofonte (w1189157566). Commons "Altofonte07" (the north wall). Read: weathered plaster, three lattice windows in arched recesses over a grey ledge, the wall top
//  as a run of rounded gables with dark corbelled copings, the brown tourist sign. Not verified: the other three walls and the roof (plain); the third gable is only partly in the photo.
// Collegiata del Santissimo Crocifisso, Monreale (w153253781). Photos on enjoysicilia.it, visititaly.eu (the front and south flank from the steps) and balarm.it. Read: white and cream front with a gable,
//  scrolls and corner pedestals, a round window, a portal under a broken curved pediment, a green door; on the south flank framed bays, a square window, three half round windows, terracotta strips,
//  a stone base with a balustrade; the square bell tower with arched openings and a green tiled spire at the east end of that flank. Not drawn: the steps and iron gates, the lower block past the tower.
//  Not verified: the north flank, the back, the roofs. The second outline the map gives this name (w1181281532) is a separate building no photo identifies, so it stays generic.
// Convento di San Giovanni Battista, Baida (w82238244 with the west building w82238500). Commons, the set of 2013 "Convento di Baida ...", "KlosterBaida02", "Chusrch and Monastery ...", "Baida chiesa" (2024);
//  Mapillary 2910715809211044, 2895545750734105 (2019) for the position of the two fronts; SITR orthophoto 2013. Read: the church front to the west (a porch of three pointed arches with a toothed top, a
//  gable set back with a corbel course, a triple blind arch, a two light window and an iron cross); beside it, facing south, the ochre front (balcony, three arched windows, two columns, two roundels,
//  a tablet, a painted lunette over the door, pediment and pinnacles) and the lower link wall with its railing; the long pale north wing with framed windows, two gothic stone niches, a stone seam and the
//  small bell gable behind the roof. The game's ground falls about 15 m across this footprint, so the north wing stands on a plain base. Not verified: where along the north wing each window sits (counted
//  from three oblique photos), the east and west walls, the cloister inside, the roofs.
// Convento di Santa Maria di Gesù (w80979177). Commons "PALERMO S.Maria di Ges" (2008) and "Cimitero Santa Maria di Gesù" pictures; photos on palermoviva.it and open.online (2023, before and during the
//  fire; the building is drawn as it stood before it); SITR orthophoto. Read: the tall block with tufa corners, a door under a round fanlight and a red shuttered window; the church wall with the gothic portal
//  up steps, a niche and two barred windows; a second gothic doorway in a darker wall; a small gabled chapel; the convent wing with small windows; the stepped fountain with its octagonal basin.
//  Not drawn: the cemetery chapels and tombs. Not verified: the walls away from the little square, the roofs, any damage since July 2023.
// Chiostro dei Benedettini, Monreale (OSM r4036267 and w1181291758). Commons "Duomo di Monreale, vista dalle terrazze sul chiostro", "Monreale, vista dalle Terrazze sul chiostro", "Chiostro ... 28 Aprile
//  2023 01", "Le cloître ..." and "La loggetta ..." (2012), "Monreale Cathedral BW 2025-04-29". Read: a square of pointed inlaid arches on paired columns (plain, zigzag and twisted) over a low wall, lean-to
//  tile roofs, four hedged lawns with crossing paths and a round middle bed, the small square fountain court with its column in the south west corner. It is closed in by buildings and cannot be seen from a
//  road. Not verified: the count of arches (about 26 a side from the photos), the carved capitals (not drawn), which lawn holds which tree. The floor is level, at about the height of the Duomo's.
// Municipio di Monreale (w153225657). Commons "90046 Monreale, Province of Palermo, Italy - panoramio (1)" (the whole front, 2013). Read: nine bays with a round arched ground floor and a middle door, a long
//  iron balcony, brown shuttered windows, white busts in roundels, two coats of arms, the eagle, a top cornice. The square slopes about 9 m along the front in the game, so the arches stay level under the
//  balcony and the lower bays get a plain base with a door. Not verified: the other sides (plain ochre), the courtyard, the roofs.
// Palazzo Arcivescovile di Monreale (w182545414). Commons "Rear entrance - Cathedral of Monreale - Italy 2015" and the museum entrance photo on themaprogetto.it; SITR orthophoto 2013. Read: the white gateway,
//  standing over the map's service way (its arch drawn wide enough to drive through), with salmon pilasters, coat of arms, an iron fanlight and a niche with a bust over a side door; the white block set back
//  above it; the stone tower with merlons, a balcony, barred windows, a diamond frieze, a pointed window and the museum's banner. The tower and the gateway are placed from the orthophoto, so only to about
//  3 m, and both stand a little outside the outline (walls added); the gateway is drawn about a third narrower than the photo suggests so that it clears Via Cappuccini. Not drawn: the retaining wall and
//  railing along the street, the banner's lettering, the plain wall between the tower and the apses. Not verified: every other face (plain), the roofs. The Commons pictures titled with this palace's name that
//  show a garden court belong to the monastery next door and were not used.
import * as THREE from 'three';
import { PI, bx, box, cyl, cone, sphere, extrude, prism, part, panel, gridMesh, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, pairsOf, groundRange, gable, pyramid, rail, RNG } from './lmc-kit.js';

// ---- shared helpers
const B = (M, x0, x1, y0, y1, z0, z1, c, o) => bx('flat', M, x0, x1, y0, y1, z0, z1, { c, noao: true, ...o });
// a wall mass with its roof cap, noted as solid so the lean renderer can hide what is behind it, as it did behind the generic building
let SOLIDS = [];
const body = (pts, y0, y1, c, roof = '#8a7e72') => { prism('flat', pts, y0, y1, { c }); prism('flat', pts, y1, y1 + 0.14, { c: roof, noao: true }); SOLIDS.push([pts.flat(), null, y1]); };
const done = (name) => { const o = end(name); o.userData.solids = SOLIDS; SOLIDS = []; return o; };
const shapeOf = (p) => { const s = new THREE.Shape(); p.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// a frame in the middle of the wall from a (its left end seen from outside) to b, at height y, +z out of the wall
function face(a, b, y) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return { M: frame((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, -dz / l, dx / l), l }; }
const segs = (pts) => pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; return [a[0], a[1], b[0], b[1]]; });
const lowest = (pts) => groundRange(pts).lo - 1.2;
// the line of an arch from the left springing to the right one: middle x, half width r, springing s, rise v; pointed if k
function archLine(x, r, s, v, k, n = 6) {
  const o = [];
  if (!k) { for (let i = 0; i <= 2 * n; i++) { const a = PI - i / (2 * n) * PI; o.push([x + Math.cos(a) * r, s + Math.sin(a) * v]); } return o; }
  const q = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  for (let i = 0; i <= n; i++) o.push(q([x - r, s], [x - r, s + v * 0.68], [x, s + v], i / n));
  for (let i = 1; i <= n; i++) o.push(q([x, s + v], [x + r, s + v * 0.68], [x + r, s], i / n));
  return o;
}
// atlas regions: metres (x0.., y0.. up) drawn into the pixel rectangle px, py, pw, ph of the canvas
const reg = (x0, y0, x1, y1, px, py, pw, ph) => ({ x0, y0, w: x1 - x0, h: y1 - y0, px, py, pw, ph });
// the outline p (region metres) as a one sided painted sheet at depth z of the frame M
const sheet = (key, CW, CH, A, M, p, z = 0.05) => part(key, new THREE.ShapeGeometry(shapeOf(p), 1), { M, p: [0, 0, z], uv: 'keep', uvk: [A.pw / (A.w * CW), A.ph / (A.h * CH)], uvo: [(A.px - A.x0 * A.pw / A.w) / CW, (CH - A.py - A.ph - A.y0 * A.ph / A.h) / CH], noao: true });
const full = (A) => rect(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h);
// painter for one region
function pen(g, A) {
  const sx = A.pw / A.w, sy = A.ph / A.h, X = x => A.px + (x - A.x0) * sx, Y = y => A.py + A.ph - (y - A.y0) * sy;
  const R = (a, y0, b, y1, c) => { g.fillStyle = c; g.fillRect(X(a), Y(y1), (b - a) * sx, (y1 - y0) * sy); };
  const poly = (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const circ = (x, y, r, c, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, (ry || r) * sy, 0, 0, 2 * PI); g.fill(); };
  const ring = (x, y, r, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.stroke(); };
  const line = (a, y0, b, y1, t, c) => { g.strokeStyle = c; g.lineWidth = Math.max(1, t * sx); g.beginPath(); g.moveTo(X(a), Y(y0)); g.lineTo(X(b), Y(y1)); g.stroke(); };
  const path = (p, t, c) => { for (let i = 1; i < p.length; i++) line(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], t, c); };
  const arch = (x, y0, y1, ww, c, k) => { const r = ww / 2, v = k ? Math.min(y1 - y0, r * 1.35) : r; poly([[x - r, y0], ...archLine(x, r, y1 - v, v, k), [x + r, y0]], c); };
  // a ledge: lit on top, shadow under it
  const ledge = (a, y0, b, y1, c) => { R(a, y0, b, y1, c); R(a, y1 - Math.min(0.14, (y1 - y0) / 2), b, y1, 'rgba(255,240,215,0.35)'); R(a, y0 - 0.2, b, y0, 'rgba(45,28,15,0.36)'); };
  // an upright strip with a lit and a shaded edge
  const strip = (a, y0, b, y1, c) => { R(a, y0, b, y1, c); R(a, y0, a + 0.09, y1, 'rgba(255,240,215,0.32)'); R(b, y0, b + 0.13, y1, 'rgba(45,28,15,0.34)'); };
  // ashlar courses
  const ashlar = (a, y0, b, y1, c, seed, course = 0.5, block = 1.1, k = 1) => {
    R(a, y0, b, y1, c); const r = RNG(seed);
    for (let y = y0; y < y1 - 0.01; y += course) {
      let x = a - r() * block; const t = Math.min(y1, y + course);
      while (x < b) { const bw = block * (0.7 + r() * 0.6), l = Math.max(a, x), q = Math.min(b, x + bw); if (q > l) { const v = r(); R(l, y, q, t, v < 0.5 ? `rgba(55,33,15,${v * 0.3 * k})` : `rgba(255,230,190,${(v - 0.5) * 0.28 * k})`); R(l, y, l + 0.06, t, `rgba(60,38,20,${0.28 * k})`); } x += bw; }
      R(a, y, b, y + 0.06, `rgba(60,38,20,${0.3 * k})`);
    }
  };
  // rubble: small stones of mixed colour
  const rubble = (a, y0, b, y1, seed, cols, n, r0 = 0.28) => { const r = RNG(seed); for (let i = 0; i < n; i++) circ(a + r() * (b - a), y0 + r() * (y1 - y0), r0 * (0.4 + r() * 0.8), cols[Math.floor(r() * cols.length)], r0 * (0.25 + r() * 0.5)); };
  // patches of bare or damp plaster
  const patches = (a, y0, b, y1, seed, c, n, r0 = 1.2) => { const r = RNG(seed); for (let i = 0; i < n; i++) { const x = a + r() * (b - a), y = y0 + r() * (y1 - y0), rr = r0 * (0.3 + r()); const q = []; for (let k = 0; k < 9; k++) { const t = k / 9 * 2 * PI, s = rr * (0.5 + r() * 0.7); q.push([x + Math.cos(t) * s, y + Math.sin(t) * s * 0.8]); } poly(q, c); } };
  // a rectangular window in a frame, with a grille or glazing bars
  const win = (x, y0, y1, ww, glass, frameC, bars) => { if (frameC) R(x - ww / 2 - 0.18, y0 - 0.18, x + ww / 2 + 0.18, y1 + 0.18, frameC); R(x - ww / 2, y0, x + ww / 2, y1, glass); R(x - ww / 2, y1 - 0.14, x + ww / 2, y1, 'rgba(0,0,0,0.35)'); if (bars) { for (let u = x - ww / 2 + ww / 4; u < x + ww / 2 - 0.05; u += ww / 4) R(u - 0.03, y0, u + 0.03, y1, bars); for (let v = y0 + 0.4; v < y1 - 0.1; v += 0.45) R(x - ww / 2, v - 0.03, x + ww / 2, v + 0.03, bars); } };
  return { g, A, X, Y, R, poly, circ, ring, line, path, arch, ledge, strip, ashlar, rubble, patches, win };
}
// paints one region: clipped, with the base colour, the painter, then stains, streaks, foot grime and grain
function region(g, A, base, seed, wear, fn) {
  g.save(); g.beginPath(); g.rect(A.px, A.py, A.pw, A.ph); g.clip();
  g.fillStyle = base; g.fillRect(A.px, A.py, A.pw, A.ph);
  fn(pen(g, A));
  const r = RNG(seed), { px, py, pw, ph } = A;
  for (let i = 0; i < 7; i++) { const x = px + r() * pw, y = py + r() * ph, rad = (0.12 + r() * 0.22) * Math.max(pw, ph), c = r() < 0.6 ? '55,38,22' : '255,244,222', gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(${c},${wear * (0.6 + r() * 0.8)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(px, py, pw, ph); }
  for (let i = 0; i < pw / 7; i++) { const x = px + r() * pw, y = py + r() * ph * 0.8, len = ph * (0.06 + r() * 0.2), gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(40,30,20,${wear * (0.5 + r())})`); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 2.5, len); }
  const gb = g.createLinearGradient(0, py + ph, 0, py + ph * 0.88); gb.addColorStop(0, 'rgba(40,28,18,0.24)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(px, py + ph * 0.88, pw, ph * 0.12);
  for (let i = 0; i < pw * ph / 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,235,0.08)' : 'rgba(50,40,28,0.1)'; g.fillRect(px + r() * pw, py + r() * ph, 1 + r() * 1.3, 1 + r() * 1.3); }
  g.restore();
}
const cross = (M, x, y, z, h, c = '#4a4036', t = 0.09) => { B(M, x - t / 2, x + t / 2, y, y + h, z - t / 2, z + t / 2, c); B(M, x - h * 0.28, x + h * 0.28, y + h * 0.62, y + h * 0.62 + t, z - t / 2, z + t / 2, c); };

// =====================================================================================================
// Chiesa Madre di Altofonte
// =====================================================================================================
const AM_P = [[-5449.4, 7810.2], [-5454.3, 7836.6], [-5456.0, 7844.5], [-5460.8, 7843.6], [-5465.8, 7842.7], [-5465.5, 7841.0], [-5464.9, 7838.1], [-5463.9, 7832.8], [-5461.9, 7822.4], [-5460.5, 7814.8], [-5460.0, 7812.4], [-5459.3, 7808.4]];
const amF = reg(-5, -2.4, 5, 13.2, 0, 0, 160, 256), amB = reg(-5, -2.4, 5, 17, 160, 0, 96, 256);
function amTex(g) {
  region(g, amF, '#e3d5c0', 31001, 0.07, (p) => {
    const { R, circ, ring, poly, arch, ledge, strip, line } = p, OR = '#c48a60';
    R(-5, -2.4, 5, 0.5, '#aaa092');
    for (const s of [-1, 1]) strip(s * 4.55 - 0.42, 0.5, s * 4.55 + 0.42, 11.8, OR);
    R(-5, 11.8, 5, 13.2, OR); ledge(-5, 12.55, 5, 12.85, '#d8a276'); ledge(-5, 11.75, 5, 11.95, '#d8a276');
    // the round window, the coat of arms and the tablet
    circ(0, 9.35, 1.28, '#b57a50'); ring(0, 9.35, 1.14, 0.12, '#dba57a'); circ(0, 9.35, 0.86, '#8a7660'); circ(0, 9.35, 0.72, '#232630'); line(-0.72, 9.35, 0.72, 9.35, 0.06, '#4a4a52'); line(0, 8.63, 0, 10.07, 0.06, '#4a4a52');
    circ(0, 7.75, 0.42, '#cfcabc', 0.58); circ(0, 7.72, 0.26, '#a8a296', 0.36); circ(0, 8.28, 0.16, '#bdb7a8'); R(-0.55, 6.55, 0.55, 7.05, '#cdc7ba'); for (let y = 6.65; y < 7; y += 0.13) R(-0.42, y, 0.42, y + 0.04, '#8c867a');
    // the portal: pilasters, entablature, broken pediment, the grey surround and the bronze door
    for (const s of [-1, 1]) { strip(s * 1.9 - 0.42, 0.5, s * 1.9 + 0.42, 5.25, OR); R(s * 1.9 - 0.52, 5.0, s * 1.9 + 0.52, 5.3, '#cdc4b4'); R(s * 1.9 - 0.52, 0.5, s * 1.9 + 0.52, 1.25, '#bdb4a4'); }
    R(-2.5, 5.3, 2.5, 5.95, OR); ledge(-2.55, 5.95, 2.55, 6.15, '#d2c8b6');
    for (const s of [-1, 1]) { poly([[s * 2.55, 6.15], [s * 0.85, 6.15], [s * 0.85, 7.1], [s * 1.2, 7.15]], OR); line(s * 2.6, 6.2, s * 1.0, 7.2, 0.18, '#cfc6b4'); }
    R(-1.45, 0.5, 1.45, 5.25, '#d4cec0'); arch(0, 0.5, 4.95, 2.45, '#6f6a5e'); arch(0, 0.5, 4.85, 2.25, '#3f6b57'); R(-0.04, 0.5, 0.04, 3.6, '#1f352c'); R(-1.1, 3.6, 1.1, 3.72, '#274436');
    for (const s of [-1, 1]) for (let y = 0.8; y < 3.4; y += 0.65) { R(s * 0.56 - 0.38, y, s * 0.56 + 0.38, y + 0.5, '#4e7d66'); circ(s * 0.56, y + 0.25, 0.14, '#2f5444'); }
    for (let k = 0; k < 7; k++) { const a = PI * (k + 1) / 8; line(0, 3.75, Math.cos(a) * 1.05, 3.75 + Math.sin(a) * 1.05, 0.05, '#1f352c'); }
  });
  region(g, amB, '#eadcc8', 31002, 0.09, (p) => {
    const { R, circ, ring, ledge, line, patches } = p;
    patches(-5, 0, 5, 7, 31003, 'rgba(150,120,90,0.12)', 12, 1.0);
    ledge(-5, 16.4, 5, 16.85, '#e2c2a4'); ledge(-5, 13.2, 5, 13.45, '#d9c4aa');
    circ(0, 8.4, 1.0, '#e0c7a2'); ring(0, 8.4, 0.88, 0.1, '#efe2c6'); circ(0, 8.4, 0.66, '#3a3434'); line(-0.66, 8.4, 0.66, 8.4, 0.09, '#cbbfa8'); line(0, 7.74, 0, 9.06, 0.09, '#cbbfa8');
    ledge(-2.0, 3.65, 2.0, 3.9, '#d4c0a4'); R(-1.35, 0, 1.35, 3.35, '#a89078'); R(-1.1, 0, 1.1, 3.15, '#3d2a1e'); R(-0.03, 0, 0.03, 3.15, '#1a100a'); for (const s of [-1, 1]) for (let y = 0.25; y < 2.8; y += 0.75) R(s * 0.55 - 0.34, y, s * 0.55 + 0.34, y + 0.55, '#4d3626');
    R(-2.5, 1.9, -1.65, 2.8, '#7a5a40'); R(-2.42, 1.98, -1.73, 2.72, '#d8cdb6');
  });
}
function buildAltofonte() {
  initShared();
  const K = 'c3AltoMadre';
  defMat(K, 256, 256, [1, 1], amTex);
  const SH = (A, M, p, z) => sheet(K, 256, 256, A, M, p, z);
  const fa = [-5465.8, 7842.7], fb = [-5456.0, 7844.5], ba = [-5449.4, 7810.2], bb = [-5459.3, 7808.4];
  const y0 = groundY(-5460.9, 7844.4), yb = groundY(-5454.3, 7808.8), lo = lowest(AM_P);
  begin(yb);
  const front = [[-5452.6, 7826.5], fb, [-5460.8, 7843.6], fa, [-5465.5, 7841.0], [-5463.9, 7832.8], [-5462.5, 7825.2]], rear = [[-5449.4, 7810.2], [-5452.6, 7826.5], [-5462.5, 7825.2], [-5460.5, 7814.8], [-5460.0, 7812.4], [-5459.3, 7808.4]];
  const FE = y0 + 12.0, BE = yb + 16.6;
  body(front.map((q, i) => (i === 1 || i === 2 || i === 3) ? [q[0] + 0.07, q[1] - 0.4] : q), lo, FE, '#dccdb6', '#a47660');
  body(rear.map((q, i) => (i === 0 || i === 5) ? [q[0] - 0.05, q[1] + 0.3] : q), lo, BE, '#dfd0bc');
  // front: the painted wall with its cornices standing out
  const F = face(fa, fb, y0).M;
  extrude('flat', shapeOf(rect(-4.98, lo - y0, 4.98, 13.2)), 0.4, { M: F, p: [0, 0, -0.42], c: '#dccdb6', noao: true });
  SH(amF, F, rect(-5, -2.4, 5, 13.2), 0.02);
  if (lo - y0 < -2.4) B(F, -5, 5, lo - y0, -2.4, -0.1, 0.01, '#a79d8e');
  B(F, -5.15, 5.15, 12.9, 13.25, -0.35, 0.28, '#cf966c'); B(F, -5.08, 5.08, 11.8, 11.98, -0.1, 0.16, '#d6a077');
  B(F, -2.55, 2.55, 5.95, 6.13, 0, 0.3, '#d2c8b6');
  for (const s of [-1, 1]) { box('flat', 1.85, 0.2, 0.34, { M: F, p: [s * 1.78, 6.55, 0.14], rz: -s * 0.5, c: '#cdc3b0', noao: true }); B(F, s * 1.9 - 0.4, s * 1.9 + 0.4, 0.5, 5.25, 0, 0.14, '#c48a60'); }
  const axis = [-5454.3 + 5460.9, 7809.3 - 7843.6], al = Math.hypot(...axis);
  gable('flat', 'flat', frame(-5459.4, 0, 7834.5, axis[0] / al, axis[1] / al), 8.4, 15.6, FE + 0.1, 1.0, { ov: 0.05, c: '#a86a4e', wc: '#dccdb6' });
  // the north end on the lane
  const N = face(ba, bb, yb).M;
  extrude('flat', shapeOf(rect(-5.03, lo - yb, 5.03, 17)), 0.35, { M: N, p: [0, 0, -0.37], c: '#e2d3bf', noao: true });
  SH(amB, N, rect(-5, -2.4, 5, 17), 0.02);
  B(N, -5.1, 5.1, 16.4, 16.85, -0.3, 0.26, '#dfbfa0'); B(N, -2.0, 2.0, 3.65, 3.86, 0, 0.3, '#d2bea2');
  // the bell turret
  const T = mul(N, tr(-0.35, 18.0, -1.05));
  B(T, -1.15, 1.15, -1.3, 0.5, -1.0, 1.0, '#e8d8c2');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(T, sx * 1.0 - 0.28, sx * 1.0 + 0.28, 0.5, 2.9, sz * 1.0 - 0.28, sz * 1.0 + 0.28, '#e9dac6');
  B(T, -0.7, 0.7, 0.5, 2.6, -0.7, 0.7, '#2e2724'); cyl('flat', 0.18, 0.36, 0.6, 7, { M: T, p: [0, 1.6, 0], c: '#5c4a30', noao: true });
  for (let k = 0; k < 4; k++) { const R = mul(T, rotY(k * PI / 2)); extrude('flat', shapeOf([[-0.74, 2.9], [-0.74, 2.2], ...archLine(0, 0.74, 2.2, 0.55, 0, 4), [0.74, 2.9]]), 0.12, { M: R, p: [0, 0, 1.12], c: '#e9dac6', noao: true }); }
  B(T, -1.28, 1.28, 2.9, 3.15, -1.28, 1.28, '#e0c4a8');
  pyramid('flat', 2.4, 2.4, 1.5, { M: T, p: [0, 3.15, 0], c: '#d29a82', noao: true }); sphere('flat', 0.18, { M: T, p: [0, 4.75, 0], seg: 6, c: '#7a6a60', noao: true }); cross(T, 0, 4.85, 0, 1.1, '#38322e', 0.07);
  return done('Chiesa Madre di Altofonte');
}

// =====================================================================================================
// Cappella di San Michele, Altofonte
// =====================================================================================================
const SM_P = [[-5455.1, 7787.1], [-5453.8, 7787.4], [-5443.7, 7789.4], [-5444.9, 7795.4], [-5456.2, 7793.1]];
const SM_L = 11.55, smN = reg(-5.8, -2.0, 5.8, 9.0, 0, 0, 256, 224);
const SM_LOBES = [[-3.85, 8.55], [0, 8.9], [3.85, 8.55]];   // middle and crown of each rounded gable
const smTop = () => { const p = []; for (const [x, top] of SM_LOBES) p.push(...archLine(x, 1.9, 7.25, top - 7.25, 0, 5)); return p; };
function smTex(g) {
  region(g, smN, '#c3b6a1', 31101, 0.13, (p) => {
    const { R, circ, arch, ledge, patches, line, path } = p;
    patches(-5.8, -1, 5.8, 8.5, 31102, 'rgba(235,222,200,0.28)', 22, 0.9); patches(-5.8, -1, 5.8, 6, 31103, 'rgba(90,74,55,0.16)', 18, 0.7);
    for (const x of [-3.85, 0, 3.85]) { arch(x, 5.85, 7.4, 0.82, '#8d7c64'); arch(x + 0.08, 5.92, 7.3, 0.55, '#e6e2d6'); for (let y = 6.0; y < 7.2; y += 0.17) for (let u = -0.14; u < 0.3; u += 0.17) circ(x + u, y, 0.045, '#4c4438'); }
    ledge(-5.8, 5.45, 5.8, 5.66, '#99958c');
    // the buttress step at the east end, a crack, the damp run and the wires
    R(-5.7, 3.6, -4.5, 5.4, '#b9ab94'); R(-4.5, 3.6, -4.38, 5.4, 'rgba(50,35,20,0.35)');
    path([[0.3, 5.3], [0.1, 4.4], [0.35, 3.9], [0.2, 3.3]], 0.05, 'rgba(45,35,25,0.7)');
    R(4.55, 0, 4.85, 5.4, 'rgba(45,35,25,0.22)'); line(-5.8, 1.5, 4.1, 2.35, 0.035, '#5a5048'); line(4.1, 2.35, 4.25, 4.2, 0.035, '#5a5048'); line(4.25, 4.2, 5.8, 4.5, 0.035, '#5a5048');
    // the brown sign on its post
    R(3.95, -0.3, 4.03, 1.55, '#8a8c90'); R(3.45, 1.45, 4.75, 2.4, '#e9e4da'); R(3.5, 1.5, 4.7, 2.35, '#5d3020');
    p.g.fillStyle = '#f2ece0'; p.g.textAlign = 'center'; p.g.textBaseline = 'middle'; p.g.font = `bold ${Math.round(0.2 * smN.ph / smN.h)}px sans-serif`;
    ['CAPPELLA', 'NORMANNA', 'S. MICHELE'].forEach((t, i) => p.g.fillText(t, p.X(4.1), p.Y(2.18 - i * 0.24), 1.1 * smN.pw / smN.w));
    R(-5.8, -2, 5.8, 0.15, 'rgba(60,48,36,0.35)');
  });
}
function buildSanMichele() {
  initShared();
  const K = 'c3AltoCapp';
  defMat(K, 256, 224, [1, 1], smTex);
  const y0 = Math.min(groundY(-5444.5, 7788.6), groundY(-5454.5, 7786.5)), lo = lowest(SM_P);
  begin(y0);
  body([[-5455.2, 7787.55], [-5443.8, 7789.85], [-5444.9, 7795.4], [-5456.2, 7793.1]], lo, y0 + 7.25, '#bfb29d', '#a08f7c');
  const N = face(SM_P[2], SM_P[0], y0).M, h = SM_L / 2, top = smTop();
  const outline = [[-h, Math.max(-2, lo - y0)], [h, Math.max(-2, lo - y0)], [h, 7.25], ...top.slice().reverse(), [-h, 7.25]];
  extrude('flat', shapeOf(outline), 0.42, { M: N, p: [0, 0, -0.44], c: '#bdb09b', noao: true });
  sheet(K, 256, 224, smN, N, outline, 0.02);
  if (lo - y0 < -2) B(N, -h, h, lo - y0, -2, -0.2, 0, '#a89c88');
  // the corbelled copings along the rounded gables
  for (const [x, crown] of SM_LOBES) {
    const q = archLine(x, 1.9, 7.25, crown - 7.25, 0, 5);
    for (let i = 1; i < q.length; i++) { const a = q[i - 1], b = q[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); box('flat', l + 0.06, 0.24, 0.72, { M: N, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.1, -0.2], rz: Math.atan2(b[1] - a[1], b[0] - a[0]), c: '#71614f', noao: true }); if (i % 2) B(N, (a[0] + b[0]) / 2 - 0.08, (a[0] + b[0]) / 2 + 0.08, (a[1] + b[1]) / 2 - 0.36, (a[1] + b[1]) / 2 - 0.12, -0.05, 0.16, '#8a7862'); }
  }
  B(N, -h, h, 5.46, 5.62, 0, 0.18, '#98948b'); B(N, -h, -4.45, 3.6, 3.72, 0, 0.14, '#cfc8b8');
  return done('Cappella di San Michele ad Altofonte');
}

// =====================================================================================================
// Collegiata del Santissimo Crocifisso, Monreale
// =====================================================================================================
const CL_P = [[-6067.3, 3519.1], [-6028.4, 3501.4], [-6023.0, 3513.1], [-6039.4, 3520.6], [-6037.4, 3524.9], [-6059.9, 3535.2]];
const clF = reg(-8.86, -5.0, 8.86, 17.4, 0, 0, 192, 256), clS = reg(-12.36, -8.0, 12.36, 13.2, 192, 0, 256, 224), clT = reg(-2.5, 6.0, 2.5, 21.0, 448, 0, 64, 192);
const CL_W = '#ece5d4', CL_C = '#e2d3b2', CL_ST = '#b0a591';
const clFrontOutline = (y0) => { const p = [[-8.86, y0], [8.86, y0], [8.86, 13.2]]; p.push([8.1, 13.2], [6.7, 13.45], [5.9, 14.1], [5.65, 15.0], [5.2, 15.0], [0, 17.35], [-5.2, 15.0], [-5.65, 15.0], [-5.9, 14.1], [-6.7, 13.45], [-8.1, 13.2], [-8.86, 13.2]); return p; };
function clTex(g) {
  region(g, clF, CL_W, 31201, 0.05, (p) => {
    const { R, circ, ring, poly, arch, ledge, strip, line, path } = p;
    R(-8.86, -5, 8.86, 0, CL_ST); for (let y = -4.4; y < 0; y += 0.8) R(-8.86, y, 8.86, y + 0.06, 'rgba(70,55,40,0.25)');
    for (const s of [-1, 1]) { strip(s * 8.3 - 0.45, 0, s * 8.3 + 0.45, 13.2, CL_C); strip(s * 5.0 - 0.4, 0, s * 5.0 + 0.4, 15, CL_C); }
    ledge(-8.86, 8.0, 8.86, 8.3, CL_C); ledge(-8.86, 12.75, -5.2, 13.15, CL_C); ledge(5.2, 12.75, 8.86, 13.15, CL_C); ledge(-5.4, 13.0, 5.4, 13.25, CL_C);
    for (const s of [-1, 1]) { line(s * 5.3, 14.8, 0, 17.15, 0.25, CL_C); circ(s * 6.35, 13.85, 0.42, '#d9c9a8'); ring(s * 6.35, 13.85, 0.3, 0.1, '#b79e7c'); R(s * 7.2 - 1.3, 8.9, s * 7.2 + 1.3, 12.1, 'rgba(120,100,70,0.08)'); }
    circ(0, 11.1, 1.05, '#d3c6a8'); circ(0, 11.1, 0.78, '#2c2a2c'); ring(0, 11.1, 0.78, 0.09, '#8d8474');
    // the stone portal with its broken curved pediment
    for (const s of [-1, 1]) { strip(s * 1.85 - 0.38, 0, s * 1.85 + 0.38, 5.3, '#bcb1a0'); R(s * 1.85 - 0.5, 4.95, s * 1.85 + 0.5, 5.3, '#d2c9b8'); path([[s * 2.5, 5.75], [s * 2.2, 6.5], [s * 1.5, 6.95], [s * 0.75, 7.05]], 0.34, '#a89c8a'); path([[s * 2.55, 5.9], [s * 2.25, 6.68], [s * 1.5, 7.15], [s * 0.75, 7.24]], 0.13, '#b97058'); }
    ledge(-2.5, 5.3, 2.5, 5.75, '#cbc1ae'); R(-0.6, 5.8, 0.6, 6.7, '#c4baa8'); circ(0, 6.25, 0.3, '#a2978a');
    R(-1.45, 0, 1.45, 4.95, '#cdc3b0'); R(-1.15, 0, 1.15, 4.55, '#3d5a4a'); R(-0.04, 0, 0.04, 4.55, '#1c2c24'); for (const s of [-1, 1]) for (let y = 0.3; y < 4.1; y += 0.85) R(s * 0.58 - 0.38, y, s * 0.58 + 0.38, y + 0.65, '#4a6c5a');
  });
  region(g, clS, CL_W, 31202, 0.1, (p) => {
    const { R, circ, arch, ledge, strip, win, poly, line } = p, X = u => u - 12.36;
    // the stone base with the balustrade of the terrace
    R(-12.36, -8, 12.36, 0, CL_ST); for (let y = -7.4; y < -1.5; y += 0.75) R(-12.36, y, 12.36, y + 0.07, 'rgba(70,55,40,0.28)');
    ledge(-12.36, -1.45, 12.36, -1.15, '#c8bfac'); for (let u = -12.1; u < 12.3; u += 0.46) { R(u - 0.09, -1.15, u + 0.09, -0.25, '#cfc6b2'); circ(u, -0.82, 0.14, '#cfc6b2', 0.24); } ledge(-12.36, -0.25, 12.36, 0.05, '#d4ccba');
    R(-12.36, 0, -11.2, 12.4, CL_C); R(11.8, 0, 12.36, 12.4, CL_C);
    for (const [a, b] of [[0.9, 6.0], [6.9, 11.5], [12.4, 16.4], [17.3, 21.5], [22.4, 24.4]]) { R(X(a), 0.9, X(b), 11.7, CL_C); R(X(a) + 0.18, 1.08, X(b) - 0.18, 11.52, '#ece6d2'); }
    win(X(3.4), 8.5, 9.9, 1.2, '#35302c', '#d6c6a4', '#8a8070');
    for (const u of [9.2, 14.4, 19.4]) { poly([[X(u) - 1.75, 7.75], ...[...Array(9)].map((_, i) => { const a = PI - i / 8 * PI; return [X(u) + Math.cos(a) * 1.75, 7.75 + Math.sin(a) * 1.75]; })], '#d4c29e'); poly([...[...Array(9)].map((_, i) => { const a = PI - i / 8 * PI; return [X(u) + Math.cos(a) * 1.5, 7.85 + Math.sin(a) * 1.45]; })], '#56646a'); for (let k = -2; k <= 2; k++) line(X(u) + k * 0.5, 7.85, X(u) + k * 0.5, 7.85 + Math.sqrt(1 - (k / 3) ** 2) * 1.42, 0.07, '#c9c2ae'); line(X(u) - 1.4, 8.45, X(u) + 1.4, 8.45, 0.06, '#c9c2ae'); }
    for (const u of [6.45, 11.95, 16.85, 21.95]) { R(X(u) - 0.17, 0.9, X(u) + 0.17, 11.7, '#b6795a'); R(X(u) + 0.17, 0.9, X(u) + 0.26, 11.7, 'rgba(50,30,15,0.3)'); for (let y = 1.5; y < 11.5; y += 1.3) R(X(u) - 0.21, y, X(u) + 0.21, y + 0.12, '#8f5a42'); }
    win(X(23.4), 5.5, 7.6, 0.7, '#4a4038', '#d6c6a4', '#8a8070');
    ledge(-12.36, 12.2, 12.36, 12.55, CL_C); R(-12.36, 12.55, 12.36, 13.2, '#e6dcc4');
  });
  region(g, clT, '#dbc0aa', 31203, 0.09, (p) => {
    const { R, arch, ledge, win, strip } = p;
    for (const s of [-1, 1]) strip(s * 2.15 - 0.35, 6, s * 2.15 + 0.35, 20.4, '#e4d2bc');
    arch(0, 16.2, 18.8, 1.7, '#ead9c4'); arch(0, 16.3, 18.6, 1.25, '#2e2824'); R(-0.5, 16.3, 0.5, 17.3, '#463a30');
    win(0, 13.2, 14.6, 0.55, '#35302c', '#e6d4be'); win(0, 9.6, 11.5, 0.8, '#40362e', '#e6d4be', '#a89a86');
    ledge(-2.5, 15.3, 2.5, 15.55, '#e8d8c2'); ledge(-2.5, 20.3, 2.5, 20.7, '#a05c4c'); R(-2.5, 20.7, 2.5, 21, '#e0ccb6');
  });
}
function buildCollegiata() {
  initShared();
  const K = 'c3Colleg';
  defMat(K, 512, 256, [1, 1], clTex);
  const SH = (A, M, p, z) => sheet(K, 512, 256, A, M, p, z);
  const v0 = CL_P[0], v4 = CL_P[4], v5 = CL_P[5];
  const y0 = groundY(-6063.8, 3526.8) + 0.1, lo = lowest(CL_P), E = y0 + 13.0;
  begin(y0);
  body([[-6066.9, 3519.35], [-6028.4, 3501.7], [-6023.35, 3513.0], [-6039.55, 3520.4], [-6037.55, 3524.65], [-6059.75, 3534.85]], lo, y0 + 12.6, '#e2dac6');
  const ax = 0.909, az = -0.416;
  gable('flat', 'flat', frame(-6046.1, 0, 3517.0, ax, az), 11.4, 31, y0 + 12.7, 2.7, { ov: 0.1, c: '#b57a5a', wc: '#ded5c0' });
  // front
  const F = face(v0, v5, y0).M, fl = Math.max(-5, lo - y0);
  extrude('flat', shapeOf(clFrontOutline(lo - y0)), 0.45, { M: F, p: [0, 0, -0.45], c: '#e6deca', noao: true });
  SH(clF, F, clFrontOutline(fl), 0.04);
  for (const s of [-1, 1]) { B(F, s * 8.3 - 0.45, s * 8.3 + 0.45, 13.2, 14.5, -0.42, 0.12, CL_C); sphere('flat', 0.27, { M: F, p: [s * 8.3, 14.75, -0.15], seg: 6, c: '#cfc6b2', noao: true }); box('flat', 5.8, 0.26, 0.62, { M: F, p: [s * 2.65, 16.0, -0.18], rz: -s * Math.atan2(2.35, 5.2), c: '#d9ccb0', noao: true }); }
  B(F, -2.55, 2.55, 5.3, 5.62, 0, 0.34, '#cbc1ae'); B(F, -8.9, 8.9, 8.0, 8.22, -0.1, 0.18, CL_C);
  for (const s of [-1, 1]) { B(F, s * 1.85 - 0.32, s * 1.85 + 0.32, Math.min(0, fl), 5.3, 0, 0.22, '#bcb1a0'); box('flat', 1.5, 0.24, 0.34, { M: F, p: [s * 1.75, 6.65, 0.15], rz: -s * 0.45, c: '#a98a78', noao: true }); }
  // the south flank
  const S = face(v5, v4, y0).M;
  SH(clS, S, rect(-12.36, Math.max(-8, lo - y0), 12.36, 13.2), 0.03);
  B(S, -12.36, 12.36, 12.6, 13.2, -0.4, 0.0, '#ded4bc'); B(S, -12.4, 12.4, 12.2, 12.5, 0, 0.22, CL_C); B(S, -12.36, 12.36, -0.2, 0.02, 0, 0.26, '#cfc7b4'); B(S, -12.36, 12.36, -1.45, -1.2, 0, 0.2, '#c2b9a6');
  // the bell tower in the step of the outline
  const T = mul(S, tr(14.86, 0, -2.35));
  B(T, -2.45, 2.45, lo - y0, 20.7, -2.33, 2.33, '#d6bda8');
  for (const [a, w] of [[0, 2.34], [PI / 2, 2.46], [PI, 2.34], [-PI / 2, 2.46]]) { const k = a === 0 || a === PI ? 1 : 0.95; sheet(K, 512, 256, { ...clT, x0: clT.x0 * k, w: clT.w * k }, mul(T, rotY(a)), rect(-2.45 * k, 6, 2.45 * k, 21), w + 0.02); }
  B(T, -2.75, 2.75, 20.6, 21.0, -2.65, 2.65, '#a2604e');
  for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) { B(T, i * 1.25 - 0.035, i * 1.25 + 0.035, 21.0, 22.0, s * 2.55 - 0.035, s * 2.55 + 0.035, '#45403c'); B(T, s * 2.65 - 0.035, s * 2.65 + 0.035, 21.0, 22.0, i * 1.2 - 0.035, i * 1.2 + 0.035, '#45403c'); }
  for (const s of [-1, 1]) { B(T, -2.66, 2.66, 21.95, 22.02, s * 2.55 - 0.03, s * 2.55 + 0.03, '#45403c'); B(T, s * 2.65 - 0.03, s * 2.65 + 0.03, 21.95, 22.02, -2.56, 2.56, '#45403c'); }
  pyramid('flat', 3.4, 3.4, 4.6, { M: T, p: [0, 21.0, 0], c: '#7f9e72', noao: true }); sphere('flat', 0.22, { M: T, p: [0, 25.75, 0], seg: 6, c: '#8d8a80', noao: true }); cross(T, 0, 25.9, 0, 1.3, '#55504a', 0.1);
  return done('Collegiata di Monreale');
}
// the tower stands outside the outline, in its step: walls round the three free sides
const CL_WALLS = (() => { const W = (u, d) => [-6059.9 + 0.909 * u + (-0.416) * d, 3535.2 - 0.416 * u - 0.909 * d], q = [W(24.7, 0.05), W(29.7, 0.05), W(29.7, 4.7)]; return [[...q[0], ...q[1]], [...q[1], ...q[2]]]; })();

// =====================================================================================================
// Convento di San Giovanni Battista, Baida
// =====================================================================================================
const BD_NA = [-5623.3, 76.8], BD_NB = [-5671.0, 83.8];   // the north front, east end then west end
const BD_CA = [-5666.9, 143.0], BD_CB = [-5665.3, 153.9];  // the church front
const BD_OA = [-5683.6, 145.3], BD_OB = [-5674.4, 144.4];  // the ochre front
const bdN = reg(-24.1, -0.2, 24.1, 12.0, 0, 0, 512, 128), bdO = reg(-4.65, -0.6, 4.65, 15.0, 0, 128, 160, 256), bdC = reg(-5.65, -1.0, 5.65, 9.4, 160, 128, 192, 192), bdG = reg(-4.8, 8.4, 4.8, 14.2, 352, 128, 160, 96), bdI = reg(-5.65, -1.0, 5.65, 8.0, 352, 224, 160, 128);
const BD_TUFA = '#bc8c62', BD_OCH = '#dcb785', BD_PALE = '#e9e3d0', BD_SEAM = -7.1;
const BD_ARCH = [[-3.35, 0.98, 4.55, 1.6], [0.0, 1.3, 4.9, 1.85], [3.45, 0.98, 4.55, 1.6]];   // the porch: middle, half width, springing, rise
const bdGable = [[-4.75, 8.4], [4.75, 8.4], [4.75, 10.9], [0, 14.0], [-4.75, 10.9]];
function bdTex(g) {
  region(g, bdN, BD_PALE, 31301, 0.07, (p) => {
    const { R, arch, win, ledge, ashlar, circ, path, poly } = p, FR = '#cfb27e', GL = '#4a2f2a';
    const w = (x, y, ww, hh, bars) => win(x, y, y + hh, ww, '#33302e', FR, bars || '#7a4538');
    const door = (x, y1, ww) => { arch(x, 0, y1 + 0.25, ww + 0.55, FR); arch(x, 0, y1, ww, GL); R(x - 0.03, 0, x + 0.03, y1 - 0.4, '#24140e'); };
    for (const x of [-22.0, -18.8, -12.3, -9.4]) { w(x, 8.7, 1.0, 1.35); w(x, 5.4, 1.0, 1.55); w(x, 1.4, 1.15, 1.75, '#2a2624'); }
    // the column of arched windows with little balconies
    for (const y of [4.7, 8.0]) { arch(-15.5, y - 0.25, y + 2.9, 2.05, FR); arch(-15.5, y, y + 2.65, 1.55, GL); R(-15.53, y, -15.47, y + 2.4, '#d9cdb8'); R(-16.5, y - 0.35, -14.5, y - 0.2, '#6e6a64'); for (let x = -16.4; x < -14.5; x += 0.22) R(x, y - 0.2, x + 0.05, y + 0.75, '#3a3634'); R(-16.45, y + 0.72, -14.55, y + 0.8, '#3a3634'); }
    door(-15.5, 2.9, 1.5);
    ashlar(BD_SEAM - 0.42, 0, BD_SEAM + 0.42, 12, '#b2a78f', 31302, 0.62, 0.8);
    for (const x of [-5.0, -2.1]) { w(x, 8.7, 1.0, 1.35); w(x, 1.3, 1.35, 1.95, '#2a2624'); }
    w(1.3, 8.7, 1.0, 1.35);
    // the two gothic stone niches: an empty one, and one round an upper window
    const niche = (x, y, hh, wn) => { arch(x, y, y + hh, 2.5, '#a8a294', 1); arch(x, y + 0.1, y + hh - 0.45, 1.65, '#e1dbc8', 1); circ(x - 0.42, y + hh - 0.95, 0.2, '#8f8878'); circ(x + 0.42, y + hh - 0.95, 0.2, '#8f8878'); circ(x, y + hh - 0.7, 0.17, '#8f8878'); if (wn) w(x, y + 0.35, 1.0, 1.35); };
    niche(0.6, 4.5, 3.4, false); niche(4.5, 8.0, 3.7, true);
    w(4.5, 4.9, 1.05, 1.7); R(3.55, 0, 5.45, 3.05, FR); R(3.9, 0, 5.1, 2.8, GL); R(4.45, 0, 4.55, 2.8, '#24140e');
    w(1.3, 1.3, 1.35, 1.95, '#2a2624');
    for (const x of [8.4, 11.2, 14.0, 16.8, 19.6, 22.3]) { w(x, 8.7, 0.95, 1.35); w(x, 5.2, 0.95, 1.45); w(x, 1.35, 1.15, 1.8, '#2a2624'); }
    R(-24.1, -0.2, 24.1, 0.45, '#c9c0aa');
  });
  region(g, bdO, BD_OCH, 31303, 0.07, (p) => {
    const { R, circ, ring, poly, arch, ledge, strip, ashlar, patches, line } = p, LT = '#e8cb9c';
    ashlar(-4.65, -0.6, -3.75, 4.0, '#b99768', 31304, 0.22, 0.3, 1.4); ashlar(3.75, -0.6, 4.65, 4.0, '#b99768', 31305, 0.22, 0.3, 1.4);
    for (const s of [-1, 1]) strip(s * 3.95 - 0.55, 4.0, s * 3.95 + 0.55, 12.0, LT);
    ledge(-4.65, 12.0, 4.65, 13.1, LT); for (let x = -4.4; x < 4.5; x += 0.24) R(x, 12.15, x + 0.12, 12.6, '#b8935f'); R(-4.65, 13.1, 4.65, 15, '#dcb785'); ledge(-4.65, 13.05, 4.65, 13.25, LT);
    for (const [x, r, top] of [[-2.35, 0.84, 11.15], [0, 0.98, 11.45], [2.35, 0.84, 11.15]]) { arch(x, 8.1, top + 0.25, r * 2 + 0.45, LT); arch(x, 8.1, top, r * 2, '#5a2e22'); for (const u of [-r / 2, 0, r / 2]) R(x + u - 0.03, 8.1, x + u + 0.03, top - r * 0.35, '#8a4a36'); for (let y = 8.8; y < top - 0.5; y += 0.7) R(x - r, y, x + r, y + 0.06, '#8a4a36'); R(x - r * 0.8, 9.0, x - r * 0.15, top - r, 'rgba(150,175,200,0.22)'); }
    ledge(-4.65, 7.15, 4.65, 7.35, LT);
    for (const [x, r] of [[-2.55, 0.92], [2.55, 0.78]]) { circ(x, 5.8, r + 0.15, '#ecd2a4'); circ(x, 5.8, r - 0.05, '#b88d5c'); circ(x + 0.08, 5.74, r - 0.18, '#d8b080'); }
    R(-1.25, 5.0, 1.25, 6.75, '#c09a6c'); R(-1.14, 5.1, 1.14, 6.65, '#e4dece'); for (let y = 5.3; y < 6.5; y += 0.2) R(-0.9, y, 0.9, y + 0.05, '#8a8274');
    arch(0, 3.0, 4.45, 1.9, '#d8cdb2'); arch(0, 3.15, 4.3, 1.6, '#7f9aae'); circ(-0.2, 3.55, 0.28, '#b08060'); circ(0.3, 3.45, 0.22, '#d8c080');
    R(-1.3, -0.1, 1.3, 3.0, '#e6dfd0'); ledge(-1.45, 2.75, 1.45, 3.02, '#e9e2d2'); R(-0.85, -0.1, 0.85, 2.5, '#6a2a1e'); R(-0.03, -0.1, 0.03, 2.5, '#30120a'); for (const s of [-1, 1]) for (let y = 0.2; y < 2.2; y += 0.65) R(s * 0.42 - 0.27, y, s * 0.42 + 0.27, y + 0.46, '#7e3828');
  });
  region(g, bdC, BD_TUFA, 31306, 0.13, (p) => {
    const { R, circ, path, poly, ashlar, patches, arch } = p;
    patches(-5.65, 0, 5.65, 9, 31307, 'rgba(230,205,170,0.3)', 34, 0.6); patches(-5.65, 0, 5.65, 9, 31308, 'rgba(120,70,35,0.22)', 30, 0.8); patches(-5.65, -1, 5.65, 2.2, 31309, 'rgba(40,32,26,0.32)', 16, 0.7);
    R(4.6, 0, 5.2, 5.5, 'rgba(50,38,28,0.3)');
    for (const [x, r, s, v] of BD_ARCH) { path(archLine(x, r + 0.28, s, v + 0.26, 1, 8), 0.24, '#d8b682'); path(archLine(x, r + 0.1, s, v + 0.09, 1, 8), 0.12, '#8a5c3a'); }
    for (const y of [-0.4, 0.45]) R(-5.65, y, 5.65, y + 0.06, 'rgba(60,40,25,0.3)');
    poly([[0, 6.75], [0.75, 7.45], [0, 8.15], [-0.75, 7.45]], '#ded4c2'); poly([[0, 7.0], [0.42, 7.45], [0, 7.95], [-0.42, 7.45]], '#b4a890'); circ(0, 7.45, 0.18, '#d8cebb');
    R(-5.65, 8.55, 5.65, 8.8, '#d1ae80'); R(-5.65, 8.4, 5.65, 8.55, 'rgba(70,40,20,0.35)');
  });
  region(g, bdG, '#b98b63', 31310, 0.13, (p) => {
    const { R, circ, line, path, arch, patches, strip } = p;
    patches(-4.8, 8.4, 4.8, 14.2, 31311, 'rgba(228,205,172,0.32)', 24, 0.55); patches(-4.8, 8.4, 4.8, 14, 31312, 'rgba(110,66,36,0.2)', 14, 0.6); R(3.9, 8.4, 4.8, 11, 'rgba(60,45,32,0.3)');
    // the corbel course under the raking edges
    for (const s of [-1, 1]) { line(s * 4.75, 10.8, 0, 13.92, 0.2, '#d6bc92'); for (let i = 1; i < 12; i++) { const t = i / 12, x = s * 4.75 * (1 - t), y = 10.45 + 3.1 * t; circ(x, y, 0.17, '#dcc49a'); circ(x, y - 0.07, 0.1, '#6e4a30'); } }
    // the triple blind arch and the two light window
    for (const [x, r, sp, v] of [[-1.75, 0.85, 11.0, 0.95], [0, 1.0, 11.95, 1.15], [1.75, 0.85, 11.0, 0.95]]) path(archLine(x, r, sp, v, 1, 6), 0.14, '#dcbc8c');
    for (const x of [-2.6, 2.6]) R(x - 0.07, 9.4, x + 0.07, 11.05, '#d4b284');
    arch(0, 9.5, 12.0, 2.25, '#cfa874', 1); arch(0, 9.5, 11.8, 1.85, '#a87a50', 1); arch(0, 9.5, 11.55, 1.55, '#d2ac78', 1);
    for (const x of [-0.38, 0.38]) arch(x, 9.5, 10.95, 0.62, '#4a2a1c', 1); R(-0.07, 9.5, 0.07, 10.6, '#e4d6bc'); circ(0, 11.12, 0.17, '#8a5c3c');
  });
  region(g, bdI, '#cbb59a', 31313, 0.08, (p) => {
    const { R, arch, ledge } = p;
    for (const [x, r] of [[-3.35, 1.2], [0, 1.5], [3.45, 1.2]]) arch(x, -1, 6.9, r * 2, '#bda488', 1);
    R(-1.45, 0, 1.45, 4.5, '#8a4a30'); R(-1.15, 0, 1.15, 4.1, '#5e2e20'); R(-0.7, 0, 0.7, 3.2, '#1f1410'); ledge(-1.55, 4.4, 1.55, 4.7, '#9a5a3c'); R(-5.65, -1, 5.65, 0.05, '#8f8578');
  });
}
function buildBaida() {
  initShared();
  const K = 'c3Baida';
  defMat(K, 512, 384, [1, 1], bdTex);
  const SH = (A, M, p, z) => sheet(K, 512, 384, A, M, p, z);
  const PW = [[-5691.5, 80.0], [-5689.6, 92.6], [-5671.4, 88.7], [-5671.0, 83.8], [-5672.0, 77.1]];
  const lo = Math.min(lowest([BD_NA, BD_NB, ...PW]), 154);
  const yc = groundY(-5666.6, 148.5) + 0.1, yo = groundY(-5679.0, 145.6) + 0.1;
  begin(yc);
  const NF = face(BD_NA, BD_NB, 0).M, at = (x) => { const k = (x + 24.1) / 48.2; return [BD_NA[0] + (BD_NB[0] - BD_NA[0]) * k, BD_NA[1] + (BD_NB[1] - BD_NA[1]) * k]; };
  const ground = (a, b) => { let h = -1e9; for (let x = a; x <= b + 0.01; x += (b - a) / 4) { const q = at(x); h = Math.max(h, groundY(q[0] - 0.05, q[1] - 0.6)); } return h; };
  const yE = ground(-24.1, BD_SEAM), yW = Math.max(ground(BD_SEAM, 24.1), yE + 0.6), eE = yE + 11.9, eW = yW + 11.9;
  const seam = at(BD_SEAM);
  // the north wing in its two levels, the low western end
  body([[-5623.35, 77.15], [seam[0], seam[1] + 0.35], [-5638.7, 89.6], [-5637.9, 95.1], [-5630.8, 94.0], [-5620.8, 94.0]], lo, eE - 0.1, '#e2dbc6', '#8e6c56');
  body([[seam[0], seam[1] + 0.35], [-5670.95, 84.15], [-5671.4, 88.7], [-5655.3, 87.5], [-5654.6, 92.0], [-5638.7, 89.6]], lo, eW - 0.1, '#e2dbc6', '#8e6c56');
  body(PW, lo, yW + 8.2, '#d8bd92', '#8e6c56');
  for (const [x0, x1, y] of [[-24.1, BD_SEAM, yE], [BD_SEAM, 24.1, yW]]) {
    B(NF, x0, x1, lo, y, -0.4, 0.0, '#cfc7b2');
    sheet(K, 512, 384, bdN, mul(NF, tr(0, y, 0)), rect(x0, -0.2, x1, 11.9), 0.03);
    B(NF, x0, x1, y + 11.85, y + 12.15, -0.5, 0.32, '#a4684a');
    gable('flat', 'flat', mul(NF, tr((x0 + x1) / 2, 0, -5.0)).multiply(rotY(PI / 2)), 9.4, x1 - x0 - 0.1, y + 12.05, 1.9, { ov: 0.05, c: '#b0745a', wc: '#ded6c0' });
  }
  // the small bell gable behind the roof
  const BG = mul(NF, tr(-9.4, eE + 0.4, -8.2));
  const bgShape = shapeOf([[-1.75, 0], [1.75, 0], [1.75, 4.3], [1.2, 4.35], ...archLine(0, 1.2, 4.35, 0.75, 0, 4).slice(1, -1), [-1.2, 4.35], [-1.75, 4.3]]);
  for (const x of [-0.8, 0.8]) { const h = new THREE.Path(); h.moveTo(x - 0.45, 2.4); h.lineTo(x + 0.45, 2.4); h.lineTo(x + 0.45, 3.35); h.absarc(x, 3.35, 0.45, 0, PI, false); h.lineTo(x - 0.45, 2.4); bgShape.holes.push(h); }
  extrude('flat', bgShape, 0.7, { M: BG, p: [0, 0, -0.35], c: '#e4d4ae', cs: 3, noao: true });
  B(BG, -1.9, 1.9, 1.95, 2.2, -0.45, 0.45, '#cdb78a'); cyl('flat', 0.14, 0.33, 0.55, 7, { M: BG, p: [0.8, 2.75, 0], c: '#4c4034', noao: true });
  // the east wing, stepping down the slope, and the corridor along the church
  body([[-5630.8, 94.0], [-5620.8, 94.0], [-5617.7, 115.0], [-5628.0, 115.0]], lo, yc + 2.4, '#ded6c0', '#8e6c56');
  body([[-5628.0, 115.0], [-5617.7, 115.0], [-5613.8, 140.0], [-5626.6, 140.0], [-5624.9, 133.2]], lo, yc + 4.6, '#d9d1bc', '#8e6c56');
  body([[-5625.4, 140.0], [-5613.8, 140.0], [-5610.0, 165.8], [-5621.2, 167.4], [-5624.2, 147.8], [-5625.4, 148.0]], lo, yc + 5.2, '#ded6c0', '#8e6c56');
  body([[-5663.8, 134.6], [-5624.9, 129.2], [-5625.7, 138.9], [-5634.3, 138.0], [-5663.9, 141.9]], lo, yc + 5.4, '#d6c8ac', '#8e6c56');
  // ---- the church: the nave, the gable behind the porch, the porch
  const CF = face(BD_CA, BD_CB, yc).M, PD = 2.5;
  body([[-5663.2, 142.1], [-5634.3, 137.9], [-5633.7, 139.8], [-5626.7, 138.9], [-5625.4, 148.0], [-5661.6, 153.2]], lo, yc + 10.6, '#b58a64', '#8e6c56');
  gable('flat', 'flat', mul(CF, tr(-0.1, 0, -PD - 19.7)), 9.2, 38.3, 10.5, 3.1, { ov: 0.05, c: '#a96e52', wc: '#b58a64' });
  extrude('flat', shapeOf(bdGable), 0.5, { M: CF, p: [0, 0, -PD - 0.52], c: '#b3875f', noao: true });
  SH(bdG, CF, bdGable, -PD);
  for (const s of [-1, 1]) { box('flat', Math.hypot(4.75, 3.1) + 0.2, 0.24, 0.55, { M: CF, p: [s * 2.38, 12.4, -PD - 0.2], rz: -s * Math.atan2(3.1, 4.75), c: '#c9a67a', noao: true }); B(CF, s * 4.75 - 0.3, s * 4.75 + 0.3, 8.8, 11.5, -PD - 0.45, -PD + 0.12, '#a88a68'); }
  cross(CF, 0, 14.0, -PD - 0.2, 1.5, '#38302a', 0.07); B(CF, -0.34, 0.34, 15.0, 15.06, -PD - 0.23, -PD - 0.17, '#38302a');
  // the porch front: one wall with the three openings cut out of it
  const porch = shapeOf([[-5.62, lo - yc], [5.62, lo - yc], [5.62, 8.75], [-5.62, 8.75]]);
  for (const [x, r, s, v] of BD_ARCH) { const h = new THREE.Path(), q = [[x - r, x === 0 ? 0.05 : 1.45], ...archLine(x, r, s, v, 1, 5), [x + r, x === 0 ? 0.05 : 1.45]]; q.forEach((w, i) => i ? h.lineTo(w[0], w[1]) : h.moveTo(w[0], w[1])); h.closePath(); porch.holes.push(h); }
  extrude('flat', porch, 0.55, { M: CF, p: [0, 0, -0.55], c: '#a87c58', noao: true });
  const painted = shapeOf([[-5.62, -1], [5.62, -1], [5.62, 8.75], [-5.62, 8.75]]); painted.holes = porch.holes;
  part(K, new THREE.ShapeGeometry(painted, 1), { M: CF, p: [0, 0, 0.04], uv: 'keep', uvk: [bdC.pw / (bdC.w * 512), bdC.ph / (bdC.h * 384)], uvo: [(bdC.px - bdC.x0 * bdC.pw / bdC.w) / 512, (384 - bdC.py - bdC.ph - bdC.y0 * bdC.ph / bdC.h) / 384], noao: true });
  B(CF, -5.6, 5.6, lo - yc, 0.05, -PD, -0.55, '#a39a8c'); B(CF, -5.6, 5.6, 7.3, 8.5, -PD, -0.55, '#8f7458');
  SH(bdI, CF, rect(-5.6, 0, 5.6, 7.3), -PD + 0.02);
  for (const s of [-1, 1]) B(CF, s * 5.62, s * 5.05, 0, 8.75, -PD, -0.55, '#b08460');
  for (const [x, w] of [[-1.85, 1.15], [1.75, 1.05]]) { B(CF, x - w / 2, x + w / 2, -0.4, 6.15, 0, 0.5, '#bd8e62'); B(CF, x - w / 2 - 0.08, x + w / 2 + 0.08, 6.15, 6.38, -0.02, 0.58, '#cba478'); for (const u of [-0.26, 0.26]) cyl('flat', 0.22, 0.24, 0.34, 6, { M: CF, p: [x + u, 6.38, 0.24], c: '#c49c6e', noao: true }); }
  B(CF, -5.7, 5.7, 8.55, 8.8, -0.6, 0.14, '#c6a074');
  for (let x = -5.35; x < 5.5; x += 0.76) { B(CF, x - 0.21, x + 0.21, 8.8, 9.15, -0.4, 0.02, '#a88660'); B(CF, x - 0.12, x + 0.12, 9.15, 9.32, -0.4, 0.02, '#a88660'); }
  for (const [x, r] of BD_ARCH) { const top = x === 0 ? 3.9 : 4.2, bot = x === 0 ? 0.05 : 1.45; for (let u = x - r + 0.2; u < x + r - 0.1; u += 0.4) B(CF, u - 0.025, u + 0.025, bot, top, -0.3, -0.25, '#2c2a28'); for (const y of [bot + 0.3, top - 0.35]) B(CF, x - r, x + r, y, y + 0.06, -0.31, -0.24, '#2c2a28'); }
  // ---- the ochre front, the link wall beside the church, the west building
  const OF = face(BD_OA, BD_OB, yo).M;
  body([[-5679.1, 124.2], [-5685.5, 124.9], [-5683.65, 144.9], [-5674.45, 144.0], [-5674.9, 138.5], [-5669.8, 137.9], [-5671.1, 124.0]], lo, yo + 12.9, '#d2ac7c');
  body([[-5682.0, 94.0], [-5674.1, 93.2], [-5671.1, 124.0], [-5679.1, 124.2]], lo, yo + 6.4, '#d6b88a');
  const oTop = [[-4.65, 14.0], [-3.1, 14.0], [-3.1, 13.45], [-1.55, 13.45], [-1.55, 14.45], [0, 15.0], [1.55, 14.45], [1.55, 13.45], [3.1, 13.45], [3.1, 14.0], [4.65, 14.0]];
  const oShape = (y) => [[-4.65, y], [4.65, y], ...oTop.slice().reverse()];
  extrude('flat', shapeOf(oShape(lo - yo)), 0.42, { M: OF, p: [0, 0, -0.42], c: '#d6b080', noao: true });
  SH(bdO, OF, oShape(-0.6), 0.04);
  B(OF, -4.85, 4.85, 12.75, 13.1, -0.2, 0.34, '#e4c696'); B(OF, -4.75, 4.75, 7.12, 7.36, 0, 0.42, '#e6cfa6');
  for (const [a, b] of [[-3.4, -1.35], [-1.1, 1.1], [1.35, 3.4]]) { B(OF, a, b, 8.12, 8.24, 0.2, 0.42, '#ece4d4'); for (let x = a + 0.14; x < b; x += 0.3) B(OF, x - 0.07, x + 0.07, 7.36, 8.12, 0.24, 0.38, '#e8e0ce'); }
  for (const x of [-1.22, 1.22]) { cyl('flat', 0.17, 0.21, 3.75, 8, { M: OF, p: [x, 8.25, 0.24], c: '#e8cc9e', noao: true }); B(OF, x - 0.28, x + 0.28, 11.95, 12.15, 0, 0.5, '#e8cc9e'); }
  for (const x of [-1.55, 1.55]) { cone('flat', 0.28, 1.1, 6, { M: OF, p: [x, 14.45, -0.18], c: '#cda878', noao: true }); sphere('flat', 0.14, { M: OF, p: [x, 15.55, -0.18], seg: 5, c: '#cda878', noao: true }); }
  const link = [[-5674.4, 138.5], [-5667.7, 139.4], [-5666.95, 143.0], [-5674.4, 143.75]];
  body(link, lo, yo + 8.6, '#d3ad7d');
  const LF = face([-5674.4, 143.75], [-5666.95, 143.0], yo);
  for (let x = -LF.l / 2 + 0.15; x < LF.l / 2; x += 0.62) B(LF.M, x - 0.025, x + 0.025, 8.74, 9.75, -0.1, -0.05, '#3a3634');
  B(LF.M, -LF.l / 2, LF.l / 2, 9.72, 9.8, -0.11, -0.04, '#3a3634'); B(LF.M, 0.2, 1.5, 0, 2.5, 0, 0.06, '#7a3a28'); B(LF.M, 0.05, 1.65, 2.5, 2.75, 0, 0.1, '#e6dccc');
  return done('Convento di Baida');
}

// =====================================================================================================
// Convento di Santa Maria di Gesù
// =====================================================================================================
const GS_V = { v8: [1551.2, 3695.1], v9: [1543.1, 3703.3], v10: [1549.6, 3709.3], k: [1547.2, 3712.0], n: [1539.8, 3720.7], v11: [1535.7, 3724.9], v12: [1544.0, 3732.1], v13: [1537.7, 3738.8] };
const GS_F = [1530.0, 3726.2];   // the fountain
// the painted walls: ends (left, right seen from outside), height above their own ground, atlas region
const gsT = reg(-5.5, -2.6, 5.5, 12.1, 0, 0, 160, 208), gsS = reg(-2.95, -2.6, 2.95, 12.1, 160, 0, 80, 208), gsC = reg(-5.72, -2.6, 5.72, 10.2, 240, 0, 176, 208), gsW = reg(-4.43, -2.4, 4.43, 6.6, 0, 208, 144, 144), gsH = reg(-5.76, -2.4, 5.76, 7.4, 144, 208, 176, 144), gsK = reg(-4.62, -3.2, 4.62, 9.8, 320, 208, 128, 144);
const GS_PL = '#c9ad90';
function gsStone(p, A, seed, c) {
  p.patches(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h, seed, 'rgba(238,215,190,0.34)', 30, 0.9); p.patches(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h, seed + 1, 'rgba(130,92,62,0.2)', 34, 0.75);
  p.rubble(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h * 0.55, seed + 2, c || ['rgba(120,88,60,0.28)', 'rgba(215,190,160,0.3)', 'rgba(90,70,52,0.2)'], A.pw * 2, 0.17);
}
function gsTiles(p, A, y) { p.R(A.x0, y - 0.35, A.x0 + A.w, y, '#8d6a50'); for (let x = A.x0; x < A.x0 + A.w; x += 0.3) p.circ(x, y - 0.05, 0.13, '#a77b5c'); p.R(A.x0, y - 0.6, A.x0 + A.w, y - 0.35, 'rgba(60,40,25,0.3)'); }
function gsPortal(p, x, y0, w, apex, orders) {
  const cols = ['#c39a72', '#8a603f', '#cfa87c', '#9a6c48', '#bd8c62'];
  for (let i = 0; i < orders; i++) p.arch(x, y0, apex - i * 0.28, w - i * 0.56, cols[i % cols.length], 1);
  const iw = w - orders * 0.56; p.arch(x, y0, apex - orders * 0.28, iw, '#3b2418', 1); p.R(x - 0.025, y0, x + 0.025, apex - orders * 0.28 - iw * 0.5, '#190d08');
  p.R(x - iw / 2, y0 + (apex - y0) * 0.5, x + iw / 2, y0 + (apex - y0) * 0.5 + 0.1, '#6a4630');
}
function gsTex(g) {
  region(g, gsT, GS_PL, 31401, 0.12, (p) => {   // the tall block, towards the square
    const { R, arch, ashlar, ledge, circ, win, line } = p;
    gsStone(p, gsT, 31402);
    for (let y = -2.6, i = 0; y < 11.5; y += 0.42, i++) { const w = i % 2 ? 0.75 : 1.2; ashlar(-5.5, y, -5.5 + w, y + 0.4, '#a67e5c', 31403 + i, 0.4, 0.8); }
    R(-0.8, 6.9, 0.8, 9.55, '#d6c0a4'); R(-0.6, 7.05, 0.6, 9.35, '#9c4030'); R(-0.02, 7.05, 0.02, 9.35, '#5a2218');
    R(-1.5, 0.35, 1.5, 3.85, '#d8ccb8'); R(-0.95, 0.35, 0.95, 3.35, '#47281a'); R(-0.03, 0.35, 0.03, 3.35, '#1c0e08'); ledge(-1.6, 3.55, 1.6, 3.9, '#e0d5c2');
    arch(0, 3.9, 5.45, 3.0, '#d6c9b2'); arch(0, 3.98, 5.15, 2.3, '#232c2a'); for (let k = 1; k < 8; k++) { const a = PI * k / 8; line(0, 4.0, Math.cos(a) * 1.1, 4.0 + Math.sin(a) * 1.1, 0.045, '#62706a'); }
    for (const x of [-2.0, 2.0]) { R(x - 0.18, 3.7, x + 0.18, 4.5, '#2e2a26'); line(x, 3.7, x, 3.2, 0.07, '#2e2a26'); }
    for (const x of [-3.1, 2.9]) { arch(x, 0.2, 1.65, 0.8, '#ddd3c2'); R(x - 0.2, 0.7, x + 0.2, 1.2, '#9a9082'); }
    for (let i = 0; i < 4; i++) R(-1.7 - (3 - i) * 0.25, -0.5 + i * 0.22, 1.7 + (3 - i) * 0.25, -0.3 + i * 0.22, '#a69a88');
    gsTiles(p, gsT, 12.1);
  });
  region(g, gsS, GS_PL, 31411, 0.12, (p) => {
    const { ashlar, win } = p;
    gsStone(p, gsS, 31412);
    for (let y = -2.6, i = 0; y < 11.5; y += 0.42, i++) { const w = i % 2 ? 0.65 : 1.05; ashlar(2.95 - w, y, 2.95, y + 0.4, '#a67e5c', 31413 + i, 0.4, 0.8); }
    p.circ(-0.4, 7.4, 0.5, '#b2906c'); p.circ(-0.4, 7.4, 0.3, '#3a2c22'); gsTiles(p, gsS, 12.1);
  });
  region(g, gsC, '#d3bda2', 31421, 0.12, (p) => {   // the church wall with its gothic portal up the steps
    const { R, circ, arch, ledge, win, poly } = p;
    gsStone(p, gsC, 31422);
    for (let i = 0; i < 6; i++) { const w = 2.9 - i * 0.14; R(-w, -0.2 + i * 0.25, w, -0.2 + i * 0.25 + 0.17, '#a29888'); R(-w, -0.03 + i * 0.25, w, 0.05 + i * 0.25, '#665e54'); }
    R(-5.72, -2.6, 5.72, -0.2, '#a89880');
    gsPortal(p, 0, 1.3, 4.2, 6.15, 5);
    R(-0.75, 6.35, 0.75, 8.45, '#cdb08c'); arch(0, 6.55, 8.1, 0.9, '#8a5c3a'); arch(0, 6.65, 7.9, 0.55, '#c8a070'); poly([[-0.95, 8.35], [0.95, 8.35], [0, 9.0]], '#b89470');
    for (const x of [-3.2, 3.35]) win(x, 6.2, 7.75, 0.95, '#3a342e', '#d6c4a8', '#7a6a58');
    for (const [x, y] of [[-4.3, 1.2], [-4.4, 3.0], [3.9, 1.0], [4.5, 2.9], [3.6, 3.3]]) { R(x - 0.45, y, x + 0.45, y + 0.85, '#d9d2c4'); for (let v = y + 0.18; v < y + 0.75; v += 0.17) R(x - 0.3, v, x + 0.3, v + 0.035, '#8a8276'); }
    for (const s of [-1, 1]) { R(s * 2.65 - 0.14, 4.4, s * 2.65 + 0.14, 5.05, '#2e2a26'); }
    gsTiles(p, gsC, 10.2);
  });
  region(g, gsW, '#a8947c', 31431, 0.15, (p) => {   // the darker wall with the second doorway
    const { R, ledge, rubble } = p;
    gsStone(p, gsW, 31432, ['rgba(70,56,44,0.4)', 'rgba(190,170,145,0.35)', 'rgba(60,48,38,0.35)']);
    gsPortal(p, 0, 0.7, 2.9, 4.5, 3); R(-1.9, -0.1, 1.9, 0.7, '#8f8576'); R(-1.9, 0.62, 1.9, 0.72, '#b4aa98');
    for (const x of [-3.0, 2.9]) { R(x - 0.5, 1.4, x + 0.5, 2.6, '#cfc8ba'); p.circ(x, 3.3, 0.45, '#d4ccbc'); }
    ledge(-4.43, 6.15, 4.43, 6.5, '#b8a48a');
  });
  region(g, gsH, '#c49a66', 31441, 0.13, (p) => {   // the small chapel with its gable
    const { R, poly, line, strip, ledge, arch } = p;
    gsStone(p, gsH, 31442);
    R(-2.6, -0.2, 2.6, 4.9, '#c79c68'); for (const s of [-1, 1]) strip(s * 2.15 - 0.28, -0.2, s * 2.15 + 0.28, 4.7, '#d4ac76');
    ledge(-2.75, 4.7, 2.75, 5.05, '#d8b27e'); poly([[-2.75, 5.05], [2.75, 5.05], [0, 6.7]], '#c99e6a'); for (const s of [-1, 1]) line(s * 2.75, 5.1, 0, 6.75, 0.2, '#dcb884'); p.circ(0, 5.65, 0.3, '#a87c50');
    R(-1.4, -0.2, 1.4, 3.8, '#d6ae78'); R(-1.0, -0.2, 1.0, 3.4, '#4a2c1c'); R(-0.03, -0.2, 0.03, 3.4, '#1e100a'); ledge(-1.5, 3.55, 1.5, 3.85, '#dfbc8a');
    gsTiles(p, reg(-5.76, 0, -2.75, 1, gsH.px, gsH.py, 1, 1), 5.0);
  });
  region(g, gsK, '#cdb298', 31451, 0.14, (p) => {   // the convent wing
    const { R, win, patches } = p;
    gsStone(p, gsK, 31452); patches(-4.6, -1, 4.6, 5, 31453, 'rgba(120,90,70,0.2)', 14, 1.2);
    for (const [x, y, w, h] of [[-2.4, 6.4, 0.9, 1.35], [0.7, 6.3, 0.8, 1.1], [2.8, 4.2, 0.9, 1.2], [-1.0, 3.6, 0.6, 0.7]]) win(x, y, y + h, w, '#3c322a', '#d8c6ac', '#6e5c4a');
    R(-0.6, 0, 0.8, 2.4, '#5a3c28'); R(-0.8, 2.4, 1.0, 2.65, '#d4c4aa'); gsTiles(p, gsK, 9.8);
  });
}
const GS_PARTS = [   // the surveyed roof masses of the footprint (flat ring, level in the survey)
  [[1606.3, 3695.4, 1613.1, 3701.3, 1623.8, 3687.6, 1616.9, 3682.5, 1607.5, 3694.4, 1607.2, 3694.2], 90.1],
  [[1551.6, 3700.8, 1555.3, 3704.7, 1556.2, 3703.2, 1556.1, 3701.7, 1553.5, 3700.3, 1554.6, 3699.0, 1550.7, 3695.6, 1543.4, 3703.1, 1546.5, 3706.0], 86.2],
  [[1547.4, 3711.9, 1547.9, 3712.4, 1555.3, 3704.7, 1551.6, 3700.8, 1546.6, 3706.5, 1549.8, 3709.5], 88.6],
  [[1578.4, 3723.8, 1561.3, 3709.0, 1561.8, 3706.9, 1560.9, 3704.9, 1560.0, 3704.2, 1557.8, 3704.0, 1555.9, 3705.2, 1555.3, 3704.7, 1548.8, 3711.4, 1559.3, 3720.8, 1560.5, 3719.4, 1576.2, 3733.0, 1578.6, 3731.0, 1580.8, 3733.1, 1585.7, 3729.9, 1587.7, 3727.7, 1588.2, 3728.2, 1589.2, 3727.5, 1599.5, 3713.9, 1611.3, 3699.4, 1603.3, 3693.1, 1579.6, 3722.8, 1579.3, 3722.5], 93.3],
  [[1600.9, 3719.2, 1602.7, 3716.5, 1599.5, 3713.9, 1595.1, 3719.5, 1595.5, 3719.9, 1596.3, 3719.0, 1600.2, 3722.1, 1601.8, 3719.9], 85.3],
  [[1547.8, 3727.2, 1540.0, 3721.0, 1536.5, 3725.0, 1543.8, 3731.4], 95.7],
  [[1561.4, 3750.7, 1544.8, 3736.3, 1559.0, 3720.5, 1548.8, 3711.4, 1547.7, 3712.9, 1540.3, 3721.0, 1547.8, 3727.6, 1544.0, 3732.6, 1538.2, 3738.9, 1556.9, 3755.4], 93.0],
  [[1558.3, 3748.1, 1560.9, 3750.2, 1562.6, 3748.2, 1560.0, 3746.1], 86.3],
  [[1560.9, 3750.2, 1566.6, 3755.1, 1567.5, 3754.1, 1568.1, 3754.7, 1568.9, 3753.7, 1562.6, 3748.2], 87.7],
  [[1560.9, 3755.9, 1563.0, 3758.0, 1563.8, 3758.2, 1566.6, 3755.1, 1561.4, 3750.7, 1556.9, 3755.7, 1559.9, 3756.9], 89.2],
];
function buildGesu() {
  initShared();
  const K = 'c3Gesu';
  defMat(K, 448, 352, [1, 1], gsTex);
  const V = GS_V, lo = 80.5, y11 = groundY(...V.v11);
  begin(y11);
  const LIFT = 2.2;   // the survey's roof levels against the game's ground
  GS_PARTS.forEach(([flat, h], i) => { const pts = pairsOf(flat); body(pts, lo + (i % 3) * 0.01, Math.max(h + LIFT, groundRange(pts).hi + 2.6), i === 5 || i === 6 ? '#c4aa8e' : '#c9b298', '#8e6e58'); });
  const wall = (a, b, yb, A, outline, col) => { const f = face(a, b, yb), p = outline || rect(-f.l / 2, A.y0, f.l / 2, A.y0 + A.h); extrude('flat', shapeOf(p.map(q => [q[0], q[1] <= A.y0 + 0.01 ? Math.min(A.y0, lo - yb) : q[1]])), 0.45, { M: f.M, p: [0, 0, -0.47], c: col, noao: true }); sheet(K, 448, 352, A, f.M, p, 0.03); return f.M; };
  const T = wall(V.v11, V.v12, y11 + 0.5, gsT, null, '#bda286');
  wall(V.n, V.v11, y11 + 0.5, gsS, null, '#bda286');
  const C = wall(V.k, V.n, y11 - 0.1, gsC, null, '#c2ac92');
  wall(V.v10, V.k, groundY(...V.v10), gsS, rect(-1.72, -2.6, 1.72, 5.0), '#bda286');
  wall(V.v9, V.v10, groundY(1546.3, 3706.3) - 0.2, gsW, null, '#9c8a74');
  const ch = face(V.v8, V.v9, 0).l / 2;
  const H = wall(V.v8, V.v9, groundY(...V.v9), gsH, [[-ch, -2.4], [ch, -2.4], [ch, 5.0], [2.75, 5.0], [0, 6.75], [-2.75, 5.0], [-ch, 5.0]], '#bb9262');
  wall(V.v12, V.v13, groundY(...V.v13) - 0.2, gsK, null, '#bea68c');
  // eaves, the portal's steps and niche, the chapel's cornice, the lanterns
  B(T, -5.55, 5.55, 11.9, 12.15, -0.4, 0.3, '#9a7258'); B(C, -5.75, 5.75, 10.0, 10.22, -0.4, 0.28, '#9a7258');
  for (let i = 0; i < 5; i++) B(C, -2.9 + i * 0.14, 2.9 - i * 0.14, -1.2, -0.05 + i * 0.27, 0, 0.9 - i * 0.18, '#a49a8a');
  for (const s of [-1, 1]) box('flat', 0.24, 4.2, 0.2, { M: C, p: [s * 2.2, 1.2, 0.1], c: '#b88f68', noao: true });
  B(C, -0.95, 0.95, 8.35, 8.55, 0, 0.28, '#c0a078'); B(H, -2.8, 2.8, 4.75, 5.0, 0, 0.24, '#d6b07c');
  for (const s of [-1, 1]) box('flat', 3.2, 0.2, 0.34, { M: H, p: [s * 1.37, 5.82, 0.08], rz: -s * 0.54, c: '#d6b07c', noao: true });
  B(T, -1.6, 1.6, 3.55, 3.85, 0, 0.26, '#dcd0bc'); for (const x of [-2.0, 2.0]) { B(T, x - 0.16, x + 0.16, 3.7, 4.4, 0.18, 0.48, '#2e2a26'); B(T, x - 0.03, x + 0.03, 4.0, 4.08, 0, 0.2, '#2e2a26'); }
  const ax = 31.0, az = 27.0, al = Math.hypot(ax, az);
  gable('flat', 'flat', frame(1562.5, 0, 3714.6, ax / al, az / al), 8.2, 26, 93.3 + LIFT + 0.05, 2.0, { ov: 0.1, c: '#a8826a', wc: '#c4aa90' });
  // the fountain: octagonal basin, stem, bowl and the stacked top
  const fy = groundY(...GS_F), P = frame(GS_F[0], fy, GS_F[1], 0, 1), ST = '#a99a86';
  cyl('flat', 3.0, 3.15, 1.6, 8, { M: P, p: [0, -1.48, 0], t0: PI / 8, c: '#9c9284' });
  cyl('flat', 2.55, 2.3, 0.95, 8, { M: P, p: [0, 0.1, 0], t0: PI / 8, open: true, c: ST }); cyl('flat', 2.68, 2.68, 0.16, 8, { M: P, p: [0, 0.98, 0], t0: PI / 8, open: true, c: '#bdb09c' });
  part('flat', new THREE.RingGeometry(2.15, 2.68, 8, 1, PI / 8), { M: P, p: [0, 1.14, 0], rx: -PI / 2, c: '#bdb09c', noao: true });
  cyl('flat', 2.4, 2.4, 0.04, 8, { M: P, p: [0, 0.82, 0], t0: PI / 8, c: '#4f6258', noao: true });
  cyl('flat', 0.55, 0.65, 0.5, 8, { M: P, p: [0, 0.6, 0], c: ST }); cyl('flat', 0.24, 0.42, 1.5, 8, { M: P, p: [0, 1.1, 0], c: '#c2b29c', noao: true });
  cyl('flat', 1.2, 0.35, 0.5, 10, { M: P, p: [0, 2.55, 0], c: '#b4a490', noao: true }); cyl('flat', 1.25, 1.25, 0.14, 10, { M: P, p: [0, 3.05, 0], c: '#c6b8a2', noao: true });
  [[0.34, 0.5, 3.19, 0.3], [0.72, 0.4, 3.49, 0.18], [0.2, 0.3, 3.67, 0.25], [0.52, 0.3, 3.92, 0.16], [0.16, 0.24, 4.08, 0.2], [0.33, 0.2, 4.28, 0.14]].forEach(([a, b, y, h]) => cyl('flat', a, b, h, 8, { M: P, p: [0, y, 0], c: '#b0a08a', noao: true }));
  cone('flat', 0.14, 0.45, 6, { M: P, p: [0, 4.42, 0], c: '#a49480', noao: true });
  return done('Convento di Santa Maria di Gesu');
}
// walls round the fountain, and round the steps that stand out in front of the gothic portal
const GS_STEPS = (() => { const [a, b] = [GS_V.k, GS_V.n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), W = (x, z) => [+((a[0] + b[0]) / 2 + dx / l * x - dz / l * z).toFixed(2), +((a[1] + b[1]) / 2 + dz / l * x + dx / l * z).toFixed(2)], q = [W(-2.9, 0), W(-2.9, 0.9), W(2.9, 0.9), W(2.9, 0)]; return q.slice(1).map((p, i) => [...q[i], ...p]); })();
const GS_WALLS = segs([...Array(8)].map((_, i) => { const a = PI / 8 + i * PI / 4; return [+(GS_F[0] + Math.sin(a) * 2.75).toFixed(2), +(GS_F[1] + Math.cos(a) * 2.75).toFixed(2)]; }));

// =====================================================================================================
// Chiostro dei Benedettini, Monreale
// =====================================================================================================
const CH_IN = [[-6067.5, 3761.3], [-6054.3, 3800.1], [-6014.9, 3786.8], [-6027.8, 3748.5]];   // the arcade: north west, south west, south east, north east
const CH_OUT = [[-6076.5, 3757.6], [-6058.5, 3809.1], [-6006.9, 3793.0], [-6023.2, 3740.0]];  // the roofs' outer corners in the same order
const CH_Y = 298.2, CH_BAY = 6.24, CH_H = 5.25;
function chTex(g, w, h) {   // four bays of the arcade, each CH_BAY / 4 wide, transparent between the columns and under the arches
  const sx = w / CH_BAY, sy = h / CH_H, X = x => x * sx, Y = y => h - y * sy, bay = CH_BAY / 4, r = RNG(31501);
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arc = (c0, c1, rr, ys, ya) => { g.beginPath(); g.moveTo(X(c0 - rr), Y(ys)); g.quadraticCurveTo(X(c0 - rr), Y(ys + (ya - ys) * 0.75), X(c0), Y(ya)); g.quadraticCurveTo(X(c0 + rr), Y(ys + (ya - ys) * 0.75), X(c0 + rr), Y(ys)); };
  g.clearRect(0, 0, w, h); R(0, 0, CH_BAY, CH_H, '#c9a878');
  for (let i = 0; i < 520; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.14)' : 'rgba(255,235,200,0.16)'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 3); }
  for (let i = 0; i < 4; i++) {
    const c = (i + 0.5) * bay;
    arc(c, 0, 0.74, 2.9, 4.38); g.strokeStyle = '#7a5a40'; g.lineWidth = 0.2 * sx; g.stroke();
    arc(c, 0, 0.74, 2.9, 4.38); g.setLineDash([3, 3]); g.strokeStyle = '#e8d6ae'; g.lineWidth = 0.14 * sx; g.stroke(); g.setLineDash([]);
    arc(c, 0, 0.61, 2.9, 4.16); g.strokeStyle = '#e2cba0'; g.lineWidth = 0.13 * sx; g.stroke();
  }
  R(0, 4.55, CH_BAY, 4.85, '#e0cda4'); for (let x = 0; x < CH_BAY; x += 0.26) { R(x, 4.6, x + 0.13, 4.7, '#5a4434'); R(x + 0.13, 4.7, x + 0.26, 4.8, '#5a4434'); }
  R(0, 5.05, CH_BAY, CH_H, '#8c6c50');
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++) { const c = (i + 0.5) * bay; arc(c, 0, 0.55, 2.9, 4.02); g.lineTo(X(c + 0.55), Y(0.82)); g.lineTo(X(c - 0.55), Y(0.82)); g.closePath(); g.fill(); }
  for (let i = 0; i <= 4; i++) R(i * bay - bay / 2 + 0.2, 0.82, i * bay + bay / 2 - 0.2, 2.5, '#000');
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i <= 4; i++) {
    const c = i * bay, kind = i % 4;
    for (const s of [-1, 1]) {
      const x = c + s * 0.13; R(x - 0.075, 0.82, x + 0.075, 2.55, kind === 3 ? '#c9c2b2' : '#e6dcc6'); R(x + 0.025, 0.82, x + 0.075, 2.55, 'rgba(70,50,30,0.35)');
      if (kind === 1) for (let y = 0.95; y < 2.45; y += 0.16) { R(x - 0.075, y, x, y + 0.07, '#8a6444'); R(x, y + 0.07, x + 0.075, y + 0.14, '#4c4638'); }
      if (kind === 2) { g.strokeStyle = '#8a7a64'; g.lineWidth = 1.5; for (let y = 0.9; y < 2.4; y += 0.19) { g.beginPath(); g.moveTo(X(x - 0.075), Y(y)); g.lineTo(X(x + 0.075), Y(y + 0.15)); g.stroke(); } }
    }
    g.fillStyle = '#dcc9a2'; g.beginPath(); g.moveTo(X(c - 0.23), Y(2.5)); g.lineTo(X(c + 0.23), Y(2.5)); g.lineTo(X(c + 0.33), Y(2.92)); g.lineTo(X(c - 0.33), Y(2.92)); g.fill();
    R(c - 0.34, 2.86, c + 0.34, 2.98, '#b59a72'); R(c - 0.25, 2.52, c + 0.25, 2.6, '#9a7e58'); for (const u of [-0.17, 0, 0.17]) R(c + u - 0.025, 2.62, c + u + 0.025, 2.82, '#9a7e58');
    R(c - 0.27, 0.82, c + 0.27, 0.94, '#b6a284');
  }
  R(0, 0, CH_BAY, 0.82, '#ab9474'); R(0, 0.72, CH_BAY, 0.82, '#cbb694'); for (let x = 0; x < CH_BAY; x += 0.8) R(x, 0, x + 0.04, 0.72, 'rgba(60,40,22,0.45)');
}
function buildChiostro() {
  initShared();
  const K = 'c3Chiostro';
  defMat(K, 256, 224, [CH_BAY, CH_H], chTex, { alphaTest: 0.5, side: THREE.DoubleSide });
  const y = CH_Y;
  begin(y);
  prism('flat', CH_OUT, lowest(CH_OUT), y, { c: '#a9825e', noao: true });
  const [NW, SW, SE, NE] = CH_IN, [ONW, OSW, OSE, ONE] = CH_OUT;
  const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // the four sides: two faces of arcade, the parapet, the coping and the lean-to roof
  for (const [a, b, ao, bo] of [[SW, NW, OSW, ONW], [SE, SW, OSE, OSW], [NE, SE, ONE, OSE], [NW, NE, ONW, ONE]]) {
    const f = face(a, b, y), n = Math.round(f.l / (CH_BAY / 4));
    for (const z of [0, -0.45]) panel(K, f.l, CH_H, { M: f.M, p: [0, 0, z], uvk: [n / 4, 1] });
    B(f.M, -f.l / 2, f.l / 2, 0, 0.8, -0.44, -0.01, '#a99272'); B(f.M, -f.l / 2, f.l / 2, CH_H - 0.12, CH_H + 0.02, -0.55, 0.12, '#8c6c50');
    const P = [[[a[0], y + CH_H + 0.02, a[1]], [b[0], y + CH_H + 0.02, b[1]]], [[ao[0], y + 6.75, ao[1]], [bo[0], y + 6.75, bo[1]]]];
    gridMesh('tile', P, (i, j) => [j * f.l / 2.4, i * 3.2], { c: '#c7ab98', noao: true });
  }
  // the garden: lawns, crossing paths, hedges, the round bed in the middle
  const c = mid(NW, SE), grass = CH_IN.map(q => mid(c, q, 0.985));
  prism('flat', grass, y, y + 0.03, { c: '#8a9456', noao: true });
  const ex = [SE[0] - SW[0], SE[1] - SW[1]], el = Math.hypot(...ex), G = frame(c[0], y, c[1], -ex[1] / el, ex[0] / el), H = el / 2 - 0.2;
  B(G, -H, H, 0.02, 0.07, -1.25, 1.25, '#d9cdb2'); B(G, -1.25, 1.25, 0.02, 0.08, -H, H, '#d9cdb2');
  cyl('flat', 5.2, 5.2, 0.09, 16, { M: G, p: [0, 0.02, 0], c: '#d9cdb2', noao: true });
  cyl('flat', 3.3, 3.5, 0.55, 12, { M: G, p: [0, 0.05, 0], c: '#46602e', noao: true }); cyl('flat', 2.4, 2.4, 0.58, 12, { M: G, p: [0, 0.06, 0], c: '#7b7a4c', noao: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const near = 1.7, far = H - 1.4, gap = 5.4, hedge = (x0, x1, z0, z1) => B(G, sx * x0, sx * x1, 0.02, 0.55, sz * z0, sz * z1, '#4a6430');
    hedge(gap, far, near - 0.28, near + 0.28); hedge(near - 0.28, near + 0.28, gap, far);   // beside the paths, open at the middle round
    hedge(near, far, far - 0.28, far + 0.28); hedge(far - 0.28, far + 0.28, near, far);
    cyl('flat', 1.7, 1.8, 0.4, 10, { M: G, p: [sx * 10.5, 0.03, sz * 10.5], open: true, c: '#506a34', noao: true });
  }
  const palmAt = (x, z, h) => { cyl('flat', 0.17, 0.26, h, 6, { M: G, p: [x, 0.05, z], c: '#7a6248', noao: true }); for (let i = 0; i < 7; i++) { const a = i / 7 * 2 * PI; box('flat', 2.2, 0.07, 0.5, { M: G, p: [x + Math.cos(a) * 0.9, h - 0.1, z - Math.sin(a) * 0.9], ry: a, rz: -0.35, c: '#4f7434', noao: true }); } sphere('flat', 0.45, { M: G, p: [x, h + 0.1, z], seg: 6, c: '#42662c', noao: true }); };
  palmAt(-0.6, 0.4, 2.6); palmAt(0.9, -0.7, 1.7); palmAt(-10.5, 10.5, 3.4);
  for (const [x, z, r, col] of [[10.5, -10.5, 1.9, '#8a9a7a'], [10.5, 10.5, 1.4, '#58742f']]) { cyl('flat', 0.2, 0.32, 1.7, 5, { M: G, p: [x, 0.05, z], c: '#6a543e', noao: true }); sphere('flat', r, { M: G, p: [x, 2.7, z], seg: 7, ky: 0.8, c: col, noao: true }); }
  // the fountain court in the south west corner: two more arcades, a flat top, the basin and its column
  const D = 5.2, to = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / l * D, p[1] + (q[1] - p[1]) / l * D]; };
  const a1 = to(SW, NW), a3 = to(SW, SE), a2 = [a1[0] + a3[0] - SW[0], a1[1] + a3[1] - SW[1]];
  for (const [a, b] of [[a2, a1], [a3, a2]]) { const f = face(a, b, y); for (const z of [0, -0.4]) panel(K, f.l, CH_H, { M: f.M, p: [0, 0, z], uvk: [0.75, 1] }); B(f.M, -f.l / 2, f.l / 2, 0, 0.8, -0.39, -0.01, '#a99272'); B(f.M, -f.l / 2 - 0.15, f.l / 2 + 0.15, CH_H - 0.12, CH_H + 0.12, -0.5, 0.15, '#c0a078'); }
  prism('flat', [SW, a1, a2, a3], y + CH_H - 0.1, y + CH_H + 0.02, { c: '#9a7c60', noao: true });
  const w = mid(SW, a2), M = frame(w[0], y, w[1], 0, 1);
  cyl('flat', 0.35, 0.5, 0.75, 8, { M, c: '#cfc6b4', noao: true }); cyl('flat', 1.15, 0.8, 0.3, 12, { M, p: [0, 0.75, 0], c: '#ddd5c4', noao: true }); cyl('flat', 1.0, 1.0, 0.02, 12, { M, p: [0, 1.06, 0], c: '#5c7068', noao: true });
  cyl('flat', 0.2, 0.25, 1.75, 8, { M, p: [0, 1.05, 0], c: '#625c52', noao: true }); sphere('flat', 0.36, { M, p: [0, 3.0, 0], seg: 8, ky: 0.8, c: '#8c857a', noao: true });
  return done('Chiostro dei Benedettini di Monreale');
}

// =====================================================================================================
// Municipio di Monreale
// =====================================================================================================
const MU_P = [[-6029.8, 3666.7], [-6040.6, 3670.3], [-6032.9, 3693.1], [-6046.2, 3697.5], [-6059.6, 3658.3], [-6035.2, 3650.0], [-6025.9, 3646.9], [-6013.7, 3682.1], [-6023.5, 3685.6]];
const MU_L = 41.4, MU_BAY = MU_L / 9, muF = reg(-20.7, -16, 20.7, 8.4, 0, 0, 512, 304);
const MU_OCH = '#d9b57f', MU_LT = '#e8cb99';
function muGround() {   // the balcony level and the ground at each of the nine bays, from it
  const at = x => { const k = (x + MU_L / 2) / MU_L; return [-6059.6 + 13.4 * k, 3658.3 + 39.2 * k]; };
  const g = [...Array(9)].map((_, i) => { const x = (i - 4) * MU_BAY; return Math.max(...[-1.2, 0, 1.2].map(d => { const q = at(x + d); return groundY(q[0] - 0.65, q[1] + 0.22); })); });
  const yb = g[0] + 6.1;
  return { yb, rel: g.map(v => v - yb) };
}
function muTex(g) {
  const { rel } = muGround();
  region(g, muF, MU_OCH, 31601, 0.06, (p) => {
    const { R, circ, ring, poly, arch, ledge, strip, line, ashlar } = p, SHUT = '#5e3b30';
    const shutters = (x, y0, y1, w) => { R(x - w / 2, y0, x + w / 2, y1, SHUT); R(x - 0.03, y0, x + 0.03, y1, '#2e1c16'); for (let y = y0 + 0.2; y < y1; y += 0.3) R(x - w / 2 + 0.08, y, x + w / 2 - 0.08, y + 0.09, '#744c3e'); };
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * MU_BAY, gy = rel[i], foot = Math.max(gy, -6.3);
      if (gy < -6.35) {   // a plain base under the arch where the square falls away, with a door at the street
        R(x - MU_BAY / 2, -16, x + MU_BAY / 2, -6.3, '#c3a479'); ledge(x - MU_BAY / 2, -6.55, x + MU_BAY / 2, -6.25, MU_LT);
        if (gy < -8.9) { R(x - 1.1, gy, x + 1.1, gy + 2.75, MU_LT); shutters(x, gy, gy + 2.55, 1.8); }
      }
      if (i === 4) {
        R(x - 1.65, foot, x + 1.65, -1.25, '#cfa972'); R(x - 1.35, foot, x + 1.35, -2.0, MU_LT); R(x - 1.05, foot, x + 1.05, Math.min(-2.3, foot + 3.9), '#6e4630'); R(x - 0.03, foot, x + 0.03, foot + 3.7, '#2e1c10'); for (const s of [-1, 1]) for (let y = foot + 0.3; y < foot + 3.4; y += 1.0) R(x + s * 0.52 - 0.34, y, x + s * 0.52 + 0.34, y + 0.75, '#83563a');
        ledge(x - 1.8, -1.35, x + 1.8, -1.05, MU_LT);
      } else {
        arch(x, foot, -1.25, 3.65, MU_LT); arch(x, foot, -1.45, 3.2, '#d3ad77'); arch(x, foot, -1.45, 2.9, '#e0c193');
        arch(x, -2.75, -1.75, 2.1, '#4a2f26'); for (const u of [-0.55, 0, 0.55]) R(x + u - 0.04, -2.75, x + u + 0.04, -1.9, '#7a5a48');
        shutters(x, foot, Math.min(-3.1, foot + 3.35), 2.2);
      }
      // the upper floor: window, hood, medallion
      R(x - 1.15, 0, x + 1.15, 3.35, MU_LT); shutters(x, 0.05, 3.15, 1.75); if (i === 1 || i === 2) { R(x - 0.45, 0.15, x + 0.45, 3.0, '#e9e2d2'); R(x - 0.03, 0.15, x + 0.03, 3.0, '#7a6a5a'); }
      ledge(x - 1.4, 3.75, x + 1.4, 3.98, MU_LT);
      if (i === 3 || i === 5) { circ(x, 5.75, 0.95, '#ece4d2', 1.0); circ(x, 5.8, 0.55, '#c9bda4', 0.65); for (let k = 0; k < 9; k++) { const a = k / 9 * 2 * PI; circ(x + Math.cos(a) * 0.95, 5.75 + Math.sin(a) * 0.9, 0.24, '#e4dac6'); } circ(x, 5.75, 0.3, '#ded4c0'); }
      else if (i !== 4) { circ(x, 5.85, 0.86, '#c49e6a'); circ(x, 5.85, 0.76, '#efe8d8'); circ(x, 5.85, 0.58, '#cfc4ac'); circ(x, 5.98, 0.24, '#f2ecde'); poly([[x - 0.42, 5.4], [x + 0.42, 5.4], [x + 0.24, 5.76], [x - 0.24, 5.76]], '#f0eadc'); circ(x, 4.62, 0.55, '#e6dcc4', 0.28); circ(x, 4.62, 0.22, '#c4b69a', 0.16); }
    }
    for (let i = 0; i <= 9; i++) { const x = -MU_L / 2 + i * MU_BAY; strip(x - 0.4, -6.3, x + 0.4, -0.5, MU_LT); strip(x - 0.34, 0, x + 0.34, 7.15, MU_LT); R(x - 0.5, -3.5, x + 0.5, -3.2, MU_LT); }
    ledge(-20.7, -0.55, 20.7, -0.05, MU_LT); R(-16.9, -1.15, -13.9, -0.25, '#e4dece'); for (let y = -1.0; y < -0.4; y += 0.2) R(-16.6, y, -14.2, y + 0.05, '#8a8274');
    // the eagle on its shield with the scroll under it
    R(-1.5, 4.2, 1.5, 5.15, '#ece4d2'); circ(0, 4.65, 0.4, '#d4c8ae'); poly([[-2.15, 7.4], [-0.55, 7.0], [-0.4, 5.9], [0, 5.35], [0.4, 5.9], [0.55, 7.0], [2.15, 7.4], [1.6, 6.5], [0.7, 6.15], [-0.7, 6.15], [-1.6, 6.5]], '#ece5d4'); circ(0, 6.45, 0.42, '#c8bc9e', 0.55); circ(0, 7.45, 0.26, '#ece5d4');
    ledge(-20.7, 7.2, 20.7, 7.55, MU_LT); R(-20.7, 7.55, 20.7, 8.4, '#d6b07a'); ledge(-20.7, 8.05, 20.7, 8.3, MU_LT);
  });
}
function buildMunicipio() {
  initShared();
  const K = 'c3Muni';
  defMat(K, 512, 304, [1, 1], muTex);
  const { yb, rel } = muGround(), lo = lowest(MU_P), a = MU_P[4], b = MU_P[3];
  begin(yb - 6);
  body([MU_P[0], MU_P[1], MU_P[2], [-6045.8, 3697.35], [-6059.2, 3658.45], MU_P[5], MU_P[6], MU_P[7], MU_P[8]], lo, yb + 7.9, '#d2ae7a', '#8c705a');
  const F = face(a, b, yb).M, h = MU_L / 2;
  B(F, -h, h, lo - yb, 8.4, -0.42, -0.02, '#d2ae7a');
  sheet(K, 512, 304, muF, F, rect(-h, Math.max(-16, lo - yb), h, 8.4), 0.02);
  // the cornices, the balcony and its railing, the door step balcony, the eagle
  B(F, -h - 0.15, h + 0.15, 7.22, 7.55, -0.3, 0.42, MU_LT); B(F, -h - 0.05, h + 0.05, 8.2, 8.45, -0.4, 0.12, MU_LT);
  B(F, -h, h, -0.38, -0.05, 0, 0.68, '#c9a878'); B(F, -2.7, 2.7, -0.4, -0.04, 0.68, 1.05, '#c9a878');
  for (const [x0, x1, z] of [[-h, -2.7, 0.64], [-2.7, 2.7, 1.0], [2.7, h, 0.64]]) rail(mul(F, tr((x0 + x1) / 2, -0.05, z)), x1 - x0, 1.15, { c: '#ffffff' });
  for (let i = 0; i <= 9; i++) { const x = Math.max(-h + 0.25, Math.min(h - 0.25, -h + i * MU_BAY)), g = Math.min(rel[Math.max(0, i - 1)], rel[Math.min(8, i)]); B(F, x - 0.28, x + 0.28, Math.max(g - 0.6, -15.5), -0.38, 0, 0.14, '#dcbc88'); B(F, x - 0.16, x + 0.16, -0.75, -0.38, 0.14, 0.6, '#c9a878'); }
  B(F, -1.8, 1.8, -1.34, -1.08, 0, 0.28, MU_LT);
  extrude('flat', shapeOf([[-2.1, 7.35], [-0.6, 7.05], [-0.3, 6.2], [0.3, 6.2], [0.6, 7.05], [2.1, 7.35], [0.7, 7.55], [0.3, 7.5], [0.25, 8.0], [-0.25, 8.0], [-0.3, 7.5], [-0.7, 7.55]]), 0.46, { M: F, p: [0, 0.55, 0.0], c: '#ece5d4', noao: true });
  // plain cornices round the other sides
  for (const i of [0, 4, 5, 6, 7]) { const e = face(MU_P[(i + 1) % 9], MU_P[i], yb); if (i === 3) continue; B(e.M, -e.l / 2, e.l / 2, 7.3, 7.95, -0.28, 0.22, '#cfa976'); }
  return done('Municipio di Monreale');
}

// =====================================================================================================
// Palazzo Arcivescovile di Monreale
// =====================================================================================================
const PA_V = [[-6006.9, 3809.7], [-5986.9, 3803.2], [-5985.8, 3804.3], [-5968.9, 3798.8], [-5977.4, 3773.1], [-5989.8, 3777.1], [-5999.6, 3747.3], [-5989.4, 3743.7], [-5993.5, 3731.5], [-6022.9, 3741.5], [-6006.1, 3792.5], [-6012.0, 3794.1]];
const PA_TOP = 305.4, PA_TT = 307.6;
// the tower at the north east corner and the gateway beside it, placed from the 2013 orthophoto (its roofs lie about 5 m east of the outlines here): both stand a little outside the outline
const PA_NE = [-5987.8, 3731.2], PA_SE = [-5984.7, 3740.7], PA_SW = [-5994.2, 3743.8], PA_NW = [-5997.3, 3734.3];
const PA_GA = [-5977.7, 3735.35], PA_GB = [-5985.75, 3738.0];   // the gateway front, east end then west end (on the tower's east face)
const PA_SX = 0.654, PA_SY = 0.85, PA_AR = 2.2;   // (and half the width of the arch in the drawing's metres: the map's service way runs through it)   // the gateway's painted drawing (13 x 9.8 m) fitted to the space between the tower and the road
const paG = reg(-6.5, -4.0, 6.5, 9.8, 0, 0, 192, 208), paU = reg(1.4, 0.0, 5.6, 14.0, 0, 208, 48, 112), paT = reg(-5.0, -3.0, 5.0, 20.6, 192, 0, 128, 320), paS = reg(-5.0, -3.0, 5.0, 20.6, 320, 0, 128, 320);
function paStone(p, A, seed) {
  p.rubble(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h, seed, ['rgba(80,68,54,0.34)', 'rgba(205,190,165,0.4)', 'rgba(120,100,75,0.3)', 'rgba(60,52,44,0.25)'], Math.round(A.pw * A.ph / 22), 0.26);
  p.patches(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h, seed + 1, 'rgba(205,190,165,0.2)', 16, 1.4); p.patches(A.x0, A.y0, A.x0 + A.w, A.y0 + A.h, seed + 2, 'rgba(70,55,40,0.16)', 16, 1.2);
  for (const s of [-1, 1]) for (let y = A.y0, i = 0; y < A.y0 + A.h; y += 0.5, i++) { const w = i % 2 ? 0.6 : 1.0; p.ashlar(s > 0 ? A.x0 + A.w - w : A.x0, y, s > 0 ? A.x0 + A.w : A.x0 + w, y + 0.47, '#bda98a', seed + 3 + i, 0.47, 0.8); }
}
function paTex(g) {
  region(g, paG, '#e6e2da', 31701, 0.06, (p) => {   // the white gateway
    const { R, circ, ring, poly, arch, ledge, strip, line, ashlar } = p, SAL = '#ddac8c';
    R(-6.5, -4, 6.5, -0.2, '#a89c8a');
    for (const s of [-1, 1]) { strip(s * 2.9 - 0.68, -0.2, s * 2.9 + 0.68, 6.45, SAL); ledge(s * 2.9 - 0.85, 6.1, s * 2.9 + 0.85, 6.45, SAL); }
    R(-3.55, 6.45, 3.55, 7.7, SAL); ledge(-3.55, 6.85, 3.55, 6.98, '#e8bea0'); ledge(-3.95, 7.7, 3.95, 8.1, '#e4b698'); ledge(-6.5, 8.1, 6.5, 8.3, '#eeeae2'); ledge(-6.5, 9.5, 6.5, 9.75, '#eeeae2'); for (const x of [-4.6, -1.5, 1.5, 4.6]) R(x - 1.2, 8.55, x + 1.2, 9.3, '#dcd7ce');
    R(-2.2, 3.5, -1.5, 3.8, SAL); R(1.5, 3.5, 2.2, 3.8, SAL);
    arch(0, -0.2, 5.55, 4.6, '#f0ece4');   // the moulding round the arch (the arch itself is cut through the wall)
    circ(0, 6.7, 0.5, '#cfc9ba', 0.75); circ(0, 6.65, 0.33, '#a9a294', 0.48); circ(0, 7.42, 0.2, '#c4bdad');
    for (const x of [-2.55, 2.55]) { R(x - 0.2, 2.1, x + 0.2, 2.8, '#2c2620'); line(x, 2.1, x, 1.7, 0.08, '#2c2620'); }
    // the niche with a bust over the side door
    arch(5.1, 4.2, 6.3, 1.5, '#f0ece4'); arch(5.1, 4.3, 6.1, 1.12, '#b9b2a4'); circ(5.1, 5.35, 0.22, '#f2efe8'); poly([[4.68, 4.5], [5.52, 4.5], [5.34, 5.1], [4.86, 5.1]], '#ece8de'); R(4.9, 4.3, 5.3, 4.52, '#d4cec2'); circ(5.1, 6.45, 0.3, '#c9a860', 0.15);
    R(4.2, 3.45, 6.0, 4.05, '#d8d2c4'); for (let y = 3.55; y < 3.95; y += 0.15) R(4.35, y, 5.85, y + 0.04, '#8c8578');
    R(4.15, -0.2, 6.05, 3.35, '#d9d4c8'); arch(5.1, -0.2, 3.2, 1.55, '#33231a'); R(5.07, -0.2, 5.13, 2.7, '#160d08');
  });
  region(g, paU, '#e4e2dc', 31702, 0.04, (p) => { const { win, ledge } = p; for (const y of [10.4, 6.8]) win(3.5, y, y + 2.1, 1.15, '#2c3a34', '#cfccc4', '#4c5a54'); ledge(1.4, 13.7, 5.6, 14.0, '#c9c6be'); });
  region(g, paT, '#b2a288', 31705, 0.13, (p) => {   // the tower's north face
    const { R, arch, win, ledge } = p;
    paStone(p, paT, 31706);
    arch(0.8, 13.6, 16.5, 1.9, '#cdbb9c'); arch(0.8, 13.75, 16.25, 1.35, '#241d18'); R(0.74, 13.75, 0.86, 15.6, '#8a7a62');
    arch(2.4, -0.2, 3.0, 1.7, '#cdbb9c'); arch(2.4, -0.2, 2.8, 1.3, '#241a12');
    // the banner the museum hangs on this face (its lettering is left out)
    R(-2.9, 2.2, -0.3, 10.2, '#e9e4d8'); R(-2.75, 8.1, -0.45, 10.0, '#7c5a2c'); R(-2.1, 8.35, -1.1, 9.7, '#b4893c'); for (let y = 2.9; y < 7.6; y += 0.5) R(-2.55, y, -0.8, y + 0.12, y < 5.0 ? '#a03828' : '#58524a');
    ledge(-5.0, 11.9, 5.0, 12.12, '#c0ae90'); ledge(-5.0, 20.1, 5.0, 20.5, '#c8b696');
  });
  region(g, paS, '#a8977d', 31703, 0.14, (p) => {   // the tower's east face: balcony door, barred windows, the diamond frieze
    const { R, win, ledge, poly } = p;
    paStone(p, paS, 31704);
    R(0.2, 13.4, 1.7, 16.6, '#2b221b'); R(0.0, 16.6, 1.9, 16.85, '#c8b89c'); R(0.92, 13.4, 0.98, 16.6, '#6a5a48');
    win(1.0, 5.6, 8.2, 1.3, '#241f1b', '#c2b296', '#5c5246'); win(-0.6, 0.6, 2.0, 0.9, '#241f1b', '#c2b296', '#5c5246');
    R(-5.0, 8.9, 5.0, 10.0, '#b6a488'); for (let x = -4.8; x < 5; x += 0.55) for (const y of [9.2, 9.7]) { const u = x + (y > 9.5 ? 0.27 : 0); poly([[u - 0.24, y], [u, y + 0.24], [u + 0.24, y], [u, y - 0.24]], (Math.round(x * 4) % 3) ? '#6e6252' : '#d8cab0'); }
    ledge(-5.0, 20.1, 5.0, 20.5, '#c8b696');
  });
}
function buildArcivescovile() {
  initShared();
  const K = 'c3Arciv';
  defMat(K, 448, 320, [1, 1], paTex);
  const SH = (A, M, p, z) => sheet(K, 448, 320, A, M, p, z);
  const [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11] = PA_V, lo = lowest([...PA_V, PA_NE, PA_SE, PA_GA]);
  const gc = [(PA_GA[0] + PA_GB[0]) / 2, (PA_GA[1] + PA_GB[1]) / 2];
  const yG = groundY(...gc) + 0.05;
  begin(yG);
  const Q = [-5986.0, 3797.0];
  // the main house and the low southern wing
  body([v0, v1, Q, v5, v6, v7, v8, v9, v10, v11], lo, PA_TOP, '#c6b79c', '#86705c');
  body([v4, v5, Q, v1, v2, v3], lo, groundY(...v4) + 9.4, '#ded9cf', '#a86a50');
  for (const [a, b] of [[v5, v6], [v4, v5], [v3, v4]]) { const f = face(a, b, 0), top = a === v5 ? PA_TOP : groundY(...v4) + 9.4; B(f.M, -f.l / 2, f.l / 2, top - 0.35, top + 0.18, -0.3, 0.22, '#b09478'); }
  // the tower: its two seen faces, the balcony, the merlons
  const tower = [PA_NE, PA_SE, PA_SW, PA_NW];
  prism('flat', tower, lo, PA_TT, { c: '#ab9a80' });
  const yT = Math.min(groundY(...PA_NE), groundY(-5986.0, 3736.6));
  for (const [a, b, A] of [[PA_NE, PA_NW, paT], [PA_SE, PA_NE, paS]]) {
    const f = face(a, b, yT);
    SH(A, f.M, rect(-f.l / 2, Math.max(-3, lo - yT), f.l / 2, PA_TT - yT), 0.04);
  }
  const E = face(PA_SE, PA_NE, yT).M;
  B(E, -0.5, 2.4, 13.15, 13.4, 0, 0.95, '#c6b496'); for (const x of [-0.15, 2.05]) B(E, x - 0.18, x + 0.18, 12.5, 13.15, 0, 0.55, '#b9a688');
  for (let x = -0.45; x <= 2.4; x += 0.35) B(E, x - 0.025, x + 0.025, 13.4, 14.45, 0.88, 0.93, '#2e2a26'); B(E, -0.5, 2.4, 14.42, 14.5, 0.87, 0.94, '#2e2a26');
  for (let i = 0; i < 4; i++) { const a = tower[i], b = tower[(i + 1) % 4], e = face(b, a, PA_TT), n = 6; for (let k = 0; k < n; k++) { const x = -e.l / 2 + (k + 0.5) * e.l / n; B(e.M, x - 0.45, x + 0.45, 0, 0.85, -0.5, -0.02, '#b8a88c'); pyramid('flat', 0.9, 0.48, 0.4, { M: mul(e.M, tr(x, 0.85, -0.26)), c: '#a8987e', noao: true }); } }
  // the white gateway: a thick wall with its arch left open, painted, cornices and pilasters standing out
  const GF = face(PA_GA, PA_GB, yG), G = mul(GF.M, new THREE.Matrix4().makeScale(PA_SX, PA_SY, 1)), h = GF.l / 2 / PA_SX, gl = Math.max(-4, (lo - yG) / PA_SY);
  const hole = [[-PA_AR, 0], ...archLine(0, PA_AR, 3.4, 1.9, 0, 5), [PA_AR, 0]];
  const outline = [[-h, gl], [-PA_AR, gl], ...hole, [PA_AR, gl], [h, gl], [h, 9.8], [-h, 9.8]];
  extrude('flat', shapeOf(outline), 1.0, { M: G, p: [0, 0, -1.0], c: '#e0dcd4', noao: true });
  SH(paG, G, outline, 0.04);
  // the iron fanlight across the head of the arch, above the way through
  B(G, -PA_AR, PA_AR, 3.38, 3.52, -0.2, -0.1, '#2a2420'); for (let k = 1; k < 8; k++) { const a = PI * k / 8, x = Math.cos(a) * PA_AR, y = Math.sin(a) * 1.85; box('flat', 0.07, Math.hypot(x, y) - 0.05, 0.06, { M: G, p: [0, 3.5, -0.15], rz: Math.atan2(-x, y), c: '#3a342e', noao: true }); }
  B(G, -4.0, 4.0, 7.75, 8.1, -0.1, 0.34, '#e4b698'); B(G, -h, h + 0.1, 9.55, 9.82, -1.1, 0.2, '#ece8e0');
  for (const s of [-1, 1]) { B(G, s * 2.9 - 0.6, s * 2.9 + 0.6, -0.4, 6.45, 0, 0.16, '#ddac8c'); B(G, s * 2.55 - 0.16, s * 2.55 + 0.16, 2.1, 2.8, 0.2, 0.5, '#2c2620'); }
  // the white block set back behind the gateway, beside the passage
  B(G, 2.5, 5.9, gl, 14.0, -5.6, -2.4, '#e2e0da'); SH(paU, mul(G, tr(0.55, 0, 0)), rect(1.9, 7.0, 5.35, 14.0), -2.36);
  B(G, 2.7, 5.5, 10.15, 10.3, -2.4, -1.6, '#b8b4ac'); for (let x = 2.75; x < 5.5; x += 0.42) B(G, x - 0.025, x + 0.025, 10.3, 11.3, -1.66, -1.62, '#38342e'); B(G, 2.7, 5.5, 11.28, 11.35, -1.67, -1.61, '#38342e');
  return done('Palazzo Arcivescovile di Monreale');
}
// the tower and the gateway outside the outline: walls round the tower's free sides, the two piers of the gateway and the block behind it (the arch stays open)
const PA_WALLS = (() => {
  const o = [[...PA_NW, ...PA_NE], [...PA_NE, ...PA_SE], [...PA_SE, ...PA_SW]];
  const dx = PA_GB[0] - PA_GA[0], dz = PA_GB[1] - PA_GA[1], l = Math.hypot(dx, dz), W = (x, d) => [+((PA_GA[0] + PA_GB[0]) / 2 + dx / l * x * PA_SX + dz / l * d).toFixed(2), +((PA_GA[1] + PA_GB[1]) / 2 + dz / l * x * PA_SX - dx / l * d).toFixed(2)], h = l / 2 / PA_SX;
  const box_ = (x0, x1, d0, d1) => { const q = [W(x0, d0), W(x1, d0), W(x1, d1), W(x0, d1)]; for (let i = 0; i < 4; i++) o.push([...q[i], ...q[(i + 1) % 4]]); };
  box_(-h, -PA_AR, 0, 1.0); box_(PA_AR, h, 0, 1.0); box_(2.5, 5.9, 2.4, 5.6);   // (d: metres back from the front)
  return o;
})();

export const R2_C3 = [
  { name: 'Chiesa Madre di Altofonte', x: -5458, z: 7826, radius: 28, skipIds: [], build: buildAltofonte, walls: segs(AM_P) },
  { name: 'Cappella di San Michele ad Altofonte', x: -5450, z: 7791, radius: 14, skipIds: ['w1189157566'], build: buildSanMichele },
  { name: 'Collegiata di Monreale', x: -6046, z: 3518, radius: 35, skipIds: ['w153253781'], build: buildCollegiata, walls: CL_WALLS },
  { name: 'Convento di Baida', x: -5648, z: 122, radius: 75, skipIds: ['w82238244', 'w82238500'], build: buildBaida },
  { name: 'Convento di Santa Maria di Gesu', x: 1565, z: 3722, radius: 60, skipIds: ['w80979177'], build: buildGesu, walls: [...GS_WALLS, ...GS_STEPS] },
  { name: 'Chiostro dei Benedettini di Monreale', x: -6041, z: 3775, radius: 45, skipIds: [], build: buildChiostro },
  { name: 'Municipio di Monreale', x: -6036, z: 3673, radius: 35, skipIds: ['w153225657'], build: buildMunicipio },
  { name: 'Palazzo Arcivescovile di Monreale', x: -5990, z: 3762, radius: 52, skipIds: ['w182545414'], build: buildArcivescovile, walls: PA_WALLS },
];
