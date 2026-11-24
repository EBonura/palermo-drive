// The pool's worker (src/work-pool.js): runs the tasks of src/tasks.js, one message at a time, and answers with the result handed over, not copied.
// The painters make their scratch canvases with document.createElement('canvas'); a worker has no document, so it gets one that makes OffscreenCanvas.
import { TASKS } from './tasks.js';
import { watch } from './atlas-task.js';

watch(OffscreenCanvasRenderingContext2D.prototype);   // see atlas-task.js: what a worker's canvas does not draw like the page's is left for the main thread
self.document = { createElement: () => new OffscreenCanvas(1, 1) };
self.onmessage = e => {
  const { id, name, payload } = e.data;
  try {
    const r = TASKS[name](payload);
    self.postMessage({ id, value: r.value }, r.transfer || []);
  } catch (err) { self.postMessage({ id, error: String(err && err.stack || err) }); }
};
