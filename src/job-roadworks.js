// Roadworks: a street shut for works, red and white barriers across its whole width, cones, a "lavori in corso" sign, a trench and a heap of rubble, one or two workers about. It is not a call and not
// a job: it is an encounter in the world (docs/missions-director.md, the tick hook of X.kinds). The point is surprise while driving: the street you wanted is closed and you find another way, also in
// the middle of a taxi ride or a delivery. The owner's words: "Le strade bloccate per i lavori e non puoi passare".
//
// Rhythm: the first site comes 70 to 110 s into the drive, then one every 150 to 270 s, at most two alive at once, the next one never nearer than 400 m to the first. A site is made 260 to 440 m
// ahead of the lapa (out to the full-detail tiles, where the walls and the road graph exist), on the route of a running job when there is one and else ahead along the heading, never nearer than
// 120 m and never in view under 300 m, and it is removed once the lapa has been more than 700 m away for 8 s. The search is spread over frames: one frame gathers the edges of the road graph near
// the target, then two candidates a frame are judged (walls, tracks, callers, detour) until one passes.
//
// Which street (all of it from the road graph, src/traffic-graph.js): a two-way or one-way edge of a residential, unclassified, tertiary or secondary road, 5 to 18 m wide, at least 24 m long (the
// site is in the middle, so 12 m clear of the junctions), no bridge, no tunnel, no fast road, no service road, no pedestrian street, no roundabout. A street between two real junctions (both ends of
// degree three or more) is liked best, because the cars turn off at the junction instead of queueing. It must have a detour (a bounded search over the graph from one end to the other without the
// edge, both ways when the street is two-way, within 1600 m): never a dead end, never the only way in or out. It must be a street between walls: a ray across the road on either side of the works
// finds a wall (long, not a breakable fence) within 15 m, and the barrier line is drawn and walled from wall to wall, so there is no pavement to slip along. Not within 45 m of a race track (src/
// event-routes.js TRACKS: this does not need to know whether a race runs), nor within 70 m of a caller or a vendor, nor of where a running job is going.
//
// How it blocks the lapa: two collision segments across the street (one at each barrier line, 3 m either side of the middle, so a lapa coming from either end stops at a barrier and never inside the
// works) are added to walls2d and taken out again by name when the site goes (the Grid in src/main.js has no remove, so this file splices the segment out of the cells it was put in: walls2d.m,
// walls2d.cell and walls2d.key are plain members). Traffic: both edges of the street are closed in the graph from outside, with no edit to traffic.js: the edge is flagged `ped` (plan() and
// path() and edgeFor() skip those, so the route guide and A* go round) and its four entries in G.alive are zeroed (pickNext and trySpawn read G.alive; recomputeAlive builds new arrays, which this
// notices by identity every frame and zeroes again). Cars on the street or with it in their next four edges are marked `hide` (they go when nobody sees them). G is traffic.debug.G.
// Limits: a car already past the last junction before the street and committed to it ends at the end of its edge and waits (the sweep for the safety net takes it away); a street of vertices
// only (no real junction at either end) can leave a short queue at the last vertex; the guide of a baked route that needs a "join" (destination beyond the tiles) can choose to join the baked
// route again before the closed street: see the report, a small hook in src/route-guide.js would fix it.
//
// The route guide: when a job's route crosses the new site, guide.replan('works') is called once, and the new plan goes round (the edge is out of the graph for plan()).
//
// Drawing: nothing is made until the first site, nothing is drawn when none is alive. Each site is one merged mesh (MeshStandardMaterial, vertex colours times one small atlas: white, red and white
// stripes, the cone, the two signs) written into a pooled buffer, one draw call, about 1100 triangles for a street 12 m wide; plus one more draw at night for the amber lamps, which blink together
// through the colour of one shared material. The pool is built when needed and never freed; the buffers are rewritten in place once when the lapa comes within 220 m (the fine ground heights have
// arrived by then). The workers are scripted pedestrians (src/pedestrians.js spawnScripted), made at the same moment. Every mesh carries userData.leanMover, as the boats do, for the street-canyon culling.
//
// For another module (the Festino, src/job-festino.js):
//   import { closeRoadAt } from './job-roadworks.js';
//   const h = closeRoadAt(x, z, { seconds: 900, workers: false });   // h: { x, z, alive(), remove() } or null
// Closes the street under (x, z) (the nearest drivable centreline, its direction from the road) with barriers, cones and the sign, walls and graph closed as above, for `seconds` (0: until
// h.remove()). Options: seconds (default 600), workers (default true), dx, dz (the direction of the street, when the point is at a crossing and the nearest road is the wrong one). It does not test
// for a detour and does not count against the two automatic sites; the pool has four places in all. It returns null when the module is not loaded, the road graph and the walls are not here yet
// (the point must be inside the full-detail tiles, within about 450 m of the lapa), the walls do not close the street within 15 m, or the pool is full. The caller keeps h and calls h.remove() when
// the Festino is over (or lets the time run out); alive() tells whether it is still there.
//
// Test link: ?works=1 puts a site about 150 m ahead a few seconds into the drive. ?debug gives window.__works (the sites, the search state, the pool).
// Words: the signs, as [italian, english] pairs, are plain Italian on purpose: they are road signs, and the real ones are in Italian (the owner passed them so on 22 Nov 2026).
import * as THREE from 'three';
import { TRACKS } from './event-routes.js';

const MAX_AUTO = 2, POOL = 4;                 // automatic sites alive at once, and places in the pool (the rest for closeRoadAt)
const FIRST = [70, 110], EVERY = [150, 270];  // seconds into the drive, then between two automatic sites
const AHEAD = [260, 440], NEAR_MIN = 120, SEEN_MIN = 300, FAR_OUT = 700, FAR_T = 8, APART = 400;   // metres from the lapa; the world is full detail out to about 450 m
const FINE_D = 220;                           // the lapa this near: the buffers are written again with the fine ground
const VOFF = 3.0, REACH = 15, ROAD_W = [5, 18], MIN_LEN = 24, DETOUR = 1600, TRACK_D = 45, SLOT_D = 70;
const CAP_V = 4800, CAP_I = 7400, CAP_L = 360, ATLAS_W = 512, ATLAS_H = 256;
const WORKERS = ['coppola2', 'nonno_gilet'];   // cast ids (assets/peds/sprites.js): the old man who watches and the man in the flat cap who works
const TEXT = {   // road signs: Italian, like the real ones
  works: [['LAVORI', 'ROAD'], ['IN CORSO', 'WORKS']],
  closed: [['STRADA', 'ROAD'], ['CHIUSA', 'CLOSED']],
};

let api = null;   // the one instance (setup was called), for closeRoadAt
export function closeRoadAt(x, z, opt) { return api ? api.close(x, z, opt || {}) : null; }

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export default function setup(X) {
  const { car, scene, camera, traffic, groundAt, walls2d, pedestrians, guide, params } = X;
  const G = traffic && traffic.debug && traffic.debug.G;
  if (!G || !walls2d || !scene) return;
  const dbg = params.has('debug'), force = params.get('works');
  const now = () => performance.now() / 1000;
  const EDGES = G.EDGES;

  // ------------------------------------------------------------------------------------ the atlas: white, stripes, cone, two signs
  const R_WHITE = [0, 0, 32, 32], R_STRIPE = [48, 0, 304, 40], R_CONE = [320, 0, 352, 64], R_SIGN1 = [0, 64, 256, 192], R_SIGN2 = [256, 64, 512, 192];
  const cv = document.createElement('canvas'); cv.width = ATLAS_W; cv.height = ATLAS_H;
  const atlas = new THREE.CanvasTexture(cv); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  let atlasLang = '';
  function drawAtlas() {
    const lg = X.lang(); if (lg === atlasLang) return; atlasLang = lg;
    const g = cv.getContext('2d'), i = lg === 'en' ? 1 : 0;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, ATLAS_W, ATLAS_H);
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 40, ATLAS_W, 24);   // the gutters round the regions are not pure white, so a stray sample shows
    g.fillStyle = '#ffffff'; g.fillRect(...rect(R_WHITE));
    const [sx, sy, sx1, sy1] = R_STRIPE; g.save(); g.beginPath(); g.rect(sx, sy, sx1 - sx, sy1 - sy); g.clip();   // red and white, at 45 degrees
    g.fillStyle = '#f4f1ea'; g.fillRect(sx, sy, sx1 - sx, sy1 - sy); g.fillStyle = '#d8281f';
    for (let k = -2; k < 9; k++) { const x0 = sx + k * 40; g.beginPath(); g.moveTo(x0, sy1); g.lineTo(x0 + 20, sy1); g.lineTo(x0 + 20 + 40, sy); g.lineTo(x0 + 40, sy); g.closePath(); g.fill(); }
    g.restore();
    const [cx0, cy0, cx1, cy1] = R_CONE; g.fillStyle = '#e8501e'; g.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0); g.fillStyle = '#f4f1ea'; g.fillRect(cx0, cy0 + 30, cx1 - cx0, 14); g.fillRect(cx0, cy0 + 8, cx1 - cx0, 8);   // top is canvas y 0
    const sign = (r, a, b, tri) => {
      const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
      g.fillStyle = '#f4f1ea'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#c8281f'; g.lineWidth = 12; g.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
      g.fillStyle = '#17120f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 44px "Arial Narrow", Impact, sans-serif';
      const tx = tri ? x0 + w * 0.62 : x0 + w / 2;
      g.fillText(a, tx, y0 + h * 0.36); g.fillText(b, tx, y0 + h * 0.68);
      if (tri) {   // the warning triangle with a man and his shovel
        const tx0 = x0 + 14, ty1 = y1 - 18, tw = 78, th = 70;
        g.fillStyle = '#f4f1ea'; g.strokeStyle = '#c8281f'; g.lineWidth = 7; g.beginPath(); g.moveTo(tx0 + tw / 2, ty1 - th); g.lineTo(tx0 + tw, ty1); g.lineTo(tx0, ty1); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = '#17120f'; g.fillStyle = '#17120f'; g.lineWidth = 4; const mx = tx0 + tw / 2 - 4, my = ty1 - 18;
        g.beginPath(); g.arc(mx, my - 24, 4, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(mx, my - 20); g.lineTo(mx - 3, my - 4); g.moveTo(mx, my - 16); g.lineTo(mx + 12, my - 10); g.moveTo(mx - 3, my - 4); g.lineTo(mx - 9, my + 2); g.moveTo(mx - 3, my - 4); g.lineTo(mx + 2, my + 3); g.stroke();
        g.fillRect(mx + 11, my - 12, 9, 7);
      }
    };
    sign(R_SIGN1, TEXT.works[0][i], TEXT.works[1][i], true); sign(R_SIGN2, TEXT.closed[0][i], TEXT.closed[1][i], false);
    atlas.needsUpdate = true;
  }
  const rect = r => [r[0], r[1], r[2] - r[0], r[3] - r[1]];
  const uvr = r => [r[0] / ATLAS_W, 1 - r[3] / ATLAS_H, r[2] / ATLAS_W, 1 - r[1] / ATLAS_H];   // u0, v0 (bottom), u1, v1 (top)
  const UV_WHITE = (() => { const u = uvr(R_WHITE); return [(u[0] + u[2]) / 2, (u[1] + u[3]) / 2, (u[0] + u[2]) / 2, (u[1] + u[3]) / 2]; })(), UV_STRIPE = uvr(R_STRIPE), UV_CONE = uvr(R_CONE), UV_SIGN1 = uvr(R_SIGN1), UV_SIGN2 = uvr(R_SIGN2);
  // the texture inset by half a texel so that the edge of a region never samples the next one
  const inset = u => [u[0] + 0.5 / ATLAS_W, u[1] + 0.5 / ATLAS_H, u[2] - 0.5 / ATLAS_W, u[3] - 0.5 / ATLAS_H];
  const UV_S = inset(UV_STRIPE), UV_C = inset(UV_CONE), UV_1 = inset(UV_SIGN1), UV_2 = inset(UV_SIGN2);

  const solidMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffa81a, toneMapped: false });
  const colCache = new Map(), tmpC = new THREE.Color();
  const lin = hex => { let c = colCache.get(hex); if (!c) { tmpC.setHex(hex); colCache.set(hex, c = [tmpC.r, tmpC.g, tmpC.b]); } return c; };

  // ------------------------------------------------------------------------------------ the pooled buffer: boxes and cones in world space
  class Buf {
    constructor(capV, capI, withUv) {
      this.cv = capV; this.ci = capI; this.pos = new Float32Array(capV * 3); this.nor = new Float32Array(capV * 3); this.col = new Float32Array(capV * 3); this.uv = withUv ? new Float32Array(capV * 2) : null;
      this.idx = new Uint16Array(capI); this.nv = 0; this.ni = 0; this.reset();
    }
    reset() { this.nv = this.ni = 0; this.x0 = this.z0 = this.y0 = 1e9; this.x1 = this.z1 = this.y1 = -1e9; }
    // a quad centred (cx, cy, cz), half extents ht along t and hb along b, outward normal n; t x b = n; corners bottom-left, bottom-right, top-right, top-left seen from outside
    quad(cx, cy, cz, tx, ty, tz, bx, by, bz, ht, hb, nx, ny, nz, c, uv) {
      if (this.nv + 4 > this.cv || this.ni + 6 > this.ci) return false;
      const o = this.nv, rgb = lin(c), S = QS;
      for (let k = 0; k < 4; k++) {
        const a = S[k][0], b = S[k][1], j = (o + k) * 3, x = cx + tx * ht * a + bx * hb * b, y = cy + ty * ht * a + by * hb * b, z = cz + tz * ht * a + bz * hb * b;
        this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.nor[j] = nx; this.nor[j + 1] = ny; this.nor[j + 2] = nz; this.col[j] = rgb[0]; this.col[j + 1] = rgb[1]; this.col[j + 2] = rgb[2];
        if (this.uv) { this.uv[(o + k) * 2] = k === 0 || k === 3 ? uv[0] : uv[2]; this.uv[(o + k) * 2 + 1] = k < 2 ? uv[1] : uv[3]; }
        if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (z < this.z0) this.z0 = z; if (z > this.z1) this.z1 = z; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
      }
      const q = this.idx, i = this.ni; q[i] = o; q[i + 1] = o + 1; q[i + 2] = o + 2; q[i + 3] = o; q[i + 4] = o + 2; q[i + 5] = o + 3; this.nv += 4; this.ni += 6; return true;
    }
    // a box standing on y0 at (cx, cz): sx across the street (local e1), sy high, sz along it (local e2), turned by ang about the vertical; uvP / uvM: the faces looking along +e2 and -e2
    box(cx, cz, y0, sx, sy, sz, ang, c, uvP = UV_WHITE, uvM = UV_WHITE) {
      const ca = Math.cos(ang), sa = Math.sin(ang), e1x = F.ax * ca + F.vx * sa, e1z = F.az * ca + F.vz * sa, e2x = F.vx * ca - F.ax * sa, e2z = F.vz * ca - F.az * sa, cy = y0 + sy / 2;
      this.quad(cx + e2x * sz / 2, cy, cz + e2z * sz / 2, -e1x, 0, -e1z, 0, 1, 0, sx / 2, sy / 2, e2x, 0, e2z, c, uvP);       // +e2 (t = up x n = -e1)
      this.quad(cx - e2x * sz / 2, cy, cz - e2z * sz / 2, e1x, 0, e1z, 0, 1, 0, sx / 2, sy / 2, -e2x, 0, -e2z, c, uvM);       // -e2 (t = +e1)
      this.quad(cx + e1x * sx / 2, cy, cz + e1z * sx / 2, e2x, 0, e2z, 0, 1, 0, sz / 2, sy / 2, e1x, 0, e1z, c, UV_WHITE);     // +e1 (t = e2: up x e1 = (e1z, 0, -e1x) = e2 for this frame)
      this.quad(cx - e1x * sx / 2, cy, cz - e1z * sx / 2, -e2x, 0, -e2z, 0, 1, 0, sz / 2, sy / 2, -e1x, 0, -e1z, c, UV_WHITE);
      this.quad(cx, y0 + sy, cz, e1x, 0, e1z, e2x, 0, e2z, sx / 2, sz / 2, 0, 1, 0, c, UV_WHITE);                              // the top (t = e1, b = e2: e1 x e2 = up)
    }
    // six-sided frustum, base radius r0 at y0, top r1 at y0 + h, the cone strip on its sides (the band is on the strip)
    cone(cx, cz, y0, r0, r1, h, c) {
      for (let k = 0; k < 6; k++) {
        const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3, am = (a0 + a1) / 2;
        if (this.nv + 4 > this.cv || this.ni + 6 > this.ci) return;
        const o = this.nv, rgb = lin(c), nx = Math.cos(am) * 0.96, nz = Math.sin(am) * 0.96;
        for (let q = 0; q < 4; q++) {
          const a = q === 0 || q === 3 ? a0 : a1, top = q >= 2, r = top ? r1 : r0, j = (o + q) * 3, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = y0 + (top ? h : 0);
          this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.nor[j] = nx; this.nor[j + 1] = 0.28; this.nor[j + 2] = nz; this.col[j] = rgb[0]; this.col[j + 1] = rgb[1]; this.col[j + 2] = rgb[2];
          this.uv[(o + q) * 2] = q === 0 || q === 3 ? UV_C[0] : UV_C[2]; this.uv[(o + q) * 2 + 1] = top ? UV_C[3] : UV_C[1];
          if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (z < this.z0) this.z0 = z; if (z > this.z1) this.z1 = z; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
        }
        const i = this.ni, ix = this.idx; ix[i] = o; ix[i + 1] = o + 1; ix[i + 2] = o + 2; ix[i + 3] = o; ix[i + 4] = o + 2; ix[i + 5] = o + 3; this.nv += 4; this.ni += 6;
      }
    }
  }
  const QS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const F = { cx: 0, cz: 0, ax: 1, az: 0, vx: 0, vz: 1 };   // the frame of the site being written: a across the street, v along it
  const wx = (a, v) => F.cx + F.ax * a + F.vx * v, wz = (a, v) => F.cz + F.az * a + F.vz * v;
  const gAt = (a, v) => groundAt(wx(a, v), wz(a, v));

  // ------------------------------------------------------------------------------------ a site's meshes
  const pool = [];   // { used, buf, lamps, mesh, lampMesh }
  function takeSlot() {
    for (const s of pool) if (!s.used) { s.used = true; return s; }
    if (pool.length >= POOL) return null;
    const buf = new Buf(CAP_V, CAP_I, true), lamps = new Buf(CAP_L, 600, false);
    const geo = new THREE.BufferGeometry(), lg = new THREE.BufferGeometry();
    for (const [g, b] of [[geo, buf], [lg, lamps]]) {
      g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(b.nor, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(b.col, 3).setUsage(THREE.DynamicDrawUsage)); if (b.uv) g.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(b.idx, 1).setUsage(THREE.DynamicDrawUsage)); g.boundingSphere = new THREE.Sphere(); g.setDrawRange(0, 0);
    }
    const mesh = new THREE.Mesh(geo, solidMat), lampMesh = new THREE.Mesh(lg, lampMat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'roadworks'; lampMesh.name = 'roadworks_lamps'; mesh.visible = lampMesh.visible = false;
    scene.add(mesh, lampMesh);
    const s = { used: true, buf, lamps, mesh, lampMesh }; pool.push(s); return s;
  }
  function publish(s) {   // the buffers are written: upload, bound, cull box
    const { buf, lamps, mesh, lampMesh } = s;
    for (const [m, b] of [[mesh, buf], [lampMesh, lamps]]) {
      const g = m.geometry; for (const k of ['position', 'normal', 'color', 'uv']) if (g.attributes[k]) g.attributes[k].needsUpdate = true; g.index.needsUpdate = true; g.setDrawRange(0, b.ni);
      const cx = (buf.x0 + buf.x1) / 2, cz = (buf.z0 + buf.z1) / 2, cy = (buf.y0 + buf.y1) / 2;
      g.boundingSphere.center.set(cx, cy, cz); g.boundingSphere.radius = Math.hypot(buf.x1 - buf.x0, buf.z1 - buf.z0, buf.y1 - buf.y0) / 2 + 1;
      m.userData.leanMover = { box: [buf.x0 - 1, buf.z0 - 1, buf.x1 + 1, buf.z1 + 1, buf.y1 + 1, buf.y0 - 1], parts: null };
    }
    mesh.visible = true;
  }
  function release(s) { s.used = false; s.mesh.visible = s.lampMesh.visible = false; s.mesh.geometry.setDrawRange(0, 0); s.lampMesh.geometry.setDrawRange(0, 0); }

  // what is drawn at a site, from its frame and the two barrier lines (their reach across the street from the middle: lines[0] at -VOFF, lines[1] at +VOFF)
  function write(site) {
    const s = site.slot, b = s.buf, L = s.lamps; b.reset(); L.reset();
    let sd0 = site.seed; const rr = (lo, hi) => { sd0 = (sd0 + 0x6D2B79F5) | 0; let t = Math.imul(sd0 ^ (sd0 >>> 15), 1 | sd0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return lo + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (hi - lo); };   // the same heaps every time the site is written
    F.cx = site.cx; F.cz = site.cz; F.ax = site.ax; F.az = site.az; F.vx = site.vx; F.vz = site.vz;
    const hw = site.hw, lampSpots = [];
    for (let li = 0; li < 2; li++) {
      const sd = li ? 1 : -1, ln = site.lines[li], span = ln.aMax - ln.aMin, n = Math.max(1, Math.round(span / 2.0)), w = span / n, v = sd * VOFF;
      for (let i = 0; i < n; i++) {   // the barriers: a striped board on two feet, side to side without a gap
        const a = ln.aMin + w * (i + 0.5), x = wx(a, v), z = wz(a, v), y = gAt(a, v), bw = w - 0.05;
        b.box(x, z, y + 0.78, bw, 0.3, 0.05, 0, 0xffffff, UV_S, UV_S);
        for (const o of [-1, 1]) b.box(wx(a + o * (bw / 2 - 0.14), v), wz(a + o * (bw / 2 - 0.14), v), y, 0.05, 0.8, 0.46, 0, 0xcfcfcf);
        if (i === 0 || i === n - 1 || i === (n >> 1)) lampSpots.push([a, v, y + 1.08 + 0.1]);
      }
      // the sign over the middle of the line ("strada chiusa"), on two thin posts, looking out
      const am = (ln.aMin + ln.aMax) / 2, vs = v + sd * 0.12, ys = gAt(am, vs);
      for (const o of [-0.5, 0.5]) b.box(wx(am + o, vs), wz(am + o, vs), ys, 0.05, 1.2, 0.05, 0, 0x8a8a86);
      b.box(wx(am, vs), wz(am, vs), ys + 1.2, 1.3, 0.62, 0.04, 0, 0xffffff, sd > 0 ? UV_2 : UV_WHITE, sd < 0 ? UV_2 : UV_WHITE);
      // the warning sign on a pole at the right-hand kerb of the approach (the barrier line is its mirror at the other end)
      const as = sd < 0 ? ln.aMax - 0.9 : ln.aMin + 0.9, vp = v + sd * 0.8, yp = gAt(as, vp);
      b.box(wx(as, vp), wz(as, vp), yp, 0.07, 2.1, 0.07, 0, 0x8a8a86);
      b.box(wx(as, vp), wz(as, vp), yp + 1.65, 0.9, 0.62, 0.04, 0, 0xffffff, sd > 0 ? UV_1 : UV_WHITE, sd < 0 ? UV_1 : UV_WHITE);
      // cones in front of the line, and two out in the road to lead into it
      const cs = [ln.aMin + 1.0, ln.aMin + span * 0.36, ln.aMin + span * 0.64, ln.aMax - 1.0];
      for (const a of cs) { const x = wx(a, v + sd * 1.0), z = wz(a, v + sd * 1.0), y = gAt(a, v + sd * 1.0); b.box(x, z, y, 0.34, 0.03, 0.34, 0, 0x2a2826); b.cone(x, z, y + 0.03, 0.15, 0.04, 0.68, 0xffffff); }
      for (const a of [-hw * 0.45, hw * 0.45]) { const vv = v + sd * 4.6, x = wx(a, vv), z = wz(a, vv), y = gAt(a, vv); b.box(x, z, y, 0.34, 0.03, 0.34, 0, 0x2a2826); b.cone(x, z, y + 0.03, 0.15, 0.04, 0.68, 0xffffff); }
    }
    // the works between the lines: an open trench (a dark floor, planks round it), the spoil beside it, a heap of rubble, two lengths of pipe
    const tw = Math.min(hw * 1.0, 4.6), tl = 3.0, ac = -hw * 0.22, tY = gAt(ac, 0); site.ac = ac; site.tw = tw; site.tl = tl;
    b.quad(wx(ac, 0), tY + 0.07, wz(ac, 0), F.ax, 0, F.az, F.vx, 0, F.vz, tw / 2, tl / 2, 0, 1, 0, 0x120f0d, UV_WHITE);
    b.box(wx(ac, -tl / 2), wz(ac, -tl / 2), tY, tw + 0.3, 0.12, 0.16, 0, 0xb08a52); b.box(wx(ac, tl / 2), wz(ac, tl / 2), tY, tw + 0.3, 0.12, 0.16, 0, 0xb08a52);
    b.box(wx(ac - tw / 2, 0), wz(ac - tw / 2, 0), tY, 0.16, 0.12, tl, 0, 0xb08a52); b.box(wx(ac + tw / 2, 0), wz(ac + tw / 2, 0), tY, 0.16, 0.12, tl, 0, 0xb08a52);
    const sa = ac + tw / 2 + 1.0;   // the spoil: a long low ridge of earth, a few boxes
    for (let i = 0; i < 7; i++) { const vv = (i - 3) * 0.42 + rr(-0.1, 0.1), aa = sa + rr(-0.3, 0.3), h = 0.28 + rr(0, 0.32), sz = 0.7 + rr(0, 0.35); b.box(wx(aa, vv), wz(aa, vv), gAt(aa, vv), 0.8 + rr(0, 0.4), h, sz, rr(-0.5, 0.5), i % 2 ? 0x6b5238 : 0x7d6244); }
    const ra = Math.min(hw * 0.7, ac - tw / 2 - 1.2);   // the rubble: grey and brick boxes, big at the bottom
    for (let i = 0; i < 14; i++) { const aa = ra - Math.abs(rr(-0.5, 0.9)) * 0.9 + rr(-0.4, 0.4), vv = rr(-1.2, 1.2), h = 0.12 + rr(0, 0.26 * (1 - Math.min(1, Math.hypot(aa - ra, vv) / 1.4))) + 0.06, s2 = 0.18 + rr(0, 0.32);
      b.box(wx(aa, vv), wz(aa, vv), gAt(aa, vv), s2, h, s2 * rr(0.7, 1.3), rr(0, 3), [0x8a8782, 0x9b6a52, 0x6f6c68, 0xb7b0a2, 0x7e5a46][i % 5]); }
    for (let i = 0; i < 2; i++) { const aa = ac + tw / 2 + 0.3 + i * 0.35, vv = 1.4; b.box(wx(aa, vv), wz(aa, vv), gAt(aa, vv), 0.28, 0.28, 2.0, 0.08 * (i ? 1 : -1), 0xd5701c); }
    // the amber lamps on the barriers, written into their own buffer (night only)
    for (const [a, v, y] of lampSpots) L.box(wx(a, v), wz(a, v), y - 0.1, 0.2, 0.2, 0.2, 0, 0xffffff);
    publish(s);
  }

  // ------------------------------------------------------------------------------------ the walls across the street
  const addWall = seg => walls2d.addSeg(seg, seg[0], seg[1], seg[2], seg[3]);
  function removeWall(seg) {   // splice the segment out of the cells addSeg put it in
    const c = walls2d.cell, x0 = Math.min(seg[0], seg[2]), x1 = Math.max(seg[0], seg[2]), z0 = Math.min(seg[1], seg[3]), z1 = Math.max(seg[1], seg[3]);
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
      const k = walls2d.key(ix, iz), a = walls2d.m.get(k); if (!a) continue;
      const p = a.indexOf(seg); if (p >= 0) { a[p] = a[a.length - 1]; a.pop(); } if (!a.length) walls2d.m.delete(k);
    }
  }
  // the nearest long wall along a ray from (x, z) in the unit direction (ax, az): distance, or max + 1 when there is none. Fences (seg.fn) and the walls of other levels are not walls here.
  let rx0 = 0, rz0 = 0, rax = 0, raz = 0, rbest = 0;
  const rayCb = s => {
    if (s.fn || s.lv !== undefined) return;
    const ex = s[2] - s[0], ez = s[3] - s[1]; if (ex * ex + ez * ez < 6.25) return;
    const den = rax * ez - raz * ex; if (Math.abs(den) < 1e-6) return;
    const qx = s[0] - rx0, qz = s[1] - rz0, t = (qx * ez - qz * ex) / den, u = (qx * raz - qz * rax) / den;
    if (t > 0.05 && t < rbest && u >= 0 && u <= 1) rbest = t;
  };
  function rayWall(x, z, ax, az, max) {
    rx0 = x; rz0 = z; rax = ax; raz = az; rbest = max + 1; const x1 = x + ax * max, z1 = z + az * max;
    walls2d.query(Math.min(x, x1) - 1, Math.min(z, z1) - 1, Math.max(x, x1) + 1, Math.max(z, z1) + 1, rayCb); return rbest;
  }
  // the reach of the street from the middle (cx, cz) to the walls either side, along (ax, az), at distance v along the street (direction vx, vz); into lines[li] { aMin, aMax }
  function lineReach(cx, cz, ax, az, vx, vz, v, out) {
    const px = cx + vx * v, pz = cz + vz * v, r = rayWall(px, pz, ax, az, REACH), l = rayWall(px, pz, -ax, -az, REACH);
    if (r > REACH || l > REACH || r + l > 28) return false;
    out.aMin = -(l - 0.05); out.aMax = r - 0.05; return true;
  }

  // ------------------------------------------------------------------------------------ the road graph: close an edge, open it again
  let aliveRef = G.alive, aliveChanged = 0;
  function closeEdges(site, e) {
    site.edges = []; site.saved = [];
    for (const q of [e, e.rev >= 0 ? EDGES[e.rev] : null]) {
      if (!q || q.dead) continue;
      site.edges.push(q); site.saved.push({ ped: q.ped, transit: q.transit, alive: [G.alive[0][q.id], G.alive[1][q.id], G.alive[2][q.id], G.alive[3][q.id]], ea: q.alive });
      q.ped = true; q.transit = false;
      for (const v of q.veh) v.hide = true;
    }
    for (const v of traffic.vehicles) for (const q of site.edges) if (v.route && v.route.indexOf(q) >= 0) v.hide = true;
    zeroAlive();
  }
  function zeroAlive() {
    aliveRef = G.alive;
    for (const s of sites) for (const q of s.edges) if (!q.dead && EDGES[q.id] === q) { for (let k = 0; k < 4; k++) if (q.id < G.alive[k].length) G.alive[k][q.id] = 0; q.alive = false; }
  }
  function openEdges(site) {
    let redo = false;
    site.edges.forEach((q, i) => {
      if (q.dead || EDGES[q.id] !== q) return;
      const sv = site.saved[i]; q.ped = sv.ped; q.transit = sv.transit;
      if (aliveChanged !== site.aliveAt) redo = true; else { for (let k = 0; k < 4; k++) if (q.id < G.alive[k].length) G.alive[k][q.id] = sv.alive[k]; q.alive = sv.ea; }
    });
    site.edges = [];
    if (redo) G.recomputeAlive();   // the judgement was made again while the street was shut: do it once more now that it is open
  }

  // ------------------------------------------------------------------------------------ the sites
  const sites = [];
  const EF = { e: null, t: 0, d: 0 };
  function openSite(o) {   // o: { cx, cz, ax, az, vx, vz, hw, lines, edge (or null), auto, seconds, workers }
    const slot = takeSlot(); if (!slot) return null;
    drawAtlas();
    const site = { ...o, slot, edges: [], saved: [], walls: [], ids: [], fine: false, seed: (Math.random() * 1e9) | 0, ac: 0, tw: 0, tl: 3, farT: 0, slowT: 0, t0: now(), until: o.seconds > 0 ? now() + o.seconds : 0, aliveAt: aliveChanged, gone: false };
    sites.push(site);
    for (let li = 0; li < 2; li++) {   // the walls, from wall to wall and a little into them
      const sd = li ? 1 : -1, ln = site.lines[li], v = sd * VOFF, seg = [wx2(site, ln.aMin - 0.5, v), wz2(site, ln.aMin - 0.5, v), wx2(site, ln.aMax + 0.5, v), wz2(site, ln.aMax + 0.5, v)];
      addWall(seg); site.walls.push(seg);
    }
    if (o.edge) closeEdges(site, o.edge);
    write(site);
    // a running job whose route passes the works asks for a way round
    if (guide.has()) { const p = guide.route(); let hit = false; for (let i = 0; i + 3 < p.length && !hit; i += 2) hit = segDist(site.cx, site.cz, p[i], p[i + 1], p[i + 2], p[i + 3]) < 14; if (hit) guide.replan('works'); }
    return site;
  }
  const wx2 = (s, a, v) => s.cx + s.ax * a + s.vx * v, wz2 = (s, a, v) => s.cz + s.az * a + s.vz * v;
  function segDist(px, pz, x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz, t = l2 ? clamp(((px - x0) * dx + (pz - z0) * dz) / l2, 0, 1) : 0; return Math.hypot(px - x0 - dx * t, pz - z0 - dz * t); }
  function closeSite(site) {
    if (site.gone) return; site.gone = true;
    for (const w of site.walls) removeWall(w); site.walls.length = 0;
    openEdges(site);
    for (const id of site.ids) pedestrians.remove?.(id); site.ids.length = 0;
    release(site.slot);
    const i = sites.indexOf(site); if (i >= 0) sites.splice(i, 1);
  }
  function fine(site) {   // the lapa is near: the ground is the fine one now, write again and put the workers there
    site.fine = true; write(site);
    if (site.workers && pedestrians.spawnScripted && !site.ids.length) {
      const spots = [[site.ac, -site.tl / 2 - 0.6], [site.ac + site.tw / 2 + 0.45, 0.9]];
      for (let i = 0; i < 2; i++) {
        const [a, v] = spots[i], id = pedestrians.spawnScripted(WORKERS[i], wx2(site, a, v), wz2(site, a, v));
        if (id >= 0) { pedestrians.face(id, wx2(site, site.ac, 0), wz2(site, site.ac, 0)); site.ids.push(id); }
      }
    }
  }

  // ------------------------------------------------------------------------------------ finding a street
  let bSt = new Uint32Array(0), bD = new Float32Array(0), bQ = new Int32Array(0), bStamp = 0;
  function reach(from, to, skipA, skipB, cap) {   // is there a way from node `from` to node `to` that does not use the two edges, within cap metres (a bounded sweep)
    const n = G.NX.length; if (bSt.length < n) { bSt = new Uint32Array(n + 256); bD = new Float32Array(n + 256); bQ = new Int32Array(n + 256); }
    bStamp++; let h = 0, t = 0; bQ[t++] = from; bSt[from] = bStamp; bD[from] = 0;
    while (h < t) {
      const i = bQ[h++]; if (i === to) return true;
      const outs = G.NOUT[i];
      for (let k = 0; k < outs.length; k++) {
        const e = outs[k]; if (e === skipA || e === skipB || e.dead || (e.ped && !e.transit)) continue;
        const b = e.b; if (bSt[b] === bStamp) continue; const d = bD[i] + e.len; if (d > cap) continue;
        bSt[b] = bStamp; bD[b] = d; bQ[t++] = b;
      }
    }
    return false;
  }
  const tracksNear = (x, z, r) => { for (const k in TRACKS) { const p = TRACKS[k].pts; for (let i = 0; i + 3 < p.length; i += 2) if (segDist(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) < r) return true; } return false; };
  function placesNear(x, z) {
    for (const s of X.slots || []) if (Math.hypot(s.x - x, s.z - z) < SLOT_D) return true;
    for (const v of X.vendors || []) if (Math.hypot(v.x - x, v.z - z) < SLOT_D) return true;
    const st = guide.has() ? guide.state() : null; if (st && st.dest && Math.hypot(st.dest.x - x, st.dest.z - z) < SLOT_D) return true;
    for (const s of sites) if (Math.hypot(s.cx - x, s.cz - z) < APART) return true;
    return false;
  }
  const sc = { e: null, t: 0, cx: 0, cz: 0, ax: 1, az: 0, vx: 0, vz: 1, hw: 0, lines: [{ aMin: 0, aMax: 0 }, { aMin: 0, aMax: 0 }] };
  // judge an edge (the dear checks): fills sc and returns true if a site can be made on it
  function judge(e, dmin, seen) {
    const len = e.len, t = len < 34 ? len / 2 : len * rand(0.35, 0.65), cx = G.NX[e.a] + e.dx * t, cz = G.NZ[e.a] + e.dz * t, d = Math.hypot(cx - car.x, cz - car.z);
    if (d < dmin || placesNear(cx, cz) || tracksNear(cx, cz, TRACK_D)) return false;
    if (seen && d < SEEN_MIN && onScreen(cx, groundAt(cx, cz), cz)) return false;
    const ax = e.rx, az = e.rz, vx = e.dx, vz = e.dz;
    for (let li = 0; li < 2; li++) if (!lineReach(cx, cz, ax, az, vx, vz, li ? VOFF : -VOFF, sc.lines[li])) return false;
    const rev = e.rev >= 0 ? EDGES[e.rev] : null;
    if (!reach(e.a, e.b, e, rev, DETOUR) || (rev && !reach(e.b, e.a, e, rev, DETOUR))) return false;
    sc.cx = cx; sc.cz = cz; sc.ax = ax; sc.az = az; sc.vx = vx; sc.vz = vz; sc.hw = Math.max(2.5, Math.min(e.w / 2, 7)); sc.e = e;
    return true;
  }
  const pv = new THREE.Vector3();
  function onScreen(x, y, z) { pv.set(x, y + 1, z).project(camera); return pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1; }

  const cand = [], candSc = [];
  let tgx = 0, tgz = 0, lo = AHEAD[0], hi = AHEAD[1], dmin = NEAR_MIN, seenOn = true, strict = true;
  const gather = e => {
    if (e.dead || e.ped || e.fast || e.br || e.svc || e.rank < 2 || e.rank > 4 || e.len < MIN_LEN || e.w < ROAD_W[0] || e.w > ROAD_W[1] || G.alive[0][e.id] !== 1) return;
    if (e.rev >= 0 && e.rev < e.id) return;   // one of a pair
    const mx = (G.NX[e.a] + G.NX[e.b]) / 2, mz = (G.NZ[e.a] + G.NZ[e.b]) / 2, d = Math.hypot(mx - car.x, mz - car.z);
    if (d < lo - 30 || d > hi + 30) return;
    const jn = G.NDEG[e.a] >= 3 && G.NDEG[e.b] >= 3;
    if (strict && !jn) return;
    cand.push(e); candSc.push(Math.hypot(mx - tgx, mz - tgz) - (jn ? 60 : 0) - e.len * 0.2 + Math.random() * 25);
  };
  function startSearch() {
    cand.length = candSc.length = 0;
    let tx, tz;
    const f = Math.hypot(car.vx, car.vz) > 2 ? [car.vx / Math.hypot(car.vx, car.vz), car.vz / Math.hypot(car.vx, car.vz)] : [Math.sin(car.th), Math.cos(car.th)], dist = (lo + hi) / 2;
    const rp = guide.has() && Math.random() < 0.3 ? guide.ahead(dist) : null;   // now and then on the way of a running job: the better surprise, but a detour on a timed ride can cost the pay, so not often
    if (rp) { tx = rp.x; tz = rp.z; } else { const sd = rand(-0.35, 0.35); tx = car.x + (f[0] * Math.cos(sd) - f[1] * Math.sin(sd)) * dist; tz = car.z + (f[0] * Math.sin(sd) + f[1] * Math.cos(sd)) * dist; }
    tgx = tx; tgz = tz;
    G.eachEdgeNear(tx, tz, 120, gather);
    const ord = candSc.map((s, i) => i).sort((a, b) => candSc[a] - candSc[b]), es = ord.map(i => cand[i]);
    cand.length = 0; for (const e of es) cand.push(e);
    return cand.length;
  }

  // the state of the search, one step a frame
  const S = { mode: 'wait', at: 0, i: 0, tries: 0, auto: 0, firstDone: false };
  let nextAt = now() + (force ? 3 : rand(FIRST[0], FIRST[1]));
  function step(t) {
    if (S.mode === 'wait') {
      if (t < nextAt || Math.hypot(car.vx, car.vz) < 3 || car.flying) return;
      let autos = 0; for (const s of sites) if (s.auto) autos++;
      if (autos >= MAX_AUTO || !G.tileLoaded(car.x, car.z)) { nextAt = t + 15; return; }
      const dbgNear = !!force && !S.firstDone;   // ?works=1: about 150 m ahead, and may be in view
      lo = dbgNear ? 110 : AHEAD[0]; hi = dbgNear ? 200 : AHEAD[1]; dmin = dbgNear ? 90 : NEAR_MIN; seenOn = !dbgNear; strict = S.tries < 3;
      if (!startSearch()) { S.tries++; nextAt = t + (S.tries > 6 ? 40 : 6); return; }
      S.mode = 'eval'; S.i = 0; return;
    }
    // judge up to two candidates this frame
    for (let n = 0; n < 2 && S.i < cand.length; n++) {
      const e = cand[S.i++];
      if (!e.dead && judge(e, dmin, seenOn)) {
        const o = { cx: sc.cx, cz: sc.cz, ax: sc.ax, az: sc.az, vx: sc.vx, vz: sc.vz, hw: sc.hw, lines: [{ ...sc.lines[0] }, { ...sc.lines[1] }], edge: sc.e, auto: true, seconds: 0, workers: true };
        if (openSite(o)) { S.auto++; S.firstDone = true; S.tries = 0; nextAt = t + rand(EVERY[0], EVERY[1]); S.mode = 'wait'; return; }
      }
    }
    if (S.i >= cand.length) { S.tries++; nextAt = t + (S.tries > 6 ? 40 : 8); S.mode = 'wait'; }
  }

  // ------------------------------------------------------------------------------------ the helper for other modules
  function close(x, z, o) {
    if (!G.tileLoaded(x, z)) return null;
    const sn = X.snapRoad(x, z); if (!sn || sn.d > 25) return null;
    let vx = sn.dx, vz = sn.dz; if (o.dx || o.dz) { const l = Math.hypot(o.dx, o.dz) || 1; vx = o.dx / l; vz = o.dz / l; }
    let cx = sn.x, cz = sn.z, edge = null, hw = Math.max(2.5, Math.min((sn.w || 6) / 2, 7));
    if (G.edgeFor(cx, cz, vx, vz, 20, EF)) { edge = EF.e; hw = Math.max(2.5, Math.min(edge.w / 2, 7)); if (!(o.dx || o.dz)) { vx = edge.dx; vz = edge.dz; } cx = G.NX[edge.a] + edge.dx * EF.t; cz = G.NZ[edge.a] + edge.dz * EF.t; }
    const ax = -vz, az = vx, lines = [{ aMin: 0, aMax: 0 }, { aMin: 0, aMax: 0 }];
    for (let li = 0; li < 2; li++) { if (!lineReach(cx, cz, ax, az, vx, vz, li ? VOFF : -VOFF, lines[li])) { lines[li].aMin = -(hw + 2); lines[li].aMax = hw + 2; } }   // no wall within reach: the kerbs and a little more
    const s = openSite({ cx, cz, ax, az, vx, vz, hw, lines, edge, auto: false, seconds: o.seconds === undefined ? 600 : o.seconds, workers: o.workers !== false });
    if (!s) return null;
    if (Math.hypot(car.x - cx, car.z - cz) < FINE_D) fine(s);
    return { x: cx, z: cz, alive: () => !s.gone, remove: () => closeSite(s) };
  }

  // ------------------------------------------------------------------------------------ every frame
  function tick(dt) {
    const t = now();
    if (G.alive !== aliveRef) { aliveChanged++; zeroAlive(); }
    if (sites.length) {
      const night = X.isNight(), ph = (t * 1.6) % 1, k = ph < 0.45 ? 1 : 0.1 + 0.9 * Math.max(0, 1 - (ph - 0.45) * 6);
      lampMat.color.setRGB(1 * k, 0.62 * k, 0.1 * k);
      for (const s of sites) s.slot.lampMesh.visible = night;
      for (let i = sites.length - 1; i >= 0; i--) {
        const s = sites[i]; s.slowT -= dt; if (s.slowT > 0) continue; s.slowT = 0.5;
        const d = Math.hypot(car.x - s.cx, car.z - s.cz);
        if (!s.fine && d < FINE_D) fine(s);
        s.farT = d > FAR_OUT ? s.farT + 0.5 : 0;
        if ((s.auto && s.farT >= FAR_T) || (s.until && t >= s.until)) { closeSite(s); continue; }
        for (let k2 = 0; k2 < s.edges.length; k2++) if (s.edges[k2].dead || EDGES[s.edges[k2].id] !== s.edges[k2]) {   // its tile was dropped and came back: the street is a new edge
          if (G.tileLoaded(s.cx, s.cz) && G.edgeFor(s.cx, s.cz, s.vx, s.vz, 8, EF)) { s.edges.length = s.saved.length = 0; closeEdges(s, EF.e); s.aliveAt = aliveChanged; }
          break;
        }
      }
    }
    step(t);
  }
  X.kinds.roadworks = { tick };
  api = { close, sites, pool, state: S };
  X.roadworks = { closeRoadAt, sites, state: S };
  if (dbg) window.__works = { sites, pool, S, G, close, soon: () => { nextAt = 0; }, drop: i => closeSite(sites[i]) };
}
