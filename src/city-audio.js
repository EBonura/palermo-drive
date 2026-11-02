// The sound of the city around the lapa, on the car radio's AudioContext (src/radio.js, which only exists after the game's first tap, so nothing starts before it):
//  - the traffic: a low rumble that follows how many vehicles are near (quiet out of town, quieter at night), cars passing by with distance and stereo pan (a pool of six
//    voices on the nearest moving vehicles), and horns all around from the real vehicles (four pooled voices: short beeps, double taps, long angry ones, recorded clips, the odd tune)
//  - gli arrotini (the knife-grinders, src/arrotini.js: several, each on a loop of his own, by day): the loudspeaker announcement through a light megaphone filter, looped with gaps, heard from a
//    few streets away with distance and pan. Two loudspeakers at most play at once, the two nearest (each keeps its voice while it stays one of them); the radio is turned down a little for the
//    nearest only; sound lines float off the nearest (src/pub-notes.js); a pin on the minimap for each one within earshot. They are heard at their place on the loop even before they have a vehicle.
//  - the voices of the market quarter (Ballaro, Vucciria, Capo) as a background bed by day
// Everything follows the Options volume (radio.sfxVolume) and the radio's duck, and sits under the engine (src/vehicle-audio.js), the radio and the shouts. No node is made per frame: the
// voices are made once, the parameters are set about ten times a second (setTargetAtTime, never an exponential ramp to 0), and a played clip makes one source node. The recordings are
// decoded when first wanted: the horn clips with the voices, the arrotino when he first appears, the market when the lapa gets near one. Credits: assets/CREDITS.md.
// createCityAudio({ scene, camera, car, game, traffic, getRadio, mapMarkers, groundY }) -> { update(dt, paused), debug() }
import { createNotes } from './pub-notes.js';
import { MARKETS } from './markets-data.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const url = name => new URL('../assets/audio/' + name + '.m4a', import.meta.url).href;
const HORN_CLIPS = { beep1: [0, 0.28], beep2: [0.53, 0.6], beep3: [1.38, 0.65], long: [2.28, 2.3], angry1: [4.83, 1.85], angry2: [6.93, 3.15], musical: [10.33, 2.9] };   // [start, seconds] in horns.m4a
const CLIPS = ['beep2', 'beep3', 'long', 'angry1', 'angry2'];
const PASSES = 6, HORNS = 4, TICK = 0.1;
const MIX = { rumble: 0.14, hiss: 0.04, pass: 0.12, horn: 0.1, arrotino: 0.2, market: 0.32 };   // loudness of each layer at its loudest, before the Options volume
const ARR_RANGE = 300, ARR_NEAR = 25, ARR_DUCK = 0.35, ARR_EAR = 285;   // metres; ARR_EAR: beyond it the loudspeaker is too faint to count (no pin)
const SPEAKERS = 2;

export function createCityAudio({ scene, camera, car, game, traffic, getRadio, mapMarkers, groundY }) {
  const debugOn = location.search.includes('debug');
  let ctx = null, g = null, tick = 0, hornT = 3, fail = false;
  const buf = { horns: null, arrotino: null, mercato: null }, loading = {};
  const L = { traffic: 0, night: 0, arr: 0, arrVis: 0, market: 0 };
  let yaw = [1, 0, 0, 0];   // the camera's right vector on the ground (x, z), and its position
  const notes = createNotes(scene, { glyphs: [3, 3, 3, 0] });   // sound lines (and the odd note) off the knife-grinder's loudspeaker
  const pins = traffic.arrotini.map(() => ({ x: 0, z: 0, color: '#5ad1ff', size: 4 })), pinned = traffic.arrotini.map(() => false);
  const speakers = [];   // the two loudspeakers: { m (its voice chain), src (the playing announcement), state, nextAt, e (the knife-grinder it belongs to), d (his distance) }
  let nearE = null;      // the nearest knife-grinder within earshot (the radio, the sound lines)

  function pan(x, z) {   // -1 (left of the view) .. 1 (right), by the camera's own right-hand vector
    const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.sqrt(dx * dx + dz * dz) || 1, e = camera.matrixWorld.elements;
    return clamp((dx * e[0] + dz * e[2]) / d, -1, 1);
  }
  function load(key, file) {   // fetch and decode a recording once; the voices that need it simply wait for it
    if (buf[key] || loading[key] || !ctx) return;
    const c = ctx; loading[key] = true;
    fetch(url(file)).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => c.decodeAudioData(b, ok, no)))
      .then(d => { if (c === ctx) buf[key] = d; }).catch(e => { loading[key] = false; if (!fail) { fail = true; console.warn('city audio: ' + file + ' did not load', e); } });
  }

  function build() {
    const r = getRadio(), c = r && r.context; if (!c || c.state !== 'running') return false;
    ctx = c;
    const gain = v => { const x = ctx.createGain(); x.gain.value = v; return x; };
    const filt = (type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const panner = () => ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const chain = (...all) => { const ns = all.filter(Boolean); for (let i = 0; i + 1 < ns.length; i++) ns[i].connect(ns[i + 1]); };   // a null (no stereo panner in this browser) is skipped
    const nb = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate), nd = nb.getChannelData(0);   // two seconds of white noise, shared by every noise voice
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random() * 1.8); return s; };
    const bus = gain(0), comp = ctx.createDynamicsCompressor();   // one gentle limiter for everything the city says at once
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    chain(bus, comp, ctx.destination);
    let an = null; if (debugOn) { an = ctx.createAnalyser(); an.fftSize = 1024; comp.connect(an); const m = gain(0); an.connect(m); m.connect(ctx.destination); }
    // the rumble: low engines and the tyre hiss of traffic, with a slow swell
    const rum = { lp: filt('lowpass', 170, 0.7), o: gain(0) }, his = { bp: filt('bandpass', 900, 0.6), o: gain(0) };
    const swell = gain(0.8); chain(noise(), rum.lp, swell, rum.o, bus); chain(noise(), his.bp, his.o, bus);
    const sw = ctx.createOscillator(), sa = gain(0.2); sw.frequency.value = 0.13; sw.connect(sa); sa.connect(swell.gain); sw.start();
    // cars passing: noise through a band that follows the speed, plus a low engine tone
    const passes = Array.from({ length: PASSES }, () => {
      const bp = filt('bandpass', 500, 0.8), ng = gain(1), os = ctx.createOscillator(), og = gain(0.0), lp = filt('lowpass', 420, 0.7), o = gain(0), p = panner();
      os.type = 'sawtooth'; os.frequency.value = 70; os.start();
      chain(noise(), bp, ng, o); chain(os, lp, og, o); chain(o, p, bus);
      return { bp, os, og, o, p, vid: -1, v: null };
    });
    // horns: two square oscillators for a synthesised horn, an input for a recorded one, a lowpass that closes with distance, a gain and a pan
    const horns = Array.from({ length: HORNS }, () => {
      const a = ctx.createOscillator(), b = ctx.createOscillator(), sg = gain(0), cg = gain(2.5), lp = filt('lowpass', 2400, 0.7), o = gain(0), p = panner();
      a.type = b.type = 'square'; a.start(); b.start();
      chain(a, sg, lp); chain(b, sg); chain(cg, lp); chain(lp, o, p, bus);
      return { a, b, sg, cg, lp, o, p, until: 0 };
    });
    // gli arrotini: a megaphone (band-limited, a presence peak, a touch of grit), then the distance (gain, closing lowpass) and the pan; one chain per loudspeaker, made once
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 127.5 - 1) * 1.8) / Math.tanh(1.8);
    const megaphone = () => {
      const mega = { i: gain(1), hp: filt('highpass', 430, 0.7), pk: filt('peaking', 1700, 1.0), lp: filt('lowpass', 3600, 0.7), sh: ctx.createWaveShaper(), o: gain(0), dl: filt('lowpass', 3000, 0.5), p: panner() };
      mega.pk.gain.value = 7; mega.sh.curve = curve;
      chain(mega.i, mega.hp, mega.pk, mega.lp, mega.sh, mega.dl, mega.o, mega.p, bus);
      return mega;
    };
    // the market quarter's voices
    const mk = { lp: filt('lowpass', 5200, 0.5), o: gain(0), src: null }; chain(mk.lp, mk.o, bus);
    g = { bus, comp, an, rum, his, passes, horns, mk, noise };
    for (let i = 0; i < SPEAKERS; i++) speakers.push({ m: megaphone(), src: null, state: 'gap', nextAt: 0, e: null, d: 0 });
    load('horns', 'horns');
    return true;
  }

  // ---- horns
  function horn(v, d) {   // a horn from vehicle v, d metres from the camera, on a free voice (none free: it is not made)
    const t = ctx.currentTime, h = g.horns.find(x => x.until < t); if (!h) return;
    const r = Math.random(), far = clamp(1 - d / 150, 0, 1);
    if (far <= 0.02) return;
    const sc = v.ty.scooter ? 1.55 : v.ty.bus ? 0.55 : 0.92 + Math.random() * 0.2;
    h.o.gain.cancelScheduledValues(t); h.o.gain.setValueAtTime(MIX.horn * far * far, t);
    h.lp.frequency.cancelScheduledValues(t); h.lp.frequency.setValueAtTime(900 + 4800 * far * far, t);
    if (h.p) { h.p.pan.cancelScheduledValues(t); h.p.pan.setValueAtTime(pan(v.x, v.z), t); }
    if (buf.horns && r > 0.5) {   // a recording of a real horn, a little off in pitch each time; the odd tune only when it is not far
      const name = r > 0.985 && d < 80 ? 'musical' : CLIPS[(Math.random() * CLIPS.length) | 0], [off, len] = HORN_CLIPS[name], rate = sc;
      const s = ctx.createBufferSource(); s.buffer = buf.horns; s.playbackRate.value = rate; s.connect(h.cg); s.onended = () => s.disconnect(); s.start(t, off, len);
      h.until = t + len / rate + 0.05; return;
    }
    const f0 = v.ty.bus ? 185 : v.ty.scooter ? 520 : 330 + Math.random() * 70, k = Math.random();
    const beats = k < 0.5 ? [[0, 0.22]] : k < 0.8 ? [[0, 0.12], [0.19, 0.12]] : [[0, 0.9 + Math.random() * 0.9]];   // a short beep, a double tap, a long angry one
    h.a.frequency.setValueAtTime(f0, t); h.b.frequency.setValueAtTime(f0 * 1.26, t);
    h.sg.gain.cancelScheduledValues(t); h.sg.gain.setValueAtTime(0, t);
    let end = t;
    for (const [s, dur] of beats) { h.sg.gain.setValueAtTime(0, t + s); h.sg.gain.linearRampToValueAtTime(0.35, t + s + 0.015); h.sg.gain.setValueAtTime(0.35, t + s + dur); h.sg.gain.linearRampToValueAtTime(0, t + s + dur + 0.04); end = t + s + dur + 0.05; }
    h.until = end;
  }

  // ---- the ten-times-a-second work
  function work(dt, paused) {
    const vs = traffic.vehicles, cx = camera.position.x, cz = camera.position.z, t = ctx.currentTime;
    const r = getRadio(), vol = r ? r.sfxVolume : 0.8, dk = r && Number.isFinite(r.duck) ? r.duck : 1, quiet = document.hidden || paused ? 0 : 1;
    g.bus.gain.setTargetAtTime(quiet * dk * clamp(vol, 0, 1), t, 0.15);
    if (quiet === 0 || vol <= 0.001) { for (const S of speakers) if (S.e) release(S, t); duckRadio(0); return; }
    const night = game.time ? game.time.night || 0 : 0, hour = game.time ? game.time.hour : 12;
    // the vehicles near: the traffic level (how busy the street is), the nearest moving ones for the pool
    let dens = 0; const near = [];
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], dx = v.x - cx, dz = v.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < 75 * 75) dens += 1 - Math.sqrt(d2) / 75;
      if (d2 < 40 * 40 && d2 > 4 && v.v > 1.5 && !v.fly) near.push(v, d2);
    }
    L.traffic += (clamp(dens / 9, 0, 1) - L.traffic) * 0.4; L.night = night;
    const tf = L.traffic * (1 - 0.55 * night);
    g.rum.o.gain.setTargetAtTime(MIX.rumble * Math.pow(tf, 0.8), t, 0.4); g.his.o.gain.setTargetAtTime(MIX.hiss * tf * tf, t, 0.4);
    g.rum.lp.frequency.setTargetAtTime(130 + 110 * tf, t, 0.4); g.his.bp.frequency.setTargetAtTime(700 + 600 * tf, t, 0.4);
    // cars passing: the six nearest moving vehicles keep a voice
    const pool = g.passes; let n = near.length >> 1;
    for (const p of pool) if (p.v && (p.v.dead || !near.includes(p.v))) { p.v = null; p.vid = -1; p.o.gain.setTargetAtTime(0, t, 0.12); }
    for (let k = 0; k < near.length; k += 2) {   // vehicles that have no voice yet take a free one, nearest first
      const v = near[k]; if (pool.some(p => p.v === v)) continue;
      let free = pool.find(p => !p.v); if (!free) continue;
      let rank = 0; for (let m = 0; m < near.length; m += 2) if (near[m + 1] < near[k + 1]) rank++;
      if (rank < PASSES) { free.v = v; free.vid = v.id; }
    }
    for (const p of pool) {
      const v = p.v; if (!v) continue;
      const dx = v.x - cx, dz = v.z - cz, d = Math.sqrt(dx * dx + dz * dz) || 1, rv = (dx * Math.sin(v.h) + dz * Math.cos(v.h)) * v.v / d;   // m/s away from the camera
      const dop = clamp(1 - rv * 0.012, 0.85, 1.15), sp = clamp(v.v / 12, 0.1, 1.2), kind = v.ty.scooter ? 1.7 : v.ty.bus ? 0.55 : 1;
      p.o.gain.setTargetAtTime(MIX.pass * (0.25 + 0.75 * sp) * (0.35 + 0.65 * (1 - night * 0.5)) / (1 + (d / 7) * (d / 7)) * clamp(1 - d / 45, 0, 1), t, 0.08);
      p.bp.frequency.setTargetAtTime((300 + v.v * 40) * kind * dop, t, 0.08);
      p.os.frequency.setTargetAtTime((52 + v.v * 4.2) * kind * dop, t, 0.08); p.og.gain.setTargetAtTime(0.5 * (v.ty.scooter ? 0.6 : 1), t, 0.2);
      if (p.p) p.p.pan.setTargetAtTime(pan(v.x, v.z), t, 0.06);
    }
    // horns all around: the busier the street (and the livelier the hour), the more often; from a vehicle 14 to 140 m away
    if (!paused && (hornT -= dt) <= 0) {
      const rate = 0.05 + 0.45 * tf;   // events per second
      hornT = (0.5 + Math.random()) / rate;
      for (let k = 0; k < 8 && vs.length; k++) { const v = vs[(Math.random() * vs.length) | 0], dx = v.x - cx, dz = v.z - cz, d = Math.sqrt(dx * dx + dz * dz); if (d > 14 && d < 140 && !v.hold2) { horn(v, d); break; } }
    }
    // l'arrotino
    arrotino(dt, t, night);
    // the market quarter by day: the nearest market's voices, louder the nearer the stalls
    let mq = 0;
    for (const m of MARKETS) { const d = Math.hypot(cx - m.cx, cz - m.cz); mq = Math.max(mq, clamp(1 - (d - m.r * 0.35) / (m.r * 0.65), 0, 1)); if (d < m.r + 120) load('mercato', 'mercato'); }
    const open = hour > 6.5 && hour < 20.5; L.market += ((open ? mq : 0) - L.market) * 0.3;
    if (buf.mercato && L.market > 0.02 && !g.mk.src) { const s = ctx.createBufferSource(); s.buffer = buf.mercato; s.loop = true; s.connect(g.mk.lp); s.start(0, Math.random() * buf.mercato.duration); g.mk.src = s; }
    g.mk.o.gain.setTargetAtTime(MIX.market * L.market * L.market, t, 0.5);
    if (g.mk.src && L.market < 0.005 && (g.mk.idle = (g.mk.idle || 0) + dt) > 4) { try { g.mk.src.stop(); } catch (e) { /* stopped */ } g.mk.src.disconnect(); g.mk.src = null; g.mk.idle = 0; } else if (L.market >= 0.005) g.mk.idle = 0;
  }

  function duckRadio(k) { const r = getRadio(); if (r && r.duckAmbient) r.duckAmbient(k, ARR_DUCK); }
  function release(S, t) {   // a loudspeaker lets go of its knife-grinder (off duty, out of earshot, or no longer one of the two nearest): the voice fades and the announcement stops
    const s = S.src; S.src = null; S.state = 'gap'; S.nextAt = t + 1 + Math.random() * 2; S.e = null;
    S.m.o.gain.setTargetAtTime(0, t, 0.04);
    if (s) { try { s.stop(t + 0.2); } catch (e) { /* stopped */ } }
  }
  function arrotino(dt, t, night) {
    const list = traffic.arrotini, cx = camera.position.x, cz = camera.position.z;
    let a = null, b = null, da = ARR_RANGE * ARR_RANGE, db = da;   // the two nearest on duty within range
    for (let i = 0; i < list.length; i++) {
      const E = list[i]; if (!E.on) continue;
      const dx = E.x - cx, dz = E.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < da) { b = a; db = da; a = E; da = d2; } else if (d2 < db) { b = E; db = d2; }
    }
    for (const S of speakers) if (S.e && S.e !== a && S.e !== b) release(S, t);
    for (let k = 0; k < 2; k++) {
      const E = k ? b : a; if (!E) continue;
      let has = false, free = null; for (const S of speakers) { if (S.e === E) has = true; else if (!S.e && !free) free = S; }
      if (has || !free) continue;
      free.e = E; if (free.state === 'gap') free.nextAt = Math.max(free.nextAt, t + Math.random() * 2.5);   // not in step with the other one
    }
    nearE = a; L.arr = 0; L.arrVis = 0; let duck = 0;
    if (a || b) load('arrotino', 'arrotino');
    for (const S of speakers) {
      const m = S.m, E = S.e;
      if (!E) { m.o.gain.setTargetAtTime(0, t, 0.1); continue; }
      const dx = E.x - cx, dz = E.z - cz, d = Math.sqrt(dx * dx + dz * dz);
      const lv = d <= ARR_NEAR ? 1 : d >= ARR_RANGE ? 0 : Math.pow(1 - (d - ARR_NEAR) / (ARR_RANGE - ARR_NEAR), 1.4);
      if (buf.arrotino && S.state === 'gap' && t >= S.nextAt && lv > 0.01) {   // the announcement, then a gap of a few seconds
        const s = ctx.createBufferSource(); s.buffer = buf.arrotino; s.connect(m.i); S.src = s; S.state = 'play';
        s.onended = () => { if (S.src === s) { S.src = null; S.state = 'gap'; S.nextAt = ctx.currentTime + 3.5 + Math.random() * 5; } s.disconnect(); };
        s.start(t);
      }
      const playing = S.state === 'play';
      m.o.gain.setTargetAtTime(MIX.arrotino * lv * (1 - 0.3 * night), t, 0.1);
      m.dl.frequency.setTargetAtTime(1200 + 2600 * lv, t, 0.15);
      if (m.p) m.p.pan.setTargetAtTime(pan(E.x, E.z), t, 0.08);
      if (S.src) S.src.playbackRate.setTargetAtTime(E.v && E.v.fly ? 0.82 : 1, t, 0.1);   // knocked into the air, his voice sags
      if (E === a && playing) { duck = clamp((lv - 0.12) / 0.7, 0, 1); L.arr = lv; L.arrVis = clamp(1 - d / 220, 0, 1); }   // the radio goes down for the nearest only
      S.d = d;
    }
    duckRadio(duck);
  }

  function update(dt, paused) {
    const list = traffic.arrotini, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < list.length; i++) {   // a pin on the minimap for each knife-grinder within earshot, and none otherwise
      const E = list[i], pin = pins[i], dx = E.x - cx, dz = E.z - cz;
      if (E.on && dx * dx + dz * dz < ARR_EAR * ARR_EAR) { pin.x = E.x; pin.z = E.z; if (!pinned[i]) { mapMarkers.push(pin); pinned[i] = true; } }
      else if (pinned[i]) { mapMarkers.splice(mapMarkers.indexOf(pin), 1); pinned[i] = false; }
    }
    if (!ctx && !build()) return;
    const n = nearE && nearE.on ? nearE : null;
    if ((n && L.arrVis > 0.04) || notes.alive) {   // the sound lines follow the nearest loudspeaker (every frame while any are alive)
      const lv = n ? L.arrVis : 0, v = n && n.v, y = n ? groundY(n.x, n.z) + 2.5 + (v && v.fly ? v.fly.y : 0) : 0;
      notes.update(paused ? 0 : dt, lv, n ? n.x : 0, y, n ? n.z : 0, n ? -Math.sin(n.h) : 0, n ? -Math.cos(n.h) : 0);
    }
    if ((tick -= dt) > 0) return;
    tick = TICK; if (ctx.state !== 'running') return;
    work(TICK, paused);
  }

  return {
    update,
    debug() {
      if (!g) return { built: false };
      const rms = a => { if (!a) return null; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x; return +Math.sqrt(s / b.length).toFixed(4); };
      const v = g.passes.filter(p => p.v).length, t = ctx.currentTime;
      return { built: true, ctx: ctx.state, bus: +g.bus.gain.value.toFixed(3), rumble: +g.rum.o.gain.value.toFixed(4), hiss: +g.his.o.gain.value.toFixed(4), traffic: +L.traffic.toFixed(2), passVoices: v, hornsBusy: g.horns.filter(h => h.until > t).length,
        arrotino: speakers.some(S => S.state === 'play') ? 'play' : 'gap', speakers: speakers.filter(S => S.state === 'play').length, heard: speakers.filter(S => S.e).length, arrGain: +Math.max(...speakers.map(S => S.m.o.gain.value)).toFixed(3), market: +L.market.toFixed(2), notes: notes.alive, buffers: Object.keys(buf).filter(k => buf[k]), rms: rms(g.an) };
    },
    horn: (v, d) => { if (g) horn(v, d); },   // test hook
    state: () => ({ L, speakers: speakers.map(S => ({ state: S.state, e: S.e && S.e.name, d: Math.round(S.d) })) }),
  };
}
