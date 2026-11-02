// The lapa's horn: a nasal two-tone beep, synthesised. Owned by the core.
// Held on KeyH (keyboard) or the touch pad that writes keys.KeyH. While it sounds, a 'pd-horn' event
// fires every 0.25 s with { x, z, r } so pedestrians and traffic can react (step aside, shout back).
export function createHorn({ keys, car, getVolume }) {
  let ctx = null, gain = null, oscs = [], on = false, pulse = 0;

  // The audio context must be made, and resumed, inside a user gesture (iPhone Safari keeps one that was made later in a frame silent for good): src/main.js calls unlock() from the shell's
  // 'pd-gesture' (the title tap, Drive, Resume) and the first touch or key press, so the first honk is not the first time the context exists.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function start() {
    unlock(); if (!ctx) return;
    gain = ctx.createGain();
    gain.gain.value = 0;
    // Small scooter horns are two slightly detuned square-ish tones through a nasal band-pass.
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 1150; band.Q.value = 1.4;
    band.connect(gain); gain.connect(ctx.destination);
    oscs = [415, 520].map(f => {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = f;
      o.connect(band); o.start();
      return o;
    });
    const t = ctx.currentTime, v = 0.16 * getVolume();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v, t + 0.015);
    on = true; pulse = 0;
  }

  function stop() {
    if (!on) return;
    on = false;
    const t = ctx.currentTime, g = gain, os = oscs;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.04);
    setTimeout(() => { for (const o of os) o.stop(); g.disconnect(); }, 80);
  }

  function update(dt, playing) {
    const want = playing && !!keys.KeyH;
    if (want && !on) start();
    else if (!want && on) stop();
    if (on && (pulse -= dt) <= 0) {
      pulse = 0.25;
      dispatchEvent(new CustomEvent('pd-horn', { detail: { x: car.x, z: car.z, r: 28 } }));
    }
  }

  return { update, unlock };
}
