// Fares of the free-roam events: tourists (hungry, centro), regular taxi rides, "a pulle" (Viale Diana, day and night) and the urgent long runs.
// A person on the kerb hailed the lapa (src/event-calls.js); this module takes over once the lapa stops: board, ride along the baked route
// (src/event-routes.js) before the clock runs out, drop. Pay = fare by distance + a tip that grows with speed (time left) + small tips for
// drifts, two wheels and close calls. Hitting pedestrians or cars costs nothing. Pay goes to the Garage wallet through 'pd-fare' (src/garage.js).
// createFares(X) -> { start(slot), update(dt), stop(), active(), stigghiola() }; X is the context built in src/missions.js.
import { TOURIST, DRIVER, FAVORITA, PULLE, URGENT_LINES, NATIONS, FRIEND } from '../assets/missions/lines.js';
import { esc } from './esc.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const TOURIST_POOL = ['tourist', 'tourist2', 'tourist', 'tourist2', 'borsa', 'signora2', 'teen2', 'suit2', 'kid2', 'teen'];
const LOCAL_POOL = ['suit', 'suit2', 'signora', 'signora2', 'borsa', 'shopper', 'ragazzo', 'ragazzo2', 'nonno', 'coppola', 'teen'];
const NIGHT_POOL = ['nightboy', 'nightgirl', 'nightboy2', 'nightgirl2', 'nightgirl3', 'tifoso'];
const fmtTpl = (tpl, d) => tpl.replace('{place}', d.name).replace('{food_en}', d.food_en || '').replace('{food_de}', d.food_de || '').replace('{food_fr}', d.food_fr || '');

export function createFares(X) {
  const { car, pedestrians, groundAt, T, hud, eur, speed, say, driverPos, seatPos, seatFn, toast } = X;
  let f = null, lastDest = null, pedHits = 0, prevScrape = 0, prevSpeed = 0, clockT = 0;
  if (pedestrians.onKnock) pedestrians.onKnock(() => { pedHits++; });
  const natPick = () => { let r = Math.random() * NATIONS.reduce((a, n) => a + n[1], 0); for (const [k, w] of NATIONS) if ((r -= w) <= 0) return k; return 'en'; };
  const tline = (key, delay = 0) => {
    if (!f) return;
    const L = f.friend ? (FRIEND[f.friend][key] || null) : f.pulleNight ? (FAVORITA.client[key] || FAVORITA.client.ambient) : f.urgent ? (URGENT_LINES[key] || []) : f.sub === 'tourist' || f.sub === 'pulle' ? (TOURIST[key] && (TOURIST[key][f.nat] || TOURIST[key].en)) : null;
    if (L && L.length) say(pick(L), seatPos, delay);
  };
  const dline = (key, delay = 1.4) => {
    const L = f && f.pulleNight ? FAVORITA.driver[key] : f && f.urgent && key === 'board' ? URGENT_LINES.driver : null;
    const src = L || DRIVER[key]; if (src) say(pick(src), driverPos, delay);
  };
  function tip(amount, label) { f.tips += amount; toast('+' + eur(amount), label); }

  function start(slot) {
    const sub = slot.sub, urgent = slot.kind === 'urgent', night = X.isNight();
    const opts = (X.ROUTES[slot.key] || []).filter(r => r[0] !== lastDest || X.ROUTES[slot.key].length < 2);
    if (!opts.length) { X.endEvent(false); return; }
    const [destId, len, flat] = pick(opts); lastDest = destId;
    const dest = X.destInfo(destId);
    const pts = flat;
    f = { slot, sub, urgent, friend: slot.friend || null, nat: natPick(), pulleNight: sub === 'pulle' && night, dest, len, pts, chars: slot.callers.slice().map((id, i) => ({ id, seated: false, slot: i, next: 0 })), phase: 'board', doorT: 0,
      base: 0, tips: 0, limit: 0, left: 0, ev: {}, wantsStig: sub === 'tourist' && Math.random() < 0.45, stigDone: false, sniffed: false, lateSaid: false, glam: null, discretion: 0 };
    slot.callers = [];
    // a second tourist sometimes
    if (sub === 'tourist' && f.chars.length === 1 && Math.random() < 0.4) {
      const i0 = pedestrians.info(f.chars[0].id);
      if (i0) { const id = pedestrians.spawnScripted(pick(TOURIST_POOL), i0.x + 0.8, i0.z + 0.4); if (id >= 0) f.chars.push({ id, seated: false, slot: 1, next: 0 }); }
    }
    // pay and clock
    if (urgent) { f.base = Math.round((8 + len / 90) * 2) / 2; f.limit = f.left = len / (17.5 * (X.URGENT_TIGHT[slot.id] || 1)) + 18; }
    else if (sub === 'pulle') { f.base = Math.round((9 + len / 70) * 2) / 2; f.limit = f.left = len / 8.4 + 30; }
    else { f.base = Math.round((4 + len / 110) * 2) / 2; f.limit = f.left = len / 8.4 + 22; }
    hud.toast(urgent ? T('Curri!', 'Hurry!') : T('Si paiti!', 'Off we go!'), dest.name);
    X.setPhase('board');
  }

  function startRide() {
    f.phase = 'ride'; X.setPhase('ride');
    X.calls.hideBeacon();
    X.guide.path(f.pts);
    X.destBeacon.set(f.dest.x, f.dest.z); X.destBeacon.show(true); X.destMarker = X.addMarker(f.dest.x, f.dest.z, '#ffd24a', 8);
    if (f.urgent) { say(pick(X.URGENT_DEF[f.slot.id].say), seatPos, 0.2); tline('board', 2.2); dline('board', 3.6); }
    else if (f.sub === 'pulle') {
      if (f.pulleNight) { say(pick(FAVORITA.client.ask), seatPos, 0.2); say(pick(FAVORITA.driver.ask), driverPos, 2.6); say(pick(FAVORITA.driver.depart), driverPos, 5); }
      else { say(pick(PULLE.ask), seatPos, 0.2); say(pick(PULLE.driver), driverPos, 2.8); }
    } else if (f.sub === 'tourist') {
      say(fmtTpl(pick(TOURIST.ask[f.nat] || TOURIST.ask.en), f.dest), seatPos, 0.2);
      say(pick(f.dest.meusa ? DRIVER.askMeusa : DRIVER.ask), driverPos, 1.8); say(pick(DRIVER.depart), driverPos, 3.6);
    } else { say(T('Mi porti a ' + f.dest.name + ', per favore.', 'Take me to ' + f.dest.name + ', please.'), seatPos, 0.2); say(pick(DRIVER.depart), driverPos, 2); }
  }

  function updateBoard(dt) {
    const sp = speed(), sn = Math.sin(car.th), cs = Math.cos(car.th);
    for (const c of f.chars) {
      if (c.seated) continue;
      const info = pedestrians.info(c.id); if (!info) continue;
      const side = ((info.x - car.x) * cs - (info.z - car.z) * sn) >= 0 ? 1 : -1;
      const tx = car.x + sn * -1.0 + cs * side * 1.0, tz = car.z + cs * -1.0 - sn * side * 1.0;
      c.next -= dt;
      if (c.next <= 0) { pedestrians.walkTo(c.id, tx, tz, 2.8); c.next = 0.25; }
      if (Math.hypot(info.x - tx, info.z - tz) < 0.6) {
        c.seated = true; pedestrians.attachTo(c.id, seatFn(c.slot), { seated: true, blend: 0.4 });
        if (c.slot === 0) { tline('board'); if (f.sub !== 'taxi') dline('board', 1.6); }
      }
    }
    const all = f.chars.length && f.chars.every(c => c.seated);
    if (all) { f.doorT += dt; if (f.doorT > 0.3) startRide(); return; }
    // pulling away before everyone is in: whoever is aboard is the fare
    if (sp > 3.5 && Math.hypot(car.x - f.slot.x, car.z - f.slot.z) > 12) {
      if (f.chars.some(c => c.seated)) { for (const c of f.chars.filter(c => !c.seated)) pedestrians.remove(c.id); f.chars = f.chars.filter(c => c.seated); startRide(); }
      else { X.endEvent(false, true); return; }
    }
  }

  function updateRide(dt) {
    const sp = speed(), ev = f.ev;
    if (f.sub === 'pulle' && !f.glam && Math.hypot(car.x - f.dest.x, car.z - f.dest.z) < 450) spawnGlam();
    f.left -= dt;
    for (const k in ev) if (ev[k] > 0) ev[k] = Math.max(0, ev[k] - dt);
    ev.drift = ev.drift || 0; ev.wheels = ev.wheels || 0; ev.miss = ev.miss || 0; ev.wall = ev.wall || 0; ev.ped = ev.ped || 0; ev.fast = ev.fast || 0; ev.chat = ev.chat === undefined ? rand(10, 18) : ev.chat;
    // small tips
    f.driftAcc = (car.drift > 0.55 && sp > 7) ? (f.driftAcc || 0) + dt : Math.max(0, (f.driftAcc || 0) - dt * 2);
    if (f.driftAcc >= 1) { f.driftAcc = 0; tip(1.5, T('Sciddicata!', 'Drift!')); if (Math.random() < 0.5) { tline('drift'); dline('drift'); } }
    f.wheelAcc = (car.tip > 0.55 && sp > 7) ? (f.wheelAcc || 0) + dt : 0;
    if (f.wheelAcc >= 0.6 && ev.wheels <= 0) { ev.wheels = 3; f.wheelAcc = 0; tip(2, T('Supra dui ruoti!', 'Two wheels!')); tline('wheels'); dline('wheels'); }
    f.speedAcc = sp > 21 ? (f.speedAcc || 0) + dt : 0;
    if (f.speedAcc >= 4) { f.speedAcc = 0; tip(1, T('Pidali a tavulietta', 'Pedal to the metal')); if (ev.fast <= 0) { ev.fast = 20; tline('fast'); dline('fast'); } }
    if (sp > 8 && ev.miss <= 0) {
      let hit = false;
      const ag = X.traffic && X.traffic.agents ? X.traffic.agents() || [] : [];
      for (const a of ag) { const d = Math.hypot(a.x - car.x, a.z - car.z) - (a.r || 1.2); if (d > 0.55 && d < 1.2) { hit = true; break; } }
      if (!hit && pedestrians.near && pedestrians.near(car.x + car.vx * 0.25, car.z + car.vz * 0.25, 1.5) > 0) hit = true;
      if (hit) { ev.miss = 1.6; tip(1, T('Pi nu pilu!', 'Close call!')); if (Math.random() < 0.5) { tline('miss'); dline('miss'); } }
    }
    // walls and people only make the passengers talk, they cost nothing
    if (car.scrape > 5 && prevScrape <= 5 && ev.wall <= 0 && prevSpeed > 5) { ev.wall = 1.2; tline('hitWall'); dline('hitWall'); }
    prevScrape = car.scrape; prevSpeed = sp;
    if (pedHits > 0) { pedHits = 0; if (ev.ped <= 0) { ev.ped = 1.0; tline('hitPed'); dline('hitPed', 1.8); } }
    ev.chat -= dt;
    if (ev.chat <= 0) { ev.chat = rand(14, 24); if (!f.urgent) { tline('ambient'); dline('ambient', 1.8); } }
    if (f.wantsStig && !f.sniffed) for (const v of X.vendors) if (v.kind !== 'pollanche' && v.cd <= 0 && Math.hypot(v.x - car.x, v.z - car.z) < 55) { f.sniffed = true; tline('smell'); toast(T('Chi prufumu!', 'What a smell!'), T('I turisti vonnu na stigghiola', 'The tourists want a stigghiola')); break; }
    if (f.left < 12 && !f.lateSaid) { f.lateSaid = true; tline('late'); dline('late'); }
    const d = Math.hypot(car.x - f.dest.x, car.z - f.dest.z);
    if (d < X.destBeacon.R && sp < 2.0) return finish(true);
    if (f.left <= 0) return finish(false);
  }

  // the glam night folk of Viale Diana: fully clothed, cheerful, and in on the joke (the old A Favorita mission)
  function spawnGlam() {
    f.glam = [];
    const nx = -f.dest.dz, nz = f.dest.dx, ids = ['glam1', 'glam2', 'glam3', 'glam3', 'glam1', 'glam2'], along = [-60, -42, -25, 18, 34, 56];
    ids.forEach((v, k) => {
      const sd = k % 2 ? -1 : 1, off = 5.8 + (k % 3) * 0.7, x = f.dest.x + f.dest.dx * along[k] + nx * sd * off, z = f.dest.z + f.dest.dz * along[k] + nz * sd * off;
      const id = pedestrians.spawnScripted(v, x, z); if (id < 0) return;
      pedestrians.face(id, f.dest.x + f.dest.dx * along[k], f.dest.z + f.dest.dz * along[k]); f.glam.push({ id, along: along[k] });
    });
  }

  function finish(ok) {
    f.phase = 'drop'; f.dropT = ok ? 5.5 : 4; X.setPhase('drop');
    X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off();
    const d = f.dest, dx = d.vx - d.x, dz = d.vz - d.z, dl = Math.hypot(dx, dz) || 1, step = ok ? Math.min(dl, 7) : 9;
    f.chars.forEach((c, i) => {
      pedestrians.detach(c.id); c.seated = false;
      const tx = ok ? d.x + dx / dl * step + i * 0.8 : car.x + Math.sin(car.th + 1.2 + i) * 9, tz = ok ? d.z + dz / dl * step : car.z + Math.cos(car.th + 1.2 + i) * 9;
      pedestrians.walkTo(c.id, tx, tz, ok ? 2.2 : 3.2);
    });
    if (!ok) {
      tline('fail'); dline('fail', 2.0);
      if (f.sub === 'pulle' && !f.pulleNight) say(pick(PULLE.fail), seatPos, 0.5);
      hud.result(`<h3>${T('Tiempu scadutu!', 'Time is up!')}</h3><div class="row"><span>${T('I passiggeri scinnunu e un pàganu', 'The passengers get out and do not pay')}</span></div>`, 3);
      f.total = 0; return;
    }
    // tip by speed: the more of the clock is left, the bigger it is; a streak of small tips came on the way
    const frac = clamp(f.left / f.limit, 0, 1), speedTip = Math.round(f.base * (f.urgent ? 1.4 : 0.9) * frac * 2) / 2;
    let discretion = 0;
    if (f.sub === 'pulle') discretion = Math.round(f.base * 0.4 * 2) / 2;
    const total = f.base + f.tips + speedTip + discretion;
    f.total = total; X.addFare(total);
    tline('arrive'); dline('arrive', 2.0);
    if (f.sub === 'pulle') {
      say(pick(f.pulleNight ? FAVORITA.client.arrive : PULLE.arrive), seatPos, 0.8);
      const sorted = (f.glam || []).slice().sort((a, b) => Math.abs(a.along) - Math.abs(b.along));
      sorted.slice(0, 3).forEach((g, i) => say(FAVORITA.chorus[(i + (Math.random() < 0.5 ? 0 : 1)) % FAVORITA.chorus.length], X.charHead(g.id), 3.6 + i * 1.5));
      if (f.pulleNight && sorted.length && f.chars[0]) say(pick(FAVORITA.client.caught), X.charHead(f.chars[0].id), 8);
    }
    hud.result(`<h3>${esc(d.name)}</h3>
      <div class="row"><span>${T('Cuoisa', 'Fare')}</span><span>${eur(f.base)}</span></div>
      <div class="row"><span>${T('Mancia lesta', 'Speed tip')}</span><span>+ ${eur(speedTip)}</span></div>
      <div class="row"><span>${T('Manci', 'Tips')}</span><span>+ ${eur(f.tips)}</span></div>
      ${discretion ? `<div class="row"><span>${T('Silenziu (a palora)', 'Discretion (your word)')}</span><span>+ ${eur(discretion)}</span></div>` : ''}
      <div class="row tot"><span>${T('Tutali', 'Total')}</span><span>${eur(total)}</span></div>`, 4.2);
    if (total >= f.base * 1.4) hud.burst();
  }


  function update(dt) {
    if (!f) return;
    clockT += dt;
    if (f.phase === 'board') updateBoard(dt);
    else if (f.phase === 'ride') updateRide(dt);
    else if (f.phase === 'drop') { f.dropT -= dt; if (f.dropT <= 0) { X.endEvent(f.total > 0); return; } }
    if (!f) return;
    // hud
    const tgt = f.phase === 'ride' ? f.dest : f.slot, dist = Math.hypot(tgt.x - car.x, tgt.z - car.z), ds = dist >= 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(dist / 5) * 5 + ' m';
    if (f.phase === 'ride') {
      const m = Math.max(0, f.left);
      hud.set({ label: f.urgent ? T('Uiginti!', 'Urgent!') : f.sub === 'tourist' ? T('Puoitali a manciari', 'Take them to eat') : f.sub === 'pulle' ? T('A pulle', 'A pulle') : T('Cuoisa in taxi', 'Taxi ride'),
        title: f.dest.name, sub: (f.dest.addr ? f.dest.addr + '  ·  ' : '') + ds, time: Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), low: m < 12, frac: f.left / f.limit,
        target: f.dest, ledger: [T('Cuoisa ', 'Fare ') + eur(f.base + f.tips), T('Ncassu ', 'Total ') + eur(X.earned())] });
      X.aim(f.dest.x, f.dest.z, true);
    } else if (f.phase === 'board') { hud.set({ label: T('Acchianunu', 'Boarding'), title: f.dest.name, sub: '', time: '', frac: null, target: null }); X.aim(0, 0, false); }
    else { hud.set({ label: T('Ni viremu', 'Goodbye'), title: f.dest.name, sub: '', time: '', frac: null, target: null }); X.aim(0, 0, false); }
  }

  function stop(why) {
    if (!f) return;
    for (const c of f.chars) { pedestrians.detach(c.id); pedestrians.remove(c.id); }
    if (f.glam) for (const g of f.glam) pedestrians.remove(g.id);
    X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off();
    f = null;
  }
  // the stigghiola vendor (src/missions.js) fed the tourists
  function stigghiola() { if (f && f.phase === 'ride' && f.wantsStig && !f.stigDone) { f.stigDone = true; tip(6, T('Stigghiola pê turisti', 'Stigghiola for the tourists')); tline('eat'); } }
  // sea: ends the ride like running out of time
  function drowned() { if (f && f.phase === 'ride') finish(false); }
  return { start, update, stop, active: () => !!f, stigghiola, drowned, get state() { return f; } };
}
