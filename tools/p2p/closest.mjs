// The limit is a number of players, not a distance: with ?maxp=1 Anna holds exactly one other player, the closest one in the city, and swaps when somebody closer shows up
// (and not before, by a margin). Bob is about 5 km away, Carla about 4 km the other way; then Carla drives far off and Anna should move over to Bob.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/closest.mjs --root <dist>
import { start, player, sleep } from './lib.mjs';
const h = await start(), ns = 'cl' + Date.now().toString(36);
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(70), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const until = async (fn, ms) => { for (let t = 0; t < ms; t += 500) { const v = await fn(); if (v) return v; await sleep(500); } return null; };
const names = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].filter(r => r.shown).map(r => r.name).sort().join('+'));
const place = (P, x, z) => P.page.evaluate(([x, z]) => { const c = window.game.car; c.x = x; c.z = z; c.vx = c.vz = 0; }, [x, z]);
try {
  const o = (n, x, z) => ({ name: n, ns, x, z, extra: `maxp=1&at=${x},${z},0&relays=wss://nos.lol,wss://nostr.chaima.info`, isolated: true });
  // one at a time, each waits until it has left the default spawn cell (where every page starts for a few seconds and meets everybody else who is there)
  const left = P => until(() => P.page.evaluate(() => { const r = [...window.__p2p.rooms.values()]; return window.__p2p.home() && !r.some(x => x.i === 0 && x.j === 0); }), 90000);
  const A = await player(h, o('Anna', -1250, 250)); await left(A);
  const B = await player(h, o('Bob', 3000, 2000)); await left(B);
  const C = await player(h, o('Carla', -1250, 3500)); await left(C);
  const t0 = Date.now();
  ok('Anna holds one player, the closer of the two (Carla, 3.2 km)', await until(async () => (await names(A)) === 'Carla', 150000), await names(A));
  console.log('  after', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await sleep(15000); for (let i = 0; i < 60 && (await names(A)) !== 'Carla'; i++) await sleep(1000);   // a room swap can leave a gap of a few seconds
  const seen = new Set(); let max = 0;
  for (let i = 0; i < 40; i++) { const n = await names(A); seen.add(n); max = Math.max(max, n ? n.split('+').length : 0); await sleep(500); }
  ok('Anna ends up with Carla, and never holds two players at once', max <= 1 && (await names(A)) === 'Carla', JSON.stringify([...seen]));
  await place(C, -1250, 7500);   // Carla drives 7 km south: Bob (5 km) is now the closest
  ok('Carla drives away: Anna moves over to Bob', await until(async () => (await names(A)) === 'Bob', 150000), await names(A));
  console.log('  Anna events', JSON.stringify(await A.page.evaluate(() => window.__p2p.log.filter(e => ['join', 'leave', 'unheld', 'far', 'drop'].includes(e.ev)).map(e => [e.t, e.ev, e.room ? e.room.split(':').slice(2).join(',') : e.peer].join(' ')))));
  console.log('  errors', [A, B, C].flatMap(p => p.errs).slice(0, 3));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
