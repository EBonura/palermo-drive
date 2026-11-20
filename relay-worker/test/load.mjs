// Load check against `wrangler dev`: N players spread over a few hundred metres, each sending 5 states a second.
//   node test/load.mjs [--n 60] [--rate 5] [--secs 20] [--area 600]
// It reports three things: that every frame the relay forwarded reached its client (no loss between the relay and the
// sockets), that every state that arrived was one the rules allow (sender in the receiver's set, set size at most K),
// and how many arrived against what the rules say a receiver should get, replaying each sender's send times through
// the thinning rule for every (receiver, sender) pair that held steady during the window. Then the delay percentiles.
import { sleep, Client, stateFrame, stats } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const N = arg('n', 60), RATE = arg('rate', 5), SECS = arg('secs', 20), AREA = arg('area', 600), K = 8, WARM_MS = 3500;

const band = d => d < 150 ? 0 : d < 350 ? 200 : d < 1200 ? 1000 : 2500;
const players = [];
for (let i = 0; i < N; i++) {
  const c = await Client.open();
  await c.join('load' + i);
  Object.assign(c, { x: Math.random() * AREA, z: Math.random() * AREA, sends: [], set: new Set(), arrivals: new Map(), enterAt: new Map(), leftDuring: new Set(), skipNext: new Set(), delays: [], recv: 0, bad: 0, maxSet: 0, minSetAtEnd: 0 });
  players.push(c);
}
const byHandle = new Map(players.map(c => [c.handle, c]));
console.log(`${N} players connected; area ${AREA} m x ${AREA} m, ${RATE} states a second each, ${SECS} s measured after a ${WARM_MS / 1000} s warm up`);

let measuring = false, t0 = 0;
for (const c of players) {
  // Frames from one socket arrive in order, so ENTER and LEAVE tell exactly which senders are held at each STATE.
  c.ws.onmessage = e => {
    const now = performance.now();
    const f = new Uint8Array(e.data), h = f[1] | (f[2] << 8);
    if (f[0] === 2) { c.set.add(h); c.skipNext.add(h); c.maxSet = Math.max(c.maxSet, c.set.size); if (measuring) c.leftDuring.add(h); } // an ENTER mid-run: not steady
    else if (f[0] === 3) { c.set.delete(h); if (measuring) c.leftDuring.add(h); }
    else if (f[0] === 4) {
      if (!c.set.has(h)) c.bad++;
      if (!measuring) return;
      c.recv++;
      if (!c.arrivals.has(h)) c.arrivals.set(h, []);
      c.arrivals.get(h).push(now);
      if (c.skipNext.has(h)) c.skipNext.delete(h); // the state that follows an ENTER is the sender's last one, possibly old: not a delay sample
      else c.delays.push((Math.round(now) - (f[3] | (f[4] << 8))) & 0xffff);
    }
  };
}

const timers = players.map(c => {
  let phase = Math.random() * (1000 / RATE), iv;
  const start = setTimeout(() => {
    iv = setInterval(() => {
      const now = performance.now();
      c.x += (Math.random() - 0.5) * 0.4; c.z += (Math.random() - 0.5) * 0.4; // a car idling about
      c.send(stateFrame(c.x, c.z, { tag: Math.round(now) & 0xffff }));
      if (measuring) c.sends.push(now);
    }, 1000 / RATE);
  }, phase);
  return () => { clearTimeout(start); clearInterval(iv); };
});

await sleep(WARM_MS);
const s0 = await stats();
measuring = true; t0 = performance.now();
await sleep(SECS * 1000);
const t1 = performance.now();
measuring = false;
timers.forEach(stop => stop());
await sleep(800);
const s1 = await stats();
const d = k => s1[k] - s0[k];
const droppedNow = Object.fromEntries(Object.entries(s1.dropped).map(([k, v]) => [k, v - (s0.dropped[k] || 0)]).filter(([, v]) => v > 0));

let received = players.reduce((a, c) => a + c.recv, 0), bad = players.reduce((a, c) => a + c.bad, 0);
const maxSet = Math.max(...players.map(c => c.maxSet)), setSizes = players.map(c => c.set.size);
console.log(`\nrelay counters over the window: framesIn ${d('framesIn')}, forwarded ${d('framesForwarded')}, thinned ${d('framesThinned')}, dropped ${JSON.stringify(droppedNow)}`);
console.log(`clients: sent ${players.reduce((a, c) => a + c.sends.length, 0)} states, received ${received}`);
const lost = d('framesForwarded') - received;
console.log(`relay to socket delivery: ${received} of ${d('framesForwarded')} forwarded frames (${(100 * received / d('framesForwarded')).toFixed(2)} %), difference ${lost}`);
console.log(`rule check: states from a sender not in the receiver's set: ${bad}; largest set ${maxSet} (K = ${K}); set sizes at the end ${Math.min(...setSizes)} to ${Math.max(...setSizes)}`);

// For each (receiver, sender) pair held for the whole window: what the thinning rule gives for the sender's send times.
let pairs = 0, inRange = 0, gotSum = 0, expSum = 0;
const perBand = {};
for (const r of players) for (const h of r.set) {
  const s = byHandle.get(h);
  if (!s || r.leftDuring.has(h)) continue;
  const arr = (r.arrivals.get(h) || []).filter(t => t >= t0 && t <= t1 + 500);
  const dist = Math.hypot(r.x - s.x, r.z - s.z), b = band(dist);
  const sim = iv => { let last = -1e9, n = 0; for (const t of s.sends) if (t - last >= iv) { n++; last = t; } return n; };
  const exp = sim(b), lo = Math.min(sim(b + 4), exp), hi = Math.max(sim(Math.max(0, b - 4)), exp);
  pairs++; gotSum += arr.length; expSum += exp;
  const ok = arr.length >= lo - 1 && arr.length <= hi + 1; // one either way for where the window starts and ends
  if (ok) inRange++;
  const k = b === 0 ? '< 150 m' : b === 200 ? '150-350 m' : b === 1000 ? '350-1200 m' : 'over 1200 m';
  (perBand[k] ||= { pairs: 0, got: 0, exp: 0 }); perBand[k].pairs++; perBand[k].got += arr.length; perBand[k].exp += exp;
}
console.log(`\nagainst the rules: ${pairs} steady (receiver, sender) pairs, ${inRange} within the expected count (+-1 and a 4 ms timing margin), ${gotSum} received vs ${expSum} expected (${(100 * gotSum / expSum).toFixed(2)} %)`);
for (const [k, v] of Object.entries(perBand)) console.log(`   ${k.padEnd(12)} ${String(v.pairs).padStart(4)} pairs: ${v.got} received, ${v.exp} expected (${(100 * v.got / v.exp).toFixed(1)} %)`);

const delays = players.flatMap(c => c.delays).sort((a, b) => a - b);
const pct = p => delays[Math.min(delays.length - 1, Math.floor(delays.length * p))];
console.log(`\ndelay from send to receipt over ${delays.length} states (one clock, all clients in this process; includes this process's event loop):`);
console.log(`   p50 ${pct(0.5)} ms   p90 ${pct(0.9)} ms   p99 ${pct(0.99)} ms   max ${delays[delays.length - 1]} ms`);

players.forEach(c => c.close());
const ok = lost === 0 && bad === 0 && maxSet <= K && Object.keys(droppedNow).length === 0 && inRange / pairs > 0.99;
console.log(ok ? '\nPASS load check' : '\nFAIL load check');
process.exit(ok ? 0 : 1);
