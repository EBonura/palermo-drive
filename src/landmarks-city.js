// City-wide landmark models for the streaming world (src/world.js, ?world=1). Owned by the city landmarks work.
// CITY_LANDMARKS = [{ name, x, z, radius, skipIds, build(ctx) -> THREE.Group, walls?, dropWalls? }]
//   x, z    anchor in local metres; world.js builds the model with the full-detail tile that contains it
//   skipIds generic building ids this model replaces (hidden from that tile's buildings only)
//   build   uses only THREE and groundY, which it imports from src/core.js itself; ctx is unused
//   walls / dropWalls  optional collision changes, see the report: walls are [x0,z0,x1,z1] segments to add, dropWalls are building ids whose footprint walls should not be registered
import { POLITEAMA, STADIO, UTVEGGIO, SANTUARIO } from './lmc-a.js';
import { ZISA, CUBA, EREMITI, PONTE, NORMANNI } from './lmc-b.js';

import { POVERE, GIUSTIZIA, NISCEMI, CASTELNUOVO, VERDURA, MAREDOLCE, TONNARA, PORTA_FELICE_1, PORTA_FELICE_2, CAPPUCCINI } from './lmc-d.js';
import { STABILIMENTO, MONDELLO_GATE, MONDELLO_BEACH, CINESE, GYMNASIUM, VILLA_GIULIA_GATE, TEATRO_GARIBALDI, UCCIARDONE, FIERA_GATE, IGIEA, FLORIO, IDA, STAZIONE_MARITTIMA } from './lmc-c.js';
import { MONDELLO_LANDMARKS } from './lmc-mondello.js';
import { GATES } from './lmc-gates.js';

export const CITY_LANDMARKS = [
  POLITEAMA, STADIO, UTVEGGIO, SANTUARIO, ZISA, CUBA, EREMITI, PONTE, NORMANNI,
  STABILIMENTO, MONDELLO_GATE, MONDELLO_BEACH, CINESE, GYMNASIUM, VILLA_GIULIA_GATE, TEATRO_GARIBALDI, UCCIARDONE, FIERA_GATE, IGIEA, FLORIO, IDA, STAZIONE_MARITTIMA,
  POVERE, GIUSTIZIA, NISCEMI, CASTELNUOVO, VERDURA, MAREDOLCE, TONNARA, PORTA_FELICE_1, PORTA_FELICE_2, CAPPUCCINI,
  ...MONDELLO_LANDMARKS,
  ...GATES,
];
