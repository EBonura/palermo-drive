// The multiplayer section's feed and who receives a phrase: Anna and Bob are 8 m apart, Cleo is 600 m away (a ring on their maps, not a car). Bob says a phrase: Anna sees a line with Bob's
// name and the words, a bubble over his car and hears the chirp; Cleo gets nothing (no line, no sound). Anna's own line reads the same way. A name with markup shows as plain text.
// Cleo sending anyway (the raw message, past the sender's own check) is ignored by Anna and Bob. Run at 480x270 desktop or --phone on, and in English with --lang en.
//   /private/tmp/claude-501/withbrowser.sh node tools/p2p/feed.mjs --root <dist> [--lang en] [--phone on] [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501/p2pfeed'), lg = arg('lang', 'it'), phone = arg('phone', 'off') === 'on', ns = 'fd' + Date.now().toString(36), h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(76), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 200) { const v = await fn(); if (v) return v; await sleep(200); } return null; };
const feed = P => P.page.evaluate(() => [...document.querySelectorAll('.mpx-line')].map(l => l.textContent));
const chirps = P => P.page.evaluate(() => window.__osc || 0);
const bubble = (P, nm) => P.page.evaluate(n => [...window.__p2p.remotes.values()].filter(r => r.name === n && r.bubble).length, nm);
const meet = async (P, n) => until(async () => (await P.page.evaluate(() => window.__p2p.peers.size)) >= n, 120000);
const said = lg === 'en' ? 'said' : 'dici';
const opts = { ns, size: [900, 500], phone, isolated: true, extra: 'lang=' + lg };
const beep = () => { const AC = window.AudioContext; const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__osc = (window.__osc || 0) + 1; return o.apply(this, arguments); }; };
try {
  const A = await player(h, { ...opts, name: 'Anna', x: -300, z: 250 });
  const B = await player(h, { ...opts, name: '<i>Bo</i>', x: -292, z: 250 });
  const C = await player(h, { ...opts, name: 'Cleo', x: -300, z: 850 });
  for (const P of [A, B, C]) await P.page.evaluate(beep);
  ok('everybody is connected to everybody', await meet(A, 2) && await meet(B, 2) && await meet(C, 2));
  await sleep(3000);
  const reach = await Promise.all([A, B, C].map(P => P.page.evaluate(() => window.__p2p.inReach())));
  ok('Anna and Bob reach each other, Cleo reaches nobody', reach[0] === 1 && reach[1] === 1 && reach[2] === 0, reach.join(','));
  const sub = await A.page.evaluate(() => document.querySelector('.mpx-cap').innerText.replace(/\n/g, ' | '));
  ok('Anna\'s section says 2 players and 1 within 400 m', lg === 'en' ? /2 players \| 1 within 400 m/.test(sub) : /2 giocatori \| 1 entro 400 m/.test(sub), sub);
  // Bob says "talìa chi beddu!" (index 20) through the wheel's own path
  await B.page.evaluate(() => window.__p2p.say(20));
  const bub = !!(await until(async () => (await bubble(A, '<i>Bo</i>')) === 1, 4000));   // the bubble stands 4.5 s: look for it first, a slow phone profile is not a missing bubble
  await sleep(1500);
  const [fa, fb, fc] = await Promise.all([feed(A), feed(B), feed(C)]);
  const want = `<i>Bo</i> ${said} “talìa chi beddu!”`;
  ok('Anna sees: name, said, the phrase', fa.length === 1 && fa[0] === want, JSON.stringify(fa));
  ok('Bob sees his own line the same way', fb.length === 1 && fb[0] === want, JSON.stringify(fb));
  ok('Cleo (600 m) sees nothing', fc.length === 0, JSON.stringify(fc));
  ok('the markup in a name is plain text, never HTML', await A.page.evaluate(() => !document.querySelector('.mpx-feed i') && !!document.querySelector('.mpx-n') && document.querySelector('.mpx-n').textContent === '<i>Bo</i>'));
  ok('Anna has the bubble over Bob\'s car', bub);
  const [ca, cb, cc] = await Promise.all([chirps(A), chirps(B), chirps(C)]);
  ok('Anna heard a chirp, Cleo did not', ca > 0 && cc === 0, `${ca}/${cb}/${cc}`);
  await A.page.screenshot({ path: `${out}/feed-anna.png` }).catch(() => {});
  // Cleo sends the raw message anyway, past her own check: the receivers ignore it
  await sleep(1800);
  await C.page.evaluate(() => { const r = [...window.__p2p.rooms.values()].find(x => x.peers.size); r.say.send(new Uint8Array([3, 4])).catch(() => {}); });
  await sleep(2500);
  const [ga, gb] = await Promise.all([feed(A), feed(B)]);
  ok('a raw message from 600 m is ignored: no new line, no bubble, no chirp', ![...ga, ...gb].some(l => /Cleo/.test(l)) && (await bubble(A, 'Cleo')) === 0 && (await bubble(B, 'Cleo')) === 0 && (await chirps(A)) === ca, JSON.stringify([ga, gb]));
  // Cleo through say(): nobody within reach, nothing sent, the section says so
  const sent = await C.page.evaluate(() => { const s0 = window.__p2p.stats.txMsgs; const r = window.__p2p.say(5); return { r, d: window.__p2p.stats.txMsgs - s0 }; });
  ok('say() with nobody within 400 m sends nothing and returns false', sent.r === false && sent.d === 0, JSON.stringify(sent));
  // Bob drives to Anna's far side: out of 400 m, his next phrase is not shown
  await sleep(1800);
  await B.page.evaluate(() => { const c = window.game.car; c.x = -300; c.z = -200; c.vx = c.vz = 0; });
  await until(async () => (await A.page.evaluate(() => window.__p2p.inReach())) === 0 && (await B.page.evaluate(() => window.__p2p.inReach())) === 0, 20000);
  const said2 = await B.page.evaluate(() => window.__p2p.say(4)); await sleep(2000);
  const [ha, hb] = await Promise.all([feed(A), feed(B)]);
  ok('Bob, 450 m away, is refused (nobody near) and Anna sees nothing new', said2 === false && !ha.some(l => /fraaaagola/.test(l)) && !hb.some(l => /fraaaagola/.test(l)), JSON.stringify([said2, ha, hb]));
  // the lines fade by themselves
  await sleep(8500);
  ok('old lines are gone after a few seconds', (await feed(A)).length === 0 && (await feed(B)).length === 0);
  console.log('errors', A.errs, B.errs, C.errs);
  ok('no page errors', ![A, B, C].some(P => P.errs.filter(e => !/Content Security Policy/.test(e)).length));
} finally { await h.close(); }
process.exit(bad ? 1 : 0);
