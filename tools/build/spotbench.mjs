// Spot bench: main-thread cost per frame at fixed places, on the phone profile (844x390 at DPR 3, touch UI, 4x CPU slowdown) or the desktop one.
//   node tools/build/spotbench.mjs --url http://localhost:8792/                  # source tree served by the dev server
//   node tools/build/spotbench.mjs --url http://127.0.0.1:PORT/ --runs 3         # a dist served by tools/build/serve.mjs (startServer(dir, ''))
//   node tools/build/spotbench.mjs --url ... --spots qc,ballaro --desktop        # desktop 1280x720, no CPU slowdown
// Per spot and run: the page loads with ?fixres&debug&at=x,z,th (no dynamic resolution), settles 7 s, the CPU slowdown goes on, 4 s more, then 6 s are
// measured: main ms per frame = CDP TaskDuration / frames, plus ScriptDuration and layout + style, time spent inside renderer.render, draw calls and
// triangles of the last frame (shadow pass included). The median of --runs is printed. The first seconds after a load are slower than the rest, and
// the machine is shared: compare two builds by alternating them (before, after, before, after ...) and read differences under about 0.5 ms as noise.
// Chrome: CHROME=/path/to/chrome, else the macOS default. puppeteer-core comes from tools/build/node_modules.
import puppeteer from 'puppeteer-core';

const arg = (k, d) => { const A = process.argv, i = A.findIndex(x => x === '--' + k || x.startsWith('--' + k + '=')); if (i < 0) return d; if (A[i].includes('=')) return A[i].split('=').slice(1).join('='); return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };   // --k=v, --k v or --k
const URL_ = arg('url', 'http://localhost:8792/'), RUNS = +arg('runs', 1), DESKTOP = !!arg('desktop', false), CPU = DESKTOP ? 1 : +arg('cpu', 4);
// x, z, heading (th: the camera looks along (sin th, cos th)); the same places as the stage 1 to 3 notes in docs/PERF.md
const SPOTS = {
  qc: ['Quattro Canti', 17.5, 0, 0],
  ballaro: ['Ballaro market', 24.9, 488.6, -2.01],
  zisa: ['Piazza Zisa', -1758.8, -43.6, -0.14],
  porto: ['the port (Via Crispi)', 91.6, -1300.1, -2.71],
  mondello: ['Mondello piazza', -3033.1, -10177.4, -1.07],
};
const names = String(arg('spots', Object.keys(SPOTS).join(','))).split(',');
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
async function once(name) {
  const [, x, z, th] = SPOTS[name];
  const page = await browser.newPage();
  await page.setViewport(DESKTOP ? { width: 1280, height: 720, deviceScaleFactor: 1 } : { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const cdp = await page.createCDPSession(); await cdp.send('Performance.enable');
  await page.goto(URL_ + `?help=0&play&fixres&debug&at=${x},${z},${th}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await new Promise(r => setTimeout(r, 7000));
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => {
    const r = window.game.renderer, orig = r.render.bind(r); window.__rt = { t: 0, n: 0 };
    r.render = (a, c) => { const t0 = performance.now(); orig(a, c); window.__rt.t += performance.now() - t0; window.__rt.n++; };
    window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  const metric = async n => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === n).value;
  const t0 = await metric('TaskDuration'), s0 = await metric('ScriptDuration'), l0 = (await metric('LayoutDuration')) + (await metric('RecalcStyleDuration'));
  await page.evaluate(() => { window.__rt.t = 0; window.__rt.n = 0; window.__fr = 0; });
  await new Promise(r => setTimeout(r, 6000));
  const t1 = await metric('TaskDuration'), s1 = await metric('ScriptDuration'), l1 = (await metric('LayoutDuration')) + (await metric('RecalcStyleDuration'));
  const i = await page.evaluate(() => { const r = window.game.renderer.info.render; return { fr: window.__fr, rms: window.__rt.t / Math.max(1, window.__rt.n), calls: r.calls, tris: r.triangles }; });
  await page.close();
  return { main: (t1 - t0) * 1000 / i.fr, script: (s1 - s0) * 1000 / i.fr, layout: (l1 - l0) * 1000 / i.fr, render: i.rms, calls: i.calls, tris: i.tris };
}
console.log(`${URL_}  ${DESKTOP ? 'desktop 1280x720' : `phone 844x390 DPR3, ${CPU}x CPU`}  runs=${RUNS}  (median; ms per frame on the main thread)`);
console.log('spot'.padEnd(24), 'main'.padStart(6), 'script'.padStart(7), 'layout'.padStart(7), 'render'.padStart(7), 'calls'.padStart(6), 'triangles'.padStart(10));
for (const n of names) {
  const rs = []; for (let k = 0; k < RUNS; k++) rs.push(await once(n));
  const m = key => median(rs.map(r => r[key]));
  console.log(SPOTS[n][0].padEnd(24), m('main').toFixed(2).padStart(6), m('script').toFixed(2).padStart(7), m('layout').toFixed(2).padStart(7), m('render').toFixed(2).padStart(7), String(Math.round(m('calls'))).padStart(6), String(Math.round(m('tris'))).padStart(10), RUNS > 1 ? '  runs: ' + rs.map(r => r.main.toFixed(1)).join(' ') : '');
}
await browser.close();
