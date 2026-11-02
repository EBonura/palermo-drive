// Cold start and reliability of the signalling services, without the game: two bot pages enter a brand new room, one after the other.
// Reports how long the second one needs to find the first and how many pairs never connect within 30 s. N trials per strategy.
//   node tools/p2p/cold.mjs [--kinds nostr,torrent,mqtt] [--n 8] [--relays wss://a,wss://b]
import { start, bots, closeAll, sleep, arg } from './lib.mjs';
const kinds = arg('kinds', 'nostr,torrent,mqtt').split(','), N = +arg('n', 8), relays = arg('relays', '');
const h = await start({ root: '.' });
try {
  for (const kind of kinds) {
    const times = []; let fail = 0, errs = 0;
    for (let k = 0; k < N; k++) {
      const room = `cold${Date.now().toString(36)}${k}`;
      const [a] = await bots(h, { n: 1, room, kind, x: 0, z: 0, relays }); await sleep(1500);
      const [b] = await bots(h, { n: 1, room, kind, x: 0, z: 0, relays });
      let ok = null;
      for (let i = 0; i < 60 && ok == null; i++) { await sleep(500); const s = await b.evaluate(() => ({ p: window.bot.peers, f: window.bot.firstPeerAt })); if (s.p > 0) ok = Math.round(s.f); }
      const e = await Promise.all([a, b].map(p => p.evaluate(() => window.bot.errors.length)));
      errs += e[0] + e[1];
      if (ok == null) fail++; else times.push(ok);
      await a.close(); await b.close();
    }
    times.sort((x, y) => x - y);
    console.log(`${kind}: connected ${times.length}/${N}, failed ${fail}; ms from page load to first peer: min ${times[0]} median ${times[(times.length / 2) | 0]} p90 ${times[Math.floor(times.length * 0.9)]} max ${times[times.length - 1]}; join errors logged ${errs}; all: ${times.join(' ')}`);
  }
} finally { await closeAll(h); }
