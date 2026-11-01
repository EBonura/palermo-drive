// Mobile support: quality tier, touch controls, landscape prompt. Owned by the mobile work.
// QUALITY is read by main.js while it sets up the renderer; setupMobile runs once input is ready.
//
// Controls (landscape): left thumb has two big adjacent steering pads (A / D), the right thumb has
// a tall accelerate pad (W), a brake/reverse pad (S) and a handbrake pad (Space) and a nitro pad (ShiftLeft) above the gas. Every pad tracks
// its pointer by position, so a thumb can slide from one pad to its neighbour without lifting.
// The pads write into the same `keys` map as the keyboard. Camera, back on the road, swap vehicle and fullscreen are in the in-game
// side menu (src/ui.js), not on the screen. ?touch forces the touch UI on a desktop browser (for testing).
const params = typeof location === 'object' ? new URLSearchParams(location.search) : new URLSearchParams();
const coarse = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches ||
  (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches));
const touch = coarse || params.has('touch');

// Phones: fewer pixels and a smaller shadow map. Desktop values are unchanged.
export const QUALITY = { mobile: touch, pixelRatio: touch ? 1.25 : 2, shadowMap: touch ? 1024 : 4096 };

// Bulb-horn shape for the CLACSON pad.
const HORN_ICON = '<svg viewBox="0 0 24 24"><path d="M3 10v4h3l7 5V5L6 10H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const KEYS = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'KeyH'];

const ICON = {
  left: '<svg viewBox="0 0 48 48"><path d="M28 10 14 24l14 14" /></svg>',
  right: '<svg viewBox="0 0 48 48"><path d="M20 10l14 14-14 14" /></svg>',
  up: '<svg viewBox="0 0 48 48"><path d="M10 30l14-14 14 14M10 40l14-14 14 14" /></svg>',
  down: '<svg viewBox="0 0 48 48"><path d="M10 18l14 14 14-14" /></svg>',
  nos: '<svg viewBox="0 0 48 48"><path d="M27 5 12 27h10l-3 16 17-24H26z" /></svg>',
  brake: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="13" /><path d="M24 15v11M24 31v2" /></svg>',
};

function el(tag, cls, html, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  return e;
}

export function setupMobile({ keys, camState, renderer, camera }) {
  const root = document.documentElement;
  let enabled = false;

  // ---- viewport / gesture lockdown (applies once the touch UI is on) ----
  function lockPage() {
    let m = document.querySelector('meta[name=viewport]');
    if (!m) { m = el('meta'); m.name = 'viewport'; document.head.appendChild(m); }
    m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content';
    const stop = e => e.preventDefault();
    // Safari ignores user-scalable=no: block pinch gestures and rubber-banding explicitly.
    for (const t of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'selectstart', 'dragstart']) document.addEventListener(t, stop);
    document.addEventListener('touchmove', stop, { passive: false });
    let lastEnd = 0;
    document.addEventListener('touchend', e => { // double-tap zoom
      const now = Date.now();
      if (now - lastEnd < 350) e.preventDefault();
      lastEnd = now;
    }, { passive: false });
  }

  // ---- orientation prompt + fullscreen ----
  const rotate = el('div', 'rot', `
    <div class="rot-phone"><svg viewBox="0 0 64 64"><rect x="20" y="6" width="24" height="52" rx="5" /><path d="M29 11h6" /><circle cx="32" cy="52" r="1.6" /></svg></div>
    <div class="rot-t">Ruota il telefono in orizzontale</div>
    <div class="rot-s">Turn your phone sideways to drive</div>`);
  rotate.hidden = true;

  const fsSupported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  async function goFullscreen() {
    try {
      if (!isFull()) await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
    } catch (e) { /* refused: fine, the layout works inside browser chrome too */ }
    lockLandscape();
  }
  function lockLandscape() {
    try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* unsupported (iOS) */ }
  }
  // The title tap / Drive / Resume dispatch 'pd-gesture' inside the user's tap, which is the only
  // moment browsers allow fullscreen. Android: real fullscreen plus landscape lock. iPhone Safari has
  // no fullscreen for pages, only "Add to Home Screen" (manifest + apple-mobile-web-app-capable),
  // so iPhone users get a one-time hint instead.
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const iOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  addEventListener('pd-gesture', () => {
    if (!(QUALITY.mobile || enabled) || standalone) return;
    if (fsSupported && !isFull()) goFullscreen();
    else if (iOS && !fsSupported) showHomeScreenHint();
  });
  function showHomeScreenHint() {
    try { if (localStorage.getItem('palermoDrive.a2hs')) return; localStorage.setItem('palermoDrive.a2hs', '1'); } catch (e) { /* private mode */ }
    const hint = el('div', 'a2hs', `
      <b>Schermo intero</b> tocca <span class="a2hs-share"></span> Condividi e poi <i>Aggiungi alla schermata Home</i>
      <small>Full screen: tap Share, then Add to Home Screen</small>`);
    hint.addEventListener('pointerdown', () => hint.remove());
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 9000);
  }

  // ---- touch controls ----
  const ui = el('div', 'tc');
  const pad = (cls, key, icon, label) => el('div', 'pad ' + cls, `<i>${icon}</i>${label ? `<b>${label}</b>` : ''}`, { 'data-key': key });
  const steer = el('div', 'tc-steer');
  steer.append(pad('p-left', 'KeyA', ICON.left), pad('p-right', 'KeyD', ICON.right));
  const drive = el('div', 'tc-drive');
  drive.append(
    pad('p-hb', 'Space', ICON.brake, 'FRENO'),
    pad('p-brake', 'KeyS', ICON.down, 'RETRO'),
    pad('p-gas', 'KeyW', ICON.up, 'GAS'),
    pad('p-nos', 'ShiftLeft', ICON.nos, 'NOS'),
    pad('p-horn', 'KeyH', HORN_ICON, 'CLACSON'));
  ui.append(steer, drive);

  // pointerId -> key currently under that finger (null while it is over nothing)
  const fingers = new Map();
  const applied = {};
  function sync() {
    const down = new Set(fingers.values());
    for (const k of KEYS) {
      const want = down.has(k);
      if (!!applied[k] !== want) { applied[k] = want; keys[k] = want; }
    }
    for (const p of ui.querySelectorAll('.pad')) p.classList.toggle('on', down.has(p.dataset.key));
  }
  function padAt(x, y) {
    const e = document.elementFromPoint(x, y);
    const p = e && e.closest && e.closest('.pad');
    return p ? p.dataset.key : null;
  }
  function releaseAll() { fingers.clear(); sync(); }

  function onDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && !params.has('touch')) return;
    const t = e.target.closest && e.target.closest('.pad');
    if (!t || !ui.contains(t)) return;
    e.preventDefault();
    fingers.set(e.pointerId, padAt(e.clientX, e.clientY) || t.dataset.key);
    sync();
    if (!isFull() && fsSupported) lockLandscape(); // only succeeds in fullscreen on Android, harmless otherwise
  }
  function onMove(e) {
    if (!fingers.has(e.pointerId)) return;
    e.preventDefault();
    const k = padAt(e.clientX, e.clientY);
    if (fingers.get(e.pointerId) !== k) { fingers.set(e.pointerId, k); sync(); }
  }
  function onUp(e) { if (fingers.delete(e.pointerId)) sync(); }

  function enable() {
    if (enabled) return;
    enabled = true;
    root.classList.add('touch');
    document.body.append(ui, rotate);
    rotate.hidden = false;
    lockPage();
    addEventListener('pointerdown', onDown, { capture: true, passive: false });
    addEventListener('pointermove', onMove, { passive: false });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    addEventListener('blur', releaseAll);
    addEventListener('orientationchange', releaseAll);
    document.addEventListener('visibilitychange', releaseAll);
    rotate.addEventListener('pointerdown', e => { e.preventDefault(); if (fsSupported) goFullscreen(); });
    const onFs = () => { if (isFull()) lockLandscape(); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
  }

  if (touch) enable();
  else addEventListener('pointerdown', e => { if (e.pointerType === 'touch') enable(); }, { once: false, capture: true, passive: true });
}
