// What an OffscreenCanvas does not draw the way a page canvas does (measured in headless Chrome, with the GPU on and off): text, and clip(), whose edge it rasterises differently, a few pixels of a few levels each.
// The worker calls watch() with the OffscreenCanvas context's prototype; a painter that has used any of them leaves taint.hit set, and a task that painted it (src/atlas-task.js, src/wall-task.js) reports that layer back
// as not done: the main thread paints it on the page's own canvas, so that the pixels are the same wherever a layer is drawn. A layer is judged by what it does when it runs, so a new painter that draws text or clips is
// covered without a list to keep.
export const taint = { hit: false };
export function watch(proto) {
  for (const name of ['fillText', 'strokeText', 'clip']) {
    const f = proto[name];
    proto[name] = function () { taint.hit = true; return f.apply(this, arguments); };
  }
}
