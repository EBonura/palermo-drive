// A player comes back: a page refresh, and a stretch away from the game (the pause menu or the Garage, where the game stops sending).
// Anna stays put. Bob (1) is refreshed and (2) pauses for --away seconds with a new livery, as after buying a vehicle. After each, Anna must
// be drawing Bob and Bob must be drawing Anna, with the right name and livery. Exit code 1 if not.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/resume.mjs --root <dist built with --p2p> [--away 10]
import { start, player, sleep, arg } from './lib.mjs';
const away = +arg('away', '10'), ns = 'resume' + Date.now().toString(36);
const h = await start();
let bad = 0, A, B;
// what a player knows about the others: name, livery, whether drawn, and whether something arrived from them in the last 1.5 s
const view = p => p.page.evaluate(() => { const d = window.__p2p, now = performance.now(); return { id: d.selfId.slice(0, 4), peers: [...d.peers.values()].map(q => `${q.name}/${q.id.slice(0, 4)}:L${q.livery}:${q.shown ? 'shown' : 'hidden'}:${now - q.lastRx < 1500 ? 'live' : 'quiet'}`), drawn: [...d.remotes.values()].length, bad: d.stats.rxBad, tx: d.stats.txMsgs, rx: d.stats.rxMsgs, state: window.game.state, rooms: d.rooms.size }; });
const good = (v, who, oldSeen) => v.peers.length === 1 && v.peers[0].startsWith(who + '/') && /:shown:live$/.test(v.peers[0]) && v.drawn === 1 && (oldSeen == null || !v.peers[0].includes(oldSeen + ':'));
async function check(label, A, B, oldSeen) {
  let ok = false; const t0 = Date.now(); let a, b;
  while (Date.now() - t0 < 20000) { a = await view(A); b = await view(B); if (good(a, 'Bob', oldSeen) && good(b, 'Anna')) { ok = true; break; } await sleep(250); }
  console.log(label.padEnd(34), ok ? 'OK  ' : 'FAIL', ok ? `after ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'never', '| Anna', a.id, 'sees', JSON.stringify(a.peers), 'bad', a.bad, `tx ${a.tx} rx ${a.rx} ${a.state}`, '| Bob', b.id, 'sees', JSON.stringify(b.peers), 'bad', b.bad, `tx ${b.tx} rx ${b.rx} ${b.state}`);
  if (!ok) bad++;
}
try {
  A = await player(h, { name: 'Anna', ns, x: -300, z: 250 });
  B = await player(h, { name: 'Bob', ns, x: -290, z: 250 });
  await check('baseline', A, B);

  // 1. refresh: the same page again, a new tab session, a new peer id
    await B.page.reload({ waitUntil: 'domcontentloaded' });
  await B.page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await B.page.evaluate(() => { const c = window.game.car; c.x = -290; c.z = 250; c.vx = c.vz = 0; });
  await check('after refreshing Bob', A, B);

  // 2. Bob opens the pause menu and then the Garage to buy a vehicle: the game is paused for as long as he is there, so nothing is sent
  const state = P => P.page.evaluate(() => window.__p2p.gameState());
  const away_ = async (P, secs) => {
    await P.page.keyboard.press('Escape'); await sleep(700);
    console.log('   ', P.name, 'state', await state(P));
    const tx0 = await P.page.evaluate(() => window.__p2p.stats.txMsgs); await sleep(secs * 1000);
    console.log('   ', P.name, 'sent', (await P.page.evaluate(() => window.__p2p.stats.txMsgs)) - tx0, 'messages while paused');
    await P.page.keyboard.press('Escape'); await sleep(700);
    console.log('   ', P.name, 'state', await state(P));
  };
  const was = (await view(A)).peers[0].replace(/:(shown|hidden):.*/, '').replace(/^.*(:L\d+)$/, '$1');
  await B.page.evaluate(() => { window.game.car.livery = 'rosso'; });
  await away_(B, away);
  await check(`after Bob paused ${away} s, new livery`, A, B, was);

  // 3. and the other way round
  await away_(A, away);
  await check(`after Anna paused ${away} s`, A, B);
  for (const [n, P] of [['Anna', A], ['Bob', B]]) console.log(n, 'events', JSON.stringify((await P.page.evaluate(() => window.__p2p.log)).filter(e => ['drop', 'peerJoin', 'peerLeave', 'firstState'].includes(e.ev)).map(e => [e.t, e.ev, e.peer, e.why ?? e.room])));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
