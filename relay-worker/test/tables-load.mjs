// Load check for tables against `wrangler dev`: 20 tables of 6 sockets (one address per table, as a household would),
// each socket beating every 15 s, a move every 10 to 48 s per table (an act from one member, the host's patch a moment
// later), and joins and leaves (a member's socket drops and the same player comes back, every member then sends the
// newcomer a hello and its whole state with TO, as BLATERO does).
//   node test/tables-load.mjs [--tables 20] [--size 6] [--secs 120]
// It reports delivery (every frame that should reach a member did), order (every pair of members of a table saw the
// frames they both received in the same order), the rules the relay promises (a JOIN before a member's first frame,
// the sender slot on each frame), unexpected closes, and the delay from send to receipt.
import { sleep, TClient, freshIp, freshCode, freshPid, pidHex, bcastFrame, toFrame, beatFrame, KIND, roomState, patchMsg, helloMsg } from './tlib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const NT = arg('tables', 20), SIZE = arg('size', 6), SECS = arg('secs', 120);
const rnd = (a, b) => a + Math.random() * (b - a);
const T0 = performance.now();
const now = () => performance.now();
const json = JSON.stringify;

/** Every frame the test sends: who should get it, when it went. */
const sent = [];
const tables = [];
let unexpectedCloses = 0, upgradeFailures = 0, wrongSender = 0, joinOrder = 0;
let stopping = false;

class Mem {
  constructor(table, pid) { this.table = table; this.pid = pid; this.c = null; this.up = false; this.log = []; this.known = new Set(); this.beatTimer = null; this.slot = -1; this.gen = 0; }
  async connect() {
    for (let tries = 0; tries < 5; tries++) {
      try { this.c = await TClient.open({ ip: this.table.ip }); break; } catch { upgradeFailures++; await sleep(300); }
    }
    if (!this.c) throw new Error('could not connect');
    const c = this.c, gen = ++this.gen;
    c.ws.onmessage = e => this.onFrame(new Uint8Array(e.data), gen);
    c.ws.onclose = ev => { if (gen === this.gen && this.up && !stopping) { unexpectedCloses++; console.log(`unexpected close ${ev.code} on table ${this.table.n}`); } this.up = false; };
    const w = new Promise(res => { this.onWelcome = res; });
    c.send(Uint8Array.from([1, 1, 0, ...this.pid, ...new TextEncoder().encode(this.table.code)]));
    await Promise.race([w, sleep(3000).then(() => { throw new Error('no WELCOME'); })]);
  }
  onFrame(f, gen) {
    if (gen !== this.gen) return;
    const at = now();
    switch (f[0]) {
      case 1: {
        this.slot = f[2]; this.up = true; this.known = new Set(); const n = f[3];
        for (let i = 0; i < n; i++) this.known.add(f[4 + i * 17]);
        this.log.push({ k: 'W', at }); this.table.live.add(this);
        this.table.events.push({ at, k: 'join', m: this });
        this.onWelcome?.();
        break;
      }
      case 2: {
        this.known.add(f[1]); this.log.push({ k: 'J', slot: f[1], at });
        this.table.events.push({ at, k: 'join', m: this });
        // BLATERO: every member sends the newcomer a hello and its confirmed state
        if (this.up) {
          this.c.send(toFrame(f[1], KIND.hello, json(helloMsg(7))));
          this.c.send(toFrame(f[1], KIND.state, this.table.state));
          for (const x of [1, 2]) sent.push({ id: `to${this.table.n}-${this.slot}-${at}-${x}`, from: this, at, kind: 'to', to: f[1], table: this.table, bytes: x === 1 ? 16 : this.table.state.length });
        }
        break;
      }
      case 3: this.known.delete(f[1]); this.log.push({ k: 'L', slot: f[1], at }); this.table.events.push({ at, k: 'leave', m: this }); break;
      case 4: case 5: {
        if (f[2] === KIND.state || f[2] === KIND.hello) { // direct frames from the join dance: only count the order of the others
          if (!this.known.has(f[1])) joinOrder++;
          this.log.push({ k: 'T', from: f[1], at });
          break;
        }
        if (!this.known.has(f[1])) joinOrder++;
        const text = new TextDecoder().decode(f.slice(3));
        let id = null;
        try { const o = JSON.parse(text); id = o.nonce ?? o.f; } catch { /* ignore */ }
        const m = /^t(\d+)s(\d+)-/.exec(id || '');
        if (m && +m[2] !== f[1]) wrongSender++;
        this.log.push({ k: 'B', id, at, from: f[1] });
        break;
      }
      case 6: break;
    }
  }
  startBeats() { this.beatTimer = setTimeout(function beat(m) { if (stopping) return; if (m.up) m.c.send(beatFrame()); m.beatTimer = setTimeout(() => beat(m), 15_000); }, rnd(0, 15_000), this); }
  stop() { clearTimeout(this.beatTimer); this.up = false; this.c?.close(); }
}

let seq = 0;
async function runTable(n) {
  const t = { n, code: freshCode(), ip: freshIp(), mems: [], live: new Set(), events: [], state: json(roomState('K7Q2M', SIZE, 24)), moves: 0, churns: 0 };
  tables.push(t);
  for (let i = 0; i < SIZE; i++) { const m = new Mem(t, freshPid()); t.mems.push(m); await m.connect(); m.startBeats(); await sleep(60); }
  const hostOf = () => t.mems.filter(m => m.up).sort((a, b) => a.slot - b.slot)[0];
  const send = (m, kind, body, id) => {
    const recipients = t.mems.filter(x => x !== m && x.up);
    sent.push({ id, from: m, at: now(), kind: 'b', recipients, table: t, bytes: body.length });
    m.c.send(bcastFrame(kind, body));
  };
  // moves
  (async () => {
    while (!stopping) {
      await sleep(rnd(10_000, 48_000)); if (stopping) break;
      const live = t.mems.filter(m => m.up); if (live.length < 2) continue;
      const m = live[(Math.random() * live.length) | 0], k = ++seq;
      const act = { nonce: `t${n}s${m.slot}-${k}`, action: { type: 'move', id: pidHex(m.pid), move: { type: 'play', card: 'gd-ritmo#1', stat: 'gd', value: 2 }, at: 12 } };
      send(m, KIND.act, json(act), act.nonce);
      t.moves++;
      await sleep(rnd(30, 80));
      const h = hostOf(); if (!h) continue;
      const p = patchMsg(12); p.f = `t${n}s${h.slot}-p${k}`; // the fingerprint field carries the id, a free string
      // the nonce check does not apply to patches; the id is read from `f` below
      send(h, KIND.patch, json(p), p.f);
    }
  })();
  // churn: a socket drops, the same player comes back
  (async () => {
    while (!stopping) {
      await sleep(rnd(20_000, 60_000)); if (stopping) break;
      const live = t.mems.filter(m => m.up && m.slot !== hostOf()?.slot); if (!live.length) continue;
      const m = live[(Math.random() * live.length) | 0];
      m.up = false; m.table.live.delete(m); m.gen++; m.c.close();
      t.events.push({ at: now(), k: 'leave', m });
      await sleep(rnd(300, 1000));
      await m.connect().catch(() => {});
      t.churns++;
    }
  })();
}

console.log(`${NT} tables of ${SIZE} sockets, ${SECS} s of traffic (beat 15 s, a move every 10 to 48 s per table, joins and leaves)`);
for (let i = 0; i < NT; i++) await runTable(i);
console.log(`all ${NT * SIZE} sockets up after ${Math.round(now() - T0)} ms`);
await sleep(SECS * 1000);
stopping = true;
await sleep(1500);

// Which frames to judge: a frame whose table had no join or leave within 1.5 s either side, so that who should have
// received it is not in doubt.
let expected = 0, delivered = 0, framesJudged = 0, skipped = 0;
const delays = [];
const byMem = new Map();
for (const t of tables) for (const m of t.mems) byMem.set(m, new Map(m.log.filter(e => e.k === 'B' && e.id).map(e => [e.id, e.at])));
for (const s of sent.filter(s => s.kind === 'b')) {
  const unstable = s.table.events.some(e => Math.abs(e.at - s.at) < 1500);
  if (unstable) { skipped++; continue; }
  framesJudged++;
  for (const r of s.recipients) {
    expected++;
    const at = byMem.get(r)?.get(s.id);
    if (at !== undefined) { delivered++; delays.push(at - s.at); }
  }
}
// order: for every pair of members of a table, the frames both received are in the same order
let pairs = 0, disagreements = 0;
for (const t of tables) {
  const logs = t.mems.map(m => m.log.filter(e => e.k === 'B' && e.id).map(e => e.id));
  for (let i = 0; i < logs.length; i++) for (let j = i + 1; j < logs.length; j++) {
    pairs++;
    const common = new Set(logs[i].filter(x => logs[j].includes(x)));
    const a = logs[i].filter(x => common.has(x)), b = logs[j].filter(x => common.has(x));
    if (a.join() !== b.join()) disagreements++;
  }
}
const echoes = tables.reduce((n, t) => n + t.mems.reduce((k, m) => k + m.log.filter(e => e.k === 'B' && e.id?.startsWith(`t${t.n}s${m.slot}-`)).length, 0), 0);
delays.sort((a, b) => a - b);
const pct = p => delays[Math.min(delays.length - 1, Math.floor(delays.length * p))];
const total = sent.length;
const moves = tables.reduce((n, t) => n + t.moves, 0), churns = tables.reduce((n, t) => n + t.churns, 0);
console.log(`\ntraffic: ${moves} moves (act + patch), ${churns} leave and rejoin cycles, ${total} frames recorded (broadcasts and direct state transfers), ${upgradeFailures} upgrade retries`);
console.log(`delivery: ${delivered} of ${expected} expected deliveries (${(100 * delivered / expected).toFixed(3)} %) over ${framesJudged} broadcasts away from joins and leaves (${skipped} near a join or leave not judged)`);
console.log(`order: ${pairs} member pairs compared, ${disagreements} disagreed on the order of the frames both received`);
console.log(`rules: ${joinOrder} frames from a slot the receiver had not been told about (JOIN before the first frame), ${wrongSender} frames with the wrong sender slot, ${echoes} echoes to the sender, ${unexpectedCloses} unexpected closes`);
console.log(`delay from send to receipt over ${delays.length} deliveries (one clock, all clients in this process, so it includes this process's own event loop):`);
console.log(`   p50 ${pct(0.5).toFixed(1)} ms   p90 ${pct(0.9).toFixed(1)} ms   p99 ${pct(0.99).toFixed(1)} ms   max ${delays[delays.length - 1].toFixed(1)} ms`);
for (const t of tables) for (const m of t.mems) m.stop();
const ok = delivered === expected && disagreements === 0 && joinOrder === 0 && wrongSender === 0 && echoes === 0 && unexpectedCloses === 0;
console.log(ok ? '\nPASS tables load check' : '\nFAIL tables load check');
process.exit(ok ? 0 : 1);
