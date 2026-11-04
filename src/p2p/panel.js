// The multiplayer section on the street: one dark capsule bottom left (the HUD zone "social", src/hud.js) that says how many players are connected and how many of them are
// close enough to hear you, with the talk button that opens the wheel (src/p2p/wheel.js). Above it, the last few things said, each line as: name said "phrase", fading after a few seconds.
// It exists only while the player is online (the owner of the page calls set({ show })), so solo mode has no trace of it in the page's picture.
// Names come from other players: every word here is set with textContent, never as HTML.
//   const panel = createPanel({ zone, onTalk });
//   panel.set({ show, title, sub, label, key, idle, open });   (strings are made by the page, in the language shown)
//   panel.line(name, verb, text, mine);   panel.clear();   panel.talk is the button
const LINE_MS = 7000, FADE_MS = 900, MAX_LINES = 3;
const CSS = `
.mpx { display: none; flex-direction: column; align-items: flex-start; gap: 6px; max-width: 100%; }
.mpx.on { display: flex; }
.mpx-feed { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: min(240px, 44vw); pointer-events: none; }
.mpx-line { box-sizing: border-box; max-width: 100%; padding: 4px 10px 4px 8px; border-radius: 12px; border-left: 3px solid #e8559a; background: rgba(13,7,10,.8); box-shadow: 0 2px 10px rgba(0,0,0,.3);
  color: #fff; font: 600 13px/1.25 var(--pd-sans, system-ui, sans-serif); overflow-wrap: anywhere; transition: opacity ${FADE_MS}ms ease; }
.mpx-line.mine { border-left-color: rgba(255,255,255,.55); }
.mpx-line.old { opacity: 0; }
.mpx-n { display: inline-block; max-width: 8.5em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; color: #ff6fae; font-weight: 700; unicode-bidi: isolate; }   /* a long name gives way, the words stay */
.mpx-line.mine .mpx-n { color: #fff; }
.mpx-v { opacity: .72; font-weight: 500; }
.mpx-cap { display: flex; align-items: center; gap: 8px; height: 40px; box-sizing: border-box; padding: 0 3px 0 12px; border-radius: 20px; background: rgba(13,7,10,.8); box-shadow: 0 2px 10px rgba(0,0,0,.3); color: #fff; pointer-events: none; }
.mpx-ring { flex: none; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; border: 2.5px solid #00e1ff; }
.mpx-txt { display: flex; flex-direction: column; justify-content: center; min-width: 0; font: 700 14px/1.1 var(--pd-cond, system-ui, sans-serif); letter-spacing: .03em; white-space: nowrap; }
.mpx-txt small { margin-top: 1px; font: 600 10.5px/1.1 var(--pd-cond, system-ui, sans-serif); letter-spacing: .06em; opacity: .72; }
.mpx-talk { margin-left: 2px; pointer-events: auto; }
.mpx-talk.idle { opacity: .55; }
.mpx-talk[aria-expanded=true] { background: #e8559a; color: #0d0709; }
.mpx-key { display: none; flex: none; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,.16); font: 700 11px/1.3 system-ui, sans-serif; }
html:not(.touch) .mpx-key { display: block; }
@media (max-width: 720px) { .mpx.wheel .mpx-feed { opacity: 0; } }   /* the ring of the wheel reaches this far left on a small screen */
@media (max-height: 460px) { .mpx-feed > :nth-last-child(n+3) { display: none; } .mpx, .mpx-feed { gap: 3px; } .mpx-line { padding-top: 3px; padding-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }   /* a short screen has room for two single lines, under the mission card and its messages */
@media (prefers-reduced-motion: reduce) { .mpx-line { transition: none; } }
`;
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';

export function createPanel({ zone, onTalk }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const root = el('div', 'mpx pd-p2p'); root.setAttribute('role', 'group');   // pd-p2p: hidden in the Garage by the page rule in src/p2p/p2p.js
  const feed = el('div', 'mpx-feed'); feed.setAttribute('role', 'log'); feed.setAttribute('aria-live', 'polite');
  const cap = el('div', 'mpx-cap'), ring = el('span', 'mpx-ring'), txt = el('div', 'mpx-txt'), t1 = el('span'), t2 = el('small');
  txt.append(t1, t2);
  const talk = el('button', 'pd-bbtn mpx-talk'); talk.type = 'button'; talk.innerHTML = ICON; talk.setAttribute('aria-haspopup', 'true'); talk.setAttribute('aria-expanded', 'false');
  const key = el('span', 'mpx-key', 'T'); key.setAttribute('aria-hidden', 'true');
  cap.append(ring, txt, key, talk); root.append(feed, cap);
  (zone || document.body).appendChild(root);
  talk.addEventListener('click', () => { talk.blur(); onTalk(); });   // blur: the arrow keys go on driving
  const timers = new Set();
  let last = '';
  function set(s) {
    root.classList.toggle('on', !!s.show);
    const sig = [s.title, s.sub, s.label, s.idle, s.open].join('|');
    if (sig !== last) {
      last = sig; t1.textContent = s.title; t2.textContent = s.sub; talk.title = s.label; talk.setAttribute('aria-label', s.label); root.setAttribute('aria-label', s.title + ', ' + s.sub);
      talk.classList.toggle('idle', !!s.idle); talk.setAttribute('aria-expanded', String(!!s.open)); root.classList.toggle('wheel', !!s.open);
    }
  }
  function drop(l) { l.remove(); }
  function line(name, verb, text, mine) {
    const l = el('div', 'mpx-line' + (mine ? ' mine' : ''));
    l.append(el('span', 'mpx-n', name), document.createTextNode(' '), el('span', 'mpx-v', verb), document.createTextNode(' “' + text + '”'));
    feed.appendChild(l);
    while (feed.children.length > MAX_LINES) drop(feed.firstElementChild);
    const a = setTimeout(() => { l.classList.add('old'); const b = setTimeout(() => { drop(l); timers.delete(b); }, FADE_MS); timers.add(b); timers.delete(a); }, LINE_MS);
    timers.add(a);
  }
  function clear() { for (const t of timers) clearTimeout(t); timers.clear(); feed.textContent = ''; }
  return { root, talk, set, line, clear, get lines() { return [...feed.children].map(l => l.textContent); } };
}
