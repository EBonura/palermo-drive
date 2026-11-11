// Title screen, main menu, options, credits, the big map (start picker: map and list; in the game the minimap opens it) and the in-game side menu. Owned by the game-shell work.
// game.state: 'title' | 'play' | 'pause'; call game.start(), game.pause(), game.resume(). 'pause' is the side menu: the simulation is stopped, the
// world keeps drawing behind the panel so option changes show at once. Menu to game, game to menu and a new start point all go through
// transition() (src/transition.js), which stays covered until the world around the start has streamed in.
// Change game.settings ({ volume: 0..1,
// units: 'kmh'|'mph', camera: 0..3 }) and then call applySettings().
//
// Everything is created from JS (styles in ui.css). Debug/test links: ?ui=menu|options|credits|spots
// opens that screen (?ui=missions the Missioni list, ?ui=none hides the shell, ?rs=PX pre-scrolls the credits), ?play&ui=pause opens the side menu (?ui=collections the Collezioni
// card, ?ui=start the picker, &view=list its list), ?tt=SECONDS shifts the title flyover, ?lang=en|it, ?ui=garage (with ?fakeliv to stub vehicle.LIVERIES),
// ?fakeevents stubs missions.events() with a few pins (and ?fakeprogress the progress calls) until the events work lands.

import { setupGarageUI, cleanName, readName, writeName } from './garage-ui.js';   // the Garage screen (vehicles, paint, tamarro parts) lives in its own module
import { createGarageScene } from './garage-scene.js';   // the place it happens in: its own scene, not the street
import { transition } from './transition.js';     // rosanero squares + spinning lapa, covers loading
import { createStartMap } from './startmap.js';   // the illustrated city map of the start picker
import { esc } from './esc.js';
import { KIND_COLOR } from './event-calls.js';   // the colour of each kind of mission, for the Missioni list
import { getLang, setLang } from './lang.js';   // the one language at a time (src/lang.js)

const SETTINGS_KEY = 'palermoDrive.settings.v1';

// ---------------------------------------------------------------------------------------------
// Strings: [italiano, english]. The language option (src/lang.js) decides which one is shown; the other is never on screen beside it.
// ---------------------------------------------------------------------------------------------
const S = {
  tapTouch: ['Tocca per iniziare', 'Tap to start'],
  tapKey: ['Premi per iniziare', 'Press to start'],
  drive: ['Guida', 'Drive'],
  options: ['Opzioni', 'Options'],
  credits: ['Crediti', 'Credits'],
  back: ['Indietro', 'Back'],
  menu: ['Menu', 'Menu'],
  quit: ['Menu principale', 'Main menu'],
  toDrive: ['Torna a guidare', 'Back to driving'],
  quitBusy: ['Lasci l\'evento in corso', 'You drop the current event'],
  collections: ['Collezioni', 'Collections'],
  radioNext: ['Cambia brano', 'Next track'], radioPower: ['Radio accesa o spenta', 'Radio on or off'],
  qCam: ['Camera', 'Camera'], qReset: ['In strada', 'On the road'], qFull: ['Schermo', 'Screen'],
  colSuca: ['Graffiti SUCA e 800A', 'SUCA and 800A tags'], colSecrets: ['Segreti', 'Secrets'], colFood: ['Cibo ritrovato', 'Food found'], colRaces: ['Corse vinte', 'Races won'], colFares: ['Clienti portati', 'Fares driven'],
  colNone: ['Ancora niente', 'Nothing yet'],
  missions: ['Missioni', 'Missions'], mDone: ['completate', 'completed'], mGo: ['Amunì', 'Go'],
  mKick: ['Missione', 'Mission'], mStart: ['Comincia missione', 'Start mission'], mNotNow: ['No mi siddia', 'Not now'],   // the card that asks whether to start (the owner's words)
  mFare: ['Clienti', 'Fares'], mUrgent: ['Corse urgenti', 'Urgent runs'], mFood: ['Cibo', 'Food'], mRace: ['Gare', 'Races'], mPub: ['Pub', 'Pubs'], mMalu: ['Maluchiffari', 'Shady Business'],   // the group of the rave, the happy leaves and the horns (the English title is a draft for the owner)
  mDoneRow: ['Fatta', 'Done'], mTodo: ['Da fare', 'To do'], mTried: ['Provata', 'Tried'], mBest: ['Migliore', 'Best'], mRunning: ['In corso', 'Running'],
  mNight: ['Di notte', 'At night'], mDay: ['Di giorno', 'By day'], mAny: ['Sempre', 'Any time'], mLeafNote: ['Ti chiama un amico al rave', 'A friend calls you at the rave'],
  mOnlyNight: ['Questa missione c\'è solo di notte', 'This mission only runs at night'], mOnlyDay: ['Questa missione c\'è solo di giorno', 'This mission only runs by day'],
  mSkipNight: ['Salta alla notte, amunì', 'Skip to night and go'], mSkipDay: ['Salta al giorno, amunì', 'Skip to day and go'], mGoAnyway: ['Amunì lo stesso', 'Go anyway'],
  quality: ['Grafica', 'Graphics'],
  auto: ['Auto', 'Auto'], low: ['Bassa', 'Low'], medium: ['Media', 'Medium'], high: ['Alta', 'High'],
  draw: ['Distanza', 'Draw distance'],
  volume: ['Volume', 'Volume'],
  musicVolume: ['Musica', 'Music'],
  radio: ['Radio', 'Radio'],
  radioOn: ['Accesa', 'On'], radioOff: ['Spenta', 'Off'],
  units: ['Unità', 'Units'],
  camera: ['Camera iniziale', 'Default camera'],
  physics: ['Guida', 'Handling'], phClassic: ['Classica', 'Classic'], phSphere: ['Arcade', 'Arcade'],
  cam0: ['Dietro', 'Chase'], cam1: ['Alta', 'High'], cam2: ['Cabina', 'Cab'], cam3: ['Dall\'alto', 'Top-down'],
  language: ['Lingua', 'Language'],
  nameLabel: ['Il tuo nome', 'Your name'], namePh: ['Nome', 'Name'], netOn: ['Online', 'Online'], netOff: ['Offline', 'Offline'],
  controls: ['Comandi', 'Controls'], ctlKb: ['Tastiera', 'Keyboard'], ctlPad: ['Controller', 'Gamepad'], ctlTouch: ['Schermo tattile', 'Touch screen'],
  ctlDrive: ['Guida: gas, retro, sterzo', 'Drive: gas, reverse, steer'], ctlHand: ['Freno a mano', 'Handbrake'], ctlNitro: ['Nitro', 'Nitro'], ctlHorn: ['Clacson', 'Horn'],
  ctlDrink: ['Bevi (alla porta di un pub o al rave, dopo il tramonto)', 'Drink (at a pub door or the rave, after dark)'],
  ctlFly: ['Vola, tieni premuto per salire (con le ali del Garage)', 'Fly, hold to climb (with the wings from the Garage)'],
  ctlSwap: ['Cambia mezzo', 'Swap vehicle'], ctlCam: ['Camera', 'Camera'], ctlReset: ['Torna in strada', 'Back on the road'],
  ctlMap: ['Mappa grande, cambia posto (o clicca la minimappa)', 'Big map, change place (or click the minimap)'],
  ctlJump: ['Salta a un punto di partenza (1 è i Quattro Canti)', 'Jump to a starting point (1 is Quattro Canti)'],
  ctlNext: ['Brano dopo', 'Next track'], ctlRadio: ['Radio accesa o spenta', 'Radio on or off'], ctlTalk: ['Parla con i giocatori vicini (online)', 'Talk to nearby players (online)'],
  ctlMenu: ['Menu', 'Menu'], ctlThis: ['Questi comandi', 'This screen'],
  ctlStart: ['Menu', 'Menu'], ctlSelect: ['Mappa grande', 'Big map'], ctlMove: ['Muoviti nei menu', 'Move in menus'], ctlOk: ['Conferma', 'Confirm'], ctlBack: ['Indietro', 'Back'],
  ctlSteer: ['Sterza a sinistra e a destra', 'Steer left and right'], ctlGas: ['Accelera', 'Accelerate'], ctlRev: ['Retromarcia e freno', 'Reverse and brake'],
  ctlTapMap: ['Tocca la minimappa: mappa grande, cambia posto', 'Tap the minimap: big map, change place'], ctlTapMenu: ['Menu: camera, in strada, schermo intero', 'Menu: camera, back on the road, full screen'],
  ctlTapTalk: ['Parla con i giocatori vicini (online)', 'Talk to nearby players (online)'], ctlTapDrink: ['Bevi: il tasto compare ai pub e al rave', 'Drink: the button shows up at pubs and at the rave'],
  timeStart: ['Ora di partenza', 'Start time'], tMorning: ['Mattina', 'Morning'], tAfternoon: ['Pomeriggio', 'Afternoon'], tSunset: ['Tramonto', 'Sunset'], tNight: ['Notte', 'Night'],
  igMe: ['Creatore del gioco', 'Game creator'], igStudio: ['Lo studio, giochi PS1', 'The studio, PS1 games'], igMusic: ['Sei di Palermo e vuoi la tua musica aggiunta alla radio di stu gioco? Mandami un messaggio su IG ca nn\'uigganizzamu', 'From Palermo and want your music on this game\'s radio? Message me on IG and we\'ll sort it out'],
  coords: ['Debug', 'Debug'], cOff: ['Spente', 'Off'], cOn: ['Accese', 'On'],
  timeNow: ['Ora', 'Time'], timeSpeed: ['Scorrere del tempo', 'Time flow'], tOff: ['Fermo', 'Frozen'], tSlow: ['Lento', 'Slow'], tNormal: ['Normale', 'Normal'], tFast: ['Veloce', 'Fast'],
  garage: ['Il tuo mezzo', 'Your ride'],
  startQ: ['Da dove parti?', 'Where do you start?'], whereQ: ['Dove vai?', 'Where to?'], whereBusy: ['Dove vai? Lasci l\'evento in corso', 'Where to? You drop the current event'],
  tabMap: ['Mappa', 'Map'], tabList: ['Lista', 'List'],
  pickLivery: ['Scegli la livrea', 'Choose a livery'],
  pinH: ['Schermo intero come un\'app', 'Full screen, like an app'],
  pinDroid: ['Menu del browser (⋮), poi «Aggiungi a schermata Home». Si apre a schermo intero, senza barra.', 'Browser menu (⋮), then “Add to Home screen”. It opens full screen, with no browser bar.'],
  pinIos: ['Tocca Condividi, poi «Aggiungi alla schermata Home». Si apre a schermo intero, senza barra.', 'Tap Share, then “Add to Home Screen”. It opens full screen, with no browser bar.'],
  menuBtn: ['Menu', 'Menu'], openMap: ['Apri mappa', 'Open map'],
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
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24"><path d="M6 5l9 7-9 7z"/><path d="M19 5v14"/></svg>';
const ICON_FULL = '<svg viewBox="0 0 48 48"><path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30" /></svg>';
const ICON_EXIT = '<svg viewBox="0 0 48 48"><path d="M18 8v10H8M40 18H30V8M30 40V30h10M8 30h10v10" /></svg>';
const CHEV = '<svg class="pd-chev" viewBox="0 0 12 18"><path d="M2 2l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function readSaved() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}; } catch (e) { return {}; }
}

// ---------------------------------------------------------------------------------------------
// credits.md -> html (assets/CREDITS.md is written by the driving agent and read at runtime)
// ---------------------------------------------------------------------------------------------
// the line under the author's name; also the first line of assets/CREDITS.md and README.md, which the roll skips
const MOTTO = 'Stu gioco è gratis e open source, si u pagaisti ti futtiaru i picciuli';
// one pass over the raw text: the few markdown pieces we use become elements, every other character goes through esc()
// (code, **bold**, <https://autolink>, [label](url), a bare URL, a backslash escape, an &amp; style entity); only http(s) addresses ever become links
const MD_INLINE = /`([^`]*)`|\*\*(.+?)\*\*|<(https?:[^\s<>]+)>|\[([^\]]+)\]\(((?:[^\s()]|\([^\s()]*\))*)\)|(https?:\/\/[^\s<>"]+)|\\([\\`*_\[\]()|<>#])|&(amp|lt|gt|quot|apos|#39);/g;
const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
// a relative link in CREDITS.md (the music and sprite credits shipped beside it) points at that file's place on this site; anything else off-site stays text
const hrefOf = (u, base) => { if (/^https?:/i.test(u)) return u; try { const r = new URL(u, base); return r.origin === base.origin ? r.href : null; } catch (e) { return null; } };
const anchor = (u, label) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>`;
function inline(s, base) {
  let out = '', at = 0;
  for (const m of s.matchAll(MD_INLINE)) {
    out += esc(s.slice(at, m.index)); at = m.index + m[0].length;
    if (m[1] != null) out += esc(m[1]);
    else if (m[2] != null) out += `<strong>${esc(m[2])}</strong>`;
    else if (m[3] != null) out += anchor(m[3], urlLabel(m[3]));
    else if (m[4] != null) { const h = hrefOf(m[5], base); out += h ? anchor(h, m[4]) : esc(m[4]); }
    else if (m[6] != null) {
      let u = m[6], tail = '';   // keep brackets and commas that belong to the address (Commons file names), give back what closes the sentence
      while (/[),.;:]$/.test(u) && (!u.endsWith(')') || (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length)) { tail = u.slice(-1) + tail; u = u.slice(0, -1); }
      if (m.index && !/[\s(]/.test(s[m.index - 1])) out += esc(m[6]);   // mid-word, not an address
      else { out += anchor(u, urlLabel(u)); at = m.index + u.length; }
    } else if (m[7] != null) out += esc(m[7]);
    else out += esc(ENTITY[m[8]]);
  }
  return out + esc(s.slice(at));
}
// credits are for players: drop file paths from row titles and headings ("facades/photo/riso.jpg (Palazzo Riso)" and "Impact sound (audio/impact.wav)" -> the name)
const creditName = s => s.replace(/^`?[\w./-]+\.(?:jpg|png|webp|mp3|wav|ogg|m4a|glb|js)`?\s*\((.+)\)$/i, '$1')
  .replace(/\s*\(`?[\w./-]+\.(?:jpg|png|webp|mp3|wav|ogg|m4a|glb|js)`?\)$/i, '');
const creditHead = s => s.replace(/\s*\([^)]*[/.][^)]*\)\s*$/, '');
// a bare URL as readable text: decoded, no scheme, Commons files by name, YouTube by name, long addresses by site (the link keeps the full address)
function urlLabel(u) {
  let s = u; try { s = decodeURIComponent(s); } catch (e) { /* keep as is */ }
  s = s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const f = s.match(/^commons\.wikimedia\.org\/wiki\/File:(.+)$/);
  if (f) s = 'Wikimedia Commons: ' + f[1].replace(/_/g, ' ').replace(/\s*\.(jpe?g|png|ogg|wav|webp)$/i, '');
  else if (/^youtube\.com\/watch/.test(s)) s = 'YouTube';
  else if (s.length > 48) s = s.split('/')[0];
  return s;
}
function creditsMarkdown(md, base) {
  const out = []; let head = null, para = [];
  const inl = s => inline(s, base), flush = () => { if (para.length) out.push(`<p>${inl(para.join(' '))}</p>`); para = []; };   // a wrapped paragraph is one <p>
  for (const raw of md.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {   // markers left by tools/facade_photos.py and notes for the repo, on a line of their own or not
    const line = raw.trim();
    if (line.startsWith('|')) {
      flush();
      const cells = line.replace(/\\\|/g, '\u0001').replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\u0001/g, '\\|'));   // \| stays inside its cell
      if (!head) { head = cells; continue; }
      if (cells.every(c => /^:?-{3,}:?$/.test(c))) continue;
      const find = re => head.findIndex(x => re.test(x));
      const [iA, iL, iS, iC] = [find(/author/i), find(/licen/i), find(/source/i), find(/change/i)];
      const who = [iA, iL].filter(i => i > 0).map(i => cells[i]).filter(Boolean).join(' · ');
      out.push(`<p><b>${inl(creditName(cells[0]))}</b>${inl(who)}${iS > 0 ? `<small>${inl(cells[iS])}</small>` : ''}${iC > 0 && cells[iC] && !/^none$/i.test(cells[iC]) ? `<small>${inl(cells[iC])}</small>` : ''}</p>`);
      continue;
    }
    head = null;
    if (!line || /^# /.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); continue; }
    if (line.replace(/^\*\*|\*\*$/g, '') === MOTTO) { flush(); continue; }   // shown under the author's name instead
    if (/^##+ /.test(line)) { flush(); out.push(`<h3 style="font-size:.8em;margin-top:3vh">${inl(creditHead(line.replace(/^#+ /, '')))}</h3>`); }
    else if (/^[-*] /.test(line)) { flush(); out.push(`<p>${inl(line.slice(2))}</p>`); }
    else para.push(line);
  }
  flush();
  return out.join('');
}

// ---------------------------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------------------------
export function setupUI({ game, applySettings, missions, suca, getRadio, world, net, camera, renderer, scene, vehicle, placeAt, SPOTS, QUARTIERI = [], proj, groundY, D }) {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;
  if (params.get('layers') === '0') root.classList.add('pd-flat');   // test switch: the HUD's zones and the pads are not layers of their own (src/ui.css, .hz)

  // ---- settings: defaults from main.js, then localStorage, then validation ----
  const st = game.settings;
  const saved = readSaved();
  if (Number.isFinite(saved.volume)) st.volume = clamp(saved.volume, 0, 1);
  st.musicVolume = Number.isFinite(saved.musicVolume) ? clamp(saved.musicVolume, 0, 1) : (st.musicVolume ?? 0.5); // car radio (src/radio.js)
  st.radio = saved.radio === 'off' ? 'off' : (st.radio ?? 'on');
  if (['kmh', 'mph'].includes(saved.units)) st.units = saved.units;
  if (Number.isInteger(saved.camera) && saved.camera >= 0 && saved.camera <= 3) st.camera = saved.camera;
  st.coords = saved.coords === 'on' ? 'on' : 'off';
  st.timeStart = ['morning', 'afternoon', 'sunset', 'night'].includes(saved.timeStart) ? saved.timeStart : (st.timeStart ?? 'morning'); // day/night clock (src/daynight.js reads these)
  st.timeSpeed = ['off', 'slow', 'normal', 'fast'].includes(saved.timeSpeed) ? saved.timeSpeed : (st.timeSpeed ?? 'normal');
  // handling: sphere (default) or classic physics (src/vehicle.js); a ?physics= link wins over the saved choice
  st.handling = params.has('physics') ? (params.get('physics') === 'classic' ? 'classic' : 'sphere') : saved.handling === 'classic' ? 'classic' : 'sphere';   // the sphere is the default; the key is new so an old saved 'classic' default does not stick
  vehicle?.setPhysics?.(st.handling);
  let livery = typeof saved.livery === 'string' ? saved.livery : null;
  let lang = getLang();   // ?lang=, then the saved choice, then Palermitan: decided in src/lang.js
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

  const two = (key, extra = '') => `<span class="pd-in" data-k="${key}" data-two ${extra}></span>`;   // data-two: written as one line, in the language shown
  const screens = {};
  const mk = (name, cls, html) => { const s = h('section', `pd-screen pd-gone pd-s-${name} ${cls || ''}`, html, { 'data-name': name }); screens[name] = s; ui.append(s); return s; };
  // A screen out of sight keeps its endless animations ("tap to start" pulsing, the "more below" arrow), and the browser works out their styles on every frame of the game. .pd-gone holds them still (src/ui.css):
  // it comes when the screen has finished fading out (the end of the visibility transition of .pd-screen) and goes when the screen is shown, so the fade looks as before.
  ui.addEventListener('transitionend', e => { const s = e.target; if (e.propertyName === 'visibility' && s.classList.contains('pd-screen')) s.classList.toggle('pd-gone', !s.classList.contains('on')); });

  // title
  mk('title', '', `<div class="pd-logo">${logoSVG('t')}</div>
    <div class="pd-tagline">3 ruote 2 frecce 1 clacson 0 dignità</div>
    <div class="pd-by"><span>a game by</span><img src="assets/ui/bonnie-studios.png" alt="Bonnie Studios" width="512" height="512"></div>
    <div class="pd-tap" data-k="${coarse ? 'tapTouch' : 'tapKey'}" data-two></div>
    <div class="pd-vslot"></div>
`);
  // main menu
  const IG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';
  const igLink = (h, k) => `<a class="pd-ig" href="https://www.instagram.com/${h}/" target="_blank" rel="noopener noreferrer"><b>@${h}</b><small data-k="${k}"></small></a>`;
  const NOTE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 18.5a3 3 0 1 1-2-2.83V5.2l12-2.2v13.5a3 3 0 1 1-2-2.83V7.4L9 8.87z"/></svg>';
  mk('menu', '', `<div class="pd-mbody"><div class="pd-logo">${logoSVG('m')}</div>
    <nav class="pd-menu">
      <button class="pd-btn drive" data-nav data-do="drive" type="button" style="font-size:clamp(22px,5.4vh,34px)">${two('drive')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="garage" data-garage type="button" hidden><span class="pd-in" data-k="garage" data-sub="Garage"></span>${CHEV}</button>
      <button class="pd-btn" data-nav data-do="missions" type="button">${two('missions')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
      <button class="pd-btn" data-nav data-do="credits" type="button">${two('credits')}${CHEV}</button>
    </nav></div>
    <div class="pd-mfoot"><div class="pd-msoc"><div class="pd-igs"><span class="pd-igi">${IG}</span>${igLink('izzy88izzy', 'igMe')}${igLink('bonnie_studios_', 'igStudio')}</div><a class="pd-igm" href="https://ig.me/m/izzy88izzy" target="_blank" rel="noopener noreferrer">${NOTE}<span data-k="igMusic"></span></a></div><div class="pd-vslot"></div></div>
`);
  // options
  const OPTS = [
    { key: 'volume', label: 'volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'musicVolume', label: 'musicVolume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { key: 'radio', label: 'radio', type: 'seg', vals: [['on', 'radioOn'], ['off', 'radioOff']] },
    { key: 'units', label: 'units', type: 'seg', vals: [['kmh', null, 'km/h'], ['mph', null, 'mph']] },
    { key: 'camera', label: 'camera', type: 'seg', vals: [[0, 'cam0'], [1, 'cam1'], [2, 'cam2'], [3, 'cam3']] },
    { key: 'handling', label: 'physics', type: 'seg', vals: [['sphere', 'phSphere'], ['classic', 'phClassic']] },
    { key: 'timeStart', label: 'timeStart', type: 'seg', vals: [['morning', 'tMorning'], ['afternoon', 'tAfternoon'], ['sunset', 'tSunset'], ['night', 'tNight']] },
    { key: 'timeNow', label: 'timeNow', type: 'slider', min: 0, max: 23.5, step: 0.5, fmt: v => `${Math.floor(v)}:${v % 1 ? '30' : '00'}` }, // sets the clock now (src/daynight.js)
    { key: 'timeSpeed', label: 'timeSpeed', type: 'seg', vals: [['off', 'tOff'], ['slow', 'tSlow'], ['normal', 'tNormal'], ['fast', 'tFast']] },
    { key: 'coords', label: 'coords', type: 'seg', vals: [['off', 'cOff'], ['on', 'cOn']] }, // position on screen, for reporting a spot (src/coords.js)
  ];
  const LANG_OPT = { key: 'lang', label: 'language', type: 'seg', vals: [['it', null, 'Sicilianu'], ['en', null, 'English']] };   // each language is named in itself; 'Sicilianu' is a draft for the owner
  OPTS.push(LANG_OPT);
  const rowHTML = o => `<div class="pd-row" data-opt="${o.key}">
      <div class="pd-lab"><span data-k="${o.label}" data-two></span>${o.type === 'slider' ? '<span class="pd-val"></span>' : ''}</div>
      ${o.type === 'seg'
        ? `<div class="pd-seg" role="group">${o.vals.map(v => `<button class="pd-segb" data-nav type="button" data-v="${v[0]}" aria-pressed="false"><span ${v[1] ? `data-k="${v[1]}"` : ''}>${v[2] || ''}</span></button>`).join('')}</div>`
        : `<div class="pd-slider" data-nav role="slider" tabindex="0" aria-valuemin="${o.min}" aria-valuemax="${o.max}"><div class="pd-track"><div class="pd-fill"></div></div><div class="pd-thumb"></div></div>`}
    </div>`;
  // How to pin the game to the home screen (a phone in a browser tab; hidden once it runs standalone or fullscreen, in CSS and here for iOS): one platform, one language, no popup
  const IOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // the player's name (the store the Garage edits too, palermoDrive.net.v1) and next to it online or offline (src/p2p/p2p.js 'pd-net-mode'). Only when multiplayer exists (html.pd-mp, src/p2p/p2p.js)
  const NAME_ROW = `<div class="pd-row pd-name" data-name>
      <div class="pd-lab"><span data-k="nameLabel" data-two></span></div>
      <div class="pd-namerow"><input class="pd-namein" data-nav type="text" maxlength="16" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done">
        <div class="pd-seg pd-netseg"><button class="pd-segb" data-nav data-net="on" type="button" aria-pressed="false"><span data-k="netOn"></span></button><button class="pd-segb" data-nav data-net="off" type="button" aria-pressed="true"><span data-k="netOff"></span></button></div></div>
    </div>`;
  const PIN_ROW = `<div class="pd-row pd-pin"${navigator.standalone === true ? ' hidden' : ''}><div class="pd-lab"><span data-k="pinH"></span></div><p class="pd-pint" data-k="${IOS ? 'pinIos' : 'pinDroid'}"></p></div>`;
  mk('options', '', `<div class="pd-card">
      <div class="pd-head"><h2 class="pd-h" data-k="options" data-two></h2>${rowHTML(LANG_OPT).replace('class="pd-row"', 'class="pd-row pd-lang"').replace(/<div class="pd-lab">.*?<\/div>/s, '')}</div>
      <div class="pd-scrollwrap">
        <div class="pd-grid">${OPTS.filter(o => o !== LANG_OPT).map(rowHTML).join('')}${NAME_ROW}${PIN_ROW}</div>
        <div class="pd-rail" aria-hidden="true"><div class="pd-railthumb"></div></div>
        <button class="pd-more" type="button" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 18 12"><path d="M2 2l7 8 7-8"/></svg></button>
      </div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);
  // the same two language buttons in the main menu's footer (the options screen, reached from the menu and from the side menu, has them too)
  { const row = h('div', 'pd-menulang', rowHTML(LANG_OPT).replace('class="pd-row"', 'class="pd-row pd-lang"').replace(/<div class="pd-lab">.*?<\/div>/s, '')); screens.menu.querySelector('.pd-mfoot').insertBefore(row, screens.menu.querySelector('.pd-vslot')); }
  // credits
  mk('credits', '', `<div class="pd-roll"><div class="pd-rollin"></div></div>
    <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>`);
  // in-game side menu: slides in from the right while the game keeps drawing behind it
  mk('side', '', `<div class="pd-side" role="dialog">
      <div class="pd-np">
        <button class="pd-bbtn pd-bpow" data-nav data-do="radioPower" type="button"></button>
        <button class="pd-bbtn pd-bnext" data-nav data-do="radioNext" type="button">${ICON_NEXT}</button>
        <div class="pd-npt"><small class="pd-npl"></small><b class="pd-npn"></b><span class="pd-nps"></span></div>
      </div>
      <div class="pd-stack pd-sidelist">
        <button class="pd-btn sm drive" data-nav data-do="resume" type="button">${two('toDrive')}${CHEV}</button>
        <button class="pd-btn sm" data-nav data-do="map" type="button">${two('openMap')}${CHEV}</button>
        <div class="pd-sidepair"><button class="pd-btn sm" data-nav data-do="missions" type="button">${two('missions')}</button><button class="pd-btn sm" data-nav data-do="collections" type="button">${two('collections')}</button></div>
        <button class="pd-btn sm" data-nav data-do="garage" type="button"><span class="pd-in" data-k="garage" data-sub="Garage"></span>${CHEV}</button>
        <button class="pd-btn sm" data-nav data-do="controls" type="button">${two('controls')}${CHEV}</button>
        <button class="pd-btn sm" data-nav data-do="options" type="button">${two('options')}${CHEV}</button>
        <button class="pd-btn sm pd-grp pd-quit" data-nav data-do="quit" type="button"><span class="pd-in"><span class="pd-l1" data-k="quit"></span><span class="pd-l2 pd-quitsub" data-k="quitBusy" hidden></span></span>${CHEV}</button>
      </div>
      <div class="pd-quick">
        <button class="pd-qbtn" data-nav data-do="qCam" type="button">${ICON_CAM}<span data-k="qCam"></span></button>
        <button class="pd-qbtn" data-nav data-do="qReset" type="button">${ICON_RESET}<span data-k="qReset"></span></button>
        <button class="pd-qbtn pd-qfull" data-nav data-do="qFull" type="button">${ICON_FULL}<span data-k="qFull"></span></button>
      </div>
    </div>`);
  // collections: what the player has found or won so far
  mk('collections', '', `<div class="pd-card narrow pd-coll">
      <h2 class="pd-h" data-k="collections" data-two></h2>
      <div class="pd-colrows"></div>
      <div class="pd-actions"><button class="pd-btn sm" data-nav data-do="back" type="button">${two('back')}</button></div>
    </div>`);

  // missions: every mission of the game, grouped, each with a Vai button (the rows are made in renderMissions(), from missions.events())
  mk('missions', '', `<div class="pd-card pd-ms">
      <div class="pd-mshead"><button class="pd-btn sm pd-msback" data-nav data-do="back" type="button">${two('back')}</button><h2 class="pd-h" data-k="missions" data-two></h2></div>
      <div class="pd-mscount"><b></b><span></span><i data-k="mDone"></i></div>
      <div class="pd-colbar"><i></i></div>
      <div class="pd-scrollwrap">
        <div class="pd-grid pd-mslist"></div>
        <div class="pd-rail" aria-hidden="true"><div class="pd-railthumb"></div></div>
        <button class="pd-more" type="button" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 18 12"><path d="M2 2l7 8 7-8"/></svg></button>
      </div>
      <div class="pd-msask"></div>
    </div>`);

  // controls: what the buttons do on this device (the rows are made in renderControls())
  mk('controls', '', `<div class="pd-card pd-ctl">
      <h2 class="pd-h" data-k="controls" data-two></h2>
      <div class="pd-scrollwrap">
        <div class="pd-grid pd-ctlgrid"></div>
        <div class="pd-rail" aria-hidden="true"><div class="pd-railthumb"></div></div>
        <button class="pd-more" type="button" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 18 12"><path d="M2 2l7 8 7-8"/></svg></button>
      </div>
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
  // The slim bar top left: the round menu button (while driving), play or pause for the radio, next track, and what is playing in one line. It is the radio's only face on the street and the menus
  // (the menu panel has the same controls on top); the words come from the radio's view (src/radio.js, event 'pd-radio').
  const bar = h('div', 'pd-bar', `<button class="pd-bbtn pd-bpow" data-do="radioPower" type="button"></button><button class="pd-bbtn pd-bnext" data-do="radioNext" type="button">${ICON_NEXT}</button><button class="pd-btitle" type="button" aria-expanded="false"><span class="pd-bt1"></span><small class="pd-bt2"></small></button><canvas class="pd-bbars" aria-hidden="true"></canvas>`, { role: 'group' });
  bar.prepend(menuBtn);
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const fsBtn = h('button', 'pd-fsbtn' + (canFull ? ' ok' : ''), ICON_FULL, { type: 'button', 'aria-label': 'Fullscreen' });
  const onFs = () => { fsBtn.innerHTML = document.fullscreenElement || document.webkitFullscreenElement ? ICON_EXIT : ICON_FULL; };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
  if (params.has('campos') && !params.has('hud')) ui.hidden = true; // free-camera screenshots: no shell on top
  ui.append(bar, fsBtn);
  document.body.append(ui);
  ui.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); // keep mobile.js's page lockdown off our scrolling
  ui.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
  ui.addEventListener('touchend', e => e.stopPropagation(), { passive: true });

  // ---- language ----
  function applyLangTo(e) {
    const i = lang === 'it' ? 0 : 1, s = S[e.dataset.k]; if (!s) return;
    if (e.hasAttribute('data-sub')) e.innerHTML = `<span class="pd-l1">${esc(e.dataset.sub)}</span><span class="pd-l2">${esc(s[i])}</span>`;
    else e.innerHTML = e.hasAttribute('data-two') ? `<span class="pd-l1">${esc(s[i])}</span>` : esc(s[i]);
  }
  function applyLang() {
    const i = lang === 'it' ? 0 : 1;
    for (const e of ui.querySelectorAll('[data-k]')) applyLangTo(e);
    miniEl.setAttribute('aria-label', S.whereQ[i]); miniEl.title = S.whereQ[i];
    menuBtn.setAttribute('aria-label', S.menuBtn[i]);
    for (const e of ui.querySelectorAll('.pd-namein')) e.placeholder = S.namePh[i];
    buildCredits(); syncRadio(); if (cur === 'controls') renderControls(); startMap?.applyLang(); if (cur === 'missions') renderMissions();
  }

  // ---- state and screen management ----
  let cur = null, stack = [], busy = false, lockUntil = 0;
  const lastFocus = {};
  const now = () => performance.now();

  function syncState() {
    root.classList.toggle('pd-title', game.state === 'title');
    ui.dataset.st = game.state;
    ui.dataset.screen = cur || '';
    if (typeof kickBars === 'function') kickBars();   // the bar may have come on screen
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
    for (const k in screens) { screens[k].classList.toggle('on', k === name); if (k === name) screens[k].classList.toggle('pd-gone', false); }   // (.pd-gone comes back when it has faded out again)
    lockUntil = now() + 260;
    game.noRender = false; // the start map is opaque: main.js skips drawing the world under it
    syncState();
    if (name) {
      if (name === 'options') { if (game.time) st.timeNow = Math.round(game.time.hour * 2) / 2 % 24; syncOptions(); syncName(); } // the time slider opens on the current game time
      if (name === 'start') openStart();
      if (name === 'side') syncSide();
      if (name === 'collections') renderCollections();
      if (name === 'missions') renderMissions();
      if (name === 'controls') renderControls();
      let want = lastFocus[name];
      if (!want || !want.isConnected || !want.offsetParent) want = focusables(name)[0];
      if (name === 'side' && !lastFocus.side) want = screens.side.querySelector('[data-do=resume]') || want;
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
    else if (game.state === 'pause') closePause();   // the big map, opened from the minimap: straight back to the street
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
  // how (the Missioni list): { id: the mission to stand at (its caller is made ready), hour: jump the clock there first }; (a mission's pin on the big map): { ask: the mission }: stand at it, nothing starts until the answer
  function startAt(x, z, how = {}) {
    if (busy) return; busy = true; gesture(); answerArrival(false);
    const fromTitle = game.state === 'title';
    dispatchEvent(new Event('pd-drunk-reset'));
    transition(() => hurried(async () => {
      if (!fromTitle) missions?.stop?.();
      const at = how.id ? missions?.ready?.(how.id) : how.ask ? missions?.stand?.(how.ask.id) : (missions?.arrive?.(), null);   // the mission's own spot beside its caller
      await placeAt(x, z); // main.js: places the lapa and resolves once the start tile is at full detail
      if (at) vehicle.placeAt(...at);   // the nearest road vertex can be 30 m off on a long street: stand at the caller, facing along the road
      leaveTitleCam(); game.titleCam = null;
      if (fromTitle) game.start(); else game.resume();
      if (how.hour != null) { if (fromTitle) await garageFrames(2); dispatchEvent(new CustomEvent('pd-time-hour', { detail: how.hour })); }   // from the title the clock first goes to the start time (src/daynight.js), so the skip comes after it
      stack = []; go(null);
      if (how.ask) showArrival(how.ask);
      await settle();
    })).catch(() => {}).then(() => { busy = false; });
  }
  function openPause() {
    if (game.state !== 'play' || busy) return;
    for (const k in screens) delete lastFocus[k];   // the panel opens on "Torna a guidare", not where the last visit left the focus
    game.pause(); stack = []; go('side');
  }
  function closePause() {
    if (game.state !== 'pause' || cur === 'garage') return;
    game.resume(); go(null); gesture();
  }
  // The minimap opens the big map: that is how a player changes place. The game waits behind it (as under the side menu), Back goes straight back to the street.
  function openMap() {
    if (game.state !== 'play' || busy) return;
    game.pause(); stack = []; delete lastFocus.start; go('start');
  }
  const miniEl = document.getElementById('mini');
  // A tap opens the map from pointerup as well as click: while another finger holds a steering pad the browser sends the second finger's tap no click at all (pointerdown,
  // touchstart, pointerup and touchend arrive, the click does not), so while driving with a thumb on the pad it took several taps. openMap ignores a second call.
  function wireMapOpener(el) {
    let down = null, handled = false;
    el.addEventListener('click', openMap);
    el.addEventListener('pointerdown', e => { down = e.pointerType === 'mouse' ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', e => {
      const d = down; down = null;
      if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 16 && performance.now() - d.t < 800 && game.state === 'play' && !busy) { handled = true; openMap(); }
    });
    el.addEventListener('pointercancel', () => { down = null; });
    el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });   // the page lockdown (src/mobile.js) leaves this tap alone
    el.addEventListener('touchend', e => { e.stopPropagation(); if (handled) { handled = false; if (e.cancelable) e.preventDefault(); } });   // the tap is done: no click may follow onto the big map that is now under the finger
  }
  wireMapOpener(miniEl);
  // The sea's game-over "Menu" button asks the shell to go back to the menu instead of reloading.
  addEventListener('pd-quit-to-title', e => { e.preventDefault(); busy = false; quit(); });
  function quit() {
    if (busy) return; busy = true; answerArrival(false);
    dispatchEvent(new Event('pd-drunk-reset'));
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
      case 'viewMap': case 'viewList': { const v = name === 'viewMap' ? 'map' : 'list'; return v === startView ? undefined : setView(v); }
      case 'mapgo': return startMap.startSelected();
      case 'options': return go('options', { push: true });
      case 'credits': return go('credits', { push: true });
      case 'garage': return enterGarage();
      case 'collections': return go('collections', { push: true });
      case 'missions': return go('missions', { push: true });
      case 'back': return goBack();
      case 'resume': return closePause();
      case 'map': delete lastFocus.start; return go('start', { push: true });
      case 'controls': return go('controls', { push: true });
      case 'quit': return quit();
      case 'radioNext': getRadio?.()?.next(); return;
      case 'radioPower': { const r = getRadio?.(); if (!r) return; const first = idleAtDown; idleAtDown = false; if (first || r.view.mode === 'idle') r.unlock(); else r.toggle(); return; }   // the very first tap only starts the radio, it does not also switch it off
      case 'qCam': vehicle.camState.mode = (vehicle.camState.mode + 1) % 4; vehicle.camState.init = false; return;
      case 'qReset': return vehicle.placeAt(vehicle.car.x, vehicle.car.z);
      case 'qFull': return fullscreen();
    }
  }

  // ---- garage: vehicle, paint and tamarro parts (src/garage-ui.js) in their own scene (src/garage-scene.js) ----
  const garageScene = createGarageScene({ renderer, vehicle, game });
  const garageUI = setupGarageUI({ screen: screens.garage, button: ui.querySelector('[data-garage]'), scene: garageScene, getLang: () => lang, onExit: () => goBack() });

  // ---- the radio on screen: the bar, the top of the menu panel (both fed by the radio's view, src/radio.js), the busy warning, the fullscreen button ----
  const npL = screens.side.querySelector('.pd-npl'), npN = screens.side.querySelector('.pd-npn'), npS = screens.side.querySelector('.pd-nps');
  const barT = bar.querySelector('.pd-bt1'), barA = bar.querySelector('.pd-bt2'), barTitle = bar.querySelector('.pd-btitle');
  // a tap on the track name opens it to the right: the whole title, the artist small under it. Another tap, or a few seconds, closes it.
  let barOpenT = 0;
  const openBar = on => { clearTimeout(barOpenT); bar.classList.toggle('open', on); barTitle.setAttribute('aria-expanded', String(on)); if (on) barOpenT = setTimeout(() => openBar(false), 5000); };
  barTitle.addEventListener('click', () => openBar(!bar.classList.contains('open')));
  const quitSub = screens.side.querySelector('.pd-quitsub');
  function syncRadio(view) {   // view: the one in the 'pd-radio' event (the radio announces itself before getRadio() can return it)
    const v = view && view.title !== undefined && !(view instanceof Event) ? view : getRadio?.()?.view, i = lang === 'it' ? 0 : 1;
    const mode = v ? v.mode : st.radio === 'off' ? 'off' : 'idle', playing = mode === 'on';
    const title = v ? v.title : '', label = v ? v.label : '', sub = v ? v.sub : '';
    for (const b of ui.querySelectorAll('.pd-bpow')) {
      b.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; b.setAttribute('aria-pressed', String(playing));
      b.setAttribute('aria-label', S.radioPower[i]); b.title = S.radioPower[i];
    }
    for (const b of ui.querySelectorAll('.pd-bnext')) { b.setAttribute('aria-label', S.radioNext[i]); b.title = S.radioNext[i]; }
    barT.textContent = title; barA.textContent = v ? v.artist || '' : ''; bar.dataset.theme = v ? v.theme : ''; bar.dataset.mode = mode; bar.title = [label, title, sub].filter(Boolean).join(' · ');
    npL.textContent = label; npN.textContent = title; npS.textContent = sub; screens.side.querySelector('.pd-np').dataset.theme = v ? v.theme : '';
  }
  addEventListener('pd-radio', e => { syncRadio(e.detail); kickBars(); });

  // ---- the music bars in the slim bar: a few bars that follow the radio's spectrum (src/radio.js spectrum()). Cheap on purpose: a 36 x 20 canvas drawn about 30 times a second, and only while the bar
  // is on screen, the page is visible and something plays or the bars are still falling; the loop stops by itself and starts again with the radio's next change or when the bar comes back ----
  const barCv = bar.querySelector('.pd-bbars'), bg = barCv.getContext('2d'), NB = 7, BW = 3, BGAP = 2.5, CW = NB * BW + (NB - 1) * BGAP, CH = 20, lvl = new Float32Array(NB);
  let barRaf = 0, barLast = 0, gradP = null, gradM = null, barDpr = 0;
  function sizeBars() {
    barDpr = Math.min(2, window.devicePixelRatio || 1);
    barCv.width = Math.round(CW * barDpr); barCv.height = Math.round(CH * barDpr); barCv.style.width = CW + 'px'; barCv.style.height = CH + 'px';
    bg.setTransform(barDpr, 0, 0, barDpr, 0, 0);
    gradP = bg.createLinearGradient(0, 0, 0, CH); gradP.addColorStop(0, '#ffd1e6'); gradP.addColorStop(.45, '#f06fae'); gradP.addColorStop(1, '#8a3a62');
    gradM = bg.createLinearGradient(0, 0, 0, CH); gradM.addColorStop(0, '#ffb199'); gradM.addColorStop(.35, '#ff2a1a'); gradM.addColorStop(1, '#2b0204');
  }
  sizeBars();
  function drawBars(t) {
    barRaf = 0;
    const r = getRadio?.();
    if (!r || document.hidden || !bar.offsetParent) return;   // hidden bar or hidden page: no loop
    if (t - barLast < 30) { barRaf = requestAnimationFrame(drawBars); return; }
    barLast = t;
    const live = r.spectrum(lvl);
    bg.clearRect(0, 0, CW, CH); bg.fillStyle = bar.dataset.theme === 'metal' ? gradM : gradP;
    for (let i = 0; i < NB; i++) { if (!live && lvl[i] < 0.04) continue; const h = Math.max(2, Math.round(lvl[i] * CH)); bg.fillRect(i * (BW + BGAP), CH - h, BW, h); }   // nothing playing: nothing drawn once they have fallen
    if (live) barRaf = requestAnimationFrame(drawBars); else bg.clearRect(0, 0, CW, CH);   // settled: the loop ends with an empty canvas
  }
  function kickBars() { if (!barRaf && !document.hidden) barRaf = requestAnimationFrame(drawBars); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kickBars(); });
  addEventListener('resize', () => { if ((window.devicePixelRatio || 1) !== barDpr) { sizeBars(); kickBars(); } });
  function syncSide() {
    syncRadio();
    quitSub.hidden = !missions?.busy?.();
    screens.side.querySelector('.pd-qfull').hidden = !canFull;
  }

  // ---- the player's name (Options): the same store as the Garage, and the button that opens the name card of src/p2p/p2p.js ----
  const nameIn = screens.options.querySelector('.pd-namein');
  const syncName = () => { if (document.activeElement !== nameIn) nameIn.value = readName(); };
  function saveName() { const n = cleanName(nameIn.value); if (n && n !== readName()) writeName(n); nameIn.value = readName(); }
  nameIn.addEventListener('change', saveName);
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter') saveName(); else nameIn.value = readName(); nameIn.blur(); } });   // the keys of a text field stay in the field (the shell's own handler skips inputs)
  addEventListener('pd-name', syncName);
  // online or offline: online needs a name, so with none the box takes the focus and the toggle stays where it is
  const netBtns = [...screens.options.querySelectorAll('[data-net]')];
  const syncNet = () => { const on = !!net?.isOnline?.(); for (const b of netBtns) b.setAttribute('aria-pressed', String((b.dataset.net === 'on') === on)); };
  for (const b of netBtns) b.addEventListener('click', () => {
    if (b.dataset.net === 'on') { saveName(); if (!readName()) { nameIn.focus(); return; } }
    dispatchEvent(new CustomEvent('pd-net-mode', { detail: b.dataset.net === 'on' }));
    syncNet();
  });
  addEventListener('pd-net-changed', syncNet); syncNet();

  // ---- controls: what the buttons do on this device. The list is made again each time the screen opens (a phone gets its pads, a computer its keys and the gamepad) ----
  const ctlGrid = screens.controls.querySelector('.pd-ctlgrid');
  let syncCtlRail = () => {};   // set where scrollRail is made, below
  function renderControls() {
    const i = lang === 'it' ? 0 : 1, touchUI = root.classList.contains('touch');
    const sect = k => `<div class="pd-ctlh">${esc(S[k][i])}</div>`;
    const row = (keys, k) => `<div class="pd-ctlr"><span class="pd-ctlk">${keys.map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span><span class="pd-ctlt">${esc(S[k][i])}</span></div>`;
    const kb = [[['W', 'A', 'S', 'D', '←↑↓→'], 'ctlDrive'], [['Space'], 'ctlHand'], [['Shift'], 'ctlNitro'], [['H'], 'ctlHorn'], [['B'], 'ctlDrink'], [['F'], 'ctlFly'], [['V'], 'ctlSwap'], [['C'], 'ctlCam'], [['R'], 'ctlReset'],
      [['G'], 'ctlMap'], [['1 - 9'], 'ctlJump'], [['M'], 'ctlNext'], [['N'], 'ctlRadio'], [['T'], 'ctlTalk'], [['Esc', 'P'], 'ctlMenu'], [['?', 'F1'], 'ctlThis']];
    const pad = [[['Start'], 'ctlStart'], [['Select'], 'ctlSelect'], [['D-pad', '◎'], 'ctlMove'], [['A'], 'ctlOk'], [['B'], 'ctlBack']];
    const tc = [[['‹', '›'], 'ctlSteer'], [['GAS'], 'ctlGas'], [['RETRO'], 'ctlRev'], [['FRENO'], 'ctlHand'], [['NOS'], 'ctlNitro'], [['CLACSON'], 'ctlHorn'], [['VOLA'], 'ctlFly'],
      [['☰'], 'ctlTapMenu'], [['◎'], 'ctlTapMap'], [['💬'], 'ctlTapTalk'], [['BERE'], 'ctlTapDrink']];
    ctlGrid.innerHTML = touchUI ? sect('ctlTouch') + tc.map(r => row(...r)).join('') : sect('ctlKb') + kb.map(r => row(...r)).join('') + sect('ctlPad') + pad.map(r => row(...r)).join('');
    ctlGrid.scrollTop = 0; syncCtlRail();
  }
  addEventListener('pd-controls', () => { if (game.state === 'play' && !busy) { openPause(); go('controls', { push: true }); } });   // the ? key (src/main.js)

  // ---- collections: SUCA / 800A tags, food events, races, fares ----
  const colRows = screens.collections.querySelector('.pd-colrows'), fakeProg = params.has('fakeprogress');
  const sucaProgress = () => suca?.progress?.() || (fakeProg ? { found: 14, total: 800 } : null);
  const missionProgress = () => missions?.progress?.() || (fakeProg ? { food: { done: 1, total: 4 }, races: { won: 2, total: 5 }, fares: 7 } : null);
  function renderCollections() {
    const i = lang === 'it' ? 0 : 1, sp = sucaProgress(), mp = missionProgress();
    const bar = (label, done, total, note) => `<div class="pd-col"><div class="pd-colh"><span>${esc(label)}</span><b>${done == null ? '-' : total ? `${done} / ${total}` : done}</b></div>${total ? `<div class="pd-colbar"><i style="width:${Math.round(clamp(done / total, 0, 1) * 100)}%"></i></div>` : ''}${note ? `<div class="pd-colnote">${esc(note)}</div>` : ''}</div>`;
    colRows.innerHTML = bar(S.colSuca[i], sp && sp.found, sp && sp.total)
      + bar(S.colFood[i], mp && mp.food && mp.food.done, mp && mp.food && mp.food.total)
      + bar(S.colRaces[i], mp && mp.races && mp.races.won, mp && mp.races && mp.races.total)
      + bar(S.colFares[i], mp && mp.fares, 0)
      + (mp && mp.secrets && mp.secrets.length ? `<div class="pd-colh pd-sech"><span>${S.colSecrets[i]}</span><b>${mp.secrets.filter(x => x.on).length} / ${mp.secrets.length}</b></div>`   // secrets: a locked card shows only "???" (src/achievements.js)
        + mp.secrets.map(x => `<div class="pd-col pd-sec ${x.on ? 'on' : 'lock'}"><div class="pd-colh"><span>${x.on ? esc(x.title[i]) : '???'}</span><b>${x.on ? '\u2605' : ''}</b></div>${x.on ? `<div class="pd-colnote">${esc(x.note[i])}</div>` : ''}</div>`).join('') : '');
  }

  // ---- start picker ("Da dove parti?"): the city map or a list grouped by quartiere. Both start through startAt(). ----
  const QX = QUARTIERI.map(([name, la, lo]) => { const [x, z] = proj(la, lo); return { name, x, z }; });
  const SP = SPOTS.map(sp => { // each start point belongs to the nearest quartiere, unless it names its group (a 4th item: Politeama and Via della Libertà are 800 m and more from the Il Capo and Matteotti centres they would fall into)
    const [x, z] = proj(sp[1], sp[2]); let q = null, bd = Infinity;
    for (const c of QX) { const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z); if (d < bd) { bd = d; q = c; } }
    return { name: sp[0], x, z, q: sp[3] && QX.some(c => c.name === sp[3]) ? sp[3] : q ? q.name : '' };
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
    getPlayers: () => (game.state === 'pause' && net && net.players ? net.players() : []),   // other players (src/p2p/p2p.js)
    getEvents: () => fakeEvents || missions?.events?.() || [],
    onStart: (x, z, it) => it?.kind === 'event' ? startAt(x, z, { ask: it.ref }) : startAt(x, z),
  });
  if (params.has('mapdebug')) window.__pdMap = startMap;
  function setView(v) {
    startView = v;
    screens.start.dataset.view = v;
    for (const b of screens.start.querySelectorAll('.pd-starttabs [data-do]')) b.setAttribute('aria-pressed', String((b.dataset.do === 'viewMap') === (v === 'map')));
    game.noRender = cur === 'start' && v === 'map';
    if (v === 'map') startMap.show(); else { startMap.hide(); renderList(); }
  }
  function openStart() { const h = screens.start.querySelector('.pd-h'); h.dataset.k = game.state === 'title' ? 'startQ' : missions?.busy?.() ? 'whereBusy' : 'whereQ'; applyLangTo(h); setView(startView); if (startView === 'map') lastFocus.start = screens.start.querySelector('.pd-starttabs [aria-pressed=true]'); }
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
    if (key === 'lang') { lang = value; setLang(value); applyLang(); garageUI.applyLang(); }   // setLang: <html lang> and the 'pd-lang' event, for everything outside this file
    else if (key === 'musicVolume' || key === 'radio') { st[key] = value; dispatchEvent(new Event('pd-music-setting')); } // src/radio.js listens
    else {
      st[key] = value;
      if (key === 'volume') vehicle?.setVolume?.(value);
      if (key === 'camera' && game.state !== 'title') vehicle.camState.mode = value;
      if (key === 'timeStart') dispatchEvent(new Event('pd-time-set')); // src/daynight.js: jump the clock to the chosen start, even when it is the same choice again
      if (key === 'timeNow') dispatchEvent(new CustomEvent('pd-time-hour', { detail: value }));
      if (key === 'handling') vehicle?.setPhysics?.(value);
      if (key === 'units' || key === 'timeStart' || key === 'timeSpeed' || key === 'timeNow' || key === 'handling') { /* main.js / src/daynight.js read it every frame */ } else if (immediate) applySettings(); else scheduleApply();
    }
    save(); syncOptions();
  }
  const optValue = o => o.key === 'lang' ? lang : st[o.key];
  function syncOptions() {
    for (const o of OPTS) {
      const row = screens.options.querySelector(`[data-opt="${o.key}"]`), v = optValue(o);
      if (o.type === 'seg') for (const b of ui.querySelectorAll(`[data-opt="${o.key}"] .pd-segb`)) b.setAttribute('aria-pressed', String(String(b.dataset.v) === String(v)));   // ui, not just the options screen: the language is in the menu too
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
  const scrollRail = screen => {
    const wrap = screen.querySelector('.pd-scrollwrap'), list = wrap.querySelector('.pd-grid');
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
    new MutationObserver(sync).observe(screen, { attributes: true, attributeFilter: ['class'] }); // opening the screen
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
    return sync;
  };
  scrollRail(screens.options);
  syncCtlRail = scrollRail(screens.controls);

  // ---- missions: every mission the game lists (missions.events()), grouped by kind, with its state and a Vai button ----
  // Nothing about the missions is kept here: names, places and the night flag come from events(), done / best from missions.status(id). A kind this file has never heard of
  // still gets its own group. Vai goes through startAt(), the path of the start map, so the lapa is placed on the nearest road and the world streams in under the transition.
  const MKIND = { fare: 'mFare', urgent: 'mUrgent', food: 'mFood', race: 'mRace', pub: 'mPub', malu: 'mMalu' };
  const MGROUP = { rave: 'malu', leaf: 'malu', horns: 'malu', dump: 'malu', penna: 'malu' };   // the rave, the happy leaves, the horns, the landfill and the pen sellers are one group
  // the funny groups (Maluchiffari, then the pubs) sit in the middle of the list; the rest keeps its order around them
  const MORDER = ['fare', 'urgent', 'malu', 'pub', 'food', 'race'];
  const MCOL = { ...KIND_COLOR, pub: '#ffb02e', malu: KIND_COLOR.rave };
  const NIGHT_HOUR = 22.5, DAY_HOUR = 12;   // where "skip to night / day" puts the clock (src/daynight.js START_HOURS.night is 22.5)
  const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>';
  const ICON_ANY = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
  const ICON_TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l5 5 9-10.5"/></svg>';
  const msScreen = screens.missions, msCard = msScreen.querySelector('.pd-ms'), msList = msScreen.querySelector('.pd-mslist'), msAsk = msScreen.querySelector('.pd-msask');
  const syncMsRail = scrollRail(msScreen);
  const msOpen = new Set();   // group keys the player has folded
  let msRows = [], askFor = null;
  const nightNow = () => game.state === 'title' ? st.timeStart === 'night' : !!(game.time && game.time.isNight);   // from the title the game opens at the chosen start time
  const eur = v => '€ ' + v.toFixed(2).replace('.', ',');
  const qRank = new Map(QX.map(c => [c.name, c.x * c.x + c.z * c.z]));
  function nearestQ(x, z) { let q = '', bd = Infinity; for (const c of QX) { const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z); if (d < bd) { bd = d; q = c.name; } } return q; }
  function renderMissions() {
    const i = lang === 'it' ? 0 : 1, run = missions?.state?.ev?.slot?.id;
    msRows = (missions?.events?.() || []).map((e, n) => ({ ...e, n, ...(missions?.status?.(e.id) || {}), q: nearestQ(e.x, e.z), g: MGROUP[e.kind] || e.kind }));
    const groups = [...new Set(msRows.map(r => r.g))].sort((a, b) => ((MORDER.indexOf(a) + 1) || 99) - ((MORDER.indexOf(b) + 1) || 99));
    const total = msRows.length, done = msRows.filter(r => r.done).length, pct = total ? Math.round(done / total * 100) : 0;
    msScreen.querySelector('.pd-mscount b').textContent = `${done} / ${total}`;
    msScreen.querySelector('.pd-mscount span').textContent = pct + '%';
    msScreen.querySelector('.pd-colbar i').style.width = pct + '%';
    const lab = k => S[MKIND[k]] ? S[MKIND[k]][i] : k.charAt(0).toUpperCase() + k.slice(1);
    msList.innerHTML = total ? groups.map(g => {
      const rows = msRows.filter(r => r.g === g).sort((a, b) => (qRank.get(a.q) - qRank.get(b.q)) || a.n - b.n), open = msOpen.has(g), l1 = lab(g), col = MCOL[g] || 'var(--pd-pink)';
      return `<button class="pd-btn sm pd-qh pd-msgh" style="--k:${col}" data-nav data-grp="${esc(g)}" aria-expanded="${open}" type="button"><span class="pd-in"><span class="pd-l1">${esc(l1)}</span></span><b>${rows.filter(r => r.done).length} / ${rows.length}</b>${CHEV}</button>`
        + (open ? rows.map(r => {
          const when = r.night ? ['mNight', ICON_MOON] : r.day ? ['mDay', ICON_SUN] : ['mAny', ICON_ANY], off = r.night ? !nightNow() : r.day ? nightNow() : false;
          const state = r.done ? `<span class="ok">${ICON_TICK}${S.mDoneRow[i]}</span>${r.best ? `<span>${S.mBest[i]} ${eur(r.best)}</span>` : ''}` : r.tried ? `<span>${S.mTried[i]}</span>` : `<span>${S.mTodo[i]}</span>`;
          return `<div class="pd-msrow${r.done ? ' done' : ''}${run === r.id ? ' run' : ''}"><div class="pd-msinfo" style="--k:${MCOL[r.kind] || 'var(--pd-pink)'}"><div class="pd-msmain">
              <div class="pd-msn">${esc(r.title || r.name)}</div>
              <div class="pd-msm">${r.title && r.name !== r.q ? `<span>${esc(r.name)}</span>` : ''}<span>${esc(r.q)}</span><span class="${off ? 'off' : ''}">${when[1]}${S[when[0]][i]}</span>${run === r.id ? `<span class="ok">${S.mRunning[i]}</span>` : ''}</div>
              <div class="pd-msm">${state}</div>
              ${r.kind === 'leaf' ? `<div class="pd-msm hint">${S.mLeafNote[i]}</div>` : ''}</div></div>
            <button class="pd-btn sm pd-msgo" data-nav data-go="${esc(r.id)}" type="button" aria-label="${esc(S.mGo[i] + ': ' + (r.title || r.name))}"><span class="pd-in"><span class="pd-l1">${S.mGo[i]}</span></span></button></div>`;
        }).join('') : '');
    }).join('') : `<div class="pd-colnote">${S.colNone[i]}</div>`;
    closeAsk(true);
    syncMsRail();
  }
  function toggleGroup(g) {
    const sc = msList.scrollTop;
    msOpen.has(g) ? msOpen.delete(g) : msOpen.add(g);
    renderMissions(); msList.scrollTop = sc;
    msList.querySelector(`[data-grp="${CSS.escape(g)}"]`)?.focus({ preventScroll: true });
  }
  // Vai: straight there, unless a mission is running (the same warning as "Back to menu") or the mission only exists at the other time of day, which is offered as a clock skip.
  function askGo(id) {
    const e = msRows.find(r => r.id === id); if (!e) return;
    const want = e.night ? true : e.day ? false : null, skip = want !== null && want !== nightNow(), drop = game.state === 'pause' && !!missions?.busy?.();
    if (!skip && !drop) return goMission(e);
    const i = lang === 'it' ? 0 : 1, msg = k => `<div class="pd-msq"><span class="pd-l1">${esc(S[k][i])}</span></div>`;
    const btn = (a, k, cls = '') => `<button class="pd-btn sm ${cls}" data-nav data-ask="${a}" type="button"><span class="pd-in"><span class="pd-l1">${esc(S[k][i])}</span></span></button>`;
    askFor = { e, hour: skip ? (want ? NIGHT_HOUR : DAY_HOUR) : undefined };
    msAsk.innerHTML = `<div class="pd-msinfo" style="--k:${MCOL[e.kind] || 'var(--pd-pink)'}"><div class="pd-msmain"><div class="pd-msn">${esc(e.title || e.name)}</div><div class="pd-msm"><span>${esc(e.q)}</span></div></div></div>`
      + (skip ? msg(want ? 'mOnlyNight' : 'mOnlyDay') : '') + (drop ? msg('quitBusy') : '')
      + (skip ? btn('skip', want ? 'mSkipNight' : 'mSkipDay', 'drive') + btn('asis', 'mGoAnyway') : btn('asis', 'mGo', 'drive')) + btn('cancel', 'back');
    msCard.classList.add('asking');
    msAsk.querySelector('[data-ask]')?.focus({ preventScroll: true });
  }
  function closeAsk(quiet) {   // true when an answer was open (Escape closes it before it leaves the screen)
    if (!askFor) return false;
    const id = askFor.e.id; askFor = null; msAsk.innerHTML = ''; msCard.classList.remove('asking');
    if (!quiet) { const b = msList.querySelector(`[data-go="${CSS.escape(id)}"]`); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView?.({ block: 'nearest' }); } }
    return true;
  }
  function answerAsk(a) {
    const f = askFor; if (!f) return;
    if (a === 'cancel') return void closeAsk();
    goMission(f.e, a === 'skip' ? f.hour : undefined);
  }
  function goMission(e, hour) { startAt(e.x, e.z, { id: e.id, hour }); }
  // Arriving at a mission from the big map: the lapa stands beside its caller and a big card in the look of the game over card asks: kicker (MISSIONE · the quartiere), the mission's name, what
  // to do in one sentence, COMINCIA MISSIONE or NO MI SIDDIA. Start moves the clock first when the mission only exists at the other time of day (the pink button then says so). Not now, or Escape / B,
  // or the lapa put more than 25 m away (the R key, a swap) leaves it. Enter and A start. The lapa is held still while the card is up (vehicle.holdSim): the card covers the road, so there is no driving
  // away to answer. The card's look is the .sea-* classes of src/sea.js (the game over card) plus .pd-mc-* in ui.css. It is hidden under the side menu and comes back when the game does.
  const askEl = h('div', 'pd-mcard', null, { role: 'dialog' });
  ui.append(askEl);
  for (const ev of ['touchstart', 'touchend']) askEl.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  let arrived = null;   // { e, hour, x, z } while the card asks
  function showArrival(e) {
    const i = lang === 'it' ? 0 : 1, wrong = (e.night ? true : e.day ? false : null) === !nightNow(), car = vehicle.car;
    const desc = missions?.describe?.(e.id), go = wrong ? S[e.night ? 'mSkipNight' : 'mSkipDay'] : S.mStart;
    askEl.innerHTML = `<div class="sea-card pd-mc"><p class="sea-sub pd-mc-k">${esc(S.mKick[i])} \u00b7 ${esc(nearestQ(e.x, e.z))}</p>
      <h2 class="pd-mc-h${(e.title || e.name).length > 24 ? ' long' : ''}">${esc(e.title || e.name)}</h2>${desc ? `<p class="sea-it pd-mc-d">${esc(desc[i])}</p>` : ''}${wrong ? `<p class="pd-mc-w">${esc(S[e.night ? 'mOnlyNight' : 'mOnlyDay'][i])}</p>` : ''}
      <div class="sea-btns"><button type="button" class="sea-btn main" data-a="go"><span>${esc(go[i])}</span></button><button type="button" class="sea-btn" data-a="stay"><span>${esc(S.mNotNow[i])}</span></button></div></div>`;
    arrived = { e, hour: wrong ? (e.night ? NIGHT_HOUR : DAY_HOUR) : undefined, x: car.x, z: car.z };
    vehicle.holdSim?.(true);
    syncAsk();
  }
  const syncAsk = () => askEl.classList.toggle('on', !!arrived && game.state === 'play');
  function answerArrival(yes) {
    const a = arrived; if (!a) return;
    arrived = null; askEl.classList.remove('on'); vehicle.holdSim?.(false);
    if (!yes) return;
    if (a.hour != null) dispatchEvent(new CustomEvent('pd-time-hour', { detail: a.hour }));
    missions?.ready?.(a.e.id);
  }
  askEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { b.blur(); answerArrival(b.dataset.a === 'go'); } });
  if (params.has('debug')) window.__pdAsk = { show: showArrival, answer: answerArrival, open: () => !!arrived };   // test hook: put the card up for any event

  // ---- credits roll ----
  let assetsHTML = '', assetsLoaded = false, rollPause = 0, rollY = 0;
  const roll = screens.credits.querySelector('.pd-roll'), rollIn = screens.credits.querySelector('.pd-rollin');
  function buildCredits() {
    const i = lang === 'it' ? 0 : 1, T = k => esc(S[k][i]);
    rollIn.innerHTML = `
      <div class="pd-logo">${logoSVG('c')}</div>
      <h3>${T('credCreated')}</h3><div class="pd-big">Emanuele Bonura</div><p class="pd-motto">${esc(MOTTO)}</p>
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
    fetch(url).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(md => { assetsHTML = creditsMarkdown(md, new URL(url, location.href)); buildCredits(); })
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
  // The side menu is one column (Up/Down walk it in order); the radio buttons on top, the Missions and Collections pair and the quick buttons are rows for Left/Right.
  function sideMove(dir, a) {
    const side = screens.side, vis = list => list.filter(e => e.offsetParent !== null);
    const col = vis([...side.querySelectorAll('.pd-bpow, .pd-sidelist > .pd-btn, .pd-sidepair > .pd-btn:first-child, .pd-qbtn:first-child')]);
    const row = a.closest('.pd-quick') ? vis([...side.querySelectorAll('.pd-qbtn')]) : a.closest('.pd-np') ? [...side.querySelectorAll('.pd-np .pd-bbtn')] : a.closest('.pd-sidepair') ? [...a.parentNode.children] : null;
    const i = row ? row.indexOf(a) : -1;
    if (dir === 'left' || dir === 'right') { if (row) row[clamp(i + (dir === 'left' ? -1 : 1), 0, row.length - 1)].focus({ preventScroll: true }); return true; }
    const at = a.closest('.pd-quick') ? col.length - 1 : a.closest('.pd-np') ? 0 : a.closest('.pd-sidepair') ? col.indexOf(a.parentNode.firstElementChild) : col.indexOf(a);
    const n = col[clamp(at + (dir === 'up' ? -1 : 1), 0, col.length - 1)];
    if (n) n.focus({ preventScroll: true });
    return true;
  }
  function input(a) {
    if (busy) return;
    if (game.state === 'over') return; // the sea's game-over overlay handles its own input
    if (game.state === 'play') { if (arrived && (a === 'ok' || a === 'back')) return answerArrival(a === 'ok'); if (a === 'pause' || a === 'back') openPause(); else if (a === 'map') openMap(); return; }
    if (cur === 'title') { if (a === 'ok') go('menu'); return; }
    if (a === 'pause' && game.state === 'pause') return closePause();
    if (a === 'back') { if (cur === 'garage' && garageUI.back()) return; if (cur === 'start' && startView === 'map' && startMap.closePop()) return; if (cur === 'missions' && closeAsk()) return; if (stack.length) goBack(); else if (game.state === 'pause') closePause(); return; }
    if (a === 'ok') { const el = document.activeElement; if (cur && screens[cur] && el && el.closest && screens[cur].contains(el)) el.click(); return; }
    if (['up', 'down', 'left', 'right'].includes(a)) { if (cur === 'start' && startView === 'map') startMap.key(MAPKEY[a]); else move(a); }
  }
  const MAPKEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return; // a text field (the driver's name in the Garage, the name card of src/net.js) types normally; it handles its own Enter and Escape
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (game.state === 'play') {
      if (arrived && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape')) { if (!e.repeat) input(e.code === 'Escape' ? 'back' : 'ok'); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) input('pause'); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.code === 'KeyG' && !e.repeat) input('map');
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

  let idleAtDown = false;   // the radio had not started when this press began: the first gesture starts it (src/radio.js), and the press on the play button must not undo that
  addEventListener('pointerdown', () => { const r = getRadio?.(); idleAtDown = !!r && r.view.mode === 'idle'; if (idleAtDown) setTimeout(() => { idleAtDown = false; }, 700); }, true);
  const DOCKED = new Set(['side', 'options', 'controls', 'collections', 'missions']);
  let downOnBackdrop = false;
  ui.addEventListener('pointerdown', e => { downOnBackdrop = game.state === 'pause' && !!(e.target.classList && e.target.classList.contains('pd-screen') && DOCKED.has(e.target.dataset.name)); }, true);
  // pointer: one delegated click handler (click, not pointerdown, so a tap never lands on the next screen)
  ui.addEventListener('click', e => {
    if (busy || (e.detail && now() < lockUntil)) return; // pointer taps right after a screen change are ignored; keyboard clicks (detail 0) are not
    // a click or tap on the game, beside the panel (the backdrop of the menu panel or of a docked Comandi, Opzioni, Missioni, Collezioni), closes it and resumes, like Torna a guidare. Only when the press began there as
    // well (a slider dragged past the panel's edge does not count), and never on the title screen's menus (the game is not paused then). Nothing reaches the game: the screens cover it.
    const bd = e.target.classList && e.target.classList.contains('pd-screen') ? e.target.dataset.name : null;
    if (bd && DOCKED.has(bd) && downOnBackdrop && game.state === 'pause') { downOnBackdrop = false; return closePause(); }
    const t = e.target.closest ? e.target.closest('button, .pd-s-title') : null;
    if (!t) return;
    if (t === menuBtn) return openPause();   // (the bar's own buttons, play or pause and next, carry data-do like the panel's)
    if (t === fsBtn) return fullscreen();
    if (t.classList.contains('pd-s-title')) { gesture(); return go('menu'); }
    if (t.dataset.v != null) { const o = OPTS.find(x => x.key === t.closest('[data-opt]').dataset.opt); return setOpt(o.key, typeof o.vals[0][0] === 'number' ? +t.dataset.v : t.dataset.v); }
    if (t.dataset.pt != null) return startFromList(t.dataset.pt);
    if (t.dataset.go != null) return askGo(t.dataset.go);
    if (t.dataset.grp != null) return toggleGroup(t.dataset.grp);
    if (t.dataset.ask != null) return answerAsk(t.dataset.ask);
    if (t.dataset.do) return act(t.dataset.do, t);
  });

  // gamepad (standard mapping): d-pad / left stick navigate, A confirm, B back, Start pause
  const held = {};
  function pollPad(t) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(g => g && g.connected); if (!gp) return;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const cs = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, ok: b(0), back: b(1), pause: b(9), map: b(8) };
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
    if (game.state !== lastState) { lastState = game.state; syncState(); kickBars(); }
    if (arrived && game.state === 'play' && Math.hypot(vehicle.car.x - arrived.x, vehicle.car.z - arrived.z) > 25) answerArrival(false);   // put elsewhere (R, a swap): that is an answer too
    if (arrived) syncAsk();
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
    if (want === 'missions') setTimeout(() => { openPause(); go('missions', { push: true }); }, 50);
    if (want === 'controls') setTimeout(() => { openPause(); go('controls', { push: true }); }, 50);
  } else {
    syncState();
    go(['menu', 'options', 'credits', 'garage', 'start', 'missions'].includes(want) ? want : want === 'none' ? null : 'title');
    if (want === 'options' || want === 'credits' || want === 'garage' || want === 'start' || want === 'missions') stack = ['menu'];
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
