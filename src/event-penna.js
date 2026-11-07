// "Fratelli La Penna": three invented brothers who sell pens at a silly price on the pavement in front of the steps of the Teatro Massimo (src/event-places.js PENNA), by day only.
// They are callers like the others (src/event-calls.js, kind 'penna'), but they do not wait for the lapa to stop: drive past within PASS_R of them and one steps into the road and stops it.
// The lapa is held still (vehicle.holdSim) while he says stop and asks PRICE euro for one pen, then it is let go and the card says how to answer:
//   stay put until the bar runs out: you pay. The wallet may go below zero (src/garage.js charge), and the HUD shows it in red with a minus sign.
//   drive off (faster than REFUSE_V, or REFUSE_D from where you were stopped): you refuse, and the three run after the lapa on foot.
// The chase: after REACT_T of disbelief they sprint (RUN_V, picking up speed at RUN_A, slower once TIRE_T has gone by), straight at the lapa while they can see it, else along the lapa's own
// track (crumbs dropped every CRUMB_D metres), so nobody runs through a building. Scripted sprites do not collide, so a touch is a brother within TOUCH_R of the lapa's centre line.
//   a touch: CAUGHT. The lapa stops on the spot and is held for CAUGHT_HOLD while they shout, and the pen is charged anyway (CAUGHT_PRICE). This is how the owner's "they stop you right away" is
//   read; the numbers below are the place to change it.
//   ESCAPE_D metres between the lapa and the nearest brother, or CHASE_T seconds without a touch (they run out of breath): you got away. That is the only ending the Missioni screen ticks.
// Every ending puts the slot on a COOL second cooldown, so passing the theatre again does not start it at once. The brothers walk back to the kerb and go when the lapa is far.
// The text is Palermitan written by an agent (PENNA_LINES and CALL.penna in assets/missions/lines.js, and the T(...) calls below): drafts for the owner to correct.
// createPennaEvents(X) -> { start(slot), update(dt), tick(dt), stop(), active(), state }   tick(dt) runs every frame, event or not (the brothers going home)
import { PENNA_LINES as PL } from '../assets/missions/lines.js';
import { garage } from './garage.js';
import { esc } from './esc.js';

export const PENNA_TITLE = 'Fratelli La Penna';
export const PENNA_LOOKS = ['vendor', 'vendor', 'vendor'];   // three of a kind, so they read as brothers: the crowd's generic street seller (assets/peds/sprites.js, white shirt, red apron); the first one stops the lapa
export const PENNA_COOL = 300;                                 // seconds before they are back on the kerb after any ending (src/missions.js endEvent reads slot.cool)
const PRICE = 150, CAUGHT_PRICE = PRICE;                       // euro for one pen, and what being caught costs
const STOP_T = 1.2, ASK_T = 3.4, CHOICE_T = 7, ASK_AT = 3.6, ASK_SIDE = 1.2;   // seconds: "stop!", the ask (the lapa is held until ASK_T), then the time to answer; where he asks: metres in front of the lapa and to its road side
const REFUSE_V = 3, REFUSE_D = 4;                              // m/s and metres: driving off
const REACT_T = 0.8, RUN_V = [11, 10.5, 10], RUN_A = 7, TIRE_T = 15, TIRE_K = 0.85;   // the chase on foot: seconds before they run, top speed of each brother (m/s), m/s^2, when they tire and by how much
const TOUCH_R = 1.0, HALF_L = 1.2;                             // a touch: a brother this close to the lapa's centre line, which runs HALF_L ahead of and behind its centre
const ESCAPE_D = 90, CHASE_T = 30;                             // metres from the nearest brother, seconds of chase
const CAUGHT_HOLD = 3.2, CARD_T = 4.2, CRUMB_D = 2.5, HOME_R = 140;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const priced = l => [l[0].replace('{price}', PRICE), l[1].replace('{price}', PRICE)];

export function createPennaEvents(X) {
  const { car, pedestrians, vehicle, T, hud, eur, speed, say } = X;
  let e = null, held = false;
  const home = [];   // brothers walking back to the kerb after an ending: { id, slot }
  const hold = on => { if (on !== held) { held = on; vehicle.holdSim?.(on); } if (on) { car.vx = car.vz = car.vf = 0; if ('w' in car) car.w = 0; } };   // on the spot: no speed left on the gauge either (as the police's busted hold)
  const headOf = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: X.groundAt(car.x, car.z) + 2.4, z: car.z }; };
  const wallet = () => { const c = garage.cash; return { t: T('Purtafogghiu ', 'Wallet ') + eur(c), neg: c < 0 }; };
  const fwd = () => [Math.sin(car.th), Math.cos(car.th)], side = () => [Math.cos(car.th), -Math.sin(car.th)];   // side: across the lapa (its left)
  // how far a point is from the lapa's centre line
  const lapaDist = (x, z) => {
    const [fx, fz] = fwd(), t = clamp((x - car.x) * fx + (z - car.z) * fz, -HALF_L, HALF_L);
    return Math.hypot(x - car.x - fx * t, z - car.z - fz * t);
  };

  function start(slot) {
    const ids = slot.callers.slice(); slot.callers = [];
    for (let k = ids.length; k < PENNA_LOOKS.length; k++) { const id = pedestrians.spawnScripted(PENNA_LOOKS[k], car.x + rand(-3, 3), car.z + rand(-3, 3)); if (id >= 0) ids.push(id); }
    const ks = slot.kerb ? Math.sign((slot.kerb.x - car.x) * side()[0] + (slot.kerb.z - car.z) * side()[1]) || 1 : 1;   // which side of the lapa the pavement is on
    e = { slot, phase: 'stop', t: 0, ks, at: { x: car.x, z: car.z }, bros: ids.map((id, k) => ({ id, k, v: 0, crumb: 0, losT: 0, direct: false })), crumbs: [], chaseT: 0, shoutT: 0, endT: 0, ok: false };
    hold(true);
    for (const b of e.bros) pedestrians.setBounce(b.id, false);
    // the stopper jumps out from the kerb into the road in front of the lapa, a step to its road side where the chase camera sees him past the cargo box (then walks up to it to ask, below);
    // the other two come round its sides, one on the pavement side, one on the road side
    const [fx, fz] = fwd(), [rx, rz] = side(), i0 = e.bros[0] && pedestrians.info(e.bros[0].id), f0 = i0 ? clamp((i0.x - car.x) * fx + (i0.z - car.z) * fz, ASK_AT, 9) : ASK_AT;
    const spot = [[f0, -ASK_SIDE], [0.8, 1.9], [-0.8, -2.0]], at = (s, ks2) => [car.x + fx * s[0] + rx * ks2 * s[1], car.z + fz * s[0] + rz * ks2 * s[1]];
    e.bros.forEach((b, k) => { const [x, z] = at(spot[k % 3], ks); pedestrians.walkTo(b.id, x, z, k ? 4.5 : 7); });
    e.spot = at;
    X.calls.hideBeacon(); X.setPhase('stop');
    if (e.bros[0]) say(pick(PL.stop), headOf(e.bros[0].id), 0.1);
    hud.toast(T('Ti fiaimmaru!', 'They stopped you!'), PENNA_TITLE, true);
  }

  function refuse() {
    e.phase = 'chase'; e.t = 0; e.chaseT = 0; X.setPhase('chase');
    hold(false);
    if (e.bros[0]) { const [x, z] = e.spot([ASK_AT, -2.8], e.ks); pedestrians.walkTo(e.bros[0].id, x, z, 7); }   // the one in front jumps out of the way
    e.crumbs = [{ x: e.at.x, z: e.at.z }];
    for (const b of e.bros) { pedestrians.face(b.id, car.x, car.z); b.crumb = 0; }
    if (e.bros[0]) say(PL.refuse[0], headOf(e.bros[0].id), 0);
    if (e.bros[1]) say(PL.refuse[1], headOf(e.bros[1].id), 0.7);
    hud.toast(T('Scappa!', 'Get away!'), T('Si ti tuccanu, ti fiaimmanu', 'If they touch you, they stop you'), true);
  }

  function pay() {
    e.phase = 'paid'; e.t = 0; X.setPhase('done');
    const took = garage.charge(PRICE);
    if (e.bros[0]) say(pick(PL.paid), headOf(e.bros[0].id), 0.2);
    say(pick(PL.driverPaid), X.driverPos, 2.4);
    card(T('Na pinna', 'One pen'), took);
    e.endT = CARD_T + 0.6;
  }

  function caught(b) {
    e.phase = 'caught'; e.t = 0; X.setPhase('done');
    hold(true);   // the lapa halts on the spot
    const took = CAUGHT_PRICE > 0 ? garage.charge(CAUGHT_PRICE) : 0;
    say(PL.caught[0], headOf(b.id), 0.1);
    const o = e.bros.find(x => x !== b); if (o && PL.caught[1]) say(PL.caught[1], headOf(o.id), 1.6);
    // the others come up round the lapa
    const [rx, rz] = side();
    e.bros.forEach((x, k) => { if (x !== b) pedestrians.walkTo(x.id, car.x + rx * (k % 2 ? 2 : -2), car.z + rz * (k % 2 ? 2 : -2), 6); else pedestrians.face(x.id, car.x, car.z); });
    hud.toast(T('Pigghiatu!', 'Caught!'), T('A pinna a paghi u stissu', 'You pay for the pen all the same'), true);
    card(T('A pinna, u stissu', 'The pen, all the same'), took, T("T'aggranfaru!", 'Caught!'));
    e.endT = Math.max(CAUGHT_HOLD, CARD_T) + 0.4;
  }

  function escaped() {
    e.phase = 'escaped'; e.t = 0; e.ok = true; X.setPhase('done');
    let best = null, bd = 1e9; for (const b of e.bros) { const i = pedestrians.info(b.id); if (!i) continue; const d = Math.hypot(i.x - car.x, i.z - car.z); if (d < bd) { bd = d; best = b; } }
    if (best && bd < 70) say(pick(PL.escaped), headOf(best.id), 0.1);
    for (const b of e.bros) { const i = pedestrians.info(b.id); if (i) pedestrians.walkTo(b.id, i.x, i.z, 1); }   // they stop where they are, out of breath
    hud.toast(T('Scappasti!', 'You got away!'), T('A pinna arresta a iddi', 'They keep their pen'));
    hud.result(`<h3>${esc(T('Scappasti!', 'You got away!'))}</h3>
      <div class="row"><span>${esc(PENNA_TITLE)}</span><span>${esc(T('a mani vacanti', 'empty-handed'))}</span></div>
      <div class="row tot"><span>${esc(T('Purtafogghiu', 'Wallet'))}</span><span class="${garage.cash < 0 ? 'neg' : ''}">${eur(garage.cash)}</span></div>`, CARD_T);
    hud.burst();
    e.endT = CARD_T;
  }

  function card(what, took, head) {
    const c = garage.cash;
    hud.result(`<h3>${esc(head || PENNA_TITLE)}</h3>
      <div class="row"><span>${esc(what)}</span><span class="neg">${eur(-took)}</span></div>
      <div class="row tot"><span>${esc(T('Purtafogghiu', 'Wallet'))}</span><span class="${c < 0 ? 'neg' : ''}">${eur(c)}</span></div>`, CARD_T);
  }

  // a brother runs: straight at the lapa while he sees it, else along the crumbs of its track
  function run(b, dt) {
    const i = pedestrians.info(b.id); if (!i) return;
    const top = RUN_V[b.k % RUN_V.length] * (e.chaseT > TIRE_T ? TIRE_K : 1);
    b.v = Math.min(top, b.v + RUN_A * dt);
    b.losT -= dt;
    if (b.losT <= 0) {
      b.losT = 0.25;
      const d = Math.hypot(car.x - i.x, car.z - i.z);
      b.direct = d < 70 && X.pathClear(i.x, i.z, car.x, car.z);
      if (b.direct) b.crumb = e.crumbs.length - 1;
      else for (let j = Math.min(e.crumbs.length - 1, b.crumb + 14); j > b.crumb; j--) if (X.pathClear(i.x, i.z, e.crumbs[j].x, e.crumbs[j].z)) { b.crumb = j; break; }   // the farthest crumb he can see
    }
    let tx, tz;
    if (b.direct) { tx = car.x + car.vx * 0.25; tz = car.z + car.vz * 0.25; }
    else {
      const c = e.crumbs[b.crumb]; tx = c.x; tz = c.z;
      if (Math.hypot(tx - i.x, tz - i.z) < 1.2 && b.crumb < e.crumbs.length - 1) { b.crumb++; const n = e.crumbs[b.crumb]; tx = n.x; tz = n.z; }
    }
    pedestrians.walkTo(b.id, tx, tz, Math.max(0.5, b.v));
  }

  function update(dt) {
    if (!e) return;
    e.t += dt;
    const sp = speed();
    if (e.phase === 'stop' || e.phase === 'ask') {
      if (e.phase === 'stop' && e.t >= STOP_T) { e.phase = 'ask'; X.setPhase('ask'); if (e.bros[0]) { const [x, z] = e.spot([ASK_AT, -ASK_SIDE], e.ks); pedestrians.walkTo(e.bros[0].id, x, z, 2.5); say(priced(pick(PL.ask)), headOf(e.bros[0].id), 0.3); } }   // he walks up to the lapa to ask
      if (e.t >= ASK_T) { e.phase = 'choice'; e.t = 0; X.setPhase('choice'); hold(false); e.at = { x: car.x, z: car.z }; }
      hud.set({ label: PENNA_TITLE, title: eur(PRICE) + T(' pi na pinna', ' for a pen'), sub: '', time: '', frac: null, target: null, ledger: [wallet()] });
      X.aim(0, 0, false);
      return;
    }
    if (e.phase === 'choice') {
      for (const b of e.bros) if ((pedestrians.info(b.id) || {}).state === 'stand') pedestrians.face(b.id, car.x, car.z);
      if (sp > REFUSE_V || Math.hypot(car.x - e.at.x, car.z - e.at.z) > REFUSE_D) { refuse(); return; }
      if (e.t >= CHOICE_T) { pay(); return; }
      const left = CHOICE_T - e.t;
      hud.set({ label: PENNA_TITLE, title: eur(PRICE) + T(' pi na pinna', ' for a pen'), sub: T('Arresta fermu: paghi · Scappa: un paghi', 'Stay put: you pay · Drive off: you do not'), time: '0:0' + Math.ceil(left), low: left < 3, frac: left / CHOICE_T, target: null, ledger: [wallet()] });
      X.aim(0, 0, false);
      return;
    }
    if (e.phase === 'chase') {
      e.chaseT += dt;
      const last = e.crumbs[e.crumbs.length - 1];
      if (Math.hypot(car.x - last.x, car.z - last.z) > CRUMB_D) e.crumbs.push({ x: car.x, z: car.z });
      let near = 1e9, nb = null;
      for (const b of e.bros) {
        if (e.t >= REACT_T) run(b, dt); else pedestrians.face(b.id, car.x, car.z);
        const i = pedestrians.info(b.id); if (!i) continue;
        const d = Math.hypot(i.x - car.x, i.z - car.z); if (d < near) { near = d; nb = b; }
        if (e.t >= REACT_T && lapaDist(i.x, i.z) < TOUCH_R) { caught(b); return; }
      }
      if ((e.shoutT -= dt) <= 0 && e.t > 2 && nb && near < 70) { e.shoutT = rand(2.6, 4.2); say(pick(PL.chase), headOf(nb.id), 0); }
      if (!nb || near > ESCAPE_D || e.chaseT > CHASE_T) { escaped(); return; }
      const left = Math.max(0, CHASE_T - e.chaseT);
      hud.set({ label: PENNA_TITLE, title: T('Scappa!', 'Get away!'), sub: T('U cchiù vicinu: ', 'Nearest: ') + Math.round(near) + ' m · ' + T('scappi a ', 'free at ') + ESCAPE_D + ' m', time: '0:' + String(Math.ceil(left)).padStart(2, '0'), low: near < 15, frac: clamp(near / ESCAPE_D, 0, 1), target: null, ledger: [wallet()] });
      X.aim(0, 0, false);
      return;
    }
    // an ending: the card, the hold while they shout (caught), then the event is over
    if (e.phase === 'caught' && e.t >= CAUGHT_HOLD) hold(false);
    X.aim(0, 0, false);
    hud.set({ label: PENNA_TITLE, title: e.phase === 'escaped' ? T('Scappasti!', 'You got away!') : e.phase === 'caught' ? T('Pigghiatu!', 'Caught!') : T('Pagasti', 'You paid'), sub: '', time: '', frac: null, target: null, ledger: [wallet()] });
    if (e.t >= e.endT) X.endEvent(e.ok);
  }

  // every frame: brothers left after an ending walk back to their kerb and go once the lapa is far
  function tick() {
    for (let k = home.length - 1; k >= 0; k--) {
      const h = home[k], i = pedestrians.info(h.id);
      if (!i || Math.hypot(i.x - car.x, i.z - car.z) > HOME_R || Math.hypot(h.slot.x - car.x, h.slot.z - car.z) > HOME_R * 1.5 || X.now() >= h.slot.coolUntil) { pedestrians.remove(h.id); home.splice(k, 1); }
    }
  }

  function stop() {
    if (!e) return;
    hold(false);
    const s = e.slot, kb = s.kerb || { x: s.x, z: s.z };
    for (const b of e.bros) { if (!pedestrians.info(b.id)) continue; pedestrians.walkTo(b.id, kb.x + s.dx * (b.k - 1) * 1.5, kb.z + s.dz * (b.k - 1) * 1.5, 1.3); home.push({ id: b.id, slot: s }); }
    e = null;
  }

  return { start, update, tick, stop, active: () => !!e, get state() { return e; } };
}
