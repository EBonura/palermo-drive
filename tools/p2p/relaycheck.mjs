// The relay client (src/net.js) after its drawing code moved to src/remotes.js: load a plain build (no --p2p) with a dead relay address and report page errors.
import { start, player, sleep } from './lib.mjs';
const h = await start();
try {
  const a = await player(h, { name: 'Rel', ns: 'x', x: 0, z: 0, extra: 'relay=ws://127.0.0.1:1/ws', p2p: 'norelay' });
  await sleep(8000);
  console.log('hud pill present', await a.page.evaluate(() => !!document.querySelector('.pdn-pill')), 'errors', a.errs.filter(e => !/WebSocket|ERR_CONNECTION/.test(e)));
} finally { await h.close(); }
