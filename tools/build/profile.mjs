// CPU profile of startup and of steady driving + heap allocation sampling (per-frame garbage).
//   node tools/build/profile.mjs --root dist --profile phone [--cpu 4] [--top 25]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { startServer } from './serve.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', 'dist')), CDN = arg('cdn', ''), PROFILE = arg('profile', 'desktop'), CPU = +arg('cpu', PROFILE === 'phone' ? 4 : 1), TOP = +arg('top', 25);
const { server, port } = await startServer(ROOT, CDN);
const browser = await puppeteer.launch({ executablePath: (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
if (PROFILE === 'phone') await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); else await page.setViewport({ width: 1280, height: 720 });
const cdp = await page.createCDPSession();
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
if (CDN) { await page.setRequestInterception(true); page.on('request', r => { const m = r.url().match(/^https:\/\/cdn\.jsdelivr\.net(\/npm\/.*)$/); m ? r.continue({ url: `http://127.0.0.1:${port}/__cdn${m[1]}` }) : r.continue(); }); }
await page.evaluateOnNewDocument(() => { new MutationObserver((_, ob) => { if (window.__sawL && !document.getElementById('loading')) { window.__ready = performance.now(); ob.disconnect(); } if (document.getElementById('loading')) window.__sawL = true; }).observe(document, { childList: true, subtree: true }); });
await cdp.send('Profiler.start');
await page.goto(`http://127.0.0.1:${port}/?debug&fixres${PROFILE === 'phone' ? '&touch' : ''}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready, { timeout: 300000, polling: 200 });
const ready = await page.evaluate(() => window.__ready);
const startup = (await cdp.send('Profiler.stop')).profile;
function summarize(profile, label) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])); const self = new Map();
  const dts = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const d = (dts[i] || 0) / 1000; total += d; self.set(id, (self.get(id) || 0) + d); });
  const byFn = new Map(), byFile = new Map();
  for (const [id, t] of self) {
    const n = nodes.get(id), cf = n.callFrame, file = (cf.url || '(native)').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*/, '');
    const k = `${cf.functionName || '(anon)'} ${file}:${cf.lineNumber + 1}`; byFn.set(k, (byFn.get(k) || 0) + t); byFile.set(file, (byFile.get(file) || 0) + t);
  }
  // inclusive time of the module entry points (needs --minify=false to have readable names)
  const incl = new Map(); const sub = id => { const n = nodes.get(id); let t = self.get(id) || 0; for (const c of n.children || []) t += sub(c); return t; };
  for (const n of profile.nodes) { const fn = n.callFrame.functionName; if (/^(build|create|setup|prepare|canvasTex|streetsIter|buildStreets|decode|loadBlobs|triangulateShape|computeVertexNormals|mergeGeometries|compile|init|run)\w*$/i.test(fn)) incl.set(fn, (incl.get(fn) || 0) + sub(n.id)); }
  console.log(`\n== ${label}: ${total.toFixed(0)} ms sampled`);
  console.log('inclusive:', [...incl].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([f, t]) => `${f} ${t.toFixed(0)}`).join(' | '));
  console.log('by file:', [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, t]) => `${f} ${t.toFixed(0)}`).join(' | '));
  for (const [k, t] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, TOP)) console.log(String(t.toFixed(0)).padStart(6), 'ms', k);
}
console.log('ready (loading element gone) at', ready.toFixed(0), 'ms, cpu throttle', CPU);
summarize(startup, 'startup');
// steady state: 6 s of driving at a spot
await page.evaluate(() => { const g = window.game; g.placeAt(...g.proj(38.115684, 13.361460)); });
await new Promise(r => setTimeout(r, 1500));
await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await cdp.send('Profiler.start');
await page.evaluate(() => { window.game.keys.KeyW = true; });
await new Promise(r => setTimeout(r, 6000));
const steady = (await cdp.send('Profiler.stop')).profile;
const heap = (await cdp.send('HeapProfiler.stopSampling')).profile;
summarize(steady, 'driving 6 s');
const chains = new Map(); (function walk2(n, stack) { const cf = n.callFrame, k = `${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`; const st = [...stack, k]; chains.set(st.join(' < ').split(' < ').reverse().slice(0, 5).join(' < '), (chains.get(st.join(' < ').split(' < ').reverse().slice(0, 5).join(' < ')) || 0) + n.selfSize); n.children.forEach(c => walk2(c, st)); })(heap.head, []);
console.log('\n== allocation call chains (top 8, innermost first)'); for (const [k, v] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(String((v / 1024).toFixed(0)).padStart(8), 'KB', k);
const allocs = new Map(); (function walk(n) { const cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${(cf.url || '').replace(/^https?:\/\/[^/]+\//, '')}:${cf.lineNumber + 1}`; allocs.set(k, (allocs.get(k) || 0) + n.selfSize); n.children.forEach(walk); })(heap.head);
let sum = 0; for (const v of allocs.values()) sum += v;
console.log(`\n== allocations while driving 6 s (includes garbage collected objects): ${(sum / 1024).toFixed(0)} KB sampled`);
for (const [k, v] of [...allocs].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(String((v / 1024).toFixed(0)).padStart(8), 'KB', k);
await browser.close(); server.close();
