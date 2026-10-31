// Which context buildings get drawn: pure functions shared by src/context.js (runtime) and tools/build
// (which prunes context-data.js to the chosen rows so unused buildings are never downloaded).
// No imports on purpose: it runs in node too.

export const TRI_BUDGET = 270000;   // buildings; roads come on top (context total < 300k)

const signedArea = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

export function decodeBuildings(data) {
  const out = [];
  for (const row of data) {
    const ox = row[0], oz = row[1], pts = [];
    let cx = 0, cz = 0;
    for (let i = 4; i < row.length; i += 2) { const x = ox + row[i] / 10, z = oz + row[i + 1] / 10; pts.push([x, z]); cx += x; cz += z; }
    const n = pts.length;
    out.push({ ox, oz, h: row[2] / 2, k: row[3], pts, cx: cx / n, cz: cz / n, a: Math.abs(signedArea(pts)) });
  }
  return out;
}

// Replace a footprint by its minimum-area oriented rectangle (cheap far-field shape).
export function orientedBox(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    const ux = dx / L, uz = dz / L;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const r of pts) { const u = (r[0] - p[0]) * ux + (r[1] - p[1]) * uz, v = -(r[0] - p[0]) * uz + (r[1] - p[1]) * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) best = { A, p, ux, uz, u0, u1, v0, v1 };
  }
  if (!best) return pts;
  const { p, ux, uz, u0, u1, v0, v1 } = best;
  const at = (u, v) => [p[0] + u * ux - v * uz, p[1] + u * uz + v * ux];
  const r = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  return signedArea(r) < 0 ? r.reverse() : r;
}

export function triCost(nv) { return nv * 2 + (nv - 2); }


// Rank by size, height and distance from the playable box, turn far footprints into rectangles and keep
// buildings until the triangle budget is used up. Mutates `all` (adds d/far/prio, sorts) and returns the chosen ones.
export function chooseBuildings(all, budget = TRI_BUDGET) {
  for (const b of all) {
    const d = Math.hypot(b.cx - 20, b.cz + 70);
    b.d = d;
    b.far = d > 2600 ? 1 : 0;                       // far field gets rectangles
    b.prio = (Math.sqrt(b.a) + 4) * (b.h + 6) / (1 + Math.pow(d / 1100, 1.8));
  }
  all.sort((a, b) => b.prio - a.prio);
  const chosen = [];
  for (const b of all) {
    if (b.far && b.pts.length > 4) b.pts = orientedBox(b.pts);
    const c = triCost(b.pts.length);
    if (c > budget) { if (budget < 40) break; continue; }
    budget -= c; chosen.push(b);
  }
  return chosen;
}

// Back to the compact baked row [ox, oz, h*2, kind, dx0, dz0, ...] (decimetres from the origin).
export function encodeBuilding(b) {
  const row = [b.ox, b.oz, Math.round(b.h * 2), b.k];
  for (const p of b.pts) row.push(Math.round((p[0] - b.ox) * 10), Math.round((p[1] - b.oz) * 10));
  return row;
}
