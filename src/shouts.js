// Comic speech balloons for people and drivers yelling at the player. Owned by the core.
// Other modules call env.shout(x, y, z, text?, follow?) when the lapa hits someone. (x, y, z) is the
// speaker's head; the balloon's tail points at it. follow, if given, returns the current head position
// ({x, y, z} or null once the speaker is gone) so the balloon stays on someone who dodges or goes flying.
// opts.crowd: a fan in the stands of the Barbera (src/stadium.js): a smaller balloon with its own cap and a pool of elements, so a stand full of them never pushes the street's out.
import * as THREE from 'three';
import { vp } from './viewport.js';
import { areaAt } from './danger.js';
import { MARKETS } from './markets-data.js';

// Supplied by the owner, born in Palermo: keep them exactly as written.
export const INSULTS = [
  'Figghipulla!',
  'Cuinnutu!',
  'Ou ma sì cretino',
  'To matri e pulla',
  "Cuinnut'i to patri!",
  "Talè chi c'è cca!",
  "Pizz'i fagnu!",
  'Chi ffa un ci viri?',
  'A patente nni patatini attruvasti?',
  "Si t'annagghiu ti ruimpu u culu",
  'Ti rumpu i cuinna!',
  'U paliaimmu è miraculusu!',
  "Mancu cu'u lignu!!",
  'Pigghialu stu nummaro i taigga',
  'Sì nuddu immiscatu cu niainti',
  "Ma u ciaivviaddu l'hai pi spaittiri 'aricchi?",
  'Minchia ra niagghia',
  'Minchia ra cosa inutili',
  'Minchia sì na ccuasa ppi ghiccari',
  "To matri sbatti l'uava chì minni",
  "T'annagghiù ti rugnu na timpulata ti fazzu a bbiriri u papa vistutu i comuniuani",
  "A vo' viriri Paliaimmu illuminata?",
  'Ou ma sì spanatu i cieivvieddu?',
  'Shumaker arrivò',
  "Fumatilla n'avutra",
  'Cuscì ciaicchi aggaddu?',
  'Bba iaccati!',
  'Chiffà a dignità nna puittamu puru o a lassamu a casa?',
];
// The owner's lines that belong to a place: the ZEN, Mondello's sand and the three markets, the last two by day. placeLine(x, z, sand) -> one of them at that spot, or null anywhere else.
const ZEN_LINES = ['Cutiaddu? Pistuala?'], MARKET_LINES = ['Si sta muriannu ra faaameee', 'Signora i limoni signoraaaaaaaahhhhh'];
const MONDELLO_LINES = ['Buongioinno da Mondello!', "Non ce n'è! Non ce n'è!", 'Coccobellooooooo', "Chessobelle polla', pollancheeee!"];
let hourNow = 12;
addEventListener('pd-time', e => { if (Number.isFinite(e.detail?.hour)) hourNow = e.detail.hour; });
export function placeLine(x, z, sand) {   // sand: the spot is on a beach (the crowd knows, src/pedestrians.js); only then Mondello's lines
  const of = L => L[(Math.random() * L.length) | 0], area = areaAt(x, z);
  if (area === 'ZEN') return of(ZEN_LINES);
  if (sand && area === 'Mondello' && hourNow > 6.5 && hourNow < 20.5) return of(MONDELLO_LINES);
  if (hourNow > 6.5 && hourNow < 20.5) for (const m of MARKETS) if ((x - m.cx) ** 2 + (z - m.cz) ** 2 < (m.r * 0.7) ** 2) return of(MARKET_LINES);
  return null;
}
// Said now and then by someone the lapa sends flying, or who leaps out of its way (src/pedestrians.js). Owner's line, as written.
export const FLEW = 'Minchia vulavu';

const LIFE = 2.4, MAX = 4, COOLDOWN = 0.35;
export const lifeFor = t => Math.min(6, LIFE + Math.max(0, t.length - 20) * 0.07);   // a long line stays long enough to be read
const CROWD_MAX = 8, CROWD_LIFE = 3.2;

const RARE = 'Con la rucola o seeeeeeeeenza?', RARE_CHANCE = 0.03;   // a treat, about one shout in thirty

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

  function pick(x, z) {
    if (Math.random() < RARE_CHANCE) return RARE;
    if (Math.random() < 0.3) { const l = placeLine(x, z); if (l) return l; }
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
    el.textContent = text || pick(x, z);
    el.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
    layer.appendChild(el);
    live.push({ el, p: new THREE.Vector3(x, y, z), follow, t: 0, side: 0, pax, crowd, life: crowd ? CROWD_LIFE : lifeFor(el.textContent) });
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
      if (behind !== s.behind) { s.behind = behind; s.el.style.display = behind ? 'none' : ''; }   // (the style is written only when it changes: a balloon standing still on the screen costs the page nothing)
      if (behind) continue;
      if (s.h === undefined) { s.h = s.el.offsetHeight; s.w = s.el.offsetWidth; }   // read once per balloon
      const x = (v.x + 1) / 2 * w, y = Math.max((h < 520 ? 110 : 96) + s.h, (1 - v.y) / 2 * h);   // the whole balloon stays under the top band, which belongs to the HUD's zones (src/hud.js)
      const pop = Math.min(1, s.t / 0.12), fade = Math.min(1, (s.life - s.t) / 0.3);
      // Sit beside the speaker, on the side away from the screen centre, so the face and the road stay
      // visible; the side is chosen once so the balloon doesn't flip while it follows them.
      if (!s.side) { s.side = x < w / 2 ? -1 : 1; s.el.classList.add(s.side < 0 ? 'left' : 'right'); }
      const ox = s.side * 18, ax = s.side < 0 ? -100 : 0;
      // it stays on the screen, and on a desktop out of the map's column on the right (a phone's column ends in the top band)
      const bx = s.side < 0 ? Math.max(8 + s.w, x + ox) : Math.min(w - 8 - s.w - (h >= 520 && y - s.h < 340 ? 222 : 0), x + ox);
      const tf = `translate(${bx.toFixed(0)}px, ${y.toFixed(0)}px) translate(${ax}%, -100%) rotate(var(--tilt)) scale(${(0.6 + 0.4 * pop).toFixed(2)})`, op = fade.toFixed(2);
      if (tf !== s.tf) s.el.style.transform = s.tf = tf;
      if (op !== s.op) s.el.style.opacity = s.op = op;
    }
  }

  return { shout, update };
}
