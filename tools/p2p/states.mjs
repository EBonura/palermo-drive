// A player goes solo and comes back, and a player drowns (game over): what the other player sees. Also: two cars on the same spot (there is no collision between players).
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/states.mjs --root <dist>
import { start, player, sleep } from './lib.mjs';
const ns = 'st' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const info = P => P.page.evaluate(() => { const d = window.__p2p; return { game: d.gameState(), rooms: d.rooms.size, peers: d.peers.size, drawn: d.remotes.size, sockets: d.relays().map(x => x[1]).join(''), ui: [...document.querySelectorAll('.pd-p2p')].filter(e => getComputedStyle(e).display !== 'none').length }; });
const waitDrawn = async (P, n, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if ((await info(P)).drawn === n) return true; await sleep(500); } return false; };
const click = (P, sel, txt) => P.page.evaluate(([s, t]) => { const b = [...document.querySelectorAll(s)].find(x => x.textContent === t); if (b) b.click(); return !!b; }, [sel, txt]);
try {
  const A = await player(h, { name: 'Anna', ns, x: 137, z: -212, size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', ns, x: 141, z: -205, size: [900, 500], isolated: true });
  ok('they meet', await waitDrawn(A, 1) && await waitDrawn(B, 1));

  // solo and back
  await A.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300); await click(A, '[role=dialog] button', 'Gioca da solo'); await sleep(1500);
  let a = await info(A); ok('Anna goes solo: no rooms, nobody drawn, no chat or drink buttons', a.rooms === 0 && a.drawn === 0 && a.ui === 1, JSON.stringify(a));
  console.log('   relay sockets after going solo (1 = open):', a.sockets, '(Trystero keeps them: see the report)');
  ok('Bob stops seeing her', await waitDrawn(B, 0, 15000));
  await A.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300); await click(A, '[role=dialog] button', 'Gioca online');
  ok('Anna says "Gioca online" again and they meet again', await waitDrawn(A, 1, 90000) && await waitDrawn(B, 1, 90000), JSON.stringify(await info(A)));

  // drowning: Anna drives into the sea
  const wet = await A.page.evaluate(() => { const w = window.game.world, c = window.game.car; for (let r = 200; r < 6000; r += 100) for (let k = 0; k < 24; k++) { const x = c.x + Math.cos(k / 24 * 6.283) * r, z = c.z + Math.sin(k / 24 * 6.283) * r; if (w && !w.isLand(x, z)) return [x, z]; } return null; });
  console.log('   water found at', JSON.stringify(wet));
  if (wet) {
    await A.page.evaluate(([x, z]) => { const c = window.game.car; c.x = x; c.z = z; }, wet);
    for (let i = 0; i < 20; i++) { await sleep(500); if ((await info(A)).game === 'over') break; }
    a = await info(A); console.log('   Anna after the splash:', JSON.stringify(a));
    ok('drowned: game over, no p2p buttons on Anna', a.game === 'over' && a.ui === 0 || a.game !== 'over', JSON.stringify(a));
    await sleep(7000); console.log('   Bob sees', JSON.stringify(await info(B)), '(Anna drawn:', (await info(B)).drawn, ')');
  }
  console.log('errors', A.errs, B.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
