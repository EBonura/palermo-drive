// The ground of the rave (src/rave.js, the site in src/event-places.js RAVE): a round dance floor in a clearing of the Favorita's pines and a track of packed gravel from
// Viale Ercole to it, 58 m through the trees. The terrain there is nearly flat (48.5 to 48.9 m over the whole 58 m), so there is no cut and no wall: inside the floor the ground
// is FLOOR_Y exactly (src/world.js passes the terrain through raveGround() when it answers hooks.ground, like the stadium's pitch, src/stadium-ground.js), so the lapa, the
// dancers and the street layers all stand on the surface the slab is drawn on, and it eases back to the natural ground over RAMP metres. The lapa can drive up the track and round
// the floor at the speed of a gravel track (raveSurf, src/world.js surfaceAt). The pines of the woods (src/world.js buildTrees) and the solid trees (src/props.js) keep clear of
// the floor and the track (raveClears, src/tree-clear.js); the pines are not solid, so the track is cleared too or the lapa would drive through trunks. The park wall along
// Viale Ercole has a gap where the track leaves the road (raveFences, src/world.js). Everything is one comparison away from the site: this costs nothing anywhere else.
import { proj } from './core.js';
import { RAVE } from './event-places.js';

export const FLOOR_R = 15;       // the dance floor (slab), metres
const FLAT_R = 20, RAMP = 11;    // the ground is level out to FLAT_R (a 5 m terrain cell that touches the slab is level too) and eases back over RAMP
const FLOOR_Y = 48.82;           // the mean of the baked near grid over the floor (48.70 to 48.92)
export const TRACK_W = 6;        // the gravel track, metres
const CLEAR_W = 5.5;             // trees stand no closer than this to the middle of the track (half width 3 plus a crown)
const GAP = 9;                   // the gap in the park wall where the track leaves the road
const [cx, cz] = proj(RAVE.site.lat, RAVE.site.lon), [mx, mz] = proj(RAVE.access.lat, RAVE.access.lon);
let ux = cx - mx, uz = cz - mz; const LEN = Math.hypot(ux, uz); ux /= LEN; uz /= LEN;   // from the road to the middle of the floor
export const FLOOR = { x: cx, z: cz, ux, uz, y: FLOOR_Y };
const S0 = 4.5, S1 = LEN - FLOOR_R;   // the track runs from 4.5 m off the middle of the road (past its kerb) to the rim of the floor
export const TRACK = { x0: mx + ux * S0, z0: mz + uz * S0, x1: mx + ux * S1, z1: mz + uz * S1, ux, uz, len: S1 - S0, w: TRACK_W };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// along the track from the middle of the road (s, towards the floor) and across it (t, along the road)
const alongX = (x, z) => (x - mx) * ux + (z - mz) * uz, acrossX = (x, z) => -(x - mx) * uz + (z - mz) * ux;
// the terrain y at a point, pulled up or down to the floor
export function raveGround(x, z, y) {
  const dx = x - cx, dz = z - cz; if (dx > 40 || dx < -40 || dz > 40 || dz < -40) return y;
  const r = Math.hypot(dx, dz); if (r >= FLAT_R + RAMP) return y;
  const k = 1 - smooth(FLAT_R, FLAT_R + RAMP, r);
  return y + (FLOOR_Y - y) * k;
}
// what the lapa drives on: 0 hard (the slab), 1 gravel (the track), -1 not ours
export function raveSurf(x, z) {
  const dx = x - cx, dz = z - cz; if (dx > 70 || dx < -70 || dz > 70 || dz < -70) return -1;
  if (dx * dx + dz * dz < (FLOOR_R + 0.4) * (FLOOR_R + 0.4)) return 0;
  const s = alongX(x, z), t = acrossX(x, z);
  return s > S0 - 1 && s < S1 + 0.5 && t < TRACK_W / 2 + 0.4 && t > -TRACK_W / 2 - 0.4 ? 1 : -1;
}
// where no tree may stand: the floor and its rim, and the track
export function raveClears(x, z) {
  const dx = x - cx, dz = z - cz; if (dx > 75 || dx < -75 || dz > 75 || dz < -75) return false;
  if (dx * dx + dz * dz < (FLOOR_R + 2.5) * (FLOOR_R + 2.5)) return true;
  const s = alongX(x, z), t = acrossX(x, z);
  return s > -3 && s < S1 + 1 && t < CLEAR_W && t > -CLEAR_W;
}

// The park wall along Viale Ercole (tile.fences, kind w) runs across the mouth of the track: cut a gap in it, GAP wide, round the middle of the track. `list` is a tile's fences;
// a fence that does not reach the gap comes back as it was.
// the part [u0, u1] of the segment a to b (u from 0 to 1) inside the gap box (s from the road's middle to 8 m up the track: the wall on the track's side only; t within GAP / 2 of the
// track's axis), or null: s and t are linear in u
function inGap(ax, az, bx, bz) {
  let u0 = 0, u1 = 1;
  for (const [a, b, lo, hi] of [[alongX(ax, az), alongX(bx, bz), -1, 8], [acrossX(ax, az), acrossX(bx, bz), -GAP / 2, GAP / 2]]) {
    if (Math.abs(b - a) < 1e-9) { if (a < lo || a > hi) return null; continue; }
    const e0 = (lo - a) / (b - a), e1 = (hi - a) / (b - a); u0 = Math.max(u0, Math.min(e0, e1)); u1 = Math.min(u1, Math.max(e0, e1));
  }
  return u0 < u1 ? [u0, u1] : null;
}
export function raveFences(list) {
  if (!list) return list;
  const out = [];
  for (const f of list) {
    const p = f.p, gaps = [];
    for (let i = 0; i + 3 < p.length; i += 2) gaps.push(inGap(p[i], p[i + 1], p[i + 2], p[i + 3]));
    if (!gaps.some(g => g)) { out.push(f); continue; }
    let run = [];
    const flush = () => { if (run.length >= 4 && Math.hypot(run[run.length - 2] - run[0], run[run.length - 1] - run[1]) > 0.5) out.push({ ...f, p: run }); run = []; };
    for (let i = 0, k = 0; i + 3 < p.length; i += 2, k++) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], g = gaps[k];
      if (!run.length) run.push(ax, az);
      if (g) { run.push(ax + (bx - ax) * g[0], az + (bz - az) * g[0]); flush(); if (g[1] < 1) run.push(ax + (bx - ax) * g[1], az + (bz - az) * g[1]); else continue; }
      run.push(bx, bz);
    }
    flush();
  }
  return out;
}
