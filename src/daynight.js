// Day/night cycle. Owned by the day/night work.
//
//   const dn = createDayNight({ scene, renderer, sun, sky, hemi, camera, game, SUN_DIR, car, vehicle });
//   dn.update(dt)   // every frame, before the camera is placed and the frame rendered
//
// game.time = { hour 0..24, isNight, night 0..1 (0 day, 1 dark), dusk 0..1 (twilight, peaks as the sun touches the horizon),
//               day 1-night, sunUp, speed (game hours per real second) } is rewritten every frame. A 'pd-time' window event
// { hour, isNight, night, dusk } fires every two game minutes (and on a time jump) for modules that want to react.
//
// Drives: sun/moon direction and colour (SUN_DIR is the live light direction, mutated in place), the physical sky (patched so it
// hands over to a pink-lilac twilight gradient, stars and a moon), fog, hemisphere light, exposure, the sky-gradient environment
// map (re-baked only while its colours move), the sea shader, street lamps (halo points + ground pools, no real lights), lit
// windows (a uniform read by the facade shader in buildings.js), the player's headlights and tail lamps, a clock under the minimap.
// Settings (game.settings.timeStart 'morning'|'afternoon'|'sunset'|'night', timeSpeed 'off'|'slow'|'normal'|'fast') come from the
// Options screen; ?time=HH (also 19.5) freezes the clock for screenshots, ?timespeed=MINUTES_PER_DAY lets it run again.
import * as THREE from 'three';
import { D, groundY, proj } from './core.js';
import { MAT } from './vehicle-art.js';

// Shared uniforms other modules read (buildings.js facade shader): imported, never copied.
export const NIGHT = { win: { value: 0 } };

const { clamp, lerp } = THREE.MathUtils;
const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }; // GLSL smoothstep(e0, e1, x); e0 > e1 reverses it
const DEG = Math.PI / 180;

export const START_HOURS = { morning: 7, afternoon: 16.5, sunset: 18.5, night: 22.5 };
export const DAY_MINUTES = { off: 0, slow: 96, normal: 48, fast: 16 }; // real minutes per game day
const DEFAULT_START = 'morning', DEFAULT_SPEED = 'normal';

// ------------------------------------------------------------------------------------------------ sun and moon
// Palermo (38.1 N), declination +5 degrees (spring/early autumn): sunrise 6:15, sunset 18:45, 60 degrees at noon.
// 16:30 puts the sun 26 degrees up in the WSW, which is the look the game had before it had a clock.
const LAT = 38.1 * DEG, DEC = 5 * DEG, NOON = 12.5;
function sunVector(hour, out) { // x east, y up, z south
  const H = (hour - NOON) * 15 * DEG;
  const sinAlt = Math.sin(LAT) * Math.sin(DEC) + Math.cos(LAT) * Math.cos(DEC) * Math.cos(H);
  const alt = Math.asin(sinAlt), az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(DEC) * Math.cos(LAT)); // az: from south, towards west
  out.set(-Math.sin(az) * Math.cos(alt), sinAlt, Math.cos(az) * Math.cos(alt));
  return alt;
}

// ------------------------------------------------------------------------------------------------ the palette over the day
// One keyframe per phase; everything between is blended (linear colour space). Hours are local clock time.
//  sun/sunI: direct light.  hemi*: sky/ground ambient.  fog/fogK: haze colour and density multiplier.  expo: tone-map exposure.
//  env*: the gradient baked into the reflection/ambient map.  skyH/skyZ/glow: the twilight sky (horizon, zenith, glow round the sun).
//  amb: multiplier on the sea body colour.  win: share of windows that may be lit.
const C = h => new THREE.Color(h);
const DAYK = {
  sun: '#ffe4bd', sunI: 2.9, hemiS: '#c9cfd4', hemiG: '#9a8566', hemiI: 0.4, fog: '#a9c4da', fogK: 1, expo: 0.85,
  envZ: '#8ea5bd', envH: '#d8d4cb', envB: '#8f7f68', skyH: '#a8cbe6', skyZ: '#3d7fc4', glow: '#ffd9a0', dome: '#000000', amb: '#ffffff', win: 0,
};
const K = (h, o) => { const k = { h, ...DAYK, ...o }; for (const f of ['sun', 'hemiS', 'hemiG', 'fog', 'envZ', 'envH', 'envB', 'skyH', 'skyZ', 'glow', 'dome', 'amb']) k[f] = C(k[f]); return k; };
const NIGHTK = { // Palermo after dark: saturated indigo sky, an orange light dome over the roofs, cool navy shadows, warm brown bounce from the streets
  sun: '#000000', sunI: 0, hemiS: '#26385c', hemiG: '#3a3028', hemiI: 0.62, fog: '#18224a', fogK: 1.25, expo: 1.2,
  envZ: '#16264e', envH: '#5a3a24', envB: '#34281c', skyH: '#1a2c60', skyZ: '#0a1538', glow: '#5a6aa8', dome: '#c8742a', amb: '#0c1530', win: 0.5,
};
const KEYS = [
  K(0, { ...NIGHTK, win: 0.3 }),
  K(3.5, { ...NIGHTK, win: 0.12 }),
  K(4.9, { ...NIGHTK, win: 0.2 }),
  K(5.6, { sun: '#7a6a98', sunI: 0.15, hemiS: '#5a6490', hemiG: '#3a3440', hemiI: 0.5, fog: '#6a6a92', fogK: 1.5, expo: 1.08, envZ: '#34407a', envH: '#8a7e9a', envB: '#2a2630', skyH: '#8878a0', skyZ: '#242f6a', glow: '#c08aa0', amb: '#3a3c58', win: 0.25 }),
  K(6.25, { sun: '#ffb585', sunI: 1.4, hemiS: '#b4a8bc', hemiG: '#7a6660', hemiI: 0.38, fog: '#c0aab6', fogK: 1.45, expo: 0.95, envZ: '#7088b8', envH: '#e6b49c', envB: '#74605e', skyH: '#f4b196', skyZ: '#5f7cbc', glow: '#ff9c6a', amb: '#c9a8a0', win: 0 }),
  K(7.4, { sun: '#ffd4a0', sunI: 2.6, hemiS: '#c2cbd4', hemiG: '#968068', hemiI: 0.4, fog: '#b6c4d6', fogK: 1.15, expo: 0.87, envZ: '#869fbd', envH: '#dccdb8', envB: '#8c7c66', amb: '#e8dcd0' }),
  K(9, {}),
  K(16.5, {}),
  K(17.7, { sun: '#ffbe78', sunI: 2.6, hemiS: '#d4c8c8', hemiG: '#9a7c68', hemiI: 0.42, fog: '#c4bcc4', fogK: 1.2, expo: 0.88, envZ: '#869cc0', envH: '#e4c4aa', envB: '#8a7260', skyH: '#f0b894', skyZ: '#7d9fd0', amb: '#e8d8d0', win: 0 }),
  K(18.7, { sun: '#ff8f55', sunI: 1.5, hemiS: '#b9a5bb', hemiG: '#7c6460', hemiI: 0.38, fog: '#b6a6a9', fogK: 1.5, expo: 0.95, envZ: '#6a6e9e', envH: '#e5a28c', envB: '#6e5a5e', skyH: '#f2998a', skyZ: '#5a68a8', glow: '#ff8a5a', amb: '#c4a0a0', win: 0 }),
  K(19.1, { sun: '#e0607a', sunI: 0.3, hemiS: '#6a74a0', hemiG: '#4a3a38', hemiI: 0.46, fog: '#7a7098', fogK: 1.65, expo: 1.05, envZ: '#26407a', envH: '#946a80', envB: '#3a3036', skyH: '#8a6a98', skyZ: '#22348a', glow: '#e07a70', dome: '#8a4a28', amb: '#5a5070', win: 0.2 }),
  K(19.7, { sun: '#503060', sunI: 0, hemiS: '#34508a', hemiG: '#3c2c24', hemiI: 0.55, fog: '#2e4488', fogK: 1.5, expo: 1.12, envZ: '#1c3278', envH: '#6a4a38', envB: '#2c2220', skyH: '#2f58b0', skyZ: '#0e2a88', glow: '#5a5a98', dome: '#c8742a', amb: '#202c52', win: 0.45 }),
  K(20.7, { sun: '#000000', sunI: 0, hemiS: '#2c4270', hemiG: '#382c24', hemiI: 0.58, fog: '#1e2c5c', fogK: 1.35, expo: 1.16, envZ: '#182c60', envH: '#5e4028', envB: '#30261e', skyH: '#243c78', skyZ: '#0e1e56', glow: '#3a4678', dome: '#c0682a', amb: '#141e3c', win: 0.5 }),
  K(21.4, { ...NIGHTK }),
  K(24, { ...NIGHTK, win: 0.3 }),
];
const MOON = C('#8ea2d0');

const P = { // the blended palette for the current hour (reused every frame)
  sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), fog: new THREE.Color(), envZ: new THREE.Color(), envH: new THREE.Color(),
  envB: new THREE.Color(), skyH: new THREE.Color(), skyZ: new THREE.Color(), glow: new THREE.Color(), dome: new THREE.Color(), amb: new THREE.Color(),
  sunI: 0, hemiI: 0, fogK: 1, expo: 0.85, win: 0,
};
const COLS = ['sun', 'hemiS', 'hemiG', 'fog', 'envZ', 'envH', 'envB', 'skyH', 'skyZ', 'glow', 'dome', 'amb'], NUMS = ['sunI', 'hemiI', 'fogK', 'expo', 'win'];
function palette(hour) {
  let i = 0; while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((hour - a.h) / (b.h - a.h), 0, 1), e = t * t * (3 - 2 * t);
  for (const c of COLS) P[c].copy(a[c]).lerp(b[c], e);
  for (const n of NUMS) P[n] = lerp(a[n], b[n], e);
}

// ------------------------------------------------------------------------------------------------ the sky shader
// day sky targets (style guide section 6): horizon #8ac8f7, zenith #3a7ebf; in the shader's own (pre-tone-mapping) space, calibrated against the rendered pixels
const DAY_SKY_H = '#6cc2fb', DAY_SKY_Z = '#1a58b0';
const SKY_UNIFORMS = `
uniform float uMix; uniform float uTime; uniform float uStars; uniform float uSunVis;
uniform vec3 uDayH; uniform vec3 uDayZ; uniform float uDayG; uniform vec3 uSkyH; uniform vec3 uSkyZ; uniform vec3 uGlow; uniform vec3 uDome; uniform vec3 uSunV; uniform vec3 uMoonV; uniform float uMoon;
float pdHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 pdTwilight(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 g = mix(uSkyH, uSkyZ, pow(h, 0.42));
  float s = max(dot(d, uSunV), 0.0);
  g += uGlow * (pow(s, 5.0) * 0.32 + pow(s, 34.0) * 0.42) * (1.0 - 0.55 * h);
  float dm = max(uDome.r, max(uDome.g, uDome.b));   // sodium light dome over the city: the horizon turns amber (a mix, so it never goes mauve), weaker on the sea side
  g = mix(g, uDome / max(dm, 0.001) * 0.66, exp(-abs(d.y) * 9.0) * clamp(dm * 1.8, 0.0, 0.9) * (0.6 + 0.4 * clamp(d.z * 0.7 + 0.35, 0.0, 1.0)));
  g += uGlow * 0.18 * exp(-abs(d.y) * 9.0);                                        // the horizon band is the brightest part
  g += vec3(1.0, 0.82, 0.6) * (smoothstep(0.99996, 0.999985, s) * 6.0 + pow(s, 900.0) * 1.2) * uSunVis;  // sun disc (while it is above the sea)
  if (uStars > 0.01 && d.y > 0.0) {
    vec3 q = d * 130.0, id = floor(q), f = fract(q) - 0.5;
    float hh = pdHash(id);
    if (hh > 0.962) {
      vec3 off = vec3(pdHash(id + 1.7), pdHash(id + 3.1), pdHash(id + 5.3)) - 0.5;
      float dist = length(f - off * 0.6);
      float tw = 0.78 + 0.22 * sin(uTime * (1.3 + hh * 3.0) + hh * 60.0);
      float b = (1.0 - smoothstep(0.0, 0.32, dist)) * (0.35 + (hh - 0.962) * 26.0) * tw;
      g += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), pdHash(id + 9.1)) * b * uStars * smoothstep(0.0, 0.18, d.y);
    }
  }
  if (uMoon > 0.01) {
    float m = dot(d, uMoonV);
    vec3 side = normalize(cross(uMoonV, vec3(0.0, 1.0, 0.0)));
    vec3 up2 = cross(side, uMoonV);
    vec2 lc = vec2(dot(d - uMoonV * m, side), dot(d - uMoonV * m, up2)) / 0.024;
    float disc = (1.0 - smoothstep(0.92, 1.0, length(lc))) * step(0.0, m);
    float maria = 0.78 + 0.22 * sin(lc.x * 5.0 + sin(lc.y * 4.0) * 1.6) * sin(lc.y * 3.0 - lc.x * 2.0);
    g += (vec3(1.0, 0.97, 0.88) * 2.4 * maria * disc + vec3(0.55, 0.65, 1.0) * (pow(max(m, 0.0), 70.0) * 0.16 + pow(max(m, 0.0), 700.0) * 0.4)) * uMoon;
  }
  return g;
}
`;
function patchSky(sky) {
  const u = sky.material.uniforms;
  Object.assign(u, {
    uMix: { value: 0 }, uTime: { value: 0 }, uStars: { value: 0 }, uSunVis: { value: 1 }, uMoon: { value: 0 },
    uDayH: { value: new THREE.Color(DAY_SKY_H) }, uDayZ: { value: new THREE.Color(DAY_SKY_Z) }, uDayG: { value: 0.4 },
    uSkyH: { value: new THREE.Color() }, uSkyZ: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uDome: { value: new THREE.Color() },
    uSunV: { value: new THREE.Vector3(0, 1, 0) }, uMoonV: { value: new THREE.Vector3(0, -1, 0) },
  });
  // The physical sky is far brighter than the city under our exposure and ACES clips it to white: scale its output down (0.42) so the
  // zenith reads the saturated blue of a clear Palermo day. r183 dropped Sky's legacy gamma (retColor = pow(texColor, ...)); put it back.
  const m = /gl_FragColor = vec4\( ([^;]*?), 1\.0 \);/.exec(sky.material.fragmentShader);
  if (!m) { console.warn('[daynight] sky shader not recognised, leaving the day sky alone'); return; }
  const expr = m[1], day = expr.includes('0.42') ? expr : (expr.includes('texColor') && !expr.includes('pow') ? 'pow( texColor, vec3( 1.0 / 2.4 ) )' : expr) + ' * 0.42';
  sky.material.fragmentShader = SKY_UNIFORMS + sky.material.fragmentShader.replace(m[0],
    `vec3 dayCol = ${day};
     vec3 dirN = normalize( vWorldPosition - cameraPosition );
     { // x2: the physical sky reads pale grey-white (zenith 199, 207, 216 at 30 degrees up); the style guide wants a saturated clean blue, zenith #3a7ebf to horizon #8ac8f7. Blend towards that
       // gradient, less in the glow round the sun (the physical sky keeps the sun's halo), and more the higher the camera is (uDayG), so street level changes little
       vec3 dg = mix( uDayH, uDayZ, pow( clamp( dirN.y, 0.0, 1.0 ), 0.45 ) );
       float sc = max( dot( dirN, uSunV ), 0.0 );
       dayCol = mix( dayCol, dg, uDayG * ( 1.0 - 0.85 * pow( sc, 10.0 ) ) );
     }
     gl_FragColor = vec4( uMix > 0.001 ? mix( dayCol, pdTwilight( dirN ), uMix ) : dayCol, 1.0 );`);
  sky.material.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ small textures
function radial(stops, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beamTex() { // bright at the bottom (near the lamp), fading with distance and sideways
  const w = 64, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x / (w - 1) - 0.5) * 2, v = 1 - y / (h - 1); // v: 0 at the lamp, 1 at the far end
    const spread = 0.28 + 0.72 * v, lat = Math.exp(-(u * u) / (spread * spread) * 2.2), a = lat * Math.pow(1 - v, 0.95) * ss(0, 0.04, v);
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const HALO_VERT = `
attribute float aSize; attribute vec3 aCol; uniform float uScale; uniform float uAmt; varying vec3 vC; varying float vA;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 0.5);
  float px = aSize * uScale / dist;
  mvPosition.xyz *= 1.0 - 0.45 / dist;                    // pulled 0.45 m towards the eye so the lamp housing does not swallow its own glow
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(px, 2.5, 110.0);
  vA = uAmt * min(1.0, px / 2.5 + 0.25);
  vC = aCol;
  #include <fog_vertex>
}`;
const HALO_FRAG = `
varying vec3 vC; varying float vA;
#include <fog_pars_fragment>
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (exp(-r * r * 16.0) + exp(-r * r * 3.8) * 0.42) * (1.0 - smoothstep(0.78, 1.0, r));
  gl_FragColor = vec4(vC * a * vA, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
  gl_FragColor.rgb *= exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );   // additive light fades with the haze (mixing to the fog colour would paint a square)
  #endif
}`;

// ------------------------------------------------------------------------------------------------ createDayNight
export function createDayNight({ scene, renderer, sun, sky, hemi, camera, game, SUN_DIR, car, vehicle }) {
  const params = new URLSearchParams(location.search);
  const st = game.settings;
  patchSky(sky);
  const U = sky.material.uniforms;

  // ------------------------------------------------------------------------------------------ warm night wash on every standard material
  // Palermo's streets glow orange and the landmarks are floodlit from below. Instead of lights, every MeshStandardMaterial that exists
  // now gets a few shader lines (chained onto its own onBeforeCompile): at night the walls take a warm glow that fades with height above
  // street level, the floodlit landmarks a stronger one, and up-facing ground turns glossy so it reflects the orange horizon of the env map.
  // One shared uniform block, no extra passes, a single branch that is skipped by day.
  const NK = { value: new THREE.Vector4(0, 0.3, 0, 1) }; // x night amount (lamps on), y street bounce, z street level (m), w paving gloss
  const FLOOD = [ // [lat, lon, radius m, strength]
    [38.115684, 13.361460, 60, 0.8], [38.1199, 13.3573, 90, 1.0], [38.1146, 13.3558, 90, 1.0], [38.1112, 13.3540, 95, 0.9],
    [38.1151, 13.3622, 55, 0.85], [38.12865, 13.35672, 85, 0.9], [38.11052, 13.35243, 55, 0.9],
  ].map(([la, lo, r, k]) => { const [x, z] = proj(la, lo); return new THREE.Vector4(x, z, r, k); });
  const FL = { value: FLOOD.concat(Array.from({ length: 7 - FLOOD.length }, () => new THREE.Vector4(0, 0, 1, 0))) };
  NK.value.z = groundY(0, 0);
  const LT = { value: new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1) }, LB = { value: new THREE.Vector4(0, 0, 1, 1) }; // lamp/street light field (built the first time it gets dark)
  LT.value.needsUpdate = true;
  const WASH_DECL = 'uniform vec4 uNightK;\nuniform vec4 uFlood[7];\nuniform sampler2D uLampTex;\nuniform vec4 uLampBox;\n';
  const WASH_ROUGH = `
    #ifndef FLAT_SHADED
    if (uNightK.x > 0.002) { vec3 gn = normalize(vNormal) * mat3(viewMatrix); roughnessFactor = mix(roughnessFactor, min(roughnessFactor, 0.4), uNightK.x * uNightK.w * smoothstep(0.85, 0.97, gn.y)); }
    #endif`;
  const WASH_EMIT = `
    if (uNightK.x > 0.002) {
      vec3 wpos = cameraPosition - vViewPosition * mat3(viewMatrix);
      vec3 wn = normalize(normal * mat3(viewMatrix));
      float hb = max(wpos.y - uNightK.z, 0.0);
      float wall = (1.0 - abs(wn.y)) * smoothstep(0.35, 1.8, hb);   // not on curbs and kerb faces
      vec3 lf = texture2D(uLampTex, (wpos.xz - uLampBox.xy) * uLampBox.zw).rgb;   // r: street lamps, g: along the streets
      float near = clamp(lf.r * 1.4 + lf.g * 0.9, 0.0, 1.4);
      float fl = 0.0;
      for (int i = 0; i < 7; i++) { vec4 f = uFlood[i]; fl += f.w * (1.0 - smoothstep(f.z * 0.35, f.z, length(wpos.xz - f.xy))); }
      float gnd = smoothstep(0.7, 0.92, wn.y) * exp(-hb / 2.5) * near;                 // streets and piazzas: amber-brown under and between the lamps
      float wl = uNightK.y * wall * exp(-hb / 9.0) * (0.3 + near);                   // lamp-lit street: sodium orange
      float wf = fl * (0.35 + 0.65 * exp(-hb / 24.0)) * wall;                       // floodlit landmarks: warmer cream-gold, like the stone in the night photos
      totalEmissiveRadiance += (diffuseColor.rgb * 0.7 + 0.03) * uNightK.x * (vec3(1.0, 0.5, 0.15) * (wl + gnd * 0.8) + vec3(1.0, 0.66, 0.34) * wf);
    }`;
  const seenMats = new Set();
  vehicle?.rig?.root?.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) seenMats.add(m); }); // the player's lapa stays honestly lit
  function patchMaterials() {
    scene.traverse(o => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (!m.isMeshStandardMaterial || seenMats.has(m)) continue;
        seenMats.add(m);
        const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
        m.onBeforeCompile = function (sh, r) {
          if (prev) prev.call(this, sh, r);
          sh.uniforms.uNightK = NK; sh.uniforms.uFlood = FL; sh.uniforms.uLampTex = LT; sh.uniforms.uLampBox = LB;
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\n' + WASH_DECL)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + WASH_ROUGH)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + WASH_EMIT);
        };
        m.customProgramCacheKey = function () { return (key ? key.call(this) : prev ? prev.toString() : '') + '|dnwash'; };
      }
    });
  }
  patchMaterials();

  // ---- the clock
  const qTime = params.get('time'), qSpeed = params.get('timespeed');
  const forced = qTime !== null && qTime !== '' && Number.isFinite(+qTime);
  let startKey = START_HOURS[st.timeStart] !== undefined ? st.timeStart : DEFAULT_START;
  st.timeStart = startKey; if (!(st.timeSpeed in DAY_MINUTES)) st.timeSpeed = DEFAULT_SPEED;
  let hour = forced ? ((+qTime % 24) + 24) % 24 : START_HOURS[startKey];
  let vis = hour; // the hour the lighting shows: eases to `hour` after a jump so the sky sweeps instead of popping
  let jump = null; // { from, delta, t }
  let seenStart = st.timeStart, seenState = game.state;
  const minutesPerDay = () => (forced && qSpeed === null ? 0 : qSpeed !== null && Number.isFinite(+qSpeed) ? +qSpeed : DAY_MINUTES[st.timeSpeed] ?? 24);
  const time = game.time = Object.assign(game.time || {}, { hour, isNight: false, night: 0, dusk: 0, day: 1, sunUp: true, speed: 0 }); // keep the object main.js created: modules may hold it already

  function jumpTo(h) {
    hour = ((h % 24) + 24) % 24;
    let d = hour - vis; d = ((d + 36) % 24) - 12; // shortest way round
    jump = { from: vis, delta: d, t: 0 };
    lastEvent = -1;
  }

  addEventListener('pd-time-hour', e => { if (!forced && Number.isFinite(+e.detail)) jumpTo(+e.detail); }); // the Options time slider (src/ui.js)
  addEventListener('pd-time-set', () => { if (!forced && START_HOURS[st.timeStart] !== undefined) { seenStart = st.timeStart; jumpTo(START_HOURS[st.timeStart]); } });

  // ---- the sun's light
  const sunV = new THREE.Vector3(), moonV = new THREE.Vector3(), seaDir = new THREE.Vector3(), _c = new THREE.Color();
  const lightDir = SUN_DIR || new THREE.Vector3();

  // ---- environment map: a gradient sphere baked to a PMREM, re-baked only while its colours move
  const envGeo = new THREE.SphereGeometry(100, 32, 16), envCol = new Float32Array(envGeo.attributes.position.count * 3);
  envGeo.setAttribute('color', new THREE.BufferAttribute(envCol, 3));
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(envGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, lastBake = -1e9;
  const baked = { Z: new THREE.Color(-1, 0, 0), H: new THREE.Color(), B: new THREE.Color() };
  function bakeEnv(now) {
    const pos = envGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 100;
      // Kept less saturated than the visible sky: shaded walls in Palermo read cool grey-brown, not blue.
      if (y >= 0) _c.copy(P.envH).lerp(P.envZ, Math.pow(y, 0.55)); else _c.copy(P.envH).lerp(P.envB, Math.min(1, -y * 4));
      envCol[i * 3] = _c.r; envCol[i * 3 + 1] = _c.g; envCol[i * 3 + 2] = _c.b;
    }
    envGeo.attributes.color.needsUpdate = true;
    const prev = envRT;
    envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    if (prev) prev.dispose();
    baked.Z.copy(P.envZ); baked.H.copy(P.envH); baked.B.copy(P.envB); lastBake = now;
  }
  const colDiff = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

  // ---- the sea shader's uniforms (found by name, src/sea.js keeps them)
  let seaU = null, seaTries = 0;
  const DAY_SEA_H = C('#a8cbe6'), DAY_SEA_Z = C('#3d7fc4'), _seaSun = new THREE.Color();

  // ---- clock element under the street name
  let clockEl = null, clockShown = '';
  try {
    const where = document.getElementById('where');
    if (where) {
      const css = document.createElement('style');
      css.textContent = '#pd-clock{margin-top:4px;font:600 12px/1 system-ui,-apple-system,sans-serif;letter-spacing:.06em;opacity:.78;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px rgba(0,0,0,.7)}' +
        '#pd-clock i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:0;background:#ffd36a;box-shadow:0 0 6px #ffd36a}#pd-clock i.n{background:#c8d4ff;box-shadow:inset -2px -1px 0 #5a6aa0,0 0 6px #aab8ff}' +
        'html.touch #pd-clock{position:fixed;top:max(10px,env(safe-area-inset-top));right:calc(max(12px,env(safe-area-inset-right)) + clamp(76px,25vh,104px) + 10px);margin:0;font-size:11px}';
      document.head.appendChild(css);
      clockEl = document.createElement('div'); clockEl.id = 'pd-clock'; where.appendChild(clockEl);
    }
  } catch (e) { /* no HUD: fine */ }
  function showClock() {
    if (!clockEl) return;
    const m = Math.floor(vis * 60) % 1440, s = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + (time.sunUp ? 'd' : 'n');
    if (s === clockShown) return;
    clockShown = s;
    clockEl.innerHTML = `<i class="${time.sunUp ? '' : 'n'}"></i>${s.slice(0, 5)}`;
  }

  // ------------------------------------------------------------------------------------------ street lamps
  // Bulb positions are read from the instanced lamp meshes (src/props.js tags them userData.kind) the first time it gets dark.
  // Glow = one Points object (halos, also seen from far away as city lights); light on the ground = one additive InstancedMesh of
  // flat quads. No real lights for them. Local bulb offsets mirror the models in props.js.
  const LAMP_KINDS = {
    lamp_pole: { bulbs: [[-1.45, 8.74, 0], [1.45, 8.74, 0]], pools: [[-1.45, 0, 0], [1.45, 0, 0]], size: 3.6, r: 10, col: '#ff9628', k: 0.95 },
    lamp_wall: { bulbs: [[0, 4.15, 0.74]], pools: [[0, 0, 1.9]], size: 2.1, r: 6.4, col: '#ffa23e', k: 0.85 },
    candelabra: { bulbs: [[0, 4.35, 0], ...[0, 1, 2, 3].map(i => [Math.cos(i * Math.PI / 2 + 0.78) * 0.4, 4.15, Math.sin(i * Math.PI / 2 + 0.78) * 0.4])], pools: [[0, 0, 0]], size: 1.5, r: 6.8, col: '#ffb050', k: 0.75 },
  };
  let lamps = null; // { halo: Points, haloMat, pools: InstancedMesh, poolMat, pos: Float32Array of bulb xyz }
  // props.js builds lamps per tile as tiles stream in and out and says so with 'pd-lamps-changed': the glows are rebuilt from the scene (at most every 1.5 s)
  let lampsStale = false, lampsAt = -9, fieldDone = false;
  addEventListener('pd-lamps-changed', () => { lampsStale = true; });
  function dropLamps() {
    if (lamps && !lamps.none) { scene.remove(lamps.halo, lamps.pools); lamps.halo.geometry.dispose(); lamps.haloMat.dispose(); lamps.pools.geometry.dispose(); lamps.pools.dispose(); if (lamps.poolMat.map) lamps.poolMat.map.dispose(); lamps.poolMat.dispose(); }
    lamps = null;
  }
  function buildLamps() {
    const bulbs = [], bulbCol = [], bulbSize = [], poolM = [], poolC = [];
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
    let hashK = 0;
    scene.traverse(o => {
      if (!o.isInstancedMesh) return;
      const kind = LAMP_KINDS[o.userData.kind]; if (!kind) return;
      const base = new THREE.Color(kind.col);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); m.decompose(p, q, s);
        const wob = 0.8 + 0.2 * Math.abs(Math.sin((p.x * 12.9898 + p.z * 78.233) * 43758.5453 + (hashK++)));   // each lamp a little different
        for (const b of kind.bulbs) {
          v.set(b[0] * s.x, b[1] * s.y, b[2] * s.z).applyQuaternion(q).add(p);
          bulbs.push(v.x, v.y, v.z); bulbCol.push(base.r * wob, base.g * wob, base.b * wob); bulbSize.push(kind.size * (0.9 + 0.2 * wob));
        }
        for (const b of kind.pools) {
          v.set(b[0] * s.x, 0, b[2] * s.z).applyQuaternion(q).add(p);
          poolM.push(v.x, p.y + 0.07, v.z, kind.r * (0.9 + 0.2 * wob)); poolC.push(base.r * kind.k * wob, base.g * kind.k * wob, base.b * kind.k * wob);
        }
      }
    });
    // light field over the centro: red = lamps (soft discs), green = streets (soft bands). Sampled by the wash shader, so the ground and the
    // facades glow orange where lamps overlap and along every street, and only fall to navy far from them.
    if (!fieldDone) try { // the light field covers the baked centro only and is built once
      fieldDone = true;
      const [bx0, bz0, bx1, bz1] = D.bounds, pad = 40, X0 = bx0 - pad, Z0 = bz0 - pad, W = bx1 - bx0 + 2 * pad, H = bz1 - bz0 + 2 * pad, S = 1024 / Math.max(W, H);
      const cv = document.createElement('canvas'); cv.width = Math.ceil(W * S); cv.height = Math.ceil(H * S);
      const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round';
      const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian']);
      for (const r of D.roads) {
        if (!DRIVE.has(r.k)) continue;
        for (const [wk, a] of [[2.6, 0.16], [1.7, 0.16], [1.0, 0.16]]) {
          g.strokeStyle = `rgba(0,255,0,${a})`; g.lineWidth = (r.w + 5) * wk * S; g.beginPath();
          for (let i = 0; i < r.p.length; i += 2) g[i ? 'lineTo' : 'moveTo']((r.p[i] - X0) * S, (r.p[i + 1] - Z0) * S);
          g.stroke();
        }
      }
      for (let i = 0; i < poolM.length / 4; i++) {
        const x = (poolM[i * 4] - X0) * S, z = (poolM[i * 4 + 2] - Z0) * S, rad = poolM[i * 4 + 3] * 1.1 * S, gr = g.createRadialGradient(x, z, 0, x, z, rad);
        gr.addColorStop(0, 'rgba(255,0,0,0.5)'); gr.addColorStop(0.5, 'rgba(255,0,0,0.2)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - rad, z - rad, rad * 2, rad * 2);
      }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      LT.value = tex; LB.value.set(X0, Z0, 1 / (cv.width / S), 1 / (cv.height / S));
    } catch (e) { console.warn('[daynight] lamp field skipped', e); }
    const n = bulbs.length / 3, np = poolM.length / 4;
    if (!n) return { none: true };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(bulbCol, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(bulbSize, 1));
    const haloMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 600 }, uAmt: { value: 0 } }]),
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Points(geo, haloMat); halo.frustumCulled = false; halo.renderOrder = 5; halo.visible = false;
    scene.add(halo);
    const pg = new THREE.PlaneGeometry(2, 2); pg.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      map: radial([[0, 'rgba(255,255,255,0.95)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']], 128),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const pools = new THREE.InstancedMesh(pg, poolMat, np); pools.frustumCulled = false; pools.renderOrder = 4; pools.visible = false;
    for (let i = 0; i < np; i++) {
      m.makeScale(poolM[i * 4 + 3], 1, poolM[i * 4 + 3]).setPosition(poolM[i * 4], poolM[i * 4 + 1], poolM[i * 4 + 2]);
      pools.setMatrixAt(i, m); pools.setColorAt(i, col.setRGB(poolC[i * 3], poolC[i * 3 + 1], poolC[i * 3 + 2]));
    }
    pools.instanceMatrix.needsUpdate = true; pools.instanceColor.needsUpdate = true;
    scene.add(pools);
    console.log(`[daynight] ${n} lamp glows, ${np} light pools`);
    return { halo, haloMat, pools, poolMat, pos: new Float32Array(bulbs), n };
  }

  // ------------------------------------------------------------------------------------------ the player's lights
  // Cheap: two soft cones and two ground decals riding the car's heading, tail glow via the shared lamp materials.
  const beamT = beamTex();
  const beamGroup = new THREE.Group(); beamGroup.visible = false;
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1], 3));
  ground.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  ground.setIndex([0, 2, 1, 0, 3, 2]);
  const decalMat = new THREE.MeshBasicMaterial({ map: beamT, color: '#ffe9b8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const coneLen = 13, coneGeo = new THREE.ConeGeometry(2.4, coneLen, 18, 1, true);
  coneGeo.translate(0, -coneLen / 2, 0); coneGeo.rotateX(-Math.PI / 2); // apex at the origin, opening towards +z
  { const pos = coneGeo.attributes.position, cc = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const t = clamp(pos.getZ(i) / coneLen, 0, 1), a = (1 - t) * (1 - t) * 0.9; cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = a; }
    coneGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  const coneMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffeccc', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0 });
  const heads = [0, 1].map(() => {
    const pivot = new THREE.Group(), cone = new THREE.Mesh(coneGeo, coneMat), decal = new THREE.Mesh(ground, decalMat);
    cone.scale.set(0.55, 0.55, 1); cone.frustumCulled = false; decal.frustumCulled = false; pivot.add(cone); beamGroup.add(pivot);
    const floor = new THREE.Group(); floor.add(decal); beamGroup.add(floor);
    return { pivot, floor, decal };
  });
  scene.add(beamGroup);
  function updateHeadlights(on) {
    if (!car) return;
    if (car.stripped || car.kind === 'horse') on = 0; // the ZEN gag strips the lights, the race sulky has none
    beamGroup.visible = on > 0.01;
    if (!beamGroup.visible) return;
    decalMat.opacity = on * 1.0; coneMat.opacity = on * 0.1;
    const rig = vehicle?.rig, len = rig?.tpl?.spec?.len ?? 3.1, kind = car.kind || 'lapa';
    const bike = kind === 'bike', hx = bike ? 0 : kind === 'car' ? 0.52 : 0.27, hy = bike ? 0.95 : kind === 'car' ? 0.62 : 0.88, hz = len * 0.43;
    const sn = Math.sin(car.th), cs = Math.cos(car.th), gy = groundY(car.x, car.z) + (car.lift || 0);
    heads.forEach((h, i) => {
      const side = bike ? 0 : i ? 1 : -1;
      h.pivot.visible = h.floor.visible = !(bike && i);
      const lx = hx * side, ox = car.x + cs * lx + sn * hz, oz = car.z - sn * lx + cs * hz;
      const yaw = car.th + side * 0.045;
      h.pivot.position.set(ox, gy + hy, oz); h.pivot.rotation.set(0.09, yaw, 0, 'YXZ');
      h.floor.position.set(ox + sn * 0.2, gy + 0.09, oz + cs * 0.2); h.floor.rotation.set(0, yaw, 0);
      h.floor.scale.set(bike ? 3.8 : 4.4, 1, 17);
    });
  }
  let lampMatOn = -1;
  function setVehicleLamps(on) { // headlamp glass and tail lamps are shared vehicle materials
    if (Math.abs(on - lampMatOn) < 0.01) return;
    lampMatOn = on;
    MAT.lamp.emissiveIntensity = 0.55 + 3.4 * on; MAT.tail.emissiveIntensity = 0.5 + 1.1 * on;
  }

  // ------------------------------------------------------------------------------------------ a handful of real lights
  // Two point lights ride the nearest street lamps and one spot the car's nose. Added the first time it gets dark (adding a light
  // recompiles the materials once), never on Low quality.
  let rl = null, rlTried = false, rlAcc = 0;
  function ensureRealLights() {
    if (rlTried || !lamps || lamps.none) return; rlTried = true;
    if (st.quality === 'low') return;
    const pts = [0, 1].map(() => { const l = new THREE.PointLight('#ff9a3c', 0, 38, 1.5); l.castShadow = false; scene.add(l); return { l, tx: 0, ty: 0, tz: 0, k: 0 }; });
    const spot = new THREE.SpotLight('#fff0cf', 0, 42, 0.5, 0.75, 1.5); spot.castShadow = false; scene.add(spot, spot.target);
    rl = { pts, spot };
  }
  function updateRealLights(dt, lampOn, headOn) {
    if (!rl) return;
    rlAcc -= dt;
    if (rlAcc <= 0 && car && lamps && !lamps.none) { // re-pick the two closest bulbs a few times a second
      rlAcc = 0.25;
      const a = lamps.pos; let b0 = -1, d0 = 1e9, b1 = -1, d1 = 1e9;
      for (let i = 0; i < lamps.n; i++) {
        const dx = a[i * 3] - car.x, dz = a[i * 3 + 2] - car.z, d = dx * dx + dz * dz;
        if (d < d0) { b1 = b0; d1 = d0; b0 = i; d0 = d; } else if (d < d1) { b1 = i; d1 = d; }
      }
      [[b0, d0], [b1, d1]].forEach(([b, d], i) => { const p = rl.pts[i]; if (b < 0) return; p.tx = a[b * 3]; p.ty = a[b * 3 + 1] - 0.4; p.tz = a[b * 3 + 2]; p.k = 1 - ss(28, 52, Math.sqrt(d)); });
    }
    const f = 1 - Math.exp(-dt * 6);
    for (const p of rl.pts) {
      if (p.l.intensity === 0 && p.k === 0) { p.l.position.set(p.tx, p.ty, p.tz); }
      p.l.position.x += (p.tx - p.l.position.x) * f; p.l.position.y += (p.ty - p.l.position.y) * f; p.l.position.z += (p.tz - p.l.position.z) * f;
      p.l.intensity = 55 * lampOn * p.k;
    }
    if (car) {
      const sn = Math.sin(car.th), cs = Math.cos(car.th), gy = groundY(car.x, car.z);
      rl.spot.position.set(car.x + sn * 1.3, gy + 0.9, car.z + cs * 1.3); rl.spot.target.position.set(car.x + sn * 14, gy - 0.2, car.z + cs * 14);
      rl.spot.intensity = (car.stripped || car.kind === 'horse') ? 0 : 90 * headOn;
    }
  }

  // ------------------------------------------------------------------------------------------ per frame
  let lastEvent = -1, realNow = 0, firstFrame = true;
  const _sz = new THREE.Vector2();
  function dispatch() {
    lastEvent = hour;
    dispatchEvent(new CustomEvent('pd-time', { detail: { hour, isNight: time.isNight, night: time.night, dusk: time.dusk } }));
  }

  function update(dt) {
    realNow += dt;
    // -- settings and state changes
    if (!forced && st.timeStart !== seenStart) { seenStart = st.timeStart; if (START_HOURS[seenStart] !== undefined) jumpTo(START_HOURS[seenStart]); }
    if (game.state === 'play' && seenState === 'title' && !forced && !firstFrame) { const h = START_HOURS[st.timeStart]; if (h !== undefined && Math.abs(((hour - h + 36) % 24) - 12) > 0.05) jumpTo(h); }
    seenState = game.state;
    // -- advance (the game clock only runs while playing: pause and the title screen freeze it)
    const mpd = minutesPerDay();
    time.speed = mpd > 0 ? 24 / (mpd * 60) : 0;
    if (game.state === 'play' && time.speed > 0) { hour = (hour + dt * time.speed) % 24; if (!jump) vis = hour; }
    if (jump) {
      jump.t = Math.min(1, jump.t + dt / 1.3); const e = jump.t * jump.t * (3 - 2 * jump.t);
      vis = (jump.from + jump.delta * e + 48) % 24;
      if (jump.t >= 1) { jump = null; vis = hour; }
    }

    // -- sun, moon, palette
    const alt = sunVector(vis, sunV);
    moonV.copy(sunV).negate();
    palette(vis);
    const altD = alt / DEG;
    const night = ss(2.5, -9.5, altD);                // 0 in daylight, 1 once the sun is 9 degrees under
    const dusk = Math.exp(-Math.pow((altD + 2) / 6.5, 2));     // peaks as the sun meets the sea
    const sunUp = altD > -0.6;
    time.hour = vis; time.night = night; time.day = 1 - night; time.dusk = dusk; time.isNight = night > 0.5; time.sunUp = sunUp;
    const moonI = 0.5 * ss(-1, -9, altD) * ss(0.02, 0.14, moonV.y);
    const wS = P.sunI / 2.9, wM = moonI / 0.5 * 0.75;
    lightDir.copy(sunV).multiplyScalar(wS + 1e-4).addScaledVector(moonV, wM);
    if (lightDir.lengthSq() < 1e-8) lightDir.copy(moonV);
    lightDir.normalize();
    seaDir.copy(lightDir);
    if (lightDir.y < 0.07) { const h = Math.hypot(lightDir.x, lightDir.z) || 1, k = Math.sqrt(1 - 0.0049) / h; lightDir.set(lightDir.x * k, 0.07, lightDir.z * k); } // never grazing: keeps shadows sane
    { const mS = wS, mM = wM * 0.5, tw = mS + mM + 1e-4; sun.color.setRGB((P.sun.r * mS + MOON.r * mM) / tw, (P.sun.g * mS + MOON.g * mM) / tw, (P.sun.b * mS + MOON.b * mM) / tw); }
    sun.intensity = P.sunI + moonI;

    hemi.color.copy(P.hemiS); hemi.groundColor.copy(P.hemiG); hemi.intensity = P.hemiI;
    renderer.toneMappingExposure = P.expo;
    const base = 0.00014 / (st.drawDistance || 1);
    // x2: from a high camera the same ground-level haze piles up over kilometres of air and flattens the city (title flyover, aerial shots): thin it with the height above the ground
    // (nothing below 30 m, 0.8 at the 100 m of the title flyover, 0.3 at 650 m) and let the day sky go bluer with it; the driving cameras (3 to 15 m) keep the old haze
    const camH = Math.max(0, camera.position.y - groundY(camera.position.x, camera.position.z));
    scene.fog.color.copy(P.fog); scene.fog.density = base * P.fogK / (1 + Math.max(0, camH - 30) / 260);
    U.uDayG.value = lerp(0.4, 0.92, ss(20, 120, camH));
    if (scene.background && scene.background.isColor) scene.background.copy(P.fog);

    // sky
    const mixG = ss(11, 3, altD);
    U.sunPosition.value.copy(sunV);
    U.uMix.value = Math.max(mixG, night); U.uTime.value = realNow;
    U.uSkyH.value.copy(P.skyH); U.uSkyZ.value.copy(P.skyZ); U.uGlow.value.copy(P.glow); U.uDome.value.copy(P.dome);
    U.uSunV.value.copy(sunV); U.uSunVis.value = ss(-2.5, 0.5, altD);
    U.uMoonV.value.copy(moonV); U.uMoon.value = ss(-3, -11, altD) * ss(0, 0.08, moonV.y);
    U.uStars.value = ss(-6, -15, altD);

    // environment map
    {
      const need = firstFrame || colDiff(baked.Z, P.envZ) + colDiff(baked.H, P.envH) + colDiff(baked.B, P.envB) > 0.012;
      if (need && (firstFrame || realNow - lastBake > 1)) bakeEnv(realNow);
    }

    // sea
    if (!seaU && seaTries < 600) {
      seaTries++;
      scene.traverse(o => { if (!seaU && o.material && o.material.uniforms && o.material.uniforms.uSunDir && o.material.uniforms.uHorizon) seaU = o.material.uniforms; });
    }
    if (seaU) {
      seaU.uSunDir.value.copy(seaDir);
      _seaSun.copy(P.sun).multiplyScalar(Math.min(1, P.sunI / 2.5)).add(_c.copy(MOON).multiplyScalar(0.45 * moonI / 0.5));
      seaU.uSunCol.value.copy(_seaSun);
      seaU.uHorizon.value.copy(DAY_SEA_H).lerp(P.skyH, Math.max(mixG, night)); seaU.uZenith.value.copy(DAY_SEA_Z).lerp(P.skyZ, Math.max(mixG, night));
      if (seaU.uAmb) seaU.uAmb.value.copy(P.amb);
    }

    // lamps, windows, vehicle lights
    const lampOn = ss(3.5, -6.5, altD);                       // street lamps fade in from the moment the sun touches the sea
    const headOn = ss(5, -4, altD);
    NIGHT.win.value = lampOn * P.win;
    NK.value.x = lampOn;
    if (car) NK.value.z = groundY(car.x, car.z); // street level near the player: the wash fades with height above it
    if (lampOn > 0.003) {
      if (lampsStale && lamps && realNow - lampsAt > 1.5) dropLamps();
      if (!lamps) { lamps = buildLamps(); lampsAt = realNow; lampsStale = false; ensureRealLights(); }
      if (lamps && !lamps.none) {
        lamps.halo.visible = lamps.pools.visible = true;
        renderer.getDrawingBufferSize(_sz);
        lamps.haloMat.uniforms.uScale.value = _sz.y / (2 * Math.tan(camera.fov * DEG / 2));
        lamps.haloMat.uniforms.uAmt.value = lampOn * 1.15;
        lamps.poolMat.opacity = lampOn * 0.36;
      }
    } else if (lamps && !lamps.none) lamps.halo.visible = lamps.pools.visible = false;
    updateHeadlights(headOn);
    if (car) car.tailGlow = headOn;
    setVehicleLamps(headOn);
    updateRealLights(dt, lampOn, headOn);

    showClock();
    if (lastEvent < 0 || ((hour - lastEvent + 24) % 24) >= 2 / 60) dispatch();   // every two game minutes
    firstFrame = false;
  }

  update(0); // first frame: everything in place before the title flyover renders
  return { update, time, jumpTo, get lampsBuilt() { return !!lamps; }, bakeEnv: () => bakeEnv(realNow) };
}
