// A hard limit on what one player can ask of the public relays, whatever the cause. The relays are run by volunteers, and a stress test (docs/P2P-MULTIPLAYER.md, "Stress test") showed what a bug in the room choice does:
// thousands of frames a second from a handful of players. So every room join, every presence event and every frame on a relay socket passes through here first, and no bug above this file can get past it.
//   joins      room joins a minute: when they run out, none are made for a while
//   presence   presence events a minute (src/p2p/presence.js), the same
//   fallback   events a minute through the relay fallback (src/p2p/fallback.js): normal use is at most about 3 STATE events a second (one event whatever the number of receivers, FB_MAX of them at most),
//              a hello per armed room every 10 s and the phrases and offers: about 250 a minute at the very most, 110 to 130 measured in a crowd; when they run out nothing more goes through the relays for a while (the direct links are not touched)
//   frames     frames sent on the relay sockets a minute, all of them: past this something is badly wrong, the page stops altogether (src/p2p/p2p.js: rooms left, sockets shut) for a while
// A while: the backoff below, doubled every time a limit is hit again, forgotten after FORGET_MS without a hit. The limits are well above what normal play uses (measured, docs/P2P-MULTIPLAYER.md): reaching one is a bug.
// Clock passed in, so that tools/p2p/guard-check.mjs can run it without a browser.
export const LIMITS = {
  joins: { perMin: 20, backoffMs: 60000 },
  presence: { perMin: 16, backoffMs: 60000 },
  fallback: { perMin: 300, backoffMs: 60000 },
  frames: { perMin: 2000, backoffMs: 120000 },
};
const BACKOFF_MAX = 16;          // at most this many times the first backoff
const FORGET_MS = 1800000;

export function createGuard({ clock, limits = LIMITS, onHit = () => {} }) {
  const st = {};
  for (const k of Object.keys(limits)) st[k] = { t: [], until: 0, mult: 1, lastHit: -1e12, hits: 0, denied: 0 };
  function allow(kind) {
    const s = st[kind], l = limits[kind], now = clock();
    if (now < s.until) { s.denied++; return false; }
    while (s.t.length && now - s.t[0] >= 60000) s.t.shift();
    if (s.t.length >= l.perMin) {
      if (now - s.lastHit > FORGET_MS) s.mult = 1;
      const ms = l.backoffMs * s.mult;
      s.until = now + ms; s.mult = Math.min(BACKOFF_MAX, s.mult * 2); s.lastHit = now; s.hits++; s.denied++; s.t.length = 0;
      onHit(kind, ms);
      return false;
    }
    s.t.push(now);
    return true;
  }
  return { allow, blocked: kind => clock() < st[kind].until, until: kind => st[kind].until, used: kind => { const now = clock(), s = st[kind]; while (s.t.length && now - s.t[0] >= 60000) s.t.shift(); return s.t.length; },
    stats: () => Object.fromEntries(Object.entries(st).map(([k, s]) => [k, { used: s.t.length, hits: s.hits, denied: s.denied }])) };
}
