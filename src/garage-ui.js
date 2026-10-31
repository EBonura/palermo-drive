// The Garage screen, in two steps. Owned by the driving work; src/ui.js (the shell) mounts it into its 'garage' screen and forwards enter/leave,
// the camera, the language and the Back key (garageUI.back()).
//   Step 1  BASE: pick one of the bases (lape, scooters, the hatchback) with its description and handling bars, a live 3D view, the price when locked.
//   Step 2  CUSTOMISE: one tab per category (colour, wheels, stance, trim, exhaust, spoiler, neon, stickers, horn, extras), only what fits that base.
//           Hovering or focusing an option previews it on the model; clicking an owned option fits it, clicking a new one asks to buy it.
// Every base keeps its own setup (src/garage.js). Money comes from fares ("Turisti affamati" credits src/garage.js).
// Test links: ?ui=garage&gveh=vespa&gstep=2&gcat=neon
import { garage, LIVERIES, PALETTE, categoriesFor, partOpts, partById, vehicleById, customLivery, parseLivery, lookKey } from './garage.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapA = a => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const eur = v => '€ ' + (Math.round(v * 2) / 2).toString().replace('.', ',');

const S = {
  pick: ['Scegli il mezzo', 'Choose your ride'], custom: ['Personalizza', 'Customise'], step: ['Passo', 'Step'],
  speed: ['Velocità', 'Speed'], accel: ['Accelerazione', 'Accel'], grip: ['Tenuta', 'Grip'],
  back: ['Indietro', 'Back'], vehicles: ['Mezzi', 'Vehicles'], next: ['Personalizza', 'Customise'], done: ['Fatto', 'Done'],
  buy: ['Compra', 'Buy'], need: ['Servono altri', 'Need'], bought: ['Comprato!', 'Bought!'],
  stock: ['Di serie', 'Stock'], mine: ['Tuo', 'Owned'], inUse: ['In uso', 'In use'], none: ['Nessuno', 'None'],
  livery: ['Livrea', 'Livery'], body: ['Carrozzeria', 'Body colour'], trim: ['Dettagli', 'Details'], auto: ['Originale', 'Original'],
  earn: ['Guadagna euro con i Turisti affamati', 'Earn euros in Hungry tourists'],
  set: ['montati', 'fitted'],
};
const SHORT = { cassone: ['Cassone', 'Cargo'], tascia: ['Tascia', 'Hatch'], scooterone: ['Scooterone', 'Big scooter'], motorino: ['Motorino', 'Minibike'] };
const ORDER = ['calessino', 'cassone', 'lapa50', 'tascia', 'vespa', 'scooterone', 'motorino'];
const BODY_IDS = ['rosso', 'arancio', 'giallo', 'lime', 'verde', 'azzurro', 'blu', 'viola', 'rosa', 'bianco', 'grigio', 'nero'];
const TRIM_IDS = ['nero', 'bianco', 'rosa', 'oro', 'bordeaux', 'grigio', 'rosso', 'blu'];

const CSS = `
.pd-garage { width: min(54vw, 520px); }
.gx-root { display: flex; flex-direction: column; gap: clamp(6px, 1.5vh, 12px); min-height: 0; flex: 1 1 auto; }
.gx-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: clamp(30px, 6.4vh, 44px); }
.gx-ttl { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.gx-ttl .pd-h { font-size: clamp(21px, 5vh, 34px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gx-crumb { font: 600 clamp(10px, 2.2vh, 13px)/1 var(--pd-cond); letter-spacing: .24em; text-transform: uppercase; color: var(--pd-amber); white-space: nowrap; }
.gx-crumb.pop { color: #fff; }
.gx-cash { flex: 0 0 auto; font: 700 clamp(17px, 3.8vh, 24px)/1 var(--pd-cond); letter-spacing: .08em; color: var(--pd-amber); background: rgba(255,255,255,.08); padding: 5px 10px; border-radius: 3px; box-shadow: inset 0 0 0 2px rgba(245,169,201,.35); white-space: nowrap; }
.gx-main { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: clamp(6px, 1.5vh, 12px); }
.gx-main[hidden], .gx-tabs[hidden] { display: none; }

/* step 1: the bases and the detail card */
.gx-bases { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(5px, 1.3vh, 9px) clamp(5px, 1vw, 9px); padding: 2px 10px 2px 8px; flex: 0 0 auto; }
.gx-bases .gx-base { min-height: clamp(42px, 9vh, 58px); padding: 4px 4px; flex-direction: column; justify-content: center; align-items: stretch; font-size: clamp(12px, 2.9vh, 17px); }
.gx-bases .gx-base > .pd-in { padding-left: 4px; gap: 3px; align-items: center; text-align: center; }
.gx-base .pd-l1 { line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.gx-base .gx-sub { font: 600 clamp(10px, 2.2vh, 13px)/1 var(--pd-cond); letter-spacing: .1em; color: var(--pd-amber); }
.gx-base[aria-pressed=true] .gx-sub { color: var(--pd-ink); }
.gx-base.gx-lock { opacity: .88; }
.gx-detail { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: clamp(4px, 1.1vh, 9px); padding: clamp(6px, 1.5vh, 12px) clamp(10px, 2vh, 16px) clamp(6px, 1.4vh, 12px); background: rgba(255,255,255,.06); border-radius: 4px; box-shadow: inset 0 0 0 2px rgba(245,169,201,.22); }
.gx-dh { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.gx-dname { font: 400 clamp(20px, 4.8vh, 32px)/1 var(--pd-race); letter-spacing: .05em; text-transform: uppercase; color: #fff; text-shadow: 0 0 14px rgba(232,85,154,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gx-dtag { flex: 0 0 auto; font: 700 clamp(15px, 3.4vh, 22px)/1 var(--pd-cond); letter-spacing: .08em; color: var(--pd-amber); text-transform: uppercase; }
.gx-ddesc { font: 400 clamp(12px, 2.7vh, 16px)/1.28 var(--pd-sans); color: rgba(255,255,255,.88); }
.gx-stats { display: flex; flex-direction: column; gap: clamp(3px, .9vh, 7px); margin-top: auto; }
.gx-stat { display: grid; grid-template-columns: clamp(78px, 17vh, 118px) 1fr; align-items: center; gap: 8px; font: 700 clamp(11px, 2.5vh, 15px)/1 var(--pd-cond); letter-spacing: .14em; text-transform: uppercase; color: var(--pd-amber); }
.gx-bar { display: flex; gap: 3px; }
.gx-bar i { flex: 1; height: clamp(7px, 1.7vh, 11px); background: rgba(255,255,255,.17); transform: skewX(-11deg); }
.gx-bar i.on { background: linear-gradient(90deg, var(--pd-pink), var(--pd-amber)); box-shadow: 0 0 8px rgba(232,85,154,.5); }

/* step 2: category tabs, sections of options */
.gx-tabs { display: flex; gap: 4px; flex-wrap: wrap; flex: 0 0 auto; padding: 0 6px 0 4px; }
.gx-tabs .pd-segb { flex: 0 0 auto; min-height: clamp(30px, 6.4vh, 40px); padding: 0 clamp(8px, 1.6vh, 13px); font-size: clamp(12px, 2.9vh, 17px); }
.gx-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 2px 10px 4px 8px; touch-action: pan-y; scrollbar-width: thin; display: flex; flex-direction: column; gap: clamp(5px, 1.3vh, 10px); }
.gx-sec { display: flex; flex-direction: column; gap: clamp(4px, 1vh, 7px); flex: 0 0 auto; }
.gx-sh { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: clamp(22px, 4.6vh, 30px); }
.gx-sn { font: 700 clamp(12px, 2.8vh, 17px)/1 var(--pd-cond); letter-spacing: .16em; text-transform: uppercase; color: var(--pd-amber); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gx-sn small { margin-left: 8px; font-weight: 600; letter-spacing: .1em; color: #fff; opacity: .85; }
.gx-stock { flex: 0 0 auto; min-height: clamp(22px, 4.6vh, 30px); padding: 0 10px; border: 0; border-radius: 3px; cursor: pointer; color: #fff; font: 700 clamp(11px, 2.5vh, 15px)/1 var(--pd-cond); letter-spacing: .12em; text-transform: uppercase; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 2px rgba(255,255,255,.2); transform: skewX(-11deg); touch-action: manipulation; -webkit-appearance: none; appearance: none; }
.gx-stock > span { display: block; transform: skewX(11deg); white-space: nowrap; }
.gx-stock[aria-pressed=true] { background: linear-gradient(90deg, var(--pd-pink), var(--pd-amber)); color: var(--pd-ink); box-shadow: inset 0 0 0 2px rgba(255,255,255,.65); }
@media (hover: hover) { .gx-stock:hover { background: rgba(255,255,255,.24); } .gx-stock[aria-pressed=true]:hover { background: linear-gradient(90deg, var(--pd-pink), var(--pd-amber)); } }
.gx-stock:focus { outline: none; }
.pd-kb .gx-stock:focus { outline: 3px solid #fff; outline-offset: 2px; }
.gx-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(5px, 1.2vh, 9px) clamp(5px, 1vw, 9px); }
.gx-grid .gx-card { min-height: clamp(44px, 9.4vh, 62px); padding: 5px 4px 5px 4px; flex-direction: column; align-items: stretch; justify-content: space-between; gap: 2px; font-size: clamp(12px, 2.8vh, 16px); }
.gx-grid .gx-card > .pd-in { padding-left: 10px; gap: 0; flex: 1 1 auto; justify-content: center; }
.gx-card .pd-l1 { white-space: normal; line-height: 1.04; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gx-card .gx-tag { align-self: flex-end; padding-right: 8px; transform: skewX(11deg); font: 700 clamp(11px, 2.5vh, 15px)/1 var(--pd-cond); letter-spacing: .06em; color: var(--pd-amber); }
.gx-card[aria-pressed=true] .gx-tag { color: var(--pd-ink); }
.gx-card.gx-lock .gx-tag { color: #fff; opacity: .9; }
.gx-card.gx-pend { box-shadow: inset 0 0 0 2px #fff, 0 0 16px rgba(255,255,255,.4); }
.gx-dot { display: inline-block; width: .8em; height: .8em; margin-right: 6px; border-radius: 50%; background: var(--dot); box-shadow: 0 0 0 2px rgba(255,255,255,.75); vertical-align: -.05em; }
.gx-dot.rb { background: conic-gradient(#ff2f9e, #ffb020, #37ff6a, #18e6ff, #9b4dff, #ff2f9e); }
.gx-chips { display: flex; flex-wrap: wrap; gap: clamp(5px, 1.2vh, 8px); }
.gx-chip { position: relative; width: clamp(30px, 7vh, 40px); height: clamp(30px, 7vh, 40px); padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: var(--sw); box-shadow: 0 0 0 2px rgba(255,255,255,.35), 0 2px 6px rgba(0,0,0,.4); touch-action: manipulation; -webkit-appearance: none; appearance: none; transition: transform .1s, box-shadow .1s; }
.gx-chip[aria-pressed=true] { box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--pd-pink), 0 0 14px rgba(232,85,154,.7); transform: scale(1.04); }
.gx-chip.none { background: repeating-linear-gradient(135deg, #2a1c23 0 5px, #3d2a34 5px 10px); }
.gx-chip.none::after { content: ''; position: absolute; left: 50%; top: 14%; bottom: 14%; width: 3px; margin-left: -1.5px; background: #fff; opacity: .85; transform: rotate(40deg); border-radius: 2px; }
@media (hover: hover) { .gx-chip:hover { transform: scale(1.12); box-shadow: 0 0 0 3px #fff, 0 0 14px rgba(255,255,255,.5); } }
.gx-chip:focus { outline: none; }
.pd-kb .gx-chip:focus { box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--pd-orange), 0 0 16px rgba(255,255,255,.6); transform: scale(1.1); }

/* footer */
.gx-foot { display: flex; gap: 10px; flex: 0 0 auto; align-items: stretch; }
.gx-foot .pd-btn { width: auto; flex: 0 0 auto; min-width: 0; min-height: clamp(38px, 8.4vh, 52px); }
.gx-foot .gx-go { flex: 1 1 auto; }
.gx-foot .pd-btn.drive.sm { min-height: clamp(38px, 8.4vh, 52px); }
.gx-need { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 0 10px; border-radius: 3px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 2px rgba(255,255,255,.18); font: 600 clamp(12px, 2.8vh, 17px)/1.1 var(--pd-cond); letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.8); text-align: center; }
.gx-need b { color: var(--pd-amber); margin-left: .4em; }
.gx-need.earn { font-size: clamp(11px, 2.4vh, 14px); }

@media (max-height: 460px) {
  .pd-garage { gap: 5px; padding-top: 8px; padding-bottom: 8px; width: min(54vw, 470px); }
  .gx-root { gap: 5px; }
  .gx-main { gap: 5px; }
  .gx-head { min-height: 30px; }
  .gx-ttl .pd-h { font-size: 22px; }
  .gx-crumb { font-size: 10px; letter-spacing: .2em; }
  .gx-cash { font-size: 17px; padding: 4px 8px; }
  .gx-tabs { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; touch-action: pan-x; scrollbar-width: none; padding-bottom: 2px; }
  .gx-tabs::-webkit-scrollbar { display: none; }
  .gx-tabs .pd-segb { min-height: 32px; font-size: 14px; padding: 0 9px; }
  .gx-bases .gx-base { min-height: 38px; font-size: 13px; }
  .gx-bases { gap: 5px 6px; }
  .gx-detail { padding: 6px 10px; gap: 4px; }
  .gx-dname { font-size: 21px; } .gx-dtag { font-size: 16px; }
  .gx-ddesc { font-size: 12px; line-height: 1.22; }
  .gx-stat { grid-template-columns: 88px 1fr; font-size: 11px; } .gx-bar i { height: 7px; }
  .gx-stats { gap: 3px; }
  .gx-grid .gx-card { min-height: 42px; font-size: 13px; }
  .gx-card .gx-tag { font-size: 12px; }
  .gx-sec { gap: 3px; } .gx-sh, .gx-stock { min-height: 22px; }
  .gx-chip { width: 33px; height: 33px; }
  .gx-chips { gap: 7px; }
  .gx-foot .pd-btn { min-height: 38px; }
}
@media (max-aspect-ratio: 1/1) { .pd-garage { width: min(94vw, 520px); } }
`;

// camera focus for the category being browsed: where to look from
const FOCUS = {
  wheels: { mode: 'side', d: 5.4, h: 1.1, ly: 0.4 }, stance: { mode: 'side', d: 5.2, h: 0.8, ly: 0.4 }, trim: { mode: 'orbit', d: 6.4, h: 1.7, ly: 0.7 },
  spoiler: { mode: 'rear', d: 5.6, h: 1.9, ly: 0.9 }, exhaust: { mode: 'rear', d: 5.0, h: 1.0, ly: 0.45 }, extra: { mode: 'rear', d: 6.4, h: 2.4, ly: 1.0 },
  stickers: { mode: 'side', d: 5.6, h: 1.4, ly: 0.7 }, neon: { mode: 'orbit', d: 5.8, h: 0.9, ly: 0.2 }, horn: { mode: 'orbit', d: 7, h: 2.2, ly: 0.7 },
};

export function setupGarageUI({ screen, button, vehicle, groundY, getLang, onExit }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const root = screen.querySelector('.gx-root');
  button.hidden = false;
  const Q = new URLSearchParams(location.search);   // test links: ?ui=garage&gveh=vespa&gstep=2&gcat=neon
  let step = 1, sel = garage.type, cat = 'paint', pending = null, hv = null, popMsg = '', popT = 0, entered = false, camSec = 0, lastPtr = 'mouse', downSel = null;
  const lastCat = {};
  const cam = { a: 0, orbit: 0, d: 7, h: 2.7, ly: 0.7 };
  const li = () => getLang() === 'it' ? 0 : 1;
  const tr = k => S[k][li()];
  const nm = o => li() === 0 ? o.name_it : o.name_en;
  const baseName = v => nm(v);
  const shortName = v => (SHORT[v.id] ? SHORT[v.id][li()] : nm(v));

  root.innerHTML = '<div class="gx-head"></div><div class="gx-tabs" hidden></div><div class="gx-main gx-m1"></div><div class="gx-main gx-m2" hidden></div><div class="gx-foot"></div>';
  const $ = q => root.querySelector(q);
  const elHead = $('.gx-head'), elTabs = $('.gx-tabs'), elM1 = $('.gx-m1'), elM2 = $('.gx-m2'), elFoot = $('.gx-foot');

  // ---- what is shown on the vehicle: the base you browse, its saved setup, then the option you clicked (pending) and the one under the pointer / focus (hv) ----
  function previewLook() {
    const l = garage.lookOf(sel);
    if (step === 2) for (const o of [pending, hv]) { if (!o) continue; if (o.k === 'liv') l.livery = o.id; else if (o.id) l.parts[o.part] = o.id; else delete l.parts[o.part]; }
    return l;
  }
  function showPreview() {
    const l = previewLook(), s = garage.look();
    vehicle.preview(l.type === s.type && lookKey(l) === lookKey(s) ? null : l);
  }

  // ---- small renderers ----
  const priceTag = (owned, price) => owned ? '<span class="gx-tag">✓</span>' : `<span class="gx-tag">${eur(price)}</span>`;
  function keep(fn) {   // run a repaint and put the focus back on the same control
    const a = document.activeElement, fk = a && root.contains(a) ? a.dataset.gx : null, sc = elM2.querySelector('.gx-body') ? elM2.querySelector('.gx-body').scrollTop : 0;
    fn();
    const b = elM2.querySelector('.gx-body'); if (b) b.scrollTop = sc;
    if (fk) { const el = [...root.querySelectorAll('[data-gx]')].find(e => e.dataset.gx === fk); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
  }
  function paintHead() {
    const v = vehicleById(sel);
    const crumb = popT > 0 ? `<span class="gx-crumb pop">${esc(popMsg)}</span>` : `<span class="gx-crumb">${esc(tr('step'))} ${step} / 2</span>`;
    elHead.innerHTML = `<div class="gx-ttl"><h2 class="pd-h">${esc(step === 1 ? tr('pick') : baseName(v))}</h2>${crumb}</div><div class="gx-cash">${eur(garage.cash)}</div>`;
  }
  function paintBases() {
    elM1.innerHTML = `<div class="gx-bases">${ORDER.map(id => {
      const v = vehicleById(id), own = garage.ownsVehicle(id), use = garage.type === id;
      return `<button class="pd-btn sm pd-liv gx-base${own ? '' : ' gx-lock'}" data-nav data-gx="base:${id}" aria-pressed="${sel === id}" type="button"><span class="pd-in"><span class="pd-l1">${esc(shortName(v))}</span><span class="gx-sub">${own ? (use ? '✓' : esc(tr('mine'))) : eur(v.price)}</span></span></button>`;
    }).join('')}</div><div class="gx-detail"></div>`;
    paintDetail();
  }
  function paintDetail() {
    const d = elM1.querySelector('.gx-detail'); if (!d) return;
    const v = vehicleById(sel), own = garage.ownsVehicle(sel);
    const tag = own ? (garage.type === sel ? tr('inUse') + ' ✓' : tr('mine')) : eur(v.price);
    const bar = n => `<span class="gx-bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    d.innerHTML = `<div class="gx-dh"><span class="gx-dname">${esc(baseName(v))}</span><span class="gx-dtag">${esc(tag)}</span></div>
      <div class="gx-ddesc">${esc(li() === 0 ? v.desc_it : v.desc_en)}</div>
      <div class="gx-stats">${[['speed', 0], ['accel', 1], ['grip', 2]].map(([k, i]) => `<div class="gx-stat"><span>${esc(tr(k))}</span>${bar(v.stats[i])}</div>`).join('')}</div>`;
    for (const b of elM1.querySelectorAll('.gx-base')) b.setAttribute('aria-pressed', String(b.dataset.gx === 'base:' + sel));
  }
  function paintTabs() {
    const cats = categoriesFor(sel);
    if (!cats.some(c => c.id === cat)) cat = 'paint';
    elTabs.innerHTML = cats.map(c => `<button class="pd-segb" data-nav data-gx="tab:${c.id}" aria-pressed="${cat === c.id}" type="button"><span>${esc(nm(c))}</span></button>`).join('');
    const on = elTabs.querySelector('[aria-pressed=true]'); if (on && on.scrollIntoView && elTabs.scrollWidth > elTabs.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // the colour tab: presets, then a body colour and a details colour from the palette
  function paintColour() {
    const list = LIVERIES[sel] || [], cur = garage.liveryOf(sel), cu = parseLivery(cur);
    const hex = c => c.replace('#', '').toLowerCase();
    const bodyHex = cu ? hex(cu.body) : null, trimHex = cu && cu.trim ? hex(cu.trim) : null;
    const chip = (key, color, label, on, extra = '') => `<button class="gx-chip${extra}" data-nav data-gx="${key}" data-name="${esc(label)}" aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}" style="--sw:${esc(color)}" type="button"></button>`;
    const palName = c => { const p = PALETTE.find(x => x.color === c); return p ? nm(p) : ''; };
    const byId = ids => ids.map(id => PALETTE.find(p => p.id === id)).filter(Boolean);
    const bodyPal = byId(BODY_IDS), trimPal = byId(TRIM_IDS);
    const presetName = cu ? '' : (list.find(l => l.id === cur) ? nm(list.find(l => l.id === cur)) : '');
    return `<div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(tr('livery'))}<small data-def="${esc(presetName)}">${esc(presetName)}</small></span></div>
        <div class="gx-chips">${list.map(l => chip('liv:' + l.id, l.color, nm(l), !cu && cur === l.id)).join('')}</div></div>
      <div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(tr('body'))}<small data-def="${esc(bodyHex ? palName('#' + bodyHex) : '')}">${esc(bodyHex ? palName('#' + bodyHex) : '')}</small></span></div>
        <div class="gx-chips">${bodyPal.map(p => chip('bd:' + hex(p.color), p.color, nm(p), !!cu && bodyHex === hex(p.color))).join('')}</div></div>
      <div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(tr('trim'))}<small data-def="${esc(trimHex ? palName('#' + trimHex) : (cu ? tr('auto') : ''))}">${esc(trimHex ? palName('#' + trimHex) : (cu ? tr('auto') : ''))}</small></span></div>
        <div class="gx-chips">${chip('tr:', '#2a1c23', tr('auto'), !!cu && !trimHex, ' none')}${trimPal.map(p => chip('tr:' + hex(p.color), p.color, nm(p), !!cu && trimHex === hex(p.color))).join('')}</div></div>`;
  }
  function paintParts(c) {
    return c.parts.map(pid => {
      const opts = partOpts(pid, sel); if (!opts.length) return '';
      const P = partById(pid), eq = garage.partsOf(sel)[pid] || '', pend = pending && pending.part === pid ? pending.id : null;
      return `<div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(nm(P))}</span><button class="gx-stock" data-nav data-gx="opt:${pid}:" aria-pressed="${eq === ''}" type="button"><span>${esc(pid === 'sub' || pid === 'roof' || pid === 'load' || pid === 'box' || pid === 'screen' ? tr('none') : tr('stock'))}</span></button></div>
        <div class="gx-grid">${opts.map(o => {
          const own = garage.ownsPart(pid, o.id), dot = pid === 'neon' ? `<span class="gx-dot${o.id === 'arcobaleno' ? ' rb' : ''}" style="--dot:${esc(o.color || '#fff')}"></span>` : '';
          return `<button class="pd-btn sm pd-liv gx-card${own ? '' : ' gx-lock'}${pend === o.id ? ' gx-pend' : ''}" data-nav data-gx="opt:${pid}:${o.id}" aria-pressed="${eq === o.id}" type="button"><span class="pd-in"><span class="pd-l1">${dot}${esc(nm(o))}</span></span>${priceTag(own, o.price)}</button>`;
        }).join('')}</div></div>`;
    }).join('');
  }
  function paintBody() {
    const c = categoriesFor(sel).find(x => x.id === cat) || categoriesFor(sel)[0];
    elM2.innerHTML = `<div class="gx-body">${c.paint ? paintColour() : paintParts(c)}</div>`;
  }
  function paintFoot() {
    const back = `<button class="pd-btn sm" data-nav data-gx="back" type="button"><span class="pd-in"><span class="pd-l1">${esc(step === 1 ? tr('back') : '◀ ' + tr('vehicles'))}</span></span></button>`;
    let main = '';
    if (step === 1) {
      const v = vehicleById(sel);
      if (garage.ownsVehicle(sel)) main = `<button class="pd-btn sm drive gx-go" data-nav data-gx="next" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('next'))} ▶</span></span></button>`;
      else if (garage.cash >= v.price) main = `<button class="pd-btn sm drive gx-go" data-nav data-gx="buyv" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('buy'))} · ${eur(v.price)}</span></span></button>`;
      else main = `<div class="gx-need">${esc(tr('need'))}<b>${eur(v.price - garage.cash)}</b></div>`;
    } else if (pending) {
      const price = garage.partPrice(pending.part, pending.id);
      if (garage.cash >= price) main = `<button class="pd-btn sm drive gx-go" data-nav data-gx="buyp" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('buy'))} · ${eur(price)}</span></span></button>`;
      else main = `<div class="gx-need">${esc(tr('need'))}<b>${eur(price - garage.cash)}</b></div>`;
    } else main = `<button class="pd-btn sm drive gx-go" data-nav data-gx="done" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('done'))} ✓</span></span></button>`;
    elFoot.innerHTML = back + main;
  }
  function paintAll() {
    keep(() => {
      elTabs.hidden = step !== 2; elM1.hidden = step !== 1; elM2.hidden = step !== 2;
      paintHead(); paintFoot();
      if (step === 1) paintBases(); else { paintTabs(); paintBody(); }
    });
  }

  // ---- actions ----
  const flash = msg => { popMsg = msg; popT = 1.6; };
  function focusFirst() {
    const el = step === 1 ? elM1.querySelector(`[data-gx="base:${sel}"]`) : elTabs.querySelector('[aria-pressed=true]');
    if (el) el.focus({ preventScroll: true });
  }
  function toStep(n) {
    step = n; pending = null; hv = null;
    if (n === 2) { garage.setVehicle(sel); const cats = categoriesFor(sel); cat = cats.some(c => c.id === lastCat[sel]) ? lastCat[sel] : 'paint'; if (Q.get('gcat') && cats.some(c => c.id === Q.get('gcat')) && !lastCat[sel]) cat = Q.get('gcat'); }
    paintAll(); showPreview(); focusFirst();
  }
  function setCat(c) { if (c === cat) return; cat = c; lastCat[sel] = c; pending = null; hv = null; paintAll(); showPreview(); }
  function goBack() {
    if (step === 2) { toStep(1); return true; }
    return false;
  }
  function buyVehicle() {
    if (!garage.buyVehicle(sel)) return;
    flash(tr('bought')); toStep(2);
  }
  function buyPart() {
    if (!pending) return;
    const p = pending;
    if (garage.buyPart(p.part, p.id)) { pending = null; garage.setPart(p.part, p.id, sel); flash(tr('bought')); paintAll(); showPreview(); }
  }
  function pickBase(id, e) {
    const was = downSel; sel = id; pending = null;
    const touchFirst = lastPtr === 'touch' && e.detail && was !== id;
    if (garage.ownsVehicle(id) && !touchFirst) return toStep(2);
    paintDetail(); paintFoot(); showPreview();
  }
  function pickOpt(part, id) {
    if (id === '' || garage.ownsPart(part, id)) { pending = null; garage.setPart(part, id, sel); } else pending = { k: 'part', part, id };
    if (part === 'horn' && id) vehicle.testHorn();
    hv = { k: 'part', part, id };
    paintAll(); showPreview();
  }
  function pickLiv(id) { pending = null; hv = null; garage.setLivery(id, sel); paintAll(); showPreview(); }
  function pickBody(hex) {
    const cu = parseLivery(garage.liveryOf(sel)); pickLiv(customLivery('#' + hex, cu && cu.trim ? cu.trim : null));
  }
  function pickTrim(hex) {
    const cur = garage.liveryOf(sel), cu = parseLivery(cur);
    const body = cu ? cu.body : ((LIVERIES[sel] || []).find(l => l.id === cur) || { color: '#f2f0ea' }).color;
    pickLiv(customLivery(body, hex ? '#' + hex : null));
  }
  function click(e) {
    const b = e.target.closest && e.target.closest('[data-gx]'); if (!b) return;
    const [k, a, c] = b.dataset.gx.split(':');
    if (k === 'base') pickBase(a, e);
    else if (k === 'tab') setCat(a);
    else if (k === 'opt') pickOpt(a, c || '');
    else if (k === 'liv') pickLiv(a);
    else if (k === 'bd') pickBody(a);
    else if (k === 'tr') pickTrim(a);
    else if (k === 'next') toStep(2);
    else if (k === 'back') { if (!goBack() && onExit) onExit(); }
    else if (k === 'done') { if (onExit) onExit(); }
    else if (k === 'buyv') buyVehicle();
    else if (k === 'buyp') buyPart();
  }
  // browsing: the option under the pointer or the keyboard focus is previewed without being fitted
  function browse(next) {
    const same = (hv === null && next === null) || (hv && next && hv.k === next.k && hv.id === next.id && hv.part === next.part);
    if (same) return;
    hv = next; showPreview();
  }
  // colour chips carry no label: the row caption shows the name of the one under the pointer or focus
  function caption(el) {
    for (const sm of elM2.querySelectorAll('.gx-sn small[data-def]')) sm.textContent = sm.dataset.def;
    const sec = el && el.closest && el.closest('.gx-sec'), sm = sec && sec.querySelector('.gx-sn small[data-def]');
    if (sm && el.dataset.name) sm.textContent = el.dataset.name;
  }
  const hvOf = el => {
    const [k, a, c] = el.dataset.gx.split(':');
    if (k === 'opt') return { k: 'part', part: a, id: c || '' };
    if (k === 'liv') return { k: 'liv', id: a };
    if (k === 'bd') { const cu = parseLivery(garage.liveryOf(sel)); return { k: 'liv', id: customLivery('#' + a, cu && cu.trim ? cu.trim : null) }; }
    if (k === 'tr') { const cur = garage.liveryOf(sel), cu = parseLivery(cur), body = cu ? cu.body : ((LIVERIES[sel] || []).find(l => l.id === cur) || { color: '#f2f0ea' }).color; return { k: 'liv', id: customLivery(body, a ? '#' + a : null) }; }
    return null;
  };
  root.addEventListener('click', click);
  root.addEventListener('pointerdown', e => { lastPtr = e.pointerType || 'mouse'; downSel = sel; }, true);
  root.addEventListener('focusin', e => {
    const b = e.target.closest && e.target.closest('[data-gx]'); if (!b) return;
    const [k, a] = b.dataset.gx.split(':');
    if (k === 'base') { if (sel !== a) { sel = a; pending = null; paintDetail(); paintFoot(); showPreview(); } }
    else if (k === 'tab') setCat(a);
    else { browse(hvOf(b)); caption(b); }
  });
  root.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target.closest && e.target.closest('[data-gx]'); if (!b) return;
    const [k, a] = b.dataset.gx.split(':');
    if (k === 'base') { if (sel !== a) { sel = a; pending = null; paintDetail(); paintFoot(); showPreview(); } }
    else { browse(hvOf(b)); caption(b); }
  });
  root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { if (hv) browse(null); caption(null); } });
  garage.onChange(() => { if (entered) { paintAll(); } });   // a fare paid while the garage is open updates the wallet

  return {
    enter() {
      entered = true; sel = Q.get('gveh') && vehicleById(Q.get('gveh')) ? vehicleById(Q.get('gveh')).id : garage.type; pending = null; hv = null; popT = 0;
      vehicle.setShowcase(true); cam.a = vehicle.car.th + 2.4; cam.orbit = cam.a;
      step = 1; paintAll(); showPreview();
      if (Q.get('gstep') === '2' && garage.ownsVehicle(sel)) toStep(2);
    },
    leave() { entered = false; pending = null; hv = null; vehicle.preview(null); vehicle.setShowcase(false); },
    render() { if (entered) paintAll(); },
    applyLang() { if (entered) paintAll(); },
    // Esc / B: one step back; returns false at step 1 so the shell leaves the garage
    back() { return entered ? goBack() : false; },
    // the control the shell focuses when the screen opens
    focusEl() { return step === 1 ? elM1.querySelector(`[data-gx="base:${sel}"]`) : elTabs.querySelector('[aria-pressed=true]'); },
    tick(dt) { if (popT > 0) { popT -= dt; if (popT <= 0) keep(paintHead); } },
    // camera for the title state: a slow orbit close to the vehicle, moving in on what you are browsing
    cam(c, sec) {
      const dt = clamp(sec - camSec, 0, 0.1); camSec = sec;
      if (c.fov !== 40) { c.fov = 40; c.updateProjectionMatrix(); }
      const car = vehicle.car, gy = groundY(car.x, car.z), k = car.kind === 'bike' ? 0.72 : car.kind === 'car' ? 1.18 : 1;
      const F = step === 2 && FOCUS[cat] ? FOCUS[cat] : { mode: 'orbit', d: 8.4, h: 3.0, ly: 0.75 };
      if (!Q.has('gfix')) cam.orbit += dt * 0.32;   // ?gfix freezes the turn (screenshots)
      const want = F.mode === 'rear' ? car.th + Math.PI + Math.sin(sec * 0.4) * 0.45 : F.mode === 'side' ? car.th + 1.25 + Math.sin(sec * 0.4) * 0.3 : cam.orbit;
      // swing round walls: from the wanted angle, the nearest one with a clear line of sight to the vehicle (and a shorter lens if none)
      const clear = (a, d) => !vehicle.sightClear || vehicle.sightClear(car.x, car.z, car.x + Math.sin(a) * d, car.z + Math.cos(a) * d);
      const dd = F.d * k;
      let goal = want, dist = dd;
      if (!clear(want, dd)) {
        let found = false;
        for (let n = 1; n <= 12 && !found; n++) for (const sg of [1, -1]) { const a = want + sg * n * 0.26; if (clear(a, dd)) { goal = a; found = true; break; } }
        if (!found) { dist = dd * 0.5; goal = want; for (let n = 0; n <= 12; n++) { const a = want + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.26; if (clear(a, dist)) { goal = a; break; } } }
      }
      const e = 1 - Math.exp(-3 * dt);
      cam.a += wrapA(goal - cam.a) * (F.mode === 'orbit' ? clamp(dt * 5, 0, 1) : e);
      cam.d += (dist - cam.d) * e; cam.h += (F.h * (k < 1 ? 0.8 : 1) - cam.h) * e; cam.ly += (F.ly * (k < 1 ? 1.1 : 1) - cam.ly) * e;
      c.position.set(car.x + Math.sin(cam.a) * cam.d, gy + cam.h + Math.sin(sec * 0.23) * 0.2, car.z + Math.cos(cam.a) * cam.d);
      c.lookAt(car.x, gy + cam.ly, car.z);
      c.translateX(0.36 * cam.d);   // the vehicle sits left of centre, the panel on the right
    },
  };
}
