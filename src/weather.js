// Weather: Palermo's sky from one half day to the next, for the eye only (nothing in the driving changes).
//
//   const weather = createWeather({ scene, renderer, camera, game });   // before the day/night cycle, which steps it
//   weather.update(dt, hour)   // src/daynight.js, every frame, with the hour the lighting shows
//   weather.setQuality(tier)   // 'low' draws half the rain and leaves a grey sky unmottled
//
// Five states: clear (the most common), fair-weather cumulus (the look the clouds shipped with), overcast, scirocco (the hot dusty wind from Africa:
// an ochre haze, a pale sun, few clouds) and rain (overcast with showers that come and go). WX below is the weather of this frame, a weighted mix of the
// states, and the modules that draw read it: src/daynight.js the sun, sky light, fog, exposure, sky dome, stars and wet ground, src/clouds.js how many
// clouds there are, how big and how grey, and how dark their shadows. No clock of its own: it counts the hours daynight shows (game.time), jumps included.
//
// The schedule. Every game day has a morning and an afternoon, each with a state. The morning is drawn from FIRST (clear about four times in ten) and
// often keeps yesterday morning's (spells of two or three days: a scirocco blows for days); the afternoon follows from the morning (NEXT: clear may
// build cumulus, cumulus may thicken to overcast or a shower, rain clears). Overnight (1:00 to 5:00) the sky turns into the next morning's, mostly in the
// dark; the afternoon one blends in from 12:45 to 15:15, a change a player can watch. The hashes are of the day's number, which starts from the date:
// the same weather all day for everyone, another tomorrow.
// ?weather=clear|cumulus|overcast|scirocco|rain holds one state (rain at a steady shower); tests: game.weather.set(name, seconds), .mix(a, b, t), .set(null).
// Night barely changes: the weather's colours fade out as it gets dark (the night wash and the lamps stay as tuned), an overcast or rainy night is a
// little darker and has no stars.
//
// Rain: streaks round the camera, one instanced draw compiled while loading (the drops wrap round the camera in the vertex shader: no work on the CPU),
// and the ground goes darker and glossier while it is wet (a uniform in src/daynight.js's wash), drying slowly after a shower.
import * as THREE from 'three';

const { clamp, lerp } = THREE.MathUtils;
const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const WEATHERS = ['clear', 'cumulus', 'overcast', 'scirocco', 'rain'];
const NW = WEATHERS.length;

// The states. Numbers are blended as they are; each colour comes with how much of it is mixed in (m), and is a daylight colour that daynight scales to the hour.
//  cov: clouds (0 none, 1 the cumulus as shipped, 2 twice as many)   cSize: their size   cGrey: darker, greyer undersides   shK: their shadows' strength
//  sunK: direct light   sunDesat: whiter sun   sun/sunM: its tint   hemiK: sky light   hemi/hemiM: its colour   fogK: haze density   fog/fogM: its colour
//  skyH, skyZ / skyM: the dome (horizon, zenith)   glow: round the sun   deck: mottling of a grey sky   hide: the sun disc gone   disc: a pale disc instead
//  expoK: exposure   stars: share of stars and moon left at night   dark: a darker night   rain: showers   sea/seaM: the water's own colour scaled (greyer, darker)
const NEUTRAL = { cov: 1, cSize: 1, cGrey: 0, shK: 1, sunK: 1, sunDesat: 0, sun: '#ffffff', sunM: 0, hemiK: 1, hemi: '#ffffff', hemiM: 0, fogK: 1, fog: '#ffffff', fogM: 0,
  skyH: '#ffffff', skyZ: '#ffffff', skyM: 0, glow: '#000000', deck: 0, hide: 0, disc: 0, expoK: 1, stars: 1, dark: 0, rain: 0, sea: '#ffffff', seaM: 0 };
const STATES = {
  clear: { cov: 0.2, cSize: 0.85, fogK: 0.8 },
  cumulus: {},
  overcast: { cov: 2, cSize: 1.3, cGrey: 0.7, shK: 0.6, sunK: 0.3, sunDesat: 0.7, hemiK: 1.6, hemi: '#c8ccd0', hemiM: 0.65, fogK: 1.5, fog: '#b8bdc2', fogM: 0.8,
    skyH: '#c2c6ca', skyZ: '#8f969e', skyM: 0.9, glow: '#3a3c3e', deck: 1, hide: 1, expoK: 1.04, stars: 0.1, dark: 0.12, sea: '#a8acac', seaM: 1 },
  scirocco: { cov: 0.3, cSize: 0.9, cGrey: 0.05, shK: 0.9, sunK: 0.6, sun: '#ffb070', sunM: 0.45, hemiK: 1.3, hemi: '#dcb890', hemiM: 0.55, fogK: 3.5, fog: '#d0a576', fogM: 0.9,
    skyH: '#e2b880', skyZ: '#bfa47e', skyM: 0.8, glow: '#c88a48', deck: 0.25, hide: 1, disc: 0.9, expoK: 1.03, stars: 0.45, sea: '#d4c0a0', seaM: 1 },
  rain: { cov: 2, cSize: 1.4, cGrey: 1, shK: 0.4, sunK: 0.14, sunDesat: 0.8, hemiK: 1.35, hemi: '#a8b0b8', hemiM: 0.75, fogK: 2.6, fog: '#949ca4', fogM: 0.9,
    skyH: '#a4aab0', skyZ: '#6c737c', skyM: 0.95, glow: '#202224', deck: 1.2, hide: 1, expoK: 1.0, stars: 0, dark: 0.2, rain: 1, sea: '#8c9090', seaM: 1 },
};
const COLS = [['sun', 'sunM'], ['hemi', 'hemiM'], ['fog', 'fogM'], ['skyH', 'skyM'], ['skyZ', 'skyM'], ['sea', 'seaM']], NUMS = Object.keys(NEUTRAL).filter(k => typeof NEUTRAL[k] === 'number');
const ST = WEATHERS.map(n => { const s = { ...NEUTRAL, ...STATES[n] }; for (const k of Object.keys(s)) if (typeof s[k] === 'string') s[k] = new THREE.Color(s[k]); return s; });

// The weather of this frame (read by daynight and the clouds). The colours are the mixed-in targets (already divided by their amounts).
export const WX = { name: 'cumulus', w: new Float32Array(NW), precip: 0, wet: 0 };
for (const k of NUMS) WX[k] = NEUTRAL[k];
for (const [c] of COLS) WX[c] = new THREE.Color(1, 1, 1);
WX.glow = new THREE.Color(0, 0, 0);
WX.w[1] = 1;

// ------------------------------------------------------------------------------------------------ the schedule
const FIRST = [['clear', 0.42], ['cumulus', 0.3], ['overcast', 0.12], ['scirocco', 0.1], ['rain', 0.06]];   // the morning's draw
const NEXT = {   // the afternoon, from the morning
  clear: [['clear', 0.75], ['cumulus', 0.25]],
  cumulus: [['cumulus', 0.6], ['overcast', 0.2], ['rain', 0.1], ['clear', 0.1]],
  overcast: [['overcast', 0.5], ['rain', 0.3], ['cumulus', 0.2]],
  scirocco: [['scirocco', 0.85], ['cumulus', 0.15]],
  rain: [['rain', 0.3], ['overcast', 0.3], ['cumulus', 0.4]],
};
const STAY = 0.35;   // the morning keeps yesterday's
const hh = (n, k) => { let x = Math.imul(n | 0, 0x9e3779b1) ^ Math.imul((k | 0) + 0x632be5ab, 0x85ebca77); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15; return (x >>> 0) / 4294967296; };
const pick = (T, u) => { for (const [n, p] of T) { if (u < p) return n; u -= p; } return T[T.length - 1][0]; };
const morning = (N, depth = 0) => depth < 6 && hh(N, 2) < STAY ? morning(N - 1, depth + 1) : pick(FIRST, hh(N, 1));
const afternoon = N => pick(NEXT[morning(N)], hh(N, 3));
export const stateOf = p => { const N = Math.floor(p / 2); return p - 2 * N === 0 ? morning(N) : afternoon(N); };   // period p: 2N the morning of day N, 2N + 1 its afternoon
const M0 = 3, A0 = 14, MW = 2, AW = 1.25;   // the morning begins at 3:00 (blended over 1:00 to 5:00), the afternoon at 14:00 (12:45 to 15:15)
const startOf = p => { const N = Math.floor(p / 2); return p - 2 * N === 0 ? [N * 24 + M0, MW] : [N * 24 + A0, AW]; };
const periodAt = t => { const N = Math.floor(t / 24), h = t - N * 24; return h < M0 ? 2 * N - 1 : h < A0 ? 2 * N : 2 * N + 1; };
// showers inside a rainy stretch: in each 2.5 hour cell, seven times in ten, a shower of 50 minutes to two hours
function showers(t) {
  const c0 = Math.floor(t / 2.5);
  let s = 0;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (hh(c, 7) > 0.7) continue;
    const mid = c * 2.5 + 0.3 + hh(c, 8) * 1.9, half = 0.42 + hh(c, 9) * 0.55;
    s = Math.max(s, (0.6 + 0.4 * hh(c, 10)) * ss(half, half * 0.55, Math.abs(t - mid)));
  }
  return s;
}
function scheduled(t, w) {   // the states' weights at game hour t (counted from the epoch)
  w.fill(0);
  const p = periodAt(t), [b0, w0] = startOf(p), [b1, w1] = startOf(p + 1), at = n => WEATHERS.indexOf(n);
  let a = stateOf(p), b = a, e = 0;
  if (t < b0 + w0) { b = a; a = stateOf(p - 1); e = ss(b0 - w0, b0 + w0, t); }
  else if (t > b1 - w1) { b = stateOf(p + 1); e = ss(b1 - w1, b1 + w1, t); }
  w[at(a)] += 1 - e; w[at(b)] += e;
}

// ------------------------------------------------------------------------------------------------ the rain
// Streaks: thin quads along each drop's fall, facing the camera, in a box that wraps round it (the drops fall and drift with time in the shader).
// Never thinner than about a pixel and a half: a far drop fades rather than shrinks to a flicker.
const RN = 2400, RB = 34, RH = 22;   // drops, the box's side and height (m)
const RAIN_VERT = `
attribute vec4 aD; uniform float uT; uniform vec2 uWind; uniform float uPx; uniform float uLen;
varying float vA; varying float vY;
void main() {
  float fall = 7.5 + 2.5 * aD.w;
  vec3 v = vec3(uWind.x, -fall, uWind.y), p = aD.xyz + v * uT;
  vec3 box = vec3(${RB}.0, ${RH}.0, ${RB}.0), c0 = cameraPosition - box * vec3(0.5, 0.62, 0.5);
  p = c0 + mod(p - c0, box);
  vec3 e = cameraPosition - p; float d = length(e);
  vec3 ax = normalize(v), sd = normalize(cross(ax, e / max(d, 1e-3)));
  float w = 0.006, wpx = d * uPx;   // a drop is about a centimetre wide, but never under 1.5 px
  vec3 wp = p + sd * position.x * max(w, wpx) + ax * position.y * uLen * (0.7 + 0.6 * aD.w);
  vA = smoothstep(0.8, 2.5, d) * (1.0 - smoothstep(${(RB * 0.28).toFixed(2)}, ${(RB * 0.48).toFixed(2)}, length(e.xz))) * min(1.0, w / wpx * 1.6 + 0.35);
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RAIN_FRAG = `
uniform vec3 uCol; uniform float uAmt; varying float vA; varying float vY;
void main() {
  float a = uAmt * vA * (1.0 - vY * vY * 3.6) * (0.65 + 0.35 * (vY + 0.5));   // soft ends, the head a little brighter
  if (a < 0.003) discard;
  gl_FragColor = vec4(uCol, a);
}`;

export function createWeather({ scene, renderer, camera, game }) {
  const q = new URLSearchParams(location.search).get('weather'), fixed = WEATHERS.includes(q) ? WEATHERS.indexOf(q) : -1;
  const day0 = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);   // today's local date, the day the clock starts on
  let abs = null, last = 0, test = null;   // abs: game hours since the epoch; test: { from, to, t, dur } or { a, b, e }
  const w = new Float32Array(NW), w0 = new Float32Array(NW);
  w[1] = 1;

  // -- rain
  const quad = new THREE.PlaneGeometry(2, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position);
  const ad = new Float32Array(RN * 4);
  { let a = 0x2f6b1c3d; const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let i = 0; i < RN; i++) { ad[i * 4] = r() * RB; ad[i * 4 + 1] = r() * RH; ad[i * 4 + 2] = r() * RB; ad[i * 4 + 3] = r(); } }
  geo.setAttribute('aD', new THREE.InstancedBufferAttribute(ad, 4));
  geo.instanceCount = 0;
  const RU = { uT: { value: 0 }, uWind: { value: new THREE.Vector2(1.4, 0.6) }, uPx: { value: 0.002 }, uLen: { value: 0.75 }, uCol: { value: new THREE.Color() }, uAmt: { value: 0 } };
  const rainMat = new THREE.ShaderMaterial({ uniforms: RU, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, depthTest: true, fog: false });
  const rain = new THREE.Mesh(geo, rainMat);
  rain.frustumCulled = false; rain.matrixAutoUpdate = false; rain.visible = false; rain.name = 'rain'; rain.renderOrder = 2;
  scene.add(rain);
  let lowTier = false, rt = 0;
  try { rain.visible = true; geo.instanceCount = 1; renderer.compile(rain, camera, scene); } catch (e) { console.warn('[weather] rain not compiled ahead', e); }
  rain.visible = false; geo.instanceCount = 0;
  const _sz = new THREE.Vector2();

  function blend() {
    for (const k of NUMS) { let s = 0; for (let i = 0; i < NW; i++) s += w[i] * ST[i][k]; WX[k] = s; }
    for (const [c, m] of COLS) {
      let s = 0; WX[c].setRGB(0, 0, 0);
      for (let i = 0; i < NW; i++) { const k = w[i] * ST[i][m]; if (k > 0) { WX[c].r += ST[i][c].r * k; WX[c].g += ST[i][c].g * k; WX[c].b += ST[i][c].b * k; s += k; } }
      if (s > 1e-4) WX[c].multiplyScalar(1 / s); else WX[c].setRGB(1, 1, 1);
    }
    WX.glow.setRGB(0, 0, 0); for (let i = 0; i < NW; i++) WX.glow.r += ST[i].glow.r * w[i], WX.glow.g += ST[i].glow.g * w[i], WX.glow.b += ST[i].glow.b * w[i];
    if (lowTier) WX.deck = 0;   // Low: a plain grey sky (the mottling is about a third of what a grey sky costs the GPU over cumulus)
    let best = 0; for (let i = 1; i < NW; i++) if (w[i] > w[best]) best = i;
    WX.name = WEATHERS[best]; WX.w.set(w);
  }

  function update(dt, hour) {
    // the game hours since the epoch, following the hour the lighting shows (a jump of the clock sweeps the weather with it)
    if (abs === null) { abs = day0 * 24 + hour; last = hour; }
    let d = hour - last; d = ((d + 36) % 24) - 12; last = hour; abs += d;
    const held = fixed >= 0 || test;
    if (test && 'a' in test) { w.fill(0); w[test.a] += 1 - test.e; w[test.b] += test.e; }
    else if (test) { test.t = Math.min(test.dur, test.t + dt); const e = test.dur > 0 ? ss(0, test.dur, test.t) : 1; for (let i = 0; i < NW; i++) w[i] = test.from[i] * (1 - e) + (i === test.to ? e : 0); }
    else if (fixed >= 0) { w.fill(0); w[fixed] = 1; }
    else scheduled(abs, w);
    blend();
    WX.precip = WX.rain * (held ? 1 : showers(abs));
    // the ground: wet in a few game minutes under a shower, damp all through a rainy stretch, dry an hour or two after it
    const wetT = Math.max(WX.precip, 0.45 * WX.rain);
    if (held || Math.abs(d) > 0.25) WX.wet += (wetT - WX.wet) * (held ? 1 - Math.exp(-dt / 0.8) : 1);
    else { const gh = Math.abs(d); WX.wet += (wetT - WX.wet) * (1 - Math.exp(-gh / (wetT > WX.wet ? 0.12 : 1.2))); }

    // -- the rain: gone above the clouds' bases, its colour the haze's, lightened
    rt = (rt + dt) % 1000;
    const amt = WX.precip * ss(560, 380, camera.position.y);
    if (amt > 0.01) {
      rain.visible = true;
      geo.instanceCount = Math.round(RN * (lowTier ? 0.5 : 1) * Math.min(1, 0.35 + amt));
      RU.uT.value = rt; RU.uAmt.value = 0.32 * Math.min(1, amt * 1.3);
      renderer.getDrawingBufferSize(_sz);
      RU.uPx.value = 1.5 * 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, _sz.y);
      const f = scene.fog.color, n = game.time?.night || 0;
      RU.uCol.value.setRGB(Math.min(1, f.r * 1.25 + 0.08), Math.min(1, f.g * 1.25 + 0.08), Math.min(1, f.b * 1.25 + 0.08)).lerp(_amber, 0.25 * n);
    } else { rain.visible = false; geo.instanceCount = 0; }
  }
  const _amber = new THREE.Color(0.55, 0.38, 0.22);

  const api = {
    update, WX,
    setQuality(t) { lowTier = t === 'low'; },
    // tests: blend to a state over real seconds (0: at once); null goes back to the schedule
    set(name, seconds = 0) { const i = WEATHERS.indexOf(name); if (i < 0) { test = null; return; } w0.set(w); test = { from: Float32Array.from(w0), to: i, t: 0, dur: Math.max(0, seconds) }; },
    mix(a, b, e) { test = { a: WEATHERS.indexOf(a), b: WEATHERS.indexOf(b), e: clamp(e, 0, 1) }; },   // tests: a fixed point of a blend
    forecast(n = 8) { const p = periodAt(abs ?? day0 * 24 + 12), out = []; for (let k = 0; k < n; k++) out.push(stateOf(p + k)); return out; },   // this half day and the next ones
    get hours() { return abs; },
    rain,
  };
  return api;
}
