// Police and the wanted system. Owned by the traffic work; driven by src/traffic.js (createPolice(env, T)).
//
// Chaos raises heat (0..5): yeeted cars, pedestrians knocked over, hitting police, driving fast over sidewalks with
// people on them, running the lapa through a market. While heat > 0 police cars (and now and then the comic "Polizia"
// lapino) are spawned out of view and chase the player: on the road graph while far, then off-graph in a "box in" mode
// with each car taking a slot (front, flanks, rear) once close with a line of sight. Break the line of sight and wait
// and the heat decays; stop with police around you and you are busted (card, fine from the garage wallet, carry on).
// Police are ordinary traffic vehicles (instanced, yeetable): this module only steers them, draws the light-bar glow,
// plays the siren and shows the rosanero HUD.
import * as THREE from 'three';
import { garage } from './garage.js';
import { dangerAt, areaAt, covered } from './danger.js';
import { vp } from './viewport.js';
import { zone } from './hud.js';
import { li as langIdx } from './lang.js';   // one language at a time (src/lang.js)

const hyp = (a, b) => Math.sqrt(a * a + b * b);   // Math.hypot boxes a number per call (docs/PERF.md)
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------- glow points: light bars, hazard lights. One draw call, additive, depth-tested ----------
export function createBeacons(scene, camera) {
  const MAXP = 96, pos = new Float32Array(MAXP * 3), colr = new Float32Array(MAXP * 3), size = new Float32Array(MAXP);
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), aC = new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage), aS = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aP); g.setAttribute('color', aC); g.setAttribute('size', aS); g.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } },
    vertexShader: `attribute float size; attribute vec3 color; uniform float uScale; varying vec3 vC;
      void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(110.0, size * uScale / max(0.5, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 2.0) + smoothstep(0.3, 0.0, d) * 0.7; gl_FragColor = vec4(vC, a); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  let n = 0;
  return {
    begin() { n = 0; },
    add(x, y, z, r, gr, b, s) {
      if (n >= MAXP) return;
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; colr[n * 3] = r; colr[n * 3 + 1] = gr; colr[n * 3 + 2] = b; size[n] = s; n++;
    },
    end() {
      g.setDrawRange(0, n); aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = true;
      mat.uniforms.uScale.value = camera.projectionMatrix.elements[5] * vp.h * 0.5 * Math.min(vp.dpr, 2);
    },
  };
}

const BUSTED_LINES = [
  ['Giovanotto favorisca documenti', 'Young man, your papers, please.'],
  ['I frecce chi ffa? I lassaisti a casa?', 'What about your indicators? Did you leave them at home?'],
  ['Il brigadiere dice che la lapa non è una macchina da corsa.', 'The sergeant says a lapa is not a racing car.'],
  ["Ma u viristi u semaforo russu? T'ai a canciari l'occhiali?", 'Did you see the red light? Do you need new glasses?'],
];

export function createPolice(env, T) {
  const { camera, car, walls2d, raisedMask } = env;
  const MAXCOPS = 4;
  const vs = T.vs;
  let heat = 0, unseenT = 0, seen = false, startT = 0, time = 0, tickT = 0, nextSpawn = 0, nextPatrol = 12;
  let armed = false, bustT = 0, busted = 0, grace = 0, night = false, peds = null, toastT = 0, copId = 0;
  const lastAt = {};
  const PATROL = [1, 0.75, 0.45, 0.15, 0.03];   // chance that a calm-streets patrol check spawns a car, by danger level 1..5
  const PF = location.search.includes('policefast') ? 0.05 : 1, stat = { rolls: 0, passes: 0, spawns: 0 };   // test link: ?policefast checks 20x as often
  const level = () => heat <= 0 ? 0 : Math.min(5, Math.ceil(heat - 1e-6));
  addEventListener('pd-time', e => { night = !!(e.detail && e.detail.isNight); });

  // ---------- chaos in ----------
  const GAIN = { yeet: 0.7, chain: 0.15, knock: 0.45, hitcop: 1.1, fence: 0.08, hedge: 0.06, wall: 0.2 }, LIMIT = { yeet: 0.3, chain: 0.3, knock: 0.12, hitcop: 0.5, fence: 0.4, hedge: 0.4, wall: 0.5 };   // fence, hedge and wall: smashed garden walls and fences (src/fences.js, src/props.js)
  function chaos(kind, amt) {
    if (busted > 0 || grace > 0) return;
    const lim = LIMIT[kind];
    if (lim) { if (time - (lastAt[kind] ?? -9) < lim) return; lastAt[kind] = time; }
    const was = heat;
    heat = clamp(heat + (amt ?? GAIN[kind] ?? 0.3), 0, 5);
    if (kind === 'hitcop') heat = Math.max(heat, 1.6);
    unseenT = 0;
    if (was <= 0 && heat > 0) { startT = time + 4.5 + Math.random() * 3; engageAmbient(); }
  }

  // ---------- line of sight against the building walls ----------
  const segX = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    if (d1 * d2 >= 0) return false;
    const d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    return d3 * d4 < 0;
  };
  function los(ax, az, bx, bz) {
    let hit = false;
    walls2d.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => { if (!hit && segX(ax, az, bx, bz, s[0], s[1], s[2], s[3])) hit = true; });
    return !hit;
  }

  // ---------- cops ----------
  const isCop = v => !!v.cop;
  function makeCop(v, pursue) {
    v.cop = { id: ++copId, pursue: false, mode: 'road', slot: 0, stuckT: 0, noLosT: 0, keep: false, tx: v.x, tz: v.z };
    if (pursue) engage(v);
    return v;
  }
  function engage(v) {
    const c = v.cop; c.pursue = true; c.keep = true; c.mode = 'road';
    v.boost = 1.5 + 0.07 * level(); v.drv = 1.05;
  }
  function disengage(v) {
    const c = v.cop; if (c.mode === 'direct') toRoad(v);
    c.pursue = false; c.keep = false; v.boost = 1; v.drv = 0.9 + Math.random() * 0.15;
  }
  function toRoad(v) {
    v.cop.mode = 'road'; v.cop.stuckT = 0;
    if (!T.snap(v)) v.hide = true;
  }
  function engageAmbient() {
    for (const v of vs) if (v.cop && !v.cop.pursue && !v.fly && hyp(v.x - car.x, v.z - car.z) < 200) engage(v);
  }
  function pursuers() { const out = []; for (const v of vs) if (v.cop && v.cop.pursue) out.push(v); return out; }

  // Off-graph "box in" driving, 30 Hz from traffic.integrate. Targets a slot around the player; never rams at speed.
  function slotTarget(c) {
    const sp = hyp(car.vx, car.vz), fx = sp > 2 ? car.vx / sp : Math.sin(car.th), fz = sp > 2 ? car.vz / sp : Math.cos(car.th), rx = -fz, rz = fx;
    const lead = clamp(sp * 0.9, 0, 18);
    switch (c.slot % 5) {
      case 0: c.tx = car.x + fx * (7 + lead * 0.6); c.tz = car.z + fz * (7 + lead * 0.6); break;
      case 1: c.tx = car.x + rx * 3.4 + fx * (1 + lead * 0.35); c.tz = car.z + rz * 3.4 + fz * (1 + lead * 0.35); break;
      case 2: c.tx = car.x - rx * 3.4 + fx * (1 + lead * 0.35); c.tz = car.z - rz * 3.4 + fz * (1 + lead * 0.35); break;
      case 3: c.tx = car.x - fx * 4.6; c.tz = car.z - fz * 4.6; break;
      default: c.tx = car.x + rx * 3 + fx * (6 + lead * 0.5); c.tz = car.z + rz * 3 + fz * (6 + lead * 0.5);
    }
  }
  function drive(v, dt) {
    const c = v.cop, ty = v.ty;
    if (v.fly) { T.stepFly(v, dt); return; }
    slotTarget(c);
    const dx = c.tx - v.x, dz = c.tz - v.z, d = hyp(dx, dz);
    const err = wrapPi(Math.atan2(dx, dz) - v.h), maxYaw = Math.max(v.v, 1.6) / ty.rmin;
    v.yaw = clamp(err * 3.2, -maxYaw, maxYaw); v.h += v.yaw * dt;
    const psp = hyp(car.vx, car.vz), pd = hyp(car.x - v.x, car.z - v.z);
    let vd = Math.min(d * 1.1, ty.copV);
    if (Math.abs(err) > 1.0) vd *= 0.5;
    if (pd < 14) vd = Math.min(vd, psp + 3);     // close in gently: ramming the lapa at speed just yeets the police car
    v.v += clamp(vd - v.v, -9 * dt, 4.5 * dt);
    if (v.stopT > 0) { v.stopT = Math.max(0, v.stopT - dt); v.v *= 0.9; }
    v.x += (Math.sin(v.h) * v.v + v.ex) * dt; v.z += (Math.cos(v.h) * v.v + v.ez) * dt;
    const damp = Math.exp(-4 * dt); v.ex *= damp; v.ez *= damp;
    for (const o of vs) { // keep clear of the rest of the traffic
      if (o === v || o.fly) continue;
      const ox = v.x - o.x, oz = v.z - o.z; if (ox > 4.5 || ox < -4.5 || oz > 4.5 || oz < -4.5) continue;
      const od = hyp(ox, oz), min = (ty.L + o.ty.L) * 0.32;
      if (od < min && od > 1e-3) { const k = (min - od) * 0.5; v.x += ox / od * k; v.z += oz / od * k; if (!o.cop) { o.x -= ox / od * k; o.z -= oz / od * k; } v.v *= 0.97; }
    }
    T.wallPush(v);
    v.age += dt; v.stuck = 0;
    c.stuckT = v.v < 1 && d > 10 ? c.stuckT + dt : 0;
  }

  // ---------- HUD ----------
  const css = document.createElement('style');
  css.textContent = `
  /* the area with its danger diamonds (row 2, plus for a few seconds after the area changes the words "neighbourhood danger") and the police line are parts of the map capsule, src/ui.css */
  #pd-hood { display: none; flex-direction: column; font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
  #pd-hood.on { display: flex; }
  #pd-hood .ph-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 1px; }
  #pd-hood .ph-n { min-width: 0; font-size: 12.5px; letter-spacing: .05em; line-height: 1.2; color: #ffb3d4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood .ph-t { display: none; margin-top: 1px; font: 600 10px/1.1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #d9c3cd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pd-hood.ex .ph-t { display: block; }
  #pd-hood .ph-p { display: flex; gap: 2px; flex: 0 0 auto; }
  #pd-hood .ph-p i { width: 8px; height: 8px; transform: rotate(45deg) scale(.8); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); }
  #pd-hood .ph-p i.f { background: var(--hc, #f5a9c9); box-shadow: 0 0 5px var(--hc, #f5a9c9); }
  #pd-wanted { display: none; pointer-events: none; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0 6px; margin-top: 3px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,.12);
    font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; color: #fff; }   /* the police line stands in the words column, right under the area and its diamonds, which it lines up with */
  #pd-wanted.on { display: flex; }
  #pd-wanted .pw-l { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1 1 0; }
  #pd-wanted .pw-ico { width: 17px; height: 17px; flex: 0 0 auto; }
  #pd-wanted .pw-ico .d { transform-origin: 12px 18px; }
  #pd-wanted.seen .pw-ico .b1 { animation: pw-b1 .34s steps(1) infinite; } #pd-wanted.seen .pw-ico .b2 { animation: pw-b2 .34s steps(1) infinite; }
  @keyframes pw-b1 { 0% { fill: #f08cb4; } 50% { fill: #1a1114; } } @keyframes pw-b2 { 0% { fill: #1a1114; } 50% { fill: #f08cb4; } }
  #pd-wanted .pw-t { font: 700 11px/1 'Barlow Condensed', system-ui, sans-serif; letter-spacing: .02em; color: #f5a9c9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }   /* the condensed face: RIESTA AMMUCCIATU… does not fit beside the diamonds in Racing Sans One */
  #pd-wanted .pw-pips { display: flex; gap: 2px; flex: 0 0 auto; }
  #pd-wanted .pw-pips i { width: 8px; height: 8px; transform: rotate(45deg) scale(.8); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1.5px rgba(245,169,201,.55); }
  #pd-wanted .pw-pips i.f { background: #e8559a; box-shadow: 0 0 6px #ff4fa3, inset 0 0 0 1.5px #ffd1e6; }
  #pd-wanted .pw-bar { flex: 0 0 100%; height: 2px; margin-top: 3px; border-radius: 1px; background: rgba(255,255,255,.14); overflow: hidden; }   /* how close the escape is, under the line */
  #pd-wanted .pw-bar b { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #f5a9c9, #e8559a); transition: width .3s linear; }
  #pd-wanted.clear .pw-t { color: #fff; text-shadow: 0 0 8px #e8559a; }
  #pd-busted { display: none; transform: skewX(-6deg); box-sizing: border-box; min-width: var(--obj); max-width: var(--wide); padding: 10px 22px 12px; text-align: center; pointer-events: none;
    background: linear-gradient(90deg, rgba(11,7,9,.92), rgba(48,12,32,.9)); border-top: 4px solid #e8559a; border-bottom: 4px solid #1a1114; box-shadow: 0 6px 30px rgba(0,0,0,.55), 0 0 0 2px #e8559a; color: #fff;
    font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
  #pd-busted.on { display: block; animation: pd-busted-in .25s ease-out; }
  @keyframes pd-busted-in { from { opacity: 0; transform: skewX(-6deg) scale(.92); } }
  .hz-moment:has(#pd-busted.on) .ev-result { display: none; }   /* one moment at a time: src/hud.js */
  #pd-busted > * { transform: skewX(6deg); }
  #pd-busted h3 { margin: 0 0 6px; font-weight: 400; font-size: clamp(24px, 6vh, 42px); line-height: 1; letter-spacing: .08em; text-shadow: 0 0 14px #e8559a, 0 3px 0 #1a1114; }
  #pd-busted p { margin: 0; font: 700 clamp(13px, 2.9vh, 18px)/1.25 system-ui, sans-serif; }
  #pd-busted small { display: block; margin-top: 2px; font: 600 clamp(11px, 2.3vh, 14px)/1.2 system-ui, sans-serif; opacity: .75; }
  #pd-busted .fine { margin-top: 9px; padding-top: 7px; border-top: 1px solid rgba(255,255,255,.3); font-size: clamp(16px, 3.6vh, 24px); letter-spacing: .1em; color: #f5a9c9; }`;
  document.head.appendChild(css);
  const hud = document.createElement('div');
  hud.id = 'pd-wanted';
  hud.innerHTML = `<div class="pw-l"><svg class="pw-ico" viewBox="0 0 24 24"><g class="d"><path class="b1" d="M5 18a7 7 0 0 1 7-9v9z" fill="#f08cb4"/><path class="b2" d="M19 18a7 7 0 0 0-7-9v9z" fill="#1a1114"/></g><rect x="3" y="18" width="18" height="3" rx="1" fill="#e8559a"/><path d="M12 2v3M4.5 5.5l2 2M19.5 5.5l-2 2" stroke="#f5a9c9" stroke-width="1.6" stroke-linecap="round"/></svg><div class="pw-t"></div></div><div class="pw-pips"><i></i><i></i><i></i><i></i><i></i></div><div class="pw-bar"><b></b></div>`;
  // the map capsule (src/ui.css, #pd-card): the area and its danger always (in the words column, #pd-info), the police line across its bottom only when the police care
  const hood = document.createElement('div'); hood.id = 'pd-hood';
  hood.innerHTML = '<div class="ph-row"><div class="ph-n"></div><span class="ph-p"><i></i><i></i><i></i><i></i><i></i></span></div><div class="ph-t"></div>';
  document.getElementById('pd-info').append(hood, hud);
  const elHN = hood.querySelector('.ph-n'), elHT = hood.querySelector('.ph-t'), hPips = [...hood.querySelectorAll('.ph-p i')];
  const HOOD_C = ['#9fd39a', '#f2d36b', '#f0a04b', '#ef6a4b', '#ff3b5c'];   // quiet green to ZEN red
  let hdOn = null, hdName = '', hdLv = -1, hdLang = '', hdEx = 0;
  const EX_MS = 5000;   // "neighbourhood danger" is spelt out for this long after the area changes, then only the diamonds stay
  function drawHood() {
    const on = !covered();
    if (on !== hdOn) { hdOn = on; hood.classList.toggle('on', on); }
    if (!on) return;
    const name = areaAt(car.x, car.z) || 'Palermo', lv = dangerAt(car.x, car.z);
    if (name !== hdName) { hdName = name; elHN.textContent = name; hdEx = performance.now() + EX_MS; hood.classList.add('ex'); }
    else if (hdEx && performance.now() > hdEx) { hdEx = 0; hood.classList.remove('ex'); }
    const lang = document.documentElement.lang === 'en' ? 'en' : 'it';
    if (lang !== hdLang) { hdLang = lang; elHT.textContent = lang === 'en' ? 'Neighbourhood danger' : 'Pericolosità quartiere'; }
    if (lv !== hdLv) { hdLv = lv; hPips.forEach((p, i) => p.classList.toggle('f', i < lv)); hood.style.setProperty('--hc', HOOD_C[lv - 1] || HOOD_C[0]); }
  }
  // the words of the police line: the one place to change them
  const WANTED_TEXT = { escaped: 'SEMINATI!', seen: 'SBIRRI!', alert: 'ACCURA…', hidden: 'RIESTA AMMUCCIATU…' };
  const elT = hud.querySelector('.pw-t'), pips = [...hud.querySelectorAll('.pw-pips i')], elBar = hud.querySelector('.pw-bar b');
  let hLevel = -1, hSeen = null, hText = '', hBar = -1;
  function drawHud() {
    const lv = level(), shown = (lv > 0 || toastT > 0) && !covered();
    drawHood();
    if (hud.classList.contains('on') !== shown) hud.classList.toggle('on', shown);
    if (!shown) return;
    const txt = toastT > 0 && lv === 0 ? WANTED_TEXT.escaped : seen ? WANTED_TEXT.seen : startT > time && !pursuers().length ? WANTED_TEXT.alert : WANTED_TEXT.hidden;
    if (txt !== hText) { hText = txt; elT.textContent = txt; hud.classList.toggle('clear', toastT > 0 && lv === 0); }
    if (lv !== hLevel) { hLevel = lv; pips.forEach((p, i) => p.classList.toggle('f', i < lv)); }
    const sn = seen && lv > 0;
    if (sn !== hSeen) { hSeen = sn; hud.classList.toggle('seen', sn); }
    const bar = Math.round(heat / 5 * 100);
    if (bar !== hBar) { hBar = bar; elBar.style.width = bar + '%'; }
  }

  // ---------- busted ----------
  const card = document.createElement('div');
  card.id = 'pd-busted';
  zone('moment').appendChild(card);
  function bust() {
    const lv = Math.max(1, level()), want = 20 * lv, fine = garage.debit(Math.min(want, garage.cash));
    const line = BUSTED_LINES[(Math.random() * BUSTED_LINES.length) | 0][langIdx()];   // the line in the language shown, no subtitle
    card.innerHTML = `<h3>T'INCUCCIARU!</h3><p>${line}</p><div class="fine">${fine > 0 ? 'MULTA −€' + fine : 'MULTA €0 · SEI AL VERDE'}</div>`;
    card.classList.add('on'); busted = 4.2; grace = 9; heat = 0; armed = false; bustT = 0; seen = false; unseenT = 0;
    for (const v of pursuers()) disengage(v);
    try { dispatchEvent(new CustomEvent('pd-busted', { detail: { fine } })); } catch (e) { /* no events */ }
  }

  // ---------- siren ----------
  const au = { ctx: null, osc: null, gain: null, pan: null, master: null, vol: 0.8 };
  function startAudio() {
    if (au.ctx) { if (au.ctx.state === 'suspended') au.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = au.ctx = new AC();
      au.master = c.createGain(); au.master.gain.value = au.vol * 0.16; au.master.connect(c.destination);
      au.pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); au.pan.connect(au.master);
      au.gain = c.createGain(); au.gain.gain.value = 0; au.gain.connect(au.pan);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2300; lp.connect(au.gain);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; hp.connect(lp);
      au.osc = c.createOscillator(); au.osc.type = 'sawtooth'; au.osc.frequency.value = 540; au.osc.connect(hp); au.osc.start();
    } catch (e) { au.ctx = null; }
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, startAudio, { passive: true });
  // traffic.update stops being called while the game is paused (or the tab hidden): duck the siren then
  let lastUpd = performance.now();
  setInterval(() => { if (au.ctx && au.gain && performance.now() - lastUpd > 350) au.gain.gain.setTargetAtTime(0, au.ctx.currentTime, 0.05); }, 200);
  function sirenUpdate(near, pan) {
    lastUpd = performance.now();
    const c = au.ctx; if (!c || c.state !== 'running' || !au.osc) return;
    const now = c.currentTime, g = au.vol > 0 && near < 1e8 ? Math.pow(clamp(1 - near / 170, 0, 1), 1.6) : 0;
    au.gain.gain.setTargetAtTime(g * 0.8, now, 0.1);
    au.osc.frequency.setTargetAtTime((time % 1.1) < 0.55 ? 740 : 560, now, 0.025); // the Italian two-tone "ni-no"
    if (au.pan.pan) au.pan.pan.setTargetAtTime(clamp(pan, -0.8, 0.8), now, 0.12);
  }

  // ---------- per frame ----------
  function tick(dt) {
    const lv = level(), sp = hyp(car.vx, car.vz);
    // chaos that comes from driving rather than from a single hit
    if (sp > 6.5 && peds && busted <= 0 && grace <= 0 && !(car.agl > 3)) {   // (not up in the air: wings, src/vehicle-air.js)
      if (peds.near(car.x, car.z, 11) >= 5) chaos('market', 0.45 * dt * 4);
      if (raisedMask(car.x, car.z) && peds.near(car.x, car.z, 6) >= 2) chaos('sidewalk', 0.3 * dt * 4);
    }
    const ps = pursuers();
    // who can see the lapa?
    let any = false;
    for (const v of ps) {
      const c = v.cop, d = hyp(v.x - car.x, v.z - car.z);
      c.los = d < 75 && los(v.x, v.z, car.x, car.z);
      if (c.los) any = true;
      c.noLosT = c.los ? 0 : c.noLosT + dt;
      if (c.mode === 'road') { // heading away down a long road: turn round
        c.awayT = d > (c.prevD ?? d) + 0.3 ? (c.awayT || 0) + dt : 0; c.prevD = d;
        if (c.awayT > 1.8 && d > 25 && time > (c.uCool || 0)) { c.awayT = 0; c.uCool = time + 6; T.uturn(v); }
      } else c.prevD = d;
    }
    seen = any;
    if (heat > 0) {
      if (seen) { unseenT = 0; armed = true; } else { unseenT += dt; if (unseenT > 4.5 && (armed || time > startT + 40)) heat -= dt * 0.1; } // cops that never found you let the heat go too
      if (heat <= 0) { heat = 0; armed = false; toastT = 2.6; for (const v of ps) disengage(v); }
    }
    // box in: close cops with a line of sight leave the road graph and take a slot around the lapa
    let slot = 0;
    for (const v of ps) {
      const c = v.cop, d = hyp(v.x - car.x, v.z - car.z);
      if (v.fly) continue;
      if (c.mode === 'road' && d < 42 && c.los && v.ty.copV) { c.mode = 'direct'; c.stuckT = 0; v.cop.slot = slot++; }
      else if (c.mode === 'direct') {
        if (d > 62 || c.noLosT > 2.5 || c.stuckT > 3) toRoad(v); else c.slot = slot++;
      }
    }
    // busted?
    if (busted <= 0 && grace <= 0 && lv > 0) {
      let n = 0; for (const v of ps) if (!v.fly && hyp(v.x - car.x, v.z - car.z) < 9.5) n++;
      if (n > 0 && sp < 3.5 && !(car.agl > 3)) { bustT += dt * (1 + 0.4 * (n - 1)); if (bustT >= 2.2) bust(); } else bustT = Math.max(0, bustT - dt * 0.5);
    }
    // reinforcements
    if (lv > 0 && time >= startT && time >= nextSpawn && ps.length < Math.min(MAXCOPS, lv)) {
      let lapini = 0; for (const v of ps) if (v.ty.model === 'apePol') lapini++;
      const name = lv >= 2 && lapini === 0 && Math.random() < 0.28 ? 'apePol' : Math.random() < 0.5 ? 'polizia' : 'carab';
      const v = T.spawnCop(name, 70, 135, true);
      if (v) { makeCop(v, true); nextSpawn = time + 2.2; }
    }
    for (const v of ps) { // lost far behind and out of sight: replace with a closer one
      if (hyp(v.x - car.x, v.z - car.z) > 280 && !T.inView(v.x, 1, v.z, 4)) T.removeVehicle(v);
    }
    // a couple of patrol cars in the normal traffic when all is calm
    if (lv === 0 && busted <= 0 && time >= nextPatrol) {
      nextPatrol = time + (25 + Math.random() * 30) * PF;
      let n = 0; for (const v of vs) if (v.cop) n++;
      stat.rolls++;
      if (Math.random() < PATROL[dangerAt(car.x, car.z) - 1]) {   // fewer patrols the more dangerous the area (src/danger.js)
        stat.passes++;
        if (n < 2) { const v = T.spawnCop(Math.random() < 0.5 ? 'polizia' : 'carab', 90, 200); if (v) { makeCop(v, false); stat.spawns++; } }
      }
    }
  }
  const LB = { polizia: [0, 1.62, 0.32], carab: [0, 1.62, 0.32], apePol: [0.42, 1.78, 0.3] }; // [z, height, half width] of the light bar per model
  function glow(fx) {
    const pulse = night ? 1 : 0.65, size = night ? 2.6 : 1.9;
    for (const v of vs) {
      const c = v.cop; if (!c || !c.pursue) continue;
      const lb = LB[v.ty.model]; if (!lb) continue;
      const ph = Math.floor((time * 6 + c.id * 0.37) % 2) === 0, sn = Math.sin(v.h), cs = Math.cos(v.h), y = T.groundY(v.x, v.z) + lb[1] + (v.fly ? v.fly.y : 0);
      if (v.fly) continue;
      const side = (ph ? 1 : -1) * lb[2], zo = lb[0];
      fx.add(v.x + sn * zo + cs * side, y, v.z + cs * zo - sn * side, ph ? 0.2 : 1, ph ? 0.4 : 0.15, ph ? 1 : 0.15, size * pulse * 1.15);
      fx.add(v.x + sn * zo - cs * side * 0.2, y - 0.02, v.z + cs * zo + sn * side * 0.2, ph ? 0.1 : 0.5, ph ? 0.15 : 0.1, ph ? 0.6 : 0.1, size * 0.45 * pulse);
    }
  }

  function update(dt, fx) {
    time += dt;
    // back on the menu the chase is over: no wanted line and no siren behind the title screen, and nothing waiting on the next drive
    if (heat > 0 && document.documentElement.classList.contains('pd-title')) { heat = 0; armed = false; bustT = 0; seen = false; unseenT = 0; toastT = 0; for (const v of pursuers()) disengage(v); }
    if (toastT > 0) toastT -= dt;
    if (busted > 0) { busted -= dt; if (busted <= 0) card.classList.remove('on'); }
    if (grace > 0) grace -= dt;
    tickT += dt;
    if (tickT >= 0.25) { const d = tickT; tickT = 0; tick(d); }
    // siren: the nearest chasing car sets the volume and the pan
    let near = 1e9, pan = 0;
    if (heat > 0) for (const v of vs) {
      if (!v.cop || !v.cop.pursue || v.fly) continue;
      const d = hyp(v.x - camera.position.x, v.z - camera.position.z);
      if (d < near) { near = d; const rx = Math.cos(camera.rotation.y), rz = -Math.sin(camera.rotation.y); pan = ((v.x - camera.position.x) * rx + (v.z - camera.position.z) * rz) / (d + 8); }
    }
    sirenUpdate(near, pan);
    glow(fx);
    drawHud();
  }
  // the lapa is frozen while the busted card is up (120 Hz hook from traffic.collidePlayer)
  function collide(pc) { if (busted > 0) { pc.vx = pc.vz = pc.w = pc.vf = 0; } }

  if (location.search.includes('debug')) window.pdPolice = { stat, vs, chaos, level };   // test hook
  return {
    update, drive, chaos, collide, isCop, makeCop, engage,
    stat, heat: () => heat, level, isNight: () => night,
    bindPedestrians(api) { peds = api; api.onKnock?.(() => chaos('knock')); },
    setVolume(v) { au.vol = clamp(+v || 0, 0, 1); if (au.master) au.master.gain.value = au.vol * 0.16; },
  };
}
