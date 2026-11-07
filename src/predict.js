// Where a car is dt seconds after the state s { x, z, th, v, k, a }: along an arc of curvature k (1/m, the heading turns by k per metre driven), the speed changing by a (m/s2)
// and stopping at 0 rather than going backwards. Shared by the sender (src/p2p/p2p.js, which sends a new state when its car is no longer where this puts it) and the
// receiver (src/remotes.js, which draws the car along it past the latest state): both must run the same function.
export function predict(s, dt) {
  let v = s.v, d;
  const a = s.a || 0, stop = a * v < 0 ? -v / a : Infinity, t = Math.min(dt, stop);
  d = v * t + 0.5 * a * t * t; v += a * t;
  const k = s.k || 0, th1 = s.th + k * d;
  if (Math.abs(k * d) < 1e-4) return { x: s.x + Math.sin(s.th) * d, z: s.z + Math.cos(s.th) * d, th: th1, v };
  return { x: s.x + (Math.cos(s.th) - Math.cos(th1)) / k, z: s.z + (Math.sin(th1) - Math.sin(s.th)) / k, th: th1, v };
}
