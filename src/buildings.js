// Buildings: facade styles, ground floors, balconies, cornices, rooftops. Owned by the facades/buildings work.
//
// One 2D-array texture holds every facade/roof tile (painted procedurally below). Walls are emitted as
// a few tiled strips per wall (ground-floor runs, piano nobile, repeated upper floors), so the tile
// repeats with RepeatWrapping. Geometry is merged per 400 m chunk into one opaque mesh plus one
// alpha-tested mesh (balcony railings).
import { sliceOver } from './slice.js';
import * as THREE from 'three';
import { D, HAS_NEAR, groundY, proj, pairs, signedArea, rng, inPoly } from './core.js';
import SPECS from '../assets/facades/specs.js';
import { NIGHT } from './daynight.js'; // [day/night] shared uniform: share of lit windows (0 by day)
import { ZONES, zoneAt, floorsAt, applyDistrictHeights } from './districts.js';
import { PUB_ROUTES } from './pub-routes.js';
import { T, LAYERS, LID, GROUP_SPAN, GMAP, UPGRP, paintLayer, releaseLayerCanvases } from './atlas-layers.js';   // the painters of the wall atlas (they run in the work pool's workers too)
import { MIPS, newMips, mipLayer, flipInto } from './atlas-task.js';
import { workersDrawLikePage } from './probe.js';
import * as workPool from './work-pool.js';
const PUB_DOORS = Object.values(PUB_ROUTES).map(r => r.door);   // the pubs' hand-built fronts (src/pub-fronts.js) doors: see pubSign below

const RC = new THREE.Color(), ROOF_BASE_FLAT = new THREE.Color('#d3ccbf'), ROOF_BASE_TILE = new THREE.Color('#7d7f80');   // roof tints: the photo colour over the base colour of the roof texture
const GRPV = Array.from({ length: 32 }, () => new THREE.Vector2(0, 1));
GROUP_SPAN.forEach((s, i) => GRPV[i].set(s[0], s[1]));   // uGrp[index] = (first layer, count)
// Build the 2D-array texture once (a generator that yields per layer, so the world streamer can warm it up in slices).
// Its pixels (61 MB of JavaScript memory, 20 more for the mipmaps) are dropped once they are on the GPU; a lost GL context takes them with it (phones can do this in the background), so they are drawn again on restore. The layers are seeded: the same pixels come back.
//
// The mipmaps are made in src/atlas-task.js, layer by layer as each is painted, and handed to the GPU ready made: it is never asked to make them (gl.generateMipmap). On a Galaxy A13 5G (Mali-G57,
// Android 11, 32-bit Chrome) that one request, for this texture of 239 layers, crashed Chrome's GPU process inside the Mali driver a few seconds later on every load, and again on every
// rebuild after it: two freezes of ten seconds and a city that never came back whole. Found on real phones with one thing switched at a time (tools/devicefarm, docs/PERF.md "The recorder",
// 24 Nov 2026): not the size of the atlas, not the memory, not the geometry, not the shader, not the anisotropy. ?atlasmip=gpu is the old way, kept only to measure against.
const MIP_GPU = /[?&]atlasmip=gpu(&|$)/.test(location.search);   // the mipmaps are made in src/atlas-task.js (the same code in a worker and here)
// the whole atlas on the main thread, one layer a slice: the way when there is no worker (the pool is off or cannot start), the way it is drawn again after a lost GL context, and the contact sheet's (?atlas=1)
function* paintAtlas(data, mips, only) {   // only: the numbers of the layers to paint (the others are in data already), or all of them
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const sheet = /[?&]atlas=1/.test(location.search) ? document.createElement('canvas') : null; // debug contact sheet
  if (sheet) { sheet.width = 8 * 160; sheet.height = Math.ceil(LAYERS.length / 8) * 160; sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#7a8a9a'; document.body.appendChild(sheet); }
  for (let j = 0, n = only ? only.length : LAYERS.length; j < n; j++) {
    const i = only ? only[j] : j;
    paintLayer(g, i);
    if (sheet) sheet.getContext('2d').drawImage(cv, (i % 8) * 160, ((i / 8) | 0) * 160, 160, 160);
    flipInto(data, g.getImageData(0, 0, T, T).data, i);
    if (mips) mipLayer(data, mips, i);
    yield;
  }
  cv.width = cv.height = 0; releaseLayerCanvases();   // the painters' canvases: made again if a lost GL context paints the atlas again
}
// The same atlas painted by the work pool: slices of ATLAS_SLICE layers go to the idle workers and come back as finished pixels (and mip levels) to be copied into place; the main thread only waits (a slice a turn).
const ATLAS_SLICE = 8;
function* paintAtlasInPool(data, mips) {
  let left = 0, failed = null; const mine = [];
  for (let from = 0; from < LAYERS.length; from += ATLAS_SLICE) {
    left++;
    workPool.run('atlas', { from, to: Math.min(from + ATLAS_SLICE, LAYERS.length), mips: !!mips }).then(r => {
      data.set(r.data, r.from * T * T * 4); mine.push(...r.left);
      if (mips) mips.forEach((m, l) => m.data.set(r.mips[l], r.from * m.w * m.w * 4));
      left--;
    }, e => { failed = e; left--; });
  }
  while (left) yield;
  if (failed) return false;
  if (mine.length) yield* paintAtlas(data, mips, mine.sort((a, c) => a - c));   // the layers a worker's canvas would not draw like the page's: text and clipping
  releaseLayerCanvases();   // the old-town renders the slices kept (one set for every slice: drawn from a fresh one they differ in WebKit)
  return true;
}
function* buildAtlasIter() {
  const data = new Uint8Array(T * T * 4 * LAYERS.length); let mips = MIP_GPU ? null : newMips(LAYERS.length);
  let pooled = workPool.usesWorkers() && !/[?&]atlas=1/.test(location.search);
  if (pooled) { let asked = false; workersDrawLikePage().then(v => { pooled = v; asked = true; }); while (!asked) yield; }   // do the workers' canvases draw what the page's draws? (src/probe.js)
  if (!(pooled && (yield* paintAtlasInPool(data, mips)))) yield* paintAtlas(data, mips);   // a slice that failed in a worker: all of it again here
  const tex = new THREE.DataArrayTexture(data, T, T, LAYERS.length);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = MIP_GPU; tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  if (!MIP_GPU) tex.mipmaps = Array.from({ length: MIPS + 1 }, () => ({}));   // three makes room for that many levels and uploads only the first of a DataArrayTexture (r187): the rest go up in onUpdate
  tex.needsUpdate = true;
  tex.onUpdate = () => {
    if (mips) {   // three has just uploaded the first level and this texture is still the bound one
      const gl = document.getElementById('view')?.getContext('webgl2');
      if (gl) mips.forEach((m, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, i + 1, 0, 0, 0, m.w, m.w, LAYERS.length, gl.RGBA, gl.UNSIGNED_BYTE, m.data));
    }
    tex.image.data = null; mips = null;
  };
  document.getElementById('view')?.addEventListener('webglcontextrestored', () => { const d = new Uint8Array(T * T * 4 * LAYERS.length), m = MIP_GPU ? null : newMips(LAYERS.length); for (const _ of paintAtlas(d, m)); tex.image.data = d; mips = m; tex.needsUpdate = true; });
  return tex;
}

function atlasMaterial(tex, cutout) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, side: cutout ? THREE.DoubleSide : THREE.FrontSide, alphaTest: cutout ? 0.45 : 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTex = { value: tex };
    sh.uniforms.uWin = NIGHT.win; sh.uniforms.uGrp = { value: GRPV };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying float vLayer;\nvarying vec2 vTileUv;\nvarying vec3 vWp;\nvarying float vNy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = aLayer; vTileUv = uv; vNy = normal.y; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uTex;\nuniform float uWin;\nuniform vec2 uGrp[32];\nvarying float vLayer;\nvarying vec2 vTileUv;\nvarying vec3 vWp;\nvarying float vNy;\nfloat bH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', `
        float lay = floor(vLayer + 0.5);
        if (lay >= 200.0) { vec2 gp = uGrp[int(lay - 200.0)]; lay = gp.x + floor(bH(floor(vTileUv) * 1.37 + 7.3) * gp.y); }   // a layer group: one variant per bay and floor
        vec4 tc = texture(uTex, vec3(vTileUv, lay));
        float lum = dot(tc.rgb, vec3(0.3333));
        float vl = dot(vColor.rgb, vec3(0.3333)); // vColor is a vec4 since r180 (.rgb works on the old vec3 too)
        diffuseColor.rgb *= tc.rgb * mix(vec3(vl * 1.15), vColor.rgb, smoothstep(0.15, 0.32, lum));
        ${cutout ? 'diffuseColor.a *= tc.a;' : ''}
        ${cutout ? '' : `{ float q = vWp.x + vWp.z;   // weathering in the world, from the noise layer: repainted and damp patches (R), rain streaks (G); walls only
          float pn = texture(uTex, vec3(q * 0.025, vWp.y * 0.02, ${LID.wxnoise}.0)).r, dn = texture(uTex, vec3(q * 0.15, vWp.y * 0.01, ${LID.wxnoise}.0)).g;
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.94 + 0.2 * pn, 0.97 + 0.08 * pn, 1.08 - 0.22 * pn) * (1.0 - 0.18 * smoothstep(0.55, 0.85, dn)), 1.0 - abs(vNy)); }`}
        // [day/night] lit windows: the dark bluish glass texels glow warm, a random share of them (uWin, 0 by day) one bay at a time
        vec3 winGlow = vec3(0.0);
        ${cutout ? '' : `if (uWin > 0.002 && lum < 0.16 && tc.b > tc.g * 1.09 && tc.b > tc.r * 1.5) {
          vec3 cid = vec3(floor(vTileUv), lay + 37.0 * floor(vWp.x / 31.0) + 91.0 * floor(vWp.z / 29.0));
          float wh = fract(sin(dot(cid, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float tv = step(0.93, fract(wh * 7.31));
          winGlow = mix(vec3(1.0, 0.5, 0.16), vec3(0.42, 0.58, 1.0), tv) * smoothstep(wh, wh + 0.05, uWin) * (0.9 + 2.4 * lum);
        }`}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
  };
  m.customProgramCacheKey = () => 'bldg4' + (cutout ? 'c' : 'o');
  return m;
}

// Atlas and materials are built once and shared by every call (the centro and each streamed world tile).
let SHARED = null, SHARING = false;
function* sharedIter() {
  if (!SHARED) {
    if (SHARING) { while (!SHARED) yield; } // another generator (the world warm-up) is already building it
    else { SHARING = true; const atlas = yield* buildAtlasIter(); SHARED = { atlas, matMain: atlasMaterial(atlas, false), matRail: atlasMaterial(atlas, true) }; }
  }
  return SHARED;
}
export function* warmBuildings() { yield* sharedIter(); } // world.js: build the facade atlas ahead of the first tile

// =====================================================================================
// Geometry buffers
// =====================================================================================
class GB {
  constructor() {
    this.cap = 4096; this.n = 0; this.ni = 0;
    this.P = new Float32Array(this.cap * 3); this.N = new Float32Array(this.cap * 3); this.C = new Float32Array(this.cap * 3);
    this.U = new Float32Array(this.cap * 2); this.L = new Float32Array(this.cap); this.I = new Uint32Array(this.cap * 6);
  }
  grow() {
    const c = this.cap * 2, f = (a, k) => { const b = new (a.constructor)(c * k); b.set(a); return b; };
    this.P = f(this.P, 3); this.N = f(this.N, 3); this.C = f(this.C, 3); this.U = f(this.U, 2); this.L = f(this.L, 1); this.I = f(this.I, 6); this.cap = c;
  }
  v(p, nx, ny, nz, col, layerIdx) {
    if (this.n + 4 > this.cap) this.grow();
    const i = this.n++, k = p[5];
    this.P[i * 3] = p[0]; this.P[i * 3 + 1] = p[1]; this.P[i * 3 + 2] = p[2];
    this.N[i * 3] = nx; this.N[i * 3 + 1] = ny; this.N[i * 3 + 2] = nz;
    this.C[i * 3] = col.r * k; this.C[i * 3 + 1] = col.g * k; this.C[i * 3 + 2] = col.b * k;
    this.U[i * 2] = p[3]; this.U[i * 2 + 1] = p[4]; this.L[i] = layerIdx;
    return i;
  }
  // quad bl, br, tr, tl with outward normal n
  q(p0, p1, p2, p3, nx, ny, nz, layerIdx, col) {
    const ux = p2[0] - p0[0], uy = p2[1] - p0[1], uz = p2[2] - p0[2], vx = p1[0] - p0[0], vy = p1[1] - p0[1], vz = p1[2] - p0[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx), d = this.v(p3, nx, ny, nz, col, layerIdx);
    const I = this.I; let j = this.ni;
    if (gx * nx + gy * ny + gz * nz >= 0) { I[j++] = a; I[j++] = c; I[j++] = b; I[j++] = a; I[j++] = d; I[j++] = c; }
    else { I[j++] = a; I[j++] = b; I[j++] = c; I[j++] = a; I[j++] = c; I[j++] = d; }
    this.ni = j;
  }
  t(p0, p1, p2, nx, ny, nz, layerIdx, col) {   // one triangle facing (nx, ny, nz)
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx), I = this.I;
    if ((uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz >= 0) { I[this.ni++] = a; I[this.ni++] = b; I[this.ni++] = c; } else { I[this.ni++] = a; I[this.ni++] = c; I[this.ni++] = b; }
  }
  // triangle facing upwards
  tDown(p0, p1, p2, layerIdx, col) {   // like tUp, facing down (the underside of an archway volume)
    let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
    let ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
    let nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ny > 0) { [p1, p2] = [p2, p1]; nx = -nx; ny = -ny; nz = -nz; }
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx);
    this.I[this.ni++] = a; this.I[this.ni++] = b; this.I[this.ni++] = c;
  }
  tUp(p0, p1, p2, layerIdx, col) {
    let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
    let ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
    let nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ny < 0) { [p1, p2] = [p2, p1]; nx = -nx; ny = -ny; nz = -nz; }
    const a = this.v(p0, nx, ny, nz, col, layerIdx), b = this.v(p1, nx, ny, nz, col, layerIdx), c = this.v(p2, nx, ny, nz, col, layerIdx);
    this.I[this.ni++] = a; this.I[this.ni++] = b; this.I[this.ni++] = c;
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry(), n = this.n;
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.slice(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.slice(0, n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.U.slice(0, n * 2), 2));
    g.setAttribute('aLayer', new THREE.BufferAttribute(this.L.slice(0, n), 1));
    g.setIndex(new THREE.BufferAttribute(n <= 65536 ? new Uint16Array(this.I.subarray(0, this.ni)) : this.I.slice(0, this.ni), 1));
    return new THREE.Mesh(g, mat);
  }
}

// =====================================================================================
// Styles
// =====================================================================================
const C = c => new THREE.Color(c);
const CANOPY_GLASS = C('#8aa1ac');   // the glass of an entrance canopy (ocanopy)
const PAL = {
  bar: ['#c2a878', '#b9a185', '#c9b087', '#bfa27a', '#cdb892', '#b49a72', '#d0b88c', '#c9a58a', '#d4b894'].map(C),
  n19: ['#d9cab7', '#c9a293', '#d8c48a', '#c4b09a', '#dcc9a6', '#cfa88d', '#e0d2b8', '#c7a373', '#af9c8d', '#d8b0a0', '#e3d28f', '#e9e2d2', '#d99a78', '#bba898'].map(C),
  res: ['#c7a373', '#d8c48a', '#cf9a6b', '#e2d8c4', '#b8aea0', '#c98f78', '#d6b58a', '#bfae8e', '#dcc7a0', '#9fb0a6', '#d99a78', '#e3d28f', '#cdb8a0', '#c4a6a0', '#e8e0cc', '#a9b6a2'].map(C),
  pw: ['#e0dcd2', '#e4dccc', '#dcd8cc', '#e0d4b4', '#dccb8c', '#e2d6a0', '#d0a08c', '#d8b09c', '#c98a6a', '#d6cfc0', '#cfcabe', '#e6e0d4', '#d9c9a8', '#c8c2b4'].map(C),   // 1950s to 80s render: white, cream, pale yellow, salmon, a little terracotta, grey
  church: ['#c9b78c', '#bfae84', '#d2c6a6', '#b8a577', '#c8bda6', '#b09062', '#d6cdb4', '#a6875b'].map(C),
};
const STYLES = {
  bar: { pal: 'bar', bay: 4.2, g0: 4.9, fh: 4.4, parapet: 0.9, corn: 0.6, nobile: true, up: ['bar_up_g', 'bar_up_b'], nob: ['bar_nob_tri', 'bar_nob_seg'], rail: 'rail_b', balcUpper: 0.2, pitch: 0.12,
    ground: [['g_arch', 3], ['g_shop_s', 3], ['g_shop_o', 2], ['g_door', 2]] },
  n19: { pal: 'n19', bay: 3.8, g0: 4.4, fh: 3.9, parapet: 0.9, corn: 0.42, nobile: true, up: ['n19_up_g', 'n19_up_b', 'n19_up_t'], nob: ['n19_nob'], rail: 'rail_a', balcUpper: 0.4, pitch: 0.22,
    ground: [['g_shop_s', 4], ['g_shop_o', 3], ['g_arch', 1.4], ['g_door', 2]] },
  res: { pal: 'res', bay: 3.3, g0: 3.5, fh: 3.3, parapet: 0.8, corn: 0.2, nobile: false, up: ['res_a', 'res_b', 'res_c', 'res_d', 'res_e'], rail: 'rail_a', balcUpper: 0, pitch: 0.5,
    ground: [['g_door2', 2], ['g_shop_s', 1.8], ['g_garage', 1], ['g_win', 2.2], ['g_door', 1], ['g_shop_o', 1], ['blank_g', .8]] },
  // 1950s to 60s block: a flat in every bay, deep balconies in stacked columns (rhythm per wall), tapparelle in every state, glass shops or an open arcade on pilotis below
  pw: { pal: 'pw', bay: 3.5, g0: 4.2, fh: 3.1, parapet: 0.8, corn: 0.0, nobile: false, up: ['pww'], rail: 'rail_s', balc: 'pw', pitch: 0.0,
    pwf: { pat: [.06, .36, .22, .22, .14], depth: [1.15, 1.6], pilot: .45, brick: .06 },
    ground: [['pwg', 3], ['g_lobby', 1.6], ['g_pilot', .8], ['pw_shop', 1], ['g_garage', .8]] },
  church: { pal: 'church', rail: 'rail_a', bay: 5.0, g0: 5.2, fh: 6.4, parapet: 0.0, corn: 0.3, nobile: false, up: ['ch_mid'], church: true, pitch: 0.6,
    ground: [['ch_base', 6], ['ch_door', 1]] },
  low: { pal: 'res', bay: 4.0, g0: 99, fh: 3.3, parapet: 0.6, corn: 0.0, nobile: false, up: ['res_a'], rail: 'rail_a', balcUpper: 0, pitch: 0.4,
    ground: [['g_shop_s', 3], ['g_garage', 2], ['g_door2', 1.5], ['blank_g', 1]] },
  // ---- district styles (see docs/districts.md) ----
  // Liberty villino / palazzina: floral hoods, majolica frieze, whiplash ironwork, hipped tile roofs
  lib: { pal: 'res', bay: 4.0, g0: 4.3, fh: 3.8, parapet: 0.8, corn: 0.5, nobile: true, up: ['lib_up_a', 'lib_up_b'], nob: ['lib_nob'], rail: 'rail_l', balcUpper: 0.5, pitch: 0.45,
    ground: [['g_lib', 3], ['g_door', 1.5], ['g_win', 1.5], ['g_shop_s', 1]] },
  // 1960s-70s apartment block (sacco di Palermo): continuous balconies on every floor, tapparelle, drop awnings, shops or a lobby below
  blk: { pal: 'pw', bay: 3.4, g0: 4.2, fh: 3.1, parapet: 0.9, corn: 0.0, nobile: false, up: ['pww'], rail: 'rail_s', balc: 'pw', pitch: 0.0,
    pwf: { pat: [.06, .34, .22, .22, .16], depth: [1.0, 1.45], pilot: .22, brick: .05 },
    ground: [['pwg', 3], ['pw_shop', 2], ['g_lobby', 1.6], ['g_pilot', 1], ['g_garage', 1]] },
  // 1980s+ palazzina: one balcony per bay, glazed or solid parapets
  pal: { pal: 'pw', bay: 3.5, g0: 3.6, fh: 3.1, parapet: 0.9, corn: 0.15, nobile: false, up: ['pww'], rail: 'rail_c', balc: 'pw', pitch: 0.18,
    pwf: { pat: [.15, .55, .2, 0, .1], depth: [.85, 1.2], pilot: .04, brick: .03 },
    ground: [['g_garage', 1.6], ['g_door2', 1.6], ['g_lobby', 1.4], ['pwg', 1.4], ['g_win', 1]] },
  // public housing insulae (ZEN, CEP): prefab concrete, ribbon windows, exterior stairwell bays, pilotis and shuttered ground floors
  ins: { noShops: true, pal: 'pw', bay: 4.4, g0: 3.6, fh: 3.0, parapet: 0.6, corn: 0.0, nobile: false, up: ['zen_up'], alt: 'zen_stair', altP: 0.18, rail: 'rail_c', balc: 'none', pitch: 0.0,
    ground: [['g_pilot', 3], ['g_garage', 3], ['zen_g', 1.2], ['blank_g', .5]] },
  // fishermen's and summer houses: whitewash, painted wooden doors, pastel shutters
  fish: { noShops: true, pal: 'res', bay: 3.6, g0: 3.4, fh: 3.0, parapet: 0.55, corn: 0.0, nobile: false, up: ['fis_a', 'fis_win'], rail: 'rail_a', balc: 'none', pitch: 0.5,
    ground: [['fis_door', 3], ['fis_win', 3], ['g_garage', 1], ['blank_g', 1]] },
  // sheds and warehouses (port, Brin, Corso dei Mille yards): corrugated or prefab walls, roller doors, metal roofs
  ind: { pal: 'pw', bay: 6.0, g0: 99, fh: 4.5, parapet: 0.3, corn: 0.0, nobile: false, up: ['ind_a'], rail: 'rail_a', balc: 'none', pitch: 0.0, ind: true,
    ground: [['ind_a', 4], ['ind_b', 2], ['ind_roll', 1.5]] },
  silo: { pal: 'pw', bay: 4.0, g0: 99, fh: 4.0, parapet: 0.0, corn: 0.0, nobile: false, up: ['silo'], rail: 'rail_a', balc: 'none', pitch: 0.0, silo: true,
    ground: [['silo', 1]] },
  // bombed shell or rubble lot (Kalsa, Albergheria)
  ruin: { pal: 'res', bay: 3.6, g0: 99, fh: 3.0, parapet: 0.0, corn: 0.0, nobile: false, up: ['ruin_wall'], rail: 'rail_a', balc: 'none', pitch: 0.0, ruin: true,
    ground: [['ruin_wall', 1]] },
};
// The old town: which zones, the palette of its plaster (real albedo before the 1.3 of the build; terracotta, salmon, ochre, cream, grey), and its ground floors by kind of street.
const OLDZ = new Set(['corso', 'roma', 'old', 'centro', 'kalsa', 'alberg', 'politeama', 'stazione']);
const TPAL = new Map();   // the plaster palette of a town zone as colours, for the houses of a long street wall (oldHouses)
const OLD_PAL = ['#ae6a52', '#b87258', '#a46048', '#cb9a86', '#c48c7a', '#c9a064', '#d0aa70', '#bf9158', '#d6bf84', '#dcc896', '#d2b672', '#dcd1ba', '#d6cbb4', '#bcb09c', '#aea492', '#d0a99c', '#a2745a', '#b5b8a4', '#e4dfd2', '#c29c70', '#8f8474', '#9a8c7c'].map(C);
const PW_RAILS = [['rail_s', 2.2], ['rail_m', 2], ['rail_x', 2], ['rail_c', 1.6], ['rail_a', 1.6], ['rail_g', .8]];   // balcony rails of the post-war blocks
const OLD_GROUND = {
  market: [['og_shop', 3], ['g_mk_a', 2.4], ['g_mk_b', 1.6], ['g_mk_c', 1.3], ['g_bottega', 1.2], ['og_door', 1], ['g_portone', .4], ['g_bar', .4], ['og_low', .5]],
  main: [['og_shop', 2.6], ['og_door', 1.8], ['g_bar', 1.3], ['g_tabacchi', .7], ['g_farm', .5], ['g_pane', .5], ['g_portone', .8], ['pw_shop', 1], ['g_shop_o', .8], ['og_low', .8], ['g_shop_s', 1.4]],
  side: [['og_door', 3], ['og_shop', 2], ['og_low', 1.5], ['g_portone', 1], ['g_bar', .35], ['g_bottega', .6], ['g_shop_s', .8]],
  minor: [['og_door', 3.4], ['og_low', 2], ['og_shop', 1.2], ['g_portone', .6], ['g_bottega', .3]],
};
// Ground floors of the country towns (Villabate photos): the roller shutter is the commonest front, then a plain door, a shop with its shutter up or down, a bar, a bakery or a
// chemist now and then, a fruit and vegetable front on the main street. Same four kinds of street as OLD_GROUND.
const TOWN_GROUND = {
  market: [['g_mk_a', 3], ['g_mk_b', 2], ['g_mk_c', 1.6], ['g_bottega', 1.4], ['g_garage', 1.5], ['g_door2', 1]],
  main: [['g_garage', 2.4], ['g_shop_s', 2.2], ['g_shop_o', 1.3], ['pw_shop', 1.1], ['g_door2', 1.5], ['g_bar', 1.1], ['g_tabacchi', .5], ['g_farm', .5], ['g_pane', .5], ['g_bottega', .8], ['g_portone', .4], ['g_mk_a', .4]],
  side: [['g_garage', 3.2], ['g_door2', 2.4], ['og_door', 1], ['g_shop_s', 1.2], ['g_bottega', .5], ['g_bar', .25], ['g_pane', .2], ['og_low', .8]],
  minor: [['g_garage', 3.6], ['g_door2', 2.8], ['og_door', 1.2], ['og_low', 1.2], ['g_shop_s', .4]],
};
const REPEATABLE = new Set(['pwg', 'og_door', 'og_shop', 'og_low', 'g_shop_s', 'g_shop_o', 'g_win', 'pw_shop', 'g_garage', 'ch_low', 'ch_base', 'blank_g', 'ind_a', 'silo', 'ruin_wall', 'zen_g', 'bch_a', 'g_mk_a', 'g_mk_b', 'g_mk_c']);

// =====================================================================================
// Spatial lookups
// =====================================================================================
function* buildLookupsIter(data = D) {
  const BC = 30, bgrid = new Map(), binfo = [];
  for (let i = 0; i < data.buildings.length; i++) {
    const b = data.buildings[i], pts = pairs(b.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    binfo.push({ pts, x0, z0, x1, z1, b });
    for (let cx = Math.floor(x0 / BC); cx <= Math.floor(x1 / BC); cx++) for (let cz = Math.floor(z0 / BC); cz <= Math.floor(z1 / BC); cz++) {
      const k = cx * 100003 + cz; let l = bgrid.get(k); if (!l) bgrid.set(k, l = []); l.push(i);
    }
    if (sliceOver()) yield;
  }
  const inBuilding = (x, z, self) => {   // `self`: a split building (parts on a footprint) leaves out its own outline, which the walls of its inset parts lie inside of ([texround2] they all read as party walls)
    const l = bgrid.get(Math.floor(x / BC) * 100003 + Math.floor(z / BC)); if (!l) return false;
    for (const i of l) { const q = binfo[i]; if (q.b === self) continue; if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && inPoly(q.pts, x, z)) return true; }
    return false;
  };
  const RC = 24, rgrid = new Map();
  for (const r of data.roads) {
    if (r.k === 'pier' || r.k === 'cycleway' || r.k === 'path') continue;
    const p = r.p, hw = r.w / 2;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const s = { x1: p[i], z1: p[i + 1], x2: p[i + 2], z2: p[i + 3], hw, r };
      const x0 = Math.min(s.x1, s.x2) - hw - 6, x1 = Math.max(s.x1, s.x2) + hw + 6, z0 = Math.min(s.z1, s.z2) - hw - 6, z1 = Math.max(s.z1, s.z2) + hw + 6;
      for (let cx = Math.floor(x0 / RC); cx <= Math.floor(x1 / RC); cx++) for (let cz = Math.floor(z0 / RC); cz <= Math.floor(z1 / RC); cz++) {
        const k = cx * 100003 + cz; let l = rgrid.get(k); if (!l) rgrid.set(k, l = []); l.push(s);
      }
    }
    if (sliceOver()) yield;
  }
  // distance from the carriageway edge to the nearest street, and that street
  const roadNear = (x, z) => {
    const l = rgrid.get(Math.floor(x / RC) * 100003 + Math.floor(z / RC)); let best = 1e9, br = null;
    if (!l) return { d: best, r: br };
    for (const s of l) {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1, L2 = dx * dx + dz * dz;
      let t = L2 > 0 ? ((x - s.x1) * dx + (z - s.z1) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) - s.hw;
      if (d < best) { best = d; br = s.r; }
    }
    return { d: best, r: br };
  };
  // Buildings whose footprint lies inside another building of about the same height (duplicate OSM outlines): drawing both
  // gives coplanar walls and roofs that z-fight, so the smaller one is dropped.
  const dupIds = new Set();
  data.buildings.forEach((A, i) => {
    const q = binfo[i], ring = q.pts; let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
    const seen = new Set(), areaA = Math.abs(signedArea(ring)), hA = A.r !== undefined ? A.r : A.h;
    for (let gx = Math.floor(q.x0 / BC); gx <= Math.floor(q.x1 / BC); gx++) for (let gz = Math.floor(q.z0 / BC); gz <= Math.floor(q.z1 / BC); gz++) for (const j of bgrid.get(gx * 100003 + gz) || []) {
      if (j === i || seen.has(j)) continue; seen.add(j);
      const Bq = data.buildings[j], rb = binfo[j]; if (A.holes || Bq.holes && Bq.holes.length) continue;
      const hB = Bq.r !== undefined ? Bq.r : Bq.h; if (Math.abs(hA - hB) > 2) continue;
      const areaB = Math.abs(signedArea(rb.pts)); if (areaA > areaB || (areaA === areaB && i < j)) continue;
      if (!inPoly(rb.pts, cx, cz)) continue;
      let inside = 0; for (const p of ring) if (inPoly(rb.pts, cx + (p[0] - cx) * 0.9, cz + (p[1] - cz) * 0.9)) inside++;
      if (inside >= ring.length * 0.85) { dupIds.add(A.id); break; }
    }
  });
  return { inBuilding, roadNear, dupIds };
}

const BDBG = typeof location !== 'undefined' && /[?&]bdbg\b/.test(location.search); // ?bdbg: window.__bldDbg gets [id, x, z, zone, style, H, area, height source] per building (district checks)
const hh = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const pick = (list, r) => { let t = 0; for (const e of list) t += e[1]; t *= r(); for (const e of list) { t -= e[1]; if (t <= 0) return e[0]; } return list[0][0]; };
const MAIN_ST = /Maqueda|Vittorio Emanuele|^Via Roma|Cavour|Libert|Ruggero Settimo|Mazzini|Butera|Alloro|Garibaldi|Cassaro/;
const GRAND = /Palazzo|Villa|Teatro|Museo|Tribunale|Universit|Convento|Monastero|Collegio|Banco|Ospedale|Conservatorio|Liceo/;

// Neighbourhood palettes, zone seeds and storey tables live in src/districts.js (documented in docs/districts.md).
function zoneOf(cx, cz, near) { return zoneAt(cx, cz, near && near.r && near.r.n || '', near ? near.d : 1e9); }
// A building style is only offered where it exists in real life: Liberty villini are low, sacco blocks are tall, ZEN insulae are big.
const ELIG = {
  bar: f => f <= 6, n19: f => f <= 6, res: f => f <= 5, pw: f => f >= 4, blk: f => f >= 5, pal: f => f >= 3 && f <= 7,
  ins: (f, a, Z) => f >= 3 && a > (Z.insArea || 300), lib: (f, a) => f <= 4 && a < 900, fish: f => f <= 2, ind: (f, a, Z) => Z.shed ? a > 180 : a > 500,
};
const STYLE_KEYS = ['bar', 'n19', 'res', 'pw', 'lib', 'blk', 'pal', 'ins', 'fish', 'ind'];
// Era. A 19th c. palazzo stops at about five storeys of 4 to 4.5 m; the 1950s to 70s blocks that replaced the bombed ones and filled the gaps are taller. PWH: the height (m) from which a
// building in these old-prior zones is a post-war block (a ramp of 5 m starts 2 m below it); below it the zone gets no pw or blk, above it mostly pw. PWB: how the post-war styles share it.
const PWH = { corso: 29, old: 27, kalsa: 26, alberg: 26, roma: 24, centro: 22, politeama: 22, stazione: 23, calat: 24, borgoV: 22, oreto: 21, porto: 22 };
const PWB = { pw: .5, blk: .3, pal: .12 };
const OLDSTY = new Set(['bar', 'n19', 'res', 'lib', 'fish']);
function chooseStyle(b, H, area, zone, r, o = {}) {
  if (b.k === 'church' || b.t === 'church' || b.t === 'cathedral' || b.am === 'place_of_worship') return 'church';
  const Z = ZONES[zone] || ZONES.centro, name = b.n || '';
  const special = b.hi || GRAND.test(name) || ['university', 'government', 'civic', 'museum', 'hotel', 'monastery', 'castle', 'public'].includes(b.t) || b.am === 'courthouse' || b.am === 'college';
  if (area > 2500 && !special && (zone === 'mondello' || zone === 'valdesi' || zone === 'lido')) return H < 5.2 ? 'low' : 'res'; // one OSM outline for a whole block of houses and yards: plain houses, not a 130 m fishermen's row
  if (Z.elig && !special) {
    if (o.round && H > 5 && (Z.w.ind || Z.shed)) return 'silo';
    if (Z.ruin && o.u < Z.ruin && !b.n && b.r === undefined && area > 40 && area < 700 && H < 19) return 'ruin';
    if (Z.shed && area > 600 && o.u2 < 0.85) return 'ind';
  }
  if (H < 5.2) {
    if (Z.elig && !special) { const wf = Z.w.fish || 0; if (Z.shed && area > 250 && r() < 0.8) return 'ind'; if (r() < (wf ? Math.min(0.9, wf * 2.2 + 0.15) : 0.08)) return 'fish'; }
    return 'low';
  }
  if (special) return r() < 0.6 ? 'bar' : 'n19';
  const ZW = Z.w;
  if (Z.elig) {
    const f = o.fl || Math.max(1, Math.round((H - 1.7) / (Z.fh || 3.2)));
    const ks = [], ws = []; let tot = 0;
    const pe = PWH[zone] === undefined ? 0 : Math.min(1, Math.max(0, (H - PWH[zone] + 2) / 5)), mid = Z.mid ? Math.min(1, Math.max(0, (f - 2) / 2)) : 0;   // era ramp of old-prior zones; apartments from 3 to 4 storeys up in the modern belts
    for (const k of STYLE_KEYS) {
      let w0 = ZW[k] || 0;
      if (PWH[zone] !== undefined) { if (OLDSTY.has(k)) w0 *= 1 - 0.9 * pe; else if (PWB[k] !== undefined) w0 = (k === 'pal' ? w0 : w0 * pe) + PWB[k] * pe; }
      else if (mid) { if (OLDSTY.has(k)) w0 *= 1 - 0.7 * mid; else if (k === 'pal' || k === 'blk' || k === 'pw') w0 *= 1 + mid; }
      if (w0 <= 0 || (ELIG[k] && !ELIG[k](f, area, Z))) continue; const w1 = k === 'ind' && Z.shed && area > 600 ? w0 * 4 : w0; ks.push(k); ws.push(w1); tot += w1;
    }
    if (!tot) return f >= 5 ? 'blk' : 'res';
    let t = r() * tot; for (let i = 0; i < ks.length; i++) { t -= ws[i]; if (t <= 0) return ks[i]; }
    return ks[ks.length - 1];
  }
  let w = H >= 17 && zone !== 'corso' ? { ...ZW, pw: ZW.pw + .1, res: Math.max(0.05, ZW.res - .1) } : ZW;
  const u = r();
  if (OLDZ.has(zone)) w = { ...w, pw: w.pw * 0.5 };   // the old town is mostly 19th c. palazzi; the 1950s blocks are the exception
  const pe = PWH[zone] === undefined ? 0 : Math.min(1, Math.max(0, (H - PWH[zone] + 2) / 5));
  if (pe && area > 100 && o.u2 < pe) return u < .6 ? 'pw' : u < .88 ? 'blk' : 'pal';   // old-prior zone, tall enough: a post-war block
  let t = u * (w.bar + w.n19 + w.res + w.pw);
  for (const k of ['bar', 'n19', 'res', 'pw']) { t -= w[k]; if (t <= 0) { if (k !== 'pw' || !PWH[zone]) return k; const v = o.u2 * (w.bar + w.n19 + w.res); return v < w.bar ? 'bar' : v < w.bar + w.n19 ? 'n19' : 'res'; } }   // where a block would be drawn but the height says old: one of the old kinds
  return 'res';
}
const NAMED = { white: '#e6e3da', tan: '#c9ad82', beige: '#d6c9a8', yellow: '#dcc88a', red: '#b8705a', brown: '#9a7a5a', grey: '#b5b0a5', gray: '#b5b0a5', pink: '#d4a89a', orange: '#d49a6a' };
function osmColour(v) { if (!v) return null; const c = NAMED[String(v).toLowerCase()] || v; try { return new THREE.Color(c); } catch (e) { return null; } }

// =====================================================================================
// Build
// =====================================================================================
// buildBuildings(ctx, data = D) builds every building of `data` (the baked centro by default, or one world tile, which has the
// same field names) and returns a Group (added to ctx.scene for the centro call). buildBuildingsIter is the same as a
// generator that yields every few buildings so the world streamer (src/world.js) can spread a tile over several frames.
export function buildBuildings(ctx, data = D) {
  const group = new THREE.Group(), it = buildBuildingsIter(ctx, data, group);
  while (!it.next().done);
  return group;
}
export function* buildBuildingsIter(ctx, data = D, group = new THREE.Group()) {
  const tile = data !== D, scene = tile ? null : ctx.scene;
  if (scene) scene.add(group);
  const t0 = performance.now();
  const { matMain, matRail } = yield* sharedIter();
  if (tile) applyDistrictHeights(data); // district-typical storeys where the baked height is only the generic estimate (idempotent; world.js may call it on tile load)
  const { inBuilding, roadNear, dupIds } = yield* buildLookupsIter(data);
  const white = new THREE.Color(1, 1, 1);

  let chunks = new Map(); const CH = 250; // [perf pass] was 400 for the centro: smaller chunks cull better (view and shadow pass): -16% triangles at Quattro Canti for +5% draw calls
  const chunkOf = (x, z) => { const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); let c = chunks.get(k); if (!c) chunks.set(k, c = { m: new GB(), r: new GB() }); return c; };

  const stats = { styles: {}, balconies: 0, tanks: 0, tiled: 0, flat: 0 };

  // ---------- rooftop furniture ----------
  function boxAt(gb, cx, cz, w, d, ang, y0, y1, col, k, top = true) {
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2, L = LID.blank;
    const cn = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]);
    for (let i = 0; i < 4; i++) {
      const a = cn[i], b = cn[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = dz / l, nz = -dx / l;
      // ring is counter-clockwise in x/z so this normal points outward
      gb.q([a[0], y0, a[1], 0, 0, k * .85], [b[0], y0, b[1], l / 2, 0, k * .85], [b[0], y1, b[1], l / 2, (y1 - y0) / 2, k], [a[0], y1, a[1], 0, (y1 - y0) / 2, k], nx, 0, nz, L, col);
    }
    if (top) gb.q([cn[0][0], y1, cn[0][1], 0, 0, k], [cn[1][0], y1, cn[1][1], 1, 0, k], [cn[2][0], y1, cn[2][1], 1, 1, k], [cn[3][0], y1, cn[3][1], 0, 1, k], 0, 1, 0, L, col);
  }
  function cylAt(gb, cx, cz, rad, y0, y1, col, k, sides = 6) {   // [tri budget] 6 sides and a cap of sides - 2 triangles (was 8 and 8): 16 triangles instead of 32
    const L = LID.blank;
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * 6.2832, a1 = (i + 1) / sides * 6.2832, am = (a0 + a1) / 2;
      const x0 = cx + Math.cos(a0) * rad, z0 = cz + Math.sin(a0) * rad, x1 = cx + Math.cos(a1) * rad, z1 = cz + Math.sin(a1) * rad;
      gb.q([x0, y0, z0, 0, 0, k * .8], [x1, y0, z1, .5, 0, k * .8], [x1, y1, z1, .5, .5, k], [x0, y1, z0, 0, .5, k], Math.cos(am), 0, Math.sin(am), L, col);
      if (i >= 1 && i <= sides - 2) gb.tUp([cx + Math.cos(0) * rad, y1, cz + Math.sin(0) * rad, 1, .5, k], [x0, y1, z0, 0, 0, k], [x1, y1, z1, 1, 0, k], L, col);
    }
  }
  const tankCols = [C('#e8e8e0'), C('#e2e2da'), C('#58687a'), C('#2c2e30'), C('#7a8f7c'), C('#d9d4c4')];
  function roofProps(gb, outer, holes, y, area, r) {
    if (area < 40) return;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of outer) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const rings = [outer, ...holes];
    const clear = (x, z) => {
      let m = 1e9;
      for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        let t = L2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        m = Math.min(m, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
      }
      return m;
    };
    const spot = (cl) => {
      for (let i = 0; i < 14; i++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (!inPoly(outer, x, z)) continue;
        if (holes.some(h => inPoly(h, x, z))) continue;
        if (clear(x, z) >= cl) return [x, z];
      }
      return null;
    };
    const k = 0.9 + r() * 0.1;
    if (area > 70 && r() < 0.55) { // stair / lift box
      const s = spot(2.4); if (s) boxAt(gb, s[0], s[1], 2 + r() * 1.4, 2.2 + r() * 1.6, r() * 3.14, y, y + 2.3 + r() * 0.4, C('#d9d0bc').multiplyScalar(1.1), k);
    }
    const nt = r() < 0.65 ? 1 + (r() < 0.5) + (r() < 0.2) : 0;
    for (let i = 0; i < nt; i++) {
      const rad = 0.65 + r() * 0.35, s = spot(rad + 1.0); if (!s) continue;
      const col = tankCols[(r() * tankCols.length) | 0];
      boxAt(gb, s[0], s[1], rad * 1.5, rad * 1.5, 0, y, y + 0.35, C('#8a8a86'), 0.9, false); // stand (the tank hides its top)
      cylAt(gb, s[0], s[1], rad, y + 0.35, y + 0.35 + 1.1 + r() * 0.6, col, 1.0);
      stats.tanks++;
    }
    if (r() < 0.35) { // antenna mast
      const s = spot(1.0); if (s) { boxAt(gb, s[0], s[1], .08, .08, 0, y, y + 3.2 + r() * 1.5, C('#444'), 1, false); boxAt(gb, s[0], s[1], 1.1, .05, r() * 3, y + 3.0, y + 3.06, C('#444'), 1, false); }   // [tri budget] no tops on the thin parts
    }
  }

  // ---------- one solid (footprint extruded to a roof elevation) ----------
  function emitSolid(B, flat, holes, roofY, stack) {
    const S = B.S, r = B.r, ch = B.ch, gbuf = ch.m;
    const outerPts = pairs(flat);
    let lo = Infinity, hi = -Infinity;
    for (const p of outerPts) { const y = groundY(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (stack !== undefined) { lo = stack; hi = stack - 1.3; }
    roofY = Math.max(roofY, hi + 2.5);
    if (stack === undefined && ctx.onSolid) ctx.onSolid(flat, holes, roofY);   // the lean renderer: this solid stands on the ground, walls up to roofY: it hides what is behind it (src/engine-lean.js)
    let area = signedArea(outerPts); if (area < 0) outerPts.reverse(); area = Math.abs(area);

    // convex small footprints may get a hipped tile roof
    let pitched = false, rise = 0, ax = 1, az = 0, ridge = null;
    const nHole = (holes || []).length;
    if (S.pitch > 0 && !nHole && area < 520 && outerPts.length <= 14) {
      let convex = true;
      for (let i = 0; i < outerPts.length; i++) {
        const p = outerPts[i], q = outerPts[(i + 1) % outerPts.length], s = outerPts[(i + 2) % outerPts.length];
        if ((q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0]) < -0.02) { convex = false; break; }
      }
      const H0 = roofY - lo, prob = H0 < 9 ? 0.7 : H0 < 15 ? 0.38 : 0.2;
      if (convex && r() < Math.min(0.95, prob * (S.church ? 1.2 : 1) * (B.pitchMul ?? 1))) pitched = true;
    }
    if (pitched) {
      let bl = 0;
      for (let i = 0; i < outerPts.length; i++) { const p = outerPts[i], q = outerPts[(i + 1) % outerPts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; ax = (q[0] - p[0]) / l; az = (q[1] - p[1]) / l; } }
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of outerPts) { const u = p[0] * ax + p[1] * az, v = -p[0] * az + p[1] * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const hw = (v1 - v0) / 2; rise = Math.min(hw * 0.42, 3.2);
      if (rise < 0.9) pitched = false;
      else { const mid = (u0 + u1) / 2, half = Math.max(0, (u1 - u0) / 2 - hw); ridge = { ua: mid - half, ub: mid + half, vm: (v0 + v1) / 2 }; }
    }
    if (pitched) stats.tiled++; else stats.flat++;
    const parH = pitched ? 0 : S.parapet;
    const yTop = roofY - (pitched ? (B.eave ? 0 : rise) : parH); // baked roof = ridge (lidar); survey heights (e) are eaves, the ridge stands on top
    const sp = B.spec || NOSPEC;
    const F = stack !== undefined ? { g0: 0.3, nUp: Math.max(1, Math.round((yTop - lo - 0.3) / S.fh)) } : calcFloors(S, yTop - lo, B.lv, sp);
    let yg = lo + F.g0;
    if (yg < hi + 1.6 && F.nUp > 0) yg = Math.min(hi + 1.6, yTop - 1);
    const nUp = F.nUp, fh = nUp ? (yTop - yg) / nUp : 0;
    const hasNob = (S.nobile || sp.nobH) && nUp > 0;
    const fh1 = hasNob ? Math.min(sp.nobH || fh, yTop - yg) : fh, fhU = nUp > 1 && hasNob ? (yTop - yg - fh1) / (nUp - 1) : fh;
    const floorBase = f => yg + (f === 1 ? 0 : (hasNob ? fh1 + (f - 2) * fhU : (f - 1) * fh));
    // footprint edge lookup for per-wall specs (matches collinear edges of the building's own outline)
    const bpEdge = (ax, az, bx, bz) => {
      const P = B.bp; if (!P) return null;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz; if (l2 < 1e-6) continue;
        const l = Math.sqrt(l2), t = (x, z) => ((x - p[0]) * dx + (z - p[1]) * dz) / l2, off = (x, z) => Math.abs((x - p[0]) * dz - (z - p[1]) * dx) / l;
        const tol = B.spec && B.spec.wtol || 0.45;   // wtol: the walls of a split building's parts stand inside its outline, a villa's front a few metres behind the portico
        if (off(ax, az) > tol || off(bx, bz) > tol) continue;
        const ta = t(ax, az), tb = t(bx, bz); if (ta < -0.03 || ta > 1.03 || tb < -0.03 || tb > 1.03) continue;
        return { i, ta, tb };
      }
      return null;
    };

    const rings = [{ pts: outerPts, hole: false }];
    for (const h of holes || []) { const pts = pairs(h); if (signedArea(pts) > 0) pts.reverse(); rings.push({ pts, hole: true }); }

    function edge(E) {
      const { ax, az, bx, bz, dx, dz, ux, uz, nx, nz, len, kind } = E;
      let col = B.col, stoneC = B.stone, slabC = B.slab, hs = null, nb = 0, bts = null; const L = LID;
      const bt = i => bts ? bts[i] : i / nb;   // where bay i starts along the wall, as a share of its length   // col, stoneC, slabC: the house being emitted (an old-town front is several houses, below)
      const kc = t => (t === 0 && E.reflexA) || (t === 1 && E.reflexB) ? 0.86 : 1;
      const uo = B.uo + (Math.abs(Math.floor(ax * 3 + az * 7)) % 37);   // every wall starts at another bay of the layer groups
      let grec = 0;   // pilotis: how far the ground-floor wall stands back from the facade line (set around the ground runs)
      const strip = (t0, t1, yb0, yb1, yt0, yt1, v0, v1, lay, k0, k1, u0, u1) => {
        const so = (stack !== undefined ? 0.03 : 0) - grec; // stacked volumes sit 3 cm proud of the base mass parapet below them
        const x0 = ax + dx * t0 + nx * so, z0 = az + dz * t0 + nz * so, x1 = ax + dx * t1 + nx * so, z1 = az + dz * t1 + nz * so;
        const c0 = kc(t0), c1 = kc(t1), j0 = 0.95 + 0.1 * hh(x0, z0), j1 = 0.95 + 0.1 * hh(x1, z1);
        gbuf.q([x0, yb0, z0, u0 + uo, v0, k0 * c0 * j0], [x1, yb1, z1, u1 + uo, v0, k0 * c1 * j1], [x1, yt1, z1, u1 + uo, v1, k1 * c1 * j1], [x0, yt0, z0, u0 + uo, v1, k1 * c0 * j0], nx, 0, nz, lay, col);
      };
      const foot0 = E.ga - 0.3, foot1 = E.gb - 0.3;
      let W = sp, bm = null;
      if (B.spec && B.spec.walls) {
        bm = bpEdge(ax, az, bx, bz);
        if (bm) { const w = B.spec.walls[bm.i]; if (w) W = { ...sp, ...w }; }
      }
      if ((kind === 'party' && !S.silo || len < 2.6 && !S.silo) && S.church && yTop - Math.min(foot0, foot1) > 12) {   // a church wall nobody fronts: pilastered nave wall with the cornice and the clerestory window at the top (it is what shows over the roofs round it)
        const yc = yTop - 6.4, lo = Math.min(foot0, foot1);
        strip(0, 1, foot0, foot1, yc, yc, 0, (yc - lo) / 6.4, L.ch_mid, 0.72, 0.97, 0, len / 5);
        strip(0, 1, yc, yc, yTop, yTop, 0, 1, L.ch_top, 0.97, 0.93, 0, len / 5);
      } else if (kind === 'party' && !S.silo || len < 2.6 && !S.silo) {
        strip(0, 1, foot0, foot1, yTop, yTop, 0, (yTop - Math.min(foot0, foot1)) / 4, B.stoneWall ? (B.old ? L.ost_wall : S.church ? L.ch_mid : L.ch_low) : B.old ? L.old_wall : L.blank_v, 0.72, 0.97, 0, len / 4);
      } else {
        nb = W.bays ? Math.max(1, W.bays | 0) : Math.max(1, Math.round(len / ((W.bay || S.bay) * (B.bayK || 1))));
        const bw = len / nb;
        // Old-town street fronts are cut into houses. One OSM outline is often a whole block front (Via Cavour: 73 m, one colour, one storey height, one window pitch), which read as one slab.
        // A house is 10 to 24 m of wall with its own plaster colour, bay width, storey count (when the storey height stays in range), cornice and balcony habit; the strips below are laid per house.
        hs = B.old && kind === 'street' ? oldHouses(E, B, S, len, nUp, yTop - yg, nb) : null;
        if (hs) { nb = hs.nb; bts = hs.bts; }
        let upT = W.up || B.up; const nobT = W.nob || B.nob || 'n19_nob', gmode = W.ground;
        if (S.alt && !W.up && hh(ax * 0.77 + 3, az * 1.31) < S.altP) upT = S.alt; // e.g. an exterior stairwell bay on a housing insulae
        // ground floor runs
        const runs = [];
        const addRun = (lay, brk, h) => { const q = runs[runs.length - 1]; if (q && q.lay === lay && !brk && REPEATABLE.has(lay)) q.n++; else runs.push({ lay, n: 1, h }); };   // brk: a new house starts here, so a run never crosses two colours
        if (S.church) for (let i = 0; i < nb; i++) addRun(nb > 2 && i === (nb >> 1) && kind === 'street' && r() < 0.9 ? 'ch_door' : 'ch_base');
        else if (W.bl && W.bl.ground) for (let i = 0; i < nb; i++) addRun(W.bl.ground[(nb - 1 - i) % W.bl.ground.length]);   // a hand-drawn facade (src/hero-facades.js): the layer of every bay, in order
        else if (kind === 'street') {
          let prev = null;
          const GL = GROUND_MODES[gmode] || B.gl || groundMix(S, B);
          for (let i = 0; i < nb; i++) {
            const hi = hs ? hs.of[i] : 0, brk = hs && hs.h[hi].i0 === i;
            let lay = prev && !brk && REPEATABLE.has(prev) && r() < 0.6 ? prev : pick(GL, r);
            if (lay === prev && !REPEATABLE.has(lay)) lay = pick(GL, r);
            if (W.portal && W.portal.bay === i && (W.portal.wall === undefined || (bm && W.portal.wall === bm.i))) lay = 'g_arch';
            addRun(lay, brk, hi); prev = lay;
          }
        } else for (let i = 0; i < nb; i++) { const q = r(); addRun(stack !== undefined ? 'blank_g' : q < 0.12 ? 'g_door2' : q < 0.25 ? 'g_win' : 'blank_g'); }
        // post-war street walls: the rhythm of balcony columns, and now and then pilotis (the ground floor stands back under the block, concrete columns in front)
        const PF = S.pwf && kind === 'street' && !W.up && !W.ground && nUp > 0 && bw >= 2.9 ? S.pwf : null;
        let pcol = null, rec = 0;
        if (PF) {
          const pu = hh(ax * 0.31 + 5.7, az * 0.53 + 1.1), ps = PF.pat.reduce((a, b) => a + b, 0); let pat = 0, acc = PF.pat[0];
          while (pat < 4 && pu * ps >= acc) acc += PF.pat[++pat];
          const per = [1, 2, 3, 3, 1][pat], ph = Math.floor(hh(ax * 0.91 + 2.3, az * 1.7 + 0.9) * per);
          pcol = Array.from({ length: nb }, (_, i) => (i === 0 && E.reflexA) || (i === nb - 1 && E.reflexB) ? 0 : pat === 0 ? 1 : pat === 1 ? ((i + ph) % 2 === 0 ? 1 : 0) : pat === 2 ? ((i + ph) % 3 !== 0 ? 1 : 0) : pat === 3 ? ((i + ph) % 3 === 0 ? 1 : 0) : hh(ax * 2.1 + i * 3.7, az * 1.3 + i) < 0.5 ? 1 : 0);
          if (!pcol.some(Boolean)) pcol[nb >> 1] = 1;
          if (len >= 9 && !E.reflexA && !E.reflexB && hh(ax * 0.47 + 9.1, az * 0.83 + 4.3) < PF.pilot) rec = 2.6 + 1.2 * hh(ax * 1.3 + 0.7, az * 0.6 + 3.1);
        }
        let i0 = 0;
        grec = rec;
        for (const run of runs) {
          const t0 = bt(i0), t1 = bt(i0 + run.n);
          if (hs && run.h !== undefined) col = hs.h[run.h].col;
          strip(t0, t1, foot0 + (foot1 - foot0) * t0, foot0 + (foot1 - foot0) * t1, Math.max(yg, foot0 + 1), Math.max(yg, foot1 + 1), 0, 1, L[GMAP[run.lay] || run.lay], 0.64, 0.9, i0, i0 + run.n);
          i0 += run.n;
        }
        col = B.col; grec = 0;
        if (rec) {   // the arcade: the underside of the block, the two returns and a row of columns
          const cc = B.conc, rx = -nx * rec, rz = -nz * rec;
          gbuf.q([ax, yg, az, 0, 0, .45], [bx, yg, bz, len / 3, 0, .45], [bx + rx, yg, bz + rz, len / 3, rec / 3, .45], [ax + rx, yg, az + rz, 0, rec / 3, .45], 0, -1, 0, L.blank, cc);
          gbuf.q([ax, foot0, az, 0, 0, .8], [ax + rx, foot0, az + rz, 1, 0, .6], [ax + rx, yg, az + rz, 1, 1, .6], [ax, yg, az, 0, 1, .8], ux, 0, uz, L.blank, cc);
          gbuf.q([bx, foot1, bz, 0, 0, .8], [bx + rx, foot1, bz + rz, 1, 0, .6], [bx + rx, yg, bz + rz, 1, 1, .6], [bx, yg, bz, 0, 1, .8], -ux, 0, -uz, L.blank, cc);
          const nc = Math.max(2, Math.round(len / 6.2) + 1);
          for (let k = 0; k < nc; k++) {   // a column: front and two sides, 0.7 m wide and 0.6 m deep, from the pavement to the underside of the block
            const s0 = Math.min(len - 0.75, 0.05 + (len - 0.8) * k / (nc - 1)), s1 = s0 + 0.7, yb = foot0 + (foot1 - foot0) * (s0 + 0.35) / len, dpc = 0.6;
            const p0x = ax + ux * s0, p0z = az + uz * s0, p1x = ax + ux * s1, p1z = az + uz * s1;
            gbuf.q([p0x, yb, p0z, 0, 0, .78], [p1x, yb, p1z, .6, 0, .78], [p1x, yg, p1z, .6, 1, .9], [p0x, yg, p0z, 0, 1, .9], nx, 0, nz, L.blank, cc);
            gbuf.q([p0x, yb, p0z, 0, 0, .7], [p0x - nx * dpc, yb, p0z - nz * dpc, .5, 0, .7], [p0x - nx * dpc, yg, p0z - nz * dpc, .5, 1, .8], [p0x, yg, p0z, 0, 1, .8], -ux, 0, -uz, L.blank, cc);
            gbuf.q([p1x, yb, p1z, 0, 0, .7], [p1x - nx * dpc, yb, p1z - nz * dpc, .5, 0, .7], [p1x - nx * dpc, yg, p1z - nz * dpc, .5, 1, .8], [p1x, yg, p1z, 0, 1, .8], ux, 0, uz, L.blank, cc);
          }
        }
        // upper floors
        if (nUp > 0) {
          if (hs) {   // an old-town front: every house lays its own storeys
            for (const h of hs.h) {
              col = h.col;
              const fhH = (yTop - yg) / h.nUp; let start = 1, y0 = yg;
              if (hasNob) { strip(bt(h.i0), bt(h.i1), yg, yg, yg + fhH, yg + fhH, 0, 1, L[nobT], 0.94, 0.98, h.i0, h.i1); start = 2; y0 = yg + fhH; }
              const nf = h.nUp - start + 1;
              if ((upT === 'old_up' || upT === 'ost_up') && nf >= 2) { const yt = y0 + (yTop - y0) * (nf - 1) / nf; strip(bt(h.i0), bt(h.i1), y0, y0, yt, yt, 0, nf - 1, L[upT], 0.97, 0.945, h.i0, h.i1); strip(bt(h.i0), bt(h.i1), yt, yt, yTop, yTop, 0, 1, upT === 'ost_up' ? L.ost_top : L.old_top, 0.945, 0.93, h.i0, h.i1); }   // the top floor has its own, smaller windows
              else if (nf >= 1) strip(bt(h.i0), bt(h.i1), y0, y0, yTop, yTop, 0, nf, L[upT], 0.97, 0.93, h.i0, h.i1);
            }
            col = B.col;
          } else if (S.church) {
            // the nave wall: plain pilastered storeys, the clerestory with its cornice on top; over the portal the first storey is the rose window (the portal is the ground run of ch_door)
            let dB = -1; for (let i = 0, a = 0; i < runs.length; a += runs[i++].n) if (runs[i].lay === 'ch_door') { dB = a; break; }
            const wall = (b0, b1, rose) => {
              const t0 = b0 / nb, t1 = b1 / nb, yc = yg + fh * (nUp - 1);
              if (rose && nUp >= 2) { strip(t0, t1, yg, yg, yg + fh, yg + fh, 0, 1, L.ch_rose, 0.95, 0.97, b0, b1); if (nUp >= 3) strip(t0, t1, yg + fh, yg + fh, yc, yc, 0, nUp - 2, L.ch_mid, 0.95, 0.97, b0, b1); }
              else if (nUp >= 2) strip(t0, t1, yg, yg, yc, yc, 0, nUp - 1, L.ch_mid, 0.95, 0.97, b0, b1);
              strip(t0, t1, yc, yc, yTop, yTop, 0, 1, L.ch_top, 0.97, 0.93, b0, b1);
            };
            if (dB < 0) wall(0, nb, false); else { if (dB > 0) wall(0, dB, false); wall(dB, dB + 1, true); if (dB + 1 < nb) wall(dB + 1, nb, false); }
          } else {
            let start = 1, y0 = yg;
            if (hasNob && W.bl && W.bl.nob) { for (let i = 0; i < nb; i++) strip(i / nb, (i + 1) / nb, yg, yg, yg + fh1, yg + fh1, 0, 1, L[W.bl.nob[(nb - 1 - i) % W.bl.nob.length]], 0.94, 0.98, 0, 1); start = 2; y0 = yg + fh1; }
            else if (hasNob && kind === 'street') { strip(0, 1, yg, yg, yg + fh1, yg + fh1, 0, 1, L[nobT], 0.94, 0.98, 0, nb); start = 2; y0 = yg + fh1; }
            const nf = nUp - start + 1;
            if (B.old && (upT === 'old_up' || upT === 'ost_up') && nf >= 2) { const yt = y0 + (yTop - y0) * (nf - 1) / nf; strip(0, 1, y0, y0, yt, yt, 0, nf - 1, L[upT], 0.97, 0.945, 0, nb); strip(0, 1, yt, yt, yTop, yTop, 0, 1, upT === 'ost_up' ? L.ost_top : L.old_top, 0.945, 0.93, 0, nb); }   // the top floor has its own, smaller windows
            else if (nf >= 1 && W.bl && W.bl.up) {   // a hand-drawn facade: a layer per bay, the top floor on its own when it has layers of its own
              const top = W.bl.top && nf >= 2, yt = top ? y0 + (yTop - y0) * (nf - 1) / nf : yTop, nfu = top ? nf - 1 : nf;
              for (let i = 0; i < nb; i++) {
                strip(i / nb, (i + 1) / nb, y0, y0, yt, yt, 0, nfu, L[W.bl.up[(nb - 1 - i) % W.bl.up.length]], 0.97, top ? 0.945 : 0.93, 0, 1);
                if (top) strip(i / nb, (i + 1) / nb, yt, yt, yTop, yTop, 0, 1, L[W.bl.top[(nb - 1 - i) % W.bl.top.length]], 0.945, 0.93, 0, 1);
              }
            }
            else if (nf >= 1 && pcol) {   // one strip per run of bays with the same kind of window: balcony doors or plain windows
              for (let i = 0, j; i < nb; i = j) {
                for (j = i; j < nb && pcol[j] === pcol[i]; j++);
                strip(i / nb, j / nb, y0, y0, yTop, yTop, 0, nf, L[pcol[i] ? (B.brick ? 'pwbd' : 'pwd') : (B.brick ? 'pwbw' : 'pww')], 0.97, 0.93, i, j);
              }
            }
            else if (nf >= 1) strip(0, 1, y0, y0, yTop, yTop, 0, nf, L[upT], 0.97, 0.93, 0, nb);
          }
        }
        // balconies on street fronts (per-spec pattern, otherwise palazzi styles get the default pattern)
        const bmode = B.old ? 'old' : W.balc || S.balc || (S.rail && S.nobile ? 'default' : 'none'), rail = W.rail || B.railAlt || S.rail || 'rail_a';
        if (kind === 'street' && (bmode !== 'none' || W.bal || W.canopy) && (hs || bw >= (W.balc ? 2.5 : 2.9)) && nUp > 0) {
          if (bmode === 'none') { /* the balconies and the canopy of a hand-drawn front (W.bal, W.canopy), below */ }
          else if (bmode === 'old') {   // old town: every house has its own balcony habit (oldHouses): iron balconies on every floor in a run per window or two, one on the piano nobile only, a few, or none
            if (hs) for (const h of hs.h) {
              const lo = h.i0 + (h.i0 === 0 && E.reflexA ? 1 : 0), hi = h.i1 - (h.i1 === nb && E.reflexB ? 1 : 0), fhH = (yTop - yg) / h.nUp, bwH = h.bw;
              if (h.bal === 'none' || hi <= lo || bwH < 2.5) continue;
              stoneC = h.stone; slabC = h.slab;
              for (let f = 1; f <= h.nUp; f++) {
                const u = hh(ax * 1.7 + f * 3.1 + h.k * 11.3, az * 0.9 + f * 5.3), nobF = f === 1 && hasNob, yF = yg + (f - 1) * fhH;
                if (h.bal === 'nob' ? f !== 1 : u > (h.bal === 'full' ? 0.93 : nobF ? 0.9 : 0.62)) continue;
                const rl = h.rail, dp = h.dp + 0.1 * (f === 1) + 0.12 * hh(ax + f * 0.37, az * 1.1);
                if (h.bal === 'nob' || (h.bal === 'full' && f === 1) || (nobF ? u < 0.45 : u < 0.19)) { const w2 = (hi - lo) * bwH / 2 - 0.3, t = (bt(lo) + bt(hi)) / 2; obalc(t, yF, w2, Math.max(1, Math.round(w2 / (nobF ? 1.1 : 1.6))), rl, dp); continue; }
                for (let i = lo, k = 0; i < hi; k++) {
                  const h2 = hh(ax * 3.1 + i * 1.3 + f * 7.7, az * 2.3 + k), n = 1 + (h2 < 0.35) + (h2 < 0.12), run = Math.min(n, hi - i);
                  if (h2 < (h.bal === 'full' ? 0.85 : 0.6)) { const w2 = run * bwH / 2 - 0.3; obalc((bt(i) + bt(i + run)) / 2, yF, w2, Math.max(1, Math.round(w2 / (nobF ? 1.1 : 1.8))), rl, dp); i += run + (h.bal === 'full' ? 0 : 1); } else i++;
                }
              }
              stoneC = B.stone; slabC = B.slab;
            }
          } else if (bmode === 'pw') {   // post-war: a deep balcony in front of every balcony door, in columns, a rail per column (now and then another one)
            if (pcol) for (let i = 0; i < nb; i++) {
              if (!pcol[i]) continue;
              const w2 = Math.min(bw * 0.5 - 0.15, PF.maxW ? PF.maxW / 2 : 1.75), t = (i + 0.5) / nb, rl1 = hh(ax * 0.7 + i * 1.9, az * 1.1 + i) < 0.72 ? B.pr[0] : B.pr[1];
              for (let f = 1; f <= nUp; f++) {
                if (f === nUp && nUp >= 5 && hh(ax * 0.17 + i * 2.3, az * 0.41 + 7.7) < 0.6) continue;   // [tri budget] the top floor is often a set-back attico or a plain terrace, and nobody counts its balconies from the street
                pwBalc(t, floorBase(f), w2, B.pdp, f > 1 && hh(ax * 0.3 + i * 5.1, az * 0.8 + f * 3.3) < 0.1 ? B.pr[2] : rl1, f === 1, !(i > 0 && pcol[i - 1]), !(i < nb - 1 && pcol[i + 1]));
              }
            }
          } else if (bmode === 'cont') {
            for (let f = 1; f <= (W.contFloors || S.contFloors || 1) && f <= nUp; f++) balcony(0.5, floorBase(f), Math.max(0.8, len / 2 - 0.5), (W.balc ? true : f === 1), Math.max(2, Math.round((len - 1) / 2.6)), rail); // [tri budget] slab brackets every 2.6 m, and only on the floor a pedestrian can see
          } else {
            const upper = bmode === 'default' ? hh(ax * 1.3, az * 0.7) < S.balcUpper : bmode === 'every' || bmode === 'alt';
            for (let f = 1; f <= nUp; f++) {
              if (f > 1 && !upper) break;
              if (bmode === 'nobile' && f > 1) break;
              for (let i = 0; i < nb; i++) {
                if ((i === 0 && E.reflexA) || (i === nb - 1 && E.reflexB)) continue;
                if (f > 1 && (bmode === 'default' || bmode === 'alt') && i % 2) continue;
                if (bmode === 'alt' && f === 1 && i % 2) continue;
                balcony((i + 0.5) / nb, floorBase(f), Math.min(1.55, bw * 0.36), f === 1, 0, rail);
              }
            }
          }
          // A hand-drawn front (assets/facades/specs.js) asks for its depth as geometry. Bays are counted left to right as the viewer reads the wall, like the layers of `bl`.
          //   bal: [{ f: [first floor, last floor], k: [first bay, last bay + 1], run: one slab along the whole range, w: half width of one, rail, dp }]   canopy: { k, dy (m above the first floor line, negative = below), dp }
          for (const q of nUp > 0 && W.bal || []) {
            const k0 = q.k ? q.k[0] : 0, k1 = q.k ? q.k[1] : nb, rl = q.rail || rail, dp = q.dp || 0.62;
            for (let f = q.f[0]; f <= Math.min(q.f[1], nUp); f++) {
              if (q.run) { const w2 = (k1 - k0) * bw / 2 - 0.25; obalc((2 * nb - k0 - k1) / (2 * nb), floorBase(f), w2, Math.max(1, Math.round(w2 / 1.1)), rl, dp); }
              else for (let k = k0; k < k1; k++) obalc((nb - k - 0.5) / nb, floorBase(f), q.w ?? Math.min(1.55, bw * 0.4), 1, rl, dp);
            }
          }
          if (W.canopy) ocanopy((nb - W.canopy.k[1]) / nb, (nb - W.canopy.k[0]) / nb, yg + (W.canopy.dy ?? -1.2), W.canopy.dp || 2.2);
        }
        // a pub's hand-built front carries its sign 3 to 6 m up: no balcony of this wall may hang in front of it (Krust and Punkfunk had a railing across theirs)
        function pubSign(t, yFloor, w2) { if (yFloor - yg >= 7) return false; const cx = ax + dx * t, cz = az + dz * t; for (const d of PUB_DOORS) { const al = (d[0] - cx) * ux + (d[1] - cz) * uz, off = Math.abs((d[0] - cx) * nx + (d[1] - cz) * nz); if (Math.abs(al) < w2 + 4.5 && off < 6) return true; } return false; }
        function ocanopy(t0, t1, yB, dp) {   // a glazed entrance canopy: the glass sloping down from the wall to an iron fascia, an iron soffit and two end faces; 10 triangles
          const px0 = ax + dx * t0, pz0 = az + dz * t0, px1 = ax + dx * t1, pz1 = az + dz * t1, qx0 = px0 + nx * dp, qz0 = pz0 + nz * dp, qx1 = px1 + nx * dp, qz1 = pz1 + nz * dp;
          const yw = yB + 0.55, fa = 0.3, sl = Math.hypot(dp, yw - yB), sx = nx * (yw - yB) / sl, sy = dp / sl, sz = nz * (yw - yB) / sl, LB = LID.blank, ir = B.iron;
          gbuf.q([px0, yw, pz0, 0, 0, 1], [px1, yw, pz1, 1, 0, 1], [qx1, yB, qz1, 1, .3, 1], [qx0, yB, qz0, 0, .3, 1], sx, sy, sz, LB, CANOPY_GLASS);
          gbuf.q([qx0, yB - fa, qz0, 0, 0, .8], [qx1, yB - fa, qz1, 1, 0, .8], [qx1, yB, qz1, 1, .1, .9], [qx0, yB, qz0, 0, .1, .9], nx, 0, nz, LB, ir);
          gbuf.q([px0, yw - fa, pz0, 0, 0, .45], [px1, yw - fa, pz1, 1, 0, .45], [qx1, yB - fa, qz1, 1, .3, .45], [qx0, yB - fa, qz0, 0, .3, .45], 0, -1, 0, LB, ir);
          gbuf.t([px0, yw, pz0, 0, 0, .7], [qx0, yB, qz0, .3, 0, .8], [px0, yw - fa, pz0, 0, .1, .6], -ux, 0, -uz, LB, ir); gbuf.t([qx0, yB - fa, qz0, 0, 0, .7], [qx0, yB, qz0, .3, .1, .8], [px0, yw - fa, pz0, 0, .1, .6], -ux, 0, -uz, LB, ir);
          gbuf.t([px1, yw, pz1, 0, 0, .7], [qx1, yB, qz1, .3, 0, .8], [px1, yw - fa, pz1, 0, .1, .6], ux, 0, uz, LB, ir); gbuf.t([qx1, yB - fa, qz1, 0, 0, .7], [qx1, yB, qz1, .3, .1, .8], [px1, yw - fa, pz1, 0, .1, .6], ux, 0, uz, LB, ir);
        }
        function obalc(t, yFloor, w2, nBr, rl0, dp) {   // one old-town balcony: a slab (front, soffit, two ends), stone brackets under it, the iron rail on top
          if (pubSign(t, yFloor, w2)) return;
          if (w2 < 0.6) return;
          const cx = ax + dx * t, cz = az + dz * t, th = 0.2, yb = yFloor + 0.05, yt = yb + th, px0 = cx - ux * w2, pz0 = cz - uz * w2, px1 = cx + ux * w2, pz1 = cz + uz * w2;
          const qx0 = px0 + nx * dp, qz0 = pz0 + nz * dp, qx1 = px1 + nx * dp, qz1 = pz1 + nz * dp, sl = slabC, LB = L.blank;
          gbuf.q([qx0, yb, qz0, 0, 0, .85], [qx1, yb, qz1, 1, 0, .85], [qx1, yt, qz1, 1, .1, .95], [qx0, yt, qz0, 0, .1, .95], nx, 0, nz, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .5], [px1, yb, pz1, 1, 0, .5], [qx1, yb, qz1, 1, .3, .5], [qx0, yb, qz0, 0, .3, .5], 0, -1, 0, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .8], [qx0, yb, qz0, .3, 0, .8], [qx0, yt, qz0, .3, .1, .9], [px0, yt, pz0, 0, .1, .9], -ux, 0, -uz, LB, sl);
          gbuf.q([px1, yb, pz1, 0, 0, .8], [qx1, yb, qz1, .3, 0, .8], [qx1, yt, qz1, .3, .1, .9], [px1, yt, pz1, 0, .1, .9], ux, 0, uz, LB, sl);
          for (let k = 0; k <= nBr; k++) {   // a bracket is a triangle of stone against the wall, seen from both sides
            const o = -w2 + 0.3 + (2 * w2 - 0.6) * k / nBr, bx0 = cx + ux * o, bz0 = cz + uz * o;
            const A = [bx0, yb, bz0, 0, 0, .5], Bq = [bx0 + nx * dp * .9, yb, bz0 + nz * dp * .9, .3, 0, .6], Cq = [bx0, yb - .55, bz0, 0, .3, .45];
            gbuf.t(A, Bq, Cq, ux, 0, uz, LB, sl); gbuf.t(A, Bq, Cq, -ux, 0, -uz, LB, sl);
          }
          const rl = L[rl0], rb = yt, rt = yt + 1.0, ins = 0.05, rx0 = qx0 - nx * ins, rz0 = qz0 - nz * ins, rx1 = qx1 - nx * ins, rz1 = qz1 - nz * ins, wu = w2 * 2 / 1.6, du = dp / 1.6;
          ch.r.q([rx0, rb, rz0, 0, 0, 1], [rx1, rb, rz1, wu, 0, 1], [rx1, rt, rz1, wu, 1, 1], [rx0, rt, rz0, 0, 1, 1], nx, 0, nz, rl, white);
          ch.r.q([px0 + ux * ins, rb, pz0 + uz * ins, 0, 0, 1], [rx0 + ux * ins, rb, rz0 + uz * ins, du, 0, 1], [rx0 + ux * ins, rt, rz0 + uz * ins, du, 1, 1], [px0 + ux * ins, rt, pz0 + uz * ins, 0, 1, 1], -ux, 0, -uz, rl, white);
          ch.r.q([px1 - ux * ins, rb, pz1 - uz * ins, 0, 0, 1], [rx1 - ux * ins, rb, rz1 - uz * ins, du, 0, 1], [rx1 - ux * ins, rt, rz1 - uz * ins, du, 1, 1], [px1 - ux * ins, rt, pz1 - uz * ins, 0, 1, 1], ux, 0, uz, rl, white);
          stats.balconies++;
        }
        function pwBalc(t, yFloor, w2, dp, rl0, top, sl0, sr0) {   // a deep post-war balcony: slab front, soffit and (on the first floor, where a camera can see it) the top; rail on the front and on the sides that are not against a neighbouring balcony, 8 to 12 triangles
          if (pubSign(t, yFloor, w2)) return;
          if (w2 < 0.8) return;
          const cx = ax + dx * t, cz = az + dz * t, th = 0.17, yb = yFloor + 0.08, yt = yb + th, px0 = cx - ux * w2, pz0 = cz - uz * w2, px1 = cx + ux * w2, pz1 = cz + uz * w2;
          const qx0 = px0 + nx * dp, qz0 = pz0 + nz * dp, qx1 = px1 + nx * dp, qz1 = pz1 + nz * dp, sl = B.slab, LB = L.blank;
          gbuf.q([qx0, yb, qz0, 0, 0, .85], [qx1, yb, qz1, 1, 0, .85], [qx1, yt, qz1, 1, .1, .95], [qx0, yt, qz0, 0, .1, .95], nx, 0, nz, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .5], [px1, yb, pz1, 1, 0, .5], [qx1, yb, qz1, 1, .3, .5], [qx0, yb, qz0, 0, .3, .5], 0, -1, 0, LB, sl);
          if (top) gbuf.q([px0, yt, pz0, 0, 0, 1], [px1, yt, pz1, 1, 0, 1], [qx1, yt, qz1, 1, .3, 1], [qx0, yt, qz0, 0, .3, 1], 0, 1, 0, LB, sl);
          const rl = L[rl0], rc = rl0 === 'rail_s' ? sl : white, rb = yt, rt = yt + 1.0, ins = 0.05, rx0 = qx0 - nx * ins, rz0 = qz0 - nz * ins, rx1 = qx1 - nx * ins, rz1 = qz1 - nz * ins, wu = w2 * 2 / 1.6, du = dp / 1.6;
          ch.r.q([rx0, rb, rz0, 0, 0, 1], [rx1, rb, rz1, wu, 0, 1], [rx1, rt, rz1, wu, 1, 1], [rx0, rt, rz0, 0, 1, 1], nx, 0, nz, rl, rc);
          if (sl0) ch.r.q([px0 + ux * ins, rb, pz0 + uz * ins, 0, 0, 1], [rx0 + ux * ins, rb, rz0 + uz * ins, du, 0, 1], [rx0 + ux * ins, rt, rz0 + uz * ins, du, 1, 1], [px0 + ux * ins, rt, pz0 + uz * ins, 0, 1, 1], -ux, 0, -uz, rl, rc);
          if (sr0) ch.r.q([px1 - ux * ins, rb, pz1 - uz * ins, 0, 0, 1], [rx1 - ux * ins, rb, rz1 - uz * ins, du, 0, 1], [rx1 - ux * ins, rt, rz1 - uz * ins, du, 1, 1], [px1 - ux * ins, rt, pz1 - uz * ins, 0, 1, 1], ux, 0, uz, rl, rc);
          stats.balconies++;
        }
        function balcony(t, yFloor, w2, brackets, nBr, rl0) {
          if (pubSign(t, yFloor, w2)) return;
          const cx = ax + dx * t, cz = az + dz * t, dp = 0.78, th = 0.16, yb = yFloor + 0.09, yt = yb + th;
          const px0 = cx - ux * w2, pz0 = cz - uz * w2, px1 = cx + ux * w2, pz1 = cz + uz * w2;
          const qx0 = px0 + nx * dp, qz0 = pz0 + nz * dp, qx1 = px1 + nx * dp, qz1 = pz1 + nz * dp, sl = B.slab, LB = L.blank;
          gbuf.q([px0, yt, pz0, 0, 0, 1], [px1, yt, pz1, 1, 0, 1], [qx1, yt, qz1, 1, .3, 1], [qx0, yt, qz0, 0, .3, 1], 0, 1, 0, LB, sl);
          gbuf.q([px0, yb, pz0, 0, 0, .5], [px1, yb, pz1, 1, 0, .5], [qx1, yb, qz1, 1, .3, .5], [qx0, yb, qz0, 0, .3, .5], 0, -1, 0, LB, sl);
          gbuf.q([qx0, yb, qz0, 0, 0, .85], [qx1, yb, qz1, 1, 0, .85], [qx1, yt, qz1, 1, .1, .95], [qx0, yt, qz0, 0, .1, .95], nx, 0, nz, LB, sl);
          if (w2 < 2.5) { // end caps of a long continuous slab are almost always hidden by the neighbouring wall or too small to read
            gbuf.q([px0, yb, pz0, 0, 0, .8], [qx0, yb, qz0, .3, 0, .8], [qx0, yt, qz0, .3, .1, .9], [px0, yt, pz0, 0, .1, .9], -ux, 0, -uz, LB, sl);
            gbuf.q([px1, yb, pz1, 0, 0, .8], [qx1, yb, qz1, .3, 0, .8], [qx1, yt, qz1, .3, .1, .9], [px1, yt, pz1, 0, .1, .9], ux, 0, uz, LB, sl);
          }
          if (brackets) {
            const offs = nBr ? Array.from({ length: nBr + 1 }, (_, k) => -w2 + 0.3 + (2 * w2 - 0.6) * k / nBr) : [-w2 + 0.25, w2 - 0.25];
            for (const o of offs) {
              const bx0 = cx + ux * o, bz0 = cz + uz * o, bx1 = bx0 + nx * dp, bz1 = bz0 + nz * dp;
              for (const sgn of [1, -1]) gbuf.t([bx0, yb - 0.42, bz0, 0, 0, .4], [bx1, yb, bz1, .1, .1, .5], [bx0, yb, bz0, 0, .1, .5], ux * sgn, 0, uz * sgn, L.blank, B.iron);   // [tri budget] one triangle, not a quad with a degenerate half
            }
          }
          const rl = L[rl0], rb = yt, rt = yt + 1.0, ins = 0.05, rx0 = qx0 - nx * ins, rz0 = qz0 - nz * ins, rx1 = qx1 - nx * ins, rz1 = qz1 - nz * ins, wu = w2 * 2 / 1.6, du = dp / 1.6;
          ch.r.q([rx0, rb, rz0, 0, 0, 1], [rx1, rb, rz1, wu, 0, 1], [rx1, rt, rz1, wu, 1, 1], [rx0, rt, rz0, 0, 1, 1], nx, 0, nz, rl, white);
          ch.r.q([px0 + ux * ins, rb, pz0 + uz * ins, 0, 0, 1], [rx0 + ux * ins, rb, rz0 + uz * ins, du, 0, 1], [rx0 + ux * ins, rt, rz0 + uz * ins, du, 1, 1], [px0 + ux * ins, rt, pz0 + uz * ins, 0, 1, 1], -ux, 0, -uz, rl, white);
          ch.r.q([px1 - ux * ins, rb, pz1 - uz * ins, 0, 0, 1], [rx1 - ux * ins, rb, rz1 - uz * ins, du, 0, 1], [rx1 - ux * ins, rt, rz1 - uz * ins, du, 1, 1], [px1 - ux * ins, rt, pz1 - uz * ins, 0, 1, 1], ux, 0, uz, rl, white);
          stats.balconies++;
        }
      }
      // projecting cornice at the roof line (an old-town front: one piece per house, each as deep as its own house)
      if (kind !== 'party' && len >= 2.5 && (B.corn ?? S.corn) > 0) {
        for (const h of hs ? hs.h : [null]) {
          const d = h ? B.corn * h.cornK : B.corn ?? S.corn, ext = len > 4 * d ? d : 0, sA = E.reflexA && (!h || h.i0 === 0) ? 0 : h && h.i0 > 0 ? 0 : ext, sB = E.reflexB && (!h || h.i1 === nb) ? 0 : h && h.i1 < nb ? 0 : ext;
          const l0 = h ? bt(h.i0) * len : 0, l1 = h ? bt(h.i1) * len : len;
          const x0 = ax + ux * l0 - ux * sA, z0 = az + uz * l0 - uz * sA, x1 = ax + ux * l1 + ux * sB, z1 = az + uz * l1 + uz * sB, yb = yTop - 0.42, yt = yTop + 0.02, ox0 = x0 + nx * d, oz0 = z0 + nz * d, ox1 = x1 + nx * d, oz1 = z1 + nz * d, ll = (l1 - l0) / 1.2, st = h ? h.stone : B.stone;
          gbuf.q([ox0, yb, oz0, 0, 0, .95], [ox1, yb, oz1, ll, 0, .95], [ox1, yt, oz1, ll, 1, 1], [ox0, yt, oz0, 0, 1, 1], nx, 0, nz, L.cornice, st);
          gbuf.q([x0, yb, z0, 0, 0, .55], [x1, yb, z1, 1, 0, .55], [ox1, yb, oz1, 1, .3, .55], [ox0, yb, oz0, 0, .3, .55], 0, -1, 0, L.blank, st);
          gbuf.q([x0, yt, z0, 0, 0, 1], [x1, yt, z1, 1, 0, 1], [ox1, yt, oz1, 1, .3, 1], [ox0, yt, oz0, 0, .3, 1], 0, 1, 0, L.blank, st);
        }
      }
      // parapet around the terrace
      if (!pitched && parH > 0 && kind !== 'party' && len >= 1.5) {
        const t = 0.25, ext = len > 1 ? t : 0, sA = E.reflexA ? 0 : ext, sB = E.reflexB ? 0 : ext;
        if (hs) { for (const h of hs.h) { col = h.col; strip(bt(h.i0), bt(h.i1), yTop, yTop, yTop + parH, yTop + parH, 0, parH / 4, L.blank, 0.9, 1, bt(h.i0) * len / 4, bt(h.i1) * len / 4); } col = B.col; }
        else strip(0, 1, yTop, yTop, yTop + parH, yTop + parH, 0, parH / 4, L.blank, 0.9, 1, 0, len / 4);
        const x0 = ax - ux * sA, z0 = az - uz * sA, x1 = bx + ux * sB, z1 = bz + uz * sB, ix0 = x0 - nx * t, iz0 = z0 - nz * t, ix1 = x1 - nx * t, iz1 = z1 - nz * t;
        gbuf.q([ix0, yTop, iz0, 0, 0, .85], [ix1, yTop, iz1, len / 4, 0, .85], [ix1, yTop + parH, iz1, len / 4, parH / 4, 1], [ix0, yTop + parH, iz0, 0, parH / 4, 1], -nx, 0, -nz, L.blank, col);
        gbuf.q([x0, yTop + parH, z0, 0, 0, 1], [x1, yTop + parH, z1, 1, 0, 1], [ix1, yTop + parH, iz1, 1, .2, 1], [ix0, yTop + parH, iz0, 0, .2, 1], 0, 1, 0, L.blank, B.stone);
      }
    }

    // a wall is a party wall when another building stands against it; for a split building that includes its other parts, but not its own footprint line (the parts stand inside it)
    const touches = (x, z) => inBuilding(x, z, B.self) || (B.parts2 && B.parts2.some(q => q.flat !== flat && inPoly(q.pts, x, z)));
    for (const ring of rings) {
      const pts = ring.pts, N = pts.length;
      for (let i = 0; i < N; i++) {
        const a = pts[i], b = pts[(i + 1) % N], pa = pts[(i + N - 1) % N], pb = pts[(i + 2) % N];
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
        const crossA = (a[0] - pa[0]) * dz - (a[1] - pa[1]) * dx, crossB = dx * (pb[1] - b[1]) - dz * (pb[0] - b[0]);
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        let kind;
        if (ring.hole) kind = 'court';
        else if (stack !== undefined) kind = 'back';
        else if (touches(mx + nx * 0.6, mz + nz * 0.6) || touches(mx + nx * 1.3, mz + nz * 1.3)) kind = 'party';
        else {
          kind = roadNear(mx + nx * 2.2, mz + nz * 2.2).d < 3.2 ? 'street' : 'back';
          if (kind === 'back' && B.S.church && len >= 6 && !touches(mx + nx * 3, mz + nz * 3) && !touches(mx + nx * 9, mz + nz * 9)) kind = 'street';   // a church wall that looks onto open ground (a piazza, a churchyard) is its front: portal, rose window
          // Set-back fronts: on the wide avenues and in the housing estates the facade stands behind a garden strip, a service lane or a parking row, and is still
          // the front (shops, balconies). Look further out along the normal for a street, stopping at the first building in the way.
          if (kind === 'back' && B.reach && len > 6) for (let t = 5; t <= B.reach; t += 4) {
            const qx = mx + nx * t, qz = mz + nz * t;
            if (touches(qx, qz)) break;
            if (roadNear(qx, qz).d < 1.2) { kind = 'street'; break; }
          }
        }
        edge({ ax: a[0], az: a[1], bx: b[0], bz: b[1], dx, dz, ux, uz, nx, nz, len, reflexA: crossA < -0.05, reflexB: crossB < -0.05, kind, ga: stack !== undefined ? stack + 0.3 : groundY(a[0], a[1]), gb: stack !== undefined ? stack + 0.3 : groundY(b[0], b[1]) });
      }
    }

    // ----- e6: the underside of an archway volume (a bridge over a ground-floor passage, `yb` in the tile data) -----
    if (B.arch && stack !== undefined) {
      try {
        const contour = outerPts.map(p => new THREE.Vector2(p[0], p[1])), tris = THREE.ShapeUtils.triangulateShape(contour, []);
        for (const t of tris) gbuf.tDown([outerPts[t[0]][0], stack, outerPts[t[0]][1], 0, 0, 0.8], [outerPts[t[1]][0], stack, outerPts[t[1]][1], 1, 0, 0.8], [outerPts[t[2]][0], stack, outerPts[t[2]][1], 0, 1, 0.8], LID.terrace, B.slab);
      } catch (e) { /* skip */ }
    }

    // ----- roof -----
    if (!pitched) {
      const hp = rings.slice(1).map(h => h.pts);
      try {
        const contour = outerPts.map(p => new THREE.Vector2(p[0], p[1])), hs = hp.map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
        const tris = THREE.ShapeUtils.triangulateShape(contour, hs), all = contour.concat(...hs);
        const k = B.roofK, V = i => [all[i].x, yTop, all[i].y, all[i].x / 3.5, all[i].y / 3.5, k];
        for (const t of tris) gbuf.tUp(V(t[0]), V(t[1]), V(t[2]), B.terrLay, B.roofCol);
      } catch (e) { /* skip broken ring */ }
      if (!S.ruin && !S.silo) roofProps(gbuf, outerPts, hp, yTop, area, r);
    } else {
      const { ua, ub, vm } = ridge, lay = B.pitchLay ?? (B.greyRoof ? LID.tiles_grey : LID.tiles), k = B.roofK;
      const RP = p => { const u = p[0] * ax + p[1] * az, uc = Math.min(ub, Math.max(ua, u)); return [uc * ax - vm * az, uc * az + vm * ax, uc]; };
      const Eave = p => { const u = p[0] * ax + p[1] * az, v = -p[0] * az + p[1] * ax, uc = Math.min(ub, Math.max(ua, u)); return [p[0], yTop, p[1], u / 3, Math.abs(v - vm) * 1.15 / 3, k]; };   // the texture is laid on the plan (along the ridge, across it), so a hip end is not stretched into streaks
      const Rid = (p, q) => [q[0], roofY, q[1], q[2] / 3, 0, k];
      const N = outerPts.length;
      for (let i = 0; i < N; i++) {
        const a = outerPts[i], b = outerPts[(i + 1) % N], ra = RP(a), rb = RP(b);
        gbuf.tUp(Eave(a), Eave(b), Rid(b, rb), lay, B.roofColP || B.roofCol);
        if (Math.hypot(ra[0] - rb[0], ra[1] - rb[1]) > 0.05) gbuf.tUp(Eave(a), Rid(b, rb), Rid(a, ra), lay, B.roofColP || B.roofCol);
      }
    }
    return yTop;
  }

  // ---------- all buildings ----------
  const grey = l => new THREE.Color(l, l, l);
  let meshesOut = [];
  const ruinAt = []; // debug: where the first few ruins are (district-view prints them)
  function* run() {
    chunks = new Map(); let nb = 0;
    const tStart = performance.now();
    stats.styles = {}; stats.balconies = 0; stats.tanks = 0; stats.tiled = 0; stats.flat = 0; stats.specs = 0; stats.osmCol = 0;
    for (const b of data.buildings) {
      if (ctx.skip.has(b.id) || dupIds.has(b.id)) continue;
      if (sliceOver()) yield;
      const r = rng(b.c * 7919 + 13);
      const solids = [];
      const pts0 = pairs(b.p);
      // survey heights (e): the foot elevation is the Comune's, the game's ground off the lidar rasters can be several metres off (SRTM reads roofs), so stand the eave on the lowest ground under the building
      let shift = b.r !== undefined && !data.near ? -b.g : 0;
      if (b.e) { let lo = Infinity; for (const p of pts0) lo = Math.min(lo, groundY(p[0], p[1])); shift = lo - b.g; }
      let cx = 0, cz = 0, bestD = 1e9, near = null;
      for (const p of pts0) { cx += p[0]; cz += p[1]; const q = roadNear(p[0], p[1]); if (q.d < bestD) { bestD = q.d; near = q; } }
      cx /= pts0.length; cz /= pts0.length;
      const area = Math.abs(signedArea(pts0));
      let H0 = b.r !== undefined ? b.r - b.g : b.h;
      const spec = SPECS[b.id] || null;
      const zone = zoneOf(cx, cz, near), Z = ZONES[zone] || ZONES.centro;
      // storeys: where the baked height is only the generic estimate, the district decides (same answer as applyDistrictHeights unless a street rule moved the zone)
      let nFl = 0;
      if (b.dh && b.r === undefined && !b.lv) { nFl = b.dz === zone ? b.dh : floorsAt(Z, cx, cz, area); if (nFl) { const fh = Z.fh || 3.2; H0 = fh + 0.8 + (nFl - 1) * fh + 0.9; } }
      let round = false;
      if (Z.elig && pts0.length >= 10 && area > 25) { let per = 0; for (let i = 0; i < pts0.length; i++) { const a = pts0[i], q = pts0[(i + 1) % pts0.length]; per += Math.hypot(q[0] - a[0], q[1] - a[1]); } round = 4 * Math.PI * area / (per * per) > 0.82; }
      const key = spec && spec.style || chooseStyle(b, H0, area, zone, r, { fl: nFl, round, u: hh(cx * 1.7 + .3, cz * 2.3 + .7), u2: hh(cx * 0.9 + 5.1, cz * 1.9 + 1.3) });
      if (b.r === undefined || key === 'ruin') {
        const street = Math.max(...pts0.map(p => groundY(p[0], p[1])));
        if (key === 'ruin') solids.push([b.p, b.holes, street + 1.7 + 3.2 * hh(cz * 0.7, cx * 1.1)]); // a shell or a rubble lot, never a full building
        else solids.push([b.p, b.holes, street + (nFl ? H0 : b.h)]);
      } else {
        if (!b.split) solids.push([b.p, b.holes, b.r + shift]);
        // upper parts of an unsplit building stand on the base mass (their walls start at its roof, never coplanar with its own walls)
        for (const [poly, rr] of b.parts || []) solids.push(b.split ? [poly, null, rr + shift] : [poly, null, rr + shift, true]);
      }
      let S = STYLES[key];
      if (spec) { stats.specs++; S = { ...S }; if (spec.bay) S.bay = spec.bay; if (spec.fh) S.fh = spec.fh; if (spec.corn !== undefined) S.corn = spec.corn; if (spec.rail) S.rail = spec.rail; }
      const old = !spec && (OLDZ.has(zone) || Z.town) && (key === 'bar' || key === 'n19' || key === 'res' || key === 'low');   // old town: its own windows, ground floors, balconies and plaster
      if (old) S = { ...S, g0: S.g0 * (0.88 + 0.26 * hh(cx * 0.43, cz * 0.77)), fh: S.fh * (0.92 + 0.16 * hh(cx * 0.91, cz * 0.13)) };   // storey heights differ from house to house
      stats.styles[key] = (stats.styles[key] || 0) + 1;
      if (BDBG) (window.__bldDbg = window.__bldDbg || []).push([b.id, Math.round(cx), Math.round(cz), zone, key, Math.round(H0 * 10) / 10, Math.round(area), b.r !== undefined ? 'L' : b.lv ? 'osm' : nFl ? 'dist' : 'gen']);
      if (key === 'ruin' && ruinAt.length < 8) ruinAt.push([Math.round(cx), Math.round(cz)]);
      // colour: spec table, then OSM building:colour, then the zone palette (stone or plaster)
      const isStone = key === 'church' || (spec && spec.stone !== undefined ? spec.stone : (key === 'bar' || key === 'res' || key === 'n19') && r() < Z.pStone * (key === 'bar' ? 1.3 : key === 'res' ? 1 : 0.5));
      const osm = osmColour(b.col);
      let base;
      const brick = !!(S.pwf && !spec && !osm && hh(cx * 0.77 + 1.9, cz * 1.37 + 0.3) < S.pwf.brick);   // post-war block in exposed brick: the tile has the colour, the vertex colour stays near white
      if (spec && spec.col) base = new THREE.Color(spec.col);
      else if (osm) { base = osm; stats.osmCol++; }
      else if (brick) base = new THREE.Color('#b8ada0');
      else if (old && !isStone && !Z.town) base = OLD_PAL[((b.c * 2654435761) >>> 0) % OLD_PAL.length].clone();
      else if (S.pwf && (!Z.elig || OLDZ.has(zone))) base = PAL.pw[b.c % PAL.pw.length].clone();   // post-war blocks in the old zones (and in the unclassified rest) take the 1950s to 80s render colours
      else if (key === 'church') base = PAL.church[b.c % PAL.church.length].clone();
      else { const list = isStone ? Z.stone : Z.plaster; base = new THREE.Color(list[b.c % list.length]); }
      const grime = spec && spec.grime !== undefined ? spec.grime : Z.grime, gr = grime * r();
      const col = base.multiplyScalar(1.3 * (0.94 + 0.1 * r()) * (1 - 0.2 * gr));
      col.lerp(grey((col.r + col.g + col.b) / 3), 0.12 + 0.28 * gr + (old && !osm && !isStone ? 0.12 : 0));
      const stone = new THREE.Color(1, 1, 1).lerp(col, 0.3).multiplyScalar(1.15);
      const B = {
        S, r, ch: chunkOf(cx, cz), col, stone, slab: stone.clone().multiplyScalar(0.92), iron: C('#24242a'), lv: Number(b.lv) || spec && spec.floors || nFl || 0,
        railAlt: S.railAlt && r() < 0.5 ? S.railAlt : null, up: S.up[(r() * S.up.length) | 0], nob: S.nob ? S.nob[(r() * S.nob.length) | 0] : null, greyRoof: S.church && r() < 0.35, roofK: 1,
        spec, self: b.split ? b : undefined, parts2: b.split && b.parts ? b.parts.map(q => ({ flat: q[0], pts: pairs(q[0]) })) : null, bp: spec && spec.walls ? pts0 : null, stoneWall: isStone, arch: !!b.yb,
        reach: Z.elig && !Z.shed ? (Z.front ?? 15) : OLDZ.has(zone) ? 13 : 0,   // the old-town zones that are not `elig` (a piazza in front of a facade, a pavement the road data does not reach) look 13 m for a street, as the others do
        sn: near && near.r && near.r.n || '', sc: near && near.r && near.r.k || '',   // the street it stands on (ground-floor mix)
        gl: Z.gl && (key === 'low' || key === 'fish' || key === 'res') ? Z.gl : null, pitchMul: Z.roof ?? 1, eave: !!b.e, gr, houseCol: !spec && !osm && !isStone, townPal: Z.town ? (TPAL.get(zone) || TPAL.set(zone, Z.plaster.map(c => new THREE.Color(c))).get(zone)) : null,
      };
      B.uo = Math.floor(hh(cx * 3.1, cz * 1.7) * 60);
      if (S.pwf) {   // post-war: balcony depth, the rails of this block (two, and a third for the odd balcony), concrete of the arcade columns
        B.brick = brick; if (brick) B.up = 'pwbw';
        B.pdp = S.pwf.depth[0] + (S.pwf.depth[1] - S.pwf.depth[0]) * hh(cx * 0.53 + 4.1, cz * 0.29 + 8.3);
        B.pr = [0, 1, 2].map(k => pick(PW_RAILS, () => hh(cx * (0.9 + k * 0.37) + k, cz * (1.1 + k * 0.23) + 2.9 * k)));
        B.conc = new THREE.Color(0.78, 0.77, 0.74).lerp(col, 0.15);
      }
      if (old) { B.old = true; B.town = !!Z.town; B.bayK = 0.82 + 0.5 * hh(cx * 0.37, cz * 0.61); B.corn = Math.max(S.corn, 0.28) * (0.8 + 0.7 * hh(cx * 0.9, cz * 1.3)); B.balcP = key === 'res' ? 0.5 : key === 'low' ? 0 : 0.62; B.habH = Z.habH || null; }   // habH: a zone's own balcony habit of plain houses (the hill borgate and Belmonte Mezzagno: a balcony on most upper floors)
      if (isStone && !S.church && S.up.length && key !== 'low') { const sh = r() < 0.6 ? 'g' : 'b'; B.up = old ? 'ost_up' : 'st_up_' + sh; if (old) B.nob = 'ost_nob'; }
      else if (old) { B.up = 'old_up'; B.nob = 'old_nob'; }
      if (!spec) { B.up = UPGRP[B.up] || B.up; if (B.nob) B.nob = UPGRP[B.nob] || B.nob; }
      if (spec && spec.win && spec.win !== 'rect' && WIN_TILES[spec.win]) { const [u, n] = WIN_TILES[spec.win](isStone, r() < 0.6 ? 'g' : 'b'); B.up = u; B.nob = n; }
      { const q = r(); B.terrLay = q < 0.16 ? LID.terrace_b : q < 0.27 ? LID.terrace_c : LID.terrace; }
      if (S.ind) { B.terrLay = LID.roof_metal; B.pitchLay = LID.roof_metal; } else if (S.ruin) B.terrLay = LID.rubble; else if (Z.beach) { B.terrLay = LID.deck; B.pitchLay = LID.deck; }
      const flatTint = 0.88 + 0.2 * r();
      B.roofCol = new THREE.Color(flatTint, flatTint * 0.97, flatTint * 0.92);
      if (b.rc && !S.ind && !S.ruin && !Z.beach && key !== 'church') { // the roof colour of the 2012-13 orthophoto (derived colour only): grey and dusty tan, not terracotta
        RC.set('#' + b.rc);
        const tint = (c0, base) => new THREE.Color(Math.min(1.8, Math.max(0.35, c0.r / base.r)), Math.min(1.8, Math.max(0.35, c0.g / base.g)), Math.min(1.8, Math.max(0.35, c0.b / base.b)));
        B.terrLay = LID.terrace; B.pitchLay = LID.tiles_grey;
        B.roofCol = tint(RC, ROOF_BASE_FLAT).multiplyScalar(0.97 + 0.06 * r()); B.roofColP = tint(RC, ROOF_BASE_TILE).multiplyScalar(0.97 + 0.06 * r());
      }
      let stackY;
      const ni0 = BDBG ? B.ch.m.ni + B.ch.r.ni : 0;
      for (const [flat, holes, roofY, stacked] of solids) {
        if (b.yb) { let g = -1e9; for (const p of pts0) g = Math.max(g, groundY(p[0], p[1])); emitSolid(B, flat, holes, roofY, g + b.yb); }   // e6: a bridge over a passage: starts yb metres above the ground, nothing below it
        else if (stacked) { if (stackY === undefined || roofY <= stackY + 0.4) continue; emitSolid(B, flat, holes, roofY, stackY); } else { const y = emitSolid(B, flat, holes, roofY); if (stackY === undefined && !b.split) stackY = y; }
      }
      if (BDBG) { const T = (window.__bldTris = window.__bldTris || {}); const o = T[key] || (T[key] = [0, 0]); o[0]++; o[1] += (B.ch.m.ni + B.ch.r.ni - ni0) / 3; }
    }
    let tris = 0, nm = 0;
    for (const m of meshesOut) { group.remove(m); m.geometry.dispose(); }
    meshesOut = [];
    for (const c of chunks.values()) {
      for (const [gb, mat, shadow] of [[c.m, matMain, true], [c.r, matRail, false]]) {
        if (!gb.n) continue;
        const m = gb.mesh(mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); meshesOut.push(m);
        tris += gb.ni / 3; nm++;
      }
      yield;
    }
    group.userData.tris = tris; group.userData.styles = stats.styles; group.userData.ruins = ruinAt;
    if (!tile) { window.__bld = { tris, meshes: nm, stats, ms: performance.now() - tStart }; console.log('[buildings]', JSON.stringify(window.__bld)); }
  }
  yield* run();
  return group;
}

// An old-town street wall as a row of houses. Returns the houses (bays i0 to i1, their own look), the bays in all and where each starts along the wall (bts, as a share of the length).
// All of it comes from hashes of the wall's position, so a rebuilt tile gets the same houses, and the first house keeps what the building itself drew (colour, storeys), which is the whole wall when it is short.
const HGREY = new THREE.Color();
const HAB_P = [['full', .38], ['nob', .3], ['mix', .22], ['none', .1]], HAB_H = [['full', .18], ['nob', .2], ['mix', .34], ['none', .28]];   // balcony habit of a house, palazzi and plain houses
function oldHouses(E, B, S, len, nUp, Hu, nb0) {
  const { ax, az } = E, hu = (k, a, b) => hh(ax * a + k * 7.13 + 0.7, az * b + k * 3.31 + 1.9);
  const n = len < 15 ? 1 : Math.max(1, Math.round(len / (13 + 9 * hu(0, 0.61, 1.17)))), w = Array.from({ length: n }, (_, k) => 0.6 + 0.8 * hu(k, 1.31, 0.77)), ws = w.reduce((a, b) => a + b, 0);
  const h = [], bts = [0], of = []; let l0 = 0;
  for (let k = 0; k < n; k++) {
    const lk = len * w[k] / ws, bayK = (B.bayK || 1) * (k ? 0.88 + 0.26 * hu(k, 2.1, 1.9) : 1), nbk = n === 1 ? nb0 : Math.max(1, Math.round(lk / (S.bay * bayK))), i0 = bts.length - 1;
    let nU = nUp;
    if (k && nUp >= 2) { const q = hu(k, 0.53, 2.7), d = q < 0.25 ? 1 : q < 0.5 ? -1 : 0, fh = Hu / (nUp + d); if (d && fh > S.fh * 0.78 && fh < S.fh * 1.22) nU = nUp + d; }   // another storey count where the storey height stays in range
    let col = B.col, stone = B.stone, slab = B.slab;
    if (k) {
      if (B.houseCol) { const PL = B.townPal || OLD_PAL; col = PL[Math.floor(hu(k, 2.3, 0.9) * PL.length) % PL.length].clone().multiplyScalar(1.3 * (0.94 + 0.1 * hu(k, 1.1, 2.1)) * (1 - 0.2 * B.gr)); const l = (col.r + col.g + col.b) / 3; col.lerp(HGREY.setRGB(l, l, l), 0.24 + 0.28 * B.gr); }   // as the building's own colour was made (the plaster palette, a little greyed)
      else col = B.col.clone().multiplyScalar(0.9 + 0.2 * hu(k, 1.7, 1.3));
      stone = new THREE.Color(1, 1, 1).lerp(col, 0.3).multiplyScalar(1.15); slab = stone.clone().multiplyScalar(0.92);
    }
    let q = hu(k, 3.7, 0.41); const hab = (S.nobile ? HAB_P : B.habH || HAB_H).find(([, p]) => (q -= p) < 0);
    h.push({ k, i0, i1: i0 + nbk, nUp: nU, bw: lk / nbk, col, stone, slab, bal: hab ? hab[0] : 'mix', rail: hu(k, 0.7, 1.9) < 0.6 ? 'rail_b' : 'rail_a', dp: 0.62 + 0.3 * hu(k, 1.1, 0.5), cornK: 0.8 + 0.9 * hu(k, 0.9, 1.3) });
    for (let i = 0; i < nbk; i++) { of.push(k); bts.push((l0 + lk * (i + 1) / nbk) / len); }
    l0 += lk;
  }
  bts[bts.length - 1] = 1;
  return { h, nb: bts.length - 1, bts, of };
}
function calcFloors(S, Hw, lv, sp) {
  const g0 = sp && sp.g0 || S.g0;
  if (Hw < g0 * 1.2) return { g0: Hw, nUp: 0 };
  if (sp && sp.floors) return { g0, nUp: Math.max(1, sp.floors - 1) };
  let nUp = Math.max(1, Math.round((Hw - g0) / S.fh));
  if (lv > 1 && lv <= 16) { const f = (Hw - g0) / (lv - 1); if (f > S.fh * 0.7 && f < S.fh * 1.3) nUp = lv - 1; }
  return { g0, nUp };
}
const NOSPEC = {};
// Ground-floor variety (board item 2). The style's own table stays as the base (arches on the baroque fronts, pilotis on the housing), and what the street adds to it
// depends on the street the facade stands on: the market lanes get their open fronts (shutter up), the main commercial streets glazed shops, bars, a tabaccheria, a
// chemist, a bakery, the side streets portoni and the odd bottega, the minor lanes hardly anything. One list per style and kind of street, built once.
const MARKET_FRONT = /Ballar|Chiappara|Casa Professa|Maccheronai|Argenteria|Cassari|Materassai|Coltellieri|Chiavettieri|Garraffello|Caracciolo|Sant'Agostino|Beati Paoli|Cappuccinelle|Porta Carini/;
const SHOP_EXTRA = {
  market: { k: 0.2, sh: 0.3, add: [['g_mk_a', 3], ['g_mk_b', 2], ['g_mk_c', 1.6], ['g_bottega', 1.4], ['g_shop_o', 0.8], ['g_pane', 0.5], ['g_portone', 0.7], ['g_bar', 0.6]] },
  main: { k: 0.8, sh: 0.55, add: [['pw_shop', 1.6], ['g_bar', 1.5], ['g_tabacchi', 0.8], ['g_farm', 0.6], ['g_pane', 0.55], ['g_portone', 1.1], ['g_shop_o', 0.6]] },
  side: { k: 1, sh: 0.8, add: [['g_portone', 1.7], ['g_bar', 0.45], ['g_bottega', 0.7], ['g_pane', 0.35], ['g_tabacchi', 0.35], ['g_farm', 0.15]] },
  minor: { k: 1, add: [['g_portone', 0.7], ['g_bottega', 0.3]] },
};
const MIX_CACHE = new WeakMap();   // (weak: the old town's houses each have a style of their own, and a Map kept them all for good, a few MB more with every tile)
function groundMix(S, B) {
  if (S.church || S.ind || S.silo || S.ruin || S.noShops) return S.ground;
  const nm = B.sn || '', cl = B.sc || '';
  const ctx = MARKET_FRONT.test(nm) ? 'market' : MAIN_ST.test(nm) || cl === 'primary' || cl === 'secondary' || cl === 'tertiary' || cl === 'pedestrian' ? 'main' : cl === 'residential' || cl === 'living_street' || cl === 'unclassified' ? 'side' : 'minor';
  let m = MIX_CACHE.get(S); if (!m) MIX_CACHE.set(S, m = {});
  if (B.town) return m[ctx + 't'] || (m[ctx + 't'] = TOWN_GROUND[ctx]);
  if (B.old) return m[ctx + 'o'] || (m[ctx + 'o'] = [...S.ground.filter(([l]) => l === 'g_arch').map(([l, w]) => [l, w * .4]), ...OLD_GROUND[ctx]]);
  if (m[ctx]) return m[ctx];
  const E = SHOP_EXTRA[ctx];
  return m[ctx] = [...S.ground.map(([l, w]) => [l, w * E.k * (l === 'g_shop_s' || l === 'g_garage' ? (E.sh ?? 1) : 1)]), ...E.add];   // the shutters-down shops thin out: it is daytime
}
const GROUND_MODES = {
  shops: [['g_shop_s', 3], ['g_shop_o', 2]], arcade: [['g_arch', 1]], blind: [['blank_g', 3], ['g_win', 1]], rustic: [['g_rust_win', 1]],
};
const WIN_TILES = { // window type -> [upper tile(s), nobile tile]
  arch: (stone, sh) => [stone ? 'st_arch_up' : sh === 'b' ? 'arch_up_b' : 'arch_up_g', 'bar_nob_seg'],
  ped: () => ['ped_up', 'n19_nob'],
};
