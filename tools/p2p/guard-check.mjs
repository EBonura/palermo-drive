// The safety limit on its own (src/p2p/guard.js), with a clock of its own: no browser, no relay. How the page behaves when it trips is tested with a planted bug: tools/p2p/stress.mjs --patch (docs/P2P-MULTIPLAYER.md, "Stress test").
//   node tools/p2p/guard-check.mjs
import { createGuard, LIMITS } from '../../src/p2p/guard.js';
let bad = 0; const ok = (label, v, extra = '') => { console.log(label.padEnd(72), v ? 'OK  ' : 'FAIL', extra); if (!v) bad++; };
let t = 0; const hits = [], g = createGuard({ clock: () => t, onHit: (k, ms) => hits.push([k, ms]) });
const hammer = (kind, secs, perS) => { let through = 0; for (let i = 0; i < secs * perS; i++) { t += 1000 / perS; if (g.allow(kind)) through++; } return through; };

// a bug that asks for a room join ten times a second, for an hour: what gets through
const th = hammer('joins', 3600, 10), once = LIMITS.joins.perMin;
ok(`joins: the first minute lets through the limit and no more`, hits.length && hits[0][0] === 'joins' && hits[0][1] === LIMITS.joins.backoffMs);
ok(`joins: an hour at 10 a second, ${36000} asked, far fewer pass`, th <= once * 8, `${th} passed, limit hit ${hits.length} times, ${hits.map(h => h[1] / 1000).join(' ')} s`);
ok('joins: the backoff doubles and stops growing', hits[1][1] === hits[0][1] * 2 && Math.max(...hits.map(h => h[1])) === LIMITS.joins.backoffMs * 16);

// normal use never reaches it: a room join every 4 s
t = 0; const g2 = createGuard({ clock: () => t }); let denied = 0; for (let i = 0; i < 900; i++) { t += 4000; if (!g2.allow('joins')) denied++; }
ok('joins: one every 4 s for an hour is never refused', !denied && g2.stats().joins.hits === 0);

// it is forgotten after a calm half hour
t = 0; const h2 = [], g3 = createGuard({ clock: () => t, onHit: (k, ms) => h2.push(ms) });
for (let i = 0; i < 20000; i++) { t += 5; g3.allow('frames'); }
t += 3600000; for (let i = 0; i < 20000; i++) { t += 5; g3.allow('frames'); }
ok('frames: after a calm half hour the backoff starts again from the first', h2[h2.length - 1] === LIMITS.frames.backoffMs, h2.join(' '));
// the relay fallback (src/p2p/fallback.js): a bug that sends an event every frame (60 a second) for ten minutes, and normal use (a STATE event about every 0.35 s, a hello every 10 s in each of 6 rooms, a phrase every 1.5 s)
t = 0; const hf = [], gf = createGuard({ clock: () => t, onHit: (k, ms) => hf.push(ms) }); let fbThrough = 0;
for (let i = 0; i < 600 * 60; i++) { t += 1000 / 60; if (gf.allow('fallback')) fbThrough++; }
ok(`fallback: ten minutes at 60 events a second, ${600 * 60} asked, at most ${LIMITS.fallback.perMin * 4} pass`, fbThrough <= LIMITS.fallback.perMin * 4, `${fbThrough} passed (${(fbThrough / 600).toFixed(2)} a second), limit hit ${hf.length} times`);
t = 0; const gn = createGuard({ clock: () => t }); let fbDenied = 0, nextHello = 0, nextSay = 0;
for (let ms = 0; ms < 3600000; ms += 350) { t = ms; if (!gn.allow('fallback')) fbDenied++; if (ms >= nextHello) { nextHello += 10000; for (let r = 0; r < 6; r++) if (!gn.allow('fallback')) fbDenied++; } if (ms >= nextSay) { nextSay += 1500; if (!gn.allow('fallback')) fbDenied++; } }
ok('fallback: an hour of the most normal use can ask for is never refused', !fbDenied && gn.stats().fallback.hits === 0, `denied ${fbDenied}`);
process.exit(bad ? 1 : 0);
