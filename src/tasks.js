// The tasks the work pool (src/work-pool.js) can run, by name. A task takes its payload and returns { value, transfer }: the result and the buffers inside it to hand over without a copy.
// The worker (src/worker.js) and the main-thread fallback of the pool run the same functions from here. A task may use only what a worker has: no DOM but document.createElement('canvas'), no THREE, no game data.
import { atlasChunk, probeTask } from './atlas-task.js';
import { terrainTask } from './terrain-task.js';
import { wallsTask } from './wall-task.js';

export const TASKS = { atlas: atlasChunk, probe: probeTask, terrain: terrainTask, walls: wallsTask };
