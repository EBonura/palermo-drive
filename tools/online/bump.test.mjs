// Unit tests for src/online/bump.js (docs/ONLINE.md, "Bumping"): the wire format and its limits, the bounce, the send and receive rates, and two phones bumping each other through a
// network with delay. No browser, no relay: node --test tools/online/bump.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../src/online/bump.js';

const STEP = 1 / 120;
const mkCar = (x, z, th, v) => ({ x, z, th, vx: Math.sin(th) * v, vz: Math.cos(th) * v, vf: v, w: 0, agl: 0 });
const mkRemote = (id, car, h = 0) => ({ id, alpha: 1, model: true, far: false, pose: { x: car.x, z: car.z, th: car.th, v: car.vf, h } });
const speed = c => Math.hypot(c.vx, c.vz);

test('pack and read: round trip and the shape on the wire', () => {
  const b = B.packHit(3, -2, 1);
  assert.equal(b.length, 4); assert.equal(b[0], B.HIT);
  const h = B.readHit(b);
  assert.ok(Math.abs(h.dvx - 3) < 1 / B.DV_Q && Math.abs(h.dvz + 2) < 1 / B.DV_Q && Math.abs(h.dw - 1) < 1 / B.DW_Q);
  assert.equal(b.length + 3, 7);   // as a TO frame: 7 bytes, the relay's direct field has room for 8
});

test('pack clamps whatever it is given, and keeps the direction', () => {
  for (const [x, z, w] of [[1e9, 1e9, 1e9], [-1e9, 0, -1e9], [NaN, Infinity, NaN], [50, 0, 0], [0, -50, 9]]) {
    const h = B.readHit(B.packHit(x, z, w));
    assert.ok(h, 'readable');
    assert.ok(Math.hypot(h.dvx, h.dvz) <= B.MAX_DV + 1e-9, `|dv| <= ${B.MAX_DV}`);
    assert.ok(Math.abs(h.dw) <= B.MAX_DW + 1e-9);
  }
  const h = B.readHit(B.packHit(50, 0, 0)); assert.ok(h.dvx > 9 && Math.abs(h.dvz) < 0.1);
});

test('read: every possible byte value stays inside the limits; wrong length or type is null', () => {
  let n = 0;
  for (let a = 0; a < 256; a += 5) for (let c = 0; c < 256; c += 5) for (const d of [0, 1, 127, 128, 129, 255]) {
    const h = B.readHit(Uint8Array.of(B.HIT, a, c, d)); n++;
    assert.ok(Math.hypot(h.dvx, h.dvz) <= B.MAX_DV + 1e-9 && Math.abs(h.dw) <= B.MAX_DW + 1e-9);
  }
  assert.ok(n > 1000);
  for (const bad of [null, undefined, new Uint8Array(0), Uint8Array.of(B.HIT), Uint8Array.of(B.HIT, 1, 2), Uint8Array.of(B.HIT, 1, 2, 3, 4), Uint8Array.of(7, 1, 2, 3), Uint8Array.of(4, 0, 1)]) assert.equal(B.readHit(bad), null);
});

test('a head on bump: both cars are pushed apart, equal and opposite, nobody gains energy', () => {
  const sent = [], bump = B.createBump({ send: (id, bytes) => sent.push([id, bytes]) });
  const car = mkCar(0, 0, 0, 10);                 // heading +z at 10 m/s
  const other = mkCar(0, 2.6, Math.PI, 0);        // stationary, nose to nose, centres 2.6 m apart (they overlap: the circles are 1.48 apart at the nearest)
  const rem = new Map([[7, mkRemote(7, other)]]);
  const e0 = speed(car) ** 2;
  for (let i = 0; i < 240 && !sent.length; i++) {   // until the bump has been told (the parked car of this test never moves, so it would be hit again)
    car.x += car.vx * STEP; car.z += car.vz * STEP;
    bump.collide(car, rem, i * STEP * 1000);
  }
  assert.ok(car.vz < 4.5, 'our car lost most of its speed: ' + car.vz);
  assert.ok(speed(car) ** 2 < e0);
  assert.equal(sent.length, 1, 'one message for the bump');
  const h = B.readHit(sent[0][1]);
  assert.equal(sent[0][0], 7);
  assert.ok(h.dvz > 4 && h.dvz <= B.MAX_DV, 'they are pushed forward: ' + h.dvz);
  assert.ok(Math.abs(h.dvz - (10 - car.vz)) < 0.3, 'what they get is what we gave up (to the wire rounding): ' + h.dvz + ' vs ' + (10 - car.vz));
});

test('no bump beyond the reach, from another height, or from a player who is not drawn', () => {
  const sent = [], bump = B.createBump({ send: (...a) => sent.push(a) });
  const car = mkCar(0, 0, 0, 10);
  const far = mkRemote(1, mkCar(0, 5, Math.PI, 0)), high = mkRemote(2, mkCar(0, 1.5, 0, 0), 4), hidden = mkRemote(3, mkCar(0, 1.5, 0, 0)); hidden.far = true;
  const faded = mkRemote(4, mkCar(0, 1.5, 0, 0)); faded.alpha = 0.2;
  const nomodel = mkRemote(5, mkCar(0, 1.5, 0, 0)); nomodel.model = null;
  const nopose = { id: 6, alpha: 1, model: true, far: false };
  const rem = new Map([far, high, hidden, faded, nomodel, nopose].map(r => [r.id, r]));
  const c0 = { ...car };
  bump.collide(car, rem, 0);
  assert.deepEqual({ ...car }, c0); assert.equal(sent.length, 0);
});

test('a brush that is only felt by our own car sends nothing', () => {
  const sent = [], bump = B.createBump({ send: (...a) => sent.push(a) });
  const car = mkCar(0, 0, 0, 0.6), other = mkCar(0.2, 1.3, Math.PI, 0);
  const rem = new Map([[1, mkRemote(1, other)]]);
  for (let i = 0; i < 100; i++) { car.z += car.vz * STEP; bump.collide(car, rem, i * 8); }
  assert.equal(sent.length, 0);
});

test('sending: pushing a car for ten seconds stays under the relay TO rate and the gap per player', () => {
  const sent = [], bump = B.createBump({ send: (id, b) => sent.push([id, b, now]) });
  let now = 0;
  const car = mkCar(0, 0, 0, 6), other = mkCar(0, 2.5, Math.PI, 0), rem = new Map([[1, mkRemote(1, other)]]);
  for (let i = 0; i < 1200; i++) {   // ten seconds at 120 Hz: pinned against a car that never moves, the driver holds the throttle (6 m/s again every step)
    now = i * 1000 / 120;
    car.x = 0; car.z = 0; car.vz = 6; car.vx = 0;
    bump.collide(car, rem, now); if (i % 2 === 0) bump.flush(now);
  }
  assert.ok(sent.length >= 3, 'it does keep telling them: ' + sent.length);
  assert.ok(sent.length <= B.TX_PER_S * 10 + B.TX_BURST, 'under the rate: ' + sent.length);
  for (let i = 1; i < sent.length; i++) assert.ok(sent[i][2] - sent[i - 1][2] >= B.SEND_GAP_MS - 1, 'gap ' + (sent[i][2] - sent[i - 1][2]));
  for (const [, b] of sent) { const h = B.readHit(b); assert.ok(h && Math.hypot(h.dvx, h.dvz) <= B.MAX_DV + 1e-9); }
});

test('sending: ten players bumped at once cost at most the burst, and the rest is held back and goes later', () => {
  const sent = [], bump = B.createBump({ send: (id, b) => sent.push(id) });
  const car = mkCar(0, 0, 0, 8), rem = new Map();
  // ten cars standing all around, all overlapping ours
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; rem.set(i + 1, mkRemote(i + 1, mkCar(Math.sin(a) * 1.8, Math.cos(a) * 1.8, a + Math.PI, 0))); }
  bump.collide(car, rem, 0);
  assert.ok(sent.length <= B.TX_BURST, 'sent ' + sent.length);
  assert.ok(bump.stats.delayed > 0 || sent.length < 10);
});

// ---- receiving ----
const rxSetup = () => {
  const bump = B.createBump({ send() {} }), car = mkCar(0, 0, 0, 0);
  const rem = mkRemote(9, mkCar(0, -2, 0, 5));   // behind us
  return { bump, car, rem };
};
const hit = (dvx, dvz, dw = 0) => B.packHit(dvx, dvz, dw);

test('receive: a good hit pushes the car, and is clamped', () => {
  const { bump, car, rem } = rxSetup();
  assert.equal(bump.receive(car, rem, hit(0, 4), 1000), true);
  assert.ok(Math.abs(car.vz - 4) < 0.1); assert.ok(Math.abs(car.vf - 4) < 0.1);
  const u = rxSetup();
  assert.equal(u.bump.receive(u.car, u.rem, Uint8Array.of(B.HIT, 0, 127, 127), 1000), true);
  assert.ok(u.car.vz <= B.MAX_DV + 1e-9 && Math.abs(u.car.w) <= 3.2 + 1e-9);
});

test('receive: bad frames, players we do not hold, and players too far are dropped', () => {
  const { bump, car, rem } = rxSetup();
  assert.equal(bump.receive(car, rem, Uint8Array.of(B.HIT, 1), 0), false);
  assert.equal(bump.receive(car, undefined, hit(0, 3), 10), false);
  const far = mkRemote(8, mkCar(0, -(B.RX_MAX_DIST + 1), 0, 0)); assert.equal(bump.receive(car, far, hit(0, 3), 20), false);
  const gone = mkRemote(7, mkCar(0, -2, 0, 0)); gone.far = true; assert.equal(bump.receive(car, gone, hit(0, 3), 30), false);
  assert.equal(car.vz, 0);
  assert.deepEqual([bump.stats.drops.bad, bump.stats.drops.unseen, bump.stats.drops.far], [1, 2, 1]);
});

test('receive: airborne car is not pushed; a push towards the sender is not a bump', () => {
  const { bump, car, rem } = rxSetup();
  car.agl = 5; assert.equal(bump.receive(car, rem, hit(0, 3), 0), false); car.agl = 0;
  assert.equal(bump.receive(car, rem, hit(0, -5), 100), false);   // the sender is behind us (z -2): -z is towards them
  assert.equal(car.vz, 0); assert.equal(bump.stats.drops.air, 1); assert.equal(bump.stats.drops.dir, 1);
});

test('receive: a flood from one player is held to its burst and rate', () => {
  const { bump, car, rem } = rxSetup();
  let ok = 0;
  for (let i = 0; i < 1000; i++) if (bump.receive(car, rem, hit(0, 0.6), i)) ok++;   // 1000 messages in one second
  assert.ok(ok <= B.RX_PER_BURST + B.RX_PER_S + 1, 'accepted ' + ok);
  assert.ok(car.vz <= (B.RX_PER_BURST + B.RX_PER_S + 1) * 0.6 + 0.3);
});

test('receive: ten players together cannot push more than the budget', () => {
  const bump = B.createBump({ send() {} }), car = mkCar(0, 0, 0, 0);
  let total = 0;
  for (let t = 0; t < 10000; t += 100) for (let p = 1; p <= 10; p++) { const r = mkRemote(p, mkCar(0, -2, 0, 0)); if (bump.receive(car, r, hit(0, B.MAX_DV), t)) total += B.MAX_DV; }   // ten seconds, every player at its limit
  const allowed = B.RX_BURST + B.RX_BUDGET * 10;
  assert.ok(total <= allowed + B.MAX_DV, `pushed ${total} m/s against a budget of ${allowed}`);
  assert.ok(total > 0);
});

test('receive: a message right after we bounced off the same player counts once, not twice', () => {
  const bump = B.createBump({ send() {} });
  const car = mkCar(0, 0, 0, 8), other = mkCar(0, 2.4, Math.PI, 0), rem = mkRemote(3, other);
  bump.collide(car, new Map([[3, rem]]), 1000);
  const v = car.vz;
  assert.equal(bump.receive(car, rem, hit(0, -5), 1100), false); assert.equal(car.vz, v);
  assert.equal(bump.stats.drops.dup, 1);
  const car2 = mkCar(0, 0, 0, 0); assert.equal(bump.receive(car2, rem, hit(0, -1), 1000 + B.GRACE_MS + 50), true, 'a later one is a new bump');
});

// ---- two phones, one network ----
// Cars on a line, no friction. Each phone draws the other's car `lag` ms late (the jitter buffer plus the trip), and a message takes `trip` ms.
function twoPhones({ lag, trip, speedA = 12, speedB = 0, seconds = 3 }) {
  const msgs = [], out = { A: [], B: [] };
  const A = mkCar(0, -12, 0, speedA), Bc = mkCar(0, 0, Math.PI, speedB);
  const hist = { A: [], B: [] };
  const mk = (me, to, who) => B.createBump({ send: (id, bytes) => { out[who].push(bytes); msgs.push({ at: now + trip, to, bytes, from: who }); } });
  let now = 0;
  const bA = mk(A, 'B', 'A'), bB = mk(Bc, 'A', 'B');
  const pose = (h, t) => { let p = h[0]; for (const e of h) if (e.t <= t) p = e; return p; };
  const car = { A, B: Bc }, bump = { A: bA, B: bB };
  const mapOf = who => { const o = who === 'A' ? 'B' : 'A', p = pose(hist[o], now - lag); return new Map([[o === 'A' ? 1 : 2, { id: o === 'A' ? 1 : 2, alpha: 1, model: true, far: false, pose: p }]]); };
  for (let i = 0; i < seconds * 120; i++) {
    now = i * 1000 / 120;
    for (const who of ['A', 'B']) { const c = car[who]; c.x += c.vx * STEP; c.z += c.vz * STEP; hist[who].push({ t: now, x: c.x, z: c.z, th: c.th, v: c.vf, h: 0 }); }
    for (const who of ['A', 'B']) bump[who].collide(car[who], mapOf(who), now);
    for (const who of ['A', 'B']) bump[who].flush(now);
    for (let k = msgs.length - 1; k >= 0; k--) if (msgs[k].at <= now) { const m = msgs.splice(k, 1)[0]; const rcv = m.to, snd = m.from; car[rcv].vf = car[rcv].vf; bump[rcv].receive(car[rcv], mapOf(rcv).get(snd === 'A' ? 1 : 2), m.bytes, now); }
    // keep to the line: cars are one dimensional here, their th is fixed, vf follows vx, vz
    for (const who of ['A', 'B']) { const c = car[who]; c.vf = c.vx * Math.sin(c.th) + c.vz * Math.cos(c.th); }
  }
  return { A, B: Bc, out, bump };
}

for (const [lag, trip] of [[0, 0], [30, 30], [80, 60], [150, 150]]) {
  test(`two phones, drawn ${lag} ms late and ${trip} ms trip: a ram on a parked car is felt once on each and they end apart`, () => {
    const r = twoPhones({ lag, trip });
    // ideal, equal weights, E 0.25: ours 12 -> 4.5 .. their 7.5 forwards. One bump seen from both phones may add up to what one phone computes, never double it
    const dB = r.B.vz * -1 === 0 ? 0 : Math.abs(r.B.vz);   // B faces -z, so a push along +z is a negative vf
    const sumAfter = r.A.vz + r.B.vz;
    assert.ok(sumAfter <= 12 + 0.5, 'momentum is not made: ' + sumAfter.toFixed(2));
    assert.ok(r.B.vz > 3, 'the parked car was pushed: ' + r.B.vz.toFixed(2));
    assert.ok(r.A.vz < 9, 'the rammer slowed down: ' + r.A.vz.toFixed(2));
    assert.ok(r.B.vz >= r.A.vz - 0.2, 'they do not pass through one another: A ' + r.A.vz.toFixed(2) + ' B ' + r.B.vz.toFixed(2));
    const m = r.out.A.length + r.out.B.length;
    assert.ok(m >= 1 && m <= 4, 'messages ' + m);
    for (const b of [...r.out.A, ...r.out.B]) { const h = B.readHit(b); assert.ok(Math.hypot(h.dvx, h.dvz) <= B.MAX_DV + 1e-9); }
    void dB;
  });
}

test('two phones: a head on bump between two moving cars with delay does not launch anyone beyond the limits', () => {
  const r = twoPhones({ lag: 150, trip: 150, speedA: 12, speedB: 12 });
  assert.ok(Math.abs(r.A.vz) < 12 && Math.abs(r.B.vz) < 12, `A ${r.A.vz.toFixed(2)} B ${r.B.vz.toFixed(2)}`);
});

test('two phones: far beyond the design (450 ms there and back) it may count twice, but stays bounded', () => {
  const r = twoPhones({ lag: 250, trip: 200 });
  assert.ok(r.A.vz + r.B.vz <= 12 * 1.25, 'sum ' + (r.A.vz + r.B.vz).toFixed(2));
  assert.ok(r.B.vz <= 12 + 1e-6 && r.A.vz >= 0);
});
