// Danger zones: every place in the city has a level 1 (quiet) to 5 (the ZEN), looked up by position from the grid baked by tools/danger.py
// (src/danger-data.js, from the ISTAT UPL outlines; docs/danger.md). It is a game-design call: IDISE measures hardship, not crime.
//   dangerAt(x, z) -> 1..5, areaAt(x, z) -> the area's name ('' where there is no data), wakeSpot(roadVerts, x, z) -> [x, z, th] just outside the area
//   createDanger({ car }) -> { update(dt, busy) -> true when a gang blocks the road now, level() }, cashLoss(level, cash), blockRate(level, speed, night)
// The block itself (fade, black, wake up stripped) is played by src/vehicle-events.js; police patrols read dangerAt() in src/police.js.
// Test links: ?danger=1..5 forces the level everywhere, ?dangerfast makes a block come within seconds (and plays the sequence fast).
import { CELL, X0, Z0, W, H, ALPHA, NAMES, LEVELS, GRID } from './danger-data.js';

const Q = new URLSearchParams(location.search);
const FORCED = Math.min(5, Math.max(0, Math.round(+Q.get('danger')) || 0)), FAST = Q.has('dangerfast');
const PI = Math.PI;

// ---------- the grid: UPL index per cell, decoded once ----------
const cells = new Uint8Array(W * H);
for (let i = 0, p = 0; i < GRID.length;) {   // symbol + run length, repeated
  const s = GRID[i++]; let n = 0; while (i < GRID.length && GRID.charCodeAt(i) >= 48 && GRID.charCodeAt(i) <= 57) n = n * 10 + GRID.charCodeAt(i++) - 48;
  cells.fill(ALPHA.indexOf(s), p, p + n); p += n;
}
const upl = (x, z) => {   // UPL index at a point, 0 where there is no data
  const c = Math.floor((x - X0) / CELL), r = Math.floor((z - Z0) / CELL);
  return c < 0 || r < 0 || c >= W || r >= H ? 0 : cells[r * W + c];
};
export const dangerAt = (x, z) => FORCED || LEVELS[upl(x, z)];
export const areaAt = (x, z) => NAMES[upl(x, z)];
export const areaId = upl;

// ---------- the entry toast ----------
const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'it');
const T = (it, en) => (lang() === 'en' ? en : it);
const TAG = [
  ['Tutto tranquillo. Sospettosamente tranquillo.', 'All quiet. Suspiciously quiet.'],
  ['Occhio al telefono, occhio al portafoglio.', 'Mind your phone, mind your wallet.'],
  ['Qui parlano gli sguardi. Tu parla poco.', 'Out here the looks do the talking.'],
  ['Finestrino su, occhi aperti, piede giù.', 'Windows up, eyes open, foot down.'],
  ['Non ti fermare. Mai. Nemmeno per il rosso.', 'Do not stop. Ever. Not even at a red.'],
];
const DIAMONDS = n => '◆'.repeat(n);
// the screen is covered: the loading screen, the title, or a transition (src/transition.js, a .pd-tr with .on)
export const covered = () => !!(document.getElementById('loading') || document.querySelector('.pd-tr.on') || document.documentElement.classList.contains('pd-title'));
export const toast = (text, sub, neg) => dispatchEvent(new CustomEvent('pd-toast', { detail: { text, sub, neg } }));   // shown by src/event-hud.js
export const dangerToast = (name, lv) => toast(`${name}  ${DIAMONDS(lv)}`, T(...TAG[lv - 1]), lv >= 4);

// ---------- chance of a block ----------
// Blocks per minute at cruising speed in daylight, by level. Level 1 is a rounding error, level 5 is a real risk within a few minutes.
const RATE = [0.001, 0.015, 0.05, 0.12, 0.25];
// Standing around is what gets you: red lights, traffic, parking. Flooring it is safer.
const speedMul = v => v < 2 ? 3 : v < 6 ? 2 : v < 14 ? 1 : 0.35;
const NIGHT = 1.6;
export const blockRate = (lv, speed, night) => RATE[lv - 1] * speedMul(speed) * (night ? NIGHT : 1);
// Cash lost in a block: a share of the wallet, at least MIN and at most MAX, never more than the wallet holds. Level 1 loses nothing (it never happens).
const LOSS = [[0, 0, 0], [0.08, 3, 15], [0.15, 6, 30], [0.25, 10, 60], [0.4, 15, 120]];   // share, min, max (euro) by level
export const cashLoss = (lv, cash) => { const [k, lo, hi] = LOSS[lv - 1]; return Math.max(0, Math.min(Math.floor(cash), Math.min(hi, Math.max(lo, Math.round(cash * k))))); };

const CHECK = FAST ? 0.5 : 3, COOL = FAST ? 4 : 120, GRACE = FAST ? 1 : 20;   // seconds of play: between checks, after a block, after the game starts

export function createDanger({ car }) {
  let night = false, t = 0, cool = GRACE, shown = 0, seen = -1, seenT = 0;
  addEventListener('pd-time', e => { night = !!(e.detail && e.detail.isNight); });
  return {
    // call every frame while the game runs; true when a gang blocks the road now
    update(dt, busy) {
      const x = car.x, z = car.z, lv = dangerAt(x, z), id = upl(x, z);
      // entering an area with a different level: its name and the level, once you have been in it a moment
      seenT = id === seen ? seenT + dt : 0; seen = id;
      // the neighbourhood and its level are always on screen now (the status stack in src/police.js), so no entry toast
      cool = Math.max(0, cool - dt);
      if ((t += dt) < CHECK) return false;
      t = 0;
      if (cool > 0 || busy || covered() || document.querySelector('#pd-busted.on')) return false;
      const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
      if (!(FAST ? lv >= 2 : Math.random() < 1 - Math.exp(-blockRate(lv, sp, night) / 60 * CHECK))) return false;
      cool = COOL; return true;
    },
    level: () => dangerAt(car.x, car.z),
  };
}

// ---------- where you wake up ----------
// A road point outside the area you were in (no cell of it within 35 m), preferably of a lower level, the nearest one; facing away from where you were.
export function wakeSpot(roadVerts, x, z) {
  const me = upl(x, z), L = dangerAt(x, z), R = 35;
  const outside = (px, pz) => { for (let k = 0; k < 9; k++) { const a = k * PI / 4, id = k === 8 ? upl(px, pz) : upl(px + Math.cos(a) * R, pz + Math.sin(a) * R); if (id === me) return false; } return true; };
  let best = null, bs = Infinity;
  for (let i = 0; i < roadVerts.length; i++) {
    const v = roadVerts[i], d = Math.sqrt((v[0] - x) ** 2 + (v[1] - z) ** 2);
    if (d >= bs || d < 40) continue;
    const s = d + (dangerAt(v[0], v[1]) >= L ? 600 : 0);   // a place as dangerous as this one counts as 600 m farther
    if (s < bs && outside(v[0], v[1])) { bs = s; best = v; }
  }
  let px, pz, th;
  if (best) { px = best[0]; pz = best[1]; th = best[2]; }
  else {   // roads not streamed in: walk straight out of the area
    px = x; pz = z;
    for (let r = 60, f = false; r < 3000 && !f; r += 60) for (let k = 0; k < 16 && !f; k++) { const a = k * PI / 8, qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (outside(qx, qz)) { px = qx; pz = qz; f = true; } }
    th = Math.atan2(px - x, pz - z);
  }
  const ax = px - x, az = pz - z;   // face away from where the block happened
  if (Math.sin(th) * ax + Math.cos(th) * az < 0) th += PI;
  return [px, pz, th];
}
