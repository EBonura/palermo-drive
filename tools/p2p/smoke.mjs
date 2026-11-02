import { start, player, snap, events, sleep, arg } from './lib.mjs';
const h = await start(); const ns = 'smoke' + Date.now().toString(36);
try {
  const a = await player(h, { name: 'Anna', ns, x: 100, z: 100 });
  const b = await player(h, { name: 'Bob', ns, x: 160, z: 100, th: 1 });
  console.log('loaded; vis', await a.page.evaluate(() => document.visibilityState), await b.page.evaluate(() => document.visibilityState));
  for (let i = 0; i < 12; i++) { await sleep(2500); const [sa, sb] = [await snap(a), await snap(b)]; console.log(i * 2.5, 'A', JSON.stringify([sa.rooms, sa.peers, sa.drawn, sa.stats.rxMsgs]), 'B', JSON.stringify([sb.rooms, sb.peers, sb.drawn, sb.stats.rxMsgs])); if (sa.drawn && sb.drawn) break; }
  console.log('A events', JSON.stringify(await events(a)).slice(0, 1500)); console.log('errs', a.errs, b.errs);
  console.log('relays', JSON.stringify(await a.page.evaluate(() => window.__p2p.relays())));
  await a.page.screenshot({ path: arg('shot', '/tmp/p2p-smoke.png') });
} finally { await h.close(); }
