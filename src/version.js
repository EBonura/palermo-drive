// The version on screen, and the "new version" check. The production build (tools/build/build.mjs) stamps index.html with <meta name="pd-version"> and writes the
// same id to version.json. On start, and every time the page comes back to the foreground (a phone app left open on the home screen),
// the game asks for version.json past every cache, and again every 5 minutes while the page is in front. If the id differs, a full-screen wall covers the game
// (old version -> new version and one button that reloads onto it) and nothing behind it can be used: everyone plays the latest version. A player in the middle of
// a mission keeps playing until it ends (busy() false), so the wall never cuts a mission short. The source tree has no stamp, so nothing happens when running from the repo
// (?updatewall in the address shows the wall anyway, for testing; ?updatewall=20 after 20 seconds).
//
//   import { watchVersion } from './version.js';
//   watchVersion(game, { busy: () => missions.busy(), keys });   // game.state: 'title' | 'play' | 'pause'

import { T } from './lang.js';   // one language at a time (src/lang.js)

// While the wall is up nothing else hears a key, a tap or a click. These listeners go on the window when this module loads, before the game's own (src/ui.js, src/mobile.js and
// the vehicle's keys are set up later), so stopping the event here keeps it from all of them.
let blocking = null;
if (typeof window !== 'undefined') {
  const stop = e => { if (!blocking || (blocking.contains(e.target) && e.target !== blocking)) return; e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };
  for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu']) window.addEventListener(ev, stop, { capture: true, passive: false });
  window.addEventListener('keydown', e => { if (!blocking) return; e.stopImmediatePropagation(); e.preventDefault(); if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') blocking.querySelector('button')?.click(); }, { capture: true });
  window.addEventListener('keyup', e => { if (blocking) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
}

export function watchVersion(game, { busy: missionBusy = () => false, keys = null } = {}) {
  const meta = document.querySelector('meta[name="pd-version"]'), test = location.search.includes('updatewall'), cur = meta?.content || (test ? 'dev' : ''), curName = meta?.dataset.name || '';
  if (!cur) return;
  let latest = null, latestName = '', el = null, busy = false;
  if (test) setTimeout(() => { latest = 'test'; }, 1000 * (+new URLSearchParams(location.search).get('updatewall') || 0));   // ?updatewall=20: the new version 'appears' after 20 s
  const style = document.createElement('style');
  style.textContent = `
.pd-verdock { display: flex; align-items: flex-end; pointer-events: auto; }
.pd-verdock[hidden], .pd-vertag[hidden], .pd-update[hidden] { display: none; }
.pd-vertag { padding: 2px 4px; font: 600 11px/1.2 system-ui, -apple-system, sans-serif; letter-spacing: .06em; color: rgba(255,255,255,.72); text-shadow: 0 1px 2px rgba(0,0,0,.8); }
.pd-update { display: flex; align-items: center; gap: 12px; padding: clamp(4px, 1vh, 7px) 7px clamp(4px, 1vh, 7px) 14px; border-radius: 3px; color: #fff; transform: skewX(-11deg);
  background: linear-gradient(90deg, rgba(34,22,28,.92), rgba(14,9,12,.84)); box-shadow: inset 0 0 0 1px rgba(232,85,154,.8); font: 700 clamp(12px, 2.4vh, 15px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .03em; white-space: nowrap; }
.pd-update > * { transform: skewX(11deg); }
.pd-update small { display: block; font: 500 clamp(10px, 2vh, 12px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; opacity: .8; }
.pd-upwall { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: radial-gradient(ellipse 85% 65% at 50% 45%, rgba(11,7,9,.88), rgba(11,7,9,.97)), linear-gradient(180deg, rgba(11,7,9,.3) 40%, rgba(90,25,60,.6) 85%, rgba(232,85,154,.35)); color: #fff; pointer-events: auto; touch-action: none; text-align: center; }
.pd-upwall > div { display: flex; flex-direction: column; align-items: center; gap: clamp(8px, 2.4vh, 18px); max-width: 560px; }
.pd-upwall h2 { margin: 0; font: 400 clamp(38px, 11vh, 76px)/1.05 'Mr Dafoe', 'Brush Script MT', cursive; color: #fff; text-shadow: 0 0 22px rgba(232,85,154,.85), 0 3px 0 rgba(10,6,9,.9); transform: rotate(-2deg); }
.pd-upwall p { margin: 0; font: 600 clamp(15px, 3.4vh, 21px)/1.25 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .03em; opacity: .92; }
.pd-upwall small { font: 600 clamp(12px, 2.6vh, 15px)/1.2 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .12em; color: #ffc46b; }
.pd-upwall button { margin-top: clamp(4px, 1.4vh, 10px); min-height: clamp(48px, 11vh, 64px); padding: 0 clamp(28px, 6vw, 48px); border: 0; border-radius: 4px; background: #e8559a; color: #fff; cursor: pointer; transform: skewX(-11deg);
  font: 700 clamp(22px, 5.4vh, 32px)/1 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .08em; text-transform: uppercase; box-shadow: 0 0 22px rgba(232,85,154,.6); }
.pd-upwall button > span { display: inline-block; transform: skewX(11deg); }
.pd-upwall button:focus { outline: none; }
.pd-upwall button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.pd-update button { flex: none; min-height: 32px; border: 0; border-radius: 3px; padding: 0 12px; background: #e8559a; color: #fff; font: 700 clamp(13px, 2.6vh, 16px)/1 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }`;
  document.head.appendChild(style);
  // the version in small print, and the update notice in its place when there is one. They live in the .pd-vslot of the title or the main menu,
  // so that screen's layout makes room for them and they fade with it.
  const dock = document.createElement('div');
  dock.className = 'pd-verdock'; dock.hidden = true;
  const tag = document.createElement('div');
  tag.className = 'pd-vertag'; tag.textContent = 'v' + curName;
  dock.appendChild(tag);
  const ui = document.getElementById('pd-ui');
  const place = () => {
    const slot = game.state === 'title' ? ui?.querySelector(`.pd-s-${ui.dataset.screen} .pd-vslot`) : null;
    dock.hidden = !slot;
    if (slot && dock.parentNode !== slot) slot.appendChild(dock);
  };

  async function check() {
    if (busy || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j.v && j.v !== cur) { latest = j.v; latestName = j.name || ''; } }
    } catch { /* offline: try again next time */ }
    busy = false;
  }

  function reload() {
    // a fresh query string so the browser (and a home-screen web app) cannot hand back the cached old page
    const u = new URL(location.href); u.searchParams.set('v', latest); location.replace(u.href);
  }

  // the notice in the language shown (and again when the language changes); the names of the two versions go under it when the build knows them
  let wall = null;
  function fillWall() {
    if (!wall) return;
    wall.innerHTML = `<div><h2>${T('Nuova versione!', 'New version!')}</h2><p>${T('Pi cuntinuari a ghiucari aggiorna u ioco: ci voli un secunnu.', 'Update the game to keep playing: it takes a second.')}</p>${curName && latestName ? `<small>v${curName} \u2192 v${latestName}</small>` : ''}<button type="button"><span>${T('Aggiorna', 'Update')}</span></button></div>`;   // the Palermitan line is a draft for the owner
    wall.querySelector('button').addEventListener('click', reload);
  }
  addEventListener('pd-lang', fillWall);
  // The wall: over everything (the HUD, the menus, the touch pads), and it swallows every tap and key except on its own button
  function showWall() {
    if (wall) return;
    wall = document.createElement('div');
    wall.className = 'pd-upwall'; wall.setAttribute('role', 'alertdialog'); wall.setAttribute('aria-modal', 'true');
    fillWall();
    document.body.appendChild(wall);
    blocking = wall;
    if (keys) for (const k in keys) keys[k] = false;   // a key held down when the wall came up is let go
    wall.querySelector('button')?.focus();
  }
  function fill() {
    if (el) el.innerHTML = `<div>${T('Nuova versione', 'New version')}${curName && latestName ? `<small>v${curName} \u2192 v${latestName}</small>` : ''}</div><button type="button">${T('Aggiorna', 'Update')}</button>`;
    el?.querySelector('button')?.addEventListener('click', reload);
  }
  addEventListener('pd-lang', fill);

  function show() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'pd-update'; el.setAttribute('role', 'status');
    fill();
    tag.hidden = true;
    dock.appendChild(el);
  }

  if (!test) check();
  document.addEventListener('visibilitychange', check);
  setInterval(check, 5 * 60 * 1000);   // also while playing, so a long session finds the new version too
  place();
  if (ui) new MutationObserver(place).observe(ui, { attributes: true, attributeFilter: ['data-screen', 'data-st'] });
  setInterval(() => { place(); if (latest) { show(); let b = false; try { b = !!missionBusy(); } catch { /* no missions: never busy */ } if (!b) showWall(); } }, 500);
}
