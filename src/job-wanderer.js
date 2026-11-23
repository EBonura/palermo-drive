// The Sicilian Wanderer (the director's job type 'wanderer', docs/missions-director.md): a likeness cameo of a Sicilian creator, a friend of the owner (src/wanderer.js). He stands in Piazza Garraffello,
// in the Vucciria, filming on his phone, and his call says who he is: THE SICILIAN WANDERER, in the call card, over his head, in the HUD and in the result.
//   call: answer it, the route leads to Piazza Garraffello. Stop near him: he gets in. Drive him a good stretch to the Castello della Zisa (about two kilometres), where he gets out and talks to camera
//   ("ciao a tutti amici, oggi vi porto a scoprire..."). Then he looks at the footage: the light was bad, the video did not come out, and he asks to go back to the start to do the shot again.
//   Back at Piazza Garraffello he is happy this time, pays and walks back to his spot, filming again. A bump (a wall, a person, a hard stop) shakes his video: he complains, and the steady-footage bonus shrinks.
//   pay: a taxi ride of both legs (src/event-fares.js basePay: (4 + len / 110) * PAY_X, to the half euro) plus up to 40 percent for steady footage (5 bumps and it is gone). There is no clock, the leash
//   (src/missions.js) is the only way to fail it. Nothing is built while the job is not running except the slot record; the name tag is src/wanderer.js's one sprite.
// He is a scripted pedestrian that src/wanderer.js owns: grab() takes him, give() lets him go. The words are [italian, english] pairs, Palermitan rewritten by me on 23 Nov 2026 to match the spelling of assets/missions/lines.js and the owner's rulings (puaittari, biedda, ccà, Paliaimmu, tuinnari, ntô, ’nu, ’na, grazzi, accura, araciu): still a DRAFT for him to correct.
// setup(X): called once by src/jobs.js.
import { PAY_X } from './economy.js';
import { WANDERER_NAME } from './wanderer.js';
import { esc } from './esc.js';

const CHANNEL = 'https://www.youtube.com/@TheSicilianWanderer';
const COL = '#e8a33d';                                  // his colour: the pill of the call card
const DEST = { name: 'Castello della Zisa', lat: 38.1161147, lon: 13.3411786 };   // the same point as the 'zisa' of TAXI_DESTS (src/event-places.js), about 2 km from Piazza Garraffello; its road point is found with X.snapRoad
const ROAD_K = 1.45, BUMP_CD = 2.4, BUMP_DECEL = 14, DROP_T = 9, COOL = 420;   // the result card stays long enough to tap the channel link
const pick = a => a[(Math.random() * a.length) | 0];

// ---- the words
const CARD = [['Amunì, mi servi pi ’nu video! T’aspettu a Piazza Garraffello.', 'Come on, I need you for a video! I am waiting at Piazza Garraffello.'],
  ['Ciao amici! Mi puaitti a girari ’nu video? Sugnu a Piazza Garraffello.', 'Hi friends! Will you take me to shoot a video? I am at Piazza Garraffello.']];
const GREET = [['Ciao a tutti amici! Oggi vi puaittu a scupriri ’nu postu ncantatu!', 'Hi everyone, friends! Today I take you to discover an enchanted place!'],
  ['Acchiana, ca fazzu ’nu video ca spacca!', 'Hop in, I am making a video that rocks!']];
const BOARD = [['Benvenuti nta sta lapa, amici! Rumuri cumpresu!', 'Welcome to this lapa, friends! Noise included!'],
  ['Si c’è ’na scossa, un fa nenti: va tuttu ntô video!', 'If there is a jolt, never mind: it all goes in the video!']];
const AMBIENT = [['Talìa, talìa quant’è biedda Paliaimmu! Qualità cinema, amici!', 'Look, look how beautiful Palermo is! Cinema quality, friends!'],
  ['Mettiti ntô quatru, un fari u cafuni!', 'Get in the frame, do not be a lout!'],
  ['Araciu, ca u telefunu un havi u stabilizzaturi!', 'Gently, my phone has no stabiliser!'],
  ['Iscrivitivi ô canali, amici, e mittiti mi piaci!', 'Subscribe to the channel, friends, and hit like!']];
const BUMP = [['Qualità terribbili! Ripresi pessimi!', 'Terrible quality! Awful footage!'], ['Mi trima tuttu u video!', 'My whole video is shaking!'],
  ['Mizzica, ma chi guidi? Un frullaturi?!', 'Damn, what are you driving? A blender?!'], ['Accura, ca mi ruvini a ripresa!', 'Careful, you are ruining my shot!']];
const ARRIVE = [['Eccuci, amici! Chistu è u Castello ra Zisa, in tuttu u so splennuri…', 'Here we are, friends! This is the Zisa castle, in all its splendour…'],
  ['Aspetta… aspetta… Ma chi è sta luci?!', 'Wait… wait… What is this light?!'],
  ['U video vinni ’nu schifiu! Un si vidi nenti, è tuttu scuru!', 'The video came out awful! You cannot see a thing, it is all dark!'],
  ['Tuinnamu a Piazza Garraffello ca rifazzu a ripresa, amunì!', 'We go back to Piazza Garraffello and I redo the shot, come on!']];
const AGAIN = [['Secunna ripresa, amici: ciak, si gira!', 'Second take, friends: action, rolling!'], ['Stavota a luci è bona, u sentu!', 'This time the light is good, I can feel it!']];
const HOME = [['Perfettu! Ccà a luci è giusta, u video veni bieddu!', 'Perfect! The light is right here, the video will be great!'],
  ['Grazzi amicu, sì ’n granni! Iscrivitivi ô canali!', 'Thanks my friend, you are great! Subscribe to the channel!']];
const L = { label: [WANDERER_NAME, WANDERER_NAME], goto: ['Va’ a Piazza Garraffello', 'Go to Piazza Garraffello'], back: ['Tuinna ô principiu', 'Back to the start'],
  tag: ['Sicilian Wanderer', 'Sicilian Wanderer'], note: ['cchiù i manci', 'plus tips'], base: ['Cuoisa', 'Fare'], bonus: ['Video ca un trima', 'Steady footage'], total: ['Tutali', 'Total'], channel: ['Talìa u canali ri Dario ntô YouTube', 'Watch Dario’s channel on YouTube'], shaky: ['Video ca trima!', 'Shaky video!'], toast: ['Si va ô Castello ra Zisa', 'Off to the Zisa castle'], bye: ['Ripresa nova!', 'New take!'] };

export default function setup(X) {
  const { car, T, hud, eur, speed, say, pedestrians, groundAt } = X;
  const tx = a => T(a[0], a[1]);
  let dest = null, home = null;   // road points, found once
  const roads = () => {
    if (!dest) { const [vx, vz] = X.proj(DEST.lat, DEST.lon), sn = X.snapRoad(vx, vz); dest = { name: DEST.name, x: sn.x, z: sn.z }; }
    if (!home && X.wanderer) { const sn = X.snapRoad(X.wanderer.x, X.wanderer.z); home = { name: 'Piazza Garraffello', x: sn.x, z: sn.z }; }
  };
  let run = null, hits = 0;
  if (pedestrians.onKnock) pedestrians.onKnock(() => { hits++; });
  const slot = { id: 'wanderer:garraffello', kind: 'wanderer', sub: 'wanderer', name: WANDERER_NAME, x: 0, z: 0, dx: 0, dz: 1, w: 6, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null, cool: COOL,
    leash: () => { const r = run; if (!r) return { a: [car.x, car.z], b: [car.x, car.z], r: 520 }; return r.leg === 0 ? { a: r.s0, b: [home.x, home.z], r: 520 } : { a: [home.x, home.z], b: [dest.x, dest.z], r: Math.max(520, r.d * 0.35 + 250) }; } };
  const quote = () => { const len = run ? run.len : (roads(), Math.hypot(dest.x - home.x, dest.z - home.z) * ROAD_K); return Math.round((4 + 2 * len / 110) * PAY_X * 2) / 2; };

  X.director.add('wanderer', far => {
    const w = X.wanderer; if (!w || X.now() < slot.coolUntil) return null;
    if (Math.hypot(car.x - w.x, car.z - w.z) > far) return null;
    roads(); if (!dest || !home) return null;
    slot.x = home.x; slot.z = home.z;
    return { slot, instant: true, ped: 'wanderer', col: COL, tag: tx(L.tag), who: WANDERER_NAME, line: tx(pick(CARD)), pay: quote(), note: tx(L.note), where: '→ ' + DEST.name, drop: () => {} };
  });

  const hudO = { label: '', title: '', sub: '', time: '', low: false, frac: null, target: null, ledger: null };
  const head = id => X.charHead(id), km = d => d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m';
  const mark = (r, p) => { X.destBeacon.set(p.x, p.z); X.destBeacon.show(true); r.marker = X.addMarker(p.x, p.z, COL, 8, 'target'); };
  const unmark = r => { X.destBeacon.show(false); if (r.marker) { X.dropMarker(r.marker); r.marker = null; } };
  const target = r => r.leg === 0 ? home : r.leg === 1 ? dest : home;

  X.kinds.wanderer = {
    state: () => run, points: () => ({ dest, home }), slot,   // for the tests
    start() {
      roads(); const len = Math.hypot(dest.x - home.x, dest.z - home.z) * ROAD_K;
      run = { phase: 'goto', leg: 0, t: 0, s0: [car.x, car.z], id: -1, len, d: len / ROAD_K, base: 0, bumps: 0, bumpCd: 0, prevSp: 0, prevScr: 0, chat: 12, hold: 0, marker: null, script: null, homed: false, total: 0, ok: false, drop: 0 };
      run.base = quote(); hits = 0;
      X.calls.hideBeacon(); X.setPhase('goto'); X.guide.to(home.x, home.z); mark(run, home);
      hud.toast(WANDERER_NAME, tx(L.goto));
    },
    update(dt) {
      const r = run; if (!r) return; r.t += dt;
      const w = X.wanderer, tgt = target(r), d = Math.hypot(car.x - tgt.x, car.z - tgt.z);
      hudO.label = WANDERER_NAME; hudO.target = null; hudO.time = ''; hudO.frac = null; hudO.low = false; hudO.ledger = null;
      if (r.phase === 'goto') {
        const i = w.id() >= 0 ? pedestrians.info(w.id()) : null, dh = i ? Math.hypot(car.x - i.x, car.z - i.z) : d;
        hudO.title = tx(L.goto); hudO.sub = km(dh); hudO.target = home; hud.set(hudO); X.aim(home.x, home.z, true);
        if (i && dh < 14 && speed() < 2.2) { r.hold += dt; if (r.hold > 0.35) { r.id = w.grab(); r.phase = 'board'; r.t = 0; X.setPhase('board'); X.guide.off(); unmark(r); X.aim(0, 0, false); pedestrians.face(r.id, car.x, car.z); say(tx(pick(GREET)), head(r.id), 0.2); } } else r.hold = 0;
        return;
      }
      if (r.phase === 'board') { board(r, dt); return; }
      if (r.phase === 'ride') {
        ride(r, dt); hudO.title = tgt.name; hudO.sub = (r.leg === 2 ? tx(L.back) + '  ·  ' : '') + km(d); hudO.target = tgt; hud.set(hudO); X.aim(tgt.x, tgt.z, true);
        if (d < X.destBeacon.R && speed() < 2.0) arrive(r);
        return;
      }
      if (r.phase === 'out') {   // at the castle: he is out, talking to camera, and the shot did not come out
        hudO.title = tgt.name; hudO.sub = ''; hud.set(hudO); X.aim(0, 0, false);
        while (r.script.length && r.t >= r.script[0][0]) r.script.shift()[1]();
        return;
      }
      if (r.phase === 'drop') { hudO.title = tx(L.bye); hudO.sub = ''; hud.set(hudO); if ((r.drop -= dt) <= 0) X.endEvent(r.ok); }
    },
    stop() {
      const r = run; if (!r) return; run = null;
      unmark(r); X.guide.off();
      if (r.id >= 0 && !r.homed) { pedestrians.detach(r.id); pedestrians.remove(r.id); X.wanderer.give(false); }   // not at home: he goes, and comes back to his spot with the crowd system
    },
  };
  addEventListener('pd-drowned', () => { if (run && (run.phase === 'ride' || run.phase === 'board')) X.endEvent(false); });

  // he walks to the lapa and sits down (the same as the passengers of src/event-fares.js)
  function board(r, dt) {
    const i = pedestrians.info(r.id); if (!i) { X.endEvent(false); return; }
    hudO.title = tx(L.goto); hudO.sub = ''; hud.set(hudO); X.aim(0, 0, false);
    const sn = Math.sin(car.th), cs = Math.cos(car.th), side = ((i.x - car.x) * cs - (i.z - car.z) * sn) >= 0 ? 1 : -1, tx2 = car.x + sn * -1.0 + cs * side * 1.0, tz2 = car.z + cs * -1.0 - sn * side * 1.0;
    r.nx = (r.nx || 0) - dt; if (r.nx <= 0) { pedestrians.walkTo(r.id, tx2, tz2, 2.8); r.nx = 0.25; }
    if (Math.hypot(i.x - tx2, i.z - tz2) < 0.6) {
      pedestrians.attachTo(r.id, X.seatFn(0), { seated: true, blend: 0.4 });
      r.leg = r.leg === 0 ? 1 : 2; r.phase = 'ride'; X.setPhase('ride'); r.chat = 10; r.nx = 0;
      const p = target(r); X.guide.to(p.x, p.z); mark(r, p);
      if (r.leg === 1) { say(tx(BOARD[0]), X.seatPos, 0.3, 9); hud.toast(tx(L.toast), DEST.name); } else say(tx(pick(AGAIN)), X.seatPos, 0.3, 9);
      r.prevSp = speed();
    }
  }
  // a bump shakes his video: a wall, a person, a hard stop
  function ride(r, dt) {
    const sp = speed(); r.bumpCd -= dt; r.chat -= dt;
    const wall = car.scrape > 5 && r.prevScr <= 5 && r.prevSp > 5, hard = dt > 0 && r.prevSp > 6 && (r.prevSp - sp) / dt > BUMP_DECEL, ped = hits > 0;
    r.prevSp = sp; r.prevScr = car.scrape; hits = 0;
    if ((wall || hard || ped) && r.bumpCd <= 0) { r.bumpCd = BUMP_CD; r.bumps++; say(tx(pick(BUMP)), X.seatPos, 0.15); hud.toast(tx(L.shaky), r.bumps + ' / 5'); }
    if (r.chat <= 0) { r.chat = 16 + Math.random() * 10; say(tx(pick(AMBIENT)), X.seatPos, 0); }
  }
  function arrive(r) {
    unmark(r); X.guide.off();
    if (r.leg === 1) {   // the castle: out, to camera, the light is bad
      r.phase = 'out'; r.t = 0; X.setPhase('speech');
      const sn = Math.sin(car.th), cs = Math.cos(car.th);
      pedestrians.detach(r.id); pedestrians.walkTo(r.id, car.x + cs * 3.2 - sn * 1.0, car.z - sn * 3.2 - cs * 1.0, 2.2);
      const s = (t, f) => [t, f];
      r.script = [s(1.6, () => { pedestrians.face(r.id, car.x - cs * 8, car.z + sn * 8); say(tx(ARRIVE[0]), head(r.id), 0); }), s(5.4, () => say(tx(ARRIVE[1]), head(r.id), 0)),
        s(8.6, () => say(tx(ARRIVE[2]), head(r.id), 0)), s(12.4, () => { say(tx(ARRIVE[3]), head(r.id), 0); hud.toast(WANDERER_NAME, tx(L.back)); }),
        s(15.8, () => { r.phase = 'board'; X.setPhase('board'); r.nx = 0; })];
    } else {   // back at the start: it came out well this time
      r.phase = 'drop'; X.setPhase('drop');
      pedestrians.detach(r.id); r.homed = true; X.wanderer.give(true);
      say(tx(HOME[0]), head(r.id), 0.5); say(tx(HOME[1]), head(r.id), 4.2);
      const bonus = Math.round(r.base * 0.4 * Math.max(0, 1 - r.bumps / 5) * 2) / 2, total = r.base + bonus; r.total = total; r.ok = true; r.drop = DROP_T; X.addFare(total);
      hud.result(`<h3>${esc(WANDERER_NAME)}</h3>
        <div class="row"><span>${esc(tx(L.base))}</span><span>${eur(r.base)}</span></div>
        <div class="row"><span>${esc(tx(L.bonus))}</span><span>+ ${eur(bonus)}</span></div>
        <div class="row tot"><span>${esc(tx(L.total))}</span><span>${eur(total)}</span></div>
        <div class="row"><a href="${CHANNEL}" target="_blank" rel="noopener noreferrer" style="pointer-events:auto;color:#f5a9c9;text-decoration:none;margin:6px auto 0;letter-spacing:.1em">▶ ${esc(tx(L.channel))}</a></div>`, DROP_T);
      if (bonus >= r.base * 0.25) hud.burst();
    }
  }
}
