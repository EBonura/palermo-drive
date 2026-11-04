// What each feature costs on an Apple GPU, measured in real WebKit (a WKWebView, ANGLE on Metal: the same tile-based GPU family as an iPhone's).
//   node tools/perf/gpucost.mjs costs [--spots qc,ballaro] [--k 4] [--v sh0,fog0,...] [--rounds 10] [--n 12] [--pr 2] [--rep 4]   # per-feature cost, base against each variant in the same page
//   node tools/perf/gpucost.mjs census [--spots qc]                                                    # draws and triangles by material, GL calls in one frame
//   node tools/perf/gpucost.mjs scan [--spots qc]                                                      # frame time against pixel ratio: what follows the pixels and what does not
//   node tools/perf/gpucost.mjs aa [--spots qc] [--k 4] [--pairs 2]                                   # MSAA on against off: separate pages (a context attribute), alternated
//   node tools/perf/gpucost.mjs shots --out <dir> [--spots qc] [--times 12,20]                         # JPEGs at the iPhone's pixel ratio for comparing the look
//   node tools/perf/gpucost.mjs diff --v gate,vogel [--spots qc] [--times 12,18.5,23] [--out dir]      # the same instant drawn with and without a variant: pixel differences
//   node tools/perf/gpucost.mjs waste [--spots qc] [--top 45]                                          # each object in a flat colour: triangles drawn against pixels that reach the screen
//   node tools/perf/gpucost.mjs eval --js file [--spots qc]                                            # a snippet run in the settled page (G, R, S, THREE, gl), its result as JSON
//   --q 'extra=1&...' adds to every page's query, --root <dir> serves another checkout (a before/after pair)
// A frame is timed from the start of the game's animation callback to the end of a 1-pixel readPixels (the GPU has finished it). --k raises the pixel
// ratio k times over the iPhone's 2 (k = 4, the default, is 6752 x 3120 for an 844 x 390 window: 16 times the pixels), so the GPU is what the frame waits for; read the costs as shares of
// that frame, not as phone milliseconds. --rep draws each frame that many times over (the game's frame and then renderer.render again), and the times are
// per draw of the frame: the CPU issues the next copy while the GPU works on the last, so what is left is mostly the GPU's time. This Mac's GPU is a lot bigger than a phone's. The window sits off screen and the probe keeps it silent.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const A = process.argv, i = A.findIndex(x => x === '--' + k || x.startsWith('--' + k + '=')); if (i < 0) return d; if (A[i].includes('=')) return A[i].split('=').slice(1).join('='); return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const MODE = process.argv[2] || 'costs', ROOT = path.resolve(arg('root', path.join(HERE, '../..'))), K = +arg('k', 4), Q = arg('q', ''), OUT = arg('out', ''), ROUNDS = +arg('rounds', 10);
const W = 844, H = 390, PR = 2;   // the iPhone's landscape viewport in the brief (the 18 Pro Max is a little wider) at the pixel ratio every device runs
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;   // src/core.js proj
const ll = (lat, lon) => [((lon - LON0) * KX).toFixed(1), (-(lat - LAT0) * KZ).toFixed(1)].join(',');
const SPOTS = {
  qc: '17.5,0,0', ballaro: '24.9,488.6,-2.01', viaroma: ll(38.1183, 13.3632), regione: ll(38.090479, 13.343314), mondello: '-3033.1,-10177.4,-1.07',
  pretoria: ll(38.11535, 13.3622), maqueda: ll(38.1176, 13.3601), vittorio: ll(38.1151, 13.3637), zisa: '-1758.8,-43.6,-0.14',
};
const names = String(arg('spots', 'qc')).split(',');
const THREE_DIR = path.join(fs.realpathSync(path.join(HERE, '../build/node_modules')), 'three');

// ---------- the WKWebView, built once into tools/build/.cache (ignored)
const CACHE = path.join(HERE, '../build/.cache'), WK = path.join(CACHE, 'wk');
function wkBinary() {
  const src = path.join(HERE, 'wk.swift');
  if (!fs.existsSync(WK) || fs.statSync(WK).mtimeMs < fs.statSync(src).mtimeMs) { fs.mkdirSync(CACHE, { recursive: true }); execFileSync('swiftc', ['-O', src, '-o', WK], { stdio: 'inherit' }); }
  return WK;
}
// ---------- the checkout, with three.js from tools/build/node_modules instead of the CDN (the import map is rewritten)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
function serve(root) {
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]), base = root;
    const cdn = u.match(/^\/__cdn\/three\/(.*)$/); if (cdn) { base = THREE_DIR; u = '/' + cdn[1]; }
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(base, u);
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(f);
    if (u === '/index.html') body = Buffer.from(String(body).replaceAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[0-9.]+\//g, '/__cdn/three/'));
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
// One page: the plan runs inside it (tools/perf/probe.js), the messages come back as lines.
async function page(port, spot, plan, { q = '', attr = null, settle = 8000, limit = 900 } = {}) {
  const cfg = { plan, attr, settle };
  const probe = path.join(os.tmpdir(), `gpucost-probe-${process.pid}.js`);
  fs.writeFileSync(probe, `window.__PROBE = ${JSON.stringify(cfg)};\n` + fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8'));
  const url = `http://127.0.0.1:${port}/?help=0&play&at=${SPOTS[spot] || spot}&fixres&debug&gfx=high&p2p=off&cam=${arg('cam', 1)}${/(^|&)time=/.test(q + '&' + Q) ? '' : '&time=' + arg('time', 12)}${Q ? '&' + Q : ''}${q ? '&' + q : ''}`;
  const out = [];
  await new Promise(done => {
    const p = spawn(wkBinary(), [url, probe, String(W), String(H), String(limit)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l === 'done') continue; try { const o = JSON.parse(l); out.push(o); onMsg(o); } catch { console.log('  ' + l.slice(0, 200)); } } });
    p.on('exit', done);
  });
  fs.rmSync(probe, { force: true });
  return out;
}
function onMsg(o) {
  if (o.error) console.log('  [page error]', o.error);
  else if (o.phase) console.log(`  loaded in ${(o.t / 1000).toFixed(0)} s, ${o.renderer}, antialias ${o.attr?.antialias}, timer query ${o.timer}`);
  else if (o.ab) console.log(`  ${o.ab.name.padEnd(14)} base ${o.ab.base.toFixed(1).padStart(6)} ms  with ${o.ab.with.toFixed(1).padStart(6)} ms  ${(o.ab.d >= 0 ? '+' : '') + o.ab.d.toFixed(1)} ms (${o.ab.pct >= 0 ? '+' : ''}${o.ab.pct} %)   rounds ${o.ab.baseRounds.join(' ')} / ${o.ab.withRounds.join(' ')}`);
  else if (o.time) console.log(`  ${(o.tag || '').padEnd(8)} pr ${o.pr} ${o.buf.join('x')}: frame ${o.time.tot.toFixed(1)} ms (p25 ${o.time.lo.toFixed(1)}), game code ${o.time.js.toFixed(1)}, waiting for the GPU ${o.time.wait.toFixed(1)}`);
  else if (o.fps) console.log(`  fps ${o.fps} at pr ${o.pr}`);
}
const DEFAULT_V = 'sh0,shpass0,shtap1,fog0,tone0,env0,nospec,mediump,alpha0,cutout0,transp0,flat';

const srv = await serve(ROOT); const port = srv.address().port;
const results = {};
try {
  for (const spot of names) {
    console.log(`${spot} (${SPOTS[spot] || spot})`);
    if (MODE === 'census') results[spot] = await page(port, spot, [{ do: 'census', pr: PR }]);
    if (MODE === 'scan') results[spot] = await page(port, spot, [1, 1.5, 2, 3, 4, 6, 8].map(pr => ({ do: 'time', pr, n: 40 })));
    if (MODE === 'costs') results[spot] = await page(port, spot, [{ do: 'time', pr: PR * K, n: 30 }, ...(arg('pr', '') ? [{ pr: +arg('pr') }] : []), { rep: +arg('rep', 4) }, ...String(arg('v', DEFAULT_V)).split(',').map(v => ({ do: 'ab', v, rounds: ROUNDS, n: +arg('n', 12), warm: 8 }))]);
    if (MODE === 'aa') {
      const r = [];
      for (let i = 0; i < +arg('pairs', 2); i++) for (const aa of [true, false]) {
        const m = await page(port, spot, [{ do: 'time', pr: PR * K, n: 60, tag: aa ? 'msaa' : 'no msaa' }, { do: 'time', pr: PR, n: 60, tag: aa ? 'msaa' : 'no msaa' }], { attr: { antialias: aa } });
        r.push({ aa, m });
      }
      results[spot] = r;
    }
    if (MODE === 'eval') { const m = await page(port, spot, [{ do: 'eval', pr: PR, js: fs.readFileSync(arg('js'), 'utf8') }]); console.log(JSON.stringify(m.find(o => 'eval' in o)?.eval, null, 1)); }
    if (MODE === 'waste') {
      const m = await page(port, spot, [{ do: 'idpass', pr: 1 }]), o = m.find(x => x.idpass);
      if (o) {
        console.log(`  ${o.w}x${o.h}, ${o.drawn} draws, ${o.trisAll} triangles, sky or empty ${o.background} % of the pixels`);
        console.log('  ' + 'name | material'.padEnd(62) + 'draws  hit     tris  verts shaded  px %');
        for (const r of o.idpass.slice(0, +arg('top', 45))) console.log('  ' + r.key.padEnd(62) + String(r.draws).padStart(5) + String(r.drawsHit).padStart(5) + String(r.tris).padStart(9) + String(r.shaded).padStart(9) + (r.indexed ? ' i' : ' n') + String(r.pxPct).padStart(7));
      }
    }
    if (MODE === 'diff') {
      for (const t of String(arg('times', '12,18.5,23')).split(',')) {
        const m = await page(port, spot, String(arg('v', 'gate')).split(',').map(v => ({ do: 'diff', v, shots: !!OUT, pr: PR })), { q: `time=${t}` });
        for (const o of m.filter(x => x.diff)) {
          console.log(`  ${spot} ${t} h ${o.diff}: over 1 of 255 ${o.over1} %, over 4 ${o.over4} %, over 8 ${o.over8} %, over 32 ${o.over32} %, largest ${o.max}`);
          if (OUT && o.ja) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${spot}-${t}-${o.diff}-a.jpg`), Buffer.from(o.ja.split(',')[1], 'base64')); fs.writeFileSync(path.join(OUT, `${spot}-${t}-${o.diff}-b.jpg`), Buffer.from(o.jb.split(',')[1], 'base64')); }
        }
      }
    }
    if (MODE === 'shots') {
      fs.mkdirSync(OUT, { recursive: true });
      for (const t of String(arg('times', '12,20')).split(',')) {
        const m = await page(port, spot, [{ do: 'shot', spr: PR }], { q: `time=${t}` });
        const s = m.find(o => o.shot); if (s) { const f = path.join(OUT, `${spot}-${t}${arg('tag', '') ? '-' + arg('tag') : ''}.jpg`); fs.writeFileSync(f, Buffer.from(s.shot.split(',')[1], 'base64')); console.log('  ' + f); }
      }
    }
  }
} finally { srv.close(); }
if (MODE === 'census') for (const [spot, m] of Object.entries(results)) { const c = m.find(o => o.census)?.census; if (!c) continue; console.log(spot, JSON.stringify(c.tot), 'GL calls', JSON.stringify(c.gl)); for (const r of c.rows.slice(0, +arg('top', 40))) console.log('  ' + String(r[0]).padEnd(44) + String(r[1]).padStart(5) + String(r[2]).padStart(10) + '  ' + r[3]); }
if (arg('json', '')) fs.writeFileSync(arg('json'), JSON.stringify(results, null, 1));
