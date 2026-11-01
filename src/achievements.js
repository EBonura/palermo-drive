// Secret achievements: hidden (a "???" card in Collezioni, "Segreti") until unlocked, then a big short banner with a chime. Saved in localStorage.
// Owned by the missions work (created by src/missions.js, which also hands the list to the Collezioni screen through missions.progress().secrets).
//
// To add a secret, add ONE entry to SECRETS below:
//   id     unique, kebab-case, never changed once shipped (it is the saved key)
//   title  [italiano, english], shown on the banner and on the unlocked card
//   note   [italiano, english], one line that says what the player did (shown only after unlocking)
//   on     { event, when(detail) }  unlocks when a window event fires and `when` says yes (pass no `when` to accept every event), and/or
//   poll   (dt, env) => boolean     checked every frame while driving; env = { car, groundY, speed, game }
// Any other module can also unlock a secret directly: dispatchEvent(new CustomEvent('pd-secret', { detail: { id } })).
//
// createAchievements({ game, car, groundY }) -> { update(dt), unlock(id), has(id), list() }
//   list() -> [{ id, on, title, note, at }] in the order of SECRETS; locked entries still carry title and note (the UI must not show them).
import * as THREE from 'three';

const KEY = 'palermoDrive.secrets.v1';
const clamp = THREE.MathUtils.clamp;
// Baby Luna: src/bridges.js (the bridge model) fires the window event 'pd-landmark' { id: 'baby-luna-jump', x, z, fall } when the lapa falls off the Ponte Corleone.
// A first version of this module guessed it from the ground height under the lapa near the bridge; with a modelled deck that guess would fire on every crossing
// (the terrain is carved under the deck), so it was removed.

// ------------------------------------------------------------------------------------------------ the secrets
export const SECRETS = [
  { id: 'cicchetto-krust', title: ['Cicchetto al Krust', 'A Shot at Krust'],
    note: ['Ti sei fermato alla porta del Krust, di notte.', 'You stopped at the door of Krust, at night.'],
    on: { event: 'pd-pub-stop', when: d => d.id === 'krust' } },                                  // src/pubs.js fires it 1.5 s after the lapa stands still at a door after dark
  { id: 'baby-luna', title: ['Bba ieccati ru baby luna', 'Bba ieccati ru baby luna'],
    note: ['Ti sei buttato dal Ponte Corleone, accanto al vecchio Baby Luna.', 'You jumped off the Ponte Corleone, next to the old Baby Luna bar.'],
    on: { event: 'pd-landmark', when: d => d.id === 'baby-luna-jump' } },                         // src/bridges.js: the lapa fell off the Ponte Corleone (LANDMARK_ZONES)
];

// ------------------------------------------------------------------------------------------------ banner and chime
const CSS = `
.pd-secret { position: fixed; z-index: 70; left: 50%; top: max(18%, calc(env(safe-area-inset-top) + 76px)); width: min(440px, 86vw); transform: translateX(-50%) scale(.6) skewX(-5deg); opacity: 0; pointer-events: none;
  text-align: center; color: #fff; text-transform: uppercase; font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; padding: 10px 18px 12px;
  background: linear-gradient(180deg, rgba(11,7,9,.94), rgba(70,14,44,.92)); border: 2px solid #ffcf4a; box-shadow: 0 0 34px rgba(255,207,74,.55), 0 0 60px rgba(232,85,154,.4); }
.pd-secret.on { animation: pd-secret-in .55s cubic-bezier(.2,1.5,.4,1) forwards; }
.pd-secret.off { animation: pd-secret-out .5s ease-in forwards; }
.pd-secret > * { transform: skewX(5deg); }
.pd-secret small { display: block; font-weight: 700; font-size: clamp(11px, 2.4vh, 14px); letter-spacing: .3em; color: #ffcf4a; }
.pd-secret b { display: block; margin: 3px 0 2px; font: 400 clamp(22px, 6vh, 40px)/1.05 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .05em; text-shadow: 0 0 14px #e8559a, 0 3px 6px rgba(0,0,0,.6); -webkit-text-stroke: 1px #0b0709; paint-order: stroke fill; text-transform: none; }
.pd-secret span { display: block; font-weight: 600; font-size: clamp(11px, 2.5vh, 15px); letter-spacing: .08em; opacity: .88; text-transform: none; }
.pd-secret i { position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; margin: -4px; background: #ffcf4a; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); opacity: 0;
  animation: pd-secret-spark 1.1s ease-out forwards; animation-delay: var(--d); transform: skewX(5deg); }
@keyframes pd-secret-in { 0% { opacity: 0; transform: translateX(-50%) scale(.6) skewX(-5deg); } 100% { opacity: 1; transform: translateX(-50%) scale(1) skewX(-5deg); } }
@keyframes pd-secret-out { to { opacity: 0; transform: translateX(-50%) translateY(-18px) scale(.96) skewX(-5deg); } }
@keyframes pd-secret-spark { 0% { opacity: 1; transform: translate(0, 0) scale(.4) skewX(5deg); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(1.5) skewX(5deg); } }
.pd-sec .pd-colh b { color: #ffcf4a; }
.pd-sec.lock { opacity: .7; } .pd-sec.lock .pd-colh span { letter-spacing: .4em; }
.pd-sech { margin-top: 6px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.18); }
`;

export function createAchievements({ game, car, groundY }) {
  const speed = () => Math.hypot(car.vx, car.vz);
  const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
  let saved = {};
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && typeof p === 'object') saved = p; } catch (e) { /* storage unavailable */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ } };
  const byId = new Map(SECRETS.map(s => [s.id, s]));
  const has = id => !!saved[id];

  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const box = document.createElement('div'); box.className = 'pd-secret'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box);
  const queue = []; let showing = false;

  let ac = null;
  function chime() {   // a short rising arpeggio, own AudioContext made on the first unlock (after a key press, so it is allowed to start)
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); ac.resume?.().catch?.(() => {});
      const t0 = ac.currentTime + 0.02, vol = clamp(game?.settings?.volume ?? 0.8, 0, 1) * 0.22;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        for (const [type, m, g0] of [['triangle', 1, 1], ['sine', 2, 0.35]]) {
          const o = ac.createOscillator(), e = ac.createGain(), t = t0 + i * 0.11;
          o.type = type; o.frequency.value = f * m; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol * g0, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, t + 0.55 + (i === 3 ? 0.5 : 0));
          o.connect(e); e.connect(ac.destination); o.start(t); o.stop(t + 1.2);
        }
      });
    } catch (e) { /* no audio: the banner is enough */ }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function next() {
    const s = queue.shift(); if (!s) { showing = false; return; }
    showing = true; const l = lang();
    let sparks = ''; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + Math.random() * 0.3, r = 110 + Math.random() * 90; sparks += `<i style="--x:${Math.round(Math.cos(a) * r * 1.5)}px;--y:${Math.round(Math.sin(a) * r * 0.6)}px;--d:${(0.1 + Math.random() * 0.25).toFixed(2)}s"></i>`; }
    box.innerHTML = `${sparks}<small>${l ? 'SECRET UNLOCKED' : 'SEGRETO SBLOCCATO'}</small><b>${esc(s.title[l])}</b><span>${esc(s.note[l])}</span>`;
    box.className = 'pd-secret'; void box.offsetWidth; box.className = 'pd-secret on'; chime();
    setTimeout(() => { box.className = 'pd-secret off'; setTimeout(next, 650); }, 5200);
  }
  function unlock(id) {
    const s = byId.get(id); if (!s || saved[id]) return false;
    saved[id] = Date.now(); persist(); queue.push(s); if (!showing) next();
    return true;
  }
  // window events
  for (const s of SECRETS) if (s.on) addEventListener(s.on.event, e => { if (!s.on.when || s.on.when(e.detail || {})) unlock(s.id); });
  addEventListener('pd-secret', e => { if (e.detail && e.detail.id) unlock(e.detail.id); });

  const env = { car, groundY, speed, game };
  function update(dt) { for (const s of SECRETS) if (s.poll && !saved[s.id] && s.poll(dt, env)) unlock(s.id); }
  const list = () => SECRETS.map(s => ({ id: s.id, on: !!saved[s.id], title: s.title, note: s.note, at: saved[s.id] || 0 }));
  return { update, unlock, has, list, SECRETS, reset() { saved = {}; persist(); } };
}
