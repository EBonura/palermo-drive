// Game modes: "Turisti affamati" (tourist taxi runs to Palermo's eateries) and the stigghiulari (grill vendors with
// smoke plumes and nitro refills). Owned by the missions work.
//
// createMissions(env) -> { mode, setMode('free'|'turisti'), update(dt), stop() }
//   env: { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, shout, game, vehicle, pedestrians,
//          traffic, mapMarkers, placeAt, proj }
// Flow of Turisti: a pink ring with a light beam marks where tourists wait -> stop inside it (speed near zero), they walk
// over and hop into the back seat -> they name a place to eat -> drive there before the clock runs out and stop in the
// destination ring -> fare + tips (speed, drifts, near misses, two wheels, stigghiola) minus claims (pedestrians, walls).
// Speech uses env.shout (src/shouts.js). Lines and places live in assets/missions/lines.js (review copy: lines.md).
import * as THREE from 'three';
import { TOURIST, DRIVER, VENDOR, VENDOR_SERVE, DESTS, PICKUPS, VENDORS, NATIONS } from '../assets/missions/lines.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const eur = v => '€ ' + v.toFixed(2).replace('.', ',');
const BEST_KEY = 'palermoDrive.turisti.best.v1';

export function createMissions(env) {
  const api = { mode: 'free', setMode() {}, update() {}, stop() {} };
  try { return build(env); } catch (e) { console.error('[missions] disabled:', e); return api; }
}

function build(env) {
  const { scene, camera, car, groundY, raisedMask, CURB, walls2d, closestOnSeg, D, game, vehicle, pedestrians, traffic, mapMarkers, shout } = env;
  const mapRoute = env.mapRoute || [];
  const params = new URLSearchParams(location.search);
  const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian']);
  const groundAt = (x, z) => groundY(x, z) + (raisedMask(x, z) ? CURB : 0);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'it');
  const T = (it, en) => (lang() === 'en' ? en : it);
  const now = () => performance.now() / 1000;

  // ------------------------------------------------------------------------------------ places
  const segs = [];
  for (const r of D.roads) {
    if (!DRIVABLE.has(r.k)) continue;
    const p = r.p;
    for (let i = 0; i + 3 < p.length; i += 2) segs.push([p[i], p[i + 1], p[i + 2], p[i + 3], r.w || 6, r.k]);
  }
  // nearest point on a drivable centreline: { x, z, dx, dz (unit direction), w, d }
  function snapRoad(x, z) {
    let best = null, bd = Infinity;
    for (const s of segs) {
      const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz;
      const t = l2 ? clamp(((x - s[0]) * dx + (z - s[1]) * dz) / l2, 0, 1) : 0;
      const qx = s[0] + dx * t, qz = s[1] + dz * t, d = Math.hypot(x - qx, z - qz) + (s[5] === 'pedestrian' ? 4 : 0);
      if (d < bd) { bd = d; const l = Math.sqrt(l2) || 1; best = { x: qx, z: qz, dx: dx / l, dz: dz / l, w: s[4], d }; }
    }
    return best || { x, z, dx: 0, dz: 1, w: 6, d: 0 };
  }
  const wallDist = (x, z) => {
    let m = 3;
    walls2d.query(x - 3, z - 3, x + 3, z + 3, s => { const [qx, qz] = closestOnSeg(x, z, s); m = Math.min(m, Math.hypot(x - qx, z - qz)); });
    return m;
  };
  // a spot beside the road, on the side that is pavement (or at least not against a wall)
  function sideSpot(sn, off) {
    let best = null, bs = -Infinity;
    for (const s of [1, -1]) {
      const x = sn.x - sn.dz * s * off, z = sn.z + sn.dx * s * off;
      const sc = (raisedMask(x, z) ? 1.5 : 0) + Math.min(wallDist(x, z), 1.6);
      if (sc > bs) { bs = sc; best = { x, z, s, sc }; }
    }
    return best;
  }
  const place = (o, extra) => {
    const [vx, vz] = env.proj(o.lat, o.lon), sn = snapRoad(vx, vz);
    return { ...o, ...extra, vx, vz, x: sn.x, z: sn.z, road: sn };
  };
  const P_PLACES = PICKUPS.map(o => place(o));
  const D_PLACES = DESTS.map(o => place(o));

  // ------------------------------------------------------------------------------------ DOM: hud, toasts, card
  const css = document.createElement('style');
  css.textContent = `
  #pm-hud { position: fixed; z-index: 60; left: max(10px, env(safe-area-inset-left)); top: max(8px, env(safe-area-inset-top)); width: min(280px, 32vw);
    pointer-events: none; font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; display: none; text-transform: uppercase; }
  #pm-hud.on { display: block; }
  .pm-card { position: relative; display: flex; align-items: center; gap: 8px; padding: 5px 10px 9px 8px; background: linear-gradient(90deg, rgba(11,7,9,.8), rgba(40,12,28,.74));
    border-left: 5px solid #e8559a; transform: skewX(-6deg); box-shadow: 0 3px 12px rgba(0,0,0,.4); overflow: hidden; }
  .pm-card > * { transform: skewX(6deg); }
  .pm-arrow { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; background: rgba(232,85,154,.22); box-shadow: inset 0 0 0 2px #e8559a; display: flex; align-items: center; justify-content: center; }
  .pm-arrow svg { width: 22px; height: 22px; filter: drop-shadow(0 0 4px rgba(255,79,163,.9)); }
  .pm-body { flex: 1 1 auto; min-width: 0; }
  .pm-top { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; font-size: 10px; letter-spacing: .16em; color: #f5a9c9; }
  .pm-time { font: 400 17px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; color: #fff; }
  .pm-time.low { color: #ff6a5a; animation: pm-blink .5s steps(2) infinite; }
  .pm-place { font-weight: 700; font-size: 15px; line-height: 1.05; letter-spacing: .05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pm-sub { font-weight: 600; font-size: 10px; letter-spacing: .1em; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pm-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,.12); transform: none !important; }
  .pm-bar i { display: block; height: 100%; width: 100%; transform-origin: left; background: linear-gradient(90deg, #f5a9c9, #e8559a); }
  .pm-bar.low i { background: #ff4a3a; }
  .pm-ledger { margin: 4px 0 0 6px; display: flex; gap: 8px; align-items: baseline; font-weight: 700; font-size: 11px; letter-spacing: .1em; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
  .pm-fare { font: 400 16px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .03em; color: #fff; text-shadow: 0 0 8px #e8559a, 0 1px 3px rgba(0,0,0,.8); }
  .pm-pos { color: #ffd1e6; } .pm-neg { color: #ff8a7a; } .pm-total { color: #f5a9c9; margin-left: auto; }
  .pm-toasts { position: fixed; z-index: 61; left: 50%; top: 30%; transform: translateX(-50%); pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
  .pm-toast { font-size: clamp(16px, 3.6vh, 26px); letter-spacing: .06em; text-transform: uppercase; color: #fff; -webkit-text-stroke: 1.5px #0b0709; paint-order: stroke fill;
    text-shadow: 0 0 14px #e8559a, 0 3px 6px rgba(0,0,0,.6); animation: pm-toast 1.9s ease-out forwards; transform: skewX(-8deg); }
  .pm-toast.neg { color: #ffb3a8; text-shadow: 0 0 14px #ff4a3a, 0 3px 6px rgba(0,0,0,.6); }
  .pm-toast small { display: block; font-size: .5em; letter-spacing: .14em; text-align: center; opacity: .9; }
  .pm-result { position: fixed; z-index: 62; left: 50%; top: 22%; transform: translate(-50%, 0) skewX(-6deg); min-width: min(300px, 60vw); padding: 10px 20px 12px; text-align: center;
    background: linear-gradient(180deg, rgba(11,7,9,.9), rgba(60,14,40,.88)); border: 2px solid #e8559a; box-shadow: 0 0 30px rgba(232,85,154,.5);
    font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; pointer-events: none; opacity: 0; transition: opacity .35s; }
  .pm-result.on { opacity: 1; }
  .pm-result > * { transform: skewX(6deg); }
  .pm-result h3 { margin: 0 0 6px; font: 400 clamp(18px, 4.2vh, 28px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; color: #fff; text-shadow: 0 0 12px #e8559a; }
  .pm-result .row { display: flex; justify-content: space-between; gap: 24px; font-weight: 600; font-size: clamp(12px, 2.6vh, 16px); letter-spacing: .12em; }
  .pm-result .tot { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.3); font-size: clamp(15px, 3.4vh, 22px); font-weight: 700; color: #f5a9c9; }
  .pm-confetti { position: fixed; z-index: 63; left: 50%; top: 52%; width: 0; height: 0; pointer-events: none; }
  .pm-confetti i { position: absolute; left: 0; top: 0; width: 9px; height: 14px; animation: pm-conf 1.2s cubic-bezier(.2,.7,.3,1) forwards; }
  @keyframes pm-conf { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
  @keyframes pm-toast { 0% { opacity: 0; transform: translateY(14px) scale(.7) skewX(-8deg); } 12% { opacity: 1; transform: translateY(0) scale(1.08) skewX(-8deg); } 20% { transform: scale(1) skewX(-8deg); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-24px) skewX(-8deg); } }
  @keyframes pm-blink { 50% { opacity: .35; } }
  .pm-flash { position: fixed; inset: 0; z-index: 59; pointer-events: none; background: radial-gradient(ellipse at 50% 60%, rgba(255,160,60,.0), rgba(255,120,40,.45)); opacity: 0; }
  .pm-flash.on { animation: pm-flash .7s ease-out; }
  @keyframes pm-flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
  @media (max-height: 520px) { #pm-hud { width: min(250px, 30vw); } .pm-arrow { width: 30px; height: 30px; } .pm-place { font-size: 13px; } .pm-card { padding: 4px 8px 8px 6px; } }
  `;
  document.head.appendChild(css);
  const mkEl = (cls, html, parent = document.body, tag = 'div') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; };
  const hud = mkEl('', `<div class="pm-card">
      <div class="pm-arrow"><svg viewBox="0 0 24 24"><path d="M12 1.5 L21 20 L12 15.5 L3 20 Z" fill="#ff4fa3" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
      <div class="pm-body"><div class="pm-top"><span class="pm-lab"></span><span class="pm-time"></span></div><div class="pm-place"></div><div class="pm-sub"></div></div>
      <div class="pm-bar"><i></i></div></div>
    <div class="pm-ledger"><span class="pm-fare"></span><span class="pm-pos"></span><span class="pm-neg"></span><span class="pm-total"></span></div>`);
  hud.id = 'pm-hud';
  const elArrow = hud.querySelector('.pm-arrow svg'), elLab = hud.querySelector('.pm-lab'), elTime = hud.querySelector('.pm-time'), elPlace = hud.querySelector('.pm-place'),
    elSub = hud.querySelector('.pm-sub'), elBar = hud.querySelector('.pm-bar'), elBarI = elBar.querySelector('i'), elFare = hud.querySelector('.pm-fare'),
    elPos = hud.querySelector('.pm-pos'), elNeg = hud.querySelector('.pm-neg'), elTot = hud.querySelector('.pm-total');
  const toastBox = mkEl('pm-toasts'), result = mkEl('pm-result'), confetti = mkEl('pm-confetti'), flash = mkEl('pm-flash');
  function toast(text, sub, neg) {
    const e = mkEl('pm-toast' + (neg ? ' neg' : ''), esc(text) + (sub ? `<small>${esc(sub)}</small>` : ''), toastBox);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    setTimeout(() => e.remove(), 1950);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function burst() {
    const cols = ['#e8559a', '#f5a9c9', '#ffd24a', '#fff4e0', '#6bbf59', '#ff8a3a'];
    for (let i = 0; i < 30; i++) {
      const e = mkEl('', '', confetti, 'i'), a = rand(0, TAU), d = rand(90, 260);
      e.style.background = pick(cols);
      e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', (Math.sin(a) * d * 0.7 - 80) + 'px'); e.style.setProperty('--rot', rand(-540, 540) + 'deg');
      setTimeout(() => e.remove(), 1300);
    }
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  }
  let resultTimer = 0;
  function showResult(html, secs) { result.innerHTML = html; result.classList.add('on'); resultTimer = secs; }

  // ------------------------------------------------------------------------------------ speech (env.shout)
  const talkQ = []; let talkClock = 0, lastTalk = -9;
  // lines: array of strings or [text, gloss]; pos(): { x, y, z } anchor, delay in seconds
  function say(line, pos, delay = 0) {
    if (!shout || !line) return;
    talkQ.push({ at: talkClock + delay, text: Array.isArray(line) ? line[0] : line, pos });
  }
  function updateTalk(dt) {
    talkClock += dt;
    if (!talkQ.length || talkClock - lastTalk < 0.55) return;
    const i = talkQ.findIndex(q => q.at <= talkClock);
    if (i < 0) return;
    const q = talkQ.splice(i, 1)[0];
    if (talkClock - q.at > 5) return;
    const p = q.pos();
    shout(p.x, p.y, p.z, q.text);
    lastTalk = talkClock;
  }
  const driverPos = () => ({ x: car.x, y: groundY(car.x, car.z) + car.lift - 0.3, z: car.z });
  const seatPos = () => ({ x: car.x, y: groundY(car.x, car.z) + car.lift - 0.1, z: car.z });

  // ------------------------------------------------------------------------------------ beacons: ground ring + light beam
  const RING_V = `attribute vec2 aP; varying vec2 vP; void main() { vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const RING_F = `uniform float uTime; uniform vec3 uCol; uniform float uAlpha; varying vec2 vP;
    void main() {
      float r = length(vP);
      float rim = smoothstep(0.84, 0.9, r) * (1.0 - smoothstep(0.985, 1.0, r));
      float halo = exp(-max(r - 1.0, 0.0) * 9.0) * step(1.0, r);
      float inner = 1.0 - smoothstep(0.0, 0.86, r);
      float wave = 0.5 + 0.5 * sin(uTime * 3.2 - r * 7.0);
      float rip = smoothstep(0.045, 0.0, abs(r - (0.2 + 0.7 * fract(uTime * 0.55)))) * 0.55 * (1.0 - fract(uTime * 0.55));
      float a = rim * 0.95 + halo * (0.45 + 0.25 * wave) + inner * (0.14 + 0.10 * wave) + rip;
      vec3 c = mix(uCol, vec3(1.0), clamp(rim * 0.55 + halo * 0.25 + rip, 0.0, 1.0));
      gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uAlpha);
      #include <colorspace_fragment>
    }`;
  const BEAM_V = `varying float vH; void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const BEAM_F = `uniform float uTime; uniform vec3 uCol; uniform float uAlpha; varying float vH;
    void main() {
      float a = smoothstep(0.0, 0.12, vH) * pow(1.0 - vH, 1.2) * 0.55 * (0.8 + 0.2 * sin(uTime * 2.0 + vH * 9.0));
      gl_FragColor = vec4(uCol, a * uAlpha);
      #include <colorspace_fragment>
    }`;
  const beacons = [];
  function makeBeacon(col, R, opt = {}) {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const seg = 44, fr = [0, 0.35, 0.7, 0.88, 0.96, 1.0, 1.06, 1.2, 1.4], nv = 1 + (fr.length - 1) * seg;
    const pos = new Float32Array(nv * 3), ap = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i < fr.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, f = fr[i + 1];
      ap[(1 + i * seg + j) * 2] = Math.cos(a) * f; ap[(1 + i * seg + j) * 2 + 1] = Math.sin(a) * f;
      const j2 = (j + 1) % seg, v0 = i === 0 ? 0 : 1 + (i - 1) * seg, a0 = i === 0 ? 0 : v0 + j, a1 = i === 0 ? 0 : v0 + j2, b0 = 1 + i * seg + j, b1 = 1 + i * seg + j2;
      if (i === 0) idx.push(0, b1, b0); else idx.push(a0, a1, b1, a0, b1, b0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aP', new THREE.BufferAttribute(ap, 2)); geo.setIndex(idx);
    const u = { uTime: { value: 0 }, uCol: { value: new THREE.Color(col) }, uAlpha: { value: 1 } };
    const ring = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_V, fragmentShader: RING_F, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    ring.frustumCulled = false; ring.renderOrder = 3; group.add(ring);
    let beam = null;
    if (opt.beam !== false) {
      const H = opt.height || 90, bg = new THREE.CylinderGeometry(1.8, 1.3, H, 20, 1, true); bg.translate(0, H / 2, 0);
      beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: u, vertexShader: BEAM_V, fragmentShader: BEAM_F, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      beam.frustumCulled = false; beam.renderOrder = 4; group.add(beam);
    }
    const b = {
      x: 0, z: 0, R, group, u, ring, beam,
      set(x, z) {
        b.x = x; b.z = z;
        const p = geo.attributes.position.array;
        p.set([x, groundAt(x, z) + 0.14, z], 0);
        for (let i = 0; i < fr.length - 1; i++) for (let j = 0; j < seg; j++) {
          const a = (j / seg) * TAU, f = fr[i + 1], px = x + Math.cos(a) * f * R, pz = z + Math.sin(a) * f * R;
          p.set([px, groundAt(px, pz) + 0.14, pz], (1 + i * seg + j) * 3);
        }
        geo.attributes.position.needsUpdate = true;
        if (beam) beam.position.set(x, groundAt(x, z), z);
      },
      show(on) { group.visible = on; },
    };
    ring.onBeforeRender = () => { u.uTime.value = now() % 1000; };
    beacons.push(b);
    return b;
  }

  // ------------------------------------------------------------------------------------ route guidance: a mist trail on the road
  // Graph from the drivable centrelines (vertices that coincide are joined; one-ways ignored, it is Palermo). Dijkstra from the
  // lapa to the target, re-run when the target changes or the lapa leaves the route. The route is drawn as pink mist puffs rising off
  // the road ahead of the lapa, with a pulse travelling forward every couple of seconds, and as a line on the minimap (mapRoute).
  const G = { nodes: [], adj: [], main: null, edges: [] };
  {
    const id = new Map(), key = (x, z) => Math.round(x * 4) + ',' + Math.round(z * 4);
    const node = (x, z) => { const k = key(x, z); let i = id.get(k); if (i === undefined) { i = G.nodes.length; id.set(k, i); G.nodes.push([x, z]); G.adj.push([]); } return i; };
    for (const r of D.roads) {
      if (!DRIVABLE.has(r.k)) continue;
      const p = r.p, f = r.k === 'pedestrian' ? 1.3 : 1;
      let prev = node(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) {
        const n = node(p[i], p[i + 1]);
        if (n !== prev) { const w = Math.hypot(G.nodes[n][0] - G.nodes[prev][0], G.nodes[n][1] - G.nodes[prev][1]); G.adj[prev].push([n, w * f]); G.adj[n].push([prev, w * f]); G.edges.push(prev, n); }
        prev = n;
      }
    }
    // the biggest connected piece is the road network proper (small islands would make unreachable targets)
    const comp = new Int32Array(G.nodes.length).fill(-1), sizes = [];
    for (let s = 0; s < G.nodes.length; s++) {
      if (comp[s] >= 0) continue;
      let c = 0; const st = [s]; comp[s] = sizes.length;
      while (st.length) { const u = st.pop(); c++; for (const [v] of G.adj[u]) if (comp[v] < 0) { comp[v] = sizes.length; st.push(v); } }
      sizes.push(c);
    }
    let best = 0; sizes.forEach((c, i) => { if (c > sizes[best]) best = i; });
    G.main = comp.map(c => c === best);
  }
  // nearest edge (inside the main network) to a point: { a, b, x, z (the projection), da, db }
  function nearestEdge(x, z) {
    let best = null, bd = Infinity;
    for (let e = 0; e < G.edges.length; e += 2) {
      const a = G.edges[e], b = G.edges[e + 1]; if (!G.main[a]) continue;
      const A = G.nodes[a], B = G.nodes[b], dx = B[0] - A[0], dz = B[1] - A[1], l2 = dx * dx + dz * dz;
      const t = l2 ? clamp(((x - A[0]) * dx + (z - A[1]) * dz) / l2, 0, 1) : 0, qx = A[0] + dx * t, qz = A[1] + dz * t, d = Math.hypot(x - qx, z - qz);
      if (d < bd) { bd = d; best = { a, b, x: qx, z: qz, da: Math.hypot(qx - A[0], qz - A[1]), db: Math.hypot(qx - B[0], qz - B[1]) }; }
    }
    return best;
  }
  function findRoute(sx, sz, tx, tz) {
    const s = nearestEdge(sx, sz), t = nearestEdge(tx, tz); if (!s || !t) return null;
    const n = G.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), heap = [];
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    dist[s.a] = s.da; dist[s.b] = s.db; push(s.da, s.a); push(s.db, s.b);
    let bestCost = Infinity, endNode = -1;
    while (heap.length) {
      const [d, u] = pop(); if (d > dist[u]) continue; if (d >= bestCost) break;
      if (u === t.a && d + t.da < bestCost) { bestCost = d + t.da; endNode = u; }
      if (u === t.b && d + t.db < bestCost) { bestCost = d + t.db; endNode = u; }
      for (const [v, w] of G.adj[u]) { const nd = d + w; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(nd, v); } }
    }
    if (endNode < 0) return null;
    const path = []; for (let u = endNode; u >= 0; u = prev[u]) path.push(u);
    path.reverse();
    const pts = [s.x, s.z];
    for (const u of path) pts.push(G.nodes[u][0], G.nodes[u][1]);
    pts.push(tx, tz);
    return pts;
  }
  const route = { pts: null, cum: null, len: 0, cursor: 0, s0: 0, tx: 1e9, tz: 1e9, t: 0, cool: 0, check: 0 };
  function setRoute(pts) {
    route.pts = pts; route.cum = [0];
    for (let i = 2; i < pts.length; i += 2) route.cum.push(route.cum[route.cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
    route.len = route.cum[route.cum.length - 1]; route.cursor = 0; route.s0 = 0;
    mapRoute.length = 0;
    for (let i = 0; i < pts.length; i += 2) if (i === 0 || i === pts.length - 2 || (i >> 1) % 2 === 0) mapRoute.push([pts[i], pts[i + 1]]);
  }
  function clearRoute() { route.pts = null; route.tx = route.tz = 1e9; mapRoute.length = 0; mist.geometry.instanceCount = 0; }
  // position at arc length s along the route
  const _p = { x: 0, z: 0 };
  function routeAt(s) {
    const c = route.cum, pts = route.pts; let i = clamp(route.cursor, 0, c.length - 2);
    while (i > 0 && c[i] > s) i--;
    while (i < c.length - 2 && c[i + 1] < s) i++;
    const seg = c[i + 1] - c[i] || 1, u = clamp((s - c[i]) / seg, 0, 1);
    _p.x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * u; _p.z = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * u;
    return _p;
  }
  // mist puffs: camera-facing soft quads, pink, normal blending so they read on pale asphalt
  const MIST_N = 40, MIST_STEP = 3.4;
  const mistGeo = new THREE.InstancedBufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  mistGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); mistGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const mPos = new THREE.InstancedBufferAttribute(new Float32Array(MIST_N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const mA = new THREE.InstancedBufferAttribute(new Float32Array(MIST_N * 3), 3).setUsage(THREE.DynamicDrawUsage);   // size, alpha, seed
  mistGeo.setAttribute('iPos', mPos); mistGeo.setAttribute('iA', mA); mistGeo.instanceCount = 0;
  const mist = new THREE.Mesh(mistGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uCol: { value: new THREE.Color('#ff3d9a') } },
    vertexShader: `attribute vec3 iPos; attribute vec3 iA; varying vec2 vUv; varying float vA;
      void main() { vec3 c = (viewMatrix * vec4(iPos, 1.0)).xyz; float ang = iA.z * 6.283; vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * position.xy;
        gl_Position = projectionMatrix * vec4(c + vec3(q * iA.x, 0.0), 1.0); vUv = uv; vA = iA.y * smoothstep(1.5, 7.0, length(c)); }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vA;
      void main() { float d = length(vUv * 2.0 - 1.0); if (d > 1.0) discard; float a = pow(1.0 - d, 1.5) * vA;
        vec3 c = mix(uCol, vec3(1.0, 0.85, 0.93), pow(1.0 - d, 3.0) * 0.7); gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  }));
  mist.frustumCulled = false; mist.renderOrder = 7; scene.add(mist);
  let guideOn = false;
  function guideTo(x, z) { guideOn = true; if (Math.hypot(x - route.tx, z - route.tz) > 1) { route.tx = x; route.tz = z; route.cool = 0; route.pts = null; } }
  function guideOff() { guideOn = false; clearRoute(); }
  function updateGuide(dt) {
    if (!guideOn) { if (mist.geometry.instanceCount) mist.geometry.instanceCount = 0; return; }
    route.t += dt; route.cool -= dt; route.check -= dt;
    if (!route.pts) {
      if (route.cool <= 0) { route.cool = 0.8; const p = findRoute(car.x, car.z, route.tx, route.tz); if (p) setRoute(p); }
      if (!route.pts) { mist.geometry.instanceCount = 0; return; }
    }
    // progress along the route and distance off it (search a window around the cursor)
    const pts = route.pts, c = route.cum; let bd = Infinity, bs = route.s0;
    for (let i = Math.max(0, route.cursor - 6); i < Math.min(c.length - 1, route.cursor + 40); i++) {
      const ax = pts[i * 2], az = pts[i * 2 + 1], dx = pts[i * 2 + 2] - ax, dz = pts[i * 2 + 3] - az, l2 = dx * dx + dz * dz;
      const u = l2 ? clamp(((car.x - ax) * dx + (car.z - az) * dz) / l2, 0, 1) : 0, d = Math.hypot(car.x - ax - dx * u, car.z - az - dz * u);
      if (d < bd) { bd = d; bs = c[i] + u * Math.sqrt(l2); route.cursor = i; }
    }
    route.s0 = bs;
    if (bd > 18 && route.cool <= 0) { route.pts = null; route.cool = 0.3; return; }   // left the route: find a new one
    // puffs ahead of the lapa; a bright pulse runs forward every 2.4 s
    const front = (route.t % 2.4) / 2.4 * (MIST_N * MIST_STEP), pos = mPos.array, A = mA.array, tt = route.t;
    let n = 0;
    for (let i = 0; i < MIST_N; i++) {
      const d = 6 + i * MIST_STEP, s = bs + d; if (s > route.len - 1) break;
      const p = routeAt(s), w = 0.3 + 0.7 * Math.exp(-(((d - front) / 13) ** 2)), fade = Math.pow(1 - i / MIST_N, 0.7);
      const gy = groundAt(p.x, p.z);
      pos[n * 3] = p.x + Math.sin(tt * 1.3 + i) * 0.35; pos[n * 3 + 1] = gy + 0.5 + 0.7 * w + 0.25 * Math.sin(tt * 2.1 + i * 1.7); pos[n * 3 + 2] = p.z + Math.cos(tt * 1.1 + i * 1.3) * 0.35;
      A[n * 3] = 2.7 + 2.0 * w; A[n * 3 + 1] = 0.7 * w * fade; A[n * 3 + 2] = (i * 0.37) % 1;
      n++;
    }
    mist.geometry.instanceCount = n; mPos.needsUpdate = mA.needsUpdate = true;
  }

  // ------------------------------------------------------------------------------------ minimap markers
  const addMarker = (x, z, color, size) => { const m = { x, z, color, size }; mapMarkers.push(m); return m; };
  const dropMarker = m => { if (!m) return; const i = mapMarkers.indexOf(m); if (i >= 0) mapMarkers.splice(i, 1); };

  // ------------------------------------------------------------------------------------ stigghiulari
  const vendors = [];
  const V = { sign: null };
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
    const g = cv.getContext('2d');
    g.fillStyle = '#eadfc2'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#b8322a'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
    g.fillStyle = '#b8322a'; g.font = '700 96px "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('STIGGHIOLA', 256, 84);
    g.fillStyle = '#2f6b49'; g.fillRect(40, 132, 432, 6);
    V.sign = new THREE.CanvasTexture(cv); V.sign.colorSpace = THREE.SRGBColorSpace; V.sign.anisotropy = 4;
  }
  const std = (c, r = 0.85, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const M = {
    steel: std('#2a2624', 0.6, { metalness: 0.4 }), rust: std('#7a3b2a', 0.9), wood: std('#8a6a44', 0.9), pale: std('#d8c8a0', 0.9),
    coal: new THREE.MeshBasicMaterial({ color: 0xff6a22 }), skewer: std('#6b4a2b', 0.9), green: std('#4f7a3a', 0.9), pole: std('#bdbab2', 0.5, { metalness: 0.5 }),
    sign: new THREE.MeshBasicMaterial({ map: V.sign, toneMapped: false }), umbrella: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
  };
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,200,110,1)'); gr.addColorStop(0.35, 'rgba(255,110,40,.55)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const umbrellaGeo = (() => {
    const g = new THREE.ConeGeometry(1.7, 0.55, 12, 1, true).toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#e9e0c8'), b = new THREE.Color('#2f6b49');
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const c = (Math.floor((Math.atan2(cz, cx) + Math.PI) / (TAU / 12)) % 2) ? a : b;
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  })();
  const box = (w, h, d, mat, x, y, z, parent, shadow = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m; };
  const cyl = (r, h, mat, x, y, z, parent, rz = 0, shadow = false) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = shadow; parent.add(m); return m; };

  function buildVendor(o) {
    const pl = place(o);
    const sn = pl.road, side = sideSpot(sn, sn.w / 2 + 1.3);
    const px = side.x, pz = side.z, theta = Math.atan2(sn.dx, sn.dz) + (side.s < 0 ? Math.PI : 0);
    const gy = groundAt(px, pz);
    const g = new THREE.Group(); g.position.set(px, gy, pz); g.rotation.y = theta; scene.add(g);
    // brazier on legs (front = +x, the road side)
    box(0.55, 0.28, 1.1, M.steel, 0, 0.9, 0, g, true);
    for (const [lx, lz] of [[-0.22, -0.48], [0.22, -0.48], [-0.22, 0.48], [0.22, 0.48]]) cyl(0.03, 0.78, M.steel, lx, 0.39, lz, g);
    const coal = box(0.46, 0.04, 1.0, M.coal, 0, 1.03, 0, g);
    const sk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 5), M.skewer, 16), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), col = new THREE.Color();
    for (let i = 0; i < 16; i++) {
      m4.compose(new THREE.Vector3(0.0, 1.08, -0.46 + i * 0.061), q, new THREE.Vector3(1, 1, 1)); sk.setMatrixAt(i, m4);
      sk.setColorAt(i, col.set(i % 3 === 0 ? '#4f7a3a' : i % 3 === 1 ? '#7a4a2a' : '#8a5a34'));
    }
    g.add(sk);
    // counter on the road side with the sign and a pile of skewers
    box(0.42, 0.05, 1.3, M.wood, 0.68, 0.86, 0, g, true);
    for (const lz of [-0.55, 0.55]) { cyl(0.03, 0.84, M.wood, 0.5, 0.42, lz, g); cyl(0.03, 0.84, M.wood, 0.86, 0.42, lz, g); }
    box(0.3, 0.07, 0.36, M.pale, 0.62, 0.92, -0.35, g); box(0.26, 0.05, 0.3, M.green, 0.66, 0.97, -0.3, g); box(0.2, 0.06, 0.4, M.skewer, 0.7, 0.93, 0.3, g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), M.sign); sign.position.set(0.9, 0.62, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
    // umbrella
    cyl(0.025, 2.3, M.pole, -0.15, 1.15, 0.0, g);
    const um = new THREE.Mesh(umbrellaGeo, M.umbrella); um.position.set(0.05, 2.35, 0); um.castShadow = true; g.add(um);
    // glowing coals
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
    glow.scale.set(2.0, 1.2, 1); glow.position.set(0, 1.15, 0); g.add(glow);
    // vendor
    const vx0 = Math.sin(theta + Math.PI / 2), vz0 = Math.cos(theta + Math.PI / 2);   // world direction of local +x
    const cid = pedestrians.spawnScripted(o.skin || 'vendor', px - vx0 * 0.95, pz - vz0 * 0.95);
    if (cid >= 0) pedestrians.face(cid, px + vx0, pz + vz0);
    // collision: a small box around brazier and counter
    {
      const lx = [-0.4, 1.0], lz = [-0.7, 0.7], cs = Math.cos(theta), sS = Math.sin(theta);
      const W = (a, b) => [px + a * cs + b * sS, pz - a * sS + b * cs];
      const c = [W(lx[0], lz[0]), W(lx[1], lz[0]), W(lx[1], lz[1]), W(lx[0], lz[1])];
      for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; walls2d.addSeg([a[0], a[1], b[0], b[1]], a[0], a[1], b[0], b[1]); }
    }
    const v = { o, pl, x: px, z: pz, gy, g, coal, glow, cid, cd: 0, ring: null, marker: null, shoutT: rand(2, 8), seed: Math.random() * 10 };
    v.ring = makeBeacon('#ff9d2e', 4.5, { beam: false }); v.ring.set(px + vx0 * 1.7, pz + vz0 * 1.7); v.ring.show(true);
    v.sx = px + vx0 * 1.7; v.sz = pz + vz0 * 1.7;
    v.marker = addMarker(px, pz, '#ff7a1a', 4);
    return v;
  }
  for (const o of VENDORS) { try { vendors.push(buildVendor(o)); } catch (e) { console.warn('[missions] vendor', o.id, e); } }

  // smoke plumes: GPU-animated camera-facing quads, one instance per puff
  const PUFFS = 110, PLUME_H = 120;
  let plume = null;
  if (vendors.length) {
    const n = vendors.length * PUFFS, geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    const base = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    vendors.forEach((v, vi) => { for (let i = 0; i < PUFFS; i++) { const k = vi * PUFFS + i; base.set([v.x, v.gy + 1.1, v.z], k * 3); seed.set([(i + Math.random() * 0.9) / PUFFS, Math.random(), Math.random()], k * 3); } });
    geo.setAttribute('iBase', new THREE.InstancedBufferAttribute(base, 3)); geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 3)); geo.instanceCount = n;
    const u = { uTime: { value: 0 }, uH: { value: PLUME_H }, uWind: { value: new THREE.Vector2(0.3, 0.1) }, uFog: { value: new THREE.Color('#a9c4da') }, uFogD: { value: 0.00014 } };
    plume = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `
        attribute vec3 iBase; attribute vec3 iSeed; uniform float uTime; uniform float uH; uniform vec2 uWind;
        varying vec2 vUv; varying float vA; varying float vT; varying float vDist;
        void main() {
          float age = fract(uTime / 30.0 + iSeed.x);
          vec3 p = iBase + vec3(0.0, age * uH, 0.0);
          p.xz += uWind * (age * age * uH) + vec2(sin(uTime * 0.4 + iSeed.y * 6.28), cos(uTime * 0.33 + iSeed.z * 6.28)) * (0.4 + age * 6.0);
          float size = mix(2.0, 40.0, pow(age, 0.5)) * (0.75 + 0.5 * iSeed.y);
          vec3 c = (viewMatrix * vec4(p, 1.0)).xyz;
          float ang = iSeed.z * 6.283 + uTime * (0.08 + iSeed.y * 0.1);
          vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * position.xy;
          gl_Position = projectionMatrix * vec4(c + vec3(q * size, 0.0), 1.0);
          vDist = length(c); vUv = uv; vT = age;
          vA = smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.1) * 0.9 * smoothstep(2.5, 15.0, vDist);
        }`,
      fragmentShader: `
        uniform vec3 uFog; uniform float uFogD; varying vec2 vUv; varying float vA; varying float vT; varying float vDist;
        void main() {
          float d = length(vUv * 2.0 - 1.0); if (d > 1.0) discard;
          float a = smoothstep(1.0, 0.0, d) * vA;
          vec3 col = mix(vec3(0.30, 0.28, 0.27), vec3(0.80, 0.80, 0.82), smoothstep(0.0, 0.55, vT));
          col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * vDist * vDist));
          gl_FragColor = vec4(col, a);
        }`,
    }));
    plume.frustumCulled = false; plume.renderOrder = 6;
    plume.onBeforeRender = () => { u.uTime.value = now() % 5000; if (scene.fog) u.uFogD.value = scene.fog.density; };
    scene.add(plume);
  }

  // ------------------------------------------------------------------------------------ the Turisti mode
  const S = { mode: 'free', phase: 'off', earned: 0, fares: 0, best: 0, lastPick: null, lastDest: null, fare: null, gap: 0, t: 0 };
  try { S.best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) { /* storage unavailable */ }
  const pickBeacon = makeBeacon('#ff3d9a', 7.5), destBeacon = makeBeacon('#ffb3d9', 8.5);
  let pickMarker = null, destMarker = null;

  const SEAT_X = [-0.26, 0.26], SEAT_Z = -1.1, SEAT_Y = 1.04;
  const seatFn = i => out => {
    const sn = Math.sin(car.th), cs = Math.cos(car.th), lx = SEAT_X[i % 2];
    out.x = car.x + sn * SEAT_Z + cs * lx; out.z = car.z + cs * SEAT_Z - sn * lx;
    out.y = groundY(car.x, car.z) + car.lift + SEAT_Y + Math.sin(now() * 17 + i) * 0.012 * clamp(Math.hypot(car.vx, car.vz) / 10, 0, 1); out.th = car.th;
  };
  const natPick = () => { let r = Math.random() * NATIONS.reduce((a, n) => a + n[1], 0); for (const [k, w] of NATIONS) if ((r -= w) <= 0) return k; return 'en'; };
  const TOURIST_POOL = ['tourist', 'tourist2', 'tourist', 'tourist2', 'borsa', 'signora2', 'teen2', 'suit2', 'kid2', 'teen'];
  const speed = () => Math.hypot(car.vx, car.vz);
  const fmt = (tpl, d) => tpl.replace('{place}', d.name).replace('{food_en}', d.food_en).replace('{food_de}', d.food_de).replace('{food_fr}', d.food_fr);

  function newFare() {
    clearChars();
    let cands = P_PLACES.filter(p => p !== S.lastPick).map(p => ({ p, d: Math.hypot(p.x - car.x, p.z - car.z) })).sort((a, b) => a.d - b.d);
    let pool = cands.filter(c => c.d > 90 && c.d < 800);
    if (!pool.length) pool = cands.filter(c => c.d > 40);
    if (!pool.length) pool = cands;
    const pickP = pool[(Math.random() * Math.min(3, pool.length)) | 0].p;
    S.lastPick = pickP;
    const nat = natPick(), count = Math.random() < 0.4 ? 2 : 1;
    const f = { pick: pickP, nat, chars: [], phase: 'wait', dest: null, base: 0, tips: 0, claims: 0, limit: 0, left: 0, ev: {}, wantsStig: Math.random() < 0.45, stigDone: false, sniffed: false, lateSaid: false, boardT: 0, doorT: 0 };
    const sp = sideSpot(pickP.road, pickP.road.w / 2 + 1.4);
    for (let i = 0; i < count; i++) {
      const ox = pickP.road.dx * (i ? 0.9 : -0.3), oz = pickP.road.dz * (i ? 0.9 : -0.3);
      const id = pedestrians.spawnScripted(pick(TOURIST_POOL), sp.x + ox, sp.z + oz);
      if (id >= 0) { pedestrians.face(id, pickP.x, pickP.z); f.chars.push({ id, seated: false, slot: i, walking: false, next: 0 }); }
    }
    S.fare = f; S.phase = 'seek';
    pickBeacon.set(pickP.x, pickP.z); pickBeacon.show(true); dropMarker(pickMarker); pickMarker = addMarker(pickP.x, pickP.z, '#ff3d9a', 7);
    destBeacon.show(false); dropMarker(destMarker); destMarker = null;
    toast(T('Turisti in attesa!', 'Tourists waiting!'), pickP.name);
  }
  function clearChars() {
    const f = S.fare;
    if (f) for (const c of f.chars) pedestrians.remove(c.id);
    S.fare = null;
  }
  const anyAboard = f => f.chars.some(c => c.seated);
  const allAboard = f => f.chars.length && f.chars.every(c => c.seated);

  function startRide() {
    const f = S.fare;
    // destination: somewhere at a sensible distance from here
    let cands = D_PLACES.filter(d => d !== S.lastDest).map(d => ({ d, dist: Math.hypot(d.x - car.x, d.z - car.z) }));
    let pool = cands.filter(c => c.dist > 240 && c.dist < 1300);
    if (!pool.length) pool = cands.filter(c => c.dist > 120);
    if (!pool.length) pool = cands;
    const dest = pick(pool).d; f.dest = dest; S.lastDest = dest;
    f.dist0 = Math.hypot(dest.x - car.x, dest.z - car.z);
    f.base = Math.round((5 + f.dist0 / 90) * 2) / 2;
    f.limit = f.left = Math.max(40, (f.dist0 * 1.4 / 7.5 + 14) * Math.max(0.75, 1 - 0.03 * S.fares));
    f.phase = 'ride'; S.phase = 'ride';
    pickBeacon.show(false); dropMarker(pickMarker); pickMarker = null;
    destBeacon.set(dest.x, dest.z); destBeacon.show(true); destMarker = addMarker(dest.x, dest.z, '#ffd24a', 8);
    const tl = TOURIST.ask[f.nat] || TOURIST.ask.en;
    say(fmt(pick(tl), dest), seatPos, 0.2);
    say(pick(dest.meusa ? DRIVER.askMeusa : DRIVER.ask), driverPos, 1.8);
    say(pick(DRIVER.depart), driverPos, 3.6);
    toast(T('Si va a mangiare!', 'Off to eat!'), dest.name);
  }

  function tip(f, amount, label) { f.tips += amount; toast('+' + eur(amount), label); }
  function claim(f, amount, label) { f.claims += amount; toast('-' + eur(amount), label, true); }
  const tline = (f, key) => say(pick(TOURIST[key][f.nat] || TOURIST[key].en), seatPos, 0);
  const dline = (key, delay = 1.4) => say(pick(DRIVER[key]), driverPos, delay);

  let pedHits = 0, prevScrape = 0, prevSpeed = 0;
  if (pedestrians.onKnock) pedestrians.onKnock(() => { pedHits++; });

  function updateSeek(dt, f) {
    const d = Math.hypot(car.x - f.pick.x, car.z - f.pick.z), sp = speed();
    const near = d < 110;
    for (const c of f.chars) pedestrians.setBounce(c.id, near && !c.seated);
    if (d < pickBeacon.R && sp < 1.8) f.boardT += dt; else f.boardT = 0;
    if (f.boardT > 0.35) {
      f.phase = 'board'; S.phase = 'board'; f.doorT = 0;
      for (const c of f.chars) pedestrians.setBounce(c.id, false);
    }
  }
  function updateBoard(dt, f) {
    const sp = speed(), d = Math.hypot(car.x - f.pick.x, car.z - f.pick.z);
    const sn = Math.sin(car.th), cs = Math.cos(car.th);
    for (const c of f.chars) {
      if (c.seated) continue;
      const info = pedestrians.info(c.id); if (!info) continue;
      const side = ((info.x - car.x) * cs - (info.z - car.z) * sn) >= 0 ? 1 : -1;   // + : the lapa's left
      const tx = car.x + sn * -1.0 + cs * side * 1.0, tz = car.z + cs * -1.0 - sn * side * 1.0;
      c.next -= dt;
      if (c.next <= 0) { pedestrians.walkTo(c.id, tx, tz, 2.6); c.next = 0.25; }
      if (Math.hypot(info.x - tx, info.z - tz) < 0.6) {
        c.seated = true; pedestrians.attachTo(c.id, seatFn(c.slot), { seated: true, blend: 0.4 });
        if (c.slot === 0) { tline(f, 'board'); dline('board', 1.6); }
      }
    }
    if (allAboard(f)) { f.doorT += dt; if (f.doorT > 0.35) startRide(); return; }
    // the lapa pulls away before everyone is in
    if (sp > 3.5 && d > 3) {
      if (anyAboard(f)) { for (const c of f.chars.filter(c => !c.seated)) { pedestrians.remove(c.id); } f.chars = f.chars.filter(c => c.seated); startRide(); }
      else { f.phase = 'wait'; S.phase = 'seek'; f.boardT = 0; for (const c of f.chars) pedestrians.walkTo(c.id, f.pick.x, f.pick.z, 1.5); }
    }
  }
  function updateRide(dt, f) {
    const sp = speed(), ev = f.ev;
    f.left -= dt;
    for (const k in ev) if (ev[k] > 0) ev[k] = Math.max(0, ev[k] - dt);
    ev.drift = ev.drift || 0; ev.wheels = ev.wheels || 0; ev.miss = ev.miss || 0; ev.wall = ev.wall || 0; ev.ped = ev.ped || 0; ev.fast = ev.fast || 0; ev.chat = ev.chat === undefined ? rand(10, 18) : ev.chat;
    // tips
    f.driftAcc = (car.drift > 0.55 && sp > 7) ? (f.driftAcc || 0) + dt : Math.max(0, (f.driftAcc || 0) - dt * 2);
    if (f.driftAcc >= 1) { f.driftAcc = 0; tip(f, 1.5, T('Derapata!', 'Drift!')); if (Math.random() < 0.5) { tline(f, 'drift'); dline('drift'); } }
    f.wheelAcc = (car.tip > 0.55 && sp > 7) ? (f.wheelAcc || 0) + dt : 0;
    if (f.wheelAcc >= 0.6 && ev.wheels <= 0) { ev.wheels = 3; f.wheelAcc = 0; tip(f, 2, T('Su due ruote!', 'Two wheels!')); tline(f, 'wheels'); dline('wheels'); }
    f.speedAcc = sp > 21 ? (f.speedAcc || 0) + dt : 0;
    if (f.speedAcc >= 4) { f.speedAcc = 0; tip(f, 1, T('Pedale a tavoletta', 'Pedal to the metal')); if (ev.fast <= 0) { ev.fast = 20; tline(f, 'fast'); dline('fast'); } }
    if (sp > 8 && ev.miss <= 0) {
      let hit = false;
      const ag = traffic && traffic.agents ? traffic.agents() || [] : [];
      for (const a of ag) { const d = Math.hypot(a.x - car.x, a.z - car.z) - (a.r || 1.2); if (d > 0.55 && d < 1.2) { hit = true; break; } }
      if (!hit && pedestrians.near && pedestrians.near(car.x + car.vx * 0.25, car.z + car.vz * 0.25, 1.5) > 0) hit = true;
      if (hit) { ev.miss = 1.6; tip(f, 1, T('Per un pelo!', 'Close call!')); if (Math.random() < 0.5) { tline(f, 'miss'); dline('miss'); } }
    }
    // claims
    if (car.scrape > 5 && prevScrape <= 5 && ev.wall <= 0 && prevSpeed > 5) {
      ev.wall = 1.2; claim(f, prevSpeed > 12 ? 2 : 1, T('Muro!', 'Wall!')); tline(f, 'hitWall'); dline('hitWall');
    }
    prevScrape = car.scrape; prevSpeed = sp;
    if (pedHits > 0) {
      pedHits = 0;
      if (ev.ped <= 0) { ev.ped = 1.0; claim(f, 3, T('Pedone!', 'Pedestrian!')); tline(f, 'hitPed'); dline('hitPed', 1.8); }
    }
    // chatter and the stigghiola smell
    ev.chat -= dt;
    if (ev.chat <= 0) { ev.chat = rand(14, 24); tline(f, 'ambient'); dline('ambient', 1.8); }
    if (f.wantsStig && !f.sniffed) for (const v of vendors) if (v.cd <= 0 && Math.hypot(v.x - car.x, v.z - car.z) < 55) { f.sniffed = true; tline(f, 'smell'); toast(T('Che profumo!', 'What a smell!'), T('I turisti vogliono una stigghiola', 'The tourists want a stigghiola')); break; }
    if (f.left < 12 && !f.lateSaid) { f.lateSaid = true; tline(f, 'late'); dline('late'); }
    // arrival or time out
    const d = Math.hypot(car.x - f.dest.x, car.z - f.dest.z);
    if (d < destBeacon.R && sp < 2.0) return finishFare(f, true);
    if (f.left <= 0) return finishFare(f, false);
  }

  function finishFare(f, ok) {
    f.phase = 'drop'; S.phase = 'drop'; S.gap = 5.5;
    destBeacon.show(false); dropMarker(destMarker); destMarker = null;
    // everyone out, walking towards the door of the place
    const d = f.dest, dx = d.vx - d.x, dz = d.vz - d.z, dl = Math.hypot(dx, dz) || 1, step = ok ? Math.min(dl, 7) : 9;
    f.chars.forEach((c, i) => {
      pedestrians.detach(c.id); c.seated = false;
      const tx = ok ? d.x + dx / dl * step + i * 0.8 : car.x + Math.sin(car.th + 1.2 + i) * 9, tz = ok ? d.z + dz / dl * step : car.z + Math.cos(car.th + 1.2 + i) * 9;
      pedestrians.walkTo(c.id, tx, tz, ok ? 2.2 : 3.2);
    });
    if (ok) {
      const bonus = Math.round(f.base * 0.6 * clamp(f.left / f.limit, 0, 1) * 2) / 2;
      if (bonus > 0) f.tips += bonus;
      f.bonus = bonus;
      const total = Math.max(0, f.base + f.tips - f.claims);
      f.total = total; S.earned += total; S.fares++;
      if (S.earned > S.best) { S.best = S.earned; try { localStorage.setItem(BEST_KEY, String(S.best)); } catch (e) { /* ignore */ } }
      tline(f, 'arrive'); dline('arrive', 2.0);
      showResult(`<h3>${esc(d.name)}</h3>
        <div class="row"><span>${T('Corsa', 'Fare')}</span><span>${eur(f.base)}</span></div>
        <div class="row"><span>${T('Mance', 'Tips')}</span><span>+ ${eur(f.tips)}</span></div>
        <div class="row"><span>${T('Reclami', 'Complaints')}</span><span>- ${eur(f.claims)}</span></div>
        <div class="row tot"><span>${T('Totale', 'Total')}</span><span>${eur(total)}</span></div>`, 3.4);
      if (f.total >= f.base * 1.4) burst();
    } else {
      f.total = 0;
      tline(f, 'fail'); dline('fail', 2.0);
      showResult(`<h3>${T('Tempo scaduto!', 'Time is up!')}</h3><div class="row"><span>${T('I turisti scendono e non pagano', 'The tourists get out and do not pay')}</span></div>`, 3);
    }
  }
  function updateDrop(dt) {
    S.gap -= dt;
    if (S.gap <= 0) newFare();
  }

  // ------------------------------------------------------------------------------------ stigghiola
  function eatStigghiola(v) {
    v.cd = 50;
    car.nos = 1; car.nosLock = false;
    toast('STIGGHIOLA!', T('Nitro pieno', 'Nitro refilled')); burst();
    say(pick(VENDOR_SERVE), () => ({ x: v.x, y: v.gy + 0.2, z: v.z }), 0);
    dline('stig', 2.0);
    const f = S.fare;
    if (f && f.phase === 'ride' && f.wantsStig && !f.stigDone) {
      f.stigDone = true; tip(f, 6, T('Stigghiola per i turisti', 'Stigghiola for the tourists')); tline(f, 'eat');
    }
  }
  function updateVendors(dt) {
    const sp = speed();
    for (const v of vendors) {
      v.cd = Math.max(0, v.cd - dt);
      v.seed += dt;
      const d = Math.hypot(v.sx - car.x, v.sz - car.z);
      // coals breathe
      v.glow.material.opacity = 0.75 + 0.2 * Math.sin(v.seed * 7) * Math.sin(v.seed * 2.3);
      v.ring.u.uAlpha.value = v.cd > 0 ? 0.25 : 1;
      v.marker.color = v.cd > 0 ? '#8a6a44' : '#ff7a1a';
      if (v.cd <= 0 && d < 4.5 && sp < 2.2) eatStigghiola(v);
      // street cries when the lapa is close
      v.shoutT -= dt;
      if (v.shoutT <= 0 && d < 38) { v.shoutT = rand(7, 13); say(pick(VENDOR), () => ({ x: v.x, y: v.gy + 0.3, z: v.z }), 0); }
    }
    coalPulse();
  }
  let coalT = 0;
  function coalPulse() { coalT = now(); M.coal.color.setRGB(1, 0.32 + 0.16 * Math.sin(coalT * 6.3) * Math.sin(coalT * 2.1), 0.1); }

  // ------------------------------------------------------------------------------------ hud
  const _d = new THREE.Vector3(); let hudAcc = 0;
  function updateHud(dt) {
    const f = S.fare, on = S.mode === 'turisti';
    hud.classList.toggle('on', on);
    if (!on) return;
    let tx = 0, tz = 0, show = false;
    if (f && (S.phase === 'seek' || S.phase === 'board')) { tx = f.pick.x; tz = f.pick.z; show = true; }
    else if (f && S.phase === 'ride') { tx = f.dest.x; tz = f.dest.z; show = true; }
    // small compass in the card (the road itself is guided by the mist trail)
    if (show) {
      const brg = Math.atan2(tx - car.x, tz - car.z);
      camera.getWorldDirection(_d);
      elArrow.style.transform = `rotate(${(Math.atan2(_d.x, _d.z) - brg) * -180 / Math.PI}deg)`;
    }
    if (show) guideTo(tx, tz); else guideOff();
    if ((hudAcc -= dt) > 0) return;
    hudAcc = 0.1;
    elFare.textContent = f && f.dest ? eur(Math.max(0, f.base + f.tips - f.claims)) : eur(0);
    elPos.textContent = f && f.tips ? '+' + f.tips.toFixed(2).replace('.', ',') : '';
    elNeg.textContent = f && f.claims ? '-' + f.claims.toFixed(2).replace('.', ',') : '';
    elTot.textContent = T('Incasso ', 'Total ') + eur(S.earned);
    const dist = f ? Math.hypot(tx - car.x, tz - car.z) : 0, ds = dist >= 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(dist / 5) * 5 + ' m';
    if (S.phase === 'ride' && f) {
      elLab.textContent = T('Portali a mangiare', 'Take them to eat'); elPlace.textContent = f.dest.name; elSub.textContent = f.dest.addr + '  ·  ' + ds;
      const m = Math.max(0, f.left), mm = Math.floor(m / 60), ss = Math.floor(m % 60);
      elTime.textContent = mm + ':' + String(ss).padStart(2, '0'); elTime.classList.toggle('low', m < 12);
      elBarI.style.transform = `scaleX(${clamp(f.left / f.limit, 0, 1).toFixed(3)})`; elBar.classList.toggle('low', m < 12);
    } else if (S.phase === 'seek' || S.phase === 'board') {
      elLab.textContent = T('Turisti in attesa', 'Tourists waiting'); elPlace.textContent = f.pick.name; elSub.textContent = T('Fermati nell\'anello rosa', 'Stop inside the pink ring') + '  ·  ' + ds;
      elTime.textContent = ''; elBarI.style.transform = 'scaleX(0)';
    } else {
      elLab.textContent = T('Arrivederci', 'Goodbye'); elPlace.textContent = f && f.dest ? f.dest.name : ''; elSub.textContent = ''; elTime.textContent = ''; elBarI.style.transform = 'scaleX(0)';
    }
  }

  // ------------------------------------------------------------------------------------ main update
  function update(dt) {
    dt = clamp(dt, 0, 0.1);
    S.t += dt;
    updateVendors(dt);
    if (S.mode === 'turisti') {
      if (S.phase === 'off') newFare();
      const f = S.fare;
      if (f) {
        if (S.phase === 'seek') updateSeek(dt, f);
        else if (S.phase === 'board') updateBoard(dt, f);
        else if (S.phase === 'ride') updateRide(dt, f);
        else if (S.phase === 'drop') updateDrop(dt);
      }
    }
    if (resultTimer > 0 && (resultTimer -= dt) <= 0) result.classList.remove('on');
    updateTalk(dt);
    updateHud(dt);
    updateGuide(dt);
    if (pickMarker && S.fare) { pickMarker.x = S.fare.pick.x; pickMarker.z = S.fare.pick.z; }
  }

  function setMode(m) {
    m = m === 'turisti' ? 'turisti' : 'free';
    if (m === S.mode) return;
    if (m === 'free') stop(); else { S.mode = 'turisti'; S.phase = 'off'; api.mode = 'turisti'; }
  }
  function stop() {
    clearChars();
    S.mode = 'free'; S.phase = 'off'; api.mode = 'free';
    pickBeacon.show(false); destBeacon.show(false); dropMarker(pickMarker); dropMarker(destMarker); pickMarker = destMarker = null;
    hud.classList.remove('on'); guideOff(); result.classList.remove('on'); talkQ.length = 0;
  }

  const api = { mode: 'free', setMode, update, stop, state: S };
  if (params.has('mdebug')) window.__m = { S, vendors, route, G, newFare, mapRoute, mist, mPos, mA }; // TEMP
  if (params.get('mode') === 'turisti') setMode('turisti');
  return api;
}
