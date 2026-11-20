// A crowd of bots on a relay, driving like real players (docs/ONLINE-CROWD.md).
//   node tools/online/crowd.mjs --relay ws://127.0.0.1:8799/r --layout tight|street|city|mix --n 64 [--drive 0.5] [--secs 30] [--warm 8] [--seed 1] [--procs 1] [--loops calm|busy] [--json out.json]
// Every bot is a client of protocol v2 with the game's own send rule: the same stateDue() as src/online/online.js (a copy: that one lives inside the client's closure),
// the same predict() (src/predict.js, imported), the same frames (src/online/wire.js, imported). A bot drives the loop of tools/online/bytes.mjs (160 x 100 m, 25 m corners,
// a 0.3 m weave) or sits parked, and knows the other players only as the relay tells it (ENTER, LEAVE, STATE), as the game does: the nearest of them sets its pace.
// Layouts: tight (all inside a 100 m square), street (along 1 km), city (over 10 km in 8 clusters and 10 % loners), mix (half tight, a quarter on a street, a quarter in the city).
//
// Reported per player (mean, p50, p95, max over the players): frames and payload bytes received a second, the same with the WebSocket framing (2 bytes a frame down, 6 up) and an estimate with
// TLS and TCP/IP (22 bytes a record, 52 a packet; frames of one relay event to one player are one packet, and the estimate says so: it is an estimate, nothing here measures a real network),
// frames and bytes sent, the players held (ENTER minus LEAVE), and the delay from the sender's stamp to the frame's arrival (p50, p95, p99, max) in ms. For the relay: what `/stats` says
// (frames in, frames forwarded) a second. Delay is measured on one machine, with the harness's own event loop in it: with 300 bots that is not nothing (the lag of the harness itself is reported).
// `--procs P` splits the bots over P processes (a big crowd is a lot for one event loop); stamps are Date.now() milliseconds, so the delay across processes is on one clock.
// Only a relay on this machine is accepted, except with --allow-remote (the one real run of the docs, with at most 20 bots).
import http from 'node:http';
import https from 'node:https';
import { fork, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBot } from './bot.mjs';
import { stateFrame, readState } from '../../src/online/wire.js';
import { predict } from '../../src/predict.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes('--' + k);
const RELAY = arg('relay', 'ws://127.0.0.1:8799/r'), LAYOUT = arg('layout', 'tight'), N = +arg('n', 64), DRIVE = +arg('drive', 0.5), SECS = +arg('secs', 30), WARM = +arg('warm', 8), SEED = +arg('seed', 1);
const PROCS = +arg('procs', 1), CALM = arg('loops', 'calm') === 'calm', SLICE = arg('slice', ''), T0 = +arg('t0', 0), ORIGIN = arg('origin', 'http://127.0.0.1:1'), JSON_OUT = arg('json', ''), EXT = arg('extensions', '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// ---------- layouts and the drive (src/... hubbench/src/sim.rs has the same, for the relay's own simulation) ----------
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function track(W, H, R, rot, cx, cz) {
  const corners = [[W / 2 - R, H / 2 - R, 0], [W / 2 - R, -H / 2 + R, 1], [-W / 2 + R, -H / 2 + R, 2], [-W / 2 + R, H / 2 - R, 3]], raw = [];
  for (const [ox, oz, k] of corners) for (let a = 0; a <= 90; a += 3) { const t = (k * 90 + a) * Math.PI / 180; raw.push([ox + Math.sin(t) * R, oz + Math.cos(t) * R, 1]); }
  const pts = [];
  for (let i = 0; i < raw.length; i++) { const a = raw[i], b = raw[(i + 1) % raw.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L)); for (let j = 0; j < n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, L > 3 ? 0 : 1]); }
  const n = pts.length, v = pts.map(p => p[2] ? 9 : 16);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = n - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[(i + 1) % n] ** 2 + 10));
    for (let i = 0; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[(i - 1 + n) % n] ** 2 + 6));
  }
  const s = Math.sin(rot), c = Math.cos(rot);
  return pts.map((p, i) => [cx + p[0] * c - p[1] * s, cz + p[0] * s + p[1] * c, v[i]]);
}
function place(layout, n, drive, rnd) {
  const range = (a, b) => a + (b - a) * rnd(), clusters = Array.from({ length: 8 }, () => [range(-4500, 4500), range(-4500, 4500)]), out = [];
  const loop = (w, h, cx, cz) => { const pts = CALM ? track(160, 100, 25, range(0, 2 * Math.PI), cx, cz) : track(w, h, Math.min(12, h / 2.5), range(0, 2 * Math.PI), cx, cz), s = range(0, pts.length); return { pts, s, x: cx, z: cz }; };
  const parked = (x, z) => ({ pts: null, s: 0, x, z, th: range(0, 2 * Math.PI) });
  for (let i = 0; i < n; i++) {
    const driving = rnd() < drive;
    const kind = layout === 'tight' ? 0 : layout === 'street' ? 1 : layout === 'city' ? 2 : i * 2 < n ? 0 : i * 4 < n * 3 ? 1 : 2;
    const [ox, oz] = layout === 'mix' ? (kind === 0 ? [2000, 2000] : kind === 1 ? [-3000, -2500] : [0, 0]) : kind === 1 ? [-500, 0] : [0, 0];
    if (kind === 0) out.push(driving ? loop(range(40, 90), range(30, 60), ox + range(-20, 20), oz + range(-20, 20)) : parked(ox + range(-50, 50), oz + range(-50, 50)));
    else if (kind === 1) { if (driving) { const pts = track(1000, 30, 12, 0, ox + 500, oz), s = range(0, pts.length); out.push({ pts, s, x: pts[Math.floor(s)][0], z: pts[Math.floor(s)][1] }); } else out.push(parked(ox + range(0, 1000), oz + range(-12, 12))); }
    else { let cx, cz; if (rnd() < 0.1) { cx = range(-5000, 5000); cz = range(-5000, 5000); } else { const c = clusters[Math.floor(rnd() * 8)]; cx = c[0] + range(-150, 150); cz = c[1] + range(-150, 150); } out.push(driving ? loop(range(60, 110), range(40, 70), cx, cz) : parked(cx, cz)); }
  }
  return out;
}

// ---------- the game's send rule (src/online/online.js: SEND_*, KEEP_*, DR_*, stateDue, trackKin) ----------
const SEND_NEAR = 100, SEND_MID = 200, SEND_FAR = 1000, SEND_AFAR = 2500;
// --rule today: the game's rule before protocol 3 (and --ver 2). --rule shipped: src/online/online.js now (the constants are copied from it; protocol 3 tells the audience, the tolerances are looser).
const RULES = {
  today: { keepMoving: 1000, keepParked: 2000, keepMovingNobody: 1000, keepParkedNobody: 2000, keepParkedAud: 2000, pos: 0.2, th: 0.035, v: 0.5, roll: 0.05, scale: 50, audience: false },
  shipped: { keepMoving: 1000, keepParked: 2000, keepMovingNobody: 4000, keepParkedNobody: 15000, keepParkedAud: 4000, pos: 0.3, th: 0.05, v: 0.75, roll: 0.075, scale: 25, audience: true },
};
const R = RULES[arg('rule', +arg('ver', 3) === 2 ? 'today' : 'shipped')], VER = +arg('ver', 3), WANT_K = +arg('want-k', 0);
const AUD_LOW = [Infinity, 0, 50, 100, 150, 250, 350, 600, 1200];
const wrapPI = a => { a = a % (2 * Math.PI); return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a; };
const ROLL_GAIN = 0.0226, ROLL_W = 12, ROLL_ZETA = 0.25, ROLL_NOISE = +arg('roll-noise', 0.06);   // the body roll model of hubbench/src/sim.rs, fitted to the 4.7 states a second the real game page sends on this loop (docs/ONLINE-CROWD.md)

function makeBot(i, spec, url, results) {
  const car = { x: spec.x, z: spec.z, th: spec.th || 0, vf: 0, roll: 0 }, body = { rv: 0, n: 0 }, rnd = mulberry(i * 977 + SEED), kin = { t: 0, th: 0, v: 0, w: 0, a: 0 };
  const others = new Map(), skip = new Set(), hist = new Uint32Array(2001), c = { rxStates: 0, rx: 0, rxB: 0, rxWire: 0, rxPk: 0, tx: 0, txB: 0, bad: 0, held: 0, heldSum: 0, heldN: 0, drops: 0 };
  let bot = null, s = spec.s, tdrive = 0, px = NaN, pz = NaN, last = null, forceState = false, measuring = false, audience = null;
  const at = s => { const n = spec.pts.length, k = Math.floor(s) % n, f = s - Math.floor(s), a = spec.pts[k], b = spec.pts[(k + 1) % n]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  const drive = dt => {
    if (!spec.pts) return;
    tdrive += dt; const [, , v] = at(s); s = (s + v * dt) % spec.pts.length; const [x, z, , th] = at(s), w = Math.sin(tdrive * 2 * Math.PI / 3) * 0.3;
    const nx = x + Math.cos(th) * w, nz = z - Math.sin(th) * w, head = Number.isFinite(px) && Math.hypot(nx - px, nz - pz) > 1e-4 ? Math.atan2(nx - px, nz - pz) : th;
    Object.assign(car, { x: nx, z: nz, th: head, vf: v }); px = nx; pz = nz;
  };
  const trackKin = now => {
    const dt = (now - kin.t) / 1000, v = car.vf || 0;
    if (kin.t && dt > 0 && dt < 0.5) { const f = Math.min(1, dt / 0.08); kin.w += (wrapPI(car.th - kin.th) / dt - kin.w) * f; kin.a += ((v - kin.v) / dt - kin.a) * f; } else { kin.w = 0; kin.a = 0; }
    kin.t = now; kin.th = car.th; kin.v = v;
    if (dt > 0 && dt < 0.5) {   // the body: x'' = w2 (target - x) - 2 z w x', with terrain noise (an Ornstein-Uhlenbeck process, 0.3 s long)
      const g = (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508; body.n += -body.n / 0.3 * dt + ROLL_NOISE * Math.sqrt(2 * dt / 0.3) * g;
      const target = -ROLL_GAIN * v * kin.w + (Math.abs(v) > 0.2 ? body.n : 0), acc = ROLL_W * ROLL_W * (target - car.roll) - 2 * ROLL_ZETA * ROLL_W * body.rv;
      body.rv += acc * dt; car.roll += body.rv * dt;
    }
  };
  const audienceD = () => R.audience && audience !== null ? AUD_LOW[audience] : nearest();
  const nearest = () => { let d = Infinity; for (const p of others.values()) { const q = Number.isFinite(p.x) ? Math.hypot(p.x - car.x, p.z - car.z) : 0; if (q < d) d = q; } return d; };
  const stateDue = (now, d) => {   // online.js stateDue()
    if (!last) return true;
    const age = now - last.t, band = d < 150 ? SEND_NEAR : d < 350 ? SEND_MID : d < 1200 ? SEND_FAR : SEND_AFAR;
    if (age < SEND_NEAR - 5) return false;
    if (forceState) return true;
    if (age < band - 5) return false;
    const v = car.vf || 0, moving = Math.abs(v) > 0.2 || Math.abs(last.v) > 0.2, nobody = R.audience && audience === 0;
    const keep = moving ? (nobody ? R.keepMovingNobody : R.keepMoving) : nobody ? R.keepParkedNobody : R.audience && audience !== null ? R.keepParkedAud : R.keepParked;
    if (age >= Math.max(band, keep)) return true;
    const f = Math.max(1, d / R.scale), pr = predict(last, Math.min(age, 1500) / 1000), rf = R.audience ? f : 1, roll = Math.max(-0.5, Math.min(0.5, car.roll));
    return Math.hypot(car.x - pr.x, car.z - pr.z) > R.pos * f || Math.abs(wrapPI(car.th - pr.th)) > R.th * f || Math.abs(v - pr.v) > R.v * f || Math.abs(roll - last.roll) > R.roll * rf;
  };
  const tick = now => {   // now: Date.now() (ms)
    const dt = Math.min(0.1, (now - (tick.last || now - 16)) / 1000); tick.last = now; drive(dt); trackKin(now);
    if (!bot || !bot.handle) return;
    if (!stateDue(now, audienceD())) return;
    const v = car.vf || 0, f = stateFrame({ t: now, x: car.x, z: car.z, th: car.th, v, steer: 0, roll: Math.max(-0.5, Math.min(0.5, car.roll)), lean: 0, fl: 0, k: Math.abs(v) > 1 ? kin.w / v : 0, a: kin.a, h: 0 });
    bot.send(f); last = { ...readState(f, 1), t: now }; forceState = false;
    if (measuring) { c.tx++; c.txB += f.length; }
  };
  const onEnter = h => { others.set(h, { x: NaN, z: NaN }); if (!R.audience) forceState = true; skip.add(h); };
  const place = (h, p, o) => { const x = others.get(h); if (x) { const v = (p[o + 2] | p[o + 3] << 8 | p[o + 4] << 16 | p[o + 5] << 24) >>> 0, xq = v & 0xfffff, zq = (v >>> 20) | (p[o + 6] << 12); x.x = (xq - 524288) / 20; x.z = (zq - 524288) / 20; } };
  const sample = (h, t16) => { if (skip.has(h)) skip.delete(h); else { const d = ((Date.now() & 0xffff) - t16) & 0xffff; hist[Math.min(2000, d)]++; } };   // the state that follows an ENTER is the sender's last one, possibly old: not a delay sample
  const onFrame = (p, hdr, first) => {
    const m = measuring;
    if (m) { c.rx++; c.rxB += p.length; c.rxWire += p.length + hdr; if (first) c.rxPk++; }   // frames that came in one read of the socket share a packet (on loopback; a real network coalesces differently)
    if (p[0] === 2) onEnter(p[1] | p[2] << 8);
    else if (p[0] === 3) others.delete(p[1] | p[2] << 8);
    else if (p[0] === 4) { const h = p[1] | p[2] << 8; place(h, p, 3); if (m) { c.rxStates++; sample(h, p[3] | p[4] << 8); } }
    else if (p[0] === 8) { let o = 2; for (let i = 0; i < p[1]; i++) { const h = p[o] | p[o + 1] << 8, len = p[o + 2 + 14] & 8 ? 20 : 18; place(h, p, o + 2); if (m) { c.rxStates++; sample(h, p[o + 2] | p[o + 3] << 8); } o += 2 + len; } }
    else if (p[0] === 9) { const prev = audience; audience = p[1]; if (audience !== 0 && (prev === null || prev === 0 || audience < prev)) forceState = true; }
  };
  return {
    async open() { bot = await startBot(url, { name: 'c' + i, x: spec.x, z: spec.z, origin: ORIGIN, ip: flag('allow-remote') ? null : `10.${(i >> 8) & 255}.${i & 255}.${1 + (SEED & 127)}`, onFrame, extensions: EXT, ver: VER, wantK: WANT_K }); this.bot = bot; },
    tick, setMeasuring(m) { measuring = m; if (!m) return; },
    sample() { c.heldSum += others.size; c.heldN++; },
    close: () => bot && bot.close(), c, hist, driving: !!spec.pts, get closed() { return bot && bot.closed; }, get ext() { return bot && bot.extensions; },
  };
}

// ---------- one process: its slice of the bots ----------
async function runSlice(lo, hi, t0) {
  const specs = place(LAYOUT, N, DRIVE, mulberry(SEED * 7919 + 13)), bots = [];
  for (let i = lo; i < hi; i++) { const b = makeBot(i, specs[i], RELAY, null); await b.open(); bots.push(b); if (i % 20 === 19) await sleep(20); }
  const wait = t0 - Date.now(); if (wait > 0) await sleep(wait);
  let lagMax = 0, lagSum = 0, lagN = 0, tickLast = Date.now();
  const iv = setInterval(() => { const now = Date.now(); const l = now - tickLast - 16; if (measuringAll) { lagMax = Math.max(lagMax, l); lagSum += Math.max(0, l); lagN++; } tickLast = now; for (const b of bots) b.tick(now); }, 16);
  let measuringAll = false;
  await sleep(WARM * 1000);
  const m0 = Date.now(); measuringAll = true; bots.forEach(b => b.setMeasuring(true));
  const si = setInterval(() => bots.forEach(b => b.sample()), 1000);
  await sleep(SECS * 1000);
  const m1 = Date.now(); bots.forEach(b => b.setMeasuring(false)); clearInterval(si); clearInterval(iv);
  const out = bots.map(b => ({ ...b.c, driving: b.driving, hist: Array.from(b.hist), closed: b.closed, ext: b.ext }));
  await Promise.all(bots.map(b => b.close()));
  return { secs: (m1 - m0) / 1000, bots: out, lag: { max: lagMax, mean: lagN ? lagSum / lagN : 0 } };
}

const statsUrl = RELAY.replace(/^ws/, 'http').replace(/\/r(\?.*)?$/, '/stats');
const getStats = () => new Promise(res => (statsUrl.startsWith('https') ? https : http).get(statsUrl, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { res(null); } }); }).on('error', () => res(null)));

if (SLICE) {   // child: goes with its parent (a parent that is killed must not leave 300 bots on the relay)
  process.on('disconnect', () => process.exit(0));
  const [lo, hi] = SLICE.split('-').map(Number);
  const r = await runSlice(lo, hi, T0); process.send(r); setTimeout(() => process.exit(0), 300);
}

if (!flag('allow-remote') && !/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(RELAY)) { console.error('only a relay on this machine: ' + RELAY); process.exit(2); }
// --pid <workerd pids, comma separated>: the CPU of a local `wrangler dev` over the measured window, from ps (10 ms steps), less its idle CPU. Workers freeze their clocks while code runs, so a Worker cannot time itself: this is the nearest
// thing from outside. It includes workerd's socket handling and the loopback, which Cloudflare does not bill as CPU, so it is an upper bound on what the plan's CPU limit sees.
const PIDS = arg('pid', '').split(',').filter(Boolean);
const psnum = (p, col) => execFileSync('ps', ['-o', col + '=', '-p', p]).toString().trim();
const cpuNow = () => PIDS.reduce((a, p) => { const [m, sec] = psnum(p, 'cputime').split(':'); return a + +m * 60 + +sec; }, 0), rssNow = () => PIDS.reduce((a, p) => a + +psnum(p, 'rss') / 1024, 0);
let c0 = 0, c1 = 0, idleCpu = 0, rssPeak = 0, rssBase = 0;
if (PIDS.length) { const i0 = cpuNow(); await sleep(6000); idleCpu = (cpuNow() - i0) / 6; rssBase = rssNow(); }
let s0 = null, s1 = null;
const t0 = Date.now() + 2000 + N * 25 / PROCS, T0_ = t0, per = Math.ceil(N / PROCS), children = [];
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { for (const ch of children) ch.kill(); process.exit(1); });
setTimeout(() => { if (PIDS.length) c0 = cpuNow(); }, Math.max(0, T0_ + WARM * 1000 - Date.now()));
setTimeout(() => { if (PIDS.length) c1 = cpuNow(); }, Math.max(0, T0_ + (WARM + SECS) * 1000 - Date.now()));
if (PIDS.length) setInterval(() => { rssPeak = Math.max(rssPeak, rssNow()); }, 1000).unref();
let s0p = null, s1p = null;
setTimeout(() => { s0p = getStats(); }, Math.max(0, t0 + WARM * 1000 - Date.now()));
setTimeout(() => { s1p = getStats(); }, Math.max(0, t0 + (WARM + SECS) * 1000 - Date.now()));
const parts = await Promise.all(Array.from({ length: PROCS }, (_, p) => new Promise((res, rej) => {
  const lo = p * per, hi = Math.min(N, lo + per); if (lo >= hi) return res(null);
  const args = process.argv.slice(2).concat(['--slice', `${lo}-${hi}`, '--t0', String(t0)]);
  const ch = fork(fileURLToPath(import.meta.url), args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] }); children.push(ch);
  ch.on('message', m => res(m)); ch.on('exit', c => c && rej(new Error('a child failed: ' + c)));
})));
s0 = await s0p; s1 = await s1p;   // an overloaded relay answers /stats late, and that is a result too: the time it took is reported
const secs = mean(parts.filter(Boolean).map(p => p.secs)), bots = parts.filter(Boolean).flatMap(p => p.bots);
const hist = new Array(2001).fill(0); bots.forEach(b => b.hist.forEach((v, i) => hist[i] += v));
const hp = p => { const tot = hist.reduce((a, b) => a + b, 0); let acc = 0; for (let i = 0; i <= 2000; i++) { acc += hist[i]; if (acc >= tot * p) return i; } return 2000; };
const col = f => bots.map(f), summary = a => ({ mean: +mean(a).toFixed(2), p50: +pct(a, 0.5).toFixed(2), p95: +pct(a, 0.95).toFixed(2), max: +pct(a, 1).toFixed(2) });
const IPTCP = 52, TLS = 22;
const res = {
  layout: LAYOUT, n: N, drive: DRIVE, procs: PROCS, secs: +secs.toFixed(1), loops: CALM ? 'calm' : 'busy', relay: RELAY,
  down_frames: summary(col(b => b.rx / secs)), down_states: summary(col(b => b.rxStates / secs)), down_payload: summary(col(b => b.rxB / secs)), down_ws: summary(col(b => b.rxWire / secs)),
  down_ip_est: summary(col(b => (b.rxWire + b.rx * TLS + b.rxPk * IPTCP) / secs)), down_packets_est: +mean(col(b => b.rxPk / secs)).toFixed(2),
  up_frames: +mean(col(b => b.tx / secs)).toFixed(2), up_frames_driving: +mean(bots.filter(b => b.driving).map(b => b.tx / secs)).toFixed(2), up_frames_parked: +mean(bots.filter(b => !b.driving).map(b => b.tx / secs)).toFixed(2),
  up_payload: +mean(col(b => b.txB / secs)).toFixed(0), up_ws: +mean(col(b => (b.txB + b.tx * 6) / secs)).toFixed(0),
  held: summary(col(b => b.heldN ? b.heldSum / b.heldN : 0)),
  delay_ms: { samples: hist.reduce((a, b) => a + b, 0), p50: hp(0.5), p95: hp(0.95), p99: hp(0.99), max: hist.findLastIndex(v => v) },
  harness_lag_ms: { max: Math.max(...parts.filter(Boolean).map(p => p.lag.max)), mean: +mean(parts.filter(Boolean).map(p => p.lag.mean)).toFixed(1) },
  relay_cpu: PIDS.length ? (() => { const net = c1 - c0 - idleCpu * secs, ev = s1.framesIn - s0.framesIn; return { net_cpu_s: +net.toFixed(2), idle_cpu_per_s: +idleCpu.toFixed(3), pct_of_one_core: +(100 * net / secs).toFixed(1), us_per_incoming_state_with_fanout: +(net / ev * 1e6).toFixed(0), rss_mb_before: +rssBase.toFixed(0), rss_mb_peak: +rssPeak.toFixed(0) }; })() : undefined,
  closed: bots.filter(b => b.closed !== null && b.closed !== undefined).length, extensions: [...new Set(bots.map(b => b.ext))],
  relay_stats: s0 && s1 && s1.framesIn !== undefined ? { events_ps: +((s1.framesIn - s0.framesIn) / SECS).toFixed(1), forwarded_ps: +((s1.framesForwarded - s0.framesForwarded) / SECS).toFixed(1), before: s0, after: s1 } : { before: s0, after: s1 },
};
for (const ch of children) ch.kill();
console.log(JSON.stringify(res, null, 1));
if (JSON_OUT) (await import('node:fs')).writeFileSync(JSON_OUT, JSON.stringify(res, null, 1));
process.exit(0);
