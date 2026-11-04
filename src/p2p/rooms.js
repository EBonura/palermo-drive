// Which rooms to be in, given who is online (src/p2p/presence.js) and who we are really connected to. No sockets and no clock of its own, so that tools/p2p/rooms-sim.mjs can run it without a browser.
//
// The limit is a number of players, not a distance: MAXP other players at most, the closest ones, wherever they are in the city. A Trystero room connects you to everyone in it, so a room is all or nothing.
// A cell can hold a crowd, so a cell is cut into shards (rooms "cell", "cell:1", "cell:2"...): the lowest shard with fewer than MAXP others is the one a player takes as their home room, so no room ever has more
// than MAXP + 1 members. When several players take the same shard at the same moment and it overfills, the visitors go at once, the members sort themselves by id, the first MAXP + 1 stay and the rest move to the
// next shard, with no talking needed.
//
// What keeps this settled: everybody's choice changes what everybody else sees, and what they see is up to MOVE_GAP_MS old (src/p2p/presence.js), so a choice remade from scratch twice a second never comes to rest.
// So joining and leaving follow different rules:
//   - Joining goes by the list: one room at a time from the closest outward, and only a room that brings somebody new who fits (each person counted once, however many rooms they are in).
//   - Leaving goes by the real connections, not by the list: a room stays until it is no use (nobody in it, or everybody in it is also in a lower room of ours, the lowest shared room being the one both ends keep,
//     or they are all past the cap), until a clearly closer room takes its place, or until there are really too many connections. A room left is not joined again for a while, longer each time.
// So a pair that is connected stays connected, and whatever a list says, the rooms come to rest.
const KEEP_M = 150;               // a new room has to be this much closer than the farthest one held to push it out, so two rooms at about the same distance do not swap places all the time
const SETTLE_MS = 8000;           // a room is not left by the selection until it has been joined this long (the presence of the others lags a few seconds)
const DECOY_MS = 25000, BAN_MS = 120000;   // a room that presence says is occupied but where nobody has turned up after DECOY_MS is left alone for BAN_MS
const HOME_HOLD_MS = 20000, HOME_JUMP_M = 1000;   // the home room moves to the car's cell no more often than this, unless the car is this far from it (a teleport): fast driving is not a room join every 10 s
const VISIT_GAP_MS = 4000;        // least time between two rooms joined (half as much again at random)
const SWAP_GAP_MS = 20000, SWAP_GAP_MAX_MS = 160000;   // least time between two swaps for a closer room: doubled each time, back to the start once the car has moved a cell
const COOL_MS = 30000, COOL_MAX_MS = 480000, COOL_RESET_MS = 900000;   // a room left is not visited for COOL_MS, doubled each time it is left again, forgotten after COOL_RESET_MS
const LONE_MS = 10000, GIVE_GAP_MS = 60000;   // how long a player has to be alone before a full room gives them company; the least time between two times one player does that
const SILENT_MS = 30000;          // a player connected to us who has sent nothing for this long has stopped holding us (or is paused): a room kept for them alone is no use
const OVER_MS = 10000, OVER_HOME_MS = 2000;   // more than MAXP + 2 connected for this long makes the farthest room go; how long a full home room waits for its visitors to go
export const MAX_LISTED = 6;      // the most rooms a player is in, and lists (MAX_ROOMS in src/p2p/presence.js)

export function createChooser({ maxp, cell, hyst, key, selfId, random = Math.random }) {
  const rectDist = (x, z, i, j) => Math.hypot(Math.max(i * cell - x, 0, x - (i + 1) * cell), Math.max(j * cell - z, 0, z - (j + 1) * cell));
  const banned = new Map(), cool = new Map();   // room key -> until; room key -> { until, ms, at }
  let home = null, homeT = -1e9, nextVisit = 0, nextSwap = 0, loneSince = 0, overSince = 0, overHome = 0, nextGive = 0, swapGap = SWAP_GAP_MS, swapX = 0, swapZ = 0;
  const ok = (k, now) => (banned.get(k) || 0) <= now;
  const rested = (k, now) => { const c = cool.get(k); return !c || c.until <= now; };
  function rest(k, now) {
    let c = cool.get(k); if (c && now - c.at > COOL_RESET_MS) c = null;
    const ms = c ? Math.min(COOL_MAX_MS, c.ms * 2) : COOL_MS;
    cool.set(k, { until: now + ms, ms, at: now });
    if (cool.size > 200) for (const [q, v] of cool) if (now - v.at > COOL_RESET_MS) cool.delete(q);
  }

  // One pass: what to leave and what to join. x, z: the car; list: presence.list(); rooms, peers: the real ones of src/p2p/p2p.js (only read).
  function step(now, x, z, list, rooms, peers) {
    const out = { leave: [], join: [] }, gone = new Set();
    const leave = (r, why, ban) => { out.leave.push({ r, why }); gone.add(r.key); rest(r.key, now); if (ban) banned.set(r.key, now + BAN_MS); };
    // who is where, by room: the others that list the room, each with how far their home is
    const gs = new Map(), byId = new Map();
    const room = (i, j, s) => { const k = key(i, j, s); let g = gs.get(k); if (!g) gs.set(k, g = { key: k, i, j, s, who: new Set(), d: Infinity }); return g; };
    for (const e of list) {
      const d = rectDist(x, z, e.rooms[0][0], e.rooms[0][1]); byId.set(e.id, { e, d });
      for (const [i, j, s] of e.rooms) { const g = room(i, j, s); g.who.add(e.id); if (d < g.d) g.d = d; }
    }
    const occ = k => { const g = gs.get(k), r = rooms.get(k); return Math.max(g ? g.who.size : 0, r ? r.peers.size : 0); };
    const linked = new Set(); for (const r of rooms.values()) for (const id of r.peers) linked.add(id);

    // ---------- the home room ----------
    const dHome = home ? rectDist(x, z, home.i, home.j) : 0;
    if (!home || !ok(home.key, now) || (dHome > hyst && (now - homeT > HOME_HOLD_MS || dHome > HOME_JUMP_M))) {
      const i = Math.floor(x / cell), j = Math.floor(z / cell);
      let s = 0; for (; s < 60; s++) { const k = key(i, j, s); if (ok(k, now) && (rooms.has(k) || occ(k) <= maxp)) break; }
      home = { i, j, s, key: key(i, j, s) }; homeT = now; loneSince = 0;
    } else if (now - homeT > SETTLE_MS) {
      const mine = gs.get(home.key), hr = rooms.get(home.key);
      // two shards of a cell that fit into one become one: everybody in the higher one sees the same thing and moves down, and nobody is left behind
      for (let s = 0; s < home.s; s++) {
        const k = key(home.i, home.j, s), g = gs.get(k); if (!ok(k, now)) continue;
        const all = new Set(g ? g.who : []); if (mine) for (const w of mine.who) all.add(w);
        if (Math.max(all.size, occ(k)) <= maxp) { home = { i: home.i, j: home.j, s, key: k }; homeT = now; loneSince = 0; break; }
      }
      // somebody alone in the city with nothing that fits them, and our room is full: the last of us by id gives up its place and goes to keep them company (the next pass finds it a shard; a visit reaches them if they are not in the same cell). 9 and 1 become 8 and 2, which the rule above leaves alone
      const residents = list.filter(e => key(...e.rooms[0]) === home.key).length;   // a room of visitors is not a crowd: a visitor who wants to leave can
      const lonely = hr && hr.peers.size >= maxp && residents >= maxp && now > nextGive && list.some(e => { const k = key(...e.rooms[0]); return e.rooms.length === 1 && k !== home.key && gs.get(k).who.size === 1; }) && [selfId, ...hr.peers].sort().pop() === selfId;
      if (!lonely) loneSince = 0; else if (!loneSince) loneSince = now;
      else if (now - loneSince > LONE_MS) { leave(hr, 'gave', true); home = null; loneSince = 0; nextGive = now + GIVE_GAP_MS; }
    }

    // ---------- leaving: by the real connections ----------
    const sharedLower = (id, r) => { for (const q of rooms.values()) if (q.key < r.key && q.peers.has(id)) return true; return false; };
    const covered = r => { for (const q of rooms.values()) if (q !== r && !gone.has(q.key) && (q.peers.size > r.peers.size || q.key < r.key) && [...r.peers].every(id => q.peers.has(id))) return true; return false; };   // a bigger room holds everybody in this one, as everybody in it can see
    const idle = id => { const p = peers.get(id); return !!p && (p.held === false || now - Math.max(p.lastRx || 0, p.since || 0) > SILENT_MS); };
    const only = r => [...r.peers].filter(id => { for (const q of rooms.values()) if (q !== r && q.peers.has(id)) return false; return true; });   // the players this room alone connects us to
    const realD = id => { const p = peers.get(id); return p && Number.isFinite(p.x) ? Math.hypot(p.x - x, p.z - z) : Infinity; };
    const farness = r => { const d = only(r).map(realD).filter(Number.isFinite); return d.length ? Math.min(...d) : rectDist(x, z, r.i, r.j); };   // how far the room's players really are, not where the room's cell is
    for (const r of rooms.values()) {
      if (gone.has(r.key)) continue;
      const isHome = home && r.key === home.key, age = now - r.t0;
      if (isHome) { if (r.peers.size <= maxp) overHome = 0; else if (!overHome) overHome = now; }
      if (r.peers.size > maxp && age > 6000) {   // overfull: a visitor goes at once; of those who live here, a moment later (the visitors may be enough), those not among the first MAXP + 1 ids
        if (!isHome) { leave(r, 'overfull', true); continue; }
        if (now - overHome > OVER_HOME_MS && [selfId, ...r.peers].sort().indexOf(selfId) > maxp) { leave(r, 'overfull', true); home = null; overHome = 0; continue; }
      }
      if (isHome || age <= SETTLE_MS) continue;
      if (!r.peers.size) {
        if (!occ(r.key)) leave(r, 'empty');
        else if (age > DECOY_MS) leave(r, 'decoy', true);   // somebody said they were there, nobody is
        continue;
      }
      if (covered(r) || [...r.peers].every(id => sharedLower(id, r) || idle(id))) leave(r, 'spare');   // all of them are in a room of ours that stays (a lower one is lower for them as well, so it is the one both ends keep), past the cap, or no longer talking to us
    }
    // the other cap: whatever the rooms add up to, more than MAXP + 2 players connected for a while means the farthest settled room goes
    if (linked.size > maxp + 2) { if (!overSince) overSince = now; } else overSince = 0;
    if (home && overSince && now - overSince > OVER_MS) {
      const far = [...rooms.values()].filter(r => r.key !== home.key && !gone.has(r.key) && now - r.t0 > SETTLE_MS).sort((a, b) => farness(b) - farness(a))[0];
      if (far) { leave(far, 'overcap'); overSince = now; }
    }
    if (!home) return out;   // out of a full room (above): the next pass chooses the next shard, with the room just left banned

    // ---------- joining: by the list, one room at a time ----------
    const left = k => rooms.has(k) && !gone.has(k);
    if (!left(home.key)) out.join.push({ key: home.key, i: home.i, j: home.j, s: home.s });
    const size = [...rooms.keys()].filter(left).length + out.join.length;
    if (now < nextVisit) return out;
    // the players held, counted once each: those really connected, plus those the list says are in a room just joined and have not connected yet
    const heldWho = new Set(), settledWho = new Set(), freshPeers = new Set();
    for (const r of rooms.values()) { if (gone.has(r.key)) continue; const g = gs.get(r.key), settled = now - r.t0 > SETTLE_MS; if (g) for (const w of g.who) { heldWho.add(w); if (settled) settledWho.add(w); } }
    const g0 = gs.get(home.key); if (g0) for (const w of g0.who) heldWho.add(w);
    for (const r of rooms.values()) if (now - r.t0 <= SETTLE_MS) for (const id of r.peers) { let elsewhere = false; for (const q of rooms.values()) if (q !== r && now - q.t0 > SETTLE_MS && q.peers.has(id)) elsewhere = true; if (!elsewhere) freshPeers.add(id); }
    let waiting = 0; for (const w of heldWho) if (!settledWho.has(w)) waiting++;
    const held = linked.size + Math.max(0, waiting - freshPeers.size);
    // would this player keep us? They have a free place, as far as the list can tell, or somebody farther from them than we are, who they would drop for us. Otherwise a visit only pushes them over their cap and it all comes back as more leaving
    const keeps = id => {
      const v = byId.get(id), all = new Set(); if (!v) return true;
      for (const [i, j, s] of v.e.rooms) { const g = gs.get(key(i, j, s)); if (g) for (const w of g.who) all.add(w); } all.delete(id);
      if (all.size < (linked.size ? maxp : maxp + 1)) return true;
      const [i, j] = v.e.rooms[0], dMe = Math.hypot(x - (i + 0.5) * cell, z - (j + 0.5) * cell);
      for (const w of all) { const o = byId.get(w); if (o && Math.hypot(o.e.rooms[0][0] - i, o.e.rooms[0][1] - j) * cell > dMe + KEEP_M) return true; }
      return false;
    };
    // the closest MAXP by where their home is: a room that brings somebody else as well comes after one at the same distance that does not
    const ids = [...byId.entries()].sort((a, b) => a[1].d - b[1].d || (a[0] < b[0] ? -1 : 1)).slice(0, maxp).map(a => a[0]), closest = new Set(ids);
    const cand = [];
    for (const g of gs.values()) {
      if (left(g.key) || gone.has(g.key) || (g.i === home.i && g.j === home.j) || !ok(g.key, now) || !rested(g.key, now) || g.who.size > maxp) continue;
      const fresh = [...g.who].filter(w => !heldWho.has(w)); if (!fresh.length) continue;   // nobody new in it: it would only cost the relays
      cand.push({ g, fresh: fresh.length, taken: fresh.some(w => !keeps(w)), worst: Math.max(...fresh.map(w => byId.get(w).d)), extra: fresh.filter(w => !closest.has(w)).length });
    }
    cand.sort((a, b) => a.g.d - b.g.d || a.extra - b.extra || b.fresh - a.fresh || (a.g.key < b.g.key ? -1 : 1));
    const visit = c => { out.join.push({ key: c.g.key, i: c.g.i, j: c.g.j, s: c.g.s }); nextVisit = now + VISIT_GAP_MS * (1 + random() * 0.5); };
    const fit = cand.find(c => !c.taken && held + c.fresh <= maxp);
    if (fit && size < MAX_LISTED) { visit(fit); return out; }
    // nothing fits: a room clearly closer than the farthest player held can take their place
    if (Math.hypot(x - swapX, z - swapZ) > cell) { swapGap = SWAP_GAP_MS; nextSwap = Math.min(nextSwap, now + SWAP_GAP_MS); }
    if (now < nextSwap) return out;
    const swapped = () => { nextSwap = now + swapGap * (1 + random() * 0.5); swapGap = Math.min(SWAP_GAP_MAX_MS, swapGap * 2); swapX = x; swapZ = z; };
    const far = [...rooms.values()].filter(r => r.key !== home.key && !gone.has(r.key) && now - r.t0 > SETTLE_MS).map(r => ({ r, d: farness(r), n: only(r).length })).sort((a, b) => b.d - a.d)[0];
    const swap = far && cand.find(c => !c.taken && c.worst + KEEP_M < far.d && held - far.n + c.fresh <= maxp);
    if (swap) { leave(far.r, 'swap'); visit(swap); swapped(); return out; }
    // we are only in our home room, so the farthest player held is a visitor who cannot be asked to go: visit the closer room all the same. rank() (src/p2p/p2p.js) stops sending to that visitor, who hears nothing and goes (above)
    if (far) return out;
    const farPeer = Math.max(...[...linked].map(realD).filter(Number.isFinite), -Infinity);
    const over = linked.size <= maxp + 1 && size < MAX_LISTED && cand.find(c => !c.taken && c.fresh === 1 && c.worst + KEEP_M < farPeer);
    if (over) { visit(over); swapped(); }
    return out;
  }
  return { step, banned, get home() { return home; }, reset() { home = null; loneSince = 0; overSince = 0; }, clear() { banned.clear(); cool.clear(); nextVisit = nextSwap = 0; } };
}
