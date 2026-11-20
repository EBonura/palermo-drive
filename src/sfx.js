// Short game sounds and ambient beds, synthesised but for ten recordings, on the car radio's AudioContext (src/radio.js: it exists from the game's first tap, and
// src/audio-recover.js brings it back after the page was in the background). One place for the cues that tell the player something happened, so a
// module wanting a sound makes no context of its own:
//
//   import { sfx, bed } from './sfx.js';
//   sfx('cash');                    // a named one-shot (CUES below); sfx(name, k, pan): k 0..1 its strength, pan -1..1
//   bed('rain', level, pan, tone);  // a looped bed (BEDS below) held at level 0..1; call it as often as you like, it only writes what changed
//
// main.js calls setSfxSource(() => radio) once. Before the first tap, or with no Web Audio, every call is a no-op. Two buses: 'ui' follows the Options
// volume only (menus sound the same paused), 'world' also follows the radio's duck (quieter under the pause menu and the title).
// No node is made per frame: a one-shot makes its few nodes when it plays and they end by themselves, a bed makes its nodes once and is unplugged
// after two seconds at zero. Each cue has a minimum gap, so a pile of bins is a few clangs and not forty.
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
let getRadio = () => null, ctx = null, ui = null, world = null, noiseBuf = null, vol0 = -1, duck0 = -1;
const lastAt = {}, beds = {};
const notes = (out, t, fs, step, dur, g, type) => fs.forEach((f, i) => tone(out, t + i * step, f, dur, g, type));

export function setSfxSource(fn) { getRadio = fn; }

function ready() {
  const r = getRadio(), c = r && r.context; if (!c) return false;
  if (c !== ctx) {
    ctx = c; ui = c.createGain(); world = c.createGain(); ui.connect(c.destination); world.connect(c.destination);
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k in beds) delete beds[k];
    for (const k in bufs) delete bufs[k]; for (const k in loads) delete loads[k];
    for (const k of ['crash-light', 'crash-heavy1', 'crash-heavy2', 'glass1', 'glass2', 'wood-break', 'bags1', 'bags2', 'bonk1', 'bonk2', 'bin-metal', 'sign-metal', 'pole-metal', 'rail-metal', 'jingle-start', 'jingle-win', 'jingle-fail']) load(k);   // the short ones are wanted the moment something happens
    vol0 = duck0 = -1;
  }
  if (c.state !== 'running') return false;   // a suspended context would queue the sound and play it late
  const v = clamp(+r.sfxVolume || 0, 0, 1), dk = Number.isFinite(r.duck) ? clamp(r.duck, 0, 1) : 1;
  if (v !== vol0 || dk !== duck0) { vol0 = v; duck0 = dk; ui.gain.value = v * 0.9; world.gain.setTargetAtTime(v * 0.9 * dk, c.currentTime, 0.08); }
  return v > 0.001;
}

// ---- the two voices every cue is made of ----
function env(e, t, dur, g, at) { e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + at); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function tone(out, t, f, dur, g, type = 'sine', f1 = 0, at = 0.005) {
  const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(e, t, dur, g, at); o.connect(e); e.connect(out); o.start(t); o.stop(t + dur + 0.03);
}
function hiss(out, t, dur, g, type, f, q = 0.8, f1 = 0, at = 0.005) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), e = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(e, t, dur, g, at); s.connect(fl); fl.connect(e); e.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
}

// ---- one-shots: name -> [bus, minimum gap in seconds, (out, t, k) => void]. The owner chose each of these from three takes and some recordings (19 November 2026) ----
const chord = (out, t, fs, dur, g, type) => fs.forEach(f => tone(out, t, f, dur, g, type));
const CUES = {
  // menus
  tick:   ['ui', 0.03, (o, t) => tone(o, t, 420, 0.07, 0.25, 'sine', 640)],   // a soft rising pop
  back:   ['ui', 0.03, (o, t) => tone(o, t, 300, 0.09, 0.3, 'sine', 170)],   // a low thud
  open:   ['ui', 0.1, (o, t) => chord(o, t, [660, 990], 0.2, 0.12, 'sine')],   // the pause menu: one soft chord
  close:  ['ui', 0.1, (o, t) => chord(o, t, [495, 742], 0.2, 0.12, 'sine')],   // and its lower twin
  whoosh: ['ui', 0.25, (o, t) => { hiss(o, t, 0.5, 0.25, 'bandpass', 500, 0.9, 2200, 0.16); tone(o, t, 70, 0.5, 0.3, 'sine', 150, 0.2); }],   // the checkerboard closing over the screen
  buy:    ['ui', 0.15, (o, t) => { for (let i = 0; i < 5; i++) hiss(o, t + i * 0.035, 0.02, 0.2, 'bandpass', 3000, 3); tone(o, t + 0.2, 2093, 0.5, 0.2, 'sine'); }],   // a ratchet, then a ding
  no:     ['ui', 0.15, (o, t) => tone(o, t, 150, 0.32, 0.25, 'sawtooth', 120)],   // not enough money: one long raspberry
  // events
  toast:  ['world', 0.12, (o, t) => tone(o, t, 1175, 0.4, 0.16, 'sine')],   // a single glass ping
  warn:   ['world', 0.3, (o, t) => notes(o, t, [880, 880, 880], 0.11, 0.07, 0.18, 'square')],   // three fast beeps
  count:  ['world', 0.2, (o, t) => { tone(o, t, 880, 0.14, 0.25, 'sine'); hiss(o, t, 0.01, 0.2, 'highpass', 4000); }],   // a clean pip with a click
  go:     ['world', 0.2, (o, t) => chord(o, t, [440, 554, 659], 0.7, 0.14, 'sawtooth')],   // a three-note air horn
  start:  ['world', 0.3, (o, t) => sample(o, t, 'jingle-start', 0.45, 1)],   // a pizzicato jingle (the owner swapped the three mission jingles for recordings the same day)
  cash:   ['world', 0.3, (o, t) => { tone(o, t, 140, 0.12, 0.4, 'sine', 70); chord(o, t + 0.09, [1760, 2637], 0.8, 0.14, 'sine'); }],   // the till: thunk and bell
  win:    ['world', 0.5, (o, t) => sample(o, t, 'jingle-win', 0.45, 1)],   // a pizzicato jingle, three notes up
  fail:   ['world', 0.5, (o, t) => sample(o, t, 'jingle-fail', 0.45, 1)],   // a pizzicato jingle, three notes sliding down
  treat:  ['world', 0.3, (o, t) => { hiss(o, t, 0.35, 0.15, 'bandpass', 900, 1.2, 4200, 0.05); notes(o, t + 0.05, [784, 988, 1175, 1568], 0.06, 0.2, 0.15, 'triangle'); }],   // nitro from a stigghiola or a granita: a fizz and four notes
  // the police
  heat:   ['world', 0.6, (o, t) => { for (let i = 0; i < 2; i++) { tone(o, t + i * 0.3, 740, 0.14, 0.18, 'square'); tone(o, t + i * 0.3 + 0.15, 560, 0.14, 0.18, 'square'); } }],   // a little ni-no, twice
  cool:   ['world', 0.6, (o, t) => notes(o, t, [659, 523, 392], 0.11, 0.3, 0.16, 'sine')],   // three soft notes down
  bust:   ['world', 1, (o, t) => {   // the whistle, then the hand on the roof
    for (const [dt, len] of [[0, 0.16], [0.22, 0.5]]) { tone(o, t + dt, 2850, len, 0.16, 'sine', 2700, 0.01); tone(o, t + dt, 2920, len, 0.1, 'square', 2780, 0.01); hiss(o, t + dt, len, 0.06, 'bandpass', 2900, 6); }
    tone(o, t + 0.8, 110, 0.25, 0.5, 'sine', 48); hiss(o, t + 0.8, 0.1, 0.3, 'lowpass', 900);
  }],
  // things in the street
  // (Nov 2026: the owner chose recordings for the things the lapa hits, src/sfx.js FILES; metal has one for each kind of thing, METAL in src/props.js says which is which)
  'metal-bin':  ['world', 0.09, (o, t, k) => sample(o, t, 'bin-metal', 0.7 * k, 0.94 + Math.random() * 0.14)],   // a bin or a skip: bars dropped in a dumpster (the recording clips a little, as its author says)
  'metal-sign': ['world', 0.09, (o, t, k) => sample(o, t, 'sign-metal', 0.7 * k, 0.94 + Math.random() * 0.14)],   // a sign or any thin sheet of metal: a signpost dropped on concrete
  'metal-pole': ['world', 0.09, (o, t, k) => sample(o, t, 'pole-metal', 0.7 * k, 0.94 + Math.random() * 0.14)],   // a lamp post or any pole: a metal pole struck
  'metal-rail': ['world', 0.09, (o, t, k) => sample(o, t, 'rail-metal', 0.7 * k, 0.94 + Math.random() * 0.14)],   // a railing or a fence: a metal railing struck
  tock:   ['world', 0.09, (o, t, k) => sample(o, t, 'wood-break', 0.5 * k, 0.92 + Math.random() * 0.2)],   // a crate, a stall, a chair: a wooden crate breaking, kept low
  rustle: ['world', 0.12, (o, t, k) => sample(o, t, any('bags1', 'bags2'), 0.8 * k, 0.9 + Math.random() * 0.2)],   // a rubbish pile, cardboard, a hedge: a bag of rubbish dropped, or a box
  crunch: ['world', 0.12, (o, t, k) => { if (k < 0.75) { sample(o, t, 'crash-light', 0.35 + 0.45 * k, 0.94 + Math.random() * 0.14); return; }   // a car: a clank for a tap or a shunt,
    sample(o, t, any('crash-heavy1', 'crash-heavy2'), Math.min(0.85, 0.55 * k + 0.15), 0.95 + Math.random() * 0.1); sample(o, t + 0.04, any('glass1', 'glass2'), 0.28 * k, 0.95 + Math.random() * 0.15); }],   // a crash with breaking glass for a real hit
  splash: ['world', 0.15, (o, t, k) => { hiss(o, t, 1, 0.45 * k, 'lowpass', 3000, 0.6, 300, 0.03); tone(o, t, 90, 0.4, 0.4 * k, 'sine', 40); }],   // a big one with weight
  bonk:   ['world', 0.08, (o, t, k) => sample(o, t, any('bonk1', 'bonk2'), 0.7 * k, 0.94 + Math.random() * 0.14)],   // somebody sent flying: a comic bonk or a body thud (both levelled to the same peak)
  thump:  ['world', 0.15, (o, t, k) => { for (const dt of [0, 0.1]) { tone(o, t + dt, 130, 0.2, 0.45 * k, 'sine', 50, 0.004); hiss(o, t + dt, 0.08, 0.25 * k, 'lowpass', 700); } }],   // landing: front wheels, then rear
  scatter: ['world', 0.5, (o, t, k) => { for (let i = 0; i < 4; i++) hiss(o, t + i * 0.09, 0.05, 0.3 * k, 'lowpass', 700); }],   // people jumping clear: slippers slapping
  // traffic and the city
  clop:   ['world', 0.07, (o, t, k) => { tone(o, t, 950 + Math.random() * 250, 0.045, 0.25 * k, 'triangle', 600, 0.002); tone(o, t, 180, 0.07, 0.2 * k, 'sine', 90, 0.002); }],   // one hoof on stone
  tram:   ['world', 4, (o, t, k) => sample(o, t, 'tram-bell', 1.2 * k, 1)],   // a recording of a tram's bell
  bell:   ['world', 8, (o, t, k) => sample(o, t, 'church-bell', 1.3 * k, 1)],   // a recording of a church bell in Palermo, nine seconds of it
  gull:   ['world', 3, (o, t, k) => { let a = t; const f0 = 1200 + Math.random() * 250; for (let i = 0; i < 5; i++) { const len = i < 2 ? 0.34 : 0.2; tone(o, a, f0, len, 0.12 * k, 'sawtooth', f0 * 0.73, 0.05); tone(o, a, f0 * 2, len * 0.8, 0.06 * k, 'sine', f0 * 1.46, 0.05); a += len + 0.05; } }],   // a run of sharp cries
};

// ---- recordings (assets/audio, credits in assets/CREDITS.md): fetched and decoded when first wanted; a one-shot asked for before its file is in plays as soon as it is, if that is within a second ----
const FILES = { 'jingle-start': 'jingle-start.m4a', 'jingle-win': 'jingle-win.m4a', 'jingle-fail': 'jingle-fail.m4a', 'crash-light': 'crash-light.m4a', 'crash-heavy1': 'crash-heavy1.m4a', 'crash-heavy2': 'crash-heavy2.m4a', glass1: 'glass1.m4a', glass2: 'glass2.m4a', 'wood-break': 'wood-break.m4a', bags1: 'bags1.m4a', bags2: 'bags2.m4a', bonk1: 'bonk1.m4a', bonk2: 'bonk2.m4a', 'bin-metal': 'bin-metal.m4a', 'sign-metal': 'sign-metal.m4a', 'pole-metal': 'pole-metal.m4a', 'rail-metal': 'rail-metal.m4a', 'tram-bell': 'tram-bell.m4a', 'church-bell': 'church-bell.m4a', rain: 'rain.m4a', sea: 'sea.m4a', cicadas: 'cicadas.m4a' };
const any = (...a) => a[(Math.random() * a.length) | 0];
const urlOf = file => new URL('../assets/audio/' + file, import.meta.url).href;
const bufs = {}, loads = {};
function load(key) {
  if (bufs[key]) return Promise.resolve(bufs[key]);
  if (loads[key]) return loads[key];
  const c = ctx;
  return loads[key] = fetch(urlOf(FILES[key])).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => c.decodeAudioData(b, ok, no)))
    .then(d => { if (c === ctx) bufs[key] = d; return d; }).catch(e => { console.warn('sfx: ' + FILES[key] + ' did not load', e); return null; });   // (a failed file is not asked for again)
}
function sample(out, t, key, g, rate) {
  const go = (b, at) => { const s = ctx.createBufferSource(), e = ctx.createGain(); s.buffer = b; s.playbackRate.value = rate; e.gain.value = g; s.connect(e); e.connect(out); s.start(at); };
  if (bufs[key]) go(bufs[key], t);
  else { const c = ctx, asked = performance.now(); load(key).then(b => { if (b && c === ctx && performance.now() - asked < 1000) go(b, 0); }); }
}

function busOf(name, pan) {
  const b = name === 'ui' ? ui : world;
  if (!pan || !ctx.createStereoPanner) return b;
  const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(b); return p;
}

export function sfx(name, k = 1, pan = 0) {
  globalThis.__sfxTap?.(name, k);   // tools/film listens: its clips are filmed without sound, and the edit puts a sound where the game made one
  const c = CUES[name]; if (!c || !(k > 0.02) || !ready()) return;
  const t = ctx.currentTime; if (t - (lastAt[name] ?? -9) < c[1]) return;
  lastAt[name] = t;
  try { c[2](busOf(c[0], pan), t + 0.005, clamp(k, 0, 1.5)); } catch (e) { /* a sound is never worth an error */ }
}

// ---- beds: name -> (out) => tone setter or null. Each ends in a gain the caller's level drives ----
const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random() * 1.5); return s; };
const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
const gainOf = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
const lfo = (f, depth, param, type = 'sine') => { const o = ctx.createOscillator(), g = gainOf(depth); o.type = type; o.frequency.value = f; o.connect(g); g.connect(param); o.start(); return o; };
const chain = (...n) => { for (let i = 1; i < n.length; i++) n[i - 1].connect(n[i]); return n[n.length - 1]; };
const looped = key => out => { const s = ctx.createBufferSource(), b = bufs[key]; s.buffer = b; s.loop = true; s.loopStart = 0.06; s.loopEnd = b.duration - 0.06; s.connect(out); s.start(0, Math.random() * (b.duration - 1)); return null; };   // (the ends of an AAC file are padding: the loop stays inside them)
const BEDS = {
  rain: looped('rain'),       // a recording of heavy rain
  sea: looped('sea'),         // a recording of waves on a beach
  cicada: looped('cicadas'),  // a recording of cicadas
  wind(out) {   // the scirocco: a low, heavy push
    const g = gainOf(1.4); chain(loopNoise(), filt('lowpass', 190), g, out); lfo(0.19, 0.5, g.gain);
    return null;
  },
  cricket(out) {   // the night out of town: two crickets answering
    for (const [f, p, c, g] of [[4350, 27, 1.9, 0.2], [3980, 31, 1.3, 0.12]]) { const a = gainOf(0.5), b = gainOf(0.5), o = ctx.createOscillator(); o.frequency.value = f; o.start(); chain(o, a, b, gainOf(g), out); lfo(p, 0.5, a.gain, 'square'); lfo(c, 0.5, b.gain, 'square'); }
    return null;
  },
  air(out) {   // flying: wind and a propeller drone (tone 0..1 with the speed)
    const wg = gainOf(0.25), dg = gainOf(0.16), o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 92; o.start();
    chain(loopNoise(), filt('highpass', 1800), wg, out); chain(o, filt('lowpass', 500), dg, out); lfo(23, 0.08, dg.gain);
    return k => { const t = ctx.currentTime; o.frequency.setTargetAtTime(80 + 40 * k, t, 0.3); wg.gain.setTargetAtTime(0.12 + 0.3 * k, t, 0.3); };
  },
  rails(out) {   // a tram going by: a rumble with a faint ring (tone 0..1 with its speed)
    const lp = filt('lowpass', 200), g = gainOf(0.9), g2 = gainOf(0.12);
    chain(loopNoise(), lp, g, out); chain(loopNoise(), filt('bandpass', 1900, 9), g2, out); lfo(6.5, 0.25, g.gain);
    return k => { const t = ctx.currentTime; lp.frequency.setTargetAtTime(140 + 120 * k, t, 0.2); g2.gain.setTargetAtTime(0.05 + 0.12 * k, t, 0.2); };
  },
};
const BED_FILE = { rain: 'rain', sea: 'sea', cicada: 'cicadas' };

export function bed(name, level, pan = 0, k = -1) {
  let b = beds[name]; level = clamp(+level || 0, 0, 1);
  if (!b && level < 0.01) return;
  if (!ready()) { if (b && ctx && b.lv > 0) { b.lv = 0; b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } return; }
  const t = ctx.currentTime;
  if (!b) {
    if (!BEDS[name]) return;
    if (BED_FILE[name] && !bufs[BED_FILE[name]]) { load(BED_FILE[name]); return; }
    try {
      const g = gainOf(0), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      b = { g, p, set: BEDS[name](g), lv: 0, pan: 0, k: -1, on: false, zeroAt: t };
      if (p) g.connect(p);
      beds[name] = b;
    } catch (e) { return; }
  }
  if (level > 0.001 && !b.on) { (b.p || b.g).connect(world); b.on = true; }
  if (Math.abs(level - b.lv) > 0.008 || (level === 0) !== (b.lv === 0)) { b.lv = level; b.g.gain.setTargetAtTime(level, t, 0.25); if (level === 0) b.zeroAt = t; }
  if (b.p && Math.abs(pan - b.pan) > 0.03) { b.pan = pan; b.p.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.15); }
  if (b.set && k >= 0 && Math.abs(k - b.k) > 0.03) { b.k = k; b.set(clamp(k, 0, 1)); }
  if (b.on && b.lv === 0 && t - b.zeroAt > 2) { (b.p || b.g).disconnect(); b.on = false; }   // unplugged while silent: nothing downstream to compute
}

export const sfxDebug = () => ({ ctx: ctx && ctx.state, vol: vol0, duck: duck0, beds: Object.fromEntries(Object.entries(beds).map(([k, b]) => [k, +b.lv.toFixed(2)])), last: { ...lastAt }, files: Object.keys(bufs) });
