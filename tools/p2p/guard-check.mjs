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
process.exit(bad ? 1 : 0);
