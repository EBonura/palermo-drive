// Drawn fronts of the pubs (src/pubs.js places them on the real facade). Everything is procedural: a canvas texture for the wall of the ground floor and
// for each sign, a handful of vertex-coloured solids (frames, lanterns, air-conditioners, bins) merged into one mesh, additive glow sprites. About 6 draw
// calls and 1 to 3 MB of texture per venue, and a venue is only visible within a few hundred metres (src/pubs.js hides the rest).
//
// Frame of a front: origin on the wall at the pavement under the door, +x to the right as seen from the street, +y up, +z out into the street.
//   buildFront(kind) -> { group, update(night 0..1, open bool, t seconds), dispose() }
// The photos these are drawn from are listed in docs/pubs.md (reference only, nothing is copied from them).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const hex = h => new THREE.Color(h);
const rnd = (() => { let s = 12345; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texOf(c, aniso = 4) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
function speck(g, w, h, n, a, dark = '#000', light = '#fff') {
  for (let i = 0; i < n; i++) { g.fillStyle = (i & 1 ? dark : light); g.globalAlpha = a * (0.4 + rnd() * 0.6); g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.globalAlpha = 1;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const [c, g] = canvas(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}

// Collects the pieces of one front
class Front {
  constructor() {
    this.group = new THREE.Group(); this.parts = []; this.owned = []; this.lights = []; this.signs = []; this.pools = []; this.hooks = [];
    this.solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }); this.owned.push(this.solidMat);
  }
  // solids: x, z centre, y bottom
  box(x, y, z, w, h, d, color) { return this.push(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), color); }
  cyl(x, y, z, r, h, color, seg = 10, r2 = r) { return this.push(new THREE.CylinderGeometry(r2, r, h, seg).translate(x, y + h / 2, z), color); }
  push(g, color) {
    g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
    const c = hex(color), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.parts.push(g); return this;
  }
  // a textured rectangle on the wall: y bottom, z the plane's depth. kind 'wall' is lit by the sun and the lamps, 'lit' is a shop interior that glows
  quad(tex, x, y, z, w, h, o = {}) {
    const mat = o.basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.alpha, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough ?? 0.9, transparent: !!o.alpha, emissive: o.glow ? '#ffffff' : '#000000', emissiveMap: o.glow ? tex : null, emissiveIntensity: 0 });
    if (o.offset) { mat.polygonOffset = true; mat.polygonOffsetFactor = -o.offset; mat.polygonOffsetUnits = -o.offset; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y + h / 2, z); if (o.ry) m.rotation.y = o.ry;
    this.group.add(m); this.owned.push(mat, tex, m.geometry);
    if (o.glow) this.signs.push({ mat, k: o.glow }); if (o.name) this[o.name] = m;
    return m;
  }
  // a soft light: sprite on the wall (lantern halo) with a night-dependent opacity
  light(x, y, z, size, color, k = 1) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false });
    const s = new THREE.Sprite(mat); s.scale.set(size, size, 1); s.position.set(x, y, z); this.group.add(s); this.owned.push(mat);
    this.lights.push({ mat, k }); return s;
  }
  // warm pool of light on the pavement in front of the door
  pool(x, z, r, color, k = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), mat); m.position.set(x, 0.05, z); m.renderOrder = 2; this.group.add(m); this.owned.push(mat, m.geometry);
    this.pools.push({ mat, k }); return m;
  }
  finish() {
    if (this.parts.length) { const g = mergeGeometries(this.parts); this.parts.length = 0; const m = new THREE.Mesh(g, this.solidMat); m.castShadow = false; this.group.add(m); this.owned.push(g); }
    return this;
  }
  update(night, open, t) {
    for (const s of this.signs) { s.mat.emissiveIntensity = s.k * night; }
    for (const l of this.lights) l.mat.opacity = Math.min(1, l.k * night * (0.92 + 0.08 * Math.sin(t * 11 + l.k * 7)));
    for (const p of this.pools) p.mat.opacity = p.k * night;
    for (const h of this.hooks) h(night, open, t);
  }
  dispose() { for (const o of this.owned) o.dispose?.(); }
}

// ---------------------------------------------------------------------------------------------------------------------------------- Krust
// Via Dante 19: a plain late-19th-century ground floor, cream stucco with rustication over a base of grey rough-cut stone, a band of green and cream tiles
// above, one recessed doorway in a dusty pink frame with a dark green roller shutter and a small square sign over it, two black lanterns, two air
// conditioners and two green wheelie bins. By day the shutter is down and the place looks shut; at night it is up on a dark doorway with an amber floor.
function krustSign() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#ededed'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
  g.strokeStyle = '#a9a9a9'; g.lineWidth = 2; g.strokeRect(14, 14, 228, 228);
  // the red sun and gear: a ring of teeth, a disc, a white spiral cut out of it
  g.save(); g.translate(128, 92);
  g.fillStyle = '#b01e23';
  for (let i = 0; i < 16; i++) { g.save(); g.rotate(i / 16 * TAU); g.beginPath(); g.moveTo(-7, -50); g.lineTo(7, -50); g.lineTo(10, -66); g.lineTo(-10, -66); g.closePath(); g.fill(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 52, 0, TAU); g.fill();
  g.strokeStyle = '#ededed'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
  for (let a = 0; a < 3.2 * TAU; a += 0.15) { const r = 4 + a * 3.4, x = Math.cos(a) * r, y = Math.sin(a) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke(); g.restore();
  // KRUST in rough brush capitals
  g.fillStyle = '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = 'KRUST', xs = [58, 92, 128, 164, 198];
  for (let i = 0; i < 5; i++) { g.save(); g.translate(xs[i], 198 + (i % 2 ? 3 : -3)); g.rotate((i - 2) * 0.05); g.font = '900 ' + (i === 2 ? 66 : 62) + 'px Impact, "Arial Black", sans-serif'; g.scale(0.88, 1); g.fillText(L[i], 0, 0); g.restore(); }
  g.strokeStyle = '#141414'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 232); g.lineTo(216, 229); g.stroke();
  speck(g, 256, 256, 500, 0.35, '#555', '#fff');
  return texOf(c, 8);
}
function krustWall() {
  const PX = 100, W = 6.2, H = 4.7, [c, g] = canvas(W * PX, H * PX), y = m => (H - m) * PX, x = m => (m + W / 2) * PX;
  g.fillStyle = '#e4d5b8'; g.fillRect(0, 0, W * PX, H * PX); speck(g, W * PX, H * PX, 5000, 0.12, '#8a7a5c', '#fff4dc');
  // rustication of the ground floor: courses every 45 cm, a shadow line under each
  for (let m = 0.8; m < 3.7; m += 0.45) { g.fillStyle = 'rgba(120,100,70,.28)'; g.fillRect(0, y(m) - 1, W * PX, 3); g.fillStyle = 'rgba(255,248,230,.25)'; g.fillRect(0, y(m) + 2, W * PX, 2); }
  // grey rough-cut base course, 80 cm, either side of the pink frame
  for (const [a, b] of [[-W / 2, -1.62], [1.62, W / 2]]) {
    g.fillStyle = '#8c877f'; g.fillRect(x(a), y(0.8), (b - a) * PX, 0.8 * PX);
    let row = 0; for (let m = 0; m < 0.8; m += 0.4, row++) { for (let u = a - (row ? 0.45 : 0); u < b; u += 0.9) { g.strokeStyle = '#5f5a54'; g.lineWidth = 2; g.strokeRect(x(u) + 1, y(m + 0.4) + 1, 0.9 * PX - 2, 0.4 * PX - 2); } }
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = i & 1 ? 'rgba(60,56,50,.35)' : 'rgba(200,196,188,.3)'; const u = rnd() < 0.5 ? rnd() * (W / 2 - 1.62) : W / 2 + 1.62 + rnd() * (W / 2 - 1.62); g.fillRect(u * PX, y(rnd() * 0.8), 2, 2); }
  // the frieze of green and cream tiles over the first storey line
  g.fillStyle = '#d9ceb0'; g.fillRect(0, y(4.35), W * PX, 0.36 * PX);
  for (let u = 0; u < W * PX; u += 24) { g.fillStyle = '#3f7a5a'; g.fillRect(u + 3, y(4.31), 18, 0.28 * PX); g.fillStyle = '#e9e2c6'; g.beginPath(); g.moveTo(u + 12, y(4.25)); g.lineTo(u + 18, y(4.17)); g.lineTo(u + 12, y(4.09)); g.lineTo(u + 6, y(4.17)); g.closePath(); g.fill(); }
  // inside of the frame: lighter stucco
  g.fillStyle = '#ecdfc6'; g.fillRect(x(-1.32), y(3.82), 2.64 * PX, 3.82 * PX);
  return texOf(c);
}
function krustShutter() {
  const [c, g] = canvas(220, 280);
  g.fillStyle = '#2f4a38'; g.fillRect(0, 0, 220, 280);
  for (let m = 0; m < 280; m += 7) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, m + 4, 220, 3); g.fillStyle = 'rgba(190,230,200,.12)'; g.fillRect(0, m, 220, 1.5); }
  g.fillStyle = '#1a2a20'; g.fillRect(0, 268, 220, 12); g.fillStyle = '#9a9a92'; g.fillRect(100, 250, 20, 6);
  speck(g, 220, 280, 600, 0.25, '#000', '#9ab8a0');
  return texOf(c);
}
function krustDoorway() {   // the shutter up: a dark doorway, an amber floor, a red glow at the back (the bar)
  const [c, g] = canvas(220, 280), gr = g.createLinearGradient(0, 0, 0, 280);
  gr.addColorStop(0, '#120808'); gr.addColorStop(0.55, '#2a0e0c'); gr.addColorStop(0.85, '#7a3a14'); gr.addColorStop(1, '#d28a3a');
  g.fillStyle = gr; g.fillRect(0, 0, 220, 280);
  g.fillStyle = 'rgba(200,30,30,.35)'; g.fillRect(70, 70, 80, 120);                       // red light of the bar
  for (let i = 0; i < 7; i++) { g.fillStyle = ['#c8a050', '#7a2a1a', '#3a6a3a'][i % 3]; g.globalAlpha = 0.55; g.fillRect(78 + i * 11, 96 + (i % 2) * 14, 7, 20); } g.globalAlpha = 1;   // bottles
  return texOf(c);
}

function buildKrust() {
  const F = new Front();
  const wall = krustWall();
  F.quad(wall, 0, 0, 0.03, 6.2, 4.7, { offset: 2, glow: 0.22 });
  // the dusty pink frame (3D, 8 cm proud) round the doorway and the little lip under the sign
  const PK = '#c99aa0', fw = 0.3;
  F.box(-1.45, 0, 0.07, fw, 4.1, 0.1, PK); F.box(1.45, 0, 0.07, fw, 4.1, 0.1, PK); F.box(0, 3.8, 0.07, 3.2, fw, 0.1, PK);
  F.box(0, 2.82, 0.06, 2.35, 0.1, 0.08, '#b98a90');                              // lintel of the shutter box
  // shutter and, at night, the doorway behind it
  const door = F.quad(krustDoorway(), 0, 0, 0.1, 2.2, 2.8, { basic: true, name: 'doorway' }), shut = F.quad(krustShutter(), 0, 0, 0.13, 2.2, 2.8, { offset: 1, name: 'shutter' });
  F.box(-1.12, 0, 0.14, 0.06, 2.8, 0.1, '#243a2c'); F.box(1.12, 0, 0.14, 0.06, 2.8, 0.1, '#243a2c');
  // the sign: a 80 cm square plate
  F.box(0, 3.08, 0.1, 0.9, 0.9, 0.05, '#c9c9c9');
  F.quad(krustSign(), 0, 3.13, 0.14, 0.8, 0.8, { glow: 0.28, offset: 1 });
  // lanterns
  for (const sx of [-1, 1]) {
    const lx = sx * 2.05;
    F.box(lx, 2.2, 0.12, 0.08, 0.5, 0.08, '#171717'); F.box(lx, 2.28, 0.22, 0.2, 0.34, 0.2, '#101010'); F.box(lx, 2.62, 0.22, 0.26, 0.05, 0.26, '#101010'); F.box(lx, 2.3, 0.33, 0.14, 0.26, 0.02, '#ffcf7a');
    F.light(lx, 2.45, 0.42, 1.9, '#ffb15a', 0.9);
  }
  // two air conditioners on the wall
  for (const sx of [-1, 1]) { const ax = sx * 2.5; F.box(ax, 3.35, 0.2, 0.95, 0.55, 0.3, '#e8e8e4'); F.cyl(ax - sx * 0.1, 3.4, 0.37, 0.2, 0.04, '#34363a', 14); F.box(ax, 3.72, 0.25, 0.9, 0.04, 0.34, '#cfcfca'); }
  // two green wheelie bins at the door (street side)
  for (const bx of [1.05, 1.7]) { F.box(bx, 0, 0.5, 0.55, 0.95, 0.62, '#2f6a45'); F.box(bx, 0.95, 0.5, 0.6, 0.07, 0.68, '#27583a'); }
  F.pool(0, 1.5, 3.4, '#ff9a42', 0.55);
  F.hooks.push((night, open) => { door.visible = open; shut.visible = !open; });
  return F.finish();
}

const BUILDERS = { krust: buildKrust };

export function buildFront(kind) {
  const b = BUILDERS[kind]; if (!b) return null;
  const F = b();
  return { group: F.group, update: (n, o, t) => F.update(n, o, t), dispose: () => F.dispose() };
}
