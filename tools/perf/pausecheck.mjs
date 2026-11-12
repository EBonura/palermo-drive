// Does the picture hold still in the pause menu? Drive at speed, pause, and compare the camera and whole frames while nothing is meant to move.
//   tools/release/withbrowser.sh node tools/perf/pausecheck.mjs --root <dist>
// Prints the largest camera position change between consecutive paused frames (metres) and how many of 30 consecutive paused canvases differ from the first (readPixels, tolerance 2 levels).
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/?help=0&play&fixres&debug&time=13&at=-2826,-627,3.05`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.game && window.game.renderer && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
await new Promise(r => setTimeout(r, 3000));
await page.keyboard.down('ArrowUp'); await new Promise(r => setTimeout(r, 5000));
await page.keyboard.up('ArrowUp'); await page.keyboard.press('KeyP');   // pause at speed, the way a player does
await new Promise(r => setTimeout(r, 1500));
const r = await page.evaluate(() => new Promise(done => {
  const G = window.game, gl = G.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, shots = [], pos = [], raf = window.requestAnimationFrame.bind(window);
  const grab = () => {
    pos.push(G.camera.position.toArray()); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); shots.push(a);
    if (shots.length < 30) return raf(() => raf(grab));
    let mv = 0; for (let i = 1; i < pos.length; i++) mv = Math.max(mv, Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1], pos[i][2] - pos[i - 1][2]));
    let diff = 0, px = 0; for (let s = 1; s < shots.length; s++) { let n = 0; for (let i = 0; i < shots[0].length; i++) if (Math.abs(shots[s][i] - shots[0][i]) > 2) n++; if (n) { diff++; px = Math.max(px, n); } }
    done({ state: G.state, maxCameraStep: mv, framesDiffering: diff, worstPixels: px });
  };
  window.__keep = grab; raf(grab);
}));
console.log(JSON.stringify(r));
await browser.close(); server.close();
