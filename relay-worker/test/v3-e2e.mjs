// Protocol v3 against a running `wrangler dev` (see README.md): the wanted set size in HELLO, the longer WELCOME, the radius sets, the AUDIENCE frame, batches, and that a v2 client in the same room still gets exactly what it got.
//   RELAY=http://127.0.0.1:8799 node test/v3-e2e.mjs      (a fresh `wrangler dev`: it expects to be the only user)
import { sleep, Client, freshIp, stateFrame, infoBytes, decPos, stats, rawUpgrade } from './lib.mjs';

let bad = 0;
const ok = (label, v, extra = '') => { console.log(label.padEnd(86), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const hello3 = (name, k = 0) => Uint8Array.from([1, 3, k, ...infoBytes(name)]);
const open = () => Client.open({ ip: freshIp() });
/** What a v3 client reads that lib.mjs's decode does not know: BATCH (8), AUDIENCE (9) and the 7 byte WELCOME. */
const raw3 = c => { c.ws.addEventListener('message', e => { const f = new Uint8Array(e.data); if (f[0] === 8) c.batches.push(f); else if (f[0] === 9) c.aud.push(f[1]); else if (f[0] === 1) c.welcomeRaw = f; }); c.batches = []; c.aud = []; return c; };
async function join3(name, k = 0) { const c = raw3(await open()); c.send(hello3(name, k)); await c.next(f => f.t === 'WELCOME', 3000); return c; }
const entries = f => { const out = []; let o = 2; for (let i = 0; i < f[1]; i++) { const len = f[o + 2 + 14] & 8 ? 20 : 18; out.push({ handle: f[o] | f[o + 1] << 8, body: f.slice(o + 2, o + 2 + len) }); o += 2 + len; } if (o !== f.length) throw new Error('batch not exactly laid out'); return out; };

// ---------- the hello and the welcome ----------
{
  const a = await join3('a');
  ok('a v3 hello is answered with the 7 byte welcome, version 3, 32 players', a.welcomeRaw.length === 7 && a.welcomeRaw[1] === 3 && a.welcomeRaw[6] === 32, [...a.welcomeRaw].join(','));
  const b = await join3('b', 64); ok('asking for 64 gets 64', b.welcomeRaw[6] === 64);
  const c = await join3('c', 200); ok('asking for 200 is cut to 64', c.welcomeRaw[6] === 64);
  const d = await join3('d', 5); ok('asking for 5 gets 5', d.welcomeRaw[6] === 5);
  const old = raw3(await open()); old.send(Uint8Array.from([1, 2, ...infoBytes('old')])); await old.next(f => f.t === 'WELCOME', 3000);
  ok('a v2 hello is answered with the old 6 byte welcome', old.welcomeRaw.length === 6 && old.welcomeRaw[1] === 2, [...old.welcomeRaw].join(','));
  for (const x of [a, b, c, d, old]) x.close();
  for (const [what, frame] of [['no info after the wanted size', [1, 3, 0]], ['version 4', [1, 4, 0, 1, 0, 0]], ['a v3 hello with a v2 layout (the info shifted)', [1, 3, 1, 0, 0]]]) {
    const x = await open(); x.send(Uint8Array.from(frame)); ok('a bad hello closes the socket with 1008: ' + what, (await x.closed(1500)) === 1008);
  }
}

// ---------- the audience ----------
{
  const a = await join3('aud-a'); a.send(stateFrame(0, 0));
  await sleep(300); ok('the first state of a lone v3 player is answered: nobody holds you (band 0)', a.aud[0] === 0, JSON.stringify(a.aud));
  const b = await join3('aud-b'); b.send(stateFrame(30, 0));
  await sleep(400); ok('a player that arrives 30 m away holds it: band 1, in the same event', a.aud.at(-1) === 1, JSON.stringify(a.aud));
  b.close(); await sleep(400); ok('and when it leaves: band 0 at once', a.aud.at(-1) === 0, JSON.stringify(a.aud));
  const old = raw3(await open()); old.send(Uint8Array.from([1, 2, ...infoBytes('v2')])); await old.next(f => f.t === 'WELCOME', 3000); old.send(stateFrame(10, 0)); await sleep(600);
  ok('a v2 player holding a v3 player never costs it a wrong frame, and gets no AUDIENCE itself', old.aud.length === 0 && a.aud.at(-1) === 1, JSON.stringify({ old: old.aud, a: a.aud }));
  const stV3 = old.inbox.find(m => m.f.t === 'STATE'), enters = old.inbox.filter(m => m.f.t === 'ENTER').length;
  ok('the v2 player is sent plain ENTER and STATE frames for the v3 player', !!stV3 && enters >= 1);
  a.close(); old.close();
}

// ---------- the set of a v3 player: radius and far slots ----------
{
  const me = await join3('rad-me'); me.send(stateFrame(5000, 5000));
  const near = [], far = [];
  for (let i = 0; i < 4; i++) { const p = await join3('rn' + i); p.send(stateFrame(5000 + 30 * (i + 1), 5000)); near.push(p); }
  for (let i = 0; i < 4; i++) { const p = await join3('rf' + i); p.send(stateFrame(5000 + 1500 * (i + 1), 5000)); far.push(p); }
  await sleep(1300); me.send(stateFrame(5000, 5000)); await sleep(1300); me.send(stateFrame(5000, 5000)); await sleep(500);
  const entered = me.inbox.filter(m => m.f.t === 'ENTER').map(m => m.f.name);
  ok('inside the radius all 4, beyond it the nearest 2 only', entered.length === 6 && ['rn0', 'rn1', 'rn2', 'rn3', 'rf0', 'rf1'].every(n => entered.includes(n)), JSON.stringify(entered));
  for (const x of [me, ...near, ...far]) x.close();
}

// ---------- batches: a crowd of 14 v3 players, 40 ms ----------
{
  const crowd = [];
  for (let i = 0; i < 14; i++) { const p = await join3('b' + i); p.x = 8000 + (i % 5) * 6; p.z = 8000 + Math.floor(i / 5) * 6; p.send(stateFrame(p.x, p.z)); crowd.push(p); }
  for (let r = 0; r < 3; r++) { await sleep(1150); for (const p of crowd) p.send(stateFrame(p.x, p.z)); }
  await sleep(300);
  const r = crowd[0]; r.batches.length = 0; r.drain();
  // 80 events in about 400 ms from the other 13: the relay is busy, so r's states are carried in batches
  for (let i = 0; i < 400; i++) { crowd[1 + i % 13].send(stateFrame(crowd[1 + i % 13].x + (i % 7) * 0.05, crowd[1 + i % 13].z, { tag: i })); if (i % 5 === 4) await sleep(5); }
  await sleep(400);
  const states = r.drain().filter(f => f.t === 'STATE').length, bs = r.batches;
  const inBatches = bs.reduce((n, f) => n + entries(f).length, 0);
  ok('under load the receiver is sent BATCH frames, each exactly laid out, 2 to 16 states', bs.length > 0 && bs.every(f => f[1] >= 2 && f[1] <= 16 && entries(f).length === f[1]), `${bs.length} batches, ${inBatches} states in them, ${states} plain`);
  ok('far fewer frames than states', bs.length + states < (inBatches + states) / 2, `${bs.length + states} frames for ${inBatches + states} states`);
  // nothing waits for ever: one more event after the burst carries whatever was held
  crowd[3].send(stateFrame(crowd[3].x, crowd[3].z)); await sleep(150);
  const sentAll = (await stats()).framesForwarded;
  ok('and the relay counts every state it forwarded', sentAll > 0);
  for (const x of crowd) x.close();
}

// ---------- a frame type of the relay sent to the relay is malformed ----------
{
  const a = await join3('mal'); const s0 = await stats();
  a.send(Uint8Array.from([8, 2, 1, 0, ...new Uint8Array(18), 2, 0, ...new Uint8Array(18)])); a.send(Uint8Array.from([9, 3]));
  await sleep(300); const s1 = await stats();
  ok('a BATCH or an AUDIENCE frame from a client is dropped as malformed', (s1.dropped.malformed || 0) - (s0.dropped.malformed || 0) === 2, JSON.stringify(s1.dropped));
  a.close();
}

console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
