// The default flow on a built site, with no ?p2p in the address: nothing connects before the name card's yes, two players who say yes meet, solo stays solo, every page open asks again, a name from the Garage isn't a yes.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/default.mjs --root dist --shots <folder>
import { start, arg, sleep } from './lib.mjs';
const h = await start(), shots = arg('shots', ''), results = [];
const check = (name, ok, more = '') => { results.push(ok); console.log(ok ? 'OK  ' : 'FAIL', name, more); };
const X = 137, Z = -212;   // beside Via Maqueda, the same 500 m cell for everyone in this run
async function open(size = { width: 1100, height: 650 }, store = null) {
  const ctx = await h.browser.createBrowserContext(), page = await ctx.newPage(), errs = [];
  await page.setViewport(size);
  await page.evaluateOnNewDocument(s => { Object.defineProperty(document, 'hidden', { get: () => false }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }); if (s) localStorage.setItem('palermoDrive.net.v1', s); }, store);
  page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${h.port}/?help=0&play&debug&at=${X},${Z},0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await sleep(2000);
  return { page, errs, ctx };
}
const card = p => p.page.evaluate(() => { const d = document.querySelector('[role=dialog] input')?.closest('[role=dialog]'); return d ? [...d.querySelectorAll('button:not(.p2p-info)')].map(b => b.textContent) : null; });
const press = (p, txt) => p.page.evaluate(t => { [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === t).click(); }, txt);
const type = (p, n) => p.page.evaluate(n => { document.querySelector('[role=dialog] input').value = n; }, n);
const net = p => p.page.evaluate(() => ({ rooms: window.__p2p.rooms.size, peers: window.__p2p.peers.size, drawn: window.__p2p.remotes.size, sockets: window.__p2p.relays().filter(r => r[1] < 2).length }));   // open or opening: the list keeps closed ones

const a = await open(), b = await open({ width: 844, height: 390 });
check('card shows for a new player', (await card(a))?.join() === 'Gioca online,Gioca da solo', JSON.stringify(await card(a)));
let n = await net(a); check('nothing joined before the yes', n.rooms === 0 && n.sockets === 0, JSON.stringify(n));
const tip = p => p.page.evaluate(() => { const t = document.querySelector('[role=dialog] [role=tooltip]'); return t && getComputedStyle(t).display !== 'none' ? t.textContent : ''; });
check('the notice is behind the i', (await tip(b)) === '');
if (shots) { await a.page.screenshot({ path: `${shots}/card-desktop.png` }); await b.page.screenshot({ path: `${shots}/card-phone.png` }); }
await b.page.evaluate(() => document.querySelector('.p2p-info').click()); check('tapping the i shows it', /IP/.test(await tip(b)), await tip(b));
if (shots) await b.page.screenshot({ path: `${shots}/card-phone-info.png` });
await b.page.evaluate(() => document.querySelector('.p2p-info').click()); check('tapping again hides it', (await tip(b)) === '');
await type(a, 'Anna'); await press(a, 'Gioca online'); await type(b, 'Bruno'); await press(b, 'Gioca online');
let met = false; for (let i = 0; i < 90 && !met; i++) { await sleep(1000); const na = await net(a), nb = await net(b); met = na.drawn >= 1 && nb.drawn >= 1; if (met) console.log('  met after', i + 1, 's', JSON.stringify(na)); }
check('two players who say yes meet', met);
if (shots) { await sleep(1500); await a.page.screenshot({ path: `${shots}/online-desktop.png` }); await b.page.screenshot({ path: `${shots}/online-phone.png` }); }
const again = await a.page.evaluate(() => JSON.parse(localStorage.getItem('palermoDrive.net.v1')));
check('the name is saved, the answer is not', again.name === 'Anna' && again.p2pOk === undefined, JSON.stringify(again));

const c = await open(); await press(c, 'Gioca da solo'); await sleep(3000); n = await net(c);
check('solo joins nothing', n.rooms === 0 && n.sockets === 0 && !(await card(c)), JSON.stringify(n));
if (shots) await c.page.screenshot({ path: `${shots}/solo-desktop.png` });
await c.page.reload({ waitUntil: 'domcontentloaded' }); await c.page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 }); await sleep(3000);
n = await net(c); check('a reload asks again and joins nothing until answered', n.rooms === 0 && n.sockets === 0 && !!(await card(c)), JSON.stringify(n));
await press(c, 'Gioca da solo');

const d = await open(undefined, JSON.stringify({ name: 'Garage', offline: false })); await sleep(1500); n = await net(d);
check("a name from the Garage isn't a yes", n.rooms === 0 && !!(await card(d)), JSON.stringify(await card(d)));
check('a saved name is filled in and the card asks online or solo', await d.page.evaluate(() => { const c = document.querySelector('[role=dialog] input')?.closest('[role=dialog]'); return c.querySelector('input').value === 'Garage' && c.querySelector('b').textContent === 'Online o da solo?'; }));
const e = await open(undefined, JSON.stringify({ name: 'Anna', p2pOk: true, offline: false })); await sleep(1500); n = await net(e);
check('a yes saved by an older version is not used', n.rooms === 0 && n.sockets === 0 && !!(await card(e)), JSON.stringify(n));

await a.page.evaluate(() => dispatchEvent(new Event('pd-open-name')));   // Options asks for the name card with this event (the pencil is gone)
await sleep(300); await press(a, 'Gioca da solo'); await sleep(1000); n = await net(a);
check('going solo leaves the rooms and shuts the relay sockets', n.rooms === 0 && n.drawn === 0 && n.sockets === 0, JSON.stringify(n));
await sleep(12000); n = await net(b); check('the other player drops the one who left', n.drawn === 0, JSON.stringify(n));

const errs = [a, b, c, d, e].flatMap(p => p.errs); check('no page errors or policy violations', !errs.length, errs.slice(0, 4).join(' | '));
await h.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILED'); process.exit(results.every(Boolean) ? 0 : 1);
