// The director: jobs are no longer people waiting on fixed kerbs, they reach the lapa as calls while it drives (the owner's overhaul of 22 Nov 2026).
// The rule of the house is that something happens every BEAT seconds of free driving. On a beat the director draws a job type from a shuffled deck (one card per type, dealt
// until it is empty, then shuffled again: every type comes up as often as any other however many places it has, and never twice in a row), looks for a place of that type near
// the lapa and rings: the call card (src/call-card.js) says who it is, where, and what it pays. Answer, and the caller is at their place, with the route to them; ignore it and
// nothing is lost. The encounters (the pen sellers, the races, the rave, the landfill, the pubs) are not jobs: they stay at their places and never ring.
// createDirector(X, { slots, fares, card }) -> { update(dt, idle), taken(), cancel(), add(type, find), place(kind, far, ok), face(slot), state }
//   A new job type is one module that calls director.add (and, when it runs its own event, sets X.kinds[kind] = { start(slot), update(dt), stop(), tick(dt) }): see docs/missions-director.md.
//   X.offer is the slot whose call was answered: src/event-calls.js puts a caller on a job's kerb only for that one.
// Test link: ?call rings 3 s after the start instead of FIRST (and ?call=<type> asks for that type first: food, fare, urgent or one a module added; &street makes every ride one from anywhere).
import { JOBS, KIND_COLOR } from './event-calls.js';
import { PAY_X } from './economy.js';
import { createStreetFares } from './fare-street.js';

const BEAT = 40, FIRST = 15, AFTER = 25;     // seconds of free driving before a call: the rule, the first one of a session, the one after a job
const RING = 9;                              // seconds the card stays
const NEAR = 90, FAR = 900, BEST = 350;      // metres: how close and how far the place of a call may be, and the distance liked best
const FAR_OUT = 1800;                        // when no job of any type is within FAR (the outer quarters have few places), one this far will do
const LOST_D = 500, LOST_T = 200;            // an answered call is lost when the lapa is this much farther from the caller than it was, or after this long
const STREET = 0.35;                         // how often a ride is one from anywhere (src/fare-street.js) even when a fixed kerb is within reach
const FOOD_MAX = 25 * PAY_X;                 // what a full food hunt pays (src/event-food.js: ten items at 1.5 and the bonus of 10, times PAY_X)

export function createDirector(X, { slots, fares, card }) {
  const { car, T, hud, speed } = X;
  let ask = X.params.get('call');
  const st = { mode: 'wait', t: X.params.has('call') ? FIRST - 3 : 0, beat: FIRST, offer: null, slot: null, d0: 0, last: null };
  // The job types. add(type, find): find(far) looks for a job of that type for where the lapa is now and returns an offer, or null when there is none:
  //   { slot, who, line, pay, note (small words beside the pay), where (shown before the distance), ped (a cast id or a cast number), col, instant, drop() }
  //   slot: { id, kind, x, z, ... } the event slot that src/missions.js starts. A slot with a caller (one of the slots of src/event-calls.js, its kind in JOBS) starts when the lapa
  //   stops next to them, as ever. instant: true starts it the moment the call is answered (a job with nobody to meet: X.start(slot), handled by X.kinds[slot.kind]).
  //   drop(): the call was not answered or was lost, undo what find() prepared.
  const makers = [];
  const add = (type, find) => { makers.push({ type, find }); };
  let deck = [];
  const dist = s => Math.hypot(car.x - s.x, car.z - s.z);
  function deal() {   // the next type: the deck, shuffled, the first card never the one just played
    if (ask) { const a = ask; ask = null; if (makers.some(m => m.type === a)) return a; }
    if (!deck.length) { deck = makers.map(m => m.type); for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; } if (deck.length > 1 && deck[deck.length - 1] === st.last) deck.unshift(deck.pop()); }
    return deck.pop();
  }
  // the place of a call: of that kind, open now, not too near and not too far; ahead of the lapa and about BEST metres away is liked best, one of the best three is taken.
  // place(kind, far, ok): ok(slot) narrows it further. Exported on the director for the job modules.
  function place(kind, far = FAR, ok) {
    const t = X.now(), night = X.isNight(), fx = Math.sin(car.th), fz = Math.cos(car.th), c = [];
    for (const s of slots) {
      if (s.kind !== kind || t < s.coolUntil || (s.night && !night) || (s.day && night) || (ok && !ok(s))) continue;
      const d = dist(s); if (d < NEAR || d > far) continue;
      c.push([Math.abs(d - BEST) + (((s.x - car.x) * fx + (s.z - car.z) * fz) < 0 ? 250 : 0), s]);
    }
    c.sort((a, b) => a[0] - b[0]);
    return c.length ? c[(Math.random() * Math.min(3, c.length)) | 0][1] : null;
  }
  // the face on the card is the very person who will stand on the kerb: face(slot) chooses them (slot.offerPed the cast id, slot.offerV the cast number) and returns what the card wants
  function face(s) { s.offerPed = X.calls.variantFor(s); const vs = X.pedestrians.variantsOf?.(s.offerPed) || []; s.offerV = vs.length ? vs[(Math.random() * vs.length) | 0] : -1; return s.offerV >= 0 ? s.offerV : s.offerPed; }
  const unface = s => { s.offerPed = null; s.offerV = -1; s.quoted = null; };
  const streets = createStreetFares(X);
  // the three jobs that were callers on fixed kerbs: a taxi ride, an urgent run, a lost food hunt
  // A ride (taxi or urgent) is also made from anywhere: a passenger put on a road near the lapa, when no fixed kerb is within reach and now and then when one is.
  for (const type of JOBS) add(type, far => {
    let s = place(type, far, o => !o.street);
    if (type !== 'food' && (!s || X.params.has('street') || Math.random() < STREET)) s = (type === 'fare' ? streets.taxi() : streets.urgent()) || s;
    if (!s) return null;
    const q = type === 'food' ? { pay: FOOD_MAX, note: T('ô massimu', 'at most') } : fares.quote(s); if (!q) return null;
    return { slot: s, ped: face(s), col: KIND_COLOR[s.kind], pay: q.pay, note: q.note || T('cchiù i manci', 'plus tips'), where: q.dest ? '→ ' + q.dest : '', drop: () => unface(s),
      who: type === 'food' ? s.who : s.title || (type === 'urgent' ? s.name : T('Un passiggeri', 'A passenger')), line: X.calls.lineFor(s) };
  });
  function ring() {
    const n0 = makers.length;
    for (let n = 0; n < n0 * 2; n++) {   // a type with nothing near here gives its turn to the next card; a whole round with none, and the second round looks farther
      const type = deal(), m = makers.find(k => k.type === type), o = m && m.find(n < n0 ? FAR : FAR_OUT); if (!o) continue;
      const far = o.instant ? '' : Math.round(dist(o.slot) / 10) * 10 + ' m';
      card.show({ ped: o.ped, col: o.col || KIND_COLOR[o.slot.kind], secs: RING, pay: o.pay, note: o.note || '', who: o.who, line: o.line, where: [o.where, far].filter(Boolean).join('  ·  ') });
      st.mode = 'ring'; st.offer = o; st.slot = o.slot; st.last = type; return true;
    }
    return false;
  }
  const drop = () => { st.offer?.drop?.(); if (X.offer) { X.offer = null; X.guide.off(); } st.offer = st.slot = null; st.mode = 'wait'; st.t = 0; };
  function update(dt, idle) {
    if (!idle) { if (st.mode !== 'wait') { card.hide(); drop(); } st.beat = AFTER; return; }
    if (st.mode === 'wait') {
      if (car.type === 'sulky') return;
      st.t += dt;
      if (st.t >= st.beat && speed() > 3) { if (ring()) st.beat = BEAT; else st.t = st.beat - 8; }   // nothing near: ask again in a moment
    } else if (st.mode === 'ring') {
      const r = card.update(dt);
      if (r === 'yes') {
        const o = st.offer, s = o.slot;
        if (o.instant) { st.offer = st.slot = null; st.mode = 'wait'; st.t = 0; X.start(s); }
        else { X.offer = s; s.coolUntil = 0; st.mode = 'go'; st.t = 0; st.d0 = dist(s); X.guide.to(s.x, s.z); }
      } else if (r === 'gone') drop();
    } else {   // the call was answered: the way to the caller, until the lapa stops next to them (src/event-calls.js starts the job) or gives up
      const o = st.offer, s = o.slot, d = dist(s); st.t += dt;
      if (d > st.d0 + LOST_D || st.t > LOST_T) { hud.toast(T('Si siddiò r’aspittari', 'Call lost'), '', true); drop(); return; }
      X.aim(s.x, s.z, true);
      hud.set({ label: T('Chiamata', 'Call'), title: o.who, sub: Math.round(d) + ' m  ·  ' + X.eur(o.pay), time: '', frac: null, target: { x: s.x, z: s.z } });
    }
  }
  // a job or an encounter starts: the call, answered or still ringing, is over (the slot keeps what was quoted if it is the one that starts)
  function taken(slot) { card.hide(); if (st.offer && st.slot !== slot) st.offer.drop?.(); else if (st.slot) { st.slot.offerPed = null; st.slot.offerV = -1; } if (X.offer) X.guide.off(); X.offer = null; st.offer = st.slot = null; st.mode = 'wait'; st.t = 0; }
  return { update, taken, add, place, face, streets, cancel: () => { card.hide(); drop(); }, state: st };
}
