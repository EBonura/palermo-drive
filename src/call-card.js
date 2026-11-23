// The call card: how every job reaches the lapa (src/mission-director.js). Always the same shape and the same place, the right edge of the screen under the map (the left edge on
// a touch screen). It is a capsule like the rest of the HUD (src/ui.css: the map capsule, the mission card, the gauges): the same dark ground, the same type, the same pink for
// its small words and its bar. The mission's own colour is one thing only: a small pill in the corner that names the type (the owner, 23 Nov 2026: "the mission colour is too
// prominent, it should be in a coloured pill in a corner describing the mission type"). Under it: the face of who is calling, their name, one line of what they say, where it
// is, and what it pays in the wallet's gold, with a bar that runs out. One tap on it (or Q, or X on a pad) answers; left alone it slides away and nothing is lost.
// Away means not drawn: once it has slid out it is hidden, so no edge of it shows on a phone whose notch pushes the HUD in (the owner saw a sliver of it, 23 Nov 2026).
// The face is the caller's own sprite, cut from the crowd atlas (assets/peds/lpc: atlas.png and index.json): the head, in a round frame like the minimap, drawn large and pixelated.
// createCallCard({ T, eur }) -> { show(o), hide(), update(dt) -> 'yes' | 'gone' | null, on() }
//   show({ ped (a cast id of assets/peds/sprites.js, or the number of one person of the cast), tag (the type's name, for the pill), who, line, where, pay (euro), note (small words beside the pay), col (the kind's colour), secs })
import { esc } from './esc.js';
import { sfx } from './sfx.js';
import { zone } from './hud.js';

const FACE_PX = 27, FACE_TOP = 7, FACE_LEFT = 5.5, CELL_W = 38;   // the face: a square of the top of the front idle cell (the cell is CELL_W wide, the head in its middle)
const COND = "'Barlow Condensed','Arial Narrow',system-ui,sans-serif";
const CSS = `
#pd-call { position: absolute; right: max(10px, env(safe-area-inset-right)); top: 34%; z-index: 6; display: flex; flex-direction: column; gap: 6px; box-sizing: border-box; width: 300px; max-width: 46vw; padding: 9px 14px 14px 12px;
  border: 0; border-radius: 20px; background: var(--capsule, rgba(13,7,10,.8)); box-shadow: 0 2px 10px rgba(0,0,0,.3); color: #fff; text-align: left; cursor: pointer;
  font-family: ${COND}; pointer-events: auto; visibility: hidden; transform: translateX(calc(100% + 30px + env(safe-area-inset-right, 0px))); transition: transform .28s cubic-bezier(.2,1.2,.4,1), visibility 0s .3s; -webkit-tap-highlight-color: transparent; }
#pd-call.on { visibility: visible; transform: none; transition: transform .28s cubic-bezier(.2,1.2,.4,1), visibility 0s; animation: pd-callring 1.1s ease-out infinite; }
#pd-call.yes { transition: transform .35s ease-in, opacity .35s, visibility 0s .4s; opacity: 0; transform: scale(1.05); animation: none; }
@keyframes pd-callring { 0% { box-shadow: 0 0 0 0 rgba(245,169,201,.7), 0 2px 10px rgba(0,0,0,.3); } 100% { box-shadow: 0 0 0 12px rgba(245,169,201,0), 0 2px 10px rgba(0,0,0,.3); } }
.pc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 16px; }
.pc-tag { flex: 0 1 auto; min-width: 0; padding: 2px 9px; border-radius: 999px; background: var(--k, #ff3d9a); color: #14090e; font: 700 10px/1.25 ${COND}; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-tag:empty { display: none; }
.pc-lab { flex: none; margin-left: auto; display: flex; align-items: center; gap: 5px; font: 600 10px/1.2 ${COND}; letter-spacing: .16em; text-transform: uppercase; color: #f5a9c9; }
.pc-lab svg { width: 11px; height: 11px; fill: currentColor; animation: pd-callshake .5s linear infinite; }
@keyframes pd-callshake { 0%, 100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
.pc-lab b { display: inline-block; min-width: 14px; padding: 1px 3px; border-radius: 4px; background: rgba(255,255,255,.92); color: #14090e; text-align: center; font-size: 10px; letter-spacing: 0; }
.pc-body { display: flex; align-items: center; gap: 11px; }
.pc-face { flex: none; width: ${FACE_PX * 2}px; height: ${FACE_PX * 2}px; border-radius: 50%; background-color: #2a1a22; background-repeat: no-repeat; image-rendering: pixelated; box-shadow: 0 0 0 2px rgba(255,255,255,.16); }
.pc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pc-who { font-weight: 700; font-size: 16px; line-height: 1.1; letter-spacing: .05em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-line { font-weight: 500; font-size: 13px; line-height: 1.15; opacity: .9; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pc-where { font-weight: 600; font-size: 11px; line-height: 1.15; letter-spacing: .1em; text-transform: uppercase; opacity: .82; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-where:empty { display: none; }
.pc-pay { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 7px; padding-left: ${FACE_PX * 2 + 11}px; font: 400 24px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .02em; color: #f5d27a; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pc-pay small { font: 600 10px/1 ${COND}; letter-spacing: .14em; text-transform: uppercase; color: #f5a9c9; }
.pc-bar { position: absolute; left: 16px; right: 16px; bottom: 6px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.12); overflow: hidden; }
.pc-bar i { display: block; height: 100%; transform-origin: left; border-radius: 2px; background: linear-gradient(90deg, #f5a9c9, #e8559a); }
/* on a touch screen the right edge under the map holds the horn, the nitro and the pedals: the card comes in from the left. It stands in the HUD's own left column (the zone
   under the radio bar, where the multiplayer pill and the last things said are, src/hud.js): a part of that column, under whatever is in it, so it can never lie over them. */
html.touch #pd-call { position: relative; right: auto; left: auto; top: auto; margin-top: 6px; width: 232px; max-width: none; padding: 7px 12px 12px 10px; gap: 4px; border-radius: 16px; transform: translateX(calc(-100% - 20px - var(--sl, 10px))); }   /* out past the edge by the column's own inset (--sl holds the notch, src/ui.css) */
html.touch #pd-call.on { transform: none; }
html.touch #pd-call.yes { transform: scale(1.05); }
/* on a computer it is on the right, under the map capsule however tall that is on a short window */
html:not(.touch) #pd-call { top: max(34%, calc(var(--mini, 128px) + 96px)); }
html.touch .pc-face { width: 44px; height: 44px; } html.touch .pc-body { gap: 9px; }
html.touch .pc-who { font-size: 14px; } html.touch .pc-line { font-size: 11px; } html.touch .pc-where { font-size: 10px; } html.touch .pc-pay { font-size: 20px; padding-left: 53px; }
@media (prefers-reduced-motion: reduce) { #pd-call.on, .pc-lab svg { animation: none; } }
`;
const PHONE = '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

export function createCallCard({ T, eur }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('button'); el.id = 'pd-call'; el.type = 'button';
  el.innerHTML = `<span class="pc-top"><span class="pc-tag"></span><span class="pc-lab"></span></span><span class="pc-body"><span class="pc-face"></span><span class="pc-txt"><span class="pc-who"></span><span class="pc-line"></span><span class="pc-where"></span></span></span><span class="pc-pay"></span><span class="pc-bar"><i></i></span>`;
  // where it stands: on a touch screen in the HUD's left column (zone 'social'; that zone is laid out bottom up, so the first child is the lowest: under the players pill and the
  // talk), else on the HUD itself, at the right edge. Looked at each time it rings: the touch class may come after this is made.
  const hudEl = document.getElementById('hud') || document.body;
  function place() { const z = document.documentElement.classList.contains('touch') ? zone('social') : null, to = z || hudEl; if (el.parentNode !== to || (z && z.firstChild !== el)) { if (z) z.prepend(el); else to.appendChild(el); } }
  place();
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
    const k = face.offsetWidth / FACE_PX || 2, cx = (cell % index.cols) * index.cell[0] + FACE_LEFT * index.cell[0] / CELL_W, cy = Math.floor(cell / index.cols) * index.cell[1] + FACE_TOP;
    face.style.backgroundImage = `url(${base}atlas.png)`; face.style.backgroundSize = `${index.atlas[0] * k}px ${index.atlas[1] * k}px`; face.style.backgroundPosition = `${-cx * k}px ${-cy * k}px`;
  }

  function show(o) {
    place(); void el.offsetWidth;   // (in its place before it slides in)
    el.style.setProperty('--k', o.col || '#ff3d9a'); el.classList.remove('yes');
    q('.pc-lab').innerHTML = PHONE + `<span>${esc(T('Arrispunni', 'Answer'))}</span>` + (touch ? '' : `<b>${document.documentElement.classList.contains('pd-gp') ? 'X' : 'Q'}</b>`);
    q('.pc-tag').textContent = o.tag || ''; q('.pc-who').textContent = o.who || ''; q('.pc-line').textContent = o.line || ''; q('.pc-where').textContent = o.where || '';
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
