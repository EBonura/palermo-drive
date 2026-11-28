// Hand-built landmark models. Owned by the landmarks work.
// prepareLandmarks runs before buildings: add building ids to ctx.skip for any footprint a model replaces.
// All models are assembled from merged parts (one mesh per material) in local frames, on groundY.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D, groundY, rng, freeCanvas, weld } from './core.js';

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

// A model is built again whenever its tile comes back, and the builders ask for their textures every time: painted once per material key, or each return left a new canvas and GPU texture behind.
function mkTex(w, h, draw) { return { make() {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const t = freeCanvas(new THREE.CanvasTexture(cv), draw);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
} }; }
function defMat(key, map, texM, opts = {}) { if (MATS[key]) { MATS[key].texM = texM; return; } MATS[key] = { map: map && map.make ? map.make() : map, texM, opts }; BINS[key] = []; }

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
    const mat = m.mat || (m.mat = new THREE.MeshStandardMaterial({ map: m.map, vertexColors: true, roughness: 0.92, metalness: 0, ...mo }));
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !m.opts.noShadow; mesh.receiveShadow = true; mesh.name = 'landmarks-' + k;
    parent.add(mesh); out[k] = merged.attributes.position.count / 3;
    weld(merged);
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
    g.fillStyle = '#b6626a'; g.fillRect(0, 0, w, h);
    noiseDots(g, w, h, 1400, 3, 61, ['rgba(120,50,60,0.22)', 'rgba(220,140,140,0.18)', 'rgba(70,45,45,0.2)']);
    noiseDots(g, w, h, 90, 11, 62, ['rgba(70,38,42,0.28)', 'rgba(200,120,125,0.2)']);
  }), [2.5, 2.5]);
  defMat('balus', mkTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#e4e0d3';
    g.fillRect(0, 0, w, 9); g.fillRect(0, h - 8, w, 8);
    for (let x = 0; x < w; x += 16) { g.fillRect(x + 4, 9, 8, h - 17); g.fillRect(x + 2, 22, 12, 8); g.fillRect(x + 2, 38, 12, 6); }
  }), [1, 1], { alphaTest: 0.5, side: THREE.DoubleSide });
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
// The four fronts (Piazza Vigliena, 1608-20) share one design; what changes from one to the next is the season of the fountain, the king, the patron saint and the dedication plaque:
//   north-east: Autumn, Philip III, Saint Oliva     south-east: Winter, Philip IV, Saint Agatha
//   south-west: Spring, Charles V, Saint Christina  north-west: Summer, Philip II, Saint Ninfa
// Reference photos (Wikimedia Commons, looked at, nothing copied or stored). Which front is which follows the Commons category of each file.
//   whole fronts: Palermo-Quattro-Canti-bjs2007-01, -02, -03, -04.jpg; "Konkav geschwungen" sind die vier Ecken der Piazza Vigliena 06, 08, 09, 10.jpg (the plaques, attics, windows and pediments are read from these four)
//   saints: Santa Oliva ... prospetto nord-est -FG1, Santa Agata ... sud-est -FG, Santa Cristina ... sud-ovest -FG, Santa Ninfa ... nord-ovest -FG; "Konkav geschwungen" 01 to 04
//   kings: Phillip III, Phillip IV, Charles V, Phillip II of Spain - Quattro canti - Palermo - Italy 2015.JPG
//   seasons: Nunzio La Mattina, Autunno and Inverno -FG; Gregorio Tedeschi, Primavera and Estate -FG1
// The inscriptions on the four plaques are transcribed from the "Konkav" photos (a few worn letters are read from context, mostly at the ends of the south-east lines).
// Not verified, left plain: the lettering on the tablets under the kings (strokes, no words), the arms on the end shields of the attic (they differ, left blank), the carving of each metope and
// console figure (generic trophies and busts), the faces, and the small spouts and plaques round the fountains. Sizes and heights are read off the photos by eye against the known tier heights.
const QC = { C: [17.49, 4.0], R: 15.29, Rf: 14.95, Wd: 12.6 };
const QCW = 768, QCH = 1536;   // the one painted texture: 12.6 x 25.6 m of wall
// Parts of the wall that geometry always hides (behind the pedestal slab, behind the king's niche) hold the pictures that are mapped onto small quads: [x0, row0, x1, row1] in canvas pixels
const QCA = { plaque: (i) => [i * 192 + 2, 1416, i * 192 + 190, 1532], arms: [351, 832, 417, 928], tablet: [340, 934, 428, 986] };
// facing is the angle of the front's middle from the crossing, atan2(z, x)
const QC_FRONTS = [
  { key: 'north-east', facing: -1.24, season: 'autumn', king: 'philip3', saint: 'oliva', plaque: [
    'D·N·PHILIPPO·III·HISPAN·ET·SICIL·REGE', 'D·FRANCISCO·DE·CASTRO·COMITI·CASTRI·PROREGI', 'QVOD·IVSTVS·ALIENÆ·GLORIÆ·FAVENS·NEC·SVIS·DIFFIDENS',
    'VIRTVTIBVS·OPTIMO·EXEMPLO·AREAM·VILLENAM·AFFECTAM', 'OMNINO·PERFICI·ET·PERPOLIRI·IVSSERIT·OB·NVSQVAM·VISVM', 'ALIBI·VRBIS·ABSOLVTVM·ORNAMENTVM·S·P·Q·PANORMITANVS',
    'OPTIMO·PRINCIPI', 'D·ALVARO·DE·RIVADENEIRA·PRÆTORE·POMPILIO·PLAYA·BARONE', 'VATICANI·D·VINCENTIO·LAROSA·D·IACOBO·LVCCHESE·BARONE',
    'CAMASTRÆ·D·VINCENTIO·LANDOLINA·D·GASPARE·BELLACERA', 'BARONE·PEDAGAGI·D·FRANCISCO·LANZA·BARONE·FICARRÆ', 'SENATORIBVS·P·P·Q·CONSCRIPTIS·CIƆ·IƆ·C·XX',
    'PRÆFVERVNT·OPERI', 'D·BALTHASSAR·BONONIVS·D·BERN·F·ET·D·IACOBVS·ALLIATA'] },
  { key: 'south-east', facing: 0.32, season: 'winter', king: 'philip4', saint: 'agata', plaque: [
    'D·N·PHILIPPO·III·HISPAN·ET·SICIL·REGE', 'IOANNE·FERNANDO·PATIECO·MARCHIONE·VILLENAE·PROREGE', 'AREAM·VILLENAM·FELICIS·NOMINIS·SENATVS·CONSVLTO',
    'DECRETAM·PRO·VRBIS·REGIAE·ET·VIARVM·DIGNITATE', 'FACIENDAM·CVRAVERE', 'D·ANTONIVS·BOSCVS·PRAETOR·VINCENTIVS·OPEZINGA', 'D·MARIVS·GAMBACVRTA·ALVARVS·VERNAGALLVS',
    'D·PETRVS·CELESTRIS·D·FRANCISCVS·PASQVALIS', 'VIAE·MAQVEDAE·CVRATORES·CIƆ·IƆ·CIX', 'VRBE·DECVS·MEDIA·MAGNVM·VILLENA·PLATEA', 'NOMINE·QVAE·TANTO·LATE·DECORATA·SVPERBIT',
    'FACTA·CORONA·SVIS·OCTONIS·PARTIBVS·EN·VT', 'QVADRIFIDASQ·VIAS·PORTASQ·VRBEMQ·CORONAT'] },
  { key: 'south-west', facing: 1.89, season: 'spring', king: 'charles5', saint: 'cristina', plaque: [
    'D·N·PHILIPPO·III·HISPAN·ET·SICIL·REGE', 'DON·PETRO·GIRON·DVCE·OSSVNÆ·PROR', 'VT·QVO·GVBERNANTE·FELICITER·OMNIA·PROCEDVNT', 'AD·PERFETIONEM·PROCEDAT·ETIAM·STRVCTVRA',
    'SVB·OMNI·CÆLO·SINGVLARIS', 'FECERVNT·ANNO·CIƆ·IƆ·CXII', 'DON·PETRVS·CELESTRIS·E·MARCHION·SANTÆ·CRVCIS·PRÆTOR', 'DON·PETRVS·VPEZINGHI·ALVARVS·VERNAGALLI',
    'DON·HVGO·NOTARBARTOLVS·GERARDVS·DE·AFFLICTO', 'IOANNES·DE·BALLIS·BARO·CALATVVI·DON·MARIANVS', 'ALLIATA·SPATAFORA·SENATORES·PP·CONSCRIPTI'] },
  { key: 'north-west', facing: -2.83, season: 'summer', king: 'philip2', saint: 'ninfa', plaque: [
    'D·N·PHILIPPO·III·HISPAN·ET·SICIL·REGI', 'IOANNE·FERNANDO·PATIECO·MARCHIONE·VILLENAE·PROREGE', 'PROVIDENTISSIMO·ET·DE·OMNI·HOMINVM·GENERE·MERITISSIMO',
    'REGNO·ET·REP·PANHORMITANA·OPTIME·INSTITVTIS·TESTIMONIVM', 'GRATVLATIONIS·EXSOLVENTES·AREAM·VILLENAM·CONSECRAVERVNT', 'D·ANTONIVS·BOSCVS·PRAETOR·CAESAR·AFFLITTVS·ALVARVS',
    'VERNAGALLVS·D·FRANCISCVS·PASQVALIS·ANTONINVS·REGIVS', 'D·IOANNES·ALGARIA·MARCVS·ANTONIVS·GASCONI·SENATORES', 'PP·Q·CONSCRIPTI·CIƆ·IƆ·CIX',
    'REGE·PIO·PROREGE·BONO·BENE·RECTA·PANHORMVS', 'VT·BENE·APVD·MEMOREM·EGREGII·STET·GRATIA·FACTI', 'TANQVAM·COR·DE·SVO·VILLENAM·FORMAT·IN·VRBIS',
    'QVADRIVIO·PLATEAM·REGISQ·HANC·NVMINE·FIRMAT'] },
];

// The facade painted: Wd metres wide, 25.6 m high on the QCW x QCH canvas, the same wall for all four. The heavy parts are real geometry (buildQuattroCanti), this is the wall they stand on:
// dressed stone (darker below, pale honey above), rusticated edges on the lowest tier and fluted pilasters above, stone window frames below and white stucco ones at the top, the carved cartouche
// of the plaque; then, in the hidden parts, the four inscriptions, the royal arms and the king's tablet.
function paintQC(Wd) {
  const W = QCW, H = QCH, sx = W / Wd, sy = H / 25.6;
  return mkTex(W, H, (g) => {
    const X = (s) => (s + Wd / 2) * sx, Y = (y) => H - y * sy;
    const rect = (s0, y0, s1, y1, f) => { g.fillStyle = f; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy); };
    const frame = (s0, y0, s1, y1, c, wd) => { rect(s0 - wd, y0 - wd, s1 + wd, y0, c); rect(s0 - wd, y1, s1 + wd, y1 + wd, c); rect(s0 - wd, y0, s0, y1, c); rect(s1, y0, s1 + wd, y1, c); };
    const r_ = R_(101);
    const T1 = 7.4, T2 = 15.0, T3 = 21.8;
    // the stone: limestone, courses of dressed blocks that get finer with height
    g.fillStyle = '#9c8662'; g.fillRect(0, 0, W, H);
    for (const [ya, yb, bh, bw, c0] of [[1.9, T1, 0.6, 1.5, [149, 126, 91]], [T1 + 0.6, T2, 0.72, 1.7, [167, 144, 107]], [T2 + 0.6, T3, 0.72, 1.7, [177, 156, 119]]]) for (let y = ya; y < yb; y += bh) {
      let s = -Wd / 2 - r_() * bw;
      while (s < Wd / 2) { const w2 = bw * (0.7 + r_() * 0.6), k = 0.88 + r_() * 0.22; rect(s + 0.025, y + 0.025, s + w2 - 0.025, y + bh - 0.02, `rgb(${(c0[0] * k) | 0},${(c0[1] * k) | 0},${(c0[2] * k) | 0})`); s += w2; }
    }
    // the lowest tier: bossed quoins up both edges and beside the middle bay
    for (const [a, w] of [[-Wd / 2, 1.0], [Wd / 2 - 1.0, 1.0], [-3.05, 0.5], [2.55, 0.5]]) for (let y = 2.1; y < T1 - 0.8; y += 0.62) {
      const k = 0.9 + r_() * 0.18; rect(a, y, a + w, y + 0.56, `rgb(${(170 * k) | 0},${(146 * k) | 0},${(106 * k) | 0})`); rect(a, y, a + w, y + 0.07, 'rgba(255,240,200,0.3)'); rect(a, y + 0.5, a + w, y + 0.56, 'rgba(40,28,16,0.35)');
    }
    // the two upper tiers: fluted pilasters at the edges and beside the middle bay, a leafy capital on each
    for (const [ya, yb] of [[T1 + 1.1, T2 - 0.45], [T2 + 0.8, T3 - 0.45]]) for (const s of [-5.8, -2.9, 2.9, 5.8]) {
      rect(s - 0.4, ya, s + 0.4, yb, '#b39c74'); for (let k = -2; k <= 2; k++) { rect(s + k * 0.14 - 0.04, ya + 0.25, s + k * 0.14 + 0.01, yb - 0.65, 'rgba(48,34,18,.38)'); rect(s + k * 0.14 + 0.01, ya + 0.25, s + k * 0.14 + 0.05, yb - 0.65, 'rgba(250,236,200,.3)'); }
      rect(s - 0.5, ya, s + 0.5, ya + 0.22, '#c2ab82'); rect(s - 0.52, yb - 0.14, s + 0.52, yb, '#cbb68e');
      for (let k = -2; k <= 2; k++) { g.fillStyle = 'rgba(232,214,170,.9)'; g.beginPath(); g.ellipse(X(s + k * 0.18), Y(yb - 0.36 + Math.abs(k) * 0.03), 0.08 * sx, 0.2 * sy, k * 0.22, 0, 7); g.fill(); rect(s + k * 0.18 + 0.07, yb - 0.55, s + k * 0.18 + 0.1, yb - 0.2, 'rgba(38,26,12,.35)'); }
    }
    // the central bay of the lowest tier: smooth, a recessed panel with a dark moulding
    rect(-1.95, 2.1, 1.95, 6.9, '#8f7a57'); frame(-1.95, 2.1, 1.95, 6.9, '#55472f', 0.08); rect(-1.8, 2.25, 1.8, 6.75, '#98825c');
    // the shutters: faded grey-green, louvred
    const shutter = (s, y0, y1, w) => {
      rect(s - w / 2, y0, s + w / 2, y1, '#566f5f');
      g.fillStyle = '#36493e'; for (let y = y0 + 0.08; y < y1 - 0.05; y += 0.13) g.fillRect(X(s - w / 2) + 2, Y(y), w * sx - 4, 2);
      rect(s - 0.025, y0, s + 0.025, y1, '#2a3a31'); frame(s - w / 2, y0, s + w / 2, y1, '#6d8574', 0.04);
    };
    for (const sg of [-1, 1]) {
      const s = sg * 4.1;
      // lowest tier: a square window in a stone frame, and under it the little balcony: a stone box with a dark recess behind its balusters
      rect(s - 0.9, 4.65, s + 0.9, 6.55, '#b7a47f'); rect(s - 0.74, 4.7, s + 0.74, 6.43, '#6c5a3d'); shutter(s, 4.75, 6.35, 1.3);
      rect(s - 1.1, 3.25, s + 1.1, 4.7, '#b0a48a'); rect(s - 0.88, 3.5, s + 0.88, 4.48, '#2f2a22');
      // middle tier: a tall window to the balcony, stone frame, a frieze with two brackets under the pediment
      rect(s - 0.95, 8.55, s + 0.95, 13.12, '#c0a982'); rect(s - 0.84, 8.6, s + 0.84, 13.0, '#6c5a3d'); shutter(s, 8.65, 12.9, 1.5);
      rect(s - 1.05, 13.1, s + 1.05, 13.35, '#bfa880'); for (let k = -5; k <= 5; k++) rect(s + k * 0.13, 13.12, s + k * 0.13 + 0.05, 13.32, 'rgba(48,34,18,.4)');
      for (const q of [-0.85, 0.85]) { rect(s + q - 0.12, 12.95, s + q + 0.12, 13.35, '#d4c096'); rect(s + q + 0.07, 12.95, s + q + 0.12, 13.35, 'rgba(38,26,12,.5)'); }
      // top tier: a small window in an ornate white stucco frame, a crest over it and an apron under it
      const WS = '#ddd8c9';
      rect(s - 0.98, 16.75, s - 0.8, 19.25, WS); rect(s + 0.8, 16.75, s + 0.98, 19.25, WS); rect(s - 0.98, 19.05, s + 0.98, 19.3, WS); rect(s - 0.8, 16.7, s + 0.8, 16.95, WS);
      for (const q of [-0.9, 0.9]) { rect(s + q - 0.16, 16.55, s + q + 0.16, 16.85, WS); rect(s + q - 0.13, 18.8, s + q + 0.13, 19.45, WS); }
      rect(s - 0.68, 16.95, s + 0.68, 19.05, '#8a7a5c'); shutter(s, 17.05, 18.95, 1.1);
      g.fillStyle = WS; g.beginPath(); g.moveTo(X(s - 0.65), Y(19.3)); g.quadraticCurveTo(X(s - 0.3), Y(19.45), X(s - 0.22), Y(19.7)); g.quadraticCurveTo(X(s), Y(19.95), X(s + 0.22), Y(19.7)); g.quadraticCurveTo(X(s + 0.3), Y(19.45), X(s + 0.65), Y(19.3)); g.fill();
      g.beginPath(); g.moveTo(X(s - 0.62), Y(16.5)); g.quadraticCurveTo(X(s - 0.5), Y(16.05), X(s), Y(16.08)); g.quadraticCurveTo(X(s + 0.5), Y(16.05), X(s + 0.62), Y(16.5)); g.fill();
      g.strokeStyle = 'rgba(60,45,25,.45)'; g.lineWidth = 1.3; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(X(s), Y(16.5)); g.lineTo(X(s + k * 0.15), Y(16.14)); g.stroke(); }
    }
    // cornice bands: the shadow under each, a light edge above it
    for (const [y0, y1] of [[T1, T1 + 0.6], [T2, T2 + 0.6], [T3, T3 + 0.7]]) {
      rect(-Wd / 2, y0, Wd / 2, y1, '#b39e78'); rect(-Wd / 2, y1 - 0.1, Wd / 2, y1, '#d0bd95'); rect(-Wd / 2, y0, Wd / 2, y0 + 0.12, '#4d4132');
      const gr = g.createLinearGradient(0, Y(y0), 0, Y(y0) + 70); gr.addColorStop(0, 'rgba(25,16,8,0.45)'); gr.addColorStop(1, 'rgba(25,16,8,0)'); g.fillStyle = gr; g.fillRect(0, Y(y0), W, 70);
    }
    rect(-Wd / 2, T1 - 0.78, Wd / 2, T1, '#9c8662'); rect(-Wd / 2, T1 - 0.82, Wd / 2, T1 - 0.76, '#5e4e36');   // the frieze under the balcony (carveQC)
    // the attic: plain dressed stone behind the arms (the piers, scrolls and shields are geometry)
    rect(-Wd / 2, T3 + 0.7, Wd / 2, 25.6, '#ab9570'); rect(-3.1, 25.35, 3.1, 25.6, '#c8b48c');
    carveQC(g, W, H, Wd);
    // weathering: dark streaks under every ledge, a blackened foot, pale patches
    streaks(g, W, H, 520, 103, 0.24, 260);
    noiseDots(g, W, H, 14000, 2, 104, ['rgba(40,30,20,0.17)', 'rgba(240,225,190,0.10)']);
    const gb = g.createLinearGradient(0, H, 0, Y(5.5)); gb.addColorStop(0, 'rgba(25,20,15,0.42)'); gb.addColorStop(1, 'rgba(25,20,15,0)'); g.fillStyle = gb; g.fillRect(0, Y(5.5), W, 5.5 * sy);
    plaqueFrameQC(g, Wd);
    atlasQC(g);
  });
}

// The marble cartouche round the inscription, the same on all four fronts: a stepped frame with scrolls at the sides, over it a pair of volutes, a woman's head and drapery swags, under it two garlands of fruit.
function plaqueFrameQC(g, Wd) {
  const sx = QCW / Wd, sy = QCH / 25.6, X = (s) => (s + Wd / 2) * sx, Y = (y) => QCH - y * sy, r_ = R_(141);
  const M0 = '#d9d3c4', LIT = '#eeeadf', SH = 'rgba(60,48,30,.55)';
  const rect = (s0, y0, s1, y1, f) => { g.fillStyle = f; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy); };
  const oval = (s, y, rw, rh, f) => { g.fillStyle = f; g.beginPath(); g.ellipse(X(s), Y(y), rw * sx, rh * sy, 0, 0, 7); g.fill(); };
  const curl = (s, y, rad, dir) => {
    oval(s, y, rad * 1.15, rad * 1.15, M0);
    g.strokeStyle = SH; g.lineWidth = 2; g.beginPath(); for (let t = 0; t <= 9; t += 0.3) { const a = dir * t * 0.7 + 1.4, rr = rad * (1 - t / 10.5); g[t ? 'lineTo' : 'moveTo'](X(s + Math.cos(a) * rr), Y(y + Math.sin(a) * rr)); } g.stroke();
  };
  rect(-1.36, 4.47, 1.4, 6.14, 'rgba(40,28,14,.4)');   // its shadow on the wall
  rect(-1.18, 4.55, 1.18, 6.2, M0);
  for (const sg of [-1, 1]) {
    const a = (p, q) => [Math.min(sg * p, sg * q), Math.max(sg * p, sg * q)], rr = (p, q, y0, y1, f) => { const [u, v] = a(p, q); rect(u, y0, v, y1, f); };
    rr(1.18, 1.4, 5.68, 6.08, M0); rr(1.18, 1.36, 4.45, 4.85, M0); rr(1.24, 1.28, 5.72, 6.02, SH); curl(sg * 1.25, 5.3, 0.17, sg); curl(sg * 0.95, 6.28, 0.15, -sg);
    rr(1.12, 1.15, 4.66, 6.12, SH);
  }
  rect(-0.42, 6.15, 0.42, 6.5, M0); curl(-0.25, 6.6, 0.18, 1); curl(0.25, 6.6, 0.18, -1); rect(-0.14, 6.52, 0.14, 6.72, M0);
  oval(0, 6.38, 0.17, 0.2, '#b9ad92'); oval(0, 6.36, 0.11, 0.14, LIT); for (const q of [-0.045, 0.045]) oval(q, 6.39, 0.022, 0.016, SH); rect(-0.025, 6.28, 0.025, 6.3, SH);
  for (const [a, b] of [[-0.95, -0.5], [-0.5, -0.02], [0.02, 0.5], [0.5, 0.95]]) for (const [dy, c] of [[0.035, SH], [0, LIT], [-0.06, M0]]) {
    g.strokeStyle = c; g.lineWidth = 0.06 * sy; g.beginPath(); g.moveTo(X(a), Y(6.26 + dy)); g.quadraticCurveTo(X((a + b) / 2), Y(5.94 + dy), X(b), Y(6.26 + dy)); g.stroke();
  }
  for (const s of [-0.95, -0.5, 0.5, 0.95]) rect(s - 0.035, 5.96, s + 0.035, 6.3, LIT);
  for (const sg of [-1, 1]) for (let i = 0; i < 26; i++) { const t = r_(), s = sg * (0.12 + t * 0.85), y = 4.4 - 0.1 * Math.sin(t * PI) + (r_() - 0.5) * 0.17; oval(s + 0.02, y - 0.02, 0.07, 0.07, SH); oval(s, y, 0.065, 0.065, r_() < 0.5 ? LIT : M0); }
  oval(0, 4.42, 0.11, 0.14, M0); curl(-1.05, 4.45, 0.1, 1); curl(1.05, 4.45, 0.1, -1);
}

// The pictures mapped onto quads: the four inscriptions (dark red-brown capitals on white marble), the royal arms (quartered, in relief) and the tablet under a king (lettering, not read).
function atlasQC(g) {
  const r_ = R_(151);
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  QC_FRONTS.forEach((f, i) => {
    const [x0, y0, x1, y1] = QCA.plaque(i), w = x1 - x0, h = y1 - y0, L = f.plaque;
    g.fillStyle = '#ddd7c9'; g.fillRect(x0 - 2, y0 - 3, w + 4, h + 6);
    g.strokeStyle = 'rgba(80,66,46,.55)'; g.lineWidth = 1.5; g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
    const step = (h - 10) / (L.length + 0.35);
    g.fillStyle = '#51342a';
    L.forEach((t, k) => { const size = k ? step * 1.02 : step * 1.3; g.font = `bold ${size.toFixed(1)}px Georgia, serif`; g.fillText(t, x0 + w / 2, y0 + 5 + step * (k + (k ? 0.85 : 0.55)), w - (t.length < 30 ? 40 : 10)); });
  });
  {   // the royal arms: a bordered shield, quartered, each quarter with its own pattern
    const [x0, y0, x1, y1] = QCA.arms, w = x1 - x0, h = y1 - y0;
    g.fillStyle = '#e2ddd0'; g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    g.strokeStyle = 'rgba(70,58,40,.65)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x0 + w / 2, y0 + h * 0.46, w * 0.4, h * 0.4, 0, 0, 7); g.stroke();
    const a = x0 + w * 0.2, b = y0 + h * 0.16, qw = w * 0.3, qh = h * 0.3;
    g.fillStyle = 'rgba(80,68,50,.62)';
    for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++) {
      const x = a + qx * qw, y = b + qy * qh; g.strokeRect(x, y, qw, qh);
      if ((qx + qy) % 2 === 0) for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { if ((i + j) % 2) g.fillRect(x + 2 + i * (qw - 4) / 4, y + 2 + j * (qh - 4) / 5, (qw - 4) / 4, (qh - 4) / 5); }
      else for (let i = 0; i < 4; i++) g.fillRect(x + 3 + i * (qw - 5) / 4, y + 3, 2, qh - 6);
    }
    g.fillStyle = '#d6d0c0'; g.beginPath(); g.ellipse(x0 + w / 2, b + qh, w * 0.11, h * 0.09, 0, 0, 7); g.fill(); g.stroke();
    for (let i = 0; i < 18; i++) { const t = i / 18 * TWO; g.fillStyle = 'rgba(90,76,56,.5)'; g.fillRect(x0 + w / 2 + Math.cos(t) * w * 0.45 - 2, y0 + h * 0.46 + Math.sin(t) * h * 0.43 - 2, 4, 4); }
  }
  {   // the tablet under the king
    const [x0, y0, x1, y1] = QCA.tablet;
    g.fillStyle = '#e0dbcd'; g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    g.fillStyle = 'rgba(84,70,58,.7)';
    for (let y = y0 + 4; y < y1 - 4; y += 5) for (let x = x0 + 5 + r_() * 5; x < x1 - 8; ) { const w = 2 + r_() * 5; g.fillRect(x, y, Math.min(w, x1 - 5 - x), 2.4); x += w + 1.6; }
  }
  g.restore();
}

// The carving of the Quattro Canti, painted on the wall texture (no geometry, no normals): egg-and-dart on the cornices and the modillions under the upper two, the frieze of consoles and carved
// trophies under the balcony, shells over the lowest windows, lozenges of shade beside the columns, deep shadow under the balcony, soft patina. Light from the upper left.
// Drawn from the photographs named above (looked at, nothing copied).
function carveQC(g, W, H, Wd) {
  const sx = W / Wd, sy = H / 25.6, X = (s) => (s + Wd / 2) * sx, Y = (y) => H - y * sy, r_ = R_(131);
  const T1 = 7.4, T2 = 15.0, T3 = 21.8, LIT = '#e3d6b4', MID = '#c4b28a', DRK = 'rgba(38,26,12,.55)';
  const rect = (s0, y0, s1, y1, f) => { g.fillStyle = f; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy); };
  const oval = (s, y, rw, rh, f, a = 0) => { g.fillStyle = f; g.beginPath(); g.ellipse(X(s), Y(y), rw * sx, rh * sy, a, 0, 7); g.fill(); };
  const line = (s0, y0, s1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w * sx; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(s0), Y(y0)); g.lineTo(X(s1), Y(y1)); g.stroke(); };
  const curl = (s, y, rad, dir) => {   // a volute: a spiral drawn dark, then lit a little to the upper left, ending in a round eye
    for (const [dx, dy, c, w] of [[0.012, -0.012, LIT, 0.06], [0, 0, DRK, 0.06]]) {
      g.strokeStyle = c; g.lineWidth = w * sx; g.lineCap = 'round'; g.beginPath();
      for (let t = 0; t <= 9; t += 0.25) { const a = dir * t * 0.7 + 1.2, rr = rad * (1 - t / 10.5); g[t ? 'lineTo' : 'moveTo'](X(s + dx + Math.cos(a) * rr), Y(y + dy + Math.sin(a) * rr)); }
      g.stroke();
    }
    oval(s, y, 0.04, 0.04, LIT);
  };
  const shell = (s, y, rad) => {   // a scallop fan: a half disc with ribs
    g.fillStyle = LIT; g.beginPath(); g.ellipse(X(s), Y(y), rad * sx, rad * sy, 0, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = DRK; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; g.moveTo(X(s), Y(y)); g.lineTo(X(s) + Math.cos(a) * rad * sx, Y(y) + Math.sin(a) * rad * sy); } g.stroke();
    g.strokeStyle = 'rgba(38,26,12,.4)'; g.beginPath(); g.ellipse(X(s), Y(y), rad * sx, rad * sy, 0, Math.PI, 0); g.stroke();
  };
  const soft = (s0, y0, s1, y1, a, horiz, rev) => {   // a soft shadow: a gradient over a rectangle, dark at the first edge (horiz: along the width, else along the height)
    const gr = horiz ? g.createLinearGradient(X(s0), 0, X(s1), 0) : g.createLinearGradient(0, Y(y1), 0, Y(y0));
    gr.addColorStop(rev ? 1 : 0, `rgba(25,16,8,${a})`); gr.addColorStop(rev ? 0 : 1, 'rgba(25,16,8,0)'); g.fillStyle = gr; g.fillRect(X(s0), Y(y1), (s1 - s0) * sx, (y1 - y0) * sy);
  };

  // large soft patina first: golden, brown and pale clouds, so no stretch of wall is one colour
  for (let i = 0; i < 46; i++) {
    const s = (r_() - 0.5) * Wd, y = 2 + r_() * 22, rad = (0.9 + r_() * 2.4) * sx, k = r_();
    const gr = g.createRadialGradient(X(s), Y(y), 2, X(s), Y(y), rad); const c = k < 0.35 ? '190,146,84' : k < 0.7 ? '58,46,32' : '232,220,192'; gr.addColorStop(0, `rgba(${c},${0.10 + r_() * 0.08})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(X(s) - rad, Y(y) - rad, 2 * rad, 2 * rad);
  }
  // shade beside every column, and under the balcony: the depth the flat wall lacks
  for (const [ya, yb] of [[2.1, T1 - 0.8], [T1 + 1.1, T2], [T2 + 0.6, T3]]) for (const c of [-2.4, 2.4]) { soft(c + 0.3, ya, c + 1.0, yb, 0.26, true); soft(c - 1.0, ya, c - 0.3, yb, 0.26, true, true); }
  soft(-Wd / 2, T1 - 1.15, Wd / 2, T1 - 0.75, 0.45, false);   // the frieze throws its shadow down the wall

  // the cornices: egg-and-dart on the top band, and under the upper two the modillions (brackets with a lit face, a dark side and two drops)
  for (const [yb, w] of [[T1, 0.65], [T2, 0.6], [T3, 0.7]]) {
    for (let s = -Wd / 2 + 0.2; s < Wd / 2 - 0.1; s += 0.16) { oval(s + 0.07, yb + w + 0.07, 0.05, 0.07, 'rgba(244,232,200,.55)'); rect(s + 0.125, yb + w, s + 0.16, yb + w + 0.15, 'rgba(38,26,12,.38)'); }
    if (yb === T1) continue;
    rect(-Wd / 2, yb - 0.4, Wd / 2, yb, 'rgba(38,26,12,.34)');
    for (let s = -Wd / 2 + 0.4; s < Wd / 2; s += 0.7) {
      rect(s - 0.15, yb - 0.38, s + 0.15, yb, '#b7a57e'); rect(s - 0.15, yb - 0.38, s - 0.1, yb, '#dbcca6'); rect(s + 0.1, yb - 0.38, s + 0.15, yb, 'rgba(38,26,12,.55)'); rect(s - 0.15, yb - 0.38, s + 0.15, yb - 0.3, 'rgba(38,26,12,.4)');
      for (const q of [-0.07, 0.07]) rect(s + q - 0.02, yb - 0.4, s + q + 0.02, yb - 0.34, '#dbcfac');
    }
  }
  // the frieze under the balcony: a long console under each corbel, a carved trophy (crown, shield, crossed arms, scroll) in each space between
  for (let k = 0; k < 12; k++) {
    const s = -Wd / 2 + 0.5 + 1.1 * k;
    rect(s - 0.2, T1 - 0.74, s + 0.2, T1, MID); rect(s - 0.2, T1 - 0.74, s - 0.13, T1, LIT); rect(s + 0.12, T1 - 0.74, s + 0.2, T1, DRK); curl(s, T1 - 0.55, 0.13, 1);
    const m = s + 0.55, yc = T1 - 0.4; if (m > Wd / 2 - 0.3) continue;
    rect(m - 0.31, T1 - 0.7, m + 0.31, T1 - 0.1, 'rgba(60,44,24,.35)');
    if (k % 4 === 0) { for (const q of [-0.16, 0, 0.16]) { line(m + q, yc - 0.05, m + q * 1.3, yc + 0.19, LIT, 0.05); oval(m + q * 1.3, yc + 0.2, 0.04, 0.04, LIT); } rect(m - 0.2, yc - 0.15, m + 0.2, yc - 0.04, LIT); }
    else if (k % 4 === 1) { oval(m, yc, 0.15, 0.2, MID); oval(m - 0.03, yc + 0.02, 0.1, 0.14, LIT); curl(m - 0.18, yc + 0.1, 0.09, 1); curl(m + 0.18, yc + 0.1, 0.09, -1); }
    else if (k % 4 === 2) { line(m - 0.23, yc - 0.22, m + 0.23, yc + 0.22, LIT, 0.06); line(m - 0.23, yc + 0.22, m + 0.23, yc - 0.22, MID, 0.06); oval(m, yc, 0.09, 0.11, LIT); }
    else { curl(m - 0.08, yc + 0.04, 0.18, -1); line(m - 0.2, yc - 0.2, m + 0.24, yc + 0.06, LIT, 0.07); oval(m + 0.2, yc + 0.12, 0.07, 0.09, LIT); }
  }
  // over each of the lowest windows a scallop between two scrolls; beside the middle windows a scrolled ear
  for (const sg of [-1, 1]) {
    const s = sg * 4.1; shell(s, 6.62, 0.27); curl(s - 0.45, 6.66, 0.15, -1); curl(s + 0.45, 6.66, 0.15, 1);
    for (const q of [-1.08, 1.08]) { curl(s + q, 12.7, 0.13, q > 0 ? 1 : -1); line(s + q, 12.55, s + q * 0.98, 11.5, 'rgba(232,216,176,.7)', 0.07); }
  }
}

// ---------- the figures ----------
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
// a square bar from a to b (frame M): arms, legs, sticks
function limb(key, M, a, b, t, c) {
  const A = V3(a), d = V3(b).sub(A), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len));
  box(key, t, len, t, { M: mul(M, new THREE.Matrix4().compose(A, q, ONE)), c, noao: true });
}
// a carved lump: 8 triangles, or 20 with o.fine (fruit, curls of cloud, heads seen small)
function lump(M, p, r, c, o = {}) {
  const g = geo(o.fine ? 'ico' : 'oct', () => {   // smooth normals: the corners are shared, and the lump reads round
    const q = o.fine ? new THREE.IcosahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 0);
    q.attributes.normal.array.set(q.attributes.position.array); return q;
  });
  part(o.key || 'marble', g, { M, p, s: [r * (o.kx || 1), r * (o.ky || 1), r * (o.kz || 1)], c, noao: true });
}
// arms from the shoulders: pose [[elbow, hand] left, [elbow, hand] right], in units of the height; left and right are as seen from the piazza
function armsQC(M, k, pose, c, y = 0.66) {
  pose.forEach(([el, hd], i) => { const sh = [(i ? 0.16 : -0.16) * k, y * k, 0.01 * k], e = el.map(v => v * k), h = hd.map(v => v * k); limb('marble', M, sh, e, 0.075 * k, c); limb('marble', M, e, h, 0.055 * k, c); });
}
// a woman in long drapery (the saints and the seasons): robe, shoulders, head with hair, mantle behind
function womanQC(M, k, pose, c, shade) {
  lathe('marble', [[0.23, 0], [0.19, 0.2], [0.13, 0.43], [0.12, 0.52], [0.17, 0.63], [0.045, 0.73]].map(q => [q[0] * k, q[1] * k]), 7, { M, c, noao: true });
  box('marble', 0.36 * k, 0.08 * k, 0.16 * k, { M, p: [0, 0.61 * k, 0], c, noao: true });
  lump(M, [0, 0.81 * k, 0.015 * k], 0.087 * k, c, { fine: true, ky: 1.15 });
  lump(M, [0, 0.845 * k, -0.025 * k], 0.1 * k, shade, { fine: true });   // the hair
  box('marble', 0.38 * k, 0.56 * k, 0.05 * k, { M, p: [0.04 * k, 0.1 * k, -0.14 * k], rz: 0.05, c: shade, noao: true });
  armsQC(M, k, pose, c);
}
// an animal sitting at a figure's feet, looking out
function beastQC(M, k, x, c) { limb('marble', M, [x * k, 0, 0.06 * k], [x * 0.9 * k, 0.2 * k, 0.13 * k], 0.12 * k, c); lump(M, [x * 0.9 * k, 0.25 * k, 0.17 * k], 0.07 * k, c, { fine: true }); limb('marble', M, [x * 0.8 * k, 0, 0.17 * k], [x * 0.88 * k, 0.16 * k, 0.15 * k], 0.045 * k, c); }
// the fountain's season, k metres high
function seasonQC(M, k, which) {
  const c = '#e3d9c2', sh = '#cfc4aa', P = (x, y, z) => [x * k, y * k, z * k];
  if (which === 'autumn') {   // a basket of fruit on the left arm, grapes in her hair, a panther at her side
    womanQC(M, k, [[[-0.26, 0.5, 0.05], [-0.22, 0.49, 0.18]], [[0.23, 0.48, 0.07], [0.08, 0.47, 0.18]]], c, sh);
    cyl('marble', 0.11 * k, 0.075 * k, 0.075 * k, 6, { M, p: P(-0.23, 0.46, 0.19), c: sh, noao: true });
    for (const [x, y] of [[-0.29, 0.55], [-0.22, 0.57], [-0.16, 0.55], [-0.04, 0.91], [0.05, 0.9]]) lump(M, P(x, y, y > 0.8 ? 0.02 : 0.2), 0.045 * k, c);
    beastQC(M, k, 0.25, sh);
  } else if (which === 'winter') {   // an old woman, veiled, a brazier held to her breast, birds at her feet
    womanQC(M, k, [[[-0.2, 0.52, 0.1], [0.04, 0.59, 0.19]], [[0.24, 0.52, 0.06], [0.17, 0.57, 0.19]]], c, sh);
    const hood = new THREE.LatheGeometry([[0.16, 0.66], [0.115, 0.8], [0.105, 0.88], [0.0, 0.93]].map(q => new THREE.Vector2(q[0] * k, q[1] * k)), 6, PI * 0.35, PI * 1.3);
    part('marble', hood, { M, c: sh, noao: true });
    cyl('marble', 0.065 * k, 0.045 * k, 0.07 * k, 6, { M, p: P(0.11, 0.58, 0.21), c: sh, noao: true }); lump(M, P(0.11, 0.69, 0.21), 0.05 * k, c, { ky: 1.4 });
    for (const x of [-0.24, 0.24]) { lump(M, P(x, 0.07, 0.1), 0.07 * k, sh, { fine: true }); limb('marble', M, P(x, 0.09, 0.12), P(x * 1.1, 0.22, 0.15), 0.04 * k, sh); }
  } else if (which === 'spring') {   // a crown of flowers, an armful of flowers on the right, a dog at her side
    womanQC(M, k, [[[-0.2, 0.5, 0.12], [0.08, 0.53, 0.2]], [[0.27, 0.5, 0.07], [0.22, 0.52, 0.18]]], c, sh);
    for (let i = 0; i < 7; i++) { const a = i / 6 * PI; lump(M, P(Math.cos(a) * 0.11, 0.84 + Math.sin(a) * 0.09, 0.03), 0.04 * k, c); }
    for (const [x, y] of [[0.14, 0.55], [0.22, 0.58], [0.28, 0.53], [0.19, 0.49], [0.26, 0.46], [0.31, 0.59]]) lump(M, P(x, y, 0.2), 0.05 * k, c, { fine: true });
    beastQC(M, k, 0.26, sh);
  } else {   // summer: a sheaf of ears in the left hand, a stalk of fruit raised in the right, an animal at her feet
    womanQC(M, k, [[[-0.26, 0.52, 0.04], [-0.25, 0.43, 0.14]], [[0.27, 0.54, 0.06], [0.24, 0.65, 0.15]]], c, sh);
    for (const x of [-0.04, 0, 0.04]) limb('marble', M, P(-0.24 + x * 0.3, 0.31, 0.15), P(-0.27 + x, 0.6, 0.15), 0.025 * k, sh);
    limb('marble', M, P(0.24, 0.53, 0.17), P(0.25, 0.82, 0.17), 0.025 * k, sh);
    for (const [x, y] of [[0.25, 0.86], [0.2, 0.81], [0.3, 0.8], [0.24, 0.76], [0.29, 0.87]]) lump(M, P(x, y, 0.17), 0.043 * k, c, { fine: true });
    beastQC(M, k, -0.25, sh);
  }
}
// the patron saint of the top niche, k metres high; each holds what the photographs show
function saintQC(M, k, which) {
  const c = '#e8e3d4', sh = '#d3cdbc', P = (x, y, z) => [x * k, y * k, z * k];
  const book = (x, y, z, rz) => box('marble', 0.15 * k, 0.1 * k, 0.05 * k, { M, p: P(x, y, z), rz, rx: -0.5, c: sh, noao: true });
  if (which === 'oliva') {   // one hand lifted at the shoulder, a book held across the waist
    womanQC(M, k, [[[-0.25, 0.51, 0.07], [-0.2, 0.65, 0.15]], [[0.24, 0.49, 0.07], [0.02, 0.49, 0.18]]], c, sh); book(-0.02, 0.45, 0.2, 0.15);
  } else if (which === 'agata') {   // a hand brought to the breast, an open book held out
    womanQC(M, k, [[[-0.26, 0.52, 0.08], [-0.09, 0.67, 0.17]], [[0.24, 0.47, 0.05], [0.29, 0.48, 0.17]]], c, sh); book(0.31, 0.47, 0.19, -0.3); limb('marble', M, P(-0.09, 0.62, 0.18), P(-0.1, 0.72, 0.18), 0.025 * k, sh);
  } else if (which === 'cristina') {   // the millstone standing beside her, a finger pointing up, a book on the hip
    womanQC(M, k, [[[-0.27, 0.6, 0.07], [-0.23, 0.77, 0.13]], [[0.26, 0.48, 0.05], [0.19, 0.47, 0.17]]], c, sh); book(0.18, 0.43, 0.19, -0.2);
    limb('marble', M, P(-0.23, 0.77, 0.13), P(-0.23, 0.87, 0.13), 0.022 * k, c);
    for (const [r, t, col, z] of [[0.2, 0.08, c, 0.06], [0.05, 0.1, '#6a6a66', 0.07]]) cyl('marble', r * k, r * k, t * k, r > 0.1 ? 12 : 6, { M: mul(M, tr(-0.27 * k, 0.2 * k, z * k)), rx: PI / 2, ry: 0.35, c: col, noao: true });
  } else {   // ninfa: a vase with a flame raised to the shoulder
    womanQC(M, k, [[[-0.24, 0.49, 0.07], [-0.1, 0.47, 0.17]], [[0.28, 0.54, 0.08], [0.22, 0.68, 0.16]]], c, sh);
    cyl('marble', 0.06 * k, 0.035 * k, 0.08 * k, 6, { M, p: P(0.22, 0.68, 0.17), c: sh, noao: true }); lump(M, P(0.22, 0.81, 0.17), 0.045 * k, c, { ky: 1.5 });
  }
}
// the Spanish king of the middle niche, k metres high: a standing man, one arm low, the other at the waist
function kingQC(M, k, which) {
  const c = '#e2ddce', sh = '#c9c3b2', P = (x, y, z) => [x * k, y * k, z * k], L = (prof, col) => lathe('marble', prof.map(q => [q[0] * k, q[1] * k]), 7, { M, c: col || c, noao: true });
  const roman = which === 'charles5', boots = which === 'philip4';
  for (const sg of [-1, 1]) { limb('marble', M, P(sg * 0.1, 0, sg < 0 ? 0.05 : 0), P(sg * 0.08, 0.24, 0.02), (boots ? 0.095 : 0.065) * k, boots ? sh : c); limb('marble', M, P(sg * 0.08, 0.23, 0.02), P(sg * 0.06, 0.45, 0), 0.095 * k, c); }
  L(roman ? [[0.18, 0.33], [0.12, 0.53]] : [[0.1, 0.36], [0.175, 0.4], [0.16, 0.47], [0.11, 0.54]]);   // the skirt of the armour, or the full breeches
  L([[0.11, 0.52], [0.14, 0.66], [0.13, 0.72], [0.045, 0.76]]);
  if (!roman) L([[0.22, 0.63], [0.17, 0.71], [0.05, 0.77]], sh);   // the short cape on the shoulders
  else limb('marble', M, P(-0.17, 0.7, 0.07), P(0.1, 0.55, 0.12), 0.07 * k, sh);   // the cloak thrown across the breast
  lump(M, P(0, 0.83, 0.01), 0.078 * k, c, { fine: true, ky: 1.15 });
  box('marble', 0.34 * k, 0.66 * k, 0.045 * k, { M, p: P(0.02, 0.04, -0.12), c: sh, noao: true });   // the long cloak behind
  if (which === 'philip4') for (const sg of [-1, 1]) box('marble', 0.05 * k, 0.15 * k, 0.1 * k, { M, p: P(sg * 0.08, 0.74, -0.01), c: sh, noao: true });
  if (roman || which === 'philip2') lump(M, P(0, 0.785, 0.065), 0.045 * k, sh, { ky: 1.2 });   // the beard
  if (roman) cyl('marble', 0.085 * k, 0.083 * k, 0.025 * k, 8, { M, p: P(0, 0.87, 0.005), c: sh, noao: true });   // laurel, no crown
  else { cyl('marble', 0.08 * k, 0.065 * k, 0.055 * k, 6, { M, p: P(0, 0.885, 0.005), c, noao: true }); lump(M, P(0, 0.955, 0.005), 0.032 * k, c); }
  const POSE = {
    philip3: [[[-0.27, 0.56, 0.07], [-0.36, 0.57, 0.17]], [[0.26, 0.54, 0.04], [0.16, 0.49, 0.14]]],
    philip4: [[[-0.24, 0.53, 0.05], [-0.23, 0.4, 0.14]], [[0.27, 0.54, 0.06], [0.11, 0.53, 0.17]]],
    charles5: [[[-0.24, 0.52, 0.04], [-0.26, 0.38, 0.12]], [[0.27, 0.52, 0.06], [0.15, 0.5, 0.16]]],
    philip2: [[[-0.24, 0.52, 0.05], [-0.25, 0.38, 0.13]], [[0.28, 0.55, 0.05], [0.16, 0.49, 0.15]]],
  };
  armsQC(M, k, POSE[which], c, 0.68);
  if (which === 'philip3') limb('marble', M, P(-0.39, 0.55, 0.19), P(-0.32, 0.6, 0.17), 0.03 * k, sh);
  if (which === 'philip4') limb('marble', M, P(-0.23, 0.42, 0.15), P(-0.2, 0.31, 0.17), 0.03 * k, sh);
  if (roman) limb('marble', M, P(0.09, 0.45, 0.18), P(0.2, 0.57, 0.17), 0.032 * k, sh);
  if (which === 'philip2' || which === 'philip3') limb('marble', M, P(0.15, 0.49, 0.11), P(0.29, 0.24, 0.02), 0.022 * k, sh);   // the sword
}
// a winged child angel, k metres high: raised (one arm up, on the middle pediments) or holding a crown (on the cloud over the saint)
function angelQC(M, k, raised) {
  const c = '#e6e1d2', P = (x, y, z) => [x * k, y * k, z * k];
  lathe('marble', [[0.17, 0], [0.1, 0.36], [0.15, 0.6], [0.04, 0.72]].map(q => [q[0] * k, q[1] * k]), 6, { M, c, noao: true });
  lump(M, P(0, 0.82, 0.02), 0.11 * k, c, { fine: true });
  for (const sg of [-1, 1]) {
    const w = new THREE.Shape(); [[0.07, 0.62], [0.24, 0.9], [0.42, 0.82], [0.34, 0.5], [0.27, 0.22], [0.12, 0.4]].forEach((q, i) => w[i ? 'lineTo' : 'moveTo'](sg * q[0] * k, q[1] * k));
    part('marble', new THREE.ShapeGeometry(w), { M, p: P(0, 0, -0.1), c: '#d8d2c1', noao: true });
  }
  if (raised) { limb('marble', M, P(-0.13, 0.64, 0), P(-0.24, 0.45, 0.1), 0.06 * k, c); limb('marble', M, P(0.13, 0.64, 0), P(0.24, 0.98, 0.04), 0.06 * k, c); }
  else {
    for (const sg of [-1, 1]) limb('marble', M, P(sg * 0.14, 0.64, 0), P(sg * 0.17, 0.5, 0.2), 0.065 * k, c);
    cyl('marble', 0.22 * k, 0.17 * k, 0.14 * k, 8, { M, p: P(0, 0.46, 0.23), c, noao: true });
    for (let i = 0; i < 5; i++) { const a = i / 4 * PI; lump(M, P(Math.cos(a) * 0.2, 0.63, 0.23 + Math.sin(a) * 0.1), 0.035 * k, c); }
  }
}

const QC_LAMPS = [];   // the candelabra's lanterns (x, ground y, z, height), lit at night by src/daynight.js
function buildQuattroCanti() {
  CUR = 'Quattro Canti'; QC_LAMPS.length = 0;
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
  const T1 = 7.4, T2 = 15.0, T3 = 21.8, GREY = '#9a9ea3', GREY_D = '#7d8187', WHITE = '#e4decd', STONE = '#a49780', STONE_L = '#c0b298', STONE_D = '#7f7563', WATER = '#5f93ab';
  // a shape from points (x, y); mirrored with sg = -1
  const poly = (P, sg = 1) => { const sh = new THREE.Shape(); P.forEach((q, i) => sh[i ? 'lineTo' : 'moveTo'](sg * q[0], q[1])); return sh; };
  const shield = new THREE.Shape(); shield.moveTo(-0.8, 0); shield.lineTo(0.8, 0); shield.lineTo(0.8, 1.2); shield.quadraticCurveTo(0.8, 2.1, 0, 2.5); shield.quadraticCurveTo(-0.8, 2.1, -0.8, 1.2); shield.lineTo(-0.8, 0);
  const slab = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
  // the shield of the royal arms, point down: 1.9 x 2.8 m
  const arms = () => { const s = new THREE.Shape(); s.moveTo(-0.8, 2.8); s.lineTo(-0.95, 2.3); s.lineTo(-0.95, 1.2); s.quadraticCurveTo(-0.8, 0.25, 0, 0); s.quadraticCurveTo(0.8, 0.25, 0.95, 1.2); s.lineTo(0.95, 2.3); s.lineTo(0.8, 2.8); s.lineTo(-0.8, 2.8); return s; };
  // a flat quad (or shape) showing a rectangle of the wall texture; box0: the extent of the geometry's uv [u0, v0, u1, v1] that the rectangle covers (0..1 for a plane, metres for a shape)
  const picture = (g, [px0, r0, px1, r1], M, box0 = [0, 0, 1, 1]) => {
    const uk = (px1 - px0) / QCW / (box0[2] - box0[0]), vk = (r1 - r0) / QCH / (box0[3] - box0[1]);
    part('qcwall', g, { M, uv: 'keep', uvk: [uk, vk], uvo: [px0 / QCW - box0[0] * uk, 1 - r1 / QCH - box0[1] * vk], noao: true });
    g.dispose();
  };

  for (const arc of arcs) {
    // which of the four fronts this is, by the way it lies from the crossing
    const off = (f) => Math.abs(Math.atan2(Math.sin(f.facing - arc.mid), Math.cos(f.facing - arc.mid)));
    let fi = 0; for (let i = 1; i < QC_FRONTS.length; i++) if (off(QC_FRONTS[i]) < off(QC_FRONTS[fi])) fi = i;
    const front = QC_FRONTS[fi];
    const th = (s) => arc.mid + s / Rf;
    const gy0 = groundY(cx + Rf * Math.cos(arc.mid), cz + Rf * Math.sin(arc.mid));
    BASEY = gy0;
    // local frame at facade coordinate s, height y, depth z (toward the piazza)
    const at = (s, y = 0, z = 0) => {
      const t = th(s), dx = Math.cos(t), dz = Math.sin(t);
      const m = frame(cx + Rf * dx, gy0 + y, cz + Rf * dz, -dx, -dz);
      return z ? mul(m, tr(0, 0, z)) : m;
    };
    // wall surface: faceted concave strip with the painted facade. Its top dips between the middle of the attic and the two end shields
    {
      const gg = new THREE.BufferGeometry(), P = [], N = [], U = [];
      const cuts = [-6.3, -5.5, -4.7, -3.9, -3.0, -2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25, 3.0, 3.9, 4.7, 5.5, 6.3], ybot = -1.0;
      for (let i = 0; i < cuts.length - 1; i++) {
        const sa = cuts[i], sb = cuts[i + 1], ytop = Math.abs(sa + sb) < 6 ? 25.6 : 23.0;
        const ta = th(sa), tb = th(sb);
        const pa = [cx + Rf * Math.cos(ta), cz + Rf * Math.sin(ta)], pb = [cx + Rf * Math.cos(tb), cz + Rf * Math.sin(tb)];
        const tm = (ta + tb) / 2, nx = -Math.cos(tm), nz = -Math.sin(tm);
        const ua = sa / Wd + 0.5, ub = sb / Wd + 0.5;
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
    // the pedestal (it stands out of the wall; the wall behind it holds the plaque pictures, QCA) and the broken entablatures at the three tiers (their modillions are painted, carveQC)
    arcSlab('ashlar', -Wd / 2, Wd / 2, 0, 1.9, 0, 0.3, STONE_D);
    arcSlab('ashlar', -Wd / 2, Wd / 2, 1.9, 2.15, 0, 0.45, STONE_L);
    for (const [yb, w] of [[T1, 0.65], [T2, 0.6], [T3, 0.7]]) {
      arcSlab('ashlar', -Wd / 2, Wd / 2, yb, yb + 0.6, 0, w, STONE);
      arcSlab('ashlar', -Wd / 2, Wd / 2, yb + 0.6, yb + 0.78, 0, w + 0.22, STONE_L);
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
    // the busts that carry the balcony, over the columns and at the two ends
    for (const s of [-5.8, -2.4, 2.4, 5.8]) { box('ashlar', 0.48, 0.5, 0.4, { M: at(s, T1 - 0.45, 1.02), c: STONE_L }); lump(at(s, T1 + 0.2, 1.2), [0, 0, 0], 0.22, STONE_L, { key: 'ashlar', fine: true }); }
    // ---- the fountain at the foot of the middle bay: steps, a garlanded basin, a stem, the upper basin with its shield, and the season on a plinth over a mask
    {
      const F = (y, z = 2.15) => at(0, y, z);
      cyl('marble', 2.7, 2.78, 0.2, 16, { M: F(0), c: '#b9b2a2' }); cyl('marble', 2.35, 2.42, 0.2, 16, { M: F(0.2), c: '#c4bdac' });
      lathe('marble', [[0, 0.0], [0.6, 0.0], [1.7, 0.15], [2.0, 0.45], [2.05, 0.75], [1.85, 0.8], [1.7, 0.55], [0, 0.35]], 16, { M: F(0.4), c: '#d3cdbc' });   // lower basin
      for (let k = 0; k < 20; k++) { const a = k * TWO / 20; lump(F(0.8 - (k % 2) * 0.1), [Math.cos(a) * 2.03, 0, Math.sin(a) * 2.03], 0.15, '#cfc9b8'); }   // the garland of the basin
      cyl('flat', 1.7, 1.7, 0.03, 16, { M: F(1.12), c: WATER, noao: true });
      cyl('marble', 0.26, 0.42, 0.9, 8, { M: F(0.8), c: '#d3cdbc' });
      lathe('marble', [[0, 0], [0.4, 0.05], [1.05, 0.25], [1.15, 0.5], [0.98, 0.52], [0.9, 0.35], [0, 0.18]], 12, { M: F(1.6), c: '#d9d3c2' });   // upper basin
      cyl('flat', 0.9, 0.9, 0.03, 12, { M: F(2.0), c: WATER, noao: true });
      part('marble', slab(shield, 0.14), { M: at(0, 1.55, 3.22), s: [0.34, 0.3, 1], c: '#e2dccb' });
      for (const q of [-2, -1, 1, 2]) lump(at(0, 1.98 - Math.abs(q % 2) * 0.12, 3.24), [q * 0.27, 0, -q * q * 0.035], 0.1, '#d6d0bf');
      box('marble', 0.5, 0.55, 0.4, { M: at(0, 1.15, 0.9), c: '#c7c0ae' });   // the mascaron the water comes from
      box('marble', 0.95, 0.55, 0.8, { M: at(0, 1.9, 0.62), c: '#cdc7b6' });   // plinth of the season
      lump(at(0, 2.2, 1.05), [0, 0, 0], 0.2, '#d6d0bf', { fine: true });
      seasonQC(at(0, 2.45, 0.72), 2.0, front.season);
    }
    // ---- the plaque: this front's inscription, in the painted cartouche
    picture(new THREE.PlaneGeometry(2.1, 1.3), QCA.plaque(fi), at(0, 5.4, 0.07));
    lump(at(0, 6.36, 0.1), [0, 0, 0], 0.13, '#e4decd', { fine: true });
    // ---- the niches of the two upper tiers: a dark bay with a scallop shell for a head and a moulding at its springing
    const niche = (y0, w, h, col) => {
      const spring = y0 + h - w / 2;
      part('dark', shapeGeo(archShape(w, h), 0.08), { M: at(0, y0, 0.04), uv: 'keep', c: col.back, noao: true });
      const half = new THREE.Shape(); half.moveTo(-w * 0.43, 0); half.lineTo(w * 0.43, 0); half.absarc(0, 0, w * 0.43, 0, PI, false);
      part('dark', new THREE.ShapeGeometry(half, 5), { M: at(0, spring, 0.13), uv: 'keep', c: col.shell, noao: true });
      part('marble', shapeGeo(archShape(w + 0.4, h + 0.2), 0.2, archPath(w, h)), { M: at(0, y0 - 0.03, 0), c: col.frame });
      for (let k = 0; k < 7; k++) { const a = PI * (k + 0.5) / 7; box('marble', 0.06, w * 0.42, 0.07, { M: at(0, spring, 0.14), rz: a - PI / 2, c: col.rib }); }
      for (const q of [-1, 1]) box('marble', 0.3, 0.14, 0.24, { M: at(q * (w / 2 + 0.05), spring - 0.07, 0.14), c: col.band });
    };
    // the king: a grey marble niche, the figure on the white inscribed tablet
    niche(9.0, 1.75, 3.75, { back: '#3f4856', shell: '#2b313b', frame: '#737a84', rib: '#39414d', band: '#cab98f' });
    box('marble', 1.6, 0.92, 0.55, { M: at(0, 8.5, 0.42), c: WHITE });
    picture(new THREE.PlaneGeometry(1.54, 0.86), QCA.tablet, at(0, 8.96, 0.71));
    for (const q of [-1, 1]) box('ashlar', 0.2, 0.8, 0.4, { M: at(q * 0.96, 8.5, 0.3), rz: q * 0.16, c: STONE });
    kingQC(at(0, 9.42, 0.5), 2.75, front.king);
    // over the king: a grey bearded mask between two smaller ones, swags of white fruit between them and bunches under the side masks
    box('marble', 0.5, 0.72, 0.24, { M: at(0, 12.9, 0.14), c: '#8f9092' }); sphere('marble', 0.29, { M: at(0, 13.42, 0.3), seg: 6, c: '#a4a5a6', noao: true }); lump(at(0, 13.08, 0.34), [0, 0, 0], 0.19, '#8f9092', { fine: true, ky: 1.3 });
    for (const sg of [-1, 1]) {
      box('marble', 0.36, 0.46, 0.2, { M: at(sg * 1.38, 12.92, 0.12), c: '#97989a' }); lump(at(sg * 1.38, 13.2, 0.24), [0, 0, 0], 0.2, '#a4a5a6', { fine: true });
      for (let k = 1; k < 6; k++) { const t = k / 6; lump(at(sg * (0.28 + 0.92 * t), 13.34 - 0.3 * Math.sin(PI * t), 0.2), [0, 0, 0], 0.13 + 0.05 * Math.sin(PI * t), k % 2 ? '#d9d4c4' : '#ece7d9'); }
      for (const [dx, dy] of [[-0.09, 0], [0.09, 0.02], [0, -0.17]]) lump(at(sg * 1.38 + dx, 12.8 + dy, 0.18), [0, 0, 0], 0.11, '#e4dfd0');
    }
    // the patron saint: a white niche; above it a bracket, a cloud of curls and an angel holding a crown, in the gap of a broken pediment
    niche(15.8, 1.65, 3.5, { back: '#444d5b', shell: '#7e8284', frame: '#d4d0c4', rib: '#a9aaa5', band: '#e0dccf' });
    box('marble', 1.15, 0.65, 0.75, { M: at(0, 15.78, 0.5), c: WHITE });
    saintQC(at(0, 16.43, 0.65), 2.7, front.saint);
    box('marble', 0.36, 0.55, 0.45, { M: at(0, 19.3, 0.3), c: '#d9d3c2' });
    for (const [x, y, r] of [[-0.42, 20.08, 0.26], [0, 20.02, 0.31], [0.42, 20.08, 0.26], [-0.25, 20.36, 0.24], [0.25, 20.36, 0.24], [0, 19.78, 0.24], [0, 20.4, 0.22]]) lump(at(x, y, 0.4), [0, 0, 0], r, '#e4dfd1', { fine: true });
    angelQC(at(0, 20.3, 0.45), 1.15, false);
    for (const sg of [-1, 1]) {
      const rake = at(0, 0, 0.3);
      limb('ashlar', rake, [sg * 1.95, 20.05, 0], [sg * 0.78, 20.92, 0], 0.26, STONE_L);
      box('ashlar', 1.05, 0.22, 0.55, { M: at(sg * 1.45, 19.8, 0.27), c: STONE_L });
    }
    // ---- the side bays: the little balconies under the lowest windows, the broken curved pediments and their angels, the ledges of the top windows
    for (const sg of [-1, 1]) {
      const s = sg * 4.1;
      box('ashlar', 2.25, 0.2, 0.55, { M: at(s, 3.3, 0.27), c: STONE_L }); balus(at(s, 3.5, 0.5), 1.76, 0.98, { c: '#c2b79d' });
      box('marble', 2.15, 0.16, 0.48, { M: at(s, 4.48, 0.26), c: '#c9c1ac' });
      for (const q of [-1, 1]) box('ashlar', 0.18, 1.18, 0.46, { M: at(s + q * 0.99, 3.32, 0.23), c: STONE_L });
      // middle tier: a curved pediment broken in the middle, an angel standing in the gap
      box('ashlar', 2.4, 0.16, 0.42, { M: at(s, 13.3, 0.21), c: STONE_L });
      for (const q of [-1, 1]) part('ashlar', shapeGeo(poly([[1.2, 0.14], [1.12, 0.5], [0.82, 0.8], [0.42, 0.92], [0.42, 0.7], [0.74, 0.58], [0.94, 0.38], [0.98, 0.14]], q), 0.3), { M: at(s, 13.3, 0.06), c: STONE_L });
      box('marble', 0.5, 0.2, 0.4, { M: at(s, 13.46, 0.28), c: WHITE });
      angelQC(at(s, 13.66, 0.3), 1.3, true);
      // top tier: the sill and the head of the stucco frames stand out
      box('marble', 1.95, 0.16, 0.34, { M: at(s, 19.2, 0.15), c: WHITE });
      box('marble', 1.6, 0.14, 0.3, { M: at(s, 16.68, 0.13), c: WHITE });
    }
    // ---- the attic: two piers beside the royal arms, scrolls falling to the dip, a pier with a crowned shield at each end, stone eggs on the tops
    for (const sg of [-1, 1]) {
      box('ashlar', 1.2, 3.0, 0.55, { M: at(sg * 2.4, T3 + 0.75, 0.25), c: STONE_L }); box('ashlar', 1.5, 0.28, 0.75, { M: at(sg * 2.4, 25.55, 0.28), c: STONE });
      lump(at(sg * 2.4, 26.12, 0.35), [0, 0, 0], 0.22, '#d9cfb6', { fine: true, ky: 1.4 });
      cyl('ashlar', 0.55, 0.55, 0.36, 12, { M: at(sg * 3.7, 23.12, 0.1), rx: PI / 2, c: STONE_L }); cyl('ashlar', 0.26, 0.26, 0.42, 8, { M: at(sg * 3.7, 23.12, 0.12), rx: PI / 2, c: STONE_D });
      limb('ashlar', at(0, 0, 0.28), [sg * 3.75, 23.55, 0], [sg * 2.95, 24.6, 0], 0.3, STONE_L);
      lump(at(sg * 3.75, 24.0, 0.3), [0, 0, 0], 0.2, '#d9cfb6', { fine: true, ky: 1.4 });
      const e = sg * 5.5;
      box('ashlar', 1.45, 2.75, 0.6, { M: at(e, T3 + 0.75, 0.2), c: STONE_L });
      part('marble', slab(arms(), 0.18), { M: at(e, 23.0, 0.5), s: [0.65, 0.82, 1], c: WHITE });
      for (const q of [-1, 1]) lump(at(e + q * 0.62, 24.7, 0.62), [0, 0, 0], 0.22, '#d9d4c4', { fine: true });
      cyl('marble', 0.56, 0.44, 0.4, 8, { M: at(e, 25.3, 0.45), c: WHITE });
      for (let i = 0; i < 5; i++) { const a = i / 4 * PI; lump(at(e, 25.82, 0.45), [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.4], 0.12, WHITE); }
    }
    // the royal arms in the middle: two raised wings, the quartered shield with its collar, a head over it, the crown and the eagle's head on top
    for (const sg of [-1, 1]) {
      part('marble', shapeGeo(poly([[0.8, 0.45], [1.25, 0.5], [1.28, 0.95], [1.55, 1.0], [1.5, 1.6], [1.78, 1.75], [1.7, 2.6], [1.78, 3.45], [1.5, 3.95], [1.1, 3.8], [0.8, 3.0]], sg), 0.2), { M: at(0, 22.55, 0.5), c: '#dcd7c7' });
      for (let k = 0; k < 3; k++) limb('marble', at(0, 22.55, 0.74), [sg * 1.05, 3.3 - k * 0.8, 0], [sg * 1.6, 2.55 - k * 0.7, 0], 0.07, '#bdb6a4');
      limb('marble', at(0, 22.55, 0.7), [sg * 0.25, 0.75, 0], [sg * 1.35, 0.15, 0], 0.17, WHITE); lump(at(sg * 1.42, 22.7, 0.74), [0, 0, 0], 0.17, WHITE);
    }
    part('marble', shapeGeo(poly([[-0.75, 0.1], [-0.35, 0.65], [0.35, 0.65], [0.75, 0.1], [0.35, 0.22], [0, 0], [-0.35, 0.22]]), 0.16), { M: at(0, 22.55, 0.55), c: WHITE });
    part('marble', slab(arms(), 0.24), { M: at(0, 22.95, 0.6), s: [1.04, 1.02, 1], c: WHITE });
    picture(new THREE.ShapeGeometry(arms(), 3), QCA.arms, at(0, 22.98, 0.855), [-0.95, 0, 0.95, 2.8]);
    lump(at(0, 25.62, 0.92), [0, 0, 0], 0.27, '#e4decd', { fine: true });
    cyl('marble', 0.78, 0.6, 0.5, 8, { M: at(0, 25.88, 0.6), c: '#e9e4d6' });
    for (let i = 0; i < 7; i++) { const a = i / 6 * PI; lump(at(0, 26.5, 0.6), [Math.cos(a) * 0.72, 0, Math.sin(a) * 0.5], 0.13, '#e9e4d6'); }
    limb('marble', at(0, 26.35, 0.65), [0, 0, 0], [0, 0.95, 0], 0.32, WHITE); lump(at(0, 27.45, 0.67), [0, 0, 0], 0.32, WHITE, { fine: true }); limb('marble', at(0, 27.45, 0.75), [0, 0, 0], [0.5, -0.1, 0], 0.15, WHITE);
    // ---- two black candelabra lamps in front of the side bays, a lantern on each of three arms
    for (const sg of [-1, 1]) {
      const L = at(sg * 4.35, 0, 2.7);
      QC_LAMPS.push(L.elements[12], L.elements[13], L.elements[14], 3.55);
      lathe('flat', [[0, 0], [0.34, 0], [0.3, 0.5], [0.13, 0.9], [0.07, 1.1], [0.07, 3.2]], 8, { M: L, c: '#26262b', noao: true });
      for (const a of [-1, 0, 1]) {
        const x = a * 0.5, y = a ? 3.22 : 3.5;
        limb('flat', L, [0, 2.95, 0], [x, y, 0], 0.06, '#26262b');
        cyl('flat', 0.18, 0.11, 0.36, 5, { M: L, p: [x, y, 0], c: '#cdbb88', noao: true, open: true });
        cyl('flat', 0.03, 0.24, 0.18, 5, { M: L, p: [x, y + 0.36, 0], c: '#26262b', noao: true });
      }
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

// ====================================================================================================
// 2. Fontana Pretoria and Palazzo delle Aquile
// ====================================================================================================
// The fountain (Francesco Camilliani's) from the outside in: the iron railing with its medallions and putto posts on the mapped precinct, a flight of steps all round, the white
// balustrade with an entrance on each of the four sides between a pair of herms, the wide marble walk, four stairs rising to the inner terrace, between them four crescent pools with a river group
// on the outer rim (a reclining figure between two standing ones, an oval tub before it) and a wall of niches with animal heads behind the water, and on the terrace the round basin with the tall
// stem of three bowls and its figures. The palace closes the south side: rusticated ochre stone, nine bays, the white band with the balconies, the marble portal with the eagle, the clock with
// PEREVNT ET IMPVTANTVR, four flags, the aedicule with the Virgin over the middle and an eagle at each front corner.
// Reference photos (Wikimedia Commons, looked at, nothing copied or stored): "Fontana pretoria (Palermo) msu2017-0515", "Fontana Pretoria dai tetti di Santa Caterina", "Fontana di Piazza Pretoria
// Vista dai tetti di S. Caterina", "D7B7339 bis Piazza Pretoria & Municipio", "Palermo - Fontana di piazza Pretoria - 2023-09-02 10-38-49 001", "Palermo-Piazza-Pretoria-bjs2007-01, -02",
// "Fontana Pretoria (Palermo) 14 07 2024 01", "Palermo - Fontana Pretoria - 2025-09-24 12-22-00 001", "Palermo - Fontana Pretoria - 2025-09-07 18-03-28 001", "Fontana Pretoria stairs, Palermo,
// Italy (9458244016)", "Particolare della colonna centrale", "Vasche centrali della Fontana", "Piazza Pretoria (Palermo) 04", "Palermo, Fontana Pretoria 3", "Fontana Pretoria - statue 02",
// "Fontana Pretoria in Piazza Pretoria, Palermo, Sicily 3", "FP Pa 2013 05", "Palazzo Pretorio Palermo", "Palazzo Pretorio facciata", "Palazzo Pretorio portale centrale",
// "Palermo - Comune di Palermo - 2023-09-02 07-46-25 001", "Fontana e Palazzo Pretorio". The plan (centre, the herms, the river groups, the precinct) follows the mapped statues and walls.
// Not verified, left generic: which river, god or animal each figure is (the figures share one body and differ in pose, hair, beard, drapery and a plain animal at some feet), which diagonal the
// group with the horse stands on (judged from one photograph), the animals of the niche heads, the carving of the pedestals, tubs, central column and portal frieze, the arms on the shields, the
// wording of the plaques (strokes, no words), the places of the lamps and palm pots to the metre, and the other faces of the palace (one bay repeated from the corner seen towards Via Maqueda).
// Heights are read off the photos by eye. The walk leans with the piazza and stands somewhat higher than the real one on its low sides, to cover the inner walls the map draws inside the
// precinct (src/fences.js).
const PRET = (() => {
  const C = [71.9, 26.25], R = 18.5;
  // the railing: along the mapped precinct on the west, south and east (the 0.45 m plinth src/fences.js draws there), round an arc on the north, outside the herms
  const fence = [[55.4, 18], [53.7, 20.2], [53.7, 30.9], [54.8, 35.6], [57.4, 38.9], [63, 42.6], [66.6, 43.9], [70, 44.2], [75, 43.7], [81.4, 42.2], [86.1, 37.7], [91.2, 24.5]];
  const a0 = Math.atan2(24.5 - C[1], 91.2 - C[0]), a1 = Math.atan2(18 - C[1], 55.4 - C[0]);
  for (let i = 1; i < 12; i++) { const a = a0 + (a1 - a0) * i / 12; fence.push([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]); }
  // the eight herms (mapped as statues; src/props.js stands a plain figure on each spot, which these cover), two at each entrance
  const herms = [[65, 10.2], [69.9, 8.7], [55, 26.7], [58.3, 35.8], [89.6, 26.5], [87.3, 17.1], [79.5, 41.4], [74.9, 42.7]];
  // the four river groups on the diagonals (mapped statues too); the last has the horse
  const rivers = [[76.9, 15.4], [61.3, 20.5], [65.4, 36.3], [81.4, 33.5]];
  return { C, fence, herms, rivers, stairs: [-105, -15, 75, 165].map(a => a * PI / 180) };
})();
function pretoriaCentre() {   // the middle of the baked water polygons round (72, 26): the centre of the two inner collision rings
  let sx = 0, sz = 0, n = 0;
  for (const poly of (D.streets && D.streets.water) || []) {
    const o = poly[0]; let x = 0, z = 0; const m = o.length / 2;
    for (let i = 0; i < o.length; i += 2) { x += o[i]; z += o[i + 1]; }
    x /= m; z /= m;
    if (Math.hypot(x - 72, z - 26) < 30 && m > 8) { sx += x; sz += z; n++; }
  }
  return n ? [sx / n, sz / n] : [71, 25.6];
}

// flat quads gathered by colour and handed to part() once per colour: q(colour, normal-side hint, four corners)
function quadSet(key) {
  const sets = {};
  const v = (a, b, c) => [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
  return {
    q(col, hint, p0, p1, p2, p3, uv) {
      const s = sets[col + (uv ? '|uv' : '')] || (sets[col + (uv ? '|uv' : '')] = { col, P: [], N: [], U: [], uv: !!uv });
      const P = [p0, p1, p2, p3];
      for (let tri of [[0, 1, 2], [0, 2, 3]]) {
        let n = v(P[tri[0]], P[tri[1]], P[tri[2]]);
        if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { tri = [tri[0], tri[2], tri[1]]; n = n.map(k => -k); }
        const l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-8) continue;
        for (const i of tri) { s.P.push(...P[i]); s.N.push(n[0] / l, n[1] / l, n[2] / l); s.U.push(...(uv ? uv[i] : [0, 0])); }
      }
    },
    flush() {
      for (const k in sets) {
        const s = sets[k], g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(s.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(s.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(s.U, 2));
        part(key, g, s.uv ? { uv: 'keep', c: s.col, noao: true } : { c: s.col, noao: true });
      }
    },
  };
}
// The figures are some two thousand small pieces: their vertices are written straight into one list per material and colour (stamp), handed to part() once per list by flushStamps().
const STAMPS = {}, _nm = new THREE.Matrix3();
function stamp(key, g, M, c, uvo) {
  const s = STAMPS[key + c] || (STAMPS[key + c] = { key, c, P: [], N: [], U: [] });
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, m = M.elements, q = _nm.getNormalMatrix(M).elements;
  for (let i = 0, j = 0; i < P.length; i += 3, j += 2) {
    const x = P[i], y = P[i + 1], z = P[i + 2], a = N[i], b = N[i + 1], d = N[i + 2];
    s.P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    const nx = q[0] * a + q[3] * b + q[6] * d, ny = q[1] * a + q[4] * b + q[7] * d, nz = q[2] * a + q[5] * b + q[8] * d, l = Math.hypot(nx, ny, nz) || 1;
    s.N.push(nx / l, ny / l, nz / l);
    s.U.push(uvo ? U[j] * 0.35 + uvo[0] : 0.01, uvo ? U[j + 1] * 0.22 + uvo[1] : 0.01);
  }
}
function flushStamps() {
  for (const k in STAMPS) {
    const s = STAMPS[k], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(s.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(s.U, 2));
    part(s.key, g, { uv: 'keep', c: s.c, noao: true }); delete STAMPS[k];
  }
}
// a tapered bar from a to b (frame M), radii ra and rb, n sides, kz flattens it front to back: limbs, torsos, necks. cap closes the far end.
const _T = new THREE.Matrix4(), _S = new THREE.Matrix4(), _tq = new THREE.Quaternion();
function taper(key, M, a, b, ra, rb, n, c, o = {}) {
  const k = Math.round(rb / ra * 20) / 20;
  const g = geo('tp' + n + ':' + k + (o.cap ? 'c' : ''), () => { const q = new THREE.CylinderGeometry(k, 1, 1, n, 1, !o.cap); q.translate(0, 0.5, 0); return q.toNonIndexed(); });
  const A = V3(a), d = V3(b).sub(A), len = d.length(); _tq.setFromUnitVectors(UP, d.divideScalar(len));
  _T.compose(A, _tq, ONE).multiply(_S.makeScale(ra, len, ra * (o.kz || 1))).premultiply(M);
  stamp(key, g, _T, c, o.uvo);
}
// a carved lump of radius r at p (frame M): 8 triangles, or 20 with o.fine; the corners are shared in the shading, so it reads round
function blob(M, p, r, c, o = {}) {
  const g = geo(o.fine ? 'bico' : 'boct', () => { const q = o.fine ? new THREE.IcosahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 0); q.attributes.normal.array.set(q.attributes.position.array); return q; });
  _T.makeScale(r * (o.kx || 1), r * (o.ky || 1), r * (o.kz || 1)).setPosition(p[0], p[1], p[2]).premultiply(M);
  stamp(o.key || 'marble', g, _T, c);
}
// the colours of the fountain's marble; MOTTLE is where the weathered stone is in the 'pret' texture
const PM = { white: '#f3efe4', shade: '#bdb39b', drape: '#ddd5c0', stone: '#cbc3b1', dim: '#a39a87', water: '#4a765f' };
const MOTTLE = (i) => [(i * 0.37) % 1, 0.64];
// A standing figure of h metres in the frame M (feet at the origin, facing +z): two legs in contrapposto, waist, chest and shoulders, neck, head with hair, jointed arms.
const ARMS = {
  down: [[-0.19, 0.62, 0], [-0.2, 0.46, 0.04]], chest: [[-0.2, 0.62, 0.07], [-0.02, 0.69, 0.11]], raise: [[-0.25, 0.83, 0.02], [-0.15, 0.99, 0.05]],
  fore: [[-0.19, 0.61, 0.05], [-0.2, 0.62, 0.2]], hip: [[-0.27, 0.65, -0.01], [-0.11, 0.55, 0.05]], low: [[-0.17, 0.6, 0.05], [-0.03, 0.5, 0.11]], out: [[-0.28, 0.73, 0.03], [-0.4, 0.8, 0.1]],
};
function figureP(M, h, o = {}) {
  const i = o.i || 0, far = !!o.far, nl = far ? 4 : 5, key = o.key || 'pret', c = o.c || PM.white, sh = PM.shade, s = i & 1 ? -1 : 1, lx = 0.022 * s, uvo = MOTTLE(i);
  const P = (x, y, z) => [x * h, y * h, z * h];
  const T = (a, b, ra, rb, n, col, x = {}) => taper(key, M, P(...a), P(...b), ra * h, rb * h, n, col || c, { uvo, ...x });
  const L = (p, r, col, x = {}) => blob(M, P(...p), r * h, col || c, { key, ...x });
  if (o.skirt) T([0.01 * s, 0, 0], [0, 0.56, 0], 0.17, 0.1, 7, PM.drape, { kz: 0.75 });
  else {
    T([-0.062 * s, 0.27, 0.005], [-0.055 * s, 0.51, 0], 0.052, 0.078, nl); T([-0.07 * s, 0, 0], [-0.062 * s, 0.28, 0.005], 0.029, 0.053, nl);
    T([0.085 * s, 0.275, 0.075], [0.058 * s, 0.51, 0], 0.05, 0.076, nl); T([0.12 * s, 0.015, -0.01], [0.085 * s, 0.285, 0.075], 0.028, 0.05, nl);
  }
  T([0, 0.465, 0], [0, 0.565, 0], 0.115, 0.094, 6, c, { kz: 0.75 });
  T([0, 0.56, 0], [lx, 0.66, 0.006], 0.094, 0.104, 6, c, { kz: 0.7 });
  T([lx, 0.655, 0.006], [lx, 0.775, 0.012], 0.104, 0.142, 6, c, { kz: 0.64 });
  T([lx, 0.772, 0.012], [lx, 0.835, 0], 0.142, 0.045, 6, c, { kz: 0.62 });
  T([lx, 0.815, 0], [lx * 1.5, 0.875, 0.008], 0.043, 0.037, 4);
  const hx = lx * 1.5 + (i % 3 - 1) * 0.012;
  L([hx, 0.915, 0.016], 0.062, c, { fine: true, ky: 1.2 });
  L([hx, 0.935, -0.016], far ? 0.075 : 0.067, sh, { fine: !far, ky: 0.95 });
  if (o.beard) L([hx, 0.866, 0.052], 0.045, sh, { ky: 1.35 });
  for (const side of [-1, 1]) {
    const pose = ARMS[(side < 0 ? o.al : o.ar) || 'down'], el = [pose[0][0] * -side * 1.06, pose[0][1], pose[0][2]], hd = [pose[1][0] * -side * 1.06, pose[1][1], pose[1][2]], sp = [lx + side * 0.142, 0.775, 0.006];
    T(sp, el, 0.045, 0.031, 5); T(el, hd, 0.031, 0.017, 4);
  }
  // cloth: on one figure in three a mantle hanging behind, on others a band across the hips
  if (!(i % 3)) T([lx - 0.03 * s, 0.77, -0.085], [-0.05 * s, 0.14, -0.1], 0.08, 0.125, 5, sh, { kz: 0.4 });
  if (!o.skirt && i % 3) T([-0.14 * s, 0.57, 0.055], [0.12 * s, 0.465, 0.08], 0.045, 0.065, 5, PM.drape);
  if (o.pet) { T([0.19 * s, 0, 0.03], [0.16 * s, 0.17, 0.08], 0.065, 0.04, 5, PM.drape); L([0.155 * s, 0.21, 0.11], 0.048, PM.drape, { ky: 1.1 }); }
}

function buildPretoria() {
  CUR = 'Fontana Pretoria';
  const C = PRET.C;
  // one stone texture for the whole model: plain at the bottom (every part mapped from a point lands there), one niche of the pool walls in the middle, weathered marble for the figures at the top
  defMat('pret', mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ece8dc'; g.fillRect(0, 0, w, h);
    const r_ = R_(31);
    // weathered marble (v 0.6 to 1): soft grey and ochre blotches
    for (let i = 0; i < 220; i++) { g.fillStyle = ['rgba(105,98,84,.08)', 'rgba(150,120,80,.06)', 'rgba(255,255,248,.2)', 'rgba(80,76,68,.05)'][i % 4]; g.beginPath(); g.ellipse(r_() * w, r_() * 96, 3 + r_() * 8, 3 + r_() * 9, 0, 0, 7); g.fill(); }
    // the niche (v 0.1 to 0.6): pilasters at the sides, an arch moulding, the shaded recess, a cornice above
    const y0 = 104, y1 = 230;
    g.fillStyle = '#d9d1bc'; g.fillRect(0, y0 - 4, w, y1 - y0 + 4);
    g.fillStyle = '#f2eee2'; g.fillRect(0, y0 + 2, w, 10); g.fillStyle = 'rgba(70,60,45,.5)'; g.fillRect(0, y0 + 12, w, 4);
    for (const x of [0, w - 22]) { g.fillStyle = '#ece6d6'; g.fillRect(x, y0 + 16, 22, y1 - y0 - 16); g.fillStyle = 'rgba(70,60,45,.4)'; g.fillRect(x ? x : 19, y0 + 16, 3, y1 - y0 - 16); }
    const arch = (r, top, f) => { g.fillStyle = f; g.beginPath(); g.moveTo(w / 2 - r, y1 - 12); g.lineTo(w / 2 - r, top + 40); g.ellipse(w / 2, top + 40, r, 40, 0, PI, 0); g.lineTo(w / 2 + r, y1 - 12); g.fill(); };
    arch(88, y0 + 22, '#f0ebdf'); arch(76, y0 + 30, '#8b826e'); arch(62, y0 + 40, '#6a6252');
    g.fillStyle = '#e6e0d0'; g.fillRect(0, y1 - 12, w, 12); g.fillStyle = 'rgba(60,70,50,.35)'; g.fillRect(0, y1 - 3, w, 3);
    noiseDots(g, w, y1, 420, 2.2, 33, ['rgba(90,80,60,0.10)', 'rgba(255,255,250,0.14)']);
  }), [4000, 4000]);
  // the railing: bars, the band of medallions near the top, spear points, the scrolls at the foot
  defMat('pretrail', mkTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#383a41';
    for (let x = 8; x < w; x += 16) { g.fillRect(x - 1.7, 8, 3.4, h - 10); g.beginPath(); g.moveTo(x - 4.5, 14); g.lineTo(x, 0); g.lineTo(x + 4.5, 14); g.fill(); g.fillRect(x - 3, 68, 6, 8); }
    g.fillRect(0, 17, w, 3); g.fillRect(0, 35, w, 3); g.fillRect(0, h - 15, w, 3); g.fillRect(0, h - 4, w, 4);
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.arc(x, 27.5, 8, 0, 7); g.fill(); g.beginPath(); g.arc(x, h - 8, 5, 0, 7); g.lineWidth = 2.5; g.strokeStyle = '#383a41'; g.stroke(); }
    g.fillStyle = '#5c5f66'; for (let x = 0; x <= w; x += 16) { g.beginPath(); g.arc(x, 27.5, 3.5, 0, 7); g.fill(); }
  }), [1, 1], { alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, noShadow: true });
  // levels: the walk (A, at the centre), the terrace 1.5 m above it, the pool water just under the outer rim. The piazza falls to the south, and the walk with it: everything outside the central
  // basin is built level and then sheared by `lean` (height only, so the figures stay upright), as little as still covers the mapped walls inside the precinct
  const A = groundY(C[0], C[1]) + 0.26, T = A + 1.5, WY = A + 0.36; BASEY = A - 2;
  const lean = (x, z) => { const dx = x - C[0], dz = z - C[1], w = Math.min(1, Math.max(0, (Math.hypot(dx, dz) - 4.8) / 3.2)); return w * (-0.004 * dx - 0.032 * dz); };
  const Q = quadSet('pret');
  const P = (r, a, y) => [C[0] + r * Math.cos(a), y, C[1] + r * Math.sin(a)];
  const arc = (a0, a1, n, f) => { for (let k = 0; k < n; k++) f(a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n); };
  const ring = (col, r0, r1, y, a0, a1, n) => arc(a0, a1, n, (p, q) => Q.q(col, [0, 1, 0], P(r0, p, y), P(r1, p, y), P(r1, q, y), P(r0, q, y)));
  const wall = (col, r, y0, y1, a0, a1, n, out = 1) => arc(a0, a1, n, (p, q) => Q.q(col, [out * Math.cos((p + q) / 2), 0, out * Math.sin((p + q) / 2)], P(r, p, y0), P(r, q, y0), P(r, q, y1), P(r, p, y1)));
  const endCap = (col, r0, r1, y0, y1, a, dir) => Q.q(col, [-Math.sin(a) * dir, 0, Math.cos(a) * dir], P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1));
  // a curved bar of stone: top, both faces, both ends
  const curb = (col, side, r0, r1, y0, y1, a0, a1, n) => { ring(col, r0, r1, y1, a0, a1, n); wall(side, r1, y0, y1, a0, a1, n, 1); wall(side, r0, y0, y1, a0, a1, n, -1); endCap(side, r0, r1, y0, y1, a0, -1); endCap(side, r0, r1, y0, y1, a1, 1); };
  const balu = geo('balu', () => { const g = new THREE.LatheGeometry([[0.55, 0], [1, 0.3], [0.45, 1]].map(p => new THREE.Vector2(p[0], p[1])), 4).toNonIndexed(); g.computeVertexNormals(); return g; });
  const baluster = (p, h, r = 0.11) => part('pret', balu, { p, s: [r, h, r], ry: PI / 4, c: PM.white, noao: true });

  // ---- outside in: the steps, the walk, the balustrade
  const RW = 15.9, NS = 8, RUN = 0.19, RISE = 0.2, RS = RW + NS * RUN, YS = A - NS * RISE;
  for (let i = 0; i < NS; i++) {
    const r0 = RW + i * RUN, y = A - (i + 1) * RISE;
    ring('#bdb4a1', r0, r0 + RUN, y, 0, TWO, 40); wall('#8f8674', r0, y, y + RISE, 0, TWO, 40);
  }
  // the walk: bands of grey and rose marble with white joints between them
  [[7.2, 11.45, '#a8a298'], [11.45, 12.25, '#bab4ad'], [12.25, 12.6, '#e0d9ca'], [12.6, 14.35, '#ab9995'], [14.35, 14.75, '#ded7c8'], [14.75, RW, '#a29e97']].forEach(([r0, r1, col], j) => {
    for (let k = 0; k < 24; k++) { const a = PRET.stairs[0] + k * TWO / 24; ring((k + j) % 2 && r1 - r0 > 0.7 ? '#9d988f' : col, r0, r1, A + 0.004 * (j % 2), a, a + TWO / 24, 2); }
  });
  // the balustrade round the walk, open at the four entrances (the angles of each pair of herms)
  const hang = PRET.herms.map(h => Math.atan2(h[1] - C[1], h[0] - C[0]));
  const gaps = [0, 1, 2, 3].map(k => { let a = hang[2 * k], b = hang[2 * k + 1]; if (Math.abs(a - b) > PI) { if (a < b) a += TWO; else b += TWO; } return [Math.min(a, b) - 0.035, Math.max(a, b) + 0.035]; })
    .map(([a, b]) => { const m = (a + b) / 2, w = ((m % TWO) + TWO) % TWO; return [w - (b - a) / 2, w + (b - a) / 2]; }).sort((p, q) => p[0] - q[0]);
  for (let k = 0; k < 4; k++) {
    const a0 = gaps[k][1], a1 = k < 3 ? gaps[k + 1][0] : gaps[0][0] + TWO; if (a1 - a0 < 0.1) continue;
    const R = 15.7, n = Math.ceil((a1 - a0) * R / 1.8);
    curb(PM.stone, '#c4bba7', R - 0.17, R + 0.17, A, A + 0.14, a0, a1, n);
    curb(PM.white, PM.drape, R - 0.2, R + 0.2, A + 0.74, A + 0.92, a0, a1, n);
    const m = Math.max(2, Math.round((a1 - a0) * R / 0.5));
    for (let i = 0; i < m; i++) baluster(P(R, a0 + (a1 - a0) * (i + 0.5) / m, A + 0.14), 0.6);
    for (const a of [a0, a1]) { const p = P(R, a, A); box('pret', 0.46, 1.04, 0.46, { p, ry: -a, c: PM.stone, noao: true }); blob(tr(p[0], A + 1.2, p[2]), [0, 0, 0], 0.17, PM.white, { key: 'pret' }); }
  }

  // ---- the four pools and their walls
  const SW = 2.35, RO = 11.1, Rin = (phi) => 7.95 - 0.55 * Math.cos(4 * phi);   // half width of a stair; the pool's outer edge; the terrace edge, 7.4 m at the stairs and 8.5 m on the diagonals
  const dA = (r) => Math.asin(SW / r), TH0 = PRET.stairs[0];
  for (let k = 0; k < 4; k++) {
    const th = PRET.stairs[k], n = 12;
    // inner and outer edge of the pool at step u of the sector: both stop on the straight flanks of the stairs
    const inner = (u) => { let a = th + dA(7.7) + (PI / 2 - 2 * dA(7.7)) * u; const r = Rin(a - TH0); a = th + dA(r) + (PI / 2 - 2 * dA(r)) * u; return [Rin(a - TH0), a]; };
    const outer = (u) => [RO, th + dA(RO) + (PI / 2 - 2 * dA(RO)) * u];
    for (let i = 0; i < n; i++) {
      const [r0, a0] = inner(i / n), [r1, a1] = inner((i + 1) / n), [, b0] = outer(i / n), [, b1] = outer((i + 1) / n);
      Q.q(PM.water, [0, 1, 0], P(r0, a0, WY), P(RO, b0, WY), P(RO, b1, WY), P(r1, a1, WY));
      // the niche wall: six niches in the quarter, from under the water to the cornice
      const am = (a0 + a1) / 2, u0 = i / n * 6, u1 = (i + 1) / n * 6;
      Q.q('#ffffff', [Math.cos(am), 0, Math.sin(am)], P(r0, a0, A), P(r1, a1, A), P(r1, a1, T - 0.22), P(r0, a0, T - 0.22), [[u0, 0.103], [u1, 0.103], [u1, 0.597], [u0, 0.597]]);
      Q.q(PM.white, [Math.cos(am), 0, Math.sin(am)], P(r0 + 0.16, a0, T - 0.22), P(r1 + 0.16, a1, T - 0.22), P(r1 + 0.16, a1, T + 0.06), P(r0 + 0.16, a0, T + 0.06));
      Q.q(PM.dim, [0, -1, 0], P(r0, a0, T - 0.22), P(r1, a1, T - 0.22), P(r1 + 0.16, a1, T - 0.22), P(r0 + 0.16, a0, T - 0.22));
      Q.q(PM.stone, [0, 1, 0], P(r0 - 0.35, a0, T + 0.06), P(r1 - 0.35, a1, T + 0.06), P(r1 + 0.16, a1, T + 0.06), P(r0 + 0.16, a0, T + 0.06));
      // the rail over the cornice, on its small supports
      const y0 = T + 0.5, y1 = T + 0.64;
      Q.q(PM.white, [0, 1, 0], P(r0 - 0.22, a0, y1), P(r1 - 0.22, a1, y1), P(r1 + 0.02, a1, y1), P(r0 + 0.02, a0, y1));
      for (const [d, out] of [[0.02, 1], [-0.22, -1]]) Q.q(PM.drape, [out * Math.cos(am), 0, out * Math.sin(am)], P(r0 + d, a0, y0), P(r1 + d, a1, y0), P(r1 + d, a1, y1), P(r0 + d, a0, y1));
    }
    for (let i = 0; i <= 8; i++) { const [r, a] = inner(i / 8); baluster(P(r - 0.1, a, T + 0.06), 0.45, 0.12); }
    for (let j = 0; j < 6; j++) {   // an animal's head in each niche, spouting over the pool
      const [r, a] = inner((j + 0.5) / 6), M = frame(...P(r, a, A + 0.72), Math.cos(a), Math.sin(a));
      taper('pret', M, [0, 0.1, -0.05], [0, -0.04, 0.4], 0.21, 0.1, 5, PM.white, { uvo: MOTTLE(j) });
      blob(M, [0, -0.07, 0.4], 0.11, PM.drape, { key: 'pret' });
      for (const sg of [-1, 1]) blob(M, [sg * 0.15, 0.27, 0.07], 0.08, PM.drape, { key: 'pret', ky: 1.6, kx: 0.7 });
    }
    const o0 = outer(0)[1], o1 = outer(1)[1];
    curb(PM.white, PM.stone, RO - 0.08, RO + 0.7, A, A + 0.5, o0, o1, 14);
  }
  // ---- the terrace and the round basin
  for (let k = 0; k < 48; k++) {
    const a = TH0 + k * TWO / 48, b = a + TWO / 48, ra = Rin(a - TH0), rb = Rin(b - TH0);
    Q.q(k % 2 ? '#aaa294' : '#a19a8d', [0, 1, 0], P(5.5, a, T), P(ra - 0.1, a, T), P(rb - 0.1, b, T), P(5.5, b, T));
    Q.q('#c6bdac', [0, 1, 0], P(4.4, a, T + 0.003), P(5.5, a, T + 0.003), P(5.5, b, T + 0.003), P(4.4, b, T + 0.003));
  }
  lathe('pret', [[4.5, 0], [4.28, 0.14], [4.3, 0.52], [4.58, 0.66], [4.55, 0.8], [4.08, 0.8], [3.95, 0.6]], 36, { M: tr(C[0], T, C[1]), c: PM.stone, noao: true });
  ring('#73a184', 0, 4.0, T + 0.62, 0, TWO, 36);

  // ---- the four stairs, their sloping balustrades, the statues at the foot and the head of each and the little tubs
  const ZB = 11.5, ZT = 7.25, NR = 9;
  let fi = 0;
  const KIT = [['chest', 'down', 0], ['fore', 'hip', 1], ['raise', 'down', 0], ['low', 'chest', 1], ['hip', 'fore', 0], ['down', 'out', 0], ['chest', 'low', 1], ['raise', 'fore', 0]];
  const statueP = (M, h, o = {}) => { const j = fi++, k = KIT[(j * 3) % KIT.length]; figureP(M, h, { i: j, al: k[0], ar: k[1], skirt: !!k[2] && j % 2 === 0, beard: j % 5 === 2, pet: j % 3 === 1, ...o }); };
  const pedestal = (M, x, z, y0, h) => { box('pret', 0.72, h - 0.14, 0.72, { M, p: [x, y0, z], c: PM.stone, noao: true }); box('pret', 0.86, 0.14, 0.86, { M, p: [x, y0 + h - 0.14, z], c: PM.white, noao: true }); };
  const tub = (M, x, y, z, r, kz) => { part('pret', geo('tub', () => new THREE.LatheGeometry([[0.45, 0], [0.9, 0.4], [1.05, 1], [0.84, 1], [0.8, 0.82]].map(p => new THREE.Vector2(p[0], p[1])), 10)), { M, p: [x, y, z], s: [r, 0.55, r * kz], c: PM.stone, noao: true }); part('pret', geo('disc', () => { const g = new THREE.CircleGeometry(1, 10); g.rotateX(-PI / 2); return g; }), { M, p: [x, y + 0.47, z], s: [r * 0.84, 1, r * kz * 0.84], c: PM.water, noao: true }); };
  for (let k = 0; k < 4; k++) {
    const th = PRET.stairs[k], M = frame(C[0], 0, C[1], Math.cos(th), Math.sin(th)), run = (ZB - ZT) / NR;
    for (let i = 0; i < NR; i++) box('pret', 2 * SW, 0.3 + (T - A) * (NR - i) / NR, run, { M, p: [0, A - 0.3, ZT + (i + 0.5) * run], c: i % 2 ? '#bcb3a0' : '#c3baa7', noao: true });
    const flat = ZB - 0.2 - ZT, slope = Math.atan2(T - A, flat), len = Math.hypot(T - A, flat), zm = ZT + flat / 2;
    for (const sg of [-1, 1]) {
      const x = sg * (SW + 0.02), W = (xx, y, z) => new THREE.Vector3(xx, y, z).applyMatrix4(M).toArray();
      for (const out of [-1, 1]) Q.q(PM.white, [-Math.sin(th) * out * sg, 0, Math.cos(th) * out * sg].map(v => -v), W(x + out * sg * 0.17, A, ZT), W(x + out * sg * 0.17, A, ZB - 0.2), W(x + out * sg * 0.17, A + 0.3, ZB - 0.2), W(x + out * sg * 0.17, T + 0.3, ZT));
      box('pret', 0.4, 0.14, len, { M, p: [x, (T + A) / 2 + 0.2, zm], rx: slope, c: PM.stone, noao: true });
      box('pret', 0.42, 0.17, len, { M, p: [x, (T + A) / 2 + 0.92, zm], rx: slope, c: PM.white, noao: true });
      for (let i = 0; i < 8; i++) { const z = ZT + 0.4 + (ZB - ZT - 0.75) * i / 7.4; baluster(W(x, A + 0.3 + (T - A) * (ZB - 0.2 - z) / flat, z), 0.66); }
      pedestal(M, x, ZB + 0.1, A, 1.05); statueP(mul(M, tr(x, A + 1.05, ZB + 0.1)), 1.9);
      pedestal(M, x, ZT - 0.05, T, 1.05); statueP(mul(M, tr(x, T + 1.05, ZT - 0.05)), 1.8);
      tub(M, x, A, ZB + 0.95, 0.56, 0.85);
    }
  }
  // ---- the river groups: a mass of rock, the river lying against it (an arm on its urn), a standing figure on a pedestal at each side, the oval tub in front
  PRET.rivers.forEach(([x, z], k) => {
    const a = Math.atan2(z - C[1], x - C[0]), M = frame(x, A, z, Math.cos(a), Math.sin(a)), beard = k === 0 || k === 2, uvo = MOTTLE(k + 3);
    const rock = (p, r, o) => blob(M, p, r, PM.drape, { key: 'pret', fine: true, ...o });
    box('pret', 2.7, 0.45, 1.25, { M, p: [0, 0, 0.1], c: PM.stone, noao: true });
    rock([0, 0.75, -0.2], 0.66, { ky: 1.15 }); rock([-0.85, 0.62, -0.1], 0.46); rock([0.8, 0.58, -0.15], 0.42);
    const L = (p, q, ra, rb, col = PM.white, kz = 1, n = 5) => taper('pret', M, p, q, ra, rb, n, col, { kz, uvo });
    L([0.12, 0.78, 0.38], [0.82, 1.0, 0.45], 0.19, 0.12); L([0.82, 1.0, 0.45], [1.38, 0.56, 0.52], 0.12, 0.07);
    L([0.1, 0.7, 0.52], [0.75, 0.68, 0.66], 0.17, 0.11); L([0.75, 0.68, 0.66], [1.46, 0.52, 0.62], 0.11, 0.06);
    L([0.28, 0.72, 0.42], [-0.12, 0.98, 0.34], 0.2, 0.16, PM.white, 0.75, 6); L([-0.1, 0.95, 0.34], [-0.34, 1.38, 0.32], 0.17, 0.25, PM.white, 0.65, 6); L([-0.34, 1.37, 0.32], [-0.39, 1.51, 0.32], 0.25, 0.07, PM.white, 0.65, 6);
    L([-0.39, 1.47, 0.32], [-0.44, 1.64, 0.34], 0.07, 0.065, PM.white, 1, 4);
    blob(M, [-0.45, 1.74, 0.36], 0.14, PM.white, { key: 'pret', fine: true, ky: 1.2 }); blob(M, [-0.46, 1.8, 0.28], 0.15, PM.shade, { key: 'pret', fine: true });
    if (beard) blob(M, [-0.44, 1.64, 0.46], 0.11, PM.shade, { key: 'pret', ky: 1.4 });
    L([-0.58, 1.36, 0.34], [-0.92, 1.0, 0.45], 0.09, 0.065, PM.white, 1, 4); L([-0.92, 1.0, 0.45], [-0.66, 0.88, 0.62], 0.065, 0.045, PM.white, 1, 4);
    L([-0.1, 1.34, 0.38], [0.22, 1.12, 0.5], 0.09, 0.065, PM.white, 1, 4); L([0.22, 1.12, 0.5], [0.58, 1.08, 0.55], 0.065, 0.045, PM.white, 1, 4);
    L([-0.2, 0.9, 0.48], [0.62, 0.84, 0.58], 0.17, 0.1, PM.shade, 0.7);
    L([-1.42, 0.55, 0.4], [-1.08, 0.67, 0.49], 0.1, 0.25, PM.stone, 1, 8); L([-1.08, 0.67, 0.49], [-0.82, 0.76, 0.55], 0.25, 0.09, PM.stone, 1, 8); L([-0.82, 0.76, 0.55], [-0.68, 0.81, 0.58], 0.09, 0.13, PM.dim, 1, 8);
    if (k === 3) {   // the horse beside the south-east river
      L([0.95, 0.65, -0.05], [1.02, 1.6, 0.18], 0.32, 0.17, PM.white, 0.7, 6); L([1.02, 1.6, 0.18], [1.46, 1.38, 0.5], 0.17, 0.08, PM.white, 0.8);
      blob(M, [1.46, 1.37, 0.51], 0.09, PM.drape, { key: 'pret' }); blob(M, [0.82, 1.45, -0.02], 0.2, PM.shade, { key: 'pret', ky: 1.7, kx: 0.6 });
      for (const sg of [-1, 1]) blob(M, [1.0 + sg * 0.1, 1.83, 0.18], 0.07, PM.white, { key: 'pret', ky: 1.8 });
    }
    for (const sg of [-1, 1]) { pedestal(M, sg * 1.98, -0.45, 0, 0.9); statueP(mul(M, tr(sg * 1.98, 0.9, -0.45)), 1.9, { pet: false }); }
    tub(M, 0, 0, 1.55, 1.15, 0.66);
  });
  // ---- the herms of the entrances: a tapering shaft with scrolls at its sides and a mask, the half figure on it with crossed arms
  const herms = () => PRET.herms.forEach(([x, z], k) => {
    const gy = groundY(x, z), a = Math.atan2(z - C[1], x - C[0]), M = frame(x, gy, z, Math.cos(a), Math.sin(a)), t = Math.max(2.0, A + lean(x, z) + 0.45 - gy), uvo = MOTTLE(k);
    box('pret', 1.3, 0.65, 1.05, { M, p: [0, -0.25, 0], c: PM.stone, noao: true });
    box('pret', 0.94, t - 0.4, 0.8, { M, p: [0, 0.4, 0], c: PM.drape, noao: true });
    box('pret', 1.1, 0.14, 0.92, { M, p: [0, t - 0.12, 0], c: PM.white, noao: true });
    blob(M, [0, t - 0.52, 0.4], 0.2, PM.white, { key: 'pret', fine: true, ky: 1.2, kz: 0.55 }); blob(M, [0, t - 0.74, 0.4], 0.13, PM.shade, { key: 'pret', ky: 1.5, kz: 0.6 });
    for (const sg of [-1, 1]) { part('pret', geo('scroll', () => new THREE.CylinderGeometry(1, 1, 1, 9)), { M, p: [sg * 0.55, 0.74, 0], rx: PI / 2, s: [0.33, 0.55, 0.33], c: PM.white, noao: true }); blob(M, [sg * 0.55, 0.74, 0.3], 0.1, PM.shade, { key: 'pret', kz: 0.5 }); }
    const L = (p, q, ra, rb, col = PM.white, kz = 1, n = 5) => taper('pret', M, p, q, ra, rb, n, col, { kz, uvo });
    L([0, t, 0], [0, t + 0.62, 0.02], 0.35, 0.45, k % 2 ? PM.drape : PM.white, 0.66, 7); L([0, t + 0.61, 0.02], [0, t + 0.86, 0], 0.45, 0.2, PM.white, 0.6, 7);
    L([0, t + 0.82, 0], [0, t + 0.98, 0.02], 0.12, 0.11, PM.white, 1, 4);
    blob(M, [0, t + 1.13, 0.05], 0.2, PM.white, { key: 'pret', fine: true, ky: 1.2 }); blob(M, [0, t + 1.2, -0.05], 0.21, PM.shade, { key: 'pret', fine: true, ky: k % 2 ? 1.05 : 0.9 });
    if (!(k % 2)) blob(M, [0, t + 0.98, 0.18], 0.13, PM.shade, { key: 'pret', ky: 1.5 });
    for (const sg of [-1, 1]) { L([sg * 0.45, t + 0.7, 0], [sg * 0.46, t + 0.3, 0.17], 0.13, 0.1, PM.white, 1, 4); L([sg * 0.46, t + 0.3, 0.17], [-sg * 0.12, t + 0.42 + sg * 0.07, 0.33], 0.1, 0.06, PM.drape, 1, 4); }
  });
  // ---- the stem in the middle of the basin: three bowls, each carried by figures, horses' heads between, and on top the small figure with the horn
  {
    const O = tr(C[0], 0, C[1]), B1 = T + 2.05, B2 = B1 + 3.0, B3 = B2 + 1.55;
    const bowl = (y, r, d) => lathe('pret', [[0.28, -d], [r * 0.55, -d * 0.86], [r * 0.66, -d * 0.62], [r * 0.95, -d * 0.3], [r, -0.02], [r * 0.97, 0.05], [r * 0.8, -0.04], [0.2, -d * 0.22]].map(q => [q[0], q[1]]), 20, { M: mul(O, tr(0, y, 0)), c: '#dcd8c2', noao: true, uv: 'keep', uvk: [3, 0.3], uvo: [0, 0.65] });
    const stem = (y0, y1, ra, rb) => taper('pret', O, [0, y0, 0], [0, y1, 0], ra, rb, 8, PM.shade, { uvo: MOTTLE(2) });
    const around = (n, r, y, f, off = 0) => { for (let i = 0; i < n; i++) { const a = off + i * TWO / n; f(frame(C[0] + r * Math.cos(a), y, C[1] + r * Math.sin(a), Math.cos(a), Math.sin(a)), i); } };
    stem(T, T + 1.0, 1.15, 0.7);
    around(3, 0.62, T + 0.72, (M, i) => figureP(M, 1.15, { i, far: true, al: 'raise', ar: 'raise', c: PM.drape }), TH0 + 0.5);
    stem(T + 0.9, B1 - 0.2, 0.5, 0.4);
    bowl(B1, 1.62, 0.62);
    around(4, 1.62, B1 - 0.02, (M) => blob(M, [0, 0, 0], 0.17, PM.stone, { key: 'pret', kx: 1.6, ky: 0.7 }), TH0 + PI / 4);
    stem(B1 - 0.15, B1 + 0.85, 0.42, 0.26);
    around(4, 0.3, B1 + 0.55, (M, i) => { taper('pret', M, [0, -0.35, -0.05], [0, 0.18, 0.14], 0.19, 0.13, 5, PM.drape, { uvo: MOTTLE(i) }); taper('pret', M, [0, 0.18, 0.14], [0, -0.05, 0.5], 0.13, 0.065, 5, PM.white, { uvo: MOTTLE(i + 1) }); }, TH0);
    lathe('pret', [[0.2, 0], [0.74, 0.04], [0.78, 0.14], [0.2, 0.18]], 14, { M: mul(O, tr(0, B1 + 0.8, 0)), c: PM.shade, noao: true });
    stem(B1 + 0.9, B2 - 0.5, 0.26, 0.2);
    around(3, 0.42, B1 + 0.98, (M, i) => figureP(M, 1.4, { far: true, i: i + 4, al: i === 1 ? 'chest' : 'raise', ar: i === 2 ? 'hip' : 'raise' }), TH0);
    around(5, 0.4, B2 - 0.62, (M) => blob(M, [0, 0, 0], 0.22, PM.drape, { key: 'pret', fine: true }), TH0 + 0.3);
    bowl(B2, 1.12, 0.5);
    stem(B2 - 0.1, B3 - 0.3, 0.2, 0.13);
    around(3, 0.22, B2 + 0.04, (M, i) => figureP(M, 1.1, { far: true, i: i + 1, al: 'raise', ar: 'chest', c: PM.drape }), TH0 + 1.0);
    bowl(B3, 0.78, 0.36);
    stem(B3 - 0.1, B3 + 0.1, 0.24, 0.2);
    const M = frame(C[0], B3 + 0.08, C[1], 0.97, -0.25);
    figureP(M, 1.3, { i: 8, al: 'chest', ar: 'low' });
    taper('pret', M, [-0.04, 0.34, 0.14], [-0.27, 1.0, 0.18], 0.05, 0.15, 6, PM.drape, { cap: true }); for (const [dx, dy] of [[-0.3, 1.06], [-0.19, 1.08], [-0.34, 0.96]]) blob(M, [dx, dy, 0.18], 0.08, PM.white, { key: 'pret' });
  }
  Q.flush(); flushStamps();
  for (const g of BINS.pret) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) p[i + 1] += lean(p[i], p[i + 2]); }
  // what stands on the real ground is built after the shear: the footing under the lowest step, and the herms
  for (let i = 0; i < 40; i++) {
    const [p, q] = [i, i + 1].map(k => [C[0] + RS * Math.cos(k * TWO / 40), C[1] + RS * Math.sin(k * TWO / 40)]), top = YS + Math.max(lean(p[0], p[1]), lean(q[0], q[1])) + 0.02, low = Math.min(groundY(p[0], p[1]), groundY(q[0], q[1])) - 0.3;
    if (low < top) wallQuad('pret', q, p, low, top, [0, 0, 0, 0], '#a39a87', { noao: true });
  }
  herms(); flushStamps();

  // ---- the iron railing on the precinct, its posts (a small figure on every other one), and a lamp beside each pair of herms
  {
    const F = PRET.fence, iron = '#303238'; let post = 0;
    for (let i = 0; i < F.length; i++) {
      const p = F[i], q = F[(i + 1) % F.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 2.6));
      for (let k = 0; k < n; k++) {
        const a = [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n], b = [p[0] + (q[0] - p[0]) * (k + 1) / n, p[1] + (q[1] - p[1]) * (k + 1) / n];
        const ya = groundY(a[0], a[1]), yb = groundY(b[0], b[1]);
        // a panel that follows the ground: its foot on the two posts
        wallQuad('pretrail', a, b, 0, 1, [0, 0, L / n / 1.28, 1], '#ffffff', { noao: true });
        const g = BINS.pretrail[BINS.pretrail.length - 1].attributes.position;
        for (let v = 0; v < g.count; v++) { const top = g.getY(v) > 0.5, atA = Math.hypot(g.getX(v) - a[0], g.getZ(v) - a[1]) < 0.01; g.setY(v, (atA ? ya : yb) + (top ? 1.72 : 0.02)); }
        box('dark', 0.13, 1.92, 0.13, { p: [a[0], ya - 0.05, a[1]], c: iron, noao: true });
        if (!(post++ % 2)) { blob(tr(a[0], ya + 2.0, a[1]), [0, 0, 0], 0.12, iron, { key: 'dark' }); blob(tr(a[0], ya + 2.17, a[1]), [0, 0, 0], 0.075, iron, { key: 'dark' }); }
      }
    }
    for (const [x, z] of [F[1], F[7], F[11], F[19]]) {
      const y = groundY(x, z);
      cyl('dark', 0.07, 0.17, 3.3, 6, { p: [x, y, z], c: iron, noao: true });
      cyl('pret', 0.26, 0.17, 0.44, 6, { p: [x, y + 3.3, z], c: '#d9cfa6', noao: true, uv: 'world' });
      cyl('dark', 0.03, 0.33, 0.24, 6, { p: [x, y + 3.74, z], c: iron, noao: true });
    }
  }
  flushStamps();   // the finials of the posts
  (KEEPOUT.circles || (KEEPOUT.circles = [])).push({ name: 'Fontana Pretoria', x: C[0], z: C[1], r: 19 });
}

// ---- Palazzo delle Aquile ----
// bays of the piazza front as fractions of its length, left to right: the end bays stand apart, the arms in the wider gaps
const AQ_BAYS = [0.075, 0.215, 0.318, 0.409, 0.5, 0.591, 0.682, 0.785, 0.925];
// heights as fractions of the wall: ground windows, mezzanine, the white band, the tall windows of the first floor, the small ones at the top
const AQ = { low: [0.095, 0.205], mez: [0.295, 0.375], band: [0.425, 0.485], noble: [0.495, 0.665], top: [0.765, 0.865], clock: [0.718, 0.865] };
// The wall painted: Wm x Hm metres, a window column at each of `bays` (fractions); front adds the centre bay's portal field, the clock, the arms and the plaques.
function paintAquile(g, w, h, Wm, Hm, bays, front) {
  const sx = w / Wm, sy = h / Hm, r_ = R_(front ? 77 : 78);
  const X = (s) => s * sx, Y = (f) => h - f * h;
  const rect = (s0, f0, s1, f1, c) => { g.fillStyle = c; g.fillRect(X(s0), Y(f1), (s1 - s0) * sx, (f1 - f0) * h); };
  // rusticated golden stone: big blocks with a lit upper edge and a shaded lower one
  g.fillStyle = '#c0a475'; g.fillRect(0, 0, w, h);
  const course = 0.64, tint = new THREE.Color(), base = new THREE.Color('#d6bd8e');
  for (let j = 0; j * course < Hm; j++) {
    const yb = h - (j + 1) * course * sy, hh = course * sy;
    let x = front ? -r_() * 1.4 : (j % 2 ? -0.7 : 0);
    while (x < Wm) {
      const bw = front ? 1.15 + r_() * 0.5 : 1.5, k = 1 + (r_() - 0.5) * 0.12; tint.copy(base).multiplyScalar(k);
      const px = X(x) + 1.5, pw = bw * sx - 3;
      g.fillStyle = '#' + tint.getHexString(); g.fillRect(px, yb + 1.5, pw, hh - 3);
      g.fillStyle = 'rgba(255,236,190,.45)'; g.fillRect(px, yb + 1.5, pw, 3);
      g.fillStyle = 'rgba(95,66,30,.4)'; g.fillRect(px, yb + hh - 4.5, pw, 3);
      x += bw;
    }
  }
  noiseDots(g, w, h, w * h / 260, 2, front ? 79 : 80, ['rgba(110,80,45,0.13)', 'rgba(255,240,205,0.12)']);
  streaks(g, w, h, Math.round(Wm * 3), 81, 0.11, 170);
  // the base course, the white band under the first floor, the moulding under the eaves
  rect(0, 0, Wm, 0.04, '#b4a894'); rect(0, 0.04, Wm, 0.047, 'rgba(60,45,30,.5)');
  rect(0, AQ.band[0], Wm, AQ.band[1], '#e2dccd'); rect(0, AQ.band[0] - 0.006, Wm, AQ.band[0], 'rgba(60,42,22,.5)'); rect(0, AQ.band[0] + 0.022, Wm, AQ.band[0] + 0.027, 'rgba(110,95,70,.35)');
  rect(0, 0.93, Wm, 1, '#d2b585'); rect(0, 0.93, Wm, 0.937, 'rgba(60,42,22,.45)');
  const glass = (s0, f0, s1, f1, bars) => {
    rect(s0, f0, s1, f1, '#4b2a1e');
    const m = (s0 + s1) / 2, i = 0.09;
    for (const [a, b] of [[s0 + i, m - i / 2], [m + i / 2, s1 - i]]) for (let k = 0; k < bars; k++) { const fa = f0 + (f1 - f0) * k / bars + 0.003, fb = f0 + (f1 - f0) * (k + 1) / bars - 0.003; const gr = g.createLinearGradient(0, Y(fb), 0, Y(fa)); gr.addColorStop(0, '#46505a'); gr.addColorStop(1, '#1e1d1f'); rect(a, fa, b, fb, gr); }
  };
  const small = (s, [f0, f1], ww) => { rect(s - ww / 2 - 0.24, f0 - 0.012, s + ww / 2 + 0.24, f1 + 0.012, '#b58f58'); rect(s - ww / 2 - 0.14, f0 - 0.006, s + ww / 2 + 0.14, f1 + 0.006, '#e0bf86'); glass(s - ww / 2, f0, s + ww / 2, f1, 2); rect(s - ww / 2, f1 - 0.012, s + ww / 2, f1, 'rgba(10,6,4,.5)'); };
  const noble = (s, f1) => { const [f0] = AQ.noble; rect(s - 1.72, f0 - 0.01, s + 1.72, f1 + 0.04, '#e6e1d3'); rect(s - 1.72, f1 + 0.026, s + 1.72, f1 + 0.031, 'rgba(90,75,55,.6)'); rect(s - 1.3, f0 - 0.01, s + 1.3, f1 + 0.014, 'rgba(120,105,80,.45)'); rect(s - 1.2, f0 - 0.01, s + 1.2, f1 + 0.008, '#efebdf'); glass(s - 1.02, f0, s + 1.02, f1, 3); rect(s - 1.02, f1 - 0.012, s + 1.02, f1, 'rgba(10,6,4,.5)'); };
  const plaque = (s0, f0, s1, f1, seed) => { rect(s0 - 0.1, f0 - 0.006, s1 + 0.1, f1 + 0.006, '#b9ad95'); rect(s0, f0, s1, f1, '#e4dfd2'); const q = R_(seed); for (let f = f1 - 0.014; f > f0 + 0.008; f -= 0.0125) { let s = s0 + 0.2 + q() * 0.2; while (s < s1 - 0.25) { const ww = 0.07 + q() * 0.22; rect(s, f, Math.min(s1 - 0.2, s + ww), f + 0.0045, 'rgba(80,70,55,.55)'); s += ww + 0.07; } } };
  bays.forEach((b, i) => {
    const s = b * Wm, mid = front && i === 4;
    if (!mid) { small(s, AQ.low, 1.55); small(s, AQ.mez, 1.55); small(s, AQ.top, 1.4); }
    noble(s, mid ? AQ.noble[1] - 0.008 : AQ.noble[1]);
  });
  if (!front) return;
  const L = Wm, m = L / 2;
  // the white stone of the portal field behind the carved members
  rect(m - 3.3, 0, m + 3.3, AQ.band[0], '#d8d2c2'); rect(m - 2.75, 0.31, m + 2.75, 0.42, '#e6e1d4');
  // plaques of the ground floor and the mezzanine
  for (const [a, b, f0, f1, q] of [[0.122, 0.172, 0.1, 0.235, 5], [0.248, 0.285, 0.115, 0.17, 6], [0.35, 0.385, 0.1, 0.235, 7], [0.842, 0.882, 0.11, 0.235, 8], [0.716, 0.752, 0.115, 0.175, 9], [0.248, 0.29, 0.31, 0.352, 10], [0.835, 0.872, 0.505, 0.585, 11]]) plaque(a * L, f0, b * L, f1, q);
  // the arms beside the end bays: a white cartouche, a shield on it, a crown over it
  for (const b of [0.147, 0.853]) {
    const x = X(b * L), y = Y(0.652), P = (u, v) => [x + u * sx, y - v * sy];
    const path = (pts, f) => { g.fillStyle = f; g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](...P(...q))); g.closePath(); g.fill(); };
    path([[-0.5, 0.75], [0.5, 0.75], [0.68, 0.35], [0.55, -0.35], [0, -0.95], [-0.55, -0.35], [-0.68, 0.35]], '#e8e3d5');
    path([[-0.36, 0.52], [0.36, 0.52], [0.34, -0.15], [0, -0.6], [-0.34, -0.15]], '#bfb5a0'); path([[-0.27, 0.42], [0.27, 0.42], [0.25, -0.1], [0, -0.45], [-0.25, -0.1]], '#d8d1bf');
    path([[-0.45, 0.82], [-0.48, 1.35], [-0.22, 1.08], [0, 1.45], [0.22, 1.08], [0.48, 1.35], [0.45, 0.82]], '#e4dece');
  }
  // the clock: a white slab, the dark face with its hours and hands, an animal carved at each side, the motto below
  {
    const [f0, f1] = AQ.clock, cx = X(m), cy = Y(f0 + (f1 - f0) * 0.6), R = (f1 - f0) * 0.34 * Hm;
    rect(m - 2.15, f0, m + 2.15, f1, '#e9e4d7'); g.strokeStyle = 'rgba(100,85,60,.6)'; g.lineWidth = 3; g.strokeRect(X(m - 2.05), Y(f1) + 4, 4.1 * sx, (f1 - f0) * h - 8);
    g.fillStyle = '#cfc5ae'; g.beginPath(); g.ellipse(cx, cy, (R + 0.16) * sx, (R + 0.16) * sy, 0, 0, 7); g.fill();
    g.fillStyle = '#25272c'; g.beginPath(); g.ellipse(cx, cy, R * sx, R * sy, 0, 0, 7); g.fill();
    g.strokeStyle = '#d8d4c4'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.7 * sx, cy + Math.sin(a) * R * 0.7 * sy); g.lineTo(cx + Math.cos(a) * R * 0.9 * sx, cy + Math.sin(a) * R * 0.9 * sy); g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(cx - R * 0.45 * sx, cy - R * 0.25 * sy); g.lineTo(cx, cy); g.lineTo(cx + R * 0.12 * sx, cy - R * 0.75 * sy); g.stroke();
    g.strokeStyle = 'rgba(105,90,65,.7)'; g.lineWidth = 4;
    for (const sg of [-1, 1]) { const x = cx + sg * 1.5 * sx; g.beginPath(); g.moveTo(x + sg * 14, cy + 22); g.quadraticCurveTo(x - sg * 4, cy + 14, x, cy - 4); g.quadraticCurveTo(x + sg * 2, cy - 20, x - sg * 10, cy - 18); g.moveTo(x, cy + 4); g.quadraticCurveTo(x + sg * 18, cy - 8, x + sg * 14, cy - 26); g.stroke(); }
    g.fillStyle = '#3c3428'; g.font = 'bold ' + Math.round(0.34 * sy) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(cx, Y(f0 + 0.018)); const t = 'PEREVNT ET IMPVTANTVR', tw = g.measureText(t).width; g.scale(3.8 * sx / tw, 1); g.fillText(t, 0, 0); g.restore();
  }
}

function buildAquile(ctx) {
  CUR = 'Palazzo delle Aquile';
  const b = byId('w28002543'); if (!b) return;
  const pts = pairsOf(b.p), gy = minGround(pts); BASEY = gy;
  const H = Math.min(26, relH(b, 24)), y0 = gy - 0.6, y1 = gy + H;
  // the piazza front: the edges facing north lie on one line; its ends as seen from the piazza (left is east)
  const north = pts.map((_, i) => i).filter(i => edgeLR(pts, i).nz < -0.5), ends = north.flatMap(i => { const e = edgeLR(pts, i); return [e.L, e.R]; });
  if (!ends.length) return;
  const L = ends.reduce((a, p) => p[0] > a[0] ? p : a), R = ends.reduce((a, p) => p[0] < a[0] ? p : a), len = Math.hypot(R[0] - L[0], R[1] - L[1]);
  const mx = (L[0] + R[0]) / 2, mz = (L[1] + R[1]) / 2, nx = -(R[1] - L[1]) / len, nz = (R[0] - L[0]) / len;
  const yF = Math.min(groundY(L[0], L[1]), groundY(mx, mz), groundY(R[0], R[1])), Hf = y1 - yF, Y = (f) => f * Hf;
  const F = (s, y, z) => mul(frame(mx, yF, mz, nx, nz), tr(s, y, z));   // s to the right as seen from the piazza, y above the foot of the front, z out of the wall
  defMat('aqfront', mkTex(2048, 1024, (g, w, h) => paintAquile(g, w, h, len, Hf, AQ_BAYS, true)), [len, Hf]);
  defMat('aqside', mkTex(512, 1024, (g, w, h) => paintAquile(g, w, h, 6, Hf, [0.5], false)), [6, Hf]);
  const white = '#e4dfd1', white2 = '#cfc8b7', iron = '#26262b';
  const balu = geo('balu', () => { const g = new THREE.LatheGeometry([[0.55, 0], [1, 0.3], [0.45, 1]].map(p => new THREE.Vector2(p[0], p[1])), 4).toNonIndexed(); g.computeVertexNormals(); return g; });
  const post4 = geo('post4', () => { const g = new THREE.CylinderGeometry(0.6, 1, 1, 4, 1, true); g.translate(0, 0.5, 0); return g; });
  // a balcony of w metres at the first floor in the frame M (x along the wall, z out): slab on its brackets, balusters, rail
  const balcony = (M, w, fine) => {
    const y = Y(AQ.band[1]) - 0.3, d = 0.72;
    box('marble', w, 0.24, d, { M, p: [0, y, d / 2], c: white, noao: true });
    const nb = w > 4 ? 5 : 2;
    for (let i = 0; i < nb; i++) box('marble', 0.2, 0.42, d * 0.7, { M, p: [(i / (nb - 1) - 0.5) * (w - 0.5), y - 0.42, d * 0.35], c: white2, noao: true });
    box('marble', w, 0.13, 0.2, { M, p: [0, y + 0.92, d - 0.12], c: white, noao: true });
    for (const sg of [-1, 1]) { box('marble', 0.2, 0.74, 0.2, { M, p: [sg * (w / 2 - 0.1), y + 0.22, d - 0.12], c: white, noao: true }); box('marble', 0.14, 0.13, d - 0.2, { M, p: [sg * (w / 2 - 0.1), y + 0.92, (d - 0.2) / 2], c: white2, noao: true }); }
    const n = Math.max(4, Math.round(w / (fine ? 0.38 : 0.5)));
    for (let i = 1; i < n; i++) part('marble', fine ? balu : post4, { M, p: [(i / n - 0.5) * w, y + 0.23, d - 0.12], s: [0.09, 0.7, 0.09], c: white, noao: true });
  };
  const lintel = (M) => { box('marble', 3.75, 0.24, 0.42, { M, p: [0, Y(AQ.noble[1] + 0.033), 0.18], c: white, noao: true }); box('marble', 3.5, 0.14, 0.24, { M, p: [0, Y(AQ.noble[1] + 0.033) - 0.14, 0.1], c: white2, noao: true }); };
  // walls, eaves, parapet
  for (let i = 0; i < pts.length; i++) {
    const e = edgeLR(pts, i), front = north.includes(i);
    const m = [(e.L[0] + e.R[0]) / 2, (e.L[1] + e.R[1]) / 2], ry = Math.atan2(-(e.R[1] - e.L[1]), e.R[0] - e.L[0]);
    if (!front) {
      const n = Math.max(1, Math.round(e.len / 6));
      wallQuad('aqside', e.L, e.R, y0, y1, [0, (y0 - yF) / Hf, n, 1], '#f6efe2');
      if (e.nz < 0.5) for (let k = 0; k < n; k++) { const s = ((k + 0.5) / n - 0.5) * e.len, M = mul(frame(m[0], yF, m[1], e.nx, e.nz), tr(s, 0, 0)), ww = Math.min(3.3, e.len / n - 0.3); balcony(M, ww, false); lintel(M); }
    }
    for (const [out, d, h, y, c] of [[0.4, 0.9, 0.42, y1 - 0.42, '#fff0cc'], [0.16, 0.5, 0.45, y1 - 0.87, '#ecd4a4'], [-0.1, 0.4, 0.85, y1, '#f4dfb4']]) box('ashlar', e.len + 2 * Math.max(0, out) + 0.1, h, d, { p: [m[0] + e.nx * out, y, m[1] + e.nz * out], ry, c, noao: true });
  }
  wallQuad('aqfront', L, R, y0, y1, [0, (y0 - yF) / Hf, 1, 1], '#ffffff');
  roofPoly('flat', pts, y1 + 0.05, '#8d8a80', { noao: true });
  ctx.skip.add(b.id);
  // ---- the front
  AQ_BAYS.forEach((f, i) => { const s = (f - 0.5) * len, M = F(s, 0, 0); balcony(M, i === 4 ? 6.2 : 3.4, true); if (i !== 4) lintel(M); });
  // the portal: pilasters and door frame, the frieze of shields, the cornice on its blocks, the slab with the eagle in relief
  for (const sg of [-1, 1]) { box('marble', 0.75, Y(0.245), 0.42, { M: F(sg * 2.2, 0, 0.21), c: white2, noao: true }); box('marble', 0.95, 0.9, 0.55, { M: F(sg * 2.2, 0, 0.27), c: '#bdb6a6', noao: true }); box('marble', 0.35, Y(0.225), 0.2, { M: F(sg * 1.55, 0, 0.1), c: white, noao: true }); }
  box('dark', 2.75, Y(0.22), 0.08, { M: F(0, 0, 0.04), c: '#2a2019', noao: true });
  box('marble', 3.45, Y(0.025), 0.26, { M: F(0, Y(0.22), 0.13), c: white, noao: true });
  box('marble', 5.35, Y(0.047), 0.36, { M: F(0, Y(0.245), 0.18), c: white2, noao: true });
  for (let i = 0; i < 6; i++) part('marble', geo('shield', () => new THREE.CylinderGeometry(1, 1, 1, 6)), { M: F(-2.1 + i * 0.84, Y(0.2685), 0.38), rx: PI / 2, s: [0.26, 0.07, 0.34], c: white, noao: true });
  for (let i = 0; i < 9; i++) box('marble', 0.3, 0.2, 0.62, { M: F(-2.6 + i * 0.65, Y(0.292), 0.31), c: white2, noao: true });
  box('marble', 6.4, 0.28, 0.85, { M: F(0, Y(0.292) + 0.2, 0.42), c: white, noao: true });
  box('marble', 5.1, Y(0.083), 0.1, { M: F(0, Y(0.323), 0.05), c: white2, noao: true });
  for (const sg of [-1, 1]) box('marble', 0.18, Y(0.083), 0.24, { M: F(sg * 2.6, Y(0.323), 0.12), c: white, noao: true });
  {
    const cy = Y(0.362), E = F(0, cy, 0.14);
    for (const sg of [-1, 1]) {
      const w = new THREE.Shape(); [[0.15, 0.05], [0.7, 0.62], [1.35, 0.55], [2.3, -0.15], [1.7, -0.12], [1.8, -0.36], [1.1, -0.3], [0.9, -0.5], [0.2, -0.38]].forEach((q, i) => w[i ? 'lineTo' : 'moveTo'](sg * q[0], q[1] * Hf / 23));
      part('marble', new THREE.ShapeGeometry(w), { M: E, c: '#f1ede2', noao: true });
    }
    blob(E, [0, -0.1, 0.05], 0.34, white, { fine: true, ky: 1.7, kz: 0.45 }); blob(E, [-0.08, 0.55, 0.08], 0.17, white, { fine: true, kz: 0.6 });
    for (const sg of [-1, 1]) box('marble', 1.5, 0.1, 0.07, { M: E, p: [sg * 0.9, -0.66 * Hf / 23, 0.02], rz: sg * 0.07, c: white, noao: true });
  }
  // the bell left of the portal
  box('dark', 0.1, 0.1, 0.75, { M: F(-3.75, Y(0.405), 0.37), c: iron, noao: true });
  cyl('dark', 0.15, 0.37, 0.62, 8, { M: F(-3.75, Y(0.405) - 0.72, 0.7), c: '#5b5442', noao: true });
  // the flags on their poles: Europe, Italy, Sicily, the city
  [['#1f3e8f'], ['#22804a', '#f0ede4', '#c02f2c'], ['#c8332a', '#e2b232'], ['#d8a52c', '#b7262a']].forEach((cols, k) => {
    const s = -2.4 + k * 1.5, a = [s, Y(AQ.band[1]) + 0.55, 0.65], t = [s - 0.25, Y(0.652), 2.05], Q = quadSet('flat');
    taper('dark', F(0, 0, 0), a, t, 0.04, 0.03, 4, '#6e6558');
    const W = (u, v) => new THREE.Vector3(t[0] + u * 0.95 + v * 0.12, t[1] - u * 0.35 - v * 1.35, t[2] - v * 0.35).applyMatrix4(F(0, 0, 0)).toArray();
    const cloth = (col, p0, p1, p2, p3) => { for (const side of [-1, 1]) Q.q(col, [side * nx, 0, side * nz], W(...p0), W(...p1), W(...p2), W(...p3)); };
    if (k === 2) { cloth(cols[0], [0, 0], [1, 0], [0, 1], [0, 1]); cloth(cols[1], [1, 0], [1, 1], [0, 1], [0, 1]); }
    else cols.forEach((col, j) => cloth(col, [j / cols.length, 0], [(j + 1) / cols.length, 0], [(j + 1) / cols.length, 1], [j / cols.length, 1]));
    if (!k) { const c = W(0.5, 0.5); blob(tr(c[0] + nx * 0.03, c[1], c[2] + nz * 0.03), [0, 0, 0], 0.17, '#d9b53a', { key: 'flat', kz: 0.15 }); }
    Q.flush();
  });
  // the aedicule over the middle: a pedestal, two small columns, the arch and cornice, the Virgin inside, a lamp at each side
  {
    const t = Hf + 0.85;
    box('marble', 3.9, 0.6, 0.9, { M: F(0, Hf - 0.05, 0.02), c: white2, noao: true });
    box('marble', 2.9, 0.8, 0.8, { M: F(0, t - 0.3, 0), c: white, noao: true });
    box('marble', 2.2, 2.5, 0.18, { M: F(0, t + 0.5, -0.25), c: '#b3ac9c', noao: true });
    for (const sg of [-1, 1]) { cyl('marble', 0.17, 0.2, 2.2, 8, { M: F(sg * 0.98, t + 0.5, 0.2), c: white, noao: true }); box('marble', 0.5, 0.3, 0.75, { M: F(sg * 0.98, t + 2.7, 0), c: white2, noao: true }); box('dark', 0.08, 1.35, 0.08, { M: F(sg * 1.38, t + 0.45, 0.3), c: iron, noao: true }); blob(F(sg * 1.38, t + 1.9, 0.3), [0, 0, 0], 0.15, '#e8dfb6'); }
    part('marble', shapeGeo(archShape(2.5, 1.55), 0.75, archPath(1.55, 1.1)), { M: F(0, t + 2.78, -0.4), c: white, noao: true });
    box('marble', 0.14, 0.5, 0.14, { M: F(0, t + 4.3, 0), c: white2, noao: true }); blob(F(0, t + 4.9, 0), [0, 0, 0], 0.16, white);
    figureP(F(0, t + 0.5, 0.05), 2.2, { key: 'marble', i: 0, skirt: true, al: 'chest', ar: 'chest', c: '#eeeadf' });
  }
  // an eagle at each end of the front
  for (const sg of [-1, 1]) {
    const M = F(sg * (len / 2 - 0.8), Hf + 0.85, 0);
    box('marble', 1.1, 0.5, 0.7, { M, c: white2, noao: true });
    taper('marble', M, [0, 0.5, 0], [-sg * 0.12, 1.35, 0.08], 0.36, 0.16, 6, white); blob(M, [-sg * 0.18, 1.55, 0.12], 0.19, white, { fine: true });
    for (const k of [-1, 1]) taper('marble', M, [k * 0.15, 1.05, -0.05], [k * 0.78, k === sg ? 1.75 : 1.45, -0.05], 0.3, 0.07, 4, white2, { kz: 0.3 });
  }
  // the cartouche on the corner towards Via Maqueda, and the potted palms along the foot of the front
  blob(F(len / 2, Y(0.4), 0.12), [0, 0, 0], 0.55, white, { fine: true, ky: 1.6, kz: 0.5 });
  for (const f of [0.045, 0.145, 0.63, 0.735, 0.845]) {
    const s = (f - 0.5) * len, p = new THREE.Vector3(s, 0, 0.75).applyMatrix4(F(0, 0, 0)), M = frame(p.x, groundY(p.x, p.z), p.z, nx, nz);
    cyl('flat', 0.48, 0.34, 0.75, 8, { M, c: '#a65f40', noao: true });
    const Q = quadSet('flat');
    for (let i = 0; i < 9; i++) {
      const a = i * TWO / 9 + f * 9, dx = Math.cos(a), dz = Math.sin(a) * 0.55, hi = i % 3 * 0.28;
      const W = (r, y, side) => new THREE.Vector3(dx * r - Math.sin(a) * side, y, dz * r + Math.cos(a) * side * 0.55).applyMatrix4(M).toArray();
      for (const up of [1, -1]) { Q.q(i % 2 ? '#4d6b34' : '#5c7a3c', [0, up, 0], W(0.05, 0.8, 0.04), W(0.55, 1.55 + hi, 0.2), W(0.6, 1.55 + hi, 0), W(0.55, 1.55 + hi, -0.2)); Q.q(i % 2 ? '#4d6b34' : '#5c7a3c', [0, up, 0], W(0.55, 1.55 + hi, 0.2), W(1.15, 1.1 + hi, 0), W(1.15, 1.1 + hi, 0), W(0.55, 1.55 + hi, -0.2)); }
    }
    Q.flush();
  }
  flushStamps();
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

// ---------- relief parts for the church, theatre and gate fronts below ----------
// a box from its bounds in the frame M (in either order: a negative size would turn the faces inside out)
function slab(key, M, x0, x1, y0, y1, z0, z1, c, o) { box(key, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), { M, p: [(x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2], c, ...o }); }
// a flat shape standing in the frame M, from depth z0 outwards by d. pts: [x, y] straight to, [cx, cy, x, y] a curve to
function plate(key, M, pts, z0, d, c, o) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts.slice(1)) { if (q.length === 4) s.quadraticCurveTo(q[0], q[1], q[2], q[3]); else s.lineTo(q[0], q[1]); }
  part(key, new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 }), { M: mul(M, tr(0, 0, z0)), c, ...o });
}
const disc = (key, M, x, y, r, z0, d, c, n = 10) => cyl(key, r, r, d, n, { M: mul(M, tr(x, y, z0)), rx: PI / 2, c });
// a round headed panel (w wide, h to the crown) and the moulding round such an opening (t wide); eight steps round the head are enough at their size
const coarse = (shape, depth, hole) => { if (hole) shape.holes.push(hole); return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }); };
const arched = (key, M, x, y, w, h, z0, d, c, o) => part(key, coarse(archShape(w, h), d), { M: mul(M, tr(x, y, z0)), c, noao: true, ...o });
const archRing = (key, M, x, y, w, h, t, z0, d, c) => part(key, coarse(archShape(w + 2 * t, h + t), d, archPath(w, h)), { M: mul(M, tr(x, y, z0)), c });
// pilaster: base, shaft, capital in two steps
function pil(key, M, x, y0, y1, w, d, c) {
  slab(key, M, x - w * 0.68, x + w * 0.68, y0, y0 + 0.4, 0, d + 0.1, c);
  slab(key, M, x - w / 2, x + w / 2, y0 + 0.4, y1 - 0.65, 0, d, c);
  slab(key, M, x - w * 0.6, x + w * 0.6, y1 - 0.65, y1 - 0.18, 0, d + 0.08, c);
  slab(key, M, x - w * 0.76, x + w * 0.76, y1 - 0.18, y1, 0, d + 0.17, c);
}
// cornice: two steps, the upper one further out
function ledge(key, M, x0, x1, y, h, d, c) { slab(key, M, x0, x1, y, y + h * 0.5, 0, d * 0.55, c); slab(key, M, x0 - d * 0.2, x1 + d * 0.2, y + h * 0.5, y + h, 0, d, c); }
const triPed = (key, M, x, y, w, h, z0, d, c) => plate(key, M, [[x - w / 2, y], [x + w / 2, y], [x, y + h]], z0, d, c);
const segPed = (key, M, x, y, w, h, z0, d, c) => plate(key, M, [[x - w / 2, y], [x + w / 2, y], [x, y + 2 * h, x - w / 2, y]], z0, d, c);
// a framed window with glazing bars and, over it, a pointed (1) or curved (2) hood
function winP(M, x, y, w, h, z, ped, fc, key = 'ashlar') {
  slab(key, M, x - w / 2 - 0.24, x + w / 2 + 0.24, y - 0.24, y + h + 0.22, z, z + 0.14, fc);
  slab('flat', M, x - w / 2, x + w / 2, y, y + h, z + 0.1, z + 0.17, '#34302e', { noao: true });
  slab('flat', M, x - 0.04, x + 0.04, y, y + h, z + 0.17, z + 0.2, '#8d806c', { noao: true });
  slab('flat', M, x - w / 2, x + w / 2, y + h * 0.55, y + h * 0.55 + 0.07, z + 0.17, z + 0.2, '#8d806c', { noao: true });
  if (ped) (ped === 1 ? triPed : segPed)(key, M, x, y + h + 0.4, w + 0.85, w * 0.34, z, 0.3, fc);
}
// a balustrade that follows a slope from (xa, ya) to (xb, yb), the balusters upright
function slopeBalus(M, xa, ya, xb, yb, h, z) {
  const [x0, y0, x1, y1] = xa < xb ? [xa, ya, xb, yb] : [xb, yb, xa, ya], L = (x1 - x0) / h;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z, x1, y1, z, x1, y1 + h, z, x0, y0, z, x1, y1 + h, z, x0, y0 + h, z], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L, 0, L, 1, 0, 0, L, 1, 0, 1], 2));
  part('balus', g, { M, uv: 'keep', noao: true });
}
// any faces from a list of triangles [[x, y, z] x 3, ...] in the frame M, each turned to look upwards (roofs)
function roofTris(key, M, tris, c) {
  const P = [];
  for (let [a, b, d] of tris) {
    if ((b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]) < 0) [b, d] = [d, b];
    P.push(...a, ...b, ...d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  part(key, g, { M, c, noao: true });
}
// hipped roof over the rectangle, the ridge along its longer side
function hip(key, M, x0, x1, z0, z1, y, h, c) {
  const w = x1 - x0, d = z1 - z0, k = Math.min(w, d) / 2;
  const A = [x0, y, z1], B = [x1, y, z1], C = [x1, y, z0], D = [x0, y, z0];
  const R = w >= d ? [x0 + k, y + h, (z0 + z1) / 2] : [(x0 + x1) / 2, y + h, z1 - k], S = w >= d ? [x1 - k, y + h, (z0 + z1) / 2] : [(x0 + x1) / 2, y + h, z0 + k];
  roofTris(key, M, w >= d ? [[A, B, S], [A, S, R], [C, D, R], [C, R, S], [D, A, R], [B, C, S]] : [[A, B, R], [C, D, S], [D, A, R], [D, R, S], [B, C, S], [B, S, R]], c);
}

// ====================================================================================================
// 3. Teatro Massimo
// ====================================================================================================
// Reference photos (Wikimedia Commons, looked at, nothing copied or stored): "Teatro Massimo Palermo", "Palermo-Teatro-Massimo-bjs2007-01, -02", "Main facade - Teatro Massimo - Palermo - Italy 2015" (and "(2)"),
// "Teatro Massimo (Palermo) 19 06 2026 01", "Teatro Massimo Fianco meridionale", "Teatro Massimo PA 07"; Mapillary on the street along the south side (April 2024: no steps on that side).
// The front looks east north east, across the gardens towards Via Maqueda: the footprint has the portico as the 20 x 12 m piece at that end, a round pavilion on each flank, and the street view and the corner
// photos agree. Built: the portico of six giant Corinthian columns with two behind each corner one, the inscribed frieze and the pediment above the level of the wings, the stair between the two pedestals with the
// bronze lions and their riders, two storeys of arched windows between giant pilasters under one entablature and attic, the lower round pavilions with conical tiled roofs, hipped tile roofs, the auditorium drum
// with its lunettes and cornices, the shallow ribbed dome of green bronze scales with its vase finial, the fly tower with its gables.
// Not verified: heights are read off the photos against the footprint (the columns' spacing fits the 20 m piece); the rear (west) front and the sculpture of the tympanum are left plain.
const TEATRO = { C: [-377.05, -486.46], N: [0.898, -0.440], PX: -3.7 };   // the frame's origin and the outward direction of the front (local +z); PX: the portico's axis across
function paintTeBay(g, w, h) {   // one bay, 4.8 x 20 m: rusticated foot, the ground floor arch, the balustrade panel and the tall arched window of the upper floor
  const Wm = 4.8, Hm = 20, sx = w / Wm, sy = h / Hm, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, Wm, Hm, 0.55, 1.2, '#b8996c', '#80663f', 91, 2, 0.07);
  const rect = (a, y0, b, y1, f) => { g.fillStyle = f; g.fillRect(X(a), Y(y1), (b - a) * sx, (y1 - y0) * sy); };
  rect(0, 0, Wm, 3.0, 'rgba(60,40,18,0.2)'); for (let y = 0.5; y < 3; y += 0.6) rect(0, y, Wm, y + 0.07, 'rgba(60,40,20,0.5)');
  const arch = (cx, y0, y1, ww, f) => { const r = ww / 2, yc = y1 - r; g.fillStyle = f; g.fillRect(X(cx - r), Y(yc), ww * sx, (yc - y0) * sy); g.beginPath(); g.ellipse(X(cx), Y(yc), r * sx, r * sy, 0, PI, 0); g.fill(); };
  const win = (y0, y1, ww) => {
    arch(2.4, y0, y1 + 0.32, ww + 0.64, '#dcbb82'); arch(2.4, y0, y1 + 0.06, ww + 0.12, 'rgba(60,35,15,0.55)'); arch(2.4, y0, y1, ww, '#6a3a2a'); arch(2.4, y0 + 0.12, y1 - 0.14, ww - 0.28, '#383c46');
    const yc = y1 - ww / 2; g.fillStyle = '#7a4634';
    for (const k of [-ww / 6, ww / 6]) g.fillRect(X(2.4 + k) - 1.5, Y(yc), 3, (yc - y0) * sy);
    g.fillRect(X(2.4 - ww / 2), Y(yc) - 2, ww * sx, 4); g.fillRect(X(2.4 - ww / 2), Y((y0 + yc) / 2) - 1.5, ww * sx, 3);
    g.strokeStyle = '#7a4634'; g.lineWidth = 3; for (const a of [PI * 1.25, PI * 1.5, PI * 1.75]) { g.beginPath(); g.moveTo(X(2.4), Y(yc)); g.lineTo(X(2.4 + Math.cos(a) * ww / 2), Y(yc - Math.sin(a) * ww / 2)); g.stroke(); }
    rect(2.4 - 0.2, y1 + 0.05, 2.4 + 0.2, y1 + 0.55, '#e6c890');
  };
  win(0.9, 7.5, 2.5);
  rect(0, 8.4, Wm, 9.2, '#dab87e'); rect(0, 8.3, Wm, 8.45, 'rgba(50,30,12,0.5)');
  rect(0.85, 9.35, 3.95, 10.5, '#e0c18a'); for (let s = 1.05; s < 3.8; s += 0.34) rect(s, 9.55, s + 0.17, 10.3, 'rgba(50,30,14,0.6)');
  win(10.55, 15.2, 2.65);
  rect(0, 15.9, Wm, 16.1, '#dab87e');
  streaks(g, w, h, 22, 93, 0.13, 150);
}
function paintTeDome(g, w, h) {   // one gore of the dome: rows of bronze scales gone green between two ribs
  g.fillStyle = '#7f8a6c'; g.fillRect(0, 0, w, h);
  const r_ = R_(191);
  for (let y = h + 8, row = 0; y > -8; y -= 9, row++) for (let x = (row & 1) * 7 - 7; x < w + 7; x += 14) {
    g.fillStyle = `hsl(${62 + r_() * 55},${14 + r_() * 12}%,${40 + r_() * 20}%)`; g.beginPath(); g.arc(x, y - 6, 7.4, 0, PI); g.fill();
    g.strokeStyle = 'rgba(30,36,24,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y - 6, 7.4, 0, PI); g.stroke();
  }
  g.fillStyle = '#c2bb92'; g.fillRect(0, 0, 4, h); g.fillStyle = 'rgba(30,34,22,0.5)'; g.fillRect(4, 0, 2, h);
}
function paintTeInscr(g, w, h) {   // the two lines of the frieze, as on the photos
  g.fillStyle = '#d3b27c'; g.fillRect(0, 0, w, h);
  noiseDots(g, w, h, 500, 2, 95, ['rgba(80,55,25,0.18)', 'rgba(255,235,190,0.18)']);
  g.fillStyle = '#4a3418'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${(h * 0.4) | 0}px serif`; g.fillText("L'ARTE RINNOVA I POPOLI E NE RIVELA LA VITA", w / 2, h * 0.29, w * 0.94);
  g.font = `bold ${(h * 0.31) | 0}px serif`; g.fillText("VANO DELLE SCENE IL DILETTO OVE NON MIRI A PREPARAR L'AVVENIRE", w / 2, h * 0.73, w * 0.94);
}
function lion(M, c = '#3a3126') {   // a walking bronze lion, head towards +z
  cyl('bronze', 0.42, 0.5, 1.7, 8, { M: mul(M, tr(0, 1.0, -1.15)), rx: PI / 2, c });                       // the barrel of the body
  sphere('bronze', 0.5, { M, p: [0, 1.0, -1.15], c, seg: 8 });
  sphere('bronze', 0.68, { M, p: [0, 1.2, 0.55], c, seg: 8, ky: 1.1 });                                    // chest and mane
  sphere('bronze', 0.5, { M, p: [0, 1.68, 0.86], c, seg: 8 });
  sphere('bronze', 0.3, { M, p: [0, 1.62, 1.3], c, seg: 6, ky: 0.9 });                                     // face and muzzle
  slab('bronze', M, -0.18, 0.18, 1.35, 1.55, 1.3, 1.62, c);
  for (const sx of [-0.34, 0.34]) {
    sphere('bronze', 0.13, { M, p: [sx * 0.8, 2.08, 0.95], c, seg: 5 });
    box('bronze', 0.2, 1.05, 0.24, { M, p: [sx, 0, 0.7], c, rx: sx < 0 ? -0.22 : 0.1 });
    box('bronze', 0.2, 1.0, 0.3, { M, p: [sx, 0, -1.05], c, rx: sx < 0 ? 0.2 : -0.14 });
    slab('bronze', M, sx - 0.15, sx + 0.15, 0, 0.14, sx < 0 ? 0.75 : 0.5, sx < 0 ? 1.15 : 0.9, c);
  }
  box('bronze', 0.1, 0.1, 1.15, { M, p: [0.15, 1.15, -1.5], c, rx: -2.6 });
}
function teColumn(M, h, r, c) {
  slab('ashlar', M, -r * 1.35, r * 1.35, 0, 0.35, -r * 1.35, r * 1.35, c);
  cyl('ashlar', r * 1.08, r * 1.2, 0.35, 12, { M: mul(M, tr(0, 0.35, 0)), c });
  cyl('ashlar', r * 0.84, r, h - 2.15, 12, { M: mul(M, tr(0, 0.7, 0)), c });
  lathe('ashlar', [[r * 0.86, 0], [r * 1.02, 0.1], [r * 0.98, 0.3], [r * 1.22, 0.7], [r * 1.12, 0.78], [r * 1.48, 1.2], [0, 1.2]], 10, { M: mul(M, tr(0, h - 1.45, 0)), c });
  slab('ashlar', M, -r * 1.5, r * 1.5, h - 0.25, h, -r * 1.5, r * 1.5, c);
}
function buildTeatro(ctx) {
  CUR = 'Teatro Massimo';
  const b = byId('w24937131'); if (!b) return;
  defMat('teWing', mkTex(256, 1024, paintTeBay), [4.8, 20]);
  defMat('teDome', mkTex(64, 256, paintTeDome), [1, 1]);
  defMat('teInscr', mkTex(1024, 64, paintTeInscr), [1, 1]);
  const pts = pairsOf(b.p), gy = minGround(pts); BASEY = gy;
  const { C, N, PX } = TEATRO, F = frame(C[0], gy, C[1], N[0], N[1]);
  const loc = ([x, z]) => [(x - C[0]) * N[1] - (z - C[1]) * N[0], (x - C[0]) * N[0] + (z - C[1]) * N[1]];
  const GOLD = '#dccab2', GOLD2 = '#cdbba6', TRIM = '#f2e6cc';
  // the footprint in three pieces: the body (without the portico's front corners and the bulge of the round pavilions) and the two pavilions
  const bulge = ([x, z]) => z > 5 && z < 33 && (x > 24 || x < -31);
  const body = pts.filter(p => { const q = loc(p); return q[1] < 66 && !bulge(q); });
  const round = [1, -1].map(sg => pts.filter(p => { const [x, z] = loc(p); return z > 5 && z < 34.5 && sg * x > (sg > 0 ? 20 : 29); }));
  // one outside wall: the painted bays, the giant pilasters between them, frieze, cornice and attic. k squeezes the order (the pavilions are lower)
  const wall = (e, k, ends) => {
    const n = e.len < 3.2 ? 0 : Math.max(1, Math.round(e.len / 4.8)), top = 19.1 * k;
    const u = n ? [0, n] : [-e.len / 9.6, e.len / 9.6];
    wallQuad('teWing', e.L, e.R, gy - 0.8, gy + top, [u[0], -0.8 / (20 * k), u[1], top / (20 * k)], '#ffffff');
    const M = frame((e.L[0] + e.R[0]) / 2, gy, (e.L[1] + e.R[1]) / 2, e.nx, e.nz), h = e.len / 2;
    for (let i = 0; n && i <= n; i++) {
      if (!ends && i === n) break;
      const x = Math.max(-h + 0.42, Math.min(h - 0.42, -h + i * e.len / n));
      slab('ashlar', M, x - 0.62, x + 0.62, -0.5, 3.8 * k, 0, 0.34, GOLD2);
      slab('ashlar', M, x - 0.4, x + 0.4, 3.8 * k, 15.1 * k, 0, 0.4, '#fff4dc');
      slab('ashlar', M, x - 0.58, x + 0.58, 15.1 * k, 16.3 * k, 0, 0.48, TRIM);
    }
    slab('ashlar', M, -h, h, 16.3 * k, 18.3 * k, -0.1, 0.34, GOLD);
    slab('ashlar', M, -h - 0.35, h + 0.35, 18.3 * k, 19.1 * k, -0.1, 0.8, TRIM);
    slab('ashlar', M, -h, h, 19.1 * k, 19.1 * k + 1.0, -0.4, 0.05, GOLD);
  };
  for (let i = 0; i < body.length; i++) {
    const e = edgeLR(body, i), m = loc([(e.L[0] + e.R[0]) / 2, (e.L[1] + e.R[1]) / 2]);
    if (m[1] > 62 && Math.abs(m[0] - PX) < 6) continue;                                   // the portico's back wall, built below
    if (m[1] > 4 && m[1] < 35 && ((m[0] > 18 && m[0] < 25) || (m[0] < -28 && m[0] > -31))) continue;   // the chords inside the pavilions
    wall(e, 1, true);
  }
  roofPoly('flat', body, gy + 19.15, '#8e5a4c', { noao: true });
  for (const ring of round) {
    const c = centroid([ring[0], ring[ring.length - 1]]), cl = loc(c), apex = [cl[0], 18.8, cl[1]];
    for (let i = 0; i + 1 < ring.length; i++) {
      const e = edgeLR(ring, i); wall(e, 0.8, false);
      const a = loc(e.L), d = loc(e.R); roofTris('tile', F, [[[a[0], 16.1, a[1]], [d[0], 16.1, d[1]], apex]], '#bca29c');
    }
    roofPoly('flat', ring, gy + 15.4, '#8e5a4c', { noao: true });
  }
  // the hipped tile roofs behind the attic
  for (const [x0, x1, z0, z1, h] of [[-35.8, 30.2, 51.2, 63.6, 3.0], [-29.2, 22.8, 33.0, 50.8, 2.8], [-38.3, 29.2, -25.6, -12.0, 2.6], [-21.0, 10.0, -43.4, -27.0, 2.6]]) hip('tile', F, x0, x1, z0, z1, 19.5, h, '#bca29c');
  // ---- the auditorium: the drum with its lunettes, the cornices, the dome of scales and the vase on top
  const D = mul(F, tr(-3.1, 0, 20));
  const ring = (r, y, h, c, n = 32) => cyl('ashlar', r, r, h, n, { M: mul(D, tr(0, y, 0)), c });
  ring(13.8, 19.0, 10.4, GOLD); ring(14.2, 22.6, 0.4, TRIM); ring(14.25, 27.9, 0.35, TRIM); ring(14.9, 29.4, 0.9, TRIM); ring(13.5, 30.3, 0.9, GOLD2);
  for (let k = 0; k < 16; k++) {
    const R = mul(D, mul(rotY((k + 0.5) * TWO / 16), tr(0, 0, 13.7)));
    arched('ashlar', R, 0, 23.2, 3.8, 2.15, 0, 0.18, TRIM, { noao: false });
    arched('flat', R, 0, 23.45, 3.0, 1.6, 0.1, 0.14, '#33343a');
  }
  for (let k = 0; k < 32; k++) { const R = mul(D, mul(rotY(k * TWO / 32), tr(0, 0, 14.45))); slab('ashlar', R, -0.2, 0.2, 30.3, 30.95, -0.15, 0.2, TRIM); }
  lathe('teDome', [[13.25, 0], [13.0, 0.45], [12.45, 0.55], [11.5, 2.2], [9.5, 3.9], [6.9, 5.2], [4.3, 5.95], [2.4, 6.2], [1.9, 6.9], [0.02, 7.15]], 32, { M: mul(D, tr(0, 31.2, 0)), uv: 'keep', uvk: [40, 1], noao: true });
  const BZ = '#55604a';
  cyl('bronze', 0.9, 1.7, 0.8, 10, { M: mul(D, tr(0, 38.0, 0)), c: BZ });
  lathe('bronze', [[0.55, 0], [0.45, 0.9], [1.0, 1.4], [1.75, 2.2], [1.85, 2.7], [1.2, 2.75], [0.5, 3.4], [0.02, 3.8]], 10, { M: mul(D, tr(0, 38.7, 0)), c: BZ });
  for (let k = 0; k < 4; k++) { const R = mul(D, rotY(k * PI / 2 + PI / 4)); box('bronze', 0.22, 2.0, 0.22, { M: R, p: [0, 39.5, 1.5], rx: 0.5, c: BZ }); sphere('bronze', 0.3, { M: R, p: [0, 41.35, 2.5], c: BZ, seg: 6 }); }
  // ---- the fly tower behind it
  slab('ashlar', F, -23.5, 17.5, 19.0, 31.8, -24.0, 5.2, GOLD);
  slab('ashlar', F, -24.1, 18.1, 31.8, 32.7, -24.6, 5.8, TRIM);
  slab('ashlar', F, -22.8, 16.8, 32.7, 34.4, -23.3, 4.5, GOLD);
  triPed('ashlar', F, -3.0, 34.4, 39.6, 4.8, -23.3, 27.8, GOLD2);
  triPed('ashlar', F, -3.0, 34.75, 32.0, 3.5, 4.5, 0.12, '#b8925c');
  for (const sg of [-1, 1]) roofTris('tile', F, [[[-3 + sg * 20.1, 34.45, -23.5], [-3, 39.35, -23.5], [-3, 39.35, 4.7]], [[-3 + sg * 20.1, 34.45, -23.5], [-3, 39.35, 4.7], [-3 + sg * 20.1, 34.45, 4.7]]], '#c89a88');
  for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) { const x = -3 + sg * 20.52, z = -21 + i * 4.6; slab('flat', F, x - 0.06, x + 0.06, 27.0, 29.2, z, z + 1.4, '#3a3230', { noao: true }); }
  // ---- the portico
  const P = mul(F, tr(PX, 0, 0));
  slab('ashlar', P, -10.1, 10.1, -0.5, 3.8, 63.6, 76.6, GOLD2);
  slab('flat', P, -10.0, 10.0, 3.8, 16.4, 63.8, 64.5, '#7c3a34');                            // the red wall at the back
  slab('ashlar', P, -2.6, 2.6, 3.8, 13.9, 64.45, 64.62, TRIM);
  slab('flat', P, -2.1, 2.1, 3.8, 13.3, 64.6, 64.66, '#241f1e', { noao: true });
  for (const x of [-0.75, 0.75]) slab('flat', P, x - 0.06, x + 0.06, 3.8, 13.3, 64.66, 64.7, '#8a7a5c', { noao: true });
  for (const y of [7.6, 9.8, 10.6, 11.9]) slab('flat', P, -2.1, 2.1, y, y + 0.14, 64.66, 64.7, '#8a7a5c', { noao: true });
  slab('ashlar', P, -3.2, 3.2, 14.4, 14.95, 64.45, 65.0, TRIM);
  for (const x of [-6.2, 6.2]) {
    archRing('ashlar', P, x, 4.6, 3.2, 8.6, 0.35, 64.45, 0.22, TRIM);
    arched('flat', P, x, 4.6, 3.2, 8.6, 64.5, 0.06, '#b9863f');
    slab('bronze', P, x - 0.08, x + 0.08, 3.8, 9.6, 64.9, 65.06, '#3c3428'); sphere('bronze', 0.35, { M: P, p: [x, 9.9, 65.0], c: '#6a5a38', seg: 6 });
  }
  for (const x of [-8.85, -5.31, -1.77, 1.77, 5.31, 8.85]) teColumn(mul(P, tr(x, 3.8, 75.2)), 12.5, 0.74, '#eedcbc');
  for (const sg of [-1, 1]) for (const z of [71.1, 67.0]) teColumn(mul(P, tr(sg * 8.85, 3.8, z)), 12.5, 0.74, '#eedcbc');
  slab('ashlar', P, -9.75, 9.75, 16.3, 17.2, 63.8, 76.05, TRIM);
  slab('ashlar', P, -9.65, 9.65, 17.2, 18.4, 63.8, 75.98, GOLD);
  part('teInscr', geo('plane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); return p; }), { M: mul(P, tr(0, 17.22, 76.0)), s: [18.9, 1.16, 1], uv: 'keep', noao: true });
  slab('ashlar', P, -10.2, 10.2, 18.4, 18.75, 63.8, 76.45, GOLD);
  for (let x = -9.8; x <= 9.81; x += 0.7) slab('ashlar', P, x - 0.18, x + 0.18, 18.4, 18.75, 76.45, 76.75, TRIM);
  slab('ashlar', P, -10.6, 10.6, 18.75, 19.2, 63.8, 76.95, TRIM);
  triPed('ashlar', P, 0, 19.2, 21.0, 4.2, 63.8, 12.65, GOLD);
  triPed('ashlar', P, 0, 19.5, 16.6, 3.1, 76.45, 0.08, '#b9935e');
  for (const x of [-3.4, -1.4, 0.5, 2.6]) { sphere('ashlar', 0.55, { M: P, p: [x, 20.35 - Math.abs(x) * 0.08, 76.5], c: GOLD, ky: 1.5, seg: 6 }); }
  const ang = Math.atan2(4.2, 10.5), len = Math.hypot(10.5, 4.2);
  for (const sg of [-1, 1]) {
    box('ashlar', len + 0.4, 0.55, 0.65, { M: P, p: [sg * 5.28, 21.2, 76.65], rz: -sg * ang, c: TRIM });
    roofTris('tile', P, [[[sg * 10.65, 19.75, 63.8], [0, 24.0, 63.8], [0, 24.0, 76.35]], [[sg * 10.65, 19.75, 63.8], [0, 24.0, 76.35], [sg * 10.65, 19.75, 76.35]]], '#bca29c');
    slab('ashlar', P, sg * 9.5, sg * 10.7, 19.2, 20.5, 75.9, 76.9, TRIM); sphere('ashlar', 0.55, { M: P, p: [sg * 10.1, 20.95, 76.4], c: TRIM, seg: 6 });
  }
  slab('ashlar', P, -0.7, 0.7, 23.5, 24.2, 75.8, 76.9, TRIM); lathe('ashlar', [[0.35, 0], [0.75, 0.6], [0.3, 0.9], [0.55, 1.3], [0.02, 1.6]], 8, { M: mul(P, tr(0, 24.2, 76.35)), c: TRIM });
  // ---- the stair, the cheek walls, the pedestals with the lions and their riders (La Lirica, La Tragedia)
  for (let i = 0; i < 24; i++) slab('ashlar', P, -9.6, 9.6, -0.5, 3.8 * (24 - i) / 24, 76.6 + i * 0.42, 77.02 + i * 0.42, i & 1 ? '#c9bda4' : '#d8ccb2');
  for (const sg of [-1, 1]) {
    slab('ashlar', P, sg * 9.6, sg * 11.2, -0.5, 4.1, 76.5, 81.2, GOLD2);
    slab('ashlar', P, sg * 9.75, sg * 14.55, -0.5, 0.8, 80.8, 86.75, GOLD2);
    slab('ashlar', P, sg * 10.05, sg * 14.25, 0.8, 4.5, 81.05, 86.45, GOLD);
    slab('ashlar', P, sg * 9.75, sg * 14.55, 4.5, 5.0, 80.8, 86.75, TRIM);
    slab('ashlar', P, sg * 10.9, sg * 13.4, 1.4, 3.8, 86.4, 86.55, '#b8925c');
    const L = mul(P, mul(tr(sg * 12.15, 5.0, 83.6), mul(rotY(-sg * 0.85), new THREE.Matrix4().makeScale(1.45, 1.45, 1.45))));
    lion(L, '#55523c'); statue('bronze', mul(L, tr(0, 1.35, -0.45)), 2.0, { c: '#67634a', cloak: '#4f4c34' });
  }
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
  // south porch: a loggia of three pointed arches under a carved gable between two turrets, standing in front of the south aisle wall
  // Photos for the porch and the cupolas (Wikimedia Commons "Cattedrale di Palermo Ap 2024"; Mapillary image 1645203652344738 of the south side). Not verified: the carving of the gable and of the doorways is suggested by
  // mouldings and a blind arcade, not copied; the number and spacing of the cupolas are approximate.
  {
    const sP = 27.4, eC = -31.5, W = 21, ST = '#cdbc9c', PALE = '#e2d8c0', SHADE = '#a29078';
    const [px, pz] = L(eC, sP);
    const PM = frame(px, gy, pz, S[0], S[1]);    // local x along the facade, local z out of the porch
    const arches = [[0, 6.2, 11.5, 6.5], [-7.4, 4.2, 9.2, 5.5], [7.4, 4.2, 9.2, 5.5]];
    const pointed = (p, x, w, h, sh) => { p.moveTo(x - w / 2, 0.03); p.lineTo(x - w / 2, sh); p.quadraticCurveTo(x - w / 2, sh + (h - sh) * 0.85, x, h); p.quadraticCurveTo(x + w / 2, sh + (h - sh) * 0.85, x + w / 2, sh); p.lineTo(x + w / 2, 0.03); p.lineTo(x - w / 2, 0.03); return p; };
    const out = new THREE.Shape(); out.moveTo(-W / 2, 0); out.lineTo(W / 2, 0); out.lineTo(W / 2, 14); out.lineTo(0, 19.5); out.lineTo(-W / 2, 14); out.lineTo(-W / 2, 0);
    for (const a of arches) out.holes.push(pointed(new THREE.Path(), ...a));
    part('ashlar', new THREE.ExtrudeGeometry(out, { depth: 0.7, bevelEnabled: false, curveSegments: 4 }), { M: mul(PM, tr(0, 0, 0.4)), c: ST });
    // the moulded orders round each arch, and its columns at the jambs
    for (const [x, w, h, sh] of arches) {
      for (const [t, d, c] of [[0.5, 0.14, PALE], [0.22, 0.26, SHADE]]) { const m = pointed(new THREE.Shape(), x, w + 2 * t, h + t * 1.3, sh); m.holes.push(pointed(new THREE.Path(), x, w, h, sh)); part('ashlar', new THREE.ExtrudeGeometry(m, { depth: d, bevelEnabled: false, curveSegments: 4 }), { M: mul(PM, tr(0, 0, 1.1)), c }); }
      for (const sg of [-1, 1]) { const cx = x + sg * (w / 2 + 0.02); cyl('marble', 0.17, 0.2, sh - 0.65, 8, { M: mul(PM, tr(cx, 0.35, 1.25)), c: '#ded7c6' }); slab('ashlar', PM, cx - 0.34, cx + 0.34, sh - 0.3, sh + 0.1, 0.4, 1.6, PALE); slab('ashlar', PM, cx - 0.3, cx + 0.3, 0, 0.35, 0.9, 1.55, PALE); }
    }
    // behind the arches: the back wall in shadow with the carved doorway (the cathedral's own wall stands just behind the screen, so the loggia is shallow)
    slab('ashlar', PM, -W / 2, W / 2, 0, 13.6, -3.0, 0.12, '#968468');
    for (const [x, w, h, k] of [[0, 3.4, 7.4, 1], [-7.4, 1.8, 4.6, 0], [7.4, 1.8, 4.6, 0]]) {
      const door = pointed(new THREE.Shape(), x, w, h, h * 0.66);
      part('dark', new THREE.ShapeGeometry(door), { M: mul(PM, tr(0, 0, 0.16)), uv: 'keep', c: '#3a2c20', noao: true });
      for (let q = 1; q <= 2 + k; q++) { const m = pointed(new THREE.Shape(), x, w + q * 0.5, h + q * 0.45, h * 0.66); m.holes.push(pointed(new THREE.Path(), x, w + (q - 1) * 0.5, h + (q - 1) * 0.45, h * 0.66)); part('ashlar', new THREE.ExtrudeGeometry(m, { depth: 0.07 * (4 + k - q), bevelEnabled: false, curveSegments: 4 }), { M: mul(PM, tr(0, 0, 0.12)), c: q & 1 ? PALE : SHADE }); }
    }
    // the frieze over the arches, the little blind arcade and the roundel in the gable, the raking cornice with its crest
    slab('ashlar', PM, -W / 2 - 0.2, W / 2 + 0.2, 12.5, 12.75, 0.9, 1.45, PALE); slab('ashlar', PM, -W / 2 - 0.4, W / 2 + 0.4, 13.8, 14.25, 0.9, 1.65, PALE);
    for (let x = -W / 2 + 0.8; x < W / 2 - 0.4; x += 0.82) part('dark', new THREE.ShapeGeometry(pointed(new THREE.Shape(), x, 0.42, 0.85, 0.5), 3), { M: mul(PM, tr(0, 12.85, 1.13)), uv: 'keep', c: '#6a553c', noao: true });
    for (let x = -6.3; x <= 6.31; x += 1.4) { const h = 2.9 * (1 - Math.abs(x) / 9); if (Math.abs(x) > 1.2) part('dark', new THREE.ShapeGeometry(pointed(new THREE.Shape(), x, 0.6, h, h * 0.6)), { M: mul(PM, tr(0, 14.5, 1.13)), uv: 'keep', c: '#7a6446', noao: true }); }
    cyl('ashlar', 1.05, 1.05, 0.2, 14, { M: mul(PM, tr(0, 16.4, 1.05)), rx: PI / 2, c: PALE }); cyl('dark', 0.62, 0.62, 0.05, 12, { M: mul(PM, tr(0, 16.4, 1.26)), rx: PI / 2, c: '#6a553c' });
    const rake = Math.atan2(5.5, W / 2), len = Math.hypot(5.5, W / 2);
    for (const sg of [-1, 1]) {
      box('ashlar', len + 0.3, 0.4, 0.75, { M: PM, p: [sg * W / 4, 16.7, 1.05], rz: -sg * rake, c: PALE });
      for (let k = 1; k < 9; k++) { const t = k / 9; slab('ashlar', PM, sg * (W / 2) * (1 - t) - 0.14, sg * (W / 2) * (1 - t) + 0.14, 14.35 + 5.5 * t, 15.1 + 5.5 * t, 0.7, 1.0, ST); }
    }
    slab('ashlar', PM, -0.12, 0.12, 19.7, 21.2, 0.7, 0.95, PALE); slab('ashlar', PM, -0.5, 0.5, 20.45, 20.7, 0.7, 0.95, PALE);
    for (const sg of [-1, 1]) {
      cyl('ashlar', 0.8, 0.95, 15, 8, { M: mul(PM, tr(sg * (W / 2 + 0.2), 0, 0.2)), c: ST });
      for (const y of [5.5, 9.5, 12.6, 14.7]) cyl('ashlar', 1.05, 1.05, 0.28, 8, { M: mul(PM, tr(sg * (W / 2 + 0.2), y, 0.2)), c: PALE });
      cyl('ashlar', 0, 1.0, 3.2, 8, { M: mul(PM, tr(sg * (W / 2 + 0.2), 15, 0.2)), c: '#c8ae82' });
    }
    { const gs = new THREE.Shape(); gs.moveTo(-W / 2, 14); gs.lineTo(W / 2, 14); gs.lineTo(0, 19.5); gs.lineTo(-W / 2, 14); part('tile', shapeGeo(gs, 4.6), { M: mul(PM, tr(0, 0, -4.2)), c: '#bca29c' }); }
  }
  // the small tiled cupolas in a row over the side aisles, each with its white lantern
  for (const [sOff, es] of [[14.2, [-21.5, -15.7, -9.9, -4.1, 1.7]], [-16.2, [-33, -27, -21, -15, -9]]]) for (const e of es) {
    const [x, z] = L(e, sOff), y = gy + 10.6;
    cyl('ashlar', 1.55, 1.65, 1.7, 8, { p: [x, y, z], c: '#cdb48a' }); cyl('ashlar', 1.75, 1.75, 0.28, 8, { p: [x, y + 1.7, z], c: '#e2ceA4' });
    lathe('flat', [[1.55, 0], [1.45, 0.6], [1.05, 1.2], [0.45, 1.6], [0.35, 1.65]], 10, { p: [x, y + 1.95, z], c: '#a9a468' });
    cyl('marble', 0.38, 0.42, 0.9, 8, { p: [x, y + 3.5, z], c: '#e8e2d0' }); cyl('marble', 0.04, 0.55, 0.55, 8, { p: [x, y + 4.4, z], c: '#d8d2bc' });
  }
  ctx.skip.add(b.id);
}

// ====================================================================================================
// 5. Porta Nuova and Porta Felice
// ====================================================================================================
// Porta Nuova. Reference photos (Wikimedia Commons, looked at, nothing copied or stored): "Porta Nuova (Palermo)", "Porta Nuova (Palermo) 01", "Porta Nuova facade, Palermo, Sicily, Italy (9459301114)",
// "Palermo-Porta-Nuova-bjs-1", "Palermo Porta Nuova BW 2025-04-29", "Porta Nuova - close view", "Palermo - Porta Nuova - 2025-09-10 23-19-24 001", "La loggia de la Porta Nuova", "Palazzo dei Normanni (Palermo) 16 07 2019 22".
// Built: the outer face (towards Monreale) with the rusticated piers, the four Moors on their herm pedestals, the fan of carved voussoirs, the corner quoins, two windows, the eagle and the shields; the face towards
// the city with its pilasters, tablets and four busts in medallions; the loggia of slender columns and arches with the pedimented windows behind; both balustrades; the railed attic, the steep truncated pyramid of
// glazed tiles with the golden eagle on each side, the platform, the yellow lantern, its cupola and finial.
// Porta Felice. Reference photos: "Palermo-Porta-Felice-bjs2007-01", "Palermo-Porta-Felice-bjs-1", "Porta Felice (Palermo) 21 06 2026 01" to "06", "Porta Felice, pilon, Palermo, Sicilia, Italia, 2015".
// Built, per pylon: towards the city the three storeys of doors, pedimented windows, pilasters, iron balconies, the great scroll on the outer shoulder and the balustraded top with its pinnacles; towards the sea the
// grey marble front with its two columns, the statue in the niche, the tablet and the fountain basin, the plain outer wing with its balustrade and statue, and the attic with the eagle, shields and scrolls.
// Not verified: heights are read off the photos against the footprints; the inner loggia sides of Porta Nuova and the flanks of the pylons are simplified; the temporary canopy on the sea side is not built.
function paintMajolica(g, w, h) {   // one side of the Porta Nuova roof: small glazed tiles, a yellow border, the crowned eagle
  g.fillStyle = '#c9c3a2'; g.fillRect(0, 0, w, h);
  const r_ = R_(71), cols = ['#d7b64e', '#6f94a0', '#e4dcc0', '#7f9a68', '#d9c98e', '#cdbf8c'];
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = r_() < 0.35 ? '#d9c98e' : cols[(r_() * cols.length) | 0]; g.fillRect(x, y, 7, 7); }
  g.strokeStyle = '#d2a82e'; g.lineWidth = 13; g.beginPath(); g.moveTo(8, h - 6); g.lineTo(w - 8, h - 6); g.lineTo(w * 0.64, 5); g.lineTo(w * 0.36, 5); g.closePath(); g.stroke();
  g.strokeStyle = '#46687a'; g.lineWidth = 3; g.stroke();
  const E = [[0, 0], [0.05, 0.05], [0.04, 0.13], [0.12, 0.1], [0.3, 0.16], [0.27, 0.11], [0.33, 0.07], [0.27, 0.04], [0.31, -0.01], [0.23, -0.02], [0.25, -0.07], [0.09, -0.05], [0.07, -0.14], [0.14, -0.22], [0.04, -0.19], [0, -0.25]];
  g.fillStyle = '#e0ac1e'; g.strokeStyle = '#6a4c10'; g.lineWidth = 2; g.beginPath();
  const at = (p, s) => [w / 2 + s * p[0] * w, h * 0.57 - p[1] * h * 1.45];
  E.forEach((p, i) => { const [x, y] = at(p, 1); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  for (let i = E.length - 1; i >= 0; i--) g.lineTo(...at(E[i], -1));
  g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(w / 2, h * 0.34, w * 0.045, 0, TWO); g.fill(); g.stroke();
  g.fillRect(w / 2 - w * 0.06, h * 0.23, w * 0.12, h * 0.045);
}
function buildPortaNuova(ctx) {
  CUR = 'Porta Nuova';
  const b = byId('w815701117'); if (!b) return;
  defMat('majolica', mkTex(256, 256, paintMajolica), [4, 4], { side: THREE.DoubleSide });
  // ground at the gate: the road under the arch, read from the streamed tile (the model is built when its tile has loaded, see CENTRO_LANDMARKS)
  const gy = groundY(-750.8, 395.6); BASEY = gy;
  // axis: through-passage along the Corso (ENE), as measured from the footprint's long edges. The OSM footprint is 18 x 18 m and runs from 7.3 m behind to
  // 10.7 m ahead of its centroid along the axis, so the model is centred on the footprint box, 0.4 m off to the side so the passage lies on the road
  // (the piers' collision in src/lmc-gates.js uses the same box). Local +z looks to the city, -z towards Monreale.
  const ax = [0.907, -0.42];
  const M0 = frame(-750.8, gy, 395.6, ax[0], ax[1]);
  const W = 18.0, Dp = 18.0, H1 = 12.2, PW = 5.8, PH = 8.6;   // width across, depth along the passage, rusticated storey height
  // lower stage with the arched passage cut right through (extruded shape with a hole)
  const base = new THREE.Shape(); base.moveTo(-W / 2, 0); base.lineTo(W / 2, 0); base.lineTo(W / 2, H1); base.lineTo(-W / 2, H1); base.lineTo(-W / 2, 0);
  const hole = archPath(PW, PH);
  part('rustic', shapeGeo(base, Dp, hole), { M: mul(M0, tr(0, -0.6, -Dp / 2)), c: '#d6cab2' });
  const faceOf = (sg) => mul(M0, mul(rotY(sg > 0 ? 0 : PI), tr(0, 0, Dp / 2)));
  const yN = H1 + 0.6;
  // ---- towards Monreale
  {
    const F = faceOf(-1), ST = '#c6bcaa', SD = '#a49c8c', MO = '#b6b4b0';
    archRing('rustic', F, 0, -0.6, PW, PH + 0.6, 0.5, 0, 0.3, '#c2ae8e');
    for (let y = 0.2; y < 4.2; y += 0.8) for (const sg of [-1, 1]) slab('rustic', F, sg * (PW / 2 + 0.05), sg * (W / 2 - 0.1), y, y + 0.5, 0, 0.42, y % 1.6 < 0.8 ? ST : SD);
    for (let y = 4.3; y < 5.4; y += 0.8) for (const sg of [-1, 1]) slab('rustic', F, sg * (PW / 2 + 0.05), sg * (PW / 2 + 0.75), y, y + 0.5, 0, 0.42, ST);
    const cy = PH - PW / 2;
    for (let k = -4; k <= 4; k++) { const a = k * 0.29, r0 = PW / 2 + 0.35; box('rustic', 0.55, 1.45 + (k ? 0 : 0.35), 0.45, { M: F, p: [Math.sin(a) * r0, cy + Math.cos(a) * r0, 0.3], rz: -a, c: k & 1 ? ST : SD }); }
    sphere('ashlar', 0.55, { M: F, p: [0, PH + 1.55, 0.55], c: ST, seg: 6, ky: 1.2 });
    for (const x of [-PW / 2 - 1.5, -PW / 2 - 3.55, PW / 2 + 1.5, PW / 2 + 3.55]) {
      const Ms = mul(F, tr(x, 0, 0.5));
      slab('rustic', F, x - 0.92, x + 0.92, 5.2, 9.4, 0, 0.06, '#8a8070');
      cyl('ashlar', 0.88, 0.55, 2.0, 4, { M: mul(Ms, tr(0, 3.2, -0.1)), ry: PI / 4, c: '#989690' });                     // the herm pedestal, widening upwards
      sphere('ashlar', 0.56, { M: Ms, p: [0, 5.35, 0.15], c: MO, seg: 6 });                                       // the mask under the half figure
      cyl('ashlar', 0.82, 0.48, 2.25, 8, { M: mul(Ms, tr(0, 5.65, 0)), c: MO });                                   // torso
      slab('ashlar', Ms, -0.88, 0.88, 7.45, 8.0, -0.35, 0.45, MO);                                                // shoulders
      for (const a of [-1, 1]) box('ashlar', 1.3, 0.34, 0.34, { M: Ms, p: [a * 0.12, 6.7 + a * 0.12, 0.62], rz: a * 0.3, c: '#d2d0cc' });   // folded arms
      sphere('ashlar', 0.45, { M: Ms, p: [0, 8.45, 0.2], c: '#d2d0cc', seg: 8, ky: 1.1 });                         // head
      slab('ashlar', Ms, -0.28, 0.28, 7.9, 8.3, 0.35, 0.68, SD);                                                  // beard
      cyl('ashlar', 0.38, 0.58, 0.4, 8, { M: mul(Ms, tr(0, 8.75, 0.15)), c: SD });                                 // turban
    }
    for (const sg of [-1, 1]) { slab('ashlar', F, sg * (PW / 2 + 0.6), sg * (W / 2 - 0.5), 9.45, 10.75, 0, 0.55, SD); for (let x = PW / 2 + 1.2; x < W / 2 - 0.8; x += 1.25) sphere('ashlar', 0.38, { M: F, p: [sg * x, 10.1, 0.55], c: ST, seg: 6 }); }
    const G = mul(F, tr(0, 0, -0.2));
    for (let y = yN + 0.1, i = 0; y < yN + 5.1; y += 0.72, i++) for (const sg of [-1, 1]) slab('rustic', G, sg * (W / 2 - (i & 1 ? 1.7 : 1.15)), sg * (W / 2 - 0.05), y, y + 0.5, 0, 0.34, ST);
    for (const x of [-2.9, 2.9]) { winP(G, x, yN + 0.9, 1.25, 2.5, 0.0, 0, '#d8ceb6', 'marble'); lathe('marble', [[0.55, 0], [0.4, 0.35], [0.02, 0.45]], 8, { M: mul(G, tr(x, yN + 3.65, 0.1)), c: '#d8ceb6' }); }
    slab('marble', G, -0.3, 0.3, yN + 1.3, yN + 2.7, 0, 0.3, '#ece7da'); sphere('marble', 0.28, { M: G, p: [0, yN + 2.95, 0.2], c: '#ece7da', seg: 6 });
    for (const a of [-1, 1]) plate('marble', G, [[a * 0.25, yN + 2.0], [a * 1.1, yN + 2.9], [a * 1.0, yN + 1.8], [a * 0.25, yN + 1.55]], 0, 0.18, '#ece7da');
    for (const x of [-5.9, 5.9]) { disc('marble', G, x, yN + 2.4, 0.75, 0, 0.18, '#e4ddca'); disc('marble', G, x, yN + 2.4, 0.4, 0.18, 0.08, '#c9bfa6'); }
  }
  // ---- towards the city
  {
    const F = faceOf(1), ST = '#cfc2ac', SD = '#b4a490';
    part('ashlar', shapeGeo(rectShape(W - 0.1, H1 - 0.8), 0.07, archPath(PW + 1.4, PH + 0.7)), { M: mul(F, tr(0, -0.6, 0)), c: '#bdaa94' });
    archRing('ashlar', F, 0, -0.6, PW, PH + 0.6, 0.75, 0, 0.35, SD);
    for (const sg of [-1, 1]) for (const x of [PW / 2 + 1.45, PW / 2 + 4.7]) {
      slab('ashlar', F, sg * x - 0.75, sg * x + 0.75, -0.5, 2.6, 0, 0.55, SD);
      pil('ashlar', F, sg * x, 2.6, 9.3, 1.0, 0.35, ST);
    }
    for (const sg of [-1, 1]) slab('marble', F, sg * 4.9, sg * 6.9, 7.6, 8.8, 0, 0.18, '#d6cfba');
    slab('ashlar', F, -W / 2 + 0.2, W / 2 - 0.2, 9.3, 10.9, 0, 0.3, ST);
    for (let x = -8.2; x <= 8.21; x += 0.82) slab('ashlar', F, x - 0.25, x + 0.25, 9.85, 10.4, 0.3, 0.45, SD);
    slab('marble', F, -1.0, 1.0, 9.35, 10.25, 0.3, 0.5, '#d6cfba');
    const G = mul(F, tr(0, 0, -0.2));
    slab('ashlar', G, -W / 2 + 0.2, W / 2 - 0.2, yN + 0.1, yN + 5.0, 0, 0.1, ST);
    for (const x of [-8.35, -4.85, -1.2, 1.2, 4.85, 8.35]) pil('ashlar', G, x, yN + 0.4, yN + 5.0, 0.6, 0.32, ST);
    for (const x of [-6.6, -3.05, 3.05, 6.6]) {
      disc('ashlar', G, x, yN + 2.7, 1.28, 0.1, 0.2, SD, 14); disc('ashlar', G, x, yN + 2.7, 1.05, 0.3, 0.06, '#d8ccb4', 14); disc('flat', G, x, yN + 2.7, 0.76, 0.34, 0.05, '#4a3a2c', 12);
      slab('marble', G, x - 0.45, x + 0.45, yN + 2.15, yN + 2.65, 0.35, 0.65, '#e6e0d0'); sphere('marble', 0.3, { M: G, p: [x, yN + 2.95, 0.55], c: '#e6e0d0', seg: 6, ky: 1.15 });
    }
  }
  for (const sg of [-1, 1]) box('ashlar', W + 0.8, 0.9, 1.0, { M: mul(M0, tr(0, H1 - 1.2, sg * (Dp / 2 - 0.1))), c: '#c2b09a' });
  box('ashlar', W + 1.0, 0.9, Dp + 1.0, { M: mul(M0, tr(0, H1 - 0.3, 0)), c: '#c8b6a0' });
  // second stage and its cornice
  box('ashlar', W - 0.4, 5.4, Dp - 0.4, { M: mul(M0, tr(0, H1 + 0.6, 0)), c: '#cfc0a6' });
  box('ashlar', W + 0.3, 0.45, Dp + 0.3, { M: mul(M0, tr(0, H1 + 5.55, 0)), c: '#dcc9a6' });
  // the loggia: five arches on the two faces and four on the flanks, on slender columns, the wall with its windows behind
  const LW = W - 2.0, LD = Dp - 2.0, yl = H1 + 6.2, LH = 5.7, IN = 1.35;
  slab('ashlar', M0, -LW / 2 + IN, LW / 2 - IN, yl, yl + LH, -LD / 2 + IN, LD / 2 - IN, '#efdcae');
  for (let q = 0; q < 4; q++) {
    const S = mul(M0, mul(rotY(q * PI / 2), tr(0, 0, LD / 2))), n = q & 1 ? 4 : 5, span = LW - 0.4, bw = span / n;
    for (let i = 0; i <= n; i++) {
      const x = -span / 2 + i * bw;
      if (!(q & 1) || (i > 0 && i < n)) { cyl('marble', 0.15, 0.19, 3.6, 8, { M: mul(S, tr(x, yl + 0.2, -0.1)), c: '#f0ece0' }); slab('marble', S, x - 0.27, x + 0.27, yl + 3.8, yl + 4.1, -0.36, 0.16, '#f0ece0'); }
    }
    for (let i = 0; i < n; i++) {
      const x0 = -span / 2 + i * bw, x1 = x0 + bw, c = (x0 + x1) / 2, r = Math.min(1.4, bw / 2 - 0.2), y0 = yl + 4.1;
      const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(c - r, y0); s.absarc(c, y0 - 0.25, r, PI - Math.asin(Math.min(1, 0.25 / r)), Math.asin(Math.min(1, 0.25 / r)), true); s.lineTo(c + r, y0); s.lineTo(x1, y0); s.lineTo(x1, yl + 5.4); s.lineTo(x0, yl + 5.4);
      part('ashlar', coarse(s, 0.4), { M: mul(S, tr(0, 0, -0.3)), c: '#dcc59c' });
      slab('ashlar', S, x0 - 0.16, x0 + 0.16, yl + 4.7, yl + 5.05, 0.1, 0.24, '#c4ac86');
      const I = mul(S, tr(0, 0, -IN)), wx = c * (LW - 2 * IN - 0.4) / span;
      slab('ashlar', I, wx - 0.95, wx + 0.95, yl + 0.5, yl + 2.9, 0, 0.12, '#c9984c');
      slab('flat', I, wx - 0.62, wx + 0.62, yl + 0.6, yl + 2.5, 0.1, 0.16, '#4a3a30', { noao: true });
      slab('flat', I, wx - 0.04, wx + 0.04, yl + 0.6, yl + 2.5, 0.16, 0.19, '#d8cfb8', { noao: true });
      segPed('ashlar', I, wx, yl + 3.05, 2.3, 0.55, 0, 0.28, '#b98c4a'); slab('ashlar', I, wx - 0.2, wx + 0.2, yl + 3.15, yl + 3.6, 0.28, 0.4, '#cdb48c');
    }
    slab('ashlar', S, -LW / 2 - 0.15, LW / 2 + 0.15, yl + 5.4, yl + LH, -0.6, 0.15, '#dcc9a6');
    ledge('ashlar', S, -LW / 2 - 0.2, LW / 2 + 0.2, yl + LH, 0.6, 0.5, '#d2b992');
    // balustrades: on the ledge under the loggia and above its cornice, with the posts and balls
    const E = mul(M0, mul(rotY(q * PI / 2), tr(0, 0, Dp / 2 - 0.25)));
    balus(mul(E, tr(0, H1 + 6.0, 0)), W - 0.6, 1.1);
    balus(mul(S, tr(0, yl + LH + 0.6, 0.35)), LW + 0.6, 1.0);
    for (let i = 0; i < 4; i++) { const x = -LW / 2 - 0.3 + i * (LW + 0.6) / 4; slab('marble', S, x - 0.17, x + 0.17, yl + LH + 0.6, yl + LH + 1.75, 0.18, 0.52, '#e8e2d2'); sphere('marble', 0.24, { M: S, p: [x, yl + LH + 1.95, 0.35], c: '#e8e2d2', seg: 6 }); }
  }
  slab('flat', M0, -LW / 2, LW / 2, yl + LH + 0.4, yl + LH + 0.62, -LD / 2, LD / 2, '#a8846c');
  // the attic with its iron railing, the pyramid of glazed tiles, the platform, the lantern, the cupola and the finial
  const ya = yl + LH + 0.6, yp = ya + 1.7, PHt = 7.8, B0 = 5.1, B1 = 1.55;
  slab('ashlar', M0, -5.6, 5.6, ya, yp, -5.6, 5.6, '#d9b496');
  slab('ashlar', M0, -5.8, 5.8, yp - 0.25, yp, -5.8, 5.8, '#cda888');
  for (let q = 0; q < 4; q++) {
    const R = mul(M0, rotY(q * PI / 2)), P = [], U = [];
    balus(mul(R, tr(0, yp, 5.65)), 11.3, 0.9, { c: '#33343a' });
    for (let k = 0; k < 4; k++) {
      const t0 = k / 4, t1 = (k + 1) / 4, a = B0 + (B1 - B0) * t0, c = B0 + (B1 - B0) * t1, u = (x) => 0.5 + x / (2 * B0);
      for (const [x, t, h] of [[-a, t0, a], [a, t0, a], [c, t1, c], [-a, t0, a], [c, t1, c], [-c, t1, c]]) { P.push(x, yp + PHt * t, h); U.push(u(x), t); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
    part('majolica', g, { M: R, uv: 'keep', noao: true });
    box('flat', 0.22, Math.hypot(PHt, (B0 - B1) * Math.SQRT2), 0.22, { M: R, p: [B0, yp, B0], rx: -Math.atan((B0 - B1) / PHt), rz: Math.asin((B0 - B1) / Math.hypot(PHt, (B0 - B1) * Math.SQRT2)), c: '#c7a24a', noao: true });   // the ridge
  }
  const yt = yp + PHt;
  slab('ashlar', M0, -B1 - 0.15, B1 + 0.15, yt - 0.1, yt + 0.3, -B1 - 0.15, B1 + 0.15, '#d6c7a4');
  for (let q = 0; q < 4; q++) balus(mul(M0, mul(rotY(q * PI / 2), tr(0, yt + 0.3, B1 + 0.1))), 2 * B1 + 0.2, 0.8, { c: '#33343a' });
  cyl('ashlar', 1.1, 1.18, 2.4, 8, { M: mul(M0, tr(0, yt + 0.3, 0)), c: '#f0c860' });
  for (let k = 0; k < 8; k++) arched('flat', mul(M0, mul(rotY(k * PI / 4), tr(0, 0, 1.06))), 0, yt + 0.9, 0.5, 1.45, 0, 0.1, '#3a2e24');
  cyl('ashlar', 1.42, 1.25, 0.32, 8, { M: mul(M0, tr(0, yt + 2.7, 0)), c: '#e2c890' });
  lathe('flat', [[1.3, 0], [1.22, 0.55], [0.8, 1.15], [0.25, 1.5], [0.18, 1.8], [0.02, 1.9]], 8, { M: mul(M0, tr(0, yt + 3.0, 0)), c: '#b5b2a4', noao: true });
  box('flat', 0.1, 1.6, 0.1, { M: mul(M0, tr(0, yt + 4.7, 0)), c: '#b88a38', noao: true });
  sphere('flat', 0.22, { M: mul(M0, tr(0, yt + 5.2, 0)), c: '#c9a04a', seg: 6, noao: true });
  box('flat', 0.8, 0.3, 0.08, { M: mul(M0, tr(0, yt + 6.0, 0)), c: '#b88a38', noao: true });          // the gilded eagle on the spire
  ctx.skip.add(b.id);
}

// One pylon of Porta Felice. M: the frame at its centre, local +z towards the sea; s: the side of local x (+1 or -1) that faces the street between the two.
function pylon(M, s) {
  const W = 11.6, D = 11.0, hw = W / 2, hd = D / 2;
  const LAND = '#cbc6cc', LAND2 = '#b4b0b8', TRIM = '#e4e0e4', GREY = '#c6c6c2', GREY2 = '#b2b2ac', WHITE = '#e8e4da', IRON = '#38352f';
  slab('ashlar', M, -hw, hw, -0.4, 11.0, -hd, hd, LAND);
  const round = (y0, y1, out, c) => slab('ashlar', M, -hw - out, hw + out, y0, y1, -hd - out, hd + out, c);
  round(-0.4, 0.8, 0.2, LAND2); round(3.85, 4.2, 0.28, TRIM); round(10.6, 11.2, 0.15, LAND2); round(11.2, 11.8, 0.55, TRIM);
  // the upper storey, over the half next to the street
  const UW = 6.2, ux = s * (hw - UW / 2 - 0.15);
  slab('ashlar', M, ux - UW / 2, ux + UW / 2, 11.8, 17.0, -hd + 0.4, hd - 0.4, LAND);
  slab('ashlar', M, ux - UW / 2 - 0.2, ux + UW / 2 + 0.2, 17.0, 17.35, -hd + 0.2, hd - 0.2, LAND2);
  slab('ashlar', M, ux - UW / 2 - 0.5, ux + UW / 2 + 0.5, 17.35, 17.85, -hd - 0.05, hd + 0.05, TRIM);
  for (const sz of [-1, 1]) {
    balus(mul(M, tr(ux, 17.85, sz * (hd - 0.45))), UW - 0.8, 1.0);
    balus(mul(M, tr(ux + sz * (UW / 2 - 0.1), 17.85, 0)), D - 1.4, 1.0, { ry: PI / 2 });
    for (const sx of [-1, 1]) {
      const x = ux + sx * (UW / 2 - 0.2), z = sz * (hd - 0.5);
      slab('marble', M, x - 0.35, x + 0.35, 17.85, 19.1, z - 0.35, z + 0.35, GREY);
      lathe('marble', [[0.18, 0], [0.38, 0.3], [0.1, 0.65], [0.28, 0.9], [0.02, 1.15]], 6, { M: mul(M, tr(x, 19.1, z)), c: GREY });
    }
  }
  // ---- towards the city: doors, windows, pilasters, balconies, the scroll on the outer shoulder
  {
    const G = mul(M, mul(rotY(PI), tr(0, 0, hd))), a = -s, X = (v) => a * v;
    for (const v of [4.9, 0.15, -4.9]) {
      pil('ashlar', G, X(v), 0.8, 3.85, 1.05, 0.25, LAND2);
      slab('ashlar', G, X(v) - 0.75, X(v) + 0.75, 4.2, 4.95, 0, 0.42, LAND2);
      pil('ashlar', G, X(v), 4.95, 10.6, 0.95, 0.3, TRIM);
    }
    for (const v of [2.5, -2.55]) {
      slab('ashlar', G, X(v) - 0.95, X(v) + 0.95, 0.8, 3.55, 0, 0.14, TRIM);
      slab('flat', G, X(v) - 0.68, X(v) + 0.68, -0.2, 3.25, 0.1, 0.18, '#2f3a30', { noao: true });
      winP(G, X(v), 6.25, 1.3, 2.5, 0, v > 0 ? 2 : 1, TRIM);
      slab('ashlar', G, X(v) - 1.0, X(v) + 1.0, 4.35, 5.5, 0, 0.12, TRIM);
    }
    slab('ashlar', G, X(2.5) - 1.25, X(2.5) + 1.25, 5.75, 6.0, 0, 0.85, TRIM);
    balus(mul(G, tr(X(2.5), 6.0, 0.8)), 2.4, 1.0, { c: IRON });
    disc('ashlar', G, X(2.5), 4.95, 0.58, 0.12, 0.14, LAND2, 12); disc('flat', G, X(2.5), 4.95, 0.36, 0.26, 0.04, '#2c2824', 12);
    balus(mul(G, tr(X(2.55), 11.8, 0.5)), 6.4, 1.0, { c: IRON });
    const U = mul(G, tr(0, 0, -0.4));
    for (const v of [5.3, -0.25]) pil('ashlar', U, X(v), 11.8, 17.0, 0.75, 0.22, TRIM);
    winP(U, X(2.5), 12.3, 1.3, 2.6, 0, 1, TRIM);
    const V = mul(G, tr(0, 0, -1.3));
    plate('ashlar', V, [[X(-0.5), 11.8], [X(-5.5), 11.8], [X(-5.5), 13.3], [X(-4.7), 13.5], [X(-4.2), 15.0, X(-3.0), 14.9], [X(-1.3), 15.0, X(-0.5), 16.9]], 0, 0.7, LAND);
    disc('ashlar', V, X(-3.0), 13.5, 1.3, 0.7, 0.2, TRIM, 14); disc('ashlar', V, X(-3.0), 13.5, 0.85, 0.9, 0.08, LAND2, 12); disc('ashlar', V, X(-3.0), 13.5, 0.35, 0.98, 0.12, TRIM, 8);
    disc('ashlar', V, X(-0.95), 16.5, 0.5, 0.55, 0.35, TRIM, 10);
    slab('ashlar', V, X(-5.75), X(-4.85), 11.8, 13.7, -0.1, 0.85, LAND2);
    sphere('ashlar', 0.36, { M: V, p: [X(-5.3), 14.1, 0.4], c: TRIM, seg: 6 });
  }
  // ---- towards the sea: the marble front, the outer wing, the attic with the eagle
  {
    const H = mul(M, tr(0, 0, hd)), X = (v) => s * v, C = 2.15;
    slab('marble', H, X(-1.45), X(5.85), -0.4, 10.6, 0, 0.35, GREY);
    slab('marble', H, X(-1.6), X(5.95), 10.6, 11.2, 0, 1.05, GREY);
    slab('marble', H, X(-1.75), X(6.1), 11.2, 11.8, 0, 1.3, WHITE);
    for (const v of [5.45, -1.05]) pil('marble', H, X(v), 4.3, 10.6, 0.65, 0.5, GREY2);
    for (const v of [4.35, -0.05]) {
      slab('marble', H, X(v) - 0.75, X(v) + 0.75, -0.3, 3.95, 0.3, 1.2, GREY2);
      slab('marble', H, X(v) - 0.9, X(v) + 0.9, 3.95, 4.35, 0.3, 1.35, WHITE);
      slab('marble', H, X(v) - 0.65, X(v) + 0.65, 4.35, 4.7, 0.3, 1.3, GREY);
      cyl('marble', 0.4, 0.5, 5.3, 10, { M: mul(H, tr(X(v), 4.7, 0.8)), c: '#bcbcb8' });
      lathe('marble', [[0.42, 0], [0.5, 0.1], [0.68, 0.4], [0, 0.4]], 8, { M: mul(H, tr(X(v), 10.0, 0.8)), c: WHITE });
      slab('marble', H, X(v) - 0.72, X(v) + 0.72, 10.35, 10.6, 0.3, 1.45, WHITE);
    }
    archRing('marble', H, X(C), 5.2, 2.0, 3.8, 0.3, 0.35, 0.22, WHITE);
    arched('flat', H, X(C), 5.2, 2.0, 3.8, 0.35, 0.04, '#5a564f');
    slab('marble', H, X(C) - 1.1, X(C) + 1.1, 4.5, 5.2, 0.35, 0.95, WHITE);
    statue('marble', mul(H, tr(X(C), 5.2, 0.62)), 2.7, { c: '#f4f1e8', cloak: '#ddd8cc' });
    slab('marble', H, X(C) - 1.4, X(C) + 1.4, 9.3, 10.4, 0.35, 0.55, WHITE);
    slab('flat', H, X(C) - 1.15, X(C) + 1.15, 9.45, 10.25, 0.55, 0.57, '#aaa494', { noao: true });
    slab('marble', H, X(C) - 1.35, X(C) + 1.35, 2.35, 3.8, 0.35, 0.55, WHITE);
    sphere('marble', 0.35, { M: H, p: [X(C), 2.0, 0.65], c: GREY2, seg: 6 });
    lathe('marble', [[0, 0], [0.45, 0.05], [0.4, 0.35], [1.3, 0.7], [1.3, 0.9], [1.1, 0.9], [0, 0.72]], 10, { M: mul(H, tr(X(C), 0.65, 1.15)), c: '#d4d0c4' });
    for (let i = 0; i < 3; i++) slab('marble', H, X(C) - 2.5 + i * 0.3, X(C) + 2.5 - i * 0.3, -0.4, 0.25 + i * 0.2, 0.3, 2.7 - i * 0.35, GREY2);
    slab('plaster', H, X(-5.8), X(-1.45), 0.8, 10.6, 0, 0.1, '#e8caad');
    slab('marble', H, X(-4.9), X(-2.5), 1.7, 2.9, 0.1, 0.22, WHITE);
    balus(mul(H, tr(X(-3.8), 11.8, 0.25)), 4.0, 1.1);
    slab('marble', H, X(-5.8), X(-4.7), 11.8, 13.4, -0.4, 0.55, GREY);
    statue('marble', mul(H, tr(X(-5.25), 13.4, 0.1)), 2.5, { c: WHITE });
    const A = mul(H, tr(0, 0, -0.4));
    balus(mul(A, tr(X(C), 11.8, 0.9)), 7.0, 1.0, { c: IRON });
    for (const v of [5.25, -0.35]) { pil('marble', A, X(v), 11.8, 17.0, 0.7, 0.25, GREY); disc('marble', A, X(v), 13.2, 0.8, 0, 0.45, WHITE, 12); disc('marble', A, X(v), 13.2, 0.4, 0.45, 0.1, GREY2, 10); }
    arched('flat', A, X(C), 12.0, 1.7, 1.7, 0, 0.12, '#2c2824');
    sphere('marble', 0.42, { M: A, p: [X(C), 13.8, 0.25], c: GREY, seg: 6 });
    for (const v of [3.85, 0.45]) { disc('marble', A, X(v), 14.0, 0.58, 0, 0.3, WHITE, 8); slab('marble', A, X(v) - 0.35, X(v) + 0.35, 14.5, 14.85, 0, 0.3, WHITE); }
    for (const a of [-1, 1]) plate('marble', A, [[X(C) + a * 0.35, 14.6], [X(C) + a * 1.3, 15.2], [X(C) + a * 2.35, 16.8], [X(C) + a * 1.75, 16.55], [X(C) + a * 1.7, 16.95], [X(C) + a * 1.15, 16.4], [X(C) + a * 0.95, 16.75], [X(C) + a * 0.35, 16.0]], 0.05, 0.3, '#e6d8c6');
    slab('marble', A, X(C) - 0.45, X(C) + 0.45, 14.2, 16.2, 0.05, 0.5, '#e6d8c6'); sphere('marble', 0.33, { M: A, p: [X(C), 16.5, 0.35], c: '#e6d8c6', seg: 6 });
    disc('marble', A, X(C), 14.4, 0.55, 0.45, 0.14, GREY, 10);
  }
  // ---- the two flanks
  for (const sg of [-1, 1]) {
    const S = mul(M, mul(rotY(sg * PI / 2), tr(0, 0, hw)));
    for (const x of [-hd + 0.75, hd - 0.75]) pil('ashlar', S, x, 4.95, 10.6, 0.95, 0.22, TRIM);
    winP(S, 0, 6.25, 1.3, 2.5, 0, 2, TRIM);
    slab('ashlar', S, -1.2, 1.2, 5.75, 6.0, 0, 0.7, TRIM); balus(mul(S, tr(0, 6.0, 0.65)), 2.3, 1.0, { c: IRON });
    if (sg === s) { balus(mul(S, tr(0, 11.8, 0.4)), D, 1.0, { c: IRON }); winP(mul(S, tr(0, 0, -0.15)), 0, 12.3, 1.3, 2.6, 0, 1, TRIM); }
  }
}
function buildPortaFelice(ctx) {
  CUR = 'Porta Felice';
  const pa = byId('r6309453.0'), pb = byId('r6309453.1');
  const n = [0.88, -0.47];       // along the Corso, towards the sea
  for (const [b, s] of [[pa, -1], [pb, 1]]) {   // (the first pylon is the northern one: the street is on its -x side)
    if (!b) continue;
    const pts = pairsOf(b.p), cen = centroid(pts); BASEY = 0;
    // the pylon box is 11.6 x 11 m across the Corso (nx, nz is its depth axis): its base is the lowest ground under the box, and a skirt hangs round it
    const tx = -n[1], tz = n[0], box4 = [[-5.8, -5.5], [5.8, -5.5], [5.8, 5.5], [-5.8, 5.5]].map(([u, v]) => [cen[0] + tx * u + n[0] * v, cen[1] + tz * u + n[1] * v]);
    let gy = Infinity; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) gy = Math.min(gy, groundY(cen[0] + tx * (-5.8 + 2.9 * i) + n[0] * (-5.5 + 2.75 * j), cen[1] + tz * (-5.8 + 2.9 * i) + n[1] * (-5.5 + 2.75 * j)));
    BASEY = gy; skirt('marble', box4, gy + 0.1, '#cfcbbd');
    pylon(frame(cen[0], gy, cen[1], n[0], n[1]), s);
    ctx.skip.add(b.id);
  }
}

// ====================================================================================================
// 6. San Cataldo
// ====================================================================================================
// Reference photos (Wikimedia Commons, looked at, nothing copied or stored): "Chiesa di San Cataldo in Palermo - 2007" (with the audit's renders for what was there).
// Built from it: the shallow stepped blind arches, their small grilled windows set high, the dark weathered foot, the arched door in the western bay of the side towards Piazza Bellini, the openwork cresting,
// the three red domes with their round grilled windows. Not verified: the other three sides repeat the same bay; the garden terrace is not modelled.
function paintScBay(g, w, h) {   // one bay, 4.3 x 12 m
  const Wm = 4.3, Hm = 12, sx = w / Wm, sy = h / Hm, X = (s) => s * sx, Y = (y) => h - y * sy;
  paintAshlar(g, w, h, Wm, Hm, 0.42, 0.8, '#b4a17c', '#776649', 151, 1.5, 0.11);
  const arch = (hw, y0, ys, f) => { g.beginPath(); g.moveTo(X(Wm / 2 - hw), Y(y0)); g.lineTo(X(Wm / 2 - hw), Y(ys)); g.quadraticCurveTo(X(Wm / 2 - hw), Y(ys + hw * 0.95), X(Wm / 2), Y(ys + hw * 1.12)); g.quadraticCurveTo(X(Wm / 2 + hw), Y(ys + hw * 0.95), X(Wm / 2 + hw), Y(ys)); g.lineTo(X(Wm / 2 + hw), Y(y0)); if (f) { g.fillStyle = f; g.fill(); } };
  for (const [hw, ys, f] of [[1.72, 8.6, 'rgba(70,52,28,0.14)'], [1.34, 8.5, 'rgba(70,52,28,0.13)']]) {
    arch(hw, 3.6, ys, f); g.strokeStyle = 'rgba(48,34,18,0.62)'; g.lineWidth = 3; g.stroke();
    g.save(); g.translate(3, 2); arch(hw, 3.6, ys); g.strokeStyle = 'rgba(240,222,180,0.4)'; g.lineWidth = 2; g.stroke(); g.restore();
  }
  arch(0.86, 6.7, 8.25, '#bba982'); arch(0.62, 6.9, 8.25, '#2c2822');
  g.save(); arch(0.62, 6.9, 8.25); g.clip(); g.strokeStyle = '#8c7a5a'; g.lineWidth = 1.6;
  for (let k = -12; k < 20; k++) { g.beginPath(); g.moveTo(X(1.3 + k * 0.22), Y(6.8)); g.lineTo(X(1.3 + k * 0.22 + 2.4), Y(9.4)); g.stroke(); g.beginPath(); g.moveTo(X(1.3 + k * 0.22), Y(9.4)); g.lineTo(X(1.3 + k * 0.22 + 2.4), Y(6.8)); g.stroke(); }
  g.restore();
  g.fillStyle = 'rgba(70,52,28,0.4)'; g.fillRect(0, Y(10.75), w, 0.12 * sy);
  const r_ = R_(153); for (let i = 0; i < 90; i++) { const y = r_() * r_() * 4.6; g.fillStyle = `rgba(30,24,16,${0.12 + r_() * 0.22 * (1 - y / 5)})`; g.fillRect(r_() * w, Y(y), 8 + r_() * 30, 6 + r_() * 18); }
  streaks(g, w, h, 18, 152, 0.18, 130);
}
function buildSanCataldo(ctx) {
  CUR = 'San Cataldo';
  const b = byId('w86870896'); if (!b) return;
  const pts = pairsOf(b.p), cen = centroid(pts), gy = minGround(pts); BASEY = gy;
  defMat('scWall', mkTex(256, 640, paintScBay), [4.3, 12]);
  const WH = 11.2, STC = '#b09c76';
  const ring = [pts[0], pts[2], pts[3], pts[4]];   // the four corners (the footprint's second point lies on the north side)
  for (let i = 0; i < ring.length; i++) {
    const e = edgeLR(ring, i), n = Math.max(1, Math.round(e.len / 4.3));
    wallQuad('scWall', e.L, e.R, gy - 0.8, gy + WH, [0, -0.8 / 12, n, WH / 12], '#ffffff');
    const M = frame((e.L[0] + e.R[0]) / 2, gy + WH, (e.L[1] + e.R[1]) / 2, e.nx, e.nz), h = e.len / 2;
    slab('ashlar', M, -h - 0.2, h + 0.2, -0.45, -0.2, -0.1, 0.22, STC); slab('ashlar', M, -h - 0.3, h + 0.3, -0.2, 0.15, -0.3, 0.32, '#bca882');
    balus(mul(M, tr(0, 0.15, 0.12)), e.len, 0.7, { c: '#9c8a68' });
    const k = Math.max(1, Math.round(e.len / 0.7));
    for (let q = 0; q <= k; q++) { const x = -h + q * e.len / k; cyl('ashlar', 0.02, 0.2, 0.36, 4, { M: mul(M, tr(x, 0.84, 0.12)), ry: PI / 4, c: STC }); }
  }
  roofPoly('flat', pts, gy + WH + 0.05, '#8a8478', { noao: true });
  // the door in the western bay of the side towards Piazza Bellini
  { const e = edgeLR(ring, 0), M = frame((e.L[0] + e.R[0]) / 2, gy, (e.L[1] + e.R[1]) / 2, e.nx, e.nz), x = e.len / 3;
    archRing('ashlar', M, x, 1.4, 1.5, 2.9, 0.3, 0, 0.16, '#c4b08a'); arched('flat', M, x, 1.4, 1.5, 2.9, 0.02, 0.06, '#5a3a26'); }
  // three red domes in a row along the long axis
  let ax = [1, 0], best = 0;
  for (let i = 0; i < pts.length; i++) { const e = edgeLR(pts, i); if (e.len > best) { best = e.len; ax = [(e.R[0] - e.L[0]) / e.len, (e.R[1] - e.L[1]) / e.len]; } }
  const ry = Math.atan2(-ax[1], ax[0]);
  for (let i = -1; i <= 1; i++) {
    const x = cen[0] + ax[0] * i * 3.9, z = cen[1] + ax[1] * i * 3.9, y = gy + WH;
    cyl('ashlar', 1.9, 1.95, 0.9, 12, { p: [x, y, z], c: '#a8946e' });
    lathe('red', [[1.92, 0], [1.97, 0.7], [1.85, 1.5], [1.45, 2.3], [0.85, 2.82], [0.25, 3.02], [0, 3.05]], 12, { p: [x, y + 0.9, z], c: '#ffffff' });
    for (let k = 0; k < 4; k++) { const R = mul(tr(x, y + 1.75, z), mul(rotY(ry + k * PI / 2 + PI / 4), tr(0, 0, 1.8))); disc('ashlar', R, 0, 0, 0.46, 0, 0.26, '#c4ac86', 10); disc('flat', R, 0, 0, 0.29, 0.26, 0.04, '#3a2e28', 8); }
    sphere('flat', 0.18, { p: [x, y + 4.05, z], c: '#8a7a5a', seg: 5, noao: true });
  }
  ctx.skip.add(b.id);
}


// ====================================================================================================
// 7. Santa Caterina: the front with the double stair on Piazza Bellini, the flank on Piazza Pretoria, the ribbed grey dome
// ====================================================================================================
// Reference photos (Wikimedia Commons, looked at, nothing copied or stored): "Santa Caterina (Palermo).JPG", "Palermo-Santa-Caterina-bjs2007-01", "Palermo, Santa Caterina - facciata",
// "Santa Caterina - Piazza Bellini - Palermo - Italy 2015" (and "(3)"), "Santa Caterina (Palermo) 17 07 2019 53", "Santa Caterina 2022 (Palermo) 01", "Palermo-AP-p1070457",
// "Santa Caterina and Fonte Pretoria - Palermo - Italy 2015", "Palermo-Piazza-Pretoria-bjs2007-01", "Palermo, Santa Caterina - cupola", "Santa Caterina (Palermo) - Dome exterior" (and "02"), "Santa Caterina 2022 (Palermo) 11".
// Built. Piazza Bellini: the stone basement, the double stair with its balustrades up to the landing, eight pilasters in pairs, the two small grated windows, the portal with its columns, scrolls, statue niche and
// pediment, the carved entablature, the narrower upper order with its framed window between two great volutes, the heavy upper cornice, the attic with its iron grille and the round crest with the cross.
// Piazza Pretoria: pink plaster between pale pilasters, windows with hoods, the portal with the curved pediment, the entablature, the higher nave set back with arched windows and scrolled buttresses, the transept
// front with its window, blank panels, volutes and balustrade. The dome: drum with windows and paired pilasters, the ring of urns, grey tiles between pale ribs, the lantern with its railing, cupola and cross.
// Not verified: heights are read off the photos with the 19 m front as the scale (about +-1 m); the east side and the north end, which the monastery and the neighbours hide, are left plain.
const SCA = { O: [124.15, 55.55], N: [0.226, 0.974] };   // the middle of the front on the OSM footprint (w49750065) and its outward direction
function paintScaDome(g, w, h) {   // one gore: small glazed tiles in greys and violets, a pale rib at the seam
  g.fillStyle = '#797370'; g.fillRect(0, 0, w, h);
  const r_ = R_(171);
  for (let y = 0, row = 0; y < h; y += 8, row++) for (let x = (row & 1) * 5 - 5; x < w; x += 10) {
    g.fillStyle = `hsl(${r_() < 0.5 ? 25 + r_() * 20 : 260 + r_() * 40},${3 + r_() * 6}%,${40 + r_() * 28}%)`; g.fillRect(x, y, 9, 7);
  }
  g.fillStyle = '#e4dac4'; g.fillRect(0, 0, 18, h); g.fillStyle = 'rgba(60,45,30,0.45)'; g.fillRect(18, 0, 3, h); g.fillRect(7, 0, 3, h);
  streaks(g, w, h, 8, 172, 0.16, 90);
}
function buildSantaCaterina(ctx) {
  CUR = 'Santa Caterina';
  const b = byId('w49750065'); if (!b) return;
  defMat('scaDome', mkTex(128, 256, paintScaDome), [1, 1]);
  const pts = pairsOf(b.p), { O, N } = SCA, gy = groundY(O[0] + N[0] * 3.5, O[1] + N[1] * 3.5); BASEY = gy;
  const M = frame(O[0], gy, O[1], N[0], N[1]);   // local x along the front (to the east), z out into Piazza Bellini
  const STONE = '#bfb0ac', STONE2 = '#a99c98', PALE = '#dedae0', CREAM = '#f1e8d0', PINK = '#e6c4ae', GLASS = '#34302e', TOP = 13.4;
  // ---- the lower storey on the footprint (its west side a straight line from the front corner to the north end)
  const ring = [0, 3, 5, 6, 7, 8, 9].map(i => pts[i]);
  for (let i = 0; i < ring.length; i++) { const e = edgeLR(ring, i); wallQuad('plaster', e.L, e.R, gy - 0.8, gy + TOP, [0, -0.2, e.len / 4, TOP / 4], i === 0 ? PINK : i === 1 ? CREAM : '#dfd2b4'); }
  roofPoly('flat', ring, gy + TOP, '#a5876e', { noao: true });
  // ---- the front: basement, the lower order, the entablature
  slab('ashlar', M, -9.6, 9.6, -0.8, 3.2, -0.1, 0.22, '#b4b8c4');
  ledge('ashlar', M, -9.55, 9.55, 2.95, 0.45, 0.45, '#c8c8d0');
  for (const x of [-8.85, -7.1, -4.95, -3.15, 3.15, 4.95, 7.1, 8.85]) pil('ashlar', M, x, 3.4, 12.0, 0.8, 0.28, STONE);
  for (const sg of [-1, 1]) {
    slab('ashlar', M, sg * 2.6, sg * 9.45, 6.15, 6.4, 0, 0.1, STONE);
    winP(M, sg * 6.05, 7.35, 0.9, 1.35, 0, 2, STONE);
    slab('flat', M, sg * 1.5 - 0.4, sg * 1.5 + 0.4, 12.2, 12.85, 0.22, 0.28, GLASS, { noao: true });
  }
  slab('ashlar', M, -9.55, 9.55, 12.0, 13.05, -0.1, 0.22, STONE2);
  for (let x = -8.6; x <= 8.61; x += 1.72) if (Math.abs(x) > 2.4 || Math.abs(x) < 0.5) slab('ashlar', M, x - 0.5, x + 0.5, 12.22, 12.72, 0.22, 0.31, PALE);
  for (let x = -9.35; x <= 9.36; x += 0.55) slab('ashlar', M, x - 0.12, x + 0.12, 12.82, 13.08, 0.22, 0.46, STONE);
  ledge('ashlar', M, -9.6, 9.6, 13.05, 0.6, 0.75, STONE);
  // ---- the portal: the door in its arch, a column on each side, the entablature, the two scrolls and the niche with the saint
  slab('ashlar', M, -2.5, 2.5, 3.2, 8.75, 0, 0.1, STONE2);
  archRing('ashlar', M, 0, 3.2, 2.6, 5.15, 0.32, 0.1, 0.22, PALE);
  arched('flat', M, 0, 3.2, 2.6, 5.15, 0.1, 0.06, '#654231');
  for (const y of [3.35, 4.35, 5.35, 6.35]) slab('flat', M, -1.28, 1.28, y, y + 0.09, 0.16, 0.19, '#3f291f', { noao: true });
  for (const x of [-0.65, 0, 0.65]) slab('flat', M, x - 0.04, x + 0.04, 3.2, 7.4, 0.16, 0.2, '#3f291f', { noao: true });
  for (const sg of [-1, 1]) {
    slab('ashlar', M, sg * 1.72, sg * 2.42, 3.2, 4.15, 0, 0.7, STONE);
    cyl('ashlar', 0.2, 0.24, 4.15, 8, { M: mul(M, tr(sg * 2.07, 4.15, 0.42)), c: PALE });
    slab('ashlar', M, sg * 1.75, sg * 2.4, 8.3, 8.75, 0, 0.72, PALE);
    plate('ashlar', M, [[sg * 0.78, 9.55], [sg * 2.55, 9.55], [sg * 1.5, 9.65, sg * 1.25, 10.6], [sg * 0.78, 10.6]], 0.05, 0.35, PALE);
    disc('ashlar', M, sg * 1.3, 10.25, 0.34, 0.05, 0.45, STONE);
    sphere('ashlar', 0.2, { M, p: [sg * 2.35, 9.95, 0.3], c: PALE, seg: 6 });
  }
  slab('ashlar', M, -2.55, 2.55, 8.75, 9.25, 0, 0.7, STONE);
  ledge('ashlar', M, -2.55, 2.55, 9.25, 0.32, 0.85, PALE);
  slab('ashlar', M, -0.82, 0.82, 9.55, 11.55, 0, 0.32, PALE);
  arched('flat', M, 0, 9.75, 1.05, 1.65, 0.3, 0.05, '#4a3c30');
  statue('plaster', mul(M, tr(0, 9.78, 0.52)), 1.35, { c: '#f6f2e6', cloak: '#ded6c4' });
  triPed('ashlar', M, 0, 11.55, 2.2, 0.62, 0, 0.45, PALE);
  // ---- the double stair: the landing before the door, a flight down to each side, balustrades along the front edge
  const LH = 3.2, LX = 2.15, SX = 9.85, SZ = 3.1, NS = 20, RUN = (SX - LX) / NS, RAIL = '#e8eaf0';
  slab('ashlar', M, -LX, LX, -0.8, LH, 0.1, SZ, '#cbd2e4');
  slab('ashlar', M, -1.5, 1.5, 0.55, 2.55, SZ, SZ + 0.05, '#b6bccc');
  slab('ashlar', M, -LX - 0.1, LX + 0.1, LH - 0.28, LH, SZ - 0.1, SZ + 0.14, RAIL);
  balus(mul(M, tr(0, LH, SZ)), 2 * LX, 0.95);
  slab('ashlar', M, -LX, LX, LH + 0.95, LH + 1.1, SZ - 0.15, SZ + 0.14, RAIL);
  for (const sg of [-1, 1]) {
    for (let i = 0; i < NS; i++) slab('ashlar', M, sg * (LX + i * RUN), sg * (LX + (i + 1) * RUN), -0.8, LH * (NS - i) / (NS + 1), 0.1, SZ, i & 1 ? '#c6cde0' : '#d4dbee');
    slopeBalus(M, sg * LX, LH, sg * SX, 0.16, 0.95, SZ + 0.02);
    const a = Math.atan2(0.16 - LH, SX - LX);
    box('ashlar', Math.hypot(SX - LX, LH - 0.16), 0.16, 0.28, { M, p: [sg * (LX + SX) / 2, (LH + 0.16) / 2 + 0.93, SZ], rz: sg * a, c: RAIL });
    for (const [x, y] of [[LX, LH], [(LX + SX) / 2, (LH + 0.16) / 2], [SX, 0.16]]) slab('ashlar', M, sg * x - 0.18, sg * x + 0.18, y - 0.4, y + 1.2, SZ - 0.17, SZ + 0.19, RAIL);
  }
  // ---- the upper order: four pilasters, the window in its frame, the volutes down to their pedestals
  slab('plaster', M, -5.4, 5.4, TOP, 21.4, -2.4, -0.2, CREAM);
  const U = mul(M, tr(0, 0, -0.2));
  ledge('ashlar', U, -5.45, 5.45, 13.65, 0.45, 0.4, STONE);
  for (const x of [-4.85, -3.05, 3.05, 4.85]) pil('ashlar', U, x, 14.1, 20.1, 0.65, 0.22, STONE);
  slab('ashlar', U, -1.35, 1.35, 15.8, 19.2, 0, 0.14, PALE);
  slab('flat', U, -0.75, 0.75, 16.2, 18.7, 0.12, 0.18, GLASS, { noao: true });
  for (const x of [-0.25, 0.25]) slab('flat', U, x - 0.035, x + 0.035, 16.2, 18.7, 0.18, 0.21, '#8a5a48', { noao: true });
  for (const y of [17.0, 17.85]) slab('flat', U, -0.75, 0.75, y, y + 0.07, 0.18, 0.21, '#8a5a48', { noao: true });
  for (const sg of [-1, 1]) {
    cyl('ashlar', 0.12, 0.15, 3.1, 6, { M: mul(U, tr(sg * 1.08, 16.0, 0.28)), c: STONE });
    slab('ashlar', U, sg * 0.85, sg * 1.35, 15.35, 15.8, 0, 0.45, STONE);
    plate('plaster', M, [[sg * 5.35, TOP], [sg * 8.35, TOP], [sg * 8.35, 15.3], [sg * 5.7, 15.7, sg * 5.35, 19.4]], -0.8, 0.45, CREAM);
    const q = (t) => { const u = 1 - t; return [sg * (u * u * 8.35 + 2 * u * t * 5.7 + t * t * 5.35), u * u * 15.3 + 2 * u * t * 15.7 + t * t * 19.4]; };
    for (let i = 0; i < 6; i++) { const A = q(i / 6), B = q((i + 1) / 6); box('ashlar', Math.hypot(B[0] - A[0], B[1] - A[1]) + 0.1, 0.24, 0.55, { M, p: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.08, -0.57], rz: Math.atan((B[1] - A[1]) / (B[0] - A[0])), c: STONE }); }
    disc('ashlar', M, sg * 5.75, 19.15, 0.46, -0.8, 0.68, STONE); disc('ashlar', M, sg * 7.95, 15.75, 0.42, -0.8, 0.68, STONE);
    slab('ashlar', M, sg * 8.15, sg * 9.5, TOP, 15.7, -1.1, 0.0, STONE);
    slab('ashlar', M, sg * 8.0, sg * 9.6, 15.7, 15.95, -1.2, 0.1, PALE);
  }
  ledge('ashlar', U, -1.5, 1.5, 19.2, 0.45, 0.5, STONE);
  slab('ashlar', M, -5.5, 5.5, 20.1, 21.35, -2.45, 0.0, STONE2);
  for (let x = -5.1; x <= 5.11; x += 0.51) { slab('ashlar', M, x - 0.13, x + 0.13, 20.3, 20.85, 0, 0.1, PALE); slab('ashlar', M, x - 0.12, x + 0.12, 21.05, 21.35, 0, 0.4, STONE); }
  ledge('ashlar', M, -5.65, 5.65, 21.35, 0.65, 0.8, STONE2);
  // the attic, the iron grille before it, the crest and the cross
  slab('plaster', M, -4.9, 4.9, 22.0, 23.75, -2.1, -0.85, '#e8dcc0');
  slab('ashlar', M, -5.1, 5.1, 23.75, 24.1, -2.25, -0.7, PALE);
  for (const y of [22.65, 23.35]) slab('flat', M, -5.5, 5.5, y, y + 0.06, 0.48, 0.52, '#3a3836', { noao: true });
  for (let x = -5.5; x <= 5.51; x += 0.5) slab('flat', M, x - 0.025, x + 0.025, 22.0, 23.45, 0.48, 0.52, '#3a3836', { noao: true });
  disc('ashlar', M, 0, 24.85, 0.78, -1.25, 0.4, PALE, 14); disc('ashlar', M, 0, 24.85, 0.5, -0.86, 0.08, STONE);
  for (const sg of [-1, 1]) sphere('ashlar', 0.32, { M, p: [sg * 0.85, 24.3, -1.05], c: PALE, seg: 6 });
  slab('flat', M, -0.04, 0.04, 25.55, 26.75, -1.1, -1.02, '#3a3430', { noao: true }); slab('flat', M, -0.35, 0.35, 26.25, 26.33, -1.1, -1.02, '#3a3430', { noao: true });
  // the wall of the monastery that rises beside the upper order on the east
  slab('plaster', M, 5.4, 9.3, TOP, 20.4, -3.2, -1.15, '#eadbb8');
  slab('ashlar', M, 5.4, 9.45, 20.4, 20.7, -3.3, -1.05, PALE);
  for (const [x, y] of [[7.0, 17.4], [6.4, 19.0], [8.2, 14.6]]) slab('flat', M, x - 0.45, x + 0.45, y, y + 0.95, -1.17, -1.11, GLASS, { noao: true });
  // ---- Piazza Pretoria: the flank
  const e = edgeLR(ring, 0), half = e.len / 2, W = frame((e.L[0] + e.R[0]) / 2, gy, (e.L[1] + e.R[1]) / 2, e.nx, e.nz);   // local x to the right seen from the piazza (towards the front)
  slab('ashlar', W, -half, half, -0.5, 2.7, -0.1, 0.16, '#c2c4cc');
  for (const s of [-34.5, -20.4, -7.6, 7.6, 20.4, 34.5]) pil('ashlar', W, s, 2.7, 12.0, 0.95, 0.26, '#e8e6e8');
  for (const [s, ped] of [[-27.4, 1], [-14.0, 2], [14.0, 2], [27.4, 1]]) winP(W, s, 5.6, 1.35, 1.9, 0, ped, PALE);
  slab('ashlar', W, -half, half, 12.0, 13.05, -0.1, 0.2, STONE);
  for (let s = -half + 1.2; s < half - 0.5; s += 1.4) slab('ashlar', W, s - 0.45, s + 0.45, 12.25, 12.8, 0.2, 0.3, STONE2);
  ledge('ashlar', W, -half, half, 13.05, 0.6, 0.75, STONE);
  archRing('ashlar', W, 0, 1.2, 3.0, 5.6, 0.45, 0, 0.3, STONE);
  arched('flat', W, 0, 1.2, 3.0, 5.6, 0.02, 0.1, '#6a4632');
  for (const x of [-0.75, 0, 0.75]) slab('flat', W, x - 0.045, x + 0.045, 1.2, 5.2, 0.12, 0.15, '#43291d', { noao: true });
  for (const sg of [-1, 1]) {
    slab('ashlar', W, sg * 2.0, sg * 2.8, 0.9, 2.4, 0, 0.65, STONE);
    cyl('ashlar', 0.22, 0.27, 4.9, 8, { M: mul(W, tr(sg * 2.4, 2.4, 0.38)), c: PALE });
  }
  slab('ashlar', W, -2.85, 2.85, 7.3, 8.15, 0, 0.62, STONE);
  segPed('ashlar', W, 0, 8.15, 6.2, 1.2, 0, 0.55, STONE); segPed('ashlar', W, 0, 8.4, 4.6, 0.82, 0.55, 0.08, PALE);
  disc('ashlar', W, 0, 9.0, 0.45, 0.55, 0.22, STONE2);
  // the nave, set back above the aisle roof, with its arched windows and the scrolled buttresses
  const NV = mul(W, tr(0, 0, -3.8));
  slab('plaster', W, -33.0, 33.6, TOP, 20.5, -17.0, -3.8, '#efddbb');
  slab('flat', W, -33.1, 33.7, 20.5, 20.75, -17.1, -3.7, '#b08670', { noao: true });
  ledge('ashlar', NV, -33.0, 33.6, 20.0, 0.55, 0.5, PALE);
  for (const sg of [-1, 1]) {
    for (const s of [13.9, 21.7, 29.4]) {
      archRing('ashlar', NV, sg * s, 15.7, 2.2, 3.0, 0.3, 0, 0.2, PALE); arched('flat', NV, sg * s, 15.7, 2.2, 3.0, 0.02, 0.08, GLASS);
      slab('ashlar', NV, sg * s - 1.5, sg * s + 1.5, 15.35, 15.65, 0, 0.3, PALE);
      slab('flat', NV, sg * s - 0.04, sg * s + 0.04, 15.7, 18.6, 0.1, 0.13, '#8d806c', { noao: true });
    }
    for (const s of [10.2, 17.8, 25.5]) {
      pil('ashlar', NV, sg * s, 14.0, 20.0, 0.7, 0.2, PALE);
      plate('ashlar', mul(NV, mul(tr(sg * s, 0, 0), rotY(-PI / 2))), [[0, TOP], [2.4, TOP], [2.4, 14.5], [0.5, 15.1, 0.3, 18.7], [0, 18.7]], -0.3, 0.6, '#d0ccd4');
      sphere('ashlar', 0.36, { M: NV, p: [sg * s, 14.85, 2.2], c: PALE, seg: 6 });
    }
  }
  // the transept front over the portal
  slab('plaster', W, -7.5, 7.5, TOP, 21.2, -3.9, -0.9, '#f6ecd2');
  const T = mul(W, tr(0, 0, -0.9));
  ledge('ashlar', T, -7.5, 7.5, 13.65, 0.4, 0.35, PALE);
  for (const sg of [-1, 1]) {
    for (const s of [7.05, 5.75]) pil('ashlar', T, sg * s, 14.05, 20.2, 0.6, 0.2, PALE);
    slab('plaster', T, sg * 2.2, sg * 4.9, 15.0, 19.4, -0.05, 0.07, '#eac3b0');
    plate('plaster', W, [[sg * 7.5, TOP], [sg * 10.1, TOP], [sg * 10.1, 14.5], [sg * 7.9, 14.9, sg * 7.5, 18.4]], -1.9, 0.45, '#f0e2c4');
    disc('ashlar', W, sg * 7.9, 18.05, 0.42, -1.9, 0.66, PALE); disc('ashlar', W, sg * 9.65, 14.65, 0.42, -1.9, 0.66, PALE);
    plate('ashlar', T, [[sg * 0.45, 19.45], [sg * 1.8, 19.45], [sg * 0.45, 20.15]], 0, 0.32, STONE);
    for (const s of [7.1, 2.7]) { lathe('ashlar', [[0.25, 0], [0.12, 0.3], [0.3, 0.65], [0.02, 1.05]], 6, { M: mul(T, tr(sg * s, 22.35, -0.35)), c: PALE }); }
  }
  winP(T, 0, 16.0, 1.5, 2.8, 0, 0, STONE);
  for (const sg of [-1, 1]) cyl('ashlar', 0.12, 0.15, 3.4, 6, { M: mul(T, tr(sg * 1.2, 15.7, 0.28)), c: STONE });
  slab('ashlar', T, -1.55, 1.55, 19.05, 19.45, 0, 0.45, STONE); sphere('ashlar', 0.34, { M: T, p: [0, 19.75, 0.2], c: PALE, seg: 6 });
  slab('ashlar', T, -7.55, 7.55, 20.2, 20.95, -0.3, 0.2, PALE); ledge('ashlar', T, -7.6, 7.6, 20.95, 0.55, 0.65, PALE);
  slab('plaster', W, -7.35, 7.35, 21.5, 22.35, -2.6, -1.1, '#f0e2c4');
  balus(mul(T, tr(0, 21.5, 0.05)), 14.6, 0.85); slab('ashlar', T, -7.4, 7.4, 22.35, 22.5, -0.15, 0.2, PALE);
  // the other flank, seen only over the roofs
  slab('plaster', M, 6.0, 9.0, TOP, 21.2, -42.0, -27.0, '#eadbb8');
  for (const sg of [-1, 1]) for (const s of [13.9, 21.7]) arched('flat', mul(M, mul(tr(7.0, 0, -34.5), rotY(PI / 2))), sg * s, 15.7, 2.0, 3.0, -0.2, 0.5, GLASS);
  // ---- the dome over the crossing
  const D = mul(M, tr(-0.3, 0, -34.5));
  slab('plaster', D, -6.3, 6.3, 20.5, 22.5, -6.3, 6.3, '#f0e2c4');
  slab('ashlar', D, -6.6, 6.6, 22.5, 22.85, -6.6, 6.6, PALE);
  balus(mul(D, mul(rotY(-PI / 2), tr(0, 22.85, 6.5))), 13.0, 0.8);
  cyl('plaster', 5.55, 5.55, 4.1, 16, { M: mul(D, tr(0, 22.85, 0)), c: '#f4e8cc' });
  for (let k = 0; k < 8; k++) {
    const R = mul(D, mul(rotY(k * PI / 4), tr(0, 0, 5.5))), Q = mul(D, mul(rotY(k * PI / 4 + PI / 8), tr(0, 0, 5.45)));
    archRing('ashlar', R, 0, 23.5, 1.2, 2.4, 0.28, 0, 0.18, PALE); arched('flat', R, 0, 23.5, 1.2, 2.4, 0, 0.1, GLASS);
    for (const sg of [-1, 1]) slab('ashlar', Q, sg * 0.14, sg * 0.55, 22.85, 26.9, 0, 0.36, PALE);
    lathe('ashlar', [[0.3, 0], [0.16, 0.35], [0.36, 0.75], [0.12, 1.05], [0.02, 1.3]], 6, { M: mul(Q, tr(0, 27.45, 0.45)), c: PALE });
  }
  cyl('ashlar', 6.2, 5.95, 0.55, 16, { M: mul(D, tr(0, 26.9, 0)), c: PALE });
  lathe('scaDome', [[5.6, 0], [5.6, 0.7], [5.3, 2.0], [4.55, 3.55], [3.4, 4.85], [2.2, 5.65], [1.5, 6.05]], 16, { M: mul(D, tr(0, 27.45, 0)), uv: 'keep', uvk: [16, 1], noao: true });
  cyl('ashlar', 1.9, 1.9, 0.35, 12, { M: mul(D, tr(0, 33.4, 0)), c: PALE });
  cyl('balus', 1.82, 1.82, 0.7, 12, { M: mul(D, tr(0, 33.75, 0)), open: true, uvk: [14, 1], noao: true });
  cyl('plaster', 1.22, 1.3, 3.0, 8, { M: mul(D, tr(0, 33.75, 0)), c: '#f4e8cc' });
  for (let k = 0; k < 8; k++) arched('flat', mul(D, mul(rotY(k * PI / 4), tr(0, 0, 1.14))), 0, 34.5, 0.5, 1.75, 0, 0.1, GLASS);
  cyl('ashlar', 1.65, 1.45, 0.35, 8, { M: mul(D, tr(0, 36.75, 0)), c: PALE });
  lathe('scaDome', [[1.45, 0], [1.25, 0.65], [0.75, 1.15], [0.2, 1.45]], 8, { M: mul(D, tr(0, 37.1, 0)), uv: 'keep', uvk: [8, 1], noao: true });
  sphere('ashlar', 0.33, { M: D, p: [0, 38.8, 0], c: '#c9ad6a', seg: 6 });
  slab('flat', D, -0.05, 0.05, 39.0, 40.3, -0.05, 0.05, '#3a3430', { noao: true }); slab('flat', D, -0.35, 0.35, 39.75, 39.85, -0.05, 0.05, '#3a3430', { noao: true });
  ctx.skip.add(b.id);
}


// ====================================================================================================
// 8. Palazzo dei Normanni: the Torre Pisana, at the north end of the front on Piazza del Parlamento (the rest of the front is in src/lmc-e.js)
// From the south: a lower bay of the same stone, two windows wide, as high as the long wing beside it; then the tower proper: three storeys of blind pointed arches under a plain parapet,
// the iron balcony on the base with its small pointed windows, and on top the observatory (pale blocks, one large dark dome, two small ones, the turret behind the lower bay).
// Photos: Wikimedia Commons "0564 - Palermo - Palazzo dei Normanni, facciata principale" (the tower square on); Mapillary 697550499410295, 1608338543216797 and 151123526886607 from the
// Villa Bonanno side (its place on the footprint, found from the bearings of the frames, and how it stands against the long wing). Not verified: the sides and back of the tower and the
// roof behind the parapet; the heights (read from the proportions of the photos).
// ====================================================================================================
function buildNormanni() {
  CUR = 'Palazzo dei Normanni';
  const b = byId('r395010.0'); if (!b) return;
  const pts = pairsOf(b.p); BASEY = minGround(pts);
  const P0 = [-684.1, 486.2], P1 = [-696.3, 459.9];   // the footprint edge north of the long wing, south to north
  const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), ux = (P1[0] - P0[0]) / L, uz = (P1[1] - P0[1]) / L, nx = -uz, nz = ux;
  const BW = 11.5, TC = BW + (L - BW) / 2, TW = L - BW, TH = 28, TD = 7;
  let gMax = -Infinity; for (const p of pts) gMax = Math.max(gMax, groundY(p[0], p[1]));
  const yt = gMax + 24.6, yBay = gMax + 19.7;   // the parapet; the lower bay's cornice, at the long wing's
  defMat('torre', mkTex(512, 512, (g, w, h) => {
    const sx = w / L, sy = h / TH, X = (m) => m * sx, Y = (d) => d * sy;   // u along the wall from the south end, d metres down from the tower's parapet
    paintAshlar(g, w, h, L, TH, 0.55, 1.25, '#bea985', '#8a765a', 181, 2, 0.1);
    const k = 1 / 52.6, U = (px) => TC + (px - 636) * k, D = (py) => (py - 210) * k;   // positions read off the square-on photograph, in its pixels
    const pointed = (u, hw, d0, d1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(X(u - hw), Y(d1)); g.lineTo(X(u - hw), Y(d0 + hw * 0.95)); g.quadraticCurveTo(X(u - hw), Y(d0 + hw * 0.25), X(u), Y(d0)); g.quadraticCurveTo(X(u + hw), Y(d0 + hw * 0.25), X(u + hw), Y(d0 + hw * 0.95)); g.lineTo(X(u + hw), Y(d1)); g.closePath(); g.fill(); };
    const blind = (u, hw, d0, d1) => { pointed(u, hw + 0.2, d0 - 0.22, d1, 'rgba(48,40,30,0.6)'); pointed(u, hw, d0 + 0.05, d1, '#bba680'); pointed(u, hw - 0.28, d0 + 0.45, d1, 'rgba(70,58,42,0.34)'); pointed(u, hw - 0.4, d0 + 0.62, d1, '#b29c77'); };
    const win = (x0, x1, y0, y1, o = {}) => { const u0 = U(x0), u1 = U(x1), d0 = D(y0), d1 = D(y1); if (o.shut) { g.fillStyle = '#2c2622'; g.fillRect(X(u0 - o.shut), Y(d0), X(u1 - u0 + 2 * o.shut), Y(d1 - d0)); }
      g.fillStyle = '#d9d2c2'; g.fillRect(X(u0), Y(d0), X(u1 - u0), Y(d1 - d0)); g.fillStyle = '#34383e'; g.fillRect(X(u0) + 1.5, Y(d0) + 1.5, X(u1 - u0) - 3, Y(d1 - d0) - 3); g.fillStyle = 'rgba(225,215,195,0.75)'; g.fillRect(X((u0 + u1) / 2) - 0.5, Y(d0), 1, Y(d1 - d0)); g.fillRect(X(u0), Y((d0 + d1) / 2), X(u1 - u0), 1); };
    const lancet = (x0, x1, y0, y1) => { pointed(U((x0 + x1) / 2), (x1 - x0) * k / 2 + 0.14, D(y0) - 0.14, D(y1) + 0.08, '#cdb995'); pointed(U((x0 + x1) / 2), (x1 - x0) * k / 2, D(y0), D(y1), '#2b2c30'); };
    const roundel = (x, y, r, hole) => { g.fillStyle = 'rgba(52,42,30,0.6)'; g.beginPath(); g.arc(X(U(x)), Y(D(y)), X(r * k), 0, 7); g.fill(); g.fillStyle = hole ? '#2a2826' : '#b39d76'; g.beginPath(); g.arc(X(U(x)), Y(D(y)), X(r * k) * 0.68, 0, 7); g.fill(); };
    // the top storey: three arches, the middle one the tallest, a window and a medallion in each; the string course under them
    for (const [x0, x1, y0] of [[252, 408, 340], [528, 738, 315], [855, 1008, 338]]) blind(U((x0 + x1) / 2), (x1 - x0) * k / 2, D(y0), D(572));
    win(297, 365, 450, 560); win(597, 670, 452, 562); win(900, 972, 445, 558); roundel(330, 410, 30); roundel(633, 408, 30); roundel(932, 405, 24, true);
    g.fillStyle = 'rgba(40,34,26,0.7)'; g.fillRect(X(BW), Y(D(568)), X(TW), Y(0.28)); g.fillStyle = '#cbb792'; g.fillRect(X(BW), Y(D(568) - 0.16), X(TW), Y(0.16));
    // the middle storey: three wide arches over their pilaster strips, small blind arches between them
    for (const [x0, x1, y0] of [[228, 448, 642], [515, 765, 635], [832, 1058, 640]]) blind(U((x0 + x1) / 2), (x1 - x0) * k / 2, D(y0), D(1032));
    for (const x of [484, 795]) blind(U(x), 0.45, D(652), D(748));
    lancet(316, 365, 730, 815); lancet(918, 968, 728, 808); roundel(340, 845, 22); roundel(944, 840, 22); roundel(640, 753, 32, true);
    win(285, 395, 888, 990, { shut: 0.42 }); win(888, 1008, 884, 985, { shut: 0.42 }); win(545, 738, 845, 980, { shut: 0.7 }); win(455, 500, 912, 988, { shut: 0.32 }); win(788, 832, 908, 983);
    // the lowest storey: an arch each side with a lancet, the door in the middle one
    for (const [x0, x1, y0] of [[262, 415, 1112], [548, 745, 1092], [882, 1035, 1105]]) blind(U((x0 + x1) / 2), (x1 - x0) * k / 2, D(y0), D(1330));
    lancet(316, 365, 1150, 1225); lancet(932, 978, 1140, 1218); roundel(646, 1140, 24); g.fillStyle = '#2c2620'; g.fillRect(X(U(598)), Y(D(1180)), X(95 * k), Y(D(1345) - D(1180))); win(606, 688, 1250, 1345);
    // the lower bay: its cornice 4.9 m under the parapet, two columns of arches and shuttered windows
    for (const u of [3.4, 8.9]) {
      blind(u, 1.25, 5.9, 8.9); g.fillStyle = '#2c2622'; g.fillRect(X(u - 1.15), Y(D(610)), X(2.3), Y(1.55)); g.fillStyle = '#34383e'; g.fillRect(X(u - 0.6), Y(D(610)), X(1.2), Y(1.55)); g.fillStyle = '#d9d2c2'; g.fillRect(X(u - 0.05), Y(D(610)), X(0.1), Y(1.55));
      pointed(u, 0.4, D(752), D(838), '#2b2c30'); blind(u, 1.35, 12.1, 17.6); g.fillStyle = '#33251d'; g.fillRect(X(u - 0.85), Y(13.7), X(1.7), Y(3.6)); g.fillStyle = 'rgba(15,10,8,0.6)'; g.fillRect(X(u) - 0.5, Y(13.7), 1, Y(3.6));
      blind(u, 1.35, 18.1, D(1340)); pointed(u, 0.68, D(1222), D(1338), '#2b2c30');
    }
    // the base under the balcony: darker courses, a row of pointed windows
    g.fillStyle = 'rgba(58,40,24,0.34)'; g.fillRect(0, Y(D(1340)), w, h - Y(D(1340)));
    for (const u of [2.2, 6.1, 10.0, U(318), U(466), U(652), U(838), U(988)]) { pointed(u, 0.76, D(1425), D(1545), '#a8906a'); pointed(u, 0.56, D(1438), D(1545), '#28211c'); }
    g.fillStyle = 'rgba(30,26,20,0.5)'; g.fillRect(X(BW), 0, X(TW), Y(0.18)); g.fillRect(0, Y(4.9), X(BW), Y(0.5)); g.fillStyle = 'rgba(40,30,20,0.3)'; g.fillRect(X(BW) - 1, Y(4.9), 2, h - Y(4.9));
    streaks(g, w, h, 50, 182, 0.22, h * 0.2);
  }), [L, TH]);
  const mx = (P0[0] + P1[0]) / 2, mz = (P0[1] + P1[1]) / 2, yb = Math.min(groundY(P0[0] + nx, P0[1] + nz), groundY(mx + nx, mz + nz), groundY(P1[0] + nx, P1[1] + nz)) - 1.0;
  const M = frame(mx, yb, mz, nx, nz), at = (u, y, z) => mul(M, tr(u - L / 2, y - yb, z));
  const q = (u) => [P0[0] + ux * u + nx * 0.22, P0[1] + uz * u + nz * 0.22], vAt = (y) => 1 - (yt - y) / TH;
  wallQuad('torre', q(0), q(BW), yb, yBay, [0, vAt(yb), BW / L, vAt(yBay)], '#ffffff');
  wallQuad('torre', q(BW), q(L), yb, yt, [BW / L, vAt(yb), 1, 1], '#ffffff');
  box('ashlar', TW, yt - yb, TD, { M: at(TC, yb, -TD / 2 + 0.2), c: '#b29e7c' });
  box('ashlar', TW + 0.3, 0.3, TD + 0.3, { M: at(TC, yt - 0.05, -TD / 2 + 0.2), c: '#c6b290' });
  box('ashlar', BW, 0.45, 0.75, { M: at(BW / 2, yBay - 0.25, 0.1), c: '#c9b491' });
  // the balcony along the top of the base, with its iron rail
  const yBal = yt - (1340 - 210) / 52.6;
  box('ashlar', L, 0.28, 0.75, { M: at(L / 2, yBal - 0.28, 0.5), c: '#a8957a' });
  box('flat', L, 0.07, 0.07, { M: at(L / 2, yBal + 0.95, 0.82), c: '#25232a' });
  for (let i = 0; i <= 24; i++) box('flat', 0.07, 0.95, 0.07, { M: at(0.1 + i * (L - 0.2) / 24, yBal, 0.82), c: '#25232a' });
  // the observatory on the roof
  const PALE = '#d9c3a2', DOME = '#33353c';
  const dome = (u, y, z, r) => lathe('flat', [[r, 0], [r * 0.97, r * 0.25], [r * 0.82, r * 0.55], [r * 0.52, r * 0.78], [0.01, r * 0.88]], 12, { M: at(u, y, z), c: DOME, noao: true });
  box('flat', 4.5, 1.7, 3.6, { M: at(TC - 5.7, yt + 0.2, -2.7), c: PALE });
  box('flat', 5.6, 1.9, 3.6, { M: at(TC + 5.0, yt + 0.2, -2.7), c: PALE });
  box('flat', 5.2, 0.75, 4.6, { M: at(TC - 0.6, yt + 0.2, -3.3), c: PALE });
  dome(TC - 0.65, yt + 0.95, -3.3, 2.45);
  dome(TC + 6.2, yt + 2.1, -2.2, 0.95);
  box('flat', 2.5, yt + 0.1 - yBay, 2.5, { M: at(BW - 1.3, yBay, -2.0), c: PALE });
  box('flat', 0.7, 1.4, 0.1, { M: at(BW - 1.3, yt - 2.0, -0.72), c: '#2c2a2c' });
  dome(BW - 1.3, yt + 0.1, -2.0, 1.1);
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
// The four fountains of the Quattro Canti, one at the foot of each facade: their centres, found as buildQuattroCanti finds the facades (the four concave arcs among the building
// vertices round the crossing), 2.15 m in front of each wall. [] when the buildings are not there.
function qcFountains() {
  const [cx, cz] = QC.C, { R, Rf } = QC, pts = [];
  for (const b of D.buildings) { const p = b.p; for (let i = 0; i < p.length; i += 2) if (Math.abs(Math.hypot(p[i] - cx, p[i + 1] - cz) - R) < 0.5) pts.push(Math.atan2(p[i + 1] - cz, p[i] - cx)); }
  if (pts.length < 8) return [];
  pts.sort((p, q) => p - q);
  const n = pts.length, T = 2 * Math.PI, gapOf = (a, b) => { let d = b - a; if (d < 0) d += T; return d; };
  let k0 = 0; for (let i = 0; i < n; i++) if (gapOf(pts[i], pts[(i + 1) % n]) > 0.45) { k0 = (i + 1) % n; break; }
  const clusters = []; let cur = [];
  for (let j = 0; j < n; j++) { const a = pts[(k0 + j) % n]; if (cur.length && gapOf(cur[cur.length - 1], a) > 0.45) { clusters.push(cur); cur = []; } cur.push(a); }
  if (cur.length) clusters.push(cur);
  const out = [];
  for (const cl of clusters) { if (cl.length < 3) continue; let a1 = cl[0], last = cl[0]; for (const a of cl) { a1 += gapOf(last, a); last = a; } const mid = (cl[0] + a1) / 2; out.push([cx + (Rf - 2.15) * Math.cos(mid), cz + (Rf - 2.15) * Math.sin(mid), mid]); }
  return out;
}
// the two candelabra before each front (4.35 m either side of its middle, 2.7 m out from the wall)
const qcCandelabra = () => qcFountains().flatMap(([, , a]) => [-1, 1].map(sg => [QC.C[0] + (QC.Rf - 2.7) * Math.cos(a) - sg * 4.35 * Math.sin(a), QC.C[1] + (QC.Rf - 2.7) * Math.sin(a) + sg * 4.35 * Math.cos(a)]));
const COLLISION = (() => {
  const out = {};
  // Quattro Canti: the four fountains are solid (the lowest step is 2.78 m in radius): the lapa, and the camera's line to it, used to go straight through the basins
  { const f = qcFountains(); if (f.length) out['Quattro Canti'] = [...f.flatMap(c => ringSegs(circleRing(c[0], c[1], 2.65, 12))), ...qcCandelabra().flatMap(c => ringSegs(circleRing(c[0], c[1], 0.32, 6)))]; }
  // Fontana Pretoria: the iron railing on the precinct (the mapped walls there leave gaps on two sides, and break), and the two older rings inside it (r 12.05 and 10.45): the fountain is not for driving in
  { const c = pretoriaCentre(); out['Fontana Pretoria'] = [...ringSegs(PRET.fence), ...ringSegs(circleRing(c[0], c[1], 12.05, 32)), ...ringSegs(circleRing(c[0], c[1], 10.45, 24))]; }
  // Teatro Massimo: the stair in front of the portico (24 risers of 16 cm over 10 m, a climb for people: the lapa's wheels are no bigger than the steps) with its cheek walls, and the two
  // pedestals of the lions beside its foot. The portico's podium and the rest of the building are inside the footprint, which has walls of its own.
  { const R = (x0, x1, z0, z1) => ringSegs(localRect(TEATRO.C, TEATRO.N[0], TEATRO.N[1], TEATRO.PX + x0, TEATRO.PX + x1, z0, z1));
    out['Teatro Massimo'] = [...R(-11.3, 11.3, 76.4, 86.8), ...R(-14.7, -9.7, 80.7, 86.9), ...R(9.7, 14.7, 80.7, 86.9)];
  }
  // Santa Caterina: the double stair on Piazza Bellini, one block along the front (the footprint has the front wall), and the pilasters and the portal that stand out from the flank on Piazza Pretoria
  { const O = [106.2, 23.6], n = [-0.969, 0.247];
    out['Santa Caterina'] = [...ringSegs(localRect(SCA.O, SCA.N[0], SCA.N[1], -10.05, 10.05, -0.1, 3.35)), ...ringSegs(localRect(O, n[0], n[1], -35.2, 35.2, -0.3, 0.45)), ...ringSegs(localRect(O, n[0], n[1], -3.0, 3.0, -0.3, 0.75))];
  }
  // Porta Nuova: the plinths and rusticated courses that stand out from the two faces of each pier (the piers themselves are in src/lmc-gates.js)
  out['Porta Nuova'] = [-1, 1].flatMap(sx => [-1, 1].flatMap(sz => ringSegs(localRect([-750.8, 395.6], 0.907, -0.42, ...[sx * 2.95, sx * 9.0].sort((p, q) => p - q), ...[sz * 8.8, sz * 9.55].sort((p, q) => p - q)))));
  // Porta Felice: the fountain basins, pedestals and steps at the foot of the two marble fronts, on the sea side (the pylons have their footprints' walls)
  out['Porta Felice'] = [[[870.4, -446.35], -1], [[881.2, -425.6], 1]].flatMap(([c, s]) => ringSegs(localRect(c, 0.88, -0.47, ...[-s * 1.1, s * 5.4].sort((p, q) => p - q), 5.4, 8.25)));
  // Cattedrale, the south porch: the block behind the three arches (21 m wide, 4.2 m deep) with the screen in front and the two pylons, one rectangle
  { const E = [0.891, -0.454], S = [0.454, 0.891], O = [-458, 152], px = O[0] - 31.5 * E[0] + 27.4 * S[0], pz = O[1] - 31.5 * E[1] + 27.4 * S[1];
    out['Cattedrale'] = ringSegs(localRect([px, pz], S[0], S[1], -11.9, 11.9, -4.3, 1.4)); }
  return out;
})();
const BUILD_AT = {
  'Quattro Canti': [0, 0, 60], 'Fontana Pretoria': [72, 26, 40], 'Palazzo delle Aquile': [85, 65, 50], 'Teatro Massimo': [-358, -491, 90], 'Cattedrale': [-456, 151, 110],
  'Porta Nuova': [-751, 396, 40], 'Porta Felice': [875, -436, 50], 'San Cataldo': [105, 106, 30], 'Santa Caterina': [119, 27, 42], 'Palazzo dei Normanni': [-700, 502, 120],
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
    if (name === 'Quattro Canti' && QC_LAMPS.length) { group.userData.lampPts = new Float32Array(QC_LAMPS); setTimeout(() => dispatchEvent(new Event('pd-lamps-changed')), 0); }
    window.__landmarkTris = { total: Math.round(Object.values(STATS).reduce((a, b) => a + b, 0)), per: STATS };
    window.__landmarkKeepout = KEEPOUT;
    if (location.search.includes('lmstats')) console.log('landmark', name, 'build ms', Math.round(performance.now() - t0), 'triangles', Math.round(tris));
    return group;
  },
}));
