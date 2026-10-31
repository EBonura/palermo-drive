// Traffic: vehicles driving the OSM road graph. Owned by the traffic work.
// createTraffic(env) with env = { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D }.
// Return { update(dt, camera), collidePlayer(car), agents() } ; agents() lists {x, z, r} for others to avoid.
export function createTraffic(env) {
  return { update() {}, collidePlayer() {}, agents: () => [] };
}
