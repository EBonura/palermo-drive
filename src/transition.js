// Screen transition: rosanero (pink and black) squares flip in on a diagonal wave, a lapa spins while the screen is covered, then the
// squares flip out the same way. Owned by the game-shell work; the events work imports it for event starts.
//
//   import { transition } from './transition.js';
//   await transition(async () => { ...move the player, wait for the world to stream in... }, { hold: 400 });
//
// transition(work, opts) covers the screen, runs work() (it may return a Promise), stays covered until work settles (and at least
// opts.hold ms, so the lapa is seen), then reveals. It returns a Promise with work's result (or rejects with work's error after the
// reveal). Calls made while one is running wait their turn. 'pd-cover' (detail true / false) is dispatched on window when the screen is fully covered and when it is free again. opts: cover / reveal (ms, flip-in and flip-out time), hold (ms, minimum
// time covered), lapa (false: no spinning lapa). Input is blocked while it runs. Time based, so a hidden tab catches up when it returns.

const PINK = '#e8559a', BLACK = '#0b0709';
const COLS = 14;      // squares across; rows follow from the aspect ratio
const FLIP = 0.42;    // fraction of the cover/reveal time one square spends flipping (the rest is the diagonal stagger)
const LAPA = '<svg viewBox="0 0 120 80" aria-hidden="true"><g stroke="#0b0709" stroke-width="3.5" stroke-linejoin="round">'
  + '<path d="M56 12 H112 V22 H56 Z" fill="#f5a9c9"/>'                                  // canopy
  + '<path d="M56 22 H109 L111 56 H56 Z" fill="#e8559a"/>'                              // cargo bed
  + '<path d="M6 56 V42 Q6 34 14 32 L26 20 Q29 16 34 16 H56 V56 Z" fill="#fff"/>'       // cab, one wheel in front
  + '<path d="M31 21 H50 V33 H21 Z" fill="#0b0709" stroke="none"/></g>'                 // window
  + '<g fill="#0b0709" stroke="#fff" stroke-width="3"><circle cx="22" cy="60" r="11"/><circle cx="92" cy="60" r="11"/></g>'
  + '<g fill="#fff"><circle cx="22" cy="60" r="3.5"/><circle cx="92" cy="60" r="3.5"/></g></svg>';
const STYLE = `
.pd-tr { position: fixed; inset: 0; z-index: 950; display: none; pointer-events: auto; touch-action: none; -webkit-user-select: none; user-select: none; }
.pd-tr.on { display: block; }
.pd-tr canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pd-tr-lapa { position: absolute; left: 50%; top: 50%; width: clamp(96px, 26vh, 180px); aspect-ratio: 1; margin: calc(clamp(96px, 26vh, 180px) / -2) 0 0 calc(clamp(96px, 26vh, 180px) / -2);
  display: flex; align-items: center; justify-content: center; border-radius: 50%; opacity: 0; box-sizing: border-box; transition: opacity .18s ease; perspective: 600px;
  background: #0b0709; box-shadow: 0 0 0 5px #f5a9c9, 0 0 0 10px #0b0709, 0 0 28px 10px rgba(232,85,154,.55); }
.pd-tr.lapa .pd-tr-lapa { opacity: 1; }
.pd-tr-lapa svg { width: 84%; height: auto; display: block; animation: pd-tr-spin 1.1s linear infinite; filter: drop-shadow(0 0 10px rgba(232,85,154,.8)); }
@keyframes pd-tr-spin { to { transform: rotateY(360deg); } }
@media (prefers-reduced-motion: reduce) { .pd-tr-lapa svg { animation-duration: 2.4s; } }
`;

let root = null, cv = null, g = null, queue = Promise.resolve(), cols = 0, rows = 0, size = 0, ox = 0, oy = 0;
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensure() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = STYLE; document.head.append(st);
  root = document.createElement('div'); root.className = 'pd-tr'; root.setAttribute('aria-hidden', 'true');
  cv = document.createElement('canvas'); g = cv.getContext('2d');
  const lapa = document.createElement('div'); lapa.className = 'pd-tr-lapa'; lapa.innerHTML = LAPA;
  root.append(cv, lapa); document.body.append(root);
}
function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  size = Math.ceil(w / COLS); cols = COLS; rows = Math.ceil(h / size);
  ox = (w - cols * size) / 2; oy = (h - rows * size) / 2; // centred, so the squares overshoot the edges evenly
}
// u: 0 clear, 1 covered. dir 1: flipping in, -1: flipping out (the wave runs top-left to bottom-right both ways).
function paint(u, dir) {
  g.clearRect(0, 0, innerWidth, innerHeight);
  const span = cols + rows - 2, stag = 1 - FLIP;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = (c + r) / span * stag;
    let k = Math.min(1, Math.max(0, (u - d) / FLIP)); // this square's own progress, 0..1
    if (dir < 0) k = 1 - k;
    if (k <= 0) continue;
    const w = reduced ? size : size * Math.sin(k * Math.PI / 2);
    g.fillStyle = (c + r) & 1 ? BLACK : PINK;
    g.fillRect(ox + c * size + (size - w) / 2 - 0.5, oy + r * size - 0.5, w + 1, size + 1);
  }
}
function play(ms, dir) { // resolves when the flip is done
  return new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      const u = Math.min(1, (now - t0) / ms);
      paint(u, dir > 0 ? 1 : -1);
      u < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}
export const covering = () => !!root && root.classList.contains('on');   // the squares are up, from the first flip in to the last flip out (asked every frame by src/danger.js)
const announce = on => { try { dispatchEvent(new CustomEvent('pd-cover', { detail: on })); } catch (e) { /* no events */ } };   // the screen is covered (true) or free again (false): src/perf.js ignores frames meanwhile and makes its rebuilding changes now
const wait = ms => new Promise(r => setTimeout(r, ms));

async function run(work, { cover = 560, reveal = 560, hold = 250, lapa = true } = {}) {
  ensure(); layout();
  root.classList.add('on'); root.classList.toggle('lapa', false);
  await play(cover, 1);
  paint(1, 1);
  announce(true);
  root.classList.toggle('lapa', lapa);
  const t0 = performance.now();
  let res, err, failed = false;
  try { res = await work?.(); } catch (e) { failed = true; err = e; console.error('[transition] work failed', e); }
  const rest = hold - (performance.now() - t0);
  if (rest > 0) await wait(rest);
  root.classList.remove('lapa');
  await play(reveal, -1);
  root.classList.remove('on');
  cv.width = cv.height = 1;   // a full-screen canvas is 15 MB at pixel ratio 2: layout() sizes it again
  announce(false);
  if (failed) throw err;
  return res;
}

export function transition(work, opts) {
  const p = queue.then(() => run(work, opts));
  queue = p.catch(() => {});
  return p;
}
