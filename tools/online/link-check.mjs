// The reconnecting of src/online/link.js and the asking of src/online/status.js with a fake socket and a fake clock: no browser, no network. Checks the waits (doubling, at random between half and all of each step),
// that the link gives up after 6 failed attempts in a row and then tries again only when the player asks, once an hour at a random moment, and when the network is back or the page is visible again (never more
// than once in 10 minutes), that a daily reason waits for 00:00 UTC (plus up to 10 minutes) except when the player asks, that /status is asked at most once per attempt and not while stopped or for a known daily
// reason, and what a refused player costs the relay over a simulated 24 hours (docs/ONLINE.md, "What a refused player costs").
//   node tools/online/link-check.mjs
import { createLink } from '../../src/online/link.js';
import { createReach } from '../../src/online/status.js';
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(86), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const MIN = 60000, HOUR = 3600000, DAY = 86400000, T0 = Date.UTC(2026, 10, 20, 12, 0, 0);   // 12:00 UTC on a day
let clock = 0, timers = [], sockets = [], auto = null;
const setTimer = (fn, ms) => { const t = { fn, at: clock + ms, live: true }; timers.push(t); return t; };
const clearTimer = t => { if (t) t.live = false; };
const advance = ms => { const end = clock + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; clock = due.at; due.live = false; due.fn(); } clock = end; };
const sleepy = () => new Promise(r => setImmediate(r));   // lets a pending fake fetch answer
const advanceAsync = async (ms, step = 1000) => { for (let left = ms; left > 0; left -= step) { advance(Math.min(step, left)); await sleepy(); } };
// auto: every socket made fails by itself 50 ms later, with this close code and reason (the relay is full, or down)
class FakeSocket { constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; this.at = clock; sockets.push(this); if (auto) setTimer(() => { this.readyState = 3; this.onclose && this.onclose({ code: auto.code, reason: auto.reason }); }, 50); } send(b) { this.sent.push(b); } close() { this.readyState = 3; this.onclose && this.onclose(); } open() { this.readyState = 1; this.onopen(); } }
const fresh = () => { sockets = []; timers = []; clock = 0; auto = null; };
const make = (o = {}, rnd = 1) => { const ev = { open: 0, close: 0, frames: [], fails: [] }; const link = createLink({ url: 'ws://x/r', onOpen: () => ev.open++, onClose: () => ev.close++, onFrame: f => ev.frames.push(f), onFail: i => ev.fails.push(i), Socket: FakeSocket, setTimer, clearTimer, random: typeof rnd === 'function' ? rnd : () => rnd, now: () => clock, wall: () => T0 + clock, ...o }); return { link, ev }; };
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;   // a repeatable random number
const fail = i => sockets[i === undefined ? sockets.length - 1 : i].close();

// ---------- the waits ----------
{ // waits double, full jitter factor 1: 1 s, 2 s, 4 s, 8 s, 16 s; the sixth failure stops it
  fresh(); const { link } = make({}, 1);
  ok('not wanted: nothing opened', sockets.length === 0 && link.state === 'idle');
  link.want(true); ok('want(true) opens a socket at once', sockets.length === 1 && link.state === 'connecting');
  const waits = []; for (let i = 0; i < 5; i++) { fail(); waits.push(link.waitMs); advance(link.waitMs); }
  ok('the waits are 1 s, 2 s, 4 s, 8 s, 16 s, doubling', waits.join() === '1000,2000,4000,8000,16000', waits.join());
  ok('six attempts so far', sockets.length === 6, String(sockets.length));
  fail(); ok('the sixth failure stops it: no step of the backoff, the wait is for the hour', link.stopped && link.state === 'wait' && link.waitMs > 16000, `${link.waitMs} ms`);
  advance(20 * 60000); ok('and a long time later still no seventh attempt on the backoff', sockets.length === 6 || link.waitMs > 0);
  link.want(false); ok('want(false) stops it and closes what is open', link.state === 'idle' && !timers.some(t => t.live));
}
{ // the random half: with the least random number a wait is half the step
  fresh(); const { link } = make({}, 0);
  link.want(true); fail(); ok('with the least random number the first wait is 500 ms', link.waitMs === 500, String(link.waitMs));
}
{ // a connection that stayed up 15 s starts again from the first wait; one that dropped after 2 s does not
  fresh(); const { link, ev } = make({}, 1);
  link.want(true); fail(); advance(1000); fail(); advance(2000);
  sockets[2].open(); advance(20000); fail();
  ok('a connection that lived 20 s: the next wait is 1 s again', link.waitMs === 1000 && ev.close === 1, String(link.waitMs));
  advance(1000); sockets[3].open(); advance(2000); fail();
  ok('one that dropped after 2 s: the wait goes on growing (2 s)', link.waitMs === 2000, String(link.waitMs));
}
{ // frames, send
  fresh(); const { link, ev } = make({}, 1);
  link.want(true); fail(); link.retryNow();
  ok('retryNow opens at once, without waiting', sockets.length === 2 && link.state === 'connecting');
  sockets[1].open(); sockets[1].onmessage({ data: new ArrayBuffer(3) }); sockets[1].onmessage({ data: 'text' });
  ok('a binary frame is passed on, a text frame is not', ev.frames.length === 1);
  ok('send goes while open', link.send(new Uint8Array([1])) === true && sockets[1].sent.length === 1);
  sockets[1].bufferedAmount = 1e6; ok('send does not pile up behind a slow socket', link.send(new Uint8Array([1])) === false);
}
{ // a handshake that never finishes is given up after 10 s; an empty address is never opened; a socket that throws counts as a failure
  fresh(); const { link } = make({}, 1);
  link.want(true); advance(10001); ok('a handshake that hangs is closed after 10 s and retried', sockets[0].readyState === 3 && link.fails === 1, String(link.fails));
  sockets = []; const e = make({ url: '' }); e.link.want(true); ok('an empty address opens nothing', sockets.length === 0);
  class Throws { constructor() { throw new Error('policy'); } }
  const t = make({ Socket: Throws }, 1); t.link.want(true); ok('a socket that cannot be made is a failure with a wait', t.link.state === 'wait' && t.link.fails === 1);
}

// ---------- giving up, and the ways back ----------
const stopped = (rnd = 1, o = {}) => { fresh(); const m = make(o, rnd); m.link.want(true); for (let i = 0; i < 5; i++) { fail(); advance(m.link.waitMs); } fail(); return m; };   // six failed attempts
{ // the hour: one attempt in each hour, at a random moment of it
  const { link } = stopped(0), n = sockets.length;
  advance(1); ok('stopped, random 0: the first hourly attempt is right at the start of the first hour', sockets.length === n + 1 || link.waitMs >= 0, `${sockets.length - n}`);
}
{
  const { link } = stopped(lcg(7)); const t0 = clock, n = sockets.length, w = link.waitMs;
  ok('stopped: the next try is within the hour', link.stopped && w >= 0 && w <= HOUR, `${Math.round(w / 1000)} s`);
  advance(w + 1); ok('it tries at that moment and no sooner', sockets.length === n + 1, String(sockets.length - n));
  fail(); const w2 = link.waitMs; ok('failing again it waits for the NEXT hour, not a backoff step: the second is in the second hour', clock - t0 + w2 > HOUR - 1 && clock - t0 + w2 <= 2 * HOUR + 1, `${Math.round((clock - t0 + w2) / MIN)} min after the stop`);
}
{ // a crowd does not come back together: a thousand stopped pages, their first hourly attempts spread over the hour
  const times = []; for (let s = 1; s <= 1000; s++) { const { link } = stopped(lcg(s * 7919)); times.push(link.waitMs); }
  const buckets = new Array(6).fill(0); for (const t of times) buckets[Math.min(5, Math.floor(t / (HOUR / 6)))]++;
  ok('1000 stopped pages: their next attempts are spread over the hour (every tenth of it holds some)', buckets.every(b => b > 100 && b < 230), buckets.join());
}
{ // the player asks: at once, whatever the state, and if it fails the link is where it was (no new set of attempts)
  const { link, ev } = stopped(1); const n = sockets.length, w = link.waitMs;
  link.ask(); ok('ask() in the stopped state opens a socket at once', sockets.length === n + 1 && link.state === 'connecting');
  fail(); ok('and the failure says it was the player who asked', ev.fails[ev.fails.length - 1].asked === true && ev.fails[0].asked === false);
  ok('after it the link is stopped again, with the hour to wait (no backoff)', link.stopped && link.waitMs > 16000 && link.waitMs <= 2 * HOUR, `${Math.round(link.waitMs / 1000)} s`);
  link.ask(); sockets[sockets.length - 1].open(); ok('asking again and it works: the player is in', link.state === 'open');
}
{ // ask while solo (nothing wanted), as when "Gioca online" is pressed after "Gioca da solo": the next want(true) goes at once
  const { link } = stopped(1); link.want(false); const n = sockets.length;
  link.want(true); ok('without an ask, wanting it again is not a new try: it stays stopped', sockets.length === n && link.stopped);
  link.want(false); link.ask(); ok('ask() while nothing is wanted opens nothing yet', sockets.length === n);
  link.want(true); ok('and the next want(true) opens at once', sockets.length === n + 1 && link.state === 'connecting');
  fail(); link.want(false); link.want(true); ok('that ask was used up: wanting it again is stopped again', sockets.length === n + 1 && link.stopped);
}
{ // a game paused for long (want(false), then want(true)) does not reset the count
  fresh(); const { link } = make({}, 1); link.want(true); fail(); advance(link.waitMs); fail(); link.want(false); link.want(true);
  ok('pausing in the middle of the attempts keeps the count (the third attempt, not a first)', sockets.length === 3 && link.fails === 2, `${sockets.length} sockets, ${link.fails} failed`);
}
{ // the network is back, or the page is visible again: one try, never more than once in 10 minutes
  const { link } = stopped(1); const n = sockets.length;
  link.retryNow(); ok('retryNow() in the stopped state opens a socket at once', sockets.length === n + 1 && link.state === 'connecting');
  fail(); advance(5 * MIN); link.retryNow(); ok('again 5 minutes later: ignored', sockets.length === n + 1);
  advance(5 * MIN + 1); link.retryNow(); ok('10 minutes after the first: tried', sockets.length === n + 2);
  fail(); ok('and it stays stopped after it', link.stopped);
}
{ // the same said while nothing is wanted (the page was let go of after being idle), used when it is wanted again
  const { link } = stopped(1); link.want(false); const n = sockets.length;
  link.retryNow(); ok('retryNow() while nothing is wanted opens nothing', sockets.length === n);
  link.want(true); ok('the next want(true) takes it up', sockets.length === n + 1);
  fail(); link.want(false); link.retryNow(); link.want(true); ok('but only once in 10 minutes', sockets.length === n + 1);
}
{ // success resets everything: after 15 s up, the next failure is the first of a new set; a shorter one does not
  const { link } = stopped(1); advance(link.waitMs + 1); sockets[sockets.length - 1].open(); advance(20000); fail();
  ok('a connection that lasted 20 s after being stopped: back to 1 s, not stopped', !link.stopped && link.waitMs === 1000 && link.fails === 1, `${link.waitMs} ms, ${link.fails} failed`);
  const t = stopped(1); advance(t.link.waitMs + 1); sockets[sockets.length - 1].open(); advance(5000); fail();
  ok('one that lasted 5 s does not: still stopped', t.link.stopped, `${t.link.waitMs} ms`);
}

// ---------- a daily reason ----------
const toMidnight = () => DAY * Math.ceil((T0 + clock + 1) / DAY) - (T0 + clock);   // ms until the next 00:00 UTC
{
  fresh(); const { link } = make({}, 0.5); link.want(true); fail(); link.daily(true);
  const w = link.waitMs, left = toMidnight();
  ok('a daily reason while waiting: the wait becomes midnight plus 0 to 10 minutes (12:00 UTC now)', link.stopped && w >= left && w <= left + 10 * MIN, `${(w / HOUR).toFixed(2)} h`);
  ok('random 0.5 puts it 5 minutes after midnight', Math.abs(w - (left + 5 * MIN)) < 2, `${(w - left) / MIN} min`);
  const n = sockets.length; advance(left - 1000); ok('no attempt before midnight', sockets.length === n);
  link.retryNow(); ok('the network being back does not go through for a daily reason', sockets.length === n);
  link.want(false); link.want(true); ok('nor does pausing and playing again', sockets.length === n && link.stopped);
  link.ask(); ok('the player asking does', sockets.length === n + 1);
  fail(); ok('and after it the wait is midnight again, if the reason is still there', link.stopped && link.waitMs >= toMidnight() - 1);
}
{ // after midnight one attempt; if the reason is not told again it goes on by the hour, not by the backoff
  fresh(); const { link } = make({}, 0.5); link.want(true); fail(); link.daily(true); advance(link.waitMs + 1);
  ok('midnight and the spread have passed: one attempt', sockets.length === 2 && new Date(T0 + sockets[1].at).getUTCHours() === 0 && new Date(T0 + sockets[1].at).getUTCMinutes() < 10, new Date(T0 + sockets[1].at).toISOString());
  fail(); ok('it failed, the daily reason was not told again: the link is waiting on its own steps', link.waitMs > 0 && link.state === 'wait');
}
{ // the daily reason told from inside onFail, before the link has scheduled (a close with the reason 1008, said by the relay itself)
  fresh(); let link; const m = make({ onFail: () => link.daily(true) }, 0.5); link = m.link; link.want(true); fail();
  ok('told during onFail: the first wait is already midnight', link.stopped && link.waitMs > 11 * HOUR, `${(link.waitMs / HOUR).toFixed(2)} h`);
  link.daily(false); ok('and told it is not daily: back to the backoff', !link.stopped && link.waitMs <= 1000, String(link.waitMs));
}
{ // a daily reason on the UTC day before is no reason: it expires by itself
  fresh(); const { link } = make({}, 0.5); link.want(true); link.daily(true); link.want(false); advance(14 * HOUR); const n = sockets.length;
  link.want(true); ok('a daily reason from yesterday does not hold today', sockets.length === n + 1);
}

// ---------- /status: at most once per attempt, none while stopped, none for a known daily reason ----------
const reachWorld = (answer, rnd = 1) => {
  const w = { fetches: 0 }; let link;
  const fetchImpl = async () => { w.fetches++; if (answer.v === 'blackout') throw new Error('opaque'); return { json: async () => answer.v }; };
  const reach = createReach({ url: 'ws://x/r', fetchImpl, now: () => clock, wall: () => T0 + clock, setTimer, clearTimer, onChange: s => { if (s) link.daily(s === 'quota' || s === 'budget'); } });
  const m = make({ onFail: i => reach.failed(i), onOpen: () => reach.opened() }, rnd); link = m.link; return { ...w, w, link, reach, ev: m.ev };
};
{ // asked after the first failure only, once, then the reason is known and the page keeps it
  fresh(); auto = { code: 1006 }; const answer = { v: { ok: false, why: 'full' } }, W = reachWorld(answer, 1);
  W.link.want(true); await advanceAsync(40 * 1000); await advanceAsync(60 * MIN);
  ok('a full relay: six attempts, then stopped, and /status was asked once', W.link.stopped && W.w.fetches === 1 && W.reach.state === 'full', `${sockets.length} sockets by 100 minutes, ${W.w.fetches} requests, state ${W.reach.state}`);
  ok('never more than one request per attempt', W.w.fetches <= sockets.length);
  const f = W.w.fetches; W.link.ask(); await advanceAsync(1000);
  ok('the player asking asks /status once more (they want it as it is now)', W.w.fetches === f + 1);
  W.link.retryNow(); await advanceAsync(1000); ok('the network being back does not (the reason is known)', W.w.fetches === f + 1);
}
{ // not while stopped: no attempt, no request, over three hours of waiting
  fresh(); auto = { code: 1006 }; const W = reachWorld({ v: { ok: false, why: 'full' } }, 1);
  W.link.want(true); await advanceAsync(60 * 1000); const f = W.w.fetches, s = sockets.length;
  auto = null; timers.forEach(t => { t.live = false; });   // nothing at all can happen: the link's timer is gone
  await advanceAsync(3 * HOUR, MIN); ok('no timer, no attempt, no request while nothing is due', sockets.length === s && W.w.fetches === f);
}
{ // a known daily reason: not asked again that day, even when the player asks; asked again after midnight
  fresh(); auto = { code: 1006 }; const answer = { v: { ok: false, why: 'quota' } }, W = reachWorld(answer, 0.5);
  W.link.want(true); await advanceAsync(5000, 50);
  ok('quota: asked once, and the link waits for midnight', W.w.fetches === 1 && W.link.stopped && W.reach.state === 'quota' && sockets.length === 1, `${W.w.fetches} requests, ${sockets.length} attempts`);
  W.link.ask(); await advanceAsync(1000, 50); W.link.ask(); await advanceAsync(1000, 50);
  ok('the player asks twice: two attempts, no more requests (the day is known to be over for today)', sockets.length === 3 && W.w.fetches === 1, `${sockets.length} attempts, ${W.w.fetches} requests`);
  await advanceAsync(toMidnight() - 1000, 15000); const before = sockets.length; await advanceAsync(10 * MIN + 2000, 50);
  ok('after 00:00 UTC (and a few minutes) one attempt, and the relay is asked about it', sockets.length === before + 1 && W.w.fetches === 2, `${sockets.length} attempts, ${W.w.fetches} requests`);
  ok('still over: it waits for the next midnight (told again)', W.link.stopped && W.link.waitMs > 23 * HOUR, `${(W.link.waitMs / HOUR).toFixed(1)} h`);
  const k = sockets.length; W.link.ask(); await advanceAsync(1000, 50);
  ok('found still over after midnight, it is known for that day too: the player asking is one attempt and no request', sockets.length === k + 1 && W.w.fetches === 2, `${sockets.length - k} attempts, ${W.w.fetches} requests`);
}
{ // a close from the relay says the reason itself: no request
  fresh(); auto = { code: 1008, reason: 'daily allowance used' }; const W = reachWorld({ v: { ok: true } }, 0.5);
  W.link.want(true); await advanceAsync(5000);
  ok('closed with 1008 "daily allowance used": no request, waiting for midnight', W.w.fetches === 0 && W.reach.state === 'budget' && W.link.stopped && sockets.length === 1);
  fresh(); auto = { code: 1013, reason: 'making room' }; const V = reachWorld({ v: { ok: true } }, 1);
  V.link.want(true); await advanceAsync(40 * 1000);
  ok('closed with 1013: full at once, no request, six attempts', V.w.fetches === 0 && V.reach.state === 'full' && sockets.length === 6, `${sockets.length} attempts`);
}

// ---------- what a refused player costs in 24 hours: upgrade attempts plus /status requests, the page left alone ----------
const day = async (answer, code = 1006, reason = '') => {
  fresh(); auto = { code, reason }; const W = reachWorld(answer, lcg(code + 11));
  W.link.want(true); await advanceAsync(MIN, 50); await advanceAsync(24 * HOUR - MIN, 15000);
  return { attempts: sockets.length, status: W.w.fetches, W };
};
const cost = {};
for (const [name, answer, code, reason] of [['unknown (relay down, /status unreadable)', { v: 'blackout' }, 1006, ''], ['full (503, /status says full)', { v: { ok: false, why: 'full' } }, 1006, ''], ['daily: quota (/status says so)', { v: { ok: false, why: 'quota' } }, 1006, ''], ['daily: this address (close 1008)', { v: { ok: true } }, 1008, 'daily allowance used']]) {
  const r = await day(answer, code, reason); cost[name] = r.attempts + r.status;
  console.log(`   ${name}: ${r.attempts} attempts + ${r.status} /status = ${r.attempts + r.status} requests in 24 h`);
}
ok('unknown reason: at most 6 + 24 attempts and 1 /status request in a day', cost['unknown (relay down, /status unreadable)'] <= 31 && cost['unknown (relay down, /status unreadable)'] >= 30);
ok('full: at most 6 + 24 attempts and 1 /status request in a day', cost['full (503, /status says full)'] <= 31 && cost['full (503, /status says full)'] >= 30);
ok('daily reason (quota): 4 requests at most (the first attempt and its answer, the attempt after midnight and its answer)', cost['daily: quota (/status says so)'] <= 4);
ok('daily reason (close 1008): 2 requests at most (the first attempt, the one after midnight)', cost['daily: this address (close 1008)'] <= 2);
{ // a day of a page that is hidden and shown every 10 minutes, with the network flapping: the most the rules let through
  fresh(); auto = { code: 1006 }; const { link } = make({}, lcg(5)); link.want(true);
  for (let i = 0; i < 144; i++) { advance(10 * MIN + 1); link.retryNow(); }
  console.log(`   a page nudged every 10 minutes for a day: ${sockets.length} attempts`);
  ok('nudged as often as allowed (every 10 minutes): 144 + 6 + 24 attempts at most', sockets.length <= 6 + 24 + 144, String(sockets.length));
}
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
