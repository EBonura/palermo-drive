// First visit without a name: the name card shows, nothing joins until a name is typed, then the rooms open and the name is saved.
import { start, sleep } from './lib.mjs';
const h = await start();
try {
  const page = await h.browser.newPage(); await page.setViewport({ width: 480, height: 270 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 300))); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(document, 'hidden', { get: () => false }); document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true); });
  await page.goto(`http://127.0.0.1:${h.port}/?help=0&play&p2p&ns=nm${Date.now().toString(36)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__p2p && !document.getElementById('loading'), { timeout: 300000 });
  await sleep(2500);
  const before = await page.evaluate(() => ({ card: !!document.querySelector('[role=dialog] input'), rooms: window.__p2p.rooms.size }));
  console.log('before typing', JSON.stringify(before));
  await page.type('[role=dialog] input', '<b>Peppe</b> Paolo Pa'); console.log('typed value', await page.evaluate(() => document.querySelector('[role=dialog] input').value)); await page.keyboard.press('Enter'); await sleep(1200);
  console.log('after Enter, card still open:', await page.evaluate(() => !!document.querySelector('[role=dialog] input')));
  if (await page.evaluate(() => !!document.querySelector('[role=dialog] input'))) await page.evaluate(() => document.querySelector('[role=dialog] input').parentElement.querySelector('button').click()); await sleep(1500);
  console.log('after', JSON.stringify(await page.evaluate(() => ({ card: !!document.querySelector('[role=dialog] input'), rooms: window.__p2p.rooms.size, saved: localStorage.getItem('palermoDrive.net.v1') }))));
  await page.screenshot({ path: process.argv[2] || '/tmp/name.png' });
} finally { await h.close(); }
