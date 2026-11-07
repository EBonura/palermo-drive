// What multiplayer costs on the wire, and how late the other car is drawn (docs/P2P-MULTIPLAYER.md, "Bytes on the wire").
//   tools/release/withbrowser.sh node tools/p2p/bytes.mjs --root <dist> --local [--scenario pair|crowd] [--secs 30] [--loss 0.05] [--jitter 40] [--json out.json]
// pair: two game pages a few metres apart. Phases: idle (both parked); Anna drives a loop (straights at 16 m/s with a little weave, braking at 5 m/s2 to 9 m/s for
// 25 m corners, accelerating out of them) while Bob is parked; both drive.
// crowd: 8 game pages in one spot, 4 drive the loop (spread along it), 4 parked.
//
// Bytes, per phase: per pair per second each way, from RTCPeerConnection.getStats() (transport: DTLS records, without ICE checks; the ICE checks from the nominated candidate
// pair), the packets, and an estimate of what goes through a TURN relay (each packet + 4 ChannelData + 8 UDP + 20 IPv4, each ICE check about 100 + 32). Also what the game hands to
// the data channels, by message: every RTCDataChannel.send is counted in the page (a Trystero frame is opened: room token, action name, payload).
//
// Lag (pair, driving phases): the sending page records where its car is every frame, the receiving page where it draws the other car. Both are pages of one browser on one
// clock (performance.timeOrigin + now). For every drawn frame, the time at which the sender's car was at the drawn point (the nearest point of its recorded path, within
// -0.5..+1.5 s) gives the delay: from the moment the sender's car is at a pose to the moment the receiver draws it there (network, buffer and all). Reported p50 / p95 for
// steady driving, right after a turn starts (0.8 s) and right after braking starts (0.8 s), with the distance off the path, the drawn speed against the true one, and the
// largest single-frame step. The drawn position is recorded where remotes.js sets it, with the frame's time; the sender's where the test drives it, with its frame's time.
//
// --loss P and --jitter J: a worse network, done in the sending pages by wrapping RTCDataChannel.send. Trystero's channel is reliable and ordered: a lost packet comes again
// after about 300 ms (a round trip and a retransmission timer) and holds every later message back (head of line). Any other channel (the game's unreliable STATE channel):
// a lost message is gone, the others come in any order. Each message is also held 0..J ms at random.
import fs from 'node:fs';
import { start, player, sleep, arg } from './lib.mjs';
const SC = arg('scenario', 'pair'), SECS = +arg('secs', 30), LOSS = +arg('loss', 0), JIT = +arg('jitter', 0), JSON_OUT = arg('json', '');
const ns = 'by' + Date.now().toString(36), h = await start();
const X0 = 137, Z0 = -212;

// ---------- the drive: a rounded rectangle 160 x 100 m, 25 m corners, sampled every metre, with a speed profile ----------
function track() {
  const W = 160, H = 100, R = 25, cx = X0, cz = Z0 + 40, raw = [];
  const corners = [[cx + W / 2 - R, cz + H / 2 - R, 0], [cx + W / 2 - R, cz - H / 2 + R, 1], [cx - W / 2 + R, cz - H / 2 + R, 2], [cx - W / 2 + R, cz + H / 2 - R, 3]];
  for (const [ox, oz, k] of corners) for (let a = 0; a <= 90; a += 3) { const t = (k * 90 + a) * Math.PI / 180; raw.push([ox + Math.sin(t) * R, oz + Math.cos(t) * R, 1]); }
  const pts = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L));
    for (let j = 0; j < n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, L > 3 ? 0 : 1]);   // [x, z, in a corner]
  }
  // speed limit: 16 m/s on straights, 9 in corners; braking at 5 m/s2 before a corner, accelerating at 3 after
  const N = pts.length, v = pts.map(p => p[2] ? 9 : 16);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = N - 1; i >= 0; i--) { const n = v[(i + 1) % N]; v[i] = Math.min(v[i], Math.sqrt(n * n + 2 * 5 * 1)); }
    for (let i = 0; i < N; i++) { const p = v[(i - 1 + N) % N]; v[i] = Math.min(v[i], Math.sqrt(p * p + 2 * 3 * 1)); }
  }
  return pts.map((p, i) => [p[0], p[1], v[i]]);
}
const TRACK = track();
// The test holds the car's pose itself: x, z, th and the speeds become getters on the car, so the game's physics (which would stop the car at the first wall the loop crosses)
// cannot change them between the test setting them and the netcode reading them. What the netcode sends is then exactly the path the test drives.
const HOLD = () => {
  const c = window.game.car; if (c.__held) return; c.__held = true; const pose = window.__pose = { x: c.x, z: c.z, th: c.th, vf: 0, vx: 0, vz: 0 };
  for (const k of Object.keys(pose)) Object.defineProperty(c, k, { get: () => pose[k], set: () => {}, configurable: true });
};
const drive = async (P, startAt) => { await P.page.evaluate(HOLD); await P.page.evaluate(([pts, s0]) => {
  const c = window.__pose, N = pts.length; window.__drive && cancelAnimationFrame(window.__drive);
  let s = s0, last = performance.now(), t = 0, px = NaN, pz = NaN; const hist = window.__hist = [];
  const at = s => { const i = Math.floor(s) % N, f = s - Math.floor(s), a = pts[i], b = pts[(i + 1) % N]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  const step = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    const [, , v] = at(s); s = (s + v * dt) % N;
    const [x, z, , th] = at(s), w = Math.sin(t * 2 * Math.PI / 3) * 0.3;   // a little weave across the lane
    const nx = x + Math.cos(th) * w, nz = z - Math.sin(th) * w;
    const head = Number.isFinite(px) && Math.hypot(nx - px, nz - pz) > 1e-4 ? Math.atan2(nx - px, nz - pz) : th;
    c.x = nx; c.z = nz; c.th = head; c.vf = v; c.vx = Math.sin(head) * v; c.vz = Math.cos(head) * v; px = nx; pz = nz;
    hist.push([performance.timeOrigin + now, nx, nz, head, v]); if (hist.length > 20000) hist.splice(0, 5000);
    window.__drive = requestAnimationFrame(step);
  };
  window.__drive = requestAnimationFrame(step);
}, [TRACK, startAt]); };
// parked: held where it is
const park = async P => { await P.page.evaluate(HOLD); await P.page.evaluate(() => { window.__drive && cancelAnimationFrame(window.__drive); const c = window.__pose; c.vf = c.vx = c.vz = 0; }); };

// ---------- in every page: count what goes into the data channels, and (--loss, --jitter) make the network worse ----------
const TAP = ([loss, jit]) => {
  const by = {}; window.__dcTap = by;
  const send = RTCDataChannel.prototype.send, tail = new WeakMap();
  RTCDataChannel.prototype.send = function (d) {
    const b = d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : null;
    try {
      let k = this.label + ':?';
      if (b && this.label === 'data') {   // Trystero: [1][token len u16][token][2][kind][action name, 32 bytes][meta len u16][meta][payload], or [2] room presence
        if (b[0] === 1) { const tl = (b[1] << 8) | b[2], o = 3 + tl; const name = b[o] === 2 ? new TextDecoder().decode(b.subarray(o + 2, o + 34)).replace(/\0/g, '') : 'ctl'; k = `trystero '${name}' (token ${tl} B, header 36 B, payload ${b.length - o - 36} B)`; }
        else k = 'trystero presence';
      } else if (b) k = `channel '${this.label}' type ${b[0]} (${b.length} B)`;
      const e = by[k] || (by[k] = { n: 0, bytes: 0 }); e.n++; e.bytes += b ? b.length : String(d).length;
    } catch (e) { /* counting only */ }
    if (!loss && !jit) return send.call(this, d);
    const copy = b ? b.slice() : d, now = performance.now();
    if (this.label === 'data') {   // reliable, ordered: a loss is a late copy that holds the rest back
      const at = Math.max(tail.get(this) || 0, now + Math.random() * jit + (Math.random() < loss ? 300 : 0)); tail.set(this, at);
      setTimeout(() => { if (this.readyState === 'open') send.call(this, copy); }, at - now);
    } else {
      if (Math.random() < loss) return;
      setTimeout(() => { if (this.readyState === 'open') send.call(this, copy); }, Math.random() * jit);
    }
  };
};
async function wireAll(P) {
  return P.page.evaluate(async () => {
    const seen = new Set(), out = [];
    for (const r of window.__p2p.rooms.values()) for (const [id, pc] of Object.entries(r.room.getPeers())) {
      if (seen.has(pc)) continue; seen.add(pc);
      const st = await pc.getStats(); const o = { id: id.slice(0, 6), tb: 0, rb: 0, tp: 0, rp: 0, req: 0, resp: 0, dcSent: 0, dcMs: 0, chans: [] };
      for (const s of st.values()) {
        if (s.type === 'transport') { o.tb += s.bytesSent || 0; o.rb += s.bytesReceived || 0; o.tp += s.packetsSent || 0; o.rp += s.packetsReceived || 0; }
        if (s.type === 'candidate-pair' && s.nominated) { o.req += (s.requestsSent || 0) + (s.consentRequestsSent || 0); o.resp += s.responsesSent || 0; }
        if (s.type === 'data-channel') { o.dcSent += s.bytesSent || 0; o.dcMs += s.messagesSent || 0; o.chans.push(s.label + ':' + s.state); }
      }
      out.push(o);
    }
    return { pcs: out, tap: JSON.parse(JSON.stringify(window.__dcTap || {})) };
  });
}
const diffTap = (a, b) => { const o = {}; for (const k of Object.keys(b)) { const n = b[k].n - ((a[k] && a[k].n) || 0), by = b[k].bytes - ((a[k] && a[k].bytes) || 0); if (n) o[k] = { n, bytes: by }; } return o; };
const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const r1 = x => Number.isFinite(x) ? +x.toFixed(1) : null, r2 = x => Number.isFinite(x) ? +x.toFixed(2) : null;

async function measure(Ps, label, secs, watch) {
  const w0 = await Promise.all(Ps.map(wireAll));
  if (watch) await watch.start();
  await sleep(secs * 1000);
  const w1 = await Promise.all(Ps.map(wireAll));
  let pcs = 0; const sum = { tb: 0, tp: 0, stun: 0, dcSent: 0, dcMs: 0 }; const tap = {}; const chans = new Set();
  Ps.forEach((P, i) => {
    for (const b of w1[i].pcs) {
      b.chans.forEach(c => chans.add(c));
      const a = w0[i].pcs.find(x => x.id === b.id); if (!a) continue; pcs++;
      for (const k of ['tb', 'tp', 'dcSent', 'dcMs']) sum[k] += b[k] - a[k];
      sum.stun += (b.req - a.req) + (b.resp - a.resp);
    }
    const d = diffTap(w0[i].tap, w1[i].tap); for (const [k, v] of Object.entries(d)) { const e = tap[k] || (tap[k] = { n: 0, bytes: 0 }); e.n += v.n; e.bytes += v.bytes; }
  });
  const per = v => v / pcs / secs;   // every connection end counts what it sent: the sum over them is pairs x 2 directions
  const res = {
    label, pcs, secs, chans: [...chans],
    dtlsBps: Math.round(per(sum.tb)), pps: r2(per(sum.tp)), stunPs: r2(per(sum.stun)),
    turnBps: Math.round(per(sum.tb + sum.tp * 32 + sum.stun * 132)),
    gameBps: Math.round(per(sum.dcSent)), gameMps: r2(per(sum.dcMs)),
    byMsg: Object.fromEntries(Object.entries(tap).sort((a, b) => b[1].bytes - a[1].bytes).map(([k, v]) => [k, { perS: r2(per(v.n)), bytesPerS: Math.round(per(v.bytes)) }])),
  };
  if (watch) res.lag = await watch.stop();
  console.log(`\n== ${label}: ${pcs} connection ends, ${secs} s, channels ${res.chans.join(' ')}`);
  console.log(`  per pair per second, one way: DTLS ${res.dtlsBps} B in ${res.pps} packets, ${res.stunPs} ICE checks;  through TURN (estimate) ${res.turnBps} B;  handed to the data channels ${res.gameBps} B in ${res.gameMps} messages`);
  for (const [k, v] of Object.entries(res.byMsg)) console.log(`    ${k.padEnd(70)} ${String(v.perS).padStart(6)} /s  ${String(v.bytesPerS).padStart(6)} B/s`);
  if (res.lag) console.log('  lag', JSON.stringify(res.lag));
  return res;
}

// ---------- lag: the sender's recorded path against where the receiver draws it ----------
function watcher(R, S) {
  return {
    async start() {
      await S.page.evaluate(() => { window.__hist.length = 0; });
      await R.page.evaluate(() => {
        // the drawn position is taken where the game sets it (remotes.js poseRemote), stamped with the frame's time, so the order of rAF callbacks does not matter
        window.__rec = []; window.__recOn = true;
        const f = () => { if (!window.__recOn) return; const r = [...window.__p2p.remotes.values()][0], pos = r && r.model && r.model.root.position;
          if (pos && !pos.__tap) { pos.__tap = true; const set = pos.set; pos.set = function (x, y, z) { if (window.__recOn) { const q = window.__rec, t = performance.timeOrigin + document.timeline.currentTime, l = q[q.length - 1]; if (l && l[0] === t) q.pop(); q.push([t, x, z]); } return set.call(this, x, y, z); }; }
          requestAnimationFrame(f); }; requestAnimationFrame(f);
      });
    },
    async stop() {
      const rec = await R.page.evaluate(() => { window.__recOn = false; return window.__rec; });
      const hist = await S.page.evaluate(() => window.__hist.slice());
      // sender phases: yaw rate and acceleration over about 0.1 s; a turn starts when the yaw rate first goes over 0.15 rad/s, braking when the deceleration goes over 1 m/s2
      const ph = hist.map(() => 'steady'); let lastTurn = -1e9, lastBrake = -1e9, wasTurn = false, wasBrake = false;
      for (let i = 0; i < hist.length; i++) {
        let j = i; while (j > 0 && hist[i][0] - hist[j][0] < 100) j--;
        const dt = (hist[i][0] - hist[j][0]) / 1000; if (dt <= 0) continue;
        let dth = hist[i][3] - hist[j][3]; dth -= 2 * Math.PI * Math.round(dth / (2 * Math.PI));
        const w = Math.abs(dth / dt), a = (hist[i][4] - hist[j][4]) / dt, t = hist[i][0];
        const turn = w > 0.15, brake = a < -1;
        if (turn && !wasTurn) lastTurn = t; if (brake && !wasBrake) lastBrake = t; wasTurn = turn; wasBrake = brake;
        ph[i] = t - lastBrake < 800 ? 'afterBraking' : t - lastTurn < 800 ? 'afterTurnStart' : turn ? 'turning' : brake ? 'braking' : 'steady';
      }
      const out = { steady: [], turning: [], braking: [], afterTurnStart: [], afterBraking: [] }, off = [], ratio = [], steps = []; let lo = 0;
      for (let k = 1; k < rec.length; k++) {
        const [t, x, z] = rec[k]; if (!hist.length || t < hist[0][0] + 1500 || t > hist[hist.length - 1][0] - 500) continue;
        while (lo < hist.length - 1 && hist[lo][0] < t - 1500) lo++;
        let best = Infinity, bt = NaN, bi = -1;
        for (let i = lo; i < hist.length - 1 && hist[i][0] < t + 500; i++) {
          const a = hist[i], b = hist[i + 1], dx = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dz * dz, u = L2 ? Math.max(0, Math.min(1, ((x - a[1]) * dx + (z - a[2]) * dz) / L2)) : 0;
          const d = Math.hypot(x - a[1] - dx * u, z - a[2] - dz * u); if (d < best) { best = d; bt = a[0] + (b[0] - a[0]) * u; bi = i; }
        }
        if (bi < 0) continue;
        out[ph[bi]].push(t - bt); off.push(best);
        const dtf = (t - rec[k - 1][0]) / 1000, step = Math.hypot(x - rec[k - 1][1], z - rec[k - 1][2]); steps.push(step);
        if (dtf > 0 && hist[bi][4] > 1) ratio.push(step / dtf / hist[bi][4]);
      }
      const all = Object.values(out).flat(), sd = a => ({ n: a.length, p50: r1(pct(a, 0.5)), p95: r1(pct(a, 0.95)) });
      return { delayMs: { all: sd(all), ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, sd(v)])) }, offPathM: { p50: r2(pct(off, 0.5)), p95: r2(pct(off, 0.95)), max: r2(Math.max(...off)) },
        drawnSpeedOverTrue: { p1: r2(pct(ratio, 0.01)), p5: r2(pct(ratio, 0.05)), p50: r2(pct(ratio, 0.5)), p95: r2(pct(ratio, 0.95)), p99: r2(pct(ratio, 0.99)) }, maxStepM: r2(Math.max(...steps)) };
    },
  };
}
const waitDrawn = async (Ps, n, ms = 120000) => { for (let t = 0; t < ms; t += 500) { const d = await Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.remotes.size))); if (d.every(x => x >= n)) return true; await sleep(500); } return false; };

const results = [];
try {
  if (SC === 'pair') {
    const A = await player(h, { name: 'Anna', ns, x: X0, z: Z0 }), B = await player(h, { name: 'Bob', ns, x: X0 + 4, z: Z0 + 7 });
    for (const P of [A, B]) await P.page.evaluate(TAP, [LOSS, JIT]);
    console.log('  met:', await waitDrawn([A, B], 1)); await sleep(5000);
    for (const P of [A, B]) console.log('  ' + P.name + ': STATE channel', JSON.stringify(await P.page.evaluate(() => { const d = window.__p2p, id = [...d.peers.keys()][0]; return { ch: d.fastChannel ? d.fastChannel(id) : 'none (older version)', negotiationneeded: d.stats.fastNeg, errors: d.stats.fastErr, peer: d.peerInfo()[0] }; })));
    await park(A); await park(B); await sleep(4000);
    results.push(await measure([A, B], 'idle, both parked', SECS));
    await drive(A, 0); await sleep(4000);
    results.push(await measure([A, B], 'Anna drives the loop, Bob parked', SECS * 1.5, watcher(B, A)));
    await drive(B, Math.floor(TRACK.length / 2)); await sleep(3000);
    results.push(await measure([A, B], 'both drive', SECS, watcher(B, A)));
    console.log('errors', A.errs.slice(0, 5), B.errs.slice(0, 5));
  } else {
    const Ps = [];
    for (let i = 0; i < 8; i++) Ps.push(await player(h, { name: 'P' + i, ns, x: X0 + (i % 4) * 5, z: Z0 + Math.floor(i / 4) * 6, size: [320, 180] }));
    for (const P of Ps) await P.page.evaluate(TAP, [LOSS, JIT]);
    console.log('  all see 7:', await waitDrawn(Ps, 7, 180000)); await sleep(5000);
    for (const P of Ps) await park(P); await sleep(4000);
    results.push(await measure(Ps, 'crowd of 8, all parked', SECS));
    for (let i = 0; i < 4; i++) await drive(Ps[i], Math.floor(i * TRACK.length / 4)); await sleep(4000);
    results.push(await measure(Ps, 'crowd of 8, 4 drive, 4 parked', SECS));
    console.log('errors', Ps.map(P => P.errs.slice(0, 3)));
  }
} finally { await h.close(); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
process.exit(0);
