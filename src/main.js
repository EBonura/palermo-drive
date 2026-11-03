import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { D, FLOOR, LAT0, LON0, KX, KZ, proj, HAS_NEAR, NEAR, nearH, farH, inNear, groundY,
  Buf, pairs, signedArea, triUp, fillPoly, canvasTex, rnd, speckle } from './core.js';
import { hooks } from './core.js';
import { buildStreets, CURB } from './streets.js'; // street building moved out of main.js so world tiles reuse it
import { createWorld } from './world.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { prepareLandmarks } from './landmarks.js';   // the centro landmarks themselves are built by the streamer (world.js, CENTRO_LANDMARKS)
import { buildContext } from './context.js';
import { QUALITY, setupMobile } from './mobile.js';
import { createVehicle } from './vehicle.js';
import { setupUI } from './ui.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createNet } from './net.js';
import { createDrunk } from './drunk.js';   // a drink at a pub's door or at the rave: the screen wobbles (src/drunk.js)
import { createShouts } from './shouts.js';
import { createCityAudio } from './city-audio.js';   // traffic noise, horns, l'arrotino, the market voices
import { createMarkets } from './markets.js';   // Ballaro, the Vucciria and the Capo as living markets: stall lines along the real streets, awnings, crates, vendors
import { createCarrettoProp } from './carretto.js';   // the painted Sicilian cart that stands near the Cattedrale and the Quattro Canti
import { createStadium } from './stadium.js';   // the Barbera's crowd cheers while the lapa is on the pitch
import { createRoadWear } from './roadwear.js';
import { createHorn } from './horn.js';
import { createSuca } from './suca.js'; // SUCA wall tags to collect (src/suca.js)
import { createSea } from './sea.js';
import { createRadio } from './radio.js';
import { POI_SPOTS } from './pub-places.js';
import { createCoords } from './coords.js'; // ?coords or Options: position on screen for bug reports (src/coords.js)
import { watchVersion } from './version.js'; // "new version" button on the title screen (src/version.js)
import { createPerf } from './perf.js'; // adaptive render scale: ~30 fps on phones, 60 on desktop [perf pass]
import { createDayNight } from './daynight.js'; // day/night cycle: sun, sky, fog, lamps, windows, headlights (src/daynight.js)
import { createMinimap } from './minimap.js'; // round minimap, per-tile pieces (src/minimap.js)
import { zone } from './hud.js'; // the HUD's zones: one place for each kind of message (src/hud.js)
import { createLeanEngine } from './engine-lean.js'; // street-canyon culling, cached shadow map (docs/PERF-ENGINE.md); ?engine=off for comparing

// Neighbourhoods for the start picker's second tab: OSM place=suburb/neighbourhood/quarter nodes inside the comune
// (plus Noce and Zisa from Nominatim, which have no place node).
const QUARTIERI = [
  ['Albergheria', 38.111251, 13.358334], ['Il Capo', 38.117661, 13.355602], ['Kalsa', 38.115137, 13.367461], ['La Loggia', 38.119866, 13.364662],
  ['Olivuzza', 38.120092, 13.342101], ['Zisa', 38.1161147, 13.3411786], ['Noce', 38.1219509, 13.3334578], ['Altarello', 38.110381, 13.324993],
  ['Baida', 38.114102, 13.297628], ['Boccadifalco', 38.108972, 13.306518], ['Borgo Nuovo', 38.129106, 13.294677], ['Bellolampo', 38.137249, 13.273214],
  ['Passo di Rigano', 38.126318, 13.313429], ['Uditore', 38.132088, 13.325215], ['Cruillas', 38.143188, 13.320218], ['Inserra', 38.153439, 13.301051],
  ['Quartiere Matteotti', 38.141886, 13.342916], ['Resuttana', 38.154198, 13.333469], ['San Lorenzo', 38.160828, 13.325925], ['Patti', 38.171209, 13.319675],
  ['Pallavicino', 38.172533, 13.327618], ['Cardillo', 38.174603, 13.299546], ['Zen', 38.180561, 13.317062], ['Tommaso Natale', 38.190099, 13.287014],
  ['Sferracavallo', 38.198467, 13.277152], ['Partanna', 38.196114, 13.310577], ['Mondello', 38.206214, 13.324552], ['Valdesi', 38.196173, 13.330951],
  ['Addaura', 38.188966, 13.351365], ['Vergine Maria', 38.165799, 13.367677], ['Arenella', 38.152782, 13.375014], ['Acquasanta', 38.145398, 13.367408],
  ['Villaggio Santa Rosalia', 38.09855, 13.350514], ['Pagliarelli', 38.089992, 13.331153], ['Villagrazia', 38.077792, 13.335862], ['Molara', 38.08161, 13.310733],
  ['Falsomiele', 38.089746, 13.357153], ['Chiavelli', 38.082498, 13.368055], ['Guadagna', 38.098424, 13.368817], ['Settecannoli', 38.10056, 13.38309],
  ['Romagnolo', 38.104641, 13.388605], ['Brancaccio', 38.095578, 13.383682], ['Ciaculli', 38.078302, 13.401197], ['Roccella', 38.092384, 13.410641],
  ['Bandita', 38.097383, 13.416877], ['Acqua dei Corsari', 38.091611, 13.430685], ['Pomara', 38.084645, 13.43419], ['Croce Verde', 38.069522, 13.417503],
  ['Monte Pellegrino', 38.1600, 13.3545], ['Parco della Favorita', 38.1620, 13.3330], ['Politeama / Libertà', 38.1315, 13.3520], // groupings for the start picker (no OSM place node of their own)
];

const SPOTS = [
  ['Quattro Canti', 38.115684, 13.361460], // the crossing itself (17.5 m E of the projection origin)
  ['Teatro Massimo', 38.1199, 13.3573],
  ['Cattedrale', 38.1146, 13.3558],
  ['Palazzo dei Normanni', 38.1112, 13.3540],
  ['Piazza Pretoria', 38.1151, 13.3622],
  ['La Cala', 38.1203, 13.3676],
  ['Stazione Centrale', 38.1092, 13.3655],
  // More starting points (Nominatim/OSM positions). Keys 1-7 reach the first seven; the start picker lists all. A 4th item names the picker's group when the nearest quartiere centre is not the right one.
  ['Vucciria (Piazza Garraffello)', 38.1179401, 13.3649292],
  ['Piazza Marina', 38.1177752, 13.3686382],
  ['Mercato del Capo', 38.1186189, 13.3540701],
  ['Piazza Bellini', 38.1149189, 13.3625335],
  ['Piazza San Domenico', 38.1188139, 13.3629446],
  // outside the centro (Nominatim positions)
  ['Politeama (Piazza Ruggero Settimo)', 38.1247846, 13.3559943, 'Politeama / Libertà'],
  ['Via della Libertà', 38.1387821, 13.3465045, 'Politeama / Libertà'],
  ['Porta Felice e Foro Italico', 38.1195699, 13.3713217],
  ['Stadio Renzo Barbera', 38.1528194, 13.3420112],
  ['La Favorita (Palazzina Cinese)', 38.1667781, 13.3303513],
  ['Santuario di Santa Rosalia', 38.1680111, 13.3518430],
  ['Mondello (la piazza)', 38.2077898, 13.3266288],
  ['Castello Utveggio', 38.1520766, 13.3556805],
  ['Castello della Zisa', 38.1161147, 13.3411786],
  ['La Cuba (Corso Calatafimi)', 38.1075791, 13.3426146],
  ['Villa Giulia e Orto Botanico', 38.1134959, 13.3756082],
  ['Ponte dell\'Ammiraglio', 38.1051828, 13.3750044],
  ['Tonnara Florio (Arenella)', 38.1516884, 13.3744234],
  ['Giardino Inglese', 38.1312509, 13.3522947, 'Politeama / Libertà'],
  ['Fiera del Mediterraneo', 38.1445037, 13.3565490],
  ['Piazza Leoni (ingresso Favorita)', 38.1468260, 13.3433865],
  ['Piazza Sant\'Anna', 38.1149181, 13.3651434],
  ['Stazione Notarbartolo', 38.1315626, 13.3408256],
  // Starts near the secrets and vendors that have no pin of their own (the parked cars at night, the Ballarò and Noce corners, the Ponte Corleone). Each sits on a road vertex 20 to 45 m from what it leads to, with the lapa facing it when the road allows. Street names from the world tiles.
  ['Via Pietro Bonanno (Monte Pellegrino)', 38.152401, 13.361362, 'Monte Pellegrino'],
  ['Via Padre Giordano Cascini (Monte Pellegrino)', 38.17508, 13.361156, 'Monte Pellegrino'],
  ['Via Santuario (Monte Pellegrino)', 38.167059, 13.349603],
  ['Viale del Fante (Favorita)', 38.149991, 13.342344, 'Resuttana'],
  ['Via Antonino Cassarà', 38.151452, 13.339932],
  ['Viale Ercole (Favorita)', 38.151714, 13.347661, 'Parco della Favorita'],
  ['Piazza Ballarò', 38.1113556, 13.3615778],
  ['Piazza Noce', 38.1219451, 13.3329544],
  ['Ponte Corleone (Viale Regione Siciliana)', 38.090479, 13.343314],
];
SPOTS.push(...POI_SPOTS); // points of interest from the pubs work (Piazza Magione), src/pub-places.js

// ---------- renderer / scene ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatio));
// [perf pass] The production build defines __PD_PROD__: skipping the per-program compile/link status query lets the browser compile shaders in parallel.
if (typeof __PD_PROD__ !== 'undefined') renderer.debug.checkShaderErrors = false;
const perf = createPerf({ renderer, mobile: QUALITY.mobile });
{ const maxA = renderer.capabilities.getMaxAnisotropy(); renderer.capabilities.getMaxAnisotropy = () => Math.min(4, maxA); } // [perf pass] cap anisotropic filtering at 4x whatever the modules ask for, on every device // [perf pass] moves the pixel ratio up to the ceiling set in applySettings()
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
sun.shadow.mapSize.set(1024, 1024); // the default tier (medium) on every device
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

// Raised-ground lookup so the car bumps up onto sidewalks.
let world = null; // world streamer (src/world.js): the whole city in 500 m tiles
// the tiles bring the raised-ground masks (src/world.js buildRaised); the baked centro's own street slab (D.streets.raised) is no longer used: the centro's tiles
// have the Comune's pavements, a slab of "everything near a building" would make the car climb onto courtyards
const raisedMask = (x, z) => world !== null && world.raised(x, z);

const MOUNTAIN_HAZE = new THREE.Color('#7297b4');

// The sea surface, shoreline foam and the drowning game over live in src/sea.js.
const sea = createSea({ scene, camera, renderer, sun, SUN_DIR, D, groundY, getWorld: () => world });

// ---------- modules ----------
let freeCam = null;
const ctx = { scene, renderer, skip: new Set(), raisedMask, CURB };
prepareLandmarks(ctx);
// Props may return { collidePlayer(car, dt) } for parked cars, bins, scooters, breakable trees.
const propsApi = buildProps(ctx) || {};
// [perf pass] In the production build the far-city data (window.PALERMO_CONTEXT) arrives after the game has started (window.__pdLate, see
// tools/build/runtime/loader.js); the far city is then built once the browser is idle. In the dev tree the data is there at once.
if (window.__pdLate) await window.__pdLate; // the context group goes to the streamer, so wait for it
let contextGroup = window.PALERMO_CONTEXT ? buildContext(ctx) : null; // world: hidden chunk by chunk where real tiles stand
if (!contextGroup && window.__pdLate) window.__pdLate.then(() => (window.requestIdleCallback || setTimeout)(() => { contextGroup = buildContext(ctx); }, { timeout: 1500 }));

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

// ---------- world streaming (src/world.js) ----------
// Streams the whole-city tiles around the camera: terrain, streets, buildings, per-tile walls/road names/road vertices.
world = createWorld({ scene, camera, renderer, ctx, walls2d, streets, roadVerts, DRIVABLE, context: contextGroup });
propsApi.attachWorld?.(world); // street props are built per tile as it reaches full detail (src/props.js)

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
  if (n >= 1 && n <= SPOTS.length) { const [x, z] = proj(SPOTS[n - 1][1], SPOTS[n - 1][2]); placeAt(x, z); world?.teleport(x, z, () => placeAt(x, z)); }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- player car (src/vehicle.js) ----------
const vehicle = createVehicle({ scene, camera, keys, walls2d, closestOnSeg, raisedMask, CURB, roadVerts, viewBlock: propsApi.occlude, sea, world });   // sea, world: floats and wings (src/vehicle-water.js, src/vehicle-air.js)
const { car, camState, placeAt, physics, updateCamera } = vehicle;
zone('gauges').append(document.querySelector('.nosbar'));   // the nitro bar stands next to the speed
world?.bind({ placeAt }); // world: lets ?at=x,z / world.teleport place the car once the destination has streamed in

// ---------- traffic and pedestrians (src/traffic.js, src/pedestrians.js) ----------
// update(dt, camera) runs every frame while playing or on the title flyover; collidePlayer(car) runs
// after each fixed physics step and may push the player (car.x/z/vx/vz) like a wall hit.
// shout(x, y, z, text?) pops a swearing balloon over whoever the lapa just hit (src/shouts.js).
const shouts = createShouts(camera);
// Modules without env access (props) can raise a balloon with a 'pd-shout' event.
addEventListener('pd-shout', e => { const d = e.detail || {}; shouts.shout(d.x, d.y, d.z, d.text, d.follow); });   // follow: a parked car in the air keeps its balloon (src/props.js)
let horn; // created once game settings exist (volume)
const worldEnv = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, shout: shouts.shout, world }; // world: the tile streamer, see docs/TILES.md for onTile
const stadium = createStadium({ ...worldEnv, vehicle });
const traffic = createTraffic(worldEnv);
const pedestrians = createPedestrians({ ...worldEnv, traffic, props: propsApi });   // props: the sunbeds and umbrellas, which the sunbathers keep off
const carretto = createCarrettoProp({ ...worldEnv, proj }); carretto.bindPedestrians(pedestrians);
const markets = createMarkets({ ...worldEnv, proj, props: propsApi }); markets.bindPedestrians(pedestrians);
// Potholes, patches and tyre marks on the asphalt; collidePlayer jolts the lapa over holes.
const roadwear = createRoadWear({ ...worldEnv, vehicle });
const mapMarkers = []; // { x, z, color, size } drawn on the minimap
const mapRoute = []; // [x, z] points of the current route, drawn as a line on the minimap

// ---------- minimap (src/minimap.js) ----------
const minimap = createMinimap({ canvas: document.getElementById('mini'), car, world, DRIVABLE, mapMarkers, mapRoute });

// ---------- HUD ----------
const elStreet = document.getElementById('street'), elLand = document.getElementById('landmark'), elSpeed = document.getElementById('speed');
let hudTimer = 0, hudSpd = -1, hudUnit = '', hudStreet = '', hudLand = '';
function updateHud(dt) {
  const v = Math.abs(car.vf || 0) * 3.6, mph = game.settings.units === 'mph', n = Math.round(mph ? v * 0.6214 : v), u = mph ? 'mph' : 'km/h';
  // [perf pass] text only when it changes: a DOM write every frame, even of the same string, restyles the page (about 0.4 ms a frame at 4x CPU)
  if (n !== hudSpd) { hudSpd = n; elSpeed.firstChild.nodeValue = n; }
  if (u !== hudUnit) { hudUnit = u; elSpeed.lastChild.textContent = u; }
  if ((hudTimer -= dt) > 0) return;
  hudTimer = 0.25;
  let best = null, bd = Infinity;
  streets.query(car.x - 30, car.z - 30, car.x + 30, car.z + 30, s => {
    const [qx, qz] = closestOnSeg(car.x, car.z, s), d = Math.hypot(car.x - qx, car.z - qz) - s[5] / 2;
    if (d < bd) { bd = d; best = s[4]; }
  });
  { const t = best && bd < 8 ? best : ''; if (t !== hudStreet) { hudStreet = t; elStreet.textContent = t; } }
  let lm = null, ld = Infinity;
  for (const l of D.labels) { const d = Math.hypot(l.x - car.x, l.z - car.z) / l.r; if (d < 1 && d < ld) { ld = d; lm = l.n; } }
  { const t = lm || ''; if (t !== hudLand) { hudLand = t; elLand.textContent = t; } }
}

// ---------- loop ----------
// Touch controls, landscape prompt and HUD layout for phones write into the same keys map.
const mobile = setupMobile({ keys, camState, renderer, camera });
placeAt(0, 0);
{ // ?spot=2&cam=1&turn=135 starts at a teleport spot, camera mode and heading offset in degrees
  const q = new URLSearchParams(location.search), spot = +q.get('spot'), turn = +q.get('turn');
  if (spot >= 1 && spot <= SPOTS.length) { // far spots wait for their tiles before the lapa looks for a road
    const [x, z] = proj(SPOTS[spot - 1][1], SPOTS[spot - 1][2]);
    placeAt(x, z); world?.teleport(x, z, () => { placeAt(x, z); if (turn) car.th += turn * Math.PI / 180; });
  }
  if (turn) car.th += turn * Math.PI / 180;
  if (q.has('cam')) camState.mode = +q.get('cam') % 4;
  if (q.has('help')) document.getElementById('help').classList.remove('show');
  // ?campos=x,y,z&look=x,y,z pins a free camera (for screenshots); proj() gives x,z from lat/lon.
  if (q.has('campos')) {
    const [p, l] = ['campos', 'look'].map(k => (q.get(k) || '0,0,0').split(',').map(Number));
    const aerial = q.has('aerial'); // ?aerial: no haze and a far clip plane, for whole-map overview shots
    freeCam = () => {
      camera.position.set(...p); camera.lookAt(...l);
      if (aerial) { if (camera.far < 90000) { camera.far = 90000; camera.updateProjectionMatrix(); } if (scene.fog) scene.fog.density = 0.000004; }
    };
    if (!q.has('hud')) document.querySelectorAll('.hud').forEach(e => e.style.display = 'none');
  }
  // ?clean: the picture only, no HUD, menu, minimap or toasts (the share images, assets/ui/make-cover.sh)
  if (q.has('clean')) { const st = document.createElement('style'); st.textContent = 'body > :not(#view) { visibility: hidden !important; }'; document.head.appendChild(st); }
}
if (location.search.includes('debug')) window.game = { perf, world, car, keys, physics, renderer, scene, camera, placeAt, proj, updateCamera, groundY, walls2d, markets, shout: shouts.shout };
// ---------- game state and settings (title screen, menus and options live in src/ui.js) ----------
// state: 'title' (menus over a flyover, no driving), 'play', 'pause'. ui.js may set game.titleCam
// to a function (camera, seconds) that moves the camera while not playing.
const game = {
  state: 'title', titleCam: null, noRender: false, garage: null, // garage: set while the Garage is open (src/garage-scene.js): its own scene, the city is neither simulated nor drawn
  time: { hour: 16.5, isNight: false, night: 0, dusk: 0 }, // [day/night] filled in by src/daynight.js every frame; modules may also listen for 'pd-time'
  settings: { quality: 'medium', drawDistance: 1, volume: 0.8, units: 'kmh', camera: 0, ...{} },
  start() { this.state = 'play'; camState.mode = this.settings.camera; camState.init = false; showKeyHint(); },
  pause() { if (this.state === 'play') this.state = 'pause'; },
  resume() { if (this.state === 'pause') { this.state = 'play'; last = performance.now(); } },
};
// One place where options touch the renderer; ui.js calls it after changing game.settings.
function applySettings() {
  const st = game.settings, tier = { low: [1, 0], medium: [1.5, 1024], high: [2, 2048] }[st.quality] || [2, 2048];
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
  zone('act').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, 4500);
}
const params = new URLSearchParams(location.search);
horn = createHorn({ keys, car, getVolume: () => game.settings.volume ?? 0.8 });
// Game audio starts inside the user's tap: the shell dispatches 'pd-gesture' on the title tap, Drive and Resume (src/ui.js gesture(), which also calls vehicle.unlockAudio; the radio listens to the event too),
// and the horn's own context is made here as well, so that the first honk does not create it outside a gesture.
addEventListener('pd-gesture', () => { vehicle.unlockAudio?.(); horn.unlock(); });
for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend']) addEventListener(ev, () => horn.unlock(), { passive: true });
// Screenshot/debug links skip the title screen.
if (['spot', 'campos', 'debug', 'play'].some(k => params.has(k))) game.state = 'play';
// ---------- game modes and multiplayer (src/missions.js, src/net.js) ----------
// Both get the world, the player and the shell state. update(dt) runs every frame (missions only while
// playing); they draw their own DOM and push minimap markers into mapMarkers.
const missions = createMissions({ ...worldEnv, game, vehicle, pedestrians, traffic, mapMarkers, mapRoute, placeAt, proj });
// Multiplayer is peer to peer (src/p2p/p2p.js, docs/P2P-MULTIPLAYER.md), and nothing connects until the player says yes on its name card. ?p2p=off falls back to the relay client, which does nothing without a relay.
const net = (typeof __PD_P2P__ === 'undefined' || __PD_P2P__) && params.get('p2p') !== 'off' ? (await import('./p2p/p2p.js')).createP2P({ ...worldEnv, game, vehicle, mapMarkers, getDrunk: () => drunk }) : createNet({ ...worldEnv, game, vehicle, mapMarkers });
const suca = createSuca({ scene, D, skip: ctx.skip, drivable: DRIVABLE, mapMarkers, world, getVolume: () => game.settings.volume ?? 0.8 });
if (window.game) window.game.suca = suca;
const drunk = createDrunk({ game, car, camera, missions });
if (window.game) window.game.drunk = drunk;
if (window.game) window.game.traffic = traffic;
traffic.bindClock(game.time);   // the knife-grinders work from 07:30 to 20:00 (src/arrotini.js)
// With the streamed world, a far start spot has to load before the lapa can find a road there. Returns a Promise that resolves once the start
// tile is at full detail and the lapa stands on its road (or after 12 s, so a shell transition never stays covered for ever).
const placeStart = (x, z) => new Promise(done => {
  try { placeAt(x, z); } catch (e) { /* no road yet */ }
  if (!world) return done();
  const t = setTimeout(done, 12000);
  world.teleport(x, z, () => { placeAt(x, z); clearTimeout(t); done(); });
});
let radio = null;
setupUI({ game, applySettings, missions, suca, getRadio: () => radio, world, net, camera, renderer, scene, vehicle, placeAt: placeStart, SPOTS, QUARTIERI, proj, groundY, D });
radio = createRadio({ game }); // car radio (src/radio.js): starts on the first tap/key; its controls live in the side menu
const cityAudio = createCityAudio({ scene, camera, car, game, traffic, getRadio: () => radio, mapMarkers, groundY });   // on the radio's AudioContext, so also from the first tap
if (window.game) window.game.cityAudio = cityAudio;
watchVersion(game);
const coords = createCoords({ game, car, camera, groundY });
applySettings();
// [day/night] after setupUI so the saved start time and cycle speed are known. SUN_DIR becomes the live light direction (sun, then moon).
const dayNight = createDayNight({ scene, renderer, sun, sky, hemi, camera, game, SUN_DIR, car, vehicle });
if (params.get('engine') !== 'off') { const lean = createLeanEngine({ renderer, scene, camera, sun, world, parts: (params.get('lean') || 'occ,shadow,walk').split(',') }); if (window.game) window.game.lean = lean; }   // ?engine=off draws as three.js does on its own (for comparing)
renderer.compile(scene, camera); // [perf pass] issue every program link up front so the driver compiles them in parallel instead of one by one on first use
// The loading screen stays up until everything the first view can see is built (world.visiblePending() is 0 for two frames), so the title
// never shows tiles popping in; the rest of the ring keeps building behind it. The flyover clock holds at 0 meanwhile (a moving camera
// would bring new tiles into view), and world.hurry lets the streamer use most of each frame while the screen is covered. The wait is
// capped so a slow phone still gets in.
let titleT0 = -1;
if (world) world.hurry = true;
(function waitForCity(t0 = performance.now(), calm = 0) {
  calm = !world || world.visiblePending() === 0 ? calm + 1 : 0;
  if (calm < 2 && performance.now() - t0 < 25000) return requestAnimationFrame(() => waitForCity(t0, calm));
  if (world) world.hurry = false;
  const el = document.getElementById('loading');
  titleT0 = performance.now(); el.classList.add('out'); setTimeout(() => el.remove(), 500);
})();
let last = performance.now(), acc = 0, rotHeld = false;
const STEP = 1 / 120;
renderer.setAnimationLoop(now => {
  perf.frame(now); // [perf pass]
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); const away = now - last; last = now; // never negative (headless virtual time)
  if (game.garage) { // the Garage: draw its scene and nothing else, so the street is exactly as it was when we come back (the flyover clock is held too)
    if (titleT0 >= 0) titleT0 += Math.max(0, away);
    acc = 0; game.garage.frame(dt, now / 1000);
    renderer.render(game.garage.scene, game.garage.camera);
    return;
  }
  // the "turn your phone" prompt covers the screen in portrait: the game waits behind it (paused, with no menu opened) and goes on when the phone is turned
  if (mobile.rotatePrompt()) { if (game.state === 'play') { game.pause(); rotHeld = true; } } else if (rotHeld) { rotHeld = false; game.resume(); }
  if (game.state === 'play') {
    for (acc += dt; acc >= STEP; acc -= STEP) {
      physics(STEP);
      const high = car.agl > 3, wet = car.wet > 0.5;   // up in the air the street cannot touch the lapa (src/vehicle-air.js); on the water there are no potholes or sand
      if (!high) { traffic.collidePlayer?.(car); pedestrians.collidePlayer?.(car); }
      if (!high && !wet) roadwear.collidePlayer?.(car, STEP);
      if (!high) propsApi.collidePlayer?.(car, STEP);
      if (!high && !wet) world?.drivePlayer(car, STEP); /* world: off-road grip and bumps */
    }
  } else acc = 0;
  if (game.state !== 'pause') { traffic.update?.(dt, camera); pedestrians.update?.(dt, camera); }
  cityAudio.update(dt, game.state === 'pause');
  if (game.state === 'play') missions.update?.(dt);
  drunk.update(dt);
  if (game.state === 'play') suca.update(dt, car);
  if (game.state === 'play') { stadium.update(dt); carretto.update(dt); markets.update(dt); }
  coords.update();
  roadwear.update?.(dt);
  net.update?.(dt);
  shouts.update(game.state === 'pause' ? 0 : dt);
  horn.update(dt, game.state === 'play');
  // sea.update animates the water; checkPlayer ends the run when the lapa drives into the sea.
  sea.update?.(dt, camera);
  if (car.wet > 0.05 && game.state === 'play') sea.wake?.(car, dt);   // a lapa on floats: foam and spray (src/sea.js)
  // world: the baked coastline only covers the centro, so outside it the manifest's land polygon decides what is dry
  if (game.state === 'play' && !(world && world.isLand(car.x, car.z))) sea.checkPlayer?.({ car, game, vehicle, placeAt, shout: shouts.shout });

  dayNight.update(dt); // advances the clock (play only) and relights everything; rewrites SUN_DIR
  const carPos = vehicle.updateVisual(dt);
  const sunY = car.flying ? Math.min(carPos.y, groundY(car.x, car.z) + 25) : carPos.y;   // up in the air the shadows stay on the city below (the shadow box is 320 m wide)
  sun.position.set(carPos.x, sunY, carPos.z).addScaledVector(SUN_DIR, 300);
  sun.target.position.set(carPos.x, sunY, carPos.z);

  if (freeCam) freeCam();
  else if ((game.state === 'title' || game.state === 'pause') && game.titleCam) game.titleCam(camera, titleT0 < 0 ? 0 : (now - titleT0) / 1000); // flyover on the title, the garage turntable from the side menu
  else updateCamera(dt);
  if (world) world.overview = game.state === 'title';
  world?.update(dt, camera); // stream tiles around the camera
  updateHud(dt);
  minimap.draw(dt);
  if (!game.noRender) drunk.render(renderer, scene, camera, !!freeCam); // the start picker's map is opaque: nothing to draw under it; drunk.render is renderer.render when sober, and while drunk the wobble of the camera plus the screen shader (src/drunk.js)
});
