// "Bob è vicino" when somebody comes close (with a cooldown), a small sound for a phrase and for an offer received (at the game's volume), and Y / N for the offer card.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/hello.mjs --root <dist>
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'he' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const watch = P => P.page.evaluate(() => { window.__t = []; window.__osc = 0; const o = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); }; const feed = () => { const e = document.querySelector('.ev-toast'), x = e && e.textContent; if (x && (!window.__t.length || window.__t[window.__t.length - 1] !== x)) window.__t.push(x); }; new MutationObserver(feed).observe(document.body, { subtree: true, childList: true, characterData: true }); });
const toasts = P => P.page.evaluate(() => window.__t.slice());
const clear = P => P.page.evaluate(() => { window.__t.length = 0; });
const osc = P => P.page.evaluate(() => window.__osc);
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const has = async (P, re, ms = 6000) => !!(await until(async () => (await toasts(P)).some(t => re.test(t)), ms));
const card = P => P.page.evaluate(() => { const c = document.querySelector('[role=alertdialog]'); return c ? c.textContent : null; });
const place = (P, x, z) => P.page.evaluate(([x, z]) => { const c = window.game.car; c.x = x; c.z = z; c.vx = c.vz = 0; }, [x, z]);
const radio = P => P.page.evaluate(() => (JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}')).radio || 'on');
const speak = P => P.page.evaluate(() => { window.__p2p.say(2); });
try {
  const A = await player(h, { name: 'Anna', ns, x: 137, z: -212, extra: 'cash=20', size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', ns, x: 137, z: -62, size: [900, 500], isolated: true });
  await Promise.all([watch(A), watch(B)]);
  await A.page.evaluate(() => localStorage.setItem('palermoDrive.p2pFree.v1', '0'));
  ok('they meet 150 m apart', await until(async () => (await A.page.evaluate(() => window.__p2p.remotes.size)) && (await B.page.evaluate(() => window.__p2p.remotes.size)), 90000));
  await sleep(1500); ok('far apart: no line yet', !(await has(A, /vicino/, 500)) && !(await has(B, /vicino/, 500)));
  await place(B, 137, -180); ok('Bob drives up: Anna is told "Bob è vicino"', await has(A, /Bob è vicino/), (await toasts(A)).join(' | '));
  ok('and Bob is told "Anna è vicino"', await has(B, /Anna è vicino/), (await toasts(B)).join(' | '));
  await A.page.screenshot({ path: out + '/hello-1-near.png' });
  // away and back within a minute: no second line
  await place(B, 137, -62); await sleep(2500); await clear(A); await place(B, 137, -180); await sleep(3500);
  ok('away and back within a minute: no second line', !(await has(A, /vicino/, 500)), (await toasts(A)).join(' | '));

  // the sounds: a phrase is two notes, an offer three
  await sleep(2000); let o0 = await osc(B); await speak(A); await sleep(800);
  ok('a phrase received plays a sound (two notes) on Bob', (await osc(B)) - o0 === 2, String((await osc(B)) - o0));
  await place(B, 137, -200); await sleep(2500); o0 = await osc(B); await A.page.evaluate(() => window.__p2p.offer(1)); await until(() => card(B), 5000); await sleep(300);
  ok('an offer received plays a sound (three notes)', (await osc(B)) - o0 === 3, String((await osc(B)) - o0));

  // the keys: on a keyboard the card shows Y and N, N does not reach the radio, a letter typed in the name box answers nothing
  const hint = await B.page.evaluate(() => [...document.querySelectorAll('[role=alertdialog] kbd')].map(k => k.textContent).join(''));
  ok('the card shows Y and N to a keyboard player', hint === 'YN', hint); await B.page.screenshot({ path: out + '/hello-2-card-keys.png' });
  await B.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300);   // Options asks for the name card with this event
  await B.page.keyboard.type('yNyn'); await sleep(300);
  ok('typing y and n in the name box answers nothing', (await card(B)) !== null && (await B.page.evaluate(() => document.querySelector('[role=dialog] input').value)).endsWith('yNyn'));
  await B.page.keyboard.press('Escape'); await sleep(300);
  const r0 = await radio(B), car0 = await B.page.evaluate(() => [window.game.car.x, window.game.car.z]);
  await clear(A); await B.page.keyboard.press('KeyY');
  ok('Y accepts: Anna is told', await has(A, /Bob accittau/), (await toasts(A)).join(' | '));
  await A.page.evaluate(() => window.__p2p.resetOffers()); await B.page.evaluate(() => window.__p2p.resetOffers());
  await clear(A); await A.page.evaluate(() => window.__p2p.offer(0)); await until(() => card(B), 5000); await B.page.keyboard.press('KeyN');
  ok('N declines: Anna is told', await has(A, /Bob: nun ci va/), (await toasts(A)).join(' | '));
  ok('N did not switch the radio, and nothing drove the car', (await radio(B)) === r0 && JSON.stringify(await B.page.evaluate(() => [window.game.car.x, window.game.car.z])) === JSON.stringify(car0), `radio ${r0} -> ${await radio(B)}`);
  await B.page.keyboard.press('KeyN'); await sleep(300);
  ok('with no card, N is the radio again', (await radio(B)) !== r0, `radio ${await radio(B)}`);

  // volume 0 is silent
  await B.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('palermoDrive.settings.v1') || '{}'); s.volume = 0; localStorage.setItem('palermoDrive.settings.v1', JSON.stringify(s)); });
  await B.page.reload({ waitUntil: 'domcontentloaded' }); await B.page.waitForFunction(() => window.game && window.__p2p && !document.getElementById('loading'), { timeout: 300000, polling: 250 });
  await place(B, 137, -200); await watch(B); await until(async () => (await B.page.evaluate(() => window.__p2p.remotes.size)) && (await A.page.evaluate(() => window.__p2p.remotes.size)), 60000); await sleep(2500);
  o0 = await osc(B); await speak(A); await sleep(800);
  ok('at volume 0 a phrase makes no sound', (await osc(B)) === o0, String((await osc(B)) - o0));
  console.log('errors', A.errs, B.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
