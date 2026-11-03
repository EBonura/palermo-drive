// The ground of the rave (src/rave.js, the site in src/event-places.js RAVE): a round dance floor in the forest of Monte Pellegrino, on a bench of the mountain 295 m up, and a track of
// packed gravel from the forest service road (Via Padre Ennio Pintacuda) to it, 38 m through the trees. The terrain there is the gentlest of the woods near a road (1.65 m of relief
// over the floor, 2 m of fall along the track), so there is no cut and no wall: inside the floor the ground is FLOOR_Y exactly (src/world.js passes the terrain through raveGround()
// when it answers hooks.ground, like the stadium's pitch, src/stadium-ground.js), so the lapa, the dancers and the street layers all stand on the surface the slab is drawn on, and it
// eases back to the natural ground over RAMP metres (the mountain rises or falls by up to 2.3 m by then). The lapa can drive up the track and round the floor at the speed of a gravel
// track (raveSurf, src/world.js surfaceAt). The pines of the woods (src/world.js buildTrees) and the solid trees (src/props.js) keep clear of the floor and the track (raveClears,
// src/tree-clear.js); the pines are not solid, so the track is cleared too or the lapa would drive through trunks. No wall of the tiles is in the way. A second, finer planting thickens the wood round the clearing (raveWood). Everything is one comparison
// away from the site: this costs nothing anywhere else.
import { proj } from './core.js';
import { RAVE } from './event-places.js';

export const FLOOR_R = 15;       // the dance floor (slab), metres
const FLAT_R = 20, RAMP = 11;    // the ground is level out to FLAT_R (a 5 m terrain cell that touches the slab is level too) and eases back over RAMP
const FLOOR_Y = 294.50;          // the mean of the baked near grid over the floor (293.50 to 295.16)
export const TRACK_W = 6;        // the gravel track, metres
const CLEAR_W = 5.5;             // trees stand no closer than this to the middle of the track (half width 3 plus a crown)
const [cx, cz] = proj(RAVE.site.lat, RAVE.site.lon), [mx, mz] = proj(RAVE.access.lat, RAVE.access.lon);
let ux = cx - mx, uz = cz - mz; const LEN = Math.hypot(ux, uz); ux /= LEN; uz /= LEN;   // from the road to the middle of the floor
export const FLOOR = { x: cx, z: cz, ux, uz, y: FLOOR_Y };
const S0 = 2, S1 = LEN - FLOOR_R;   // the track runs from the edge of the service road (4 m wide, so 2 m off its middle) to the rim of the floor
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
  return s > S0 - 0.1 && s < S1 + 0.5 && t < TRACK_W / 2 + 0.4 && t > -TRACK_W / 2 - 0.4 ? 1 : -1;
}
// where no tree may stand: the floor and its rim, and the track
export function raveClears(x, z) {
  const dx = x - cx, dz = z - cz; if (dx > 75 || dx < -75 || dz > 75 || dz < -75) return false;
  if (dx * dx + dz * dz < (FLOOR_R + 2.5) * (FLOOR_R + 2.5)) return true;
  const s = alongX(x, z), t = acrossX(x, z);
  return s > -3 && s < S1 + 1 && t < CLEAR_W && t > -CLEAR_W;
}

// The wood round the clearing. The planting of src/world.js buildTrees is a pine in about every 14 m cell (a 0.72 chance each), which on its own leaves the dance floor in a meadow with
// the trees a long way off (7 of them in the ring from 17 to 35 m, none in some directions). raveWood(x, z) is the chance, 0 to 1, of a tree at a point of a second, finer planting
// (a point in every 7 m cell, then the same forest-area and clear-ground tests as the first) round the clearing: full from 19 m, a little outside the 17.5 m that raveClears keeps
// empty, out to 46 m, then fading away by WOOD_R. raveWoodTile says whether a tile (its corner and size) is near enough to need that second pass at all.
export const WOOD_R = 64;
export const raveWood = (x, z) => { const r = Math.hypot(x - cx, z - cz); return r < 19 || r > WOOD_R ? 0 : r < 46 ? 1 : 1 - (r - 46) / (WOOD_R - 46); };
export const raveWoodTile = (x0, z0, size) => cx > x0 - WOOD_R && cx < x0 + size + WOOD_R && cz > z0 - WOOD_R && cz < z0 + size + WOOD_R;
