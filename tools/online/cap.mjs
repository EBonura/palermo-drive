// More players than the cap. One game page and a few more bots than the relay's set holds (tools/online/bot.mjs) on one relay, spread along a street. The page asks the relay for 12 (?k=12) and draws at most the nearest 8 as cars (?shown=8:
// the game's own cap is 32, 12 on a touch screen) and the others are held as a ring and a name on the maps. Then the farthest bot drives up beside the page and takes the place of the farthest one it knows, and a bot that leaves is gone from the page.
//   tools/release/withbrowser.sh node tools/online/cap.mjs --root <dist built with --test-relay> [--relay ws://127.0.0.1:8787/r]
import { start, player, sleep, until, startBot, arg } from './lib.mjs';
const h = await start({ sim: { k: 12 } }), K = +arg('k', 12), SHOWN = Math.min(K, 8);
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const view = P => P.page.evaluate(() => { const d = window.__p2p; return { tracked: d.peers.size, drawn: d.cars(), rings: d.remotes.size - d.cars(), names: [...d.remotes.values()].filter(r => !r.far).map(r => r.name).sort(), known: [...d.peers.values()].map(p => p.name).sort(), link: d.relay().state }; });
const X0 = 100, Z0 = 100, bots = [];
try {
  const A = await player(h, { name: 'Anna', x: X0, z: Z0, extra: `k=${K}&shown=${SHOWN}` });
  // 16 bots along the street, 25 m apart, the nearest 25 m from Anna: Bot00 .. Bot15
  for (let i = 0; i < K + 4; i++) bots.push(await startBot(h.relayUrl, { name: 'Bot' + String(i).padStart(2, '0'), x: X0 + 25 * (i + 1), z: Z0, ip: '10.2.0.' + (i + 1), wantK: K }));
  const tick = () => { for (const b of bots) b.state({ x: b.x, z: b.z }); };
  const timer = setInterval(tick, 200); tick();
  ok(`Anna holds ${K} players and is shown ${SHOWN} cars`, await until(async () => { const v = await view(A); return v.drawn === SHOWN && v.tracked === K; }, 40000, 300), JSON.stringify(await view(A)));
  await sleep(2000);
  let v = await view(A);
  ok('the ' + SHOWN + ' drawn are the nearest', JSON.stringify(v.names) === JSON.stringify(bots.slice(0, SHOWN).map(b => b.name).sort()), JSON.stringify(v.names));
  ok('the ' + K + ' held are the nearest', JSON.stringify(v.known) === JSON.stringify(bots.slice(0, K).map(b => b.name).sort()), JSON.stringify(v.known));
  ok('no bot is told about more than ' + K + ' players (and the relay of protocol 3 may add two beyond its radius)', bots.every(b => b.entered.size <= K + 2), JSON.stringify(bots.map(b => b.entered.size)));
  // the farthest bot drives up beside Anna: it takes the place of the farthest she holds (once the relay recomputes her set, within a second or two)
  const far = bots[bots.length - 1]; far.x = X0 + 3; far.z = Z0 + 3;
  ok('a far bot that drives up beside Anna is drawn, the farthest one drawn is not', await until(async () => { const n = (await view(A)).names; return n.includes(far.name) && n.length === SHOWN && !n.includes('Bot' + String(SHOWN - 1).padStart(2, '0')); }, 20000, 300), JSON.stringify((await view(A)).names));
  ok('she still holds ' + K, (await view(A)).tracked === K, JSON.stringify((await view(A)).tracked));
  // a bot that leaves is gone from the page
  const gone = bots.shift(); await gone.close();
  ok('a bot that disconnects leaves the page', await until(async () => !(await view(A)).known.includes(gone.name), 10000, 250), JSON.stringify((await view(A)).known));
  ok('and the relay fills the place with the next nearest', await until(async () => (await view(A)).tracked === K, 15000, 250), JSON.stringify((await view(A)).tracked));
  clearInterval(timer);
  const st = await A.page.evaluate(() => ({ ...window.__p2p.stats }));
  ok('nothing bad, nothing thrown, no page error', st.rxBad === 0 && st.threw === 0 && !A.errs.length, JSON.stringify({ ...st, errs: A.errs }));
} finally { for (const b of bots) await b.close(); await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
