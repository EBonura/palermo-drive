// WebSocket traffic of one real client (Anna), split into presence frames (kind 30078 events and their subscription) and room signalling (Trystero), per minute, after everybody has met.
// --pair adds a second real page far away; --sims K adds K simulated players that only publish presence (src/p2p/presence.js, in this Node process), all on the test topic of this run.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/traffic.mjs --root <dist> [--pair] [--sims 9] [--secs 150]
import { start, player, sleep, arg } from './lib.mjs';
import { createPresence } from '../../src/p2p/presence.js';
import { PRESENCE_RELAYS } from '../../src/p2p/relays.js';
const SECS = +arg('secs', 150), SIMS = +arg('sims', 0), PAIR = process.argv.includes('--pair'), ns = 'tr' + Date.now().toString(36), h = await start();
const tally = () => ({ pres: { n: 0, b: 0 }, rooms: { n: 0, b: 0 } });
try {
  const A = await player(h, { name: 'Anna', ns, x: -1250, z: 250, extra: 'at=-1250,250,0', isolated: true });
  const t = tally(); await A.cdp.send('Network.enable');
  const f = e => { const d = e.response.payloadData || '', o = /30078|"EOSE","pd/.test(d.slice(0, 400)) ? t.pres : t.rooms; o.n++; o.b += d.length; };
  A.cdp.on('Network.webSocketFrameSent', f); A.cdp.on('Network.webSocketFrameReceived', f);
  const B = PAIR ? await player(h, { name: 'Bob', ns, x: 3000, z: 2000, extra: 'at=3000,2000,0', isolated: true }) : null;
  const sims = [];
  for (let i = 0; i < SIMS; i++) {
    const p = createPresence({ topic: `palermo-drive-p2p-exp-1:presence:${ns}`, urls: PRESENCE_RELAYS, onChange: () => {} }); p.start(); p.publish([[-20 + ((i * 7) % 40), -20 + ((i * 11) % 40), 0]]); sims.push(p); await sleep(400);
  }
  if (B) for (let i = 0; i < 90; i++) { await sleep(1000); if (await A.page.evaluate(() => window.__p2p.remotes.size) && await B.page.evaluate(() => window.__p2p.remotes.size)) break; }
  await sleep(10000);
  const base = JSON.stringify(t), s0 = await A.page.evaluate(() => ({ ...window.__p2p.presence.stats })), w0 = JSON.parse(base);
  for (let m = 1; m <= SECS / 60; m++) { await sleep(60000); }
  const s1 = await A.page.evaluate(() => ({ ...window.__p2p.presence.stats, known: window.__p2p.presence.size, rooms: window.__p2p.rooms.size, beat: window.__p2p.presence.beatMs() }));
  const mins = SECS / 60, per = k => ({ framesPerMin: +((t[k].n - w0[k].n) / mins).toFixed(1), bytesPerMin: Math.round((t[k].b - w0[k].b) / mins) });
  console.log(`players: ${1 + (PAIR ? 1 : 0) + SIMS} (Anna measured over ${SECS} s)`);
  console.log('  presence frames per minute', JSON.stringify(per('pres')), ' (events: sent', s1.txEvents - s0.txEvents, 'received', s1.rxEvents - s0.rxEvents, 'refused', s1.refused, ') players known', s1.known, 'beat', s1.beat);
  console.log('  room signalling frames per minute', JSON.stringify(per('rooms')), 'rooms joined now', s1.rooms);
  console.log('  refusals', JSON.stringify(await A.page.evaluate(() => window.__p2p.presence.refusals)), 'errors', A.errs.slice(0, 2));
  sims.forEach(p => p.stop(true));
} finally { await h.close(); }
process.exit(0);
