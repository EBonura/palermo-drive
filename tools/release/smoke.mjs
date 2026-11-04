// The checks a release must pass: the built game loads with no error or Content Security Policy refusal on the main screens, desktop and phone, the Garage opens, and the lapa moves when driven.
//   tools/release/withbrowser.sh node tools/release/smoke.mjs dist      exit 1 on any failure; about 3 minutes
import { createRequire } from 'module';
import { startServer } from '../build/serve.mjs';
const puppeteer = createRequire(new URL('../build/package.json', import.meta.url))('puppeteer-core');
const srv = await startServer(process.argv[2] || 'dist'), base = `http://127.0.0.1:${srv.port}/`, wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
let bad = 0; const say = (tag, errs, extra = '') => { console.log(tag.padEnd(14), extra, errs.length ? 'ERR ' + errs.join(' | ') : 'no errors'); if (errs.length) bad++; };
const open = async (w, h, q) => {
  const p = await b.newPage(), errs = []; await p.setViewport({ width: w, height: h, hasTouch: w < 900, isMobile: w < 900 });
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !/ERR_CONNECTION_RESET/.test(t)) || /Content Security Policy|Refused to/i.test(t)) errs.push(t.slice(0, 160)); });   // a reset is the busy local test server, not the game
  await p.goto(base + '?help=0&' + q, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(() => !document.getElementById('loading'), { timeout: 180000, polling: 250 }).catch(() => errs.push('loading never lifted'));
  return { p, errs };
};
for (const [tag, w, h, q] of [['title', 1280, 720, ''], ['start list', 1280, 720, 'ui=start&view=list'], ['credits', 1280, 720, 'ui=credits'], ['pub', 1280, 720, 'event=pub:krust&auto&time=21'], ['title phone', 844, 390, '']]) {
  const { p, errs } = await open(w, h, q); await p.mouse.click(w / 2, h / 2 + 40); await wait(5000); say(tag, errs); await p.close();
}
for (const [tag, w, h] of [['garage', 1280, 720], ['garage phone', 844, 390]]) {
  const { p, errs } = await open(w, h, 'ui=garage'); await wait(4500);
  if (!await p.evaluate(() => !!document.querySelector('.pd-in-garage'))) errs.push('not in the garage');
  say(tag, errs); await p.close();
}
for (const [tag, w, h, at] of [['drive centre', 1280, 720, '15,5'], ['drive phone', 844, 390, '-1250,250'], ['drive coast', 1280, 720, '-3000,-10100']]) {
  const { p, errs } = await open(w, h, `debug&play&p2p=off&at=${at}`); await p.waitForFunction(() => window.game?.car, { timeout: 60000 }).catch(() => errs.push('no game')); await wait(4000);
  const moved = await p.evaluate(() => new Promise(res => { const g = window.game, c = g.car, x = c.x, z = c.z; g.keys.ArrowUp = true; g.keys.KeyW = true; setTimeout(() => { g.keys.ArrowUp = false; g.keys.KeyW = false; res(Math.round(Math.hypot(c.x - x, c.z - z))); }, 6000); })).catch(() => -1);
  if (moved < 5) errs.push('the lapa did not move (' + moved + ' m)');
  say(tag, errs, moved + ' m'); await p.close();
}
await b.close(); await srv.close?.(); process.exit(bad ? 1 : 0);
