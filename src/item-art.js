// Art for the street collectibles that are not pub stock: the twelve foods of the food hunts (src/event-food.js, one shape per src/event-places.js ITEMS key) and the happy leaf of the rave
// errand (src/event-rave.js). Same technique as the rest of the item art: one merged, vertex-coloured, non-indexed geometry per item, drawn unlit (MeshBasicMaterial) by an InstancedMesh, so a hunt costs
// one draw call. Form comes from light baked into the vertex colours (bake()), because the material has no lighting. Each shape stays under about 550 triangles; every food sits on a pale plate or cup so
// it stands out from the asphalt. FOOD_ART[key]() returns a fresh geometry about 1.5 m across.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const L = new THREE.Vector3(0.45, 0.8, 0.4).normalize();
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const C = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const at = (g, x, y, z) => g.translate(x, y, z);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, Math.min(s, 9), 1);
const sph = (r, sx = 1, sy = 1, sz = 1, w = 10, h = 7) => new THREE.SphereGeometry(r, Math.min(w, 7), Math.min(h, 4)).scale(sx, sy, sz);
const bit = (r, sx = 1, sy = 1, sz = 1) => new THREE.IcosahedronGeometry(r, 0).scale(sx, sy, sz);
const tor = (r, t, s = 14) => new THREE.TorusGeometry(r, t, 3, Math.min(s, 9)).rotateX(Math.PI / 2);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const plate = (r = 0.62) => [C(at(cyl(r, r * 0.92, 0.05, 20), 0, 0.025, 0), '#efe6d2'), C(at(tor(r, 0.03, 20), 0, 0.05, 0), '#d8cdb4')];
// baked light: top faces lighter, undersides darker (the game's items are unlit, so this is the only form they get)
function bake(g) { const n = g.attributes.normal, c = g.attributes.color; for (let i = 0; i < c.count; i++) { const d = n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z, k = 0.62 + 0.46 * (d * 0.5 + 0.5); c.setXYZ(i, Math.min(1, c.getX(i) * k), Math.min(1, c.getY(i) * k), Math.min(1, c.getZ(i) * k)); } return g; }
function fin(P, lift = 0.62, k = 1.5) { const g = bake(mergeGeometries(P)); g.translate(0, lift, 0); g.scale(k, k, k); return g; }
// height of the surface of a sph() dome (the low ring count makes it sit lower than a true sphere): centre height c, half height hh, radius R
const dome = (c, hh, R) => d => c + hh * (d < 0.707 * R ? 1 - 0.586 * d / R : 0.707 * (1 - (d - 0.707 * R) / (0.293 * R))) + 0.004;
const scatter = (n, r, y, mk, hex) => { const out = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r; out.push(C(at(mk(), Math.cos(a) * d, typeof y === 'function' ? y(d) : y, Math.sin(a) * d), hex)); } return out; };

const shapes = {
  pizzette() { const P = plate(); seed = 3;
    P.push(C(at(tor(0.44, 0.075, 18), 0, 0.12, 0), '#d9a24e'), C(at(cyl(0.44, 0.44, 0.06, 18), 0, 0.1, 0), '#c8402c'));
    P.push(...scatter(6, 0.32, 0.14, () => bit(0.1, 1, 0.35, 1, 8, 5), '#f6efd8'), ...scatter(4, 0.3, 0.17, () => bit(0.07, 1.6, 0.25, 0.9, 6, 4), '#2f8f3a')); return fin(P); },
  arancine() { seed = 5; const P = [C(at(cyl(0.43, 0.3, 0.26, 14), 0, 0.13, 0), '#f4efe2'), C(at(cyl(0.435, 0.405, 0.07, 14), 0, 0.2, 0), '#c8402c'), C(at(new THREE.ConeGeometry(0.42, 0.85, 9), 0, 0.68, 0), '#dc8d2c'), C(at(bit(0.06, 1, 1, 1), 0, 1.1, 0), '#8a4a1c')];
    for (let i = 0; i < 6; i++) { const t = 0.1 + rnd() * 0.55, a = rnd() * 6.283, r = 0.42 * (1 - t / 0.85) * 0.98; P.push(C(at(bit(0.035, 1, 1, 1), Math.cos(a) * r, 0.255 + t, Math.sin(a) * r), '#a85d1a')); }
    return fin(P, 0.5); },
  panelle() { seed = 9; const P = [...plate(0.66), C(at(sph(0.5, 1, 0.42, 1, 14, 6), 0, 0.2, 0), '#e0b264'),
      C(at(box(1.0, 0.07, 0.62), 0, 0.37, 0), '#ecc83e'), C(at(box(0.96, 0.07, 0.58), 0.04, 0.44, 0.03), '#e2b92c'), C(at(box(0.9, 0.07, 0.56), -0.03, 0.51, -0.02), '#ecc83e'),
      C(at(sph(0.5, 1, 0.5, 1, 14, 7).rotateX(0), 0, 0.57, 0), '#e8c27a')];
    P.push(...scatter(6, 0.28, dome(0.57, 0.25, 0.5), () => bit(0.03, 1.5, 0.7, 1, 5, 3), '#f8f1de')); return fin(P, 0.55); },
  crocche() { const P = [C(at(new THREE.ConeGeometry(0.34, 0.6, 10, 1, true).rotateZ(Math.PI / 2).translate(-0.28, 0.25, 0.28), 0, 0, 0), '#f1ead8'), C(at(new THREE.ConeGeometry(0.34, 0.6, 10, 1, true).rotateZ(Math.PI / 2).translate(-0.28, 0.25, 0.28), 0, 0, 0), '#f1ead8')];
    P.length = 0; P.push(...plate(0.66));
    const log = (y, z, c) => [C(at(cyl(0.2, 0.2, 0.7, 12).rotateZ(Math.PI / 2), 0, y, z), c), C(at(bit(0.21, 1, 1, 1), 0.35, y, z), '#c47c2a'), C(at(bit(0.21, 1, 1, 1), -0.35, y, z), '#c47c2a'), C(at(tor(0.205, 0.02, 10).rotateZ(Math.PI / 2), 0.0, y, z), '#9a5f1c')];
    P.push(...log(0.22, -0.2, '#e0a640'), ...log(0.22, 0.2, '#d89a38'), ...log(0.46, 0, '#e8b04a')); return fin(P); },
  setteveli() { const cols = ['#2a160c', '#7a4a2a', '#e8d3a8', '#4a2a16', '#a8743a', '#2a160c', '#7a4a2a'], P = [...plate(0.7)]; const th = 1.15;
    cols.forEach((c, i) => P.push(C(at(new THREE.CylinderGeometry(0.72, 0.72, 0.075, 6, 1, false, 0, th).translate(0, 0.1 + i * 0.075, 0).rotateY(-th / 2 + 0.2).translate(-0.28, 0, 0), 0, 0, 0), c)));
    P.push(C(at(new THREE.CylinderGeometry(0.72, 0.72, 0.03, 6, 1, false, 0, th).translate(0, 0.66, 0).rotateY(-th / 2 + 0.2).translate(-0.28, 0, 0), 0, 0, 0), '#1c0e07')); return fin(P, 0.5); },
  cannoli() { seed = 2; const P = [...plate(0.68)];
    const shell = (rot, x, z, y) => { const a = []; const add = g => { g.rotateZ(Math.PI / 2).rotateY(rot).translate(x, y, z); return g; };
      a.push(C(add(cyl(0.17, 0.17, 0.95, 12)), '#d9a350'), C(add(cyl(0.15, 0.15, 0.97, 12)).clone(), '#d9a350'));
      for (let i = -3; i <= 3; i++) a.push(C(add(tor(0.175, 0.018, 12).rotateZ(Math.PI / 2).translate(0, 0, 0)).clone().translate(0, 0, 0), '#b8782e'));
      return a; };
    // two shells crossing, ricotta ends, cherry and pistachio
    const mk = (rot, y, x, z) => { const g = new THREE.Group(); return { rot, y, x, z }; };
    const arr = [mk(0.5, 0.25, 0, 0.12), mk(-0.4, 0.5, 0, -0.12)];
    arr.forEach(s => { const sh = cyl(0.17, 0.17, 0.95, 12).rotateZ(Math.PI / 2).rotateY(s.rot).translate(s.x, s.y, s.z); P.push(C(sh, '#d9a350'));
      for (const e of [-1, 1]) { const ex = Math.cos(s.rot) * 0.5 * e, ez = -Math.sin(s.rot) * 0.5 * e; P.push(C(at(bit(0.17, 1, 1, 1), s.x + ex, s.y, s.z + ez), '#fbf6e8')); }
      for (let i = 0; i <= 0; i++) { const ex = Math.cos(s.rot) * 0.28 * i, ez = -Math.sin(s.rot) * 0.17 * i; P.push(C(at(tor(0.175, 0.02, 10).rotateY(0).rotateZ(Math.PI / 2).rotateY(s.rot), s.x + ex, s.y, s.z + ez), '#b8782e')); } });
    P.push(C(at(bit(0.07, 1, 1, 1), 0.44, 0.4, -0.12), '#d8202c'), C(at(bit(0.04, 1, 1, 1), -0.46, 0.66, -0.31), '#7ab83a'), C(at(bit(0.04, 1, 1, 1), -0.4, 0.64, -0.27), '#7ab83a'), C(at(bit(0.04, 1, 1, 1), -0.52, 0.64, -0.35), '#7ab83a')); return fin(P); },
  cassatine() { seed = 4; const P = [C(at(cyl(0.36, 0.28, 0.24, 14), 0, 0.12, 0), '#f1ead8'), C(at(tor(0.36, 0.03, 14), 0, 0.24, 0), '#d8cdb4'), C(at(sph(0.42, 1, 0.95, 1, 16, 9), 0, 0.34, 0), '#9fd18a'),
      C(at(tor(0.3, 0.025, 16), 0, 0.58, 0), '#ffffff'), C(at(tor(0.4, 0.025, 16), 0, 0.42, 0), '#ffffff'), C(at(tor(0.15, 0.025, 12), 0, 0.72, 0), '#ffffff'),
      C(at(bit(0.075, 1, 1, 1), 0, 0.8, 0), '#d8202c'), C(at(bit(0.06, 1.6, 0.6, 1), 0.24, 0.66, 0.12), '#e89a2c'), C(at(bit(0.06, 1.6, 0.6, 1), -0.2, 0.64, 0.18), '#e8c83a'), C(at(bit(0.06, 1.6, 0.6, 1), -0.02, 0.6, -0.26), '#e89a2c')]; return fin(P, 0.55); },
  iris() { seed = 11; const P = [...plate(0.64), C(at(sph(0.52, 1, 0.82, 1, 16, 10), 0, 0.5, 0), '#d58a3a'), C(at(sph(0.3, 1, 0.5, 1, 12, 6), 0, 0.82, 0), '#e8ac52'),
      C(at(sph(0.2, 0.5, 0.9, 1.1, 8, 6), 0.46, 0.52, 0.0), '#fbf6e8'), C(at(bit(0.05, 1, 1, 1), 0.58, 0.6, 0.06), '#3a1e10'), C(at(bit(0.05, 1, 1, 1), 0.6, 0.46, -0.08), '#3a1e10')];
    P.push(...scatter(8, 0.4, dome(0.5, 0.426, 0.52), () => bit(0.03, 1, 0.8, 1, 4, 3), '#fffaf0')); return fin(P, 0.5); },
  sfincioni() { seed = 8; const P = [...plate(0.7), C(at(box(1.0, 0.2, 0.64), 0, 0.15, 0), '#e0a23a'), C(at(box(0.92, 0.07, 0.56), 0, 0.28, 0), '#d6502a'), C(at(box(0.5, 0.04, 0.03), -0.1, 0.33, 0.1), '#7a1c10'), C(at(box(0.4, 0.04, 0.03), 0.1, 0.33, -0.1), '#7a1c10')];
    P.push(...scatter(5, 0.38, 0.33, () => bit(0.08, 1.2, 0.4, 0.8, 6, 4), '#efe0b8'), ...scatter(8, 0.4, 0.32, () => bit(0.03, 1, 0.6, 1, 4, 3), '#e8b84a')); return fin(P, 0.55); },
  meusa() { seed = 13; const P = [...plate(0.66), C(at(sph(0.5, 1, 0.34, 1, 14, 5), 0, 0.17, 0), '#e2bc74'), C(at(cyl(0.47, 0.47, 0.1, 14), 0, 0.3, 0), '#5a2a2a'), C(at(cyl(0.45, 0.45, 0.05, 14), 0, 0.37, 0), '#8a4a3a'), C(at(sph(0.5, 1, 0.55, 1, 14, 7), 0, 0.4, 0), '#e8c47c'),
      C(at(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).translate(0.2, 0.3, 0.42), 0, 0, 0), '#f4dc3a')];
    P.push(...scatter(6, 0.28, dome(0.4, 0.275, 0.5), () => bit(0.03, 1.5, 0.7, 1, 5, 3), '#f8f1de')); return fin(P, 0.5); },
  stigghiole() { seed = 6; const P = [C(at(cyl(0.45, 0.4, 0.07, 14), 0, 0.035, 0), '#6a5a48'), C(at(cyl(0.025, 0.025, 1.3, 6), 0, 0.7, 0), '#b88a50')];
    for (let i = 0; i < 5; i++) P.push(C(at(tor(0.17 + (i % 2) * 0.02, 0.075, 8), 0, 0.2 + i * 0.16, 0), i % 2 ? '#8a6a3a' : '#6f8f45'));
    P.push(C(at(sph(0.2, 1, 0.6, 1, 8, 5), 0, 0.98, 0), '#6f8f45'), C(at(bit(0.06, 1, 1, 1), 0.14, 0.4, 0.14), '#2a1a10'), C(at(bit(0.06, 1, 1, 1), -0.12, 0.62, 0.16), '#2a1a10'), C(at(bit(0.06, 1, 1, 1), 0.1, 0.84, -0.15), '#2a1a10')); return fin(P, 0.4); },
  brioche() { seed = 15; const P = [...plate(0.66), C(at(sph(0.52, 1, 0.62, 1, 16, 9), 0, 0.4, 0), '#d9923a'), C(at(sph(0.45, 1, 0.4, 1, 14, 6), 0, 0.55, 0), '#e8b055'), C(at(sph(0.2, 1, 0.85, 1, 10, 7), 0, 0.86, 0), '#e8b055'),
      C(at(sph(0.2, 1, 1, 1, 10, 7), 0.44, 0.48, 0.14), '#f6a8ba'), C(at(sph(0.2, 1, 1, 1, 10, 7), 0.42, 0.46, -0.2), '#fff0c4'), C(at(cyl(0.15, 0.05, 0.14, 8), 0.4, 0.28, -0.04), '#e8c47c')]; return fin(P, 0.5); },
  leaf() { const P = []; const N = 7;
    for (let i = 0; i < N; i++) { const a = (i / (N - 1) - 0.5) * 2.5, len = i === 3 ? 0.62 : 0.5 - Math.abs(i - 3) * 0.04; const lf = new THREE.ConeGeometry(0.075, len * 2, 6).scale(1, 1, 0.28); lf.translate(0, len, 0).rotateZ(-a * 0.8); lf.translate(0, 0.3, 0); P.push(C(lf, i % 2 ? '#2f9a34' : '#46b83f')); }
    P.push(C(at(cyl(0.03, 0.04, 0.5, 6), 0, 0.05, 0), '#2a7a2c'), C(at(sph(0.17, 1, 1, 1, 10, 8), 0, 0.42, 0.06), '#ffd83a'), C(at(bit(0.025, 1, 1, 1), -0.06, 0.46, 0.2), '#1a1208'), C(at(bit(0.025, 1, 1, 1), 0.06, 0.46, 0.2), '#1a1208'), C(at(new THREE.TorusGeometry(0.07, 0.013, 5, 8, Math.PI).rotateZ(Math.PI), 0, 0.4, 0.2), '#1a1208'));
    return fin(P, 0.6, 1.5); },
};
const { leaf, ...foods } = shapes;
export const FOOD_ART = foods;
export const leafArt = leaf;
