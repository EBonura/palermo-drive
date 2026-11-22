// A game controller, everywhere: driving, the menus, the map picker, the Garage, the list of players and the talk wheel (Gamepad API, standard mapping).
//   setupGamepad({ game })   called once, after setupUI (src/main.js)
// The pad does not have a second set of controls: it presses the keys of the keyboard (a KeyboardEvent on the window), so that every screen that
// answers a key answers the pad too, and a new key later reaches the pad for free. Held keys (gas, steering, handbrake, horn, nitro, fly) are held as
// long as the button is. The few screens that are not driven by keys (the list of players, the talk wheel, the name card) get a small mover here.
//
// Driving                          Menus and screens                    Talk wheel / list / cards
//   left stick, steer               stick or d-pad  move                 stick or d-pad  choose (wheel), move (list, card)
//   RT or A       gas               A  confirm      B  back              A confirm, B back
//   LT            brake, reverse    Start  close the menu                offer card: A accept, B refuse
//   X handbrake  B horn             Y  map or list (the picker)          arrival card: A yes, B no
//   RB nitro     Y fly              X  events on the map
//   LB camera    Select big map     LB / RB  previous / next pin
//   Start menu   L3 reset car       LT / RT or right stick  zoom the map
//   R3 players   d-pad up talk
//   d-pad down drink, left radio on or off, right next song
// The first press of a button on a page is what makes the browser announce a pad ('gamepadconnected'): the popup says so, and says so again when it goes.
import { T } from './lang.js';

const root = document.documentElement;
const KEYNAME = { Enter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab', Space: ' ', Equal: '=', Minus: '-', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ShiftLeft: 'Shift' };
const keyName = code => KEYNAME[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code);
const fire = (type, code, shift = false) => dispatchEvent(new KeyboardEvent(type, { code, key: keyName(code), shiftKey: shift, bubbles: true, cancelable: true }));
const heldKeys = new Set();
function hold(code, on) { if (on === heldKeys.has(code)) return; if (on) heldKeys.add(code); else heldKeys.delete(code); fire(on ? 'keydown' : 'keyup', code); }
function tap(code, shift = false) { fire('keydown', code, shift); fire('keyup', code, shift); }
function releaseAll() { for (const c of [...heldKeys]) hold(c, false); }

const CSS = `
.pd-gp-pop { position: fixed; left: 50%; top: max(14px, env(safe-area-inset-top)); transform: translate(-50%, -14px); z-index: 700; display: flex; align-items: center; gap: 10px; box-sizing: border-box; max-width: calc(100vw - 24px);
  padding: 9px 18px 9px 12px; border-radius: 99px; background: rgba(13,7,10,.94); box-shadow: 0 8px 24px rgba(0,0,0,.45), inset 0 0 0 1.5px rgba(245,169,201,.55); color: #fff; opacity: 0; pointer-events: none;
  font: 700 15px/1.2 var(--pd-cond, system-ui, sans-serif); letter-spacing: .02em; transition: opacity .25s ease, transform .25s ease; }
.pd-gp-pop.on { opacity: 1; transform: translate(-50%, 0); }
.pd-gp-pop svg { flex: none; width: 28px; height: 28px; fill: none; stroke: #ff6fae; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.pd-gp-pop.off svg { stroke: #9a8b92; }
.pd-gp-pop small { display: block; margin-top: 1px; font: 500 11px/1.2 var(--pd-sans, system-ui, sans-serif); letter-spacing: 0; opacity: .72; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }
html.pd-gp .tc { display: none !important; }
.mpx-go:focus { outline: 2px solid #fff; outline-offset: 2px; }
[aria-modal="true"] button:focus, [aria-modal="true"] input:focus { outline: 3px solid #fff; outline-offset: 2px; }
.pd-p2p g[role=menuitem].gp-sel path { fill: rgba(232,85,154,.6) !important; stroke: #fff !important; }
@media (prefers-reduced-motion: reduce) { .pd-gp-pop { transition: none; } }
`;
const ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9.5 9h13a5 5 0 0 1 4.9 4l1.5 8a3.2 3.2 0 0 1-5.6 2.4L20 20.5h-8L8.2 23.4A3.2 3.2 0 0 1 2.6 21l1.5-8a5 5 0 0 1 4.9-4z"/><path d="M9 13v4M7 15h4"/><circle cx="21" cy="13.5" r=".8"/><circle cx="23.5" cy="16" r=".8"/></svg>';

export function setupGamepad({ game }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);

  // ---- the popup: a pad came, a pad went ----
  // Wording to be corrected by the owner (Palermitan).
  const TXT = {
    on: [['Manetta attaccata', 'Controller connected'], ['Ora si guida cu a manetta', 'Drive with the controller']],
    off: [['Manetta staccata', 'Controller disconnected'], ['Ripigghia a tastiera o u tocco', 'Back to keyboard or touch']],
  };
  const pop = document.createElement('div'); pop.className = 'pd-gp-pop'; pop.setAttribute('role', 'status'); pop.setAttribute('aria-live', 'polite');
  const popT = document.createElement('div'); pop.innerHTML = ICON; pop.append(popT);
  document.body.appendChild(pop);
  let popTimer = 0;
  const shortName = gp => String(gp.id || '').replace(/\s*\(.*$/, '').replace(/\s*Vendor:.*$/i, '').trim();
  function say(kind, gp) {
    const [a, b] = TXT[kind], li = T(0, 1);
    popT.textContent = '';
    popT.append(document.createTextNode(a[li]));
    const sm = document.createElement('small'); sm.textContent = kind === 'on' && shortName(gp) ? shortName(gp) : b[li]; popT.append(sm);
    pop.classList.toggle('off', kind === 'off'); pop.classList.add('on');
    clearTimeout(popTimer); popTimer = setTimeout(() => pop.classList.remove('on'), 3200);
  }
  const standard = gp => !!gp && gp.connected;
  const pads = () => [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(standard);
  let seen = false;
  addEventListener('gamepadconnected', e => { seen = true; root.classList.add('pd-gp-seen'); say('on', e.gamepad); });
  addEventListener('gamepaddisconnected', e => {
    say('off', e.gamepad);
    const was = padMode; releaseAll(); if (!pads().length) setPadMode(false);
    if (was && context() === 'drive') tap('KeyP');   // the car does not drive on by itself: the menu opens, as a console does
  });

  // while the pad is in use the touch pads are out of the way; a touch or a click brings them back
  let padMode = false;
  function setPadMode(on) { if (on === padMode) return; padMode = on; root.classList.toggle('pd-gp', on); }
  addEventListener('pointerdown', () => setPadMode(false), true);

  // ---- what the pad is talking to right now ----
  const wheelEl = () => { for (const s of document.querySelectorAll('svg[role=menu]')) { const w = s.closest('.pd-p2p'); if (w && w.style.display === 'block') return s; } return null; };
  let ctxAt = -1, ctxVal = 'menu';
  function context(t = performance.now()) {
    if (t - ctxAt < 90) return ctxVal;
    ctxAt = t;
    ctxVal = document.querySelector('[aria-modal="true"]') ? 'dialog'
      : document.querySelector('.pd-online-bar') ? 'offer'
      : game.state === 'play' && document.querySelector('.pd-mcard.on') ? 'arrive'
      : wheelEl() ? 'wheel'
      : document.querySelector('.mpx.list') ? 'list'
      : game.state === 'play' ? 'drive' : 'menu';
    return ctxVal;
  }

  // ---- small movers for the screens that are not driven by keys ----
  function step(list, dir) {   // the next one in that direction, by position on the screen (the same scoring as the menus in src/ui.js)
    const a = document.activeElement;
    if (!list.length) return;
    if (!list.includes(a)) { list[0].focus({ preventScroll: true }); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bs = Infinity;
    for (const it of list) {
      if (it === a) continue;
      const q = it.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx, off = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along < 4) continue;
      const s = along + off * 2.2; if (s < bs) { bs = s; best = it; }
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView?.({ block: 'nearest' }); }
  }
  const dlgItems = () => { const d = document.querySelector('[aria-modal="true"]'); return d ? [...d.querySelectorAll('button, input')].filter(e => e.offsetParent !== null && !e.disabled) : []; };
  const listItems = () => [...document.querySelectorAll('.mpx-list .mpx-go')].filter(e => e.offsetParent !== null && !e.disabled);
  let wheelSel = -1;
  function wheelMark(i) {
    const s = wheelEl(); if (!s) { wheelSel = -1; return; }
    const gs = [...s.querySelectorAll('g[role=menuitem]')];
    gs.forEach((g, k) => g.classList.toggle('gp-sel', k === i));
  }

  // ---- the poll ----
  const prev = {}, rep = {};
  const edge = (k, on) => { const was = !!prev[k]; prev[k] = on; return on && !was; };
  function repeat(k, on, t, fn) {   // fires at once, then again after a pause and then quickly, while held
    const r = rep[k] || (rep[k] = { on: false, t0: 0, t1: 0 });
    if (!on) { r.on = false; return; }
    if (!r.on) { r.on = true; r.t0 = r.t1 = t; fn(); } else if (t - r.t0 > 380 && t - r.t1 > 120) { r.t1 = t; fn(); }
  }
  let lastCtx = '';
  function frame(t) {
    requestAnimationFrame(frame);
    const list = pads(); if (!list.length) return;
    const gp = list.find(g => g.buttons.some(b => b.pressed) || g.axes.some(a => Math.abs(a) > 0.5)) || list[0];
    const b = i => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, ry = gp.axes[3] || 0;
    if (b(0) || b(1) || b(2) || b(3) || b(9) || Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) { if (!seen) { seen = true; root.classList.add('pd-gp-seen'); } setPadMode(true); }
    const c = context(t);
    if (c !== lastCtx) { if (c !== 'drive') releaseAll(); if (c !== 'wheel') { wheelSel = -1; wheelMark(-1); } lastCtx = c; }
    const dir = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6 };
    const A = edge('a', b(0)), B = edge('b', b(1)), X = edge('x', b(2)), Y = edge('y', b(3)), LB = edge('lb', b(4)), RB = edge('rb', b(5)), SEL = edge('sel', b(8)), START = edge('start', b(9)), L3 = edge('l3', b(10)), R3 = edge('r3', b(11));
    const dUp = edge('du', b(12)), dDown = edge('dd', b(13)), dLeft = edge('dl', b(14)), dRight = edge('dr', b(15));

    if (c === 'drive') {
      hold('KeyA', ax < -0.3); hold('KeyD', ax > 0.3);
      hold('KeyW', b(7) || b(0)); hold('KeyS', b(6));
      hold('Space', b(2)); hold('KeyH', b(1)); hold('ShiftLeft', b(5)); hold('KeyF', b(3));
      if (LB) tap('KeyC'); if (SEL) tap('KeyG'); if (START) tap('KeyP'); if (L3) tap('KeyR');
      if (R3) document.querySelector('.mpx.on .mpx-cap')?.click();
      if (dUp) tap('KeyT'); if (dDown) tap('KeyB'); if (dLeft) tap('KeyN'); if (dRight) tap('KeyM');
      return;
    }
    if (c === 'offer') { if (A) tap('KeyY'); if (B) tap('KeyN'); return; }
    if (c === 'arrive') { if (A) tap('Enter'); if (B) tap('Escape'); return; }
    if (c === 'wheel') {
      const s = wheelEl(), n = s ? s.querySelectorAll('g[role=menuitem]').length : 0;
      const vx = (dir.right ? 1 : 0) - (dir.left ? 1 : 0) || (Math.abs(ax) > 0.5 ? ax : 0), vy = (dir.down ? 1 : 0) - (dir.up ? 1 : 0) || (Math.abs(ay) > 0.5 ? ay : 0);
      if (n && (vx || vy)) { const ang = (Math.atan2(vx, -vy) + 2 * Math.PI) % (2 * Math.PI); const i = Math.round(ang / (2 * Math.PI / n)) % n; if (i !== wheelSel) { wheelSel = i; wheelMark(i); } }
      if (A && wheelSel >= 0) { tap('Digit' + (wheelSel + 1)); wheelSel = -1; setTimeout(() => wheelMark(-1), 0); }
      if (B) tap('Backspace'); if (START) tap('Escape');
      return;
    }
    if (c === 'list' || c === 'dialog') {
      const items = c === 'list' ? listItems() : dlgItems();
      if (!items.includes(document.activeElement) && items.length && (dir.up || dir.down || dir.left || dir.right || A)) { if (A) { items[0].focus({ preventScroll: true }); } else step(items, 'down'); }
      for (const d of ['up', 'down', 'left', 'right']) repeat('n' + d, dir[d], t, () => { if (items.includes(document.activeElement)) step(items, d); });
      if (A) { const a = document.activeElement; if (items.includes(a)) { if (a.tagName === 'INPUT') a.focus(); else a.click(); } }
      if (B || START) tap('Escape');
      return;
    }
    // the menus, the map picker, the Garage, the title: the keys of the keyboard
    const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    for (const d in K) repeat('m' + d, dir[d], t, () => tap(K[d]));
    if (A) tap('Enter'); if (B) tap('Escape'); if (START) tap('KeyP'); if (Y) tap('KeyL'); if (X) tap('KeyE');
    if (RB) tap('Tab'); if (LB) tap('Tab', true);
    repeat('zi', b(7) || ry < -0.6, t, () => tap('Equal')); repeat('zo', b(6) || ry > 0.6, t, () => tap('Minus'));
  }
  requestAnimationFrame(frame);
}
