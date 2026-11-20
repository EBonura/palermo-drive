// Hostile frames through the real handlers of a running game page, one group for every frame type the relay sends (WELCOME, ENTER, LEAVE, STATE, SAY, TO, ONLINE) and for the frame as a whole
// (wrong size, not bytes, unknown type, a flood, more players than the table holds). The page has no relay to talk to (its address is a closed port): the frames are handed to it directly.
// Passes when nothing throws, bad frames are counted and dropped, names come out as plain text, and the table of players stays within its cap.
//   tools/release/withbrowser.sh node tools/online/fuzz.mjs --root <dist built with --test-relay>
import { start, player } from './lib.mjs';
import { IN, packInfo, stateFrame, toFrame } from '../../src/online/wire.js';
const h = await start();
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(66), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
const enc = s => new TextEncoder().encode(s), u16 = n => [n & 255, n >> 8];
const arr = b => [...b];
const info = (v, l, nameBytes) => [v, l, nameBytes.length, ...nameBytes];
const enter = (handle, i) => [IN.ENTER, ...u16(handle), ...i];
const welcome = (handle, online = 3, ver = 2) => [IN.WELCOME, ver, ...u16(handle), ...u16(online)];
const leave = handle => [IN.LEAVE, ...u16(handle)];
const st = (handle, mut, o = {}) => { const f = arr(stateFrame({ t: 1000, x: 100, z: 100, th: 1, v: 5, steer: 0, roll: 0, lean: 0, fl: 0, k: 0, a: 0, h: 0, ...o })); const b = [IN.STATE, ...u16(handle), ...f.slice(1)]; if (mut) mut(b); return b; };   // [4][handle][state]: the state starts at byte 3
const say = (handle, p) => [IN.SAY, ...u16(handle), p];
const to = (handle, ...d) => [IN.TO, ...u16(handle), ...d];
try {
  // the relay is a closed port: the page never connects, and what it is given is only what this tool gives it
  const A = await player(h, { name: 'Anna', x: -1250, z: 250, relay: 'ws://127.0.0.1:9/r' });
  const run = (label, frames, check) => A.page.evaluate(fr => window.__p2p.fuzz(fr.map(f => f === null || typeof f === 'string' || typeof f === 'number' ? f : new Uint8Array(f))), frames).then(r => { ok(label, r.threw === 0 && check(r), JSON.stringify(r)); return r; });
  const player_ = hd => A.page.evaluate(x => window.__p2p.player(x), hd);

  // before WELCOME nothing means anything
  await run('before WELCOME: ENTER, STATE, SAY, TO, LEAVE, ONLINE are all bad', [enter(7, info(0, 0, enc('x'))), st(7), say(7, 1), to(7, 4, 0, 1), leave(7), [IN.ONLINE, 5, 0]], r => r.bad === 6 && r.players === 0);
  // WELCOME
  await run('WELCOME of the wrong size, version 1, handle 0 (bad)', [[IN.WELCOME, 2, 1, 0], [IN.WELCOME, 2, 1, 0, 1, 0, 0], welcome(5, 1, 1), welcome(0)], r => r.bad === 4);
  await run('a good WELCOME', [welcome(4000)], r => r.bad === 0);
  await run('a second WELCOME (bad)', [welcome(4001)], r => r.bad === 1);
  // ENTER
  await run('ENTER: a name with markup comes out as plain text', [enter(10, info(0, 0, enc('<img src=x onerror=alert(1)>')))], r => r.bad === 0 && r.players === 1);
  ok('  ... and it is only text', (await player_(10)).name === '<img src=x onerror=alert(1)>'.slice(0, 16) && !/[\u0000-\u001f]/.test((await player_(10)).name));
  await run('ENTER: control, bidi and zero width characters are removed', [enter(11, info(0, 0, enc('A‮evil​\u0000⁦x⁩\n\tB')))], r => r.bad === 0);
  ok('  ... leaving "AevilxB"', (await player_(11)).name === 'AevilxB', JSON.stringify(await player_(11)));
  await run('ENTER: emoji, and a long one (kept to 16 characters)', [enter(12, info(0, 0, enc('😀'.repeat(16)))), enter(13, info(0, 0, enc('x'.repeat(64))))], r => r.bad === 0);
  ok('  ... 16 characters', [...(await player_(13)).name].length === 16);
  await run('ENTER: name over 64 bytes, a length field that lies, no name field (bad)', [enter(14, info(0, 0, new Uint8Array(65).fill(65))), enter(14, [0, 0, 200, 65]), [IN.ENTER, ...u16(14), 0, 0], [IN.ENTER, ...u16(14)]], r => r.bad === 4);
  await run('ENTER: vehicle and livery out of range (the lapa, its first livery)', [enter(15, info(99, 0, enc('x'))), enter(16, info(250, 255, enc('y'))), enter(17, info(0, 99, enc('z')))], r => r.bad === 0);
  ok('  ... lapa, livery 0', (await player_(15)).vehicle === 'calessino' && (await player_(16)).livery === 0 && (await player_(17)).livery === 0);
  await run('ENTER: invalid UTF-8', [enter(18, info(0, 0, new Uint8Array([0xff, 0xfe, 0xc0, 0x80])))], r => r.bad === 0);
  await run('ENTER: handle 0 (bad), our own handle (bad)', [enter(0, info(0, 0, enc('x'))), enter(4000, info(0, 0, enc('x')))], r => r.bad === 2);
  await run('ENTER: the same again changes nothing and costs nothing', [enter(10, info(0, 0, enc('<img src=x onerror=alert(1)>')))], r => r.bad === 0 && r.dropped === 0 && r.players === 8);
  await run('ENTER: a new name for a known player at once is dropped', [enter(10, info(0, 0, enc('Other')))], r => r.dropped === 1);
  // LEAVE
  await run('LEAVE: wrong size, handle 0 (bad); a handle we never had (ignored)', [[IN.LEAVE, 1], [IN.LEAVE, 1, 0, 0], leave(0), leave(9999)], r => r.bad === 3 && r.players === 8);
  await run('LEAVE: a known player goes', [leave(12)], r => r.players === 7);
  // STATE
  await run('STATE: wrong sizes (bad)', [st(10).slice(0, 20), [...st(10), 0], [...st(10), 0, 0, 0], new Array(500).fill(4)], r => r.bad === 4);
  await run('STATE: reserved flag bits, height flag without the bytes, height bytes without the flag (bad)', [st(10, b => { b[3 + 14] = 0x10; }), st(10, b => { b[3 + 14] = 0x80; }), st(10, b => { b[3 + 14] = 8; }), [...st(10), 1, 0]], r => r.bad === 4);
  await run('STATE: position beyond 20 km (bad)', [st(10, b => b.splice(3 + 2, 5, 255, 255, 255, 255, 255))], r => r.bad === 1);
  await run('STATE: height of 6553 m and of 1000.1 m (bad), of 12.3 m (fine)', [st(10, b => { b[3 + 14] = 8; b.push(255, 255); }), st(10, b => { b[3 + 14] = 8; b.push(0x11, 0x27); }), st(10, null, { h: 12.3 })], r => r.bad === 2);
  await run('STATE: extreme speed, curvature and acceleration are clamped (fine)', [st(10, b => { b[3 + 9] = 0x00; b[3 + 10] = 0x80; b[3 + 15] = 0xff; b[3 + 16] = 0x7f; b[3 + 17] = 0x80; }, { t: 2000 })], r => r.bad === 0);
  await run('STATE: a copy and an older one are dropped (not bad)', (() => { const a = st(10, null, { t: 5000 }); return [a, a.slice(), st(10, null, { t: 4000 })]; })(), r => r.bad === 0);
  await run('STATE: from a handle that was never introduced is dropped', [st(777)], r => r.dropped === 1 && r.bad === 0);
  const flood = []; for (let i = 0; i < 300; i++) flood.push(st(10, null, { t: 10000 + i * 20 }));
  const fr = await A.page.evaluate(fl => { const d = window.__p2p; d.fuzz([], true); return d.fuzz(fl.map(f => new Uint8Array(f)), false); }, flood);
  ok('STATE: a flood of 300 from one player (60 in, the rest dropped)', fr.threw === 0 && fr.dropped >= 200 && fr.dropped <= 260, JSON.stringify(fr));
  // SAY
  await run('SAY: wrong size, phrase out of range, handle 0 (bad)', [[IN.SAY, 10, 0], [IN.SAY, 10, 0, 0, 0], say(10, 200), say(0, 1)], r => r.bad === 4);
  await run('SAY: from a player we cannot see, or never knew (dropped, nothing shown)', [say(10, 1), say(888, 1)], r => r.bad === 0 && r.dropped >= 1);
  // TO
  await run('TO: no direct bytes, more than 8 (bad)', [[IN.TO, 10, 0], to(10, 1, 2, 3, 4, 5, 6, 7, 8, 9), [IN.TO, 0, 0, 4, 0, 1]], r => r.bad === 3);
  await run('TO: unknown message types, wrong sizes (bad)', [to(10, 0), to(10, 9, 9, 9), to(10, 4), to(10, 4, 5, 6, 7), to(10, 7, 99, 1), to(10, 4, 2, 1)], r => r.bad === 6);
  await run('TO: offers answered with nothing asked are dropped, not bad', [to(10, 5, 0, 1), to(10, 6, 0, 1), to(10, 7, 0, 1), to(10, 7, 6, 1)], r => r.bad === 0);
  await run('TO: an offer from a player far away is answered "too far": no card', [to(10, 4, 0, 1)], r => r.bad === 0);
  ok('  ... no card on the screen', !(await A.page.evaluate(() => window.__p2p.offerState().card)));
  await run('TO: from a handle never introduced is dropped', [to(777, 4, 0, 1)], r => r.dropped === 1 && r.bad === 0);
  // ONLINE
  await run('ONLINE: wrong size (bad), a good one', [[IN.ONLINE], [IN.ONLINE, 1], [IN.ONLINE, 1, 0, 0], [IN.ONLINE, 9, 0]], r => r.bad === 3);
  // the frame as a whole
  await run('not bytes, empty, 97 bytes, type 0, type 8, type 255 (bad)', [null, 'text', 12345, [], new Array(97).fill(1), [0, 1, 2], [8, 0, 0, 0], [255, 0, 0, 0]], r => r.bad === 8);
  // the table: more players than it holds
  const many = []; for (let i = 0; i < 60; i++) many.push(enter(100 + i, info(0, 0, enc('p' + i))));
  const cap = await A.page.evaluate(fr => window.__p2p.fuzz(fr.map(f => new Uint8Array(f))), many);
  ok('ENTER: 60 more players: the table stays at its cap, the rest are dropped', cap.threw === 0 && cap.players === 16 && cap.dropped >= 50, JSON.stringify(cap));
  // the relay as a whole: a flood through the real entry point
  const inj = await A.page.evaluate(fl => window.__p2p.inject(fl.map(f => new Uint8Array(f))), Array.from({ length: 3000 }, (_, i) => st(10, null, { t: 20000 + i * 20 })));
  ok('3000 frames at once through the relay limit: most dropped, nothing thrown', inj.threw === 0 && inj.dropped >= 2000, JSON.stringify(inj));
  const fin = await A.page.evaluate(() => ({ ...window.__p2p.stats, players: window.__p2p.peers.size, drawn: window.__p2p.remotes.size }));
  const errs = A.errs.filter(e => !/WebSocket connection|Failed to load resource/.test(e));   // the closed port the page was given is refused, and the browser says so (for the socket, and for the one /status it then asks)
  ok('nothing was thrown in all of it, the cap held, and no page error', fin.threw === 0 && fin.players <= 16 && fin.drawn <= 8 && !errs.length, JSON.stringify({ ...fin, errs }));
} finally { await h.close(); }
console.log(bad ? `FAILED: ${bad}` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
