// The talk wheel: T opens it, a category opens its phrases, a phrase (keyboard digit or a click) shows up as a bubble on the other side;
// Escape closes it without opening the pause menu; the drink wedges make an offer. Screenshots of both rings go to --out (a folder).
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/wheel.mjs --root <dist built with --p2p> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501'), ns = 'wh' + Date.now().toString(36);
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(52), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const st = P => P.page.evaluate(() => { const w = document.querySelector('svg[role=menu]'); const root = w && w.parentElement; return { open: !!root && root.style.display !== 'none', items: w ? [...w.querySelectorAll('[role=menuitem]')].map(g => g.getAttribute('aria-label')) : [], game: window.__p2p.gameState() }; });
const bubbleOn = (P, name) => P.page.evaluate(n => [...window.__p2p.remotes.values()].filter(r => r.name === n && r.bubble).map(r => r.bubble.sprite.material.map.image && r.bubble.until > performance.now()).length, name);
try {
  const A = await player(h, { name: 'Anna', ns, x: -300, z: 250, size: [900, 500] });
  const B = await player(h, { name: 'Bob', ns, x: -296, z: 258, size: [900, 500] });
  await sleep(3500);
  await A.page.keyboard.press('KeyT'); await sleep(300);
  let s = await st(A); ok('T opens the wheel with the five categories', s.open && s.items.length === 5, JSON.stringify(s.items));
  await A.page.screenshot({ path: out + '/wheel-1.png' });
  await A.page.keyboard.press('Digit1'); await sleep(300);
  s = await st(A); ok('category 1 shows its phrases', s.open && s.items.length === 8, JSON.stringify(s.items));
  await A.page.screenshot({ path: out + '/wheel-2.png' });
  await A.page.keyboard.press('Escape'); await sleep(300);
  s = await st(A); ok('Escape closes the wheel, no pause menu', !s.open && s.game === 'play', s.game);
  // by clicking, as a mouse or a finger does
  await A.page.keyboard.press('KeyT'); await sleep(200);
  const click = async label => { const r = await A.page.evaluate(l => { const g = [...document.querySelectorAll('svg[role=menu] [role=menuitem]')].find(x => x.getAttribute('aria-label') === l); if (!g) return null; const b = g.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, label); if (!r) return false; await A.page.mouse.click(r[0], r[1]); await sleep(300); return true; };
  ok('click the category Complimenti', await click('Complimenti'));
  ok('click the phrase talìa chi beddu!', await click('talìa chi beddu!'));
  await sleep(1200);
  s = await st(A); ok('the wheel closed after the phrase', !s.open);
  ok('Bob shows a bubble over Anna', (await bubbleOn(B, 'Anna')) === 1);
  const said = await B.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => r.bubble && r.bubble.sprite.material.map.image.width));
  await B.page.screenshot({ path: out + '/wheel-3.png' });
  // a drink wedge with nobody close enough is refused politely (Bob is 9 m away: close enough, so it is sent)
  await sleep(1600);
  await A.page.keyboard.press('KeyT'); await A.page.keyboard.press('Digit3'); await sleep(200);
  s = await st(A); ok('Brindisi lists the toasts and both drinks', s.items.length === 7 && s.items.includes('Offri una birra'), JSON.stringify(s.items));
  await A.page.keyboard.press('Escape');
  // the wheel closes by itself when the game pauses
  await A.page.keyboard.press('KeyT'); await sleep(200); await A.page.keyboard.press('KeyP'); await sleep(600);
  s = await st(A); ok('pausing closes the wheel', !s.open && s.game === 'pause', s.game);
  console.log('errors', A.errs, B.errs);
  // the phone
  // the wheel only stays open when somebody is near, so Pia has a neighbour (Pol)
  const P = await player(h, { name: 'Pia', ns: ns + 'p', x: -300, z: 250, phone: true });
  const Q = await player(h, { name: 'Pol', ns: ns + 'p', x: -296, z: 254, phone: true });
  await P.page.waitForFunction(() => window.__p2p.remotes.size > 0, { timeout: 90000, polling: 500 }); await sleep(500);
  await P.page.evaluate(() => document.querySelector('button[title=T]').click()); await sleep(400);
  await P.page.screenshot({ path: out + '/wheel-phone-1.png' });
  await P.page.evaluate(() => document.querySelectorAll('svg[role=menu] [role=menuitem]')[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(400);
  await P.page.screenshot({ path: out + '/wheel-phone-2.png' });
  ok('Pia sees the phrases ring on the phone', (await st(P)).open && (await st(P)).items.length === 7, JSON.stringify((await st(P)).items));
  console.log('phone errors', P.errs, Q.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
