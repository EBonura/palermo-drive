// ?bench: the device measures itself (docs/PERF.md, "The phone measures itself"). Open the link, wait, screenshot the four result pages or press Copy JSON. Nothing is sent anywhere.
// First the plain reading of every place, the lapa parked and the chase camera still: animation frames a second and the time between them as the player gets them, the game's own code
// (split by system), draw calls and triangles, by day and, while the tour's share of the run lasts, by night. This part always completes: only the waits around it shrink.
// Each reading also clocks the finished frame twice: by a fence (a marker in the GPU's queue after the frame, asked about from the tasks that follow) and by reading one pixel
// (the clock of tools/perf/gpucost.mjs). The two are shown side by side with one plain line saying what limits the place: the display, the game's code, or the GPU.
// On Viale Regione the lapa is also carried along the road for a few seconds, for the frames a player gets while the city streams in.
// Then, back where the tour began, each thing is switched off or changed inside the same page, in blocks that alternate with the page as shipped: the difference is its cost.
// The table VARIANTS further down is the list, in the order of what matters most; RELOADS is the list of the things only a second page load can change (MSAA).
// The whole run aims at TOTAL seconds whatever the device. Every wait has a cap that comes from the time left and from the frame times the device has shown, and what did not fit is named on the last page with the reason.
// These variants exist only here, to measure; several change the picture. main.js imports this file only for ?bench, and the production build keeps it out of the bundle (tools/build/build.mjs).
// No imports on purpose: everything comes from main.js through runBench(), so the file stands alone next to the bundle.
// Address parameters, all for tests: ?bs=qc,regione (places, the first is where the costs are measured), ?bv=sh0,flat (variants, measured whole however long they take), ?bt=120 (the budget in seconds),
// ?bclock=read|fence (the clock of the costs), ?benchaa=0 (no second page load), ?br=aa0 (these second page loads, whatever time they take), ?bench=new (run even if a fresh result is stored), ?benchpr=2 (render scale, for a desktop display).
const KEY = 'palermoDrive.bench.v2', OLDKEY = 'palermoDrive.bench.v1', FRESH = 20 * 60000;   // a result younger than this is shown again on a reload instead of a new run (Safari reloads a heavy tab when one comes back from another app)
const LAT0 = 38.11572, LON0 = 13.36126, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KZ = 110540;   // src/core.js proj
const ll = (lat, lon) => [+((lon - LON0) * KX).toFixed(1), +(-(lat - LAT0) * KZ).toFixed(1)];
const DAY = 12, NIGHT = 22.5;
const TOTAL = 300;     // seconds the whole run aims at, second page loads included
const TOUR = 0.56;     // the share of it the tour of the places may use before it starts leaving out the readings by night
const TOURMAX = 0.75;  // the share the tour may stretch to where places are slow to load: the waits are cut to fit it, the readings by day are never left out
const RELOAD = 0.22;   // the share second page loads may use; one that would take more is left out
const DRIVE = { at: 'regione', s: 25, v: 16 };   // the drive: where, for how many seconds, at how many m/s (the speed tools/perf/memory.mjs drives at)
// id, name, x, z, heading (none: the nearest road vertex, as ?at=x,z does). Quattro Canti, Ballarò and Viale Regione are the owner's test links, the rest the spots of tools/perf/gpucost.mjs.
// The tour starts where the page loads, goes to the far places first and comes back through the centre, so the way back to the first place for the costs is short.
const SPOTS = [
  ['qc', 'Quattro Canti', 15, 5],
  ['mondello', 'Mondello', -3033.1, -10177.4, -1.07],
  ['monreale', 'Monreale, Duomo', -6125, 3752, 1.25],
  ['regione', 'Viale Regione', ...ll(38.090479, 13.343314)],
  ['castiglia', 'Viale L. Castiglia', -2019, 18],
  ['ballaro', 'Ballarò', 24.9, 488.6, -2.01],
  ['vucciria', 'Vucciria', 210, -182],
];

export async function runBench(E) {
  const { game, renderer: R, scene: S, camera: C, vehicle, world, lean, sys, CHUNKS0, canvasStats } = E, shipped = E.cutoutsLast || null;
  const gl = R.getContext(), car = vehicle.car, Q = new URLSearchParams(location.search), STAGE2 = Q.get('bench') === 're', BUDGET = (+Q.get('bt') || TOTAL) * 1000;
  const now = () => performance.now(), sleep = ms => new Promise(r => setTimeout(r, ms)), r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const coarse = matchMedia('(pointer: coarse)').matches;
  let store = {}; try { store = JSON.parse(localStorage.getItem(KEY)) || {}; localStorage.removeItem(OLDKEY); } catch (e) { /* none, or no storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } };   // false in a private window: the result still shows, it just does not survive a reload
  // the address of this run without what the run itself adds: where "Run again" goes, and what the address bar shows at the end (a second page load carries the first page's own)
  let home = (() => { const u = new URL(location.href); u.searchParams.set('bench', ''); return u.pathname + u.search.replace(/bench=(&|$)/, 'bench$1'); })();

  // ---------- the frame loop: the game's animation callbacks run from here, so a frame can be timed to the moment the GPU has finished it, or held back altogether
  const raf = window.requestAnimationFrame.bind(window), px = new Uint8Array(4), each = new Set();
  let cbs = [], rid = 0, hold = false, waiters = [], lastT = 0, lastErr = '', lost = 0, gap = 0, nF = 0;
  let sync = 0;   // 0 free, 1 wait by reading a pixel, 2 a fence after each frame and the next frame held until it signals, 3 free with a fence after each frame
  window.requestAnimationFrame = cb => { cbs.push([++rid, cb]); return rid; };   // three asks for its next frame by name each time, so this takes over from the next frame on
  window.cancelAnimationFrame = h => { cbs = cbs.filter(c => c[0] !== h); };
  // The fence: a marker put in the GPU's queue after the frame's last command. It cannot be asked about in the task that made it (WebGL forbids it), so it is asked from the tasks after:
  // a message to ourselves again and again until it has signalled, and once more at the start of the next frame. No pixel is read and no antialiased buffer is resolved for it.
  // The asking keeps a core busy, which a phone may answer with a higher clock speed: the player's own figures (fps, intervals, code) are taken with no fence pending.
  const FENCE = typeof gl.fenceSync === 'function', pend = [], ch = new MessageChannel(); let polling = false;
  function poll() {
    const t = now();
    while (pend.length) {
      const f = pend[0], st = gl.clientWaitSync(f.s, 0, 0), gone = st === gl.WAIT_FAILED || (st === gl.TIMEOUT_EXPIRED && t - f.t1 > 2000);   // two seconds without a signal: this one is given up
      if (st === gl.TIMEOUT_EXPIRED && !gone) { f.no = t; break; }
      gl.deleteSync(f.s); pend.shift();
      if (gone) { lost++; f.o.lost = 1; } else { f.o.fd = t - f.t0; f.o.fl = (f.no || f.t1) - f.t0; }   // fd: signalled by now at the latest; fl: not yet signalled then (the truth lies between the two)
      if (f.w) { if (!gone) f.o.tot = f.o.fd; for (const r of f.w) r(f.o); }
    }
  }
  ch.port1.onmessage = () => { poll(); if (pend.length) ch.port2.postMessage(0); else polling = false; };
  function tick(t) {
    raf(tick);
    if (pend.length) poll();   // here it says whether the GPU had finished the last frame when this one began
    const q = pend.length;
    if (sync === 2 && q) return;   // the fence of the last frame has not signalled: this refresh goes by without a frame
    const o = { iv: t - lastT, js: 0, tot: 0, q }; lastT = t; nF++; if (o.iv > gap) gap = o.iv;
    let rode = false;
    if (!hold) {
      const run = cbs; cbs = [];
      const t0 = now();
      for (const c of run) { try { c[1](t); } catch (e) { lastErr = String(e && e.message || e).slice(0, 120); } }
      for (const f of each) f();
      const t1 = now(); o.js = t1 - t0;
      if (sync === 1) { const fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); }
      else if (sync >= 2 && FENCE && pend.length < 4) {
        const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
        if (s) { const f = { s, t0, t1, o, no: 0, w: null }; pend.push(f); if (sync === 2) { f.w = waiters; waiters = []; rode = true; } if (!polling) { polling = true; ch.port2.postMessage(0); } }
      }
      o.tot = now() - t0;
    }
    o.calls = R.info.render.calls; o.tris = R.info.render.triangles;
    if (rode) return;   // whoever waits for this frame hears of it when its fence signals
    const w = waiters; waiters = [];
    for (const r of w) r(o);
  }
  const frame = () => new Promise(r => waiters.push(r));
  raf(tick);
  const drain = async () => { for (const t = now(); pend.length && now() - t < 2500;) await frame(); };   // until no fence is pending
  // frames for at least `ms` and `min` of them on clock `s`; the first `skip` are thrown away (a switch has just been thrown). Past `until` it stops with what it has (two frames at least).
  async function take({ ms = 0, min = 1, max = 1e9, s = 0, skip = 2, until = Infinity }) {
    sync = +s; if (!sync) await drain();
    for (let i = 0; i < skip; i++) await frame();
    const F = [], t0 = now(); while (F.length < max && (F.length < min || now() - t0 < ms) && (F.length < 2 || now() < until)) F.push(await frame());
    return F;
  }
  // Safari's clock steps in whole milliseconds: one frame's time is useless, the mean over a chunk of frames (the top and bottom 15 % dropped) resolves a tenth
  const sorted = a => Float64Array.from(a).sort(), at = (s, p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const tmean = a => { const s = sorted(a), c = Math.floor(s.length * 0.15); let t = 0; for (let i = c; i < s.length - c; i++) t += s[i]; return t / Math.max(1, s.length - 2 * c); };
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const sem = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, a.length - 1) / a.length); };   // the standard error of a mean

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
      const btn = (t, fn) => { const b = mk('button', `font:700 12px/1 ${MONO};color:#0b0709;background:#e8559a;border:0;border-radius:6px;padding:7px 9px`, t); b.addEventListener('click', fn); bar.appendChild(b); return b; };
      ['1 places', '2 limits', '3 costs', '4 rest'].forEach((t, i) => btn(t, () => page(i)));
      const cp = btn('Copy JSON', async () => {
        const txt = JSON.stringify(shown); let ok = false;
        try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { const ta = mk('textarea', 'position:fixed;left:0;top:0;opacity:0'); ta.value = txt; panel.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e2) { /* no clipboard at all */ } ta.remove(); }
        cp.textContent = ok ? 'copied' : 'copy failed'; setTimeout(() => { cp.textContent = 'Copy JSON'; }, 1500);
      });
      btn('Run again', () => { try { sessionStorage.setItem(KEY, 'go'); } catch (e) { /* then the age rule decides */ } delete store.last; delete store.run; delete store.re; save(); location.replace(home); });
      bar.appendChild(mk('span', `font:500 10px/1 ${MONO};opacity:.6;margin-left:auto`, 'nothing is sent: screenshot the four pages or copy'));
      panel.append(box, bar); document.body.appendChild(panel);
      addEventListener('resize', () => page(pageNo));
    }
    panel.dataset.head = head || ''; page(pageNo);
  }
  function page(n) {
    const pages = text(shown, panel.dataset.head); pageNo = clamp(n | 0, 0, pages.length - 1); pre.style.transform = ''; pre.textContent = pages[pageNo];
    const b = pre.parentNode, k = Math.min(b.clientWidth / pre.offsetWidth, b.clientHeight / pre.offsetHeight, 1.35);   // the whole page on one screen, whatever the screen
    pre.style.transform = `scale(${k.toFixed(3)})`;
  }

  // ---------- the result as text: four pages a phone shows whole in landscape (no line over 120 characters, so the letters stay readable in a screenshot)
  function text(res, head) {
    const P = (s, n) => String(s).padEnd(n), L = (s, n) => String(s).padStart(n), f1 = v => Number.isFinite(v) ? v.toFixed(1) : '?', sg = (v, n = 1) => Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(n) : '?';
    const d = res.dev || {}, g = res.gl || {}, c = res.pic || {}, x = g.ext || [], has = n => x.includes(n) ? 'yes' : 'no', spots = res.spots || [], K = res.costs || {}, s0 = spots[0];
    const wrap = s => { const out = []; while (s.length > 120) { let k = s.lastIndexOf(' ', 120); if (k < 40) k = 120; out.push(s.slice(0, k)); s = '    ' + s.slice(k).trimStart(); } out.push(s); return out; };
    const lbl = id => (VARIANTS.find(v => v.id === id) || {}).label || id, secs = ms => f1(ms / 1000);
    const p1 = [], p2 = [], p3 = [], p4 = [];

    // 1: the places
    p1.push(`PALERMO DRIVE BENCH  ${res.ver || ''}  ${(res.at || '').slice(0, 16).replace('T', ' ')} UTC  took ${res.ms ? mmss(res.ms) : '(not finished)'}${res.total ? ' (aims at ' + mmss(res.total * 1000) + ')' : ''}  MSAA ${g.aa ? 'on x' + g.samples : 'off'}`);
    p1.push(`${d.model || '?'}${d.os ? ', ' + d.os : ''}${d.browser ? ' ' + d.browser : ''}  screen ${d.screen ? d.screen.join('x') : '?'} @${d.dpr}  page ${d.page ? d.page.join('x') : '?'}  canvas ${d.canvas ? d.canvas.join('x') : '?'} px (ratio ${d.ratio})  ${d.cores || '?'} cores`);
    p1.push(`${String(g.gpu || '?').slice(0, 44)}  ${String(g.ver || '').slice(0, 9)}  max texture ${g.lim ? g.lim.tex : '?'}  multi_draw ${has('WEBGL_multi_draw')}  parallel compile ${has('KHR_parallel_shader_compile')}  GPU timer ${has('EXT_disjoint_timer_query_webgl2')}`);
    p1.push(`display ${d.hz ? d.hz + ' Hz' : '?'} (${f1(d.idle)} animation frames a second with nothing drawn)  clock step ${d.clock} ms  page ready after ${secs(d.load)} s  screen kept awake: ${d.wake ? 'yes' : 'NO'}`);
    p1.push(`canvas memory ${d.cv ? f1(d.cv.mb) + ' MB in ' + d.cv.n + ' canvases, peak ' + f1(d.cv.peakMB) : '?'}  mediump ${g.mediump || '?'} bits  weather by the schedule: ${res.wx || '?'} (measured under fair weather)`);
    for (const w of res.warn || []) p1.push('! ' + w);
    p1.push('');
    const H = '   fps  med/p95/max  code';
    p1.push(P('', 19) + P('  ------------ day, 12:00 ------------', 40) + '  ------- night, 22:30 --------');
    p1.push(P('place', 19) + H + ' draws tris k' + '  ' + H + ' draws  wait s');
    const cell = (m, tris, none) => m ? L(f1(m.fps), 6) + L(m.iv.map(Math.round).join('/'), 13) + L(f1(m.js), 6) + L(m.calls, 6) + (tris ? L(Math.round(m.tris / 1000), 7) : '') : P(none, tris ? 38 : 31);
    const row = (name, s, night) => P(name, 19) + cell(s.day, 1, '   (not measured)') + '  ' + cell(night, 0, s.noNight ? '   (left out: no time)' : '') + L(secs(s.wait), 8) + (s.settled && s.quiet ? '' : s.settled ? ' ~' : ' *');
    for (const s of spots) p1.push(row(s.name, s, s.night));
    if (res.again) p1.push(row('  again, at end', res.again, null));
    p1.push('fps and the ms between animation frames (median/95th/longest) as the player gets them. code: the game\'s own code in a frame, ms. draws, tris: the draw calls and thousands of triangles of one frame.');
    p1.push('wait: seconds from setting off for the place to its being ready.' + (spots.some(s => !s.settled) ? ' *: measured before all of it had loaded.' : '') + (spots.some(s => s.settled && !s.quiet) ? ' ~: loaded, with building still going on out of view.' : '') + (spots.some(s => s.pend) ? ' Page 4 says what was still to do.' : ''));
    const D = res.drive;
    if (D) p1.push(D.na ? `drive: not done (${D.na})` : `drive, Viale Regione: ${D.m} m in ${D.s} s at ${D.v} m/s, ${D.n} frames. ms between frames: median ${f1(D.iv[0])}, 95th ${f1(D.iv[1])}, worst ${f1(D.iv[2])}; ${D.over50} over 50 ms, ${D.over33} over 33. code ${f1(D.js[0])} (95th ${f1(D.js[1])}), streaming at most ${f1(D.stream.max)} ms a frame.${D.worst ? ` Longest frame of code ${f1(D.worst.js)} ms at ${D.worst.m} m: ${Object.entries(D.worst.split).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => k + ' ' + f1(v)).join(', ')}.` : ''} The lapa is carried along the road: no driving physics.`);
    const ppl = spots.filter(s => s.day);
    if (ppl.length) p1.push('people there, day/night (a crowd fills and thins slowly after a change of place or hour): ' + ppl.map(s => `${s.name} ${s.day.people}/${s.night ? s.night.people : '-'}`).join(', '));

    // 2: what limits each place, the two clocks side by side
    const hz = d.hz || 60, LIM = m => { const l = m.lim || {}, k = `1 frame in ${l.k}`; return l.by === 'display' ? 'the display' : l.by === 'spikes' ? `the display, with misses (95th ${Math.round(m.iv[1])} ms)` : l.by === 'code' ? (l.also ? `the game's code and the GPU, ${k}` : `the game's code, ${k} refreshes`) : l.by === 'gpu' ? `the GPU, ${k} refreshes` : l.by === 'held' ? `held back, ${k}: not code, not GPU` : '?'; };
    const g1 = v => Math.abs(v) >= 100 ? String(Math.round(v)) : f1(v), aft = (a, b) => a !== undefined && b !== undefined ? '+' + g1(Math.max(0, a - b)) : '';
    p2.push(`WHAT LIMITS EACH PLACE  The display shows a frame every ${f1(1000 / hz)} ms at best (${hz} Hz). All in ms, the page as shipped.`);
    p2.push(P('place', 19) + P('hour', 6) + L('between', 8) + L('code', 6) + L('fence', 7) + L('+gpu', 6) + L('late', 5) + L('read', 7) + L('+gpu', 6) + '  what limits it');
    const lrow = (name, tm, m) => P(name, 19) + P(tm, 6) + L(g1(m.iv[0]), 8) + L(g1(m.js), 6) + L(m.fd !== undefined ? g1(m.fd) : 'none', 7) + L(aft(m.fd, m.fjs), 6) + L(m.late !== undefined ? Math.round(m.late * 100) + '%' : '', 5) + L(g1(m.tot), 7) + L(aft(m.tot, m.sjs), 6) + '  ' + LIM(m);
    for (const s of spots) { if (s.day) p2.push(lrow(s.name, 'day', s.day)); if (s.night) p2.push(lrow(s.day ? '' : s.name, 'night', s.night)); }
    if (res.again && res.again.day) p2.push(lrow('  again, at end', 'day', res.again.day));
    p2.push('between: from one animation frame to the next, the median. code: the game\'s own code in a frame. Both as the player gets them, nothing asked of the GPU.');
    p2.push('fence: from the start of that code to the GPU having finished, by a marker in its queue that is asked about from the tasks after the frame. Nothing is read back and the frames run free. late: the frames that began while the GPU was still on the one before. +gpu: what was left of the span after the code of those same frames (the browser\'s drawing process and the GPU).');
    p2.push('read: the same span by reading one pixel back after each frame, which makes the page wait for the GPU. On a GPU that draws in tiles that wait changes how the frame is drawn, so where the two differ the fence disturbs less (asking about it keeps one core busy, though).');
    p2.push('What limits: the display when every refresh gets its frame. Else the code, when it alone is longer than the refreshes the frame has. Else the GPU, when the picture is not finished within them (by the fence; by the read where there is none). Else the page is held back by something else: a cap of the browser, Low Power Mode, heat.');
    if (res.clock) p2.push(`The costs on page 3 were clocked by ${res.clock === 'fence' ? 'the fence, the next frame held until it signals' : 'the read'}${res.clockWhy ? ' (' + res.clockWhy + ')' : ''}.`);
    const heavy = spots.slice(1).filter(s => s.day).sort((a, b) => b.day.js - a.day.js)[0];
    const sp = (s, tm) => { const m = s && s[tm]; if (m && m.split) p2.push(`code at ${s.name}, ${tm}: ` + Object.entries(m.split).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')); };
    sp(s0, 'day'); sp(s0, 'night'); sp(heavy, 'day');
    p2.push('  ms a frame. draw: three.js walking, sorting and issuing the frame (shadow: the shadow pass inside it). rest: physics, camera, HUD text. Every place is in the JSON.');

    // 3: the costs
    p3.push(`WHAT EACH THING COSTS at ${K.at || '?'}: the finished frame with the thing off or changed, against the page as shipped in alternating blocks.`);
    p3.push('ms: the change of the frame (minus: faster without it), ± its standard error. js: the part that is the game\'s code (iv: the change between animation frames instead, for what the page composes outside the frame). base: the frame as shipped beside it. s: seconds it took.');
    p3.push('~ inside its own noise (under twice the error)   ! cut short by its cap   x2, x3: measured again and pooled, because the noise hid it   (1): one round, no error to give');
    const vcell = (id, v) => {
      if (v.na) return P(P(lbl(id), 24) + ' ' + ('not measured: ' + v.na), 60).slice(0, 59) + ' ';
      const mark = (v.cut ? '!' : '') + (v.e !== undefined && Math.abs(v.d) < 2 * v.e ? '~' : '') + (v.rep ? 'x' + (v.rep + 1) : '');
      return P(lbl(id), 24) + L(sg(v.d), 7) + L(v.e !== undefined ? '±' + v.e.toFixed(1) : '(1)', 6) + L(v.di !== undefined ? 'iv' + sg(v.di) : sg(v.js), 8) + L(f1(v.base), 6) + L(Math.round(v.t / 1000), 4) + ' ' + P(mark, 4);
    };
    const VH = P('', 24) + L('ms', 7) + L('±', 6) + L('js', 8) + L('base', 6) + L('s', 4) + P('', 5);
    for (const tm of ['day', 'night']) {
      const ids = Object.keys(K[tm] || {}); if (!ids.length) continue;
      p3.push(P(tm === 'day' ? 'BY DAY' : 'BY NIGHT', 24) + VH.slice(24) + (ids.length > 1 ? VH : ''));
      for (let i = 0; i < ids.length; i += 2) p3.push(vcell(ids[i], K[tm][ids[i]]) + (ids[i + 1] ? vcell(ids[i + 1], K[tm][ids[i + 1]]) : ''));
    }
    if (!K.day && !K.night) p3.push('(nothing measured: see page 4)');
    const dr = K.drift || [];
    if (dr.length > 1) { const b = dr.map(q => q[1]), lo = Math.min(...b), hi = Math.max(...b); p3.push(`The frame as shipped while the costs ran: ${f1(b[0])} ms at the first, ${f1(b[b.length - 1])} at the last, lowest ${f1(lo)}, highest ${f1(hi)}, over ${dr[dr.length - 1][0] - dr[0][0]} s. ${hi > lo * 1.2 + 1 ? 'It drifted (heat, or the place still changing): read each cost against its own base.' : 'It held steady.'}`); }
    p3.push('Hidden things stay in the cached shadow map. A plus on "three\'s old draw order" is what the shipped order saves. What did not fit in the time is listed on page 4.');

    // 4: the rest
    const px = res.px, base = K.day && Object.values(K.day).find(v => v.base);
    if (px && px.pts && px.pts.length) {
      p4.push(`PIXELS, at ${K.at}: the frame at lower render scales against the page as shipped: ` + px.pts.map(q => `${lbl(q[0])} (${(q[1] * 100).toFixed(q[1] < 0.1 ? 1 : 0)} % of the pixels) ${sg(q[2])}${q[3] ? ' ±' + q[3].toFixed(1) : ''}`).join(',  '));
      if (px.b !== undefined) p4.push(`  A line through the step${px.n > 1 ? 's' : ''} down to half: all the pixels together cost about ${f1(px.b)} ms ±${f1(px.se)}${base ? ' of the ' + f1(base.base) + ' ms frame' : ''}${px.n > 1 ? ` (the steps miss the line by up to ${f1(px.miss)} ms)` : ''}.${Math.abs(px.b) < 2 * px.se ? ' That is inside its own noise: here the pixels cost too little for this run to price.' : ''}`);
      if (px.tiny !== undefined) p4.push(`  At 1/8 the frame ${px.tiny >= 0 ? 'loses ' + f1(px.tiny) + ' ms' : 'is no faster (' + sg(-px.tiny) + ' ms)'} where that line says ${f1(px.line)}. ` + (px.tiny - px.line > Math.max(2 * (px.se || 0), 0.1 * (base ? base.base : 0), 1) ? `The other ${f1(px.tiny - px.line)} ms go with the size of the picture without being a cost per pixel.` : 'No further than the noise from it: nothing but the pixels shows in what the size of the picture costs here.'));
    } else p4.push('PIXELS: no render scale step was measured.');
    p4.push('  What each step can say. 0.85 and 0.7 stay near the real size: the same tiles and texture levels, so they show what a small change of resolution would give, but the effect is small and often inside its noise. Half is a quarter of the pixels and still mostly pixel work. 1/8 leaves next to no pixels: what remains of the frame is what does not depend on its size (the game\'s code, draw calls, vertices, the shadow pass). It cannot price a pixel: on a GPU that draws in tiles the tiles, their lists and the antialiasing resolve shrink with the picture, and textures are read at smaller levels.');
    for (const r of res.re || []) {
      if (r.na) { p4.push(`SECOND PAGE LOAD, ${r.label}: not measured (${r.na})`); continue; }
      const a = r.was, b = r.now, far = Math.abs(a.people - b.people) > 0.1 * Math.max(a.people, b.people, 10);
      p4.push(`SECOND PAGE LOAD, ${r.label} (?${r.q}, to measure: never an option), ${s0 ? s0.name : ''} by day, before to after: fps ${f1(a.fps)} to ${f1(b.fps)}, between frames ${f1(a.iv[0])} to ${f1(b.iv[0])} ms, code ${f1(a.js)} to ${f1(b.js)}, fence ${f1(a.fd)} to ${f1(b.fd)}, read ${f1(a.tot)} to ${f1(b.tot)}; ${a.people} and ${b.people} people${far ? ': too different a crowd for a fair pair' : ''}`);
    }
    const drop = res.drop || [];
    p4.push('LEFT OUT: ' + (drop.length ? drop.map(q => `${q[0]} (${q[1]})`).join('; ') : 'nothing'));
    const todo = q => [q.tile && 'the tile under the lapa in full detail', q.vis && q.vis + ' things in view', q.boxes && q.boxes + ' bounding boxes', q.jobs && q.jobs + ' building jobs', q.net && q.net + ' downloads'].filter(Boolean).join(', ') || 'the frames had not calmed down';
    const un = [...spots, ...(res.again ? [{ ...res.again, name: (s0 ? s0.name : '') + ' again' }] : [])].filter(s => s.pend);
    if (un.length) p4.push('NOT READY WHEN MEASURED (still to do after the wait): ' + un.map(s => `${s.name} after ${secs(s.wait)} s: ${todo(s.pend)}`).join('; '));
    const slow = []; for (const tm of ['day', 'night']) for (const [id, v] of Object.entries(K[tm] || {})) if (v.w > 3000 && (v.w > 0.5 * v.t || v.mx > 2000)) slow.push(`${lbl(id)}${tm === 'night' ? ' by night' : ''}: ${secs(v.w)} of its ${secs(v.t)} s waiting for the frames to calm down after the switch, the longest gap between frames ${secs(v.mx)} s`);
    if (slow.length) p4.push('SLOW SWITCHES: ' + slow.join('; '));
    const p16 = spots.filter(s => s.p16 && s.p16[0]).sort((p, q) => q.p16[1] - p.p16[1])[0];
    if (c.ground !== undefined) p4.push(`ground: ${c.ground > 1 ? 'drawn' : 'NOT DRAWN?'} (${c.ground} % of the picture changes when it is hidden, ${K.at})  parts against whole meshes: ${c.whole} % differs`);
    if (p16 || c.ground !== undefined) p4.push(`16-bit meshes drawn by parts: ${p16 && p16.p16[1] > 0.05 ? `drawn (${p16.p16[0]} of them are ${p16.p16[1]} % of the picture at ${p16.name})` : 'none in view at any place, so this run cannot tell'}`);
    if (c.order0 !== undefined) p4.push(`same picture? three's old order against the shipped one: ${c.order0} % of the pixels differ; front to back against shipped: ${c.sort} % (the same frame drawn twice: ${c.self} %)`);
    p4.push('Only when asked (each compiles every program again, tens of seconds on a phone): ' + VARIANTS.filter(v => v.heavy).map(v => v.id).join(', ') + '. Ask with ?bench&bv=sh0,flat');
    p4.push('A web page is told neither how hot the phone is nor whether Low Power Mode is on' + (has('EXT_disjoint_timer_query_webgl2') === 'yes' ? '.' : ', and this browser gives it no GPU timer.'));
    for (const n of res.notes || []) p4.push('note: ' + n);
    return [p1, p2, p3, p4].map(p => (head ? [head, '', ...p] : p).flatMap(wrap).join('\n'));
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
  const draw0 = n => { const d = lean && lean.draw; if (!d) return 'engine-lean is off (?engine=off)'; if (!d[n]) return `the page already runs without it (?draw=)`; d[n] = false; return () => { d[n] = true; }; };
  const V = {
    sh0: () => { R.shadowMap.enabled = false; recompile(); return () => { R.shadowMap.enabled = true; recompile(); }; },
    shpass0: () => { R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; return () => { R.shadowMap.autoUpdate = true; }; },
    shrecv0: () => { const Ls = []; S.traverse(o => { if (o.receiveShadow) { o.receiveShadow = false; Ls.push(o); } }); return Ls.length ? () => Ls.forEach(o => { o.receiveShadow = true; }) : 'nothing receives shadows'; },   // receiveShadow is a uniform: the lookups sit behind a branch on it, so no program changes
    shoff: () => { const b = V.shrecv0(); if (typeof b !== 'function') return b; const a = V.shpass0(); return () => { a(); b(); }; },   // what sh0 measures, less the little a compiled-out lookup saves over a branched-out one
    blit0: () => { const b = gl.blitFramebuffer; gl.blitFramebuffer = function (...a) { if (a[8] & gl.DEPTH_BUFFER_BIT) return; return b.apply(this, a); }; return () => { gl.blitFramebuffer = b; }; },
    half: ratio(0.5), tiny: ratio(0.125), r85: ratio(0.85), r70: ratio(0.7),
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
    // the three parts of the draw path (docs/PERF.md, "The draw path"), one off at a time; a part left out in the address (?draw=) is out already
    tree0: () => draw0('tree'), quick0: () => draw0('quick'), uni0: () => draw0('uni'),
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

  // ---------- THE LIST. One line adds a variant: an id (its key in the JSON), a label of at most 24 characters, and a function that makes the change and returns its undo
  // (or returns a string saying why it cannot be done in this page). In the order of what matters most on a slow phone: a run that is out of time leaves out the end of the list.
  //   at: 'night' measures it by night instead of by day, 'both' at both hours
  //   rounds, warm: how many times it is switched, and the frames thrown away after each switch (a resize cannot flip every third of a second)
  //   slow: ms to wait after the switch (the weather)        free: also measured by the time between animation frames (what the page composes outside the frame)
  //   heavy: compiles every program again, so it runs only when asked for by ?bv=        ask: only when asked for, for another reason
  const VARIANTS = [
    { id: 'sort', label: 'front to back, cuts last', on: V.sort },
    { id: 'shoff', label: 'shadows off', on: V.shoff, at: 'both' },
    { id: 'ground0', label: 'terrain, streets hidden', on: V.ground0 },
    { id: 'build0', label: 'buildings hidden', on: V.build0 },
    { id: 'hud0', label: 'HUD, page layers hidden', on: V.hud0, free: true },
    { id: 'half', label: 'half render scale', on: V.half, rounds: 2, warm: 5 },
    { id: 'tiny', label: 'render scale 1/8', on: V.tiny, rounds: 2, warm: 5 },
    { id: 'lean0', label: 'engine-lean bypassed', on: V.lean0 },
    { id: 'quick0', label: 'repeat draws not quick', on: V.quick0 },
    { id: 'tree0', label: 'occlusion rays, no tree', on: V.tree0 },
    { id: 'uni0', label: 'array uniforms resent', on: V.uni0 },
    { id: 'r70', label: 'render scale 0.7', on: V.r70, rounds: 2, warm: 5 },
    { id: 'crowd0', label: 'crowd hidden', on: V.crowd0 },
    { id: 'traffic0', label: 'traffic hidden', on: V.traffic0 },
    { id: 'props0', label: 'props, trees, stalls off', on: V.props0 },
    { id: 'shrecv0', label: 'shadow lookups skipped', on: V.shrecv0 },
    { id: 'shpass0', label: 'shadow pass skipped', on: V.shpass0 },
    { id: 'order0', label: 'three\'s old draw order', on: V.order0 },
    { id: 'transp0', label: 'see-through things off', on: V.transp0 },
    { id: 'r85', label: 'render scale 0.85', on: V.r85, rounds: 2, warm: 5 },
    { id: 'clouds0', label: 'clouds and shadows off', on: V.clouds0 },
    { id: 'csh0', label: 'cloud shadows off', on: V.csh0 },
    { id: 'whole', label: 'parts drawn whole', on: V.whole },
    { id: 'balloons', label: '12 speech balloons shown', on: V.balloons, free: true },
    { id: 'rain', label: 'rain, not fair weather', on: V.rain, slow: 2500 },
    { id: 'wash0', label: 'night wash off', on: V.wash0, at: 'night' },
    { id: 'sh0', label: 'shadows compiled out', on: V.sh0, heavy: true },
    { id: 'flat', label: 'every pixel flat', on: V.flat, heavy: true },
    { id: 'shade0', label: 'shading.js chunks off', on: V.shade0, heavy: true },
    { id: 'lamps0', label: 'lamps, headlights off', on: V.lamps0, at: 'night', heavy: true },
    { id: 'fog0', label: 'fog off', on: V.fog0, heavy: true },
    { id: 'tone0', label: 'tone mapping off', on: V.tone0, heavy: true },
    { id: 'env0', label: 'sky reflection off', on: V.env0, heavy: true },
    { id: 'mediump', label: 'mediump fragments', on: V.mediump, heavy: true },
    { id: 'alpha0', label: 'cut-outs solid', on: V.alpha0, heavy: true },
    { id: 'cutout0', label: 'cut-outs hidden', on: V.cutout0, ask: true },
    { id: 'blit0', label: 'shadow cache copy off', on: V.blit0, ask: true },
  ];
  // What only a second page load can change. One line each: an id, a label, the address parameters to add, and (if it can tell) off(): true when the page it runs in is already like that.
  // Each costs a whole page load, so they come last, only while they fit in their share of the run (RELOAD), and each repeats one reading: the first place by day.
  const RELOADS = [
    { id: 'layers0', label: 'HUD without own layers', q: 'layers=0', off: () => Q.get('layers') === '0' },
    { id: 'ctxold', label: 'three\'s own context', q: 'ctx=old', off: () => (Q.get('ctx') || '').split(',').includes('old') },
    { id: 'aa0', label: 'MSAA off', q: 'aa=0', off: () => !gl.getContextAttributes().antialias },
  ];

  // ---------- one variant against the page as shipped, in alternating blocks (A B A B ...): drift, heat and the traffic passing by cancel as far as they can
  // Each block with the thing changed is compared with the mean of the two blocks as shipped on either side of it. d is the mean of those differences and e their standard error.
  let fms = 16.7, gms = 16.7;   // what the device has shown at its last reading: ms between frames, ms of the finished frame. The waits and caps below scale with them.
  let CLK = 1, carry = null, W0 = 0, H0 = 0;   // the clock of the costs (1 read, 2 fence held); the closing block of one variant opens the next; the drawing buffer as shipped
  const POOL = new Map(), DRIFT = [];   // a variant measured again adds to what it had; the frame as shipped beside each variant, in the order they ran
  const pfrac = () => W0 ? gl.drawingBufferWidth * gl.drawingBufferHeight / (W0 * H0) : 1;
  async function block(clk, until) {
    const F = await take({ ms: clk ? 230 : 420, min: 6, max: 45, s: clk, skip: 1, until }), tot = tmean(F.map(f => f.tot));
    return { v: clk ? tot : mean(F.map(f => f.iv)), tot, js: tmean(F.map(f => f.js)), calls: mean(F.map(f => f.calls)) };
  }
  // After a switch frames are thrown away until three in a row are back near the usual time: the first frames of a variant compile its programs, and on a phone that can be seconds over several frames.
  // false: it never calmed down (the variant is then given up, and shown as not measured rather than with a number that is the compiler's).
  async function calm(ref, clk, warm, max) {   // max: ms allowed after the first frame, which may be one long compile
    sync = clk; if (!clk) await drain();
    for (let t = 0, n = 1, ok = 0; ; n++) { const f = await frame(); if (n === 1) t = now(); ok = f.tot < ref * 4 + 5 ? ok + 1 : 0; if (n >= warm && ok >= 3) return true; if (now() - t > max) return false; }
  }
  // one go at a variant on one clock, to be over by `until`: a round that no longer fits is not begun, and the waits shrink to what is left (a frame that is already running cannot be cut)
  async function pass(v, clk, st, until) {
    const A = [], B = [], warm = v.warm || 3, wait = v.heavy ? 30000 : clamp(60 * fms, 3000, 6000); let stale = false;
    const settle = async ref => { const t = now(), ok = await calm(ref, clk, warm, clamp(until - now(), 500, wait)); st.w += now() - t; return ok; };
    A.push(carry && carry.clk === clk && now() - carry.t < 300 ? carry.b : await block(clk, until));
    const rounds = v.slow ? 1 : !clk ? 2 : v.rounds || (Math.max(fms, gms) > 40 ? 2 : 3);
    for (let r = 0, tr = 0; r < rounds; r++) {
      if (r && now() + tr > until) { st.cut = 1; break; }
      const ts = now(); let off, ok = false;
      try { off = v.on(); } catch (e) { off = String(e && e.message || e).slice(0, 80); }
      if (typeof off !== 'function') return { na: off || 'not available' };
      try {
        if (v.slow) await sleep(v.slow);
        ok = await settle(A[0].tot);
        if (ok) { const p = pfrac(); if (Math.abs(p - 1) > 0.01) st.p = +p.toFixed(4); B.push(await block(clk, until)); }
      } finally { off(); }
      if (v.slow) await sleep(v.slow);
      await settle(A[0].tot);
      if (!ok) { stale = true; if (!B.length) { carry = null; return { na: 'the frames did not calm down after the switch' }; } st.cut = 1; break; }
      A.push(await block(clk, until)); tr = now() - ts;
    }
    carry = stale ? null : { b: A[A.length - 1], t: now(), clk };
    return { D: B.map((b, r) => b.v - (A[r].v + A[r + 1].v) / 2), A, B };
  }
  // A variant's figure, pooled over every time it was measured in this run. Its cap comes from the frame time the device has shown: none can take minutes.
  // t: ms it took in all, w: of which waiting for the frames to calm down, mx: the longest gap between two frames, fr: frames.
  async function measure(v, tm) {
    const key = tm + ':' + v.id, st = POOL.get(key) || { D: [], Di: [], a: [], js: [], calls: [], t: 0, w: 0, mx: 0, fr: 0, n: 0 }; POOL.set(key, st);
    const cap = (v.heavy ? 90000 : clamp(120 * Math.max(fms, gms), 8000, 20000)) + (v.slow ? 4 * v.slow : 0), tv = now(), f0 = nF; gap = 0; delete st.na;
    const r = await pass(v, CLK, st, tv + cap);
    if (r.na) st.na = r.na;
    else {
      st.D.push(...r.D); st.a.push(...r.A.map(q => q.v)); st.js.push(mean(r.B.map(q => q.js)) - mean(r.A.map(q => q.js))); st.calls.push(mean(r.B.map(q => q.calls)) - mean(r.A.map(q => q.calls)));
      DRIFT.push([Math.round((now() - t0) / 1000), r2(mean(r.A.map(q => q.v)))]);
      if (v.free) { const q = await pass(v, 0, st, now() + cap / 2); if (!q.na) st.Di.push(...q.D); }
    }
    st.t += now() - tv; st.mx = Math.max(st.mx, gap); st.fr += nF - f0; st.n++;
    const o = { t: Math.round(st.t), w: Math.round(st.w), mx: Math.round(st.mx), fr: st.fr };
    if (!st.D.length) return { na: st.na || 'cut short before one full round', ...o };
    const d = mean(st.D), a = mean(st.a);
    Object.assign(o, { d: r2(d), n: st.D.length, base: r2(a), pct: r1(d / a * 100), js: r2(mean(st.js)), calls: Math.round(mean(st.calls)) });
    if (st.D.length > 1) o.e = r2(sem(st.D));
    if (st.Di.length) { o.di = r2(mean(st.Di)); if (st.Di.length > 1) o.de = r2(sem(st.Di)); }
    if (st.p) o.p = st.p; if (st.cut) o.cut = 1; if (st.n > 1) o.rep = st.n - 1;
    return o;
  }
  // The pixels' share from the render scale steps: a line d = b (p - 1) through the steps down to half (p: the share of the pixels still drawn), by least squares.
  // b is what all the pixels cost if the cost goes with their number; 1/8 is then set against what the line says for it.
  function pixels(Cd) {
    const pts = []; for (const id of ['r85', 'r70', 'half', 'tiny']) { const r = Cd && Cd[id]; if (r && !r.na && r.p) pts.push([id, r.p, r.d, r.e || 0]); }
    const fit = pts.filter(q => q[0] !== 'tiny'), tiny = pts.find(q => q[0] === 'tiny'), o = { pts };
    if (fit.length) {
      let sxx = 0, sxy = 0, se = 0; for (const q of fit) { const x = q[1] - 1; sxx += x * x; sxy += x * q[2]; se += q[3] * q[3] * x * x; }
      const b = sxy / sxx; o.b = r2(b); o.se = r2(Math.sqrt(se) / sxx); o.n = fit.length; o.miss = r2(Math.max(...fit.map(q => Math.abs(q[2] - b * (q[1] - 1)))));
      if (tiny) { o.tiny = r2(-tiny[2]); o.line = r2(b * (1 - tiny[1])); }
    }
    return o;
  }
  // ---------- the same instant drawn two ways inside one task (nothing moves in between): the share of pixels that differ by more than 8 of 255
  function grab() { const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4), fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); return a; }
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) n++; return +(n / (a.length / 4) * 100).toFixed(3); };
  async function pictures() {
    sync = 0; await drain(); await frame();
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
    sync = 0; await drain(); await frame();
    R.render(S, C); const a = grab(); g.forEach(o => { o.visible = false; }); R.render(S, C); const b = grab(); g.forEach(o => { o.visible = true; });
    return [g.length, differ(a, b)];
  }

  // ---------- getting somewhere and waiting until it is all there
  const tileFull = () => { const i = Math.floor(car.x / 500), j = Math.floor(car.z / 500); for (const t of world.tiles.values()) if (t.i === i && t.j === j) return t.lod === 2; return false; };
  const leanIdle = () => !lean || !lean.stats().pendingBoxes;
  // the crowd walks in a few people a frame and thins out one a frame (src/pedestrians.js): wait until it is near what the place and the hour want, but not for ever
  async function crowd(max) { const ps = sys.pedestrians && sys.pedestrians.stats; for (let t0 = now(); ps && now() - t0 < max; await sleep(200)) if (!(ps.target > 0) || (ps.count >= ps.target * 0.85 && ps.count <= ps.target * 1.3 + 6)) break; }
  async function steady(max = 1500) {   // until a dozen frames in a row hold no outlier: the builders and the shader compiles have gone quiet (by the frames' own times, whatever the device's speed)
    sync = 0; await drain(); const t = now(), F = [];
    while (now() - t < max) { F.push((await frame()).js); if (F.length > 12) F.shift(); if (F.length === 12) { const q = sorted(F); if (q[11] < q[6] * 1.8 + 2) return true; } }
    return false;
  }
  // The journey and the wait, within `cap` ms. The streamer builds at the pace it has behind a loading screen (world.hurry) for as long as this lasts, and is asked every 150 ms:
  // settled: the tile under the lapa is at full detail, nothing in view is still to come and the engine has its boxes; quiet: no job left, or nothing built for a second.
  // When the cap ends the wait, pend says what was still to do, and the reading is taken all the same.
  async function arrive(x, z, th, cap) {
    const t = now(), h0 = world.hurry, o = { settled: false, quiet: false }; world.hurry = true;
    try {
      if (Math.abs(game.time.hour - DAY) > 0.02) sys.dayNight.jumpTo(DAY);   // every place is read by day first: the sky turns during the journey
      await new Promise(done => { const k = setTimeout(done, Math.max(3000, 0.6 * cap)); try { vehicle.placeAt(x, z, th); } catch (e) { /* no road yet */ } world.teleport(x, z, () => { clearTimeout(k); done(); }); });
      try { vehicle.placeAt(x, z, th); } catch (e) { /* still no road: the note below says where the lapa stands */ }
      vehicle.camState.mode = 1; vehicle.camState.init = false;
      let st = world.stats(), built = st.built;
      for (let flags = 0, idle = 0, still = 0; ; await sleep(150)) {
        st = world.stats(); const f = tileFull() && world.visiblePending() === 0 && leanIdle();
        flags = f ? flags + 1 : 0; idle = !st.queued && !st.pending && !st.inflight ? idle + 1 : 0; still = st.built === built ? still + 1 : 0; built = st.built;
        if (flags >= 3 && (idle >= 2 || still >= 7)) { o.settled = o.quiet = true; break; }
        if (idle >= 7) { o.quiet = true; break; }   // nothing left to do, and still not all there: it will not come
        if (now() - t > cap) { o.settled = flags >= 3; break; }
      }
      if (!o.settled || !o.quiet) o.pend = { tile: tileFull() ? 0 : 1, vis: world.visiblePending(), boxes: lean ? lean.stats().pendingBoxes || 0 : 0, jobs: st.queued + st.pending, net: st.inflight };
    } finally { world.hurry = h0; }
    await steady(1500);
    o.wait = Math.round(now() - t);
    return o;
  }
  async function setTime(h) {
    if (Math.abs(game.time.hour - h) > 0.02) { sys.dayNight.jumpTo(h); await sleep(1500); for (let t = now(); h === NIGHT && !sys.dayNight.lampsBuilt && now() - t < 3000;) await sleep(100); }   // the sky sweeps for 1.3 s, then the lamps of the tiles light up
    await crowd(clamp(150 * fms, 2500, 7000)); await steady(1500);
  }

  // ---------- the plain reading: the page as shipped where the lapa stands, at the hour it is
  let fenceOK = null;   // null until the first reading has seen whether fences signal here
  // What limits the place, from the reading itself. P: ms between two refreshes of the display.
  function verdict(m, hz) {
    const P = 1000 / hz;
    if (1000 / m.fps <= 1.15 * P) return { by: 'display' };
    if (m.iv[0] <= 1.15 * P && m.js <= 0.92 * P) return { by: 'spikes' };   // most frames are on time and the code fits in a refresh: the misses are the tail
    // a frame every k refreshes (by the median when it is over a refresh: one long hitch must not move it): what took k - 1 of them and more?
    const k = Math.max(2, Math.round((m.iv[0] > 1.15 * P ? m.iv[0] : 1000 / m.fps) / P)), room = (k - 1) * P * 0.92, fenced = m.fd !== undefined;
    const after = Math.max(0, fenced ? m.fd - m.fjs : m.tot - m.sjs);   // what follows the code, taken inside the batch that was clocked: the three batches of a reading do not have the same code time on a busy device
    if (m.js > room) return after > P * 0.92 ? { by: 'code', k, also: 'gpu' } : { by: 'code', k };
    return { by: m.js + after > room || m.late > 0.3 ? 'gpu' : 'held', k };
  }
  async function reading() {
    // 1. as the player gets it: free running frames, no fence pending, nothing read back
    const s0 = snap(), F = await take({ ms: 1100, min: 24, max: 120 }), s1 = snap();
    const iv = sorted(F.map(f => f.iv)), js = tmean(F.map(f => f.js)), ps = sys.pedestrians && sys.pedestrians.stats, last = F[F.length - 1];
    const m = { people: ps ? ps.count : 0, want: ps ? Math.round(ps.target) : 0, cars: sys.traffic && sys.traffic.vehicles ? sys.traffic.vehicles.length : 0, fps: r1(1000 / mean(F.map(f => f.iv))), iv: [at(iv, 0.5), at(iv, 0.95), iv[iv.length - 1]].map(r1),
      js: r2(js), jsp: r1(at(sorted(F.map(f => f.js)), 0.95)), calls: last.calls, tris: last.tris, split: split(s0, s1, js) };
    // 2. the same frames with a fence after each: when the GPU had finished (fd: by then at the latest, fl: not yet by then), and how often a frame began with the one before unfinished
    if (FENCE && fenceOK !== false) {
      const G = await take({ ms: 500, min: 10, max: 60, s: 3 }); sync = 0; await drain();
      const D = G.filter(f => f.fd !== undefined);
      m.fn = [D.length, G.length]; m.late = r2(mean(G.map(f => f.q ? 1 : 0))); m.ffps = r1(1000 / mean(G.map(f => f.iv)));
      if (D.length >= 3) { m.fd = r2(tmean(D.map(f => f.fd))); m.fdp = r1(at(sorted(D.map(f => f.fd)), 0.95)); m.fl = r2(tmean(D.map(f => f.fl))); m.fjs = r2(tmean(D.map(f => f.js))); }
      if (fenceOK === null) fenceOK = D.length >= 0.6 * G.length;
    }
    // 3. and with one pixel read back after each: the page waits for the GPU inside the frame
    const H = await take({ ms: 500, min: 10, max: 60, s: 1 }); sync = 0;
    m.tot = r2(tmean(H.map(f => f.tot))); m.totp = r1(at(sorted(H.map(f => f.tot)), 0.95)); m.sjs = r2(tmean(H.map(f => f.js)));
    m.lim = verdict(m, res.dev.hz);
    fms = 1000 / m.fps; gms = Math.max(m.tot, m.fd || 0);
    return m;
  }

  // ---------- the drive: the lapa carried along the road it stands on at a steady speed, the way tools/perf/memory.mjs drives, for the frames a player gets while the city streams in
  // The road is found from the road points main.js hands over: from the lapa, the next point ahead along the heading, again and again. No physics drives it and nothing is steered.
  function route(len) {
    const RV = E.roadVerts; if (!RV || !RV.length) return null;
    const box = len + 300, near = RV.filter(v => Math.abs(v[0] - car.x) < box && Math.abs(v[1] - car.z) < box), turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const walk = th => {
      const pts = [[car.x, car.z]]; let x = car.x, z = car.z, L = 0;
      while (L < len) {
        let best = null, bd = 1e9, bth = 0;
        for (const [lat, ang] of [[3, 0.7], [12, 0.5]]) {   // on the line ahead first; then a little to the side of it (a road that ends where the next one begins a few metres off)
          const sn = Math.sin(th), cs = Math.cos(th);
          for (const v of near) {
            const dx = v[0] - x, dz = v[1] - z, al = dx * sn + dz * cs; if (al < 1 || al > 250 || al >= bd || Math.abs(dx * cs - dz * sn) > lat) continue;
            const fw = turn(v[2], th), bk = turn(v[2] + Math.PI, th); if (Math.min(fw, bk) > ang) continue;
            best = v; bd = al; bth = fw <= bk ? v[2] : v[2] + Math.PI;
          }
          if (best) break;
        }
        if (!best) break;
        L += Math.hypot(best[0] - x, best[1] - z); x = best[0]; z = best[1]; th = bth; pts.push([x, z]);
      }
      return { pts, L };
    };
    const a = walk(car.th), b = a.L >= len ? a : walk(car.th + Math.PI), r = b.L > a.L ? b : a;
    return r.L >= 0.5 * len ? r : null;
  }
  async function drive() {
    const r = route(DRIVE.s * DRIVE.v); if (!r) return { na: E.roadVerts ? 'no road long enough to follow from where the lapa stood' : 'this page does not hand its road points to the benchmark' };
    const P = r.pts, cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const len = Math.min(r.L, DRIVE.s * DRIVE.v), from = [r1(car.x), r1(car.z)], F = [];
    sync = 0; await drain(); await frame(); world.resetStats();
    const t = now();
    let w = null;   // the longest frame of the drive and which systems it went to
    for (let k = 1, s = 0, a0 = snap(); s < len;) {
      const f = await frame(), a1 = snap(); F.push(f);
      if (!w || f.js > w.js) w = { js: f.js, m: s, a: a0, b: a1 };
      a0 = a1;
      s = Math.min(len, (now() - t) / 1000 * DRIVE.v); while (k < P.length - 1 && cum[k] < s) k++;
      const a = P[k - 1], b = P[k], u = clamp((s - cum[k - 1]) / Math.max(0.01, cum[k] - cum[k - 1]), 0, 1);
      try { vehicle.placeAt(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], b[1] - a[1])); } catch (e) { /* between roads */ }
    }
    const st = world.stats(), iv = sorted(F.map(f => f.iv)), js = sorted(F.map(f => f.js));
    return { m: Math.round(len), s: r1((now() - t) / 1000), v: DRIVE.v, n: F.length, iv: [at(iv, 0.5), at(iv, 0.95), iv[iv.length - 1]].map(r1), over50: F.filter(f => f.iv > 50).length, over33: F.filter(f => f.iv > 33.4).length,
      js: [at(js, 0.5), at(js, 0.95), js[js.length - 1]].map(r1), stream: { max: r1(st.workMax), avg: r2(st.avgWork || 0), over8: st.hitches }, worst: w && { js: r1(w.js), m: Math.round(w.m), split: split(w.a, { ...w.b, n: w.a.n + 1 }, w.js) }, from, to: [r1(car.x), r1(car.z)] };
  }

  // ---------- the run
  let res = null, wake = null, t0 = 0, loadMs = 0, restore = () => {};
  const lock = async () => { try { wake = await Promise.race([navigator.wakeLock.request('screen'), new Promise((_, no) => setTimeout(no, 1500))]); return true; } catch (e) { return false; } };   // (a request that never answers counts as a no)
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function fixed() {   // the same conditions every run: the clock stopped, fair weather, the chase camera. Put back at the end.
    const st = game.settings, sp = st.timeSpeed, pr = R.getPixelRatio(), h = game.time.hour;
    st.timeSpeed = 'off'; res.wx = res.wx || (sys.weather && sys.weather.WX ? sys.weather.WX.name : ''); if (sys.weather && sys.weather.set) sys.weather.set('cumulus', 0);
    if (Q.get('benchpr')) R.setPixelRatio(+Q.get('benchpr'));   // tests on a desktop: the phone's 2 on a display that has 1
    W0 = gl.drawingBufferWidth; H0 = gl.drawingBufferHeight;
    let done = false; restore = () => { if (done) return; done = true; st.timeSpeed = sp; if (sys.weather && sys.weather.set) sys.weather.set(null); R.setPixelRatio(pr); sys.dayNight.jumpTo(h); if (wake) wake.release().catch(() => {}); };
    addEventListener('pagehide', restore);
  }
  async function first() {   // what every page load needs before it measures
    res.dev = device(); res.dev.load = loadMs; res.gl = glInfo();
    // the display: animation frames with nothing drawn at all. 30 on a 60 Hz phone is the system holding the page back (Low Power Mode does exactly this)
    hold = true; const I = (await take({ ms: 800, min: 12, skip: 3 })).map(f => f.iv); hold = false;
    res.dev.idle = r1(1000 / mean(I)); res.dev.hz = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240].reduce((b, r) => Math.abs(r - res.dev.idle) < Math.abs(b - res.dev.idle) ? r : b, 60);
    let step = 0; for (let a = now(), n = 0, i = 0; i < 4e6 && n < 4; i++) { const b = now(); if (b > a) { step = step ? Math.min(step, b - a) : b - a; a = b; n++; } } res.dev.clock = +step.toPrecision(2);   // the smallest step the page's clock takes: 1 ms in Safari
    res.dev.wake = !!wake;
    res.warn = [];
    if (coarse && res.dev.idle < 45) res.warn.push(`only ${res.dev.idle} animation frames a second with nothing drawn: Low Power Mode is on (or the system is holding this page back). Every number below is capped at that: switch it off and run again.`);
    if (!res.dev.wake && coarse) res.warn.push('this browser could not keep the screen awake: if the phone dimmed or locked during the run, the numbers are no good.');
  }
  const progress = what => { const left = BUDGET - (now() - t0); say(`BENCH  ${mmss(now() - t0)}  ${what}  ·  ${left > 5000 ? 'about ' + mmss(left) + ' left' : 'nearly done'}  ·  leave the phone alone`); store.run = { t: Date.now(), step: what, res }; save(); };
  const short = e => String(e && e.message || e).slice(0, 80);

  // one place: the journey, the wait, the reading by day. What a reading by day and one by night take here is learnt as the run goes.
  let dayEst = 6000, nightEst = 8000;
  async function visit(def, cap, s) {
    const [, name, x, z, th] = def;
    progress(`${name}: getting there`);
    Object.assign(s, await arrive(x, z, th, cap)); s.car = [r1(car.x), r1(car.z)];
    if (sys.clouds && sys.clouds.setDrift) sys.clouds.setDrift(0);   // the same sky at every visit
    progress(`${name}: day`); const t = now(); await setTime(DAY); s.day = await reading(); dayEst = (dayEst + now() - t) / 2;
    return s;
  }
  async function nightOf(s) { progress(`${s.name}: night`); const t = now(); await setTime(NIGHT); s.night = await reading(); delete s.noNight; nightEst = (nightEst + now() - t) / 2; }

  async function stage1() {
    res = { v: 2, ver: (document.querySelector('meta[name="pd-version"]') || { dataset: {} }).dataset.name || 'dev', at: new Date().toISOString(), href: location.search, total: BUDGET / 1000, spots: [], notes: [], drop: [], re: [] };
    t0 = now(); fixed(); say('BENCH  starting'); await first();
    const ask = (Q.get('bs') || '').split(',').map(id => SPOTS.find(s => s[0] === id)).filter(Boolean), list = ask.length ? ask : SPOTS, cv = Q.get('bv') ? Q.get('bv').split(',') : null;   // ?bs=qc,mondello and ?bv=sh0,fog0 narrow a run to some places and variants
    // 1. The tour: the plain reading of every place by day, whatever happens. Up to tourEnd a place also gets its reading by night; past it the nights are left out.
    // The wait at each place is what is left up to hardEnd shared among the places still to come, so a device that loads slowly gets shorter waits (and says what was not ready) instead of fewer places.
    const tourEnd = t0 + BUDGET * TOUR, hardEnd = t0 + BUDGET * TOURMAX, back = list.length > 1 ? 1 : 0, driveMs = (DRIVE.s + 4) * 1000;
    let driveLeft = list.some(d => d[0] === DRIVE.at) ? driveMs : 0, jAvg = 0, jN = 0;
    for (let i = 0; i < list.length; i++) {
      const def = list[i], after = list.length - 1 - i + back, s = { id: def[0], name: def[1], at: [def[2], def[3]] };   // after: the places still to come, the way back to the first one among them
      await visit(def, i ? clamp((hardEnd - now() - driveLeft) / (after + 1) - dayEst, 6000, 30000) : Math.min(30000, 0.2 * BUDGET), s); res.spots.push(s);
      try { s.p16 = await parts16(); } catch (e) { res.notes.push('16-bit check failed: ' + short(e)); }
      const far = Math.hypot(car.x - def[2], car.z - def[3]); if (far > 200) res.notes.push(`${s.name}: the lapa stands ${Math.round(far)} m from where it was sent`);
      if (i) jAvg = (jAvg * jN + s.wait) / ++jN;
      if (now() + nightEst + driveLeft + after * (Math.max(jAvg, 6000) + dayEst) <= tourEnd) await nightOf(s); else s.noNight = 1;
      if (def[0] === DRIVE.at) {
        driveLeft = 0;
        if (now() + driveMs + after * (6000 + dayEst) > hardEnd) res.drive = { na: 'the run had no time left for it' };
        else {
          progress(`${s.name}: driving for ${DRIVE.s} s`);
          if (Math.abs(game.time.hour - DAY) > 0.02) { sys.dayNight.jumpTo(DAY); await sleep(1500); }
          try { res.drive = await drive(); } catch (e) { res.drive = { na: 'it failed: ' + short(e) }; }
        }
      }
    }
    if (!res.drive) res.drive = { na: `${SPOTS.find(d => d[0] === DRIVE.at)[1]} is not among the places of this run` };
    // 2. The clock of the costs: the fence, when the fences of the tour signalled as they should; else the read
    const force = Q.get('bclock');
    CLK = force === 'read' || !FENCE ? 1 : force === 'fence' || (fenceOK && lost < 3) ? 2 : 1;
    res.clock = CLK === 2 ? 'fence' : 'read';
    res.clockWhy = force ? 'asked for by ?bclock' : !FENCE ? 'this browser has no fences' : CLK === 1 ? (fenceOK ? `${lost} fences never signalled` : 'too few fences signalled in time here') : '';
    // 3. Back where the tour began: its reading again (the first one was the first thing this page ever measured), and that is the page as shipped the costs are set against
    const s0 = res.spots[0];
    if (back) res.again = await visit(list[0], clamp(hardEnd - now() - dayEst, 6000, 30000), {});
    await costsAndRest(s0, cv);
  }
  const reUrl = r => { const u = new URL(home, location.href); for (const [k, v] of new URLSearchParams(r.q)) u.searchParams.set(k, v); u.searchParams.set('bench', 're'); return u.href; };
  async function costsAndRest(s0, cv) {
    // The second page loads are planned first, because their time comes off what the costs may use. One is left out when it would take more than its share, or leave the costs under an eighth of the run.
    const reEst = 0.7 * loadMs + Math.min(s0.wait, 30000) + dayEst + 4000, reList = [], br = Q.get('br') ? Q.get('br').split(',') : null;   // ?br=aa0: these second page loads and no others, whatever time they take
    for (const r of RELOADS) {
      const n = reList.length + 1, why = r.off && r.off() ? 'this page already runs that way' : Q.get('benchaa') === '0' ? 'not asked for (?benchaa=0)' : br ? (br.includes(r.id) ? '' : 'not asked for (?br=)')
        : n * reEst > BUDGET * RELOAD ? `a page load takes about ${Math.round(reEst / 1000)} s here, more than its share of the run` : t0 + BUDGET - now() - n * reEst < 0.125 * BUDGET ? 'the tour left no time for it' : '';
      if (why) res.re.push({ id: r.id, label: r.label, q: r.q, na: why }); else reList.push(r);
    }
    const end = cv ? Infinity : Math.max(t0 + BUDGET - reList.length * reEst, br ? now() + 0.125 * BUDGET : 0);   // (a list asked for by ?bv= is measured whole, however long it takes)
    const K = res.costs = { at: s0.name, day: {}, night: {}, drift: DRIFT };
    const pick = cv ? cv.map(id => VARIANTS.find(v => v.id === id) || (res.drop.push([id, 'no such variant']), null)).filter(Boolean) : VARIANTS.filter(v => !v.heavy && !v.ask);
    const L = { day: pick.filter(v => v.at !== 'night'), night: pick.filter(v => v.at === 'night' || v.at === 'both') };
    let vAvg = clamp(70 * Math.max(fms, gms), 2200, 9000), vN = 0;   // what one variant takes: a guess from the frame time, then what the ones before it took
    const cost = v => (v.free ? 1.5 : 1) * vAvg + (v.slow ? 4 * v.slow : 0), nightNeed = () => L.night.length && !cv ? nightEst + L.night.reduce((a, v) => a + cost(v), 0) : 0;
    async function costs(tm, keep) {   // keep(): the ms to leave for what comes after
      const out = [];
      for (const v of L[tm]) {
        if (now() + cost(v) + keep() > end) { out.push(v.label); continue; }
        progress(`${s0.name}, ${tm}: ${v.label}`);
        const tv = now(); K[tm][v.id] = await measure(v, tm); if (!v.slow && !v.free && !v.heavy) vAvg = (vAvg * vN + now() - tv) / ++vN;
      }
      if (out.length) res.drop.push([`${tm === 'night' ? 'by night' : 'by day'}: ${out.join(', ')}`, 'the run was out of time']);
      // Once more, twice at the most, for the ones the noise hides: a figure under twice its error whose error is itself worth talking about (over 0.3 ms and 3 % of the frame)
      for (let p = 0; p < 2; p++) {
        const again = L[tm].filter(v => { const r = K[tm][v.id]; return r && !r.na && !r.cut && !v.slow && !v.heavy && (r.e === undefined || (Math.abs(r.d) < 2 * r.e && r.e > Math.max(0.3, 0.03 * r.base))); });
        for (const v of again) { if (now() + cost(v) + keep() > end) return; progress(`${s0.name}, ${tm}: ${v.label}, again`); K[tm][v.id] = await measure(v, tm); }
        if (!again.length) break;
      }
    }
    await setTime(DAY);
    await costs('day', nightNeed);
    progress(`${s0.name}: comparing pictures`); try { res.pic = await pictures(); } catch (e) { res.notes.push('picture checks failed: ' + short(e)); }
    res.px = pixels(K.day);
    if (L.night.length) {
      if (now() + nightEst + cost(L.night[0]) > end) res.drop.push([`by night: ${L.night.map(v => v.label).join(', ')}`, 'the run was out of time']);
      else { if (s0.night) await setTime(NIGHT); else await nightOf(s0); await costs('night', () => 0); }
    }
    const nn = res.spots.filter(s => s.noNight); if (nn.length) res.drop.push([`the readings by night at ${nn.map(s => s.name).join(', ')}`, 'the tour had used its share of the time']);
    if (lost) res.notes.push(`${lost} fence${lost > 1 ? 's' : ''} never signalled`);
    if (lastErr) res.notes.push('an error inside a frame: ' + lastErr);
    if (document.hidden || game.state !== 'play') res.notes.push('the game was paused or the page hidden during the run: run it again');
    res.dev.cv = device().cv; res.ms = Math.round(now() - t0);
    if (reList.length) {
      store.re = { res, list: reList.map(r => r.id), i: 0, tries: 0, t: Date.now(), home }; delete store.run;
      if (save()) {   // (without storage the next page would know nothing of this run and start it again)
        restore(); say(`BENCH  loading the page once more (${reList[0].label}), for the last measurement`);
        location.replace(reUrl(reList[0])); await sleep(60000);
      }
      delete store.re; for (const r of reList) res.re.push({ id: r.id, label: r.label, q: r.q, na: 'this browser keeps nothing between two loads (a private window?)' });
    }
    finish();
  }
  // A second page load: the first place by day once more, in the page that was loaded with the reload's parameters, beside the last reading the first page took there.
  async function stage2() {
    const p = store.re, r = RELOADS.find(q => q.id === p.list[p.i]); res = p.res; home = p.home; p.tries = 1; save();
    t0 = now() - res.ms - Math.max(0, Date.now() - p.t);   // the clock of the run goes on across the load
    const keep = { dev: res.dev, gl: res.gl, warn: res.warn }; fixed(); await first(); Object.assign(res, keep);
    const s = res.spots[0], def = SPOTS.find(d => d[0] === s.id), out = { id: r.id, label: r.label, q: r.q }, brief = m => ({ fps: m.fps, iv: m.iv, js: m.js, fd: m.fd, tot: m.tot, people: m.people, lim: m.lim });
    if (r.off && !r.off()) out.na = `the page did not change with ?${r.q}`;
    else { const a = await visit(def, clamp(1.5 * s.wait, 6000, 30000), {}); Object.assign(out, { was: brief((res.again || s).day), now: brief(a.day), wait: a.wait, settled: a.settled }); }
    res.re.push(out); res.ms = Math.round(now() - t0);
    const next = RELOADS.find(q => q.id === p.list[p.i + 1]);
    if (next && res.ms + now() <= BUDGET + 20000) {   // (now(): what this page load took from its first moment to here)
      store.re = { res, list: p.list, i: p.i + 1, tries: 0, t: Date.now(), home }; delete store.run;
      if (save()) { restore(); say(`BENCH  loading the page once more (${next.label})`); location.replace(reUrl(next)); await sleep(60000); }
    }
    for (const id of p.list.slice(p.i + 1)) { const q = RELOADS.find(x => x.id === id); if (q) res.re.push({ id, label: q.label, q: q.q, na: 'the run was out of time' }); }
    finish();
  }
  function finish(head) {
    restore(); hold = true; strip.remove();   // the game stops drawing under the panel: the phone cools down for the next run
    store.last = res; delete store.run; delete store.re; save();
    try { history.replaceState(null, '', home); } catch (e) { /* the address stays as it is */ }
    api.done = true; show(res, head);
  }

  const api = window.__pdBench = { done: false, res: null, text: () => text(shown, panel ? panel.dataset.head : ''), page: n => page(n), tap: null };   // for tools/perf/benchrun.mjs
  say('BENCH  loading');
  while (document.getElementById('loading')) await sleep(200);
  loadMs = Math.round(now());
  wrapAll();
  const go = (() => { try { const g = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return g === 'go'; } catch (e) { return false; } })() || Q.get('bench') === 'new';
  try {
    if (STAGE2 && !store.re) { location.replace(home); return; }
    if (STAGE2 && store.re.tries) { const p = store.re, r = RELOADS.find(q => q.id === p.list[p.i]) || {}; res = p.res; home = p.home; res.re.push({ id: r.id, label: r.label, q: r.q, na: 'the page did not finish loading that way' }); return finish(); }
    if (!STAGE2 && !go && store.run) { hold = true; strip.remove(); api.done = true; return show(store.run.res || {}, `THE LAST RUN STOPPED at "${store.run.step}" and the page was loaded again. If nobody closed or reloaded it, the browser ran out of memory there. What it had measured:`); }
    if (!STAGE2 && !go && store.last && Date.now() - Date.parse(store.last.at) < FRESH) { hold = true; strip.remove(); api.done = true; return show(store.last, ''); }
    // a phone held upright: the game waits behind its "turn your phone" prompt, and so does this
    while (coarse && innerHeight > innerWidth) { say('BENCH  turn the phone sideways to start'); await sleep(300); }
    while (document.hidden) await sleep(300);
    const st = game.settings, radio0 = st.radio; st.radio = 'off'; dispatchEvent(new Event('pd-music-setting')); addEventListener('pagehide', () => { st.radio = radio0; });   // no music: the radio would start on the tap below (src/radio.js). The saved choice is not touched.
    if (!(await lock()) && coarse) {   // no wake lock without a tap on this browser: ask for one over the whole screen (it must not dim or lock while the run lasts)
      const css = strip.style.cssText; strip.style.cssText += ';bottom:0;display:flex;align-items:center;justify-content:center;font-size:20px;white-space:normal;text-align:center;pointer-events:auto;background:rgba(11,7,9,.9)';
      say(STAGE2 ? 'BENCH  tap once more for the last measurement' : `BENCH  tap to start, then leave the phone alone for ${Math.round(BUDGET / 60000) || 1} minutes`);
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
