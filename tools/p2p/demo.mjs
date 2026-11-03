// The demo: three windows drive around together across cell borders, one says a phrase, one buys another a beer. Screenshots go to --out.
//   node tools/p2p/demo.mjs --root <dist built with --p2p> --out <dir>      (add --headed to watch; without it the windows are headless)
import { start, player, drivePath, snap, events, sleep, arg } from './lib.mjs';
import fs from 'node:fs';
const out = arg('out', '/tmp'); fs.mkdirSync(out, { recursive: true });
const ns = 'demo' + Date.now().toString(36), h = await start({ headless: process.argv.includes('--headed') ? false : 'new' });
try {
  const A = await player(h, { name: 'Anna', ns, x: -1300, z: 250, extra: 'cash=20', p2p: 'p2p=nostr' });
  const B = await player(h, { name: 'Bob', ns, x: -1900, z: 250, p2p: 'p2p=nostr' });
  const C = await player(h, { name: 'Carlo', ns, x: -1300, z: 300, th: 1.57, p2p: 'p2p=nostr' });
  await drivePath(B, [[-1900, 250], [-1290, 250]], 14);
  await sleep(1000);
  await A.page.evaluate(() => { const c = window.game.car; window.__p2p.say(0); });
  for (let i = 0; i < 70; i++) { await sleep(1000); const s = await snap(B); if (s.drawn >= 2 && s.car[0] > -1310) break; }
  console.log('B', JSON.stringify(await snap(B)));
  await A.page.evaluate(() => window.__p2p.say(4));   // fraaaagola... index 4
  await sleep(1500);
  console.log('Bob has a phrase bubble over a player:', await B.page.evaluate(() => [...window.__p2p.remotes.values()].filter(r => r.bubble).map(r => r.name)));
  await B.page.screenshot({ path: out + '/demo-bob-sees-phrase.png' });
  // beer: A offers, B accepts
  const cash0 = await A.page.evaluate(() => JSON.parse(localStorage.getItem('palermoDrive.garage.v1') || '{}').cash);
  console.log('offer sent', await A.page.evaluate(() => window.__p2p.offer(1)));
  await sleep(2500);
  const hasCard = await B.page.evaluate(() => !!document.querySelector('[role=alertdialog] button[data-act=yes]'));
  console.log('Bob sees the card', hasCard);
  await B.page.screenshot({ path: out + '/demo-bob-offer-card.png' });
  await B.page.evaluate(() => document.querySelector('[role=alertdialog] button[data-act=yes]').click());
  await sleep(2500);
  await B.page.screenshot({ path: out + '/demo-bob-after-drink.png' });
  console.log('Bob drunk level', await B.page.evaluate(() => window.game.drunk && window.game.drunk.units), 'Anna cash', cash0, '->', await A.page.evaluate(() => JSON.parse(localStorage.getItem('palermoDrive.garage.v1') || '{}').cash));
  await A.page.screenshot({ path: out + '/demo-anna.png' });
  console.log('errors', A.errs.filter(e => !/429|WebSocket/.test(e)), B.errs.filter(e => !/429|WebSocket/.test(e)), C.errs.filter(e => !/429|WebSocket/.test(e)));
} finally { await h.close(); }
