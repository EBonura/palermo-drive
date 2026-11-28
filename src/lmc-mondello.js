// City landmarks, Mondello: the lido cabins on the sand, the blue seafront lamp posts, the Torre di Mondello (the old tonnara tower),
// and the little fishing harbour (moored and beached gozzi, the pontile). Registered in src/landmarks-city.js.
// Every shape here was checked against photos (Wikimedia Commons Category:Mondello and its harbour, tower and Alle Terrazze categories) and satellite views:
//  - cabins: narrow wooden huts painted sky blue / turquoise with white frames (boarded front with a louvred door under a small gable with a round vent, side walls
//    in white-framed panels with X braces), a low red or salmon corrugated gable roof with a short overhang, a few cream or mint ones among them, standing side by
//    side in back-to-back rows that run from the promenade towards the water, a few metres apart, with the umbrellas in the aisles.
//    Commons files read for the cabins: "Mondello 5.jpg" (close cabins on the sand: blue panelled walls, white frames, X braces, gable with a round vent, red roofs),
//    "Mondello beach.jpg" (aerial: back-to-back double rows, roofs in red, salmon and white, cabin about 1.3 m wide and 1.5 to 2 m deep, doors on the aisles)
//    Not verified: the numbers on the door plates. Six plain ones are spread over the cabins by position; they are not the real cabins' numbers.
//  - lamp posts: cobalt-blue Liberty posts with curled brackets and hanging lanterns (one curl on the beach road at the village end, two on the harbour quay and the
//    piazza); along the beach road further south the posts on the sea side are dark green with two small flat heads. Mapillary frames of 2019 and 2022 along the road
//    (for example 254985066369121 and 822414035041616 for the blue ones, 471799387224615 and 3936733736361709 for the green ones). Not verified: where exactly the blue
//    posts give way to the green ones (put at z = -9945), the spacing, and the posts in front of the Stabilimento gate. The grey road lamps on the land side are not built.
//  - tower: round, sandy-tan rubble tower about 14 m tall, a little battered; under the top a ring of small corbels carries the parapet with its close-set teeth; one small arched window on the
//    harbour side. Commons "Mondello BW 2012-10-09 14-02-10" (the tower square on), "Torre di Mondello 1", "Palermo - Torre della Tonnara di Mondello - 2025-09-07"
//  - boats: wooden gozzi, white hulls with a red line, blue or yellow strakes, hauled out on the slipway or moored along the quay
import * as THREE from 'three';
import { PI, defMat, begin, end, part, rotY, box, bx, cyl, sphere, prism, panel, shell, extrude, rail, mul, tr, frame, groundY, groundRange, pairsOf, centroid, initShared, RNG, noiseDots, streaks } from './lmc-kit.js';

// landward edge of the sand [z, x] (from the OSM beach polygon, which is the back of the dry beach)
const LAND = [[-10020, -3128], [-9980, -3137], [-9940, -3158], [-9900, -3159], [-9860, -3153], [-9820, -3147], [-9780, -3141], [-9740, -3128], [-9700, -3104],
  [-9660, -3081], [-9620, -3061], [-9580, -3029], [-9540, -3020], [-9500, -3000], [-9460, -2987], [-9420, -2966], [-9380, -2942], [-9340, -2912], [-9300, -2874],
  [-9260, -2839], [-9220, -2804], [-9180, -2766], [-9140, -2728], [-9100, -2687], [-9060, -2644], [-9020, -2598]];
function landX(z) {
  if (z <= LAND[0][0]) return LAND[0][1];
  for (let i = 0; i < LAND.length - 1; i++) { const a = LAND[i], b = LAND[i + 1]; if (z >= a[0] && z <= b[0]) return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]); }
  return LAND[LAND.length - 1][1];
}
// unit vector along the shore (towards +z) and the one pointing out to sea (+x side)
function shoreFrame(z) {
  const dz = 12, dx = landX(z + dz) - landX(z - dz), l = Math.hypot(dx, 2 * dz), tx = dx / l, tz = 2 * dz / l;
  let nx = tz, nz = -tx; if (nx < 0) { nx = -nx; nz = -nz; }
  return { tx, tz, nx, nz };
}

function defMats() {
  initShared();
  defMat('mnCabW', 256, 256, [1, 1], paintCabinWalls);
  defMat('mnCabR', 256, 256, [1, 1], paintCabinRoof);
  defMat('mdlStone', 128, 128, [4, 4], (g, w, h) => {
    g.fillStyle = '#c8ab82'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 900, 3.2, 901, ['rgba(120,92,60,0.22)', 'rgba(236,214,172,0.28)', 'rgba(90,70,48,0.16)']);
    g.strokeStyle = 'rgba(100,78,52,0.28)'; g.lineWidth = 1.2; for (let y = 6; y < h; y += 13) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 1); g.stroke(); }
  });
  defMat('mnHull', 0, 0, [1, 1], null, { roughness: 0.7 });
  defMat('mnTerra', 64, 64, [1, 1], (g, w, h) => { g.fillStyle = '#b8643f'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 80, 2, 902, ['rgba(80,40,20,0.2)', 'rgba(240,190,150,0.2)']); });
}

// ====================================================================================================
// lido cabins
// ====================================================================================================
// Cabin atlas (256 x 256), walls: FRONT (the boarded door wall), SIDE (white-framed panels with X braces, also the back), GABLE (the small gable above the door),
// TRIM (white painted board for the fascia) and DECK (grey weathered boards for the step and the soffit). All regions are in pixels.
const AT = { front: [2, 2, 112, 192], side: [118, 2, 136, 192], gable: [2, 200, 112, 50], trim: [118, 200, 68, 50], deck: [188, 200, 66, 50] };
const PLATES = ['8', '14', '27', '33', '46', '59'];                  // plain plate numbers, painted once each into the atlas
const CW = 1.28, CD = 1.36, CY0 = -0.4, CH = 2.12, CR = 0.4;      // cabin width along the row, depth, foot below ground, eave height, gable rise
function paintCabinWalls(g, w, h) {
  const r = RNG(951), rr = (a, b) => a + (b - a) * r();
  g.fillStyle = '#7a8a8e'; g.fillRect(0, 0, w, h);
  const pxm = 192 / (CH - CY0);                                // pixels per metre, vertically
  const groundY_ = (x, y0, hh) => y0 + (CH / (CH - CY0)) * hh; // canvas y of the ground line in a wall region
  // boarded wall in sky blue, with the wear of salt and sun; (x0, y0, ww, hh) is a region
  const boards = (x0, y0, ww, hh, bw) => {
    const cols = ['#79c1da', '#82c8de', '#74bad4', '#7cc4d9', '#6db4cf'];
    for (let x = 0, i = 0; x < ww; x += bw, i++) {
      g.fillStyle = cols[(i * 7 + (r() * 3 | 0)) % cols.length]; g.fillRect(x0 + x, y0, bw, hh);
      g.fillStyle = 'rgba(40,96,128,0.55)'; g.fillRect(x0 + x, y0, 1, hh);                       // groove
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0 + x + 1, y0, 1, hh);
      g.fillStyle = 'rgba(20,50,70,0.08)'; g.fillRect(x0 + x + bw - 2, y0, 2, hh);
    }
    // grain and knots
    for (let i = 0; i < ww * hh / 90; i++) { g.fillStyle = r() < 0.5 ? 'rgba(30,80,110,0.12)' : 'rgba(255,255,255,0.10)'; g.fillRect(x0 + r() * ww, y0 + r() * hh, 1, 2 + r() * 8); }
  };
  const white = '#eef0e8';
  const rect = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  // weathering shared by every wall region: flaking paint, rust streaks under the nails, salt at the foot, grime under the eave, sand at the bottom
  const wear = (x0, y0, ww, hh, nails) => {
    const gy = groundY_(x0, y0, hh);
    for (let i = 0; i < 26; i++) {                                                                    // flaked paint: pale patches and the grey wood under them
      const x = x0 + r() * ww, y = y0 + 10 + r() * (hh - 30), sw = 2 + r() * 7, sh = 1 + r() * 5;
      g.fillStyle = r() < 0.5 ? 'rgba(236,238,228,0.55)' : 'rgba(120,112,98,0.6)'; g.fillRect(x, y, sw, sh);
    }
    for (const [nx, ny] of nails) {                                                                   // nails with a rust run
      g.fillStyle = '#5a4a40'; g.fillRect(x0 + nx, y0 + ny, 2, 2);
      const gr = g.createLinearGradient(0, y0 + ny, 0, y0 + ny + 18 + r() * 16); gr.addColorStop(0, 'rgba(150,78,40,0.55)'); gr.addColorStop(1, 'rgba(150,78,40,0)');
      g.fillStyle = gr; g.fillRect(x0 + nx, y0 + ny + 1, 2, 34);
    }
    const sg = g.createLinearGradient(0, gy - 44, 0, gy); sg.addColorStop(0, 'rgba(255,255,240,0)'); sg.addColorStop(1, 'rgba(255,255,240,0.32)');   // salt bloom
    g.fillStyle = sg; g.fillRect(x0, gy - 44, ww, 44);
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,245,0.2)'; g.fillRect(x0 + r() * ww, gy - 36 + r() * 34, 4 + r() * 10, 1 + r() * 2); }
    const eg = g.createLinearGradient(0, y0, 0, y0 + 22); eg.addColorStop(0, 'rgba(10,24,40,0.42)'); eg.addColorStop(1, 'rgba(10,24,40,0)');   // under the roof edge
    g.fillStyle = eg; g.fillRect(x0, y0, ww, 22);
    const dg = g.createLinearGradient(0, gy - 6, 0, y0 + hh); dg.addColorStop(0, 'rgba(120,96,64,0)'); dg.addColorStop(0.2, 'rgba(150,126,86,0.75)'); dg.addColorStop(1, 'rgba(190,170,128,1)');   // splashed sand, then sand
    g.fillStyle = dg; g.fillRect(x0, gy - 6, ww, y0 + hh - gy + 6);
  };

  // ---- FRONT: boards, white frame, louvred door with a number plate
  { const [x0, y0, ww, hh] = AT.front, gy = groundY_(x0, y0, hh);
    boards(x0, y0, ww, hh, 7);
    rect(white, x0, y0, 6, hh); rect(white, x0 + ww - 6, y0, 6, hh); rect(white, x0, y0, ww, 6);               // posts and head rail
    rect('#d8dcd2', x0 + 5, y0 + 5, 1, hh - 5); rect('#d8dcd2', x0 + ww - 7, y0 + 5, 1, hh - 5);
    rect(white, x0, gy - 8, ww, 7);                                                                          // foot rail
    const dx = x0 + 20, dy = y0 + 30, dw = ww - 40, dh = gy - 9 - dy;
    rect('#f4f4ec', dx - 4, dy - 4, dw + 8, dh + 4);                                                            // door frame
    rect('#c9b68e', dx, dy, dw, dh);                                                                            // door leaf, cream-brown
    g.fillStyle = 'rgba(80,60,36,0.55)'; for (let y = dy + 6; y < dy + dh - 4; y += 6) g.fillRect(dx + 3, y, dw - 6, 2);   // louvres, shadow
    g.fillStyle = 'rgba(255,244,214,0.55)'; for (let y = dy + 8; y < dy + dh - 4; y += 6) g.fillRect(dx + 3, y, dw - 6, 1);
    rect('#6e5a3a', dx + dw / 2 - 1, dy, 2, dh);                                                                // meeting stile
    rect('#5b5048', dx + dw - 8, dy + dh * 0.52, 3, 9);                                                         // latch
    rect('#4a4038', dx + 2, dy + 8, 4, 3); rect('#4a4038', dx + 2, dy + dh - 14, 4, 3);                         // hinges
    // (the number plate over the door is a small separate quad, see PLATES)
    const sh = g.createLinearGradient(0, dy, dx + dw, dy); sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(dx, dy, dw, dh);
    wear(x0, y0, ww, hh, [[10, 40], [ww - 12, 52], [12, 120], [ww - 10, 130], [ww / 2, 14], [30, 21], [ww - 32, 24]]);
  }
  // ---- SIDE: two white-framed panels with X braces
  { const [x0, y0, ww, hh] = AT.side, gy = groundY_(x0, y0, hh);
    boards(x0, y0, ww, hh, 8);
    const pw = (ww - 18) / 2, top = y0 + 6, bot = gy - 9;
    rect(white, x0, y0, ww, 7); rect(white, x0, gy - 9, ww, 8);                                                 // head and foot rails
    rect(white, x0, y0, 6, hh); rect(white, x0 + ww - 6, y0, 6, hh); rect(white, x0 + ww / 2 - 3, y0, 6, hh);  // posts and mullion
    g.strokeStyle = white; g.lineWidth = 3;
    for (const px of [x0 + 6, x0 + ww / 2 + 3]) {                                                              // the X braces
      g.beginPath(); g.moveTo(px, top + 2); g.lineTo(px + pw - 3, bot); g.moveTo(px + pw - 3, top + 2); g.lineTo(px, bot); g.stroke();
    }
    g.strokeStyle = 'rgba(60,70,60,0.28)'; g.lineWidth = 1;
    for (const px of [x0 + 6, x0 + ww / 2 + 3]) { g.beginPath(); g.moveTo(px + 2, top + 3); g.lineTo(px + pw - 1, bot); g.moveTo(px + pw - 1, top + 3); g.lineTo(px + 2, bot); g.stroke(); }
    wear(x0, y0, ww, hh, [[10, 30], [ww / 2 - 8, 60], [ww - 14, 90], [20, 140], [ww / 2 + 12, 128], [ww - 22, 20]]);
  }
  // ---- GABLE: blue boards, white barge lines, round vent
  { const [x0, y0, ww, hh] = AT.gable;
    boards(x0, y0, ww, hh, 7);
    g.strokeStyle = white; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0 + hh); g.lineTo(x0 + ww / 2, y0 + 2); g.lineTo(x0 + ww, y0 + hh); g.stroke();
    rect(white, x0, y0 + hh - 4, ww, 4);
    g.fillStyle = '#e8ecdf'; g.beginPath(); g.arc(x0 + ww / 2, y0 + hh * 0.62, 7.5, 0, 6.3); g.fill();
    g.fillStyle = '#1f2a33'; g.beginPath(); g.arc(x0 + ww / 2, y0 + hh * 0.62, 5, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(200,210,200,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + ww / 2 - 5, y0 + hh * 0.62); g.lineTo(x0 + ww / 2 + 5, y0 + hh * 0.62); g.moveTo(x0 + ww / 2, y0 + hh * 0.62 - 5); g.lineTo(x0 + ww / 2, y0 + hh * 0.62 + 5); g.stroke();
    const eg = g.createLinearGradient(0, y0, 0, y0 + hh); eg.addColorStop(0, 'rgba(10,24,40,0.0)'); eg.addColorStop(1, 'rgba(10,24,40,0.28)'); g.fillStyle = eg; g.fillRect(x0, y0, ww, hh);
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(236,238,228,0.5)'; g.fillRect(x0 + r() * ww, y0 + r() * hh, 2 + r() * 6, 1 + r() * 3); }
  }
  // ---- TRIM: white painted board, scuffed
  { const [x0, y0, ww, hh] = AT.trim;
    rect('#ecece2', x0, y0, ww, hh);
    for (let i = 0; i < 30; i++) { g.fillStyle = r() < 0.5 ? 'rgba(140,130,110,0.35)' : 'rgba(255,255,255,0.5)'; g.fillRect(x0 + r() * ww, y0 + r() * hh, 2 + r() * 8, 1 + r() * 2); }
    g.fillStyle = 'rgba(160,110,70,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(x0 + r() * ww, y0 + r() * hh, 1, 6 + r() * 10);
  }
  // ---- PLATES: six number plates in the upper part of the TRIM region (the eave boards only sample its lower 20 px), 22 x 13 px each
  PLATES.forEach((num, i) => {
    const px = AT.trim[0] + (i % 3) * 22, py = AT.trim[1] + 1 + ((i / 3) | 0) * 13;
    g.fillStyle = '#f4f4ec'; g.fillRect(px, py, 22, 13);
    g.fillStyle = 'rgba(80,80,70,0.35)'; g.fillRect(px, py + 12, 22, 1); g.fillRect(px + 21, py, 1, 13);
    g.fillStyle = '#243040'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, px + 11, py + 7);
    g.fillStyle = 'rgba(236,238,228,0.45)'; g.fillRect(px + 2 + ((i * 5) % 14), py + 2 + (i % 3) * 3, 4, 1);
  });
  // ---- DECK: grey weathered boards
  { const [x0, y0, ww, hh] = AT.deck;
    for (let y = 0; y < hh; y += 10) { g.fillStyle = ['#8d8576', '#9a9382', '#827b6c'][(y / 10) % 3]; g.fillRect(x0, y0 + y, ww, 10); g.fillStyle = 'rgba(30,24,16,0.5)'; g.fillRect(x0, y0 + y, ww, 1); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,32,20,0.22)'; g.fillRect(x0 + r() * ww, y0 + r() * hh, 4 + r() * 14, 1); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(214,196,150,0.35)'; g.fillRect(x0 + r() * ww, y0 + r() * hh, 2 + r() * 4, 2); }
  }
}
function paintCabinRoof(g, w, h) {
  const r = RNG(952);
  const rib = 16;                                                                              // 16 ribs across
  g.fillStyle = '#cf5a4b'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += rib) {
    const gr = g.createLinearGradient(x, 0, x + rib, 0); gr.addColorStop(0, 'rgba(90,20,14,0.38)'); gr.addColorStop(0.25, 'rgba(255,170,140,0.28)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,14,10,0.34)');
    g.fillStyle = gr; g.fillRect(x, 0, rib, h);
  }
  for (let i = 0; i < 24; i++) { g.fillStyle = r() < 0.65 ? 'rgba(240,160,140,0.4)' : 'rgba(130,40,28,0.3)'; g.fillRect(r() * w, r() * h, 10 + r() * 40, 6 + r() * 30); }      // faded and darker paint
  streaks(g, w, h, 34, 953, 0.4, 120, '60,18,10');
  for (let i = 0; i < 16; i++) {                                                                // rust bloom
    const x = r() * w, y = r() * h, rad = 4 + r() * 14, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(150,72,30,0.6)'); gr.addColorStop(1, 'rgba(150,72,30,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (const y of [14, h - 14]) for (let x = rib / 2; x < w; x += rib * 2) { g.fillStyle = '#4a2a22'; g.fillRect(x, y, 3, 3); g.fillStyle = 'rgba(160,84,40,0.55)'; g.fillRect(x, y + 3, 2, 10); }   // screws and their runs
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(244,240,226,0.5)'; g.fillRect(r() * w, r() * h, 4 + r() * 8, 3 + r() * 5); }   // gull droppings and salt
  const eg = g.createLinearGradient(0, h - 26, 0, h); eg.addColorStop(0, 'rgba(60,24,16,0)'); eg.addColorStop(1, 'rgba(60,24,16,0.45)'); g.fillStyle = eg; g.fillRect(0, h - 26, w, 26);   // drip edge
  g.fillStyle = 'rgba(40,12,8,0.4)'; g.fillRect(0, 0, w, 6);                                    // ridge
}
// one cabin, door towards +x, centred on its floor plan; wall geometry (material mnCabW) and roof geometry (mnCabR)
let CABGEO = null;
function cabinGeos() {
  if (CABGEO) return CABGEO;
  const W2 = CW / 2, D2 = CD / 2, xf = D2 + 0.16, xb = -D2 - 0.06, zs = W2 + 0.1, ye = CH - 0.06, yr = CH + CR;
  const mk = () => ({ p: [], n: [], u: [] });
  const roof = mk();
  const wallBase = mk(), wall = wallBase;
  const px = (reg, x, y) => [(reg[0] + x * reg[2]) / 256, 1 - (reg[1] + (1 - y) * reg[3]) / 256];     // x, y in 0..1 of the region (y up)
  const tri = (B, a, b, c, n, ua, ub, uc) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = ab[1] * ac[2] - ab[2] * ac[1], cy = ab[2] * ac[0] - ab[0] * ac[2], cz = ab[0] * ac[1] - ab[1] * ac[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
    for (const [pp, uu] of [[a, ua], [b, ub], [c, uc]]) { B.p.push(pp[0], pp[1], pp[2]); B.n.push(n[0], n[1], n[2]); B.u.push(uu[0], uu[1]); }
  };
  // quad seen from outside: bl, br, tr, tl and the region's uv corners
  const quad = (B, bl, br, tr_, tl, n, reg, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
    const a = px(reg, u0, v0), b = px(reg, u1, v0), c = px(reg, u1, v1), d = px(reg, u0, v1);
    tri(B, bl, br, tr_, n, a, b, c); tri(B, bl, tr_, tl, n, a, c, d);
  };
  const y0 = CY0;
  // walls; the door wall uses the whole FRONT region, the other three the SIDE region (the back is plain boards)
  quad(wall, [D2, y0, W2], [D2, y0, -W2], [D2, CH, -W2], [D2, CH, W2], [1, 0, 0], AT.front);
  quad(wall, [-D2, y0, W2], [D2, y0, W2], [D2, CH, W2], [-D2, CH, W2], [0, 0, 1], AT.side);
  quad(wall, [D2, y0, -W2], [-D2, y0, -W2], [-D2, CH, -W2], [D2, CH, -W2], [0, 0, -1], AT.side);
  quad(wall, [-D2, y0, -W2], [-D2, y0, W2], [-D2, CH, W2], [-D2, CH, -W2], [-1, 0, 0], AT.side, 0.5, 1, 0, 1);
  // gables
  tri(wall, [D2, CH, W2], [D2, CH, -W2], [D2, yr, 0], [1, 0, 0], px(AT.gable, 0, 0), px(AT.gable, 1, 0), px(AT.gable, 0.5, 1));
  tri(wall, [-D2, CH, -W2], [-D2, CH, W2], [-D2, yr, 0], [-1, 0, 0], px(AT.gable, 0, 0), px(AT.gable, 1, 0), px(AT.gable, 0.5, 1));
  // soffit and the two eave boards
  quad(wall, [xb, ye, -zs], [xf, ye, -zs], [xf, ye, zs], [xb, ye, zs], [0, -1, 0], AT.deck, 0, 1, 0, 0.9);
  quad(wall, [xb, ye - 0.09, zs], [xf, ye - 0.09, zs], [xf, ye, zs], [xb, ye, zs], [0, 0, 1], AT.trim, 0, 1, 0, 0.4);
  quad(wall, [xf, ye - 0.09, -zs], [xb, ye - 0.09, -zs], [xb, ye, -zs], [xf, ye, -zs], [0, 0, -1], AT.trim, 0, 1, 0, 0.4);
  // door step: top, front and both sides
  const sx = D2 + 0.3, sz = 0.46, sy = 0.16;
  quad(wall, [D2, sy, sz], [sx, sy, sz], [sx, sy, -sz], [D2, sy, -sz], [0, 1, 0], AT.deck, 0, 1, 0, 0.7);
  quad(wall, [sx, y0, sz], [sx, y0, -sz], [sx, sy, -sz], [sx, sy, sz], [1, 0, 0], AT.deck, 0, 1, 0, 0.3);
  quad(wall, [D2, y0, sz], [sx, y0, sz], [sx, sy, sz], [D2, sy, sz], [0, 0, 1], AT.deck, 0, 0.3, 0, 0.3);
  quad(wall, [sx, y0, -sz], [D2, y0, -sz], [D2, sy, -sz], [sx, sy, -sz], [0, 0, -1], AT.deck, 0, 0.3, 0, 0.3);
  // roof slopes (ridge along x): u along the ridge, v from the ridge down to the eave
  const sl = Math.hypot(CR + 0.06, zs), nzv = (CR + 0.06) / sl, nyv = zs / sl;
  tri(roof, [xb, yr, 0], [xf, yr, 0], [xf, ye, zs], [0, nyv, nzv], [0, 0], [1, 0], [1, 1]); tri(roof, [xb, yr, 0], [xf, ye, zs], [xb, ye, zs], [0, nyv, nzv], [0, 0], [1, 1], [0, 1]);
  tri(roof, [xf, yr, 0], [xb, yr, 0], [xb, ye, -zs], [0, nyv, -nzv], [0, 0], [1, 0], [1, 1]); tri(roof, [xf, yr, 0], [xb, ye, -zs], [xf, ye, -zs], [0, nyv, -nzv], [0, 0], [1, 1], [0, 1]);
  const build = (B) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2)); return g; };
  // the number plate over the door: 22 x 13 px of the 112 x 192 FRONT region, 1.2 cm proud of the door wall (2 triangles); one wall geometry per plate number
  const pw = 22 / 112 * CW / 2, yt = CH - 10 / (192 / (CH - CY0)), yb = CH - 23 / (192 / (CH - CY0)), xp = D2 + 0.012;
  const walls = PLATES.map((_, i) => {
    const B = { p: wallBase.p.slice(), n: wallBase.n.slice(), u: wallBase.u.slice() };
    const px0 = AT.trim[0] + (i % 3) * 22, py0 = AT.trim[1] + 1 + ((i / 3) | 0) * 13;
    quad(B, [xp, yb, pw], [xp, yb, -pw], [xp, yt, -pw], [xp, yt, pw], [1, 0, 0], [px0, py0, 22, 13]);
    return build(B);
  });
  return CABGEO = { wall: walls, roof: build(roof) };
}
const WALLT = ['#ffffff', '#f6fbff', '#e8f4ee', '#f4f8e4', '#ffffff', '#e2f0f6', '#fff6e0'];      // tints on the blue walls: most stay sky blue, a few go mint or sand
const ROOFT = ['#ffffff', '#ffffff', '#f4cfc4', '#d9a69c', '#ffffff', '#e8e2dc', '#c9d6d8'];     // red, salmon, darker red, a few whitened or grey-blue
function cabinBlocks(za, zb, seed, gap) {
  const rn = RNG(seed), tn = RNG(seed + 7), G = cabinGeos();
  begin(0);
  for (let z = za; z <= zb; z += gap + Math.floor(rn() * 4)) {
    const f = shoreFrame(z), P = [landX(z) + 3.2 * f.nx, z + 3.2 * f.nz];
    if (Math.hypot(P[0] + 3043, P[1] + 9598) < 45) continue;                                        // the Stabilimento gate keeps its forecourt
    let tw = 0; while (tw < 70 && groundY(P[0] + f.nx * tw, P[1] + f.nz * tw) > 0.3) tw += 1;        // distance to the waterline
    const n = Math.min(13, Math.floor((tw - 9) / 1.3)); if (n < 3) continue;
    const kA = (rn() * WALLT.length) | 0, kB = rn() < 0.55 ? kA : (rn() * WALLT.length) | 0;
    for (let r = 0; r < 2; r++) {
      const kw = r ? kB : kA, off = (r ? 1 : -1) * 0.72;
      for (let i = 0; i < n; i++) {
        const t = 1.2 + i * 1.3;
        const wx = P[0] + f.nx * t - f.nz * off, wz = P[1] + f.nz * t + f.nx * off, y = groundY(wx, wz);   // sideways = (-nz, nx) * off
        if (y < 0.3) continue;
        const M = frame(wx, y, wz, f.nx, f.nz), Mc = r ? mul(M, rotY(PI)) : M;                        // the door faces the aisle: away from the other row
        const wc = tn() < 0.82 ? WALLT[kw] : WALLT[(tn() * WALLT.length) | 0], rc = ROOFT[(tn() * ROOFT.length) | 0];
        const pv = Math.abs(Math.imul(Math.round(wx * 10) ^ Math.imul(Math.round(wz * 10), 73856093), 2654435761)) >>> 8;   // plate by position, so it is the same every load
        part('mnCabW', G.wall[pv % PLATES.length], { M: Mc, c: wc, uv: 'keep', noao: true });
        part('mnCabR', G.roof, { M: Mc, c: rc, uv: 'keep', noao: true });
      }
    }
  }
}
function cabinLandmark(name, za, zb, seed, gap = 8) {
  const zc = (za + zb) / 2, xc = landX(zc) + 12;
  return { name, x: xc, z: zc, radius: Math.abs(zb - za) / 2 + 40, skipIds: [], build: () => { defMats(); cabinBlocks(za, zb, seed, gap); return end(name); } };
}
export const MN_CABINS = [
  cabinLandmark('Mondello cabins north', -9900, -9760, 931),
  cabinLandmark('Mondello cabins centre', -9560, -9400, 932),
  cabinLandmark('Mondello cabins Valdesi 1', -9380, -9200, 933, 9),
  cabinLandmark('Mondello cabins Valdesi 2', -9170, -9020, 934, 9),
];

// ====================================================================================================
// the seafront and piazza lamp posts. Three kinds, all in the one flat material:
//  - 'single': blue Liberty post with one curled bracket over the road and a hanging lantern (the village end of the seafront)
//  - 'double': blue Liberty post with two curls and two lanterns (the harbour quay and the piazza)
//  - 'sea': dark green post with two small flat heads (the sea side of the beach road, from the last village post down to Valdesi)
// ====================================================================================================
// a three-sided tube along a list of [x, y, z] points (6 triangles a segment)
export function tubeGeo(pts, r) {
  const pos = [], nor = [], V = pts.map(p => new THREE.Vector3(...p));
  const ring = V.map((p, i) => {
    const t = V[Math.min(V.length - 1, i + 1)].clone().sub(V[Math.max(0, i - 1)]).normalize();
    const u = new THREE.Vector3(Math.abs(t.y) > 0.9 ? 1 : 0, Math.abs(t.y) > 0.9 ? 0 : 1, 0).cross(t).normalize(), w = t.clone().cross(u);
    return [0, 1, 2].map(k => { const n = u.clone().multiplyScalar(Math.cos(k * 2 * PI / 3)).addScaledVector(w, Math.sin(k * 2 * PI / 3)); return [p.clone().addScaledVector(n, r), n]; });
  });
  for (let i = 0; i < V.length - 1; i++) for (let k = 0; k < 3; k++) {
    const A = ring[i][k], B = ring[i][(k + 1) % 3], C = ring[i + 1][(k + 1) % 3], D = ring[i + 1][k];
    for (const q of [A, B, C, A, C, D]) { pos.push(q[0].x, q[0].y, q[0].z); nor.push(q[1].x, q[1].y, q[1].z); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
let LAMPG = null;
function lampGeos() {
  if (LAMPG) return LAMPG;
  const open = (rt, rb, h, seg, y) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, true); g.translate(0, y + h / 2, 0); return g; };
  const curl = (ax, az) => tubeGeo([[0, 6.35, 0], [ax * 0.12, 6.92, az * 0.12], [ax * 0.46, 7.16, az * 0.46], [ax * 0.78, 7.04, az * 0.78], [ax * 0.86, 6.74, az * 0.86]], 0.045);
  const dome = new THREE.ConeGeometry(0.32, 0.3, 6, 1, true); dome.translate(0, 6.62, 0);
  return LAMPG = { pole: open(0.065, 0.12, 6.5, 5, 0), poleHi: open(0.05, 0.065, 0.75, 4, 6.5), collar: open(0.12, 0.17, 1.35, 5, 0), s: curl(0, -1), a: curl(1, 0), b: curl(-1, 0), dome, glass: open(0.21, 0.1, 0.3, 6, 6.17), sea: open(0.06, 0.1, 6.4, 5, 0) };
}
export function lampPost(x, y, z, ang, kind = 'double') {
  const G = lampGeos(), M = frame(x, y, z, Math.sin(ang), Math.cos(ang));
  if (kind === 'sea') {
    part('flat', G.sea, { M, c: '#2c6652', noao: true });
    bx('flat', M, -0.62, 0.62, 6.34, 6.42, -0.04, 0.04, { c: '#2c6652', noao: true });
    for (const sg of [-1, 1]) bx('flat', M, sg * 0.68 - 0.22, sg * 0.68 + 0.22, 6.36, 6.54, -0.16, 0.16, { c: '#8f948f', noao: true, rz: sg * 0.18 });
    return;
  }
  const c = '#2358a8';
  part('flat', G.pole, { M, c, noao: true });
  part('flat', G.collar, { M, c: '#1d4b90', noao: true });
  for (const [geo, dx, dz] of kind === 'single' ? [[G.s, 0, -0.86]] : [[G.a, 0.86, 0], [G.b, -0.86, 0]]) {
    part('flat', geo, { M, c, noao: true });
    part('flat', G.dome, { M, p: [dx, 0, dz], c: '#1b3f73', noao: true });
    part('flat', G.glass, { M, p: [dx, 0, dz], c: '#e9e2c4', noao: true });
  }
  if (kind !== 'single') part('flat', G.poleHi, { M, c, noao: true });
}
// the last blue post on the beach road stands about here; further south the posts on the sea side are the green ones
const LIBERTY_SOUTH = -9945;
function lampLandmark(name, za, zb, step) {
  const zc = (za + zb) / 2;
  return { name, x: landX(zc) - 4, z: zc, radius: Math.abs(zb - za) / 2 + 40, skipIds: [], build: () => {
    defMats(); begin(0);
    for (let z = za; z <= zb; z += step) {
      const f = shoreFrame(z), x = landX(z) - 1.6 * f.nx, zz = z - 1.6 * f.nz;
      lampPost(x, groundY(x, zz), zz, Math.atan2(f.nx, f.nz), z < LIBERTY_SOUTH ? 'single' : 'sea');
    }
    return end(name);
  } };
}
export const MN_LAMPS = [
  lampLandmark('Mondello lamps north', -10010, -9700, 26),
  lampLandmark('Mondello lamps middle', -9690, -9390, 26),
  lampLandmark('Mondello lamps south', -9380, -9020, 28),
];

// ====================================================================================================
// the harbour: tower, slipway boats, moored boats, the pontile
// ====================================================================================================
function gozzo(x, y, z, yaw, len, cols, o = {}) {
  // hull in plan: pointed bow at +z; three slices with a sheer line
  const hw = len * 0.19, pl = (w, l0, l1, bow) => [[-w * 0.78, l0], [-w, l0 + (l1 - l0) * 0.32], [-w, l0 + (l1 - l0) * 0.7], [-w * 0.55, l1 - bow * 0.35], [0, l1], [w * 0.55, l1 - bow * 0.35], [w, l0 + (l1 - l0) * 0.7], [w, l0 + (l1 - l0) * 0.32], [w * 0.78, l0]];
  const M = mul(tr(x, y, z), new THREE.Matrix4().makeRotationY(yaw));
  const L = len / 2;
  prism('mnHull', pl(hw * 0.62, -L * 0.88, L * 0.9, len * 0.4), -0.32, 0.05, { M, c: cols[0], noao: true });
  prism('mnHull', pl(hw * 0.98, -L, L, len * 0.45), 0.05, 0.42, { M, c: cols[1], noao: true });
  prism('mnHull', pl(hw, -L, L, len * 0.45), 0.42, 0.52, { M, c: cols[2], noao: true });
  prism('mnHull', pl(hw * 0.72, -L * 0.8, L * 0.8, len * 0.5), 0.46, 0.55, { M, c: o.deck || '#b98a55', noao: true });  // thwart deck
  bx('mnHull', M, -0.07, 0.07, 0.4, 1.05, L * 0.84, L * 0.9, { c: cols[2], noao: true });                              // raised stem
  if (o.cabin) { bx('mnHull', M, -0.55, 0.55, 0.5, 1.7, -L * 0.2, L * 0.15, { c: '#f1ece0', noao: true }); bx('mnHull', M, -0.6, 0.6, 1.7, 1.78, -L * 0.25, L * 0.2, { c: '#2c61a8', noao: true }); }
}
const HULLS = [
  ['#2c4f94', '#f2eee2', '#c8342c'], ['#8b3a2c', '#f2eee2', '#2c61a8'], ['#2c61a8', '#efe9d6', '#e0b52c'], ['#c8342c', '#f4f0e6', '#2c61a8'],
  ['#2f6f87', '#f0ead8', '#c8342c'], ['#1f3f7a', '#eadfc6', '#d6402e'], ['#a8442c', '#f2eee2', '#e0b52c'],
];
const TOWER_Q = [-3070, -10109.5];
function buildHarbour() {
  defMats(); begin(0);
  const rn = RNG(951);
  // the tower: Torre della Tonnara, at the corner of the harbour front where the quay road starts (Wikidata Q113555961, 38.207179 13.326199; five photos of one Mapillary sequence looking at it from 30 to 90 m put it within about 3 m of that point; OSM maps it as the round notch in the w73411051 outline, not as w73411068, which is a 7 m square building 90 m away)
  const tx = TOWER_Q[0], tz = TOWER_Q[1], ty = groundY(tx, tz) - 0.3;
  cyl('mdlStone', 4.25, 4.9, 12.5, 16, { p: [tx, ty, tz] });
  cyl('mdlStone', 4.65, 4.65, 1.05, 16, { p: [tx, ty + 12.85, tz], noao: true });                  // the parapet on its corbels
  for (let i = 0; i < 28; i++) { const a = i / 28 * 2 * PI; box('mdlStone', 0.42, 0.55, 0.62, { p: [tx + Math.cos(a) * 4.4, ty + 12.35, tz + Math.sin(a) * 4.4], ry: -a + PI / 2, noao: true }); }
  for (let i = 0; i < 20; i++) { const a = i / 20 * 2 * PI; box('mdlStone', 0.8, 0.45, 0.42, { p: [tx + Math.cos(a) * 4.42, ty + 13.9, tz + Math.sin(a) * 4.42], ry: -a + PI / 2, noao: true }); }
  box('dark', 0.55, 0.75, 0.3, { p: [tx, ty + 7.4, tz + 4.4], noao: true }); cyl('dark', 0.275, 0.275, 0.3, 8, { M: mul(tr(tx, ty + 8.15, tz + 4.25), new THREE.Matrix4().makeRotationX(PI / 2)), noao: true });   // the arched window towards the harbour
  box('dark', 1.1, 2.0, 0.5, { p: [tx - 4.5, ty + 0.4, tz + 0.5], ry: 0.2, noao: true });          // door
  // hauled-out boats on the slipway beside the tower, bows to the sea (east), in two ragged rows
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
    const x = -3090 + r * 7 + (rn() - 0.5) * 1.5, z = -10050 + 6 - i * 4.6 + r * -1.8, y = groundY(x, z);
    if (y < 0.3) continue;
    gozzo(x, y + 0.2, z, PI / 2 + (rn() - 0.5) * 0.5, 5.4 + rn() * 1.6, HULLS[(rn() * HULLS.length) | 0], { cabin: false });
  }
  // moored along the quay (from (-3052,-10084) to (-2933,-10147)), stern to the wall
  const Dx = 0.884, Dz = -0.468, Nx = 0.468, Nz = 0.884;
  for (let s = 6; s < 128; s += 3.4 + rn() * 1.4) {
    const rows = rn() < 0.5 ? 1 : 2;
    for (let q = 0; q < rows; q++) {
      const off = 3.8 + q * 6.2 + (rn() - 0.5) * 0.8, x = -3052 + Dx * s + Nx * off, z = -10084 + Dz * s + Nz * off;
      gozzo(x, -0.1, z, Math.atan2(Nx, Nz) + (rn() - 0.5) * 0.5, 5 + rn() * 2, HULLS[(rn() * HULLS.length) | 0], { cabin: rn() < 0.18 });
    }
  }
  // a few at anchor in the bay and by the mole
  for (let i = 0; i < 9; i++) gozzo(-2985 + rn() * 70, -0.1, -10060 + rn() * 55, rn() * 2 * PI, 5 + rn() * 2.5, HULLS[(rn() * HULLS.length) | 0], { cabin: rn() < 0.3 });
  // the quay front: blue lamp posts and terracotta pots with oleander, as in the piazza photos
  for (let q = 4, k = 0; q < 132; q += 9, k++) {
    const x = -3052 + Dx * q - Nx * 2.2, z = -10084 + Dz * q - Nz * 2.2, y = groundY(x, z);
    if (k % 2 === 0) lampPost(x, y, z, Math.atan2(-Nx, -Nz));
    else { cyl('mnTerra', 0.5, 0.36, 0.7, 8, { p: [x, y, z], noao: true }); sphere('flat', 0.7, { p: [x, y + 1.1, z], c: '#4f7d3a', seg: 6, noao: true }); sphere('flat', 0.22, { p: [x + 0.3, y + 1.55, z + 0.2], c: '#e07a96', seg: 4, noao: true }); }
  }
  // the pontile: a plain concrete jetty with a railing, out from the quay
  const px0 = -3004, pz0 = -10122, dx = 0.44, dz = 0.9, pl = 42, M = mul(tr(px0, 0, pz0), new THREE.Matrix4().makeRotationY(Math.atan2(dx, dz)));
  bx('marble', M, -1.8, 1.8, 0.2, 0.9, 0, pl, { c: '#bdb8a8', noao: true });
  for (let z = 2; z < pl; z += 6) for (const sg of [-1, 1]) cyl('mdlStone', 0.22, 0.26, 3.2, 5, { M, p: [sg * 1.6, -2.6, z], noao: true });
  return end('Mondello harbour');
}
export const MN_HARBOUR = { name: 'Mondello harbour and tower', x: -3010, z: -10090, radius: 130, skipIds: [], build: buildHarbour };


// ====================================================================================================
// Board item c5. The harbour front behind the quay (OSM w73411051: a ring of attached houses, 138 x 121 m across), Hotel La Torre on the Capo Mondello promontory (w73395786) with its stone
// watchtower (w285428887). References, proportions only, nothing stored (Wikimedia Commons: "Mondello BW 2012-10-09 13-59-24" (CC BY-SA 3.0) for the harbour front, "Hotel la torre - panoramio"
// (CC BY-SA 3.0) for the hotel and the tower). Real: the harbour front is a row of three- and four-storey houses, each its own colour (cream, pink, yellow, white, ochre), arched shop fronts on
// the quay, tall shuttered windows with small balconies, flat roofs with little rooftop rooms; the hotel is a long white block of four storeys with continuous blue balcony fronts, the
// tower a round grey rubble watchtower with a broken crown on the rock at the end of the promontory.
// ====================================================================================================
const QUAY_RING = [-3080.9, -10160.0, -3051.4, -10131.2, -3051.6, -10126.7, -3064.2, -10112.5, -3069.1, -10115.4, -3072.7, -10111.9, -3070.1, -10108.3, -3070.8, -10105.4, -3073.5, -10103.8, -3076.5, -10104.1, -3083.2, -10097.5, -3101.0, -10080.8, -3111.7, -10070.4, -3115.8, -10074.7, -3121.2, -10072.0, -3118.6, -10067.5, -3171.3, -10044.3, -3184.9, -10038.9, -3189.3, -10046.7, -3172.0, -10064.3, -3159.5, -10079.0, -3154.5, -10081.3, -3152.7, -10081.3, -3149.1, -10074.4, -3152.4, -10072.4, -3152.8, -10070.0, -3155.0, -10068.6, -3153.3, -10065.9, -3139.0, -10075.7, -3137.1, -10073.8, -3134.5, -10076.0, -3130.8, -10074.3, -3130.3, -10076.0, -3131.1, -10077.7, -3130.3, -10080.1, -3134.4, -10086.2, -3138.2, -10083.8, -3138.5, -10081.9, -3140.0, -10079.4, -3142.2, -10079.3, -3145.4, -10077.0, -3152.8, -10084.8, -3148.9, -10087.3, -3145.7, -10084.2, -3142.8, -10087.5, -3146.2, -10090.8, -3141.3, -10094.4, -3142.7, -10097.7, -3129.0, -10111.2, -3110.2, -10129.3, -3111.5, -10133.2, -3109.8, -10135.0, -3106.5, -10133.5, -3102.6, -10139.6, -3095.3, -10150.7, -3086.8, -10159.4];
const HOTEL_RING = [-2737.2, -10566.5, -2731.7, -10564.6, -2733.6, -10559.7, -2729.7, -10557.8, -2744.0, -10523.2, -2746.9, -10516.4, -2749.0, -10517.6, -2749.5, -10513.2, -2753.7, -10513.3, -2754.2, -10510.9, -2757.1, -10510.4, -2757.6, -10507.1, -2761.3, -10506.8, -2761.9, -10503.9, -2764.6, -10503.7, -2765.0, -10501.1, -2767.7, -10500.8, -2759.8, -10487.0, -2753.4, -10476.4, -2772.2, -10463.7, -2769.6, -10459.7, -2776.5, -10454.5, -2779.4, -10459.1, -2778.6, -10464.3, -2781.2, -10464.7, -2781.7, -10463.1, -2787.7, -10464.5, -2787.4, -10466.4, -2788.2, -10466.5, -2788.7, -10465.2, -2805.9, -10469.1, -2809.6, -10470.0, -2807.5, -10479.0, -2808.9, -10479.3, -2805.8, -10491.8, -2804.0, -10491.2, -2801.2, -10504.1, -2785.0, -10500.9, -2782.5, -10503.2, -2780.8, -10511.4, -2778.5, -10512.6, -2776.5, -10523.1, -2792.0, -10526.3, -2791.2, -10530.0, -2788.4, -10543.9, -2768.7, -10539.9, -2774.3, -10512.7, -2772.0, -10509.7, -2761.3, -10518.3, -2756.9, -10523.0, -2753.4, -10531.7, -2759.9, -10534.5, -2746.3, -10566.3, -2739.7, -10563.6];
const TOWER_C = [-2736.9, -10640.7];
const inRing = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
function defMqMats() {
  defMats();
  defMat('mqWall', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#f2ead8'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2.5, 961, ['rgba(130,100,70,0.1)', 'rgba(255,255,255,0.12)']); });
  defMat('mqFacade', 192, 576, [3, 9.4], (g, w, h) => {   // one 3 m bay, 9.4 m high: shop arch, a shuttered balcony window, a smaller window under the cornice (near white: the vertex colour is the house's plaster)
    const sx = w / 3, sy = h / 9.4, X = (s) => s * sx, Y = (y) => h - y * sy;
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 962, ['rgba(120,90,60,0.08)', 'rgba(255,255,255,0.1)']);
    g.fillStyle = 'rgba(70,55,40,0.28)'; g.fillRect(0, Y(0.9), w, 0.9 * sy);                                                     // the plinth
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(X(0.45), Y(0.1)); g.lineTo(X(0.45), Y(2.3)); g.arc(X(1.5), Y(2.3), 1.05 * sx, PI, 0); g.lineTo(X(2.55), Y(0.1)); g.fill();   // the arch of the shop front
    g.fillStyle = '#26333d'; g.beginPath(); g.moveTo(X(0.62), Y(0.1)); g.lineTo(X(0.62), Y(2.3)); g.arc(X(1.5), Y(2.3), 0.88 * sx, PI, 0); g.lineTo(X(2.38), Y(0.1)); g.fill();
    g.fillStyle = 'rgba(200,215,225,0.25)'; g.fillRect(X(0.62), Y(2.8), 1.76 * sx, 1.4 * sy);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, Y(3.55), w, 0.22 * sy);                                                    // the string course
    g.fillStyle = '#ffffff'; g.fillRect(X(0.78), Y(6.55), 1.44 * sx, 2.5 * sy); g.fillStyle = '#4d6b4a'; g.fillRect(X(0.9), Y(6.4), 0.57 * sx, 2.2 * sy); g.fillRect(X(1.53), Y(6.4), 0.57 * sx, 2.2 * sy);   // the shuttered window with its frame
    g.fillStyle = 'rgba(20,20,20,0.25)'; for (let y = 4.2; y < 6.4; y += 0.16) { g.fillRect(X(0.9), Y(y + 3.9 - 0.0) + 0, 0.57 * sx, 1); g.fillRect(X(1.53), Y(y + 3.9), 0.57 * sx, 1); }
    g.fillStyle = '#2a2a2e'; g.fillRect(X(0.6), Y(4.75), 1.8 * sx, 0.1 * sy); for (let k = 0; k <= 9; k++) g.fillRect(X(0.6 + k * 0.2), Y(4.75), 1.5, 0.75 * sy);   // the balcony rail
    g.fillStyle = '#ffffff'; g.fillRect(X(0.92), Y(8.85), 1.16 * sx, 1.55 * sy); g.fillStyle = '#34414d'; g.fillRect(X(1.0), Y(8.75), 1.0 * sx, 1.35 * sy);   // the attic window
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, Y(9.4), w, 0.4 * sy); g.fillStyle = 'rgba(60,40,20,0.35)'; g.fillRect(0, Y(9.0), w, 0.08 * sy);
    streaks(g, w, h, 6, 963, 0.14, 120);
  });
  defMat('hoWall', 192, 416, [6, 13], (g, w, h) => {   // the hotel: white plaster, a glazed ground floor and three floors of blue balcony fronts
    const sx = w / 6, sy = h / 13, X = (s) => s * sx, Y = (y) => h - y * sy;
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 300, 2, 971, ['rgba(120,110,90,0.08)', 'rgba(255,255,255,0.12)']);
    g.fillStyle = '#2b3b4a'; g.fillRect(X(0.4), Y(3.0), 5.2 * sx, 2.6 * sy); g.fillStyle = 'rgba(200,225,240,0.25)'; g.fillRect(X(0.4), Y(3.0), 5.2 * sx, 1.0 * sy);  // the glazed ground floor
    g.fillStyle = '#e9e5da'; g.fillRect(0, Y(3.35), w, 0.3 * sy);
    for (let f = 0; f < 3; f++) {
      const y0 = 3.7 + f * 3.0;
      g.fillStyle = '#ffffff'; g.fillRect(0, Y(y0 + 0.12), w, 0.22 * sy);                                                            // the slab edge
      g.fillStyle = '#2f73c4'; g.fillRect(X(0.0), Y(y0 + 1.15), w, 1.0 * sy); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 12; k++) g.fillRect(X(k * 0.5 + 0.22), Y(y0 + 1.15), 1.5, 1.0 * sy);   // the blue balustrade
      g.fillStyle = '#25323d'; g.fillRect(X(0.45), Y(y0 + 2.75), 1.7 * sx, 1.6 * sy); g.fillRect(X(3.45), Y(y0 + 2.75), 1.7 * sx, 1.6 * sy);   // sliding doors
      g.fillStyle = 'rgba(190,210,225,0.3)'; g.fillRect(X(0.45), Y(y0 + 2.75), 0.85 * sx, 1.6 * sy); g.fillRect(X(3.45), Y(y0 + 2.75), 0.85 * sx, 1.6 * sy);
    }
    g.fillStyle = '#e4e0d4'; g.fillRect(0, Y(13.0), w, 0.5 * sy);
    streaks(g, w, h, 8, 972, 0.12, 120);
  });
}
const PLASTER = ['#f4efe4', '#f1e2bd', '#f6f2e6', '#f8f5ee', '#e9cf9c', '#efd2bd', '#f3e6c4', '#f5eee0'];   // the harbour front photos (Mapillary 2019, Commons): mostly white and cream, a pale yellow, one ochre, one pale pink, no orange
function buildQuayRow() {
  defMqMats();
  const pts = pairsOf(QUAY_RING), gr = groundRange(pts), gy = gr.hi + 0.1, H = 9.4, rn = RNG(981);
  begin(gy);
  shell('mqWall', pts, [], gy, H, { lo: gr.lo - 1.5, roof: '#9b948a', cc: '#efe5cc' });
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
    if (L < 3.2) continue;
    let nx = dz / L, nz = -dx / L; const mx0 = (A[0] + B[0]) / 2, mz0 = (A[1] + B[1]) / 2;
    if (inRing(pts, mx0 + nx * 0.5, mz0 + nz * 0.5)) { nx = -nx; nz = -nz; }            // outward: the side that is not inside the ring
    const n = Math.max(1, Math.round(L / 9.2));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, len = L / n, cx = A[0] + dx * (t0 + t1) / 2, cz = A[1] + dz * (t0 + t1) / 2;
      const col = PLASTER[Math.floor(rn() * PLASTER.length)];
      const atTower = Math.hypot(cx - TOWER_Q[0], cz - TOWER_Q[1]) < 7.5;   // the tower stands here: no house front, no rooftop room (rn() is still drawn so the other houses keep their colours)
      if (!atTower) panel('mqFacade', len, H, { M: frame(cx + nx * 0.03, gy, cz + nz * 0.03, nx, nz), uvk: [len / 3, 1], c: col, noao: false });
      if (!atTower && nx * 0.63 + nz * 0.78 > 0.55 && Math.hypot(cx - TOWER_Q[0], cz - TOWER_Q[1]) < 95) {   // the street side of the row near the tower: cafe terraces on the pavement, a white umbrella and a pot of oleander in front of each house (Mapillary 2019: umbrellas, planters and tables in front of every shop along the road)
        const ux = cx + nx * 3.4, uz = cz + nz * 3.4, uy = groundY(ux, uz) + 0.02, px = cx + nx * 1.5 + (dx / L) * 2.6, pz = cz + nz * 1.5 + (dz / L) * 2.6;
        cyl('flat', 0.03, 0.04, 2.5, 4, { p: [ux, uy, uz], c: '#7b7468', noao: true }); cyl('flat', 0.05, 1.6, 0.5, 8, { p: [ux, uy + 2.3, uz], c: '#f3f0e6', noao: true }); cyl('flat', 0.5, 0.5, 0.05, 6, { p: [ux, uy + 0.75, uz + 0.9], c: '#e9e4d6', noao: true });
        cyl('mnTerra', 0.4, 0.3, 0.6, 6, { p: [px, groundY(px, pz) + 0.02, pz], noao: true }); sphere('flat', 0.55, { p: [px, groundY(px, pz) + 0.95, pz], c: '#4f7d3a', seg: 5, noao: true });
      }
      if (rn() < 0.4 && !atTower) {   // a rooftop room, set back from the front, and a water tank
        const rx = cx - nx * 2.3, rz = cz - nz * 2.3, M2 = frame(rx, gy + H + 0.15, rz, nx, nz);
        if (inRing(pts, rx, rz)) { bx('mqWall', M2, -1.6, 1.6, 0, 2.7, -1.4, 1.4, { c: col }); bx('flat', M2, -1.8, 1.8, 2.7, 2.9, -1.6, 1.6, { c: '#d8d2c4', noao: true }); }
      }
    }
  }
  return end('Mondello harbour front');
}
export const MN_QUAY = { name: 'Mondello harbour front', x: -3120, z: -10100, radius: 90, skipIds: ['w73411051'], build: buildQuayRow };

function buildHotelLaTorre() {
  defMqMats();
  const pts = pairsOf(HOTEL_RING), gr = groundRange(pts), gy = gr.lo + (gr.hi - gr.lo) * 0.6 + 0.2, H = 13.0;   // the terrace the hotel stands on: nearer the high side than the low one, the rest is a rock footing
  begin(gy);
  prism('mdlStone', pts, gr.lo - 2, gy, { c: '#cbb995' });
  shell('hoWall', pts, [], gy, H, { roof: '#cfcbc2', cc: '#f1eee6' });
  // rooftop: a plant room, a terrace rail
  const c = centroid(pts);
  bx('mqWall', frame(c[0] - 6, gy + H + 0.15, c[1] + 4, 0, 1), -3.5, 3.5, 0, 2.6, -2.2, 2.2, { c: '#f4f2ec' });
  // the watchtower on the rock at the end of the promontory: round grey rubble, a broken crown (some merlons gone), a door high up, two slits, corbels
  const tx = TOWER_C[0], tz = TOWER_C[1], tg = groundRange([[tx - 4, tz], [tx + 4, tz], [tx, tz - 4], [tx, tz + 4]]), ty = tg.hi;
  cyl('mdlStone', 4.2, 4.9, 9.8 + (ty - tg.lo) + 1.5, 16, { p: [tx, tg.lo - 1.5, tz] });
  cyl('mdlStone', 4.7, 4.3, 0.8, 16, { p: [tx, ty + 9.4, tz], noao: true });                                    // the corbelled crown
  for (let k = 0; k < 14; k++) { if ([2, 3, 9].includes(k)) continue; const a = k * 2 * PI / 14; box('mdlStone', 0.9, 1.2, 0.55, { p: [tx + Math.cos(a) * 4.35, ty + 10.2, tz + Math.sin(a) * 4.35], ry: -a + PI / 2, noao: true }); }
  box('dark', 1.0, 1.8, 0.3, { p: [tx + 4.2, ty + 3.4, tz], ry: PI / 2, noao: true });                           // the door, a storey up
  for (const a of [1.9, 4.4]) box('dark', 0.3, 1.0, 0.3, { p: [tx + Math.cos(a) * 4.45, ty + 6.4, tz + Math.sin(a) * 4.45], ry: -a + PI / 2, noao: true });
  return end('Hotel La Torre');
}
export const MN_HOTEL = { name: 'Hotel La Torre', x: -2770, z: -10560, radius: 100, skipIds: ['w73395786', 'w285428887'], build: buildHotelLaTorre };

// ====================================================================================================
// The Liberty palazzo on the corner of Piazza Mondello and the harbour (the front part of OSM w73395733): cream, a ground storey with the chemist's, two floors of tall brown shutters with iron
// balconies, a parapet with little pinnacles and, at the east end of the harbour front, a square turret with arched windows. The rest of the block keeps the harbour houses' plain fronts.
// Photos: Wikimedia Commons "Mondello BW 2012-10-09 13-59-24" (the harbour front of the palazzo), Mapillary 2019 4101274106595956 (the corner and the side towards the road).
// Not verified: the back, the other houses of the block (plain), the exact heights.
// ====================================================================================================
const PAL_RING = [-3009.1, -10174.6, -3005.4, -10168.8, -3006.1, -10166.7, -3001.5, -10159.7, -2992.8, -10165.3, -2990.3, -10165.5, -2984.4, -10170.0, -2988.5, -10177.1, -2985.5, -10179.6, -2974.3, -10186.3, -2980.9, -10197.8, -2984.6, -10195.4, -2987.6, -10198.4, -2992.8, -10196.3, -2993.9, -10197.2, -2996.0, -10196.2, -2994.3, -10192.4, -2996.2, -10190.9, -2998.3, -10191.3, -3004.2, -10189.4, -3009.4, -10183.3, -3006.3, -10180.3, -2999.1, -10184.5, -2998.1, -10182.6];
// the two fronts, each from its left end to its right end as seen from outside: the side towards the road, then the one towards the harbour
const PAL_W = [[-3006.1, -10166.7], [-3001.5, -10159.7]], PAL_S = [[-3001.5, -10159.7], [-2988.0, -10167.1]];
const palFace = ([A, B], out) => { const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; return { l, nx, nz, A: [A[0] + nx * out, A[1] + nz * out], B: [B[0] + nx * out, B[1] + nz * out] }; };
function buildPalazzo() {
  defMqMats();
  defMat('mqPink', 128, 392, [4, 12.2], (g, w, h) => {   // one bay: the ground floor door with its iron, two floors of shutters in cream stone frames
    const sx = w / 4, sy = h / 12.2, X = (s) => s * sx, Y = (y) => h - y * sy, R = (x0, x1, y0, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), X(x1 - x0), (y1 - y0) * sy); };
    R(0, 4, 0, 12.2, '#eacfa6'); noiseDots(g, w, h, 500, 2, 987, ['rgba(150,110,70,0.1)', 'rgba(255,242,215,0.16)']);
    for (let y = 0.5; y < 4.0; y += 0.45) R(0, 4, y, y + 0.05, 'rgba(120,88,55,0.35)');
    g.fillStyle = '#f4e3c2'; g.beginPath(); g.moveTo(X(1.0), Y(0.1)); g.lineTo(X(1.0), Y(2.5)); g.arc(X(2), Y(2.5), X(1.0), PI, 0); g.lineTo(X(3.0), Y(0.1)); g.fill(); g.fillStyle = '#2c2825'; g.beginPath(); g.moveTo(X(1.18), Y(0.1)); g.lineTo(X(1.18), Y(2.5)); g.arc(X(2), Y(2.5), X(0.82), PI, 0); g.lineTo(X(2.82), Y(0.1)); g.fill();
    g.fillStyle = 'rgba(200,190,150,0.55)'; for (let x = 1.35; x < 2.8; x += 0.28) g.fillRect(X(x), Y(2.5), 1, 2.4 * sy);
    R(0, 4, 4.05, 4.35, '#f6e8ca');
    for (const y of [4.45, 8.35]) { R(1.1, 2.9, y, y + 3.0, '#f6e8ca'); R(1.28, 2.72, y, y + 2.82, '#4a3226'); R(1.97, 2.03, y, y + 2.82, '#251710'); g.fillStyle = 'rgba(20,10,5,0.4)'; for (let k = y + 0.2; k < y + 2.7; k += 0.2) g.fillRect(X(1.28), Y(k), X(1.44), 1); R(1.2, 2.8, y + 3.12, y + 3.5, '#dfc096'); }
    R(0, 4, 11.75, 12.2, '#f6e8ca'); R(0, 4, 11.6, 11.75, 'rgba(90,60,35,0.4)');
    streaks(g, w, h, 6, 988, 0.1, 90);
  });
  defMat('mqSign', 128, 24, [5, 0.9], (g, w, h) => { g.fillStyle = '#eacfa6'; g.fillRect(0, 0, w, h); g.fillStyle = '#f7f2e4'; g.font = '700 17px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#6a5438'; g.lineWidth = 3; g.strokeText('FARMACIA', w / 2, h / 2 + 1); g.fillText('FARMACIA', w / 2, h / 2 + 1); });
  const pts = pairsOf(PAL_RING), gr = groundRange(pts), gy = gr.lo + 0.1, H = 10.4, CREAM = '#f2dfba', IRON = '#2a2a2e';
  begin(gy);
  shell('mqWall', pts, [], gy, H, { lo: gr.lo - 1.5, roof: '#9b948a', cc: '#e9d9b4' });
  const W = palFace(PAL_W, 0.14), S = palFace(PAL_S, 0.42);
  {   // the two fronts meet where their lines cross
    const ax = W.B[0] - W.A[0], az = W.B[1] - W.A[1], bx0 = S.B[0] - S.A[0], bz0 = S.B[1] - S.A[1], t = ((S.A[0] - W.A[0]) * bz0 - (S.A[1] - W.A[1]) * bx0) / (ax * bz0 - az * bx0), c = [W.A[0] + ax * t, W.A[1] + az * t];
    W.B = c; S.A = c; for (const F of [W, S]) F.l = Math.hypot(F.B[0] - F.A[0], F.B[1] - F.A[1]);
  }
  const near = (F, x, z) => { const dx = F.B[0] - F.A[0], dz = F.B[1] - F.A[1], u = Math.max(0, Math.min(1, ((x - F.A[0]) * dx + (z - F.A[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - F.A[0] - dx * u, z - F.A[1] - dz * u) < 1.6; };
  for (let i = 0; i < pts.length; i++) {   // the other houses of the block
    const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
    if (L < 3.2 || near(W, mx, mz) || near(S, mx, mz)) continue;
    let nx = dz / L, nz = -dx / L; if (inRing(pts, mx + nx * 0.5, mz + nz * 0.5)) { nx = -nx; nz = -nz; }
    panel('mqFacade', L, H, { M: frame(mx + nx * 0.03, gy, mz + nz * 0.03, nx, nz), uvk: [Math.max(1, Math.round(L / 3)), 1], c: '#e9cf9c', noao: false });
  }
  // the palazzo's own mass and fronts
  const back = [S.B[0] - S.nx * 8.4, S.B[1] - S.nz * 8.4], back2 = [W.A[0] - W.nx * 5.5, W.A[1] - W.nz * 5.5];
  prism('flat', [[W.A[0] - W.nx * 0.2, W.A[1] - W.nz * 0.2], [S.A[0] - S.nx * 0.2, S.A[1] - S.nz * 0.2], [S.B[0] - S.nx * 0.2, S.B[1] - S.nz * 0.2], back, back2], gy + H, gy + 12.2, { c: '#e6cca0' });
  for (const F of [W, S]) {
    const M = frame((F.A[0] + F.B[0]) / 2, gy, (F.A[1] + F.B[1]) / 2, F.nx, F.nz), l = F.l, n = Math.max(1, Math.round(l / 3.9));
    bx('flat', M, -l / 2, l / 2, gr.lo - gy - 1.0, 12.2, -0.5, -0.02, { c: '#e6cca0' });
    panel('mqPink', l, 12.2, { M, uvk: [n, 1] });
    for (const x of [-l / 2 + 0.2, l / 2 - 0.2]) bx('flat', M, x - 0.22, x + 0.22, 0, 12.2, 0, 0.1, { c: CREAM });
    bx('flat', M, -l / 2 - 0.15, l / 2 + 0.15, 12.2, 12.45, -0.4, 0.45, { c: CREAM }); bx('flat', M, -l / 2, l / 2, 12.45, 13.1, -0.2, 0.05, { c: '#e9d0a6' });
    for (let k = 0; k <= n * 2; k++) { const x = -l / 2 + 0.2 + k * (l - 0.4) / (n * 2); bx('flat', M, x - 0.15, x + 0.15, 13.1, 13.45, -0.22, 0.08, { c: CREAM }); sphere('flat', 0.17, { M, p: [x, 13.6, -0.07], c: CREAM, seg: 4 }); }
    // the balconies: one long one a floor on the side, one a bay at the ends of the harbour front and a long one between them
    const runs = F === W ? [[-l / 2 + 0.6, l / 2 - 0.6]] : [[-l / 2 + 0.6, -l / 2 + l / n - 0.4], [-l / 2 + l / n + 0.4, l / 2 - l / n - 0.4], [l / 2 - l / n + 0.4, l / 2 - 0.6]];
    for (const y of [4.3, 8.2]) for (const [x0, x1] of runs) {
      bx('flat', M, x0, x1, y, y + 0.18, 0, 0.75, { c: CREAM }); rail(mul(M, tr((x0 + x1) / 2, y + 0.18, 0.72)), x1 - x0, 0.95, { c: IRON });
      for (const x of [x0 + 0.25, x1 - 0.25]) bx('flat', M, x - 0.12, x + 0.12, y - 0.4, y, 0, 0.45, { c: '#dfc49a' });
    }
    if (F === W) panel('mqSign', 5.0, 0.9, { M: mul(M, tr(0, 3.2, 0.06)) });
  }
  // the turret at the east end of the harbour front
  const T = frame(S.B[0] - (S.B[0] - S.A[0]) / S.l * 2.1 - S.nx * 1.9, gy, S.B[1] - (S.B[1] - S.A[1]) / S.l * 2.1 - S.nz * 1.9, S.nx, S.nz);
  bx('flat', T, -1.75, 1.75, 12.2, 16.2, -1.75, 1.75, { c: '#ecd3a8' });
  const arch = (hw, y1) => { const q = new THREE.Shape(); q.moveTo(-hw, 0); q.lineTo(hw, 0); q.lineTo(hw, y1 - hw); q.absarc(0, y1 - hw, hw, 0, PI, false); q.closePath(); return q; };
  for (let k = 0; k < 4; k++) { const Mt = mul(T, mul(rotY(k * PI / 2), tr(0, 13.4, 1.72))); extrude('flat', arch(0.75, 2.2), 0.07, { M: Mt, c: CREAM, cs: 5 }); extrude('flat', arch(0.52, 1.95), 0.11, { M: Mt, c: '#43301f', cs: 5 }); }
  bx('flat', T, -2.0, 2.0, 16.2, 16.5, -2.0, 2.0, { c: CREAM });
  for (const a of [-1, 1]) for (const b of [-1, 1]) { bx('flat', T, a * 1.75 - 0.22, a * 1.75 + 0.22, 16.5, 17.1, b * 1.75 - 0.22, b * 1.75 + 0.22, { c: CREAM }); sphere('flat', 0.2, { M: T, p: [a * 1.75, 17.28, b * 1.75], c: CREAM, seg: 4 }); }
  for (let k = 0; k < 4; k++) rail(mul(T, mul(rotY(k * PI / 2), tr(0, 16.5, 1.75))), 3.1, 0.7, { c: IRON });
  return end('Palazzo on Piazza Mondello');
}
const PAL_WALLS = (() => { const F = palFace(PAL_S, 0.42); return [[...F.A, ...F.B].map(v => Math.round(v * 10) / 10)]; })();
export const MN_PALAZZO = { name: 'Palazzo on Piazza Mondello', x: -2995, z: -10178, radius: 30, skipIds: ['w73395733'], walls: PAL_WALLS, build: buildPalazzo };

export const MONDELLO_LANDMARKS = [...MN_CABINS, ...MN_LAMPS, MN_HARBOUR, MN_QUAY, MN_HOTEL, MN_PALAZZO];
