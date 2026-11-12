// Runs ?rec (src/rec.js, the stutter recorder) on a built dist and checks what it hands back.
//   tools/release/withbrowser.sh node tools/perf/recrun.mjs --root <dist> [--out ~/.cache/palermo-drive/rec] [--secs 40] [--cpu 4] [--q 'at=...']
//     (--nofeat: without PerformanceObserver and fences, as Safari may be; --q 'at=15,5&gfx=auto': with the governor and its cap)
//     the phone window (747x360, touch) then the desktop one: drive with the accelerator held, make three stalls on purpose (a 120 ms busy loop in a frame, a new shader program, a 150 ms task outside the frames),
//     take pictures of the pill and of the open panel, Stop, Copy JSON, and check the JSON parses, has stutters and a timeline, and fits the size aim (100 KB for 10 minutes).
//   tools/release/withbrowser.sh node tools/perf/recrun.mjs --root <dist> --overhead [--runs 3] [--secs 20] [--cpu 4]
//     what the recorder costs: the main thread's script and task time per frame (CDP Performance metrics, not the recorder's own clock) with and without ?rec, alternating, parked at the same spot.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const A = process.argv, i = A.indexOf('--' + k); if (i < 0) return d; return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const OUT = path.resolve(arg('out', path.join(os.homedir(), '.cache/palermo-drive/rec'))), SECS = +arg('secs', 40), CPU = +arg('cpu', 1), wait = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const BASE = `http://127.0.0.1:${port}/?help=0&play&debug&p2p=off`;
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) bad++; };

async function open(vp, q) {
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.setViewport(vp);
  if (arg('nofeat', false)) await page.evaluateOnNewDocument(() => { delete window.PerformanceObserver; WebGL2RenderingContext.prototype.fenceSync = undefined; });   // Safari: no long-animation-frame, no fence, no heap
  if (CPU > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.goto(`${BASE}&${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.game && window.game.renderer && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  return { page, errs };
}

if (arg('overhead', false)) {
  // CDP metrics: seconds of script and of task time on the main thread per frame the renderer drew
  const vp = { width: 747, height: 360, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, RUNS = +arg('runs', 3), S = +arg('secs', 20), R = { plain: [], rec: [] };
  for (let r = 0; r < RUNS; r++) for (const [tag, q] of r % 2 ? [['rec', 'at=15,5&rec'], ['plain', 'at=15,5']] : [['plain', 'at=15,5'], ['rec', 'at=15,5&rec']]) {   // the order alternates: the machine drifts over a run
    const { page, errs } = await open(vp, q), cdp = await page.createCDPSession();
    await cdp.send('Performance.enable'); await wait(10000);   // the tiles and the crowd settle
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const f = () => page.evaluate(() => window.game.renderer.info.render.frame), a = await m(), f0 = await f(); await wait(S * 1000); const b = await m(), f1 = await f();
    const n = f1 - f0; R[tag].push({ script: (b.ScriptDuration - a.ScriptDuration) * 1000 / n, task: (b.TaskDuration - a.TaskDuration) * 1000 / n, fps: n / S });
    const x = R[tag][R[tag].length - 1]; console.log(`${tag.padEnd(5)} run ${r + 1}: script ${x.script.toFixed(2)} ms/frame, task ${x.task.toFixed(2)} ms/frame, ${x.fps.toFixed(1)} frames a second${errs.length ? '  ERRORS ' + errs.join(' | ') : ''}`);
    await page.close();
  }
  const mean = (t, k) => R[t].reduce((s, x) => s + x[k], 0) / R[t].length;
  for (const k of ['script', 'task']) console.log(`${k}: plain ${mean('plain', k).toFixed(2)} ms/frame, rec ${mean('rec', k).toFixed(2)} ms/frame, rec costs ${(mean('rec', k) - mean('plain', k)).toFixed(2)} ms/frame at CPU x${CPU}`);
} else {
  for (const [name, vp] of [['phone', { width: 747, height: 360, deviceScaleFactor: 2, hasTouch: true, isMobile: true }], ['desktop', { width: 1280, height: 720, deviceScaleFactor: 1 }]]) {
    console.log(`--- ${name} ${vp.width}x${vp.height}${CPU > 1 ? ' CPU x' + CPU : ''}`);
    const { page, errs } = await open(vp, `rec&${arg('q', 'at=15,5')}`);
    check(await page.evaluate(() => !!window.__pdRec), 'the recorder started');
    await page.keyboard.down('KeyW');
    const t0 = Date.now(); let shot = false;
    while (Date.now() - t0 < SECS * 1000) {
      await wait(1000);
      const s = (Date.now() - t0) / 1000;
      if (s > 10 && s < 11.5) await page.evaluate(() => requestAnimationFrame(() => { const t = performance.now(); while (performance.now() - t < 120); }));   // a frame that takes 120 ms of the page's own time
      if (s > 18 && s < 19.5) await page.evaluate(() => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 150); }, 0); });   // a task outside the frames
      if (s > 24 && s < 25.5) await page.evaluate(() => {   // a new shader program: a mesh in view gets a material with a define nothing else has, for a moment
        let m = null; window.game.scene.traverse(o => { if (!m && o.isMesh && o.visible && o.material && o.material.isMeshStandardMaterial && !Array.isArray(o.material)) m = o; });
        if (!m) return; const old = m.material, c = old.clone(); c.defines = { ...(c.defines || {}), RECTEST: 1 }; m.material = c; setTimeout(() => { m.material = old; }, 1500);
      });
      if (!shot && s > 5) { shot = true; await page.keyboard.up('KeyW'); await page.screenshot({ path: path.join(OUT, `${name}-pill.png`) }); await page.keyboard.down('KeyW'); }
    }
    await page.keyboard.up('KeyW');
    await page.click('button[style*="2147483000"]').catch(() => errs.push('could not tap the pill'));
    await wait(500); await page.screenshot({ path: path.join(OUT, `${name}-panel.png`) });
    const texts = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent));
    check(['Stop', 'Copy JSON', 'Save file', 'Continue'].every(t => texts.includes(t) || texts.includes({ Stop: 'Stop', 'Copy JSON': 'Copia JSON', 'Save file': 'Salva file', Continue: 'Continua' }[t])), 'the panel has Stop, Copy JSON, Save file, Continue');
    await page.evaluate(() => window.__pdRec.stop());
    const txt = await page.evaluate(() => window.__pdRec.json()), j = JSON.parse(txt);
    fs.writeFileSync(path.join(OUT, `${name}.json`), txt);
    const s = j.summary, sz = o => JSON.stringify(o).length, secs = j.tl.fps.length, perSt = j.stutters.length ? sz(j.stutters) / j.stutters.length : 500;
    const proj = (txt.length - sz(j.stutters) - sz(j.tl) + 150 * perSt + sz(j.tl) / secs * 600) / 1024;   // 10 minutes with the 150 stutters the file keeps at most
    console.log(`  ${j.dur} s, ${s.frames} frames, ${s.fps} fps, median ${s.med} p90 ${s.p90} p99 ${s.p99} max ${s.max}, game ${s.game} ms, ${s.stutters} stutters (${s.perMin}/min), why ${JSON.stringify(s.why)}, GPU late ${s.late} %, loaf ${s.loaf} heap ${s.heap} fence ${s.fence}`);
    console.log(`  ${(txt.length / 1024).toFixed(1)} KB for this run (${perSt.toFixed(0)} bytes a stutter, ${(sz(j.tl) / secs).toFixed(0)} a second of timeline), ${proj.toFixed(1)} KB for 10 minutes with 150 stutters`);
    check(j.v === 1 && Array.isArray(j.stutters) && j.tl && j.tl.fps.length > 5, 'the JSON parses, has stutters and a timeline');
    check(s.stutters >= 1, 'at least one stutter was found (three were made)');
    check(proj < 100, 'under 100 KB for 10 minutes');
    check(j.tl.fps.length === j.tl.worst.length && j.tl.fps.length === j.tl.st.length, 'the timeline arrays are as long as each other');
    const st = j.stutters.slice().sort((a, b) => b.iv - a.iv)[0];
    if (st) console.log('  worst:', JSON.stringify(st).slice(0, 900));
    check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await page.close();
  }
}
await browser.close(); server.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
