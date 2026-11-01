// Car radio: shuffled Sicilian / southern-Italian tracks with crossfades. Owned by the music work.
//
//   import { createRadio } from './radio.js';
//   createRadio({ game });          // once, after setupUI(); everything else is automatic
//
// - Starts on the first user gesture (window event 'pd-gesture', or the first pointer / key press).
// - Streams with two <audio> elements routed through Web Audio gain nodes (iOS ignores element.volume),
//   so nothing is decoded up front. Nothing is requested before the radio is switched on: a track's file is only
//   fetched when it starts to play, and the next one starts loading in the last PRELOAD seconds of the current
//   one (so the crossfade is instant). A slot that has faded out drops its file again.
// - Files: the Alamia e Sperandeo tracks are HE-AAC in .m4a (about 40 kbps), which every browser plays, iOS Safari included;
//   the index is up front so playback starts while they download.
// - Keys (in play): M = next track, N = radio on/off. The on-screen controls (next track, on/off) are in the in-game side menu (src/ui.js),
//   which uses the API returned here: next(), toggle(), enabled, current.
// - Settings live in game.settings (musicVolume 0..1, radio 'on'|'off') and in localStorage under
//   palermoDrive.settings.v1, next to the shell's own keys. src/ui.js shows them in Options and fires the
//   window event 'pd-music-setting' when one changes.
// - Ducks under the pause menu and the title screen. Credits for every track: assets/music/CREDITS.md.
// - The radio widget (top left, always there: title, driving, side menu): a spinning CD, live spectrum bars from an AnalyserNode tapped on
//   the slot outputs (a side branch, nothing is routed through it), title and credits, next / on-off buttons. It collapses to the bars and
//   a chevron a few seconds after the last track change or tap, and a track change opens it again.

const SETTINGS_KEY = 'palermoDrive.settings.v1';
const BASE = new URL('../assets/music/', import.meta.url).href;

// file (or id: <id>.m4a), title, author, licence (shown in the radio widget).
// Credits for every track: assets/music/CREDITS.md.
const ALAMIA = [   // [id, title as tagged]; Alamia e Sperandeo, Seamusica S.r.l.
  ['abbiamo-arrivato', 'Abbiamo Arrivato'],
  ['acqua-di-cielo', 'Acqua Di Cielo'],
  ['broadway-un-sogno-americano', 'Broadway (Un Sogno Americano)'],
  ['brutti-sporchi-e-monelli', 'Brutti, Sporchi E Monelli'],
  ['cachi', 'Cachi'],
  ['canzoncine-per-bambini', 'Canzoncine Per Bambini'],
  ['ciauru-ro-mari', 'Ciauru Ro Mari'],
  ['cu-dici-ca-lu-carceri-e-galera', 'Cu dici ca lu carceri è galera'],
  ['discorsi-di-taverna', 'Discorsi Di Taverna'],
  ['inno-del-palermo', 'Inno Del Palermo'],
  ['lonorevole', 'L\'onorevole'],
  ['la-bicicletta', 'La Bicicletta'],
  ['la-farmacia', 'La Farmacia'],
  ['la-partita', 'La Partita'],
  ['la-punta', 'La Punta'],
  ['la-scampagnata', 'La Scampagnata'],
  ['malacarne', 'Malacarne'],
  ['mare-mare', 'Mare Mare'],
  ['minchia-pititto', 'Minchia Pititto'],
  ['passeggiando-in-un-ponticello', 'Passeggiando In Un Ponticello'],
  ['passeggiata-alla-marina', 'Passeggiata Alla Marina'],
  ['rap-ghiaccio', 'Rap Ghiaccio'],
  ['sai-che-ti-dico', 'Sai Che Ti Dico'],
  ['tirituppiti', 'Tirituppiti'],
  ['tram-elettrico', 'Tram Elettrico'],
  ['trazzieri', 'Trazzieri'],
  ['tutti-per-la-press', 'Tutti Per La Press'],
  ['una-giornata-qualunque', 'Una Giornata Qualunque'],
  ['una-storia-disonesta', 'Una Storia Disonesta'],
  ['una-storia-ose', 'Una Storia Osè'],
  ['via-pitre', 'Via Pitrè'],
  ['vucciria', 'Vucciria'],
].map(([id, title]) => ({ id, title, by: 'Alamia e Sperandeo', lic: 'Seamusica S.r.l., used with permission' }));
export const TRACKS = [
  { file: 'bushwick-tarantella.mp3', title: 'Bushwick Tarantella', by: 'Kevin MacLeod', lic: 'CC BY 4.0' },
  { file: 'tarantella-air-force-strings.mp3', title: 'Tarantella', by: 'Air Force Strings, US Air Force Band', lic: 'Public domain' },
  { file: 'funiculi-funicula-banda.mp3', title: 'Funiculì, Funiculà (1903)', by: 'F. Giannini, Royal Marine Band of Italy', lic: 'Public domain' },
  { file: 'meatball-parade.mp3', title: 'Meatball Parade', by: 'Kevin MacLeod', lic: 'CC BY 4.0' },
  ...ALAMIA,
];

const XFADE = 4;          // seconds of overlap when a track runs out
const PRELOAD = 30;       // start loading the next track when this many seconds of the current one are left
const SKIP_FADE = 1.2;    // seconds when the player skips or switches on
const OFF_FADE = 0.5;
const DUCK = { play: 1, pause: 0.22, title: 0.6, over: 0.3 };
const OPEN_MS = 6500;     // the widget stays open this long after a track change, then folds to the bars
const TAP_MS = 4500;      // ... and this long after a tap or hover
const BARS = 11;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const T = {   // [italiano, english]
  now: ['In onda', 'Now playing'],
  off: ['Radio spenta', 'Radio off'],
  fm: ['FM Palermo', 'FM Palermo'],
  idle: ['Tocca per ascoltare', 'Tap to listen'],
  idleSub: ['Musica del Sud Italia', 'Southern Italian music'],
  offSub: ['Accendila col tasto', 'Switch on with the button'],
  next: ['Cambia brano', 'Next track'],
  power: ['Radio accesa o spenta', 'Radio on or off'],
  open: ['Apri la radio', 'Open the radio'],
  fold: ['Chiudi la radio', 'Fold the radio'],
};

let instance = null;

export function createRadio({ game, tracks = TRACKS } = {}) {
  if (instance) return instance;
  if (typeof document === 'undefined' || !tracks.length) return null;
  const settings = game?.settings || {};

  // ---- settings ----
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}; } catch (e) { return {}; } };
  const persist = patch => {
    Object.assign(settings, patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSaved(), ...patch })); } catch (e) { /* storage unavailable: fine */ }
  };
  const saved = readSaved();
  let volume = Number.isFinite(settings.musicVolume) ? settings.musicVolume : Number.isFinite(saved.musicVolume) ? saved.musicVolume : 0.5;
  let enabled = (settings.radio ?? saved.radio) !== 'off';
  volume = clamp(volume, 0, 1);
  settings.musicVolume = volume; settings.radio = enabled ? 'on' : 'off';
  const lang = () => (readSaved().lang === 'en' ? 1 : 0);

  // ---- audio graph ----
  let ctx = null, master = null, useGain = false, analyser = null, freq = null;
  const slots = [0, 1].map(() => {
    const el = new Audio();
    el.preload = 'none'; el.loop = false; el.setAttribute('playsinline', '');
    return { el, node: null, gain: null, track: null, loaded: null, level: 0, target: 0, fade: 1, playing: false };
  });
  let cur = 0, started = false, blocked = false, failures = 0, duck = DUCK.title, lastSwitch = -1e9;
  let bag = [], last = -1, upcoming = null;
  const srcOf = track => BASE + (track.file || track.id + '.m4a');

  function buildGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      for (const s of slots) {
        s.el.volume = 1;
        s.node = ctx.createMediaElementSource(s.el);
        s.gain = ctx.createGain(); s.gain.gain.value = 0;
        s.node.connect(s.gain); s.gain.connect(master);
      }
      useGain = true;
      try {   // spectrum tap: a dead-end branch off the slot outputs (before the master volume and ducking), it changes nothing that is heard
        analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.55;
        freq = new Uint8Array(analyser.frequencyBinCount);
        for (const s of slots) s.gain.connect(analyser);
        const mute = ctx.createGain(); mute.gain.value = 0; analyser.connect(mute); mute.connect(ctx.destination);   // some browsers only run an analyser that reaches the output; this branch is silent
      } catch (e) { analyser = null; freq = null; }
    } catch (e) { ctx = null; useGain = false; analyser = null; freq = null; }   // fall back to element.volume (desktop browsers)
  }

  function applyGains(dt) {
    const m = enabled ? volume * 0.9 * duck : 0;
    if (useGain) {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(m, t, 0.12);
      for (const s of slots) s.gain.gain.setTargetAtTime(s.level, t, 0.06);
    } else {
      for (const s of slots) s.el.volume = clamp(s.level * m, 0, 1);
    }
  }

  // ---- shuffle: a bag of every track, never the same one twice in a row ----
  function pick() {
    if (!bag.length) {
      bag = tracks.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    last = bag.pop();
    return tracks[last];
  }

  // ---- loading: the current track, and the next one in its last PRELOAD seconds ----
  function load(s, track) {
    if (s.loaded === track) return;   // already requested (preloaded): keep the buffered data
    s.loaded = track;
    s.el.preload = 'auto';
    s.el.src = srcOf(track);
  }
  function release(s) {   // drop the file and abort a download that is still running
    if (!s.loaded) return;
    s.loaded = null;
    s.el.removeAttribute('src');
    s.el.preload = 'none';
    s.el.load();
  }
  function preloadNext() {
    const idle = slots[cur ^ 1];
    if (idle.playing) return;   // still fading out
    if (!upcoming) upcoming = pick();
    load(idle, upcoming);
  }

  // ---- playback ----
  function playTrack(fadeSec) {
    if (!started || !enabled) return;
    if (document.hidden) return;
    const old = slots[cur];
    cur ^= 1;
    const s = slots[cur];
    const track = upcoming || pick();
    upcoming = null;
    if (s.loaded !== track) release(s);
    s.track = track; s.level = 0; s.target = 1; s.fade = fadeSec; s.playing = true;
    load(s, track);
    const p = s.el.play();
    if (p && p.catch) p.catch(err => {
      if (err && err.name === 'NotAllowedError') { blocked = true; s.playing = false; s.target = 0; }  // retry on the next gesture
      else if (err && err.name !== 'AbortError') trackFailed(s);
    });
    if (old.playing) { old.target = 0; old.fade = fadeSec; }
    lastSwitch = performance.now();
    onTrack(track);
  }
  function trackFailed(s) {
    if (s !== slots[cur]) return;
    s.playing = false; s.target = 0;
    if (++failures < tracks.length) playTrack(0.3);     // skip a track that will not load
  }
  for (const s of slots) {
    s.el.addEventListener('playing', () => { if (s === slots[cur]) failures = 0; });
    s.el.addEventListener('error', () => { if (s.loaded) trackFailed(s); });   // not for a src that was just removed
    s.el.addEventListener('ended', () => { if (s === slots[cur] && s.playing) playTrack(0.2); });
  }
  function stopAll(fadeSec) {
    for (const s of slots) if (s.playing) { s.target = 0; s.fade = fadeSec; }
  }

  function next() {
    if (!started) return;
    if (!enabled) return setEnabled(true);
    if (performance.now() - lastSwitch < 500) return;   // button mashing: one change at a time
    playTrack(SKIP_FADE);
  }
  function setEnabled(on, save = true) {
    on = !!on;
    if (save) persist({ radio: on ? 'on' : 'off' }); else settings.radio = on ? 'on' : 'off';
    if (on === enabled) return;
    enabled = on;
    if (started) {
      if (on) { playTrack(SKIP_FADE); }
      else { stopAll(OFF_FADE); sync(); open(TAP_MS); }
    }
  }
  const toggle = () => setEnabled(!enabled);
  function setVolume(v, save = true) {
    volume = clamp(+v || 0, 0, 1);
    if (save) persist({ musicVolume: volume }); else settings.musicVolume = volume;
    // the first nudge of the slider while the radio is on but stuck behind autoplay rules: try again
    if (blocked) unlock();
  }

  // ---- first gesture ----
  function unlock() {
    buildGraph();
    if (ctx && ctx.state !== 'running') ctx.resume?.().catch?.(() => {});
    blocked = false;
    if (!started) {
      started = true;
      if (enabled) playTrack(2);
    } else if (enabled && !slots[cur].playing) {
      playTrack(SKIP_FADE);
    } else {
      for (const s of slots) if (s.playing && s.el.paused) s.el.play().catch(() => {});
    }
  }
  const onGesture = () => unlock();
  window.addEventListener('pd-gesture', onGesture);
  const first = e => {
    if (e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
    unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, first, true);
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, first, true);
  // autoplay was refused (e.g. a debug link that skipped the title): any later tap or key tries again
  const retry = () => { if (blocked) unlock(); };
  window.addEventListener('pointerdown', retry, true);
  window.addEventListener('keydown', retry, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { for (const s of slots) if (s.playing) s.el.pause(); ctx?.suspend?.().catch?.(() => {}); }
    else if (started) {
      ctx?.resume?.().catch?.(() => {});
      for (const s of slots) if (s.playing) s.el.play().catch(() => {});
      if (enabled && !slots[cur].playing) playTrack(SKIP_FADE);
    }
  });

  // ---- keyboard ----
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (game?.state !== 'play') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.code === 'KeyM') next();
    else if (e.code === 'KeyN') toggle();
  });

  // ---- the radio widget: CD, spectrum bars, title and credits, next / on-off, folds to bars + chevron ----
  const style = document.createElement('style');
  style.textContent = `
.pd-radio { position: fixed; z-index: 505; top: max(8px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); height: 46px; display: flex; align-items: center; pointer-events: none;
  --pr-tw: clamp(104px, 20vw, 168px); font-family: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif; color: #fff; text-transform: none; transition: left .3s ease, opacity .25s ease, transform .25s ease, visibility 0s; }
#pd-ui[data-st=play] ~ .pd-radio { left: calc(max(10px, env(safe-area-inset-left)) + var(--pd-menu-inset, 56px)); }   /* right of the menu button, which only exists while driving */
#pd-ui[hidden] ~ .pd-radio { display: none; }
/* the map picker and Options use the whole top left (back button, title, card): the widget steps aside there */
#pd-ui:is([data-screen=start], [data-screen=options]) ~ .pd-radio { opacity: 0; visibility: hidden; transform: translateY(-10px); transition: left .3s ease, opacity .2s ease, transform .2s ease, visibility 0s .2s; }
.pr-card { position: relative; pointer-events: auto; display: flex; align-items: center; height: 46px; padding: 0 4px 0 10px; box-sizing: border-box; cursor: pointer;
  transform: skewX(-6deg); background: linear-gradient(90deg, rgba(11,7,9,.86), rgba(40,12,28,.8)); border-left: 5px solid #e8559a; box-shadow: 0 3px 12px rgba(0,0,0,.4);
  transition: height .3s ease; touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.pr-card > * { transform: skewX(6deg); }
.pd-radio.min .pr-card { height: 34px; }
.pr-ext { flex: none; display: flex; align-items: center; gap: 8px; margin-right: 8px; max-width: calc(var(--pr-tw) + 132px); overflow: hidden; opacity: 1;
  transition: max-width .35s ease, margin .35s ease, opacity .25s ease, visibility 0s; }
.pd-radio.min .pr-ext { max-width: 0; margin-right: 0; opacity: 0; visibility: hidden; transition: max-width .35s ease, margin .35s ease, opacity .2s ease, visibility 0s .35s; }
/* the CD: the disc turns, the glint and the hub stay put */
.pr-cd { position: relative; flex: none; width: 34px; height: 34px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,.4), 0 0 10px rgba(232,85,154,.55); transition: filter .4s; }
.pr-cd i { position: absolute; inset: 0; border-radius: 50%; animation: pr-spin 2.1s linear infinite; animation-play-state: paused;
  background: repeating-radial-gradient(circle, rgba(11,7,9,0) 0 2px, rgba(11,7,9,.17) 2px 3px),
    conic-gradient(from 20deg, #f5a9c9, #fff 8%, #e8559a 20%, #8a3a62 33%, #f5a9c9 45%, #fff 56%, #e8559a 70%, #8a3a62 82%, #f5a9c9); }
.pr-cd::before { content: ''; position: absolute; z-index: 1; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #0b0709; box-shadow: 0 0 0 2px rgba(255,255,255,.55); }
.pr-cd::after { content: ''; position: absolute; z-index: 1; inset: 0; border-radius: 50%; background: linear-gradient(135deg, rgba(255,255,255,.4), rgba(255,255,255,0) 38%, rgba(255,255,255,0) 62%, rgba(255,255,255,.14)); }
.pd-radio[data-mode=on] .pr-cd i { animation-play-state: running; }
.pd-radio:not([data-mode=on]) .pr-cd { filter: grayscale(.85) brightness(.65); box-shadow: 0 0 0 1.5px rgba(255,255,255,.28); }
@keyframes pr-spin { to { transform: rotate(360deg); } }
.pr-text { flex: none; width: var(--pr-tw); min-width: 0; }
.pr-lab { display: block; margin-bottom: 2px; font-weight: 600; font-size: 9px; line-height: 1; letter-spacing: .16em; text-transform: uppercase; color: #f5a9c9; white-space: nowrap; }
.pr-line { overflow: hidden; white-space: nowrap; }
.pr-line > i { display: inline-block; font-style: normal; }
.pr-t > i { font-weight: 700; font-size: 15px; line-height: 1.12; letter-spacing: .03em; }
.pr-s > i { font-weight: 600; font-size: 11px; line-height: 1.2; letter-spacing: .04em; opacity: .8; }
.pr-line.mq > i { animation: pr-mq var(--md, 9s) ease-in-out 1.2s infinite; }
.pd-radio.min .pr-line.mq > i { animation-play-state: paused; }
@keyframes pr-mq { 0%, 15% { transform: translateX(0); } 50%, 65% { transform: translateX(var(--sx)); } 100% { transform: translateX(0); } }
.pr-btn { position: relative; flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff;
  background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.4); cursor: pointer; touch-action: manipulation; -webkit-appearance: none; appearance: none; transition: background .12s; }
.pr-btn::before { content: ''; position: absolute; inset: -3px; }
.pr-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.pr-next svg path:first-child { fill: currentColor; }
.pr-btn:active { background: rgba(255,255,255,.4); }
@media (hover: hover) { .pr-btn:hover { background: rgba(255,255,255,.2); } }
.pr-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pr-pwr[aria-pressed=true] { background: rgba(232,85,154,.36); box-shadow: inset 0 0 0 1.5px #e8559a, 0 0 8px rgba(232,85,154,.6); }
.pr-bars { flex: none; display: block; width: 48px; height: 26px; margin-right: 2px; }
.pr-chev { width: 26px; height: 34px; border-radius: 6px; background: none; box-shadow: none; }
.pr-chev svg { width: 14px; height: 14px; transition: transform .3s ease; transform: rotate(180deg); }
.pd-radio.min .pr-chev svg { transform: rotate(0); }
@media (hover: hover) { .pr-chev:hover { background: rgba(255,255,255,.12); } }
@media (prefers-reduced-motion: reduce) { .pr-cd i, .pr-line.mq > i { animation: none; } .pr-card, .pr-ext, .pd-radio { transition: none; } }
`;
  document.head.appendChild(style);

  const ICON = {
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5l9 7-9 7z"/><path d="M19 5v14"/></svg>',
    power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 7.2a8 8 0 1 0 11.4 0"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>',
  };
  const box = document.createElement('div');
  // pd-radio-toast + on: src/suca.js stacks its graffiti toast under any '.pd-radio-toast.on', which keeps that toast clear of this widget
  box.className = 'pd-radio pd-radio-toast on';
  box.setAttribute('role', 'group');
  box.innerHTML = `<div class="pr-card">
    <div class="pr-ext"><div class="pr-cd"><i></i></div>
      <div class="pr-text" aria-live="polite"><small class="pr-lab"></small><div class="pr-line pr-t"><i></i></div><div class="pr-line pr-s"><i></i></div></div>
      <button class="pr-btn pr-next" type="button">${ICON.next}</button><button class="pr-btn pr-pwr" type="button">${ICON.power}</button></div>
    <canvas class="pr-bars"></canvas>
    <button class="pr-btn pr-chev" type="button">${ICON.chev}</button></div>`;
  document.body.appendChild(box);
  const $ = sel => box.querySelector(sel);
  const el = { card: $('.pr-card'), lab: $('.pr-lab'), t: $('.pr-t'), s: $('.pr-s'), next: $('.pr-next'), pwr: $('.pr-pwr'), chev: $('.pr-chev'), cv: $('.pr-bars') };
  // the shell stops touch events for its own buttons so the page lockdown (double-tap guard) leaves them alone; same here
  for (const ev of ['touchstart', 'touchmove', 'touchend']) box.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  const langNow = () => { const l = document.documentElement.lang; return l ? (l === 'en' ? 1 : 0) : lang(); };

  // open / folded: a track change or a tap opens it for a while, then it folds to the bars and a chevron
  let exp = true, hover = false, evBusy = false, armed = false, foldTimer = 0, lastKey = '', lastLang = 0;
  function applyExp() {
    const min = !exp || evBusy;
    box.classList.toggle('min', min);
    el.chev.setAttribute('aria-expanded', String(!min));
    el.chev.setAttribute('aria-label', T[min ? 'open' : 'fold'][lastLang]); el.chev.title = el.chev.getAttribute('aria-label');
    if (!min) fitLines();
  }
  function arm(ms) { clearTimeout(foldTimer); if (!armed) return; foldTimer = setTimeout(() => { if (!hover) { exp = false; applyExp(); } }, ms); }
  function open(ms = OPEN_MS) { exp = true; applyExp(); arm(ms); }
  el.card.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b === el.chev) { if (exp && !evBusy) { exp = false; applyExp(); clearTimeout(foldTimer); } else open(TAP_MS); }
    else if (b === el.next) { next(); open(TAP_MS); }
    else if (b === el.pwr) { toggle(); open(TAP_MS); }
    else if (!exp) open(TAP_MS);
    else arm(TAP_MS);
    if (b) b.blur();   // a focused button would take the space bar (handbrake) as a click
  });
  el.card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = true; clearTimeout(foldTimer); } });
  el.card.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = false; if (exp) arm(TAP_MS); } });

  // text: label, title, credits. A line that is wider than its box scrolls slowly there and back.
  function setLine(line, text) { const i = line.firstChild; i.textContent = text; line.title = text; line.classList.remove('mq'); }
  function fitLine(line) {
    const over = line.firstChild.offsetWidth - line.clientWidth;
    if (over > 2) { line.style.setProperty('--sx', `-${over + 6}px`); line.style.setProperty('--md', `${(over / 24 + 6).toFixed(1)}s`); void line.offsetWidth; line.classList.add('mq'); }
  }
  function fitLines() { if (!box.classList.contains('min')) { fitLine(el.t); fitLine(el.s); } }
  function render(mode, track, l) {
    const on = mode === 'on';
    el.lab.textContent = on ? T.now[l] : T.fm[l];
    setLine(el.t, on ? track.title : mode === 'off' ? T.off[l] : T.idle[l]);
    setLine(el.s, on ? `${track.by} · ${track.lic}` : mode === 'off' ? T.offSub[l] : T.idleSub[l]);
    box.dataset.mode = mode;
    box.setAttribute('aria-label', `${T.fm[l]}: ${el.t.title}`);
    el.next.setAttribute('aria-label', T.next[l]); el.next.title = T.next[l];
    el.pwr.setAttribute('aria-label', T.power[l]); el.pwr.title = T.power[l]; el.pwr.setAttribute('aria-pressed', String(mode !== 'off'));
    lastLang = l; applyExp();
  }
  function sync() {   // 10 Hz, from tick(): touches the DOM only when something changed
    const l = langNow();
    const mode = !enabled ? 'off' : (!started || blocked) ? 'idle' : (slots[cur].playing && slots[cur].track) ? 'on' : 'idle';
    const track = mode === 'on' ? slots[cur].track : null;
    const key = `${mode}|${track ? track.title : ''}|${l}`;
    if (key !== lastKey) { lastKey = key; render(mode, track, l); }
    if (!armed && !document.getElementById('loading')) { armed = true; arm(OPEN_MS); }   // the first fold waits for the loading screen to go
    // keep it folded where it would run into something: the event card (top centre) on screens under 1200 wide, the side menu on screens under 760
    const busy = (innerWidth < 1200 && !!document.querySelector('#ev-hud.on')) || (innerWidth < 760 && game?.state === 'pause');
    if (busy !== evBusy) { evBusy = busy; applyExp(); }
    if (mode === 'on') kick();
  }
  function onTrack() { sync(); if (!armed) { exp = true; applyExp(); } else open(OPEN_MS); }

  // spectrum: 11 bars from the analyser (log-spaced bins), drawn on a 48 x 26 canvas about every other frame; the loop stops once the bars have settled
  const CW = 48, CH = 26, BW = 3, BGAP = 1.5;
  const g2 = el.cv.getContext('2d');
  const lv = new Float32Array(BARS), pk = new Float32Array(BARS);
  const edges = [1]; for (let i = 1; i <= BARS; i++) edges.push(Math.max(edges[i - 1] + 1, Math.round(Math.pow(72, i / BARS))));
  let raf = 0, lastDraw = 0, grad = null, dpr = 0;
  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    el.cv.width = Math.round(CW * dpr); el.cv.height = Math.round(CH * dpr);
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    grad = g2.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#ffd1e6'); grad.addColorStop(.45, '#f06fae'); grad.addColorStop(1, '#8a3a62');
  }
  sizeCanvas();
  window.addEventListener('resize', () => { if ((window.devicePixelRatio || 1) !== dpr) { sizeCanvas(); kick(); } });
  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    if (now - lastDraw < 30) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    const live = started && enabled && !blocked && slots[cur].playing && (!ctx || ctx.state === 'running');
    let sum = 0;
    if (live && analyser) analyser.getByteFrequencyData(freq);
    for (let i = 0; i < BARS; i++) {
      let v = 0;
      if (live && analyser) {
        let a = 0; const lo = edges[i], hi = edges[i + 1];
        for (let k = lo; k < hi; k++) a += freq[k];
        v = a / (hi - lo) / 255;
        v = Math.min(1, v * (0.85 + 0.6 * i / (BARS - 1)));   // the top of the spectrum is quiet in music: lift it a little
        v = v * v * 0.95;
      } else if (live) v = 0.25 + 0.2 * Math.sin(now / 170 + i * 1.7) * Math.sin(now / 410 + i);   // no Web Audio: a gentle stand-in
      v = Math.min(1, v);
      lv[i] += (v - lv[i]) * (v > lv[i] ? 0.7 : 0.2);
      pk[i] = Math.max(lv[i], pk[i] - 0.03);
      sum += lv[i] + pk[i];
    }
    g2.clearRect(0, 0, CW, CH);
    g2.globalAlpha = live || sum > 0.5 ? 1 : 0.4;
    for (let i = 0; i < BARS; i++) {
      const x = i * (BW + BGAP), h = Math.max(2, Math.round(lv[i] * CH));
      g2.fillStyle = grad; g2.fillRect(x, CH - h, BW, h);
      if (pk[i] > 0.08) { g2.fillStyle = '#fff'; g2.fillRect(x, Math.max(0, CH - Math.round(pk[i] * CH) - 2.5), BW, 1.5); }
    }
    if (live || sum > 0.4) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  kick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // ---- the shell changed a setting in Options ----
  window.addEventListener('pd-music-setting', () => {
    if (Number.isFinite(settings.musicVolume)) volume = clamp(settings.musicVolume, 0, 1);
    const on = settings.radio !== 'off';
    if (on !== enabled) { enabled = on; if (started) { if (on) playTrack(SKIP_FADE); else stopAll(OFF_FADE); } }
  });

  // ---- main tick: fades, ducking, auto-advance, button and toast visibility ----
  let lastTick = performance.now();
  function tick() {
    const now = performance.now(), dt = Math.min(0.5, (now - lastTick) / 1000); lastTick = now;
    const state = game?.state || 'play';
    duck += (( DUCK[state] ?? 1) - duck) * Math.min(1, dt * 5);
    for (const s of slots) {
      if (s.level !== s.target) {
        const step = dt / Math.max(0.05, s.fade);
        s.level = s.level < s.target ? Math.min(s.target, s.level + step) : Math.max(s.target, s.level - step);
      }
      if (s.playing && s.target === 0 && s.level === 0) { s.playing = false; s.el.pause(); release(s); }
    }
    applyGains(dt);
    const c = slots[cur];
    if (started && enabled && c.playing && !blocked) {   // run-out: start the next one early enough to overlap
      const d = c.el.duration;
      if (Number.isFinite(d) && d > XFADE * 2) {
        if (c.el.currentTime >= d - XFADE && now - lastSwitch > 2000) playTrack(XFADE);
        else if (c.el.currentTime >= d - PRELOAD) preloadNext();
      }
    }
    sync();
  }
  const timer = setInterval(tick, 100);
  tick();

  instance = {
    next, toggle, setEnabled, setVolume, unlock,
    get enabled() { return enabled; },
    get volume() { return volume; },
    get current() { return slots[cur].playing ? slots[cur].track : null; },
    tracks,
    debug: () => ({ useGain, ctx: ctx && ctx.state, levels: slots.map(s => +s.level.toFixed(2)), duck: +duck.toFixed(2), master: master ? +master.gain.value.toFixed(3) : null, vols: slots.map(s => s.el.volume), started, blocked, failures }),
    destroy() { clearInterval(timer); cancelAnimationFrame(raf); clearTimeout(foldTimer); stopAll(0.1); for (const s of slots) s.el.pause(); box.remove(); style.remove(); instance = null; },
  };
  return instance;
}
