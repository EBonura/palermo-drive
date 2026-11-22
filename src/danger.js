// Danger zones: every place in the city has a level 1 (quiet) to 5 (the ZEN), looked up by position from the grid baked by tools/danger.py
// (src/danger-data.js, from the ISTAT UPL outlines; docs/danger.md). It is a game-design call: IDISE measures hardship, not crime.
//   dangerAt(x, z) -> 1..5, areaAt(x, z) -> the area's name ('' where there is no data), wakeSpot(roadVerts, x, z) -> [x, z, th] just outside the area
//   createDanger({ car }) -> { update(dt, busy) -> true when a gang blocks the road now, level() }, cashLoss(level, cash), trouble() -> the state the HUD draws (src/danger-hud.js)
// THE NEIGHBOURHOOD SCORE. Nothing is random: every area keeps a score (0..100) that only goes up when the player does damage in it, with the very events that feed the
// police (src/police.js sends 'pd-chaos' for each: cars sent flying, people knocked over, smashed fences and walls, fast driving through crowds). The area's level (1..5)
// is how touchy it is: the same crash adds 2 points in a quiet area and 46 in the ZEN. Zero damage is zero risk, everywhere.
//   calm (under three eyes) -> noticed (three eyes, "Ti stannu taliannu...") -> hunted (five eyes: a 20 s countdown, the picciotti chase you, "Ti stannu circannu!") -> get out (countdown low, lookouts shout)
//   -> the bar is empty and you are still in that area: the gang blocks the road (src/vehicle-events.js plays it: fade, black, wake up stripped).
// Leave the area before the bar runs out and you are safe. A score fades slowly once the player has been quiet for a while, in the areas left behind too (so it is
// remembered for a minute or two if you come back). Parked with a high score, or hunted (five eyes), the score of the area you are in does not fade: get out of the quarter.
// Police patrols still read dangerAt() in src/police.js: a rough area draws the gang, a quiet one draws the police.
// Test links: ?danger=1..5 forces the level everywhere; ?dangerscore=N starts with N points in the area you start in; ?dangerfast shortens the bar to 5 s and plays the
// block sequence fast; with ?debug, window.pdDanger = { add(points), set(points), state(), areas }.
import { CELL, X0, Z0, W, H, ALPHA, NAMES, LEVELS, GRID } from './danger-data.js';
import { T } from './lang.js';
import { GANG_LOSS } from './economy.js';
import { covering } from './transition.js';

const Q = new URLSearchParams(location.search);
const FORCED = Math.min(5, Math.max(0, Math.round(+Q.get('danger')) || 0)), FAST = Q.has('dangerfast'), SEED = Math.max(0, +Q.get('dangerscore') || 0);
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

// The border of an area round a point, for the minimap (src/minimap.js) once the area has its eyes on you: the cell edges of area `id` within R cells of (x, z),
// as flat [x0, z0, x1, z1, ...], and `exit`, the nearest point just outside it. Worked out again only when the car moves to another cell.
const ZR = 9;
let zKey = '', zOut = null;
export function zoneOutline(x, z) {
  const id = upl(x, z), c0 = Math.floor((x - X0) / CELL), r0 = Math.floor((z - Z0) / CELL), key = id + ':' + c0 + ':' + r0;
  if (key === zKey) return zOut;
  zKey = key; const segs = [], cellsIn = []; let ex = null, ed = Infinity;
  const at = (c, r) => c < 0 || r < 0 || c >= W || r >= H ? -1 : cells[r * W + c];
  for (let r = r0 - ZR; r <= r0 + ZR; r++) for (let c = c0 - ZR; c <= c0 + ZR; c++) {
    if (at(c, r) !== id) continue;
    const x0 = X0 + c * CELL, z0 = Z0 + r * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    cellsIn.push(x0, z0);
    for (const [dc, dr, ax, az, bx, bz] of [[1, 0, x1, z0, x1, z1], [-1, 0, x0, z0, x0, z1], [0, 1, x0, z1, x1, z1], [0, -1, x0, z0, x1, z0]]) {
      if (at(c + dc, r + dr) === id) continue;
      segs.push(ax, az, bx, bz);
      const mx = (ax + bx) / 2 + dc * 12, mz = (az + bz) / 2 + dr * 12, d = (mx - x) ** 2 + (mz - z) ** 2;   // just over the edge
      if (d < ed) { ed = d; ex = [mx, mz]; }
    }
  }
  zOut = id ? { id, segs, cells: cellsIn, cell: CELL, exit: ex } : null;
  return zOut;
}

// the screen is covered: the loading screen, the title, or a transition (src/transition.js says so: this is asked every frame, and a selector query each time was time spent to learn the same thing)
export const covered = () => !!(document.getElementById('loading') || covering() || document.documentElement.classList.contains('pd-title'));
export const toast = (text, sub, neg) => dispatchEvent(new CustomEvent('pd-toast', { detail: { text, sub, neg } }));   // shown by src/event-hud.js

// ---------- the rates: the one table to tune by playing ----------
export const TUNE = {
  // Touchiness: score points one unit of police chaos adds, by the area's level 1..5 (a car sent flying is 0.7 units, a person knocked over 0.45).
  // Five eyes (80 points) take about 229 cars sent flying in level 1, 76 in level 2, 38 in level 3, 23 in level 4 and 14 in the ZEN (the owner, 22 Nov 2026: it filled after a little mess,
  // and 7 cars in the ZEN was still too few; it was 2, 6, 12, 24, 46, three cars in the ZEN, then 1, 3, 6, 10, 16).
  gain: [0.5, 1.5, 3, 5, 8],
  // How much of the police's chaos each kind counts for the gang. Fast driving through crowds is a stream of small events, so it counts less.
  kind: { yeet: 1, chain: 1, knock: 1, hitcop: 0.5, fence: 1, hedge: 1, wall: 1, market: 0.35, sidewalk: 0.35 },
  night: 1.3,        // the same damage counts for this much more at night
  max: 100,          // the score cap; the five eyes are 20 points each (the owner, 22 Nov 2026: the quarter is a twin of the police, five eyes beside five sirens)
  notice: 40,        // over this, three eyes: "noticed"
  search: 80,        // over this, five eyes: the hunt, the picciotti come out (src/police.js)
  seconds: FAST ? 5 : 20,   // (no longer used: the hunt has no timer since 22 Nov, only the picciotti boxing you in end it in a fermo)
  out: 0.35,         // the countdown under this much left: "get out of the quarter", the lookouts shout
  refill: 12,        // seconds for the bar to fill again once the score is back under `search`
  hold: 8,           // seconds without damage before the score starts to fade
  fade: 0.5,         // points per second it fades (in every area, also the ones you left)
  lookout: 5,        // seconds between the lookouts' shouts while you are told to get out
  safe: 2.6,         // seconds the "safe" words stay after you left an area in time
};
// Cash lost in a block: a share of the wallet, at least MIN and at most MAX, never more than the wallet holds. Level 1 loses nothing (it never happens).
const LOSS = GANG_LOSS;   // share, min, max (euro) by level (src/economy.js)
export const cashLoss = (lv, cash) => { const [k, lo, hi] = LOSS[lv - 1]; return Math.max(0, Math.min(Math.floor(cash), Math.min(hi, Math.max(lo, Math.round(cash * k))))); };

// What the lookouts shout from their scooters once you are told to get out. DRAFT Palermitan for the owner to correct; [Palermitan, English].
const LOOKOUT = [
  ['Nesci ri ccà!', 'Get out of here!'],
  ['Tiest’i balatuni ti nnà gghiri!', 'Blockhead, you\'ve got to go!'],
  ['Chiamati i picciotti!', 'Call the boys!'],
  ['Talia, iddu è!', 'Look, that\'s him!'],
];

// ---------- the score, per area ----------
const areas = new Map();   // area id -> { s: score, quiet: seconds since the last damage, bar: 1 full .. 0 empty }
// What the HUD draws (src/danger-hud.js): the score of the area the car is in, the stage (1 calm, 2 noticed, 3 searching, 4 get out), the bar (1 full .. 0 empty), and how long the "safe" words stay
const tr = { id: -1, score: 0, stage: 1, bar: 1, safe: 0 };
export const trouble = () => tr;
// what the picciotti are doing to you (src/police.js writes it every quarter second): box 0..1, how boxed in the lapa is (full: the fermo); close, one of them is near
export const gang = { box: 0, close: false };
export const resetTrouble = () => { if (areas.size || tr.score) { areas.clear(); Object.assign(tr, { id: -1, score: 0, stage: 1, bar: 1, safe: 0 }); } };   // back on the title: a new drive starts clean

export function createDanger({ car }) {
  let night = false, caught = false, lookT = 0, seed = SEED, hot = -1, hotOut = 0, seedT = 0, seedId = -1;   // hot: the area where the bar was running, hotOut: seconds since you left it
  addEventListener('pd-time', e => { night = !!(e.detail && e.detail.isNight); });
  addEventListener('pd-gang-catch', () => { caught = true; });   // the picciotti boxed the lapa in (src/police.js)
  const here = () => { const id = upl(car.x, car.z); let a = areas.get(id); if (!a) areas.set(id, a = { s: 0, quiet: 0, bar: 1 }); return a; };
  const add = pts => { const a = here(); a.s = Math.min(TUNE.max, Math.max(0, a.s + pts)); a.quiet = 0; };
  // the police's chaos events, as they happen (src/police.js): the same crash that brings the police adds to the score of the area it happened in
  addEventListener('pd-chaos', e => {
    const d = e.detail || {}, lv = dangerAt(car.x, car.z);
    add((d.amt || 0) * (TUNE.kind[d.kind] ?? 1) * TUNE.gain[lv - 1] * (night ? TUNE.night : 1));
  });
  if (Q.has('debug')) window.pdDanger = { add, set: n => { const a = here(); a.s = n; a.quiet = 0; }, state: () => tr, areas, areaId: upl };
  return {
    // call every frame while the game runs; true when a gang blocks the road now
    update(dt, busy) {
      const x = car.x, z = car.z, id = upl(x, z), sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
      if (caught && !(areas.get(id) && areas.get(id).s >= TUNE.search)) caught = false;   // boxed in by picciotti of an area you have just left: nothing
      if (seed) { seedT = id === seedId && !covered() ? seedT + dt : 0; seedId = id; if (seedT > 2) { here().s = Math.min(TUNE.max, seed); seed = 0; } }   // ?dangerscore: once the car has stayed in one area for a moment (a ?at= jump needs the world to stream in first)
      // every area's score fades once it has been quiet for a while; the ones you left too, so they are remembered a minute or two. Not while you park in a bad one.
      // The bar of an area you are not in fills up again, slowly: stepping over a border and back does not give you a fresh one.
      for (const [k, a] of areas) {
        a.quiet += dt;
        if (a.quiet > TUNE.hold && !(k === id && ((sp < 2 && a.s >= TUNE.notice) || a.s >= TUNE.search))) { a.s -= TUNE.fade * dt; if (a.s <= 0) { areas.delete(k); continue; } }
        if (k !== id) a.bar = Math.min(1, a.bar + dt / TUNE.refill);
      }
      tr.id = id; tr.safe = Math.max(0, tr.safe - dt);
      const a = areas.get(id), s = a ? a.s : 0;
      let stage = s < TUNE.notice ? 1 : s < TUNE.search ? 2 : 3;
      if (a) {
        if (stage < 3) a.bar = Math.min(1, a.bar + dt / TUNE.refill);
        else if (busy || covered() || document.querySelector('#pd-busted.on')) caught = false;   // a box-in that ends during an event, a transition or the busted card does not wait to fire later
        else {   // not during an event, a transition or the busted card
          a.bar = 1 - gang.box;   // no timer any more (the owner, 22 Nov 2026: a fermo with nobody round you made no sense): only the picciotti boxing you in
          if (caught) { caught = false; areas.delete(id); hot = -1; tr.stage = 1; tr.score = 0; tr.bar = 1; return true; }
        }
      }
      const bar = a ? a.bar : 1;
      if (stage === 3 && gang.close) stage = 4;   // one of them is on you: get out of the quarter
      // out of the area where the bar was running for a moment: you got away
      if (stage >= 3) { hot = id; hotOut = 0; }
      else if (hot === id) hot = -1;   // it cooled down while you stayed
      else if (hot >= 0 && (hotOut += dt) > 1.5) { hot = -1; tr.safe = TUNE.safe; }
      if (stage === 4) {   // the lookouts on their scooters
        if ((lookT -= dt) <= 0) { lookT = TUNE.lookout; const l = LOOKOUT[Math.floor(Math.random() * LOOKOUT.length)]; dispatchEvent(new CustomEvent('pd-lookout', { detail: { text: T(l[0], l[1]) } })); }
      } else lookT = 0;
      tr.score = s; tr.stage = stage; tr.bar = bar;
      return false;
    },
    level: () => dangerAt(car.x, car.z),
    catch() { caught = true; },   // the picciotti boxed the lapa in (src/police.js): the block now, if the hunt is on here
    hunt: () => tr.stage >= 3 ? tr.id : -1,   // the area hunting you, or -1
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
