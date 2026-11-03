// The cap in a crowd: N players all in one cell with ?maxp=K (K small so a handful of pages is a crowd). Rooms must be cut into shards so that nobody is connected to,
// sends to or draws more than K others, even when they all arrive in the same second and pick the same room.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/crowd.mjs --root <dist> [--n 5] [--k 2]
import { start, player, sleep, arg } from './lib.mjs';
const N = +arg('n', 5), K = +arg('k', 2), ns = 'cr' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(70), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const snap = P => P.page.evaluate(() => ({ rooms: [...window.__p2p.rooms.values()].map(r => r.i + ',' + r.j + (r.s ? ':' + r.s : '') + '=' + r.peers.size), linked: [...window.__p2p.peers.values()].filter(p => p.rooms.size).length, drawn: window.__p2p.remotes.size, held: [...window.__p2p.peers.values()].filter(p => p.held !== false && p.rooms.size).length, ev: window.__p2p.log.filter(e => ['overfull', 'overcap', 'decoy'].includes(e.ev)).length }));
try {
  const ps = await Promise.all(Array.from({ length: N }, (_, i) => player(h, { name: 'P' + i, ns, x: -1250 + i * 4, z: 250, extra: `maxp=${K}&at=-1250,250,0&relays=wss://nos.lol,wss://nostr.chaima.info`, isolated: true })));
  let worst = null;
  for (let t = 0; t < 12; t++) {
    await sleep(5000);
    const s = await Promise.all(ps.map(snap)); worst = { linked: Math.max(...s.map(x => x.linked)), drawn: Math.max(...s.map(x => x.drawn)), held: Math.max(...s.map(x => x.held)) };
    console.log(`  t=${(t + 1) * 5}s`, s.map(x => `[${x.rooms.join(' ')}] link ${x.linked} drawn ${x.drawn}`).join('  '), 'cap events', s.reduce((a, x) => a + x.ev, 0));
  }
  const s = await Promise.all(ps.map(snap));
  ok(`nobody is connected to more than ${K} others after settling`, s.every(x => x.linked <= K), s.map(x => x.linked).join(','));
  ok(`nobody draws or sends to more than ${K}`, s.every(x => x.drawn <= K && x.held <= K), s.map(x => x.drawn + '/' + x.held).join(','));
  ok('everybody sees somebody (rooms were split, not emptied)', s.every(x => x.drawn >= 1), s.map(x => x.drawn).join(','));
  ok('more than one shard is in use', new Set(s.flatMap(x => x.rooms.map(r => r.split('=')[0]))).size > 1, JSON.stringify(s.map(x => x.rooms)));
  console.log('  worst case seen while settling', JSON.stringify(worst), 'errors', ps.flatMap(p => p.errs).slice(0, 3));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
