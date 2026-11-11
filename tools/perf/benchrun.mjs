// Runs ?bench (src/bench.js, the phone measuring itself) on this machine at the phone's window size and keeps what the phone would show: the two result pages as pictures, their text and the JSON.
//   tools/release/withbrowser.sh node tools/perf/benchrun.mjs --out <dir> [--root <a built dist or a checkout>] [--cpu 4] [--q 'bs=qc&bv=sh0,flat'] [--tag name]     headless Chrome (--cpu: CDP slowdown, to see how long a slow device takes)
//   node tools/perf/benchrun.mjs --webkit --out <dir> [--root ...] [--q ...]                                                                                          real WebKit (tools/perf/wk.swift: off screen, silent)
// The page runs exactly what the phone runs, the reload without MSAA included; this only waits for it, flips the two pages and saves them. ?benchpr=2 is added so a display at ratio 1 still draws the phone's 1792 x 828.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const A = process.argv, i = A.findIndex(x => x === '--' + k || x.startsWith('--' + k + '=')); if (i < 0) return d; if (A[i].includes('=')) return A[i].split('=').slice(1).join('='); return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..'))), OUT = path.resolve(arg('out', '.')), TAG = arg('tag', arg('webkit', false) ? 'webkit' : 'chrome'), W = 896, H = 414;   // the iPhone XR and 11 in landscape
const THREE_DIR = path.join(fs.realpathSync(path.join(HERE, '../build/node_modules')), 'three');
fs.mkdirSync(OUT, { recursive: true });

// the checkout or the built site, with three.js from tools/build/node_modules instead of the CDN (as tools/perf/gpucost.mjs serves it)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const fetched = [];
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]), base = ROOT;
  const cdn = u.match(/^\/__cdn\/three\/(.*)$/); if (cdn) { base = THREE_DIR; u = '/' + cdn[1]; }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(base, u);
  if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(f); fetched.push(u);
  if (u === '/index.html') body = Buffer.from(String(body).replaceAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[0-9.]+\//g, '/__cdn/three/'));
  res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/?help=0&bench=new&benchpr=2${arg('q', '') ? '&' + arg('q') : ''}`, t0 = Date.now();
const keep = (texts, json) => { texts.forEach((t, i) => fs.writeFileSync(path.join(OUT, `${TAG}-page${i + 1}.txt`), t + '\n')); fs.writeFileSync(path.join(OUT, `${TAG}.json`), json); console.log(texts.join('\n\n')); console.log(`\n${TAG}: ${((Date.now() - t0) / 1000).toFixed(0)} s on the wall, ${json.length} bytes of JSON, files in ${OUT}`); };

if (arg('webkit', false)) {
  const CACHE = path.join(HERE, '../build/.cache'), WK = path.join(CACHE, 'wk'), src = path.join(HERE, 'wk.swift');
  if (!fs.existsSync(WK) || fs.statSync(WK).mtimeMs < fs.statSync(src).mtimeMs) { fs.mkdirSync(CACHE, { recursive: true }); execFileSync('swiftc', ['-O', src, '-o', WK], { stdio: 'inherit' }); }
  // injected at the start of every load (the reload without MSAA too): no sound, then wait for the result and ask the host for a picture of each page
  const probe = path.join(os.tmpdir(), `benchrun-probe-${process.pid}.js`), shot = n => path.join(OUT, `${TAG}-page${n}.png`);
  fs.writeFileSync(probe, `(() => {
    const post = o => window.webkit.messageHandlers.probe.postMessage(typeof o === 'string' ? o : JSON.stringify(o)), sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const k of ['AudioContext', 'webkitAudioContext']) { const A = window[k]; if (!A) continue; window[k] = class extends A { constructor(...a) { super(...a); super.suspend(); } resume() { return Promise.resolve(); } }; }
    HTMLMediaElement.prototype.play = function () { this.muted = true; return Promise.resolve(); };
    addEventListener('error', e => post({ error: String(e.message).slice(0, 300) }));
    addEventListener('unhandledrejection', e => post({ error: 'rejection ' + String(e.reason && e.reason.stack || e.reason).slice(0, 300) }));
    (async () => {
      for (let last = '';;) { const b = window.__pdBench, t = [...(document.body ? document.body.children : [])].map(e => e.textContent).find(t => /^BENCH  /.test(t)) || ''; if (t !== last) post({ strip: last = t }); if (b && b.tap) { b.tap(); b.tap = null; } if (b && b.done) break; await sleep(500); }
      const b = window.__pdBench; post({ texts: b.text(), json: JSON.stringify(b.res) });
      b.page(0); await sleep(800); post('snap:' + ${JSON.stringify(shot(1))}); await sleep(5000);
      b.page(1); await sleep(800); post('snap:' + ${JSON.stringify(shot(2))}); await sleep(5000);
      post('done');
    })();
  })();`);
  await new Promise(done => {
    const p = spawn(WK, [url, probe, String(W), String(H), String(arg('limit', 480))], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l === 'done') continue; try { const o = JSON.parse(l); if (o.texts) keep(o.texts, o.json); else if (o.strip !== undefined) { if (arg('v', false) && o.strip) console.log('  ' + o.strip); } else console.log('  ' + l.slice(0, 300)); } catch { console.log('  ' + l.slice(0, 300)); } } });
    p.on('exit', done);
  });
  fs.rmSync(probe, { force: true });
} else {
  const puppeteer = createRequire(path.join(HERE, '../build/package.json'))('puppeteer-core');
  const b = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
  const p = await b.newPage(), wait = ms => new Promise(r => setTimeout(r, ms));
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', e => console.log('  [page error]', e.message.slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 300)); });
  if (arg('cpu', '')) { const c = await p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: +arg('cpu') }); }
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let last = '';
  for (;;) {   // the page reloads itself once near the end: a poll that dies with the old page just tries again
    const s = await p.evaluate(() => { const q = window.__pdBench; if (q && q.tap) { q.tap(); q.tap = null; } return q ? { done: q.done, strip: [...document.body.children].map(e => e.textContent).find(t => /^BENCH  /.test(t)) || '' } : null; }).catch(() => null);
    if (s && s.strip && arg('v', false) && s.strip !== last) { last = s.strip; console.log('  ' + s.strip); }
    if (s && s.done) break;
    if (Date.now() - t0 > +arg('limit', 900) * 1000) { console.log('gave up waiting'); break; }
    await wait(500);
  }
  const out = await p.evaluate(() => ({ texts: window.__pdBench.text(), json: JSON.stringify(window.__pdBench.res) })).catch(() => null);
  if (out) {
    for (const n of [0, 1]) { await p.evaluate(k => window.__pdBench.page(k), n); await wait(300); await p.screenshot({ path: path.join(OUT, `${TAG}-page${n + 1}.png`) }); }
    keep(out.texts, out.json);
  }
  await b.close();
}
console.log('fetched', fetched.filter(u => /bench/.test(u)).join(' ') || '(no bench file)');
srv.close();
