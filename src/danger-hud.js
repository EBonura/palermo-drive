// The neighbourhood in the map capsule (src/ui.css #pd-card, the words column #pd-info). Two parts, built here and appended by src/police.js, which owns the column:
//   #pd-hood  the area's name, its level as a small number (and the tint of the diamonds), and five diamonds that fill as the score of the area rises (src/danger.js)
//   #pd-gang  under it, only from "noticed" on: a row in the look of the police row (#pd-wanted, src/police.js) with the words of the stage and a bar that drains
// createDangerHud(car) -> { els: [hood, gang], draw() }; draw() every frame (it only touches the page when something changed). Same on a phone and a desktop.
import { dangerAt, areaAt, covered, trouble, TUNE } from './danger.js';

const CSS = `
  /* the area with its danger diamonds (row 2, plus for a few seconds after the area changes the words "neighbourhood danger") and the gang row are parts of the map capsule, src/ui.css */
  #pd-hood { display: none; flex-direction: column; font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
  #pd-hood.on { display: flex; }
  #pd-hood .ph-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 1px; }
  #pd-hood .ph-n { min-width: 0; font-size: 12.5px; letter-spacing: .05em; line-height: 1.2; color: #ffb3d4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood .ph-t { display: none; margin-top: 1px; font: 600 10px/1.1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #d9c3cd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood.ex .ph-t { display: block; }
  #pd-hood .ph-r { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; }
  #pd-hood .ph-lv { min-width: 11px; padding: 0 3px; border-radius: 5px; font: 700 9px/12px 'Barlow Condensed', system-ui, sans-serif; text-align: center; color: #170d11; background: var(--hc, #f5a9c9); }   /* the area's level, 1..5 */
  #pd-hood .ph-p { display: flex; gap: 2px; flex: 0 0 auto; }
  #pd-hood .ph-p i { width: 8px; height: 8px; transform: rotate(45deg) scale(.8); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hc, #f5a9c9) 60%, transparent); }
  #pd-hood .ph-p i.f { background: var(--hc, #f5a9c9); box-shadow: 0 0 5px var(--hc, #f5a9c9); }
  #pd-gang { display: none; pointer-events: none; flex-wrap: wrap; align-items: center; gap: 0 6px; margin-top: 3px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,.12);
    font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; color: #fff; }   /* the same shape as the police row under it */
  #pd-gang.on { display: flex; }
  #pd-gang .pg-ico { width: 17px; height: 17px; flex: 0 0 auto; }
  #pd-gang .pg-ico .pu { transform-origin: 12px 12px; }
  #pd-gang.out .pg-ico .pu { animation: pg-look .5s steps(1) infinite; }
  @keyframes pg-look { 0% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
  #pd-gang .pg-t { flex: 1 1 0; min-width: 0; font: 700 11px/1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .02em; color: #ffc27a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-gang.out .pg-t, #pd-gang.safe .pg-t { color: #fff; text-shadow: 0 0 8px #ef6a4b; }
  #pd-gang.safe .pg-t { text-shadow: 0 0 8px #9fd39a; }
  #pd-gang .pg-bar { flex: 0 0 100%; height: 2px; margin-top: 3px; border-radius: 1px; background: rgba(255,255,255,.14); overflow: hidden; }   /* how long is left, under the line */
  #pd-gang .pg-bar b { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ef6a4b, #f2d36b); transition: width .3s linear; }
  #pd-gang.safe .pg-bar b { background: #9fd39a; }
  @media (max-height: 460px) { #pd-gang .pg-ico, #pd-wanted .pw-ico { width: 14px; height: 14px; } #pd-gang, #pd-wanted { margin-top: 2px; padding-top: 2px; } #pd-gang .pg-bar, #pd-wanted .pw-bar { margin-top: 2px; } }   /* a phone on its side: the rows are a little tighter so that the capsule stays about as tall as the map */
`;

// the words of the gang row, by stage: DRAFT Palermitan for the owner to correct, then the English (one language at a time, src/lang.js)
const WORDS = {
  2: ['TI STANNU TALIANNU…', 'THEY\'RE WATCHING YOU…'],
  3: ['TI STANNU CIRCANNU!', 'THEY\'RE LOOKING FOR YOU!'],
  4: ['NESCI RI CCÀ!', 'GET OUT OF HERE!'],
  safe: ['SAIBBATU!', 'SAFE!'],
};
const HOOD_C = ['#9fd39a', '#f2d36b', '#f0a04b', '#ef6a4b', '#ff3b5c'];   // quiet green to ZEN red
const EX_MS = 5000;   // "neighbourhood danger" is spelt out for this long after the area changes, then only the diamonds stay

export function createDangerHud(car) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const hood = document.createElement('div'); hood.id = 'pd-hood';
  hood.innerHTML = '<div class="ph-row"><div class="ph-n"></div><span class="ph-r"><span class="ph-lv"></span><span class="ph-p"><i></i><i></i><i></i><i></i><i></i></span></span></div><div class="ph-t"></div>';
  const gang = document.createElement('div'); gang.id = 'pd-gang';
  gang.innerHTML = '<svg class="pg-ico" viewBox="0 0 24 24"><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" fill="none" stroke="#ffc27a" stroke-width="1.8" stroke-linejoin="round"/><circle class="pu" cx="12" cy="12" r="3.2" fill="#ef6a4b"/></svg><div class="pg-t"></div><div class="pg-bar"><b></b></div>';
  const elN = hood.querySelector('.ph-n'), elLv = hood.querySelector('.ph-lv'), elT = hood.querySelector('.ph-t'), pips = [...hood.querySelectorAll('.ph-p i')];
  const elG = gang.querySelector('.pg-t'), elBar = gang.querySelector('.pg-bar b');
  let on = null, name = '', lv = -1, filled = -1, lang = '', ex = 0, gOn = false, gKey = '', gBar = -1;
  function draw() {
    const shown = !covered();
    if (shown !== on) { on = shown; hood.classList.toggle('on', shown); }
    if (!shown) { if (gOn) { gOn = false; gang.classList.remove('on'); } return; }
    const n = areaAt(car.x, car.z) || 'Palermo', l = dangerAt(car.x, car.z), tr = trouble();
    if (n !== name) { name = n; elN.textContent = n; ex = performance.now() + EX_MS; hood.classList.add('ex'); }
    else if (ex && performance.now() > ex) { ex = 0; hood.classList.remove('ex'); }
    const lg = document.documentElement.lang === 'en' ? 'en' : 'it';
    if (lg !== lang) { lang = lg; elT.textContent = lg === 'en' ? 'Neighbourhood danger' : 'Pericolosità quartiere'; }
    if (l !== lv) { lv = l; elLv.textContent = l; hood.style.setProperty('--hc', HOOD_C[l - 1] || HOOD_C[0]); }
    // the diamonds are the trouble you are in here: 20 points each, so the first one lights with the first damage
    const f = tr.score > 0 ? Math.min(5, Math.ceil(tr.score / (TUNE.max / 5) - 1e-6)) : 0;
    if (f !== filled) { filled = f; pips.forEach((p, i) => p.classList.toggle('f', i < f)); }
    // the gang row: only from "noticed" on, or for a moment after you got out in time
    const safe = tr.stage < 2 && tr.safe > 0, row = safe ? 'safe' : tr.stage >= 2 ? tr.stage : 0;
    if ((row !== 0) !== gOn) { gOn = row !== 0; gang.classList.toggle('on', gOn); }
    if (!gOn) { gKey = ''; return; }
    const key = row + lg;
    if (key !== gKey) { gKey = key; elG.textContent = WORDS[row][lg === 'en' ? 1 : 0]; gang.classList.toggle('out', row === 4); gang.classList.toggle('safe', row === 'safe'); }
    const bar = Math.round((row === 'safe' ? 1 : tr.bar) * 100);
    if (bar !== gBar) { gBar = bar; elBar.style.width = bar + '%'; }
  }
  return { els: [hood, gang], draw };
}
