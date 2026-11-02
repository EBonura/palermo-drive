// Low-poly tree geometries that are shared by the props (single trees, src/props.js) and the forest instancing of the tiles (src/world.js):
// the Aleppo pine (the pine of Pellegrino, Monte Gallo and the hills), the stone pine (the umbrella pine of the Favorita and the Mondello villas), the plane tree (Via della Liberta and the old avenues),
// the ficus and the holm oak (the big dark trees of the squares, the garden walls and the Favorita), a generic broadleaf, the orange, and the fan and date palms.
// A crown is a mass of small overlapping clumps (Mini.crown) on a trunk that forks (Mini.limb), not a few big lumps: 90 to 240 triangles a tree. Vertex coloured, linear colours, no uvs; built once.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const hash3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const C = h => new THREE.Color(h);

class Mini {
  constructor() { this.p = []; this.c = []; }
  vert(v, col, k) { this.p.push(v[0], v[1], v[2]); const kk = (v[3] === undefined ? 1 : v[3]) * k; this.c.push(col.r * kk, col.g * kk, col.b * kk); }
  tri(a, b, c, col, k = 1) { this.vert(a, col, k); this.vert(b, col, k); this.vert(c, col, k); return this; }
  limb(x0, y0, z0, x1, y1, z1, r0, r1, seg, col) {   // a branch: a frustum from one point to another (any direction), no caps, darker at the foot
    let ax = x1 - x0, ay = y1 - y0, az = z1 - z0; const L = Math.hypot(ax, ay, az) || 1; ax /= L; ay /= L; az /= L;
    let ux = -az, uy = 0, uz = ax; const ul = Math.hypot(ux, uz); if (ul < 0.05) { ux = 1; uz = 0; } else { ux /= ul; uz /= ul; }   // u = a x (0,1,0), any perpendicular to the axis
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    const ring = (x, y, z, r, k) => { const o = []; for (let i = 0; i < seg; i++) { const t = 0.3 + TAU * i / seg, c = Math.cos(t) * r, s = Math.sin(t) * r; o.push([x + ux * c + vx * s, y + uy * c + vy * s, z + uz * c + vz * s, k]); } return o; };
    const b = ring(x0, y0, z0, r0, 0.7), t = ring(x1, y1, z1, r1, 1);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; for (const q of [b[i], t[j], b[j], b[i], t[i], t[j]]) this.vert(q, col, 1); }
    return this;
  }
  // one clump of leaves: a bipyramid on a ring of `side` irregular points (8 triangles at 4 sides, 10 at 5), lit from above and dark underneath. Many of these, overlapping, read as a mass of leaves with a ragged edge.
  clump(cx, cy, cz, rx, ry, rz, col, seed, kLow = 0.55, side = 5) {
    const h = i => hash3(seed * 1.31 + i * 1.7, seed * 0.37 + i * 0.9, i * 2.3 + seed), rot = h(1) * TAU, ring = [];
    for (let i = 0; i < side; i++) { const a = rot + TAU * (i + (h(10 + i) - 0.5) * 0.7) / side, rr = 0.78 + 0.4 * h(20 + i); ring.push([cx + Math.cos(a) * rx * rr, cy + (h(30 + i) - 0.5) * 0.5 * ry, cz + Math.sin(a) * rz * rr]); }
    const top = [cx + (h(40) - 0.5) * rx * 0.4, cy + ry * (0.7 + 0.35 * h(41)), cz + (h(42) - 0.5) * rz * 0.4], bot = [cx, cy - ry * (0.22 + 0.2 * h(43)), cz];
    const kt = 1, km = kLow + (1 - kLow) * 0.6, kb = kLow + (1 - kLow) * 0.25;
    for (let i = 0; i < side; i++) {
      const A = ring[i], B = ring[(i + 1) % side], tj = 0.74 + 0.5 * h(50 + i), bj = 0.88 + 0.24 * h(70 + i);
      this.vert([...top, kt], col, tj); this.vert([...B, km], col, tj); this.vert([...A, km], col, tj);
      this.vert([...bot, kb], col, bj); this.vert([...A, km], col, bj); this.vert([...B, km], col, bj);
    }
    return this;
  }
  // a crown: n clumps spread over an ellipsoid shell (Fibonacci spiral, so no two sit on top of one another), the lower ones darker; cols are mixed clump by clump; o.low: how far down the shell goes (-1 .. 1)
  crown(cx, cy, cz, rx, ry, rz, n, cr, cols, seed, o = {}) {
    const low = o.low ?? -0.45, kLow = o.kLow ?? 0.62, flat = o.flat ?? 0.8;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, y = 1 - (1 - low) * u, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + seed, shell = (o.shell ?? 0.72) + (1 - (o.shell ?? 0.72)) * hash3(seed + i, i * 0.7, seed * 0.3);
      const k = (cr * (0.8 + 0.45 * hash3(i, seed, 3.1)));
      const x = cx + rx * shell * rr * Math.cos(a), yy = cy + ry * shell * y, z = cz + rz * shell * rr * Math.sin(a);
      this.clump(x, yy, z, k, k * flat, k, cols[i % cols.length].clone().multiplyScalar(0.7 + 0.3 * (y + 1) / 2).multiply(new THREE.Color(0.9 + 0.2 * hash3(i, seed, 5.3), 0.94 + 0.12 * hash3(i, seed, 6.7), 0.88 + 0.24 * hash3(i, seed, 8.1))), seed + i, kLow, o.side ?? 5);
    }
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

// Palms. Washingtonia / Trachycarpus (palm_fan_*): a slender trunk with a shaggy dead skirt, and a crown of palmate fronds at every angle: young ones standing up, old ones arching over and hanging, so it is a ball of leaves and not an umbrella.
function fanPalm(H, n, seed) {
  const m = new Mini(), trunk = C('#8a7658'), top = [0.12, H, 0.04], dead = C('#8b7a4a'), g1 = C('#4f7d30'), g2 = C('#7aa63c'), h = (i, k) => hash3(seed * 3.1 + i * 1.9, k * 7.3, i * 0.37 + seed);
  m.limb(0, 0, 0, 0.12, H * 0.55, 0.04, 0.36, 0.27, 5, trunk).limb(0.12, H * 0.55, 0.04, top[0], H, top[2], 0.27, 0.23, 5, trunk);
  for (let i = 0; i < 8; i++) {   // the dead skirt: old fronds hanging against the trunk
    const a = i * TAU / 8 + h(i, 1), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, L = 1.3 + 0.7 * h(i, 2);
    m.tri([top[0] + dx * 0.25, H + 0.1, top[2] + dz * 0.25], [top[0] + dx * 0.8 + px * 0.28, H - L, top[2] + dz * 0.8 + pz * 0.28], [top[0] + dx * 0.8 - px * 0.28, H - L + 0.2, top[2] + dz * 0.8 - pz * 0.28], dead, 0.9);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed, ring = i % 3, e = [0.95, 0.3, -0.38][ring] + (h(i, 3) - 0.5) * 0.3, ce = Math.cos(e), se = Math.sin(e), len = 1.0 + 0.5 * h(i, 4) + (ring === 0 ? -0.3 : 0.1), bl = 2.1 + 0.8 * h(i, 5), droop = (ring === 0 ? 0.35 : ring === 1 ? 0.8 : 1.3) + 0.3 * h(i, 6);
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, P = [top[0] + dx * ce * len, H + 0.15 + se * len - 0.25 * ring, top[2] + dz * ce * len], col = ring === 0 ? g2 : g1;
    m.tri([top[0], H + 0.1, top[2]], [P[0] + px * 0.05, P[1] + 0.03, P[2] + pz * 0.05], [P[0] - px * 0.05, P[1] + 0.03, P[2] - pz * 0.05], C('#6a7a3a'), 1);   // the petiole
    const tips = []; for (let j = -2; j <= 2; j++) { const ang = a + j * 0.36, w = [0.82, 1.12, 0.92, 1.12, 0.82][j + 2] * bl, up = ring === 0 ? 0.7 : 0.1; tips.push([P[0] + Math.cos(ang) * w * (ring === 0 ? 0.55 : 1), P[1] + up * w * 0.5 - droop * (0.4 + Math.abs(j) * 0.26), P[2] + Math.sin(ang) * w * (ring === 0 ? 0.55 : 1)]); }
    for (let j = 0; j < 4; j++) m.vert([...P, 0.8], col, 1), m.vert([...tips[j], 1.15], col, 1), m.vert([...tips[j + 1], 1.15 - 0.15 * (j & 1)], col, 1);
  }
  return m.geo();
}
// Phoenix canariensis (palm_date_*): a thick trunk with a swelling under the crown and a big dense head of long, arching feather fronds (the lower ones hang down)
function datePalm(H, n, seed) {
  const m = new Mini(), trunk = C('#7b684b'), c1 = C('#3f6428'), c2 = C('#86a548'), h = (i, k) => hash3(seed * 2.7 + i * 1.3, k * 5.9, i * 0.71 + seed);
  m.limb(0, 0, 0, 0.05, H * 0.6, 0, 0.5, 0.4, 6, trunk).limb(0.05, H * 0.6, 0, 0, H, 0, 0.4, 0.46, 6, trunk).clump(0, H + 0.15, 0, 0.62, 0.5, 0.62, C('#6c5a3a'), 5, 0.8, 5);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed, ring = i % 4, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const L = 3.5 + 0.9 * h(i, 1) + (ring === 0 ? -0.9 : 0), lift = [3.4, 2.4, 1.5, 0.7][ring] + 0.4 * h(i, 2), grav = [1.4, 1.9, 2.4, 3.0][ring] + 0.4 * h(i, 3), out = ring === 0 ? 0.55 : 1;
    const at = t => [dx * L * out * t, H + 0.25 + lift * t - grav * t * t, dz * L * out * t];
    const sec = [0.38, 0.72, 1].map(t => { const w = 0.78 * (1 - 0.5 * t * t) * (ring === 0 ? 0.8 : 1), c = at(t); return [[c[0] + px * w, c[1] - 0.12 * w, c[2] + pz * w], [c[0], c[1] + 0.07, c[2]], [c[0] - px * w, c[1] - 0.12 * w, c[2] - pz * w]]; });
    const tip = at(1.06), base = [0, H + 0.2, 0], cc = ring === 0 ? c2 : c1;
    const T = (a1, b1, c3, k) => { m.vert([...a1, k[0]], cc, 1); m.vert([...b1, k[1]], cc, 1); m.vert([...c3, k[2]], cc, 1); };
    T(base, sec[0][0], sec[0][1], [0.7, 0.9, 1.1]); T(base, sec[0][1], sec[0][2], [0.7, 1.1, 0.9]);
    for (let s = 0; s < 2; s++) { const u = sec[s], v = sec[s + 1], k0 = 0.8 + 0.2 * s, k1 = k0 + 0.2; T(u[0], v[0], u[1], [k0, k1, k0 + 0.25]); T(u[1], v[0], v[1], [k0 + 0.25, k1, k1 + 0.25]); T(u[1], v[1], u[2], [k0 + 0.25, k1 + 0.25, k0]); T(v[1], v[2], u[2], [k1 + 0.25, k1, k0]); }
    T(sec[2][0], tip, sec[2][1], [1, 1.25, 1.2]); T(sec[2][1], tip, sec[2][2], [1.2, 1.25, 1]);
  }
  return m.geo();
}

const cache = {};
const BUILD = {
  // Pinus halepensis: a slender, often leaning grey-red trunk and a thin, irregular crown in light olive-green with the sky showing between the clumps
  aleppo(lo) {   // lo: the cheaper one the woods of the tiles are planted with (src/world.js); the full one stands along roads and as single props
    const m = new Mini(), trunk = C('#7b5c48');
    m.limb(0, 0, 0, 0.5, 3.4, 0.1, 0.32, 0.2, 5, trunk).limb(0.5, 3.3, 0.1, 1.0, 6.0, 0.3, 0.2, 0.1, 4, trunk).limb(0.45, 3.9, 0.1, -1.6, 5.5, -0.5, 0.1, 0.06, 4, trunk);
    m.crown(0.9, 6.9, 0.3, 2.3, 1.1, 2.1, lo ? 6 : 9, lo ? 1.35 : 1.1, ['#6c8a3c', '#62803a', '#728f40', '#7a9644'].map(C), 1, { kLow: 0.6, flat: 0.85, side: 4 }).crown(-1.7, 5.7, -0.5, 1.4, 0.7, 1.3, lo ? 2 : 4, lo ? 1.2 : 0.9, ['#678536', '#62803a'].map(C), 2, { kLow: 0.6, flat: 0.85, side: 4 });
    return m.geo();
  },
  // Pinus pinea: a tall straight trunk and a wide, flat, dark umbrella
  stone(lo) {
    const m = new Mini(), trunk = C('#8a6248');
    m.limb(0, 0, 0, 0.25, 6.2, 0.1, 0.38, 0.24, 5, trunk).limb(0.25, 5.9, 0.1, 2.1, 7.6, 0.5, 0.2, 0.1, 4, trunk).limb(0.25, 6.0, 0.1, -2.1, 7.4, -0.6, 0.2, 0.1, 4, trunk);
    m.crown(0.2, 7.9, 0, 4.4, 0.9, 4.2, lo ? 8 : 13, lo ? 2.0 : 1.6, ['#3f5e30', '#486a36', '#43643a', '#4a6c38'].map(C), 6, { low: -0.3, flat: 0.6, kLow: 0.6, side: 4 });
    return m.geo();
  },
  // Platanus x acerifolia: a thick pale mottled trunk that forks, and a big round crown of bright yellowish-green
  plane() {
    const m = new Mini(), trunk = C('#a39e8c');
    m.limb(0, 0, 0, 0.1, 3.2, 0, 0.36, 0.26, 6, trunk).limb(0.1, 3.0, 0, 1.3, 5.8, 0.4, 0.22, 0.12, 4, trunk).limb(0.1, 3.2, 0, -1.2, 5.4, -0.5, 0.2, 0.1, 4, trunk);
    m.crown(0.1, 7.2, 0, 3.7, 3.0, 3.6, 26, 1.5, ['#6f9a44', '#7aa44a', '#668f3e', '#80a94e'].map(C), 11, { low: -0.5, flat: 0.85, side: 4 });
    return m.geo();
  },
  aleppo_lo() { return this.aleppo(1); },
  stone_lo() { return this.stone(1); },
  holm_lo() { return this.holm(1); },
  palm_fan_a() { return fanPalm(9, 22, 1); },
  palm_fan_b() { return fanPalm(13, 24, 2); },
  palm_fan_c() { return fanPalm(6.5, 18, 3); },
  palm_date_a() { return datePalm(5, 14, 1); },
  palm_date_b() { return datePalm(7.5, 15, 2); },
  // Ficus macrophylla / microcarpa (the big dark trees of the squares and the avenues): a thick short trunk that splits at once into heavy limbs, and a very wide, dense, dark dome
  ficus() {
    const m = new Mini(), trunk = C('#6b5e4e');
    m.limb(0, 0, 0, 0, 2.3, 0, 0.82, 0.55, 6, trunk).limb(0, 2.1, 0, 2.5, 4.3, 0.6, 0.4, 0.2, 4, trunk).limb(0, 2.1, 0, -2.3, 4.0, -0.9, 0.4, 0.2, 4, trunk).limb(0, 2.3, 0, 0.4, 4.5, 2.1, 0.34, 0.18, 4, trunk);
    m.crown(0.2, 5.4, 0.2, 4.6, 2.6, 4.4, 24, 1.8, ['#3f5d2d', '#486a32', '#3a5629', '#4a6c33', '#456536'].map(C), 21, { low: -0.55, flat: 0.85, side: 4 });
    return m.geo();
  },
  // Quercus ilex and the other dark broadleaves of the Favorita (holm oak, carob, eucalyptus): a tall forked trunk and a big, dense, very dark crown that meets the next one along an avenue (the tunnel of Viale Diana)
  holm(lo) {
    const m = new Mini(), trunk = C('#4a4036');
    m.limb(0, 0, 0, 0.1, 3.4, 0, 0.36, 0.26, 5, trunk).limb(0.1, 3.2, 0, 1.5, 5.4, 0.5, 0.2, 0.12, 4, trunk).limb(0.1, 3.3, 0, -1.3, 5.2, -0.6, 0.2, 0.12, 4, trunk);
    m.crown(0, 6.4, 0, 3.9, 2.9, 3.7, lo ? 11 : 18, lo ? 2.3 : 1.85, ['#2c4528', '#345030', '#37573a', '#294023', '#3a5836'].map(C), 51, { low: -0.62, flat: 0.85, kLow: 0.7, side: 4 });
    return m.geo();
  },
  // a generic broadleaf (carob, holm oak, olive, jacaranda): a slim forked trunk and a rounder, smaller crown (the species tint of src/species.js turns it into each)
  tree() {
    const m = new Mini(), trunk = C('#6e5a44');
    m.limb(0, 0, 0, 0.1, 3.0, 0, 0.22, 0.14, 5, trunk).limb(0.1, 2.8, 0, 1.2, 4.7, 0.4, 0.12, 0.07, 4, trunk).limb(0.1, 2.9, 0, -1.0, 4.4, -0.3, 0.12, 0.07, 4, trunk);
    m.crown(0, 5.2, 0, 2.7, 2.1, 2.6, 16, 1.4, ['#587e3a', '#648a40', '#527a38'].map(C), 31, { low: -0.5, flat: 0.85, side: 4 });
    return m.geo();
  },
  // bitter orange / citrus street tree: short trunk, small dense round crown with a couple of fruit
  orange() {
    const m = new Mini();
    m.limb(0, 0, 0, 0, 1.9, 0, 0.14, 0.1, 4, C('#5b4a3a'));
    m.crown(0, 3.0, 0, 1.55, 1.25, 1.5, 9, 0.85, ['#46703a', '#527c40', '#3f6a34'].map(C), 41, { low: -0.5, flat: 0.85, side: 4 });
    m.clump(1.2, 2.6, 0.5, 0.22, 0.2, 0.22, C('#e48a1c'), 7, 0.8, 4);
    return m.geo();
  },
};

export const treeGeo = name => cache[name] || (cache[name] = BUILD[name]());
