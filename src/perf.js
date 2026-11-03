// Automatic graphics (Options > Graphics > Auto). One goal on every device: 60 fps. No phone profile, a weak device simply ends up lower on the ladder.
//
// What it moves, least visible first (LADDER below, the pixel ratio is the continuous first rung):
//   1. resolution (pixel ratio, steps of 0.125)      2. draw distance (far plane and fog)
//   3. shadows (map size 1024, 512, then off)        4. crowd and traffic density
// A rung that does not help is skipped: after lowering the resolution the next window is compared with the one before, and if the frame
// time did not improve the game is CPU bound (more pixels were never the problem), the sharp image comes back and the next move goes
// straight to the rungs that save CPU (shadows, crowd), see `cpu` in LADDER. Climbing back goes the other way round.
// If 60 cannot be held down to the last rung of the 60 fps ladder (S60: shadows still on), the game settles at 30: one frame in every second display refresh
// (a steady 30 is better than a jumpy 45), with its own start point on the ladder and the same rules at a 33.3 ms target. Now and then (rarely, backed off)
// it tries 60 again. On displays at 120 Hz or more Auto also caps 60 fps mode: every 2nd refresh at 120 and 144 Hz (60 and 72 fps, an even cadence), every 3rd at 180,
// every 4th at 240; 90 Hz has no even way to 60 and runs at 90. That saves battery and heat on high refresh phones; the manual tiers stay uncapped.
//
// Slow on purpose: decisions are taken on 3 s windows of frame times, a lowering needs two slow windows in a row (one if it is very slow), a raise needs
// 15 s of good windows and doubles that wait whenever it is followed by a lowering within 25 s. Changes that rebuild things (shadows on or off or another map
// size recompile shaders and reallocate render targets) wait for a screen transition (event 'pd-cover', src/transition.js) or, for a new shadow map size, for a quiet minute and a half; shadows on or off (which
// recompiles every program, 0.8 s at CPU x4 in the production build) only ever switch under a transition.
// Frames are ignored while loading, on the title, in menus, in the Garage, hidden and under a transition, and for 2.5 s after each of those (the transition itself waits until the visible tiles are built, src/ui.js settle; streaming while driving is real cost and counts).
// The settled level is remembered per device in localStorage and the next start begins there.
//
// createGovernor() is the pure state machine (no DOM, driven by sample(now, dt, active)): tools/build/perfsim.mjs runs it on a fake clock.
// createPerf() wraps it for the browser: refresh rate measurement, the 30 fps cap, pixel ratio, persistence, the coordinates box readout.
//
//   const perf = createPerf({ renderer, apply, gate });   // apply(level): shadows, draw distance, crowd (main.js); gate(): may frames be measured now
//   perf.configure({ auto, ratio, ceil });                // from applySettings(): auto, or a fixed pixel ratio for the manual low / medium / high
//   if (perf.frame(now)) return;                          // once per animation frame; true means "skip this one" (the 30 fps cap)
//   window.game.perf (with ?debug) / perf.stats()  perf.hud() -> text for src/coords.js

// Index = step. dd: draw distance factor (fog and far plane), sh: shadow map size (0 = off), crowd: pedestrian and traffic tier, cpu: this rung saves CPU.
export const LADDER = [
  { dd: 1.00, sh: 1024, crowd: 'medium', cpu: false },
  { dd: 0.85, sh: 1024, crowd: 'medium', cpu: false },
  { dd: 0.70, sh: 1024, crowd: 'medium', cpu: false },
  { dd: 0.70, sh: 512,  crowd: 'medium', cpu: true },
  { dd: 0.70, sh: 0,    crowd: 'medium', cpu: true },
  { dd: 0.70, sh: 0,    crowd: 'low',    cpu: true },
];
export const S60 = 3, S30 = LADDER.length - 1;   // deepest step at 60 fps (shadows must stay on, else it is "giving up a lot") and at 30
const STEP = 0.125;                              // pixel ratio is quantised: fewer distinct buffer sizes
const DEFAULTS = {
  win: 3000,            // ms of frame times per decision
  slow: 1.15,           // lower above this many target intervals (19.2 ms at 60 fps, about 52 fps; the old resolution-only code used 1.23)
  veryslow: 1.7,        // ... or at once above this
  revert: 1.12,         // the first window after a raise above this takes the raise back
  fast: 1.05,           // a window below this counts as having room
  raiseWait: 15000,     // ms of good windows before a raise (base)
  raiseMax: 600000,     // the back-off after failed raises stops here
  failWin: 25000,       // a lowering this soon after a raise means the raise failed
  settle: 300000,       // this long without a change halves the back-off again
  cpuHold: 120000,      // after a "fewer pixels did not help" verdict, do not touch the resolution for this long
  rebuildLower: 90000, rebuildRaise: 300000,   // minimum gap between rebuilding changes when no transition covers the screen
  grace: 2500,          // ignored after the game becomes measurable again (loading, a transition, the menu closing) and after each change
  ban: 1200000,         // a level whose raise failed is not tried again for this long
  save: 60000,          // a level that has not changed for this long is remembered (palermoDrive.autogfx.v1)
  floor60: 0.75, floor30: 0.625,
  bottomWins: 6,        // slow windows in a row at the bottom of the 60 fps ladder before it settles at 30 (18 s): a busy moment is not a verdict
  trialFirst: 300000, trialMax: 4800000,       // the wait before the first try of 60 again from 30, doubled on each return to 30
};

export function createGovernor(opt = {}) {
  const C = { ...DEFAULTS, ...opt.cfg };
  const onChange = opt.onChange || (() => {});
  let ceil = opt.ceil || 1.5, R = opt.refresh || 1000 / 60;
  let mode = 60, s = 1, ratio = 1;
  let win = { t0: 0, sum: 0, n: 0 }, hold = 0, wasActive = false;
  let slowRun = 0, goodRun = 0, probe = null, cpuUntil = 0, gpuAt = -1e9, raiseWait = C.raiseWait, lastRaise = -1e9, lastChange = 0, lastRebuild = -1e9;
  let pendingS = -1, lastNow = 0, bottomRun = 0, rp = null, want = null, wantAt = 0, ban = new Map(), lastKey = '', trial = null, trialWait = C.trialFirst, trialAt = 1e9, lastMean = 0, now0 = 0;
  const st = { lowers: 0, raises: 0, cpuVerdicts: 0, fails: 0, trials: 0, trialsOk: 0, to30: 0, deferred: 0 };

  const mult30 = () => Math.max(1, Math.floor(33.33 / R + 0.25));   // display refreshes per frame at 30 fps: 2 at 60 Hz, 3 at 90, 4 at 120
  const mult60 = () => Math.max(1, Math.floor(1000 / R / 60 + 0.05));   // at 60 fps: 1 up to 119 Hz (90 Hz has no even way to 60, it runs at 90), 2 at 120 and 144 Hz (60 and 72 fps, an even cadence), 3 at 180, 4 at 240
  const mult = () => mode === 60 ? mult60() : mult30();
  const period = () => mode === 60 ? Math.max(1000 / 60, mult60() * R) : mult30() * R;
  const floor = () => mode === 60 ? C.floor60 : C.floor30;
  const q = r => Math.max(0.25, Math.round(r / STEP) * STEP);
  const rebuilds = (a, b) => LADDER[a].sh !== LADDER[b].sh;
  const toggles = (a, b) => (LADDER[a].sh > 0) !== (LADDER[b].sh > 0);   // shadows on or off: every program recompiles (767 ms at CPU x4 in the production build, see docs/PERF.md), so only under a transition
  const emit = (now, why, rebuild) => {
    ratio = Math.min(ratio, ceil);
    win = { t0: 0, sum: 0, n: 0 }; hold = now + C.grace; slowRun = 0; goodRun = 0; lastChange = now; rp = null; probe = null; bottomRun = 0;
    if ((want === 'raise' && /down|30|CPU/.test(why)) || (want === 'lower' && /up/.test(why))) want = null;
    if (rebuild) lastRebuild = now;
    onChange(get(), why);
  };
  const canRebuild = (now, lowering, covered) => covered || now - lastRebuild >= (lowering ? C.rebuildLower : C.rebuildRaise);
  const get = () => ({ mode, s, ratio: q(ratio), level: LADDER[s], period: period(), mult: mult() });

  const key = (a, r) => mode + ':' + a + ':' + q(r);
  function failedRaise(now) {   // a lowering soon after a raise: the raise failed. Wait longer, and do not try that level again for a while
    if (now - lastRaise < C.failWin) { raiseWait = Math.min(raiseWait * 2, C.raiseMax); st.fails++; ban.set(lastKey, now + C.ban); lastRaise = -1e9; }
  }
  function toMode30(now, covered) {
    const to = Math.min(s, 1), rb = rebuilds(s, to);
    if (rb && !canRebuild(now, true, covered)) { want = 'lower'; wantAt = now; st.deferred++; return false; }
    mode = 30; s = to; ratio = Math.min(ceil, 1);   // the 30 fps start point: one rung from the top, resolution 1
    trialWait = Math.min(trialWait * 2, C.trialMax); trialAt = now + trialWait; st.to30++; st.lowers++;
    emit(now, '30 fps', rb); want = null; return true;
  }
  function lowerStep(now, covered) {
    const smax = mode === 60 ? S60 : S30;
    let t = s + 1;
    if (now < cpuUntil) while (t < smax && !LADDER[t].cpu) t++;   // CPU bound: straight to the rungs that save CPU
    if (t > smax) return mode === 60 && ++bottomRun >= C.bottomWins ? toMode30(now, covered) : false;   // 60: the ladder is used up, 30 only after several slow windows in a row; 30: the bottom, nothing left
    const rb = rebuilds(s, t);
    if ((rb && !canRebuild(now, true, covered)) || (!covered && toggles(s, t))) { want = 'lower'; wantAt = now; pendingS = t; st.deferred++; return false; }
    failedRaise(now); s = t; st.lowers++; emit(now, 'step down', rb); want = null; return true;
  }
  function lower(now, mean, covered) {
    const P = period();
    if (ratio > floor() + 1e-3 && now >= cpuUntil) {
      const r0 = ratio;
      ratio = Math.max(floor(), ratio * Math.min(0.95, Math.max(0.7, Math.sqrt(P / mean))));   // the cost follows the pixels, so aim at the target interval
      if (q(ratio) >= q(r0)) ratio = Math.max(floor(), r0 - STEP);
      failedRaise(now); st.lowers++; emit(now, 'resolution down', false);
      probe = { mean, ratio: r0 };   // the next window says whether fewer pixels helped
      return true;
    }
    return lowerStep(now, covered);
  }
  function raise(now, covered) {
    if (s > 0) {
      const t = s - 1, rb = rebuilds(s, t), k = key(t, ratio);
      if ((ban.get(k) || 0) > now) return false;
      if ((rb && !canRebuild(now, false, covered)) || (!covered && toggles(s, t))) { want = 'raise'; wantAt = now; st.deferred++; return false; }
      const prev = { s, ratio, k }; s = t; lastRaise = now; lastKey = k; st.raises++; emit(now, 'step up', rb); want = null; if (!rb) rp = prev; return true;
    }
    if (ratio < ceil - 1e-3) {
      const r = Math.min(ceil, ratio + STEP), k = key(0, r);
      if ((ban.get(k) || 0) > now) return false;
      const prev = { s, ratio, k }; ratio = r; lastRaise = now; lastKey = k; st.raises++; emit(now, 'resolution up', false); rp = prev; return true;
    }
    return false;
  }
  function startTrial(now) {   // 30 -> 60 for a few seconds, at the floor resolution and the same rung (no rebuild): keep it if it holds
    trial = { from: { mode, s, ratio }, w: 0 };
    mode = 60; ratio = Math.min(ratio, C.floor60); st.trials++;
    emit(now, 'trial 60', false);
  }
  function endWindow(now, mean) {
    const P = period(); lastMean = mean;
    if (trial) {
      if (mean > P * C.slow) { mode = trial.from.mode; s = trial.from.s; ratio = trial.from.ratio; trial = null; trialWait = Math.min(trialWait * 2, C.trialMax); trialAt = now + trialWait; emit(now, 'trial failed', false); }
      else if (++trial.w >= 2) { trial = null; st.trialsOk++; trialAt = 1e9; }
      return;
    }
    if (rp) {   // the first window after a raise (one that does not rebuild) must hold: otherwise take it back at once and leave that level alone for a while
      const p = rp; rp = null;
      if (mean > P * C.revert) { s = p.s; ratio = p.ratio; ban.set(p.k, now + C.ban); raiseWait = Math.min(raiseWait * 2, C.raiseMax); st.fails++; lastRaise = -1e9; emit(now, 'raise reverted', false); return; }
    }
    if (probe) {
      const p = probe; probe = null;
      if (mean > P * C.slow && mean > p.mean * 0.93) {   // fewer pixels did not help: CPU bound
        ratio = p.ratio; cpuUntil = now + C.cpuHold; st.cpuVerdicts++; emit(now, 'CPU bound', false);
        lowerStep(now, false); return;
      }
      gpuAt = now;
    }
    if (mean > P * C.slow) { slowRun++; goodRun = 0; }
    else { slowRun = 0; bottomRun = 0; goodRun = mean < P * C.fast ? goodRun + 1 : 0; }
    if (slowRun >= 2 || (slowRun >= 1 && mean > P * C.veryslow)) { if (lower(now, mean, false)) return; }
    if (now - lastChange > C.settle && raiseWait > C.raiseWait) { raiseWait = Math.max(C.raiseWait, raiseWait / 2); lastChange = now; }
    if (goodRun * C.win >= raiseWait) {
      if (mode === 30 && s <= 2 && ratio >= 1 - 1e-3 && now >= trialAt) { startTrial(now); return; }
      if (raise(now, false)) return;
      goodRun = Math.min(goodRun, Math.ceil(raiseWait / C.win));   // nothing to raise: stay ready
    }
  }
  return {
    // Initial state. `ceil`: the pixel ratio ceiling. `refresh`: the display refresh interval in ms.
    start({ mode: m = 60, s: s0 = 1, ratio: r0 = 1, trialWait: tw, raiseWait: rw } = {}) {
      mode = m === 30 ? 30 : 60; s = Math.max(0, Math.min(s0 | 0, mode === 60 ? S60 : S30)); ratio = Math.min(ceil, Math.max(C.floor30, r0));
      if (tw > 0) trialWait = Math.min(tw, C.trialMax);
      if (rw > 0) raiseWait = Math.min(Math.max(rw, C.raiseWait), C.raiseMax);
      trialAt = mode === 30 ? now0 + trialWait : 1e9; trial = null; probe = null; want = null; win = { t0: 0, sum: 0, n: 0 }; slowRun = goodRun = 0;
      return get();
    },
    setCeil(c) { ceil = c; ratio = Math.min(ratio, ceil); },
    setRefresh(r) { R = r; },
    // One frame: `dt` the interval since the last measured frame, `active` false while loading, in menus, under a transition ...
    sample(now, dt, active) {
      lastNow = now;
      if (!now0) { now0 = now; lastRebuild = now; if (mode === 30) trialAt = now + trialWait; }   // loading counted as the last rebuild: the first one in play waits for a transition or 90 s
      if (!active) { wasActive = false; win = { t0: 0, sum: 0, n: 0 }; return; }
      if (!wasActive) { wasActive = true; hold = Math.max(hold, now + C.grace); win = { t0: 0, sum: 0, n: 0 }; return; }
      if (dt > 250) { win = { t0: 0, sum: 0, n: 0 }; hold = now + C.grace; return; }   // a stall, a hidden page coming back
      if (now < hold || dt <= 0) return;
      if (!win.t0) win.t0 = now;
      win.sum += dt; win.n++;
      if (now - win.t0 >= C.win) { const m = win.sum / win.n, n = win.n; win = { t0: 0, sum: 0, n: 0 }; if (n >= 12) endWindow(now, m); }
    },
    // A transition covers the screen: do now what was waiting for a quiet moment.
    cover(now) {
      if (now - wantAt > 60000) want = null;
      if (!want || trial || probe) return;
      if (want === 'lower') { if (lastMean > period() * C.slow) lowerStep(now, true); } else raise(now, true);   // only if it still looks needed
    },
    cfg: C,
    get, stats: () => ({ ...st, raiseWait, trialWait, trialAt: trialAt < 1e8 ? Math.round(trialAt) : null, mean: +lastMean.toFixed(1), want, pendingS }),
    limit: now => now < cpuUntil ? 'CPU' : now - gpuAt < 120000 ? 'GPU' : '-',
    settledFor: now => now - lastChange,
    inTrial: () => !!trial,
    // a lowering that waits for a transition is saved as already done: the next load (which is covered) starts there without the stall
    persist: () => ({ mode: trial ? trial.from.mode : mode, s: trial ? trial.from.s : want === 'lower' && pendingS > s && lastNow - wantAt < 60000 ? pendingS : s, ratio: q(trial ? trial.from.ratio : ratio), trialWait, raiseWait }),
  };
}

const KEY = 'palermoDrive.autogfx.v1';
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240];
const snapRefresh = ms => { const hz = 1000 / ms; let best = hz, bd = 0.04; for (const r of RATES) { const d = Math.abs(hz - r) / r; if (d < bd) { bd = d; best = r; } } return 1000 / best; };

export function createPerf({ renderer, apply = () => {}, gate = () => true }) {
  const params = new URLSearchParams(location.search);
  const off = params.has('fixres');              // ?fixres: nothing adapts (benchmarks)
  let auto = false, ceil = 1, fixed = 1, started = false, covered = 0, R = 0, rawLast = 0, rawBuf = [], lastExec = 0, skipping = false;
  let applied = 0, fps = 60, lastFrame = 0, dirty = false, lastSaved = '', gov = null, saveAt = 0, source = '';
  const sig = () => {
    let gl = '';
    try { const g = renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); gl = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { /* no info */ }
    return [devicePixelRatio, Math.min(screen.width, screen.height) + 'x' + Math.max(screen.width, screen.height), gl].join('|');
  };
  const ratioNow = () => renderer.getPixelRatio();
  function setRatio(r) {
    const v = Math.max(0.25, Math.round(r / STEP) * STEP);
    if (Math.abs(v - applied) < 1e-3) return;
    applied = v; renderer.setPixelRatio(v);
  }
  function onChange(state, why) {
    setRatio(state.ratio); apply(state.level); dirty = true; skipping = false;
    if (state.mode === 30) lastExec = 0;
  }
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.sig === sig() && (o.mode === 60 || o.mode === 30) && Number.isFinite(o.s) && Number.isFinite(o.ratio)) return o; } catch (e) { /* none */ }
    return null;
  }
  function save() {
    if (!gov) return; dirty = false; lastSaved = JSON.stringify(gov.persist());
    try { localStorage.setItem(KEY, JSON.stringify({ sig: sig(), ...gov.persist() })); } catch (e) { /* storage unavailable */ }
  }
  addEventListener('pd-cover', e => { covered = e.detail ? 1 : 0; if (e.detail && gov && auto) gov.cover(performance.now()); });
  addEventListener('pagehide', () => { if (gov && auto && gov.settledFor(performance.now()) > 15000) { dirty = true; save(); } });

  const api = {
    // from applySettings(): auto (the governor moves things between the ladder's rungs) or manual (`ratio` is fixed, nothing adapts)
    configure({ auto: a, ratio, ceil: c }) {
      ceil = c; fixed = ratio;
      if (off || !a) { auto = false; setRatio(ratio); skipping = false; return; }
      if (auto && gov) { gov.setCeil(c); return; }   // another option changed: leave the running level alone
      auto = true;
      gov = createGovernor({ ceil: c, refresh: R || 1000 / 60, onChange, cfg: window.__pdPerfCfg });   // __pdPerfCfg: tests shorten the windows
      const sv = load();
      const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
      const sp = sv || { mode: 60, s: weak ? 2 : 1, ratio: weak ? 0.875 : 1 };
      source = sv ? 'saved' : weak ? 'start (weak hint)' : 'start';
      const state = gov.start(sp);
      setRatio(state.ratio); apply(state.level); dirty = true;
    },
    frame(now) {
      // refresh interval from the raw animation frame deltas (also the skipped ones): the lowest estimate seen, snapped to a real display rate
      const d = now - rawLast; rawLast = now;
      if (d > 3 && d < 60) { rawBuf.push(d); if (rawBuf.length >= 90) { rawBuf.sort((a, b) => a - b); const e = snapRefresh(rawBuf[22]); rawBuf = []; R = R ? Math.min(R, e) : e; gov?.setRefresh(R); } }
      if (!auto || !gov) { if (d > 0 && d < 250) fps += (1000 / d - fps) * 0.05; return false; }
      const m = gov.get(), r = R || 1000 / 60;
      if (m.mult > 1) {   // the cap: every 2nd refresh (or 3rd, 4th ...) runs, the others return at once. At 30 fps that is 60 Hz / 2, 90 / 3, 120 / 4; at 60 fps on 120 and 144 Hz displays every 2nd. Manual tiers never get here
        if (lastExec && now - lastExec < (m.mult - 0.5) * r) return true;
      }
      const dt = lastExec ? now - lastExec : 0; lastExec = now;
      if (dt > 0 && dt < 250) fps += (1000 / dt - fps) * 0.05;
      const act = !covered && !document.hidden && !document.getElementById('loading') && gate();
      gov.sample(now, dt, act);
      if (act && now > saveAt) { saveAt = now + 5000; if (gov.settledFor(now) > gov.cfg.save && !gov.inTrial() && (dirty || JSON.stringify(gov.persist()) !== lastSaved)) save(); }
      return false;
    },
    // text for the coordinates box (src/coords.js), a few lines
    hud() {
      const px = renderer.domElement, r = ratioNow(), now = performance.now();
      if (off) return `fps ${fps.toFixed(0)}  fixres (no adaptation)\nres ${r.toFixed(2)} ${px.width}x${px.height}`;
      if (!auto || !gov) return `fps ${fps.toFixed(0)}  gfx manual (no adaptation)\nres ${r.toFixed(2)} ${px.width}x${px.height}`;
      const g = gov.get(), L = g.level;
      return `fps ${fps.toFixed(0)}/${g.mode}  step ${g.s}/${g.mode === 60 ? S60 : S30}${gov.inTrial() ? ' trial' : ''}  limit ${gov.limit(now)}  ${R ? (1000 / R).toFixed(0) + ' Hz' : ''}\n`
        + `res ${r.toFixed(2)} ${px.width}x${px.height}  draw ${L.dd}  shadow ${L.sh || 'off'}  crowd ${L.crowd}`;
    },
    // for tests and screenshots: jump to a state ({ mode, s, ratio }); the governor goes on from there
    force(sp) { if (!gov) return; const state = gov.start(sp); setRatio(state.ratio); apply(state.level); },
    stats: () => ({ auto, off, ratio: applied, ceil, refreshMs: R, source, state: gov?.get(), ...(gov?.stats() || {}) }),
    get governor() { return gov; },
  };
  return api;
}
