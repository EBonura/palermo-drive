// The sound of the Barbera: a stadium crowd made entirely with Web Audio (nothing recorded, nothing copyrighted), in the style of src/rave.js. Filtered noise beds for the murmur and
// the roar, a sung vowel for the "oooh" and the boos, a big drum and many hands clapping the chant, air horns, the referee's whistle and the crowd's catcalls. Built on the car radio's
// AudioContext (src/radio.js), which only exists after the game's first tap, so it starts with the game's own first gesture, and torn down when the lapa is far away.
// No node is made per frame: the voices are made once when the lapa comes within hearing, and everything after that is automation (setTargetAtTime / ramps) on them. The drums and
// the clapping are scheduled a little ahead of the audio clock, like the rave's loop.
// The same crowd also reaches the car radio card's own channel ("La partita": the crowd through a small speaker plus a whistle and a jingle), which follows the music volume.
// createStadiumAudio({ getRadio }) -> { update(dt, att, hype, tension, inside), event(name, arg), analyser, active, debug() }
//   att: 0..1 how loud the stadium is where the lapa is (1 on the pitch, falling away outside); hype: 0..1 how worked up the stands are; tension: 0..1 how close the ball is to a goal.
//   event(): 'enter' (the referee blows, the stands boo), 'goal', 'groan' (arg true: a wide shot, with whistling), 'cheer' (arg 0..1), 'whistle' (arg: blasts), 'jeer'.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const BPM = 112;
const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];     // the big drum on every beat
const CLAP = [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0];     // "ale ale ale ale ... ro-sa-ne-ro": eight hands' worth of claps in two groups

export function createStadiumAudio({ getRadio }) {
  const debugOn = location.search.includes('debug');
  let ctx = null, g = null, noiseBuf = null, timer = 0, nextT = 0, step = 0, quietT = 0, applyT = 0, clapI = 0, srcs = [];
  const L = { att: 0, hype: 0, tension: 0, inside: false };

  function build() {
    const r = getRadio(), c = r && r.context; if (!c) return false;   // no radio context yet: nobody has tapped the game
    ctx = c; srcs = [];
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {   // two seconds of white noise, shared by every noise voice
      noiseBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const gain = v => { const x = ctx.createGain(); x.gain.value = v; return x; };
    const filt = (type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); srcs.push(o); return o; };
    const noise = off => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, off); srcs.push(s); return s; };
    const lfo = (f, amt, param) => { const o = osc('sine', f), a = gain(amt); o.connect(a); a.connect(param); };
    const mute = gain(0); mute.connect(ctx.destination);   // some browsers only run an analyser that reaches the output: this branch is silent

    // the two channels: the stadium in the world (volume and distance) and the car radio (the crowd through a small speaker, music volume)
    const bus = gain(1), wLP = filt('lowpass', 8000, 0.4), wG = gain(0), comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    bus.connect(wLP); wLP.connect(wG); wG.connect(comp); comp.connect(ctx.destination);
    const rHP = filt('highpass', 380, 0.7), rLP = filt('lowpass', 3200, 0.7), rS = ctx.createWaveShaper(), rG = gain(0), an = ctx.createAnalyser();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 127.5 - 1) * 2.4);
    rS.curve = curve; bus.connect(rHP); rHP.connect(rLP); rLP.connect(rS); rS.connect(rG); rG.connect(ctx.destination);
    an.fftSize = 256; an.smoothingTimeConstant = 0.6; rS.connect(an); an.connect(mute);   // the card's bars: a dead-end tap before the radio volume
    let wM = null, rM = null;
    if (debugOn) { wM = ctx.createAnalyser(); wM.fftSize = 1024; comp.connect(wM); wM.connect(mute); rM = ctx.createAnalyser(); rM.fftSize = 1024; rG.connect(rM); rM.connect(mute); }

    // the beds: a murmur that swells slowly, and a roar
    const nA = noise(0), nB = noise(0.9);
    const bed = (src, f, q, top, mod, rate, amt) => { const bp = filt('bandpass', f, q), lp = filt('lowpass', top, 0.5), m = gain(mod), o = gain(0); src.connect(bp); bp.connect(lp); lp.connect(m); m.connect(o); o.connect(bus); lfo(rate, amt, m.gain); return { bp, o }; };
    const mur = bed(nA, 420, 0.7, 1500, 0.8, 0.13, 0.22), roar = bed(nA, 800, 0.45, 3200, 0.85, 0.55, 0.14);
    const bu = { bp: filt('bandpass', 700, 0.5), lp: filt('lowpass', 3600, 0.5), o: gain(0) };   // bursts: a cheer, a gasp
    nA.connect(bu.bp); bu.bp.connect(bu.lp); bu.lp.connect(bu.o); bu.o.connect(bus);
    const fz = { hp: filt('highpass', 3200, 0.5), o: gain(0) }; nB.connect(fz.hp); fz.hp.connect(fz.o); fz.o.connect(bus);   // the hiss of a big cheer

    // a sung vowel: three detuned saws through two formants, with vibrato (the "ooh", the boos, the rising tension). Two voices: one for the tension, one for the events.
    const hum = () => {
      const f1 = filt('bandpass', 520, 3.5), f2 = filt('bandpass', 1050, 4), o = gain(0), vib = osc('sine', 5.3), va = gain(4), ks = [0.988, 1, 1.013];
      const os = ks.map(k => { const s = osc('sawtooth', 170 * k); s.connect(f1); s.connect(f2); va.connect(s.frequency); return s; });
      vib.connect(va); f1.connect(o); f2.connect(o); o.connect(bus);
      return { os, ks, f1, f2, o };
    };
    const tens = hum(), vox = hum();

    // many hands: three clap voices in turn, a different band each time; the big drum
    const claps = [0, 1, 2].map(i => { const bp = filt('bandpass', 1500 + i * 350, 1.1), o = gain(0); nB.connect(bp); bp.connect(o); o.connect(bus); return { bp, o }; });
    const bo = osc('sine', 80), bg = gain(0); bo.connect(bg); bg.connect(bus);
    // air horns: B flat and F, a fifth apart; the referee's pea whistle (two tones with a fast tremolo); the crowd's catcalls, sliding whistles
    const hLP = filt('lowpass', 2400, 0.7), hg = gain(0); for (const f of [233.08, 349.23]) osc('sawtooth', f).connect(hLP); hLP.connect(hg); hg.connect(bus);
    const wMod = gain(0.55), wBP = filt('bandpass', 3000, 4), wV = gain(0); for (const f of [2860, 3140]) osc('sine', f).connect(wMod); wMod.connect(wBP); wBP.connect(wV); wV.connect(bus); lfo(34, 0.45, wMod.gain);
    const cats = [2300, 2800].map(f => { const o = osc('sine', f), v = gain(0), l = osc('sine', 6.5), la = gain(60); l.connect(la); la.connect(o.frequency); o.connect(v); v.connect(bus); return { o, v, f }; });
    const jo = osc('triangle', 660), jg = gain(0); jo.connect(jg); jg.connect(rHP);   // the radio's jingle: only on the radio channel

    g = { bus, wLP, wG, comp, rG, an, wM, rM, mur, roar, bu, fz, tens, vox, claps, bo, bg, hg, wV, cats, jo, jg, mute };
    nextT = ctx.currentTime + 0.1; step = 0; applyT = 0; apply(); timer = setInterval(schedule, 40);
    return true;
  }
  function teardown() {
    if (timer) { clearInterval(timer); timer = 0; }
    if (!g) return;
    for (const s of srcs) { try { s.stop(); s.disconnect(); } catch (e) { /* already stopped */ } }
    try { g.bus.disconnect(); g.wG.disconnect(); g.comp.disconnect(); g.rG.disconnect(); g.mute.disconnect(); } catch (e) { /* ignore */ }
    srcs = []; g = null; ctx = null; quietT = 0;
  }

  // ---- automation helpers: the event voices rest at 0; a new event continues from wherever the last one was
  function shape(p, t, pts) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); let at = t; for (const [d, v] of pts) { at += d; p.linearRampToValueAtTime(v, at); } }
  function glide(h, t, f1, f2, pts) {   // pts: [[seconds, Hz of the voice]...]; f1, f2: the formants [from, to] over the first segment
    for (let i = 0; i < h.os.length; i++) { const p = h.os[i].frequency, k = h.ks[i]; p.cancelScheduledValues(t); p.setValueAtTime(pts[0][1] * k, t); let at = t; for (let j = 1; j < pts.length; j++) { at += pts[j][0]; p.exponentialRampToValueAtTime(pts[j][1] * k, at); } }
    let len = 0; for (let j = 1; j < pts.length; j++) len += pts[j][0];
    for (const [fl, f] of [[h.f1, f1], [h.f2, f2]]) { fl.frequency.cancelScheduledValues(t); fl.frequency.setValueAtTime(f[0], t); fl.frequency.linearRampToValueAtTime(f[1], t + len); }
  }
  function bombo(t, a) {
    g.bo.frequency.setValueAtTime(110, t); g.bo.frequency.exponentialRampToValueAtTime(46, t + 0.16);
    g.bg.gain.setValueAtTime(0.0001, t); g.bg.gain.linearRampToValueAtTime(a, t + 0.006); g.bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  }
  function clap(t, a) {
    const v = g.claps[clapI++ % 3];
    v.bp.frequency.setValueAtTime(1100 + Math.random() * 1700, t);
    v.o.gain.setValueAtTime(0.0001, t); v.o.gain.linearRampToValueAtTime(a, t + 0.004); v.o.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  }
  function schedule() {
    if (!g) return;
    if ((applyT -= 0.04) <= 0) { applyT = 0.08; apply(); }
    if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05;   // the context was suspended for a while
    const sixteenth = 60 / BPM / 4, c = clamp(0.12 + 0.95 * L.hype, 0, 1), tn = L.tension;
    while (nextT < ctx.currentTime + 0.25) {
      const s = step & 15, t = nextT;
      if (c > 0.05) {
        if (KICK[s]) bombo(t, 1.1 * c);
        if (CLAP[s]) { clap(t, 1.3 * c); clap(t + 0.011 + Math.random() * 0.01, 0.9 * c); }
      }
      if (tn > 0.3 && (s & 1) === 0) bombo(t, 0.9 * tn);   // the drum quickens as the ball nears a goal
      if (tn > 0.7 && (s & 1)) clap(t, 0.8 * tn);
      step++; nextT += sixteenth;
    }
  }
  function blasts(t, n) {   // the referee: n pea-whistle blasts
    const pts = []; for (let i = 0; i < n; i++) pts.push([0.02, 0.5], [0.34, 0.5], [0.03, 0], [0.16, 0]);
    shape(g.wV.gain, t, pts);
  }
  function catcall(t) {   // the crowd whistling its disapproval: two sliding whistles
    g.cats.forEach((c, i) => {
      const at = t + i * 0.17; c.o.frequency.cancelScheduledValues(at); c.o.frequency.setValueAtTime(c.f * 1.4, at); c.o.frequency.exponentialRampToValueAtTime(c.f * 0.78, at + 1.1);
      shape(c.v.gain, at, [[0.08, 0.1], [0.8, 0.1], [0.25, 0]]);
    });
  }
  function jingle(t, notes) {   // the radio's "tu-tu-tuuu": [Hz, seconds] every 0.13 s
    const p = g.jg.gain; p.cancelScheduledValues(t); p.setValueAtTime(0, t); g.jo.frequency.cancelScheduledValues(t);
    notes.forEach(([f, d], i) => { const at = t + i * 0.13; g.jo.frequency.setValueAtTime(f, at); p.linearRampToValueAtTime(0.3, at + 0.01); p.setValueAtTime(0.3, at + d); p.linearRampToValueAtTime(0, at + d + 0.03); });
  }

  function event(name, arg) {
    if (!g || !ctx) return;
    const t = ctx.currentTime;
    if (name === 'goal') {
      shape(g.bu.o.gain, t, [[0.3, 2.4], [2.4, 2.4], [4, 0]]); shape(g.fz.o.gain, t, [[0.3, 1], [2.2, 1], [3.5, 0]]);
      g.bu.bp.frequency.cancelScheduledValues(t); g.bu.bp.frequency.setValueAtTime(600, t); g.bu.bp.frequency.linearRampToValueAtTime(1150, t + 1.5); g.bu.bp.frequency.linearRampToValueAtTime(750, t + 6.5);
      shape(g.hg.gain, t + 0.15, [[0.05, 0.3], [0.9, 0.3], [0.06, 0], [0.2, 0], [0.05, 0.26], [0.5, 0.26], [0.08, 0]]);
      glide(g.vox, t, [650, 900], [1100, 1500], [[0, 220], [0.5, 330], [2, 300]]); shape(g.vox.o.gain, t, [[0.3, 0.55], [2.2, 0.5], [1.2, 0]]);
      blasts(t + 3.3, 1);   // the restart
      jingle(t + 0.2, [[659, 0.08], [880, 0.08], [1319, 0.4]]);
    } else if (name === 'groan') {   // a gasp, then the air going out of the stands
      glide(g.vox, t, [700, 380], [1200, 800], [[0, 190], [0.25, 290], [1.1, 115]]); shape(g.vox.o.gain, t, [[0.25, 0.6], [0.5, 0.5], [0.85, 0]]);
      shape(g.bu.o.gain, t, [[0.15, 0.9], [0.6, 0.5], [0.9, 0]]);
      if (arg) catcall(t + 0.4);
    } else if (name === 'jeer') {   // booing
      glide(g.vox, t, [380, 330], [700, 600], [[0, 120], [1.6, 100]]); shape(g.vox.o.gain, t, [[0.3, 0.55], [1.1, 0.55], [0.6, 0]]);
      shape(g.bu.o.gain, t, [[0.3, 1], [1, 0.7], [1.2, 0]]); catcall(t + 0.2);
    } else if (name === 'enter') {
      blasts(t + 0.35, 2);
      glide(g.vox, t, [380, 330], [700, 600], [[0, 118], [1.8, 98]]); shape(g.vox.o.gain, t, [[0.3, 0.6], [1.3, 0.6], [0.8, 0]]);
      shape(g.bu.o.gain, t, [[0.3, 1.3], [1.2, 0.9], [1.5, 0]]); catcall(t + 0.5);
      jingle(t + 0.1, [[880, 0.09], [660, 0.09], [880, 0.3]]);
    } else if (name === 'cheer') {
      const k = clamp(arg == null ? 0.6 : arg, 0, 1);
      shape(g.bu.o.gain, t, [[0.12, 1 * k], [0.5, 0.6 * k], [0.7, 0]]); clap(t, 0.9 * k); clap(t + 0.05, 0.9 * k);
    } else if (name === 'whistle') blasts(t, arg || 1);
  }

  // ---- the audio parameters, about 12 times a second from the scheduler's timer (so they follow the pause menu too, which stops the game's own update)
  function apply() {
    const t = ctx.currentTime, r = getRadio(), vol = r ? r.sfxVolume : 0.8, mus = r ? r.volume : 0.5, radioOn = r ? r.enabled : true, dk = r && Number.isFinite(r.duck) ? r.duck : 1;
    const att = L.att, hype = L.hype, tn = L.tension, e = 0.3 + 0.7 * hype, tc = 0.15, quiet = document.hidden ? 0 : 1;
    g.wG.gain.setTargetAtTime(quiet * dk * vol * att, t, tc);
    g.wLP.frequency.setTargetAtTime(700 + 8500 * Math.pow(att, 1.3), t, tc);
    g.mur.o.gain.setTargetAtTime(0.4 + 0.7 * e + 0.5 * tn, t, tc);
    g.roar.o.gain.setTargetAtTime(0.1 + 0.8 * hype + 1.2 * tn * tn, t, tc);
    g.roar.bp.frequency.setTargetAtTime(800 + 500 * tn, t, 0.3);
    g.tens.o.gain.setTargetAtTime(0.4 * Math.pow(tn, 1.5), t, 0.25);
    for (let i = 0; i < 3; i++) g.tens.os[i].frequency.setTargetAtTime((150 + 140 * tn) * g.tens.ks[i], t, 0.3);
    g.tens.f1.frequency.setTargetAtTime(520 + 300 * tn, t, 0.3); g.tens.f2.frequency.setTargetAtTime(1050 + 500 * tn, t, 0.3);
    g.rG.gain.setTargetAtTime(L.inside && radioOn ? quiet * dk * mus * 0.9 : 0, t, tc);
  }

  // ---- called every frame while the lapa is anywhere near: what the stadium says now, and building / throwing away the voices
  function update(dt, att, hype, tension, inside) {
    L.att = att; L.hype = hype; L.tension = tension; L.inside = inside;
    if (!ctx) { if (att > 0.02) build(); }
    else if (att < 0.004 && !inside) { if ((quietT += dt) > 5) teardown(); } else quietT = 0;
  }

  return {
    update, event,
    get analyser() { return g ? g.an : null; },
    get active() { return !!ctx; },
    debug() {
      if (!g) return { built: false, ctx: ctx && ctx.state };
      const rms = a => { if (!a) return null; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return +Math.sqrt(s / b.length).toFixed(4); };
      return { built: true, ctx: ctx.state, time: +ctx.currentTime.toFixed(2), world: +g.wG.gain.value.toFixed(3), radio: +g.rG.gain.value.toFixed(3), cutoff: Math.round(g.wLP.frequency.value), sources: srcs.length,
        rmsWorld: rms(g.wM), rmsRadio: rms(g.rM), att: +L.att.toFixed(2), hype: +L.hype.toFixed(2), tension: +L.tension.toFixed(2) };
    },
  };
}
