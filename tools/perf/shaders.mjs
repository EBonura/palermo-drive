// Which shader programs compile after the loading screen lifts? (docs/PERF.md, "Shader programs compiled during play")
//   tools/release/withbrowser.sh node tools/perf/shaders.mjs --root <dist> [--only base,night,title,garage,events] [--out ~/.cache/palermo-drive/shaders] [--secs 6] [--phone] [--q warm=off] [--spots qc,regione] [--pre] [--loadtime 5 [--cpu 4]]
// Hooks linkProgram on the GL context, so every program made after the loading screen lifts is logged whatever asks for it (it works without ?debug, on the title screen too): the time since the lift, what the player was doing
// (the scenario's phase), the program's SHADER_NAME and, as the defines that differ from the nearest earlier program of the same name, what made it a new one (a light count, fog, a define, the shadow receive, a texture slot).
// With ?debug (window.game) the material and the first object that draws with it are found a frame later (renderer.properties.get(material).currentProgram.program), so the cause is named.
// Scenarios, each its own page load (so each starts from the programs the loading screen made):
//   base    ?debug (which starts in play): a drive, the bench's SPOTS (src/bench.js), the clock round 24 hours without ?time (so dusk is crossed for real), horn, NOS, reverse, drinks
//   night   ?time=22 from the title: Drive > start > a drive through three places
//   title   the title for a while, then Drive > the start picker > start (the start of play)
//   garage  title > Garage > through its tabs > back > play > Garage again
//   events  one of each kind of mission (?event=<id>&auto), the ids read from window.__missions
// A program linked inside renderer.compile (src/warm.js links a tile's or a mission's programs when it joins the scene) is marked AHEAD: it was issued before the first draw; the rest AT DRAW, which is where a frame stalls.
// Prints per scenario the programs found after the lift (those made while loading are only counted) and the union. Exit code 1 when any program was linked at a draw after the lift.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..');
const puppeteer = createRequire(path.join(REPO, 'tools/build/package.json'))('puppeteer-core');
const { startServer } = await import(path.join(REPO, 'tools/build/serve.mjs'));
const arg = (k, d) => { const A = process.argv, i = A.indexOf('--' + k); if (i < 0) return d; return A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true; };
const OUT = path.resolve(arg('out', path.join(os.homedir(), '.cache/palermo-drive/shaders'))), SECS = +arg('secs', 6), ONLY = arg('only', '') ? String(arg('only')).split(',') : null, PHONE = !!arg('phone', false);
const ONLYSPOTS = arg('spots', '') ? String(arg('spots')).split(',') : null;
const EXTRA = arg('q', '');   // added to every address, e.g. --q warm=off for the build without src/warm.js
const wait = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const { server, port } = await startServer(path.resolve(arg('root', path.join(REPO, 'dist'))), '');
const browser = await puppeteer.launch({ executablePath: process.env.PD_CHROME, headless: 'new', protocolTimeout: 600000, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu'] });
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540, ll = (lat, lon) => [+((lon - LON0) * KX).toFixed(1), +(-(lat - LAT0) * KZ).toFixed(1)];
const SPOTS = [['qc', 15, 5], ['mondello', -3033.1, -10177.4], ['monreale', -6125, 3752], ['regione', ...ll(38.090479, 13.343314)], ['castiglia', -2019, 18], ['ballaro', 24.9, 488.6], ['vucciria', 210, -182]];   // src/bench.js SPOTS

// in the page, before it runs: the watcher
function install() {
  const W = window.__sh = { log: [], all: [], pend: [], phase: 'load', t0: 0, lifted: false, nLoad: 0, inCompile: 0, wrapped: false };
  const P = WebGL2RenderingContext.prototype, link = P.linkProgram;
  const src = (gl, p) => { let s = ''; try { for (const sh of gl.getAttachedShaders(p)) s += gl.getShaderSource(sh) + '\n'; } catch (e) { /* lost */ } return s; };
  const diffKey = e => {
    let best = null, bd = 1e9;
    for (const q of W.all) { if (q === e || q.name !== e.name) continue; let d = 0; for (const k of e.defs) if (!q.defs.has(k)) d++; for (const k of q.defs) if (!e.defs.has(k)) d++; if (d < bd) { bd = d; best = q; } }
    if (!best) return 'first of its name';
    const plus = [...e.defs].filter(k => !best.defs.has(k)), minus = [...best.defs].filter(k => !e.defs.has(k));
    const out = (plus.length ? '+ ' + plus.slice(0, 10).join(' ') : '') + (minus.length ? '  - ' + minus.slice(0, 10).join(' ') : '');
    if (out) return out;
    const A = new Set(e.src.split('\n').map(l => l.trim())), B = new Set(best.src.split('\n').map(l => l.trim())), pl = [...A].filter(l => l && !B.has(l)), mi = [...B].filter(l => l && !A.has(l));
    return 'source lines: ' + (pl.slice(0, 3).map(l => '+ ' + l.slice(0, 60)).join(' | ') + ' ' + mi.slice(0, 3).map(l => '- ' + l.slice(0, 60)).join(' | ')).trim() || '(identical source: a different uniform or program key only)';
  };
  P.linkProgram = function (p) {
    const r = link.call(this, p);
    try {
      if (!W.lifted && !document.getElementById('loading')) { W.lifted = true; W.t0 = performance.now(); W.nLoad = W.all.length; }
      const s = src(this, p), name = ((s.match(/#define SHADER_TYPE (\S+)/) || [0, ''])[1] + ' ' + ((s.match(/#define SHADER_NAME (\S+)/) || [0, ''])[1])).trim() || '?', defs = new Set();
      for (const m of s.matchAll(/^#define (\w+)(?: (\S+))?/gm)) if (!/^(SHADER_NAME|GL_ES|HIGH_PRECISION)$/.test(m[1])) defs.add(m[2] && m[2].length < 12 ? m[1] + '=' + m[2] : m[1]);
      const e = { name, defs, src: s, gl: p, ahead: W.inCompile > 0 || !!(window.__pdWarm && window.__pdWarm.busy > 0), phase: W.phase, t: W.lifted ? +((performance.now() - W.t0) / 1000).toFixed(2) : -1 };
      e.key = diffKey(e); W.all.push(e);
      if (!W.lifted) e.t = -1;
      if (W.lifted) { W.log.push(e); W.pend.push([e, 0]); }
    } catch (err) { /* the hook must not break the page */ }
    return r;
  };
  const who = (G, e) => {
    const R = G.renderer, roots = [G.scene]; if (G.garage && G.garage.scene) roots.push(G.garage.scene);
    for (const root of roots) {
      let hit = null;
      root.traverse(o => {
        if (hit || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const pr = R.properties.get(m); if (pr && pr.currentProgram && pr.currentProgram.program === e.gl) { const chain = []; for (let c = o, n = 0; c && n < 4; c = c.parent, n++) chain.push((c.name || c.type) + (c.visible ? '' : '(hidden)')); const wm = G.warm, ws = wm && wm.seen.get(m); hit = { prep: !wm ? 'warm off' : ws ? 'prepared as kind ' + [...ws].join('/') + ', drawn as ' + wm.kind(o) : 'never prepared (drawn as kind ' + wm.kind(o) + ')', mat: `${m.type}${m.name ? ' "' + m.name + '"' : ''}${m.transparent ? ' transparent' : ''}${m.alphaTest ? ' cutout' : ''}${m.map ? ' map' : ''}${m.vertexColors ? ' vcol' : ''}${o.isInstancedMesh ? ' instanced' : ''}${o.isSkinnedMesh ? ' skinned' : ''}`, obj: chain.join(' < ') + ` @${Math.round(o.matrixWorld.elements[12])},${Math.round(o.matrixWorld.elements[14])} ${o.geometry ? (o.geometry.attributes.position ? o.geometry.attributes.position.count : 0) + ' verts' : ''}`, inGarage: root !== G.scene }; return; }
        }
      });
      if (hit) return hit;
    }
    return null;
  };
  // the cacheKey of three's program (renderer.info.programs) against the nearest one of the same kind: which tokens differ (index in the key, then the values; see getProgramCacheKey in three's WebGLPrograms.js), when ?debug lets us see them
  const keyDiff = (G, e) => {
    const list = G.renderer.info.programs, me = list.find(p => p.program === e.gl); if (!me) return '';
    const a = String(me.cacheKey).split(','); let best = null, bd = 1e9;
    for (const q of list) { if (q === me || q.type !== me.type) continue; const b = String(q.cacheKey).split(','); let d = Math.abs(a.length - b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++; if (d < bd) { bd = d; best = b; } }
    if (!best) return '';
    const out = []; for (let i = 0; i < a.length; i++) if (a[i] !== best[i]) out.push(`#${i} ${String(best[i]).slice(0, 18)}>${String(a[i]).slice(0, 18)}`);
    return out.slice(0, 8).join('  ');
  };
  const tick = () => {
    requestAnimationFrame(tick);
    if (!W.liftAt && document.body && !document.getElementById('loading') && document.querySelector('canvas')) W.liftAt = performance.now();   // the first frame without the loading screen
    const G = window.game; if (!G || !G.renderer) return;
    if (!W.wrapped) { W.wrapped = true; const c = G.renderer.compile; G.renderer.compile = function (...a) { W.inCompile++; try { return c.apply(this, a); } finally { W.inCompile--; } }; }   // a program linked inside renderer.compile is linked ahead of its first draw
    if (!W.pend.length) return;
    W.pend = W.pend.filter(x => { const w = who(G, x[0]); if (w) { Object.assign(x[0], w); x[0].kd = keyDiff(G, x[0]); return false; } return ++x[1] < 6; });
  };
  requestAnimationFrame(tick);
}

async function open(q) {
  const page = await browser.newPage(), errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.setViewport(PHONE ? { width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(install);
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?help=0&p2p=off&${q}${EXTRA && '&' + EXTRA}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__sh && !!document.querySelector('canvas') && !document.getElementById('loading'), { timeout: 300000, polling: 200 });
  const load = (Date.now() - t0) / 1000;
  await page.evaluate(() => { const W = window.__sh; if (!W.lifted) { W.lifted = true; W.t0 = performance.now(); W.nLoad = W.all.length; } });
  return { page, errs, load };
}
const phase = (page, name) => page.evaluate(n => { window.__sh.phase = n; }, name);
const drive = async (page, secs, keys = ['KeyW']) => { for (const k of keys) await page.keyboard.down(k); await wait(secs * 1000); for (const k of keys) await page.keyboard.up(k); };
const settle = async page => { await page.waitForFunction(() => window.game.world.visiblePending() === 0, { timeout: 40000, polling: 250 }).catch(() => {}); await wait(800); };
async function teleport(page, x, z) {
  await page.evaluate((x, z) => new Promise(res => { const G = window.game, k = setTimeout(res, 12000); try { G.placeAt(x, z); } catch (e) { /* no road yet */ } G.world.teleport(x, z, () => { clearTimeout(k); try { G.placeAt(x, z); } catch (e) { /* */ } res(); }); }), x, z);
  await settle(page);
}
const hour = (page, h) => page.evaluate(h => dispatchEvent(new CustomEvent('pd-time-hour', { detail: h })), h);
const click = (page, sel) => page.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
// title > Drive > the start picker > start
async function driveFromTitle(page) {
  await phase(page, 'title: Drive'); await click(page, '[data-do="drive"]'); await wait(2500);
  await phase(page, 'start picker'); await wait(2500);
  await phase(page, 'start of play'); const ok = await click(page, '[data-do="mapgo"]'); if (!ok) console.log('  (no start button found)');
  await wait(4000);
}

const SCEN = {
  async base(page) {
    await phase(page, 'start of play'); await wait(2500);
    await phase(page, 'first drive'); await drive(page, SECS);
    for (const [id, x, z] of SPOTS.filter(s => !ONLYSPOTS || ONLYSPOTS.includes(s[0]))) { await phase(page, 'spot ' + id); await teleport(page, x, z); await drive(page, SECS); }
    await teleport(page, 15, 5);
    if (!ONLYSPOTS) for (const h of [17, 18.5, 19.5, 20.5, 22, 3, 5.5, 6.5, 8, 12]) { await phase(page, 'clock ' + h); await hour(page, h); await drive(page, SECS); }
    await phase(page, 'horn'); await drive(page, 2, ['KeyW', 'KeyH']);
    await phase(page, 'NOS'); await drive(page, 4, ['KeyW', 'ShiftLeft']);
    await phase(page, 'brake and reverse'); await drive(page, 3, ['KeyS']);
    await phase(page, 'night, NOS'); await hour(page, 22.5); await drive(page, 3, ['KeyW', 'ShiftLeft']);
    await phase(page, 'drunk 3'); await page.evaluate(() => window.game.drunk.setUnits(3)); await drive(page, SECS);
    await phase(page, 'drunk 6'); await page.evaluate(() => window.game.drunk.setUnits(6)); await drive(page, SECS);
    await phase(page, 'sober'); await page.evaluate(() => window.game.drunk.setUnits(0)); await drive(page, SECS);
    await phase(page, 'end'); await drive(page, SECS);
  },
  async night(page) {
    await phase(page, 'title'); await wait(4000);
    await driveFromTitle(page);
    await phase(page, 'drive'); await drive(page, SECS * 2);
  },
  async title(page) {
    await phase(page, 'title'); await wait(8000);
    await driveFromTitle(page);
    await phase(page, 'drive'); await drive(page, SECS);
  },
  async garage(page) {
    await phase(page, 'title'); await wait(3000);
    await phase(page, 'garage open'); await click(page, '[data-do="garage"]:not([hidden])'); await wait(6000);
    await phase(page, 'garage tabs');
    for (const b of await page.$$('button[data-cat], .pd-gtab, [role="tab"]')) { await b.click().catch(() => {}); await wait(700); }
    await phase(page, 'garage close'); await click(page, '[data-do="back"]'); await wait(4000);
    await driveFromTitle(page);
    await phase(page, 'drive'); await drive(page, SECS);
    await phase(page, 'garage from play'); await page.keyboard.press('Escape'); await wait(1500); await click(page, '[data-do="garage"]'); await wait(5000);
  },
};

// --loadtime N: the time from the start of the page to the loading screen lifting, N loads each of ?warm=off and the default, alternating (the page's own clock), at --cpu x slowdown
if (arg('loadtime', false)) {
  const N = +arg('loadtime', 5), CPU = +arg('cpu', 1), R = { off: [], on: [] };
  for (let i = 0; i < N; i++) for (const [tag, q] of i % 2 ? [['on', ''], ['off', 'warm=off']] : [['off', 'warm=off'], ['on', '']]) {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 }); await page.evaluateOnNewDocument(install);
    if (CPU > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.goto(`http://127.0.0.1:${port}/?help=0&p2p=off&${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__sh && window.__sh.liftAt, { timeout: 600000, polling: 200 });
    const r = await page.evaluate(() => ({ lift: window.__sh.liftAt / 1000, programs: window.__sh.all.length, warm: window.__pdWarm ? window.__pdWarm.ms : 0 }));
    R[tag].push(r); console.log(`${tag.padEnd(3)} load ${i + 1}: lifted at ${r.lift.toFixed(2)} s, ${r.programs} programs${tag === 'on' ? ', warm.js spent ' + r.warm.toFixed(0) + ' ms in prepare' : ''}`);
    await page.close();
  }
  const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log(`median lift: off ${med(R.off.map(r => r.lift)).toFixed(2)} s, on ${med(R.on.map(r => r.lift)).toFixed(2)} s (cpu x${CPU}); programs off ${med(R.off.map(r => r.programs))}, on ${med(R.on.map(r => r.programs))}`);
  await browser.close(); server.close(); process.exit(0);
}
const results = {};
let any = 0;
const runOne = async (name, q, fn, ctx = {}) => {
  const { page, errs, load } = await open(q);
  const nLoad = await page.evaluate(() => window.__sh.nLoad);
  await fn(page, ctx);
  const log = await page.evaluate(() => window.__sh.log.map(e => ({ t: e.t, phase: e.phase, name: e.name, key: e.key, mat: (e.mat || '?') + (e.prep ? ' [' + e.prep + ']' : ''), obj: e.obj || 'not found (a post pass, a one-off render, or already gone)', inGarage: e.inGarage, ahead: e.ahead, kd: e.kd }))), total = await page.evaluate(() => window.__sh.all.length);
  if (arg('pre', false)) { const pre = await page.evaluate(() => window.__sh.all.filter(e => e.t < 0).map(e => (e.ahead ? 'ahead ' : 'draw  ') + e.name + '  ' + e.key)); console.log(`  made before the lift (${pre.length}):\n    ` + pre.join('\n    ')); }
  await page.close();
  results[name] = { log, nLoad, total, load, errs };
  console.log(`\n=== ${name} (${q}): ${nLoad} programs by the lift (page ready after ${load.toFixed(1)} s), ${log.length} new after it, ${total} in all${errs.length ? ', ERRORS ' + errs.join(' | ') : ''}`);
  for (const e of log) console.log(`  +${String(e.t).padStart(6)} s  [${e.phase}]  ${e.ahead ? 'AHEAD ' : 'AT DRAW '} ${e.name}  ${e.mat}  on ${e.obj}${e.inGarage ? ' (Garage)' : ''}\n      ${e.key}${e.kd ? '\n      cacheKey vs nearest: ' + e.kd : ''}`);
  any += log.filter(e => !e.ahead).length;
  console.log(`  ${log.filter(e => e.ahead).length} linked ahead of their first draw (inside renderer.compile), ${log.filter(e => !e.ahead).length} at the first draw`);
};
const want = n => !ONLY || ONLY.includes(n);
if (want('base')) await runOne('base', 'debug', SCEN.base);
if (want('night')) await runOne('night', 'time=22', SCEN.night);
if (want('title')) await runOne('title', '', SCEN.title);
if (want('garage')) await runOne('garage', '', SCEN.garage);
if (want('events')) {
  const probe = await open('debug'); const kinds = await probe.page.evaluate(() => { const M = window.__missions; return M && M.slots ? M.slots.map(s => [s.id, s.kind]) : []; }); await probe.page.close();
  const seen = new Set(), pick = arg('ev', '') ? kinds.filter(([id]) => String(arg('ev')).split(',').includes(id)) : kinds.filter(([id, kind]) => !seen.has(kind) && seen.add(kind));   // --ev dump:bellolampo for some events only
  console.log('event kinds:', pick.map(p => p.join('=')).join(' '));
  for (const [id, kind] of pick) await runOne('event ' + id, `debug&time=${kind === 'race' ? 22 : 13}&event=${encodeURIComponent(id)}&auto`, async page => { await phase(page, 'event ' + id); await wait(14000); await drive(page, 6); });
}
const uni = new Map();
for (const [n, r] of Object.entries(results)) for (const e of r.log) { const k = e.name + ' | ' + e.key; if (!uni.has(k)) uni.set(k, { ...e, in: [] }); uni.get(k).in.push(`${n}:${e.phase}`); }
console.log(`\n=== union by name and key: ${uni.size}`);
for (const [k, e] of uni) console.log(`  ${e.name}  ${e.mat}  on ${e.obj}\n      ${e.key}\n      seen in ${[...new Set(e.in)].slice(0, 5).join(', ')}`);
fs.writeFileSync(path.join(OUT, 'shaders.json'), JSON.stringify(results, null, 1));
await browser.close(); server.close();
process.exit(any ? 1 : 0);
