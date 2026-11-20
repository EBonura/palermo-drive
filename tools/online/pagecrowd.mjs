// One real game page standing in a tight crowd of bots, and what it costs the page (docs/ONLINE-CROWD.md): frame time (median, p95, frames over 50 ms), the time its online code takes a frame, how many cars it draws, and how far
// behind the cars are drawn (the receiver's own buffer, src/remotes.js). The page drives a loop inside the crowd; the bots (tools/online/crowd.mjs, tight layout, driving and parked) are on a relay.
//   tools/release/withbrowser.sh node tools/online/pagecrowd.mjs --root <dist built with --test-relay> [--relay ws://127.0.0.1:8799/r] [--crowds 0,16,32,64] [--profiles desktop,phone] [--reps 2] [--secs 20]
//        [--k 32] [--shown 0] [--ver 3] [--json out.json]
// --k and --shown go to the page as ?k= and ?shown= (the set size it asks for, and the cars it draws: 0 is its own cap, 32 on a desktop and 12 on a touch screen). With no --relay each condition starts a relay simulator
// (which sends the page what it asks for but does not batch or tell the audience); with --relay (`wrangler dev` of relay-worker/, run by hand) it is the real one, and a crowd of bots from one machine needs its
// address cap raised (PD_MAX_PER_IP is not a thing of this build: the bots use a made up CF-Connecting-IP each, which the local relay honours).
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { start, player, sleep, arg, drivePath } from './lib.mjs';
const CROWDS = arg('crowds', '0,16,32,64').split(',').map(Number), PROFILES = arg('profiles', 'desktop,phone').split(','), REPS = +arg('reps', 2), SECS = +arg('secs', 20), JSON_OUT = arg('json', '');
const K = +arg('k', 0), SHOWN = +arg('shown', 0), VER = arg('ver', '3'), RELAY = arg('relay', '');
const CROWD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'crowd.mjs');
const h = await start({ sim: { k: 64 } });
const pct = (a, p) => { const s = Float64Array.from(a).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const results = [];
// a crowd that is killed must be gone from the relay before the next condition, or the next page sees its bots too: wait for the relay to hold nobody (a real relay is asked on /stats; the simulator of a condition is new each time)
const connections = async () => { if (!RELAY) return 0; try { return (await (await fetch(RELAY.replace(/^ws/, 'http').replace(/\/r$/, '/stats'))).json()).connections; } catch (e) { return -1; } };
const emptyRelay = async () => { for (let i = 0; i < 40; i++) { if (!(await connections())) return true; await sleep(1000); } return false; };
try {
  for (let rep = 0; rep < REPS; rep++) for (const profile of PROFILES) for (const n of CROWDS) {
    const url = RELAY || await h.newRelay({ k: 64 });
    if (!(await emptyRelay())) { console.log('the relay is not empty: ' + (await connections()) + ' connections'); process.exit(3); }
    let crowd = null;
    if (n) { crowd = spawn(process.execPath, [CROWD, '--relay', url, '--layout', 'tight', '--n', String(n), '--drive', '0.5', '--secs', String(SECS + 60), '--warm', '5', '--seed', String(rep + 1), '--ver', VER], { stdio: ['ignore', 'ignore', 'inherit'] }); await sleep(8000 + n * 40); }
    const phone = profile === 'phone';
    const P = await player(h, { name: 'Page', x: 0, z: 0, relay: url, phone, cpu: phone ? 4 : 1, size: [960, 540], extra: `${K ? 'k=' + K + '&' : ''}${SHOWN ? 'shown=' + SHOWN : ''}` });
    // a loop inside the crowd's square, at the speed of the crowd's cars
    const loop = [[-40, -30], [40, -30], [40, 30], [-40, 30]]; await drivePath(P, loop, 12, true);
    await P.page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = t => { window.__ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await sleep(12000 + n * 30);
    const s0 = await P.page.evaluate(() => ({ ...window.__p2p.stats }));
    await P.page.evaluate(() => { window.__ft.length = 0; });
    await sleep(SECS * 1000);
    const ft = await P.page.evaluate(() => window.__ft.slice()), s1 = await P.page.evaluate(() => ({ ...window.__p2p.stats }));
    const end = await P.page.evaluate(() => { const d = window.__p2p, rs = [...d.remotes.values()].filter(r => !r.far); return { cars: d.cars(), rings: d.remotes.size - d.cars(), tracked: d.peers.size, k: d.maxTracked(), relayVer: d.relayVer(), audience: d.audience(), delay_ms: rs.length ? +(rs.reduce((a, r) => a + r.delay, 0) / rs.length).toFixed(0) : null, jitter_ms: rs.length ? +(rs.reduce((a, r) => a + (r.jit || 0), 0) / rs.length).toFixed(0) : null }; });
    const frames = s1.updN - s0.updN;
    const r = { profile, crowd: n, rep, ...end, frames: ft.length, fps: +(ft.length / SECS).toFixed(1), frame_ms: { p50: +pct(ft, 0.5).toFixed(1), p95: +pct(ft, 0.95).toFixed(1), p99: +pct(ft, 0.99).toFixed(1) }, over50: ft.filter(x => x > 50).length, over100: ft.filter(x => x > 100).length,
      online_ms_per_frame: { update: +((s1.updMs - s0.updMs) / Math.max(1, frames)).toFixed(3), frames_handling: +((s1.rxMs - s0.rxMs) / Math.max(1, frames)).toFixed(3) }, rx_frames_per_s: +((s1.rx - s0.rx) / SECS).toFixed(0), rx_states_per_s: +((s1.states - s0.states) / SECS).toFixed(0),
      tx_per_s: +((s1.tx - s0.tx) / SECS).toFixed(2), dropped: s1.rxDropped - s0.rxDropped, threw: s1.threw, errors: P.errs.slice(0, 3) };
    console.log(JSON.stringify(r)); results.push(r);
    await P.page.close().catch(() => {}); if (P.ctx) await P.ctx.close().catch(() => {});
    if (crowd) { crowd.kill(); await sleep(2500); }
  }
} finally { await h.close(); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
process.exit(0);
