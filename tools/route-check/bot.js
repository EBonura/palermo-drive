// Page side of tools/route-check/drive.mjs: a scripted driver for the real lapa (real physics, real walls, real streaming). It steers with the keys, as a player does,
// along the line the guide shows NOW (X.guide.route(): so a recalculated line is followed too), and reports when it arrives, when it is blocked and where.
(() => {
  const G = window.game, keys = G.keys, car = G.car, X = () => window.__missions.X;
  let timer = null, S = null;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // nearest point of the flat polyline to (x, z) at or after segment `from`: { i, s (arc length), d }
  function nearest(P, cum, x, z, from) {
    let bd = 1e18, bi = from, bs = 0;
    const hi = Math.min(cum.length - 2, from + 60);
    for (let i = Math.max(0, from - 4); i <= hi; i++) {
      const ax = P[i * 2], az = P[i * 2 + 1], dx = P[i * 2 + 2] - ax, dz = P[i * 2 + 3] - az, l2 = dx * dx + dz * dz, u = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < bd) { bd = d; bi = i; bs = cum[i] + Math.sqrt(l2) * u; }
    }
    return { i: bi, s: bs, d: bd };
  }
  const cumOf = P => { const c = new Float64Array(P.length / 2); for (let i = 1; i < c.length; i++) c[i] = c[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]); return c; };
  function pointAt(P, cum, s) { let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++; const L = cum[i + 1] - cum[i] || 1, u = clamp((s - cum[i]) / L, 0, 1); return [P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * u, P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * u]; }

  // opts: { dest: [x, z], arriveR, maxT (s of game time), vmax }
  function start(opts) {
    stop();
    // no mission may start on the way (a caller who waves, a race grid, a pub: accepting one ends or replaces the line the bot is following)
    const M = window.__missions; for (const k of ['calls', 'races', 'pubs']) if (M[k] && !M[k].__rcOff) { M[k].update = () => null; M[k].__rcOff = true; }
    S = { opts, t: 0, fr: 0, cursor: 0, lastRoute: null, P: null, cum: null, mode: 'drive', modeT: 0, slowT: 0, blockedAt: null, events: [], prog: 0, maxS: 0, done: false, ok: false, why: '', reroutes: 0, plans0: X().guide.state().plans, offMax: 0, offT: 0, dist: 0, lastX: car.x, lastZ: car.z, backs: 0, vmean: 0 };
    timer = setInterval(tick, 33);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false; }
  function finish(ok, why) { S.done = true; S.ok = ok; S.why = why; stop(); }

  function tick() {
    const o = S.opts, dt = 1 / 30; S.t += dt; S.fr++;
    const v = Math.hypot(car.vx, car.vz), fwdV = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    S.dist += Math.hypot(car.x - S.lastX, car.z - S.lastZ); S.lastX = car.x; S.lastZ = car.z; S.vmean += (v - S.vmean) * 0.01;
    const r = X().guide.route();
    if (!r) { keys.ArrowUp = false; if (S.t > 8) return finish(false, 'no route'); return; }
    if (r !== S.lastRoute) { if (S.lastRoute) S.reroutes++; S.lastRoute = r; S.P = r; S.cum = cumOf(r); S.cursor = 0; }
    const near = nearest(S.P, S.cum, car.x, car.z, S.cursor); S.cursor = near.i; S.maxS = Math.max(S.maxS, near.s); S.offMax = Math.max(S.offMax, near.d);
    const dd = Math.hypot(car.x - o.dest[0], car.z - o.dest[1]);
    if (dd < (o.arriveR || 14)) return finish(true, 'arrived');
    if (S.t > o.maxT) return finish(false, 'timeout');
    if (car.wet > 0.3) return finish(false, 'in the water');
    const look = clamp(6 + v * 0.7, 8, 26), tgt = pointAt(S.P, S.cum, near.s + look), far = pointAt(S.P, S.cum, near.s + look + 22);
    const want = Math.atan2(tgt[0] - car.x, tgt[1] - car.z), e = wrap(want - car.th), e2 = wrap(Math.atan2(far[0] - tgt[0], far[1] - tgt[1]) - want);
    const cap = Math.min(o.vmax || 11, clamp(11 - Math.abs(e2) * 7, 3.5, 11), near.d > 12 ? 5 : 99);
    const duty = Math.min(1, Math.abs(e) / 0.3), pulse = (S.fr % 4) < duty * 4 + 0.001 && duty > 0.05, dir = Math.sign(e);
    // blocked: pushing but not moving
    if (S.mode === 'drive') {
      if (v < 0.8) S.slowT += dt; else S.slowT = 0;
      if (S.slowT > 2.5) { S.mode = 'rev'; S.modeT = 0; S.backs++; if (!S.blockedAt) { S.blockedAt = [Math.round(car.x), Math.round(car.z), Math.round(near.s)]; } S.events.push(['blocked', Math.round(S.t), Math.round(car.x), Math.round(car.z)]); if (S.backs > 3) return finish(false, 'blocked'); }
      keys.ArrowLeft = pulse && dir > 0; keys.ArrowRight = pulse && dir < 0;
      // a turn of more than 100 degrees: roll forward slowly while steering (the bot does not do three point turns, it reverses out if that fails)
      keys.ArrowUp = fwdV < cap * 0.98; keys.ArrowDown = fwdV > cap * 1.2 && v > 3;
    } else {   // reverse for 1.6 s with the steering opposed, then forward again
      S.modeT += dt; keys.ArrowUp = false; keys.ArrowDown = true; keys.ArrowLeft = dir < 0; keys.ArrowRight = dir > 0;
      if (S.modeT > 1.6) { S.mode = 'drive'; S.slowT = 0; }
    }
    if (near.d > 40) S.offT += dt; else S.offT = Math.max(0, S.offT - dt);
    if (S.offT > 25) return finish(false, 'lost the line');
  }
  const status = () => S && { t: +S.t.toFixed(1), done: S.done, ok: S.ok, why: S.why, x: Math.round(car.x), z: Math.round(car.z), s: Math.round(S.maxS), len: S.cum ? Math.round(S.cum[S.cum.length - 1]) : 0, blockedAt: S.blockedAt, events: S.events.slice(0, 12), reroutes: S.reroutes, plans: X().guide.state().plans - S.plans0, offMax: Math.round(S.offMax), dist: Math.round(S.dist), vmean: +S.vmean.toFixed(1), backs: S.backs };
  window.__bot = { start, stop, status };
})();
