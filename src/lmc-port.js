// City landmarks of the port (board item n10): the floating dry dock of the shipyard, afloat at the water line (OSM w1349488887, dock=floating): a hull pontoon with a wing wall on each side.
// The quays themselves are src/quays.js.
import {
  PI, begin, end, defMat, part, box, bx, prism, mul, tr, frame, pairsOf, obb, initShared, paintAshlar, noiseDots, streaks,
} from './lmc-kit.js';
// the OSM outline (w1349488887, building=industrial, dock=floating), game metres
const DOCK = { id: 'w1349488887', p: [1111.0, -1380.8, 1139.8, -1282.7, 1146.6, -1284.6, 1149.1, -1275.9, 1165.0, -1280.5, 1162.5, -1289.1, 1169.2, -1291.1, 1140.2, -1390.1, 1136.6, -1389.1, 1133.6, -1393.5, 1117.9, -1389.2, 1118.0, -1386.1, 1115.1, -1382.0] };

function buildFloatingDock() {
  initShared();
  const pts = pairsOf(DOCK.p), ob = obb(pts);
  begin(0);
  defMat('fdHull', 128, 128, [4, 4], (g, w, h) => { g.fillStyle = '#7a3b2c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 400, 2.5, 1301, ['rgba(40,20,14,0.3)', 'rgba(200,120,90,0.18)']); g.fillStyle = 'rgba(30,22,18,0.35)'; for (let y = 8; y < h; y += 32) g.fillRect(0, y, w, 2); });
  defMat('fdWing', 128, 256, [4, 8], (g, w, h) => { g.fillStyle = '#c8c4b8'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2.5, 1302, ['rgba(60,50,40,0.18)', 'rgba(255,255,250,0.16)']); g.fillStyle = 'rgba(50,60,70,0.55)'; for (let y = 40; y < h - 20; y += 52) for (let x = 14; x < w - 14; x += 38) g.fillRect(x, y, 20, 26); streaks(g, w, h, 8, 1303, 0.2, 100); });
  const L = ob.w, D = ob.d, M = frame(ob.cx, 0, ob.cz, ob.vx, ob.vz);   // local x along the long axis
  // the pontoon: from 1.4 m under the water to 1.1 m over it, with a rim, and the blocks on its deck
  bx('fdHull', mul(M, tr(0, 0, 0)), -L / 2, L / 2, -1.4, 1.1, -D / 2, D / 2, { c: '#ffffff' });
  bx('flat', M, -L / 2 + 0.2, L / 2 - 0.2, 1.1, 1.18, -D / 2 + 0.2, D / 2 - 0.2, { c: '#a8a49a', noao: true });
  // the wing walls: 2.4 m thick, 9 m high, along both long sides, with a rail on top and a gantry rail along it
  for (const sg of [-1, 1]) {
    const z0 = sg * (D / 2 - 1.2);
    bx('fdWing', M, -L / 2 + 0.5, L / 2 - 0.5, 1.1, 10.4, z0 - 1.2, z0 + 1.2, { c: '#ffffff' });
    bx('flat', M, -L / 2 + 0.3, L / 2 - 0.3, 10.4, 10.7, z0 - 1.5, z0 + 1.5, { c: '#8f8b82', noao: true });
    for (let x = -L / 2 + 4; x < L / 2 - 3; x += 12) bx('flat', M, x - 0.1, x + 0.1, 10.7, 11.7, z0 - 1.4 * sg + (sg > 0 ? -0.0 : 0), z0 + 1.4 * sg, { c: '#2d2f33', noao: true });
  }
  // two travelling cranes across the dock on the wing walls
  for (const x of [-L * 0.22, L * 0.2]) {
    bx('flat', M, x - 1.2, x + 1.2, 10.7, 13.2, -D / 2 + 0.2, D / 2 - 0.2, { c: '#d4a02a', noao: true });
    bx('flat', M, x - 2.2, x + 2.2, 13.2, 15.4, -2.4, 2.4, { c: '#3a3d42', noao: true });
  }
  return end('Floating dock');
}
const fp = pairsOf(DOCK.p), c = fp.reduce((a, q) => [a[0] + q[0] / fp.length, a[1] + q[1] / fp.length], [0, 0]);
export const FLOATING_DOCK = { name: 'Floating dock', x: c[0], z: c[1], radius: 80, skipIds: [DOCK.id], build: buildFloatingDock };
