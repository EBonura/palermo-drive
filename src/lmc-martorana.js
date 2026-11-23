// City landmark: Santa Maria dell'Ammiraglio, "La Martorana" (Piazza Bellini, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w86870886: the baroque front on the piazza, the Norman bell tower beside it, and the Norman body with its low dome behind and to the side.
// Frame F: origin on the ground in the middle of the north edge of the western block of the footprint, +z out of the front (north, onto Piazza Bellini), local +x to the right seen from the piazza (west).
// The footprint gives: the western block 13.2 m wide and 19.4 m deep (front and tower), the Norman body 23 m long to the east, set back 3.6 m from the front line.
// Reference photos (Wikimedia Commons): Santa Maria dell' Ammiraglio 2009 Palermo.jpg (front and tower from the piazza), Palermo-Martorana-bjs.jpg (front, tower and the Norman body with its dome, from further left).
// Read from them: the baroque front is a flat stone face with a pair of columns each side of a round-arched door, a cornice, an upper order with three windows (the middle one larger under a small pediment with a cross),
// two scroll ornaments at the sides, corner piers, a gently dipping parapet; the bell tower stands at the right of it: an arcade at the base, then stages divided by cornices, a big recessed blind arch with a two-light window,
// a stage with a pair of arches, an open belfry with twin colonnettes, a battlemented crown; stone a dark weathered golden brown; the Norman body is lower, with big blind arches, and a low dome on a plain drum, pinkish.
// Fitted into the footprint, so the front is 8.6 m wide beside a tower 4.6 m wide (the photos show a front closer to square: it is made taller than wide here, about 1.35 to 1); the tower is 17.5 m, the OSM height.
// Not verified and not drawn: the carving, the mosaics, the exact bays of the Norman walls (two blind arches per bay are assumed), the roofs (flat), the interior of the arcade under the tower.
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, panel, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange } from './lmc-kit.js';

const MA = { id: 'w86870886', p: [126.3, 99.3, 139.4, 98, 139.8, 101.6, 156.4, 99.9, 156.7, 102.4, 162.8, 101.8, 163.6, 109.5, 157.4, 110.1, 157.7, 113, 141, 114.7, 141.3, 117.3, 127.8, 118.6, 127.1, 111.7, 122.8, 112.1, 122.6, 109.9, 122.4, 108.2, 127.2, 107.7] };
const O = [132.85, 98.65], N = [-0.0988, -0.9951];
const toWorld = (x, z) => [O[0] + x * N[1] + z * N[0], O[1] - x * N[0] + z * N[1]];
const toLocal = (p) => { const dx = p[0] - O[0], dz = p[1] - O[1]; return [dx * N[1] - dz * N[0], dx * N[0] + dz * N[1]]; };
function clipFront(pts, zmax) {
  const L = pts.map(toLocal), out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out.map(q => toWorld(q[0], q[1]));
}
const FWM = 8.6, FHM = 11.8, FX = -2.3, FZ = -0.4, TX = 4.3, TW = 4.6, TH = 17.5, BODY = 8.4;
const DARK = '#1c1610', GLASS = '#262c34';

function paintFront(g, w, h) {
  const sx = w / FWM, sy = h / FHM, X = x => (x + FWM / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sx, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, FWM, FHM, 0.6, 1.3, '#a88a5e', '#7e6540', 7501, 1.2, 0.07);
  noiseDots(g, w, h, w * h / 60, 2, 7502, ['rgba(60,40,20,0.12)', 'rgba(220,190,140,0.09)']);
  R(-FWM / 2, 0, FWM / 2, 0.5, '#8c7048');
  // piers at both sides (the real boxes stand on them too), the columns of the lower order, the round-arched door
  for (const [a, b, y1] of [[-4.3, -2.9, FHM - 0.2], [3.1, 4.3, FHM - 0.4]]) { R(a, 0.5, b, y1, '#b79a6c'); R(b - 0.16, 0.5, b, y1, 'rgba(50,30,10,0.28)'); R(a, 0.5, a + 0.12, y1, 'rgba(255,240,200,0.28)'); }
  R(-2.9, 0.5, 3.1, 5.2, '#ad8f62');
  arch(0.45, 0.5, 4.9, 2.1, '#c2a577'); arch(0.45, 0.5, 4.6, 1.7, '#2a1c12'); R(0.45 - 0.03, 0.5, 0.45 + 0.03, 3.4, '#1a110a'); arch(0.45, 3.2, 4.4, 1.5, GLASS);
  for (const cx of [-1.1, 2.0]) { R(cx - 0.4, 0.5, cx + 0.4, 5.0, '#c2a577'); R(cx + 0.22, 0.5, cx + 0.4, 5.0, 'rgba(50,30,10,0.3)'); }
  R(-2.9, 5.0, 3.1, 5.9, '#c6a97a'); R(-2.9, 4.85, 3.1, 5.0, 'rgba(50,30,10,0.35)');
  // the upper order: three windows, the middle one larger under a small pediment, two scroll ornaments
  const win = (x, y0, y1, ww) => { R(x - ww / 2 - 0.16, y0 - 0.16, x + ww / 2 + 0.16, y1 + 0.16, '#c2a577'); R(x - ww / 2, y0, x + ww / 2, y1, GLASS); for (let y = y0 + 0.5; y < y1; y += 0.5) R(x - ww / 2, y, x + ww / 2, y + 0.04, '#6a5a44'); R(x - 0.02, y0, x + 0.02, y1, '#6a5a44'); };
  win(-1.6, 6.5, 8.6, 0.8); win(0.35, 6.4, 8.8, 1.0); win(2.25, 6.5, 8.6, 0.8);
  g.fillStyle = '#c2a577'; g.beginPath(); g.moveTo(X(-0.95), Y(9.2)); g.lineTo(X(0.35), Y(10.1)); g.lineTo(X(1.65), Y(9.2)); g.closePath(); g.fill(); R(-0.95, 9.0, 1.65, 9.25, '#c2a577');
  for (const [cx, cy] of [[-3.55, 7.3], [4.0, 7.8]]) { g.fillStyle = '#c2a577'; g.beginPath(); g.arc(X(cx), Y(cy), 0.38 * sx, 0, 2 * PI); g.fill(); g.strokeStyle = '#7e6540'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(cx), Y(cy), 0.2 * sx, 0, 1.5 * PI); g.stroke(); }
  R(-FWM / 2, 5.9, FWM / 2, 6.0, 'rgba(255,240,200,0.2)');
  R(-FWM / 2, FHM - 0.75, FWM / 2, FHM - 0.15, '#c6a97a'); R(-FWM / 2, FHM - 0.9, FWM / 2, FHM - 0.75, 'rgba(50,30,10,0.35)');
  for (const y of [5.0]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.2)); gs.addColorStop(0, 'rgba(30,18,6,0.3)'); gs.addColorStop(1, 'rgba(30,18,6,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.2 * sy); }
  streaks(g, w, h, 22, 7503, 0.12, 100, '50,34,18');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,22,12,0.35)'); gb.addColorStop(1, 'rgba(30,22,12,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintTower(g, w, h) {   // one face of the tower, 4.6 m wide, 17.5 m tall
  const sx = w / TW, sy = h / TH, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.ellipse(X(x), Y(y1 - r), r * sx, r * sx, 0, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, TW, TH, 0.6, 1.3, '#a58559', '#7b6140', 7511, 1.2, 0.07);
  noiseDots(g, w, h, w * h / 60, 2, 7512, ['rgba(60,40,20,0.12)', 'rgba(220,190,140,0.09)']);
  R(0, 0, TW, 0.5, '#8c7048');
  // base: a wide round arch, dark (the entrance under the tower)
  arch(TW / 2, 0.5, 5.0, 3.6, '#bfa274'); arch(TW / 2, 0.5, 4.7, 3.2, DARK); R(0.2, 5.4, TW - 0.2, 5.55, 'rgba(50,30,10,0.35)');
  // stage one: a big recessed blind arch of several orders with a two-light window
  arch(TW / 2, 6.3, 10.4, 3.9, '#bfa274'); arch(TW / 2, 6.4, 10.2, 3.5, '#8e6f46'); arch(TW / 2, 6.4, 9.9, 3.1, '#7c5e3a');
  for (const cx of [1.65, 2.95]) { arch(cx, 6.8, 9.0, 0.9, '#c2a577'); arch(cx, 6.8, 8.8, 0.62, DARK); }
  R(TW / 2 - 0.1, 6.8, TW / 2 + 0.1, 8.1, '#c6a97a');
  // stage two: two open arches with a colonnette between
  arch(1.3, 11.3, 14.0, 1.4, '#bfa274'); arch(1.3, 11.3, 13.8, 1.1, DARK); arch(3.3, 11.3, 14.0, 1.4, '#bfa274'); arch(3.3, 11.3, 13.8, 1.1, DARK); R(2.2, 11.3, 2.4, 13.4, '#c6a97a');
  // stage three: the belfry, three open arches
  for (const cx of [0.95, 2.3, 3.65]) { arch(cx, 15.2, 16.6, 0.9, '#bfa274'); arch(cx, 15.2, 16.5, 0.65, DARK); }
  // the crown: a battlement
  R(0, 17.1, TW, 17.5, '#bfa274'); for (let x = 0.1; x < TW; x += 0.5) R(x, 17.5 - 0.0, x + 0.25, 17.5, '#bfa274');
  for (const y of [5.6, 10.6, 14.6, 16.9]) { R(0, y, TW, y + 0.4, '#c6a97a'); R(0, y - 0.2, TW, y, 'rgba(40,25,8,0.35)'); }
  streaks(g, w, h, 14, 7513, 0.12, 120, '50,34,18');
}
function paintWall(g, w, h, hm) {   // a bay of the Norman body, 4.5 m wide: dark weathered stone, a tall blind arch, a window
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.55, 1.2, '#a98a5e', '#80663f', 7521, 1.2, 0.08);
  noiseDots(g, w, h, w * h / 70, 2, 7522, ['rgba(60,40,20,0.12)', 'rgba(220,190,140,0.09)']);
  R(0, 0, 4.5, 0.6, '#8c7048');
  arch(2.25, 0.6, 6.4, 3.3, '#b99a6c'); arch(2.25, 0.6, 6.2, 3.0, '#9a7b50'); arch(2.25, 3.6, 5.5, 0.8, '#c2a577'); arch(2.25, 3.7, 5.4, 0.55, GLASS);
  R(0, hm - 0.7, 4.5, hm, '#bfa274'); R(0, hm - 1.0, 4.5, hm - 0.7, 'rgba(40,25,8,0.3)');
  streaks(g, w, h, 8, 7525, 0.12, 80, '50,34,18');
}

function buildMartorana() {
  initShared();
  const pts = pairsOf(MA.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-3, 1.5)), groundY(...W(3, 1.5)), groundY(...W(0, 3)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('maFront', 384, 512, [FWM, FHM], paintFront);
  defMat('maTower', 192, 768, [TW, TH], paintTower);
  defMat('maWall', 128, 256, [4.5, BODY], (g, w, h) => paintWall(g, w, h, BODY));
  begin(y0);
  // the body: the whole footprint up to the eaves, a flat roof; the front stands in front of it
  const body = clipFront(pts, FZ - 0.05);
  prism('maWall', body, Math.min(gr.lo, y0) - 1.5, y0 + BODY, { uvo: [0, -y0 / BODY] });
  prism('flat', body, y0 + BODY, y0 + BODY + 0.14, { c: '#8f7f6a' });
  // the front: one shape (flat face, a dip in the parapet) with the painted front on it
  const s = new THREE.Shape(), hw = FWM / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, FHM - 0.4); s.quadraticCurveTo(0, FHM - 1.4, -hw, FHM); s.lineTo(-hw, 0);
  extrude('maFront', s, 0.7, { M: at(FX, 0, FZ - 0.7), uv: 'keep', uvk: [1 / FWM, 1 / FHM], uvo: [0.5, 0], cs: 8, noao: true });
  // what stands out of the front: the piers, the columns, the cornices, the cross
  for (const [a, b, y1] of [[-4.3, -2.9, FHM - 0.2], [3.1, 4.3, FHM - 0.4]]) bx('flat', F, FX + a, FX + b, 0.5, y1, FZ, 0.0, { c: '#b79a6c', noao: true });
  for (const cx of [-1.1, 2.0]) { cyl('flat', 0.36, 0.4, 4.3, 10, { M: at(FX + cx, 0.5, FZ - 0.05 + 0.0), c: '#c2a577' }); bx('flat', F, FX + cx - 0.55, FX + cx + 0.55, 4.8, 5.1, FZ - 0.35, 0.0, { c: '#c6a97a' }); }
  bx('flat', F, FX - 3.15, FX + 3.35, 5.1, 5.9, FZ, 0.0, { c: '#c6a97a', noao: true });
  bx('flat', F, FX - hw - 0.05, FX + hw + 0.05, FHM - 0.8, FHM - 0.6, FZ, 0.0, { c: '#c6a97a', noao: true });
  bx('flat', F, FX + 0.28, FX + 0.42, FHM - 1.3, FHM + 0.9, FZ + 0.1, FZ + 0.28, { c: '#9a8a70', noao: true }); bx('flat', F, FX - 0.15, FX + 0.85, FHM - 0.2, FHM - 0.05, FZ + 0.1, FZ + 0.28, { c: '#9a8a70', noao: true });
  // the tower: four painted faces round a core, cornices between the stages
  { const T = at(TX, 0, FZ - TW / 2 + 0.05);
    for (const a of [0, PI / 2, PI, -PI / 2]) panel('maTower', TW, TH, { M: mul(mul(T, new THREE.Matrix4().makeRotationY(a)), tr(0, 0, TW / 2 + 0.02)) });
    bx('flat', T, -TW / 2 + 0.1, TW / 2 - 0.1, 0, TH, -TW / 2 + 0.1, TW / 2 - 0.1, { c: '#8e7448', noao: true });
    for (const [ya, yb, o] of [[5.5, 6.0, 0.14], [10.5, 11.0, 0.14], [14.5, 15.0, 0.14], [TH - 0.7, TH, 0.18]]) bx('flat', T, -TW / 2 - o, TW / 2 + o, ya, yb, -TW / 2 - o, TW / 2 + o, { c: '#c6a97a' });
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx('flat', T, px * 2.1 - 0.18, px * 2.1 + 0.18, TH, TH + 0.5, pz * 2.1 - 0.18, pz * 2.1 + 0.18, { c: '#bfa274' });
  }
  // the Norman body's low dome: a plain square drum, a pinkish dome, a small lantern
  { const D = at(-15.0, BODY + 0.14, -10.0);
    bx('flat', D, -3.3, 3.3, 0, 2.2, -3.3, 3.3, { c: '#ad8d60' });
    cyl('flat', 3.0, 3.1, 1.2, 14, { M: mul(D, tr(0, 2.2, 0)), c: '#b99a6c' });
    const prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; prof.push([Math.max(0.001, 2.9 * Math.cos(a)), 2.4 * Math.sin(a)]); }
    lathe('flat', prof, 14, { M: mul(D, tr(0, 3.4, 0)), c: '#c38f6a', noao: true });
    cyl('flat', 0.35, 0.4, 0.6, 6, { M: mul(D, tr(0, 5.7, 0)), c: '#b99a6c' }); sphere('flat', 0.2, { M: mul(D, tr(0, 6.4, 0)), seg: 6, c: '#b99a6c' });
  }
  const o = end('Santa Maria dell’Ammiraglio (La Martorana)');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[MA.p, null, y0 + BODY], [ring(TX - TW / 2, TX + TW / 2, FZ - TW, FZ), null, y0 + TH]];
  return o;
}
export const MARTORANA = { name: 'Santa Maria dell’Ammiraglio (La Martorana)', x: 143, z: 108, radius: 35, skipIds: [MA.id], build: buildMartorana };
