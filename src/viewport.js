// The window size, read once and again on resize. innerWidth and innerHeight can force the browser to lay the page out when something in it changed
// this frame (the HUD changes every frame), which costs a few tenths of a millisecond at 4x CPU each time; the per-frame code reads this object instead.
export const vp = { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 };
const read = () => { vp.w = innerWidth; vp.h = innerHeight; vp.dpr = devicePixelRatio || 1; };
addEventListener('resize', read); addEventListener('orientationchange', read);

// The menus and the shell around them (#pd-ui) are laid out on a virtual screen that is never smaller than MIN_H x MIN_W and then scaled down to the real one with a transform, so on a small
// phone every panel, text and button shrinks together instead of falling off the screen or needing a scroll (src/ui.css, #pd-ui). --ui-z is that scale (1 on anything big enough);
// --vh and --vw are one hundredth of the virtual screen, in the virtual pixels the menu styles work in (they use calc(var(--vh, 1vh) * N) in place of vh, and the same for vw).
// CSS vh is the tallest the window gets (a phone browser with its address bar hidden), so it is not used: visualViewport is what is on screen right now and fires as the bars slide in and out.
const MIN_H = 440, MIN_W = 400;
const root = document.documentElement;
const setVh = () => {
  const vv = window.visualViewport, h = (vv && vv.height) || innerHeight, w = (vv && vv.width) || innerWidth; if (!(h > 0 && w > 0)) return;
  const z = Math.min(1, h / MIN_H, w / MIN_W); vp.z = z;
  root.style.setProperty('--ui-z', z.toFixed(4)); root.style.setProperty('--vh', (h / z / 100) + 'px'); root.style.setProperty('--vw', (w / z / 100) + 'px');
  root.style.setProperty('--rvh', (h / 100) + 'px'); root.style.setProperty('--rvw', (w / 100) + 'px');   // the real screen, for the HUD and the loading screen, which are not scaled
};
vp.z = 1; setVh();
addEventListener('resize', setVh); addEventListener('orientationchange', () => { setVh(); setTimeout(setVh, 300); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', setVh);
