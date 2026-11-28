// City landmarks: the churches of Palermo that have no model of their own yet, each built by one parametric builder (their rows are in src/lmc-churches-data.js; a church that gets its own model has its row removed). Registered in src/landmarks-city.js.
// The data (src/lmc-churches-data.js, made by a script from the baked tiles) gives each church its footprint and its front: the edge that looks onto a road or open ground, with its outward
// normal and length. Everything else follows from the footprint and the baked height: the body up to the eaves in the footprint (clipped so it never stands in front of the front), a nave
// under a gable roof where a straight nave fits inside the footprint, a painted front drawn in one of three styles (baroque in two orders, Gothic with a pointed portal and a rose window,
// plain parish with a pediment and an oculus), twin bell towers on wide baroque fronts, a lead dome with a lantern on the large baroque ones, a bell gable on the Gothic ones.
// The three front textures are painted once in a template size and stretched to each front, the wall texture is shared, so all these churches use seven materials between them.
// The style of a church is picked from its hash, not from knowledge of the real front: these are churches in the manner of Palermo, not portraits. The hand-built churches (San Domenico, San Francesco,
// Sant'Agostino, Salvatore, Sant'Ignazio) are in their own files. Nothing here claims a detail of a real front: statues are stone silhouettes, no inscriptions.
import * as THREE from 'three';
import { PI, bx, lathe, sphere, panel, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, cyl } from './lmc-kit.js';
import { CHURCH_DATA } from './lmc-churches-data.js';

const GLASS = '#262f3a';
const arch = (g, X, Y, sx, x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
const point = (g, X, Y, sx, x, y0, y1, ww, c) => { const r = ww / 2, ys = y1 - 1.25 * r; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(ys)); g.quadraticCurveTo(X(x - r), Y(ys + r * 1.05), X(x), Y(y1)); g.quadraticCurveTo(X(x + r), Y(ys + r * 1.05), X(x + r), Y(ys)); g.lineTo(X(x + r), Y(y0)); g.fill(); };
const circ = (g, X, Y, sx, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * sx, 0, 2 * PI); g.fill(); };

// ---- template fronts: x from -TW/2 to TW/2, y up from the ground, TW x TH metres; stretched to the real front
const BT = { w: 24, h: 26 }, GT = { w: 14, h: 18 }, PT = { w: 12, h: 14 };
function paintBaroque(g, w, h) {
  const FW = BT.w, FH = BT.h, sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, FW, FH, 0.6, 1.4, '#e1d4b6', '#c1b69b', 7101, 1.0, 0.04);
  R(-FW / 2, 0, FW / 2, 1.0, '#c6bca4');
  const pil = (x, y0, y1) => { R(x - 0.55, y0, x + 0.55, y1, '#e9e1cc'); R(x + 0.55, y0, x + 0.68, y1, 'rgba(60,45,30,0.28)'); R(x - 0.55, y0, x - 0.48, y1, 'rgba(255,255,250,0.5)'); R(x - 0.8, y1 - 0.55, x + 0.8, y1, '#efe8d3'); };
  for (const x of [-11, -5.7, 5.7, 11]) pil(x, 1.0, 10.4);
  R(-FW / 2, 10.4, FW / 2, 11.6, '#e9e1cc'); R(-8.6, 10.75, 8.6, 11.25, '#cbc1a8');
  arch(g, X, Y, sx, 0, 1.0, 7.6, 3.9, '#ece4cf'); arch(g, X, Y, sx, 0, 1.0, 7.2, 3.0, '#16120f'); arch(g, X, Y, sx, 0, 1.0, 5.3, 2.8, '#4a3523'); arch(g, X, Y, sx, 0, 5.2, 7.0, 2.8, GLASS);
  g.fillStyle = '#ece4cf'; g.strokeStyle = 'rgba(60,45,30,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(-2.7), Y(8.0)); g.quadraticCurveTo(X(0), Y(11.2), X(2.7), Y(8.0)); g.closePath(); g.fill(); g.stroke();
  for (const s of [-1, 1]) { arch(g, X, Y, sx, s * 8.4, 1.0, 5.6, 2.4, '#ece4cf'); arch(g, X, Y, sx, s * 8.4, 1.0, 5.2, 1.7, '#16120f'); arch(g, X, Y, sx, s * 8.4, 1.0, 4.3, 1.5, '#4a3523'); circ(g, X, Y, sx, s * 8.4, 7.9, 1.0, '#ece4cf'); circ(g, X, Y, sx, s * 8.4, 7.9, 0.72, GLASS); }
  for (const x of [-7.8, -2.9, 2.9, 7.8]) pil(x, 11.6, 20.5);
  arch(g, X, Y, sx, 0, 13.2, 19.4, 3.0, '#ece4cf'); arch(g, X, Y, sx, 0, 13.5, 19.0, 2.2, '#16120f'); arch(g, X, Y, sx, 0, 13.5, 18.8, 2.0, GLASS); R(-0.04, 13.5, 0.04, 17.6, '#d9d0b8');
  for (const s of [-1, 1]) {
    arch(g, X, Y, sx, s * 5.3, 13.4, 18.2, 1.8, '#bfb59c'); arch(g, X, Y, sx, s * 5.3, 13.4, 17.8, 1.4, '#9a917c');
    g.fillStyle = '#e2d9c2'; g.beginPath(); g.ellipse(X(s * 5.3), Y(15.6), 0.34 * sx, 1.1 * sy, 0, 0, 2 * PI); g.fill(); circ(g, X, Y, sx, s * 5.3, 16.9, 0.28, '#e2d9c2');
    g.fillStyle = '#e4dcc6'; g.strokeStyle = 'rgba(60,45,30,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X(s * 12), Y(11.6)); g.bezierCurveTo(X(s * 11.2), Y(12.6), X(s * 10.2), Y(15), X(s * 9.2), Y(17.2)); g.lineTo(X(s * 9.2), Y(14.6)); g.bezierCurveTo(X(s * 10.2), Y(13.2), X(s * 10.4), Y(12.4), X(s * 10.6), Y(11.6)); g.closePath(); g.fill(); g.stroke();
  }
  R(-9.6, 20.5, 9.6, 21.6, '#e9e1cc'); circ(g, X, Y, sx, 0, 23.4, 1.25, '#ece4cf'); circ(g, X, Y, sx, 0, 23.4, 0.9, GLASS);
  for (const y of [10.4, 20.5]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.6)); gs.addColorStop(0, 'rgba(30,22,14,0.3)'); gs.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.6 * sy); }
  streaks(g, w, h, 30, 7102, 0.09, 110, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,25,18,0.32)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
const BSIL = [[-12, 0], [12, 0], [12, 11.6], [11.2, 12.6], [10.2, 15], [9.4, 17.2], [9.4, 21.6], [9.8, 21.6]];   // the right half of the baroque outline, then the curved pediment over the top
function paintGothic(g, w, h) {
  const FW = GT.w, FH = GT.h, sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, FW, FH, 0.5, 1.1, '#e0d3b3', '#b9ac8f', 7201, 1.0, 0.05);
  R(-FW / 2, 0, FW / 2, 0.8, '#c4b99f');
  for (const s of [-1, 1]) { R(s * 6.5 - 0.6, 0.8, s * 6.5 + 0.6, 14.4, '#d9ceb2'); R(s * 6.5 + 0.6, 0.8, s * 6.5 + 0.72, 14.4, 'rgba(60,45,30,0.26)'); }
  for (const [ww, c] of [[4.6, '#e9e1cc'], [3.9, '#d4c9ac'], [3.2, '#e9e1cc'], [2.6, '#cfc4a8']]) point(g, X, Y, sx, 0, 0.8, 7.6 + (4.6 - ww) * 0.2, ww, c);
  point(g, X, Y, sx, 0, 0.8, 6.0, 2.0, '#16120f'); point(g, X, Y, sx, 0, 0.8, 4.4, 1.8, '#4a3523'); R(-0.04, 0.8, 0.04, 4.0, '#2a1e14'); point(g, X, Y, sx, 0, 4.2, 5.8, 1.8, GLASS);
  const cy = 11.4; circ(g, X, Y, sx, 0, cy, 2.5, '#e9e1cc'); circ(g, X, Y, sx, 0, cy, 2.1, '#16120f'); circ(g, X, Y, sx, 0, cy, 1.85, GLASS);
  g.strokeStyle = '#e4ddcc'; g.lineWidth = 0.14 * sx; for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; g.beginPath(); g.moveTo(X(0), Y(cy)); g.lineTo(X(Math.cos(a) * 1.9), Y(cy + Math.sin(a) * 1.9)); g.stroke(); }
  circ(g, X, Y, sx, 0, cy, 0.45, '#e4ddcc');
  for (let x = -6.2; x < 6.3; x += 1.0) { point(g, X, Y, sx, x, 14.8, 15.9, 0.7, '#d4c9ac'); }
  R(-FW / 2, 16.2, FW / 2, 16.7, '#e9e1cc');
  streaks(g, w, h, 20, 7202, 0.09, 100, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintPlain(g, w, h) {
  const FW = PT.w, FH = PT.h, sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 90, 2, 7301, ['rgba(120,90,60,0.08)', 'rgba(255,250,235,0.08)']);
  R(-FW / 2, 0, FW / 2, 0.9, '#c4b99f');
  for (const x of [-5.4, 5.4]) { R(x - 0.5, 0.9, x + 0.5, 9.4, '#efe8d3'); R(x + 0.5, 0.9, x + 0.62, 9.4, 'rgba(60,45,30,0.25)'); }
  R(-FW / 2, 9.4, FW / 2, 10.2, '#efe8d3');
  arch(g, X, Y, sx, 0, 0.9, 6.0, 3.0, '#efe8d3'); arch(g, X, Y, sx, 0, 0.9, 5.6, 2.3, '#16120f'); arch(g, X, Y, sx, 0, 0.9, 4.3, 2.1, '#4a3523'); arch(g, X, Y, sx, 0, 4.2, 5.4, 2.1, GLASS);
  for (const s of [-1, 1]) { arch(g, X, Y, sx, s * 3.4, 3.2, 6.8, 1.0, '#cfc6ae'); arch(g, X, Y, sx, s * 3.4, 3.4, 6.5, 0.7, GLASS); }
  circ(g, X, Y, sx, 0, 7.9, 1.0, '#efe8d3'); circ(g, X, Y, sx, 0, 7.9, 0.7, GLASS);
  g.fillStyle = '#efe8d3'; g.beginPath(); g.moveTo(X(-FW / 2), Y(10.2)); g.lineTo(X(0), Y(FH)); g.lineTo(X(FW / 2), Y(10.2)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(70,55,40,0.3)'; g.beginPath(); g.moveTo(X(-5), Y(10.6)); g.lineTo(X(0), Y(13.0)); g.lineTo(X(5), Y(10.6)); g.closePath(); g.fill();
  streaks(g, w, h, 16, 7302, 0.1, 90, '60,50,40');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(2.5)); gb.addColorStop(0, 'rgba(30,25,18,0.3)'); gb.addColorStop(1, 'rgba(30,25,18,0)'); g.fillStyle = gb; g.fillRect(0, Y(2.5), w, 2.5 * sy);
}
function paintWall(g, w, h) {   // a bay of the body or the nave: 4.5 m wide, 12 m tall, a tall arched window high up, a cornice under the roof, a plinth
  const hm = 12, sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, 4.5, hm, 0.6, 1.4, '#d8cfb6', '#b6ac93', 7401, 1.0, 0.05);
  noiseDots(g, w, h, w * h / 120, 2, 7404, ['rgba(120,90,60,0.07)', 'rgba(255,250,235,0.06)']);
  R(0, 0, 0.5, hm, 'rgba(255,250,235,0.18)'); R(4.0, 0, 4.5, hm, 'rgba(60,45,30,0.14)'); R(0, 0, 4.5, 1.1, '#c2b8a0');
  arch(g, X, Y, sx, 2.25, 4.6, 10.0, 1.9, '#ece4cf'); arch(g, X, Y, sx, 2.25, 5.0, 9.6, 1.3, '#16120f'); arch(g, X, Y, sx, 2.25, 5.0, 9.4, 1.1, GLASS); R(2.2, 5.0, 2.3, 8.6, '#d9d0b8');
  R(0, hm - 0.7, 4.5, hm, '#e9e1cc'); R(0, hm - 1.1, 4.5, hm - 0.7, 'rgba(40,30,18,0.3)');
  streaks(g, w, h, 10, 7405, 0.1, 80, '55,48,40');
}

// ---- geometry helpers
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const clearance = (p, x, z) => { let m = 1e9; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = L2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; m = Math.min(m, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); } return m; };
function clipZ(L, zmax) {   // a ring of [x, z] cut at z = zmax (keeps z <= zmax)
  const out = [];
  for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1]; if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
  return out;
}
const hash = (c, k) => { const s = Math.sin((c + 1) * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

function makeChurch([id, name, flat, fr, bh, hc]) {
  const ring = pairsOf(flat), [mx, mz, nx, nz, L] = fr;
  const style = hash(hc, 1) < 0.5 ? 'baroque' : hash(hc, 1) < 0.78 ? 'gothic' : 'plain';
  const FW = Math.max(9, Math.min(L, style === 'baroque' ? 28 : style === 'gothic' ? 20 : 15));
  const toW = (x, z) => [mx + x * nz + z * nx, mz - x * nx + z * nz];
  const toL = (p) => { const dx = p[0] - mx, dz = p[1] - mz; return [dx * nz - dz * nx, dx * nx + dz * nz]; };
  const loc = ring.map(toL);
  const EAVE = Math.max(7.5, Math.min(15, bh * 0.72));
  let bd = 0; for (const q of loc) bd = Math.max(bd, -q[1]);   // how far back the footprint goes
  const build = () => {
    initShared();
    const gr = groundRange(ring), y0 = Math.min(groundY(...toW(-FW / 2, 1)), groundY(...toW(FW / 2, 1)), groundY(...toW(0, 1)));
    const F = frame(mx, y0, mz, nx, nz), at = (x, y, z) => mul(F, tr(x, y, z));
    defMat('cwBaroque', 512, 560, [BT.w, BT.h], paintBaroque); defMat('cwGothic', 384, 512, [GT.w, GT.h], paintGothic); defMat('cwPlain', 256, 320, [PT.w, PT.h], paintPlain);
    defMat('cwWall', 128, 256, [4.5, 12], paintWall);
    begin(y0);
    const FZ = 0.3, FT = style === 'plain' ? 1.0 : 1.5;
    // the body up to the eaves in the footprint (cut off where it would stand in front of the front)
    const body = clipZ(loc, FZ - 0.15).map(q => toW(q[0], q[1]));
    if (body.length < 3) return end(name);
    prism('cwWall', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / 12] });
    prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#9b958b' });
    bx('flat', F, -FW / 2 - 0.2, FW / 2 + 0.2, EAVE - 0.3, EAVE + 0.1, FZ - 0.1, FZ + 0.4, { c: '#e9e1cc', noao: true });
    // a straight nave inside the footprint: the widest box behind the front that fits, under a gable roof of tiles
    let nave = null;
    for (let hw = Math.min(FW * 0.42, 9); hw >= 3.2 && !nave; hw -= 0.6) {
      let len = 0; const xc = 0;
      for (let z = -2; z > -bd; z -= 1.5) { if (inPoly(loc, xc - hw, z) && inPoly(loc, xc + hw, z) && inPoly(loc, xc, z)) len = -z; else break; }
      if (len >= 12) nave = { hw, len: Math.min(len, 60) };
    }
    let ridge = EAVE;
    if (nave) {
      const NT = EAVE + Math.max(3, Math.min(7, bh * 0.28)), rise = Math.min(nave.hw * 0.36, 4);
      bx('cwWall', F, -nave.hw, nave.hw, EAVE, NT, -nave.len, -1.5, { uvo: [0, -(y0 + EAVE) / 12] });
      gable('tile', 'cwWall', at(0, 0, -(nave.len + 1.5) / 2), nave.hw * 2, nave.len - 1.5, NT, rise, { ov: 0.35, c: '#b8744f', wc: '#d4cbb2' });
      ridge = NT + rise;
    }
    // the front: one extruded shape in the template of its style, stretched to the real width and height
    const H = style === 'baroque' ? Math.max(ridge + 1.5, EAVE + 5) : style === 'gothic' ? Math.max(ridge * 0.9, EAVE + 3) : Math.max(ridge * 0.9, EAVE + 2.5);
    const T = style === 'baroque' ? BT : style === 'gothic' ? GT : PT, key = style === 'baroque' ? 'cwBaroque' : style === 'gothic' ? 'cwGothic' : 'cwPlain';
    const sh = new THREE.Shape(), kx = FW / T.w, ky = H / T.h, hwT = T.w / 2;
    if (style === 'baroque') {
      sh.moveTo(-hwT * kx, 0); for (const [x, y] of BSIL) sh.lineTo(x * kx, y * ky);
      sh.quadraticCurveTo(0, 33.6 * ky * 1.0, -9.8 * kx, 21.6 * ky);
      for (const [x, y] of BSIL.slice(2).reverse()) sh.lineTo(-x * kx, y * ky); sh.lineTo(-hwT * kx, 0);
    } else if (style === 'gothic') {
      sh.moveTo(-hwT * kx, 0); sh.lineTo(hwT * kx, 0); sh.lineTo(hwT * kx, 16.7 * ky); sh.lineTo(-hwT * kx, 16.7 * ky); sh.lineTo(-hwT * kx, 0);
    } else {
      sh.moveTo(-hwT * kx, 0); sh.lineTo(hwT * kx, 0); sh.lineTo(hwT * kx, 10.2 * ky); sh.lineTo(0, T.h * ky); sh.lineTo(-hwT * kx, 10.2 * ky); sh.lineTo(-hwT * kx, 0);
    }
    extrude(key, sh, FT, { M: at(0, 0, FZ - FT), uv: 'keep', uvk: [1 / (T.w * kx), 1 / (T.h * ky)], uvo: [0.5, 0], cs: 6, noao: true });
    if (style === 'gothic') { for (let x = -FW / 2 + 0.4; x < FW / 2 - 0.2; x += 1.1 * kx) bx('flat', F, x, x + 0.6 * kx, 16.7 * ky, 17.5 * ky, FZ - 0.5, FZ - 0.1, { c: '#d9d0b8', noao: true }); }
    // cornice, steps
    if (style === 'baroque') bx('flat', F, -FW / 2 - 0.25, FW / 2 + 0.25, 10.4 * ky, 10.55 * ky, FZ - 0.1, FZ + 0.55, { c: '#e9e1cc', noao: true });
    for (let i = 0; i < 3; i++) bx('flat', F, -2.6 - i * 0.2, 2.6 + i * 0.2, -0.3, 0.18 * (3 - i), FZ, FZ + 0.35 * (i + 1), { c: '#d8cfb8' });
    // twin bell towers on a wide baroque front
    if (style === 'baroque' && FW >= 20) {
      const TH = H * 1.18, TWd = 4.6;
      for (const s of [-1, 1]) {
        const TC = at(s * (FW / 2 - TWd / 2 - 0.2), 0, FZ - TWd / 2 + 0.05);
        for (const a of [0, PI / 2, PI, -PI / 2]) panel('cwWall', TWd, TH, { M: mul(mul(TC, rotY(a)), tr(0, 0, TWd / 2 + 0.02)), uvk: [TWd / 4.5, TH / 12] });
        bx('flat', TC, -TWd / 2 + 0.1, TWd / 2 - 0.1, 0, TH, -TWd / 2 + 0.1, TWd / 2 - 0.1, { c: '#cfc7b3', noao: true });
        for (const [ya, yb] of [[TH * 0.4, TH * 0.4 + 0.5], [TH - 1.4, TH - 0.8]]) bx('flat', TC, -TWd / 2 - 0.25, TWd / 2 + 0.25, ya, yb, -TWd / 2 - 0.25, TWd / 2 + 0.25, { c: '#e6dec8' });
        lathe('lead', [[0, 0], [2.0, 0], [2.1, 0.4], [1.8, 1.3], [1.2, 2.3], [0.5, 3.2], [0.15, 3.9], [0, 4.1]], 8, { M: mul(TC, tr(0, TH, 0)), c: '#9aa09a', noao: true });
        bx('flat', TC, -0.08, 0.08, TH + 4.0, TH + 5.2, -0.08, 0.08, { c: '#3e3a36', noao: true });
      }
    }
    // a lead dome with a lantern on a large baroque church: at the point behind the front with the most room
    if (style === 'baroque' && bd > 18 && hash(hc, 2) < 0.7) {
      let best = null;
      for (let z = -6; z > -bd + 3; z -= 2) for (let x = -FW / 3; x <= FW / 3; x += 2) { if (!inPoly(loc, x, z)) continue; const c = clearance(loc, x, z); if (!best || c > best.c) best = { c, x, z }; }
      if (best && best.c >= 3.6) {
        const R = Math.min(best.c - 0.6, 6.5), base = Math.max(ridge - 1, EAVE + 1);
        const D = at(best.x, base, best.z);
        cyl('cwWall', R, R, R * 0.8, 14, { M: D, uvk: [R * 6.28 / 4.5, 0.8 * R / 12], c: '#e6dec8', noao: true });
        lathe('lead', [[0, 0], [R + 0.25, 0], [R + 0.3, 0.25], [R * 0.98, 0.5], [R * 0.8, R * 0.38], [R * 0.45, R * 0.72], [R * 0.2, R * 0.88], [0, R * 0.92]], 14, { M: mul(D, tr(0, R * 0.8, 0)), c: '#9aa09a', noao: true });
        cyl('flat', R * 0.17, R * 0.17, R * 0.5, 8, { M: mul(D, tr(0, R * 0.8 + R * 0.9, 0)), c: '#e0d8c2', noao: true });
        lathe('lead', [[0, 0], [R * 0.22, 0], [R * 0.12, R * 0.3], [0, R * 0.42]], 8, { M: mul(D, tr(0, R * 0.8 + R * 1.4, 0)), c: '#9aa09a', noao: true });
        bx('flat', D, -0.07, 0.07, R * 0.8 + R * 1.8, R * 0.8 + R * 2.5, -0.07, 0.07, { c: '#3e3a36', noao: true });
      }
    }
    const o = end(name);
    o.userData.solids = [[flat, null, y0 + EAVE]];
    return o;
  };
  const c = toW(0, -Math.min(bd, 30) / 2);
  return { name, x: c[0], z: c[1], radius: Math.max(40, bd * 0.7 + FW * 0.4), skipIds: [id], build };
}
export const CHURCHES = CHURCH_DATA.map(makeChurch);
