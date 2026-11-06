// Decoder for the PDB1 format written by tools/build/codec.mjs. Returns the original JS value.
const P10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
// decode(buf) is the whole thing in one go. decodeSteps(buf, ms) is a generator that does the same in steps of about ms milliseconds, for a tile that arrives while the game is being played (a big one took 20 ms at a 4x CPU slowdown in one piece).
export function decode(buf) { const it = decodeSteps(buf, Infinity); for (;;) { const r = it.next(); if (r.done) return r.value; } }
export function* decodeSteps(buf, ms) {
  let o = 4;
  const rv = () => { let r = 0, m = 1, b; while ((b = buf[o++]) & 128) { r += (b & 127) * m; m *= 128; } return r + b * m; };
  const sizes = [rv(), rv(), rv(), rv(), rv()];
  const base = [], ends = [];
  { let p = o; for (const s of sizes) { base.push(p); p += s; ends.push(p); } }
  // streams: string table, tags, lengths, values, floats
  let ps = base[0], pt = base[1], pl = base[2], pv = base[3], pf = base[4];
  const rL = () => { let r = 0, m = 1, b; while ((b = buf[pl++]) & 128) { r += (b & 127) * m; m *= 128; } return r + b * m; };
  const rV = () => { let r = 0, m = 1, b; while ((b = buf[pv++]) & 128) { r += (b & 127) * m; m *= 128; } r += b * m; return r & 1 ? -(r + 1) / 2 : r / 2; };
  const dec = new TextDecoder();
  const strs = [];
  while (ps < ends[0]) { let r = 0, m = 1, b; while ((b = buf[ps++]) & 128) { r += (b & 127) * m; m *= 128; } r += b * m; strs.push(dec.decode(buf.subarray(ps, ps + r))); ps += r; }
  const shapes = [], prev = [0, 0, 0], KIND = 'wrn';
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  function get() {
    const t = buf[pt++];
    switch (t) {
      case 0: return null;
      case 1: return false;
      case 2: return true;
      case 3: return rV();
      case 4: case 5: case 6: case 7: case 8: case 9: return rV() / P10[t - 3];
      case 10: { const v = dv.getFloat64(pf, true); pf += 8; return v; }
      case 11: return strs[rL()];
      case 12: { const n = rL(), a = new Array(n); for (let i = 0; i < n; i++) a[i] = get(); return a; }   // (sized at once: an array grown by push keeps up to a third more than it holds, and the tile data lives on)
      case 13: {
        let id = rL(), keys;
        if (id === 0) { const n = rL(); keys = []; for (let i = 0; i < n; i++) keys.push(strs[rL()]); shapes.push(keys); } else keys = shapes[id - 1];
        const ob = {}; for (let i = 0; i < keys.length; i++) ob[keys[i]] = get(); return ob;
      }
      case 14: {
        const n = rL(), mode = buf[pt++], d = mode & 7, stride = (mode >> 3) & 3, hs = ((mode >> 5) & 3) * 2, order = mode >> 7;
        const q = new Array(n);
        for (let i = 0; i < hs; i++) q[i] = rV();
        if (!stride) for (let i = hs; i < n; i++) q[i] = rV();
        else if (!order) for (let i = hs; i < n; i++) q[i] = rV() + (i - stride >= hs ? q[i - stride] : 0);
        else for (let i = hs; i < n; i++) { const a = i - stride >= hs ? q[i - stride] : 0; q[i] = rV() + (i - 2 * stride >= hs ? 2 * a - q[i - 2 * stride] : a); }
        if (d) { const k = P10[d]; for (let i = 0; i < n; i++) q[i] /= k; }
        return q;
      }
      case 15: {
        const k = rL(), num = (prev[k] += rV()), sub = rL();
        return KIND[k] + num + (sub ? '.' + (sub - 1) : '');
      }
    }
    throw new Error('bad PDB1 tag ' + t);
  }
  // the outer two levels of arrays and objects (a tile: its lists of buildings, roads, polygons of each street layer) can stop between their members
  let t0 = performance.now();
  function* steps(depth) {
    const t = buf[pt];
    if (t !== 12 && t !== 13) return get();
    pt++;
    const over = () => performance.now() - t0 > ms;
    if (t === 12) { const n = rL(), a = []; for (let i = 0; i < n; i++) { a.push(depth < 2 ? yield* steps(depth + 1) : get()); if (over()) { yield; t0 = performance.now(); } } return a; }
    let id = rL(), keys;
    if (id === 0) { const n = rL(); keys = []; for (let i = 0; i < n; i++) keys.push(strs[rL()]); shapes.push(keys); } else keys = shapes[id - 1];
    const ob = {}; for (let i = 0; i < keys.length; i++) { ob[keys[i]] = depth < 2 ? yield* steps(depth + 1) : get(); if (over()) { yield; t0 = performance.now(); } } return ob;
  }
  return yield* steps(0);
}
