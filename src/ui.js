// Title screen, menus, options, credits, pause. Owned by the game-shell work.
// game.state: 'title' | 'play' | 'pause'; call game.start(), game.pause(), game.resume().
// Change game.settings ({ quality: 'low'|'medium'|'high', drawDistance: 0.5..1.5, volume: 0..1,
// units: 'kmh'|'mph', camera: 0..3 }) and then call applySettings().
//
// Everything is created from JS (styles in ui.css). Debug/test links: ?ui=menu|options|credits|spots
// opens that screen (?ui=none hides the shell, ?rs=PX pre-scrolls the credits), ?play&ui=pause opens the pause menu, ?tt=SECONDS shifts the title flyover, ?lang=en|it, ?ui=garage (with ?fakeliv to stub vehicle.LIVERIES).

const SETTINGS_KEY = 'palermoDrive.settings.v1';

// ---------------------------------------------------------------------------------------------
// Strings: [italiano, english]. The language option decides which one is large.
// ---------------------------------------------------------------------------------------------
const S = {
  tapTouch: ['Tocca per iniziare', 'Tap to start'],
  tapKey: ['Premi per iniziare', 'Press to start'],
  drive: ['Guida libera', 'Free drive'],
  turisti: ['Turisti affamati', 'Hungry tourists'],
  options: ['Opzioni', 'Options'],
  credits: ['Crediti', 'Credits'],
  back: ['Indietro', 'Back'],
  paused: ['In pausa', 'Paused'],
  resume: ['Riprendi', 'Resume'],
  restart: ['Riparti da un luogo', 'Restart at a landmark'],
  quit: ['Esci al titolo', 'Quit to title'],
  pickSpot: ['Scegli un luogo', 'Choose a landmark'],
  quality: ['Grafica', 'Graphics'],
  low: ['Bassa', 'Low'], medium: ['Media', 'Medium'], high: ['Alta', 'High'],
  draw: ['Distanza', 'Draw distance'],
  volume: ['Volume', 'Volume'],
  units: ['Unità', 'Units'],
  camera: ['Camera iniziale', 'Default camera'],
  cam0: ['Dietro', 'Chase'], cam1: ['Alta', 'High'], cam2: ['Cabina', 'Cab'], cam3: ['Dall\'alto', 'Top-down'],
  language: ['Lingua', 'Language'],
  garage: ['La tua lapa', 'Your lapa'],
  startQ: ['Da dove parti?', 'Where do you start?'],
  startLast: ['Ultima posizione', 'Last position'],
  startRandom: ['Casuale', 'Random'],
  startGo: ['Parti', 'Go'],
  pickLivery: ['Scegli la livrea', 'Choose a livery'],
  pauseBtn: ['Pausa', 'Pause'],
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
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.2" height="15" rx="1"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1"/></svg>';
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
    .replace(/(^|[\s(])(https?:\/\/[^\s,)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
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
      out.push(`<p><b>${inline(cells[0])}</b>${inline(who)}${iS > 0 ? `<small>${inline(cells[iS])}</small>` : ''}${iC > 0 && cells[iC] && !/^none$/i.test(cells[iC]) ? `<small>${inline(cells[iC])}</small>` : ''}</p>`);
      continue;
    }
    head = null;
    if (!line || /^# /.test(line)) continue;
    if (/^##+ /.test(line)) out.push(`<h3 style="font-size:.8em;margin-top:3vh">${inline(line.replace(/^#+ /, ''))}</h3>`);
    else out.push(`<p>${inline(line.replace(/^[-*] /, ''))}</p>`);
  }
  return out.join('');
}

// ---------------------------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------------------------
export function setupUI({ game, applySettings, missions, camera, renderer, scene, vehicle, placeAt, SPOTS, proj, groundY, D }) {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;

  // ---- settings: defaults from main.js, then localStorage, then validation ----
  const st = game.settings;
  const saved = readSaved();
  if (['low', 'medium', 'high'].includes(saved.quality)) st.quality = saved.quality;
  if (Number.isFinite(saved.drawDistance)) st.drawDistance = clamp(saved.drawDistance, 0.5, 1.5);
  if (Number.isFinite(saved.volume)) st.volume = clamp(saved.volume, 0, 1);
  if (['kmh', 'mph'].includes(saved.units)) st.units = saved.units;
  if (Number.isInteger(saved.camera) && saved.camera >= 0 && saved.camera <= 3) st.camera = saved.camera;
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
  const scrim = h('div', 'pd-scrim'), dim = h('div', 'pd-dim'), fade = h('div', 'pd-fade');
  ui.append(scrim, dim);

  const two = (key, extra = '') => `<span class="pd-in" data-k="${key}" data-two ${extra}></span>`;
  const screens = {};
  const mk = (name, cls, html) => { const s = h('section', `pd-screen pd-s-${name} ${cls || ''}`, html, { 'data-name': name }); screens[name] = s; ui.append(s); return s; };

  // title
  mk('title', '', `<div class="pd-logo">${logoSVG('t')}</div>
    <div class="pd-tap" data-k="${coarse ? 'tapTouch' : 'tapKey'}" data-two></div>
`);
  // main menu
  mk('menu', '', `<div class="pd-logo">${logoSVG('m')}</div>
    <nav class="pd-menu">
      <button class="pd-btn drive" data-nav data-do="turisti" type="button" style="font-size:clamp(22px,5.4vh,34px)">${two('turisti')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="drive" type="button">${two('drive')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="garage" data-garage type="button" hidden><span class="pd-in" data-k="garage" data-sub="Garage"></span>${CHEV}</button>
      <button class="pd-btn" data-nav data-do="credits" type="button">${two('credits')}${CHEV}</button>
    </nav>
`);
  // options
  const OPTS = [
    { key: 'quality', label: 'quality', type: 'seg', vals: [['low', 'low'], ['medium', 'medium'], ['high', 'high']] },
    { key: 'drawDistance', label: 'draw', type: 'slider', min: 0.5, max: 1.5, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { key: 'volume', label: 'volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'units', label: 'units', type: 'seg', vals: [['kmh', null, 'km/h'], ['mph', null, 'mph']] },
    { key: 'camera', label: 'camera', type: 'seg', vals: [[0, 'cam0'], [1, 'cam1'], [2, 'cam2'], [3, 'cam3']] },
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
      <div class="pd-grid">${OPTS.filter(o => o !== LANG_OPT).map(rowHTML).join('')}</div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);
  // credits
  mk('credits', '', `<div class="pd-roll"><div class="pd-rollin"></div></div>
    <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>`);
  // pause
  mk('pause', '', `<div class="pd-card narrow">
      <h2 class="pd-h" data-k="paused" data-two></h2>
      <div class="pd-stack">
        <button class="pd-btn" data-nav data-do="resume" type="button">${two('resume')}${CHEV}</button>
        <button class="pd-btn" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
        <button class="pd-btn" data-nav data-do="spots" type="button">${two('restart')}${CHEV}</button>
        <button class="pd-btn" data-nav data-do="quit" type="button">${two('quit')}${CHEV}</button>
      </div></div>`);
  // landmark picker
  mk('spots', '', `<div class="pd-card">
      <h2 class="pd-h" data-k="pickSpot" data-two></h2>
      <div class="pd-grid spots"></div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);

  mk('garage', '', `<div class="pd-card pd-garage">
      <h2 class="pd-h" data-k="garage" data-two></h2>
      <div class="pd-stack pd-liveries"></div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);

  mk('start', '', `<div class="pd-card pd-garage pd-start">
      <h2 class="pd-h" data-k="startQ" data-two></h2>
      <div class="pd-stack pd-liveries pd-startlist"></div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button><button class="pd-btn sm drive" data-nav data-do="go" type="button">${two('startGo')}${CHEV}</button></div>
    </div>`);

  const pauseBtn = h('button', 'pd-pausebtn', ICON_PAUSE, { type: 'button', 'aria-label': 'Pausa / Pause' });
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const fsBtn = h('button', 'pd-fsbtn' + (canFull ? ' ok' : ''), ICON_FULL, { type: 'button', 'aria-label': 'Fullscreen' });
  const onFs = () => { fsBtn.innerHTML = document.fullscreenElement || document.webkitFullscreenElement ? ICON_EXIT : ICON_FULL; };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
  if (params.has('campos') && !params.has('hud')) ui.hidden = true; // free-camera screenshots: no shell on top
  ui.append(pauseBtn, fsBtn, fade);
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
    pauseBtn.setAttribute('aria-label', S.pauseBtn.join(' / '));
    buildCredits();
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
    if (game.state === 'title') game.titleCam = name === 'garage' ? garageCam : name === 'start' ? startCam : flyCam;
    cur = name;
    for (const k in screens) screens[k].classList.toggle('on', k === name);
    lockUntil = now() + 260;
    syncState();
    if (name) {
      if (name === 'options') syncOptions();
      if (name === 'menu' || name === 'garage') renderLiveries();
      if (name === 'spots') renderSpots();
      if (name === 'start') renderStart();
      let want = lastFocus[name];
      if (!want || !want.isConnected) want = name === 'options' ? screens.options.querySelector('[data-opt=quality] [aria-pressed=true]') : focusables(name)[0];
      if (want && name !== 'title') want.focus({ preventScroll: true });
      if (name === 'credits') startRoll();
    } else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function goBack() {
    if (stack.length) go(stack.pop(), { back: true });
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

  // ---- actions ----
  function leaveTitleCam() { if (camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); } }
  function gesture() { window.dispatchEvent(new Event('pd-gesture')); vehicle?.unlockAudio?.(); }
  function drive() {
    if (busy) return; busy = true; gesture();
    fade.classList.add('on');
    setTimeout(() => {
      leaveTitleCam(); game.start(); go(null);
      requestAnimationFrame(() => requestAnimationFrame(() => { fade.classList.remove('on'); busy = false; }));
    }, 420);
  }
  function openPause() {
    if (game.state !== 'play' || busy) return;
    rememberPos(true); game.pause(); stack = []; go('pause');
    for (const k in screens) delete lastFocus[k];
  }
  function closePause() {
    if (game.state !== 'pause') return;
    game.resume(); go(null); gesture();
  }
  function quit() {
    if (busy) return; busy = true;
    fade.classList.add('on');
    setTimeout(() => {
      rememberPos(true);
      missions?.stop?.();
      placeAt(...proj(SPOTS[0][1], SPOTS[0][2])); game.state = 'title'; stack = []; go('menu'); fade.classList.remove('on'); busy = false;
    }, 420);
  }
  function restartAt(i) {
    const s = spotList()[i]; if (!s || busy) return; busy = true;
    fade.classList.add('on');
    setTimeout(() => {
      placeAt(s.x, s.z);
      game.resume(); go(null);
      requestAnimationFrame(() => requestAnimationFrame(() => { fade.classList.remove('on'); busy = false; }));
    }, 360);
  }
  function fullscreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch (e) { /* refused */ }
  }
  function act(name, el) {
    switch (name) {
      case 'drive': startMode = 'free'; return go('start', { push: true });
      case 'turisti': startMode = 'turisti'; return go('start', { push: true });
      case 'go': return confirmStart();
      case 'options': return go('options', { push: true });
      case 'credits': return go('credits', { push: true });
      case 'garage': return go('garage', { push: true });
      case 'back': return goBack();
      case 'resume': return closePause();
      case 'spots': return go('spots', { push: true });
      case 'quit': return quit();
    }
  }

  // ---- garage: livery choice with a slowly turning close view of the lapa ----
  // vehicle.LIVERIES / vehicle.setLivery come from vehicle.js and may arrive late: everything is guarded and re-checked.
  const garageBtn = ui.querySelector('[data-garage]'), liveryBox = screens.garage.querySelector('.pd-liveries');
  let liveryDone = false, liverySig = '';
  const liveries = () => (vehicle && Array.isArray(vehicle.LIVERIES) ? vehicle.LIVERIES : []);
  function renderLiveries() {
    const list = liveries(), sig = list.map(l => l.id).join('|');
    garageBtn.hidden = !(list.length && vehicle.setLivery);
    if (sig === liverySig) return;
    liverySig = sig;
    if (!liveryDone && list.length) { // first time we see the list: apply the saved choice (or keep the default)
      liveryDone = true;
      if (livery && list.some(l => l.id === livery)) vehicle.setLivery?.(livery); else livery = null;
    }
    liveryBox.innerHTML = list.map(l => `<button class="pd-btn sm pd-liv" data-nav data-liv="${esc(l.id)}" aria-pressed="false" type="button"${l.color ? ` style="--sw:${esc(l.color)}"` : ''}><span class="pd-in"><span class="pd-l1">${esc(l.name_it)}</span><span class="pd-l2">${esc(l.name_en)}</span></span></button>`).join('');
    markLivery(); applyLiveryLang();
  }
  function applyLiveryLang() { // primary language first, as everywhere else
    const i = lang === 'it' ? 0 : 1, byId = Object.fromEntries(liveries().map(l => [l.id, l]));
    for (const b of liveryBox.querySelectorAll('[data-liv]')) {
      const l = byId[b.dataset.liv]; if (!l) continue;
      const n = [l.name_it, l.name_en];
      b.querySelector('.pd-l1').textContent = n[i] || n[1 - i]; b.querySelector('.pd-l2').textContent = n[1 - i] || '';
    }
  }
  function markLivery() {
    const cur = livery || (liveries()[0] && liveries()[0].id);
    for (const b of liveryBox.querySelectorAll('[data-liv]')) b.setAttribute('aria-pressed', String(b.dataset.liv === cur));
  }
  function pickLivery(id) { livery = id; try { vehicle.setLivery?.(id); } catch (e) { /* vehicle.js not ready */ } save(); markLivery(); }
  const flyCam = game.titleCam;
  function garageCam(cam, sec) {
    if (cam.fov !== 40) { cam.fov = 40; cam.updateProjectionMatrix(); }
    const c = vehicle.car, a = sec * 0.32, gy = groundY(c.x, c.z);
    cam.position.set(c.x + Math.sin(a) * 7, gy + 2.7 + Math.sin(sec * 0.23) * 0.4, c.z + Math.cos(a) * 7);
    cam.lookAt(c.x, gy + 0.7, c.z);
    cam.translateX(1.6); // lapa sits left of centre, the livery list on the right
  }

  // ---- start picker ("Da dove parti?"): built from SPOTS (plus window.PALERMO_WORLD.landmarks when present) each time it opens ----
  const LAST_KEY = 'palermoDrive.last.v1';
  const readLast = () => { try { const v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return v && Number.isFinite(v.x) && Number.isFinite(v.z) ? v : null; } catch (e) { return null; } };
  let lastPos = readLast(), lastWrite = 0, startMode = 'free', startItems = [], startSel = 0, startWas = -1, lastPointer = 'mouse', spotItems = [];
  function rememberPos(force) { // where you were driving, for "Ultima posizione"
    const c = vehicle && vehicle.car;
    if (!c || (game.state !== 'play' && game.state !== 'pause') || (!force && now() - lastWrite < 4000)) return;
    lastWrite = now(); lastPos = { x: c.x, z: c.z };
    try { localStorage.setItem(LAST_KEY, JSON.stringify(lastPos)); } catch (e) { /* storage unavailable */ }
  }
  addEventListener('pagehide', () => rememberPos(true));
  function spotList() {
    const out = [], seen = new Set();
    const add = (name, x, z) => { if (name && Number.isFinite(x) && Number.isFinite(z) && !seen.has(name)) { seen.add(name); out.push({ name, x, z }); } };
    for (const sp of SPOTS) { const [x, z] = proj(sp[1], sp[2]); add(sp[0], x, z); }
    const W = window.PALERMO_WORLD && window.PALERMO_WORLD.landmarks;
    for (const e of Array.isArray(W) ? W : W && typeof W === 'object' ? Object.values(W) : []) {
      if (Array.isArray(e)) { const [x, z] = proj(e[1], e[2]); add(e[0], x, z); }
      else if (e) { const nm = e.name || e.n || e.name_it; if (Number.isFinite(e.lat) && Number.isFinite(e.lon)) { const [x, z] = proj(e.lat, e.lon); add(nm, x, z); } else add(nm, e.x, e.z); }
    }
    return out;
  }
  function renderSpots() { // pause menu: restart at a landmark
    spotItems = spotList();
    screens.spots.querySelector('.pd-grid').innerHTML = spotItems.map((sp, i) => `<button class="pd-btn sm" data-nav data-spot="${i}" type="button"><span class="pd-in">${esc(sp.name)}</span></button>`).join('');
  }
  function renderStart() {
    lastPos = readLast() || lastPos;
    const spots = spotList();
    startItems = [...(lastPos ? [{ kind: 'last', x: lastPos.x, z: lastPos.z }] : []), { kind: 'random' }, ...spots.map(sp => ({ kind: 'spot', ...sp }))];
    startBox.innerHTML = startItems.map((it, i) => `<button class="pd-btn sm pd-liv" data-nav data-start="${i}" aria-pressed="false" type="button"><span class="pd-in"${it.kind === 'spot' ? '' : ` data-k="${it.kind === 'last' ? 'startLast' : 'startRandom'}" data-two`}>${it.kind === 'spot' ? esc(it.name) : ''}</span></button>`).join('');
    applyLang();
    selectStart(startItems.findIndex(it => it.kind === 'last') >= 0 ? 0 : startItems.findIndex(it => it.kind === 'spot'));
    lastFocus.start = startBox.querySelector(`[data-start="${startSel}"]`);
  }
  function selectStart(i) {
    startSel = i; const it = startItems[i]; if (!it) return;
    for (const b of startBox.querySelectorAll('[data-start]')) b.setAttribute('aria-pressed', String(+b.dataset.start === i));
    if (it.kind !== 'random') { try { placeAt(it.x, it.z); } catch (e) { /* no road yet */ } } // the lapa appears there during the preview
    if (game.state === 'title') game.titleCam = it.kind === 'random' ? flyCam : startCam;
  }
  function confirmStart() {
    if (busy) return;
    let it = startItems[startSel]; if (!it) return;
    if (it.kind === 'random') { const sp = startItems.filter(x => x.kind === 'spot'); it = sp[Math.floor(Math.random() * sp.length)] || it; }
    missions?.setMode?.(startMode);
    if (it.x != null) placeAt(it.x, it.z);
    drive();
  }
  const startBox = screens.start.querySelector('.pd-startlist');
  startBox.addEventListener('pointerdown', e => { lastPointer = e.pointerType; startWas = startSel; });
  startBox.addEventListener('focusin', e => { const b = e.target.closest('[data-start]'); if (b && +b.dataset.start !== startSel) selectStart(+b.dataset.start); });
  startBox.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const b = e.target.closest('[data-start]'); if (b && document.activeElement !== b) b.focus({ preventScroll: true }); } });
  function startCam(cam, sec) { // overhead orbit around the chosen spot, the lapa parked there
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    const c = vehicle.car, gy = groundY(c.x, c.z), a = sec * 0.2 + 0.8;
    cam.position.set(c.x + Math.sin(a) * 60, gy + 78, c.z + Math.cos(a) * 60);
    cam.lookAt(c.x, gy + 2, c.z);
    cam.translateX(14); // spot sits left of centre, the list on the right
  }

  // ---- options ----
  let applyTimer = 0;
  const scheduleApply = () => { clearTimeout(applyTimer); applyTimer = setTimeout(() => applySettings(), 220); };
  function setOpt(key, value, immediate = true) {
    if (key === 'lang') { lang = value; applyLang(); applyLiveryLang(); }
    else {
      st[key] = value;
      if (key === 'volume') vehicle?.setVolume?.(value);
      if (key === 'camera' && game.state !== 'title') vehicle.camState.mode = value;
      if (key === 'units') { /* main.js reads it every frame */ } else if (immediate) applySettings(); else scheduleApply();
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
    let drag = false;
    sl.addEventListener('pointerdown', e => { drag = true; sl.setPointerCapture(e.pointerId); sl.focus({ preventScroll: true }); fromEvent(e); e.preventDefault(); });
    sl.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
    const end = () => { drag = false; };
    sl.addEventListener('pointerup', end); sl.addEventListener('pointercancel', end);
  }
  function stepSlider(el, dir) {
    const o = OPTS.find(x => x.key === el.closest('[data-opt]').dataset.opt);
    setOpt(o.key, +clamp(st[o.key] + dir * o.step, o.min, o.max).toFixed(2), false);
  }
  OPTS.forEach(o => { if (o.type === 'slider') sliderEvents(screens.options.querySelector(`[data-opt="${o.key}"]`), o); });

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
  function input(a) {
    if (busy) return;
    if (game.state === 'play') { if (a === 'pause' || a === 'back') openPause(); return; }
    if (cur === 'title') { if (a === 'ok') go('menu'); return; }
    if (a === 'pause' && game.state === 'pause') return closePause();
    if (a === 'back') { if (stack.length) goBack(); else if (game.state === 'pause') closePause(); return; }
    if (a === 'ok') { const el = document.activeElement; if (el && el.closest && screens[cur].contains(el)) el.click(); return; }
    if (['up', 'down', 'left', 'right'].includes(a)) move(a);
  }
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (game.state === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) input('pause'); e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    e.stopImmediatePropagation(); // no driving shortcuts while a menu is up
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
    const t = e.target.closest ? e.target.closest('button, .pd-s-title') : null;
    if (!t) return;
    if (t === pauseBtn) return openPause();
    if (t === fsBtn) return fullscreen();
    if (t.classList.contains('pd-s-title')) { gesture(); return go('menu'); }
    if (t.dataset.v != null) { const o = OPTS.find(x => x.key === t.closest('[data-opt]').dataset.opt); return setOpt(o.key, typeof o.vals[0][0] === 'number' ? +t.dataset.v : t.dataset.v); }
    if (t.dataset.start != null) { // mouse and keyboard start straight away; a first touch only selects and previews
      const i = +t.dataset.start, firstTouch = e.detail && lastPointer !== 'mouse' && startWas !== i;
      selectStart(i); return firstTouch ? undefined : confirmStart();
    }
    if (t.dataset.liv != null) return pickLivery(t.dataset.liv);
    if (t.dataset.spot != null) return restartAt(+t.dataset.spot);
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
    if (game.state !== lastState) { lastState = game.state; syncState(); placePause(); }
    pollPad(t);
    rememberPos();
    if (t > nextLivCheck) { nextLivCheck = t + 1000; renderLiveries(); }
    if (cur === 'credits' && t > rollPause) {
      if (Math.abs(roll.scrollTop - rollY) > 1.5) rollY = roll.scrollTop; // the user scrolled by hand
      rollY += dt * 34; roll.scrollTop = rollY;
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') openPause(); });

  // pause button sits left of mobile.js's small-button group (camera / reset / fullscreen) at the top centre
  function placePause() {
    const g = document.querySelector('.tc-small');
    if (g && g.getBoundingClientRect().width > 0) {
      const r = g.getBoundingClientRect();
      ui.style.setProperty('--pd-pause-left', (r.left - 12 - 23) + 'px');
      ui.style.setProperty('--pd-pause-top', r.top + 'px');
    } else { ui.style.removeProperty('--pd-pause-left'); ui.style.removeProperty('--pd-pause-top'); }
  }
  addEventListener('resize', placePause); addEventListener('orientationchange', () => setTimeout(placePause, 200));
  setTimeout(placePause, 300);

  // ---- boot ----
  applyLang();
  syncOptions();
  const want = params.get('ui');
  if (game.state === 'play') {
    syncState(); lastState = 'play';
    if (want === 'pause') setTimeout(openPause, 50);
  } else {
    syncState();
    go(['menu', 'options', 'credits', 'spots', 'garage', 'start'].includes(want) ? want : want === 'none' ? null : 'title');
    if (want === 'options' || want === 'credits') stack = ['menu'];
    if (want === 'spots' || want === 'garage' || want === 'start') stack = ['menu'];
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
