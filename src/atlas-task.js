// The wall atlas of the buildings, one slice of layers at a time: paint each layer, read it back, flip it (v = 1 is the top) and make its mipmaps. Runs in a pool worker (src/work-pool.js) so that
// the main thread only uploads the result, and on the main thread itself when there is no worker (buildings.js uses mipLayer and flipInto directly for that path, one layer per slice).
// The mipmaps are made here, layer by layer, and handed to the GPU ready made: it is never asked to make them (gl.generateMipmap), which crashed the GPU process of a Galaxy A13 5G (docs/PERF.md "The recorder").
import { T, paintLayer } from './atlas-layers.js';
import { taint } from './taint.js';

export const MIPS = Math.log2(T);   // the levels below the first: 128 down to 1
const S2L = new Float32Array(256), L2S = new Uint8Array(4096);   // sRGB to linear light and back: the colours of a mipmap are averaged in linear light, as a GPU does for an sRGB texture
for (let i = 0; i < 256; i++) { const c = i / 255; S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
for (let i = 0; i < 4096; i++) { const l = i / 4095, c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; L2S[i] = Math.round(255 * c); }
export const newMips = layers => Array.from({ length: MIPS }, (_, i) => { const w = T >> (i + 1); return { w, data: new Uint8Array(w * w * 4 * layers) }; });
// one layer's mipmaps: each level the 2x2 mean of the one above (alpha as it is, not through the light curve)
export function mipLayer(data, mips, k) {
  let src = data, w = T;
  for (const m of mips) {
    const h = m.w, dst = m.data, so = k * w * w * 4, dn = k * h * h * 4;
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
      const a = so + ((2 * y) * w + 2 * x) * 4, b = a + 4, c = a + w * 4, d = c + 4, o = dn + (y * h + x) * 4;
      dst[o] = L2S[Math.round((S2L[src[a]] + S2L[src[b]] + S2L[src[c]] + S2L[src[d]]) * 1023.75)];
      dst[o + 1] = L2S[Math.round((S2L[src[a + 1]] + S2L[src[b + 1]] + S2L[src[c + 1]] + S2L[src[d + 1]]) * 1023.75)];
      dst[o + 2] = L2S[Math.round((S2L[src[a + 2]] + S2L[src[b + 2]] + S2L[src[c + 2]] + S2L[src[d + 2]]) * 1023.75)];
      dst[o + 3] = (src[a + 3] + src[b + 3] + src[c + 3] + src[d + 3] + 2) >> 2;
    }
    src = dst; w = h;
  }
}
// the pixels of a painted layer (top row first) into slot i of an atlas array, bottom row first
export function flipInto(data, px, i) {
  for (let y = 0; y < T; y++) data.set(px.subarray(y * T * 4, (y + 1) * T * 4), (i * T + (T - 1 - y)) * T * 4);
}

let G = null;

// One canvas for every slice, as the main thread has one for the whole atlas: a canvas that is new for each slice draws its first layers differently from a worn one (measured with the GPU on: Chrome moves a canvas that is read back
// off the GPU after a few reads, and a worker's canvas starts on it). So it is worn before use: a few small reads, the same in every worker and for the probe.
// The main thread reads its canvas back with willReadFrequently, which on an OffscreenCanvas changes how it rasterises (measured), so a worker leaves it out: what it then draws is what the main thread's canvas draws.
function sharedCanvas() {
  if (!G) {
    const cv = document.createElement('canvas'); cv.width = cv.height = T;
    G = cv.getContext('2d', typeof WorkerGlobalScope === 'undefined' ? { willReadFrequently: true } : undefined);
    for (let i = 0; i < 6; i++) { G.fillRect(0, 0, T, T); G.getImageData(0, 0, T, T); }
  }
  return G;
}

// The task: layers from to to-1. Returns the pixels of those layers and each of their mip levels as flat arrays, plus the buffers to hand over without a copy, and the layers (their numbers in the atlas) it left for the main thread.
export function atlasChunk(p) {
  const n = p.to - p.from, data = new Uint8Array(T * T * 4 * n), mips = p.mips ? newMips(n) : null, left = [];
  const g = sharedCanvas();
  for (let k = 0; k < n; k++) {
    taint.hit = false;
    paintLayer(g, p.from + k);
    if (taint.hit) { left.push(p.from + k); continue; }
    flipInto(data, g.getImageData(0, 0, T, T).data, k);
    if (mips) mipLayer(data, mips, k);
  }
  const levels = mips ? mips.map(m => m.data) : [];
  return { value: { from: p.from, data, mips: levels, left }, transfer: [data.buffer, ...levels.map(a => a.buffer)] };
}

// Does a worker's canvas draw what the page's canvas draws? In Chrome it does apart from text and clip (see taint.js); in WebKit it differs by a level or more in nearly every layer (measured, also for an OffscreenCanvas
// on the main thread: fractional rectangles, gradients, arcs, scaled images). Whether a particular browser and GPU setup does cannot be read off a list, and a drawing of our own proved too different from the layers' (a worker's
// canvas that is new draws unlike one that is worn), so the atlas asks with real layers: the task 'probe' paints a few of them in the worker, the main thread paints the same ones on its own canvas, and probeMatches compares the
// bytes. If they differ the atlas is not sent to workers at all.
const PROBE = [3, 40, 100, 160, 200, 220, 70, 130];   // candidates, in order: the first three that need no text and no clip are used
export function probeTask() {
  const g = sharedCanvas(), out = [], transfer = [];
  for (const i of PROBE) {
    if (out.length === 3) break;
    taint.hit = false;
    paintLayer(g, i);
    if (taint.hit) continue;
    const px = g.getImageData(0, 0, T, T).data;
    out.push([i, px]); transfer.push(px.buffer);
  }
  return { value: out, transfer };
}
export function probeMatches(res) {
  const g = sharedCanvas();
  for (const [i, px] of res) {
    paintLayer(g, i);
    const mine = g.getImageData(0, 0, T, T).data;
    for (let k = 0; k < mine.length; k++) if (mine[k] !== px[k]) return false;
  }
  return res.length > 0;
}
