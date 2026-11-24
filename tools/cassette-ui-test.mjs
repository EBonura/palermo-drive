// Collezioni Cassette list, Options stations, welcome stations, headless and muted: PD_CHROME=... node tools/cassette-ui-test.mjs outdir
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--user-data-dir=' + fs.mkdtempSync('/tmp/pdui-')] });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message.slice(0, 300)); }); p.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('CONSOLE', m.text().slice(0, 300)); } });
const sizes = [[844, 390, 'phone-land'], [667, 375, 'phone-land-small'], [390, 844, 'phone-port'], [375, 667, 'phone-port-small'], [1024, 768, 'tablet-land'], [768, 1024, 'tablet-port'], [1440, 900, 'desktop']];
const only = process.argv[3];
for (const [w, h, n] of sizes) {
  if (only && only !== n) continue;
  const touch = w > h && w < 900; /* an upright phone shows the turn-sideways gate, so the portrait sizes run as a plain window */ await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto(base + '?play&ui=collections&fakeprogress&lang=en&help=0&p2p=off', { waitUntil: 'domcontentloaded', timeout: 120000 }); await wait(5000);
  await p.screenshot({ path: path.join(out, `col-${n}.png`) });
  const info = await p.evaluate(() => { const c = document.querySelector('.pd-colrows'), r = c.getBoundingClientRect(), card = document.querySelector('.pd-s-collections .pd-card').getBoundingClientRect(), back = document.querySelector('.pd-s-collections [data-do=back]').getBoundingClientRect(); c.scrollTop = 99999; return { sh: c.scrollHeight, ch: c.clientHeight, card: [card.top | 0, card.bottom | 0], back: [back.top | 0, back.bottom | 0], vh: innerHeight, vw: innerWidth, ui: document.querySelector('#pd-ui')?.dataset.st }; });
  await wait(400); await p.screenshot({ path: path.join(out, `col-${n}-bottom.png`) }); console.log(n, JSON.stringify(info));
}
if (!only) {
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(base + '?play&ui=collections&fakeprogress&lang=en&help=0&p2p=off', { waitUntil: 'domcontentloaded' }); await wait(5000);
  // play calls: stub tapes through the page by wrapping the click path
  await p.evaluate(() => { window.__plays = []; document.addEventListener('click', e => { const t = e.target.closest('[data-tape]'); if (t) window.__plays.push(t.dataset.tape); }, true); });
  const rows = await p.$$eval('.pd-tape.on', l => l.map(e => e.dataset.title)); console.log('found rows', rows.length, rows.join('|'));
  console.log('unfound text', JSON.stringify(await p.$$eval('.pd-tape:not(.on)', l => l.map(e => e.textContent))));
  await p.click('.pd-tape.on .pd-tapeb'); await p.evaluate(() => { document.querySelector('.pd-tapeyt').addEventListener('click', e => e.preventDefault()); }); await p.click('.pd-tape.on .pd-tapeyt');
  console.log('plays after row click + yt click', JSON.stringify(await p.evaluate(() => window.__plays)));
  await p.evaluate(() => dispatchEvent(new CustomEvent('pd-radio', { detail: { mode: 'on', label: 'Tape', title: document.querySelectorAll('.pd-tape.on')[1].dataset.title } })));
  console.log('marked', JSON.stringify(await p.$$eval('.pd-tape.run', l => l.map(e => e.dataset.title)))); await p.screenshot({ path: path.join(out, 'col-marked.png') });
  // keyboard: arrow keys from the first button until a tape row is focused
  await p.evaluate(() => document.activeElement.blur()); let hit = [];
  for (let k = 0; k < 8; k++) { await p.keyboard.press('ArrowDown'); await wait(80); hit.push(await p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.tape ? 'tape:' + a.dataset.tape : (a.dataset.do || a.className.split(' ')[0] || a.tagName)) : 'none'; })); }
  console.log('arrow focus', hit.join(' > '));
  hit = []; for (let k = 0; k < 6; k++) { await p.keyboard.press('ArrowUp'); await wait(80); hit.push(await p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.tape ? 'tape:' + a.dataset.tape : (a.dataset.do || a.className.split(' ')[0])) : 'none'; })); } console.log('arrow up', hit.join(' > '));
  await p.keyboard.press('ArrowRight'); await wait(80); console.log('right', await p.evaluate(() => document.activeElement.className));
}
await b.close(); srv.server.close(); console.log('errors', errs.length); process.exit(0);
