// Car radio: shuffled Sicilian / southern-Italian tracks with crossfades. Owned by the music work.
//
//   import { createRadio } from './radio.js';
//   createRadio({ game });          // once, after setupUI(); everything else is automatic
//
// - Starts on the first user gesture (window event 'pd-gesture', or the first pointer / key press).
// - Streams with two <audio> elements routed through Web Audio gain nodes (iOS ignores element.volume),
//   so nothing is decoded up front.
// - Keys (in play): M = next track, N = radio on/off. Touch: a round button right of the small buttons at the
//   top centre (tap = next track, long press = radio on/off). Desktop: right of the pause button.
// - Settings live in game.settings (musicVolume 0..1, radio 'on'|'off') and in localStorage under
//   palermoDrive.settings.v1, next to the shell's own keys. src/ui.js shows them in Options and fires the
//   window event 'pd-music-setting' when one changes.
// - Ducks under the pause menu and the title screen. Credits for every track: assets/music/CREDITS.md.

const SETTINGS_KEY = 'palermoDrive.settings.v1';
const BASE = new URL('../assets/music/', import.meta.url).href;

// file, title, author, licence (shown in the "now playing" toast). `kind` is only for humans reading this list.
export const TRACKS = [
  { file: 'bushwick-tarantella.mp3', title: 'Bushwick Tarantella', by: 'Kevin MacLeod', lic: 'CC BY 4.0' },
  { file: 'tarantella-air-force-strings.mp3', title: 'Tarantella', by: 'Air Force Strings, US Air Force Band', lic: 'Public domain' },
  { file: 'funiculi-funicula-banda.mp3', title: 'Funiculì, Funiculà (1903)', by: 'F. Giannini, Royal Marine Band of Italy', lic: 'Public domain' },
  { file: 'gran-marcia-del-drago-sacro.mp3', title: 'Gran Marcia del Drago Sacro (1907)', by: 'Musica della R. Marina Italiana', lic: 'Public domain' },
  { file: 'meatball-parade.mp3', title: 'Meatball Parade', by: 'Kevin MacLeod', lic: 'CC BY 4.0' },
  { file: 'aida-gran-marcia-trionfale.mp3', title: 'Gran Marcia trionfale, Aida', by: 'Musica della R. Marina Italiana', lic: 'Public domain' },
  { file: 'cavalleria-intermezzo.mp3', title: 'Intermezzo, Cavalleria Rusticana', by: 'Victor Orchestra, W. B. Rogers', lic: 'Public domain' },
  { file: 'madreterra.mp3', title: 'Madreterra (inno della Regione Siciliana)', by: 'Regione Siciliana', lic: 'CC0' },
];

const XFADE = 4;          // seconds of overlap when a track runs out
const SKIP_FADE = 1.2;    // seconds when the player skips or switches on
const OFF_FADE = 0.5;
const DUCK = { play: 1, pause: 0.22, title: 0.6, over: 0.3 };
const TOAST_MS = 5200;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const T = {   // [italiano, english]
  now: ['In onda', 'Now playing'],
  off: ['Radio spenta', 'Radio off'],
  on: ['Radio accesa', 'Radio on'],
  btn: ['Radio: tocca per cambiare brano, tieni premuto per spegnere', 'Radio: tap for next track, hold to turn off'],
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
    el.preload = 'auto'; el.loop = false; el.setAttribute('playsinline', '');
    return { el, node: null, gain: null, track: null, level: 0, target: 0, fade: 1, playing: false };
  });
  let cur = 0, started = false, blocked = false, failures = 0, duck = DUCK.title, lastSwitch = -1e9;
  let bag = [], last = -1, pendingToast = null;

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

  // ---- playback ----
  function playTrack(fadeSec) {
    if (!started || !enabled) return;
    if (document.hidden) return;
    const old = slots[cur];
    cur ^= 1;
    const s = slots[cur];
    const track = pick();
    s.track = track; s.level = 0; s.target = 1; s.fade = fadeSec; s.playing = true;
    s.el.src = BASE + track.file;
    const p = s.el.play();
    if (p && p.catch) p.catch(err => {
      if (err && err.name === 'NotAllowedError') { blocked = true; s.playing = false; s.target = 0; }  // retry on the next gesture
      else if (err && err.name !== 'AbortError') trackFailed(s);
    });
    if (old.playing) { old.target = 0; old.fade = fadeSec; }
    lastSwitch = performance.now();
    showToast(track);
    // warm the connection for nothing: tracks are streamed, the next one is only requested when it starts
  }
  function trackFailed(s) {
    if (s !== slots[cur]) return;
    s.playing = false; s.target = 0;
    if (++failures < tracks.length) playTrack(0.3);     // skip a track that will not load
  }
  for (const s of slots) {
    s.el.addEventListener('playing', () => { if (s === slots[cur]) failures = 0; });
    s.el.addEventListener('error', () => trackFailed(s));
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
    syncButton();
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

  // ---- "now playing" toast: near-black panel, rosanero accent, top centre under the small buttons ----
  const style = document.createElement('style');
  style.textContent = `
.pd-radio-btn { position: fixed; z-index: 510; top: max(8px, env(safe-area-inset-top)); left: calc(50% + 35px); width: 46px; height: 46px; padding: 0;
  border: 0; border-radius: 50%; display: none; align-items: center; justify-content: center; color: #fff; cursor: pointer; touch-action: manipulation;
  background: rgba(11,7,9,.42); box-shadow: inset 0 0 0 2px rgba(232,85,154,.85); -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; transition: background .12s, opacity .2s; }
.pd-radio-btn.show { display: flex; }
.pd-radio-btn:active { background: rgba(232,85,154,.55); }
@media (hover: hover) { .pd-radio-btn:hover { background: rgba(11,7,9,.65); } }
.pd-radio-btn svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
.pd-radio-btn .pd-slash { display: none; stroke: #e8559a; stroke-width: 3; }
.pd-radio-btn.off { opacity: .7; box-shadow: inset 0 0 0 2px rgba(255,255,255,.4); }
.pd-radio-btn.off .pd-slash { display: block; }
.pd-radio-toast { position: fixed; z-index: 505; top: calc(max(8px, env(safe-area-inset-top)) + 58px + clamp(64px, 13vh, 92px)); /* below the taxi direction arrow */ left: 50%; transform: translate(-50%, -8px);
  width: max-content; max-width: min(340px, 64vw); box-sizing: border-box; padding: 7px 12px 8px 11px; border-radius: 9px; pointer-events: none;
  background: rgba(11,7,9,.88); border: 1px solid rgba(232,85,154,.7); border-left: 4px solid #e8559a; color: #fff; opacity: 0;
  font: 600 13px/1.25 system-ui, -apple-system, sans-serif; text-shadow: none; transition: opacity .35s, transform .35s; }
.pd-radio-toast.on { opacity: 1; transform: translate(-50%, 0); }
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
  function hideToast() { clearTimeout(toastTimer); toast.classList.remove('on'); pendingToast = null; }
  function showToast(track) {
    if (game?.state !== 'play') { pendingToast = track; return; }   // the title and menus stay quiet; show it once driving
    pendingToast = null;
    toast.innerHTML = `<small>${T.now[lang()]}</small><b>${esc(track.title)}</b><span>${esc(track.by)} · ${esc(track.lic)}</span>`;
    toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), TOAST_MS);
  }
  function flash(msg) {
    if (game?.state !== 'play') return;
    toast.innerHTML = `<small>FM Palermo</small><b>${esc(msg[lang()])}</b>`;
    toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1800);
  }

  // ---- touch / mouse button ----
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'pd-radio-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/><path class="pd-slash" d="M3 21L21 3"/></svg>';
  document.body.appendChild(btn);
  let holdTimer = 0, held = false;
  btn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    held = false; clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { held = true; toggle(); }, 550);
  });
  const cancelHold = () => clearTimeout(holdTimer);
  btn.addEventListener('pointerup', cancelHold); btn.addEventListener('pointercancel', cancelHold); btn.addEventListener('pointerleave', cancelHold);
  btn.addEventListener('click', e => { e.stopPropagation(); if (held) { held = false; return; } started ? next() : unlock(); btn.blur(); });
  btn.addEventListener('contextmenu', e => e.preventDefault());
  function syncButton() {
    btn.classList.toggle('off', !enabled);
    const label = T.btn[lang()];
    btn.setAttribute('aria-label', label); btn.title = label;
  }
  syncButton();

  // sits right of the touch controls' small buttons (camera / reset / fullscreen) when they exist, else right of the pause button
  let placeAt = 0;
  function place(force) {
    const now = performance.now();
    if (!force && now - placeAt < 800) return;
    placeAt = now;
    const small = document.querySelector('.tc-small');
    const r = small && small.getBoundingClientRect();
    if (r && r.width > 0) { btn.style.left = Math.round(r.right + 12) + 'px'; btn.style.top = Math.round(r.top) + 'px'; }
    else { btn.style.left = ''; btn.style.top = ''; }
  }
  window.addEventListener('resize', () => place(true));
  window.addEventListener('orientationchange', () => setTimeout(() => place(true), 250));

  // ---- the shell changed a setting in Options ----
  window.addEventListener('pd-music-setting', () => {
    if (Number.isFinite(settings.musicVolume)) volume = clamp(settings.musicVolume, 0, 1);
    const on = settings.radio !== 'off';
    if (on !== enabled) { enabled = on; if (started) { if (on) playTrack(SKIP_FADE); else stopAll(OFF_FADE); } syncButton(); }
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
      if (s.playing && s.target === 0 && s.level === 0) { s.playing = false; s.el.pause(); }
    }
    applyGains(dt);
    const c = slots[cur];
    if (started && enabled && c.playing && !blocked) {   // run-out: start the next one early enough to overlap
      const d = c.el.duration;
      if (Number.isFinite(d) && d > XFADE * 2 && c.el.currentTime >= d - XFADE && now - lastSwitch > 2000) playTrack(XFADE);
    }
    if (state !== prevState) {
      prevState = state;
      btn.classList.toggle('show', state === 'play');
      if (state === 'play') { place(true); if (pendingToast && started && enabled && slots[cur].track === pendingToast) showToast(pendingToast); else pendingToast = null; }
      else toast.classList.remove('on');
    } else if (state === 'play') place(false);
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
    destroy() { clearInterval(timer); stopAll(0.1); for (const s of slots) s.el.pause(); btn.remove(); toast.remove(); style.remove(); instance = null; },
  };
  return instance;
}
