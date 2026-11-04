// "Bbaiecca 'a munnizza, e a chi ci sì bbaieccati puru tu": the landfill mission (docs/discarica.md), day or night. A caller on Via Bellolampo dares the player to throw the lapa into the
// landfill: drive up the service road (the baked line, src/event-routes.js ROUTES.dump, lets the guide draw it), through the open gate of the yard (src/discarica.js), along the gravel
// track to the pad and over the rim of the pit. It is a win the moment the lapa is in the pit, by a jump from speed, a slow roll or a drive over the edge at a crawl: the plunge itself is
// the ball model's (hooks.plunge, src/discarica.js), this module watches the depth of the pit under the lapa (src/discarica-ground.js dumpDepth). Then the camera backs off for the fall,
// the crash throws rubbish up (src/discarica.js), the lapa lands on the floor, the card pays, and the screen is covered while the lapa is put back on the service road (a lift, as the
// owner would say) so nobody is left in the pit. A miss, a stop at the rim or a long wait cost nothing but the clock: the lapa can always back away, the pit is never a trap that can
// not be left, and the leash and the clock end the mission like any other. The text is Palermitan written by an agent: it is all in assets/missions/lines.js (DUMP_LINES, CALL.dump) and in
// the T(...) calls below, for the owner to correct; the title is the owner's.
// createDumpEvents(X, dump) -> { start(slot), update(dt), stop(), leashed(), active() }
import { DUMP_LINES as DL } from '../assets/missions/lines.js';
import { SNAP } from './event-routes.js';
import { PIT, YARD, FLOOR_D, dumpDepth } from './discarica-ground.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
export const DUMP_TITLE = "Bbaiecca 'a munnizza, e a chi ci sì bbaieccati puru tu";   // the owner's title, exactly as written
const GIVE_T = 3.4, MOMENT_T = 0.5, STAY_T = 1.3, FALL_MAX = 6.5, CARD_T = 4.6, JUMP_V = 8;   // JUMP_V: m/s at the rim from which it is a jump and not a roll

export function createDumpEvents(X, dump) {
  const { car, pedestrians, T, hud, eur, speed, say, vehicle } = X;
  let e = null, token = 0;
  const mmss = m => Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const dist = (x, z) => { const d = Math.hypot(x - car.x, z - car.z); return d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m'; };
  const headOf = id => () => { const i = pedestrians.info(id); return i ? { x: i.x, y: i.y + 1.95, z: i.z } : { x: car.x, y: X.groundAt(car.x, car.z) + 2.4, z: car.z }; };
  const rim = () => { const s = SNAP['dump:rim']; return s ? { x: s[0], z: s[1] } : { x: PIT.x - 48, z: PIT.z }; };
  const inYard = () => car.x > YARD.x0 - 6 && car.x < YARD.x1 + 6 && car.z > YARD.z0 - 6 && car.z < YARD.z1 + 6;
  const moment = k => { if (vehicle && vehicle.camMoment) vehicle.camMoment(k); };

  function start(slot) {
    const R = X.ROUTES.dump[0], limit = R[1] / 9 + 55;   // the same pace as the rave: length / 9 m/s and 55 s over
    e = { slot, phase: 'give', len: R[1], limit, left: limit, t: 0, cit: slot.callers[0] !== undefined ? slot.callers[0] : -1, told: false, atYard: false, fallT: 0, mom: 0, pay: 0, thanks: 0, base: 0, bonus: 0, jump: 0, floorSaid: false, recovering: false };
    slot.callers = [];
    if (e.cit < 0 || !pedestrians.info(e.cit)) e.cit = pedestrians.spawnScripted('tuta', car.x + Math.cos(car.th) * 2.6, car.z - Math.sin(car.th) * 2.6);
    if (e.cit >= 0) { pedestrians.face(e.cit, car.x, car.z); pedestrians.setBounce?.(e.cit, true); }
    X.calls.hideBeacon(); X.setPhase('give'); dump.hold(true); dump.state.lip = 0; token++;
    hud.toast(T("Bbaiecca 'a munnizza!", 'Throw yourself in the rubbish!'), T('Discarica ri Bellolampo', 'Bellolampo landfill'));
  }
  function begin() {
    const R = X.ROUTES.dump[0], r = rim();
    e.phase = 'go'; e.left = e.limit; X.setPhase('go'); X.guide.path(R[2]);
    X.destBeacon.set(r.x, r.z); X.destBeacon.show(true); X.destMarker = X.addMarker(r.x, r.z, '#8a6a3a', 8, 'target');
    hud.toast(T('Â discarica!', 'To the landfill!'), T('Pi Via Bellolampo', 'Up Via Bellolampo'));
  }
  const label = () => DUMP_TITLE;
  function win() {   // the lapa is in the pit
    e.phase = 'fall'; e.fallT = 0; X.setPhase('done');   // 'done': no leash, no arrow
    X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; } X.guide.off(); X.aim(0, 0, false);
    hud.toast(T('Bbaiecca!', 'Throw yourself!'), '');
    say(pick(DL.fall), X.driverPos, 0.1);
  }
  function updateE(dt) {
    e.t += dt;
    const F = dump.state;
    if (e.phase === 'give') {
      if (!e.told && e.t > 0.3) { e.told = true; if (e.cit >= 0) { say(pick(DL.give), headOf(e.cit), 0); say(pick(DL.sendoff), headOf(e.cit), 2.2); } }
      X.aim(0, 0, false);
      hud.set({ label: label(), title: T('Â discarica!', 'To the landfill!'), sub: '', time: '', frac: null, target: null });
      if (e.t > GIVE_T) begin();
      return;
    }
    if (e.phase === 'go') {
      e.left -= dt;
      const r = rim();
      if (dump.inPit()) { win(); return; }
      if (!e.atYard && inYard()) { e.atYard = true; hud.toast(T('Bbaiecca!', 'Throw yourself in!'), T('Ddà ’n funnu', 'Down there')); say(pick(DL.rim), X.driverPos, 0.6); }
      if (e.left <= 0) { finish(false, 'late'); return; }
      if (e.atYard) X.aim(PIT.x, PIT.z, true); else X.aim(r.x, r.z, true);
      hud.set({ label: label(), title: e.atYard ? T('’A vasca', 'The cell') : T('Discarica ri Bellolampo', 'Bellolampo landfill'), sub: dist(e.atYard ? PIT.x : r.x, e.atYard ? PIT.z : r.z), time: mmss(Math.max(0, e.left)), low: e.left < 40, frac: e.left / e.limit, target: e.atYard ? { x: PIT.x, z: PIT.z } : r });
      return;
    }
    if (e.phase === 'fall') {
      e.fallT += dt;
      e.mom += (1 - e.mom) * Math.min(1, dt / MOMENT_T * 3); moment(e.mom);
      X.aim(0, 0, false);
      hud.set({ label: label(), title: T('Bbaiecca!', 'Throw yourself!'), sub: '', time: '', frac: null, target: null });
      const dep = dumpDepth(car.x, car.z), onFloor = dep >= FLOOR_D - 2 && !F.air;
      if (onFloor) { e.floorT = (e.floorT || 0) + dt; if (!e.floorSaid) { e.floorSaid = true; say(pick(DL.land), X.driverPos, 0.7); } }
      if ((onFloor && e.floorT > STAY_T) || e.fallT > FALL_MAX || (e.fallT > 3.4 && !F.air && dep >= dump.IN_PIT)) finish(true);
      return;
    }
    // done: the card, then the screen is covered while the lapa is put back on the road, then the mission ends
    X.aim(0, 0, false);
    if (e.pay > 0) hud.set({ label: label(), title: T('Bravu!', 'Well done!'), sub: '', time: '', frac: null, target: null });
    if ((e.thanks -= dt) <= 0 && !e.recovering) {
      e.recovering = true; const my = token, ok = e.pay > 0; moment(0);
      if (ok || dump.inPit()) dump.recover().then(() => { if (my === token && e) X.endEvent(ok); });
      else X.endEvent(ok);
    }
  }
  function finish(ok, why) {
    const F = dump.state;
    e.phase = 'done'; X.setPhase('done'); X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; } X.guide.off();
    if (!ok) {
      e.thanks = 3.6;
      hud.result(`<h3>${T('Taiddu assai!', 'Far too late!')}</h3><div class="row"><span>${T('A munnizza s’a pigghiau n’autru', 'Somebody else took the rubbish')}</span></div>`, 3);
      say(pick(DL.fail), X.driverPos, 0.4); return;
    }
    const jumped = F.lip >= JUMP_V, base = 10 + Math.round(e.len / 500), bonus = Math.round(6 * clamp(e.left / e.limit, 0, 1) * 2) / 2, jump = jumped ? 3 : 0, total = base + bonus + jump;
    e.pay = total; e.thanks = CARD_T; e.base = base; e.bonus = bonus; e.jump = jump; X.addFare(total, 'food');
    const what = jumped ? T('Sautu ri classi ’nta vasca!', 'A proper jump into the cell!') : T('Ti rruzzuliasti ’nta vasca', 'You rolled into the cell');
    hud.result(`<h3>${esc(DUMP_TITLE)}</h3>
      <div class="row"><span>${what}</span><span></span></div>
      <div class="row"><span>${T('Sì ’nta munnizza finu ô coddu', 'Neck deep in the rubbish')}</span><span></span></div>
      <div class="row"><span>${T('Paga', 'Pay')}</span><span>${eur(base)}</span></div>
      ${bonus ? `<div class="row"><span>${T('Priestu!', 'In good time!')}</span><span>+ ${eur(bonus)}</span></div>` : ''}
      ${jump ? `<div class="row"><span>${T('Sautu', 'Jump')}</span><span>+ ${eur(jump)}</span></div>` : ''}
      <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, CARD_T);
    hud.burst();
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function update(dt) { if (!e) return; updateE(dt); }
  function stop() {
    if (!e) return;
    if (e.cit >= 0) pedestrians.remove(e.cit);
    X.destBeacon.show(false); if (X.destMarker) { X.dropMarker(X.destMarker); X.destMarker = null; }
    X.guide.off(); moment(0); dump.hold(false); token++; e = null;
  }
  // the leash ended the mission (src/missions.js failEvent)
  function leashed() { if (e && e.phase !== 'done') moment(0); }
  return { start, update, stop, leashed, active: () => !!e, get state() { return e; } };
}
