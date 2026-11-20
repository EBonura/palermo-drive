// The player is told, very clearly, when online play is not there and why (docs/ONLINE.md, "When online is not available"). One desktop page and one phone page (844x390) go through every state on a relay
// simulator: connected, full, over for today (the relay's free daily limit), this address's own share used, cannot be reached (the relay's Worker over ITS limit: an answer the browser cannot read), and back again.
// For each state it asserts the pill's words and colour, the panel's sentence, the toast, the local time shown, that the car still drives, that nothing is thrown, that the relay is asked at most once per failed
// step and never while connected, and that the pill sits clear of the map and the music bar. Screenshots go to ~/.cache/palermo-drive/online-states/ (look at them).
//   tools/release/withbrowser.sh node tools/online/states.mjs --root <dist built with --test-relay> [--lang it|en]
// Needs its own relay simulator (it changes its answers), so it does not take --relay.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { start, player, sleep, until, arg } from './lib.mjs';
import { resetTime } from '../../src/online/status.js';
if (arg('relay', '')) { console.log('SKIP: this test changes its own relay'); process.exit(0); }
const lang = arg('lang', 'it'), TZ = 'Europe/Rome';
const SHOTS = path.join(os.homedir(), '.cache/palermo-drive/online-states'); fs.mkdirSync(SHOTS, { recursive: true });
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(86), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };

// what the words must be (the same lines as src/online/status.js, written out here so that a change to one is seen in the other)
const WORDS = {
  it: { full: 'Online chinu', done: 'Online finutu pi oggi', off: 'Online un funziona', fullMsg: 'Ora siemu truappu online. Riprovu iu tra picca, tu intantu ioca.', doneMsg: 'Pi oggi l’online finìu: u server è aggratis e i gettoni finieru. Tuinna doppu i {time}. Intantu ioca sulu.', offMsg: 'L’online ora un funziona. Riprovu iu, tu intantu ioca.', back: 'L’online tuinnàu!', budgetMsg: 'Pi oggi i to’ gettoni finieru. Tuinna doppu i {time}. Intantu ioca sulu.' },
  en: { full: 'Online full', done: 'Online done for today', off: 'Online unavailable', fullMsg: 'The online city is full right now. Try again in a bit, and keep driving solo in the meantime.', doneMsg: 'Online play is finished for today: the free server has used up its daily allowance. It comes back after {time}. Solo play carries on.', offMsg: 'Online play is not available right now. The game keeps trying, and solo play carries on.', back: 'Online is back!', budgetMsg: 'You have used your share of online play for today. It comes back after {time}. Solo play carries on.' },
}[lang];
const COLOUR = { ok: 'rgb(0, 225, 255)', full: 'rgb(255, 176, 32)', done: 'rgb(255, 90, 90)', off: 'rgb(181, 160, 255)' };

// the local time of the next 00:00 UTC, worked out another way than the game does it: the zone's offset on that day, added to midnight
function localMidnight(tz, now = Date.now()) {
  const d = new Date(now), at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at).find(p => p.type === 'timeZoneName').value;   // GMT+01:00
  const m = /GMT([+-])(\d\d):(\d\d)/.exec(off), mins = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0, t = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
// the arithmetic itself, in other places and in summer and winter (no browser)
ok('00:00 UTC is 01:00 in Italy in winter and 02:00 in summer', resetTime(Date.UTC(2026, 0, 15, 12), 'it', 'Europe/Rome') === '01:00' && resetTime(Date.UTC(2026, 6, 1, 12), 'it', 'Europe/Rome') === '02:00');
ok('and 19:00 in New York in winter, 05:30 in India, 00:00 in London in winter', resetTime(Date.UTC(2026, 0, 15, 12), 'en', 'America/New_York') === '19:00' && resetTime(Date.UTC(2026, 0, 15, 12), 'en', 'Asia/Kolkata') === '05:30' && resetTime(Date.UTC(2026, 0, 15, 12), 'en', 'Europe/London') === '00:00');
ok('the day after a late evening UTC is still the next midnight', resetTime(Date.UTC(2026, 6, 1, 23, 59), 'it', 'Europe/Rome') === '02:00');

const h = await start();
const ui = page => page.evaluate(() => {
  const q = s => document.querySelector(s), root = q('.mpx'), cap = q('.mpx-cap'), t1 = q('.mpx-txt > span'), ring = q('.mpx-ring'), msg = q('.mpx-msg'), talk = q('.mpx-talk');
  const vis = e => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0, box = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const hit = (a, b) => b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const others = ['.pd-bar', '#pd-card'].map(s => q(s)).filter(Boolean).map(box), mine = [cap, msg].filter(vis).map(box);
  const rs = getComputedStyle(ring);
  return { shown: root.classList.contains('on'), tone: (/ t-(\w+)/.exec(root.className) || [])[1] || '', pill: t1.textContent, ring: rs.backgroundColor === 'rgba(0, 0, 0, 0)' ? rs.borderTopColor : rs.backgroundColor, msg: vis(msg) ? msg.textContent : '', talk: vis(talk), toast: [...document.querySelectorAll('.ev-toast')].map(e => e.textContent).join(' | '),
    capW: Math.round(cap.getBoundingClientRect().width), vw: innerWidth, overlap: mine.some(m => others.some(o => hit(m, o))), clipped: [cap, msg].filter(vis).some(e => e.getBoundingClientRect().right > innerWidth - 4 || e.getBoundingClientRect().bottom > innerHeight - 2), nowrap: t1.getBoundingClientRect().height < 22 };
});
const shot = async (P, state) => { await P.page.screenshot({ path: path.join(SHOTS, `${lang}-${state}-${P.kind}.png`) }); };
const dialogs = page => page.evaluate(() => [...document.querySelectorAll('[role=alertdialog],[role=alert],[role=dialog]')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').length);
const info = P => P.page.evaluate(() => { const r = window.__p2p.relay(); return { ...r, fails: window.__p2p.log.filter(e => e.ev === 'fail').length }; });
// the player says "online" again (the switch in Options, the same answer as the card): one attempt now, whatever the link was waiting for. The browser's "online" event can no longer do this step after step: it is heard once in ten minutes.
const retry = async (...Ps) => { await sleep(350); for (const P of Ps) await P.page.evaluate(() => dispatchEvent(new CustomEvent('pd-net-mode', { detail: true }))); };
let A, B;
try {
  A = await player(h, { name: 'Anna', x: 100, z: 100, size: [1100, 620], extra: 'lang=' + lang }); A.kind = 'desktop';
  B = await player(h, { name: 'Bea', x: 400, z: 400, phone: true, extra: 'lang=' + lang }); B.kind = 'phone';
  for (const P of [A, B]) await P.page.emulateTimezone(TZ);
  const sim = h.relay, both = [A, B];
  const sawAll = async (label, want, extraCheck = () => true, wantToast = null) => {
    for (const P of both) {
      const got = await until(async () => { const u = await ui(P.page); return u.pill === want.pill && u.msg === want.msg ? u : null; }, 9000, 150);
      const u = got || await ui(P.page);
      ok(`${label}: ${P.kind}: pill says "${want.pill}", panel says the sentence`, !!got, got ? '' : JSON.stringify({ pill: u.pill, msg: u.msg }));
      ok(`${label}: ${P.kind}: colour ${want.tone}, no talk button, one line, clear of the map and the music bar, not cut off`, u.ring === COLOUR[want.tone] && (want.tone === 'ok' || !u.talk) && u.nowrap && !u.overlap && !u.clipped, JSON.stringify({ ring: u.ring, talk: u.talk, nowrap: u.nowrap, overlap: u.overlap, clipped: u.clipped, capW: u.capW, vw: u.vw }));
      if (wantToast) { const t = await until(async () => { const x = await ui(P.page); return x.toast.includes(wantToast) ? x.toast : null; }, 4000, 100); ok(`${label}: ${P.kind}: a toast said it`, !!t, t || (await ui(P.page)).toast); }
      extraCheck(u, P);
    }
  };

  // ---- connected
  ok('both are connected', !!(await until(async () => (await info(A)).ready && (await info(B)).ready, 20000, 200)));
  await sleep(2500); for (const P of both) P.dialogs0 = await dialogs(P.page);
  ok('while connected the relay is never asked for a status', (await info(A)).asks === 0 && (await info(B)).asks === 0 && sim.stats().status === 0, `status requests ${sim.stats().status}`);
  for (const P of both) { const u = await ui(P.page); ok(`connected: ${P.kind}: the cyan ring and the talk button, as before`, u.shown && u.ring === COLOUR.ok && u.talk && u.tone === '' && !u.msg, JSON.stringify(u)); }
  await shot(A, 'connected'); await shot(B, 'connected');

  // ---- the relay is full: every upgrade refused with 503, and /status says so
  sim.set({ maxConns: 0 }); sim.dropAll(1001); await retry(A, B);
  await sawAll('full', { pill: WORDS.full, msg: WORDS.fullMsg, tone: 'full' }, () => {}, WORDS.fullMsg.slice(0, 20));
  await shot(A, 'full'); await shot(B, 'full');
  ok('the page asked /status once per failed step: no more requests than failures', (await info(A)).asks > 0 && (await info(A)).asks <= (await info(A)).fails && (await info(B)).asks <= (await info(B)).fails, JSON.stringify([await info(A), await info(B)].map(i => [i.asks, i.fails])));

  // ---- there is room again: recovered, said once
  sim.set({ maxConns: 300 }); await retry(A, B);
  for (const P of both) {
    ok(`back: ${P.kind}: connected again and the player is told once`, !!(await until(async () => { const u = await ui(P.page); return u.toast.includes(WORDS.back) && u.tone === '' ? u : null; }, 9000, 150)));
  }
  await sleep(2500); await shot(A, 'recovered'); await shot(B, 'recovered');
  const asksBack = sim.stats().status; await sleep(3000);
  ok('connected again: no more status requests', sim.stats().status === asksBack);

  // ---- the relay closes us with 1013 (making room): full at once, no status request needed
  const s0 = sim.stats().status; sim.set({ maxConns: 0 }); sim.dropAll(1013, 'making room'); await sleep(250);
  ok('the close code alone said it: full at once, no request for /status', sim.stats().status === s0 && (await info(A)).why === 'full' && (await info(B)).why === 'full', `${sim.stats().status - s0} requests`);
  await sawAll('kicked (1013)', { pill: WORDS.full, msg: WORDS.fullMsg, tone: 'full' });

  // ---- over for today: the relay's object has used its free daily limit (the simulator fakes the status answer and refuses the upgrades)
  const doneMsg = WORDS.doneMsg.replace('{time}', localMidnight(TZ));
  sim.set({ maxConns: 300, status: 'quota' }); sim.refuse(503); sim.dropAll(1001); await retry(A, B);
  await sawAll('over for today', { pill: WORDS.done, msg: doneMsg, tone: 'done' }, (u, P) => ok(`over for today: ${P.kind}: the time shown is ${localMidnight(TZ)}, 00:00 UTC on this player's clock`, u.msg.includes(localMidnight(TZ))), doneMsg.slice(0, 20));
  await shot(A, 'done'); await shot(B, 'done');
  // another time zone: the same sentence, the player's own clock
  await A.page.emulateTimezone('America/New_York'); const ny = localMidnight('America/New_York');
  ok(`in New York the same sentence says ${ny}`, !!(await until(async () => (await ui(A.page)).msg.includes(ny), 4000, 150)), (await ui(A.page)).msg);
  await A.page.emulateTimezone(TZ);
  // a daily reason stands: more failed steps do not ask again
  const q0 = sim.stats().status; await retry(A, B); await retry(A, B); await sleep(800);
  ok('a known daily reason is not asked about again at every step', sim.stats().status === q0, `${sim.stats().status - q0} more requests over 2 more failed steps`);

  // ---- this address has used its own share: the upgrade is refused with 429, /status says budget
  // (first the relay is itself again and they connect: that is what clears the old reason)
  const budgetMsg = WORDS.budgetMsg.replace('{time}', localMidnight(TZ));
  sim.set({ status: 'real', frameDay: 800000 }); sim.refuse(0); await retry(A, B); await until(async () => (await info(A)).ready && (await info(B)).ready, 15000, 200);
  sim.set({ frameDay: 0 }); sim.dropAll(1008, 'daily allowance used');
  await sawAll('your share used (closed with 1008)', { pill: WORDS.done, msg: budgetMsg, tone: 'done' });
  await shot(A, 'budget'); await shot(B, 'budget');
  sim.set({ frameDay: 800000 }); await retry(A, B); await until(async () => (await info(A)).ready && (await info(B)).ready, 15000, 200);
  sim.set({ frameDay: 800000 }); await retry(A, B); await until(async () => (await info(A)).ready && (await info(B)).ready, 15000, 200);

  // ---- cannot be reached: the Worker is over ITS limit, Cloudflare answers with its own page, which the browser will not let the page read
  sim.set({ status: 'blackout' }); sim.refuse(503); sim.dropAll(1001); await retry(A, B);
  await sawAll('cannot be reached', { pill: WORDS.off, msg: WORDS.offMsg, tone: 'off' }, () => {}, WORDS.offMsg.slice(0, 20));
  await shot(A, 'unreachable'); await shot(B, 'unreachable');
  for (const P of both) {
    const moved = await P.page.evaluate(() => new Promise(res => { const g = window.game, c = g.car, x = c.x, z = c.z; g.keys.ArrowUp = g.keys.KeyW = true; setTimeout(() => { g.keys.ArrowUp = g.keys.KeyW = false; res(Math.hypot(c.x - x, c.z - z)); }, 3000); }));
    ok(`unreachable: ${P.kind}: solo driving carries on`, moved > 2 && (await P.page.evaluate(() => window.__p2p.gameState())) === 'play', moved.toFixed(1) + ' m');
    ok(`unreachable: ${P.kind}: no dialog was opened`, (await dialogs(P.page)) === P.dialogs0);
  }

  // ---- everything comes back
  sim.set({ status: 'real' }); sim.refuse(0); await retry(A, B);
  for (const P of both) ok(`recovered: ${P.kind}: said once, connected`, !!(await until(async () => { const u = await ui(P.page); return u.toast.includes(WORDS.back) && u.tone === '' ? u : null; }, 9000, 150)));

  // ---- the rule: asked only after a failure, never while connected, never more than once per failed step
  for (const P of both) { const i = await info(P); ok(`${P.kind}: ${i.asks} status requests for ${i.fails} failed sockets`, i.asks <= i.fails); }
  ok('the relay saw no more requests than the pages made (the browser serves a repeat within the 5 s of Cache-Control from its cache)', sim.stats().status <= (await info(A)).asks + (await info(B)).asks, `${sim.stats().status} of ${(await info(A)).asks + (await info(B)).asks}`);

  // ---- nothing thrown: the browser itself logs refused sockets and a blocked cross-origin answer
  for (const P of both) { const errs = P.errs.filter(e => !/WebSocket connection|Failed to load resource|CORS|ERR_|status of 4|status of 5/.test(e)); ok(`${P.kind}: no page errors other than the browser's own notes on refused connections`, !errs.length, JSON.stringify(errs)); }
  for (const P of both) { const s = await P.page.evaluate(() => ({ ...window.__p2p.stats })); ok(`${P.kind}: nothing thrown in the frame handlers`, s.threw === 0, JSON.stringify(s)); }
} finally { await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
