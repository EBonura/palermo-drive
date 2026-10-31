// City-wide landmark models for the streaming world (src/world.js, ?world=1). Owned by the city landmarks work.
// CITY_LANDMARKS = [{ name, x, z, radius, skipIds, build(ctx) -> THREE.Group, walls?, dropWalls? }]
//   x, z    anchor in local metres; world.js builds the model with the full-detail tile that contains it
//   skipIds generic building ids this model replaces (hidden from that tile's buildings only)
//   build   uses only THREE and groundY, which it imports from src/core.js itself; ctx is unused
//   walls / dropWalls  optional collision changes, see the report: walls are [x0,z0,x1,z1] segments to add, dropWalls are building ids whose footprint walls should not be registered
import { POLITEAMA, STADIO } from './lmc-a.js';

export const CITY_LANDMARKS = [POLITEAMA, STADIO];
