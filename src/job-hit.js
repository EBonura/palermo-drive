// The hit job (a job module of the director, docs/missions-director.md): a shady character rings and wants N people knocked over in a time limit. "Prendi tot persone di petto."
// Nobody to meet, so the offer is instant: it starts the moment the call is answered, wherever the lapa is. The count is the police's own 'pd-chaos' of kind 'knock' (src/police.js
// sends one for each person sent flying, already thinned there), so the loose 0.25 euro a hit (src/hit-pay.js) is still paid on top while the job runs.
//   N is 5 to 10 people at random, the time is about 6 s each plus a margin (JITTER scales it a little at random); the pay is PER_HEAD euro each plus BASE, 35 to 60 euro in all,
//   shown on the card and paid in full by X.addFare when the last one goes down (it is final euro, not multiplied by PAY_X: the card says what the wallet gets). Time out: nothing.
//   Offered only where there are people: pedestrians.near() counts the crowd within CROWD_R metres of the lapa (the crowd only exists around the camera, so this is "right here"),
//   and find returns null under CROWD_MIN, so the fast roads and the empty hills never ring this one.
//   The leash (src/missions.js) must not fail it for driving round looking for people: the slot gives a leash of LEASH_R metres round where the lapa was when it started.
// Nothing is built, drawn or listened to while the job is not running except one 'pd-chaos' listener that returns at once. The words are Palermitan in the owner's spelling, drafted from his rulings and passed by him on 22 Nov 2026.
// setup(X): called once by src/jobs.js.
import { esc } from './esc.js';

const MIN_N = 5, MAX_N = 10;            // people to knock over
const PER_PERSON = 6, MARGIN = 10, JITTER = 0.2;   // seconds each, seconds on top, and how much the per-person time may wander (+-)
const BASE = 10, PER_HEAD = 5;          // euro: 35 for five people, 60 for ten
const CROWD_R = 60, CROWD_MIN = 8;      // metres and people: the crowd round the lapa that makes it a place for this job
const LEASH_R = 3000;                   // metres from where it started: effectively never (the time limit is the end of it)
const CARD_T = 4.2, LOW_T = 10;         // seconds the result card stays, and when the clock turns red

export default function setup(X) {
  const { car, T, hud, eur } = X;
  const slot = { id: 'hit:1', kind: 'hit', sub: 'hit', name: 'Lavoretto', x: 0, z: 0, dx: 0, dz: 1, w: 6, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null,
    leash: () => ({ a: [slot.ox, slot.oz], b: [slot.ox, slot.oz], r: LEASH_R }), ox: 0, oz: 0 };
  let job = null, e = null;     // job: what the ringing card promised { n, secs, pay }; e: the event while it runs
  const hudO = { label: '', title: '', sub: '', time: '', low: false, frac: 0, target: null }, rnd = (a, b) => a + Math.random() * (b - a);

  addEventListener('pd-chaos', ev => { if (e && e.phase === 'run' && ev.detail && ev.detail.kind === 'knock') e.got++; });

  X.director.add('hit', () => {
    if (!X.pedestrians.near || X.pedestrians.near(car.x, car.z, CROWD_R) < CROWD_MIN) return null;
    const n = MIN_N + ((Math.random() * (MAX_N - MIN_N + 1)) | 0), secs = Math.round(n * PER_PERSON * rnd(1 - JITTER, 1 + JITTER) + MARGIN), pay = BASE + n * PER_HEAD;
    job = { n, secs, pay };
    slot.x = car.x; slot.z = car.z;
    return { slot, instant: true, ped: 'tuta', col: '#ff5a4a', tag: T('Travagghieddu', 'Job'), pay, who: 'Nino',
      line: T(`Pigghia ri piattu ${n} cristiani nta ${secs} sicunni. Nianti dumanni.`, `Knock ${n} people over in ${secs} seconds. No questions.`),
      note: T('si ci a fai', 'if you make it'),
      where: T('uora uora', 'right now'),
      drop: () => { job = null; } };
  });

  const put = () => {   // the card of the running job: the strings are rebuilt only when a number changes
    const left = Math.max(0, Math.ceil(e.secs - e.t));
    if (left !== e.shownT || e.got !== e.shownN) {
      e.shownT = left; e.shownN = e.got;
      hudO.label = T('Travagghieddu', 'Job');
      hudO.title = T('Pigghiali ri piattu', 'Knock them over');
      hudO.sub = `${Math.min(e.got, e.n)} / ${e.n}  ·  ${eur(e.pay)}`;
      hudO.time = left + ' s';
    }
    hudO.low = e.secs - e.t < LOW_T; hudO.frac = (e.secs - e.t) / e.secs;
    hud.set(hudO);
  };

  const finish = ok => {
    e.phase = 'done'; e.t = 0; e.ok = ok; e.hold = ok ? CARD_T : 3.4; X.setPhase('done');
    if (ok) {
      X.addFare(e.pay);
      hud.result(`<h3>${T('Fattu!', 'Done!')}</h3>
        <div class="row"><span>${T('Cristiani nterra', 'People down')}</span><span>${e.n}</span></div>
        <div class="row tot"><span>${T('Picciuli', 'Pay')}</span><span>${esc(eur(e.pay))}</span></div>`, CARD_T);
      hud.burst();
    } else hud.result(`<h3>${T('Truappu lientu', 'Too slow')}</h3>
        <div class="row"><span>${T('Cristiani nterra', 'People down')}</span><span>${e.got} / ${e.n}</span></div>
        <div class="row"><span>${T('Nino un paga', 'Nino does not pay')}</span><span></span></div>`, 3.4);
  };

  X.kinds.hit = {
    start(s) {
      const j = job || { n: MIN_N, secs: 45, pay: BASE + MIN_N * PER_HEAD };   // started without a call (a test): the smallest one
      job = null; s.ox = car.x; s.oz = car.z;
      e = { ...j, phase: 'run', t: 0, got: 0, shownT: -1, shownN: -1 };
      X.setPhase('run');
      hud.toast(T(`${j.n} cristiani, ${j.secs} sicunni`, `${j.n} people, ${j.secs} seconds`), T('Amunì!', 'Go!'));
    },
    update(dt) {
      if (!e) return;
      e.t += dt;
      if (e.phase === 'run') {
        if (e.got >= e.n) finish(true); else if (e.t >= e.secs) finish(false); else put();
      } else if (e.t >= e.hold) { const ok = e.ok; e = null; X.endEvent(ok); }
    },
    stop() { e = null; hudO.target = null; },
  };
}
