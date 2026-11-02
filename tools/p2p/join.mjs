// How long until a player who enters a room sees the people already there? A sits in the middle of a cell. B starts far away,
// is moved next to A (joins A's room), then away again (leaves), N times. Times are from B's room join to B's first state of A.
//   node tools/p2p/join.mjs --root <dist> [--kind nostr|torrent|mqtt] [--n 6] [--relays wss://a,wss://b]
import { start, player, events, sleep, arg } from './lib.mjs';
const kind = arg('kind', 'nostr'), N = +arg('n', 6), relays = arg('relays', ''), ns = 'join' + Date.now().toString(36);
const h = await start();
const mode = `p2p=${kind}${relays ? '&relays=' + relays : ''}`;
try {
  const a = await player(h, { name: 'Anna', ns, x: -1250, z: 250, p2p: mode });
  const b = await player(h, { name: 'Bob', ns, x: -3000, z: -750, p2p: mode });
  console.log(`kind ${kind}: A in cell -3,0 (1 room); B far away`);
  const res = [];
  for (let k = 0; k < N; k++) {
    await sleep(4000);
    await b.page.evaluate(() => { window.__p2p.log.length = 0; });
    await b.page.evaluate(() => { const c = window.game.car; c.x = -1200; c.z = 250; });   // 50 m from A
    let seen = null;
    for (let i = 0; i < 80 && !seen; i++) { await sleep(500); seen = await b.page.evaluate(() => window.__p2p.log.find(e => e.ev === 'firstState') || null); }
    const log = await events(b);
    const j = log.find(e => e.ev === 'join'), pj = log.find(e => e.ev === 'peerJoin'), fs = log.find(e => e.ev === 'firstState'), errs = log.filter(e => e.ev === 'joinError').length;
    res.push({ k, join: j && j.t, peerJoinMs: pj && pj.t - j.t, firstStateMs: fs && fs.t - j.t, errs });
    console.log(JSON.stringify(res[res.length - 1]));
    await b.page.evaluate(() => { const c = window.game.car; c.x = -3000; c.z = -750; });      // away: leaves the room
    await sleep(3000);
  }
  const ok = res.filter(r => r.firstStateMs != null).map(r => r.firstStateMs).sort((x, y) => x - y);
  console.log(`seen ${ok.length}/${N}; first-state ms min ${ok[0]} median ${ok[(ok.length / 2) | 0]} max ${ok[ok.length - 1]}`);
  console.log('relays A', JSON.stringify(await a.page.evaluate(() => window.__p2p.relays())), 'errs', a.errs, b.errs);
} finally { await h.close(); }
