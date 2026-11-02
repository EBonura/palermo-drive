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
  // the version in small print on the title and the main menu
  const tag = document.createElement('div');
  tag.className = 'pd-vertag'; tag.textContent = 'v' + curName;
  tag.style.cssText = 'position:fixed;z-index:510;left:50%;transform:translateX(-50%);bottom:max(4px,env(safe-area-inset-bottom));pointer-events:none;font:600 11px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.06em;color:rgba(255,255,255,.62);text-shadow:0 1px 2px rgba(0,0,0,.8)';
  document.body.appendChild(tag);
  const ui = document.getElementById('pd-ui');
  const place = () => { const sc = ui?.dataset.screen; tag.hidden = game.state !== 'title' || !(sc === 'title' || sc === 'menu'); };

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
    if (!el) {
      const style = document.createElement('style');
      style.textContent = `
.pd-update { position: fixed; z-index: 520; left: max(14px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; border-radius: 12px; box-sizing: border-box; max-width: min(300px, 34vw);
  background: rgba(11,7,9,.9); border: 1px solid rgba(232,85,154,.7); color: #fff; font: 600 13px/1.25 system-ui, -apple-system, sans-serif; }
.pd-update small { display: block; font-weight: 500; font-size: 11px; opacity: .7; }
.pd-update button { flex: none; border: 0; border-radius: 9px; padding: 8px 14px; background: #e8559a; color: #fff; font: 800 13px/1 system-ui, -apple-system, sans-serif;
  letter-spacing: .04em; text-transform: uppercase; cursor: pointer; }
.pd-update[hidden] { display: none; }`;
      document.head.appendChild(style);
      el = document.createElement('div');
      el.className = 'pd-update'; el.setAttribute('role', 'status');
      el.innerHTML = `<div>Nuova versione<small>${curName && latestName ? `v${curName} \u2192 v${latestName}` : 'A new version is out'}</small></div><button type="button">Aggiorna</button>`;
      el.querySelector('button').addEventListener('click', reload);
      document.body.appendChild(el);
    }
    el.hidden = game.state !== 'title';   // only on the title screen, never in the middle of a drive
  }

  check();
  document.addEventListener('visibilitychange', check);
  place();
  setInterval(() => { place(); if (latest) show(); }, 500);
}
