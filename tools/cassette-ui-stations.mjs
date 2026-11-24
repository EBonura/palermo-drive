// Options > Audio station cards and the welcome panel's station buttons, headless and muted: PD_CHROME=... node tools/cassette-ui-stations.mjs outdir
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--user-data-dir=' + fs.mkdtempSync('/tmp/pdui-')] });
const p = await b.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
for (const [w, h, n, touch] of [[844, 390, 'phone-land', 1], [390, 844, 'phone-port', 0], [1440, 900, 'desktop', 0]]) for (const ui of ['options', 'welcome']) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: !!touch, hasTouch: !!touch });
  await p.goto(base + `?ui=${ui}&lang=en&help=0&p2p=off`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await wait(4500); if (ui === 'welcome') await p.waitForFunction(() => document.querySelector('.pd-wel')?.offsetParent && !document.querySelector('.pd-loading:not([hidden])'), { timeout: 60000 }).catch(() => {}); await p.evaluate(() => document.getElementById('loading')?.remove()); await wait(2500);
  await p.screenshot({ path: path.join(out, `${ui}-${n}.png`) });
  console.log(n, ui, JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.pd-stcard, .pd-welst3 button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 14), r.left | 0, r.right | 0, e.scrollWidth > e.clientWidth + 1]; }))));
}
await b.close(); srv.server.close(); process.exit(0);
