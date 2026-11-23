// The one place that measures the screen. Everything that needs the size of the page reads vp here, or listens for 'pd-viewport' (onViewport below): the 3D view
// (src/main.js), the menus' scale and units (the CSS variables below, src/ui.css), the garage turntable, the transition, the gamepad pointer, the per-frame HUD.
// Nobody else reads innerWidth, clientWidth or visualViewport for the page's size, so the game and its menus can never disagree about it.
//
// The size is read from a probe: an empty element fixed over the whole page (inset 0), the same kind of box the 3D view and the menu layer are. Whatever area the browser
// really gives the page (Chrome on an iPhone sometimes leaves the notch side out, a phone's address bar slides in and out), the probe is exactly it, so everything matches.
// Reading it is cheap and happens only on a change (resize, rotation, the bars moving), never per frame: per-frame code reads vp.
//
// The menus (#pd-ui) are laid out on a virtual screen and scaled down to the real one, so on a small phone every panel, text and button shrinks together. The reference
// screen is 900 x 480 on its side and 420 x 760 upright; the scale z is whichever of width and height is shorter of it, never above 1. CSS variables:
//   --ui-z  the scale;  --vh, --vw  a hundredth of the virtual screen (the menus use calc(var(--vh, 1vh) * N) in place of vh);  --rvh, --rvw  a hundredth of the real screen
//   (the HUD and the loading screen, which are not scaled).
export const vp = { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, z: 1 };
const REF = { land: [900, 480], port: [420, 760] };
const root = document.documentElement;
const probe = document.createElement('div');
probe.setAttribute('aria-hidden', 'true');
probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1;contain:strict';
const fire = () => dispatchEvent(new CustomEvent('pd-viewport', { detail: vp }));
function measure() {
  if (!probe.isConnected) (document.body || root).appendChild(probe);
  const w = probe.clientWidth || innerWidth, h = probe.clientHeight || innerHeight, dpr = devicePixelRatio || 1;
  if (!(w > 0 && h > 0)) return;
  if (w === vp.w && h === vp.h && dpr === vp.dpr && root.style.getPropertyValue('--ui-z')) return;
  const [rw, rh] = w >= h ? REF.land : REF.port, z = Math.max(0.5, Math.min(1, w / rw, h / rh));
  vp.w = w; vp.h = h; vp.dpr = dpr; vp.z = z;
  const s = root.style;
  s.setProperty('--ui-z', z.toFixed(4)); s.setProperty('--vh', (h / z / 100) + 'px'); s.setProperty('--vw', (w / z / 100) + 'px');
  s.setProperty('--rvh', (h / 100) + 'px'); s.setProperty('--rvw', (w / 100) + 'px');
  fire();
}
// fn(vp) now and on every change
export function onViewport(fn) { addEventListener('pd-viewport', () => fn(vp)); fn(vp); }
measure();
addEventListener('resize', measure);
addEventListener('orientationchange', () => { measure(); setTimeout(measure, 120); setTimeout(measure, 450); });   // an iPhone reports the new size late after a turn
if (window.visualViewport) visualViewport.addEventListener('resize', measure);
if (window.ResizeObserver) new ResizeObserver(measure).observe(probe);
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', measure);
