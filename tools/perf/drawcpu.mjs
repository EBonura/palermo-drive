// What renderer.render costs the main thread, and what it sends to GL: the numbers behind "The draw path" in docs/PERF.md.
//   cd tools/build && node build.mjs --minify=false --out=/some/dir
//   tools/release/withbrowser.sh node tools/perf/drawcpu.mjs --root /some/dir [--spots qc,regione,vucciria,mondello] [--times 12,22.5] [--cpu 6] [--q 'draw=off'] [--blocks 24] [--n 12]
//        [--profile 1] [--top 40] [--ab all,tree,quick,uni] [--label base] [--out dir] [--raw 1] [--mats 1] [--census 1]
// Two pages per spot and hour (phone profile: 844 x 390 at DPR 3, touch, the lapa parked, the clock held): one that counts, one that times (--census 1: only the first).
//   census   every GL call of a frame, by name (mean of 30 frames), with three's own draw count
//   time     renderer.render called over and over inside one task under CDP CPU throttling, the camera still and turned a hair each call (as it is while driving, so every
//            uniform that follows the view goes up again); the median of the blocks, in ms a call. The shadow pass is inside it, as in the game.
//   profile  (--profile 1) the sampling profiler over the turning loop: self time by function and inclusive time of three's stages, ms a call
//   ab       (--ab a,b) each switch of game.lean.draw (all: every one of them, the old path against the new) off and on in alternating blocks of the same loop, in one page: what it saves,
//            with the spread; and the GL calls each way. The only timing to trust on a machine that is doing other work: two runs are not comparable, two halves of one are
// Headless Chrome on this machine with a throttled main thread: a stand-in for a phone's JS. Every GL call costs more on Android (it is serialised to another process), so the call counts matter as much as the ms.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), CPU = +arg('cpu', 6), BLOCKS = +arg('blocks', 24), N = +arg('n', 12), TOP = +arg('top', 40), LABEL = arg('label', 'run'), OUT = arg('out', '');
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;
const ll = (lat, lon) => [((lon - LON0) * KX).toFixed(1), (-(lat - LAT0) * KZ).toFixed(1), 0].join(',');
const SPOTS = { qc: '15,5,0', vucciria: '210,-182,0', regione: ll(38.090479, 13.343314), mondello: '-3033.1,-10177.4,-1.07', ballaro: '24.9,488.6,-2.01', monreale: '-6125,3752,1.25' };   // the places of src/bench.js
const spots = String(arg('spots', 'qc')).split(','), times = String(arg('times', '12,22.5')).split(',');
const wait = ms => new Promise(r => setTimeout(r, ms));
const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0, mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const appFile = fs.readdirSync(path.join(ROOT, 'js')).find(f => /^app\..*\.js$/.test(f));
const bundle = fs.readFileSync(path.join(ROOT, 'js', appFile), 'utf8').split('\n');
const modStart = []; bundle.forEach((l, i) => { const m = l.match(/^\/\/ ((?:[^\s]+\/)?[^\s/]+\.m?js)$/); if (m) modStart.push([i, m[1].replace(/^.*node_modules\//, '').replace(/^(\.\.\/)+/, '').replace(/^three\/build\/three\.(core|module)(\.min)?\.js$/, 'three').replace(/^src\//, '')]); });
const moduleAt = line => { let a = 0, b = modStart.length - 1, r = '?'; while (a <= b) { const m = (a + b) >> 1; if (modStart[m][0] <= line) { r = modStart[m][1]; a = m + 1; } else b = m - 1; } return r; };

const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

// ---------- page side
const PAGE = () => {
  const G = window.game, R = G.renderer, gl = R.getContext(), P = WebGL2RenderingContext.prototype, render = R.render.bind(R);
  const names = Object.getOwnPropertyNames(P).filter(k => { const d = Object.getOwnPropertyDescriptor(P, k); return d && typeof d.value === 'function'; });
  const orig = {}; for (const k of names) orig[k] = P[k];
  const D = window.__dc = {
    // counting: on the census page the prototype's functions were wrapped before the game's scripts ran (src/engine-lean.js keeps bound copies of the draw calls, which a later wrapper would not see);
    // elsewhere they are wrapped only while a count runs. The timed loops run on a page with no wrapper at all.
    count(fn) {
      const pre = window.__glc;
      if (pre) { pre.C = {}; try { fn(); } finally { var out = pre.C; pre.C = null; } return out; }
      const C = {};
      for (const k of names) P[k] = function (...a) { C[k] = (C[k] || 0) + 1; return orig[k].apply(this, a); };
      try { fn(); } finally { for (const k of names) P[k] = orig[k]; }
      return C;
    },
    frame() { G.camera.rotateY(2e-5); render(G.scene, G.camera); },
    still() { render(G.scene, G.camera); },
    time(fn, n) { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; },
    async blocks(fn, blocks, n) { const out = []; for (let b = 0; b < blocks; b++) { out.push(D.time(fn, n)); await new Promise(r => setTimeout(r, 0)); } return out; },
    census(frames) {
      const tot = {}; let calls = 0, tris = 0;
      for (let f = 0; f < frames; f++) { const c = D.count(D.frame); for (const k in c) tot[k] = (tot[k] || 0) + c[k]; calls += R.info.render.calls; tris += R.info.render.triangles; }
      for (const k in tot) tot[k] = +(tot[k] / frames).toFixed(1);
      return { gl: tot, calls: calls / frames, tris: Math.round(tris / frames), programs: R.info.programs.length };
    },
    // which materials and programs the opaque and transparent lists hold, in the order drawn (one frame)
    mats() {
      const rbd = R.renderBufferDirect, seq = [];
      R.renderBufferDirect = function (c, sc, g, m, o, grp) { seq.push([m.id, m.type, m.name || '', o.name || o.type, o.isInstancedMesh ? 'I' : '', R.properties.get(m).currentProgram ? R.properties.get(m).currentProgram.id : -1, m.transparent ? 'T' : m.alphaTest > 0 ? 'C' : 'O', g.id]); return rbd.call(this, c, sc, g, m, o, grp); };
      try { D.frame(); } finally { R.renderBufferDirect = rbd; }
      return seq;
    },
  };
};

function analyse(profile, calls) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const d = (profile.timeDeltas[i] || 0) / 1000; total += d; self.set(id, (self.get(id) || 0) + d); });
  const memo = new Map(), incl = id => { if (memo.has(id)) return memo.get(id); const n = nodes.get(id); let t = self.get(id) || 0; for (const c of n.children || []) t += incl(c); memo.set(id, t); return t; };
  for (const n of profile.nodes) for (const c of n.children || []) nodes.get(c).parent = n;
  const label = cf => `${cf.functionName || '(anon)'} [${cf.url && cf.url.includes(appFile) ? moduleAt(cf.lineNumber) : cf.url ? 'page' : 'native'}]`;
  const byFn = new Map(), inc = new Map();
  for (const n of profile.nodes) {
    const k = label(n.callFrame) + (n.callFrame.url ? ':' + (n.callFrame.lineNumber + 1) : ''); byFn.set(k, (byFn.get(k) || 0) + (self.get(n.id) || 0));
    // inclusive, once per stack (a function under itself is not counted twice)
    const fnn = label(n.callFrame); let p = n.parent, rec = false; while (p) { if (label(p.callFrame) === fnn) { rec = true; break; } p = p.parent; }
    if (!rec) inc.set(fnn, (inc.get(fnn) || 0) + incl(n.id));
  }
  const per = m => [...m].map(([k, t]) => [k, +(t / calls).toFixed(3)]).sort((a, b) => b[1] - a[1]);
  return { totalMs: total, self: per(byFn).slice(0, TOP), incl: per(inc).filter(([k]) => /\[(three|engine-lean|native)\]/.test(k) || /onBeforeRender|onAfterRender/.test(k)).slice(0, TOP + 20) };
}

const GLKIND = k => /^uniform/.test(k) ? 'uniform' : /^draw/.test(k) || /^multiDraw/.test(k) ? 'draw' : /^bind(Buffer|VertexArray|Framebuffer|Texture|BufferBase|BufferRange|Sampler|Renderbuffer)/.test(k) || k === 'useProgram' || k === 'activeTexture' ? k : /^(enable|disable|depthMask|depthFunc|blendFunc|blendFuncSeparate|blendEquation|blendEquationSeparate|cullFace|frontFace|colorMask|polygonOffset|stencil.*|viewport|scissor|lineWidth|clearColor|clearDepth|clearStencil)$/.test(k) ? 'state' : /^(buffer(Sub)?Data|tex(Sub)?Image[23]D|texStorage[23]D)$/.test(k) ? 'upload' : 'other';
const summarise = gl => { const s = {}; let total = 0; for (const [k, v] of Object.entries(gl)) { const g = GLKIND(k); s[g] = +((s[g] || 0) + v).toFixed(1); total += v; } s.total = +total.toFixed(1); return s; };

function report(R) {
  const g = R.gl;
  console.log(`\n## ${LABEL} ${R.spot} ${R.time} h, ${CPU}x${R.q ? ' ?' + R.q : ''}: renderer.render ${R.turnMs === undefined ? 'not timed' : `${R.turnMs} ms turning (min ${R.turnMin}), ${R.stillMs} still`}; three draws ${R.calls}, triangles ${R.tris}, programs ${R.programs}`);
  console.log(`GL calls a frame: total ${g.total} | draw ${g.draw || 0} | uniform ${g.uniform || 0} | useProgram ${g.useProgram || 0} | bindVertexArray ${g.bindVertexArray || 0} | bindTexture ${g.bindTexture || 0} | activeTexture ${g.activeTexture || 0} | bindBuffer ${g.bindBuffer || 0} | bindFramebuffer ${g.bindFramebuffer || 0} | state ${g.state || 0} | upload ${g.upload || 0} | other ${g.other || 0}`);
  if (R.glRaw) console.log('  ' + Object.entries(R.glRaw).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | '));
  if (R.lean) console.log('lean: ' + JSON.stringify(R.lean));
  if (R.profile) { console.log('self, ms a call: ' + R.profile.self.map(([k, v]) => `${k} ${v}`).join(' | ')); console.log('inclusive, ms a call: ' + R.profile.incl.map(([k, v]) => `${k} ${v}`).join(' | ')); }
  if (R.ab) for (const [k, v] of Object.entries(R.ab)) console.log(typeof v === 'string' ? `ab ${k}: ${v}` : `ab ${k}: off ${v.offMs} on ${v.onMs} ms; saves ${v.saves} +- ${v.pm}, ${v.pct} % (off dearer in ${v.offDearer}); GL total ${v.glOff.total} to ${v.glOn.total}, uniform ${v.glOff.uniform} to ${v.glOn.uniform}, useProgram ${v.glOff.useProgram} to ${v.glOn.useProgram}, bindVertexArray ${v.glOff.bindVertexArray} to ${v.glOn.bindVertexArray}, draw ${v.glOff.draw} to ${v.glOn.draw}, state ${v.glOff.state} to ${v.glOn.state}`);
  if (R.errors.length) console.log('errors: ' + R.errors.join(' | '));
}

const PRE = () => {
  const P = WebGL2RenderingContext.prototype, S = window.__glc = { C: null };
  for (const k of Object.getOwnPropertyNames(P)) { const d = Object.getOwnPropertyDescriptor(P, k); if (!d || typeof d.value !== 'function') continue; const f = d.value; P[k] = function (...a) { const C = S.C; if (C) C[k] = (C[k] || 0) + 1; return f.apply(this, a); }; }
};
const SWITCHES = arg('ab') ? String(arg('ab')).split(',') : [];
const results = [];
for (const spot of spots) for (const time of times) {
  const errs = [], Q = arg('q', '');
  const open = async counting => {
    const page = await browser.newPage();
    page.on('pageerror', e => errs.push(e.message.slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    if (counting) await page.evaluateOnNewDocument(PRE);
    await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&p2p=off&weather=cumulus&time=${time}&at=${SPOTS[spot] || spot}${Q ? '&' + Q : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.game && window.game.clouds && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
    await wait(+arg('settle', 14000));
    await page.evaluate(PAGE);
    return page;
  };
  const R = { spot, time, cpu: CPU, q: Q };
  // the census page
  let page = await open(true);
  const census = await page.evaluate(() => window.__dc.census(30));
  R.calls = census.calls; R.tris = census.tris; R.programs = census.programs; R.gl = summarise(census.gl); if (arg('raw')) R.glRaw = census.gl;
  R.lean = await page.evaluate(() => { const s = window.game.lean && window.game.lean.stats(); return s ? { drawn: s.drawn, always: s.always, leaves: s.leaves, hidden: s.hidden, outside: s.outside } : null; });
  if (arg('mats')) R.mats = await page.evaluate(() => window.__dc.mats());
  const abGl = {};
  for (const sw of SWITCHES) abGl[sw] = await page.evaluate(sw => {
    const D = window.__dc, d = window.game.lean && window.game.lean.draw; if (!d || !(sw === 'all' || sw in d)) return null;
    const was = { ...d }, set = v => { for (const k in d) if (sw === 'all' || k === sw) d[k] = v; };
    set(false); D.frame(); D.frame(); const glOff = D.census(10);
    set(true); D.frame(); D.frame(); const glOn = D.census(10);
    Object.assign(d, was); return { glOff, glOn };
  }, sw);
  await page.close();
  if (arg('census')) { R.errors = errs; results.push(R); report(R); continue; }
  // the timing page
  page = await open(false);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() => window.__dc.blocks(window.__dc.frame, 3, 8));   // warm
  const turn = await page.evaluate((b, n) => window.__dc.blocks(window.__dc.frame, b, n), BLOCKS, N);
  const still = await page.evaluate((b, n) => window.__dc.blocks(window.__dc.still, b, n), BLOCKS, N);
  R.turnMs = +med(turn).toFixed(3); R.stillMs = +med(still).toFixed(3); R.turnMin = +Math.min(...turn).toFixed(3);
  if (arg('profile')) {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
    await cdp.send('Profiler.start');
    const n = await page.evaluate(async () => { let n = 0; const t = performance.now(); while (performance.now() - t < 12000) { for (let i = 0; i < 8; i++) window.__dc.frame(); n += 8; await new Promise(r => setTimeout(r, 0)); } return n; });
    const { profile } = await cdp.send('Profiler.stop');
    R.profile = analyse(profile, n); R.profileCalls = n;
    if (OUT && arg('keep')) fs.writeFileSync(path.join(OUT, `${LABEL}-${spot}-${time}.cpuprofile`), JSON.stringify(profile));
  }
  if (SWITCHES.length) {
    R.ab = {};
    for (const sw of SWITCHES) {
      const r = await page.evaluate(async (sw, pairs, n) => {
        const D = window.__dc, d = window.game.lean && window.game.lean.draw; if (!d || !(sw === 'all' || sw in d)) return null;
        const off = [], on = [], was = { ...d }, set = v => { for (const k in d) if (sw === 'all' || k === sw) d[k] = v; };
        for (let i = 0; i < pairs; i++) { for (const v of i & 1 ? [true, false] : [false, true]) { set(v); D.frame(); D.frame(); (v ? on : off).push(D.time(D.frame, n)); } await new Promise(r => setTimeout(r, 0)); }
        Object.assign(d, was); return { off, on };
      }, sw, BLOCKS, N);
      if (!r || !abGl[sw]) { R.ab[sw] = 'no such switch'; continue; }
      const d = r.off.map((x, i) => x - r.on[i]), sd = Math.sqrt(mean(d.map(x => (x - mean(d)) ** 2)) / Math.max(1, d.length - 1)), g = abGl[sw];
      R.ab[sw] = { offMs: +med(r.off).toFixed(3), onMs: +med(r.on).toFixed(3), saves: +mean(d).toFixed(3), pct: +(mean(d) / mean(r.off) * 100).toFixed(1), pm: +(1.96 * sd).toFixed(3), offDearer: `${d.filter(x => x > 0).length}/${d.length}`, glOff: summarise(g.glOff.gl), glOn: summarise(g.glOn.gl), callsOff: g.glOff.calls, callsOn: g.glOn.calls };
    }
  }
  await page.close();
  R.errors = errs;
  results.push(R); report(R);
}
if (OUT) fs.writeFileSync(path.join(OUT, LABEL + '.json'), JSON.stringify(results, null, 1));
await browser.close(); server.close();
