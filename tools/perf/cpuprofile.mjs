// Main-thread profile of the running game, the same way every time: five scenes on the phone profile (844x390 at DPR 3, touch UI, full graphics) at a 4x and a 6x CPU slowdown.
//   cd tools/build && node build.mjs --minify=false --out=/some/dir            # a readable bundle: the tool maps it back to the source modules by esbuild's "// src/x.js" lines
//   tools/release/withbrowser.sh node tools/perf/cpuprofile.mjs --root /some/dir [--scenes qc,maqueda,ballaro,viale,mondello] [--cpu 4,6] [--label base] [--out dir] [--secs 20] [--top 30] [--keep 1 saves the .cpuprofile] [--coldcpu 1 profiles the first pass]
// Per scene and slowdown one page load, settle, then three passes over the same stretch (a scripted driver with the real keys and the real physics; qc stands still):
//   timing   frame interval and rAF work per frame (percentiles, worst), CDP TaskDuration per frame, a trace of every task on the main thread: long tasks, GC, style and layout. First pass, so cold tiles load in it.
//   cpu      sampling profiler at 0.5 ms: self time by function and by module, inclusive time of each thing the main loop calls ("per system"), in ms per frame.
//   alloc    sampling heap profiler, garbage included: KB per second and by function.
// Writes <out>/<label>-<scene>-<cpu>x.json and appends to <out>/<label>.md. The numbers are headless Chrome on the machine it runs on with CDP throttling, a stand-in for a phone: JS cost scales roughly, GPU cost does not,
// Safari's GC and layout are not Chrome's. The machine is often shared: compare two builds by alternating them, and read small differences as noise.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), OUT = path.resolve(arg('out', '.')), LABEL = arg('label', 'run'), SECS = +arg('secs', 20), TOP = +arg('top', 30);
const CPUS = String(arg('cpu', '4,6')).split(',').map(Number), TIME = arg('time', '13'), EXTRA = arg('query', '');
fs.mkdirSync(OUT, { recursive: true });

// Scenes: a place, a heading, and for a drive the line to follow (x, z pairs from the tile roads) and a speed in m/s.
const SCENES = {
  qc: { name: 'Quattro Canti, standing', at: [17.5, 0, 0] },
  maqueda: { name: 'Via Maqueda, driving through Quattro Canti', v: 12, line: [133, 229, 102, 169, 78, 121, 63, 92, 44, 55, 30, 28, 16, 0, 0, -30, -50, -126, -69, -164, -94, -214, -115, -254, -136, -296, -179, -379, -211, -443, -240, -500, -255, -529, -277, -573, -297, -609] },
  ballaro: { name: 'Ballaro, Via Albergheria at market speed', v: 7, line: [-285, 645, -264, 630, -245, 618, -227, 608, -209, 599, -189, 588, -169, 578, -131, 558, -113, 544, -96, 533, -68, 513, -49, 500, -8, 469, 25, 489, 50, 500] },
  viale: { name: 'Viale Regione, driving fast (streaming)', v: 26, line: [-2826, -627, -2809, -818, -2791, -1000, -2775, -1176, -2751, -1449, -2728, -1514, -2724, -1579, -2712, -1692, -2705, -1763, -2692, -1890, -2685, -1958, -2677, -2022, -2670, -2089, -2656, -2212, -2646, -2298, -2637, -2387, -2624, -2506, -2614, -2570, -2602, -2635] },
  mondello: { name: 'Mondello seafront, Viale Regina Elena', v: 14, line: [-2682, -9072, -2722, -9110, -2769, -9157, -2802, -9194, -2833, -9228, -2864, -9262, -2898, -9299, -2928, -9333, -2961, -9377, -2994, -9436, -3017, -9482, -3024, -9521, -3055, -9582, -3075, -9623, -3103, -9655, -3123, -9692, -3149, -9745, -3161, -9797, -3168, -9851, -3173, -9892, -3174, -9943, -3166, -9986, -3143, -10034] },
};
const names = String(arg('scenes', Object.keys(SCENES).join(','))).split(',');

// ---------- source map by hand: the unminified bundle says "// src/x.js" before each module
const appFile = fs.readdirSync(path.join(ROOT, 'js')).find(f => /^app\..*\.js$/.test(f));
const bundle = fs.readFileSync(path.join(ROOT, 'js', appFile), 'utf8').split('\n');
const modStart = []; bundle.forEach((l, i) => { const m = l.match(/^\/\/ ((?:[^\s]+\/)?[^\s/]+\.m?js)$/); if (m) modStart.push([i, m[1].replace(/^.*node_modules\//, '').replace(/^(\.\.\/)+/, '')]); });
if (modStart.length < 10) console.error('warning: no module markers in', appFile, '(build with --minify=false for readable names)');
const moduleAt = line => { let a = 0, b = modStart.length - 1, r = '?'; while (a <= b) { const m = (a + b) >> 1; if (modStart[m][0] <= line) { r = modStart[m]; a = m + 1; } else b = m - 1; } return r === '?' ? ['?', 0] : r; };
const short = m => m.replace(/^src\//, '').replace(/^three\/build\/three\.(core|module)(\.min)?\.js$/, 'three').replace(/^three\/.*\//, 'three/');

const median = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2);

// ---------- page side: rAF timing and the driver
const PAGE_EARLY = () => {
  const raf = window.requestAnimationFrame.bind(window), F = window.__ft = { on: false, work: [], gap: [], t: -1, cur: 0, last: 0 };
  window.requestAnimationFrame = cb => raf(t => {
    const a = performance.now(); cb(t); const b = performance.now();
    if (t !== F.t) { if (F.on && F.t >= 0) { F.work.push(F.cur); F.gap.push(a - F.last); } F.t = t; F.cur = 0; F.last = a; }
    F.cur += b - a;
  });
};
const PAGE_DRIVER = () => {
  const G = window.game, keys = G.keys, car = G.car; let timer = null, S = null;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const stop = () => { if (timer) clearInterval(timer); timer = null; keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false; };
  function tick() {
    const P = S.P; S.fr++;
    while (S.i < P.length - 2 && Math.hypot(P[S.i] - car.x, P[S.i + 1] - car.z) < clamp(car.vf * 0.8, 10, 40)) S.i += 2;
    const e = wrap(Math.atan2(P[S.i] - car.x, P[S.i + 1] - car.z) - car.th), v = Math.hypot(car.vx, car.vz), fwd = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    S.dist += Math.hypot(car.x - S.x, car.z - S.z); S.x = car.x; S.z = car.z;
    if (S.rev > 0) { S.rev -= 1 / 30; keys.ArrowUp = false; keys.ArrowDown = true; keys.ArrowLeft = e < 0; keys.ArrowRight = e > 0; if (S.rev <= 0) keys.ArrowDown = false; return; }
    if (v < 0.8) { if ((S.slow += 1 / 30) > 2.5) { S.slow = 0; S.rev = 1.6; S.backs++; } } else S.slow = 0;
    const duty = Math.min(1, Math.abs(e) / 0.25), pulse = (S.fr % 4) < duty * 4 + 0.001 && duty > 0.05, cap = Math.abs(e) > 0.5 ? Math.min(S.v, 6) : S.v;
    keys.ArrowLeft = pulse && e > 0; keys.ArrowRight = pulse && e < 0; keys.ArrowUp = fwd < cap * 0.98; keys.ArrowDown = fwd > cap * 1.25;
  }
  window.__drv = {
    start(P, v) { stop(); S = { P, v, i: 2, fr: 0, slow: 0, rev: 0, backs: 0, dist: 0, x: car.x, z: car.z }; timer = setInterval(tick, 33); },
    stop, status: () => S && { dist: Math.round(S.dist), backs: S.backs, x: Math.round(car.x), z: Math.round(car.z), v: +Math.hypot(car.vx, car.vz).toFixed(1), i: S.i },
  };
};

// ---------- CPU profile
function analyseProfile(profile, frames) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const d = (profile.timeDeltas[i] || 0) / 1000; total += d; self.set(id, (self.get(id) || 0) + d); });
  for (const n of profile.nodes) for (const c of n.children || []) nodes.get(c).parent = n;
  const memo = new Map(), incl = id => { if (memo.has(id)) return memo.get(id); const n = nodes.get(id); let t = self.get(id) || 0; for (const c of n.children || []) t += incl(c); memo.set(id, t); return t; };
  const modOf = cf => cf.url && cf.url.includes(appFile) ? moduleAt(cf.lineNumber)[1] : (cf.url ? cf.url.replace(/^https?:\/\/[^/]+\//, '') : '(native)');
  const label = cf => `${cf.functionName || '(anon)'} [${short(modOf(cf))}]`;
  const byFn = new Map(), byMod = new Map(), bySys = new Map(), outside = new Map(); let loop = 0, loopSelf = 0;
  for (const n of profile.nodes) {
    const s = self.get(n.id) || 0, cf = n.callFrame;
    const key = `${label(cf)}:${cf.lineNumber + 1}`; byFn.set(key, (byFn.get(key) || 0) + s);
    const mod = cf.url ? short(modOf(cf)) : cf.functionName; byMod.set(mod, (byMod.get(mod) || 0) + s);
    const main = n.parent && n.parent.callFrame.functionName === 'onAnimationFrame' && modOf(cf) === 'src/main.js';
    if (main) {
      loop += incl(n.id); loopSelf += s;
      for (const c of n.children || []) { const k = label(nodes.get(c).callFrame); bySys.set(k, (bySys.get(k) || 0) + incl(c)); }
    }
    // what runs outside the loop: the children of the root (timers, worker messages, other animation frames), by function
    if (n.parent && !n.parent.parent && !/^\((idle|program|garbage collector|root)\)$/.test(cf.functionName)) { const k = label(cf); outside.set(k, (outside.get(k) || 0) + incl(n.id)); }
  }
  const per = m => [...m].map(([k, t]) => [k, +(t / frames).toFixed(3)]).sort((a, b) => b[1] - a[1]);
  // the worst frames: split the samples into loop runs, take the worst 2% of them, and say what filled them (inclusive, by what the loop called, then by the deepest src/ or three function)
  const loopChild = new Map(); (function mark(n, sys) { const c = nodes.get(n); for (const q of c.children || []) { const cn = nodes.get(q), isLoop = c.callFrame.functionName === 'onAnimationFrame' && modOf(cn.callFrame) === 'src/main.js', s2 = sys || (isLoop ? '(loop self)' : null); loopChild.set(q, sys === '(loop self)' ? label(cn.callFrame) : s2); mark(q, loopChild.get(q)); } })(profile.nodes[0].id, null);
  const runs = []; let cur = null;
  profile.samples.forEach((id, i) => { const d = (profile.timeDeltas[i] || 0) / 1000, sys = loopChild.get(id); if (sys) { if (!cur) cur = { ms: 0, sys: new Map(), fn: new Map() }; cur.ms += d; cur.sys.set(sys, (cur.sys.get(sys) || 0) + d); const k = label(nodes.get(id).callFrame); cur.fn.set(k, (cur.fn.get(k) || 0) + d); } else if (cur && !/^\(garbage collector\)$/.test(nodes.get(id).callFrame.functionName)) { runs.push(cur); cur = null; } });
  runs.sort((a, b) => b.ms - a.ms);
  const worstN = Math.max(3, runs.length >> 5), worst = runs.slice(0, worstN), wSys = new Map(), wFn = new Map();
  for (const r of worst) { for (const [k, t] of r.sys) wSys.set(k, (wSys.get(k) || 0) + t / worstN); for (const [k, t] of r.fn) wFn.set(k, (wFn.get(k) || 0) + t / worstN); }
  const top = m => [...m].map(([k, t]) => [k, +t.toFixed(2)]).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const spikes = { n: worstN, medianRunMs: +(runs.length ? runs[runs.length >> 1].ms : 0).toFixed(1), worstMs: worst.slice(0, 6).map(r => +r.ms.toFixed(1)), systems: top(wSys), self: top(wFn) };
  return { spikes, totalMs: total, frames, loopMs: +(loop / frames).toFixed(2), loopSelfMs: +(loopSelf / frames).toFixed(2), systems: per(bySys), topSelf: per(byFn).slice(0, TOP), modules: per(byMod).slice(0, 30), outside: per(outside).filter(x => x[0] !== '(anon) [(native)]').slice(0, 15) };
}

// ---------- trace: long tasks, GC, style and layout on the main thread
function analyseTrace(buf, frames) {
  const ev = JSON.parse(Buffer.from(buf).toString()).traceEvents;
  const mainT = ev.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain' && ev.some(q => q.tid === e.tid && q.pid === e.pid && (q.name === 'FireAnimationFrame' || q.name === 'FunctionCall')));
  const on = mainT ? ev.filter(e => e.pid === mainT.pid && e.tid === mainT.tid && e.ph === 'X') : [];
  const sum = n => on.filter(e => n.test(e.name)).reduce((a, e) => a + (e.dur || 0) / 1000, 0), list = n => on.filter(e => n.test(e.name)).map(e => (e.dur || 0) / 1000);
  const tasks = list(/RunTask$/), gcs = list(/^(MinorGC|MajorGC)$/), gcMinor = list(/^MinorGC$/), gcMajor = list(/^MajorGC$/);
  return {
    tasks: tasks.length, longOver16: tasks.filter(t => t > 16.7).length, longOver33: tasks.filter(t => t > 33).length, longOver50: tasks.filter(t => t > 50).length, longOver100: tasks.filter(t => t > 100).length, worstTasks: [...tasks].sort((a, b) => b - a).slice(0, 6).map(t => +t.toFixed(1)),
    gcCount: gcs.length, gcMs: +gcs.reduce((a, b) => a + b, 0).toFixed(1), gcWorst: +(Math.max(0, ...gcs)).toFixed(1), minor: gcMinor.length, major: gcMajor.length, gcMsPerFrame: +(gcs.reduce((a, b) => a + b, 0) / Math.max(1, frames)).toFixed(3),
    styleMsPerFrame: +(sum(/^UpdateLayoutTree$/) / Math.max(1, frames)).toFixed(3), layoutMsPerFrame: +(sum(/^Layout$/) / Math.max(1, frames)).toFixed(3), paintMsPerFrame: +(sum(/^(Paint|PrePaint|Layerize|Commit)$/) / Math.max(1, frames)).toFixed(3),
  };
}

// ---------- one scene at one slowdown
const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function scene(id, cpu) {
  const S = SCENES[id], line = S.line, at = S.at || [line[0], line[1], Math.atan2(line[2] - line[0], line[3] - line[1])];
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const cdp = await page.createCDPSession(); await cdp.send('Performance.enable');
  await page.evaluateOnNewDocument(PAGE_EARLY);
  await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&time=${TIME}&at=${at.join(',')}${EXTRA ? '&' + EXTRA : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.game && window.__missions && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await wait(9000);
  await page.evaluate(PAGE_DRIVER);
  await page.evaluate(() => { const r = window.game.renderer, o = r.render.bind(r); window.__rt = { t: 0, n: 0 }; r.render = (a, c) => { const t0 = performance.now(); o(a, c); window.__rt.t += performance.now() - t0; window.__rt.n++; }; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await wait(4000);
  const metric = async n => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === n).value;
  const go = async () => { if (!line) return; await page.evaluate((x, z, th) => window.__missions.X.vehicle.teleport(x, z, th), at[0], at[1], at[2]); await wait(1000); await page.evaluate((P, v) => window.__drv.start(P, v), line, S.v); };
  const end = async () => line ? page.evaluate(() => { const s = window.__drv.status(); window.__drv.stop(); return s; }) : null;
  const R = { scene: id, name: S.name, cpu, secs: SECS, profile: 'phone 844x390 DPR3, full graphics, headless Chrome with CDP CPU throttling' };

  // timing pass (cold: the first time over the stretch)
  const timingPass = async () => {
  await go();
  await page.tracing.start({ categories: ['toplevel', 'devtools.timeline'] });
  await page.evaluate(() => { const F = window.__ft; F.work = []; F.gap = []; F.on = true; window.__rt.t = 0; window.__rt.n = 0; });
  const t0 = await metric('TaskDuration'), s0 = await metric('ScriptDuration');
  const wall0 = Date.now(); await wait(SECS * 1000); const wall = (Date.now() - wall0) / 1000;
  const t1 = await metric('TaskDuration'), s1 = await metric('ScriptDuration');
  const fr = await page.evaluate(() => { const F = window.__ft; F.on = false; return { work: F.work, gap: F.gap, rms: window.__rt.t / Math.max(1, window.__rt.n), calls: window.game.renderer.info.render.calls }; });
  const trace = await page.tracing.stop(), n = fr.work.length;
  R.drive = await end();
  R.crowd = await page.evaluate(() => { const X = window.__missions.X, p = X.pedestrians?.stats, t = window.game.traffic?.stats; return { peds: p?.count ?? null, pedMs: p?.avgMs ?? null, traffic: t?.count ?? t?.n ?? null, calls: window.game.renderer.info.render.calls }; });
  R.timing = { frames: n, fps: +(n / wall).toFixed(1), mainMsPerFrame: +((t1 - t0) * 1000 / n).toFixed(2), scriptMsPerFrame: +((s1 - s0) * 1000 / n).toFixed(2), renderMs: +fr.rms.toFixed(2),
    workP50: +median(fr.work).toFixed(1), workP95: +pct(fr.work, 0.95).toFixed(1), workP99: +pct(fr.work, 0.99).toFixed(1), workMax: +Math.max(0, ...fr.work).toFixed(1), workSpike: fr.work.filter(w => w > 2 * median(fr.work)).length,
    gapP50: +median(fr.gap).toFixed(1), gapP95: +pct(fr.gap, 0.95).toFixed(1), gapP99: +pct(fr.gap, 0.99).toFixed(1), gapMax: +Math.max(0, ...fr.gap).toFixed(1) };
  R.trace = analyseTrace(trace, n);
  };

  // cpu pass (warm, or the cold one with --coldcpu 1, for what only a first pass over the stretch does: tile downloads, decoding, the first build)
  const cpuPass = async () => {
  await go();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await page.evaluate(() => { const F = window.__ft; F.work = []; F.gap = []; F.on = true; });
  await cdp.send('Profiler.start'); await wait(SECS * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const frames = await page.evaluate(() => { const F = window.__ft; F.on = false; return F.work.length; });
  R.cpuDrive = await end();
  R.cpuProfile = analyseProfile(profile, frames);
  if (arg('keep')) fs.writeFileSync(path.join(OUT, `${LABEL}-${id}-${cpu}x.cpuprofile`), JSON.stringify(profile));
  };
  if (arg('coldcpu')) { await cpuPass(); await timingPass(); } else { await timingPass(); await cpuPass(); }

  // alloc pass
  await go();
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await page.evaluate(() => { const F = window.__ft; F.work = []; F.gap = []; F.on = true; });
  const allocS = Math.min(SECS, 12); await wait(allocS * 1000);
  const heap = (await cdp.send('HeapProfiler.stopSampling')).profile;
  const allocFrames = await page.evaluate(() => { const F = window.__ft; F.on = false; return F.work.length; });
  await end();
  const allocs = new Map(); let bytes = 0;
  (function walk(n) { const cf = n.callFrame, k = `${cf.functionName || '(anon)'} [${short(cf.url && cf.url.includes(appFile) ? moduleAt(cf.lineNumber)[1] : (cf.url ? 'other' : '(native)'))}]:${cf.lineNumber + 1}`; allocs.set(k, (allocs.get(k) || 0) + n.selfSize); bytes += n.selfSize; n.children.forEach(walk); })(heap.head);
  R.alloc = { kbPerSec: +(bytes / 1024 / allocS).toFixed(0), kbPerFrame: +(bytes / 1024 / Math.max(1, allocFrames)).toFixed(1), top: [...allocs].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => [k, +(v / 1024 / allocS).toFixed(1)]) };
  // the tile build steps that took over 6 ms on the main thread, by stage (src/world.js keeps the last 40)
  R.slowSteps = await page.evaluate(() => { const m = {}; for (const [ms, , st] of window.game.world.stats().slow || []) { const q = m[st] || (m[st] = { n: 0, worst: 0 }); q.n++; if (ms > q.worst) q.worst = ms; } return m; });
  R.heapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  R.errors = errs;
  await page.close();
  return R;
}

const md = path.join(OUT, LABEL + '.md');
for (const c of CPUS) for (const id of names) {
  const R = await scene(id, c).catch(e => ({ scene: id, cpu: c, failed: e.message }));
  fs.writeFileSync(path.join(OUT, `${LABEL}-${id}-${c}x.json`), JSON.stringify(R, null, 1));
  if (R.failed) { console.log(`${id} ${c}x FAILED ${R.failed}`); continue; }
  const T = R.timing, G = R.trace, P = R.cpuProfile;
  const head = `### ${LABEL}: ${R.name}, ${c}x CPU (${R.profile})\n` +
    `fps ${T.fps}, frame gap p50/p95/p99/max ${T.gapP50}/${T.gapP95}/${T.gapP99}/${T.gapMax} ms; rAF work p50/p95/p99/max ${T.workP50}/${T.workP95}/${T.workP99}/${T.workMax} ms; main ${T.mainMsPerFrame} ms/frame (script ${T.scriptMsPerFrame}, renderer.render ${T.renderMs}); ` +
    `tasks over 33/50/100 ms ${G.longOver33}/${G.longOver50}/${G.longOver100} worst ${G.worstTasks.join(',')}; GC ${G.gcCount} (${G.minor} minor, ${G.major} major) ${G.gcMs} ms, worst ${G.gcWorst} ms, ${G.gcMsPerFrame} ms/frame; style ${G.styleMsPerFrame} layout ${G.layoutMsPerFrame} paint ${G.paintMsPerFrame} ms/frame; alloc ${R.alloc.kbPerSec} KB/s (${R.alloc.kbPerFrame} KB/frame); heap ${R.heapMB} MB; peds ${R.crowd.peds}, drive ${JSON.stringify(R.drive)}; errors ${R.errors.length}\n`;
  const tab = (t, a, n = 18) => `${t}: ` + a.slice(0, n).map(([k, v]) => `${k} ${f2(v)}`).join(' | ') + '\n';
  const txt = head + 'tile steps over 6 ms: ' + Object.entries(R.slowSteps).map(([k, v]) => `${k} ${v.n}x worst ${v.worst}`).join(' | ') + '\n' + tab(`systems (loop ${P.loopMs} ms/frame, inclusive)`, P.systems, 24) + `worst ${P.spikes.n} frames (median frame ${P.spikes.medianRunMs} ms; worst ${P.spikes.worstMs.join(',')}): ` + P.spikes.systems.map(([k, v]) => `${k} ${v}`).join(' | ') + '\n  self in them: ' + P.spikes.self.map(([k, v]) => `${k} ${v}`).join(' | ') + '\n' + tab('modules self', P.modules, 16) + tab('outside the loop', P.outside, 8) + tab('top self', P.topSelf, 20) + 'alloc KB/s: ' + R.alloc.top.slice(0, 10).map(([k, v]) => `${k} ${v}`).join(' | ') + '\n\n';
  fs.appendFileSync(md, txt); console.log(txt);
}
await browser.close(); server.close();
