// Pedestrians: 4-direction billboard sprites walking sidewalks, pedestrian streets and piazze. Owned by the pedestrian work.
// createPedestrians(env) with env = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, traffic }.
// Returns { update(dt, camera), collidePlayer(car), setQuality('low'|'medium'|'high'), stats }.
//
// How it works
// - Art: assets/peds/sprites.js draws 44 pixel-art characters x 4 directions x 4 poses onto one canvas atlas.
// - Rendering: two InstancedBufferGeometry draws (sprites, blob shadows) fed by the same per-instance buffers.
//   The vertex shader billboards around the vertical axis only; the CPU picks the atlas cell from the angle between
//   the camera and the walking direction and from the walk phase.
// - Walkability: a lazily built raster mask (0.5 m cells, 64 m tiles) made from the street polygons, the pedestrian
//   centrelines, zebra strips and the building footprints. Cell classes: 0 blocked, 1 sidewalk/paving/piazza,
//   2 minor carriageway or grass (allowed, disliked), 3 zebra crossing.
// - Crowd: density map by place (markets, Maqueda, Cassaro, piazze), spawn/despawn in a disc around the camera.
import * as THREE from 'three';
import { VARIANTS, ROWS, COLS, POSES, DIRS, CELL_W, CELL_H, buildAtlas } from '../assets/peds/sprites.js';

const TAU = Math.PI * 2;
const TILE = 64, CPM = 2, TCELLS = TILE * CPM;          // tile size in metres, cells per metre, cells per tile side
const PX = 0.04;                                         // metres per sprite pixel (adult 44 px = 1.76 m)
const WALK = 0, IDLE = 1, WAIT = 2, DODGE = 3, FLY = 4, LIE = 5, GETUP = 6;
const QUALITIES = { low: { cap: 120, R: 80 }, medium: { cap: 240, R: 100 }, high: { cap: 380, R: 120 } };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

export function createPedestrians(env) {
  const { scene, camera, car, groundY, raisedMask, CURB, walls2d, D } = env;
  const params = new URLSearchParams(location.search);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let quality = QUALITIES[coarse ? 'low' : 'high'];
  if (params.has('peds')) quality = { cap: Math.max(0, +params.get('peds') | 0), R: quality.R };
  const CAP = 420;
  const stats = { ms: 0, avgMs: 0, maxMs: 0, count: 0, target: 0, tileMs: 0, tiles: 0 };
  if (!D.streets) return { update() {}, collidePlayer() {}, setQuality() {}, stats, spawnScripted: () => -1, walkTo() {}, face() {}, attachTo() {}, detach() {}, remove() {}, info: () => null, setBounce() {}, near: () => 0, onKnock() {} };

  // ======================================================================== walkability mask
  const [AX0, AZ0, AX1, AZ1] = D.streets.aoi;
  const NTX = Math.ceil((AX1 - AX0) / TILE) + 1, NTZ = Math.ceil((AZ1 - AZ0) / TILE) + 1;
  const tileItems = new Array(NTX * NTZ);                // per tile: indices into items
  const items = [];                                       // {g: pass, rings|line, w}
  const addItem = (it, x0, z0, x1, z1) => {
    const id = items.length; items.push(it);
    const tx0 = Math.max(0, Math.floor((x0 - AX0) / TILE)), tx1 = Math.min(NTX - 1, Math.floor((x1 - AX0) / TILE));
    const tz0 = Math.max(0, Math.floor((z0 - AZ0) / TILE)), tz1 = Math.min(NTZ - 1, Math.floor((z1 - AZ0) / TILE));
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { const k = tz * NTX + tx; (tileItems[k] || (tileItems[k] = [])).push(id); }
  };
  const bbox = flat => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < flat.length; i += 2) { const x = flat[i], z = flat[i + 1]; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; } return [a, b, c, d]; };
  // passes: 0 class-2 fill, 1 class-1 fill, 2 class-3 fill, 3 erase
  const addPoly = (g, rings) => { const b = bbox(rings[0]); addItem({ g, rings }, b[0], b[1], b[2], b[3]); };
  const addLine = (g, p, w) => { const b = bbox(p), m = w / 2 + 1; addItem({ g, line: p, w }, b[0] - m, b[1] - m, b[2] + m, b[3] + m); };
  for (const poly of D.streets.green) addPoly(0, poly);
  for (const poly of D.streets.paving) addPoly(1, poly);
  for (const poly of D.streets.raised) addPoly(1, poly);
  for (const poly of D.streets.water) addPoly(3, poly);
  for (const b of D.buildings) addPoly(3, b.holes && b.holes.length ? [b.p, ...b.holes] : [b.p]);
  const MINOR = new Set(['residential', 'living_street', 'service', 'unclassified']), WALKWAY = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'pier']);
  const roadSegs = new Map();                             // 32 m grid of carriageway segments for the zebra builder
  const RG = 32, rgk = (i, j) => i * 100003 + j;
  for (const r of D.roads) {
    if (MINOR.has(r.k)) addLine(0, r.p, Math.min(r.w || 5, 5));
    else if (WALKWAY.has(r.k)) addLine(1, r.p, Math.max(r.w || 2, 2));
    if (r.k === 'pier' || WALKWAY.has(r.k) || r.k === 'cycleway') continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const s = [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w || 6];
      for (let ix = Math.floor(Math.min(s[0], s[2]) / RG); ix <= Math.floor(Math.max(s[0], s[2]) / RG); ix++)
        for (let iz = Math.floor(Math.min(s[1], s[3]) / RG); iz <= Math.floor(Math.max(s[1], s[3]) / RG); iz++) { const k = rgk(ix, iz); let a = roadSegs.get(k); if (!a) roadSegs.set(k, a = []); a.push(s); }
    }
  }
  // zebra strips from the OSM crossing nodes, laid across the nearest carriageway
  const P = window.PALERMO_PROPS || { items: [] };
  const idleGrid = new Map(); const IG = 24;               // cafes, benches, bus stops: places where people stand around
  for (const it of P.items) {
    if (it.k === 'cafe' || it.k === 'bench' || it.k === 'busstop' || it.k === 'fountain' || it.k === 'monument') {
      const k = rgk(Math.floor(it.x / IG), Math.floor(it.z / IG)); let a = idleGrid.get(k); if (!a) idleGrid.set(k, a = []); a.push(it);
    }
    if (it.k !== 'crossing' || it.cr === 'unmarked' || it.den === 'unmarked') continue;
    let best = null, bd = 6;
    for (let ix = Math.floor((it.x - 6) / RG); ix <= Math.floor((it.x + 6) / RG); ix++) for (let iz = Math.floor((it.z - 6) / RG); iz <= Math.floor((it.z + 6) / RG); iz++) {
      const a = roadSegs.get(rgk(ix, iz)); if (!a) continue;
      for (const s of a) {
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; if (!l2) continue;
        const t = clamp(((it.x - s[0]) * dx + (it.z - s[1]) * dz) / l2, 0, 1), d = Math.hypot(it.x - s[0] - dx * t, it.z - s[1] - dz * t);
        if (d < bd) { bd = d; best = [s[0] + dx * t, s[1] + dz * t, dx, dz, s[4]]; }
      }
    }
    if (!best) continue;
    const l = Math.hypot(best[2], best[3]), tx = best[2] / l, tz = best[3] / l, nx = -tz, nz = tx, hl = Math.max(best[4] / 2 + 2.5, 4), hw = 1.5;
    const cx = best[0], cz = best[1];
    const ring = [cx + tx * hw + nx * hl, cz + tz * hw + nz * hl, cx - tx * hw + nx * hl, cz - tz * hw + nz * hl, cx - tx * hw - nx * hl, cz - tz * hw - nz * hl, cx + tx * hw - nx * hl, cz + tz * hw - nz * hl];
    addPoly(2, [ring]);
  }

  const tiles = new Array(NTX * NTZ);
  const tcv = document.createElement('canvas'); tcv.width = tcv.height = TCELLS;
  const tg = tcv.getContext('2d', { willReadFrequently: true });
  const PASS_COL = ['#00ff00', '#ff0000', '#0000ff'];
  function buildTile(tx, tz) {
    const t0 = performance.now();
    const x0 = AX0 + tx * TILE, z0 = AZ0 + tz * TILE, list = tileItems[tz * NTX + tx] || [];
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, TCELLS, TCELLS);
    tg.setTransform(CPM, 0, 0, CPM, -x0 * CPM, -z0 * CPM); tg.lineJoin = 'round'; tg.lineCap = 'round';
    for (let pass = 0; pass < 4; pass++) {
      if (pass === 3) { tg.globalCompositeOperation = 'destination-out'; tg.strokeStyle = '#000'; tg.lineWidth = 0.9; tg.fillStyle = '#000'; }
      else { tg.fillStyle = PASS_COL[pass]; tg.strokeStyle = PASS_COL[pass]; }
      for (const id of list) {
        const it = items[id]; if (it.g !== pass) continue;
        tg.beginPath();
        if (it.line) {
          const p = it.line; tg.lineWidth = it.w; tg.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) tg.lineTo(p[i], p[i + 1]); tg.stroke();
        } else {
          for (const ring of it.rings) { tg.moveTo(ring[0], ring[1]); for (let i = 2; i < ring.length; i += 2) tg.lineTo(ring[i], ring[i + 1]); tg.closePath(); }
          tg.fill('evenodd'); if (pass === 3) tg.stroke();
        }
      }
    }
    const d = tg.getImageData(0, 0, TCELLS, TCELLS).data, m = new Uint8Array(TCELLS * TCELLS);
    for (let i = 0, j = 3; i < m.length; i++, j += 4) {
      if (d[j] < 128) continue;
      const r = d[j - 3], g = d[j - 2], b = d[j - 1];
      m[i] = r >= g && r >= b ? 1 : b > g ? 3 : 2;
    }
    tiles[tz * NTX + tx] = m; stats.tiles++; stats.tileMs += performance.now() - t0;
    return m;
  }
  // mask class at a world position; unbuilt tiles read as blocked and are queued
  function cell(x, z) {
    const fx = (x - AX0) * CPM, fz = (z - AZ0) * CPM;
    if (fx < 0 || fz < 0) return 0;
    const gx = fx | 0, gz = fz | 0, tx = gx >> 7, tz = gz >> 7;
    if (tx >= NTX || tz >= NTZ) return 0;
    const m = tiles[tz * NTX + tx];
    if (!m) return 0;
    return m[(gz & 127) * TCELLS + (gx & 127)];
  }
  const ensureTilesAround = (x, z, r, budgetMs) => {
    const t0 = performance.now(); let built = 0;
    const tx0 = Math.max(0, Math.floor((x - r - AX0) / TILE)), tx1 = Math.min(NTX - 1, Math.floor((x + r - AX0) / TILE));
    const tz0 = Math.max(0, Math.floor((z - r - AZ0) / TILE)), tz1 = Math.min(NTZ - 1, Math.floor((z + r - AZ0) / TILE));
    const need = [];
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) if (!tiles[tz * NTX + tx]) need.push([Math.hypot(AX0 + (tx + 0.5) * TILE - x, AZ0 + (tz + 0.5) * TILE - z), tx, tz]);
    need.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz] of need) { if (built && performance.now() - t0 > budgetMs) break; buildTile(tx, tz); built++; }
    return need.length - built;
  };

  // ======================================================================== density map (people per m2 of walkable ground)
  const DC = 8, DNX = Math.ceil((AX1 - AX0) / DC), DNZ = Math.ceil((AZ1 - AZ0) / DC);
  const BASE = 0.005, dens = new Float32Array(DNX * DNZ).fill(BASE), zone = new Uint8Array(DNX * DNZ);   // zones: 0 vicoli, 1 main street, 2 market, 3 tourist, 4 match-day
  const stamp = (x, z, r, v, zn) => {
    const i0 = Math.max(0, Math.floor((x - r - AX0) / DC)), i1 = Math.min(DNX - 1, Math.floor((x + r - AX0) / DC));
    const j0 = Math.max(0, Math.floor((z - r - AZ0) / DC)), j1 = Math.min(DNZ - 1, Math.floor((z + r - AZ0) / DC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(AX0 + (i + 0.5) * DC - x, AZ0 + (j + 0.5) * DC - z); if (d > r) continue;
      const f = 1 - d / r, vv = BASE + (v - BASE) * Math.min(1, f * 1.6), k = j * DNX + i;
      if (vv > dens[k]) { dens[k] = vv; zone[k] = zn; }
    }
  };
  {
    const KX = Math.cos(38.11572 * Math.PI / 180) * 111320, KZ = 110540, pr = (la, lo) => [(lo - 13.36126) * KX, -(la - 38.11572) * KZ];
    const hot = (la, lo, r, v, zn) => { const [x, z] = pr(la, lo); stamp(x, z, r, v, zn); };
    hot(38.115684, 13.36146, 100, 0.05, 1);    // Quattro Canti
    hot(38.1151, 13.3622, 60, 0.05, 3);        // Piazza Pretoria
    hot(38.1199, 13.3573, 85, 0.05, 3);        // Teatro Massimo
    hot(38.1146, 13.3558, 70, 0.04, 3);       // Cattedrale
    hot(38.1092, 13.3655, 60, 0.03, 1);        // Stazione
    stamp(-60, 410, 105, 0.14, 2);             // Ballaro
    stamp(260, -220, 110, 0.14, 2);            // Vucciria / Garraffello
    stamp(-390, -245, 90, 0.1, 2);            // Capo
    stamp(-450, -930, 120, 0.06, 4);           // Politeama / Via Liberta: match-day crowds in pink
    const MAIN = /Maqueda|Vittorio Emanuele|Via Roma/i, MARKET = /Ballar|Albergheria|Bandiera|Sant'Agostino|Beati Paoli|Maccheronai|Chiavettieri|Garraffello|Materassai|Tavola Tonda|Caracciolo|Lattarini/i;
    const FANS = /Ruggero Settimo|Mariano Stabile|Principe di Belmonte|Magliocco|Michele Amari|Liberta|Libert/i;
    for (const r of D.roads) {
      let v = 0, zn = 0, rad = 14;
      if (r.n && FANS.test(r.n)) { v = r.k === 'pedestrian' ? 0.05 : 0.03; zn = 4; rad = 20; }
      else if (r.n && MAIN.test(r.n)) { v = r.k === 'pedestrian' ? 0.05 : 0.025; zn = 1; rad = 22; }
      else if (r.n && MARKET.test(r.n)) { v = 0.12; zn = 2; rad = 18; }
      else if (r.k === 'pedestrian') { v = 0.02; zn = 1; rad = 12; }
      if (!v) continue;
      const p = r.p;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(l / 8));
        for (let s = 0; s <= n; s++) stamp(p[i] + dx * s / n, p[i + 1] + dz * s / n, rad, v, zn);
      }
    }
  }
  const densAt = (x, z) => { const i = Math.floor((x - AX0) / DC), j = Math.floor((z - AZ0) / DC); return i < 0 || j < 0 || i >= DNX || j >= DNZ ? BASE : dens[j * DNX + i]; };
  const zoneAt = (x, z) => { const i = Math.floor((x - AX0) / DC), j = Math.floor((z - AZ0) / DC); return i < 0 || j < 0 || i >= DNX || j >= DNZ ? 0 : zone[j * DNX + i]; };
  const MAXD = 0.14;
  // variant weights by zone, in the order of VARIANTS (nonna, coppola, vendor, tourist, kid, teen, priest, carabiniere, signora, suit, nonno, borsa, ragazzo, fruttivendolo, then the colour variants)
  const VW = [0, 1, 2, 3, 4].map(z => VARIANTS.map(v => v.w[z]));   // crowd mix per zone, set in assets/peds/sprites.js
  const VWsum = VW.map(w => w.reduce((a, b) => a + b, 0));
  const WCV = VARIANTS.findIndex(v => v.id === 'wheelchair'), HEALV = VARIANTS.findIndex(v => v.id === 'healed'), CHAIRV = VARIANTS.findIndex(v => v.id === 'chair_empty');
  const chairs = [];                                      // empty wheelchairs left behind by the miracle (see heal())
  const pickVariant = zn => { let r = Math.random() * VWsum[zn]; const w = VW[zn]; for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return i; return 0; };
  const IDLE_RATE = [0.015, 0.03, 0.08, 0.05, 0.06];            // chance per second of stopping for a while

  // ======================================================================== sprite rendering
  const atlas = new THREE.CanvasTexture(buildAtlas());
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.magFilter = THREE.NearestFilter; atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.anisotropy = 1;
  const quadPos = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), quadUv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);   // column, row, size, roll
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);   // fade, sun, brightness
  const mkGeo = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(quadPos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(quadUv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', aPos); g.setAttribute('iA', aA); g.setAttribute('iB', aB);
    g.instanceCount = 0; return g;
  };
  const spriteMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: atlas }, uCell: { value: new THREE.Vector2(1 / COLS, 1 / ROWS) }, uPx: { value: PX },
      uAmb: { value: new THREE.Color(0.66, 0.68, 0.72) }, uSun: { value: new THREE.Color(0.62, 0.5, 0.36) } }]),
    vertexShader: `
      attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB;
      uniform vec2 uCell; uniform float uPx;
      varying vec2 vUv; varying float vFade; varying float vSun; varying float vBright; varying float vY; varying float vClip;
      #include <fog_pars_vertex>
      void main() {
        vY = position.y; vClip = iB.w;   // iB.w: hide the lower part of the sprite (seated passengers show no legs); 0 for the crowd
        vec2 t = cameraPosition.xz - iPos.xz; float l = length(t);
        t = l > 1e-4 ? t / l : vec2(0.0, 1.0);
        vec3 right = vec3(t.y, 0.0, -t.x);
        vec2 loc = vec2(position.x * 24.0 * uPx * iA.z, position.y * 48.0 * uPx * iA.z - 2.0 * uPx * iA.z);
        float c = cos(iA.w), s = sin(iA.w);
        vec2 r = vec2(c * loc.x - s * loc.y, s * loc.x + c * loc.y);
        vec3 wp = iPos + right * r.x + vec3(0.0, 1.0, 0.0) * r.y;
        vUv = vec2((iA.x + uv.x) * uCell.x, 1.0 - (iA.y + 1.0 - uv.y) * uCell.y);
        vFade = iB.x; vSun = iB.y; vBright = iB.z;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uAmb; uniform vec3 uSun;
      varying vec2 vUv; varying float vFade; varying float vSun; varying float vBright; varying float vY; varying float vClip;
      #include <fog_pars_fragment>
      void main() {
        if (vY < vClip) discard;
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (vFade < ign) discard;
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.4) discard;
        gl_FragColor = vec4(c.rgb * (uAmb + uSun * vSun) * vBright, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const sprites = new THREE.Mesh(mkGeo(), spriteMat); sprites.frustumCulled = false; sprites.renderOrder = 2; scene.add(sprites);
  // soft blob shadow lying on the ground, pushed away from the sun
  const shadowUniforms = { uSunDir: { value: new THREE.Vector2(0.92, -0.38) } };
  const shadowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, shadowUniforms]),
    vertexShader: `
      attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB; uniform vec2 uSunDir;
      varying vec2 vP; varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vec2 q = vec2(position.x * 2.0, position.y * 2.0 - 1.0);
        vec2 along = uSunDir, across = vec2(-uSunDir.y, uSunDir.x);
        vec2 off = (along * q.y * 0.85 + across * q.x * 0.5) * iA.z + along * 0.3;
        vec3 wp = vec3(iPos.x + off.x, iPos.y + 0.03, iPos.z + off.y);
        vP = q; vA = iB.x * mix(0.14, 0.5, iB.y) * (iA.w == 0.0 ? 1.0 : 0.6);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec2 vP; varying float vA;
      #include <fog_pars_fragment>
      void main() {
        float d = dot(vP, vP); if (d > 1.0) discard;
        gl_FragColor = vec4(0.05, 0.04, 0.06, vA * (1.0 - d));
        #include <fog_fragment>
      }`,
  });
  const shadows = new THREE.Mesh(mkGeo(), shadowMat); shadows.frustumCulled = false; shadows.renderOrder = 1; scene.add(shadows);

  // ======================================================================== simulation state
  const N = { n: 0 };
  const F = n => new Float32Array(n), U = n => new Uint8Array(n);
  const X = F(CAP), Z = F(CAP), Y = F(CAP), TH = F(CAP), THT = F(CAP), NUDGE = F(CAP), V = F(CAP), V0 = F(CAP), PH = F(CAP), AGE = F(CAP);
  const VX = F(CAP), VZ = F(CAP), VY = F(CAP), HOP = F(CAP), ROLL = F(CAP), RD = F(CAP), TMR = F(CAP), STEER = F(CAP), TRAV = F(CAP), NEXTT = F(CAP);
  const SHT = F(CAP), SHC = F(CAP), BRI = F(CAP), SIZE = F(CAP), REACT = F(CAP), WAITT = F(CAP), TFLY = F(CAP);
  const ST = U(CAP), VAR = U(CAP), ZN = U(CAP), CLS = U(CAP), TICK = U(CAP);
  const MIR = F(CAP);                                   // team-bus miracle countdown (seconds left standing up), 0 when seated
  const copyArrs = [X, Z, Y, TH, THT, NUDGE, V, V0, PH, AGE, VX, VZ, VY, HOP, ROLL, RD, TMR, STEER, TRAV, NEXTT, SHT, SHC, BRI, SIZE, REACT, WAITT, TFLY, ST, VAR, ZN, CLS, TICK, MIR];
  const removeAt = i => { const l = --N.n; if (i !== l) for (const a of copyArrs) a[i] = a[l]; };

  // sun direction (horizontal, towards the sun) from the scene's directional light, for the "am I in a building's shade" test
  let sunH = [-0.92, 0.38], sunTan = Math.tan(26 * Math.PI / 180), sunLight = null, sunScanned = false;
  const readSun = () => {
    if (!sunScanned) { sunScanned = true; scene.traverse(o => { if (o.isDirectionalLight && !sunLight) sunLight = o; }); }
    if (!sunLight) return;
    const dx = sunLight.position.x - sunLight.target.position.x, dy = sunLight.position.y - sunLight.target.position.y, dz = sunLight.position.z - sunLight.target.position.z;
    const l = Math.hypot(dx, dz); if (l < 1e-3 || dy <= 0) return;
    sunH = [dx / l, dz / l]; sunTan = dy / l;
    shadowUniforms.uSunDir.value.set(-sunH[0], -sunH[1]);
  };
  let sunHit = false;
  const segHit = s => {
    // ray from (rx,rz) along sunH for rl metres against wall segment s
    const ex = s[2] - s[0], ez = s[3] - s[1], den = sunH[0] * ez - sunH[1] * ex; if (Math.abs(den) < 1e-6) return;
    const ax = s[0] - rx0, az = s[1] - rz0, t = (ax * ez - az * ex) / den, u = (ax * sunH[1] - az * sunH[0]) / den;
    if (t > 0.3 && t < rl0 && u >= 0 && u <= 1) sunHit = true;
  };
  let rx0 = 0, rz0 = 0, rl0 = 0;
  const inSun = (x, z) => {
    rx0 = x; rz0 = z; rl0 = 14 / sunTan * 0.75 + 4; if (rl0 > 28) rl0 = 28; sunHit = false;
    const ex = x + sunH[0] * rl0, ez = z + sunH[1] * rl0;
    walls2d.query(Math.min(x, ex), Math.min(z, ez), Math.max(x, ex), Math.max(z, ez), segHit);
    return sunHit ? 0 : 1;
  };

  // free distance (metres) along a heading, 0.5 m steps; runPen counts carriageway cells crossed
  let runPen = 0;
  const run = (x, z, a, maxd) => {
    const sx = Math.sin(a) * 0.5, sz = Math.cos(a) * 0.5; runPen = 0;
    for (let d = 0.5; d <= maxd; d += 0.5) { x += sx; z += sz; const c = cell(x, z); if (!c) return d - 0.5; if (c === 2) runPen++; }
    return maxd;
  };
  const bestHeading = (x, z, base, offs, maxd) => {
    let best = base + Math.PI, bs = 0.4;
    for (const o of offs) {
      const a = base + o, r = run(x, z, a, maxd), s = r - runPen * 0.7 - Math.abs(o) * 0.25 + Math.random() * 1.3;
      if (r >= 1.5 && s > bs) { bs = s; best = a; }
    }
    return best;
  };
  const TURN_OFFS = [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 0.25, -0.25];

  // ======================================================================== spawn / despawn
  let jumpedNow = false, cx = 0, cz = 0, camFwdX = 0, camFwdZ = -1, lastCx = 1e9, lastCz = 1e9, targetN = 0, targetT = 0, started = false, frameNo = 0;
  const idleTmp = [];
  function spawn(initial) {
    if (N.n >= CAP) return false;
    const R = quality.R;
    const a = Math.random() * TAU, rmin = initial ? 8 : R * 0.45, r = Math.sqrt(rmin * rmin + Math.random() * (R * R - rmin * rmin));
    let x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!initial) { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; if ((dx * camFwdX + dz * camFwdZ) / l > 0.5 && r < R * 0.85) return false; }
    let atIdle = false, face = 0;
    if (Math.random() < 0.28) {               // cluster around a cafe, bench or bus stop
      const ik = rgk(Math.floor(x / IG), Math.floor(z / IG)), arr = idleGrid.get(ik);
      if (arr) {
        const it = arr[(Math.random() * arr.length) | 0], b = Math.random() * TAU, d = rand(1.2, 2.6);
        const nx = it.x + Math.cos(b) * d, nz = it.z + Math.sin(b) * d;
        if (Math.hypot(nx - cx, nz - cz) < R && cell(nx, nz) === 1) { x = nx; z = nz; atIdle = true; face = Math.atan2(it.x - nx, it.z - nz) + rand(-0.6, 0.6); }
      }
    }
    const cl = cell(x, z); if (!cl) return false;
    if (!atIdle) {
      // streets get more people per m2 than open piazze (crowds line up along streets)
      let open = 0; for (let k = 0; k < 8; k++) if (cell(x + Math.cos(k * 0.785) * 5, z + Math.sin(k * 0.785) * 5)) open++;
      const dn = densAt(x, z) * (cl === 2 ? (zoneAt(x, z) === 2 ? 1 : 0.35) : cl === 3 ? 0.5 : 1) * (2.1 - open * 0.17);
      if (Math.random() * MAXD > dn) return false;
    }
    if (Math.hypot(x - car.x, z - car.z) < 3.5) return false;
    // not on top of someone else
    for (let j = 0; j < N.n; j++) if (Math.abs(X[j] - x) < 0.5 && Math.abs(Z[j] - z) < 0.5) return false;
    const i = N.n++, zn = zoneAt(x, z), vi = pickVariant(zn), v = VARIANTS[vi];
    X[i] = x; Z[i] = z; Y[i] = groundY(x, z) + (raisedMask(x, z) ? CURB : 0); VAR[i] = vi; ZN[i] = zn; CLS[i] = cl;
    TH[i] = atIdle ? face : bestHeading(x, z, Math.random() * TAU, [0, 0.4, -0.4, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.1], 8);
    THT[i] = TH[i]; NUDGE[i] = 0; V[i] = 0; V0[i] = (v.speed || 1.1) * rand(0.85, 1.15); PH[i] = Math.random(); AGE[i] = !started || jumpedNow ? 5 : 0;
    VX[i] = VZ[i] = VY[i] = HOP[i] = ROLL[i] = 0; RD[i] = 1; TMR[i] = atIdle ? rand(6, 40) : 0; STEER[i] = Math.random() * 0.1; TRAV[i] = 0; NEXTT[i] = rand(10, 35);
    SHC[i] = SHT[i] = inSun(x, z); BRI[i] = rand(0.92, 1.08); SIZE[i] = rand(0.96, 1.04); REACT[i] = -1; WAITT[i] = 0; TFLY[i] = 0;
    ST[i] = atIdle ? IDLE : WALK; TICK[i] = (Math.random() * 5) | 0;
    if (!atIdle) V[i] = V0[i];
    return true;
  }

  // expected crowd from the density map over the walkable area around the camera
  function estimateTarget() {
    const R = quality.R; let sum = 0; const S = 56;
    for (let k = 0; k < S; k++) {
      const a = Math.random() * TAU, r = R * Math.sqrt(Math.random()), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, c = cell(x, z);
      if (c) sum += densAt(x, z) * (c === 2 ? (zoneAt(x, z) === 2 ? 1 : 0.35) : c === 3 ? 0.5 : 1);
    }
    const alt = camera.position.y - groundY(cx, cz), altK = clamp(1 - (alt - 40) / 200, 0.4, 1);
    return Math.min(quality.cap, Math.round(sum / S * Math.PI * R * R * altK * 1.8));
  }

  // ======================================================================== behaviour
  let agents = [], carSpd = 0;
  function trafficNear(x, z, rad) {
    for (let k = 0; k < agents.length; k++) { const a = agents[k], r = (a.r || 1.2) + rad, dx = a.x - x, dz = a.z - z; if (dx * dx + dz * dz < r * r) return true; }
    if (carSpd > 2 && (car.x - x) ** 2 + (car.z - z) ** 2 < (rad + 3.5) ** 2) return true;
    return false;
  }
  function steer(i, dt10) {
    const x = X[i], z = Z[i];
    let cl = cell(x, z); CLS[i] = cl;
    if (!cl) { // squeezed into a wall: find the nearest free cell
      for (let d = 0.5; d <= 3; d += 0.5) for (let k = 0; k < 8; k++) { const a = k * TAU / 8, nx = x + Math.sin(a) * d, nz = z + Math.cos(a) * d; if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; return; } }
      AGE[i] = -999; return;      // nowhere to go: despawn
    }
    if (++TICK[i] % 5 === 0) SHT[i] = inSun(x, z);
    const st = ST[i];
    if (st === IDLE) {
      TMR[i] -= dt10;
      if (TMR[i] <= 0) { ST[i] = WALK; THT[i] = TH[i] + (Math.random() < 0.5 ? rand(-0.5, 0.5) : Math.PI + rand(-0.6, 0.6)); V0[i] = (VARIANTS[VAR[i]].speed || 1.1) * rand(0.85, 1.15); }
      else if (Math.random() < 0.02) THT[i] = TH[i] + rand(-1.2, 1.2);
      return;
    }
    if (st === WAIT) {
      WAITT[i] += dt10;
      if (!trafficNear(x + Math.sin(TH[i]) * 3, z + Math.cos(TH[i]) * 3, 1.2) || WAITT[i] > 9) { ST[i] = WALK; WAITT[i] = -6; }
      return;
    }
    if (st !== WALK) return;
    // sometimes stop and look around
    if (Math.random() < IDLE_RATE[ZN[i]] * dt10 && cl === 1 && VAR[i] !== HEALV) { ST[i] = IDLE; TMR[i] = rand(3, 14); return; }
    const t = THT[i], ah = run(x, z, t, 3.2), pen = runPen;
    const ahead = cell(x + Math.sin(t) * 1.4, z + Math.cos(t) * 1.4);
    // about to step off the pavement onto a carriageway: wait for the traffic
    if (cl === 1 && (ahead === 3 || ahead === 2) && WAITT[i] >= 0 && trafficNear(x + Math.sin(t) * 3.5, z + Math.cos(t) * 3.5, 1.5)) { ST[i] = WAIT; WAITT[i] = 0; return; }
    if (WAITT[i] < 0) WAITT[i] = Math.min(0, WAITT[i] + dt10);
    const edge = ah < 2.2 || (cl === 1 && ahead === 2 && Math.random() < (ZN[i] === 2 ? 0.1 : 0.7));
    if (edge) { THT[i] = bestHeading(x, z, t, TURN_OFFS, 6); TRAV[i] = 0; NEXTT[i] = rand(10, 35); NUDGE[i] = 0; return; }
    // random turn into a side street after a while
    if (TRAV[i] > NEXTT[i]) {
      TRAV[i] = 0; NEXTT[i] = rand(10, 35);
      if (Math.random() < 0.65) { const s = Math.random() < 0.5 ? 1 : -1; if (run(x, z, t + s * 1.57, 7) >= 6) THT[i] = t + s * 1.57; else if (run(x, z, t - s * 1.57, 7) >= 6) THT[i] = t - s * 1.57; }
    }
    // keep off the walls: nudge away from a blocked side
    const px = Math.cos(t), pz = -Math.sin(t), l = cell(x + px * 0.95, z + pz * 0.95), r = cell(x - px * 0.95, z - pz * 0.95);
    NUDGE[i] = !l && r ? -0.4 : l && !r ? 0.4 : 0;
    if (cl === 1 && pen === 0 && Math.random() < 0.02) THT[i] += rand(-0.3, 0.3);
  }

  const pushOut = (i, dx, dz, amt) => { // move a pedestrian along (dx,dz) if the ground allows it
    const nx = X[i] + dx * amt, nz = Z[i] + dz * amt;
    if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; return true; }
    return false;
  };

  // spatial hash for pedestrian-pedestrian spacing
  const HS = 1024, hHead = new Int16Array(HS), hNext = new Int16Array(CAP);
  const hkey = (ix, iz) => ((ix * 73856093) ^ (iz * 19349663)) & (HS - 1);

  function stepDodgeChecks(dt) {
    // car heading towards a pedestrian: hop out of the way after a short reaction time
    const cvx = car.vx, cvz = car.vz, c2 = cvx * cvx + cvz * cvz;
    if (c2 < 12) return;
    const cs = Math.sqrt(c2), ux = cvx / cs, uz = cvz / cs;
    for (let i = 0; i < N.n; i++) {
      const st = ST[i]; if (st >= DODGE) continue;
      const rx = X[i] - car.x, rz = Z[i] - car.z;
      if (rx * rx + rz * rz > 22 * 22) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      const along = rx * ux + rz * uz; if (along < 0.5 || along > cs * 1.7 + 4) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      const lat = rx * uz - rz * ux;               // + : pedestrian is to the left of the car's path (x right, z back)
      if (Math.abs(lat) > 2.0) { if (REACT[i] > 0) REACT[i] = -1; continue; }
      if (REACT[i] === -2) continue;               // decided to stand its ground
      if (REACT[i] < 0) { // first notice
        const v = VARIANTS[VAR[i]]; REACT[i] = Math.random() < (v.phone ? 0.55 : v.chair ? 0 : 0.18) ? -2 : rand(0.1, v.phone ? 0.5 : 0.35); continue;
      }
      REACT[i] -= dt; if (REACT[i] > 0) continue;
      // hop sideways, away from the car's line
      const sg = lat >= 0 ? 1 : -1;       // unit vector perpendicular to the car, on the pedestrian's side
      const px = uz * sg, pz = -ux * sg;
      let dx = px, dz = pz, ok = cell(X[i] + dx * 1.3, Z[i] + dz * 1.3) && cell(X[i] + dx * 2.5, Z[i] + dz * 2.5);
      if (!ok) { dx = -px; dz = -pz; ok = cell(X[i] + dx * 1.3, Z[i] + dz * 1.3) && cell(X[i] + dx * 2.5, Z[i] + dz * 2.5); }
      if (!ok) { REACT[i] = -2; continue; }
      if (VAR[i] === WCV) { heal(i, dx, dz); continue; }
      ST[i] = DODGE; TMR[i] = 0; VX[i] = dx * 5.2; VZ[i] = dz * 5.2; TH[i] = THT[i] = Math.atan2(dx, dz); ROLL[i] = 0; V[i] = 0; REACT[i] = -2; env.shout?.(X[i], Y[i] + 1.9, Z[i], undefined, (() => { const id = i; return () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }); })());
    }
  }

  // The wheelchair gag: the rider leaps up (a dodge hop), the chair stays behind and he sprints off, then jogs.
  function heal(i, dx, dz) {
    if (chairs.length >= 10) chairs.shift();
    chairs.push({ x: X[i], z: Z[i], y: Y[i], th: TH[i], vx: car.vx * 0.3 + dx * 0.8, vz: car.vz * 0.3 + dz * 0.8, t: 0, rd: dx * car.vz - dz * car.vx >= 0 ? 1 : -1, ph: 0, sh: SHC[i] });
    VAR[i] = HEALV; ST[i] = DODGE; TMR[i] = 0; REACT[i] = -2; V0[i] = 6.2; V[i] = 0; VX[i] = dx * 6.2; VZ[i] = dz * 6.2; TH[i] = THT[i] = Math.atan2(dx, dz); NUDGE[i] = 0; WAITT[i] = -6;
    const id = i; env.shout?.(X[i], Y[i] + 1.9, Z[i], 'U PALIEMMU \u00C8 MIRACULUSU!', () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }));
  }
  function updateChairs(dt, cx0, cz0) {
    for (let k = chairs.length - 1; k >= 0; k--) {
      const c = chairs[k]; c.t += dt;
      const sp = Math.hypot(c.vx, c.vz);
      if (sp > 0.05) {
        const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
        if (cell(nx, nz)) { c.x = nx; c.z = nz; c.ph += sp * dt / 1.5; } else c.vx = c.vz = 0;
        const kf = Math.exp(-1.3 * dt); c.vx *= kf; c.vz *= kf;
      }
      const d = Math.hypot(c.x - cx0, c.z - cz0);
      if (c.dead || (c.keep && c.t > 3.2) || d > quality.R + 14 || (!c.keep && ((c.t > 30 && d > 35) || c.t > 150))) { chairs.splice(k, 1); continue; }
      c.y += (groundY(c.x, c.z) + (raisedMask(c.x, c.z) ? CURB : 0) - c.y) * Math.min(1, 14 * dt);
    }
  }
  function writeChairs(n, cpx, cpz, fadeStart) {
    const pos = aPos.array, A = aA.array, B = aB.array; let k = 0;
    for (const c of chairs) {
      const i = n + k; if (i >= CAP) break; k++;
      const dxc = cpx - c.x, dzc = cpz - c.z, dist = Math.hypot(dxc, dzc) || 1, wx = Math.sin(c.th), wz = Math.cos(c.th), tx = dxc / dist, tz = dzc / dist;
      const s = wx * tx + wz * tz, cc = wx * tz - wz * tx, dir = Math.abs(s) >= Math.abs(cc) ? (s > 0 ? 0 : 1) : (cc > 0 ? 3 : 2);
      const u = clamp((c.t - 0.3) / 0.6, 0, 1), tip = c.keep ? 0 : u * u * (3 - 2 * u) * 1.15 * c.rd;     // tips over after the rider bolts
      pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
      A[i * 4] = dir * POSES + (Math.hypot(c.vx, c.vz) > 0.15 ? Math.floor((c.ph % 1) * 4) & 3 : 0); A[i * 4 + 1] = CHAIRV; A[i * 4 + 2] = 1; A[i * 4 + 3] = tip;
      B[i * 4] = clamp((fadeStart - dist) / 16, 0, 1); B[i * 4 + 1] = c.sh; B[i * 4 + 2] = 1;
    }
    return k;
  }

  // The team bus gag (src/gags.js): a wheelchair user within r of (x, z) stands up, shouts, hops for joy, then sits back down.
  // The empty chair waits beside him (c.keep stops it tipping over). Returns true when someone stood up.
  function miracle(x, z, r) {
    const r2 = r * r;
    for (let i = 0; i < N.n; i++) {
      if (VAR[i] !== WCV || MIR[i] > 0 || ST[i] > WAIT) continue;
      const dx = X[i] - x, dz = Z[i] - z; if (dx * dx + dz * dz > r2) continue;
      if (chairs.length >= 10) chairs.shift();
      const ch = { x: X[i], z: Z[i], y: Y[i], th: TH[i], vx: 0, vz: 0, t: 0, rd: 1, ph: 0, sh: SHC[i], keep: true };
      chairs.push(ch);
      VAR[i] = HEALV; ST[i] = IDLE; V[i] = 0; TMR[i] = 6; MIR[i] = 3.2;
      const id = i; env.shout?.(X[i], Y[i] + 1.9, Z[i], 'Oh Palermo \u00E8 miracoloso!', () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }));
      return true;
    }
    return false;
  }
  function seatAgain(i) {
    if (VAR[i] === HEALV) { VAR[i] = WCV; ST[i] = IDLE; TMR[i] = rand(2, 5); V[i] = 0; HOP[i] = 0; }
  }
  const knockCbs = [];
  function knock(i, nx, nz) {
    for (const f of knockCbs) { try { f(X[i], Z[i], VAR[i]); } catch (e) { /* listener failed: keep playing */ } }
    if (VAR[i] === WCV) { heal(i, nx, nz); return; }
    ST[i] = FLY; TMR[i] = 0; env.shout?.(X[i], Y[i] + 1.9, Z[i], undefined, (() => { const id = i; return () => ({ x: X[id], y: Y[id] + 1.9, z: Z[id] }); })());
    const sp = Math.min(Math.hypot(car.vx, car.vz), 16);
    const vy = 3.2 + sp * 0.12;
    VX[i] = car.vx * 0.55 + nx * 2.6; VZ[i] = car.vz * 0.55 + nz * 2.6; VY[i] = vy; TFLY[i] = 2 * vy / 12;
    RD[i] = (car.vx * nz - car.vz * nx) >= 0 ? 1 : -1; ROLL[i] = 0; HOP[i] = 0.05; V[i] = 0;
  }

  // ======================================================================== per-frame update
  const camQ = new THREE.Vector3();
  function update(dt, cam) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.05); frameNo++;
    cam = cam || camera;
    updateScripted(dt, cam);
    cx = cam.position.x; cz = cam.position.z;
    cam.getWorldDirection(camQ); const fl = Math.hypot(camQ.x, camQ.z); if (fl > 0.05) { camFwdX = camQ.x / fl; camFwdZ = camQ.z / fl; }
    const R = quality.R;
    if (quality.cap <= 0) { sprites.geometry.instanceCount = shadows.geometry.instanceCount = 0; return; }
    if ((frameNo & 15) === 1) readSun();

    // tiles around the camera: all of them at once on the first frame or after a jump, otherwise on a time budget
    const jumped = Math.hypot(cx - lastCx, cz - lastCz) > 45;
    if (!started || jumped) { ensureTilesAround(cx, cz, 70, 60); }
    else ensureTilesAround(cx, cz, R + 25, 1.5);
    lastCx = cx; lastCz = cz; jumpedNow = jumped;

    // despawn the far ones, and retarget the crowd size twice a second
    for (let i = N.n - 1; i >= 0; i--) { if (Math.hypot(X[i] - cx, Z[i] - cz) > R + 14 || AGE[i] < -100) removeAt(i); }
    targetT -= dt;
    if (targetT <= 0 || !started || jumped) { targetN = estimateTarget(); targetT = 0.5; stats.target = targetN; }
    // spawn (fill quickly when starting or after a jump, else a few per frame)
    const burst = !started || jumped || N.n < targetN * 0.35;
    const budget = !started || jumped ? 12 : burst ? 2.5 : 0.6, ts = performance.now(); let tries = 0, spawned = 0;
    while (N.n < targetN && tries < (burst ? 1500 : 24) && spawned < (burst ? 400 : 4)) {
      tries++; if (spawn(burst)) spawned++;
      if ((tries & 7) === 0 && performance.now() - ts > budget) break;
    }
    // slowly thin out when there are far too many (e.g. after the crowd density dropped)
    if (N.n > targetN * 1.25 + 6) { let far = -1, fd = 0; for (let i = 0; i < N.n; i++) { const d = Math.hypot(X[i] - cx, Z[i] - cz); if (d > fd) { fd = d; far = i; } } if (far >= 0 && fd > R * 0.7) AGE[far] = -999; }
    started = true;

    agents = env.traffic && env.traffic.agents ? env.traffic.agents() || [] : [];
    carSpd = Math.hypot(car.vx, car.vz);
    stepDodgeChecks(dt);

    // spatial hash
    hHead.fill(-1);
    for (let i = 0; i < N.n; i++) { const k = hkey(Math.floor(X[i] / 1.5), Math.floor(Z[i] / 1.5)); hNext[i] = hHead[k]; hHead[k] = i; }

    const sfx = Math.sin(car.th), sfz = Math.cos(car.th);
    for (let i = 0; i < N.n; i++) {
      AGE[i] += dt;
      if (MIR[i] > 0) { MIR[i] -= dt; HOP[i] = MIR[i] > 0 ? 0.1 * Math.abs(Math.sin(MIR[i] * 9)) : 0; if (MIR[i] <= 0) seatAgain(i); }
      let st = ST[i];
      // decision tick, staggered
      if ((STEER[i] -= dt) <= 0 && st <= WAIT) { STEER[i] = 0.1 + Math.random() * 0.04; steer(i, 0.12); st = ST[i]; }

      const x = X[i], z = Z[i];
      if (st === WALK || st === IDLE || st === WAIT) {
        // turn towards the intended heading (+ wall nudge), speed follows
        const goal = THT[i] + NUDGE[i], dh = angDiff(goal, TH[i]);
        TH[i] += clamp(dh, -5 * dt, 5 * dt);
        if (VAR[i] === HEALV && V0[i] > 2.7) V0[i] -= (V0[i] - 2.6) * Math.min(1, 0.35 * dt);
        const want = st === WALK ? V0[i] * Math.max(0.25, Math.cos(Math.min(1.4, Math.abs(dh)))) : 0;
        V[i] += clamp(want - V[i], -5 * dt, 3 * dt);
        if (st === IDLE && Math.abs(dh) > 0.01) TH[i] += clamp(dh, -2.5 * dt, 2.5 * dt);
        if (V[i] > 0.02) {
          const d = V[i] * dt, nx = x + Math.sin(TH[i]) * d, nz = z + Math.cos(TH[i]) * d;
          if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; TRAV[i] += d; PH[i] += d / (VAR[i] === HEALV ? 3.2 : 1.5); }
          else { V[i] = 0; STEER[i] = 0; THT[i] += (Math.random() < 0.5 ? 1 : -1) * 1.2; }
        }
        // keep a little distance from the others and from the lapa
        const ix = Math.floor(X[i] / 1.5), iz = Math.floor(Z[i] / 1.5);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          for (let j = hHead[hkey(ix + a, iz + b)]; j >= 0; j = hNext[j]) {
            if (j === i) continue;
            const dx = X[i] - X[j], dz = Z[i] - Z[j], d2 = dx * dx + dz * dz;
            if (d2 < 0.49 && d2 > 1e-6) { const d = Math.sqrt(d2); pushOut(i, dx / d, dz / d, (0.7 - d) * 1.6 * dt); }
          }
        }
        const cdx = X[i] - car.x, cdz = Z[i] - car.z;
        if (cdx * cdx + cdz * cdz < 16) {
          // distance to the lapa's centre line (3.2 m long)
          const al = clamp(cdx * sfx + cdz * sfz, -1.2, 1.2), qx = cdx - sfx * al, qz = cdz - sfz * al, qd = Math.hypot(qx, qz);
          if (qd < 1.7 && qd > 1e-4) pushOut(i, qx / qd, qz / qd, (1.7 - qd) * (1.5 + carSpd * 0.25) * dt * (carSpd > 0.3 ? 1 : 0.3));
        }
        if (st === IDLE || st === WAIT) { V[i] = Math.max(0, V[i] - 4 * dt); }
      } else if (st === DODGE) {
        TMR[i] += dt;
        const u = TMR[i] / 0.5;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt;
        if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; } else { VX[i] = VZ[i] = 0; }
        HOP[i] = 4 * 0.42 * Math.min(1, u) * (1 - Math.min(1, u));
        if (u >= 1) { HOP[i] = 0; if (VAR[i] === HEALV) { ST[i] = WALK; V[i] = V0[i]; STEER[i] = 0; } else { ST[i] = IDLE; TMR[i] = rand(0.5, 1.1); THT[i] = TH[i] + rand(-0.7, 0.7); V[i] = 0; } }
      } else if (st === FLY) {
        TMR[i] += dt;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt;
        if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; } else { VX[i] *= -0.2; VZ[i] *= -0.2; }
        VY[i] -= 12 * dt; HOP[i] += VY[i] * dt;
        const k = Math.exp(-0.8 * dt); VX[i] *= k; VZ[i] *= k;
        ROLL[i] = RD[i] * (2.5 * Math.PI) * Math.min(1, TMR[i] / Math.max(0.2, TFLY[i]));
        if (HOP[i] <= 0) {
          HOP[i] = 0;
          if (VY[i] < -2) { VY[i] = -VY[i] * 0.25; VX[i] *= 0.5; VZ[i] *= 0.5; } // one small bounce
          else { ST[i] = LIE; TMR[i] = rand(1.4, 2.4); ROLL[i] = RD[i] * Math.PI / 2; }
        }
      } else if (st === LIE) {
        TMR[i] -= dt; const k = Math.exp(-5 * dt); VX[i] *= k; VZ[i] *= k;
        const nx = x + VX[i] * dt, nz = z + VZ[i] * dt; if (cell(nx, nz)) { X[i] = nx; Z[i] = nz; }
        if (TMR[i] <= 0) { ST[i] = GETUP; TMR[i] = 0; }
      } else if (st === GETUP) {
        TMR[i] += dt; const u = Math.min(1, TMR[i] / 0.45);
        ROLL[i] = RD[i] * Math.PI / 2 * (1 - u * u); HOP[i] = 0.25 * Math.sin(u * Math.PI);
        if (u >= 1) { ST[i] = WALK; ROLL[i] = 0; HOP[i] = 0; REACT[i] = -1; THT[i] = TH[i] = rand(0, TAU); V0[i] = (VARIANTS[VAR[i]].speed || 1.1) * 1.15; V[i] = 0; STEER[i] = 0; }
      }

      // ground height, eased so stepping onto a curb isn't a pop
      const ty = groundY(X[i], Z[i]) + (raisedMask(X[i], Z[i]) ? CURB : 0);
      Y[i] += (ty - Y[i]) * Math.min(1, 14 * dt);
    }

    // sun shading eases to its target
    for (let i = 0; i < N.n; i++) SHC[i] += (SHT[i] - SHC[i]) * Math.min(1, 4 * dt);

    // write the instance buffers
    const pos = aPos.array, A = aA.array, B = aB.array, n = N.n;
    const cpx = cam.position.x, cpz = cam.position.z, fadeStart = R + 12;
    for (let i = 0; i < n; i++) {
      const x = X[i], z = Z[i], st = ST[i], dxc = cpx - x, dzc = cpz - z, dist = Math.hypot(dxc, dzc) || 1;
      pos[i * 3] = x; pos[i * 3 + 1] = Y[i] + HOP[i]; pos[i * 3 + 2] = z;
      let dir, pose;
      if (st >= FLY) { dir = 0; pose = st === FLY ? 1 : 0; }
      else {
        // angle between the camera and the walking direction picks front / back / left / right
        const wx = Math.sin(TH[i]), wz = Math.cos(TH[i]), tx = dxc / dist, tz = dzc / dist;
        const s = wx * tx + wz * tz, c = wx * tz - wz * tx;     // c > 0: walking to the right on screen
        dir = Math.abs(s) >= Math.abs(c) ? (s > 0 ? 0 : 1) : (c > 0 ? 3 : 2);
        if (st === DODGE) pose = 1;
        else if (V[i] < 0.12) pose = 0;
        else { const ph = Math.floor((PH[i] % 1) * 4) & 3; pose = VAR[i] === WCV ? ph : ph === 0 ? 1 : ph === 1 ? 2 : ph === 2 ? 3 : 2; if (VARIANTS[VAR[i]].bounce && pose === 2) pose = 2; }
      }
      A[i * 4] = dir * POSES + pose; A[i * 4 + 1] = VAR[i]; A[i * 4 + 2] = SIZE[i]; A[i * 4 + 3] = ROLL[i];
      const fade = clamp((fadeStart - dist) / 16, 0, 1) * clamp(AGE[i] / 0.8, 0, 1);
      B[i * 4] = fade; B[i * 4 + 1] = SHC[i]; B[i * 4 + 2] = BRI[i];
    }
    updateChairs(dt, cpx, cpz); const nc = writeChairs(n, cpx, cpz, fadeStart);
    aPos.needsUpdate = aA.needsUpdate = aB.needsUpdate = true;
    sprites.geometry.instanceCount = shadows.geometry.instanceCount = n + nc;
    stats.count = n;
    const ms = performance.now() - t0; stats.ms = ms; stats.avgMs += (ms - stats.avgMs) * 0.05; if (ms > stats.maxMs) stats.maxMs = ms;
  }

  // ======================================================================== the lapa meets a pedestrian (runs at 120 Hz)
  const COFF = [-1.0, 0, 1.0], CR = 0.72, PR = 0.3;
  function collidePlayer(c) {
    const n = N.n; if (!n) return;
    const spd = Math.hypot(c.vx, c.vz), sfx2 = Math.sin(c.th), sfz2 = Math.cos(c.th);
    for (let i = 0; i < n; i++) {
      const dx0 = X[i] - c.x, dz0 = Z[i] - c.z;
      if (dx0 > 3 || dx0 < -3 || dz0 > 3 || dz0 < -3 || ST[i] >= FLY) continue;
      for (let k = 0; k < 3; k++) {
        const dx = X[i] - (c.x + sfx2 * COFF[k]), dz = Z[i] - (c.z + sfz2 * COFF[k]), d2 = dx * dx + dz * dz, rr = CR + PR;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
        if (spd > 2.2) {
          knock(i, nx, nz);
          const f = 0.025; c.vx -= c.vx * f; c.vz -= c.vz * f;     // a pedestrian is a speed bump, not a wall
        } else pushOut(i, nx, nz, rr - d);
        break;
      }
    }
  }

  // ======================================================================== scripted characters (missions)
  // A few extra sprites steered by another module (src/missions.js), drawn with the same atlas and shader as the crowd.
  //   spawnScripted(variant, x, z) -> id     variant: index into VARIANTS or its id ('tourist', 'vendor'...); -1 when full
  //   walkTo(id, x, z, speed, onArrive)      straight-line walk (no pathfinding: keep it short), speed in m/s
  //   face(id, x, z)                         turn towards a point
  //   attachTo(id, fn, { seated, blend })    fn(out) fills out.x/out.y/out.z/out.th each frame (out.y = hip height when seated);
  //                                          a seated sprite shows no legs. blend: seconds to hop from where it stands to the seat
  //   detach(id)                             back to standing on the ground where it is
  //   setBounce(id, on)                      jump up and down on the spot (hailing a taxi)
  //   info(id) -> { x, y, z, state }         state: 'stand' | 'walk' | 'seat'
  //   remove(id); near(x, z, r) -> crowd members within r; onKnock(fn(x, z, variant)) when the lapa sends a crowd member flying
  const SC = 48;
  const sPos = new THREE.InstancedBufferAttribute(new Float32Array(SC * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const sA = new THREE.InstancedBufferAttribute(new Float32Array(SC * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const sB = new THREE.InstancedBufferAttribute(new Float32Array(SC * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const mkGeoS = () => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(quadPos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(quadUv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', sPos); g.setAttribute('iA', sA); g.setAttribute('iB', sB);
    g.instanceCount = 0; return g;
  };
  const sSprites = new THREE.Mesh(mkGeoS(), spriteMat); sSprites.frustumCulled = false; sSprites.renderOrder = 2; scene.add(sSprites);
  const sShadows = new THREE.Mesh(mkGeoS(), shadowMat); sShadows.frustumCulled = false; sShadows.renderOrder = 1; scene.add(sShadows);
  const scripted = new Map(); let nextScriptId = 1, scriptClock = 0;
  const vIndex = v => typeof v === 'number' ? v : Math.max(0, VARIANTS.findIndex(x => x.id === v));
  const groundAt = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  function spawnScripted(variant, x, z) {
    if (scripted.size >= SC) return -1;
    const id = nextScriptId++, v = vIndex(variant);
    scripted.set(id, { id, v, x, z, y: groundAt(x, z), th: Math.random() * TAU, size: 1, state: 'stand', tx: x, tz: z, speed: 1.2, ph: Math.random(), cb: null,
      att: null, seated: false, blend: 0, bt: 0, from: null, hip: 0, bounce: false });
    return id;
  }
  const scriptedGet = id => scripted.get(id);
  function walkTo(id, x, z, speed, cb) { const c = scripted.get(id); if (!c) return; c.state = 'walk'; c.tx = x; c.tz = z; c.speed = speed || (VARIANTS[c.v].speed || 1.1); c.cb = cb || null; }
  function face(id, x, z) { const c = scripted.get(id); if (c) c.th = Math.atan2(x - c.x, z - c.z); }
  function attachTo(id, fn, o) {
    const c = scripted.get(id); if (!c) return;
    o = o || {}; c.att = fn; c.seated = !!o.seated; c.blend = o.blend || 0; c.bt = 0; c.from = c.blend ? { x: c.x, y: c.y, z: c.z } : null; c.state = 'seat';
  }
  function detach(id) { const c = scripted.get(id); if (!c) return; c.att = null; c.seated = false; c.state = 'stand'; c.y = c.hipY !== undefined ? c.hipY - ((VARIANTS[c.v].leg || 19) * PX) : c.y; }
  function setBounce(id, on) { const c = scripted.get(id); if (c) c.bounce = !!on; }
  function remove(id) { scripted.delete(id); }
  function info(id) { const c = scripted.get(id); return c ? { x: c.x, y: c.y, z: c.z, state: c.state } : null; }
  function near(x, z, r) {
    let n = 0; const r2 = r * r;
    for (let i = 0; i < N.n; i++) { if (ST[i] >= FLY) continue; const dx = X[i] - x, dz = Z[i] - z; if (dx * dx + dz * dz < r2) n++; }
    return n;
  }
  const attOut = { x: 0, y: 0, z: 0, th: 0 };
  function updateScripted(dt, cam) {
    dt = clamp(dt, 0, 0.05); scriptClock += dt;
    const cpx = cam.position.x, cpz = cam.position.z;
    const sp = sPos.array, sa = sA.array, sb = sB.array;
    let k = 0, seatedList = null;
    const order = [];
    for (const c of scripted.values()) {
      if (c.state === 'walk') {
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz), step = c.speed * dt;
        if (d <= step + 0.02) { c.x = c.tx; c.z = c.tz; c.state = 'stand'; const cb = c.cb; c.cb = null; if (cb) { try { cb(c.id); } catch (e) { /* ignore */ } } }
        else { c.x += dx / d * step; c.z += dz / d * step; c.ph += step / 1.5; c.th += clamp(angDiff(Math.atan2(dx, dz), c.th), -7 * dt, 7 * dt); }
      }
      if (c.att) {
        c.att(attOut);
        let ax = attOut.x, az = attOut.z, ay = attOut.y;
        if (c.from && c.blend > 0) { // hop from where it stood into the seat
          c.bt += dt; const u = Math.min(1, c.bt / c.blend), e = u * u * (3 - 2 * u);
          ax = c.from.x + (ax - c.from.x) * e; az = c.from.z + (az - c.from.z) * e; ay = c.from.y + (ay - c.from.y) * e + Math.sin(u * Math.PI) * 0.35;
          if (u >= 1) c.from = null;
        }
        c.x = ax; c.z = az; c.hipY = ay; c.th = attOut.th;
      } else {
        const ty = groundAt(c.x, c.z); c.y += (ty - c.y) * Math.min(1, 14 * dt);
      }
      order.push(c);
    }
    order.sort((a, b) => (a.state === 'seat' && a.seated) - (b.state === 'seat' && b.seated));   // standing first: only those get a ground shadow
    let standing = 0;
    for (const c of order) {
      const v = VARIANTS[c.v], i = k++, seatedNow = c.att && c.seated, leg = v.leg || 19;
      if (!seatedNow) standing++;
      const dxc = cpx - c.x, dzc = cpz - c.z, dist = Math.hypot(dxc, dzc) || 1;
      let y = seatedNow ? c.hipY - leg * PX * c.size : (c.att ? c.hipY : c.y);
      if (c.bounce && !c.att) y += Math.abs(Math.sin(scriptClock * 6 + c.id)) * 0.16;
      sp[i * 3] = c.x; sp[i * 3 + 1] = y; sp[i * 3 + 2] = c.z;
      const wx = Math.sin(c.th), wz = Math.cos(c.th), tx = dxc / dist, tz = dzc / dist;
      const s = wx * tx + wz * tz, cc = wx * tz - wz * tx;
      const dir = Math.abs(s) >= Math.abs(cc) ? (s > 0 ? 0 : 1) : (cc > 0 ? 3 : 2);
      let pose = 0;
      if (c.state === 'walk') { const ph = Math.floor((c.ph % 1) * 4) & 3; pose = ph === 0 ? 1 : ph === 1 ? 2 : ph === 2 ? 3 : 2; }
      sa[i * 4] = dir * POSES + pose; sa[i * 4 + 1] = c.v; sa[i * 4 + 2] = c.size; sa[i * 4 + 3] = 0;
      sb[i * 4] = 1; sb[i * 4 + 1] = 0.8; sb[i * 4 + 2] = 1; sb[i * 4 + 3] = seatedNow ? (2 + leg) / 48 - 0.03 : 0;
    }
    sPos.needsUpdate = sA.needsUpdate = sB.needsUpdate = true;
    sSprites.geometry.instanceCount = k; sShadows.geometry.instanceCount = standing;
  }

  function setQuality(q) { if (QUALITIES[q] && !params.has('peds')) { quality = QUALITIES[q]; targetT = 0; } }

  if (params.has('debug')) window.__peds = { stats, N, X, Z, ST, VAR, TH, TMR, ROLL, RD, HOP, V, cell, tiles, quality: () => quality, knock, items };
  const api = { update, collidePlayer, setQuality, stats, spawnScripted, walkTo, face, attachTo, detach, remove, info, setBounce, near, miracle, onKnock: f => { knockCbs.push(f); } };
  env.traffic?.bindPedestrians?.(api);   // police, lookouts, the team bus and the double-parking quarrels (src/police.js, src/gags.js) use this API
  return api;
}
