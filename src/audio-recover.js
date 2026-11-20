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
// Contexts made ahead of the first tap (prewarmAudio below). Opening the audio device is the dear part of `new AudioContext()` (about 200 ms for the first one on a
// desktop, more on a phone), and every module made its context inside the first tap's event handler, so the player's first tap was one long frame. A context made
// without a tap starts suspended; the module that asks for one is given a spare (a constructor with no arguments, as every module here calls it) and it is resumed
// at once, which is what a context made inside the tap would have done by itself. Spares are not tracked until they are handed out, so the taps do not resume them.
const spares = [];
let Plain = null;
for (const name of ['AudioContext', 'webkitAudioContext']) {
  const Base = window[name];
  if (!Base || Base.__pdTracked) continue;
  Plain = Plain || Base;
  const Tracked = class extends Base {
    constructor(...args) {
      if (!args.length && spares.length) {
        const c = spares.pop(); track(c);
        try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* closed meanwhile */ }
        return c;
      }
      super(...args); track(this);
    }
  };
  Tracked.__pdTracked = true;
  window[name] = Tracked;
}

// Raises the number of spare contexts to `n`, making them one at a time with a pause between (each is a long task by itself), when the browser is idle.
let want = 0, making = false;
export function prewarmAudio(n, gap = 300, timeout = 1000) {
  if (!Plain) return;
  want = Math.max(want, n);
  if (making) return;
  making = true;
  const next = () => {
    if (spares.length >= want || document.hidden) { making = false; return; }
    try { spares.push(new Plain()); } catch (e) { making = false; return; }   // (a browser that refuses one: the modules make their own, as before)
    setTimeout(() => (window.requestIdleCallback || setTimeout)(next, { timeout }), gap);
  };
  (window.requestIdleCallback || setTimeout)(next, { timeout });
}
export const spareAudioContexts = () => spares.length;

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
