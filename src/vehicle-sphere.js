// Sphere driving model (?physics=sphere), the arcade-taxi alternative to the bicycle model in src/vehicle.js.
// Owned by the driving work. vehicle.js keeps inputs, engine, gears, nitro, drift state and the visual pose; this file replaces the
// yaw, grip, movement and collision part of physics(dt) and the ground-following of the body.
//
// The vehicle is one invisible rolling ball. car.x/z/vx/vz are the ball: throttle pushes it along the heading (vehicle.js does that), the
// ball is never turned by the road, only by grip. The heading (car.th) is steered on its own from the input and the speed, like a
// kinematic car, and the ball's sideways speed is then eaten by a grip rate: a high rate is a car on rails, a low rate (handbrake,
// brake-tap, big slide) lets the ball drift sideways before the tyres catch up, so the slip angle is simply yaw rate / grip rate.
// Walls only see the ball (two probe circles for the footprint, no yaw impulse, small bounce): the nose is swung along the wall instead
// of snagging on it. The ball rolls on a smoothed surface (ground averaged over the footprint plus a kerb ramp), so kerbs, tile edges
// and bumps become a soft rise of the body, never a stop. Steep ground acts like a wall (a slope limit) and the body is tilted to the
// slope under its axles. The rest of the game still reads and writes the same car fields (x, z, vx, vz, th, w, vf, lift, ...).
const PI = Math.PI;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrap = a => a - 2 * PI * Math.floor((a + PI) / (2 * PI));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Per vehicle: kGrip / kSlide = sideways grip rate (1/s) normally and while drifting, wDrift = yaw rate a full steer asks for in a drift
// (rad/s), hbKick = yaw flick when the handbrake goes on, keep / keepD = share of the removed sideways speed that turns into forward speed
// (cornering without losing speed / losing it while drifting), e = wall bounce, mu = wall scrape, resp = how fast the heading follows
// the wish (heavy = slow), align = pull of the nose back to the travel direction, bumpK = how much the body jolts on bumps (mass),
// slopeMax = steepest climb (rise per metre) before the ground acts as a wall.
const BASE = { kGrip: 10, kSlide: 1.6, wDrift: 1.6, hbKick: 1.0, keep: 0.85, keepD: 0.8, e: 0.14, mu: 0.1, resp: 11, align: 0.9, bumpK: 1, slopeMax: 0.8, wMul: 1 };
const TUNE = {
  calessino: {},
  cassone: { kGrip: 8.5, kSlide: 1.6, wDrift: 1.45, hbKick: 0.7, e: 0.1, resp: 8.5, bumpK: 1.4, wMul: 1, slopeMax: 0.75 },
  lapa50: { kGrip: 10.5, kSlide: 2.1, wDrift: 1.6, hbKick: 1.0, e: 0.18, resp: 12.5, bumpK: 0.8, slopeMax: 0.7 },
  vespa: { kGrip: 11, kSlide: 2.3, wDrift: 1.8, hbKick: 1.0, e: 0.22, mu: 0.14, resp: 15, align: 1.1, bumpK: 0.6, slopeMax: 0.85 },
  scooterone: { kGrip: 11, kSlide: 2.1, wDrift: 1.65, hbKick: 0.9, e: 0.2, mu: 0.14, resp: 14, bumpK: 0.55, slopeMax: 0.85 },
  motorino: { kGrip: 11.5, kSlide: 2.5, wDrift: 1.95, hbKick: 1.2, e: 0.22, mu: 0.14, resp: 16, align: 1.2, bumpK: 0.5, slopeMax: 0.9 },
  sulky: { kGrip: 6.5, kSlide: 2.5, wDrift: 1.0, hbKick: 0.3, e: 0.12, resp: 8, align: 1.2, bumpK: 0.9, wMul: 1.0 },
  tascia: { kGrip: 14, kSlide: 2.4, wDrift: 1.3, hbKick: 0.85, keep: 0.9, e: 0.1, mu: 0.08, resp: 13, bumpK: 0.7, slopeMax: 0.85, wMul: 1 },
};

export function createSphere({ car, T, walls2d, closestOnSeg, raisedMask, CURB, groundY, hooks, onHit }) {
  let P = { ...BASE };
  const S = { y: 0, vy: 0, vb: 0, ready: false, px: 0, pz: 0, kerb: 0, slopeF: 0, side: 0, grad: 0, hbPrev: false, hit: 0 };

  function tune(type) { P = { ...BASE, ...(TUNE[type] || {}) }; }
  function reset() { S.ready = false; S.vy = S.vb = 0; }

  // ---------- the surface the ball rolls on ----------
  // ground averaged along the heading (a tile edge or a lidar step becomes a short ramp) and a kerb ramp from the raised-ground mask
  function surface(dt, sn, cs) {
    const x = car.x, z = car.z;
    const g = (groundY(x, z) * 2 + groundY(x + sn * 0.6, z + cs * 0.6) + groundY(x - sn * 0.6, z - cs * 0.6)) * 0.25;
    const r = 0.5, lx = cs, lz = -sn;
    const n = (raisedMask(x, z) ? 1 : 0) + (raisedMask(x + sn * r, z + cs * r) ? 1 : 0) + (raisedMask(x - sn * r, z - cs * r) ? 1 : 0) + (raisedMask(x + lx * r, z + lz * r) ? 1 : 0) + (raisedMask(x - lx * r, z - lz * r) ? 1 : 0);
    const kt = CURB * sstep(0, 1, n / 5);
    S.kerb += (kt - S.kerb) * Math.min(1, 12 * dt);
    return g + S.kerb;
  }
  // slope under the axles (kerbs included, for the tilt of the body) and the real ground gradient (for the slope limit)
  const surf = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  function tilt(sn, cs) {
    const lx = cs, lz = -sn, x = car.x, z = car.z;
    const fA = 1.2, sA = 0.8;
    S.slopeF = (surf(x + sn * fA, z + cs * fA) - surf(x - sn * fA, z - cs * fA)) / (2 * fA);
    S.side = (surf(x + lx * sA, z + lz * sA) - surf(x - lx * sA, z - lz * sA)) / (2 * sA);
    const gf = (groundY(x + sn * fA, z + cs * fA) - groundY(x - sn * fA, z - cs * fA)) / (2 * fA);
    const gs = (groundY(x + lx * sA, z + lz * sA) - groundY(x - lx * sA, z - lz * sA)) / (2 * sA);
    return [gf, gs];
  }

  // ---------- the ball against the walls ----------
  // Two probe circles under the footprint (as the bicycle model has), but the response only moves the ball: its sideways bounce is small
  // and the scrape cheap, and the nose is swung to run along the wall, so a glancing hit keeps most of the speed and a head-on hit stops.
  function collide() {
    const sn = Math.sin(car.th), cs = Math.cos(car.th);
    let touched = false;
    for (const sgn of [1, -1]) {
      const a = T.AXLE * sgn, cx = car.x + sn * a, cz = car.z + cs * a;
      let px = 0, pz = 0;
      walls2d.query(cx - T.R, cz - T.R, cx + T.R, cz + T.R, s => {
        const [qx, qz] = closestOnSeg(cx + px, cz + pz, s);
        const dx = cx + px - qx, dz = cz + pz - qz, d = Math.hypot(dx, dz);
        if (d >= T.R) return;
        let nx, nz;
        if (d > 1e-4) { nx = dx / d; nz = dz / d; }
        else { const ex = s[2] - s[0], ez = s[3] - s[1], el = Math.hypot(ex, ez) || 1; nx = -ez / el; nz = ex / el; }
        px += nx * (T.R - d); pz += nz * (T.R - d);
        touched = true;
        const vn = car.vx * nx + car.vz * nz;
        if (vn >= 0) return;
        const j = -(1 + P.e) * vn;
        car.vx += j * nx; car.vz += j * nz;
        let tx = -nz, tz = nx;
        if (tx * car.vx + tz * car.vz < 0) { tx = -tx; tz = -tz; }   // along the wall, the way we are going
        const vt = car.vx * tx + car.vz * tz, jt = Math.min(vt, P.mu * j);
        car.vx -= jt * tx; car.vz -= jt * tz;
        // swing the nose along the wall (not for a near head-on hit, which just stops)
        const fwd = car.vx * sn + car.vz * cs >= 0, want = Math.atan2(tx, tz) + (fwd ? 0 : PI), eps = wrap(want - car.th);
        if (Math.abs(eps) < 1.25) car.th += eps * 0.2 * sstep(1.25, 0.35, Math.abs(eps));
        if (-vn > S.hit) S.hit = -vn;
      });
      car.x += px; car.z += pz;
    }
    const [x0, z0, x1, z1] = hooks.bounds;
    if (car.x < x0 || car.x > x1) { car.x = clamp(car.x, x0, x1); car.vx = 0; }
    if (car.z < z0 || car.z > z1) { car.z = clamp(car.z, z0, z1); car.vz = 0; }
    return touched;
  }

  // ---------- one step ----------
  // I: { hb, d (drift 0..1), against }. Called after vehicle.js has applied the engine and the brakes to the ball.
  function step(dt, I) {
    const { hb, d } = I;
    let sn = Math.sin(car.th), cs = Math.cos(car.th);
    let vf = car.vx * sn + car.vz * cs, vl = car.vx * cs - car.vz * sn;
    const v1 = Math.hypot(vf, vl);

    // ----- steering: the heading follows the input, not the ball -----
    const delta = T.lock / (1 + (v1 / T.lockV) ** 2);
    const wCap = T.aGrip * 0.95 * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss) / Math.max(Math.abs(vf), 3);
    const wN = clamp(vf * Math.tan(delta * car.sIn) / T.L * P.wMul, -wCap, wCap) * (1 - 0.5 * car.wheelie / (T.wheelie || 1));
    let wT = wN;
    if (d > 0.01) {
      // drift: the steer asks for a yaw rate (not tied to speed); the nose is pulled back to the travel direction, more when hands-off
      const k = sstep(2, 7, v1) * (vf > 0 ? 1 : 0) * (1 + 0.9 * sstep(T.lockV * 0.9, T.lockV * 0.3, v1));   // a bit more yaw at lower speed, so a brake-tap still gets round a hairpin
      const wD = clamp(car.sIn * P.wDrift * k - P.align * car.slip * (I.against || car.sIn === 0 ? 1.6 : 0.6), -2.8, 2.8);
      wT = wN + (wD - wN) * d;
      if (hb && !S.hbPrev && car.sIn !== 0 && vf > T.driftV) car.w += Math.sign(car.sIn) * P.hbKick;   // handbrake flick: the tail swings out
    }
    S.hbPrev = hb;
    car.w += (wT - car.w) * Math.min(1, P.resp * dt * (d > 0.5 ? 0.85 : 1));
    car.th += car.w * dt;
    car.steer += (clamp(car.sIn * 0.5 - car.slip * 0.8 * d, -0.62, 0.62) - car.steer) * Math.min(1, 12 * dt);

    // ----- grip: the ball's sideways speed is eaten by a rate, capped by the tyre force -----
    sn = Math.sin(car.th); cs = Math.cos(car.th);
    vf = car.vx * sn + car.vz * cs; vl = car.vx * cs - car.vz * sn;
    {
      const kG = P.kGrip + (P.kSlide - P.kGrip) * d;
      const aCap = (T.aGrip + (T.aDrift - T.aGrip) * d) * (1 - T.tipGrip * car.tip) * (1 - 0.75 * car.gripLoss);
      const dv = Math.min(Math.abs(vl), Math.min(Math.abs(vl) * kG, aCap) * dt);
      if (dv > 0) {
        const keep = P.keep + (P.keepD - P.keep) * d, vl0 = Math.abs(vl);
        vl -= Math.sign(vl) * dv;
        // the removed sideways speed turns into forward speed (the velocity swings round instead of shrinking), so a corner at the grip limit does not bleed speed
        vf += Math.sign(vf || 1) * Math.min(keep * dv * vl0 / Math.max(Math.abs(vf), 1.5), dv);
        const hv0 = Math.hypot(vf, vl), sp = T.scrubDrift * d + 0.6 * T.scrubSlip * (hv0 > 0.5 ? Math.abs(vl) / hv0 : 0), hv = Math.hypot(vf, vl), m = hv > 0 ? Math.max(0, hv - sp * dt) / hv : 1;
        vf *= m; vl *= m;
        car.vx = sn * vf + cs * vl; car.vz = cs * vf - sn * vl;
      }
    }

    // ----- steep ground acts as a wall: the climb is cut and the ball is pushed back down -----
    const [gf, gs] = tilt(sn, cs);
    const gx = gf * sn + gs * cs, gz = gf * cs - gs * sn, m = Math.hypot(gx, gz);
    S.grad = m;
    if (m > P.slopeMax) {
      const ux = gx / m, uz = gz / m, ex = m - P.slopeMax, up = car.vx * ux + car.vz * uz;
      car.vx -= ux * 9.81 * Math.min(ex * 3, 1.5) * dt; car.vz -= uz * 9.81 * Math.min(ex * 3, 1.5) * dt;
      if (up > 0) { const k = Math.min(1, 14 * dt * clamp(ex / 0.15, 0, 1)); car.vx -= ux * up * k; car.vz -= uz * up * k; }
    }

    // ----- move in sub-steps of at most 0.35 m, then collide -----
    const v = Math.hypot(car.vx, car.vz), n = Math.min(10, Math.ceil(v * dt / 0.35)), sdt = dt / n;
    let touched = false;
    for (let i = 0; i < n; i++) {
      car.x += car.vx * sdt; car.z += car.vz * sdt;
      if (collide()) touched = true;
    }
    car.scrape = touched ? Math.hypot(car.vx, car.vz) : 0;
    sn = Math.sin(car.th); cs = Math.cos(car.th);

    // ----- height: the ball sticks to the surface; a seam in the data (a tile edge) or a kerb becomes a quick ramp, never a pop -----
    const h = surface(dt, sn, cs);
    if (!S.ready || Math.abs(h - S.y) > 4 || Math.hypot(car.x - S.px, car.z - S.pz) > 4) { S.y = h; S.vy = 0; S.ready = true; }
    else {
      const lim = (Math.hypot(car.vx, car.vz) * (S.grad + 0.35) + 2.5) * dt, y0 = S.y;
      S.y += clamp(h - S.y, -lim, lim);
      S.vy = (S.y - y0) / dt; S.vb += (S.vy - S.vb) * Math.min(1, 4 * dt);
      // a quick rise against the slow trend (a kerb edge, a step; not a steady climb) jolts the body a little; heavier vehicles jolt more
      if (S.vy - S.vb > 0.8) car.hopV = Math.min(1.2, car.hopV + (S.vy - S.vb - 0.8) * 6 * dt * P.bumpK);
    }
    S.px = car.x; S.pz = car.z;
    car.lift = S.y - groundY(car.x, car.z);
    if (S.hit > 0) { if (onHit) onHit(S.hit); S.hit = 0; }
  }

  return { step, tune, reset, state: S };
}
