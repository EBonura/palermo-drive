// ?rec: the gameplay stutter recorder (docs/PERF.md, "Where the stutters are"). Open the game with ?rec in the address, play as usual, tap the REC pill, Stop, Copy JSON (or Save file) and paste it back. Nothing is sent anywhere.
// It records the whole session from the moment this file loads until Stop, one row per frame the player gets, in typed arrays used as a ring (nothing is allocated and the page is not touched per frame; the pill is written once a second).
// A refresh the 30 fps cap skips (perf.frame in src/perf.js) is not a row: it only counts toward `sk` of the next drawn frame. Per row: the time since the previous drawn frame, since the previous refresh, how long the game's own code ran (split by system),
// what else happened (new shader programs, textures, geometries; a drop of the JS heap; the GPU not done with the frame before; the page hidden; a teleport; a change of cap or tier), the streaming state of the world, and where the lapa was.
// The stutters are worked out when the JSON is made (Copy, Save, Stop, the page going to the background), so the rule can look at the frames on both sides:
//   a stutter is a drawn frame whose interval from the previous drawn frame is at least 50 ms and over 1.8 times the median of the drawn frames in the 5 s before and the 5 s after it (so a steady 30 fps from the cap is not a stutter, a missed frame in it at 66 ms is),
//   not counting a frame the page was hidden for. The interval is the gap before the frame showed, and what ran in that gap is the frame before: its code and events are the usual culprit, so a stutter carries the split of both (`p` the frame before, `c` this one).
// `why` is one word per stutter: shader (programs grew and the code took at least 30 % of the gap), the system with the most time when the game's code took at least half of it, outside (the main thread was busy for at least 30 % of the gap with something the loop does not count:
// a long animation frame, or the frame starting late, see `lag` and `loaf`), gc (heap drop), gpu (the fence was late), else wait (nothing the recorder can see: with no long animation frames, as in Safari, other page code lands here too; or the GPU process or the display held the frame). The Chrome long-animation-frame entries (long tasks where that is all there is) that overlap the gap are attached with their scripts: invoker, source file, function, character position.
// Recording itself costs a few wrapped calls and one fence a frame; the summary's `self` says how much (the game ms of a frame with and without ?rec: docs/PERF.md).
// Like src/bench.js this file has no imports: everything comes from main.js through startRec(), and the production build keeps it out of the bundle (tools/build/build.mjs). Without ?rec none of it loads.

const KEY = 'palermoDrive.rec.v1';           // the recording of this session (written when the page goes away or at Stop); at the next start it moves to KEY + '.last'
const N = 120000;                             // rows kept: 20 minutes at 100 frames a second, more at 60 (the oldest rows go first)
const SYS = ['draw', 'shadow', 'traffic', 'crowd', 'world', 'daynight', 'clouds', 'minimap', 'sea', 'audio', 'missions', 'roadwear', 'markets', 'hud', 'net', 'lapa', 'props', 'other'];
const NS = SYS.length, SHADOW = 1;           // shadow is a part of draw: shown, not added up
const MIN_MS = 50, RATIO = 1.8, WIN = 5, KEEP = 150, MB = 1048576;
const STATE = '0123', STATE_NAME = ['title', 'play', 'pause', 'garage'];
const LEGEND = {
  v: 'format version', t: 'seconds since the page began loading', iv: 'ms from the previous drawn frame to this one (the gap the player saw)', raw: 'ms from the previous refresh (the 30 fps cap skips some)', sk: 'refreshes the cap skipped in the gap',
  ms: 'ms the game\'s own code ran in that frame', lag: 'ms from the refresh to the start of the game\'s code (the page was busy with something else)',
  p: 'the frame before: its code split by system, ms (it ran inside the gap, usually the culprit)', c: 'this frame: the same',
  split: 'draw (three.js drawing, shadow is a part of it), traffic, crowd, world (streaming), daynight, clouds, minimap, sea, audio, missions, roadwear, markets, hud, net, lapa, props, other, rest (physics, camera, HUD text: what main.js does itself)',
  ev: 'events of that frame, then pe of the frame before: p+N new shader programs (named in `prog` of the stutter and in `progs`), t+N textures, g+N geometries, gc=N the JS heap fell by N MB, gpu the GPU had not finished the frame before, hid page hidden in the gap, tp teleport, cap the cap or tier changed',
  prog: 'the programs that the frame before and this frame made, as material type, material name, four hex digits of the program key', progs: 'every frame in the recording that made a shader program (up to 40): [seconds, state, names]',
  w: 'world streaming at that frame: [visible tiles still pending, building jobs, downloads, tiles built]', pos: 'x, z in metres (the city origin is Quattro Canti), speed in km/h', d: 'district', st: 'state: title, play, pause, garage',
  loaf: 'Chrome long-animation-frame entries overlapping the gap: s start (s), d ms, rs ms to the start of rendering, scr scripts [ms, invoker, index in files, function, char position]', tl: 'timeline, one entry a second from tl.t0: fps drawn frames, worst longest interval ms, game mean game ms, n stutters, st state (0 title, 1 play, 2 pause, 3 garage)',
  why: 'shader, a system name, outside (the main thread was busy with something else), gc, gpu (the GPU was late) or wait (nothing the recorder can see: other page code where the browser gives no long animation frames, the GPU process or the display held the frame); see the head of src/rec.js', files: 'source files of the loaf scripts, by index', summary: 'late: % of frames that began while the GPU was still on the one before; why: stutters by cause', rule: `drawn frame, interval >= ${MIN_MS} ms and > ${RATIO} x the median of the drawn frames within ${WIN} s either side, page not hidden in the gap`,
};

export function startRec(E) {
  const { game, renderer: R, vehicle, world, perf, sys = {}, T = (it, en) => en, district = () => '' } = E, car = vehicle.car, gl = R.getContext(), now = () => performance.now();
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const T0 = now(), STAMP = new Date().toISOString();

  // ---------- the rows
  const tA = new Float64Array(N), dvA = new Float32Array(N), ivA = new Float32Array(N), msA = new Float32Array(N), lagA = new Float32Array(N), spA = new Uint16Array(N * NS), flA = new Uint16Array(N);
  const skA = new Uint8Array(N), dpA = new Uint8Array(N), dtA = new Uint8Array(N), dgA = new Uint8Array(N), blA = new Uint8Array(N), nwA = new Uint8Array(N), hdA = new Uint8Array(N);
  const jbA = new Uint16Array(N), vsA = new Uint16Array(N), xA = new Float32Array(N), zA = new Float32Array(N), vfA = new Float32Array(N);
  let n = 0, running = true, stoppedAt = 0;
  const F = { LATE: 1, HID: 2, GC: 4, TP: 8, CAP: 16 };   // flag bits; the state is in bits 6 and 7

  // ---------- the game's code by system: the calls main.js makes each frame, timed where they are called (the same list as src/bench.js)
  const acc = new Float64Array(NS);
  const wrap = (o, k, i) => { const f = o && o[k]; if (typeof f !== 'function') return; o[k] = function (a, b, c, d) { const t = now(); try { return f.call(this, a, b, c, d); } finally { acc[i] += now() - t; } }; };
  const I = Object.fromEntries(SYS.map((s, i) => [s, i]));
  wrap(R, 'render', I.draw); wrap(R.shadowMap, 'render', I.shadow);
  for (const [m, k, s] of [['traffic', 'update', 'traffic'], ['traffic', 'collidePlayer', 'traffic'], ['pedestrians', 'update', 'crowd'], ['pedestrians', 'draw', 'crowd'], ['pedestrians', 'collidePlayer', 'crowd'],
    ['world', 'update', 'world'], ['world', 'drivePlayer', 'world'], ['dayNight', 'update', 'daynight'], ['clouds', 'update', 'clouds'], ['minimap', 'draw', 'minimap'], ['sea', 'update', 'sea'], ['sea', 'wake', 'sea'], ['sea', 'checkPlayer', 'sea'],
    ['cityAudio', 'update', 'audio'], ['missions', 'update', 'missions'], ['roadwear', 'update', 'roadwear'], ['roadwear', 'collidePlayer', 'roadwear'], ['markets', 'update', 'markets'], ['shouts', 'update', 'hud'], ['coords', 'update', 'hud'],
    ['net', 'update', 'net'], ['vehicle', 'updateVisual', 'lapa'], ['props', 'collidePlayer', 'props'], ['suca', 'update', 'other'], ['stadium', 'update', 'other'], ['carretto', 'update', 'other'], ['drunk', 'update', 'other'], ['horn', 'update', 'other'],
    ['playlog', 'update', 'other']]) wrap(sys[m], k, I[s]);

  // ---------- what the loop tells us: begin(now) before the frame, end(skipped) after it
  const info = R.info, peek = new Float64Array(5), memInfo = typeof performance !== 'undefined' && performance.memory ? true : false;
  let lagF = 0, rawF = 0, t0 = 0, lateF = false, capF = false, hidF = false, prevRaw = 0, prevDrawn = 0, skipN = 0, nP = 0, nT = 0, nG = 0, built0 = -1, heap0 = 0, px = 0, pz = 0, havePos = false, med = 0, live = 0, frames = 0;
  let pend = null, pendT = 0, FEN = typeof gl.fenceSync === 'function', pollN = 0, lastKey = '';
  const tiers = [], events = [], loaf = [], pnames = new Map();   // pnames: row > the names of the programs that frame made (only rows that made one have an entry, so a frame without a new program allocates nothing)
  const ev = (kind, text) => { if (events.length < 300) events.push([r2(now() / 1000), kind, text]); };
  const stateOf = () => game.garage ? 3 : game.state === 'play' ? 1 : game.state === 'pause' ? 2 : 0;
  let lastState = -1;

  function begin(t) {
    t0 = now(); acc.fill(0);
    if (pend) {
      try {
        const s = gl.clientWaitSync(pend, 0, 0);
        if (s === gl.TIMEOUT_EXPIRED && t0 - pendT < 2000) lateF = true;
        else { gl.deleteSync(pend); pend = null; }
      } catch (e) { pend = null; FEN = false; }
    }
    lagF = t0 - t; rawF = prevRaw ? t - prevRaw : 0; prevRaw = t;
  }
  // whatever goes wrong in here must not take the game's frame down with it: the recorder stops and says so
  function end(skipped) { try { endRow(skipped); } catch (e) { running = false; stoppedAt = now(); ev('rec', 'stopped by an error: ' + String(e && e.message || e).slice(0, 80)); } }
  function endRow(skipped) {
    const t1 = now();
    if (!running) return;
    if (skipped) { skipN++; return; }
    const t = prevRaw, i = n % N, st = stateOf();
    // the game's code, split
    let sum = 0; const b = i * NS;
    for (let k = 0; k < NS; k++) { const v = acc[k]; spA[b + k] = v > 655 ? 65535 : (v * 100 + 0.5) | 0; if (k !== SHADOW) sum += v; }
    // what else happened this frame
    const np = info.programs ? info.programs.length : 0, nt = info.memory.textures, ng = info.memory.geometries;
    if (pnames.size) pnames.delete(i);
    dpA[i] = nP && np > nP ? Math.min(255, np - nP) : 0; dtA[i] = nT && nt > nT ? Math.min(255, nt - nT) : 0; dgA[i] = nG && ng > nG ? Math.min(255, ng - nG) : 0; nP = np; nT = nt; nG = ng;
    if (dpA[i]) pnames.set(i, progNames(np, dpA[i]));
    let fl = st << 6;
    if (lateF) fl |= F.LATE;
    if (hidF) fl |= F.HID;
    if (capF) fl |= F.CAP;
    let hd = 0;
    if (memInfo) { const h = performance.memory.usedJSHeapSize; if (heap0 - h > MB) { fl |= F.GC; hd = Math.min(255, Math.round((heap0 - h) / MB * 4)); } heap0 = h; }
    hdA[i] = hd;
    let built = 0, jobs = 0, net = 0, vis = 0;
    if (world && world.peek) { world.peek(peek); built = built0 >= 0 ? Math.max(0, peek[0] - built0) : 0; built0 = peek[0]; jobs = peek[1] + peek[2]; net = peek[3]; vis = peek[4]; }
    blA[i] = built > 255 ? 255 : built; jbA[i] = jobs > 65535 ? 65535 : jobs; nwA[i] = net > 255 ? 255 : net; vsA[i] = vis > 65535 ? 65535 : vis;
    const x = car.x, z = car.z;
    if (havePos && (x - px) * (x - px) + (z - pz) * (z - pz) > 6400) fl |= F.TP;
    px = x; pz = z; havePos = true; xA[i] = x; zA[i] = z; vfA[i] = car.vf || 0;
    const dv = prevDrawn ? t - prevDrawn : 0; prevDrawn = t;
    tA[i] = t; dvA[i] = dv; ivA[i] = rawF; msA[i] = t1 - t0; lagA[i] = lagF; skA[i] = skipN > 255 ? 255 : skipN; flA[i] = fl; skipN = 0;
    n++; frames++;
    lateF = false; hidF = false; capF = false;
    if (st !== lastState) { if (lastState >= 0) ev('state', STATE_NAME[lastState] + ' > ' + STATE_NAME[st]); lastState = st; }
    // a running count for the pill: a stutter against a quickly adapting median
    if (dv > 0) { med = med ? med + (dv > med ? med : -med) * 0.01 : dv; if (!(fl & F.HID) && dv >= MIN_MS && dv > RATIO * med && frames > 30) live++; }
    // the fence for this frame (asked about at the start of the next one) and, a few times a second, the cap and tier
    if (FEN && !pend) { try { pend = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); pendT = t1; gl.flush(); } catch (e) { FEN = false; pend = null; } }
    if ((++pollN & 15) === 0) poll();
  }

  // the programs a frame made: three appends each new one to info.programs, so they are the last ones. Material type, the material's name if it has one, and four hex digits of the program's key (the same key in two recordings is the same program).
  // Called only on a frame that made one (a compile is milliseconds anyway); at most four are named.
  function progNames(np, k) {
    const out = [];
    for (let j = Math.max(0, np - k); j < np && out.length < 4; j++) {
      const p = info.programs[j]; if (!p) continue;
      let h = 0; const key = String(p.cacheKey || ''); for (let c = 0; c < key.length; c++) h = (h * 31 + key.charCodeAt(c)) | 0;
      out.push(`${p.type || p.name || '?'}${p.name && p.type ? ' ' + String(p.name).slice(0, 20) : ''} ${(h >>> 16).toString(16).padStart(4, '0')}`);
    }
    if (k > out.length) out.push('+' + (k - out.length) + ' more');
    return out;
  }

  // the cap and the governor's tier (src/perf.js): a change of cadence can feel like a stutter, so every change is logged
  function poll() {
    const g = perf && perf.governor ? perf.governor.get() : null, L = g && g.level, pr = R.getPixelRatio();
    const key = (g ? `m${g.mode} s${g.s} x${g.mult} dd${L.dd} sh${L.sh} ${L.crowd}` : 'manual') + ` r${r2(pr)}`;
    if (key === lastKey) return;
    tiers.push([r2(now() / 1000), key]); if (lastKey) capF = true; lastKey = key;
  }
  poll();

  // ---------- long animation frames (Chrome 123+), else long tasks: kept in a short list; the stutters pick the ones that overlap them
  let po = null;
  try {
    const sup = PerformanceObserver.supportedEntryTypes || [], type = sup.includes('long-animation-frame') ? 'long-animation-frame' : sup.includes('longtask') ? 'longtask' : '';
    if (type) {
      po = new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          const o = { s: e.startTime, d: e.duration };
          if (e.renderStart) o.rs = e.renderStart - e.startTime;
          if (e.scripts && e.scripts.length) o.scr = [...e.scripts].sort((a, b) => b.duration - a.duration).slice(0, 3).map(c => [Math.round(c.duration), c.invoker || c.invokerType || '', String(c.sourceURL || '').replace(location.origin, '').slice(-60), c.sourceFunctionName || '', c.sourceCharPosition]);
          loaf.push(o); if (loaf.length > 600) loaf.splice(0, 100);
        }
      });
      po.observe(type === 'longtask' ? { type } : { type, buffered: true });
    }
  } catch (e) { po = null; }

  // ---------- page hidden / visible, a lost context
  const onVis = () => { ev('page', document.hidden ? 'hidden' : 'visible'); hidF = true; prevDrawn = 0; if (document.hidden) save(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', () => save());
  R.domElement.addEventListener('webglcontextlost', () => { ev('gl', 'context lost'); pend = null; });
  R.domElement.addEventListener('webglcontextrestored', () => ev('gl', 'context restored'));

  // ---------- the analysis: rows to the JSON
  const sorted = a => Float64Array.from(a).sort();
  const at = (s, p) => s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
  function analyse() {
    const cnt = Math.min(n, N), first = n - cnt, row = j => (first + j) % N, now0 = running ? now() : stoppedAt;
    const out = { v: 1, ver: (document.querySelector('meta[name="pd-version"]') || {}).dataset?.name || '', at: STAMP, address: location.search || '/', dur: r1((now0 - T0) / 1000), t0: r1(T0 / 1000), dev: device(), tiers, ev: events, legend: LEGEND };
    if (!cnt) { out.summary = { frames: 0 }; out.tl = { t0: 0, fps: [], worst: [], game: [], n: [], st: '' }; out.stutters = []; return out; }
    out.truncated = n > N ? r1(tA[row(0)] / 1000) : 0;
    // per second
    const s0 = Math.floor(tA[row(0)] / 1000), secs = Math.floor(tA[row(cnt - 1)] / 1000) - s0 + 1, secFirst = new Int32Array(secs + 2).fill(cnt);   // secFirst[s]: the first row of second s
    for (let j = cnt - 1; j >= 0; j--) secFirst[Math.floor(tA[row(j)] / 1000) - s0] = j;
    for (let s = secs - 1; s >= 0; s--) if (secFirst[s] === cnt) secFirst[s] = secFirst[s + 1];   // empty seconds point at the next row
    const fps = new Array(secs).fill(0), worst = new Array(secs).fill(0), gms = new Array(secs).fill(0), nst = new Array(secs).fill(0), stc = new Array(secs).fill('0');
    const all = [], play = [];
    let activeMs = 0, playMs = 0, late = 0;
    for (let j = 0; j < cnt; j++) {
      const q = row(j), s = Math.floor(tA[q] / 1000) - s0, dv = dvA[q], hid = flA[q] & F.HID;
      if (flA[q] & F.LATE) late++;
      fps[s]++; gms[s] += msA[q]; stc[s] = STATE[flA[q] >> 6 & 3];
      if (dv > 0 && !hid) { all.push(dv); activeMs += dv; if (dv > worst[s]) worst[s] = dv; if ((flA[q] >> 6 & 3) === 1) { play.push(dv); playMs += dv; } }
    }
    // the median of the drawn frames around each second (WIN s either side), then the stutters
    const med = new Float64Array(secs), tmp = new Float32Array(cnt);
    for (let s = 0; s < secs; s++) {
      const a = secFirst[Math.max(0, s - WIN)], b = secFirst[Math.min(secs, s + WIN + 1)]; let k = 0;
      for (let j = a; j < b; j++) { const q = row(j); if (dvA[q] > 0 && !(flA[q] & F.HID)) tmp[k++] = dvA[q]; }
      med[s] = k ? tmp.subarray(0, k).sort()[k >> 1] : 0;
    }
    const cands = [];
    for (let j = 1; j < cnt; j++) {
      const q = row(j), dv = dvA[q], s = Math.floor(tA[q] / 1000) - s0;
      if (dv >= MIN_MS && dv > RATIO * med[s] && !(flA[q] & F.HID)) { cands.push(j); nst[s]++; }
    }
    for (let s = 0; s < secs; s++) { gms[s] = fps[s] ? r1(gms[s] / fps[s]) : 0; worst[s] = Math.round(worst[s]); }
    out.tl = { t0: s0, fps, worst, game: gms, n: nst, st: stc.join('') };
    // why, for all of them; the worst KEEP are written out
    const why = {}, playN = cands.filter(j => (flA[row(j)] >> 6 & 3) === 1).length, files = [];
    const split = q => { const o = {}; let sum = 0, top = '', tv = 0; for (let k = 0; k < NS; k++) { const v = spA[q * NS + k] / 100; if (k !== SHADOW) sum += v; if (v >= (k === SHADOW ? 1 : 0.2)) o[SYS[k]] = r1(v); if (k !== SHADOW && v > tv) { tv = v; top = SYS[k]; } } const rest = Math.max(0, msA[q] - sum); if (rest >= 0.2) o.rest = r1(rest); if (rest > tv) { tv = rest; top = 'rest'; } return { o, top, tv }; };
    const evs = q => { const e = [], f = flA[q]; if (dpA[q]) e.push('p+' + dpA[q]); if (dtA[q]) e.push('t+' + dtA[q]); if (dgA[q]) e.push('g+' + dgA[q]); if (f & F.GC) e.push('gc=' + r1(hdA[q] / 4)); if (f & F.LATE) e.push('gpu'); if (f & F.HID) e.push('hid'); if (f & F.TP) e.push('tp'); if (f & F.CAP) e.push('cap'); return e; };
    const rows = cands.map(j => {
      const q = row(j), pq = row(j - 1), dv = dvA[q], t = tA[q], P = split(pq), C = split(q), pc = P.tv >= C.tv, culprit = pc ? P : C, gap = pc ? msA[pq] : msA[q];
      const l = loaf.filter(e => e.s + e.d > t - dv - 30 && e.s < t + 5);
      let busy = lagA[q]; for (const e of l) busy = Math.max(busy, Math.min(e.s + e.d, t) - Math.max(e.s, t - dv));   // how long the main thread was occupied in the gap, by what the browser says (long animation frames) or by the late start of this frame
      let w;
      if ((dpA[q] || dpA[pq]) && gap >= 0.3 * dv) w = 'shader';
      else if (gap >= 0.5 * dv) w = culprit.top;
      else if (busy - gap >= 0.3 * dv) w = 'outside';
      else if ((flA[q] | flA[pq]) & F.GC) w = 'gc';
      else if ((flA[q] | flA[pq]) & F.LATE) w = 'gpu';
      else w = 'wait';
      why[w] = (why[w] || 0) + 1;
      return { j, q, pq, dv, w, P, C, l };
    });
    const worstN = rows.slice().sort((a, b) => b.dv - a.dv).slice(0, KEEP).sort((a, b) => a.j - b.j);
    out.stutters = worstN.map(({ q, pq, dv, w, P, C, l }) => {
      const o = { t: r2(tA[q] / 1000), iv: r1(dv), why: w, ms: r1(msA[q]), p: P.o, c: C.o };
      if (Math.abs(ivA[q] - dv) > 1) o.raw = r1(ivA[q]);
      if (skA[q]) o.sk = skA[q];
      if (lagA[q] >= 1) o.lag = r1(lagA[q]);
      const e = evs(q), pe = evs(pq); if (e.length) o.ev = e; if (pe.length) o.pe = pe;
      const pn = (pnames.get(pq) || []).concat(pnames.get(q) || []); if (pn.length) o.prog = pn.slice(0, 6);
      o.w = [vsA[q], jbA[q], nwA[q], blA[q]]; o.pos = [Math.round(xA[q]), Math.round(zA[q]), Math.round(vfA[q] * 3.6)]; o.d = district(xA[q], zA[q]); o.st = STATE_NAME[flA[q] >> 6 & 3];
      const la = l.slice(0, 3).map(e => { const r = { s: r2(e.s / 1000), d: Math.round(e.d) }; if (e.rs) r.rs = Math.round(e.rs); if (e.scr) r.scr = e.scr.map(c => { let f = files.indexOf(c[2]); if (f < 0) f = files.push(c[2]) - 1; return [c[0], c[1], f, c[3], c[4]]; }); return r; });
      if (la.length) o.loaf = la;
      return o;
    });
    if (files.length) out.files = files;
    const progs = []; for (let j = 0; j < cnt && progs.length < 40; j++) { const nm = pnames.get(row(j)); if (nm) progs.push([r2(tA[row(j)] / 1000), (flA[row(j)] >> 6 & 3) === 1 ? 'play' : STATE_NAME[flA[row(j)] >> 6 & 3], ...nm]); }
    if (progs.length) out.progs = progs;
    const s = sorted(all), sp = sorted(play), mins = activeMs / 60000, topSys = Object.entries(why).sort((a, b) => b[1] - a[1]);
    let gsum = 0, gn = 0; for (let j = 0; j < cnt; j++) { gsum += msA[row(j)]; gn++; }
    out.summary = {
      frames: cnt, fps: r1(cnt / Math.max(1, activeMs / 1000)), med: r1(at(s, 0.5)), p90: r1(at(s, 0.9)), p99: r1(at(s, 0.99)), max: r1(s[s.length - 1] || 0), game: r1(gsum / Math.max(1, gn)),
      stutters: cands.length, perMin: r1(cands.length / Math.max(0.05, mins)), shown: out.stutters.length, play: { stutters: playN, min: r1(playMs / 60000), perMin: r1(playN / Math.max(0.05, playMs / 60000)), med: r1(at(sp, 0.5)), p99: r1(at(sp, 0.99)) },
      why: topSys, top: topSys.length ? topSys[0][0] : '', late: r1(late * 100 / cnt), loaf: po ? 1 : 0, heap: memInfo ? 1 : 0, fence: FEN ? 1 : 0,
    };
    return out;
  }
  function device() {
    const ua = navigator.userAgent, m = ua.match(/(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/), an = ua.match(/Android (\d+(?:\.\d+)?)/), sv = ua.match(/Version\/(\d+(?:\.\d+)?)/), ch = ua.match(/Chrome\/(\d+)/);
    const sw = Math.min(screen.width, screen.height), sh = Math.max(screen.width, screen.height), dpr = devicePixelRatio, cv = R.domElement;
    const model = m && m[1] === 'iPhone' ? ({ '414x896@2': 'iPhone XR or 11', '375x812@3': 'iPhone X, XS or 11 Pro', '414x896@3': 'iPhone XS Max or 11 Pro Max', '390x844@3': 'iPhone 12 to 14', '393x852@3': 'iPhone 14 Pro to 16' })[`${sw}x${sh}@${dpr}`] || 'iPhone' : m ? m[1] : an ? 'Android' : /Mac/.test(ua) ? 'Mac' : 'other';
    let gpu = '';
    try { const x = gl.getExtension('WEBGL_debug_renderer_info'); gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { /* none */ }
    let hz = 0; try { const ms = perf && perf.stats ? perf.stats().refreshMs : 0; hz = ms > 0 ? Math.round(1000 / ms) : 0; } catch (e) { /* none */ }
    return { ua, model, os: m ? `iOS ${m[2]}.${m[3]}` : an ? 'Android ' + an[1] : '', browser: /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : sv ? 'Safari ' + sv[1] : ch ? 'Chrome ' + ch[1] : '', gpu, screen: [sw, sh], dpr, page: [innerWidth, innerHeight], canvas: [cv.width, cv.height],
      ratio: R.getPixelRatio(), cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, touch: navigator.maxTouchPoints, hz, standalone: !!navigator.standalone, lang: navigator.language };
  }

  // ---------- storage and the pill
  let result = null;
  const store = {
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  };
  const prev = store.get(KEY); if (prev) store.set(KEY + '.last', prev);   // a reload (Safari brings a heavy tab back from scratch) starts a new recording; the one before stays here
  const json = () => { try { const j = JSON.stringify(result || analyse()); store.set(KEY, j); return j; } catch (e) { return ''; } };
  const save = json;
  const lastJson = () => store.get(KEY + '.last') || '';

  const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; return e; };
  const MONO = 'ui-monospace,Menlo,Consolas,monospace', FONT = `font:700 11px/1 ${MONO}`;
  const pill = mk('button', `position:fixed;z-index:2147483000;${FONT};color:#fff;background:rgba(150,10,40,.88);border:0;border-radius:11px;padding:5px 8px;white-space:nowrap;touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent`);
  const panel = mk('div', `position:fixed;z-index:2147483001;display:none;width:min(250px,60vw);box-sizing:border-box;padding:8px;border-radius:8px;background:rgba(11,7,9,.94);color:#f3ece6;font:500 11px/1.35 ${MONO};touch-action:manipulation`);
  const info1 = mk('div', 'white-space:pre-wrap;margin-bottom:7px');
  const bar = mk('div', 'display:grid;grid-template-columns:1fr 1fr;gap:5px');
  const btn = (label, fn) => { const b = mk('button', `${FONT};color:#0b0709;background:#e8559a;border:0;border-radius:6px;padding:8px 6px;touch-action:manipulation`, label); b.addEventListener('click', e => { e.stopPropagation(); b.blur(); fn(b); }); bar.appendChild(b); return b; };   // (blur: a focused button would keep the keys the game listens for)
  const flash = (b, label) => { const old = b.dataset.l || b.textContent; b.dataset.l = old; b.textContent = label; setTimeout(() => { b.textContent = old; }, 1500); };
  const copy = async (b, txt) => {
    if (!txt) return flash(b, T('niente', 'nothing'));
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { const ta = mk('textarea', 'position:fixed;left:0;top:0;opacity:0'); ta.value = txt; panel.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e2) { /* no clipboard at all */ } ta.remove(); }
    flash(b, ok ? T('copiato', 'copied') : T('non copiato', 'copy failed'));
  };
  const saveFile = (b, txt) => {
    if (!txt) return flash(b, T('niente', 'nothing'));
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `palermo-drive-rec-${STAMP.slice(0, 19).replace(/[:T]/g, '-')}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); flash(b, T('salvato', 'saved')); } catch (e) { flash(b, T('non salvato', 'failed')); }
  };
  const bStop = btn(T('Stop', 'Stop'), () => stop());
  btn(T('Continua', 'Continue'), () => { panel.style.display = 'none'; });
  btn(T('Copia JSON', 'Copy JSON'), b => copy(b, json()));
  btn(T('Salva file', 'Save file'), b => saveFile(b, json()));
  const bPrev = btn(T('Copia la precedente', 'Copy previous'), b => copy(b, lastJson())); bPrev.style.gridColumn = '1 / 3'; bPrev.style.background = '#8a7a82'; bPrev.style.display = lastJson() ? '' : 'none';
  panel.append(info1, bar);
  for (const el of [pill, panel]) for (const t of ['pointerdown', 'touchstart', 'mousedown']) el.addEventListener(t, e => e.stopPropagation());
  document.body.append(pill, panel);

  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // The pill stands under the map capsule (the HUD's top right zone, src/ui.css .hz-map) at its right edge: on a landscape phone that is the free band between the capsule and the NOS pad, on a desktop window the corner. Where the capsule ends is read once a second,
  // since the police line and the online pill make it taller. The panel opens in the middle of the screen.
  pill.style.right = 'max(12px,env(safe-area-inset-right))'; pill.style.top = '116px'; panel.style.left = '50%'; panel.style.top = '50%'; panel.style.transform = 'translate(-50%,-50%)';
  function place() {
    const z = document.querySelector('#hud .hz-map'), b = z && z.getBoundingClientRect().bottom;
    if (b > 0) pill.style.top = Math.round(b + 4) + 'px';
  }
  function text() {
    const s = (result || analyse()).summary;
    if (!s.frames) return T('Ancora niente.', 'Nothing yet.');
    return `${running ? 'REC' : T('FERMO', 'STOPPED')} ${mmss(((running ? now() : stoppedAt) - T0) / 1000)}\n${s.frames} ${T('fotogrammi', 'frames')}, ${s.fps} fps, ${T('mediana', 'median')} ${s.med} ms, p99 ${s.p99}\n${T('scatti', 'stutters')} ${s.stutters} (${s.perMin}/${T('min', 'min')})${s.why.length ? '\n' + s.why.slice(0, 4).map(([k, c]) => `${k} ${c}`).join(', ') : ''}`;
  }
  function paint() {
    if (document.hidden) return;
    place();
    pill.textContent = running ? `REC ${mmss((now() - T0) / 1000)} · ${live}` : `${T('FERMO', 'STOPPED')} ${live}`;
    if (!running) pill.style.background = 'rgba(70,70,70,.92)';
  }
  pill.addEventListener('click', e => { e.stopPropagation(); pill.blur(); const open = panel.style.display === 'none'; panel.style.display = open ? 'block' : 'none'; if (open) { info1.textContent = text(); bPrev.style.display = lastJson() ? '' : 'none'; } });
  const timer = setInterval(paint, 1000); paint();
  function stop() {
    if (!running) return;
    running = false; stoppedAt = now(); clearInterval(timer); if (po) po.disconnect(); document.removeEventListener('visibilitychange', onVis);
    result = analyse(); store.set(KEY, JSON.stringify(result)); bStop.style.display = 'none'; paint(); info1.textContent = text();
  }
  const api = { begin, end, stop, analyse, json, get running() { return running; } };
  window.__pdRec = api;
  return api;
}
