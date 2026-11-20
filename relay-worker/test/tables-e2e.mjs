// End to end test of the tables relay (/t, for BLATERO) against `wrangler dev` (default http://127.0.0.1:8799, or
// RELAY=http://host:port). Plain Node 22, no dependencies. Prints PASS or FAIL per case, exits non-zero if any failed.
//   npx wrangler dev --port 8799 --ip 127.0.0.1     (one terminal)
//   node test/tables-e2e.mjs                        (another)
// Run it against a fresh `wrangler dev`: it expects to be the only user. It takes about two minutes, most of it
// waiting for the idle rules (40 s) and hibernation (15 s). What it cannot do in real time: a table going idle for 30
// minutes, and a day's frame budget passing midnight; both are covered by the native unit tests.
import { BASE, ORIGIN, PALERMO_ORIGIN, sleep, TClient, rawUpgrade, freshIp, freshCode, freshPid, pidHex, helloFrame, bcastFrame, toFrame, beatFrame, KIND, roomState, votingState, gameState, helloMsg, actMsg, patchMsg, nonce } from './tlib.mjs';

const clients = [];
const raws = [];
async function member(code, opts = {}) {
  const c = await TClient.open({ ip: opts.ip });
  clients.push(c);
  await c.join(code, opts);
  return c;
}
const isJoin = s => f => f.t === 'JOIN' && f.slot === s;
const isLeave = s => f => f.t === 'LEAVE' && f.slot === s;
const isB = f => f.t === 'BCAST';
const typeIs = t => f => f.t === t;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); }
const json = o => JSON.stringify(o);
const bytesOf = s => new TextEncoder().encode(s).length;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/** A state of exactly `n` payload bytes, padded in the optional `recent` list. */
function stateOfSize(code, n) {
  const s = roomState(code, 6, 10);
  s.recent = [''];
  const base = bytesOf(json(s));
  s.recent = ['x'.repeat(n - base)];
  const out = json(s);
  assert(bytesOf(out) === n, 'fixture size');
  return out;
}

test('WELCOME, JOIN and LEAVE: slots, roster, lowest free slot, JOIN before the first frame', async () => {
  const code = freshCode();
  const a = await member(code);
  eq([a.slot, a.welcome.ver, a.welcome.others], [0, 1, []], 'first member');
  const b = await member(code);
  eq([b.slot, b.welcome.others], [1, [{ slot: 0, pid: pidHex(a.pid) }]], 'second member sees the first');
  eq((await a.next(isJoin(1))).pid, pidHex(b.pid), 'the first is told');
  const c = await member(code);
  eq([c.slot, c.welcome.others.map(o => o.slot)], [2, [0, 1]], 'third');
  await a.next(isJoin(2)); await b.next(isJoin(2));
  // JOIN comes before that member's first BCAST, on every receiver
  c.send(bcastFrame(KIND.hello, helloMsg(0, { ask: true })));
  const seq = (await Promise.all([a, b].map(async m => { await sleep(150); return m.drain().map(f => f.t); }))).flat();
  eq(seq, ['BCAST', 'BCAST'], 'the JOIN was already delivered');
  b.close();
  eq((await a.next(typeIs('LEAVE'))).slot, 1, 'LEAVE reaches a');
  await c.next(isLeave(1));
  const d = await member(code);
  eq(d.slot, 1, 'slot 1 is reused');
  eq(d.welcome.others.map(o => o.slot), [0, 2], 'the roster has the two others');
});

test('every kind of payload, with real sized BLATERO messages, arrives intact with sender slot and kind', async () => {
  const code = freshCode();
  const [a, b, c] = [await member(code), await member(code), await member(code)];
  const cases = {
    'hello': [KIND.hello, json(helloMsg(7)), json(helloMsg(7, { ask: true })), json(helloMsg(7, { full: true, ask: false }))],
    'lobby state, 4 players': [KIND.state, json(roomState(code, 4))],
    'voting state with votes, ready and chosen': [KIND.state, json(votingState(code, 6))],
    'game state, 4 players, 24 moves': [KIND.state, json(roomState(code, 4, 24))],
    'game state, 6 players, 48 moves': [KIND.state, json(roomState(code, 6, 48))],
    'patch': [KIND.patch, json(patchMsg()), json({ from: 3, to: 4, f: 'abc', p: null })],
    'act move': [KIND.act, json(actMsg()), json(actMsg(undefined, 'vote')), json(actMsg(undefined, 'ready'))],
  };
  for (const [label, [kind, ...payloads]] of Object.entries(cases)) {
    for (const p of payloads) {
      a.send(bcastFrame(kind, p));
      const got = await b.next(isB, 2000);
      eq([got.from, got.kind, got.text === p], [0, kind, true], `${label}: broadcast to b`);
      eq((await c.next(isB, 2000)).text === p, true, `${label}: broadcast to c`);
      c.send(toFrame(0, kind, p));
      const to = await a.next(typeIs('TO'), 2000);
      eq([to.from, to.kind, to.text === p], [2, kind, true], `${label}: direct to a`);
      await sleep(130); // stay under 8 frames a second
    }
  }
  const sizes = Object.fromEntries(['4 players lobby', '6 players 48 moves'].map((l, i) => [l, bytesOf(json(i ? roomState(code, 6, 48) : roomState(code, 4)))]));
  console.log(`      fixture sizes: ${JSON.stringify(sizes)} bytes`);
  assert(!b.inbox.some(m => m.f.t === 'TO') && !a.inbox.some(m => m.f.t === 'BCAST'), 'no echo and no stray frames');
});

test('order: every member sees the same sequence of everyone else\'s frames, and no echo', async () => {
  const code = freshCode();
  const ms = [];
  for (let i = 0; i < 5; i++) ms.push(await member(code));
  for (const m of ms) m.drain();
  const sent = [];
  for (let k = 0; k < 18; k++) for (let i = 0; i < ms.length; i++) {
    const msg = actMsg(); msg.nonce = `s${i}-${k}`;
    ms[i].send(bcastFrame(KIND.act, json(msg)));
    sent.push(msg.nonce);
  }
  await sleep(1000);
  const logs = ms.map(m => m.drain().filter(isB).map(f => JSON.parse(f.text).nonce));
  logs.forEach((l, i) => {
    eq(l.length, (ms.length - 1) * 18, `member ${i} got everything but its own`);
    assert(!l.some(n => n.startsWith(`s${i}-`)), `member ${i} was echoed`);
    for (let j = 0; j < ms.length; j++) if (j !== i) eq(l.filter(n => n.startsWith(`s${j}-`)), Array.from({ length: 18 }, (_, k) => `s${j}-${k}`), `member ${i} sees sender ${j} in order`);
  });
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const common = new Set(logs[i].filter(n => logs[j].includes(n)));
    eq(logs[i].filter(n => common.has(n)), logs[j].filter(n => common.has(n)), `members ${i} and ${j} agree on the order`);
  }
});

test('TO reaches one live slot; a dead slot, oneself and a bad slot are dropped; BEAT answers', async () => {
  const code = freshCode();
  const [a, b, c] = [await member(code), await member(code), await member(code)];
  a.drain(); b.drain(); c.drain();
  a.send(toFrame(2, KIND.act, json(actMsg())));
  eq((await c.next(typeIs('TO'))).from, 0, 'c gets the direct frame');
  assert(!(await b.maybe(typeIs('TO'), 300)), 'b does not');
  a.send(toFrame(6, KIND.act, json(actMsg()))); // a slot nobody holds: dropped
  a.send(toFrame(0, KIND.act, json(actMsg()))); // oneself
  a.send(toFrame(1, KIND.act, json(actMsg())));
  eq((await b.next(typeIs('TO'))).from, 0, 'a still works after drops');
  assert(!(await a.maybe(typeIs('TO'), 300)), 'nothing came back to a');
  assert(a.closeCode === null, 'dropping a dead slot is not a reason to close');
  a.send(toFrame(8, KIND.act, json(actMsg()))); // out of range: malformed, dropped
  a.send(beatFrame());
  eq((await a.next(typeIs('BEAT'))).len, 1, 'BEAT is answered with a one byte BEAT');
});

test('tables are isolated: no cross table broadcast, no cross table TO, slots are per table', async () => {
  const [c1, c2] = [freshCode(), freshCode()];
  const [a, b] = [await member(c1), await member(c1)];
  const [x, y] = [await member(c2), await member(c2)];
  await sleep(150);
  a.drain(); b.drain(); x.drain(); y.drain();
  a.send(bcastFrame(KIND.act, json(actMsg())));
  await b.next(isB);
  assert(!(await x.maybe(isB, 300)) && !(await y.maybe(isB, 100)), 'nothing crossed');
  x.send(toFrame(1, KIND.act, json(actMsg())));
  assert(!!(await y.next(typeIs('TO'))) && !(await b.maybe(typeIs('TO'), 300)), 'slot 1 of the other table is y, not b');
  const e = await member(c1);
  await a.next(isJoin(2));
  assert(!(await x.maybe(typeIs('JOIN'), 300)), 'a join is not announced to another table');
});

test('create flag: a live table closes the newcomer with 4002; a new or emptied code accepts it', async () => {
  const code = freshCode();
  const a = await member(code);
  const b = await TClient.open(); clients.push(b);
  b.send(helloFrame(freshPid(), code, true));
  eq(await b.closed(), 4002, 'the table exists');
  eq(a.drain().length, 0, 'the table was not disturbed');
  const fresh = await member(freshCode(), { create: true });
  eq(fresh.slot, 0, 'a new code is created');
  a.close();
  await sleep(300);
  const again = await member(code, { create: true });
  eq(again.slot, 0, 'a table dies with its last socket, so the code can be created again');
});

test('the same pid on a new socket replaces the old one: 4001, then LEAVE and JOIN for the others', async () => {
  const code = freshCode();
  const pid = freshPid();
  const a = await member(code, { pid });
  const b = await member(code);
  b.drain();
  const a2 = await member(code, { pid });
  eq(await a.closed(), 4001, 'the older socket is told');
  const seq = [];
  seq.push((await b.next(f => f.t === 'LEAVE' || f.t === 'JOIN')).t, (await b.next(f => f.t === 'LEAVE' || f.t === 'JOIN')).t);
  eq(seq, ['LEAVE', 'JOIN'], 'b sees LEAVE then JOIN');
  eq([a2.slot, a2.welcome.others.map(o => o.slot)], [0, [1]], 'the new socket takes the freed slot');
  a2.send(bcastFrame(KIND.act, json(actMsg())));
  await b.next(isB);
  // the same pid at another table is fine
  const other = await member(freshCode(), { pid });
  assert(other.closeCode === null && a2.closeCode === null, 'two tables, one pid');
});

test('a ninth socket in a table closes 4004; the table is untouched', async () => {
  const code = freshCode();
  const ms = [];
  for (let i = 0; i < 8; i++) ms.push(await member(code));
  eq(ms.map(m => m.slot), [0, 1, 2, 3, 4, 5, 6, 7], 'slots 0 to 7');
  const x = await TClient.open(); clients.push(x);
  x.send(helloFrame(freshPid(), code, false));
  eq(await x.closed(), 4004, 'the ninth');
  ms[7].send(bcastFrame(KIND.act, json(actMsg())));
  await ms[0].next(isB);
  assert(ms.every(m => m.closeCode === null), 'nobody else was closed');
});

test('bad first frames close 1008: bad HELLO fields, another frame type first, a second HELLO', async () => {
  const good = helloFrame(freshPid(), freshCode());
  const mutate = (i, v) => { const f = Uint8Array.from(good); f[i] = v; return f; };
  const badPid = Uint8Array.from(good); badPid[3 + 6] = 0x30;
  const firsts = {
    'version 2': mutate(1, 2), 'reserved flag bit': mutate(2, 2), 'lowercase code': mutate(19, 0x61), 'code with 0': mutate(20, 0x30), 'code with O': mutate(20, 0x4f),
    'short': good.slice(0, 23), 'long': Uint8Array.from([...good, 0]), 'pid not v4': badPid, 'BCAST first': bcastFrame(KIND.act, json(actMsg())), 'TO first': toFrame(0, KIND.act, json(actMsg())),
    'BEAT first': beatFrame(), 'unknown type': Uint8Array.from([9, 9, 9]), 'one byte': Uint8Array.from([1]), 'empty frame': new Uint8Array(0),
  };
  for (const [label, f] of Object.entries(firsts)) {
    const c = await TClient.open(); clients.push(c);
    c.send(f);
    eq(await c.closed(), 1008, label);
  }
  const t = await TClient.open(); clients.push(t);
  t.ws.send('hello'); // a text frame
  eq(await t.closed(), 1003, 'a text frame before HELLO');
  const a = await member(freshCode());
  a.send(helloFrame(freshPid(), freshCode()));
  eq(await a.closed(), 1008, 'a second HELLO');
});

test('after HELLO: a text frame closes 1003; a frame over 16,384 bytes closes 1009', async () => {
  const a = await member(freshCode());
  a.ws.send(JSON.stringify(helloMsg()));
  eq(await a.closed(), 1003, 'text');
  const b = await member(freshCode());
  b.send(new Uint8Array(16_385).fill(2));
  eq(await b.closed(), 1009, 'one byte over');
  const c = await member(freshCode());
  c.send(new Uint8Array(200_000).fill(2));
  eq(await c.closed(), 1009, 'far over');
});

test('the frame cap is the whole frame: a 16,382 byte state in a BCAST passes, one byte more closes 1009', async () => {
  const code = freshCode();
  const [a, b] = [await member(code), await member(code)];
  const s = stateOfSize(code, 16_382);
  a.send(bcastFrame(KIND.state, s));
  const got = await b.next(isB);
  eq([got.raw.length, got.text === s], [16_382, true], 'whole payload arrives');
  const c = await member(code);
  c.send(bcastFrame(KIND.state, stateOfSize(code, 16_383)));
  eq(await c.closed(), 1009, 'one byte over');
  const d = await member(freshCode()), e = await member(d.code);
  d.send(toFrame(1, KIND.state, stateOfSize(d.code, 16_382)));
  eq(await d.closed(), 1009, 'a TO has a longer header, so the same payload is over');
  void e;
});

test('malformed frames are dropped and counted; the 20th closes 1008', async () => {
  const code = freshCode();
  const [a, b] = [await member(code), await member(code)];
  b.drain();
  const bad = [Uint8Array.from([9]), Uint8Array.from([2, 9, 123, 125]), bcastFrame(KIND.act, '[]'), bcastFrame(KIND.act, json(helloMsg())), toFrame(8, KIND.act, json(actMsg())), Uint8Array.from([4, 0])];
  for (let i = 0; i < 19; i++) { a.send(bad[i % 6]); if (i % 4 === 3) await sleep(100); }
  await sleep(200);
  assert(a.closeCode === null, '19 malformed frames are tolerated');
  a.send(bcastFrame(KIND.act, json(actMsg())));
  await b.next(isB);
  assert(a.closeCode === null && !(b.inbox.length), 'only the good frame was forwarded');
  await sleep(300);
  a.send(bad[0]);
  eq(await a.closed(), 1008, 'the 20th');
});

/** Sends each payload in `bad` (as BCAST of `kind`), then a good sentinel: only the sentinel may arrive. */
async function nearMisses(kind, bad, good, label, via = 'BCAST') {
  for (let i = 0; i < bad.length; i += 15) {
    const code = freshCode();
    const [a, b] = [await member(code), await member(code)];
    b.drain();
    const send = (k, p) => a.send(via === 'BCAST' ? bcastFrame(k, p) : toFrame(1, k, p));
    for (const p of bad.slice(i, i + 15)) send(kind, p);
    send(kind, good);
    const first = await b.next(f => f.t === (via === 'BCAST' ? 'BCAST' : 'TO'), 2000);
    assert(first.text === good, `${label}: a near miss got through: ${first.text.slice(0, 120)}`);
    await sleep(150);
    assert(!b.inbox.length && a.closeCode === null, `${label}: nothing else arrived and the sender stays`);
  }
}

test('shape checks: near misses for hello are dropped, the real shapes pass', async () => {
  const ok = json(helloMsg(3, { ask: true }));
  await nearMisses(KIND.hello, [
    '{}', json({ version: '3' }), json({ version: 3, p: 2 }), json({ id: 'x', name: 'y', version: 3 }), json({ version: 3, ask: 1 }), json({ version: 3, full: null }), json({ version: 3, extra: 1 }),
    '[3]', '"x"', '3', 'null', ok + 'x', ' ' + ok, ok + '\n', '{"version":3,"version":4}', '{"vers\\u0069on":3}', "{'version':3}", '{"version":3', '{"version":3,}', '{"version":03}', json(actMsg()), json(roomState('K7Q2M', 4)),
  ], ok, 'hello');
});

test('shape checks: near misses for state are dropped, the real shapes pass', async () => {
  const code = 'K7Q2M';
  const good = json(roomState(code, 4));
  const s = () => roomState(code, 4);
  const without = k => { const o = s(); delete o[k]; return json(o); };
  const set = (k, v) => json({ ...s(), [k]: v });
  await nearMisses(KIND.state, [
    without('code'), without('version'), without('phase'), without('players'), without('game'), set('players', {}), set('players', 'x'), set('game', 1), set('game', []), set('version', '5'), set('code', 5), set('phase', null),
    set('votes', []), set('ready', {}), set('chosen', null), set('recent', 'x'), set('chat', 'hi'), set('Version', 5), json(gameState(s().players, 3)), json(patchMsg()),
  ], good, 'state');
  const o = s(); const bad = Buffer.from(json(o)); bad[bad.indexOf('Turi')] = 0xff; // invalid UTF-8 inside a string
  await nearMisses(KIND.state, [bad, '{"code":"K7Q2M","version":1,"phase":"lobby","players":[' + '['.repeat(40) + ']'.repeat(40) + '],"game":null}', json(roomState(code, 4)).replace('"players"', '\n"players"') + ' '], good, 'state (bytes, depth)');
});

test('shape checks: near misses for patch and act are dropped, the real shapes pass', async () => {
  const p = patchMsg();
  const goodPatch = json(p);
  const drop = k => { const o = patchMsg(); delete o[k]; return json(o); };
  await nearMisses(KIND.patch, [drop('from'), drop('to'), drop('f'), drop('p'), json({ ...p, f: 7 }), json({ ...p, from: '1' }), json({ ...p, to: null }), json({ ...p, p: [] }), json({ ...p, p: 1 }), json({ ...p, x: 1 }), json({ ...p, p: undefined }), json(actMsg()), json(helloMsg())], goodPatch, 'patch');
  const a = actMsg();
  const goodAct = json(a);
  const dropA = k => { const o = actMsg(); delete o[k]; return json(o); };
  await nearMisses(KIND.act, [dropA('nonce'), dropA('action'), json({ ...a, nonce: 5 }), json({ ...a, action: 'move' }), json({ ...a, action: [] }), json({ ...a, action: null }), json({ ...a, extra: 1 }), json({ nonce: 'a', action: { pad: 'x'.repeat(1100) } }), json(patchMsg()), json(helloMsg()), '{"nonce":"a","action":{},"":1}'], goodAct, 'act');
  // the same through TO
  await nearMisses(KIND.act, [dropA('nonce'), json({ ...a, action: 'move' }), json({ ...a, extra: 1 }), json(helloMsg())], goodAct, 'act via TO', 'TO');
  // an unknown kind is dropped too
  const code = freshCode();
  const [x, y] = [await member(code), await member(code)];
  y.drain();
  for (const k of [0, 5, 6, 255]) x.send(bcastFrame(k, goodAct));
  x.send(bcastFrame(KIND.act, goodAct));
  eq((await y.next(isB)).text, goodAct, 'only the real kind arrived');
});

test('rate: burst of 24 then 8 a second; a flood is closed 1008, not just dropped', async () => {
  const code = freshCode();
  const [a, b] = [await member(code), await member(code)];
  b.drain();
  for (let i = 0; i < 40; i++) a.send(bcastFrame(KIND.hello, json(helloMsg(i))));
  await sleep(150);
  const n1 = b.drain().filter(isB).length;
  assert(n1 >= 22 && n1 <= 25, `burst: ${n1} of 40 delivered (wanted about 23)`);
  await sleep(1000);
  for (let i = 0; i < 20; i++) a.send(bcastFrame(KIND.hello, json(helloMsg(i))));
  await sleep(300);
  const n2 = b.drain().filter(isB).length;
  assert(n2 >= 7 && n2 <= 11, `steady: ${n2} of 20 delivered after a second (wanted about 8)`);
  assert(a.closeCode === null, 'a short burst over the rate is dropped, not closed');
  for (let i = 0; i < 300 && a.closeCode === null; i++) { a.send(bcastFrame(KIND.hello, json(helloMsg(i)))); if (i % 50 === 49) await sleep(5); }
  eq(await a.closed(), 1008, 'a flood');
});

test('byte rate: a 64 KB burst holds about five 12 KB states; the table rate drops without closing anybody', async () => {
  const code = freshCode();
  const [a, b] = [await member(code), await member(code)];
  b.drain();
  const s = stateOfSize(code, 12_000);
  for (let i = 0; i < 8; i++) a.send(bcastFrame(KIND.state, s));
  await sleep(1000);
  const n = b.drain().filter(isB).length;
  assert(n >= 5 && n <= 6, `${n} of 8 big states delivered (wanted 5)`);
  assert(a.closeCode === null, 'not closed for it');
  // the table's own limit: 8 members, 20 frames each at once, against a burst of 120
  const t = freshCode();
  const ms = [];
  for (let i = 0; i < 8; i++) ms.push(await member(t));
  ms.forEach(m => m.drain());
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) for (const m of ms) m.send(bcastFrame(KIND.act, json(actMsg())));
  await sleep(1500);
  const got = ms[0].drain().filter(isB).length;
  const took = performance.now() - t0;
  assert(got < 140 && got >= 60, `member 0 got ${got} of 140 from the others (the table burst is 120 in all, refill 40 a second)`);
  assert(ms.every(m => m.closeCode === null), 'nobody was closed by the table limit');
  console.log(`      table limit: ${got} of 140 delivered, ${Math.round(took)} ms`);
});

test('origins: /t takes BLATERO\'s itch origin and localhost; a Palermo Drive origin is refused on /t and a BLATERO origin on /r', async () => {
  const t = async (origin, want, label, path = '/t') => { const r = await rawUpgrade({ origin, ip: freshIp(), path }); r.socket?.destroy(); eq(r.status, want, label); };
  await t(ORIGIN, 101, '/t with the itch game frame origin');
  await t(PALERMO_ORIGIN, 403, '/t with the Palermo Drive origin');
  await t(undefined, 403, '/t with no Origin');
  await t('https://evil.example', 403, '/t foreign');
  await t('https://html-classic.itch.zone.evil.example', 403, '/t look-alike');
  await t('https://evil.html-classic.itch.zone', 403, '/t sub domain');
  await t('http://html-classic.itch.zone', 403, '/t wrong scheme');
  await t('https://bonnie-studios.itch.io', 403, '/t the itch page itself is not the game frame');
  await t('http://localhost', 403, '/t localhost without a port');
  await t('http://localhost:5173', 101, '/t localhost with a port');
  await t('http://127.0.0.1:8080', 101, '/t 127.0.0.1 with a port');
  await t(ORIGIN, 403, '/r with the BLATERO origin', '/r');
  await t(PALERMO_ORIGIN, 101, '/r with the Palermo Drive origin', '/r');
  await t('http://localhost:5173', 101, '/r localhost', '/r');
  eq((await rawUpgrade({ origin: ORIGIN, upgrade: false })).status, 426, '/t without an Upgrade header');
  eq((await rawUpgrade({ origin: ORIGIN, path: '/t/stats', upgrade: false })).status, 404, 'no stats for tables');
  eq((await rawUpgrade({ origin: ORIGIN, path: '/t/x' })).status, 404, 'no sub paths');
  eq((await rawUpgrade({ origin: ORIGIN, path: '/tables' })).status, 404, '/tables');
  const s = await (await fetch(BASE + '/stats')).json();
  assert('online' in s && !('tables' in s), '/stats is still Palermo Drive\'s and has nothing about tables');
});

test('a hostile first frame from a browser of another game: Palermo Drive HELLO bytes on /t, and BLATERO bytes on /r', async () => {
  const c = await TClient.open(); clients.push(c);
  c.send(Uint8Array.from([1, 2, 1, 0, 3, 65, 66, 67])); // a Palermo Drive HELLO
  eq(await c.closed(), 1008, 'not a tables HELLO');
});

test('per address: 24 sockets (429), an IPv6 /64 counts as one address, 4 tables, 8 distinct codes an hour', async () => {
  const ip = freshIp();
  const held = [];
  for (let i = 0; i < 24; i++) { const r = await rawUpgrade({ origin: ORIGIN, ip }); eq(r.status, 101, `socket ${i + 1}`); held.push(r.socket); }
  eq((await rawUpgrade({ origin: ORIGIN, ip })).status, 429, 'the 25th from one address');
  const block = `2001:db8:${(Math.random() * 65535 | 0).toString(16)}:77`;
  for (let i = 0; i < 24; i++) { const r = await rawUpgrade({ origin: ORIGIN, ip: `${block}:${i + 1}::${i + 9}` }); eq(r.status, 101, `v6 socket ${i + 1}`); held.push(r.socket); }
  eq((await rawUpgrade({ origin: ORIGIN, ip: `${block}:ffff:ffff:ffff:ffff` })).status, 429, 'another address in the same /64');
  const next = await rawUpgrade({ origin: ORIGIN, ip: `${block.slice(0, -2)}78:1::1` }); eq(next.status, 101, 'the next /64'); held.push(next.socket);
  held.forEach(s => s.destroy());
  await sleep(500);

  // four tables per address
  const tip = freshIp();
  for (let i = 0; i < 4; i++) await member(freshCode(), { ip: tip });
  const fifth = await TClient.open({ ip: tip }); clients.push(fifth);
  fifth.send(helloFrame(freshPid(), freshCode()));
  eq(await fifth.closed(), 1008, 'a fifth table');
  const sameTable = await TClient.open({ ip: tip }); clients.push(sameTable);
  await sameTable.join(clients.find(c => c.ip === tip && c.code).code);
  assert(sameTable.closeCode === null, 'a second socket at a table the address already has is fine');

  // eight distinct codes an hour: guesses at live tables (create flag answers 4002) use the allowance too
  const codes = Array.from({ length: 9 }, freshCode);
  for (const c of codes.slice(0, 8)) await member(c);
  const gip = freshIp();
  for (const c of codes.slice(0, 8)) {
    const g = await TClient.open({ ip: gip }); clients.push(g);
    g.send(helloFrame(freshPid(), c, true));
    eq(await g.closed(), 4002, `guess ${c} finds a live table`);
  }
  const ninth = await TClient.open({ ip: gip }); clients.push(ninth);
  ninth.send(helloFrame(freshPid(), freshCode(), true));
  eq(await ninth.closed(), 1008, 'the ninth distinct code from this address');
  const again = await TClient.open({ ip: gip }); clients.push(again);
  again.send(helloFrame(freshPid(), codes[0], false));
  assert(!(await again.closed(500)) || again.closeCode !== 1008, 'a code it already named is not refused for the count');
});

test('30 tables at once, then 1013 for a new one; joining an existing table still works', async () => {
  const codes = Array.from({ length: 30 }, freshCode);
  for (const c of codes) await member(c);
  const x = await TClient.open(); clients.push(x);
  x.send(helloFrame(freshPid(), freshCode()));
  eq(await x.closed(), 1013, 'the 31st table');
  const y = await member(codes[0]);
  assert(y.slot === 1, 'an existing table can still be joined');
});

test('daily frame budget per address: the address is closed, then refused with 429 on upgrade', async () => {
  const ip = freshIp();
  const codes = Array.from({ length: 4 }, freshCode);
  let frames = 0, cycles = 0;
  const t0 = performance.now();
  for (; cycles < 80; cycles++) {
    const socks = [];
    // the previous cycle's sockets may still be closing at the relay, which shows as 429 too: retry before believing it
    let refusedUpgrade = false;
    const open1 = async () => { for (let tries = 0; ; tries++) { try { return await TClient.open({ ip }); } catch { if (tries >= 3) return null; await sleep(500); } } };
    for (const c of await Promise.all(Array.from({ length: 24 }, open1))) { if (c) socks.push(c); else refusedUpgrade = true; }
    if (refusedUpgrade) { socks.forEach(s => s.close()); break; }
    for (let i = 0; i < socks.length; i++) {
      const c = socks[i]; c.send(helloFrame(freshPid(), codes[i % 4]));
      for (let k = 0; k < 130; k++) c.send(beatFrame());
      frames += 131;
    }
    await sleep(150);
    socks.forEach(s => s.close());
    await sleep(100);
  }
  const took = Math.round(performance.now() - t0);
  await sleep(1500);
  const refused = await rawUpgrade({ origin: ORIGIN, ip });
  refused.socket?.destroy();
  eq(refused.status, 429, `the address is refused after about ${frames} frames sent in ${cycles} cycles (${took} ms)`);
  assert(frames >= 100_000 * 0.6, `sent only ${frames} frames`);
  const other = await rawUpgrade({ origin: ORIGIN, ip: freshIp() });
  other.socket?.destroy();
  eq(other.status, 101, 'other addresses are unaffected');
  console.log(`      budget reached after ${frames} frames sent in ${cycles} cycles`);
});

test('hibernation: after the object has been idle, tables, slots, roster and replacement all still work', async () => {
  const code = freshCode();
  const pb = freshPid();
  const a = await member(code), b = await member(code, { pid: pb }), c = await member(code);
  b.close(); await sleep(200); // a hole at slot 1
  const b2 = await member(code, { pid: pb });
  eq(b2.slot, 1, 'slot 1 again');
  console.log('      idle for 15 s so the object can hibernate (the wrangler log shows "tables: rebuilt" on the next event)');
  await sleep(15_000);
  a.send(bcastFrame(KIND.act, json(actMsg())));
  eq((await c.next(isB)).from, 0, 'a frame after the sleep reaches c from slot 0');
  await b2.next(isB);
  const d = await member(code);
  eq([d.slot, d.welcome.others.map(o => [o.slot, o.pid])], [3, [[0, pidHex(a.pid)], [1, pidHex(pb)], [2, pidHex(c.pid)]]], 'the roster was rebuilt from the attachments');
  c.send(toFrame(0, KIND.act, json(actMsg())));
  eq((await a.next(typeIs('TO'))).from, 2, 'TO by slot after the sleep');
  const b3 = await member(code, { pid: pb });
  eq(await b2.closed(), 4001, 'replacement finds the old member by its pid after the sleep');
  eq(b3.slot, 1, 'and the new socket takes its slot');
  a.close();
  eq((await d.next(isLeave(0))).slot, 0, 'a close after the sleep is announced');
  console.log('      (the table survived with the second sleep too)');
  await sleep(12_000);
  d.send(bcastFrame(KIND.act, json(actMsg())));
  await c.next(isB);
});

test('idle rules: no HELLO in 10 s closes 1008; a silent member closes 1001 after 40 s and the others are told; beats keep a member', async () => {
  const code = freshCode();
  const keeper = await member(code);
  const quiet = await member(code);
  const silent = await rawUpgrade({ origin: ORIGIN, ip: freshIp() });
  eq(silent.status, 101, 'a socket that never says HELLO');
  keeper.drain();
  const start = performance.now();
  let silentClosed = null;
  while (performance.now() - start < 42_500) {
    await sleep(9_000);
    keeper.send(beatFrame()); // an event for the relay, which is when the lazy rules run
    if (silentClosed === null && silent.closeCode() !== null) silentClosed = Math.round(performance.now() - start);
  }
  keeper.send(beatFrame());
  await sleep(500);
  eq(silent.closeCode(), 1008, 'no HELLO');
  assert(silentClosed !== null && silentClosed < 28_000, `the HELLO deadline was enforced on the next event after 10 s (seen at ${silentClosed} ms)`);
  eq(await quiet.closed(500), 1001, 'a member silent for 40 s');
  eq((await keeper.next(isLeave(1))).slot, 1, 'the others see it leave');
  assert(keeper.closeCode === null, 'a member that beats stays');
  silent.socket.destroy();
});

test('180 sockets in all (503); a full relay makes room from the heaviest address (1013)', async () => {
  await sleep(1500);
  const singles = [];
  for (let n = 0; n < 180; n++) { const r = await rawUpgrade({ origin: ORIGIN, ip: freshIp() }); eq(r.status, 101, `socket ${n + 1}`); singles.push(r.socket); }
  eq((await rawUpgrade({ origin: ORIGIN, ip: freshIp() })).status, 503, 'the 181st');
  singles.forEach(s => s.destroy());
  // sockets that never said HELLO are reaped lazily, on the first event after their 10 s
  await sleep(11_000);
  const big = freshIp(), mine = [], rest = [];
  for (let i = 0; i < 24; i++) { const r = await rawUpgrade({ origin: ORIGIN, ip: big }); eq(r.status, 101, `big ${i + 1}`); mine.push(r); }
  for (let n = 24; n < 180; n++) { const r = await rawUpgrade({ origin: ORIGIN, ip: freshIp() }); eq(r.status, 101, `single ${n + 1}`); rest.push(r); }
  const late = await rawUpgrade({ origin: ORIGIN, ip: freshIp() });
  eq(late.status, 101, 'a newcomer is let in by making room');
  await sleep(700);
  const closed = mine.filter(r => r.closeCode() !== null);
  eq([closed.length, closed[0]?.closeCode()], [1, 1013], 'one socket of the big holder was closed with 1013');
  assert(rest.every(r => r.closeCode() === null), 'no single was touched');
  [...mine, ...rest, late].forEach(r => r.socket?.destroy());
  await sleep(1500);
});

let failed = 0;
console.log(`tables e2e against ${BASE}`);
for (const t of tests) {
  const t0 = performance.now();
  try {
    await t.fn();
    console.log(`PASS  ${t.name}  (${Math.round(performance.now() - t0)} ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${t.name}\n      ${e.stack?.split('\n').slice(0, 3).join('\n      ') || e.message}`);
  }
  clients.splice(0).forEach(c => c.close());
  await sleep(300);
}
console.log(failed ? `\n${failed} of ${tests.length} FAILED` : `\nall ${tests.length} passed`);
process.exit(failed ? 1 : 0);
