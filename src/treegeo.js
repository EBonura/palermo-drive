// Low-poly tree geometries that are shared by the props (single trees, src/props.js) and the forest instancing of the tiles (src/world.js):
// the Aleppo pine (the pine of Pellegrino, Monte Gallo and the hills), the stone pine (the umbrella pine of the Favorita and the Mondello villas)
// and the plane tree (Via della Liberta and the old avenues). Vertex coloured, linear colours, no uvs; built once.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const hash3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const C = h => new THREE.Color(h);

class Mini {
  constructor() { this.p = []; this.c = []; }
  vert(v, col, k) { this.p.push(v[0], v[1], v[2]); const kk = (v[3] === undefined ? 1 : v[3]) * k; this.c.push(col.r * kk, col.g * kk, col.b * kk); }
  prism(cx, cz, y0, y1, r0, r1, seg, col, lean = 0) {   // trunk: a frustum, optionally leaning (the top is moved by `lean` along x)
    const ring = (y, r, dx, k) => { const a = []; for (let i = 0; i < seg; i++) a.push([cx + dx + Math.cos(0.3 + TAU * i / seg) * r, y, cz + Math.sin(0.3 + TAU * i / seg) * r, k]); return a; };
    const b = ring(y0, r0, 0, 0.7), t = ring(y1, r1, lean, 1);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; for (const q of [b[i], b[j], t[j], b[i], t[j], t[i]]) this.vert(q, col, 1); }
    return this;
  }
  lump(cx, cy, cz, rx, ry, rz, col, jit = 0.2, kLow = 0.62, seed = 0) {   // lumpy ellipsoid, darker underneath
    const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), pos = g.attributes.position, v = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), j = 1 + (hash3(Math.round(x * 50) + seed, Math.round(y * 50), Math.round(z * 50)) - 0.5) * 2 * jit;
      v.push([cx + x * rx * j, cy + y * ry * j, cz + z * rz * j, kLow + (1 - kLow) * (y * 0.5 + 0.5)]);
    }
    for (let i = 0; i < v.length; i += 3) { const tj = 0.88 + 0.24 * hash3(i * 0.37 + seed, seed * 1.7, i * 0.11); for (let k = 0; k < 3; k++) this.vert(v[i + k], col, tj); }
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

const cache = {};
const BUILD = {
  // Pinus halepensis: a slender, often leaning grey-red trunk and a thin, irregular crown in light olive-green with the sky showing between the clumps
  aleppo() {
    const m = new Mini(), trunk = C('#7b5c48');
    m.prism(0, 0, 0, 2.8, 0.32, 0.22, 5, trunk, 0.3).prism(0.3, 0, 2.8, 5.4, 0.22, 0.12, 5, trunk, 0.3);
    for (const [x, y, z, rx, ry, rz, c, sd] of [[0.9, 6.6, 0.2, 2.7, 1.2, 2.5, '#6c8a3c', 1], [-1.6, 5.6, -0.7, 2.0, 1.0, 1.9, '#62803a', 2], [2.3, 5.3, 1.1, 1.9, 0.95, 1.8, '#728f40', 3],
      [-0.2, 7.9, -0.5, 1.6, 0.95, 1.5, '#7a9644', 4], [-2.3, 7.0, 0.9, 1.3, 0.8, 1.3, '#678536', 5]]) m.lump(x, y, z, rx, ry, rz, C(c), 0.26, 0.6, sd);
    return m.geo();
  },
  // Pinus pinea: a tall straight trunk and a wide, flat, dark umbrella
  stone() {
    const m = new Mini(), trunk = C('#8a6248');
    m.prism(0, 0, 0, 5.9, 0.36, 0.24, 5, trunk, 0.2);
    for (const [x, y, z, rx, ry, rz, c, sd] of [[0.2, 7.4, 0, 5.0, 1.5, 4.8, '#3f5e30', 6], [2.9, 6.8, 1.2, 3.0, 1.15, 2.9, '#486a36', 7], [-2.9, 6.9, -1.0, 3.0, 1.15, 2.9, '#43643a', 8], [0.4, 8.5, -0.7, 2.6, 0.95, 2.4, '#4a6c38', 9]]) m.lump(x, y, z, rx, ry, rz, C(c), 0.18, 0.6, sd);
    return m.geo();
  },
  // Platanus x acerifolia: a thick pale mottled trunk that forks, and a big round crown of bright yellowish-green
  plane() {
    const m = new Mini(), trunk = C('#b4ad98');
    m.prism(0, 0, 0, 3.6, 0.34, 0.24, 6, trunk, 0.1).prism(0.1, 0, 3.4, 5.6, 0.2, 0.12, 5, trunk, 0.9);
    for (const [x, y, z, rx, ry, rz, c, sd] of [[0.2, 7.0, 0, 3.4, 2.5, 3.3, '#6f9a44', 11], [2.1, 5.9, 0.9, 2.1, 1.7, 2.0, '#7aa44a', 12], [-2.0, 6.1, -0.8, 2.2, 1.7, 2.1, '#668f3e', 13], [0.3, 8.6, 0.7, 2.0, 1.4, 1.9, '#80a94e', 14], [-0.5, 5.4, 2.0, 1.7, 1.3, 1.7, '#6b963f', 15]]) m.lump(x, y, z, rx, ry, rz, C(c), 0.2, 0.6, sd);
    return m.geo();
  },
};

export const treeGeo = name => cache[name] || (cache[name] = BUILD[name]());
