// The quiet job (a job module of the director, docs/missions-director.md): the owner's stealth mission. By night, in the worst quarters, carry something to a point inside the quarter
// without waking it: go slowly and make no noise. Instant offer (nobody to meet: it starts when the call is answered).
//   OFFERED only at night and only when the lapa is in, or within NEAR_R metres of, an area of danger level 4 or 5 (dangerAt of src/danger.js, the baked grid of the ISTAT outlines:
//   Brancaccio and the ZEN are 5, Roccella, Ciaculli, Zisa and Borgo Nuovo are 4). The place is a road point 400 to 900 m from the lapa, snapped from a cell of such an area.
//   THE NOISE METER (0 to 1, drawn as the HUD bar) fills with what makes noise and drains slowly when the lapa is quiet:
//     speed over QUIET_V (30 km/h)  RATE_V per second for each QUIET_V of speed above it    the horn ('pd-horn', every 0.25 s while held)  HORN each
//     the nitro (car.nosOn) NITRO per second                                                  people and cars hit ('pd-chaos', any kind)  HIT each
//     scraping a wall (car.scrape, src/vehicle-sphere.js, in m/s of wall contact) SCRAPE per second over SCRAPE_V        quiet: DRAIN per second
//   FULL METER: failed, and the quarter wakes up: the job sends the neighbourhood score of src/danger.js over its hunt limit with a big 'pd-chaos' of kind 'wall' (nothing pays for
//   that kind in src/hit-pay.js), once the event is over; the HUD of the quarter then runs the hunt and the picciotti come as for any damage done there. That is the public way
//   src/danger.js offers (it listens to pd-chaos), no private call is needed.
//   ARRIVING: inside the ring (destBeacon) and stopped for HOLD seconds: paid PAY_BASE + the distance / PAY_PER_M euro, rounded to 5. It is the best paid job per minute (the
//   speed limit makes it slow and a mistake costs the pay and the quarter). Time limit: LIMIT_BASE seconds plus LIMIT_PER_M seconds a metre. The slot's leash covers the line from
//   where it started to the place, with LEASH_R metres either side. Final euro, not multiplied by PAY_X.
// Nothing is built or drawn while the job is not running (the one beacon is the missions' own destBeacon). The words are Palermitan in the owner's spelling, drafted from his rulings and passed by him on 22 Nov 2026.
// setup(X): called once by src/jobs.js.
import { dangerAt, areaAt } from './danger.js';
import { esc } from './esc.js';

const NEAR_R = 900, GRID = 100;                     // metres: how far an area of level 4 or 5 may be for the call, and the step of the search for a place in one
const MIN_D = 400, MAX_D = 900;                     // metres: how far the place is from the lapa
const QUIET_V = 30 / 3.6;                           // m/s, 30 km/h: any faster is noise
const RATE_V = 0.14, HORN = 0.12, NITRO = 0.6, HIT = 0.5, SCRAPE = 0.2, SCRAPE_V = 2.5, DRAIN = 0.035;   // the meter, per second or per event
const HOLD = 0.8, PAY_BASE = 60, PAY_PER_M = 10, LIMIT_BASE = 40, LIMIT_PER_M = 0.2, LEASH_R = 450;
const CARD_T = 4.2, FAIL_T = 3.4, WAKE_AMT = 4;     // seconds of the result cards; the size of the 'pd-chaos' that wakes the quarter (past the hunt limit even in level 4)
const GOLD = '#f5d27a';

export default function setup(X) {
  const { car, T, hud, eur, speed } = X;
  const slot = { id: 'quiet:1', kind: 'quiet', sub: 'quiet', name: 'Consegna silenziosa', x: 0, z: 0, dx: 0, dz: 1, w: 6, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null,
    leash: () => ({ a: [slot.ox, slot.oz], b: [slot.tx, slot.tz], r: LEASH_R }), ox: 0, oz: 0, tx: 0, tz: 0 };
  let job = null, e = null;     // job: what the ringing card promised { x, z, d, pay, secs, area }; e: the event while it runs
  const hudO = { label: '', title: '', sub: '', time: '', low: false, frac: 0, target: { x: 0, z: 0 } };

  addEventListener('pd-horn', () => { if (e && e.phase === 'run') e.m += HORN; });
  addEventListener('pd-chaos', () => { if (e && e.phase === 'run') e.m += HIT; });

  // the place: a road point 400 to 900 m away whose own cell is of level 4 or 5. The cells are looked at on a coarse grid round the lapa, in a random order, and the first that gives a good
  // road point wins. Two road sources: the traffic graph (the roads of the tiles at full detail, which is where the lapa is; the outer quarters like Brancaccio have no other) and X.snapRoad
  // (the baked roads of the old centre, enough for Zisa), tried in that order.
  const sx = [], sz = [];
  function findPlace() {
    const G = X.traffic && X.traffic.graph;
    sx.length = sz.length = 0;
    for (let x = -MAX_D; x <= MAX_D; x += GRID) for (let z = -MAX_D; z <= MAX_D; z += GRID) { const d = Math.hypot(x, z); if (d >= MIN_D - 50 && d <= MAX_D + 50 && dangerAt(car.x + x, car.z + z) >= 4) { sx.push(car.x + x); sz.push(car.z + z); } }
    for (let n = Math.min(sx.length, 16); n > 0; n--) {
      const i = (Math.random() * sx.length) | 0, qx = sx[i] + (Math.random() - 0.5) * GRID, qz = sz[i] + (Math.random() - 0.5) * GRID;
      sx[i] = sx[sx.length - 1]; sz[i] = sz[sz.length - 1]; sx.length--; sz.length--;
      let px = 0, pz = 0, ok = false;
      const nn = G ? G.nearestNode(qx, qz, 60, true) : -1;
      if (nn >= 0) { const q = G.nodePos(nn); px = q[0]; pz = q[1]; ok = true; }
      else { const sn = X.snapRoad(qx, qz); if (sn.d < 60) { px = sn.x; pz = sn.z; ok = true; } }
      const d = Math.hypot(px - car.x, pz - car.z);
      if (ok && d >= MIN_D && d <= MAX_D && dangerAt(px, pz) >= 4) return { x: px, z: pz, d };
    }
    return null;
  }
  // is the lapa in or near such an area: the lapa's own cell, then a ring of points at 150 m steps out to NEAR_R
  function near() {
    if (dangerAt(car.x, car.z) >= 4) return true;
    for (let r = 150; r <= NEAR_R; r += 150) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (dangerAt(car.x + Math.cos(a) * r, car.z + Math.sin(a) * r) >= 4) return true; }
    return false;
  }

  X.director.add('quiet', () => {
    if (!X.isNight() || !near()) return null;
    const p = findPlace(); if (!p) return null;
    const pay = Math.round((PAY_BASE + p.d / PAY_PER_M) / 5) * 5, secs = Math.round(LIMIT_BASE + p.d * LIMIT_PER_M), area = areaAt(p.x, p.z);
    job = { x: p.x, z: p.z, d: p.d, pay, secs, area };
    slot.x = car.x; slot.z = car.z;
    return { slot, instant: true, ped: 'nightboy', col: '#7d8cff', tag: T('Mutu e araciu', 'Quiet job'), pay, who: 'Gaetano',
      line: T('Puaitta sta busta rintra ô quaittiari. Araciu araciu, sienza fari scrusciu: un s’avi a arruspigghiari nuddu.', 'Take this envelope into the quarter. Slowly, no noise: nobody must wake up.'),
      note: T('araciu araciu', 'nice and slow'),
      where: area || T('quaittiari', 'quarter'),
      drop: () => { job = null; } };
  });

  const put = () => {   // the card: the strings are rebuilt only when a number changes
    const noise = Math.min(100, Math.round(e.m * 100)), left = Math.max(0, Math.ceil(e.secs - e.t)), d = Math.round(Math.hypot(car.x - e.x, car.z - e.z) / 10) * 10;
    if (noise !== e.shownN || left !== e.shownT || d !== e.shownD) {
      e.shownN = noise; e.shownT = left; e.shownD = d;
      hudO.label = T('Mutu e araciu', 'Quiet delivery');
      hudO.title = e.area || T('Quaittiari', 'Quarter');
      hudO.sub = `${d} m  ·  ${eur(e.pay)}  ·  ${T('scrusciu', 'noise')} ${noise}%`;
      hudO.time = left + ' s';
    }
    hudO.low = e.m > 0.7; hudO.frac = e.m;   // the bar is the noise: it turns red when the quarter is about to wake
    hud.set(hudO);
  };

  const finish = (ok, why) => {
    e.phase = 'done'; e.t = 0; e.ok = ok; e.hold = ok ? CARD_T : FAIL_T; X.setPhase('done'); X.destBeacon.show(false); X.aim(0, 0, false);
    if (ok) {
      X.addFare(e.pay);
      hud.result(`<h3>${T('Cunsignata, un s’arruspigghiò nuddu', 'Delivered, nobody woke up')}</h3>
        <div class="row"><span>${esc(e.area || '')}</span><span></span></div>
        <div class="row tot"><span>${T('Picciuli', 'Pay')}</span><span>${esc(eur(e.pay))}</span></div>`, CARD_T);
      hud.burst();
    } else if (why === 'noise') hud.result(`<h3>${T('U quaittiari s’arruspigghiò!', 'The quarter woke up!')}</h3>
        <div class="row"><span>${T('Truappu scrusciu. Scappa!', 'Too much noise. Run!')}</span><span></span></div>`, FAIL_T);
    else hud.result(`<h3>${T('Truappu taiddu', 'Too late')}</h3>
        <div class="row"><span>${T('Gaetano un paga', 'Gaetano does not pay')}</span><span></span></div>`, FAIL_T);
    e.why = why;
  };

  X.kinds.quiet = {
    start(s) {
      const j = job; job = null; if (!j) { X.endEvent(false); return; }   // no call, no place: nothing to do
      s.ox = car.x; s.oz = car.z; s.tx = j.x; s.tz = j.z;
      e = { ...j, phase: 'run', t: 0, m: 0, still: 0, shownN: -1, shownT: -1, shownD: -1, ok: false, hold: 0, why: '' };
      X.setPhase('run');
      X.destBeacon.set(j.x, j.z); X.destBeacon.show(true); X.guide.to(j.x, j.z); hudO.target.x = j.x; hudO.target.z = j.z;
      hud.toast(T('Araciu araciu', 'Nice and slow'), T('Sutta i trenta all’ura, nianti clacson', 'Under 30 km/h, no horn'));
    },
    update(dt) {
      if (!e) return;
      e.t += dt;
      if (e.phase === 'run') {
        const v = speed();
        if (v > QUIET_V) e.m += (v - QUIET_V) / QUIET_V * RATE_V * dt;
        else e.m -= DRAIN * dt;
        if (car.nosOn) e.m += NITRO * dt;
        if (car.scrape > SCRAPE_V) e.m += SCRAPE * dt;
        if (e.m < 0) e.m = 0;
        X.aim(e.x, e.z, true);
        const d = Math.hypot(car.x - e.x, car.z - e.z);
        e.still = d < X.destBeacon.R && v < 1.2 ? e.still + dt : 0;
        if (e.m >= 1) { e.m = 1; finish(false, 'noise'); }
        else if (e.still >= HOLD) finish(true);
        else if (e.t >= e.secs) finish(false, 'time');
        else put();
      } else if (e.t >= e.hold) { const ok = e.ok, why = e.why; e = null; X.endEvent(ok); if (why === 'noise') dispatchEvent(new CustomEvent('pd-chaos', { detail: { kind: 'wall', amt: WAKE_AMT } })); }
    },
    stop() { e = null; },
  };
}
