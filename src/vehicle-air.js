// Wings: flying. Owned by the driving work. Bought in the Garage (part "fly", src/garage.js), drawn by addWings in src/vehicle-models.js.
//
// With the upgrade fitted (car.wings) holding Fly (the F key, the VOLA pad on a phone: keys.KeyF) lifts the lapa off whatever it is on and keeps lifting
// it; the throttle and the steering are the ones of the road (the ground model still moves the ball, grip and walls included), so the lapa banks into its
// turns and the engine sets the forward speed. Let go and it glides down, faster the faster it flies, so the brake (which slows it) is also the way to come down gently. A lapa that touches down does it softly (a bounce, a
// cloud of dust and a line from the driver, never a crash), on the road, on a bridge deck, on the water (it floats with floats and sinks without: the
// sea game over is unchanged) or on a roof, where it can drive about until the edge.
//
// This module owns the vertical state while car.flying is set: car.fy is the height of the wheels (metres above the sea), car.fvy the climb rate, car.agl the
// height above whatever is under the lapa (ground, deck or water) that the ground interactions of main.js and the walls of src/vehicle-sphere.js look at.
// The sphere model (or classic, src/vehicle.js) reads car.fy for the height of the body and lets a wall stop the lapa only below its top (seg.top, src/world.js).
import { SEA_Y } from './sea.js';
import { FLOAT_Y } from './vehicle-water.js';
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const CEIL = 700;        // metres above the sea: a hundred over the top of Monte Pellegrino (606 m), the climb eases off from CEIL - 80
export const CLIMB = 13;        // m/s up while Fly is held
export const SINK = 3;          // m/s down when it is let go, plus a tenth of the forward speed (a glide: 3 m/s standing, 8 at 50 m/s)
export const CAP = +new URLSearchParams(location.search).get('aircap') || 45;   // m/s (162 km/h, the top gear of the Calessino without nitro): what the tile streamer keeps up with on the phone profile, the same for every device. ?aircap=N to try another
// Measured (844x390 at DPR 3, 4x CPU, 120 m over the city, 2 km after the warm-up): at 45 m/s the tile under the lapa was at full detail in every frame and the low-detail ring was
// in place 900 m ahead; at 60 m/s the tile under it lagged in 7 % of the frames and the ring in 8 % of them at 900 m. A desktop keeps up with 120 m/s, but one speed for everyone.
const ROOF_SCAN = 120;          // roofs are looked up only this far over the ground (nothing in the city is taller)
const HOVER = 22;               // m above the ground that a lapa stays at while the tiles under it are not at full detail yet

// LINES: said by the driver (balloons over the lapa, see 'pd-shout' in src/main.js). [text, when]
export const LINES = {
  up: ['Minchia staiu vulannu', 'Chi ccià farì a riedbull?', 'Volareeeeee! Oooouuuu!'],
  land: ['Pusai com’a ’na pinna!', 'Chi atterraggiu!'],
  hard: ['Ahia, u culu!'],
  roof: ['Chi bella vista ri cca supra!'],
  sea: ['Siemu na vaica!'],
};

export function createAir({ car, keys, groundY, floorAt, roofAt, detailAt, isWater, onEvent }) {
  const A = { y: 0, vy: 0, rest: false, said: -9 };
  const say = (kind, big) => {
    const now = performance.now() / 1000; if (now - A.said < 2.5) return; A.said = now;
    const L = LINES[kind]; if (L) onEvent('say', L[(Math.random() * L.length) | 0], big);
  };
  function off() { car.flying = false; car.agl = 0; car.fvy = 0; A.rest = false; }
  return {
    state: A,
    reset() { off(); A.vy = 0; },
    // once per physics step, before the ball moves; base: the height of the wheels now (the ball's surface)
    step(dt, base) {
      const fly = !!(keys.KeyF && car.wings);
      if (!car.flying) {
        if (!fly) return;
        car.flying = true; A.y = base; A.vy = 3; A.rest = false;
        onEvent('up'); say('up');
      }
      if (!car.wings) { off(); return; }                        // unfitted in the Garage while up there: back on the ground
      const x = car.x, z = car.z;
      const wet = isWater(x, z);
      let fl = floorAt(x, z, A.y);                               // the ground or a bridge deck ...
      if (wet) fl = Math.max(fl, car.floats ? FLOAT_Y : SEA_Y);   // ... or the water (without floats it ends the run, as it always did, as soon as the lapa is down)
      const ready = wet || detailAt(x, z) >= 2;
      const rf = A.y - fl < ROOF_SCAN ? roofAt(x, z) : NaN;
      const roof = rf === rf && A.y > rf - 2.5 && rf > fl;      // over a roof (and not inside the building)
      const floor = roof ? rf : fl;
      // vertical speed: climb while Fly is held (easing off towards the ceiling), else glide
      const tgt = fly ? CLIMB * (1 - sstep(CEIL - 80, CEIL, A.y)) : -(SINK + 0.1 * Math.sqrt(car.vx * car.vx + car.vz * car.vz));
      const a = tgt > A.vy ? 22 : 9;
      A.vy += clamp(tgt - A.vy, -a * dt, a * dt);
      A.y += A.vy * dt;
      if (A.y > CEIL) { A.y = CEIL; A.vy = Math.min(A.vy, 0); }
      if (!ready) { const lo = groundY(x, z) + HOVER; if (A.y < lo) { A.y = lo; A.vy = Math.max(A.vy, 0); } }   // the tiles under us are still loading: keep clear of a coarse ground rather than land on it
      else if (A.y <= floor) {                                  // touch down
        const hit = -A.vy; A.y = floor;
        if (hit > 0.5) { onEvent('land', hit, roof ? 'roof' : wet ? 'water' : 'ground', x, z); say(hit > 8 ? 'hard' : roof ? 'roof' : wet && car.floats ? 'sea' : 'land'); }
        A.vy = 0;
        if (roof) A.rest = true;
        else { off(); return; }                                  // on the ground: the ground model takes over at this height
      } else A.rest = false;
      car.fy = A.y; car.fvy = A.vy;
      car.agl = Math.max(0, A.y - fl);
    },
  };
}
