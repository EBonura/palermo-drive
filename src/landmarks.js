// Hand-built landmark models. Owned by the landmarks work.
// prepareLandmarks runs before buildings: add building ids to ctx.skip for any footprint a model replaces.
// All models are assembled from merged parts (one mesh per material) in local frames, on groundY.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D, groundY, rng } from './core.js';

const PI = Math.PI, TWO = PI * 2;
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ====================================================================================================
// Toolkit: material registry, part collector, texture painters
// ====================================================================================================
const MATS = {};      // key -> { map, texM:[mu,mv], opts }
const BINS = {};      // key -> geometries
const STATS = {};
const KEEPOUT = {};  // open-ground footprints of models, for the lead to treat as obstacles (exposed on window.__landmarkKeepout)     // landmark -> triangles
let CUR = 'misc', BASEY = 0;

function mkTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function defMat(key, map, texM, opts = {}) { MATS[key] = { map, texM, opts }; BINS[key] = []; }

const UB = new THREE.BoxGeometry(1, 1, 1); UB.translate(0, 0.5, 0);   // base-centred unit box
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _n = new THREE.Vector3();

// Add a geometry to a material bin. o: p [x,y,z], ry/rx/rz, s [sx,sy,sz], M parent matrix, c tint,
// uv 'world' (metric, from world position and normal) or 'keep' (geometry uv times uvk).
function part(key, g0, o = {}) {
  const bin = BINS[key]; if (!bin) throw new Error('no material ' + key);
  const g = g0.index ? g0.toNonIndexed() : g0.clone();
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
  _m.compose(V3(o.p || [0, 0, 0]), _q, V3(o.s || [1, 1, 1]));
  if (o.M) _m.premultiply(o.M);
  g.applyMatrix4(_m);
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const tm = MATS[key].texM;
  _c.set(o.c || '#ffffff');
  const keep = o.uv === 'keep', uk = o.uvk || [1, 1], uo = o.uvo || [0, 0];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (keep) { uv[i * 2] = g.attributes.uv.getX(i) * uk[0] + uo[0]; uv[i * 2 + 1] = g.attributes.uv.getY(i) * uk[1] + uo[1]; }
    else {
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      if (Math.abs(ny) > 0.6) { uv[i * 2] = x / tm[0]; uv[i * 2 + 1] = z / tm[1]; }
      else { uv[i * 2] = (x * nz - z * nx) / tm[0]; uv[i * 2 + 1] = y / tm[1]; }
      uv[i * 2] += uo[0]; uv[i * 2 + 1] += uo[1];
    }
    const ao = o.noao ? 1 : 0.74 + 0.26 * Math.min(1, Math.max(0, (y - BASEY) / 5));
    col[i * 3] = _c.r * ao; col[i * 3 + 1] = _c.g * ao; col[i * 3 + 2] = _c.b * ao;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv1');
  bin.push(g);
  STATS[CUR] = (STATS[CUR] || 0) + n / 3;
}

// Convenience primitives (base-centred; p is the base centre)
const box = (key, sx, sy, sz, o = {}) => part(key, UB, { ...o, s: [sx, sy, sz] });
function cyl(key, rt, rb, h, seg, o = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); g.translate(0, h / 2, 0);
  part(key, g, { uv: 'keep', uvk: [2 * PI * Math.max(rt, rb) / MATS[key].texM[0], h / MATS[key].texM[1]], ...o });
}
function lathe(key, prof, seg, o = {}) {
  const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), seg);
  part(key, g, o);
}
function sphere(key, r, o = {}) {
  const g = geo('sph' + (o.seg || 8), () => new THREE.SphereGeometry(1, o.seg || 8, Math.max(4, (o.seg || 8) >> 1)));
  part(key, g, { ...o, s: [r, r * (o.ky || 1), r] });
}
function shapeGeo(shape, depth, hole) {
  if (hole) shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
}
function archShape(w, h, shape = new THREE.Shape()) {
  const r = w / 2;
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, h - r);
  shape.absarc(0, h - r, r, 0, PI, false); shape.lineTo(-r, 0);
  return shape;
}
function archPath(w, h) { // hole path (clockwise opposite of the outer) for frames
  const r = w / 2, p = new THREE.Path();
  p.moveTo(-r, 0.03); p.lineTo(-r, h - r); p.absarc(0, h - r, r, PI, 0, true); p.lineTo(r, 0.03); p.lineTo(-r, 0.03);
  return p;
}
function rectShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0); return s; }

// Local frame: origin (x,y,z), facing outward normal angle: local +z points along (nx, nz), local x is to the right when viewed from the front.
function frame(x, y, z, nx, nz) {
  const m = new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz));
  m.setPosition(x, y, z); return m;
}
const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const rotY = (a) => new THREE.Matrix4().makeRotationY(a);

function finish(parent) {
  const out = {};
  for (const k in MATS) {
    if (!BINS[k].length) continue;
    const merged = mergeGeometries(BINS[k], false);
    const m = MATS[k];
    const { noShadow, ...mo } = m.opts;   // noShadow is ours (castShadow below), not a material parameter
    const mat = new THREE.MeshStandardMaterial({ map: m.map, vertexColors: true, roughness: 0.92, metalness: 0, ...mo });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !m.opts.noShadow; mesh.receiveShadow = true; mesh.name = 'landmarks-' + k;
    parent.add(mesh); out[k] = merged.attributes.position.count / 3;
    BINS[k] = [];
  }
  return out;
}

// ---------- painters ----------
const R_ = (seed) => rng(seed);
function noiseDots(g, w, h, n, r, seed, cols) {
  const r_ = R_(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(i % cols.length)]; const s = r * (0.4 + r_()); g.fillRect(r_() * w, r_() * h, s, s); }
}
function streaks(g, w, h, n, seed, alpha, len) {
  const r_ = R_(seed);
  for (let i = 0; i < n; i++) {
    const x = r_() * w, y = r_() * h, l = len * (0.4 + r_()), ww = 1 + r_() * 4;
    const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(30,22,14,${alpha})`); gr.addColorStop(1, 'rgba(30,22,14,0)');
    g.fillStyle = gr; g.fillRect(x, y, ww, l);
  }
}
// ashlar blocks: tile covers tw x th metres on a w x h canvas
function paintAshlar(g, w, h, tw, th, course, block, base, joint, seed, jointW = 2, vary = 0.07) {
  const r_ = R_(seed), pm = w / tw, rows = Math.round(th / course);
  g.fillStyle = joint; g.fillRect(0, 0, w, h);
  const b = new THREE.Color(base), c = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    const y0 = j * course * (h / th), hh = course * (h / th);
    let x = -r_() * block * pm;
    while (x < w) {
      const bw = block * pm * (0.7 + r_() * 0.6), k = 1 + (r_() - 0.5) * 2 * vary;
      c.setRGB(Math.min(1, b.r * k), Math.min(1, b.g * k), Math.min(1, b.b * k));
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x + jointW / 2, y0 + jointW / 2, bw - jointW, hh - jointW);
      x += bw;
    }
  }
  noiseDots(g, w, h, w * h / 140, 1.6, seed + 7, ['rgba(60,45,30,0.10)', 'rgba(255,240,210,0.07)']);
}

// ---------- shared materials ----------
let READY = false;
function initMaterials() {
  if (READY) return; READY = true;
  defMat('ashlar', mkTex(512, 512, (g, w, h) => paintAshlar(g, w, h, 3.2, 3.2, 0.4, 0.85, '#d2bd96', '#8a7656', 11)), [3.2, 3.2]);
  defMat('rustic', mkTex(512, 512, (g, w, h) => paintAshlar(g, w, h, 3.3, 3.3, 0.55, 1.1, '#c6baa2', '#5a4e3d', 12, 5, 0.1)), [3.3, 3.3]);
  defMat('plaster', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8dccb'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 900, 2.5, 21, ['rgba(120,90,60,0.08)', 'rgba(255,255,255,0.10)']); streaks(g, w, h, 40, 22, 0.08, 120);
  }), [4, 4]);
  defMat('marble', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e4e0d4'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 700, 2.2, 31, ['rgba(110,105,95,0.09)', 'rgba(255,255,250,0.12)']);
    g.strokeStyle = 'rgba(120,115,105,0.13)'; g.lineWidth = 1; const r_ = R_(32);
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = r_() * w, y = r_() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r_() - 0.3) * 70; y += (r_() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
  }), [3, 3]);
  defMat('lead', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b3b6ae'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 900, 2.5, 41, ['rgba(60,70,60,0.12)', 'rgba(255,255,245,0.08)']);
    g.fillStyle = 'rgba(70,80,72,0.22)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
  }), [3, 3]);
  defMat('tile', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c4714c'; g.fillRect(0, 0, w, h); const r_ = R_(51);
    for (let y = 0; y < h; y += 16) { for (let x = 0; x < w; x += 16) { g.fillStyle = `hsl(${12 + r_() * 8},${48 + r_() * 12}%,${46 + r_() * 12}%)`; g.fillRect(x, y, 15, 15); } g.fillStyle = 'rgba(60,25,15,.5)'; g.fillRect(0, y + 14, w, 2); }
  }), [2.4, 2.4]);
  defMat('red', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b4655d'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 1400, 3, 61, ['rgba(120,60,60,0.2)', 'rgba(220,150,130,0.18)', 'rgba(90,60,50,0.15)']);
  }), [2.5, 2.5]);
  defMat('balus', mkTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#e4e0d3';
    g.fillRect(0, 0, w, 9); g.fillRect(0, h - 8, w, 8);
    for (let x = 0; x < w; x += 16) { g.fillRect(x + 4, 9, 8, h - 17); g.fillRect(x + 2, 22, 12, 8); g.fillRect(x + 2, 38, 12, 6); }
  }), [1, 1], { alphaTest: 0.5, side: THREE.DoubleSide });
  defMat('majolica', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d9c078'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
      g.fillStyle = '#4f8c64'; g.beginPath(); g.moveTo(x + 16, y); g.lineTo(x + 32, y + 16); g.lineTo(x + 16, y + 32); g.lineTo(x, y + 16); g.fill();
      g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(x + 16, y + 8); g.lineTo(x + 24, y + 16); g.lineTo(x + 16, y + 24); g.lineTo(x + 8, y + 16); g.fill();
    }
    noiseDots(g, w, h, 600, 2, 71, ['rgba(80,60,30,0.15)']);
  }), [4, 4], { side: THREE.DoubleSide });
  defMat('flat', null, [1, 1]);
  defMat('dark', null, [1, 1], { roughness: 1 });
  defMat('bronze', null, [1, 1], { roughness: 0.5, metalness: 0.3 });
  defMat('rail', mkTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#2a2a30';
    g.fillRect(0, 2, w, 5); g.fillRect(0, h - 6, w, 5);
    for (let x = 4; x < w; x += 16) g.fillRect(x, 0, 3, h);
  }), [1, 1], { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false, noShadow: true });
}

// white stone balustrade panel (same convention as rail)
function balus(M, len, h, o = {}) {
  const g = geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; });
  part('balus', g, { M, s: [len, h, 1], uv: 'keep', uvk: [len / h, 1], noao: true, ...o });
}
// iron railing panel: len x h metres, in a local frame with the panel centred on x, standing on y=0 at z
function rail(M, len, h, o = {}) {
  const g = geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; });
  part('rail', g, { M, s: [len, h, 1], uv: 'keep', uvk: [len / 0.5 * 0.5, 1], noao: true, ...o });
}
// small robed statue standing on y=0 in the frame M; h = total height
function statue(key, M, h, o = {}) {
  const c = o.c || '#d6d2c4', k = h, na = !!o.noao;
  // robe, shoulders, head, hanging arms, a cloak behind
  lathe(key, [[0, 0], [0.23 * k, 0], [0.24 * k, 0.12 * k], [0.19 * k, 0.45 * k], [0.15 * k, 0.62 * k], [0.19 * k, 0.7 * k], [0.08 * k, 0.74 * k], [0.04 * k, 0.77 * k]], 8, { M, c, noao: na });
  box(key, 0.42 * k, 0.1 * k, 0.17 * k, { M, p: [0, 0.62 * k, 0], c, noao: na });
  sphere(key, 0.075 * k, { M, p: [0, 0.84 * k, 0.005 * k], c, seg: 6, noao: na });
  box(key, 0.07 * k, 0.3 * k, 0.08 * k, { M, p: [0.22 * k, 0.4 * k, 0.04 * k], rz: 0.12, c, noao: na });
  box(key, 0.07 * k, 0.3 * k, 0.08 * k, { M, p: [-0.22 * k, 0.4 * k, 0.04 * k], rz: -0.12, c, noao: na });
  box(key, 0.36 * k, 0.62 * k, 0.05 * k, { M, p: [0, 0.1 * k, -0.15 * k], c: o.cloak || '#c8c3b3', noao: na });
  if (o.crown) cyl(key, 0.08 * k, 0.06 * k, 0.07 * k, 6, { M, p: [0, 0.9 * k, 0], c });
}
function angel(key, M, h, o = {}) {
  statue(key, M, h, o);
  box(key, 0.5 * h, 0.4 * h, 0.04 * h, { M, p: [-0.28 * h, 0.5 * h, -0.12 * h], rz: 0.5, c: o.c || '#ddd9cc' });
  box(key, 0.5 * h, 0.4 * h, 0.04 * h, { M, p: [0.28 * h, 0.5 * h, -0.12 * h], rz: -0.5, c: o.c || '#ddd9cc' });
}
// base height for a footprint
const baseAt = (x, z) => groundY(x, z);
function minGround(pts) { let m = Infinity; for (const p of pts) m = Math.min(m, groundY(p[0], p[1])); return m; }
const byId = (id) => D.buildings.find(b => b.id === id);
const relH = (b, dflt) => (b && b.r !== undefined && b.g !== undefined) ? b.r - b.g : (b ? b.h : dflt);
const pairsOf = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };
const centroid = (pts) => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };

// ====================================================================================================
// 1. Quattro Canti
// ====================================================================================================
const QC = { C: [17.49, 4.0], R: 15.29, Rf: 14.95, Wd: 12.6 };

// The facade of one of the four Quattro Canti (Piazza Vigliena, 1608-20), painted: Wd metres wide, 25.6 m high on a W x H canvas. Read off the Commons photos (CC0 Bjs 2007 front view;
// Flickr 9455477141, CC BY 2.0): a rusticated pedestal, three tiers with their orders (Doric, Ionic, composite) between two grey marble columns, the fountain and a plaque in the middle
// of the lowest tier, a king's niche in the middle one, the saint's niche in the top one, shuttered windows in the side bays, a deep balcony between the first two tiers and the
// royal arms on the attic. The heavy parts are real geometry (buildQuattroCanti), this is the wall they stand on: dressed stone, stucco frames, shutters, shadows.
function paintQC(Wd) {
  const W = 768, H = 1536, sx = W / Wd, sy = H / 25.6;
  return mkTex(W, H, (g) => {
    const X = (s) => (s + Wd / 2) * sx, Y = (y) => H - y * sy;
    const rect = (s0, y0, s1, y1, f) => { g.fillStyle = f; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy); };
    const frame = (s0, y0, s1, y1, c, wd) => { rect(s0 - wd, y0 - wd, s1 + wd, y0, c); rect(s0 - wd, y1, s1 + wd, y1 + wd, c); rect(s0 - wd, y0, s0, y1, c); rect(s1, y0, s1 + wd, y1, c); };
    const r_ = R_(101);
    const T1 = 7.4, T2 = 15.0, T3 = 21.8;
    // the stone: warm limestone, courses of dressed blocks that get finer with height
    g.fillStyle = '#9a7b48'; g.fillRect(0, 0, W, H);
    for (const [ya, yb, bh, bw, c0] of [[1.9, T1, 0.6, 1.5, [158, 126, 80]], [T1 + 0.6, T2, 0.72, 1.7, [164, 132, 86]], [T2 + 0.6, T3, 0.72, 1.7, [162, 130, 84]]]) for (let y = ya; y < yb; y += bh) {
      let s = -Wd / 2 - r_() * bw;
      while (s < Wd / 2) { const w2 = bw * (0.7 + r_() * 0.6), k = 0.86 + r_() * 0.26; rect(s + 0.025, y + 0.025, s + w2 - 0.025, y + bh - 0.02, `rgb(${(c0[0] * k) | 0},${(c0[1] * k) | 0},${(c0[2] * k) | 0})`); s += w2; }
    }
    // the pedestal: panelled, darker
    rect(-Wd / 2, 0, Wd / 2, 1.9, '#7d6a49');
    for (const [a, b] of [[-5.3, -2.95], [-1.9, 1.9], [2.95, 5.3]]) { rect(a, 0.35, b, 1.55, '#8c7852'); frame(a, 0.35, b, 1.55, '#5e4e36', 0.1); rect(a + 0.12, 0.47, b - 0.12, 1.43, '#957f57'); }
    rect(-Wd / 2, 1.9, Wd / 2, 2.1, '#b49a6c'); rect(-Wd / 2, 1.9, Wd / 2, 1.97, '#4d4132');
    // the bossed quoin strips up both edges, rusticated on the lowest tier
    for (const sg of [-1, 1]) {
      const a = sg < 0 ? -Wd / 2 : Wd / 2 - 1.0, b = a + 1.0;
      for (let y = 2.1; y < T3; y += 0.62) { const k = 0.9 + r_() * 0.18; rect(a, y, b, y + 0.56, `rgb(${(188 * k) | 0},${(160 * k) | 0},${(112 * k) | 0})`); rect(a, y, b, y + 0.07, 'rgba(255,240,200,0.35)'); rect(a, y + 0.5, b, y + 0.56, 'rgba(40,28,16,0.35)'); }
    }
    // the central bay: smooth, recessed panels with a dark moulding
    rect(-1.95, 2.1, 1.95, 7.0, '#9b8458'); frame(-1.95, 2.1, 1.95, 7.0, '#5a4a32', 0.1);
    rect(-1.8, 2.25, 1.8, 6.85, '#a38c5f');
    // the plaque (an inscription on a white cartouche) above the season's statue
    rect(-1.6, 4.55, 1.6, 6.45, '#e2dccb'); frame(-1.6, 4.55, 1.6, 6.45, '#b9ae95', 0.12); rect(-1.45, 4.7, 1.45, 6.3, '#d8d1bd');
    g.fillStyle = '#6a6354'; for (let y = 4.95; y < 6.15; y += 0.17) g.fillRect(X(-1.25), Y(y), 2.5 * sx * (0.72 + r_() * 0.28), 3);
    g.fillStyle = '#e8e2d2'; g.beginPath(); g.ellipse(X(0), Y(6.55), 0.5 * sx, 0.14 * sy, 0, 0, 7); g.fill();
    // the windows of the side bays: stucco frames, green shutters with louvres
    const shutter = (s, y0, y1, w) => {
      rect(s - w / 2, y0, s + w / 2, y1, '#3e5f48');
      g.fillStyle = '#2f4a38'; for (let y = y0 + 0.08; y < y1 - 0.05; y += 0.13) g.fillRect(X(s - w / 2) + 2, Y(y), w * sx - 4, 2);
      rect(s - 0.025, y0, s + 0.025, y1, '#223528');
    };
    const win = (s, y0, y1, w, o = {}) => {
      rect(s - w / 2 - 0.26, y0 - 0.26, s + w / 2 + 0.26, y1 + 0.2, '#e4ddcb'); rect(s - w / 2 - 0.26, y0 - 0.26, s + w / 2 + 0.26, y0 - 0.2, '#b2a78e');
      rect(s - w / 2 - 0.1, y0 - 0.1, s + w / 2 + 0.1, y1 + 0.08, '#8e8268');
      shutter(s, y0, y1, w);
      if (o.ear) { rect(s - w / 2 - 0.48, y0 + (y1 - y0) * 0.55, s - w / 2 - 0.26, y1 + 0.1, '#e4ddcb'); rect(s + w / 2 + 0.26, y0 + (y1 - y0) * 0.55, s + w / 2 + 0.48, y1 + 0.1, '#e4ddcb'); }
      if (o.cartouche) { g.fillStyle = '#ece6d6'; g.beginPath(); g.moveTo(X(s - 0.5), Y(y1 + 0.2)); g.quadraticCurveTo(X(s), Y(y1 + 1.15), X(s + 0.5), Y(y1 + 0.2)); g.fill(); }
    };
    for (const s of [-3.95, 3.95]) {
      win(s, 3.4, 5.9, 1.25);
      win(s, 8.9, 13.0, 1.5);
      win(s, 17.2, 19.6, 1.1, { ear: true, cartouche: true });
    }
    // cornice bands: the shadow under each, a light edge above it
    for (const [y0, y1] of [[T1, T1 + 0.6], [T2, T2 + 0.6], [T3, T3 + 0.7]]) {
      rect(-Wd / 2, y0, Wd / 2, y1, '#b09870'); rect(-Wd / 2, y1 - 0.1, Wd / 2, y1, '#cdb88c'); rect(-Wd / 2, y0, Wd / 2, y0 + 0.12, '#4d4132');
      const gr = g.createLinearGradient(0, Y(y0), 0, Y(y0) + 70); gr.addColorStop(0, 'rgba(25,16,8,0.5)'); gr.addColorStop(1, 'rgba(25,16,8,0)'); g.fillStyle = gr; g.fillRect(0, Y(y0), W, 70);
    }
    // metope band of the Doric entablature (triglyphs) on the first cornice's frieze
    rect(-Wd / 2, T1 - 0.7, Wd / 2, T1, '#a8905f'); for (let s = -Wd / 2 + 0.25; s < Wd / 2; s += 0.62) rect(s, T1 - 0.66, s + 0.2, T1 - 0.04, '#6a583a');
    // the attic: dark panels between small pilasters, ends rolled into volutes (geometry)
    rect(-Wd / 2, T3 + 0.7, Wd / 2, 25.6, '#9b835a');
    for (let s = -Wd / 2 + 0.5; s < Wd / 2 - 0.9; s += 1.9) { rect(s, T3 + 1.0, s + 1.3, 24.3, '#85704a'); frame(s, T3 + 1.0, s + 1.3, 24.3, '#b59f76', 0.07); }
    // weathering: dark streaks under every ledge, a blackened foot, pale patches
    streaks(g, W, H, 520, 103, 0.28, 260);
    noiseDots(g, W, H, 14000, 2, 104, ['rgba(40,30,20,0.18)', 'rgba(240,220,180,0.10)']);
    const gb = g.createLinearGradient(0, H, 0, Y(5.5)); gb.addColorStop(0, 'rgba(25,20,15,0.42)'); gb.addColorStop(1, 'rgba(25,20,15,0)'); g.fillStyle = gb; g.fillRect(0, Y(5.5), W, 5.5 * sy);
  });
}

function buildQuattroCanti() {
  CUR = 'Quattro Canti';
  const [cx, cz] = QC.C, { R, Rf, Wd } = QC;
  // find the four concave arcs among building vertices
  const pts = [];
  for (const b of D.buildings) {
    const p = b.p;
    for (let i = 0; i < p.length; i += 2) {
      const d = Math.hypot(p[i] - cx, p[i + 1] - cz);
      if (Math.abs(d - R) < 0.5) pts.push({ a: Math.atan2(p[i + 1] - cz, p[i] - cx), b });
    }
  }
  if (pts.length < 8) return;
  pts.sort((p, q) => p.a - q.a);
  const n = pts.length, TWO = 2 * PI;
  let k0 = 0;
  for (let i = 0; i < n; i++) { let gap = pts[(i + 1) % n].a - pts[i].a; if (gap < 0) gap += TWO; if (gap > 0.45) { k0 = (i + 1) % n; break; } }
  const clusters = []; let cur = [];
  for (let j = 0; j < n; j++) {
    const p = pts[(k0 + j) % n];
    if (cur.length) { let d = p.a - cur[cur.length - 1].a; if (d < 0) d += TWO; if (d > 0.45) { clusters.push(cur); cur = []; } }
    cur.push(p);
  }
  if (cur.length) clusters.push(cur);
  const arcs = [];
  for (const cl of clusters) {
    if (cl.length < 3) continue;
    let a0 = cl[0].a, a1 = a0, last = a0;
    for (const p of cl) { let d = p.a - last; if (d < 0) d += TWO; a1 += d; last = p.a; }
    arcs.push({ a0, a1, mid: (a0 + a1) / 2 });
  }
  const tex = paintQC(Wd);
  defMat('qcwall', tex, [Wd, 25.6]);
  const T1 = 7.4, T2 = 15.0, T3 = 21.8, GREY = '#8b9197', GREY_D = '#6f757b', WHITE = '#e4decd', STONE = '#a28956', STONE_L = '#bca276', STONE_D = '#7f6a46', WATER = '#5f93ab';
  const eagle = new THREE.Shape(); {   // the royal eagle: spread wings, head up, tail down (flat silhouette)
    const P = [[-2.3, 0.1], [-1.9, 0.85], [-1.2, 1.0], [-0.8, 1.55], [-0.4, 1.7], [-0.25, 2.2], [0, 2.4], [0.25, 2.2], [0.4, 1.7], [0.8, 1.55], [1.2, 1.0], [1.9, 0.85], [2.3, 0.1], [1.5, 0.45], [0.8, 0.3], [0.45, -0.5], [0, -0.75], [-0.45, -0.5], [-0.8, 0.3], [-1.5, 0.45]];
    eagle.moveTo(P[0][0], P[0][1]); for (const q of P.slice(1)) eagle.lineTo(q[0], q[1]); eagle.lineTo(P[0][0], P[0][1]);
  }
  const shield = new THREE.Shape(); shield.moveTo(-0.8, 0); shield.lineTo(0.8, 0); shield.lineTo(0.8, 1.2); shield.quadraticCurveTo(0.8, 2.1, 0, 2.5); shield.quadraticCurveTo(-0.8, 2.1, -0.8, 1.2); shield.lineTo(-0.8, 0);

  for (const arc of arcs) {
    const th = (s) => arc.mid + s / Rf;
    const gy0 = groundY(cx + Rf * Math.cos(arc.mid), cz + Rf * Math.sin(arc.mid));
    BASEY = gy0;
    // local frame at facade coordinate s, height y, depth z (toward the piazza)
    const at = (s, y = 0, z = 0) => {
      const t = th(s), dx = Math.cos(t), dz = Math.sin(t);
      const m = frame(cx + Rf * dx, gy0 + y, cz + Rf * dz, -dx, -dz);
      return z ? mul(m, tr(0, 0, z)) : m;
    };
    // wall surface: faceted concave strip with the painted facade
    const nseg = 14;
    {
      const gg = new THREE.BufferGeometry(), P = [], N = [], U = [];
      const ytop = 25.6, ybot = -1.0;
      for (let i = 0; i < nseg; i++) {
        const sa = -Wd / 2 + Wd * i / nseg, sb = -Wd / 2 + Wd * (i + 1) / nseg;
        const ta = th(sa), tb = th(sb);
        const pa = [cx + Rf * Math.cos(ta), cz + Rf * Math.sin(ta)], pb = [cx + Rf * Math.cos(tb), cz + Rf * Math.sin(tb)];
        const tm = (ta + tb) / 2, nx = -Math.cos(tm), nz = -Math.sin(tm);
        const ua = i / nseg, ub = (i + 1) / nseg;
        const vb = ybot / 25.6, vt = ytop / 25.6;
        const Q = [[pa, ybot, ua, vb], [pb, ybot, ub, vb], [pb, ytop, ub, vt], [pa, ytop, ua, vt]];
        for (const k of [0, 1, 2, 0, 2, 3]) { const q = Q[k]; P.push(q[0][0], gy0 + q[1], q[0][1]); N.push(nx, 0, nz); U.push(q[2], q[3]); }
      }
      gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      gg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      part('qcwall', gg, { uv: 'keep', noao: true });
    }
    // the footing: a skirt along the foot of the steps where the ground falls away from the facade
    {
      const ring = []; for (let i = 0; i <= 8; i++) { const t = th(-Wd / 2 - 0.4 + (Wd + 0.8) * i / 8); ring.push([cx + (Rf - 3.3) * Math.cos(t), cz + (Rf - 3.3) * Math.sin(t)]); }
      for (let i = 8; i >= 0; i--) { const t = th(-Wd / 2 - 0.4 + (Wd + 0.8) * i / 8); ring.push([cx + (Rf + 0.2) * Math.cos(t), cz + (Rf + 0.2) * Math.sin(t)]); }
      skirt('ashlar', ring, gy0 + 0.05, '#8a7a5c');
    }
    // horizontal arc slabs (cornices, balcony, plinth): short straight pieces along the arc
    const arcSlab = (key, s0, s1, y0, y1, z0, z1, c) => {
      const nn = Math.max(2, Math.ceil((s1 - s0) / 1.5));
      for (let i = 0; i < nn; i++) {
        const sa = s0 + (s1 - s0) * i / nn, sb = s0 + (s1 - s0) * (i + 1) / nn, sc = (sa + sb) / 2;
        box(key, (sb - sa) * 1.06, y1 - y0, z1 - z0, { M: at(sc, y0, (z0 + z1) / 2), c });
      }
    };
    // the pedestal (it stands out of the wall) and the broken entablatures at the three tiers, each with its modillions
    arcSlab('ashlar', -Wd / 2, Wd / 2, 0, 1.9, 0, 0.3, STONE_D);
    arcSlab('ashlar', -Wd / 2, Wd / 2, 1.9, 2.15, 0, 0.45, STONE_L);
    for (const [yb, w] of [[T1, 0.65], [T2, 0.6], [T3, 0.7]]) {
      arcSlab('ashlar', -Wd / 2, Wd / 2, yb, yb + 0.6, 0, w, STONE);
      arcSlab('ashlar', -Wd / 2, Wd / 2, yb + 0.6, yb + 0.78, 0, w + 0.22, STONE_L);
      for (let s = -Wd / 2 + 0.4; s < Wd / 2; s += 0.7) box('ashlar', 0.3, 0.38, 0.34, { M: at(s, yb - 0.32, 0.34), c: STONE_D });
    }
    // the balcony between the first two tiers: a deep slab on corbels, iron railing along the whole width
    arcSlab('ashlar', -Wd / 2 - 0.2, Wd / 2 + 0.2, T1 + 0.78, T1 + 1.08, 0, 1.45, STONE);
    for (let s = -Wd / 2 + 0.5; s < Wd / 2; s += 1.1) box('ashlar', 0.42, 0.7, 0.9, { M: at(s, T1 - 0.45, 0.62), c: STONE_D });
    for (let i = 0; i < 9; i++) { const sa = -Wd / 2 + Wd * i / 9; rail(at(sa + Wd / 18, T1 + 1.08, 1.38), Wd / 9 * 1.03, 1.1); }
    for (const sg of [-1, 1]) rail(mul(at(sg * (Wd / 2 + 0.15), T1 + 1.08, 0.7), rotY(PI / 2)), 1.4, 1.1);
    // ---- the orders: two grey marble columns each side of the middle bay at each tier
    const capital = (order, s, y) => {   // y: top of the shaft
      const M = at(s, y, 0.8);
      if (order === 'doric') { cyl('marble', 0.4, 0.33, 0.24, 10, { M, c: GREY_D }); box('marble', 0.95, 0.18, 0.95, { M: mul(M, tr(0, 0.24, 0)), c: GREY }); }
      else if (order === 'ionic') {
        cyl('marble', 0.38, 0.31, 0.2, 10, { M, c: GREY_D });
        box('marble', 1.0, 0.16, 0.78, { M: mul(M, tr(0, 0.2, 0)), c: GREY });
        for (const sg of [-1, 1]) cyl('marble', 0.2, 0.2, 0.74, 10, { M: mul(M, tr(sg * 0.36, 0.34, -0.37)), rx: PI / 2, c: GREY_D });   // the two volutes, seen end on
        box('marble', 1.0, 0.1, 0.8, { M: mul(M, tr(0, 0.5, 0)), c: GREY_D });
      } else {   // composite: a bell of leaves and the volutes at the corners
        lathe('marble', [[0.3, 0], [0.38, 0.25], [0.5, 0.55], [0.56, 0.72], [0.5, 0.72], [0.28, 0.1]], 10, { M, c: GREY_D });
        for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box('marble', 0.2, 0.22, 0.2, { M: mul(M, tr(a * 0.5, 0.58, b * 0.5)), rz: a * 0.5, c: GREY });
        box('marble', 1.05, 0.12, 1.05, { M: mul(M, tr(0, 0.72, 0)), c: GREY });
      }
    };
    for (const sg of [-1, 1]) {
      const s = sg * 2.4;
      // lowest tier: Doric, on a tall plinth
      box('ashlar', 1.05, 1.9, 1.05, { M: at(s, 0, 0.85), c: STONE_D });
      cyl('marble', 0.33, 0.37, 4.75, 12, { M: at(s, 2.1, 0.8), c: GREY });
      box('marble', 0.85, 0.2, 0.85, { M: at(s, 1.95, 0.8), c: GREY_D });
      capital('doric', s, 6.85);
      box('ashlar', 1.5, 0.35, 1.15, { M: at(s, 7.1, 0.62), c: STONE_L });
      // middle tier: Ionic, on a pedestal on the balcony
      box('marble', 0.85, 0.9, 0.85, { M: at(s, T1 + 1.08, 0.72), c: WHITE });
      cyl('marble', 0.29, 0.33, 4.55, 12, { M: at(s, T1 + 1.98, 0.72), c: GREY });
      capital('ionic', s, T1 + 6.53);
      box('ashlar', 1.35, 0.3, 1.0, { M: at(s, T2 - 0.36, 0.6), c: STONE_L });
      // top tier: pilasters with composite capitals
      box('ashlar', 0.62, 5.0, 0.34, { M: at(s, T2 + 0.9, 0.17), c: STONE_L });
      lathe('marble', [[0.3, 0], [0.34, 0.2], [0.42, 0.5], [0.46, 0.62], [0.4, 0.62], [0.28, 0.1]], 6, { M: at(s, T3 - 0.9, 0.2), c: STONE_L, ry: PI / 4 });
      box('ashlar', 1.1, 0.3, 0.7, { M: at(s, T3 - 0.35, 0.34), c: STONE_L });
    }
    // ---- the fountain at the foot of the middle bay: steps, a garlanded basin, a stem, the upper basin with its spout, and the season on a plinth
    {
      const F = (y, z = 2.15) => at(0, y, z);
      cyl('marble', 2.7, 2.78, 0.2, 16, { M: F(0), c: '#b9b2a2' }); cyl('marble', 2.35, 2.42, 0.2, 16, { M: F(0.2), c: '#c4bdac' });
      lathe('marble', [[0, 0.0], [0.6, 0.0], [1.7, 0.15], [2.0, 0.45], [2.05, 0.75], [1.85, 0.8], [1.7, 0.55], [0, 0.35]], 16, { M: F(0.4), c: '#d3cdbc' });   // lower basin
      for (let k = 0; k < 10; k++) { const a = k * TWO / 10; sphere('marble', 0.17, { M: mul(F(0.78), tr(Math.cos(a) * 2.0, 0, Math.sin(a) * 2.0)), seg: 5, c: '#cfc9b8' }); }   // the garland of the basin
      cyl('flat', 1.7, 1.7, 0.03, 16, { M: F(1.12), c: WATER, noao: true });
      cyl('marble', 0.26, 0.42, 0.9, 8, { M: F(0.8), c: '#d3cdbc' });
      lathe('marble', [[0, 0], [0.4, 0.05], [1.05, 0.25], [1.15, 0.5], [0.98, 0.52], [0.9, 0.35], [0, 0.18]], 12, { M: F(1.6), c: '#d9d3c2' });   // upper basin
      cyl('flat', 0.9, 0.9, 0.03, 12, { M: F(2.0), c: WATER, noao: true });
      box('marble', 0.5, 0.55, 0.4, { M: at(0, 1.15, 0.9), c: '#c7c0ae' });   // the mascaron the water comes from
      box('marble', 1.0, 0.5, 0.8, { M: at(0, 1.9, 0.62), c: '#cdc7b6' });   // plinth of the season
      statue('marble', at(0, 2.4, 0.62), 2.3, { c: WHITE });
    }
    // ---- the niches of the two upper tiers: a dark bay with a scallop shell for a head, a white frame, the statue on a pedestal
    const niche = (y0, w, h, hs, pedH) => {
      part('dark', shapeGeo(archShape(w, h), 0.08), { M: at(0, y0, 0.04), uv: 'keep', c: '#2c3646', noao: true });
      part('marble', shapeGeo(archShape(w + 0.56, h + 0.28), 0.2, archPath(w, h)), { M: at(0, y0 - 0.03, 0), c: WHITE });
      for (let k = 0; k < 7; k++) { const a = PI * (k + 0.5) / 7; box('marble', 0.07, w / 2 * 0.95, 0.1, { M: at(0, y0 + h - w / 2, 0.1), rz: a - PI / 2, c: '#d5cfbd' }); }   // the shell's ribs
      box('marble', 1.25, pedH, 0.95, { M: at(0, y0, 0.52), c: WHITE });
      statue('marble', at(0, y0 + pedH, 0.55), hs, { c: WHITE });
    };
    niche(9.0, 2.0, 5.3, 3.0, 0.9);      // the Spanish king
    niche(16.4, 1.9, 4.5, 2.8, 0.7);     // the patron saint
    // a mascaron and garland over the king, an angel on a cloud over the saint
    box('marble', 0.7, 0.8, 0.4, { M: at(0, 14.6, 0.1), c: '#d8d2c0' }); sphere('marble', 0.38, { M: at(0, 14.95, 0.3), seg: 6, c: '#d8d2c0' });
    for (const sg of [-1, 1]) { sphere('marble', 0.2, { M: at(sg * 0.95, 14.7, 0.2), seg: 5, c: '#cfc9b8' }); sphere('marble', 0.17, { M: at(sg * 1.55, 14.55, 0.2), seg: 5, c: '#cfc9b8' }); }
    sphere('marble', 0.55, { M: at(0, 21.15, 0.3), ky: 0.55, seg: 6, c: '#e8e4d8' }); angel('marble', at(0, 21.3, 0.3), 0.95, { c: WHITE });
    // the stone faces at the corners of both niches, joined to the one over the middle by swags of fruit, as in the photographs (review 2, item 3)
    for (const [yc, ws] of [[14.9, 1.65], [20.85, 1.35]]) for (const sg of [-1, 1]) {
      box('marble', 0.42, 0.5, 0.3, { M: at(sg * ws, yc - 0.3, 0.14), c: '#d2ccba' }); sphere('marble', 0.23, { M: at(sg * ws, yc + 0.08, 0.28), seg: 6, c: '#d8d2c0' });
      for (let k = 1; k < 7; k++) { const t = k / 7, y = yc - 0.05 - 0.5 * Math.sin(PI * t); sphere('marble', 0.14 + 0.04 * Math.sin(PI * t), { M: at(sg * (ws * (1 - t) + 0.15 * t), y, 0.2), seg: 5, c: k % 2 ? '#cfc9b8' : '#dcd6c4' }); }
    }
    // ---- the side bays: balconies and balustrades under the windows, the pediments and the angels on them
    for (const sg of [-1, 1]) {
      const s = sg * 3.95;
      box('ashlar', 2.0, 0.22, 0.6, { M: at(s, 2.55, 0.3), c: STONE_L }); balus(at(s, 2.77, 0.58), 1.7, 0.8);
      for (const q of [-1, 1]) box('ashlar', 0.14, 0.9, 0.5, { M: at(s + q * 0.95, 2.2, 0.25), c: STONE_L });
      // middle tier: triangular pediment over the window, an angel on the apex
      const ped = new THREE.Shape(); ped.moveTo(-1.15, 0); ped.lineTo(1.15, 0); ped.lineTo(0, 0.7); ped.lineTo(-1.15, 0);
      part('marble', shapeGeo(ped, 0.3), { M: at(s, 13.3, 0.05), c: WHITE });
      angel('marble', at(s, 14.0, 0.15), 0.95, { c: WHITE });
      // top tier: the stucco frame of the little windows stands out
      box('marble', 1.9, 0.22, 0.45, { M: at(s, 19.85, 0.18), c: WHITE });
      box('marble', 0.5, 0.45, 0.3, { M: at(s, 20.1, 0.18), c: WHITE });
    }
    // ---- the crown: the attic's stepped end volutes, the royal arms (eagle and crowned shield) in the middle, a smaller shield at each end, the finials
    for (const sg of [-1, 1]) {
      box('ashlar', 1.5, 1.9, 0.8, { M: at(sg * 3.3, T3 + 0.8, 0.28), c: STONE_L });
      cyl('ashlar', 0.55, 0.55, 0.5, 12, { M: at(sg * 4.35, T3 + 1.5, 0.28), rx: PI / 2, c: STONE });
      cyl('ashlar', 0.3, 0.3, 0.6, 10, { M: at(sg * 4.35, T3 + 1.7, 0.28), rx: PI / 2, c: STONE_D });
      box('ashlar', 1.2, 1.5, 0.8, { M: at(sg * (Wd / 2 - 0.65), T3 + 0.8, 0.3), c: STONE_L });
      part('marble', shapeGeo(shield, 0.2), { M: at(sg * (Wd / 2 - 0.65), T3 + 2.3, 0.5), s: [0.55, 0.5, 1], c: WHITE });
      sphere('marble', 0.3, { M: at(sg * (Wd / 2 - 0.25), T3 + 2.3, 0.4), seg: 6, c: '#d8d2c0' });
    }
    box('ashlar', 3.4, 1.4, 0.9, { M: at(0, T3 + 0.8, 0.28), c: STONE_L });
    box('ashlar', 2.8, 1.5, 0.95, { M: at(0, 25.6, 0.3), c: STONE_L }); box('ashlar', 3.3, 0.3, 1.1, { M: at(0, 25.55, 0.3), c: STONE });      // the pedestal of the arms, above the attic
    part('marble', shapeGeo(eagle, 0.22), { M: at(0, 26.4, 0.7), s: [1.3, 1.15, 1], c: WHITE });
    part('marble', shapeGeo(shield, 0.3), { M: at(0, 26.3, 0.92), s: [1.15, 1.0, 1], c: '#e9e4d6' });
    box('flat', 0.95, 0.5, 0.2, { M: at(0, 28.8, 0.95), c: '#c8a85a', noao: true }); for (const q of [-1, 0, 1]) sphere('flat', 0.13, { M: at(q * 0.33, 29.3, 0.95), seg: 5, c: '#c8a85a', noao: true });
    // ---- two black candelabra lamps in front of the side bays
    for (const sg of [-1, 1]) {
      const L = at(sg * 4.35, 0, 2.7);
      lathe('flat', [[0, 0], [0.34, 0], [0.3, 0.5], [0.13, 0.9], [0.07, 1.1], [0.07, 3.2]], 8, { M: L, c: '#26262b', noao: true });
      for (const a of [-1, 0, 1]) { box('flat', 0.9, 0.06, 0.06, { M: mul(L, tr(0, 3.15, 0)), rz: a * 0.5, c: '#26262b', noao: true }); sphere('flat', 0.2, { M: mul(L, tr(a * 0.46, 3.35 + (a ? 0.0 : 0.25), 0)), c: '#f2eee0', seg: 6, noao: true }); }
    }
  }
}


// ---------- polygon helpers ----------
const polySign = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
// ordered (left, right) as seen from outside, plus the outward normal
function edgeLR(pts, i) {
  const a = pts[i], b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0], dz = b[1] - a[1], len0 = Math.hypot(dx, dz), l = len0 || 1;
  // outward normal depends on winding
  let nx = dz / l, nz = -dx / l;
  if (polySign(pts) < 0) { nx = -nx; nz = -nz; }
  // right-hand direction as seen from outside
  const rx = nz, rz = -nx;
  return (dx * rx + dz * rz > 0) ? { L: a, R: b, nx, nz, len: len0 } : { L: b, R: a, nx, nz, len: len0 };
}
// vertical wall quad between L and R (as seen from outside); uv rectangle in 'keep' mode
function wallQuad(key, L, R, yA, yB, uv, c, o = {}) {
  const dx = R[0] - L[0], dz = R[1] - L[1], l = Math.hypot(dx, dz);
  if (l < 0.01) return;
  const nx = -dz / l, nz = dx / l;
  const [u0, v0, u1, v1] = uv;
  const P = [L[0], yA, L[1], R[0], yA, R[1], R[0], yB, R[1], L[0], yB, L[1]];
  const U = [u0, v0, u1, v0, u1, v1, u0, v1];
  const g = new THREE.BufferGeometry(), pos = [], uvs = [], nor = [];
  for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]); uvs.push(U[k * 2], U[k * 2 + 1]); nor.push(nx, 0, nz); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  part(key, g, { uv: 'keep', c, ...o });
}
// A skirt hung from yTop down to the streamed ground along a ring of [x, z] points: the model's footing where the ground falls away under it (both faces: it is seen from either side)
function skirt(key, ring, yTop, c, below = 0.3) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 3));
    for (let s = 0; s < k; s++) {
      const p = [a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k], q = [a[0] + (b[0] - a[0]) * (s + 1) / k, a[1] + (b[1] - a[1]) * (s + 1) / k];
      const y = Math.min(groundY(p[0], p[1]), groundY(q[0], q[1])) - below;
      if (y >= yTop - 0.05) continue;
      const uv = [0, y / 3, L / k / 3, yTop / 3];
      wallQuad(key, p, q, y, yTop, uv, c, { noao: true }); wallQuad(key, q, p, y, yTop, uv, c, { noao: true });
    }
  }
}
function roofPoly(key, pts, y, c, o = {}) {
  const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const P = [], N = [], U = [];
  for (const t of tris) {
    let a = pts[t[0]], b = pts[t[1]], cc = pts[t[2]];
    if ((b[1] - a[1]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[1] - a[1]) < 0) [b, cc] = [cc, b];
    for (const q of [a, b, cc]) { P.push(q[0], y, q[1]); N.push(0, 1, 0); U.push(q[0], q[1]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  part(key, g, { uv: 'keep', c, ...o });
}

// A generic palazzo facade painter: rows of windows over an ashlar wall. Wm x Hm metres on a w x h canvas.
function paintPalazzo(g, w, h, Wm, Hm, nb, cfg) {
  const sx = w / Wm, sy = h / Hm, bw = Wm / nb, r_ = R_(cfg.seed || 7);
  const X = (s) => s * sx, Y = (y) => h - y * sy;
  const rect = (s0, y0, s1, y1, f) => { g.fillStyle = f; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy); };
  paintAshlar(g, w, h, Wm, Hm, cfg.course || 0.6, cfg.block || 1.2, cfg.base, cfg.joint, cfg.seed || 7, 2, 0.06);
  // ground floor in heavier rustication
  if (cfg.rustic) { g.fillStyle = 'rgba(40,28,15,0.16)'; g.fillRect(0, Y(cfg.rustic), w, cfg.rustic * sy); for (let y = 0; y < cfg.rustic; y += 0.6) rect(0, y, Wm, y + 0.07, 'rgba(50,35,20,0.5)'); }
  for (const y of cfg.strings || []) { rect(0, y, Wm, y + 0.35, cfg.trim); rect(0, y, Wm, y + 0.07, 'rgba(40,30,20,0.4)'); }
  const frame = (s, y0, y1, ww, fr, glass, ped, arch) => {
    if (arch) {
      const r = ww / 2, yc = y1 - r;
      g.fillStyle = cfg.trim; g.fillRect(X(s - r - fr), Y(yc), (2 * r + 2 * fr) * sx, (yc - y0 + fr * 0.7) * sy);
      g.beginPath(); g.ellipse(X(s), Y(yc), (r + fr) * sx, (r + fr) * sy, 0, PI, 0); g.fill();
      g.fillStyle = glass; g.fillRect(X(s - r), Y(yc), 2 * r * sx, (yc - y0) * sy);
      g.beginPath(); g.ellipse(X(s), Y(yc), r * sx, r * sy, 0, PI, 0); g.fill();
      g.fillStyle = 'rgba(70,60,50,0.7)'; g.fillRect(X(s) - 1, Y(y1), 2, (y1 - y0) * sy); g.fillRect(X(s - r), Y((y0 + yc) / 2), 2 * r * sx, 2);
      return;
    }
    rect(s - ww / 2 - fr, y0 - fr * 0.7, s + ww / 2 + fr, y1 + fr, cfg.trim);
    rect(s - ww / 2, y0, s + ww / 2, y1, glass);
    g.fillStyle = 'rgba(15,12,10,0.35)'; g.fillRect(X(s - ww / 2), Y(y1), ww * sx, 0.18 * sy);
    g.fillStyle = 'rgba(60,40,30,0.5)'; g.fillRect(X(s) - 1, Y(y1), 2, (y1 - y0) * sy);
    if (y1 - y0 > 2.4) g.fillRect(X(s - ww / 2), Y((y0 + y1) / 2 + 0.6), ww * sx, 2);
    if (ped === 1) { g.fillStyle = cfg.trim; g.beginPath(); g.moveTo(X(s - ww / 2 - fr - 0.3), Y(y1 + fr)); g.lineTo(X(s), Y(y1 + fr + ww * 0.42)); g.lineTo(X(s + ww / 2 + fr + 0.3), Y(y1 + fr)); g.fill(); g.fillStyle = 'rgba(40,30,20,0.25)'; g.beginPath(); g.moveTo(X(s - ww / 2), Y(y1 + fr + 0.1)); g.lineTo(X(s), Y(y1 + fr + ww * 0.3)); g.lineTo(X(s + ww / 2), Y(y1 + fr + 0.1)); g.fill(); }
    if (ped === 2) { g.fillStyle = cfg.trim; g.beginPath(); g.ellipse(X(s), Y(y1 + fr), (ww / 2 + fr + 0.3) * sx, ww * 0.3 * sy, 0, PI, 0); g.fill(); }
  };
  for (let i = 0; i < nb; i++) {
    const s = (i + 0.5) * bw;
    if (cfg.skipBay && cfg.skipBay.includes(i)) continue;
    for (const row of cfg.rows) {
      if (row.skip && row.skip.includes(i)) continue;
      frame(s, row.y0, row.y1, row.w, row.fr || 0.22, row.glass || '#2e2824', row.ped ? (row.ped === 3 ? 1 + (i & 1) : row.ped) : 0, row.arch);
      if (row.bal) { rect(s - row.w / 2 - 0.5, row.y0 - 0.9, s + row.w / 2 + 0.5, row.y0 - 0.05, cfg.trim); g.fillStyle = 'rgba(60,45,30,0.55)'; for (let k = -row.w / 2 - 0.4; k <= row.w / 2 + 0.4; k += 0.22) g.fillRect(X(s + k), Y(row.y0 - 0.15), 2, 0.7 * sy); rect(s - row.w / 2 - 0.55, row.y0 - 0.1, s + row.w / 2 + 0.55, row.y0, 'rgba(40,30,20,0.5)'); }
    }
  }
  streaks(g, w, h, Math.round(Wm * 5), (cfg.seed || 7) + 3, 0.14, 180);
  const gr = g.createLinearGradient(0, h, 0, h - 5 * sy); gr.addColorStop(0, 'rgba(30,24,16,0.28)'); gr.addColorStop(1, 'rgba(30,24,16,0)'); g.fillStyle = gr; g.fillRect(0, h - 5 * sy, w, 5 * sy);
}

// ====================================================================================================
// 2. Fontana Pretoria and Palazzo delle Aquile
// ====================================================================================================
function ringWall(key, r0, r1, h, seg, M, c, cap = 0.12) {
  lathe(key, [[r0, 0], [r1, 0], [r1, h], [r1 + cap, h], [r1 + cap, h + 0.14], [r0 - cap * 0.5, h + 0.14], [r0 - cap * 0.5, h], [r0, h], [r0, 0]].slice(0, 9), seg, { M, c });
}
function pretoriaCentre() {   // the fountain's centre: the middle of the baked water polygons round (72, 26)
  let sx = 0, sz = 0, n = 0;
  for (const poly of (D.streets && D.streets.water) || []) {
    const o = poly[0]; let x = 0, z = 0; const m = o.length / 2;
    for (let i = 0; i < o.length; i += 2) { x += o[i]; z += o[i + 1]; }
    x /= m; z /= m;
    if (Math.hypot(x - 72, z - 26) < 30 && m > 8) { sx += x; sz += z; n++; }
  }
  return n ? [sx / n, sz / n] : [71, 25.6];
}
function buildPretoria() {
  CUR = 'Fontana Pretoria';
  const c = pretoriaCentre();
  // the piazza level round the fountain (the ground under the basin itself is the lidar's reading of the basin), and a skirt where it falls away
  const rg = []; for (let i = 0; i < 16; i++) { const a = i * PI / 8; rg.push(groundY(c[0] + 12 * Math.cos(a), c[1] + 12 * Math.sin(a))); }
  rg.sort((a, b) => a - b); const gy = (rg[7] + rg[8]) / 2; BASEY = gy;
  skirt('marble', Array.from({ length: 32 }, (_, i) => [c[0] + 12.05 * Math.cos(i * PI / 16), c[1] + 12.05 * Math.sin(i * PI / 16)]), gy + 0.12, '#bdb8a8');
  (KEEPOUT.circles || (KEEPOUT.circles = [])).push({ name: 'Fontana Pretoria', x: c[0], z: c[1], r: 12.2 });
  const at = (x, y, z, nx = 0, nz = 1) => frame(c[0] + x, gy + y, c[1] + z, nx, nz);
  const O = at(0, 0, 0);
  const W = '#dcd8cb', Wd = '#c8c4b6';
  // sunken floor and outer ring
  cyl('marble', 11.0, 11.0, 0.25, 28, { M: O, c: '#c9c4b4' });
  ringWall('marble', 10.1, 10.45, 0.85, 28, O, Wd);
  ringWall('marble', 6.9, 7.2, 1.45, 24, O, Wd);
  cyl('marble', 5.0, 5.0, 0.9, 20, { M: O, c: '#cfcabb' });
  // radial stair flights
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, nx = Math.cos(a), nz = Math.sin(a);
    for (let st = 0; st < 3; st++) {
      const r = 10.9 - st * 1.1 - 0.4;
      const M = frame(c[0] + nx * r, gy, c[1] + nz * r, nx, nz);
      box('marble', 3.0, 0.3 + st * 0.35 + 0.05, 1.1, { M, c: '#d6d2c4', p: [0, 0, 0] });
    }
  }
  // central fountain: three tiers
  cyl('marble', 3.4, 3.7, 0.6, 16, { M: at(0, 0.9, 0), c: '#d3cfc0' });
  lathe('marble', [[0, 0], [2.4, 0.1], [3.9, 0.45], [4.1, 0.8], [3.8, 0.8], [0, 0.4]], 18, { M: at(0, 1.5, 0), c: '#e0dccf' });
  cyl('marble', 0.8, 1.2, 1.8, 10, { M: at(0, 1.9, 0), c: '#d8d4c6' });
  lathe('marble', [[0, 0], [1.6, 0.1], [2.6, 0.45], [2.75, 0.75], [2.4, 0.75], [0, 0.35]], 16, { M: at(0, 3.5, 0), c: '#e0dccf' });
  cyl('marble', 0.45, 0.75, 1.3, 8, { M: at(0, 3.9, 0), c: '#d8d4c6' });
  lathe('marble', [[0, 0], [1.0, 0.1], [1.7, 0.35], [1.8, 0.6], [1.5, 0.6], [0, 0.3]], 14, { M: at(0, 5.0, 0), c: '#e0dccf' });
  cyl('marble', 0.25, 0.4, 1.2, 8, { M: at(0, 5.3, 0), c: '#d8d4c6' });
  sphere('marble', 0.55, { M: at(0, 6.9, 0), c: '#e0dccf', seg: 8 });
  statue('marble', at(0, 6.9, 0), 1.6, {});
  // statues: outer ring (facing out), inner ring, round the first basin
  const ring = (cnt, r, y, hs, ped, off = 0) => {
    for (let i = 0; i < cnt; i++) {
      const a = off + i * 2 * PI / cnt, nx = Math.cos(a), nz = Math.sin(a);
      const M = frame(c[0] + nx * r, gy + y, c[1] + nz * r, nx, nz);
      box('marble', 0.55, ped, 0.55, { M, c: '#cdc8b8' });
      statue('marble', mul(M, tr(0, ped, 0)), hs, {});
    }
  };
  ring(20, 10.3, 0.85, 1.9, 0.6, 0.1);
  ring(14, 7.05, 1.45, 1.7, 0.5, 0.2);
  ring(8, 3.2, 1.5, 1.5, 0.4, 0.4);
  // iron fence around the whole thing
  {
    const nn = 32, r = 12.0;
    for (let i = 0; i < nn; i++) {
      const a0 = i * 2 * PI / nn, a1 = (i + 1) * 2 * PI / nn, am = (a0 + a1) / 2;
      const len = 2 * r * Math.sin(PI / nn) * 1.01;
      const M = frame(c[0] + r * Math.cos(am), gy, c[1] + r * Math.sin(am), Math.cos(am), Math.sin(am));
      rail(M, len, 1.45);
      box('dark', 0.14, 1.6, 0.14, { M: frame(c[0] + r * Math.cos(a0), gy, c[1] + r * Math.sin(a0), 1, 0), c: '#26262b' });
    }
    ringWall('marble', 11.9, 12.1, 0.12, 32, O, '#bdb8a8', 0.04);
  }
}

function buildAquile(ctx) {
  CUR = 'Palazzo delle Aquile';
  const b = byId('w28002543'); if (!b) return;
  const pts = pairsOf(b.p), gy = minGround(pts); BASEY = gy;
  const H = Math.min(26, relH(b, 24)), y0 = gy - 0.6, y1 = gy + H;
  // front = the longest edge facing north (-z)
  let best = 0, bl = 0;
  for (let i = 0; i < pts.length; i++) { const e = edgeLR(pts, i); if (e.len > bl && e.nz < -0.5) { bl = e.len; best = i; } }
  const nb = 11;
  defMat('aqfront', mkTex(2048, 1024, (g, w, h) => paintPalazzo(g, w, h, bl, 24.4, nb, {
    base: '#c9a56a', joint: '#8a6f3e', trim: '#e9e2d0', strings: [6.2, 13.3, 19.6], rustic: 6.2, course: 0.62, block: 1.3, seed: 77,
    rows: [{ y0: 2.4, y1: 4.2, w: 1.0, fr: 0.2, skip: [5] }, { y0: 7.6, y1: 11.6, w: 1.4, fr: 0.28, ped: 3, bal: true, glass: '#3a2c26' }, { y0: 14.5, y1: 18.2, w: 1.3, fr: 0.25, glass: '#3a2c26' }, { y0: 20.4, y1: 21.9, w: 0.9, fr: 0.18 }],
  })), [bl, 24.4]);
  defMat('aqside', mkTex(512, 1024, (g, w, h) => paintPalazzo(g, w, h, bl / nb, 24.4, 1, {
    base: '#c9a56a', joint: '#8a6f3e', trim: '#e9e2d0', strings: [6.2, 13.3, 19.6], rustic: 6.2, course: 0.62, block: 1.3, seed: 78,
    rows: [{ y0: 2.4, y1: 4.2, w: 1.0, fr: 0.2 }, { y0: 7.6, y1: 11.6, w: 1.4, fr: 0.28, ped: 1, bal: true, glass: '#3a2c26' }, { y0: 14.5, y1: 18.2, w: 1.3, fr: 0.25, glass: '#3a2c26' }, { y0: 20.4, y1: 21.9, w: 0.9, fr: 0.18 }],
  })), [bl / nb, 24.4]);
  const Ht = 24.4;
  for (let i = 0; i < pts.length; i++) {
    const e = edgeLR(pts, i);
    if (i === best) wallQuad('aqfront', e.L, e.R, y0, y1, [0, (y0 - gy) / Ht, 1, (y1 - gy) / Ht], '#ffffff');
    else wallQuad('aqside', e.L, e.R, y0, y1, [0, (y0 - gy) / Ht, e.len / (bl / nb), (y1 - gy) / Ht], '#f2ebe0');
    // cornice
    const m = [(e.L[0] + e.R[0]) / 2, (e.L[1] + e.R[1]) / 2];
    box('ashlar', e.len + 0.9, 1.1, 1.0, { p: [m[0] + e.nx * 0.45, y1 - 1.1, m[1] + e.nz * 0.45], ry: Math.atan2(-(e.R[1] - e.L[1]), e.R[0] - e.L[0]), c: '#d0b17a' });
  }
  roofPoly('flat', pts, y1 + 0.05, '#8d8a80', { noao: true });
  ctx.skip.add(b.id);
  // front details
  const e = edgeLR(pts, best);
  const mx = (e.L[0] + e.R[0]) / 2, mz = (e.L[1] + e.R[1]) / 2;
  const F = (s, y, z) => mul(frame(mx, gy, mz, e.nx, e.nz), tr(s, y, z));
  // steps along the front
  for (let st = 0; st < 4; st++) box('ashlar', e.len + 1.0 - st * 0.0, 0.17 * (4 - st), 0.55, { M: F(0, 0, 0.5 + st * 0.55 + 0.275 - 0.0), c: '#cdbf9f' });
  // portal with columns and balcony above
  for (const sg of [-1, 1]) { cyl('marble', 0.3, 0.33, 4.6, 10, { M: F(sg * 1.9, 0.5, 0.9), c: '#d2cdbd' }); box('marble', 0.8, 0.4, 0.8, { M: F(sg * 1.9, 0.1, 0.9), c: '#d2cdbd' }); }
  box('marble', 5.2, 0.6, 1.6, { M: F(0, 5.1, 0.8), c: '#d8d3c3' });
  box('marble', 5.6, 0.3, 1.8, { M: F(0, 5.7, 0.9), c: '#d8d3c3' });
  rail(F(0, 6.0, 1.7), 5.5, 1.0); rail(F(-2.8, 6.0, 0.9), 1.6, 1.0, { ry: PI / 2 }); rail(F(2.8, 6.0, 0.9), 1.6, 1.0, { ry: PI / 2 });
  box('dark', 2.4, 4.0, 0.1, { M: F(0, 0.5, 0.12), c: '#2a2420', noao: true });
  // balconies on the neighbouring piano nobile windows
  const bw = bl / nb;
  for (const k of [-2, -1, 1, 2]) { box('marble', 2.1, 0.22, 0.7, { M: F(-k * bw, 6.9, 0.35), c: '#d8d3c3' }); rail(F(-k * bw, 7.1, 0.65), 2.0, 0.85); }
  // bell gable with the clock, left of centre as seen from the piazza
  const gs = -bw * 2.5;
  box('ashlar', 2.6, 1.8, 1.0, { M: F(gs, Ht - 0.2, 0.0), c: '#d6bb85' });
  box('ashlar', 2.0, 2.2, 0.8, { M: F(gs, Ht + 1.4, 0.0), c: '#d6bb85' });
  part('marble', shapeGeo(archShape(1.7, 1.9), 0.5), { M: F(gs, Ht + 3.4, -0.25), c: '#e0d8c6' });
  cyl('marble', 0.7, 0.7, 0.12, 14, { M: mul(F(gs, Ht + 2.2, 0.45), new THREE.Matrix4().makeRotationX(PI / 2)), c: '#f0ead8' });
  // eagle statue at the corner
  const eR = e.R; box('marble', 0.8, 1.2, 0.8, { p: [eR[0], y1, eR[1]], c: '#d8d3c3' }); sphere('marble', 0.5, { p: [eR[0], y1 + 1.9, eR[1]], c: '#d8d3c3', ky: 1.2, seg: 6 });
}


// ---------- massing from lidar parts ----------
// Extrude each lidar part of a building to its roof height with textured walls. wallFor(rel) -> {key, bw, th}
function massing(b, wallFor, o = {}) {
  const gy = minGround(pairsOf(b.p));
  const gref = b.g !== undefined ? b.g : 0;
  const parts = (b.parts && b.parts.length) ? b.parts.map(q => ({ pts: pairsOf(q[0]), rel: q[1] - gref })) : [{ pts: pairsOf(b.p), rel: relH(b, b.h) }];
  const inP = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const out = [];
  let hiIdx = 0; parts.forEach((q, i) => { if (q.rel > parts[hiIdx].rel) hiIdx = i; });
  const hiRel = parts[hiIdx].rel;
  if (o.cap) parts[hiIdx].rel = o.cap;
  parts.forEach((pt, pi) => {
    if (o.omit && o.omit(pt.pts)) { pt.omitted = true; return; }
    const top = gy + pt.rel, wm = wallFor(pt.rel), pts = pt.pts;
    for (let i = 0; i < pts.length; i++) {
      const e = edgeLR(pts, i);
      if (e.len < 0.05) continue;
      const dx = (e.R[0] - e.L[0]) / e.len, dz = (e.R[1] - e.L[1]) / e.len;
      const u0 = (e.L[0] * dx + e.L[1] * dz) / wm.bw;
      wallQuad(wm.key, e.L, e.R, gy - 0.8, top, [u0, (gy - 0.8 - gy) / wm.th, u0 + e.len / wm.bw, pt.rel / wm.th], wm.c || '#ffffff');
      // is this edge on the outside, or above a lower neighbour?
      const mx = (e.L[0] + e.R[0]) / 2 + e.nx * 0.6, mz = (e.L[1] + e.R[1]) / 2 + e.nz * 0.6;
      let nb = null; parts.forEach((q, qi) => { if (qi !== pi && !q.omitted && inP(mx, mz, q.pts)) nb = q; });
      const exposed = !nb || nb.rel < pt.rel - 0.5;
      out.push({ e, top, exposed, lowerBy: nb ? pt.rel - nb.rel : 99, rel: pt.rel });
    }
    roofPoly(o.roofKey || 'flat', pts, top + 0.04, o.roofC || '#8d8a80', { noao: true });
  });
  return { gy, parts, edges: out, hiRel, hiIdx };
}
function orientedBox(key, L, R, y, h, d, off, c) {
  const dx = R[0] - L[0], dz = R[1] - L[1], l = Math.hypot(dx, dz);
  if (l < 0.05) return;
  const nx = -dz / l, nz = dx / l;
  box(key, l, h, d, { p: [(L[0] + R[0]) / 2 + nx * off, y, (L[1] + R[1]) / 2 + nz * off], ry: Math.atan2(-dz, dx), c });
}
function merlons(key, L, R, y, c, step = 1.4, w = 0.7, h = 0.9, d = 0.55) {
  const dx = R[0] - L[0], dz = R[1] - L[1], l = Math.hypot(dx, dz);
  if (l < 1) return;
  const nx = -dz / l, nz = dx / l, ry = Math.atan2(-dz, dx), n = Math.max(1, Math.floor(l / step));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    box(key, w, h, d, { p: [L[0] + dx * t - nx * d * 0.5, y, L[1] + dz * t - nz * d * 0.5], ry, c });
  }
}

// ====================================================================================================
// 3. Teatro Massimo
// ====================================================================================================
function lion(M, c = '#3a3126') {
  box('bronze', 0.95, 0.8, 1.7, { M, p: [0, 0.2, -0.2], c });
  box('bronze', 0.9, 1.2, 0.75, { M, p: [0, 0.2, 0.55], c });
  sphere('bronze', 0.5, { M, p: [0, 1.15, 0.8], c, ky: 1.05, seg: 6 });
  sphere('bronze', 0.36, { M, p: [0, 1.15, 1.15], c, seg: 6 });
  for (const sx of [-0.27, 0.27]) box('bronze', 0.24, 0.7, 0.3, { M, p: [sx, 0, 1.0], c });
  box('bronze', 0.12, 0.12, 1.1, { M, p: [0.2, 0.55, -1.2], c, rx: -0.4 });
}
function corinthian(M, h, r, c) {
  box('marble', r * 2.4, 0.45, r * 2.4, { M, c });
  cyl('marble', r * 0.9, r, h - 2.0, 12, { M: mul(M, tr(0, 0.45, 0)), c });
  lathe('marble', [[r * 0.9, 0], [r * 1.0, 0.25], [r * 1.35, 0.9], [r * 1.5, 1.35], [0, 1.35]], 12, { M: mul(M, tr(0, h - 1.55, 0)), c });
  box('marble', r * 3.1, 0.22, r * 3.1, { M: mul(M, tr(0, h - 0.22, 0)), c });
}
function buildTeatro(ctx) {
  CUR = 'Teatro Massimo';
  const b = byId('w24937131'); if (!b) return;
  const stoneC = '#d2bc92';
  defMat('teWing', mkTex(512, 1024, (g, w, h) => paintPalazzo(g, w, h, 4.8, 24, 1, {
    base: '#d8c196', joint: '#9b8460', trim: '#efe6d0', strings: [8.6, 19.4], rustic: 0, course: 0.7, block: 1.4, seed: 91,
    rows: [{ y0: 2.4, y1: 7.6, w: 1.9, fr: 0.3, arch: true, glass: '#2c3a52' }, { y0: 11.0, y1: 16.6, w: 1.7, fr: 0.28, arch: true, glass: '#2c3a52' }, { y0: 21, y1: 22.2, w: 1.0, fr: 0.18 }],
  })), [4.8, 24]);
  defMat('tePlain', mkTex(512, 1024, (g, w, h) => paintPalazzo(g, w, h, 8, 24, 1, {
    base: '#cdb88d', joint: '#9b8460', trim: '#e6dcc4', strings: [19.8], course: 0.7, block: 1.5, seed: 92,
    rows: [{ y0: 6, y1: 8.6, w: 1.2, fr: 0.2 }, { y0: 13, y1: 15.6, w: 1.2, fr: 0.2 }],
  })), [8, 24]);
  const FN = [0.41, 0.912], fn = Math.hypot(FN[0], FN[1]);
  const m = massing(b, rel => rel > 32 ? { key: 'tePlain', bw: 8, th: 24 } : { key: 'teWing', bw: 4.8, th: 24 }, {
    roofKey: 'tile', roofC: '#d9b9a8', cap: 27,
    omit: (pts) => { const c = centroid(pts); return (c[0] * FN[0] + c[1] * FN[1]) / fn - ((-353) * FN[0] + (-492) * FN[1]) / fn > 24; },
  });
  const gy = m.gy; BASEY = gy;
  // cornice over every exposed edge of the lower parts
  for (const ed of m.edges) if (ed.exposed && ed.rel < 32) orientedBox('ashlar', ed.e.L, ed.e.R, ed.top - 0.9, 0.9, 1.0, 0.4, '#d8c49c');
  // dome on the highest part
  const hi = m.parts[m.hiIdx];
  const cen = centroid(hi.pts); let rr = 99; for (const p of hi.pts) rr = Math.min(rr, Math.hypot(p[0] - cen[0], p[1] - cen[1]));
  const Rd = rr * 0.93, yb = gy + hi.rel, domeH = m.hiRel - hi.rel - 4.5;
  const Cd = (y) => tr(cen[0], y, cen[1]);
  cyl('ashlar', Rd * 1.04, Rd * 1.04, 1.4, 24, { M: Cd(yb - 0.1), c: '#d8c49c' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i * PI / 2 / 8; prof.push([Rd * Math.cos(a) * (i === 8 ? 0.001 : 1), 0.0 + Math.sin(a) * domeH]); }
  lathe('lead', prof, 24, { M: Cd(yb + 1.2), c: '#c9cdc4' });
  cyl('ashlar', 1.5, 1.7, 3.0, 10, { M: Cd(yb + 1.2 + domeH - 0.4), c: '#d6c39b' });
  lathe('lead', [[1.7, 0], [1.2, 0.8], [0.1, 1.6]], 10, { M: Cd(yb + 1.2 + domeH + 2.4), c: '#c9cdc4' });
  // portico, stairs, lions: local frame on the dome axis, +z toward the piazza
  const f = [0.41, 0.912], fl = Math.hypot(f[0], f[1]); const nx = f[0] / fl, nz = f[1] / fl;
  const F = (x, y, z) => mul(frame(cen[0], gy, cen[1], nx, nz), tr(x, y, z));
  const t0 = -3.5;
  const sf = 14.5, pf = 26.5;           // portico back / front planes
  const PH = 3.6;                       // podium height
  box('ashlar', 28, PH, pf - sf, { M: F(t0, 0, (pf + sf) / 2), c: '#cbb88f' });
  for (let i = 0; i < 24; i++) box('ashlar', 22, PH * (24 - i) / 24, 0.53, { M: F(t0, 0, pf + 0.265 + i * 0.53 - 0.0), c: '#d6c7a2' });
  // cheek walls beside the stairs, stepping down to a plinth at the foot that carries the lion
  const cheek = [4.4, 3.9, 3.5, 3.2, 2.8];
  for (const sg of [-1, 1]) cheek.forEach((h, i) => box('ashlar', 2.4, h, 2.6, { M: F(t0 + sg * 12.3, 0, pf + 1.3 + i * 2.6), c: '#cbb88f' }));
  // red back wall of the portico with three doors
  box('flat', 24, 12.4, 0.3, { M: F(t0, PH, sf + 0.2), c: '#5d3043', noao: true });
  for (const x of [-6.5, 0, 6.5]) part('dark', shapeGeo(archShape(2.6, 6.2), 0.1), { M: F(t0 + x, PH, sf + 0.4), uv: 'keep', c: '#1f1a1a', noao: true });
  for (const x of [-3.2, 3.2]) part('dark', shapeGeo(archShape(1.6, 4.2), 0.1), { M: F(t0 + x, PH + 3, sf + 0.4), uv: 'keep', c: '#40272f', noao: true });
  // columns
  const colH = 11.8, cy = PH;
  const xs = [-10.5, -6.3, -2.1, 2.1, 6.3, 10.5];
  for (const x of xs) corinthian(F(t0 + x, cy, pf - 1.2), colH, 0.78, '#d6c7a4');
  for (const sg of [-1, 1]) for (const z of [pf - 5.2, pf - 9.2]) corinthian(F(t0 + sg * 10.5, cy, z), colH, 0.78, '#d6c7a4');
  // entablature and pediment
  const ey = cy + colH;
  box('ashlar', 25.4, 1.2, pf - sf + 0.5, { M: F(t0, ey, (pf + sf) / 2 + 0.2), c: '#d9c9a5' });
  box('ashlar', 26.2, 1.1, pf - sf + 0.8, { M: F(t0, ey + 1.2, (pf + sf) / 2 + 0.3), c: '#e0d1ae' });
  const ped = new THREE.Shape(); ped.moveTo(-13.4, 0); ped.lineTo(13.4, 0); ped.lineTo(0, 4.8); ped.lineTo(-13.4, 0);
  part('ashlar', shapeGeo(ped, pf - sf + 0.6), { M: F(t0, ey + 2.3, sf - 0.2), c: '#d9c9a5' });
  // tympanum sculpture and acroteria
  box('marble', 6, 1.4, 0.2, { M: F(t0, ey + 2.9, pf + 0.45), c: '#cbbd9b' });
  for (const x of [-13.2, 13.2]) box('ashlar', 1.0, 1.4, 1.0, { M: F(t0 + x, ey + 2.3, pf), c: '#d9c9a5' });
  box('ashlar', 1.2, 1.5, 1.0, { M: F(t0, ey + 7.1, pf - 0.2), c: '#d9c9a5' });
  // bronze lions on the plinths at the foot of the stairs
  for (const sg of [-1, 1]) lion(mul(F(t0 + sg * 12.3, 2.8, pf + 11.9), new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)), '#5b4b36');
  // garden wall / fence in front (low stone wall with iron)
  ctx.skip.add(b.id);
}

// ====================================================================================================
// 4. Cattedrale
// ====================================================================================================
function pointedPath(w, h, sh) {
  const p = new THREE.Path(), r = w / 2;
  p.moveTo(-r, 0); p.lineTo(-r, sh); p.quadraticCurveTo(-r, sh + (h - sh) * 0.85, 0, h); p.quadraticCurveTo(r, sh + (h - sh) * 0.85, r, sh); p.lineTo(r, 0); p.lineTo(-r, 0);
  return p;
}
function paintCatBay(g, w, h, Wm, Hm) {
  const sx = w / Wm, sy = h / Hm, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, Wm, Hm, 0.55, 1.0, '#d3b684', '#8f7650', 131, 2, 0.06);
  const rect = (a, b, c, d, f) => { g.fillStyle = f; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  const bays = Math.round(Wm / 3);
  for (let i = 0; i < bays; i++) {
    const cx = (i + 0.5) * Wm / bays, bw = Wm / bays;
    // pointed blind arch, lighter border, inset darker
    g.fillStyle = '#e4cc9b';
    g.beginPath(); g.moveTo(X(cx - bw * 0.42), Y(0)); g.lineTo(X(cx - bw * 0.42), Y(6.6)); g.quadraticCurveTo(X(cx - bw * 0.42), Y(10.6), X(cx), Y(11.8)); g.quadraticCurveTo(X(cx + bw * 0.42), Y(10.6), X(cx + bw * 0.42), Y(6.6)); g.lineTo(X(cx + bw * 0.42), Y(0)); g.fill();
    g.fillStyle = '#c3a674';
    g.beginPath(); g.moveTo(X(cx - bw * 0.34), Y(0)); g.lineTo(X(cx - bw * 0.34), Y(6.6)); g.quadraticCurveTo(X(cx - bw * 0.34), Y(10.0), X(cx), Y(11.0)); g.quadraticCurveTo(X(cx + bw * 0.34), Y(10.0), X(cx + bw * 0.34), Y(6.6)); g.lineTo(X(cx + bw * 0.34), Y(0)); g.fill();
    // narrow window
    g.fillStyle = '#3a342d'; g.beginPath(); g.moveTo(X(cx - 0.32), Y(5.4)); g.lineTo(X(cx - 0.32), Y(8.2)); g.quadraticCurveTo(X(cx - 0.32), Y(9.0), X(cx), Y(9.6)); g.quadraticCurveTo(X(cx + 0.32), Y(9.0), X(cx + 0.32), Y(8.2)); g.lineTo(X(cx + 0.32), Y(5.4)); g.fill();
  }
  // the interlaced arcade (the Arab-Norman intersecting pointed arches in dark lava and pale tuff) under the cornice: two rows of arches half a period apart cross each other
  for (let row = 0; row < 2; row++) {
    for (let k = -1; k < Wm / 0.75 + 1; k++) {
      const ax = k * 0.75 + row * 0.375, r = 0.75;
      if ((k + row) % 2 && false) continue;
      g.strokeStyle = row ? '#4d4033' : '#6d5a40'; g.lineWidth = 0.17 * sx;
      g.beginPath(); g.moveTo(X(ax - r), Y(12.55)); g.quadraticCurveTo(X(ax - r), Y(12.55 + r * 1.1), X(ax), Y(12.55 + r * 1.55)); g.quadraticCurveTo(X(ax + r), Y(12.55 + r * 1.1), X(ax + r), Y(12.55)); g.stroke();
      g.strokeStyle = 'rgba(240,222,176,0.7)'; g.lineWidth = 0.06 * sx;
      g.beginPath(); g.moveTo(X(ax - r + 0.1), Y(12.55)); g.quadraticCurveTo(X(ax - r + 0.1), Y(12.55 + r * 1.05), X(ax), Y(12.55 + r * 1.45)); g.quadraticCurveTo(X(ax + r - 0.1), Y(12.55 + r * 1.05), X(ax + r - 0.1), Y(12.55)); g.stroke();
    }
  }
  for (let k = 0; k < Wm / 0.75; k++) { g.fillStyle = '#3a3128'; g.beginPath(); g.arc(X(k * 0.75 + 0.375), Y(13.0), 0.1 * sx, 0, 7); g.fill(); }   // the lava inlays at the crossings

  rect(0, 12.1, Wm, 12.35, '#e4cc9b'); rect(0, 14.6, Wm, 15.4, '#dcc28e'); rect(0, 14.55, Wm, 14.7, 'rgba(60,40,20,0.5)');
  // polychrome band
  for (let x = 0; x < Wm; x += 0.5) rect(x, 14.0, x + 0.25, 14.4, '#6d5a40');
  streaks(g, w, h, 60, 133, 0.12, 200);
  const gr = g.createLinearGradient(0, h, 0, h - 4 * sy); gr.addColorStop(0, 'rgba(30,24,16,0.25)'); gr.addColorStop(1, 'rgba(30,24,16,0)'); g.fillStyle = gr; g.fillRect(0, h - 4 * sy, w, 4 * sy);
}
function paintTower(g, w, h) {
  paintAshlar(g, w, h, 5.6, 11, 0.5, 0.9, '#d1b27e', '#8d744d', 141, 2, 0.06);
  const sx = w / 5.6, sy = h / 11, X = (s) => s * sx, Y = (y) => h - y * sy;
  for (let tier = 0; tier < 3; tier++) {
    const y0 = 0.8 + tier * 3.5;
    for (let k = 0; k < 2; k++) {
      const cx = 1.9 + k * 1.8;
      g.fillStyle = '#e0c690'; g.beginPath(); g.moveTo(X(cx - 0.62), Y(y0)); g.lineTo(X(cx - 0.62), Y(y0 + 1.7)); g.quadraticCurveTo(X(cx - 0.62), Y(y0 + 2.6), X(cx), Y(y0 + 2.9)); g.quadraticCurveTo(X(cx + 0.62), Y(y0 + 2.6), X(cx + 0.62), Y(y0 + 1.7)); g.lineTo(X(cx + 0.62), Y(y0)); g.fill();
      g.fillStyle = tier === 2 ? '#2c2824' : '#51463a'; g.beginPath(); g.moveTo(X(cx - 0.42), Y(y0)); g.lineTo(X(cx - 0.42), Y(y0 + 1.7)); g.quadraticCurveTo(X(cx - 0.42), Y(y0 + 2.3), X(cx), Y(y0 + 2.6)); g.quadraticCurveTo(X(cx + 0.42), Y(y0 + 2.3), X(cx + 0.42), Y(y0 + 1.7)); g.lineTo(X(cx + 0.42), Y(y0)); g.fill();
    }
    g.fillStyle = '#dcc28e'; g.fillRect(0, Y(y0 + 3.3), w, 0.2 * sy);
  }
  streaks(g, w, h, 20, 142, 0.14, 120);
}
// The cathedral's drum, dome, belfry and clock, painted. One drum tile is a sixteenth of the circumference.
function paintDrum(g, w, h) {   // w x h = 1/16 of the circumference (about 3.7 m) by 6 m
  const sx = w / 3.7, sy = h / 6, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, 3.7, 6, 0.5, 1.0, '#d6bb88', '#8d744d', 171, 2, 0.06);
  const rect = (a, b, c, d, f) => { g.fillStyle = f; g.fillRect(X(a), Y(d), (c - a) * sx, (d - b) * sy); };
  rect(0.0, 0, 0.16, 5.2, '#bda573'); rect(3.54, 0, 3.7, 5.2, '#bda573'); rect(0.16, 0, 0.3, 5.2, '#e8d3a3'); rect(3.4, 0, 3.54, 5.2, '#e8d3a3');      // the paired pilasters at the seams
  rect(0.7, 1.0, 3.0, 4.5, '#e4cc9b'); rect(0.9, 1.2, 2.8, 4.3, '#2a2d34');                                                                          // the window and its frame
  g.fillStyle = '#e4cc9b'; g.beginPath(); g.moveTo(X(0.9), Y(4.3)); g.quadraticCurveTo(X(1.85), Y(5.2), X(2.8), Y(4.3)); g.fill();
  g.strokeStyle = '#6a7580'; g.lineWidth = 2; for (const x of [1.5, 2.15]) { g.beginPath(); g.moveTo(X(x), Y(1.2)); g.lineTo(X(x), Y(4.4)); g.stroke(); }  // glazing bars
  rect(0, 5.2, 3.7, 6.0, '#dcc28e'); rect(0, 5.2, 3.7, 5.34, 'rgba(60,40,20,0.55)');                                                                 // the cornice and its shadow
  for (let x = 0.2; x < 3.7; x += 0.5) rect(x, 5.4, x + 0.25, 5.7, '#8d744d');                                                                         // dentils
  streaks(g, w, h, 8, 172, 0.16, 90);
}
function paintDome(g, w, h) {   // one gore of the dome: lead panels between ribs
  g.fillStyle = '#5f6b75'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a4adb2'; g.fillRect(0, 0, 3, h); g.fillStyle = '#3d474f'; g.fillRect(3, 0, 2, h);                                                  // the rib and its shadow
  for (let y = 10; y < h; y += 14) { g.fillStyle = 'rgba(30,38,44,0.35)'; g.fillRect(5, y, w - 5, 1); }                                                 // the lead roll joints
  streaks(g, w, h, 6, 181, 0.14, 120);
}
function paintBelfry(g, w, h) {   // one face of the belfry stage, 5 x 6 m: twin pointed openings on colonnettes under a relieving arch, a blind arcade below
  const sx = w / 5, sy = h / 6, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, 5, 6, 0.5, 0.9, '#d4b67f', '#8d744d', 191, 2, 0.06);
  const arch = (cx, y0, hw, hs, top, f) => { g.fillStyle = f; g.beginPath(); g.moveTo(X(cx - hw), Y(y0)); g.lineTo(X(cx - hw), Y(y0 + hs)); g.quadraticCurveTo(X(cx - hw), Y(y0 + top * 0.85), X(cx), Y(y0 + top)); g.quadraticCurveTo(X(cx + hw), Y(y0 + top * 0.85), X(cx + hw), Y(y0 + hs)); g.lineTo(X(cx + hw), Y(y0)); g.fill(); };
  arch(2.5, 0.4, 2.0, 2.4, 4.2, '#e4cc9b'); arch(2.5, 0.4, 1.8, 2.3, 3.95, '#c9ad7a');                  // the relieving arch
  for (const cx of [1.65, 3.35]) { arch(cx, 0.6, 0.6, 1.6, 2.6, '#e8d3a3'); arch(cx, 0.6, 0.42, 1.55, 2.4, '#26221f'); }
  g.fillStyle = '#e8d3a3'; g.fillRect(X(2.42), Y(2.3), 0.16 * sx, 1.7 * sy);                              // the colonnette between them
  g.fillStyle = '#dcc28e'; g.fillRect(0, Y(4.9), w, 0.3 * sy);
  for (let k = 0; k < 6; k++) arch(0.42 + k * 0.83, 4.95, 0.3, 0.45, 0.85, '#8d744d');                    // the little blind arcade under the cornice
  streaks(g, w, h, 6, 192, 0.14, 100);
}
function paintClock(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#3a342d'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 7); g.fill();
  g.fillStyle = '#efe9d8'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 9, 0, 7); g.fill();
  g.strokeStyle = '#2b2620'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * (w / 2 - 32), h / 2 - Math.cos(a) * (w / 2 - 32)); g.lineTo(w / 2 + Math.sin(a) * (w / 2 - 14), h / 2 - Math.cos(a) * (w / 2 - 14)); g.stroke(); }
  g.fillStyle = '#2b2620'; g.font = `bold ${(w * 0.11) | 0}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [t, a] of [['XII', 0], ['III', PI / 2], ['VI', PI], ['IX', 3 * PI / 2]]) g.fillText(t, w / 2 + Math.sin(a) * (w / 2 - 50), h / 2 - Math.cos(a) * (w / 2 - 50));
  g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(2.6) * w * 0.26, h / 2 - Math.cos(2.6) * w * 0.26); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(5.05) * w * 0.36, h / 2 - Math.cos(5.05) * w * 0.36); g.stroke();
}
function paintInscription(g, w, h) {
  g.fillStyle = '#e6e0d0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a8272'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#3a342d'; g.font = `bold ${(h * 0.5) | 0}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OPERIBVS CREDITE', w / 2, h / 2 + 1);
}
function buildCattedrale(ctx) {
  CUR = 'Cattedrale';
  const b = byId('w49750033'); if (!b) return;
  defMat('catWall', mkTex(512, 1024, (g, w, h) => paintCatBay(g, w, h, 6, 16)), [6, 16]);
  defMat('catTower', mkTex(256, 512, paintTower), [5.6, 11]);
  const m = massing(b, rel => ({ key: 'catWall', bw: 6, th: 16 }), { roofKey: 'flat', roofC: '#9a9280', cap: 30 });
  const gy = m.gy; BASEY = gy;
  for (const ed of m.edges) if (ed.exposed) {
    orientedBox('ashlar', ed.e.L, ed.e.R, ed.top - 0.2, 0.5, 0.9, 0.35, '#dcc28e');
    merlons('ashlar', ed.e.R, ed.e.L, ed.top + 0.3, '#d5b985');
  }
  // central dome (Fuga's, 1801): a round drum with paired pilasters and windows under a cornice with pinnacles, the ribbed ogival lead dome, the lantern with its little cupola and cross
  const hi = m.parts[m.hiIdx];
  const cen = centroid(hi.pts); let rr = 99; for (const p of hi.pts) rr = Math.min(rr, Math.hypot(p[0] - cen[0], p[1] - cen[1]));
  const Rd = rr * 0.78, drumTop = gy + hi.rel, dH = m.hiRel - hi.rel - 9;
  const Cd = (y) => tr(cen[0], y, cen[1]);
  defMat('catDrum', mkTex(256, 416, paintDrum), [3.7, 6]);
  defMat('catDome', mkTex(64, 256, paintDome), [1, 1]);
  const Hd = 6.0;
  cyl('ashlar', Rd * 1.12, Rd * 1.12, 0.9, 16, { M: Cd(drumTop - 0.2), c: '#d5b985' });                                                         // the base ring on the roof
  cyl('catDrum', Rd, Rd, Hd, 16, { M: Cd(drumTop + 0.7), c: '#ffffff', uv: 'keep', uvk: [16, 1] });
  cyl('ashlar', Rd * 1.1, Rd * 1.1, 0.5, 16, { M: Cd(drumTop + 0.7 + Hd), c: '#dcc28e' });
  for (let k = 0; k < 16; k++) { const a = k * TWO / 16; cyl('ashlar', 0.22, 0.28, 1.5, 6, { M: mul(Cd(drumTop + 0.7 + Hd + 0.4), tr(Math.cos(a) * Rd * 1.04, 0, Math.sin(a) * Rd * 1.04)), c: '#d5b985' }); cyl('ashlar', 0, 0.22, 0.7, 6, { M: mul(Cd(drumTop + 0.7 + Hd + 1.9), tr(Math.cos(a) * Rd * 1.04, 0, Math.sin(a) * Rd * 1.04)), c: '#d5b985' }); }   // a pinnacle over every pilaster
  const DH = Math.max(7.5, dH), yd = drumTop + 0.7 + Hd + 0.5;
  const prof = []; for (let i = 0; i <= 12; i++) { const a = i * PI / 2 / 12; prof.push([Rd * 0.97 * Math.pow(Math.cos(a), 1.05) * (i === 12 ? 0.001 : 1), Math.pow(Math.sin(a), 0.8) * DH]); }
  lathe('catDome', prof, 16, { M: Cd(yd), c: '#ffffff', uv: 'keep', uvk: [16, 1] });
  const yl = yd + DH - 0.4;                                                                                                                         // the lantern: eight arched openings, a cornice, the cupola, the cross
  cyl('ashlar', 2.0, 2.2, 3.0, 8, { M: Cd(yl), c: '#dcc28e' });
  for (let k = 0; k < 8; k++) { const a = k * TWO / 8 + PI / 8; box('dark', 0.55, 1.6, 0.2, { M: mul(Cd(yl + 0.7), mul(rotY(-a + PI / 2), tr(Math.cos(a) * 2.08, 0, Math.sin(a) * 2.08))), c: '#2a2d34', noao: true }); }
  cyl('ashlar', 2.4, 2.4, 0.4, 8, { M: Cd(yl + 3.0), c: '#d5b985' });
  lathe('catDome', [[2.1, 0], [2.0, 0.6], [1.5, 1.4], [0.7, 2.0], [0.12, 2.35]], 8, { M: Cd(yl + 3.4), c: '#ffffff', uv: 'keep', uvk: [8, 1] });
  box('flat', 0.14, 1.6, 0.14, { M: Cd(yl + 5.6), c: '#2b2620', noao: true }); box('flat', 0.7, 0.14, 0.14, { M: Cd(yl + 6.3), c: '#2b2620', noao: true });
  // corner towers
  const E = [0.891, -0.454], S = [0.454, 0.891], O = [-458, 152];
  const L = (e, s) => [O[0] + e * E[0] + s * S[0], O[1] + e * E[1] + s * S[1]];
  const ang = Math.atan2(-E[1], E[0]);
  // The towers (the clock tower and its three companions): the painted shaft with corner colonnettes, a string course, the belfry stage with twin pointed openings
  // under relieving arches, corner turrets with their little cones, a gable on each face and the octagonal spire; the clock tower also has its clock and its inscription.
  defMat('belfry', mkTex(320, 384, paintBelfry), [5, 6]);
  defMat('clock', mkTex(256, 256, paintClock), [1, 1], { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });
  defMat('inscr', mkTex(384, 48, paintInscription), [1, 1]);
  const tower = (e, s, H, spire, clock) => {
    const [x, z] = L(e, s), M = (y) => mul(tr(x, y, z), rotY(ang));
    const y0 = gy, Hs = H - 9.2;                      // Hs: the shaft up to the string course below the belfry
    box('ashlar', 6.6, 1.2, 6.6, { M: M(y0 - 0.8), c: '#c9ad7c' });
    box('catTower', 5.6, Hs - 0.4, 5.6, { M: M(y0 + 0.4), c: '#ffffff' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl('ashlar', 0.26, 0.3, Hs - 0.4, 6, { M: mul(M(y0 + 0.4), tr(sx * 2.85, 0, sz * 2.85)), c: '#d5b985' });   // corner colonnettes
    box('ashlar', 6.3, 0.8, 6.3, { M: M(y0 + Hs), c: '#dcc28e' });
    box('ashlar', 6.0, 0.35, 6.0, { M: M(y0 + Hs + 0.8), c: '#e4cc9b' });
    // the belfry stage
    const yb = y0 + Hs + 1.15;
    box('belfry', 5.0, 6.0, 5.0, { M: M(yb), c: '#ffffff' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl('ashlar', 0.22, 0.25, 6.0, 6, { M: mul(M(yb), tr(sx * 2.6, 0, sz * 2.6)), c: '#e0c690' });
    box('ashlar', 5.9, 0.5, 5.9, { M: M(yb + 6.0), c: '#dcc28e' });
    box('ashlar', 5.5, 0.2, 5.5, { M: M(yb + 6.5), c: '#e4cc9b' });
    // the turrets and the gables
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('ashlar', 0.4, 0.5, 2.2, 6, { M: mul(M(yb + 6.5), tr(sx * 2.55, 0, sz * 2.55)), c: '#d5b985' }); cyl('ashlar', 0, 0.45, 1.5, 6, { M: mul(M(yb + 8.7), tr(sx * 2.55, 0, sz * 2.55)), c: '#c9ad7c' }); }
    const gab = new THREE.Shape(); gab.moveTo(-2.3, 0); gab.lineTo(2.3, 0); gab.lineTo(0, 3.0); gab.lineTo(-2.3, 0);
    for (let q = 0; q < 4; q++) part('ashlar', shapeGeo(gab, 0.5), { M: mul(M(yb + 6.5), mul(rotY(q * PI / 2), tr(0, 0, 2.2))), c: '#e0c690' });
    // the spire
    const sp = spire || 4;
    cyl('lead', 0, 2.3, sp * 1.6, 8, { M: M(yb + 6.5), c: '#b8bcb2', uv: 'world' });
    sphere('flat', 0.22, { M: M(yb + 6.5 + sp * 1.6), c: '#c8a85a', seg: 5, noao: true });
    box('flat', 0.1, 1.1, 0.1, { M: M(yb + 6.5 + sp * 1.6 + 0.2), c: '#2b2620', noao: true }); box('flat', 0.5, 0.1, 0.1, { M: M(yb + 6.5 + sp * 1.6 + 0.75), c: '#2b2620', noao: true });
    if (clock) {   // the clock on the south face, under a bracket cornice, with its inscription below
      const yc = y0 + Hs - 4.2;
      box('ashlar', 4.6, 0.5, 0.9, { M: M(yc + 2.3), c: '#d5b985' });
      part('clock', geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; }), { M: mul(M(yc - 0.1), tr(0, 0, 2.86)), s: [3.3, 3.3, 1], uv: 'keep', noao: true, c: '#ffffff' });
      part('inscr', geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; }), { M: mul(M(yc - 0.75), tr(0, 0, 2.86)), s: [4.2, 0.55, 1], uv: 'keep', noao: true, c: '#ffffff' });
    }
  };
  tower(-49, -11.5, 31, 5); tower(-46, 17, 34, 5, true); tower(44, -9.5, 29, 3); tower(49, 10.5, 29, 3);
  // south porch: three pointed arches under a gable, standing in front of the south aisle wall
  {
    const sP = 27.4, eC = -31.5, W = 21;
    const [px, pz] = L(eC, sP);
    const PM = frame(px, gy, pz, S[0], S[1]);    // local x along the facade, local z out of the porch
    const arches = [[0, 6.2, 11.5, 6.5], [-7.4, 4.2, 9.2, 5.5], [7.4, 4.2, 9.2, 5.5]];
    const out = new THREE.Shape(); out.moveTo(-W / 2, 0); out.lineTo(W / 2, 0); out.lineTo(W / 2, 14); out.lineTo(0, 19.5); out.lineTo(-W / 2, 14); out.lineTo(-W / 2, 0);
    for (const [x, w, h, sh] of arches) { const hole = new THREE.Path(); hole.moveTo(x - w / 2, 0.03); hole.lineTo(x - w / 2, sh); hole.quadraticCurveTo(x - w / 2, sh + (h - sh) * 0.85, x, h); hole.quadraticCurveTo(x + w / 2, sh + (h - sh) * 0.85, x + w / 2, sh); hole.lineTo(x + w / 2, 0.03); hole.lineTo(x - w / 2, 0.03); out.holes.push(hole); }
    part('ashlar', new THREE.ExtrudeGeometry(out, { depth: 1.1, bevelEnabled: false, curveSegments: 6 }), { M: PM, c: '#e0c791' });
    // solid fill behind the screen and dark openings
    box('ashlar', W, 14, 4.2, { M: mul(PM, tr(0, 0, -2.1)), c: '#dcc28e' });
    for (const [x, w, h, sh] of arches) {
      const sh2 = new THREE.Shape(); sh2.moveTo(x - w / 2, 0); sh2.lineTo(x - w / 2, sh); sh2.quadraticCurveTo(x - w / 2, sh + (h - sh) * 0.85, x, h); sh2.quadraticCurveTo(x + w / 2, sh + (h - sh) * 0.85, x + w / 2, sh); sh2.lineTo(x + w / 2, 0); sh2.lineTo(x - w / 2, 0);
      part('dark', new THREE.ShapeGeometry(sh2), { M: mul(PM, tr(0, 0, 0.08)), uv: 'keep', c: '#3a3028', noao: true });
    }
    box('ashlar', W + 0.8, 0.6, 1.5, { M: mul(PM, tr(0, 14.0, 0.5)), c: '#e8d3a2' });
    for (const x of [-3.1, 3.1, -9.5, 9.5, -5.1, 5.1]) cyl('marble', 0.2, 0.22, 6, 8, { M: mul(PM, tr(x, 0.2, 0.55)), c: '#d9d2c0' });
    for (const sg of [-1, 1]) { cyl('ashlar', 0.8, 0.95, 15, 8, { M: mul(PM, tr(sg * (W / 2 + 0.2), 0, 0.2)), c: '#dcc28e' }); cyl('ashlar', 0, 1.0, 3.2, 8, { M: mul(PM, tr(sg * (W / 2 + 0.2), 15, 0.2)), c: '#d5b985' }); }
    { const gs = new THREE.Shape(); gs.moveTo(-W / 2, 14); gs.lineTo(W / 2, 14); gs.lineTo(0, 19.5); gs.lineTo(-W / 2, 14); part('tile', shapeGeo(gs, 4.2), { M: mul(PM, tr(0, 0, -4.2)), c: '#d8b09a' }); }
  }
  ctx.skip.add(b.id);
}

// ====================================================================================================
// 5. Porta Nuova and Porta Felice
// ====================================================================================================
function buildPortaNuova(ctx) {
  CUR = 'Porta Nuova';
  const b = byId('w815701117'); if (!b) return;
  // ground at the gate: the road under the arch, read from the streamed tile (the model is built when its tile has loaded, see CENTRO_LANDMARKS)
  const gy = groundY(-750.8, 395.6); BASEY = gy;
  // axis: through-passage along the Corso (ENE), as measured from the footprint's long edges. The OSM footprint is 18 x 18 m and runs from 7.3 m behind to
  // 10.7 m ahead of its centroid along the axis, so the model is centred on the footprint box, 0.4 m off to the side so the passage lies on the road
  // (the piers' collision in src/lmc-gates.js uses the same box)
  const ax = [0.907, -0.42];
  const M0 = frame(-750.8, gy, 395.6, ax[0], ax[1]);
  // Proportions read off the Commons photos (Porta Nuova facade, close view) with the 18 m footprint width as the scale, so about +-1 m (no published height was found):
  // rusticated arch storey 12 m, plain storey with windows and the eagle 5.4 m, loggia 5.7 m, cornice and balustrade, majolica pyramid 3.4 m (the real roof is low-pitched, base 11.4 m), lantern and finial 5 m: about 33 m
  const W = 18.0, Dp = 18.0, H1 = 12.2, PW = 5.8, PH = 8.6;   // width across, depth along the passage, rusticated storey height
  // lower stage with the arched passage cut right through (extruded shape with a hole)
  const base = new THREE.Shape(); base.moveTo(-W / 2, 0); base.lineTo(W / 2, 0); base.lineTo(W / 2, H1); base.lineTo(-W / 2, H1); base.lineTo(-W / 2, 0);
  const hole = archPath(PW, PH);
  part('rustic', shapeGeo(base, Dp, hole), { M: mul(M0, tr(0, -0.6, -Dp / 2)), c: '#d6cab2' });
  // outer arch ring and inner smaller arch
  for (const sg of [-1, 1]) {
    part('ashlar', shapeGeo(archShape(PW + 1.4, PH + 0.7), 0.3, archPath(PW, PH)), { M: mul(M0, tr(0, 0, sg * (Dp / 2 + 0.1) + (sg > 0 ? 0 : -0.3))), c: '#b9a28c' });
    // the four Moors (atlantes) on their brackets either side of the arch, and the keystone
    for (const x of [-PW / 2 - 1.55, -PW / 2 - 3.6, PW / 2 + 1.55, PW / 2 + 3.6]) {
      const Ms = mul(M0, mul(tr(x, 0, sg * (Dp / 2 + 0.45)), new THREE.Matrix4().makeRotationY(sg > 0 ? 0 : PI)));
      const st = '#c2b293', sd = '#a99a7c';
      box('ashlar', 1.3, 0.9, 0.9, { M: mul(Ms, tr(0, 4.9, -0.2)), c: sd });                          // bracket with a grotesque mask
      box('ashlar', 1.15, 2.7, 0.8, { M: mul(Ms, tr(0, 5.8, -0.05)), c: st });                        // torso
      sphere('ashlar', 0.46, { M: mul(Ms, tr(0, 9.0, 0.05)), c: st, seg: 6 });                        // head
      box('ashlar', 1.0, 0.4, 0.8, { M: mul(Ms, tr(0, 9.35, -0.1)), c: sd });                         // the cap on his head
      for (const a of [-1, 1]) box('ashlar', 0.38, 1.7, 0.4, { M: mul(Ms, tr(a * 0.62, 6.6, 0.2)), c: st, rz: a * 0.25 });   // arms folded across
    }
    box('ashlar', 1.3, 1.8, 0.7, { M: mul(M0, tr(0, PH - 0.9, sg * (Dp / 2 + 0.3))), c: '#c9b79a' });
    // the plain storey: two windows with pediments, the imperial eagle between them and a shield at each end (as on the photos), and the string course
    const Mn = (x, y, z) => mul(mul(M0, rotY(sg > 0 ? 0 : PI)), tr(x, y, z)), zn = Dp / 2 - 0.2 + 0.05, yN = H1 + 0.6;
    for (const x of [-2.7, 2.7]) {
      box('marble', 1.5, 2.9, 0.2, { M: Mn(x, yN + 1.2, zn), c: '#d8ceb6' });
      box('dark', 0.95, 2.2, 0.2, { M: Mn(x, yN + 1.55, zn + 0.05), c: '#4a3326', noao: true });
      box('marble', 1.9, 0.35, 0.35, { M: Mn(x, yN + 4.1, zn), c: '#d8ceb6' });
    }
    box('marble', 0.5, 1.1, 0.14, { M: Mn(0, yN + 1.6, zn), c: '#cfc7b0' });                                   // eagle: body and spread wings
    for (const a of [-1, 1]) box('marble', 1.1, 0.4, 0.14, { M: Mn(a * 0.7, yN + 2.3, zn), c: '#cfc7b0', rz: a * 0.35 });
    for (const x of [-5.4, 5.4]) box('marble', 1.1, 1.5, 0.16, { M: Mn(x, yN + 1.6, zn), c: '#d9cdb4' });   // shields
    box('ashlar', W + 0.8, 0.9, 1.0, { M: mul(M0, tr(0, H1 - 1.2, sg * (Dp / 2 - 0.1))), c: '#c9ab8c' });
  }
  box('ashlar', W + 1.0, 0.9, Dp + 1.0, { M: mul(M0, tr(0, H1 - 0.3, 0)), c: '#cdb094' });
  // dark vault interior floor/lights are provided by the tunnel walls
  // second stage (plain, with small windows) and cornice
  const H2 = H1 + 2.2;
  box('ashlar', W - 0.4, 5.4, Dp - 0.4, { M: mul(M0, tr(0, H1 + 0.6, 0)), c: '#cfc0a6' });
  // loggia of five arches (front/back) and four on the sides
  const LW = W - 2.0, LD = Dp - 2.0, yl = H1 + 6.2, LH = 5.7;
  box('flat', LW - 0.6, LH, LD - 0.6, { M: mul(M0, tr(0, yl, 0)), c: '#c99b58', noao: true });
  for (const sg of [-1, 1]) {
    for (let i = 0; i < 5; i++) { const x = -LW / 2 + (i + 0.5) * LW / 5; part('dark', shapeGeo(archShape(2.0, 4.2), 0.1), { M: mul(M0, tr(x, yl + 0.3, sg * (LD / 2 - 0.2))), uv: 'keep', c: '#4a2c20', noao: true }); }
    for (let i = 0; i <= 5; i++) cyl('marble', 0.17, 0.2, 4.4, 8, { M: mul(M0, tr(-LW / 2 + i * LW / 5, yl + 0.2, sg * (LD / 2 + 0.2))), c: '#ece7d8' });
    // arch ribs
    for (let i = 0; i < 5; i++) { const x = -LW / 2 + (i + 0.5) * LW / 5; box('marble', LW / 5, 0.5, 0.45, { M: mul(M0, tr(x, yl + 4.5, sg * (LD / 2 + 0.2))), c: '#ece7d8' }); }
    // balustrade on the lower roof ledge
    balus(mul(M0, tr(0, H1 + 6.0, sg * (Dp / 2 - 0.25))), W - 0.6, 1.1);
    balus(mul(M0, tr(sg * (W / 2 - 0.25), H1 + 6.0, 0)), Dp - 0.6, 1.1, { ry: PI / 2 });
    // side loggia arches
    for (let i = 0; i < 4; i++) { const z = -LD / 2 + (i + 0.5) * LD / 4; part('dark', shapeGeo(archShape(1.8, 4.4), 0.1), { M: mul(mul(M0, rotY(PI / 2 * sg)), tr(z * sg, yl + 0.3, LW / 2 - 0.2 + 0.0)), uv: 'keep', c: '#4a2c20', noao: true }); }
  }
  box('ashlar', LW + 0.6, 0.6, LD + 0.6, { M: mul(M0, tr(0, yl + LH, 0)), c: '#dcc9a6' });
  balus(mul(M0, tr(0, yl + LH + 0.6, LD / 2 + 0.2)), LW + 0.4, 1.0); balus(mul(M0, tr(0, yl + LH + 0.6, -LD / 2 - 0.2)), LW + 0.4, 1.0);
  balus(mul(M0, tr(LW / 2 + 0.2, yl + LH + 0.6, 0)), LD + 0.4, 1.0, { ry: PI / 2 }); balus(mul(M0, tr(-LW / 2 - 0.2, yl + LH + 0.6, 0)), LD + 0.4, 1.0, { ry: PI / 2 });
  // majolica pyramid roof, gilded lantern
  const yp = yl + LH + 0.6, PHt = 3.4;
  const pg = new THREE.CylinderGeometry(0, 1, 1, 4, 1, true); pg.rotateY(PI / 4); pg.translate(0, 0.5, 0);
  part('majolica', pg, { M: mul(M0, tr(0, yp, 0)), s: [(LW - 4.6) / 2 / 0.7071, PHt, (LD - 4.6) / 2 / 0.7071] });
  cyl('ashlar', 1.25, 1.35, 2.4, 8, { M: mul(M0, tr(0, yp + PHt - 0.2, 0)), c: '#d6c7a4' });
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; box('dark', 0.6, 1.3, 0.1, { M: mul(M0, tr(Math.cos(a) * 1.33, yp + PHt + 0.5, Math.sin(a) * 1.33)), ry: -a + PI / 2, c: '#3a2a20', noao: true }); }
  lathe('flat', [[1.45, 0], [1.2, 0.5], [0.5, 1.1], [0.1, 1.4]], 8, { M: mul(M0, tr(0, yp + PHt + 2.2, 0)), c: '#b88a38', noao: true });
  box('flat', 0.1, 1.6, 0.1, { M: mul(M0, tr(0, yp + PHt + 3.5, 0)), c: '#b88a38', noao: true });
  box('flat', 0.9, 0.35, 0.08, { M: mul(M0, tr(0, yp + PHt + 4.6, 0)), c: '#b88a38', noao: true });          // the gilded eagle on the spire
  ctx.skip.add(b.id);
}

function pylon(M, W, Dp, H) {
  const stone = '#e0ddd5', plaster = '#e4d2c0';
  // core and plastered side walls
  box('plaster', W, H * 0.62, Dp, { M, c: plaster });
  box('marble', W - 1.0, H * 0.62 + 0.2, Dp + 0.3, { M, c: stone });
  const yb = H * 0.62;
  for (const sg of [-1, 1]) {
    const f = (x, y, z) => mul(mul(M, rotY(sg > 0 ? 0 : PI)), tr(x, y, z));
    const z = Dp / 2 + 0.15;
    // marble facade panel with columns pairs flanking a niche above a fountain basin
    for (const x of [-3.0, -1.8, 1.8, 3.0]) { cyl('marble', 0.28, 0.32, 6.2, 10, { M: f(x, 1.6, z + 0.3), c: '#ddd9cc' }); box('marble', 0.8, 0.5, 0.8, { M: f(x, 1.1, z + 0.3), c: '#d5d1c4' }); box('marble', 0.8, 0.45, 0.8, { M: f(x, 7.8, z + 0.3), c: '#d5d1c4' }); }
    part('dark', shapeGeo(archShape(1.9, 4.2), 0.1), { M: f(0, 3.0, z + 0.05), uv: 'keep', c: '#4a4540', noao: true });
    statue('marble', f(0, 3.0, z + 0.2), 2.3, {});
    box('marble', W - 1.6, 1.0, 1.0, { M: f(0, 8.2, z + 0.2), c: '#e4e0d4' });          // entablature
    box('marble', W - 1.2, 0.4, 1.3, { M: f(0, 9.2, z + 0.3), c: '#e9e5d9' });
    box('marble', 2.8, 1.0, 1.4, { M: f(0, 0.0, z + 0.7), c: '#cfcbbd' });                // basin
    lathe('marble', [[0, 0], [0.9, 0.1], [1.3, 0.4], [1.3, 0.55], [1.1, 0.55], [0, 0.25]], 10, { M: f(0, 0.9, z + 0.9), c: '#d9d5c8' });
    for (const x of [-4.4, 4.4]) box('marble', 0.7, 6.8, 0.5, { M: f(x, 1.4, z + 0.2), c: '#dbd7ca' }); // outer pilasters
    // upper storey: arched opening between volutes, balustrade
    balus(f(0, 9.6, z + 1.1), W - 1.6, 1.0);
    box('marble', W - 3.2, H - 10.6 - 2.0, Dp - 0.2, { M: M, p: [0, 9.6, 0], c: stone });
    part('dark', shapeGeo(archShape(2.2, 4.0), 0.1), { M: f(0, 11.0, Dp / 2 - 0.1 + 0.25 + 0.0), uv: 'keep', c: '#3a2e28', noao: true });
    box('marble', 3.2, 0.5, 0.5, { M: f(0, 10.4, z + 0.2), c: '#e4e0d4' });
    for (const x of [-3.0, 3.0]) { box('marble', 1.4, 3.6, 0.6, { M: f(x, 10.0, z - 0.1), c: '#e4e0d4', rz: x < 0 ? 0.0 : 0.0 }); sphere('marble', 0.6, { M: f(x, 13.8, z), c: '#e4e0d4', seg: 6 }); }
    // eagle crest: flat silhouette with spread wings
    { const e = new THREE.Shape(); const P = [[0, 0], [0.5, 0.2], [1.0, 0.9], [1.9, 1.3], [2.5, 1.0], [2.2, 1.9], [1.3, 1.5], [0.7, 1.45], [0.5, 2.0], [0.25, 2.3], [0, 2.1], [-0.25, 2.3], [-0.5, 2.0], [-0.7, 1.45], [-1.3, 1.5], [-2.2, 1.9], [-2.5, 1.0], [-1.9, 1.3], [-1.0, 0.9], [-0.5, 0.2]];
      e.moveTo(P[0][0], P[0][1]); for (const q of P.slice(1)) e.lineTo(q[0], q[1]);
      part('marble', shapeGeo(e, 0.3), { M: f(0, H - 3.4, z - 0.15), c: '#e0dcd0' }); }
    // corner urns
    for (const x of [-W / 2 + 0.7, W / 2 - 0.7]) lathe('marble', [[0, 0], [0.4, 0], [0.5, 0.4], [0.3, 0.9], [0.1, 1.2], [0, 1.3]], 6, { M: f(x, yb, z - 0.9), c: '#dcd8cb' });
  }
}
function buildPortaFelice(ctx) {
  CUR = 'Porta Felice';
  const pa = byId('r6309453.0'), pb = byId('r6309453.1');
  const n = [0.88, -0.47];       // along the Corso, towards the sea
  for (const b of [pa, pb]) {
    if (!b) continue;
    const pts = pairsOf(b.p), cen = centroid(pts); BASEY = 0;
    // the pylon box is 11 x 10.6 m across the Corso (nx, nz is its depth axis): its base is the lowest ground under the box, and a skirt hangs round it
    const tx = -n[1], tz = n[0], box4 = [[-5.5, -5.3], [5.5, -5.3], [5.5, 5.3], [-5.5, 5.3]].map(([u, v]) => [cen[0] + tx * u + n[0] * v, cen[1] + tz * u + n[1] * v]);
    let gy = Infinity; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) gy = Math.min(gy, groundY(cen[0] + tx * (-5.5 + 2.75 * i) + n[0] * (-5.3 + 2.65 * j), cen[1] + tz * (-5.5 + 2.75 * i) + n[1] * (-5.3 + 2.65 * j)));
    BASEY = gy; skirt('marble', box4, gy + 0.1, '#cfcbbd');
    const H = Math.min(23.5, Math.max(relH(b, 22.9), ...(b.parts || []).map(q => q[1] - b.g)));
    const M = frame(cen[0], gy, cen[1], n[0], n[1]);
    // pylon facade runs across the Corso: rotate so +z is the sea direction
    pylon(M, 11.0, 10.6, H);
    ctx.skip.add(b.id);
  }
}

// ====================================================================================================
// 6. San Cataldo
// ====================================================================================================
function buildSanCataldo(ctx) {
  CUR = 'San Cataldo';
  const b = byId('w86870896'); if (!b) return;
  const pts = pairsOf(b.p), cen = centroid(pts), gy = minGround(pts); BASEY = gy;
  defMat('scWall', mkTex(512, 1024, (g, w, h) => {
    const Wm = 4.2, Hm = 12, sx = w / Wm, sy = h / Hm, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, Wm, Hm, 0.5, 0.95, '#b5a37f', '#6e5f45', 151, 2, 0.08);
    g.fillStyle = '#9a8a68'; g.beginPath(); g.moveTo(X(0.35), Y(0)); g.lineTo(X(0.35), Y(8.2)); g.arc(X(Wm / 2), Y(8.2), (Wm / 2 - 0.35) * sx, PI, 0); g.lineTo(X(Wm - 0.35), Y(0)); g.fill();
    g.fillStyle = '#7d6e52'; g.beginPath(); g.moveTo(X(0.7), Y(0)); g.lineTo(X(0.7), Y(8.0)); g.arc(X(Wm / 2), Y(8.0), (Wm / 2 - 0.7) * sx, PI, 0); g.lineTo(X(Wm - 0.7), Y(0)); g.fill();
    g.fillStyle = '#2d2a26'; g.beginPath(); g.moveTo(X(Wm / 2 - 0.6), Y(6.2)); g.lineTo(X(Wm / 2 - 0.6), Y(8.2)); g.arc(X(Wm / 2), Y(8.2), 0.6 * sx, PI, 0); g.lineTo(X(Wm / 2 + 0.6), Y(6.2)); g.fill();
    g.strokeStyle = '#6a5a40'; g.lineWidth = 1; for (let k = -0.6; k <= 0.6; k += 0.3) { g.beginPath(); g.moveTo(X(Wm / 2 + k), Y(6.2)); g.lineTo(X(Wm / 2 + k), Y(8.6)); g.stroke(); }
    streaks(g, w, h, 40, 152, 0.2, 260);
    const gb = g.createLinearGradient(0, h, 0, h - 4 * sy); gb.addColorStop(0, 'rgba(25,20,14,0.4)'); gb.addColorStop(1, 'rgba(25,20,14,0)'); g.fillStyle = gb; g.fillRect(0, h - 4 * sy, w, 4 * sy);
  }), [4.2, 12]);
  const WH = 11.2;
  const m = massing({ ...b, parts: null, r: gy + WH, g: gy, h: WH }, () => ({ key: 'scWall', bw: 4.2, th: 12 }), { roofKey: 'flat', roofC: '#8a8478' });
  for (const ed of m.edges) { orientedBox('ashlar', ed.e.L, ed.e.R, WH + gy - 0.6, 0.6, 0.5, 0.2, '#a39274'); merlons('ashlar', ed.e.R, ed.e.L, WH + gy + 0.0, '#a39274', 0.9, 0.5, 0.6, 0.4); }
  // three red domes in a row along the long axis
  let ax = [1, 0], best = 0;
  for (let i = 0; i < pts.length; i++) { const e = edgeLR(pts, i); if (e.len > best) { best = e.len; ax = [(e.R[0] - e.L[0]) / e.len, (e.R[1] - e.L[1]) / e.len]; } }
  const ry = Math.atan2(-ax[1], ax[0]);
  for (let i = -1; i <= 1; i++) {
    const x = cen[0] + ax[0] * i * 3.9, z = cen[1] + ax[1] * i * 3.9, y = gy + WH;
    cyl('ashlar', 1.9, 1.95, 1.2, 12, { p: [x, y, z], c: '#b5a37f' });
    lathe('red', [[1.95, 0], [1.9, 0.7], [1.55, 1.7], [0.9, 2.4], [0.25, 2.7], [0, 2.75]], 12, { p: [x, y + 1.2, z], c: '#ffffff' });
    // windows in the drum
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; box('dark', 0.45, 0.6, 0.12, { p: [x + Math.cos(a) * 1.93, y + 0.3, z + Math.sin(a) * 1.93], ry: -a + PI / 2, c: '#2a2420', noao: true }); }
    sphere('flat', 0.18, { p: [x, y + 4.0, z], c: '#8a7a5a', seg: 5, noao: true });
  }
  ctx.skip.add(b.id);
}


// ====================================================================================================
// 7. Santa Caterina: stone church with the green and yellow chevron majolica dome behind Piazza Pretoria
// ====================================================================================================
function buildSantaCaterina(ctx) {
  CUR = 'Santa Caterina';
  const b = byId('w49750065'); if (!b) return;
  defMat('scaWall', mkTex(512, 1024, (g, w, h) => paintPalazzo(g, w, h, 8, 24, 1, {
    base: '#cfbb90', joint: '#9a8560', trim: '#e6dcc4', strings: [8.5, 16.5], course: 0.65, block: 1.4, seed: 161,
    rows: [{ y0: 4.0, y1: 7.0, w: 1.2, fr: 0.22, ped: 1 }, { y0: 11.5, y1: 14.5, w: 1.3, fr: 0.22, arch: true, glass: '#2c3a52' }],
  })), [8, 24]);
  defMat('chev', mkTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e2c85c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a8f5e';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, h / 2); g.lineTo(x + 32, 0); g.lineTo(x + 32, h / 2 - 12); g.lineTo(x + 16, h - 12); g.lineTo(x, h / 2 - 12); g.fill(); }
    noiseDots(g, w, h, 300, 2, 171, ['rgba(60,50,20,0.18)']);
  }), [1, 1]);
  const m = massing(b, () => ({ key: 'scaWall', bw: 8, th: 24 }), { roofKey: 'flat', roofC: '#8f8a7c', cap: 18 });
  const gy = m.gy; BASEY = gy;
  for (const ed of m.edges) if (ed.exposed) orientedBox('ashlar', ed.e.L, ed.e.R, ed.top - 0.7, 0.7, 0.8, 0.3, '#d8c49c');
  const hi = m.parts[m.hiIdx], cen = centroid(hi.pts); let rr = 99; for (const p of hi.pts) rr = Math.min(rr, Math.hypot(p[0] - cen[0], p[1] - cen[1]));
  const R = rr * 0.9, y0 = gy + hi.rel, Cd = (y) => tr(cen[0], y, cen[1]);
  cyl('ashlar', R, R, 3.6, 12, { M: Cd(y0), c: '#d5c196' });
  for (let k = 0; k < 8; k++) { const a = k * PI / 4; box('dark', 0.9, 1.8, 0.15, { p: [cen[0] + Math.cos(a) * (R + 0.02), y0 + 0.9, cen[1] + Math.sin(a) * (R + 0.02)], ry: -a + PI / 2, c: '#2a2420', noao: true }); }
  cyl('ashlar', R * 1.08, R * 1.08, 0.5, 12, { M: Cd(y0 + 3.6), c: '#dcc9a0' });
  const prof = []; for (let i = 0; i <= 8; i++) { const a = i * PI / 2 / 8; prof.push([R * Math.cos(a) * (i === 8 ? 0.001 : 1), Math.sin(a) * (m.hiRel - hi.rel - 4.1 - 1.8) * 1.0]); }
  const dg = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 16);
  part('chev', dg, { M: Cd(y0 + 4.1), uv: 'keep', uvk: [3, 3], c: '#ffffff', noao: true });
  cyl('ashlar', 0.6, 0.7, 1.8, 8, { M: Cd(y0 + 4.1 + (m.hiRel - hi.rel - 4.1 - 1.8)), c: '#d8c49c' });
}


// ====================================================================================================
// 8. Palazzo dei Normanni: the grey stone Torre Pisana with its blind arches and observatory domes
// ====================================================================================================
function buildNormanni() {
  CUR = 'Palazzo dei Normanni';
  const b = byId('r395010.0'); if (!b) return;
  const pts = pairsOf(b.p), gy = minGround(pts); BASEY = gy;
  // the long north-east front: pick the longest edge facing east or north-east
  let best = null;
  for (let i = 0; i < pts.length; i++) { const e = edgeLR(pts, i); if (e.nx > 0.3 && e.nz < -0.3 && (!best || e.len > best.len)) best = e; }
  if (!best) return;
  const TW = 15, TH = 33, TD = 7;
  defMat('torre', mkTex(512, 1024, (g, w, h) => {
    const sx = w / TW, sy = h / TH, X = (s) => s * sx, Y = (y) => h - y * sy;
    paintAshlar(g, w, h, TW, TH, 0.6, 1.3, '#c6a874', '#8a7048', 181, 2, 0.09);
    const arch = (cx, y0, y1, bw, win) => {
      g.strokeStyle = 'rgba(40,36,30,0.75)'; g.lineWidth = 3; g.fillStyle = 'rgba(70,64,56,0.22)';
      g.beginPath(); g.moveTo(X(cx - bw / 2), Y(y0)); g.lineTo(X(cx - bw / 2), Y(y1 - bw * 0.55)); g.quadraticCurveTo(X(cx - bw / 2), Y(y1 - 0.1), X(cx), Y(y1)); g.quadraticCurveTo(X(cx + bw / 2), Y(y1 - 0.1), X(cx + bw / 2), Y(y1 - bw * 0.55)); g.lineTo(X(cx + bw / 2), Y(y0)); g.fill(); g.stroke();
      if (win) { g.fillStyle = '#4a3a30'; g.fillRect(X(cx - 0.45), Y(y0 + win[1]), 0.9 * sx, (win[1] - win[0]) * sy); g.fillStyle = 'rgba(200,210,220,0.5)'; g.fillRect(X(cx - 0.3), Y(y0 + win[1] - 0.2), 0.6 * sx, (win[1] - win[0] - 0.5) * sy); }
    };
    for (const [y0, y1, bw, win] of [[2.5, 9.5, 3.6, [1.5, 3.8]], [11.0, 18.5, 4.2, [2.5, 4.6]], [21.5, 29.5, 3.6, [2.0, 4.4]]])
      for (const cx of [3.0, 7.5, 12.0]) arch(cx, y0, y1, bw, win);
    g.fillStyle = 'rgba(40,36,30,0.55)'; for (const y of [10.2, 20.6]) g.fillRect(0, Y(y), w, 3);
    streaks(g, w, h, 60, 182, 0.2, 260);
  }), [TW, TH]);
  const mx = (best.L[0] + best.R[0]) / 2, mz = (best.L[1] + best.R[1]) / 2;
  let gMax = -Infinity; for (const p of pts) gMax = Math.max(gMax, groundY(p[0], p[1]));
  const yb = groundY(mx, mz) - 1.0, yt = gMax + 33.4, HT = yt - yb;
  const M = frame(mx, yb, mz, best.nx, best.nz);
  const right = [best.nz, -best.nx];
  const pL = [mx - right[0] * TW / 2 + best.nx * 0.2, mz - right[1] * TW / 2 + best.nz * 0.2], pR = [mx + right[0] * TW / 2 + best.nx * 0.2, mz + right[1] * TW / 2 + best.nz * 0.2];
  wallQuad('torre', pL, pR, yb, yt, [0, 1 - HT / TH, 1, 1], '#ffffff');
  box('ashlar', TW, HT, TD, { M: mul(M, tr(0, 0, -TD / 2 + 0.2)), c: '#b49a6c' });
  box('ashlar', TW + 0.6, 0.8, TD + 0.6, { M: mul(M, tr(0, HT - 0.4, -TD / 2 + 0.2)), c: '#c9ae7c' });
  merlons('ashlar', pR, pL, yt + 0.4, '#d3b988', 1.5, 0.8, 1.1, 0.5);   // the pointed merlons of the Norman roofline (square here)
  for (const [x, r] of [[-4.0, 2.4], [1.5, 3.0], [5.8, 1.8]]) {
    cyl('flat', r, r * 1.05, 0.8, 12, { M: mul(M, tr(x, HT + 0.4, -3)), c: '#8a7f70', noao: true });
    lathe('flat', [[r * 1.0, 0], [r * 0.95, 0.5], [r * 0.7, 1.4], [r * 0.3, 2.0], [0, 2.1]].map(q => [q[0], q[1] * 1.15]), 12, { M: mul(M, tr(x, HT + 1.2, -3)), c: '#2e3036', noao: true });
  }
  for (const sg of [-1, 1]) box('ashlar', 0.6, 1.0, TD, { M: mul(M, tr(sg * (TW / 2 - 0.3), HT + 0.4, -TD / 2 + 0.2)), c: '#9a9285' });
  box('ashlar', TW, 1.0, 0.6, { M: mul(M, tr(0, HT + 0.4, 0.0)), c: '#9a9285' });
}

// ====================================================================================================
// entry points
// ====================================================================================================
const BUILDERS = [
  ['Quattro Canti', buildQuattroCanti],
  ['Fontana Pretoria', buildPretoria],
  ['Palazzo delle Aquile', buildAquile],
  ['Teatro Massimo', buildTeatro],
  ['Cattedrale', buildCattedrale],
  ['Porta Nuova', buildPortaNuova],
  ['Porta Felice', buildPortaFelice],
  ['San Cataldo', buildSanCataldo],
  ['Santa Caterina', buildSantaCaterina],
  ['Palazzo dei Normanni', buildNormanni],
];

const SKIP_IDS = ['w28002543', 'w24937131', 'w49750033', 'w815701117', 'r6309453.0', 'r6309453.1', 'w86870896', 'w49750065'];
export function prepareLandmarks(ctx) { for (const id of SKIP_IDS) ctx.skip.add(id); }

// The centro landmarks are built like the city landmarks (src/landmarks-city.js): by the streamer, once the tile they stand on (and the tiles their footprint reaches
// into) has loaded, so every height they read is the streamed ground, the same the terrain mesh, the roads and the car use. world.js keeps the group with the tile
// and builds it again if the tile is released. x, z: where it stands (the anchor tile is the one that contains it), radius: how far it reaches.

// ---- collision (board item x4): wall segments [x0, z0, x1, z1] the streamer registers with the landmark's anchor tile while it is at full detail (src/world.js registerPhysics),
// the same kind the building footprints give. Walls are two-dimensional and stop the lapa, pedestrians and traffic alike.
const r1 = (v) => Math.round(v * 10) / 10;
const ringSegs = (pts) => pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return [r1(p[0]), r1(p[1]), r1(q[0]), r1(q[1])]; });
const circleRing = (cx, cz, r, n) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i * TWO / n), cz + r * Math.sin(i * TWO / n)]);
// a rectangle given in a frame whose local +z points along (nx, nz) and +x is (nz, -nx), as frame() does
const localRect = (O, nx, nz, x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [O[0] + x * nz + z * nx, O[1] - x * nx + z * nz]);
function teatroFrame() {   // the dome axis of the Teatro Massimo and the direction to the piazza, as buildTeatro takes them
  const b = byId('w24937131'); if (!b) return null;
  const gref = b.g !== undefined ? b.g : 0;
  const parts = (b.parts && b.parts.length) ? b.parts.map(q => ({ pts: pairsOf(q[0]), rel: q[1] - gref })) : [{ pts: pairsOf(b.p), rel: relH(b, b.h) }];
  let hi = parts[0]; for (const q of parts) if (q.rel > hi.rel) hi = q;
  const f = [0.41, 0.912], fl = Math.hypot(f[0], f[1]);
  return { cen: centroid(hi.pts), nx: f[0] / fl, nz: f[1] / fl };
}
const COLLISION = (() => {
  const out = {};
  // Fontana Pretoria: the iron fence ring (r 12.05) and the basin wall inside it (r 10.45): the basin is not for driving in
  { const c = pretoriaCentre(); out['Fontana Pretoria'] = [...ringSegs(circleRing(c[0], c[1], 12.05, 32)), ...ringSegs(circleRing(c[0], c[1], 10.45, 24))]; }
  // Teatro Massimo: the podium with the portico, the 24 steps and the cheek walls are one block (28 m across, from the portico's back plane 14.5 m to 39.5 m in front of the dome axis),
  // and the two lions' plinths at the foot of the stairs. The stairs are not drivable: 24 risers of 15 cm over 12.7 m is a climb for people, and the lapa's wheels are no bigger than the steps
  { const T = teatroFrame(); if (T) {
    const t0 = -3.5, R = (x0, x1, z0, z1) => ringSegs(localRect(T.cen, T.nx, T.nz, x0, x1, z0, z1));
    out['Teatro Massimo'] = [...R(t0 - 14, t0 + 14, 14.5, 39.6), ...R(t0 - 12.3 - 1.6, t0 - 12.3 + 1.6, 37.0, 40.6), ...R(t0 + 12.3 - 1.6, t0 + 12.3 + 1.6, 37.0, 40.6)];
  } }
  // Cattedrale, the south porch: the block behind the three arches (21 m wide, 4.2 m deep) with the screen in front and the two pylons, one rectangle
  { const E = [0.891, -0.454], S = [0.454, 0.891], O = [-458, 152], px = O[0] - 31.5 * E[0] + 27.4 * S[0], pz = O[1] - 31.5 * E[1] + 27.4 * S[1];
    out['Cattedrale'] = ringSegs(localRect([px, pz], S[0], S[1], -11.9, 11.9, -4.3, 1.4)); }
  return out;
})();
const BUILD_AT = {
  'Quattro Canti': [0, 0, 60], 'Fontana Pretoria': [72, 26, 40], 'Palazzo delle Aquile': [85, 65, 50], 'Teatro Massimo': [-358, -491, 90], 'Cattedrale': [-456, 151, 110],
  'Porta Nuova': [-751, 396, 40], 'Porta Felice': [875, -436, 50], 'San Cataldo': [105, 106, 30], 'Santa Caterina': [119, 27, 30], 'Palazzo dei Normanni': [-700, 502, 120],
};
export const CENTRO_LANDMARKS = BUILDERS.map(([name, fn]) => ({
  name, x: BUILD_AT[name][0], z: BUILD_AT[name][1], radius: BUILD_AT[name][2], walls: COLLISION[name] || [], dropWalls: [],
  build(ctx) {
    if (location.search.includes('nolm=1')) return null;
    const t0 = performance.now();
    initMaterials();
    const group = new THREE.Group(); group.name = 'landmark ' + name;
    try { CUR = name; fn(ctx); } catch (e) { console.error('landmark ' + name + ' failed', e); }
    const per = finish(group), tris = Object.values(per).reduce((a, b) => a + b, 0);
    STATS[name] = tris; group.userData.tris = tris;
    window.__landmarkTris = { total: Math.round(Object.values(STATS).reduce((a, b) => a + b, 0)), per: STATS };
    window.__landmarkKeepout = KEEPOUT;
    if (location.search.includes('lmstats')) console.log('landmark', name, 'build ms', Math.round(performance.now() - t0), 'triangles', Math.round(tris));
    return group;
  },
}));
