// A player goes solo and comes back, and a player drowns (game over): what the other player sees, and whether a solo page holds any connection at all.
//   tools/release/withbrowser.sh node tools/online/switch.mjs --root <dist built with --test-relay> [--relay ws://127.0.0.1:8787/r]
import { start, player, sleep, until } from './lib.mjs';
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const info = P => P.page.evaluate(() => { const d = window.__p2p; return { game: d.gameState(), peers: d.peers.size, drawn: d.remotes.size, link: d.relay().state, handle: d.relay().handle, ui: [...document.querySelectorAll('.pd-online')].filter(e => getComputedStyle(e).display !== 'none').length }; });
const waitDrawn = async (P, n, ms = 60000) => !!(await until(async () => (await info(P)).drawn === n, ms, 250));
const click = (P, sel, txt) => P.page.evaluate(([s, t]) => { const b = [...document.querySelectorAll(s)].find(x => x.textContent === t); if (b) b.click(); return !!b; }, [sel, txt]);
const live = () => h.relay ? h.relay.conns().length : null;   // connections the simulator holds (not known with another relay)
try {
  const A = await player(h, { name: 'Anna', x: 137, z: -212, size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', x: 141, z: -205, size: [900, 500], isolated: true });
  ok('they meet', await waitDrawn(A, 1) && await waitDrawn(B, 1));
  ok('both hold one connection', (await info(A)).link === 'open' && (live() === null || live() === 2), String(live()));

  // solo and back
  await A.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300); await click(A, '[role=dialog] button', 'Gioca da solo'); await sleep(1500);
  let a = await info(A); ok('Anna goes solo: nobody drawn, no talk or drink buttons, no connection', a.drawn === 0 && a.peers === 0 && a.ui === 0 && a.link === 'idle', JSON.stringify(a));
  ok('the relay holds only Bob', live() === null || live() === 1, String(live()));
  for (const sec of [10, 20, 30]) { await sleep(10000); const x = await info(A); ok(`still no connection ${sec} s after going solo`, x.link === 'idle' && (live() === null || live() === 1), JSON.stringify(x)); }
  ok('Bob stops seeing her', await waitDrawn(B, 0, 15000));
  await A.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300); await click(A, '[role=dialog] button', 'Gioca online');
  ok('Anna says "Gioca online" again and they meet again', await waitDrawn(A, 1, 90000) && await waitDrawn(B, 1, 90000), JSON.stringify(await info(A)));
  ok('she holds a connection again', (await info(A)).link === 'open' && (live() === null || live() === 2), String(live()));
  // the switch in Options (src/ui.js) is the same two answers as the card
  await A.page.evaluate(() => dispatchEvent(new CustomEvent('pd-net-mode', { detail: false }))); await sleep(1500);
  ok('the Options switch to offline closes it too', (await info(A)).link === 'idle' && (await info(A)).drawn === 0);
  await A.page.evaluate(() => dispatchEvent(new CustomEvent('pd-net-mode', { detail: true })));
  ok('and back on again', await waitDrawn(A, 1, 90000));

  // drowning: Anna drives into the sea
  const wet = await A.page.evaluate(() => { const w = window.game.world, c = window.game.car; for (let r = 200; r < 6000; r += 100) for (let k = 0; k < 24; k++) { const x = c.x + Math.cos(k / 24 * 6.283) * r, z = c.z + Math.sin(k / 24 * 6.283) * r; if (w && !w.isLand(x, z)) return [x, z]; } return null; });
  console.log('   water found at', JSON.stringify(wet));
  if (wet) {
    await A.page.evaluate(([x, z]) => { const c = window.game.car; c.x = x; c.z = z; }, wet);
    for (let i = 0; i < 20; i++) { await sleep(500); if ((await info(A)).game === 'over') break; }
    a = await info(A); console.log('   Anna after the splash:', JSON.stringify(a));
    ok('drowned: game over, no online buttons on Anna', a.game === 'over' && a.ui === 0, JSON.stringify(a));
    ok('Bob stops drawing her once she is not sending (within the stale time)', await waitDrawn(B, 0, 15000), JSON.stringify(await info(B)));
  }
  ok('no page errors', !A.errs.length && !B.errs.length, JSON.stringify([A.errs, B.errs]));
} finally { await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
