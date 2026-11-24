// Cassette tapes: 31 collectible audio cassettes, one for each Sessanta SeCunti Short of Dario Cascio (The Sicilian Wanderer), placed at the place the Short talks about (src/tapes-data.js).
// A tape floats a little over the road, turning slowly in a soft glow. Driving through it collects it: a chime, a short burst, the toast ("Cassetta", the title, n/31) and its audio plays on the
// car radio (radio.playTape, src/radio.js). Collected tapes are saved in localStorage (palermoDrive.tapes.v1, a list of ids, also in the cloud save) and can be played again from the menu through play(id).
// The place is a lat/lon, not a road point: tools/tapes-bake.mjs bakes the nearest drivable road point (x, z) of every tape into src/tapes-data.js, so everyone finds a tape in the same spot (never
// within 40 m of another tape); here only the ground height is read, once the ground is there. A tape is a landmark: a big cassette turning to face the lapa, with a tall soft beam of light over it.
// Only an uncollected tape within SHOW_R has anything in the scene; one geometry, one canvas texture and one beam texture serve them all.
// progress() is { found, total }; list() the tapes in order for the menu; the same picture on every device (no quality switch).
import * as THREE from 'three';
import { zone } from './hud.js';
import { freeCanvas } from './core.js';
import { esc } from './esc.js';
import { TAPES } from './tapes-data.js';
import { SESSANTA_BY } from './radio.js';

const KEY = 'palermoDrive.tapes.v1';
const SHOW_R = 320, MAP_R = 150, R_COLLECT = 5.5, HOVER = 3.3, W = 3.6, H = W * 0.64, THICK = 0.44, GLOW = 13, BEAM_H = 40, BEAM_W = 10, POP = 0.55;

// ---------- the look: one cassette face and one glow, painted once ----------
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
function paintFace(g, w, h) {
  g.fillStyle = '#1c1a22'; g.fillRect(0, 0, w, h);   // the whole canvas is shell: the thin sides of the box sample a corner of it
  const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, '#34303d'); sh.addColorStop(1, '#201d27');
  g.fillStyle = sh; rr(g, 6, 6, w - 12, h - 12, 22); g.fill();
  g.strokeStyle = '#ffb347'; g.lineWidth = 5; rr(g, 6, 6, w - 12, h - 12, 22); g.stroke();   // an amber rim, so the outline reads from far away
  const lx = 34, ly = 30, lw = w - 68, lh = h * .5;   // the label: cream, with a red and an amber stripe
  g.fillStyle = '#f4e8c8'; rr(g, lx, ly, lw, lh, 12); g.fill();
  g.fillStyle = '#d9422b'; g.fillRect(lx, ly + 10, lw, 14);
  g.fillStyle = '#ffb347'; g.fillRect(lx, ly + 28, lw, 8);
  g.fillStyle = '#1c1a22'; for (let i = 0; i < 3; i++) g.fillRect(lx + 20, ly + lh - 44 + i * 12, lw * (i === 2 ? .45 : .7), 3);   // the writing lines
  const wy = ly + lh * .42, wh = lh * .56, ww = lw * .66, wx = (w - ww) / 2;   // the window with the two reels, cut into the label
  g.fillStyle = '#15131a'; rr(g, wx, wy, ww, wh, wh / 2); g.fill();
  for (const cx of [wx + wh / 2 + 6, wx + ww - wh / 2 - 6]) {
    const cy = wy + wh / 2;
    g.fillStyle = '#f4e8c8'; g.beginPath(); g.arc(cx, cy, wh * .36, 0, 6.283); g.fill();
    g.fillStyle = '#15131a'; g.beginPath(); g.arc(cx, cy, wh * .2, 0, 6.283); g.fill();
    g.strokeStyle = '#f4e8c8'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * wh * .13, cy + Math.sin(a) * wh * .13); g.lineTo(cx + Math.cos(a) * wh * .22, cy + Math.sin(a) * wh * .22); g.stroke(); }
  }
  const by = h - 66, bw = w * .56, bx = (w - bw) / 2;   // the trapezoid at the bottom with its two holes
  g.fillStyle = '#4a4556'; g.beginPath(); g.moveTo(bx, h - 12); g.lineTo(bx + 24, by); g.lineTo(bx + bw - 24, by); g.lineTo(bx + bw, h - 12); g.closePath(); g.fill();
  g.fillStyle = '#15131a'; for (const cx of [bx + bw * .3, bx + bw * .7]) { g.beginPath(); g.arc(cx, by + 22, 8, 0, 6.283); g.fill(); }
  g.fillStyle = '#8a8497'; for (const [cx, cy] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]]) { g.beginPath(); g.arc(cx, cy, 5, 0, 6.283); g.fill(); }
}
function paintGlow(g, w, h) {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,200,110,.95)'); r.addColorStop(.25, 'rgba(255,170,70,.5)'); r.addColorStop(.6, 'rgba(255,140,50,.14)'); r.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
}
function paintBeam(g, w, h) {   // across: soft edges; up: bright at the cassette, gone at the top
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.abs(x / (w - 1) - .5) * 2, v = y / (h - 1), a = Math.pow(1 - u, 1.3) * Math.pow(1 - v, .9), o = (y * w + x) * 4, core = Math.pow(1 - u, 5) * (1 - v) * .6;
    im.data[o] = 255; im.data[o + 1] = 150 + 90 * core; im.data[o + 2] = 40 + 120 * core; im.data[o + 3] = 255 * Math.min(1, a * .95);
  }
  g.putImageData(im, 0, 0);
}
const mkTex = (w, h, paint) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
  const t = freeCanvas(new THREE.CanvasTexture(cv), paint); t.colorSpace = THREE.SRGBColorSpace; return t;
};

export function createTapes({ scene, car, groundY, proj, mapMarkers, getRadio = () => null, getVolume = () => .8, QUARTIERI = [] }) {
  const done = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* private mode */ } };
  try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a)) for (const id of a) if (TAPES.some(t => t.id === id)) done.add(id); } catch (e) { /* private mode */ }

  const Q = QUARTIERI.map(([n, la, lo]) => { const p = proj(la, lo); return [n, p[0], p[1]]; });
  const nearestQ = (x, z) => { let b = '', bd = Infinity; for (const [n, qx, qz] of Q) { const d = (qx - x) ** 2 + (qz - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; };
  // per tape: px, pz the place; x, z the baked road point; node: the group in the scene (null while far or collected); pop: seconds since collected (-1 at rest)
  const T = TAPES.map(t => { const [px, pz] = proj(t.lat, t.lon); return { ...t, px, pz, quartiere: nearestQ(px, pz), node: null, pop: -1 }; });
  const credit = t => ({ id: t.id, title: t.title, by: SESSANTA_BY, link: 'https://www.youtube.com/shorts/' + t.short });

  // ---------- the cassette in the world ----------
  const geo = new THREE.BoxGeometry(W, H, THICK);
  const uv = geo.attributes.uv;   // the two big faces show the whole texture; the four thin sides sample one dark corner of it
  for (let i = 0; i < 16; i++) uv.setXY(i, .01, .01);   // box vertices: +x, -x, +y, -y sides (0 to 15), then the +z and -z faces (16 to 23), each reading right from outside
  const face = mkTex(512, 328, paintFace); face.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: face });
  const glowTex = mkTex(128, 128, paintGlow);
  const beamGeo = new THREE.BufferGeometry();   // two crossed quads, so the beam shows from every side
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0, 0, 0, -1, 0, 0, 1, 0, 1, 1, 0, 1, -1].map((v, i) => i % 3 === 0 ? v * BEAM_W / 2 : i % 3 === 2 ? v * BEAM_W / 2 : v * BEAM_H)), 3));
  beamGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]), 2));
  beamGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const beamMat = new THREE.MeshBasicMaterial({ map: mkTex(64, 256, paintBeam), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  function build(t) {
    const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), bm = new THREE.Mesh(beamGeo, beamMat);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: .8 }));
    s.scale.set(GLOW, GLOW, 1); s.renderOrder = 3; bm.renderOrder = 2; bm.frustumCulled = false;
    g.add(m, s, bm); g.userData = { m, s, bm }; t.node = g;
  }
  const show = t => { if (!t.node) build(t); if (!t.node.parent) scene.add(t.node); };
  const hide = t => { if (t.node && t.node.parent) scene.remove(t.node); };

  // ---------- the chime: a click of the tape going in, then two rising notes (own AudioContext, made on the first collect) ----------
  let au = null, noise = null;
  function chime() {
    try {
      if (!au) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        au = new AC(); noise = au.createBuffer(1, au.sampleRate * .08, au.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      }
      const v = getVolume(); if (!(v > 0)) return;
      if (au.state === 'suspended') { au.resume().then(chime, () => {}); return; }
      const t = au.currentTime, out = au.createGain(); out.gain.value = .2 * v; out.connect(au.destination);
      const click = au.createBufferSource(), band = au.createBiquadFilter(), env = au.createGain();
      click.buffer = noise; band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = 1.2; env.gain.value = .6;
      click.connect(band); band.connect(env); env.connect(out); click.start(t);
      [[659, .05], [988, .14]].forEach(([f, dt]) => {
        const o = au.createOscillator(), e = au.createGain(); o.type = 'triangle'; o.frequency.value = f;
        e.gain.setValueAtTime(0, t + dt); e.gain.linearRampToValueAtTime(.7, t + dt + .012); e.gain.exponentialRampToValueAtTime(.001, t + dt + .5);
        o.connect(e); e.connect(out); o.start(t + dt); o.stop(t + dt + .55);
      });
    } catch (e) { /* no audio */ }
  }

  // ---------- toast: the same dark capsule as the SUCA one, in its own HUD line (the top one, or the one above the speed pill when the top one is too narrow) ----------
  const style = document.createElement('style');
  style.textContent = `
.pd-tape-toast { display: none; opacity: 0; width: max-content; max-width: var(--wide); box-sizing: border-box; padding: 4px 16px 5px; border-radius: 16px; pointer-events: none; text-align: center;
  background: var(--capsule, rgba(13,7,10,.8)); box-shadow: 0 2px 10px rgba(0,0,0,.3); color: #fff;
  font: 600 13px/1.25 system-ui, -apple-system, sans-serif; text-shadow: none; transition: opacity .3s, display .3s allow-discrete; }
.pd-tape-toast.on { display: block; opacity: 1; @starting-style { opacity: 0; } }
.pd-tape-toast.bump { animation: pd-tape-bump .55s cubic-bezier(.2, 1.5, .4, 1); }
@keyframes pd-tape-bump { 0% { transform: scale(.9); } 28% { transform: scale(1.14); box-shadow: 0 0 22px rgba(255,179,71,.85); } 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,179,71,0); } }
@media (prefers-reduced-motion: reduce) { .pd-tape-toast.bump { animation: none; } }
.pd-tape-toast small { display: block; font: 800 9.5px/1 system-ui, -apple-system, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #ffb347; margin-bottom: 3px; }
.pd-tape-toast b { display: block; font-weight: 800; font-size: 15px; letter-spacing: .02em; }
@media (max-height: 460px) { .pd-tape-toast { font-size: 11px; padding: 4px 10px 5px 9px; } .pd-tape-toast b { font-size: 13px; } }
`;
  document.head.appendChild(style);
  const toast = document.createElement('div');
  toast.className = 'pd-tape-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  zone('pick').appendChild(toast);
  let toastTimer = 0;
  const progress = () => ({ found: done.size, total: T.length });
  function showToast(t) {
    const p = progress();
    toast.innerHTML = `<small>Cassetta</small><b>${esc(t.title)} ${p.found}/${p.total}</b>`;
    const top = zone('pick'); if (toast.parentNode !== top) top.appendChild(toast);
    if (parseFloat(getComputedStyle(toast).maxWidth) < 200) zone('act').appendChild(toast);   // a short screen: the top line is only a few pixels wide between the radio bar and the map capsule, so the toast goes in the line above the speed pill
    toast.classList.remove('bump'); void toast.offsetWidth;
    toast.classList.add('on', 'bump');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on', 'bump'), 3200);
  }

  // minimap: an uncollected, resolved tape within MAP_R (a little amber cassette, the SUCA tags are pink crosses)
  const markers = new Map();
  function syncMarkers(c) {
    for (const t of T) {
      const near = t.x !== null && !done.has(t.id) && (t.x - c.x) ** 2 + (t.z - c.z) ** 2 < MAP_R * MAP_R, m = markers.get(t);
      if (near && !m) { const n = { x: t.x, z: t.z, color: '#ffb347', size: 5, icon: 'tape' }; markers.set(t, n); mapMarkers.push(n); }
      else if (!near && m) { const j = mapMarkers.indexOf(m); if (j >= 0) mapMarkers.splice(j, 1); markers.delete(t); }
    }
  }

  function collect(t) {
    done.add(t.id); save();
    t.pop = 0;
    showToast(t); chime();
    getRadio()?.playTape(credit(t));   // refused (the radio has not started, a pub song has the line): the tape still counts, and plays again from the menu list
  }

  let slow = 0, clock = 0;
  function update(dt, c) {
    clock += dt;
    if ((slow -= dt) <= 0) {
      slow = 1;
      syncMarkers(c);
    }
    for (const t of T) {
      if (t.pop >= 0) {   // collected a moment ago: a burst (the glow flares and fades, the cassette swells and shrinks away)
        t.pop += dt;
        if (t.pop >= POP) { t.pop = -1; hide(t); continue; }
        const u = t.pop / POP, n = t.node, k = u < .3 ? 1 + u / .3 * .4 : 1.4 * (1 - (u - .3) / .7);
        n.userData.m.scale.setScalar(Math.max(k, .001)); n.userData.m.rotation.y += dt * 9; n.userData.bm.scale.set(Math.max(1 - u * 3, .001), 1, Math.max(1 - u * 3, .001));
        n.userData.s.scale.set(GLOW * (1 + u * 2.2), GLOW * (1 + u * 2.2), 1); n.userData.s.material.opacity = .8 * (1 - u);
        continue;
      }
      const d2 = (t.x - c.x) ** 2 + (t.z - c.z) ** 2;
      if (done.has(t.id) || d2 > SHOW_R * SHOW_R) { hide(t); continue; }
      show(t);
      const n = t.node, m = n.userData.m, y = groundY(t.x, t.z) + HOVER + Math.sin(clock * 1.6 + t.px) * .08;
      n.position.set(t.x, y, t.z);
      m.rotation.set(-.05 + Math.sin(clock * .7 + t.px) * .06, Math.atan2(c.x - t.x, c.z - t.z) + Math.sin(clock * 1.1 + t.pz) * .22, Math.sin(clock * .9 + t.px) * .07);   // faces the lapa, rocking a little: never edge-on
      m.scale.setScalar(1); n.userData.bm.scale.set(1, 1, 1); n.userData.s.scale.set(GLOW, GLOW, 1); n.userData.s.material.opacity = .8;
      if (d2 < R_COLLECT * R_COLLECT) collect(t);
    }
  }

  const list = () => T.map(t => ({ id: t.id, title: t.title, place: t.place, quartiere: t.quartiere, link: 'https://www.youtube.com/shorts/' + t.short, found: done.has(t.id) }));
  const play = id => { const t = T.find(o => o.id === id); return !!t && done.has(id) && !!getRadio()?.playTape(credit(t)); };
  const where = id => { const t = T.find(o => o.id === id); return t && { px: t.px, pz: t.pz, x: t.x, z: t.z }; };   // for tests: the place and the road point 
  const map = () => T.filter(t => t.x !== null).map(t => ({ x: t.x, z: t.z, found: done.has(t.id), title: t.title, place: t.place, quartiere: t.quartiere }));   // for the big map (src/startmap.js): every tape at its road point
  return { update, progress, list, play, map, has: id => done.has(id), where };
}
