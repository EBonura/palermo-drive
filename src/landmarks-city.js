// City-wide landmark models for the streaming world (src/world.js, ?world=1). Owned by the city landmarks work.
// CITY_LANDMARKS = [{ name, x, z, radius, skipIds, build(ctx) -> THREE.Group, walls?, dropWalls? }]
//   x, z    anchor in local metres; world.js builds the model with the full-detail tile that contains it
//   skipIds generic building ids this model replaces (hidden from that tile's buildings only)
//   build   uses only THREE and groundY, which it imports from src/core.js itself; ctx is unused
//   walls / dropWalls  optional collision changes, see the report: walls are [x0,z0,x1,z1] segments to add, dropWalls are building ids whose footprint walls should not be registered
// A built model may set userData.solids = [[flat, holes, roofY], ...]: where it stands solid, handed to the lean renderer's occluder grid as the generic building it replaces was (src/world.js)
import { POLITEAMA, STADIO, UTVEGGIO, SANTUARIO } from './lmc-a.js';
import { GROUP_G } from './lmc-g.js';   // review-2 items 9, 13/14 and 15: Giardino Inglese, Villa Garibaldi, Stazione Centrale, Ponte dell'Ammiraglio, Piazza Mondello (src/lmc-g.js)
import { PONTE_AMM } from './lmc-g.js';
import { ZISA, CINESE } from './lmc-f.js';   // review-2 items 6 and 7: the Zisa and the Palazzina Cinese rebuilt (src/lmc-f.js)
import { FLOATING_DOCK } from './lmc-port.js';   // board item n10
import { CUBA, EREMITI, NORMANNI, STAZIONE_MARITTIMA } from './lmc-e.js';   // board item c4: rebuilt on the streamed ground, with collision

import { POVERE, GIUSTIZIA, NISCEMI, CASTELNUOVO, VERDURA, MAREDOLCE, TONNARA, PORTA_FELICE_1, PORTA_FELICE_2, CAPPUCCINI } from './lmc-d.js';
import { STABILIMENTO, MONDELLO_GATE, MONDELLO_BEACH, GYMNASIUM, VILLA_GIULIA_GATE, TEATRO_GARIBALDI, UCCIARDONE, FIERA_GATE, IGIEA, FLORIO, IDA } from './lmc-c.js';
import { MONDELLO_LANDMARKS } from './lmc-mondello.js';
import { GATES } from './lmc-gates.js';
import { ARCO_CUTO } from './lmc-cuto.js';   // the Arco di Cutò and the front of the Palazzo Filangeri di Cutò on Via Maqueda (src/lmc-cuto.js)
import { TOWN_LANDMARKS } from './lmc-towns.js';   // the towns: Villabate's Chiesa Madre di Sant'Agata, bell tower of San Giuseppe and bandstand, the Duomo di Monreale, the Chiesa Madre of Belmonte Mezzagno and of Capaci (src/lmc-towns.js)
import { SAN_FRANCESCO } from './lmc-sanfrancesco.js';
import { SANT_AGOSTINO } from './lmc-santagostino.js';
import { SALVATORE } from './lmc-salvatore.js';
import { SANT_IGNAZIO } from './lmc-santignazio.js';
import { POSTE } from './lmc-poste.js';
import { GESU } from './lmc-gesu.js';
import { TEATINI } from './lmc-teatini.js';
import { SANTA_CITA } from './lmc-santacita.js';
import { MARTORANA } from './lmc-martorana.js';
import { CARMINE } from './lmc-carmine.js';
import { SANTA_TERESA } from './lmc-santateresa.js';
import { PIETA } from './lmc-pieta.js';
import { MAGIONE } from './lmc-magione.js';
import { BATCH_A } from './lmc-batchA.js';
import { BATCH_B } from './lmc-batchB.js';
import { BATCH_C } from './lmc-batchC.js';
import { BATCH_D } from './lmc-batchD.js';
import { BATCH_E } from './lmc-batchE.js';
import { BATCH_F } from './lmc-batchF.js';
import { BATCH_G } from './lmc-batchG.js';
import { BATCH_H } from './lmc-batchH.js';
import { BATCH_I } from './lmc-batchI.js';
import { BATCH_J } from './lmc-batchJ.js';
import { BATCH_K } from './lmc-batchK.js';
import { BATCH_L } from './lmc-batchL.js';
import { BATCH_M } from './lmc-batchM.js';
import { BATCH_N } from './lmc-batchN.js';
import { BATCH_O } from './lmc-batchO.js';
import { BATCH_P } from './lmc-batchP.js';
import { CHURCHES } from './lmc-churches.js';
import { PIAZZA } from './lmc-piazza.js';
import { PIAZZA2 } from './lmc-piazza2.js';
import { SAN_DOMENICO } from './lmc-sandomenico.js';   // the Chiesa di San Domenico: front, two bell towers, nave (src/lmc-sandomenico.js)
import { EUFEMIA } from './lmc-eufemia.js';   // the sign of the Hotel Eufemia in Isola delle Femmine, the destination of the U cuinnutu fare (src/lmc-eufemia.js)

export const CITY_LANDMARKS = [
  POLITEAMA, STADIO, UTVEGGIO, SANTUARIO, ZISA, CUBA, EREMITI, PONTE_AMM, NORMANNI,
  STABILIMENTO, MONDELLO_GATE, MONDELLO_BEACH, CINESE, GYMNASIUM, VILLA_GIULIA_GATE, TEATRO_GARIBALDI, UCCIARDONE, FIERA_GATE, IGIEA, FLORIO, IDA, STAZIONE_MARITTIMA,
  POVERE, GIUSTIZIA, NISCEMI, CASTELNUOVO, VERDURA, MAREDOLCE, TONNARA, PORTA_FELICE_1, PORTA_FELICE_2, CAPPUCCINI,
  FLOATING_DOCK,
  ...GROUP_G,
  ...MONDELLO_LANDMARKS,
  ...GATES,
  ARCO_CUTO,
  EUFEMIA,
  ...CHURCHES,
  ...BATCH_M, ...BATCH_N, ...BATCH_O, ...BATCH_P, 
  ...BATCH_I, ...BATCH_J, ...BATCH_K, ...BATCH_L, 
  ...BATCH_E, ...BATCH_F, ...BATCH_G, ...BATCH_H, 
  ...BATCH_A, ...BATCH_B, ...BATCH_C, ...BATCH_D, 
  GESU, TEATINI, SANTA_CITA, MARTORANA, CARMINE, SANTA_TERESA, PIETA, MAGIONE, 
  ...PIAZZA, ...PIAZZA2,
  SAN_DOMENICO, SAN_FRANCESCO, SANT_AGOSTINO, SALVATORE, SANT_IGNAZIO, POSTE,
  ...TOWN_LANDMARKS,
];
