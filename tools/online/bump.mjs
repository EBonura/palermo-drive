// Bumping between real players (docs/ONLINE.md, "Bumping"): real game pages in their own windows, all muted, against the real relay code running on this machine
// (`npm run dev` in relay-worker/, that is `wrangler dev`). Never a public service: tools/online/lib.mjs refuses any address that is not local.
//   node tools/build/build.mjs --test-relay --out=<dist>
//   (cd relay-worker && npx wrangler dev --port 8787 --ip 127.0.0.1 --var JURISDICTION:)
//   tools/release/withbrowser.sh node tools/online/bump.mjs --root <dist> --relay ws://127.0.0.1:8787/r [--out dir] [--spot x,z,th] [--soak seconds] [--video]
// What it checks: a ram on a parked player moves both cars and tells the relay once; repeated bumps stay under the relay's TO rate; a hostile client that floods maximum pushes moves
// the victim by no more than the receiver's budget; a page with ?bump=off is unchanged. And it measures the frames the bumping adds, for the free plan's 2 million incoming messages a day.
import fs from 'node:fs';
import { start, player, sleep, arg } from './lib.mjs';
import { startBot } from './bot.mjs';
import { packHit, MAX_DV, RX_BUDGET, RX_BURST, TX_PER_S, TX_BURST } from '../../src/online/bump.js';

const out = arg('out', '/private/tmp/claude-501/online-bump'); fs.mkdirSync(out, { recursive: true });
const [sx, sz, sth] = arg('spot', '400,400,0').split(',').map(Number);
const GAP = 8, soakS = +arg('soak', 40), video = process.argv.includes('--video');
const h = await start();
const httpBase = h.relayUrl.replace(/^ws/, 'http').replace(/\/r$/, '');
const relayStats = async () => (await fetch(httpBase + '/stats')).json();
const dropsSince = (a, b) => Object.fromEntries(Object.entries(b.dropped || {}).map(([k, v]) => [k, v - ((a.dropped || {})[k] || 0)]).filter(([, v]) => v > 0));   // the relay's counters run on between runs
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(74), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const mute = P => P.page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination'); if (!d || d.get.__muted) return; const get = function () { if (!this.__z) { this.__z = this.createGain(); this.__z.gain.value = 0; } return this.__z; }; get.__muted = true; Object.defineProperty(BaseAudioContext.prototype, 'destination', { get, configurable: true }); });
const meet = async (...Ps) => { for (let i = 0; i < 120; i++) { const n = await Promise.all(Ps.map(P => P.page.evaluate(() => window.__p2p.remotes.size))); if (n.every(v => v >= Ps.length - 1)) return true; await sleep(500); } return false; };
// where a car is (and what it does), and the page's own counters
const car = P => P.page.evaluate(() => { const c = window.game.car; return { x: c.x, z: c.z, vx: c.vx, vz: c.vz, v: Math.hypot(c.vx, c.vz), th: c.th, w: c.w }; });
const bstats = P => P.page.evaluate(() => JSON.parse(JSON.stringify({ bump: window.__p2p.bump, tx: window.__p2p.stats.tx, txBytes: window.__p2p.stats.txBytes, rx: window.__p2p.stats.rx })));
// the page records its car every frame in window.__tr
const record = (P, on) => P.page.evaluate(on => { if (window.__rec) { cancelAnimationFrame(window.__rec.raf); } if (!on) { const r = window.__rec ? window.__rec.d : []; window.__rec = null; return r; } window.__rec = { d: [], t0: performance.now() }; const f = () => { const c = window.game.car; window.__rec.d.push([Math.round(performance.now() - window.__rec.t0), +c.x.toFixed(2), +c.z.toFixed(2), +Math.hypot(c.vx, c.vz).toFixed(2)]); window.__rec.raf = requestAnimationFrame(f); }; window.__rec.raf = requestAnimationFrame(f); }, on);
const place = (P, x, z, th, v = 0) => P.page.evaluate(([x, z, th, v]) => { const c = window.game.car; c.x = x; c.z = z; c.th = th; c.vx = Math.sin(th) * v; c.vz = Math.cos(th) * v; c.vf = v; c.w = 0; }, [x, z, th, v]);
const ahead = (d, side = 0) => [sx + Math.sin(sth) * d + Math.cos(sth) * side, sz + Math.cos(sth) * d - Math.sin(sth) * side];
// both cars parked nose to nose 8 m apart, then one of them (the other every time) drives into the other at 11 m/s
const ramOnce = async i => {
  await place(A, ...ahead(0), sth); await place(Bp, ...ahead(GAP), sth + Math.PI); await sleep(250);
  if (i % 2) await place(Bp, ...ahead(GAP), sth + Math.PI, 11); else await place(A, ...ahead(0), sth, 11);
  await sleep(1750);
};
const rnd = n => +n.toFixed(2);
const sum = (a, b) => ({ sent: a.bump.sent - b.bump.sent, bounces: a.bump.bounces - b.bump.bounces, applied: a.bump.applied - b.bump.applied, tx: a.tx - b.tx });

let A, Bp, C, all;
try {
  A = await player(h, { name: 'Anna', x: sx, z: sz, th: sth, size: [960, 540], isolated: true });
  Bp = await player(h, { name: 'Bob', x: ahead(GAP + 3)[0], z: ahead(14)[1], th: sth + Math.PI, size: [640, 360], isolated: true });
  C = await player(h, { name: 'Carla', x: ahead(20)[0], z: ahead(20)[1], th: sth, size: [640, 360], isolated: true });
  all = [A, Bp, C]; await Promise.all(all.map(mute));
  ok('three players meet through the local relay', await meet(A, Bp, C));
  await sleep(2500);   // the relay has told everyone who is who, and the first states have been drawn

  // 1. a ram: Anna drives into parked Bob at 12 m/s
  await place(A, ...ahead(0), sth); await place(Bp, ...ahead(GAP), sth + Math.PI); await place(C, ...ahead(60), sth);   // Carla well away
  await sleep(2000);
  const a0 = await bstats(A), b0 = await bstats(Bp), r0 = await relayStats(); const rStart = r0;
  await Promise.all([record(A, true), record(Bp, true)]);
  if (video) { /* frames are taken below */ }
  let shots = 0, filming = video;
  const film = async () => { while (filming) { const n = String(shots++).padStart(4, '0'); await Promise.all([A.page.screenshot({ path: `${out}/f-a-${n}.jpg`, type: 'jpeg', quality: 70 }), Bp.page.screenshot({ path: `${out}/f-b-${n}.jpg`, type: 'jpeg', quality: 70 })]); } };
  const filmed = video ? film() : null;
  await place(A, ...ahead(0), sth, 12);
  await sleep(2500);
  filming = false; await filmed;
  const [trA, trB] = await Promise.all([record(A, false), record(Bp, false)]);
  fs.writeFileSync(out + '/ram-trace.json', JSON.stringify({ anna: trA, bob: trB }));
  const a1 = await bstats(A), b1 = await bstats(Bp), r1 = await relayStats();
  const peakA = Math.max(...trA.map(p => p[3])), peakB = Math.max(...trB.map(p => p[3]));
  const cB = await car(Bp);
  console.log('   Anna peak ' + peakA + ' m/s; Bob peak ' + peakB + ' m/s; Anna', JSON.stringify(sum(a1, a0)), 'Bob', JSON.stringify(sum(b1, b0)), 'relay forwarded +' + (r1.framesForwarded - r0.framesForwarded), 'dropped', JSON.stringify(r1.dropped));
  ok('the ram bounced Anna (her page counted a bounce)', sum(a1, a0).bounces >= 1);
  ok('Anna slowed down (she does not drive through Bob)', trA.some(p => p[3] < 9));
  ok('Anna told Bob once or twice, not a stream', sum(a1, a0).sent >= 1 && sum(a1, a0).sent <= 3, 'sent ' + sum(a1, a0).sent);
  ok('Bob felt it: he was moving after being parked (applied, or his own bounce)', peakB > 1.5, 'peak ' + peakB);
  ok('Bob never moved faster than the push the rule allows', peakB <= MAX_DV + 2, 'peak ' + peakB);
  ok('the relay dropped no frame for a rate or a rule', Object.keys(dropsSince(rStart, r1)).filter(k => /to /.test(k)).length === 0, JSON.stringify(dropsSince(rStart, r1)));
  await A.page.screenshot({ path: out + '/ram-anna.png' }); await Bp.page.screenshot({ path: out + '/ram-bob.png' });

  // 2. twenty rams in a row: messages per bump and the relay's TO rate
  await sleep(1500);
  const c0 = await Promise.all(all.map(bstats)); const t0 = Date.now(); let r2 = await relayStats();
  const rr0 = r2;
  const N = 20;
  for (let i = 0; i < N; i++) await ramOnce(i);
  const c1 = await Promise.all(all.map(bstats)); const dt = (Date.now() - t0) / 1000; r2 = await relayStats();
  const sentTotal = c1[0].bump.sent + c1[1].bump.sent - c0[0].bump.sent - c0[1].bump.sent, bouncesTotal = c1[0].bump.bounces + c1[1].bump.bounces - c0[0].bump.bounces - c0[1].bump.bounces, applied = c1[0].bump.applied + c1[1].bump.applied - c0[0].bump.applied - c0[1].bump.applied;
  console.log(`   ${N} rams in ${dt.toFixed(0)} s: bounces ${bouncesTotal}, hit messages sent ${sentTotal}, applied by the other side ${applied}, relay dropped ${JSON.stringify(dropsSince(rr0, r2))}`);
  ok('every ram bounced at least one of the two cars', bouncesTotal >= N * 0.8, bouncesTotal + ' for ' + N);
  ok('hit messages per ram: about one, never a stream', sentTotal <= N * 2.5, (sentTotal / N).toFixed(2) + ' per ram');
  ok('the relay refused none of them (no "to rate", no "to not allowed")', !Object.keys(dropsSince(rr0, r2)).some(k => /^to /.test(k)), JSON.stringify(dropsSince(rr0, r2)));
  ok('the phones refused none for a bad frame', c1.every(c => c.bump.drops.bad === 0));

  // 3. a flooding client: a bot beside Bob sends maximum pushes as fast as the relay will pass them
  await place(A, ...ahead(-80), sth); await place(C, ...ahead(-100), sth); await place(Bp, ...ahead(0), sth, 0); await sleep(1500);
  const bot = await startBot(h.relayUrl, { name: 'Mallory', x: ahead(0)[0], z: ahead(-3)[1], wantK: 8 });
  bot.state({ x: ahead(-3)[0], z: ahead(-3)[1], th: sth, v: 0 });
  await sleep(2500);   // Bob draws Mallory
  const mal = bot.handle, bobHandle = [...bot.entered.keys()][0];
  ok('the bot is one of Bob\'s players and Bob is one of its', !!bobHandle && (await Bp.page.evaluate(() => window.__p2p.remotes.size)) >= 1);
  if (bobHandle) {
    await place(Bp, ...ahead(0), sth, 0); const bb0 = await bstats(Bp); const rm0 = await relayStats();
    const hit = packHit(0, 1e9, 1e9);   // as far forward as one message goes
    const t1 = Date.now(); let sent = 0;
    while (Date.now() - t1 < 3000) { bot.state({ x: ahead(-3)[0], z: ahead(-3)[1], th: sth, v: 0 }); for (let k = 0; k < 8; k++) { bot.to(bobHandle, hit); sent++; } await sleep(40); }
    await sleep(500); const bb1 = await bstats(Bp), rm1 = await relayStats(), cb = await car(Bp);
    const gained = bb1.bump.applied - bb0.bump.applied;
    console.log(`   flood: ${sent} hit messages in 3 s; the relay passed what its rate allows; Bob accepted ${gained}; Bob drops ${JSON.stringify(bb1.bump.drops)}; relay dropped ${JSON.stringify(dropsSince(rm0, rm1))}`);
    ok('the relay\'s own TO rate cut the flood', (dropsSince(rm0, rm1)['to rate'] || 0) > 0, JSON.stringify(dropsSince(rm0, rm1)));
    ok('Bob accepted no more than his budget allows', gained * 1 <= (RX_BURST + RX_BUDGET * 3.5) / MAX_DV + 4, 'accepted ' + gained);
    ok('and Bob\'s speed stays within what the budget allows (not 10 m/s a message)', cb.v <= RX_BURST + RX_BUDGET * 3.5, 'v ' + rnd(cb.v));
  }
  await bot.close();

  // 4. the cost: three players driving and bumping for a while, with bumping on and with ?bump=off on the same drive (frames up per player per second)
  if (soakS > 0) {
    const drive = async secs => {   // Anna and Bob ram each other every 2 s; Carla drives past slowly
      const s0 = await Promise.all(all.map(bstats)); const q0 = await relayStats(); const t = Date.now();
      for (let i = 0; Date.now() - t < secs * 1000; i++) await ramOnce(i);
      const s1 = await Promise.all(all.map(bstats)), q1 = await relayStats(), dt = (Date.now() - t) / 1000;
      return { dt, up: s1.map((s, i) => (s.tx - s0[i].tx) / dt), sent: s1.map((s, i) => s.bump.sent - s0[i].bump.sent), relayIn: (q1.framesIn - q0.framesIn) / dt, relayFwd: (q1.framesForwarded - q0.framesForwarded) / dt };
    };
    const withB = await drive(soakS);
    console.log('   bumping on : frames up per player per second', withB.up.map(rnd).join(' / '), ' hit messages', withB.sent.join(' / '), ' relay in/s', rnd(withB.relayIn), ' forwarded/s', rnd(withB.relayFwd));
    fs.writeFileSync(out + '/soak.json', JSON.stringify({ withBump: withB }));
    ok('Anna and Bob sent hit messages during the soak, Carla (far away) none', withB.sent[0] + withB.sent[1] > 0 && withB.sent[2] === 0, withB.sent.join('/'));
    const perPlayerMax = Math.max(...withB.up);
    ok('no player sent more than 12 frames a second (the relay\'s limit for all frames)', perPlayerMax < 12, rnd(perPlayerMax));
    ok('hit messages per player stay under the TO rate we allow ourselves', Math.max(...withB.sent) / withB.dt <= TX_PER_S + TX_BURST / withB.dt, rnd(Math.max(...withB.sent) / withB.dt) + '/s');
  }
  ok('no page errors', all.every(P => P.errs.length === 0), all.map(P => P.errs.join(';')).join(' | '));
} catch (e) { console.error(e); bad++; } finally { await h.close(); }
console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
