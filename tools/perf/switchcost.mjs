// What a switch costs on the main thread, measured inside one page: the game runs with it on and off in short alternating stretches, so the load of the machine falls on both alike.
//   tools/release/withbrowser.sh node tools/perf/switchcost.mjs --root <dist> [--at 17.5,0,0] [--time 12] [--cpu 4] [--rounds 30] [--ms 1200] [--query weather=cumulus] [--only hold,cull] [--bench 40]
// Two builds side by side (cpuprofile.mjs in pairs) stop telling 0.3 ms apart once the machine is busy; this does, for anything that has a switch in the page (?debug).
// Per switch: renderer.render and clouds.update timed around their calls (ms per frame), the whole animation callback, and GL uniform calls per frame; mean of the rounds with the
// switch off (the old way) minus on, and in how many rounds off was the dearer. Phone profile (844x390 at DPR 3, touch), CDP CPU throttling: a stand-in for a phone's JS, not its GPU.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), AT = arg('at', '17.5,0,0'), CPU = +arg('cpu', 4), ROUNDS = +arg('rounds', 30), MS = +arg('ms', 1200), ONLY = arg('only') ? arg('only').split(',') : null;
// name: [what it is, how to switch it (on = as shipped)]
const SWITCHES = {
  hold: ['the dark lights\' uniforms held still (src/daynight.js)', 'v => window.game.dayNight.setLightHold(v)'],
  cull: ['only the clouds in view written (src/clouds.js)', 'v => window.game.clouds.setCull(v)'],
  tight: ['cloud puffs as fitted octagons (src/clouds.js; a GPU cut, here for its CPU side)', 'v => window.game.clouds.setTight(v)'],
};
const { server, port } = await startServer(ROOT, '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(), errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await page.evaluateOnNewDocument(() => {   // frame callbacks timed whole, GL uniform calls counted
  const raf = window.requestAnimationFrame.bind(window), F = window.__sc = { frame: 0, frames: 0, render: 0, clouds: 0, uniforms: 0 };
  window.requestAnimationFrame = cb => raf(t => { const a = performance.now(); cb(t); F.frame += performance.now() - a; F.frames++; });
  const P = WebGL2RenderingContext.prototype;
  for (const k of Object.getOwnPropertyNames(P)) if (/^uniform[1-4Mm]/.test(k)) { const f = P[k]; P[k] = function (...a) { F.uniforms++; return f.apply(this, a); }; }
});
const cdp = await page.createCDPSession();
await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&p2p=off&time=${arg('time', '12')}&at=${AT}${arg('query', '') ? '&' + arg('query') : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.game && window.game.clouds && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await new Promise(r => setTimeout(r, 9000));
await page.evaluate(() => {
  const F = window.__sc, G = window.game, r = G.renderer, o = r.render.bind(r);
  r.render = (a, c) => { const t = performance.now(); o(a, c); F.render += performance.now() - t; };
  const cu = G.clouds.update; G.clouds.update = dt => { const t = performance.now(); cu(dt); F.clouds += performance.now() - t; };
  F.cloudsUpdate = cu; F.renderNow = o;
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await new Promise(r => setTimeout(r, 3000));
console.log(`root ${ROOT}, at ${AT}, ${arg('time', '12')} h, ${CPU}x CPU, ${ROUNDS} rounds of ${MS} ms each way`);
for (const [name, [what, set]] of Object.entries(SWITCHES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const has = await page.evaluate(`(() => { try { (${set})(true); return true; } catch (e) { return false; } })()`);
  if (!has) { console.log(`${name}: no such switch in this build`); continue; }
  const R = await page.evaluate(async (setSrc, rounds, ms) => {
    const set = (0, eval)(setSrc), F = window.__sc, out = [];
    const run = async v => {
      set(v); await new Promise(r => setTimeout(r, 250));
      for (const k in F) F[k] = 0;
      await new Promise(r => setTimeout(r, ms));
      const n = Math.max(1, F.frames); return { frame: F.frame / n, render: F.render / n, clouds: F.clouds / n, uniforms: F.uniforms / n, n };
    };
    for (let i = 0; i < rounds; i++) { const a = i & 1 ? await run(true) : await run(false), b = i & 1 ? await run(false) : await run(true); out.push(i & 1 ? [b, a] : [a, b]); }   // [off, on], the order swapped every round
    set(true);
    return out;
  }, set, ROUNDS, MS);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, f = v => v.toFixed(3);
  const line = k => { const off = R.map(r => r[0][k]), on = R.map(r => r[1][k]), d = R.map(r => r[0][k] - r[1][k]), sd = Math.sqrt(mean(d.map(x => (x - mean(d)) ** 2)) / Math.max(1, d.length - 1)); return `${k} off ${f(mean(off))} on ${f(mean(on))}: saves ${f(mean(d))} +- ${f(1.96 * sd)} (off dearer in ${d.filter(x => x > 0).length} of ${d.length})`; };
  console.log(`${name}: ${what}\n  ms per frame: ${line('frame')}\n               ${line('render')}\n               ${line('clouds')}\n  per frame:    ${line('uniforms')}`);
}
// Tight loops: one function called over and over inside a task, the two ways in turn (--bench 40: that many pairs of blocks). Less exposed to a busy machine than whole frames.
//   clouds   clouds.update(0): the per-frame work of the sky standing still, with the cull off and on (a build without the switch: one number)
//   render   renderer.render with the camera turned a hair each time, so every light's place in view space changes as it does while driving: the dark lights' uniforms let go and held
const BENCH = +arg('bench', 0);
if (BENCH) {
  const B = await page.evaluate(async pairs => {
    const G = window.game, F = window.__sc, c = G.clouds, d = G.dayNight, out = {};
    const time = (fn, n) => { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };
    const ab = async (set, fn, n) => { const off = [], on = []; for (let i = 0; i < pairs; i++) { for (const v of i & 1 ? [true, false] : [false, true]) { set(v); fn(); (v ? on : off).push(time(fn, n)); } await new Promise(r => setTimeout(r, 0)); } set(true); return { off, on }; };
    const upd = () => F.cloudsUpdate(0);
    out.clouds = c.setCull ? await ab(v => c.setCull(v), upd, 200) : { on: Array.from({ length: pairs * 2 }, () => time(upd, 200)), off: [] };
    const cam = G.camera, q0 = cam.quaternion.clone(), turn = () => { cam.rotateY(2e-5); F.renderNow(G.scene, cam); };
    if (d && d.setLightHold) out.render = await ab(v => { d.setLightHold(v); G.dayNight.update(0); }, turn, 30);
    cam.quaternion.copy(q0);
    return out;
  }, BENCH);
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), med = a => [...a].sort((x, y) => x - y)[a.length >> 1] || 0;
  for (const [k, r] of Object.entries(B)) {
    if (!r.off.length) { console.log(`bench ${k}: ${med(r.on).toFixed(4)} ms a call (median of ${r.on.length} blocks, mean ${mean(r.on).toFixed(4)})`); continue; }
    const d = r.off.map((x, i) => x - r.on[i]), sd = Math.sqrt(mean(d.map(x => (x - mean(d)) ** 2)) / Math.max(1, d.length - 1));
    console.log(`bench ${k}: off ${med(r.off).toFixed(4)} on ${med(r.on).toFixed(4)} ms a call (medians of ${d.length} blocks); saves ${mean(d).toFixed(4)} +- ${(1.96 * sd).toFixed(4)} (mean of the pairs), off dearer in ${d.filter(x => x > 0).length} of ${d.length}`);
  }
}
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
