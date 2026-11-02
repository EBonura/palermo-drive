// Rocket League, lite, at the Barbera: a big rosanero ball on the pitch that the lapa can hit. Simple physics (gravity, bounce, rolling friction, the pitch's own edge as the wall, the two
// goal posts), kicked by the lapa with an impulse from its speed. The ball crossing a goal line between the posts and under the bar is GOL: a big banner, the stands jump (src/stadium.js
// holds the hype) and a fan calls it out in a balloon, points go on a small card, a euro or two reach the wallet (the Garage listens to 'pd-fare') with a cooldown, the best score is saved,
// and the ball goes back to the centre. The goal frames stay solid for the lapa (walls in src/lmc-a.js): the ball does not use them, it goes through the mouth and the net.
// Cheap on purpose: one mesh, one shadow disc, no allocation per frame, nothing runs while the lapa is away from the pitch.
// createBall({ scene, car, shout, seat, boost, react }) -> { update(dt, on), score, goals, tension }
//   react (src/stadium.js, all optional): hit(speed) the lapa struck the ball, goal(side) side 0 = the +u end, 1 = the other, miss(kind) 'post', 'near' (hit the end line close to the posts), 'wide', 'bar' (over it).
//   tension: 0..1, how close the ball is to a goal and how fast it is going there (the crowd's sound rises with it).
import * as THREE from 'three';
import { FP } from './landmarks-city-data.js';
import { PITCH_Y } from './stadium-ground.js';
import { obb } from './lmc-kit.js';

const R = 1.5, SURF = PITCH_Y + 0.2, G = 24, MOUTH = 3.7, BAR = 2.44, LINE = 52.5;
const BEST_KEY = 'palermoDrive.stadium.best.v1', PAY = 2, PAY_COOLDOWN = 20, STREAK_WINDOW = 45;
const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
const GOL_CHANTS = ['GOOOOL!', 'Gol! Gol! Gol!', 'Alé alé rosanero!', 'FORZA PALERMO!'];

const CSS = `
.st-card { position: fixed; z-index: 55; left: 50%; top: calc(max(8px, env(safe-area-inset-top)) + 52px); transform: translateX(-50%) skewX(-6deg); display: none; padding: 4px 14px 5px; pointer-events: none;
  background: linear-gradient(90deg, rgba(11,7,9,.84), rgba(40,12,28,.8)); border-left: 5px solid #e8559a; box-shadow: 0 3px 12px rgba(0,0,0,.4); color: #fff; text-transform: uppercase; white-space: nowrap;
  font: 600 clamp(11px, 2.4vh, 14px)/1.1 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .14em; }
.st-card.on { display: block; } .st-card > * { display: inline-block; transform: skewX(6deg); } .st-card b { font: 400 1.5em/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; color: #ffcf4a; margin: 0 .5em 0 .25em; }
.st-card .best { opacity: .72; }
.st-gol { position: fixed; z-index: 64; left: 50%; top: 47%; pointer-events: none; display: none; text-align: center; text-transform: uppercase; transform: translate(-50%, -50%) skewX(-8deg);
  font: 400 clamp(64px, 24vh, 190px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; color: #fff; -webkit-text-stroke: 3px #0b0709; paint-order: stroke fill; letter-spacing: .04em;
  text-shadow: 0 0 30px #e8559a, 0 0 60px rgba(255,207,74,.8), 0 6px 10px rgba(0,0,0,.6); }
.st-gol small { display: block; font: 700 clamp(14px, 4vh, 28px)/1.1 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .24em; -webkit-text-stroke: 0; text-shadow: 0 0 14px #e8559a, 0 2px 4px rgba(0,0,0,.7); }
.st-gol.on { display: block; animation: st-gol 2.6s ease-out forwards; }
@keyframes st-gol { 0% { opacity: 0; transform: translate(-50%, -50%) scale(2.2) skewX(-8deg); } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1) skewX(-8deg); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -62%) scale(1.08) skewX(-8deg); } }
html.pd-title .st-card, html.pd-title .st-gol { display: none !important; }
`;

export function createBall({ scene, car, shout, seat, boost, react = {} }) {
  const ob = obb((() => { const f = FP.stadio.holes[0], o = []; for (let i = 0; i < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; })());
  const ux = ob.ux, uz = ob.uz, vx_ = ob.vx, vz_ = ob.vz, cx = ob.cx, cz = ob.cz;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const card = document.createElement('div'); card.className = 'st-card'; document.body.appendChild(card);
  const banner = document.createElement('div'); banner.className = 'st-gol'; document.body.appendChild(banner);
  let best = 0; try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) { /* storage unavailable */ }

  // the ball: a sphere with a rosanero-and-black panel pattern, and a flat dark disc as its shadow
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; { const g = cv.getContext('2d'); g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8559a' : '#16101a'; g.fillRect(i * 32, 0, 16, 128); }
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 54, 256, 20); g.fillStyle = '#16101a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, 64, 8, 0, 7); g.fill(); } }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })); mesh.visible = false; scene.add(mesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);
  const axis = new THREE.Vector3();

  // state (plain numbers: nothing is allocated per frame)
  let tension = 0, hitT = -1e9, missT = -1e9, over = false, side = 0, bx = cx, by = SURF + R, bz = cz, vx = 0, vy = 0, vz = 0, active = false, gol = 0, appear = 0, goals = 0, points = 0, streak = 0, lastGoalT = -1e9, lastPayT = -1e9, clock = 0, outT = 0;
  const reset = () => { bx = cx; bz = cz; by = SURF + R + 0.01; vx = vy = vz = 0; gol = 0; appear = 0; };

  // the pitch edge: a rectangle in the pitch's own frame (u along the pitch, v across). The side boards are at HV, the end lines at HU, except in the goal mouth where the ball goes on into the net
  const HV = 35.2, HU = 51.6, NET = 54.2;
  const miss = kind => { if (clock - missT < 1.5) return; missT = clock; react.miss?.(kind); };
  function wall() {
    const u = (bx - cx) * ux + (bz - cz) * uz, v = (bx - cx) * vx_ + (bz - cz) * vz_;
    let nu = u, nv = v, hit = false, nxu = 0, nxv = 0;
    if (nv > HV) { nv = HV; nxv = -1; hit = true; } else if (nv < -HV) { nv = -HV; nxv = 1; hit = true; }
    const lim = Math.abs(v) < MOUTH + 0.3 ? NET : HU, au = Math.abs(u);
    if (au > lim) { nu = u > 0 ? lim : -lim; nxu = u > 0 ? -1 : 1; hit = true; }
    if (!hit) return;
    bx = cx + ux * nu + vx_ * nv; bz = cz + uz * nu + vz_ * nv;
    const wx = ux * nxu + vx_ * nxv, wz = uz * nxu + vz_ * nxv, l = Math.hypot(wx, wz) || 1, nx = wx / l, nz = wz / l, vn = vx * nx + vz * nz;
    if (vn < 0) { vx -= 1.7 * vn * nx; vz -= 1.7 * vn * nz; if (vn < -9 && nxu && lim === HU) miss(Math.abs(nv) < MOUTH + 7 ? 'near' : 'wide'); }
  }
  function posts(px, pz) {
    const dx = bx - px, dz = bz - pz, d = Math.hypot(dx, dz), m = R + 0.14;
    if (d < m && by - SURF < BAR + 0.2) { const nx = dx / (d || 1), nz = dz / (d || 1); bx = px + nx * m; bz = pz + nz * m; const vn = vx * nx + vz * nz; if (vn < 0) { vx -= 1.6 * vn * nx; vz -= 1.6 * vn * nz; if (vn < -6) miss('post'); } }
  }
  function lapa(cxp, czp) {   // one of the two circles that stand for the lapa's body
    const dx = bx - cxp, dz = bz - czp, d = Math.hypot(dx, dz), m = R + 1.1;
    if (d >= m || by - SURF > R + 1.7) return;
    const nx = dx / (d || 1), nz = dz / (d || 1), sp = Math.hypot(car.vx, car.vz);
    bx = cxp + nx * m; bz = czp + nz * m;
    const rvn = (vx - car.vx) * nx + (vz - car.vz) * nz;
    if (rvn < 0) { if (rvn < -2.5 && clock - hitT > 0.5) { hitT = clock; react.hit?.(-rvn); } vx += -1.9 * rvn * nx; vz += -1.9 * rvn * nz; vx += car.vx * 0.35; vz += car.vz * 0.35; vy = Math.max(vy, Math.min(7, 1.2 + sp * 0.22)); }
  }

  function scored() {
    gol = 3.4; goals++;
    streak = clock - lastGoalT < STREAK_WINDOW ? Math.min(streak + 1, 5) : 0; lastGoalT = clock;
    const add = 10 + streak * 5; points += add; if (points > best) { best = points; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ } }
    let pay = 0; if (clock - lastPayT >= PAY_COOLDOWN) { lastPayT = clock; pay = PAY; dispatchEvent(new CustomEvent('pd-fare', { detail: { amount: PAY } })); }
    const it = lang() === 0;
    banner.innerHTML = `GOL!<small>+${add} ${it ? 'punti' : 'points'}${pay ? ' · +€ ' + pay : ''}${streak ? ' · ' + (it ? 'serie ' : 'streak ') + (streak + 1) : ''}</small>`; banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on');
    boost(7); react.goal?.(side);
    const s = seat(); if (s) shout(s[0], s[1], s[2], GOL_CHANTS[(Math.random() * GOL_CHANTS.length) | 0]);
    dispatchEvent(new CustomEvent('pd-stadium-goal', { detail: { n: goals, points, add, side } }));
    showCard();
  }
  let cardKey = '';
  function showCard() {
    const it = lang() === 0, k = goals + '|' + points + '|' + best + '|' + it;
    if (k === cardKey) return; cardKey = k;
    card.innerHTML = `<span>${it ? 'Gol' : 'Goals'}</span><b>${goals}</b><span>${it ? 'Punti' : 'Points'}</span><b>${points}</b><span class="best">${it ? 'Record' : 'Best'} ${best}</span>`;
  }

  function step(h) {
    clock += h;
    vy -= G * h; bx += vx * h; by += vy * h; bz += vz * h;
    const floor = SURF + R;
    if (by < floor) { by = floor; if (vy < -1.4) vy = -vy * 0.62; else vy = 0; }
    if (by <= floor + 0.02) { const k = Math.max(0, 1 - 0.5 * h); vx *= k; vz *= k; } else { const k = 1 - 0.04 * h; vx *= k; vz *= k; }
    if (gol <= 0) {
      lapa(car.x + Math.sin(car.th) * 0.9, car.z + Math.cos(car.th) * 0.9); lapa(car.x - Math.sin(car.th) * 0.9, car.z - Math.cos(car.th) * 0.9);
      for (let s = -1; s <= 1; s += 2) for (let t = -1; t <= 1; t += 2) posts(cx + ux * LINE * s + vx_ * MOUTH * t, cz + uz * LINE * s + vz_ * MOUTH * t);
      const u = (bx - cx) * ux + (bz - cz) * uz, v = (bx - cx) * vx_ + (bz - cz) * vz_;
      if (Math.abs(u) > LINE && Math.abs(v) < MOUTH - 0.1) {
        if (by - SURF < BAR + R * 0.4) { side = u > 0 ? 0 : 1; scored(); } else if (!over) { over = true; miss('bar'); }
      } else if (Math.abs(u) < LINE - 1) over = false;
    } else { vx *= 0.97; vz *= 0.97; }
    wall();
  }

  function update(dt, on) {
    if (!on) {   // away from the pitch: nothing runs, the ball is put back for the next visit; the card goes
      tension = 0; over = false; if (active) { active = false; mesh.visible = shadow.visible = false; card.classList.remove('on'); banner.classList.remove('on'); reset(); goals = 0; points = 0; streak = 0; cardKey = ''; }
      return;
    }
    if (!active) { active = true; reset(); mesh.visible = shadow.visible = true; card.classList.add('on'); showCard(); }
    dt = Math.min(dt, 0.05);
    if (gol > 0) { gol -= dt; if (gol <= 0) { reset(); appear = 0.0001; } }
    if (appear > 0 && appear < 1) appear = Math.min(1, appear + dt * 2.5);
    const n = Math.ceil(dt / 0.01), h = dt / n; for (let i = 0; i < n; i++) step(h);
    {   // tension: near a goal mouth and heading for it
      const u = (bx - cx) * ux + (bz - cz) * uz, v = (bx - cx) * vx_ + (bz - cz) * vz_, su = u > 0 ? 1 : -1, toward = (vx * ux + vz * uz) * su;
      const t = gol > 0 ? 0 : Math.max(0, 1 - (LINE - Math.abs(u)) / 32) * Math.max(0, 1 - Math.max(0, Math.abs(v) - MOUTH) / 20) * Math.min(1, 0.35 + Math.max(0, toward) / 16);
      tension += (t - tension) * Math.min(1, dt * 3);
    }
    if (!(bx === bx) || !(bz === bz) || Math.abs(bx - cx) > 90 || Math.abs(bz - cz) > 90) reset();   // safety: nothing may leave the stadium or turn into NaN
    // draw: roll on the axis across the motion, the shadow follows on the pitch
    const sp = Math.hypot(vx, vz);
    if (sp > 0.05) { axis.set(vz, 0, -vx).multiplyScalar(1 / sp); mesh.rotateOnWorldAxis(axis, sp * dt / R); }
    const sc = gol > 2.6 ? Math.max(0.01, (gol - 2.6) / 0.8) : appear > 0 && appear < 1 ? appear : gol > 0 && gol < 0.5 ? gol / 0.5 : 1;
    mesh.position.set(bx, by, bz); mesh.scale.setScalar(sc);
    const hgt = by - R - SURF; shadow.position.set(bx, SURF + 0.03, bz); shadow.scale.setScalar(R * (1.05 - Math.min(0.5, hgt / 14)) * sc); shadow.material.opacity = 0.38 * (1 - Math.min(0.7, hgt / 10));
  }
  return { update, get tension() { return tension; }, get score() { return points; }, get goals() { return goals; }, get state() { return { bx, by, bz, vx, vy, vz, gol, active }; }, set(x, y, z, a, b, c) { bx = x; by = y; bz = z; vx = a; vy = b; vz = c; } };
}
