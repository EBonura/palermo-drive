// The knife-grinders (gli arrotini): several Apes with a loudspeaker, each going round a loop of his own in a quarter of the city (src/arrotino-routes.js: Kalsa, Zisa, Noce, Brancaccio, Mondello, Libertà; baked
// by tools/arrotino-routes.mjs), out and back to where he started, only by day (07:30 to 20:00 on the game's clock). Traffic only exists around the lapa and the road graph only where the tiles are, so a
// knife-grinder is two things. Always he is a point on his loop: a distance s along it that moves at a steady pace with the clock (he is found where he should be when the lapa arrives, however long it
// has been away), with a position for the minimap and the loudspeaker. When that point comes within about 200 m of the camera (and the road is there) he takes shape: an ordinary traffic vehicle
// (type 'arrotino', src/traffic.js) that drives the loop for real, giving way, braking, getting stuck, launched into the air if the lapa hits him. His real progress is read back every frame, so when he
// is culled (too far, unlucky, off the road after a launch) the point carries on from where he was. At 20:00 he is off the streets: removed at once if nobody can see him, else he drives on and goes
// when he is out of sight (the loudspeaker is off); at 07:30 each one sets out from the start of his loop, a few minutes apart.
// createArrotini(T, graph) -> { update(dt), guide(v, outs, ws), list, bindClock(time) }   T: the traffic's interface (src/traffic.js); graph: { NX, NZ, NOUT, nearestNode }
//   list: one entry per knife-grinder { id, name, on (on duty), x, z, h (the loudspeaker's place and heading), v (his vehicle, or null) }, the same objects every frame (src/city-audio.js, src/minimap pins).
import { ARROTINO_ROUTES } from './arrotino-routes.js';

const PACE = 4.6, ON_DUTY = 7.5, OFF_DUTY = 20, STAGGER = 240;   // metres per second along the loop (the real ones are slower at junctions and faster in the open), the hours, seconds
const TAKE_SHAPE_MIN = 40, TAKE_SHAPE_MAX = 205;               // metres from the camera between which a knife-grinder gets a vehicle

export function createArrotini(T, graph) {
  const { NX, NZ, NOUT, nearestNode } = graph, camera = T.camera;
  let clock = null, started = false;
  const list = ARROTINO_ROUTES.map((r, id) => {
    const m = r.pts.length / 2 - 1, cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) cum[i + 1] = cum[i] + Math.sqrt((r.pts[2 * i + 2] - r.pts[2 * i]) ** 2 + (r.pts[2 * i + 3] - r.pts[2 * i + 1]) ** 2);
    return { id, name: r.name, r: { pts: r.pts, m, cum, L: cum[m] }, on: false, s: 0, sKnown: 0, k: 0, x: r.pts[0], z: r.pts[1], h: 0, v: null, cd: 0 };
  });

  // where he is on his loop at distance s (negative: still at the start), and which way he faces
  function place(E, s) {
    const r = E.r, P = r.pts, cum = r.cum;
    if (s < 0) s = 0; else if (s >= r.L) s -= r.L * Math.floor(s / r.L);
    let k = E.k; if (s < cum[k]) k = 0;
    while (k < r.m - 1 && s >= cum[k + 1]) k++;
    E.k = k;
    const dx = P[2 * k + 2] - P[2 * k], dz = P[2 * k + 3] - P[2 * k + 1], f = (s - cum[k]) / ((cum[k + 1] - cum[k]) || 1);
    E.x = P[2 * k] + dx * f; E.z = P[2 * k + 1] + dz * f; E.h = Math.atan2(dx, dz);
  }

  // he takes shape on the road at his point: the edge of the loop he is on (its two ends are loop vertices), the vehicle told which vertex it is heading for
  function takeShape(E) {
    const r = E.r, P = r.pts, k = E.k, a = nearestNode(P[2 * k], P[2 * k + 1], 3, false);
    if (a < 0) return false;
    let e = null; const bx = P[2 * k + 2], bz = P[2 * k + 3];
    for (const c of NOUT[a]) if ((NX[c.b] - bx) ** 2 + (NZ[c.b] - bz) ** 2 < 9) { e = c; break; }
    if (!e) return false;
    const v = T.spawnAt('arrotino', e, Math.min(Math.max(E.s < 0 ? 0 : E.s - r.cum[k], 0.5), e.len - 0.5), v => { v.rt = { r, k: (k + 1) % r.m, lost: false }; v.roam = true; });
    if (!v) return false;
    E.v = v; E.sKnown = E.s; return true;
  }

  // off duty: gone at once when nobody sees him, else he drives on and goes when he is out of sight
  function leave(E) {
    const v = E.v; E.v = null;
    if (!v || v.dead) return;
    if (T.inView(v.x, T.groundY(v.x, v.z) + 1, v.z, v.ty.L * 0.6)) v.hide = true; else T.removeVehicle(v);
  }

  // the real vehicle's progress along the loop: the vertex at the start of the edge he is on, plus how far along it he is
  function follow(E, dt) {
    const v = E.v, rt = v.rt, r = E.r;
    E.x = v.x; E.z = v.z; E.h = v.h;
    if (!rt.lost) {
      const e0 = v.route[0], b = (((rt.k - v.route.length) % r.m) + r.m) % r.m, dx = NX[e0.a] - r.pts[2 * b], dz = NZ[e0.a] - r.pts[2 * b + 1];
      if (dx * dx + dz * dz < 16) { E.sKnown = r.cum[b] + Math.min(Math.max(v.t, 0), e0.len); return; }
      rt.lost = true; v.hide = true;   // off his loop (a launch, a detour round a closed road): he goes when nobody sees him, and the point carries on at its pace
    }
    E.sKnown += PACE * dt; if (E.sKnown >= r.L) E.sKnown -= r.L;
  }

  function update(dt) {
    const hour = clock && Number.isFinite(clock.hour) ? clock.hour : 12, duty = hour >= ON_DUTY && hour < OFF_DUTY, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < list.length; i++) {
      const E = list[i];
      if (duty !== E.on) {
        E.on = duty;
        if (duty) { E.s = started ? -Math.random() * STAGGER * PACE : Math.random() * E.r.L; E.sKnown = E.s; E.v = null; E.cd = 0; place(E, E.s); } else leave(E);
      }
      if (!E.on) continue;
      if (E.v) {
        if (!E.v.dead) { follow(E, dt); continue; }
        E.v = null; E.s = E.sKnown;   // gone (culled, a tile dropped): the point goes on from where he was
      }
      E.s += PACE * dt; if (E.s >= E.r.L) E.s -= E.r.L;
      place(E, E.s);
      if (E.s < 0 || (E.cd -= dt) > 0) continue;
      const dx = E.x - cx, dz = E.z - cz, d = Math.sqrt(dx * dx + dz * dz);
      if (d > TAKE_SHAPE_MAX) { E.cd = Math.min(5, (d - TAKE_SHAPE_MAX) / 45); continue; }   // the lapa cannot be here sooner than this
      E.cd = 1; if (d >= TAKE_SHAPE_MIN) takeShape(E);
    }
    started = true;
  }

  // route choice for a vehicle on a loop (called from src/traffic.js pickNext): of the roads out of the junction only the one to the loop's next vertex, else he is lost and roams
  function guide(v, outs, ws) {
    const rt = v.rt; if (rt.lost) return;
    const r = rt.r, kn = (rt.k + 1) % r.m, tx = r.pts[2 * kn], tz = r.pts[2 * kn + 1];
    let hit = -1;
    for (let i = 0; i < outs.length; i++) if (ws[i] > 0 && (NX[outs[i].b] - tx) ** 2 + (NZ[outs[i].b] - tz) ** 2 < 9) { hit = i; break; }
    if (hit < 0) { rt.lost = true; return; }
    for (let i = 0; i < ws.length; i++) if (i !== hit) ws[i] = 0;
    rt.k = kn;
  }

  return { update, guide, list, bindClock(t) { clock = t; }, clock: () => clock };   // clock(): for the ?debug probes
}
