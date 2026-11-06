// Is everybody the camera can see drawn? The crowd only writes instances for who is in a wedge round the camera (src/pedestrians.js): this stands, drives in circles, changes the camera mode and opens the side menu (the game paused, the camera may go on moving), and every frame
// compares the people on the screen (projected with the real camera, up to the distance where the crowd has faded out) with the instance buffer.
//   tools/release/withbrowser.sh node tools/perf/crowdcheck.mjs --root <dist>       exit 1 when someone on the screen had no instance
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage(), errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&time=13&at=17.5,0,0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.game && window.__peds && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await new Promise(r => setTimeout(r, 8000));
const res = await page.evaluate(() => new Promise(done => {
  const G = window.game, P = window.__peds, cam = G.camera, sprites = P.dbg.sprites, v = new (cam.position.constructor)(), R = { frames: 0, checks: 0, onScreen: 0, drawn: 0, misses: [], maxSeen: 0 };
  const t0 = performance.now(); let phase = -1;
  const f = () => {
    const t = performance.now() - t0, ph = Math.floor(t / 4000);
    if (ph !== phase) {
      phase = ph;   // 0 standing, 1 and 2 circles at speed, 3 and 4 a camera mode change every 400 ms, 5 and 6 the side menu
      G.keys.ArrowUp = ph === 1 || ph === 2; G.keys.ArrowLeft = ph === 1; G.keys.ArrowRight = ph === 2;
    }
    if (ph >= 3 && ph < 5 && Math.floor(t / 400) !== Math.floor((t - 20) / 400)) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    if (ph === 5 && !R.menu) { R.menu = true; dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true })); R.px = P.X[0]; R.cx = cam.position.x; R.cz = cam.position.z; R.ry = cam.rotation.y; }
    if (ph === 6) { R.camMoved = Math.max(R.camMoved || 0, Math.hypot(cam.position.x - R.cx, cam.position.z - R.cz)); R.frozen = P.X[0] === R.px; }
    const n = sprites.geometry.instanceCount, pos = sprites.geometry.attributes.iPos.array, have = new Set();
    for (let i = 0; i < n; i++) have.add(pos[i * 3].toFixed(2) + ',' + pos[i * 3 + 2].toFixed(2));
    const R0 = P.quality().R + 12; let seen = 0;
    for (let i = 0; i < P.N.n; i++) {
      const dx = P.X[i] - cam.position.x, dz = P.Z[i] - cam.position.z; if (dx * dx + dz * dz > R0 * R0) continue;
      v.set(P.X[i], G.groundY(P.X[i], P.Z[i]) + 0.9, P.Z[i]).applyMatrix4(cam.matrixWorldInverse);
      if (v.z > -0.5) continue;
      v.applyMatrix4(cam.projectionMatrix);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      seen++; R.checks++;
      if (!have.has(P.X[i].toFixed(2) + ',' + P.Z[i].toFixed(2))) { if (R.misses.length < 12) R.misses.push({ ph, d: Math.round(Math.hypot(dx, dz)), x: +v.x.toFixed(2), st: P.ST[i] }); R.miss = (R.miss || 0) + 1; }
    }
    R.frames++; R.onScreen += seen; R.drawn += n; if (seen > R.maxSeen) R.maxSeen = seen;
    if (t < 28000) return requestAnimationFrame(f);
    for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowRight']) G.keys[k] = false;
    done({ frames: R.frames, checks: R.checks, miss: R.miss || 0, misses: R.misses, peopleOnScreen: Math.round(R.onScreen / R.frames), instances: Math.round(R.drawn / R.frames), total: P.N.n, maxSeen: R.maxSeen, inMenu: { peopleStopped: R.frozen, cameraMovedM: +(R.camMoved || 0).toFixed(1) } });
  };
  requestAnimationFrame(f);
}));
console.log(JSON.stringify(res), 'page errors:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close(); server.close(); process.exit(res.miss || errs.length ? 1 : 0);
