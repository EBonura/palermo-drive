// Driving across a cell border. Cells are 500 m (--cell). C and A are parked either side of the border at x = -1500, B drives east along z = 250
// at --speed m/s. Prints, once a second, B's position, rooms, peers and which players are drawn, then counts flicker (a player that left and came
// back) and the connection count (duplicates when one pair shares several rooms).
//   node tools/p2p/border.mjs --root <dist> [--mode near|grid3] [--margin 150] [--cell 500] [--speed 14]
import { start, player, snap, events, sleep, arg } from './lib.mjs';
const mode = arg('mode', 'near'), margin = arg('margin', '150'), cell = +arg('cell', '500'), speed = +arg('speed', '14'), kind = arg('kind', 'nostr'), ns = 'bord' + Date.now().toString(36);
const x0 = -1500;  // a border in the 500 m grid (and in the 1000 m one: -1500 is not a multiple of 1000, so with --cell 1000 the border is at -1000, adjusted below)
const border = Math.round(x0 / cell) * cell;
const h = await start();
const q = `p2p=${kind}&mode=${mode}&margin=${margin}&cell=${cell}`;
try {
  const A = await player(h, { name: 'Anna', ns, x: border + 200, z: 250, p2p: q });     // 200 m east of the border
  const C = await player(h, { name: 'Carlo', ns, x: border - 20, z: 250, p2p: q });     // 20 m west of it
  const B = await player(h, { name: 'Bob', ns, x: border - 700, z: 250, p2p: q });
  await sleep(3000);
  const pts = [[border - 700, 250], [border + 900, 250]];
  await B.page.evaluate(() => { window.__trace = []; window.__tr = setInterval(() => { const d = window.__p2p; window.__trace.push({ t: Math.round(performance.now()), x: Math.round(window.game.car.x), rooms: [...d.rooms.values()].map(r => r.i + ',' + r.j + ':' + r.peers.size).join(' '), drawn: [...d.remotes.values()].filter(r => r.shown).map(r => r.name).sort().join('+'), peers: d.peers.size }); }, 1000); });
  const { drivePath } = await import('./lib.mjs'); await drivePath(B, pts, speed);
  const dur = Math.ceil(1600 / speed) + 6; await sleep(dur * 1000);
  const trace = await B.page.evaluate(() => window.__trace);
  for (const r of trace) console.log(JSON.stringify(r));
  const log = await events(B);
  const names = new Map(); // flicker: count first appearances vs drops by peer
  for (const e of log) if (e.ev === 'drop' || e.ev === 'firstState') { const n = names.get(e.peer) || { first: 0, drop: 0 }; n[e.ev === 'drop' ? 'drop' : 'first']++; names.set(e.peer, n); }
  console.log('B appearances/drops per peer', JSON.stringify([...names]));
  console.log('B events', JSON.stringify(log.filter(e => ['join', 'leave', 'drop', 'peerJoin', 'firstState', 'peerLeave', 'joinError'].includes(e.ev)).map(e => [e.t, e.ev, e.room && e.room.split(':').slice(-2).join(','), e.peer, e.ms ?? e.msSinceRoom ?? e.why])));
  const sb = await snap(B), sa = await snap(A), sc = await snap(C);
  console.log('connections (pcs/open) A', sa.wire.pcs, sa.wire.open, 'B', sb.wire.pcs, sb.wire.open, 'C', sc.wire.pcs, sc.wire.open, '| B rx dup', sb.stats.rxDup, 'bad', sb.stats.rxBad, 'errs', A.errs, B.errs, C.errs);
} finally { await h.close(); }
