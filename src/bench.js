// ?bench: the device measures itself (docs/PERF.md, "The phone measures itself"). Open the link, wait, screenshot the two result pages or press Copy. Nothing is sent anywhere.
// A fixed tour of spots with the lapa parked and the chase camera still, by day and by night: animation frames per second and their intervals, the time of the game's own code,
// and the finished frame (from the start of the animation callbacks to the end of a 1-pixel readPixels, when the GPU has finished: the same clock as tools/perf/gpucost.mjs).
// At Quattro Canti, where the game starts, each thing is switched off or changed inside the same page, in blocks that alternate with the page as shipped: the difference is its cost.
// The most telling ones are measured there before the tour; with the time left after it, the rest of the list, and a shorter list at the heaviest of the other spots.
// The whole run aims at four minutes whatever the device: what does not fit is skipped and shown as skipped.
// The switches are the ones of tools/perf/probe.js under the same names (sh0, shpass0, flat, whole, wash0, csh0 ...), so a phone's numbers line up with the Mac's.
// MSAA is a context attribute and cannot change in a page: the run ends with one reload at ?aa=0 that repeats the day's baseline at Quattro Canti and, time allowing, at the heaviest other spot (a measurement, never an option).
// These variants exist only here, to measure; several change the picture. main.js imports this file only for ?bench, and the production build keeps it out of the bundle (tools/build/build.mjs).
// No imports on purpose: everything comes from main.js through runBench(), so the file stands alone next to the bundle.
const KEY = 'palermoDrive.bench.v1', FRESH = 20 * 60000;   // a result younger than this is shown again on a reload instead of a new run (Safari reloads a heavy tab when one comes back from another app)
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;   // src/core.js proj
const ll = (lat, lon) => [+((lon - LON0) * KX).toFixed(1), +(-(lat - LAT0) * KZ).toFixed(1)];
const DAY = 12, NIGHT = 22.5;
const TOTAL = 235000, CORE = 14;   // ms for the whole run, the reload without MSAA included; the first CORE variants of the list are measured before the tour, whatever the device
// The variants in the order of what matters most, so that what a slow device has to skip is the least of it. FULL at Quattro Canti, SHORT at the other spots.
// None of these compiles a program. The ones that do (HEAVY: every program again, 13 s for the 40 of sh0 on an M3 Max in WebKit, far more on a phone) only run when asked for: ?bench&bv=sh0,flat,shade0
const FULL = { day: ['shoff', 'half', 'tiny', 'crowd0', 'build0', 'lean0', 'shpass0', 'shrecv0', 'traffic0', 'props0', 'ground0', 'hud0', 'order0', 'sort', 'transp0', 'clouds0', 'csh0', 'whole', 'balloons', 'rain'], night: ['wash0', 'shoff'] };
const SHORT = { day: FULL.day.slice(0, 14), night: ['wash0'] };
const HEAVY = ['sh0', 'flat', 'shade0', 'lamps0', 'fog0', 'tone0', 'env0', 'mediump', 'alpha0'];
// id, name, x, z, heading (none: the nearest road vertex, as ?at=x,z does). The first, second and fourth are the owner's test links, the rest the spots of tools/perf/gpucost.mjs. In the order they are measured: each is further from the start than the one before.
const SPOTS = [
  ['qc', 'Quattro Canti', 15, 5],
  ['vucciria', 'Vucciria', 210, -182],
  ['ballaro', 'Ballarò', 24.9, 488.6, -2.01],
  ['castiglia', 'Viale L. Castiglia', -2019, 18],
  ['regione', 'Viale Regione', ...ll(38.090479, 13.343314)],
  ['monreale', 'Monreale, Duomo', -6125, 3752, 1.25],
  ['mondello', 'Mondello', -3033.1, -10177.4, -1.07],
];
const LABEL = {
  shoff: 'shadows off (pass, lookups)', shpass0: 'shadow pass skipped', shrecv0: 'shadow lookups skipped', sh0: 'shadows compiled out', half: 'half render scale', tiny: 'render scale 1/8 (pixels gone)', flat: 'every pixel one flat colour',
  crowd0: 'crowd hidden', traffic0: 'traffic hidden', props0: 'props, trees, stalls hidden', build0: 'buildings hidden', ground0: 'terrain and streets hidden', transp0: 'see-through things hidden',
  clouds0: 'clouds and their shadows off', csh0: 'cloud shadows off', lean0: 'engine-lean bypassed', whole: 'parts drawn whole', shade0: 'shading.js chunks off',
  order0: 'cut-outs in three\'s old order', sort: 'front to back, cut-outs last', hud0: 'HUD and page layers hidden', balloons: '12 speech balloons shown',
  rain: 'rain instead of fair weather', wash0: 'night wash off', lamps0: 'lamp and headlights off', fog0: 'fog off', tone0: 'tone mapping off', env0: 'sky reflection off', mediump: 'mediump fragments',
  alpha0: 'cut-outs solid', cutout0: 'cut-outs hidden', blit0: 'shadow cache copy skipped',
};

export async function runBench(E) {
  const { game, renderer: R, scene: S, camera: C, vehicle, world, lean, sys, CHUNKS0, canvasStats } = E, shipped = E.cutoutsLast || null;
  const gl = R.getContext(), car = vehicle.car, Q = new URLSearchParams(location.search), STAGE2 = Q.get('bench') === 'aa';
  const now = () => performance.now(), sleep = ms => new Promise(r => setTimeout(r, ms)), r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let store = {}; try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* none, or no storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } };   // false in a private window: the result still shows, it just does not survive a reload
  const cleanUrl = () => { const u = new URL(location.href); u.searchParams.delete('aa'); u.searchParams.set('bench', ''); return u.pathname + u.search.replace(/bench=(&|$)/, 'bench$1'); };

  // ---------- the frame loop: the game's animation callbacks run from here, so a frame can be timed to the moment the GPU has finished it, or held back altogether
  const raf = window.requestAnimationFrame.bind(window), px = new Uint8Array(4), each = new Set();
  let cbs = [], rid = 0, sync = false, hold = false, waiters = [], lastT = 0, lastErr = '';
  window.requestAnimationFrame = cb => { cbs.push([++rid, cb]); return rid; };   // three asks for its next frame by name each time, so this takes over from the next frame on
  window.cancelAnimationFrame = h => { cbs = cbs.filter(c => c[0] !== h); };
  function tick(t) {
    raf(tick);
    const iv = t - lastT; lastT = t; let js = 0, tot = 0;
    if (!hold) {
      const run = cbs; cbs = [];
      const t0 = now();
      for (const c of run) { try { c[1](t); } catch (e) { lastErr = String(e && e.message || e).slice(0, 120); } }
      for (const f of each) f();
      const t1 = now();
      if (sync) { const fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); }
      js = t1 - t0; tot = now() - t0;
    }
    const f = { iv, js, tot, calls: R.info.render.calls, tris: R.info.render.triangles }, w = waiters; waiters = [];
    for (const r of w) r(f);
  }
  const frame = () => new Promise(r => waiters.push(r));
  raf(tick);
  // frames for at least `ms` and `min` of them, with (s) or without waiting for the GPU; the first `skip` are thrown away (a switch has just been thrown)
  async function take({ ms = 0, min = 1, max = 1e9, s = false, skip = 2 }) { sync = s; for (let i = 0; i < skip; i++) await frame(); const F = [], t0 = now(); while (F.length < max && (F.length < min || now() - t0 < ms)) F.push(await frame()); return F; }
  // Safari's clock steps in whole milliseconds: one frame's time is useless, the mean over a chunk of frames (the top and bottom 15 % dropped) resolves a tenth
  const sorted = a => Float64Array.from(a).sort(), at = (s, p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const tmean = a => { const s = sorted(a), c = Math.floor(s.length * 0.15); let t = 0; for (let i = c; i < s.length - c; i++) t += s[i]; return t / Math.max(1, s.length - 2 * c); };
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

  // ---------- the game's code by system: the calls main.js makes each frame, timed where they are called (a coarse clock still adds up right over a few hundred frames)
  const T = {}; let TF = 0;
  const wrap = (o, k, name) => { const f = o && o[k]; if (typeof f !== 'function') return; o[k] = function () { const t = now(); try { return f.apply(this, arguments); } finally { T[name] = (T[name] || 0) + now() - t; } }; };
  function wrapAll() {
    wrap(R, 'render', 'draw'); wrap(R.shadowMap, 'render', 'shadow');   // draw: three.js walking, sorting and issuing the frame; shadow: the part of it that is the shadow pass
    for (const [m, k, n] of [['traffic', 'update', 'traffic'], ['traffic', 'collidePlayer', 'traffic'], ['pedestrians', 'update', 'crowd'], ['pedestrians', 'draw', 'crowd'], ['pedestrians', 'collidePlayer', 'crowd'],
      ['world', 'update', 'world'], ['world', 'drivePlayer', 'world'], ['dayNight', 'update', 'daynight'], ['clouds', 'update', 'clouds'], ['minimap', 'draw', 'minimap'], ['sea', 'update', 'sea'], ['cityAudio', 'update', 'audio'],
      ['missions', 'update', 'missions'], ['roadwear', 'update', 'roadwear'], ['roadwear', 'collidePlayer', 'roadwear'], ['markets', 'update', 'markets'], ['shouts', 'update', 'hud'], ['coords', 'update', 'hud'], ['net', 'update', 'net'],
      ['vehicle', 'updateVisual', 'lapa'], ['props', 'collidePlayer', 'props'], ['suca', 'update', 'other'], ['stadium', 'update', 'other'], ['carretto', 'update', 'other'], ['drunk', 'update', 'other'], ['horn', 'update', 'other'], ['playlog', 'update', 'other']]) wrap(sys[m], k, n);
    each.add(() => { TF++; });
  }
  const snap = () => ({ ...T, n: TF });
  function split(a, b, js) {   // ms a frame between two snapshots; "rest" is what main.js does itself (physics, camera, HUD text)
    const n = Math.max(1, b.n - a.n), o = {}; let sum = 0;
    for (const k in b) if (k !== 'n') { const v = (b[k] - (a[k] || 0)) / n; if (k !== 'shadow') sum += v; if (v >= 0.05) o[k] = r2(v); }
    o.rest = r2(Math.max(0, js - sum)); return o;
  }

  // ---------- the strip while it runs, the panel when it is done
  const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; return e; };
  const MONO = 'ui-monospace,Menlo,Consolas,monospace';
  const strip = mk('div', `position:fixed;left:0;right:0;top:0;z-index:2147483000;padding:3px max(8px,env(safe-area-inset-left));font:600 11px/1.3 ${MONO};color:#fff;background:rgba(11,7,9,.82);white-space:nowrap;overflow:hidden;pointer-events:none`);
  document.body.appendChild(strip);
  const say = s => { strip.textContent = s; };
  let panel = null, pre = null, pageNo = 0, shown = null;
  function show(res, head) {
    shown = res; api.res = res;
    if (!panel) {
      panel = mk('div', `position:fixed;inset:0;z-index:2147483001;background:#0b0709;color:#f3ece6;display:flex;flex-direction:column;padding:6px max(8px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));box-sizing:border-box;touch-action:manipulation`);
      const box = mk('div', 'flex:1;min-height:0;overflow:hidden'); pre = mk('pre', `margin:0;font:500 11px/1.22 ${MONO};white-space:pre;transform-origin:0 0;display:inline-block`); box.appendChild(pre);
      const bar = mk('div', 'display:flex;gap:6px;padding-top:4px;align-items:center');
      const btn = (t, fn) => { const b = mk('button', `font:700 12px/1 ${MONO};color:#0b0709;background:#e8559a;border:0;border-radius:6px;padding:7px 10px`, t); b.addEventListener('click', fn); bar.appendChild(b); return b; };
      btn('1 summary', () => page(0)); btn('2 costs', () => page(1));
      const cp = btn('Copy JSON', async () => {
        const txt = JSON.stringify(shown); let ok = false;
        try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { const ta = mk('textarea', 'position:fixed;left:0;top:0;opacity:0'); ta.value = txt; panel.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e2) { /* no clipboard at all */ } ta.remove(); }
        cp.textContent = ok ? 'copied' : 'copy failed'; setTimeout(() => { cp.textContent = 'Copy JSON'; }, 1500);
      });
      btn('Run again', () => { try { sessionStorage.setItem(KEY, 'go'); } catch (e) { /* then the age rule decides */ } delete store.last; delete store.run; delete store.aa; save(); location.replace(cleanUrl()); });
      bar.appendChild(mk('span', `font:500 10px/1 ${MONO};opacity:.6;margin-left:auto`, 'nothing is sent: screenshot both pages or copy'));
      panel.append(box, bar); document.body.appendChild(panel);
      addEventListener('resize', () => page(pageNo));
    }
    panel.dataset.head = head || ''; page(pageNo);
  }
  function page(n) {
    pageNo = n; pre.style.transform = ''; pre.textContent = text(shown, panel.dataset.head)[n];
    const b = pre.parentNode, k = Math.min(b.clientWidth / pre.offsetWidth, b.clientHeight / pre.offsetHeight, 1.35);   // the whole page on one screen, whatever the screen
    pre.style.transform = `scale(${k.toFixed(3)})`;
  }

  // ---------- the result as text: two pages a phone shows whole in landscape (no line over 120 characters, so the letters stay readable in a screenshot)
  function text(res, head) {
    const P = (s, n) => String(s).padEnd(n), L = (s, n) => String(s).padStart(n), f1 = v => Number.isFinite(v) ? v.toFixed(1) : '?', sg = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    const d = res.dev || {}, g = res.gl || {}, c = res.pic || {}, x = g.ext || [], has = n => x.includes(n) ? 'yes' : 'no', spots = res.spots || [];
    const wrap = s => { const out = []; for (let ind = ''; s.length > 120;) { const k = s.lastIndexOf(' ', 120); out.push(s.slice(0, k)); ind = '    '; s = ind + s.slice(k + 1); } out.push(s); return out; };
    const a = [], b = [];
    a.push(`PALERMO DRIVE BENCH  ${res.ver || ''}  ${(res.at || '').slice(0, 16).replace('T', ' ')} UTC  took ${res.ms ? mmss(res.ms) : '(not finished)'}  MSAA ${g.aa ? 'on x' + g.samples : 'off'}`);
    a.push(`${d.model || '?'}${d.os ? ', ' + d.os : ''}${d.browser ? ' ' + d.browser : ''}  screen ${d.screen ? d.screen.join('x') : '?'} @${d.dpr}  page ${d.page ? d.page.join('x') : '?'}  canvas ${d.canvas ? d.canvas.join('x') : '?'} px (ratio ${d.ratio})  ${d.cores || '?'} cores`);
    a.push(`${String(g.gpu || '?').slice(0, 44)}  ${String(g.ver || '').slice(0, 9)}  max texture ${g.lim ? g.lim.tex : '?'}  multi_draw ${has('WEBGL_multi_draw')}  parallel compile ${has('KHR_parallel_shader_compile')}  GPU timer ${has('EXT_disjoint_timer_query_webgl2')}`);
    a.push(`display ${d.hz ? d.hz + ' Hz' : '?'} (${f1(d.idle)} animation frames a second with nothing drawn)  clock step ${d.clock} ms  mediump ${g.mediump || '?'} bits  screen kept awake: ${d.wake ? 'yes' : 'NO'}`);
    a.push(`canvas memory ${d.cv ? f1(d.cv.mb) + ' MB in ' + d.cv.n + ' canvases, peak ' + f1(d.cv.peakMB) : '?'}  weather by the schedule: ${res.wx || '?'} (measured under fair weather)`);
    const p16 = spots.filter(s => s.p16 && s.p16[0]).sort((p, q) => q.p16[1] - p.p16[1])[0];
    if (c.ground !== undefined) a.push(`ground: ${c.ground > 1 ? 'drawn' : 'NOT DRAWN?'} (${c.ground} % of the picture changes when it is hidden, ${spots[0] ? spots[0].name : '?'})  parts against whole meshes: ${c.whole} % differs`);
    if (p16 || c.ground !== undefined) a.push(`16-bit meshes drawn by parts: ${p16 && p16.p16[1] > 0.05 ? `drawn (${p16.p16[0]} of them are ${p16.p16[1]} % of the picture at ${p16.name})` : 'none in view at any spot, so this run cannot tell'}`);
    for (const w of res.warn || []) a.push('! ' + w);
    a.push('');
    const H = '   fps  med/p95/max    JS  frame   GPU';
    a.push(P('', 19) + P('  ------------ day, 12:00 ------------', 40) + '  ----------- night, 22:30 -----------');
    a.push(P('spot', 19) + H + ' ' + H + '  draws  load s');
    const cell = m => m ? L(f1(m.fps), 6) + L(m.iv.map(Math.round).join('/'), 13) + L(f1(m.js), 6) + L(f1(m.tot), 7) + L(f1(m.tot - m.sjs), 6) : P('   (not measured)', 38);
    for (const s of spots) a.push(P(s.name, 19) + (s.skip ? '   left out: the run was out of time' : cell(s.day) + ' ' + cell(s.night) + L(s.day ? s.day.calls : '', 7) + L(f1(s.load / 1000), 8) + (s.settled ? '' : ' *')));
    a.push('fps and the time between animation frames (ms) as the player gets them. JS: the game\'s code in a frame. frame: from the start of that code to the GPU having finished the picture. GPU: frame less its JS.' + (spots.some(s => !s.skip && !s.settled) ? ' *: the place had not finished loading after 25 s.' : ''));
    a.push('people there, day/night (a crowd fills and thins slowly after a change of place or hour: these are what was measured): ' + spots.filter(s => s.day && s.night).map(s => `${s.name} ${s.day.people}/${s.night.people}`).join(', '));
    a.push('');
    for (const s of spots) for (const tm of ['day', 'night']) if (s[tm] && s[tm].split && (s[tm].var || s === spots[0])) a.push(`JS at ${s.name}, ${tm}: ` + Object.entries(s[tm].split).sort((p, q) => q[1] - p[1]).slice(0, 9).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '));
    a.push('  ms a frame. draw: three.js walking, sorting and issuing the frame (shadow: the shadow pass inside it). rest: physics, camera, HUD text.');
    if (res.aa0) a.push('MSAA off (a second page load, to measure: never an option), by day: ' + res.aa0.map(s => `${s.name} frame ${f1(s.on.day.tot)} to ${f1(s.day.tot)} ms, fps ${f1(s.on.day.fps)} to ${f1(s.day.fps)}${s.on.day.people !== undefined ? ` (${s.on.day.people} and ${s.day.people} people${Math.abs(s.on.day.people - s.day.people) > 0.1 * Math.max(s.on.day.people, s.day.people) ? ': too different a crowd for a fair pair' : ''})` : ''}`).join('; '));
    else a.push('MSAA off: ' + (res.aaWhy || 'not measured'));

    const vs = spots.filter(s => (s.day && s.day.var) || (s.night && s.night.var));
    b.push('WHAT EACH THING COSTS: the finished frame with the thing off or changed, against the same page as shipped in alternating blocks.');
    b.push('  ms of frame (minus: faster without it), ± what the noise alone does, js: the part that is the game\'s code, d: draw calls, iv: see below');
    b.push(P('', 35) + vs.map(s => P(s.name, 29)).join(''));
    const vcell = v => !v ? '' : v.na ? 'not measured' : v.skip ? 'skipped (time)' : `${sg(v.d)} ${v.e ? '±' + v.e.toFixed(1) : '    '} js${sg(v.js)}${v.di !== undefined ? ' iv' + sg(v.di) : v.calls ? ' ' + (v.calls > 0 ? '+' : '') + v.calls + 'd' : ''}`;
    for (const tm of ['day', 'night']) {
      const ids = []; for (const s of vs) for (const k in (s[tm] && s[tm].var) || {}) if (!ids.includes(k)) ids.push(k);
      if (!ids.length) continue;
      b.push(P(`as shipped, ${tm} (ms)`, 35) + vs.map(s => P(s[tm] ? f1(s[tm].tot) + '  (JS ' + f1(s[tm].sjs) + ')' : '', 29)).join(''));
      for (const k of ids) b.push(P((tm === 'night' ? 'night: ' : '') + (LABEL[k] || k), 35) + vs.map(s => P(vcell(s[tm] && s[tm].var && s[tm].var[k]), 29)).join(''));
    }
    const na = []; for (const s of vs) for (const tm of ['day', 'night']) for (const [k, v] of Object.entries((s[tm] && s[tm].var) || {})) if (v.na && !na.some(q => q.startsWith(k + ':'))) na.push(k + ': ' + v.na);
    if (na.length) b.push('not measured (could not be switched in this page): ' + na.join('; '));
    b.push('iv: the change in the mean time between animation frames, for what the page compositor does outside the frame (HUD, balloons). Hidden things stay in the cached shadow map.');
    for (const s of vs) { const m = s.day, t = m && m.var && m.var.tiny; if (t && !t.na && !t.skip) b.push(`${s.name}: frame ${f1(m.tot)} = JS ${f1(m.sjs)} + GPU ${f1(m.tot - m.sjs)}; ${-t.d > (t.e || 0) ? `the pixels are about ${f1(-t.d)} of it (the 1/8 scale test), draw calls, vertices and the shadow pass the rest` : 'the pixels are too small a part of it to measure here (the 1/8 scale test is inside its noise)'}`); }
    if (c.order0 !== undefined) b.push(`same picture? three's old order against the shipped one (cut-outs after the solid draws): ${c.order0} % of the pixels differ; front to back against shipped: ${c.sort} % (the same frame drawn twice: ${c.self} %). A plus on the old order's line is what the shipped order saves.`);
    b.push('Left out because each compiles every program again (tens of seconds in WebKit): shadows compiled out (sh0), flat pixels (flat), shading.js off (shade0), lamp lights off (lamps0). Ask for them with ?bench&bv=sh0,flat,shade0');
    b.push('Cannot change in a page: MSAA (the second load, on the summary page) and the matrix walk of engine-lean. Safari gives a page no GPU timer, no thermal state and no Low Power flag: the frame is timed by waiting for one pixel.');
    for (const n of res.notes || []) b.push('note: ' + n);
    if (head) { a.unshift(head, ''); b.unshift(head, ''); }
    return [a.flatMap(wrap).join('\n'), b.flatMap(wrap).join('\n')];
  }

  // ---------- what the device says about itself
  function device() {
    const ua = navigator.userAgent, m = ua.match(/(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/), an = ua.match(/Android (\d+(?:\.\d+)?)/), sv = ua.match(/Version\/(\d+(?:\.\d+)?)/);
    const sw = Math.min(screen.width, screen.height), sh = Math.max(screen.width, screen.height), dpr = devicePixelRatio;
    const model = m && m[1] === 'iPhone' ? ({ '414x896@2': 'iPhone XR or 11', '375x812@3': 'iPhone X, XS or 11 Pro', '414x896@3': 'iPhone XS Max or 11 Pro Max', '390x844@3': 'iPhone 12 to 14', '393x852@3': 'iPhone 14 Pro to 16' })[`${sw}x${sh}@${dpr}`] || 'iPhone' : m ? m[1] : an ? 'Android' : /Mac/.test(ua) ? 'Mac' : 'other';
    const cv = R.domElement, cs = canvasStats ? canvasStats() : null;
    return { ua, model, os: m ? `iOS ${m[2]}.${m[3]}` : an ? 'Android ' + an[1] : '', browser: /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /Instagram|FBAN|FBAV/.test(ua) ? 'in-app browser' : sv ? 'Safari ' + sv[1] : '',
      screen: [sw, sh], dpr, page: [innerWidth, innerHeight], canvas: [cv.width, cv.height], ratio: R.getPixelRatio(), cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, touch: navigator.maxTouchPoints, standalone: !!navigator.standalone,
      isolated: !!self.crossOriginIsolated, cv: cs && { mb: r1(cs.mb), n: cs.n, peakMB: r1(cs.peakMB) } };
  }
  function glInfo() {
    const p = n => gl.getParameter(gl[n]), dbg = gl.getExtension('WEBGL_debug_renderer_info'), an = gl.getExtension('EXT_texture_filter_anisotropic'), at = gl.getContextAttributes() || {};
    const pf = t => { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl[t]); return f ? f.precision : 0; };
    return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : p('RENDERER'), vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : p('VENDOR'), ver: p('VERSION'), glsl: p('SHADING_LANGUAGE_VERSION'),
      aa: !!at.antialias, samples: p('SAMPLES'), attr: at, buf: [gl.drawingBufferWidth, gl.drawingBufferHeight], mediump: pf('MEDIUM_FLOAT'), highp: pf('HIGH_FLOAT'),
      lim: { tex: p('MAX_TEXTURE_SIZE'), cube: p('MAX_CUBE_MAP_TEXTURE_SIZE'), rb: p('MAX_RENDERBUFFER_SIZE'), samples: p('MAX_SAMPLES'), layers: p('MAX_ARRAY_TEXTURE_LAYERS'), units: p('MAX_TEXTURE_IMAGE_UNITS'), vunits: p('MAX_VERTEX_TEXTURE_IMAGE_UNITS'),
        vuni: p('MAX_VERTEX_UNIFORM_VECTORS'), funi: p('MAX_FRAGMENT_UNIFORM_VECTORS'), vary: p('MAX_VARYING_VECTORS'), attrs: p('MAX_VERTEX_ATTRIBS'), bufs: p('MAX_DRAW_BUFFERS'), index: p('MAX_ELEMENT_INDEX'), aniso: an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0 },
      programs: R.info.programs ? R.info.programs.length : 0, ext: gl.getSupportedExtensions() || [] };
  }

  // ---------- what can be switched, one thing at a time (tools/perf/probe.js: the same switches under the same names). Each returns its undo, or a string saying why it cannot be done here.
  const matOf = o => Array.isArray(o.material) ? o.material[0] : o.material, drawn = o => o.isMesh || o.isPoints || o.isLine || o.isSprite;
  const mats = () => { const m = new Set(); S.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(q => m.add(q)); }); return [...m]; };
  const recompile = () => mats().forEach(m => { m.needsUpdate = true; });
  // a shader variant for every material at once: the cache key gets a suffix and the shader text a patch, so switching back reuses the base programs
  function patchAll(tag, fn, only) {
    const undo = [];
    for (const m of mats()) {
      if (only && !only(m)) continue;
      const ob = m.onBeforeCompile, ck = m.customProgramCacheKey, own = Object.prototype.hasOwnProperty, hadOb = own.call(m, 'onBeforeCompile'), hadCk = own.call(m, 'customProgramCacheKey');
      m.onBeforeCompile = function (sh, r) { ob.call(this, sh, r); fn(sh, m); };
      m.customProgramCacheKey = function () { return ck.call(this) + '|' + tag; };
      m.needsUpdate = true;
      undo.push(() => { if (hadOb) m.onBeforeCompile = ob; else delete m.onBeforeCompile; if (hadCk) m.customProgramCacheKey = ck; else delete m.customProgramCacheKey; m.needsUpdate = true; });
    }
    return () => undo.forEach(f => f());
  }
  const setMat = (pred, key, val) => { const undo = []; for (const m of mats()) if (pred(m)) { const v = m[key]; m[key] = val; m.needsUpdate = true; undo.push(() => { m[key] = v; m.needsUpdate = true; }); } return undo.length ? () => undo.forEach(f => f()) : 'no such material here'; };
  // hiding: whole parts of the streamed tiles by the streamer's own names (world.tiles, t.parts), other things by object name
  const parts = re => { const out = []; for (const t of world.tiles.values()) for (const n in t.parts) if (re.test(n)) out.push(t.parts[n]); return out; };
  function hide(roots, pred) {
    const hid = [], h = o => { if (drawn(o) && o.visible) { o.visible = false; hid.push(o); } };
    for (const r of roots || []) r.traverse(h);
    if (pred) S.traverse(o => { if (drawn(o) && pred(o)) h(o); });
    return hid.length ? () => hid.forEach(o => { o.visible = true; }) : 'nothing of it here';
  }
  const uni = k => { for (const m of mats()) { const u = R.properties.get(m).uniforms; if (u && u[k]) return u[k]; } return null; };
  const pin = (v, k) => { const x = v[k]; Object.defineProperty(v, k, { get() { return 0; }, set() {}, configurable: true }); return () => { delete v[k]; v[k] = x; }; };   // a uniform's component held at 0 whatever the game writes
  // The opaque order. The page ships cutoutsLast (src/engine-lean.js, set by main.js: three's order by material with the cut-outs after the solid draws; null with ?order=off), and that is what every
  // restore puts back. order0 is three's own order, as it was before; sort is the comparison of the engine's sort part: by depth, the cut-outs still last (the same key, fence panels left where they are).
  const cuts = new WeakMap(), isCut = m => { let c = cuts.get(m); if (c === undefined) cuts.set(m, c = shipped && m.alphaTest > 0 && !m.userData.keepOrder ? 1 : 0); return c; };   // looked up once: the sort asks thousands of times a frame
  const byDepth = (a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || isCut(a.material) - isCut(b.material) || a.z - b.z || a.id - b.id;
  const order = f => () => { if (lean && lean.parts.sort) return 'the page already sorts by depth (?lean=sort)'; if (!f && !shipped) return 'the page already has three\'s order (?order=off)'; R.setOpaqueSort(f); return () => R.setOpaqueSort(shipped); };
  const ratio = k => () => { const r = R.getPixelRatio(); R.setPixelRatio(r * k); return () => R.setPixelRatio(r); };
  const V = {
    sh0: () => { R.shadowMap.enabled = false; recompile(); return () => { R.shadowMap.enabled = true; recompile(); }; },
    shpass0: () => { R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; return () => { R.shadowMap.autoUpdate = true; }; },
    shrecv0: () => { const Ls = []; S.traverse(o => { if (o.receiveShadow) { o.receiveShadow = false; Ls.push(o); } }); return Ls.length ? () => Ls.forEach(o => { o.receiveShadow = true; }) : 'nothing receives shadows'; },   // receiveShadow is a uniform: the lookups sit behind a branch on it, so no program changes
    shoff: () => { const b = V.shrecv0(); if (typeof b !== 'function') return b; const a = V.shpass0(); return () => { a(); b(); }; },   // what sh0 measures, less the little a compiled-out lookup saves over a branched-out one
    blit0: () => { const b = gl.blitFramebuffer; gl.blitFramebuffer = function (...a) { if (a[8] & gl.DEPTH_BUFFER_BIT) return; return b.apply(this, a); }; return () => { gl.blitFramebuffer = b; }; },
    half: ratio(0.5), tiny: ratio(0.125),
    flat: () => patchAll('flat', sh => { sh.fragmentShader = sh.fragmentShader.replace(/void main\(\) \{/, 'void main() { gl_FragColor = vec4(0.5); return;\n'); }),
    crowd0: () => hide(null, o => /^crowd/.test(o.name)),
    traffic0: () => hide(null, o => /^traffic_/.test(o.name)),
    props0: () => hide([...S.children.filter(o => /^props_/.test(o.name)), ...parts(/^(trees|fences|quays|tram)$/), ...(sys.markets && sys.markets.markets ? sys.markets.markets.flatMap(m => m.meshes || []) : [])], o => /^(market_|fence_)/.test(o.name)),
    build0: () => hide(parts(/^(bldFull|bldLow|lm:)/), o => /^farcity_/.test(o.name)),
    ground0: () => hide(parts(/^(terrain|streets|streetsHi|paint|tracks)$/), o => /^(far_|hills_)/.test(o.name)),
    transp0: () => hide(null, o => matOf(o) && matOf(o).transparent),
    cutout0: () => hide(null, o => matOf(o) && matOf(o).alphaTest > 0),
    alpha0: () => setMat(m => m.alphaTest > 0, 'alphaTest', 0),
    clouds0: () => { const c = sys.clouds; if (!c || !c.setOn) return 'the clouds are off (?clouds=off)'; const sky = S.children.find(o => o.material && o.material.uniforms && o.material.uniforms.cloudCoverage); c.setOn(false); if (sky) sky.material.uniforms.cloudCoverage.value = 0; return () => c.setOn(true); },   // (setOn(false) alone brings back the sky addon's painted clouds, which cost)
    csh0: () => { const u = uni('uCloudL'); return u ? pin(u.value, 'z') : 'no cloud shadows in the shaders'; },
    wash0: () => { const u = uni('uNightK'); return u ? pin(u.value, 'x') : 'no night wash in the shaders'; },
    lamps0: () => { const Ls = []; S.traverse(o => { if ((o.isPointLight || o.isSpotLight) && o.visible) { o.visible = false; Ls.push(o); } }); return Ls.length ? () => Ls.forEach(o => { o.visible = true; }) : 'no lamp lights'; },
    lean0: () => { if (!lean) return 'engine-lean is off (?engine=off)'; lean.bypass = true; return () => { lean.bypass = false; }; },
    whole: () => { if (!lean || !lean.parts.parts) return 'no part drawing in this page'; lean.wholeParts = true; return () => { lean.wholeParts = false; }; },
    shade0: () => {   // src/shading.js undone: three's own chunks back in every program, and the sky reflection as cube map lookups again (the light probe that carries its numbers hidden)
      if (!CHUNKS0) return 'shading.js is off (?shade=off)';
      const Ls = []; S.traverse(o => { if (o.isLightProbe && o.visible) { o.visible = false; Ls.push(o); } });
      const u = patchAll('shade0', sh => { for (const k in CHUNKS0) sh.fragmentShader = sh.fragmentShader.replace(`#include <${k}>`, CHUNKS0[k]); });
      return () => { Ls.forEach(o => { o.visible = true; }); u(); };
    },
    order0: order(null), sort: order(byDepth),
    hud0: () => { const st = document.createElement('style'); st.textContent = 'body > :not(#view) { visibility: hidden !important; }'; document.head.appendChild(st); return () => st.remove(); },   // what ?clean does (this strip goes too)
    balloons: () => {   // src/shouts.js shows up to 4 street balloons (a blurred backdrop each) and 8 of the stadium's crowd: the same elements under the same classes, moving a little each frame as the real ones do
      const Ly = document.querySelector('.shouts'); if (!Ly) return 'no balloon layer';
      const els = []; for (let i = 0; i < 12; i++) { const e = document.createElement('div'); e.className = i < 4 ? 'shout right' : 'shout crowd right'; e.textContent = 'BENCH BENCH BENCH'; Ly.appendChild(e); els.push(e); }
      const mv = () => { const t = now() / 300; els.forEach((e, i) => { e.style.transform = `translate(${(innerWidth * (0.06 + 0.075 * i) + 4 * Math.sin(t + i)).toFixed(0)}px, ${(innerHeight * (0.5 + 0.11 * (i % 4))).toFixed(0)}px) translate(0, -100%)`; }); };
      each.add(mv); mv(); return () => { each.delete(mv); els.forEach(e => e.remove()); };
    },
    rain: () => { const w = sys.weather; if (!w || !w.set) return 'no weather'; w.set('rain', 0); return () => w.set('cumulus', 0); },
    fog0: () => setMat(m => m.fog, 'fog', false),
    tone0: () => { const t = R.toneMapping; R.toneMapping = 0; recompile(); return () => { R.toneMapping = t; recompile(); }; },
    env0: () => { const e = S.environment; S.environment = null; recompile(); return () => { S.environment = e; recompile(); }; },
    mediump: () => { const u = setMat(() => true, 'precision', 'mediump'), v = patchAll('mp', sh => { sh.vertexShader = 'precision highp float;\nprecision highp int;\n' + sh.vertexShader; }); return () => { v(); u(); }; },
  };
  const OPT = { half: { rounds: 2, warm: 5 }, tiny: { rounds: 2, warm: 5 }, rain: { slow: 2500 }, hud0: { free: true }, balloons: { free: true } };   // a resize or the weather cannot flip every third of a second; the page's layers are composited outside the frame, so those two are also measured by the time between frames

  // ---------- one variant against the page as shipped, in alternating blocks (A B A B ...): drift, heat and the traffic passing by cancel as far as they can
  // Each block with the thing changed is compared with the mean of the two blocks as shipped on either side of it; d is the mean of those differences and e half their spread (what the noise alone does).
  let carry = null;   // the closing block of one variant opens the next
  async function block(free) { const F = await take({ ms: free ? 420 : 230, min: 6, max: 45, s: !free, skip: 1 }); return { v: free ? mean(F.map(f => f.iv)) : tmean(F.map(f => f.tot)), tot: tmean(F.map(f => f.tot)), js: tmean(F.map(f => f.js)), calls: mean(F.map(f => f.calls)) }; }
  // After a switch frames are thrown away until three in a row are back near the usual time: the first frames of a variant compile its programs, and on a phone that can be seconds over several frames.
  // false: it never settled (the variant is then given up, and shown as not measured rather than with a number that is the compiler's).
  async function calm(ref, free, warm, max) {   // max: ms allowed after the first frame, which may be one long compile
    sync = !free;
    for (let t = 0, n = 1, ok = 0; ; n++) { const f = await frame(); if (n === 1) t = now(); ok = f.tot < ref * 4 + 5 ? ok + 1 : 0; if (n >= warm && ok >= 3) return true; if (now() - t > max) return false; }
  }
  async function ab(id, free) {
    const on = V[id], o = OPT[id] || {}, A = [], B = [], warm = o.warm || 3, wait = HEAVY.includes(id) ? 30000 : 6000;
    if (!on) return { na: 'no such variant' };
    A.push(carry && carry.free === !!free && now() - carry.t < 300 ? carry.b : await block(free));
    for (let r = 0, n = o.slow ? 1 : free ? 2 : o.rounds || 3; r < n; r++) {
      let off; try { off = on(); } catch (e) { off = String(e && e.message || e).slice(0, 80); }
      if (typeof off !== 'function') return { na: off || 'not available' };
      if (o.slow) await sleep(o.slow);
      if (!(await calm(A[0].tot, free, warm, wait))) { off(); await calm(A[0].tot, free, warm, wait); carry = null; return { na: 'the frames did not settle after the switch' }; }
      B.push(await block(free)); off();
      if (o.slow) await sleep(o.slow);
      await calm(A[0].tot, free, warm, wait);
      A.push(await block(free));
    }
    carry = { b: A[A.length - 1], t: now(), free: !!free };
    const D = B.map((b, r) => b.v - (A[r].v + A[r + 1].v) / 2), d = mean(D), a = mean(A.map(q => q.v));
    return { d: r2(d), e: r2((Math.max(...D) - Math.min(...D)) / 2), pct: r1(d / a * 100), base: r2(a), js: r2(mean(B.map(q => q.js)) - mean(A.map(q => q.js))), calls: Math.round(mean(B.map(q => q.calls)) - mean(A.map(q => q.calls))) };
  }

  // ---------- the same instant drawn two ways inside one task (nothing moves in between): the share of pixels that differ by more than 8 of 255
  function grab() { const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4), fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); return a; }
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) n++; return +(n / (a.length / 4) * 100).toFixed(3); };
  async function pictures() {
    await frame(); sync = false;
    R.render(S, C); const a = grab(), out = {};
    const one = on => { let off; try { off = on(); } catch (e) { off = null; } if (typeof off !== 'function') return 'n/a'; R.render(S, C); const b = grab(); off(); return differ(a, b); };
    R.render(S, C); out.self = differ(a, grab());   // the noise floor: the same thing twice (the cached shadow map may move on a slice between two renders)
    out.ground = one(() => hide(parts(/^(terrain|streets|streetsHi)$/)));
    out.whole = one(V.whole); out.order0 = one(V.order0); out.sort = one(V.sort);
    return out;
  }
  // The meshes with a 16-bit index that the engine draws by parts (src/engine-lean.js), hidden: how much of the picture they were. Commit b54dff6b: WEBGL_multi_draw lost exactly these
  // on an older iPhone (the ground went with them), and the parts are plain draws since. Asked at every spot: [how many, % of the picture].
  async function parts16() {
    const g = []; S.traverse(o => { if (o.isMesh && o.visible && o.userData.leanRuns && o.geometry.index && o.geometry.index.array instanceof Uint16Array) g.push(o); });
    if (!g.length) return [0, 0];
    await frame(); sync = false;
    R.render(S, C); const a = grab(); g.forEach(o => { o.visible = false; }); R.render(S, C); const b = grab(); g.forEach(o => { o.visible = true; });
    return [g.length, differ(a, b)];
  }

  // ---------- getting somewhere and waiting until it is all there
  const tileFull = () => { const i = Math.floor(car.x / 500), j = Math.floor(car.z / 500); for (const t of world.tiles.values()) if (t.i === i && t.j === j) return t.lod === 2; return false; };
  const leanIdle = () => !lean || !lean.stats().pendingBoxes;
  // the crowd walks in a few people a frame and thins out one a frame (src/pedestrians.js): wait until it is near what the place and the hour want, but not for ever
  async function crowd(max) { const ps = sys.pedestrians && sys.pedestrians.stats; for (let t0 = now(); ps && now() - t0 < max; await sleep(200)) if (!(ps.target > 0) || (ps.count >= ps.target * 0.85 && ps.count <= ps.target * 1.3 + 6)) break; }
  async function steady(max = 3000) {   // until a dozen frames in a row hold no outlier and the streamer has under a millisecond a frame left to do: the builders and the shader compiles have gone quiet
    sync = false; const t0 = now(), F = [], W = [];
    while (now() - t0 < max) { const w = T.world || 0; F.push((await frame()).js); W.push((T.world || 0) - w); if (F.length > 12) { F.shift(); W.shift(); } if (F.length === 12) { const q = sorted(F); if (q[11] < q[6] * 1.8 + 2 && mean(W) < 1) return true; } }
    return false;
  }
  async function goTo(x, z, th) {
    await new Promise(done => { const t = setTimeout(done, 20000); try { vehicle.placeAt(x, z, th); } catch (e) { /* no road yet */ } world.teleport(x, z, () => { vehicle.placeAt(x, z, th); clearTimeout(t); done(); }); });
    vehicle.camState.mode = 1; vehicle.camState.init = false;
    let ok = false;
    for (let calm = 0, t0 = now(); now() - t0 < 25000; await sleep(150)) { calm = tileFull() && world.visiblePending() === 0 && leanIdle() ? calm + 1 : 0; if (calm >= 3) { ok = true; break; } }
    await steady(4000);   // the ring beyond the view goes on building for a while
    return ok;
  }
  async function setTime(h) {
    if (Math.abs(game.time.hour - h) > 0.02) { sys.dayNight.jumpTo(h); await sleep(1500); for (let t0 = now(); h === NIGHT && !sys.dayNight.lampsBuilt && now() - t0 < 3000;) await sleep(100); }   // the sky sweeps for 1.3 s, then the lamps of the tiles light up
    await crowd(2500); await steady(2000);
  }
  // the page as shipped: free running frames first (what the player sees), then frames with the wait for the GPU after each
  async function baseline() {
    const s0 = snap(), F = await take({ ms: 1100, min: 24 }), G = await take({ ms: 700, min: 16, s: true }), s1 = snap();
    const iv = sorted(F.map(f => f.iv)), js = tmean(F.map(f => f.js)), n = F.length + G.length + 4, ps = sys.pedestrians && sys.pedestrians.stats;
    return { people: ps ? ps.count : 0, want: ps ? Math.round(ps.target) : 0, cars: sys.traffic && sys.traffic.vehicles ? sys.traffic.vehicles.length : 0, fps: r1(1000 / mean(F.map(f => f.iv))), iv: [at(iv, 0.5), at(iv, 0.95), iv[iv.length - 1]].map(r1), pin: r2(F.filter(f => f.iv > 30.5 && f.iv < 36.5).length / F.length), js: r2(js), jsp: r1(at(sorted(F.map(f => f.js)), 0.95)),
      tot: r2(tmean(G.map(f => f.tot))), totp: r1(at(sorted(G.map(f => f.tot)), 0.95)), sjs: r2(tmean(G.map(f => f.js))), calls: G[G.length - 1].calls, tris: G[G.length - 1].tris, split: split(s0, s1, (js * F.length + tmean(G.map(f => f.js)) * G.length) / (n - 4)) };
  }

  // ---------- the run
  let res = null, wake = null, t0 = 0, restore = () => {};
  const lock = async () => { try { wake = await Promise.race([navigator.wakeLock.request('screen'), new Promise((_, no) => setTimeout(no, 1500))]); return true; } catch (e) { return false; } };   // (a request that never answers counts as a no)
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function fixed() {   // the same conditions every run: the clock stopped, fair weather, the chase camera. Put back at the end.
    const st = game.settings, sp = st.timeSpeed, pr = R.getPixelRatio(), h = game.time.hour;
    st.timeSpeed = 'off'; res.wx = sys.weather && sys.weather.WX ? sys.weather.WX.name : ''; if (sys.weather && sys.weather.set) sys.weather.set('cumulus', 0);
    if (Q.get('benchpr')) R.setPixelRatio(+Q.get('benchpr'));   // tests on a desktop: the phone's 2 on a display that has 1
    let done = false; restore = () => { if (done) return; done = true; st.timeSpeed = sp; if (sys.weather && sys.weather.set) sys.weather.set(null); R.setPixelRatio(pr); sys.dayNight.jumpTo(h); if (wake) wake.release().catch(() => {}); };
    addEventListener('pagehide', restore);
  }
  async function first() {   // what every stage needs before it measures
    res.dev = device(); res.gl = glInfo();
    // the display: animation frames with nothing drawn at all. 30 on a 60 Hz phone is iOS holding the page back (Low Power Mode does exactly this)
    hold = true; const I = (await take({ ms: 800, min: 12, skip: 3 })).map(f => f.iv); hold = false;
    res.dev.idle = r1(1000 / mean(I)); res.dev.hz = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240].reduce((b, r) => Math.abs(r - res.dev.idle) < Math.abs(b - res.dev.idle) ? r : b, 60);
    let step = 0; for (let a = now(), n = 0, i = 0; i < 4e6 && n < 4; i++) { const b = now(); if (b > a) { step = step ? Math.min(step, b - a) : b - a; a = b; n++; } } res.dev.clock = +step.toPrecision(2);   // the smallest step the page's clock takes: 1 ms in Safari
    res.dev.wake = !!wake;
    res.warn = [];
    if (coarse && res.dev.idle < 45) res.warn.push(`only ${res.dev.idle} animation frames a second with nothing drawn: Low Power Mode is on (or iOS is holding this page back). Every number below is capped at that: switch it off and run again.`);
    if (!res.dev.wake && coarse) res.warn.push('this browser could not keep the screen awake: if the phone dimmed or locked during the run, the numbers are no good.');
  }
  const progress = (what, left) => { say(`BENCH  ${mmss(now() - t0)}  ${what}  ·  about ${mmss(left)} left  ·  leave the phone alone`); store.run = { t: Date.now(), step: what, res }; save(); };
  // one spot of the tour: get there, then the page as shipped at each hour of `order`
  async function spot(def, order, left) {
    const [id, name, x, z, th] = def, s = { id, name, at: [x, z], ord: order }, tl = now();
    progress(`${name}: loading`, left());
    s.settled = await goTo(x, z, th); s.load = Math.round(now() - tl); s.car = [r1(car.x), r1(car.z)];
    if (sys.clouds && sys.clouds.setDrift) sys.clouds.setDrift(0);   // the same sky at every visit
    for (const tm of order) {
      progress(`${name}: ${tm}`, left());
      await setTime(tm === 'day' ? DAY : NIGHT);
      s[tm] = await baseline();
      if (tm === 'day') try { s.p16 = await parts16(); } catch (e) { res.notes.push('16-bit check failed: ' + String(e && e.message || e).slice(0, 80)); }
    }
    return s;
  }
  // The costs at the spot the lapa stands at: the hour it is first, then the other. A variant is skipped when it no longer fits before `end`.
  const EST = { rain: 9000, hud0: 4500, balloons: 4500 };   // the ones that wait for the weather, or are measured twice
  let vAvg = 2200, vN = 0, vDone = 0;
  const hours = () => Math.abs(game.time.hour - NIGHT) < 0.1 ? ['night', 'day'] : ['day', 'night'];
  async function attribute(s, lists, end, left, pic) {
    const order = hours();
    for (const tm of order) {
      const m = s[tm]; let there = false; if (!m || !lists[tm].length) continue;
      m.var = m.var || {};
      for (const v of lists[tm]) {
        const other = tm === order[0] && lists[order[1]].length ? 6000 : 0;   // keep room for the other hour's first variant
        if (now() + (EST[v] || vAvg) + other > end) { m.var[v] = { skip: 1 }; continue; }
        if (!there) { await setTime(tm === 'day' ? DAY : NIGHT); there = true; }
        progress(`${s.name}, ${tm}: ${LABEL[v] || v}`, left());
        const tv = now(), o = OPT[v] || {}; m.var[v] = await ab(v);
        if (o.free && !m.var[v].na) m.var[v].di = (await ab(v, true)).d;
        m.var[v].t = Math.round(now() - tv); vDone++; if (!EST[v]) vAvg = (vAvg * vN + now() - tv) / ++vN;
      }
      if (pic && tm === 'day' && there) { progress(`${s.name}: comparing pictures`, left()); try { res.pic = await pictures(); } catch (e) { res.notes.push('picture checks failed: ' + String(e && e.message || e).slice(0, 80)); } }
    }
  }
  async function stage1() {
    res = { v: 1, ver: (document.querySelector('meta[name="pd-version"]') || { dataset: {} }).dataset.name || 'dev', at: new Date().toISOString(), href: location.search, spots: [], notes: [] };
    t0 = now(); fixed(); say('BENCH  starting'); await first();
    const only = Q.get('bs') ? Q.get('bs').split(',') : null, list = SPOTS.filter(s => !only || only.includes(s[0])), cv = Q.get('bv') ? Q.get('bv').split(',') : null;   // ?bs=qc,mondello and ?bv=sh0,fog0 narrow a run to some spots and variants
    const NIGHTLY = ['wash0', 'lamps0'], pickV = L => cv ? { day: cv.filter(v => !NIGHTLY.includes(v)), night: cv.filter(v => NIGHTLY.includes(v)) } : L;
    const wantAA = res.gl.aa && Q.get('benchaa') !== '0', main = list[0], rest = list.slice(1), full = pickV(FULL), short = pickV(SHORT);
    let sAvg = 16000, sTodo = rest.length; const core = cv ? full : { day: full.day.slice(0, CORE), night: full.night.slice(0, 1) };
    const aaCost = () => wantAA ? 24000 + Math.min(sAvg, 20000) : 0, due = () => t0 + TOTAL - aaCost(), end = () => cv ? Infinity : due();   // (a list asked for by ?bv= is measured whole, however long it takes)
    const todo = l => l.day.length + l.night.length;
    const left = () => { const tour = sTodo * sAvg, all = Math.max(0, todo(full) + 2 * todo(short) - vDone) * vAvg, must = Math.max(0, todo(core) - vDone) * vAvg; return tour + Math.max(must, Math.min(all, due() - now() - tour)) + aaCost(); };
    // 1. Where the game starts, while the device is cool: the page as shipped, then the costs that matter most. These always run.
    const s0 = await spot(main, ['night', 'day'], left); res.spots.push(s0);
    await attribute(s0, core, Infinity, left, true);
    // 2. The tour, nearest first: each spot starts at the hour the last one ended at, which halves the changes of hour. When the time is up the spots still to come (the far ones) are left out, and shown as left out.
    for (const def of rest) {
      const ts = now();
      if (!cv && now() - t0 + Math.min(sAvg, 24000) + aaCost() > TOTAL + 20000) { res.spots.push({ id: def[0], name: def[1], skip: 1 }); sTodo--; continue; }
      const s = await spot(def, hours(), left);
      res.spots.push(s); sAvg = sTodo === rest.length ? now() - ts : (sAvg + now() - ts) / 2; sTodo--;
      if (s.day.pin >= 0.8 && s.day.tot < 0.6 * 1000 / res.dev.hz && res.dev.idle >= 45 && !res.warn.some(w => /pinned/.test(w))) res.warn.push(`${s.name}: frames pinned at 33 ms though one takes ${s.day.tot} ms to finish. Something caps the page at 30.`);
    }
    // 3. With the time that is left: the shorter list at the heaviest two of the other spots, and whatever of the full list is still open back where the run began
    const seen = res.spots.filter(s => !s.skip);
    if (!cv) {
      for (const s of seen.slice(1).sort((a, b) => b.day.tot - a.day.tot).slice(0, 2)) {
        if (now() + sAvg * 0.5 + 6 * vAvg > end()) break;
        progress(`${s.name}: loading again`, left()); const def = SPOTS.find(d => d[0] === s.id); await goTo(def[2], def[3], def[4]);
        await attribute(s, short, end(), left, false);
      }
      if (core !== full && now() + (rest.length ? sAvg * 0.5 : 0) + 4 * vAvg < end()) {
        if (rest.length) { progress(`${s0.name}: loading again`, left()); await goTo(main[2], main[3], main[4]); }
        await attribute(s0, { day: full.day.slice(CORE), night: full.night.slice(1) }, end(), left, false);
      }
    }
    if (lastErr) res.notes.push('an error inside a frame: ' + lastErr);
    if (document.hidden || game.state !== 'play') res.notes.push('the game was paused or the page hidden during the run: run it again');
    res.dev.cv = device().cv; res.ms = Math.round(now() - t0);
    if (wantAA && res.ms > TOTAL + 35000) res.aaWhy = `left out: the run was already at ${mmss(res.ms)}`;   // a device this slow has told us enough
    else if (wantAA && res.spots.length) {   // MSAA: one reload without it, the day's baseline again where the page starts (no journey) and, if the time allows the journey, at the heaviest of the other spots
      const far = seen.slice(1).sort((a, b) => b.day.tot - a.day.tot)[0], pick = [s0.id, ...(far && res.ms + 24000 + far.load + 8000 < TOTAL + 15000 ? [far.id] : [])];
      store.aa = { res, pick, tries: 0, t: Date.now() }; delete store.run;
      if (save()) {   // (without storage the reload would know nothing of this run and start it again)
        restore(); say('BENCH  loading the page once more without MSAA, for the last measurement');
        const u = new URL(location.href); u.searchParams.set('aa', '0'); u.searchParams.set('bench', 'aa'); location.replace(u.href); await sleep(60000);
      }
      delete store.aa; res.aaWhy = 'left out: this browser keeps nothing between two loads (a private window?)';
    }
    res.aaWhy = res.aaWhy || (res.gl.aa ? 'not asked for (?benchaa=0)' : 'this page already runs without it');
    finish();
  }
  async function stage2() {
    const p = store.aa; res = p.res; p.tries = 1; save();
    t0 = now() - res.ms - Math.max(0, Date.now() - p.t); const keep = { dev: res.dev, gl: res.gl, warn: res.warn }; fixed(); await first(); const gl2 = res.gl; Object.assign(res, keep); res.aa0 = [];
    if (gl2.aa) { res.aaWhy = 'the page kept MSAA on at ?aa=0'; return finish(); }
    for (const id of p.pick) {
      const def = SPOTS.find(s => s[0] === id), on = res.spots.find(s => s.id === id), rest = p.pick.length - res.aa0.length;
      // the same hours in the same order as the first load: the crowd fills and thins slowly after a change of hour, and both loads must catch it at the same point
      const s = await spot(def, on.ord && on.ord[0] === 'night' ? ['night', 'day'] : ['day'], () => rest * 12000), w = m => m && { tot: m.tot, fps: m.fps, js: m.sjs, people: m.people };
      res.aa0.push({ id, name: s.name, on: { day: w(on.day), night: w(on.night) }, day: s.day, night: s.night });
    }
    res.ms = Math.round(now() - t0);
    finish();
  }
  function finish(head) {
    restore(); hold = true; strip.remove();   // the game stops drawing under the panel: the phone cools down for the next run
    store.last = res; delete store.run; delete store.aa; save();
    try { history.replaceState(null, '', cleanUrl()); } catch (e) { /* the address stays as it is */ }
    api.done = true; show(res, head);
  }

  const api = window.__pdBench = { done: false, res: null, text: () => text(shown, panel ? panel.dataset.head : ''), page: n => page(n), tap: null };   // for tools/perf/benchrun.mjs
  say('BENCH  loading');
  while (document.getElementById('loading')) await sleep(200);
  wrapAll();
  const go = (() => { try { const g = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return g === 'go'; } catch (e) { return false; } })() || Q.get('bench') === 'new';
  try {
    if (STAGE2 && !store.aa) { location.replace(cleanUrl()); return; }
    if (STAGE2 && store.aa.tries) { res = store.aa.res; res.aaWhy = 'the page without MSAA did not finish'; return finish(); }
    if (!STAGE2 && !go && store.run) { hold = true; strip.remove(); api.done = true; return show(store.run.res || {}, `THE LAST RUN STOPPED at "${store.run.step}" and the page was loaded again. If nobody closed or reloaded it, Safari ran out of memory there. What it had measured:`); }
    if (!STAGE2 && !go && store.last && Date.now() - Date.parse(store.last.at) < FRESH) { hold = true; strip.remove(); api.done = true; return show(store.last, ''); }
    // a phone held upright: the game waits behind its "turn your phone" prompt, and so does this
    while (coarse && innerHeight > innerWidth) { say('BENCH  turn the phone sideways to start'); await sleep(300); }
    while (document.hidden) await sleep(300);
    const st = game.settings, radio0 = st.radio; st.radio = 'off'; dispatchEvent(new Event('pd-music-setting')); addEventListener('pagehide', () => { st.radio = radio0; });   // no music: the radio would start on the tap below (src/radio.js). The saved choice is not touched.
    if (!(await lock()) && coarse) {   // no wake lock without a tap on this browser: ask for one over the whole screen (it must not dim or lock for four minutes)
      const css = strip.style.cssText; strip.style.cssText += ';bottom:0;display:flex;align-items:center;justify-content:center;font-size:20px;white-space:normal;text-align:center;pointer-events:auto;background:rgba(11,7,9,.9)';
      say(STAGE2 ? 'BENCH  tap once more for the last measurement' : 'BENCH  tap to start, then leave the phone alone for four minutes');
      await new Promise(r => { api.tap = r; strip.addEventListener('click', r, { once: true }); }); await lock(); strip.style.cssText = css;
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !api.done) lock(); else if (res && !api.done) res.notes.push('the page was hidden at ' + mmss(now() - t0)); });
    if (game.state !== 'play') game.state = 'play';
    await (STAGE2 ? stage2() : stage1());
  } catch (e) {
    if (!res) res = { notes: [] }; (res.notes = res.notes || []).push('the run failed: ' + String(e && e.stack || e).slice(0, 300));
    finish('THE RUN FAILED: ' + String(e && e.message || e).slice(0, 200));
  }
}
