// The reward of a hit, shown where it happened: a green "+1,00 €" (a car sent flying) or "+0,25 €" (a person knocked over) floats up from the road at the hit point and fades in about a second.
// The point is fixed in the world, so the camera moves past it like in an arcade game. At most MAX are alive; the oldest makes room. Amounts come from src/hit-pay.js (one reward a second, src/economy.js).
//   const pops = createHitPop(camera);   pops.pop(x, y, z, amount)   and   pops.update(dt) once a frame
import * as THREE from 'three';
import { vp } from './viewport.js';

const LIFE = 1.1, RISE = 1.7, MAX = 3;   // seconds alive, metres climbed, popups at once
const CSS = `
.pd-hitpops { position: fixed; inset: 0; pointer-events: none; z-index: 41; overflow: hidden; }
.pd-hitpop { position: absolute; left: 0; top: 0; font: 800 clamp(22px, 4.2vw, 34px)/1 var(--pd-cond, 'Barlow Condensed', system-ui, sans-serif); letter-spacing: .03em; color: #8dffa0; white-space: nowrap;
  -webkit-text-stroke: 3px rgba(10,14,10,.9); paint-order: stroke fill; text-shadow: 0 2px 6px rgba(0,0,0,.7); will-change: transform, opacity; }
.pd-hitpop.big { color: #ffe27a; font-size: clamp(28px, 5.4vw, 44px); }   /* the car sent flying: bigger and gold */
`;
const euro = v => { const n = Math.round(v * 100); return `+${Math.floor(n / 100)},${String(n % 100).padStart(2, '0')} €`; };

export function createHitPop(camera) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const layer = document.createElement('div'); layer.className = 'pd-hitpops'; document.body.appendChild(layer);
  const live = [], v = new THREE.Vector3();
  return {
    pop(x, y, z, amount) {
      if (!(amount > 0)) return;
      if (live.length >= MAX) live.shift().el.remove();
      const el = document.createElement('div'); el.className = 'pd-hitpop' + (amount >= 1 ? ' big' : ''); el.textContent = euro(amount);
      layer.appendChild(el); live.push({ el, p: new THREE.Vector3(x, y, z), t: 0 });
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i]; s.t += dt;
        if (s.t > LIFE) { s.el.remove(); live.splice(i, 1); continue; }
        const k = s.t / LIFE;
        v.copy(s.p); v.y += RISE * (1 - (1 - k) * (1 - k)); v.project(camera);   // eases out: quick at first, then drifting
        if (v.z > 1) { s.el.style.opacity = 0; continue; }
        const x = (v.x + 1) / 2 * vp.w, y = Math.min(vp.h - 120, Math.max(70, (1 - v.y) / 2 * vp.h));   // the point stays in the world, but a fast lapa drives past it: the number is held on the screen (above the gauges) for its second
        const sc = k < 0.12 ? 0.6 + 0.4 * (k / 0.12) + 0.25 * Math.sin(Math.PI * k / 0.12) : 1;   // a small pop at the start
        s.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
        s.el.style.opacity = k < 0.6 ? 1 : (1 - (k - 0.6) / 0.4).toFixed(2);
      }
    },
  };
}
