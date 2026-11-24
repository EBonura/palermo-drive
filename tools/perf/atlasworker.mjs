// Is the wall atlas the same wherever it is painted? Paints the whole atlas (every layer, every mip level) three ways in one browser and compares the bytes, layer by layer and level by level:
//   main     on the main thread, with DOM canvases, as the game does without workers (the loop of paintAtlas in src/buildings.js)
//   workers  through the work pool, slices of layers on OffscreenCanvas in workers (src/work-pool.js, src/atlas-task.js)
//   fallback the pool's own main-thread fallback (?workers=off), and the fallback after the worker file is blocked (a worker that cannot start)
// It runs the source tree as it is served unbundled (no build needed) in two browser setups: GPU canvas on (the flags the load tests use) and off (--disable-gpu), and prints a SHA-256 of each result.
//   tools/release/withbrowser.sh node tools/perf/atlasworker.mjs
//   node tools/perf/atlasworker.mjs --webkit     the same in real WebKit (tools/perf/wk.swift: off screen, silent), main thread, workers and ?workers=off (a blocked worker file cannot be set up there)
// Exit code 1 when anything differs.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));

// in the page: every result as { data, mips } flat arrays (the whole atlas), returned as base64 per layer would be huge, so it is hashed here and the layers compared inside the page
const PAGE = async mode => {
  const [{ T, LAYERS, paintLayer }, task, pool] = await Promise.all([import((self.__BASE || '') + '/src/atlas-layers.js'), import((self.__BASE || '') + '/src/atlas-task.js'), import((self.__BASE || '') + '/src/work-pool.js')]);
  const N = LAYERS.length, data = new Uint8Array(T * T * 4 * N), mips = task.newMips(N);
  const t0 = performance.now();
  const mainPaint = list => {   // the loop of paintAtlas in src/buildings.js
    const cv = document.createElement('canvas'); cv.width = cv.height = T;
    const g = cv.getContext('2d', { willReadFrequently: true });
    for (const i of list) { paintLayer(g, i); task.flipInto(data, g.getImageData(0, 0, T, T).data, i); task.mipLayer(data, mips, i); }
  };
  const left = []; let sameAsPage = null;
  if (mode === 'main') mainPaint(Array.from({ length: N }, (_, i) => i));
  else if (!(sameAsPage = pool.usesWorkers() && task.probeMatches(await pool.run('probe', {})))) { mainPaint(Array.from({ length: N }, (_, i) => i)); left.push(...Array(N)); }   // as the game does: no workers when this browser's OffscreenCanvas draws differently from the page's
  else {
    const jobs = [];
    for (let from = 0; from < N; from += 8) jobs.push(pool.run('atlas', { from, to: Math.min(from + 8, N), mips: true }).then(r => {
      data.set(r.data, r.from * T * T * 4);
      mips.forEach((m, l) => m.data.set(r.mips[l], r.from * m.w * m.w * 4));
      left.push(...r.left);
    }));
    await Promise.all(jobs);
    mainPaint(left);   // what the workers left for the main thread
  }
  const ms = performance.now() - t0, hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const sha = async a => hex(await crypto.subtle.digest('SHA-256', a));
  const layers = [];   // per layer: the hash of its level 0 and of each mip level
  for (let i = 0; i < N; i++) layers.push([await sha(data.subarray(i * T * T * 4, (i + 1) * T * T * 4)), ...await Promise.all(mips.map(m => sha(m.data.subarray(i * m.w * m.w * 4, (i + 1) * m.w * m.w * 4))))].join(','));
  return { N, ms, left: left.length, offscreen2d: typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d'), worker: typeof Worker !== 'undefined', usesWorkers: pool.usesWorkers() && sameAsPage, sameAsPage, total: await sha(new TextEncoder().encode(layers.join('\n'))), layers };
};

const WEBKIT = process.argv.includes('--webkit');
const CONFIGS = WEBKIT ? { 'WebKit': null } : { 'gpu canvas': ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], 'software canvas': ['--mute-audio', '--disable-gpu'] };
const { server, port } = await startServer(REPO, REPO);
// real WebKit: one wk process per run (wk.swift, built once by swiftc), the page script injected at document start; it posts the result as one line of JSON
function runWebKit(mode, q) {
  const CACHE = path.join(REPO, 'tools/build/.cache'), WK = path.join(CACHE, 'wk'), src = path.join(HERE, 'wk.swift');
  if (!fs.existsSync(WK) || fs.statSync(WK).mtimeMs < fs.statSync(src).mtimeMs) { fs.mkdirSync(CACHE, { recursive: true }); execFileSync('swiftc', ['-O', src, '-o', WK], { stdio: 'inherit' }); }
  const probe = path.join(os.tmpdir(), `atlasworker-probe-${process.pid}.js`);
  fs.writeFileSync(probe, `(() => { self.__BASE = ${JSON.stringify("http://127.0.0.1:" + port)}; const post = o => window.webkit.messageHandlers.probe.postMessage(JSON.stringify(o));
    for (const k of ['AudioContext', 'webkitAudioContext']) { const A = window[k]; if (!A) continue; window[k] = class extends A { constructor(...a) { super(...a); super.suspend(); } resume() { return Promise.resolve(); } }; }
    addEventListener('error', e => post({ error: String(e.message).slice(0, 300) }));
    (async () => { try { post({ result: await (${PAGE})(${JSON.stringify(mode)}) }); } catch (e) { post({ error: String(e) + " " + String(e && e.stack).slice(0, 400) }); } window.webkit.messageHandlers.probe.postMessage('done'); })(); })();`);
  return new Promise((resolve, reject) => {
    const p = spawn(WK, [`http://127.0.0.1:${port}/manifest.webmanifest${q}`, probe, '400', '300', '240'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '', out = null;
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const o = JSON.parse(l); if (o.result) out = o.result; else if (o.error) console.log('  page error:', o.error); } catch {} } });
    p.on('exit', () => { fs.rmSync(probe, { force: true }); out ? resolve(out) : reject(new Error('no result from WebKit')); });
  });
}
let bad = 0;
for (const [label, args] of Object.entries(CONFIGS)) {
  const browser = WEBKIT ? { close: async () => {} } : await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args });
  const run = WEBKIT ? (mode, q = '', block = false) => block ? null : runWebKit(mode, q) : async (mode, q = '', block = false) => {
    const page = await browser.newPage();
    if (block) { await page.setRequestInterception(true); page.on('request', r => /\/src\/worker\.js/.test(r.url()) ? r.abort() : r.continue()); }
    page.on('pageerror', e => console.log('  page error:', e.message.slice(0, 200)));
    await page.goto(`http://127.0.0.1:${port}/manifest.webmanifest${q}`);
    const r = await page.evaluate(`(${PAGE})(${JSON.stringify(mode)})`);
    await page.close();
    return r;
  };
  // the main thread's own path is not always the same twice with the GPU on (a few layers whose scratch canvases are sometimes accelerated and sometimes not): painted twice, those layers are left out of the comparison and listed
  const main = await run('main'), main2 = await run('main');
  const unstable = new Set(main.layers.map((l, i) => l === main2.layers[i] ? -1 : i).filter(i => i >= 0));
  const cases = [['workers', await run('pool')], ['fallback (?workers=off)', await run('pool', '?workers=off')], ['worker file blocked', await run('pool', '', true)]].filter(c => c[1]);
  console.log(`${label}: ${main.N} layers, ${main.layers[0].split(',').length} levels each (pixels and mips); the main thread's own two runs differ in ${unstable.size} layer(s)${unstable.size ? ' (' + [...unstable].join(',') + '), left out below' : ''}`);
  console.log(`  features: Worker ${main.worker}, OffscreenCanvas 2D ${main.offscreen2d}`);
  console.log(`  main thread          ${main.total}  ${main.ms.toFixed(0)} ms`);
  for (const [name, r] of cases) {
    const diff = r.layers.map((l, i) => l === main.layers[i] || unstable.has(i) ? -1 : i).filter(i => i >= 0);
    if (diff.length) bad++;
    console.log(`  ${name.padEnd(23)} ${r.total}  ${r.ms.toFixed(0)} ms  usesWorkers=${r.usesWorkers}  layers left to the main thread: ${r.left}  ${diff.length ? 'DIFFERENT in layers ' + diff.slice(0, 20).join(',') + ' (' + diff.length + ')' : 'IDENTICAL' + (r.total === main.total ? ' (same total hash)' : '')}`);
  }
  await browser.close();
}
server.close();
console.log(bad ? `FAIL: ${bad} case(s) differ` : 'PASS: every case is byte for byte the main thread\'s atlas');
process.exit(bad ? 1 : 0);
