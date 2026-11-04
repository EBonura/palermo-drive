// The ground of the landfill mission (src/discarica.js, src/event-dump.js, the site in src/event-places.js DUMP, notes in docs/discarica.md): a level pad cut into the open ground of the
// landfill of Bellolampo, a stepped pit (a vasca: three terraces, 18 m from the rim to the floor) in the middle of it, and a track of packed gravel from the service road to the rim. The tiles
// have no landfill, so this is the game's own earthwork: src/world.js passes the terrain through dumpGround() when it answers hooks.ground (like the rave's dance floor, src/rave-ground.js),
// so the terrain mesh, the lapa, the trees and the street layers all see the same ground, and the pit is a real hole in it: the lapa falls into it.
// The pit is defined on the 5 m nodes of the terrain mesh and read back with the same triangles the mesh draws (the diagonal of every cell joins its (i+1, j) and (i, j+1) corners, see
// src/world.js terrainMesh), so the surface the lapa drives on is exactly the one that is drawn, however steep the terraces are. Everything is one comparison away from the site: this
// costs nothing anywhere else.
import { proj } from './core.js';
import { DUMP } from './event-places.js';

const [cx, cz] = proj(DUMP.site.lat, DUMP.site.lon), [mx, mz] = proj(DUMP.access.lat, DUMP.access.lon);
export const HA = 42, HB = 36, CR = 14;   // the rim of the pit: half length (along x, east, the way the track runs), half width, corner radius, metres
export const RIM_Y = 442.2;               // the level of the pad: the mean of the baked near grid over the pad (435.6 to 448.4 m)
const PAD = 14, RAMP = 22;                // the ground is level out to PAD m from the rim, then eases back to the natural ground over RAMP
export const FLOOR_D = 18;                // depth of the floor under the rim
// depth under the rim by the distance d inside it: three risers (6 m high over 5 m) with berms between them, then the floor
const PROFILE = [[0, 0], [5, 6], [11, 6], [16, 12], [22, 12], [27, 18]];
export const PIT = { x: cx, z: cz, HA, HB, y: RIM_Y };
export const TRACK = { x0: mx + 1.5, x1: cx - HA, z: cz, w: 6 };   // the gravel track: from the service road to the rim, along the middle line of the pit
// the compound: a fence round the pad and the pit, with the gate where the track comes in (src/discarica.js)
export const YARD = { x0: cx - 117, x1: cx + 54, z0: cz - 52, z1: cz + 46, gate: 7.2 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const R_OUT = HA + PAD + RAMP + 6;

// signed distance from the rim of the pit (negative inside), a rounded rectangle
export function pitSd(x, z) {
  const qx = Math.abs(x - cx) - (HA - CR), qz = Math.abs(z - cz) - (HB - CR);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - CR;
}
// depth under the rim at one 5 m node: the terraces, and on the floor a few lumps of rubbish
function nodeDepth(x, z) {
  const d = -pitSd(x, z); if (d <= 0) return 0;
  let k = 1; while (k < PROFILE.length && PROFILE[k][0] < d) k++;
  if (k >= PROFILE.length) return FLOOR_D + 0.5 * Math.sin(x * 0.83 + z * 0.37) * Math.cos(z * 0.71 - x * 0.29);
  const a = PROFILE[k - 1], b = PROFILE[k];
  return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
}
// depth under the rim at any point, read with the triangles of the terrain mesh
export function dumpDepth(x, z) {
  if (x < cx - R_OUT || x > cx + R_OUT || z < cz - R_OUT || z > cz + R_OUT) return 0;
  const i = Math.floor(x / 5), j = Math.floor(z / 5), fx = x / 5 - i, fz = z / 5 - j, x0 = i * 5, z0 = j * 5;
  const a = nodeDepth(x0, z0), b = nodeDepth(x0, z0 + 5), c = nodeDepth(x0 + 5, z0);
  if (fx + fz <= 1) return a + fx * (c - a) + fz * (b - a);
  const d = nodeDepth(x0 + 5, z0 + 5);
  return d + (1 - fx) * (b - d) + (1 - fz) * (c - d);
}
// the terrain y at a point, cut and filled to the pad and the pit
export function dumpGround(x, z, y) {
  if (x < cx - R_OUT || x > cx + R_OUT || z < cz - R_OUT || z > cz + R_OUT) return y;
  const sd = pitSd(x, z); if (sd >= PAD + RAMP) return y;
  const k = 1 - smooth(PAD, PAD + RAMP, sd);
  return y + (RIM_Y - dumpDepth(x, z) - y) * k;
}
// what the lapa drives on: 1 gravel (the track and the pad), 4 loose rubbish (the pit), -1 not ours
export function dumpSurf(x, z) {
  if (x < TRACK.x0 - 2 || x > cx + R_OUT || z < cz - R_OUT || z > cz + R_OUT) return -1;
  const sd = pitSd(x, z);
  if (sd < -0.5) return 4;
  if (sd < PAD) return 1;
  return x > TRACK.x0 - 0.1 && x < TRACK.x1 + 0.5 && Math.abs(z - TRACK.z) < TRACK.w / 2 + 0.4 ? 1 : -1;
}
// where no tree may stand: the whole compound, and the track to it
export function dumpClears(x, z) {
  if (x < YARD.x0 - 8 || x > YARD.x1 + 8 || z < YARD.z0 - 8 || z > YARD.z1 + 8) return false;
  return true;
}
// inside the fence: the crowd of the street does not walk in (src/pedestrians.js reads the ground as a wall there), the gate is for the lapa
export const inYard = (x, z) => x > YARD.x0 + 1 && x < YARD.x1 - 1 && z > YARD.z0 + 1 && z < YARD.z1 - 1;
