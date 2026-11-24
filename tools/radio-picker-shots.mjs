// Options > Audio: the station switch and its line, at every size and in the docked panel of a paused game. Headless and muted: PD_CHROME=... node tools/radio-picker-shots.mjs outdir
// For each size it says whether a station name or the line under them is cut, then picks another station and checks the line follows.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'pdradio-'))] });
const p = await b.newPage(); let errs = 0; p.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message.slice(0, 300)); });
const read = () => p.evaluate(() => { const vis = e => e && e.offsetParent, cut = e => e.scrollWidth > e.clientWidth + 1;
  const bs = [...document.querySelectorAll('.pd-stcard')].filter(vis), d = document.querySelector('.pd-stdesc'), box = document.querySelector('.pd-stbox'), r = box && box.getBoundingClientRect();
  return { names: bs.map(e => e.textContent.trim()), cutNames: bs.filter(cut).length, line: d && d.textContent, cutLine: !!(d && cut(d)), oneRow: new Set(bs.map(e => Math.round(e.getBoundingClientRect().top))).size === 1, box: r && [Math.round(r.width), Math.round(r.height)], inView: !!r && r.bottom <= innerHeight && r.right <= innerWidth }; });
let bad = 0;
for (const [w, h, n, touch, lang] of [[844, 390, 'phone-land', 1, 'en'], [667, 375, 'phone-small', 1, 'it'], [390, 844, 'phone-port', 0, 'it'], [1024, 768, 'tablet', 0, 'en'], [1440, 900, 'desktop', 0, 'it']]) for (const mode of ['title', 'paused']) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: !!touch, hasTouch: !!touch });
  await p.goto(base + (mode === 'title' ? `?ui=options&lang=${lang}&help=0&p2p=off` : `?play&ui=pause&lang=${lang}&help=0&p2p=off`), { waitUntil: 'domcontentloaded', timeout: 120000 }); await wait(mode === 'title' ? 4500 : 9000);
  if (mode === 'paused') { const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('#pd-ui button')].find(e => e.offsetParent && /^(opzioni|options)$/i.test(e.textContent.trim())); if (b) b.click(); return !!b; }); if (!ok) { console.log(n, mode, 'no Options button found'); continue; } await wait(1200); }
  const a = await read(); await p.screenshot({ path: path.join(out, `${n}-${mode}.png`) });
  await p.evaluate(() => { const b = [...document.querySelectorAll('.pd-stcard')].filter(e => e.offsetParent)[1]; if (b) b.click(); }); await wait(700);
  const z = await read(), ok = a.names.length === 3 && !a.cutNames && !a.cutLine && a.oneRow && a.inView && z.line !== a.line && /Lamiera/.test(z.line || '');
  if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, mode, JSON.stringify(a), '->', z.line);
}
console.log(bad || errs ? `${bad} FAILED, ${errs} page errors` : 'ALL PASSED'); await b.close(); srv.server.close(); process.exit(bad || errs ? 1 : 0);
