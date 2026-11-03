// Brings the game's sound back after the page was in the background (a phone: app switch, lock screen, a call, the pinned web app going away and coming back).
// Phones suspend every AudioContext when the page hides (iOS also reports 'interrupted') and pause <audio> elements, and a resume() that is refused leaves the
// game silent until something tries again. The game has about a dozen contexts (vehicle, radio, siren, traffic, horns, sea, rave, pubs, ...) each created by its own
// module, so this file wraps AudioContext once, keeps a list of every context ever made, and on every sign of life (page visible again, pageshow, focus, the next tap
// or key press) resumes the ones that are not running. A refused resume is retried a few times, and any 'statechange' away from running while the page is visible
// is retried too. Modules with <audio> elements register a hook (onAudioRecover) to restart what they had playing. Import this before anything makes a context.
const ctxs = new Set(), hooks = new Set();

function track(c) {
  ctxs.add(c);
  c.addEventListener('statechange', () => {
    if (c.state === 'closed') ctxs.delete(c);
    else if (c.state !== 'running' && !document.hidden) retrySoon();   // 'suspended' by the system or 'interrupted' (iOS): ask again
  });
}
for (const name of ['AudioContext', 'webkitAudioContext']) {
  const Base = window[name];
  if (!Base || Base.__pdTracked) continue;
  const Tracked = class extends Base { constructor(...args) { super(...args); track(this); } };
  Tracked.__pdTracked = true;
  window[name] = Tracked;
}

function notRunning() { for (const c of ctxs) if (c.state !== 'running' && c.state !== 'closed') return true; return false; }
function kick() {
  for (const c of ctxs) {
    if (c.state === 'running' || c.state === 'closed') continue;
    try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* closed meanwhile */ }
  }
}
function runHooks(why) { for (const h of hooks) { try { h(why); } catch (e) { /* one module's trouble must not stop the others */ } } }

let timer = 0, tries = 0;
function retrySoon() {
  if (timer || tries >= 6) return;
  timer = setTimeout(() => {   // a resume() the system has not allowed yet: a few more tries, then the next tap does it
    timer = 0; tries++;
    if (document.hidden) return;
    kick();
    if (notRunning()) retrySoon();
  }, 400);
}
function recover(why) {
  if (document.hidden) return;
  tries = 0;
  kick(); runHooks(why);
  if (notRunning()) retrySoon();
}

// The page coming back: visible, restored from the back/forward cache, window focus, unfrozen. The taps: the first one after returning always tries again
// (pointerup, touchend and click count as user activation on a phone, pointerdown and touchstart do not, so all are listened to). Added once, never removed.
for (const [target, ev] of [[document, 'visibilitychange'], [window, 'pageshow'], [window, 'focus'], [document, 'resume']]) target.addEventListener(ev, () => recover(ev === 'visibilitychange' || ev === 'pageshow' || ev === 'resume' ? 'return' : ev));
for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => recover('gesture'), { capture: true, passive: true });

// A module with its own <audio> element or other state to put back registers here: fn(why) with why 'return' (the page is visible again), 'focus' or 'gesture'.
// Returns the function that removes it again.
export function onAudioRecover(fn) { hooks.add(fn); return () => hooks.delete(fn); }
// For tests and the debug console: every context the game has made, and a manual recover.
export const audioContexts = () => [...ctxs];
export const recoverAudio = () => recover('return');
