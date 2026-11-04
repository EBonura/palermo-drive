// The room choice alone (src/p2p/rooms.js), with no browser and no relay: N players, a list of who is where that lags as src/p2p/presence.js does (at most one new event per MOVE_GAP_MS), and connections that take
// a moment to form. It answers one question in a second instead of four minutes: does the choice come to rest? The same scenarios as tools/p2p/stress.mjs, many seeds. It is a model, so it checks the logic, not the network: stress.mjs is the real test.
//   node tools/p2p/rooms-sim.mjs [--n 8,16,32] [--sc A,B,C,D,E] [--seeds 10] [--maxp 8] [--verbose]
// Exit code 1 if a scenario does not settle (see the limits in main below).
import { createChooser } from '../../src/p2p/rooms.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NS = (arg('n', '2,3,4,8,9,10,16,19,32')).split(',').map(Number), SCS = arg('sc', 'A,B,C,D,E').split(','), SEEDS = +arg('seeds', 5), VERBOSE = process.argv.includes('--verbose'), LONG = +arg('end', 0), TRACE = process.argv.includes('--trace');
let MAXP = +arg('maxp', 8);
const CELL = 500, MOVE_GAP_MS = 15000, BEAT_MS = 60000, STEP_MS = 250, NET_MS = 300, LINK_MS = 700;
const key = (i, j, s = 0) => `t:${CELL}:${i}:${j}` + (s ? ':' + s : '');
const SPOT = [-1250, 250], BOX = [-2200, -250, -600, 750];
const kResult = {};
function run(sc, n, seed) {
  let a = (seed * 2654435761 + n * 97) >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let end = 135, steadyFrom = 75;
  if (sc === 'C') { end = 200; steadyFrom = 155; } else if (sc === 'D') { end = (n - 1) * 3 + 60; steadyFrom = end - 45; }
  if (sc === 'K') { end = 300; steadyFrom = 240; }
  if ((sc === 'B' || sc === 'C') && n > MAXP + 1) { end = 600; steadyFrom = 540; }   // more players than the cap, spread out: it takes minutes to come to rest, swap by swap
  if (LONG) { end = LONG; steadyFrom = end - 60; }
  const P = Array.from({ length: n }, (_, i) => {
    const p = { i, id: 'p' + String(rnd()).slice(2, 12), pub: 'k' + i, at: 0, x: SPOT[0], z: SPOT[1], mode: 'circle', v: 12, r: 40, cx: SPOT[0], cz: SPOT[1], ang: rnd() * 6.28, th: rnd() * 6.28, on: false, rooms: new Map(), peers: new Map(), current: '', lastPub: -1e9, nextBeat: 0, joins: 0, leaves: 0, why: {}, lastJoinT: 0, alone: 0, maxLinked: 0, seenEver: false, loneRun: 0, loneMax: 0 };
    if (sc === 'K') { const [x, z] = [[-1250, 250], [3000, 2000], [-1250, 3500]][i]; p.x = p.cx = x; p.z = p.cz = z; p.at = i * 20; p.pub += ['Anna', 'Bob', 'Carla'][i]; }
    else if (sc === 'A') p.at = rnd() * 20;
    else if (sc === 'B') { p.at = rnd() * 20; p.x = p.cx = -4500 + rnd() * 9000; p.z = p.cz = -3000 + rnd() * 9500; }
    else if (sc === 'D') p.at = i * 3;
    else if (sc === 'E') { p.at = rnd() * 10; p.x = BOX[0] + rnd() * (BOX[2] - BOX[0]); p.z = BOX[1] + rnd() * (BOX[3] - BOX[1]); p.mode = 'bounce'; p.v = 50; p.cx = (BOX[0] + BOX[2]) / 2; p.cz = (BOX[1] + BOX[3]) / 2; }
    p.ch = createChooser({ maxp: MAXP, cell: CELL, hyst: 60, key, selfId: p.id, random: rnd });
    return p;
  });
  const members = new Map();   // room key -> Map(player -> time joined)
  const listed = new Map();    // player -> { rooms, seen: time visible, prev }
  const list = (me, t) => { const o = []; for (const [p, e] of listed) { if (p === me) continue; const v = e.seen <= t ? e.rooms : e.prev; if (v) o.push({ id: p.pub, rooms: v }); } return o; };
  const roomsOf = p => { const h = p.ch.home; if (!h || !p.rooms.has(h.key)) return null; return [[h.i, h.j, h.s], ...[...p.rooms.values()].filter(r => r.key !== h.key).sort((x, y) => (x.key < y.key ? -1 : 1)).map(r => [r.i, r.j, r.s])].slice(0, 6); };
  const publish = (p, t) => { const r = roomsOf(p); if (!r) return; const c = r.join(';'); const due = c !== p.current && t - p.lastPub >= MOVE_GAP_MS; if (due || t >= p.nextBeat) { const old = listed.get(p); listed.set(p, { rooms: r, seen: t + NET_MS * (0.5 + rnd()), prev: old ? (old.seen <= t ? old.rooms : old.prev) : null }); p.current = c; p.lastPub = t; p.nextBeat = t + BEAT_MS; } };
  const join = (p, q, t) => { p.rooms.set(q.key, { key: q.key, i: q.i, j: q.j, s: q.s, t0: t, peers: new Set() }); let m = members.get(q.key); if (!m) members.set(q.key, m = new Map()); m.set(p, t + LINK_MS * (0.5 + rnd())); p.joins++; (p.joinTimes = p.joinTimes || []).push(t); if (t >= steadyFrom * 1000) p.steadyJoins = (p.steadyJoins || 0) + 1; p.lastJoinT = t; };
  const part = (p, r) => { p.rooms.delete(r.key); const m = members.get(r.key); if (m) { m.delete(p); if (!m.size) members.delete(r.key); } p.leaves++; };
  const sync = (p, t) => {   // the real connections: everybody who has been in the room for a moment
    p.peers.forEach(q => q.rooms.clear());
    for (const r of p.rooms.values()) { r.peers.clear(); const m = members.get(r.key); if (!m) continue; const mine = m.get(p); for (const [q, ready] of m) { if (q === p || ready > t || mine > t) continue; r.peers.add(q.id); let e = p.peers.get(q.id); if (!e) p.peers.set(q.id, e = { id: q.id, rooms: new Set(), x: NaN, z: NaN, held: undefined, who: q }); e.rooms.add(r.key); e.x = q.x; e.z = q.z; } }
    for (const [id, e] of p.peers) if (!e.rooms.size) p.peers.delete(id);
    const d = e => Math.hypot(e.x - p.x, e.z - p.z), kn = [...p.peers.values()].sort((a, b) => d(a) - (a.held ? 50 : 0) - (d(b) - (b.held ? 50 : 0)));
    kn.forEach((e, k) => { e.held = k < MAXP; });
    for (const e of p.peers.values()) { const back = e.who.peers.get(p.id); if (e.since === undefined) e.since = t; if (back && back.held !== false) e.lastRx = t; }
  };
  const move = (p, dt) => {
    if (p.mode === 'circle') { p.ang += p.v / p.r * dt; p.x = p.cx + Math.cos(p.ang) * p.r; p.z = p.cz + Math.sin(p.ang) * p.r; }
    else if (p.mode === 'line') { p.x += Math.sin(p.th) * p.v * dt; p.z += Math.cos(p.th) * p.v * dt; }
    else if (p.mode === 'bounce') { p.x += Math.sin(p.th) * p.v * dt; p.z += Math.cos(p.th) * p.v * dt; if (p.x < BOX[0] || p.x > BOX[2] || p.z < BOX[1] || p.z > BOX[3]) { p.x = Math.min(BOX[2], Math.max(BOX[0], p.x)); p.z = Math.min(BOX[3], Math.max(BOX[1], p.z)); p.th = Math.atan2(p.cx - p.x, p.cz - p.z) + (rnd() - 0.5); } }
  };
  let lastChange = 0;
  for (let t = 0; t <= end * 1000; t += STEP_MS) {
    if (sc === 'C') for (const p of P) if (p.i % 2) { if (t === 60000) { p.mode = 'line'; p.v = 40; } else if (t === 100000) p.th += Math.PI; else if (t === 140000) { p.mode = 'circle'; p.v = 12; p.x = SPOT[0] + 40; p.z = SPOT[1]; } }
    if (sc === 'K') {   // Anna holds the closer one (Carla); Carla drives 4 km farther; Anna moves over to Bob
      const sees = q => [...P[0].peers.values()].some(e => e.who === q && e.held);
      if (t === 165000) { kResult.a = sees(P[2]) && !sees(P[1]); P[2].cz = 7500; P[2].z = 7500; }
      if (t === 300000) kResult.b = sees(P[1]) && P[0].peers.size === 1;
    }
    for (const p of P) {
      if (!p.on) { if (t >= p.at * 1000) { p.on = true; p.tick = t + rnd() * 500; } else continue; }
      move(p, STEP_MS / 1000); sync(p, t);
      if (t < p.tick) continue;
      p.tick = t + 500;
      const o = p.ch.step(t, p.x, p.z, list(p, t), p.rooms, p.peers);
      for (const l of o.leave) { p.why[l.why] = (p.why[l.why] || 0) + 1; part(p, l.r); }
      for (const q of o.join) join(p, q, t);
      if (o.leave.length || o.join.length) lastChange = t;
      if (TRACE && (o.leave.length || o.join.length)) console.log((t / 1000).toFixed(1).padStart(6), p.pub.padEnd(4), 'home', p.ch.home && p.ch.home.key.split(':').slice(2).join(','), 'leave', o.leave.map(l => l.r.key.split(':').slice(2).join(',') + '(' + l.why + ')').join(' '), 'join', o.join.map(q => q.key.split(':').slice(2).join(',')).join(' '), '| linked', p.peers.size);
      publish(p, t);
    }
    for (const p of P) {   // who is seen: both ends hold each other (only the held are sent to)
      if (!p.on) continue;
      let seen = 0; for (const e of p.peers.values()) { const back = e.who.peers.get(p.id); if (e.held && back && back.held !== false) seen++; }
      p.seen = seen; p.maxLinked = Math.max(p.maxLinked, p.peers.size);
      if (t - p.at * 1000 > 4000 && !seen) { p.alone += STEP_MS / 1000; p.loneRun += STEP_MS / 1000; p.loneMax = Math.max(p.loneMax, p.loneRun); } else p.loneRun = 0;
    }
  }
  const mins = (end - steadyFrom) / 60, joinsTotal = P.reduce((s, p) => s + p.joins, 0), steady = P.reduce((s, p) => s + (p.steadyJoins || 0), 0) / n / mins;
  let peakMin = 0; for (const p of P) { const j = p.joinTimes || []; for (let q = 0, w = 0; q < j.length; q++) { while (j[q] - j[w] >= 60000) w++; peakMin = Math.max(peakMin, q - w + 1); } }
  const worstRooms = Math.max(0, ...[...members.values()].map(m => m.size));
  const why = {}; for (const p of P) for (const [k, v] of Object.entries(p.why)) why[k] = (why[k] || 0) + v;
  if (TRACE) for (const p of P) console.log(p.pub, 'rooms', [...p.rooms.values()].map(r => r.key.split(':').slice(2).join(',') + '=' + r.peers.size).join(' '), 'seen', p.seen, 'linked', p.peers.size, 'x', Math.round(p.x), Math.round(p.z));
  return { peakMin, sc, n, seed, steady, joinsTotal, joinsMaxPlayer: Math.max(...P.map(p => p.joins)), lastChange: lastChange / 1000, end, seenMin: Math.min(...P.map(p => p.seen)), seenMed: P.map(p => p.seen).sort((x, y) => x - y)[n >> 1], linkedMax: Math.max(...P.map(p => p.maxLinked)), linkedEnd: Math.max(...P.map(p => p.peers.size)), rooms: members.size, biggest: worstRooms, roomsEach: Math.max(...P.map(p => p.rooms.size)), aloneMax: Math.max(...P.map(p => p.loneMax)), why };
}
let bad = 0;
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
if (!process.argv.includes('--sc') || process.argv.includes('--konly')) {   // the closest players with a cap of 1, as in tools/p2p/closest.mjs
  const keep = MAXP; MAXP = 1; let good = 0;
  for (let s = 1; s <= SEEDS; s++) { run('K', 3, s + (+arg('kseed', 0))); if (kResult.a && kResult.b) good++; else console.log('closest seed', s, JSON.stringify(kResult)); }
  console.log(`K cap 1: Anna holds the closer player, then moves over when that player drives away: ${good} of ${SEEDS} seeds`); if (good < SEEDS) bad++;
  MAXP = keep;
}
if (!process.argv.includes('--konly')) for (const sc of SCS) for (const n of NS) {
  const rs = []; for (let s = 1; s <= SEEDS; s++) rs.push(run(sc, n, s));
  const mx = k => Math.max(...rs.map(r => r[k])), mn = k => Math.min(...rs.map(r => r[k]));
  const why = {}; for (const r of rs) for (const [k, v] of Object.entries(r.why)) why[k] = (why[k] || 0) + v;
  // settled: 0 room joins a minute at rest; driving (E, and C while the wave is out) is allowed what moving costs
  const limit = sc === 'E' ? 8 : 0.5, fail = mx('steady') > limit;
  if (fail) bad++;
  console.log(`${sc} n=${String(n).padEnd(3)} joins/min/player steady med ${med(rs.map(r => r.steady)).toFixed(2)} max ${mx('steady').toFixed(2)}  joins per player in the run ${(med(rs.map(r => r.joinsTotal)) / n).toFixed(1)} (most ${mx('joinsMaxPlayer')}, most in a minute ${mx('peakMin')})  last change ${med(rs.map(r => r.lastChange)).toFixed(0)} of ${rs[0].end} s  seen min ${mn('seenMin')} med ${med(rs.map(r => r.seenMed))}  linked max ${mx('linkedMax')} end ${mx('linkedEnd')}  rooms ${med(rs.map(r => r.rooms))} biggest ${mx('biggest')} each ${mx('roomsEach')}  alone max ${mx('aloneMax').toFixed(0)} s  ${fail ? 'NOT SETTLED ' : ''}${VERBOSE ? JSON.stringify(why) : ''}`);
}
process.exit(bad ? 1 : 0);
