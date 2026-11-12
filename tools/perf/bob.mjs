// Camera bob: does the chase camera's height or pitch shake at a steady speed on a straight road?
//   tools/release/withbrowser.sh node tools/perf/bob.mjs --root <dist> [--q rec] [--secs 8] [--speed 20] [--scene maqueda --points 40] [--jit 0.4] [--phase 0.5 (of a refresh, 0..1: where the display's clock falls against the game's 1/120 s step)] [--cpu 4] [--pix] [--fast] [--auto] [--hz 120] [--json out.json]
// Drives Viale Regione (straight, flat) at a steady speed with the real keys and physics, and logs for every frame the game drew: camera y, camera pitch,
// the lapa's visual y (ground + lift + hop, what vehicle.updateVisual sets on the mesh), its physics-side numbers (hop, pitch, ground height) and the frame gap.
// Jitter score of a series: the mean absolute second difference per frame (mm, or mrad for pitch); a smooth path scores near 0, a bob scores high.
// --fast: --disable-frame-rate-limit, so frames come as fast as the GPU lets them (a stand-in for a 120 Hz display); otherwise Chrome's own 60 Hz.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const A = process.argv, i = A.indexOf('--' + k); if (i < 0) return d; return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const ROOT = path.resolve(arg('root', path.join(REPO, 'dist'))), SECS = +arg('secs', 8), SPEED = +arg('speed', 20), Q = arg('q', ''), FAST = !!arg('fast', false), HZ = +arg('hz', 0);
const wait = ms => new Promise(r => setTimeout(r, ms));
const SCENE = arg('scene', 'viale'), src = fs.readFileSync(path.join(HERE, 'cpuprofile.mjs'), 'utf8');
const line = JSON.parse('[' + src.match(new RegExp(SCENE + ': \\{[^\\n]*?line: \\[([^\\]]*)\\]'))[1] + ']').slice(0, +arg('points', 24));
const at = [line[0], line[1], Math.atan2(line[2] - line[0], line[3] - line[1])];
const { server, port } = await startServer(ROOT, '');
const args = ['--mute-audio', '--use-angle=metal', '--enable-gpu']; if (FAST) args.push('--disable-frame-rate-limit', '--disable-gpu-vsync');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
if (+arg('cpu', 1) > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: +arg('cpu', 1) });
await page.evaluateOnNewDocument(() => {
  const raf0 = window.requestAnimationFrame.bind(window), R = window.__bob = { on: false, rows: [], t: -1 };
  // --hz N: frames on an exact N Hz clock (a display's vsync times), run from timers: the callback gets the ideal time of its refresh, as a display's compositor hands it
  const hz = +new URLSearchParams(location.search).get('bobhz') || 0, J = +new URLSearchParams(location.search).get('bobjit') || 0, PH = +new URLSearchParams(location.search).get('bobphase') || 0, P = hz ? 1000 / hz : 0, T0 = performance.now(); let k = 0;
  const raf = hz ? cb => { const slot = Math.max(Math.floor((performance.now() - T0) / P) + 1, k + 1), due = T0 + (slot + PH) * P; setTimeout(() => { k = slot; cb(due + (Math.random() - 0.5) * J); }, Math.max(0, due - performance.now())); return slot; } : raf0;   // (k: the refresh being delivered; every chain asks for the next one)
  window.requestAnimationFrame = cb => raf(t => {
    const who = cb.name || String(cb).slice(0, 30);
    cb(t);
    const G = window.game;
    if (R.pix && G && G.lean && t !== R.t && (R.n = (R.n || 0) + 1) % 7 === 0) {   // --pix: the frame as drawn, against the same state drawn with the lean draw paths off
      const gl = G.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4), D = G.lean.draw;
      G.renderer.render(G.scene, G.camera); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      const keep = { ...D }; if (R.pix !== 'control') D.quick = D.uni = D.tree = false; G.renderer.render(G.scene, G.camera); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); Object.assign(D, keep);
      let n = 0, mx = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 0) { n++; if (d > mx) mx = d; } }
      (R.pixRes = R.pixRes || []).push([n, mx]);
    }
    if (!R.on || !G || G.renderer.info.render.frame === R.f) return; R.f = G.renderer.info.render.frame; R.t = t;   // one row per frame the game drew
    const c = G.car, cam = G.camera, d = cam.getWorldDirection(new cam.position.constructor());
    R.rows.push([t, cam.position.y, Math.asin(d.y), G.groundY(c.x, c.z) + c.lift + c.hop, c.hop, c.pitch, G.groundY(c.x, c.z), c.y ?? 0, Math.hypot(c.vx, c.vz), c.x, c.z, G.renderer.info.render.frame, who]);
  });
});
await page.goto(`http://127.0.0.1:${port}/?help=0&play${arg('auto', false) ? '' : '&fixres'}&debug&time=13&at=${at.join(',')}${Q ? '&' + Q : ''}${HZ ? '&bobhz=' + HZ + '&bobjit=' + arg('jit', 0) + '&bobphase=' + arg('phase', 0) : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.game && window.game.renderer && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await wait(3000);
await page.evaluate((P, v) => {
  const G = window.game, keys = G.keys, car = G.car; let fr = 0, i = 2;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  setInterval(() => {
    fr++;
    while (i < P.length - 2 && Math.hypot(P[i] - car.x, P[i + 1] - car.z) < 30) i += 2;
    const e = wrap(Math.atan2(P[i] - car.x, P[i + 1] - car.z) - car.th), fwd = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    const duty = Math.min(1, Math.abs(e) / 0.25), pulse = (fr % 4) < duty * 4 + 0.001 && duty > 0.05;
    keys.ArrowLeft = pulse && e > 0; keys.ArrowRight = pulse && e < 0; keys.ArrowUp = fwd < v * 0.98; keys.ArrowDown = fwd > v * 1.25;
  }, 33);
}, line, SPEED);
await wait(5000);   // up to speed
await page.evaluate(q => { window.__bob.rows.length = 0; window.__bob.on = true; window.__bob.pix = q; }, arg('pix', false));
await wait(SECS * 1000);
const rows = await page.evaluate(() => { window.__bob.on = false; return window.__bob.rows; });
const pixRes = await page.evaluate(() => window.__bob.pixRes || []);
if (pixRes.length) console.log(`pixels: ${pixRes.length} frames compared, differing pixels per frame: ` + pixRes.map(x => x[0] + '/' + x[1]).join(' '));
await browser.close(); server.close();
// score: mean |second difference| of a series
const sd = a => { let s = 0; for (let i = 1; i < a.length - 1; i++) s += Math.abs(a[i + 1] - 2 * a[i] + a[i - 1]); return s / Math.max(1, a.length - 2); };
const col = k => rows.map(r => r[k]);
const gaps = rows.slice(1).map((r, i) => r[0] - rows[i][0]);
const names = ['cam y', 'cam pitch', 'lapa visual y', 'car.hop', 'car.pitch', 'groundY', 'car.y'];
console.log(`${ROOT.split('/').slice(-1)[0]} ${HZ ? 'emul ' + HZ + 'Hz' : FAST ? 'fast' : '60Hz'} ${Q}: ${rows.length} frames, ${(1000 / (gaps.reduce((s, x) => s + x, 0) / gaps.length)).toFixed(0)} fps, speed ${(col(8).reduce((s, x) => s + x, 0) / rows.length).toFixed(1)} m/s`);
const p99 = a => { const d = []; for (let i = 1; i < a.length - 1; i++) d.push(Math.abs(a[i + 1] - 2 * a[i] + a[i - 1])); d.sort((x, y) => x - y); return d[Math.floor(d.length * 0.99)] || 0; };
console.log(`  frame gaps: median ${[...gaps].sort((a, b) => a - b)[gaps.length >> 1].toFixed(1)} ms, over 12 ms ${gaps.filter(g => g > 12).length}, cam y p99 |d2| ${(p99(col(1)) * 1000).toFixed(1)} mm, lapa y p99 ${(p99(col(3)) * 1000).toFixed(1)} mm`);
names.forEach((n, i) => console.log('  ' + n.padEnd(14) + (sd(col(i + 1)) * 1000).toFixed(3) + (n.includes('pitch') ? ' mrad' : ' mm') + ' mean |d2|'));
{ const fr = rows.map(r => r[11]), drawn = fr.filter((v, i) => i && v !== fr[i - 1]).length; console.log(`  callbacks ${rows.length}, of which rendered ${drawn}; by caller: ` + JSON.stringify(rows.reduce((o, r) => (o[r[12]] = (o[r[12]] || 0) + 1, o), {}))); const st = []; for (let i = 1; i < rows.length; i++) st.push(Math.round(Math.hypot(rows[i][9] - rows[i - 1][9], rows[i][10] - rows[i - 1][10]) / (SPEED / 120)));
  const h = {}; st.forEach(n => { h[n] = (h[n] || 0) + 1; }); console.log('  physics steps per drawn frame (distance / one step): ' + Object.entries(h).map(([k, v]) => k + ':' + v).join(' ')); }
if (arg('json', false)) fs.writeFileSync(arg('json'), JSON.stringify(rows));
