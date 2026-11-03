// A local-colour event that changes the player's vehicle. Owned by the driving work; created by src/vehicle.js, updated from its updateVisual().
//
//  THE GANG BLOCK (the old ZEN gag, now played in whatever area the player has done enough damage in: the neighbourhood score of src/danger.js decides when, docs/danger.md). A few seconds
//  after a gang takes the road the screen darkens (a vignette closing in, the colour draining, the vehicle sounds muffled), goes black for a
//  beat, and you wake up parked just outside the area, facing away, with the vehicle stripped to the bare frame and wheels (canvas, roof, doors,
//  seats, lights, mirrors, stickers, tuning parts gone) and some of the wallet gone. It stays drivable. Five minutes of game time later
//  everything is back. Garage ownership is untouched. Position based, so it only happens where the world streaming lets you drive.
//
// The night "Corse clandestine" race moved to src/races.js (the shared race system of the free-roam events).
// Test links: ?danger=5 (force the level), ?dangerscore=N (start with N points), ?dangerfast (a 5 s bar, fast sequence), ?dangerfreeze=fade|black|wake&dangerk=0.5.

import { garage } from './garage.js';
import { createDanger, dangerAt, wakeSpot, cashLoss, toast, covered } from './danger.js';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const Q = new URLSearchParams(location.search);

const CSS = `
.vz-fade { position: fixed; inset: 0; z-index: 450; pointer-events: none; opacity: 0; --r: 120; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, transparent calc(var(--r) * 1%), #000 calc(var(--r) * 1% + 30%)); }
.vz-fade.on { opacity: 1; }
.vz-fade b { font: 400 clamp(34px, 9vh, 70px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .3em; color: #f5a9c9; opacity: 0; transition: opacity .3s; }
.vz-fade.dots b { opacity: .85; }
`;

export function createVehicleEvents({ scene, camera, car, groundY, roadVerts, api, audio, mobile }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = (cls, html, parent = document.body) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; parent.append(e); return e; };
  const log = (...a) => { if (Q.has('evlog')) console.warn('[ev]', ...a); };
  let gameT = 0, frozen = false;   // seconds of simulated play: every timer below runs on it, so a pause freezes everything
  const view = document.getElementById('view');
  let evBusy = false;   // a free-roam event runs (src/missions.js): no gang blocks while it does, so an event in a bad area stays playable
  addEventListener('pd-event-busy', e => { evBusy = !!e.detail; });
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'it');
  const T = (it, en) => (lang() === 'en' ? en : it);
  const danger = createDanger({ car });

  // =============================================================================================== the gang block
  const vz = el('vz-fade', '<b>...</b>');
  const Z = { state: 'out', t: 0, restoreAt: -1, wokeBalloon: false, lv: 1 };
  const LINES = ['Ti ficiru u tagliando completo!', 'Ma unni sunnu i sedili?!', 'Chi bellu telaio, pulitu pulitu!', 'Bentornato! Pi furtuna c\'è u telaio.'];
  const ZS = Q.has('dangerfast') ? +Q.get('dangerfast') || 0.15 : 1, FADE = 3.2 * ZS, BLACK = 1.5 * ZS, WAKE = 2.4 * ZS;   // dangerfast: a test link that plays the sequence in a fraction (0.15, or dangerfast=1 for the real length) of the time
  const zf = Q.get('dangerfreeze'), zk = +Q.get('dangerk') || 0.5;   // test: freeze in state zf (fade|black|wake) once it is zk of the way through
  function zenVisual(level, dots) { // level 0 clear .. 1 black
    vz.classList.toggle('on', level > 0.002); vz.classList.toggle('dots', !!dots);
    vz.style.setProperty('--r', (120 - 150 * level).toFixed(1));
    if (view) view.style.filter = level > 0.002 ? `grayscale(${Math.min(1, level * 1.4).toFixed(2)}) brightness(${(1 - 0.45 * level).toFixed(2)})` : '';
    audio.setMuffle(level);
  }
  function zenTeleport() { // wake up on a road just outside the area, facing away from it
    const [x, z, th] = wakeSpot(roadVerts, car.x, car.z);
    api.teleport(x, z, th);
  }
  function zenUpdate(dt) {
    if (car.type === 'sulky') return;
    if (zf && Z.state === zf && Z.t >= zk * ({ fade: FADE, black: BLACK, wake: WAKE }[zf])) { frozen = true; return; }
    switch (Z.state) {
      case 'out':
        if (danger.update(dt, evBusy)) {
          Z.state = 'fade'; Z.t = 0; Z.lv = dangerAt(car.x, car.z); log('block fade, level', Z.lv);
          toast(T('Ti hanno visto…', 'They\'ve spotted you…'), T('Meglio se avevi premuto sull\'acceleratore', 'You should have floored it'), true);
        }
        break;
      case 'fade': {
        if (evBusy || covered()) { Z.state = 'out'; zenVisual(0); break; }   // an event or a transition took over: the gang lets you go
        Z.t += dt; const k = clamp(Z.t / FADE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (Z.t >= FADE) {
          Z.state = 'black'; Z.t = 0; zenVisual(1, true); api.holdSim(true);
          Z.lost = garage.debit(cashLoss(Z.lv, garage.cash));
          zenTeleport(); api.setStripped(true); log('block black, woke at', Math.round(car.x), Math.round(car.z), 'th', car.th.toFixed(2), 'lost', Z.lost);
          Z.restoreAt = gameT + 300; Z.wokeBalloon = false;
        }
        break;
      }
      case 'black':
        if ((Z.t += dt) >= BLACK) { Z.state = 'wake'; Z.t = 0; api.holdSim(false); zenVisual(1, false); Z.toasted = false; }
        break;
      case 'wake': {
        Z.t += dt; const k = 1 - clamp(Z.t / WAKE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (!Z.toasted && Z.t > WAKE * 0.45) { Z.toasted = true;   // once the screen has cleared enough to read it
          toast(T('Ti futtieru tutti cuasi!', 'They nicked all your stuff!'), Z.lost > 0 ? T(`Ti hanno alleggerito di € ${Z.lost}`, `They lightened you by € ${Z.lost}`) : T('Per fortuna eri al verde', 'Lucky you were broke'), true); }
        if (!Z.wokeBalloon && Z.t > 1.1) { Z.wokeBalloon = true; const sn = Math.sin(car.th), cs = Math.cos(car.th); const x = car.x + cs * 3.2 + sn * 2, z = car.z - sn * 3.2 + cs * 2;
          dispatchEvent(new CustomEvent('pd-shout', { detail: { x, y: groundY(x, z) + 1.75, z, text: LINES[Math.floor(Math.random() * LINES.length)] } })); }
        if (Z.t >= WAKE) { log('block done'); Z.state = 'out'; zenVisual(0); }
        break;
      }
    }
    if (api.stripped && Z.restoreAt > 0 && gameT >= Z.restoreAt && Z.state === 'out') { // five minutes later everything is back
      api.setStripped(false); Z.restoreAt = -1;
      for (let i = 0; i < 10; i++) api.puff(car.x + (Math.random() - 0.5) * 1.6, groundY(car.x, car.z) + 0.6, car.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.9);
    }
  }

  return {
    stripped: () => api.stripped,
    update(dt, active) {
      if (!active) return;
      gameT += dt;
      if (frozen) return;
      zenUpdate(dt);
    },
    state: () => ({ block: Z.state, level: danger.level() }),
  };
}
