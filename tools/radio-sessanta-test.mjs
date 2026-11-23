// Tests Radio Sessanta SeCunti (src/radio.js) on the running game, muted: node tools/radio-sessanta-test.mjs outdir [folder with the encoded files]
//   The encoded files are not in the repo (they go to the music bucket): a small local server with CORS serves the folder and the game is pointed at it with ?musicbase=.
//   Checks the station is in the list, switches to it, that a track loads and plays (audio element state) and advances on next, and the YouTube button (per-track Short, channel fallback); pictures on desktop and phone width.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import os from 'os';
import { startServer } from './build/serve.mjs';
const puppeteer = createRequire(new URL('./build/package.json', import.meta.url))('puppeteer-core');
const out = process.argv[2] || '.', dir = process.argv[3] || path.join(os.homedir(), '.cache/palermo-drive/radio/sessanta'), wait = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(out, { recursive: true });
const music = http.createServer((q, r) => { const f = path.join(dir, path.basename(decodeURIComponent(q.url.split('?')[0]))); if (!fs.existsSync(f)) { r.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); return r.end(); }
  const st = fs.statSync(f), h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'audio/mp4', 'Accept-Ranges': 'bytes' }, m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) { const a = +m[1] || 0, b = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(r); }
  else { r.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(f).pipe(r); } });
await new Promise(r => music.listen(0, '127.0.0.1', r)); const mbase = `http://127.0.0.1:${music.address().port}/`;
const srv = await startServer(new URL('..', import.meta.url).pathname.replace(/\/$/, '')), base = `http://127.0.0.1:${srv.port}/`;
const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.evaluateOnNewDocument(() => { window.__aud = []; const pl = Audio.prototype.play; Audio.prototype.play = function () { if (!window.__aud.includes(this)) window.__aud.push(this); return pl.apply(this, arguments); }; });   // the radio's <audio> elements are not in the DOM: keep them
await p.goto(base + '?debug&play&p2p=off&help=0&time=11&musicbase=' + encodeURIComponent(mbase), { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForFunction(() => window.game?.car, { timeout: 120000 }); await wait(3000);
const shot = async n => { await p.screenshot({ path: path.join(out, n + '.png') }); console.log('shot', n); };
const R = () => p.evaluate(async () => { const { getRadio, STATIONS } = await import('/src/radio.js'); const r = getRadio(); const els = [...document.querySelectorAll('audio')]; return { stations: STATIONS.map(s => s.id + ':' + s.tracks.length), station: r && r.station, view: r && { ...r.view }, audio: [...(window.__audios || [])] }; });
console.log(JSON.stringify(await R()));
await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); const r = getRadio(); r.setEnabled?.(true); r.setStation('sessanta'); });
await p.evaluate(() => dispatchEvent(new Event('pd-gesture')));   // the radio starts on the first gesture
await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); getRadio().next(); }); await wait(6000);
const state = () => p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); const r = getRadio(); return { station: r.station, view: { ...r.view }, aud: (window.__aud || []).map(a => ({ src: a.src.split('/').pop(), t: +a.currentTime.toFixed(2), d: +(a.duration || 0).toFixed(1), paused: a.paused, err: a.error && a.error.code, ready: a.readyState })), yt: [...document.querySelectorAll('.pd-byt')].map(a => ({ hidden: a.hidden, href: a.href, vis: !!a.offsetParent, label: a.title })) }; });
let s1 = await state(); console.log('A', JSON.stringify(s1)); await shot('r1-desktop-bar');
await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); getRadio().next(); }); await wait(5000);
const s2 = await state(); console.log('B', JSON.stringify(s2));
const playing = s => s.aud.some(a => !a.paused && a.t > 0.5 && !a.err), changed = s1.view.title !== s2.view.title;
console.log('RESULT station', s2.station === 'sessanta', 'playing', playing(s2), 'advanced', changed, 'link per track', /youtube\.com\/shorts\//.test(s2.view.link), 'artist', s2.view.artist);
// the menu panel, desktop
await p.keyboard.press('Escape'); await wait(1200); await shot('r2-desktop-menu');
await p.evaluate(() => document.querySelector('.pd-sidelist [data-do="options"]')?.click()); await wait(3000); await shot('r2b-desktop-options'); await p.evaluate(() => { for (const e of document.querySelectorAll('.pd-s-options *')) if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = 99999; }); await wait(800); await shot('r2c-desktop-options-bottom');   // the station cards
// the channel fallback: no track playing
await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); getRadio().setEnabled(false); }); await wait(600);
// phone, on its side (the game is landscape only): the emulation reloads the page, so the radio starts again on the first gesture
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await wait(6000);
await p.evaluate(() => dispatchEvent(new Event('pd-gesture'))); await p.evaluate(async () => { const { getRadio } = await import('/src/radio.js'); const r = getRadio(); r.setEnabled(true); r.setStation('sessanta'); r.next(); }); await wait(6000);
await shot('r3-phone-bar'); console.log('C', JSON.stringify(await state()));
await p.tap('.pd-btitle'); await wait(900); await shot('r4-phone-bar-open');   // the bar opened: the whole credit
// the button is a plain link: it must not be the whole bar, and a tap on it does not touch the game (the link goes to a new tab)
console.log('link attrs', JSON.stringify(await p.evaluate(() => { const a = document.querySelector('.pd-bar .pd-byt'); const r = a.getBoundingClientRect(); return { target: a.target, rel: a.rel, w: Math.round(r.width), h: Math.round(r.height) }; })));
await b.close(); srv.server.close(); music.close(); process.exit(0);
