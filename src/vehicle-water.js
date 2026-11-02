// Floats: driving on the sea. Owned by the driving work. Bought in the Garage (part "swim", src/garage.js), drawn by addFloats in src/vehicle-models.js.
//
// With the upgrade fitted (car.floats) the lapa no longer drowns (src/sea.js checkPlayer lets it be): over water the ground under the ball is the
// water's surface, so it rides on the sea instead of sinking, and car.wet (0..1, smoothed) says how much of it is in the water. vehicle.js reads
// car.wet to make it slower (a lower top speed and a drag above it) and slippery (less grip), bobs the body, and src/sea.js draws the wake and the
// splash. A beach or a low quay is just ground that rises under the ball: it drives out the way a lapa climbs a kerb, a quay too high for the
// slope limit of the sphere model (0.8 m of rise per metre) stays a wall. Without floats nothing here is used and the sea is as before.
import { SEA_Y } from './sea.js';

export const FLOAT_Y = SEA_Y + 0.1;   // where the ball rides: a hand above the surface, so the floats sit half under
export const WET_TOP = 0.55;          // top speed on the water, as a share of the top speed on the road
export const WET_GRIP = 0.45;         // tyre grip lost at full wetness (a lapa on floats slides)

export function createWater({ car, sea }) {
  let wasWet = 0;
  const isWater = sea && sea.isWater ? sea.isWater : () => false;
  return {
    isWater,
    // the height of the water under (x, z) for a lapa on floats, else NaN (the sphere and classic models take the higher of this and the terrain)
    floorAt: (x, z) => car.floats && isWater(x, z) ? FLOAT_Y : NaN,
    reset() { car.wet = 0; wasWet = 0; },
    // once per physics step: how wet the lapa is, and a splash when it goes in at speed
    step(dt) {
      const want = car.floats && !car.flying && isWater(car.x, car.z) ? 1 : 0, w0 = car.wet || 0;
      car.wet = w0 + (want - w0) * Math.min(1, 5 * dt);
      if (car.wet > 0.5 && wasWet <= 0.5) { const sp = Math.hypot(car.vx, car.vz); if (sea && sea.dip && sp > 3) sea.dip(car.x, car.z, sp, car.vx, car.vz); }
      wasWet = car.wet;
    },
  };
}
