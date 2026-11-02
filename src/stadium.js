// The Barbera's crowd reacts to the lapa (the stands are src/lmc-a.js + src/stadium-crowd.js, the platform of the playing area src/stadium-ground.js): while the lapa is on the track or the
// pitch, the stands jump and throw up their scarves (crowdState.hype, read by the crowd's shader) and now and then a fan shouts a chant in a speech balloon, one at a time, 5 to 10 seconds
// apart, from a seat in front of the camera. Created by src/main.js; update(dt) while playing. The chants are the stock ones of every curva, written for the game: the owner may want his own.
import * as THREE from 'three';
import { pitchRing, pitchCentre } from './stadium-ground.js';
import { crowdState } from './stadium-crowd.js';

export const CHANTS = ['FORZA PALERMO!', 'Alé alé rosanero!', 'Palermo, Palermo, Palermo!', 'Sempre con te, Palermo!'];
let R2 = 0; for (const p of pitchRing) R2 = Math.max(R2, (p[0] - pitchCentre.x) ** 2 + (p[1] - pitchCentre.z) ** 2); R2 = (Math.sqrt(R2) + 1) ** 2;
const inRing = (x, z) => { let c = false; for (let i = 0, j = pitchRing.length - 1; i < pitchRing.length; j = i++) { const a = pitchRing[j], b = pitchRing[i]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

export function createStadium(env) {
  const { car, camera, shout } = env;
  let time = 0, hype = 0, next = 3, last = -1; const dirV = new THREE.Vector3();
  function chant() {
    const S = crowdState.seats; if (!S.length) return;
    camera.getWorldDirection(dirV);
    for (let k = 0; k < 14; k++) {
      const s = S[(Math.random() * S.length) | 0], dx = s[0] - camera.position.x, dz = s[2] - camera.position.z, d = Math.hypot(dx, dz);
      if (d < 18 || d > 95 || (dx * dirV.x + dz * dirV.z) / d < 0.25) continue;
      let i; do i = (Math.random() * CHANTS.length) | 0; while (i === last && CHANTS.length > 1); last = i;
      shout(s[0], s[1], s[2], CHANTS[i]); return;
    }
  }
  return {
    update(dt) {
      time += dt;
      const dx = car.x - pitchCentre.x, dz = car.z - pitchCentre.z, on = dx * dx + dz * dz < R2 && inRing(car.x, car.z);
      hype += ((on ? 1 : 0) - hype) * Math.min(1, dt * (on ? 0.9 : 0.5));
      crowdState.hype = hype < 0.02 ? 0 : hype;
      if (hype > 0.7 && time >= next) { chant(); next = time + 5 + Math.random() * 5; }
    },
    get hype() { return hype; },
  };
}
