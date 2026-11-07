// City landmarks of the towns around Palermo (docs/faithfulness/towns.md). Registered in src/landmarks-city.js, built with the full-detail tile that holds them.
// Villabate: the Chiesa Madre di Sant'Agata (mid 19th century, the parish church; the facade is not in any street photo, the church stands inside a block of houses, so the front
// is the usual neoclassical one of the Sicilian parish churches, on the end of the footprint that opens on a street), the slender concrete bell tower of the Chiesa di San Giuseppe
// (Mapillary, April 2021: a tall tapering slab with one bell opening and a cross, behind iron railings, palms and globe lamps) and the Palchetto della Musica of the public garden.
// Monreale: the Duomo (Santa Maria Nuova, 1174 to 1189). Seen in Mapillary photos from the north side (March 2019): the golden tufa wall with its three registers (an arcade at the foot,
// blind arches over it, tall pointed windows under the eaves), the square clock tower of the north-west corner with its crenellated top, the low tiled roof, the paving of large grey slabs
// of the square. NOT seen in any photo: the west front between the towers (the porch, its door, the gable), the south tower, the apse and the south side (the monastery stands there).
// Those are drawn from the type of a Norman basilica and the size Wikipedia gives (about 102 m by 40 m), and heights are estimated from the photos, not measured.
// Belmonte Mezzagno and Capaci: their Chiesa Madre, see the notes over each model below for what is drawn from a photo and what from the type.
// Footprints are the OSM buildings of the world tiles (14_8 and 15_8; -13_7 for Monreale; 4_14 for Belmonte Mezzagno, -22_-13 for Capaci). Everything is drawn in code; the photos were looked at only.
import * as THREE from 'three';
import { PI, begin, end, defMat, part, box, bx, cyl, cone, sphere, panel, prism, gable, extrude, pyramid, balus, rail, mul, tr, frame, pairsOf, obb, groundRange, groundY, initShared, paintFacade, paintAshlar, noiseDots, streaks } from './lmc-kit.js';

const SANTAGATA = { id: 'w35582356', p: [7041.8, 4272.7, 7026.2, 4308.3, 7037.9, 4313.8, 7053, 4277.7] };
const GIUSEPPE = { id: 'w48009589', p: [7651, 4293.1, 7645.2, 4303.7, 7645.1, 4310.8, 7651.7, 4323.7, 7656.8, 4337.8, 7660, 4337.2, 7666.5, 4349.3, 7683.6, 4336.3, 7673.8, 4327.2, 7677.5, 4322.4, 7681, 4322.4, 7683.8, 4310.6, 7683.3, 4302.8, 7680.6, 4302.8, 7678.6, 4296.1, 7675.1, 4290.1, 7672.1, 4291.7, 7662.5, 4283.7, 7654.9, 4295.2],
  x: 7664.5, z: 4287.5, ux: 0.55, uz: 0.83 };   // the foot of the tower: the north tip of the footprint w48009589, the face turned to the street on the south-east side (Mapillary vdb)
const PALCHETTO = { id: 'w870659720', p: [7215.2, 4255.1, 7211.2, 4265.1, 7221.4, 4269.2, 7225.4, 4259.2] };

const facadeMat = (key, bayW, H, spec, px = 40) =>
  defMat(key, Math.max(64, Math.round(bayW * px / 16) * 16), Math.max(128, Math.round(H * px / 16) * 16), [bayW, H], (g, w, h) => paintFacade(g, w, h, bayW, H, spec));
const centre = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

// ---------------------------------------------------------------------------------------------------
// Chiesa Madre di Sant'Agata: a nave 12.9 m wide and 39 m long under a tiled gable roof, the front on the south end with a pediment, pilasters, an arched portal, a round window,
// and a square belfry over it that ends in a lead dome and a cross.
// ---------------------------------------------------------------------------------------------------
function buildSantAgata() {
  initShared();
  const pts = pairsOf(SANTAGATA.p), ob = obb(pts), gr = groundRange(pts), gy = gr.hi + 0.1;
  // the long axis, pointing south (+z): the front is that end
  let nx = ob.ux, nz = ob.uz; if (nz < 0) { nx = -nx; nz = -nz; }
  const L = ob.w, W = ob.d, c = [ob.cx, ob.cz], H = 11.5;   // eave height; the OSM height of 22 m is the belfry
  begin(gy);
  facadeMat('saWall', 4.3, H, { base: '#e2d2a8', trim: '#f2e9d0', glass: '#2a2624', seed: 1301, plinth: { h: 0.9, c: '#bba98a' }, grime: 1,
    bands: [{ y: 10.6, h: 0.5, c: '#f0e6c8' }], rows: [{ y0: 4.4, y1: 8.4, xs: [2.15], w: 1.2, kind: 'arch', fr: 0.16, sill: false }] });
  facadeMat('saFront', W, 20, { base: '#e2d2a8', trim: '#f4ebd2', glass: '#2a2624', seed: 1302, plinth: { h: 1.1, c: '#bba98a' }, grime: 1,
    pil: { xs: [0.5, W - 0.5], w: 1.0, c: '#efe4c6' }, bands: [{ y: 7.4, h: 0.45, c: '#f0e6c8' }, { y: 10.9, h: 0.6, c: '#f0e6c8' }],
    rows: [{ y0: 1.1, y1: 5.8, xs: [W / 2], w: 2.4, kind: 'door', glass: '#3a2a1e' }, { y0: 3.2, y1: 6.2, xs: [2.4, W - 2.4], w: 1.1, kind: 'arch', fr: 0.14, sill: false },
      { y0: 8.2, y1: 10.2, xs: [W / 2], w: 2.0, kind: 'oculus', fr: 0.22 }] });
  facadeMat('saTower', 5.6, 12, { base: '#e6d8b0', trim: '#f4ebd2', glass: '#1c1814', seed: 1303, pil: { xs: [0.45, 5.15], w: 0.9, c: '#efe4c6' }, bands: [{ y: 0.2, h: 0.4, c: '#f0e6c8' }, { y: 11.4, h: 0.6, c: '#f0e6c8' }],
    rows: [{ y0: 4.2, y1: 9.6, xs: [2.8], w: 2.2, kind: 'arch', fr: 0.2, sill: false }], grime: 0 });
  defMat('saTile', 0, 0, [1, 1], null);
  // the walls: the prism takes the repeating bay texture, a plinth below it for the slope
  if (gr.lo < gy - 0.2) prism('stone', pts, gr.lo - 1.5, gy, { c: '#bba98a' });
  prism('saWall', pts, gy, gy + H, { uvo: [0, -gy / H] });
  prism('flat', pts, gy + H, gy + H + 0.15, { c: '#8f8a82' });
  // the gable roof, ridge along the nave; the footprint is the nave, so the gable ends are at the front and the back
  const M = frame(c[0], gy + H, c[1], nx, nz), rise = W * 0.2;
  gable('tile', 'saWall', M, W, L, 0, rise, { ov: 0.35, c: '#c98262', wc: '#e2d2a8' });
  // the front: a flat panel 0.1 m proud of the south wall, taller than the eave by a pediment, and the belfry above it
  const fx = c[0] + nx * (L / 2 + 0.06), fz = c[1] + nz * (L / 2 + 0.06), F = frame(fx, gy, fz, nx, nz);
  panel('saFront', W, 12.6, { M: F, uvk: [1, 12.6 / 20] });
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.3, 0); sh.lineTo(W / 2 + 0.3, 0); sh.lineTo(0, rise + 0.9); sh.lineTo(-W / 2 - 0.3, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }), { M: mul(F, tr(0, 12.1, -0.3)), c: '#efe4c6' });
  bx('flat', F, -W / 2 - 0.3, W / 2 + 0.3, 11.9, 12.2, -0.1, 0.45, { c: '#e6d9bc' });   // cornice under the pediment
  // steps and a small forecourt
  for (let i = 0; i < 3; i++) bx('stone', F, -2.6 + i * 0.15, 2.6 - i * 0.15, 0, 0.45 - i * 0.15, 0, 1.2 - i * 0.4, { c: '#cfc7b4' });
  // the belfry: a square tower over the front bay, on the nave behind the pediment, three storeys of bell chamber, a lead dome with a lantern and a cross
  const T = frame(fx - nx * 3.6, gy + H, fz - nz * 3.6, nx, nz), TW = 5.6;
  bx('stone', T, -TW / 2 - 0.1, TW / 2 + 0.1, -0.3, 0.9, -TW / 2 - 0.1, TW / 2 + 0.1, { c: '#d8c9a4' });
  for (const [a, b] of [[0, 0], [PI / 2, 0], [PI, 0], [-PI / 2, 0]]) {   // the four faces share one bay texture
    const Mf = mul(T, new THREE.Matrix4().makeRotationY(a)); panel('saTower', TW, 12, { M: mul(Mf, tr(0, 0, TW / 2 + 0.02)), uvk: [1, 1] });
  }
  box('flat', TW - 0.2, 12, TW - 0.2, { M: T, p: [0, 0, 0], c: '#e6d8b0', noao: true });
  bx('flat', T, -TW / 2 - 0.35, TW / 2 + 0.35, 11.8, 12.6, -TW / 2 - 0.35, TW / 2 + 0.35, { c: '#efe4c6' });   // the cornice of the belfry
  cyl('lead', 2.3, 2.5, 1.2, 8, { M: mul(T, tr(0, 12.6, 0)) });
  const dome = new THREE.SphereGeometry(2.3, 10, 6, 0, 2 * PI, 0, PI / 2); part('lead', dome, { M: mul(T, tr(0, 13.8, 0)), s: [1, 1.15, 1] });
  cyl('lead', 0.45, 0.6, 1.4, 6, { M: mul(T, tr(0, 16.4, 0)) });
  sphere('bronze', 0.35, { M: mul(T, tr(0, 18.0, 0)), seg: 6 });
  bx('bronze', T, -0.06, 0.06, 18.2, 20.0, -0.06, 0.06, { c: '#4a3f30', noao: true }); bx('bronze', T, -0.5, 0.5, 19.2, 19.35, -0.06, 0.06, { c: '#4a3f30', noao: true });
  return end('Chiesa Madre di Sant Agata, Villabate');
}
const cs = centre(pairsOf(SANTAGATA.p));
export const SANT_AGATA = { name: "Chiesa Madre di Sant'Agata (Villabate)", x: cs[0], z: cs[1], radius: 40, skipIds: [SANTAGATA.id], build: buildSantAgata };

// ---------------------------------------------------------------------------------------------------
// Chiesa di San Giuseppe: a modern church, a low hall of pale render (the OSM height of 23.5 m is the tower, not the nave) with the bell tower on its north tip. A tall slab of pale concrete that narrows towards the top, one bell opening with
// the bell in it, a cross of iron on the point, and a cantilevered ledge at the foot of the belfry (the shape in Mapillary vdb).
// ---------------------------------------------------------------------------------------------------
function buildGiuseppeTower() {
  initShared();
  defMat('sgConc', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + (i * 7) % 40},${80 + (i * 5) % 30},60,0.07)`; g.fillRect((i * 37) % w, (i * 53) % h, 2 + (i % 3), 2 + (i % 4)); } });
  const gy = groundY(GIUSEPPE.x, GIUSEPPE.z), M = frame(GIUSEPPE.x, gy, GIUSEPPE.z, GIUSEPPE.ux, GIUSEPPE.uz);
  begin(gy);
  const fp = pairsOf(GIUSEPPE.p), fy = groundRange(fp).hi + 0.1;
  if (groundRange(fp).lo < fy - 0.3) prism('stone', fp, groundRange(fp).lo - 1.5, fy, { c: '#c9bea4' });
  prism('sgConc', fp, fy, fy + 9.2, { c: '#f0e8d0' });
  prism('flat', fp, fy + 9.2, fy + 9.5, { c: '#8f8b82' });
  // a slab 3.4 m wide and 2.6 m deep at the foot, tapering to 1.4 by 1.0 at 26 m: stacked prisms of four steps
  const steps = [[3.4, 2.6, 0, 8], [3.0, 2.4, 8, 16], [2.5, 2.0, 16, 21], [1.9, 1.5, 21, 25], [1.2, 1.0, 25, 27.4]];
  for (const [w, d, y0, y1] of steps) bx('sgConc', M, -w / 2, w / 2, y0, y1, -d / 2, d / 2, { c: '#ece0c0' });
  bx('sgConc', M, -2.2, 2.2, 15.2, 15.7, -1.6, 1.6, { c: '#e2d6b6' });   // the ledge
  bx('dark', M, -0.65, 0.65, 17.2, 19.4, 0.95, 1.05, { c: '#2a221c', noao: true });   // the bell opening, on the face
  bx('bronze', M, -0.3, 0.3, 17.6, 18.9, 0.9, 1.0, { c: '#7a5a2a', noao: true });
  bx('bronze', M, -0.07, 0.07, 27.4, 30.2, -0.07, 0.07, { c: '#3a342e', noao: true }); bx('bronze', M, -0.6, 0.6, 29.0, 29.16, -0.07, 0.07, { c: '#3a342e', noao: true });
  return end('Chiesa di San Giuseppe, Villabate');
}
export const SAN_GIUSEPPE = { name: 'Chiesa di San Giuseppe (Villabate)', x: GIUSEPPE.x, z: GIUSEPPE.z, radius: 45, skipIds: [GIUSEPPE.id], build: buildGiuseppeTower };

// ---------------------------------------------------------------------------------------------------
// Palchetto della Musica: an octagonal bandstand on a low stone base, eight slim iron posts and a lead roof under a ball finial, in the garden of the corso.
// ---------------------------------------------------------------------------------------------------
function buildPalchetto() {
  initShared();
  const c = centre(pairsOf(PALCHETTO.p)), gy = groundRange(pairsOf(PALCHETTO.p)).hi + 0.05, R = 3.7;
  begin(gy);
  cyl('stone', R + 0.35, R + 0.55, 1.0, 8, { M: tr(c[0], gy, c[1]), c: '#cfc6b0' });
  cyl('flat', R + 0.15, R + 0.15, 0.12, 8, { M: tr(c[0], gy + 1.0, c[1]), c: '#e2dac4' });
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * 2 * PI, x = c[0] + Math.cos(a) * (R - 0.2), z = c[1] + Math.sin(a) * (R - 0.2);
    box('dark', 0.16, 3.6, 0.16, { p: [x, gy + 1.1, z], c: '#2e3a34', noao: true });
    if (i % 2 === 0) box('dark', 0.9, 0.9, 0.06, { p: [x - Math.cos(a) * 0.1, gy + 1.1, z - Math.sin(a) * 0.1], ry: -a + PI / 2, c: '#2e3a34', noao: true });   // balustrade panels between the posts
  }
  cyl('lead', R + 0.2, R + 0.2, 0.25, 8, { M: tr(c[0], gy + 4.7, c[1]) });
  cone('lead', R + 0.5, 1.9, 8, { M: tr(c[0], gy + 4.95, c[1]), c: '#8f9890' });
  sphere('bronze', 0.3, { M: tr(c[0], gy + 6.95, c[1]), seg: 6, c: '#6a6a5a' });
  return end('Palchetto della Musica, Villabate');
}
export const PALCHETTO_VB = { name: 'Palchetto della Musica (Villabate)', x: centre(pairsOf(PALCHETTO.p))[0], z: centre(pairsOf(PALCHETTO.p))[1], radius: 15, skipIds: [PALCHETTO.id], build: buildPalchetto };

// ---------------------------------------------------------------------------------------------------
// Duomo di Monreale. The OSM footprint w82665029 is the church alone, a rectangle of about 88 by 43 m whose long axis runs east-north-east (the west front looks over Piazza Guglielmo II
// to the west-south-west) and a rounded east end. Frame FF: origin at the middle of the west front on the ground, local +z towards the west (out of the front), local +x towards the
// south; the nave runs along -z.
// ---------------------------------------------------------------------------------------------------
const DUOMO = { id: 'w82665029', p: [-6090, 3716.4, -6082.7, 3738.1, -6076.5, 3757.6, -6023.7, 3739.4, -6022.9, 3741.5, -5993.5, 3731.5, -5998.5, 3715.6, -5995, 3714.1, -5995.9, 3712, -5992.8, 3709, -5992.7, 3705.6, -5994, 3702.3, -5996.4, 3701, -5999.4, 3700.9, -6001, 3701.2, -6002, 3699.2, -6006.4, 3701, -6010.5, 3690.9, -6020.3, 3694.4, -6035.3, 3699.8, -6041.7, 3700] };
const DU_AXIS = [0.949, -0.316];   // from the north-west corner (-6090, 3716.4) to the south-west corner (-6076.5, 3757.6) is 43.4 m: the front; the nave runs along this axis
function buildDuomo() {
  initShared();
  const pts = pairsOf(DUOMO.p), gr = groundRange(pts), gy = gr.hi + 0.1;
  const ax = DU_AXIS[0], az = DU_AXIS[1];
  const F0 = [(-6090 + -6076.5) / 2, (3716.4 + 3757.6) / 2], W = 43.4, L = 88, E = 22, RISE = 4.2;   // E: eave height (OSM says 22.3, a church default), RISE of the low tiled roof
  const FF = frame(F0[0], gy, F0[1], -ax, -az);                      // faces the west, x to the south
  const stone = '#c2ab84', joint = '#8b7b62';
  // the long walls: three registers in a bay of 5.5 m (the arcade of the north portico at the foot, blind arches, pointed windows under the eaves)
  facadeMat('duoWall', 5.5, E, { base: stone, ashlar: { base: stone, joint, course: 0.42, block: 0.95, seed: 1401, jw: 1.6, vary: 0.05 }, trim: '#d9c7a0', glass: '#1d1914', seed: 1402, grime: 1,
    bands: [{ y: 9.6, h: 0.5, c: '#d2bd94' }, { y: 15.2, h: 0.45, c: '#d2bd94' }, { y: 21.2, h: 0.8, c: '#cdb68c' }],
    rows: [{ y0: 0.4, y1: 8.4, xs: [2.75], w: 2.9, kind: 'arch', fr: 0.2, sill: false, glass: '#5a4a38' }, { y0: 10.6, y1: 13.8, xs: [1.45, 4.05], w: 1.9, kind: 'arch', fr: 0.15, sill: false, glass: '#4b3f30' },
      { y0: 16.4, y1: 20.4, xs: [2.75], w: 1.3, kind: 'point', fr: 0.16, sill: false }] }, 36);
  facadeMat('duoFront', 21, 27, { base: stone, ashlar: { base: stone, joint, course: 0.42, block: 0.95, seed: 1403, jw: 1.6, vary: 0.05 }, trim: '#d9c7a0', glass: '#1d1914', seed: 1404, grime: 1,
    bands: [{ y: 9.6, h: 0.55, c: '#d2bd94' }, { y: 16.2, h: 0.5, c: '#d2bd94' }, { y: 21.6, h: 0.7, c: '#cdb68c' }],
    rows: [{ y0: 0.4, y1: 8.8, xs: [3.8, 10.5, 17.2], w: 4.2, kind: 'arch', fr: 0.25, sill: false, glass: '#4a3c2c' }, { y0: 11, y1: 15, xs: [3.8, 7.2, 13.8, 17.2], w: 1.8, kind: 'arch', fr: 0.15, sill: false, glass: '#4b3f30' },
      { y0: 17.4, y1: 23.2, xs: [10.5], w: 3.0, kind: 'point', fr: 0.25, sill: false }] }, 36);
  facadeMat('duoTower', 11, 40, { base: stone, ashlar: { base: '#b9a27c', joint, course: 0.42, block: 0.95, seed: 1405, jw: 1.6, vary: 0.06 }, trim: '#d2bd94', glass: '#15110d', seed: 1406, grime: 1,
    bands: [{ y: 12.5, h: 0.5, c: '#cdb68c' }, { y: 22, h: 0.5, c: '#cdb68c' }, { y: 31, h: 0.7, c: '#cdb68c' }, { y: 36.6, h: 0.6, c: '#cdb68c' }],
    rows: [{ y0: 4, y1: 8, xs: [5.5], w: 1.0, kind: 'point', fr: 0.1, sill: false }, { y0: 15, y1: 19, xs: [3.4, 7.6], w: 0.9, kind: 'point', fr: 0.1, sill: false },
      { y0: 24, y1: 29, xs: [5.5], w: 1.3, kind: 'point', fr: 0.14, sill: false }, { y0: 32, y1: 36, xs: [3.4, 7.6], w: 1.5, kind: 'point', fr: 0.14, sill: false, glass: '#0d0a08' }] }, 24);
  defMat('duoClock', 128, 128, [1, 1], (g, w, h) => {
    g.fillStyle = '#c9b48c'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8dfc8'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 2 * PI); g.fill();
    g.strokeStyle = '#3b3328'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#3b3328';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.fillRect(w / 2 + Math.sin(a) * w * 0.38 - 2, h / 2 - Math.cos(a) * w * 0.38 - 2, 4, 4); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 14, h / 2 - 30); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 36, h / 2 + 6); g.stroke();
  });
  begin(gy);
  if (gr.lo < gy - 0.2) prism('stone', pts, gr.lo - 1.5, gy, { c: '#e4d3ae' });
  prism('duoWall', pts, gy, gy + E, { uvo: [0, -gy / E] });
  prism('flat', pts, gy + E, gy + E + 0.2, { c: '#9a8a70' });
  // the roof over the whole width: a low gable along the nave, tiles
  const Mr = frame(F0[0] + ax * (L / 2), gy + E, F0[1] + az * (L / 2), ax, az);
  gable('tile', 'duoWall', Mr, W + 0.4, L, 0.2, RISE, { ov: 0.3, c: '#b87a58', wc: '#b9a27c' });
  // the east end: three apses, the middle one higher, with half-domes of tile
  const AX = (u, x) => [F0[0] + ax * u + az * x, F0[1] + az * u - ax * x];   // the point u metres along the nave from the middle of the front and x metres to the north of its axis
  const mid = AX(L - 1, 0);
  cyl('duoWall', 8.2, 8.2, E - 4, 14, { p: [mid[0], gy, mid[1]] });
  cone('tile', 8.9, 4.6, 14, { p: [mid[0], gy + E - 4, mid[1]], c: '#b87a58' });
  for (const sx of [-1, 1]) { const q = AX(L - 3, sx * 14.5); cyl('duoWall', 4.6, 4.6, E - 9, 10, { p: [q[0], gy, q[1]] }); cone('tile', 5.2, 3.2, 10, { p: [q[0], gy + E - 9, q[1]], c: '#b87a58' }); }
  // the west front: a panel on the front between the towers, standing 0.1 m proud of the wall, with the gable of the roof over it
  const FP = mul(FF, tr(0, 0, 0.08));
  panel('duoFront', 21, 24.2, { M: FP, uvk: [1, 24.2 / 27] });
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 + 11.3, 0); sh.lineTo(W / 2 - 11.3, 0); sh.lineTo(0, RISE + 1.2); sh.lineTo(-W / 2 + 11.3, 0);
  part('flat', new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false }), { M: mul(FF, tr(0, 24.0, -0.2)), c: '#c2ab84' });
  bx('flat', FF, -10.7, 10.7, 23.6, 24.2, -0.2, 0.55, { c: '#d2bd94' });
  for (let i = 0; i < 4; i++) bx('stone', FF, -9 + i * 0.15, 9 - i * 0.15, 0, 0.5 - i * 0.12, 0.2 + i * 0.35, 1.7 - i * 0.2, { c: '#c9c2b0' });   // steps
  // the towers: north (the clock) and south, 11 m square, each a shaft with four faces, a cornice, the belfry, battlements
  const tower = (x, hShaft, hCrown, clock) => {
    const T = mul(FF, tr(x, 0, -5.5)), TW = 11;
    for (const a of [0, PI / 2, PI, -PI / 2]) panel('duoTower', TW, hShaft, { M: mul(mul(T, new THREE.Matrix4().makeRotationY(a)), tr(0, 0, TW / 2 + 0.03)), uvk: [1, hShaft / 40] });
    box('flat', TW - 0.4, hShaft, TW - 0.4, { M: T, p: [0, 0, 0], c: '#b9a27c', noao: true });
    bx('flat', T, -TW / 2 - 0.4, TW / 2 + 0.4, hShaft - 0.9, hShaft + 0.4, -TW / 2 - 0.4, TW / 2 + 0.4, { c: '#cdb68c' });   // the cornice under the battlements
    for (let i = 0; i < 6; i++) for (const [fx, fz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {   // merlons round the top
      const t = (i + 0.5) / 6 * (TW + 0.6) - (TW + 0.6) / 2; bx('flat', T, fx ? fx * (TW / 2 + 0.2) - 0.35 : t - 0.45, fx ? fx * (TW / 2 + 0.2) + 0.35 : t + 0.45, hShaft + 0.4, hShaft + 1.9, fz ? fz * (TW / 2 + 0.2) - 0.35 : t - 0.45, fz ? fz * (TW / 2 + 0.2) + 0.35 : t + 0.45, { c: '#c2ab84', noao: true });
    }
    if (hCrown > hShaft) { bx('flat', T, -2, 2, hShaft + 0.4, hCrown, -2, 2, { c: '#b9a27c' }); bx('dark', T, -0.7, 0.7, hCrown - 3.4, hCrown - 1.2, 1.95, 2.05, { c: '#15110d', noao: true }); }   // a bell stage over the battlements
    if (clock) panel('duoClock', 3.6, 3.6, { M: mul(mul(T, new THREE.Matrix4().makeRotationY(-PI / 2)), tr(0, hShaft - 8.6, TW / 2 + 0.07)), noao: true });   // on the face looking north
  };
  tower(-16.2, 36.5, 40, true);
  tower(16.2, 33, 0, false);
  return end('Duomo di Monreale');
}
const cd = centre(pairsOf(DUOMO.p));
export const DUOMO_MONREALE = { name: 'Duomo di Monreale', x: cd[0], z: cd[1], radius: 90, skipIds: [DUOMO.id], build: buildDuomo };

// ---------------------------------------------------------------------------------------------------
// Shared by the two churches below: a frame on the middle of a front (outward normal n, +x to the right seen from outside), a point of that frame in world metres,
// a flight of n steps rising along local x from xa (the foot) to xb (the top, height h) between z0 and z1, and a balustrade or railing laid along a flight.
// ---------------------------------------------------------------------------------------------------
const toWorld = (F, n) => (x, z) => [F[0] + x * n[1] + z * n[0], F[1] - x * n[0] + z * n[1]];
function flight(M, xa, xb, z0, z1, h, n, c, key = 'stone') {
  const L = Math.abs(xb - xa), t = L / n, r = h / n, sg = xb > xa ? 1 : -1, s = new THREE.Shape();
  s.moveTo(xa, -0.4);
  for (let i = 0; i < n; i++) { s.lineTo(xa + sg * i * t, (i + 1) * r); s.lineTo(xa + sg * (i + 1) * t, (i + 1) * r); }
  s.lineTo(xb, -0.4); s.lineTo(xa, -0.4);
  extrude(key, s, z1 - z0, { M: mul(M, tr(0, 0, z0)), c });
}
function slantRail(kind, M, xa, xb, z, h, rh, c) {   // along the outer edge of a flight, from (xa, 0) up to (xb, h)
  const len = Math.hypot(xb - xa, h), a = Math.atan2(h, xb - xa), Mr = mul(mul(M, tr((xa + xb) / 2, h / 2, z)), new THREE.Matrix4().makeRotationZ(a > PI / 2 ? a - PI : a));
  (kind === 'balus' ? balus : rail)(Mr, len, rh, { c });
}

// ---------------------------------------------------------------------------------------------------
// Belmonte Mezzagno: the Chiesa Madre del Santissimo Crocifisso (OSM w487530927, building=church, name from the OSM tags). Its front looks east-south-east over the paved square
// that runs down to Piazza Garibaldi. Frame CF: origin at the middle of the front on the ground, +z out of the front, +x towards the north-north-east.
// Seen in a photo (Wikimedia Commons, "Belmonte Mezzagno (PA) - chiesa madre del Santissimo Crocifisso.jpg", Saro68, CC BY-SA 3.0, a frontal view; looked at only): the front of
// white render framed in ochre, two orders. The lower one: four single and two paired pilasters, the portal in the middle under a stucco figure and a medallion, a window and an
// oculus in each outer bay, framed blank panels in the inner bays, a frieze and a deep cornice. The upper one, as wide as the nave: four pilasters, the bells hanging in two pairs of
// arched openings under small pediments, a clock under each pair, a tall window in the middle, a triangular pediment with a finial; concave scrolls down to the cornice and two
// obelisks on the ends of the cornice. No bell tower: the bells are in the front. The church stands on a terrace above the square, a balustrade along it and two flights of steps
// that come down from a landing in the middle to either side. From an aerial view on Commons ("Belmonte Mezzagno (PA) - vista - 01.jpg", Saro68, CC BY-SA 3.0): one long gable
// roof of pale tiles over a nave with plain white walls, no dome. Not seen: the sides (drawn as white render with arched windows), the back (the footprint's shallow apse, flat
// roofs on the aisle and on the front range). Heights are read off the photo against the 23 m width of the footprint: terrace 3.2 m, lower order 9.9 m, upper order 7.5 m,
// pediment 2.6 m (the top 23.2 m over the square). The terrain of the map is smoother than the town, so the terrace rises from the square as the photo has it but the church
// floor is not on a ledge of the hill.
// ---------------------------------------------------------------------------------------------------
const CROCIFISSO = { id: 'w487530927', p: [2187.1, 7446.6, 2184.1, 7451.7, 2194.9, 7457.3, 2205.6, 7437.0, 2181.0, 7424.0, 2178.1, 7428.9, 2177.2, 7428.4, 2174.2, 7430.2, 2172.6, 7433.2, 2171.0, 7436.1, 2171.6, 7438.7, 2174.3, 7440.0] };
const CR_F = [2200.25, 7447.15], CR_N = [0.8846, 0.4663];   // the middle of the 23 m front edge (2205.6, 7437) to (2194.9, 7457.3), and its outward normal
const CR_T = 3.2, CR_W = 23, CR_LO = 9.1, CR_UP = 9.9, CR_UT = 16.5;   // terrace, front width, top of the lower order, foot of the upper order, top of the upper pilasters (from the terrace)
const CR_OCHRE = '#d4a04a', CR_WHITE = '#f1ece1';
function paintCrocifisso(g, w, h) {   // the front, 23 m wide and 18 m tall from the terrace: the lower order across the whole canvas, the upper one in x 6 to 17 above y 9.9
  const sx = w / 23, sy = h / 18, O = CR_OCHRE, Wh = CR_WHITE;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  const frameR = (x0, y0, x1, y1, t = 0.16) => { R(x0, y0, x1, y0 + t, O); R(x0, y1 - t, x1, y1, O); R(x0, y0, x0 + t, y1, O); R(x1 - t, y0, x1, y1, O); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x * sx, h - y * sy, r * sx, 0, 2 * PI); g.fill(); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo((x - r) * sx, h - y0 * sy); g.lineTo((x - r) * sx, h - (y1 - r) * sy); g.arc(x * sx, h - (y1 - r) * sy, r * sx, PI, 0); g.lineTo((x + r) * sx, h - y0 * sy); g.fill(); };
  const tri = (x0, x1, y0, y1, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0 * sx, h - y0 * sy); g.lineTo(x1 * sx, h - y0 * sy); g.lineTo((x0 + x1) / 2 * sx, h - y1 * sy); g.fill(); };
  R(0, 0, 23, 18, Wh); noiseDots(g, w, h, w * h / 50, 1.6, 1501, ['rgba(120,100,70,0.07)', 'rgba(255,255,255,0.08)']);
  R(0, 0, 23, 0.4, '#c9ad80');
  // lower order: a frieze of ochre with white metopes, the bays framed in ochre lines
  const P = [-10.4, -9.3, -4.95, -2.1, 2.1, 4.95, 9.3, 10.4].map(x => x + 11.5);
  R(0, 7.5, 23, 8.4, O);
  for (let i = 0; i < P.length - 1; i++) if (P[i + 1] - P[i] > 1.5) { R(P[i] + 0.55, 7.65, P[i + 1] - 0.55, 8.25, Wh); frameR(P[i] + 0.55, 0.55, P[i + 1] - 0.55, 7.25, 0.1); }
  for (const s of [-1, 1]) {
    const ob = 11.5 + s * 7.125, ib = 11.5 + s * 3.525;
    frameR(ob - 0.75, 0.6, ob + 0.75, 2.95, 0.2); R(ob - 0.55, 0.8, ob + 0.55, 2.75, '#3a3430'); R(ob - 0.03, 0.8, ob + 0.03, 2.75, '#1c1814');   // the window
    frameR(ob - 0.95, 4.0, ob + 0.95, 5.9, 0.2); circ(ob, 4.95, 0.72, O); circ(ob, 4.95, 0.58, '#3e3a36');   // the oculus in its square frame
    frameR(ib - 0.62, 4.15, ib + 0.62, 5.75, 0.17);   // the blank panel
  }
  // the portal, the stucco figure on a cartouche and the medallion over it
  R(10.15, 0, 12.85, 4.05, '#c9b28a'); R(10.4, 0, 12.6, 3.75, '#5a4230'); R(11.47, 0, 11.53, 3.75, '#2e2219');
  for (const y of [0.5, 2.1]) for (const x of [10.6, 11.65]) R(x, y, x + 0.75, y + 1.25, '#4b3626');
  circ(11.5, 4.55, 0.42, '#bfa784'); circ(11.5, 4.55, 0.3, '#a58c68');
  g.fillStyle = '#c4ac86'; g.beginPath(); g.moveTo(10.8 * sx, h - 4.9 * sy); g.lineTo(12.2 * sx, h - 4.9 * sy); g.lineTo(11.95 * sx, h - 6.4 * sy); g.lineTo(11.75 * sx, h - 7.1 * sy); g.lineTo(11.25 * sx, h - 7.1 * sy); g.lineTo(11.05 * sx, h - 6.4 * sy); g.fill();
  circ(11.5, 6.95, 0.3, '#c9b18c');
  // upper order (x 6 to 17, y 9.9 to 17.4): frieze, the bells under their pediments, the clocks, the middle window
  R(6, 15.95, 17, 16.5, O); for (const [a, b] of [[6.7, 9.0], [10.0, 13.0], [14.0, 16.3]]) R(a, 16.07, b, 16.38, Wh);
  for (const s of [-1, 1]) {
    const c = 11.5 + s * 3.4;
    for (const dx of [-0.55, 0.55]) { arch(c + dx, 11.15, 13.05, 0.95, O); arch(c + dx, 11.3, 12.92, 0.72, '#2a2420'); circ(c + dx, 12.15, 0.24, '#8a6a32'); R(c + dx - 0.27, 11.85, c + dx + 0.27, 12.15, '#8a6a32'); }
    tri(c - 1.35, c + 1.35, 13.25, 13.95, O); tri(c - 1.05, c + 1.05, 13.4, 13.78, Wh);
    circ(c, 10.6, 0.68, O); circ(c, 10.6, 0.56, '#f4f1ea');
    g.strokeStyle = '#2a2622'; g.lineWidth = Math.max(1.5, 0.07 * sx); g.beginPath(); g.moveTo(c * sx, h - 10.6 * sy); g.lineTo((c + 0.1) * sx, h - 11.0 * sy); g.moveTo(c * sx, h - 10.6 * sy); g.lineTo((c + 0.35) * sx, h - 10.5 * sy); g.stroke();
  }
  frameR(10.6, 10.1, 12.4, 12.85, 0.22); R(10.82, 10.32, 12.18, 12.63, '#35312d'); R(11.47, 10.32, 11.53, 12.63, '#1c1814'); R(10.82, 11.6, 12.18, 11.66, '#1c1814');
  g.fillStyle = O; g.beginPath(); g.ellipse(11.5 * sx, h - 13.0 * sy, 1.05 * sx, 0.55 * sy, 0, PI, 2 * PI); g.fill();
  g.fillStyle = Wh; g.beginPath(); g.ellipse(11.5 * sx, h - 13.0 * sy, 0.8 * sx, 0.35 * sy, 0, PI, 2 * PI); g.fill();
  streaks(g, w, h, 26, 1502, 0.06, 70);
}
function paintCrSide(g, w, h) {   // a side bay, 4.6 m wide and 9.3 m tall from the terrace: white render, one arched window, the ochre band under the eaves
  const sx = w / 4.6, sy = h / 9.3, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4.6, 9.3, '#eee8dc'); noiseDots(g, w, h, w * h / 45, 1.6, 1511, ['rgba(120,100,70,0.08)', 'rgba(255,255,255,0.08)']);
  R(0, 8.5, 4.6, 9.3, CR_OCHRE); R(0, 0, 0.3, 9.3, '#e6dccb');
  g.fillStyle = CR_OCHRE; g.beginPath(); g.moveTo(1.55 * sx, h - 4.4 * sy); g.lineTo(1.55 * sx, h - 6.9 * sy); g.arc(2.3 * sx, h - 6.9 * sy, 0.75 * sx, PI, 0); g.lineTo(3.05 * sx, h - 4.4 * sy); g.fill();
  g.fillStyle = '#3a3633'; g.beginPath(); g.moveTo(1.72 * sx, h - 4.55 * sy); g.lineTo(1.72 * sx, h - 6.9 * sy); g.arc(2.3 * sx, h - 6.9 * sy, 0.58 * sx, PI, 0); g.lineTo(2.88 * sx, h - 4.55 * sy); g.fill();
  streaks(g, w, h, 10, 1512, 0.07, 50);
}
function buildCrocifisso() {
  initShared();
  const pts = pairsOf(CROCIFISSO.p), gr = groundRange(pts), W = toWorld(CR_F, CR_N);
  const y0 = Math.min(groundY(...W(-CR_W / 2, 0)), groundY(...W(CR_W / 2, 0)), groundY(...W(0, 4.6))), T = CR_T;
  const F = frame(CR_F[0], y0, CR_F[1], CR_N[0], CR_N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('crFront', 736, 576, [23, 18], paintCrocifisso);
  defMat('crSide', 128, 256, [4.6, 9.3], paintCrSide);
  begin(y0);
  // the body: stone up to the floor of the church (the terrace level), white render to the eaves of the aisle and the front range, flat roofs; the nave above it under one gable roof
  prism('stone', pts, Math.min(gr.lo, y0) - 1.5, y0 + T, { c: '#d8c8a8' });
  prism('crSide', pts, y0 + T, y0 + 12.5, { uvo: [0, -(y0 + T) / 9.3] });
  prism('flat', pts, y0 + 12.5, y0 + 12.62, { c: '#a49d92' });
  prism('flat', [W(-11.5, -12), W(11.5, -12), W(11.5, 0), W(-11.5, 0)], y0 + 12.5, y0 + 13.1, { c: '#ece6da' });
  bx('flat', F, -5.8, 5.8, 12.5, 17.4, -27.8, -0.3, { c: '#efeadf' });
  gable('tile', 'flat', at(0, 17.4, -14.05), 11.6, 27.5, 0, 3.2, { ov: 0.35, c: '#d9b071', wc: '#efeadf' });
  // the front: the two orders painted on panels 6 cm proud, with the pilasters, the cornices, the scrolls, the obelisks and the pediment as relief
  panel('crFront', CR_W, CR_LO, { M: at(0, T, 0.06), uvk: [1, CR_LO / 18] });
  panel('crFront', 11, 7.5, { M: at(0, T + CR_UP, 0.06), uvk: [11 / 23, 7.5 / 18], uvo: [6 / 23, CR_UP / 18] });
  for (const x of [-10.4, -9.3, -4.95, -2.1, 2.1, 4.95, 9.3, 10.4]) bx('flat', F, x - 0.37, x + 0.37, T, T + CR_LO, 0.06, 0.32, { c: CR_OCHRE });
  for (const x of [-4.8, -2.0, 2.0, 4.8]) bx('flat', F, x - 0.33, x + 0.33, T + CR_UP, T + CR_UT, 0.06, 0.28, { c: CR_OCHRE });
  bx('flat', F, -11.85, 11.85, T + CR_LO, T + CR_UP, -0.1, 0.78, { c: '#d9a957' });   // the main cornice
  bx('flat', F, -5.85, 5.85, T + CR_UT, T + 17.4, -0.1, 0.58, { c: '#d9a957' });     // the upper entablature
  const ped = (hw, rise, z0, d, c) => { const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rise); sh.lineTo(-hw, 0); extrude('flat', sh, d, { M: at(0, T + 17.4, z0), c }); };
  ped(6.1, 2.65, -0.1, 0.62, '#d9a957'); ped(5.1, 2.0, 0.52, 0.06, CR_WHITE);
  cyl('flat', 0.42, 0.42, 0.06, 10, { M: mul(at(0, T + 18.35, 0.6), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#d9a957', noao: true });   // the oculus in the tympanum
  sphere('flat', 0.32, { M: at(0, T + 20.35, 0.2), seg: 6, c: '#e6c27a', noao: true }); bx('flat', F, -0.25, 0.25, T + 19.95, T + 20.1, -0.05, 0.45, { c: '#e6c27a' });
  for (const sg of [-1, 1]) {   // the scrolls from the upper order down to the cornice, the pedestals and the obelisks on the ends
    const sh = new THREE.Shape(); sh.moveTo(sg * 5.5, 0); sh.lineTo(sg * 8.75, 0); sh.lineTo(sg * 8.75, 0.55); sh.quadraticCurveTo(sg * 5.95, 0.75, sg * 5.5, 6.5); sh.lineTo(sg * 5.5, 0);
    extrude('flat', sh, 0.5, { M: at(0, T + CR_UP, -0.05), c: CR_WHITE, cs: 6 });
    const sh2 = new THREE.Shape(); sh2.moveTo(sg * 8.75, 0.55); sh2.quadraticCurveTo(sg * 5.95, 0.75, sg * 5.5, 6.5); sh2.lineTo(sg * 5.5, 6.9); sh2.quadraticCurveTo(sg * 6.25, 1.0, sg * 8.95, 0.85); sh2.lineTo(sg * 8.75, 0.55);
    extrude('flat', sh2, 0.56, { M: at(0, T + CR_UP, -0.05), c: CR_OCHRE, cs: 6 });
    const ox = sg * 9.85;
    bx('flat', F, ox - 0.85, ox + 0.85, T + CR_UP, T + CR_UP + 1.35, -0.6, 0.55, { c: '#e8d29e' });
    bx('flat', F, ox - 0.95, ox + 0.95, T + CR_UP + 1.35, T + CR_UP + 1.55, -0.7, 0.65, { c: CR_OCHRE });
    pyramid('flat', 1.25, 1.25, 4.9, { M: at(ox, T + CR_UP + 1.55, 0), c: '#ead6a2' });
    sphere('flat', 0.2, { M: at(ox, T + CR_UP + 6.5, 0), seg: 4, c: '#5a5048', noao: true });
  }
  // the terrace in front, the landing in the middle and the two flights coming down from it to either side; balustrades along the edges
  bx('flat', F, -CR_W / 2, CR_W / 2, -0.4, T, 0, 2.6, { c: '#ddcfb2' });
  bx('flat', F, -1.6, 1.6, -0.4, T, 2.6, 4.6, { c: '#ddcfb2' });
  bx('flat', F, -0.62, 0.62, 0, 2.35, 4.6, 4.66, { c: '#3d3129', noao: true });   // the door under the landing
  flight(F, -6.1, -1.6, 2.6, 4.6, T, 10, '#d9cdb4', 'flat'); flight(F, 6.1, 1.6, 2.6, 4.6, T, 10, '#d9cdb4', 'flat');
  for (const sg of [-1, 1]) {
    balus(at(sg * 6.55, T, 2.6), 9.9, 0.95, { c: '#e9dfc6' });
    slantRail('balus', F, sg * 6.1, sg * 1.6, 4.6, T, 0.95, '#e9dfc6');
  }
  balus(at(0, T, 4.6), 3.2, 0.95, { c: '#e9dfc6' });
  const o = end('Chiesa Madre del Santissimo Crocifisso, Belmonte Mezzagno');
  o.userData.solids = [[CROCIFISSO.p, null, y0 + 12.5], [[W(-5.8, -0.3), W(5.8, -0.3), W(5.8, -27.8), W(-5.8, -27.8)].flat(), null, y0 + 17.4]];   // occluders for the lean renderer, as the generic block was (src/world.js): the body and the nave
  return o;
}
const crW = toWorld(CR_F, CR_N);
export const CROCIFISSO_BM = {
  name: 'Chiesa Madre del Santissimo Crocifisso (Belmonte Mezzagno)', x: CR_F[0], z: CR_F[1], radius: 45, skipIds: [CROCIFISSO.id], build: buildCrocifisso,
  walls: [[-11.5, 0, -11.5, 2.6], [-11.5, 2.6, -6.1, 2.6], [-6.1, 2.6, -6.1, 4.6], [-6.1, 4.6, 6.1, 4.6], [6.1, 4.6, 6.1, 2.6], [6.1, 2.6, 11.5, 2.6], [11.5, 2.6, 11.5, 0]].map(([a, b, c, d]) => [...crW(a, b), ...crW(c, d)]),
};

// ---------------------------------------------------------------------------------------------------
// Capaci: the Chiesa Madre (OSM w370279778, named only "Chiesa Madre"; it.wikipedia: built from 1734 for the Pilo counts of Capaci, a baroque front with a pincer staircase).
// Its front is the short west-north-west end of the footprint, on the square where Via Generale Cascino comes down. Frame KF: origin at the middle of that edge on the ground,
// +z out of the front, +x towards the south-south-west (to the right seen from the square); the bell tower stands at the north end (-x).
// Seen in photos (Mapillary, 5 October 2019, from the street to the north-west: 472051383873858, 269820611559767, 182537833748420, 1163620144099733, 1037298440009986; looked at only):
// the front of pale limestone ashlar, warmer in the middle, crowned by a wavy crest that climbs from two shoulders to a cross, stone finials on the shoulders and on the crest,
// pilasters, an arched portal in the middle and a smaller arched door either side with an oculus over it, a window with a carved frame over the portal; the square tower flush
// with the front at its north end, plain ashlar with quoins in three stages divided by cornices, one round-arched bell opening a face at the top, a flat top behind a parapet;
// a stone terrace with steps and an iron railing in front; a tall grey rendered wall with a curved top behind and north of the tower (taken for the next building, not drawn here).
// Not seen: the far (south) end of the front behind the trees, the sides and the back (drawn as grey render under a gable roof of tiles kept below the crest, since no roof shows
// over the front in the photos), the stairs' exact plan (two flights from the ends to a middle landing, from the "a tenaglia" of the text).
// Heights are estimates from the photos against the 20.6 m front of the footprint: shoulders 12.4 m, crest 16.6 m, the tower 24.8 m. Whether there is a dome behind could not be
// told from the photos; none is drawn.
// ---------------------------------------------------------------------------------------------------
const CAPACI = { id: 'w370279778', p: [-10734.9, -6014.2, -10733.5, -6014.1, -10717.8, -6008.3, -10713.6, -6006.8, -10700.3, -6001.9, -10707.7, -5982.2, -10726.7, -5989.3, -10742.1, -5994.9, -10740.1, -6000.2] };
const CA_F = [-10738.5, -6004.55], CA_N = [-0.9369, -0.3495];   // the middle of the front edge (-10734.9, -6014.2) to (-10742.1, -5994.9), 20.6 m, and its outward normal
const CA_TW = 6.2, CA_X0 = -10.3, CA_X1 = 10.3, CA_FW = 14.4, CA_FC = 3.1, CA_TH = 24.8;   // tower width, front from x0 to x1, the facade beside the tower (width, middle)
const CA_STONE = '#c8bea7';
function paintCapaciFront(g, w, h) {   // 14.4 m wide, 17 m tall from the ground
  const sx = w / 14.4, sy = h / 17, X = x => (x + 7.2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };
  paintAshlar(g, w, h, 14.4, 17, 0.5, 1.1, CA_STONE, '#b2a891', 1601, 1.0, 0.04);
  const gr = g.createRadialGradient(X(0), Y(9), 0, X(0), Y(9), 6 * sx); gr.addColorStop(0, 'rgba(196,150,112,0.30)'); gr.addColorStop(1, 'rgba(196,150,112,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (const x of [-6.7, -2.6, 2.6, 6.7]) { R(x - 0.42, 1.2, x + 0.42, 11.8, '#ddd4c0'); R(x + 0.42, 1.2, x + 0.5, 11.8, 'rgba(60,45,30,0.25)'); R(x - 0.55, 10.6, x + 0.55, 11.2, '#e2dac8'); }
  // the portal in the middle, a door each side with an oculus over it, the carved window over the portal
  arch(0, 1.2, 6.9, 3.3, '#c7b393'); arch(0, 1.2, 6.5, 2.5, '#5d4330'); R(-0.03, 1.2, 0.03, 5.3, '#2e2218');
  for (const s of [-1, 1]) {
    arch(s * 4.65, 1.2, 5.2, 2.1, '#c7b393'); arch(s * 4.65, 1.2, 4.9, 1.5, '#5d4330');
    circ(s * 4.65, 7.1, 0.85, '#c7b393'); circ(s * 4.65, 7.1, 0.62, '#3b3530');
  }
  arch(0, 7.6, 10.4, 2.4, '#c9ad90'); arch(0, 7.9, 10.0, 1.5, '#37312c');
  g.fillStyle = '#c9ad90'; g.beginPath(); g.moveTo(X(-1.6), Y(7.6)); g.quadraticCurveTo(X(0), Y(7.0), X(1.6), Y(7.6)); g.fill();
  // the crest: a carved cartouche and a niche in the middle, a moulding along the edge (the outline is the shape of the geometry)
  R(-7.2, 11.75, 7.2, 12.4, '#ddd3be');
  g.fillStyle = '#c9ad90'; g.beginPath(); g.ellipse(X(0), Y(13.9), 1.2 * sx, 1.0 * sy, 0, 0, 2 * PI); g.fill(); circ(0, 13.9, 0.55, '#a88f72');
  g.strokeStyle = '#e4dccb'; g.lineWidth = 0.35 * sx; g.beginPath(); g.moveTo(X(4.6), Y(12.2)); g.bezierCurveTo(X(3.6), Y(12.2), X(3.4), Y(14.4), X(2.0), Y(14.8)); g.quadraticCurveTo(X(0.6), Y(15.1), X(0), Y(16.4));
  g.quadraticCurveTo(X(-0.6), Y(15.1), X(-2.0), Y(14.8)); g.bezierCurveTo(X(-3.4), Y(14.4), X(-3.6), Y(12.2), X(-4.6), Y(12.2)); g.stroke();
  streaks(g, w, h, 30, 1602, 0.09, 80, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintCapaciTower(g, w, h) {   // one face, 6.2 m wide and 24.8 m tall: ashlar, quoins, a slit in the lower stages, the bell opening at the top
  const sx = w / 6.2, sy = h / 24.8, X = x => x * sx, Y = y => h - y * sy;
  paintAshlar(g, w, h, 6.2, 24.8, 0.5, 1.1, '#c4bdab', '#aba390', 1611, 0.8, 0.05);
  for (let y = 0; y < 24.8; y += 1.0) for (const [x0, x1] of [[0, y % 2 ? 0.9 : 0.55], [y % 2 ? 5.3 : 5.65, 6.2]]) { g.fillStyle = '#cfc9b9'; g.fillRect(X(x0), Y(y + 0.95), (x1 - x0) * sx, 0.9 * sy); }
  for (const y of [7.5, 15.2]) { g.fillStyle = '#2b2622'; g.fillRect(X(2.85), Y(y + 1.3), 0.5 * sx, 1.3 * sy); }
  const r = 0.75; g.fillStyle = '#ddd6c4'; g.beginPath(); g.moveTo(X(3.1 - r - 0.2), Y(19.0)); g.lineTo(X(3.1 - r - 0.2), Y(22.2)); g.arc(X(3.1), Y(22.2), (r + 0.2) * sx, PI, 0); g.lineTo(X(3.1 + r + 0.2), Y(19.0)); g.fill();
  g.fillStyle = '#1f1b17'; g.beginPath(); g.moveTo(X(3.1 - r), Y(19.2)); g.lineTo(X(3.1 - r), Y(22.2)); g.arc(X(3.1), Y(22.2), r * sx, PI, 0); g.lineTo(X(3.1 + r), Y(19.2)); g.fill();
  g.fillStyle = '#7d6236'; g.beginPath(); g.arc(X(3.1), Y(21.0), 0.42 * sx, PI, 0); g.lineTo(X(3.55), Y(20.25)); g.lineTo(X(2.65), Y(20.25)); g.fill();
  streaks(g, w, h, 18, 1612, 0.1, 90, '55,48,40');
}
function paintCapaciSide(g, w, h) {   // a side bay, 4.5 m wide and 11 m tall: grey render over a stone plinth, an arched window high up, a band under the eaves
  const sx = w / 4.5, sy = h / 11, R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * sx, h - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy); };
  R(0, 0, 4.5, 11, '#c9c1b0'); noiseDots(g, w, h, w * h / 40, 2, 1621, ['rgba(90,80,60,0.10)', 'rgba(255,255,255,0.07)']);
  R(0, 0, 4.5, 1.2, '#b3aa96'); R(0, 10.3, 4.5, 11, '#d8d0be');
  g.fillStyle = '#3a3531'; g.beginPath(); g.moveTo(1.7 * sx, h - 6.6 * sy); g.lineTo(1.7 * sx, h - 8.7 * sy); g.arc(2.25 * sx, h - 8.7 * sy, 0.55 * sx, PI, 0); g.lineTo(2.8 * sx, h - 6.6 * sy); g.fill();
  streaks(g, w, h, 12, 1622, 0.1, 60);
}
function buildCapaci() {
  initShared();
  const pts = pairsOf(CAPACI.p), gr = groundRange(pts), W = toWorld(CA_F, CA_N);
  const y0 = Math.min(groundY(...W(CA_X0, 0)), groundY(...W(CA_X1, 0)), groundY(...W(CA_FC, 4.4)));
  const F = frame(CA_F[0], y0, CA_F[1], CA_N[0], CA_N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('caFront', 464, 544, [14.4, 17], paintCapaciFront);
  defMat('caTower', 128, 512, [6.2, 24.8], paintCapaciTower);
  defMat('caSide', 128, 256, [4.5, 11], paintCapaciSide);
  begin(y0);
  // the body in grey render to 11 m, a flat roof over the side chapels, the nave above it under a gable roof
  prism('caSide', pts, Math.min(gr.lo, y0) - 1.5, y0 + 11, { uvo: [0, -y0 / 11] });
  prism('flat', pts, y0 + 11, y0 + 11.12, { c: '#9b958b' });
  const NC = CA_FC, NW = 11.4;
  bx('flat', F, NC - NW / 2, NC + NW / 2, 11, 12.3, -36.2, -1.2, { c: '#c4bcab' });
  gable('tile', 'flat', at(NC, 12.3, -18.7), NW, 35.0, 0, 3.2, { ov: 0.35, c: '#b37a5a', wc: '#c4bcab' });   // the ridge (15.5 m) stays under the crest
  // the front: one shape with the wavy crest, the ashlar painted on it; pilasters, the cornice, finials and the cross in relief
  const s = new THREE.Shape(), hw = CA_FW / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, 12.4); s.lineTo(4.6, 12.4); s.bezierCurveTo(3.6, 12.4, 3.4, 14.6, 2.0, 15.0); s.quadraticCurveTo(0.6, 15.3, 0, 16.6);
  s.quadraticCurveTo(-0.6, 15.3, -2.0, 15.0); s.bezierCurveTo(-3.4, 14.6, -3.6, 12.4, -4.6, 12.4); s.lineTo(-hw, 12.4); s.lineTo(-hw, 0);
  extrude('caFront', s, 0.75, { M: at(CA_FC, 0, -0.35), uv: 'keep', uvk: [1 / CA_FW, 1 / 17], uvo: [0.5, 0], cs: 5, noao: true });
  for (const x of [-6.7, -2.6, 2.6, 6.7]) bx('flat', F, CA_FC + x - 0.42, CA_FC + x + 0.42, 1.2, 11.75, 0.4, 0.62, { c: '#ddd4c0' });
  bx('flat', F, CA_FC - hw - 0.15, CA_FC + hw + 0.25, 11.75, 12.45, -0.2, 0.85, { c: '#ddd4c2' });   // the cornice under the crest
  const finial = (x, y, k) => { bx('flat', F, x - 0.42 * k, x + 0.42 * k, y, y + 0.8 * k, -0.05, 0.75, { c: '#d6ccb6' }); sphere('flat', 0.4 * k, { M: at(x, y + 0.8 * k + 0.32 * k, 0.35), ky: 1.4, seg: 5, c: '#cfc4ac' }); };
  finial(CA_FC - 6.5, 12.45, 1); finial(CA_FC + 6.5, 12.45, 1); finial(CA_FC - 2.25, 14.85, 0.85); finial(CA_FC + 2.25, 14.85, 0.85);
  bx('flat', F, CA_FC - 0.08, CA_FC + 0.08, 16.4, 18.2, 0.0, 0.16, { c: '#3e3a36', noao: true }); bx('flat', F, CA_FC - 0.55, CA_FC + 0.55, 17.3, 17.45, 0.0, 0.16, { c: '#3e3a36', noao: true });
  // the bell tower: four painted faces round a core, cornices between the stages, a parapet on the top
  const TX = CA_X0 + CA_TW / 2, TZ = -CA_TW / 2 + 0.35, T = at(TX, 0, TZ);
  for (const a of [0, PI / 2, PI, -PI / 2]) panel('caTower', CA_TW, CA_TH, { M: mul(mul(T, new THREE.Matrix4().makeRotationY(a)), tr(0, 0, CA_TW / 2 + 0.02)) });
  box('flat', CA_TW - 0.1, CA_TH, CA_TW - 0.1, { M: T, c: '#bfb8a6', noao: true });
  for (const [y0c, y1c, o] of [[12.0, 12.6, 0.3], [18.2, 18.7, 0.25], [23.6, 24.2, 0.35]]) bx('flat', T, -CA_TW / 2 - o, CA_TW / 2 + o, y0c, y1c, -CA_TW / 2 - o, CA_TW / 2 + o, { c: '#d6cfbd' });
  bx('flat', T, -CA_TW / 2 + 0.1, CA_TW / 2 - 0.1, 24.2, 24.85, -CA_TW / 2 + 0.1, CA_TW / 2 - 0.1, { c: '#c9c2b0' });
  // the terrace across the front beside the tower, a landing in the middle, the two flights from the ends, iron railings
  const TH = 1.2, x0 = CA_X0 + CA_TW, x1 = CA_X1;
  bx('stone', F, x0, x1, -0.4, TH, 0.4, 2.8, { c: '#cfc7b4' });
  bx('stone', F, x0 + 2.4, x1 - 2.4, -0.4, TH, 2.8, 4.4, { c: '#cfc7b4' });
  flight(F, x0, x0 + 2.4, 2.8, 4.4, TH, 6, '#cbc3b0'); flight(F, x1, x1 - 2.4, 2.8, 4.4, TH, 6, '#cbc3b0');
  rail(at((x0 + x1) / 2, TH, 4.4), x1 - x0 - 4.8, 1.0, { c: '#ffffff' });
  slantRail('rail', F, x0, x0 + 2.4, 4.4, TH, 1.0, '#ffffff'); slantRail('rail', F, x1, x1 - 2.4, 4.4, TH, 1.0, '#ffffff');
  const o = end('Chiesa Madre, Capaci');
  o.userData.solids = [[CAPACI.p, null, y0 + 11], [[W(NC - NW / 2, -1.2), W(NC + NW / 2, -1.2), W(NC + NW / 2, -36.2), W(NC - NW / 2, -36.2)].flat(), null, y0 + 12.3], [[W(CA_X0, 0.3), W(CA_X0 + CA_TW, 0.3), W(CA_X0 + CA_TW, -CA_TW + 0.4), W(CA_X0, -CA_TW + 0.4)].flat(), null, y0 + CA_TH]];   // occluders: the body, the nave and the tower (src/world.js)
  return o;
}
const caW = toWorld(CA_F, CA_N);
export const CHIESA_MADRE_CAPACI = {
  name: 'Chiesa Madre (Capaci)', x: CA_F[0], z: CA_F[1], radius: 45, skipIds: [CAPACI.id], build: buildCapaci,
  walls: [[CA_X0 + CA_TW, 0, CA_X0 + CA_TW, 2.8], [CA_X0 + CA_TW, 2.8, CA_X0 + CA_TW, 4.4], [CA_X0 + CA_TW, 4.4, CA_X1, 4.4], [CA_X1, 4.4, CA_X1, 0]].map(([a, b, c, d]) => [...caW(a, b), ...caW(c, d)]),
};

export const TOWN_LANDMARKS = [SANT_AGATA, SAN_GIUSEPPE, PALCHETTO_VB, DUOMO_MONREALE, CROCIFISSO_BM, CHIESA_MADRE_CAPACI];
