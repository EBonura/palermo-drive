// The overlay of the free-roam events (src/missions.js and its event-*.js modules, src/races.js): one slim line at the top centre (what it is, what to do with its count, the distance, the time, and a thin progress bar along its bottom edge), a big countdown, short lines one at a time and a results panel. They stand in the HUD's zones (src/hud.js).
// createEventHud({ camera, car, groundY }) -> { set(o), clear(), count(big, sub), toast(text, sub, neg), result(html, secs), burst(), update(dt) }
//   set({ label, title, sub, time (string), low (bool), frac (0..1 or null), target ({x, z} for the arrow at the edge of the screen or null), ledger ([text, ...]) })
//   While there is a target that is behind the camera or off the screen, an arrow at the edge of the screen points the way to it, with the distance (.ev-edge).
import * as THREE from 'three';
import { vp } from './viewport.js';
import { esc } from './esc.js';
import { zone } from './hud.js';

const CSS = `
#ev-hud { width: max-content; max-width: var(--wide); display: none;
  pointer-events: none; font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; }
#ev-hud.on { display: block; }
.ev-card { position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 9px; height: 30px; max-width: 100%; padding: 0 14px; border-radius: 15px; background: var(--capsule, rgba(13,7,10,.8)); box-shadow: 0 2px 10px rgba(0,0,0,.3); overflow: hidden; }
.ev-lab { flex: none; font-weight: 600; font-size: 10px; letter-spacing: .16em; color: #f5a9c9; white-space: nowrap; }
.ev-title { flex: 1 1 auto; min-width: 0; font-weight: 700; font-size: 15px; line-height: 1.1; letter-spacing: .05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-sub { flex: 0 3 auto; min-width: 0; font-weight: 600; font-size: 11px; letter-spacing: .1em; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-lab:empty, .ev-sub:empty, .ev-time:empty { display: none; }
.ev-time { flex: none; font: 400 16px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; color: #fff; font-variant-numeric: tabular-nums; }
.ev-time.low { color: #ff6a5a; animation: ev-blink .5s steps(2) infinite; }
.ev-bar { position: absolute; left: 14px; right: 14px; bottom: 0; height: 3px; border-radius: 2px; background: rgba(255,255,255,.12); }
.ev-bar i { display: block; height: 100%; width: 100%; transform-origin: left; border-radius: 2px; background: linear-gradient(90deg, #f5a9c9, #e8559a); }
.ev-bar.low i { background: #ff4a3a; } .ev-bar.off { display: none; }
.ev-ledger { margin: 3px 0 0 10px; display: flex; gap: 8px; align-items: baseline; font-weight: 700; font-size: 11px; letter-spacing: .1em; color: #ffd1e6; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
.ev-toasts { pointer-events: none; display: flex; flex-direction: column; align-items: center; }
.ev-toasts:empty { display: none; }
.ev-toast { box-sizing: border-box; max-width: var(--wide); padding: 4px 16px 5px; text-align: center; color: #fff; text-transform: uppercase; background: var(--capsule, rgba(13,7,10,.8)); border-radius: 18px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
  animation: ev-toast 1.9s ease-out forwards; font: 400 clamp(14px, 3.2vh, 20px)/1.1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .05em; }
.ev-toast > span { display: block; }
.ev-toast.neg { background: rgba(86,14,10,.9); }
.ev-toast small { display: block; margin-top: 1px; font: 600 clamp(10px, 2.3vh, 13px)/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; letter-spacing: .1em; color: #ffd1e6; }
.ev-result { display: none; transform: skewX(-6deg); box-sizing: border-box; min-width: var(--obj); max-width: var(--wide); padding: 8px 20px 10px; text-align: center;
  background: linear-gradient(180deg, rgba(11,7,9,.9), rgba(60,14,40,.88)); border: 2px solid #e8559a; box-shadow: 0 0 30px rgba(232,85,154,.5);
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; pointer-events: none; }
.ev-result.on { display: block; animation: ev-fade .25s ease-out; } .ev-result > * { transform: skewX(6deg); }
@keyframes ev-fade { from { opacity: 0; } }
.ev-result h3 { margin: 0 0 6px; font: 400 clamp(18px, 4.2vh, 28px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; color: #fff; text-shadow: 0 0 12px #e8559a; }
.ev-result .row { display: flex; justify-content: space-between; gap: 24px; font-weight: 600; font-size: clamp(12px, 2.6vh, 16px); letter-spacing: .12em; }
.ev-result .tot { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.3); font-size: clamp(15px, 3.4vh, 22px); font-weight: 700; color: #f5a9c9; }
.ev-count { position: fixed; z-index: 62; left: 50%; top: 40%; transform: translate(-50%, -50%) skewX(-8deg); font: 400 clamp(60px, 22vh, 170px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif;
  color: #fff; -webkit-text-stroke: 3px #0b0709; paint-order: stroke fill; text-shadow: 0 0 24px #e8559a, 0 6px 10px rgba(0,0,0,.6); display: none; text-align: center; pointer-events: none; }
.ev-count.on { display: block; animation: ev-pop .9s ease-out; } .ev-count small { display: block; font-size: .16em; letter-spacing: .2em; -webkit-text-stroke: 0; }
.ev-conf { position: fixed; z-index: 63; left: 50%; top: 52%; width: 0; height: 0; pointer-events: none; }
.ev-conf i { position: absolute; left: 0; top: 0; width: 9px; height: 14px; animation: ev-conf 1.2s cubic-bezier(.2,.7,.3,1) forwards; }
.ev-leash { box-sizing: border-box; max-width: var(--wide); padding: 3px 16px 4px; border-radius: 18px; text-align: center; display: none; pointer-events: none; align-items: baseline; justify-content: center; gap: 10px;
  background: rgba(86,14,10,.92); box-shadow: 0 2px 10px rgba(0,0,0,.35); color: #fff; text-transform: uppercase;
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; animation: ev-leash .9s ease-in-out infinite; }
.ev-leash.on { display: flex; }
.ev-leash b { font: 400 clamp(15px, 3.6vh, 22px)/1.05 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; white-space: nowrap; }
.ev-leash small { font-weight: 600; font-size: clamp(11px, 2.4vh, 14px); letter-spacing: .14em; opacity: .92; white-space: nowrap; }
@keyframes ev-leash { 50% { box-shadow: 0 0 22px rgba(255,74,58,.9); } }
.ev-flash { position: fixed; inset: 0; z-index: 59; pointer-events: none; background: radial-gradient(ellipse at 50% 60%, rgba(255,160,60,.0), rgba(255,120,40,.45)); opacity: 0; }
.ev-flash.on { animation: ev-flash .7s ease-out; }
@keyframes ev-conf { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
@keyframes ev-toast { 0% { opacity: 0; transform: translateY(-6px); } 10% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ev-pop { 0% { transform: translate(-50%, -50%) scale(1.6) skewX(-8deg); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1) skewX(-8deg); } }
@keyframes ev-blink { 50% { opacity: .35; } }
@keyframes ev-flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
@media (max-height: 520px) { .ev-title { font-size: 13px; } .ev-card { height: 26px; padding: 0 12px; gap: 7px; } .ev-time { font-size: 14px; } }
.ev-edge { position: fixed; z-index: 58; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; pointer-events: none; display: none; will-change: transform;
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; }
.ev-edge.on { display: block; }
.ev-edge svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0 7px rgba(255,79,163,.95)) drop-shadow(0 2px 3px rgba(0,0,0,.65)); animation: ev-edge 1.1s ease-in-out infinite; }
.ev-edge small { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #fff; white-space: nowrap; text-shadow: 0 0 4px #0b0709, 0 1px 3px #0b0709; }
@keyframes ev-edge { 50% { transform: scale(1.14); } }
@media (max-height: 520px) { .ev-edge { width: 38px; height: 38px; margin: -19px 0 0 -19px; } .ev-edge small { font-size: 11px; } }
html.pd-title .ev-edge, html.pd-title .ev-count { display: none !important; }
`;


const rand = (a, b) => a + Math.random() * (b - a);

export function createEventHud({ camera, car, groundY }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const mk = (cls, html, parent = document.body, tag = 'div') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; };
  const root = mk('', `<div class="ev-card"><span class="ev-lab"></span><span class="ev-title"></span><span class="ev-sub"></span><span class="ev-time"></span><div class="ev-bar off"><i></i></div></div>
    <div class="ev-ledger"></div>`, zone('obj'));
  root.id = 'ev-hud';
  const q = s => root.querySelector(s);
  const elLab = q('.ev-lab'), elTime = q('.ev-time'), elTitle = q('.ev-title'), elSub = q('.ev-sub'), elBar = q('.ev-bar'), elBarI = q('.ev-bar i'), elLedger = q('.ev-ledger');
  const edge = mk('ev-edge', '<svg viewBox="0 0 24 24"><path d="M12 1.5 L21 20 L12 15.5 L3 20 Z" fill="#ff4fa3" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><small></small>'), edgeSvg = edge.querySelector('svg'), edgeLab = edge.querySelector('small');
  const toasts = mk('ev-toasts', null, zone('feed')), result = mk('ev-result', null, zone('moment')), conf = mk('ev-conf'), flash = mk('ev-flash'), count = mk('ev-count'), leashEl = mk('ev-leash', '<b></b><small></small>', zone('alert'));
  const leashB = leashEl.querySelector('b'), leashS = leashEl.querySelector('small');
  let target = null, resultT = 0, countT = 0, cache = '';
  const _p = new THREE.Vector3();
  let edgeText = '', edgeOn = false;
  const setEdge = on => { if (on !== edgeOn) { edgeOn = on; edge.classList.toggle('on', on); } };   // a class write every frame restyles the page even when nothing changes
  // the arrow at the edge of the screen: where the target is in the camera's own frame (x right, y up, the view down -z); on the screen it needs no arrow, off it or behind it the arrow sits where the
  // direction to it meets the border of the free part of the screen: inside the zones of src/hud.js (the columns left and right, the card on top, the gauges below) and the touch pads
  function edgeArrow() {
    const W = vp.w, H = vp.h, touch = document.documentElement.classList.contains('touch'), top = 124, bot = touch ? Math.max(top + 60, H - 150) : H - 110, mx = touch ? Math.max(200, W * 0.27) : Math.min(232, W * 0.2);
    _p.set(target.x, (groundY ? groundY(target.x, target.z) : car.y || 0) + 1.5, target.z).applyMatrix4(camera.matrixWorldInverse);
    let dx, dy;
    if (_p.z < -0.5) {   // in front: its place on the screen
      const f = 1 / Math.tan(camera.fov * Math.PI / 360), nx = _p.x / -_p.z * f / camera.aspect, ny = _p.y / -_p.z * f;
      if (Math.abs(nx) < 0.9 && ny < 0.82 && ny > -0.78) { setEdge(false); return; }
      dx = nx; dy = -ny;
    } else { dx = _p.x / Math.max(1, Math.abs(_p.z)) * 2; dy = 1; }   // behind: at the bottom, towards the side it is on
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const cx = W / 2, cy = (top + bot) / 2, tx = dx > 0.001 ? (W - mx - cx) / dx : dx < -0.001 ? (mx - cx) / dx : 1e9, ty = dy > 0.001 ? (bot - cy) / dy : dy < -0.001 ? (top - cy) / dy : 1e9, t = Math.min(tx, ty);
    edge.style.transform = `translate(${(cx + dx * t).toFixed(1)}px, ${(cy + dy * t).toFixed(1)}px)`;
    edgeSvg.style.rotate = `${(Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(1)}deg`;
    const d = Math.hypot(target.x - car.x, target.z - car.z), txt = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 10) * 10 + ' m';
    if (txt !== edgeText) { edgeText = txt; edgeLab.textContent = txt; }
    setEdge(true);
  }

  const LINE_MS = 1900, LINE_MIN = 900, lineQ = [];
  let live = null, lineTimer = 0;
  function showLine(text, sub, neg) {
    toasts.innerHTML = `<div class="ev-toast${neg ? ' neg' : ''}"><span>${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
    live = { text, t: performance.now() };
    clearTimeout(lineTimer); lineTimer = setTimeout(nextLine, LINE_MS);
  }
  function nextLine() { const m = lineQ.shift(); if (m) showLine(m.text, m.sub, m.neg); else { live = null; toasts.innerHTML = ''; } }

  addEventListener('pd-toast', e => { const d = e.detail || {}; api.toast(d.text, d.sub, d.neg); });   // other modules (src/danger.js) show a toast without owning the HUD

  const api = {
    // text is written only when it changed (called a few times per second at most)
    set(o) {
      root.classList.add('on');
      const key = [o.label, o.title, o.sub, o.time, o.low, o.frac == null ? '' : o.frac.toFixed(3), o.ledger && o.ledger.join('|')].join('~');
      target = o.target || null;
      if (key === cache) return; cache = key;
      elLab.textContent = o.label || ''; elTitle.textContent = o.title || ''; elSub.textContent = o.sub || ''; elTime.textContent = o.time || '';
      elTime.classList.toggle('low', !!o.low); elBar.classList.toggle('off', o.frac == null); elBar.classList.toggle('low', !!o.low);
      if (o.frac != null) elBarI.style.transform = `scaleX(${Math.min(1, Math.max(0, o.frac)).toFixed(3)})`;
      elLedger.innerHTML = o.ledger ? o.ledger.map(t => `<span>${esc(t)}</span>`).join('') : '';
    },
    // the leash (src/missions.js): a red banner while the lapa is too far from the mission area, with the seconds left; leash(false) hides it
    leash(on, big, sub) { if (!on) { leashEl.classList.remove('on'); return; } if (leashB.textContent !== big) leashB.textContent = big; if (leashS.textContent !== sub) leashS.textContent = sub; leashEl.classList.add('on'); },
    hide() { root.classList.remove('on'); setEdge(false); target = null; cache = ''; },
    clear() { root.classList.remove('on'); leashEl.classList.remove('on'); setEdge(false); target = null; cache = ''; result.classList.remove('on'); count.classList.remove('on'); resultT = 0; },   // the queue of lines runs out by itself
    count(big, sub) { count.innerHTML = `${esc(big)}${sub ? `<small>${esc(sub)}</small>` : ''}`; count.classList.remove('on'); void count.offsetWidth; count.classList.add('on'); countT = 1.1; },
    // one line at a time: a warning (neg) goes to the front of the queue, the queue keeps the newest three, the same line again just restarts, and a waiting line cuts the one on screen short
    toast(text, sub, neg) {
      if (live && live.text === text) { showLine(text, sub, neg); return; }
      if (neg) lineQ.unshift({ text, sub, neg }); else lineQ.push({ text, sub, neg });
      while (lineQ.length > 3) lineQ.splice(neg ? lineQ.length - 1 : 0, 1);
      if (!live) nextLine();
      else { clearTimeout(lineTimer); lineTimer = setTimeout(nextLine, Math.max(0, LINE_MIN - (performance.now() - live.t))); }
    },
    result(html, secs) { result.innerHTML = html; result.classList.add('on'); resultT = secs; },
    burst() {
      const cols = ['#e8559a', '#f5a9c9', '#ffd24a', '#fff4e0', '#6bbf59', '#ff8a3a'];
      for (let i = 0; i < 30; i++) {
        const e = mk('', '', conf, 'i'), a = rand(0, Math.PI * 2), d = rand(90, 260);
        e.style.background = cols[(Math.random() * cols.length) | 0];
        e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', (Math.sin(a) * d * 0.7 - 80) + 'px'); e.style.setProperty('--rot', rand(-540, 540) + 'deg');
        setTimeout(() => e.remove(), 1300);
      }
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    },
    update(dt) {
      if (resultT > 0 && (resultT -= dt) <= 0) result.classList.remove('on');
      if (countT > 0 && (countT -= dt) <= 0) count.classList.remove('on');
      if (!target) setEdge(false); else edgeArrow();
    },
  };
  return api;
}
