// World streaming (?world=1): the whole of Palermo and Mondello, baked by tools/tiles.py into world/manifest.json and
// world/tiles/i_j.json (500 m tiles, same field names as PALERMO_DATA). Format and plan: docs/TILES.md.
//
// Rings around the camera, per tile ("lod"). One profile for every device (docs/PERF.md): only the render scale follows the screen.
//   2  full detail  (< rFull)  terrain at 10 m, all street layers + curbs, src/buildings.js facades, wall collision, road names,
//                              raised-ground mask for the car
//   1  low detail   (< rLow)   terrain at 20 m, asphalt/paving/sand/water, simple extruded buildings with one plain facade texture
//   0  far city                the far terrain (this file, from the manifest's coarse grid) plus the baked boxes of src/context.js
//                              (assets/world/far.bin, no tile download) out to the fog; tiles with terrain punch a hole in the far
//                              terrain, tiles with buildings hide their boxes. Every tile in range is always covered by one of the three.
// Everything heavy is a generator stepped by a per-frame time budget (update()), nearest tile first, so streaming never
// hitches; fetches are limited to a few at a time, nearest first; parsed tiles that leave the radius sit in a small LRU;
// a budget of resident triangles decides who gets what (updateWanted): the tile under the car first, then low detail everywhere in
// its ring, then full detail nearest first. Geometry is disposed when parts go; materials are shared.
// Build order and readiness follow the camera (markView): tiles the camera can see (its frustum plus a margin for turning, and everything
// close) are built before the rest of the ring, and visiblePending() counts what those tiles and the far city chunks in view still need,
// so the loading screen and the start transition lift as soon as the view is complete instead of waiting for the whole ring.
import * as THREE from 'three';
import { D, hooks, groundY, inNear, pairs, signedArea, inPoly, canvasTex } from './core.js';
import { streetsIter, roadMarksIter, TEX as GROUND_TEX, histW } from './streets.js';
import { buildBuildingsIter, warmBuildings } from './buildings.js';
import { applyDistrictHeights, zoneAt } from './districts.js';
import { treeGeo as makeTreeGeo } from './treegeo.js';
import { createFarCity } from './context.js';
import { createHills } from './hills.js';   // finer far mesh for the hill tiles (assets/world/hills.bin)
import { GARDEN_REGION as GR } from './gardens.js';
import { initFences, buildFences, dropFences } from './fences.js';   // walls and fences
import { initTrams, buildTram } from './trams.js';   // tram tracks, poles, platforms and the trams
import { initStructs, registerStructs, unregisterStructs, carve, levelY, carTick, setStructRoot, onTileFull, onTileDrop, tileCarved } from './bridges.js'; // bridges, viaducts, tunnels
import { pitchGround, pitchDepth } from './stadium-ground.js';
import { dumpGround, dumpSurf } from './discarica-ground.js';   // the pit and the pad of the landfill mission (src/discarica.js)
import { raveGround, raveSurf, raveWood, raveWoodTile } from './rave-ground.js';   // the dance floor of the rave in the woods of Monte Pellegrino and its track (src/rave.js)
import { treeCleared } from './tree-clear.js';
import { initQuays, registerQuays, unregisterQuays, carve as carveQuay, tileQuays, buildQuayMeshes, disposeQuayMeshes } from './quays.js';   // the harbour's quays (board item n10)
import { CENTRO_LANDMARKS } from './landmarks.js';   // the centro landmark models: built here, when the tiles under them have loaded

const T = 500;
const nk = (i, j) => (i + 200) * 1000 + (j + 200);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function inFlat(f, x, z) { let c = false; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const zi = f[i + 1], zj = f[j + 1]; if ((zi > z) !== (zj > z) && x < (f[j] - f[i]) * (z - zi) / (zj - zi) + f[i]) c = !c; } return c; }   // point in a flat [x, z, ...] ring, no allocation (roofAt)

// ---------- configuration (URL overrides for tuning: rfull, rlow, tricap) ----------
const Q = new URLSearchParams(location.search);
const CFG = {
  rFull: +Q.get('rfull') || 450,
  rLow: +Q.get('rlow') || 1400,
  guard: 150,                             // tiles this close to the camera always get full detail (walls and the raised-ground mask only exist there)
  hyst: 120,
  triCap: +Q.get("tricap") || 1.2e6,
  conc: 3,
  budgetMs: +Q.get('wbudget') || 2,
  hurryMs: +Q.get('whurry') || 12,        // per-frame build budget while a loading screen or the start transition covers the game (world.hurry)
  viewMargin: 80,                         // metres the camera frustum is widened by when deciding what is in view (the car may turn)
  viewNear: 220,                          // tiles this close to the focus count as in view whichever way the camera points
  keepData: 6,
  farFog: 1.25,                           // far boxes are built out to farFog / fog density metres (the fog hides what is beyond)
  base: (() => { const w = Q.get('worldurl'); try { const u = new URL(w, location.href); return w && (u.origin === location.origin || /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) ? w : 'world/'; } catch (e) { return 'world/'; } })(),   // a link must not make the game load a stranger's world (docs/SECURITY.md 6): this site or localhost only
};

// ---------- grids ----------
function gridSampler(g, h = Float32Array.from(g.h)) {
  const { x0, z0, s, nx, nz } = g;
  return (x, z) => {
    const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / s)), fz = Math.max(0, Math.min(nz - 1.001, (z - z0) / s));
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * nx + i;
    return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + nx] * (1 - tx) + h[k + nx + 1] * tx) * tz;
  };
}

// ---------- segment grid with per-tile removal (walls and street names) ----------
class SegGrid {
  constructor(cell) { this.cell = cell; this.m = new Map(); this.byTile = new Map(); }
  addSeg(tile, seg, x0, z0, x1, z1) {
    const c = this.cell; seg.t = tile;
    let keys = this.byTile.get(tile); if (!keys) this.byTile.set(tile, keys = new Set());
    for (let ix = Math.floor(Math.min(x0, x1) / c); ix <= Math.floor(Math.max(x0, x1) / c); ix++)
      for (let iz = Math.floor(Math.min(z0, z1) / c); iz <= Math.floor(Math.max(z0, z1) / c); iz++) {
        const k = ix * 100003 + iz; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(seg); keys.add(k);
      }
  }
  removeTile(tile) {
    const keys = this.byTile.get(tile); if (!keys) return;
    for (const k of keys) {
      const a = this.m.get(k); if (!a) continue;
      let w = 0; for (let r = 0; r < a.length; r++) if (a[r].t !== tile) a[w++] = a[r];
      if (w) a.length = w; else this.m.delete(k);
    }
    this.byTile.delete(tile);
  }
  query(x0, z0, x1, z1, fn) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) { const a = this.m.get(ix * 100003 + iz); if (a) for (const s of a) fn(s); }
  }
}

// ---------- terrain colours (same palette as the old far mesh in main.js) ----------
const C = {
  sand: new THREE.Color('#cdbb92'), plain: new THREE.Color('#9d9770'), grove: new THREE.Color('#8f8c5e'), scrub: new THREE.Color('#8d8458'),   // dry open ground: khaki, straw and olive, duller and darker than the sand it was (board item n5, outskirts round); only the irrigated greens below stay green
  rock: new THREE.Color('#c4b69e'), rockLo: new THREE.Color('#a69880'), shoulder: new THREE.Color('#8b8676'), cut: new THREE.Color('#8a7458'), urban: new THREE.Color('#9c968a'), garden: new THREE.Color('#76854c'), forest: new THREE.Color('#44603a'), green: new THREE.Color('#7a7a4a'),
  beach: new THREE.Color('#e4dbc2'), shore: new THREE.Color('#9d978a'), dry: new THREE.Color('#b5a26a'),
  farm: new THREE.Color('#b19b5d'), orchard: new THREE.Color('#78854c'), olive: new THREE.Color('#939a66'), cemetery: new THREE.Color('#98987a'), rail: new THREE.Color('#8c877c'),
  dirt: new THREE.Color('#a8967a'), pitch: new THREE.Color('#6d9b4f'), pave: new THREE.Color('#d9d2c2'), yard: new THREE.Color('#c4c0b4'),
};
// OSM land cover (tools/tiles.py areas[].k) that tints the terrain: colour, strength and priority (first match wins, lower = stronger claim)
const COVER = {
  sand: [C.beach, 0.92, 0], pitch: [C.pitch, 0.9, 1], rock: [C.rock, 0.9, 2], forest: [C.forest, 0.85, 3], orchard: [C.orchard, 0.8, 4], olive: [C.olive, 0.8, 4],
  green: [C.green, 0.85, 5], scrub: [C.scrub, 0.85, 6], cemetery: [C.cemetery, 0.7, 7], farm: [C.farm, 0.8, 8], dirt: [C.dirt, 0.85, 9],
  rail: [C.rail, 0.8, 10], grass: [C.dry, 0.8, 11],
};
const _c = new THREE.Color(), _r = new THREE.Color(), HAZE = new THREE.Color('#7297b4');
// h: ground height (m), slope: |gradient|, noise 0..1 (low frequency), n2 0..1 (a second, finer pattern), road 0..1 (how close to a carriageway the ground is, roadField below: the bench a road is cut into
// is a cut or a fill of earth and scrub, not limestone, wherever it is steep)
function terrainColor(out, h, slope, noise, n2 = 0.5, road = 0) {
  if (h < 1.6) { out.copy(C.shore).lerp(C.sand, 0.25 * noise); return out; } // rocky or built-up shore; beaches are OSM sand polygons
  const hill = smooth(55, 130, h), steep = smooth(0.14, 0.4, slope);
  // lowland: dry grass, straw and ochre patches; hills: khaki scrub with dry tan clearings (nothing here is lawn green: that is the OSM and Comune green set)
  out.copy(C.plain).lerp(C.grove, noise * 0.5).lerp(C.dry, n2 * 0.4);
  _r.copy(C.scrub).lerp(C.dry, n2 * 0.4).lerp(C.grove, noise * 0.2);
  out.lerp(_r, Math.max(hill, steep * 0.8));
  // limestone: grey-ochre, paler on the high ledges, with faint strata bands
  const rock = smooth(0.38, 0.85, slope) * (1 - 0.9 * road);
  if (rock > 0) {
    _r.copy(C.rockLo).lerp(C.rock, Math.min(1, 0.35 + noise * 0.5 + smooth(120, 420, h) * 0.3)).multiplyScalar(0.94 + 0.06 * Math.sin(h * 0.9));
    out.lerp(_r, rock);
  }
  return road > 0 ? cutBank(out, road, steep, noise) : out;
}
function cutBank(out, road, steep, noise) { _r.copy(C.cut).lerp(C.scrub, 0.2 + noise * 0.5); return out.lerp(_r, road * steep * 0.85); }   // the bank of a cut or a fill beside a carriageway: earth and scrub
// The ground away from the old city, graded: the orthophotos' summer colours (dirt, farmland, dry grass, bare scrub, boosted by the tile's own tint) read as pale ochre sand beside every outskirts road,
// where Mapillary shows scrub, dry grass and a hard shoulder, darker and greener (k 0 in the old city, half in the built-up tiles, 1 well out in the open; beaches, pitches, paved plazas, the villa quarters of Mondello and the shore are left alone)
function outskirtsGrade(c, k) { if (k > 0) { const l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; c.multiplyScalar(1 - 0.4 * k); c.r += (l * 0.86 - c.r) * 0.4 * k; c.g += (l * 1.04 - c.g) * 0.4 * k; c.b += (l * 0.76 - c.b) * 0.4 * k; } return c; }

// Terrain detail texture, triplanar on steep faces: the world-space (x, z) UVs smear along the fall line on cliffs (Monte Pellegrino), so
// once the slope passes ~45 degrees the detail is also projected on the x/y and z/y planes and blended in by the normal.
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: GROUND_TEX.terrain, vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  const k = (1 / GROUND_TEX.terrain.metres).toFixed(6);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.paveMap = { value: GROUND_TEX.balate }; sh.uniforms.yardMap = { value: GROUND_TEX.yard }; sh.uniforms.rkNoise = { value: ROCK_NOISE };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTpPos; varying vec3 vTpNrm; attribute float aPave; varying float vPave; attribute float aYard; varying float vYard; attribute float aRoad; varying float vRoad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTpPos = position; vTpNrm = normal; vPave = aPave; vYard = aYard; vRoad = aRoad;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nfloat hzFog = 1.0, hzRk = 1.0, dtL = 0.8; varying vec3 vTpPos; varying vec3 vTpNrm; varying float vPave, vYard, vRoad; uniform sampler2D paveMap, yardMap, rkNoise;' + TILING_GLSL).replace('#include <fog_fragment>', FOG_HZ)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        { // the detail texture repeats every 48 m, which reads as a regular grid on a hillside: a second sample, rotated and 3.2 times larger, multiplies it (the two periods never meet),
          // and two octaves of value noise (260 m and 90 m) vary the brightness of the ground like patches of drier and denser scrub
          vec2 uvB = vec2( 0.8387 * vMapUv.x - 0.5446 * vMapUv.y, 0.5446 * vMapUv.x + 0.8387 * vMapUv.y ) * 0.311 + vec2( 0.37, 0.61 );
          sampledDiffuseColor.rgb *= mix( vec3( 1.0 ), texture2D( map, uvB ).rgb * 1.2, 0.75 );
          sampledDiffuseColor.rgb *= ( 0.9 + 0.28 * tvn( vTpPos.xz / 260.0 ) ) * ( 0.95 + 0.12 * tvn( vTpPos.xz / 90.0 + 7.3 ) );
        }
        { float ny = abs( normalize( vTpNrm ).y ), side = 1.0 - smoothstep( 0.55, 0.85, ny );
          if ( side > 0.002 ) {
            vec3 an = abs( normalize( vTpNrm ) );
            vec4 tx = texture2D( map, vec2( vTpPos.z, vTpPos.y ) * ${k} ), tz = texture2D( map, vec2( vTpPos.x, vTpPos.y ) * ${k} );
            sampledDiffuseColor = mix( sampledDiffuseColor, mix( tz, tx, an.x / ( an.x + an.z + 1e-4 ) ), side );
          }
          // built-up ground the tile data has no paving polygon for (squares, courtyards, yards between blocks): worn limestone slabs, the same texture as the street paving layer
          if ( vPave > 0.01 ) sampledDiffuseColor = mix( sampledDiffuseColor, vec4( texture2D( paveMap, vTpPos.xz * ${(1 / GROUND_TEX.balate.metres).toFixed(6)} ).rgb * 1.25, 1.0 ), vPave * ( 1.0 - side ) );
          // the same kind of ground outside the historic centre (histW, src/streets.js): forecourts, lots and yards between the blocks are rough asphalt, dirt and weeds, not slabs; two samples at unrelated scales so the 12 m repeat does not show
          if ( vYard > 0.01 ) {
            vec2 yP = vTpPos.xz; vec3 y1 = texture2D( yardMap, yP * ${(1 / GROUND_TEX.yard.metres).toFixed(6)} ).rgb, y2 = texture2D( yardMap, vec2( 0.8387 * yP.x - 0.5446 * yP.y, 0.5446 * yP.x + 0.8387 * yP.y ) * 0.0331 + vec2( 0.4, 0.2 ) ).rgb;
            sampledDiffuseColor = mix( sampledDiffuseColor, vec4( y1 * mix( vec3( 1.0 ), y2 * 1.25, 0.6 ) * 2.3, 1.0 ), vYard * ( 1.0 - side ) );
          }
        }
        dtL = dot( sampledDiffuseColor.rgb, vec3( 0.3333 ) );
        diffuseColor *= sampledDiffuseColor;
      #endif`)
      .replace('#include <normal_fragment_begin>', NORMAL_NOFLIP() + FACET_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>' + ROCK_GLSL.replaceAll('HPOS', 'vTpPos').replaceAll('HDT', 'dtL').replaceAll('HNY', 'abs( normalize( vTpNrm ).y )').replaceAll('HROAD', 'vRoad') + HAZE_GLSL.replaceAll('HZPOS', 'vTpPos'))   // after the vertex colours, so the haze is not tinted by them
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${TERRAIN_FILL.toFixed(2)} * ( 1.0 - smoothstep( 0.25, 0.85, abs( normalize( vTpNrm ).y ) ) );`);   // t6: the same sky fill as the far terrain, so a shaded cliff is not a black wedge
  };
  m.customProgramCacheKey = () => 'terrain-triplanar-fill-haze-nf-tile-pave-yard-hz-rk-road';
  return m;
}

// ---------- low-detail facade: one plain tile, two bays by two floors ----------
let lowMats = null;
// The 100 m far terrain: smooth normals from the grid, so the steep faces of Monte Pellegrino that look away from the sun are lit by the sky alone and read as black wedges between the
// bright full-detail blocks (board item t6). A fill proportional to steepness (FAR_FILL times the surface colour on a vertical face of the far mesh, TERRAIN_FILL on the textured tile terrain, nothing on level ground) keeps the shade readable.
const FAR_FILL = 0.5, TERRAIN_FILL = 0.4;
// The tile skirts (a 30 m drop along every tile border, against cracks) are double-sided like the rest of the terrain, and three.js flips the normal of a back face, so a skirt seen
// from its back lit as a face pointing down and drew a dark line along the tile border. The terrain and far shaders light every face with its own vertex normal.
const TILING_GLSL = `
float tvh( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float tvn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( tvh( i ), tvh( i + vec2( 1.0, 0.0 ) ), f.x ), mix( tvh( i + vec2( 0.0, 1.0 ) ), tvh( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }`;
// Mountains as limestone (board item 4 of the Mondello round): on slopes steeper than about 25 degrees, above 40 m, the ground colour gives way to grey rock with horizontal strata
// (bands in height, bent by two noises) and dark green-brown scrub on the gentler part of the slope; level ground and anything below 40 m keep their own colour. On the steep part the
// normal is mixed with the face normal (derivatives), so the 25 m facets of the far mesh light as crags instead of a smooth ramp. rkC (0..1) is how much rock a fragment is.
const ROCK_GLSL = `
float rkY = HPOS.y, rkS = 1.0 - clamp( HNY, 0.0, 1.0 ), rkC = 0.0, rkB = 0.5, rkN = 0.5;
if ( rkY > 40.0 && rkS > 0.01 ) {
  float rkH = smoothstep( 40.0, 110.0, rkY ), rkW = smoothstep( 0.01, 0.06, rkS ) * rkH;   // 8 to 20 degrees: city streets stay as they are
  vec3 rkT = vec3( texture2D( rkNoise, HPOS.xz / ( 41.0 * 64.0 ) ).r, texture2D( rkNoise, HPOS.xz / ( 11.0 * 64.0 ) + 0.37 ).g, texture2D( rkNoise, HPOS.xz / ( 67.0 * 64.0 ) + 0.71 ).b );
  float n1 = rkT.r, n2 = rkT.g;
  float rkR = smoothstep( 0.2, 0.42, rkS + 0.1 * ( n1 - 0.5 ) );
  float rkRd = HROAD;   // 0 to 1: how close a carriageway is (roadField): the bank of a road bench is earth and scrub, not rock
  rkC = rkR * rkH * ( 1.0 - 0.7 * rkRd ); rkN = n2;
  float band = fract( rkY / 26.0 + n1 * 2.3 + n2 * 0.5 ); rkB = band;   // ledges: each layer darkens towards its foot and is lit on its top edge
  // warm limestone, golden to pink-ochre in the photos of the north-west cliffs and the A29 (grey and cream before): dark brown in the hollows, buff on the faces, vertical water streaks, faint ledges
  vec3 rock = mix( vec3( 0.20, 0.145, 0.105 ), vec3( 0.50, 0.375, 0.265 ), clamp( 0.45 + 0.4 * n2 + 0.15 * ( n1 - 0.5 ), 0.0, 1.0 ) ) * ( 1.0 + 0.5 * rkR * rkR * rkR * ( band - 0.5 ) * 0.22 );
  rock *= 0.8 + 0.36 * smoothstep( 0.25, 0.75, texture2D( rkNoise, vec2( ( HPOS.x + HPOS.z ) / ( 6.0 * 64.0 ), HPOS.y / ( 70.0 * 64.0 ) + 0.13 ) ).g );
  vec3 scrub = mix( vec3( 0.11, 0.13, 0.07 ), vec3( 0.26, 0.25, 0.14 ), clamp( n1 * 0.8 + n2 * 0.4, 0.0, 1.0 ) );
  rock = mix( rock, rock * vec3( 1.1, 0.92, 0.7 ), smoothstep( 0.45, 0.7, rkT.b ) * 0.6 );   // ochre patches
  rock = mix( rock, rock * vec3( 1.06, 0.86, 0.84 ), smoothstep( 0.4, 0.7, rkT.r ) * 0.45 );   // pink ones
  vec3 scree = vec3( 0.50, 0.45, 0.37 ) * ( 0.85 + 0.3 * n2 );
  scrub = mix( scrub, scree, smoothstep( 0.55, 0.8, n2 + 0.4 * ( rkS - 0.15 ) ) * smoothstep( 0.1, 0.2, rkS ) * ( 1.0 - rkRd ) );
  if ( rkRd > 0.01 ) {   // the cut: brown earth with a fringe of grass and broom, over the same slope
    vec3 cutE = mix( vec3( 0.12, 0.085, 0.052 ), vec3( 0.26, 0.19, 0.12 ), clamp( 0.45 + 0.7 * ( n2 - 0.5 ) + 0.4 * ( rkT.b - 0.5 ), 0.0, 1.0 ) );
    cutE = mix( cutE, scrub * 1.5, smoothstep( 0.5, 0.75, n1 ) * 0.7 );
    rock = mix( rock, cutE, rkRd * 0.92 ); scrub = mix( scrub, cutE, rkRd * 0.6 );
  }
  diffuseColor.rgb = mix( diffuseColor.rgb, mix( scrub, rock, rkR ) * ( 0.25 + 0.75 * clamp( HDT / 0.8, 0.0, 1.4 ) ), rkW );   // HDT: the detail texture's brightness (the tile terrain), so rock keeps its flecks and streaks up close
  hzRk = 1.0 - 0.8 * rkW;
}`;
const FACET_GLSL = `\nnormal = normalize( mix( normal, normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) ), 0.6 * rkC ) );\nnormal = normalize( normal + rkC * rkC * vec3( 0.6 * ( rkN - 0.5 ), 0.3 * ( rkB - 0.5 ), 0.0 ) );`;
// a 64 x 64 random texture (one channel per scale, bilinear and mipmapped, so the detail fades out with distance instead of shimmering) for ROCK_GLSL: three noise lookups cost less than the hashes they replace
const ROCK_NOISE = (() => { const d = new Uint8Array(64 * 64 * 4); let q = 12345; for (let i = 0; i < d.length; i++) { q = (q * 1664525 + 1013904223) >>> 0; d[i] = q >>> 24; } const t = new THREE.DataTexture(d, 64, 64, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; })();
const NORMAL_NOFLIP = () => THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0');
// Distant mountains read hazed blue #7297b4 (style guide section 6, board item n9): more with height and, now, with the real distance from the camera, in the shader of every
// terrain material (full detail, low detail ring and the far mesh), so a hill that is half in one and half in another has no seam and nothing is tinted up close.
// The vertex colours carry no haze any more. `pos` is a world position (the terrain meshes sit at the origin), the scene fog does the rest.
const HAZE_GLSL = `
float hzD = distance( cameraPosition, HZPOS ), hzY = HZPOS.y;
float hz = min( 0.78, ( 0.1 + 0.3 * smoothstep( 30.0, 260.0, hzY ) ) * smoothstep( 300.0, 2500.0, hzD ) + 0.34 * smoothstep( 2000.0, 8500.0, hzD ) * smoothstep( 10.0, 120.0, hzY ) ) * smoothstep( 1.0, 4.0, hzY ) * hzRk;
float hzK = smoothstep( 150.0, 400.0, hzY ) * smoothstep( 2500.0, 4500.0, hzD ) * ( 1.0 - smoothstep( 6000.0, 9500.0, hzD ) );   // tall ground far away (Monte Pellegrino from the seafront): the sun overexposed its pale limestone and the fog whitened it into the sky, so it drops to a darker silhouette with less fog on it
hzFog = 1.0 - 0.6 * hzK;
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ${HAZE.r.toFixed(5)}, ${HAZE.g.toFixed(5)}, ${HAZE.b.toFixed(5)} ), hz ) * ( 1.0 - 0.66 * hzK );`;
const FOG_HZ = THREE.ShaderChunk.fog_fragment.replace('vFogDepth * vFogDepth', 'vFogDepth * vFogDepth * hzFog * hzFog');   // the stock fog with its depth scaled by hzFog (set in HAZE_GLSL, 1 everywhere else)
function farMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rkNoise = { value: ROCK_NOISE };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFarNy; varying vec3 vFarPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFarNy = normal.y; vFarPos = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nfloat hzFog = 1.0, hzRk = 1.0; varying float vFarNy; varying vec3 vFarPos; uniform sampler2D rkNoise;').replace('#include <fog_fragment>', FOG_HZ)
      .replace('#include <normal_fragment_begin>', NORMAL_NOFLIP() + FACET_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>' + ROCK_GLSL.replaceAll('HPOS', 'vFarPos').replaceAll('HDT', '0.8').replaceAll('HNY', 'vFarNy').replaceAll('HROAD', '0.0') + HAZE_GLSL.replaceAll('HZPOS', 'vFarPos'))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${FAR_FILL.toFixed(2)} * ( 1.0 - smoothstep( 0.25, 0.85, vFarNy ) );`);
  };
  m.customProgramCacheKey = () => 'far-fill-haze-nf-hz-rk-road';
  return m;
}
function getLowMats() {
  if (lowMats) return lowMats;
  const tex = canvasTex(128, (g, S) => {
    g.fillStyle = '#efeadc'; g.fillRect(0, 0, S, S);
    for (let f = 0; f < 2; f++) for (let b = 0; b < 2; b++) {
      const x = b * S / 2 + S * 0.11, y = f * S / 2 + S * 0.1, w = S * 0.28, h = S * 0.3;
      g.fillStyle = '#d9d3c4'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = '#4b5560'; g.fillRect(x, y, w, h);
    }
    g.fillStyle = '#cfc9ba'; g.fillRect(0, S / 2 - 3, S, 3); g.fillRect(0, S - 3, S, 3);
  }, 7);
  tex.anisotropy = 2;
  lowMats = {
    wall: new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    terrain: terrainMaterial(),
    far: farMaterial(), // the coarse far grid has no uvs
  };
  return lowMats;
}
const PLASTER = ['#dccfb2', '#d2c2a2', '#c9b79c', '#d0b49c', '#c4a288', '#e0d5bd', '#c4ac88', '#d6c6a4', '#cfc3ab', '#d9c9a8'].map(c => new THREE.Color(c));
const _lr = new THREE.Color();
const ROOFS = ['#b4aa9c', '#a69d90', '#bdb4a4', '#9d958a'].map(c => new THREE.Color(c)), TERRACOTTA = new THREE.Color('#a8654c');

export function createWorld({ scene, camera, renderer, ctx, walls2d, streets, roadVerts, DRIVABLE }) {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const tiles = new Map(), cache = new Map(); // tiles: nk -> Tile; cache: parsed JSON of tiles that are not resident (LRU by insertion)
  const wallGrid = new SegGrid(16), nameGrid = new SegGrid(30);
  walls2d.ext = wallGrid; streets.ext = nameGrid;
  initStructs({ wallGrid, ground: (x, z) => tileGround(x, z) }); initQuays({ wallGrid }); setStructRoot(root); initFences({ wall: wallGrid, scene: root });
  let M = null, farM = () => 0, world = null, landPoly = null, farCity = null, farTask = null, wantedOnce = false, visPending = 1, farMissing = 0;
  let tasks = [], pending = [], inflight = 0;
  // City landmarks (src/landmarks-city.js, written by the landmarks work): CITY_LANDMARKS = [{ name, x, z, radius, skipIds, build(ctx) -> Object3D }].
  // Instantiated with the full-detail tile that contains (x, z), their skipIds left out of that tile's generic buildings, disposed with the tile.
  // per-tile hooks for the modules that live on full-detail tiles (traffic, pedestrians, props, road wear, minimap):
  // fn('full', t) once a tile is at full detail (t.i, t.j, t.k, t.data), fn('drop', t) just before it leaves full detail
  const tileFns = new Set(), fullSet = new Set();
  const emit = (kind, t) => { if (kind === 'full') { if (fullSet.has(t)) return; fullSet.add(t); } else if (!fullSet.delete(t)) return; for (const f of tileFns) { try { f(kind, t); } catch (e) { console.error('[world] tile hook', e); } } };
  let CITY = [];
  import('./landmarks-city.js').then(m => { CITY = m.CITY_LANDMARKS || []; PAVEZ = CITY.flatMap(l => (l.pave || []).map(pts => { const xs = pts.map(q => q[0]), zs = pts.map(q => q[1]); return { pts, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; })); }).catch(e => console.warn('city landmarks', e));
  let PAVEZ = [];   // ground polygons the landmarks ask to have paved (their `pave` lists)
  const cityIn = t => CITY.filter(l => Math.floor(l.x / T) === t.i && Math.floor(l.z / T) === t.j);
  let focus = { x: 0, z: 0 }, lastWanted = { x: 1e9, z: 1e9 }, wantedTimer = 0, forced = null;
  const stat = { frames: 0, work: 0, workMax: 0, workSum: 0, hitches: 0, fetched: 0, bytes: 0, built: 0, errors: 0, parseMax: 0 };

  // ---------- manifest and far terrain ----------
  const far = { chunks: new Map(), hidden: new Set(), holeVer: 0 };
  let hills = null, hillsVer = -1;
  const url = p => new URL(CFG.base + p, document.baseURI).href;

  fetch(url('manifest.json')).then(r => r.json()).then(m => {
    M = m;
    farM = gridSampler(M.far);
    hooks.bounds = [M.bbox[0], M.bbox[1], M.bbox[2], M.bbox[3]];
    hooks.ground = (x, z) => { const y = tileGround(x, z); return y === undefined ? y : dumpGround(x, z, raveGround(x, z, pitchGround(x, z, carveQuay(x, z, carve(x, z, y))))); }; // + the river trenches and tunnel cuttings (src/bridges.js), then the platform of the stadium's playing area (src/stadium-ground.js) and the dance floor of the rave (src/rave-ground.js), then the pad and the pit of the landfill (src/discarica-ground.js)
    hooks.level = levelY; hooks.fall = carTick;
    initTrams({ raised: (x, z) => raised(x, z), scene: root });   // after hooks.fall: the trams wrap it
    { const pts = pairs(M.land); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      landPoly = { pts, x0, z0, x1, z1, islands: (M.islands || []).map(pairs) }; }
    buildFar();
    hills = createHills({ root, url: new URL('assets/world/hills.bin', document.baseURI).href, mat: getLowMats().far, farM, colour: hillColour, free: m => freeAfterUpload(m, true) }); hills.load();
    farCity = createFarCity({ root, F: M.far, T, nk, url: new URL('assets/world/far.bin', document.baseURI).href, mat: getLowMats().roof, free: m => freeAfterUpload(m, true) });
    farCity.load().then(() => { wantedTimer = 99; }); // the budget needs the far triangle counts
    // warm the facade atlas in slices while the first tiles download
    const warm = warmBuildings(); tasks.push({ t: { pd: -1 }, gen: warm, wait: null, name: 'atlas' });
    wantedTimer = 99;
    world.manifest = M;
  }).catch(e => console.error('[world] manifest failed', e));

  // ground: loaded tile near grid, else the manifest far grid; the centro keeps its baked grid until its tile is in
  let lastG = null;
  function tileGround(x, z, pin) {   // pin: a tile that answers for its own closed box whether or not its neighbour has streamed in (see groundFor)
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastG;
    if (pin !== undefined && !pin.dead && x >= pin.i * T && x <= (pin.i + 1) * T && z >= pin.j * T && z <= (pin.j + 1) * T) t = pin;
    else if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined || t.dead) { t = null; } else lastG = t; }
    if (t !== null) {
      if (!t.nearS && !(t.data || t.lod)) return inNear(x, z) ? undefined : farM(x, z);
      const g = t.nearS ? t.nearS(x, z) : farM(x, z), sh = t.shape;
      if (sh === null) return g;
      // road-following terrain shaping (see computeShape): pull the ground towards the smoothed road bench inside the corridor
      const fx = (x - sh.x0) / sh.s, fz = (z - sh.z0) / sh.s;
      if (fx < 0 || fz < 0 || fx >= sh.nx - 1 || fz >= sh.nz - 1) return g;
      const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * sh.nx + i, n = sh.nx, W = sh.W, H = sh.WH;
      const w = (W[k] * (1 - tx) + W[k + 1] * tx) * (1 - tz) + (W[k + n] * (1 - tx) + W[k + n + 1] * tx) * tz;
      if (w <= 0) return g;
      const wh = (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + n] * (1 - tx) + H[k + n + 1] * tx) * tz;
      return g * (1 - w) + wh;
    }
    return inNear(x, z) ? undefined : farM(x, z);
  }
  // The ground as hooks.ground gives it, but a tile's own box answers from its own near grid: the bake makes neighbours agree on shared borders, so
  // the road a tile drapes along its edge is the same whether or not the neighbour has loaded (else it drapes on the coarse far grid, metres off).
  const groundFor = t => (x, z) => { const y = tileGround(x, z, t); return y === undefined ? groundY(x, z) : dumpGround(x, z, raveGround(x, z, pitchGround(x, z, carveQuay(x, z, carve(x, z, y))))); };

  // vertex colour of a fine hill node (src/hills.js): the same ground colours as the far grid, by height and slope
  function hillColour(col, k, x, y, z, dx, dz) {
    const noise = (Math.sin(x * 0.013 + z * 0.009) + Math.sin(x * 0.0037 - z * 0.013)) * 0.25 + 0.5, n2 = (Math.sin(x * 0.061 + z * 0.043) + Math.sin(x * 0.027 - z * 0.071 + 1.7)) * 0.25 + 0.5;
    terrainColor(_c, y, Math.hypot(dx, dz), noise, n2);
    col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
  }
  function buildFar() {
    const F = M.far, h = Float32Array.from(F.h), s = F.s;
    const CELLS = 40; // 8 tiles; tile edges land on cell edges because the grid origin and step are multiples of 100 m
    const H = (i, j) => h[Math.min(F.nz - 1, Math.max(0, j)) * F.nx + Math.min(F.nx - 1, Math.max(0, i))];
    const cs = Math.floor(F.x0 / (CELLS * s)), ce = Math.floor((F.x0 + (F.nx - 1) * s) / (CELLS * s));
    const rs = Math.floor(F.z0 / (CELLS * s)), re = Math.floor((F.z0 + (F.nz - 1) * s) / (CELLS * s));
    const mat = getLowMats().far;
    for (let a = cs; a <= ce; a++) for (let b = rs; b <= re; b++) {
      const ci0 = Math.max(0, Math.round((a * CELLS * s - F.x0) / s)), ci1 = Math.min(F.nx - 1, Math.round(((a + 1) * CELLS * s - F.x0) / s));
      const cj0 = Math.max(0, Math.round((b * CELLS * s - F.z0) / s)), cj1 = Math.min(F.nz - 1, Math.round(((b + 1) * CELLS * s - F.z0) / s));
      const vx = ci1 - ci0 + 1, vz = cj1 - cj0 + 1; if (vx < 2 || vz < 2) continue;
      const pos = new Float32Array(vx * vz * 3), nor = new Float32Array(vx * vz * 3), col = new Float32Array(vx * vz * 3);
      for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
        const gi = ci0 + i, gj = cj0 + j, k = (j * vx + i) * 3, y = H(gi, gj);
        pos[k] = F.x0 + gi * s; pos[k + 1] = y - 0.6; pos[k + 2] = F.z0 + gj * s;
        const dx = (H(gi + 1, gj) - H(gi - 1, gj)) / (2 * s), dz = (H(gi, gj + 1) - H(gi, gj - 1)) / (2 * s), l = Math.hypot(dx, 1, dz);
        nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        const noise = (Math.sin(gi * 1.7 + gj * 0.9) + Math.sin(gi * 0.37 - gj * 1.3)) * 0.25 + 0.5;
        terrainColor(_c, y, Math.hypot(dx, dz), noise);
        col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
      }
      const idx = new Uint16Array((vx - 1) * (vz - 1) * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(F.x0 + (ci0 + ci1) / 2 * s, 100, F.z0 + (cj0 + cj1) / 2 * s), Math.hypot(vx, vz) * s * 0.75 + 800);
      const mesh = new THREE.Mesh(geo, mat); mesh.name = 'far_' + a + '_' + b; mesh.receiveShadow = true;
      freeAfterUpload(mesh, true);
      root.add(mesh);
      far.chunks.set(a * 1000 + b, { mesh, idx, ci0, cj0, vx, vz, dirty: true });
    }
    farUpdate();
  }
  function farUpdate() {
    if (!M) return;
    const F = M.far, s = F.s;
    for (const c of far.chunks.values()) {
      if (!c.dirty) continue;
      c.dirty = false;
      let n = 0; const idx = c.idx;
      for (let j = 0; j < c.vz - 1; j++) for (let i = 0; i < c.vx - 1; i++) {
        const x = F.x0 + (c.ci0 + i) * s, z = F.z0 + (c.cj0 + j) * s;
        const tk = nk(Math.floor(x / T), Math.floor(z / T));
        if (far.hidden.has(tk) || (hills && hills.fine.has(tk))) continue;
        const k = j * c.vx + i;
        idx[n++] = k; idx[n++] = k + c.vx; idx[n++] = k + 1; idx[n++] = k + 1; idx[n++] = k + c.vx; idx[n++] = k + c.vx + 1;
      }
      c.mesh.geometry.setDrawRange(0, n);
      c.mesh.geometry.index.needsUpdate = true;
      c.mesh.visible = n > 0;
    }
  }
  function farHole(t, on) {
    const k = nk(t.i, t.j);
    if (on === far.hidden.has(k)) return;
    on ? far.hidden.add(k) : far.hidden.delete(k); far.holeVer++;
    const c = far.chunks.get(Math.floor(t.i / 8) * 1000 + Math.floor(t.j / 8)); if (c) c.dirty = true;
  }

  // ---------- tiles ----------
  function getTile(i, j) {
    const k = nk(i, j); let t = tiles.get(k);
    if (!t) {
      t = { i, j, k, id: i + '_' + j, cx: (i + 0.5) * T, cz: (j + 0.5) * T, meta: M.tiles[i + '_' + j], want: 0, lod: 0, d: 1e9, data: null, nearS: null, parts: {}, tris: {}, task: null,
        fetchP: null, fetchRes: null, failed: false, hasFull: false, vis: false, pd: 1e9, top: -1, raised: null, hard: undefined, shape: null, shaped: false, tint: null, dead: false, urban: 0 };
      tiles.set(k, t);
    }
    return t;
  }
  // Before a part is built its triangles are guessed from the manifest's building count (calibrated on the centro tiles); once built, the real number is used.
  const estimate = (t, lod) => {
    const b = t.meta ? t.meta.b : 0;
    const have = (n, f) => t.tris[n] !== undefined ? t.tris[n] : f;
    if (lod === 0) return farCity ? farCity.tris(t.k) : 0; // the baked boxes the tile shows while it has no buildings of its own
    const low = have('terrain', 1800) + have('streets', 2500 + b * 8) + have('bldLow', b * 45);
    return lod === 1 ? low : have('terrain', 5400) + have('streets', 2500 + b * 8) + have('streetsHi', 8000 + b * 40) + have('trees', 0) + have('bldFull', b * 230);
  };
  const triCount = t => { let n = 0; for (const k in t.tris) n += t.tris[k]; return n; };

  function disposeObj(o) {
    o.removeFromParent();
    o.traverse(c => { c.visible = false; if (c.geometry) c.geometry.dispose(); });   // (not visible: the static shadow job of src/engine-lean.js holds a list of meshes for a few frames, and drawing a disposed one uploads it again)
  }
  // The JavaScript copy of the geometry. Tile terrain, streets and buildings never change once built, and collisions, masks and the minimap read the tile data, not the meshes (the fences edit theirs, the camera reads the landmarks and bridges,
  // the instanced parts move: those keep their arrays). So a mesh's arrays go once it is on the GPU and the lean renderer has its boxes. Three.js would upload them again after a lost GL context: the tile is rebuilt then (contextRestored below).
  const FREE_PARTS = new Set(['terrain', 'streets', 'streetsHi', 'paint', 'tracks', 'bldLow']);
  const onGPU = [];   // meshes whose arrays are all uploaded
  function freeAfterUpload(o, keepIndex) {   // keepIndex: the far meshes rewrite their index as tiles come and go
    o.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh) return;
      const g = m.geometry, all = Object.values(g.attributes); if (g.index && !keepIndex) all.push(g.index);
      m.userData.keepIndex = keepIndex;
      let left = all.length;
      const up = () => { if (--left === 0) onGPU.push(m); };
      for (const a of all) { if (a.isInterleavedBufferAttribute) return; a.onUpload(up); }
    });
  }
  function freeStep() {
    for (let i = onGPU.length - 1; i >= 0; i--) {
      const m = onGPU[i], u = m.userData;
      const lean = hooks.occ && !m.matrixAutoUpdate && u.leanSub === undefined;   // src/engine-lean.js works out its boxes from the arrays of the frozen meshes (one it never takes as a leaf keeps them: after 20 s or so we stop asking)
      if (lean && (u.leanWait = (u.leanWait || 0) + 1) < 1200) continue;
      onGPU[i] = onGPU[onGPU.length - 1]; onGPU.pop();
      const g = m.geometry;
      if (lean) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingSphere) g.computeBoundingSphere();
      for (const k in g.attributes) g.attributes[k].array = null;
      if (g.index && !u.keepIndex) g.index.array = null;
      u.freed = true;
    }
  }
  function setPart(t, name, obj, tris) {
    const old = t.parts[name];
    if (old) disposeObj(old);
    if (obj && FREE_PARTS.has(name)) freeAfterUpload(obj);
    if (obj) {
      t.parts[name] = obj; t.tris[name] = tris !== undefined ? tris : (obj.userData.tris || 0);
      // nothing under the world root moves after it is placed (checked at the centro, the port, Mondello, the stadium: no matrix changed in 10 s of driving), so the matrices are
      // computed once here and the per-frame updateMatrixWorld walk skips them (it was 279 of 534 updates a frame at Quattro Canti)
      obj.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
      root.add(obj);
    }
    else { delete t.parts[name]; delete t.tris[name]; }
    if (name === 'terrain') farHole(t, !!obj);
    contextDirty = true;
  }

  // ---------- paving of built-up ground (board item 4) ----------
  // Where the tile data has no paving polygon, the terrain between blocks (a square, a courtyard, the yard of a housing estate) was drawn as the pale blotchy ground of the open country.
  // A 5 m field over the tile and 50 m beyond it (the neighbours' buildings count, so a tile border shows no seam) gives the distance to the nearest wall and how crowded the walls are
  // within 45 m; terrainMesh paves the ground that is both close to walls and in a built-up quarter, unless a land cover polygon (park, wood, sand, field) says otherwise.
  const PV_C = 5, PV_M = 50, PV_N = Math.round((T + 2 * PV_M) / PV_C) + 1;
  function paveField(t) {
    const x0 = t.i * T - PV_M, z0 = t.j * T - PV_M, n = PV_N, seed = new Uint8Array(n * n), seedR = new Uint8Array(n * n), x1 = x0 + (n - 1) * PV_C, z1 = z0 + (n - 1) * PV_C;   // seedR: the edges of the raised and paving polygons
    let any = 0;
    const mark = (ax, az, bx, bz, seed) => {
      const len = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(len / (PV_C * 0.5)));
      for (let q = 0; q <= k; q++) {
        const x = ax + (bx - ax) * q / k, z = az + (bz - az) * q / k, i = Math.round((x - x0) / PV_C), j = Math.round((z - z0) / PV_C);
        if (i >= 0 && j >= 0 && i < n && j < n) { seed[j * n + i] = 1; any++; }
      }
    };
    const ring = (p, sd = seed) => {
      const m = p.length >> 1; if (m < 3) return;
      let lx = 1e9, hx = -1e9, lz = 1e9, hz = -1e9;
      for (let q = 0; q < m; q++) { const x = p[2 * q], z = p[2 * q + 1]; if (x < lx) lx = x; if (x > hx) hx = x; if (z < lz) lz = z; if (z > hz) hz = z; }
      if (hx < x0 || lx > x1 || hz < z0 || lz > z1) return;
      for (let q = 0; q < m; q++) { const r = (q + 1) % m; mark(p[2 * q], p[2 * q + 1], p[2 * r], p[2 * r + 1], sd); }
    };
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const o = di === 0 && dj === 0 ? t : tiles.get(nk(t.i + di, t.j + dj)), d = (o && o.data) || cache.get(nk(t.i + di, t.j + dj));
      if (d && d.buildings) for (const b of d.buildings) { if (b.yb) continue; ring(b.p); if (b.holes) for (const h of b.holes) ring(h); }
      if (d && d.streets) for (const l of ['raised', 'paving']) for (const poly of d.streets[l] || []) ring(poly[0], seedR);
    }
    if (!any) return null;
    // distance to the nearest wall cell, and to the nearest edge of a pavement or square polygon (chamfer, metres)
    const D2 = PV_C * Math.SQRT2;
    const chamfer = (sd) => {
      const dist = new Float32Array(n * n).fill(1e4);
      for (let q = 0; q < n * n; q++) if (sd[q]) dist[q] = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const q = j * n + i; let v = dist[q];
        if (i > 0) v = Math.min(v, dist[q - 1] + PV_C); if (j > 0) { v = Math.min(v, dist[q - n] + PV_C); if (i > 0) v = Math.min(v, dist[q - n - 1] + D2); if (i < n - 1) v = Math.min(v, dist[q - n + 1] + D2); }
        dist[q] = v;
      }
      for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
        const q = j * n + i; let v = dist[q];
        if (i < n - 1) v = Math.min(v, dist[q + 1] + PV_C); if (j < n - 1) { v = Math.min(v, dist[q + n] + PV_C); if (i < n - 1) v = Math.min(v, dist[q + n + 1] + D2); if (i > 0) v = Math.min(v, dist[q + n - 1] + D2); }
        dist[q] = v;
      }
      return dist;
    };
    const dist = chamfer(seed), dr = chamfer(seedR);
    // crowding: share of the cells within 45 m that hold a wall (summed-area table)
    const S = new Int32Array((n + 1) * (n + 1)), dens = new Float32Array(n * n), R = 9;
    for (let j = 0; j < n; j++) { let row = 0; for (let i = 0; i < n; i++) { row += seed[j * n + i]; S[(j + 1) * (n + 1) + i + 1] = S[j * (n + 1) + i + 1] + row; } }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - R), b = Math.min(n, i + R + 1), c = Math.max(0, j - R), e = Math.min(n, j + R + 1);
      dens[j * n + i] = (S[e * (n + 1) + b] - S[c * (n + 1) + b] - S[e * (n + 1) + a] + S[c * (n + 1) + a]) / ((b - a) * (e - c));
    }
    return { x0, z0, n, dist, dens, dr };
  }
  const paveAt = (f, a, x, z) => {   // bilinear sample of one of the field arrays
    const fx = Math.min(f.n - 1.001, Math.max(0, (x - f.x0) / PV_C)), fz = Math.min(f.n - 1.001, Math.max(0, (z - f.z0) / PV_C)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, q = j * f.n + i;
    return (a[q] * (1 - tx) + a[q + 1] * tx) * (1 - tz) + (a[q + f.n] * (1 - tx) + a[q + f.n + 1] * tx) * tz;
  };

  // ---------- the ground beside a carriageway ----------
  // A 5 m field over the tile and 30 m beyond it: the distance (m) to the nearest drivable road centre line (bridges and tunnels do not count; the neighbours' roads do, so a tile border shows no seam).
  // terrainMesh paints the bank of a road bench as earth and scrub instead of limestone, and the first metres of flat ground beside the asphalt as a worn shoulder (photos of the outskirts: scrub,
  // dry grass and a hard shoulder up to the kerb, where the terrain was pale ochre limestone all the way).
  const RF_M = 30, RF_N = Math.round((T + 2 * RF_M) / PV_C) + 1;
  function roadField(t) {
    const x0 = t.i * T - RF_M, z0 = t.j * T - RF_M, n = RF_N, x1 = x0 + (n - 1) * PV_C, z1 = z0 + (n - 1) * PV_C, dist = new Float32Array(n * n).fill(1e4);
    let any = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const o = di === 0 && dj === 0 ? t : tiles.get(nk(t.i + di, t.j + dj)), d = (o && o.data) || cache.get(nk(t.i + di, t.j + dj));
      if (!d || !d.roads) continue;
      for (const r of d.roads) {
        if (r.tn || r.br || !DRIVABLE.has(r.k) || r.k === 'service' || !r.p) continue;
        const p = r.p;
        for (let q = 0; q + 3 < p.length; q += 2) {
          const ax = p[q], az = p[q + 1], bx = p[q + 2], bz = p[q + 3];
          if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(az, bz) < z0 || Math.min(az, bz) > z1) continue;
          const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (PV_C * 0.5)));
          for (let u = 0; u <= k; u++) { const i = Math.round((ax + (bx - ax) * u / k - x0) / PV_C), j = Math.round((az + (bz - az) * u / k - z0) / PV_C); if (i >= 0 && j >= 0 && i < n && j < n) { dist[j * n + i] = 0; any++; } }
        }
      }
    }
    if (!any) return null;
    const D2 = PV_C * Math.SQRT2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {   // chamfer, as paveField
      const q = j * n + i; let v = dist[q];
      if (i > 0) v = Math.min(v, dist[q - 1] + PV_C); if (j > 0) { v = Math.min(v, dist[q - n] + PV_C); if (i > 0) v = Math.min(v, dist[q - n - 1] + D2); if (i < n - 1) v = Math.min(v, dist[q - n + 1] + D2); }
      dist[q] = v;
    }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
      const q = j * n + i; let v = dist[q];
      if (i < n - 1) v = Math.min(v, dist[q + 1] + PV_C); if (j < n - 1) { v = Math.min(v, dist[q + n] + PV_C); if (i < n - 1) v = Math.min(v, dist[q + n + 1] + D2); if (i > 0) v = Math.min(v, dist[q + n - 1] + D2); }
      dist[q] = v;
    }
    return { x0, z0, n, dist };
  }
  const roadAt = (f, x, z) => {   // metres to the nearest road centre line (bilinear)
    if (!f) return 1e4;
    const fx = Math.min(f.n - 1.001, Math.max(0, (x - f.x0) / PV_C)), fz = Math.min(f.n - 1.001, Math.max(0, (z - f.z0) / PV_C)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, q = j * f.n + i, a = f.dist;
    return (a[q] * (1 - tx) + a[q + 1] * tx) * (1 - tz) + (a[q + f.n] * (1 - tx) + a[q + f.n + 1] * tx) * tz;
  };

  // how crowded with walls the ground is within 45 m (0 to 1), asked for by the street layers that may turn a wide pavement into a yard (src/streets.js); the field is built on the first question
  const densOf = t => { let f = null; return (x, z) => { f = f || paveField(t) || { n: 0 }; return f.n ? paveAt(f, f.dens, x, z) : 0; }; };

  // ---------- terrain mesh of a tile ----------
  function* terrainMesh(t, stride) {
    // cells follow the near grid (5 m where the bake carved a road bench into it, else 10 m), twice as coarse at low detail
    const tc = tileCarved(t.k), cell = tileQuays(t.k) ? Math.min(t.nearStep || 5, tc === 2 ? 2.5 : 5) : tc === 2 ? 2.5 : t.nearStep || (t.shape || tc ? 5 : 25), step = cell * stride, n = Math.round(T / step) + 1;   // (a river trench or tunnel cutting needs fine cells)
    const x0 = t.i * T, z0 = t.j * T, g = groundY;
    const nb = n * n, total = nb + 4 * n;   // the grid, then the skirt (below): one set of arrays, sized for both
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2), pav = new Float32Array(total), yar = new Float32Array(total), rda = new Float32Array(total), pvf = paveField(t), rdf = roadField(t);
    const tint = t.tint, urban = t.urban, UVS = 1 / GROUND_TEX.terrain.metres;
    const gtT = tintFn(t, 't');   // the orthophoto's ground colours, relative
    // Low detail cells cannot follow a road bench: on a steep hillside a coarse cell would cover the road for hundreds of metres (the
    // owner saw hidden roads under Monte Pellegrino). On benched tiles each low detail vertex drops to the lowest ground within 5 m,
    // so the terrain never rises above a road beside it; the notch this leaves is far below what is visible at that distance.
    const lowEnv = t.benched && stride > 1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step, z = z0 + j * step, k = (j * n + i) * 3;
        let y = g(x, z);
        if (lowEnv) for (let q = 0; q < 8; q++) { const a = q * 0.7853982, m = g(x + Math.cos(a) * 5, z + Math.sin(a) * 5); if (m < y) y = m; }
        const e = step;
        const dx = (g(x + e, z) - g(x - e, z)) / (2 * e), dz = (g(x, z + e) - g(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
        pos[k] = x; pos[k + 1] = y - 0.2; pos[k + 2] = z; nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        const noise = (Math.sin(x * 0.013 + z * 0.009) + Math.sin(x * 0.0037 - z * 0.013)) * 0.25 + 0.5;
        const n2 = (Math.sin(x * 0.061 + z * 0.043) + Math.sin(x * 0.027 - z * 0.071 + 1.7)) * 0.25 + 0.5, slope = Math.hypot(dx, dz);
        const road = rdf ? 1 - smooth(8, 26, roadAt(rdf, x, z)) : 0;
        rda[j * n + i] = road;
        terrainColor(_c, y, slope, noise, n2, road);
        if (urban > 0) _c.lerp(x > GR.x0 && x < GR.x1 && z > GR.z0 && z < GR.z1 ? C.garden : C.urban, urban); // the villa quarters of Mondello read green from afar (src/gardens.js)
        let covered = false, coverK = '';
        if (tint) for (const a of tint) {
          if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 || !inPoly(a.pts, x, z)) continue;
          covered = true;
          _c.lerp(a.col, a.s); // woods, scrub and lawns give way to bare limestone where the ground is steep (but not on a road bench: that is earth, see cutBank)
          if (a.cover !== 'sand' && slope > 0.45) { _r.copy(C.rockLo).lerp(C.rock, noise); _c.lerp(_r, smooth(0.45, 0.9, slope) * 0.8 * (1 - 0.9 * road)); if (road > 0) cutBank(_c, road, smooth(0.14, 0.4, slope), noise); }
          coverK = a.cover;
          break;
        }
        let zoned = false;
        for (const pz of PAVEZ) if (x > pz.x0 - step && x < pz.x1 + step && z > pz.z0 - step && z < pz.z1 + step && inPoly(pz.pts, x, z)) { zoned = true; break; }
        if (zoned) { pav[j * n + i] = 1; _c.lerp(C.pave, 0.9); }
        else if (pvf && !covered && y > 1.6 && !(x > GR.x0 && x < GR.x1 && z > GR.z0 && z < GR.z1)) {   // built-up ground with no paving polygon and no land cover over it
          const dw = paveAt(pvf, pvf.dist, x, z), dp = paveAt(pvf, pvf.dr, x, z);
          const w = (1 - smooth(28, 70, dw)) * smooth(0.06, 0.16, paveAt(pvf, pvf.dens, x, z)) * (1 - smooth(0.16, 0.34, slope)), h = histW(x, z);
          // the first 3 m of ground beside the edge of a pavement or square polygon with a wall near (the apron of a row of shops or garages) is part of that pavement wherever it is; open ground further out is not
          const sl = Math.max(h, (1 - smooth(2.5, 4.5, dp)) * (1 - smooth(5, 8, dw)));
          if (w * sl > 0.004) { pav[j * n + i] = w * sl; _c.lerp(C.pave, w * sl * 0.9); }   // old town, or a strip: stone slabs
          if (w * (1 - sl) > 0.004) { yar[j * n + i] = w * (1 - sl); _c.lerp(C.yard, Math.min(1, w * (1 - sl) * 1.15)); }   // elsewhere: a yard (see histW)
        }
        if (gtT) { const m = gtT(x, z); _c.r *= m.r; _c.g *= m.g; _c.b *= m.b; }
        if (y > 1.6 && coverK !== 'sand' && coverK !== 'pitch' && pav[j * n + i] < 0.3) {
          if (rdf) _c.lerp(C.shoulder, (1 - smooth(4.5, 10, roadAt(rdf, x, z))) * (1 - smooth(0.1, 0.35, slope)) * 0.55);   // worn hard shoulder beside the asphalt, on flat ground only
          outskirtsGrade(_c, (1 - histW(x, z)) * (x > GR.x0 && x < GR.x1 && z > GR.z0 && z < GR.z1 ? 0 : 1 - 0.5 * Math.min(1, urban / 0.8)));   // half as much in the built-up tiles (their yards and open lots were the same pale tan), none in the villa quarters of Mondello
        }
        col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
        const q = (j * n + i) * 2; uv[q] = x * UVS; uv[q + 1] = z * UVS;
      }
      if ((j & 1) === 1) yield;
    }
    // skirt: drop the border so cracks against neighbours (lidar vs coarse far grid, a low detail cell next to a full detail one) stay hidden.
    // On a cliff the two meshes of a tile border differ by more than the old 8 m, and the sky showed through as a bright blue sliver.
    const SKIRT = 30;
    const sk = new Int32Array(4 * n), at = (i, j) => (j * n + i);
    for (let i = 0, q = 0; i < n; i++) { sk[q++] = at(i, 0); sk[q++] = at(i, n - 1); sk[q++] = at(0, i); sk[q++] = at(n - 1, i); }
    for (let q = 0; q < sk.length; q++) { const v = sk[q], a = v * 3, b = (nb + q) * 3; pos[b] = pos[a]; pos[b + 1] = pos[a + 1] - SKIRT; pos[b + 2] = pos[a + 2]; nor[b] = nor[a]; nor[b + 1] = nor[a + 1]; nor[b + 2] = nor[a + 2]; col[b] = col[a]; col[b + 1] = col[a + 1]; col[b + 2] = col[a + 2]; uv[(nb + q) * 2] = uv[v * 2]; uv[(nb + q) * 2 + 1] = uv[v * 2 + 1]; pav[nb + q] = pav[v]; yar[nb + q] = yar[v]; rda[nb + q] = rda[v]; }
    const nIdx = (n - 1) * (n - 1) * 6 + (n - 1) * 24, idx = total < 65536 ? new Uint16Array(nIdx) : new Uint32Array(nIdx); let ii = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const k = j * n + i; idx[ii++] = k; idx[ii++] = k + n; idx[ii++] = k + 1; idx[ii++] = k + 1; idx[ii++] = k + n; idx[ii++] = k + n + 1; }
    // skirt quads, one strip per side (double-sided material, so winding does not matter)
    for (let i = 0; i < n - 1; i++) {
      const s0 = nb + i * 4, s1 = nb + (i + 1) * 4;
      for (let side = 0; side < 4; side++) { const a = sk[i * 4 + side], b = sk[(i + 1) * 4 + side], sa = s0 + side, sb = s1 + side; idx[ii++] = a; idx[ii++] = b; idx[ii++] = sa; idx[ii++] = b; idx[ii++] = sb; idx[ii++] = sa; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aPave', new THREE.BufferAttribute(pav, 1));
    geo.setAttribute('aYard', new THREE.BufferAttribute(yar, 1));
    geo.setAttribute('aRoad', new THREE.BufferAttribute(rda, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(geo, getLowMats().terrain); m.receiveShadow = true; m.name = 'terrain_' + t.id;
    m.userData.tris = idx.length / 3;
    return m;
  }

  // ---------- low-detail buildings: plain extrusions ----------
  function* lowBuildings(t) {
    const d = t.data, skip = ctx.skip;
    // typed from the start and grown by doubling (plain arrays by push were a fifth of all the garbage of a load)
    const roomF = (a, n) => { if (n <= a.length) return a; const b = new Float32Array(Math.max(n, a.length * 2)); b.set(a); return b; };
    let wp = new Float32Array(12288), wn = new Float32Array(12288), wc = new Float32Array(12288), wu = new Float32Array(8192), wi = new Uint32Array(6144), rp = new Float32Array(6144), rc = new Float32Array(6144);
    let nb = 0, wv = 0, rv = 0, nwi = 0;
    const solids = [];
    for (const b of d.buildings) {
      if (skip.has(b.id)) continue;
      if ((++nb & 15) === 0) yield;
      solids.length = 0;
      let sh = d.near ? 0 : -b.g; // survey heights (e): eave above the lowest ground under the building, see buildings.js
      if (b.e) { let lo = Infinity; for (let i = 0; i < b.p.length; i += 2) lo = Math.min(lo, groundY(b.p[i], b.p[i + 1])); sh = lo - b.g; }
      if (b.r === undefined) solids.push([b.p, null]);
      else if (!b.split) solids.push([b.p, b.r + sh]);
      else for (const [poly, rr] of b.parts || []) solids.push([poly, rr + sh]);
      for (const [flat, roofAbs] of solids) {
        const pts = pairs(flat); if (pts.length < 3) continue;
        let area = signedArea(pts); if (Math.abs(area) < 12) continue;
        if (area < 0) pts.reverse();
        const gs = pts.map(p => groundY(p[0], p[1]));
        let gmax = -1e9, gmin = 1e9; for (const y of gs) { gmax = Math.max(gmax, y); gmin = Math.min(gmin, y); }
        const roof = Math.max(roofAbs === null ? gmax + b.h : roofAbs, gmax + 2.5);
        const col = PLASTER[b.c % PLASTER.length], v = 0.92 + ((b.c >> 4) % 9) * 0.02;
        const cr = col.r * v, cg = col.g * v, cb = col.b * v;
        let acc = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], bb = pts[(i + 1) % pts.length], dx = bb[0] - a[0], dz = bb[1] - a[1], len = Math.hypot(dx, dz);
          if (len < 0.3) continue;
          const nx = dz / len, nz = -dx / len, ya = gs[i] - 0.6, yb = gs[(i + 1) % pts.length] - 0.6, base = Math.min(ya, yb);
          const u0 = acc / 7.2, u1 = (acc + len) / 7.2, v0a = (ya - base) / 6.6, v0b = (yb - base) / 6.6, vt = (roof - base) / 6.6;
          const o3 = wv * 3, o2 = wv * 2, n3 = o3 + 12;
          wp = roomF(wp, n3); wn = roomF(wn, n3); wc = roomF(wc, n3); wu = roomF(wu, o2 + 8);
          if (nwi + 6 > wi.length) { const w2 = new Uint32Array(wi.length * 2); w2.set(wi); wi = w2; }
          wp[o3] = a[0]; wp[o3 + 1] = ya; wp[o3 + 2] = a[1]; wp[o3 + 3] = bb[0]; wp[o3 + 4] = yb; wp[o3 + 5] = bb[1]; wp[o3 + 6] = bb[0]; wp[o3 + 7] = roof; wp[o3 + 8] = bb[1]; wp[o3 + 9] = a[0]; wp[o3 + 10] = roof; wp[o3 + 11] = a[1];
          for (let q = 0; q < 4; q++) { const o = o3 + q * 3; wn[o] = nx; wn[o + 1] = 0; wn[o + 2] = nz; wc[o] = cr; wc[o + 1] = cg; wc[o + 2] = cb; }
          wu[o2] = u0; wu[o2 + 1] = v0a; wu[o2 + 2] = u1; wu[o2 + 3] = v0b; wu[o2 + 4] = u1; wu[o2 + 5] = vt; wu[o2 + 6] = u0; wu[o2 + 7] = vt;
          wi[nwi++] = wv; wi[nwi++] = wv + 2; wi[nwi++] = wv + 1; wi[nwi++] = wv; wi[nwi++] = wv + 3; wi[nwi++] = wv + 2; wv += 4;
          acc += len;
        }
        try {
          const contour = pts.map(p => new THREE.Vector2(p[0], p[1])), tris = THREE.ShapeUtils.triangulateShape(contour, []);
          const rcol = b.rc ? _lr.set('#' + b.rc) : (roof - gmin < 9 && (b.c & 3) === 0) ? TERRACOTTA : ROOFS[b.c % ROOFS.length];   // b.rc: the orthophoto roof colour
          const rr = rcol.r * v, rg = rcol.g * v, rbl = rcol.b * v;
          rp = roomF(rp, (rv + tris.length * 3) * 3); rc = roomF(rc, (rv + tris.length * 3) * 3);
          for (const tr of tris) {
            const a = pts[tr[0]]; let bq = pts[tr[1]], c = pts[tr[2]];
            if ((bq[1] - a[1]) * (c[0] - a[0]) - (bq[0] - a[0]) * (c[1] - a[1]) < 0) { const q = bq; bq = c; c = q; }
            for (let q = 0; q < 3; q++) { const p = q === 0 ? a : q === 1 ? bq : c, o = rv++ * 3; rp[o] = p[0]; rp[o + 1] = roof; rp[o + 2] = p[1]; rc[o] = rr; rc[o + 1] = rg; rc[o + 2] = rbl; }
          }
        } catch (e) { /* skip broken ring */ }
      }
    }
    const g = new THREE.Group();
    const mk = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.matrixAutoUpdate = false; g.add(m); };
    if (nwi) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(wp.slice(0, wv * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(wn.slice(0, wv * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(wc.slice(0, wv * 3), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(wu.slice(0, wv * 2), 2));
      geo.setIndex(new THREE.BufferAttribute(wv < 65536 ? new Uint16Array(wi.subarray(0, nwi)) : wi.slice(0, nwi), 1));
      mk(geo, getLowMats().wall, 'low_walls');
    }
    yield;
    if (rv) {
      const geo = new THREE.BufferGeometry(), nor = new Float32Array(rv * 3), idx = rv < 65536 ? new Uint16Array(rv) : new Uint32Array(rv);
      for (let i = 0; i < rv; i++) { nor[i * 3 + 1] = 1; idx[i] = i; }
      geo.setAttribute('position', new THREE.BufferAttribute(rp.slice(0, rv * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(rc.slice(0, rv * 3), 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      mk(geo, getLowMats().roof, 'low_roofs');
    }
    g.userData.tris = (nwi + rv) / 3;
    return g;
  }

  // ---------- physics: wall segments, street names, road vertices (full-detail tiles only) ----------
  // Roofs, for the flying lapa (src/vehicle-air.js): per full-detail tile, the footprints with the height of their roof, in a 24 m grid (roofAt below).
  // The height is the one lowBuildings extrudes to; a wall segment carries it as seg.top, so a flying car clears a wall only above its roof.
  const RC = 24, rk = (ix, iz) => ix * 100003 + iz;
  function roofTops(b, d) {   // [[flat ring, top]] of one building: its roof elevation per solid
    let sh = d.near ? 0 : -b.g;
    if (b.e) { let lo = Infinity; for (let i = 0; i < b.p.length; i += 2) lo = Math.min(lo, groundY(b.p[i], b.p[i + 1])); sh = lo - b.g; }
    const solids = b.r === undefined ? [[b.p, null]] : !b.split ? [[b.p, b.r + sh]] : (b.parts || []).map(([poly, rr]) => [poly, rr + sh]), out = [];
    for (const [flat, roofAbs] of solids) {
      let gmax = -1e9; for (let i = 0; i < flat.length; i += 2) gmax = Math.max(gmax, groundY(flat[i], flat[i + 1]));
      out.push([flat, Math.max(roofAbs === null ? gmax + b.h : roofAbs, gmax + 2.5)]);
    }
    return out;
  }
  function* registerPhysics(t) {
    const d = t.data; let n = 0;
    const roofs = t.roofs = new Map(), tops = new Map();   // roofs: cell -> records; tops: building id -> highest roof
    const addRing = (flat, top) => {
      const p = pairs(flat);
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], seg = [a[0], a[1], b[0], b[1]]; seg.top = top; wallGrid.addSeg(t.k, seg, a[0], a[1], b[0], b[1]); }
    };
    // city landmarks may swap a footprint's walls for their own (the stadium's gate, the Politeama railing)
    const lms = cityIn(t).concat(CENTRO_LANDMARKS.filter(l => Math.floor(l.x / T) === t.i && Math.floor(l.z / T) === t.j)), drop = new Set(lms.flatMap(l => l.dropWalls || []));   // (the centro landmarks only bring walls: their models are built by lmJob)
    for (const b of d.buildings) {
      const rt = b.yb ? [] : roofTops(b, d);
      let top = -1e9; for (const [flat, h] of rt) {
        top = Math.max(top, h);
        let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < flat.length; i += 2) { x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i]); z0 = Math.min(z0, flat[i + 1]); z1 = Math.max(z1, flat[i + 1]); }
        const rec = { x0, z0, x1, z1, flat, holes: b.holes, h: h - 0.9 };   // 0.9: the parapet; a flat roof is walked on under it
        for (let ix = Math.floor(x0 / RC); ix <= Math.floor(x1 / RC); ix++) for (let iz = Math.floor(z0 / RC); iz <= Math.floor(z1 / RC); iz++) { const k = rk(ix, iz); let a = roofs.get(k); if (!a) roofs.set(k, a = []); a.push(rec); }
      }
      tops.set(b.id, top);
      if (drop.has(b.id) || b.yb) { if ((++n & 63) === 0) yield; continue; }
      addRing(b.p, top); if (b.holes) b.holes.forEach(h => addRing(h, top)); if ((++n & 63) === 0) yield;
    }
    for (const l of lms) { let top = -1e9; for (const id of l.dropWalls || []) top = Math.max(top, tops.get(id) ?? -1e9); for (const w of l.walls || []) { w.top = top > -1e9 ? top : groundY(w[0], w[1]) + 25; wallGrid.addSeg(t.k, w, w[0], w[1], w[2], w[3]); } }
    for (const r of d.roads) {
      const p = pairs(r.p);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (r.n) nameGrid.addSeg(t.k, [a[0], a[1], b[0], b[1], r.n, r.w], a[0], a[1], b[0], b[1]);
        if (DRIVABLE.has(r.k) || r.k === 'track') { const v = [a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])]; v.t = t.k; roadVerts.push(v); }
      }
    }
    t.phys = true;
  }
  function unregisterPhysics(t) {
    if (!t.phys) return;
    t.roofs = null;
    wallGrid.removeTile(t.k); nameGrid.removeTile(t.k);
    let w = 0; for (let r = 0; r < roadVerts.length; r++) if (roadVerts[r].t !== t.k) roadVerts[w++] = roadVerts[r];
    roadVerts.length = w;
    t.phys = false;
  }

  // ---------- surface masks: raised ground (sidewalks, grass: the car bumps up onto them) and hard ground (asphalt, paving, raised) ----------
  // 0.5 m cells, bit-packed, drawn band by band into one canvas: raised+green in the red channel, asphalt+paving+raised in green.
  // Anything not hard (park ground, dirt, hillside) is off-road for drivePlayer().
  const RK = 2, RW = T * RK, BAND = 50;
  let rcv = null, rg = null;
  function* buildRaised(t) {
    const st = t.data.streets, ext = poly => { let lo = 1e9, hi = -1e9; const r0 = poly[0]; for (let i = 1; i < r0.length; i += 2) { lo = Math.min(lo, r0[i]); hi = Math.max(hi, r0[i]); } return [lo, hi]; };
    const x0 = t.i * T, z0 = t.j * T, info = [];
    for (const [layers, col] of [[['raised', 'median', 'green'], '#f00'], [['asphalt', 'paving', 'raised', 'median', 'verge'], '#0f0'], [['sand'], '#00f']])
      for (const l of layers) for (const poly of st[l] || []) { const [lo, hi] = ext(poly); info.push({ poly, col, lo: (lo - z0) * RK, hi: (hi - z0) * RK }); }
    if (!info.length) { t.raised = null; t.hard = null; t.sandb = null; buildGravel(t); return; }
    if (!rcv) { rcv = document.createElement('canvas'); rcv.width = RW; rcv.height = BAND; rg = rcv.getContext('2d', { willReadFrequently: true }); }
    const bitsR = new Uint8Array(RW * RW / 8), bitsH = new Uint8Array(RW * RW / 8);
    let bitsS = null;   // e6: beach sand, the third channel (null while the tile has none)
    if ((st.sand || []).length) bitsS = new Uint8Array(RW * RW / 8);
    for (let band = 0; band < RW / BAND; band++) {
      const y0 = band * BAND;
      rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'source-over'; rg.fillStyle = '#000'; rg.fillRect(0, 0, RW, BAND);
      rg.globalCompositeOperation = 'lighter';
      for (const { poly, col, lo, hi } of info) {
        if (hi < y0 || lo > y0 + BAND) continue;
        rg.fillStyle = col; rg.beginPath();
        for (const ring of poly) for (let i = 0; i < ring.length; i += 2) rg[i ? 'lineTo' : 'moveTo']((ring[i] - x0) * RK, (ring[i + 1] - z0) * RK - y0);
        rg.fill('evenodd');
      }
      const img = rg.getImageData(0, 0, RW, BAND).data, px = new Uint32Array(img.buffer, img.byteOffset, RW * BAND), base = band * BAND * RW;
      for (let q = 0, n = RW * BAND; q < n; q++) {
        if (px[q] === 0xff000000) continue; // opaque black: neither mask (little-endian RGBA)
        const b = base + q, o = q * 4;
        if (img[o] > 127) bitsR[b >> 3] |= 1 << (b & 7);
        if (img[o + 1] > 127) bitsH[b >> 3] |= 1 << (b & 7);
        if (bitsS && img[o + 2] > 127) bitsS[b >> 3] |= 1 << (b & 7);
      }
      yield;
    }
    t.raised = bitsR; t.hard = bitsH; t.sandb = bitsS;
    buildGravel(t);
  }
  let lastR = null;
  function maskAt(x, z, which) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    let t = lastR;
    if (t === null || t.i !== i || t.j !== j || t.dead) { t = tiles.get(nk(i, j)); if (t === undefined) return undefined; lastR = t; }
    const bits = t[which]; if (bits === null || bits === undefined) return bits === null ? false : undefined;
    const b = (((z - j * T) * RK) | 0) * RW + (((x - i * T) * RK) | 0);
    return (bits[b >> 3] >> (b & 7) & 1) === 1;
  }
  const raised = (x, z) => maskAt(x, z, 'raised') === true || pitchDepth(x, z) > 0 || raveSurf(x, z) >= 0;   // the stadium's playing area counts as raised ground: the lapa stands on the track and the pitch like on a pavement (src/stadium-ground.js); so do the dance floor of the rave and its track, drawn over the forest floor (src/rave-ground.js)

  // ---------- e6: what the lapa drives on ----------
  // Tracks and the paths of the parks and the hills are gravel and dirt even where the street layers paint them as paving; the beach is sand; the lawns are grass;
  // anything else that is not surfaced (scrub, hillside, fields) is rough ground. Each has its own grip, drag and bumpiness (SURF below); asphalt, paving, pavements and
  // verges are hard ground as before. car.surf says which (0 hard, 1 gravel, 2 grass, 3 sand, 4 rough) for the sound and the effects.
  const GRAVEL_K = new Set(['track', 'path', 'footway', 'cycleway', 'bridleway']);
  function buildGravel(t) {
    t.gsegs = null;
    const roads = t.data && t.data.roads; if (!roads) return;
    const cand = roads.filter(r => GRAVEL_K.has(r.k) && !r.tn && !r.br); if (!cand.length) return;
    const C = 12, cell = (x, z) => Math.floor(x / C) * 100003 + Math.floor(z / C), road = new Map(), bld = new Map();
    for (const r of roads) {   // samples of the streets (a footway beside one is its pavement) and the building centres (a footway among houses is a town alley)
      if (r.tn || r.br || !(DRIVABLE.has(r.k))) continue;
      const p = r.p;
      for (let q = 0; q + 3 < p.length; q += 2) {
        const dx = p[q + 2] - p[q], dz = p[q + 3] - p[q + 1], n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 6));
        for (let k = 0; k <= n; k++) { const x = p[q] + dx * k / n, z = p[q + 1] + dz * k / n, ck = cell(x, z); let a = road.get(ck); if (!a) road.set(ck, a = []); a.push(x, z); }
      }
    }
    for (const b of t.data.buildings || []) { const p = b.p, x = p[0], z = p[1], ck = cell(x, z); let a = bld.get(ck); if (!a) bld.set(ck, a = []); a.push(x, z); }
    const within = (m, x, z, d) => {
      const ci = Math.floor(x / C), cj = Math.floor(z / C);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = m.get((ci + a) * 100003 + (cj + b)); if (l) for (let q = 0; q < l.length; q += 2) if (Math.hypot(l[q] - x, l[q + 1] - z) < d) return true; }
      return false;
    };
    const segs = [];
    for (const r of cand) {
      const p = r.p, w = (r.k === 'track' ? 3.5 : 2.4) / 2 + 0.9;
      for (let q = 0; q + 3 < p.length; q += 2) {
        const mx = (p[q] + p[q + 2]) / 2, mz = (p[q + 1] + p[q + 3]) / 2;
        if (r.k !== 'track' && (within(road, mx, mz, 9) || within(bld, mx, mz, 28))) continue;
        segs.push([p[q], p[q + 1], p[q + 2], p[q + 3], w, Math.min(p[q], p[q + 2]) - w, Math.min(p[q + 1], p[q + 3]) - w, Math.max(p[q], p[q + 2]) + w, Math.max(p[q + 1], p[q + 3]) + w]);
      }
    }
    t.gsegs = segs.length ? segs : null;
  }
  function onGravel(t, x, z) {
    const g = t.gsegs; if (!g) return false;
    for (let i = 0; i < g.length; i++) {
      const s = g[i]; if (x < s[5] || x > s[7] || z < s[6] || z > s[8]) continue;
      const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz, u = l2 > 0 ? Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)) : 0;
      if (Math.hypot(x - s[0] - dx * u, z - s[1] - dz * u) < s[4]) return true;
    }
    return false;
  }
  // [grip lost (0..1, as a pothole does), drag (1/s), bump size, bump spacing (m)]
  const SURF = [null, [0.22, 0.06, 0.35, 2.2], [0.38, 0.14, 0.8, 1.6], [0.7, 0.55, 0.3, 2.6], [0.5, 0.2, 1.2, 1.4]];
  let bumpPhase = 0;
  function surfaceAt(x, z, deck) {
    const rv = raveSurf(x, z); if (rv >= 0) return rv;   // the dance floor of the rave and its track (src/rave-ground.js)
    const dv = dumpSurf(x, z); if (dv >= 0) return dv;   // the pad, the track and the pit of the landfill (src/discarica-ground.js)
    const hard = maskAt(x, z, 'hard');
    const i = Math.floor(x / T), j = Math.floor(z / T), t = tiles.get(nk(i, j));
    if (t && t.gsegs && onGravel(t, x, z)) return 1;
    if (hard !== false || deck) return 0;
    // seams in the street polygons (a few tenths of a metre, along hairpins and tile borders) are not off-road: hard ground within a metre counts
    if (maskAt(x + 0.9, z, 'hard') === true || maskAt(x - 0.9, z, 'hard') === true || maskAt(x, z + 0.9, 'hard') === true || maskAt(x, z - 0.9, 'hard') === true) return 0;
    if (maskAt(x, z, 'sandb') === true) return 3;
    if (maskAt(x, z, 'raised') === true) return 2;
    return 4;
  }
  // Called every physics step: grip, a bumpy ride and drag by what is under the car.
  function drivePlayer(car, dt) {
    const sf = surfaceAt(car.x, car.z, car.deck); car.surf = sf;
    if (!sf) return;
    const v = Math.hypot(car.vx, car.vz);
    if (v < 1.5) return;
    const S = SURF[sf];
    car.gripLoss = Math.max(car.gripLoss || 0, S[0]);
    bumpPhase += v * dt;
    if (bumpPhase > S[3]) { bumpPhase = 0; car.hopV = Math.min(2.2, (car.hopV || 0) + (0.45 + 1.0 * Math.random() * Math.min(1, v / 12)) * S[2]); }
    const k = Math.exp(-S[1] * dt); car.vx *= k; car.vz *= k;
  }

  // ---------- road-following terrain shaping ----------
  // The ground under hill roads comes from a 100 m far grid (Monte Pellegrino has no usable lidar), which cannot follow a switchback. For
  // every drivable road on hilly or lidar-less tiles we sample a blurred copy of the ground along the centreline, and carve a level bench
  // at that height: full weight across the carriageway, easing back to the raw ground over SHAPE_EASE metres. The result is a pair of
  // grids (weight, weight*height) that tileGround() mixes in, so streets, curbs, props, buildings, the car and the terrain mesh all agree.
  // The target height depends only on position, so it is continuous across tile borders.
  const SHAPE_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'track']);
  const SHAPE_EASE = 11, SHAPE_S = 2;
  function* computeShape(t) {
    if (t.shaped) return;
    t.shaped = true;
    const roads = t.data.roads.filter(r => SHAPE_ROADS.has(r.k) && !r.tn && !r.br);
    if (!roads.length) return;
    // unshaped ground at any position, from whichever tile owns it (a tile's own grid clamps at its edge, which would put a step in the bench at tile borders)
    const base = (x, z) => { const o = tiles.get(nk(Math.floor(x / T), Math.floor(z / T))); return o && o.nearS ? o.nearS(x, z) : farM(x, z); };
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const y = base(t.i * T + i * T / 8, t.j * T + j * T / 8); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (t.nearS || hi - lo < 12) return; // near grids carry the bench baked by tools/tiles.py; only tiles without one are shaped here
    const blur = (x, z) => {
      let sum = base(x, z), n = 1;
      for (const r of [20, 45]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; sum += base(x + Math.cos(a) * r, z + Math.sin(a) * r); n++; }
      return sum / n;
    };
    let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
    const R = r => Math.max(r.w, 3) / 2 + 1.5 + SHAPE_EASE;
    for (const r of roads) for (let i = 0; i < r.p.length; i += 2) { const e = R(r); bx0 = Math.min(bx0, r.p[i] - e); bx1 = Math.max(bx1, r.p[i] + e); bz0 = Math.min(bz0, r.p[i + 1] - e); bz1 = Math.max(bz1, r.p[i + 1] + e); }
    bx0 = Math.max(bx0, t.i * T - 2); bz0 = Math.max(bz0, t.j * T - 2); bx1 = Math.min(bx1, (t.i + 1) * T + 2); bz1 = Math.min(bz1, (t.j + 1) * T + 2);
    const s = SHAPE_S, x0 = Math.floor(bx0 / s) * s, z0 = Math.floor(bz0 / s) * s, nx = Math.ceil((bx1 - x0) / s) + 2, nz = Math.ceil((bz1 - z0) / s) + 2;
    if (nx < 3 || nz < 3) return;
    const W = new Float32Array(nx * nz), WH = new Float32Array(nx * nz), best = new Float32Array(nx * nz).fill(1e9);
    let nr = 0;
    for (const r of roads) {
      const half = Math.max(r.w, 3) / 2, flat = half + 1.5, reach = R(r), p = pairs(r.p);
      // resample every ~3 m, with the blurred height at each sample
      const pts = [];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
        for (let k = i === 0 ? 0 : 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; pts.push([x, z, blur(x, z)]); if ((pts.length & 31) === 0) yield; }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
        const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - x0) / s)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0]) + reach - x0) / s));
        const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - z0) / s)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[1], b[1]) + reach - z0) / s));
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
          const px = x0 + ii * s, pz = z0 + j * s, tt = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
          const d = Math.hypot(px - a[0] - dx * tt, pz - a[1] - dz * tt);
          if (d >= reach) continue;
          const c = j * nx + ii; if (d >= best[c]) continue;
          const e = d <= flat ? 1 : 1 - smooth(flat, reach, d);
          best[c] = d; W[c] = e; WH[c] = e * (a[2] + (b[2] - a[2]) * tt);
        }
        if ((++nr & 15) === 0) yield;
      }
    }
    t.shape = { x0, z0, s, nx, nz, W, WH };
  }

  // ---------- dirt tracks (highway=track, when the bake has them): a narrow strip of packed earth along the centreline ----------
  // (lifted just above the park grass layer, streets.js green = CURB + 0.01 with polygon offset -5, or tracks in parks would be buried). Textured with the verge's dust and grit (a flat #a48c66 band, as wide as a road,
  // was the tan stripe beside 12 of the 45 south-east viewpoints), narrower than the mapped width, and left out where the street layers already cover the ground (the hard mask: asphalt, paving, pavements).
  const TRACK_COL = new THREE.Color().setRGB(1.2, 0.95, 0.68);   // a tint over the verge texture (dusty grey-brown): packed earth, a little warmer than the verges
  let trackMat = null;
  function* buildTracks(t) {
    const roads = t.data.roads.filter(r => r.k === 'track'); if (!roads.length) return null;
    const P = [], N = [], Cc = [], UV = [], I = [], M = GROUND_TEX.verge.metres;
    for (const r of roads) {
      const p = pairs(r.p), hw = Math.max(r.w || 3.5, 2.2) * 0.34;
      let prev = -1;   // index of the last pair of vertices of the current run (a run ends where a street layer covers the track)
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
        if (maskAt(p[i][0], p[i][1], 'hard') === true || maskAt(p[i][0] + tz * 2.5, p[i][1] - tx * 2.5, 'hard') === true || maskAt(p[i][0] - tz * 2.5, p[i][1] + tx * 2.5, 'hard') === true) { prev = -1; continue; }
        const lx = p[i][0] + tz * hw, lz = p[i][1] - tx * hw, rx = p[i][0] - tz * hw, rz = p[i][1] + tx * hw, v = P.length / 3;
        P.push(lx, groundY(lx, lz) + 0.17, lz, rx, groundY(rx, rz) + 0.17, rz); N.push(0, 1, 0, 0, 1, 0);
        UV.push(lx / M, lz / M, rx / M, rz / M);
        const k = 0.88 + 0.12 * Math.sin(i * 1.7 + p[i][0] * 0.05); Cc.push(TRACK_COL.r * k, TRACK_COL.g * k, TRACK_COL.b * k, TRACK_COL.r * k, TRACK_COL.g * k, TRACK_COL.b * k);
        if (prev >= 0) I.push(prev, prev + 1, v, prev + 1, v + 1, v);   // strip quads: vertices come in left/right pairs along each run (wound counter-clockwise seen from above)
        prev = v;
      }
    }
    if (!I.length) return null;
    yield;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UV), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1));
    trackMat = trackMat || new THREE.MeshStandardMaterial({ map: GROUND_TEX.verge, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    const m = new THREE.Mesh(geo, trackMat); m.receiveShadow = true; m.name = 'tracks';
    const g = new THREE.Group(); g.add(m); g.userData.tris = I.length / 3;
    return g;
  }

  // ---------- trees: cheap instanced pines in forest areas, a few in parks (full-detail tiles only) ----------
  // n4: the woods are Aleppo pines (light olive, irregular) with stone pines (dark umbrellas) among them, mostly in the Favorita and at Mondello (src/treegeo.js); one instanced mesh each
  const STONE_SHARE = { favorita: 0.22, mondello: 0.4, valdesi: 0.4, lido: 0.4, sferra: 0.25 }, HOLM_SHARE = { favorita: 0.45 };   // the Favorita is mostly holm oak and the other dark broadleaves, with stone and Aleppo pines among them (src/species.js MIX.favorita)
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });   // (the leaf sprays of src/treegeo.js are open sheets)
  const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  function* buildTrees(t) {
    const d = t.data, areas = (d.areas || []).filter(a => a.k === 'forest' || a.k === 'green').map(a => {
      const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { pts, x0, z0, x1, z1, p: a.k === 'forest' ? 0.72 : Math.min(x1 - x0, z1 - z0) > 400 ? 0.36 : 0 }; // only a really big park (the Favorita) is a wood; the town parks (Foro Italico, the villas) get their trees from src/props.js, by species (n4)
    });
    if (!areas.length) return null;
    // building footprints (bbox grid), so no tree grows through a house
    const BC = 30, bg = new Map();
    for (const b of d.buildings) {
      const pts = pairs(b.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      const e = { pts, x0, z0, x1, z1 };
      for (let cx = Math.floor(x0 / BC); cx <= Math.floor(x1 / BC); cx++) for (let cz = Math.floor(z0 / BC); cz <= Math.floor(z1 / BC); cz++) { const k = cx * 100003 + cz; let l = bg.get(k); if (!l) bg.set(k, l = []); l.push(e); }
    }
    const inBld = (x, z) => { const l = bg.get(Math.floor(x / BC) * 100003 + Math.floor(z / BC)); if (!l) return false; for (const e of l) if (x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1 && inPoly(e.pts, x, z)) return true; return false; };
    const SP = 14, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const mats = [], cols = [], smats = [], scols = [], hmats = [], hcols = [], rows = { holm: [[], []], holm_b: [[], []], stone: [[], []], aleppo: [[], []] }, MAX = 1400, nTrees = () => mats.length + smats.length + hmats.length + rows.holm[0].length + rows.holm_b[0].length + rows.stone[0].length + rows.aleppo[0].length;
    // The wood closes over its roads (Viale Diana: a tunnel of oaks): a tree every 7 to 9 m on both sides of a road that runs through a wood, big enough for the crowns to meet over the carriageway. The trunks stay 2.2 m clear of the asphalt.
    const wooded = (x, z) => { for (const a of areas) if (a.p > 0 && x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && inPoly(a.pts, x, z)) return true; return false; };
    for (const r of d.roads || []) {
      if (r.k !== 'tertiary' && r.k !== 'secondary' && r.k !== 'primary' && r.k !== 'unclassified' && r.k !== 'residential' && r.k !== 'service') continue;
      const rp = pairs(r.p), half = (r.w || 6) / 2;
      for (let i = 0; i < rp.length - 1; i++) {
        const a = rp[i], b = rp[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1) continue;
        const nx = -dz / L, nz = dx / L;
        for (let qd = hash2(a[0], a[1]) * 7; qd < L; qd += 6.8 + hash2(a[0] + qd, a[1]) * 2.6) {
          for (const sd of [-1, 1]) {
            const off = half + 2.2 + hash2(qd * 1.7 + sd, a[1] * 0.3) * 2.6, x = a[0] + dx * qd / L + nx * sd * off, z = a[1] + dz * qd / L + nz * sd * off;
            if (x < t.i * T || x >= (t.i + 1) * T || z < t.j * T || z >= (t.j + 1) * T || !wooded(x, z)) continue;
            if (maskAt(x, z, 'hard') === true || inBld(x, z) || treeCleared(x, z) || nTrees() >= MAX) continue;
            const u = hash2(x * 0.7 + 3.3, z * 1.3 - 8.1), kind = HOLM_SHARE[zoneAt(x, z, '', 1e9)] && u < 0.62 ? (hash2(x * 1.9 + 5.1, z * 0.6 - 2.7) < 0.5 ? 'holm' : 'holm_b') : u < (STONE_SHARE[zoneAt(x, z, '', 1e9)] ?? 0.08) + 0.3 ? 'stone' : 'aleppo', s = (kind.startsWith('holm') ? 1.5 : 1.15) + hash2(x + 1.9, z + 4.2) * 0.45;
            q.setFromAxisAngle(up, hash2(x, z + 9.1) * 6.28); sc.set(s, s * (0.92 + hash2(z, x) * 0.2), s); pos.set(x, groundY(x, z) - 0.1, z); m4.compose(pos, q, sc);
            const v = 0.82 + hash2(x - 5.5, z + 2.2) * 0.3; col.setRGB(v * (1 + hash2(z, x) * 0.1), v * (0.96 + hash2(z, z) * 0.08), v * 0.92);
            rows[kind][0].push(m4.clone()); rows[kind][1].push(col.clone());
          }
        }
      }
    }
    for (const dense of raveWoodTile(t.i * T, t.j * T, T) ? [false, true] : [false]) for (let gz = t.j * T; gz < (t.j + 1) * T; gz += dense ? 7 : SP) {   // (dense: a second, finer planting round the clearing of the rave, src/rave-ground.js raveWood)
      for (let gx = t.i * T; gx < (t.i + 1) * T; gx += dense ? 7 : SP) {
        const x = gx + hash2(gx, gz) * (dense ? 7 : SP), z = gz + hash2(gz + 7.1, gx - 3.3) * (dense ? 7 : SP);
        if (dense && hash2(x * 2.1 - 1.3, z * 1.7 + 0.4) > raveWood(x, z)) continue;
        let pr = 0;
        for (const a of areas) if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && a.p > pr && inPoly(a.pts, x, z)) pr = a.p;
        if (pr === 0 || hash2(x * 1.3, z * 0.7) > pr) continue;
        if (maskAt(x, z, 'hard') === true || inBld(x, z) || treeCleared(x, z)) continue;   // (the dance floor of the rave and its track keep clear, src/rave-ground.js)
        if (nTrees() >= MAX) break;
        const zn = zoneAt(x, z, '', 1e9), s = 0.75 + hash2(x + 1.9, z + 4.2) * 0.8, u = hash2(x * 0.7 + 3.3, z * 1.3 - 8.1), stone = u < (STONE_SHARE[zn] ?? 0.08), holm = !stone && hash2(x * 0.9 - 4.4, z * 1.1 + 6.6) < (HOLM_SHARE[zn] ?? 0);
        q.setFromAxisAngle(up, hash2(x, z + 9.1) * 6.28); sc.set(s, s * (0.9 + hash2(z, x) * 0.3), s); pos.set(x, groundY(x, z) - 0.1, z);
        m4.compose(pos, q, sc); (stone ? smats : holm ? hmats : mats).push(m4.clone());
        const v = 0.78 + hash2(x - 5.5, z + 2.2) * 0.4; (stone ? scols : holm ? hcols : cols).push(col.setRGB(v * (1 + hash2(z, x) * 0.12), v * (0.96 + hash2(z, z) * 0.1), v * 0.9).clone());
      }
      yield;
    }
    if (!nTrees()) return null;
    const g = new THREE.Group(); g.userData.tris = 0;
    for (const [name, ms, cs, road] of [['aleppo_lo', mats, cols], ['stone_lo', smats, scols], ['holm_lo', hmats, hcols], ['aleppo', ...rows.aleppo, 1], ['stone', ...rows.stone, 1], ['holm', ...rows.holm, 1], ['holm_b', ...rows.holm_b, 1]]) {   // the woods in the cheaper shapes, the trees along the roads in the full ones
      if (!ms.length) continue;
      const geo = makeTreeGeo(name), mesh = new THREE.InstancedMesh(geo, treeMat, ms.length); if (road) mesh.castShadow = mesh.receiveShadow = true;   // the trees along the roads shade them (the woods behind do not cast: that is a lot of triangles for a shadow nobody sees)
      ms.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, cs[i]); });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.name = (road ? 'roadtrees_' : 'trees_') + name;
      if (mesh.computeBoundingSphere) mesh.computeBoundingSphere(); else mesh.frustumCulled = false;
      g.add(mesh); g.userData.tris += ms.length * geo.attributes.position.count / 3;
    }
    return g;
  }

  // ---------- fetching ----------
  function fetchTile(t) {
    if (t.fetchP) return t.fetchP;
    t.fetchP = new Promise(res => { t.fetchRes = res; });
    pending.push(t);
    return t.fetchP;
  }
  function pump() {
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].want === 0) { const t = pending[i]; pending.splice(i, 1); t.fetchP = null; t.fetchRes(); }
    while (inflight < CFG.conc && pending.length) {
      let bi = 0; for (let i = 1; i < pending.length; i++) if (pending[i].pd < pending[bi].pd) bi = i;
      const t = pending.splice(bi, 1)[0]; inflight++;
      // (the production build serves the .bin twin through a fetch shim, tools/build/runtime/loader.js: always go through r.json())
      fetch(url('tiles/' + t.id + '.json')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); stat.bytes += +r.headers.get('content-length') || 0; return r.json(); }).then(d => {
        t.data = d; stat.fetched++;
        applyDistrictHeights(d); // low and full detail agree on storeys, no height pop on LOD swap
        prepareTile(t);
      }).catch(e => { t.failed = true; stat.errors++; console.warn('[world] tile', t.id, e); })
        .finally(() => { inflight--; t.fetchP = null; t.fetchRes(); pump(); });
    }
  }
  // ---------- ground colours relative to the city's own (tile.gt): two 25 x 25 grids of 20 m cells, two hex digits a cell: lightness, warmth ----------
  const GT_STEP = { t: 0.04, a: 0.015 }, _gt = new THREE.Color();
  const decodeTint = str => { if (!str) return null; const a = new Uint8Array(1250); for (let i = 0; i < 1250; i++) a[i] = parseInt(str[i], 16); return a; };
  function tintFn(t, grp) { // -> (x, z) -> Color multiplier (shared object), or null
    const g = t.gt && t.gt[grp]; if (!g) return null;
    const x0 = t.i * T, z0 = t.j * T, st = GT_STEP[grp];
    return (x, z) => {
      const fx = Math.max(0, Math.min(23.999, (x - x0) / 20 - 0.5)), fz = Math.max(0, Math.min(23.999, (z - z0) / 20 - 0.5)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = (j * 25 + i) * 2;
      const l = (g[k] * (1 - tx) + g[k + 2] * tx) * (1 - tz) + (g[k + 50] * (1 - tx) + g[k + 52] * tx) * tz, w = (g[k + 1] * (1 - tx) + g[k + 3] * tx) * (1 - tz) + (g[k + 51] * (1 - tx) + g[k + 53] * tx) * tz;
      const f = Math.exp((l - 8) * 0.045), dw = (w - 8) * st;
      return _gt.setRGB(Math.min(1.45, f * Math.exp(dw / 2)), f, Math.min(1.45, f * Math.exp(-dw / 2)));
    };
  }
  function prepareTile(t) {
    const d = t.data;
    if (d.near) { t.nearS = gridSampler(d.near); t.nearStep = d.near.s; t.benched = !!d.near.bench; }
    registerStructs(d, t.k); registerQuays(d, t.k);
    t.gt = d.gt ? { t: decodeTint(d.gt.t), a: decodeTint(d.gt.a) } : null;   // relative ground colours from the orthophotos (tools/colours.py)
    t.urban = Math.min(1, (d.buildings.length) / 160) * 0.8;
    t.tint = (d.areas || []).filter(a => COVER[a.k]).sort((a, b) => COVER[a.k][2] - COVER[b.k][2]).map(a => {
      const pts = pairs(a.p); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { pts, x0, z0, x1, z1, col: COVER[a.k][0], s: COVER[a.k][1], cover: a.k };
    });
  }
  function* ensureData(t) {
    if (t.data) return true;
    const c = cache.get(t.k);
    if (c) { cache.delete(t.k); t.data = c; if (t.tint === null) prepareTile(t); return true; } // a tile released earlier comes back without its near grid and tint
    if (t.failed) return false;
    yield fetchTile(t);
    return !!t.data;
  }
  function stash(t) { // park the parsed tile in the LRU instead of holding it
    if (!t.data) return;
    cache.delete(t.k); cache.set(t.k, t.data); t.data = null;
    while (cache.size > CFG.keepData) cache.delete(cache.keys().next().value);
  }

  // ---------- LOD stages ----------
  function* buildLow(t) {
    if (t.want === 0) return;
    t.stage = 'shape'; yield* computeShape(t);
    t.stage = 'terrain'; setPart(t, 'terrain', yield* terrainMesh(t, 2));
    yield;
    const g = new THREE.Group(); t.stage = 'streetsLow';
    yield* streetsIter(t.data.streets, g, { layers: ['asphalt', 'paving', 'sand', 'water'], curbs: false, offset: true, drape: 18, fine: t.benched, ground: groundFor(t), chunk: 0, density: densOf(t), tint: l => (l === 'asphalt' || l === 'paving') ? tintFn(t, 'a') : null });
    if (t.want === 0) { disposeObj(g); return; }
    setPart(t, 'streets', g);
    t.stage = 'bldLow'; const low = yield* lowBuildings(t);
    if (t.want === 0) { disposeObj(low); return; }
    setPart(t, 'bldLow', low);
    t.lod = 1; stat.built++;
  }
  function* buildFull(t) {
    t.hasFull = true;
    t.stage = 'physics'; yield* registerPhysics(t);
    if (t.want < 2) return;
    t.stage = 'masks'; yield* buildRaised(t);
    if (t.want < 2) return;
    t.stage = 'terrainFull'; setPart(t, 'terrain', yield* terrainMesh(t, 1));
    yield;
    const g = new THREE.Group(); t.stage = 'streetsHi';
    yield* streetsIter(t.data.streets, g, { layers: ['raised', 'median', 'verge', 'green'], curbs: true, offset: true, drape: 9, fine: t.benched, ground: groundFor(t), chunk: 0, density: densOf(t), tint: l => l === 'green' ? tintFn(t, 't') : l === 'raised' ? tintFn(t, 'a') : null });
    if (t.want < 2) { disposeObj(g); return; }
    setPart(t, 'streetsHi', g);
    t.stage = 'paint'; {
      const aoi = D.streets && D.streets.aoi, inC = aoi ? (x, z) => x > aoi[0] && x < aoi[2] && z > aoi[1] && z < aoi[3] : null; // the centro's paint is src/roadwear.js
      const items = (t.data.props || {}).items || [], mk = yield* roadMarksIter(t.data.roads, items.filter(i => i.k === 'crossing'), inC, { streets: t.data.streets, signals: items.filter(i => i.k === 'signal') });
      if (t.want < 2) { if (mk) disposeObj(mk); return; }
      if (mk) setPart(t, 'paint', mk);
    }
    t.stage = 'quays'; { const qg = buildQuayMeshes(t.k); if (qg) setPart(t, 'quays', qg); }
    t.stage = 'fences'; { const fg = yield* buildFences(cityIn(t).reduce((f, l) => l.clearFences ? l.clearFences(f) : f, t.data.fences), t.k, t.data); if (t.want < 2) { if (fg) disposeObj(fg); dropFences(t.k); return; } if (fg) setPart(t, 'fences', fg); }   // (a landmark may leave out the fences across its way in: the stadium's gate)
    t.stage = 'tram'; { const tg = buildTram(t.data.tram, t.k); if (tg) setPart(t, 'tram', tg); }
    t.stage = 'tracks'; { const tr = yield* buildTracks(t); if (tr) setPart(t, 'tracks', tr); }
    if (t.want < 2) return;
    t.stage = 'trees'; { const tg = yield* buildTrees(t); if (tg) setPart(t, 'trees', tg); }
    if (t.want < 2) return;
    t.stage = 'bldFull'; const bg = new THREE.Group(), lms = cityIn(t);
    const occ = hooks.occ?.begin(t);   // the lean renderer: the building solids of this tile become its occluder grid (src/engine-lean.js)
    const tctx = lms.length || occ ? { ...ctx, skip: new Set([...ctx.skip, ...lms.flatMap(l => l.skipIds || [])]), onSolid: occ?.add } : ctx;
    yield* buildBuildingsIter(tctx, t.data, bg);
    freeAfterUpload(bg);   // (the landmark models added next keep their arrays: src/camera-clear.js reads them)
    for (const l of lms) { // landmark models standing in for those generic buildings
      // a model reads the ground under its whole footprint: wait (8 s at most) for the tiles round it that are on their way, so it stands on the streamed ground and not on the far grid
      for (let t0 = performance.now(); t.want >= 2 && performance.now() - t0 < 8000 && lmNeighboursPending(l);) yield new Promise(r => setTimeout(r, 200));
      try { const o = l.build(ctx); if (o) { bg.add(o); yield; } } catch (e) { console.error('[world] landmark', l.name, e); }
    }
    if (t.want < 2) { disposeObj(bg); return; }
    setPart(t, 'bldFull', bg);
    setPart(t, 'bldLow', null);
    t.lod = 2;
    onTileFull(t.k); emit('full', t);
    if (occ) hooks.occ.end(t, occ);
  }
  function* downgrade(t) {
    hooks.occ?.drop(t);
    onTileDrop(t.k); emit('drop', t);
    setPart(t, 'bldFull', null); setPart(t, 'quays', null); disposeQuayMeshes(t.k); setPart(t, 'fences', null); setPart(t, 'tram', null); dropFences(t.k); setPart(t, 'streetsHi', null); setPart(t, 'paint', null); setPart(t, 'tracks', null); setPart(t, 'trees', null);
    unregisterPhysics(t); t.raised = null; t.hard = undefined; t.sandb = undefined; t.gsegs = null; t.hasFull = false;
    if (t.lod === 2 || !t.parts.bldLow) {
      if (yield* ensureData(t)) {
        if (!t.parts.bldLow) setPart(t, 'bldLow', yield* lowBuildings(t));
        setPart(t, 'terrain', yield* terrainMesh(t, 2));
      }
    }
    t.lod = 1;
    stash(t);
  }
  function release(t) {
    for (const l of CENTRO_LANDMARKS) if (t.parts['lm:' + l.name]) lmPending.add(l);   // built again when the tile comes back
    onTileDrop(t.k); unregisterStructs(t.k); unregisterQuays(t.k); dropFences(t.k); emit('drop', t);
    for (const n of Object.keys(t.parts)) setPart(t, n, null);
    unregisterPhysics(t); t.raised = null; t.hard = undefined; t.sandb = undefined; t.gsegs = null;
    stash(t);
    t.dead = true; t.nearS = null; t.nearStep = 0; t.benched = false; t.lod = 0; t.hasFull = false;
    tiles.delete(t.k);
    if (lastG === t) lastG = null; if (lastR === t) lastR = null;
    farHole(t, false);
    contextDirty = true;
  }
  function* process(t) {
    for (;;) {
      const want = t.want;
      if (want === 0 || t.lost) { release(t); return; }
      if (t.lod === want && !(want === 1 && t.hasFull)) { if (want === 1) stash(t); return; }
      if (!(yield* ensureData(t))) { if (t.want === 0) continue; return; }
      if (t.want !== want) continue;
      if (t.lod === 0) { yield* buildLow(t); continue; }
      if (want === 2 && t.lod < 2) { yield* buildFull(t); continue; }
      if (want === 1 && (t.lod === 2 || t.hasFull)) { yield* downgrade(t); continue; }
      return;
    }
  }

  // ---------- which tile wants which lod ----------
  function rectDist(x, z, t) {
    const x0 = t.i * T, z0 = t.j * T, dx = Math.max(x0 - x, 0, x - (x0 + T)), dz = Math.max(z0 - z, 0, z - (z0 + T));
    return Math.hypot(dx, dz);
  }
  // Budget allocation. Every tile in range is always covered: the baked far boxes cost a few hundred triangles and never go away, so
  // a tile that gets nothing better is not a hole. Order of grants: (1) tiles within `guard` of the camera get full detail whatever it
  // costs, because wall collision and the raised-ground mask only exist there; (2) every tile of the low detail ring gets low detail,
  // nearest first, while the budget lasts; (3) full detail goes to the nearest tiles of the full ring, nearest first, until the next one
  // does not fit. Tiles that already have a level get 8 % of slack, so the estimate shifting as real triangle counts come in does not
  // make them flap. The far boxes outside the list count against the budget too (the ring that is not in the list, within the fog).
  function updateWanted(fx, fz) {
    const R = Math.ceil((CFG.rLow + CFG.hyst) / T) + 1, ci = Math.floor(fx / T), cj = Math.floor(fz / T);
    const list = [];
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      if (!M.tiles[i + '_' + j]) continue;
      const t = getTile(i, j); t.d = rectDist(fx, fz, t); list.push(t);
    }
    list.sort((a, b) => a.d - b.d);
    const inList = new Set(list), inKeys = new Set();
    wantedOnce = true;
    for (const t of tiles.values()) if (!inList.has(t)) { t.want = 0; t.d = rectDist(fx, fz, t); }
    // overview (the title flyover): only the tile under the camera gets full detail, so the budget goes to the low detail ring
    const rFull = world.overview ? 1 : CFG.rFull, guard = world.overview ? 1 : CFG.guard;
    let est = 0;
    for (const t of list) {
      inKeys.add(t.k); t.want = 0;
      t.dw = t.d < rFull + (t.lod === 2 ? CFG.hyst : 0) ? 2 : t.d < CFG.rLow + (t.lod >= 1 ? CFG.hyst : 0) ? 1 : 0;
      est += estimate(t, 0);
    }
    if (farCity) est += farCity.trisAround(fx, fz, farRadius(), inKeys);
    if (hills) est += hills.tris();
    for (const t of list) if (t.d < guard) { t.want = 2; est += estimate(t, 2) - estimate(t, 0); }
    for (const t of list) {
      if (t.dw < 1 || t.want >= 1) continue;
      const dl = estimate(t, 1) - estimate(t, 0);
      if (est + dl <= CFG.triCap * (t.lod >= 1 ? 1.08 : 1)) { t.want = 1; est += dl; }
    }
    for (const t of list) {
      if (t.dw < 2 || t.want >= 2) continue;
      const dl = estimate(t, 2) - estimate(t, t.want);
      if (est + dl > CFG.triCap * (t.lod === 2 ? 1.08 : 1)) break;
      t.want = 2; est += dl;
    }
    markView();
    for (const t of tiles.values()) ensureTask(t);
    ensureFarTask(fx, fz); ensureLmTask();
    pump();
    world.estTris = est;
  }
  const farRadius = () => Math.min(14000, CFG.farFog / Math.max(1e-6, scene.fog ? scene.fog.density : 0.00014));
  // one task at a time keeps the far chunks around the camera built (src/context.js sync); it sits behind the tile work in the queue
  function ensureFarTask(fx, fz) {
    if (!farCity || (farTask && !farTask.done)) return;
    farTask = { t: { pd: 5e4 }, gen: (function* () { yield farCity.load(); yield* farCity.sync(fx, fz, farRadius(), seenBox); contextDirty = true; if (hills) yield* hills.sync(fx, fz, farRadius() + 1500, far.hidden, far.holeVer, seenBox); })(), wait: null, name: 'far' };
    tasks.push(farTask);
  }
  // ---------- centro landmarks (src/landmarks.js): a model is built once the tile it stands on is loaded and the tiles its footprint reaches into are too (or are not coming), so
  // the heights it reads are the streamed ground; the group is kept with the anchor tile ('lm:' part) through its detail changes and built again after a release ----------
  const lmPending = new Set(CENTRO_LANDMARKS), lmSince = new Map();
  let lmTask = null;
  const lmAnchor = l => tiles.get(nk(Math.floor(l.x / T), Math.floor(l.z / T)));
  function lmReady(l, now) {
    const a = lmAnchor(l); if (!a || a.dead || a.lod < 1) return 0;   // 0: its tile is not there yet
    if (!lmSince.has(l)) lmSince.set(l, now);
    if (now - lmSince.get(l) > 8000) return 2;
    for (let i = Math.floor((l.x - l.radius) / T); i <= Math.floor((l.x + l.radius) / T); i++) for (let j = Math.floor((l.z - l.radius) / T); j <= Math.floor((l.z + l.radius) / T); j++) {
      if (!M.tiles[i + '_' + j]) continue;
      const n = tiles.get(nk(i, j));
      if (n && n.lod < 1 && n.want > 0 && !n.failed) return 1;   // a neighbour is on its way
    }
    return 2;
  }
  function* lmJob() {
    for (;;) {
      let waiting = false;
      for (const l of [...lmPending]) {
        const r = lmReady(l, performance.now());
        if (r === 1) { waiting = true; continue; }
        if (r === 0) continue;
        const a = lmAnchor(l);
        let g = null; try { g = l.build(ctx); } catch (e) { console.error('[world] landmark', l.name, e); }
        lmPending.delete(l); lmSince.delete(l);
        if (g && a && !a.dead && a.lod >= 1) setPart(a, 'lm:' + l.name, g, g.userData.tris || 0); else if (g) disposeObj(g);
        yield;
      }
      if (!waiting) break;
      yield new Promise(r => setTimeout(r, 250));
    }
    lmTask.done = true; lmTask = null;
  }
  function ensureLmTask() {
    if (lmTask || !lmPending.size) return;
    let any = false; for (const l of lmPending) { const a = lmAnchor(l); if (a && !a.dead && a.lod >= 1) { any = true; break; } }
    if (!any) return;
    lmTask = { t: { pd: 4e4 }, gen: lmJob(), wait: null, name: 'landmarks' };
    tasks.push(lmTask);
  }
  function lmNeighboursPending(l) {
    for (let i = Math.floor((l.x - l.radius) / T); i <= Math.floor((l.x + l.radius) / T); i++) for (let j = Math.floor((l.z - l.radius) / T); j <= Math.floor((l.z + l.radius) / T); j++) {
      if (!M.tiles[i + '_' + j]) continue;
      const n = tiles.get(nk(i, j));
      if (n && n.lod < 1 && n.want > 0 && !n.failed) return true;
    }
    return false;
  }
  function ensureTask(t) {
    if (t.task || t.dead) return;
    if (t.lost) { const task = { t, gen: process(t), wait: null, name: t.id }; t.task = task; tasks.push(task); return; }
    if (t.want === t.lod && !(t.want === 1 && t.hasFull) && t.want !== 0) { if (t.want === 1 && t.data) stash(t); return; }
    if (t.want === 0 && t.lod === 0 && !Object.keys(t.parts).length && !t.data && !t.nearS) { t.dead = true; tiles.delete(t.k); return; }
    if (t.failed && t.want > 0 && !t.data && !cache.has(t.k)) return;
    const task = { t, gen: process(t), wait: null, name: t.id };
    t.task = task; tasks.push(task);
  }

  // ---------- what the camera sees: build order and the reveal counter ----------
  // markView (every frame, it is a few hundred box tests): flags the tiles the camera can see, and orders the work visible tiles first,
  // nearest first, then the rest of the ring nearest first (pd, the priority of tasks and fetches). A tile is in view when it is within
  // viewNear of the focus (so the tile under the car always is) or its box meets the camera frustum widened by viewMargin.
  // visiblePending counts, at the end of the frame, the in-view tiles that are below the detail they want plus the far city chunks in view
  // that are not built (and 1 until the manifest, the first allocation and the far city file are in): 0 means everything on screen is built.
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _bb = new THREE.Box3(), _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3();
  function seenBox(x0, z0, x1, z1, top = 200) { _v0.set(x0, -10, z0); _v1.set(x1, top, z1); return _fr.intersectsBox(_bb.set(_v0, _v1)); }
  function markView() {
    camera.updateMatrixWorld();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const p of _fr.planes) p.constant += CFG.viewMargin;
    for (const t of tiles.values()) {
      if (t.top < 0) t.top = Math.max(farM(t.cx, t.cz), farM(t.cx - 250, t.cz - 250), farM(t.cx + 250, t.cz - 250), farM(t.cx - 250, t.cz + 250), farM(t.cx + 250, t.cz + 250)) + 80;
      t.d = rectDist(focus.x, focus.z, t);
      t.vis = t.d < CFG.viewNear || seenBox(t.i * T, t.j * T, (t.i + 1) * T, (t.j + 1) * T, t.top);
      t.pd = t.vis ? t.d : t.d + 1e4;
    }
    if (farTask && !farTask.done) farTask.t.pd = farMissing > 0 ? 4e3 : 5e4; // the far chunks in view go before the tiles out of view
  }
  function countPending() {
    let n = 0;
    if (!M || !wantedOnce || (farCity && !farCity.loaded && !farCity.failed)) n++;
    for (const t of tiles.values()) {
      if (!t.vis || t.dead || t.want === 0) continue;
      if (t.failed && !t.data && !cache.has(t.k)) continue;
      if (t.lod < t.want || (t.want === 1 && t.hasFull)) n++;
    }
    farMissing = (farCity ? farCity.missing(focus.x, focus.z, farRadius(), seenBox) : 0) + (hills ? hills.missing() : 0);
    return n + farMissing;
  }

  // ---------- scheduler ----------
  function runTasks(budget) {
    const t0 = performance.now();
    tasks.sort((a, b) => a.t.pd - b.t.pd);
    for (const k of tasks) {
      if (k.wait || k.done) continue;
      while (performance.now() - t0 < budget) {
        let r;
        const s0 = performance.now();
        try { r = k.gen.next(); } catch (e) { console.error('[world] task', k.name, e); r = { done: true }; if (k.t.id) { k.t.failed = true; k.t.want = 0; } }
        { const dtm = performance.now() - s0; if (dtm > 6 && k.t.id) { (stat.slow = stat.slow || []).push([+dtm.toFixed(1), k.t.id, k.t.stage]); if (stat.slow.length > 40) stat.slow.shift(); } }
        if (r.done) { k.done = true; if (k.t.id) k.t.task = null; break; }
        if (r.value && typeof r.value.then === 'function') { k.wait = r.value; r.value.then(() => { k.wait = null; }, () => { k.wait = null; }); break; }
      }
      if (performance.now() - t0 >= budget) break;
    }
    if (tasks.some(k => k.done)) tasks = tasks.filter(k => !k.done);
  }

  // ---------- far city (src/context.js): its boxes of a tile are hidden once the tile has real buildings ----------
  let contextDirty = false;
  const farHidden = new Set();
  function refreshContext() {
    contextDirty = false;
    if (!farCity) return;
    farHidden.clear();
    for (const t of tiles.values()) if (t.parts.bldLow || t.parts.bldFull) farHidden.add(t.k);
    farCity.hide(farHidden);
  }

  // ---------- public ----------
  let binding = null, tele = null, overviewOn = false;
  world = {
    manifest: null,
    estTris: 0,
    // set by main.js while the title is up (see updateWanted); a change asks for a new allocation at once, so leaving the title does not wait for the next 0.5 s tick
    get overview() { return overviewOn; }, set overview(v) { if (v !== overviewOn) { overviewOn = v; wantedTimer = 99; } },
    hurry: false,    // set while a loading screen or the start transition covers the game: the build budget goes up to cfg.hurryMs a frame
    get farCity() { return farCity; },
    raised,
    drivePlayer, surfaceAt,
    // For the flying lapa (src/vehicle-air.js). roofAt: height of the roof you can land on at (x, z) (the highest one, courtyards excluded), or NaN when there is none or the tile is not at full detail.
    // detailAt: 2 when the tile under (x, z) is at full detail with its walls registered (landing is safe there), else lower.
    roofAt(x, z) {
      const t = tiles.get(nk(Math.floor(x / T), Math.floor(z / T)));
      if (t === undefined || t.roofs === null || t.roofs === undefined) return NaN;
      const a = t.roofs.get(rk(Math.floor(x / RC), Math.floor(z / RC)));
      let best = NaN;
      if (a !== undefined) for (let i = 0; i < a.length; i++) {
        const r = a[i];
        if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1 || !(best !== best || r.h > best) || !inFlat(r.flat, x, z)) continue;
        if (r.holes) { let hole = false; for (const h of r.holes) if (inFlat(h, x, z)) { hole = true; break; } if (hole) continue; }
        best = r.h;
      }
      return best;
    },
    detailAt(x, z) { const t = tiles.get(nk(Math.floor(x / T), Math.floor(z / T))); return t !== undefined && t.lod === 2 && t.phys ? 2 : t !== undefined ? t.lod : 0; },
    // Dry land per the manifest coastline (the baked D.land only covers the centro). False until the manifest is in.
    isLand(x, z) {
      if (!landPoly) return false;
      if (x < landPoly.x0 || x > landPoly.x1 || z < landPoly.z0 || z > landPoly.z1) return false;
      return inPoly(landPoly.pts, x, z) || landPoly.islands.some(p => inPoly(p, x, z));
    },
    bind(b) { binding = b; applyAt(); },
    // Move the player somewhere far: stream the destination in first, then place the car (placeAt snaps to the nearest road vertex).
    freeAfterUpload,   // for src/roadwear.js
    onTile(fn) { tileFns.add(fn); for (const t of fullSet) fn('full', t); return () => tileFns.delete(fn); },
    fullTiles() { return [...fullSet]; },
    // Parsed data of tile (i, j) if it is resident or in the parsed-tile LRU (full or low detail), else null. Read-only (minimap).
    // How many in-view tiles and far chunks still need building (markView above); 0 = everything the camera can see is built.
    // Computed at the end of update(), so call it after a frame or two when the camera has just moved.
    visiblePending() { return visPending; },
    tileData(i, j) { const k = nk(i, j), t = tiles.get(k); return (t && t.data) || cache.get(k) || null; },
    teleport(x, z, done) { tele = { x, z, done }; wantedTimer = 99; },
    // A lost GL context took the buffers, and the meshes that gave up their arrays cannot upload again: they leave the frame now (before the next render), and their tiles are released and streamed in again, nearest first.
    contextRestored() {
      for (const t of tiles.values()) {
        let lost = false;
        for (const n in t.parts) t.parts[n].traverse(m => { if (m.userData.freed) { m.visible = false; lost = true; } });
        if (lost || t.task) { t.lost = true; ensureTask(t); }
      }
      onGPU.length = 0; wantedTimer = 99;
      for (const c of far.chunks.values()) { root.remove(c.mesh); c.mesh.geometry.dispose(); }
      far.chunks.clear(); if (M) buildFar();
      hills?.contextRestored(); farCity?.contextRestored();
    },
    update(dt, cam) {
      if (!M) { if (tasks.length) runTasks(world.hurry ? CFG.hurryMs : CFG.budgetMs); return; }
      const t0 = performance.now();
      const f = tele || cam.position;
      focus.x = f.x; focus.z = f.z;
      wantedTimer += dt;
      if (wantedTimer > 0.5 || Math.hypot(focus.x - lastWanted.x, focus.z - lastWanted.z) > 30) {
        wantedTimer = 0; lastWanted.x = focus.x; lastWanted.z = focus.z;
        updateWanted(focus.x, focus.z);
      }
      markView();
      pump();
      runTasks(world.hurry ? CFG.hurryMs : CFG.budgetMs);
      freeStep();
      for (const t of tiles.values()) if (!t.task && !t.dead) ensureTask(t);
      if (tele) {
        const t = tiles.get(nk(Math.floor(tele.x / T), Math.floor(tele.z / T)));
        if (t && t.lod === 2) { const d = tele.done; tele = null; d && d(); }
      }
      if (hills) { hills.refresh(far.hidden, far.holeVer); if (hills.ver !== hillsVer) { hillsVer = hills.ver; for (const c of far.chunks.values()) c.dirty = true; } }
      farUpdate();
      if (contextDirty) refreshContext();
      visPending = countPending();
      const w = performance.now() - t0;
      stat.frames++; stat.work = w; stat.workSum += w; if (w > stat.workMax) stat.workMax = w; if (w > 8) stat.hitches++;
      if (overlay) overlayUpdate(dt);
    },
    stats() {
      const by = [0, 0, 0]; let tris = 0, bld = 0;
      for (const t of tiles.values()) { by[t.lod]++; tris += triCount(t); }
      return { tiles: tiles.size, lod0: by[0], lod1: by[1], lod2: by[2], tris, estTris: world.estTris, queued: tasks.length, pending: pending.length, inflight, cache: cache.size,
        walls: wallGrid.m.size, roadVerts: roadVerts.length, ...stat, avgWork: stat.workSum / Math.max(1, stat.frames), kbFetched: Math.round(stat.bytes / 1024),
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        drawCalls: renderer.info.render.calls, rendTris: renderer.info.render.triangles, far: farCity ? farCity.stats() : null };
    },
    resetStats() { stat.frames = 0; stat.workSum = 0; stat.workMax = 0; stat.hitches = 0; },
    tiles, cfg: CFG,
  };

  // ?at=x,z puts the car somewhere once the world around it has streamed in
  function applyAt() {
    const at = Q.get('at'); if (!at || !binding) return;
    const [x, z, th] = at.split(',').map(Number);   // a third number: exactly there, facing that way (radians), not on the nearest road
    if (M) world.teleport(x, z, () => binding.placeAt(x, z, th)); else setTimeout(applyAt, 200);
  }

  // ?wstats overlay
  let overlay = null, ot = 0;
  if (Q.has('wstats')) { overlay = document.createElement('pre'); overlay.style.cssText = 'position:fixed;left:6px;bottom:6px;margin:0;z-index:50;color:#fff;background:rgba(0,0,0,.55);font:11px monospace;padding:4px 6px;pointer-events:none'; document.body.appendChild(overlay); }
  function overlayUpdate(dt) {
    if ((ot += dt) < 0.5) return; ot = 0;
    const s = world.stats();
    overlay.textContent = `tiles ${s.lod2}/${s.lod1}/${s.lod0}  tris ${(s.tris / 1e3) | 0}k  queue ${s.queued}  net ${s.inflight}+${s.pending}  vis ${visPending}\nwork ${s.work.toFixed(1)}ms max ${s.workMax.toFixed(1)}  heap ${s.heapMB ?? '?'}MB`;
  }
  return world;
}
