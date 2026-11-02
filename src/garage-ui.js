// The Garage screen, in two steps (and a side room for the driver). Owned by the driving work; src/ui.js (the shell) mounts it into its 'garage' screen and forwards enter/leave,
// the language and the Back key (garageUI.back()). The place itself (workshop, turntable, camera, lights) is src/garage-scene.js: this file only
// tells it which look to show and where to look.
//   Step 1  BASE: pick one of the bases (lape, scooters, the hatchback) with its description and handling bars, a live 3D view, the price when locked.
//   Step 2  CUSTOMISE: one tab per category (colour, wheels, stance, trim, exhaust, spoiler, neon, stickers, horn, extras), only what fits that base.
//           Hovering or focusing an option previews it on the model; clicking an owned option fits it, clicking a new one asks to buy it.
//   Driver  "Il tuo autista" (from step 1): make the person who drives the lapa, from the Universal LPC layers (src/driver-compose.js, loaded when the screen opens); src/driver.js keeps and shows it.
// Every base keeps its own setup (src/garage.js). Money comes from fares ("Turisti affamati" credits src/garage.js).
// Test links: ?ui=garage&gveh=vespa&gstep=2&gcat=neon&gfix (still camera) &gnight / &gday (the workshop's light); &gstep=driver&gtab=clothes opens the driver screen (&gdrv=rnd: a random driver)
import { driver } from './driver.js';
import { garage, LIVERIES, PALETTE, categoriesFor, partOpts, partById, vehicleById, customLivery, parseLivery } from './garage.js';
import { esc } from './esc.js';


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
  driver: ['Il tuo autista', 'Your driver'], who: ['Chi guida?', 'Who drives?'], driverBtn: ['Autista', 'Driver'], random: ['Casuale', 'Random'], orig: ['Originale', 'Original'], loading: ['Un attimo…', 'One moment…'],
  tBody: ['Corpo', 'Body'], tHair: ['Capelli', 'Hair'], tHead: ['Testa', 'Head'], tClothes: ['Vestiti', 'Clothes'],
  sBody: ['Corporatura', 'Build'], sAge: ['Età', 'Age'], sSkin: ['Pelle', 'Skin'], sEye: ['Occhi', 'Eyes'], sHair: ['Taglio', 'Style'], sHairCol: ['Colore', 'Colour'], sBeard: ['Barba', 'Beard'],
  sGlasses: ['Occhiali', 'Glasses'], sHat: ['Cappello', 'Hat'], sHatCol: ['Colore del cappello', 'Hat colour'], sTop: ['Maglia', 'Top'], sTopCol: ['Colore della maglia', 'Top colour'],
  sBottom: ['Sotto', 'Bottom'], sBotCol: ['Colore', 'Colour'], sShoes: ['Scarpe', 'Shoes'], sShoeCol: ['Colore delle scarpe', 'Shoe colour'], sExtra: ['Extra', 'Extras'],
  man: ['Uomo', 'Man'], woman: ['Donna', 'Woman'], young: ['Giovane', 'Young'], older: ['Anziano', 'Older'],
  scarf: ['Sciarpa rosanero', 'Rosanero scarf'], chain: ['Catena d\'oro', 'Gold chain'], earring: ['Orecchino', 'Earring'], tattoo: ['Tatuaggi', 'Tattoos'], leather: ['Giubbotto di pelle', 'Leather jacket'],
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
/* the driver screen */
.gx-port { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; padding: 4px 8px; background: rgba(255,255,255,.06); border-radius: 4px; box-shadow: inset 0 0 0 2px rgba(255,255,255,.12); }
.gx-port canvas { height: clamp(66px, 17vh, 118px); width: auto; image-rendering: pixelated; }
.gx-wait { padding: 18px 4px; text-align: center; font: 700 clamp(13px, 3vh, 18px)/1.2 var(--pd-cond); letter-spacing: .16em; text-transform: uppercase; color: var(--pd-amber); }
.gx-foot.f3 .pd-btn { flex: 1 1 0; min-width: 0; padding-left: 2px; padding-right: 2px; }
.gx-foot.f3 .pd-l1 { font-size: clamp(12px, 2.9vh, 17px); }
.gx-foot.f3 .gx-go, .gx-foot.f3 .gx-need { flex: 1.5 1 0; }
.gx-foot.f3 .gx-need { font-size: clamp(11px, 2.5vh, 15px); }
html.pd-in-garage :is(#where, #speed, #mini, #help, #attrib, .tc) { visibility: hidden !important; }   /* the street HUD and the touch pads belong to the street */
`;

// camera focus for the category being browsed: where to look from
const FOCUS = {
  wheels: { mode: 'side', d: 5.4, h: 1.1, ly: 0.4 }, stance: { mode: 'side', d: 5.2, h: 0.8, ly: 0.4 }, trim: { mode: 'orbit', d: 6.4, h: 1.7, ly: 0.7 },
  spoiler: { mode: 'rear', d: 5.6, h: 1.9, ly: 0.9 }, exhaust: { mode: 'rear', d: 5.0, h: 1.0, ly: 0.45 }, extra: { mode: 'rear', d: 6.4, h: 2.4, ly: 1.0 }, upgrade: { mode: 'orbit', d: 7.4, h: 2.3, ly: 0.9 },
  driver: { mode: 'orbit', d: 4.6, h: 2.3, ly: 1.2 }, stickers: { mode: 'side', d: 5.6, h: 1.4, ly: 0.7 }, neon: { mode: 'orbit', d: 5.8, h: 0.9, ly: 0.2 }, horn: { mode: 'orbit', d: 7, h: 2.2, ly: 0.7 },
};

export function setupGarageUI({ screen, button, scene, getLang, onExit }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const root = screen.querySelector('.gx-root'), card = screen.querySelector('.pd-garage');
  scene.setPanel(() => card ? card.offsetWidth : 0);
  scene.setInput(screen, card);                          // drag to turn round the vehicle, pinch or wheel to zoom; not over the panel   // the scene frames the vehicle in the space left of the panel
  button.hidden = false;
  const Q = new URLSearchParams(location.search);   // test links: ?ui=garage&gveh=vespa&gstep=2&gcat=neon
  let step = 1, sel = garage.type, cat = 'paint', pending = null, hv = null, popMsg = '', popT = 0, entered = false, lastPtr = 'mouse', downSel = null;
  const lastCat = {};
  const D = { dc: null, M: null, spec: null, tab: 'body', ver: 0, idle: null, wait: false };   // the driver screen: the composer (loaded on first use), its manifest, the options being edited
  const li = () => getLang() === 'it' ? 0 : 1;
  const tr = k => S[k][li()];
  const nm = o => li() === 0 ? o.name_it : o.name_en;
  const baseName = v => nm(v);
  const shortName = v => (SHORT[v.id] ? SHORT[v.id][li()] : nm(v));

  root.innerHTML = '<div class="gx-head"></div><div class="gx-tabs" hidden></div><div class="gx-main gx-m1"></div><div class="gx-main gx-m2" hidden></div><div class="gx-main gx-m3" hidden></div><div class="gx-foot"></div>';
  const $ = q => root.querySelector(q);
  const elHead = $('.gx-head'), elTabs = $('.gx-tabs'), elM1 = $('.gx-m1'), elM2 = $('.gx-m2'), elM3 = $('.gx-m3'), elFoot = $('.gx-foot');
  const elBody = () => (step === 3 ? elM3 : elM2);

  // ---- what is shown on the vehicle: the base you browse, its saved setup, then the option you clicked (pending) and the one under the pointer / focus (hv) ----
  function previewLook() {
    if (step === 3) return garage.lookOf('calessino');   // the driver sits in a lapa
    const l = garage.lookOf(sel);
    if (step === 2) for (const o of [pending, hv]) { if (!o) continue; if (o.k === 'liv') l.livery = o.id; else if (o.id) l.parts[o.part] = o.id; else delete l.parts[o.part]; }
    return l;
  }
  function showPreview() {
    scene.setFocus(step === 2 ? FOCUS[cat] : step === 3 ? FOCUS.driver : null);
    scene.setLook(previewLook());
  }

  // ---- small renderers ----
  const priceTag = (owned, price) => owned ? '<span class="gx-tag">✓</span>' : `<span class="gx-tag">${eur(price)}</span>`;
  function keep(fn) {   // run a repaint and put the focus back on the same control
    const a = document.activeElement, fk = a && root.contains(a) ? a.dataset.gx : null, sc = elBody().querySelector('.gx-body') ? elBody().querySelector('.gx-body').scrollTop : 0;
    fn();
    const b = elBody().querySelector('.gx-body'); if (b) b.scrollTop = sc;
    if (fk) { const el = [...root.querySelectorAll('[data-gx]')].find(e => e.dataset.gx === fk); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
  }
  function paintHead() {
    const v = vehicleById(sel);
    const crumb = popT > 0 ? `<span class="gx-crumb pop">${esc(popMsg)}</span>` : `<span class="gx-crumb">${step === 3 ? esc(tr('who')) : `${esc(tr('step'))} ${step} / 2`}</span>`;
    elHead.innerHTML = `<div class="gx-ttl"><h2 class="pd-h">${esc(step === 1 ? tr('pick') : step === 3 ? tr('driver') : baseName(v))}</h2>${crumb}</div><div class="gx-cash">${eur(garage.cash)}</div>`;
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
  const DTABS = [['body', 'tBody'], ['hair', 'tHair'], ['head', 'tHead'], ['clothes', 'tClothes']];
  function paintTabs() {
    if (step === 3) { elTabs.innerHTML = DTABS.map(([id, k]) => `<button class="pd-segb" data-nav data-gx="dtab:${id}" aria-pressed="${D.tab === id}" type="button"><span>${esc(tr(k))}</span></button>`).join(''); return; }
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
      return `<div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(nm(P))}${P.hint_it ? `<small>${esc(li() === 0 ? P.hint_it : P.hint_en)}</small>` : ''}</span><button class="gx-stock" data-nav data-gx="opt:${pid}:" aria-pressed="${eq === ''}" type="button"><span>${esc(pid === 'sub' || pid === 'roof' || pid === 'load' || pid === 'box' || pid === 'screen' || pid === 'swim' || pid === 'fly' ? tr('none') : tr('stock'))}</span></button></div>
        <div class="gx-grid">${opts.map(o => {
          const own = garage.ownsPart(pid, o.id), dot = pid === 'neon' ? `<span class="gx-dot${o.id === 'arcobaleno' ? ' rb' : ''}" style="--dot:${esc(o.color || '#fff')}"></span>` : '';
          return `<button class="pd-btn sm pd-liv gx-card${own ? '' : ' gx-lock'}${pend === o.id ? ' gx-pend' : ''}" data-nav data-gx="opt:${pid}:${o.id}" aria-pressed="${eq === o.id}" type="button"><span class="pd-in"><span class="pd-l1">${dot}${esc(nm(o))}</span></span>${priceTag(own, o.price)}</button>`;
        }).join('')}</div></div>`;
    }).join('');
  }
  // ---- the driver screen: rows of choices for the tab; every click edits the spec, then the picture is composed again (src/driver-compose.js)
  function paintDriver() {
    if (!D.M || !D.spec) return `<div class="gx-wait">${esc(tr('loading'))}</div>`;
    const sp = D.spec, O = D.M.options, nameOf = o => o.name[li()], vis = list => list.filter(o => o.bodies.includes(sp.body));
    const chips = (field, list, cur) => `<div class="gx-chips">${list.map(o => `<button class="gx-chip" data-nav data-gx="dsp:${field}:${o.id}" data-name="${esc(nameOf(o))}" aria-pressed="${cur === o.id}" aria-label="${esc(nameOf(o))}" title="${esc(nameOf(o))}" style="--sw:${esc(o.sw)}" type="button"></button>`).join('')}</div>`;
    const cards = (field, list, cur) => `<div class="gx-grid">${list.map(o => `<button class="pd-btn sm pd-liv gx-card" data-nav data-gx="dsp:${field}:${o.id}" aria-pressed="${cur === o.id}" type="button"><span class="pd-in"><span class="pd-l1">${esc(nameOf(o))}</span></span></button>`).join('')}</div>`;
    const sec = (k, cur, list, body) => { const n = cur && list ? (list.find(o => o.id === cur) || { name: ['', ''] }).name[li()] : ''; return `<div class="gx-sec"><div class="gx-sh"><span class="gx-sn">${esc(tr(k))}${cur !== undefined ? `<small data-def="${esc(n)}">${esc(n)}</small>` : ''}</span></div>${body}</div>`; };
    const toggle = (fx, on) => `<button class="pd-btn sm pd-liv gx-card" data-nav data-gx="dtg:${fx}" aria-pressed="${on}" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr(fx))}</span></span></button>`;
    const two = (field, a, b, cur) => `<div class="gx-grid">${[a, b].map(([id, k]) => `<button class="pd-btn sm pd-liv gx-card" data-nav data-gx="dsp:${field}:${id}" aria-pressed="${cur === id}" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr(k))}</span></span></button>`).join('')}</div>`;
    const hatTints = sp.hat === 'coppola' || sp.hat === 'cap';
    if (D.tab === 'body') return sec('sBody', undefined, null, two('body', ['male', 'man'], ['female', 'woman'], sp.body)) + sec('sAge', undefined, null, two('old', ['young', 'young'], ['old', 'older'], sp.old ? 'old' : 'young'))
      + sec('sSkin', sp.skin, O.skin, chips('skin', O.skin, sp.skin)) + sec('sEye', sp.eye, O.eye, chips('eye', O.eye, sp.eye));
    if (D.tab === 'hair') return sec('sHair', undefined, null, cards('hair', vis(O.hair), sp.hair)) + sec('sHairCol', sp.hairCol, O.hairCol, chips('hairCol', O.hairCol, sp.hairCol)) + sec('sBeard', undefined, null, cards('beard', vis(O.beard), sp.beard));
    if (D.tab === 'head') return sec('sGlasses', undefined, null, cards('glasses', O.glasses, sp.glasses)) + sec('sHat', undefined, null, cards('hat', O.hat, sp.hat))
      + (hatTints ? sec('sHatCol', sp.hatCol, O.cloth, chips('hatCol', O.cloth, sp.hatCol)) : '') + sec('sExtra', undefined, null, `<div class="gx-grid">${toggle('earring', sp.earring)}</div>`);
    return sec('sTop', undefined, null, cards('top', vis(O.top), sp.top)) + sec('sTopCol', sp.topCol, O.cloth, chips('topCol', O.cloth, sp.topCol))
      + sec('sBottom', undefined, null, cards('bottom', vis(O.bottom), sp.bottom)) + sec('sBotCol', sp.botCol, O.cloth, chips('botCol', O.cloth, sp.botCol))
      + sec('sShoes', undefined, null, cards('shoes', vis(O.shoes), sp.shoes)) + sec('sShoeCol', sp.shoeCol, O.cloth, chips('shoeCol', O.cloth, sp.shoeCol))
      + sec('sExtra', undefined, null, `<div class="gx-grid">${toggle('scarf', sp.scarf)}${toggle('chain', sp.chain)}${toggle('tattoo', sp.tattoo)}${/^(long|longpolo)$/.test(sp.top) ? toggle('leather', sp.leather) : ''}</div>`);
  }
  function drawPortrait() {   // the standing person, front, side and back, next to each other (the pictures are 64 pixels, shown big and sharp)
    const cv = elM3.querySelector('.gx-port canvas'); if (!cv || !D.idle) return;
    const g = cv.getContext('2d'), im = g.createImageData(192, 64);
    ['front', 'left', 'back'].forEach((d, k) => { const f = D.idle[d]; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, o = (y * 192 + k * 64 + x) * 4; im.data[o] = f[i]; im.data[o + 1] = f[i + 1]; im.data[o + 2] = f[i + 2]; im.data[o + 3] = f[i + 3]; } });
    g.putImageData(im, 0, 0);
  }
  async function composeDriver() {
    const my = ++D.ver;
    try {
      const out = await D.dc.compose(D.spec); if (my !== D.ver) return;
      D.idle = out.idle; D.spec = out.spec; driver.set(out.sit, out.spec); drawPortrait();
    } catch (e) { console.warn('driver compose failed', e); }
  }
  async function toDriver() {
    step = 3; pending = null; hv = null; paintAll(); showPreview(); focusFirst();
    try {
      if (!D.dc) { D.dc = await import('./driver-compose.js'); D.M = await D.dc.loadManifest(); }
      if (step !== 3) return;
      if (!D.spec) D.spec = D.dc.cleanSpec(driver.spec() || (Q.get('gdrv') === 'rnd' ? D.dc.randomSpec() : D.dc.defaultSpec()));
      paintAll(); await composeDriver();
    } catch (e) { console.warn('driver screen failed', e); }
  }
  function setDrv(field, id) {
    if (!D.spec) return;
    const sp = { ...D.spec };
    if (field === 'old') sp.old = id === 'old'; else sp[field] = id;
    D.spec = D.dc.cleanSpec(sp); paintAll(); composeDriver();
  }
  function toggleDrv(fx) { if (!D.spec) return; D.spec = D.dc.cleanSpec({ ...D.spec, [fx]: !D.spec[fx] }); paintAll(); composeDriver(); }
  function randomDrv() { if (!D.dc || !D.M) return; D.spec = D.dc.randomSpec(); paintAll(); composeDriver(); }
  function originalDrv() { driver.clear(); D.spec = null; D.idle = null; flash(tr('orig') + ' ✓'); toStep(1); }   // back to the blocky 3D driver; the next visit starts again from the default person
  function paintBody() {
    if (step === 3) { elM3.innerHTML = `<div class="gx-port"><canvas width="192" height="64"></canvas></div><div class="gx-body">${paintDriver()}</div>`; drawPortrait(); return; }
    const c = categoriesFor(sel).find(x => x.id === cat) || categoriesFor(sel)[0];
    elM2.innerHTML = `<div class="gx-body">${c.paint ? paintColour() : paintParts(c)}</div>`;
  }
  function paintFoot() {
    const back = `<button class="pd-btn sm" data-nav data-gx="back" type="button"><span class="pd-in"><span class="pd-l1">${esc(step === 1 ? tr('back') : '◀ ' + tr('vehicles'))}</span></span></button>`;
    const drv = `<button class="pd-btn sm" data-nav data-gx="driver" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('driverBtn'))}</span></span></button>`;
    let main = '';
    if (step === 3) {
      elFoot.className = 'gx-foot f3'; elFoot.innerHTML = back + `<button class="pd-btn sm" data-nav data-gx="drrnd" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('random'))}</span></span></button><button class="pd-btn sm" data-nav data-gx="drorig" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('orig'))}</span></span></button><button class="pd-btn sm drive gx-go" data-nav data-gx="done" type="button"><span class="pd-in"><span class="pd-l1">${esc(tr('done'))} ✓</span></span></button>`;
      return;
    }
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
    elFoot.className = step === 1 ? 'gx-foot f3' : 'gx-foot'; elFoot.innerHTML = back + (step === 1 ? drv : '') + main;
  }
  function paintAll() {
    keep(() => {
      elTabs.hidden = step === 1; elM1.hidden = step !== 1; elM2.hidden = step !== 2; elM3.hidden = step !== 3;
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
    step = n; pending = null; hv = null; D.ver++;
    if (n === 2) { garage.setVehicle(sel); const cats = categoriesFor(sel); cat = cats.some(c => c.id === lastCat[sel]) ? lastCat[sel] : 'paint'; if (Q.get('gcat') && cats.some(c => c.id === Q.get('gcat')) && !lastCat[sel]) cat = Q.get('gcat'); }
    paintAll(); showPreview(); focusFirst();
  }
  function setCat(c) { if (c === cat) return; cat = c; lastCat[sel] = c; pending = null; hv = null; paintAll(); showPreview(); }
  function goBack() {
    if (step === 2 || step === 3) { toStep(1); return true; }
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
    if (part === 'horn' && id) scene.testHorn();
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
    else if (k === 'driver') toDriver();
    else if (k === 'dtab') { D.tab = a; paintAll(); }
    else if (k === 'dsp') setDrv(a, c);
    else if (k === 'dtg') toggleDrv(a);
    else if (k === 'drrnd') randomDrv();
    else if (k === 'drorig') originalDrv();
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
    for (const sm of elBody().querySelectorAll('.gx-sn small[data-def]')) sm.textContent = sm.dataset.def;
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
    else if (k === 'dtab') { if (D.tab !== a) { D.tab = a; paintAll(); } }
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
      document.documentElement.classList.add('pd-in-garage'); scene.enter(garage.lookOf(sel));
      step = 1; paintAll(); showPreview();
      if (Q.get('gstep') === '2' && garage.ownsVehicle(sel)) toStep(2);
      if (Q.get('gstep') === 'driver') { if (Q.get('gtab') && DTABS.some(t => t[0] === Q.get('gtab'))) D.tab = Q.get('gtab'); toDriver(); }
    },
    leave() { entered = false; pending = null; hv = null; scene.leave(); document.documentElement.classList.remove('pd-in-garage'); },
    render() { if (entered) paintAll(); },
    applyLang() { if (entered) paintAll(); },
    // Esc / B: one step back; returns false at step 1 so the shell leaves the garage
    back() { return entered ? goBack() : false; },
    // the control the shell focuses when the screen opens
    focusEl() { return step === 1 ? elM1.querySelector(`[data-gx="base:${sel}"]`) : elTabs.querySelector('[aria-pressed=true]'); },
    tick(dt) { if (popT > 0) { popT -= dt; if (popT <= 0) keep(paintHead); } },
  };
}
