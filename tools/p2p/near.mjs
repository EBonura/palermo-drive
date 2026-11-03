// The closest players wherever they are (docs/P2P-MULTIPLAYER.md, "The closest players"): two players several km apart in different cells find each other through the presence list
// and show on the minimap and the big map with names; a third nearby still works; a far player who drives up hands over to the near behaviour with no duplicate; a player who leaves
// leaves no ghost. Also counts the WebSocket frames of the presence signal on one client.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/near.mjs --root <dist> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pnear'), ns = 'nr' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(70), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 250) { const v = await fn(); if (v) return v; await sleep(250); } return null; };
const view = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => ({ name: r.name, far: r.far, shown: r.shown, car: !!r.model, ring: r.marker.shape === 'ring' && r.marker.player })));
const place = (P, x, z) => P.page.evaluate(([x, z]) => { const c = window.game.car; c.x = x; c.z = z; c.vx = c.vz = 0; }, [x, z]);
// WebSocket frames by kind: presence (kind 30078 events and its REQ) versus Trystero room signalling
async function tap(P) {
  const cdp = P.cdp; const urls = new Map(), t = { pres: { n: 0, b: 0, tx: 0, rx: 0 }, rooms: { n: 0, b: 0, tx: 0, rx: 0 } };
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketCreated', e => urls.set(e.requestId, e.url));
  const f = dir => e => { const d = e.response.payloadData || '', k = /30078|"EOSE","pd/.test(d.slice(0, 400)) ? 'pres' : 'rooms'; const o = t[k]; o.n++; o.b += d.length; o[dir]++; };
  cdp.on('Network.webSocketFrameSent', f('tx')); cdp.on('Network.webSocketFrameReceived', f('rx'));
  return t;
}
try {
  const A = await player(h, { name: 'Anna', ns, x: -1250, z: 250, extra: 'at=-1250,250,0&relays=wss://nos.lol,wss://nostr.chaima.info', isolated: true });
  const tA = await tap(A);
  const B = await player(h, { name: 'Bob', ns, x: 3000, z: 2000, extra: 'at=3000,2000,0&relays=wss://nos.lol,wss://nostr.chaima.info', isolated: true });   // about 5.5 km away, another cell
  const t0 = Date.now();
  const sees = async (P, nm) => (await view(P)).find(v => v.name === nm);
  const inFar = async (P, i, j) => P.page.evaluate(([i, j]) => [...window.__p2p.rooms.values()].some(r => r.i === i && r.j === j && r.peers.size > 0), [i, j]);   // really through the far cell's room, not the default spawn cell both pages start in
  const met = await until(async () => (await inFar(A, 6, 4)) && (await inFar(B, -3, 0)) && (await sees(A, 'Bob'))?.shown && (await sees(B, 'Anna'))?.shown, 150000);
  console.log('  far pair found each other (through the far cell room) after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  ok('two players 5 km apart see each other with names', !!met, JSON.stringify(await view(A)));
  const vb = await sees(A, 'Bob');
  ok('the far one is a ring on the maps and not a car', vb && vb.far && !vb.car && vb.ring, JSON.stringify(vb));
  await A.page.screenshot({ path: out + '/near-1-minimap.png' });
  await A.page.evaluate(() => document.getElementById('mini').click()); await sleep(5000);
  await A.page.screenshot({ path: out + '/near-2-bigmap.png' });
  await A.page.keyboard.press('Escape'); await sleep(800);
  ok('the big map closed and the game plays on', (await A.page.evaluate(() => window.__p2p.gameState())) === 'play', await A.page.evaluate(() => window.__p2p.gameState()));

  // a third player nearby still works as before
  const C = await player(h, { name: 'Carla', ns, x: -1200, z: 300, extra: 'at=-1200,300,0&relays=wss://nos.lol,wss://nostr.chaima.info', isolated: true });
  const near = await until(async () => { const v = await sees(A, 'Carla'); return v && v.shown && !v.far && v.car; }, 60000);
  ok('a third player nearby is drawn as a car', !!near, JSON.stringify(await view(A)));
  ok('and everybody has the right number of others', (await view(A)).length === 2 && (await view(C)).length >= 1, [(await view(A)).length, (await view(B)).length, (await view(C)).length].join(','));

  // the far one drives up: the near behaviour takes over, nobody doubles
  const ids = async P => P.page.evaluate(() => [...window.__p2p.peers.keys()].length);
  await place(B, -1100, 250); await sleep(500);
  const hand = await until(async () => { const v = await view(A); const b = v.find(x => x.name === 'Bob'); return b && !b.far && b.car; }, 30000);
  ok('Bob drives up: drawn as a car, listed once', !!hand && (await view(A)).filter(v => v.name === 'Bob').length === 1, JSON.stringify(await view(A)));
  ok('no duplicate record anywhere', (await ids(A)) === 2 && (await ids(B)) === 2, `${await ids(A)} ${await ids(B)}`);
  await place(B, 3000, 2000);
  const back = await until(async () => { const b = (await view(A)).find(x => x.name === 'Bob'); return b && b.far && !b.car; }, 60000);
  ok('Bob drives off: back to a dot', !!back, JSON.stringify(await view(A)));

  // leaves: no ghost
  const tl = Date.now(); await B.page.close();
  const gone = await until(async () => !(await sees(A, 'Bob')), 120000);
  console.log('  Bob left; gone from Anna after', ((Date.now() - tl) / 1000).toFixed(1), 's');
  ok('a player who leaves is gone from the others', !!gone, JSON.stringify(await view(A)));

  console.log('  events on Anna', JSON.stringify(await A.page.evaluate(() => window.__p2p.log.filter(e => !['peerJoin', 'firstState'].includes(e.ev)).map(e => [e.t, e.ev, e.peer || '', e.room || '', e.why || ''].join(' ')))));
  const st = await A.page.evaluate(() => ({ ...window.__p2p.presence.stats, size: window.__p2p.presence.size, refusals: window.__p2p.presence.refusals, rooms: [...window.__p2p.rooms.values()].map(r => r.key.split(':').slice(2).join(',') + ':' + r.peers.size), socks: window.__p2p.relays().length, beat: window.__p2p.presence.beatMs() }));
  console.log('  presence stats on Anna', JSON.stringify(st));
  console.log('  frames on Anna', JSON.stringify(tA));
  console.log('  errors', A.errs.slice(0, 3), C.errs.slice(0, 3));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
