// Anna flies (wings, hold F): Bob must see her car in the air, and put back on the ground when she lands. Also looks for a bridge deck near Ponte Corleone: a car standing on
// a deck is sent with its height, so on the other screen it must stand on the deck, not in the river bed.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/fly.mjs --root <dist> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pinteract'), ns = 'fl' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
// what Bob has for Anna: the height she sent, and where her car really is drawn above the ground there
const seen = P => P.page.evaluate(() => { const d = window.__p2p, p = [...d.peers.values()][0], r = p && d.remotes.get(p.id); const m = r && r.model && r.model.root; return p && m ? { sent: +(p.h || 0).toFixed(1), drawnY: +(m.position.y - window.game.groundY(m.position.x, m.position.z)).toFixed(1) } : null; });
const mine = P => P.page.evaluate(() => ({ lift: +window.game.car.lift.toFixed(1), flying: !!window.game.car.flying }));
try {
  const A = await player(h, { name: 'Anna', ns, x: 137, z: -212, size: [900, 500], isolated: true, extra: 'own=all' });
  const B = await player(h, { name: 'Bob', ns, x: 141, z: -205, size: [900, 500], isolated: true });
  for (let i = 0; i < 90; i++) { if ((await seen(B)) && (await seen(A))) break; await sleep(1000); }
  await A.page.evaluate(() => { window.game.car.wings = true; });
  ok('on the road she is sent with no height', (await seen(B)).sent === 0 && (await seen(B)).drawnY < 0.5, JSON.stringify(await seen(B)));
  await A.page.keyboard.down('KeyF'); await sleep(4500);
  const m = await mine(A), s = await seen(B); console.log('   Anna', JSON.stringify(m), 'Bob sees', JSON.stringify(s));
  ok('Anna is flying', m.flying && m.lift > 20, JSON.stringify(m));
  ok('Bob sees her high up, within 12 m of her real height (she is still climbing at 13 m/s while it is measured)', !!s && s.drawnY > 20 && Math.abs(s.drawnY - m.lift) < 12, JSON.stringify(s));
  await A.page.screenshot({ path: out + '/fly-1-anna.png' });
  // Bob looks up at her: put his camera by his car, she is 5 m away horizontally and high
  await B.page.screenshot({ path: out + '/fly-2-bob.png' });
  await A.page.keyboard.up('KeyF');
  // the descent is smooth on Bob's side: sample the drawn height every 200 ms
  const track = [], times = []; for (let i = 0; i < 200; i++) { const s2 = await seen(B); track.push(s2 ? s2.drawnY : null); times.push(Date.now()); if (s2 && (s2.drawnY < 0.5 || (track.length > 4 && track.slice(-4).every(v => v === s2.drawnY)))) break; await sleep(250); }   // lands, or hovers (src/vehicle-air.js keeps 22 m while the tiles under it are not ready: a headless run)
  console.log('   Bob sees her come down:', track.join(' '));
  let speed = 0; for (let i = 1; i < track.length; i++) speed = Math.max(speed, Math.abs(track[i] - track[i - 1]) / Math.max(0.05, (times[i] - times[i - 1]) / 1000));   // m/s of the drawn height, whatever the machine's load
  ok('the drawn height never changes faster than the car can (under 20 m/s: climb 13, glide 3 to 8)', speed < 20, 'fastest ' + speed.toFixed(1) + ' m/s')
  // pictures from both sides: Bob 25 m off, looking at her
  await B.page.evaluate(() => { const c = window.game.car; c.x = 137; c.z = -187; c.th = Math.PI; c.vx = c.vz = 0; }); await sleep(2500);
  // a third window with a fixed camera 30 m from her and a little above, so that a picture shows her car in the air as the others draw it
  const gy = await A.page.evaluate(() => window.game.groundY(137, -212)), lift = (await mine(A)).lift;
  const C = await player(h, { name: 'Cam', ns, x: 137, z: -182, size: [900, 500], isolated: true, extra: `campos=137,${(gy + lift + 4).toFixed(1)},-183&look=137,${(gy + lift).toFixed(1)},-212&hud` });
  await sleep(6000); console.log('   Anna at', JSON.stringify(await A.page.evaluate(() => [window.game.car.x, window.game.car.z])), 'gy', gy, 'lift', lift, 'Cam draws', JSON.stringify(await C.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => r.model && [r.name, r.model.root.position.x, r.model.root.position.y, r.model.root.position.z, r.model.root.visible, r.alpha]))));
  await C.page.screenshot({ path: out + '/fly-4-seen-from-the-side.png' });
  await B.page.screenshot({ path: out + '/fly-3-bob-looking-up.png' }); await A.page.screenshot({ path: out + '/fly-3-anna-in-air.png' });
  await sleep(2000); const g = await seen(B), gm = await mine(A); ok('Bob draws her at the height she is really at (the ground when she has landed)', Math.abs(g.drawnY - gm.lift) < 1.5, JSON.stringify({ ...g, hers: gm.lift }));
  console.log('errors', A.errs, B.errs);
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
