// Guard rails of Palermo's fast roads (src/fences.js builds them as the `g` fences: 2.5 m panels, collision, breaking).
//
// What the data gives: OSM barrier=guard_rail ways are in tile.fences already (71 pieces, 1.9 km in the whole city: the data is thin). What it lacks is the rule: every motorway
// and trunk carriageway and its slip roads, and the one-way primary carriageways of Viale Regione Siciliana and the Palermo-Sciacca road (primary, maxspeed 70 or more), have a
// steel rail along both edges in the photos (po25, zi15, zi16, zi17, su09, su10, lm19 to lm23), double beam on the main carriageway, and one rail in the middle where two
// carriageways run side by side. So this reads the tile's roads and its asphalt (an exact raster, the same one src/roadwear.js uses) and returns extra `g` fences:
//   * the edge is where the asphalt ends (probed outward from the carriageway half width), the rail stands 0.9 m further out (1 m for the double beam);
//   * a rail never stands where another drivable road is within its half width and 1.2 m (so it never crosses a junction, a slip road, a service road or an exit), within
//     14 m of a bridge or tunnel of the same road, or where the asphalt goes on for more than 8 m (a neighbouring lane: nothing to stand on);
//   * two opposite one-way carriageways of one road with under 6 m between their edges get ONE rail in the middle (the lower way id builds it), otherwise each has its own;
//   * where OSM maps a guard rail or a concrete barrier within 3 m, that one stays and nothing is added.
// Design values, not data: the 0.9 m offset, the 14 m, the 7.5 m shortest run, the beam heights. ?noexpressway turns the rule off.
import { rasterMask } from './core.js';

const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noexpressway');
const CAR_W = { motorway: 8, motorway_link: 4.5, trunk: 9, trunk_link: 4.5, primary: 10, primary_link: 4.5, secondary: 9, secondary_link: 4.5, tertiary: 8, tertiary_link: 4.5, unclassified: 6, residential: 5.5, living_street: 4.5, service: 3.5, track: 3 };
const DRIVE = new Set(Object.keys(CAR_W));
const hh = Math.hypot, STEP = 2.5, CELL = 24, MINRUN = 7.5, CAP = 8, SHOULDER = 6.5, HARD = 2.4;
export const hwOf = r => (r.cw || CAR_W[r.k] || r.w || 6) / 2;
// how far from the centre line (x, z) along (nx, nz) the asphalt of the mask goes on, from the mapped half width hw: the edge, or a hard shoulder's worth past hw when the asphalt does not end (a service lane, a wide survey polygon)
export function probeEdge(mask, x, z, nx, nz, hw) {
  let e = hw; if (mask(x + nx * e, z + nz * e)) while (e < hw + CAP && mask(x + nx * e, z + nz * e)) e += 0.5;
  return e < hw + SHOULDER ? e : hw + HARD;
}
export const isExpressway = r => !r.tn && !r.br && r.j !== 'roundabout' && r.p && r.p.length >= 4 && (r.k === 'motorway' || r.k === 'trunk' || r.k === 'motorway_link' || r.k === 'trunk_link' || (r.k === 'primary' && (r.ms || 0) >= 70));

export function expresswayRails(data, fences) {
  const roads = data && data.roads; if (OFF || !roads || !roads.length) return [];
  const mains = []; roads.forEach((r, id) => { if (isExpressway(r)) mains.push(id); });
  const links = roads.map((r, id) => r.k === 'primary_link' && !r.tn && !r.br && r.p.length >= 4 ? id : -1).filter(id => id >= 0);
  if (!mains.length && !links.length) return [];
  // segment grid of every drivable road
  const grid = new Map(), segs = [];
  roads.forEach((r, id) => {
    if (!DRIVE.has(r.k) || !r.p || r.p.length < 4) return;
    const hw = hwOf(r);
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const s = { x0: r.p[i], z0: r.p[i + 1], x1: r.p[i + 2], z1: r.p[i + 3], hw, id, st: r.tn || r.br ? 1 : 0 }; segs.push(s);
      for (let a = Math.floor(Math.min(s.x0, s.x1) / CELL); a <= Math.floor(Math.max(s.x0, s.x1) / CELL); a++)
        for (let b = Math.floor(Math.min(s.z0, s.z1) / CELL); b <= Math.floor(Math.max(s.z0, s.z1) / CELL); b++) { const k = a * 100003 + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s); }
    }
  });
  const near = (x, z) => { const r = [], ci = Math.floor(x / CELL), cj = Math.floor(z / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get((ci + a) * 100003 + cj + b); if (l) for (const s of l) if (!r.includes(s)) r.push(s); } return r; };
  const distSeg = (x, z, s) => { const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l2 = dx * dx + dz * dz, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.x0) * dx + (z - s.z0) * dz) / l2)) : 0; return hh(s.x0 + dx * t - x, s.z0 + dz * t - z); };
  // links of Viale Regione Siciliana (primary_link) count when one end touches an expressway carriageway
  const linkOk = new Set(links.filter(id => { const p = roads[id].p; return [[p[0], p[1]], [p[p.length - 2], p[p.length - 1]]].some(([x, z]) => near(x, z).some(s => mains.includes(s.id) && distSeg(x, z, s) < 6)); }));
  const ids = mains.concat([...linkOk]), isMain = new Set(ids), stSegs = segs.filter(s => s.st);
  const st = data.streets || {}, aoi = st.aoi;
  if (!ids.length || !aoi) return [];
  const mask = rasterMask([st.asphalt || []], aoi, 2);
  // the OSM rails and barriers already in the tile
  const have = new Map();
  for (const f of fences || []) if (f.k === 'g' || f.k === 'j') {
    const p = f.p; for (let i = 0; i + 1 < p.length; i += 2) { const k = Math.floor(p[i] / 6) * 100003 + Math.floor(p[i + 1] / 6); let l = have.get(k); if (!l) have.set(k, l = []); l.push(p[i], p[i + 1]); }
  }
  const haveNear = (x, z) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = have.get((Math.floor(x / 6) + a) * 100003 + Math.floor(z / 6) + b); if (l) for (let i = 0; i < l.length; i += 2) if (hh(l[i] - x, l[i + 1] - z) < 3) return true; } return false; };
  const mate = (a, b) => a.k === b.k && (a.n || '') === (b.n || '');
  const out = [];
  for (const id of ids) {
    const r = roads[id], hw0 = hwOf(r), main = r.k === 'motorway' || r.k === 'trunk' || r.k === 'primary', dbl = main;
    // centre samples every STEP m along the line, with the tangent (averaged at the corners)
    const C = []; let base = 0, nextAt = 0;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3], L = hh(bx - ax, bz - az); if (L < 0.05) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      for (; nextAt < base + L; nextAt += STEP) { const u = nextAt - base; C.push({ x: ax + tx * u, z: az + tz * u, tx, tz }); }
      base += L;
    }
    if (C.length < 4) continue;
    for (let i = 1; i + 1 < C.length; i++) { const a = C[i - 1], b = C[i + 1], dx = a.tx + b.tx, dz = a.tz + b.tz, l = hh(dx, dz) || 1; C[i].tx = dx / l; C[i].tz = dz / l; }
    const n = C.length;
    for (const side of [1, -1]) {
      // asphalt edge per sample (probed outwards), smoothed
      const E = C.map(c => {
        const nx = -c.tz * side, nz = c.tx * side; let e = hw0;
        if (mask(c.x + nx * e, c.z + nz * e)) while (e < hw0 + CAP && mask(c.x + nx * e, c.z + nz * e)) e += 0.5;
        return e < hw0 + SHOULDER ? e : -1;   // -1: the asphalt goes on (a service lane, a wide survey polygon) and the edge is not known
      });
      const avg = f => E.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) { s += f(E[j]); k++; } return s / k; });
      const Es = avg(e => e < 0 ? hw0 + HARD : e), Ed = avg(e => e < 0 ? hw0 : e);   // Es: where the rail goes (a hard shoulder's worth past the mapped width when the edge is unknown); Ed: the edge for measuring a median
      let run = [], runLen = 0;
      const flush = () => { if (run.length >= 3 && runLen >= MINRUN) { const p = []; for (const q of run) p.push(Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10); out.push({ k: 'g', h: dbl ? 0.9 : 0.8, s: dbl ? 4 : 3, p, ex: 1 }); } run = []; runLen = 0; };
      for (let i = 0; i < n; i++) {
        const c = C[i], nx = -c.tz * side, nz = c.tx * side, e1 = Es[i];
        let off = e1 + (dbl ? 1.0 : 0.9), ok = true;
        { // another carriageway beside this one: a narrow median takes one rail in the middle, built by the lower way id
          for (const s of near(c.x + nx * 8, c.z + nz * 8)) {
            const o = roads[s.id]; if (s.id === id || s.st || !isExpressway(o) || !mate(r, o)) continue;
            const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l = hh(dx, dz) || 1; if ((dx * c.tx + dz * c.tz) / l > -0.6) continue;   // running the other way
            const d = distSeg(c.x, c.z, s), qx = c.x + nx * d, qz = c.z + nz * d;
            if (distSeg(qx, qz, s) > 3) continue;   // it is not on this side
            const gap = d - s.hw - Ed[i];
            if (gap < 6) { if (s.id < id) { ok = false; } else off = Ed[i] + Math.max(gap, 0.3) / 2; }
            break;
          }
        }
        let qx = c.x + nx * off, qz = c.z + nz * off;
        if (ok) for (const s of near(qx, qz)) {   // junctions, slip roads, service roads, exits: nothing stands on or beside another road
          if (s.id === id) continue;
          const o = roads[s.id];
          if (isMain.has(s.id) && mate(r, o)) { const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l = hh(dx, dz) || 1; if (Math.abs(dx * c.tx + dz * c.tz) / l > 0.9) continue; }   // the same road going on (or its other carriageway)
          if (distSeg(qx, qz, s) < s.hw + (s.st ? 5 : 1.2)) { ok = false; break; }
        }
        if (ok) for (const s of stSegs) { if (roads[s.id] && (mate(r, roads[s.id]) || roads[s.id].k === r.k) && distSeg(c.x, c.z, s) < 14) { ok = false; break; } }   // a bridge or tunnel of this road: the rail stops short of it
        if (ok && haveNear(qx, qz)) { ok = false; }
        if (ok) { if (run.length) runLen += hh(qx - run[run.length - 1][0], qz - run[run.length - 1][1]); run.push([qx, qz]); } else flush();
      }
      flush();
    }
  }
  return out;
}
