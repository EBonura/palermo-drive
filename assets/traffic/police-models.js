// Extra traffic models for the police, the lookouts and the team bus (src/police.js, src/gags.js).
// Same conventions as models.js: +z forward, y up, one non-indexed geometry with per-vertex colour and a `tint`
// attribute (1 = multiplied by the per-instance colour). Generic liveries only: no crests, names or real logos.
import * as THREE from 'three';
import { MB, col, wheel, hatch, bus, apePick, SEDAN, DARK, GLASS, WHITE, BLACK, LAMP } from './models.js';

const BLUE = col('#1b3f94'), RED = col('#b3202a'), BAR = col('#1a1b1e'), LBLUE = col('#2f62ff'), LRED = col('#ff3030');
const PINK_BLACK = col('#141214');

// Where the flashing light bar sits on each model (local metres): glow points are drawn here by src/police.js.
export const LIGHTBARS = {
  polizia: { y: SEDAN.H + 0.16, z: 0.0, x: 0.32 },
  carab: { y: SEDAN.H + 0.16, z: 0.0, x: 0.32 },
  apePol: { y: 1.78, z: 0.42, x: 0.3 },
};

function bar(b, y, z, hw) {
  b.box(-hw - 0.04, hw + 0.04, y, y + 0.05, z - 0.14, z + 0.14, BAR);
  b.box(-hw, -0.02, y + 0.05, y + 0.14, z - 0.1, z + 0.1, LBLUE);
  b.box(0.02, hw, y + 0.05, y + 0.14, z - 0.1, z + 0.1, LRED);
}

// Polizia: white body, blue band on the doors and a blue stripe over the bonnet. Instance colour stays white-ish.
function polizia() {
  const b = hatch(SEDAN);
  for (const s of [1, -1]) {
    b.box(s * 0.89 - 0.006, s * 0.89 + 0.006, 0.4, 0.74, -1.95, 1.95, BLUE);
    b.box(s * 0.89 - 0.006, s * 0.89 + 0.006, 0.74, 0.8, -1.95, 1.95, WHITE);
  }
  b.box(-0.2, 0.2, SEDAN.H - 0.56, SEDAN.H - 0.5, 0.5, 2.1, BLUE);
  bar(b, SEDAN.H, 0, 0.36);
  return b;
}
// Carabinieri-style: dark blue body (instance colour) with one red stripe along the flanks.
function carab() {
  const b = hatch(SEDAN);
  for (const s of [1, -1]) b.box(s * 0.89 - 0.006, s * 0.89 + 0.006, 0.62, 0.74, -1.95, 1.95, RED);
  b.box(-0.04, 0.04, SEDAN.H - 0.52, SEDAN.H - 0.5, 0.5, 2.1, RED);
  bar(b, SEDAN.H, 0, 0.36);
  return b;
}
// The comic police lapino: a pickup lapa with a light bar on the cab and a blue band; the word comes from the decal.
function apePol() {
  const b = apePick('');
  for (const s of [1, -1]) b.box(s * 0.74 - 0.008, s * 0.74 + 0.008, 0.48, 0.52, -1.58, -0.12, BLUE);
  b.box(-0.6, 0.6, 1.0, 1.06, 1.18, 1.22, BLUE);
  bar(b, 1.6, 0.42, 0.34);
  return b;
}
// "POLIZIA" on both sides of the bed: two quads, textured by makePoliceDecal.
function decalGeometry() {
  const p = [], uv = [];
  const quad = (a, b, c, d) => { p.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
  const x = 0.752;
  quad([x, 0.54, -1.5], [x, 0.54, -0.2], [x, 0.84, -0.2], [x, 0.84, -1.5]);        // +x side, faces +x
  quad([-x, 0.54, -0.2], [-x, 0.54, -1.5], [-x, 0.84, -1.5], [-x, 0.84, -0.2]);    // -x side, faces -x
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
export function makePoliceDecal(model, cap) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b3f94'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 29, 128, 3);
  g.fillStyle = '#ffffff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('POLIZIA', 64, 17);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.InstancedMesh(decalGeometry(), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }), cap);
  m.instanceMatrix = model.instanceMatrix; m.count = 0; m.frustumCulled = false;
  return m;
}

// Lookout on an electric stand-up scooter (monopattino): a kid in a hoodie. The jacket takes the instance colour.
function monopattino() {
  const b = new MB(), JEANS = col('#262b3a'), SHOE = col('#e9e7e1'), SKIN2 = col('#c79a74'), CAP = col('#151517');
  wheel(b, 0, 0.46, 0.11, 0.05, 8); wheel(b, 0, -0.44, 0.1, 0.06, 8);
  b.box(-0.09, 0.09, 0.13, 0.19, -0.55, 0.42, col('#2a2b2e'));                        // deck
  b.box(-0.07, 0.07, 0.19, 0.27, -0.55, -0.3, col('#2a2b2e'));                         // battery bulge over the rear
  b.wedge(-0.025, 0.025, 0.16, 0.42, 0.2, 0.48, 1.1, col('#c9ccd0'), 0, 0);            // stem
  b.box(-0.29, 0.29, 1.08, 1.13, 0.4, 0.48, DARK);                                     // handlebar
  b.box(-0.03, 0.03, 0.92, 1.0, 0.5, 0.54, LAMP);                                      // head lamp
  b.box(-0.06, 0.06, 0.22, 0.24, -0.6, -0.5, col('#9a1b1b'));
  // rider, one foot forward
  for (const [s, z] of [[1, 0.1], [-1, -0.3]]) {
    b.box(s * 0.1 - 0.05, s * 0.1 + 0.05, 0.2, 0.88, z - 0.06, z + 0.06, JEANS);       // leg
    b.box(s * 0.1 - 0.055, s * 0.1 + 0.055, 0.19, 0.25, z - 0.1, z + 0.14, SHOE);      // trainer
    b.box(s * 0.24 - 0.035, s * 0.24 + 0.035, 1.0, 1.4, 0.0, 0.42, WHITE, 1);          // arm to the bars
  }
  b.wedge(-0.2, 0.2, 0.86, -0.2, 1.46, 0.1, 1.42, WHITE, 1, 0.02);                    // hoodie torso, leaning in
  b.box(-0.1, 0.1, 1.46, 1.68, -0.05, 0.16, SKIN2);                                    // head
  b.box(-0.115, 0.115, 1.6, 1.72, -0.07, 0.18, CAP);                                   // cap
  b.box(-0.1, 0.1, 1.6, 1.64, 0.18, 0.3, CAP);                                         // brim
  return b;
}

// The team bus: the city bus in rosanero pink (instance colour) with black skirt, roof and flashes.
function teamBus() {
  const b = bus(), hw = 1.25, f = 5.9;
  b.box(-hw - 0.012, hw + 0.012, 0.45, 1.0, -f + 0.1, f - 0.1, PINK_BLACK);
  b.box(-hw - 0.012, hw + 0.012, 1.38, 1.46, -f + 0.1, f - 0.1, PINK_BLACK);
  b.box(-hw + 0.1, hw - 0.1, 2.42, 2.5, -f + 0.1, f - 0.1, PINK_BLACK);
  for (const s of [1, -1]) for (const z of [-3.1, -1.9, 2.3, 3.2]) { // diagonal black flashes on the flanks
    b.wedge(s * (hw + 0.002) - 0.006, s * (hw + 0.002) + 0.006, 1.0, z - 0.35, 1.0, z + 0.25, 1.38, PINK_BLACK, 0, 0);
  }
  b.box(-hw + 0.2, hw - 0.2, 0.9, 1.0, f - 0.02, f + 0.04, PINK_BLACK);
  return b;
}

export function buildPoliceModels() {
  return { polizia: polizia().geometry(), carab: carab().geometry(), apePol: apePol().geometry(), monopattino: monopattino().geometry(), teamBus: teamBus().geometry() };
}
