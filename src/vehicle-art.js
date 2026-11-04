// Materials, procedural textures and paint schemes for the vehicle models. Owned by the driving work.
// Everything is drawn in code (canvas), no external image. Shared materials are created once; the livery-dependent
// ("painted") materials exist per vehicle type and are recoloured in place (local car) or cloned per livery (remote players).
import * as THREE from 'three';
import { freeCanvas } from './core.js';
import { PI, TAU, MAT_STAGE } from './vehicle-kit.js';
import { parseLivery } from './garage.js';

// ---------- canvas textures ----------
const rngOf = seed => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const artTex = (w, h, draw) => freeCanvas(canvasTex(w, h, draw), draw);   // this file's textures live for good, so they free their canvas after upload (the Garage makes and disposes its own with canvasTex)
const FOLK = { yellow: '#f2c200', red: '#d42a1f', blue: '#1c4fb8', green: '#1f9a4a', cream: '#fff0cf', orange: '#ec7a1c', dark: '#2a1a10' };
function flower(g, x, y, r, petal, centre, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU; g.fillStyle = petal; g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.4, r * 0.2, a, 0, TAU); g.fill();
  }
  g.fillStyle = centre; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
  g.fillStyle = FOLK.cream; g.beginPath(); g.arc(x, y, r * 0.12, 0, TAU); g.fill();
}
function scroll(g, x, y, r, col, dir) {
  g.strokeStyle = col; g.lineWidth = Math.max(2, r * 0.2); g.lineCap = 'round'; g.beginPath();
  for (let t = 0; t < 3.4 * PI; t += 0.12) { const rad = r * (1 - t / (3.8 * PI)); const px = x + dir * rad * Math.cos(t), py = y + rad * Math.sin(t); t === 0 ? g.moveTo(px, py) : g.lineTo(px, py); }
  g.stroke();
}
function teeth(g, x, y, w, h, n, c1, c2, down) {
  const tw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c1 : c2; g.beginPath();
    if (down) { g.moveTo(x + i * tw, y); g.lineTo(x + (i + 1) * tw, y); g.lineTo(x + (i + 0.5) * tw, y + h); }
    else { g.moveTo(x + i * tw, y + h); g.lineTo(x + (i + 1) * tw, y + h); g.lineTo(x + (i + 0.5) * tw, y); }
    g.fill();
  }
}
// Hand-painted folk-art panel in the spirit of the Sicilian cart: bright fields, scrolls, flowers, borders.
function folkPanel(g, w, h, seed) {
  const R = rngOf(seed), C = FOLK;
  g.fillStyle = C.yellow; g.fillRect(0, 0, w, h);
  const band = h * 0.14;
  g.fillStyle = C.red; g.fillRect(0, 0, w, band * 0.5); g.fillRect(0, h - band * 0.5, w, band * 0.5);
  teeth(g, 0, band * 0.5, w, band * 0.5, Math.round(w / 26), C.blue, C.cream, true);
  teeth(g, 0, h - band, w, band * 0.5, Math.round(w / 26), C.green, C.cream, false);
  const n = Math.max(2, Math.round(w / (h * 1.05))), pw = w / n, py = band * 1.15, ph = h - band * 2.3;
  const fields = [C.red, C.blue, C.green, C.orange], petals = [C.yellow, C.cream, C.orange, C.red];
  for (let i = 0; i < n; i++) {
    const x = i * pw + pw * 0.06, fw = pw * 0.88, f = (i + (R() * 4 | 0)) % 4;
    g.fillStyle = C.dark; g.fillRect(x - 3, py - 3, fw + 6, ph + 6);
    g.fillStyle = fields[f]; g.fillRect(x, py, fw, ph);
    g.strokeStyle = C.cream; g.lineWidth = 2; g.strokeRect(x + 5, py + 5, fw - 10, ph - 10);
    const cx = x + fw / 2, cy = py + ph / 2, r = Math.min(fw, ph) * 0.34;
    scroll(g, cx - r * 1.25, cy - r * 0.35, r * 0.55, C.cream, 1); scroll(g, cx + r * 1.25, cy + r * 0.35, r * 0.55, C.cream, -1);
    flower(g, cx, cy, r, petals[f], f === 1 ? C.red : C.blue, 8 + (i % 2) * 4);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? C.yellow : C.cream; g.beginPath(); g.arc(x + fw * (0.15 + 0.14 * k), py + ph * 0.1, 3, 0, TAU); g.arc(x + fw * (0.15 + 0.14 * k), py + ph * 0.9, 3, 0, TAU); g.fill(); }
    if (i < n - 1) {
      for (let k = 0; k < 4; k++) { const dx = x + fw + pw * 0.06, dy = py + ph * (0.12 + 0.25 * k); g.fillStyle = k % 2 ? C.red : C.blue; g.beginPath(); g.moveTo(dx, dy - 7); g.lineTo(dx + 6, dy); g.lineTo(dx, dy + 7); g.lineTo(dx - 6, dy); g.fill(); }
    }
  }
}
export const T_FOLK_REAR = artTex(512, 200, (g, w, h) => folkPanel(g, w, h, 11));
export const T_FOLK_CAB = artTex(384, 190, (g, w, h) => folkPanel(g, w, h, 29));
export const T_CHECK = artTex(64, 64, g => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#fdfbf2' : '#1c4fb8'; g.fillRect(x * 32, y * 32, 32, 32); } }, [1, 12]);
export const T_CANVAS = artTex(128, 128, (g, w, h) => {
  const R = rngOf(5); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.05})`; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.06})`; g.fillRect(R() * w, R() * h, 2, 2); }
}, [2, 2]);
export const T_WOOD = artTex(256, 128, (g, w, h) => {
  const R = rngOf(3), n = 6, sh = h / n;
  for (let i = 0; i < n; i++) {
    const l = 36 + R() * 8; g.fillStyle = `hsl(28,62%,${l}%)`; g.fillRect(0, i * sh, w, sh);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,30,10,${0.08 + R() * 0.1})`; g.fillRect(0, i * sh + R() * sh, w, 1); }
    g.fillStyle = 'rgba(255,230,170,0.22)'; g.fillRect(0, i * sh + 2, w, 3);
    g.fillStyle = '#2e1a0c'; g.fillRect(0, i * sh, w, 2);
  }
});

// ---------- sticker atlas (original designs) ----------
// 1024 x 512. Rects in pixels: [x, y, w, h]. Alpha-tested decals, so the edges stay crisp (PS2 look).
export const STK = {
  palermo: [0, 0, 1024, 200],
  stripe: [0, 210, 1024, 110],
  sun: [0, 330, 256, 180],        // Trinacria-like generic sun: disc, rays, three bent legs
  flames: [270, 330, 750, 180],
  chequer: [0, 520, 1024, 110],   // chequered stripe
  numero: [0, 640, 128, 128],     // race-number roundel
  taxi: [140, 640, 300, 110],     // roof sign lettering
};
const ATLAS_H = 768;
const PINK = '#f27aa8', PINK_D = '#b83a6e', INK = '#16101a';
let _stk = null;
export function stickerAtlas() {
  if (_stk) return _stk;
  _stk = artTex(1024, ATLAS_H, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    // PALERMO: chunky italic block letters, pink with a black outline and a pink drop
    { const [x, y, w, h] = STK.palermo; g.save(); g.translate(x + w / 2, y + h / 2);
      g.font = `italic 900 150px "Racing Sans One","Barlow Condensed",Impact,"Arial Black",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.transform(1, 0, -0.18, 1, 0, 0);
      g.lineWidth = 26; g.strokeStyle = INK; g.strokeText('PALERMO', 6, 8);
      g.lineWidth = 22; g.strokeStyle = INK; g.strokeText('PALERMO', 0, 0);
      g.fillStyle = PINK; g.fillText('PALERMO', 0, 0);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-w / 2, -h / 2, w, h * 0.38);
      g.restore(); }
    // rosanero stripe: pink, thin ink, pink, with a hard edge
    { const [x, y, w, h] = STK.stripe;
      g.fillStyle = PINK; g.fillRect(x, y, w, h * 0.42); g.fillStyle = INK; g.fillRect(x, y + h * 0.42, w, h * 0.16); g.fillStyle = PINK; g.fillRect(x, y + h * 0.58, w, h * 0.42); }
    // sun with legs: an original "three legs and a sun" mark (no face), gold on ink
    { const [x, y, w, h] = STK.sun, cx = x + w / 2, cy = y + h / 2, R = h * 0.46;
      g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.strokeStyle = '#ffc928'; g.lineWidth = 7; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { // three legs spiralling out of the middle, each a bent limb with a foot
        const a = i * TAU / 3 - PI / 2; g.save(); g.translate(cx, cy); g.rotate(a);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(R * 0.28, -R * 0.1, R * 0.5, R * 0.2); g.quadraticCurveTo(R * 0.66, R * 0.42, R * 0.84, R * 0.28); g.stroke();
        g.fillStyle = '#ffc928'; g.beginPath(); g.ellipse(R * 0.88, R * 0.3, R * 0.1, R * 0.05, 0.4, 0, TAU); g.fill(); g.restore();
      }
      g.fillStyle = '#ffc928'; g.beginPath(); g.arc(cx, cy, R * 0.2, 0, TAU); g.fill();
      g.strokeStyle = PINK; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.fillStyle = PINK; g.beginPath(); g.moveTo(cx + Math.cos(a - 0.08) * R * 1.02, cy + Math.sin(a - 0.08) * R * 1.02); g.lineTo(cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R * 1.2); g.lineTo(cx + Math.cos(a + 0.08) * R * 1.02, cy + Math.sin(a + 0.08) * R * 1.02); g.fill(); } }
    // flames licking backwards (to the left of the decal = towards the tail when read left to right)
    { const [x, y, w, h] = STK.flames;
      const tongue = (x0, y0, len, hh, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x0, y0 + hh);
        g.bezierCurveTo(x0 + len * 0.35, y0 + hh * 0.9, x0 + len * 0.55, y0 + hh * 0.4, x0 + len, y0); g.bezierCurveTo(x0 + len * 0.7, y0 + hh * 0.5, x0 + len * 0.8, y0 + hh * 0.9, x0 + len * 0.45, y0 + hh * 1.05);
        g.lineTo(x0, y0 + hh * 1.05); g.closePath(); g.fill(); };
      for (let k = 0; k < 4; k++) { const yy = y + h * (0.06 + k * 0.2), len = w * (0.94 - k * 0.07);
        tongue(x, yy, len, h * 0.34, '#d6261a'); tongue(x, yy + h * 0.04, len * 0.8, h * 0.26, '#ff8a1c'); tongue(x, yy + h * 0.08, len * 0.55, h * 0.18, '#ffe45a'); } }
    // chequered stripe: two rows of black and white squares, ink edges
    { const [x, y, w, h] = STK.chequer, n = Math.round(w / (h / 2));
      const sq = w / n; g.fillStyle = INK; g.fillRect(x, y, w, h);
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) { g.fillStyle = (i + r) % 2 ? '#f6f3ee' : INK; g.fillRect(x + i * sq, y + r * (h / 2) + 3, sq, h / 2 - 6); }
      g.fillStyle = PINK; g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3); }
    // race number roundel: white disc, ink ring, pink 69-free number "77"
    { const [x, y, w, h] = STK.numero, cx = x + w / 2, cy = y + h / 2, R = w * 0.47;
      g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.fillStyle = '#f6f3ee'; g.beginPath(); g.arc(cx, cy, R * 0.86, 0, TAU); g.fill();
      g.font = `italic 900 ${Math.round(R * 1.15)}px "Racing Sans One","Barlow Condensed",Impact,"Arial Black",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText('77', cx, cy + 3); g.fillStyle = PINK; g.fillText('77', cx, cy + 3); }
    // roof sign lettering
    { const [x, y, w, h] = STK.taxi;
      g.font = `900 ${Math.round(h * 0.95)}px "Racing Sans One","Barlow Condensed",Impact,"Arial Black",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = INK; g.fillText('TAXI', x + w / 2, y + h / 2 + 4); }
  });
  return _stk;
}
// uv rect of a sticker: [u0, v0, u1, v1] (canvas y runs down, flipY makes v run up)
export const stkUV = key => { const [x, y, w, h] = STK[key]; return [x / 1024, 1 - (y + h) / ATLAS_H, (x + w) / 1024, 1 - y / ATLAS_H]; };

// soft rounded glow for the underglow decal on the road
export const GLOW_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// ---------- shared materials ----------
const std = (c, r = 0.5, m = 0, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const tiny = m => { m.userData.noShadow = true; return m; };
export const MAT = {
  chrome: tiny(std('#e4e8ec', 0.25, 0.6)), gold: tiny(std('#d9a62e', 0.3, 0.8)), alu: tiny(std('#a9aeb4', 0.4, 0.6)),
  glass: tiny(new THREE.MeshStandardMaterial({ color: '#8fb4c8', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false })),
  tint: tiny(new THREE.MeshStandardMaterial({ color: '#0d1218', roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.82, depthWrite: false })),
  plastic: tiny(new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })),
  tyre: std('#1a1a1c', 0.9), white: tiny(std('#f3f1e8', 0.7)), seat: std('#efe6cf', 0.8), dark: tiny(std('#1d1c1e', 0.8)), black: tiny(std('#0f0f12', 0.55, 0.2)),
  floor: std('#3a3430', 0.9),
  lamp: tiny(new THREE.MeshStandardMaterial({ color: '#fff7dc', emissive: '#ffe9a8', emissiveIntensity: 0.55, roughness: 0.2 })),
  tail: tiny(new THREE.MeshStandardMaterial({ color: '#a01410', emissive: '#6a0a06', emissiveIntensity: 0.5, roughness: 0.4 })),
  wood: std('#ffffff', 0.45, 0, { map: T_WOOD }),
  orange: tiny(std('#ee8a1c', 0.7)), lemon: tiny(std('#e6d23a', 0.7)), leaf: tiny(std('#3f8a3a', 0.8)),
  sticker: tiny(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
};
MAT.sticker.map = stickerAtlas();
for (const m of [MAT.glass, MAT.tint, MAT.plastic, MAT.lamp, MAT.tail, MAT.sticker, MAT.seat, MAT.wood, MAT.orange, MAT.lemon, MAT.leaf]) MAT_STAGE.set(m, 1);
const colMats = new Map();
export const colMat = (c, r = 0.8, m = 0) => { const k = `${c}|${r}|${m}`; let x = colMats.get(k); if (!x) { x = std(c, r, m); x.userData.noShadow = true; colMats.set(k, x); } return x; };

// neon: self-lit tube material per colour (toneMapped off so it stays saturated), plus the additive glow decal on the road
const neonTube = new Map(), neonGlow = new Map();
function neonColor(hex) { return new THREE.Color(hex); }
export function neonMats(id, hex) {
  let t = neonTube.get(id);
  if (!t) {
    t = tiny(new THREE.MeshBasicMaterial({ color: neonColor(hex), toneMapped: false }));
    const g = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: neonColor(hex), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    MAT_STAGE.set(t, 1);
    neonTube.set(id, t); neonGlow.set(id, g);
  }
  return { tube: t, glow: neonGlow.get(id) };
}
// call once per frame: the rainbow neon walks round the hue wheel (shared by every vehicle wearing it)
export function tickShared(t) {
  const n = neonTube.get('arcobaleno'); if (!n) return;
  n.color.setHSL((t * 0.35) % 1, 1, 0.55); neonGlow.get('arcobaleno').color.copy(n.color);
}

// ---------- paint ----------
// Calessino: its seven painted materials (original liveries). Other vehicles: body + trim.
const LIV_CAL = {
  blu:      { body: '#1d4fd0', arch: '#1d4fd0', roof: '#f3efe4', door: '#f3efe4', pillar: '#1d4fd0', cab: '#1d4fd0', rear: 'wood' },
  bianco:   { body: '#f1efe8', arch: '#f1efe8', roof: '#7a1830', door: '#7a1830', pillar: '#f1efe8', cab: '#f1efe8', rear: 'wood' },
  carretto: { body: '#f0c000', arch: '#d42a1f', roof: '#74182c', door: '#74182c', pillar: 'check', cab: 'folk', rear: 'folk' },
  rosanero: { body: '#f08cb4', arch: '#17131a', roof: '#17131a', door: '#17131a', pillar: '#17131a', cab: '#f08cb4', rear: 'wood' },
  verde:    { body: '#2f7a52', arch: '#2f7a52', roof: '#f3efe4', door: '#f3efe4', pillar: '#2f7a52', cab: '#2f7a52', rear: 'wood' },
  rosso:    { body: '#c42f2a', arch: '#c42f2a', roof: '#f3efe4', door: '#25262a', pillar: '#c42f2a', cab: '#c42f2a', rear: 'wood' },
  nero:     { body: '#25262a', arch: '#25262a', roof: '#d8c28a', door: '#d8c28a', pillar: '#25262a', cab: '#25262a', rear: 'wood' },
};
const PAINT = {
  cassone: { verde: ['#4f8a55', '#ece6d0'], azzurro: ['#6aa7d8', '#f1efe8'], giallo: ['#f0c92a', '#2f2f33'], rosanero: ['#f08cb4', '#17131a'], rosso: ['#c9342a', '#ece6d0'], arancio: ['#ee7a1e', '#2f2f33'], crema: ['#efe2bf', '#7a2b2b'] },
  lapa50: { bianco: ['#f1efe8', '#2a63b0'], rosso: ['#c9342a', '#f1efe8'], azzurro: ['#6aa7d8', '#f1efe8'], rosanero: ['#f08cb4', '#17131a'], verde: ['#4f8a55', '#f1efe8'], giallo: ['#f0c92a', '#2a63b0'], nero: ['#25262a', '#c9a23a'] },
  vespa: { menta: ['#8fd0b0', '#5a3d2b'], crema: ['#efe2bf', '#7a2b2b'], rosso: ['#c42f2a', '#222225'], azzurro: ['#5aa0d8', '#e8e2cc'], rosanero: ['#f08cb4', '#17131a'], nero: ['#25262a', '#c9a23a'], giallo: ['#f0c92a', '#222225'], bianco: ['#f2f0ea', '#c42f2a'] },
  scooterone: { grigio: ['#8e949b', '#1b1b1e'], nero: ['#25262a', '#1b1b1e'], perla: ['#f2f0ea', '#25252a'], rosso: ['#c42f2a', '#1b1b1e'], rosanero: ['#f08cb4', '#17131a'], blu: ['#1d3f8a', '#1b1b1e'], verde: ['#2f6b4a', '#d8d0b8'], oro: ['#c9a23a', '#1b1b1e'] },
  motorino: { nero: ['#2a2b2e', '#c9a23a'], rosso: ['#c42f2a', '#1f1f22'], arancio: ['#ee7a1e', '#1f1f22'], verde: ['#9ad12e', '#1f1f22'], rosanero: ['#f08cb4', '#17131a'], bianco: ['#f2f0ea', '#c42f2a'], blu: ['#1d4fd0', '#1f1f22'], viola: ['#7a3bc0', '#1f1f22'] },
  sulky: { baio: ['#7a4a2a', '#e04a2a'], sauro: ['#a8582a', '#f2c200'], morello: ['#26262a', '#f27aa8'], grigio: ['#aaaaaa', '#1d6fd0'] },
  tascia: { viola: ['#7a3bc0', '#1b1320'], arancio: ['#f07a14', '#1b1b1e'], giallo: ['#f2d020', '#1b1b1e'], nero: ['#1b1b20', '#c9a23a'], rosanero: ['#f08cb4', '#17131a'], rosso: ['#c9342a', '#1b1b1e'], azzurro: ['#2aa6e0', '#1b1b20'], bianco: ['#f2f0ea', '#1b1b20'] },
};
const makeSet = type => {
  if (type === 'calessino') {
    const m = { body: std('#1d4fd0', 0.32, 0.15), arch: std('#1d4fd0', 0.32, 0.15), cab: std('#1d4fd0', 0.32, 0.15), rear: std('#ffffff', 0.45), roof: std('#f3efe4', 0.9), door: std('#f3efe4', 0.9), pillar: std('#1d4fd0', 0.32, 0.15) };
    m.roof.map = m.door.map = T_CANVAS; m.roof.side = THREE.DoubleSide; m.arch.side = THREE.DoubleSide;
    return m;
  }
  const gloss = type === 'tascia' ? [0.18, 0.5] : type === 'motorino' ? [0.4, 0.2] : [0.34, 0.25];
  return { body: std('#888888', gloss[0], gloss[1]), trim: std('#222222', 0.7) };
};
const sets = {};
export const paintedSet = type => { if (!sets[type]) { sets[type] = makeSet(type); for (const k in sets[type]) MAT_STAGE.set(sets[type][k], 1); } return sets[type]; };
export function paintSet(type, set, id) {
  const cu = parseLivery(id);   // a custom colour: body and details picked in the garage
  if (type === 'calessino') {
    const L = cu ? { body: cu.body, arch: cu.body, roof: cu.trim || '#f3efe4', door: cu.trim || '#f3efe4', pillar: cu.body, cab: cu.body, rear: 'wood' } : LIV_CAL[id]; if (!L) return false;
    const paint = (m, c, map) => { m.color.set(map ? '#ffffff' : c); if (m.map !== (map || null)) { m.map = map || null; m.needsUpdate = true; } };
    paint(set.body, L.body); paint(set.arch, L.arch);
    paint(set.roof, L.roof, T_CANVAS); set.roof.color.set(L.roof); paint(set.door, L.door, T_CANVAS); set.door.color.set(L.door);
    L.pillar === 'check' ? paint(set.pillar, null, T_CHECK) : paint(set.pillar, L.pillar);
    L.cab === 'folk' ? paint(set.cab, null, T_FOLK_CAB) : paint(set.cab, L.cab);
    paint(set.rear, null, L.rear === 'folk' ? T_FOLK_REAR : T_WOOD);
    return true;
  }
  const p = cu ? [cu.body, cu.trim || Object.values(PAINT[type] || {})[0][1]] : PAINT[type] && PAINT[type][id]; if (!p) return false;
  set.body.color.set(p[0]); set.trim.color.set(p[1]);
  return true;
}
// a private copy of the painted materials for one livery (remote players): Map(base material -> copy)
const clones = new Map();
export function clonedSet(type, id) {
  const k = type + '|' + id; let m = clones.get(k);
  if (!m) {
    const base = paintedSet(type), copy = {}; m = new Map();
    for (const key in base) { copy[key] = base[key].clone(); m.set(base[key], copy[key]); }
    paintSet(type, copy, id);
    clones.set(k, m);
  }
  return m;
}
