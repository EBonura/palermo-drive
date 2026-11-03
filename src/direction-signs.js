// Direction signs on the fast roads (tools/expressway_signs.py reads the OSM `destination` tags of the motorway and slip road ways into src/expressway-signs.js).
// A green roadside board on two posts near the start of a slip road that has a destination, and an overhead gantry over a carriageway whose way has `destination:lanes` (or a
// destination), a panel per run of lanes with the same text. Place names and refs are OSM's; the sizes, colours and heights are design values. One merged mesh per tile on one shared
// material (a text atlas, drawn the first time a sign is built); the posts are wall segments (src/fences.js registers them). ?nosigns turns them off.
import * as THREE from 'three';
import { rasterMask, groundY } from './core.js';
import { hwOf, probeEdge } from './expressway.js';
import SIGNS from './expressway-signs.js';

const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosigns');
const hh = Math.hypot, AS = 2048;
let ATLAS = null;
function atlas() {
  if (ATLAS) return ATLAS;
  const cv = document.createElement('canvas'); cv.width = cv.height = AS;
  const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 16, 16);   // texel 0: white, for posts and the backs of the boards
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  ATLAS = { g, tex, x: 16, y: 0, rowH: 16, cells: new Map(), mat: new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.55, emissiveMap: tex, emissive: new THREE.Color('#202020') }) };
  return ATLAS;
}
function signCell(w, h, names, refs) {   // 74 px per metre; the uv rectangle of the board's face in the atlas, or null when the atlas is full
  const A = atlas(), key = w + '|' + h + '|' + names.join(';') + '|' + refs.join(';');
  if (A.cells.has(key)) return A.cells.get(key);
  const pw = Math.round(w * 74), ph = Math.round(h * 74);
  if (A.x + pw + 2 > AS) { A.x = 0; A.y += A.rowH + 2; A.rowH = 0; }
  if (A.y + ph > AS) return null;
  const x0 = A.x, y0 = A.y; A.x += pw + 2; A.rowH = Math.max(A.rowH, ph);
  const g = A.g; g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, pw, ph); g.clip();
  g.fillStyle = '#0b6e47'; g.fillRect(0, 0, pw, ph);
  g.strokeStyle = '#eef0e8'; g.lineWidth = Math.max(3, ph * 0.035); g.strokeRect(g.lineWidth * 1.4, g.lineWidth * 1.4, pw - g.lineWidth * 2.8, ph - g.lineWidth * 2.8);
  const lines = names.map(t => ({ t, f: 1 })).concat(refs.length ? [{ t: refs.join('   '), f: 0.8 }] : []), pad = ph * 0.1, lh = (ph - 2 * pad) / Math.max(1, lines.length);
  g.fillStyle = '#f4f5ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    let fs = Math.min(lh * 0.74, 44) * l.f; g.font = `bold ${fs}px Helvetica, Arial, sans-serif`;
    const mw = g.measureText(l.t).width; if (mw > pw - 2 * pad) { fs *= (pw - 2 * pad) / mw; g.font = `bold ${fs}px Helvetica, Arial, sans-serif`; }
    g.fillText(l.t, pw / 2, pad + lh * (i + 0.5));
  });
  g.restore(); A.tex.needsUpdate = true;
  const uv = [x0 / AS, 1 - (y0 + ph) / AS, (x0 + pw) / AS, 1 - y0 / AS];   // u0, v0 (bottom), u1, v1 (top)
  A.cells.set(key, uv); return uv;
}
const POST = new THREE.Color('#8b8e92'), BACK = new THREE.Color('#6f7378'), WHITE = new THREE.Color('#ffffff');

// -> { group, segs } (segs: [ax, az, bx, bz] wall segments of the posts) or null: the signs inside this tile
export function buildSigns(data) {
  if (OFF || !data || !data.streets || !data.streets.aoi || !data.roads) return null;
  const [x0, z0, x1, z1] = data.streets.aoi, mine = SIGNS.filter(s => s.x >= x0 && s.x < x1 && s.z >= z0 && s.z < z1);
  if (!mine.length) return null;
  const mask = rasterMask([data.streets.asphalt || []], data.streets.aoi, 2);
  const P = [], N = [], Cc = [], U = [], segs = [];
  const tri = (a, b, c, n, col, uv) => {   // one triangle, wound to face n
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { [b, c] = [c, b]; uv = [uv[0], uv[2], uv[1]]; }
    [a, b, c].forEach((q, i) => { P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]); Cc.push(col.r, col.g, col.b); U.push(uv[i][0], uv[i][1]); });
  };
  const quad = (a, b, c, d, n, col, rect) => {   // a, b, c, d around the face (a to b along u, a to d along v); rect: the uv rectangle, or null (the white texel)
    const [u0, v0, u1, v1] = rect || [0.002, 0.996, 0.004, 0.998];
    tri(a, b, c, n, col, [[u0, v0], [u1, v0], [u1, v1]]); tri(a, c, d, n, col, [[u0, v0], [u1, v1], [u0, v1]]);
  };
  const box = (cx, cz, ax, az, bx, bz, ha, hb, y0, y1, col) => {   // an oriented box: half sizes ha along (ax, az), hb along (bx, bz)
    const c = [[cx - ax * ha - bx * hb, cz - az * ha - bz * hb], [cx + ax * ha - bx * hb, cz + az * ha - bz * hb], [cx + ax * ha + bx * hb, cz + az * ha + bz * hb], [cx - ax * ha + bx * hb, cz - az * ha + bz * hb]];
    for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4], ex = q[0] - p[0], ez = q[1] - p[1], l = hh(ex, ez) || 1; quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [ez / l, 0, -ex / l], col, null); }
    quad([c[0][0], y1, c[0][1]], [c[1][0], y1, c[1][1]], [c[2][0], y1, c[2][1]], [c[3][0], y1, c[3][1]], [0, 1, 0], col, null);
  };
  const board = (cx, cz, tx, tz, w, y0, y1, names, refs) => {   // a board facing the traffic (normal -t), w wide across the road
    const rx = -tz, rz = tx, rect = signCell(w, y1 - y0, names, refs); if (!rect) return false;
    const a = [cx - rx * w / 2, y0, cz - rz * w / 2], b = [cx + rx * w / 2, y0, cz + rz * w / 2], c = [cx + rx * w / 2, y1, cz + rz * w / 2], d = [cx - rx * w / 2, y1, cz - rz * w / 2];
    quad(a, b, c, d, [-tx, 0, -tz], WHITE, rect);   // seen from the traffic (looking along +t) the left end is -r: u grows with r
    const o = 0.05; quad([a[0] + tx * o, a[1], a[2] + tz * o], [b[0] + tx * o, b[1], b[2] + tz * o], [c[0] + tx * o, c[1], c[2] + tz * o], [d[0] + tx * o, d[1], d[2] + tz * o], [tx, 0, tz], BACK, null);
    return true;
  };
  const wall = (x, z, tx, tz, r) => segs.push([x - tx * r, z - tz * r, x + tx * r, z + tz * r]);
  const roadAt = (x, z, links) => {   // the nearest road of the kind within 12 m: its half width
    let best = null, bd = 12;
    for (const r of data.roads) {
      if (r.tn || r.br || !r.p || r.p.length < 4 || (links ? !(r.k === 'motorway_link' || r.k === 'trunk_link' || r.k === 'primary_link') : !(r.k === 'motorway' || r.k === 'trunk'))) continue;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - r.p[i]) * dx + (z - r.p[i + 1]) * dz) / l2)), d = hh(r.p[i] + dx * t - x, r.p[i + 1] + dz * t - z);
        if (d < bd) { bd = d; best = { hw: hwOf(r) }; }
      }
    }
    return best;
  };
  let nb = 0;
  for (const s of mine) {
    const found = roadAt(s.x, s.z, s.k === 'x'); if (!found) continue;
    const tx = s.tx, tz = s.tz, rx = -tz, rz = tx;
    if (s.k === 'x') {   // a roadside exit sign, right of the slip road
      const e = probeEdge(mask, s.x, s.z, rx, rz, found.hw) + 1.6, cx = s.x + rx * e, cz = s.z + rz * e, g = groundY(cx, cz);
      const names = s.t, refs = s.r, w = names.some(n => n.length > 12) ? 3.2 : 2.5, h = 0.55 + 0.42 * (names.length + (refs.length ? 0.8 : 0));
      if (!board(cx, cz, tx, tz, w, g + 1.7, g + 1.7 + h, names, refs)) continue;
      for (const sd of [-1, 1]) { const px = cx + rx * sd * (w / 2 - 0.3), pz = cz + rz * sd * (w / 2 - 0.3); box(px, pz, tx, tz, rx, rz, 0.06, 0.06, g - 0.1, g + 1.7 + h, POST); wall(px, pz, rx, rz, 0.12); }
      nb++;
    } else {   // a gantry over the carriageway
      const eL = probeEdge(mask, s.x, s.z, -rx, -rz, found.hw) + 1.3, eR = probeEdge(mask, s.x, s.z, rx, rz, found.hw) + 1.3;
      const lx = s.x - rx * eL, lz = s.z - rz * eL, qx = s.x + rx * eR, qz = s.z + rz * eR, gl = groundY(lx, lz), gr = groundY(qx, qz), gc = groundY(s.x, s.z);
      const span = eL + eR - 2.6, lane = span / s.nl, gm = Math.max(gl, gr, gc), top = gm + 7.2;
      let at = 0, done = true;
      for (const p of s.p) {   // panels left to right in the travelling direction
        if (p) {
          const wd = p.n * lane - 0.5, cc = -eL + 1.3 + (at + p.n / 2) * lane;
          if (!board(s.x + rx * cc, s.z + rz * cc, tx, tz, Math.max(2.2, wd), gm + 4.9, top - 0.45, p.t, p.r)) done = false;
        }
        at += p ? p.n : 1;
      }
      if (!done) continue;
      for (const [px, pz, g] of [[lx, lz, gl], [qx, qz, gr]]) { box(px, pz, tx, tz, rx, rz, 0.28, 0.28, g - 0.2, top, POST); wall(px, pz, rx, rz, 0.3); }
      box(s.x + rx * (eR - eL) / 2, s.z + rz * (eR - eL) / 2, rx, rz, tx, tz, (eL + eR) / 2 + 0.3, 0.25, top - 0.45, top, POST);   // the beam
      nb++;
    }
  }
  if (!P.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const m = new THREE.Mesh(geo, atlas().mat); m.name = 'direction_signs'; m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); g.userData.tris = P.length / 9; g.userData.signs = nb;
  return { group: g, segs };
}
