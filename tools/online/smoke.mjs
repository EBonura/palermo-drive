// Two players on one relay see each other: names, vehicles and liveries arrive, a driving car is drawn where it is, and nobody has a page error.
//   tools/release/withbrowser.sh node tools/online/smoke.mjs --root <dist built with --test-relay> [--relay ws://127.0.0.1:8787/r]
import { start, player, drivePath, until, sleep } from './lib.mjs';
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(62), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const seen = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => ({ name: r.name, type: r.type, liv: r.model && r.model.livery, x: r.marker.x, z: r.marker.z })));
try {
  const A = await player(h, { name: 'Anna', x: 100, z: 100 });
  const B = await player(h, { name: 'Bob', x: 160, z: 100, th: 1, extra: 'veh=motorino&liv=rosso' });
  ok('both are drawn by the other', await until(async () => (await seen(A)).length === 1 && (await seen(B)).length === 1, 60000, 250));
  await sleep(1500);
  const [a, b] = [(await seen(A))[0], (await seen(B))[0]];
  ok('Anna sees Bob with his name, vehicle and livery', a.name === 'Bob' && a.type === 'motorino' && a.liv === 'rosso', JSON.stringify(a));
  ok('Bob sees Anna as a calessino', b.name === 'Anna' && b.type === 'calessino', JSON.stringify(b));
  ok('the relay gave each a handle', (await A.page.evaluate(() => window.__p2p.relay())).ready && (await B.page.evaluate(() => window.__p2p.relay())).handle > 0);
  // Bob drives 120 m east along a line; Anna's picture of him follows within a few metres
  await drivePath(B, [[160, 100], [280, 100]], 12);
  await sleep(6000);
  const truth = await B.page.evaluate(() => [window.game.car.x, window.game.car.z]), drawn = (await seen(A))[0];
  const err = Math.hypot(drawn.x - truth[0], drawn.z - truth[1]);
  ok('a driving car is drawn within 8 m of where it is', err < 8, `${err.toFixed(1)} m (Bob at ${truth.map(Math.round)}, drawn ${[drawn.x, drawn.z].map(Math.round)})`);
  const st = await A.page.evaluate(() => ({ ...window.__p2p.stats }));
  ok('nothing bad, nothing thrown on Anna', st.rxBad === 0 && st.threw === 0, JSON.stringify(st));
  ok('no page errors', !A.errs.length && !B.errs.length, JSON.stringify([A.errs, B.errs]));
} finally { await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
