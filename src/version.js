// The version on screen, and the "new version" check. The production build (tools/build/build.mjs) stamps index.html with <meta name="pd-version"> and writes the
// same id to version.json. On start, and every time the page comes back to the foreground (a phone app left open on the home screen),
// the game asks for version.json past every cache; if the id differs, the title screen shows old version -> new version and a button that reloads onto it.
// The source tree has no stamp, so nothing happens when running from the repo.
//
//   import { watchVersion } from './version.js';
//   watchVersion(game);   // game.state: 'title' | 'play' | 'pause'

export function watchVersion(game) {
  const meta = document.querySelector('meta[name="pd-version"]'), cur = meta?.content, curName = meta?.dataset.name || '';
  if (!cur) return;
  let latest = null, latestName = '', el = null, busy = false;
  const style = document.createElement('style');
  style.textContent = `
.pd-verdock { display: flex; align-items: flex-end; pointer-events: auto; }
.pd-verdock[hidden], .pd-vertag[hidden], .pd-update[hidden] { display: none; }
.pd-vertag { padding: 2px 4px; font: 600 11px/1.2 system-ui, -apple-system, sans-serif; letter-spacing: .06em; color: rgba(255,255,255,.72); text-shadow: 0 1px 2px rgba(0,0,0,.8); }
.pd-update { display: flex; align-items: center; gap: 12px; padding: clamp(4px, 1vh, 7px) 7px clamp(4px, 1vh, 7px) 14px; border-radius: 3px; color: #fff; transform: skewX(-11deg);
  background: linear-gradient(90deg, rgba(34,22,28,.92), rgba(14,9,12,.84)); box-shadow: inset 0 0 0 1px rgba(232,85,154,.8); font: 700 clamp(12px, 2.4vh, 15px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .03em; white-space: nowrap; }
.pd-update > * { transform: skewX(11deg); }
.pd-update small { display: block; font: 500 clamp(10px, 2vh, 12px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; opacity: .8; }
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

  function show() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'pd-update'; el.setAttribute('role', 'status');
    el.innerHTML = `<div>Nuova versione<small>${curName && latestName ? `v${curName} \u2192 v${latestName}` : 'A new version is out'}</small></div><button type="button">Aggiorna</button>`;
    el.querySelector('button').addEventListener('click', reload);
    tag.hidden = true;
    dock.appendChild(el);
  }

  check();
  document.addEventListener('visibilitychange', check);
  place();
  if (ui) new MutationObserver(place).observe(ui, { attributes: true, attributeFilter: ['data-screen', 'data-st'] });
  setInterval(() => { place(); if (latest) show(); }, 500);
}
