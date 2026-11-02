// The paint of the carretto siciliano (c6): one 512 x 256 canvas, drawn in code, that the cart's side boards, dashboard and back board show (see carrettoDecalGeometry in
// models.js for where each part goes). The top half is the side strip: three scenes in gilded frames (a duel of paladins, the harbour of Palermo under Monte Pellegrino,
// Etna in eruption); the bottom left is the dashboard (the Trinacria on red) and the bottom right the back board (a plumed knight and VIVA PALERMO). Nearest filtering and a
// small canvas keep it a painted board seen at PS2 distance. Drawn once; the stationary cart (src/carretto.js) and the traffic one (src/traffic.js) share the texture.
import * as THREE from 'three';
import { CARRETTO_UV, carrettoDecalGeometry } from './models.js';

const RED = '#c0261c', YEL = '#eab81c', BLUE = '#274f94', GRN = '#2c7a45', WHT = '#f3efe2', INK = '#17171a', GOLD = '#e0b64a';

function frame(g, x, y, w, h) {   // a gilded frame with a red inner line
  g.fillStyle = GOLD; g.fillRect(x, y, w, 4); g.fillRect(x, y + h - 4, w, 4); g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h);
  g.fillStyle = RED; g.fillRect(x + 4, y + 4, w - 8, 2); g.fillRect(x + 4, y + h - 6, w - 8, 2); g.fillRect(x + 4, y + 4, 2, h - 8); g.fillRect(x + w - 6, y + 4, 2, h - 8);
}
function poly(g, pts, c) { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
function rider(g, x, y, k, horseCol, armour, plume, shield, dir = 1) {   // a knight on a horse, feet of the horse at y, facing dir (1 = right); k scales
  g.save(); g.translate(x, y); g.scale(dir * k, k);
  g.fillStyle = horseCol; g.fillRect(-18, -28, 36, 14); g.fillRect(14, -40, 8, 16); g.fillRect(18, -42, 12, 8);   // body, neck, head
  for (const lx of [-16, -9, 8, 15]) g.fillRect(lx, -16, 3, 16);
  g.fillStyle = INK; g.fillRect(-20, -24, 3, 8);                                                                  // tail
  g.fillStyle = plume; g.fillRect(19, -50, 4, 10);                                                                // the horse's plume
  g.fillStyle = shield === 'moon' ? '#8a1f1a' : BLUE; g.fillRect(-18, -29, 36, 4);                              // saddle cloth
  g.fillStyle = armour; g.fillRect(-4, -48, 9, 20); g.beginPath(); g.arc(1, -52, 5, 0, 7); g.fill();            // rider, helmet
  g.fillStyle = plume; g.fillRect(-1, -62, 4, 7);
  g.fillStyle = '#d9d5c8'; g.fillRect(8, -50, 28, 2);                                                            // lance
  g.fillStyle = shield === 'moon' ? '#17171a' : WHT; g.beginPath(); g.arc(-4, -40, 7, 0, 7); g.fill();          // shield
  g.fillStyle = shield === 'moon' ? YEL : RED; if (shield === 'moon') { g.beginPath(); g.arc(-4, -40, 4, 0.5, 5.8); g.fill(); } else { g.fillRect(-5, -46, 2, 12); g.fillRect(-10, -41, 12, 2); }
  g.restore();
}
function duel(g, x, y, w, h) {
  const sky = g.createLinearGradient(0, y, 0, y + h * 0.7); sky.addColorStop(0, '#5d9fe0'); sky.addColorStop(1, '#bfe1f2'); g.fillStyle = sky; g.fillRect(x, y, w, h);
  g.fillStyle = '#f7d86a'; g.beginPath(); g.arc(x + w * 0.82, y + 26, 11, 0, 7); g.fill();
  poly(g, [[x, y + 82], [x + 40, y + 62], [x + 80, y + 80], [x + 120, y + 66], [x + w, y + 84], [x + w, y + h], [x, y + h]], '#6f9a58');
  g.fillStyle = '#b9a98c'; g.fillRect(x + 14, y + 50, 26, 34); g.fillRect(x + 10, y + 44, 8, 8); g.fillRect(x + 22, y + 44, 8, 8); g.fillRect(x + 34, y + 44, 8, 8); g.fillStyle = INK; g.fillRect(x + 23, y + 66, 6, 18);   // a castle
  g.fillStyle = '#4a8f3c'; g.fillRect(x, y + 96, w, h - 96);
  rider(g, x + 58, y + 112, 1.05, '#f2efe6', '#aeb4bd', RED, 'cross', 1);
  rider(g, x + 130, y + 112, 1.05, '#2a2420', '#2f3138', YEL, 'moon', -1);
}
function harbour(g, x, y, w, h) {
  const sky = g.createLinearGradient(0, y, 0, y + h * 0.55); sky.addColorStop(0, '#f08a3c'); sky.addColorStop(1, '#f9d27a'); g.fillStyle = sky; g.fillRect(x, y, w, h);
  g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x + 40, y + 40, 12, 0, 7); g.fill();
  poly(g, [[x + w * 0.38, y + 74], [x + w * 0.52, y + 40], [x + w * 0.62, y + 36], [x + w * 0.78, y + 54], [x + w, y + 78], [x + w, y + 76]], '#8b5a3a');   // Monte Pellegrino
  poly(g, [[x + w * 0.38, y + 74], [x + w * 0.52, y + 40], [x + w * 0.62, y + 36], [x + w * 0.7, y + 74]], '#a56d46');
  g.fillStyle = BLUE; g.fillRect(x, y + 74, w, h - 74);
  g.fillStyle = '#4b79c4'; for (let i = 0; i < 9; i++) g.fillRect(x + 6 + i * 19, y + 84 + (i % 3) * 12, 10, 2);
  g.fillStyle = '#d8c09a'; g.fillRect(x + 6, y + 70, 36, 6); g.fillRect(x + 14, y + 62, 6, 8); g.fillRect(x + 28, y + 60, 6, 10);                       // the quay and its houses
  g.fillStyle = '#6e1a22'; poly(g, [[x + 72, y + 96], [x + 128, y + 96], [x + 120, y + 106], [x + 80, y + 106]], '#6e1a22');                              // the ship
  g.fillStyle = INK; g.fillRect(x + 98, y + 60, 2, 36);
  poly(g, [[x + 100, y + 62], [x + 124, y + 92], [x + 100, y + 92]], WHT); poly(g, [[x + 96, y + 66], [x + 80, y + 92], [x + 96, y + 92]], '#efe6d0');
  g.fillStyle = RED; g.fillRect(x + 104, y + 74, 8, 2); g.fillRect(x + 107, y + 70, 2, 8); g.fillStyle = YEL; g.fillRect(x + 100, y + 58, 10, 4);
}
function etna(g, x, y, w, h) {
  const sky = g.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, '#4a1a3a'); sky.addColorStop(0.6, '#c2452a'); sky.addColorStop(1, '#f0a03a'); g.fillStyle = sky; g.fillRect(x, y, w, h);
  poly(g, [[x, y + 108], [x + w * 0.3, y + 70], [x + w * 0.45, y + 40], [x + w * 0.55, y + 40], [x + w * 0.7, y + 74], [x + w, y + 104], [x + w, y + h], [x, y + h]], '#3a2a2c');
  poly(g, [[x + w * 0.45, y + 40], [x + w * 0.5, y + 56], [x + w * 0.42, y + 84], [x + w * 0.5, y + 108], [x + w * 0.52, y + 108], [x + w * 0.52, y + 56], [x + w * 0.55, y + 40]], '#ff7a1a');   // lava
  g.fillStyle = '#ffd24a'; g.fillRect(x + w * 0.47, y + 32, 10, 8);
  g.fillStyle = '#6b5f66'; for (const [px, py, r] of [[0.48, 24, 10], [0.55, 14, 12], [0.46, 8, 8], [0.62, 6, 9]]) { g.beginPath(); g.arc(x + w * px, y + py, r, 0, 7); g.fill(); }   // the smoke
  g.fillStyle = '#d9c9a4'; for (let i = 0; i < 6; i++) { g.fillRect(x + 8 + i * 12, y + 104 + (i % 2) * 6, 9, 10); } g.fillStyle = '#8a3a2a'; for (let i = 0; i < 6; i++) g.fillRect(x + 7 + i * 12, y + 102 + (i % 2) * 6, 11, 3);   // the village
  g.fillStyle = '#fff'; for (const [px, py] of [[0.1, 12], [0.2, 26], [0.85, 16], [0.75, 8], [0.92, 34]]) g.fillRect(x + w * px, y + py, 2, 2);
}
function trinacria(g, x, y, w, h) {
  g.fillStyle = RED; g.fillRect(x, y, w, h);
  g.fillStyle = YEL; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; poly(g, [[x + w / 2 + Math.cos(a - 0.1) * 20, y + h / 2 + Math.sin(a - 0.1) * 20], [x + w / 2 + Math.cos(a) * 80, y + h / 2 + Math.sin(a) * 52], [x + w / 2 + Math.cos(a + 0.1) * 20, y + h / 2 + Math.sin(a + 0.1) * 20]], i % 2 ? YEL : '#f4d66a'); }
  g.strokeStyle = WHT; g.lineWidth = 6; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094 + 0.6; g.beginPath(); g.moveTo(x + w / 2, y + h / 2); g.quadraticCurveTo(x + w / 2 + Math.cos(a - 0.7) * 32, y + h / 2 + Math.sin(a - 0.7) * 24, x + w / 2 + Math.cos(a) * 46, y + h / 2 + Math.sin(a) * 36); g.stroke(); }
  g.fillStyle = '#f0c9a0'; g.beginPath(); g.arc(x + w / 2, y + h / 2, 17, 0, 7); g.fill();
  g.fillStyle = INK; g.fillRect(x + w / 2 - 8, y + h / 2 - 6, 4, 4); g.fillRect(x + w / 2 + 4, y + h / 2 - 6, 4, 4); g.fillRect(x + w / 2 - 5, y + h / 2 + 6, 10, 2);
  g.fillStyle = '#d9a43a'; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.fillRect(x + w / 2 + s * (20 + k * 4), y + h / 2 - 18 - k * 4, 3, 10);   // ears of wheat
  frame(g, x, y, w, h);
}
function backBoard(g, x, y, w, h) {
  g.fillStyle = BLUE; g.fillRect(x, y, w, h);
  g.fillStyle = YEL; g.fillRect(x, y + h - 34, w, 24); g.fillStyle = RED; g.fillRect(x, y + h - 36, w, 3); g.fillRect(x, y + h - 12, w, 3);
  g.fillStyle = RED; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VIVA PALERMO', x + w / 2, y + h - 22);
  g.fillStyle = '#d6d9de'; g.fillRect(x + w / 2 - 15, y + 40, 30, 38); g.beginPath(); g.arc(x + w / 2, y + 36, 16, 0, 7); g.fill();   // the knight: helmet and bust
  g.fillStyle = RED; g.fillRect(x + w / 2 - 4, y + 4, 8, 20); g.fillStyle = WHT; g.fillRect(x + w / 2 - 12, y + 12, 6, 14); g.fillStyle = YEL; g.fillRect(x + w / 2 + 6, y + 12, 6, 14);
  g.fillStyle = INK; g.fillRect(x + w / 2 - 10, y + 34, 20, 4);
  g.fillStyle = RED; g.fillRect(x + w / 2 - 15, y + 62, 30, 5); g.fillStyle = WHT; g.fillRect(x + w / 2 - 3, y + 44, 6, 22);
  frame(g, x, y, w, h);
}

export function paintCarretto() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = YEL; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 3; i++) { const x = 6 + i * 168, y = 6, w = 162, h = 116; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); [duel, harbour, etna][i](g, x, y, w, h); g.restore(); frame(g, x, y, w, h); }
  g.save(); g.beginPath(); g.rect(0, 128, 256, 128); g.clip(); trinacria(g, 6, 134, 244, 116); g.restore();
  g.save(); g.beginPath(); g.rect(256, 128, 256, 128); g.clip(); backBoard(g, 262, 134, 244, 116); g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}

let TEX = null;
// The painted boards as an InstancedMesh that follows `model` (the cart's instanced mesh): same instance matrices, its own count (the traffic updates it with the model's)
export function makeCarrettoDecal(model, cap) {
  const m = new THREE.InstancedMesh(carrettoDecalGeometry(), new THREE.MeshStandardMaterial({ map: TEX || (TEX = paintCarretto()), roughness: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), cap);
  m.instanceMatrix = model.instanceMatrix; m.count = 0; m.frustumCulled = false; m.receiveShadow = true;
  return m;
}
export { CARRETTO_UV };
