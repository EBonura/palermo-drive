// The Barbera's crowd reacts to the lapa (the stands are src/lmc-a.js + src/stadium-crowd.js, the platform of the playing area src/stadium-ground.js): while the lapa is on the track or the
// pitch, the stands jump and throw up their scarves (crowdState.hype, read by the crowd's shader), and they shout at it: a stream of small speech balloons from the seats in front of the
// camera (src/stadium-lines.js: who is this guy, get off the grass, call the police), with bursts when it comes in, drives fast, hits the ball, spins, parks, scores or misses (at most
// 8 at once, their own cap and element pool in src/shouts.js). The crowd is also heard (src/stadium-audio.js: loud inside, fading with distance outside, a roar for a goal, a groan for a
// near miss, tension as the ball nears a goal), and the car radio card turns into "La partita" while the lapa is inside (radio.takeover, theme 'match'): the score of the goals and a line
// of commentary about the lapa, the player's station ducked to silence and back when it leaves. Created by src/main.js; update(dt) while playing. The chants are the stock ones of every
// curva, written for the game: the owner may want his own.
import * as THREE from 'three';
import { pitchRing, pitchCentre } from './stadium-ground.js';
import { crowdState } from './stadium-crowd.js';
import { createBall } from './stadium-ball.js';
import { createStadiumAudio } from './stadium-audio.js';
import { FANS, COMMENT, SCORE } from './stadium-lines.js';
import { getRadio } from './radio.js';

export const CHANTS = ['FORZA PALERMO!', 'Alé alé rosanero!', 'Palermo, Palermo, Palermo!', 'Sempre con te, Palermo!'];
let R2 = 0; for (const p of pitchRing) R2 = Math.max(R2, (p[0] - pitchCentre.x) ** 2 + (p[1] - pitchCentre.z) ** 2); R2 = (Math.sqrt(R2) + 1) ** 2;
const inRing = (x, z) => { let c = false; for (let i = 0, j = pitchRing.length - 1; i < pitchRing.length; j = i++) { const a = pitchRing[j], b = pitchRing[i]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

export function createStadium(env) {
  const { car, camera } = env;
  const debug = location.search.includes('debug'), crowd = { crowd: true };
  const shout = (x, y, z, t) => env.shout(x, y, z, t, null, crowd);   // every balloon of the stands is a crowd one (src/shouts.js): own cap, never pushes the street's out
  const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
  const RIN = Math.sqrt(R2), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let time = 0, hype = 0, next = 3, last = -1, hold = 0; const dirV = new THREE.Vector3(), pv = new THREE.Vector3(), seatOut = [0, 0, 0];
  function chant() {
    const S = crowdState.seats; if (!S.length) return;
    camera.getWorldDirection(dirV);
    for (let k = 0; k < 14; k++) {
      const s = S[(Math.random() * S.length) | 0], dx = s[0] - camera.position.x, dz = s[2] - camera.position.z, d = Math.hypot(dx, dz);
      if (d < 18 || d > 95 || (dx * dirV.x + dz * dirV.z) / d < 0.25) continue;
      let i; do i = (Math.random() * CHANTS.length) | 0; while (i === last && CHANTS.length > 1); last = i;
      shout(s[0], s[1], s[2], CHANTS[i]); return;
    }
  }
  // a seat in front of the camera for the GOL balloon (null when none is near enough)
  function seat() {
    const S = crowdState.seats; if (!S.length) return null;
    camera.getWorldDirection(dirV);
    for (let k = 0; k < 14; k++) {
      const s = S[(Math.random() * S.length) | 0], dx = s[0] - camera.position.x, dz = s[2] - camera.position.z, d = Math.hypot(dx, dz);
      if (d < 12 || d > 110 || (dx * dirV.x + dz * dirV.z) / d < 0.1) continue;
      seatOut[0] = s[0]; seatOut[1] = s[1]; seatOut[2] = s[2]; return seatOut;
    }
    return null;
  }

  // ---- the stands shout: a line from a seat in front of the camera, not in the middle of the view and not on top of a balloon that is still up
  const recent = [], recentC = [], spots = [];   // the last lines used (so they do not repeat), where the balloons are on the screen: [x, y, until]
  const pick = (arr, mem) => { let l; for (let k = 0; k < 4; k++) { l = arr[(Math.random() * arr.length) | 0]; if (!mem.includes(l)) break; } mem.push(l); if (mem.length > 8) mem.shift(); return l; };
  function fan(cat) {   // true when a balloon went up
    const S = crowdState.seats; if (!S.length) return false;
    camera.getWorldDirection(dirV);
    for (let k = 0; k < 24; k++) {
      const s = S[(Math.random() * S.length) | 0], dx = s[0] - camera.position.x, dz = s[2] - camera.position.z, d = Math.hypot(dx, dz);
      if (d < 12 || d > 110 || (dx * dirV.x + dz * dirV.z) / d < 0.2) continue;
      pv.set(s[0], s[1], s[2]).project(camera);
      if (pv.z > 1 || Math.abs(pv.x) > 0.92 || pv.y < -0.05 || pv.y > 0.5 || (pv.x > 0.5 && pv.y > 0.05) || (pv.x < -0.5 && pv.y > 0.15) || (Math.abs(pv.x) < 0.2 && pv.y < 0.2)) continue;   // in the stands on screen, clear of the lapa, the minimap and the cards at the top
      let busy = false, slot = -1;
      for (let i = 0; i < spots.length; i++) { const p = spots[i]; if (p[2] <= time) slot = i; else if (Math.abs(p[0] - pv.x) < 0.22 && Math.abs(p[1] - pv.y) < 0.16) { busy = true; break; } }
      if (busy) continue;
      if (slot < 0 && spots.length < 12) { slot = spots.length; spots.push([0, 0, 0]); }
      if (slot >= 0) { const p = spots[slot]; p[0] = pv.x; p[1] = pv.y; p[2] = time + 3; }
      shout(s[0], s[1], s[2], pick(FANS[cat], recent)[lang()]); return true;
    }
    return false;
  }
  const queue = []; let qT = 0, idleT = 1, qTry = 0;
  const say = (cat, n = 1) => { for (let i = 0; i < n && queue.length < 8; i++) queue.push(cat); };

  // ---- La partita: the radio card while the lapa is inside, the sound of the stands
  const audio = createStadiumAudio({ getRadio });
  let inside = false, gone = 0, owner = false, anBound = false, duckK = 0, score = [0, 0], comment = null, commentHold = 0, cardKey = '', slowT = 0, tenseOn = false, idleC = 6;
  let lastTh = 0, spin = 0, donutCd = 0, parkT = 0, parkCd = 0, fastT = 0, fastCd = 0, nearCd = 0, cost = 0, frames = 0, off = false;
  const remark = (cat, secs = 3.5) => { comment = pick(COMMENT[cat], recentC); commentHold = secs; };
  const cardText = () => { const l = lang(); return { title: `${SCORE[l * 2]} ${score[0]} - ${score[1]} ${SCORE[l * 2 + 1]}`, artist: comment ? comment[l] : '' }; };
  function borrow() {
    const r = getRadio(); if (!r || r.takenOver) return;
    const t = cardText(); r.takeover({ label: 'La partita', title: t.title, artist: t.artist, theme: 'match', analyser: audio.analyser, level: () => 0.25 + 0.6 * hype, lock: true });
    owner = true; anBound = !!audio.analyser; cardKey = t.title + '|' + t.artist;
  }
  function refresh() {
    const r = getRadio(); if (!r) return;
    if (!owner) { borrow(); return; }   // a pub's song had the card when the lapa came in: take it once the song has faded
    if (!anBound && audio.analyser) { borrow2(); return; }
    const t = cardText(), k = t.title + '|' + t.artist; if (k === cardKey) return; cardKey = k; r.retext({ title: t.title, artist: t.artist });
  }
  function borrow2() { const r = getRadio(); if (r) { owner = false; r.release(); borrow(); } }   // the sound came up after the card did: take the card again with the bars wired to it
  function enter() {
    inside = true; score[0] = score[1] = 0; spin = 0; parkT = 0; lastTh = car.th; idleC = 6; tenseOn = false;
    remark('start', 5); say('enter', 4); audio.event('enter'); borrow();
  }
  function leave() {
    inside = false; queue.length = 0; if (owner) { owner = false; getRadio()?.release(); }
  }
  const react = {
    hit(sp) { if (off || !inside) return; say('hit', 1 + (Math.random() < 0.5 ? 1 : 0)); audio.event('cheer', clamp(sp / 14, 0.3, 1)); remark('hit', 3); },
    goal(side) { if (off) return; score[side]++; say('goal', 5); audio.event('goal'); remark(side === 0 ? 'goalHome' : 'goalAway', 6); },
    miss(kind) {
      if (off || !inside) return;
      if (kind === 'post') { say('near', 2); audio.event('groan'); remark('post', 4); } else if (kind === 'near') { say('near', 2); audio.event('groan'); remark('miss', 4); }
      else { say('miss', 2); audio.event('groan', true); remark(kind === 'bar' ? 'bar' : 'miss', 4); }
    },
  };
  // a goal keeps the stands at full hype for this many seconds (stadium-ball.js)
  const ball = createBall({ scene: env.scene, car, shout, seat, boost: s => { hold = s; hype = 1; }, react });
  if (debug) { window.__ball = ball; window.__stadium = { audio, say, get inside() { return inside; }, get off() { return off; }, set off(v) { off = !!v; }, get score() { return score; }, cost: () => ({ ms: cost / Math.max(1, frames), frames }), resetCost() { cost = 0; frames = 0; } }; }   // test hooks; off: the new reactions, sound and radio card are switched off

  // the new part of a frame: presence, the shouting, the reactions and the sound
  function fx(dt, on, dc) {
    const tn = inside ? ball.tension : 0, att = (1 - clamp((dc - RIN) / 380, 0, 1)) ** 2;
    if (dc < 800 || audio.active) audio.update(dt, off ? 0 : att, hype, tn, inside);
    if (off) { if (inside) leave(); return; }
    if (on) { gone = 0; if (!inside) enter(); } else if (inside && (gone += dt) > 1.5) leave();
    // the player's station goes down to nothing while La partita is on and comes back after
    if (inside || duckK > 0) {
      duckK = inside ? Math.min(1, duckK + dt * 1.5) : Math.max(0, duckK - dt * 1.2);
      const r = getRadio(); if (r) { if (duckK > 0) r.duckFor(duckK, 1); else r.duckFor(0); }
    }
    if (!inside) return;
    const sp = Math.hypot(car.vx, car.vz);
    // the fans shout all the time, in bursts for what the lapa does
    if ((idleT -= dt) <= 0) { idleT = 0.5 + Math.random() * 0.5; if (queue.length < 2) say('idle'); }
    if ((qT -= dt) <= 0 && queue.length) { if (fan(queue[0])) { queue.shift(); qTry = 0; qT = 0.12 + Math.random() * 0.18; } else { if (++qTry > 20) { queue.shift(); qTry = 0; } qT = 0.1; } }   // a line with no seat in view waits a couple of seconds for one (the camera is still settling after a jump)
    // fast: more than 13 m/s for a moment
    fastCd -= dt; if (sp > 13) { if ((fastT += dt) > 0.6 && fastCd <= 0) { fastCd = 7; fastT = 0; say('fast', 2); remark('fast'); } } else fastT = 0;
    // doughnuts: turning a lot for a while at a modest speed (the heading change adds up, and drains away when going straight)
    let dth = car.th - lastTh; lastTh = car.th; dth -= 6.2832 * Math.round(dth / 6.2832); donutCd -= dt;
    spin = Math.max(0, spin + (sp > 2.5 ? Math.abs(dth) : 0) - 0.8 * dt);
    if (spin > 9.5 && donutCd <= 0) { spin = 0; donutCd = 14; say('donut', 3); audio.event('jeer'); remark('donut', 5); }
    // parked: standing still for a while
    parkCd -= dt; if (sp < 0.7) { if ((parkT += dt) > 5 && parkCd <= 0) { parkCd = 15; parkT = 0; say('park', 3); remark('park', 5); } } else parkT = 0;
    // the ball nears a goal: the commentary says so once per approach
    if (tn > 0.6 && !tenseOn) { tenseOn = true; remark('tense', 4); } else if (tn < 0.25) tenseOn = false;
    // twice a second: the commentary between events, and the card's text (a score, a new line, the language)
    if ((slowT -= dt) <= 0) {
      slowT = 0.5; commentHold -= 0.5; nearCd -= 0.5;
      if (commentHold <= 0) {
        const s = ball.state;
        if (nearCd <= 0 && Math.hypot(s.bx - car.x, s.bz - car.z) < 14) { nearCd = 12; remark('near', 4); }
        else if ((idleC -= 0.5) <= 0) { idleC = 8; remark('idle', 6); }
      }
      refresh();
    }
  }

  return {
    ball,
    update(dt) {
      const t0 = debug ? performance.now() : 0;
      time += dt;
      const dx = car.x - pitchCentre.x, dz = car.z - pitchCentre.z, d2 = dx * dx + dz * dz, on = d2 < R2 && inRing(car.x, car.z);
      if (hold > 0) hold -= dt;
      hype += ((on || hold > 0 ? 1 : 0) - hype) * Math.min(1, dt * (on || hold > 0 ? 0.9 : 0.5));
      ball.update(dt, on);
      crowdState.hype = hype < 0.02 ? 0 : hype;
      if (hype > 0.7 && time >= next) { chant(); next = time + 5 + Math.random() * 5; }
      fx(dt, on, Math.sqrt(d2));
      if (debug) { cost += performance.now() - t0; frames++; }
    },
    get hype() { return hype; },
  };
}
