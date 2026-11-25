// The walls' texture layers, painted in a pool worker (src/work-pool.js): the task 'walls' paints the kinds it is given and answers with the pixels of each (the buffers handed over), leaving out a kind whose painter used
// text or clip(), which an OffscreenCanvas draws differently from a page canvas (src/taint.js): the main thread paints those. Whether workers' canvases can be trusted at all is asked once by src/probe.js.
import { pixels, seedOf } from './wall-paint.js';
import { taint } from './taint.js';

export function wallsTask(p) {
  const layers = [], transfer = [];
  for (const kind of p.kinds) {
    taint.hit = false;
    const px = pixels(kind, seedOf(kind));
    if (taint.hit) continue;
    layers.push([kind, px]); transfer.push(px.buffer);
  }
  return { value: { layers }, transfer };
}
