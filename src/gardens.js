// Villa gardens for Mondello, Valdesi and Partanna-Mondello.
// The baked street layers call every bit of ground within 24 m of a building "raised pavement", which is right in the centro storico
// and wrong in the villa quarters, where the yards are gardens (hedges, lawn, scrub, citrus). Photos and satellite views of Mondello
// show the pavement only along the carriageways, on the seafront promenade and in the piazza.
// So the raised material of the streamed tiles gets a patch: inside GARDEN_REGION the slab texture is replaced by a garden texture
// wherever the ground is more than a few metres from asphalt or stone paving. The mask (white = keep the paving) is one shared canvas
// for the whole region, drawn tile by tile as the tiles stream in, so there is a single material and nothing to dispose per tile.
import * as THREE from 'three';

const REG = { x0: -3950, z0: -10750, x1: -2150, z1: -8650, res: 2 };   // metres, and metres per mask pixel
const KEEP = [[-3060, -10150, 80], [-2995, -10120, 45], [-2500, -8960, 45]];                // piazza Mondello with the harbour front, piazza Valdesi: stay paved
const ROAD_MARGIN = 3.0, SAND_MARGIN = 14;                              // pavement kept this far from roads, and from the back of the beach (the promenade)
export const GARDEN_REGION = REG;
let cv = null, ctx = null, tex = null;

function init() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas'); cv.width = Math.ceil((REG.x1 - REG.x0) / REG.res); cv.height = Math.ceil((REG.z1 - REG.z0) / REG.res);
  ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff'; for (const [x, z, r] of KEEP) { ctx.beginPath(); ctx.arc((x - REG.x0) / REG.res, (z - REG.z0) / REG.res, r / REG.res, 0, 7); ctx.fill(); }
  tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
}

function trace(poly) {   // poly: [outer, hole, ...] flat rings
  for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i += 2) { const px = (ring[i] - REG.x0) / REG.res, pz = (ring[i + 1] - REG.z0) / REG.res; i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }
    ctx.closePath();
  }
}
function inReg(poly) {
  const o = poly[0]; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < o.length - 1; i += 2) { if (o[i] < x0) x0 = o[i]; if (o[i] > x1) x1 = o[i]; if (o[i + 1] < z0) z0 = o[i + 1]; if (o[i + 1] > z1) z1 = o[i + 1]; }
  return x1 > REG.x0 && x0 < REG.x1 && z1 > REG.z0 && z0 < REG.z1;
}

// Called with a tile's `streets` before its raised layer is built.
export function gardenDraw(streets) {
  init(); if (!ctx) return;
  let any = false;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round';
  for (const [layer, margin] of [['asphalt', ROAD_MARGIN], ['paving', ROAD_MARGIN], ['sand', SAND_MARGIN]]) {
    const polys = streets[layer]; if (!polys) continue;
    ctx.lineWidth = margin * 2 / REG.res;
    for (const poly of polys) {
      if (!poly.length || !inReg(poly)) continue;
      ctx.beginPath(); trace(poly); if (layer !== 'sand') ctx.fill('evenodd'); ctx.stroke(); any = true;
    }
  }
  if (any) tex.needsUpdate = true;
}

// Patches the raised-ground material (map: the slab texture); garden: the lawn texture to use.
export function gardenPatch(mat, garden) {
  init();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.gMask = { value: tex }; sh.uniforms.gTex = { value: garden };
    sh.uniforms.gRect = { value: new THREE.Vector4(REG.x0, REG.z0, 1 / (REG.x1 - REG.x0), 1 / (REG.z1 - REG.z0)) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW; uniform sampler2D gMask; uniform sampler2D gTex; uniform vec4 gRect;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec2 gu = (vGW - gRect.xy) * gRect.zw;
      float gin = step(0.0, gu.x) * step(gu.x, 1.0) * step(0.0, gu.y) * step(gu.y, 1.0);
      float gk = (1.0 - smoothstep(0.3, 0.7, texture2D(gMask, clamp(gu, 0.0, 1.0)).r)) * gin;
      vec3 g1 = texture2D(gTex, vGW / 6.0).rgb, g2 = texture2D(gTex, vGW / 37.0 + 0.31).rgb;
      float dry = smoothstep(0.35, 0.75, g2.g * 2.1 - g2.b);
      vec3 gc = mix(g1 * 1.12, g2 * 1.2, 0.35);
      gc = mix(gc, vec3(0.66, 0.6, 0.4) * (0.7 + 0.6 * g1.g), dry * 0.45);
      diffuseColor.rgb = mix(diffuseColor.rgb, gc, gk);`);
  };
  mat.customProgramCacheKey = () => 'garden';
  return mat;
}
