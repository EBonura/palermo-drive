import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { D, FLOOR, LAT0, LON0, KX, KZ, proj, HAS_NEAR, NEAR, nearH, farH, inNear, groundY,
  Buf, pairs, signedArea, triUp, fillPoly, canvasTex, rnd, speckle } from './core.js';
import { WORLD, hooks, rasterMask } from './core.js'; // world streaming (src/world.js), only with ?world=1
import { buildStreets, CURB } from './streets.js'; // street building moved out of main.js so world tiles reuse it
import { createWorld } from './world.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { prepareLandmarks, buildLandmarks } from './landmarks.js';
import { buildContext } from './context.js';
import { QUALITY, setupMobile } from './mobile.js';
import { createVehicle } from './vehicle.js';
import { setupUI } from './ui.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createNet } from './net.js';
import { createShouts } from './shouts.js';
import { createRoadWear } from './roadwear.js';
import { createHorn } from './horn.js';
import { createSuca } from './suca.js'; // SUCA wall tags to collect (src/suca.js)
import { createSea } from './sea.js';
import { createRadio } from './radio.js';
import { createPerf } from './perf.js'; // adaptive render scale: ~30 fps on phones, 60 on desktop [perf pass]
import { createDayNight } from './daynight.js'; // day/night cycle: sun, sky, fog, lamps, windows, headlights (src/daynight.js)

const SPOTS = [
  ['Quattro Canti', 38.115684, 13.361460], // the crossing itself (17.5 m E of the projection origin)
  ['Teatro Massimo', 38.1199, 13.3573],
  ['Cattedrale', 38.1146, 13.3558],
  ['Palazzo dei Normanni', 38.1112, 13.3540],
  ['Piazza Pretoria', 38.1151, 13.3622],
  ['La Cala', 38.1203, 13.3676],
  ['Stazione Centrale', 38.1092, 13.3655],
  // More starting points (Nominatim/OSM positions). Keys 1-7 reach the first seven; the start picker lists all.
  ['Vucciria (Piazza Garraffello)', 38.1179401, 13.3649292],
  ['Piazza Marina', 38.1177752, 13.3686382],
  ['Mercato del Capo', 38.1186189, 13.3540701],
  ['Piazza Bellini', 38.1149189, 13.3625335],
  ['Piazza San Domenico', 38.1188139, 13.3629446],
];

// ---------- renderer / scene ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatio));
// [perf pass] The production build defines __PD_PROD__: skipping the per-program compile/link status query lets the browser compile shaders in parallel.
if (typeof __PD_PROD__ !== 'undefined') renderer.debug.checkShaderErrors = false;
const perf = createPerf({ renderer, mobile: QUALITY.mobile });
if (QUALITY.mobile) { const maxA = renderer.capabilities.getMaxAnisotropy(); renderer.capabilities.getMaxAnisotropy = () => Math.min(4, maxA); } // [perf pass] phones: cap anisotropic filtering at 4x whatever the modules ask for // [perf pass] moves the pixel ratio up to the ceiling set in applySettings()
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap was folded into PCFShadowMap in r182 (PCFShadowMap is the soft one now). [perf pass]
renderer.shadowMap.type = +THREE.REVISION >= 182 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

const HAZE = new THREE.Color('#a9c4da'); // distance haze, towards the hazed-blue mountains
const scene = new THREE.Scene();
scene.background = HAZE;
scene.fog = new THREE.FogExp2(HAZE, 0.00014);

const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 40000);

// Late afternoon sun from the west-south-west, over Monreale.
const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 26), -1.18);
const sky = new Sky();
sky.scale.setScalar(30000);
sky.material.uniforms.turbidity.value = 1.4;
sky.material.uniforms.rayleigh.value = 3.2;
sky.material.uniforms.mieCoefficient.value = 0.003;
sky.material.uniforms.mieDirectionalG.value = 0.84;
sky.material.uniforms.sunPosition.value.copy(SUN_DIR);
// [day/night] The sky shader patch (day look scaled by 0.42, twilight gradient, stars, moon) and the environment map now live in src/daynight.js.
scene.add(sky);
// [day/night] The ambient/reflection map (a smooth sky gradient, re-baked as the sky changes) is made by src/daynight.js.

const hemi = new THREE.HemisphereLight('#c9cfd4', '#9a8566', 0.4); // [day/night] colours/intensity are driven by src/daynight.js
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe4bd', 2.9); // warm sun, the stone glows gold
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap);
Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 700 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- palettes ----------
const ROAD_COL = {
  primary: '#4b4a4e', secondary: '#4b4a4e', tertiary: '#504f53', unclassified: '#56555a', residential: '#56555a',
  living_street: '#8f8678', service: '#5e5d61', pedestrian: '#d3c6ac', footway: '#c6baa4', path: '#c6baa4',
  cycleway: '#a86a5a', pier: '#a29e95',
};
const SIDEWALK = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service']);
const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian']);

if (!WORLD) { // near terrain under everything: only visible past the street data and in gaps (world tiles bring their own terrain)
  const step = 10, nx = Math.ceil((NEAR.x1 - NEAR.x0) / step) + 1, nz = Math.ceil((NEAR.z1 - NEAR.z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = Math.min(NEAR.x1, NEAR.x0 + i * step), z = Math.min(NEAR.z1, NEAR.z0 + j * step), k = j * nx + i;
    pos.set([x, nearH(x, z) - 0.15, z], k * 3);
    if (i < nx - 1 && j < nz - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#9c968a', roughness: 1 }));
  m.receiveShadow = true;
  scene.add(m);
}

// ---------- street geometry (src/streets.js): asphalt, stone paving, raised sidewalks with curbs ----------
if (D.streets && !WORLD) scene.add(buildStreets(D.streets));

// Raised-ground lookup so the car bumps up onto sidewalks.
let world = null; // world streamer (src/world.js), only with ?world=1
// [perf pass] bit-packed tiled raster (core.js rasterMask): was a 4100 x 4060 px canvas + 66 MB RGBA read-back held for the whole session.
const centroRaised = D.streets ? rasterMask([...D.streets.raised, ...D.streets.green], D.streets.aoi, 2) : () => false; // 0.5 m cells
// world: tiles bring their own raised-ground masks next to the baked centro one
const raisedMask = WORLD ? (x, z) => centroRaised(x, z) || (world !== null && world.raised(x, z)) : centroRaised;

const MOUNTAIN_HAZE = new THREE.Color('#7297b4');
if (D.far && !WORLD) { // (world.js builds its own far terrain) hills around the Conca d'Oro, Monte Pellegrino
  const F = D.far, pos = new Float32Array(F.nx * F.nz * 3), col = new Float32Array(F.nx * F.nz * 3), idx = [];
  const c = new THREE.Color(), sand = new THREE.Color('#cdbb92'), plain = new THREE.Color('#b3a993'), grove = new THREE.Color('#7f8f5c'),
    scrub = new THREE.Color('#77804f'), rock = new THREE.Color('#b9b0a1');
  const H = (i, j) => F.h[Math.min(F.nz - 1, Math.max(0, j)) * F.nx + Math.min(F.nx - 1, Math.max(0, i))];
  for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) {
    const k = j * F.nx + i, h = H(i, j), x = F.x0 + i * F.s, z = F.z0 + j * F.s;
    pos.set([x, h - 0.6, z], k * 3);
    const slope = Math.hypot(H(i + 1, j) - H(i - 1, j), H(i, j + 1) - H(i, j - 1)) / (2 * F.s);
    const noise = (Math.sin(i * 1.7 + j * 0.9) + Math.sin(i * 0.37 - j * 1.3)) * 0.25 + 0.5;
    if (h < 2) c.copy(sand);
    else if (h < 90 && slope < 0.15) c.copy(plain).lerp(grove, noise * 0.6);
    else c.copy(scrub).lerp(rock, Math.min(1, slope * 1.4));
    // Distant hills read as hazed blue in every long view of Palermo (style guide section 6).
    const far = THREE.MathUtils.smoothstep(Math.hypot(x, z), 1500, 9000);
    if (h > 2) c.lerp(MOUNTAIN_HAZE, far * (h > 90 ? 0.6 : 0.35));
    col.set([c.r, c.g, c.b], k * 3);
    if (i < F.nx - 1 && j < F.nz - 1) {
      const x1 = x + F.s, z1 = z + F.s;
      if (inNear(x, z) && inNear(x1, z) && inNear(x, z1) && inNear(x1, z1)) continue;
      idx.push(k, k + F.nx, k + 1, k + 1, k + F.nx, k + F.nx + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}

// The sea surface, shoreline foam and the drowning game over live in src/sea.js.
const sea = createSea({ scene, camera, renderer, sun, SUN_DIR, D, groundY });

// ---------- modules ----------
let freeCam = null;
const ctx = { scene, renderer, skip: new Set(), raisedMask, CURB };
prepareLandmarks(ctx);
if (!WORLD) buildBuildings(ctx); // world: buildings stream in per tile (src/world.js)
buildLandmarks(ctx);
// Props may return { collidePlayer(car, dt) } for parked cars, bins, scooters, breakable trees.
const propsApi = buildProps(ctx) || {};
const contextGroup = buildContext(ctx); // world: hidden chunk by chunk where real tiles stand

// ---------- spatial grids ----------
class Grid {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  key(ix, iz) { return ix * 100003 + iz; }
  addSeg(seg, x0, z0, x1, z1) {
    const c = this.cell;
    for (let ix = Math.floor(Math.min(x0, x1) / c); ix <= Math.floor(Math.max(x0, x1) / c); ix++)
      for (let iz = Math.floor(Math.min(z0, z1) / c); iz <= Math.floor(Math.max(z0, z1) / c); iz++) {
        const k = this.key(ix, iz); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(seg);
      }
  }
  query(x0, z0, x1, z1, fn) {
    if (this.ext) this.ext.query(x0, z0, x1, z1, fn); // world: per-tile segments (src/world.js)
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) { const a = this.m.get(this.key(ix, iz)); if (a) for (const s of a) fn(s); }
  }
}

const walls2d = new Grid(16);
const addRing = flat => { const p = pairs(flat); for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); } };
if (!WORLD) for (const b of D.buildings) { addRing(b.p); (b.holes || []).forEach(addRing); } // world: walls come per tile
// No wall along the coast: driving into the sea is allowed, and it's game over (src/sea.js).

const streets = new Grid(30), roadVerts = [];
for (const r of D.roads) {
  const p = pairs(r.p);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (r.n) streets.addSeg([a[0], a[1], b[0], b[1], r.n, r.w], a[0], a[1], b[0], b[1]);
    if (DRIVABLE.has(r.k)) roadVerts.push([a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])]);
  }
}

// ---------- world streaming (src/world.js), only with ?world=1 ----------
// Streams the whole-city tiles around the camera: terrain, streets, buildings, per-tile walls/road names/road vertices.
if (WORLD) world = createWorld({ scene, camera, renderer, ctx, walls2d, streets, roadVerts, DRIVABLE, context: contextGroup });

function closestOnSeg(px, pz, s) {
  const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - s[0]) * dx + (pz - s[1]) * dz) / l2)) : 0;
  return [s[0] + dx * t, s[1] + dz * t];
}

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyC') camState.mode = (camState.mode + 1) % 4;
  if (e.code === 'KeyR') placeAt(car.x, car.z);
  if (e.code === 'Slash' || e.code === 'F1') { document.getElementById('help').classList.toggle('show'); e.preventDefault(); }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= SPOTS.length) placeAt(...proj(SPOTS[n - 1][1], SPOTS[n - 1][2]));
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- player car (src/vehicle.js) ----------
const vehicle = createVehicle({ scene, camera, keys, walls2d, closestOnSeg, raisedMask, CURB, roadVerts });
const { car, camState, placeAt, physics, updateCamera } = vehicle;
world?.bind({ placeAt }); // world: lets ?at=x,z / world.teleport place the car once the destination has streamed in

// ---------- traffic and pedestrians (src/traffic.js, src/pedestrians.js) ----------
// update(dt, camera) runs every frame while playing or on the title flyover; collidePlayer(car) runs
// after each fixed physics step and may push the player (car.x/z/vx/vz) like a wall hit.
// shout(x, y, z, text?) pops a swearing balloon over whoever the lapa just hit (src/shouts.js).
const shouts = createShouts(camera);
// Modules without env access (props) can raise a balloon with a 'pd-shout' event.
addEventListener('pd-shout', e => { const d = e.detail || {}; shouts.shout(d.x, d.y, d.z, d.text); });
let horn; // created once game settings exist (volume)
const worldEnv = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, shout: shouts.shout };
const traffic = createTraffic(worldEnv);
const pedestrians = createPedestrians({ ...worldEnv, traffic });
// Potholes, patches and tyre marks on the asphalt; collidePlayer jolts the lapa over holes.
const roadwear = createRoadWear({ ...worldEnv, vehicle });
const mapMarkers = []; // { x, z, color, size } drawn on the minimap
const mapRoute = []; // [x, z] points of the current route, drawn as a line on the minimap

// ---------- minimap ----------
const MM_SCALE = 1; // px per metre on the baked map
const mapCanvas = document.createElement('canvas');
{
  const [x0, z0, x1, z1] = D.bounds, pad = 200;
  mapCanvas.width = Math.ceil((x1 - x0 + pad * 2) * MM_SCALE); mapCanvas.height = Math.ceil((z1 - z0 + pad * 2) * MM_SCALE);
  mapCanvas.ox = x0 - pad; mapCanvas.oz = z0 - pad;
  const g = mapCanvas.getContext('2d');
  const tx = x => (x - mapCanvas.ox) * MM_SCALE, tz = z => (z - mapCanvas.oz) * MM_SCALE;
  const path = flat => { g.beginPath(); for (let i = 0; i < flat.length; i += 2) g[i ? 'lineTo' : 'moveTo'](tx(flat[i]), tz(flat[i + 1])); };
  g.fillStyle = '#3a8bb5'; g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  g.fillStyle = '#e4dccb'; path(D.land); g.closePath(); g.fill();
  for (const a of D.areas) { g.fillStyle = { green: '#93b46a', water: '#3a8bb5', plaza: '#f2ead8', pier: '#bdbab2' }[a.k]; path(a.p); g.closePath(); g.fill(); }
  g.lineCap = g.lineJoin = 'round';
  for (const r of D.roads) { if (!DRIVABLE.has(r.k)) continue; g.strokeStyle = r.k === 'pedestrian' ? '#f6efe0' : '#ffffff'; g.lineWidth = r.w * MM_SCALE * 1.3; path(r.p); g.stroke(); }
  g.fillStyle = '#b98f62';
  for (const b of D.buildings) { path(b.p); g.closePath(); g.fill(); }
}
const mini = document.getElementById('mini').getContext('2d');
function drawMinimap() {
  const W = 200, zoom = 0.75;
  mini.save();
  mini.clearRect(0, 0, W, W);
  mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
  mini.translate(W / 2, W / 2);
  mini.rotate(car.th - Math.PI);
  mini.scale(zoom, zoom);
  mini.drawImage(mapCanvas, -(car.x - mapCanvas.ox) * MM_SCALE, -(car.z - mapCanvas.oz) * MM_SCALE);
  mini.restore();
  // Markers from other modules (missions, stigghiulari, other players), drawn after restore() in plain
  // screen space: rotate each offset by the same angle as the map (heading up), scale like the map.
  // Off-map markers are pinned to the rim so the direction still reads.
  const a = car.th - Math.PI, ca = Math.cos(a), sa = Math.sin(a), k = zoom * MM_SCALE;
  const toMap = (x, z) => { const dx = (x - car.x) * k, dz = (z - car.z) * k; return [W / 2 + dx * ca - dz * sa, W / 2 + dx * sa + dz * ca]; };
  if (mapRoute.length > 1) {
    mini.save(); mini.beginPath(); mini.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mini.clip();
    mini.lineCap = mini.lineJoin = 'round';
    for (const [w, c] of [[7, '#120a0e'], [4, '#e8559a']]) {
      mini.strokeStyle = c; mini.lineWidth = w; mini.beginPath();
      mapRoute.forEach(([x, z], i) => { const [px, pz] = toMap(x, z); i ? mini.lineTo(px, pz) : mini.moveTo(px, pz); });
      mini.stroke();
    }
    mini.restore();
  }
  for (const m of mapMarkers) {
    const dx = (m.x - car.x) * k, dz = (m.z - car.z) * k;
    let px = dx * ca - dz * sa, pz = dx * sa + dz * ca;
    const r = Math.hypot(px, pz), rim = W / 2 - 8, off = r > rim;
    if (off) { px *= rim / r; pz *= rim / r; }
    mini.fillStyle = m.color || '#e8559a'; mini.strokeStyle = '#000'; mini.lineWidth = 1.5;
    mini.beginPath(); mini.arc(W / 2 + px, W / 2 + pz, off ? 4 : (m.size || 5), 0, Math.PI * 2); mini.fill(); mini.stroke();
  }
  mini.fillStyle = '#c41e2a'; mini.strokeStyle = '#fff'; mini.lineWidth = 2;
  mini.beginPath(); mini.moveTo(W / 2, W / 2 - 9); mini.lineTo(W / 2 + 6, W / 2 + 7); mini.lineTo(W / 2 - 6, W / 2 + 7); mini.closePath(); mini.fill(); mini.stroke();
}

// ---------- HUD ----------
const elStreet = document.getElementById('street'), elLand = document.getElementById('landmark'), elSpeed = document.getElementById('speed');
let hudTimer = 0;
function updateHud(dt) {
  const v = Math.abs(car.vf || 0) * 3.6;
  elSpeed.firstChild.nodeValue = Math.round(game.settings.units === 'mph' ? v * 0.6214 : v);
  elSpeed.lastChild.textContent = game.settings.units === 'mph' ? 'mph' : 'km/h';
  if ((hudTimer -= dt) > 0) return;
  hudTimer = 0.25;
  let best = null, bd = Infinity;
  streets.query(car.x - 30, car.z - 30, car.x + 30, car.z + 30, s => {
    const [qx, qz] = closestOnSeg(car.x, car.z, s), d = Math.hypot(car.x - qx, car.z - qz) - s[5] / 2;
    if (d < bd) { bd = d; best = s[4]; }
  });
  elStreet.textContent = best && bd < 8 ? best : '';
  let lm = null, ld = Infinity;
  for (const l of D.labels) { const d = Math.hypot(l.x - car.x, l.z - car.z) / l.r; if (d < 1 && d < ld) { ld = d; lm = l.n; } }
  elLand.textContent = lm || '';
}

// ---------- loop ----------
// Touch controls, landscape prompt and HUD layout for phones write into the same keys map.
setupMobile({ keys, camState, renderer, camera });
placeAt(0, 0);
{ // ?spot=2&cam=1&turn=135 starts at a teleport spot, camera mode and heading offset in degrees
  const q = new URLSearchParams(location.search), spot = +q.get('spot'), turn = +q.get('turn');
  if (spot >= 1 && spot <= SPOTS.length) placeAt(...proj(SPOTS[spot - 1][1], SPOTS[spot - 1][2]));
  if (turn) car.th += turn * Math.PI / 180;
  if (q.has('cam')) camState.mode = +q.get('cam') % 4;
  if (q.has('help')) document.getElementById('help').classList.remove('show');
  // ?campos=x,y,z&look=x,y,z pins a free camera (for screenshots); proj() gives x,z from lat/lon.
  if (q.has('campos')) {
    const [p, l] = ['campos', 'look'].map(k => (q.get(k) || '0,0,0').split(',').map(Number));
    freeCam = () => { camera.position.set(...p); camera.lookAt(...l); };
    if (!q.has('hud')) document.querySelectorAll('.hud').forEach(e => e.style.display = 'none');
  }
}
if (location.search.includes('debug')) window.game = { perf, world, car, keys, physics, renderer, scene, camera, placeAt, proj, updateCamera, groundY, shout: shouts.shout };
// ---------- game state and settings (title screen, menus and options live in src/ui.js) ----------
// state: 'title' (menus over a flyover, no driving), 'play', 'pause'. ui.js may set game.titleCam
// to a function (camera, seconds) that moves the camera while not playing.
const game = {
  state: 'title', titleCam: null,
  time: { hour: 16.5, isNight: false, night: 0, dusk: 0 }, // [day/night] filled in by src/daynight.js every frame; modules may also listen for 'pd-time'
  settings: { quality: QUALITY.mobile ? 'low' : 'high', drawDistance: 1, volume: 0.8, units: 'kmh', camera: 0, ...{} },
  start() { this.state = 'play'; camState.mode = this.settings.camera; camState.init = false; showKeyHint(); },
  pause() { if (this.state === 'play') this.state = 'pause'; },
  resume() { if (this.state === 'pause') { this.state = 'play'; last = performance.now(); } },
};
// One place where options touch the renderer; ui.js calls it after changing game.settings.
function applySettings() {
  const st = game.settings, tier = { low: [1, 0], medium: [1.5, 1024], high: [2, QUALITY.shadowMap] }[st.quality] || [2, 4096];
  perf.setMax(Math.min(devicePixelRatio, tier[0], QUALITY.pixelRatio)); // [perf pass] ceiling; perf.js adapts below it
  renderer.shadowMap.enabled = tier[1] > 0;
  if (tier[1] && sun.shadow.mapSize.x !== tier[1]) { sun.shadow.mapSize.set(tier[1], tier[1]); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  scene.fog.density = 0.00014 / st.drawDistance;
  camera.far = 40000 * st.drawDistance; camera.updateProjectionMatrix();
  vehicle.setVolume?.(st.volume);
  traffic.setVolume?.(st.volume);
  pedestrians.setQuality?.(st.quality);
  traffic.setQuality?.(st.quality);
  roadwear.setQuality?.(st.quality);
}
// First drive on a keyboard: say once where the controls are, then get out of the way.
function showKeyHint() {
  if (QUALITY.mobile || document.getElementById('keyhint')) return;
  try { if (localStorage.getItem('palermoDrive.keyhint')) return; localStorage.setItem('palermoDrive.keyhint', '1'); } catch (e) { /* private mode: show it anyway */ }
  const el = document.createElement('div');
  el.id = 'keyhint';
  el.textContent = 'Premi ? per i comandi · Press ? for controls';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, 4500);
}
const params = new URLSearchParams(location.search);
horn = createHorn({ keys, car, getVolume: () => game.settings.volume ?? 0.8 });
// Screenshot/debug links skip the title screen.
if (['spot', 'campos', 'debug', 'play'].some(k => params.has(k))) game.state = 'play';
// ---------- game modes and multiplayer (src/missions.js, src/net.js) ----------
// Both get the world, the player and the shell state. update(dt) runs every frame (missions only while
// playing); they draw their own DOM and push minimap markers into mapMarkers.
const missions = createMissions({ ...worldEnv, game, vehicle, pedestrians, traffic, mapMarkers, mapRoute, placeAt, proj });
const net = createNet({ ...worldEnv, game, vehicle, mapMarkers });
const suca = createSuca({ scene, D, skip: ctx.skip, drivable: DRIVABLE, mapMarkers, world });
if (window.game) window.game.suca = suca;
// with the streamed world, a far start spot has to load before the lapa can find a road there
const placeStart = (x, z) => { try { placeAt(x, z); } catch (e) { /* no road yet */ } world?.teleport(x, z, () => placeAt(x, z)); };
setupUI({ game, applySettings, missions, net, camera, renderer, scene, vehicle, placeAt: placeStart, SPOTS, proj, groundY, D });
createRadio({ game }); // car radio (src/radio.js): starts on the first tap/key
applySettings();
// [day/night] after setupUI so the saved start time and cycle speed are known. SUN_DIR becomes the live light direction (sun, then moon).
const dayNight = createDayNight({ scene, renderer, sun, sky, hemi, camera, game, SUN_DIR, car, vehicle });
renderer.compile(scene, camera); // [perf pass] issue every program link up front so the driver compiles them in parallel instead of one by one on first use
document.getElementById('loading').remove();
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
renderer.setAnimationLoop(now => {
  perf.frame(now); // [perf pass]
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // never negative (headless virtual time)
  if (game.state === 'play') {
    for (acc += dt; acc >= STEP; acc -= STEP) { physics(STEP); traffic.collidePlayer?.(car); pedestrians.collidePlayer?.(car); roadwear.collidePlayer?.(car, STEP); propsApi.collidePlayer?.(car, STEP); world?.drivePlayer(car, STEP); /* world: off-road grip and bumps */ }
  } else acc = 0;
  if (game.state !== 'pause') { traffic.update?.(dt, camera); pedestrians.update?.(dt, camera); }
  if (game.state === 'play') missions.update?.(dt);
  if (game.state === 'play') suca.update(dt, car);
  roadwear.update?.(dt);
  net.update?.(dt);
  shouts.update(game.state === 'pause' ? 0 : dt);
  horn.update(dt, game.state === 'play');
  // sea.update animates the water; checkPlayer ends the run when the lapa drives into the sea.
  sea.update?.(dt, camera);
  // world: the baked coastline only covers the centro, so outside it the manifest's land polygon decides what is dry
  if (game.state === 'play' && !(world && world.isLand(car.x, car.z))) sea.checkPlayer?.({ car, game, vehicle, placeAt, shout: shouts.shout });

  dayNight.update(dt); // advances the clock (play only) and relights everything; rewrites SUN_DIR
  const carPos = vehicle.updateVisual(dt);
  sun.position.copy(carPos).addScaledVector(SUN_DIR, 300);
  sun.target.position.copy(carPos);

  if (freeCam) freeCam();
  else if (game.state === 'title' && game.titleCam) game.titleCam(camera, now / 1000);
  else updateCamera(dt);
  world?.update(dt, camera); // stream tiles around the camera
  updateHud(dt);
  drawMinimap();
  renderer.render(scene, camera);
});
