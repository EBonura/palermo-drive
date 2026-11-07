// The relay fallback (src/p2p/fallback.js, docs/P2P-MULTIPLAYER.md "Relay fallback"), with WebRTC made to fail on purpose (?iceblock: TURN candidates only, and no TURN server).
//   1. two players, both blocked: they see each other move, with names; a phrase and a drink offer go through; the car moves smoothly at 3 updates a second
//   2. a third player, not blocked: the blocked one sees both through the relays, the two others see each other directly (a blocked pair next to a working one)
//   3. the block is lifted on the first player: the next connection opens, and the relays stop for that pair (upgrade)
//   4. a player closes the page: gone from the others, no ghost
// Use --local (five local relays, nothing public). --short runs only part 1 (the public relay check: 2 players, a private ns).
//   tools/release/withbrowser.sh node tools/p2p/fallback.mjs --root <dist> --local [--out dir] [--short]
import fs from 'node:fs';
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', process.env.HOME + '/.cache/palermo-drive/fallback'), ns = 'fb' + Date.now().toString(36), short = process.argv.includes('--short');
fs.mkdirSync(out, { recursive: true });
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(74), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const until = async (fn, ms = 8000, step = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
const view = P => P.page.evaluate(() => [...window.__p2p.remotes.values()].map(r => ({ name: r.name, shown: r.shown, car: !!r.model, snaps: r.snaps.length, delay: Math.round(r.delay || 0) })));
const fbPeers = P => P.page.evaluate(() => window.__p2p.peerInfo().filter(p => p.fb).length);
const direct = P => P.page.evaluate(() => window.__p2p.peerInfo().filter(p => p.rooms.length).length);
const box = P => P.page.evaluate(() => window.__p2p.fbText());
const circle = (P, cx, cz, r, v) => P.page.evaluate(([cx, cz, r, v]) => {   // the car goes round a circle at v m/s, set every frame
  const c = window.game.car; let a = 0, last = performance.now(); window.__drive && cancelAnimationFrame(window.__drive);
  const f = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; a += v / r * dt; c.x = cx + Math.cos(a) * r; c.z = cz + Math.sin(a) * r; c.th = Math.atan2(-Math.sin(a), Math.cos(a)); c.vf = v; c.vx = Math.sin(c.th) * v; c.vz = Math.cos(c.th) * v; window.__drive = requestAnimationFrame(f); };
  window.__drive = requestAnimationFrame(f);
}, [cx, cz, r, v]);
// how the other car is drawn, frame by frame, for secs seconds: steps between frames against what its speed explains (a teleport is a step far beyond it)
const smooth = (P, name, secs) => P.page.evaluate(([name, secs]) => new Promise(res => {
  const r = [...window.__p2p.remotes.values()].find(x => x.name === name); if (!r || !r.model) return res(null);
  const steps = []; let last = null, lt = performance.now(); const t0 = lt;
  const f = now => { const p = r.model && r.model.root.position, dt = (now - lt) / 1000; lt = now; if (p && last && dt > 0) steps.push([Math.hypot(p.x - last.x, p.z - last.z) / dt, dt]); last = p && { x: p.x, z: p.z }; if (now - t0 < secs * 1000) requestAnimationFrame(f); else {
    const v = steps.map(s => s[0]).sort((a, b) => a - b), q = k => +v[Math.min(v.length - 1, Math.floor(v.length * k))].toFixed(1);
    const st = steps.map(s => s[0] * s[1]);
    res({ frames: v.length, stepMaxM: +Math.max(...st).toFixed(2), speedP5: q(0.05), speedP50: q(0.5), speedP95: q(0.95), speedMax: q(1), framesOver2x: v.filter(s => s > 2 * 14).length, delayMs: Math.round(r.delay), gapMs: Math.round(r.gap) }); } };
  requestAnimationFrame(f);
}), [name, secs]);
const toasts = P => P.page.evaluate(() => window.__t ? window.__t.slice() : []);
const watchToasts = P => P.page.evaluate(() => { window.__t = []; new MutationObserver(() => { const e = document.querySelector('.ev-toast'), x = e && e.textContent; if (x && window.__t[window.__t.length - 1] !== x) window.__t.push(x); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
try {
  const X = 137, Z = -212;   // a street both pages can stand on (tools/p2p/offer.mjs)
  const A = await player(h, { name: 'Anna', ns, x: X, z: Z, extra: `iceblock&at=${X},${Z},0`, size: [900, 500], isolated: true });
  const B = await player(h, { name: 'Bob', ns, x: X + 6, z: Z + 6, extra: `iceblock&at=${X + 6},${Z + 6},0`, size: [900, 500], isolated: true });
  const t0 = Date.now();
  const met = await until(async () => { const [a, b] = await Promise.all([view(A), view(B)]); return a.some(v => v.name === 'Bob' && v.car) && b.some(v => v.name === 'Anna' && v.car); }, 120000, 500);
  console.log('  blocked pair saw each other after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  ok('1. two blocked players see each other, with names', !!met, JSON.stringify([await view(A), await view(B)]));
  ok('   through the relays: no direct connection, each holds the other on fallback', (await direct(A)) === 0 && (await fbPeers(A)) === 1 && (await fbPeers(B)) === 1, `direct ${await direct(A)} fallback ${await fbPeers(A)},${await fbPeers(B)}`);
  for (const P of [A, B]) console.log('  ' + P.name + ' fallback events', JSON.stringify(await P.page.evaluate(() => window.__p2p.log.filter(e => /^(fb|upgrade|drop|firstState|join|leave)/.test(e.ev)).map(e => [e.t, e.ev, e.peer || (e.room || '').split(':').slice(2).join(','), e.why || e.via || '']))));
  ok('   every WebRTC attempt failed (the block works)', await A.page.evaluate(() => window.__p2p.wire().then(w => w.open === 0)), await A.page.evaluate(() => window.__p2p.wire().then(w => JSON.stringify(w.link) + ' pcs ' + w.pcs)));
  console.log('  test box:', await box(A));
  // movement: Bob drives a circle of 30 m at 14 m/s; Anna's view of him
  await circle(B, X + 30, Z, 30, 14); await sleep(8000);
  const sm = await smooth(A, 'Bob', 10);
  console.log('  Anna draws Bob (14 m/s on a circle):', JSON.stringify(sm));
  ok('   Bob moves on Anna\'s screen at his speed, never a jump (no frame step over 1.5 m)', !!sm && sm.speedP50 > 12.6 && sm.speedP50 < 15.4 && sm.stepMaxM < 1.5, JSON.stringify(sm));
  await A.page.screenshot({ path: out + '/fb-1-anna-sees-bob.png' });
  // a phrase
  await Promise.all([watchToasts(A), watchToasts(B)]);
  const said = await B.page.evaluate(() => window.__p2p.say(0));
  const heard = await until(() => A.page.evaluate(() => { const r = [...window.__p2p.remotes.values()].find(x => x.name === 'Bob'); return !!(r && r.bubble); }), 6000, 100);
  ok('   a phrase from Bob shows over his car on Anna\'s screen', said && !!heard);
  await A.page.screenshot({ path: out + '/fb-2-anna-phrase.png' });
  // a drink: Anna offers, Bob accepts, Anna pays (a free round), Bob is told
  await circle(B, X + 6, Z + 6, 0.01, 0.01); await sleep(2500);
  ok('   Anna offers Bob a beer', await A.page.evaluate(() => window.__p2p.offer(1)));
  const card = await until(() => B.page.evaluate(() => { const c = document.querySelector('[role=alertdialog]'); return c && c.textContent; }), 8000, 150);
  ok('   Bob gets the card', /Anna/.test(card || ''), card);
  await B.page.screenshot({ path: out + '/fb-3-bob-card.png' });
  await B.page.evaluate(() => document.querySelector('[role=alertdialog] button[data-act=yes]').click());
  ok('   Bob accepts: Anna is told, Bob is treated', !!(await until(async () => (await toasts(A)).some(t => /Bob accittau/.test(t)) && (await toasts(B)).some(t => /Anna t’offriu/.test(t)), 8000, 200)), JSON.stringify([await toasts(A), await toasts(B)]));
  const st = await A.page.evaluate(() => ({ fb: window.__p2p.fb.stats, relays: window.__p2p.fb.relays(), guard: window.__p2p.guard.used('fallback'), frames: window.__p2p.guard.used('frames') }));
  console.log('  Anna fallback stats', JSON.stringify(st));
  if (!short) {
    // 2. a third player, not blocked
    const C = await player(h, { name: 'Carla', ns, x: X - 6, z: Z - 6, extra: `at=${X - 6},${Z - 6},0`, size: [900, 500], isolated: true });
    const all3 = await until(async () => { const [a, b, c] = await Promise.all([view(A), view(B), view(C)]); return a.filter(v => v.car).length === 2 && b.filter(v => v.car).length === 2 && c.filter(v => v.car).length === 2; }, 120000, 500);
    ok('2. with a third, unblocked player everybody sees the two others', !!all3, JSON.stringify([await view(A), await view(B), await view(C)]));
    const cInfo = await C.page.evaluate(() => window.__p2p.peerInfo());
    ok('   Carla: none direct with the blocked ones, both on the relays', cInfo.filter(p => p.fb).length === 2 && cInfo.filter(p => p.rooms.length).length === 0, JSON.stringify(cInfo));
    // the working pair: a fourth player, also unblocked, connects to Carla directly while both keep the blocked ones on the relays
    const D = await player(h, { name: 'Dino', ns, x: X - 3, z: Z + 3, extra: `at=${X - 3},${Z + 3},0`, size: [900, 500], isolated: true });
    const pair = await until(async () => { const c = await C.page.evaluate(() => window.__p2p.peerInfo()); const v = await view(C); return v.filter(x => x.car).length === 3 && c.filter(p => p.rooms.length).length === 1 && c.filter(p => p.fb).length === 2; }, 120000, 500);
    ok('   Carla and Dino connect directly, next to the two pairs on the relays', !!pair, JSON.stringify(await C.page.evaluate(() => window.__p2p.peerInfo())));
    await C.page.screenshot({ path: out + '/fb-4-carla-sees-three.png' });
    // the same drive seen through a direct link (Dino) and through the relays (Anna), on Carla's screen
    await Promise.all([circle(D, X - 30, Z, 30, 14), circle(A, X + 30, Z, 30, 14)]); await sleep(5000);
    const [smD, smA] = await Promise.all([smooth(C, 'Dino', 10), smooth(C, 'Anna', 10)]);
    console.log('  Carla draws Dino (direct):', JSON.stringify(smD)); console.log('  Carla draws Anna (relay): ', JSON.stringify(smA));
    ok('   Anna through the relays moves about as smoothly as Dino directly', !!smA && !!smD && smA.stepMaxM < 1.5 && smA.speedP95 - smA.speedP5 < 2 * (smD.speedP95 - smD.speedP5) + 4, JSON.stringify({ smA, smD }));
    await Promise.all([circle(D, X - 3, Z + 3, 0.01, 0.01), circle(A, X, Z, 0.01, 0.01)]);
    console.log('  Carla test box:', await box(C));
    await D.page.close();
    // 3. upgrade: lift the block on Anna; Carla is not blocked, so the next attempt between them can open
    await A.page.evaluate(() => window.__p2p.iceBlock(false));
    const up = await until(async () => { const a = await A.page.evaluate(() => window.__p2p.peerInfo()); const c = a.find(p => p.rooms.length && !p.fb); return c ? a : null; }, 150000, 1000);
    ok('3. block lifted on Anna: her link to Carla opens and the relays stop for it', !!up, JSON.stringify(await A.page.evaluate(() => window.__p2p.peerInfo())));
    const evs = await A.page.evaluate(() => window.__p2p.log.filter(e => /^(fb|upgrade)/.test(e.ev)).map(e => e.ev + ' ' + (e.peer || e.room || '')));
    ok('   Anna logged an upgrade', evs.some(e => /^upgrade/.test(e)), evs.join(', '));
    ok('   and still sees both (Dino, who closed his page, is gone)', !!(await until(async () => { const v = await view(A); return v.length === 2 && v.filter(x => x.car).length === 2 && !v.some(x => x.name === 'Dino'); }, 15000)), JSON.stringify(await view(A)));
    // 4. leaving: Bob closes his page
    const tl = Date.now(); await B.page.close();
    const gone = await until(async () => !(await view(A)).some(v => v.name === 'Bob') && !(await view(C)).some(v => v.name === 'Bob'), 30000, 250);
    console.log('  Bob closed; gone from Anna and Carla after', ((Date.now() - tl) / 1000).toFixed(1), 's');
    ok('4. a player on the relays who closes the page is gone from the others', !!gone, JSON.stringify([await view(A), await view(C)]));
    await sleep(12000);
    ok('   and does not come back (no ghost)', !(await view(A)).some(v => v.name === 'Bob') && !(await view(C)).some(v => v.name === 'Bob') && (await A.page.evaluate(() => window.__p2p.peers.size)) === 1, JSON.stringify([await view(A), await view(C)]));
    console.log('  errors', A.errs.slice(0, 3), C.errs.slice(0, 3));
  }
  console.log('  errors', A.errs.slice(0, 3), B.errs && B.errs.slice(0, 3));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
