// The playing area of the Stadio Renzo Barbera (src/lmc-a.js builds the bowl, the track and the pitch) is a flat platform: inside the OSM playing-area ring the ground is PITCH_Y (the terrain
// there varies by a few decimetres, 47.1 to 47.4 m; the platform is flat so that the track and the pitch can be drawn on it without touching the street layers draped on the ground), and from the
// edge of the ring inwards it climbs to that level over a ramp RAMP metres wide. src/world.js passes the terrain through pitchGround() when it answers hooks.ground, so the lapa, the
// pedestrians, the props and the street layers all see the same surface the pitch is drawn on (before, the pitch floated 0.8 m over the ground the lapa drove on, and the lapa sank into it).
// Where the vehicle gate meets the ring the ground climbs the ramp, so there is no step. Outside the ring's bounding circle this costs one comparison.
import { FP } from './landmarks-city-data.js';

export const PITCH_Y = 48.0, PITCH_RAMP = 6;
const flat = FP.stadio.holes[0], ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
let R2 = 0; for (const p of ring) R2 = Math.max(R2, (p[0] - cx) ** 2 + (p[1] - cz) ** 2); R2 = (Math.sqrt(R2) + 1) ** 2;
export const pitchCentre = { x: cx, z: cz };
export const pitchRing = ring;
// how far inside the ring a point is, in metres (-1 outside)
export function pitchDepth(x, z) {
  const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > R2) return -1;
  let inside = false, d2 = 1e18;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], az = ring[j][1], bx = ring[i][0], bz = ring[i][1];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0, qx = ax + ex * t - x, qz = az + ez * t - z, q = qx * qx + qz * qz;
    if (q < d2) d2 = q;
  }
  return inside ? Math.sqrt(d2) : -1;
}
// the terrain y at a point, pulled up to the platform
export function pitchGround(x, z, y) {
  const d = pitchDepth(x, z); if (d < 0) return y;
  const t = Math.min(1, d / PITCH_RAMP);
  return y + (PITCH_Y - y) * t * t * (3 - 2 * t);
}
