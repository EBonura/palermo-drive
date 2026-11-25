// The number work of a terrain tile's vertices (src/world.js terrainMesh): slope and normal from the ground heights, the colour (height, slope, road bench, land cover, paving, yards, the orthophoto's tint) and the
// pavement, yard and road weights of each vertex of the grid. It runs in a pool worker (src/work-pool.js), so it uses no THREE and reads no game state: everything it needs comes in the payload, and it is the same
// arithmetic, in the same order, as the loop it replaced (a THREE.Color is three numbers and lerp, copy and multiplyScalar are one line each), so the arrays it returns are the same bytes.
// What stays on the main thread: the ground heights (they come from closures over the streamed tiles, the bridges, the quays: terrainMesh samples them into the payload), the paving and road distance fields,
// and everything after the grid (skirt, indices, the tunnel cuts, the geometry).
// payload: n (vertices a side), step, x0, z0, urban, uvs (uv per metre), lat (Float64Array, (n + 2) a side: the ground at every vertex and one ring round the grid, so a vertex's neighbours a step away are its neighbours in the lattice), lowY (the vertices' own heights when they were taken from lower ground, else null), rdf and pvf (the fields,
// or null), tint (land cover polygons, see tintFlat in world.js), pavez (landmark paving polygons, same shape), gt (the orthophoto tint, 25 x 25 x 2 nibbles, or null) with gtSt, gr (the garden region),
// hist (the two radii of histW in src/streets.js), pal (the palette, 3 numbers each, in PALETTE order)
export const PALETTE = ['shore', 'sand', 'plain', 'grove', 'dry', 'scrub', 'rockLo', 'rock', 'cut', 'urban', 'garden', 'pave', 'yard', 'shoulder'];
const PV_C = 5;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const inPoly = (f, x, z) => { let c = false; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const xi = f[i], zi = f[i + 1], xj = f[j], zj = f[j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const paveAt = (f, a, x, z) => {
  const fx = Math.min(f.n - 1.001, Math.max(0, (x - f.x0) / PV_C)), fz = Math.min(f.n - 1.001, Math.max(0, (z - f.z0) / PV_C)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, q = j * f.n + i;
  return (a[q] * (1 - tx) + a[q + 1] * tx) * (1 - tz) + (a[q + f.n] * (1 - tx) + a[q + f.n + 1] * tx) * tz;
};
const roadAt = (f, x, z) => paveAt(f, f.dist, x, z);   // the same bilinear read of its own field (src/world.js roadAt)

// a colour: three numbers, with the three operations of THREE.Color the loop used
const col = (r = 0, g = 0, b = 0) => ({ r, g, b });
const copy = (o, c) => { o.r = c.r; o.g = c.g; o.b = c.b; return o; };
const lerp = (o, c, a) => { o.r += (c.r - o.r) * a; o.g += (c.g - o.g) * a; o.b += (c.b - o.b) * a; return o; };
const scale = (o, s) => { o.r *= s; o.g *= s; o.b *= s; return o; };

// ---- the distance fields (src/world.js paveFieldIter and roadFieldIter), made from the flattened rings and roads of the tile and its eight neighbours: { xy, off } is every ring (or road line) one after another,
// off the start of each (and the end of the last). Seeds are cells set to 1 whatever the order, so the order of rings does not matter.
const PV_M = 50, RF_M = 30;
const chamfer = (sd, n, seeded = null) => {   // seeded: a distance array that already holds its zeros
  const dist = seeded || new Float32Array(n * n).fill(1e4), D2 = PV_C * Math.SQRT2;
  if (!seeded) for (let q = 0; q < n * n; q++) if (sd[q]) dist[q] = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i; let v = dist[q];
    if (i > 0) v = Math.min(v, dist[q - 1] + PV_C); if (j > 0) { v = Math.min(v, dist[q - n] + PV_C); if (i > 0) v = Math.min(v, dist[q - n - 1] + D2); if (i < n - 1) v = Math.min(v, dist[q - n + 1] + D2); }
    dist[q] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const q = j * n + i; let v = dist[q];
    if (i < n - 1) v = Math.min(v, dist[q + 1] + PV_C); if (j < n - 1) { v = Math.min(v, dist[q + n] + PV_C); if (i < n - 1) v = Math.min(v, dist[q + n + 1] + D2); if (i > 0) v = Math.min(v, dist[q + n - 1] + D2); }
    dist[q] = v;
  }
  return dist;
};
export function paveField(f) {
  const T = f.T, x0 = f.i * T - PV_M, z0 = f.j * T - PV_M, n = Math.round((T + 2 * PV_M) / PV_C) + 1, seed = new Uint8Array(n * n), seedR = new Uint8Array(n * n), x1 = x0 + (n - 1) * PV_C, z1 = z0 + (n - 1) * PV_C;
  let any = 0;
  const mark = (ax, az, bx, bz, sd) => {
    const len = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(len / (PV_C * 0.5)));
    for (let q = 0; q <= k; q++) {
      const x = ax + (bx - ax) * q / k, z = az + (bz - az) * q / k, i = Math.round((x - x0) / PV_C), j = Math.round((z - z0) / PV_C);
      if (i >= 0 && j >= 0 && i < n && j < n) { sd[j * n + i] = 1; any++; }
    }
  };
  const ring = (p, a, b, sd) => {   // p[a .. b): one ring, x and z in turn
    const m = (b - a) >> 1; if (m < 3) return;
    let lx = 1e9, hx = -1e9, lz = 1e9, hz = -1e9;
    for (let q = 0; q < m; q++) { const x = p[a + 2 * q], z = p[a + 2 * q + 1]; if (x < lx) lx = x; if (x > hx) hx = x; if (z < lz) lz = z; if (z > hz) hz = z; }
    if (hx < x0 || lx > x1 || hz < z0 || lz > z1) return;
    for (let q = 0; q < m; q++) { const r = (q + 1) % m; mark(p[a + 2 * q], p[a + 2 * q + 1], p[a + 2 * r], p[a + 2 * r + 1], sd); }
  };
  for (const o of f.rings) {
    if (!o) continue;
    for (let r = 0; r + 1 < o.b.off.length; r++) ring(o.b.xy, o.b.off[r], o.b.off[r + 1], seed);
    for (let r = 0; r + 1 < o.s.off.length; r++) ring(o.s.xy, o.s.off[r], o.s.off[r + 1], seedR);
  }
  if (!any) return null;
  const dist = chamfer(seed, n), dr = chamfer(seedR, n);
  const S = new Int32Array((n + 1) * (n + 1)), dens = new Float32Array(n * n), R = 9;
  for (let j = 0; j < n; j++) { let row = 0; for (let i = 0; i < n; i++) { row += seed[j * n + i]; S[(j + 1) * (n + 1) + i + 1] = S[j * (n + 1) + i + 1] + row; } }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - R), b = Math.min(n, i + R + 1), c = Math.max(0, j - R), e = Math.min(n, j + R + 1);
    dens[j * n + i] = (S[e * (n + 1) + b] - S[c * (n + 1) + b] - S[e * (n + 1) + a] + S[c * (n + 1) + a]) / ((b - a) * (e - c));
  }
  return { x0, z0, n, dist, dens, dr };
}
export function roadField(f) {
  const T = f.T, x0 = f.i * T - RF_M, z0 = f.j * T - RF_M, n = Math.round((T + 2 * RF_M) / PV_C) + 1, x1 = x0 + (n - 1) * PV_C, z1 = z0 + (n - 1) * PV_C, dist = new Float32Array(n * n).fill(1e4);
  let any = 0;
  for (const o of f.roads) {
    if (!o) continue;
    const p = o.xy;
    for (let r = 0; r + 1 < o.off.length; r++) for (let q = o.off[r]; q + 3 < o.off[r + 1]; q += 2) {
      const ax = p[q], az = p[q + 1], bx = p[q + 2], bz = p[q + 3];
      if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(az, bz) < z0 || Math.min(az, bz) > z1) continue;
      const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (PV_C * 0.5)));
      for (let u = 0; u <= k; u++) { const i = Math.round((ax + (bx - ax) * u / k - x0) / PV_C), j = Math.round((az + (bz - az) * u / k - z0) / PV_C); if (i >= 0 && j >= 0 && i < n && j < n) { dist[j * n + i] = 0; any++; } }
    }
  }
  if (!any) return null;
  return { x0, z0, n, dist: chamfer(null, n, dist) };
}

export function terrainTask(p) {
  const { n, step, x0, z0, urban, lat, lowY, tint, pavez, gt, gtSt, gr, hist } = p, nb = n * n, NL = n + 2;
  const pvf = p.pvf !== undefined ? p.pvf : paveField(p.fld), rdf = p.rdf !== undefined ? p.rdf : roadField(p.fld);
  const C = {}; PALETTE.forEach((k, i) => { C[k] = col(p.pal[i * 3], p.pal[i * 3 + 1], p.pal[i * 3 + 2]); });
  const _c = col(), _r = col();
  const cutBank = (out, road, steep, noise) => { copy(_r, C.cut); lerp(_r, C.scrub, 0.2 + noise * 0.5); return lerp(out, _r, road * steep * 0.85); };
  const terrainColor = (out, y, slope, noise, n2, road) => {
    if (y < 1.6) { copy(out, C.shore); lerp(out, C.sand, 0.25 * noise); return out; }
    const hill = smooth(55, 130, y), steep = smooth(0.14, 0.4, slope);
    copy(out, C.plain); lerp(out, C.grove, noise * 0.5); lerp(out, C.dry, n2 * 0.4);
    copy(_r, C.scrub); lerp(_r, C.dry, n2 * 0.4); lerp(_r, C.grove, noise * 0.2);
    lerp(out, _r, Math.max(hill, steep * 0.8));
    const rock = smooth(0.38, 0.85, slope) * (1 - 0.9 * road);
    if (rock > 0) {
      copy(_r, C.rockLo); lerp(_r, C.rock, Math.min(1, 0.35 + noise * 0.5 + smooth(120, 420, y) * 0.3)); scale(_r, 0.94 + 0.06 * Math.sin(y * 0.9));
      lerp(out, _r, rock);
    }
    return road > 0 ? cutBank(out, road, steep, noise) : out;
  };
  const outskirtsGrade = (c, k) => { if (k > 0) { const l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; scale(c, 1 - 0.4 * k); c.r += (l * 0.86 - c.r) * 0.4 * k; c.g += (l * 1.04 - c.g) * 0.4 * k; c.b += (l * 0.76 - c.b) * 0.4 * k; } return c; };
  const histW = (x, z) => { const t = Math.min(1, Math.max(0, (Math.hypot(x, z) - hist[0]) / (hist[1] - hist[0]))); return 1 - t * t * (3 - 2 * t); };
  const inGR = (x, z) => x > gr.x0 && x < gr.x1 && z > gr.z0 && z < gr.z1;
  const gtm = col();
  const tintAt = (x, z) => {   // src/world.js tintFn: a multiplier from the orthophoto's relative colours, 20 m cells
    const fx = Math.max(0, Math.min(23.999, (x - x0) / 20 - 0.5)), fz = Math.max(0, Math.min(23.999, (z - z0) / 20 - 0.5)), i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = (j * 25 + i) * 2;
    const l = (gt[k] * (1 - tx) + gt[k + 2] * tx) * (1 - tz) + (gt[k + 50] * (1 - tx) + gt[k + 52] * tx) * tz, w = (gt[k + 1] * (1 - tx) + gt[k + 3] * tx) * (1 - tz) + (gt[k + 51] * (1 - tx) + gt[k + 53] * tx) * tz;
    const f = Math.exp((l - 8) * 0.045), dw = (w - 8) * gtSt;
    gtm.r = Math.min(1.45, f * Math.exp(dw / 2)); gtm.g = f; gtm.b = Math.min(1.45, f * Math.exp(-dw / 2));
    return gtm;
  };
  const pos = new Float32Array(nb * 3), nor = new Float32Array(nb * 3), cl = new Float32Array(nb * 3), uv = new Float32Array(nb * 2), pav = new Float32Array(nb), yar = new Float32Array(nb), rda = new Float32Array(nb);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = j * n + i, x = x0 + i * step, z = z0 + j * step, k = v * 3, lk = (j + 1) * NL + i + 1, y = lowY ? lowY[v] : lat[lk], e = step;
      const dx = (lat[lk + 1] - lat[lk - 1]) / (2 * e), dz = (lat[lk + NL] - lat[lk - NL]) / (2 * e), l = Math.hypot(dx, 1, dz);
      pos[k] = x; pos[k + 1] = y - 0.2; pos[k + 2] = z; nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
      const noise = (Math.sin(x * 0.013 + z * 0.009) + Math.sin(x * 0.0037 - z * 0.013)) * 0.25 + 0.5;
      const n2 = (Math.sin(x * 0.061 + z * 0.043) + Math.sin(x * 0.027 - z * 0.071 + 1.7)) * 0.25 + 0.5, slope = Math.hypot(dx, dz);
      const road = rdf ? 1 - smooth(8, 26, roadAt(rdf, x, z)) : 0;
      rda[v] = road;
      terrainColor(_c, y, slope, noise, n2, road);
      if (urban > 0) lerp(_c, inGR(x, z) ? C.garden : C.urban, urban);
      let covered = false, coverK = '';
      if (tint) for (const a of tint) {
        if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 || !inPoly(a.poly, x, z)) continue;
        covered = true;
        lerp(_c, a.col, a.s);
        if (a.cover !== 'sand' && slope > 0.45) { copy(_r, C.rockLo); lerp(_r, C.rock, noise); lerp(_c, _r, smooth(0.45, 0.9, slope) * 0.8 * (1 - 0.9 * road)); if (road > 0) cutBank(_c, road, smooth(0.14, 0.4, slope), noise); }
        coverK = a.cover;
        break;
      }
      let zoned = false;
      for (const pz of pavez) if (x > pz.x0 - step && x < pz.x1 + step && z > pz.z0 - step && z < pz.z1 + step && inPoly(pz.poly, x, z)) { zoned = true; break; }
      if (zoned) { pav[v] = 1; lerp(_c, C.pave, 0.9); }
      else if (pvf && !covered && y > 1.6 && !inGR(x, z)) {
        const dw = paveAt(pvf, pvf.dist, x, z), dp = paveAt(pvf, pvf.dr, x, z);
        const w = (1 - smooth(28, 70, dw)) * smooth(0.06, 0.16, paveAt(pvf, pvf.dens, x, z)) * (1 - smooth(0.16, 0.34, slope)), hw = histW(x, z);
        const sl = Math.max(hw, (1 - smooth(2.5, 4.5, dp)) * (1 - smooth(5, 8, dw)));
        if (w * sl > 0.004) { pav[v] = w * sl; lerp(_c, C.pave, w * sl * 0.9); }
        if (w * (1 - sl) > 0.004) { yar[v] = w * (1 - sl); lerp(_c, C.yard, Math.min(1, w * (1 - sl) * 1.15)); }
      }
      if (gt) { const m = tintAt(x, z); _c.r *= m.r; _c.g *= m.g; _c.b *= m.b; }
      if (y > 1.6 && coverK !== 'sand' && coverK !== 'pitch' && pav[v] < 0.3) {
        if (rdf) lerp(_c, C.shoulder, (1 - smooth(4.5, 10, roadAt(rdf, x, z))) * (1 - smooth(0.1, 0.35, slope)) * 0.55);
        outskirtsGrade(_c, (1 - histW(x, z)) * (inGR(x, z) ? 0 : 1 - 0.5 * Math.min(1, urban / 0.8)));
      }
      cl[k] = _c.r; cl[k + 1] = _c.g; cl[k + 2] = _c.b;
      const q = v * 2; uv[q] = x * p.uvs; uv[q + 1] = z * p.uvs;
    }
  }
  const value = { pos, nor, col: cl, uv, pav, yar, rda, pvf, rdf };
  return { value, transfer: [pos, nor, cl, uv, pav, yar, rda, ...(pvf ? [pvf.dist, pvf.dens, pvf.dr] : []), ...(rdf ? [rdf.dist] : [])].map(a => a.buffer) };
}
