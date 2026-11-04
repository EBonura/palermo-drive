// Local test of the play log (src/playlog.js, joinlog/): the service on this machine writing rows to a file instead of BigQuery (JOINLOG_DEV_SINK), a real game build sending to it.
//   cargo build --manifest-path joinlog/Cargo.toml
//   node tools/build/build.mjs --playlog=http://127.0.0.1:18788/e --out=/tmp/dist-playlog
//   /private/tmp/claude-501/withbrowser.sh node tools/build/playlogcheck.mjs --root /tmp/dist-playlog [--http-only]
// The build address is a placeholder: the service here listens on a port of its own and this script points the page at it with the build's own address (18788).
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BIN = path.resolve(HERE, '../../joinlog/target/debug/joinlog');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, more = '') => { if (!ok) fails++; console.log(ok ? 'OK  ' : 'FAIL', name, more); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'joinlog-'));
function service(port, origins, sink, env = {}) {
  const p = spawn(BIN, [], { env: { PATH: process.env.PATH, PORT: String(port), ORIGINS: origins, JOINLOG_DEV_SINK: sink, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.output = () => out;
  return p;
}
function req(port, { method = 'POST', path: pth = '/e', origin, body = '', ip, headers = {} }) {
  return new Promise((resolve, reject) => {
    const h = { ...headers }; if (origin) h.Origin = origin; if (ip) h['X-Forwarded-For'] = ip;
    if (body !== null && method !== 'GET' && method !== 'HEAD') { h['Content-Type'] = 'text/plain;charset=UTF-8'; h['Content-Length'] = Buffer.byteLength(body); }
    const r = http.request({ host: '127.0.0.1', port, method, path: pth, headers: h }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers })); });
    r.on('error', reject); r.end(method === 'GET' || method === 'HEAD' ? undefined : body);
  });
}
const up = async port => { for (let i = 0; i < 50; i++) { if (await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); })) return; await sleep(100); } throw new Error('service did not start on ' + port); };
const rows = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const GOOD = { v: 1, t: 'alive', vid: '0123456789abcdef', d: 'desktop', l: 'it', g: '0.4.dev', s: 60, ps: 50, fps: 58, p1: 30, veh: 'calessino', m: { 'fare:t': [1, 1, 0] } };
const ORIGIN = 'https://ebonura.github.io';

// ---------- the service alone ----------
async function httpTests() {
  const sink = path.join(tmp, 'http.jsonl'), port = 18790;
  const svc = service(port, ORIGIN + ',http://localhost:5555', sink);
  await up(port);
  let n = 0; const ipn = () => `203.0.${113 + (n++ % 100)}.${(n * 7) % 250 + 1}`;   // a fresh /24 each time, so the limits do not interfere
  const post = (body, o = {}) => req(port, { origin: ORIGIN, ip: ipn(), body: typeof body === 'string' ? body : JSON.stringify(body), ...o });

  let r = await post(GOOD); check('a good report is written', r.status === 204 && r.body === '' && rows(sink).length === 1, `${r.status}`);
  const row = rows(sink)[0] || {};
  check('the row has the fixed columns, no address', row.event === 'alive' && row.visit === GOOD.vid && row.missions === 'fare:t=1.1.0' && !JSON.stringify(row).match(/203\.0|127\.0/), JSON.stringify(row));
  r = await post(GOOD, { origin: 'http://localhost:5555' }); check('a localhost origin listed for dev is allowed', r.status === 204, `${r.status}`);
  r = await post(GOOD, { origin: 'https://evil.example' }); check('a wrong origin is refused', r.status === 403, `${r.status}`);
  r = await post(GOOD, { origin: 'https://ebonura.github.io.evil.example' }); check('an origin that only starts like the real one is refused', r.status === 403, `${r.status}`);
  r = await post(GOOD, { origin: 'http://ebonura.github.io' }); check('the right host over http is refused', r.status === 403, `${r.status}`);
  r = await req(port, { ip: ipn(), body: JSON.stringify(GOOD) }); check('no origin is refused', r.status === 403, `${r.status}`);
  for (const [m, p] of [['GET', '/e'], ['GET', '/'], ['HEAD', '/e'], ['OPTIONS', '/e'], ['PUT', '/e'], ['DELETE', '/e'], ['PATCH', '/e'], ['POST', '/'], ['POST', '/e/'], ['GET', '/rows'], ['GET', '/e?select=*'], ['GET', '/admin'], ['GET', '/.env']]) {
    r = await req(port, { method: m, path: p, origin: ORIGIN, ip: ipn(), body: '{}' });
    check(`${m} ${p} is 404 with an empty body`, r.status === 404 && r.body === '', `${r.status}`);
  }
  r = await post('x'.repeat(5000)); check('an oversized body is refused', r.status === 413, `${r.status}`);
  r = await post(JSON.stringify({ ...GOOD, n: 'a'.repeat(3000) })); check('an oversized name in an oversized body is refused', r.status === 413, `${r.status}`);
  r = await post({ ...GOOD, n: 'a'.repeat(100) }); check('an oversized name is refused', r.status === 400, `${r.status}`);
  r = await post({ ...GOOD, n: 'seventeen chars!!' }); check('a 17 character name is refused', r.status === 400, `${r.status}`);
  for (const [what, bad] of [['broken json', '{"v":1'], ['not an object', '[1,2]'], ['an empty body', ''], ['an unknown field', { ...GOOD, ip: '1.2.3.4' }], ['a wrong type', { ...GOOD, s: '60' }], ['a negative number', { ...GOOD, s: -5 }],
    ['an unknown event', { ...GOOD, t: 'ping' }], ['an unknown device', { ...GOOD, d: 'toaster' }], ['a bad visit id', { ...GOOD, vid: 'x' }], ['an out of range fps', { ...GOOD, fps: 5000 }], ['a bad gpu', { ...GOOD, gpu: 'NVIDIA GeForce RTX 4090' }], ['a bad version', { ...GOOD, g: "1.2.3'; --" }],
    ['too many mission ids', { ...GOOD, m: Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['m' + i, [1, 0, 0]])) }]]) {
    r = await post(bad); check(`${what} is refused`, r.status === 400 && r.body === '', `${r.status}`);
  }
  const before = rows(sink).length;
  for (const evil of ["'); DROP TABLE x;--", "' OR '1'='1", '<script>1</script>', '${jndi:ldap}']) {
    r = await post({ ...GOOD, n: evil.slice(0, 16) }); check(`injection text in the name is stored only as text (${evil.slice(0, 12)})`, r.status === 204);
  }
  check('injection rows are plain strings', rows(sink).slice(before).every(x => typeof x.name === 'string'));
  r = await post({ ...GOOD, veh: "x'; DROP" }); check('injection in the vehicle id is refused', r.status === 400);
  r = await post({ ...GOOD, n: 'An​na\u0000 ' }); check('invisible characters are cleaned out of a name', r.status === 204 && rows(sink).at(-1).name === 'Anna', JSON.stringify(rows(sink).at(-1)?.name));
  // rate limits (an empty object is admitted by the limiters and then refused as a bad report, so 400 = let through, 429 = limited, and no table write is involved)
  const adm = (ip, body = '{}') => req(port, { origin: ORIGIN, ip, body }).then(r => r.status);
  const one = '198.18.5.9'; const codes = [];
  for (let i = 0; i < 9; i++) codes.push(await adm(one));
  check('one address: a burst of 6 then refused', codes.filter(c => c === 400).length === 6 && codes.slice(6).every(c => c === 429), codes.join(' '));
  const spoof = []; for (let i = 0; i < 4; i++) spoof.push(await adm(`10.${i}.${i}.${i}, ${one}`));
  check('a forged X-Forwarded-For prefix does not escape the limit (the last entry counts)', spoof.every(c => c === 429), spoof.join(' '));
  const net = []; for (let i = 1; i <= 45; i++) net.push(await adm(`192.0.2.${i}`));
  check('one /24 network: 30 then refused', net.filter(c => c === 400).length === 30 && net.slice(30).every(c => c === 429), net.filter(c => c === 400).length + ' let through');
  check('another /24 is unaffected', (await adm('192.0.3.1')) === 400);
  const v6 = []; for (let i = 0; i < 40; i++) v6.push(await adm(`2001:db8:7:${i.toString(16)}::1`));
  check('one IPv6 /48: 30 then refused', v6.filter(c => c === 400).length === 30, v6.filter(c => c === 400).length + ' let through');
  await sleep(6000);   // the shared write allowance (burst 10, 2 a second) refills
  const burst = []; for (let i = 0; i < 20; i++) burst.push((await post(GOOD)).status);
  const okc = burst.filter(c => c === 204).length;
  check('all players together: a write burst of 10 plus the refill, then refused', okc >= 10 && okc <= 14 && burst.includes(429), okc + ' written, ' + burst.filter(c => c === 429).length + ' refused');
  check('the rate limited calls wrote nothing', rows(sink).filter(x => x.visit === GOOD.vid).length === rows(sink).length);
  svc.kill();

  // the daily row cap, and a restart that must not reset it
  const sink2 = path.join(tmp, 'cap.jsonl'), p2 = 18791;
  let s2 = service(p2, ORIGIN, sink2, { DAILY_ROWS: '3' }); await up(p2);
  const c = []; for (let i = 0; i < 6; i++) c.push((await req(p2, { origin: ORIGIN, ip: `203.0.113.${10 + i * 30}`, body: JSON.stringify(GOOD) })).status);
  check('daily row cap: 3 written, then refused', c.slice(0, 3).every(x => x === 204) && c.slice(3).every(x => x === 429) && rows(sink2).length === 3, c.join(' '));
  s2.kill(); await sleep(200);
  s2 = service(p2, ORIGIN, sink2, { DAILY_ROWS: '3' }); await up(p2);
  r = await req(p2, { origin: ORIGIN, ip: '203.0.113.200', body: JSON.stringify(GOOD) });
  check('a restarted service counts the rows already written today', r.status === 429 && rows(sink2).length === 3, `${r.status}`);
  s2.kill();
  const p3 = 18792, s3 = service(p3, ORIGIN, path.join(tmp, 'reqs.jsonl'), { DAILY_REQS: '5' }); await up(p3);
  const q = []; for (let i = 0; i < 8; i++) q.push((await req(p3, { origin: ORIGIN, ip: `203.0.113.${5 + i * 20}`, body: JSON.stringify(GOOD) })).status);
  check('daily request cap: 5 then refused fast', q.slice(0, 5).every(x => x === 204) && q.slice(5).every(x => x === 429), q.join(' '));
  check('the service printed nothing', s3.output() === '' && svc.output() === '', JSON.stringify(svc.output().slice(0, 100)));
  s3.kill();
}

// ---------- a real game build ----------
async function browserTests(root) {
  const puppeteer = createRequire(path.join(HERE, 'package.json'))('puppeteer-core');
  const { startServer } = await import(path.join(HERE, 'serve.mjs'));
  const { server, port: webPort } = await startServer(path.resolve(root), '');
  const origin = `http://127.0.0.1:${webPort}`;
  const sink = path.join(tmp, 'game.jsonl');
  const svc = service(18788, origin, sink, { ADDR_BURST: '100', ADDR_PER_MIN: '600' });   // the test build reports every 3 s, far faster than a player, so this address gets a wider allowance   // 18788: the address the test build was made with
  await up(18788);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || (process.env.PD_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: 'new', args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
  async function open(store, extra) {
    const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errs = [];
    await page.setViewport({ width: 960, height: 540 });
    await page.evaluateOnNewDocument(s => { Object.defineProperty(document, 'hidden', { get: () => false }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); if (s) localStorage.setItem('palermoDrive.net.v1', s); }, store);
    page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    const reqs = []; page.on('request', r => { if (r.url().includes(':18788')) reqs.push(r.method() + ' ' + r.url()); });
    await page.goto(`${origin}/?help=0&play&debug&plms=3000&gfx=auto&at=137,-212,0${extra}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.game && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
    return { page, errs, ctx, reqs };
  }
  const answer = async (page, txt) => { await page.waitForFunction(() => !!document.querySelector('[role=dialog] input'), { timeout: 30000, polling: 200 }); await page.evaluate(t => [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === t).click(), txt); };   // the name card asks on every page open
  const drive = page => page.evaluate(() => { let n = 0; const t = setInterval(() => { window.game.car.x += 0.5; if (++n > 400) clearInterval(t); }, 20); });   // a car that drives about 200 m
  try {
    // online: the name goes with every report
    const a = await open(JSON.stringify({ name: 'Anna', offline: false }), '&ns=pltest');
    await answer(a.page, 'Gioca online');
    await drive(a.page);
    await sleep(8000);
    let rs = rows(sink);
    check('online player: a join row after a few seconds of driving', rs.length >= 1 && rs[0].event === 'join', JSON.stringify(rs[0]));
    check('online player: the join row has the name, device, language and version', rs[0]?.name === 'Anna' && rs[0].device === 'desktop' && rs[0].lang && rs[0].version, JSON.stringify(rs[0]));
    await a.page.evaluate(() => { dispatchEvent(new CustomEvent('pd-fare', { detail: { amount: 7 } })); dispatchEvent(new Event('pd-busted')); dispatchEvent(new CustomEvent('pd-event-end', { detail: { id: 'fare:test', ok: true } })); dispatchEvent(new CustomEvent('pd-event-end', { detail: { id: 'race:test', ok: false } })); });
    await sleep(5000);
    rs = rows(sink); const al = rs.find(x => x.event === 'alive' && x.cash === 7);
    check('an alive row carries the batch: cash, busts, missions, fps, slowest frames, perf level, gpu family, vehicle', !!al && al.busts === 1 && al.missions === 'fare:test=0.1.0;race:test=0.0.1' && al.fps > 0 && al.fps_slow_ms >= 0 && al.gpu && al.vehicle, JSON.stringify(al));
    check('one request per report, none per event', a.reqs.length === rows(sink).length, `${a.reqs.length} requests, ${rows(sink).length} rows`);
    check('distance is counted (a few metres here)', al && al.dist_m > 0, String(al?.dist_m));
    check('the perf fields are there with Auto graphics', al && al.auto_lvl !== null && [30, 60].includes(al.fps_mode) && al.shadow !== null && al.res_pct > 0, JSON.stringify(al));
    const nBefore = rows(sink).length;
    check('the Options row exists', await a.page.evaluate(() => !!document.querySelector('[data-opt="stats"] .pd-segb[data-v="off"]')));
    await a.page.evaluate(() => document.querySelector('[data-opt="stats"] .pd-segb[data-v="off"]').click());
    check('the off choice is saved with the other settings', await a.page.evaluate(() => JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}').stats === 'off'));
    await sleep(8000);
    check('switched off in Options: nothing more is sent', rows(sink).length === nBefore, `${nBefore} -> ${rows(sink).length}`);
    await a.page.evaluate(() => document.querySelector('[data-opt="stats"] .pd-segb[data-v="on"]').click());
    await sleep(5000);
    check('switched on again: reports resume', rows(sink).length > nBefore);
    const n2 = rows(sink).length;
    await a.page.evaluate(() => dispatchEvent(new Event('pagehide'))); await sleep(1500);
    rs = rows(sink); check('pagehide sends a leave row (sendBeacon)', rs.length === n2 + 1 && rs.at(-1).event === 'leave' && rs.at(-1).secs > 5, JSON.stringify(rs.at(-1)));
    const visits = new Set(rs.map(x => x.visit)); check('one visit id for the whole page load', visits.size === 1, [...visits].join());
    const stored = await a.page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    check('the visit id is not stored anywhere', !stored.includes([...visits][0]));
    check('no console errors (CSP included)', a.errs.length === 0, a.errs.join(' | '));
    await a.ctx.close();

    // solo by choice: stats but no name
    const s0 = rows(sink).length;
    const b = await open(JSON.stringify({ name: 'Bruno', offline: true }), '&ns=pltest2');
    await answer(b.page, 'Gioca da solo');
    await drive(b.page);
    await sleep(7000);
    rs = rows(sink).slice(s0); check('solo player: reports are sent without a name', rs.length >= 1 && rs.every(x => x.name === null), JSON.stringify(rs[0]));
    await b.ctx.close();
    // has not answered the card
    const s1 = rows(sink).length;
    const c = await open(null, '&ns=pltest3');
    await sleep(7000);
    check('a player who never moves: nothing is sent', rows(sink).length === s1, `${rows(sink).length - s1} rows`);
    await drive(c.page);
    await sleep(4000);
    rs = rows(sink).slice(s1); check('a player who has not answered the card: sent without a name', rs.length >= 1 && rs.every(x => x.name === null), JSON.stringify(rs[0]));
    await c.ctx.close();
  } finally { await browser.close(); server.close(); svc.kill(); }
}

try {
  await httpTests();
  if (!process.argv.includes('--http-only')) await browserTests(arg('root'));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
