// Comic speech balloons for people and drivers yelling at the player. Owned by the core.
// Other modules call env.shout(x, y, z) (a random line) or env.shout(x, y, z, text) when the lapa hits
// someone; balloons follow that point on screen for a couple of seconds.
import * as THREE from 'three';

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
];

const LIFE = 2.4, MAX = 4, COOLDOWN = 0.35;

export function createShouts(camera) {
  const layer = document.createElement('div');
  layer.className = 'shouts';
  document.body.appendChild(layer);
  const live = [], v = new THREE.Vector3();
  let last = -1, lastAt = -Infinity, clock = 0;

  function pick() {
    let i;
    do i = Math.floor(Math.random() * INSULTS.length); while (INSULTS.length > 1 && i === last);
    last = i;
    return INSULTS[i];
  }

  function shout(x, y, z, text) {
    if (clock - lastAt < COOLDOWN) return; // a pile-up shouldn't fill the screen
    lastAt = clock;
    if (live.length >= MAX) live.shift().el.remove();
    const el = document.createElement('div');
    el.className = 'shout';
    el.textContent = text || pick();
    el.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    layer.appendChild(el);
    live.push({ el, p: new THREE.Vector3(x, y + 2.1, z), t: 0 });
  }

  function update(dt) {
    clock += dt;
    const w = innerWidth, h = innerHeight;
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      s.t += dt;
      if (s.t > LIFE) { s.el.remove(); live.splice(i, 1); continue; }
      v.copy(s.p); v.y += s.t * 0.4; // drifts up a little
      v.project(camera);
      const behind = v.z > 1;
      s.el.style.display = behind ? 'none' : '';
      if (behind) continue;
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      const pop = Math.min(1, s.t / 0.12), fade = Math.min(1, (LIFE - s.t) / 0.3);
      s.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%) rotate(var(--tilt)) scale(${(0.6 + 0.4 * pop).toFixed(2)})`;
      s.el.style.opacity = fade.toFixed(2);
    }
  }

  return { shout, update };
}
