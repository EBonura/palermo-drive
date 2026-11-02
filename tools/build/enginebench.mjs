// Engine bench: where a frame really goes, per pass and per kind of object (docs/PERF-ENGINE.md).
//   node tools/build/enginebench.mjs attrib [--spots qc,ballaro] [--desktop] [--q engine=off]        # draw calls, GL calls, programs, memory, overdraw, occlusion bound, CPU profile
//   node tools/build/enginebench.mjs pair [--spots qc,...] [--runs 3] [--cpu 4]                      # concurrent pairs, two browsers, same spot, same moment: --qa (default engine=off) against --q
//   node tools/build/enginebench.mjs check [--spots qc,...] [--points 60]            # false culls: random places on the roads, anything occ hid that a full ID render shows
//   node tools/build/enginebench.mjs look [--spots ...] [--times 8,12,16.5,19,23] --out <dir>   # the same instant drawn both ways in one page, images and pixel difference
//   node tools/build/enginebench.mjs drive [--runs 2] [--cpu 4]                      # concurrent pair on a route through the centro: frame times, hitches
//   node tools/build/enginebench.mjs heap [--spots qc]                                               # what holds the JS heap after load: sampling profile by allocation site
//   node tools/build/enginebench.mjs smoke                                                           # settings, garage and title with no page errors: quality tiers switched while running
// Serves the checkout it lives in on a free port; three.js comes from tools/build/node_modules, not the CDN. Chrome: CHROME=/path/to/chrome, else the macOS default.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { startServer } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] || 'attrib';
const arg = (k, d) => { const A = process.argv, i = A.findIndex(x => x === '--' + k || x.startsWith('--' + k + '=')); if (i < 0) return d; if (A[i].includes('=')) return A[i].split('=').slice(1).join('='); return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const DESKTOP = !!arg('desktop', false), CPU = DESKTOP ? 1 : +arg('cpu', 4), RUNS = +arg('runs', 3), Q = arg('q', ''), ROOT = path.resolve(arg('root', path.join(HERE, '../..'))), ROOTB = arg('rootb', '') && path.resolve(arg('rootb')), OUT = arg('out', '/tmp'), SETTLE = +arg('settle', 7000), PIXELS = arg('ratio', '');
const SPOTS = {
  qc: ['Quattro Canti', 17.5, 0, 0],
  ballaro: ['Ballaro market', 24.9, 488.6, -2.01],
  zisa: ['Piazza Zisa', -1758.8, -43.6, -0.14],
  porto: ['the port (Via Crispi)', 91.6, -1300.1, -2.71],
  mondello: ['Mondello piazza', -3033.1, -10177.4, -1.07],
};
const names = String(arg('spots', Object.keys(SPOTS).join(','))).split(',');
const TIMES = String(arg('times', '8,12,16.5,19,23')).split(','), QA = arg('qa', 'engine=off');
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THREE_DIR = path.join(fs.realpathSync(path.join(HERE, 'node_modules')), 'three');

const opened = new Set();
const launch = async () => { const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); opened.add(b); b.on('disconnected', () => console.log('  [browser disconnected]', new Date().toISOString(), 'pid', b.process()?.pid, 'exit', b.process()?.exitCode, b.process()?.signalCode)); return b; };
// a run that fails must not leave its browsers behind on a machine shared with other work
process.on('uncaughtException', async e => { console.error(e); for (const b of opened) await b.close().catch(() => {}); process.exit(1); });
process.on('unhandledRejection', async e => { console.error(e); for (const b of opened) await b.close().catch(() => {}); process.exit(1); });
async function open(browser, port, name, extra = '', init, play = true, before) {
  const [, x, z, th] = SPOTS[name];
  const page = await browser.newPage();
  await page.setViewport(DESKTOP ? { width: 1280, height: 720, deviceScaleFactor: 1 } : { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await page.setRequestInterception(true);
  page.on('request', r => { const m = r.url().match(/^https:\/\/cdn\.jsdelivr\.net(\/npm\/.*)$/); m ? r.continue({ url: `http://127.0.0.1:${port}/__cdn${m[1]}` }) : r.continue(); });
  page.on('error', e => console.log('  [page crashed]', e.message.slice(0, 200)));
  page.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' || /GL_INVALID|GL Driver Message|WebGL:/.test(m.text())) console.log('  [console]', m.text().slice(0, 300)); });
  if (init) await page.evaluateOnNewDocument(init);
  if (before) await before(page);
  page.setDefaultNavigationTimeout(+arg('loadtimeout', 300000));
  await page.goto(`http://127.0.0.1:${port}/?help=0${play ? `&play&at=${x},${z},${th}` : ''}&fixres&debug${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: +arg('loadtimeout', 300000), polling: 250 });
  return page;
}

// ---------- attribution ----------
// Installed before the page runs: every GL buffer and texture allocation is tallied, upload time is summed, every program link is timed.
function installGLTally() {
  const P = WebGL2RenderingContext.prototype, T = window.__gl = { tex: new Map(), buf: new Map(), upload: [], link: 0, linkMs: 0, compile: 0, boundTex: new Map(), boundBuf: new Map(), counts: {}, counting: false };
  const BPP = { 6408: 4, 6407: 3, 6403: 1, 33323: 2, 6406: 1, 6409: 1, 6410: 2 }, IF = { 32856: 4, 35907: 4, 32855: 2, 36194: 2, 32854: 2, 33321: 1, 33323: 2, 34842: 8, 34836: 16, 33326: 4, 33328: 8, 33325: 2, 33327: 4, 33189: 2, 33190: 4, 35056: 4, 36012: 4, 36013: 8, 6408: 4, 6403: 1 };
  const wrapBind = (name, map) => { const o = P[name]; P[name] = function (t, x) { map.set(t, x); return o.call(this, t, x); }; };
  wrapBind('bindTexture', T.boundTex); wrapBind('bindBuffer', T.boundBuf);
  const timed = (name, tally) => { const o = P[name]; P[name] = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); const dt = performance.now() - t0; if (tally) tally.call(this, a); if (dt > 0.5) T.upload.push([name, +dt.toFixed(2), +performance.now().toFixed(0)]); return r; }; };
  const texT = a => T.boundTex.get(a[0]);
  timed('texStorage2D', a => T.tex.set(texT(a), { n: 'storage2D', w: a[3], h: a[4], d: 1, l: a[1], b: IF[a[2]] || 4, f: a[2] }));
  timed('texStorage3D', a => T.tex.set(texT(a), { n: 'storage3D', w: a[3], h: a[4], d: a[5], l: a[1], b: IF[a[2]] || 4, f: a[2] }));
  timed('texImage2D', a => { if (a[1] !== 0) return; const c = a.length >= 8; const w = c ? a[3] : (a[5].videoWidth || a[5].naturalWidth || a[5].width), h = c ? a[4] : (a[5].videoHeight || a[5].naturalHeight || a[5].height); T.tex.set(texT(a), { n: 'image2D', w, h, d: 1, l: 1, b: IF[a[2]] || 4, f: a[2] }); });
  timed('texImage3D', a => { if (a[1] !== 0) return; T.tex.set(texT(a), { n: 'image3D', w: a[3], h: a[4], d: a[5], l: 1, b: IF[a[2]] || 4, f: a[2] }); });
  timed('texSubImage2D'); timed('texSubImage3D'); timed('generateMipmap', a => { const t = T.tex.get(texT(a)); if (t) t.mip = true; });
  timed('bufferData', a => { const b = T.boundBuf.get(a[0]); T.buf.set(b, typeof a[1] === 'number' ? a[1] : a[1].byteLength); });
  timed('bufferSubData');
  const db = P.deleteBuffer; P.deleteBuffer = function (b) { T.buf.delete(b); return db.call(this, b); };
  const dt = P.deleteTexture; P.deleteTexture = function (t) { T.tex.delete(t); return dt.call(this, t); };
  const lk = P.linkProgram; P.linkProgram = function (p) { T.link++; return lk.call(this, p); };
  const cs = P.compileShader; P.compileShader = function (s) { T.compile++; return cs.call(this, s); };
  const gpp = P.getProgramParameter; P.getProgramParameter = function (p, n) { const t0 = performance.now(), r = gpp.call(this, p, n); T.linkMs += performance.now() - t0; return r; };
  // per-frame GL call counts, only while T.counting is on (off during the timed windows: the page never sees this path then)
  for (const k of Object.getOwnPropertyNames(P)) {
    if (typeof Object.getOwnPropertyDescriptor(P, k).value !== 'function' || /^get(Parameter|Error|Extension)|^is/.test(k)) continue;
    const o = P[k]; P[k] = function (...a) { if (T.counting) { const c = T.counts[T.pass] = T.counts[T.pass] || {}; c[k] = (c[k] || 0) + 1; } return o.apply(this, a); };
  }
}

// One frame with every draw recorded, then occlusion bound and overdraw, all inside the page.
async function attributeFrame(page) {
  return page.evaluate(async () => {
    const g = window.game, r = g.renderer, scene = g.scene, camera = g.camera, gl = r.getContext(), T = window.__gl;
    const keyOf = o => {
      const chain = []; for (let p = o; p && p !== scene && chain.length < 5; p = p.parent) chain.push(p.name || p.type);
      return chain.join(' < ').replace(/[-_]?-?\d+([_.:-]-?\d+)*/g, '#');
    };
    const pc = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const orig = r.renderBufferDirect, sm = r.shadowMap, origSM = sm.render;
    let pass = 'main'; T.pass = 'other';
    const draws = [];
    r.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      const before = r.info.render.triangles, calls = r.info.render.calls;
      orig.call(this, cam, sc, geo, mat, obj, grp);
      const m = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      draws.push({ pass, key: keyOf(obj), id: obj.id, name: obj.name, tris: r.info.render.triangles - before, calls: r.info.render.calls - calls, inst: obj.isInstancedMesh ? obj.count : 0, mat: mat.uuid, matType: m && m.type, prog: (r.properties.get(mat).currentProgram || {}).id, shadow: obj.castShadow, recv: obj.receiveShadow, transparent: mat.transparent, world: !obj.matrixAutoUpdate });
    };
    sm.render = function (a, b, c) { const pv = pass, pt = T.pass; pass = 'shadow'; T.pass = 'shadow'; origSM.call(this, a, b, c); pass = pv; T.pass = pt; };
    const origRender = r.render;
    const frame = () => new Promise(res => { let done = false; r.render = function (s, c) { if (!done && s === scene) { done = true; T.counting = true; T.pass = 'main'; pass = 'main'; const t0 = performance.now(); origRender.call(this, s, c); T.counting = false; r.render = origRender; res(performance.now() - t0); } else origRender.call(this, s, c); }; });
    await frame();
    r.renderBufferDirect = orig; sm.render = origSM;

    // GPU timer for each pass over 60 frames, when the browser gives us the extension
    let gpu = null;
    if (pc) {
      const S = { main: [], shadow: [] }, qs = [];
      const begin = l => { const q = gl.createQuery(); gl.beginQuery(pc.TIME_ELAPSED_EXT, q); qs.push([l, q]); };
      sm.render = function (a, b, c) { gl.endQuery(pc.TIME_ELAPSED_EXT); begin('shadow'); origSM.call(this, a, b, c); gl.endQuery(pc.TIME_ELAPSED_EXT); begin('main'); };
      r.render = function (s, c) { if (s !== scene) return origRender.call(this, s, c); begin('other'); origRender.call(this, s, c); gl.endQuery(pc.TIME_ELAPSED_EXT); };
      await new Promise(res => { let n = 0; const f = () => { if (++n > 60) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
      r.render = origRender; sm.render = origSM;
      await new Promise(res => setTimeout(res, 500));
      for (const [l, q] of qs) { if (S[l] && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) S[l].push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); }
      const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null;
      gpu = { main: med(S.main), shadow: med(S.shadow), samples: S.main.length, disjoint: gl.getParameter(pc.GPU_DISJOINT_EXT) };
    }

    return { draws, gpu, programs: r.info.programs.length, info: { ...r.info.memory }, renderInfo: { calls: r.info.render.calls, tris: r.info.render.triangles }, counts: T.counts };
  });
}

async function overdrawAndOcclusion(page) {
  return page.evaluate(async () => {
    const THREE = await import('three');
    const g = window.game, r = g.renderer, scene = g.scene, camera = g.camera, gl = r.getContext();
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const W = size.x, H = size.y, rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType });
    const smOn = r.shadowMap.enabled, smAuto = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    const px = new Uint8Array(W * H * 4);
    const orig = r.renderBufferDirect, bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    const clearAlpha = r.getClearAlpha(), clearCol = r.getClearColor(new THREE.Color());
    r.setClearColor(0x000000, 0);

    // Overdraw: how many fragments survive the depth test in the draw order three really uses, and raw depth complexity with the depth test off.
    const ov = depth => new THREE.ShaderMaterial({ depthTest: depth, depthWrite: depth, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: 'void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',
      fragmentShader: 'void main(){gl_FragColor=vec4(1./255.);}' });
    const measure = depth => {
      const m = ov(depth); r.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) { orig.call(this, cam, sc, geo, m, obj, grp); };
      r.setRenderTarget(rt); r.clear(); r.render(scene, camera); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null); r.renderBufferDirect = orig;
      let sum = 0, cov = 0, sat = 0; for (let i = 0; i < W * H; i++) { const v = px[i * 4]; sum += v; if (v) cov++; if (v === 255) sat++; }
      m.dispose(); return { avg: +(sum / (W * H)).toFixed(2), covered: +(cov / (W * H)).toFixed(3), saturated: sat };
    };
    const shaded = measure(true), raw = measure(false);

    // Occlusion bound: each draw gets a flat ID colour, what ends up on screen is what a perfect occlusion culler at this granularity would have to keep.
    const ids = new Map(), rec = [];
    const idMat = (obj, mat) => {
      let e = ids.get(obj.id);
      if (!e) { const n = rec.length + 1; const m = new THREE.ShaderMaterial({ side: mat.side, toneMapped: false, uniforms: { c: { value: new THREE.Vector3((n & 255) / 255, ((n >> 8) & 255) / 255, ((n >> 16) & 255) / 255) } },
        vertexShader: 'void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',
        fragmentShader: 'uniform vec3 c;void main(){gl_FragColor=vec4(c,1.);}' }); e = { n, m, obj, tris: 0, px: 0 }; ids.set(obj.id, e); rec.push(e); }
      return e.m;
    };
    const always = [];
    r.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
      const before = r.info.render.triangles;
      if (mat.transparent || mat.isShaderMaterial || mat.isSpriteMaterial) { always.push({ obj, mat }); return; }   // cannot occlude, or moves vertices in its own shader: counted as visible
      const m = idMat(obj, mat); orig.call(this, cam, sc, geo, m, obj, grp); ids.get(obj.id).tris += r.info.render.triangles - before;
    };
    r.setRenderTarget(rt); r.clear(); r.render(scene, camera); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null); r.renderBufferDirect = orig;
    for (let i = 0; i < W * H; i++) { const n = px[i * 4] | px[i * 4 + 1] << 8 | px[i * 4 + 2] << 16; if (n && rec[n - 1]) rec[n - 1].px++; }
    const keyOf = o => { const chain = []; for (let p = o; p && p !== scene && chain.length < 5; p = p.parent) chain.push(p.name || p.type); return chain.join(' < ').replace(/[-_]?-?\d+([_.:-]-?\d+)*/g, '#'); };
    const occ = { draws: rec.length, tris: 0, vis1: 0, vis1Tris: 0, vis16: 0, vis16Tris: 0, always: always.length, rows: [] };
    for (const e of rec) { occ.tris += e.tris; if (e.px > 0) { occ.vis1++; occ.vis1Tris += e.tris; } if (e.px >= 16) { occ.vis16++; occ.vis16Tris += e.tris; } occ.rows.push({ key: keyOf(e.obj), tris: e.tris, px: e.px }); e.m.dispose(); }
    scene.background = bg; scene.fog = fog; r.setClearColor(clearCol, clearAlpha); r.shadowMap.autoUpdate = smAuto; rt.dispose();
    return { W, H, shaded, raw, occ };
  });
}

async function memory(page) {
  return page.evaluate(() => {
    const T = window.__gl; let tb = 0, bb = 0; const big = [];
    for (const t of T.tex.values()) { const base = t.w * t.h * t.d * t.b; let total = 0; if (t.n.startsWith('storage')) { for (let i = 0, w = t.w, h = t.h, d = t.d; i < t.l; i++) { total += w * h * d * t.b; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); if (t.n === 'storage3D') { } } } else total = base * (t.mip ? 4 / 3 : 1); tb += total; big.push([t.w + 'x' + t.h + 'x' + t.d, t.f, (total / 1048576).toFixed(1)]); }
    for (const b of T.buf.values()) bb += b;
    big.sort((a, b) => b[2] - a[2]);
    const up = T.upload.slice(-4000), hist = {}; let sum = 0; for (const [n, d] of up) { hist[n] = hist[n] || { n: 0, ms: 0, max: 0 }; hist[n].n++; hist[n].ms += d; hist[n].max = Math.max(hist[n].max, d); sum += d; }
    return { textures: T.tex.size, textureMB: +(tb / 1048576).toFixed(1), buffers: T.buf.size, bufferMB: +(bb / 1048576).toFixed(1), bigTextures: big.slice(0, 14), uploadOver05ms: hist, links: T.link, compiles: T.compile, linkWaitMs: +T.linkMs.toFixed(0) };
  });
}

function summarize(profile, frames) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), dts = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const d = (dts[i] || 0) / 1000; total += d; self.set(id, (self.get(id) || 0) + d); });
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/^.*\//, '').replace(/\?.*/, '')}:${n.callFrame.lineNumber + 1}`;
  const selfBy = new Map(), inclBy = new Map();
  for (const [id, t] of self) {
    const n = nodes.get(id); selfBy.set(label(n), (selfBy.get(label(n)) || 0) + t);
    const seen = new Set(); for (let p = id; p !== undefined; p = parent.get(p)) { const l = label(nodes.get(p)); if (!seen.has(l)) { seen.add(l); inclBy.set(l, (inclBy.get(l) || 0) + t); } }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([l, t]) => [+(t / frames).toFixed(3), l]);
  return { totalMs: total, frames, self: top(selfBy, 40), incl: top(inclBy, 70) };
}

// Runs in the page. At random places on the roads of the full detail tiles: one real render (occ decides), then one render of everything with flat ID colours; a hidden object with pixels is a false cull.
async function falseCulls(points) {
  const THREE = await import('three');
  const g = window.game, r = g.renderer, scene = g.scene, camera = g.camera, lean = g.lean, frames = n => new Promise(res => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : res()); f(); });
  const size = r.getDrawingBufferSize(new THREE.Vector2()), W = size.x, H = size.y, rt = new THREE.WebGLRenderTarget(W, H), px = new Uint8Array(W * H * 4);
  const out = { pts: 0, hidden: 0, bad: [], px: 0, tris: 0, trisAll: 0 }, orig = r.renderBufferDirect, seedRoads = [];
  for (const t of g.world.fullTiles()) { const d = t.data; if (d && d.roads) for (const o of d.roads) if (o.p && o.p.length >= 4 && !o.tn && !o.br) seedRoads.push(o.p); }
  const keyOf = o => { const chain = []; for (let p = o; p && p !== scene && chain.length < 4; p = p.parent) chain.push(p.name || p.type); return chain.join(' < ').replace(/[-_]?-?\d+([_.:-]-?\d+)*/g, '#'); };
  const vs = 'void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}', fs = 'uniform vec3 c;void main(){gl_FragColor=vec4(c,1.);}';
  const mats = new Map(), ids = [];
  const idOf = (o, mat) => { let e = mats.get(o.id); if (!e) { const n = ids.length + 1; e = { n, o, m: new THREE.ShaderMaterial({ side: mat.side, toneMapped: false, uniforms: { c: { value: new THREE.Vector3((n & 255) / 255, ((n >> 8) & 255) / 255, ((n >> 16) & 255) / 255) } }, vertexShader: vs, fragmentShader: fs }) }; mats.set(o.id, e); ids.push(e); } return e; };
  const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  r.shadowMap.autoUpdate = false; const bg = scene.background, fog = scene.fog;
  for (let q = 0; q < points; q++) {
    const p = seedRoads[(rnd() * seedRoads.length) | 0], k = ((rnd() * (p.length / 2 - 1)) | 0) * 2, u = rnd(), x = p[k] + (p[k + 2] - p[k]) * u, z = p[k + 1] + (p[k + 3] - p[k + 1]) * u;
    const th = Math.atan2(p[k + 2] - p[k], p[k + 3] - p[k + 1]) + (rnd() < 0.5 ? Math.PI : 0) + (rnd() - 0.5) * 0.6;
    try { g.placeAt(x, z, th); } catch (e) { continue; }
    r.shadowMap.autoUpdate = true; await frames(14); r.shadowMap.autoUpdate = false;
    camera.updateMatrixWorld();
    r.setRenderTarget(rt); r.render(scene, camera); r.setRenderTarget(null);
    const hidden = new Set(lean.hiddenNow); out.tris += r.info.render.triangles;
    lean.bypass = true; scene.background = null; scene.fog = null; const cc = r.getClearAlpha(); r.setClearAlpha(0);
    r.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) { if (mat.transparent || mat.isShaderMaterial || mat.isSpriteMaterial || !cam.isPerspectiveCamera) return; orig.call(this, cam, sc, geo, idOf(obj, mat).m, obj, grp); };
    r.setRenderTarget(rt); r.clear(); r.render(scene, camera); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null);
    r.renderBufferDirect = orig; lean.bypass = false; scene.background = bg; scene.fog = fog; r.setClearAlpha(cc); out.trisAll += r.info.render.triangles;
    const counts = new Map(); for (let i = 0; i < W * H; i++) { const n = px[i * 4] | px[i * 4 + 1] << 8 | px[i * 4 + 2] << 16; if (n) counts.set(n, (counts.get(n) || 0) + 1); }
    out.pts++; out.hidden += hidden.size; out.px += W * H;
    for (const [n, c] of counts) { const e = ids[n - 1]; if (e && hidden.has(e.o)) { const s = e.o.geometry.boundingSphere; out.bad.push({ px: c, key: keyOf(e.o), at: x.toFixed(1) + ',' + z.toFixed(1) + ',' + th.toFixed(2), cam: camera.position.toArray().map(v => +v.toFixed(1)).join(','), d: s ? +s.center.clone().applyMatrix4(e.o.matrixWorld).distanceTo(camera.position).toFixed(0) : -1 }); } }
  }
  r.shadowMap.autoUpdate = true; rt.dispose(); for (const e of ids) e.m.dispose();
  return out;
}

// Runs in the page: 14 m/s along Via Maqueda, Via Ruggero Settimo and Via della Liberta; frame intervals and the time inside renderer.render.
async function driveRoute(seconds) {
  const g = window.game, r = g.renderer, W = [[38.115684, 13.36146], [38.1199, 13.3573], [38.1247846, 13.3559943], [38.1387821, 13.3465045]].map(p => g.proj(p[0], p[1]));
  const rend = [], gaps = []; let tris = 0, calls = 0, seg = 0, u = 0, last = performance.now(), cur = 0;
  const orig = r.render; r.render = function (a, b) { const t = performance.now(); orig.call(this, a, b); cur = performance.now() - t; };
  const end = last + seconds * 1000;
  await new Promise(res => { const f = () => {
    const now = performance.now(), dt = now - last; last = now; gaps.push(dt); rend.push(cur); tris += r.info.render.triangles; calls += r.info.render.calls;
    if (now > end || seg >= W.length - 1) return res();
    const a = W[seg], b = W[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); u += 14 * dt / 1000 / len; if (u >= 1) { u = 0; seg++; }
    const q = W[Math.min(seg, W.length - 2)], w = W[Math.min(seg + 1, W.length - 1)];
    try { g.placeAt(q[0] + (w[0] - q[0]) * u, q[1] + (w[1] - q[1]) * u, Math.atan2(w[0] - q[0], w[1] - q[1])); } catch (e) { /* off the road for a moment */ }
    requestAnimationFrame(f);
  }; requestAnimationFrame(f); });
  r.render = orig;
  const pc = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
  return { frames: gaps.length, renderP50: +pc(rend, 0.5).toFixed(2), renderP95: +pc(rend, 0.95).toFixed(2), renderMax: +Math.max(...rend).toFixed(1), gapP95: +pc(gaps, 0.95).toFixed(1), gapMax: +Math.max(...gaps).toFixed(1), over33: gaps.filter(x => x > 33.4).length, over50: gaps.filter(x => x > 50).length, tris: Math.round(tris / gaps.length), calls: Math.round(calls / gaps.length), lean: g.lean ? { rebuilds: g.lean.stats().rebuilds, refreshes: g.lean.stats().refreshes, rasterMs: +g.lean.stats().rasterMs.toFixed(0) } : null };
}

async function attrib(name, port) {
  const browser = await launch();
  const page = await open(browser, port, name, Q, installGLTally);
  const cdp = await page.createCDPSession();
  await sleep(SETTLE);
  const mem = await memory(page);
  const a = await attributeFrame(page);
  const o = await overdrawAndOcclusion(page);
  // CPU profile at the phone's slowdown, nothing else instrumented
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await sleep(4000);
  await page.evaluate(() => { window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  const sysProc = async () => { const c = await browser.target().createCDPSession(); const i = await c.send('SystemInfo.getProcessInfo'); await c.detach(); return i.processInfo; };
  const p0 = await sysProc(), f0 = await page.evaluate(() => window.__fr);
  await sleep(6000);
  const f1 = await page.evaluate(() => window.__fr), p1 = await sysProc();
  const prof = (await cdp.send('Profiler.stop')).profile;
  const frames = f1 - f0, cpuBy = {}; for (const p of p1) { const q = p0.find(x => x.id === p.id); if (q) cpuBy[p.type] = (cpuBy[p.type] || 0) + (p.cpuTime - q.cpuTime) * 1000 / frames; }
  await browser.close();
  return { name, ...a, ...o, mem, cpu: summarize(prof, frames), frames, cpuBy };
}

function printAttrib(R) {
  console.log(`\n===== ${SPOTS[R.name][0]}  drawing buffer ${R.W}x${R.H}  programs ${R.programs}  three memory ${JSON.stringify(R.info)}  last frame calls ${R.renderInfo.calls} tris ${R.renderInfo.tris}`);
  const sum = (rows, f) => rows.reduce((s, x) => s + f(x), 0);
  for (const pass of ['main', 'shadow']) {
    const ds = R.draws.filter(d => d.pass === pass), mats = new Set(ds.map(d => d.mat)), progs = new Set(ds.map(d => d.prog));
    console.log(`-- ${pass}: draws ${ds.length}, triangles ${sum(ds, d => d.tris)}, distinct materials ${mats.size}, distinct programs ${progs.size}, draws with a program change ${ds.filter((d, i) => i && d.prog !== ds[i - 1].prog).length}, with a material change ${ds.filter((d, i) => i && d.mat !== ds[i - 1].mat).length}, static-matrix objects ${ds.filter(d => d.world).length}, instanced ${ds.filter(d => d.inst).length}`);
    const by = new Map(); for (const d of ds) { const e = by.get(d.key) || { n: 0, tris: 0, inst: 0 }; e.n++; e.tris += d.tris; if (d.inst) e.inst += d.inst; by.set(d.key, e); }
    for (const [k, e] of [...by].sort((a, b) => b[1].n * 1000 + b[1].tris / 100 - a[1].n * 1000 - a[1].tris / 100).slice(0, 26)) console.log('   ', String(e.n).padStart(4), String(e.tris).padStart(8), e.inst ? ('inst ' + e.inst).padEnd(10) : ''.padEnd(10), k.slice(0, 100));
  }
  console.log('-- GL calls this frame', JSON.stringify(R.counts && Object.fromEntries(Object.entries(R.counts).map(([p, c]) => [p, Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 14))]))));
  console.log('-- GPU timer ms (this Mac, 60 frames median):', JSON.stringify(R.gpu));
  console.log('-- overdraw: fragments that pass the depth test per pixel', R.shaded.avg, 'raw depth complexity', R.raw.avg, 'covered', R.shaded.covered, 'saturated', R.raw.saturated);
  console.log(`-- occlusion bound: opaque draws ${R.occ.draws}, triangles ${R.occ.tris}; draws with any pixel ${R.occ.vis1} (${R.occ.vis1Tris} triangles); with 16+ pixels ${R.occ.vis16} (${R.occ.vis16Tris} triangles); not tested ${R.occ.always}`);
  const hid = new Map(); for (const r of R.occ.rows) { const e = hid.get(r.key) || { n: 0, tris: 0, hn: 0, ht: 0 }; e.n++; e.tris += r.tris; if (r.px < 16) { e.hn++; e.ht += r.tris; } hid.set(r.key, e); }
  for (const [k, e] of [...hid].sort((a, b) => b[1].ht - a[1].ht).slice(0, 14)) console.log('   ', `hidden ${e.hn}/${e.n} draws, ${e.ht}/${e.tris} tris`.padEnd(42), k.slice(0, 90));
  console.log('-- memory', JSON.stringify(R.mem));
  console.log(`-- CPU profile at x${CPU}: ${R.frames} frames, process CPU ms per frame ${JSON.stringify(Object.fromEntries(Object.entries(R.cpuBy).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  console.log('   inclusive ms/frame:'); for (const [t, l] of R.cpu.incl.slice(0, 60)) console.log('    ', String(t).padStart(7), l);
  console.log('   self ms/frame:'); for (const [t, l] of R.cpu.self.slice(0, 30)) console.log('    ', String(t).padStart(7), l);
}

// ---------- concurrent pairs ----------
async function timedRun(browser, port, name, extra) {
  const page = await open(browser, port, name, extra);
  const cdp = await page.createCDPSession(); await cdp.send('Performance.enable');
  await sleep(SETTLE);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await sleep(4000);
  await page.evaluate(() => { const r = window.game.renderer, orig = r.render.bind(r); window.__rt = { t: 0, n: 0, tmax: 0 }; r.render = (a, c) => { const t0 = performance.now(); orig(a, c); const d = performance.now() - t0; window.__rt.t += d; window.__rt.n++; if (d > window.__rt.tmax) window.__rt.tmax = d; }; window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const metric = async n => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === n).value;
  const proc = async () => { const c = await browser.target().createCDPSession(); const i = await c.send('SystemInfo.getProcessInfo'); await c.detach(); return i.processInfo.filter(p => p.type.toLowerCase() === 'gpu').reduce((s, p) => s + p.cpuTime, 0); };
  await page.evaluate(() => { window.__rt.t = 0; window.__rt.n = 0; window.__rt.tmax = 0; window.__fr = 0; });
  const t0 = await metric('TaskDuration'), g0 = await proc();
  await sleep(6000);
  const t1 = await metric('TaskDuration'), g1 = await proc();
  const i = await page.evaluate(() => { const r = window.game.renderer.info.render; return { fr: window.__fr, rms: window.__rt.t / Math.max(1, window.__rt.n), rmax: window.__rt.tmax, calls: r.calls, tris: r.triangles }; });
  await page.close();
  return { main: (t1 - t0) * 1000 / i.fr, gpuproc: (g1 - g0) * 1000 / i.fr, render: i.rms, rmax: i.rmax, calls: i.calls, tris: i.tris, fps: i.fr / 6 };
}
async function pair(port, portB) {
  const A = await launch(), B = await launch();
  console.log(`concurrent pairs, ${DESKTOP ? 'desktop 1280x720' : `phone 844x390 DPR3, ${CPU}x CPU`}, before = ${QA}, after = ${Q || 'default'}${ROOTB ? ' on ' + ROOTB : ''}, runs ${RUNS}`);
  console.log('spot'.padEnd(24), 'main b/a'.padEnd(16), 'render b/a'.padEnd(16), 'gpuproc b/a'.padEnd(16), 'calls b/a'.padEnd(12), 'tris b/a'.padEnd(20), 'fps b/a');
  const out = {};
  for (const n of names) {
    const rs = [];
    for (let k = 0; k < RUNS; k++) {
      const [a, b] = await Promise.all([timedRun(A, port, n, QA), timedRun(B, portB, n, Q)]);
      rs.push({ a, b }); console.log('  run', k, n, 'main', a.main.toFixed(2), b.main.toFixed(2), 'render', a.render.toFixed(2), b.render.toFixed(2), 'gpu', a.gpuproc.toFixed(2), b.gpuproc.toFixed(2), 'calls', a.calls, b.calls, 'tris', a.tris, b.tris);
    }
    const m = (s, f) => median(rs.map(r => r[s][f])), fmt = (f, d = 2) => m('a', f).toFixed(d) + ' / ' + m('b', f).toFixed(d);
    console.log(SPOTS[n][0].padEnd(24), fmt('main').padEnd(16), fmt('render').padEnd(16), fmt('gpuproc').padEnd(16), fmt('calls', 0).padEnd(12), fmt('tris', 0).padEnd(20), fmt('fps', 1));
    out[n] = rs;
  }
  await A.close(); await B.close();
  if (arg('json', '')) fs.writeFileSync(arg('json'), JSON.stringify(out));
}

const { server, port } = await startServer(ROOT, THREE_DIR);
const srvB = ROOTB ? await startServer(ROOTB, THREE_DIR) : null;
if (MODE === 'attrib') { for (const n of names) { const R = await attrib(n, port); printAttrib(R); if (arg('json', '')) fs.writeFileSync(`${arg('json')}-${n}.json`, JSON.stringify(R)); } }
else if (MODE === 'pair') await pair(port, srvB ? srvB.port : port);
else if (MODE === 'check') {
  const browser = await launch(), POINTS = +arg('points', 60); let tot = { pts: 0, hidden: 0, bad: 0, badPx: 0, px: 0 };
  for (const n of names) {
    const page = await open(browser, port, n, Q); await sleep(SETTLE);
    const R = await page.evaluate(falseCulls, POINTS); await page.close();
    const worst = R.bad.sort((a, b) => b.px - a.px).slice(0, 8);
    console.log(SPOTS[n][0].padEnd(24), `points ${R.pts}, hidden per point ${(R.hidden / R.pts).toFixed(0)}, drawn tris avg ${(R.tris / R.pts / 1000).toFixed(0)}k of ${(R.trisAll / R.pts / 1000).toFixed(0)}k, false culls ${R.bad.length} (${R.bad.reduce((s, b) => s + b.px, 0)} px of ${R.px} px, ${(100 * R.bad.reduce((s, b) => s + b.px, 0) / R.px).toFixed(4)}%), points with any ${new Set(R.bad.map(b => b.at)).size}`);
    for (const b of worst) console.log('    ', b.px, 'px', b.key.slice(0, 60), 'at', b.at, 'cam', b.cam, 'd', b.d);
  }
  await browser.close();
}
else if (MODE === 'heap') {
  const browser = await launch();
  for (const n of names) {
    let cdp; const page = await open(browser, port, n, Q, undefined, true, async pg => { cdp = await pg.createCDPSession(); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 65536 }); await cdp.send('Performance.enable'); });
    await sleep(SETTLE + 3000);
    await cdp.send('HeapProfiler.collectGarbage');
    const m = (await cdp.send('Performance.getMetrics')).metrics, get = k => m.find(x => x.name === k)?.value;
    const prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
    const by = new Map(), file = new Map(); let total = 0;
    const walk = (nd) => { const k = `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.replace(/^.*\//, '').replace(/\?.*/, '')}:${nd.callFrame.lineNumber + 1}`, f = nd.callFrame.url.replace(/^.*\//, '').replace(/\?.*/, '') || '(native)'; by.set(k, (by.get(k) || 0) + nd.selfSize); file.set(f, (file.get(f) || 0) + nd.selfSize); total += nd.selfSize; for (const c of nd.children) walk(c); }; walk(prof.head);
    const geo = await page.evaluate(() => { const g = window.game, seen = new Set(); let b = 0; g.scene.traverse(o => { const q = o.geometry; if (!q || seen.has(q.uuid)) return; seen.add(q.uuid); for (const k in q.attributes) { const a = q.attributes[k]; if (a.array) b += a.array.byteLength; } if (q.index) b += q.index.array.byteLength; }); const w = g.world.stats(); return { geometryArraysMB: +(b / 1048576).toFixed(1), cacheTiles: w.cache, tiles: w.tiles, full: w.lod2, low: w.lod1 }; });
    console.log(`\n== ${SPOTS[n][0]}: V8 heap used after GC ${(get('JSHeapUsedSize') / 1048576).toFixed(0)} MB, total ${(get('JSHeapTotalSize') / 1048576).toFixed(0)} MB, sampled live ${(total / 1048576).toFixed(0)} MB, ${JSON.stringify(geo)}`);
    console.log('by file (MB):', [...file].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, v]) => `${f} ${(v / 1048576).toFixed(1)}`).join(' | '));
    for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(String((v / 1048576).toFixed(1)).padStart(7), k);
    await page.close();
  }
  await browser.close();
}
else if (MODE === 'smoke') {
  const browser = await launch();
  const say = async (page, what) => { const r = await page.evaluate(async () => { const g = window.game, fr = () => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => (++n >= 30 ? res(n * 1000 / (performance.now() - t0)) : requestAnimationFrame(f)); requestAnimationFrame(f); }); const a = g.lean.stats(), fps = await fr(), b = g.lean.stats(), sh = g.scene.children.find(o => o.isDirectionalLight)?.shadow; const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d'); await new Promise(res => requestAnimationFrame(() => { x.drawImage(g.renderer.domElement, 0, 0, 64, 32); res(); })); const px = x.getImageData(0, 0, 64, 32).data; let lum = 0; for (let i = 0; i < px.length; i += 4) lum += px[i] + px[i + 1] + px[i + 2]; return { fps: +fps.toFixed(0), shadows: g.renderer.shadowMap.enabled, map: sh && sh.map ? sh.map.width : 0, refreshes: b.refreshes, tested: b.tested, hidden: b.hidden, drawn: b.drawn, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, luminance: Math.round(lum / px.length) }; }); console.log(what.padEnd(34), JSON.stringify(r)); };
  // the title flyover, no ?play
  { const page = await open(browser, port, 'qc', Q, undefined, false); await sleep(5000); await say(page, 'title flyover'); await page.close(); }
  // each tier from a saved setting, then switched while running from the options screen
  for (const q of ['low', 'medium', 'high']) {
    const page = await open(browser, port, 'qc', Q, `try { localStorage.setItem('palermoDrive.settings.v1', JSON.stringify({ quality: '${q}' })); } catch (e) {}`); await sleep(5000); await say(page, 'saved tier ' + q);
    await page.close();
  }
  { const page = await open(browser, port, 'qc', 'menu=options' + (Q ? '&' + Q : '')); await sleep(5000); await say(page, 'options open');
    for (const q of ['low', 'high', 'medium']) { const ok = await page.evaluate(q => { const b = [...document.querySelectorAll('[data-opt=quality] button')]; const t = b.find(x => x.dataset.val === q || x.value === q || new RegExp({ low: 'bass|low', medium: 'medi', high: 'alt|high' }[q], 'i').test(x.textContent)); if (t) t.click(); return !!t; }, q); await sleep(4000); await say(page, 'switched to ' + q + (ok ? '' : ' (button not found)')); }
    await page.close(); }
  // the garage draws its own scene; the city must come back as it was
  { const page = await open(browser, port, 'qc', 'menu=garage' + (Q ? '&' + Q : '')); await sleep(5000); const inG = await page.evaluate(() => document.querySelector('.pd-garage')?.offsetParent != null); console.log('garage open', inG); await page.keyboard.press('Escape'); await sleep(3000); await say(page, 'back from the garage'); await page.close(); }
  await browser.close();
}
else if (MODE === 'look') {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const decode = u => sharp(Buffer.from(u.split(',')[1], 'base64')).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  for (const n of names) for (const h of TIMES) {
    const page = await open(browser, port, n, `${Q}&time=${h}&clean`); await sleep(SETTLE);
    if (arg('lose', '')) await page.evaluate(async () => { const e = window.game.renderer.getContext().getExtension('WEBGL_lose_context'); e.loseContext(); await new Promise(r => setTimeout(r, 1000)); e.restoreContext(); await new Promise(r => setTimeout(r, 6000)); });   // after a lost and restored GL context
    if (arg('drive', '')) await page.evaluate(driveRoute, +arg('drive'));   // caught while moving: the cached shadow map at its oldest
    const [a, b] = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => { const g = window.game, r = g.renderer, c = r.domElement; g.lean.bypass = true; r.render(g.scene, g.camera); const A = c.toDataURL('image/png'); g.lean.bypass = false; r.render(g.scene, g.camera); const B = c.toDataURL('image/png'); res([A, B]); })));
    await page.close();
    const [ra, rb] = await Promise.all([decode(a), decode(b)]), N = ra.data.length / 4, D = Buffer.alloc(ra.data.length); let d8 = 0, d32 = 0, sum = 0;
    for (let i = 0; i < ra.data.length; i += 4) { const d = Math.max(Math.abs(ra.data[i] - rb.data[i]), Math.abs(ra.data[i + 1] - rb.data[i + 1]), Math.abs(ra.data[i + 2] - rb.data[i + 2])); sum += d; if (d > 8) d8++; if (d > 32) d32++; D[i] = D[i + 1] = D[i + 2] = Math.min(255, d * 4); D[i + 3] = 255; }
    const tag = `${n}-${h}`; fs.writeFileSync(path.join(OUT, `${tag}-now.png`), Buffer.from(a.split(',')[1], 'base64')); fs.writeFileSync(path.join(OUT, `${tag}-lean.png`), Buffer.from(b.split(',')[1], 'base64'));
    await sharp(D, { raw: { width: ra.info.width, height: ra.info.height, channels: 4 } }).png().toFile(path.join(OUT, `${tag}-diff.png`));
    console.log(SPOTS[n][0].padEnd(24), String(h).padStart(5), 'h  mean difference', (sum / N).toFixed(3), ' pixels >8:', (100 * d8 / N).toFixed(3) + '%', ' >32:', (100 * d32 / N).toFixed(3) + '%');
  }
  await browser.close();
}
else if (MODE === 'drive') {
  const A = await launch(), B = await launch(), rs = [];
  const run = async (browser, extra) => {
    const page = await open(browser, port, 'qc', extra); const cdp = await page.createCDPSession(); await cdp.send('Performance.enable'); await sleep(SETTLE);
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await sleep(3000);
    const metric = async m => (await cdp.send('Performance.getMetrics')).metrics.find(x => x.name === m).value;
    const t0 = await metric('TaskDuration');
    const R = await page.evaluate(driveRoute, +arg('seconds', 60));
    const t1 = await metric('TaskDuration'); await page.close();
    return { ...R, main: (t1 - t0) * 1000 / R.frames };
  };
  for (let k = 0; k < RUNS; k++) { const [a, b] = await Promise.all([run(A, QA), run(B, Q)]); rs.push({ a, b }); console.log('run', k, 'before', JSON.stringify(a)); console.log('run', k, 'after ', JSON.stringify(b)); }
  await A.close(); await B.close();
}
else if (MODE === 'eval') {   // --file x.js holds an async function body, run in the page after the settle time; what it returns is printed as JSON
  const browser = await launch();
  for (const n of names) { const page = await open(browser, port, n, Q); await sleep(SETTLE); if (arg('throttle', '')) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: +arg('throttle') }); await sleep(2000); } const body = fs.readFileSync(arg('file'), 'utf8'); const r = await page.evaluate(new Function('return (async () => {' + body + '})()')); console.log(n, typeof r === 'string' ? r : JSON.stringify(r)); await page.close(); }
  await browser.close();
}
server.close(); if (srvB) srvB.server.close();
