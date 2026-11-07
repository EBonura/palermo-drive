// Hostile events into the relay fallback's reader (src/p2p/fallback.js), with a fake WebSocket: no browser, no relay. Passes when nothing throws, every bad event is counted and
// dropped before the game sees it, a stranger cannot speak for a player whose key it does not hold, and what does reach the game is only bytes of the allowed sizes.
//   node tools/p2p/fbfuzz.mjs
import { createFallback, FB_KIND } from '../../src/p2p/fallback.js';
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(70), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const socks = [];
globalThis.WebSocket = class { constructor(url) { this.url = url; this.readyState = 1; this.sent = []; socks.push(this); setTimeout(() => this.onopen && this.onopen(), 0); } send(m) { this.sent.push(m); } close() { this.readyState = 3; } };
const got = [];
const fb = createFallback({ urls: ['wss://a.test', 'wss://b.test'], app: 'app', ns: 'ns', selfId: 'me', onEvent: (from, room, msgs) => got.push({ from, room, msgs }) });
fb.setActive(true); fb.listen(['ns:500:1:2']);
await new Promise(r => setTimeout(r, 700));
const sub = JSON.parse(socks[0].sent.find(m => m.startsWith('["REQ"')))[1];
const feed = ev => { let threw = 0; try { socks[0].onmessage({ data: typeof ev === 'string' ? ev : JSON.stringify(['EVENT', sub, ev]) }); } catch (e) { threw = 1; } return threw; };
const pk = c => c.repeat(64), now = () => Math.floor(Date.now() / 1000);
let n = 0; const ev = (o = {}) => ({ id: 'id' + (n++), pubkey: pk('a'), created_at: now(), kind: FB_KIND, tags: [['t', 'app:fb:ns@me']], content: '1 bob ' + Buffer.from([2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64'), ...o });
let threw = 0;
threw += feed(ev());
ok('a well formed event to our inbox reaches the game', got.length === 1 && got[0].from === 'bob' && got[0].room === null && got[0].msgs[0].length === 13, JSON.stringify(got));
const before = got.length, bad0 = fb.stats.bad;
for (const e of [
  ev({ kind: 1 }), ev({ pubkey: 'zz' }), ev({ id: 5 }), ev({ tags: 'x' }), ev({ content: 7 }), ev({ created_at: now() - 3600 }), ev({ created_at: 'x' }),
  ev({ content: '2 bob AAAA' }), ev({ content: '1 <b>x</b> AAAA' }), ev({ content: '1 bob !!!!' }), ev({ content: '1 bob ' + 'A'.repeat(200) }), ev({ content: '1 bob ' + Array(6).fill('AAAA').join(' ') }),
  ev({ content: 'x'.repeat(5000) }), ev({ tags: Array(40).fill(['t', 'app:fb:ns@me']) }), ev({ content: '1 me AAAA' }), ev({ tags: [['t', 'app:fb:ns@somebody-else']] }), ev({ tags: [['t', 'app:fb:ns:500:9:9']] }),
  null, 5, 'str', [], {},
]) threw += feed(e);
threw += feed('not json'); threw += feed('{"a":1}'); threw += feed(JSON.stringify(['EVENT', 'other-sub', ev()]));
ok('nothing threw', threw === 0, String(threw));
ok('none of the 25 bad, misaddressed or foreign events reached the game', got.length === before, JSON.stringify(got.slice(before)));
ok('the malformed ones were counted', fb.stats.bad - bad0 >= 14, String(fb.stats.bad - bad0));
// a stranger speaks for bob with another key
threw += feed(ev({ pubkey: pk('b') }));
ok('another key cannot speak for a player already heard', got.length === before, JSON.stringify(got.slice(before)));
// the same event twice (two relays)
const e2 = ev(); feed(e2); feed(e2);
ok('the same event twice reaches the game once', got.length === before + 1 && fb.stats.dup >= 1);
// a hello on a room we listen to, and a goodbye
feed(ev({ id: 'h1', pubkey: pk('c'), tags: [['t', 'app:fb:ns:500:1:2']], content: '1 carla ' + Buffer.from([1, 0, 0, 1, 65]).toString('base64') }));
feed(ev({ id: 'h2', pubkey: pk('c'), tags: [['t', 'app:fb:ns:500:1:2']], content: '1 carla' }));
const last2 = got.slice(-2);
ok('a hello carries its room, a goodbye has no messages', last2[0].room === 'ns:500:1:2' && last2[0].msgs.length === 1 && last2[1].msgs.length === 0, JSON.stringify(last2));
// relay manners: the second relay refuses for good, the first rate-limits; writer moves, then nothing goes out
socks[1].onmessage({ data: JSON.stringify(['OK', 'x', false, 'blocked: not here']) });
ok('a relay that refuses is left', fb.relays()[1].state === 'refused', JSON.stringify(fb.relays()));
socks[0].onmessage({ data: JSON.stringify(['OK', 'x', false, 'rate-limited: slow down']) });
ok('a relay that limits us is left for a while, and then nothing is sent', fb.relays()[0].state === 'limited' && (await fb.send(['bob'], [new Uint8Array([2])])) === false, JSON.stringify(fb.relays()));
fb.stop();
process.exit(bad ? 1 : 0);
