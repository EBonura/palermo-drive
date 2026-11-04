// The landfill of Bellolampo as the game builds it (docs/discarica.md; the ground, the pit and the pad are src/discarica-ground.js, the mission is src/event-dump.js): a fenced yard on the
// open ground inside the OSM landfill polygon, with an open gate and a sign, a gravel track from the service road, a pad, and a stepped pit (a vasca) full of rubbish: black bags, white
// ones, tyres, fridges, boxes, mattresses, drums, spread in heaps; a bulldozer and a compactor parked on the terraces, floodlight masts, a column of foul haze over the pit and, by day,
// gulls wheeling over it. All drawn in code: no photos, no models. It is built when the camera is within BUILD_R metres and thrown away when it is further (the ground itself, the carved pit,
// is always there: it is a function of x and z in src/world.js), so a day anywhere else in the city costs one distance test a frame.
// The pit is a real hole in the ground: hooks.plunge (src/vehicle-sphere.js) lets plunge() take the ball over the rim instead of following the slope down, keeps the chase camera on the
// body while it falls (car.deck), and on every landing from a few metres up gives a crash (S.hit: shake, sound), a burst of flying rubbish and dust. recover() puts the lapa back on the
// service road under the transition of src/transition.js; a lapa that is left in the pit for a few seconds with nothing else going on is recovered by itself.
// createDiscarica(env) -> { update(dt), plunge(car, ball), recover(), state, site, built(), inPit(), hold(on), burst(x, y, z, n, speed) }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { transition } from './transition.js';
import { PIT, YARD, TRACK, HA, HB, RIM_Y, FLOOR_D, pitSd, dumpDepth } from './discarica-ground.js';
import { SNAP } from './event-routes.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const TAU = Math.PI * 2, FAR = 1e7;
const BUILD_R = 520, SMOKE_R = 900, GULL_R = 260, ZONE = 100, IN_PIT = 5.5, HAUL_T = 7;   // metres from the camera; the plunge zone round the pit; depth (m under the rim) that counts as being in the pit; seconds in it before the lapa is recovered
const BAGS = [0x16161a, 0x16161a, 0x1c1c22, 0x1c1c22, 0x23232b, 0xe8e6de, 0xd8d6cc, 0x3b78c8, 0x4f9a4a, 0xd9c23a, 0xd9513a, 0xc86a9a, 0x9a9aa4];   // bin bags (mostly black), a few of every colour
const JUNK = [0xe9ecef, 0xd9d4c4, 0xc8a46e, 0xb88a52, 0x7aa6d8, 0xe27a9a, 0xd9b85a, 0x8a5a3a];   // fridges and white goods, cardboard, a mattress, a crate
// mulberry32: the same landfill every time
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function createDiscarica(env) {
  const { scene, camera, car, game, groundY, isNight, walls2d, vehicle } = env;
  const phone = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), cnt = n => Math.round(n * (phone ? 0.55 : 1));
  const site = { x: PIT.x, z: PIT.z };
  const gy = (x, z) => groundY(x, z);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
  const dropGroup = g => { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); };
  let built = null, tick = 0, t = 0, wasNight = false, hold = false, inPitT = 0, recovering = false;
  const F = { air: false, y0: 0, took: 0, landings: 0, lastFall: 0, lastLandT: -9, airT: 0, maxFall: 0, depth: 0, floorT: 0, lip: 0 };   // the plunge: what the mission reads (src/event-dump.js)

  // ------------------------------------------------------------------ the fence: the yard, with the gate where the track comes in; solid while it is drawn
  const fence = [];
  const yardLoop = () => {   // the posts of the fence in five runs, clockwise from the north end of the gate, the gate gap left open
    const { x0, x1, z0, z1, gate } = YARD, zc = TRACK.z;
    const side = (ax, az, bx, bz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3.5)), a = []; for (let i = 0; i <= n; i++) a.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); return a; };
    return [side(x0, zc - gate / 2, x0, z0), side(x0, z0, x1, z0), side(x1, z0, x1, z1), side(x1, z1, x0, z1), side(x0, z1, x0, zc + gate / 2)];
  };
  const addWalls = () => {
    for (const run of yardLoop()) for (let i = 0; i + 1 < run.length; i++) {
      const a = run[i], b = run[i + 1], seg = [a[0], a[1], b[0], b[1]]; seg.o = seg.slice(); fence.push(seg); walls2d.addSeg(seg, a[0], a[1], b[0], b[1]); seg[0] = seg[1] = seg[2] = seg[3] = FAR;
    }
  };
  addWalls();
  const wakeFence = on => { for (const s of fence) { const a = on ? s.o : [FAR, FAR, FAR, FAR]; s[0] = a[0]; s[1] = a[1]; s[2] = a[2]; s[3] = a[3]; } };

  // ------------------------------------------------------------------ textures
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; } return tx;
  }
  const rubbleTex = () => canvasTex(256, 256, (g, w, h) => {   // a quilt of rubbish seen from above: grey-brown litter, dark bags, bright bits
    const r = rng(7); g.fillStyle = '#d9d3c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { const x = r() * w, y = r() * h, s = 1.5 + r() * 4.5, k = r(); g.fillStyle = k < 0.3 ? '#6a655f' : k < 0.42 ? '#f1eee6' : '#' + BAGS[(r() * BAGS.length) | 0].toString(16).padStart(6, '0'); g.globalAlpha = 0.3 + r() * 0.35; g.beginPath(); g.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * 3, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }, true);
  const linkTex = () => canvasTex(64, 64, (g, w, h) => {   // chain link: a diamond mesh on nothing
    g.clearRect(0, 0, w, h); g.strokeStyle = '#a9b0b8'; g.lineWidth = 2.2; g.beginPath();
    for (let k = -2; k <= 4; k++) { g.moveTo(k * 16 - 8, 0); g.lineTo(k * 16 + 40, 64); g.moveTo(k * 16 + 72, 0); g.lineTo(k * 16 + 24, 64); }
    g.stroke();
  }, true);
  const signTex = () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e8c53a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16161a'; for (let i = -4; i < 14; i++) { g.beginPath(); g.moveTo(i * 44, 0); g.lineTo(i * 44 + 22, 0); g.lineTo(i * 44 - 30, 26); g.lineTo(i * 44 - 52, 26); g.fill(); g.beginPath(); g.moveTo(i * 44, h); g.lineTo(i * 44 + 22, h); g.lineTo(i * 44 - 30, h - 26); g.lineTo(i * 44 - 52, h - 26); g.fill(); }
    g.fillRect(22, 40, w - 44, h - 80); g.fillStyle = '#f4efe0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "700 82px 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"; g.fillText('DISCARICA', w / 2, h / 2 - 22);
    g.font = "600 33px 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"; g.fillText("DIVIETO D'ACCESSO AI NON ADDETTI", w / 2, h / 2 + 46);
  }, false);

  // ------------------------------------------------------------------ small geometry helpers: coloured, merged
  const paint = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const box = (w, h, d, x, y, z, hex, rx = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, hex); };
  const cyl = (r, l, x, y, z, hex, axis = 'x', seg = 12) => { const g = new THREE.CylinderGeometry(r, r, l, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return paint(g, hex); };
  const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1, ...o });
  // a bulldozer (+z is the blade): yellow, black tracks, a cab with dark glass
  const dozerGeo = () => mergeGeometries([
    box(0.9, 1.1, 3.6, -1.3, 0.6, 0, 0x1d1d20), box(0.9, 1.1, 3.6, 1.3, 0.6, 0, 0x1d1d20), box(1.7, 0.5, 2.6, 0, 0.7, 0, 0x2a2a2e),
    box(2.1, 1.0, 3.0, 0, 1.6, -0.1, 0xf2b705), box(1.7, 0.8, 1.5, 0, 2.3, 1.1, 0xf2b705), box(1.6, 1.5, 1.5, 0, 2.7, -0.8, 0xf2b705), box(1.62, 0.7, 1.52, 0, 2.95, -0.8, 0x1a2230),
    box(1.9, 0.12, 1.8, 0, 3.55, -0.8, 0xd9a000), cyl(0.1, 1.0, 0.55, 3.2, 1.0, 0x2a2a2e, 'y', 6),
    box(3.8, 1.3, 0.3, 0, 1.0, 2.9, 0x6a6e74), box(0.18, 0.25, 1.9, -1.4, 0.95, 1.9, 0xd9a000), box(0.18, 0.25, 1.9, 1.4, 0.95, 1.9, 0xd9a000), box(0.45, 1.0, 0.45, 0, 1.0, -2.2, 0x3a3a40),
  ]);
  // a landfill compactor: four steel wheels with teeth, an articulated yellow body, a cab
  const compactorGeo = () => {
    const P = [box(2.5, 1.3, 2.6, 0, 2.1, -2.1, 0xe5a400), box(2.2, 1.1, 2.4, 0, 1.9, 1.6, 0xe5a400), box(1.9, 1.7, 1.9, 0, 3.4, -2.5, 0xe5a400), box(1.92, 0.8, 1.92, 0, 3.7, -2.5, 0x1a2230), box(2.1, 0.12, 2.1, 0, 4.35, -2.5, 0xc98f00), box(2.2, 0.8, 0.5, 0, 1.1, 3.1, 0x6a6e74)];
    for (const wz of [-2.1, 1.6]) for (const sx of [-1.75, 1.75]) {
      P.push(cyl(1.15, 1.2, sx, 1.15, wz, 0x8a9096, 'x', 14));
      for (let k = 0; k < 14; k++) { const a = k * TAU / 14; P.push(box(1.2, 0.34, 0.22, sx, 1.15 + Math.sin(a) * 1.25, wz + Math.cos(a) * 1.25, 0x5a5f66, -a)); }
    }
    return mergeGeometries(P);
  };
  const mastGeo = () => mergeGeometries([cyl(0.16, 11, 0, 5.5, 0, 0x5a5f66, 'y', 6), box(2.4, 0.5, 0.4, 0, 11.2, 0, 0x2a2a2e), cyl(0.5, 0.2, 0, 0.1, 0, 0x3a3a40, 'y', 6)]);

  // ------------------------------------------------------------------ the scene
  let builds = 0;
  function build() {
    builds++;
    const g = new THREE.Group(); g.name = 'Discarica';
    const r = rng(20241104);
    // the ground over the terrain: gravel on the pad, earth on the terraces, a quilt of rubbish on the floor (vertex colours and one texture); drawn every 5 m on the nodes of the terrain mesh,
    // which is exactly the surface the lapa drives on (src/discarica-ground.js), a hand over it
    const x0 = Math.floor((PIT.x - HA - 22) / 5) * 5, z0 = Math.floor((PIT.z - HB - 22) / 5) * 5, nx = Math.ceil((2 * HA + 44) / 5) + 1, nz = Math.ceil((2 * HB + 44) / 5) + 1;
    const ZONES = [[0, [0.46, 0.38, 0.27]], [2.5, [0.4, 0.28, 0.17]], [5, [0.34, 0.25, 0.17]], [8, [0.32, 0.24, 0.17]], [13.5, [0.37, 0.26, 0.16]], [19, [0.3, 0.22, 0.16]], [24.5, [0.32, 0.24, 0.16]], [28.5, [0.4, 0.38, 0.35]]];
    const colAt = sd => {   // by the distance inside the rim: pad, riser, berm, riser, berm, riser, floor
      const d = -sd; if (d <= 0) return ZONES[0][1];
      let k = 1; while (k < ZONES.length && ZONES[k][0] < d) k++;
      if (k >= ZONES.length) return ZONES[ZONES.length - 1][1];
      const a = ZONES[k - 1], b = ZONES[k], u = (d - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u];
    };
    const P = [], C = [], U = [], I = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * 5, z = z0 + j * 5, sd = pitSd(x, z), c = colAt(sd), n = 0.92 + 0.16 * Math.sin(x * 0.31 + z * 0.17) * Math.cos(z * 0.23 - x * 0.11);
      P.push(x, gy(x, z) + 0.14, z); C.push(c[0] * n, c[1] * n, c[2] * n, 1 - Math.min(1, Math.max(0, (sd - 4) / 9))); U.push(x / 16, z / 16);
    }
    for (let j = 0; j + 1 < nz; j++) for (let i = 0; i + 1 < nx; i++) {
      const k = j * nx + i, m = (x0 + i * 5 + 2.5), q = (z0 + j * 5 + 2.5);
      if (pitSd(m, q) > 14) continue;
      I.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
    }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); og.setAttribute('color', new THREE.Float32BufferAttribute(C, 4)); og.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); og.setIndex(I); og.computeVertexNormals();
    const over = new THREE.Mesh(og, mat(0xffffff, { vertexColors: true, map: rubbleTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, roughness: 1 })); over.receiveShadow = true; over.renderOrder = 1; over.name = 'DumpGround'; g.add(over);
    // the gravel track from the service road to the rim, draped every 2 m, with two pale ruts
    { const len = TRACK.x1 - TRACK.x0, n = Math.ceil(len / 2), T = [], TC = [], TI = [], cs = [-3, -1.5, 0, 1.5, 3], cc = [[0.5, 0.43, 0.32], [0.42, 0.36, 0.26], [0.5, 0.43, 0.32], [0.42, 0.36, 0.26], [0.5, 0.43, 0.32]];
      for (let i = 0; i <= n; i++) { const x = TRACK.x0 + Math.min(len, i * 2); for (let k = 0; k < 5; k++) { const z = TRACK.z + cs[k]; T.push(x, gy(x, z) + 0.12, z); TC.push(...cc[k]); } if (i) for (let k = 0; k < 4; k++) { const b = (i - 1) * 5 + k; TI.push(b, b + 5, b + 1, b + 1, b + 5, b + 6); } }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(T, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(TC, 3)); tg.setIndex(TI); tg.computeVertexNormals();
      const trk = new THREE.Mesh(tg, mat(0xffffff, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide })); trk.receiveShadow = true; trk.name = 'DumpTrack'; g.add(trk);
      g.userData.sig = sig(); }
    // rubbish: bags, boxes, tyres, drums, in heaps on the floor and scattered over the terraces and the pad
    const pitPoint = (minD, maxD) => { for (let k = 0; k < 40; k++) { const x = PIT.x + (r() * 2 - 1) * HA, z = PIT.z + (r() * 2 - 1) * HB, d = -pitSd(x, z); if (d >= minD && d <= maxD) return [x, z, d]; } return null; };
    const heaps = []; for (let k = 0; k < 7; k++) { const p = pitPoint(29, 40); if (p) heaps.push({ x: p[0], z: p[1], s: 3 + r() * 3.5 }); }
    const place = (n, inst, shape) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(); let used = 0;
      for (let i = 0; i < n; i++) {
        let x, z, y, h = 0;
        const roll = r();
        if (roll < 0.5 && heaps.length) { const hp = heaps[(r() * heaps.length) | 0], a = r() * TAU, rr = Math.abs((r() + r() + r() - 1.5)) * hp.s * 1.6; x = hp.x + Math.cos(a) * rr; z = hp.z + Math.sin(a) * rr; h = 2.4 * Math.exp(-rr * rr / (hp.s * hp.s * 1.1)) * (0.4 + 0.6 * r()); }
        else if (roll < 0.86) { const pp = pitPoint(5.2, 40); if (!pp) continue; x = pp[0]; z = pp[1]; }
        else { const pp = pitPoint(-9, 0.4); if (!pp) continue; x = pp[0]; z = pp[1]; }   // spilled over the lip
        const d = -pitSd(x, z); if (d > 41) continue;
        y = RIM_Y - dumpDepth(x, z) + h;
        shape(r, s, e, col, d); e.y = r() * TAU; q.setFromEuler(e); p.set(x, y, z); m.compose(p, q, s); inst.setMatrixAt(used, m); inst.setColorAt(used, col); used++;
      }
      inst.count = used; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; return inst;
    };
    const bagG = new THREE.SphereGeometry(0.5, 6, 4); { const pos = bagG.attributes.position; for (let i = 0; i < pos.count; i++) { const k = 1 + 0.18 * Math.sin(i * 12.9898) * Math.cos(i * 4.1414); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k); } bagG.computeVertexNormals(); }
    const bags = place(cnt(1800), new THREE.InstancedMesh(bagG, mat(0xffffff, { roughness: 0.55 }), cnt(1800)), (rr, s, e, col) => { const k = 0.34 + rr() * 0.5; s.set(k * 1.2, k * (0.7 + rr() * 0.5), k); e.set((rr() - 0.5) * 0.9, 0, (rr() - 0.5) * 0.9); col.setHex(BAGS[(rr() * BAGS.length) | 0]); });
    const boxes = place(cnt(300), new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, { roughness: 0.7 }), cnt(300)), (rr, s, e, col) => {
      const k = rr(); if (k < 0.2) { s.set(0.7, 1.75, 0.7); col.setHex(0xe9ecef); }   // a fridge
      else if (k < 0.3) { s.set(0.65, 0.85, 0.65); col.setHex(0xd8dde2); }   // a washing machine
      else if (k < 0.45) { s.set(1.9, 0.22, 1.1); col.setHex(rr() < 0.5 ? 0x7aa6d8 : 0xe27a9a); }   // a mattress
      else { s.set(0.5 + rr() * 0.7, 0.35 + rr() * 0.5, 0.4 + rr() * 0.6); col.setHex(JUNK[(rr() * JUNK.length) | 0]); }
      e.set((rr() - 0.5) * 1.2, 0, (rr() - 0.5) * 1.2);
    });
    const tyreG = new THREE.TorusGeometry(0.4, 0.17, 6, 12).rotateX(Math.PI / 2);
    const tyres = place(cnt(120), new THREE.InstancedMesh(tyreG, mat(0x161619, { roughness: 0.8 }), cnt(120)), (rr, s, e, col) => { const k = 0.8 + rr() * 0.5; s.set(k, k, k); col.setHex(0xffffff); e.set((rr() - 0.5) * 0.6, 0, (rr() - 0.5) * 0.6); });
    const drums = place(cnt(40), new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8), mat(0xffffff, { roughness: 0.5 }), cnt(40)), (rr, s, e, col) => { s.set(1, 1, 1); col.setHex([0x2f6bd0, 0xd0402f, 0x3a8a4a, 0xd9a020][(rr() * 4) | 0]); e.set((rr() - 0.5) * 1.2, 0, rr() < 0.3 ? 1.4 : 0); });
    for (const m of [bags, boxes, tyres, drums]) { m.castShadow = false; m.receiveShadow = false; g.add(m); }
    // the machines: a bulldozer on the first berm, a compactor on the floor
    const mach = [], put = (geo, a, b, y, th) => { const m = new THREE.Mesh(geo, vmat()); m.position.set(PIT.x + a, y, PIT.z + b); m.rotation.y = th; m.castShadow = true; g.add(m); mach.push(m); return m; };
    const bz = HB - 8, dz = PIT.z - bz, dzy = RIM_Y - dumpDepth(PIT.x + 6, dz);
    put(dozerGeo(), 6, -bz, dzy, Math.PI / 2 + 0.12);
    put(compactorGeo(), 3, 1.5, RIM_Y - dumpDepth(PIT.x + 3, PIT.z + 1.5), -0.5);
    const beacons = []; for (const [m, y, a] of [[mach[0], 3.8, 0], [mach[1], 4.7, 0]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a1a })); b.position.set(0, y, a); m.add(b); beacons.push(b); }
    // the fence: posts and a chain-link strip, the gate open with its two leaves swung back, and the sign
    { const posts = [], FP = [], FU = [], FI = []; let u = 0;
      for (const run of yardLoop()) {
        let acc = 0;
        run.forEach((p, i) => {
          const h = gy(p[0], p[1]); posts.push([p[0], h, p[1]]);
          if (i) { const a = run[i - 1]; acc += Math.hypot(p[0] - a[0], p[1] - a[1]) / 0.38; }
          const k = FP.length / 3; FP.push(p[0], h - 0.15, p[1], p[0], h + 2.3, p[1]); FU.push(u + acc, 0, u + acc, 6);
          if (i) { const b = k - 2; FI.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
        });
        u += acc + 1;
      }
      const pos = FP, uv = FU, pi = FI;
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(pi); fg.computeVertexNormals();
      const link = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: linkTex(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, forceSinglePass: true, roughness: 0.6, metalness: 0.3, color: 0xcfd6dc })); link.name = 'DumpFence'; g.add(link);
      const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 2.7, 0.13), mat(0x6a6e74, { metalness: 0.2 }), posts.length), mm = new THREE.Matrix4();
      posts.forEach((p, i) => { mm.makeTranslation(p[0], p[1] + 1.2, p[2]); pm.setMatrixAt(i, mm); }); g.add(pm);
      // the gate: two posts, two leaves opened inwards along the edge of the track
      const gz = TRACK.z, gx = YARD.x0, gh = (z) => gy(gx, z), leaf = (sg) => { const lg = mergeGeometries([box(0.1, 2.3, 3.4, 0, 1.15, 1.7 * sg, 0x8a9096), box(0.1, 0.1, 3.4, 0, 0.3, 1.7 * sg, 0x6a6e74), box(0.1, 0.1, 3.4, 0, 1.15, 1.7 * sg, 0x6a6e74), box(0.1, 0.1, 3.4, 0, 2.2, 1.7 * sg, 0x6a6e74)]); return lg; };
      for (const sg of [-1, 1]) { const m = new THREE.Mesh(leaf(sg), vmat({ roughness: 0.6 })); m.position.set(gx, gh(gz + sg * YARD.gate / 2), gz + sg * YARD.gate / 2); m.rotation.y = sg * (Math.PI / 2 - 0.15); g.add(m); }
      for (const sg of [-1, 1]) { const pst = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), mat(0x4a4e54)); pst.position.set(gx, gh(gz + sg * YARD.gate / 2) + 1.5, gz + sg * YARD.gate / 2); g.add(pst); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: signTex(), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0, roughness: 0.6, side: THREE.DoubleSide })); sign.material.emissiveMap = sign.material.map;
      sign.position.set(gx - 0.2, gh(gz - 5.6) + 3.9, gz - 5.6); sign.rotation.y = -Math.PI / 2; g.add(sign);
      for (const dz of [-2, 2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), mat(0x4a4e54)); sp.position.set(gx - 0.2, gh(gz - 5.6) + 2.1, gz - 5.6 + dz); g.add(sp); }
      built_sign = sign; }
    // floodlights: three masts with lit heads and, at night, a cone of light each over the pit
    const masts = new THREE.Group(), beams = [], mg = mastGeo(), mmat = vmat();
    for (const [a, b] of [[-46, -50], [58, -44], [20, 44]]) {
      const x = PIT.x + a, z = PIT.z + b, y = gy(x, z), m = new THREE.Mesh(mg, mmat); m.position.set(x, y, z); m.rotation.y = Math.atan2(PIT.x - x, PIT.z - z); masts.add(m);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff3d0 })); lamp.position.set(0, 11.15, 0.3); m.add(lamp);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(11, 52, 14, 1, true).translate(0, -26, 0), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
      cone.position.set(x, y + 11.2, z); const dx = PIT.x - x, dz = PIT.z - z, dy = RIM_Y - 9 - (y + 11.2), L = Math.hypot(dx, dy, dz); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)); masts.add(cone); beams.push(cone);
    }
    g.add(masts);
    scene.add(g); wakeFence(true);
    g.updateMatrixWorld(true);
    return { g, beams, beacons, over, bags, lit: [bags, boxes, tyres, drums, ...mach] };
  }
  let built_sign = null;
  // the ground under the track and the pad: when the tiles stream in it changes (it is draped when built), and the ground is drawn again
  function sig() { let s = 0; for (const [a, b] of [[TRACK.x0, TRACK.z], [(TRACK.x0 + TRACK.x1) / 2, TRACK.z], [TRACK.x1, TRACK.z], [PIT.x, PIT.z - HB - 16], [PIT.x - HA - 16, PIT.z + 20], [PIT.x + HA + 16, PIT.z]]) s += gy(a, b); return s; }
  function dispose() { if (!built) return; dropGroup(built.g); wakeFence(false); built = null; }

  // ------------------------------------------------------------------ the haze over the pit and the gulls: both from the far distance, cheap
  let plume = null, gulls = null;
  function makePlume() {
    const N = cnt(56), base = new Float32Array(N * 3), seed = new Float32Array(N * 3), r = rng(99);
    for (let i = 0; i < N; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 16; base[i * 3] = PIT.x + 6 + Math.cos(a) * rr; base[i * 3 + 1] = RIM_Y - 6; base[i * 3 + 2] = PIT.z + Math.sin(a) * rr * 0.7; seed[i * 3] = r(); seed[i * 3 + 1] = r(); seed[i * 3 + 2] = r(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(base, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(seed, 3));
    const u = { uT: { value: 0 }, uK: { value: 700 }, uFog: { value: new THREE.Color(0.7, 0.75, 0.8) }, uFogD: { value: 0.0004 }, uLight: { value: 1 } };
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 aS; uniform float uT; uniform float uK; varying float vA; varying float vD;
        void main() {
          float age = fract(uT / 34.0 + aS.x);
          vec3 p = position; p.y += age * 80.0; p.x += age * age * 26.0 + sin(uT * 0.25 + aS.y * 6.28) * 2.5; p.z += cos(uT * 0.21 + aS.z * 6.28) * 2.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = length(mv.xyz);
          gl_PointSize = clamp(uK * mix(7.0, 42.0, sqrt(age)) * (0.7 + 0.6 * aS.z) / max(1.0, -mv.z), 1.0, 220.0);
          vA = smoothstep(0.0, 0.07, age) * pow(1.0 - age, 1.3) * 0.34 * smoothstep(25.0, 110.0, vD);   // thin out close to the camera: from above, or inside it, the haze does not hide the pit
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uFog; uniform float uFogD; uniform float uLight; varying float vA; varying float vD;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard;
          vec3 col = vec3(0.46, 0.48, 0.38) * uLight; col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * vD * vD));
          gl_FragColor = vec4(col, (1.0 - d) * vA);
        }`,
    }));
    m.frustumCulled = false; m.renderOrder = 6;
    m.onBeforeRender = (renderer) => {
      u.uT.value = performance.now() / 1000 % 3000; u.uK.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
      if (scene.fog) { u.uFogD.value = scene.fog.density; if (scene.fog.color) { u.uFog.value.copy(scene.fog.color); u.uLight.value = Math.min(1, Math.max(0.12, (0.3 * scene.fog.color.r + 0.59 * scene.fog.color.g + 0.11 * scene.fog.color.b) / 0.65)); } }
    };
    scene.add(m); return m;
  }
  function makeGulls() {
    const wing = [0, 0, 0.3, -1.2, 0.45, 0, 0, 0, -0.3, 0, 0, 0.3, 1.2, 0.45, 0, 0, 0, -0.3];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(wing, 3)); geo.computeVertexNormals();
    const n = cnt(34), im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xf1f1ee, side: THREE.DoubleSide }), n); im.frustumCulled = false; im.visible = false;
    const r = rng(5), S = []; for (let i = 0; i < n; i++) S.push({ a: r() * TAU, rad: 14 + r() * 46, h: 12 + r() * 22, w: (0.35 + r() * 0.35) * (r() < 0.5 ? -1 : 1), ph: r() * TAU, f: 5 + r() * 2.5, k: 1.1 + r() * 0.6, cx: (r() - 0.5) * 16, cz: (r() - 0.5) * 16 });
    scene.add(im); return { im, S };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function updateGulls(dt) {
    if (!gulls.im.visible) return;
    for (let i = 0; i < gulls.S.length; i++) {
      const b = gulls.S[i]; b.a += b.w * dt; const x = PIT.x + 6 + b.cx + Math.cos(b.a) * b.rad, z = PIT.z + b.cz + Math.sin(b.a) * b.rad * 0.7, y = RIM_Y + b.h + Math.sin(t * 0.4 + b.ph) * 3;
      const th = Math.atan2(-Math.sin(b.a) * b.w, Math.cos(b.a) * b.w * 0.7), flap = Math.sin(t * b.f + b.ph);
      _e.set(0, th, -b.w * 0.18 * Math.sign(b.w)); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(b.k, 0.2 + 0.8 * flap, b.k); _m.compose(_p, _q, _s); gulls.im.setMatrixAt(i, _m);
    }
    gulls.im.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ gull cries: Web Audio oscillators (nothing recorded), now and then, only by day and only near the pit
  let ac = null, nextCry = 0;
  const vol = () => Number.isFinite(game?.settings?.volume) ? game.settings.volume : 0.8;
  function cry(level) {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { ac = new AC(); } catch (e) { ac = null; return; } }
    if (ac.state === 'suspended') { ac.resume().catch(() => {}); return; }
    const t0 = ac.currentTime, n = 2 + ((Math.random() * 3) | 0), lv = Math.max(0.0005, 0.06 * level * vol());
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter(), t = t0 + i * 0.27, f = 1500 + Math.random() * 500;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.24); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lv, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(bp); bp.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.27);
    }
  }
  function audioStop() { if (ac) { try { ac.close(); } catch (e) { /* ignore */ } ac = null; } }

  // ------------------------------------------------------------------ flying rubbish: a pool of bags and bits thrown up by a crash
  const POOL = cnt(90), deb = { im: null, p: new Float32Array(POOL * 3), v: new Float32Array(POOL * 3), life: new Float32Array(POOL), sp: new Float32Array(POOL * 2), sc: new Float32Array(POOL), k: 0, live: 0 };
  function debris() {
    if (deb.im) return deb.im;
    const bg = new THREE.SphereGeometry(0.5, 6, 4); const im = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), POOL); im.frustumCulled = false; im.count = POOL;
    const c = new THREE.Color(); for (let i = 0; i < POOL; i++) { c.setHex(BAGS[i % BAGS.length]); im.setColorAt(i, c); _m.makeScale(0, 0, 0); im.setMatrixAt(i, _m); }
    deb.im = im; deb.life.fill(0); scene.add(im); return im;
  }
  function burst(x, y, z, n, speed = 8) {
    debris();
    for (let i = 0; i < n; i++) {
      const k = deb.k = (deb.k + 1) % POOL, a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.9);
      deb.p[k * 3] = x + Math.cos(a) * 0.8; deb.p[k * 3 + 1] = y + 0.4 + Math.random() * 0.8; deb.p[k * 3 + 2] = z + Math.sin(a) * 0.8;
      deb.v[k * 3] = Math.cos(a) * s; deb.v[k * 3 + 1] = 5 + Math.random() * speed * 0.9; deb.v[k * 3 + 2] = Math.sin(a) * s;
      deb.life[k] = 2.4 + Math.random() * 1.6; deb.sp[k * 2] = (Math.random() - 0.5) * 12; deb.sp[k * 2 + 1] = Math.random() * TAU; deb.sc[k] = 0.4 + Math.random() * 0.8; deb.live++;
    }
    deb.im.visible = true;
  }
  function updateDebris(dt) {
    if (!deb.im || !deb.live) { if (deb.im && deb.im.visible && !deb.live) deb.im.visible = false; return; }
    let live = 0;
    for (let i = 0; i < POOL; i++) {
      if (deb.life[i] <= 0) continue; deb.life[i] -= dt;
      if (deb.life[i] <= 0) { _m.makeScale(0, 0, 0); deb.im.setMatrixAt(i, _m); continue; }
      live++;
      deb.v[i * 3 + 1] -= 16 * dt; deb.p[i * 3] += deb.v[i * 3] * dt; deb.p[i * 3 + 1] += deb.v[i * 3 + 1] * dt; deb.p[i * 3 + 2] += deb.v[i * 3 + 2] * dt;
      const g = gy(deb.p[i * 3], deb.p[i * 3 + 2]) + 0.3;
      if (deb.p[i * 3 + 1] < g) { deb.p[i * 3 + 1] = g; if (deb.v[i * 3 + 1] < 0) { deb.v[i * 3 + 1] *= -0.35; deb.v[i * 3] *= 0.7; deb.v[i * 3 + 2] *= 0.7; } }
      deb.sp[i * 2 + 1] += deb.sp[i * 2] * dt; const sc = deb.sc[i] * Math.min(1, deb.life[i] * 1.2);
      _e.set(deb.sp[i * 2 + 1], deb.sp[i * 2 + 1] * 0.7, 0); _q.setFromEuler(_e); _p.set(deb.p[i * 3], deb.p[i * 3 + 1], deb.p[i * 3 + 2]); _s.set(sc * 1.2, sc * 0.8, sc); _m.compose(_p, _q, _s); deb.im.setMatrixAt(i, _m);
    }
    deb.live = live; deb.im.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the plunge (hooks.plunge, once per physics step with the ball state of src/vehicle-sphere.js)
  const LOOK = 1.0, STEEP = 0.5, SLOW = 1.8;   // metres ahead that the ground is read, the slope (rise per metre) that the ball does not follow down, and the speed under which the slope pushes it over by itself
  let landT = 0;
  function plunge(c, S) {
    const dx = c.x - PIT.x, dz = c.z - PIT.z;
    if (dx > ZONE || dx < -ZONE || dz > ZONE || dz < -ZONE) { if (F.air) { F.air = false; } return; }
    F.depth = dumpDepth(c.x, c.z);
    if (c.flying) { F.air = false; return; }
    if (!S.air) {
      const now = performance.now();
      if (F.air) {   // touched down
        F.air = false; landT = now;
        const fall = F.y0 - S.y; F.airT += (now - F.took) / 1000;
        if (fall > 1) { F.landings++; F.lastFall = fall; F.lastLandT = now / 1000; if (fall > F.maxFall) F.maxFall = fall; }
        if (fall > 2.2) {
          S.hit = Math.max(S.hit, Math.min(24, 5 + fall * 1.15));
          const n = Math.min(POOL, Math.round(6 + fall * 2.6)); burst(c.x, S.y, c.z, n, 5 + Math.min(10, fall * 0.8));
          if (vehicle && vehicle.camFx) vehicle.camFx({ trauma: Math.min(0.95, 0.25 + fall / 14), kick: 0.6 });
          if (vehicle && vehicle.puff) for (let i = 0; i < 10; i++) vehicle.puff(c.x + (Math.random() - 0.5) * 3, S.y + 0.3, c.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 1.2 + Math.random());
        }
      } else {
        const sp = Math.hypot(c.vx, c.vz);
        if (sp > SLOW && now - landT > 120) {   // over the lip: the ground ahead falls away steeper than the ball can follow, so the ball goes on with the speed it has and falls (the slope would hold it to the ground)
          const L = Math.max(LOOK, sp * 0.12), g = gy(c.x + c.vx / sp * L, c.z + c.vz / sp * L);
          if ((S.y - g) / L > STEEP) { S.air = true; S.fv = clamp(S.vy || 0, -3, 5); F.air = true; F.y0 = S.y; F.took = now; if (!F.lip) F.lip = sp; }   // F.lip: the speed of the first take-off, at the rim, for the card (a jump or a roll; the mission clears it when it starts)
        }
      }
    } else { F.air = true; if (F.y0 < S.y) F.y0 = S.y; }
    if (S.air) c.deck = Math.max(0, S.y - groundY(c.x, c.z));   // the chase camera follows the body down (src/vehicle.js keeps it on car.deck)
  }

  // ------------------------------------------------------------------ recovery: back on the service road, facing away from the pit, under the transition
  function recover(opts = {}) {
    if (recovering) return Promise.resolve();
    recovering = true;
    const M = SNAP['dump:mouth'] || [PIT.x - 140, PIT.z, -1, 0];
    return transition(async () => {
      if (vehicle) { vehicle.camMoment && vehicle.camMoment(0); vehicle.teleport(M[0], M[1], Math.atan2(M[2], M[3])); }
      F.air = false; F.floorT = 0; inPitT = 0; deb.life.fill(0);
    }, { hold: opts.hold ?? 500 }).finally(() => { recovering = false; });
  }

  // ------------------------------------------------------------------ every frame
  function update(dt) {
    const d = Math.hypot(camera.position.x - site.x, camera.position.z - site.z);
    if (d > SMOKE_R + 100 && !built && !deb.live && !(plume && plume.visible) && !(gulls && gulls.im.visible)) { if (inPitT) inPitT = 0; return; }   // nowhere near: one distance and out
    t += dt; tick -= dt;
    if (!built && d < BUILD_R) built = build();
    else if (built && d > BUILD_R + 120) dispose();
    else if (built && tick <= 0 && Math.abs(sig() - built.g.userData.sig) > 0.3) { dispose(); built = build(); }   // the tiles under the track and the pad streamed in
    const night = !!isNight();
    if (built) {
      if (tick <= 0 || night !== wasNight) {
        for (const b of built.beams) b.material.opacity = night ? 0.1 : 0; if (built_sign) built_sign.material.emissiveIntensity = night ? 0.55 : 0;
        const om = built.over.material; om.emissive.setHex(0xffffff); om.emissiveMap = om.map; om.emissiveIntensity = night ? 0.06 : 0;   // the yard is lit by the masts: the ground and the rubbish glow a little, the lapa does not have a light to show it by
        for (const m of built.lit) { m.material.emissive.setRGB(night ? 0.1 : 0, night ? 0.095 : 0, night ? 0.09 : 0); }
        wasNight = night;
      }
      const bl = 0.35 + 0.65 * (Math.sin(t * 7) > 0.2 ? 1 : 0); for (const b of built.beacons) b.material.color.setRGB(1, 0.45 + 0.3 * bl, 0.08 * bl);
    }
    if (d < SMOKE_R) { if (!plume) plume = makePlume(); plume.visible = true; } else if (plume && plume.visible) plume.visible = false;
    if (d < GULL_R && !night && built) { if (!gulls) gulls = makeGulls(); gulls.im.visible = true; updateGulls(dt); } else if (gulls && gulls.im.visible) gulls.im.visible = false;
    if (d < 190 && !night && built) { if ((nextCry -= dt) <= 0) { nextCry = 2.5 + Math.random() * 5; cry(clamp(1 - d / 190, 0.15, 1)); } } else if (ac && d > 260) audioStop();
    updateDebris(dt);
    if (tick > 0) return; tick = 0.4;
    // a lapa left in the pit with nothing else going on (a drive in on a whim, a missed mission) is taken out by a lift
    const dep = dumpDepth(car.x, car.z);
    if (dep >= IN_PIT && !hold && !recovering && game.state === 'play') { inPitT += 0.4; if (inPitT >= HAUL_T) recover(); } else if (dep < IN_PIT) inPitT = 0;
  }
  return { update, plunge, recover, state: F, site, built: () => !!built, get parts() { return built; }, get builds() { return builds; }, inPit: () => dumpDepth(car.x, car.z) >= IN_PIT, hold(on) { hold = !!on; inPitT = 0; }, burst, IN_PIT, FLOOR_D };
}
