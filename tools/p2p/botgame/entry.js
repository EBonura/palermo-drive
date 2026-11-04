// A stress bot: the real src/p2p/p2p.js (room choice, shards, presence, closest players, rate limits, wire format) with the drawing, garage and language stubbed
// (tools/p2p/botgame/*.js, swapped in by tools/p2p/stress.mjs when it bundles this file). Same traffic as a game client; no 3D, no game UI.
// Control from the harness through window.bot.
import { createP2P } from '../../../src/p2p/p2p.js';
const car = { x: 0, z: 0, th: 0, vf: 0, steer: 0, roll: 0, lean: 0, nosAmt: 0, braking: false, drift: 0, lift: 0, type: 'calessino', livery: 'a' };
const game = { state: 'wait', settings: { volume: 0 } };
const api = createP2P({ car, game, vehicle: {}, missions: null, getDrunk: () => null, mapMarkers: [] });
// movement: park | circle (r metres around cx,cz) | line (heading th, speed v) | bounce (a heading, turned back towards cx,cz at the edge of a box)
const mv = { mode: 'park', v: 12, cx: 0, cz: 0, r: 40, ang: Math.random() * 6.28, box: null };
window.bot = {
  car, game, mv,
  start(o) { Object.assign(mv, o); if (o.x != null) { car.x = o.x; car.z = o.z; } if (o.th != null) car.th = o.th; game.state = 'play'; },   // enter the world: from now on the netcode runs
  set(o) { Object.assign(mv, o); if (o.x != null) { car.x = o.x; car.z = o.z; } if (o.th != null) car.th = o.th; },
  stop() { game.state = 'wait'; },
};
function move(dt) {
  if (mv.mode === 'circle') { mv.ang += mv.v / mv.r * dt; car.x = mv.cx + Math.cos(mv.ang) * mv.r; car.z = mv.cz + Math.sin(mv.ang) * mv.r; car.th = mv.ang + Math.PI / 2; car.vf = mv.v; }
  else if (mv.mode === 'line' || mv.mode === 'bounce') {
    car.vf = mv.v; car.x += Math.sin(car.th) * mv.v * dt; car.z += Math.cos(car.th) * mv.v * dt;
    if (mv.mode === 'bounce' && mv.box) {
      const [x0, z0, x1, z1] = mv.box;
      if (car.x < x0 || car.x > x1 || car.z < z0 || car.z > z1) { car.x = Math.min(x1, Math.max(x0, car.x)); car.z = Math.min(z1, Math.max(z0, car.z)); car.th = Math.atan2(mv.cx - car.x, mv.cz - car.z) + (Math.random() - 0.5); }
    }
  } else car.vf = 0;
}
let last = performance.now();
setInterval(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; if (game.state === 'play') move(dt); api.update(dt); }, 33);
