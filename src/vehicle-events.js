// A local-colour event that changes the player's vehicle. Owned by the driving work; created by src/vehicle.js, updated from its updateVisual().
//
//  THE ZEN GAG. Drive into the ZEN (San Filippo Neri, north-west Palermo) and, a few seconds later, the screen darkens (a vignette closing in,
//  the colour draining, the vehicle sounds muffled), goes black for a beat, and you wake up parked just outside the district, facing away,
//  with the vehicle stripped to the bare frame and wheels (canvas, roof, doors, seats, lights, mirrors, stickers, tuning parts gone). It stays
//  drivable. Five minutes of game time later everything is back. Purely cosmetic: garage ownership is untouched. Position based, so it only
//  happens where the world streaming lets you drive.
//
// The night "Corse clandestine" race moved to src/races.js (the shared race system of the free-roam events). Test links: ?zenfast, ?zenfreeze=fade|black|wake.

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const Q = new URLSearchParams(location.search);

// ---------- places (metres in the game's projection: x east, z south) ----------
// The ZEN: Via Costante Girardengo, Via Fausto Coppi, Via Rocky Marciano and Via Primo Carnera are its streets in the OSM data.
const ZEN = [[-4260, -7720], [-3640, -7720], [-3640, -6740], [-4260, -6740]];
const ZEN_C = [-3950, -7230];

function polyDist(poly, x, z) { // distance to the outline
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0, d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }

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
  let evBusy = false;   // a free-roam event runs (src/missions.js): the ZEN gag waits so that an event in the ZEN stays playable
  addEventListener('pd-event-busy', e => { evBusy = !!e.detail; });

  // =============================================================================================== the ZEN
  const vz = el('vz-fade', '<b>...</b>');
  const Z = { state: 'out', t: 0, restoreAt: -1, cool: 0, wokeBalloon: false };
  const ZEN_LINES = ['Ti ficiru u tagliando completo!', 'Ma unni sunnu i sedili?!', 'Chi bellu telaio, pulitu pulitu!', 'Bentornato! Pi furtuna c\'è u telaio.'];
  const ZS = Q.has('zenfast') ? 0.15 : 1, FADE = 3.2 * ZS, BLACK = 1.5 * ZS, WAKE = 2.4 * ZS, GRACE = 2.5 * ZS;   // zenfast: a test link that plays the sequence in a fraction of the time
  const zf = Q.get('zenfreeze'), zk = +Q.get('zenk') || 0.5;   // test: freeze in state zf (fade|black|wake) once it is zk of the way through
  function zenVisual(level, dots) { // level 0 clear .. 1 black
    vz.classList.toggle('on', level > 0.002); vz.classList.toggle('dots', !!dots);
    vz.style.setProperty('--r', (120 - 150 * level).toFixed(1));
    if (view) view.style.filter = level > 0.002 ? `grayscale(${Math.min(1, level * 1.4).toFixed(2)}) brightness(${(1 - 0.45 * level).toFixed(2)})` : '';
    audio.setMuffle(level);
  }
  function zenTeleport() {
    // nearest road point well outside the district; wake up there, facing away from the ZEN
    let best = null, bd = Infinity;
    for (let i = 0; i < roadVerts.length; i++) {
      const v = roadVerts[i], d = (v[0] - car.x) ** 2 + (v[1] - car.z) ** 2;
      if (d < bd && !inPoly(ZEN, v[0], v[1]) && polyDist(ZEN, v[0], v[1]) > 22) { bd = d; best = v; }
    }
    let x, z, th;
    if (best) { x = best[0]; z = best[1]; th = best[2]; }
    else { // roads not loaded: a point 40 m outside the outline, straight away from the centre
      const dx = car.x - ZEN_C[0], dz = car.z - ZEN_C[1], l = Math.hypot(dx, dz) || 1; x = car.x; z = car.z;
      for (let k = 0; k < 400 && (inPoly(ZEN, x, z) || polyDist(ZEN, x, z) < 40); k++) { x += dx / l * 5; z += dz / l * 5; }
      th = Math.atan2(dx, dz);
    }
    const ax = x - ZEN_C[0], az = z - ZEN_C[1];   // face away from the centre
    if (Math.sin(th) * ax + Math.cos(th) * az < 0) th += PI;
    api.teleport(x, z, th);
  }
  function zenUpdate(dt) {
    if (car.type === 'sulky') return;
    if (zf && Z.state === zf && Z.t >= zk * ({ fade: FADE, black: BLACK, wake: WAKE }[zf])) { frozen = true; return; }
    Z.cool = Math.max(0, Z.cool - dt);
    switch (Z.state) {
      case 'out':
        if (Z.cool <= 0 && !evBusy && inPoly(ZEN, car.x, car.z)) { Z.state = 'in'; Z.t = 0; log('zen in'); }
        break;
      case 'in':
        if (evBusy || !inPoly(ZEN, car.x, car.z)) { Z.state = 'out'; break; }
        if ((Z.t += dt) >= GRACE) { Z.state = 'fade'; Z.t = 0; log('zen fade'); }
        break;
      case 'fade': {
        Z.t += dt; const k = clamp(Z.t / FADE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (Z.t >= FADE) { Z.state = 'black'; Z.t = 0; zenVisual(1, true); api.holdSim(true); zenTeleport(); api.setStripped(true); log('zen black, woke at', Math.round(car.x), Math.round(car.z), 'th', car.th.toFixed(2), 'inside?', inPoly(ZEN, car.x, car.z)); Z.restoreAt = gameT + 300; Z.wokeBalloon = false; }
        break;
      }
      case 'black':
        if ((Z.t += dt) >= BLACK) { Z.state = 'wake'; Z.t = 0; api.holdSim(false); zenVisual(1, false); }
        break;
      case 'wake': {
        Z.t += dt; const k = 1 - clamp(Z.t / WAKE, 0, 1); zenVisual(k * k * (3 - 2 * k));
        if (!Z.wokeBalloon && Z.t > 1.1) { Z.wokeBalloon = true; const sn = Math.sin(car.th), cs = Math.cos(car.th); const x = car.x + cs * 3.2 + sn * 2, z = car.z - sn * 3.2 + cs * 2;
          dispatchEvent(new CustomEvent('pd-shout', { detail: { x, y: groundY(x, z) + 1.75, z, text: ZEN_LINES[Math.floor(Math.random() * ZEN_LINES.length)] } })); }
        if (Z.t >= WAKE) { log('zen done'); Z.state = 'out'; Z.cool = 20; zenVisual(0); }
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
    state: () => ({ zen: Z.state }),
  };
}
