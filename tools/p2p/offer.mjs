// Offering a drink between two real players (src/p2p/p2p.js): every outcome has to show on the right screen, and the yes has to make the receiver dizzy.
// Each player has a browser context of its own. What a player SEES is read from the page: the game's toast line (.ev-toast, recorded as it changes), the offer card
// (role alertdialog) and the waiting line. Pictures of both screens go to --out.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/offer.mjs --root <dist> [--out dir]
import { createRequire } from 'node:module';
import { start, player, sleep, arg } from './lib.mjs';
const sharp = createRequire(new URL('../build/package.json', import.meta.url).pathname)('sharp');
const out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'of' + Date.now().toString(36);
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const watch = P => P.page.evaluate(() => { window.__t = []; const feed = () => { const e = document.querySelector('.ev-toast'), x = e && e.textContent; if (x && (!window.__t.length || window.__t[window.__t.length - 1] !== x)) window.__t.push(x); }; new MutationObserver(feed).observe(document.body, { subtree: true, childList: true, characterData: true }); });
const toasts = P => P.page.evaluate(() => window.__t.slice());
const clear = P => P.page.evaluate(() => { window.__t.length = 0; });
const cardText = P => P.page.evaluate(() => { const c = document.querySelector('[role=alertdialog]'); return c ? c.textContent : null; });
const pillText = P => P.page.evaluate(() => { const d = [...document.querySelectorAll('.pd-p2p')].find(x => x.style.bottom === '90px'); return d && d.style.display !== 'none' ? d.textContent : ''; });
const press = (P, txt) => P.page.evaluate(t => { const b = [...document.querySelectorAll('[role=alertdialog] button')].find(x => x.textContent === t); if (b) b.click(); return !!b; }, txt);
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const has = async (P, re, ms = 6000) => !!(await until(async () => (await toasts(P)).some(t => re.test(t)), ms));
const reset = (...Ps) => Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.resetOffers())));
const resetKeepMute = P => P.page.evaluate(() => window.__p2p.resetOffers(true));
const wallet = P => P.page.evaluate(() => window.__p2p.wallet());
const offer = (P, k = 1) => P.page.evaluate(k => window.__p2p.offer(k), k);
const drunk = P => P.page.evaluate(() => { const d = window.game.drunk; return { units: d.units, level: +d.level.toFixed(2), post: d.post }; });
// how much the picture moves between two shots 600 ms apart (a still car on a still street: nothing but the drink moves it)
const swim = async P => { const raw = async () => (await sharp(await P.page.screenshot()).removeAlpha().raw().toBuffer()); const a = await raw(); await sleep(600); const b = await raw(); let t = 0; for (let i = 0; i < a.length; i += 7) t += Math.abs(a[i] - b[i]); return +(t / (a.length / 7)).toFixed(2); };
const meet = async (...Ps) => { for (let i = 0; i < 90; i++) { const n = await Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.remotes.size))); if (n.every(v => v >= 1)) return true; await sleep(1000); } return false; };
try {
  const A = await player(h, { name: 'Anna', ns, x: 137, z: -212, extra: 'cash=20', size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', ns, x: 141, z: -205, size: [900, 500], isolated: true });
  ok('the two players meet', await meet(A, B)); await Promise.all([watch(A), watch(B)]);

  // 1. accepted: the card says who, what and how dizzy; the giver pays; the receiver is dizzy and sees it
  await sleep(4000); const swim0 = await swim(B);
  ok('Bob is sober to begin with', (await drunk(B)).units === 0, 'picture movement ' + swim0);
  await B.page.screenshot({ path: out + '/offer-1-bob-sober.png' });
  ok('Anna offers a beer', await offer(A, 1));
  ok('Anna sees a waiting line', /Bob/.test(await until(() => pillText(A), 2000) || ''), await pillText(A));
  const card = await until(() => cardText(B), 5000);
  ok('Bob gets a card saying who offers what', /Anna ti offre una birra/.test(card || ''), card);
  ok('the card says how dizzy it makes him (x1)', /×1/.test(card || ''), card);
  await B.page.screenshot({ path: out + '/offer-2-bob-card.png' }); await A.page.screenshot({ path: out + '/offer-2-anna-waiting.png' });
  const cash0 = await wallet(A);
  await press(B, 'Accetta');
  ok('Anna is told Bob accepted and pays 1 euro', await has(A, /Saluti.*Bob accittau/) && (await wallet(A)) === cash0 - 1, (await toasts(A)).join(' | '));
  ok('the waiting line is gone', !(await pillText(A)));
  ok('Bob is told who treated him', await has(B, /Anna t’offriu un/ ) || await has(B, /Anna t’offriu una birra/), (await toasts(B)).join(' | '));
  ok('then the drink\'s own line (src/drunk.js gift) shows too', await has(B, /^Birra/, 5000), (await toasts(B)).join(' | '));
  let d = await until(async () => { const x = await drunk(B); return x.level > 0.2 ? x : null; }, 6000);
  ok('Bob is dizzy: the stack is 1 and the shader pass is on', !!d && d.units >= 0.9 && d.post, JSON.stringify(d));
  await sleep(2500); await B.page.screenshot({ path: out + '/offer-3-bob-dizzy.png' }); const swim1 = await swim(B);
  ok('his picture swims (it moves clearly more than when sober)', swim1 > Math.max(4, swim0 * 1.5), `${swim0} -> ${swim1}`); await A.page.screenshot({ path: out + '/offer-3-anna-after.png' });
  ok('no card is left on Bob', (await cardText(B)) === null);

  // 2. a second drink on top: the card shows the higher stack
  await reset(A, B); await clear(B); await offer(A, 0);
  const card2 = await until(() => cardText(B), 5000);
  ok('on top of one drink the card says x2 and names the cicchetto', /un cicchetto/.test(card2 || '') && /×2/.test(card2 || ''), card2);

  // 3. declined: Anna is told, nothing is paid, and Bob is not asked again by her for a while
  await clear(A); const cash1 = await wallet(A); await press(B, 'Nun mi va');
  ok('Anna is told Bob said no', await has(A, /Bob: nun ci va/), (await toasts(A)).join(' | '));
  ok('nothing was paid', (await wallet(A)) === cash1);
  await reset(A); await resetKeepMute(B);   // the 10 s gaps are cleared, Bob's mute (a minute) is not
  await clear(A); await offer(A, 1);
  ok('asking again right away gets a no, with no card on Bob', await has(A, /Bob: nun ci va/) && (await cardText(B)) === null, (await toasts(A)).join(' | '));

  // 4. the giver cannot ask twice in a row
  await reset(A, B); await clear(A); await offer(A, 1); await until(() => cardText(B), 4000);
  await clear(A); const again = await offer(A, 1);
  ok('a second offer while one stands is refused with a line', again === false && await has(A, /Aspetta/), (await toasts(A)).join(' | '));
  await press(B, 'Nun mi va'); await has(A, /nun ci va/);

  // 5. nobody answers: both cards go, the giver is told
  await reset(A, B); await clear(A); await offer(A, 1);
  ok('Bob gets the card again', !!(await until(() => cardText(B), 5000)));
  ok('after about 15 s Anna is told Bob did not answer', await has(A, /Bob un rispunniu/, 22000), (await toasts(A)).join(' | '));
  ok('and the card on Bob has closed itself', (await cardText(B)) === null);

  // 6. Bob walks away before he says yes
  await reset(A, B); await clear(A); await clear(B); const cash2 = await wallet(A);
  await offer(A, 1); await until(() => cardText(B), 5000);
  await B.page.evaluate(() => { window.game.car.x += 50; }); await sleep(900);   // 50 m: past the 40 m of an offer, short of the 60 m at which the card gives up
  const still = await cardText(B);
  await press(B, 'Accetta');
  ok('Anna is told Bob is too far, and pays nothing', (await has(A, /Bob è truappu luntanu/)) && (await wallet(A)) === cash2, (await toasts(A)).join(' | '));
  ok('Bob is told he walked off', await has(B, /truappu luntanu/), `card was ${still ? 'up' : 'closed'}; ` + (await toasts(B)).join(' | '));
  await B.page.evaluate(() => { window.game.car.x -= 50; }); await sleep(1500);

  // 7. Anna cannot pay any more when he says yes
  await reset(A, B); await clear(A); await clear(B); const u0 = (await drunk(B)).units;
  await offer(A, 1); await until(() => cardText(B), 5000);
  await A.page.evaluate(() => window.__p2p.spend(1000));
  await press(B, 'Accetta');
  ok('Anna is told she has no money', await has(A, /Sienza picciuli/), (await toasts(A)).join(' | '));
  ok('Bob is told the drink did not come, and gets no drink', await has(B, /Anna un havi picciuli/) && (await drunk(B)).units <= u0 + 0.01, (await toasts(B)).join(' | '));

  // 8. no money at all: refused on Anna's side before anything is sent
  await reset(A, B); await clear(A); await clear(B);
  ok('with an empty wallet the offer is refused', (await offer(A, 1)) === false && await has(A, /Sienza picciuli/));
  ok('and Bob is not bothered', (await cardText(B)) === null);

  // 9. Bob is in the pause menu: busy
  // Anna has no money left: a second giver
  const C = await player(h, { name: 'Carla', ns, x: 142, z: -204, extra: 'cash=20', size: [900, 500], isolated: true }); await watch(C);
  ok('Carla meets Bob', await meet(C, B));
  await B.page.keyboard.press('KeyP'); await sleep(600);
  ok('in the pause menu the buttons are hidden', await B.page.evaluate(() => [...document.querySelectorAll('.pd-p2p')].every(e => getComputedStyle(e).display === 'none')));
  await clear(C); await offer(C, 1);
  ok('Carla is told Bob is busy', await has(C, /Bob è occupatu/), (await toasts(C)).join(' | '));
  ok('and no card shows up on a paused Bob', (await cardText(B)) === null);
  await B.page.screenshot({ path: out + '/offer-4-bob-paused.png' });
  await B.page.keyboard.press('KeyP'); await sleep(600);

  // 10. Bob has had enough
  await reset(C, B); await B.page.evaluate(() => window.game.drunk.setUnits(6)); await clear(C); await offer(C, 1);
  ok('Carla is told Bob has had enough', await has(C, /Bob n’avi abbastanza/), (await toasts(C)).join(' | '));
  await B.page.evaluate(() => window.game.drunk.setUnits(0));

  // 11. Bob leaves while the offer is out
  await reset(C, B); await clear(C); await offer(C, 1); await until(() => cardText(B), 4000);
  await B.page.close();
  ok('Carla is told Bob is gone and the waiting line goes', await has(C, /Bob un c’è chiù/, 15000) && !(await pillText(C)), (await toasts(C)).join(' | '));

  // hostile messages: nothing is given, nothing throws
  const bad7 = await C.page.evaluate(() => { const u0 = window.game.drunk.units; const r = window.__p2p.fuzz([['o', new Uint8Array([6, 1, 5])], ['o', new Uint8Array([5, 0, 5])], ['o', new Uint8Array([7, 9, 5])], ['o', new Uint8Array([4, 9, 5])], ['o', new Uint8Array([4])], ['o', new Uint8Array(40)], ['o', new Uint8Array([9, 1, 1])], ['o', new Uint8Array([6, 1, 0])]]); return { ...r, gift: window.game.drunk.units - u0, card: !!document.querySelector('[role=alertdialog]') }; });
  ok('hostile offer messages: no throw, no drink, no card', bad7.threw === 0 && bad7.gift === 0 && !bad7.card, JSON.stringify(bad7));
  console.log('errors', A.errs, C.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
