// Cars of other players bump yours (docs/ONLINE.md, "Bumping"). No DOM, no socket: the page hands it the car, the players as drawn and a send function, so the tests can run it in Node.
//
// Each phone treats the other players' cars (where they are drawn, src/remotes.js `pose`) as obstacles and bounces its own car off them, with the same two circle car the traffic uses
// (src/traffic.js collidePlayer: PR, PAX, E, I_YAW). Traffic stays local and nothing is simulated twice for the network.
// The phone that detects a bump also works out what the other car should feel and tells that player's phone, one direct frame (TO, protocol v3) of 4 bytes:
//   [HIT 8][dvx i8][dvz i8][dw i8]     velocity change in 1/12 m/s, yaw rate change in 1/40 rad/s
// The relay passes a TO on only to a player that holds the sender, and does not read it. Nothing about the relay changes: the 8 byte direct field has room, and its own TO rate
// (2 a second, burst 6, relay-worker/src/proto.rs RATE_TO) is what the sending below stays under.
//
// Trust: a message is data. It can push you by at most MAX_DV, only when its sender is drawn within RX_MAX_DIST of you, only away from the sender (roughly), at most RX_PER_S times a
// second from one player and RX_BUDGET metres a second from all of them together.
// Delay: the other car is drawn 30 to 150 ms late and a message takes as long again, so for that long after a bump the other car is still drawn where it was before we hit it. For GRACE_MS
// after a bounce off a player (or a message from them) that player is left alone completely: no second bounce off the stale picture, no message from them counted on top of our own bounce.
// So a bump that both phones see is felt once on each car, not twice, up to a round trip of about GRACE_MS.
const PR = 0.74, PAX = 0.72, I_YAW = 1.7, E = 0.25;   // the player's circles, the same as src/traffic.js
const REACH2 = 3.0 * 3.0;                              // two cars are nowhere near touching beyond this centre distance (2 * PAX + 2 * PR = 2.92)
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export const HIT = 8;                 // the first byte of the direct field (4 to 7 are the drinks, src/online/online.js)
export const MAX_DV = 10;             // m/s: the most one message can change a car's speed by (a hard ram is about this)
export const MAX_DW = 3;              // rad/s
export const DV_Q = 12, DW_Q = 40;    // units per m/s and per rad/s on the wire (int8: 10.5 m/s and 3.2 rad/s at most)
export const RX_MAX_DIST = 10;        // m: the sender is drawn this close to us (it is drawn 30 to 150 ms late, which at 20 m/s is up to 3 m)
export const RX_PER_S = 3, RX_PER_BURST = 3;      // messages accepted from one player
export const RX_BUDGET = 15, RX_BURST = 12;       // m/s of velocity change accepted a second from all players together, and at once
export const GRACE_MS = 600;
export const TX_PER_S = 1.5, TX_BURST = 3;        // messages sent, all targets: under the relay's 2 a second with the drinks' share kept free
export const SEND_GAP_MS = 300;                   // least time between two messages to one player (what is still to give is added up and goes in the next)
export const MIN_SEND_DV = 0.5;                   // m/s: a brush along the side is felt on our own car only
export const MAX_AGL = 3;                         // a car this high above the street is not touched

export function packHit(dvx, dvz, dw) {
  const m = Math.hypot(dvx, dvz), k = m > MAX_DV ? MAX_DV / m : 1;
  const q = (v, s, lim) => clamp(Math.round(v * s), -lim, lim) & 255;
  return Uint8Array.of(HIT, q(dvx * k, DV_Q, 127), q(dvz * k, DV_Q, 127), q(clamp(dw, -MAX_DW, MAX_DW), DW_Q, 127));
}
// the direct bytes of a TO frame from a stranger, or null; whatever is in them the result is inside the limits
export function readHit(b) {
  if (!b || b.length !== 4 || b[0] !== HIT) return null;
  const i8 = v => v > 127 ? v - 256 : v;
  let dvx = i8(b[1]) / DV_Q, dvz = i8(b[2]) / DV_Q, dw = clamp(i8(b[3]) / DW_Q, -MAX_DW, MAX_DW);
  const m = Math.hypot(dvx, dvz); if (m > MAX_DV) { dvx *= MAX_DV / m; dvz *= MAX_DV / m; }
  return { dvx, dvz, dw };
}

const bucket = (rate, burst, now) => ({ rate, burst, tokens: burst, t: now });
function take(b, n, now) {
  b.tokens = Math.min(b.burst, b.tokens + (now - b.t) / 1000 * b.rate); b.t = now;
  if (b.tokens < n) return false;
  b.tokens -= n; return true;
}

// send(handle, bytes): the page's own sender (it checks that the player is still held). crunch(strength 0..1): the sound of a bump.
export function createBump({ send, crunch = () => {} }) {
  const per = new Map();   // handle -> { bounced, got, lastSend, ax, az, aw, last, rx }
  const stats = { contacts: 0, bounces: 0, sent: 0, delayed: 0, recv: 0, applied: 0, drops: { bad: 0, unseen: 0, far: 0, dup: 0, rate: 0, dir: 0, budget: 0, air: 0 } };
  let tx = null, budget = null;
  const state = (id, now) => { let s = per.get(id); if (!s) { s = { until: -1e9, lastSend: -1e9, ax: 0, az: 0, aw: 0, last: now, rx: bucket(RX_PER_S, RX_PER_BURST, now) }; per.set(id, s); } s.last = now; return s; };

  function trySend(id, s, now) {
    if (Math.hypot(s.ax, s.az) < MIN_SEND_DV || now - s.lastSend < SEND_GAP_MS) return;
    tx = tx || bucket(TX_PER_S, TX_BURST, now);
    if (!take(tx, 1, now)) { stats.delayed++; return; }
    send(id, packHit(s.ax, s.az, s.aw)); stats.sent++;
    s.ax = s.az = s.aw = 0; s.lastSend = now;
  }

  // one physics step: bounce the car off every drawn player it touches, and note what they should feel. `remotes`: Map of players as src/remotes.js holds them (pose, alpha, model, far, id).
  function collide(car, remotes, now) {
    if (!remotes.size) return;
    const sn = Math.sin(car.th), cs = Math.cos(car.th), lx = cs, lz = -sn;
    let touched = false, hardest = 0;
    for (const r of remotes.values()) {
      const q = r.pose;
      if (!q || r.far || !r.model || r.alpha < 0.6) continue;
      const dx = q.x - car.x, dz = q.z - car.z;
      if (dx * dx + dz * dz > REACH2 || Math.abs((q.h || 0) - (car.agl || 0)) > 1.5) continue;
      const rsn = Math.sin(q.th), rcs = Math.cos(q.th), rvx = rsn * q.v, rvz = rcs * q.v, rlx = rcs, rlz = -rsn;
      let near = false;
      const s = state(r.id, now);
      if (now < s.until) continue;   // this bump is already dealt with
      for (let sg = 0; sg < 2; sg++) {
        const a = sg ? -PAX : PAX;
        for (let rg = 0; rg < 2; rg++) {
          const b = rg ? -PAX : PAX, px = car.x + sn * a, pz = car.z + cs * a;
          let nx = px - (q.x + rsn * b), nz = pz - (q.z + rcs * b), d = Math.hypot(nx, nz);
          const rs = 2 * PR;
          if (d >= rs) continue;
          touched = near = true;
          if (d < 1e-4) { nx = sn; nz = cs; d = 1e-4; } else { nx /= d; nz /= d; }
          const pen = Math.min(rs - d, 0.5);
          car.x += nx * pen; car.z += nz * pen;   // an obstacle: the car is moved out, all the way. The other phone moves theirs out of ours too
          const vn = (car.vx + car.w * a * lx - rvx) * nx + (car.vz + car.w * a * lz - rvz) * nz;
          if (vn >= 0) continue;
          const arm = a * (lx * nx + lz * nz), j = -(1 + E) * vn / (2 + arm * arm / I_YAW);   // two cars of the same weight
          car.vx += j * nx; car.vz += j * nz; car.w = clamp(car.w + clamp(j * arm / I_YAW * 0.7, -1.6, 1.6), -3.2, 3.2);
          const rarm = b * (rlx * -nx + rlz * -nz);   // what the other car feels, at its own contact point
          s.ax -= j * nx; s.az -= j * nz; s.aw += clamp(j * rarm / I_YAW * 0.7, -1.6, 1.6);
          s.until = now + GRACE_MS; stats.bounces++; hardest = Math.max(hardest, -vn);
        }
      }
      if (near) stats.contacts++;
      trySend(r.id, s, now);
    }
    if (touched) car.vf = car.vx * sn + car.vz * cs;
    if (hardest > 1.2) crunch(clamp(hardest / 8, 0.25, 0.9));
  }

  // what is still to be sent after the contact ended (a push that went over the gap), and the records of players long gone
  function flush(now) {
    for (const [id, s] of per) {
      if (s.ax || s.az) trySend(id, s, now);
      if (now - s.last > 60000) per.delete(id);
    }
  }

  // a TO from player `r` (a record of `remotes`, or undefined if we do not hold them). Returns true when it moved the car.
  function receive(car, r, bytes, now) {
    stats.recv++;
    const drop = k => { stats.drops[k]++; return false; };
    const h = readHit(bytes);
    if (!h) return drop('bad');
    const q = r && r.pose;
    if (!q || r.far) return drop('unseen');
    if ((car.agl || 0) > MAX_AGL) return drop('air');
    const dx = car.x - q.x, dz = car.z - q.z, dist = Math.hypot(dx, dz);
    if (dist > RX_MAX_DIST) return drop('far');
    const s = state(r.id, now);
    if (now < s.until) return drop('dup');
    if (!take(s.rx, 1, now)) return drop('rate');
    const m = Math.hypot(h.dvx, h.dvz);
    if (m > 0 && dist > 0.05 && (h.dvx * dx + h.dvz * dz) / dist < -0.3 * m) return drop('dir');   // pushes us towards them: not a bump
    budget = budget || bucket(RX_BUDGET, RX_BURST, now);
    if (!take(budget, m, now)) return drop('budget');
    car.vx += h.dvx; car.vz += h.dvz; car.w = clamp(car.w + h.dw, -3.2, 3.2);
    car.vf = car.vx * Math.sin(car.th) + car.vz * Math.cos(car.th);
    s.until = now + GRACE_MS; stats.applied++;
    if (m > 1.5) crunch(clamp(m / 8, 0.25, 0.9));
    return true;
  }

  return { collide, flush, receive, stats, per };
}
