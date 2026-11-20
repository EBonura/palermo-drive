// The relay goes away and comes back: what the player sees (nobody, no error box, the game goes on), how often the page asks again (6 attempts on a backoff, then it gives up on its own timer), and that it is
// picked up again when the relay is back: at once when the player says "online" again, once an hour on its own (the hour is only checked with a fake clock, in link-check.mjs), and when the browser says the
// network is back. Needs its own relay simulator, so it does not take --relay.
//   tools/release/withbrowser.sh node tools/online/relaydown.mjs --root <dist built with --test-relay>
import { start, player, sleep, until, startBot, arg } from './lib.mjs';
import { startRelaySim } from './relaysim.mjs';
if (arg('relay', '')) { console.log('SKIP: this test stops and starts its own relay'); process.exit(0); }
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const view = P => P.page.evaluate(() => { const d = window.__p2p; return { drawn: d.remotes.size, tracked: d.peers.size, link: d.relay(), game: d.gameState(), dialogs: [...document.querySelectorAll('[role=alertdialog],[role=alert],[role=dialog]')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').length, panel: [...document.querySelectorAll('.mpx')].some(e => e.classList.contains('on')) }; });
const port = h.relay.port; let bot = null;
const ask = P => P.page.evaluate(() => dispatchEvent(new CustomEvent('pd-net-mode', { detail: true })));   // the player presses "Gioca online" again (Options has the same switch)
try {
  const A = await player(h, { name: 'Anna', x: 100, z: 100, size: [900, 500] });
  bot = await startBot(h.relayUrl, { name: 'Bot', x: 130, z: 100 }); const t1 = setInterval(() => bot.state({ x: 130, z: 100 }), 300);
  ok('they meet', await until(async () => (await view(A)).drawn === 1, 40000, 250));
  clearInterval(t1); const dialogs0 = (await view(A)).dialogs;

  // the relay goes away
  await h.relay.close();
  ok('Anna sees nobody within a second or two', await until(async () => (await view(A)).drawn === 0, 5000, 200));
  const samples = []; for (let i = 0; i < 30; i++) { await sleep(1000); const v = await view(A); samples.push([v.link.fails, v.link.waitMs, v.link.state]); }
  const last = samples[samples.length - 1];
  ok('she waits and asks again with longer waits (backoff)', last[0] >= 3 && samples.some(s => s[1] >= 2000), JSON.stringify(samples.filter((_, i) => i % 5 === 0)));
  ok('after 6 failed attempts she stops asking on her own: the next try is far off (the hour)', last[0] === 6 && last[1] > 60000, JSON.stringify(last));
  let v = await view(A);
  ok('the game is still being played: no new dialog, the panel still shows', v.game === 'play' && v.dialogs === dialogs0 && v.panel, JSON.stringify({ game: v.game, dialogs: v.dialogs, panel: v.panel }));
  const moved = await A.page.evaluate(() => new Promise(res => { const g = window.game, c = g.car, x = c.x, z = c.z; g.keys.ArrowUp = g.keys.KeyW = true; setTimeout(() => { g.keys.ArrowUp = g.keys.KeyW = false; res(Math.hypot(c.x - x, c.z - z)); }, 5000); }));
  ok('the car still drives', moved > 3, moved.toFixed(1) + ' m');

  // the relay comes back, on the same address
  const back = await startRelaySim({ port, perAddress: 1000 });
  bot = await startBot(h.relayUrl, { name: 'Bot2', x: 130, z: 100 }); const t2 = setInterval(() => bot.state({ x: 130, z: 100 }), 300);
  await sleep(6000); ok('she is not back on her own in those 6 s (she waits for the hour)', (await view(A)).link.state !== 'open');
  await ask(A);   // she has given up, so it takes the player asking
  ok('the player presses "Gioca online": Anna finds it again within 10 s and sees the bot', await until(async () => (await view(A)).drawn === 1, 10000, 250), JSON.stringify((await view(A)).link));
  ok('and holds one connection', back.conns().length === 2);
  clearInterval(t2);

  // the relay is full: 503 on every upgrade. The page asks a few times, not many
  await sleep(16000);   // a connection that has stayed up 15 s starts the count of failed attempts again
  await bot.close(); back.refuse(503); back.dropAll();
  ok('everybody is let go', await until(async () => (await view(A)).drawn === 0, 5000, 200));
  const r0 = back.stats().refused; await sleep(30000); const asked = back.stats().refused - r0;
  ok('in 30 s of 503 the page asked no more than 6 times (the first attempts, then it gives up)', asked >= 3 && asked <= 6, `asked ${asked} times`);
  bot = null; back.refuse(0);
  const bot3 = await startBot(h.relayUrl, { name: 'Bot3', x: 130, z: 100 }); const t3 = setInterval(() => bot3.state({ x: 130, z: 100 }), 300);
  await ask(A);
  ok('once it takes players again and the player asks, she is back', await until(async () => (await view(A)).drawn === 1, 10000, 250), JSON.stringify((await view(A)).link));
  clearInterval(t3);

  // the browser says the network is back: no waiting for the end of the backoff
  await bot3.close(); back.refuse(503); back.dropAll(); await sleep(12000); back.refuse(0);
  const before = (await view(A)).link;
  await A.page.evaluate(() => dispatchEvent(new Event('online')));
  ok('an "online" event from the browser reconnects at once', await until(async () => (await view(A)).link.state === 'open', 3000, 100), JSON.stringify({ before, after: (await view(A)).link }));
  const errs = A.errs.filter(e => !/WebSocket connection|Failed to load resource/.test(e));   // a refused socket, and the /status asked after it, are logged by the browser itself
  ok('no page errors other than the browser logging refused sockets', !errs.length, JSON.stringify(errs));
  await back.close();
} finally { if (bot) await bot.close(); await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
