// The reconnecting of src/online/link.js with a fake socket and a fake clock: no browser, no network. Checks the waits (doubling, at random between half and all of each step, never past the cap), that a
// connection that stayed up starts the waits again and one that dropped at once does not, that nothing is opened while it is not wanted or the address is empty, and that frames of the wrong kind are ignored.
//   node tools/online/link-check.mjs
import { createLink } from '../../src/online/link.js';
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(72), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
let clock = 0, timers = [], sockets = [];
const setTimer = (fn, ms) => { const t = { fn, at: clock + ms, live: true }; timers.push(t); return t; };
const clearTimer = t => { if (t) t.live = false; };
const advance = ms => { const end = clock + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; clock = due.at; due.live = false; due.fn(); } clock = end; };
class FakeSocket { constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); } send(b) { this.sent.push(b); } close() { this.readyState = 3; this.onclose && this.onclose(); } open() { this.readyState = 1; this.onopen(); } }
const make = (o = {}, rnd = 1) => { const ev = { open: 0, close: 0, frames: [] }; const link = createLink({ url: 'ws://x/r', onOpen: () => ev.open++, onClose: () => ev.close++, onFrame: f => ev.frames.push(f), Socket: FakeSocket, setTimer, clearTimer, random: () => rnd, now: () => clock, ...o }); return { link, ev }; };

{ // waits double, full jitter factor 1: 1 s, 2 s, 4 s ...; half with the least random number
  sockets = []; timers = []; clock = 0; const { link } = make({}, 1);
  ok('not wanted: nothing opened', sockets.length === 0 && link.state === 'idle');
  link.want(true); ok('want(true) opens a socket at once', sockets.length === 1 && link.state === 'connecting');
  const waits = []; for (let i = 0; i < 14; i++) { sockets[sockets.length - 1].close(); waits.push(link.waitMs); advance(link.waitMs); }
  ok('the waits are 1 s, 2 s, 4 s, ... doubling', waits.slice(0, 6).join() === '1000,2000,4000,8000,16000,32000', waits.join());
  ok('they stop at ten minutes', Math.max(...waits) === 600000 && waits[13] === 600000, String(waits[13]));
  link.want(false); ok('want(false) stops it and closes what is open', link.state === 'idle' && !timers.some(t => t.live));
}
{ // the random half: with the least random number a wait is half the step
  sockets = []; timers = []; clock = 0; const { link } = make({}, 0);
  link.want(true); sockets[0].close(); ok('with the least random number the first wait is 500 ms', link.waitMs === 500, String(link.waitMs));
}
{ // a connection that stayed up 15 s starts again from the first wait; one that dropped after 2 s does not
  sockets = []; timers = []; clock = 0; const { link, ev } = make({}, 1);
  link.want(true); sockets[0].close(); advance(1000); sockets[1].close(); advance(2000);
  sockets[2].open(); advance(20000); sockets[2].close();
  ok('a connection that lived 20 s: the next wait is 1 s again', link.waitMs === 1000 && ev.close === 1, String(link.waitMs));
  advance(1000); sockets[3].open(); advance(2000); sockets[3].close();
  ok('one that dropped after 2 s: the wait goes on growing (2 s)', link.waitMs === 2000, String(link.waitMs));
}
{ // retryNow, frames, send
  sockets = []; timers = []; clock = 0; const { link, ev } = make({}, 1);
  link.want(true); sockets[0].close(); link.retryNow();
  ok('retryNow opens at once, without waiting', sockets.length === 2 && link.state === 'connecting');
  sockets[1].open(); sockets[1].onmessage({ data: new ArrayBuffer(3) }); sockets[1].onmessage({ data: 'text' });
  ok('a binary frame is passed on, a text frame is not', ev.frames.length === 1);
  ok('send goes while open', link.send(new Uint8Array([1])) === true && sockets[1].sent.length === 1);
  sockets[1].bufferedAmount = 1e6; ok('send does not pile up behind a slow socket', link.send(new Uint8Array([1])) === false);
}
{ // a handshake that never finishes is given up after 10 s; an empty address is never opened; a socket that throws counts as a failure
  sockets = []; timers = []; clock = 0; const { link } = make({}, 1);
  link.want(true); advance(10001); ok('a handshake that hangs is closed after 10 s and retried', sockets[0].readyState === 3 && link.fails === 1, String(link.fails));
  sockets = []; const e = make({ url: '' }); e.link.want(true); ok('an empty address opens nothing', sockets.length === 0);
  class Throws { constructor() { throw new Error('policy'); } }
  const t = make({ Socket: Throws }, 1); t.link.want(true); ok('a socket that cannot be made is a failure with a wait', t.link.state === 'wait' && t.link.fails === 1);
}
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
