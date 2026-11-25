// Textures of the baked walls (src/fences.js): one texture array with a layer per kind, drawn in code with a seeded generator (so every device gets the same pixels), and one shared material.
//
// Every layer is a 512 px square that stands for pw x ph real metres (`LAYER[k].pw/.ph`), and fences.js writes the uvs of the wall quads in those units (metres along the wall over pw,
// metres below the wall top over ph), so a stone is the size of a stone whatever the length of the wall; the array repeats natively, so there are no seams and the mip levels are right.
// The pixels are light, near neutral detail: the colour of a wall still comes from its vertex colour (per wall variation, the darker foot, the paler cap). A world space value noise in the
// shader breaks up the repeat. One material for every wall of every tile, and the flying chunks of a broken piece use the same one (instanced layer), so they show the same stone.
import * as THREE from 'three';
import * as workPool from './work-pool.js';
import { S, LAYER, N_LAYERS, KINDS, seedOf, pixels } from './wall-paint.js';
import { workersDrawLikePage } from './probe.js';
export { LAYER };

const GLSL = `
float wtH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float wtN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( wtH( i ), wtH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( wtH( i + vec2( 0.0, 1.0 ) ), wtH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }`;

let MAT = null, TEX = null, DATA = null;
// The layers are painted one per call, so the first tile with walls can spread the work (a generator step between layers) instead of stalling a frame for all of them. With a pool they are painted in the workers
// (src/wall-task.js) once src/probe.js has said that a worker's canvas draws what the page's does; what a worker leaves (text, clip) and what has not come back when the texture is wanted at once (wallTexture) is
// painted here. The pixels are seeded: the same ones come back wherever a layer is drawn.
const have = new Set(), away = new Set();   // kinds whose pixels are in DATA; kinds a worker is painting
let asked = false, waiting = false, force = false;
const paintHere = k => { DATA.set(pixels(k, seedOf(k)), LAYER[k].i * S * S * 4); have.add(k); };
function sendToWorkers() {
  asked = true;
  if (!workPool.usesWorkers()) return;
  waiting = true;
  workersDrawLikePage().then(ok => {
    waiting = false;
    if (!ok) return;
    for (const k of KINDS) if (!have.has(k)) {
      away.add(k);
      workPool.run('walls', { kinds: [k] }).then(r => { away.delete(k); if (DATA) for (const [kk, px] of r.layers) if (!have.has(kk)) { DATA.set(px, LAYER[kk].i * S * S * 4); have.add(kk); } }, () => { away.delete(k); });
    }
  });
}
export function* wallTextureSteps() {
  if (TEX) return;
  if (!DATA) DATA = new Uint8Array(S * S * 4 * N_LAYERS);
  if (!asked && !force) sendToWorkers();
  for (;;) {
    const k = KINDS.find(k => !have.has(k) && (force || !away.has(k)));
    if (k && (force || !waiting)) { paintHere(k); yield; continue; }
    if (!k && (force || away.size === 0)) break;
    yield;   // the workers are still at it
  }
}
export function wallTexture() {
  if (TEX) return TEX;
  force = true;   // wanted now: whatever is not in yet is painted here, now
  for (const _ of wallTextureSteps()) { /* paint whatever is left */ }
  TEX = new THREE.DataArrayTexture(DATA, S, S, N_LAYERS);
  TEX.format = THREE.RGBAFormat; TEX.type = THREE.UnsignedByteType;
  TEX.wrapS = TEX.wrapT = THREE.RepeatWrapping; TEX.minFilter = THREE.LinearMipmapLinearFilter; TEX.magFilter = THREE.LinearFilter; TEX.generateMipmaps = true;
  TEX.anisotropy = 4; TEX.colorSpace = THREE.SRGBColorSpace; TEX.needsUpdate = true;
  // the pixels (13 MB) go once they are on the GPU; a lost GL context paints them again (they are seeded: the same ones)
  TEX.onUpdate = () => { TEX.image.data = null; DATA = null; };
  document.getElementById('view')?.addEventListener('webglcontextrestored', () => { const d = new Uint8Array(S * S * 4 * N_LAYERS); KINDS.forEach(k => d.set(pixels(k, seedOf(k)), LAYER[k].i * S * S * 4)); TEX.image.data = d; TEX.needsUpdate = true; });
  return TEX;
}
// the one material of every wall mesh and of the flying chunks: attributes aUv (metres over the layer's size) and aLayer (the layer index)
export function wallMaterial() {
  if (MAT) return MAT;
  const tex = wallTexture();
  MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  MAT.onBeforeCompile = (sh) => {
    sh.uniforms.wallTex = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aUv; attribute float aLayer; varying vec2 vWUv; varying float vWL; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWUv = aUv; vWL = aLayer; vWP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform highp sampler2DArray wallTex; varying vec2 vWUv; varying float vWL; varying vec3 vWP;' + GLSL)
      .replace('#include <map_fragment>', `vec4 wtc = texture( wallTex, vec3( vWUv, floor( vWL + 0.5 ) ) );
        float wtm = 0.88 + 0.26 * wtN( vWP.xz * 0.11 + vWP.y * 0.05 ) * ( 0.6 + 0.4 * wtN( vWP.xz * 0.9 + 3.7 ) );   // two octaves of world value noise: patches of cleaner and dirtier wall
        diffuseColor.rgb *= wtc.rgb * wtm;`);
  };
  MAT.customProgramCacheKey = () => 'wall-array-v1';
  return MAT;
}
// The concrete of the tunnel cuttings and portals (src/bridges.js buildTunnel): the same texture array, layer t, and one attribute aConc per vertex, in metres:
// x along the wall, y above the wall's foot, z below its top (the coping), w how dirty (1 a retaining wall, less on the portal and the coping). The layer repeats in x and y,
// so the joints keep their spacing on any wall; what depends on the wall's height is done here: streaks from the coping (the layer's alpha) that end at a length that varies
// along the wall, a dirtier band at the foot with a ragged top, damp and moss where the wall meets the road (0.3 m over the foot), and a tone per pour (each 4.8 m panel and
// 1.2 m lift) with a slow drift along the wall, so a long wall does not repeat. One material for every tunnel, so no draw call is added.
let CMAT = null;
const CGLSL = `
float cN( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( wtH( vec2( i, 0.5 ) ), wtH( vec2( i + 1.0, 0.5 ) ), f ); }`;
export function concreteMaterial() {
  if (CMAT) return CMAT;
  const tex = wallTexture(), L = LAYER.t, f = v => v.toFixed(6);
  CMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  CMAT.onBeforeCompile = (sh) => {
    sh.uniforms.wallTex = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aConc; varying vec4 vCc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCc = aConc;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform highp sampler2DArray wallTex; varying vec4 vCc;' + GLSL + CGLSL)
      .replace('#include <map_fragment>', `float cu = vCc.x, cf = vCc.y, cd = vCc.w;
        vec4 ctx = texture( wallTex, vec3( cu * ${f(1 / L.pw)}, -cf * ${f(1 / L.ph)}, ${L.i}.0 ) );
        vec3 cc = ctx.rgb * ( 0.93 + 0.1 * wtH( vec2( floor( cu * ${f(1 / L.pw)} ), floor( cf * ${f(1 / 1.2)} ) ) ) ) * ( 0.92 + 0.16 * cN( cu * 0.06 + 13.0 ) );   // a tone per pour, a slow drift
        float cst = ctx.a * ( 1.0 - smoothstep( 0.05, 0.8 + 3.4 * cN( cu * 0.83 + 5.1 ), vCc.z ) ) * cd;   // streaks off the coping, each its own length
        cc *= mix( vec3( 1.0 ), vec3( 0.40, 0.40, 0.37 ), cst ) * ( 1.0 - 0.14 * cd * ( 1.0 - smoothstep( 0.0, 0.3, vCc.z ) ) );   // and the drip line under it
        float cn = cN( cu * 0.55 + 31.0 ), cm = cN( cu * 1.7 + 77.0 );
        cc *= mix( vec3( 1.0 ), vec3( 0.62, 0.58, 0.52 ), ( 1.0 - smoothstep( 0.3, 1.0 + 0.9 * cn, cf ) ) * cd );   // the dirty foot, its top ragged
        cc = mix( cc, cc * vec3( 0.50, 0.62, 0.36 ), ( 1.0 - smoothstep( 0.3, 0.45 + 0.5 * cm, cf ) ) * smoothstep( 0.3, 0.65, cm ) * cd );   // damp and moss along the road
        diffuseColor.rgb *= cc;`);
  };
  CMAT.customProgramCacheKey = () => 'conc-array-v1';
  return CMAT;
}
