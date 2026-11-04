// Memory of the built game: where it goes and whether it comes back (docs/PERF.md, "Memory").
//
//   tools/release/withbrowser.sh node tools/perf/memory.mjs [--root dist] [--phone] [--starts 6] [--snap drive|load|starts|none] [--json out.json] [--q a=1&b=2] [--lose] [--shots dir] [--no-drive] [--alloc]
//
// Serves --root (a build, cd tools/build && node build.mjs; --minify=false keeps the class names readable in the heap snapshot) and opens one headless Chrome from
// PD_CHROME, which withbrowser.sh sets (chrome-headless-shell; silent: --mute-audio, --use-angle=metal --enable-gpu). Desktop is 1280x720 at pixel ratio 2 (2048 shadows: the default tier); --phone is 844x390 at 3 with touch.
// Phases, each measured after a full garbage collection:
//   load    ?debug&at= Quattro Canti, 10 s after the loading screen lifts
//   drive   about 3.7 km kinematic (the car placed on the line every frame, 16 m/s): Quattro Canti, Via Maqueda, Politeama, Via della Liberta, Piazza Leoni
//   starts  --starts N rounds of: back to the menu (the sea's "Menu" event, src/ui.js quit), then a start from the picker's list (as a player taps it); the last one is Quattro Canti again
// Numbers per phase:
//   peak          the highest V8 heap + ArrayBuffers since the last phase, garbage included, read every second
//   heapPreGC     performance.memory.usedJSHeapSize before the collection (what a page sees; mostly garbage on the way out)
//   heap          V8 heap used after a full collection (Runtime.getHeapUsage), plus the ArrayBuffer backing stores (typed arrays live outside the V8 heap)
//   canvas2d      live 2D canvases (every canvas that had getContext('2d'), width x height x 4), the WebGL drawing buffer estimate
//   gpu           WebGL buffers and textures as allocated (hooks on bufferData / texStorage / texImage / renderbufferStorage), with mip chains
//   geometry      the JavaScript copy of the geometry in the scene (BufferAttribute arrays, instance arrays)
//   audio         decoded AudioBuffers still alive (length x channels x 4)
//   process       physical footprint of the renderer and GPU processes (macOS footprint): the closest thing here to what iOS counts against a tab
//   lost    with --lose: WEBGL_lose_context after the load, restored 2 s later (a phone can do this in the background): tiles must come back, no errors; screenshots before and after in --shots <dir>
// --snap: a heap snapshot at the end of that phase (streamed and parsed in memory, nothing written to disk), retained sizes by category (src objects the page points
// at: tile JSON, tile grids, geometry arrays, baked data, ...), by constructor, and the biggest dominator subtrees that belong to no category, with their paths.
// The starts are also the leak check: the heap after each start is printed, and the last start goes back to where the load began.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { snapshotParser, analyse } from './heapsnap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const A = process.argv, i = A.findIndex(x => x === '--' + k || x.startsWith('--' + k + '=')); if (i < 0) return d; if (A[i].includes('=')) return A[i].split('=').slice(1).join('='); return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), PHONE = !!arg('phone', false), STARTS = +arg('starts', 6), SNAP = String(arg('snap', 'drive')), Q = arg('q', ''), JSON_OUT = arg('json', '');
const CHROME = process.env.PD_CHROME; if (!CHROME) { console.error('PD_CHROME is not set: run through tools/release/withbrowser.sh'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MB = b => +(b / 1048576).toFixed(1);

// ---------- in the page, before it runs: GL, canvas and audio allocation tallies ----------
function install() {
  const M = window.__mem = { buf: new Map(), tex: new Map(), rb: new Map(), bt: new Map(), bb: new Map(), brb: null, canv: [], canvSeen: new WeakSet(), audio: [], bitmaps: [] };
  const IF = { 32856: 4, 35907: 4, 32855: 2, 36194: 2, 32854: 2, 33321: 1, 33323: 2, 34842: 8, 34836: 16, 33326: 4, 33328: 8, 33325: 2, 33327: 4, 33189: 2, 33190: 4, 35056: 4, 36012: 4, 36013: 8, 6408: 4, 6407: 3, 6403: 1, 6406: 1, 6409: 1, 6410: 2, 33322: 2, 33324: 4, 36168: 1, 33191: 4, 35898: 4, 35901: 4, 36975: 4 };
  const P = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
  if (P) {
    const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { fn.call(this, a); return o.apply(this, a); }; };
    wrap('bindBuffer', a => M.bb.set(a[0], a[1])); wrap('bindTexture', a => M.bt.set(a[0], a[1])); wrap('bindRenderbuffer', a => { M.brb = a[1]; });
    wrap('bufferData', a => { const b = M.bb.get(a[0]); if (b) M.buf.set(b, typeof a[1] === 'number' ? a[1] : a[1] ? a[1].byteLength : 0); });
    wrap('deleteBuffer', a => M.buf.delete(a[0]));
    const face = t => t >= 34069 && t <= 34074;   // cube faces bind as TEXTURE_CUBE_MAP
    const texOf = t => M.bt.get(face(t) ? 34067 : t);
    const lv = (w, h, d, l, b, arr) => { let s = 0; for (let i = 0; i < l; i++) { s += w * h * d * b; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); if (!arr) d = Math.max(1, d >> 1); } return s; };
    wrap('texStorage2D', a => { const t = texOf(a[0]); if (t) M.tex.set(t, { bytes: lv(a[3], a[4], 1, a[1], IF[a[2]] || 4) * (a[0] === 34067 ? 6 : 1), w: a[3], h: a[4], d: 1 }); });
    wrap('texStorage3D', a => { const t = texOf(a[0]); if (t) M.tex.set(t, { bytes: lv(a[3], a[4], a[5], a[1], IF[a[2]] || 4, a[0] === 35866), w: a[3], h: a[4], d: a[5] }); });
    wrap('texImage2D', a => {
      if (a[1] !== 0) return; const t = texOf(a[0]); if (!t) return;
      const c = a.length >= 8, src = a[5], w = c ? a[3] : (src.videoWidth || src.naturalWidth || src.width || 0), h = c ? a[4] : (src.videoHeight || src.naturalHeight || src.height || 0);
      const e = M.tex.get(t) || { bytes: 0, faces: {} }; e.faces = e.faces || {}; e.faces[a[0]] = w * h * (IF[a[2]] || 4); e.bytes = Object.values(e.faces).reduce((s, v) => s + v, 0) * (e.mip ? 4 / 3 : 1); e.w = w; e.h = h; e.d = 1; M.tex.set(t, e);
    });
    wrap('texImage3D', a => { if (a[1] !== 0) return; const t = texOf(a[0]); if (t) M.tex.set(t, { bytes: a[3] * a[4] * a[5] * (IF[a[2]] || 4), w: a[3], h: a[4], d: a[5] }); });
    wrap('generateMipmap', a => { const e = M.tex.get(texOf(a[0])); if (e && !e.mip && e.faces) { e.mip = true; e.bytes *= 4 / 3; } });
    wrap('deleteTexture', a => M.tex.delete(a[0]));
    wrap('renderbufferStorage', a => { if (M.brb) M.rb.set(M.brb, a[2] * a[3] * (IF[a[1]] || 4)); });
    wrap('renderbufferStorageMultisample', a => { if (M.brb) M.rb.set(M.brb, a[3] * a[4] * (IF[a[2]] || 4) * Math.max(1, a[1])); });
    wrap('deleteRenderbuffer', a => M.rb.delete(a[0]));
  }
  for (const C of [window.HTMLCanvasElement, window.OffscreenCanvas]) {
    if (!C) continue; const o = C.prototype.getContext;
    C.prototype.getContext = function (kind, opts) { const r = o.call(this, kind, opts); if (r && !M.canvSeen.has(this)) { M.canvSeen.add(this); M.canv.push({ c: new WeakRef(this), kind: String(kind), at: (new Error().stack || '').split('\n').slice(2, 5).map(l => l.trim().replace(/^at /, '').replace(/\(?http[^ ]*\/(js\/)?/, '').replace(/:\d+\)?$/, '')).join(' < ').slice(0, 110) }); } return r; };
  }
  const AC = window.BaseAudioContext || window.AudioContext;
  if (AC) {
    const dec = AC.prototype.decodeAudioData, cb = AC.prototype.createBuffer;
    const keep = b => { if (b) M.audio.push(new WeakRef(b)); return b; };
    AC.prototype.decodeAudioData = function (data, ok, no) { const p = dec.call(this, data, b => { keep(b); ok && ok(b); }, no); return p && p.then ? p.then(b => { if (!ok) keep(b); return b; }) : p; };
    AC.prototype.createBuffer = function (...a) { return keep(cb.apply(this, a)); };
  }
  if (window.createImageBitmap) { const o = window.createImageBitmap; window.createImageBitmap = function (...a) { return o.apply(this, a).then(b => { M.bitmaps.push(new WeakRef(b)); return b; }); }; }
}

// ---------- in the page: what it holds now ----------
function tally() {
  const g = window.game, M = window.__mem, out = {};
  let gb = 0, gt = 0, gr = 0; for (const v of M.buf.values()) gb += v; for (const v of M.tex.values()) gt += v.bytes; for (const v of M.rb.values()) gr += v;
  const big = [...M.tex.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(e => `${e.w}x${e.h}${e.d > 1 ? 'x' + e.d : ''} ${(e.bytes / 1048576).toFixed(1)}`);
  const cv = g.renderer.domElement, aa = g.renderer.getContextAttributes ? g.renderer.getContext().getContextAttributes().antialias : true;
  const drawBuf = cv.width * cv.height * 8 * (aa ? 5 : 1);   // colour + depth/stencil, and the 4x multisampled copy when antialiased
  out.gpu = { buffers: gb, textures: gt, renderbuffers: gr, drawingBuffer: drawBuf, total: gb + gt + gr + drawBuf, nBuffers: M.buf.size, nTextures: M.tex.size, bigTextures: big, info: { ...g.renderer.info.memory } };
  let c2 = 0, n2 = 0, cgl = 0; const bigC = new Map();
  for (const r of M.canv) { const c = r.c.deref(); if (!c) continue; if (r.kind === '2d') { const b = c.width * c.height * 4; c2 += b; n2++; const k = r.at.replace(/ app\.[0-9a-f]+\.js/g, ''), e = bigC.get(k) || [0, 0, '']; e[0] += b; e[1]++; e[2] = c.width + 'x' + c.height; bigC.set(k, e); } else cgl++; }
  out.canvas = { canvas2d: c2, n2d: n2, webgl: cgl, big: [...bigC].sort((a, b) => b[1][0] - a[1][0]).slice(0, 18).map(([k, e]) => `${(e[0] / 1048576).toFixed(1)} MB, ${e[1]} x ${e[2]}: ${k}`) };
  let au = 0, na = 0; for (const r of M.audio) { const b = r.deref(); if (b) { au += b.length * b.numberOfChannels * 4; na++; } }
  let bm = 0; for (const r of M.bitmaps) { const b = r.deref(); if (b && b.width) bm += b.width * b.height * 4; }
  out.audio = { bytes: au, buffers: na }; out.bitmaps = bm;
  // the JavaScript copy of the geometry: unique arrays of everything under the scene
  const seen = new Set(); let geo = 0, inst = 0, idx = 0, nGeo = 0, released = 0;
  const arr = a => { if (!a || !a.array || seen.has(a.array)) return 0; seen.add(a.array); return a.array.byteLength || 0; };
  const gseen = new Set(), byName = new Map(), part = new Map();
  for (const t of g.world.tiles.values()) for (const k in t.parts) t.parts[k].traverse(o => part.set(o, k.replace(/^lm:.*/, 'landmark')));   // which world part a mesh belongs to
  g.scene.traverse(o => {
    const q = o.geometry; let b = 0;
    if (q && !gseen.has(q)) { gseen.add(q); nGeo++; for (const k in q.attributes) { const a = q.attributes[k]; const d = a.isInterleavedBufferAttribute ? arr(a.data) : arr(a); geo += d; b += d; if (!a.array || a.array.length === 0) released++; } if (q.index) { const d = arr(q.index); idx += d; b += d; } }
    if (o.isInstancedMesh) { const d = arr(o.instanceMatrix) + arr(o.instanceColor); inst += d; b += d; }
    if (b) { let p = o, k = null; while (p && !(k = part.get(p))) p = p.parent; k = k ? 'world ' + k : (o.name || o.type).replace(/[_\d.:-]+.*$/, '') || o.type; if (k === 'Mesh' && o.parent) k += ' in ' + (o.parent.name || o.parent.type).replace(/[_\d.:-]+.*$/, ''); byName.set(k, (byName.get(k) || 0) + b); }
  });
  out.geometry = { attributes: geo, index: idx, instances: inst, total: geo + idx + inst, geometries: nGeo, releasedAttributes: released, byOwner: [...byName].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${(v / 1048576).toFixed(1)}`) };
  const w = g.world, s = w.stats();
  out.world = { tiles: s.tiles, full: s.lod2, low: s.lod1, far: s.lod0, cache: s.cache, withData: [...w.tiles.values()].filter(t => t.data).length, walls: s.walls, roadVerts: s.roadVerts, fetched: s.fetched, workMax: +s.workMax.toFixed(1), hitches: s.hitches, slow: (s.slow || []).slice(-6) };
  out.render = { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
  out.dom = document.getElementsByTagName('*').length;
  return out;
}

// ---------- in the page: what each snapshot category points at ----------
function probe() {
  const g = window.game, w = g.world, P = {}, add = (k, o) => { if (o && (typeof o === 'object' || typeof o === 'function')) (P[k] = P[k] || []).push(o); };
  for (const t of w.tiles.values()) {
    add('tile JSON (resident tiles)', t.data);
    for (const k of ['nearS', 'shape', 'raised', 'hard', 'sandb', 'roofs', 'gt', 'tint', 'gsegs']) add('tile grids, masks, roofs', t[k]);
  }
  for (const id of Object.keys(w.manifest.tiles)) { const [i, j] = id.split('_').map(Number), t = w.tiles.get((i + 200) * 1000 + (j + 200)); if (t && t.data) continue; const d = w.tileData(i, j); if (d) add('tile JSON (parsed-tile LRU)', d); }
  add('world manifest', w.manifest);
  const seen = new Set();
  const arr = (k, a) => { if (a && a.array && !seen.has(a.array)) { seen.add(a.array); add(k, a.array); } };
  g.scene.traverse(o => {
    const q = o.geometry;
    if (q) { for (const n in q.attributes) { const a = q.attributes[n]; arr('geometry arrays (CPU copy)', a.isInterleavedBufferAttribute ? a.data : a); } if (q.index) arr('geometry arrays (CPU copy)', q.index); }
    if (o.isInstancedMesh) { arr('instance arrays', o.instanceMatrix); arr('instance arrays', o.instanceColor); }
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k in m) { const t = m[k]; if (t && t.isTexture && t.image && t.image.data && !seen.has(t.image.data)) { seen.add(t.image.data); add('texture pixels kept in JS', t.image.data); } }
  });
  for (const k of Object.keys(window)) if (/^(PALERMO_|PD_)[A-Z_]+$/.test(k)) add('baked data ' + k, window[k]);
  add('collision and street grids', g.walls2d);
  window.__memProbe = P;
  const n = {}; for (const k in P) n[k] = P[k].length; return n;
}

// ---------- browser side ----------
const { server, port } = await startServer(ROOT, ROOT);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', protocolTimeout: 900000,
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
browser.on('disconnected', () => console.log('  [browser disconnected]', new Date().toISOString(), 'exit', browser.process()?.exitCode, browser.process()?.signalCode));
const bye = async c => { clearInterval(poll); await browser.close().catch(() => {}); server.close(); process.exit(c); };
process.on('uncaughtException', e => { console.error(e); bye(1); });
process.on('unhandledRejection', e => { console.error(e); bye(1); });
const page = await browser.newPage();
await page.setViewport(PHONE ? { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true } : { width: 1280, height: 720, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push((e.stack || e.message).slice(0, 500)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('error', e => errors.push('[crashed] ' + e.message.slice(0, 200)));
await page.evaluateOnNewDocument(install);
const cdp = await page.createCDPSession();
await cdp.send('HeapProfiler.enable');

async function procs() {   // physical footprint (MB) of the renderer of this page and of the GPU process, macOS `footprint`
  const c = await browser.target().createCDPSession(); const { processInfo } = await c.send('SystemInfo.getProcessInfo'); await c.detach();
  const out = {};
  for (const p of processInfo) {
    if (p.type !== 'renderer' && p.type !== 'GPU') continue;
    let fp = 0; try { const t = execFileSync('footprint', ['-p', String(p.id), '--noCategories', '-f', 'bytes'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); const m = t.match(/Footprint:\s*([\d.]+)\s*B/); fp = m ? +m[1] : 0; } catch (e) { /* not allowed */ }
    out[p.type] = Math.max(out[p.type] || 0, fp);
  }
  return out;
}
// the high water mark since the last measure: V8 heap + ArrayBuffers, garbage included, read every second (a tab is killed at its peak, not at its settled size)
let peak = 0, poll = null;
const watchPeak = () => { poll = setInterval(() => { cdp.send('Runtime.getHeapUsage').then(h => { peak = Math.max(peak, h.usedSize + (h.backingStorageSize || 0)); }).catch(() => {}); }, 1000); };
async function gc() { for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(300); } }
async function measure(label) {
  const pre = await page.evaluate(() => performance.memory.usedJSHeapSize), pk = peak; peak = 0;
  await gc();
  const hu = await cdp.send('Runtime.getHeapUsage');
  const t = await page.evaluate(tally), pr = await procs();
  const r = { label, peak: pk, heapPreGC: pre, heap: hu.usedSize, heapTotal: hu.totalSize, arrayBuffers: hu.backingStorageSize || 0, embedder: hu.embedderHeapUsedSize || 0, process: pr, ...t };
  const row = `${label.padEnd(12)} peak ${MB(pk)} | heap pre-GC ${MB(pre)} | heap ${MB(hu.usedSize)} + ArrayBuffers ${MB(r.arrayBuffers)} MB | canvas2d ${MB(t.canvas.canvas2d)} (${t.canvas.n2d}) | geometry JS ${MB(t.geometry.total)} | GPU ${MB(t.gpu.total)} (buf ${MB(t.gpu.buffers)}, tex ${MB(t.gpu.textures)}, rb ${MB(t.gpu.renderbuffers)}, fb ${MB(t.gpu.drawingBuffer)}) | audio ${MB(t.audio.bytes)} | renderer ${MB(pr.renderer || 0)} GPU proc ${MB(pr.GPU || 0)} MB | tiles ${t.world.full}/${t.world.low}/${t.world.far} data ${t.world.withData} lru ${t.world.cache}`;
  console.log(row);
  console.log(`             geometry by owner (MB): ${t.geometry.byOwner.join(', ')}\n             big canvases:\n               ${t.canvas.big.join('\n               ')}\n             big textures (MB): ${t.gpu.bigTextures.join(', ')}`);
  return r;
}
async function snapshot(label) {
  const counts = await page.evaluate(probe);
  await gc();
  const p = snapshotParser(); const on = e => p.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
  const t0 = Date.now();
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
  await page.evaluate(() => { delete window.__memProbe; });
  const S = p.end(), A = analyse(S);
  console.log(`\n== heap snapshot after ${label}: ${S.nodeCount} nodes, ${S.edgeCount} edges, ${A.R} reachable (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return report(A, counts);
}

// categories: every node goes to the category of the nearest dominator the probe points at
function report(A, counts) {
  const N = A.N; let probeNode = -1;
  for (let v = 0; v < N && probeNode < 0; v++) A.edgesOf(v, (t, n, w) => { if (probeNode < 0 && n === '__memProbe' && t === 'property') probeNode = w; });
  const catOf = new Int32Array(N).fill(-1), cats = [];
  if (probeNode >= 0) A.edgesOf(probeNode, (t, n, arr) => {
    if (t !== 'property' || !Object.hasOwn(counts, n)) return; const c = cats.length; cats.push(n);
    A.edgesOf(arr, (t2, i, w) => { if (t2 === 'element') catOf[w] = c; });
  });
  // walk the dominator tree from the root (children after parents): a node inherits its dominator's category
  const kids = new Int32Array(N + 1); for (let v = 0; v < N; v++) if (A.idom[v] >= 0) kids[A.idom[v] + 1]++;
  for (let v = 0; v < N; v++) kids[v + 1] += kids[v];
  const ch = new Int32Array(kids[N]), f = kids.slice(0, N); for (let v = 0; v < N; v++) if (A.idom[v] >= 0) ch[f[A.idom[v]]++] = v;
  const cat = new Int32Array(N).fill(-1), st = [0], self = new Float64Array(cats.length + 1);
  while (st.length) { const v = st.pop(); cat[v] = catOf[v] >= 0 ? catOf[v] : v === 0 ? -1 : cat[A.idom[v]]; self[cat[v] + 1] += A.self(v); for (let k = kids[v]; k < kids[v + 1]; k++) st.push(ch[k]); }
  const total = self.reduce((s, x) => s + x, 0);
  const byCat = cats.map((c, i) => [c, self[i + 1], counts[c]]).sort((a, b) => b[1] - a[1]);
  console.log(`total reachable ${MB(total)} MB (V8 heap + ArrayBuffer backing stores)`);
  for (const [c, b, n] of byCat) console.log(`  ${String(MB(b)).padStart(7)} MB  ${c} (${n})`);
  console.log(`  ${String(MB(self[0])).padStart(7)} MB  everything else`);
  // everything else, by constructor (self size) and by node type
  const byName = new Map(), byType = new Map();
  for (let v = 0; v < N; v++) { if (cat[v] !== -1 || !A.reachable(v)) continue; const k = A.type(v) + ' ' + A.name(v).slice(0, 60); byName.set(k, (byName.get(k) || 0) + A.self(v)); byType.set(A.type(v), (byType.get(A.type(v)) || 0) + A.self(v)); }
  console.log('  everything else by node type:', [...byType].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${MB(v)}`).join(', '));
  console.log('  everything else by constructor (self MB):');
  for (const [k, v] of [...byName].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${String(MB(v)).padStart(7)}  ${k}`);
  // the biggest subtrees of the rest, with their dominator path
  const label = v => { let e = ''; const d = A.idom[v]; if (d >= 0) A.edgesOf(d, (t, n, w) => { if (!e && w === v) e = typeof n === 'number' ? `[${n}]` : String(n).slice(0, 40); }); return `${e ? e + ': ' : ''}${A.type(v) === 'object' || A.type(v) === 'closure' ? A.name(v).slice(0, 50) : A.type(v) + ' ' + A.name(v).slice(0, 30)}`; };
  const rest = new Float64Array(N);   // retained size counting only nodes of no category
  { const ord = []; const s2 = [0]; while (s2.length) { const v = s2.pop(); ord.push(v); for (let k = kids[v]; k < kids[v + 1]; k++) s2.push(ch[k]); }
    for (let q = ord.length - 1; q >= 0; q--) { const v = ord[q]; if (cat[v] === -1) rest[v] += A.self(v); const d = A.idom[v]; if (d >= 0) rest[d] += rest[v]; } }
  console.log('  biggest subtrees outside the categories (MB retained, dominator path):');
  const out = [], THR = 0.75 * 1048576;
  const walk = (v, path) => {   // down to the deepest nodes that still hold THR bytes: those are what actually holds the memory
    const c = []; let inKids = 0; for (let k = kids[v]; k < kids[v + 1]; k++) if (rest[ch[k]] >= THR) { c.push(ch[k]); inKids += rest[ch[k]]; }
    if (!c.length || rest[v] - inKids >= THR) out.push([rest[v] - inKids, path]);
    for (const w of c) walk(w, path.concat(label(w)));
  };
  walk(0, []);
  for (const [b, p2] of out.sort((a, b) => b[0] - a[0]).slice(0, 40)) console.log(`    ${String(MB(b)).padStart(7)}  ${p2.slice(-7).join(' > ')}`);
  return { total, categories: Object.fromEntries(byCat.map(([c, b]) => [c, b])), rest: self[0], topRest: out.slice(0, 20).map(([b, p2]) => [MB(b), p2.join(' > ')]), byType: Object.fromEntries(byType) };
}

// Runs in the page: the car placed along the waypoints at v m/s, frame gaps recorded
async function drive(v) {
  const g = window.game, W = [[38.115684, 13.36146], [38.1199, 13.3573], [38.1247846, 13.3559943], [38.1315626, 13.3522947], [38.1387821, 13.3465045], [38.146826, 13.3433865]].map(p => g.proj(p[0], p[1]));
  const gaps = []; let seg = 0, u = 0, last = performance.now(), dist = 0;
  g.world.resetStats(); if (g.world.stats().slow) g.world.stats().slow.length = 0;
  await new Promise(res => { const f = () => {
    const now = performance.now(), dt = Math.min(100, now - last); last = now; gaps.push(dt);
    if (seg >= W.length - 1) return res();
    const a = W[seg], b = W[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); u += v * dt / 1000 / len; dist += v * dt / 1000; if (u >= 1) { u = 0; seg++; }
    const q = W[Math.min(seg, W.length - 2)], w = W[Math.min(seg + 1, W.length - 1)];
    try { g.placeAt(q[0] + (w[0] - q[0]) * u, q[1] + (w[1] - q[1]) * u, Math.atan2(w[0] - q[0], w[1] - q[1])); } catch (e) { /* between roads */ }
    requestAnimationFrame(f);
  }; requestAnimationFrame(f); });
  const s = [...gaps].sort((a, b) => a - b), st = g.world.stats();
  return { km: +(dist / 1000).toFixed(2), frames: gaps.length, gapP50: +s[s.length >> 1].toFixed(1), gapP95: +s[Math.floor(s.length * 0.95)].toFixed(1), gapP99: +s[Math.floor(s.length * 0.99)].toFixed(1), gapMax: +s[s.length - 1].toFixed(1), over33: gaps.filter(x => x > 33.4).length, over50: gaps.filter(x => x > 50).length,
    streamWorkMax: +st.workMax.toFixed(1), streamAvg: +st.avgWork.toFixed(2), streamOver8: st.hitches, slowSteps: (st.slow || []).slice().sort((a, b) => b[0] - a[0]).slice(0, 6) };
}

// one start as a player makes it: menu (from the play state: the sea's Menu event), then Drive, the list, a start point
async function start(spotIndex) {
  const tryClick = async (sel, done, what) => {   // the shell ignores clicks while a transition covers it
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate(done)) return true;
      await page.evaluate(s => { const b = document.querySelector(s); if (b && b.offsetParent !== null) b.click(); }, sel);
      await sleep(500);
    }
    errors.push('stuck: ' + what); return false;
  };
  await page.evaluate(() => { dispatchEvent(new Event('pd-quit-to-title', { cancelable: true })); });
  await sleep(2000);
  await tryClick('[data-do=drive]', () => document.querySelector('.pd-screen.on')?.dataset.name === 'start' || !!document.querySelector('.pd-startlist')?.offsetParent, 'the menu never reached the picker');
  await tryClick('[data-do=viewList]', () => !!document.querySelector('[data-pt]')?.offsetParent, 'the list never showed');
  const name = await page.evaluate(i => document.querySelector(`[data-pt="s:${i}"]`)?.textContent, spotIndex);
  await tryClick(`[data-pt="s:${spotIndex}"]`, () => !document.querySelector('.pd-screen.on'), 'the start never happened');
  await page.waitForFunction(() => window.game.world.visiblePending() === 0, { timeout: 60000, polling: 250 }).catch(() => errors.push('view never built after a start'));
  await sleep(5000);
  return name;
}

const [qx, qz] = [17.5, 0];
const t0 = Date.now();
watchPeak();
const ALLOC = !!arg('alloc', false);   // --alloc: sampling allocation profile of the load, garbage included: who churns the heap
if (ALLOC) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await page.goto(`http://127.0.0.1:${port}/?help=0&p2p=off&debug&at=${qx},${qz},0${Q ? '&' + Q : ''}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
console.log(`root ${ROOT}, ${PHONE ? 'phone 844x390 @3' : 'desktop 1280x720 @2'}, loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await sleep(10000);
if (ALLOC) {
  const prof = (await cdp.send('HeapProfiler.stopSampling')).profile, by = new Map(); let tot = 0;
  const walk = nd => { const k = `${nd.callFrame.functionName || '(anon)'}:${nd.callFrame.lineNumber + 1}`; by.set(k, (by.get(k) || 0) + nd.selfSize); tot += nd.selfSize; for (const c of nd.children) walk(c); }; walk(prof.head);
  console.log(`allocated during load (V8 heap, garbage included): ${MB(tot)} MB`);
  for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(MB(v)).padStart(7)}  ${k}`);
}
const R = { phases: [] };
R.phases.push(await measure('load'));
if (SNAP === 'load') R.snapLoad = await snapshot('load');
if (arg('lose', false)) {
  const SHOTS = String(arg('shots', '') || ''), shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  await shot('before-lost');
  await page.evaluate(() => { window.__lose = window.game.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); const M = window.__mem; M.buf.clear(); M.tex.clear(); M.rb.clear(); });
  await sleep(2000);
  const t1 = Date.now();
  await page.evaluate(() => window.__lose.restoreContext());
  await sleep(1500);
  await page.waitForFunction(() => window.game.world.visiblePending() === 0 && window.game.world.tiles.size > 0, { timeout: 120000, polling: 250 }).catch(() => errors.push('tiles never came back after the lost context'));
  console.log(`lost context: view rebuilt in ${((Date.now() - t1) / 1000).toFixed(1)} s, state ${await page.evaluate(() => window.game.world.stats().lod2 + ' full tiles')}`);
  await sleep(8000);
  await shot('after-lost');
  R.phases.push(await measure('lost'));
}
if (!arg('no-drive', false)) {
  R.drive = await page.evaluate(drive, 16);
  console.log('drive', JSON.stringify(R.drive));
  await sleep(5000);
  R.phases.push(await measure('drive'));
  if (SNAP === 'drive') R.snapDrive = await snapshot('drive');
}
// starts: spots of the picker's list (src/main.js SPOTS order), far apart, then Quattro Canti (index 0) again
const order = [18, 12, 15, 37, 20, 6, 41, 23, 9, 30, 16, 2, 26, 34, 14, 19, 7, 21, 11, 29];
R.starts = [];
for (let n = 0; n < STARTS; n++) {
  const k = n === STARTS - 1 ? 0 : order[n % order.length];
  const nm = await start(k);
  await gc();
  const hu = await cdp.send('Runtime.getHeapUsage'), t = await page.evaluate(tally);
  const row = { n: n + 1, spot: nm, heap: hu.usedSize, arrayBuffers: hu.backingStorageSize || 0, canvas2d: t.canvas.canvas2d, gpu: t.gpu.total, geometry: t.geometry.total, tiles: `${t.world.full}/${t.world.low}/${t.world.far}`, audio: t.audio.bytes, dom: t.dom };
  R.starts.push(row);
  console.log(`start ${String(n + 1).padStart(2)} ${String(nm).slice(0, 34).padEnd(34)} heap ${MB(row.heap)} + AB ${MB(row.arrayBuffers)} | canvas2d ${MB(row.canvas2d)} | GPU ${MB(row.gpu)} | geometry ${MB(row.geometry)} | tiles ${row.tiles} | dom ${row.dom}`);
}
if (STARTS) R.phases.push(await measure('starts'));
if (SNAP === 'starts') R.snapStarts = await snapshot('starts');
R.errors = errors;
console.log('errors:', errors.length ? errors.length + ' x\n  ' + [...new Set(errors)].join('\n  ') : 'none');
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(R, null, 1));
await bye(0);
