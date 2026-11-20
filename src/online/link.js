// The one WebSocket to the relay, kept open while it is wanted. Nothing here knows the game or the protocol: bytes in, bytes out, and a reconnect that does not hammer.
// A relay that is down, full or past its daily allowance all look the same from a browser (the upgrade fails and the socket closes), and the answer is the same: wait, longer each time,
// at random so that a thousand pages that lost the relay together do not come back together. It says nothing to the player: onFail({ code, reason, wasOpen }) comes after every socket that failed or was closed
// by the relay, once per step of the backoff, and online.js asks the relay why (src/online/status.js).
//   const link = createLink({ url, onOpen, onFrame, onClose, onFail });
//   link.want(true)   open it (and reopen it when it drops); link.want(false) closes it and stops trying;   link.send(bytes) -> true if it went;   link.state: 'idle' | 'wait' | 'connecting' | 'open'
const BASE_MS = 1000, CAP_MS = 600000;   // the wait after the first failure, and the most: ten minutes (a relay over its allowance is asked about 6 times an hour by every page, not every second)
const STABLE_MS = 15000;                 // a connection that stayed up this long was a real one: the next failure starts again from BASE_MS
const CONNECT_MS = 10000;                // a handshake that has not finished by then is given up on
const MAX_BUFFERED = 32768;              // bytes waiting to leave: past this a frame is not sent (the next state is more use than this one)

// Socket, setTimer, clearTimer, random and now are parameters only so that tools/online/link-check.mjs can run this with no browser
export function createLink({ url, onOpen, onFrame, onClose, onFail = () => {}, Socket = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random, now = () => performance.now() }) {
  let ws = null, wanted = false, timer = null, fails = 0, openedAt = 0, state = 'idle', connectTimer = null, nextAt = 0;

  const clearTimers = () => { clearTimer(timer); clearTimer(connectTimer); timer = connectTimer = null; };
  function connect() {
    timer = null; if (!wanted || ws || !url) return;
    state = 'connecting';
    let s;
    try { s = new Socket(url); } catch (e) { onFail({}); failed(); return; }   // a bad address, or a page policy that refuses it
    ws = s; s.binaryType = 'arraybuffer';
    connectTimer = setTimer(() => { if (ws === s && state === 'connecting') { try { s.close(); } catch (e) { /* already closing */ } } }, CONNECT_MS);
    s.onopen = () => { if (ws !== s) return; clearTimer(connectTimer); connectTimer = null; state = 'open'; openedAt = now(); onOpen(); };
    s.onmessage = e => { if (ws === s && typeof e.data !== 'string') onFrame(e.data); };   // a text frame is not part of the protocol
    s.onerror = () => { /* the close that follows says it */ };
    s.onclose = e => { if (ws !== s) return; ws = null; clearTimers(); const wasOpen = state === 'open'; if (wasOpen && now() - openedAt >= STABLE_MS) fails = 0; if (wasOpen) onClose(); onFail({ code: e && e.code, reason: e && e.reason, wasOpen }); failed(); };
  }
  function failed() {
    ws = null; fails++;
    if (!wanted) { state = 'idle'; return; }
    state = 'wait';
    const wait = Math.min(CAP_MS, BASE_MS * 2 ** (fails - 1)) * (0.5 + random() * 0.5);   // half to all of the step: the spread is what keeps a crowd apart
    nextAt = now() + wait; timer = setTimer(connect, wait);
  }
  function want(on) {
    on = !!on; if (on === wanted) return;
    wanted = on;
    if (on) { if (!ws && !timer) connect(); return; }
    clearTimers(); fails = 0; state = 'idle';
    const s = ws; ws = null; if (s) { s.onclose = s.onmessage = s.onopen = null; try { s.close(1000); } catch (e) { /* already closing */ } onClose(); }
  }
  // the browser says the network is back: try now instead of at the end of the wait
  function retryNow() { if (wanted && !ws && state === 'wait') { clearTimer(timer); fails = 0; connect(); } }
  function send(bytes) {
    if (state !== 'open' || !ws || ws.readyState !== 1 || ws.bufferedAmount > MAX_BUFFERED) return false;
    try { ws.send(bytes); return true; } catch (e) { return false; }
  }
  return { want, send, retryNow, get state() { return state; }, get fails() { return fails; }, get waitMs() { return state === 'wait' ? Math.max(0, nextAt - now()) : 0; } };
}
