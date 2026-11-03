// Walkthrough of every interaction between two real players, desktop (--phone off) or phone-size windows with touch (--phone on): for each step it prints what each
// player SEES (the other's car, name, bubble, toast line, card, buttons) and takes a picture of both screens into --out. Checks the things that must hold; the rest is for reading.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/interact.mjs --root <dist> [--phone on] [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const phone = arg('phone', 'off') === 'on', tag = phone ? 'phone' : 'desk', out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'in' + Date.now().toString(36);
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const watch = P => P.page.evaluate(() => { window.__t = []; const feed = () => { const e = document.querySelector('.ev-toast'), x = e && e.textContent; if (x && (!window.__t.length || window.__t[window.__t.length - 1] !== x)) window.__t.push(x); }; new MutationObserver(feed).observe(document.body, { subtree: true, childList: true, characterData: true }); });
const see = P => P.page.evaluate(() => {
  const vis = e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const btn = [...document.querySelectorAll('.pd-p2p')].filter(e => e.tagName !== 'DIV' || e.style.position === 'fixed').filter(vis).length;
  const d = window.__p2p, card = document.querySelector('[role=alertdialog]');
  return { game: d.gameState(), cars: [...d.remotes.values()].map(r => r.name + (r.bubble ? ' [says]' : '')).join(',') || '-', peers: d.peers.size, p2pUi: btn, card: card ? card.textContent : '', toasts: window.__t.slice(-4).join(' | ') };
});
const row = async (step, A, B) => { const a = await see(A), b = await see(B); console.log(`[${tag}] ${step}\n   Anna: ${JSON.stringify(a)}\n   Bob : ${JSON.stringify(b)}`); return [a, b]; };
const meet = async (...Ps) => { for (let i = 0; i < 90; i++) { const n = await Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.remotes.size))); if (n.every(v => v >= 1)) return true; await sleep(1000); } return false; };
const shot = async (n, ...Ps) => { for (const P of Ps) await P.page.screenshot({ path: `${out}/int-${tag}-${n}-${P.name}.png` }); };
const tap = (P, sel, txt) => P.page.evaluate(([s, t]) => { const b = [...document.querySelectorAll(s)].find(x => !t || x.textContent === t); if (b) b.click(); return !!b; }, [sel, txt]);
const opts = { ns, size: [900, 500], phone, isolated: true };
try {
  const A = await player(h, { ...opts, name: 'Anna', x: 137, z: -212, extra: 'cash=20' });
  await watch(A); await sleep(3000);
  const [a0] = await Promise.all([see(A)]); console.log(`[${tag}] alone`, JSON.stringify(a0));
  ok('alone: no talk button on screen', a0.p2pUi === 0, JSON.stringify(a0));
  const B = await player(h, { ...opts, name: 'Bob', x: 141, z: -205 }); await watch(B);
  ok('Bob joins: they meet', await meet(A, B)); await sleep(1500);
  let [a, b] = await row('join', A, B); ok('join: both see a car and have the talk button', a.cars === 'Bob' && b.cars === 'Anna' && a.p2pUi === 1 && b.p2pUi === 1);
  await shot('1-join', A, B);

  // a phrase, by the buttons (a finger on the phone)
  await tap(A, 'button[title=T]'); await sleep(300);
  await A.page.evaluate(() => document.querySelectorAll('svg[role=menu] [role=menuitem]')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(300);
  await A.page.evaluate(() => document.querySelectorAll('svg[role=menu] [role=menuitem]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(1200);
  [a, b] = await row('phrase', A, B); ok('phrase: Bob sees a bubble on Anna, Anna sees her words as a line', /says/.test(b.cars) && a.toasts !== '');
  await shot('2-phrase', A, B);

  // an offer, from the wheel (Brindisi e da bere, the beer is its seventh slice), answered with a tap
  await tap(A, 'button[title=T]'); await sleep(300);
  const slice = i => A.page.evaluate(i => document.querySelectorAll('svg[role=menu] [role=menuitem]')[i].dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
  await slice(2); await sleep(300); await slice(6); await sleep(1500);
  [a, b] = await row('offer sent', A, B); ok('offer: Bob has a card that names Anna and the drink', /Anna ti offre una birra/.test(b.card));
  await shot('3-offer', A, B);
  await B.page.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find(x => x.textContent === 'Accetta').click()); await sleep(2500);
  [a, b] = await row('accepted', A, B); ok('accepted: Anna told, Bob told', /accittau/.test(a.toasts) && /t’offriu/.test(b.toasts));
  await sleep(3500); await shot('4-dizzy', A, B);
  const dz = await B.page.evaluate(() => ({ u: window.game.drunk.units, l: window.game.drunk.level, post: window.game.drunk.post })); ok('Bob is dizzy', dz.u > 0.8 && dz.post, JSON.stringify(dz));

  // name change: Options asks for the card with this event (the pencil is gone)
  await B.page.evaluate(() => dispatchEvent(new Event('pd-open-name'))); await sleep(300);
  await B.page.evaluate(() => { const i = document.querySelector('[role=dialog] input'); i.value = 'Roberto'; [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent === 'Salva').click(); });
  await sleep(2500); [a, b] = await row('Bob renamed', A, B); ok('rename: Anna sees Roberto', a.cars === 'Roberto'); await shot('5-rename', A, B);

  // pause menu and Garage
  await B.page.keyboard.press('KeyP'); await sleep(800); [a, b] = await row('Bob paused', A, B); ok('pause: no p2p buttons on Bob', b.p2pUi === 0);
  await shot('6-pause', B);
  if (!phone) {
    await tap(B, 'button[data-do=garage]'); await sleep(2500);
    const g = await B.page.evaluate(() => ({ cls: document.documentElement.classList.contains('pd-in-garage'), ui: [...document.querySelectorAll('.pd-p2p')].filter(e => getComputedStyle(e).display !== 'none').length }));
    ok('Garage: no p2p buttons on screen', g.cls && g.ui === 0, JSON.stringify(g)); await shot('7-garage', B);
  }
  await sleep(7000); [a, b] = await row('Bob away 10 s', A, B); console.log(`   (Anna still sees Bob after 10 s away: ${a.cars})`);
  await B.page.evaluate(() => { document.documentElement.classList.remove('pd-in-garage'); });
  await B.page.close();
  await sleep(4000); [a] = await Promise.all([see(A)]); console.log(`[${tag}] Bob closed his page: Anna sees ${a.cars}`); ok('leaving: the car is gone for Anna', a.cars === '-' && a.p2pUi === 0);
  console.log('errors', A.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
