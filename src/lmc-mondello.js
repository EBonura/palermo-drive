// City landmarks, Mondello: the lido cabins on the sand, the blue seafront lamp posts, the Torre di Mondello (the old tonnara tower),
// and the little fishing harbour (moored and beached gozzi, the pontile). Registered in src/landmarks-city.js.
// Every shape here was checked against photos (Wikimedia Commons Category:Mondello and its harbour, tower and Alle Terrazze categories) and satellite views:
//  - cabins: narrow wooden huts, vertically striped in one colour and white (red, blue, pink, green, yellow), louvred door in the middle, shallow roof,
//    standing in back-to-back rows that run from the promenade towards the water, a few metres apart, with the umbrellas in the aisles
//  - lamp posts: slender cobalt-blue steel posts with a double arm, all along the seafront and the piazza
//  - tower: round, sandy-tan rubble tower about 14 m tall with a crown of merlons, a single slit window high up
//  - boats: wooden gozzi, white hulls with a red line, blue or yellow strakes, hauled out on the slipway or moored along the quay
import * as THREE from 'three';
import { PI, defMat, begin, end, box, bx, cyl, sphere, prism, panel, shell, mul, tr, frame, groundY, groundRange, pairsOf, centroid, initShared, RNG, noiseDots, streaks } from './lmc-kit.js';

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

const PAL = { red: '#c4352d', blue: '#2f66b2', pink: '#e27c97', green: '#3d8d5c', yellow: '#e6b93a', teal: '#2f9fa6' };
function defMats() {
  initShared();
  for (const k in PAL) {
    defMat('mnCab_' + k, 64, 96, [1, 1], (g, w, h) => {
      g.fillStyle = '#f2ecdd'; g.fillRect(0, 0, w, h);
      g.fillStyle = PAL[k]; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 8, h);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, w, 6);                                   // fascia shadow
      g.fillStyle = '#5a3a28'; g.fillRect(16, 22, 32, h - 22);                                    // the door
      g.fillStyle = 'rgba(255,235,200,0.35)'; for (let y = 28; y < h - 6; y += 6) g.fillRect(18, y, 28, 1.5);   // louvres
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 8, w, 8);                               // sand at the foot
    });
  }
  defMat('mnStone', 128, 128, [4, 4], (g, w, h) => {
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
const KEYS = Object.keys(PAL);
function cabinBlocks(za, zb, seed, gap) {
  const rn = RNG(seed);
  begin(0);
  for (let z = za; z <= zb; z += gap + Math.floor(rn() * 4)) {
    const f = shoreFrame(z), P = [landX(z) + 3.2 * f.nx, z + 3.2 * f.nz];
    if (Math.hypot(P[0] + 3043, P[1] + 9598) < 45) continue;                                        // the Stabilimento gate keeps its forecourt
    let tw = 0; while (tw < 70 && groundY(P[0] + f.nx * tw, P[1] + f.nz * tw) > 0.3) tw += 1;        // distance to the waterline
    const n = Math.min(13, Math.floor((tw - 9) / 1.3)); if (n < 3) continue;
    const kA = KEYS[(rn() * KEYS.length) | 0], kB = rn() < 0.55 ? kA : KEYS[(rn() * KEYS.length) | 0];
    for (let r = 0; r < 2; r++) {
      const key = 'mnCab_' + (r ? kB : kA), off = (r ? 1 : -1) * 0.72;
      for (let i = 0; i < n; i++) {
        const t = 1.2 + i * 1.3;
        const wx = P[0] + f.nx * t - f.nz * off, wz = P[1] + f.nz * t + f.nx * off, y = groundY(wx, wz);   // sideways = (-nz, nx) * off
        if (y < 0.3) continue;
        const M = frame(wx, y, wz, f.nx, f.nz);
        bx(key, M, -0.62, 0.62, -0.4, 2.2, -0.7, 0.7, { uv: 'keep', noao: true });
        bx('flat', M, -0.7, 0.7, 2.2, 2.36, -0.78, 0.78, { c: r ? '#d9d2c0' : '#c9c2b0', noao: true });
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
// blue lamp posts along the seafront
// ====================================================================================================
function lampPost(x, y, z, ang) {
  const c = '#2358a8', M = frame(x, y, z, Math.sin(ang), Math.cos(ang));
  cyl('flat', 0.07, 0.11, 5.4, 6, { M, c, noao: true });
  bx('flat', M, -0.9, 0.9, 5.35, 5.45, -0.05, 0.05, { c, noao: true });
  for (const sg of [-1, 1]) bx('flat', M, sg * 0.9 - 0.2, sg * 0.9 + 0.2, 5.12, 5.38, -0.17, 0.17, { c: '#e9e7de', noao: true });
}
function lampLandmark(name, za, zb, step) {
  const zc = (za + zb) / 2;
  return { name, x: landX(zc) - 4, z: zc, radius: Math.abs(zb - za) / 2 + 40, skipIds: [], build: () => {
    defMats(); begin(0);
    for (let z = za; z <= zb; z += step) {
      const f = shoreFrame(z), x = landX(z) - 1.6 * f.nx, zz = z - 1.6 * f.nz;
      lampPost(x, groundY(x, zz), zz, Math.atan2(f.nx, f.nz));
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
function buildHarbour() {
  defMats(); begin(0);
  const rn = RNG(951);
  // the tower: on the promenade at the north end of the beach
  const tx = -3126, tz = -10038, ty = groundY(tx, tz) - 0.3;
  cyl('mnStone', 4.3, 4.9, 13.2, 16, { p: [tx, ty, tz] });
  cyl('mnStone', 4.9, 4.4, 0.9, 16, { p: [tx, ty + 12.6, tz], noao: true });                       // corbelled crown
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; box('mnStone', 1.1, 0.8, 0.8, { p: [tx + Math.cos(a) * 4.7, ty + 13.5, tz + Math.sin(a) * 4.7], ry: -a + PI / 2, noao: true }); }
  box('dark', 0.45, 1.0, 0.45, { p: [tx + 4.2, ty + 8.5, tz], noao: true });                      // arrow slit
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
  for (let z = 2; z < pl; z += 6) for (const sg of [-1, 1]) cyl('mnStone', 0.22, 0.26, 3.2, 5, { M, p: [sg * 1.6, -2.6, z], noao: true });
  return end('Mondello harbour');
}
export const MN_HARBOUR = { name: 'Mondello harbour and tower', x: -3010, z: -10090, radius: 130, skipIds: ['w73411068'], build: buildHarbour };


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
const PLASTER = ['#f1dfb4', '#ecbfa8', '#f1d487', '#f6f2e6', '#dfae7d', '#e6b49a', '#f3e6c4', '#efc9a0'];
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
      panel('mqFacade', len, H, { M: frame(cx + nx * 0.03, gy, cz + nz * 0.03, nx, nz), uvk: [len / 3, 1], c: col, noao: false });
      if (rn() < 0.4) {   // a rooftop room, set back from the front, and a water tank
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
  prism('mnStone', pts, gr.lo - 2, gy, { c: '#cbb995' });
  shell('hoWall', pts, [], gy, H, { roof: '#cfcbc2', cc: '#f1eee6' });
  // rooftop: a plant room, a terrace rail
  const c = centroid(pts);
  bx('mqWall', frame(c[0] - 6, gy + H + 0.15, c[1] + 4, 0, 1), -3.5, 3.5, 0, 2.6, -2.2, 2.2, { c: '#f4f2ec' });
  // the watchtower on the rock at the end of the promontory: round grey rubble, a broken crown (some merlons gone), a door high up, two slits, corbels
  const tx = TOWER_C[0], tz = TOWER_C[1], tg = groundRange([[tx - 4, tz], [tx + 4, tz], [tx, tz - 4], [tx, tz + 4]]), ty = tg.hi;
  cyl('mnStone', 4.2, 4.9, 9.8 + (ty - tg.lo) + 1.5, 16, { p: [tx, tg.lo - 1.5, tz] });
  cyl('mnStone', 4.7, 4.3, 0.8, 16, { p: [tx, ty + 9.4, tz], noao: true });                                    // the corbelled crown
  for (let k = 0; k < 14; k++) { if ([2, 3, 9].includes(k)) continue; const a = k * 2 * PI / 14; box('mnStone', 0.9, 1.2, 0.55, { p: [tx + Math.cos(a) * 4.35, ty + 10.2, tz + Math.sin(a) * 4.35], ry: -a + PI / 2, noao: true }); }
  box('dark', 1.0, 1.8, 0.3, { p: [tx + 4.2, ty + 3.4, tz], ry: PI / 2, noao: true });                           // the door, a storey up
  for (const a of [1.9, 4.4]) box('dark', 0.3, 1.0, 0.3, { p: [tx + Math.cos(a) * 4.45, ty + 6.4, tz + Math.sin(a) * 4.45], ry: -a + PI / 2, noao: true });
  return end('Hotel La Torre');
}
export const MN_HOTEL = { name: 'Hotel La Torre', x: -2770, z: -10560, radius: 100, skipIds: ['w73395786', 'w285428887'], build: buildHotelLaTorre };

export const MONDELLO_LANDMARKS = [...MN_CABINS, ...MN_LAMPS, MN_HARBOUR, MN_QUAY, MN_HOTEL];
