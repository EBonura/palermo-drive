// Title screen, main menu, options, credits, the start picker (map and list) and the in-game side menu. Owned by the game-shell work.
// game.state: 'title' | 'play' | 'pause'; call game.start(), game.pause(), game.resume(). 'pause' is the side menu: the simulation is stopped, the
// world keeps drawing behind the panel so option changes show at once. Menu to game, game to menu and a new start point all go through
// transition() (src/transition.js), which stays covered until the world around the start has streamed in.
// Change game.settings ({ quality: 'low'|'medium'|'high', drawDistance: 0.5..1.5, volume: 0..1,
// units: 'kmh'|'mph', camera: 0..3 }) and then call applySettings().
//
// Everything is created from JS (styles in ui.css). Debug/test links: ?ui=menu|options|credits|spots
// opens that screen (?ui=none hides the shell, ?rs=PX pre-scrolls the credits), ?play&ui=pause opens the side menu (?ui=collections the Collezioni
// card, ?ui=start the picker, &view=list its list), ?tt=SECONDS shifts the title flyover, ?lang=en|it, ?ui=garage (with ?fakeliv to stub vehicle.LIVERIES),
// ?fakeevents stubs missions.events() with a few pins (and ?fakeprogress the progress calls) until the events work lands.

import { setupGarageUI } from './garage-ui.js';   // the Garage screen (vehicles, paint, tamarro parts) lives in its own module
import { createGarageScene } from './garage-scene.js';   // the place it happens in: its own scene, not the street
import { transition } from './transition.js';     // rosanero squares + spinning lapa, covers loading
import { createStartMap } from './startmap.js';   // the illustrated city map of the start picker

const SETTINGS_KEY = 'palermoDrive.settings.v1';

// ---------------------------------------------------------------------------------------------
// Strings: [italiano, english]. The language option decides which one is large.
// ---------------------------------------------------------------------------------------------
const S = {
  tapTouch: ['Tocca per iniziare', 'Tap to start'],
  tapKey: ['Premi per iniziare', 'Press to start'],
  drive: ['Guida', 'Drive'],
  options: ['Opzioni', 'Options'],
  credits: ['Crediti', 'Credits'],
  back: ['Indietro', 'Back'],
  menu: ['Menu', 'Menu'],
  resume: ['Riprendi', 'Resume'],
  changeStart: ['Cambia partenza', 'Change start'],
  quit: ['Esci al menu', 'Back to menu'],
  quitBusy: ['Lasci l\'evento in corso', 'You drop the current event'],
  collections: ['Collezioni', 'Collections'],
  radioNext: ['Cambia brano', 'Next track'], radioPower: ['Radio', 'Radio'],
  qCam: ['Camera', 'Camera'], qReset: ['In strada', 'On the road'], qSwap: ['Mezzo', 'Ride'], qFull: ['Schermo', 'Screen'],
  colSuca: ['Graffiti SUCA e 800A', 'SUCA and 800A tags'], colSeen: ['trovati finora, su quelli visti', 'found so far, out of those seen'], colFood: ['Cibo ritrovato', 'Food found'], colRaces: ['Corse vinte', 'Races won'], colFares: ['Clienti portati', 'Fares driven'],
  colNone: ['Ancora niente', 'Nothing yet'],
  quality: ['Grafica', 'Graphics'],
  low: ['Bassa', 'Low'], medium: ['Media', 'Medium'], high: ['Alta', 'High'],
  draw: ['Distanza', 'Draw distance'],
  volume: ['Volume', 'Volume'],
  musicVolume: ['Musica', 'Music'],
  radio: ['Radio', 'Radio'],
  radioOn: ['Accesa', 'On'], radioOff: ['Spenta', 'Off'],
  units: ['Unità', 'Units'],
  camera: ['Camera iniziale', 'Default camera'],
  physics: ['Guida (test)', 'Handling (test)'], phClassic: ['Classica', 'Classic'], phSphere: ['Arcade (sfera)', 'Arcade (sphere)'],
  cam0: ['Dietro', 'Chase'], cam1: ['Alta', 'High'], cam2: ['Cabina', 'Cab'], cam3: ['Dall\'alto', 'Top-down'],
  language: ['Lingua', 'Language'],
  timeStart: ['Ora di partenza', 'Start time'], tMorning: ['Mattina', 'Morning'], tAfternoon: ['Pomeriggio', 'Afternoon'], tSunset: ['Tramonto', 'Sunset'], tNight: ['Notte', 'Night'],
  timeNow: ['Ora', 'Time'], timeSpeed: ['Scorrere del tempo', 'Time flow'], tOff: ['Fermo', 'Frozen'], tSlow: ['Lento', 'Slow'], tNormal: ['Normale', 'Normal'], tFast: ['Veloce', 'Fast'],
  garage: ['Il tuo mezzo', 'Your ride'],
  startQ: ['Da dove parti?', 'Where do you start?'],
  tabMap: ['Mappa', 'Map'], tabList: ['Lista', 'List'],
  pickLivery: ['Scegli la livrea', 'Choose a livery'],
  menuBtn: ['Menu', 'Menu'],
  fullscreen: ['Schermo intero', 'Fullscreen'],
  credCreated: ['Creato da', 'Created by'],
  credData: ['Dati e mappe', 'Data and maps'],
  credAssets: ['Modelli e suoni', 'Models and sound'],
  credFonts: ['Caratteri', 'Fonts'],
  credThanks: ['Grazie per aver guidato', 'Thanks for driving'],
  credStreet: ['Palermo, centro storico (clacson incluso)', 'Palermo\'s historic centre (horn included)'],
};

// ---------------------------------------------------------------------------------------------
// Logo: original artwork, built as inline SVG (also used by assets/ui/cover*.html).
// Retro sunset disc with slats, a skyline of domes and palms, neon script plus a chrome racing sans.
// `u` makes the gradient/filter ids unique when the logo appears more than once in a document.
// ---------------------------------------------------------------------------------------------
export function logoSVG(u = 'a') {
  const id = n => `${n}-${u}`;
  // sun disc: centre (360,136) radius 122, cut by slats that widen towards the horizon
  const SY = 136, SR = 122;
  const slats = [[SY + 18, 3], [SY + 36, 5], [SY + 55, 7], [SY + 76, 10], [SY + 100, 13]].map(([y, hh]) => `<rect x="200" y="${y}" width="320" height="${hh}" fill="#000"/>`).join('');
  return `
<svg viewBox="0 0 720 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Palermo Drive">
  <defs>
    <linearGradient id="${id('sun')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe3a0"/><stop offset=".42" stop-color="#ff9a6a"/><stop offset=".78" stop-color="#ee5a9a"/><stop offset="1" stop-color="#b83a82"/>
    </linearGradient>
    <mask id="${id('slats')}" maskUnits="userSpaceOnUse" x="200" y="0" width="320" height="320">
      <rect x="200" y="0" width="320" height="320" fill="#fff"/>${slats}
    </mask>
    <radialGradient id="${id('halo')}" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f5a9c9" stop-opacity=".45"/><stop offset=".6" stop-color="#e8559a" stop-opacity=".2"/><stop offset="1" stop-color="#e8559a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id('sil')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a1a2a"/><stop offset=".7" stop-color="#170b12"/><stop offset="1" stop-color="#0b0709"/>
    </linearGradient>
    <linearGradient id="${id('neon')}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5a9c9"/><stop offset=".5" stop-color="#f06fae"/><stop offset="1" stop-color="#e8559a"/>
    </linearGradient>
    <linearGradient id="${id('chrome')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".38" stop-color="#ffe3ef"/><stop offset=".5" stop-color="#f5a9c9"/>
      <stop offset=".52" stop-color="#e8559a"/><stop offset="1" stop-color="#b8326f"/>
    </linearGradient>
    <linearGradient id="${id('streakL')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8559a" stop-opacity="0"/><stop offset="1" stop-color="#f5a9c9"/></linearGradient>
    <linearGradient id="${id('streakR')}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#e8559a" stop-opacity="0"/><stop offset="1" stop-color="#f5a9c9"/></linearGradient>
    <linearGradient id="${id('hz')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8559a" stop-opacity="0"/><stop offset=".25" stop-color="#e8559a" stop-opacity=".8"/><stop offset=".75" stop-color="#e8559a" stop-opacity=".8"/><stop offset="1" stop-color="#e8559a" stop-opacity="0"/></linearGradient>
    <filter id="${id('glow')}" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${id('soft')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <symbol id="${id('palm')}" viewBox="-14 -30 140 206" overflow="visible">
      <path d="M49 176 C53 132 45 92 56 42 L63 42 C56 92 64 132 64 176Z" fill="currentColor"/>
      <g fill="currentColor" stroke="#f5a9c9" stroke-opacity=".5" stroke-width="1">
        <path d="M58 40 Q20 6 -12 62 Q24 30 58 40Z"/><path d="M58 40 Q22 -6 -6 14 Q30 4 58 40Z"/>
        <path d="M58 40 Q34 -22 14 -26 Q46 -12 58 40Z"/><path d="M58 40 Q50 -26 62 -34 Q72 -14 58 40Z"/>
        <path d="M58 40 Q82 -22 102 -26 Q70 -12 58 40Z"/><path d="M58 40 Q94 -6 122 14 Q86 4 58 40Z"/>
        <path d="M58 40 Q96 6 128 62 Q92 30 58 40Z"/>
        <circle cx="55" cy="46" r="4.5"/><circle cx="63" cy="47" r="4.5"/>
      </g>
    </symbol>
  </defs>

  <ellipse cx="360" cy="170" rx="310" ry="160" fill="url(#${id('halo')})"/>
  <circle cx="360" cy="${SY}" r="${SR}" fill="url(#${id('sun')})" mask="url(#${id('slats')})"/>

  <!-- skyline: a great dome, the red domes of San Giovanni degli Eremiti, campanili, palms -->
  <g fill="url(#${id('sil')})" stroke="#f5a9c9" stroke-width="1.4" stroke-opacity=".8">
    <path d="M276 268 V226 H318 V198 H402 V226 H444 V268Z"/>
    <path d="M318 198 C318 150 340 122 360 122 C380 122 402 150 402 198Z"/>
    <path d="M352 124 H368 V102 H352Z"/><path d="M349 102 Q360 82 371 102Z"/><path d="M359 86 H361 V68 H359Z"/><circle cx="360" cy="66" r="3.6"/>
    <path d="M300 226 V210 H312 V226Z" opacity=".0"/>
    <path d="M178 268 V186 H196 V268Z"/><path d="M175 186 L187 160 L199 186Z"/>
    <path d="M206 268 V222 H276 V268Z"/>
    <path d="M210 222 Q226 186 242 222Z"/><path d="M244 222 Q256 196 268 222Z"/><path d="M225 192 H227 V178 H225Z"/><path d="M255 200 H257 V188 H255Z"/>
    <path d="M120 268 V232 H178 V268Z"/>
    <path d="M444 268 V230 H500 V268Z"/>
    <path d="M450 230 Q470 192 490 230Z"/><path d="M469 196 H471 V182 H469Z"/>
    <path d="M500 268 V196 H516 V268Z"/><path d="M498 196 L508 168 L518 196Z"/>
    <path d="M516 268 V236 H586 V268Z"/>
  </g>
  <use href="#${id('palm')}" x="42" y="82" width="116" height="170" style="color:#1a0d14"/>
  <use href="#${id('palm')}" x="126" y="152" width="70" height="104" style="color:#2c1722"/>
  <use href="#${id('palm')}" x="566" y="92" width="112" height="164" style="color:#1a0d14"/>
  <use href="#${id('palm')}" x="516" y="160" width="66" height="98" style="color:#2c1722"/>
  <rect x="0" y="266" width="720" height="4" fill="url(#${id('hz')})"/>

  <!-- PALERMO: neon script -->
  <g transform="rotate(-5 360 300)" font-family="'Mr Dafoe','Brush Script MT',cursive" font-size="176" text-anchor="middle">
    <text x="360" y="322" fill="none" stroke="url(#${id('neon')})" stroke-width="22" stroke-linejoin="round" filter="url(#${id('glow')})" opacity=".95">Palermo</text>
    <text x="360" y="324" fill="#0b0709" stroke="#0b0709" stroke-width="14" stroke-linejoin="round" transform="translate(3 5)" opacity=".7" filter="url(#${id('soft')})">Palermo</text>
    <text x="360" y="322" fill="none" stroke="url(#${id('neon')})" stroke-width="12" stroke-linejoin="round">Palermo</text>
    <text x="360" y="322" fill="#ffffff">Palermo</text>
  </g>

  <!-- DRIVE: chrome racing sans with speed streaks -->
  <g>
    <path d="M18 352 H138 L130 359 H18Z" fill="url(#${id('streakL')})"/><path d="M40 370 H150 L143 376 H40Z" fill="url(#${id('streakL')})"/><path d="M70 388 H146 L141 393 H70Z" fill="url(#${id('streakL')})"/>
    <path d="M702 352 H582 L590 359 H702Z" fill="url(#${id('streakR')})"/><path d="M680 370 H570 L577 376 H680Z" fill="url(#${id('streakR')})"/><path d="M650 388 H574 L579 393 H650Z" fill="url(#${id('streakR')})"/>
    <g transform="translate(360 404) skewX(-12) translate(-360 -404)" font-family="'Racing Sans One','Barlow Condensed',Impact,sans-serif" font-size="108" text-anchor="middle" letter-spacing="26">
      <text x="368" y="410" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round" opacity=".85">DRIVE</text>
      <text x="360" y="404" fill="none" stroke="#0b0709" stroke-width="13" stroke-linejoin="round">DRIVE</text>
      <text x="360" y="404" fill="none" stroke="#e8559a" stroke-width="5" stroke-linejoin="round">DRIVE</text>
      <text x="360" y="404" fill="url(#${id('chrome')})">DRIVE</text>
    </g>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function h(tag, cls, html, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  return e;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ICON_MENU = '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const ICON_CAM = '<svg viewBox="0 0 48 48"><path d="M8 17h8l3-5h10l3 5h8v21H8z" /><circle cx="24" cy="26" r="6" /></svg>';
const ICON_RESET = '<svg viewBox="0 0 48 48"><path d="M12 24a12 12 0 1 0 4-9" /><path d="M10 8v9h9" /></svg>';
const ICON_SWAP = '<svg viewBox="0 0 48 48"><path d="M10 18h26M28 10l8 8-8 8M38 32H12M20 24l-8 8 8 8" /></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>';
const ICON_FULL = '<svg viewBox="0 0 48 48"><path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30" /></svg>';
const ICON_EXIT = '<svg viewBox="0 0 48 48"><path d="M18 8v10H8M40 18H30V8M30 40V30h10M8 30h10v10" /></svg>';
const CHEV = '<svg class="pd-chev" viewBox="0 0 12 18"><path d="M2 2l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function readSaved() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}; } catch (e) { return {}; }
}

// ---------------------------------------------------------------------------------------------
// credits.md -> html (assets/CREDITS.md is written by the driving agent and read at runtime)
// ---------------------------------------------------------------------------------------------
function inline(s) {
  return esc(s).replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (m, pre, u) => {
      let tail = '';   // keep brackets and commas that belong to the address (Commons file names), give back what closes the sentence
      while (/[),.;:]$/.test(u) && (!u.endsWith(')') || (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length)) { tail = u.slice(-1) + tail; u = u.slice(0, -1); }
      return `${pre}<a href="${u}" target="_blank" rel="noopener">${urlLabel(u)}</a>${tail}`;
    });
}
// credits are for players: drop file paths from row titles and headings ("facades/photo/riso.jpg (Palazzo Riso)" -> "Palazzo Riso")
const creditName = s => s.replace(/^`?[\w./-]+\.(jpg|png|webp|mp3|wav|ogg|glb|js)`?\s*\((.+)\)$/i, '$2');
const creditHead = s => s.replace(/\s*\([^)]*[/.][^)]*\)\s*$/, '');
// a bare URL as readable text: decoded, no scheme, Commons files by name, long paths shortened (the link keeps the full address)
function urlLabel(u) {
  let s = u.replace(/&amp;/g, '&'); try { s = decodeURIComponent(s); } catch (e) { /* keep as is */ }
  s = s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const f = s.match(/^commons\.wikimedia\.org\/wiki\/File:(.+)$/);
  if (f) s = 'Wikimedia Commons: ' + f[1].replace(/_/g, ' ');
  else if (s.length > 48) s = s.slice(0, 46) + '…';
  return s.replace(/[<>"]/g, '');
}
function creditsMarkdown(md) {
  const out = []; let head = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      const cells = line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!head) { head = cells; continue; }
      if (cells.every(c => /^:?-{3,}:?$/.test(c))) continue;
      const find = re => head.findIndex(x => re.test(x));
      const [iA, iL, iS, iC] = [find(/author/i), find(/licen/i), find(/source/i), find(/change/i)];
      const who = [iA, iL].filter(i => i > 0).map(i => cells[i]).filter(Boolean).join(' · ');
      out.push(`<p><b>${inline(creditName(cells[0]))}</b>${inline(who)}${iS > 0 ? `<small>${inline(cells[iS])}</small>` : ''}${iC > 0 && cells[iC] && !/^none$/i.test(cells[iC]) ? `<small>${inline(cells[iC])}</small>` : ''}</p>`);
      continue;
    }
    head = null;
    if (!line || /^# /.test(line) || /^<!--.*-->$/.test(line)) continue;   // markers left by tools/facade_photos.py
    if (/^##+ /.test(line)) out.push(`<h3 style="font-size:.8em;margin-top:3vh">${inline(creditHead(line.replace(/^#+ /, '')))}</h3>`);
    else out.push(`<p>${inline(line.replace(/^[-*] /, ''))}</p>`);
  }
  return out.join('');
}

// ---------------------------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------------------------
export function setupUI({ game, applySettings, missions, suca, getRadio, world, camera, renderer, scene, vehicle, placeAt, SPOTS, QUARTIERI = [], proj, groundY, D }) {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;

  // ---- settings: defaults from main.js, then localStorage, then validation ----
  const st = game.settings;
  const saved = readSaved();
  if (['low', 'medium', 'high'].includes(saved.quality)) st.quality = saved.quality;
  if (Number.isFinite(saved.drawDistance)) st.drawDistance = clamp(saved.drawDistance, 0.5, 1.5);
  if (Number.isFinite(saved.volume)) st.volume = clamp(saved.volume, 0, 1);
  st.musicVolume = Number.isFinite(saved.musicVolume) ? clamp(saved.musicVolume, 0, 1) : (st.musicVolume ?? 0.5); // car radio (src/radio.js)
  st.radio = saved.radio === 'off' ? 'off' : (st.radio ?? 'on');
  if (['kmh', 'mph'].includes(saved.units)) st.units = saved.units;
  if (Number.isInteger(saved.camera) && saved.camera >= 0 && saved.camera <= 3) st.camera = saved.camera;
  st.timeStart = ['morning', 'afternoon', 'sunset', 'night'].includes(saved.timeStart) ? saved.timeStart : (st.timeStart ?? 'morning'); // day/night clock (src/daynight.js reads these)
  st.timeSpeed = ['off', 'slow', 'normal', 'fast'].includes(saved.timeSpeed) ? saved.timeSpeed : (st.timeSpeed ?? 'normal');
  // handling test: classic or sphere physics (src/vehicle.js); a ?physics= link wins over the saved choice
  st.physics = params.has('physics') ? (params.get('physics') === 'sphere' ? 'sphere' : 'classic') : ['classic', 'sphere'].includes(saved.physics) ? saved.physics : 'classic';
  vehicle?.setPhysics?.(st.physics);
  let livery = typeof saved.livery === 'string' ? saved.livery : null;
  let lang = ['it', 'en'].includes(params.get('lang')) ? params.get('lang') : ['it', 'en'].includes(saved.lang) ? saved.lang : 'it';
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...st, lang, livery })); } catch (e) { /* storage unavailable: fine */ } };
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const baseFov = camera.fov;

  if (params.has('fakeliv') && vehicle && !vehicle.LIVERIES) { // test stub until vehicle.js ships its own
    vehicle.LIVERIES = [{ id: 'a', name_it: 'Crema e rosso', name_en: 'Cream and red' }, { id: 'b', name_it: 'Arancio', name_en: 'Orange' }, { id: 'c', name_it: 'Blu mare', name_en: 'Sea blue' }];
    vehicle.setLivery = () => {};
  }

  // ---- DOM ----
  const ui = h('div', '', null, { id: 'pd-ui' });
  const scrim = h('div', 'pd-scrim'), dim = h('div', 'pd-dim');
  ui.append(scrim, dim);

  const two = (key, extra = '') => `<span class="pd-in" data-k="${key}" data-two ${extra}></span>`;
  const screens = {};
  const mk = (name, cls, html) => { const s = h('section', `pd-screen pd-s-${name} ${cls || ''}`, html, { 'data-name': name }); screens[name] = s; ui.append(s); return s; };

  // title
  mk('title', '', `<div class="pd-logo">${logoSVG('t')}</div>
    <div class="pd-tagline">3 ruote 2 frecce 1 clacson 0 dignità</div>
    <div class="pd-by"><span>a game by</span><img src="assets/ui/bonnie-studios.png" alt="Bonnie Studios" width="512" height="512"></div>
    <div class="pd-tap" data-k="${coarse ? 'tapTouch' : 'tapKey'}" data-two></div>
`);
  // main menu
  mk('menu', '', `<div class="pd-logo">${logoSVG('m')}</div>
    <nav class="pd-menu">
      <button class="pd-btn drive" data-nav data-do="drive" type="button" style="font-size:clamp(22px,5.4vh,34px)">${two('drive')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="garage" data-garage type="button" hidden><span class="pd-in" data-k="garage" data-sub="Garage"></span>${CHEV}</button>
      <button class="pd-btn" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="credits" type="button">${two('credits')}${CHEV}</button>
    </nav>
`);
  // options
  const OPTS = [
    { key: 'quality', label: 'quality', type: 'seg', vals: [['low', 'low'], ['medium', 'medium'], ['high', 'high']] },
    { key: 'drawDistance', label: 'draw', type: 'slider', min: 0.5, max: 1.5, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { key: 'volume', label: 'volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'musicVolume', label: 'musicVolume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'radio', label: 'radio', type: 'seg', vals: [['on', 'radioOn'], ['off', 'radioOff']] },
    { key: 'units', label: 'units', type: 'seg', vals: [['kmh', null, 'km/h'], ['mph', null, 'mph']] },
    { key: 'camera', label: 'camera', type: 'seg', vals: [[0, 'cam0'], [1, 'cam1'], [2, 'cam2'], [3, 'cam3']] },
    { key: 'physics', label: 'physics', type: 'seg', vals: [['classic', 'phClassic'], ['sphere', 'phSphere']] },
    { key: 'timeStart', label: 'timeStart', type: 'seg', vals: [['morning', 'tMorning'], ['afternoon', 'tAfternoon'], ['sunset', 'tSunset'], ['night', 'tNight']] },
    { key: 'timeNow', label: 'timeNow', type: 'slider', min: 0, max: 23.5, step: 0.5, fmt: v => `${Math.floor(v)}:${v % 1 ? '30' : '00'}` }, // sets the clock now (src/daynight.js)
    { key: 'timeSpeed', label: 'timeSpeed', type: 'seg', vals: [['off', 'tOff'], ['slow', 'tSlow'], ['normal', 'tNormal'], ['fast', 'tFast']] },
  ];
  const LANG_OPT = { key: 'lang', label: 'language', type: 'seg', vals: [['it', null, 'Italiano'], ['en', null, 'English']] };
  OPTS.push(LANG_OPT);
  const rowHTML = o => `<div class="pd-row" data-opt="${o.key}">
      <div class="pd-lab"><span data-k="${o.label}" data-two></span>${o.type === 'slider' ? '<span class="pd-val"></span>' : ''}</div>
      ${o.type === 'seg'
        ? `<div class="pd-seg" role="group">${o.vals.map(v => `<button class="pd-segb" data-nav type="button" data-v="${v[0]}" aria-pressed="false"><span ${v[1] ? `data-k="${v[1]}"` : ''}>${v[2] || ''}</span></button>`).join('')}</div>`
        : `<div class="pd-slider" data-nav role="slider" tabindex="0" aria-valuemin="${o.min}" aria-valuemax="${o.max}"><div class="pd-track"><div class="pd-fill"></div></div><div class="pd-thumb"></div></div>`}
    </div>`;
  mk('options', '', `<div class="pd-card">
      <div class="pd-head"><h2 class="pd-h" data-k="options" data-two></h2>${rowHTML(LANG_OPT).replace('class="pd-row"', 'class="pd-row pd-lang"').replace(/<div class="pd-lab">.*?<\/div>/s, '')}</div>
      <div class="pd-scrollwrap">
        <div class="pd-grid">${OPTS.filter(o => o !== LANG_OPT).map(rowHTML).join('')}</div>
        <div class="pd-rail" aria-hidden="true"><div class="pd-railthumb"></div></div>
        <button class="pd-more" type="button" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 18 12"><path d="M2 2l7 8 7-8"/></svg></button>
      </div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);
  // credits
  mk('credits', '', `<div class="pd-roll"><div class="pd-rollin"></div></div>
    <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>`);
  // in-game side menu: slides in from the right while the game keeps drawing behind it
  mk('side', '', `<div class="pd-side" role="dialog">
      <h2 class="pd-h" data-k="menu"></h2>
      <div class="pd-stack pd-sidelist">
        <button class="pd-btn sm drive" data-nav data-do="resume" type="button">${two('resume')}${CHEV}</button>
        <button class="pd-btn sm pd-grp" data-nav data-do="changeStart" type="button">${two('changeStart')}${CHEV}</button>
        <button class="pd-btn sm" data-nav data-do="garage" type="button"><span class="pd-in" data-k="garage" data-sub="Garage"></span>${CHEV}</button>
        <button class="pd-btn sm" data-nav data-do="collections" type="button">${two('collections')}${CHEV}</button>
        <button class="pd-btn sm pd-grp" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
        <div class="pd-sideradio">
          <button class="pd-btn sm pd-radnext" data-nav data-do="radioNext" type="button"><span class="pd-in"><span class="pd-l1"><span data-k="radio"></span></span><span class="pd-l2 pd-radsub"></span></span></button>
          <button class="pd-segb pd-radpwr" data-nav data-do="radioPower" type="button" aria-pressed="true">${ICON_NOTE}<span>ON</span></button>
        </div>
        <button class="pd-btn sm pd-grp pd-quit" data-nav data-do="quit" type="button"><span class="pd-in"><span class="pd-l1" data-k="quit"></span><span class="pd-l2 pd-quitsub" data-k="quitBusy" hidden></span></span>${CHEV}</button>
      </div>
      <div class="pd-quick">
        <button class="pd-qbtn" data-nav data-do="qCam" type="button">${ICON_CAM}<span data-k="qCam"></span></button>
        <button class="pd-qbtn" data-nav data-do="qReset" type="button">${ICON_RESET}<span data-k="qReset"></span></button>
        <button class="pd-qbtn" data-nav data-do="qSwap" type="button">${ICON_SWAP}<span data-k="qSwap"></span></button>
        <button class="pd-qbtn pd-qfull" data-nav data-do="qFull" type="button">${ICON_FULL}<span data-k="qFull"></span></button>
      </div>
    </div>`);
  // collections: what the player has found or won so far
  mk('collections', '', `<div class="pd-card narrow pd-coll">
      <h2 class="pd-h" data-k="collections" data-two></h2>
      <div class="pd-colrows"></div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);

  mk('garage', '', `<div class="pd-card pd-garage">
      <div class="gx-root"></div>
    </div>`);   // the garage draws its own Back / Done row (src/garage-ui.js): step 2 backs out to step 1

  // start picker: the map fills the screen, or a list grouped by quartiere docks on the right
  mk('start', '', `<div class="pd-mp" data-view="map"></div>
    <div class="pd-sbar">
      <button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button>
      <h2 class="pd-h" data-k="startQ" data-two></h2>
      <div class="pd-seg pd-starttabs"><button class="pd-segb" data-nav data-do="viewMap" aria-pressed="true" type="button"><span data-k="tabMap"></span></button><button class="pd-segb" data-nav data-do="viewList" aria-pressed="false" type="button"><span data-k="tabList"></span></button></div>
    </div>
    <div class="pd-sl pd-card"><div class="pd-stack pd-liveries pd-startlist"></div></div>`);

  const menuBtn = h('button', 'pd-menubtn', ICON_MENU, { type: 'button', 'aria-label': 'Menu' });
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const fsBtn = h('button', 'pd-fsbtn' + (canFull ? ' ok' : ''), ICON_FULL, { type: 'button', 'aria-label': 'Fullscreen' });
  const onFs = () => { fsBtn.innerHTML = document.fullscreenElement || document.webkitFullscreenElement ? ICON_EXIT : ICON_FULL; };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
  if (params.has('campos') && !params.has('hud')) ui.hidden = true; // free-camera screenshots: no shell on top
  ui.append(menuBtn, fsBtn);
  document.body.append(ui);
  ui.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); // keep mobile.js's page lockdown off our scrolling
  ui.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
  ui.addEventListener('touchend', e => e.stopPropagation(), { passive: true });

  // ---- language ----
  function applyLang() {
    const i = lang === 'it' ? 0 : 1;
    for (const e of ui.querySelectorAll('[data-k]')) {
      const s = S[e.dataset.k]; if (!s) continue;
      if (e.hasAttribute('data-sub')) e.innerHTML = `<span class="pd-l1">${esc(e.dataset.sub)}</span><span class="pd-l2">${esc(s[i])}</span>`;
      else e.innerHTML = e.hasAttribute('data-two') ? `<span class="pd-l1">${esc(s[i])}</span><span class="pd-l2">${esc(s[1 - i])}</span>` : esc(s[i]);
    }
    root.lang = lang;
    menuBtn.setAttribute('aria-label', S.menuBtn[i]);
    buildCredits(); syncRadio(); startMap?.applyLang();
  }

  // ---- state and screen management ----
  let cur = null, stack = [], busy = false, lockUntil = 0;
  const lastFocus = {};
  const now = () => performance.now();

  function syncState() {
    root.classList.toggle('pd-title', game.state === 'title');
    ui.dataset.st = game.state;
    ui.dataset.screen = cur || '';
  }
  function focusables(name = cur) { return name ? [...screens[name].querySelectorAll('[data-nav]')].filter(e => e.offsetParent !== null) : []; }
  function go(name, { push = false, back = false } = {}) {
    if (cur && push) stack.push(cur);
    if (!push && !back) stack = [];
    if (cur) { const a = document.activeElement; if (a && screens[cur].contains(a)) lastFocus[cur] = a; }
    setCam();
    if (cur === 'garage' && name !== 'garage') garageUI.leave();
    if (name === 'garage' && cur !== 'garage') garageUI.enter();
    if (cur === 'start' && name !== 'start') startMap.hide();
    cur = name;
    for (const k in screens) screens[k].classList.toggle('on', k === name);
    lockUntil = now() + 260;
    game.noRender = false; // the start map is opaque: main.js skips drawing the world under it
    syncState();
    if (name) {
      if (name === 'options') { if (game.time) st.timeNow = Math.round(game.time.hour * 2) / 2 % 24; syncOptions(); } // the time slider opens on the current game time
      if (name === 'start') openStart();
      if (name === 'side') syncSide();
      if (name === 'collections') renderCollections();
      let want = lastFocus[name];
      if (!want || !want.isConnected || !want.offsetParent) want = name === 'options' ? screens.options.querySelector('[data-opt=quality] [aria-pressed=true]') : focusables(name)[0];
      if (name === 'garage') want = garageUI.focusEl() || want;   // the garage focuses the current base (step 1) or tab (step 2)
      if (want && name !== 'title') want.focus({ preventScroll: true });
      if (name === 'credits') startRoll();
    } else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  // The camera behind the screens: the flyover on the title, the normal chase camera in the side menu (the garage has a camera of its own)
  function setCam() {
    if (game.state === 'title') game.titleCam = flyCam;
    else if (game.state === 'pause' && game.titleCam) { game.titleCam = null; leaveTitleCam(); }
  }
  function goBack() {
    if (cur === 'garage') return leaveGarage();
    if (stack.length) go(stack.pop(), { back: true });
  }
  // The garage is a place of its own (src/garage-scene.js): in and out go through the checkerboard. While it is open main.js draws the garage
  // instead of the city and does not simulate it, so the street (title flyover or driving, camera, position, heading) is exactly as it was on the way out.
  const garageFrames = n => new Promise(r => { const f = () => (--n > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });   // a few drawn frames, so the garage's shaders and textures are up before the reveal
  function enterGarage() {
    if (busy) return; busy = true; gesture();
    transition(async () => { go('garage', { push: true }); await garageFrames(3); }).catch(() => {}).then(() => { busy = false; });
  }
  function leaveGarage() {
    if (busy) return; busy = true;
    transition(async () => { if (stack.length) go(stack.pop(), { back: true }); await garageFrames(2); }).catch(() => {}).then(() => { busy = false; });
  }

  // ---- title flyover ----
  const FLY = [
    // [camera x, height above ground, z], [look x, height above ground, z]   (metres, x east, z south, Quattro Canti at 0,0)
    [[40, 92, 330], [-250, 40, -330]],       // south of Quattro Canti, up Via Maqueda
    [[-70, 98, -90], [-345, 38, -470]],      // over the crossing, Teatro Massimo ahead
    [[-215, 104, -330], [-347, 36, -462]],   // closing in on the dome
    [[-420, 104, -500], [-300, 30, -300]],   // past the Teatro, swinging round
    [[-300, 120, -760], [60, 20, -560]],     // north of the theatre, over the Politeama side
    [[40, 128, -800], [560, 10, -520]],      // sea side towards La Cala
    [[400, 118, -520], [-250, 90, -1700]],  // above La Cala, the view swings out to Monte Pellegrino
    [[600, 120, -240], [-760, 340, -5400]],  // Foro Italico, mountain behind the harbour
    [[700, 112, 90], [250, 24, -130]],       // south along the coast
    [[520, 100, 420], [80, 30, 20]],         // Kalsa
    [[250, 96, 430], [-20, 34, 40]],         // back through Via Roma
  ];
  const SPEED = 19; // m/s along the path
  const seg = FLY.map((k, i) => { const n = FLY[(i + 1) % FLY.length][0]; return Math.hypot(n[0] - k[0][0], n[2] - k[0][2]) / SPEED; });
  const LOOP = seg.reduce((a, b) => a + b, 0);
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  const tOff = Number(params.get('tt')) || 0;
  function flyAt(sec) {
    let u = ((sec + tOff) % LOOP + LOOP) % LOOP, i = 0;
    while (u > seg[i]) { u -= seg[i]; i = (i + 1) % FLY.length; }
    const f = u / seg[i], n = FLY.length, at = j => FLY[(i + j + n) % n];
    const out = [];
    for (const w of [0, 1]) for (let c = 0; c < 3; c++) out.push(cr(at(-1)[w][c], at(0)[w][c], at(1)[w][c], at(2)[w][c], f));
    return out;
  }
  game.titleCam = (cam, sec) => {
    if (cam.fov !== 52) { cam.fov = 52; cam.updateProjectionMatrix(); }
    const [px, ph, pz, lx, lh, lz] = flyAt(sec);
    cam.position.set(px, groundY(px, pz) + ph + Math.sin(sec * 0.31) * 1.6, pz);
    cam.lookAt(lx, groundY(lx, lz) + lh, lz);
  };
  const flyCam = game.titleCam;

  // ---- actions ----
  function leaveTitleCam() { if (camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); } }
  function gesture() { window.dispatchEvent(new Event('pd-gesture')); vehicle?.unlockAudio?.(); }
  // Wait until everything the camera can see is built (world.visiblePending() is 0 for two frames, so a frame is drawn after the last
  // build) or maxMs. The rest of the ring keeps building behind the reveal. The first two frames are skipped: they still carry the
  // numbers of the camera's old position.
  function settle(maxMs = 7000) {
    return new Promise(res => {
      if (!world || !world.visiblePending) return res();
      const t0 = now(); let calm = 0, n = 0;
      const poll = () => {
        calm = ++n > 2 && world.visiblePending() === 0 ? calm + 1 : 0;
        if (calm >= 2 || now() - t0 > maxMs) res(); else requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
  }
  // The streamer gets most of every frame while the transition covers the screen (world.hurry): the hitches are not seen.
  const hurried = async work => { if (world) world.hurry = true; try { return await work(); } finally { if (world) world.hurry = false; } };
  // Menu or picker to the game, or a new start point from the side menu: cover, place the lapa, wait for the world, reveal.
  function startAt(x, z) {
    if (busy) return; busy = true; gesture();
    const fromTitle = game.state === 'title';
    transition(() => hurried(async () => {
      if (!fromTitle) missions?.stop?.();
      await placeAt(x, z); // main.js: places the lapa and resolves once the start tile is at full detail
      leaveTitleCam(); game.titleCam = null;
      if (fromTitle) game.start(); else game.resume();
      stack = []; go(null);
      await settle();
    })).catch(() => {}).then(() => { busy = false; });
  }
  function openPause() {
    if (game.state !== 'play' || busy) return;
    game.pause(); stack = []; go('side');
    for (const k in screens) delete lastFocus[k];
  }
  function closePause() {
    if (game.state !== 'pause' || cur === 'garage') return;
    game.resume(); go(null); gesture();
  }
  // The sea's game-over "Menu" button asks the shell to go back to the menu instead of reloading.
  addEventListener('pd-quit-to-title', e => { e.preventDefault(); busy = false; quit(); });
  function quit() {
    if (busy) return; busy = true;
    transition(() => hurried(async () => {
      missions?.stop?.();
      game.state = 'title'; stack = []; go('menu');
      await placeAt(...proj(SPOTS[0][1], SPOTS[0][2]));
      await settle(2500); // the flyover keeps moving the view, so do not wait long for it to be complete
    })).catch(() => {}).then(() => { busy = false; });
  }
  function fullscreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch (e) { /* refused */ }
  }
  function act(name, el) {
    switch (name) {
      case 'drive': return go('start', { push: true });
      case 'changeStart': return go('start', { push: true });
      case 'viewMap': case 'viewList': { const v = name === 'viewMap' ? 'map' : 'list'; return v === startView ? undefined : setView(v); }
      case 'mapgo': return startMap.startSelected();
      case 'options': return go('options', { push: true });
      case 'credits': return go('credits', { push: true });
      case 'garage': return enterGarage();
      case 'collections': return go('collections', { push: true });
      case 'back': return goBack();
      case 'resume': return closePause();
      case 'quit': return quit();
      case 'radioNext': getRadio?.()?.next(); return setTimeout(syncRadio, 300);
      case 'radioPower': getRadio?.()?.toggle(); return syncRadio();
      case 'qCam': vehicle.camState.mode = (vehicle.camState.mode + 1) % 4; vehicle.camState.init = false; return;
      case 'qReset': return vehicle.placeAt(vehicle.car.x, vehicle.car.z);
      case 'qSwap': return dispatchEvent(new CustomEvent('pd-swap'));
      case 'qFull': return fullscreen();
    }
  }

  // ---- garage: vehicle, paint and tamarro parts (src/garage-ui.js) in their own scene (src/garage-scene.js) ----
  const garageScene = createGarageScene({ renderer, vehicle, game });
  const garageUI = setupGarageUI({ screen: screens.garage, button: ui.querySelector('[data-garage]'), scene: garageScene, getLang: () => lang, onExit: () => goBack() });

  // ---- side menu: radio row, the busy warning, the fullscreen button ----
  const radNext = screens.side.querySelector('.pd-radnext'), radPwr = screens.side.querySelector('.pd-radpwr'), radSub = screens.side.querySelector('.pd-radsub');
  const quitSub = screens.side.querySelector('.pd-quitsub');
  function syncRadio() {
    const r = getRadio?.(), on = r ? r.enabled : st.radio !== 'off';
    radPwr.setAttribute('aria-pressed', String(on));
    radPwr.querySelector('span').textContent = on ? 'ON' : 'OFF';
    radSub.textContent = on && r && r.current ? r.current.title : '';
  }
  function syncSide() {
    syncRadio();
    quitSub.hidden = !missions?.busy?.();
    screens.side.querySelector('.pd-qfull').hidden = !canFull;
  }

  // ---- collections: SUCA / 800A tags, food events, races, fares ----
  const colRows = screens.collections.querySelector('.pd-colrows'), fakeProg = params.has('fakeprogress');
  const sucaProgress = () => suca?.progress?.() || (fakeProg ? { found: 14, total: 60 } : null);
  const missionProgress = () => missions?.progress?.() || (fakeProg ? { food: { done: 1, total: 4 }, races: { won: 2, total: 5 }, fares: 7 } : null);
  function renderCollections() {
    const i = lang === 'it' ? 0 : 1, sp = sucaProgress(), mp = missionProgress();
    const bar = (label, done, total, note) => `<div class="pd-col"><div class="pd-colh"><span>${esc(label)}</span><b>${done == null ? '-' : total ? `${done} / ${total}` : done}</b></div>${total ? `<div class="pd-colbar"><i style="width:${Math.round(clamp(done / total, 0, 1) * 100)}%"></i></div>` : ''}${note ? `<div class="pd-colnote">${esc(note)}</div>` : ''}</div>`;
    // the SUCA total only counts tags in tiles seen so far (it grows as the city streams in), hence the note
    colRows.innerHTML = bar(S.colSuca[i], sp && sp.found, sp && sp.total, S.colSeen[i])
      + bar(S.colFood[i], mp && mp.food && mp.food.done, mp && mp.food && mp.food.total)
      + bar(S.colRaces[i], mp && mp.races && mp.races.won, mp && mp.races && mp.races.total)
      + bar(S.colFares[i], mp && mp.fares, 0);
  }

  // ---- start picker ("Da dove parti?"): the city map or a list grouped by quartiere. Both start through startAt(). ----
  const QX = QUARTIERI.map(([name, la, lo]) => { const [x, z] = proj(la, lo); return { name, x, z }; });
  const SP = SPOTS.map(sp => { // each start point belongs to the nearest quartiere
    const [x, z] = proj(sp[1], sp[2]); let q = null, bd = Infinity;
    for (const c of QX) { const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z); if (d < bd) { bd = d; q = c; } }
    return { name: sp[0], x, z, q: q ? q.name : '' };
  });
  let startView = params.get('view') === 'list' ? 'list' : 'map', listDone = false;
  const startBox = screens.start.querySelector('.pd-startlist');
  const fakeEvents = params.has('fakeevents') && !missions?.events ? [ // test stub until the events work lands
    { id: 'f1', kind: 'fare', name: 'Turisti in Piazza Pretoria', x: 150, z: 20 }, { id: 'f2', kind: 'food', name: 'Benny e le pizzette', x: -480, z: -120 },
    { id: 'f3', kind: 'race', name: 'Corsa su Viale Regione Siciliana', x: 1800, z: 700, night: true }, { id: 'f4', kind: 'urgent', name: 'Aeroporto, di corsa!', x: -9000, z: 300 },
    { id: 'f5', kind: 'food', name: 'Arancine a Mondello', x: -2700, z: -10000 }, { id: 'f6', kind: 'fare', name: 'Turisti al Foro Italico', x: 700, z: -250, night: true }] : null;
  const startMap = createStartMap({
    host: screens.start.querySelector('.pd-mp'), world, D, spots: SP, quarters: QX, getLang: () => lang,
    getCar: () => game.state === 'pause' && vehicle && vehicle.car ? vehicle.car : null,
    getEvents: () => fakeEvents || missions?.events?.() || [],
    onStart: (x, z) => startAt(x, z),
  });
  if (params.has('mapdebug')) window.__pdMap = startMap;
  function setView(v) {
    startView = v;
    screens.start.dataset.view = v;
    for (const b of screens.start.querySelectorAll('.pd-starttabs [data-do]')) b.setAttribute('aria-pressed', String((b.dataset.do === 'viewMap') === (v === 'map')));
    game.noRender = cur === 'start' && v === 'map';
    if (v === 'map') startMap.show(); else { startMap.hide(); renderList(); }
  }
  function openStart() { setView(startView); if (startView === 'map') lastFocus.start = screens.start.querySelector('.pd-starttabs [aria-pressed=true]'); }
  function renderList() {
    if (!listDone) {
      listDone = true;
      const by = new Map(QX.map(q => [q.name, []])); SP.forEach((s, i) => by.get(s.q)?.push([s, i]));
      const order = QX.map((q, i) => [q, i]).sort((a, b) => (a[0].x * a[0].x + a[0].z * a[0].z) - (b[0].x * b[0].x + b[0].z * b[0].z));
      startBox.innerHTML = order.map(([q, i]) => `<button class="pd-btn sm pd-qh" data-nav data-pt="q:${i}" type="button"><span class="pd-in">${esc(q.name)}</span>${CHEV}</button>`
        + by.get(q.name).map(([s, j]) => `<button class="pd-btn sm pd-poi" data-nav data-pt="s:${j}" type="button"><span class="pd-in">${esc(s.name)}</span></button>`).join('')).join('');
    }
    lastFocus.start = startBox.querySelector('[data-pt]');
  }
  function startFromList(pt) {
    const [k, i] = pt.split(':'), it = (k === 'q' ? QX : SP)[+i];
    if (it) startAt(it.x, it.z);
  }
  if (startView === 'list') screens.start.dataset.view = 'list'; else screens.start.dataset.view = 'map';

  // ---- options ----
  let applyTimer = 0;
  const scheduleApply = () => { clearTimeout(applyTimer); applyTimer = setTimeout(() => applySettings(), 220); };
  function setOpt(key, value, immediate = true) {
    if (key === 'lang') { lang = value; applyLang(); garageUI.applyLang(); }
    else if (key === 'musicVolume' || key === 'radio') { st[key] = value; dispatchEvent(new Event('pd-music-setting')); } // src/radio.js listens
    else {
      st[key] = value;
      if (key === 'volume') vehicle?.setVolume?.(value);
      if (key === 'camera' && game.state !== 'title') vehicle.camState.mode = value;
      if (key === 'timeStart') dispatchEvent(new Event('pd-time-set')); // src/daynight.js: jump the clock to the chosen start, even when it is the same choice again
      if (key === 'timeNow') dispatchEvent(new CustomEvent('pd-time-hour', { detail: value }));
      if (key === 'physics') vehicle?.setPhysics?.(value);
      if (key === 'units' || key === 'timeStart' || key === 'timeSpeed' || key === 'timeNow' || key === 'physics') { /* main.js / src/daynight.js read it every frame */ } else if (immediate) applySettings(); else scheduleApply();
    }
    save(); syncOptions();
  }
  const optValue = o => o.key === 'lang' ? lang : st[o.key];
  function syncOptions() {
    for (const o of OPTS) {
      const row = screens.options.querySelector(`[data-opt="${o.key}"]`), v = optValue(o);
      if (o.type === 'seg') for (const b of row.querySelectorAll('.pd-segb')) b.setAttribute('aria-pressed', String(String(b.dataset.v) === String(v)));
      else {
        const r = (v - o.min) / (o.max - o.min) * 100;
        row.querySelector('.pd-fill').style.width = r + '%';
        const th = row.querySelector('.pd-thumb'); th.style.left = `calc(8px + (100% - 16px) * ${r / 100})`;
        row.querySelector('.pd-val').textContent = o.fmt(v);
        const sl = row.querySelector('.pd-slider'); sl.setAttribute('aria-valuenow', v); sl.setAttribute('aria-valuetext', o.fmt(v));
      }
    }
  }
  function sliderEvents(row, o) {
    const sl = row.querySelector('.pd-slider');
    const fromEvent = e => {
      const r = sl.getBoundingClientRect(), t = clamp((e.clientX - r.left - 8) / (r.width - 16), 0, 1);
      const v = clamp(Math.round((o.min + t * (o.max - o.min)) / o.step) * o.step, o.min, o.max);
      setOpt(o.key, +v.toFixed(2), false);
    };
    // Mouse and pen grab the slider at once. A finger first has to prove it is going sideways: a vertical swipe is left to the browser
    // (the slider is touch-action: pan-y), so it scrolls the options list instead of moving the slider. A tap still sets the value.
    let drag = false, id = -1, x0 = 0, y0 = 0, moved = false;
    sl.addEventListener('pointerdown', e => {
      sl.focus({ preventScroll: true });
      if (e.pointerType !== 'touch') { drag = true; sl.setPointerCapture(e.pointerId); fromEvent(e); e.preventDefault(); return; }
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; moved = false;
    });
    sl.addEventListener('pointermove', e => {
      if (drag) return fromEvent(e);
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) { drag = true; sl.setPointerCapture(e.pointerId); fromEvent(e); }
      else if (Math.abs(dy) > 7) id = -1; // going vertical: the list scrolls
    });
    const end = e => {
      if (e.type === 'pointerup' && !drag && e.pointerId === id && now() - lastListScroll > 160) fromEvent(e); // a tap, not the end of a fling
      drag = false; id = -1;
    };
    sl.addEventListener('pointerup', end); sl.addEventListener('pointercancel', end);
  }
  function stepSlider(el, dir) {
    const o = OPTS.find(x => x.key === el.closest('[data-opt]').dataset.opt);
    setOpt(o.key, +clamp(st[o.key] + dir * o.step, o.min, o.max).toFixed(2), false);
  }
  OPTS.forEach(o => { if (o.type === 'slider') sliderEvents(screens.options.querySelector(`[data-opt="${o.key}"]`), o); });
  // The options list is a scroll area with a rail you can see and drag, a fade and a "more below" arrow while there is more.
  let lastListScroll = 0;
  (() => {
    const wrap = screens.options.querySelector('.pd-scrollwrap'), list = wrap.querySelector('.pd-grid');
    const rail = wrap.querySelector('.pd-rail'), thumb = wrap.querySelector('.pd-railthumb'), more = wrap.querySelector('.pd-more');
    let th = 0, room = 0;
    function sync() {
      const max = list.scrollHeight - list.clientHeight, can = max > 2;
      wrap.classList.toggle('can-scroll', can);
      if (!can) return;
      const rh = rail.clientHeight; th = Math.max(52, rh * list.clientHeight / list.scrollHeight); room = Math.max(1, rh - th);
      thumb.style.height = th + 'px'; thumb.style.transform = `translateY(${list.scrollTop / max * room}px)`;
      wrap.classList.toggle('more-below', list.scrollTop < max - 4); wrap.classList.toggle('more-above', list.scrollTop > 4);
    }
    list.addEventListener('scroll', () => { lastListScroll = now(); sync(); }, { passive: true });
    new ResizeObserver(sync).observe(list);
    new MutationObserver(sync).observe(screens.options, { attributes: true, attributeFilter: ['class'] }); // opening the screen
    rail.addEventListener('wheel', e => { list.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    more.addEventListener('click', () => list.scrollBy({ top: list.clientHeight * .8, behavior: 'smooth' }));
    let grab = null;
    rail.addEventListener('pointerdown', e => {
      rail.setPointerCapture(e.pointerId); e.preventDefault();
      const tr = thumb.getBoundingClientRect(), onThumb = e.clientY >= tr.top && e.clientY <= tr.bottom;
      grab = onThumb ? e.clientY - tr.top : th / 2; // a press on the bare rail centres the handle there and keeps dragging
      move(e);
    });
    const move = e => { if (grab != null) list.scrollTop = (e.clientY - rail.getBoundingClientRect().top - grab) / room * (list.scrollHeight - list.clientHeight); };
    rail.addEventListener('pointermove', move);
    rail.addEventListener('pointerup', () => { grab = null; }); rail.addEventListener('pointercancel', () => { grab = null; });
  })();

  // ---- credits roll ----
  let assetsHTML = '', assetsLoaded = false, rollPause = 0, rollY = 0;
  const roll = screens.credits.querySelector('.pd-roll'), rollIn = screens.credits.querySelector('.pd-rollin');
  function buildCredits() {
    const i = lang === 'it' ? 0 : 1, T = k => `${esc(S[k][i])}<small>${esc(S[k][1 - i])}</small>`;
    rollIn.innerHTML = `
      <div class="pd-logo">${logoSVG('c')}</div>
      <h3>${T('credCreated')}</h3><div class="pd-big">Emanuele Bonura</div>
      <h3>${T('credData')}</h3>
      <p><b>Map data © OpenStreetMap contributors</b>ODbL · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a></p>
      <p><b>Lidar DTM/DSM</b>© Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale (CC BY 4.0)</p>
      <p><b>Terrain</b>AWS Terrain Tiles (Mapzen terrarium; sources include SRTM)</p>
      <p><b>Three.js</b>MIT licence</p>
      <h3>${T('credAssets')}</h3>
      <div class="pd-assets">${assetsHTML}</div>
      <h3>${T('credFonts')}</h3>
      <p><b>Mr Dafoe, Racing Sans One, Barlow, Barlow Condensed</b>SIL Open Font License 1.1 · Google Fonts</p>
      <div class="pd-end">${esc(S.credThanks[i])}</div>
      <p style="margin-top:2vh;opacity:.7"><small>${esc(S.credStreet[i])}</small></p>`;
  }
  function loadAssetCredits() {
    if (assetsLoaded) return; assetsLoaded = true;
    let url; try { url = new URL('../assets/CREDITS.md', import.meta.url); } catch (e) { url = 'assets/CREDITS.md'; }
    fetch(url).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(md => { assetsHTML = creditsMarkdown(md); buildCredits(); })
      .catch(() => { assetsLoaded = false; });
  }
  function startRoll() { loadAssetCredits(); roll.scrollTop = rollY = Number(params.get('rs')) || 0; rollPause = now() + 1200; }
  for (const t of ['pointerdown', 'wheel', 'touchstart']) roll.addEventListener(t, () => { rollPause = now() + 3500; }, { passive: true });

  // ---- input: keyboard, gamepad, pointer ----
  const setKb = on => root.classList.toggle('pd-kb', on);
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', Escape: 'back', Backspace: 'back', KeyP: 'pause' };
  function move(dir) {
    if (cur === 'credits') { rollPause = now() + 3500; if (dir === 'up' || dir === 'down') { roll.scrollBy({ top: dir === 'up' ? -90 : 90 }); return; } }
    const items = focusables(), a = document.activeElement;
    if (!items.length) return;
    if (cur === 'side' && items.includes(a) && sideMove(dir, a)) return;
    if (!items.includes(a)) { items[0].focus({ preventScroll: true }); return; }
    if (a.classList.contains('pd-slider') && (dir === 'left' || dir === 'right')) { stepSlider(a, dir === 'left' ? -1 : 1); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bs = Infinity;
    for (const it of items) {
      if (it === a) continue;
      const q = it.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const off = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along < 4) continue;
      const s = along + off * 2.2;
      if (s < bs) { bs = s; best = it; }
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView?.({ block: 'nearest' }); }
  }
  // The side menu is one column (Up/Down walk it in order, the radio row and the quick buttons are rows for Left/Right), not a spatial grid.
  function sideMove(dir, a) {
    const col = [...screens.side.querySelectorAll('.pd-sidelist > .pd-btn, .pd-radnext, .pd-qbtn:first-child')].filter(e => e.offsetParent !== null);
    const row = a.closest('.pd-quick') ? [...screens.side.querySelectorAll('.pd-qbtn')].filter(e => e.offsetParent !== null) : a.closest('.pd-sideradio') ? [screens.side.querySelector('.pd-radnext'), screens.side.querySelector('.pd-radpwr')] : null;
    const i = row ? row.indexOf(a) : -1;
    if (dir === 'left' || dir === 'right') { if (row) row[clamp(i + (dir === 'left' ? -1 : 1), 0, row.length - 1)].focus({ preventScroll: true }); return true; }
    const at = a.closest('.pd-quick') ? col.length - 1 : a === screens.side.querySelector('.pd-radpwr') ? col.indexOf(screens.side.querySelector('.pd-radnext')) : col.indexOf(a);
    const n = col[clamp(at + (dir === 'up' ? -1 : 1), 0, col.length - 1)];
    if (n) n.focus({ preventScroll: true });
    return true;
  }
  function input(a) {
    if (busy) return;
    if (game.state === 'over') return; // the sea's game-over overlay handles its own input
    if (game.state === 'play') { if (a === 'pause' || a === 'back') openPause(); return; }
    if (cur === 'title') { if (a === 'ok') go('menu'); return; }
    if (a === 'pause' && game.state === 'pause') return closePause();
    if (a === 'back') { if (cur === 'garage' && garageUI.back()) return; if (cur === 'start' && startView === 'map' && startMap.closePop()) return; if (stack.length) goBack(); else if (game.state === 'pause') closePause(); return; }
    if (a === 'ok') { const el = document.activeElement; if (cur && screens[cur] && el && el.closest && screens[cur].contains(el)) el.click(); return; }
    if (['up', 'down', 'left', 'right'].includes(a)) { if (cur === 'start' && startView === 'map') startMap.key(MAPKEY[a]); else move(a); }
  }
  const MAPKEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (game.state === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) input('pause'); e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    e.stopImmediatePropagation(); // no driving shortcuts while a menu is up
    if (cur === 'start' && !busy) { // the picker: L swaps map and list; on the map arrows pan, +/- zoom, Tab walks the pins, E toggles events
      if (e.code === 'KeyL') { e.preventDefault(); setKb(true); return setView(startView === 'map' ? 'list' : 'map'); }
      if (startView === 'map' && startMap.key(e.code, e.shiftKey)) { e.preventDefault(); setKb(true); return; }
    }
    if (e.code === 'Tab' || e.code.startsWith('F') && e.code.length <= 3) return;
    e.preventDefault(); setKb(true);
    if (cur === 'title') { if (!e.repeat && e.code !== 'Escape') input('ok'); return; }
    if (a && !(e.repeat && (a === 'ok' || a === 'back' || a === 'pause'))) input(a);
  }, true);
  addEventListener('pointerdown', () => setKb(false), true);
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) setKb(false); }, true);

  // pointer: one delegated click handler (click, not pointerdown, so a tap never lands on the next screen)
  ui.addEventListener('click', e => {
    if (busy || (e.detail && now() < lockUntil)) return; // pointer taps right after a screen change are ignored; keyboard clicks (detail 0) are not
    if (e.target === screens.side) return closePause(); // a tap beside the panel closes it
    const t = e.target.closest ? e.target.closest('button, .pd-s-title') : null;
    if (!t) return;
    if (t === menuBtn) return openPause();
    if (t === fsBtn) return fullscreen();
    if (t.classList.contains('pd-s-title')) { gesture(); return go('menu'); }
    if (t.dataset.v != null) { const o = OPTS.find(x => x.key === t.closest('[data-opt]').dataset.opt); return setOpt(o.key, typeof o.vals[0][0] === 'number' ? +t.dataset.v : t.dataset.v); }
    if (t.dataset.pt != null) return startFromList(t.dataset.pt);
    if (t.dataset.do) return act(t.dataset.do, t);
  });

  // gamepad (standard mapping): d-pad / left stick navigate, A confirm, B back, Start pause
  const held = {};
  function pollPad(t) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(g => g && g.connected); if (!gp) return;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const cs = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, ok: b(0), back: b(1), pause: b(9) };
    for (const k in cs) {
      const hh = held[k] || (held[k] = { on: false, t0: 0, t1: 0 });
      if (cs[k]) {
        const dirKey = k === 'up' || k === 'down' || k === 'left' || k === 'right';
        if (!hh.on) { hh.on = true; hh.t0 = hh.t1 = t; setKb(true); input(k); }
        else if (dirKey && t - hh.t0 > 380 && t - hh.t1 > 130) { hh.t1 = t; input(k); }
      } else hh.on = false;
    }
  }

  // ---- loop: state sync, gamepad, credits scroll ----
  let lastT = now(), lastState = '', nextLivCheck = 0;
  function tick(t) {
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (game.state !== lastState) { lastState = game.state; syncState(); }
    pollPad(t);
    garageUI.tick(dt);
    if (cur === 'credits' && t > rollPause) {
      if (Math.abs(roll.scrollTop - rollY) > 1.5) rollY = roll.scrollTop; // the user scrolled by hand
      rollY += dt * 34; roll.scrollTop = rollY;
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') openPause(); });
  addEventListener('resize', () => { if (cur === 'start' && startView === 'map') startMap.resize(); });

  // ---- boot ----
  applyLang();
  syncOptions();
  const want = params.get('ui');
  if (game.state === 'play') {
    syncState(); lastState = 'play';
    if (want === 'pause') setTimeout(openPause, 50);
    if (want === 'collections') setTimeout(() => { openPause(); go('collections', { push: true }); }, 50);
  } else {
    syncState();
    go(['menu', 'options', 'credits', 'garage', 'start'].includes(want) ? want : want === 'none' ? null : 'title');
    if (want === 'options' || want === 'credits' || want === 'garage' || want === 'start') stack = ['menu'];
  }
  lastState = game.state;
  requestAnimationFrame(tick);
  // The font swap would shift the logo: show the shell once the display fonts are in (or after a short timeout).
  if (document.fonts && document.fonts.load) {
    ui.style.visibility = 'hidden';
    const reveal = () => { ui.style.visibility = ''; };
    Promise.race([Promise.all([document.fonts.load('1em "Mr Dafoe"'), document.fonts.load('1em "Racing Sans One"'), document.fonts.load('700 1em "Barlow Condensed"')]), new Promise(r => setTimeout(r, 2500))]).then(reveal, reveal);
  }
}
