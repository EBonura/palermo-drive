// Coordinates on screen, for reporting a spot in the world with one screenshot: game metres, lat/lon, the 500 m tile, the
// ground height under the car and under the camera, the quartiere, and the frame rate, the automatic graphics step and the resolution (src/perf.js). On with ?coords, or Options > "Debug" (game.settings.coords).
// Read-only: it draws text and touches nothing else.
//
//   import { createCoords } from './coords.js';
//   const coords = createCoords({ game, car, camera, groundY });   coords.update() once per frame
import { LAT0, LON0, KX, KZ } from './core.js';
import { zone } from './hud.js';

const T = 500;   // tile size (src/world.js)

export function createCoords({ game, car, camera, groundY, perf }) {
  const forced = new URLSearchParams(location.search).has('coords');
  const el = document.createElement('div');
  el.className = 'pd-coords';
  el.style.cssText = 'pointer-events:none;white-space:pre;font:600 11px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#fff;' +
    'background:rgba(11,7,9,.78);border-left:3px solid #e8559a;padding:5px 8px;border-radius:4px;display:none';
  zone('status').appendChild(el);
  let last = '', tick = 0;
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1), f6 = v => v.toFixed(6);
  const gy = (x, z) => { try { const y = groundY(x, z); return Number.isFinite(y) ? f1(y) : '?'; } catch (e) { return '?'; } };

  function update() {
    const on = forced || game.settings.coords === 'on';
    el.style.display = on ? '' : 'none';
    if (!on || (tick++ & 7)) return;   // eight times a second is plenty for a screenshot
    const x = car.x, z = car.z, lat = LAT0 - z / KZ, lon = LON0 + x / KX;
    const ti = Math.floor(x / T), tj = Math.floor(z / T), c = camera.position;
    const hood = document.querySelector('#pd-hood.on .ph-n')?.textContent || '';
    const txt = `x ${f1(x)}  z ${f1(z)}  head ${Math.round(((car.th * 180 / Math.PI) % 360 + 360) % 360)}°\n` +
      `lat ${f6(lat)}  lon ${f6(lon)}\n` +
      `tile ${ti}_${tj}  ground ${gy(x, z)} m${hood ? '  ' + hood : ''}\n` +
      `cam ${f1(c.x)} ${f1(c.y)} ${f1(c.z)}  ground ${gy(c.x, c.z)} m` +
      (perf ? '\n' + perf.hud() : '');   // fps, graphics step, what limits it, resolution (src/perf.js)
    if (txt !== last) { el.textContent = txt; last = txt; }
  }
  return { update };
}
