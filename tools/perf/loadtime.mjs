// Where the time goes from navigation to the first playable frame, and from there to "settled" (nothing left building), with the main thread slowed by CDP.
//   cd tools/build && node build.mjs --out=$HOME/.cache/palermo-drive/load/prod                      # the shipped bundle: milestones, the wire, shaders, textures, script compile (--trace)
//   cd tools/build && node build.mjs --minify=false --out=$HOME/.cache/palermo-drive/load/dev        # a readable bundle: what the main thread was doing, by module and by tile stage (--prof)
//   tools/release/withbrowser.sh node tools/perf/loadtime.mjs --root <dist> [--cpu 1,6,16] [--prof 1 | --trace 1] [--net kbps,ms] [--max 300] [--label x] [--out dir] [--q 'extra=query']
// Per slowdown: one cold page load (no cache, a new profile) on the phone's window (844x390 at DPR 3), the game left alone after its loading screen lifts until nothing is building any more, or --max seconds.
//   always   milestones on the page clock (navigation = 0): data blobs fetched, first GL draw, loading screen out, the world's queue empty, the frame cost back to its steady value, crowd and traffic at their targets;
//            every file fetched, with its size on the wire (gzip as GitHub Pages sends it), when it started and ended; WebGL shader compiles (count, time in the calls), texture uploads, canvases made, canvas pixel reads/writes
//   --prof   the sampling profiler (1 ms) over the whole load: main-thread time by what it was doing (module, tile stage), in phases and in 10 s slices. Needs the readable bundle (esbuild's "// src/x.js" markers); the prod bundle only gives (program)/(gc)/idle.
//   --trace  a trace of the shipped bundle: script parse and compile (v8.compile), GC, layout and style, task time. A profile and a trace together would slow each other down, so they are separate runs.
// What the throttle can and cannot stand in for: CDP slows the renderer's main thread only. JS, parse and compile, decode of the data blobs, tile building, GC and the DOM scale with it. The network (here: localhost, or --net),
// the disk, the GPU process (shader compiles, texture uploads' driver work, the draw), image decoding on worker threads do not. Never read a phone's load time off these numbers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), OUT = path.resolve(arg('out', '.')), LABEL = arg('label', 'load');
const CPUS = String(arg('cpu', '1,6,16')).split(',').map(Number), MAX = +arg('max', 300), PROF = !!arg('prof', ''), TRACE = !!arg('trace', ''), QUERY = arg('q', '');
const EXP = arg('exp', '');
const NET = arg('net', '') ? String(arg('net')).split(',').map(Number) : null;   // kbps, round trip ms
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const f1 = v => (+v).toFixed(1), f0 = v => String(Math.round(+v)), kb = b => (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
const median = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0;

// ---------- readable bundle: which module a line of it belongs to
const appFile = fs.readdirSync(path.join(ROOT, 'js')).find(f => /^app\..*\.js$/.test(f));
const bundle = fs.readFileSync(path.join(ROOT, 'js', appFile), 'utf8').split('\n');
const modStart = []; bundle.forEach((l, i) => { const m = l.match(/^\/\/ ((?:[^\s]+\/)?[^\s/]+\.m?js)$/); if (m) modStart.push([i, m[1].replace(/^.*node_modules\//, '').replace(/^.*?(?=(^|\/)src\/)\/?/, '').replace(/^(\.\.\/)+/, '')]); });
const readable = modStart.length >= 10;
if (PROF && !readable) console.error('warning: --prof needs a bundle built with --minify=false (no module markers in ' + appFile + ')');
const moduleAt = line => { let a = 0, b = modStart.length - 1, r = null; while (a <= b) { const m = (a + b) >> 1; if (modStart[m][0] <= line) { r = modStart[m][1]; a = m + 1; } else b = m - 1; } return r || '?'; };

// ---------- page side
const PAGE = exp => {
  performance.setResourceTimingBufferSize(3000);
  const now = () => performance.now(), P = window.__lt = { out: -1, draw: -1, frames: 0, work: [], series: [], gl: {}, ev: [], cv: { n: 0, px: 0, max: 0 }, c2: {}, errs: [], tl: [], tprev: {} };
  addEventListener('error', e => P.errs.push(String(e.message).slice(0, 200)));
  const add = (o, k, ms, n = 1, bytes = 0) => { const q = o[k] || (o[k] = { n: 0, ms: 0, bytes: 0 }); q.n += n; q.ms += ms; q.bytes += bytes; };
  // (made with new Function so that the profiler shows the wrapper under the name of the call it wraps)
  const wrap = (proto, k, bucket, where, bytesOf) => {
    const f = proto && proto[k]; if (typeof f !== 'function') return;
    proto[k] = new Function('f', 'add', 'now', 'where', 'bucket', 'bytesOf', 'ev', `return function ${k.replace(/\W/g, '_')}() { const t = now(); try { return f.apply(this, arguments); } finally { const d = now() - t; add(where, bucket, d, 1, bytesOf ? bytesOf(arguments) : 0); if (bucket === 'linkProgram' || bucket === 'compileShader') ev.push([bucket, t, d]); } };`)(f, add, now, where, bucket || k, bytesOf, P.ev);
  };
  const tex = off => a => { const o = a[a.length - 1]; if (o && o.width && o.height) return o.width * o.height * 4; return a.length >= 9 ? a[off] * a[off + 1] * 4 : 0; };   // (upload size as RGBA8: mips and format aside)
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue; const p = C.prototype;
    for (const k of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'createProgram', 'generateMipmap', 'bufferData', 'bufferSubData', 'texStorage2D', 'texStorage3D', 'compressedTexImage2D']) wrap(p, k, k, P.gl);
    wrap(p, 'texImage2D', 'texImage2D', P.gl, tex(3)); wrap(p, 'texSubImage2D', 'texSubImage2D', P.gl, tex(4)); wrap(p, 'texImage3D', 'texImage3D', P.gl); wrap(p, 'texSubImage3D', 'texSubImage3D', P.gl);
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const f = p[k]; p[k] = function () { if (P.draw < 0) P.draw = now(); return f.apply(this, arguments); }; }
  }
  const gc = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (t) { if (!seen.has(this)) { seen.add(this); if (this.id !== 'view') { P.cv.n++; const px = this.width * this.height; P.cv.px += px; P.cv.max = Math.max(P.cv.max, px); } } return gc.apply(this, arguments); };
  const c2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  for (const k of ['getImageData', 'putImageData', 'drawImage']) wrap(c2, k, k, P.c2);
  for (const k of ['toDataURL', 'toBlob']) wrap(HTMLCanvasElement.prototype, k, k, P.c2);
  const cib = window.createImageBitmap; if (cib) window.createImageBitmap = function () { const t = now(); return cib.apply(this, arguments).finally(() => add(P.c2, 'createImageBitmap(async)', now() - t)); };
  // frames: the page's own work in each animation frame
  const raf = window.requestAnimationFrame.bind(window); let ft = -1, cur = 0, last = 0;
  window.requestAnimationFrame = cb => raf(t => { const a = now(); cb(t); const b = now(); if (t !== ft) { if (ft >= 0) { P.work.push([last, cur]); P.frames++; } ft = t; cur = 0; last = a; } cur += b - a; });
  let seenLoading = false; new MutationObserver(() => { const el = document.getElementById('loading'); if (el) seenLoading = true; if (P.out < 0 && seenLoading && (!el || el.classList.contains('out'))) P.out = now(); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  addEventListener('DOMContentLoaded', () => { P.dcl = now(); if (exp === 'noanim') { const st = document.createElement('style'); st.textContent = '#loading::after { animation: none !important; }'; document.head.appendChild(st); } });   // EXPERIMENT noanim: the loading screen's moving bar stopped
  // the state of the world, twice a second
  let patched = false;
  setInterval(() => {
    if (!patched && window.game && window.game.renderer && exp === 'skipdraw') { patched = true; const r = window.game.renderer, o = r.render.bind(r); r.render = (a, b) => { const el = document.getElementById('loading'); if (el && !el.classList.contains('out')) return; return o(a, b); }; }   // EXPERIMENT: no draw while the opaque loading screen is up
    const g = window.game, w = g && g.world, M = window.__missions, X = M && M.X, ps = X && X.pedestrians && X.pedestrians.stats, tr = g && g.traffic;
    if (!w || !w.stats) return;
    { const cur = new Map(); for (const [k, t] of w.tiles) cur.set(k, t); for (const [k, t] of cur) { const key = t.i + '_' + t.j, v = t.lod + '/' + t.want + (t.hasFull ? 'f' : ''); if (P.tprev[key] !== v) { P.tprev[key] = v; P.tl.push([Math.round(now()), key, v]); } } for (const key in P.tprev) if (!([...cur.values()].some(t => t.i + '_' + t.j === key)) && P.tprev[key] !== 'gone') { P.tprev[key] = 'gone'; P.tl.push([Math.round(now()), key, 'gone']); } }
    const s = w.stats(), l = g.lean && g.lean.stats && g.lean.stats();
    P.series.push([Math.round(now()), s.queued, s.pending, s.inflight, w.visiblePending(), s.lod2, s.lod1, s.lod0, ps ? ps.count : -1, ps ? Math.round(ps.target) : -1, tr && tr.vehicles ? tr.vehicles.length : -1, l ? l.pendingBoxes : -1, s.geometries, s.textures, s.heapMB, Math.round(s.workSum), s.far ? (s.far.pending !== undefined ? s.far.pending : -1) : -1]);
  }, 500);
};

// ---------- profile: what the main thread was doing, by sample
const STAGES = { computeShape: 'tile: shape (ground heights)', terrainMesh: 'tile: terrain mesh', paveFieldIter: 'tile: terrain mesh', roadFieldIter: 'tile: terrain mesh', streetsIter: 'tile: streets', roadMarksIter: 'tile: road paint', sideZebrasIter: 'tile: road paint',
  buildBuildingsIter: 'tile: buildings (full)', lowBuildings: 'tile: buildings (low)', registerPhysics: 'tile: wall collision', buildRaised: 'tile: raised-ground masks', buildFences: 'tile: fences', buildTram: 'tile: trams', buildTracks: 'tile: tracks', buildTrees: 'tile: trees',
  buildQuayMeshes: 'tile: quays', downgrade: 'tile: downgrade', fetchTile: 'tile: fetch and decode' };
const MODS = [[/^runtime\/decode|loader\.js/, 'data decode (blobs, tiles)'], [/pedestrians/, 'crowd'], [/traffic|driver|police/, 'traffic'], [/roadwear/, 'road wear'], [/(^|\/)(sea|boats)\.js/, 'sea'], [/\/(props|markets|markets-data|trees|treegeo|gardens)\.js/, 'props, markets, trees'],
  [/\/(context|hills|far)[^/]*\.js/, 'far city'], [/landmarks|lmc-|hero-facades|expressway/, 'landmarks'], [/\/(buildings|facade|shading|slice|streets|textures|fence|fences|fence-walls|trams|bridges|quays|core|districts)[^/]*\.js/, 'tile builders (other)'], [/world\.js/, 'world (other)'], [/daynight|clouds|weather/, 'sky, clouds, weather'],
  [/audio|music|radio|horn|sound/, 'audio'], [/minimap/, 'minimap'], [/\/(ui|hud|shouts|mobile|lang|coords|event-hud|danger-hud|garage[^/]*|loading-tips)\.js/, 'UI and HUD'], [/engine-lean|lean/, 'draw path (lean engine)'], [/^three/, 'three.js'], [/main\.js|vehicle|physics|camera/, 'vehicle, physics, main loop']];
function classify(stack) {   // stack: root to leaf, [{fn, mod}]
  for (const q of stack) { if (q.fn === 'paintAtlas') return 'building atlas painting (canvas)'; if (q.fn === 'wallTextureSteps' || q.fn === 'pixels') return 'wall textures (canvas)'; }
  for (let i = 0; i < stack.length; i++) { const s = STAGES[stack[i].fn]; if (s) return s; }   // the outermost stage function: terrainMesh calls paveFieldIter
  const leaf = stack[stack.length - 1];
  for (let i = stack.length - 1; i >= 0; i--) { const m = stack[i].mod; for (const [re, name] of MODS) if (re.test(m)) return name; }
  return leaf ? 'other: ' + leaf.mod : 'other';
}
function analyse(profile, offset, tEnd, phases) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  for (const n of profile.nodes) for (const c of n.children || []) nodes.get(c).parent = n.id;
  const cache = new Map();
  const cat = id => {
    if (cache.has(id)) return cache.get(id);
    const n = nodes.get(id), cf = n.callFrame; let r;
    if (cf.functionName === '(idle)') r = '(idle)'; else if (cf.functionName === '(garbage collector)') r = 'garbage collection'; else if (cf.functionName === '(program)') r = '(program: parse, compile, native)'; else if (cf.functionName === '(root)') r = '(root)';
    else { const st = []; for (let k = id; k; k = nodes.get(k).parent) { const c = nodes.get(k).callFrame; st.push({ fn: c.functionName, mod: c.url && c.url.includes(appFile) ? moduleAt(c.lineNumber) : c.url ? c.url.replace(/^https?:\/\/[^/]+\//, '') : '(native)' }); } st.reverse(); r = classify(st); }
    cache.set(id, r); return r;
  };
  const fnOf = id => { const c = nodes.get(id).callFrame; return `${c.functionName || '(anon)'} [${c.url && c.url.includes(appFile) ? moduleAt(c.lineNumber) : (c.url || '(native)').replace(/^https?:\/\/[^/]+\//, '')}]`; };
  const phase = phases.map(() => new Map()), slice = [], selfFn = phases.map(() => new Map()), selfMod = phases.map(() => new Map()), callers = phases.map(() => new Map()), NATIVE = /^(getImageData|putImageData|drawImage|toDataURL|toBlob|texImage2D|texSubImage2D|texImage3D|generateMipmap|bufferData|bufferSubData|linkProgram|compileShader|getProgramParameter|getShaderParameter|getProgramInfoLog|createProgram|texStorage2D|compressedTexImage2D)$/;
  const modOfNode = id => { for (let k = id; k; k = nodes.get(k).parent) { const c = nodes.get(k).callFrame; if (c.url && c.url.includes(appFile)) return moduleAt(c.lineNumber); } return '(native)'; };
  let ts = profile.startTime / 1000;
  profile.samples.forEach((id, i) => {
    const d = (profile.timeDeltas[i] || 0) / 1000; ts += d; const t = ts - offset; if (t < 0 || t > tEnd) return;
    const c = cat(id), p = phases.findIndex(([a, b]) => t >= a && t < b), sl = Math.floor(t / 10000);
    if (p >= 0) { phase[p].set(c, (phase[p].get(c) || 0) + d); if (c !== '(idle)') { const f = fnOf(id); selfFn[p].set(f, (selfFn[p].get(f) || 0) + d); const m = modOfNode(id); selfMod[p].set(m, (selfMod[p].get(m) || 0) + d); const fn = nodes.get(id).callFrame.functionName; if (NATIVE.test(fn)) { const par = nodes.get(id).parent, k = fn + ' <- ' + (par ? fnOf(par) : '?'); callers[p].set(k, (callers[p].get(k) || 0) + d); } } }
    (slice[sl] || (slice[sl] = new Map())).set(c, ((slice[sl] || new Map()).get(c) || 0) + d);
  });
  const incl = phases.map(() => new Map());
  { let ts2 = profile.startTime / 1000; profile.samples.forEach((id, i) => { const d = (profile.timeDeltas[i] || 0) / 1000; ts2 += d; const t = ts2 - offset; if (t < 0 || t > tEnd) return; const p = phases.findIndex(([a, b]) => t >= a && t < b); if (p < 0) return; const seen = new Set(); for (let k = id; k; k = nodes.get(k).parent) { const key = fnOf(k); if (seen.has(key)) continue; seen.add(key); incl[p].set(key, (incl[p].get(key) || 0) + d); } }); }
  const obj = m => Object.fromEntries([...m].map(([k, v]) => [k, +v.toFixed(1)]).sort((a, b) => b[1] - a[1]));
  return { phases: phase.map(obj), slices: Array.from(slice, m => m ? obj(m) : {}), topSelf: selfFn.map(m => Object.entries(obj(m)).slice(0, 30)), inclusive: incl.map(m => Object.entries(obj(m)).slice(0, 90)), byModule: selfMod.map(m => Object.entries(obj(m)).slice(0, 25)), callers: callers.map(m => Object.entries(obj(m)).slice(0, 14)) };
}

// ---------- trace: compile, GC, tasks on the main thread
function analyseTrace(buf, tEnd, outMs) {
  const ev = JSON.parse(Buffer.from(buf).toString()).traceEvents;
  const mt = ev.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain' && ev.some(q => q.tid === e.tid && q.pid === e.pid && q.name === 'EvaluateScript'));
  if (!mt) return null;
  const on = ev.filter(e => e.pid === mt.pid && e.tid === mt.tid && e.ph === 'X' && e.dur !== undefined);
  const nav = ev.find(e => e.name === 'navigationStart' && e.pid === mt.pid), t0 = nav ? nav.ts : Math.min(...on.map(e => e.ts)), cut = t0 + (outMs ?? Infinity) * 1000;
  const sum = re => { let n = 0, ms = 0, pre = 0; for (const e of on) if (re.test(e.name)) { n++; ms += e.dur / 1000; if (e.ts < cut) pre += e.dur / 1000; } return { n, ms: +ms.toFixed(1), beforeOut: +pre.toFixed(1) }; };
  const bigs = on.filter(e => /^(v8\.compile|V8\.CompileCode|v8\.compileModule|V8\.CompileModule)/.test(e.name) && e.dur > 20000).map(e => [e.name, +(e.dur / 1000).toFixed(1), e.args && (e.args.fileName || e.args.url || '')].map(x => typeof x === 'string' ? x.replace(/^https?:\/\/[^/]+\//, '') : x));
  const names = {}; for (const e of on) if (/compile|parse|Compile|Parse/i.test(e.name)) { const q = names[e.name] || (names[e.name] = { n: 0, ms: 0 }); q.n++; q.ms += e.dur / 1000; }
  for (const k in names) names[k].ms = +names[k].ms.toFixed(1);
  const tasks = on.filter(e => /RunTask$/.test(e.name));
  return { names, compileFunctions: sum(/^V8\.CompileCode$/), parseTopLevel: sum(/^V8\.ParseProgram$/), evaluate: sum(/^EvaluateScript$/), minorGC: sum(/^MinorGC$/), majorGC: sum(/^MajorGC$/), layout: sum(/^Layout$/), style: sum(/^UpdateLayoutTree$/), paint: sum(/^(Paint|PrePaint|Layerize|Commit)$/), parseHTML: sum(/^ParseHTML$/),
    busyMs: +tasks.reduce((a, e) => a + e.dur / 1000, 0).toFixed(1), busyBeforeOut: +tasks.filter(e => e.ts < cut).reduce((a, e) => a + e.dur / 1000, 0).toFixed(1), tasks: tasks.length, longOver100: tasks.filter(e => e.dur > 100000).length, worstTasks: tasks.map(e => e.dur / 1000).sort((a, b) => b - a).slice(0, 6).map(x => +x.toFixed(0)), bigCompiles: bigs.slice(0, 8) };
}

// ---------- one run
const { server, port, stats: wire } = await startServer(ROOT, '');
const reqs = []; server.on('request', (req, res) => { const t = Date.now(); res.on('finish', () => reqs.push([decodeURIComponent(req.url.split('?')[0]), t, Date.now()])); });
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function run(cpu) {
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (NET) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: NET[1], downloadThroughput: NET[0] * 125, uploadThroughput: NET[0] * 125 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.evaluateOnNewDocument(PAGE, EXP);
  reqs.length = 0;
  if (TRACE) await page.tracing.start({ categories: ['toplevel', 'devtools.timeline', 'v8', 'disabled-by-default-v8.compile'] });
  if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const wall0 = Date.now();
  page.goto(`http://127.0.0.1:${port}/?help=0&play&debug${QUERY ? '&' + QUERY : ''}`, { waitUntil: 'domcontentloaded', timeout: 0 }).catch(() => {});
  // wait: the loading screen out, then the world queue empty and the frame cost steady, or MAX seconds on the page clock
  let settledSince = -1, snap = null;
  for (;;) {
    await wait(1000);
    snap = await page.evaluate(() => { const P = window.__lt; if (!P) return null; const s = P.series[P.series.length - 1]; return { t: performance.now(), out: P.out, s, n: P.series.length }; }).catch(() => null);
    if (!snap || !snap.s) continue;
    const idle = snap.out >= 0 && snap.s[1] === 0 && snap.s[2] === 0 && snap.s[3] === 0 && snap.s[4] === 0 && (snap.s[11] <= 0);
    settledSince = idle ? (settledSince < 0 ? snap.t : settledSince) : -1;
    if (settledSince >= 0 && snap.t - settledSince > 25000) break;
    if (snap.t > MAX * 1000) break;
    if (errs.length > 20) break;
  }
  await wait(1500);
  const pageNow = await page.evaluate(() => performance.now());
  let profile = null, trace = null;
  if (PROF) profile = (await cdp.send('Profiler.stop')).profile;
  if (TRACE) trace = await page.tracing.stop();
  const P = await page.evaluate(() => {
    const P = window.__lt; const res = performance.getEntriesByType('resource').map(r => [r.name.replace(/^https?:\/\/[^/]+\//, ''), Math.round(r.startTime), Math.round(r.responseEnd), r.encodedBodySize, r.decodedBodySize, r.initiatorType]);
    const nav = performance.getEntriesByType('navigation')[0];
    const g = window.game, R = g && g.renderer, info = R && R.info;
    return { ...P, res, nav: nav && { rs: Math.round(nav.responseStart), re: Math.round(nav.responseEnd), dcl: Math.round(nav.domContentLoadedEventEnd) }, tri: g && g.world ? { est: Math.round(g.world.estTris), built: g.world.stats().tris, cap: g.world.cfg.triCap } : null, programs: info && info.programs ? info.programs.length : null, textures: info && info.memory.textures, geometries: info && info.memory.geometries, ua: navigator.userAgent };
  });
  await page.close();
  return { cpu, wall: (Date.now() - wall0) / 1000, pageNow, P, profile, trace, errs };
}

// ---------- report
function milestones(P) {
  const S = P.series, T = s => s ? s[0] : null, first = fn => { const s = S.find(fn); return s ? s[0] : null; };
  const last = S[S.length - 1];
  // the frame cost (the page's own work in an animation frame) back to its steady value: the median of the last 15 s is the steady value; settled = the last time a 3 s median was over it by more than 15 % + 1 ms
  const W = P.work, end = W.length ? W[W.length - 1][0] : 0, tail = W.filter(w => w[0] > end - 15000).map(w => w[1]), steady = median(tail);
  let cost = null; { const w3 = (t) => median(W.filter(w => w[0] > t - 3000 && w[0] <= t).map(w => w[1])); for (let t = end; t > 3000; t -= 1000) if (w3(t) > steady * 1.15 + 1) { cost = t + 1000; break; } if (cost === null) cost = 0; }
  const quiet = fn => { for (let i = 0; i < S.length; i++) { const t = S[i][0]; if (S[i][0] > 2000 && S.filter(q => q[0] >= t && q[0] <= t + 8000).every(fn)) return t; } return null; };   // the first moment from which the next 8 s all pass
  const queueEmpty = quiet(q => q[1] === 0 && q[2] === 0 && q[3] === 0 && q[4] === 0);
  return {
    domContentLoaded: P.dcl ? Math.round(P.dcl) : null, firstGLDraw: P.draw >= 0 ? Math.round(P.draw) : null, loadingScreenOut: P.out >= 0 ? Math.round(P.out) : null,
    firstViewBuilt: first(s => s[4] === 0 && s[5] > 0), tileUnderCarFull: first(s => s[5] >= 1), worldQueueEmpty: queueEmpty, leanIdle: quiet(q => q[11] <= 0),
    frameCostSteady: cost, steadyFrameMs: +steady.toFixed(2), crowd85: first(s => s[9] > 0 && s[8] >= 0.85 * s[9]), lastSample: T(last), final: last ? { queued: last[1], pending: last[2], inflight: last[3], visPending: last[4], lod2: last[5], lod1: last[6], lod0: last[7], people: last[8], target: last[9], cars: last[10], geometries: last[12], textures: last[13], heapMB: last[14] } : null };
}
const results = [];
for (const cpu of CPUS) {
  process.stderr.write(`cpu ${cpu}x ...\n`);
  const R = await run(cpu), P = R.P, M = milestones(P);
  const out = { cpu, label: LABEL, exp: EXP, root: ROOT, prof: PROF, trace: TRACE, net: NET, wallSeconds: R.wall, milestones: M, errs: R.errs.slice(0, 5), pageErrs: P.errs };
  const upOut = M.loadingScreenOut ?? Infinity; M.settled = Math.max(M.worldQueueEmpty || 0, M.leanIdle || 0, M.frameCostSteady || 0);
  // the wire, before the loading screen lifted and after
  const all = P.res.map(r => ({ file: r[0], start: r[1], end: r[2], wire: r[3], raw: r[4], type: r[5] }));
  out.wire = { beforeOut: all.filter(r => r.end <= upOut), afterOut: all.filter(r => r.end > upOut) };
  const sumW = l => ({ files: l.length, wireBytes: l.reduce((a, r) => a + r.wire, 0), rawBytes: l.reduce((a, r) => a + r.raw, 0) });
  out.wireTotals = { beforeOut: sumW(out.wire.beforeOut), afterOut: sumW(out.wire.afterOut) };
  const g = k => Object.fromEntries(Object.entries(P[k]).map(([n, v]) => [n, { n: v.n, ms: +v.ms.toFixed(1), MB: +(v.bytes / 1048576).toFixed(1) }]));
  out.gl = g('gl'); out.canvas2d = g('c2'); out.canvases = P.cv; out.programs = P.programs; out.textures = P.textures; out.geometries = P.geometries;
  // shader compiles: calls, and when they happened
  out.shaders = { linkCalls: (P.gl.linkProgram || {}).n || 0, linkMs: +((P.gl.linkProgram || {}).ms || 0).toFixed(1), compileMs: +((P.gl.compileShader || {}).ms || 0).toFixed(1), statusMs: +(((P.gl.getProgramParameter || {}).ms || 0) + ((P.gl.getShaderParameter || {}).ms || 0)).toFixed(1),
    firstLinkAt: Math.round(Math.min(...P.ev.filter(e => e[0] === 'linkProgram').map(e => e[1]), 1e9)), lastLinkAt: Math.round(Math.max(...P.ev.filter(e => e[0] === 'linkProgram').map(e => e[1]), 0)), linkAfterOut: P.ev.filter(e => e[0] === 'linkProgram' && e[1] > upOut).length };
  // frames
  { const a = P.work.filter(w => w[0] >= upOut).slice(0, 12).map(w => +w[1].toFixed(1)); out.frames = { n: P.frames, beforeOut: P.work.filter(w => w[0] < upOut).length, firstAfterOut: a, medianBefore: +median(P.work.filter(w => w[0] < upOut && w[0] > upOut - 5000).map(w => w[1])).toFixed(1) }; }
  out.series = P.series; out.tiles = P.tl; out.tri = P.tri;
  if (R.profile) out.profile = analyse(R.profile, R.profile.endTime / 1000 - R.pageNow, R.pageNow, [[0, upOut], [upOut, M.settled || R.pageNow], [M.settled || R.pageNow, R.pageNow]]);
  if (R.trace) out.trace = analyseTrace(R.trace, R.pageNow, M.loadingScreenOut);
  results.push(out);
  fs.writeFileSync(path.join(OUT, `${LABEL}-${cpu}x${PROF ? '-prof' : ''}${TRACE ? '-trace' : ''}.json`), JSON.stringify(out));
}
await browser.close(); server.close();

// ---------- print
const s1 = v => v === null || v === undefined ? '-' : (v / 1000).toFixed(1) + ' s';
console.log(`\nloadtime  root ${path.basename(ROOT)}  window 844x390 DPR3  ${NET ? 'network ' + NET[0] + ' kbps ' + NET[1] + ' ms' : 'network: localhost'}  (page clock, navigation = 0; CPU slowed ${CPUS.join(', ')}x)`);
console.log('\nmilestones' + (EXP ? '  EXPERIMENT ' + EXP : '')); console.log('| what | ' + results.map(r => r.cpu + 'x').join(' | ') + ' |'); console.log('| --- |' + results.map(() => ' ---:|').join(''));
for (const [k, label] of [['domContentLoaded', 'DOMContentLoaded'], ['firstGLDraw', 'first GL draw'], ['firstViewBuilt', 'first tile at full detail'], ['loadingScreenOut', 'loading screen lifts (first playable frame)'], ['worldQueueEmpty', 'world queue empty and nothing in view pending'], ['crowd85', 'crowd at 85 % of its target'], ['frameCostSteady', 'frame cost back to steady'], ['settled', 'SETTLED (last of the three above)']]) console.log(`| ${label} | ${results.map(r => s1(r.milestones[k])).join(' | ')} |`);
console.log(`| steady frame (ms, page work) | ${results.map(r => r.milestones.steadyFrameMs).join(' | ')} |`);
for (const r of results) {
  console.log(`\n== ${r.cpu}x ==  on the wall ${r.wallSeconds.toFixed(0)} s   final: ${JSON.stringify(r.milestones.final)}`);
  const fl = (l, n) => l.sort((a, b) => b.wire - a.wire).slice(0, n).map(x => `  ${x.file}  ${kb(x.wire)} wire / ${kb(x.raw)} decoded  ${(x.start / 1000).toFixed(1)}-${(x.end / 1000).toFixed(1)} s`).join('\n');
  const grp = f => /^js\/app/.test(f) ? 'the game bundle (js/app)' : /^data\//.test(f) ? 'data blobs (data/*.bin)' : /^world\/manifest/.test(f) ? 'world manifest' : /^world\/tiles/.test(f) ? 'world tiles' : /^assets\/world\//.test(f) ? 'far city and hills (assets/world)' : /fonts\//.test(f) ? 'fonts' : /\.(png|jpg|webp)$/.test(f) ? 'images: ' + f.replace(/\/[^/]*$/, '') : /\.(wav|mp3|ogg|m4a)$/.test(f) ? 'audio' : 'other';
  const G = {}; for (const [k, l] of [['before', r.wire.beforeOut], ['after', r.wire.afterOut]]) for (const x of l) { const q = G[grp(x.file)] || (G[grp(x.file)] = { before: [0, 0, 0], after: [0, 0, 0] }); q[k][0]++; q[k][1] += x.wire; q[k][2] += x.raw; }
  console.log('wire by kind (files, KB on the wire, KB decoded)'); for (const [k, v] of Object.entries(G).sort((a, b) => b[1].before[1] - a[1].before[1])) console.log(`  ${k.padEnd(36)} before the loading screen lifts: ${v.before[0]} files ${f0(v.before[1] / 1024)} KB / ${f0(v.before[2] / 1024)} KB    after: ${v.after[0]} files ${f0(v.after[1] / 1024)} KB`);
  console.log(`fetched before the loading screen lifts: ${r.wireTotals.beforeOut.files} files, ${kb(r.wireTotals.beforeOut.wireBytes)} on the wire, ${kb(r.wireTotals.beforeOut.rawBytes)} decoded`); console.log(fl(r.wire.beforeOut, 40));
  console.log(`fetched after: ${r.wireTotals.afterOut.files} files, ${kb(r.wireTotals.afterOut.wireBytes)} on the wire`); console.log(fl(r.wire.afterOut, 10));
  console.log('triangles (planner estimate, built, cap): ' + JSON.stringify(r.tri));
  console.log('frames (page work in ms): ' + JSON.stringify(r.frames));
  console.log('shaders', JSON.stringify(r.shaders), 'programs', r.programs);
  console.log('webgl', JSON.stringify(r.gl)); console.log('canvas2d', JSON.stringify(r.canvas2d), 'canvases', JSON.stringify(r.canvases));
  if (r.trace) console.log('trace', JSON.stringify(r.trace));
  if (r.profile) {
    const ph = ['navigation to loading screen out', 'loading screen out to settled', 'after settled'];
    r.profile.phases.forEach((p, i) => { const tot = Object.values(p).reduce((a, b) => a + b, 0); if (!tot) return; console.log(`\n${ph[i]} (${(tot / 1000).toFixed(1)} s of samples)`); for (const [k, v] of Object.entries(p).slice(0, 22)) console.log(`  ${k.padEnd(40)} ${f0(v).padStart(8)} ms  ${(100 * v / tot).toFixed(1).padStart(5)} %`); });
    for (const [title, key, n] of [['top self time', 'topSelf', 18], ['self time by the module it ran in', 'byModule', 14], ['who called the natives that cost something', 'callers', 10], ['inclusive time (callees counted)', 'inclusive', 70]]) r.profile[key].forEach((l, i) => { if (!l.length) return; console.log(`\n${title}, ${ph[i]}`); for (const [k, v] of l.slice(0, n)) console.log(`  ${f0(v).padStart(8)} ms  ${k}`); });
  }
}
