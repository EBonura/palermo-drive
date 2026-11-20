// The rules of protocol v2 (a v2 bot: the relay serves it exactly as before protocol 3; v3 is relay-worker/test/v3-e2e.mjs) (docs/ONLINE.md, "Who gets whom" and "Limits"), checked from outside with bots (tools/online/bot.mjs): no browser. It is the yardstick for any relay: the simulator
// (default, a relay of its own per run) or the real one (relay-worker/ under `wrangler dev`, with --relay). A rule the relay does not keep is a FAIL line, not a bug in this file; read the line.
//   node tools/online/relay-rules.mjs [--relay ws://127.0.0.1:8799/r] [--k 8]
// Each bot gives its own CF-Connecting-IP, so a relay that limits connections per address does not count them as one machine.
import { startRelaySim } from './relaysim.mjs';
import { startBot } from './bot.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms)), arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const given = arg('relay', ''), sim = given ? null : await startRelaySim({ perAddress: 24 }), url = given || sim.url;
if (!/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) throw new Error('only a relay on this machine: ' + url);
const K = +arg('k', 8);   // the most players a set holds (the relay's own number: 8, the game's MAX_PLAYERS)
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(72), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const all = []; let ipn = 1;
const bot = async (o = {}) => { const b = await startBot(url, { ver: 2, ip: `10.1.${Math.floor(ipn / 250)}.${ipn++ % 250}`, ...o }); all.push(b); return b; };
const settle = async bots => { for (let r = 0; r < 2; r++) { for (const b of bots) b.state({ x: b.x, z: b.z }); await sleep(r ? 300 : 1250); } };   // a set is worked out when a state arrives and a second has passed since the last time
try {
  // the handshake
  const a = await bot({ name: 'A', x: 0, z: 0 });
  ok('WELCOME gives a handle in 1..65535 and the number connected', a.handle >= 1 && a.handle <= 65535 && a.online >= 1, `handle ${a.handle}, online ${a.online}`);
  let refused = ''; await startBot(url, { origin: 'https://evil.example' }).catch(e => { refused = e.message; });
  ok('an Origin that is not allowed is refused with 403', /403/.test(refused), refused);
  const b = await bot({ name: 'B', x: 100, z: 0 });
  ok('handles are different', a.handle !== b.handle);
  ok('before any state nobody is in anybody\'s set', a.entered.size === 0 && b.entered.size === 0);
  await settle([a, b]);
  ok('ENTER: each is introduced to the other, with the info it said', a.entered.has(b.handle) && b.entered.has(a.handle) && a.entered.get(b.handle).name === 'B', JSON.stringify([...a.entered]));
  a.state({ x: 0, z: 0 }); await sleep(300);
  ok('STATE: forwarded to the one who has it in the set, after its ENTER', b.states.has(a.handle) && b.states.get(a.handle).n >= 1);
  a.info('Anna2'); await sleep(300);
  ok('INFO: the ones who have it in the set get a new ENTER', b.entered.get(a.handle).name === 'Anna2', JSON.stringify(b.entered.get(a.handle)));
  a.say(3); await sleep(300);
  ok('SAY within range reaches the other', b.says.some(s => s[0] === a.handle && s[1] === 3));
  a.to(b.handle, [4, 0, 9]); await sleep(300);
  ok('TO reaches the one who has the sender in the set', b.tos.some(t => t[0] === a.handle && t[1].join() === '4,0,9'));
  await b.close(); await sleep(400);
  ok('LEAVE: when one of the set disconnects, the others are told', a.left.includes(b.handle), JSON.stringify(a.left));
  await a.close();

  // the cap: K + 2 bots within 100 m of each other; each is told about K at most
  const crowd = []; for (let i = 0; i < K + 2; i++) crowd.push(await bot({ name: 'K' + i, x: i * 7, z: 0 }));
  await settle(crowd);
  ok(`a set holds ${K} at most (${K + 2} players around)`, crowd.every(k => k.entered.size === K), JSON.stringify(crowd.map(k => k.entered.size)));
  // hysteresis: the 14th moves 20 m nearer to the first: not enough to replace anybody ("at least 30 m nearer"); then 40 m nearer: it is
  const first = crowd[0], mover = crowd[K + 1];
  const outside = !first.entered.has(mover.handle);
  mover.to(first.handle, [4, 0, 1]); await sleep(300);
  ok('TO to somebody who does not have the sender in the set is dropped', outside && first.tos.length === 0);
  mover.x = (K + 1) * 7 - 20; await settle([first, mover]);
  ok('a player outside the set 20 m nearer does not push anybody out (needs 30 m)', outside && !first.entered.has(mover.handle), String(outside));
  mover.x = (K + 1) * 7 - 60; await settle([first, mover]);
  ok('... and 60 m nearer it does', first.entered.has(mover.handle));
  for (const k of crowd) await k.close();
  await sleep(300);

  // thinning: one sender, observers 100, 250, 600 and 2000 m away, 10 states a second for 6 s
  const S = await bot({ name: 'S', x: 0, z: 0 }), obs = []; for (const d of [100, 250, 600, 2000]) obs.push(await bot({ name: 'O' + d, x: d, z: 0 }));
  await settle([S, ...obs]); const n0 = obs.map(o => o.states.get(S.handle)?.n || 0);
  for (let i = 0; i < 60; i++) { S.state({ x: 0, z: 0, t: i * 100 }); await sleep(100); }
  const got = obs.map((o, i) => (o.states.get(S.handle)?.n || 0) - n0[i]);
  ok('thinning: 100 m gets (nearly) all 60, 250 m about 5 a second, 600 m about 1, 2000 m about 0.4', got[0] >= 55 && got[1] >= 20 && got[1] <= 32 && got[2] >= 4 && got[2] <= 8 && got[3] >= 1 && got[3] <= 4, JSON.stringify(got));
  // SAY range: the 100 m observer hears, the 600 m one does not
  S.say(5); await sleep(300);
  ok('SAY: 100 m hears it, 600 m does not', obs[0].says.some(s => s[1] === 5) && !obs[2].says.some(s => s[1] === 5));
  // SAY rate: one a second, burst 3
  const before = obs[0].says.length; for (let i = 0; i < 8; i++) S.say(6); await sleep(500);
  ok('SAY rate: a burst of 8 delivers 4 at most', obs[0].says.length - before <= 4, String(obs[0].says.length - before));

  // limits
  const big = await bot({ name: 'Big' }); big.send(new Uint8Array(97).fill(3)); await sleep(500);
  ok('a frame over 96 bytes closes the socket with 1009', big.closed === 1009, String(big.closed));
  const junk = await bot({ name: 'Junk' }); for (let i = 0; i < 22; i++) { junk.send(new Uint8Array([3, 1, 2])); await sleep(90); } await sleep(300);
  ok('20 malformed frames close the socket with 1008', junk.closed === 1008, String(junk.closed));
  const dbl = await bot({ name: 'Dbl' }); dbl.send(new Uint8Array([1, 2, 0, 0, 0])); await sleep(400);
  ok('a second HELLO closes the socket with 1008', dbl.closed === 1008, String(dbl.closed));
  const outside2 = await bot({ name: 'Out' }); outside2.state({ x: 30000, z: 0 }); await sleep(300);
  ok('a position outside the map is a malformed state (dropped, counted)', outside2.closed === null);
  const nohello = await bot({ name: 'NoHello', hello: false }); nohello.send(new Uint8Array([3, 0, 0])); await sleep(300);
  ok('a frame before HELLO is not a HELLO (dropped)', nohello.handle === 0);
  // connections per address
  const ips = []; let refusedIp = '';
  for (let i = 0; i < 26; i++) { try { ips.push(await startBot(url, { ip: '10.9.9.9', name: 'Same' + i })); } catch (e) { refusedIp = e.message; break; } }
  all.push(...ips);
  ok('more than 24 connections from one address are refused with 429', /429/.test(refusedIp) || given, refusedIp || (given ? 'real relay: ' + ips.length + ' accepted' : ''));
  // an IPv6 client counts by its /64: every address inside one block is the same client, the next block is another
  const v6 = []; let refused6 = '';
  for (let i = 0; i < 26; i++) { try { v6.push(await startBot(url, { ip: `2001:db8:7:9:${(i + 1).toString(16)}::${(i + 5).toString(16)}`, name: 'Six' + i })); } catch (e) { refused6 = e.message; break; } }
  all.push(...v6);
  ok('more than 24 connections from one IPv6 /64 are refused with 429', /429/.test(refused6) || given, refused6 || (given ? 'real relay: ' + v6.length + ' accepted' : ''));
  try { all.push(await startBot(url, { ip: '2001:db8:7:a::1', name: 'NextBlock' })); ok('the next /64 is another client', true); } catch (e) { ok('the next /64 is another client', false, e.message); }
} finally { for (const x of all) await x.close().catch(() => {}); if (sim) await sim.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
