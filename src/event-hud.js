// The overlay of the free-roam events (src/missions.js and its event-*.js modules, src/races.js): one card at the top centre (timer, objective,
// progress bar, a compass arrow), a big countdown, floating toasts and a results panel. The game shell leaves the top centre free for it.
// createEventHud({ camera, car, groundY }) -> { set(o), clear(), count(big, sub), toast(text, sub, neg), result(html, secs), burst(), update(dt) }
//   set({ label, title, sub, time (string), low (bool), frac (0..1 or null), target ({x, z} for the compass or null), ledger ([text, ...]) })
//   While there is a target that is behind the camera or off the screen, an arrow at the edge of the screen points the way to it, with the distance (.ev-edge).
import * as THREE from 'three';

const CSS = `
#ev-hud { position: fixed; z-index: 60; left: 50%; top: max(8px, env(safe-area-inset-top)); transform: translateX(-50%); width: min(360px, 54vw); display: none;
  pointer-events: none; font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; }
#ev-hud.on { display: block; }
.ev-card { position: relative; display: flex; align-items: center; gap: 8px; padding: 5px 12px 9px 8px; background: linear-gradient(90deg, rgba(11,7,9,.82), rgba(40,12,28,.78));
  border-left: 5px solid #e8559a; transform: skewX(-6deg); box-shadow: 0 3px 12px rgba(0,0,0,.4); overflow: hidden; }
.ev-card > * { transform: skewX(6deg); }
.ev-arrow { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; background: rgba(232,85,154,.22); box-shadow: inset 0 0 0 2px #e8559a; display: flex; align-items: center; justify-content: center; }
.ev-arrow.off { display: none; }
.ev-arrow svg { width: 21px; height: 21px; filter: drop-shadow(0 0 4px rgba(255,79,163,.9)); }
.ev-body { flex: 1 1 auto; min-width: 0; }
.ev-top { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; font-size: 10px; letter-spacing: .16em; color: #f5a9c9; }
.ev-time { font: 400 18px/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .04em; color: #fff; }
.ev-time.low { color: #ff6a5a; animation: ev-blink .5s steps(2) infinite; }
.ev-title { font-weight: 700; font-size: 15px; line-height: 1.05; letter-spacing: .05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-sub { font-weight: 600; font-size: 10px; letter-spacing: .1em; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,.12); transform: none !important; }
.ev-bar i { display: block; height: 100%; width: 100%; transform-origin: left; background: linear-gradient(90deg, #f5a9c9, #e8559a); }
.ev-bar.low i { background: #ff4a3a; } .ev-bar.off { display: none; }
.ev-ledger { margin: 3px 0 0 8px; display: flex; gap: 8px; align-items: baseline; font-weight: 700; font-size: 11px; letter-spacing: .1em; color: #ffd1e6; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
.ev-toasts { position: fixed; z-index: 61; left: 50%; top: 30%; transform: translateX(-50%); pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: 'Racing Sans One','Barlow Condensed',Impact,sans-serif; }
.ev-toast { text-align: center; font-size: clamp(16px, 3.6vh, 26px); letter-spacing: .06em; text-transform: uppercase; color: #fff; -webkit-text-stroke: 1.5px #0b0709; paint-order: stroke fill;
  text-shadow: 0 0 14px #e8559a, 0 3px 6px rgba(0,0,0,.6); animation: ev-toast 1.9s ease-out forwards; transform: skewX(-8deg); }
.ev-toast.neg { color: #ffb3a8; text-shadow: 0 0 14px #ff4a3a, 0 3px 6px rgba(0,0,0,.6); }
.ev-toast small { display: block; font-size: .5em; letter-spacing: .14em; text-align: center; opacity: .9; }
.ev-result { position: fixed; z-index: 62; left: 50%; top: 22%; transform: translate(-50%, 0) skewX(-6deg); min-width: min(300px, 60vw); padding: 10px 20px 12px; text-align: center;
  background: linear-gradient(180deg, rgba(11,7,9,.9), rgba(60,14,40,.88)); border: 2px solid #e8559a; box-shadow: 0 0 30px rgba(232,85,154,.5);
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; color: #fff; text-transform: uppercase; pointer-events: none; opacity: 0; transition: opacity .35s; }
.ev-result.on { opacity: 1; } .ev-result > * { transform: skewX(6deg); }
.ev-result h3 { margin: 0 0 6px; font: 400 clamp(18px, 4.2vh, 28px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; color: #fff; text-shadow: 0 0 12px #e8559a; }
.ev-result .row { display: flex; justify-content: space-between; gap: 24px; font-weight: 600; font-size: clamp(12px, 2.6vh, 16px); letter-spacing: .12em; }
.ev-result .tot { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.3); font-size: clamp(15px, 3.4vh, 22px); font-weight: 700; color: #f5a9c9; }
.ev-count { position: fixed; z-index: 62; left: 50%; top: 32%; transform: translate(-50%, -50%) skewX(-8deg); font: 400 clamp(60px, 22vh, 170px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif;
  color: #fff; -webkit-text-stroke: 3px #0b0709; paint-order: stroke fill; text-shadow: 0 0 24px #e8559a, 0 6px 10px rgba(0,0,0,.6); display: none; text-align: center; pointer-events: none; }
.ev-count.on { display: block; animation: ev-pop .9s ease-out; } .ev-count small { display: block; font-size: .16em; letter-spacing: .2em; -webkit-text-stroke: 0; }
.ev-conf { position: fixed; z-index: 63; left: 50%; top: 52%; width: 0; height: 0; pointer-events: none; }
.ev-conf i { position: absolute; left: 0; top: 0; width: 9px; height: 14px; animation: ev-conf 1.2s cubic-bezier(.2,.7,.3,1) forwards; }
.ev-flash { position: fixed; inset: 0; z-index: 59; pointer-events: none; background: radial-gradient(ellipse at 50% 60%, rgba(255,160,60,.0), rgba(255,120,40,.45)); opacity: 0; }
.ev-flash.on { animation: ev-flash .7s ease-out; }
@keyframes ev-conf { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
@keyframes ev-toast { 0% { opacity: 0; transform: translateY(14px) scale(.7) skewX(-8deg); } 12% { opacity: 1; transform: translateY(0) scale(1.08) skewX(-8deg); } 20% { transform: scale(1) skewX(-8deg); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-24px) skewX(-8deg); } }
@keyframes ev-pop { 0% { transform: translate(-50%, -50%) scale(1.6) skewX(-8deg); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1) skewX(-8deg); } }
@keyframes ev-blink { 50% { opacity: .35; } }
@keyframes ev-flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
@media (max-height: 520px) { #ev-hud { width: min(320px, 50vw); } .ev-arrow { width: 28px; height: 28px; } .ev-title { font-size: 13px; } .ev-card { padding: 4px 10px 8px 6px; } .ev-result { top: 20%; } }
.ev-edge { position: fixed; z-index: 58; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; pointer-events: none; display: none; will-change: transform;
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; }
.ev-edge.on { display: block; }
.ev-edge svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0 7px rgba(255,79,163,.95)) drop-shadow(0 2px 3px rgba(0,0,0,.65)); animation: ev-edge 1.1s ease-in-out infinite; }
.ev-edge small { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #fff; white-space: nowrap; text-shadow: 0 0 4px #0b0709, 0 1px 3px #0b0709; }
@keyframes ev-edge { 50% { transform: scale(1.14); } }
@media (max-height: 520px) { .ev-edge { width: 38px; height: 38px; margin: -19px 0 0 -19px; } .ev-edge small { font-size: 11px; } }
html.pd-title .ev-edge, html.pd-title #ev-hud, html.pd-title .ev-toasts, html.pd-title .ev-result, html.pd-title .ev-count { display: none !important; }
`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a);

export function createEventHud({ camera, car, groundY }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const mk = (cls, html, parent = document.body, tag = 'div') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; };
  const root = mk('', `<div class="ev-card"><div class="ev-arrow off"><svg viewBox="0 0 24 24"><path d="M12 1.5 L21 20 L12 15.5 L3 20 Z" fill="#ff4fa3" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
    <div class="ev-body"><div class="ev-top"><span class="ev-lab"></span><span class="ev-time"></span></div><div class="ev-title"></div><div class="ev-sub"></div></div><div class="ev-bar off"><i></i></div></div>
    <div class="ev-ledger"></div>`);
  root.id = 'ev-hud';
  const q = s => root.querySelector(s);
  const elArrow = q('.ev-arrow'), elArrowSvg = q('.ev-arrow svg'), elLab = q('.ev-lab'), elTime = q('.ev-time'), elTitle = q('.ev-title'), elSub = q('.ev-sub'), elBar = q('.ev-bar'), elBarI = q('.ev-bar i'), elLedger = q('.ev-ledger');
  const edge = mk('ev-edge', '<svg viewBox="0 0 24 24"><path d="M12 1.5 L21 20 L12 15.5 L3 20 Z" fill="#ff4fa3" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><small></small>'), edgeSvg = edge.querySelector('svg'), edgeLab = edge.querySelector('small');
  const toasts = mk('ev-toasts'), result = mk('ev-result'), conf = mk('ev-conf'), flash = mk('ev-flash'), count = mk('ev-count');
  let target = null, resultT = 0, countT = 0, cache = '';
  const _d = new THREE.Vector3(), _p = new THREE.Vector3();
  let edgeText = '';
  // the arrow at the edge of the screen: where the target is in the camera's own frame (x right, y up, the view down -z); on the screen it needs no arrow, off it or behind it the arrow sits where the
  // direction to it meets the border of the screen (inset from the card at the top and the touch pads at the bottom)
  function edgeArrow() {
    const W = innerWidth, H = innerHeight, touch = document.documentElement.classList.contains('touch'), top = 96, bot = touch ? Math.max(top + 80, H * 0.38) : H - 64, mx = 40;
    _p.set(target.x, (groundY ? groundY(target.x, target.z) : car.y || 0) + 1.5, target.z).applyMatrix4(camera.matrixWorldInverse);
    let dx, dy;
    if (_p.z < -0.5) {   // in front: its place on the screen
      const f = 1 / Math.tan(camera.fov * Math.PI / 360), nx = _p.x / -_p.z * f / camera.aspect, ny = _p.y / -_p.z * f;
      if (Math.abs(nx) < 0.9 && ny < 0.82 && ny > -0.78) { edge.classList.remove('on'); return; }
      dx = nx; dy = -ny;
    } else { dx = _p.x / Math.max(1, Math.abs(_p.z)) * 2; dy = 1; }   // behind: at the bottom, towards the side it is on
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const cx = W / 2, cy = (top + bot) / 2, tx = dx > 0.001 ? (W - mx - cx) / dx : dx < -0.001 ? (mx - cx) / dx : 1e9, ty = dy > 0.001 ? (bot - cy) / dy : dy < -0.001 ? (top - cy) / dy : 1e9, t = Math.min(tx, ty);
    edge.style.transform = `translate(${(cx + dx * t).toFixed(1)}px, ${(cy + dy * t).toFixed(1)}px)`;
    edgeSvg.style.rotate = `${(Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(1)}deg`;
    const d = Math.hypot(target.x - car.x, target.z - car.z), txt = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 10) * 10 + ' m';
    if (txt !== edgeText) { edgeText = txt; edgeLab.textContent = txt; }
    edge.classList.add('on');
  }

  addEventListener('pd-toast', e => { const d = e.detail || {}; api.toast(d.text, d.sub, d.neg); });   // other modules (src/danger.js) show a toast without owning the HUD

  const api = {
    // text is written only when it changed (called a few times per second at most)
    set(o) {
      root.classList.add('on');
      const key = [o.label, o.title, o.sub, o.time, o.low, o.frac == null ? '' : o.frac.toFixed(3), o.ledger && o.ledger.join('|'), !!o.target].join('~');
      target = o.target || null;
      elArrow.classList.toggle('off', !target);
      if (key === cache) return; cache = key;
      elLab.textContent = o.label || ''; elTitle.textContent = o.title || ''; elSub.textContent = o.sub || ''; elTime.textContent = o.time || '';
      elTime.classList.toggle('low', !!o.low); elBar.classList.toggle('off', o.frac == null); elBar.classList.toggle('low', !!o.low);
      if (o.frac != null) elBarI.style.transform = `scaleX(${Math.min(1, Math.max(0, o.frac)).toFixed(3)})`;
      elLedger.innerHTML = o.ledger ? o.ledger.map(t => `<span>${esc(t)}</span>`).join('') : '';
    },
    hide() { root.classList.remove('on'); edge.classList.remove('on'); target = null; cache = ''; },
    clear() { root.classList.remove('on'); edge.classList.remove('on'); target = null; cache = ''; result.classList.remove('on'); count.classList.remove('on'); resultT = 0; },
    count(big, sub) { count.innerHTML = `${esc(big)}${sub ? `<small>${esc(sub)}</small>` : ''}`; count.classList.remove('on'); void count.offsetWidth; count.classList.add('on'); countT = 1.1; },
    toast(text, sub, neg) {
      const e = mk('ev-toast' + (neg ? ' neg' : ''), esc(text) + (sub ? `<small>${esc(sub)}</small>` : ''), toasts);
      while (toasts.children.length > 3) toasts.firstChild.remove();
      setTimeout(() => e.remove(), 1950);
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
      if (!target) edge.classList.remove('on'); else edgeArrow();
      if (target) {
        camera.getWorldDirection(_d);
        elArrowSvg.style.transform = `rotate(${(Math.atan2(_d.x, _d.z) - Math.atan2(target.x - car.x, target.z - car.z)) * -180 / Math.PI}deg)`;
      }
    },
  };
  return api;
}
