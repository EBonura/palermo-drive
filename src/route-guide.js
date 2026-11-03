// Route guidance: the pink line on the minimap and the big arrow over the lapa (src/missions.js wires it in).
//
// A route is a flat x,z polyline. Missions give it a baked one (guide.path(pts), src/event-routes.js) or just a place (guide.to(x, z), for the
// legs that have no baked route: bringing the food back to the vendor). The guide tracks the car along it (s0 = metres driven, d = metres off it),
// and when the car strays it computes a new way from where it is with the traffic graph (src/traffic-graph.js plan):
//   - destination on a loaded tile: straight to it;
//   - else to the best point of the rest of the baked route that is on loaded tiles (lowest driving time to it plus the time left on the
//     route from there), and on along the baked route from that point. More tiles load as the car goes on; nothing is planned again until it strays again.
// Straying is: far from the route for a while, or moving away from it fast, or driving along it the wrong way. A race passes { fixed: true }:
// its racing line is the route, always. With no road near the car (off road, flying, afloat) the old route stays and the arrow points at it.
//
// The minimap reads mapRoute (array of [x, z]) plus mapRoute.i0 (first vertex ahead of the car), .px/.pz (the car's projection on the route),
// so only the part ahead is drawn, from the car. Nothing here allocates per frame (a reroute allocates its arrays, at most about once a second).

export const GUIDE = {
  OFF_D: 35,        // m from the route that counts as off it ...
  OFF_T: 2,         // ... for this many seconds
  AWAY_D: 18,       // m off the route from which "driving away" is judged
  AWAY_RATE: 0.3,   // share of the speed that has to go into getting farther away (measured every 0.5 s, twice in a row)
  WRONG_T: 2.5,     // s of driving along the route the wrong way (at more than WRONG_V m/s)
  WRONG_V: 7,
  RATE: 1,          // s between searches at the very least
  HOLD: 3,          // s after a new route before the next one
  RETRY: 3,         // s before trying again when there was no road near the car, or no way
  V_REF: 11,        // m/s: what the rest of a baked route is worth in driving time
  STEP: 40,         // m between the candidate join points along the rest of the baked route (its own vertices are candidates too)
  MAXC: 140,        // candidates at most
  REACH: 3500,      // m of the rest of the baked route that are looked at
  AHEAD: 32,        // m ahead of the car the arrow points
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mk = () => ({ pts: null, cum: null, len: 0, cursor: 0, s0: 0, d: 0, px: 0, pz: 0, dx: 0, dz: 1 });
const SC = { d: 0, s: 0, i: 0, px: 0, pz: 0, dx: 0, dz: 1 };

function setPts(o, pts) {
  const n = pts.length >> 1, c = new Float64Array(n);
  for (let i = 1; i < n; i++) c[i] = c[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  o.pts = pts; o.cum = c; o.len = c[n - 1]; o.cursor = 0; o.s0 = 0; o.d = 0;
}
// nearest point of segments [i0, i1) of o to (x, z), ignoring those that end before arc length minS; result in SC
function scan(o, x, z, i0, i1, minS) {
  const pts = o.pts, c = o.cum; let bd = 1e18;
  for (let i = i0; i < i1; i++) {
    if (c[i + 1] < minS) continue;
    const ax = pts[i * 2], az = pts[i * 2 + 1], dx = pts[i * 2 + 2] - ax, dz = pts[i * 2 + 3] - az, l2 = dx * dx + dz * dz;
    const u = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0, qx = ax + dx * u, qz = az + dz * u, d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
    if (d2 < bd) { bd = d2; SC.i = i; SC.px = qx; SC.pz = qz; SC.s = c[i] + u * Math.sqrt(l2); const l = Math.sqrt(l2) || 1; SC.dx = dx / l; SC.dz = dz / l; }
  }
  SC.d = Math.sqrt(bd);
}
function scanAround(o, x, z, minS) {
  const n = o.cum.length - 1;
  scan(o, x, z, Math.max(0, o.cursor - 6), Math.min(n, o.cursor + 40), minS);
  if (SC.d > 60) scan(o, x, z, 0, n, minS);
}
// the point at arc length s of o, into out (cursor is only a hint)
function at(o, s, out) {
  const c = o.cum, pts = o.pts; let i = clamp(o.cursor, 0, c.length - 2);
  while (i > 0 && c[i] > s) i--;
  while (i < c.length - 2 && c[i + 1] < s) i++;
  const seg = c[i + 1] - c[i] || 1, u = clamp((s - c[i]) / seg, 0, 1);
  out.x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * u; out.z = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * u;
  return out;
}

export function createGuide({ car, mapRoute, graph }) {   // graph: () => traffic.graph (or nothing: then the route is never recalculated)
  const R = mk(), B = mk();            // R: the route followed now; B: the baked route it came from (null for guide.to)
  let mode = 0, fixed = false, rIsB = false, dest = null, bS = 0, bMax = 0;
  let clk = 0, hold = 0, nextTry = 0, since = 99, offT = 0, awayN = 0, awayT = 0, lastOff = 0, wrongT = 0;
  const st = { plans: 0, fails: 0, why: '', reason: '', ms: 0, worstMs: 0, expanded: 0, worstExp: 0, cost: 0, kind: '', lastAt: -1 };
  const opt = { max: 5000 }, P = { x: 0, z: 0 }, tg = [], ts = [];   // opt.max: node expansions per search at most (about 1 ms per thousand; the resident graph has about 1400 nodes)

  function fillMap() {
    mapRoute.length = 0;
    const p = R.pts; for (let i = 0; i < p.length; i += 2) mapRoute.push([p[i], p[i + 1]]);
    mapRoute.i0 = 1; mapRoute.px = p[0]; mapRoute.pz = p[1];
  }
  function reset() { offT = awayN = awayT = wrongT = 0; lastOff = 0; since = 0; }
  function off() {
    R.pts = B.pts = null; mode = 0; fixed = false; rIsB = false; dest = null; bS = bMax = 0; nextTry = 0;
    mapRoute.length = 0; mapRoute.i0 = 0; reset();
  }
  function path(pts, o) {
    off();
    if (!pts || pts.length < 4) return;
    setPts(B, pts); R.pts = B.pts; R.cum = B.cum; R.len = B.len; R.cursor = R.s0 = R.d = 0; rIsB = true;
    mode = 1; fixed = !!(o && o.fixed); dest = { x: pts[pts.length - 2], z: pts[pts.length - 1] };
    fillMap(); reset(); hold = clk + 2;
  }
  function to(x, z) {   // no baked route: the way from the car to (x, z), found on the graph (or none yet: the arrow points straight)
    off(); mode = 2; dest = { x, z }; replan('start');
  }

  // ---- the new route
  function install(pts, kind) {
    setPts(R, pts); rIsB = false; fillMap(); reset(); hold = clk + GUIDE.HOLD; st.kind = kind;
    scanAround(R, car.x, car.z, -1); R.s0 = SC.s; R.d = SC.d;
  }
  function candidates(sFrom, g) {   // points of the rest of the baked route on loaded tiles: [x, z, time left from there] into tg, their arc lengths into ts
    tg.length = ts.length = 0;
    const pts = B.pts, c = B.cum, n = c.length, sMax = Math.min(B.len, sFrom + GUIDE.REACH);
    const add = (x, z, s) => { if (tg.length / 3 < GUIDE.MAXC && g.tileLoaded(x, z)) { tg.push(x, z, (B.len - s) / GUIDE.V_REF); ts.push(s); } };
    let i = 0; while (i < n - 2 && c[i + 1] < sFrom) i++;
    let s = sFrom;
    for (; s < sMax; s += GUIDE.STEP) {
      while (i < n - 2 && c[i + 1] < s) i++;
      const seg = c[i + 1] - c[i] || 1, u = clamp((s - c[i]) / seg, 0, 1);
      add(pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * u, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * u, s);
    }
    for (let k = 0; k < n; k++) if (c[k] > sFrom && c[k] < sMax) add(pts[k * 2], pts[k * 2 + 1], c[k]);
    add(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], B.len);
  }
  function replan(why) {
    const g = graph && graph(); since = 0;
    if (!g || !g.plan || car.flying || (car.wet || 0) > 0.3) { nextTry = clk + GUIDE.RETRY; return false; }
    const sp = Math.hypot(car.vx, car.vz), hx = sp > 2.5 ? car.vx / sp : Math.sin(car.th), hz = sp > 2.5 ? car.vz / sp : Math.cos(car.th);
    const t0 = performance.now(); let res = null, kind = '';
    st.reason = why;
    if (dest && g.tileLoaded(dest.x, dest.z)) {   // the destination is here: straight to it
      tg.length = 0; tg.push(dest.x, dest.z, 0); opt.seeds = 12; opt.seedR = 70;   // one target: seed it from many nodes
      res = g.plan(car.x, car.z, hx, hz, tg, opt); kind = 'direct';
      if (res) { const p = res.pts, ex = dest.x - p[p.length - 2], ez = dest.z - p[p.length - 1]; if (ex * ex + ez * ez > 4) p.push(dest.x, dest.z); }
    }
    if (!res && mode === 1) {   // else to the best point of the rest of the baked route that is here, and on along it
      let sFrom = bS; if (!rIsB) { scan(B, car.x, car.z, 0, B.cum.length - 1, bMax - 100); if (SC.d < 60) sFrom = Math.max(bS, SC.s); }
      candidates(sFrom, g);
      if (tg.length) {
        opt.seeds = 3; opt.seedR = 30;
        res = g.plan(car.x, car.z, hx, hz, tg, opt); kind = 'join';
        if (res) {
          const p = res.pts, s = ts[res.ti], c = B.cum, bp = B.pts; let j = 0; while (j < c.length - 1 && c[j] <= s + 0.5) j++;
          for (; j < c.length; j++) p.push(bp[j * 2], bp[j * 2 + 1]);
        }
      }
    }
    const ms = performance.now() - t0, ex = opt.expanded | 0;
    st.ms = ms; if (ms > st.worstMs) st.worstMs = ms; st.expanded = ex; if (ex > st.worstExp) st.worstExp = ex;
    if (!res) { st.fails++; st.why = opt.why || 'none'; nextTry = clk + GUIDE.RETRY; return false; }
    st.plans++; st.cost = res.cost; st.lastAt = clk; st.why = '';
    install(res.pts, kind);
    return true;
  }

  // ---- every frame
  function update(dt) {
    clk += dt; since += dt;
    if (!R.pts) { if (mode === 2 && clk >= nextTry) replan('retry'); return; }
    scanAround(R, car.x, car.z, -1);
    R.cursor = SC.i; R.s0 = SC.s; R.d = SC.d; R.px = SC.px; R.pz = SC.pz; R.dx = SC.dx; R.dz = SC.dz;
    mapRoute.i0 = SC.i + 1; mapRoute.px = SC.px; mapRoute.pz = SC.pz;
    if (B.pts) {   // where the car is on the baked route (kept apart from R: R is a detour after a reroute)
      if (rIsB) { bS = R.s0; B.cursor = R.cursor; if (bS > bMax) bMax = bS; }
      else { scan(B, car.x, car.z, Math.max(0, B.cursor - 6), Math.min(B.cum.length - 1, B.cursor + 40), bMax - 80); if (SC.d < 30) { B.cursor = SC.i; bS = SC.s; if (bS > bMax) bMax = bS; } }
    }
    if (fixed || !graph) return;
    const sp = Math.hypot(car.vx, car.vz), arriving = R.len - R.s0 < 30;
    if (car.flying || (car.wet || 0) > 0.3 || arriving) { offT = awayN = wrongT = 0; return; }
    // 1. far from the route for a while
    if (R.d > GUIDE.OFF_D) offT += dt; else offT = Math.max(0, offT - 2 * dt);
    // 2. moving away from it: how far it is has grown by a good share of the distance driven, in two checks in a row
    awayT += dt;
    if (awayT >= 0.5) {
      const grow = R.d - lastOff; lastOff = R.d;
      if (R.d > GUIDE.AWAY_D && sp > 4 && grow > GUIDE.AWAY_RATE * sp * awayT) awayN++; else awayN = 0;
      awayT = 0;
    }
    // 3. along the route, the wrong way
    if (R.d < GUIDE.AWAY_D && sp > GUIDE.WRONG_V && (car.vx * R.dx + car.vz * R.dz) / sp < -0.5) wrongT += dt; else wrongT = Math.max(0, wrongT - dt);
    const why = offT >= GUIDE.OFF_T ? 'off' : awayN >= 2 ? 'away' : wrongT >= GUIDE.WRONG_T ? 'wrong' : '';
    if (why && clk >= hold && clk >= nextTry && since >= GUIDE.RATE) replan(why);
  }

  // where the arrow points: AHEAD m on from the car's place on the route, less of it the farther off the route the car is (far off: at the route)
  function ahead(dist) {
    if (!R.pts || R.len <= 0) return null;
    return at(R, Math.min(R.len, R.s0 + dist * clamp(1 - (R.d - 25) / 40, 0, 1)), P);
  }
  const state = () => ({ mode, fixed, dest, rIsB, bS, bMax, s0: R.s0, d: R.d, len: R.len, pts: R.pts ? R.pts.length / 2 : 0, mapN: mapRoute.length, i0: mapRoute.i0, offT, awayN, wrongT, hold, clk, ...st });
  return { path, to, off, update, ahead, state, has: () => !!R.pts, replan, route: () => R.pts, base: () => B.pts };
}
