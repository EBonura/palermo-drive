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
  // street furniture (rotated about y by ry)
  place(g, x, y, z, ry, color) { if (ry) g.rotateY(ry); return this.push(g.translate(x, y, z), color); }
  chair(x, z, ry, color = '#1c1c1e') {
    const c = Math.cos(ry), s = Math.sin(ry), W = (a, b) => [x + a * c + b * s, z - a * s + b * c];   // local (a right, b forward) -> world
    this.place(new THREE.BoxGeometry(0.42, 0.05, 0.42), x, 0.45, z, ry, color);
    const [bx, bz] = W(0, -0.2); this.place(new THREE.BoxGeometry(0.42, 0.45, 0.04), bx, 0.7, bz, ry, color);
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const [lx, lz] = W(a, b); this.cyl(lx, 0, lz, 0.015, 0.45, color, 5); }
    return this;
  }
  table(x, z, r = 0.38, h = 0.74, color = '#2a2420', top = '#cfc8b8') { this.cyl(x, 0, z, 0.03, h, color, 6); this.cyl(x, h, z, r, 0.035, top, 14); this.cyl(x, 0, z, 0.2, 0.03, color, 8); return this; }
  parasol(x, z, color = '#e8dfc6', r = 1.5, y = 2.3) {
    this.cyl(x, 0, z, 0.025, y, '#c8c4bc', 6); this.push(new THREE.ConeGeometry(r, 0.45, 8).translate(x, y + 0.22, z), color); this.cyl(x, y + 0.42, z, 0.03, 0.12, '#c8c4bc', 5);
    return this;
  }
  sphere(x, y, z, r, color) { return this.push(new THREE.SphereGeometry(r, 14, 10).translate(x, y + r, z), color); }
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
  const [c, g] = canvas(512, 512); g.scale(2, 2);   // drawn on a 256 grid, 1.8 m on the wall
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
  const PX = 100, W = 6.6, H = 5.7, [c, g] = canvas(W * PX, H * PX), y = m => (H - m) * PX, x = m => (m + W / 2) * PX;
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
  g.fillStyle = '#d9ceb0'; g.fillRect(0, y(5.45), W * PX, 0.36 * PX);   // the frieze sits above the big sign, level with the top of the frame
  for (let u = 0; u < W * PX; u += 24) { g.fillStyle = '#3f7a5a'; g.fillRect(u + 3, y(5.41), 18, 0.28 * PX); g.fillStyle = '#e9e2c6'; g.beginPath(); g.moveTo(u + 12, y(5.35)); g.lineTo(u + 18, y(5.27)); g.lineTo(u + 12, y(5.19)); g.lineTo(u + 6, y(5.27)); g.closePath(); g.fill(); }
  // inside of the frame: lighter stucco
  g.fillStyle = '#ecdfc6'; g.fillRect(x(-1.32), y(4.9), 2.64 * PX, 4.9 * PX);
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
  F.quad(wall, 0, 0, 0.03, 6.6, 5.7, { offset: 2, glow: 0.22 });
  // the dusty pink frame (3D, 8 cm proud) round the doorway and the little lip under the sign
  const PK = '#c99aa0', fw = 0.3;
  F.box(-1.45, 0, 0.07, fw, 5.1, 0.1, PK); F.box(1.45, 0, 0.07, fw, 5.1, 0.1, PK); F.box(0, 4.85, 0.07, 3.2, fw, 0.1, PK);   // the frame is tall: the sign is 1.9 m, readable from across the street
  F.box(0, 2.82, 0.06, 2.35, 0.1, 0.08, '#b98a90');                              // lintel of the shutter box
  // shutter and, at night, the doorway behind it
  const door = F.quad(krustDoorway(), 0, 0, 0.1, 2.2, 2.8, { basic: true, name: 'doorway' }), shut = F.quad(krustShutter(), 0, 0, 0.13, 2.2, 2.8, { offset: 1, name: 'shutter' });
  F.box(-1.12, 0, 0.14, 0.06, 2.8, 0.1, '#243a2c'); F.box(1.12, 0, 0.14, 0.06, 2.8, 0.1, '#243a2c');
  // the sign: a 80 cm square plate
  F.box(0, 2.95, 0.1, 2.0, 1.9, 0.05, '#c9c9c9');
  F.quad(krustSign(), 0, 3.0, 0.14, 1.8, 1.8, { glow: 0.28, offset: 1 });
  // lanterns
  for (const sx of [-1, 1]) {
    const lx = sx * 2.05;
    F.box(lx, 2.2, 0.12, 0.08, 0.5, 0.08, '#171717'); F.box(lx, 2.28, 0.22, 0.2, 0.34, 0.2, '#101010'); F.box(lx, 2.62, 0.22, 0.26, 0.05, 0.26, '#101010'); F.box(lx, 2.3, 0.33, 0.14, 0.26, 0.02, '#ffcf7a');
    F.light(lx, 2.45, 0.42, 1.9, '#ffb15a', 0.9);
  }
  // two air conditioners on the wall
  for (const sx of [-1, 1]) { const ax = sx * 2.55; F.box(ax, 3.55, 0.2, 0.95, 0.55, 0.3, '#e8e8e4'); F.cyl(ax - sx * 0.1, 3.6, 0.37, 0.2, 0.04, '#34363a', 14); F.box(ax, 3.92, 0.25, 0.9, 0.04, 0.34, '#cfcfca'); }
  // two green wheelie bins at the door (street side)
  for (const bx of [1.05, 1.7]) { F.box(bx, 0, 0.5, 0.55, 0.95, 0.62, '#2f6a45'); F.box(bx, 0.95, 0.5, 0.6, 0.07, 0.68, '#27583a'); }
  F.pool(0, 1.5, 3.4, '#ff9a42', 0.55);
  F.hooks.push((night, open) => { door.visible = open; shut.visible = !open; });
  return F.finish();
}


// ---------------------------------------------------------------------------------------------------------------------------------- shared paint
// a stucco wall with courses (rustication) and a stone plinth; returns the canvas context in a frame of metres (y up from the pavement)
function wallPaint(W, H, o) {
  const PX = 100, [c, g] = canvas(W * PX, H * PX), y = m => (H - m) * PX, x = m => (m + W / 2) * PX;
  g.fillStyle = o.base; g.fillRect(0, 0, W * PX, H * PX); speck(g, W * PX, H * PX, o.speck || 5000, 0.12, o.dark || '#6a5a40', o.light || '#fff4dc');
  if (o.courses) for (let m = o.plinth || 0.6; m < (o.top || 3.6); m += o.courses) { g.fillStyle = 'rgba(90,70,40,.28)'; g.fillRect(0, y(m) - 1, W * PX, 3); g.fillStyle = 'rgba(255,248,230,.22)'; g.fillRect(0, y(m) + 2, W * PX, 2); }
  if (o.plinth) {
    g.fillStyle = o.plinthColor || '#8c877f'; g.fillRect(0, y(o.plinth), W * PX, o.plinth * PX);
    for (let m = 0, row = 0; m < o.plinth; m += 0.4, row++) for (let u = -W / 2 - (row & 1 ? 0.45 : 0); u < W / 2; u += 0.9) { g.strokeStyle = 'rgba(40,36,30,.5)'; g.lineWidth = 2; g.strokeRect(x(u) + 1, y(m + 0.4) + 1, 0.9 * PX - 2, 0.4 * PX - 2); }
    for (let i = 0; i < 700; i++) { g.fillStyle = i & 1 ? 'rgba(50,46,40,.3)' : 'rgba(210,206,198,.28)'; g.fillRect(rnd() * W * PX, y(rnd() * o.plinth), 2, 2); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y(o.plinth), W * PX, 3);
  }
  return { c, g, PX, W, H, x, y };
}
const rectM = (P, a, b, w, h, fill) => { P.g.fillStyle = fill; P.g.fillRect(P.x(a), P.y(b + h), w * P.PX, h * P.PX); };   // x left edge, y bottom, in metres

// ---------------------------------------------------------------------------------------------------------------------------------- Whisky & Drink, Via Carducci 38
// A 4 to 5 storey ochre palazzo with a rusticated ground floor on a grey plinth: a window with a pink neon board and a hot dog poster on the left, the entrance
// on the right with a half-round sunburst fanlight in red and white, a white lightbox with the logo, one amber lantern each side, purple uplights on the
// balconies, a terrace of cream parasols with black bistro chairs on the pavement. Photos: refs/whisky_drink_new (night, blurred).
function wdNeon() {
  const [c, g] = canvas(300, 240);
  g.fillStyle = '#160a10'; g.fillRect(0, 0, 300, 240);
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 6; g.strokeRect(3, 3, 294, 234);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff5f8f'; g.shadowColor = '#ff2a6a'; g.shadowBlur = 14;
  g.font = 'italic 700 38px "Brush Script MT", "Segoe Script", cursive'; g.fillText('Whisky and Drink', 150, 52);
  g.font = 'italic 700 64px "Brush Script MT", "Segoe Script", cursive'; g.fillText('Food', 150, 125);
  g.font = 'italic 700 32px "Brush Script MT", "Segoe Script", cursive'; g.fillText('Eatery', 150, 195);
  return texOf(c, 4);
}
function wdLightbox() {
  const [c, g] = canvas(320, 140);
  g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 320, 140); g.strokeStyle = '#b8b4a8'; g.lineWidth = 6; g.strokeRect(3, 3, 314, 134);
  g.fillStyle = '#16120e'; g.fillRect(20, 20, 280, 100);
  g.fillStyle = '#f4f2ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 30px Georgia, "Times New Roman", serif'; g.fillText('WHISKY AND DRINK', 160, 56);
  g.font = '600 14px Arial, sans-serif'; g.fillText('B I R R E R I A  /  D R I N K E R I A', 160, 92);
  return texOf(c, 4);
}
function wdWall() {
  const P = wallPaint(7.0, 4.8, { base: '#d9b25f', courses: 0.5, plinth: 0.95, top: 3.7, dark: '#6e5428' }), { g } = P;
  // window opening, left: dark, a TV and a hot dog poster; entrance, right: a red-lit bar
  rectM(P, -2.4, 1.15, 1.5, 2.0, '#1d1410'); rectM(P, -2.4, 1.15, 1.5, 0.08, '#8c877f');
  rectM(P, -1.9, 2.35, 0.55, 0.38, '#2a3a58'); rectM(P, -1.84, 2.4, 0.43, 0.28, '#a9c4ea');                                  // the TV
  rectM(P, -2.35, 1.2, 0.7, 0.95, '#efece0'); g.fillStyle = '#c0703a'; g.beginPath(); g.ellipse(P.x(-2.0), P.y(1.95), 0.26 * P.PX, 0.09 * P.PX, 0, 0, TAU); g.fill();   // the hot dog
  rectM(P, 0.1, 0, 1.7, 3.0, '#3a1612'); rectM(P, 0.3, 0.1, 1.3, 2.4, '#7a2a24'); rectM(P, 0.35, 0.9, 1.2, 0.5, '#d89a52');
  for (let i = 0; i < 9; i++) rectM(P, 0.4 + i * 0.13, 1.5 + (i % 3) * 0.22, 0.07, 0.3, ['#c8a050', '#9ac8a0', '#7a3a2a'][i % 3]);   // bottles
  // the half-round fanlight in red and white sectors
  g.save(); g.beginPath(); g.arc(P.x(0.95), P.y(3.0), 0.85 * P.PX, Math.PI, TAU); g.closePath(); g.clip();
  for (let k = 0; k < 10; k++) { g.fillStyle = k & 1 ? '#f2eee4' : '#c5262c'; g.beginPath(); g.moveTo(P.x(0.95), P.y(3.0)); g.arc(P.x(0.95), P.y(3.0), 0.9 * P.PX, Math.PI + k * Math.PI / 10, Math.PI + (k + 1) * Math.PI / 10); g.closePath(); g.fill(); }
  g.restore(); g.strokeStyle = '#5a4a38'; g.lineWidth = 6; g.beginPath(); g.arc(P.x(0.95), P.y(3.0), 0.88 * P.PX, Math.PI, TAU); g.stroke();
  g.strokeStyle = '#5a4a38'; g.lineWidth = 6; g.strokeRect(P.x(0.1), P.y(3.0), 1.7 * P.PX, 3.0 * P.PX);
  return texOf(P.c);
}
function buildWhisky() {
  const F = new Front(), wall = wdWall();
  F.quad(wall, 0, 0, 0.03, 7.0, 4.8, { offset: 2, glow: 0.08 });
  F.box(-1.65, 0.95, 0.07, 1.7, 0.06, 0.12, '#8c877f');                                      // window sill
  F.box(0.95, 3.0, 0.12, 1.9, 0.06, 0.2, '#2a2420');                                         // a short dark canopy over the entrance
  F.quad(wdNeon(), -2.05, 2.55, 0.1, 0.55, 0.44, { glow: 0.9, offset: 1 });
  F.quad(wdLightbox(), 0.95, 3.25, 0.1, 1.5, 0.66, { glow: 0.9, offset: 1 });
  for (const lx of [-0.3, 2.2]) { F.box(lx, 2.1, 0.12, 0.08, 0.4, 0.08, '#151515'); F.box(lx, 2.2, 0.2, 0.18, 0.28, 0.18, '#151515'); F.box(lx, 2.24, 0.3, 0.12, 0.2, 0.02, '#ffcf7a'); F.light(lx, 2.35, 0.4, 1.7, '#ffb15a', 0.85); }
  // balconies above, purple uplight under each
  for (const bx of [-1.6, 1.9]) { F.box(bx, 3.9, 0.4, 1.7, 0.08, 0.8, '#1a1a1c'); F.box(bx, 3.98, 0.78, 1.7, 0.5, 0.03, '#1a1a1c'); F.light(bx, 3.8, 0.5, 2.2, '#a64cf0', 0.8); }
  // terrace on the pavement: cream parasols, round tables, black chairs
  F.parasol(-2.2, 2.1, '#ece4cc'); F.parasol(2.6, 2.4, '#ece4cc');
  for (const [tx, tz] of [[-2.2, 2.1], [-3.0, 3.4], [2.6, 2.4], [3.3, 3.6]]) { F.table(tx, tz); F.chair(tx - 0.55, tz, Math.PI / 2); F.chair(tx + 0.55, tz, -Math.PI / 2); F.chair(tx, tz + 0.55, Math.PI); }
  F.pool(0.6, 1.6, 3.4, '#ffa050', 0.45);
  return F.finish();
}

// ---------------------------------------------------------------------------------------------------------------------------------- Taverna Azzurra
// Vucciria, Discesa dei Maccheronai 9: a pale grey-beige stone front with a long raised band of carved capitals "MAGGIORE" (the old family sign), under it in
// blue-grey "TAVERNA  TA  AZZURRA"; two bays in bright turquoise paint, a glass window of lit bottles on the left and an open doorway down two steps on the
// right; a ribbed blue awning on a dark pergola above; a cream pull-down shutter at the edge; a bench on the lane. Photos: refs/taverna_azzurra ddg_7, 8, 16, 18, 23.
function tavWall() {
  const P = wallPaint(6.6, 5.6, { base: '#b8ae9a', courses: 0, plinth: 0, speck: 7000, dark: '#5a5244', light: '#e8e0cc' }), { g } = P;
  // stone slabs
  for (let r = 0; r < 12; r++) for (let u = -3.3 - (r & 1 ? 0.5 : 0); u < 3.3; u += 1.0) { g.strokeStyle = 'rgba(70,62,50,.28)'; g.lineWidth = 2; g.strokeRect(P.x(u), P.y(0.5 * (r + 1)), 1.0 * P.PX, 0.5 * P.PX); }
  // the sign band: cream plate, MAGGIORE in big carved serif capitals, TAVERNA TA AZZURRA in blue-grey under it
  rectM(P, -3.3, 4.3, 6.6, 1.15, '#cdc4ae'); rectM(P, -3.3, 4.3, 6.6, 0.05, '#7a7260'); rectM(P, -3.3, 5.4, 6.6, 0.05, '#7a7260');
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '700 ' + 0.62 * P.PX + 'px Georgia, "Times New Roman", serif'; g.fillStyle = 'rgba(60,56,48,.85)'; g.fillText('M A G G I O R E', P.x(0), P.y(4.78));
  g.fillStyle = '#4c6a86'; g.font = '600 ' + 0.3 * P.PX + 'px Georgia, serif'; g.fillText('TAVERNA', P.x(-1.9), P.y(4.42)); g.fillText('AZZURRA', P.x(1.9), P.y(4.42));
  g.strokeStyle = '#4c6a86'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(P.x(-0.28), P.y(4.38)); g.lineTo(P.x(0), P.y(4.62)); g.lineTo(P.x(0.28), P.y(4.38)); g.lineTo(P.x(0), P.y(4.46)); g.closePath(); g.stroke();   // TA monogram in a diamond
  g.font = '700 ' + 0.2 * P.PX + 'px Georgia, serif'; g.fillStyle = '#4c6a86'; g.fillText('TA', P.x(0), P.y(4.45));
  // left bay: the shop window, shelves of bottles lit blue
  rectM(P, -3.0, 0.7, 2.5, 3.2, '#10304a');
  for (let r = 0; r < 5; r++) { rectM(P, -2.95, 1.0 + r * 0.6, 2.4, 0.05, '#c9a064'); for (let u = 0; u < 12; u++) rectM(P, -2.9 + u * 0.2 + rnd() * 0.04, 1.05 + r * 0.6, 0.09, 0.3 + rnd() * 0.12, ['#4aa8d8', '#e0b060', '#9ad0b8', '#c0452a', '#7ab8e8'][(r + u) % 5]); }
  // the pilaster between the bays with stickers and posters
  rectM(P, -0.4, 0, 0.6, 3.9, '#c2b8a2'); for (let i = 0; i < 26; i++) rectM(P, -0.38 + rnd() * 0.5, 0.3 + rnd() * 3.4, 0.1 + rnd() * 0.12, 0.08 + rnd() * 0.18, ['#e8c840', '#d84a3a', '#f4f0e0', '#3a78c8', '#2a2a2a'][i % 5]);
  // right bay: the open doorway into the barrel room, wood and warm light
  rectM(P, 0.3, 0.0, 2.35, 3.5, '#2a160c'); rectM(P, 0.45, 0.3, 2.05, 2.7, '#5c3418');
  for (let u = 0; u < 3; u++) { rectM(P, 0.55 + u * 0.65, 0.6, 0.55, 0.75, '#7a4a22'); rectM(P, 0.55 + u * 0.65, 1.5, 0.55, 0.75, '#6a3e1c'); }
  rectM(P, 0.45, 2.7, 2.05, 0.1, '#ffe6a8'); g.fillStyle = 'rgba(255,220,150,.25)'; g.fillRect(P.x(0.5), P.y(2.7), 2.0 * P.PX, 2.4 * P.PX);
  // turquoise frames round both bays
  g.strokeStyle = '#1fa0c8'; g.lineWidth = 0.15 * P.PX; g.strokeRect(P.x(-3.0), P.y(3.9), 2.5 * P.PX, 3.2 * P.PX); g.strokeRect(P.x(0.3), P.y(3.5), 2.35 * P.PX, 3.5 * P.PX);
  // cream pull-down shutter at the right edge, door number plate
  rectM(P, 2.85, 0, 0.4, 3.2, '#ddd2b4'); for (let m = 0; m < 3.2; m += 0.08) rectM(P, 2.85, m, 0.4, 0.015, 'rgba(0,0,0,.2)');
  rectM(P, 2.7, 3.0, 0.22, 0.28, '#f0ece0'); g.fillStyle = '#3a3a3a'; g.font = '700 22px Arial'; g.textAlign = 'center'; g.fillText('9', P.x(2.81), P.y(3.08));
  return texOf(P.c);
}
function buildTaverna() {
  const F = new Front();
  F.quad(tavWall(), 0, 0, 0.03, 6.6, 5.6, { offset: 2, glow: 0.12 });
  // blue canvas awning on a dark pergola over the band
  F.box(0, 5.45, 0.02, 6.6, 0.1, 0.1, '#2c2622');
  for (let i = 0; i < 9; i++) { const ux = -3.0 + i * 0.75; F.box(ux, 5.35, 0.7, 0.07, 0.07, 1.4, '#2c2622'); }
  F.push(new THREE.BoxGeometry(6.6, 0.05, 1.5).rotateX(-0.12).translate(0, 5.3, 0.75), '#2e6fb7');
  for (let i = 0; i < 12; i++) F.box(-3.1 + i * 0.56, 5.34, 0.75, 0.03, 0.04, 1.5, '#cfe4f4');
  // steps down into the doorway, a bench against the pilaster side
  F.box(1.45, 0, 0.2, 2.2, 0.12, 0.35, '#9a9284'); F.box(-1.7, 0, 0.9, 1.6, 0.06, 0.4, '#6a4a2a'); F.box(-1.7, 0.4, 0.9, 1.6, 0.05, 0.4, '#8a6238');
  for (const bx of [-2.4, -1.0]) F.box(bx, 0, 0.9, 0.06, 0.4, 0.34, '#2a2420');
  // blue light spilling out of the window, warm from the door
  F.light(-1.75, 2.0, 0.3, 3.2, '#4aa8ff', 0.55); F.light(1.45, 1.8, 0.3, 3.0, '#ffb060', 0.7);
  for (const lx of [-3.2, 3.2]) F.light(lx, 3.6, 0.5, 2.0, '#ffd090', 0.5);
  F.pool(0, 1.7, 3.2, '#ffa860', 0.4);
  return F.finish();
}

// ---------------------------------------------------------------------------------------------------------------------------------- PunkFunk
// Via Napoli 10: a pale beige rusticated front, a black box sign "PUNKFUNK / RECORD SHOP MUSIC BAR" over a double glass door in a black steel frame
// covered in gig posters, white and black bunting inside, a black banner "RECORD STORE DAY" on the left, the number 10, black spheres on the pavement,
// and a grey-railed wooden deck with dark slat tables and pink bougainvillea. Photos: refs/punkfunk ddg_10 and ddg_12.
function pfSign() {
  const [c, g] = canvas(420, 130);
  g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, 420, 130); g.strokeStyle = '#2a2a2a'; g.lineWidth = 6; g.strokeRect(3, 3, 414, 124);
  g.fillStyle = '#f2f2f0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 78px Impact, "Arial Narrow", sans-serif'; g.save(); g.scale(0.9, 1); g.fillText('PUNKFUNK', 210 / 0.9, 56); g.restore();
  g.font = '700 17px Arial, sans-serif'; g.fillText('RECORD SHOP MUSIC BAR', 210, 108);
  return texOf(c, 4);
}
function pfBanner() {
  const [c, g] = canvas(80, 360);
  g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 80, 360); g.fillStyle = '#f2f2f0'; g.textAlign = 'center';
  g.font = '800 17px Impact, sans-serif'; g.fillText('PUNK', 40, 26); g.fillText('FUNK', 40, 44);
  g.save(); g.translate(40, 345); g.rotate(-Math.PI / 2); g.font = '900 38px Impact, sans-serif'; g.textAlign = 'left'; g.fillText('RECORD STORE DAY', 0, 12); g.restore();
  g.strokeStyle = '#f2f2f0'; g.lineWidth = 4; g.beginPath(); g.arc(40, 80, 15, 0, TAU); g.stroke(); g.beginPath(); g.arc(40, 80, 4, 0, TAU); g.stroke();
  return texOf(c, 4);
}
function pfDoor() {
  const [c, g] = canvas(256, 300), gr = g.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, '#0e0a0e'); gr.addColorStop(0.7, '#1c0e18'); gr.addColorStop(1, '#3a2418'); g.fillStyle = gr; g.fillRect(0, 0, 256, 300);
  for (let i = 0; i < 14; i++) { g.fillStyle = ['#d94abf', '#ffb050', '#ffe0a0'][i % 3]; g.globalAlpha = 0.7; g.beginPath(); g.arc(30 + rnd() * 196, 70 + rnd() * 120, 3 + rnd() * 3, 0, TAU); g.fill(); } g.globalAlpha = 1;
  g.fillStyle = '#c8c8c0'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(10 + i * 28, 8); g.lineTo(34 + i * 28, 8); g.lineTo(22 + i * 28, 36); g.closePath(); g.globalAlpha = i & 1 ? 0.85 : 0.35; g.fill(); } g.globalAlpha = 1;   // bunting
  // gig posters on the glass of both leaves
  for (const [px, py] of [[8, 70], [8, 150], [196, 90], [196, 170]]) { g.fillStyle = ['#f2f0e4', '#e8d85a', '#d94abf'][(px + py) % 3]; g.fillRect(px, py, 50, 66); g.fillStyle = '#151515'; for (let r = 0; r < 5; r++) g.fillRect(px + 5, py + 8 + r * 11, 30 + rnd() * 12, 4); }
  return texOf(c);
}
function pfWall() {
  const P = wallPaint(6.4, 4.8, { base: '#d8c8a8', courses: 0.5, plinth: 0.6, top: 4.3, dark: '#7a6840', plinthColor: '#9a948a' }), { g } = P;
  rectM(P, -1.25, 0, 2.5, 3.0, '#0c0c0c');                                                   // the opening (the door quad covers it)
  g.fillStyle = '#4a60c0'; g.font = '700 30px "Brush Script MT", cursive'; g.save(); g.translate(P.x(3.0), P.y(2.6)); g.rotate(-0.4); g.fillText('~ ~', 0, 0); g.restore();   // a bit of graffiti on the right
  rectM(P, 2.3, 3.1, 0.3, 0.38, '#f0ece0'); g.fillStyle = '#222'; g.font = '700 24px Arial'; g.textAlign = 'center'; g.fillText('10', P.x(2.45), P.y(3.2));
  return texOf(P.c);
}
function buildPunkfunk() {
  const F = new Front();
  F.quad(pfWall(), 0, 0, 0.03, 6.4, 4.8, { offset: 2, glow: 0.08 });
  F.quad(pfDoor(), 0, 0, 0.1, 2.5, 3.0, { basic: true });
  // black steel frame of the doorway and the two door leaves' mullions
  F.box(-1.3, 0, 0.1, 0.12, 3.1, 0.14, '#0c0c0c'); F.box(1.3, 0, 0.1, 0.12, 3.1, 0.14, '#0c0c0c'); F.box(0, 3.0, 0.1, 2.72, 0.12, 0.14, '#0c0c0c'); F.box(0, 0, 0.1, 0.06, 3.0, 0.1, '#0c0c0c');
  // the black box sign with the white text, and the banner on the left
  F.box(0, 3.25, 0.1, 2.3, 0.85, 0.1, '#0a0a0a'); F.quad(pfSign(), 0, 3.3, 0.16, 2.1, 0.65, { glow: 0.3, offset: 1 });
  F.quad(pfBanner(), -2.05, 0.85, 0.07, 0.5, 2.3, { glow: 0.2, offset: 1 });
  // two black spheres on the pavement
  F.sphere(2.6, 0, 1.1, 0.46, '#202226'); F.sphere(-1.5, 0, 0.55, 0.2, '#202226');
  // the deck: a low wooden platform on the left with a grey rail, dark slat tables, folding chairs, a planter of bougainvillea
  F.box(-3.7, 0, 1.55, 3.4, 0.16, 2.2, '#6b4a30');
  F.box(-3.7, 0.86, 2.6, 3.4, 0.04, 0.04, '#7a7e82'); F.box(-5.4, 0.86, 1.55, 0.04, 0.04, 2.2, '#7a7e82');
  for (const [px, pz] of [[-5.4, 2.6], [-4.55, 2.6], [-3.7, 2.6], [-2.85, 2.6], [-2.0, 2.6], [-5.4, 1.5]]) F.box(px, 0.16, pz, 0.04, 0.7, 0.04, '#7a7e82');
  for (const [tx, tz] of [[-4.5, 1.2], [-3.1, 1.6], [-3.8, 2.1]]) { F.table(tx, tz, 0.34, 0.74, '#1c1c1e', '#2a2624'); F.chair(tx - 0.5, tz, Math.PI / 2, '#2c2c30'); F.chair(tx + 0.5, tz, -Math.PI / 2, '#2c2c30'); }
  F.box(-2.2, 0.16, 2.3, 0.7, 0.45, 0.4, '#3a3a3a'); F.box(-2.2, 0.6, 2.3, 0.6, 0.35, 0.34, '#d94aa0');
  F.light(0, 2.7, 0.4, 3.4, '#d94abf', 0.55); F.light(0, 1.6, 0.4, 3.0, '#ffb050', 0.45);
  F.pool(0, 1.7, 3.4, '#ff8ad8', 0.3);
  return F.finish();
}

// ---------------------------------------------------------------------------------------------------------------------------------- Whisky and Drink Magione
// On Piazza Magione: a yellow ochre front with two openings, a narrow doorway with a brown door on the left and a wider arched entrance on the right under a
// black arched sign "WHISKY AND DRINK / Magione" in white and gold serif, brown double doors folded open, pendant lanterns, a round window, two balconies with
// purple light under them, plastic chairs and high tables out on the piazza. Photos: refs/whisky_drink ddg_12 and ddg_15, refs/whisky_drink_new (Maps, Jun 2022).
function wdmSign() {
  const [c, g] = canvas(400, 170);
  g.fillStyle = '#111'; g.beginPath(); g.moveTo(0, 170); g.lineTo(0, 110); g.quadraticCurveTo(200, -30, 400, 110); g.lineTo(400, 170); g.closePath(); g.fill();
  g.strokeStyle = '#c8a84a'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, 165); g.lineTo(8, 112); g.quadraticCurveTo(200, -18, 392, 112); g.lineTo(392, 165); g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#f2ead2'; g.font = '700 46px Georgia, serif'; g.fillText('WHISKY', 200, 96); g.font = '600 20px Georgia, serif'; g.fillStyle = '#d8b858'; g.fillText('AND DRINK', 200, 124);
  g.font = 'italic 600 22px Georgia, serif'; g.fillStyle = '#f2ead2'; g.fillText('Magione', 250, 152);
  return texOf(c, 4);
}
function wdmWall() {
  const P = wallPaint(6.0, 5.6, { base: '#e8b33a', courses: 0, plinth: 0.5, top: 3.5, speck: 7000, dark: '#9a6a14', plinthColor: '#8c8478' }), { g } = P;
  // narrow doorway with a brown door, wide arched entrance with the red-lit bar
  rectM(P, -2.35, 0, 0.95, 2.3, '#4a2e1c'); rectM(P, -2.25, 0.1, 0.75, 2.1, '#6a3e22'); for (let i = 0; i < 4; i++) rectM(P, -2.25, 0.4 + i * 0.5, 0.75, 0.04, 'rgba(0,0,0,.35)');
  g.fillStyle = '#e8b33a'; g.beginPath(); g.moveTo(P.x(-0.4), P.y(0)); g.lineTo(P.x(-0.4), P.y(2.4)); g.arc(P.x(0.55), P.y(2.4), 0.95 * P.PX, Math.PI, TAU); g.lineTo(P.x(1.5), P.y(0)); g.closePath();
  const gr = g.createLinearGradient(0, P.y(2.4), 0, P.y(0)); gr.addColorStop(0, '#d8483c'); gr.addColorStop(1, '#6a1e18'); g.fillStyle = gr; g.fill();
  for (let r = 0; r < 3; r++) for (let u = 0; u < 9; u++) rectM(P, -0.2 + u * 0.15, 1.6 + r * 0.32, 0.07, 0.24, ['#f0d08a', '#9ad0b0', '#c05030', '#e8e0c8'][(u + r) % 4]);   // bottles on the back wall
  rectM(P, -0.4, 0.95, 1.9, 0.9, '#7a3a1c'); rectM(P, -0.4, 1.85, 1.9, 0.05, '#c89a4a');   // the bar
  // the round window on the right
  g.fillStyle = '#6a4a22'; g.beginPath(); g.arc(P.x(2.4), P.y(3.0), 0.3 * P.PX, 0, TAU); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(P.x(2.4), P.y(3.0), 0.22 * P.PX, 0, TAU); g.fill();
  // balcony doors and shutters above
  for (const bx of [-1.7, 1.9]) { rectM(P, bx - 0.45, 3.9, 0.9, 1.5, '#1d1a18'); rectM(P, bx - 0.45, 3.9, 0.9, 0.05, '#8a8478'); }
  return texOf(P.c);
}
function buildWdMagione() {
  const F = new Front();
  F.quad(wdmWall(), 0, 0, 0.03, 6.0, 5.6, { offset: 2, glow: 0.12 });
  F.quad(wdmSign(), 0.55, 2.55, 0.12, 2.1, 0.9, { glow: 0.5, offset: 1 });
  // brown double doors folded back against the wall on both sides of the arch
  F.box(-0.52, 0, 0.08, 0.1, 2.5, 0.8, '#5a3820'); F.box(1.62, 0, 0.08, 0.1, 2.5, 0.8, '#5a3820');
  for (const lx of [-0.75, 1.85]) { F.box(lx, 2.55, 0.1, 0.03, 0.4, 0.03, '#161616'); F.box(lx, 2.2, 0.16, 0.18, 0.34, 0.18, '#141414'); F.box(lx, 2.24, 0.26, 0.12, 0.24, 0.02, '#ffcf7a'); F.light(lx, 2.35, 0.36, 1.6, '#ffb15a', 0.85); }
  for (const bx of [-1.7, 1.9]) { F.box(bx, 3.75, 0.4, 1.4, 0.07, 0.8, '#161616'); F.box(bx, 3.82, 0.78, 1.4, 0.55, 0.03, '#161616'); F.light(bx, 3.6, 0.5, 2.6, '#a64cf0', 0.9); }
  F.light(0.55, 1.8, 0.3, 3.0, '#ff6a50', 0.55);
  // plastic chairs and high tables on the piazza
  for (const [tx, tz] of [[-1.8, 2.4], [0.4, 3.3], [2.6, 2.6], [-0.7, 4.3]]) { F.table(tx, tz, 0.36, 1.05, '#2a2420', '#d8d2c0'); F.chair(tx - 0.55, tz, Math.PI / 2, '#d8d4c8'); F.chair(tx + 0.55, tz, -Math.PI / 2, '#d8d4c8'); }
  F.pool(0.5, 2.4, 3.6, '#c27aff', 0.3);
  return F.finish();
}

const BUILDERS = { krust: buildKrust, whisky: buildWhisky, taverna: buildTaverna, punkfunk: buildPunkfunk, wdmagione: buildWdMagione };

export function buildFront(kind) {
  const b = BUILDERS[kind]; if (!b) return null;
  const F = b();
  return { group: F.group, update: (n, o, t) => F.update(n, o, t), dispose: () => F.dispose() };
}
