// A link cannot put a player online: ?p2p (the test switch) skips the name card only on a page served from this machine. The same page under another host name must show the card and never open the socket.
//   node tools/build/build.mjs --test-relay --out <dist>;  tools/release/withbrowser.sh node tools/online/consent.mjs --root <dist>
// The other host name is a made up one that Chrome is told to resolve to this machine, so nothing leaves it.
import { start, until, sleep } from './lib.mjs';
const h = await start({ extraArgs: ['--host-resolver-rules=MAP pd-consent.test 127.0.0.1'] });
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const open = async host => {
  const page = await h.browser.newPage(); await page.setViewport({ width: 800, height: 450 });
  await page.goto(`http://${host}:${h.port}/?help=0&play&debug&p2p&name=Ciccio&cash=0&relay=${encodeURIComponent(h.relayUrl)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  return page;
};
try {
  const local = await open('127.0.0.1');
  ok('on 127.0.0.1 ?p2p joins at once (the test switch)', await until(async () => (await local.evaluate(() => window.__p2p.relay())).ready, 30000, 250));
  const far = await open('pd-consent.test');
  await sleep(6000);
  const r = await far.evaluate(() => window.__p2p.relay());
  ok('on another host name ?p2p does not open the socket', r.state === 'idle' && !r.ready && r.handle === 0, JSON.stringify(r));
  ok('and the name card is on the screen', await far.evaluate(() => !!document.querySelector('[role=dialog][aria-modal=true]')));
  ok('and the relay saw no second connection', (await fetch(h.relay.url.replace(/^ws/, 'http').replace(/\/r$/, '/stats')).then(r => r.json())).connected === 1);
} finally { await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
