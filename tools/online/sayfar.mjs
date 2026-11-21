// A phrase is heard up to 1 km away (SAY_FAR, relay-worker/src/proto.rs): close by as a bubble and a line, between 400 m and 1 km as a line with the sender's name, beyond 1 km not at all.
//   tools/release/withbrowser.sh node tools/online/sayfar.mjs --root <dist built with --test-relay> [--relay ws://127.0.0.1:8787/r]
import { start, player, until, sleep } from './lib.mjs';
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const lines = P => P.page.evaluate(() => [...document.querySelectorAll('.mpx-line')].map(e => e.textContent));
try {
  const A = await player(h, { name: 'Anna', x: 100, z: 100 });
  const B = await player(h, { name: 'Bob', x: 800, z: 100 });   // 700 m away: on the maps, not a car
  const C = await player(h, { name: 'Cetta', x: 1300, z: 100 });   // 1.2 km away: out of reach
  await sleep(8000);
  const sent = await A.page.evaluate(() => window.__p2p.say(30));
  ok('Anna can talk with Bob 700 m away', sent === true, String(sent));
  ok('Bob reads it with Anna\'s name', !!await until(async () => (await lines(B)).some(t => /Anna/.test(t) && /babbaluci/.test(t)), 8000), JSON.stringify(await lines(B)));
  await sleep(1500);
  ok('Cetta, 1.2 km away, hears nothing', !(await lines(C)).some(t => /babbaluci/.test(t)), JSON.stringify(await lines(C)));
  const errs = [...A.errs, ...B.errs, ...C.errs]; ok('no page errors', !errs.length, errs.join(' | '));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
