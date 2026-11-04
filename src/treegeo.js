// Low-poly tree geometries that are shared by the props (single trees, src/props.js) and the forest instancing of the tiles (src/world.js):
// the plane tree (Via della Liberta and the old avenues, leafy and bare), the stone pine (the umbrella pine of the Favorita, Viale Regione Siciliana and the Mondello villas), the Aleppo pine (Pellegrino, Monte Gallo and the hills),
// the ficus (buttressed trunk, the big dark trees of the squares), the holm oak, a generic broadleaf, the orange, the jacaranda, the oleander shrub, and the fan and date palms.
// A crown is a few solid faceted lobes (Mini.lobe: a jittered icosahedron of 20 or 80 faces, flattened underneath, light on top and dark under and inside, lit as one crown) that sit on the tips of real branches, with a fringe of small
// open leaf sprays (Mini.sprig, 5 triangles) to break the outline; the pines of the woods use the same lobes in the cheap `*_lo` shapes. The palms are ribbons of quads with notched edges and fans of blades, not combs of leaflets.
// Sprays and fronds are open sheets, so these geometries need a two-sided material (the props `dbl` material, `treeMat` in src/world.js). Vertex coloured in linear colours with their own normals, no uvs, no alpha test;
// built once, 55 to 500 triangles a tree (the woods of the tiles use the `*_lo` shapes, 80 to 95).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const C = h => new THREE.Color(h);
const rnd = seed => { let s = (Math.imul(Math.floor(seed * 1000) | 0, 2654435761) ^ 0x9e3779b9) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// a vector turned about the vertical axis, and tilted from the vertical by `tilt`: the direction of a branch that leaves its parent at that angle
const dirOf = (yaw, tilt) => [Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw)];
const tint = (col, r, g, b) => col.clone().multiply(new THREE.Color(r, g, b));


// the unit icosahedron, subdivided `detail` times (cached): vertices and faces
const ICO = {};
function ico(detail) {
  if (ICO[detail]) return ICO[detail];
  const t = 1.618;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const mid = new Map(), NF = [], m = (a, b) => { const k = a < b ? a * 1000 + b : b * 1000 + a; if (!mid.has(k)) { P.push(norm(mul(add(P[a], P[b]), 0.5))); mid.set(k, P.length - 1); } return mid.get(k); };
    for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = NF;
  }
  return ICO[detail] = { P, F };
}

class Mini {
  constructor() { this.p = []; this.c = []; this.n = []; }
  vert(v, col, k, nn) { this.p.push(v[0], v[1], v[2]); const kk = (v[3] === undefined ? 1 : v[3]) * k; this.c.push(col.r * kk, col.g * kk, col.b * kk); this.n.push(nn[0], nn[1], nn[2]); }
  // a triangle with its own colour; the lighting normal is the face normal turned `w` of the way to `hint` (a crown-wide normal); the winding is made to face the way the normal does
  tri(a, b, c, col, k = 1, hint = null, w = 0) {
    let fn = norm(cross(sub(b, a), sub(c, a)));
    if (hint) { if (dot(fn, hint) < 0) { const t = b; b = c; c = t; fn = mul(fn, -1); } fn = norm(add(mul(fn, 1 - w), mul(hint, w))); }
    this.vert(a, col, k, fn); this.vert(b, col, k, fn); this.vert(c, col, k, fn); return this;
  }
  // a branch or trunk: a tube along a polyline (a bend or two make it organic), radii[i] at path[i], seg sides, bark colour col (col2: the other patch colour of a mottled bark, mot: how much of it)
  tube(path, radii, seg, col, o = {}) {
    const r = rnd(o.seed ?? 1), rings = []; let U = null;
    for (let i = 0; i < path.length; i++) {
      const T = norm(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
      if (!U) { U = Math.abs(T[1]) < 0.9 ? norm(cross([0, 1, 0], T)) : [1, 0, 0]; } else { U = sub(U, mul(T, dot(U, T))); U = norm(U); }
      const V = cross(T, U), ring = [];
      const kv = (o.dark ?? 0.72) + (1 - (o.dark ?? 0.72)) * Math.min(1, i / Math.max(1, path.length - 1)) * (o.grad ?? 1) + (o.band && i % 2 ? -o.band : 0);
      for (let k = 0; k < seg; k++) { const th = (o.rot ?? 0.3) + TAU * k / seg, f = 1 + (o.flute ? o.flute * (k & 1 ? 1 : -1) : 0), rr = radii[i] * f; ring.push([path[i][0] + (U[0] * Math.cos(th) + V[0] * Math.sin(th)) * rr, path[i][1] + (U[1] * Math.cos(th) + V[1] * Math.sin(th)) * rr, path[i][2] + (U[2] * Math.cos(th) + V[2] * Math.sin(th)) * rr, kv]); }
      rings.push(ring);
    }
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
      const j = (k + 1) % seg, a = rings[i][k], b = rings[i][j], c = rings[i + 1][j], d = rings[i + 1][k], mid = mul(add(add(a, b), add(c, d)), 0.25), ax = lerp(path[i], path[i + 1], 0.5), out = norm(sub(mid, ax));
      const cc = o.col2 && r() < (o.mot ?? 0.3) ? o.col2 : col, jit = 1 + (r() - 0.5) * (o.jit ?? 0.2);
      this.tri(a, b, c, cc, jit, out, 0.9).tri(a, c, d, cc, jit, out, 0.9);
    }
    if (o.cap) { const e = rings[rings.length - 1], c0 = path[path.length - 1]; for (let k = 0; k < seg; k++) this.tri(c0, e[k], e[(k + 1) % seg], col, 0.9, [0, 1, 0], 0.8); }
    return this;
  }
  // a faceted blob (a closed solid core of a dense crown, so no sky shows through the middle of an oak): an icosahedron stretched to the radii, the bottom flattened, every point pushed in or out
  blob(c, rx, ry, rz, col, seed, o = {}) {
    const r = rnd(seed), t = 1.618, P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const n = norm(v), j = 1 + (r() - 0.5) * (o.jit ?? 0.3); return [n[0] * j, n[1] * j, n[2] * j]; });
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const at = p => [c[0] + p[0] * rx, c[1] + p[1] * (p[1] < 0 ? ry * (o.flat ?? 0.6) : ry), c[2] + p[2] * rz];
    for (const f of F) { const a = P[f[0]], b = P[f[1]], d = P[f[2]], cen = norm(add(add(a, b), d)), up = 0.5 + 0.5 * cen[1]; this.tri(at(a), at(b), at(d), col, (o.kLow ?? 0.55) + (1 - (o.kLow ?? 0.55)) * up * (0.85 + 0.3 * r()), cen, 0.8); }
    return this;
  }
  // one spray of leaves: o.disc points on an uneven ring that alternates long and short, fanned about the point c and cupped so the edge hangs below the middle (the underside of a canopy shows many of these as dark ragged rosettes), o.disc triangles;
  // without o.disc, five pointed blades instead (the spiky look, kept for the needle-like crowns that may want it)
  sprig(c, nrm, size, col, seed, o = {}) {
    const r = rnd(seed), N = o.blades ?? 5, hint = o.hint || nrm;
    const t0 = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = norm(cross(t0, nrm)), v = cross(nrm, u), rot = r() * TAU;
    if (o.disc) {   // a ragged patch of leaves: a fan of N triangles to an uneven ring that alternates long and short points
      const M = o.disc, ring = [], cup = o.cup ?? 0.3, ctr = [c[0] + nrm[0] * 0.18 * size, c[1] + nrm[1] * 0.18 * size, c[2] + nrm[2] * 0.18 * size, 0.85];
      for (let i = 0; i < M; i++) {
        const a = rot + TAU * (i + (r() - 0.5) * 0.45) / M, rr = size * (i & 1 ? 0.5 + 0.25 * r() : 0.95 + 0.3 * r()), ca = Math.cos(a) * rr, sa = Math.sin(a) * rr, dn = -cup * rr * (rr / size) + (r() - 0.5) * 0.12 * size;
        ring.push([c[0] + u[0] * ca + v[0] * sa + nrm[0] * dn, c[1] + u[1] * ca + v[1] * sa + nrm[1] * dn, c[2] + u[2] * ca + v[2] * sa + nrm[2] * dn, 1]);
      }
      for (let i = 0; i < M; i++) this.tri(ctr, ring[i], ring[(i + 1) % M], col, (0.93 + 0.14 * r()) * (o.k ?? 1), hint, o.w ?? 0.85);
      return this;
    }
    for (let i = 0; i < N; i++) {
      const a = rot + TAU * i / N + (r() - 0.5) * 0.7, L = size * (0.7 + 0.55 * r()), w = (o.wide ?? 0.62) + 0.15 * r(), cup = (o.cup ?? 0.35) + 0.25 * r();
      const dir = (ang, rr, up) => { const ca = Math.cos(ang), sa = Math.sin(ang); return [c[0] + (u[0] * ca + v[0] * sa) * rr + nrm[0] * up, c[1] + (u[1] * ca + v[1] * sa) * rr + nrm[1] * up, c[2] + (u[2] * ca + v[2] * sa) * rr + nrm[2] * up]; };
      const tip = dir(a, L, -cup * L * (0.7 + 0.6 * r())), bl = dir(a - w, L * 0.3, 0.08 * L), br = dir(a + w, L * 0.3, 0.08 * L);
      tip[3] = 1; bl[3] = 0.82; br[3] = 0.82;
      this.tri(bl, tip, br, col, (0.84 + 0.32 * r()) * (o.k ?? 1), hint, o.w ?? 0.72);
    }
    return this;
  }
  // a tuft of needles: thin triangles standing out of one point in every direction of a cone about `dir` (pines)
  tuft(c, dir, size, col, seed, o = {}) {
    const r = rnd(seed), N = o.n ?? 7, hint = o.hint || dir, spread = o.spread ?? 1.3;
    const t0 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = norm(cross(t0, dir)), v = cross(dir, u);
    for (let i = 0; i < N; i++) {
      const a = TAU * (i + r() * 0.8) / N, el = spread * (0.35 + 0.65 * r()), L = size * (0.75 + 0.5 * r()), cs = Math.sin(el), cc = Math.cos(el);
      const d = norm([dir[0] * cc + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * cs, dir[1] * cc + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * cs, dir[2] * cc + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * cs]);
      const side = norm(cross(d, [r() - 0.5, r() - 0.5 + 0.2, r() - 0.5])), wd = (o.wide ?? 0.17) * L;
      const tip = [c[0] + d[0] * L, c[1] + d[1] * L - 0.12 * L, c[2] + d[2] * L, 1], b0 = [c[0] + side[0] * wd, c[1] + side[1] * wd, c[2] + side[2] * wd, 0.78], b1 = [c[0] - side[0] * wd, c[1] - side[1] * wd, c[2] - side[2] * wd, 0.78];
      this.tri(b0, tip, b1, col, (0.82 + 0.34 * r()) * (o.k ?? 1), hint, o.w ?? 0.7);
    }
    return this;
  }
  // The foliage of a crown: lobes = [{c: [x, y, z], r: [rx, ry, rz], n: sprays}], placed on the shell of every lobe (Fibonacci spiral) unless that point is inside another lobe (so nothing is spent
  // where it cannot be seen). The lighting normal blends the lobe's own outward normal with the one of the whole crown; the colour is darker below and in the middle, lighter and warmer on the sunlit top.
  foliage(lobes, o) {
    const r = rnd(o.seed), cols = o.cols, cen = o.centre, R = o.radius, kLow = o.kLow ?? 0.55, bias = o.bias ?? 0.5, sz = o.size, needle = !!o.needle;
    lobes.forEach((lb, li) => {   // a solid core (an octahedron) in every lobe, a little darker than the leaves, so the crown is a mass and not a hollow shell
      if (o.core === 0) return;
      const k = o.core ?? 0.8, cc = cols[0].clone().multiplyScalar(0.62 * (o.gain ?? 1.3)), ax = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -0.6, 0], [0, 0, 1], [0, 0, -1]].map(q => [lb.c[0] + q[0] * lb.r[0] * k, lb.c[1] + q[1] * lb.r[1] * k, lb.c[2] + q[2] * lb.r[2] * k]);
      for (const [a, b, d] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) this.tri(ax[a], ax[b], ax[d], cc, 1, norm(sub(mul(add(add(ax[a], ax[b]), ax[d]), 1 / 3), lb.c)), 1);
    });
    lobes.forEach((lb, li) => {
      const n = lb.n;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, y = 1 - 2 * (o.hemi ? u * 0.5 + 0.0 : u), rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + li * 1.7 + r() * 0.4, sh = 0.86 + 0.18 * r();
        const dx = Math.cos(a) * rr, dz = Math.sin(a) * rr, p = [lb.c[0] + dx * lb.r[0] * sh, lb.c[1] + y * lb.r[1] * sh, lb.c[2] + dz * lb.r[2] * sh];
        let hidden = false;
        for (let lj = 0; lj < lobes.length && !hidden; lj++) { if (lj === li) continue; const o2 = lobes[lj], q = [(p[0] - o2.c[0]) / o2.r[0], (p[1] - o2.c[1]) / o2.r[1], (p[2] - o2.c[2]) / o2.r[2]]; if (dot(q, q) < (o.inside ?? 0.74)) hidden = true; }
        if (hidden) continue;
        const own = norm([dx / lb.r[0], y / lb.r[1], dz / lb.r[2]]), glob = norm([(p[0] - cen[0]) / R[0], (p[1] - cen[1]) / R[1], (p[2] - cen[2]) / R[2]]), nn = norm(add(mul(own, 1 - bias), mul(glob, bias)));
        const hy = Math.max(0, Math.min(1, (p[1] - (cen[1] - R[1])) / (2 * R[1]))), depth = Math.min(1, Math.hypot((p[0] - cen[0]) / R[0], (p[1] - cen[1]) / R[1], (p[2] - cen[2]) / R[2])), lit = kLow + (1 - kLow) * (0.15 + 0.85 * hy) * (0.55 + 0.45 * depth) * (0.5 + 0.5 * Math.max(0, nn[1] * 0.7 + 0.4));
        const base = cols[Math.floor(r() * cols.length)], col = tint(base, 0.96 + 0.08 * r(), 0.97 + 0.06 * r(), 0.94 + 0.12 * r()).multiplyScalar(lit * (o.gain ?? 1.3));
        const s = sz * (lb.s ?? 1) * (0.7 + 0.6 * r());
        if (needle) this.tuft(p, nn, s, col, o.seed * 7 + li * 131 + i, { hint: nn, n: o.n ?? 7, spread: o.spread, wide: o.wide, w: o.w }); else this.sprig(p, nn, s, col, o.seed * 7 + li * 131 + i, { hint: nn, blades: o.blades, disc: o.disc, wide: o.wide, cup: o.cup, w: o.w });
      }
    });
    return this;
  }
  // A solid lobe of foliage: a jittered icosahedron (detail 0: 20 faces, 1: 80) stretched to the radii with a flattened bottom, one radius per vertex so the faces meet. Faces that lie inside the other lobes of the crown are left out.
  // Colour by height in the crown and by how deep inside it the face is (light on top, dark under and in the middle), the lighting normal mostly the crown's (so a crown shades as one mass and the facets only break the light up).
  lobe(c, rx, ry, rz, col, seed, o = {}) {
    const r = rnd(seed), { P, F } = ico(o.detail ?? 0), jit = o.jit ?? 0.34, flat = o.flat ?? 0.6, cols = o.cols || [col], cen = o.cen || c, R = o.R || [rx, ry, rz], kLow = o.kLow ?? 0.55, bias = o.bias ?? 0.6, others = o.others || [];
    const V = P.map(p => { const j = 1 + (r() - 0.5) * jit; return [p[0] * j, p[1] * j, p[2] * j]; });
    const at = p => [c[0] + p[0] * rx, c[1] + p[1] * (p[1] < 0 ? ry * flat : ry), c[2] + p[2] * rz];
    for (const f of F) {
      const a = at(V[f[0]]), b = at(V[f[1]]), d = at(V[f[2]]), fc = mul(add(add(a, b), d), 1 / 3);
      let hid = false;
      for (const q of others) { const u = [(fc[0] - q.c[0]) / q.r[0], (fc[1] - q.c[1]) / q.r[1], (fc[2] - q.c[2]) / q.r[2]]; if (dot(u, u) < (o.inside ?? 0.8)) { hid = true; break; } }
      if (hid) { r(); continue; }
      const own = norm(sub(fc, c)), glob = norm([(fc[0] - cen[0]) / R[0], (fc[1] - cen[1]) / R[1], (fc[2] - cen[2]) / R[2]]), nn = norm(add(mul(own, 1 - bias), mul(glob, bias)));
      const hy = Math.max(0, Math.min(1, (fc[1] - (cen[1] - R[1])) / (2 * R[1]))), depth = Math.min(1, Math.hypot((fc[0] - cen[0]) / R[0], (fc[1] - cen[1]) / R[1], (fc[2] - cen[2]) / R[2]));
      const lit = (kLow + (1 - kLow) * (0.15 + 0.85 * hy) * (0.55 + 0.45 * depth) * (0.5 + 0.5 * Math.max(0, nn[1] * 0.7 + 0.4))) * (o.gain ?? 1.2) * (0.9 + 0.2 * r());
      const base = cols[Math.floor(r() * cols.length)];
      this.tri(a, b, d, tint(base, 0.96 + 0.08 * r(), 0.97 + 0.06 * r(), 0.94 + 0.12 * r()), lit, nn, o.w ?? 0.7);
    }
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    return g;
  }
}

// ------------------------------------------------------------------ branching
// A small branching generator: from p0 a bough of length L leaves in direction d, bends, and forks into `kids` boughs; returns the tips. Seeded, so every model is one fixed individual.
// o: {len: [L0, shrink], r: [r0, shrink], fork: tilt of the children, kids, levels, up: pull to the vertical, wob: bend, seg, col, col2, mot, keep(tilt): fn on the last level}
function boughs(m, p0, d0, L0, r0, o, seed, level = 0, out = []) {
  const r = rnd(seed + level * 17.3), wob = o.wob ?? 0.25, up = o.up ?? 0.18, n = Array.isArray(o.nseg) ? o.nseg[Math.min(level, o.nseg.length - 1)] : (o.nseg ?? 3);   // (nseg: segments of a bough, one number or one per level)
  if (o.fan && level === 0) {   // no bough of its own: the first fork is the trunk top, the limbs leave it at once
    const kids = typeof o.kids === 'function' ? o.kids(0, r) : (o.kids ?? 2);
    for (let k = 0; k < kids; k++) { const yaw = r() * TAU + k * TAU / kids, tilt = (o.fork0 ?? o.fork ?? 0.7) * (0.7 + 0.6 * r()); boughs(m, p0, norm(add(mul(d0, 0.35), mul(dirOf(yaw, tilt), 0.9))), L0, r0, o, seed + 53 * (k + 1), 1, out); }
    return out;
  }
  let d = d0, p = p0; const path = [p0];
  for (let i = 1; i <= n; i++) { d = norm(add(add(d, [(r() - 0.5) * wob, 0, (r() - 0.5) * wob]), [0, up / n, 0])); p = add(p, mul(d, L0 / n)); path.push(p); }
  const rad = path.map((_, i) => r0 * (1 - 0.45 * i / n)), r1 = rad[n], last = level >= o.levels - 1;
  m.tube(path, rad, o.segs ? o.segs[Math.min(level, o.segs.length - 1)] : (level === 0 ? 5 : 4), o.col, { seed: seed + level, col2: o.col2, mot: o.mot, dark: level ? 0.85 : 0.7, cap: last && !o.twig });
  if (last) {
    if (o.twig) m.tuft(p, d, o.twig, o.col2 || o.col, seed + 5, { n: o.twigN ?? 5, spread: 0.9, wide: 0.05, hint: [0, 1, 0], w: 0.5 });   // a broom of bare twigs on the end of a bare limb
    out.push({ p, d, r: r1, level }); return out;
  }
  const kids = typeof o.kids === 'function' ? o.kids(level, r) : (o.kids ?? 2);
  for (let k = 0; k < kids; k++) {
    const yaw = r() * TAU + k * TAU / kids, tilt = (o.fork ?? 0.7) * (0.65 + 0.7 * r());
    const dk = norm(add(mul(d, 0.55), mul(dirOf(yaw, tilt), 0.9)));
    boughs(m, p, dk, L0 * (o.shrink ?? 0.72) * (0.85 + 0.3 * r()), r1 * 0.88, o, seed + 31 * (k + 1) + level * 7, level + 1, out);
  }
  return out;
}


// A crown: a few solid lobes (see Mini.lobe) with a fringe of leaf sprays on their shells (L: [{c, r: [rx, ry, rz], d: detail, n: sprays}])
function crown(m, L, o) {
  const lobes = L.map(l => ({ c: l.c, r: l.r, n: l.n ?? 0, s: l.s ?? 1 }));
  L.forEach((l, i) => m.lobe(l.c, l.r[0], l.r[1], l.r[2], o.cols[0], o.seed * 3 + i * 17, { detail: l.d ?? 0, jit: l.j ?? o.jit, flat: l.flat ?? o.flat, cols: o.cols, cen: o.cen, R: o.R, kLow: o.kLow, bias: o.bias, gain: o.gain, others: lobes.filter((_, j) => j !== i), inside: o.hide ?? 0.42, w: o.w }));
  if (lobes.some(l => l.n)) m.foliage(lobes, { disc: 5, seed: o.seed, cols: o.cols, centre: o.cen, radius: o.R, size: o.size, gain: o.gain, kLow: o.kLow, inside: 0.74, bias: o.bias, core: 0, cup: o.cup, w: o.sw });
  return m;
}

// ------------------------------------------------------------------ palms
// Washingtonia / Trachycarpus (palm_fan_*): a slender, slightly leaning trunk in rings of leaf scars with a shaggy dead skirt, and a head of palmate fronds at every angle: each a stalk with a fan of narrow, hanging
// leaflet blades that part towards the tips (young fronds stand up, old ones arch over and hang), so the outline is spiky and the sky shows between the blades.
function fanPalm(H, n, seed, o = {}) {
  const m = new Mini(), r = rnd(seed * 3.3), trunk = C(o.trunk ?? '#8a7c66'), trunk2 = C('#6a5d4a'), dead = C('#85774a'), g1 = C('#5a8530'), g2 = C('#86b240'), g3 = C('#6c9a38');
  const lean = [(r() - 0.5) * 0.12 * H, (r() - 0.5) * 0.12 * H], pts = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([lean[0] * t * t + (i ? (r() - 0.5) * 0.06 : 0), H * t, lean[1] * t * t]); }
  const top = pts[5];
  m.tube(pts, [0.34, 0.25, 0.21, 0.19, 0.18, 0.17], 5, trunk, { col2: trunk2, mot: 0.35, band: 0.12, seed, rot: 0.2, dark: 0.8, jit: 0.25 });
  for (let i = 0; i < 5; i++) {   // the dead skirt: old fronds hanging against the trunk under the head
    const a = i * TAU / 5 + r(), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, L = 1.4 + 1.0 * r();
    m.tri([top[0] + dx * 0.25, top[1] - 0.05, top[2] + dz * 0.25], [top[0] + dx * 0.55 + px * 0.34, top[1] - L, top[2] + dz * 0.55 + pz * 0.34], [top[0] + dx * 0.55 - px * 0.34, top[1] - L + 0.3, top[2] + dz * 0.55 - pz * 0.34], dead, 0.85, [dx, 0, dz], 0.6);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed, ring = i % 3, el = [1.05, 0.4, -0.2][ring] + (r() - 0.5) * 0.3, ce = Math.cos(el), se = Math.sin(el), Ls = (ring === 0 ? 1.0 : 1.7) + 0.5 * r(), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const P = [top[0] + dx * ce * Ls, top[1] + 0.2 + se * Ls - (ring ? 0.4 : 0), top[2] + dz * ce * Ls], mid = lerp([top[0], top[1] + 0.2, top[2]], P, 0.5);
    mid[1] += 0.35 * Ls * (ring === 2 ? 0.2 : 1);
    const col = ring === 0 ? g2 : ring === 1 ? g3 : g1, bl = (ring === 0 ? 1.7 : 2.3) + 0.5 * r(), fan = 1.7 + 0.3 * r(), hub = [P[0], P[1], P[2]];
    m.tri([mid[0] + px * 0.05, mid[1], mid[2] + pz * 0.05], [hub[0] + px * 0.04, hub[1], hub[2] + pz * 0.04], [hub[0] - px * 0.04, hub[1], hub[2] - pz * 0.04], C('#6a7a3a'), 1, [px, 0.2, pz], 0.5);
    const M = 7;
    for (let j = 0; j < M; j++) {
      const f = (j / (M - 1) - 0.5) * fan, ang = a + f, w = 0.5 + 0.5 * Math.cos(f * 1.6), L = bl * (0.62 + 0.45 * w) * (0.88 + 0.24 * r()), cx = Math.cos(ang), cz = Math.sin(ang);
      const up = ring === 0 ? 0.6 : ring === 1 ? 0.05 : -0.35, tip = [hub[0] + cx * L * (ring === 0 ? 0.55 : 1), hub[1] + up * L * 0.5 - (ring === 0 ? 0.25 : 0.7) * L * (0.4 + 0.6 * Math.abs(f) / (fan * 0.5)), hub[2] + cz * L * (ring === 0 ? 0.55 : 1), 1];
      const sd = 0.24 + 0.07 * r(), tx = -Math.sin(ang), tz = Math.cos(ang);
      const b0 = [hub[0] + tx * sd, hub[1], hub[2] + tz * sd, 0.85], b1 = [hub[0] - tx * sd, hub[1], hub[2] - tz * sd, 0.85];
      m.tri(b0, tip, b1, j & 1 ? col : tint(col, 1.1, 1.08, 0.95), 0.85 + 0.3 * r(), [0.35 * cx, 1, 0.35 * cz], 0.9);
    }
  }
  return m.geo();
}
// Phoenix canariensis (palm_date_*): a thick trunk with a swelling under the crown and a big dense head of long, arching feather fronds, each a curved midrib with two rows of narrow leaflets (the lower fronds hang down)
function datePalm(H, n, seed) {   // (n fronds)
  const m = new Mini(), r = rnd(seed * 2.9), trunk = C('#9a8662'), trunk2 = C('#74644a'), c1 = C('#5c8a32'), c2 = C('#97bb52'), c3 = C('#709a40');
  const lx = (r() - 0.5) * 0.1 * H, lz = (r() - 0.5) * 0.1 * H, pts = [0, 1, 2, 3, 4].map(i => [lx * (i / 4) ** 2, H * i / 4, lz * (i / 4) ** 2]);
  m.tube(pts, [0.6, 0.5, 0.46, 0.44, 0.5], 7, trunk, { col2: trunk2, mot: 0.45, seed, band: 0.16, dark: 0.8, jit: 0.3 });
  m.tube([[pts[4][0], H - 0.1, pts[4][2]], [pts[4][0], H + 0.4, pts[4][2]]], [0.56, 0.5], 7, C('#6c5a3a'), { seed, cap: true, dark: 0.9 });
  const top = [pts[4][0], H + 0.4, pts[4][2]];
  // the fronds: every one a curved ribbon of quads whose two edges are cut in a sawtooth (the leaflets of a feather frond, as a solid blade with a notched edge: 10 triangles instead of a comb of 20), young ones upright, old ones arching over and hanging
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed, ring = [0, 1, 2, 3, 2, 1][i % 6], dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, cc = ring === 0 ? c2 : ring === 1 ? c3 : c1, c4 = tint(cc, 1.12, 1.1, 0.9);
    const L = 4.8 + 0.9 * r() - (ring === 0 ? 1.0 : 0), lift = [5.0, 5.0, 4.4, 3.8][ring] + 0.4 * r(), grav = [3.0, 4.0, 4.6, 5.0][ring] + 0.4 * r(), out = [0.5, 0.8, 1, 1.05][ring], Wm = (ring === 0 ? 1.3 : 1.9) + 0.3 * r();
    const at = t => [top[0] + dx * L * out * t, top[1] + 0.1 + lift * t - grav * t * t, top[2] + dz * L * out * t];
    const ST = 6, ls = [], rs = [];
    for (let s = 0; s <= ST; s++) {
      const q = at(0.08 + 0.92 * s / ST), hw = Wm * (s === 0 ? 0.12 : Math.sin(Math.PI * (0.12 + 0.78 * s / ST))), dr = 0.8 * hw;   // (the edges hang below the midrib: a V)
      ls.push([q[0] + px * hw * (s & 1 ? 1.1 : 0.3), q[1] - dr, q[2] + pz * hw * (s & 1 ? 1.1 : 0.3), 0.9]); rs.push([q[0] - px * hw * (s & 1 ? 0.3 : 1.1), q[1] - dr, q[2] - pz * hw * (s & 1 ? 0.3 : 1.1), 0.9]);
    }
    for (let s = 0; s < ST; s++) { const col = s & 1 ? c4 : cc, k = 1.3 + 0.2 * r(); m.tri(ls[s], rs[s], rs[s + 1], col, k, [0.3 * dx, 1, 0.3 * dz], 0.9).tri(ls[s], rs[s + 1], ls[s + 1], col, k, [0.3 * dx, 1, 0.3 * dz], 0.9); }
  }
  return m.geo();
}

const cache = {};
const BUILD = {
  // Platanus x acerifolia: a tall pale mottled trunk that forks high into big limbs, and a broad round crown of bright yellowish-green lumps with the sky between them
  plane(v = 0) {   // v: the second individual (another trunk, another number of limbs, another crown), so a row of planes is not one tree repeated
    const m = new Mini(), bark = C('#a8a28e'), bark2 = C('#7f7a66');
    const trunk = v ? [[0, 0, 0], [-0.35, 2.4, 0.2], [-0.2, 4.7, 0.45]] : [[0, 0, 0], [0.18, 2.6, 0.0], [0.05, 5.2, 0.1]];
    m.tube(trunk, [0.44, 0.34, 0.28], 6, bark, { col2: bark2, mot: 0.38, seed: 8 + v, dark: 0.8, jit: 0.15 });
    const tips = boughs(m, trunk[2], [0, 1, 0], v ? 3.4 : 3.0, 0.24, { levels: 3, fan: 1, kids: lv => lv === 0 ? (v ? 3 : 4) : 2, fork0: v ? 0.7 : 0.62, fork: 0.55, shrink: 0.72, up: 0.3, wob: 0.35, col: bark, col2: bark2, mot: 0.3, nseg: [2, 2, 1], segs: [5, 4, 3] }, 23 + 40 * v);
    const L = tips.slice(0, v ? 5 : 6).map((t, i) => ({ c: [t.p[0] + t.d[0] * 0.5, t.p[1] + 1.0 + t.d[1] * 0.3, t.p[2] + t.d[2] * 0.5], r: [3.5 + 0.4 * (i & 1), 2.6, 3.5 + 0.4 * (i & 1)], n: 2, d: i < 2 ? 1 : 0 }));
    L.push({ c: [0.1, v ? 10.4 : 10.0, 0], r: [3.4, 2.4, 3.4], n: 2, d: 1 });
    crown(m, L, { seed: 14 + 17 * v, cols: ['#648c48', '#6e9650', '#5a8340', '#779d54'].map(C), cen: [0.1, 8.6, 0], R: [6.3, 3.9, 6.3], size: 0.95, kLow: 0.55, gain: 1.1, inside: 0.62, bias: 0.55 });
    return m.geo();
  },
  // Pinus pinea: a tall straight trunk, orange-brown in plates, that rises bare to 9 m and spreads into a few stout limbs, and a wide, flat-topped umbrella of dark green clouds with the sky between
  stone(v = 0) {
    const m = new Mini(), bark = C('#665040'), bark2 = C('#4b392e'), r = rnd(6 + v);
    const trunk = v ? [[0, 0, 0], [-0.3, 3.0, 0.2], [-0.7, 6.0, 0.4], [-0.5, 8.3, 0.3]] : [[0, 0, 0], [0.2, 3.0, 0.05], [0.4, 6.0, -0.05], [0.3, 9.0, 0.05]];
    m.tube(trunk, [0.5, 0.38, 0.31, 0.27], 6, bark, { col2: bark2, mot: 0.4, seed: 4 + v, dark: 0.6, jit: 0.3 });
    const top = trunk[3], pads = v ? [[-0.6, 10.0, 0.3, 4.3, 2.3, 4.0], [-4.3, 9.1, 1.0, 3.1, 1.8, 3.0], [3.5, 9.5, -1.6, 3.3, 1.9, 3.2]] : [[0.3, 10.8, 0.2, 4.7, 2.4, 4.4], [4.2, 10.0, 1.6, 3.3, 1.9, 3.2], [-3.9, 10.2, -1.6, 3.5, 2.0, 3.3], [0.4, 9.9, -4.3, 3.0, 1.8, 2.9]];
    const L = pads.map(([x, y, z, rx, ry, rz], i) => { m.tube([top, [x * 0.7, y - 1.2, z * 0.7]], [0.27, 0.12], 4, bark, { seed: 11 + x, dark: 0.8 }); return { c: [x, y, z], r: [rx, ry, rz], n: 2, d: i < 1 ? 1 : 0, flat: 0.5 }; });
    crown(m, L, { seed: 12 + v, cols: ['#2b4a2b', '#33563a', '#2e5033', '#37593b'].map(C), cen: [0.2, 10.2, 0], R: [6.4, 3.0, 6.4], size: 1.1, kLow: 0.6, gain: 1.0, inside: 0.7, bias: 0.6, jit: 0.42 });
    return m.geo();
  },
  // Ficus macrophylla / magnolioides (the big dark trees of the squares and the avenues): a huge fluted trunk on flaring buttress roots that splits at once into heavy limbs, a very wide, dense, dark dome, aerial roots hanging
  ficus() {
    const m = new Mini(), bark = C('#6b5e4e'), bark2 = C('#4f463a'), r = rnd(41);
    m.tube([[0, 0, 0], [0.1, 1.5, 0], [0, 3.0, 0.1]], [1.25, 0.95, 0.75], 8, bark, { col2: bark2, mot: 0.4, seed: 2, flute: 0.16, dark: 0.7 });
    const nf = 7;
    for (let i = 0; i < nf; i++) {   // buttress roots: thin wedges that run up the trunk and out over the ground
      const a = TAU * i / nf + r() * 0.5, h = 1.5 + 1.3 * r(), out = 1.9 + 1.1 * r(), w = 0.22 + 0.16 * r(), ca = Math.cos(a), sa = Math.sin(a);
      const T = [ca * 0.95, h, sa * 0.95], O = [ca * out, 0.0, sa * out], S1 = [ca * 1.15 - sa * w, 0, sa * 1.15 + ca * w], S2 = [ca * 1.15 + sa * w, 0, sa * 1.15 - ca * w];
      m.tri(T, S1, O, bark2, 0.9, [ca, 0.4, sa], 0.7).tri(T, O, S2, bark2, 0.8, [ca, 0.4, sa], 0.7);
    }
    const tips = boughs(m, [0, 2.9, 0], [0, 1, 0], 3.0, 0.62, { levels: 2, fan: 1, kids: 5, fork0: 1.15, fork: 1.0, shrink: 0.9, up: 0.12, wob: 0.3, col: bark, col2: bark2, mot: 0.3, nseg: 2, segs: [6, 4] }, 41);
    const L = tips.map((t, i) => ({ c: [t.p[0] + t.d[0] * 1.5, t.p[1] + 1.5, t.p[2] + t.d[2] * 1.5], r: [4.2, 2.8, 4.2], n: 1, d: i < 2 ? 1 : 0 }));
    L.push({ c: [0, 8.2, 0], r: [4.0, 2.7, 4.0], n: 1, d: 1 });
    for (let i = 0; i < 3; i++) { const t = tips[i * 2 % tips.length], x = t.p[0] + t.d[0] * 0.5, z = t.p[2] + t.d[2] * 0.5; m.tube([[x, t.p[1], z], [x * 1.02, 2.2, z * 1.02]], [0.08, 0.05], 4, bark2, { seed: 5 + i, dark: 0.9 }); }
    crown(m, L, { seed: 21, cols: ['#2f4a24', '#385a2b', '#2b4421', '#3b5d2d', '#33522a'].map(C), cen: [0, 6.8, 0], R: [8.0, 3.8, 8.0], size: 1.15, gain: 0.95, kLow: 0.55, inside: 0.6, bias: 0.5 });
    return m.geo();
  },
  // Quercus ilex and the other dark broadleaves of the Favorita (holm oak, carob, eucalyptus): a short thick forked trunk and a big, dense, very dark lobed dome that meets the next one along an avenue (the tunnel of Viale Diana)
  holm(v = 0) {   // v: the second individual: a leaning trunk that forks lower into three heavy limbs
    const m = new Mini(), bark = C('#4a4036'), bark2 = C('#352d26');
    const trunk = v ? [[0, 0, 0], [-0.4, 1.6, 0.2], [-0.6, 3.1, 0.3]] : [[0, 0, 0], [0.08, 1.8, 0], [0.1, 3.6, 0]];
    m.tube(trunk, [0.55, 0.42, 0.34], 6, bark, { col2: bark2, mot: 0.4, seed: 5 + v, dark: 0.7 });
    const tips = boughs(m, trunk[2], [0, 1, 0], v ? 2.4 : 2.7, 0.3, { levels: 2, fan: 1, kids: v ? 3 : 4, fork0: v ? 1.1 : 0.95, fork: 0.85, shrink: 0.78, up: 0.25, wob: 0.3, col: bark, col2: bark2, mot: 0.3, nseg: 2, segs: [5, 4] }, 61 + 20 * v);
    const L = tips.slice(0, 4).map((t, i) => ({ c: [t.p[0] + t.d[0] * 0.8, t.p[1] + 1.4, t.p[2] + t.d[2] * 0.8], r: [3.0, 2.5, 3.0], n: 2, d: i < 2 ? 1 : 0 }));
    L.push({ c: [v ? -0.4 : 0.1, v ? 7.0 : 7.6, 0], r: [3.1, 2.4, 3.1], n: 2, d: 1 });
    crown(m, L, { seed: 51 + v, cols: ['#24391f', '#2b4526', '#2e4a2f', '#213519', '#30492c'].map(C), cen: [0.1, 6.6, 0], R: [5.0, 3.4, 5.0], size: 1.1, gain: 0.95, kLow: 0.6, inside: 0.62, bias: 0.55 });
    return m.geo();
  },
  holm_b() { return this.holm(1); },
  // a generic broadleaf (carob, olive, jacaranda): a slim forked trunk and a rounder, smaller crown (the species tint of src/species.js turns it into each)
  tree() {
    const m = new Mini(), bark = C('#6e5a44'), bark2 = C('#52422f');
    m.tube([[0, 0, 0], [0.1, 1.5, 0], [0.1, 2.8, 0]], [0.26, 0.2, 0.17], 5, bark, { col2: bark2, mot: 0.35, seed: 7 });
    const tips = boughs(m, [0.1, 2.7, 0], [0, 1, 0], 1.9, 0.14, { levels: 2, fan: 1, kids: 3, fork0: 0.8, fork: 0.75, shrink: 0.7, up: 0.25, wob: 0.3, col: bark, nseg: 2, segs: [4, 4] }, 71);
    const L = tips.slice(0, 3).map((t, i) => ({ c: [t.p[0] + t.d[0] * 0.6, t.p[1] + 0.9, t.p[2] + t.d[2] * 0.6], r: [1.9, 1.6, 1.9], n: 3, d: i === 0 ? 1 : 0 }));
    L.push({ c: [0.1, 5.4, 0], r: [1.9, 1.5, 1.9], n: 3, d: 0 });
    crown(m, L, { seed: 31, cols: ['#587e3a', '#648a40', '#527a38'].map(C), cen: [0, 4.8, 0], R: [3.2, 2.5, 3.2], size: 1.0, kLow: 0.55, inside: 0.62, bias: 0.5 });
    return m.geo();
  },
  // Nerium oleander: an upright vase-shaped clump of dark grey-green narrow leaves with pink flower clusters (the shrub of the medians and the verges): two stacked lobes, a few leaf sprays on the outline, flowers on the shell
  oleander() {
    const m = new Mini(), r = rnd(77), pink = ['#e0668c', '#ee86a6', '#d4547c'].map(C);
    const L = [{ c: [0, 0.6, 0], r: [1.0, 1.1, 1.0], d: 0, n: 3, flat: 0.55 }, { c: [0.12, 1.6, 0.06], r: [0.8, 0.95, 0.8], d: 0, n: 3, flat: 0.6 }];
    crown(m, L, { seed: 77, cols: ['#4c6e3c', '#58793f', '#42643a', '#5f8244'].map(C), cen: [0.05, 1.4, 0.03], R: [1.1, 1.6, 1.1], size: 0.6, kLow: 0.6, inside: 0.7, bias: 0.5, jit: 0.4, gain: 1.15 });
    for (let i = 0; i < 6; i++) {   // flower clusters: small bright triangles on the outside of the upper lobe
      const lb = L[i < 4 ? 1 : 0], a = i * 2.4 + r(), y = 0.25 + 0.7 * r(), rr = Math.sqrt(1 - y * y), q = 0.24 + 0.08 * r();
      const p = [lb.c[0] + Math.cos(a) * rr * lb.r[0] * 1.02, lb.c[1] + y * lb.r[1], lb.c[2] + Math.sin(a) * rr * lb.r[2] * 1.02], nx = Math.cos(a) * rr, nz = Math.sin(a) * rr;
      m.tri([p[0] - nz * q, p[1] - q * 0.5, p[2] + nx * q], [p[0] + nz * q, p[1] - q * 0.4, p[2] - nx * q], [p[0] + nx * q * 0.6, p[1] + q, p[2] + nz * q * 0.6], pink[i % 3], 1.2, [nx, 0.5, nz], 0.6);
    }
    return m.geo();
  },
  // Jacaranda mimosifolia (Via Ruggero Settimo, the squares of the old avenues in June): a spreading, slightly flat crown of light feathery green that is half lilac with blossom
  jacaranda() {
    const m = new Mini(), bark = C('#6b5d50'), bark2 = C('#4f443a');
    m.tube([[0, 0, 0], [-0.15, 1.8, 0.1], [-0.05, 3.4, 0.25]], [0.32, 0.25, 0.2], 5, bark, { col2: bark2, mot: 0.35, seed: 13 });
    const tips = boughs(m, [-0.05, 3.3, 0.25], [0, 1, 0], 2.4, 0.17, { levels: 2, fan: 1, kids: 3, fork0: 0.85, fork: 0.7, shrink: 0.7, up: 0.2, wob: 0.35, col: bark, nseg: 2, segs: [4, 4] }, 83);
    const L = tips.slice(0, 3).map((t, i) => ({ c: [t.p[0] + t.d[0] * 0.8, t.p[1] + 0.9, t.p[2] + t.d[2] * 0.8], r: [2.8, 1.8, 2.8], n: 3, d: i < 2 ? 1 : 0, flat: 0.5 }));
    L.push({ c: [0, 6.8, 0], r: [2.6, 1.6, 2.6], n: 3, d: 1, flat: 0.5 });
    crown(m, L, { seed: 33, cols: ['#b9a6dc', '#a891d2', '#c4b4e4', '#9d88cc', '#8fb066', '#a2c27a'].map(C), cen: [0, 6.2, 0], R: [4.2, 2.5, 4.2], size: 0.9, kLow: 0.68, gain: 1.15, inside: 0.62, bias: 0.5 });
    return m.geo();
  },
  // bitter orange / citrus street tree: short trunk, small dense round crown with a few fruit
  orange() {
    const m = new Mini();
    m.tube([[0, 0, 0], [0, 1.0, 0], [0, 1.9, 0]], [0.16, 0.13, 0.1], 4, C('#5b4a3a'), { seed: 9 });
    crown(m, [{ c: [0, 3.0, 0], r: [1.7, 1.4, 1.7], d: 1 }, { c: [0.9, 2.5, 0.5], r: [0.9, 0.8, 0.9], d: 0 }, { c: [-0.8, 2.6, -0.5], r: [0.9, 0.8, 0.9], d: 0 }], { seed: 41, cols: ['#46703a', '#527c40', '#3f6a34'].map(C), cen: [0, 3.0, 0], R: [1.9, 1.5, 1.9], size: 0.8, kLow: 0.55, inside: 0.6, bias: 0.6 });
    for (const [x, y, z] of [[1.5, 2.9, 0.7], [-1.2, 3.5, 1.0], [0.3, 4.0, -1.2], [-0.6, 2.5, -1.4]]) m.tri([x - 0.2, y, z], [x + 0.2, y, z], [x, y + 0.22, z + 0.05], C('#e48a1c'), 1.1, [x, 0.3, z], 0.8);   // a few oranges: small bright triangles on the outside of the crown
    return m.geo();
  },
  // Pinus halepensis: a slender, often leaning grey-red trunk and a thin, irregular crown in light olive-green with the sky showing between the tufts of needles
  aleppo(lo) {   // lo: the cheaper one the woods of the tiles are planted with (src/world.js); the full one stands along roads and as single props
    const m = new Mini(), bark = C('#7b5c48'), bark2 = C('#5e4636');
    const tips = [], trunk = lo ? [[0, 0, 0], [0.55, 3.0, 0.1], [0.95, 6.0, 0.3]] : [[0, 0, 0], [0.35, 2.2, 0.05], [0.6, 4.2, 0.2], [0.95, 6.0, 0.3]];
    m.tube(trunk, lo ? [0.32, 0.22, 0.12] : [0.34, 0.26, 0.2, 0.12], lo ? 4 : 5, bark, { col2: bark2, mot: 0.35, seed: 3, dark: 0.7 });
    if (lo) tips.push(trunk[2], [-1.3, 5.2, -0.4]);
    else {
      for (const [p, d, L] of [[trunk[2], [0.75, 0.55, 0.2], 2.6], [trunk[1], [-0.8, 0.55, -0.3], 2.8], [trunk[3], [0.2, 0.9, -0.5], 1.6]]) { const e = add(p, mul(norm(d), L)); m.tube([p, e], [0.13, 0.06], 4, bark, { seed: 7 }); tips.push(e); }
      tips.push(trunk[3]);
    }
    // thin, flat, slightly ragged pads at the ends of the branches: the sky shows between them
    const L = tips.map((p, i) => ({ c: [p[0], p[1] + 0.45, p[2]], r: [(lo ? 2.1 : 1.9) - 0.25 * (i & 1), 0.8, lo ? 2.0 : 1.8], n: lo ? 2 : 3, flat: 0.45 }));
    crown(m, L, { seed: 9, cols: ['#718f42', '#678640', '#779545', '#7e9b4a'].map(C), cen: [0.4, 6.0, 0.1], R: [3.2, 2.2, 3.2], size: lo ? 1.3 : 1.0, gain: 1.0, kLow: 0.65, bias: 0.4, cup: 0.45, jit: 0.45 });
    return m.geo();
  },
  plane_b() { return this.plane(1); },
  // the same plane in winter, and as the street planes of Via Ernesto Basile and Viale Michelangelo are in the photos: no leaves, big pale limbs that fork and fork again, a broom of twigs on every end
  plane_bare(v = 0) {
    const m = new Mini(), bark = C('#9a9582'), bark2 = C('#6f6a58'), twig = C('#5f5849');
    const trunk = v ? [[0, 0, 0], [-0.2, 1.5, 0.2], [-0.05, 2.9, 0.25]] : [[0, 0, 0], [0.1, 1.6, 0.0], [0.0, 3.2, 0.1]];
    m.tube(trunk, [0.52, 0.4, 0.34], 7, bark, { col2: bark2, mot: 0.38, seed: 8, dark: 0.7, jit: 0.2 });
    boughs(m, trunk[2], [0, 1, 0], 2.9, 0.36, { levels: 3, fan: 1, kids: lv => lv === 0 ? (v ? 5 : 4) : (v ? 2 : 3), fork0: v ? 0.7 : 0.62, fork: 0.85, shrink: 0.75, up: 0.3, wob: 0.4, col: bark, col2: twig, mot: 0.25, nseg: 2, segs: [5, 5, 4], twig: 1.5, twigN: 7 }, 23 + 40 * v);
    return m.geo();
  },
  plane_bare_b() { return this.plane_bare(1); },
  aleppo_lo() { return this.aleppo(1); },
  // the cheap shapes the woods of the tiles are planted with (src/world.js): a trunk and three solid lobes, 90 to 120 triangles
  stone_lo() {
    const m = new Mini(), bark = C('#665040'), bark2 = C('#4b392e');
    m.tube([[0, 0, 0], [0.4, 5.0, 0], [0.3, 8.3, 0.05]], [0.46, 0.32, 0.26], 4, bark, { col2: bark2, mot: 0.4, seed: 4, dark: 0.6, jit: 0.3 });
    crown(m, [[0.2, 9.6, 0.2, 4.4, 1.9, 4.2], [3.9, 9.1, 1.7, 3.2, 1.5, 3.1], [-3.7, 9.3, -1.7, 3.4, 1.5, 3.2]].map(([x, y, z, rx, ry, rz]) => ({ c: [x, y, z], r: [rx, ry, rz], n: 2, flat: 0.5 })), { seed: 12, cols: ['#2b4a2b', '#33563a', '#2e5033', '#37593b'].map(C), cen: [0.2, 9.4, 0], R: [5.8, 2.6, 5.8], size: 1.5, gain: 0.95, kLow: 0.62, bias: 0.6, jit: 0.42 });
    return m.geo();
  },
  holm_lo() {
    const m = new Mini(), bark = C('#4a4036'), bark2 = C('#352d26');
    m.tube([[0, 0, 0], [0.1, 3.6, 0]], [0.5, 0.32], 4, bark, { col2: bark2, mot: 0.4, seed: 5, dark: 0.7 });
    crown(m, [[2.0, 6.0, 0.6, 2.8, 2.2, 2.7], [-1.8, 6.3, -0.9, 2.7, 2.2, 2.6], [0.2, 7.6, 0, 2.8, 2.1, 2.7]].map(([x, y, z, rx, ry, rz]) => ({ c: [x, y, z], r: [rx, ry, rz], n: 2 })), { seed: 51, cols: ['#24391f', '#2b4526', '#2e4a2f', '#213519', '#30492c'].map(C), cen: [0.1, 6.8, 0], R: [5, 3.3, 5], size: 1.4, gain: 0.95, kLow: 0.6, bias: 0.55 });
    return m.geo();
  },
  stone_b() { return this.stone(1); },
  palm_fan_a() { return fanPalm(9, 20, 1); },
  palm_fan_b() { return fanPalm(13, 21, 2); },
  palm_fan_c() { return fanPalm(6.5, 17, 3); },
  palm_date_a() { return datePalm(5, 19, 1); },
  palm_date_b() { return datePalm(7.5, 20, 2); },
};

export const treeGeo = name => cache[name] || (cache[name] = BUILD[name]());
