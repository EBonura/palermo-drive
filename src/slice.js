// One step of the tile building (the generators of src/world.js and the modules it calls): a loop asks `if (sliceOver()) yield;` as often as it likes, and the step ends when it has had its share of the frame,
// however dear this tile's vertices or that building happen to be. A count of items per step (every 16 buildings, every 2 rows) gave steps of 20 ms at a 4x CPU slowdown on a big tile. src/world.js starts the clock before each step.
export const slice = { t0: 0, ms: 1.5 };
export const sliceOver = () => performance.now() - slice.t0 > slice.ms;
