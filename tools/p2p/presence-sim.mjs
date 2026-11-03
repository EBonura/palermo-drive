// Presence traffic with K simulated players in one Node process (no browsers): each publishes room lists on the real Nostr relays under a test topic of its own, and one more reads
// them. Prints, per minute, what the reader received and what the players sent, and what the relays refused. Uses the real src/p2p/presence.js.
//   node tools/p2p/presence-sim.mjs --k 10 --mins 3
import { createPresence } from '../../src/p2p/presence.js';
import { PRESENCE_RELAYS } from '../../src/p2p/relays.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const K = +arg('k', 10), MINS = +arg('mins', 3), topic = 'palermo-drive-p2p-exp-1:presence:sim' + Date.now().toString(36);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const players = [], reader = createPresence({ topic, urls: PRESENCE_RELAYS, onChange: () => {} });
reader.start();
for (let i = 0; i < K; i++) {
  const p = createPresence({ topic, urls: PRESENCE_RELAYS, onChange: () => {} }); p.start();
  p.cell = [Math.floor(Math.random() * 40 - 20), Math.floor(Math.random() * 40 - 20)];
  players.push(p); await sleep(300);
}
const publishAll = () => players.forEach(p => { if (Math.random() < 0.5) p.cell[0] += 1; p.publish([[...p.cell, 0]]); });   // half of them cross a cell border every 30 s (a car at about 17 m/s takes 30 s per cell)
publishAll();
let last = { ...reader.stats }, lastTx = 0;
const tx = () => players.reduce((s, p) => s + p.stats.txEvents, 0);
for (let m = 1; m <= MINS; m++) {
  for (let t = 0; t < 2; t++) { await sleep(30000); publishAll(); }
  const s = reader.stats, n = tx();
  console.log(`minute ${m}: reader got ${s.rxEvents - last.rxEvents} events, ${s.rxBytes - last.rxBytes} bytes (${reader.size} players known); players sent ${n - lastTx} events; refused so far ${players.reduce((a, p) => a + p.stats.refused, 0)}, rate limited ${players.reduce((a, p) => a + p.stats.limited, 0)}`);
  last = { ...s }; lastTx = n;
}
console.log('refusals', JSON.stringify(players.flatMap(p => p.refusals).slice(0, 6)));
players.forEach(p => p.stop(true)); reader.stop(false);
await sleep(1000); process.exit(0);
