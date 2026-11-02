// The curva throws things at the lapa (src/stadium.js): while the lapa is on the pitch, fans in the stands lob tomatoes and oranges at it. Each one flies from a real seat (crowdState.seats of
// src/stadium-crowd.js) in an arc toward where the lapa is or is heading, with some scatter, so some burst on the grass (a splat that stays for a while and a few flecks of juice) and some land: a wet
// splat with flecks, a red or orange stain on the lapa's body that shrinks and dries away, a soft thud (Web Audio on the radio's context, with the Options volume, like src/city-audio.js: two pooled
// voices made when first needed and let go after the lapa has been away a while) and now and then a splat on the screen that slides off (a DOM element out of a pool of three, CSS animation). It starts
// gently and builds the longer the lapa stays; doughnuts and kicking the ball make the stands angrier (anger()). It does not hurt the lapa or cost anything.
// Cheap: one InstancedMesh of squashed or round spheres for the fruit, the flecks and the splats on the ground (one draw call, 92 instances, no shadows), one for the stains, parented to the lapa's rig
// (one more, only while there are stains); nothing is made per frame; nothing runs, and nothing is drawn, while the lapa is away from the pitch.
// createFruit({ scene, camera, car, groundY, getRadio, seats, vehicle, onHit }) -> { update(dt, on), anger(k), reset(), debug }   seats(): [[x, y, z], ...]; vehicle: src/vehicle.js (its rig, for the stains); onHit(): a fruit landed on the lapa
import * as THREE from 'three';
import { PITCH_Y } from './stadium-ground.js';

const NF = 24, NK = 48, NG = 20, NS = 10, N = NF + NK + NG;   // fruit in the air, flecks of juice, splats on the grass, stains on the lapa
const SURF = PITCH_Y + 0.2, G = 9.8, STAY_FULL = 80;           // the grass, gravity, seconds on the pitch until the stands are at full tilt
const TOMATO = [0.74, 0.07, 0.05], ORANGE = [0.96, 0.48, 0.05];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const UP = new THREE.Vector3(0, 1, 0);

const CSS = `
.st-splat { position: fixed; z-index: 54; left: var(--x); top: var(--y); width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2); pointer-events: none; display: none; will-change: transform, opacity;
  background: radial-gradient(circle at 50% 50%, var(--c) 0 31%, transparent 33%), radial-gradient(circle at 22% 30%, var(--c) 0 7%, transparent 8.5%), radial-gradient(circle at 80% 24%, var(--c) 0 5%, transparent 6.5%),
    radial-gradient(circle at 74% 78%, var(--c) 0 8%, transparent 9.5%), radial-gradient(circle at 16% 72%, var(--c) 0 4%, transparent 5.5%), radial-gradient(circle at 50% 50%, var(--c) 0 44%, transparent 46%); filter: blur(.6px) drop-shadow(0 0 4px rgba(50,0,0,.45)); }
.st-splat::after { content: ''; position: absolute; left: 44%; top: 46%; width: 12%; height: 62%; border-radius: 0 0 50% 50%; background: linear-gradient(var(--c) 55%, transparent); transform-origin: 50% 0; transform: scaleY(0); }
.st-splat.on { display: block; animation: st-splat 4.4s cubic-bezier(.4,0,.9,.7) forwards; }
.st-splat.on::after { animation: st-drip 4.4s ease-in forwards; }
@keyframes st-splat { 0% { transform: scale(.25); opacity: 0; } 4% { transform: scale(1.18); opacity: .95; } 10% { transform: scale(1); opacity: .95; } 62% { opacity: .85; } 100% { transform: translateY(var(--slide)) scale(.9, 1.3); opacity: 0; } }
@keyframes st-drip { 0% { transform: scaleY(0); } 15% { transform: scaleY(.2); } 100% { transform: scaleY(1.7); } }
html.pd-title .st-splat { display: none !important; }
`;

export function createFruit({ scene, camera, car, groundY, getRadio, seats, vehicle, onHit }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const splats = Array.from({ length: 3 }, () => { const e = document.createElement('div'); e.className = 'st-splat'; document.body.appendChild(e); return e; });

  // ---- one InstancedMesh: [0, NF) fruit, [NF, NF + NK) flecks, [NF + NK, N) splats on the grass
  const geo = new THREE.SphereGeometry(1, 12, 6), mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; mesh.visible = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const A = mesh.instanceMatrix.array, C = mesh.instanceColor.array;
  function put(i, x, y, z, sx, sy, sz, yaw) {
    const o = i * 16, c = Math.cos(yaw), s = Math.sin(yaw);
    A[o] = c * sx; A[o + 1] = 0; A[o + 2] = -s * sx; A[o + 3] = 0; A[o + 4] = 0; A[o + 5] = sy; A[o + 6] = 0; A[o + 7] = 0; A[o + 8] = s * sz; A[o + 9] = 0; A[o + 10] = c * sz; A[o + 11] = 0; A[o + 12] = x; A[o + 13] = y; A[o + 14] = z; A[o + 15] = 1;
  }
  const tint = (i, c, k) => { C[i * 3] = c[0] * k; C[i * 3 + 1] = c[1] * k; C[i * 3 + 2] = c[2] * k; };
  for (let i = 0; i < N; i++) put(i, 0, -999, 0, 0, 0, 0, 0);

  const F = { x: new Float32Array(NF), y: new Float32Array(NF), z: new Float32Array(NF), vx: new Float32Array(NF), vy: new Float32Array(NF), vz: new Float32Array(NF), r: new Float32Array(NF), c: new Uint8Array(NF), on: new Uint8Array(NF) };
  const K = { x: new Float32Array(NK), y: new Float32Array(NK), z: new Float32Array(NK), vx: new Float32Array(NK), vy: new Float32Array(NK), vz: new Float32Array(NK), s: new Float32Array(NK), t: new Float32Array(NK) };
  const P = { x: new Float32Array(NG), z: new Float32Array(NG), r: new Float32Array(NG), a: new Float32Array(NG), yaw: new Float32Array(NG), t: new Float32Array(NG), c: new Uint8Array(NG) };   // t: seconds left
  let nk = 0, np = 0, live = 0;   // live: things in the mesh (a fruit, a fleck, a splat)

  // ---- the stains on the lapa: squashed spheres in the rig's own frame, so they ride on the body (a second InstancedMesh, in the scene only while there are stains)
  const smat = new THREE.MeshLambertMaterial(), stain = new THREE.InstancedMesh(geo, smat, NS); stain.frustumCulled = false; stain.count = 0;
  stain.instanceMatrix.setUsage(THREE.DynamicDrawUsage); stain.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NS * 3), 3); stain.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const S = { p: new THREE.Vector3(), px: new Float32Array(NS), py: new Float32Array(NS), pz: new Float32Array(NS), q: Array.from({ length: NS }, () => new THREE.Quaternion()), r: new Float32Array(NS), asp: new Float32Array(NS), t: new Float32Array(NS), c: new Uint8Array(NS), on: new Uint8Array(NS) };
  let ns = 0, rigOf = null; const col = new THREE.Color(), m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), qs = new THREE.Quaternion(), one = new THREE.Vector3(), ray = new THREE.Raycaster();
  const STAIN_LIFE = 20;

  // ---- state of the barrage
  let stay = 0, next = 2.5, away = 0, anger = 0, splatT = 0, splatI = 0, hits = 0, thrown = 0, splatAt = -99;
  const dirV = new THREE.Vector3(), tri = w => (Math.random() + Math.random() - 1) * w;
  const colOf = c => c ? ORANGE : TOMATO;

  // ---- the thud and the squelch: two pooled voices on the radio's context
  let ctx = null, voices = null, master = null, vi = 0, idle = 0;
  function build() {
    const r = getRadio(), c = r && r.context; if (!c || c.state !== 'running') return false;
    ctx = c; master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const nb = ctx.createBuffer(1, Math.round(ctx.sampleRate), ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    voices = Array.from({ length: 2 }, () => {
      const o = ctx.createOscillator(), og = ctx.createGain(), n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.type = 'sine'; o.frequency.value = 80; og.gain.value = 0; n.buffer = nb; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; ng.gain.value = 0;
      o.connect(og); n.connect(bp); bp.connect(ng); if (p) { og.connect(p); ng.connect(p); p.connect(master); } else { og.connect(master); ng.connect(master); }
      o.start(); n.start(0, Math.random() * 0.8);
      return { o, og, n, bp, ng, p };
    });
    return true;
  }
  function teardown() {
    if (!voices) return;
    for (const v of voices) { try { v.o.stop(); v.n.stop(); } catch (e) { /* stopped */ } v.o.disconnect(); v.n.disconnect(); v.og.disconnect(); v.bp.disconnect(); v.ng.disconnect(); if (v.p) v.p.disconnect(); }
    master.disconnect(); voices = null; master = null; ctx = null;
  }
  function thud(x, z, power) {   // power 0..1: 1 for a fruit on the lapa, less for a splat on the grass
    if (!ctx && !build()) return;
    if (ctx.state !== 'running') return;
    const r = getRadio(), vol = r ? r.sfxVolume : 0.8, dk = r && Number.isFinite(r.duck) ? r.duck : 1; if (vol <= 0.001 || power <= 0.02) return;
    const t = ctx.currentTime, v = voices[vi]; vi = (vi + 1) % voices.length; idle = 0;
    master.gain.setTargetAtTime(clamp(vol, 0, 1) * dk * 0.5, t, 0.02);
    const e = camera.matrixWorld.elements, dx = x - camera.position.x, dz = z - camera.position.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
    if (v.p) v.p.pan.setTargetAtTime(clamp((dx * e[0] + dz * e[2]) / d, -1, 1), t, 0.01);
    const body = 140 + Math.random() * 60;
    v.o.frequency.cancelScheduledValues(t); v.o.frequency.setValueAtTime(body, t); v.o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    v.og.gain.cancelScheduledValues(t); v.og.gain.setValueAtTime(0, t); v.og.gain.linearRampToValueAtTime(0.9 * power, t + 0.004); v.og.gain.setTargetAtTime(0, t + 0.008, 0.045);
    v.bp.frequency.cancelScheduledValues(t); v.bp.frequency.setValueAtTime(1100 + Math.random() * 500, t); v.bp.frequency.exponentialRampToValueAtTime(320, t + 0.16);
    v.ng.gain.cancelScheduledValues(t); v.ng.gain.setValueAtTime(0, t); v.ng.gain.linearRampToValueAtTime(0.55 * power, t + 0.004); v.ng.gain.setTargetAtTime(0, t + 0.01, 0.055);
  }

  // ---- bits of juice, a splat on the grass, a stain on the lapa, a splat on the screen
  function fleck(x, y, z, vx, vy, vz, size, c) {
    const i = nk; nk = (nk + 1) % NK; const k = NF + i;
    if (K.t[i] <= 0) live++;
    K.x[i] = x; K.y[i] = y; K.z[i] = z; K.vx[i] = vx; K.vy[i] = vy; K.vz[i] = vz; K.s[i] = size; K.t[i] = 0.45 + Math.random() * 0.45; tint(k, colOf(c), 0.7 + Math.random() * 0.4);
  }
  function burst(x, y, z, c, n, speed, vx, vz) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.2832, sp = speed * (0.35 + Math.random() * 0.65); fleck(x, y, z, Math.cos(a) * sp + vx, 1.5 + Math.random() * speed * 0.7, Math.sin(a) * sp + vz, 0.04 + Math.random() * 0.06, c); }
  }
  function grassSplat(x, z, c) {
    const i = np; np = (np + 1) % NG; if (P.t[i] <= 0) live++;
    P.x[i] = x; P.z[i] = z; P.r[i] = 0.35 + Math.random() * 0.4; P.a[i] = 0.6 + Math.random() * 0.4; P.yaw[i] = Math.random() * 6.2832; P.t[i] = 28 + Math.random() * 6; P.c[i] = c; tint(NF + NK + i, colOf(c), 0.85 + Math.random() * 0.2);
  }
  function stainLapa(c, dx, dy, dz) {   // a stain where the fruit struck: a ray from the side it came from at the body, the first thing it meets (the rig's meshes), put on in the rig's own frame
    const rig = vehicle && vehicle.rig; if (!rig) return;
    if (rigOf !== rig) { if (stain.parent) stain.parent.remove(stain); rigOf = rig; ns = 0; stain.count = 0; S.t.fill(0); S.on.fill(0); }
    const base = groundY(car.x, car.z) + (car.lift || 0) + (car.hop || 0), l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    v3.set(car.x + tri(0.5), base + 0.9 + tri(0.45), car.z + tri(0.5)); v3b.set(dx / l, dy / l, dz / l);
    ray.set(v3.addScaledVector(v3b, -3), v3b); ray.camera = camera;
    const hs = ray.intersectObject(rig.tilt, true); let h = null; for (const x of hs) if (x.object !== stain && x.face) { h = x; break; }
    if (!h) return;
    rig.tilt.updateWorldMatrix(true, false);
    const i = ns; ns = (ns + 1) % NS; if (stain.count < NS) stain.count++;
    S.p.copy(h.point); rig.tilt.worldToLocal(S.p); v3.copy(h.face.normal).transformDirection(h.object.matrixWorld).transformDirection(m4.copy(rig.tilt.matrixWorld).invert());
    S.px[i] = S.p.x + v3.x * 0.012; S.py[i] = S.p.y + v3.y * 0.012; S.pz[i] = S.p.z + v3.z * 0.012;
    S.q[i].setFromUnitVectors(UP, v3).multiply(qs.setFromAxisAngle(UP, Math.random() * 6.2832));
    S.r[i] = 0.2 + Math.random() * 0.18; S.asp[i] = 0.65 + Math.random() * 0.35; S.t[i] = STAIN_LIFE; S.c[i] = c; S.on[i] = 1;
    if (stain.parent !== rig.tilt) rig.tilt.add(stain);
  }
  function stains(dt) {
    let any = false;
    for (let i = 0; i < stain.count; i++) {
      if (S.t[i] <= 0) { if (S.on[i]) { S.on[i] = 0; stain.setMatrixAt(i, m4.makeScale(0, 0, 0)); } continue; }
      S.t[i] -= dt; any = true;
      const k = clamp(S.t[i] / 8, 0, 1), sc = S.r[i] * (0.35 + 0.65 * k), c = colOf(S.c[i]), d = 0.55 + 0.45 * k;   // dries up (darker) and shrinks over its last eight seconds
      one.set(sc, 0.02, sc * S.asp[i]); stain.setMatrixAt(i, m4.compose(v3.set(S.px[i], S.py[i], S.pz[i]), S.q[i], one)); stain.setColorAt(i, col.setRGB(c[0] * d, c[1] * d, c[2] * d));
    }
    stain.instanceMatrix.needsUpdate = true; stain.instanceColor.needsUpdate = true;
    if (!any) { stain.parent.remove(stain); stain.count = 0; ns = 0; }
  }
  function screenSplat(c) {
    if (splatT > 0) return; splatT = 3.5;
    const e = splats[splatI]; splatI = (splatI + 1) % splats.length;
    const s = 16 + Math.random() * 12, col = c ? 'rgba(238,122,14,.9)' : 'rgba(190,24,18,.9)';
    e.style.setProperty('--x', (22 + Math.random() * 56).toFixed(1) + '%'); e.style.setProperty('--y', (14 + Math.random() * 38).toFixed(1) + '%'); e.style.setProperty('--s', s.toFixed(1) + 'vh');
    e.style.setProperty('--c', col); e.style.setProperty('--slide', (14 + Math.random() * 14).toFixed(1) + 'vh');
    e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); splatAt = performance.now();
  }

  // ---- one fruit from a seat toward the lapa
  function lob(sp) {
    const seatList = seats(); if (!seatList.length) return;
    camera.getWorldDirection(dirV);
    let seat = null;
    for (let k = 0; k < 6; k++) {   // a seat 16 to 95 m away, one in front of the camera when there is one
      const s = seatList[(Math.random() * seatList.length) | 0], dx = s[0] - car.x, dz = s[2] - car.z, d2 = dx * dx + dz * dz;
      if (d2 < 256 || d2 > 9025) continue;
      seat = s; if ((s[0] - camera.position.x) * dirV.x + (s[2] - camera.position.z) * dirV.z > 0) break;
    }
    if (!seat) return;
    let i = 0; while (i < NF && F.on[i]) i++; if (i === NF) return;
    const dx = car.x - seat[0], dz = car.z - seat[2], d = Math.sqrt(dx * dx + dz * dz), T = clamp(d / 22, 0.9, 2.8), sc = 0.9 + d * 0.028 + sp * 0.11;
    const tx = car.x + car.vx * T * 0.85 + tri(sc), tz = car.z + car.vz * T * 0.85 + tri(sc), ty = groundY(car.x, car.z) + 1 + Math.random() * 0.4;
    F.x[i] = seat[0]; F.y[i] = seat[1]; F.z[i] = seat[2]; F.vx[i] = (tx - seat[0]) / T; F.vz[i] = (tz - seat[2]) / T; F.vy[i] = (ty - seat[1] + 0.5 * G * T * T) / T;
    F.c[i] = Math.random() < 0.5 ? 1 : 0; F.r[i] = F.c[i] ? 0.27 : 0.24; F.on[i] = 1; live++; tint(i, colOf(F.c[i]), 1); thrown++;   // a little bigger than the real thing, so it can be seen coming
  }

  function update(dt, on) {
    if (!on && !live && !stay) { if (ctx && (idle += dt) > 20) teardown(); return; }   // nothing to do outside the stadium (the voices are let go after a while)
    dt = Math.min(dt, 0.05);
    if (splatT > 0) splatT -= dt;
    if (on) {
      away = 0; stay += dt; anger = Math.max(0, anger - dt * 0.04);
      const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz), level = clamp(clamp(stay / STAY_FULL, 0, 1) * 0.75 + anger * 0.6, 0, 1);   // 0 the first moments, 1 after a minute and a bit (or a doughnut or two)
      if ((next -= dt) <= 0) { lob(sp); next = (1 / (0.3 + 3.2 * level)) * (0.6 + Math.random() * 0.8); }
    } else if (stay > 0 || live) {
      if ((away += dt) > 2.5) { reset(); return; }   // the lapa has gone: the stands stop, and what is left is cleared
    }
    // fruit
    const sn = Math.sin(car.th), cs = Math.cos(car.th), base = groundY(car.x, car.z) + (car.lift || 0) + (car.hop || 0);
    for (let i = 0; i < NF; i++) {
      if (!F.on[i]) continue;
      F.vy[i] -= G * dt; F.x[i] += F.vx[i] * dt; F.y[i] += F.vy[i] * dt; F.z[i] += F.vz[i] * dt;
      const dx = F.x[i] - car.x, dz = F.z[i] - car.z, along = dx * sn + dz * cs, side = dx * cs - dz * sn;
      if (along > -1.6 && along < 1.6 && side > -0.85 && side < 0.85 && F.y[i] > base - 0.1 && F.y[i] < base + 2.0) {   // on the lapa
        F.on[i] = 0; live--; put(i, 0, -999, 0, 0, 0, 0, 0); hits++;
        burst(F.x[i], F.y[i], F.z[i], F.c[i], 9, 3.2, car.vx * 0.5, car.vz * 0.5);
        stainLapa(F.c[i], F.vx[i], F.vy[i], F.vz[i]); if (Math.random() < 0.35) stainLapa(F.c[i], F.vx[i] + tri(2), F.vy[i], F.vz[i] + tri(2));
        thud(F.x[i], F.z[i], 1); if (Math.random() < 0.3) screenSplat(F.c[i]); if (onHit) onHit();
        continue;
      }
      if (F.vy[i] < 0 && F.y[i] <= SURF + F.r[i]) {   // on the grass
        F.on[i] = 0; live--; put(i, 0, -999, 0, 0, 0, 0, 0);
        burst(F.x[i], SURF + 0.1, F.z[i], F.c[i], 6, 2.4, 0, 0); grassSplat(F.x[i], F.z[i], F.c[i]);
        const ex = F.x[i] - camera.position.x, ez = F.z[i] - camera.position.z, d = Math.sqrt(ex * ex + ez * ez); if (d < 40) thud(F.x[i], F.z[i], 0.32 * (1 - d / 40));
        continue;
      }
      const cx = F.x[i] - camera.position.x, cz = F.z[i] - camera.position.z, r = F.r[i] * (1 + Math.min(1.2, Math.sqrt(cx * cx + cz * cz) / 50));   // drawn bigger the further it is, so a fruit coming from the far stand can still be seen
      put(i, F.x[i], F.y[i], F.z[i], r, r, r, 0);
    }
    // flecks
    for (let i = 0; i < NK; i++) {
      if (K.t[i] <= 0) continue;
      K.t[i] -= dt; K.vy[i] -= G * dt; K.x[i] += K.vx[i] * dt; K.y[i] += K.vy[i] * dt; K.z[i] += K.vz[i] * dt;
      if (K.t[i] <= 0 || K.y[i] < SURF) { K.t[i] = 0; live--; put(NF + i, 0, -999, 0, 0, 0, 0, 0); continue; }
      const s = K.s[i]; put(NF + i, K.x[i], K.y[i], K.z[i], s, s, s, 0);
    }
    // splats on the grass: flat, drying and shrinking over their last six seconds
    for (let i = 0; i < NG; i++) {
      if (P.t[i] <= 0) continue;
      P.t[i] -= dt; const k = NF + NK + i;
      if (P.t[i] <= 0) { live--; put(k, 0, -999, 0, 0, 0, 0, 0); continue; }
      const f = clamp(P.t[i] / 6, 0, 1), r = P.r[i] * (0.5 + 0.5 * f); put(k, P.x[i], SURF + 0.02, P.z[i], r, 0.02, r * P.a[i], P.yaw[i]);
    }
    if (stain.parent) stains(dt);
    mesh.visible = live > 0;
    if (live > 0) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }
  function reset() {
    F.on.fill(0); K.t.fill(0); P.t.fill(0); live = 0; stay = 0; next = 2.5; away = 0; anger = 0;
    for (let i = 0; i < N; i++) put(i, 0, -999, 0, 0, 0, 0, 0);
    mesh.visible = false; mesh.instanceMatrix.needsUpdate = true;
    S.t.fill(0); S.on.fill(0); if (stain.parent) stain.parent.remove(stain); stain.count = 0; ns = 0;
    for (const e of splats) e.classList.remove('on');
  }
  return { update, anger(k) { anger = Math.min(1, anger + k); }, reset, debug: { stainLapa, screenSplat, get stats() { return { stay, anger, thrown, hits, live, stains: stain.count, parented: !!stain.parent, voices: !!voices, splatAge: +((performance.now() - splatAt) / 1000).toFixed(2) }; }, lob, splats, thud, burst, F } };
}
