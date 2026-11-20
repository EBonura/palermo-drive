// The one WebSocket to the relay, kept open while it is wanted. Nothing here knows the game or the protocol: bytes in, bytes out, and a reconnect that does not hammer.
// A relay that is down, full or past its daily allowance all look the same from a browser (the upgrade fails and the socket closes), and every request to it comes out of one free daily allowance shared by all players,
// so a page that cannot get in gives up politely instead of asking for ever. The first TRIES attempts come after 1 s, 2 s, 4 s ... (each wait cut at random to between half and all of its step, so a thousand pages that
// lost the relay together do not come back together). After that the link is STOPPED: it tries again only when the player asks, once in each hour at a random moment of it, and when the browser says the network is back
// or the page is visible again after a long while (those two at most once in NUDGE_MS). A reason that lasts until midnight UTC (the daily allowance: online.js says so with daily()) stops it until then plus a random
// few minutes, and only the player's own ask goes through. A connection that stayed up STABLE_MS starts everything again. It says nothing to the player: onFail({ code, reason, wasOpen, asked }) comes after every
// socket that failed or was closed by the relay, once per attempt, and online.js asks the relay why (src/online/status.js).
//   const link = createLink({ url, onOpen, onFrame, onClose, onFail });
//   link.want(true)   open it (and reopen it when it drops); link.want(false) closes it and stops trying;   link.send(bytes) -> true if it went;   link.state: 'idle' | 'wait' | 'connecting' | 'open'
//   link.ask()        the player asked for online: one attempt now, whatever the state;   link.retryNow()   the network is back, or the page is visible again after a while: one attempt now, if not too soon
//   link.daily(true)  the reason lasts until 00:00 UTC (false: it does not);   link.stopped: waiting for the hour or for midnight, not for the next step of the first attempts
const BASE_MS = 1000;                    // the wait after the first failure, doubling
const TRIES = 6;                         // failed attempts in a row after which the link stops retrying on its own timer (1 s + 2 s + 4 s + 8 s + 16 s of waiting: about half a minute)
const STABLE_MS = 15000;                 // a connection that stayed up this long was a real one: everything starts again from the first attempt
const CONNECT_MS = 10000;                // a handshake that has not finished by then is given up on
const MAX_BUFFERED = 32768;              // bytes waiting to leave: past this a frame is not sent (the next state is more use than this one)
const HOUR_MS = 3600000;                 // once stopped there is one attempt in each hour, at a random moment of it
const NUDGE_MS = 600000;                 // "the network is back" and "the page is visible again" are heard at most this often
const DAY_MS = 86400000, SPREAD_MS = 600000;   // a daily reason waits for 00:00 UTC and then a random 0 to 10 minutes, so a crowd does not come back in the same second
const dayOf = t => Math.floor(t / DAY_MS);     // the UTC day of a time in ms

// Socket, setTimer, clearTimer, random, now and wall are parameters only so that tools/online/link-check.mjs can run this with no browser (now is the page's clock, wall the calendar's)
export function createLink({ url, onOpen, onFrame, onClose, onFail = () => {}, Socket = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random, now = () => performance.now(), wall = () => Date.now() }) {
  let ws = null, wanted = false, timer = null, fails = 0, openedAt = 0, state = 'idle', connectTimer = null, nextAt = 0;
  let mode = 'backoff';                   // what the wait in progress is for: 'backoff' (the next step), 'hour' (the next of the hourly attempts) or 'day' (midnight UTC)
  let stoppedAt = -1, doneSlot = -1, pick = null;   // the hours are counted from when it stopped; doneSlot is the hour that has had its attempt; pick is the random moment chosen for an hour
  let dailyDay = -1;                      // the UTC day for which a daily reason is known
  let lastNudge = -1e12, askNext = false, nudgeNext = false, asked = false;   // askNext and nudgeNext: said while nothing was wanted, used when it is

  const clearTimers = () => { clearTimer(timer); clearTimer(connectTimer); timer = connectTimer = null; };
  const dailyNow = () => dailyDay === dayOf(wall());
  const slotNow = () => Math.floor((now() - stoppedAt) / HOUR_MS);
  const reset = () => { fails = 0; stoppedAt = -1; doneSlot = -1; pick = null; };
  function connect() {
    timer = null; if (!wanted || ws || !url) return;
    const byPlayer = asked; asked = false;
    if (stoppedAt >= 0) doneSlot = slotNow();   // an attempt of any kind uses up its hour
    state = 'connecting';
    let s;
    try { s = new Socket(url); } catch (e) { onFail({ asked: byPlayer }); failed(); return; }   // a bad address, or a page policy that refuses it
    ws = s; s.binaryType = 'arraybuffer';
    connectTimer = setTimer(() => { if (ws === s && state === 'connecting') { try { s.close(); } catch (e) { /* already closing */ } } }, CONNECT_MS);
    s.onopen = () => { if (ws !== s) return; clearTimer(connectTimer); connectTimer = null; state = 'open'; openedAt = now(); dailyDay = -1; onOpen(); };
    s.onmessage = e => { if (ws === s && typeof e.data !== 'string') onFrame(e.data); };   // a text frame is not part of the protocol
    s.onerror = () => { /* the close that follows says it */ };
    s.onclose = e => { if (ws !== s) return; ws = null; clearTimers(); const wasOpen = state === 'open'; if (wasOpen && now() - openedAt >= STABLE_MS) reset(); if (wasOpen) onClose(); onFail({ code: e && e.code, reason: e && e.reason, wasOpen, asked: byPlayer }); failed(); };
  }
  function failed() {
    ws = null; fails++;
    if (!wanted) { state = 'idle'; return; }
    if (fails >= TRIES && stoppedAt < 0) stoppedAt = now();
    schedule();
  }
  // when the next attempt is, by the rules above
  function schedule() {
    state = 'wait'; clearTimer(timer);
    let wait;
    if (dailyNow()) { mode = 'day'; const t = wall(); wait = (dayOf(t) + 1) * DAY_MS - t + random() * SPREAD_MS; }
    else if (stoppedAt >= 0) {
      mode = 'hour'; const k = Math.max(slotNow(), doneSlot + 1);   // this hour's attempt, or the next hour's if this one has had it
      if (!pick || pick.k !== k) pick = { k, r: random() };
      wait = Math.max(0, stoppedAt + (k + pick.r) * HOUR_MS - now());
    } else { mode = 'backoff'; wait = BASE_MS * 2 ** (fails - 1) * (0.5 + random() * 0.5); }   // half to all of the step: the spread is what keeps a crowd apart
    nextAt = now() + wait; timer = setTimer(connect, wait);
  }
  function want(on) {
    on = !!on; if (on === wanted) return;
    wanted = on;
    if (on) {
      if (ws || timer) return;
      if (askNext) { askNext = false; asked = true; connect(); return; }
      if (nudgeNext) { nudgeNext = false; if (!dailyNow() && now() - lastNudge >= NUDGE_MS) { lastNudge = now(); connect(); return; } }
      if (stoppedAt >= 0 || dailyNow()) schedule(); else connect();   // stopped stays stopped: a game that is paused and played again is not a new ask
      return;
    }
    const stable = state === 'open' && now() - openedAt >= STABLE_MS;
    clearTimers(); state = 'idle'; askNext = false; if (stable) reset();
    const s = ws; ws = null; if (s) { s.onclose = s.onmessage = s.onopen = null; try { s.close(1000); } catch (e) { /* already closing */ } onClose(); }
  }
  // the player asked for online (the card, or the switch in Options): one attempt now, whatever the state. If it fails the link is where it was.
  function ask() {
    if (!wanted) { askNext = true; return; }
    if (ws) return;
    clearTimer(timer); asked = true; connect();
  }
  // the browser says the network is back, or the page is visible again after a long while: try now instead of at the end of the wait, but not when it was just done, and not for a daily reason
  function retryNow() {
    if (now() - lastNudge < NUDGE_MS) return;
    if (!wanted) { nudgeNext = true; return; }
    if (ws || state !== 'wait' || dailyNow()) return;
    lastNudge = now(); clearTimer(timer); connect();
  }
  // online.js knows why it failed: a reason that lasts until midnight UTC means no attempts until then
  function daily(on) {
    dailyDay = on ? dayOf(wall()) : -1;
    if (wanted && !ws && state === 'wait' && (on || mode === 'day')) schedule();
  }
  function send(bytes) {
    if (state !== 'open' || !ws || ws.readyState !== 1 || ws.bufferedAmount > MAX_BUFFERED) return false;
    try { ws.send(bytes); return true; } catch (e) { return false; }
  }
  return { want, send, ask, retryNow, daily, get state() { return state; }, get fails() { return fails; }, get stopped() { return state === 'wait' && mode !== 'backoff'; }, get waitMs() { return state === 'wait' ? Math.max(0, nextAt - now()) : 0; } };
}
