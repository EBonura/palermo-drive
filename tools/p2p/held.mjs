// An offer to a player who is in a timed mission (a fare, a race, ...) is held: no card in the middle of the run. When the mission ends the card shows (if the giver is still
// near and the offer stands), or the giver is told the player is busy. Also checks that a real race counts as a mission.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/held.mjs --root <dist> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'hd' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const watch = P => P.page.evaluate(() => { window.__t = []; const feed = () => { const e = document.querySelector('.ev-toast'), x = e && e.textContent; if (x && (!window.__t.length || window.__t[window.__t.length - 1] !== x)) window.__t.push(x); }; new MutationObserver(feed).observe(document.body, { subtree: true, childList: true, characterData: true }); });
const toasts = P => P.page.evaluate(() => window.__t.slice());
const clear = P => P.page.evaluate(() => { window.__t.length = 0; });
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const has = async (P, re, ms = 6000) => !!(await until(async () => (await toasts(P)).some(t => re.test(t)), ms));
const card = P => P.page.evaluate(() => { const c = document.querySelector('[role=alertdialog]'); return c ? c.textContent : null; });
const pill = P => P.page.evaluate(() => { const d = [...document.querySelectorAll('.pd-p2p')].find(x => x.style.bottom === '90px'); return d && d.style.display !== 'none' ? d.textContent : ''; });
const reset = (...Ps) => Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.resetOffers())));
try {
  const A = await player(h, { name: 'Anna', ns, x: 137, z: -212, extra: 'cash=20', size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', ns, x: 141, z: -205, extra: 'holdms=9000', size: [900, 500], isolated: true });
  await Promise.all([watch(A), watch(B)]); await A.page.evaluate(() => localStorage.setItem('palermoDrive.p2pFree.v1', '0'));
  ok('they meet', !!(await until(async () => (await A.page.evaluate(() => window.__p2p.remotes.size)) && (await B.page.evaluate(() => window.__p2p.remotes.size)), 90000))); await sleep(1500);

  // 1. Bob is on a mission and it ends: the card comes after it
  await B.page.evaluate(() => window.__p2p.forceBusy(true)); await A.page.evaluate(() => window.__p2p.offer(1));
  ok('Anna is told Bob is on a mission, and her waiting line says so', await has(A, /Bob è ’n missioni/) && /missioni/.test(await pill(A)), (await toasts(A)).join(' | ') + ' / ' + await pill(A));
  await sleep(2500); ok('no card on Bob while he is on the mission', (await card(B)) === null);
  await B.page.screenshot({ path: out + '/held-1-bob-in-mission.png' });
  await B.page.evaluate(() => window.__p2p.forceBusy(false)); await sleep(1500);
  ok('just after the mission: still no card (the result has its moment)', (await card(B)) === null);
  ok('then the card shows', !!(await until(() => card(B), 5000)), await card(B));
  await B.page.screenshot({ path: out + '/held-2-bob-after.png' });
  await B.page.evaluate(() => document.querySelector('[role=alertdialog] button[data-act=yes]').click());
  ok('Bob says yes: Anna pays and is told', await has(A, /Bob accittau/), (await toasts(A)).join(' | '));

  // 2. the mission outlasts the hold: Anna is told he is busy, and no card comes later
  await reset(A, B); await clear(A); await B.page.evaluate(() => window.__p2p.forceBusy(true)); await A.page.evaluate(() => window.__p2p.offer(0));
  ok('held again', await has(A, /Bob è ’n missioni/));
  ok('after the hold time Anna is told Bob is busy', await has(A, /Bob è occupatu/, 14000), (await toasts(A)).join(' | '));
  await B.page.evaluate(() => window.__p2p.forceBusy(false)); await sleep(5000); ok('and no card comes after that', (await card(B)) === null);

  // 3. the giver drives off while it is held: no card
  await reset(A, B); await clear(A); await B.page.evaluate(() => window.__p2p.forceBusy(true)); await A.page.evaluate(() => window.__p2p.offer(1)); await has(A, /missioni/);
  await A.page.evaluate(() => { window.game.car.x += 150; }); await sleep(2500);
  await B.page.evaluate(() => window.__p2p.forceBusy(false)); await sleep(6000);
  ok('the giver drove away: no card on Bob', (await card(B)) === null);

  // 4. a real race counts as a mission
  const C = await player(h, { name: 'Carl', ns: ns + 'r', x: -2850, z: -1500, extra: 'event=race:regione&auto', size: [900, 500], isolated: true });
  const inM = await until(() => C.page.evaluate(() => window.__p2p.inMission()), 90000); ok('in a real race, inMission is true', !!inM);
  await C.page.screenshot({ path: out + '/held-3-carl-in-race.png' });
  console.log('errors', A.errs, B.errs, C.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
