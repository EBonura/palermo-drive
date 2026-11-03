// A page in the background stops presence (no publishing, no reading, no sockets) after ?idlems, and starts again when it comes back.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/hidden.mjs --root <dist>
import { start, sleep, arg } from './lib.mjs';
const h = await start(), ns = 'hd' + Date.now().toString(36);
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
try {
  const page = await h.browser.newPage(); await page.setViewport({ width: 480, height: 270 });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.goto(`http://127.0.0.1:${h.port}/?help=0&play&debug&p2p&name=Hid&ns=${ns}&cash=0&idlems=4000&at=-1250,250,0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await sleep(4000);
  const st = () => page.evaluate(() => ({ hidden: document.hidden, running: window.__p2p.presence.running, socks: window.__p2p.presence.sockets().filter(s => s[1] < 2).length, tx: window.__p2p.presence.stats.txEvents }));
  let s = await st(); ok('visible: presence runs and has sockets', s.running && s.socks > 0, JSON.stringify(s));
  const other = await h.browser.newPage(); await other.bringToFront(); await sleep(7000);
  s = await st(); ok('page hidden for 7 s (idle limit 4 s): presence stopped, sockets closed', s.hidden && !s.running && s.socks === 0, JSON.stringify(s));
  await page.bringToFront(); await sleep(1500);
  const gs = await page.evaluate(() => window.__p2p.gameState()); console.log('  game state back in front:', gs);
  if (gs !== 'play') { await page.keyboard.press('p'); await sleep(500); console.log('  after P:', await page.evaluate(() => window.__p2p.gameState())); }
  await sleep(4000);
  s = await st(); ok('back in front and playing: presence runs again', !s.hidden && s.running && s.socks > 0, JSON.stringify(s));
  console.log('errors', errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
