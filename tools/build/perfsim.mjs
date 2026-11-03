// Fake-clock test of the automatic graphics governor (src/perf.js createGovernor): no browser, no real time.
// A device is a cost model (CPU ms and GPU ms per frame at a ladder state); frames are quantised to the display refresh like a vsynced browser.
//   node tools/build/perfsim.mjs [--verbose]
import { createGovernor } from '../../src/perf.js';
const verbose = process.argv.includes('--verbose');
let seed = 1; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / 0.7071; };

// c0: CPU ms at the top rung, g0: GPU ms at ratio 1 at the top rung. load(t) scales both (a heavy street, another app).
function run({ name, c0, g0, hz = 60, minutes = 20, load = () => 1, ceil = 2, noise = 0.07, saved, cfg, stages }) {
  const R = 1000 / hz; let t = 1000, state = null, inCover = false, toggledOutside = 0; const log = [];
  const gov = createGovernor({ ceil, refresh: R, cfg, onChange: (s, why) => { if (state && (state.level.sh > 0) !== (s.level.sh > 0) && !inCover) toggledOutside++; state = s; log.push([Math.round((t - 1000) / 1000), why, s.mode, s.s, s.ratio]); } });
  state = gov.start(saved || { mode: 60, s: 1, ratio: 1 });
  const cost = k => {
    const L = state.level;
    const cpu = c0 * (L.sh === 1024 ? 1 : L.sh === 512 ? 0.93 : 0.64) * (L.crowd === 'low' ? 0.78 : 1) * (0.94 + 0.06 * L.dd) * k;
    const gpu = g0 * state.ratio * state.ratio * (L.sh ? 1 : 0.75) * (0.9 + 0.1 * L.dd) * k;
    return Math.max(cpu, gpu);
  };
  const hist = [], end = t + minutes * 60000;
  const coverEvery = stages?.cover ?? 4 * 60000;   // a transition every 4 minutes unless a scenario says otherwise (a guess at how often a player starts a mission, teleports or goes back to the menu)
  let nextCover = t + coverEvery;
  while (t < end) {
    const k = load((t - 1000) / 1000);
    const work = cost(k) * (1 + noise * gauss()) * (rnd() < 0.003 ? 4 : 1);   // rare hitch
    const m = state.mode === 30 ? Math.max(1, Math.floor(33.33 / R + 0.25)) : Math.max(1, Math.floor(1000 / R / 60 + 0.05));
    const dt = Math.max(m * R, Math.ceil(work / R - 0.03) * R);
    t += dt; hist.push(dt);
    gov.sample(t, dt, true);
    if (t > nextCover) { inCover = true; gov.cover(t); inCover = false; nextCover += coverEvery; }
  }
  const last = hist.slice(-Math.round(60000 / 25));
  const mean = last.reduce((a, b) => a + b, 0) / last.length;
  const lastChangeAt = log.length ? log[log.length - 1][0] : 0;
  console.log(`${name.padEnd(46)} final mode ${state.mode} step ${state.s} ratio ${state.ratio.toFixed(3)}  last-min fps ${(1000 / mean).toFixed(1)}  changes ${log.length}  last change at ${lastChangeAt}s of ${minutes * 60}s${toggledOutside ? '  SHADOW TOGGLE OUTSIDE A COVER x' + toggledOutside : ''}`);
  if (toggledOutside) { console.log('  FAIL shadows switched outside a transition'); process.exitCode = 1; }
  if (verbose) for (const l of log) console.log('   ', l.join(' '));
  return { gov, log, state };
}
const ok = (c, m) => { if (!c) { console.log('  FAIL', m); process.exitCode = 1; } };
const after = (r, s) => r.log.filter(l => l[0] > s).length;

let r;
r = run({ name: 'strong (cpu 5, gpu 4)', c0: 5, g0: 4 }); ok(r.state.s === 0 && r.state.ratio >= 1.5, 'climbs to the top'); ok(after(r, 600) <= 2, 'stable after 10 min');
r = run({ name: 'GPU limited (cpu 6, gpu 22)', c0: 6, g0: 22 }); ok(r.state.mode === 60 && r.state.ratio < 1, 'lowers resolution'); ok(after(r, 600) <= 2, 'stable');
r = run({ name: 'CPU limited (cpu 22, gpu 3)', c0: 22, g0: 3 }); ok(r.log.some(l => l[1] === 'CPU bound'), 'detects CPU bound'); ok(after(r, 900) <= 2, 'stable');
r = run({ name: 'CPU limited, 60 reachable (cpu 16, gpu 3)', c0: 16, g0: 3 }); ok(after(r, 900) <= 2, 'stable');
r = run({ name: 'cannot hold 60 (cpu 40, gpu 10)', c0: 40, g0: 10 }); ok(r.state.mode === 30, 'settles at 30'); ok(after(r, 900) <= 4, 'stable at 30');
r = run({ name: 'very weak (cpu 60, gpu 30)', c0: 60, g0: 30 }); ok(r.state.mode === 30, 'settles at 30');
r = run({ name: 'borderline (cpu 24, gpu 10), 40 min', c0: 24, g0: 10, minutes: 40 }); ok(after(r, 1800) <= 4, 'does not oscillate');
r = run({ name: 'load goes away at 8 min (30 -> 60 trial)', c0: 30, g0: 10, load: t => t < 480 ? 1 : 0.4, minutes: 40 }); ok(r.state.mode === 60, 'goes back to 60 once the load is gone');
r = run({ name: 'load comes at 5 min and stays', c0: 6, g0: 8, load: t => t < 300 ? 1 : 3.2, minutes: 20 });
r = run({ name: '120 Hz display, strong', c0: 5, g0: 3, hz: 120 });
r = run({ name: '120 Hz display, cannot hold 60', c0: 40, g0: 10, hz: 120 }); ok(r.state.mode === 30, '30 at 120 Hz');
r = run({ name: '90 Hz display, cannot hold 60', c0: 40, g0: 10, hz: 90 }); ok(r.state.mode === 30, '30 at 90 Hz');
r = run({ name: 'start from saved 30 mode', c0: 40, g0: 10, saved: { mode: 30, s: 2, ratio: 0.875 } });
r = run({ name: 'rebuild waits for covers (cpu 30)', c0: 30, g0: 4, stages: { cover: 5 * 60000 } });
console.log(process.exitCode ? 'FAILED' : 'all checks passed');

// ---- the browser wrapper (createPerf) on fake animation frame timestamps: refresh measurement and the 30 fps cap at 50 / 60 / 75 / 90 / 120 / 144 Hz ----
{
  const mem = new Map();
  Object.assign(globalThis, { location: { search: '' }, addEventListener() {}, document: { hidden: false, getElementById: () => null }, devicePixelRatio: 2,
    screen: { width: 1280, height: 720 }, localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) } });
  Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 8 }, configurable: true });
  globalThis.window = globalThis;
  const { createPerf } = await import('../../src/perf.js');
  for (const hz of [50, 60, 75, 90, 100, 120, 144, 165, 180, 240]) for (const mode of [60, 30]) {
    const rd = { ratio: 1, getContext: () => ({ getExtension: () => null }), setPixelRatio(r) { this.ratio = r; }, getPixelRatio() { return this.ratio; }, domElement: { width: 1, height: 1 } };
    const perf = createPerf({ renderer: rd, gate: () => false });   // the game is "not active": the governor itself does nothing, only the cap runs
    perf.configure({ auto: true, ceil: 2 });
    const R = 1000 / hz; let t = 5000; const ran = [];
    for (let i = 0; i < hz * 3; i++) { t += R + (Math.random() - 0.5) * 0.3; perf.frame(t); }   // 3 s: the refresh rate gets measured (timestamps jitter by 0.3 ms)
    perf.force({ mode, s: 1, ratio: 1 });
    for (let i = 0; i < hz * 10; i++) { t += R + (Math.random() - 0.5) * 0.3; if (!perf.frame(t)) ran.push(t); }
    const gaps = ran.slice(1).map((x, i) => x - ran[i]), mean = gaps.reduce((a, b) => a + b, 0) / gaps.length, dev = Math.max(...gaps.map(g => Math.abs(g - mean)));
    const fps = ran.length / 10, mult = mode === 60 ? Math.max(1, Math.floor(hz / 60 + 0.05)) : Math.max(1, Math.floor(33.33 / R + 0.25)), want = hz / mult;
    console.log(`wrapper ${String(hz).padStart(3)} Hz, ${mode} mode: refresh read as ${(1000 / perf.stats().refreshMs).toFixed(1)} Hz, ${fps.toFixed(1)} frames per second (expected ${want.toFixed(1)}), frame gap ${mean.toFixed(2)} ms, worst deviation ${dev.toFixed(2)} ms`);
    ok(Math.abs(fps - want) < 1.5, `cap at ${hz} Hz mode ${mode}`);
    ok(dev < 0.5 * R, `even cadence (worst gap error under half a refresh) at ${hz} Hz mode ${mode}`);
  }
  {   // manual tiers are never capped
    const rd = { ratio: 1, getContext: () => ({ getExtension: () => null }), setPixelRatio(r) { this.ratio = r; }, getPixelRatio() { return this.ratio; }, domElement: { width: 1, height: 1 } };
    const perf = createPerf({ renderer: rd, gate: () => false });
    perf.configure({ auto: false, ratio: 1.5 });
    let t = 5000, run = 0; for (let i = 0; i < 1200; i++) { t += 1000 / 120; if (!perf.frame(t)) run++; }
    console.log(`manual tier at 120 Hz: ${run / 10} frames per second (uncapped)`); ok(run === 1200, 'manual uncapped');
  }
  console.log(process.exitCode ? 'FAILED' : 'wrapper checks passed');
}
