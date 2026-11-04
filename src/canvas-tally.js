// Live 2D canvas memory, for the ?coords box. Safari on iOS keeps a total for all canvases and past its limit new ones stay blank (a likely cause of the blue minimap on the owner's phone), and a canvas nobody holds still counts until the collector finds it.
// Imported first in main.js so it sees every canvas: it notes each one when it gets a 2D context; width x height x 4 is read when asked.
const list = [];
let peak = 0, pruneAt = 256;
const o = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, ...a) {
  const seen = this.__pdSeen, r = o.call(this, kind, ...a);
  if (!seen && r && kind === '2d') {
    this.__pdSeen = true; list.push(new WeakRef(this));
    if (list.length > pruneAt) { let w = 0; for (const c of list) if (c.deref()) list[w++] = c; list.length = w; pruneAt = Math.max(256, w * 2); }
  }
  return r;
};
export function canvasStats() {
  let bytes = 0, n = 0; for (const r of list) { const c = r.deref(); if (c) { bytes += c.width * c.height * 4; n++; } }
  if (bytes > peak) peak = bytes;
  return { mb: bytes / 1048576, n, peakMB: peak / 1048576 };
}
