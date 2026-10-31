// City landmarks, Mondello: the lido cabins on the sand, the blue seafront lamp posts, the Torre di Mondello (the old tonnara tower),
// and the little fishing harbour (moored and beached gozzi, the pontile). Registered in src/landmarks-city.js.
// Every shape here was checked against photos (Wikimedia Commons Category:Mondello and its harbour, tower and Alle Terrazze categories) and satellite views:
//  - cabins: narrow wooden huts, vertically striped in one colour and white (red, blue, pink, green, yellow), louvred door in the middle, shallow roof,
//    standing in back-to-back rows that run from the promenade towards the water, a few metres apart, with the umbrellas in the aisles
//  - lamp posts: slender cobalt-blue steel posts with a double arm, all along the seafront and the piazza
//  - tower: round, sandy-tan rubble tower about 14 m tall with a crown of merlons, a single slit window high up
//  - boats: wooden gozzi, white hulls with a red line, blue or yellow strakes, hauled out on the slipway or moored along the quay
import * as THREE from 'three';
import { PI, defMat, begin, end, box, bx, cyl, sphere, prism, mul, tr, frame, groundY, initShared, RNG, noiseDots } from './lmc-kit.js';

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

export const MONDELLO_LANDMARKS = [...MN_CABINS, ...MN_LAMPS, MN_HARBOUR];
