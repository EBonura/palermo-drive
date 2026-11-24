// Runs on the AWS Device Farm test host, beside one real phone (tools/devicefarm/run.sh sends it there). It opens the game's own ?bench (src/bench.js: the phone
// measures itself) in the phone's browser through the Appium server the host has started, waits for it to finish and keeps what it measured in the run's
// artifacts ($DEVICEFARM_LOG_DIR): the JSON, the text of the result pages, a picture, and the GPU's name as soon as the page is up (in case the run dies later).
// No dependencies: plain WebDriver calls with the fetch of the host's Node. PD_URL changes the address (a test), PD_MAX_MIN the patience.
const fs = require('fs'), path = require('path');
const BASE = 'http://127.0.0.1:4723' + (process.env.APPIUM_BASE_PATH || ''), OUT = process.env.DEVICEFARM_LOG_DIR || '.';
const URL_ = process.env.PD_URL || 'https://palermo-drive.it/?help=0&bench=new', MAX_MS = (+process.env.PD_MAX_MIN || 14) * 60000;
const NAME = (process.env.DEVICEFARM_DEVICE_NAME || 'device').replace(/[^A-Za-z0-9]+/g, '-'), sleep = ms => new Promise(r => setTimeout(r, ms));
const keep = (file, data) => fs.writeFileSync(path.join(OUT, `pd-${NAME}-${file}`), data);
async function wd(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${JSON.stringify(j.value && j.value.message || j).slice(0, 300)}`);
  return j.value;
}
(async () => {
  const t0 = Date.now(), s = await wd('POST', '/session', { capabilities: { alwaysMatch: { 'appium:newCommandTimeout': 1500 }, firstMatch: [{}] } }), id = s.sessionId, S = '/session/' + id;
  const js = (script, args = []) => wd('POST', S + '/execute/sync', { script, args });
  let code = 1;
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
  await wd('DELETE', S).catch(() => {});
  process.exit(code);
})();
