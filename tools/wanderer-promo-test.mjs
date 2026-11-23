// The promotion of Dario's channel (src/ui.js, src/job-wanderer.js), muted: node tools/wanderer-promo-test.mjs outdir
//   radio notice (once), the bar's shortened credit, Options line, credits section, the mission's result card with the channel link; desktop and a phone on its side.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import os from 'os';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', dir = path.join(os.homedir(), '.cache/palermo-drive/radio/sessanta'), wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const music = http.createServer((q, r) => { const f = path.join(dir, path.basename(decodeURIComponent(q.url.split('?')[0]))); if (!fs.existsSync(f)) { r.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); return r.end(); }
  const st = fs.statSync(f), h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' }, m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) { const a = +m[1] || 0, b = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(r); }
  else { r.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(f).pipe(r); } });
await new Promise(r => music.listen(0, '127.0.0.1', r)); const mbase = `http://127.0.0.1:${music.address().port}/`;
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const SIZES = [['desktop', { width: 1280, height: 720, deviceScaleFactor: 2 }], ['phone', { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]];
for (const [tag, vp] of SIZES) {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport(vp);
  p.on('pageerror', e => console.log(tag, 'PAGEERROR', e.message.slice(0, 300)));
  const shot = async n => { await p.screenshot({ path: path.join(out, `${tag}-${n}.png`) }); console.log('shot', tag, n); };
  await p.goto(base + '?debug&play&p2p=off&help=0&time=11&call=wanderer&musicbase=' + encodeURIComponent(mbase), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(() => window.game?.car && window.__missions?.wanderer && window.__missions.X.kinds.wanderer, { timeout: 120000 }); await wait(3000);
  // 1. the radio: first time on this station, the notice
  await p.evaluate(() => dispatchEvent(new Event('pd-gesture')));
  await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); const r = getRadio(); r.setEnabled(true); r.setStation('sessanta'); r.next(); }); await wait(6000);
  console.log(tag, 'notice', JSON.stringify(await p.evaluate(() => { const n = document.querySelector('.pd-stnotice'); const a = n.querySelector('a'); return { shown: !n.hidden && !!n.offsetParent, href: a.href, rel: a.rel, target: a.target, by: document.querySelector('.pd-bt2').textContent }; })));
  await shot('notice');
  await p.evaluate(() => document.querySelector('.pd-stnx').click()); await wait(500);
  console.log(tag, 'after close', JSON.stringify(await p.evaluate(() => ({ shown: !document.querySelector('.pd-stnotice').hidden, flag: localStorage.getItem('palermoDrive.sessantaNote.v1') }))));
  await p.evaluate(() => document.querySelector('.pd-btitle').click()); await wait(800); await shot('bar-open');
  // 2. Options
  await p.keyboard.press('Escape'); await wait(1000);
  await p.evaluate(() => document.querySelector('.pd-sidelist [data-do="options"]')?.click()); await wait(2500);
  await p.evaluate(() => { for (const e of document.querySelectorAll('.pd-s-options *')) if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = 99999; }); await wait(600); await shot('options');
  // 3. the mission's result card with the link
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.game?.car && window.__missions?.wanderer && window.__missions.X.kinds.wanderer, { timeout: 120000 }); await wait(3000);
  const put = (x, z, exact) => p.evaluate((x, z, exact) => { const g = window.game; g.placeAt(x, z); if (exact) { g.car.x = x; g.car.z = z; } g.car.vx = 0; g.car.vz = 0; }, x, z, exact);
  const phase = () => p.evaluate(() => { const r = window.__missions.X.kinds.wanderer.state(); return r ? r.phase + '/' + r.leg : 'none'; });
  const W = await p.evaluate(() => { const w = window.__missions.wanderer; return { x: w.x, z: w.z }; });
  await put(W.x + 60, W.z + 60); await wait(7000);
  let ringing = false; for (let i = 0; i < 150 && !ringing; i++) { await p.evaluate(() => { window.game.car.vx = 4; }); await wait(400); ringing = await p.evaluate(() => !!document.querySelector('#pd-call.on')); }
  await wait(1200); await shot('mission-card'); await p.evaluate(() => document.querySelector('#pd-call').click()); await wait(1500);
  await put(W.x + 5, W.z + 3); for (let i = 0; i < 40 && !(await phase()).startsWith('ride'); i++) await wait(500); await wait(2000);
  const pts = await p.evaluate(() => window.__missions.X.kinds.wanderer.points());
  await put(pts.dest.x, pts.dest.z, true); for (let i = 0; i < 20 && !(await phase()).startsWith('out'); i++) { await put(pts.dest.x, pts.dest.z, true); await wait(500); }
  await wait(5000); await shot('mission-out');
  for (let i = 0; i < 60 && !(await phase()).startsWith('ride/2'); i++) await wait(500);
  await wait(1500); await put(pts.home.x, pts.home.z, true); for (let i = 0; i < 20 && !(await phase()).startsWith('drop'); i++) { await put(pts.home.x, pts.home.z, true); await wait(500); }
  await wait(1800); await shot('mission-result');
  console.log(tag, 'result link', JSON.stringify(await p.evaluate(() => { const a = document.querySelector('.ev-result a'); if (!a) return null; const r = a.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { href: a.href, rel: a.rel, target: a.target, hit: t === a || a.contains(t), w: Math.round(r.width), h: Math.round(r.height) }; })));
  await ctx.close();
}
// 4. the credits screen: from the title menu
{
  const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport(SIZES[0][1]);
  await p.goto(base + '?debug&p2p=off', { waitUntil: 'domcontentloaded', timeout: 120000 }); await wait(9000);
  const ok = await p.evaluate(() => { const c = [...document.querySelectorAll('[data-do="credits"]')].find(e => e.offsetParent); if (c) c.click(); return !!c; }); console.log('credits button', ok); await wait(2500);
  const found = await p.evaluate(async () => { const roll = document.querySelector('.pd-roll'); const h = [...document.querySelectorAll('.pd-roll h2, .pd-roll h3')].find(e => /Sicilian Wanderer/.test(e.textContent) && !/Radio/.test(e.textContent)); if (!h) return false; roll.style.animation = 'none'; roll.scrollTop = Math.max(0, h.getBoundingClientRect().top - roll.getBoundingClientRect().top + roll.scrollTop - 60); return true; });
  console.log('credits section found', found); await wait(1200); await p.screenshot({ path: path.join(out, 'desktop-credits.png') });
  await ctx.close();
}
await b.close(); srv.server.close(); music.close(); process.exit(0);
