// Runs on the AWS Device Farm test host, beside one real phone (tools/devicefarm/run.sh sends it there). It opens the game's own ?bench (src/bench.js: the phone
// measures itself) in the phone's browser through the Appium server the host has started, waits for it to finish and keeps what it measured in the run's
// artifacts ($DEVICEFARM_LOG_DIR): the JSON, the text of the result pages, a picture, and the GPU's name as soon as the page is up (in case the run dies later).
// Then, on the same phone, the lost GL context (ctxTest below): the browser sent to the background and brought back, and the context taken away on purpose, with what the game did each time.
// With mode.txt saying glrec (run.sh writes it from PD_MODE) it does neither and runs the recorder instead (glrecTest below): what the game asks of the GPU while it loads, for a phone whose GPU process dies.
// No dependencies: plain WebDriver calls with the fetch of the host's Node. PD_URL changes the address (a test), PD_MAX_MIN the patience. The run is given 8 minutes (bt=480) instead of the page's own 5, so a slow phone still gets its readings by night.
const fs = require('fs'), path = require('path');
const BASE = 'http://127.0.0.1:4723' + (process.env.APPIUM_BASE_PATH || ''), OUT = process.env.DEVICEFARM_LOG_DIR || '.';
const URL_ = process.env.PD_URL || 'https://palermo-drive.it/?help=0&bench=new&bt=480', MAX_MS = (+process.env.PD_MAX_MIN || 17) * 60000;
const NAME = (process.env.DEVICEFARM_DEVICE_NAME || 'device').replace(/[^A-Za-z0-9]+/g, '-'), sleep = ms => new Promise(r => setTimeout(r, ms));
const keep = (file, data) => fs.writeFileSync(path.join(OUT, `pd-${NAME}-${file}`), data);
async function wd(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${JSON.stringify(j.value && j.value.message || j).slice(0, 300)}`);
  return j.value;
}
// The lost GL context, the two ways a player meets it. 1: the browser goes to the background for a while and comes back (phones may take the context then; Mali ones do in the play log).
// 2: the context is taken away with the page in view, as a phone short of memory does, and given back. After each: did the events fire, is the game drawing again, how fast, is the
// "graphics stopped" card up, and a picture of the screen to look at. PD_CTX=0 leaves it out.
const CTX_URL = process.env.PD_CTX_URL || 'https://palermo-drive.it/?debug&play&help=0&p2p=off&radio=off&cloud=off';
async function ctxTest(S, js, out) {
  const shot = async n => { const p = await wd('GET', S + '/screenshot').catch(() => null); if (p) keep(`ctx-${n}.png`, Buffer.from(p, 'base64')); };
  const state = label => js(`var g = window.game, c = window.__ctx, R = g.renderer, n0 = c.frames, t0 = performance.now(), done = arguments[arguments.length - 1];
    setTimeout(function () { var card = [].slice.call(document.querySelectorAll('[role=alert]')).some(function (e) { return /Reload|Ricarica/.test(e.textContent); });
      done({ lost: c.lost, back: c.back, hid: c.hid, log: c.log.slice(-8), fps: Math.round((c.frames - n0) / ((performance.now() - t0) / 1000) * 10) / 10, calls: R.info.render.calls, tris: R.info.render.triangles,
        isLost: R.getContext().isContextLost(), pending: g.world && g.world.visiblePending ? g.world.visiblePending() : null, card: card, hidden: document.hidden }); }, 3000);`, [], true)
    .then(v => { out[label] = v; console.log('ctx', label, JSON.stringify(v)); return v; }).catch(e => { out[label] = { error: e.message.slice(0, 200) }; console.log('ctx', label, 'FAILED', e.message.slice(0, 200)); return null; });
  await wd('POST', S + '/url', { url: CTX_URL });
  let ready = false; for (let i = 0; i < 40 && !ready; i++) { await sleep(3000); ready = await js("return !!(window.game && window.game.renderer && !document.getElementById('loading'));").catch(() => false); }
  if (!ready) { out.na = 'the game did not finish loading'; return; }
  await js(`var c = window.__ctx = { lost: 0, back: 0, hid: 0, frames: 0, log: [] }, cv = window.game.renderer.domElement, t0 = performance.now(), at = function () { return Math.round((performance.now() - t0) / 100) / 10; };
    cv.addEventListener('webglcontextlost', function () { c.lost++; c.log.push([at(), 'lost', document.hidden ? 'hidden' : 'in view']); });
    cv.addEventListener('webglcontextrestored', function () { c.back++; c.log.push([at(), 'restored', document.hidden ? 'hidden' : 'in view']); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) c.hid++; c.log.push([at(), document.hidden ? 'page hidden' : 'page shown', '']); });
    (function f() { c.frames++; requestAnimationFrame(f); })(); return true;`);
  await sleep(4000); await state('before'); await shot('1-before');
  // 1. to the background for 20 seconds and back
  const bg = await wd('POST', S + '/execute/sync', { script: 'mobile: backgroundApp', args: [{ seconds: 20 }] }).then(() => 'ok').catch(e => e.message.slice(0, 160));
  out.background = bg; console.log('ctx background:', bg);
  await sleep(6000); await state('afterBackground'); await shot('2-after-background');
  // 2. the context taken away in view, given back 1.5 s later; the game may take up to 15 s to rebuild
  const forced = await js(`var x = window.game.renderer.getContext().getExtension('WEBGL_lose_context'); if (!x) return 'no WEBGL_lose_context'; x.loseContext(); setTimeout(function () { x.restoreContext(); }, 1500); return 'ok';`).catch(e => e.message.slice(0, 160));
  out.forced = forced; console.log('ctx forced:', forced);
  await sleep(4000); await state('after4s'); await shot('3-after-forced-4s');
  await sleep(16000); await state('after20s'); await shot('4-after-forced-20s');
}
// The recorder (?glrec, src/gl-recorder.js): the game loaded three times from scratch, each time left to load where it starts and then sent to two more places, with the GPU memory it has asked
// for sampled all along. If the context is lost, the summary holds the totals at that moment and the last calls before it.
const GLREC_URL = process.env.PD_GLREC_URL || 'https://palermo-drive.it/?debug&play&help=0&p2p=off&radio=off&cloud=off&glrec';
let MODE_NOW = 'bench';
async function glrecTest(S, js) {
  const brief = () => js("var r = window.__glrec && window.__glrec.summary(0); return r ? { t: r.t, tex: r.texMB, buf: r.bufMB, rb: r.rbMB, up: r.upMB, texN: r.texN, programs: r.programs, lost: r.lost.length, loading: !!document.getElementById('loading') } : null;").catch(e => ({ error: e.message.slice(0, 120) }));
  const watch = async (label, secs) => { for (let i = 0; i < secs / 5; i++) { await sleep(5000); const b = await brief(); console.log('glrec', label, JSON.stringify(b)); if (b && b.lost >= 3) return; } };
  // mode.txt "glrec-atlas": the same loads by turns with the wall atlas as shipped and at half size (?atlast=128), small first, to see whether a phone that dies after the atlas stops dying
  // mode.txt "glrec-arms:a,b,c": the same loads by turns with each test switch of src/buildings.js (?tb=...; "shipped" is the game as it is), three rounds, the first place only: which one stops the crashes
  const ARMS = /^glrec-arms:/.test(MODE_NOW) ? MODE_NOW.split(':')[1].split(',').filter(Boolean) : null;
  const AB = MODE_NOW === 'glrec-atlas', N = ARMS ? ARMS.length * 3 : AB ? 6 : (+process.env.PD_GLREC_PASSES || 3);
  for (let pass = 1; pass <= N; pass++) {
    const arm = ARMS ? ARMS[(pass - 1) % ARMS.length] : '', small = AB && pass % 2 === 1, url = GLREC_URL + (small ? '&atlast=128' : '') + (arm && arm !== 'shipped' ? '&tb=' + arm : '');
    console.log('glrec pass', pass, ARMS ? 'ARM ' + arm : AB ? (small ? 'SMALL atlas' : 'atlas as shipped') : '');
    await wd('POST', S + '/url', { url: 'about:blank' }).catch(() => {}); await sleep(1500);
    await wd('POST', S + '/url', { url });
    await wd('POST', S + '/orientation', { orientation: 'LANDSCAPE' }).catch(() => {});
    await watch(`pass ${pass}, loading`, 75);
    for (const [name, x, z] of ARMS ? [] : [['Mondello', -3033, -10177], ['Ballaro', 150, 560]]) {
      await js("var g = window.game; if (g && g.world) { try { g.placeAt(arguments[0], arguments[1]); } catch (e) {} g.world.teleport(arguments[0], arguments[1], function () { try { g.placeAt(arguments[0], arguments[1]); } catch (e) {} }); } return true;", [x, z]).catch(e => console.log('glrec teleport:', e.message.slice(0, 120)));
      await watch(`pass ${pass}, ${name}`, 35);
    }
    const sum = await js('return window.__glrec ? window.__glrec.summary(80) : null;').catch(e => ({ error: e.message.slice(0, 200) }));
    if (sum && !sum.error) { sum.atlas = small ? 'small' : 'shipped'; sum.arm = arm; sum.draw = await js('var R = window.game && window.game.renderer; return R ? { calls: R.info.render.calls, tris: R.info.render.triangles } : null;').catch(() => null); }
    keep(`glrec-${pass}.json`, JSON.stringify(sum));
    const p = await wd('GET', S + '/screenshot').catch(() => null); if (p) keep(`glrec-${pass}.png`, Buffer.from(p, 'base64'));
    console.log('glrec pass', pass, 'done:', sum && !sum.error ? `${sum.lost.length} lost, peak ${JSON.stringify(sum.peakMB)}, uploaded ${sum.upMB} MB, ${sum.programs} programs (compile ${sum.compileMs} ms, link ${sum.linkMs} ms)` : JSON.stringify(sum));
  }
}
(async () => {
  const t0 = Date.now(), s = await wd('POST', '/session', { capabilities: { alwaysMatch: { 'appium:newCommandTimeout': 1500 }, firstMatch: [{}] } }), id = s.sessionId, S = '/session/' + id;
  const js = (script, args = [], wait) => wd('POST', S + (wait ? '/execute/async' : '/execute/sync'), { script, args });   // wait: the script answers through its last argument when it is done
  let code = 1;
  let MODE = 'bench'; try { MODE = fs.readFileSync(path.join(__dirname, 'mode.txt'), 'utf8').trim() || 'bench'; } catch (e) { /* no file: the bench */ }
  MODE_NOW = MODE;
  if (/^glrec/.test(MODE)) {
    try { console.log('session', JSON.stringify(s.capabilities || {}).slice(0, 300)); await wd('POST', S + '/timeouts', { script: 30000, pageLoad: 180000 }).catch(() => {}); await glrecTest(S, js); code = 0; } catch (e) { console.log('glrec FAILED', e.message); keep('error.txt', String(e.stack || e) + '\n'); }
    await wd('DELETE', S).catch(() => {}); process.exit(code);
  }
  try {
    console.log('session', JSON.stringify(s.capabilities || {}).slice(0, 400));
    await wd('POST', S + '/timeouts', { script: 30000, pageLoad: 180000 }).catch(e => console.log('timeouts:', e.message));
    await wd('POST', S + '/orientation', { orientation: 'LANDSCAPE' }).catch(e => console.log('orientation:', e.message));   // the bench waits while the phone is upright
    await wd('POST', S + '/url', { url: URL_ });
    const who = await js(`var c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'), x = g && g.getExtension('WEBGL_debug_renderer_info');
      return { gpu: g ? String(x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'no WebGL', ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, mem: navigator.deviceMemory || null, cores: navigator.hardwareConcurrency || null };`).catch(e => ({ error: e.message }));
    console.log('device', JSON.stringify(who)); keep('device.json', JSON.stringify({ name: process.env.DEVICEFARM_DEVICE_NAME, os: process.env.DEVICEFARM_DEVICE_OS_VERSION, ...who }, null, 1));
    let last = '', done = false, turned = 0;
    while (Date.now() - t0 < MAX_MS) {
      const q = await js(`var q = window.__pdBench; if (q && q.tap) { q.tap(); q.tap = null; }
        var s = [].slice.call(document.body ? document.body.children : []).map(function (e) { return e.textContent; }).filter(function (t) { return /^BENCH  /.test(t); })[0] || '';
        return { have: !!q, done: !!(q && q.done), strip: s, w: innerWidth, h: innerHeight };`).catch(e => ({ error: e.message }));
      if (q.error) console.log('poll:', q.error.slice(0, 200));
      else {
        if (q.strip !== last) console.log(Math.round((Date.now() - t0) / 1000) + ' s', (last = q.strip) || '(no bench line)', q.w + 'x' + q.h);
        if (/turn the phone/.test(q.strip) && turned++ % 6 === 0) await wd('POST', S + '/orientation', { orientation: 'LANDSCAPE' }).catch(e => console.log('orientation:', e.message));
        if (q.done) { done = true; break; }
      }
      await sleep(5000);
    }
    const shot = await wd('GET', S + '/screenshot').catch(() => null); if (shot) keep('screen.png', Buffer.from(shot, 'base64'));
    if (!done) { console.log('NOT FINISHED after', Math.round((Date.now() - t0) / 60000), 'minutes; last line:', last); keep('unfinished.txt', last + '\n'); }
    else {
      const out = await js('var b = window.__pdBench; return { texts: b.text(), json: JSON.stringify(b.res) };');
      keep('bench.json', out.json); keep('bench.txt', [].concat(out.texts).join('\n\n') + '\n');
      console.log([].concat(out.texts).join('\n\n')); console.log('finished in', Math.round((Date.now() - t0) / 1000), 's'); code = 0;
    }
  } catch (e) { console.log('FAILED', e.message); keep('error.txt', String(e.stack || e) + '\n'); }
  if (process.env.PD_CTX !== '0') { const out = {}; try { await ctxTest(S, js, out); } catch (e) { out.error = String(e.message || e).slice(0, 300); console.log('ctx FAILED', out.error); } keep('ctx.json', JSON.stringify(out, null, 1)); }
  await wd('DELETE', S).catch(() => {});
  process.exit(code);
})();
