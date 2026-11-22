// The call card: how every job reaches the lapa (src/mission-director.js). Always the same shape and the same place, the right edge of the screen under the map: the face of who
// is calling, their name, one line of what they say, where it is, and what it pays in large print, with a bar that runs out. One tap on it (or Q) answers; left alone it slides
// away and nothing is lost. The face is the caller's own sprite, cut from the crowd atlas (assets/peds/lpc: atlas.png and index.json), head and shoulders, drawn large and pixelated.
// createCallCard({ T, eur }) -> { show(o), hide(), update(dt) -> 'yes' | 'gone' | null, on() }
//   show({ ped (a cast id of assets/peds/sprites.js, or the number of one person of the cast), who, line, where, pay (euro), note (small words beside the pay), col (the kind's colour), secs })
import { esc } from './esc.js';
import { sfx } from './sfx.js';

const FACE_K = 3, FACE_ROWS = 27, FACE_TOP = 3;   // the face: the top rows of the front idle cell, three screen pixels to one
const CSS = `
#pd-call { position: absolute; right: max(10px, env(safe-area-inset-right)); top: 34%; z-index: 6; display: flex; align-items: stretch; gap: 10px; box-sizing: border-box; width: 312px; max-width: 46vw; padding: 8px 12px 12px 8px;
  border: 2px solid var(--k, #ff3d9a); border-radius: 16px; background: rgba(13,7,10,.9); box-shadow: 0 0 0 0 var(--k, #ff3d9a), 0 6px 22px rgba(0,0,0,.45); color: #fff; text-align: left; cursor: pointer;
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; pointer-events: auto; transform: translateX(calc(100% + 30px)); transition: transform .28s cubic-bezier(.2,1.2,.4,1); -webkit-tap-highlight-color: transparent; }
#pd-call.on { transform: none; animation: pd-callring 1s ease-out infinite; }
#pd-call.yes { transition: transform .35s ease-in, opacity .35s; opacity: 0; transform: scale(1.06); animation: none; }
@keyframes pd-callring { 0% { box-shadow: 0 0 0 0 var(--k), 0 6px 22px rgba(0,0,0,.45); } 100% { box-shadow: 0 0 0 14px rgba(255,255,255,0), 0 6px 22px rgba(0,0,0,.45); } }
.pc-face { flex: none; align-self: center; width: ${38 * FACE_K}px; height: ${FACE_ROWS * FACE_K}px; border-radius: 10px; background-color: #2a1a22; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: inset 0 0 0 2px rgba(255,255,255,.14); }
.pc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
.pc-lab { display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--k, #ff3d9a); }
.pc-lab svg { width: 12px; height: 12px; fill: currentColor; animation: pd-callshake .5s linear infinite; }
@keyframes pd-callshake { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
.pc-who { font-weight: 700; font-size: 18px; line-height: 1.05; letter-spacing: .03em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-line { font-weight: 500; font-size: 13px; line-height: 1.15; opacity: .9; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pc-where { font-weight: 600; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-pay { margin-top: 2px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; font: 400 26px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; color: #f5d27a; white-space: nowrap; }
.pc-pay small { font: 600 11px/1 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #ffe9b0; opacity: .85; }
.pc-lab b { display: inline-block; min-width: 15px; padding: 1px 3px; border-radius: 4px; background: #fff; color: #14090e; text-align: center; font-size: 11px; letter-spacing: 0; }
.pc-bar { position: absolute; left: 10px; right: 10px; bottom: 5px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.14); overflow: hidden; }
.pc-bar i { display: block; height: 100%; transform-origin: left; background: var(--k, #ff3d9a); }
/* on a touch screen the right edge under the map holds the horn, the nitro and the pedals: the card comes in from the left, under the radio bar and over the steering pads */
html.touch #pd-call { right: auto; left: max(10px, env(safe-area-inset-left)); top: 24%; width: 236px; padding: 6px 10px 10px 6px; gap: 8px; transform: translateX(calc(-100% - 30px)); }
html.touch #pd-call.on { transform: none; }
html.touch .pc-face { width: ${38 * 2}px; height: ${FACE_ROWS * 2}px; }
html.touch .pc-who { font-size: 15px; } html.touch .pc-line { font-size: 11px; } html.touch .pc-pay { font-size: 21px; }
@media (prefers-reduced-motion: reduce) { #pd-call.on, .pc-lab svg { animation: none; } }
`;
const PHONE = '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

export function createCallCard({ T, eur }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('button'); el.id = 'pd-call'; el.type = 'button';
  el.innerHTML = `<span class="pc-face"></span><span class="pc-txt"><span class="pc-lab"></span><span class="pc-who"></span><span class="pc-line"></span><span class="pc-where"></span><span class="pc-pay"></span></span><span class="pc-bar"><i></i></span>`;
  (document.getElementById('hud') || document.body).appendChild(el);
  const q = c => el.querySelector(c), face = q('.pc-face'), bar = q('.pc-bar i');
  let left = 0, secs = 1, on = false, said = null;
  const touch = document.documentElement.classList.contains('touch') || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const answer = () => { if (on && !said) said = 'yes'; };
  el.addEventListener('click', e => { e.stopPropagation(); answer(); });
  addEventListener('keydown', e => { if (on && e.code === 'KeyQ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA/.test(e.target?.tagName || '')) answer(); });

  // the faces: the atlas index, fetched once, the first time a call rings
  let index = null, asked = false, wantPed = null;
  const base = new URL('../assets/peds/lpc/', import.meta.url).href;
  function paint(ped) {
    wantPed = ped;
    if (!index) { if (!asked) { asked = true; fetch(base + 'index.json').then(r => r.json()).then(j => { index = j; paint(wantPed); }).catch(() => {}); } face.style.backgroundImage = 'none'; return; }
    const e = (typeof ped === 'number' ? index.entries[ped] : index.entries.find(x => x.id === ped)) || index.entries.find(x => x.id === 'suit'), cell = e && e.cells[0];   // a number: that very person of the cast (the entries are in the cast's order)
    if (cell === undefined) { face.style.backgroundImage = 'none'; return; }
    const k = face.offsetWidth / index.cell[0] || FACE_K, cx = (cell % index.cols) * index.cell[0], cy = Math.floor(cell / index.cols) * index.cell[1] + FACE_TOP;
    face.style.backgroundImage = `url(${base}atlas.png)`; face.style.backgroundSize = `${index.atlas[0] * k}px ${index.atlas[1] * k}px`; face.style.backgroundPosition = `${-cx * k}px ${-cy * k}px`;
  }

  function show(o) {
    el.style.setProperty('--k', o.col || '#ff3d9a'); el.classList.remove('yes');
    q('.pc-lab').innerHTML = PHONE + `<span>${esc(T('Arrispunni', 'Answer'))}</span>` + (touch ? '' : `<b>${document.documentElement.classList.contains('pd-gp') ? 'X' : 'Q'}</b>`);
    q('.pc-who').textContent = o.who || ''; q('.pc-line').textContent = o.line || ''; q('.pc-where').textContent = o.where || '';
    q('.pc-pay').innerHTML = esc(eur(o.pay)) + (o.note ? `<small>${esc(o.note)}</small>` : '');
    el.setAttribute('aria-label', `${o.who}: ${o.line} ${eur(o.pay)}`);
    paint(o.ped);
    secs = left = o.secs || 9; said = null; on = true; el.classList.add('on'); sfx('ring');
  }
  function hide() { on = false; el.classList.remove('on'); }
  // -> 'yes' once when answered, 'gone' once when the bar ran out, else null
  function update(dt) {
    if (!on) return null;
    if (said) { on = false; el.classList.add('yes'); el.classList.remove('on'); sfx('tick'); return 'yes'; }
    left -= dt; bar.style.transform = `scaleX(${Math.max(0, left / secs)})`;
    if (left <= 0) { hide(); return 'gone'; }
    return null;
  }
  return { show, hide, update, on: () => on };
}
