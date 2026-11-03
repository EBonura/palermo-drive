// Faithfulness rounds, step 2: shoot the game from the position and heading of each Mapillary reference photo.
//
//   node tools/faith_shoot.mjs [--base http://127.0.0.1:9655/] [--round /private/tmp/claude-501/round2] [--ids ce01,ce04 | --only ce,po] [--force]
//
// Needs the reference metadata from `python3 tools/mapillary_refs.py ROUND` (ROUND/meta/<id>.json) and the game served over HTTP at --base.
// One page is loaded once and teleported between viewpoints (a page per viewpoint would take all day). Writes ROUND/shots/<id>.png:
// 1024 x 768, 11:00 frozen, UI hidden, camera 1.6 m above the ground at the photo position looking along the photo heading, 60 degrees vertical fov,
// the player car hidden. A meta file may also give game metres x,z instead of lat/lon and its own eye height (landmark stand-off shots). Run it through the shared browser slots so only a few Chromes exist at once:
//   /private/tmp/claude-501/withbrowser.sh node tools/faith_shoot.mjs --base ... --round ...
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(path.join(here, 'build', 'package.json'))('puppeteer-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const base = arg('base', 'http://127.0.0.1:9655/'), round = arg('round', '/private/tmp/claude-501/round2');
const force = !!arg('force', false), eye = +arg('eye', 1.6), fov = +arg('fov', 60), settleMs = +arg('settle', 1500);
let ids = fs.readdirSync(round + '/meta').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
if (arg('ids', false)) ids = arg('ids').split(','); else if (arg('only', false)) { const o = arg('only').split(','); ids = ids.filter(i => o.some(p => i.startsWith(p))); }
fs.mkdirSync(round + '/shots', { recursive: true });
const todo = ids.filter(i => force || !fs.existsSync(`${round}/shots/${i}.png`));
console.log(todo.length, 'to shoot of', ids.length);
if (!todo.length) process.exit(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const p = await b.newPage(); await p.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto(base + '?help=0&debug&clean&fixres&time=11&play&cam=2&at=0,0', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => !document.getElementById('loading') && window.game?.world, { timeout: 240000, polling: 250 });
// From now on the camera is whatever `window.__shot` says, set just before every render; the car body is hidden while it renders.
await p.evaluate((eye, fov) => {
  const g = window.game, r = g.renderer, orig = r.render.bind(r), cam = g.camera;
  window.__shot = null;
  r.render = function (s, c) {
    const S = window.__shot;
    if (!S || c !== cam) return orig(s, c);
    const y = g.groundY(S.x, S.z) + (S.eye ?? eye), h = S.h * Math.PI / 180;
    cam.fov = fov; cam.updateProjectionMatrix();
    cam.position.set(S.x, y, S.z); cam.up.set(0, 1, 0); cam.lookAt(S.x + Math.sin(h) * 50, y, S.z - Math.cos(h) * 50);
    const hid = []; for (const o of s.children) if (o.visible && o.children.length && Math.hypot(o.position.x - g.car.x, o.position.z - g.car.z) < 1.5 && Math.abs(o.position.x) + Math.abs(o.position.z) > 5) { o.visible = false; hid.push(o); }
    const res = orig(s, c); for (const o of hid) o.visible = true; return res;
  };
}, eye, fov);
const ok = [], bad = [];
for (const id of todo) {
  const m = JSON.parse(fs.readFileSync(`${round}/meta/${id}.json`));
  try {
    const t0 = Date.now();
    const info = await p.evaluate((m) => new Promise((res) => {
      const g = window.game, [x, z] = m.x !== undefined ? [m.x, m.z] : g.proj(m.lat, m.lon), th = Math.PI - m.heading * Math.PI / 180;
      window.__shot = { x, z, h: m.heading, eye: m.eye };
      let done = false;
      g.world.teleport(x, z, () => { g.placeAt(x, z, th); done = true; });
      const t0 = performance.now(); let calm = 0;
      const tick = () => {
        const pend = g.world.visiblePending?.() ?? 0;
        calm = done && pend === 0 ? calm + 1 : 0;
        if (calm >= 20 || performance.now() - t0 > 40000) res({ x, z, y: g.groundY(x, z), calm, ms: Math.round(performance.now() - t0), pend });
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), m);
    await new Promise(r => setTimeout(r, settleMs));
    await p.screenshot({ path: `${round}/shots/${id}.png` });
    ok.push(id); console.log(id, 'ok', info.ms + 'ms', info.calm >= 20 ? '' : 'NOT SETTLED pend=' + info.pend);
  } catch (e) { bad.push(id); console.log(id, 'FAILED', String(e.message).slice(0, 120)); }
}
console.log('done', ok.length, 'ok', bad.length, 'failed', errs.length ? 'page errors: ' + [...new Set(errs)].slice(0, 5).join(' | ') : 'no page errors');
await b.close();
