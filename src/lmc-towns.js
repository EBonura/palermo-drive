// City landmarks of the towns around Palermo (docs/faithfulness/towns.md). Registered in src/landmarks-city.js, built with the full-detail tile that holds them.
// Villabate: the Chiesa Madre di Sant'Agata (mid 19th century, the parish church; the facade is not in any street photo, the church stands inside a block of houses, so the front
// is the usual neoclassical one of the Sicilian parish churches, on the end of the footprint that opens on a street), the slender concrete bell tower of the Chiesa di San Giuseppe
// (Mapillary, April 2021: a tall tapering slab with one bell opening and a cross, behind iron railings, palms and globe lamps) and the Palchetto della Musica of the public garden.
// Footprints are the OSM buildings of the world tiles (14_8 and 15_8). Everything is drawn in code; the photos were looked at only.
import * as THREE from 'three';
import { PI, begin, end, defMat, part, box, bx, cyl, cone, sphere, panel, prism, gable, mul, tr, frame, pairsOf, obb, groundRange, groundY, initShared, paintFacade } from './lmc-kit.js';

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

export const TOWN_LANDMARKS = [SANT_AGATA, SAN_GIUSEPPE, PALCHETTO_VB];
