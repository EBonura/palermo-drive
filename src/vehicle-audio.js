// Vehicle sound: synthesised engines (one voice per vehicle, louder with the exhaust parts), tyre skid, impacts, nitro whoosh,
// the tamarro horns (original melodies) and the subwoofer beat. Owned by the driving work.
// Web Audio starts on the first user gesture (start()). Everything is guarded so a missing or suspended context never throws.
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// Loudness mix (owner: the engine covered everything). Engine sits ~9 dB under skids, impacts, horns and music.
const ENGINE_MIX = 0.158;

// Engine voices. A saw plus a detuned square through a resonant low-pass and a mid peak, chopped by a saw LFO at the firing rate,
// plus a high-passed exhaust rasp. f = f0 + fr * rpm (Hz of the fundamental); lfo = lfo0 + lfor * rpm (firings per second).
const ENG = {
  calessino:  { f0: 62, fr: 175, o2: 2.01, o2g: 0.35, lfo0: 7, lfor: 52, depth: 0.34, am: 0.62, lp0: 700, lpr: 3500, pkf: 900, pkg: 7, rasp: 0.07, out: 0.36 },
  cassone:    { f0: 50, fr: 140, o2: 2.01, o2g: 0.42, lfo0: 6, lfor: 40, depth: 0.4, am: 0.62, lp0: 600, lpr: 2800, pkf: 700, pkg: 8, rasp: 0.06, out: 0.4 },
  lapa50:     { f0: 80, fr: 210, o2: 2.01, o2g: 0.3, lfo0: 8, lfor: 62, depth: 0.34, am: 0.62, lp0: 800, lpr: 3800, pkf: 1100, pkg: 7, rasp: 0.07, out: 0.32 },
  vespa:      { f0: 92, fr: 250, o2: 2.0, o2g: 0.28, lfo0: 9, lfor: 72, depth: 0.3, am: 0.66, lp0: 900, lpr: 4500, pkf: 1500, pkg: 8, rasp: 0.1, out: 0.3 },
  scooterone: { f0: 68, fr: 120, o2: 1.5, o2g: 0.22, lfo0: 5, lfor: 26, depth: 0.16, am: 0.8, lp0: 600, lpr: 2400, pkf: 650, pkg: 6, rasp: 0.03, out: 0.3 },
  motorino:   { f0: 76, fr: 300, o2: 2.0, o2g: 0.3, lfo0: 8, lfor: 66, depth: 0.28, am: 0.7, lp0: 900, lpr: 5200, pkf: 1300, pkg: 6, rasp: 0.08, out: 0.34 },
  sulky:      { f0: 60, fr: 100, o2: 2, o2g: 0.2, lfo0: 4, lfor: 10, depth: 0.2, am: 0.7, lp0: 400, lpr: 800, pkf: 500, pkg: 2, rasp: 0, out: 0 },   // silent: the hooves are drawn in update()
  tascia:     { f0: 58, fr: 215, o2: 2.0, o2g: 0.5, lfo0: 14, lfor: 84, depth: 0.2, am: 0.74, lp0: 700, lpr: 3400, pkf: 750, pkg: 9, rasp: 0.06, out: 0.4 },
};
// exhaust parts: louder, throatier, rougher
const EXH = { '': [1, 1, 1, 0], marmitta: [1.3, 1.5, 0.92, 4], doppio: [1.6, 2.6, 0.84, 12], tromba: [1.9, 3.2, 0.78, 18], oro: [1.7, 2.8, 0.82, 14] };   // [volume, rasp, pitch, distortion]

// Original horn melodies (Hz, 0 = rest), one step = `dt` seconds, looping while the key is held.
const HORNS = {
  tarantella: { kind: 'notes', dt: 0.115, wave: 'square', notes: [440, 523, 659, 523, 440, 392, 440, 0, 587, 659, 784, 659, 587, 523, 587, 0, 440, 523, 659, 880, 784, 659, 523, 440, 392, 440, 494, 440, 0, 0] },
  fanfara: { kind: 'notes', dt: 0.14, wave: 'sawtooth', notes: [392, 0, 392, 523, 0, 523, 659, 0, 784, 784, 0, 659, 784, 1047, 1047, 1047, 0, 0] },
  camion: { kind: 'chord', wave: 'sawtooth', freqs: [98, 123.5, 147] },
  mandolino: { kind: 'notes', dt: 0.07, wave: 'triangle', notes: [659, 659, 659, 659, 784, 784, 784, 784, 880, 880, 880, 880, 784, 784, 659, 659, 587, 587, 587, 587, 659, 659, 0, 0] },
  bip: { kind: 'notes', dt: 0.12, wave: 'square', notes: [740, 740, 0, 740, 740, 0, 0, 0, 0] },
};

export function createVehicleAudio(env) {
  const a = { ctx: null, vol: 0.8, ready: false, started: false, master: null, skid: null, nos: null, engine: null, impact: null };
  let engKey = '', hornKey = '', bassOn = false, wantEng = null;
  const state = { engType: 'calessino', exhaust: '' };

  function distCurve(k) { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = k ? Math.tanh(x * (1 + k * 0.35)) / Math.tanh(1 + k * 0.35) : x; } return c; }

  function buildEngine() {
    const ctx = a.ctx, key = state.engType + '|' + state.exhaust;
    if (!ctx || engKey === key) return;
    engKey = key;
    if (a.engine) { const old = a.engine; old.out.gain.cancelScheduledValues(ctx.currentTime); old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(() => { for (const o of old.srcs) { try { o.stop(); } catch (e) { /* stopped */ } } old.out.disconnect(); }, 200); }
    const P = ENG[state.engType] || ENG.calessino, X = EXH[state.exhaust] || EXH[''];
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square'; lfo.type = 'sawtooth';
    const g2 = ctx.createGain(); g2.gain.value = P.o2g;
    const mix = ctx.createGain(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), am = ctx.createGain(), ws = ctx.createWaveShaper(), out = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2.5; pk.type = 'peaking'; pk.frequency.value = P.pkf * X[2]; pk.gain.value = P.pkg + X[3] * 0.4; pk.Q.value = 1.2;
    am.gain.value = P.am; out.gain.value = 0; ws.curve = distCurve(X[3]); ws.oversample = 'none';
    const lg = ctx.createGain(); lg.gain.value = -P.depth; lfo.connect(lg); lg.connect(am.gain);
    o1.connect(mix); o2.connect(g2); g2.connect(mix); mix.connect(lp); lp.connect(pk); pk.connect(am); am.connect(ws); ws.connect(out); out.connect(a.master);
    const rasp = ctx.createBufferSource(); rasp.buffer = a.noise; rasp.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; const ng = ctx.createGain(); ng.gain.value = 0;
    rasp.connect(hp); hp.connect(ng); ng.connect(out);
    for (const o of [o1, o2, lfo, rasp]) o.start();
    a.engine = { o1, o2, lfo, lp, out, ng, P, X, srcs: [o1, o2, lfo, rasp] };
  }

  function start() {
    if (a.started) return; a.started = true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = a.ctx = new AC();
    a.master = ctx.createGain(); a.master.gain.value = a.vol * 0.9;
    a.muffle = ctx.createBiquadFilter(); a.muffle.type = 'lowpass'; a.muffle.frequency.value = 22000; a.muffle.Q.value = 0.5;   // the ZEN fade muffles the vehicle sounds
    a.master.connect(a.muffle); a.muffle.connect(ctx.destination);
    const load = name => fetch(new URL(`../assets/audio/${name}.wav`, import.meta.url).href).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)));
    Promise.all([load('skid'), load('impact')]).then(([skid, imp]) => {
      const loop = (buf, type, f0) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = f0;
        const gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(filt); filt.connect(gain); gain.connect(a.master); src.start();
        return { src, filt, gain };
      };
      a.skid = loop(skid, 'lowpass', 5000);
      const nb = a.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      a.nos = loop(nb, 'bandpass', 1400); a.nos.filt.Q.value = 0.7;
      a.impact = imp; a.ready = true; buildEngine();
    }).catch(err => console.warn('vehicle audio failed to load', err));
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  }
  function gesture() { start(); if (a.ctx && a.ctx.state === 'suspended' && !document.hidden) a.ctx.resume(); }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, gesture, { passive: true });

  function setVoice(type, exhaust) { state.engType = type; state.exhaust = exhaust || ''; if (a.ready) buildEngine(); }
  // k: 0 clear .. 1 fully muffled (vehicle sounds only)
  function setMuffle(k) { if (a.muffle) a.muffle.frequency.setTargetAtTime(220 + 21780 * Math.pow(1 - clamp(k, 0, 1), 3), a.ctx.currentTime, 0.08); }
  function honk(gain = 0.4, pitch = 1) {   // a short two-tone scooter beep (the escorts of the night race)
    if (!a.ready || gain < 0.01) return;
    const ctx = a.ctx, t = ctx.currentTime, g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1150 * pitch; bp.Q.value = 1.3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * a.vol * gain, t + 0.012); g.gain.setValueAtTime(0.16 * a.vol * gain, t + 0.16); g.gain.linearRampToValueAtTime(0, t + 0.2);
    bp.connect(g); g.connect(a.master);
    for (const f of [415, 520]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * pitch; o.connect(bp); o.start(t); o.stop(t + 0.22); }
  }
  const hoof = { next: 0, n: 0 };
  function clop(t, speed) {   // one hoof beat: a wooden tock and a dull thud
    const ctx = a.ctx, g = ctx.createGain(), o = ctx.createOscillator(), n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    const v = clamp(0.3 + speed / 60, 0.3, 0.65) * (hoof.n++ % 2 ? 0.8 : 1) * 0.6;   // hooves sit with the engine, under the music and SFX
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.buffer = a.noise; bp.type = 'bandpass'; bp.frequency.value = 1300 + (hoof.n % 3) * 250; bp.Q.value = 1.4;
    ng.gain.setValueAtTime(v * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(a.master); n.connect(bp); bp.connect(ng); ng.connect(a.master);
    o.start(t); o.stop(t + 0.1); n.start(t, Math.random() * 0.5); n.stop(t + 0.06);
  }
  function setVolume(v) { a.vol = clamp(+v || 0, 0, 1); if (a.master) a.master.gain.value = a.vol * 0.9; }
  function impact(mag) {
    if (!a.ready) return;
    const src = a.ctx.createBufferSource(); src.buffer = a.impact;
    src.playbackRate.value = 0.8 + Math.random() * 0.3 - clamp(mag / 60, 0, 0.2);
    const gn = a.ctx.createGain(); gn.gain.value = clamp(0.25 + mag / 18, 0.25, 1.2);
    src.connect(gn); gn.connect(a.master); src.start();
  }

  // ---- per frame: engine, skid, nitro ----
  function update(s) {
    if (!a.ready) return;
    if (engKey !== state.engType + '|' + state.exhaust) buildEngine();
    const E = a.engine; if (!E) return;
    if (state.engType === 'sulky' && s.active && Math.abs(s.vf) > 0.8) { const t0 = a.ctx.currentTime; if (t0 >= hoof.next) { clop(t0, Math.abs(s.vf)); hoof.next = t0 + clamp(1.96 / Math.abs(s.vf), 0.09, 0.6); } }
    const t = a.ctx.currentTime, set = (p, v, tc = 0.06) => p.setTargetAtTime(v, t, tc);
    const { P, X } = E, rpm = s.rpm, thr = s.active ? Math.max(s.thr, s.nosAmt) : 0;
    const f1 = (P.f0 + P.fr * rpm + 18 * s.nosAmt) * X[2];
    set(E.o1.frequency, f1, 0.03); set(E.o2.frequency, f1 * P.o2, 0.03);
    set(E.lfo.frequency, P.lfo0 + P.lfor * rpm, 0.04);
    set(E.lp.frequency, (P.lp0 + P.lpr * (0.3 + 0.7 * thr) * (0.4 + 0.6 * rpm)) * (X[3] ? 1.25 : 1), 0.06);
    set(E.out.gain, s.active ? (P.out * 0.45 + 0.55 * P.out * thr + 0.22 * P.out * rpm) * X[0] * ENGINE_MIX : 0, 0.08);
    set(E.ng.gain, s.active ? (0.02 + 0.07 * thr * rpm) * X[1] * 0.45 : 0, 0.08);
    // skid and scrape
    const speed = Math.abs(s.vf);
    const slide = clamp((Math.abs(s.slip) - 0.1) * 3, 0, 1) * clamp(speed / 8, 0, 1) * (s.drift > 0.2 ? 1 : 0.35);
    const hbLock = s.hb && speed > 5 ? 0.7 : 0, scrape = clamp(s.scrape / 25, 0, 0.5);
    const sk = s.active ? Math.max(slide, hbLock, scrape) : 0;
    set(a.skid.gain.gain, sk * 0.55, 0.05);
    set(a.skid.src.playbackRate, scrape > slide ? 0.6 + 0.2 * scrape : 0.95 + 0.25 * clamp(speed / 40, 0, 1), 0.1);
    set(a.skid.filt.frequency, scrape > slide ? 1800 : 6000, 0.1);
    set(a.nos.gain.gain, s.active ? s.nosAmt * 0.3 : 0, 0.06);
    set(a.nos.filt.frequency, 900 + 1500 * s.nosAmt + speed * 20, 0.1);
  }

  // ---- horn: the default two-tone beep stays in src/horn.js; any bought horn is played here ----
  const horn = { on: false, idx: 0, next: 0, nodes: null, pulse: 0 };
  function hornStop() {
    if (!horn.on) return; horn.on = false;
    const n = horn.nodes; if (n) { const t = a.ctx.currentTime; n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0, t, 0.02); setTimeout(() => { for (const o of n.oscs) { try { o.stop(); } catch (e) { /* stopped */ } } n.g.disconnect(); }, 150); horn.nodes = null; }
  }
  function hornNote(H, f) {
    const ctx = a.ctx, t = ctx.currentTime;
    if (!f) return;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    o.type = H.wave; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2.003; bp.type = 'bandpass'; bp.frequency.value = Math.max(900, f * 2.2); bp.Q.value = 0.9;
    const v = 0.2 * a.vol, d = H.dt;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d * 0.98);
    o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(a.master); o.start(t); o2.start(t); o.stop(t + d + 0.02); o2.stop(t + d + 0.02);
  }
  // key: horn id or '' (default); down: key held. Returns true when this module is handling the horn (so the default must stay silent).
  function hornUpdate(key, down, dt, x, z) {
    const H = HORNS[key];
    if (!H || !a.ready) { if (horn.on) hornStop(); return !!H; }
    if (down && !horn.on) {
      horn.on = true; horn.idx = 0; horn.next = 0; horn.pulse = 0;
      if (H.kind === 'chord') {
        const ctx = a.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), oscs = H.freqs.map(f => { const o = ctx.createOscillator(); o.type = H.wave; o.frequency.value = f; o.connect(lp); o.start(); return o; });
        lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(g); g.connect(a.master);
        g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(0.3 * a.vol, ctx.currentTime + 0.05);
        horn.nodes = { g, oscs };
      }
    }
    if (!down && horn.on) hornStop();
    if (horn.on && H.kind === 'notes') {
      const t = a.ctx.currentTime;
      if (t >= horn.next) { hornNote(H, H.notes[horn.idx % H.notes.length]); horn.idx++; horn.next = Math.max(t, horn.next) + H.dt; }
    }
    if (horn.on && (horn.pulse -= dt) <= 0) { horn.pulse = 0.25; dispatchEvent(new CustomEvent('pd-horn', { detail: { x, z, r: 28 } })); }
    return true;
  }

  // ---- subwoofer: four on the floor with a rolling bass line; bass.pulse (0..1) drives the cone and a shake ----
  const bass = { next: 0, beat: 0, last: -9, notified: -9, pulse: 0 };
  const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4], BPM = 124;
  function bassKick(t) {
    const ctx = a.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(135, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.95, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(a.bassBus); o.start(t); o.stop(t + 0.32);
  }
  function bassNote(t, f, len) {
    const ctx = a.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(a.bassBus); o.start(t); o.stop(t + len + 0.02);
  }
  function bassUpdate(on, dt, x, z, boost) {
    bassOn = on;
    if (!a.ready) { bass.pulse = 0; return; }
    if (!a.bassBus) { const ctx = a.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0.4; lp.connect(g); g.connect(a.master); a.bassBus = lp; a.bassGain = g; }
    const ctx = a.ctx, t = ctx.currentTime;
    a.bassGain.gain.setTargetAtTime(on ? 0.4 * (boost || 1) : 0, t, 0.1);
    if (!on) { bass.next = 0; bass.pulse = 0; return; }
    const beat = 60 / BPM;
    if (!bass.next || bass.next < t - 0.5) { bass.next = t + 0.05; bass.beat = 0; }
    while (bass.next < t + 0.12) {
      const b = bass.next;
      bassKick(b); bassNote(b + beat * 0.5, BASS[bass.beat % BASS.length], beat * 0.45); if (bass.beat % 4 === 3) bassNote(b + beat * 0.75, 82.4, beat * 0.2);
      bass.last = b; bass.next += beat; bass.beat++;
    }
    // visual pulse follows the beat that is sounding now
    const e = t - bass.last, e2 = t - (bass.last - beat);
    const ph = e >= 0 ? e : e2;
    bass.pulse = ph >= 0 ? Math.exp(-ph * 9) : 0;
    if (bass.notified !== bass.last && t >= bass.last) { bass.notified = bass.last; dispatchEvent(new CustomEvent('pd-bass', { detail: { x, z, r: 40 } })); }
  }

  return { a, start, gesture, setVoice, setVolume, setMuffle, honk, impact, update, hornUpdate, bassUpdate, bass, get ready() { return a.ready; }, get vol() { return a.vol; }, HORNS, ENG, EXH };
}
