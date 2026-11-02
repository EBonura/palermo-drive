// Comic speech balloons for people and drivers yelling at the player. Owned by the core.
// Other modules call env.shout(x, y, z, text?, follow?) when the lapa hits someone. (x, y, z) is the
// speaker's head; the balloon's tail points at it. follow, if given, returns the current head position
// ({x, y, z} or null once the speaker is gone) so the balloon stays on someone who dodges or goes flying.
// opts.crowd: a fan in the stands of the Barbera (src/stadium.js): a smaller balloon with its own cap and a pool of elements, so a stand full of them never pushes the street's out.
import * as THREE from 'three';
import { vp } from './viewport.js';

// Supplied by the owner, born in Palermo: keep them exactly as written.
export const INSULTS = [
  'Figghipulla!',
  'Cuinnutu!',
  'Ou ma sì cretino',
  'To matri e pulla',
  "Cuinnut'i to patri!",
  "Talè chi c'è cca!",
  "Pezz'i fagnu!",
  'Chi ffa un ci viri?',
  'A patente nni patatini attruvasti?',
  "Si t'annagghiu ti ruimpu u culu",
  'Ti rumpu i cuinna!',
  'U paliaimmu è miraculusu!',
  "Mancu cu'u lignu!!",
  'Pigghialu stu nummaro i taigga',
  'Con la rucola o seeeeeeeeenza?',
];
// Said now and then by someone the lapa sends flying, or who leaps out of its way (src/pedestrians.js). Owner's line, as written.
export const FLEW = 'Minchia vulavu';

const LIFE = 2.4, MAX = 4, COOLDOWN = 0.35;
const CROWD_MAX = 8, CROWD_LIFE = 3.2;

export function createShouts(camera) {
  const layer = document.createElement('div');
  layer.className = 'shouts';
  document.body.appendChild(layer);
  const live = [], v = new THREE.Vector3();
  const spare = [];   // balloon elements of the crowd, kept for the next one
  let last = -1, lastAt = -Infinity, clock = 0, focused = false;
  // the passenger's balloon: rosanero, so it stands out from the street's insults
  const style = document.createElement('style');
  style.textContent = '.shout.pax { background: rgba(232,85,154,.94); color: #fff; } .shout.pax::after { border-top-color: rgba(232,85,154,.94); }'
    + ' .shout.crowd { max-width: min(24vw, 128px); padding: 2px 5px 3px; border-width: 1.5px; font-size: clamp(9px, 1.4vw, 11px); box-shadow: 1px 1px 0 rgba(232,85,154,.7); backdrop-filter: none; -webkit-backdrop-filter: none; }';
  document.head.appendChild(style);

  function pick() {
    let i;
    do i = Math.floor(Math.random() * INSULTS.length); while (INSULTS.length > 1 && i === last);
    last = i;
    return INSULTS[i];
  }

  function drop(i) { const s = live[i]; s.el.remove(); if (s.crowd && spare.length < CROWD_MAX) spare.push(s.el); live.splice(i, 1); }
  function shout(x, y, z, text, follow, opts) {
    // During a fare (focus) only the passenger talks: one pink balloon at a time, everything else is dropped.
    const pax = !!opts?.pax, crowd = !!opts?.crowd;
    if (focused && !pax) return;
    if (pax) for (let i = live.length - 1; i >= 0; i--) if (live[i].pax) drop(i);
    // Random insults are rate-limited so a pile-up doesn't fill the screen; scripted lines (the wheelchair
    // miracle, vendors, tourists) always show.
    if (!text && clock - lastAt < COOLDOWN) return;
    if (!text) lastAt = clock;
    let n = 0, oldest = -1;   // the oldest balloon of the same kind makes room
    for (let i = 0; i < live.length; i++) if (live[i].crowd === crowd) { n++; if (oldest < 0) oldest = i; }
    if (n >= (crowd ? CROWD_MAX : MAX)) drop(oldest);
    const el = (crowd && spare.pop()) || document.createElement('div');
    el.className = pax ? 'shout pax' : crowd ? 'shout crowd' : 'shout';
    el.textContent = text || pick();
    el.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    layer.appendChild(el);
    live.push({ el, p: new THREE.Vector3(x, y, z), follow, t: 0, side: 0, pax, crowd, life: crowd ? CROWD_LIFE : LIFE });
  }
  // focus(true) when a fare starts: clears the other balloons and keeps them away until focus(false)
  shout.focus = on => {
    on = !!on; if (on === focused) return; focused = on;
    if (on) for (let i = live.length - 1; i >= 0; i--) if (!live[i].pax) drop(i);
  };

  function update(dt) {
    clock += dt;
    const w = vp.w, h = vp.h;
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      s.t += dt;
      if (s.t > s.life) { drop(i); continue; }
      const f = s.follow?.();
      if (f) s.p.set(f.x, f.y, f.z);
      v.copy(s.p); v.y += 0.35 + s.t * 0.12; // just above the head, rising a touch
      v.project(camera);
      const behind = v.z > 1;
      s.el.style.display = behind ? 'none' : '';
      if (behind) continue;
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      const pop = Math.min(1, s.t / 0.12), fade = Math.min(1, (s.life - s.t) / 0.3);
      // Sit beside the speaker, on the side away from the screen centre, so the face and the road stay
      // visible; the side is chosen once so the balloon doesn't flip while it follows them.
      if (!s.side) { s.side = x < w / 2 ? -1 : 1; s.el.classList.add(s.side < 0 ? 'left' : 'right'); }
      const ox = s.side * 18, ax = s.side < 0 ? -100 : 0;
      s.el.style.transform = `translate(${(x + ox).toFixed(0)}px, ${y.toFixed(0)}px) translate(${ax}%, -100%) rotate(var(--tilt)) scale(${(0.6 + 0.4 * pop).toFixed(2)})`;
      s.el.style.opacity = fade.toFixed(2);
    }
  }

  return { shout, update };
}
