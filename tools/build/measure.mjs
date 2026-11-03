// Perf harness for Palermo Drive. Serves a folder (source tree or dist/) over a local gzip server
// (like GitHub Pages: gzip for text types, nothing for wav/woff2/png), drives headless Chrome through
// puppeteer-core with optional network/CPU throttling and prints one JSON report.
//
//   node tools/build/measure.mjs --root . --profile desktop --net none --label baseline
//   node tools/build/measure.mjs --root dist --profile phone --net slow4g --cpu 4
//   --cdn <dir>   serve cdn.jsdelivr.net/npm/three@X/... from <dir>/ (baseline uses the real r160 files)
//   --query "debug&spot=2"   extra query string (default "debug", which exposes window.game)
//   --out file.json          also write the report there
//
// Sizes are wire bytes as sent by the local server with gzip level 6 (what Pages does within ~1%).
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', '.'));
const PROFILE = arg('profile', 'desktop');
const NET = arg('net', 'none');
const CPU = +arg('cpu', PROFILE === 'phone' ? 4 : 1);
const LABEL = arg('label', '');
const CDN = arg('cdn', '');
const QUERY = arg('query', 'debug&fixres');   // fixres: perf.js keeps the pixel ratio fixed, so runs are comparable
const OUT = arg('out', '');
const SETTLE = +arg('settle', 6000);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const NETS = { // Lighthouse-style presets, bytes/s
  none: null,
  '4g': { latency: 60, down: 9e6 / 8, up: 9e6 / 8 },
  slow4g: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 },
  '3g': { latency: 300, down: 0.4e6 / 8, up: 0.4e6 / 8 },
};
const URL_ARG = arg('url', '');   // --url https://host/path/ measures a live site instead of a local folder (wire bytes from CDP)
const { server, stats, port: PORT } = URL_ARG ? { server: { close() {} }, stats: { requests: 0, bytes: 0, rawBytes: 0, files: [] }, port: 0 } : await startServer(ROOT, CDN);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
    '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  defaultViewport: null,
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
if (PROFILE === 'phone') {
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36');
} else await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
if (NETS[NET]) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: NETS[NET].latency, downloadThroughput: NETS[NET].down, uploadThroughput: NETS[NET].up });

if (CDN) { // redirect the CDN host to the local server so the same bytes flow through the throttle
  await page.setRequestInterception(true);
  page.on('request', r => {
    const m = r.url().match(/^https:\/\/cdn\.jsdelivr\.net(\/npm\/.*)$/);
    if (m) r.continue({ url: `http://127.0.0.1:${PORT}/__cdn${m[1]}` }); else r.continue();
  });
}
const logs = [], errors = [];
page.on('console', m => { const t = m.text(); logs.push([Math.round(performance.now()), t.slice(0, 200)]); if (m.type() === 'error') errors.push(t.slice(0, 300)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 300)));

await page.evaluateOnNewDocument(() => {
  window.__m = { t0: performance.now() };
  new MutationObserver((_, ob) => {
    if (!document.getElementById('loading') && document.getElementById('view') && window.__m.loadingGone == null && window.__m.sawLoading) { window.__m.loadingGone = performance.now(); ob.disconnect(); }
    if (document.getElementById('loading')) window.__m.sawLoading = true;
  }).observe(document, { childList: true, subtree: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  // first WebGL draw call = first frame on screen
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    const orig = C.prototype.drawElements;
    C.prototype.drawElements = function (...a) { if (window.__m.firstDraw == null && window.__m.loadingGone != null) window.__m.firstDraw = performance.now(); return orig.apply(this, a); };
  }
});

const t0 = Date.now();
if (URL_ARG) { // account bytes from the network layer
  const reqs = new Map();
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFinished', e => { const u = reqs.get(e.requestId) || '?'; stats.requests++; stats.bytes += e.encodedDataLength; stats.rawBytes += e.encodedDataLength; stats.files.push([new URL(u).pathname.replace(/^\/palermo-drive/, ''), e.encodedDataLength, e.encodedDataLength]); });
}
await page.goto(`${URL_ARG ? URL_ARG.replace(/\/?$/, '/') : `http://127.0.0.1:${PORT}/`}?${QUERY}${PROFILE === 'phone' ? '&touch' : ''}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction(() => window.__m && window.__m.loadingGone != null, { timeout: 600000, polling: 200 });
const tReadyWall = Date.now() - t0;
await new Promise(r => setTimeout(r, SETTLE)); // let async work (photo facades, audio) finish

const loadTiming = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0];
  const m = window.__m;
  return { dcl: Math.round(n.domContentLoadedEventEnd), loaded: Math.round(n.loadEventEnd), fcp: Math.round(m.fcp || 0), loadingGone: Math.round(m.loadingGone), firstDraw: Math.round(m.firstDraw || 0) };
});
const netAtLoad = { requests: stats.requests, bytes: stats.bytes, rawBytes: stats.rawBytes };

// ---- rendering samples at a few places (needs ?debug => window.game) ----
const SPOTS = [['Quattro Canti', 38.115684, 13.361460], ['Teatro Massimo', 38.1199, 13.3573], ['La Cala', 38.1203, 13.3676], ['Stazione', 38.1092, 13.3655]];
const samples = [];
if (QUERY.includes('debug')) {
  for (const [name, lat, lon] of SPOTS) {
    await page.evaluate((lat, lon) => { const g = window.game; g.placeAt(...g.proj(lat, lon)); }, lat, lon);
    await new Promise(r => setTimeout(r, 2500));
    const s = await page.evaluate(() => new Promise(resolve => {
      const g = window.game, r = g.renderer, info = r.info, rt = [], dts = [];
      const orig = r.render.bind(r);
      // ground truth across three.js versions: count the GL draw calls / triangles of every pass (shadow pass included).
      // (renderer.info.render left the shadow pass out in r160 and counts it from r18x on.)
      const gl = r.getContext(); let glCalls = 0, glTris = 0; const glOrig = {};
      const tri = (mode, n) => mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0;
      for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        glOrig[n] = gl[n]; const f = gl[n].bind(gl);
        gl[n] = n.endsWith('Instanced') ? (mode, a, b, c, inst) => { glCalls++; glTris += tri(mode, n === 'drawElementsInstanced' ? a : b) * (n === 'drawElementsInstanced' ? inst : c); return f(mode, a, b, c, inst); }
          : (mode, a, b, c) => { glCalls++; glTris += tri(mode, n === 'drawElements' ? a : b); return f(mode, a, b, c); };
      }
      let calls = 0, tris = 0, lines = 0, points = 0, frames = 0;
      r.render = (s, c) => { const a = performance.now(); orig(s, c); rt.push(performance.now() - a); };
      let last = performance.now(); const end = last + 3000;
      (function tick(now) {
        dts.push(now - last); last = now;
        if (info.render.calls) { calls += info.render.calls; tris += info.render.triangles; lines += info.render.lines; points += info.render.points; frames++; }
        if (now < end) requestAnimationFrame(tick); else {
          r.render = orig; for (const n in glOrig) gl[n] = glOrig[n];
          const med = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] || 0; };
          const p95 = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.95)] || 0; };
          resolve({ glCalls: Math.round(glCalls / frames), glTriangles: Math.round(glTris / frames), calls: Math.round(calls / frames), triangles: Math.round(tris / frames), lines: Math.round(lines / frames), points: Math.round(points / frames),
            geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : 0,
            cpuRenderMsMedian: +med(rt).toFixed(2), cpuRenderMsP95: +p95(rt).toFixed(2), frameMsMedian: +med(dts.slice(5)).toFixed(2), frameMsP95: +p95(dts.slice(5)).toFixed(2), fps: +(1000 / med(dts.slice(5))).toFixed(1),
            pixelRatio: r.getPixelRatio(), drawBuf: [r.domElement.width, r.domElement.height] });
        }
      })(last);
    }));
    samples.push({ spot: name, ...s });
  }
}
const metrics = await page.metrics();
const bld = await page.evaluate(() => window.__bld || null);

const jsHeapMB = +(metrics.JSHeapUsedSize / 1048576).toFixed(1);
const byKind = {};
for (const [u, wire, raw] of stats.files) { const k = u.endsWith('.js') || u.endsWith('.mjs') ? 'js' : /\.(png|jpg|svg)$/.test(u) ? 'img' : /\.(woff2)$/.test(u) ? 'font' : /\.(wav|ogg|mp3)$/.test(u) ? 'audio' : u.endsWith('.html') ? 'html' : 'other'; (byKind[k] ||= { wire: 0, raw: 0, n: 0 }); byKind[k].wire += wire; byKind[k].raw += raw; byKind[k].n++; }
const report = {
  label: LABEL, root: path.relative(process.cwd(), ROOT) || '.', profile: PROFILE, net: NET, cpuThrottle: CPU, query: QUERY,
  wire: { requests: stats.requests, bytes: stats.bytes, rawBytes: stats.rawBytes, atReady: netAtLoad, byKind },
  timing: { ...loadTiming, readyWallMs: tReadyWall }, jsHeapMB, buildings: bld, samples, errors: errors.slice(0, 10),
  notFound: stats.files.filter(f => f[2] === 404).map(f => f[0]),
  topFiles: stats.files.sort((a, b) => b[1] - a[1]).slice(0, 12),
  consoleTimeline: logs.filter(l => /\[/.test(l[1])).slice(0, 12),
};
const text = JSON.stringify(report, null, 1);
if (OUT) fs.writeFileSync(OUT, text);
console.log(text);
await browser.close(); server.close();
