// What the place sounds like around the lapa, on top of the traffic and the markets of src/city-audio.js: the weather (rain, the scirocco), the sea and its gulls,
// cicadas by day and crickets at night, the church bells, the trams (their rumble, and the bell as one leaves its stop) and the hooves of the carriages and the cart.
// Every sound is a cue or a bed of src/sfx.js, so nothing here makes an audio node: this module only decides how loud each one is, about five times a second.
//
//   const ambience = createAmbience({ camera, car, game, traffic, groundY, getWorld });   ambience.update(dt)   // every frame, also paused (the beds follow the radio's duck)
//
// Levels, all 0..1 before the Options volume:
//  - rain: the weather's precipitation (WX.precip). wind: the weight of the scirocco in today's mix.
//  - the sea: how near the water is (looked for at 40, 110 and 220 m round the lapa), nothing above 60 m of altitude. Gulls call now and then where it is heard, by day.
//  - cicadas: dry daylight between 9 and 19, quiet in the centre and loud out of town, and less the faster the lapa goes. Crickets: night, out of town only.
//  - bells: one passage at 8, 12 and 18 o'clock (a game hour is two minutes at the usual pace, so every hour would be a carillon), louder in the old centre.
//  - flying: the air and a drone while the lapa has its wheels off the ground on its wings.
import { sfx, bed } from './sfx.js';
import { WX } from './weather.js';
import { tramNear } from './trams.js';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RING = [[40, 0.75], [110, 0.42], [220, 0.2]], DIRS = 8, BELL_HOURS = [8, 12, 18];

export function createAmbience({ camera, car, game, traffic, groundY, getWorld }) {
  const tram = { d: 1e9, x: 0, z: 0, v: 0, bell: false };
  let acc = 0, sea = 0, seaPan = 0, gullT = 12, lastHour = -1, clopT = 0, time = 0;
  const L = { rain: 0, wind: 0, sea: 0, cicada: 0, cricket: 0, air: 0, rails: 0 };   // what was last asked for (the debug readout)

  function pan(x, z) {   // -1 (left of the view) .. 1 (right)
    const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.sqrt(dx * dx + dz * dz) || 1, e = camera.matrixWorld.elements;
    return clamp((dx * e[0] + dz * e[2]) / d, -1, 1);
  }
  function lookForSea() {
    const world = getWorld(); sea = 0; seaPan = 0;
    if (!world || !world.isLand || groundY(car.x, car.z) > 60) return;
    for (const [r, lv] of RING) {
      let n = 0, sx = 0, sz = 0;
      for (let k = 0; k < DIRS; k++) { const a = k / DIRS * Math.PI * 2, x = car.x + Math.sin(a) * r, z = car.z + Math.cos(a) * r; if (!world.isLand(x, z)) { n++; sx += x; sz += z; } }
      if (n) { sea = lv * Math.min(1, 0.55 + n / DIRS); seaPan = n < DIRS ? pan(sx / n, sz / n) * 0.7 : 0; return; }
    }
  }

  function slow(dt) {   // five times a second
    const T = game.time || {}, hour = T.hour ?? 12, night = T.night ?? 0, inGarage = !!game.garage, dry = 1 - clamp(WX.precip * 4, 0, 1);
    const sp = Math.hypot(car.vx || 0, car.vz || 0), out = ss(1500, 5000, Math.hypot(car.x, car.z)), quiet = inGarage ? 0 : 1;
    lookForSea();
    L.rain = quiet * clamp(WX.precip, 0, 1) * 0.8;
    L.wind = quiet * clamp(WX.w[3] || 0, 0, 1) * 0.5;   // WEATHERS[3] is the scirocco
    L.sea = quiet * sea * 0.7;
    L.cicada = quiet * dry * ss(8.5, 10, hour) * (1 - ss(18, 19.5, hour)) * (0.14 + 0.4 * out) * (1 - 0.6 * clamp(sp / 22, 0, 1));
    L.cricket = quiet * dry * ss(0.6, 0.9, night) * out * 0.3 * (1 - 0.6 * clamp(sp / 22, 0, 1));
    const aloft = car.flying && car.agl > 1;
    L.air = quiet * (aloft ? 0.35 + 0.3 * clamp(sp / 35, 0, 1) : 0);
    tramNear(car.x, car.z, tram);
    L.rails = quiet * (tram.d < 80 ? (1 - tram.d / 80) * clamp(tram.v / 6, 0, 1) * 0.6 : 0);
    bed('rain', L.rain); bed('wind', L.wind); bed('sea', L.sea, seaPan); bed('cicada', L.cicada); bed('cricket', L.cricket);
    bed('air', L.air, 0, clamp(sp / 35, 0, 1)); bed('rails', L.rails, tram.d < 80 ? pan(tram.x, tram.z) * 0.8 : 0, clamp(tram.v / 9, 0, 1));
    if (tram.bell && quiet) sfx('tram', clamp(1.1 - tram.d / 110, 0.25, 1), pan(tram.x, tram.z) * 0.8);
    if (!quiet || game.state !== 'play') return;
    // gulls, where the sea is heard and it is day
    if (sea > 0.3 && night < 0.4 && dry > 0.5) { gullT -= dt; if (gullT <= 0) { gullT = 14 + Math.random() * 26; sfx('gull', 0.35 + 0.5 * sea, Math.random() * 1.6 - 0.8); } }
    // the bells
    const h = Math.floor(hour);
    if (h !== lastHour) { if (lastHour >= 0 && BELL_HOURS.includes(h) && hour - h < 0.2) sfx('bell', 0.35 + 0.5 * (1 - ss(1200, 3000, Math.hypot(car.x, car.z))), Math.random() * 0.8 - 0.4); lastHour = h; }
  }

  function hooves(dt) {   // the nearest carriage or cart on the move, a hoof beat at its own pace
    if (game.state !== 'play' || game.garage) return;
    clopT -= dt; if (clopT > 0) return;
    const vs = traffic.vehicles; let best = null, bd = 45 * 45;
    for (let i = 0; i < vs.length; i++) { const v = vs[i], m = v.ty && v.ty.model; if (m !== 'carrozzaTour' && m !== 'carretto') continue; if (!(v.v > 0.4)) continue; const dx = v.x - car.x, dz = v.z - car.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = v; } }
    if (!best) { clopT = 0.5; return; }
    clopT = clamp(0.62 / best.v, 0.16, 0.5) * (0.9 + Math.random() * 0.2);
    sfx('clop', clamp(1 - Math.sqrt(bd) / 45, 0, 1) * 0.9, pan(best.x, best.z) * 0.8);
  }

  return {
    update(dt) {
      time += dt; acc += dt;
      if (acc >= 0.2) { slow(acc); acc = 0; }
      hooves(dt);
    },
    debug: () => ({ ...L, seaNear: sea, tram: Math.round(tram.d), hour: +(game.time && game.time.hour || 0).toFixed(2) }),
  };
}
