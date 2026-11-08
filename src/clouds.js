// Clouds: fair-weather cumulus over Palermo that the lapa can fly up to, over and through (the wings, src/vehicle-air.js).
//
//   const clouds = createClouds({ scene, renderer, camera, sky, sun, hemi, game, SUN_DIR });
//   clouds.update(dt)        // every frame, after dayNight.update and once the camera is placed, before the frame is drawn
//   clouds.setQuality(tier)  // 'low' draws about half the puffs, a little bigger
//
// The idea is the one of pmndrs drei-vanilla's Cloud (MIT, github.com/pmndrs/drei-vanilla, src/core/Cloud.ts): every cloud is a cluster of soft
// camera-facing textured quads, all of them in one instanced draw, sorted far to near. Nothing of its code is copied: here the quads face the camera
// in the vertex shader (the CPU only writes a centre and a size per puff), the puff texture is made at load (no fetch, the build's CSP stays as it is),
// and the lighting reads what src/daynight.js has already put on the sun, the hemisphere light and the fog, so the clouds follow the clock without a
// clock of their own: white and grey by day, warm at sunrise and sunset, moonlit grey-blue at night with a little of the city's orange from below.
//
// The sky: Palermo is mostly clear, with scattered small cumulus that grow over the mountains of the Conca d'Oro and shrink over the sea. The field is
// one 20 km square of seeded clouds wrapped round the camera (each cloud is seen once, wherever the player drives or flies), drifting with a light
// west-north-west wind. Bases sit at 450 to 620 m, under the wings' 700 m ceiling so they can be reached, and always well clear of the ground under
// them (Monte Pellegrino, the mountains inland lift them). Far clouds fade out before the field wraps, so nothing pops.
//
// Flying into one: each puff fades as the camera nears its middle (no quad edge ever reaches the camera), the fog closes in to the cloud's own colour
// and one extra quad far ahead (the same draw) veils the sky, which the fog does not touch. Cost: one draw call, one program compiled while loading,
// a few hundred instances written each frame. ?clouds=off leaves them out (and the sky dome as it was), for comparing.
//
// Their shadows: every cloud darkens the sun's direct light on the ground where the sun projects it, so the patches move with the wind, lie
// further from their cloud the lower the sun is, stretch out in the morning and evening and fade with the sun at dusk. The footprints are painted
// on the CPU into a small top-down texture (below, 'the shadows on the ground'), and the lit materials multiply the sun's light by one lookup in it
// (src/daynight.js for the standard materials, src/sea.js, src/pedestrians.js). ?clouds=off leaves the lookup out of every shader.
//
// The weather (src/weather.js, WX) sets how many there are: each cloud has a rank, and shows as the coverage passes it, growing as it fades in. The 84
// as shipped are ranked 0 to 0.85 (the four over the mountains first: a clear day keeps a little build-up there), so coverage 1 is the sky as it was;
// EXTRA more, ranked above 1, come in for an overcast or rainy sky, which also makes them bigger and greyer underneath.
import * as THREE from 'three';
import { groundY } from './core.js';
import { WX } from './weather.js';

const { clamp, lerp } = THREE.MathUtils;
const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const SEED = 0x5a1e4d07;
const TILE = 20000;                           // the wrapped field (m)
const FADE0 = 8000, FADE1 = 9600;             // clouds fade out between these (horizontal distance), before the wrap at 10 km
const LOD0 = 3500, LOD1 = 5500;               // between these a cloud lets its smaller puffs go and the body puffs grow to fill in (far away they are a few pixels)
const NCLOUD = 84, EXTRA = 76, MAXP = 1600;   // clouds in the field as shipped; more for a grey sky (src/weather.js); puff slots (the veil included)
const WIND = new THREE.Vector2(0.92, 0.39).multiplyScalar(4);   // m/s, towards the east-south-east
const STRIDE = 12;                            // floats per instance: x y z r | base top alpha veil | rotation variant (spare) unfaded
const VEIL_D = 9000;                          // the sky veil's distance ahead of the camera while inside a cloud
const IN_FOG = 0.011;                         // fog density deep inside a cloud: about 150 m of sight

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------------------------------------ the puff texture
// Four puffs in a 2 x 2 atlas, 128 px each: a cauliflower of spheres seen from the front, with ragged edges. RGB is not a colour: r, g the surface
// normal (the bulge of the nearest sphere, so the sun lights one side of each lobe), b how thick the puff is there; alpha the coverage.
// A DataTexture rather than a canvas: the canvas premultiplies, which would round the normals away where alpha is low.
function puffTexture() {
  const S = 128, W = S * 2, d = new Uint8Array(W * W * 4), rnd = mulberry32(SEED ^ 0x77);
  const vn = new Float32Array(17 * 17); // value noise lattice (16 cells over a puff), tiled
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const i0 = (xi & 15), j0 = (yi & 15), i1 = i0 + 1, j1 = j0 + 1;
    return lerp(lerp(vn[j0 * 17 + i0], vn[j0 * 17 + i1], ux), lerp(vn[j1 * 17 + i0], vn[j1 * 17 + i1], ux), uy);
  };
  for (let v = 0; v < 4; v++) {
    for (let j = 0; j < 17; j++) for (let i = 0; i < 17; i++) vn[j * 17 + i] = (i === 16 || j === 16) ? vn[(j & 15) * 17 + (i & 15)] : rnd();
    const sp = [[0, -0.01, 0.27]];   // x, y, r in puff units (the puff spans -0.5..0.5): a body and lobes round it, the bigger ones on top
    const nb = 7 + v;
    for (let k = 0; k < nb; k++) {
      const a = (k / nb + rnd() * 0.12) * Math.PI * 2, rr = 0.13 + rnd() * 0.1, up = Math.sin(a);
      sp.push([Math.cos(a) * rr, up * rr * 0.8 + 0.02, (0.085 + rnd() * 0.075) * (1 + 0.25 * up)]);
    }
    const ox = (v & 1) * S, oy = (v >> 1) * S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const px = (x + 0.5) / S - 0.5, py = (y + 0.5) / S - 0.5;   // y grows with the texture's v, which is up on the quad
      const o = ((oy + y) * W + ox + x) * 4;
      if (px * px + py * py > 0.25) { d[o] = d[o + 1] = 128; continue; }   // the corners stay empty (alpha 0, a flat normal for the mipmaps)
      let wsum = 0, nx = 0, ny = 0, sum = 0;
      for (let k = 0; k < sp.length; k++) {
        const cx = sp[k][0], cy = sp[k][1], r = sp[k][2];   // the lobes' normals blended by how far each stands out (a soft max), so the seams between lobes stay soft
        const dx = px - cx, dy = py - cy, q = r * r - dx * dx - dy * dy;
        if (q <= 0) continue;
        const z = Math.sqrt(q), w = z * z * z * z; sum += z;
        nx += dx / r * w; ny += dy / r * w; wsum += w;
      }
      if (wsum > 0) { nx /= wsum; ny /= wsum; }
      const n1 = noise(px * 8 + 3.1 * v, py * 8), n2 = noise(px * 19 + 7, py * 19 + 5.3 * v);
      const h = sum / 0.32 + (n1 - 0.5) * 0.6 + (n2 - 0.5) * 0.35;   // the noise only frays the edges: nothing outside the lobes
      const rad = Math.sqrt(px * px + py * py);
      const a = ss(0.1, 0.8, h) * ss(0, 0.05, sum) * ss(0.5, 0.36, rad);
      // tilt the normal a little with the noise too, so the lit side is not a set of perfect domes
      const tx = nx * 0.85 + (n1 - 0.5) * 0.5, ty = ny * 0.85 + (n2 - 0.5) * 0.4, tl = Math.min(1, Math.sqrt(tx * tx + ty * ty));
      const kx = tl > 0.98 ? tx / tl * 0.98 : tx, ky = tl > 0.98 ? ty / tl * 0.98 : ty;
      d[o] = Math.round((kx * 0.5 + 0.5) * 255); d[o + 1] = Math.round((ky * 0.5 + 0.5) * 255);
      d[o + 2] = Math.round(clamp(sum / 0.45, 0, 1) * 255); d[o + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(d, W, W, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------------------------------------ the shader
const VERT = `
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC;   // x y z r | base top alpha veil | rotation variant (spare) unfaded
varying vec2 vUv; varying vec3 vWp; varying vec4 vB; varying vec3 vR; varying vec3 vU; varying vec3 vF; varying float vK;
#include <fog_pars_vertex>
void main() {
  vec3 f = iA.xyz - cameraPosition; float d = max(length(f), 1e-3); f /= d;
  vec3 R = normalize(cross(f, abs(f.y) > 0.995 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0))), U = cross(R, f);   // faces the camera's position, not its axis: turning the view never spins a puff
  float c = cos(iC.x), s = sin(iC.x);
  vR = R * c + U * s; vU = U * c - R * s; vF = -f;
  vec3 wp = iA.xyz + (vR * position.x + vU * position.y) * iA.w;
  vUv = (uv + vec2(mod(iC.y, 2.0), floor(iC.y * 0.5))) * 0.5;
  vWp = wp; vB = iB;
  vK = iC.w > 0.5 ? 1.0 : smoothstep(0.18, 0.7, d / iA.w);   // a puff fades as the camera nears its middle, long before its quad could cut the view
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform sampler2D uMap; uniform vec3 uL; uniform vec3 uSun; uniform vec3 uSkyA; uniform vec3 uGndA; uniform vec3 uGlow; uniform float uVeil; uniform float uGrey;
varying vec2 vUv; varying vec3 vWp; varying vec4 vB; varying vec3 vR; varying vec3 vU; varying vec3 vF; varying float vK;
#include <fog_pars_fragment>
void main() {
  if (vB.w < -0.5) {   // the sky veil (flag in vB.w): no texture, just the fog's colour below
    gl_FragColor = vec4(0.0, 0.0, 0.0, uVeil);
  } else {
    vec4 t = texture2D(uMap, vUv);
    float th = max(vB.y - vB.x, 1.0), h = clamp((vWp.y - vB.x) / th, 0.0, 1.0);
    float a = t.a * vB.z * vK * smoothstep(-0.04, 0.1, (vWp.y - vB.x) / th);   // the flat cumulus base
    if (a < 0.004) discard;
    vec2 q = t.rg * 2.0 - 1.0;
    vec3 n = normalize(vR * q.x + vU * q.y + vF * (sqrt(max(1.0 - dot(q, q), 0.05)) + 0.4));   // the lobes' bulge, softened: a full one turns each puff into a ball under a low sun
    float sunSide = clamp(dot(n, uL) * 0.45 + 0.55, 0.0, 1.0);
    float shade = mix(0.5, 1.0, smoothstep(0.0, 0.85, h)) * mix(1.0, 0.8, t.b * (1.0 - h));    // the lower and thicker parts sit in the cloud's own shade
    vec3 v = normalize(vWp - cameraPosition);
    float fwd = pow(max(dot(v, uL), 0.0), 8.0) * (1.0 - t.a * 0.8) * 0.8;   // the silver edge looking towards the sun: only on the frayed fringes (the thin middle of every puff would ring each one)
    vec3 col = uSun * (sunSide * shade + fwd * (1.0 - uGrey)) + mix(uGndA, uSkyA, clamp(h * 0.75 + n.y * 0.35, 0.0, 1.0)) + uGlow * (1.0 - h) * (1.0 - h);
    col *= (1.0 - 0.3 * uGrey) * (1.0 - uGrey * (0.5 - 0.3 * h) * (0.6 + 0.4 * t.b));   // a grey sky's clouds: duller all over, dark heavy undersides
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
  #include <fog_fragment>
}`;

// three.js's ACES filmic curve, for the colour of the fog inside a cloud (fog mixes after tone mapping, so it has to be given as the puffs show)
function aces(c, expo) {
  const k = expo / 0.6;
  let r = c.r * k, g = c.g * k, b = c.b * k;
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b, ig = 0.07600 * r + 0.90834 * g + 0.01566 * b, ib = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  const rtt = x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081);
  const fr = rtt(ir), fg = rtt(ig), fb = rtt(ib);
  return c.setRGB(clamp(1.60475 * fr - 0.53108 * fg - 0.07367 * fb, 0, 1), clamp(-0.10208 * fr + 1.10813 * fg - 0.00605 * fb, 0, 1), clamp(-0.00327 * fr - 0.07276 * fg + 1.07602 * fb, 0, 1));
}

// ------------------------------------------------------------------------------------------------ the shadows on the ground
// Not a second shadow map: a cloud's shadow is soft, kilometres wide and the sun is the same for all of them, so each puff's footprint is painted, as
// the sun projects it onto sea level, into a 256 x 256 texture of the 16 km round the camera (62 m a texel, smooth enough with linear filtering), and a
// surface at height y looks itself up at its own projection onto sea level, x - y * Lx / Ly: one lookup, exact for every height, from the street to
// Monte Cuccio, with no reading of the ground on the CPU. A sphere's shadow on the ground is an ellipse stretched by 1 / Ly along the sun's azimuth,
// so the puffs are painted as such. Red is how much of the sun a cloud takes there; green the height of the cloud's middle (8 m steps), above which
// nothing is shaded by it (the wings above the clouds, a summit poking out). At the rim the filtering mixes the green with the empty texels round it, so
// a summit right under a cloud's edge loses the shadow a little early: only on the soft edge, where nobody can tell.
// The painting is spread over a few frames into a second buffer (a few thousand texels a frame), then the two swap: in between, the shader moves the
// last finished picture along with the wind, so the shadows glide every frame. Few ALU, one RG8 lookup per lit pixel, 128 KB, behind a uniform
// branch that skips it all at night and on ?clouds=off is not even compiled. Day only: under the moon the city's light is the lamps.
// Low graphics keeps them: measured, the lookup is about 3 % of the GPU's frame at 16 times the phone's pixels and the painting under 0.1 ms a frame
// at a 4x CPU slowdown, and without them the clouds float over a city they do not touch.
export const CLOUD_SHADOWS = new URLSearchParams(location.search).get('clouds') !== 'off';
const SS = 256, SPAN = 16000, TEX = SPAN / SS;    // the shadow texture: texels a side, metres it covers
const SH_K = 0.72;                                // how much of the sun a thick cloud takes (the rest is the light it lets through and scatters down)
const SH_PER = 8;                                 // clouds painted a frame: a new picture every 11 frames or so
const shBuf = [new Uint8Array(SS * SS * 2), new Uint8Array(SS * SS * 2)];
const shTex = new THREE.DataTexture(shBuf[0], SS, SS, THREE.RGFormat);
shTex.colorSpace = THREE.NoColorSpace; shTex.generateMipmaps = false; shTex.minFilter = shTex.magFilter = THREE.LinearFilter; shTex.unpackAlignment = 2;
shTex.needsUpdate = true;
// The shared uniforms (the same objects in every material that has the lookup): the texture; the box (x0, z0 of the picture as it is now, 1 / SPAN);
// x, y: Lx / Ly and Lz / Ly of the sun the picture was painted for, z: strength (0 skips the lookup), w unused.
export const CLOUD_U = { uCloudTex: { value: shTex }, uCloudBox: { value: new THREE.Vector4(0, 0, 1 / SPAN, 1 / SPAN) }, uCloudL: { value: new THREE.Vector4(0, 0, 0, 0) } };
export const CLOUD_GLSL = `
uniform sampler2D uCloudTex; uniform vec4 uCloudBox; uniform vec4 uCloudL;
float cloudSun(vec3 p) {   // the share of the sun that gets past the clouds to world point p (src/clouds.js); call it only when uCloudL.z > 0
  vec2 c = texture2D(uCloudTex, (p.xz - p.y * uCloudL.xy - uCloudBox.xy) * uCloudBox.zw).rg;
  float mid = c.g * 2040.0;
  return 1.0 - uCloudL.z * c.r * smoothstep(mid + 60.0, mid - 60.0, p.y);
}
`;

// ------------------------------------------------------------------------------------------------ the field
// Build-up that stays over the mountains of the Conca d'Oro (the heights round them read from the far terrain): Monte Cuccio to the west, the ridge
// south-west of Monreale, Monte Grifone to the south, the hills towards Torretta to the north-west. They do not drift: they are made there.
const ANCHORS = [[-8500, 0, 1500], [-6500, 10000, 1400], [2500, 5500, 1250], [-8500, -5000, 1100]];
function makeClouds() {
  const rnd = mulberry32(SEED), out = [];
  for (let i = 0; i < NCLOUD + ANCHORS.length; i++) out.push(oneCloud(rnd, ANCHORS[i - NCLOUD]));
  const r2 = mulberry32(SEED ^ 0x3d1f0b5);   // (a stream of their own: the clouds above are the ones that shipped)
  for (const c of out) c.rank = c.fixed ? 0.03 : 0.08 + 0.77 * r2();
  for (let i = 0; i < EXTRA; i++) { const c = oneCloud(r2); c.rank = 1.02 + 0.85 * r2(); out.push(c); }
  return out;
}
function oneCloud(rnd, A) {   // a cloud's shape and place from the stream rnd; A: one of the anchors over the mountains
  const s = rnd(), W = A ? A[2] : 480 + 1050 * Math.pow(s, 1.8), H = W * (0.26 + rnd() * 0.2);   // width and thickness (m): mostly small, a few big ones, wider than tall
  const n = Math.min(15, Math.round(5 + W / 140));
  const ang = rnd() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang), stretch = 1 + rnd() * 0.6;
  const puffs = [];
  for (let k = 0; k < n; k++) {
    // in layers, the order also the order of importance (Low and the far clouds keep the first ones): the body, a wide flat skirt, then the towers on top
    const f = k / n, layer = k < 2 ? 0 : f < 0.55 ? 1 : 2, a = rnd() * Math.PI * 2;
    const rr = layer === 0 ? rnd() * 0.1 : layer === 1 ? 0.2 + Math.sqrt(rnd()) * 0.3 : Math.sqrt(rnd()) * 0.24;
    const y = (layer === 0 ? 0.4 : layer === 1 ? 0.2 + rnd() * 0.15 : 0.5 + rnd() * 0.35 * (1 - rr / 0.3)) * H;
    const r = (layer === 0 ? 0.38 : layer === 1 ? 0.25 + 0.08 * rnd() : 0.2 + 0.08 * rnd()) * W;   // big and overlapping: one mass, not a bunch of balls
    const lx = Math.cos(a) * rr * stretch, lz = Math.sin(a) * rr;
    puffs.push({ x: (lx * ca - lz * sa) * W, z: (lx * sa + lz * ca) * W, y, r, rot: rnd() * Math.PI * 2, v: (rnd() * 4) | 0, seed: rnd() });
  }
  return {
    x0: A ? A[0] : (rnd() - 0.5) * TILE, z0: A ? A[1] : (rnd() - 0.5) * TILE, fixed: !!A, W, H, base0: 450 + rnd() * 170, op: 0.88 + rnd() * 0.12, puffs, keep: Math.ceil(n * 0.5),
    // live state: where it is, how big the land under it lets it grow (k), its base; sx, sz where the ground was last read
    x: 0, z: 0, k: 1, kT: 1, base: 0, baseT: 0, sx: 1e9, sz: 1e9, seen: false, rank: 0, a: 1, g: 1,   // rank, a, g: the weather's (above)
  };
}

export function createClouds({ scene, renderer, camera, sky, sun, hemi, game, SUN_DIR }) {
  const params = new URLSearchParams(location.search);
  if (params.get('clouds') === 'off') return { update() {}, setQuality() {}, enabled: false };
  // The Sky addon's own painted clouds (r187 draws them at coverage 0.4 unless told otherwise): flat, never moving, gone at dusk when the twilight
  // gradient takes the dome over, and an fbm over every sky pixel. The 3D clouds replace them.
  const skyCov = sky?.material?.uniforms?.cloudCoverage, cov0 = skyCov ? skyCov.value : 0;
  if (skyCov) skyCov.value = 0;

  const clouds = makeClouds();
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  const data = new Float32Array(MAXP * STRIDE), stage = new Float32Array(MAXP * STRIDE), keys = new Uint32Array(MAXP);
  const ib = new THREE.InstancedInterleavedBuffer(data, STRIDE, 1); ib.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iA', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  geo.setAttribute('iB', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  geo.setAttribute('iC', new THREE.InterleavedBufferAttribute(ib, 4, 8));
  geo.instanceCount = 0;

  const U = {
    uMap: { value: puffTexture() }, uL: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Color() }, uSkyA: { value: new THREE.Color() },
    uGndA: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uVeil: { value: 0 }, uGrey: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), vertexShader: VERT, fragmentShader: FRAG,
    fog: true, transparent: true, depthWrite: false, depthTest: true,
  });
  Object.assign(mat.uniforms, U);   // (merge would clone the texture and colours; these are the live ones)
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.castShadow = mesh.receiveShadow = false;
  mesh.renderOrder = -5;   // after the sea (-10, which writes depth) and before the near transparent things (lamp halos, sprites, at 0 and up): the clouds are behind them
  mesh.name = 'clouds';
  scene.add(mesh);

  let lowTier = false, drift = 0, rr = 0, inside = 0, first = true;
  const DOME = new THREE.Color('#c8742a'), _c = new THREE.Color(), _d = new THREE.Color(), fogIn = new THREE.Color();
  const LUM = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  // the ground under a cloud, read at its middle and four points round it: the base stays 200 m over the highest, and the cloud grows over high ground
  function readGround(c) {
    const r = c.W * 0.5;
    let hi = -1e9, sum = 0;
    for (let k = 0; k < 5; k++) {
      const x = c.x + (k === 1 ? r : k === 2 ? -r : 0), z = c.z + (k === 3 ? r : k === 4 ? -r : 0), y = groundY(x, z);
      hi = Math.max(hi, y); sum += y;
    }
    const mean = sum / 5;
    c.kT = mean < 2 ? 0.5 : 0.85 + 0.75 * ss(40, 700, mean);        // smaller over the sea, bigger over the mountains
    c.baseT = Math.max(c.base0, hi + 200 + 0.2 * c.H * (c.kT - 1));
    c.sx = c.x; c.sz = c.z;
  }

  let on = true;
  function update(dt) {
    if (game.state !== 'pause') drift += dt;
    if (!on) return;
    const cam = camera.position, t = game.time || {}, night = t.night || 0;
    // -- colours, from what src/daynight.js put on the lights this frame (linear). The direct light is the sun by day and the moon at night (SUN_DIR).
    U.uL.value.copy(SUN_DIR);
    _c.copy(sun.color).multiplyScalar(sun.intensity * 0.55 * (1 - 0.55 * night));   // moonlit, but faint
    const sat = lerp(0.35, 1, Math.max(ss(0.45, 0.1, SUN_DIR.y), night));   // the game's sun is golden all day: high up the clouds read white, low (morning, evening) they take its colour
    const l = LUM(_c); _c.r = lerp(l, _c.r, sat); _c.g = lerp(l, _c.g, sat); _c.b = lerp(l, _c.b, sat);
    U.uSun.value.copy(_c);
    U.uSkyA.value.copy(hemi.color).multiplyScalar(hemi.intensity * 1.9);
    U.uGndA.value.copy(hemi.groundColor).lerp(hemi.color, 0.7).multiplyScalar(hemi.intensity * 1.55);   // the undersides: grey, not the brown of the streets
    U.uGlow.value.copy(DOME).multiplyScalar(0.07 * night);   // the city's sodium light on the undersides
    const opK = 1 - 0.35 * night;
    U.uGrey.value = WX.cGrey;

    // -- clouds round the camera, puffs into the staging buffer with their sort keys (far first)
    let n = 0, near = 0;
    const ei = inside * inside * (3 - 2 * inside), hidden = 2.3 / lerp(scene.fog.density, IN_FOG, ei * ei);   // past this the fog (last frame's, inside a cloud) leaves nothing of a puff to see
    const qk = MAXP <= 1024 ? 1024 : 2048, dx0 = WIND.x * drift, dz0 = WIND.y * drift;
    keys.fill(0xffffffff);
    rr = (rr + 1) % clouds.length;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      let x = c.x0 - cam.x, z = c.z0 - cam.z;
      if (!c.fixed) { x += dx0; z += dz0; }
      x -= Math.round(x / TILE) * TILE; z -= Math.round(z / TILE) * TILE;
      const dh = Math.sqrt(x * x + z * z), fade = 1 - ss(FADE0, FADE1, dh);
      c.x = x + cam.x; c.z = z + cam.z;
      c.a = ss(c.rank, c.rank + 0.12, WX.cov);   // the weather: shown as the coverage passes its rank, growing as it comes
      if (fade <= 0 || c.a <= 0) { c.seen = false; continue; }
      c.g = WX.cSize * (0.55 + 0.45 * c.a);
      const jumped = Math.abs(c.x - c.sx) + Math.abs(c.z - c.sz) > 1500;   // first sight, a wrap or a teleport: read the ground and take it at once
      if (!c.seen || jumped || first) { readGround(c); c.k = c.kT; c.base = c.baseT; }
      else {
        if (i === rr) readGround(c);   // one cloud a frame: each is read every second and a half or so
        const e = 1 - Math.exp(-dt / 8); c.k += (c.kT - c.k) * e; c.base += (c.baseT - c.base) * e;
      }
      c.seen = true;
      const ck = c.k * c.g, H = c.H * c.k * (0.8 + 0.4 * c.k) * c.g, top = c.base + H * 1.05, alpha = fade * c.op * opK * c.a;   // over the mountains they also tower
      const lod = lowTier ? 1 : ss(LOD0, LOD1, Math.sqrt(dh * dh + (c.base - cam.y) ** 2)), np = lod >= 1 ? c.keep : c.puffs.length;
      const k = ck * (1 + 0.2 * lod);
      const cy = cam.y - c.base, cr = c.W * ck * 0.9;
      const close = dh < cr + 50 && cy > -100 && cy < H + 100;   // the camera may be in this one
      for (let p = 0; p < np && n < MAXP - 1; p++) {
        const P = c.puffs[p], br = 1 + 0.05 * Math.sin(drift * 0.07 + P.seed * 40);   // puffs breathe a little
        const px = c.x + P.x * ck, py = c.base + P.y * H / c.H, pz = c.z + P.z * ck, r = P.r * k * br, pa = p < c.keep ? alpha : alpha * (1 - lod);
        const ex = px - cam.x, ey = py - cam.y, ez = pz - cam.z, d = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (close) near = Math.max(near, 1 - ss(0.3 * r, 0.62 * r, d));
        if (d < 0.19 * r || d - r > hidden || pa < 0.004) continue;   // faded out round the camera, lost in the fog, or gone: no quad to fill
        const o = n * STRIDE;
        stage[o] = px; stage[o + 1] = py; stage[o + 2] = pz; stage[o + 3] = r;
        stage[o + 4] = c.base; stage[o + 5] = top; stage[o + 6] = pa; stage[o + 7] = 0;
        stage[o + 8] = P.rot + drift * 0.004 * (P.seed - 0.5); stage[o + 9] = P.v; stage[o + 10] = P.seed; stage[o + 11] = 0;
        keys[n] = ((65535 - Math.min(65535, Math.round(d * 4))) * qk + n) >>> 0;   // far first; quarter metres, then the slot
        n++;
      }
    }
    keys.sort();
    if (CLOUD_SHADOWS && !shOff) shadows(night);
    first = false;

    // -- inside a cloud: the fog closes in to the cloud's colour, and the veil covers the sky the fog does not reach
    inside += (near - inside) * (1 - Math.exp(-dt * 5));
    if (inside < 1e-3) inside = 0;
    let w = 0;
    if (inside > 0) {
      // what a cloud is from inside (bright, the sun scattered all round), through the same tone curve the puffs go through
      _d.copy(U.uSun.value).multiplyScalar(1.1).add(_c.copy(U.uSkyA.value).lerp(U.uGndA.value, 0.25).multiplyScalar(1.15));
      const ld = LUM(_d); _d.r = lerp(ld, _d.r, 0.6); _d.g = lerp(ld, _d.g, 0.6); _d.b = lerp(ld, _d.b, 0.6);   // the light inside is scattered every way: paler than any one face (at sunset a full-strength sun colour reads salmon)
      aces(_d, renderer.toneMappingExposure);
      fogIn.setRGB(_d.r, _d.g, _d.b, THREE.SRGBColorSpace);   // fog mixes into the finished screen colour, so it is given as the screen shows it
      const f = scene.fog, e = inside * inside * (3 - 2 * inside);
      const d0 = f.density;
      f.color.lerp(fogIn, e); f.density = lerp(d0, IN_FOG, e * e);
      const F = k => 1 - Math.exp(-(k * VEIL_D) * (k * VEIL_D)), f0 = F(d0);
      U.uVeil.value = (F(f.density) - f0) / Math.max(1e-3, 1 - f0);   // the sky whitens as much as the far ground does on top of its usual haze, so no horizon line shows between them
      const o = 0;   // the veil goes first: it is the farthest thing drawn
      camera.getWorldDirection(_v);
      const r = VEIL_D * Math.tan(camera.fov * Math.PI / 360) * Math.max(camera.aspect, 1) * 1.6;
      data[o] = cam.x + _v.x * VEIL_D; data[o + 1] = cam.y + _v.y * VEIL_D; data[o + 2] = cam.z + _v.z * VEIL_D; data[o + 3] = r;
      data[o + 4] = 0; data[o + 5] = 1; data[o + 6] = 1; data[o + 7] = -1;
      data[o + 8] = 0; data[o + 9] = 0; data[o + 10] = 0; data[o + 11] = 1;
      w = 1;
    } else U.uVeil.value = 0;
    for (let s = 0; s < n; s++) {
      const src = (keys[s] % qk) * STRIDE, dst = (s + w) * STRIDE;
      for (let q = 0; q < STRIDE; q++) data[dst + q] = stage[src + q];
    }
    const total = n + w;
    ib.clearUpdateRanges(); ib.addUpdateRange(0, total * STRIDE); ib.needsUpdate = true;
    geo.instanceCount = total;
    mesh.visible = total > 0;
    stats.puffs = n; stats.inside = inside;
  }
  const _v = new THREE.Vector3();
  const stats = { puffs: 0, inside: 0, pictures: 0 };

  // -- the shadows (above, 'the shadows on the ground'). PIC is the picture being painted (PIC.i the next cloud, -1 between pictures), SHOW the one shown.
  const PIC = { i: -1, d0: 0, ox: 0, oz: 0, lx: 0, lz: 0, ly: 1, ax: 1, az: 0, cx: 0, cz: 0 }, SHOW = { d0: 0, ox: 0, oz: 0, lx: 0, lz: 0 };
  let front = 0, shAll = true, shOff = false;
  function shStart() {
    const L = SUN_DIR, cam = camera.position, ly = Math.max(L.y, 0.02), hl = Math.hypot(L.x, L.z), g = groundY(cam.x, cam.z) || 0;
    PIC.lx = L.x / ly; PIC.lz = L.z / ly; PIC.ly = Math.max(L.y, 0.15);   // (the stretch stops at 6.7 times: under that the shadows have faded out anyway)
    PIC.ax = hl > 1e-4 ? L.x / hl : 1; PIC.az = hl > 1e-4 ? L.z / hl : 0;
    PIC.ox = cam.x - g * PIC.lx - SPAN / 2; PIC.oz = cam.z - g * PIC.lz - SPAN / 2;   // centred where the ground round the camera looks itself up
    PIC.cx = cam.x; PIC.cz = cam.z; PIC.d0 = drift; PIC.i = 0;
    shBuf[1 - front].fill(0);
  }
  function shPaint(c, buf) {   // one cloud's puffs (the body and the skirt: the towers stand over them), where they were at PIC.d0, projected onto sea level
    const cam = camera.position, dd = c.fixed ? 0 : drift - PIC.d0, x = c.x - WIND.x * dd, z = c.z - WIND.y * dd;
    const a = (1 - ss(FADE0, FADE1, Math.hypot(x - cam.x, z - cam.z))) * c.op * c.a, ck = c.k * c.g;
    if (a < 0.01) return;
    const H = c.H * c.k * (0.8 + 0.4 * c.k) * c.g, mid = Math.min(255, Math.round((c.base + H * 0.5) / 8)), a2 = a * 255 * 2.5;   // 2.5: flat inside, a soft rim over the outer 60 %
    const { ax, az, ly, lx, lz, ox, oz } = PIC;
    for (let p = 0; p < c.keep; p++) {
      const Q = c.puffs[p], r = Q.r * ck * 0.9, py = c.base + Q.y * H / c.H;   // 0.9: the puff texture's soft disc is a little inside its quad
      const X = x + Q.x * ck - py * lx - ox, Z = z + Q.z * ck - py * lz - oz;
      const ra = r / ly, ia = 1 / (ra * ra), ib = 1 / (r * r);
      const ex = Math.sqrt(ra * ra * ax * ax + r * r * az * az), ez = Math.sqrt(ra * ra * az * az + r * r * ax * ax);   // the box round the ellipse
      const i0 = Math.max(1, Math.ceil((X - ex) / TEX - 0.5)), i1 = Math.min(SS - 2, Math.floor((X + ex) / TEX - 0.5));   // the outer ring stays 0: beyond the box, no shadow
      const j0 = Math.max(1, Math.ceil((Z - ez) / TEX - 0.5)), j1 = Math.min(SS - 2, Math.floor((Z + ez) / TEX - 0.5));
      for (let j = j0; j <= j1; j++) {
        const dz = (j + 0.5) * TEX - Z;
        for (let i = i0, o = (j * SS + i0) * 2; i <= i1; i++, o += 2) {
          const dx = (i + 0.5) * TEX - X, u = dx * ax + dz * az, v = dz * ax - dx * az, q = u * u * ia + v * v * ib;
          if (q >= 1) continue;
          const val = Math.min(255, (1 - q) * a2);
          if (buf[o] < val) buf[o] = val;
          if (buf[o + 1] < mid) buf[o + 1] = mid;
        }
      }
    }
  }
  function shadows(night) {
    // by day only: gone as the sun gets low (they stretch kilometres away from their clouds by then) and before the moon takes over the light
    const k = SH_K * WX.shK * ss(0.07, 0.2, SUN_DIR.y) * ss(0.02, 0, night), L = CLOUD_U.uCloudL.value;   // (less sun under a grey sky: weaker patches, src/weather.js)
    if (k <= 0) { L.z = 0; shAll = true; return; }   // nothing to paint at night: a whole picture at once when the sun is back
    const cam = camera.position;
    if (Math.abs(cam.x - PIC.cx) + Math.abs(cam.z - PIC.cz) > 2000) shAll = true;   // a teleport: the picture round the old place is no use
    if (shAll || PIC.i < 0) shStart();
    const buf = shBuf[1 - front], end = shAll ? clouds.length : Math.min(clouds.length, PIC.i + SH_PER);
    for (; PIC.i < end; PIC.i++) if (clouds[PIC.i].seen) shPaint(clouds[PIC.i], buf);
    shAll = false;
    if (PIC.i >= clouds.length) {   // finished: show it
      front = 1 - front; shTex.image.data = shBuf[front]; shTex.needsUpdate = true;
      SHOW.d0 = PIC.d0; SHOW.ox = PIC.ox; SHOW.oz = PIC.oz; SHOW.lx = PIC.lx; SHOW.lz = PIC.lz; PIC.i = -1; stats.pictures++;
    }
    const dd = drift - SHOW.d0;
    CLOUD_U.uCloudBox.value.set(SHOW.ox + WIND.x * dd, SHOW.oz + WIND.y * dd, 1 / SPAN, 1 / SPAN);   // the shown picture moved on with the wind (the four clouds over the mountains too: a metre or so)
    L.set(SHOW.lx, SHOW.lz, k, 0);
  }

  // compiled now, while the game loads, like the night materials (src/daynight.js)
  try { geo.instanceCount = 1; renderer.compile(mesh, camera, scene); geo.instanceCount = 0; } catch (e) { console.warn('[clouds] not compiled ahead', e); }

  return {
    enabled: true, update, stats, mesh,
    setQuality(q) { lowTier = q === 'low'; },
    noShadows() { CLOUD_U.uCloudL.value.z = 0; },   // until the next update
    setShadows(v) { shOff = !v; shAll = true; if (shOff) CLOUD_U.uCloudL.value.z = 0; },   // tests: the shadows alone off (no painting, the lookup skipped)
    shadowAt(x, y, z) {   // tests: what the shaders see at a world point (1 in the sun), from the shown picture, nearest texel
      const L = CLOUD_U.uCloudL.value, B = CLOUD_U.uCloudBox.value;
      const i = Math.floor((x - y * L.x - B.x) / TEX), j = Math.floor((z - y * L.y - B.y) / TEX);
      if (L.z <= 0 || i < 0 || j < 0 || i >= SS || j >= SS) return 1;
      const o = (j * SS + i) * 2, d = shBuf[front], mid = d[o + 1] * 8;
      return 1 - L.z * d[o] / 255 * ss(mid + 60, mid - 60, y);
    },
    setOn(v) { on = !!v; mesh.visible = on; if (skyCov) skyCov.value = on ? 0 : cov0; if (!on) CLOUD_U.uCloudL.value.z = 0; else shAll = true; },   // tests: off is the sky as it was before (same page, same tiles), shadows too
    setDrift(s) { drift = s; for (const c of clouds) c.seen = false; shAll = true; },   // tests: the same sky every time
    get drift() { return drift; },
    clouds,
  };
}
