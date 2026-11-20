// End to end test of the relay against `wrangler dev` (default http://127.0.0.1:8799, or RELAY=http://host:port).
// Plain Node 22, no dependencies. Prints PASS or FAIL per case and exits non-zero if any failed.
//   npx wrangler dev --port 8799 --ip 127.0.0.1     (one terminal)
//   node test/e2e.mjs                               (another)
import { BASE, ORIGIN, sleep, Client, freshIp, stats, rawUpgrade, stateFrame, stateBody, infoFrame, sayFrame, toFrame, helloFrame, T } from './lib.mjs';

const clients = [];
async function player(name, x, z, { send = true, vehicle, livery } = {}) {
  const c = await Client.open();
  clients.push(c);
  await c.join(name, vehicle, livery);
  if (send) c.send(stateFrame(x, z));
  return c;
}
const isEnter = h => f => f.t === 'ENTER' && f.handle === h;
const isLeave = h => f => f.t === 'LEAVE' && f.handle === h;
const isState = h => f => f.t === 'STATE' && f.handle === h;
const typeIs = t => f => f.t === t;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); }
const delta = (after, before, k) => (after.dropped[k] || 0) - (before.dropped[k] || 0);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('HELLO answers WELCOME with version, a handle and the online count', async () => {
  const a = await player('Ciccio', 0, 0, { send: false });
  assert(a.handle >= 1 && a.handle <= 65535, 'handle range');
  assert(a.online >= 1, 'online counts the new player');
  const b = await player('Turi', 0, 0, { send: false });
  assert(b.handle !== a.handle, 'handles are unique');
  assert(b.online >= a.online + 1, 'online grew');
  const raw = await Client.open(); clients.push(raw);
  raw.send(helloFrame('Zu'));
  eq((await raw.next(typeIs('WELCOME'))).ver, 2, 'WELCOME version byte');
});

test('ENTER (with info) always comes before the first STATE, and a state is not echoed to its sender', async () => {
  const a = await player('Alice', 0, 0, { vehicle: 3, livery: 5 });
  const b = await player('Bob', 50, 0);
  await sleep(300);
  const got = b.drain();
  const ei = got.findIndex(isEnter(a.handle)), si = got.findIndex(isState(a.handle));
  assert(ei >= 0 && si > ei, `ENTER then STATE for Alice (ENTER at ${ei}, STATE at ${si})`);
  const e = got[ei];
  eq([e.vehicle, e.livery, e.name], [3, 5, 'Alice'], 'ENTER carries the info');
  assert(!a.drain().some(f => f.t === 'ENTER'), 'Alice has not been told about Bob yet: her set is recomputed lazily');
  await sleep(1000); // her next state, at least 1 s on, picks Bob up
  a.send(stateFrame(1, 0));
  const eb = await a.next(isEnter(b.handle));
  eq(eb.name, 'Bob', 'ENTER for Bob');
  assert(a.inbox.every(m => m.f.t !== 'STATE' || m.f.handle !== a.handle), 'nothing echoed');
  b.send(stateFrame(52, 0, { tag: 777 }));
  const st = await a.next(f => f.t === 'STATE' && f.handle === b.handle && f.tag === 777);
  eq([st.tag, Math.round(st.pos[0])], [777, 52], 'STATE body arrives intact with its position');
});

test('a state with a height (20 bytes) is accepted and forwarded whole', async () => {
  const a = await player('H1', 0, 0), b = await player('H2', 20, 0);
  await sleep(1100); a.send(stateFrame(0, 0)); await a.next(isEnter(b.handle));
  b.send(stateFrame(20, 0, { tag: 5, height: 321 }));
  const st = await a.next(f => f.t === 'STATE' && f.handle === b.handle && f.body.length === 20);
  eq(st.body[18] | (st.body[19] << 8), 321, 'height bytes');
});

test('INFO change reaches players who hold you as a repeated ENTER, at most one per 2 s', async () => {
  const a = await player('A', 0, 0), b = await player('B', 30, 0);
  await sleep(1100); a.send(stateFrame(0, 0)); await a.next(isEnter(b.handle));
  b.send(infoFrame('Bobby', 2, 1));
  const e = await a.next(isEnter(b.handle));
  eq([e.name, e.vehicle, e.livery], ['Bobby', 2, 1], 'new info');
  b.send(infoFrame('Bob2'));
  assert(!(await a.maybe(isEnter(b.handle), 500)), 'a second INFO inside 2 s is dropped');
  await sleep(1700);
  b.send(infoFrame('Bob3'));
  eq((await a.next(isEnter(b.handle))).name, 'Bob3', 'allowed again after 2 s');
});

test('LEAVE when a player in your set disconnects', async () => {
  const a = await player('A', 0, 0), b = await player('B', 30, 0);
  await sleep(1100); a.send(stateFrame(0, 0)); await a.next(isEnter(b.handle));
  b.close();
  await a.next(isLeave(b.handle));
});

test('the set is capped at K = 8 nearest; LEAVE on a disconnect, a nearer arrival (30 m rule) and distance', async () => {
  let step = 0;
  try {
  const p = [];
  for (let i = 1; i <= 10; i++) p.push(await player('p' + i, 100 * i, 0));
  p.push(await player('p11', 3000, 0));
  const me = await player('me', 0, 0);
  await sleep(300);
  let got = me.drain();
  const entered = got.filter(f => f.t === 'ENTER').map(f => f.handle).sort((a, b) => a - b);
  eq(entered, p.slice(0, 8).map(c => c.handle).sort((a, b) => a - b), 'exactly the 8 nearest are entered');
  assert(!got.some(f => f.t === 'STATE' && [p[8], p[9], p[10]].some(c => c.handle === f.handle)), 'nothing from outside the set');

  // 1. one of the eight disconnects: LEAVE at once, and the ninth nearest fills the slot
  step = 1;
  p[0].close();
  await me.next(isLeave(p[0].handle));
  await me.next(isEnter(p[8].handle));

  step = 2;
  // 2. an outsider 40 m nearer than the farthest member (p9 at 900) replaces it, on the next recompute
  await sleep(1100);
  p[9].send(stateFrame(860, 0));
  await sleep(100); me.send(stateFrame(0, 0));
  await me.next(isLeave(p[8].handle));
  await me.next(isEnter(p[9].handle));

  step = 3;
  // 3. a member goes far away: the nearest outsider (p9, back out at 900 m) takes over
  await sleep(1100);
  p[7].send(stateFrame(6000, 0));
  await sleep(100); me.send(stateFrame(0, 0));
  await me.next(isLeave(p[7].handle));
  await me.next(isEnter(p[8].handle));

  step = 4;
  // 4. an outsider only 20 m nearer than the farthest member (p9 at 900) is not swapped in: no flapping
  await sleep(1100);
  p[10].send(stateFrame(880, 0));
  await sleep(100); me.send(stateFrame(0, 0));
  assert(!(await me.maybe(f => f.t === 'LEAVE' || f.t === 'ENTER', 600)), 'no swap for a 20 m difference');
  } catch (e) { e.message += ` (step ${step})`; throw e; }
});

test('thinning by distance: all under 150 m, 200 ms to 350 m, 1 s to 1200 m, 2.5 s beyond', async () => {
  const near = await player('near', 100, 0), mid = await player('mid', 300, 0), far = await player('far', 800, 0), afar = await player('afar', 5000, 0);
  const r = await player('rx', 0, 0);
  await sleep(200);
  r.drain();
  const t0 = performance.now(), N = 40; // 100 ms apart, as the game sends close by: 4 s
  for (let i = 0; i < N; i++) {
    for (const [c, x] of [[near, 100], [mid, 300], [far, 800], [afar, 5000]]) c.send(stateFrame(x, 0, { tag: i }));
    await sleep(100);
  }
  await sleep(300);
  const secs = (performance.now() - t0) / 1000;
  const cnt = {}; for (const f of r.drain()) if (f.t === 'STATE') cnt[f.handle] = (cnt[f.handle] || 0) + 1;
  const c = h => cnt[h.handle] || 0;
  console.log(`      sent ${N} each in ${secs.toFixed(1)} s; received near ${c(near)}, mid ${c(mid)}, far ${c(far)}, afar ${c(afar)}`);
  assert(c(near) === N, `near gets every state (${c(near)} of ${N})`);
  // sends are 100 ms apart with timer jitter, so a pair that falls just short of the gap waits for the next one: allow some slack below
  assert(c(mid) >= Math.floor(secs / 0.3) && c(mid) <= Math.ceil(secs / 0.2) + 1, `mid about one in two (${c(mid)})`);
  assert(c(far) >= Math.floor(secs / 1.15) && c(far) <= Math.ceil(secs) + 1, `far about one a second (${c(far)})`);
  assert(c(afar) >= 1 && c(afar) <= 2, `afar about one per 2.5 s (${c(afar)})`);
});

test('SAY reaches players who hold the sender and are within 400 m, nobody else; limited to 3 burst then 1 a second', async () => {
  const w = await player('W', 100, 0); // sent its state before S existed: does not hold S
  const s = await player('S', 0, 0), n = await player('N', 300, 0), f = await player('F', 500, 0);
  await sleep(200);
  [w, s, n, f].forEach(c => c.drain());
  for (let i = 0; i < 5; i++) s.send(sayFrame(9));
  await sleep(500);
  eq(n.drain().filter(typeIs('SAY')).map(x => [x.handle, x.phrase]), Array(3).fill([s.handle, 9]), 'N (300 m) gets the 3 of the burst');
  assert(!f.drain().some(typeIs('SAY')), 'F (500 m) is out of range');
  assert(!w.drain().some(typeIs('SAY')), 'W does not hold S');
  await sleep(1100);
  s.send(sayFrame(4));
  eq((await n.next(typeIs('SAY'))).phrase, 4, 'one more after a second');
});

test('TO is forwarded only when the target holds the sender', async () => {
  const a = await player('A', 0, 0), b = await player('B', 50, 0); // b holds a; a does not hold b yet
  await sleep(200); a.drain(); b.drain();
  a.send(toFrame(b.handle, [1, 2, 3]));
  const t = await b.next(typeIs('TO'));
  eq([t.from, [...t.data]], [a.handle, [1, 2, 3]], 'A to B');
  b.send(toFrame(a.handle, [9]));
  assert(!(await a.maybe(typeIs('TO'), 500)), 'B to A is dropped: A does not hold B');
  await sleep(700); a.send(stateFrame(0, 0)); await a.next(isEnter(b.handle));
  b.send(toFrame(a.handle, [9]));
  eq([...(await a.next(typeIs('TO'))).data], [9], 'B to A after A picked B up');
  const before = await stats();
  a.send(toFrame(b.handle, [1, 2, 3, 4, 5, 6, 7, 8, 9])); // 9 bytes: too long
  a.send(toFrame(b.handle, []));                              // none: too short
  a.send(toFrame(4000, [1]));                                 // nobody holds it
  assert(!(await b.maybe(typeIs('TO'), 500)), 'nothing arrives for the three bad ones');
  const after = await stats();
  eq([delta(after, before, 'malformed'), delta(after, before, 'to not allowed')], [2, 1], 'counted as malformed twice and not allowed once');
});

test('frame over 96 bytes closes 1009', async () => {
  const a = await player('A', 0, 0, { send: false });
  a.send(new Uint8Array(97).fill(3));
  eq(await a.closed(), 1009, 'close code');
});

test('bad HELLO, a second HELLO, and any other first frame close 1008', async () => {
  const bad = await Client.open(); clients.push(bad);
  bad.send(Uint8Array.from([1, 1, 1, 0, 0])); // version 1
  eq(await bad.closed(), 1008, 'wrong version');
  const longName = await Client.open(); clients.push(longName);
  longName.send(helloFrame('x'.repeat(17)));
  eq(await longName.closed(), 1008, '17 runes');
  const twice = await player('T', 0, 0, { send: false });
  twice.send(helloFrame('T'));
  eq(await twice.closed(), 1008, 'second HELLO');
  const first = await Client.open(); clients.push(first);
  first.send(stateFrame(0, 0));
  eq(await first.closed(), 1008, 'STATE before HELLO');
});

test('a text frame closes 1003', async () => {
  const t = await player('Txt', 0, 0);
  const before = await stats();
  t.ws.send('hello?');
  eq(await t.closed(), 1003, 'text frame');
  assert(delta(await stats(), before, 'text') === 1, 'counted');
});

test('20 malformed frames close 1008; an off-map position is malformed', async () => {
  const a = await player('A', 0, 0, { send: false });
  const before = await stats();
  a.send(stateFrame(21000, 0)); // outside the world
  a.send(Uint8Array.from([3, 1, 2])); // short state
  await sleep(300);
  const mid = await stats();
  eq(delta(mid, before, 'malformed'), 2, 'two malformed');
  assert(a.closeCode === null, 'still open');
  for (let i = 0; i < 17; i++) a.send(Uint8Array.from([99, i]));
  await sleep(300);
  assert(a.closeCode === null, 'still open at 19 malformed');
  a.send(Uint8Array.from([99, 99]));
  eq(await a.closed(), 1008, 'the 20th closes the socket');
});

test('rate limit: burst 30 then 12 a second; the excess is dropped and counted', async () => {
  const s = await player('S', 0, 0), r = await player('R', 40, 0);
  await sleep(200); r.drain();
  const before = await stats();
  for (let i = 0; i < 80; i++) s.send(stateFrame(1, 0, { tag: i }));
  await sleep(600);
  const got = r.drain().filter(typeIs('STATE')).length, after = await stats();
  console.log(`      80 states in a burst: ${got} delivered, ${delta(after, before, 'rate')} dropped as over rate`);
  assert(got >= 25 && got <= 34, `about the burst of 30 arrives (${got})`);
  assert(delta(after, before, 'rate') >= 45, 'the rest is counted');
});

test('a socket that keeps flooding past the rate is closed 1008 (a dropped frame is still billed)', async () => {
  const f = await player('Flood', 0, 0);
  for (let i = 0; i < 300; i++) f.send(stateFrame(1, 0, { tag: i }));
  eq(await f.closed(2000), 1008, 'closed after 100 refused frames');
});

test('/stats is JSON counters only', async () => {
  const r = await fetch(BASE + '/stats');
  eq(r.headers.get('content-type'), 'application/json', 'content type');
  const s = await r.json();
  eq(Object.keys(s).sort(), ['bytesIn', 'connections', 'dropped', 'framesForwarded', 'framesIn', 'framesThinned', 'online'], 'keys');
});

test('Origin check and endpoints (raw HTTP, since Node WebSocket cannot omit Origin)', async () => {
  const ok = async (origin, want, label) => {
    const r = await rawUpgrade({ origin, ip: freshIp() });
    r.socket?.destroy();
    eq(r.status, want, label);
  };
  await ok(undefined, 403, 'no Origin');
  await ok('https://evil.example', 403, 'foreign origin');
  await ok('https://palermo-drive.it.evil.example', 403, 'look-alike origin');
  await ok('http://palermo-drive.it', 403, 'wrong scheme');
  await ok('http://localhost', 403, 'localhost without a port');
  await ok('https://palermo-drive.it', 101, 'the production origin');
  await ok('http://localhost:5173', 101, 'localhost with a port');
  await ok('http://127.0.0.1:8080', 101, '127.0.0.1 with a port');
  eq((await rawUpgrade({ origin: ORIGIN, upgrade: false })).status, 426, 'no Upgrade header');
  eq((await rawUpgrade({ origin: ORIGIN, path: '/nope' })).status, 404, 'unknown path');
  eq((await rawUpgrade({ origin: ORIGIN, path: '/', upgrade: false })).status, 404, '/');
});

test('no HELLO within 10 s closes the socket (on the next event); ONLINE rides on a later frame, not before 10 s', async () => {
  // never says HELLO. A raw socket that only sends a WebSocket ping (the runtime answers it without telling the relay), so that the
  // close frame the relay sends later is delivered: the local runtime leaves a socket that never sent anything half closed.
  const silentUp = await rawUpgrade({ origin: ORIGIN, ip: freshIp() });
  eq(silentUp.status, 101, 'silent socket accepted');
  let silentGot = Buffer.alloc(0);
  silentUp.socket.on('data', d => { silentGot = Buffer.concat([silentGot, d]); });
  silentUp.socket.write(Buffer.from([0x89, 0x80, 1, 2, 3, 4]));
  const a = await player('A', 0, 0);
  const base = a.online;
  await sleep(2000);
  a.send(stateFrame(0, 0));
  assert(!(await a.maybe(typeIs('ONLINE'), 300)), 'no ONLINE before 10 s');
  const b = await player('B', 5000, 0); // changes the count
  await sleep(8200);
  a.send(stateFrame(0, 0)); // a frame from a, after more than 10 s since its WELCOME
  const on = await a.next(typeIs('ONLINE'), 1000);
  const s = await stats();
  eq(on.online, s.online, 'ONLINE equals the real count');
  assert(on.online >= base + 1, `count grew (${base} then ${on.online})`);
  // the silent socket is closed lazily: any event after its 10 s does it, and a's frame was one
  await sleep(500);
  const closeAt = silentGot.indexOf(0x88);
  assert(closeAt >= 0, 'a close frame arrived for the silent socket');
  eq(silentGot.readUInt16BE(closeAt + 2), 1008, 'silent socket closed with 1008');
  silentUp.socket.destroy();
  void b;
});

test('/status: JSON, readable from the game\'s origins only, cached a few seconds', async () => {
  const r = await fetch(BASE + '/status', { headers: { Origin: ORIGIN } });
  eq(r.status, 200, 'status code');
  eq(r.headers.get('access-control-allow-origin'), ORIGIN, 'CORS for a local page');
  assert(/max-age=\d/.test(r.headers.get('cache-control') || ''), 'a short Cache-Control');
  assert((r.headers.get('content-type') || '').includes('application/json'), 'JSON');
  const j = await r.json();
  eq([j.ok, typeof j.online, j.max], [true, 'number', 300], 'the shape when there is room');
  const evil = await fetch(BASE + '/status', { headers: { Origin: 'https://evil.example' } });
  eq(evil.headers.get('access-control-allow-origin'), null, 'no CORS for another origin');
  const none = await fetch(BASE + '/status');
  eq(none.status, 200, 'no Origin header is still answered'); eq(none.headers.get('access-control-allow-origin'), null, 'and gets no CORS');
});

test('connection caps: 24 per address (429), an IPv6 /64 counts as one address, 300 in all (503)', async () => {
  await sleep(500);
  const held = [];
  const ip = freshIp();
  for (let i = 0; i < 24; i++) { const r = await rawUpgrade({ origin: ORIGIN, ip }); eq(r.status, 101, `connection ${i + 1} from one address`); held.push(r.socket); }
  eq((await rawUpgrade({ origin: ORIGIN, ip })).status, 429, '25th from the same address');
  // one device owns its whole /64: addresses inside it share the allowance, the next /64 is another client
  const v6 = n => `2001:db8:${(Math.random() * 65535 | 0).toString(16)}:${n}`;
  const block = v6('77');
  for (let i = 0; i < 24; i++) { const r = await rawUpgrade({ origin: ORIGIN, ip: `${block}:${i + 1}::${i + 9}` }); eq(r.status, 101, `v6 connection ${i + 1} in one /64`); held.push(r.socket); }
  eq((await rawUpgrade({ origin: ORIGIN, ip: `${block}:ffff:ffff:ffff:ffff` })).status, 429, 'another address in the same /64');
  const other = await rawUpgrade({ origin: ORIGIN, ip: `${block.slice(0, -2)}78:1::1` }); eq(other.status, 101, 'the next /64'); held.push(other.socket);
  held.forEach(s => s.destroy());
  await sleep(1000);
  // fill to 300 with one place per address: the 301st has nothing to take from anybody
  const singles = [];
  let n = (await stats()).connections;
  while (n < 300) { const r = await rawUpgrade({ origin: ORIGIN, ip: freshIp() }); eq(r.status, 101, `connection ${n + 1}`); singles.push(r.socket); n++; }
  eq((await rawUpgrade({ origin: ORIGIN, ip: freshIp() })).status, 503, 'the 301st');
  const full = await (await fetch(BASE + '/status', { headers: { Origin: ORIGIN } })).json();
  eq([full.ok, full.why, full.max], [false, 'full', 300], '/status says the relay is full (these sockets never said HELLO, so online counts none of them)');
  singles.forEach(s => s.destroy());
  await sleep(1000);
  // 24 places held by one address and the rest by singles: a newcomer gets in and the big holder gives one up
  const big = freshIp(), mine = [];
  for (let i = 0; i < 24; i++) mine.push((await rawUpgrade({ origin: ORIGIN, ip: big })).socket);
  const rest = [];
  n = (await stats()).connections;
  while (n < 300) { const r = await rawUpgrade({ origin: ORIGIN, ip: freshIp() }); eq(r.status, 101, `single ${n + 1}`); rest.push(r.socket); n++; }
  const late = await rawUpgrade({ origin: ORIGIN, ip: freshIp() });
  eq(late.status, 101, 'a newcomer is let in by making room'); rest.push(late.socket);
  await sleep(500);
  eq((await stats()).connections, 300, 'still 300: one of the big holder went');
  [...mine, ...rest].forEach(s => s.destroy());
  await sleep(500);
});

let failed = 0;
console.log(`relay e2e against ${BASE}`);
for (const t of tests) {
  const t0 = performance.now();
  try {
    await t.fn();
    console.log(`PASS  ${t.name}  (${Math.round(performance.now() - t0)} ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${t.name}\n      ${e.message}`);
  }
  clients.splice(0).forEach(c => c.close());
  await sleep(250);
}
console.log(failed ? `\n${failed} of ${tests.length} FAILED` : `\nall ${tests.length} passed`);
process.exit(failed ? 1 : 0);
