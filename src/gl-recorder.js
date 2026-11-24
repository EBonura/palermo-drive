// ?glrec: a recorder of the heavy WebGL calls, for finding what a phone's GPU process dies of (docs/PERF.md, "The recorder"). Only with the parameter in the address: without it
// this file does nothing at all. It is imported first of all by main.js, because it wraps the methods of the WebGL contexts themselves and so has to be there before any is made.
//
// What it keeps (window.__glrec.summary()):
//   - every upload and allocation with its size and the time the call took: textures, buffers, render buffers, shader compiles, program links, mipmaps;
//   - the memory the page has asked the GPU for and not given back (textures, buffers, render buffers), now and at its peak, and a sample of it twice a second;
//   - every wrapped call that took over 30 ms, and the 25 largest single allocations;
//   - at each lost context: the totals at that moment and the last calls before it. The page lives on when the GPU process dies, so the record survives the crash it is there to explain.
// Sizes are what the page asked for, worked out from the formats: a driver may hold more (padding, copies), never less. Draw calls are not wrapped: they are too many to time without changing them.
const ON = new URLSearchParams(location.search).has('glrec');
if (ON) {
  const t0 = performance.now(), now = () => Math.round(performance.now() - t0), MB = b => Math.round(b / 104857.6) / 10;
  const RING = 400, ring = [], slow = [], big = [], lost = [], timeline = [], T = { tex: 0, texN: 0, buf: 0, bufN: 0, rb: 0, rbN: 0, up: 0, shaders: 0, programs: 0, compileMs: 0, linkMs: 0, ops: 0, gen: 0 }, peak = { tex: 0, buf: 0, rb: 0, all: 0 };
  const texOf = new WeakMap(), bufOf = new WeakMap(), rbOf = new WeakMap(), boundTex = new Map(), boundBuf = new Map(); let boundRb = null, unit = 0, firstCanvas = null;
  const note = (name, bytes, info, dt) => {
    T.ops++; ring.push([now(), name, bytes, info, Math.round(dt * 10) / 10]); if (ring.length > RING) ring.shift();
    if (bytes >= 1048576 && name !== 'bufferSubData' && name !== 'texSubImage2D') { big.push([now(), name, bytes, info]); big.sort((a, b) => b[2] - a[2]); big.length = Math.min(big.length, 25); }   // the 25 largest single allocations
    if (dt > 30) { slow.push([now(), name, bytes, info, Math.round(dt)]); slow.sort((a, b) => b[4] - a[4]); slow.length = Math.min(slow.length, 30); }
    const all = T.tex + T.buf + T.rb; if (T.tex > peak.tex) peak.tex = T.tex; if (T.buf > peak.buf) peak.buf = T.buf; if (T.rb > peak.rb) peak.rb = T.rb; if (all > peak.all) peak.all = all;
  };
  // bytes a pixel for an internal format (or an unsized format with its type); 4 where it is not known
  const BPP = { 0x1908: 4, 0x8058: 4, 0x8C43: 4, 0x1907: 3, 0x8051: 3, 0x8C41: 3, 0x1909: 1, 0x1906: 1, 0x190A: 2, 0x8229: 1, 0x822B: 2, 0x881A: 8, 0x8814: 16, 0x822D: 2, 0x822E: 4, 0x822F: 4, 0x8230: 8, 0x881B: 6, 0x8815: 12,
    0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 5, 0x1902: 4, 0x84F9: 4, 0x8D62: 2, 0x8056: 2, 0x8057: 2, 0x8C3A: 4, 0x8C3D: 4, 0x8D48: 1 };
  const bpp = f => BPP[f] || 4, fmt = f => '0x' + (f || 0).toString(16);
  const dims = s => s ? [s.videoWidth || s.naturalWidth || s.displayWidth || s.width || 0, s.videoHeight || s.naturalHeight || s.displayHeight || s.height || 0] : [0, 0];
  const setLevel = (gl, target, level, bytes, mips) => {   // mips: the storage was made with its mipmaps counted in, so generateMipmap adds nothing   // the bound texture's own account: bytes per level (and face), so an upload over an old one replaces it
    const face = target >= 0x8515 && target <= 0x851A ? 0x8513 : target, tex = boundTex.get(unit + ':' + face); if (!tex) return;
    let a = texOf.get(tex); if (!a) texOf.set(tex, a = { levels: new Map(), bytes: 0 });
    const k = target + ':' + level, was = a.levels.get(k) || 0; a.levels.set(k, bytes); a.bytes += bytes - was; T.tex += bytes - was; if (mips) a.mips = true;
  };
  const wrap = (P, name, make) => { const f = P[name]; if (typeof f !== 'function') return; P[name] = make(f); };
  const timed = (f, self, args) => { const a = performance.now(), r = f.apply(self, args); return [r, performance.now() - a]; };
  for (const C of [typeof WebGL2RenderingContext !== 'undefined' && WebGL2RenderingContext, typeof WebGLRenderingContext !== 'undefined' && WebGLRenderingContext]) {
    if (!C) continue; const P = C.prototype;
    wrap(P, 'activeTexture', f => function (u) { unit = u; return f.call(this, u); });
    wrap(P, 'bindTexture', f => function (t, x) { boundTex.set(unit + ':' + t, x); return f.call(this, t, x); });
    wrap(P, 'bindBuffer', f => function (t, x) { boundBuf.set(t, x); return f.call(this, t, x); });
    wrap(P, 'bindRenderbuffer', f => function (t, x) { boundRb = x; return f.call(this, t, x); });
    wrap(P, 'createTexture', f => function () { T.texN++; return f.call(this); });
    wrap(P, 'deleteTexture', f => function (x) { const a = x && texOf.get(x); if (a) { T.tex -= a.bytes; texOf.delete(x); } if (x) T.texN--; return f.call(this, x); });
    wrap(P, 'createBuffer', f => function () { T.bufN++; return f.call(this); });
    wrap(P, 'deleteBuffer', f => function (x) { const b = x && bufOf.get(x); if (b) { T.buf -= b; bufOf.delete(x); } if (x) T.bufN--; return f.call(this, x); });
    wrap(P, 'createRenderbuffer', f => function () { T.rbN++; return f.call(this); });
    wrap(P, 'deleteRenderbuffer', f => function (x) { const b = x && rbOf.get(x); if (b) { T.rb -= b; rbOf.delete(x); } if (x) T.rbN--; return f.call(this, x); });
    wrap(P, 'texImage2D', f => function (target, level, internal) {
      const A = arguments, long = A.length >= 9, [w, h] = long ? [A[3], A[4]] : dims(A[5]), bytes = w * h * bpp(internal), [r, dt] = timed(f, this, A);
      setLevel(this, target, level, bytes); T.up += bytes; note('texImage2D', bytes, `${w}x${h} ${fmt(internal)} level ${level}${long && A[8] == null ? ' empty' : ''}`, dt); return r;
    });
    wrap(P, 'texSubImage2D', f => function (target, level, x, y) {
      const A = arguments, long = A.length >= 9, [w, h] = long ? [A[4], A[5]] : dims(A[6]), bytes = w * h * 4, [r, dt] = timed(f, this, A);
      T.up += bytes; note('texSubImage2D', bytes, `${w}x${h} at ${x},${y} level ${level}`, dt); return r;
    });
    wrap(P, 'compressedTexImage2D', f => function (target, level, internal, w, h) {
      const A = arguments, d = A[6], bytes = d && d.byteLength ? d.byteLength : A[5] || 0, [r, dt] = timed(f, this, A);
      setLevel(this, target, level, bytes); T.up += bytes; note('compressedTexImage2D', bytes, `${w}x${h} ${fmt(internal)} level ${level}`, dt); return r;
    });
    wrap(P, 'texStorage2D', f => function (target, levels, internal, w, h) {
      const bytes = Math.round(w * h * bpp(internal) * (levels > 1 ? 4 / 3 : 1)), [r, dt] = timed(f, this, arguments);
      setLevel(this, target, 'all', bytes, levels > 1); note('texStorage2D', bytes, `${w}x${h} ${fmt(internal)} ${levels} levels`, dt); return r;
    });
    for (const n of ['texStorage3D', 'texImage3D']) wrap(P, n, f => function (target, levels, internal, w, h, d) {
      const bytes = Math.round(w * h * d * bpp(internal) * (n === 'texStorage3D' && levels > 1 ? 4 / 3 : 1)), [r, dt] = timed(f, this, arguments);
      setLevel(this, target, n === 'texStorage3D' ? 'all' : levels, bytes, n === 'texStorage3D' && levels > 1); if (n === 'texImage3D') T.up += bytes; note(n, bytes, `${w}x${h}x${d} ${fmt(internal)}`, dt); return r;
    });
    wrap(P, 'texSubImage3D', f => function (target, level, x, y, z, w, h, d) { const bytes = w * h * d * 4, [r, dt] = timed(f, this, arguments); T.up += bytes; note('texSubImage3D', bytes, `${w}x${h}x${d} level ${level}`, dt); return r; });
    wrap(P, 'generateMipmap', f => function (target) {
      const tex = boundTex.get(unit + ':' + target), a = tex && texOf.get(tex), add = a ? Math.round(a.bytes / 3) : 0, [r, dt] = timed(f, this, arguments);
      const grew = a && !a.mips; if (grew) { a.mips = true; a.bytes += add; T.tex += add; } note('generateMipmap', grew ? add : 0, '', dt); return r;
    });
    wrap(P, 'bufferData', f => function (target, d) {
      const bytes = typeof d === 'number' ? d : d && d.byteLength || 0, b = boundBuf.get(target), [r, dt] = timed(f, this, arguments);
      if (b) { T.buf += bytes - (bufOf.get(b) || 0); bufOf.set(b, bytes); } T.up += bytes; note('bufferData', bytes, target === 0x8893 ? 'indices' : 'vertices', dt); return r;
    });
    wrap(P, 'bufferSubData', f => function (target, off, d) { const bytes = d && d.byteLength || 0, [r, dt] = timed(f, this, arguments); T.up += bytes; note('bufferSubData', bytes, `at ${off}`, dt); return r; });
    for (const n of ['renderbufferStorage', 'renderbufferStorageMultisample']) wrap(P, n, f => function () {
      const A = arguments, m = n === 'renderbufferStorageMultisample', s = m ? Math.max(1, A[1]) : 1, internal = A[m ? 2 : 1], w = A[m ? 3 : 2], h = A[m ? 4 : 3], bytes = w * h * bpp(internal) * s, [r, dt] = timed(f, this, A);
      if (boundRb) { T.rb += bytes - (rbOf.get(boundRb) || 0); rbOf.set(boundRb, bytes); } note(n, bytes, `${w}x${h} ${fmt(internal)}${m ? ' x' + s : ''}`, dt); return r;
    });
    wrap(P, 'compileShader', f => function () { const [r, dt] = timed(f, this, arguments); T.shaders++; T.compileMs += dt; note('compileShader', 0, '', dt); return r; });
    wrap(P, 'linkProgram', f => function () { const [r, dt] = timed(f, this, arguments); T.programs++; T.linkMs += dt; note('linkProgram', 0, '', dt); return r; });
    // the calls that make the page wait for the GPU: where a slow compile or a dying GPU process shows as time
    for (const n of ['getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getError', 'readPixels', 'checkFramebufferStatus', 'finish', 'clientWaitSync', 'getUniformLocation', 'getActiveUniform'])
      wrap(P, n, f => function () { const [r, dt] = timed(f, this, arguments); if (dt > 30) note(n, 0, 'waited', dt); return r; });
    wrap(P, 'getExtension', f => function () { if (!firstCanvas && this.canvas) watch(this.canvas); return f.apply(this, arguments); });   // three asks for its extensions as soon as it has a context: the canvas to watch
  }
  function watch(canvas) {
    firstCanvas = canvas;
    canvas.addEventListener('webglcontextlost', () => {
      lost.push({ t: now(), hidden: document.hidden, texMB: MB(T.tex), bufMB: MB(T.buf), rbMB: MB(T.rb), upMB: MB(T.up), texN: T.texN, bufN: T.bufN, shaders: T.shaders, programs: T.programs, ops: T.ops, canvas: [canvas.width, canvas.height], last: ring.slice(-80) });
      T.tex = T.buf = T.rb = 0; T.texN = T.bufN = T.rbN = 0; T.gen++;   // what the GPU held is gone with it: the count starts again
    });
    canvas.addEventListener('webglcontextrestored', () => { if (lost.length) lost[lost.length - 1].back = now(); });
  }
  setInterval(() => { if (timeline.length < 600) timeline.push([now(), MB(T.tex), MB(T.buf), MB(T.rb), MB(T.up), T.ops, T.gen]); }, 500);
  window.__glrec = {
    summary: (tail = 80) => ({ on: true, t: now(), gen: T.gen, texMB: MB(T.tex), bufMB: MB(T.buf), rbMB: MB(T.rb), upMB: MB(T.up), texN: T.texN, bufN: T.bufN, rbN: T.rbN, shaders: T.shaders, programs: T.programs,
      compileMs: Math.round(T.compileMs), linkMs: Math.round(T.linkMs), ops: T.ops, peakMB: { tex: MB(peak.tex), buf: MB(peak.buf), rb: MB(peak.rb), all: MB(peak.all) },
      canvas: firstCanvas ? [firstCanvas.width, firstCanvas.height] : null, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, ram: navigator.deviceMemory || null,
      lost, slow, big, timeline, last: ring.slice(-tail) }),
  };
}
