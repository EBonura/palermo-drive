// The sea: water surface, shoreline foam, boats and the drown-in-the-sea game over. Owned by the sea work.
//
// createSea({ scene, camera, renderer, sun, SUN_DIR, D, groundY }) -> { update(dt, camera), checkPlayer({ car, game, vehicle, placeAt, shout }), isWater(x, z) }
//
// Water: one camera-following disc (~3.5k triangles, one draw call). The fragment shader does everything from three
// small textures: a signed distance to the shore (fine 2 m raster round the harbour and the coast, coarse raster for the
// open sea), a tileable procedural slope map (three scrolling layers) and nothing else. No render targets, no extra passes.
// The terrain grids hold no bathymetry (sea cells are a flat -1.5 m), so depth comes from the distance to the shore.
// The land mask is the OSM coastline plus quays, piers and pontoons, so "land" here is whatever a lapa can stand on.
//
// Game over: when the lapa's centre is over water, game.state becomes 'over', the lapa splashes, tips and sinks, then an
// overlay offers Riprova (Enter) or Menu (window event 'pd-quit-to-title', cancelable: the shell calls preventDefault()
// to say it took care of it, else the page reloads). A window event 'pd-drowned' ({ x, z }) tells missions to fail the run.
import * as THREE from 'three';
const SEA_VCOLOR4 = !THREE.ShaderChunk.color_pars_vertex.includes('vec3 vColor');
import { QUALITY } from './mobile.js';
import { pairs, inPoly, rng } from './core.js';

const SEA_Y = -0.2;
const MOBILE = !!QUALITY.mobile;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------------
// Land mask and signed distance fields
// ---------------------------------------------------------------------------------------------------------------

// Felzenszwalb squared-distance transform along one line.
function edtPass(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e30; z[1] = 1e30;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      const p = v[k];
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k]) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e30;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}
// Distance (in cells) from every cell to the nearest cell where feat is 1, written to g. A generator: it yields every few dozen
// lines so the caller can spread a big field over several frames (see drive()).
function* edtGen(feat, w, h, g) {
  const INF = 1e12, n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feat[y * w + x] ? 0 : INF;
    edtPass(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    if ((x & 31) === 31) yield;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edtPass(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
    if ((y & 31) === 31) yield;
  }
}
const scratchFor = n => ({ water: new Uint8Array(n), a: new Float32Array(n), b: new Float32Array(n) });
// Signed distance (metres, + over water, - over land) of a land mask into out; sc = scratchFor(w * h).
function* signedDistanceGen(m, maxD, out, sc) {
  const { w, h, land } = m, water = sc.water, dW = sc.a, dL = sc.b, s = 1 / m.k;
  for (let i = 0, n = w * h; i < n; i++) water[i] = land[i] ? 0 : 1;
  yield* edtGen(land, w, h, dW);
  yield* edtGen(water, w, h, dL);
  for (let j = 0; j < h; j++) {
    for (let i = 0, o = j * w; i < w; i++, o++) out[o] = clamp(land[o] ? -(dL[o] - 0.5) * s : (dW[o] - 0.5) * s, -maxD, maxD);
    if ((j & 63) === 63) yield;
  }
  return out;
}
// Run a generator for about ms milliseconds; true when it has finished.
function drive(gen, ms) {
  const t0 = performance.now();
  do { if (gen.next().done) return true; } while (performance.now() - t0 < ms);
  return false;
}
const runAll = gen => { while (!gen.next().done); };

// Shore features that a coastline polygon alone does not hold: quays and pontoons (raised ground by the water), piers.
// Items: { k: 0 raised polygon [rings], 1 closed ring (flat), 2 polyline (flat) with width w, b: [x0, z0, x1, z1] }.
function shoreItems(streets, areas, roads, keep) {
  const out = [], bounds = flat => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < flat.length; i += 2) { if (flat[i] < a) a = flat[i]; if (flat[i] > c) c = flat[i]; if (flat[i + 1] < b) b = flat[i + 1]; if (flat[i + 1] > d) d = flat[i + 1]; } return [a, b, c, d]; };
  for (const poly of (streets && streets.raised) || []) { const b = bounds(poly[0]); if (keep(b)) out.push({ k: 0, poly, b }); }
  for (const a of areas || []) if (a.k === 'pier') { const b = bounds(a.p); if (keep(b)) out.push({ k: 1, p: a.p, b }); }
  for (const r of roads || []) if (r.k === 'pier') { const b = bounds(r.p); if (keep(b)) out.push({ k: 2, p: r.p, w: Math.max(r.w || 5, 3), b }); }
  return out;
}

// Paint the land of one box on a canvas (white = land) at k px per metre; land is the coastline ring (flat), islands extra rings,
// items the shore features above. Returns { w, h, land: Uint8Array (1 = land), k, box }. outLand lets a caller reuse the buffer.
function rasterLand(box, k, src, outLand) {
  const w = Math.ceil((box.x1 - box.x0) * k), h = Math.ceil((box.z1 - box.z0) * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.setTransform(k, 0, 0, k, -box.x0 * k, -box.z0 * k);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const path = flat => { for (let i = 0; i < flat.length; i += 2) g[i ? 'lineTo' : 'moveTo'](flat[i], flat[i + 1]); };
  g.beginPath(); path(src.land); g.closePath(); g.fill();
  for (const r of src.islands || []) { g.beginPath(); path(r); g.closePath(); g.fill(); }
  for (const it of src.items || []) {
    if (it.b[2] < box.x0 - 20 || it.b[0] > box.x1 + 20 || it.b[3] < box.z0 - 20 || it.b[1] > box.z1 + 20) continue;
    if (it.k === 0) { g.beginPath(); for (const ring of it.poly) { path(ring); g.closePath(); } g.fill('evenodd'); }
    else if (it.k === 1) { g.beginPath(); path(it.p); g.closePath(); g.fill(); }
    else { g.lineWidth = it.w; g.beginPath(); path(it.p); g.stroke(); }
  }
  const px = g.getImageData(0, 0, w, h).data, land = outLand && outLand.length >= w * h ? outLand : new Uint8Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) land[i] = px[i * 4] > 127 ? 1 : 0;
  return { w, h, land, k, box };
}

// Bilinear read of a signed-distance field (cell centres at +0.5); NaN outside it.
function sampleField(f, x, z) {
  const i = (x - f.x0) * f.k - 0.5, j = (z - f.z0) * f.k - 0.5;
  if (i < 0 || j < 0 || i >= f.w - 1 || j >= f.h - 1) return NaN;
  const i0 = i | 0, j0 = j | 0, fx = i - i0, fz = j - j0, o = j0 * f.w + i0, s = f.sdf;
  return (s[o] * (1 - fx) + s[o + 1] * fx) * (1 - fz) + (s[o + f.w] * (1 - fx) + s[o + f.w + 1] * fx) * fz;
}
function halfTexture(sdf, w, h) {
  const u16 = new Uint16Array(w * h);
  for (let i = 0; i < u16.length; i++) u16[i] = THREE.DataUtils.toHalfFloat(sdf[i]);
  const t = new THREE.DataTexture(u16, w, h, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// Procedural water slope texture: R,G = slope (x, y), A = soft noise (foam breakup, seabed patches). Tiles.
// ---------------------------------------------------------------------------------------------------------------
function makeWaterTexture(S) {
  const rand = rng(7311);
  const tileNoise = cells => {
    const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      const xi = ((x0 % cells) + cells) % cells, xj = (xi + 1) % cells, yi = ((y0 % cells) + cells) % cells, yj = (yi + 1) % cells;
      return (g[yi * cells + xi] * (1 - ux) + g[yi * cells + xj] * ux) * (1 - uy) + (g[yj * cells + xi] * (1 - ux) + g[yj * cells + xj] * ux) * uy;
    };
  };
  const oct = [4, 8, 16, 32, 64].map(c => ({ c, f: tileNoise(c) })), amp = [1, 0.6, 0.34, 0.2, 0.11];
  const al = [6, 12, 24].map(c => ({ c, f: tileNoise(c) })), aamp = [0.55, 0.3, 0.15];
  const H = new Float32Array(S * S), A = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0, a = 0;
    for (let o = 0; o < oct.length; o++) { const n = oct[o].f(x / S * oct[o].c, y / S * oct[o].c), r = 1 - Math.abs(2 * n - 1); h += amp[o] * r * r; }
    for (let o = 0; o < al.length; o++) a += aamp[o] * al[o].f(x / S * al[o].c, y / S * al[o].c);
    H[y * S + x] = h; A[y * S + x] = a;
  }
  let amin = 1e9, amax = -1e9; for (const a of A) { if (a < amin) amin = a; if (a > amax) amax = a; }
  const gx = new Float32Array(S * S), gy = new Float32Array(S * S); let sum2 = 0;
  const at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = at(x + 1, y) - at(x - 1, y), b = at(x, y + 1) - at(x, y - 1);
    gx[y * S + x] = a; gy[y * S + x] = b; sum2 += a * a + b * b;
  }
  const k = 1 / (3 * Math.sqrt(sum2 / (2 * S * S))), data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = Math.round((clamp(gx[i] * k, -1, 1) * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((clamp(gy[i] * k, -1, 1) * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = 128;
    data[i * 4 + 3] = Math.round(smooth(0.08, 0.92, (A[i] - amin) / (amax - amin)) * 255);
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = MOBILE ? 2 : 8; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// The water surface shader
// ---------------------------------------------------------------------------------------------------------------
const WATER_VERT = /* glsl */`
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform sampler2D uSdfF;
uniform sampler2D uSdfC;
uniform sampler2D uNrm;
uniform vec4 uBoxF;
uniform vec4 uBoxC;
uniform vec4 uClear;
uniform vec3 uAmb;   // [day/night] src/daynight.js: scales the water colour and foam (1 by day, dark blue at night)
varying vec3 vWorld;
#include <fog_pars_fragment>

float shoreDist(vec2 p) {
  float c = texture2D(uSdfC, (p - uBoxC.xy) * uBoxC.zw).r;
  vec2 uf = (p - uBoxF.xy) * uBoxF.zw;
  float f = texture2D(uSdfF, clamp(uf, 0.0, 1.0)).r;
  vec2 e = min(uf, 1.0 - uf) / (uBoxF.zw * 70.0);                 // metres to the window edge, in 70 m units: the fine field fades out there
  float inside = clamp(min(e.x, e.y), 0.0, 1.0);
  return mix(c, f, inside * (1.0 - smoothstep(40.0, 80.0, f)));
}

vec3 skyCol(vec3 r) {
  float h = clamp(r.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
  float s = max(dot(r, uSunDir), 0.0);
  return c + uSunCol * (pow(s, 10.0) * 0.12 + pow(s, 200.0) * 1.5);
}

void main() {
  vec2 p = vWorld.xz;
  float d = shoreDist(p);
  if (d < -0.15) discard;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // slopes: three scrolling layers of the same tile at different scales and angles
  vec2 s1 = texture2D(uNrm, (p + uTime * vec2(0.50, 0.30)) / 5.0).rg;
  mat2 R2 = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 s2 = texture2D(uNrm, (R2 * p + uTime * vec2(-0.20, 0.34)) / 17.0).rg;
  vec2 sl = (s1 - 0.5) * 1.0 + (s2 - 0.5) * 1.3 * R2;
  #ifndef LOW
  vec2 s3 = texture2D(uNrm, (p * mat2(0.6, 0.8, -0.8, 0.6) + uTime * vec2(0.12, -0.10)) / 61.0).rg;
  sl += (s3 - 0.5) * 1.6 * mat2(0.6, -0.8, 0.8, 0.6);
  #endif
  float calm = 0.55 + 0.45 * smoothstep(0.0, 30.0, d);          // lapping, not chop, at the quay
  sl *= 0.46 * calm / (1.0 + dist * 0.0011);
  vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y));

  // depth from the distance to the shore: shallow shelf, then dropping away
  float depth = 0.25 + 0.06 * min(d, 70.0) + 0.5 * max(d - 70.0, 0.0);

  // seabed seen through the water (sand, rock, a hint of posidonia), shifted by the waves
  vec2 q = p + N.xz * min(depth, 3.0) * 0.8;
  float bn = texture2D(uNrm, q / 11.0).a;
  vec3 sand = vec3(0.70, 0.60, 0.38), rock = vec3(0.26, 0.24, 0.20), weed = vec3(0.10, 0.17, 0.08);
  vec3 bed = mix(sand, rock, smoothstep(0.50, 0.78, bn) * 0.85);
  #ifndef LOW
  float bn2 = texture2D(uNrm, q / 2.9 + 0.37).a;
  bed = mix(bed, weed, smoothstep(0.58, 0.85, bn2) * 0.55 * smoothstep(0.8, 3.0, depth));
  bed *= 0.85 + 0.3 * bn2;
  #endif
  vec3 trans = exp(-vec3(0.55, 0.11, 0.075) * depth);                           // red goes first
  vec3 scat = mix(vec3(0.020, 0.50, 0.46), vec3(0.004, 0.085, 0.24), 1.0 - exp(-depth * 0.13));
  float lit = 0.62 + 0.55 * max(dot(N, uSunDir), 0.0);
  vec3 body = (bed * trans * trans * exp(-depth * 0.3) + scat * (1.0 - exp(-depth * 0.5))) * lit * uAmb;

  // sky reflection (fresnel) and the sun glint path
  float ndv = max(dot(N, V), 0.0);
  float fres = mix(0.03, 1.0, pow(1.0 - ndv, 4.2));
  vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);
  vec3 col = mix(body, skyCol(Rf), fres);
  float sd = max(dot(Rf, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 900.0) * 34.0 + pow(sd, 90.0) * 1.3 + pow(sd, 7.0) * 0.07) * (0.35 + 0.65 * fres);

  // shoreline: lapping foam, crisp waterline, lines of surf running out from the edge
  float n1 = texture2D(uNrm, p / 9.0 + vec2(uTime * 0.010, 0.0)).a;
  float n2 = texture2D(uNrm, p / 2.7 - vec2(0.0, uTime * 0.018)).a;
  float lap = 0.5 + 0.5 * sin(uTime * 0.75 + n1 * 6.283);
  float wd = 0.30 + 1.30 * lap;
  float edge = 1.0 - smoothstep(0.0, wd, d + (n1 - 0.5) * 0.9);
  float foam = edge * smoothstep(0.30, 0.62, n2 * 0.6 + n1 * 0.55);
  foam = max(foam * 0.9, (1.0 - smoothstep(0.0, 0.22, d)) * 0.85);
  float rings = smoothstep(0.80, 1.0, sin(d * 1.15 - uTime * 0.8 + n1 * 3.0)) * (1.0 - smoothstep(0.8, 7.0, d)) * smoothstep(0.35, 0.9, n2 + n1 * 0.5) * 0.35;
  foam = clamp(foam + rings, 0.0, 1.0);
  col = mix(col, vec3(0.96, 0.98, 1.0) * (0.78 + 0.22 * lit) * uAmb, foam);

  // soft waterline; clear glass round the drowning spot so the lapa can be seen going down
  float alpha = smoothstep(-0.1, 0.25, d);
  float clearA = uClear.w * (1.0 - smoothstep(0.35 * uClear.z, uClear.z, length(p - uClear.xy)));
  alpha = min(alpha, 1.0 - 0.58 * clearA * (1.0 - foam));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function makeDisc() {
  const NR = 48, M = 38, r0 = 2, R = 24000, pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let i = 0; i <= M; i++) {
    const r = r0 * Math.pow(R / r0, i / M);
    for (let a = 0; a < NR; a++) { const t = a / NR * Math.PI * 2; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r); }
  }
  for (let a = 0; a < NR; a++) idx.push(0, 1 + (a + 1) % NR, 1 + a);
  for (let i = 0; i < M; i++) for (let a = 0; a < NR; a++) {
    const a0 = 1 + i * NR + a, a1 = 1 + i * NR + (a + 1) % NR, b0 = 1 + (i + 1) * NR + a, b1 = 1 + (i + 1) * NR + (a + 1) % NR;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Boats: low-poly hulls built in code, one InstancedMesh per kind, per-instance tints
// ---------------------------------------------------------------------------------------------------------------
class Mesher {
  constructor() { this.p = []; this.c = []; this.t = []; }
  tri(a, b, c, col, tint) { for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.c.push(col.r, col.g, col.b); this.t.push(tint); } }
  quad(a, b, c, d, col, tint = 0) { this.tri(a, b, c, col, tint); this.tri(a, c, d, col, tint); }
  box(cx, cy, cz, sx, sy, sz, col, tint = 0) { // centred in x and z, cy is the bottom
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy, y1 = cy + sy, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) this.quad(P[f[0]], P[f[1]], P[f[2]], P[f[3]], col, tint);
  }
  geometry(count) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.t, 1));
    g.computeVertexNormals(); // non-indexed: flat faces
    g.setAttribute('iCol1', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('iCol2', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }
}
const C = h => new THREE.Color(h);

// Lofted hull. z runs stern (-L/2) to bow (+L/2); y = 0 is the waterline.
function loft(m, { L, B, F, draft, rise, transom, band, top, bottom, deck, N = 9 }) {
  const rows = [[0, 1.0], [0.1, 0.99], [0.36, 0.94], [0.7, 0.62], [1, 0]]; // depth fraction below the gunwale, width fraction
  const st = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, z = -L / 2 + u * L;
    const hw = u > 0.5 ? B / 2 * (1 - Math.pow((u - 0.5) / 0.5, 2.1)) : B / 2 * (transom + (1 - transom) * (1 - Math.pow((0.5 - u) / 0.5, 2)));
    const s = Math.max(0, (u - 0.4) / 0.6), t = Math.max(0, (0.25 - u) / 0.25);
    const yk = -draft * (1 - 0.9 * Math.pow(s, 2.3) - 0.3 * t * t), yg = F + rise * Math.pow(u, 3) + rise * 0.12 * Math.pow(1 - u, 2);
    const row = [];
    for (const [f, wf] of rows) row.push([hw * wf, yg + (yk - yg) * f, z]);
    st.push(row);
  }
  const cols = [band.col, top.col, bottom.col, bottom.col], tints = [band.tint, top.tint, bottom.tint, bottom.tint];
  for (let i = 0; i < N; i++) for (let r = 0; r < 4; r++) for (const sg of [1, -1]) {
    const a = st[i][r], b = st[i][r + 1], c = st[i + 1][r + 1], d = st[i + 1][r];
    const mk = v => [v[0] * sg, v[1], v[2]];
    m.quad(mk(a), mk(b), mk(c), mk(d), cols[r], tints[r]);
  }
  for (let i = 0; i < N; i++) { // deck
    const a = st[i][0], d = st[i + 1][0];
    m.quad([-a[0], a[1], a[2]], [a[0], a[1], a[2]], [d[0], d[1], d[2]], [-d[0], d[1], d[2]], deck.col, deck.tint);
  }
  const f = st[0], mid = [0, (f[0][1] + f[4][1]) / 2, f[0][2]]; // transom
  const ring = [...f.map(v => [-v[0], v[1], v[2]]), ...f.slice(0, 4).reverse().map(v => [v[0], v[1], v[2]])];
  for (let i = 0; i < ring.length; i++) m.tri(mid, ring[i], ring[(i + 1) % ring.length], top.col, top.tint);
  return st;
}

function gozzoGeometry(count) {
  const m = new Mesher(), white = C('#f1eee6'), wood = C('#b88a58'), dark = C('#1c2832'), black = C('#26201c'), cream = C('#eadfbf');
  loft(m, { L: 7.5, B: 2.5, F: 0.6, draft: 0.5, rise: 0.38, transom: 0.74, band: { col: white, tint: 2 }, top: { col: white, tint: 1 }, bottom: { col: C('#7a2d24'), tint: 0 }, deck: { col: wood, tint: 0 } });
  m.box(0, 0.6, 1.2, 1.5, 1.2, 1.5, white, 2);                // wheelhouse
  m.box(0, 1.8, 1.2, 1.8, 0.1, 1.9, white, 1);                // its roof
  m.box(0, 0.95, 1.96, 1.1, 0.5, 0.05, dark);                 // windscreen
  m.box(0.77, 0.95, 1.2, 0.05, 0.5, 0.9, dark); m.box(-0.77, 0.95, 1.2, 0.05, 0.5, 0.9, dark);
  for (const sx of [-0.85, 0.85]) for (const z of [-2.3, -0.9]) m.box(sx, 0.6, z, 0.07, 1.25, 0.07, black); // awning posts
  m.box(0, 1.85, -1.6, 2.0, 0.07, 1.8, cream);                // awning aft
  m.box(0, 0.6, 3.1, 0.07, 1.5, 0.07, black);                 // bow staff
  m.box(0, 0.6, -3.55, 0.5, 0.35, 0.4, black);                // outboard
  return m.geometry(count);
}
function yachtGeometry(count) {
  const m = new Mesher(), white = C('#f4f4f0'), deck = C('#d6c8a6'), dark = C('#1a2430'), grey = C('#8d96a0');
  loft(m, { L: 11, B: 3.6, F: 0.95, draft: 0.7, rise: 0.4, transom: 0.9, band: { col: white, tint: 2 }, top: { col: white, tint: 0 }, bottom: { col: C('#2c3c52'), tint: 0 }, deck: { col: deck, tint: 0 } });
  m.box(0, 0.95, -0.4, 2.8, 1.25, 4.2, white, 0);              // cabin
  m.box(0, 2.15, -0.5, 3.0, 0.1, 4.4, white, 0);               // roof
  m.box(0, 1.45, -0.4, 2.86, 0.45, 3.4, dark);                 // window band
  m.box(0, 1.1, 1.78, 2.0, 0.55, 0.06, dark);                  // windscreen
  m.box(0, 2.25, -1.0, 1.9, 0.9, 2.0, white, 0);               // flybridge
  m.box(0, 2.5, -1.0, 1.96, 0.35, 2.06, dark);
  m.box(0, 3.1, -1.0, 2.1, 0.07, 2.2, white, 0);
  m.box(0, 3.15, -1.0, 0.07, 1.1, 0.07, grey);                 // radar mast
  m.box(0, 4.2, -1.0, 1.3, 0.07, 0.35, grey);
  m.box(0, 0.95, -3.0, 2.6, 0.3, 1.4, white, 2);               // sunbathing pad
  return m.geometry(count);
}
function ferryGeometry(count) {
  const m = new Mesher(), white = C('#f1f2f0'), dark = C('#1b2733'), deck = C('#9aa0a4'), grey = C('#787f86'), orange = C('#d9561f');
  loft(m, { L: 136, B: 25, F: 9.5, draft: 6, rise: 5, transom: 0.92, band: { col: white, tint: 0 }, top: { col: white, tint: 1 }, bottom: { col: C('#7a2d24'), tint: 0 }, deck: { col: deck, tint: 0 }, N: 12 });
  const win = (cx, y, cz, len, w, h) => { m.box(cx, y, cz, w + 0.12, h, len, dark); };
  m.box(0, 9.5, -8, 21.5, 6.0, 96, white, 0);                  // main deck block
  win(0, 12.2, -8, 90, 21.5, 1.3); win(0, 14.4, -8, 90, 21.5, 1.0);
  m.box(0, 15.5, -14, 19.5, 4.0, 70, white, 0); win(0, 17.4, -14, 64, 19.5, 1.2);
  m.box(0, 19.5, 14, 17.0, 3.4, 26, white, 0); win(0, 20.8, 14, 24, 17.0, 1.2); // bridge block
  m.box(0, 22.9, 16, 18.4, 1.4, 6, dark);                      // bridge windows
  m.box(0, 20.0, -34, 8.5, 9.0, 11, white, 2);                 // funnel
  m.box(0, 28.0, -34, 8.7, 1.4, 11.2, dark);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) m.box(sx * 10.6, 14.5, -40 + i * 11, 1.6, 1.6, 8, orange); // lifeboats
  m.box(0, 9.5, 52, 12, 2.2, 10, grey, 0);                     // bow deck gear
  m.box(0, 9.5, -66, 14, 2.6, 6, grey, 0);                     // stern ramp housing
  return m.geometry(count);
}
function buoyGeometry(count) {
  const m = new Mesher(), N = 8, cols = [C('#f0efe8'), C('#222')];
  const ring = (y, r) => { const a = []; for (let i = 0; i < N; i++) a.push([Math.cos(i / N * 6.2832) * r, y, Math.sin(i / N * 6.2832) * r]); return a; };
  const lv = [[-0.3, 0.2], [0.0, 0.5], [0.55, 0.48], [1.0, 0.3], [1.9, 0.12]];
  for (let l = 0; l < lv.length - 1; l++) {
    const a = ring(lv[l][0], lv[l][1]), b = ring(lv[l + 1][0], lv[l + 1][1]);
    for (let i = 0; i < N; i++) m.quad(a[i], b[i], b[(i + 1) % N], a[(i + 1) % N], l === 2 ? cols[0] : cols[1], l === 2 ? 0 : 1);
  }
  m.box(0, 1.9, 0, 0.3, 0.3, 0.3, C('#ffe9a0'));
  m.box(0, 1.95, 0, 0.06, 0.8, 0.06, C('#333'));
  return m.geometry(count);
}

function boatMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nattribute float aTint; attribute vec3 iCol1; attribute vec3 iCol2;')
      // three r180+ declares vColor as vec4; older releases as vec3. Emit whichever this build uses.
      .replace('#include <color_vertex>', SEA_VCOLOR4
        ? 'vColor = vec4(color.rgb * mix(vec3(1.0), mix(iCol1, iCol2, step(1.5, aTint)), step(0.5, aTint)), 1.0);'
        : 'vColor = color * mix(vec3(1.0), mix(iCol1, iCol2, step(1.5, aTint)), step(0.5, aTint));');
  };
  return mat;
}

// ---------------------------------------------------------------------------------------------------------------
// Drowning lines (Italian/Palermitan with English subtitles; the same text is in assets/sea/lines.md for review)
// ---------------------------------------------------------------------------------------------------------------
const LINES = [
  ['Minchia, e unni pensavi d’annari? A Tunisi?', 'Damn, where did you think you were going? Tunis?'],
  ['Il Foro Italico finisce lì, genio. Dopo c’è il mare.', 'The Foro Italico ends there, genius. After that it’s the sea.'],
  ['Santa Rosalia fa miracoli, ma non per chi guida così.', 'Santa Rosalia works miracles, but not for driving like that.'],
  ['Cercavi un arancino, hai trovato il fondale.', 'You were after an arancino, you found the seabed.'],
  ['A mari ci vai cu ’a barca, non cu ’a lapa!', 'You go to sea in a boat, not in a lapa!'],
  ['Nemmeno il tempo di dire “cannolo” e sei già sott’acqua.', 'Not even time to say “cannolo” and you’re already under.'],
  ['Ti serviva una granita, ma questa è salata.', 'You wanted a granita, but this one is salty.'],
  ['Talia ca bagnu! Fuori stagione, pure.', 'Look at that swim! Out of season, too.'],
  ['La lapa galleggia come un sasso. Lo sapevi? Ora sì.', 'The lapa floats like a rock. Did you know? Now you do.'],
  ['Mamma mia, che tuffo. Voto: sei e mezzo.', 'Mamma mia, what a dive. Score: six and a half.'],
];
const SHOUTS = ['Minchia!', 'Mamma mia!', 'Bedda matri!', 'Aiuto!'];

// ---------------------------------------------------------------------------------------------------------------
// createSea
// ---------------------------------------------------------------------------------------------------------------
export function createSea({ scene, camera: cam0, renderer, sun, SUN_DIR, D, groundY, getWorld }) {
  const T0 = performance.now();
  const sunDir = SUN_DIR.clone().normalize();
  const stats = { initMs: 0, setupMs: 0, coarseMs: 0, winBuilds: 0, winMs: 0, winLastMs: 0, items: 0 };

  // Distance fields, all in metres from the shore (+ water, - land):
  //  - coarse: the whole bbox of the city at 24 m (32 m on phones), built once from the manifest coastline (src/world.js, manifest.land + islands);
  //  - fine: a 1.6 km window (1.2 km on phones) at 2 m (3 m) that follows the camera, rebuilt in slices of a few ms when the camera
  //    leaves its middle. It also holds the quays, pontoons and piers of the tiles that have streamed in (harvested per tile below).
  // Until the manifest is in nothing is built and the water stays hidden; the first coarse field takes a few frames.
  const CK = MOBILE ? 1 / 32 : 1 / 24, WK = MOBILE ? 1 / 3 : 1 / 2, WSIZE = MOBILE ? 1200 : 1600, WW = Math.round(WSIZE * WK);
  const dummy = halfTexture(new Float32Array([1000]), 1, 1);
  let coarse = null, front = null, ready = false, world = null, landFlat = null, islandsFlat = [];
  const extras = new Map();   // tile key -> shore items harvested when the tile reached full detail
  let extrasDirty = false, extrasAt = 0;

  // Is (x, z) open water? Exact (a 2 m field, bilinear) near the camera, the coastline polygon elsewhere.
  function isWater(x, z) {
    if (front) { const v = sampleField(front, x, z); if (v === v) return v > 0; }
    if (world && world.manifest) return !world.isLand(x, z);
    return !inPoly(pairsOf(D.land), x, z);
  }
  let landPairsCache = null;
  const pairsOf = flat => landPairsCache || (landPairsCache = pairs(flat));
  // Signed distance to the shore (m, + over water): the fine window where the camera is, the coarse field elsewhere.
  function shoreAt(x, z) {
    if (front) { const v = sampleField(front, x, z); if (v === v) return v; }
    if (coarse) { const v = sampleField(coarse, x, z); if (v === v) return v; return coarse.sdf[clamp(((z - coarse.z0) * coarse.k) | 0, 0, coarse.h - 1) * coarse.w + clamp(((x - coarse.x0) * coarse.k) | 0, 0, coarse.w - 1)]; }
    return 1000;
  }

  // -- the water
  const nrmTex = makeWaterTexture(256);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunCol: { value: new THREE.Color(1.0, 0.86, 0.62) },
    uHorizon: { value: new THREE.Color('#a8cbe6') }, uZenith: { value: new THREE.Color('#3d7fc4') },
    uSdfF: { value: dummy }, uSdfC: { value: dummy }, uNrm: { value: nrmTex },
    uBoxF: { value: new THREE.Vector4(1e7, 1e7, 1e-6, 1e-6) }, uBoxC: { value: new THREE.Vector4(0, 0, 1e-6, 1e-6) },
    uClear: { value: new THREE.Vector4(0, 0, 14, 0) }, uAmb: { value: new THREE.Color(1, 1, 1) },
  }]);
  const waterMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true, transparent: true, depthWrite: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8, defines: MOBILE ? { LOW: 1 } : {},
  });
  const water = new THREE.Mesh(makeDisc(), waterMat);
  water.position.y = SEA_Y; water.frustumCulled = false; water.renderOrder = -10; water.visible = false;
  scene.add(water);

  // -- fields
  const winTex = new THREE.DataTexture(new Uint16Array(WW * WW), WW, WW, THREE.RedFormat, THREE.HalfFloatType);
  winTex.minFilter = winTex.magFilter = THREE.LinearFilter; winTex.wrapS = winTex.wrapT = THREE.ClampToEdgeWrapping; winTex.generateMipmaps = false; winTex.unpackAlignment = 1;
  const bufs = [{ sdf: new Float32Array(WW * WW) }, { sdf: new Float32Array(WW * WW) }];
  const winLand = new Uint8Array(WW * WW), winScratch = scratchFor(WW * WW), winU16 = new Uint16Array(WW * WW);
  let flip = 0, build = null, buildSince = 0;

  // Quays, pontoons and piers of a tile that just reached full detail, kept only where the coast is near (coarse field).
  function harvest(t) {
    const d = t.data; if (!d || !coarse || extras.has(t.k)) return;
    const x0 = t.i * 500, z0 = t.j * 500; let coastal = false;
    for (let a = 0; a <= 4 && !coastal; a++) for (let b = 0; b <= 4; b++) { const s = shoreAt(x0 + a * 125, z0 + b * 125); if (Math.abs(s) < 150) { coastal = true; break; } }
    if (!coastal) { extras.set(t.k, null); return; }
    const items = shoreItems(d.streets, d.areas, d.roads, b => { const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2; return Math.abs(shoreAt(cx, cz)) < 130 + Math.hypot(b[2] - b[0], b[3] - b[1]) / 2; });
    extras.set(t.k, items); stats.items += items.length;
    if (items.length) { extrasDirty = true; extrasAt = performance.now(); }
  }
  function onTile(kind, t) { if (kind === 'full') harvest(t); }

  const worldBox = () => { const b = world.manifest.bbox; return { x0: b[0], z0: b[1], x1: b[2], z1: b[3] }; };
  function* setup() {
    const t0 = performance.now(), M = world.manifest, box = worldBox();
    landFlat = M.land; islandsFlat = M.islands || [];
    const m = rasterLand(box, CK, { land: landFlat, islands: islandsFlat });
    yield;
    const sdf = new Float32Array(m.w * m.h);
    yield* signedDistanceGen(m, 3000, sdf, scratchFor(m.w * m.h));
    coarse = { x0: box.x0, z0: box.z0, w: m.w, h: m.h, k: CK, sdf };
    uniforms.uSdfC.value = halfTexture(sdf, m.w, m.h);
    uniforms.uBoxC.value.set(box.x0, box.z0, 1 / (m.w / CK), 1 / (m.h / CK));
    ready = true; water.visible = true;
    stats.coarseMs = performance.now() - t0;
    world.onTile(onTile);   // replays 'full' for the tiles already in
    yield;
    yield* fleetFields();
    try { placeBoats(); } catch (e) { console.warn('[sea] boats skipped', e); }
  }

  // The window: land (coastline + islands + harvested quays) rasterised, then the signed distance; the old window stays live meanwhile.
  function* buildWindow(wx0, wz0) {
    const t0 = performance.now(), box = { x0: wx0, z0: wz0, x1: wx0 + WSIZE, z1: wz0 + WSIZE }, items = [];
    for (const list of extras.values()) if (list) for (const it of list) if (it.b[2] >= box.x0 - 20 && it.b[0] <= box.x1 + 20 && it.b[3] >= box.z0 - 20 && it.b[1] <= box.z1 + 20) items.push(it);
    const m = rasterLand(box, WK, { land: landFlat, islands: islandsFlat, items }, winLand);
    // the polygon only exists inside the bbox: outside it the nearest cell inside decides (land stays land, sea stays sea)
    const bb = world.manifest.bbox, ix0 = Math.ceil((bb[0] - wx0) * WK), ix1 = Math.floor((bb[2] - wx0) * WK) - 1, iz0 = Math.ceil((bb[1] - wz0) * WK), iz1 = Math.floor((bb[3] - wz0) * WK) - 1;
    if (ix0 > 0 || iz0 > 0 || ix1 < WW - 1 || iz1 < WW - 1) {
      for (let j = 0; j < WW; j++) for (let i = 0; i < WW; i++) {
        const si = clamp(i, ix0, ix1), sj = clamp(j, iz0, iz1);
        if (si !== i || sj !== j) winLand[j * WW + i] = winLand[sj * WW + si];
      }
    }
    yield;
    const back = bufs[flip ^ 1];
    yield* signedDistanceGen(m, 120, back.sdf, winScratch);
    for (let j = 0; j < WW; j++) {
      for (let i = 0, o = j * WW; i < WW; i++, o++) winU16[o] = THREE.DataUtils.toHalfFloat(back.sdf[o]);
      if ((j & 31) === 31) yield;
    }
    winTex.image.data.set(winU16); winTex.needsUpdate = true;
    uniforms.uSdfF.value = winTex; uniforms.uBoxF.value.set(wx0, wz0, 1 / WSIZE, 1 / WSIZE);
    flip ^= 1; front = { x0: wx0, z0: wz0, w: WW, h: WW, k: WK, sdf: back.sdf };
    stats.winBuilds++; stats.winLastMs = performance.now() - t0;
  }
  let job = null, centre = { x: 1e9, z: 1e9 };
  function fieldsUpdate(camera) {
    if (!world) { world = getWorld && getWorld(); if (!world) return; }
    if (!world.manifest) return;
    const budget = ready ? 2.5 : 10, t0 = performance.now();
    if (!job && !ready) job = { gen: setup(), win: false };
    if (!job && ready) {
      const cp = camera.position, far = (cp.x - centre.x) ** 2 + (cp.z - centre.z) ** 2 > 330 * 330;
      const now = performance.now();
      if (!front || far || (extrasDirty && now - extrasAt > 700 && now - buildSince > 2500)) {
        extrasDirty = false; buildSince = now; centre = { x: cp.x, z: cp.z };
        job = { gen: buildWindow(Math.floor((cp.x - WSIZE / 2) / 16) * 16, Math.floor((cp.z - WSIZE / 2) / 16) * 16), win: true };
      }
    }
    if (job) {
      const isWin = job.win;
      if (drive(job.gen, budget)) job = null;
      stats[isWin ? 'winMs' : 'setupMs'] += performance.now() - t0;
    }
  }

  // Small 2 m fields over the centro's basin and port for placing the boats (quay-accurate), built once with the coarse field.
  const boatFields = [];
  function* fleetFields() {
    for (const box of [{ x0: 400, z0: -900, x1: 960, z1: -290 }, { x0: 40, z0: -1900, x1: 920, z1: -1000 }]) {
      const items = shoreItems(D.streets, D.areas, D.roads, b => b[2] >= box.x0 - 20 && b[0] <= box.x1 + 20 && b[3] >= box.z0 - 20 && b[1] <= box.z1 + 20);
      const m = rasterLand(box, 1 / 2, { land: landFlat, islands: islandsFlat, items });
      const sdf = yield* signedDistanceGen(m, 120, new Float32Array(m.w * m.h), scratchFor(m.w * m.h));
      boatFields.push({ x0: box.x0, z0: box.z0, w: m.w, h: m.h, k: 1 / 2, sdf });
      yield;
    }
  }
  function boatShore(x, z) {
    for (const f of boatFields) { const v = sampleField(f, x, z); if (v === v) return v; }
    return shoreAt(x, z);
  }

  // -- boats (placed once, a moment after the first frame so loading stays quick)
  const boatMat = boatMaterial(), fleets = [];
  let boatsReady = false;
  function placeBoats() {
    const rand = rng(2024), placed = [];
    const overlap = (a, b) => { // two oriented rectangles (centre, yaw, length, width), separating axis test
      const ax = [[Math.sin(a.yaw), Math.cos(a.yaw)], [Math.cos(a.yaw), -Math.sin(a.yaw)], [Math.sin(b.yaw), Math.cos(b.yaw)], [Math.cos(b.yaw), -Math.sin(b.yaw)]];
      const cs = r => { const f = [Math.sin(r.yaw), Math.cos(r.yaw)], s = [f[1], -f[0]], o = []; for (const [i, j] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) o.push([r.x + f[0] * i * r.L / 2 + s[0] * j * r.B / 2, r.z + f[1] * i * r.L / 2 + s[1] * j * r.B / 2]); return o; };
      const ca = cs(a), cb = cs(b);
      for (const [ux, uz] of ax) {
        let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
        for (const p of ca) { const v = p[0] * ux + p[1] * uz; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
        for (const p of cb) { const v = p[0] * ux + p[1] * uz; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
        if (a1 < b0 || b1 < a0) return false;
      }
      return true;
    };
    const fits = (r, minShore) => { // the whole footprint is water with some room to the shore
      const f = [Math.sin(r.yaw), Math.cos(r.yaw)], s = [f[1], -f[0]];
      for (const i of [-0.42, -0.25, 0, 0.25, 0.5]) for (const j of [-0.5, 0, 0.5]) if (boatShore(r.x + f[0] * i * r.L + s[0] * j * r.B, r.z + f[1] * i * r.L + s[1] * j * r.B) < minShore) return false;
      return true;
    };
    const free = (r, pad = 0.5) => { const q = { ...r, L: r.L + pad, B: r.B + pad }; return !placed.some(p => overlap(q, p)); };
    const list = { gozzo: [], yacht: [], ferry: [], buoy: [] };
    const GOZZI = ['#f1eee6', '#1f56a8', '#c23a2a', '#f1eee6', '#2b6fc4', '#f1eee6', '#d9d6cc'], GOZZI2 = ['#2b6fc4', '#f1eee6', '#f1eee6', '#c23a2a', '#f1eee6', '#e8c030', '#1f56a8'];
    const add = (kind, x, z, yaw, scale, L, B, extra = {}) => {
      const r = { kind, x, z, yaw, L: L * scale, B: B * scale };
      list[kind].push({ ...r, scale, phase: rand() * 6.28, f: 0.7 + rand() * 0.7, ...extra });
      placed.push(r);
    };
    const gozzo = (x, z, yaw, swing, shore = 1.2) => {
      const sc = 0.8 + rand() * 0.45, r = { x, z, yaw, L: 7.5 * sc, B: 2.5 * sc };
      if (!fits(r, shore) || !free(r)) return false;
      const k = Math.floor(rand() * GOZZI.length);
      add('gozzo', x, z, yaw, sc, 7.5, 2.5, { c1: C(GOZZI[k]), c2: C(GOZZI2[k]), swing }); return true;
    };
    const yacht = (x, z, yaw, swing, shore = 1.2) => {
      const sc = 0.8 + rand() * 0.5, r = { x, z, yaw, L: 11 * sc, B: 3.6 * sc };
      if (!fits(r, shore) || !free(r)) return false;
      add('yacht', x, z, yaw, sc, 11, 3.6, { c1: C('#fff'), c2: C(['#1d3a6b', '#2a8f93', '#8a2222', '#222'][Math.floor(rand() * 4)]), swing }); return true;
    };
    // moored stern-to along the pontoons of La Cala
    for (const rd of D.roads) {
      if (rd.k !== 'pier') continue;
      const p = pairs(rd.p); if (p[0][0] < 450 || p[0][0] > 900 || p[0][1] < -850 || p[0][1] > -350) continue;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1], len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
        for (const side of [1, -1]) {
          const nx = -tz * side, nz = tx * side;
          for (let s = 3; s < len - 1.5; s += 3.2 + rand() * 1.8) {
            if (rand() < 0.55) continue;
            const isY = rand() < 0.3, L = (isY ? 11 : 7.5) * (0.8 + rand() * 0.3);
            const x = ax + tx * s + nx * (2.9 + L / 2), z = az + tz * s + nz * (2.9 + L / 2), yaw = Math.atan2(nx, nz) + (rand() - 0.5) * 0.1;
            (isY ? yacht : gozzo)(x, z, yaw, 0, 0.2);
          }
        }
      }
    }
    const spots = (n, tries, x0, x1, z0, z1, sMin, sMax, fn) => { let k = 0; for (let t = 0; t < tries && k < n; t++) { const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0), s = boatShore(x, z); if (s >= sMin && s <= sMax && fn(x, z)) k++; } };
    spots(6, 400, 460, 900, -820, -340, 9, 60, (x, z) => (rand() < 0.65 ? gozzo : yacht)(x, z, rand() * 6.28, 0.25)); // at anchor in the basin
    spots(7, 400, 560, 1500, -900, 100, 60, 280, (x, z) => (rand() < 0.75 ? gozzo : yacht)(x, z, rand() * 6.28, 0.35));     // off the Foro Italico
    // ferries alongside the quays of the port
    const ferries = [];
    for (let cz = -1800; cz < -1100; cz += 8) for (let cx = 130; cx < 820; cx += 8) {
      const s0 = boatShore(cx, cz); if (s0 < 12.5 || s0 > 22) continue;
      for (let a = 0; a < 18; a++) {
        const yaw = a / 18 * Math.PI, r = { x: cx, z: cz, yaw, L: 136, B: 25 }, f = [Math.sin(yaw), Math.cos(yaw)], s = [f[1], -f[0]];
        let ok = true, touch = 0;
        for (let i = -5; i <= 5 && ok; i++) {
          for (const j of [-0.5, 0, 0.5]) if (boatShore(cx + f[0] * i * 13 + s[0] * j * 25, cz + f[1] * i * 13 + s[1] * j * 25) < 2.5) { ok = false; break; }
          if (ok) for (const sg of [-1, 1]) if (boatShore(cx + f[0] * i * 13 + s[0] * sg * 16, cz + f[1] * i * 13 + s[1] * sg * 16) < 5) touch++;
        }
        if (ok && touch >= 7) ferries.push({ ...r, touch, rank: touch + rand() * 3 });
      }
    }
    ferries.sort((a, b) => b.rank - a.rank);
    const FC = [['#2f5fae', '#e8c020'], ['#f1f2f0', '#c0392b'], ['#3a6bb8', '#f1f2f0']];
    let nf = 0;
    for (const fr of ferries) {
      if (nf >= 2) break;
      if (!free(fr, 12)) continue;
      const c = FC[nf % FC.length]; add('ferry', fr.x, fr.z, fr.yaw + (nf ? Math.PI : 0), 1, 136, 25, { c1: C(c[0]), c2: C(c[1]) }); nf++;
    }
    // buoys: channel marks and moorings
    const BC = ['#d93a2c', '#f2b522', '#2f9e55', '#f1eee6'];
    spots(6, 300, 460, 900, -820, -340, 6, 40, (x, z) => { if (!free({ x, z, yaw: 0, L: 1, B: 1 }, 6)) return false; add('buoy', x, z, 0, 1, 1, 1, { c1: C(BC[Math.floor(rand() * 4)]), c2: C('#fff') }); return true; });
    spots(8, 400, 500, 1500, -900, 100, 25, 220, (x, z) => { if (!free({ x, z, yaw: 0, L: 1, B: 1 }, 8)) return false; add('buoy', x, z, 0, 1, 1, 1, { c1: C(BC[Math.floor(rand() * 4)]), c2: C('#fff') }); return true; });

    const geos = { gozzo: gozzoGeometry, yacht: yachtGeometry, ferry: ferryGeometry, buoy: buoyGeometry };
    for (const kind of Object.keys(list)) {
      const arr = list[kind]; if (!arr.length) continue;
      const g = geos[kind](arr.length), mesh = new THREE.InstancedMesh(g, boatMat, arr.length);
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      arr.forEach((b, i) => { b.c1.toArray(g.attributes.iCol1.array, i * 3); b.c2.toArray(g.attributes.iCol2.array, i * 3); });
      scene.add(mesh); fleets.push({ kind, arr, mesh });
    }
    boatsReady = true;
  }

  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function animateBoats(t) {
    for (const { kind, arr, mesh } of fleets) {
      const big = kind === 'ferry', amp = big ? 0.15 : kind === 'buoy' ? 1.6 : 1;
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i], w = t * b.f + b.phase;
        const heave = (Math.sin(w * 1.1) * 0.05 + Math.sin(w * 0.63 + 1.7) * 0.03) * amp;
        const pitch = Math.sin(w * 0.9 + 0.6) * 0.018 * amp, roll = Math.sin(w * 0.75) * 0.03 * amp;
        const yaw = b.yaw + (b.swing ? Math.sin(t * 0.07 * b.f + b.phase) * b.swing : 0);
        _e.set(pitch, yaw, roll); _q.setFromEuler(_e);
        _p.set(b.x, SEA_Y + heave + (kind === 'buoy' ? 0.2 : 0.05), b.z); _s.setScalar(b.scale);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // -- particles: spray after the water (renderOrder 5), bubbles before it so the clear water shows them
  const PT_VERT = 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uScale; varying float vA; varying vec3 vC;\n' +
    'void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / max(0.3, -mv.z), 0.0, 160.0); gl_Position = projectionMatrix * mv; }';
  const PT_FRAG = 'varying float vA; varying vec3 vC;\nvoid main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.5, 1.0, r)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }';
  function makePoints(N, order) {
    const pos = new Float32Array(N * 3).fill(-9999), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 } }, vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, depthWrite: false });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = order; scene.add(pts);
    const st = Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 1, a0: 1, g: 0, drag: 0, rise: false }));
    return { pts, mat, pos, size, alpha, col, st, N, i: 0, g };
  }
  const spray = makePoints(260, 5), bubbles = makePoints(120, -20);
  function emit(sys, o) {
    const p = sys.st[sys.i]; sys.i = (sys.i + 1) % sys.N;
    Object.assign(p, { on: true, age: 0, g: 0, drag: 0, rise: false }, o);
    sys.col.set([o.r ?? 1, o.gc ?? 1, o.b ?? 1], (sys.i + sys.N - 1) % sys.N * 3);
  }
  function stepPoints(sys, dt) {
    for (let i = 0; i < sys.N; i++) {
      const p = sys.st[i];
      if (!p.on) { sys.alpha[i] = 0; continue; }
      p.age += dt; const u = p.age / p.life;
      if (u >= 1) { p.on = false; sys.alpha[i] = 0; sys.pos[i * 3 + 1] = -9999; continue; }
      p.vy -= p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vz *= k; if (p.drag) p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.rise && p.y > SEA_Y - 0.02) { p.on = false; sys.alpha[i] = 0; sys.pos[i * 3 + 1] = -9999; emit(spray, { x: p.x, y: SEA_Y + 0.03, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.7, s0: 0.25, s1: 0.7, a0: 0.55 }); continue; }
      sys.pos[i * 3] = p.x; sys.pos[i * 3 + 1] = p.y; sys.pos[i * 3 + 2] = p.z;
      sys.size[i] = p.s0 + (p.s1 - p.s0) * u; sys.alpha[i] = p.a0 * (1 - u * u);
    }
    for (const a of ['position', 'aSize', 'aAlpha', 'aCol']) sys.g.attributes[a].needsUpdate = true;
  }

  // ring and foam patch on the surface
  const RING_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const RING_FRAG = 'uniform float uP; uniform float uA; varying vec2 vUv;\n' +
    'void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0, ang = atan(c.y, c.x);\n' +
    ' float wob = 0.035 * sin(ang * 7.0 + uP * 3.0) + 0.025 * sin(ang * 13.0 - uP * 5.0);\n' +
    ' float R = 0.08 + 0.92 * uP;\n' +
    ' float ring = 1.0 - smoothstep(0.0, 0.10, abs(r - R + wob));\n' +
    ' float patch = (1.0 - smoothstep(0.0, R * 0.9 + wob, r)) * (0.55 - 0.35 * uP);\n' +
    ' float a = (ring * 0.85 + patch) * uA * (1.0 - uP * 0.5) * (1.0 - smoothstep(0.9, 1.0, r));\n' +
    ' if (a < 0.01) discard; gl_FragColor = vec4(0.93, 0.97, 1.0, a); }';
  const rings = [0, 1].map(() => {
    const mat = new THREE.ShaderMaterial({ uniforms: { uP: { value: 1 }, uA: { value: 0 } }, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    m.visible = false; m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m;
  });

  // -- drowning
  const S = { on: false, t: 0, x: 0, z: 0, vx: 0, vz: 0, root: null, game: null, car: null, placeAt: null, shown: false, readyAt: 0, line: 0, bubbleAcc: 0 };
  const overlay = buildOverlay();

  function findRoot(car) { // the lapa's root group: a top-level group (lean > tilt, wheels) standing on the car
    let best = null, bd = 9;
    for (const o of scene.children) {
      if (!o.isGroup || !o.children.length || !o.children[0].isGroup || o.children[0].children.length < 2) continue;
      const d = Math.hypot(o.position.x - car.x, o.position.z - car.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function splash(x, z, speed) {
    const n = 55 + Math.min(70, speed * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, h = 0.6 + Math.random() * (1.5 + speed * 0.08), up = 2.5 + Math.random() * (5 + speed * 0.15);
      emit(spray, { x: x + Math.cos(a) * 0.4, y: SEA_Y + 0.1, z: z + Math.sin(a) * 0.4, vx: Math.cos(a) * h + S.vx * 0.12, vy: up, vz: Math.sin(a) * h + S.vz * 0.12,
        life: 0.9 + Math.random() * 0.8, s0: 0.14 + Math.random() * 0.14, s1: 0.1, a0: 0.9, g: 9.8, r: 0.92, gc: 0.97, b: 1 });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.283, h = 0.3 + Math.random() * 1.6;
      emit(spray, { x: x + Math.cos(a) * 0.8, y: SEA_Y + 0.3, z: z + Math.sin(a) * 0.8, vx: Math.cos(a) * h, vy: 1.4 + Math.random() * 2.6, vz: Math.sin(a) * h,
        life: 1.2 + Math.random() * 0.9, s0: 0.9, s1: 3.2 + Math.random() * 1.6, a0: 0.5, g: 1.2, drag: 0.8, r: 0.96, gc: 0.98, b: 1 });
    }
    rings.forEach((m, i) => { m.position.set(x, SEA_Y + 0.04, z); m.scale.setScalar(i ? 22 : 16); m.visible = true; });
    splashSound(speed);
  }
  let ac = null;
  function splashSound(speed) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); if (ac.state === 'suspended') ac.resume();
      const vol = (S.game && S.game.settings && S.game.settings.volume != null ? S.game.settings.volume : 0.8) * clamp(0.5 + speed / 25, 0.5, 1);
      const len = ac.sampleRate * 1.6, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / ac.sampleRate; lp += (Math.random() * 2 - 1 - lp) * (0.35 - 0.3 * Math.min(1, t * 1.5)); ch[i] = lp * Math.exp(-t * 3.2) * (t < 0.01 ? t / 0.01 : 1); }
      const src = ac.createBufferSource(), gain = ac.createGain(); src.buffer = buf; gain.gain.value = 1.6 * vol; src.connect(gain).connect(ac.destination); src.start();
    } catch (e) { /* no audio: fine */ }
  }

  function startDrown(a) {
    const { car, game, placeAt, shout } = a;
    S.on = true; S.t = 0; S.game = game; S.car = car; S.placeAt = placeAt;
    S.x = car.x; S.z = car.z; S.vx = car.vx || 0; S.vz = car.vz || 0; S.bubbleAcc = 0; S.shown = false;
    S.line = Math.floor(Math.random() * LINES.length);
    game.state = 'over';
    S.root = findRoot(car); if (S.root) S.root.rotation.order = 'YXZ';
    const sp = Math.hypot(S.vx, S.vz);
    splash(car.x + Math.sin(car.th) * 0.6, car.z + Math.cos(car.th) * 0.6, sp);
    try { shout && shout(car.x, SEA_Y + 2.6, car.z, SHOUTS[Math.floor(Math.random() * SHOUTS.length)]); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('pd-drowned', { detail: { x: car.x, z: car.z, speed: sp } }));
  }

  function resetLapa() {
    const car = S.car; if (!car) return;
    car.lift = 0; car.hop = 0; car.pitch = 0; car.roll = 0; car.tip = 0;
    if (S.root) { S.root.rotation.x = 0; S.root.rotation.z = 0; S.root.rotation.order = 'XYZ'; S.root.visible = true; }
    S.root = null;
  }
  function endDrown() {
    S.on = false; resetLapa();
    uniforms.uClear.value.w = 0;
    rings.forEach(m => { m.visible = false; });
    for (const p of spray.st) p.on = false; for (const p of bubbles.st) p.on = false;
    overlay.hide();
  }

  function stepDrown(dt) {
    const car = S.car, t = (S.t += dt);
    // forward momentum dies in the water
    const k = Math.exp(-2.3 * dt); S.vx *= k; S.vz *= k; car.x += S.vx * dt; car.z += S.vz * dt;
    car.vx = S.vx; car.vz = S.vz; car.vf = Math.hypot(S.vx, S.vz); car.steer = 0;
    // float for a moment, nose down, then go under
    const s = clamp((t - 0.45) / 2.3, 0, 1), sink = 3.8 * s * s * (3 - 2 * s);
    const bob = Math.sin(t * 5.5) * 0.06 * Math.exp(-t * 0.8);
    car.hop = 0; car.lift = SEA_Y + 0.1 + bob - sink - groundY(car.x, car.z);
    const pitch = 0.62 * (1 - Math.exp(-t * 1.6)), roll = 0.45 * (1 - Math.exp(-t * 1.1));
    if (S.root) { S.root.rotation.x = pitch; S.root.rotation.z = roll; if (s >= 1) S.root.visible = false; } else { car.pitch = pitch; car.roll = roll; }
    // bubbles from the sinking wreck
    if (t > 0.3 && t < 3.4) {
      S.bubbleAcc += dt * 55;
      while (S.bubbleAcc >= 1) {
        S.bubbleAcc -= 1;
        emit(bubbles, { x: car.x + (Math.random() - 0.5) * 1.8, y: SEA_Y - 0.5 - sink * 0.6 - Math.random() * 0.6, z: car.z + (Math.random() - 0.5) * 1.8,
          vx: (Math.random() - 0.5) * 0.3, vy: 0.9 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.3, life: 3, s0: 0.14 + Math.random() * 0.16, s1: 0.2, a0: 0.85, rise: true, r: 0.85, gc: 0.97, b: 1 });
      }
    }
    uniforms.uClear.value.set(car.x, car.z, 16, smooth(0, 0.5, t));
    rings[0].material.uniforms.uP.value = clamp(t / 2.4, 0, 1); rings[0].material.uniforms.uA.value = 1;
    rings[1].material.uniforms.uP.value = clamp((t - 0.45) / 3.4, 0, 1); rings[1].material.uniforms.uA.value = t > 0.45 ? 0.8 : 0;
    if (!S.shown && t > 2.0) { S.shown = true; overlay.show(LINES[S.line]); S.readyAt = performance.now() + 700; }
  }

  // -- the overlay and its inputs
  function retry() {
    if (!S.on || performance.now() < S.readyAt) return;
    const { car, game, placeAt } = S, x = S.x, z = S.z;
    endDrown();
    placeAt(x, z);
    car.vx = car.vz = car.vf = 0;
    game.state = 'play';
  }
  function menu() {
    if (!S.on || performance.now() < S.readyAt) return;
    const ev = new CustomEvent('pd-quit-to-title', { cancelable: true, detail: { reason: 'drowned' } });
    let handled = !window.dispatchEvent(ev);
    if (!handled) {
      const sh = window.pdShell || window.pdUI || window.shell;
      if (sh && typeof sh.quit === 'function') { try { sh.quit(); handled = true; } catch (e) { /* fall through */ } }
    }
    overlay.busy();
    if (!handled) setTimeout(() => { if (S.on && S.game.state === 'over') location.reload(); }, 450); // nobody caught the event: restart the page, which lands on the title
  }
  overlay.onRetry = retry; overlay.onMenu = menu;
  addEventListener('keydown', e => { // registered before the shell's, so it sees the keys first
    if (!S.on || !S.shown) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { const f = document.activeElement; if (e.code !== 'Enter' && f && f.dataset && f.dataset.sea === 'menu') menu(); else retry(); } }
    else if (e.code === 'Escape' || e.code === 'KeyM') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) menu(); }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Tab') { e.stopImmediatePropagation(); if (e.code !== 'Tab') { e.preventDefault(); overlay.toggleFocus(); } }
  }, true);
  let padPrev = [false, false];
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = [...pads].find(g => g && g.connected); if (!gp) return;
    const a = !!(gp.buttons[0] && gp.buttons[0].pressed), b = !!(gp.buttons[1] && gp.buttons[1].pressed);
    if (a && !padPrev[0]) retry(); if (b && !padPrev[1]) menu();
    padPrev = [a, b];
  }

  // -- per-frame
  const _sz = new THREE.Vector2();
  let time = 0;
  function update(dt, camera = cam0) {
    time += dt;
    fieldsUpdate(camera);
    uniforms.uTime.value = time;
    water.position.x = camera.position.x; water.position.z = camera.position.z;
    if (boatsReady) animateBoats(time);
    renderer.getDrawingBufferSize(_sz);
    const sc = _sz.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    spray.mat.uniforms.uScale.value = sc; bubbles.mat.uniforms.uScale.value = sc;
    stepPoints(spray, dt); stepPoints(bubbles, dt);
    if (S.on) {
      if (S.game.state !== 'over') endDrown(); // somebody else (the shell) took the game out of 'over'
      else { stepDrown(dt); if (S.shown) pollPad(); }
    }
  }
  function checkPlayer(a) {
    if (S.on || !a || !a.car || !a.game || a.game.state !== 'play') return;
    if (isWater(a.car.x, a.car.z)) startDrown(a);
  }

  stats.initMs = performance.now() - T0;
  const api = { update, checkPlayer, isWater, shoreAt, stats: () => ({ ...stats, windowReady: !!front, coarseReady: ready }) };
  if (location.search.includes('debug')) window.__sea = api; // timings and field state for tests
  return api;
}

// ---------------------------------------------------------------------------------------------------------------
// Game over overlay (rosanero panels, same look as the shell's menus)
// ---------------------------------------------------------------------------------------------------------------
function buildOverlay() {
  const css = `
#sea-go { position: fixed; inset: 0; z-index: 800; display: flex; align-items: center; justify-content: center; pointer-events: none;
  padding: max(10px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
  background: radial-gradient(ellipse 85% 65% at 50% 45%, rgba(11,7,9,.25), rgba(11,7,9,.82)), linear-gradient(180deg, rgba(11,7,9,.15) 40%, rgba(90,25,60,.5) 85%, rgba(232,85,154,.3));
  opacity: 0; visibility: hidden; transition: opacity .7s ease, visibility 0s linear .7s; font-family: var(--pd-sans, 'Barlow', system-ui, sans-serif); color: #fff;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
#sea-go.on { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
#sea-go * { box-sizing: border-box; }
.sea-card { position: relative; width: min(92vw, 640px); max-height: 100%; overflow: hidden; padding: clamp(14px, 3.4vh, 30px) clamp(18px, 3.6vw, 38px) clamp(16px, 3.6vh, 32px); border-radius: 6px; text-align: center;
  background: linear-gradient(180deg, rgba(28,18,24,.92), rgba(11,7,10,.94)); box-shadow: inset 0 0 0 2px rgba(245,169,201,.4), 0 14px 50px rgba(8,2,20,.6);
  transform: translateY(14px) scale(.98); transition: transform .5s cubic-bezier(.2,.9,.3,1.2); }
#sea-go.on .sea-card { transform: none; }
.sea-card::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: linear-gradient(90deg, #f5a9c9, #f08ab8, #e8559a, #8a3a62); }
.sea-h { margin: 0; font: 400 clamp(44px, 14vh, 92px)/1 var(--pd-race, 'Racing Sans One', Impact, sans-serif); letter-spacing: .05em; text-transform: uppercase; color: #fff;
  text-shadow: 0 0 22px rgba(232,85,154,.85), 0 3px 0 rgba(10,6,9,.9); transform: rotate(-2deg); }
.sea-sub { margin: 2px 0 0; font: 600 clamp(12px, 2.6vh, 16px)/1 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .3em; text-transform: uppercase; color: #f5a9c9; }
.sea-it { margin: clamp(10px, 2.6vh, 22px) 0 0; font: 700 clamp(19px, 4.8vh, 31px)/1.2 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .02em; color: #fff; }
.sea-en { margin: 6px 0 0; font: 400 clamp(12px, 2.7vh, 16px)/1.3 var(--pd-sans, 'Barlow', sans-serif); font-style: italic; color: rgba(255,255,255,.7); }
.sea-btns { display: flex; gap: clamp(10px, 2.4vw, 18px); margin-top: clamp(14px, 3.6vh, 28px); }
.sea-btn { position: relative; flex: 1 1 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; min-height: clamp(52px, 12vh, 76px); padding: 0 clamp(14px, 3vh, 24px); margin: 0; border: 0; border-radius: 3px; cursor: pointer; text-align: left; color: #fff;
  font: 700 clamp(22px, 5.4vh, 36px)/1 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .07em; text-transform: uppercase; touch-action: manipulation; -webkit-appearance: none; appearance: none;
  background: linear-gradient(90deg, rgba(34,22,28,.9), rgba(14,9,12,.78)); box-shadow: inset 0 0 0 2px rgba(245,169,201,.38), 0 4px 14px rgba(8,2,20,.45);
  transform: skewX(-11deg); transition: transform .12s ease, background .12s ease, box-shadow .12s ease; }
.sea-btn::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 7px; background: linear-gradient(180deg, #f5a9c9, #e8559a); transition: width .12s ease; }
.sea-btn > * { display: block; transform: skewX(11deg); padding-left: 10px; }
.sea-btn small { font: 600 clamp(10px, 2.2vh, 14px)/1 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .2em; opacity: .75; }
.sea-btn.main { background: linear-gradient(90deg, #ff9a2e, #ff2d95); box-shadow: inset 0 0 0 2px rgba(255,255,255,.55), 0 0 28px rgba(232,85,154,.45); }
.sea-btn.main::before { background: #fff; }
.sea-btn:focus { outline: none; }
.sea-btn:focus-visible, .sea-btn.hot { background: linear-gradient(90deg, #f08ab8, #e8559a); box-shadow: inset 0 0 0 2px rgba(255,255,255,.85), 0 0 26px rgba(232,85,154,.6); transform: skewX(-11deg) translateX(4px); }
.sea-btn:active { transform: skewX(-11deg) scale(.98); }
@media (hover: hover) { .sea-btn:hover { background: linear-gradient(90deg, #f08ab8, #e8559a); box-shadow: inset 0 0 0 2px rgba(255,255,255,.7), 0 0 26px rgba(232,85,154,.55); } }
.sea-hint { margin: 10px 0 0; font: 600 11px/1 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.5); }
@media (pointer: coarse) { .sea-hint { display: none; } }
@media (max-width: 560px) { .sea-btns { flex-direction: column; } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sea-go'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Game over');
  root.innerHTML = `<div class="sea-card"><h2 class="sea-h">Tuffo!</h2><p class="sea-sub">Game over &middot; Splash</p>
    <p class="sea-it"></p><p class="sea-en"></p>
    <div class="sea-btns"><button type="button" class="sea-btn main" data-sea="retry"><span>Riprova</span><small>Retry</small></button>
    <button type="button" class="sea-btn" data-sea="menu"><span>Menu</span><small>Back to title</small></button></div>
    <p class="sea-hint">Invio riprova &middot; Esc menu</p></div>`;
  document.body.appendChild(root);
  const it = root.querySelector('.sea-it'), en = root.querySelector('.sea-en'), bRetry = root.querySelector('[data-sea=retry]'), bMenu = root.querySelector('[data-sea=menu]');
  const o = {
    onRetry() {}, onMenu() {},
    show(line) { it.textContent = line[0]; en.textContent = line[1]; root.classList.add('on'); bRetry.focus({ preventScroll: true }); bRetry.classList.add('hot'); bMenu.classList.remove('hot'); },
    hide() { root.classList.remove('on'); if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur(); },
    busy() { bRetry.disabled = bMenu.disabled = true; setTimeout(() => { bRetry.disabled = bMenu.disabled = false; }, 1500); },
    toggleFocus() { const f = document.activeElement === bMenu ? bRetry : bMenu; f.focus({ preventScroll: true }); bRetry.classList.toggle('hot', f === bRetry); bMenu.classList.toggle('hot', f === bMenu); },
  };
  root.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-sea]'); if (!b) return;
    if (b.dataset.sea === 'retry') o.onRetry(); else o.onMenu();
  });
  return o;
}
