// Street gags that live in the traffic: the lookouts on e-scooters, the rosanero team bus and the double-parking
// quarrels. Owned by the traffic work; driven by src/traffic.js (createGags(env, T, police)).
// They use traffic vehicles (instanced) plus the pedestrian scripted-character API (bound by pedestrians.js through
// traffic.bindPedestrians) and env.shout balloons.
import { INSULTS } from './shouts.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const MARKETS = [[-60, 410], [260, -220], [-390, -245]];         // Ballaro, Vucciria, Capo (same centres as the crowd density map)
const QUINNUTU = 'SI UN QUINNUTU!!!';
const CAFFE = 'OOU ma tutta sta premura hai? Minchia un cafè!';
const DRIVERS = ['coppola', 'suit', 'borsa', 'nonno', 'ragazzo', 'tuta', 'macellaio', 'mamma', 'suit2', 'coppola2'];
const CARS = new Set(['panda', 'punto', 'smart', 'taxi', 'van']);

export function createGags(env, T, police) {
  const { car, camera } = env;
  const vs = T.vs;
  const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let peds = null, time = 0, tickT = 0;

  // ======================================================================== lookouts (picciotti on monopattini)
  const marketNear = (x, z, r) => { let b = null, bd = r * r; for (const m of MARKETS) { const d = (m[0] - x) ** 2 + (m[1] - z) ** 2; if (d < bd) { bd = d; b = m; } } return b; };
  let nextLook = 3;
  function lookouts() {
    let n = 0;
    for (const v of vs) {
      if (v.name !== 'monopattino') continue;
      n++;
      if (v.alerted) {
        if (v.fleeUntil && time > v.fleeUntil) { v.flee = false; v.boost = 1; v.fleeUntil = 0; }
        continue;
      }
      const d = Math.hypot(v.x - car.x, v.z - car.z);
      if (v.alarmAt) { if (time >= v.alarmAt) alarm(v); continue; }
      let copNear = false;
      for (const o of vs) if (o.cop && !o.fly && (o.x - v.x) ** 2 + (o.z - v.z) ** 2 < 65 * 65) { copNear = true; break; }
      if (d < 190 && (copNear || police.heat() > 0)) v.alarmAt = time + rand(0.1, 1.4);
    }
    // keep a few around while the player is near a market
    const want = marketNear(car.x, car.z, 250) ? (COARSE ? 2 : 3) : 0;
    if (n < want && time >= nextLook) {
      nextLook = time + 2.5;
      const v = T.spawnOffscreen('monopattino', 40, 200, (mx, mz) => !!marketNear(mx, mz, 110));
      if (v) { const m = marketNear(v.x, v.z, 140) || MARKETS[0]; v.home = m; }
    }
  }
  function alarm(v) {
    v.alerted = true; v.flee = true; v.boost = 1.55; v.fleeUntil = time + 25;
    T.shoutAt(v, 'Ou, i sbirri! I sbirri!');
  }

  // ======================================================================== the team bus
  let bus = null, nextTeam = 40 + rand(0, 40), busShouted = false, mirT = 0;
  function teamBus() {
    if (bus && bus.dead) { bus = null; nextTeam = time + rand(150, 300); }
    if (!bus && time >= nextTeam) {
      const v = T.spawnTeamBus();
      if (v) { bus = v; v.lifeEnd = time + 260; busShouted = false; } else nextTeam = time + 8;
    }
    if (!bus) return;
    if (time > bus.lifeEnd) bus.hide = true;
    const d = Math.hypot(bus.x - camera.position.x, bus.z - camera.position.z);
    if (d < 130 && time >= mirT) { mirT = time + 0.3; peds?.miracle?.(bus.x, bus.z, 11); }
    if (!busShouted && d < 30 && T.inView(bus.x, 1.5, bus.z, 6)) { busShouted = true; T.shoutAt(bus, 'FORZA PALERMO!'); }
  }

  // ======================================================================== double parking ("doppia fila")
  const dps = [];
  let nextDp = 12 + rand(0, 10), lastInsult = '';
  const insult = () => { let s; do s = pick(INSULTS); while (s === lastInsult && INSULTS.length > 1); lastInsult = s; return s; };
  const right = v => [-Math.cos(v.h), Math.sin(v.h)];            // the driver's right-hand side in the world
  const say = (id, text) => {
    const i = peds.info(id); if (!i || Math.hypot(i.x - camera.position.x, i.z - camera.position.z) > 80) return;   // nobody sees the far ones
    env.shout?.(i.x, i.y + 1.9, i.z, text, () => { const k = peds.info(id); return k ? { x: k.x, y: k.y + 1.9, z: k.z } : null; });
  };
  const spawnDriver = (v, side) => { // side +1 = the kerb (right) side, -1 = the road side
    const r = right(v), o = (v.ty.W / 2 + 0.75) * side;
    return peds.spawnScripted(pick(DRIVERS), v.x + r[0] * o, v.z + r[1] * o);
  };
  function dropDrivers(s) { for (const id of [s.ida, s.idb]) if (id > 0) peds.remove(id); s.ida = s.idb = 0; }
  function release(s) { for (const v of [s.a, s.b]) if (v) { v.hold2 = 0; v.dp = null; } }
  function endScene(s, kind) { // 'end': walk back to the cars; 'break': run off; 'drop': vanish
    if (s.state === 'done') return;
    if (kind !== 'end') release(s);               // walking back to the cars: they stay put until the drivers are in
    if (kind === 'drop' || !peds) { dropDrivers(s); s.state = 'done'; return; }
    s.state = 'leaving'; s.leaveAt = time + (kind === 'break' ? 2.4 : 14);
    for (const [id, v, k] of [[s.ida, s.a, 1], [s.idb, s.b, -1]]) {
      if (!(id > 0)) continue;
      peds.setBounce(id, false);
      if (kind === 'break') {
        const i = peds.info(id); if (!i) continue;
        const dx = i.x - car.x, dz = i.z - car.z, l = Math.hypot(dx, dz) || 1;
        peds.walkTo(id, i.x + dx / l * 9, i.z + dz / l * 9, 3.4, () => peds.remove(id));
        if (k > 0) say(id, insult());
      } else if (v) {
        const r = right(v), o = (v.ty.W / 2 + 0.3) * k;
        peds.walkTo(id, v.x + r[0] * o, v.z + r[1] * o, s.slow ? 0.75 : 1.6, () => peds.remove(id));
      }
    }
  }
  function newScene(dmin = 38) {
    if (!peds || dps.length >= (COARSE ? 1 : 2)) return;
    const cands = [];
    for (const v of vs) {
      if (!CARS.has(v.name) || v.fly || v.cop || v.hold2 || v.dp || v.stopT > 0 || v.v < 2.5 || v.hide) continue;
      const e = v.route[0]; if (!e || e.ped || e.w < 7 || e.rank < 3 || e.len < 40 || v.t < 10 || e.len - v.t < 24) continue;
      const d = Math.hypot(v.x - camera.position.x, v.z - camera.position.z); if (d < dmin || d > 110) continue;
      let close = false; for (const s of dps) if (Math.hypot(s.a.x - v.x, s.a.z - v.z) < 70) close = true;
      if (!close) cands.push(v);
    }
    if (!cands.length) return;
    startScene(pick(cands));
  }
  function startScene(a) {
    const s = { a, b: null, ida: 0, idb: 0, state: 'arrive', t0: time, t1: 0, waitB: 0, nextLine: 0, lineNo: 0, playerT: 0, hornAt: 0, slow: false, speaker: 0, offT: 0 };
    a.hold2 = 1; a.dp = s; dps.push(s);
  }
  function findBlocked(s) {
    for (const o of vs) {
      if (o === s.a || o.fly || o.dp || o.cop || o.blocker !== s.a || o.v > 0.3 || o.ty.scooter || o.ty.cls === 2) continue;
      if (Math.hypot(o.x - s.a.x, o.z - s.a.z) > 17) continue;
      return o;
    }
    return null;
  }
  function stepScene(s, dt) {
    const a = s.a, b = s.b;
    if (s.state === 'done') return true;
    const dc = Math.hypot(a.x - camera.position.x, a.z - camera.position.z);
    if (s.state === 'leaving') {
      if (time > s.leaveAt || (!peds.info(s.ida) && !peds.info(s.idb)) || dc > 240) { release(s); dropDrivers(s); return true; }
      return false;
    }
    if (a.dead || (b && b.dead) || a.fly || (b && b.fly)) { endScene(s, s.ida || s.idb ? 'break' : 'drop'); return false; }
    if (dc > 240) { endScene(s, 'drop'); return true; }
    if (s.state === 'arrive') {
      if (a.v < 0.4) { s.state = 'park'; a.hold2 = 2; s.t1 = time; }
      else if (time - s.t0 > 14) { a.hold2 = 0; a.dp = null; return true; }
      return false;
    }
    if (s.state === 'park') {
      if (time - s.t1 > 1.2) {
        const o = findBlocked(s);
        if (o) { s.waitB += dt; if (s.waitB > 1.5) startQuarrel(s, o); } else s.waitB = Math.max(0, s.waitB - dt);
      }
      if (time - s.t1 > 30) { endScene(s, 'drop'); return true; }
      return false;
    }
    // argue / answer / player: the drivers are out
    const ia = peds.info(s.ida), ib = peds.info(s.idb);
    if (!ia || !ib) { endScene(s, 'break'); return false; }
    if (s.state === 'argue' && time > s.endAt) { endScene(s, 'end'); return false; }
    if (s.state === 'player' && time > s.playerT) { s.state = 'argue'; s.nextLine = time + 0.6; }
    if (s.state === 'answer') {
      if (time > s.answerT) { s.slow = true; endScene(s, 'end'); }
      return false;
    }
    const toP = s.state === 'player';
    if (toP) { peds.face(s.ida, car.x, car.z); peds.face(s.idb, car.x, car.z); } else { peds.face(s.ida, ib.x, ib.z); peds.face(s.idb, ia.x, ia.z); }
    if (time >= s.nextLine) {
      s.speaker ^= 1; s.nextLine = time + (toP ? rand(1.0, 1.5) : rand(1.8, 2.5));
      const id = s.speaker ? s.idb : s.ida, other = s.speaker ? s.ida : s.idb;
      say(id, toP ? (Math.random() < 0.25 ? QUINNUTU : insult()) : (s.lineNo++ % 2 === 0 ? QUINNUTU : insult()));
      peds.setBounce(id, true); peds.setBounce(other, toP);
      s.offT = time + 1.0;
    } else if (time > s.offT && !toP) { peds.setBounce(s.ida, false); peds.setBounce(s.idb, false); }
    if (s.hornAt && s.state === 'argue') { // the lapa honked at them: one answers, then they amble off
      s.hornAt = 0; s.state = 'answer'; s.answerT = time + 2.4;
      const ca = Math.hypot(ia.x - car.x, ia.z - car.z), cb = Math.hypot(ib.x - car.x, ib.z - car.z), id = ca < cb ? s.ida : s.idb;
      peds.face(id, car.x, car.z); peds.setBounce(s.ida, false); peds.setBounce(s.idb, false);
      say(id, CAFFE);
    }
    return false;
  }
  function startQuarrel(s, o) {
    s.b = o; o.hold2 = 2; o.dp = s;
    s.ida = spawnDriver(s.a, 1); s.idb = spawnDriver(o, -1);
    if (!(s.ida > 0) || !(s.idb > 0)) { endScene(s, 'drop'); return; }
    const ia = peds.info(s.ida), sn = Math.sin(s.a.h), cs = Math.cos(s.a.h);
    peds.walkTo(s.idb, ia.x - sn * 1.3, ia.z - cs * 1.3, 1.7);
    peds.face(s.ida, o.x, o.z);
    s.state = 'argue'; s.nextLine = time + 1.2; s.endAt = time + rand(28, 45);
  }
  // called by traffic when the lapa touches one of the quarrellers' cars
  function bump(v) {
    const s = v.dp; if (!s || (s.state !== 'argue' && s.state !== 'answer' && s.state !== 'player')) return;
    s.state = 'player'; s.playerT = time + 5; s.nextLine = time + 0.2; s.slow = false;
  }
  addEventListener('pd-horn', () => {
    for (const s of dps) {
      if (s.state !== 'argue') continue;
      const dx = s.a.x - car.x, dz = s.a.z - car.z;
      if (dx * dx + dz * dz < 34 * 34 && dx * Math.sin(car.th) + dz * Math.cos(car.th) > -3) s.hornAt = time;
    }
  });

  // hazard lights: amber blinkers on the corners of the double-parked car
  function hazards(fx) {
    const on = (time * 1.5) % 1 < 0.5;
    if (!on) return;
    for (const s of dps) {
      if (s.state === 'arrive' || s.state === 'done') continue;
      const v = s.a, sn = Math.sin(v.h), cs = Math.cos(v.h), y = T.groundY(v.x, v.z) + 0.75, hw = v.ty.W / 2 - 0.12, hl = v.ty.L / 2 - 0.1;
      for (const [x, z] of [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl]]) fx.add(v.x + cs * x + sn * z, y, v.z - sn * x + cs * z, 1, 0.55, 0.05, 0.75);
    }
  }

  function update(dt, fx) {
    time += dt;
    tickT += dt;
    if (tickT >= 0.25) {
      const d = tickT; tickT = 0;
      lookouts(); teamBus();
      if (peds) {
        if (time >= nextDp) { nextDp = time + rand(14, 34); newScene(); }
        for (let i = dps.length - 1; i >= 0; i--) if (stepScene(dps[i], d)) dps.splice(i, 1);
      }
    }
    hazards(fx);
  }
  return { update, bump, bindPedestrians(api) { peds = api; }, scenes: dps };
}
