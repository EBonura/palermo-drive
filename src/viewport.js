// The window size, read once and again on resize. innerWidth and innerHeight can force the browser to lay the page out when something in it changed
// this frame (the HUD changes every frame), which costs a few tenths of a millisecond at 4x CPU each time; the per-frame code reads this object instead.
export const vp = { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 };
const read = () => { vp.w = innerWidth; vp.h = innerHeight; vp.dpr = devicePixelRatio || 1; };
addEventListener('resize', read); addEventListener('orientationchange', read);
