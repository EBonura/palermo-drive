// City landmarks, batch O: three Palermo churches drawn from reference photos. Registered in src/landmarks-city.js as BATCH_O.
// Chiesa di Terrasanta (w45407453) is not in this batch: no photograph of its exterior was found on Wikimedia Commons (searched by name and in the Palermo church categories; the only hits are a Bordighera church
// and the district map). It was built later, from Mapillary frames, in src/lmc-batchR.js.
// Reference photos (Wikimedia Commons, looked at, nothing copied; only proportions and colours read):
//  San Gioacchino all'Olivella: "San Gioacchino all'Olivella.jpg" (the whole front from the street). Read: a narrow front of golden calcarenite in two orders. Lower order: a rusticated corner pilaster each side with a Corinthian capital,
//  a second pilaster inside it, a framed double door of panelled wood under a triangular pediment, an oval relief of the saint in clouds over it, a broken segmental pediment as the lower entablature. Upper order narrower: pilasters, one framed window,
//  two round windows (one high right, one low left), a mixtilinear top with a round window, a volute each side, a finial and a cross. Width 9.6 m (footprint), baked height 19.4 m, so about two widths tall.
//  Side walls are not visible in the photo: plain stone-coloured plaster, nave gable roof behind the upper order (assumed).
//  Santo Stefano Protomartire (Zisa): "Palermo - Chiesa Santo Stefano protomartire - 2025-09-28 22-32-07 001.jpg", "... 002.jpg", "Santo Stefano Protomartire (Palermo) 19 06 2026 32.jpg", "... 33.jpg", "... 27.jpg".
//  Read: a front 16.4 m wide in sandstone ochre with white plaster panels, in two orders. Lower order: a wide corner pilaster group each end, a pilaster each side of the centre, two plaster panels each holding a framed niche with a statue,
//  a central portal with a curved-top door, an aedicule with a small statue and a broken pediment over it, an entablature all across. Upper order: a narrow central block (about 0.45 of the width) with a plaster panel, one framed window,
//  stone pilasters each side, an entablature, a segmental cap with a shell, a cross; at each side a stepped parapet with a big stone scroll and pinecone finials. Side wall of the nave: white plaster, tall stone pilasters with finials, blind arched windows
//  high up; a low brown dome on a white drum behind the nave (seen from the south-east). Heights are estimated from the photos (parapet 0.45 of the width, central block top 0.66, cap 0.78); the roof behind is assumed.
//  Chiesa del Santissimo Crocifisso all'Albergheria (ruin): Mapillary frames 226364616169657, 263625822058112, 565034704637546, 2750871075202760 and 121555313558242 (2021-08, views from the north-east
//  and along the street) and the 25 cm orthophoto of the Regione Siciliana. Read: pale broken walls; a tall fragment on the side towards the pitch with a large painted San Benedetto il Moro, stepped and
//  jagged on its left; behind a new low wall of pale blocks a plastered wall with two round arches; old brown tufa along the street, higher at the far corner with pilaster remains.
//  Not verified: the wall tops are followed by eye; the north-west and south-west sides are not seen (low broken walls); the pitch and its chain-link fence outside the footprint are not built.
import * as THREE from 'three';
import { PI, bx, sphere, cyl, panel, extrude, prism, begin, end, defMat, mul, tr, frame, groundY, initShared, noiseDots, streaks, pairsOf, groundRange, gable, statue, paintAshlar, RNG } from './lmc-kit.js';

// ---- shared helpers
function mk(m, n) {
  const toWorld = (x, z) => [m[0] + x * n[1] + z * n[0], m[1] - x * n[0] + z * n[1]];
  const toLocal = (p) => { const dx = p[0] - m[0], dz = p[1] - m[1]; return [dx * n[1] - dz * n[0], dx * n[0] + dz * n[1]]; };
  const clipFront = (pts, zmax) => {
    const L = pts.map(toLocal), out = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length], fa = zmax - a[1], fb = zmax - b[1];
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    return out.map(q => toWorld(q[0], q[1]));
  };
  return { toWorld, toLocal, clipFront, ring: (x0, x1, z0, z1) => [toWorld(x0, z0), toWorld(x1, z0), toWorld(x1, z1), toWorld(x0, z1)].flat() };
}
// painting context: canvas w x h covers FW x FH metres, x centred, y up from the ground
function ctx2(g, w, h, FW, FH) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), r * sx, r * sy, 0, 0, 2 * PI); g.fill(); };
  const pil = (x, y0, y1, ww, c, hi, lo) => {
    R(x - ww / 2, y0, x + ww / 2, y1, c); R(x - ww / 2, y0, x - ww / 2 + 0.1, y1, 'rgba(255,238,195,0.32)'); R(x + ww / 2 - 0.12, y0, x + ww / 2, y1, 'rgba(60,35,20,0.34)');
    R(x - ww / 2 - 0.15, y1 - 0.5, x + ww / 2 + 0.15, y1, hi); R(x - ww / 2 - 0.1, y0, x + ww / 2 + 0.1, y0 + 0.4, hi);
  };
  return { sx, sy, X, Y, R, arch, tri, circ, pil };
}
// wear: soot streaks from the ledges, a soft stain or two, grime at the foot
function wear(g, w, h, seed, n = 34) {
  const r = RNG(seed);
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h, rad = (0.15 + r() * 0.25) * Math.max(w, h), gr = g.createRadialGradient(x, y, 1, x, y, rad), k = r() < 0.6 ? '60,42,25' : '255,246,225'; gr.addColorStop(0, `rgba(${k},${0.1 + r() * 0.08})`); gr.addColorStop(1, `rgba(${k},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  streaks(g, w, h, n, seed + 3, 0.12, h * 0.3, '60,44,30');
  const gb = g.createLinearGradient(0, h, 0, h * 0.8); gb.addColorStop(0, 'rgba(40,28,18,0.3)'); gb.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = gb; g.fillRect(0, h * 0.8, w, h * 0.2);
}
const DARK = '#1b1612', GLASS = '#2b3540';
function lowest(pts) { return groundRange(pts).lo; }

// =====================================================================================================
// San Gioacchino all'Olivella. Frame: origin on the ground in the middle of the front, +z out of the front (north-west), local x along the front.
// =====================================================================================================
const SG = { id: 'w279888077', p: [-83.9, -394.8, -73.4, -403.9, -72.7, -404.5, -69.5, -403.9, -66.2, -400.3, -66.2, -397.3, -77.5, -387.7, -82.7, -383.2, -85.5, -380.8, -92.3, -387.6, -89.1, -390.4] };
const SGM = mk([-88.9, -384.2], [-0.707, 0.707]);
const SGW = 9.6, SGLOW = 8.4, SGUP = 15.0, SGTOP = 18.4, SGH = 19.0, SGNZ0 = -1.6, SGNZ1 = -22, SGNW = 3.0, SGRISE = 2.4;
const SGSTN = '#cda66a', SGHI = '#dcbb82';
function sgFront(g, w, h) {
  const c = ctx2(g, w, h, SGW, SGH), { R, tri, arch, circ, pil, X, Y, sx } = c;
  paintAshlar(g, w, h, SGW, SGH, 0.6, 1.2, SGSTN, '#a98650', 8101, 1.2, 0.07);
  noiseDots(g, w, h, w * h / 50, 2, 8102, ['rgba(150,100,50,0.08)', 'rgba(255,240,200,0.07)']);
  R(-SGW / 2, 0, SGW / 2, 0.6, '#a58a60');
  // lower order: corner pilasters, inner pilasters
  for (const s of [-1, 1]) { pil(s * 4.1, 0.6, SGLOW - 1.0, 1.4, '#c19a5c', SGHI, '#9d7a46'); pil(s * 2.75, 0.6, SGLOW - 1.0, 0.8, '#c9a266', SGHI, '#9d7a46'); R(s * 3.45 - 0.45, 1.6, s * 3.45 + 0.45, 6.4, 'rgba(120,88,48,0.2)'); }
  // door: framed, panelled wood, triangular pediment, the oval relief with clouds
  R(-1.75, 0.6, 1.75, 5.2, '#b8935a'); R(-1.35, 0.6, 1.35, 4.9, '#7b5733');
  for (let yy = 0.9; yy < 4.7; yy += 0.9) for (const xx of [-1.2, 0.05]) R(xx, yy, xx + 1.1, yy + 0.72, 'rgba(40,26,14,0.28)');
  R(-0.04, 0.6, 0.04, 4.9, '#2a1d12'); tri(-2.1, 2.1, 5.2, 1.05, SGHI); tri(-1.35, 1.35, 5.3, 0.6, SGSTN);
  g.fillStyle = '#a98456'; g.beginPath(); g.ellipse(X(0), Y(6.9), 0.95 * sx, 1.3 * c.sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#c9ad7c'; g.beginPath(); g.ellipse(X(0), Y(6.9), 0.78 * sx, 1.1 * c.sy, 0, 0, 2 * PI); g.fill(); R(-0.5, 6.2, 0.5, 7.6, 'rgba(120,92,58,0.35)');
  // lower entablature and the broken segmental pediment
  R(-SGW / 2 - 0.0, SGLOW - 1.0, SGW / 2, SGLOW, '#c19a5c'); R(-SGW / 2, SGLOW - 0.35, SGW / 2, SGLOW, SGHI); R(-SGW / 2, SGLOW - 1.0, SGW / 2, SGLOW - 0.85, 'rgba(60,35,20,0.4)');
  g.fillStyle = '#e0bf86'; g.strokeStyle = 'rgba(70,45,20,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(-4.5), Y(SGLOW)); g.quadraticCurveTo(X(-2.2), Y(SGLOW + 2.4), X(-0.4), Y(SGLOW + 1.9)); g.lineTo(X(-0.4), Y(SGLOW + 1.3)); g.quadraticCurveTo(X(-2.2), Y(SGLOW + 1.7), X(-3.9), Y(SGLOW)); g.fill();
  g.beginPath(); g.moveTo(X(4.5), Y(SGLOW)); g.quadraticCurveTo(X(2.2), Y(SGLOW + 2.4), X(0.4), Y(SGLOW + 1.9)); g.lineTo(X(0.4), Y(SGLOW + 1.3)); g.quadraticCurveTo(X(2.2), Y(SGLOW + 1.7), X(3.9), Y(SGLOW)); g.fill();
  // upper order: pilasters, window with a shaped frame, two round windows, a round window in the top
  for (const s of [-1, 1]) pil(s * 3.2, SGLOW + 0.4, SGUP - 0.7, 0.8, '#c19a5c', SGHI, '#9d7a46');
  R(-3.9, SGUP - 0.7, 3.9, SGUP + 0.1, SGHI);
  R(-1.25, 10.9, 1.25, 14.0, '#b8935a'); R(-0.95, 11.2, 0.95, 13.7, GLASS); R(-0.04, 11.2, 0.04, 13.7, '#6b5438'); for (const y of [12.0, 12.9]) R(-0.95, y, 0.95, y + 0.07, '#6b5438');
  tri(-1.5, 1.5, 14.0, 0.7, SGHI);
  circ(2.3, 13.0, 0.95, '#b8935a'); circ(2.3, 13.0, 0.72, GLASS); circ(-2.4, 10.8, 0.8, '#b8935a'); circ(-2.4, 10.8, 0.58, GLASS);
  circ(0, SGUP + 1.9, 0.9, '#b8935a'); circ(0, SGUP + 1.9, 0.65, GLASS);
  for (const y of [SGLOW + 0.05, SGUP + 0.1]) { const gs = g.createLinearGradient(0, Y(y - 0.6), 0, Y(y - 2.2)); gs.addColorStop(0, 'rgba(60,35,15,0.3)'); gs.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y - 0.6), w, 1.6 * c.sy); }
  wear(g, w, h, 8103, 40);
}
function sgWall(g, w, h) {
  g.fillStyle = '#d5bb86'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 50, 2, 8111, ['rgba(150,110,60,0.1)', 'rgba(255,245,215,0.08)', 'rgba(110,80,40,0.07)']);
  g.fillStyle = '#b98f58'; g.fillRect(0, 0, w * 0.1, h); g.fillRect(w * 0.9, 0, w * 0.1, h);
  wear(g, w, h, 8112, 12);
}
function buildSanGioacchino() {
  initShared();
  const pts = pairsOf(SG.p), gr = groundRange(pts), M = SGM, W = M.toWorld;
  const y0 = Math.min(groundY(...W(-4, 2)), groundY(...W(4, 2)), groundY(...W(0, 3)));
  const F = frame(-88.9, y0, -384.2, -0.707, 0.707), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bosgFront', 224, 384, [SGW, SGH], sgFront);
  defMat('bosgWall', 128, 192, [4.5, SGLOW], sgWall);
  begin(y0);
  const body = M.clipFront(pts, -0.1);
  prism('bosgWall', body, Math.min(gr.lo, y0) - 1.5, y0 + SGLOW, { uvo: [0, -y0 / SGLOW] });
  prism('flat', body, y0 + SGLOW, y0 + SGLOW + 0.12, { c: '#a39a8c' });
  const NT = SGUP - 0.2;
  bx('bosgWall', F, -SGNW, SGNW, SGLOW, NT, SGNZ0, SGNZ1, { uvo: [0, -(y0 + SGLOW) / SGLOW] });
  gable('tile', 'bosgWall', at(0, 0, (SGNZ0 + SGNZ1) / 2), SGNW * 2, SGNZ0 - SGNZ1, NT, SGRISE, { ov: 0.3, c: '#b8744f', wc: '#d5bb86' });
  const hw = SGW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, SGLOW); s.lineTo(4.3, SGLOW); s.lineTo(4.3, SGLOW + 0.5); s.bezierCurveTo(4.1, SGLOW + 1.4, 3.9, SGLOW + 2.6, 3.8, SGUP - 0.2);
  s.lineTo(3.9, SGUP + 0.1); s.bezierCurveTo(3.7, SGUP + 1.0, 2.6, SGUP + 1.9, 1.2, SGUP + 2.7); s.lineTo(0.9, SGUP + 3.0); s.lineTo(0.9, SGTOP); s.lineTo(-0.9, SGTOP); s.lineTo(-0.9, SGUP + 3.0); s.lineTo(-1.2, SGUP + 2.7);
  s.bezierCurveTo(-2.6, SGUP + 1.9, -3.7, SGUP + 1.0, -3.9, SGUP + 0.1); s.lineTo(-3.8, SGUP - 0.2); s.bezierCurveTo(-3.9, SGLOW + 2.6, -4.1, SGLOW + 1.4, -4.3, SGLOW + 0.5); s.lineTo(-4.3, SGLOW); s.lineTo(-hw, SGLOW); s.lineTo(-hw, 0);
  extrude('bosgFront', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / SGW, 1 / SGH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.25, hw + 0.25, SGLOW - 0.3, SGLOW + 0.15, -1.35, 0.55, { c: '#d2ae74', noao: true });
  bx('flat', F, -4.2, 4.2, SGUP - 0.15, SGUP + 0.2, -1.35, 0.4, { c: '#d2ae74', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 4.1 - 0.7, sg * 4.1 + 0.7, 0.6, SGLOW - 0.95, -0.05, 0.28, { c: '#c19a5c', noao: true });
    bx('flat', F, sg * 2.75 - 0.4, sg * 2.75 + 0.4, 0.6, SGLOW - 0.95, -0.05, 0.2, { c: '#c9a266', noao: true });
    bx('flat', F, sg * 3.2 - 0.4, sg * 3.2 + 0.4, SGLOW + 0.4, SGUP - 0.7, -0.05, 0.2, { c: '#c19a5c', noao: true });
    sphere('flat', 0.4, { M: at(sg * 3.7, SGUP + 0.6, -0.3), seg: 6, c: '#d2ae74' });
  }
  bx('stone', F, -1.6, 1.6, -0.15, 0.2, -0.05, 0.55, { c: '#cbb48c' }); bx('stone', F, -1.9, 1.9, 4.9, 5.2, -0.05, 0.3, { c: '#d2ae74' });
  bx('flat', F, -0.1, 0.1, SGTOP, SGTOP + 1.6, -0.8, -0.55, { c: '#4a4036', noao: true }); bx('flat', F, -0.5, 0.5, SGTOP + 0.9, SGTOP + 1.05, -0.8, -0.55, { c: '#4a4036', noao: true });
  const o = end('Chiesa di San Gioacchino');
  o.userData.solids = [[SG.p, null, y0 + SGLOW], [M.ring(-SGNW, SGNW, SGNZ1, SGNZ0), null, y0 + NT + SGRISE]];
  return o;
}

// =====================================================================================================
// Santo Stefano Protomartire (Zisa). Frame: origin on the ground in the middle of the front, +z out of the front (west).
// =====================================================================================================
const ST = { id: 'w552861821', p: [-1750.7, -51.9, -1734.4, -48.7, -1733.6, -52.9, -1724.6, -51.1, -1724.8, -50.2, -1715.1, -48.3, -1715.1, -45.3, -1706.5, -43.6, -1709.5, -31.7, -1714.7, -33, -1715.7, -31.4, -1721.1, -32.5, -1721.9, -28.3, -1727.4, -29.3, -1728.3, -25, -1738.5, -27, -1737.3, -32.7, -1753.9, -35.9] };
const STM = mk([-1752.3, -43.9], [-0.981, -0.196]);
const STW = 16.4, STLOW = 7.2, STPAR = 8.1, STUP = 10.9, STH = 13.6, STEAVE = 9.8, STNW = 8.2;
const STSTN = '#c9a05a', STHI = '#dcb97c', STPL = '#e6e2d2';
function stFront(g, w, h) {
  const c = ctx2(g, w, h, STW, STH), { R, tri, arch, circ, pil, X, Y } = c;
  paintAshlar(g, w, h, STW, STH, 0.5, 1.2, STSTN, '#8f6c38', 8201, 1.2, 0.08);
  noiseDots(g, w, h, w * h / 50, 2, 8202, ['rgba(150,100,40,0.09)', 'rgba(255,238,190,0.08)']);
  R(-STW / 2, 0, STW / 2, 1.1, '#8e7048');
  // lower order: plaster panels with niches, pilasters between
  const panel = (x0, x1) => { R(x0, 1.3, x1, 6.4, STPL); R(x0, 1.3, x1, 1.55, 'rgba(60,45,30,0.18)'); };
  panel(-6.1, -3.4); panel(3.4, 6.1); panel(-2.3, 2.3);
  for (const s of [-1, 1]) {
    const nx = s * 4.75;
    R(nx - 0.95, 1.9, nx + 0.95, 6.0, STSTN); arch(nx, 2.0, 5.0, 1.5, '#b08a50'); arch(nx, 2.2, 4.8, 1.1, '#8a8478'); tri(nx - 1.1, nx + 1.1, 5.3, 0.75, STHI); R(nx - 0.45, 1.5, nx + 0.45, 2.0, STHI);
  }
  for (const s of [-1, 1]) { pil(s * 2.95, 1.1, STLOW - 0.7, 0.9, '#bf9650', STHI, '#8f6c38'); for (const d of [0, 0.95]) pil(s * (6.55 + d), 1.1, STLOW - 0.7, 0.8, '#c4994f', STHI, '#8f6c38'); }
  // portal: curved-top door, frame, aedicule with a small statue and a broken pediment
  R(-1.55, 1.1, 1.55, 4.9, STSTN); arch(0, 1.1, 4.4, 2.2, '#5a3a22'); R(-0.03, 1.1, 0.03, 3.3, '#2a1d12'); R(-0.9, 1.1, 0.9, 1.9, '#c9b78a');
  R(-1.05, 4.7, 1.05, 6.6, STSTN); arch(0, 5.0, 6.3, 0.9, '#8a8478'); tri(-1.8, 0, 4.8, 0.5, STHI); tri(0, 1.8, 4.8, 0.5, STHI); circ(0, 7.0, 0.4, STHI);
  // lower entablature
  R(-STW / 2, STLOW - 0.8, STW / 2, STLOW, '#bf9650'); R(-STW / 2, STLOW - 0.3, STW / 2, STLOW, STHI); R(-STW / 2, STLOW - 0.8, STW / 2, STLOW - 0.68, 'rgba(60,35,20,0.4)');
  // upper order: the central block
  R(-3.7, STLOW, 3.7, STUP + 0.5, STSTN); R(-2.6, STLOW + 0.3, 2.6, STUP - 0.1, '#e1dccb');
  for (const s of [-1, 1]) pil(s * 3.15, STLOW, STUP - 0.1, 0.7, '#bf9650', STHI, '#8f6c38');
  R(-1.3, 7.7, 1.3, 9.4, STSTN); R(-0.95, 7.95, 0.95, 9.15, GLASS); R(-0.03, 7.95, 0.03, 9.15, '#6b5438'); R(-0.95, 8.55, 0.95, 8.6, '#6b5438'); R(-0.5, 9.4, 0.5, 9.7, STHI);
  R(-4.3, STUP - 0.05, 4.3, STUP + 0.6, STHI); R(-4.3, STUP - 0.05, 4.3, STUP + 0.1, 'rgba(60,35,20,0.35)');
  g.fillStyle = STHI; g.beginPath(); g.moveTo(X(-3.4), Y(STUP + 0.6)); g.bezierCurveTo(X(-3.2), Y(STUP + 1.9), X(-0.5), Y(STUP + 1.8), X(0), Y(STUP + 2.2)); g.bezierCurveTo(X(0.5), Y(STUP + 1.8), X(3.2), Y(STUP + 1.9), X(3.4), Y(STUP + 0.6)); g.fill();
  circ(0, STUP + 1.3, 0.5, '#bfa070');
  // the side wings: stepped parapet
  for (const s of [-1, 1]) { R(Math.min(s * 3.7, s * 8.2), STLOW, Math.max(s * 3.7, s * 8.2), STPAR + 0.3, STSTN); }
  for (const y of [STLOW, STUP]) { const gs = g.createLinearGradient(0, Y(y - 0.5), 0, Y(y - 2.1)); gs.addColorStop(0, 'rgba(60,35,15,0.3)'); gs.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gs; g.fillRect(0, Y(y - 0.5), w, 1.6 * c.sy); }
  wear(g, w, h, 8203, 44);
}
function stWall(g, w, h) {
  g.fillStyle = '#e8e1ce'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, w * h / 50, 2, 8211, ['rgba(150,120,70,0.09)', 'rgba(255,250,235,0.1)', 'rgba(110,90,60,0.07)']);
  const sx = w / 4.5, sy = h / STEAVE, Y = y => h - y * sy;
  g.fillStyle = '#c9a05a'; g.fillRect(0, 0, 0.75 * sx, h); g.fillStyle = 'rgba(60,35,20,0.3)'; g.fillRect(0.65 * sx, 0, 0.1 * sx, h);
  g.fillStyle = '#d8d0ba'; g.beginPath(); const cx = 2.6 * sx, r = 0.75 * sx; g.moveTo(cx - r, Y(5.0)); g.lineTo(cx - r, Y(7.3)); g.arc(cx, Y(7.3), r, PI, 0); g.lineTo(cx + r, Y(5.0)); g.fill();
  g.fillStyle = 'rgba(70,55,40,0.3)'; g.fillRect(cx - r, Y(5.0), 2 * r, 2);
  wear(g, w, h, 8212, 14);
}
function stDome(g, w, h) {
  g.fillStyle = '#8c6c56'; g.fillRect(0, 0, w, h); const r = RNG(8221);
  for (let y = 0; y < h; y += 6) { g.fillStyle = `rgba(${40 + r() * 30},${25 + r() * 20},18,0.28)`; g.fillRect(0, y, w, 2); }
  noiseDots(g, w, h, w * h / 30, 2, 8222, ['rgba(60,40,30,0.18)', 'rgba(200,160,130,0.16)']);
  streaks(g, w, h, 18, 8223, 0.18, h * 0.5, '50,40,30');
}
function buildStefano() {
  initShared();
  const pts = pairsOf(ST.p), gr = groundRange(pts), M = STM, W = M.toWorld;
  const y0 = Math.min(groundY(...W(-8, 2)), groundY(...W(8, 2)), groundY(...W(0, 3)));
  const F = frame(-1752.3, y0, -43.9, -0.981, -0.196), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('bostFront', 384, 320, [STW, STH], stFront);
  defMat('bostWall', 128, 256, [4.5, STEAVE], stWall);
  defMat('bostDome', 128, 128, [4, 4], stDome);
  begin(y0);
  const body = M.clipFront(pts, -0.1);
  prism('bostWall', body, Math.min(gr.lo, y0) - 1.5, y0 + STEAVE, { uvo: [0, -y0 / STEAVE] });
  prism('flat', body, y0 + STEAVE, y0 + STEAVE + 0.12, { c: '#a39a8c' });
  gable('tile', 'bostWall', at(0, 0, -8.8), STNW * 2, 15.4, STEAVE, 1.5, { ov: 0.25, c: '#b8744f', wc: '#e8e1ce' });
  // the dome on a white drum over the crossing
  const dx = 0.7, dz = -21.8;
  cyl('bostWall', 4.0, 4.3, 3.0, 14, { M: at(dx, STEAVE + 0.1, dz), c: '#e2dccb' });
  let dy = STEAVE + 3.1;
  for (const [rb, rt, hh] of [[4.3, 4.0, 0.7], [4.0, 3.2, 0.8], [3.2, 2.2, 0.8], [2.2, 1.2, 0.7], [1.2, 0.6, 0.5]]) { cyl('bostDome', rt, rb, hh, 16, { M: at(dx, dy, dz), c: '#ffffff' }); dy += hh; }
  cyl('bostWall', 0.5, 0.6, 0.9, 8, { M: at(dx, dy, dz), c: '#e2dccb' }); sphere('bostDome', 0.55, { M: at(dx, dy + 1.0, dz), seg: 8, c: '#ffffff' });
  const hw = STW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, STPAR); s.lineTo(7.3, STPAR + 0.4); s.lineTo(5.7, STPAR + 0.4); s.bezierCurveTo(5.0, STPAR + 0.5, 4.5, STPAR + 1.6, 3.9, STUP - 0.4); s.lineTo(4.3, STUP + 0.6);
  s.lineTo(3.4, STUP + 0.6); s.bezierCurveTo(3.2, STUP + 1.9, 0.6, STUP + 1.8, 0, STUP + 2.3); s.bezierCurveTo(-0.6, STUP + 1.8, -3.2, STUP + 1.9, -3.4, STUP + 0.6); s.lineTo(-4.3, STUP + 0.6);
  s.lineTo(-3.9, STUP - 0.4); s.bezierCurveTo(-4.5, STPAR + 1.6, -5.0, STPAR + 0.5, -5.7, STPAR + 0.4); s.lineTo(-7.3, STPAR + 0.4); s.lineTo(-hw, STPAR); s.lineTo(-hw, 0);
  extrude('bostFront', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / STW, 1 / STH], uvo: [0.5, 0], cs: 8, noao: true });
  bx('flat', F, -hw - 0.3, hw + 0.3, STLOW - 0.3, STLOW + 0.15, -1.35, 0.55, { c: '#d2ae74', noao: true });
  bx('flat', F, -4.5, 4.5, STUP - 0.1, STUP + 0.25, -1.35, 0.5, { c: '#d2ae74', noao: true });
  for (const sg of [-1, 1]) {
    bx('flat', F, sg * 2.95 - 0.45, sg * 2.95 + 0.45, 1.1, STLOW - 0.75, -0.05, 0.28, { c: '#bf9650', noao: true });
    for (const d of [0, 0.95]) bx('flat', F, sg * (6.55 + d) - 0.4, sg * (6.55 + d) + 0.4, 1.1, STLOW - 0.75, -0.05, 0.25 + d * 0.15, { c: '#c4994f', noao: true });
    bx('flat', F, sg * 3.15 - 0.35, sg * 3.15 + 0.35, STLOW, STUP - 0.1, -0.05, 0.22, { c: '#bf9650', noao: true });
    statue('flat', at(sg * 4.75, 2.1, 0.0), 2.2, { c: '#e6e2d6' });
    sphere('flat', 0.55, { M: at(sg * 7.2, STPAR + 0.8, -0.4), seg: 6, c: '#c9a05a' }); sphere('flat', 0.4, { M: at(sg * 6.2, STPAR + 0.7, -0.4), seg: 6, c: '#c9a05a' });
    sphere('flat', 0.5, { M: at(sg * 4.6, STPAR + 2.2, -0.4), seg: 6, c: '#c9a05a', ky: 1.4 });
  }
  bx('stone', F, -1.5, 1.5, -0.2, 0.25, -0.05, 0.7, { c: '#cdb996' });
  statue('flat', at(0, 4.9, 0.0), 1.4, { c: '#e6e2d6' });
  bx('flat', F, -0.1, 0.1, STUP + 2.3, STUP + 4.0, -0.8, -0.55, { c: '#4a4036', noao: true }); bx('flat', F, -0.5, 0.5, STUP + 3.1, STUP + 3.25, -0.8, -0.55, { c: '#4a4036', noao: true });
  const o = end('Parrocchia Santo Stefano Protomartire');
  o.userData.solids = [[ST.p, null, y0 + STEAVE], [M.ring(-STNW, STNW, -16.0, -1.4), null, y0 + STEAVE + 1.5], [M.ring(-3.6, 4.8, -26.2, -17.4), null, y0 + STEAVE + 6.5]];
  return o;
}

// =====================================================================================================
// Chiesa del Santissimo Crocifisso all'Albergheria: a roofless ruin. Frames on the two mapped edges seen in the photos: the north-east one towards the pitch and the south-east one on the street.
// =====================================================================================================
const CR = { id: 'w279887578', p: [-330.4, 644.5, -315, 663.5, -326.2, 670.3, -335.7, 657.3, -333.3, 655.7, -332.9, 653.7, -334.4, 651.8, -336.3, 649.5] };
// weathered pale plaster over masonry: where it has fallen the ochre stones show, with dark holes and rain streaks
function crPlaster(g, w, h) {
  const r = RNG(8301), wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, 900, 3, 8302, ['rgba(120,100,76,0.16)', 'rgba(250,244,228,0.22)']);
  for (let i = 0; i < 11; i++) {   // fallen plaster: a ragged patch of small stones
    const x = r() * w, y = r() * h, rx = 10 + r() * 30, ry = 8 + r() * 22, out = [];
    for (let k = 0; k < 11; k++) { const a = k / 11 * 2 * PI, f = 0.6 + r() * 0.65; out.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]); }
    const stones = []; for (let k = 0; k < 40; k++) stones.push([x + (r() - 0.5) * rx * 2.4, y + (r() - 0.5) * ry * 2.4, 4 + r() * 8, 3 + r() * 4, r()]);
    wrap(() => { g.save(); g.beginPath(); out.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fillStyle = '#8f7a5c'; g.fill(); g.clip();
      for (const [a, b, c, d, k] of stones) { g.fillStyle = k < 0.45 ? '#b39a70' : k < 0.75 ? '#a5744e' : '#c4b28c'; g.fillRect(a, b, c, d); } g.restore(); g.strokeStyle = 'rgba(70,55,36,0.45)'; g.lineWidth = 1.2; g.beginPath(); out.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke(); });
  }
  for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h; g.fillStyle = 'rgba(30,22,16,0.7)'; g.fillRect(x, y, 3 + r() * 3, 3 + r() * 3); }
  streaks(g, w, h, 20, 8303, 0.14, h * 0.45, '60,52,42');
}
// the newer wall of small pale blocks that closes the ruin towards the pitch
function crBlock(g, w, h) { paintAshlar(g, w, h, 2, 2, 0.25, 0.42, '#cbbb93', '#9d8f72', 8304, 1.2, 0.09); streaks(g, w, h, 6, 8305, 0.08, h * 0.4, '70,56,38'); }
// the mural on the standing wall: San Benedetto il Moro in a white habit, a white halo, on a yellow ground, the name lettered at the sides
function crMural(g, w, h) {
  const FW = 6, FH = 13.3, X = (m) => m / FW * w, Y = (m) => h - m / FH * h, r = RNG(8306);
  g.fillStyle = '#cba95c'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 700, 2.5, 8307, ['rgba(120,90,40,0.18)', 'rgba(240,220,160,0.18)']);
  const P = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fill(); };
  const E = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), X(rx), ry / FH * h, 0, 0, 2 * PI); g.fill(); };
  E(3.0, 11.15, 1.85, 1.85, '#e9ebe6'); E(3.0, 11.15, 1.6, 1.6, '#d3dad9');
  // habit: shoulders, wide sleeves, the long skirt
  P([[1.5, 0.3], [4.5, 0.3], [4.15, 4.2], [4.3, 6.2], [5.3, 7.4], [4.7, 9.0], [3.7, 9.8], [2.4, 9.8], [1.3, 9.1], [0.75, 7.3], [1.5, 5.8], [1.9, 4.2]], '#e4e8ea');
  P([[1.35, 8.6], [0.75, 7.3], [1.9, 5.6], [3.9, 6.9], [3.5, 7.9], [2.2, 7.2]], '#b9c8d4');
  for (const [a, b, c] of [[2.2, 2.45, 5.6], [2.95, 3.05, 6.2], [3.75, 3.55, 5.5]]) P([[a - 0.07, 0.3], [a + 0.09, 0.3], [b + 0.04, c], [b - 0.04, c]], '#b4c2cd');
  g.strokeStyle = '#4c5864'; g.lineWidth = 1.6; g.beginPath(); [[1.5, 0.3], [1.9, 4.2], [1.5, 5.8], [0.75, 7.3], [1.3, 9.1], [2.4, 9.8]].forEach((q, k) => k ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke();
  // head, hair, neck, and the raised hand
  P([[2.6, 9.5], [3.5, 9.5], [3.4, 10.2], [2.7, 10.2]], '#4a2e22'); E(3.0, 11.05, 1.0, 1.15, '#231a18'); E(3.05, 10.8, 0.7, 0.9, '#5a382a');
  for (const x of [2.75, 3.35]) E(x, 10.95, 0.11, 0.07, '#1d1210'); P([[2.75, 10.25], [3.35, 10.25], [3.05, 10.12]], '#2c1a14');
  P([[2.75, 7.3], [3.35, 7.15], [3.75, 8.1], [3.6, 9.15], [3.42, 9.15], [3.36, 8.45], [3.1, 8.75], [2.65, 8.05]], '#4e3024');
  g.fillStyle = '#3b2f22'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(0.46 / FH * h)}px sans-serif`;
  ['SAN', 'BENE', 'DETTO'].forEach((t, k) => g.fillText(t, X(0.72), Y(10.35 - k * 0.55), X(1.3))); ['IL', 'MORO'].forEach((t, k) => g.fillText(t, X(5.25), Y(10.1 - k * 0.55), X(1.3)));
  streaks(g, w, h, 12, 8308, 0.1, h * 0.3, '70,52,30');
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(150,130,96,0.55)'; g.beginPath(); g.ellipse(r() * w, Y(r() * 1.4), 4 + r() * 12, 3 + r() * 8, 0, 0, 7); g.fill(); }
}
function buildCrocifisso() {
  initShared();
  const pts = pairsOf(CR.p), gr = groundRange(pts), r = RNG(8311), y0 = gr.avg;
  defMat('bocrPlaster', 256, 256, [4.6, 4.6], crPlaster);
  defMat('bocrBlock', 128, 128, [2, 2], crBlock);
  defMat('bocrMural', 192, 384, [6, 13.3], crMural);
  begin(y0);
  // a floor of rubble and earth inside, level with the lowest ground
  prism('flat', pts, gr.lo - 1.0, y0 + 0.15, { c: '#6f624c' });
  // a standing piece of wall: its ragged outline as [s, height] along the frame's x, th thick behind the plane z
  const wall = (key, F, prof, z, th, c, holes = []) => {
    const sh = new THREE.Shape(); sh.moveTo(prof[0][0], -1.2); for (const [a, b] of prof) sh.lineTo(a, b); sh.lineTo(prof[prof.length - 1][0], -1.2);
    for (const [hx, hw, spring] of holes) { const p = new THREE.Path(); p.moveTo(hx - hw / 2, 0); p.lineTo(hx - hw / 2, spring); p.absarc(hx, spring, hw / 2, PI, 0, true); p.lineTo(hx + hw / 2, 0); p.lineTo(hx - hw / 2, 0); sh.holes.push(p); }
    extrude(key, sh, th, { M: mul(F, tr(0, 0, z - th)), c });
  };
  // north-east side, towards the pitch: origin at the street corner, x towards the north corner
  const NE = frame(-315.0, y0, 663.5, 0.777, -0.630);
  wall('bocrBlock', NE, [[0, 3.35], [7.7, 3.35]], 0, 0.5);
  bx('flat', NE, 0, 7.75, 3.35, 3.47, -0.55, 0.05, { c: '#b8ab8c', noao: true });
  // the tall surviving fragment that carries the mural, broken in steps on its left, then lower rough walling to the north corner
  wall('bocrPlaster', NE, [[5.5, 4.6], [6.0, 6.2], [6.7, 6.4], [6.5, 7.5], [7.4, 8.1], [7.2, 9.4], [8.3, 10.2], [8.2, 11.5], [9.2, 12.4], [9.3, 13.7], [10.6, 14.5], [12.6, 14.25], [14.2, 14.7], [15.3, 14.1], [15.75, 13.2]], -0.52, 0.8);
  panel('bocrMural', 6, 13.3, { M: mul(NE, tr(12.6, 0.35, -0.5)) });
  wall('tufa', NE, [[15.75, 10.4], [16.3, 11.2], [16.9, 9.7], [17.2, 10.3], [17.7, 8.4], [18.6, 9.5], [19.0, 7.4], [19.5, 8.2], [20.7, 8.4], [21.0, 6.1], [21.8, 7.2], [22.7, 5.2], [23.3, 6.1], [23.9, 4.6], [24.4, 5.1]], -0.1, 0.75, '#8e8576');
  // broken stones left along the stepped edge
  for (const [a, b, k] of [[5.7, 5.1, 0.5], [6.35, 6.35, 0.4], [6.9, 7.65, 0.45], [7.6, 9.5, 0.35], [8.15, 10.7, 0.5], [8.8, 12.2, 0.4], [9.6, 13.9, 0.3]]) bx('tufa', mul(NE, tr(a, b, -0.95)), -k / 2, k / 2, -k / 2, k / 2, -0.3, 0.46, { c: '#a38f6c', rz: r() * 1.2 });
  // the plastered cross wall behind, with its two round arches: dark beyond them
  wall('bocrPlaster', NE, [[2.3, 6.1], [3.0, 7.2], [3.9, 8.0], [5.0, 7.4], [6.3, 8.8], [7.4, 8.0], [8.7, 8.6], [10.1, 9.5], [11.2, 8.1], [12.6, 8.8]], -5.2, 0.7, '#f4ecd8', [[5.0, 3.0, 4.6], [9.4, 3.0, 4.6]]);
  for (const hx of [5.0, 9.4]) {
    const ring = new THREE.Shape(); ring.absarc(0, 0, 1.85, 0, PI, false); ring.absarc(0, 0, 1.5, PI, 0, true);
    extrude('tufa', ring, 0.14, { M: mul(NE, tr(hx, 4.6, -5.22)), c: '#c2ab82', noao: true });
    panel('flat', 3.5, 6.2, { M: mul(NE, tr(hx, 0, -6.6)), c: '#241d16' });
  }
  // south-east side, on the street: old brown tufa, tall with remains of pilasters at the far (south) corner, falling towards the block wall
  const SE = frame(-326.2, y0, 670.3, 0.519, 0.855);
  wall('bocrPlaster', SE, [[0, 7.7], [0.5, 8.4], [1.1, 7.9], [1.7, 6.7], [2.4, 7.3], [3.0, 6.9], [3.5, 5.3], [4.4, 5.6], [5.2, 4.6], [6.6, 5.3], [7.3, 4.4], [8.1, 4.0], [9.0, 4.5], [10.0, 4.2], [11.0, 3.45], [13.05, 3.35]], -0.05, 0.7, '#8f7a5a');
  wall('tufa', SE, [[0, 2.6], [2.6, 2.9], [4.2, 2.2], [6.8, 3.1], [9.4, 2.5], [13.05, 3.2]], 0, 0.06, '#8c7654');
  for (const a of [0.45, 2.15]) { bx('tufa', SE, a - 0.28, a + 0.28, -0.8, 6.2, -0.1, 0.1, { c: '#a58c64' }); bx('tufa', SE, a - 0.4, a + 0.4, 5.9, 6.25, -0.1, 0.18, { c: '#a58c64' }); }
  // the other sides are not seen in the photos: low broken walls on the mapped edges
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area >= 0 ? 1 : -1;
  for (let i = 2; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), n = Math.max(2, Math.round(l / 1.6));
    const prof = []; for (let k = 0; k <= n; k++) prof.push([l * (k / n - 0.5), 2.6 + r() * 2.8]);
    wall(i % 2 ? 'bocrPlaster' : 'tufa', frame((A[0] + B[0]) / 2, y0, (A[1] + B[1]) / 2, sgn * dz / l, -sgn * dx / l), prof, 0, 0.6, i % 2 ? '#d8cdb4' : '#9c8668');
  }
  for (let i = 0; i < 9; i++) { const a = r() * 2 * PI, d = r() * 3.5; bx('flat', frame(-325.5 + Math.cos(a) * d, y0, 660 + Math.sin(a) * d, 0, 1), -0.5, 0.5, 0, 0.3 + r() * 0.6, -0.4, 0.4, { c: '#655844', ry: r() }); }
  for (const [x, z, k] of [[-323.5, 664.5, 1.0], [-327.5, 659.5, 0.8], [-320.5, 661.8, 0.6]]) sphere('flat', k, { p: [x, y0 + k * 0.4, z], c: '#56683a', ky: 0.8, seg: 6 });
  const o = end('Chiesa del Santissimo Crocifisso');
  o.userData.solids = [[CR.p, null, y0 + 3]];
  return o;
}

export const BATCH_O = [
  { name: 'Chiesa di San Gioacchino', x: -78, z: -393, radius: 36, skipIds: [SG.id], build: buildSanGioacchino },
  { name: 'Parrocchia Santo Stefano Protomartire', x: -1730, z: -40, radius: 57, skipIds: [ST.id, 'w279324258'], build: buildStefano },
  { name: 'Chiesa del Santissimo Crocifisso', x: -326, z: 657, radius: 29, skipIds: [CR.id], build: buildCrocifisso },
];
