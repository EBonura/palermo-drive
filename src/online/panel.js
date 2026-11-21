// The multiplayer section on the street: one dark capsule bottom left (the HUD zone "social", src/hud.js) that says how many players are connected and how many of them are
// close enough to hear you, with the talk button that opens the wheel (src/p2p/wheel.js). Above it, the last few things said, each line as: name said "phrase", fading after a few seconds.
// It exists only while the player is online (the owner of the page calls set({ show })), so solo mode has no trace of it in the page's picture.
// Names come from other players: every word here is set with textContent, never as HTML.
//   const panel = createPanel({ zone, onTalk });
//   panel.set({ show, title, sub, label, key, idle, open, tone, msg });   (strings are made by the page, in the language shown; tone: '' connected, or 'wait' | 'full' | 'done' | 'off' for the colour of the capsule when there is nobody to talk to, and msg the sentence that says why)
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
.mpx-msg { display: none; box-sizing: border-box; max-width: min(300px, 60vw); padding: 6px 10px 6px 8px; border-radius: 12px; border-left: 3px solid var(--mpx-tone, #8a949a); background: rgba(13,7,10,.88); box-shadow: 0 2px 10px rgba(0,0,0,.3);
  color: #fff; font: 600 12.5px/1.3 var(--pd-sans, system-ui, sans-serif); pointer-events: none; }
.mpx-msg.on { display: block; }
.mpx.t-wait { --mpx-tone: #8a949a; } .mpx.t-full { --mpx-tone: #ffb020; } .mpx.t-done { --mpx-tone: #ff5a5a; } .mpx.t-off { --mpx-tone: #b5a0ff; }   /* waiting: grey, relay full: amber, finished for today: red, cannot reach it: violet */
.mpx.t-wait .mpx-ring { border-color: rgba(138,148,154,.8); border-style: dotted; }
.mpx.t-full .mpx-ring, .mpx.t-done .mpx-ring, .mpx.t-off .mpx-ring { background: var(--mpx-tone); border-color: var(--mpx-tone); }
.mpx.t-wait .mpx-talk, .mpx.t-full .mpx-talk, .mpx.t-done .mpx-talk, .mpx.t-off .mpx-talk, .mpx.t-wait .mpx-key, .mpx.t-full .mpx-key, .mpx.t-done .mpx-key, .mpx.t-off .mpx-key { display: none; }   /* nobody to talk to */
.mpx.t-wait .mpx-cap, .mpx.t-full .mpx-cap, .mpx.t-done .mpx-cap, .mpx.t-off .mpx-cap { padding-right: 12px; }
@media (max-height: 460px) { .mpx-msg { max-width: min(300px, 46vw); padding: 4px 8px 4px 7px; font-size: 12px; line-height: 1.25; } }
.mpx-talk { margin-left: 2px; pointer-events: auto; touch-action: manipulation; }
.mpx-talk::before { inset: -8px !important; }   /* a bigger target for a thumb */
.mpx-talk.idle { opacity: .55; }
.mpx-talk[aria-expanded=true] { background: #e8559a; color: #0d0709; }
.mpx-key { display: none; flex: none; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,.16); font: 700 11px/1.3 system-ui, sans-serif; }
html:not(.touch) .mpx-key { display: block; }
@media (max-width: 720px) { .mpx.wheel .mpx-feed { opacity: 0; } }   /* the ring of the wheel reaches this far left on a small screen */
@media (max-height: 460px) { .mpx-feed > :nth-last-child(n+3) { display: none; } .mpx, .mpx-feed { gap: 3px; } .mpx-line { padding-top: 3px; padding-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }   /* a short screen has room for two single lines, under the mission card and its messages */
@media (prefers-reduced-motion: reduce) { .mpx-line { transition: none; } }
.mpx-cap { pointer-events: auto; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }   /* manipulation: no wait for a double tap */
.mpx-list, .mpx-go { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.mpx-chev { flex: none; width: 14px; height: 14px; margin-left: -2px; opacity: .6; transition: transform .15s ease; }
.mpx.list .mpx-chev { transform: rotate(180deg); }
.mpx-list { display: none; box-sizing: border-box; width: min(300px, 46vw); max-height: min(330px, calc(100vh - 150px)); overflow: auto; padding: 6px; border-radius: 14px; background: rgba(13,7,10,.92);
  box-shadow: 0 8px 24px rgba(0,0,0,.45), inset 0 0 0 1px rgba(245,169,201,.22); color: #fff; pointer-events: auto; overscroll-behavior: contain; }
.mpx.list .mpx-list { display: block; }
.mpx-lh { padding: 2px 6px 6px; font: 700 12px/1.2 var(--pd-cond, system-ui, sans-serif); letter-spacing: .1em; text-transform: uppercase; opacity: .8; }
.mpx-le { padding: 8px; font: 500 12px/1.3 var(--pd-sans, system-ui, sans-serif); opacity: .75; }
.mpx-r { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 8px; }
.mpx-r + .mpx-r { border-top: 1px solid rgba(255,255,255,.07); }
.mpx-rt { flex: 1; min-width: 0; }
.mpx-rn { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.mpx-rn b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 14px/1.15 var(--pd-cond, system-ui, sans-serif); letter-spacing: .03em; color: #ff6fae; unicode-bidi: isolate; }
.mpx-rn small { flex: none; font: 500 10.5px/1.2 var(--pd-sans, system-ui, sans-serif); opacity: .6; }
.mpx-rl { margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 11px/1.25 var(--pd-sans, system-ui, sans-serif); opacity: .85; }
.mpx-rl .near { color: #00e1ff; font-weight: 700; }
.mpx-go { flex: none; height: 26px; padding: 0 10px; border: 0; border-radius: 13px; background: linear-gradient(90deg, #e8559a, #f5a9c9); color: #1a0b12; font: 700 11px/26px var(--pd-cond, system-ui, sans-serif); letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
.mpx-go.near { background: #00c8f0; color: #04161c; }   /* Segui: the blue of the way on the map */
.mpx-go.fol { background: none; box-shadow: inset 0 0 0 1.5px #00c8f0; color: #00e1ff; }   /* Smetti */
.mpx-go:disabled { background: rgba(255,255,255,.1); color: rgba(255,255,255,.5); cursor: default; }
@media (max-height: 460px) { .mpx-list { max-height: calc(100vh - 120px); } .mpx-r { padding-top: 4px; padding-bottom: 4px; } }
`;
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';

export function createPanel({ zone, onTalk, onList, onGo }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const root = el('div', 'mpx pd-p2p'); root.setAttribute('role', 'group');   // pd-p2p: hidden in the Garage by the page rule in src/p2p/p2p.js
  const feed = el('div', 'mpx-feed'); feed.setAttribute('role', 'log'); feed.setAttribute('aria-live', 'polite');
  const cap = el('div', 'mpx-cap'), ring = el('span', 'mpx-ring'), txt = el('div', 'mpx-txt'), t1 = el('span'), t2 = el('small');
  txt.append(t1, t2);
  const talk = el('button', 'pd-bbtn mpx-talk'); talk.type = 'button'; talk.innerHTML = ICON; talk.setAttribute('aria-haspopup', 'true'); talk.setAttribute('aria-expanded', 'false');
  const key = el('span', 'mpx-key', 'T'); key.setAttribute('aria-hidden', 'true');
  const msg = el('div', 'mpx-msg'); msg.setAttribute('role', 'status');   // the sentence that says why there is nobody (relay full, over for today, cannot be reached)
  const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); chev.setAttribute('viewBox', '0 0 24 24'); chev.setAttribute('class', 'mpx-chev'); chev.innerHTML = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>';
  const list = el('div', 'mpx-list'); list.setAttribute('role', 'list');
  cap.append(ring, txt, chev, key, talk); root.append(feed, msg, cap, list);
  (zone || document.body).appendChild(root);
  // Taps act on the press, not on the click: a phone's click waits for the finger to lift without moving, and a thumb on the move while driving often fails that,
  // so the talk button, the capsule and the list's buttons took two or three tries. A mouse or the keyboard still uses click (Enter, Space).
  const press = (elx, fn, only) => {   // only(e): the press counts only on these targets (the list scrolls under a finger anywhere else)
    let at = 0;
    elx.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.button > 0 || (only && !only(e))) return; e.preventDefault(); e.stopPropagation(); at = performance.now(); fn(e); });
    elx.addEventListener('click', e => { if (performance.now() - at < 800) { e.preventDefault(); return; } fn(e); });
  };
  press(talk, e => { e.stopPropagation?.(); talk.blur(); onTalk(); });   // blur: the arrow keys go on driving
  press(cap, e => { if (talk.contains(e.target)) return; onList?.(); });   // the capsule opens the list of everybody online (the talk button keeps its own job)
  press(list, e => { const b = e.target.closest('.mpx-go'); if (b && !b.disabled) onGo?.(+b.dataset.h); }, e => !!e.target.closest('.mpx-go'));
  const timers = new Set();
  let last = '';
  function set(s) {
    root.classList.toggle('on', !!s.show);
    const sig = [s.title, s.sub, s.label, s.idle, s.open, s.tone, s.msg].join('|');
    if (sig !== last) {
      last = sig; msg.textContent = s.msg || ''; msg.classList.toggle('on', !!s.msg);
      root.className = root.className.replace(/ t-\w+/g, '') + (s.tone ? ' t-' + s.tone : ''); t1.textContent = s.title; t2.textContent = s.sub; talk.title = s.label; talk.setAttribute('aria-label', s.label); root.setAttribute('aria-label', s.title + ', ' + s.sub);
      talk.classList.toggle('idle', !!s.idle); talk.setAttribute('aria-expanded', String(!!s.open)); root.classList.toggle('wheel', !!s.open);
    }
  }
  // the list: { open, head, empty, rows: [{ h, name, veh, place, dist, near, go, goLabel }] }, every word from another player set as text
  // The rows are kept and only their words change: rebuilding them four times a second while players move swallowed a tap that fell between a press and its release.
  let listSig = '';
  const head = el('div', 'mpx-lh'), emptyEl = el('div', 'mpx-le'), rowsBy = new Map();
  list.append(head, emptyEl);
  function rowFor(h) {
    let r = rowsBy.get(h); if (r) return r;
    const row = el('div', 'mpx-r'), t = el('div', 'mpx-rt'), n = el('div', 'mpx-rn'), l = el('div', 'mpx-rl'), name = el('b'), veh = el('small'), place = el('span'), dist = el('span'), b = el('button', 'mpx-go');
    row.setAttribute('role', 'listitem'); b.type = 'button'; b.dataset.h = h;
    n.append(name, veh); l.append(place, document.createTextNode(' · '), dist); t.append(n, l); row.append(t, b);
    r = { row, name, veh, place, dist, b }; rowsBy.set(h, r); return r;
  }
  function setList(L) {
    root.classList.toggle('list', !!L.open);
    if (!L.open) { listSig = ''; return; }
    const sig = JSON.stringify(L); if (sig === listSig) return; listSig = sig;
    head.textContent = L.head; emptyEl.textContent = L.empty; emptyEl.hidden = L.rows.length > 0;
    const keep = new Set();
    L.rows.forEach((d, i) => {
      const r = rowFor(d.h); keep.add(d.h);
      if (r.name.textContent !== d.name) r.name.textContent = d.name;
      if (r.veh.textContent !== d.veh) r.veh.textContent = d.veh;
      if (r.place.textContent !== d.place) r.place.textContent = d.place;
      if (r.dist.textContent !== d.dist) r.dist.textContent = d.dist;
      r.dist.className = d.near ? 'near' : '';
      if (r.b.textContent !== d.goLabel) r.b.textContent = d.goLabel;
      r.b.className = 'mpx-go' + (d.fol ? ' fol' : d.near ? ' near' : ''); r.b.disabled = !d.go;
      if (list.children[i + 2] !== r.row) list.insertBefore(r.row, list.children[i + 2] || null);   // in order, moved only when the order changed
    });
    for (const [h, r] of rowsBy) if (!keep.has(h)) { r.row.remove(); rowsBy.delete(h); }
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
  return { root, talk, set, setList, line, clear, get lines() { return [...feed.children].map(l => l.textContent); } };
}
