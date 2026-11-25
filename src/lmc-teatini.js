// City landmark: the Chiesa di San Giuseppe dei Teatini (Corso Vittorio Emanuele, at the Quattro Canti, Palermo). Registered in src/landmarks-city.js.
// It replaces the OSM footprint w424559529. Frame F: origin on the ground in the middle of the corner front, +z out of the front (north-north-east, towards the crossing), local x along the front.
// Front direction from the footprint: the 15.6 m run of the outline facing the Quattro Canti, with the outline chamfered back 7 to 9 m on each side of it (the automatic detector chose the same run).
// Reference photos (Wikimedia Commons, looked at, nothing copied): San Giuseppe Teatini quinto canto.jpg (the corner front, close); Palermo-San-Giuseppe-dei-Teatini-bjs2007-01.jpg (the corner, the long side wall and the dome);
// San Giuseppe dei Teatini (Palermo) - Dome.jpg (inside of the dome only, no outside colours); Palermo - chiesa di San Giuseppe dei Teatini - 2026-09-24 13-47-43 001.JPG (fetched, not used).
// Read from the corner-front photo: a stone front in three orders, sandstone to warm cream. Lower order: heavy rusticated stone, a tall square portal with a triangular pediment (a cross medallion) between two free-standing grey columns, one barred window with a balustrade each side, an iron balcony across the whole width over a bracketed cornice.
// Middle order: two grey columns each side of a round-headed niche with the statue of San Gaetano (a statue also on the balcony), a tall shuttered window each side with a pediment, a cornice. Attic: a round-headed niche with a statue, a small shuttered window each side, paired pilasters, a curved top cornice with a round cartouche.
// From the corner photo: a long side wall in stone with small arched windows and a balustrade, and a dome with a drum of paired columns, in yellow majolica with blue-green chevrons, a lantern and a cross. The tile colours were taken from the photo and from the game's top-down view.
// Heights relative to the front width (15.5 m): balcony floor about 0.58, middle cornice about 1.05, top about 1.5. Not known and not drawn: the true concave shape of the front (the outline is flat, so the front stands flat), the nave gable in front of the dome (guessed), the dome's position along the nave (by eye), the iron work (a rail panel).
import * as THREE from 'three';
import { PI, bx, cyl, lathe, sphere, extrude, prism, begin, end, defMat, mul, tr, rotY, frame, groundY, initShared, paintAshlar, noiseDots, streaks, pairsOf, groundRange, gable, statue, rail } from './lmc-kit.js';

const TP = { id: 'w424559529', p: [28.5, 87.3, 41.1, 81.8, 48.6, 78.6, 44.9, 70.9, 32.2, 44.8, 19.4, 18.8, 14.8, 18.8, 12.5, 18.3, 10.8, 17.7, 6.8, 15.2, -7, 22.4, -6.6, 25.7, -8.7, 30.9, -12.5, 33.4, 4.8, 64.9, 13.3, 81.6, 21.4, 78, 24.9, 84.2] };
const O = [-0.075, 18.83], N = [-0.4627, -0.8865];
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
const FW = 15.5, FH = 24.0, BAL = 9.0, MID = 16.2, TOP = 22.0, EAVE = 17.0, NAVE_TOP = 21.0, NW = 8.5, NZ0 = -2.0, NZ1 = -52, RISE = 3.2, DZ = -36;
const SAND = '#c7ae82', CREAM = '#dcc79e', GREY = '#8f908a', GREEN = '#6c8a68', DARK = '#1a1511';

function paintFront(g, w, h) {
  const sx = w / FW, sy = h / FH, X = x => (x + FW / 2) * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  const tri = (x0, x1, y, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X((x0 + x1) / 2), Y(y + hh)); g.lineTo(X(x1), Y(y)); g.fill(); };
  const win = (x, y0, y1, ww, shut) => { R(x - ww / 2 - 0.3, y0 - 0.2, x + ww / 2 + 0.3, y1 + 0.2, '#e8dcc0'); R(x - ww / 2, y0, x + ww / 2, y1, shut); for (let y = y0 + 0.3; y < y1; y += 0.28) R(x - ww / 2, y, x + ww / 2, y + 0.06, 'rgba(0,0,0,0.22)'); R(x - 0.03, y0, x + 0.03, y1, 'rgba(0,0,0,0.35)'); tri(x - ww / 2 - 0.45, x + ww / 2 + 0.45, y1 + 0.2, 0.7, '#e8dcc0'); };
  // lower order: rusticated sandstone
  paintAshlar(g, w, h, FW, FH, 0.75, 1.9, '#bda37a', '#8f7a58', 7101, 1.2, 0.07);
  // the upper two orders: smooth warm plaster over the rustication
  R(-FW / 2, BAL, FW / 2, FH, CREAM); noiseDots(g, w, h, w * h / 70, 2, 7102, ['rgba(150,110,60,0.08)', 'rgba(255,245,215,0.1)']);
  for (let i = 0; i < 5; i++) { const cx = X(-6 + i * 3), cy = Y(10 + (i % 3) * 5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, 4 * sx); gr.addColorStop(0, 'rgba(150,110,60,0.14)'); gr.addColorStop(1, 'rgba(150,110,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // lower order: the portal (square, dark, pediment, medallion), two barred windows with balustrades
  R(-1.9, 0, 1.9, 6.3, '#d8c8a2'); R(-1.5, 0, 1.5, 5.9, DARK); R(-1.7, 5.9, 1.7, 6.3, '#d8c8a2'); tri(-2.6, 2.6, 6.3, 1.3, '#d8c8a2'); tri(-1.9, 1.9, 6.45, 0.85, '#bfa982'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(X(0), Y(7.0), 0.4 * sx, 0, 2 * PI); g.fill();
  for (const s of [-1, 1]) { const x = s * 5.3; R(x - 1.5, 2.8, x + 1.5, 6.6, '#d8c8a2'); R(x - 1.1, 3.2, x + 1.1, 6.2, '#272c33'); for (let k = -1; k <= 1; k++) R(x + k * 0.7 - 0.03, 3.2, x + k * 0.7 + 0.03, 6.2, '#8a8478'); R(x - 1.4, 1.4, x + 1.4, 3.0, '#d8c8a2'); for (let k = 0; k < 8; k++) R(x - 1.2 + k * 0.33, 1.6, x - 1.0 + k * 0.33, 2.8, '#eee4cc'); }
  // the bracketed cornice under the balcony
  R(-FW / 2, BAL - 1.3, FW / 2, BAL, '#c9b68e'); for (let x = -7.2; x < 7.4; x += 0.9) R(x, BAL - 1.3, x + 0.4, BAL - 0.2, 'rgba(60,40,20,0.35)'); R(-FW / 2, BAL - 1.4, FW / 2, BAL - 1.3, 'rgba(40,25,10,0.4)');
  // middle order
  for (const s of [-1, 1]) win(s * 5.5, 10.2, 14.6, 1.8, GREEN);
  arch(0, 9.6, 15.3, 2.5, '#e8dcc0'); arch(0, 9.8, 15.1, 2.1, '#6f6a60'); R(-0.6, 9.8, 0.6, 12.9, '#e2dccb'); R(-0.35, 12.9, 0.35, 13.7, '#e2dccb');
  R(-FW / 2, MID - 0.9, FW / 2, MID, '#e0d2b0'); R(-FW / 2, MID - 1.0, FW / 2, MID - 0.9, 'rgba(40,25,10,0.4)'); R(-FW / 2, MID, FW / 2, MID + 0.5, '#d0bd94');
  // attic
  for (const s of [-1, 1]) { R(s * 7.0 - 0.4, MID + 0.5, s * 7.0 + 0.4, TOP - 0.6, '#d9c59a'); R(s * 6.0 - 0.3, MID + 0.5, s * 6.0 + 0.3, TOP - 0.6, '#d9c59a'); win(s * 4.9, MID + 1.8, MID + 4.4, 1.5, GREEN); }
  arch(0, MID + 1.0, TOP - 0.7, 2.4, '#e8dcc0'); arch(0, MID + 1.2, TOP - 0.9, 2.0, '#6f6a60'); R(-0.5, MID + 1.2, 0.5, MID + 3.8, '#e2dccb');
  R(-FW / 2, TOP - 0.7, FW / 2, TOP, '#d0bd94'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(X(0), Y(TOP + 1.0), 1.5 * sx, 0.9 * sy, 0, 0, 2 * PI); g.fill(); g.fillStyle = '#bfa982'; g.beginPath(); g.ellipse(X(0), Y(TOP + 1.0), 1.15 * sx, 0.65 * sy, 0, 0, 2 * PI); g.fill();
  for (const y of [BAL - 1.4, MID - 1.0]) { const gs = g.createLinearGradient(0, Y(y), 0, Y(y - 1.4)); gs.addColorStop(0, 'rgba(40,25,10,0.3)'); gs.addColorStop(1, 'rgba(40,25,10,0)'); g.fillStyle = gs; g.fillRect(0, Y(y), w, 1.4 * sy); }
  streaks(g, w, h, 30, 7103, 0.1, 100, '60,45,30');
  const gb = g.createLinearGradient(0, Y(0), 0, Y(3)); gb.addColorStop(0, 'rgba(30,22,14,0.32)'); gb.addColorStop(1, 'rgba(30,22,14,0)'); g.fillStyle = gb; g.fillRect(0, Y(3), w, 3 * sy);
}
function paintWall(g, w, h, hm, win, seed) {   // a side bay, 4.5 m wide: sandstone ashlar, a pilaster half each edge, a small arched window, a cornice
  const sx = w / 4.5, sy = h / hm, X = x => x * sx, Y = y => h - y * sy;
  const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), (x1 - x0) * sx, (y1 - y0) * sy); };
  const arch = (x, y0, y1, ww, c) => { const r = ww / 2; g.fillStyle = c; g.beginPath(); g.moveTo(X(x - r), Y(y0)); g.lineTo(X(x - r), Y(y1 - r)); g.arc(X(x), Y(y1 - r), r * sx, PI, 0); g.lineTo(X(x + r), Y(y0)); g.fill(); };
  paintAshlar(g, w, h, 4.5, hm, 0.7, 1.7, '#c4ab80', '#917c5a', seed, 1.2, 0.07);
  R(0, 0, 0.55, hm, '#d4be94'); R(3.95, 0, 4.5, hm, '#d4be94');
  if (win) { arch(2.25, hm - 3.9, hm - 1.1, 1.5, '#e0d2b0'); arch(2.25, hm - 3.7, hm - 1.3, 1.1, '#272c33'); }
  else { R(0, 0, 4.5, 0.9, '#a58f68'); arch(2.25, 8.4, 12.6, 1.4, '#e0d2b0'); arch(2.25, 8.6, 12.4, 1.0, '#272c33'); arch(2.25, 2.6, 5.4, 1.0, '#272c33'); }
  R(0, hm - 0.8, 4.5, hm, '#dcc9a0'); R(0, hm - 1.2, 4.5, hm - 0.8, 'rgba(50,30,15,0.3)');
  streaks(g, w, h, 10, seed + 5, 0.1, 80, '60,45,30');
}

function buildTeatini() {
  initShared();
  const pts = pairsOf(TP.p), gr = groundRange(pts), W = toWorld;
  const y0 = Math.min(groundY(...W(-6, 1)), groundY(...W(6, 1)), groundY(...W(0, 2)));
  const F = frame(O[0], y0, O[1], N[0], N[1]), at = (x, y, z) => mul(F, tr(x, y, z));
  defMat('tbFront', 384, 512, [FW, FH], paintFront);
  defMat('tbBody', 128, 256, [4.5, EAVE], (g, w, h) => paintWall(g, w, h, EAVE, false, 7121));
  defMat('tbNave', 128, 128, [4.5, NAVE_TOP - EAVE], (g, w, h) => paintWall(g, w, h, NAVE_TOP - EAVE, true, 7131));
  defMat('tbDome', 128, 128, [1, 1], (g, w, h) => { g.fillStyle = '#e3b93a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f8f86'; for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(0, j * 32 + 20); g.lineTo(64, j * 32 + 4); g.lineTo(128, j * 32 + 20); g.lineTo(128, j * 32 + 32); g.lineTo(64, j * 32 + 16); g.lineTo(0, j * 32 + 32); g.fill(); } noiseDots(g, w, h, 300, 2, 7141, ['rgba(255,255,255,0.1)', 'rgba(40,30,0,0.1)']); });
  begin(y0);
  const body = clipFront(pts, -0.1);
  prism('tbBody', body, Math.min(gr.lo, y0) - 1.5, y0 + EAVE, { uvo: [0, -y0 / EAVE] });
  prism('flat', body, y0 + EAVE, y0 + EAVE + 0.12, { c: '#a39a8c' });
  bx('tbNave', F, -NW, NW, EAVE, NAVE_TOP, NZ0, NZ1, { uvo: [0, -(y0 + EAVE) / (NAVE_TOP - EAVE)] });
  for (const [z0, z1] of [[NZ0, DZ + 9.5], [DZ - 9.5, NZ1]]) gable('tile', 'tbNave', at(0, 0, (z0 + z1) / 2), NW * 2, z0 - z1, NAVE_TOP, RISE, { ov: 0.35, c: '#b8744f', wc: '#dcc79e' });
  bx('flat', F, -NW - 0.3, NW + 0.3, NAVE_TOP + 0.02, NAVE_TOP + 0.2, DZ - 9.5, DZ + 9.5, { c: '#a39a8c' });   // (its underside 2 cm above the gables': at the same height the two flickered from the street)
  // the front: a stepped shape (attic narrower than the orders under it, a curved top) with the painted face on it
  const hw = FW / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, MID + 0.5); s.lineTo(hw - 0.4, MID + 0.5); s.lineTo(hw - 0.4, TOP); s.quadraticCurveTo(0, TOP + 2.4, -hw + 0.4, TOP); s.lineTo(-hw + 0.4, MID + 0.5); s.lineTo(-hw, MID + 0.5); s.lineTo(-hw, 0);
  extrude('tbFront', s, 1.3, { M: at(0, 0, -1.35), uv: 'keep', uvk: [1 / FW, 1 / FH], uvo: [0.5, 0], cs: 8, noao: true });
  // cornices, the balcony with its iron rail, the free-standing columns, the statues
  bx('flat', F, -hw - 0.35, hw + 0.35, BAL - 0.2, BAL + 0.25, -1.35, 1.5, { c: '#c9b68e', noao: true });
  rail(at(0, BAL + 0.25, 1.4), FW + 0.6, 1.1, {}); for (const sg of [-1, 1]) rail(mul(at(sg * (hw + 0.3), BAL + 0.25, 0.1), rotY(PI / 2)), 1.5, 1.1, {});
  bx('flat', F, -hw - 0.3, hw + 0.3, MID - 0.15, MID + 0.45, -1.35, 0.7, { c: '#d0bd94', noao: true });
  bx('flat', F, -hw + 0.1, hw - 0.1, TOP - 0.1, TOP + 0.25, -1.35, 0.5, { c: '#d0bd94', noao: true });
  for (const sg of [-1, 1]) {
    cyl('flat', 0.42, 0.46, BAL - 1.4, 10, { M: at(sg * 3.3, 0.5, 0.2), c: GREY }); bx('flat', F, sg * 3.3 - 0.6, sg * 3.3 + 0.6, 0, 0.5, -0.4, 0.8, { c: '#a9a38f', noao: true }); bx('flat', F, sg * 3.3 - 0.65, sg * 3.3 + 0.65, BAL - 0.95, BAL - 0.2, -0.4, 0.85, { c: '#c9b68e', noao: true });
    cyl('flat', 0.38, 0.4, MID - BAL - 0.9, 10, { M: at(sg * 3.3, BAL + 0.25, 0.2), c: GREY }); bx('flat', F, sg * 3.3 - 0.55, sg * 3.3 + 0.55, MID - 1.0, MID - 0.15, -0.4, 0.8, { c: '#c9b68e', noao: true });
    bx('flat', F, sg * (hw - 0.55) - 0.55, sg * (hw - 0.55) + 0.55, 0, MID, -1.35, 0.3, { c: '#c6ad80', noao: true });
  }
  statue('flat', at(0, BAL + 0.25, 0.9), 3.6, { c: '#e6e0d0' });
  statue('flat', at(0, MID + 1.6, -0.3), 3.0, { c: '#e6e0d0' });
  for (let i = 0; i < 4; i++) bx('stone', F, -2.6 - i * 0.25, 2.6 + i * 0.25, -0.3, 0.2 * (4 - i), 0, 0.45 * (i + 1) + 0.2, { c: '#cfc2a4' });
  // the drum with paired columns and the majolica dome, lantern and cross over the crossing
  const DC = at(0, NAVE_TOP + 0.2, DZ), DR = 7.4;
  cyl('flat', DR, DR + 0.2, 5.4, 16, { M: DC, c: '#cdb68a' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI + PI / 8, M = mul(DC, mul(rotY(a), tr(0, 0, DR + 0.15))); bx('flat', M, -0.9, 0.9, 0.5, 4.8, -0.05, 0.25, { c: '#dcc79e', noao: true }); bx('dark', M, -0.5, 0.5, 1.3, 4.1, 0.05, 0.1, { c: '#272c33', noao: true }); }
  lathe('flat', [[DR + 0.55, 5.4], [DR + 0.55, 5.75], [DR - 0.2, 5.85], [DR - 0.2, 5.9]], 16, { M: DC, c: '#d0bd94' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * PI * 0.5; prof.push([(DR - 0.2) * Math.cos(a), 5.9 + 6.8 * Math.sin(a)]); }
  lathe('tbDome', prof, 16, { M: DC, noao: true, uv: 'keep', uvk: [8, 1] });
  cyl('flat', 1.3, 1.5, 3.2, 8, { M: mul(DC, tr(0, 12.5, 0)), c: '#dcc79e' }); sphere('tbDome', 1.4, { M: mul(DC, tr(0, 16.1, 0)), ky: 1.2, seg: 8, noao: true });
  bx('flat', DC, -0.09, 0.09, 17.2, 19.1, -0.09, 0.09, { c: '#3e3a36', noao: true }); bx('flat', DC, -0.55, 0.55, 18.2, 18.35, -0.09, 0.09, { c: '#3e3a36', noao: true });
  const o = end('Chiesa di San Giuseppe dei Teatini');
  const ring = (x0, x1, z0, z1) => [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat();
  o.userData.solids = [[TP.p, null, y0 + EAVE], [ring(-NW, NW, NZ1, NZ0), null, y0 + NAVE_TOP + RISE], [ring(-7.5, 7.5, DZ - 7.5, DZ + 7.5), null, y0 + NAVE_TOP + 12]];
  return o;
}
export const TEATINI = { name: 'Chiesa di San Giuseppe dei Teatini', x: 20, z: 52, radius: 60, skipIds: [TP.id], build: buildTeatini };
