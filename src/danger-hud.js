// The neighbourhood in the map capsule (src/ui.css #pd-card, the words column #pd-info). Two parts, built here and appended by src/police.js, which owns the column:
//   #pd-hood  the area's name and its level as a small number
//   #pd-gang  under it, from the first damage in the area: the twin of the police row (#pd-wanted, src/police.js): an eye, the words of the stage, five eyes that open as the
//             area's score rises (src/danger.js) and a bar: the score, or in the hunt (five eyes) the countdown, in red
// createDangerHud(car) -> { els: [hood, gang], draw() }; draw() every frame (it only touches the page when something changed). Same on a phone and a desktop.
import { dangerAt, areaAt, covered, trouble, TUNE } from './danger.js';
import { townAt } from './districts.js';
import { sfx } from './sfx.js';

const CSS = `
  /* the area with its danger diamonds (row 2, plus for a few seconds after the area changes the words "neighbourhood danger") and the gang row are parts of the map capsule, src/ui.css */
  #pd-hood { display: none; flex-direction: column; font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
  #pd-hood.on { display: flex; }
  #pd-hood .ph-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 1px; }
  #pd-hood .ph-n { min-width: 0; font-size: 12.5px; letter-spacing: .05em; line-height: 1.2; color: #ffb3d4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood .ph-t { display: none; margin-top: 1px; font: 600 10px/1.1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #d9c3cd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood.ex .ph-t { display: block; }
  #pd-hood .ph-r { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; }
  #pd-hood .ph-lv { min-width: 11px; padding: 0 3px; border-radius: 5px; font: 700 9px/12px 'Barlow Condensed', system-ui, sans-serif; text-align: center; color: var(--hc, #f5a9c9); box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hc, #f5a9c9) 55%, transparent); }   /* the area's level, 1..5: a quiet outlined number in the area's tint, the diamonds beside it carry the colour */
  #pd-gang { display: none; pointer-events: none; flex-wrap: wrap; align-items: center; gap: 0 6px; margin-top: 5px;
    font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; color: #fff; }   /* the same shape as the police row under it; no rule above it, its own bar is the line */
  #pd-gang.on { display: flex; }
  #pd-gang .pg-ico { width: 15px; height: 15px; flex: 0 0 auto; }
  #pd-gang .pg-ico .pu { transform-origin: 12px 12px; }
  #pd-gang.out .pg-ico .pu { animation: pg-look .5s steps(1) infinite; }
  @keyframes pg-look { 0% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
  #pd-gang .pg-t { flex: 1 1 0; min-width: 0; font: 700 11px/1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .02em; color: #ffc27a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-gang.out .pg-t, #pd-gang.safe .pg-t { color: #fff; text-shadow: 0 0 8px #ef6a4b; }
  #pd-gang.safe .pg-t { text-shadow: 0 0 8px #9fd39a; }
  #pd-gang .pg-bar { flex: 0 0 100%; height: 2px; margin-top: 3px; border-radius: 1px; background: rgba(255,255,255,.14); overflow: hidden; }   /* how long is left, under the line */
  #pd-gang .pg-pips { display: flex; gap: 2px; flex: 0 0 auto; }   /* five eyes, the twin of the police's five sirens */
  #pd-gang .pg-pips i { position: relative; width: 9px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,194,122,.5); }
  #pd-gang .pg-pips i.f { background: #ffc27a; box-shadow: 0 0 5px #ef8a4b, inset 0 0 0 1.5px #ffe0b8; }
  #pd-gang .pg-pips i.f::after { content: ''; position: absolute; left: 3px; top: 1.5px; width: 3px; height: 3px; border-radius: 50%; background: #2a1408; }
  #pd-gang.hunt .pg-pips i.f { background: #ff6a4b; box-shadow: 0 0 7px #ff3b2b, inset 0 0 0 1.5px #ffd0c0; }
  #pd-gang.hunt .pg-bar b { background: linear-gradient(90deg, #ff3b2b, #ff8a4b); }
  #pd-gang .pg-bar b { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ef6a4b, #f2d36b); transition: width .3s linear; }
  #pd-gang.safe .pg-bar b { background: #9fd39a; }
  @media (max-height: 460px) { #pd-gang .pg-ico, #pd-wanted .pw-ico { width: 13px; height: 13px; } #pd-gang, #pd-wanted { margin-top: 4px; } #pd-gang .pg-bar, #pd-wanted .pw-bar { margin-top: 2px; } }   /* a phone on its side: the rows are a little tighter so that the capsule stays about as tall as the map */
`;

// the words of the gang row, by stage: DRAFT Palermitan for the owner to correct, then the English (one language at a time, src/lang.js)
const WORDS = {
  1: ['TI SINTIERU…', 'THEY HEARD YOU…'],
  2: ['TI STANNU TALIANNU…', 'THEY\'RE WATCHING YOU…'],
  3: ['TI STANNU CIRCANNU!', 'THEY\'RE HUNTING YOU!'],
  4: ['NIESCI RU QUAITTIARI!', 'GET OUT OF THE QUARTER!'],
  safe: ['TI SAIBBASTI!', 'YOU MADE IT!'],
};
const HOOD_C = ['#9fd39a', '#f2d36b', '#f0a04b', '#ef6a4b', '#ff3b5c'];   // quiet green to ZEN red
const EX_MS = 5000;   // "neighbourhood danger" is spelt out for this long after the area changes, then only the diamonds stay

export function createDangerHud(car) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const hood = document.createElement('div'); hood.id = 'pd-hood';
  hood.innerHTML = '<div class="ph-row"><div class="ph-n"></div><span class="ph-r"><span class="ph-lv"></span></span></div><div class="ph-t"></div>';
  const gang = document.createElement('div'); gang.id = 'pd-gang';
  gang.innerHTML = '<svg class="pg-ico" viewBox="0 0 24 24"><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z" fill="none" stroke="#ffc27a" stroke-width="1.8" stroke-linejoin="round"/><circle class="pu" cx="12" cy="12" r="3.2" fill="#ef6a4b"/></svg><div class="pg-t"></div><span class="pg-pips"><i></i><i></i><i></i><i></i><i></i></span><div class="pg-bar"><b></b></div>';
  const elN = hood.querySelector('.ph-n'), elLv = hood.querySelector('.ph-lv'), elT = hood.querySelector('.ph-t');
  const elG = gang.querySelector('.pg-t'), elBar = gang.querySelector('.pg-bar b'), pips = [...gang.querySelectorAll('.pg-pips i')];
  let on = null, name = '', lv = -1, filled = -1, lang = '', ex = 0, gOn = false, gKey = '', gBar = -1;
  function draw() {
    const shown = !covered();
    if (shown !== on) { on = shown; hood.classList.toggle('on', shown); }
    if (!shown) { if (gOn) { gOn = false; gang.classList.remove('on'); } return; }
    const n = townAt(car.x, car.z) || areaAt(car.x, car.z) || 'Palermo', l = dangerAt(car.x, car.z), tr = trouble();
    if (n !== name) { name = n; elN.textContent = n; ex = performance.now() + EX_MS; hood.classList.add('ex'); }
    else if (ex && performance.now() > ex) { ex = 0; hood.classList.remove('ex'); }
    const lg = document.documentElement.lang === 'en' ? 'en' : 'it';
    if (lg !== lang) { lang = lg; elT.textContent = lg === 'en' ? 'Neighbourhood danger' : 'Pericolosità quartiere'; }
    if (l !== lv) { lv = l; elLv.textContent = l; hood.style.setProperty('--hc', HOOD_C[l - 1] || HOOD_C[0]); }
    // the eyes: 20 points each, so the first one opens with the first damage; the row shows from there, as the police row does from the first siren
    const f = tr.score > 0 ? Math.min(5, Math.ceil(tr.score / (TUNE.max / 5) - 1e-6)) : 0;
    if (f !== filled) { if (f > filled && filled >= 0 && f >= 3) sfx('heat'); filled = f; pips.forEach((p, i) => p.classList.toggle('f', i < f)); }
    const safe = tr.stage < 3 && tr.safe > 0, row = safe ? 'safe' : f > 0 ? tr.stage : 0;
    if ((row !== 0) !== gOn) { gOn = row !== 0; gang.classList.toggle('on', gOn); }
    if (!gOn) { gKey = ''; return; }
    const key = row + lg;
    if (key !== gKey) { gKey = key; elG.textContent = WORDS[row][lg === 'en' ? 1 : 0]; gang.classList.toggle('hunt', row === 3 || row === 4); gang.classList.toggle('out', row === 4); gang.classList.toggle('safe', row === 'safe'); }
    const bar = Math.round((row === 'safe' ? 1 : tr.stage >= 3 ? tr.bar : tr.score / TUNE.max) * 100);   // the score, like the police's heat; in the hunt the countdown
    if (bar !== gBar) { gBar = bar; elBar.style.width = bar + '%'; }
  }
  return { els: [hood, gang], draw };
}
