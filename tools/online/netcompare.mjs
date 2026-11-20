// The same remote car driving the same path, drawn from what three send rules would send, side by side in the real game with a follow camera (the owner's eye on the looser roll tolerance).
//   tools/release/withbrowser.sh node tools/online/netcompare.mjs --root <dist built with --test-relay> [--out ~/.cache/palermo-drive/netcompare] [--lateral 4]
// The drive is netcompare-drive.json: 25 s of the real game's car on the 160 x 100 m loop of bytes.mjs, with the roll the game's own physics computed (recorded in this repo's history, see "about" in the file). Three senders look at it:
//   TODAY    the rule of the game before protocol 3: position 0.2 m, heading 0.035 rad, speed 0.5 m/s, roll 0.05 rad, all of them judged from 50 m out, nearest receiver near
//   SHIPPED  the new rule as shipped: position 0.3 m, heading 0.05 rad, speed 0.75 m/s, roll 0.075 rad, judged from 25 m out
//   LOOSE    the same with the roll tolerance at 0.1 rad
// Each sender's states (what it would send for a receiver 20 m away: the audience's nearest band) are made here with the game's own stateDue, predict() and the wire's quantisation, then fed to a puppet of the game's own remote
// (src/remotes.js: the receiver's buffer, predict() carrying the car past a state, the lean and the roll drawn) at the times they would arrive. The three cars drive side by side, 4 m apart. A fourth, not drawn, is the truth.
// Writes <out>/netcompare-<tag>.mp4 (the three cars, labelled, 20 s), a still every 4 s, and numbers.json: states a second and the errors (position and roll of what is drawn against the truth).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { start, player, sleep, arg } from './lib.mjs';
import { stateFrame, readState } from '../../src/online/wire.js';
import { predict } from '../../src/predict.js';

const OUT = arg("out", path.join(os.homedir(), ".cache/palermo-drive/netcompare")), LAT = +arg("lateral", 4), SECS = 20, T_START = 0, BEHIND = +arg('behind', 1.1), TAG = arg('tag', 'wide');   // the camera's car rides BEHIND seconds behind the three cars; --behind 0.5 --lateral 3 --tag close is the near view
fs.mkdirSync(OUT, { recursive: true });
const drive = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'netcompare-drive.json'), 'utf8')).samples;   // [ms, roll, th, v, x, z]
const TAU = Math.PI * 2, wrapPI = a => a - TAU * Math.floor((a + Math.PI) / TAU), clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// the car at time t (ms): linear between the 20 ms samples, the heading unwrapped
function at(t) {
  const i = clamp(Math.floor(t / 20), 0, drive.length - 2), f = clamp((t - drive[i][0]) / (drive[i + 1][0] - drive[i][0]), 0, 1), a = drive[i], b = drive[i + 1];
  return { roll: a[1] + (b[1] - a[1]) * f, th: a[2] + wrapPI(b[2] - a[2]) * f, v: a[3] + (b[3] - a[3]) * f, x: a[4] + (b[4] - a[4]) * f, z: a[5] + (b[5] - a[5]) * f };
}
const RULES = {
  TODAY: { keepMoving: 1000, keepParked: 2000, pos: 0.2, th: 0.035, v: 0.5, roll: 0.05, scale: 50, rollScaled: false },
  SHIPPED: { keepMoving: 1000, keepParked: 4000, pos: 0.3, th: 0.05, v: 0.75, roll: 0.075, scale: 25, rollScaled: true },
  LOOSE: { keepMoving: 1000, keepParked: 4000, pos: 0.3, th: 0.05, v: 0.75, roll: 0.1, scale: 25, rollScaled: true },
};
// the sender of online.js (stateDue, trackKin, carState) for a receiver at distance d, over the whole drive at 60 frames a second
function sender(R, d = 20) {
  const out = [], kin = { t: 0, th: 0, v: 0, w: 0, a: 0 }; let last = null;
  for (let t = 0; t <= drive[drive.length - 1][0]; t += 1000 / 60) {
    const c = at(t), v = c.v, dt = (t - kin.t) / 1000;
    if (kin.t && dt > 0 && dt < 0.5) { const f = Math.min(1, dt / 0.08); kin.w += (wrapPI(c.th - kin.th) / dt - kin.w) * f; kin.a += ((v - kin.v) / dt - kin.a) * f; } else { kin.w = 0; kin.a = 0; }
    kin.t = t; kin.th = c.th; kin.v = v;
    const band = d < 150 ? 100 : 200;
    let due = !last;
    if (last) {
      const age = t - last.t;
      if (age >= band - 5) {
        const moving = Math.abs(v) > 0.2 || Math.abs(last.v) > 0.2, f = Math.max(1, d / R.scale), pr = predict(last, Math.min(age, 1500) / 1000), roll = clamp(c.roll, -0.5, 0.5);
        due = age >= (moving ? R.keepMoving : R.keepParked) || Math.hypot(c.x - pr.x, c.z - pr.z) > R.pos * f || Math.abs(wrapPI(c.th - pr.th)) > R.th * f || Math.abs(v - pr.v) > R.v * f || Math.abs(roll - last.roll) > R.roll * (R.rollScaled ? f : 1);
      }
    }
    if (!due) continue;
    const fr = stateFrame({ t, x: c.x, z: c.z, th: c.th, v, steer: 0, roll: clamp(c.roll, -0.5, 0.5), lean: 0, fl: 0, k: Math.abs(v) > 1 ? kin.w / v : 0, a: kin.a, h: 0 });
    last = { ...readState(fr, 1), t }; out.push({ t, s: { ...last } });
  }
  return out;
}
const streams = Object.fromEntries(Object.entries(RULES).map(([k, R]) => [k, sender(R)]));
// not filmed: each change of the roll tolerance alone, to see what the roll is worth in states
const EXTRA = { 'TODAY with roll 0.075': { ...RULES.TODAY, roll: 0.075 }, 'TODAY with roll 0.1': { ...RULES.TODAY, roll: 0.1 }, 'SHIPPED with roll 0.05': { ...RULES.SHIPPED, roll: 0.05 }, 'SHIPPED with roll 0.15': { ...RULES.SHIPPED, roll: 0.15 } };
const extra = Object.fromEntries(Object.entries(EXTRA).map(([k, R]) => [k, sender(R)]));
// what is drawn against the truth, without the receiver's buffer: the last state carried on by predict(), the roll as last sent
function errors(st) {
  const pos = [], rol = []; let j = 0;
  for (let t = 1000; t < drive[drive.length - 1][0]; t += 1000 / 60) {
    while (j + 1 < st.length && st[j + 1].t <= t) j++;
    const s = st[j].s, c = at(t), p = predict(s, Math.min(t - s.t, 1500) / 1000);
    pos.push(Math.hypot(c.x - p.x, c.z - p.z)); rol.push(Math.abs(clamp(c.roll, -0.5, 0.5) - s.roll));
  }
  const pc = (a, q) => { const s = Float64Array.from(a).sort(); return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(3); };
  return { position_m: { p50: pc(pos, 0.5), p95: pc(pos, 0.95), max: pc(pos, 1) }, roll_rad: { p50: pc(rol, 0.5), p95: pc(rol, 0.95), max: pc(rol, 1) } };
}
const secs = drive[drive.length - 1][0] / 1000, numbers = Object.fromEntries(Object.entries({ ...streams, ...extra }).map(([k, st]) => [k, { states_per_s: +(st.length / secs).toFixed(2), ...errors(st) }]));
console.log(JSON.stringify(numbers, null, 1));
fs.writeFileSync(path.join(OUT, 'numbers.json'), JSON.stringify({ rules: RULES, receiver_distance_m: 20, seconds: secs, ...numbers }, null, 1));

if (process.argv.includes('--numbers')) process.exit(0);   // the numbers only: no browser
const h = await start({});
try {
  const P = await player(h, { name: 'Cam', x: drive[0][4], z: drive[0][5], size: [1280, 720], extra: 'clean' });
  await P.page.evaluate(() => { const c = window.game.car; if (c.__held) return; c.__held = true; const pose = window.__pose = { x: c.x, z: c.z, th: c.th, vf: 0, vx: 0, vz: 0 }; for (const k of Object.keys(pose)) Object.defineProperty(c, k, { get: () => pose[k], set: () => {}, configurable: true }); });
  // the three puppets, each fed at the times its states would arrive, 4 m apart across the path; the camera's own car follows the same path 1.1 s behind (about 18 m) (the chase camera rides it)
  await P.page.evaluate(([streams, drive, lat, start, behind]) => {
    const names = { TODAY: 'TODAY 0.05', SHIPPED: 'SHIPPED 0.075', LOOSE: 'LOOSE 0.10' }, offs = { TODAY: -lat, SHIPPED: 0, LOOSE: lat }, ps = {}, idx = {};
    for (const k in streams) { ps[k] = window.__p2p.puppet(900 + Object.keys(ps).length, names[k], 'calessino', 0); idx[k] = 0; }
    const pose = window.__pose, t0 = performance.now() - start * 1000;
    const at = t => { const i = Math.min(drive.length - 2, Math.max(0, Math.floor(t / 20))), f = Math.min(1, Math.max(0, (t - drive[i][0]) / (drive[i + 1][0] - drive[i][0]))), a = drive[i], b = drive[i + 1]; let dth = b[2] - a[2]; dth -= 2 * Math.PI * Math.round(dth / (2 * Math.PI)); return { th: a[2] + dth * f, x: a[4] + (b[4] - a[4]) * f, z: a[5] + (b[5] - a[5]) * f, v: a[3] + (b[3] - a[3]) * f }; };
    const tick = () => {
      const t = performance.now() - t0, tc = Math.max(0, t - behind * 1000), c = at(tc); Object.assign(pose, { x: c.x, z: c.z, th: c.th, vf: c.v, vx: Math.sin(c.th) * c.v, vz: Math.cos(c.th) * c.v });
      for (const k in streams) { const st = streams[k]; while (idx[k] < st.length && st[idx[k]].t <= t) { const s = { ...st[idx[k]].s }; s.x += Math.cos(s.th) * offs[k]; s.z -= Math.sin(s.th) * offs[k]; s.ts = s.t; delete s.t; ps[k].move(s); idx[k]++; } }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [Object.fromEntries(Object.entries(streams).map(([k, st]) => [k, st.map(e => ({ t: e.t, s: e.s }))])), drive, LAT, T_START, BEHIND]);
  await sleep(5000);
  const rec = await P.page.screencast({ path: path.join(OUT, `netcompare-${TAG}.mp4`) }).catch(e => { console.log('no screencast: ' + e.message); return null; });
  for (let i = 0; i < SECS / 4; i++) { await sleep(4000); await P.page.screenshot({ path: path.join(OUT, `still-${TAG}-${String(i).padStart(2, '0')}.png`) }); }
  if (rec) await rec.stop();
  console.log('written to ' + OUT);
} finally { await h.close(); }
process.exit(0);
