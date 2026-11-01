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
// - Files: the Alamia e Sperandeo tracks exist as Opus in WebM (.webm, about 48 kbps) and as HE-AAC in .m4a (about 40 kbps,
//   for browsers that cannot play Opus in WebM, e.g. older iOS Safari); both have their index up front so playback
//   starts while they download. Which one is used is decided once with canPlayType.
// - Keys (in play): M = next track, N = radio on/off. The on-screen controls (next track, on/off) are in the in-game side menu (src/ui.js),
//   which uses the API returned here: next(), toggle(), enabled, current.
// - Settings live in game.settings (musicVolume 0..1, radio 'on'|'off') and in localStorage under
//   palermoDrive.settings.v1, next to the shell's own keys. src/ui.js shows them in Options and fires the
//   window event 'pd-music-setting' when one changes.
// - Ducks under the pause menu and the title screen. Credits for every track: assets/music/CREDITS.md.

const SETTINGS_KEY = 'palermoDrive.settings.v1';
const BASE = new URL('../assets/music/', import.meta.url).href;

// file (or id: <id>.webm / <id>.m4a), title, author, licence (shown in the "now playing" toast).
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
const TOAST_MS = 5200;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const T = {   // [italiano, english]
  now: ['In onda', 'Now playing'],
  off: ['Radio spenta', 'Radio off'],
  on: ['Radio accesa', 'Radio on'],
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
  let ctx = null, master = null, useGain = false;
  const slots = [0, 1].map(() => {
    const el = new Audio();
    el.preload = 'none'; el.loop = false; el.setAttribute('playsinline', '');
    return { el, node: null, gain: null, track: null, loaded: null, level: 0, target: 0, fade: 1, playing: false };
  });
  let cur = 0, started = false, blocked = false, failures = 0, duck = DUCK.title, lastSwitch = -1e9;
  let bag = [], last = -1, upcoming = null, pendingToast = null;
  // Opus in WebM where the browser says it can (smaller), HE-AAC in .m4a otherwise. Decided on first use, no request involved.
  let opus = null;
  const srcOf = track => {
    if (track.file) return BASE + track.file;
    if (opus === null) opus = !!new Audio().canPlayType('audio/webm; codecs="opus"');
    return BASE + track.id + (opus ? '.webm' : '.m4a');
  };

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
    } catch (e) { ctx = null; useGain = false; }   // fall back to element.volume (desktop browsers)
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
    showToast(track);
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
      else { stopAll(OFF_FADE); hideToast(); flash(T.off); }
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

  // ---- "now playing" toast: near-black panel, rosanero accent, top left beside the menu button ----
  const style = document.createElement('style');
  style.textContent = `
.pd-radio-toast { position: fixed; z-index: 505; top: max(8px, env(safe-area-inset-top)); /* top-left, right of the menu button; JS moves it under the mission panel */ left: calc(max(10px, env(safe-area-inset-left)) + 56px); transform: translate(0, -8px);
  width: max-content; max-width: min(340px, 64vw); box-sizing: border-box; padding: 7px 12px 8px 11px; border-radius: 9px; pointer-events: none;
  background: rgba(11,7,9,.88); border: 1px solid rgba(232,85,154,.7); border-left: 4px solid #e8559a; color: #fff; opacity: 0;
  font: 600 13px/1.25 system-ui, -apple-system, sans-serif; text-shadow: none; transition: opacity .35s, transform .35s; }
.pd-radio-toast.on { opacity: 1; transform: translate(0, 0); }
.pd-radio-toast small { display: block; font: 800 9.5px/1 system-ui, -apple-system, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #e8559a; margin-bottom: 3px; }
.pd-radio-toast b { display: block; font-weight: 800; font-size: 14px; overflow-wrap: anywhere; }
.pd-radio-toast span { display: block; font-weight: 500; font-size: 11.5px; opacity: .78; margin-top: 1px; overflow-wrap: anywhere; }
@media (max-height: 460px) { .pd-radio-toast { font-size: 11px; padding: 5px 10px 6px 9px; max-width: min(300px, 46vw); } .pd-radio-toast b { font-size: 12px; } .pd-radio-toast span { font-size: 10px; } }
`;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.className = 'pd-radio-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Keep the toast in the top-left corner, below the taxi mission panel when that's on screen.
  function placeToast() {
    const hud = document.querySelector('#pm-hud.on');
    toast.style.top = hud ? `${Math.round(hud.getBoundingClientRect().bottom + 8)}px` : '';
  }
  function hideToast() { clearTimeout(toastTimer); toast.classList.remove('on'); pendingToast = null; }
  function showToast(track) {
    if (game?.state !== 'play') { pendingToast = track; return; }   // the title and menus stay quiet; show it once driving
    pendingToast = null;
    toast.innerHTML = `<small>${T.now[lang()]}</small><b>${esc(track.title)}</b><span>${esc(track.by)} · ${esc(track.lic)}</span>`;
    placeToast(); toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), TOAST_MS);
  }
  function flash(msg) {
    if (game?.state !== 'play') return;
    toast.innerHTML = `<small>FM Palermo</small><b>${esc(msg[lang()])}</b>`;
    placeToast(); toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1800);
  }

  // ---- the shell changed a setting in Options ----
  window.addEventListener('pd-music-setting', () => {
    if (Number.isFinite(settings.musicVolume)) volume = clamp(settings.musicVolume, 0, 1);
    const on = settings.radio !== 'off';
    if (on !== enabled) { enabled = on; if (started) { if (on) playTrack(SKIP_FADE); else stopAll(OFF_FADE); } }
  });

  // ---- main tick: fades, ducking, auto-advance, button and toast visibility ----
  let lastTick = performance.now(), prevState = null;
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
    if (state !== prevState) {
      prevState = state;
      if (state === 'play') { if (pendingToast && started && enabled && slots[cur].track === pendingToast) showToast(pendingToast); else pendingToast = null; }
      else toast.classList.remove('on');
    }
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
    destroy() { clearInterval(timer); stopAll(0.1); for (const s of slots) s.el.pause(); toast.remove(); style.remove(); instance = null; },
  };
  return instance;
}
