// Pictures of the tape icon on the minimap and on the big map, muted and headless:
//   PD_CHROME=<headless chrome> node tools/tape-icon-shots.mjs outdir
// Two tapes are marked as found first, so the big map shows both the amber and the grey cassette.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'pdtapeicon-'));
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', protocolTimeout: 600000, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--user-data-dir=' + udd] });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message.slice(0, 300)); });
p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('palermoDrive.tapes.v1', JSON.stringify(['sessanta-porta-felice', 'sessanta-mose-a-mondello'])); } catch (e) {} });
const tele = (x, z) => p.evaluate((x, z) => new Promise(res => { const g = window.game; g.world.teleport(x, z, () => { g.placeAt(x, z); res(); }); setTimeout(res, 20000); }), x, z);
for (const [nm, w, h] of [['desktop', 1280, 720], ['tablet', 1024, 768], ['phone', 844, 390], ['phone-small', 667, 375]]) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto(base + '?debug&play&p2p=off&help=0&cloud=off&lang=en&time=11&radio=off&mapdebug', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(() => window.game?.car && window.game.tapes, { timeout: 120000 }); await wait(2500);
  const t = await p.evaluate(() => window.game.tapes.where('sessanta-cu-t-addifenni-palermo'));
  await tele(t.x + 35, t.z + 25); await wait(4000);
  await p.screenshot({ path: path.join(out, `mini-${nm}.png`) });
  const r = await p.evaluate(() => { const c = document.getElementById('mini').getBoundingClientRect(); return { x: c.x - 6, y: c.y - 6, width: c.width + 12, height: c.height + 12 }; });
  await p.screenshot({ path: path.join(out, `mini-${nm}-close.png`), clip: r });
  await p.click('#mini'); await wait(5000);   // a tap on the minimap opens the big map
  await p.screenshot({ path: path.join(out, `bigmap-${nm}.png`) });
  await p.keyboard.press('Equal'); await p.keyboard.press('Equal'); await wait(1500); await p.screenshot({ path: path.join(out, `bigmap-${nm}-zoom.png`) });
  await p.click('.pd-mp-lg'); await wait(600); await p.screenshot({ path: path.join(out, `bigmap-${nm}-legend.png`) });
  console.log(nm, 'legend rows', await p.evaluate(() => document.querySelectorAll('.pd-mp-leg div').length), 'legend box', JSON.stringify(await p.evaluate(() => { const b = document.querySelector('.pd-mp-leg').getBoundingClientRect(), e = document.querySelector('.pd-mp-leg'); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, scrolls: e.scrollHeight > e.clientHeight + 1 }; })));
  await p.click('.pd-mp-lg'); await wait(300);
  // tap the tape by Teatro Massimo on the map: its popup names it and has no start button
  const pt = await p.evaluate(({ x, z }) => { const d = window.__pdMap.debug(); return { x: d.W / 2 + (x - d.vx) * d.k, y: d.H / 2 + (z - d.vz) * d.k }; }, t);
  const cv = await p.evaluate(() => { const c = document.querySelector('.pd-mp-cv').getBoundingClientRect(); return { x: c.x, y: c.y }; });
  await p.mouse.click(cv.x + pt.x, cv.y + pt.y); await wait(600);
  console.log(nm, 'tap on a tape', JSON.stringify(await p.evaluate(() => { const q = document.querySelector('.pd-mp-pop'); return { open: !q.hidden, title: q.querySelector('.pd-mp-pt').textContent, sub: q.querySelector('.pd-mp-ps').textContent, button: !q.querySelector('button').hidden }; })));
  await p.screenshot({ path: path.join(out, `bigmap-${nm}-tap.png`) });
}
console.log('console errors:', errs.length);
await b.close(); srv.close?.(); fs.rmSync(udd, { recursive: true, force: true }); process.exit(errs.length ? 1 : 0);
