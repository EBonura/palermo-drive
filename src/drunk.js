// Alcohol. Stop at a pub's door after dark (src/pubs.js) or on the rave's dance floor at night (src/rave.js) and a Vivi button appears (key B, or a tap on the phone). A drink costs
// a couple of euros from the Garage wallet (src/garage.js debit; the rave is free once the speakers are in, because the lapa brought them, and a pub is free for the rest of the night
// after its errand is brought home, as its thanks promise). Each drink stacks, and the screen goes: a slow roll and sway of the camera, and (the part that makes it unmistakable) a screen-space
// shader pass: the whole picture ripples and swims, breathes in and out, blurs in pulses every few seconds and, from three drinks, sees double. It is plain from the first drink and properly
// silly at six. It wears off over a few minutes of play, is cleared when the game goes back to the menu and is never saved. The wobble is the picture only: steering and physics are untouched,
// and the camera is changed just for the render and put back straight after (render below, called from src/main.js), so no other module ever sees it.
// Sober play costs exactly nothing: until the first drink there is no render target and no extra draw, the scene goes to the canvas as ever; while drunk the scene is drawn to a render target
// (the size of the drawing buffer, 4x multisampled, half float so the sun and the lamps are still HDR) and one full-screen triangle with the shader brings it to the canvas, applying the
// renderer's tone mapping and colour space there (they are skipped for a render target); the target is freed again a moment after the last drink wears off.
// createDrunk({ game, car, camera, missions }) -> { update(dt), render(renderer, scene, camera, skip), reset(), drink(), setUnits(n), units, level, spot, price }
//   missions: the missions api (src/missions.js), for its pubs (doors) and its rave; both are optional, without them there is simply nothing to drink at.
//   Test links: ?debug puts it on window.game.drunk (setUnits(n) stacks n drinks at once). Reduced motion (prefers-reduced-motion) keeps a much gentler version: a slow soft blur and a slight, slow roll,
//   with no rippling, no zoom, no sway and no double vision.
import * as THREE from 'three';
import { garage } from './garage.js';
import { zone } from './hud.js';

const PRICE = 2;            // euro per drink at a pub (garage.debit takes whole euro)
const COOL = 1.4;           // seconds before the next drink can be asked for
const MAX = 6;              // drinks that can be stacked; the barman refuses the seventh
const WEAR = 75;            // seconds of play for one drink to wear off (a stack of three takes a bit under four minutes)
// Where a pub pours: near its door (a little more than the 7 m of the 'pd-pub-stop' event of src/pubs.js) or near the road point that its errand ends at (src/pub-routes.js).
// Some doors sit in pedestrian piazzas with buildings between them and the road, so the lapa gets only so close (measured by driving at each door from eight sides): they have a wider reach.
const DOOR_R = 9, ROAD_R = 12, REACH = { taverna: 14, magione: 16, monkey: 16 };
const RAVE_R = 55;          // metres from the middle of the dance floor: its rim is 15 m out, the place where the speakers are delivered 7 m, the track to it leaves Viale Ercole 58 m away
const STILL = 1.5, GO = 3;  // m/s: standing still counts below STILL (for 0.4 s), the button goes away above GO
const ROLL = 0.16, YAW = 0.06, PITCH = 0.025, ZOOM = 0.04, SIDE = 0.45;   // the camera wobble at full strength: radians, a fraction of the field of view, metres
const IDLE = 2;             // seconds sober before the render target is freed

// What a pub pours (the drink of its own errand where there is one) and what the rave has; [palermitan, english] pairs are for the owner to correct.
const DRINK = { krust: 'Moretti', whisky: 'Whisky', taverna: 'Zibibbu', punkfunk: 'Birra', magione: 'Birra', lizard: 'Birra', monkey: 'Paulaner', sanlorenzo: 'Birra artigianali' };
const RAVE_DRINKS = ['Vodka e Red Bull', 'Spritz', 'Amaro', 'Birra a canna'];
// after the nth drink of the stack
const LINES = [
  ['Ah, accussì sì!', 'Ah, now we are talking!'],
  ['A strata accumincia ad abballari.', 'The road is starting to dance.'],
  ['Dui strati? Pigghiu chidda ri mienzu.', 'Two roads? I will take the one in the middle.'],
  ['A lapa va sula. Iu mi fidu.', 'The lapa drives itself. I trust it.'],
  ['Chi è ’sta giuastra?', 'What is this merry-go-round?'],
  ['Tuttu gira, ma iu mi siantu u rre.', 'Everything spins, but I feel like a king.'],
];
// now and then, at any drink, instead of the line for that drink (owner's lines)
const BOAST = [["L'acqua fa ruggine!", 'Water makes you rust!'], ["E ppu gradiri si nn'ammucco 60 litra!", 'And just to be polite, he downed 60 litres!']];
const drinkLine = n => pick(Math.random() < 0.3 ? BOAST[(Math.random() * BOAST.length) | 0] : LINES[Math.min(LINES.length, n) - 1]);
const CUT = ['Basta! Ti n’adduni ca parri cû lampiuni?', 'Enough! Do you realise you are talking to a lamp post?'];
const BROKE = [
  ['Sienza picciuli un si vivi. Va’ a travagghiari!', 'No money, no drink. Go and work!'],
  ['Un hai picciuli? Talìa sutta u sidili.', 'No money? Look under the seat.'],
  ['Ci vonnu dui euru, un abbasta taliari.', 'It takes two euros, looking is not enough.'],
  ['Acqua ro rubinettu? Chidda è gratis.', 'Tap water? That one is free.'],
];
const FREE = ['Gratis! I casse i puaittasti tu.', 'On the house! You brought the speakers.'];
// A finished errand (src/event-pubs.js) pays in drinks too, as the thanks of the house promise (src/pub-places.js): how many are free for the rest of that night.
// Krust says the beer is free tonight; Whisky, Taverna, PunkFunk, Monkey and Sanlorenzo promise one (a shot, a glass, the first round, a Paulaner, the first beer); Magione and Lizard promise none.
const FREE_ROUND = { krust: Infinity, whisky: 1, taverna: 1, punkfunk: 1, monkey: 1, sanlorenzo: 1 };
const FREE_PUB = ['Offri a casa, comu ti dissi!', 'On the house, as I told you!'];
const GONE = ['Ti passau!', 'It wore off!'], GONE_SUB = ['Torni a vidiri una strata sula.', 'You see just one road again.'];

// The picture of a drunk: ripples, a swirl and a breathing zoom (uWave), a blur in pulses (uBlur, a radius as a fraction of the picture height), a second image (uGhost, its offset) and a dimming
// of the edges (uVig). The target wraps mirrored, so the edge of the picture never smears however far it is pushed.
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `
uniform sampler2D tDiffuse; uniform float uTime, uAspect, uWave, uBlur, uGhost, uVig; varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5, a = vec2(uAspect, 1.0);
  float r2 = dot(c * a, c * a), t = uTime;
  float ang = uWave * 0.07 * sin(t * 0.5) * (0.4 + r2 * 2.0);
  c = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * c;
  c *= 1.0 - 0.03 * uWave - uWave * (0.045 * sin(t * 0.63) + 0.05 * r2 * sin(t * 0.77 + 1.0));
  vec2 uv = c + 0.5;
  uv.x += uWave * (0.011 * sin(uv.y * 10.0 + t * 1.9) + 0.005 * sin(uv.y * 23.0 - t * 2.9));
  uv.y += uWave * (0.010 * sin(uv.x * 8.0 + t * 1.5) + 0.004 * sin(uv.x * 19.0 + t * 2.3));
  vec3 col = texture2D(tDiffuse, uv).rgb;
  if (uBlur > 0.0004) {
    vec2 s = vec2(uBlur / uAspect, uBlur); float rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
    for (int i = 0; i < 8; i++) {
      float f = (float(i) + 0.5) / 8.0, q = rot + float(i) * 2.39996;
      col += texture2D(tDiffuse, uv + vec2(cos(q), sin(q)) * sqrt(f) * s).rgb;
    }
    col /= 9.0;
  }
  if (uGhost > 0.0004) {
    vec2 o = vec2(cos(t * 0.45), 0.4 * sin(t * 0.63 + 1.0)) * uGhost;
    col = mix(col, texture2D(tDiffuse, uv + o).rgb, 0.5) ;
  }
  col *= 1.0 - uVig * smoothstep(0.25, 0.95, sqrt(r2));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CSS = `
#pd-drink { display: none; }
#pd-drink.on { display: block; pointer-events: auto; }
#pd-drink button { display: flex; align-items: center; gap: 10px; min-width: 150px; min-height: 48px; padding: 6px 20px 6px 10px; margin: 0; border: 2px solid #e8559a; border-radius: 0; cursor: pointer; transform: skewX(-6deg);
  background: linear-gradient(90deg, rgba(11,7,9,.9), rgba(60,14,40,.88)); box-shadow: 0 0 22px rgba(232,85,154,.45), 0 3px 10px rgba(0,0,0,.45); color: #fff; text-align: left;
  font-family: 'Barlow Condensed','Arial Narrow',system-ui,sans-serif; text-transform: uppercase; -webkit-tap-highlight-color: transparent; touch-action: none; }
#pd-drink button > * { transform: skewX(6deg); }
#pd-drink.wait button { opacity: .55; }
#pd-drink kbd { flex: 0 0 auto; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 5px; background: #e8559a; color: #0b0709; font: 700 15px/1 system-ui, sans-serif; }
html.touch #pd-drink kbd { display: none; }
#pd-drink b { display: block; font: 400 clamp(20px, 5.4vh, 30px)/1 'Racing Sans One','Barlow Condensed',Impact,sans-serif; letter-spacing: .06em; text-shadow: 0 0 12px #e8559a; }
#pd-drink small { display: block; margin-top: 2px; font-weight: 700; font-size: clamp(10px, 2.3vh, 13px); letter-spacing: .12em; color: #f5a9c9; white-space: nowrap; }
`;

export function createDrunk({ game, car, camera, missions }) {
  const lang = () => (document.documentElement.lang === 'en' ? 1 : 0);
  const pick = a => a[lang()];
  const toast = (text, sub, neg) => dispatchEvent(new CustomEvent('pd-toast', { detail: { text, sub, neg } }));   // shown by src/event-hud.js
  const rm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let calm = !!(rm && rm.matches);
  rm?.addEventListener?.('change', e => { calm = e.matches; });

  let units = 0, shown = 0, clock = 0, cool = 0, count = 0, still = 0, spot = null, visible = false, key = '', lastBroke = -1, noted = '', nightNo = 0, wasDark = false;
  const perks = {}, paid = new WeakSet();   // perks[pub id] = { night, left }: free drinks earned by an errand, valid in the night they were earned
  const sp = new THREE.Vector3(), rt = new THREE.Vector3(), sq = new THREE.Quaternion(), qq = new THREE.Quaternion(), ee = new THREE.Euler(0, 0, 0, 'YXZ');
  let sf = 0, saved = false;

  // ------------------------------------------------------------------ the button
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const box = document.createElement('div'); box.id = 'pd-drink'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<button type="button" tabindex="-1"><kbd>B</kbd><span><b></b><small></small></span></button>';
  zone('act').appendChild(box);
  const elB = box.querySelector('b'), elS = box.querySelector('small');
  box.querySelector('button').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drink(); });   // on the press, like the driving pads
  addEventListener('keydown', e => {
    if (e.code !== 'KeyB' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (visible) drink();
  });

  // ------------------------------------------------------------------ where a drink can be had
  function findSpot() {
    if (car.agl > 3) return null;   // up on the wings (src/vehicle-air.js) nothing is poured
    const night = game.time && game.time.night > 0.5;
    if (missions?.state?.ev) { const k = missions.state.ev.slot && missions.state.ev.slot.kind; if (k !== 'pub' && k !== 'leaf') return null; }   // a fare, a race, a delivery: no button in a timed run (the pub errand and the leaves keep it)
    const r = missions?.rave;
    if (r && r.live() && Math.hypot(car.x - r.site.x, car.z - r.site.z) < RAVE_R) return { id: 'rave', free: r.powered(), name: '', rave: true };
    if (night && missions?.pubs) for (const v of missions.pubs.venues) {
      const id = v.def.id;
      if (Math.hypot(car.x - v.door.x, car.z - v.door.z) >= (REACH[id] || DOOR_R) && Math.hypot(car.x - v.slot.x, car.z - v.slot.z) >= ROAD_R) continue;
      const pk = perks[id];
      return { id: 'pub:' + id, free: !!(pk && pk.night === nightNo && pk.left > 0), perk: pk, name: DRINK[id] || 'Birra' };
    }
    return null;
  }

  // ------------------------------------------------------------------ drinking
  function drink() {
    if (!visible || !spot || cool > 0 || game.state !== 'play') return;
    cool = COOL;
    if (units > MAX - 1 + 0.001) { toast(pick(CUT), pick(['Un te n’abbuschi chiù.', 'No more for you.']), true); return; }
    if (!spot.free) {
      if (!(garage.cash >= PRICE && garage.debit(PRICE) >= PRICE)) {
        let i = Math.floor(Math.random() * BROKE.length); if (i === lastBroke) i = (i + 1) % BROKE.length; lastBroke = i;
        toast(pick(['Sienza picciuli!', 'No money!']), pick(BROKE[i]), true); return;
      }
    }
    units += 1; count += 1;
    const n = Math.ceil(units), name = spot.id === 'rave' ? RAVE_DRINKS[(count - 1) % RAVE_DRINKS.length] : spot.name;
    let sub = drinkLine(n);
    if (spot.free && spot.perk) spot.perk.left--;
    if (spot.free && noted !== spot.id) { noted = spot.id; sub = pick(spot.rave ? FREE : FREE_PUB); }
    toast(name + (n > 1 ? '  ×' + n : ''), sub);
  }

  // A drink offered by another player (src/p2p/p2p.js): no pub needed and nothing to pay here (the giver paid). Returns false when the stack is full.
  function gift(name) {
    if (game.state !== 'play') return false;
    if (units > MAX - 1 + 0.001) { toast(pick(CUT), pick(['Un te n’abbuschi chiù.', 'No more for you.']), true); return false; }
    units += 1; count += 1;
    const n = Math.ceil(units);
    toast(name + (n > 1 ? '  ×' + n : ''), drinkLine(n));
    return true;
  }

  function reset() { units = 0; shown = 0; count = 0; cool = 0; still = 0; noted = ''; visible = false; spot = null; for (const k in perks) delete perks[k]; }

  // ------------------------------------------------------------------ per frame
  function update(dt) {
    if (game.state === 'title') { if (units || shown || visible || Object.keys(perks).length) reset(); }
    const play = game.state === 'play';
    const dark = !!(game.time && game.time.night > 0.5);
    if (dark && !wasDark) nightNo++;   // a new night: the free drinks of the last one are used up
    wasDark = dark;
    const er = missions?.pubs?.errand?.state;   // an errand that has just been brought home (src/event-pubs.js finish(true) sets pay)
    if (er && er.phase === 'done' && er.pay > 0 && !paid.has(er)) { paid.add(er); const n = FREE_ROUND[er.venue.def.id]; if (n) perks[er.venue.def.id] = { night: nightNo, left: n }; }
    if (play) {
      clock += dt; cool = Math.max(0, cool - dt);
      if (units > 0) { units = Math.max(0, units - dt / WEAR); if (units === 0) { toast(pick(GONE), pick(GONE_SUB)); count = 0; } }
    }
    // the picture follows the stack gently, so a drink swells in over a couple of seconds and a wearing-off drifts away
    shown += (Math.min(1, Math.pow(units / MAX, 0.7)) - shown) * Math.min(1, dt * 0.9);
    if (shown < 0.001 && units === 0) shown = 0;
    // the button
    spot = play ? findSpot() : null;
    const v = spot ? Math.hypot(car.vx, car.vz) : 1e9;
    still = v < STILL ? still + dt : v >= GO ? 0 : still;
    const want = !!spot && still >= 0.4;
    if (want !== visible) { visible = want; box.classList.toggle('on', want); box.setAttribute('aria-hidden', want ? 'false' : 'true'); if (!want && !spot) noted = ''; }
    if (!visible) return;
    box.classList.toggle('wait', cool > 0);
    const price = spot.free ? pick(['Gratis', 'Free']) : '€ ' + PRICE, k = [lang(), spot.id, spot.free].join('~');
    if (k !== key) {
      key = k;
      elB.textContent = pick(['Vivi', 'Drink']);
      elS.textContent = spot.id === 'rave' ? price : spot.name + ' · ' + price;   // the place and the price: the button's word is the only one in a language
    }
  }

  // ------------------------------------------------------------------ the wobble: the camera's own frame, then the screen pass (src/main.js calls render instead of renderer.render)
  function apply(k) {
    saved = false;
    sp.copy(camera.position); sq.copy(camera.quaternion); sf = camera.fov; saved = true;
    const a = calm ? 0.25 : 1, t = clock * (calm ? 0.6 : 1);
    const lurch = calm ? 0 : k * k * k * Math.sin(t * 1.35 + 0.4);   // only the stack of several drinks gets the quicker second beat
    const roll = a * k * (ROLL * (0.65 * Math.sin(t * 0.55) + 0.35 * Math.sin(t * 0.93 + 1.7)) + 0.03 * lurch);
    const yaw = a * k * (YAW * Math.sin(t * 0.37 + 0.6) + 0.02 * k * lurch);
    const pitch = a * k * PITCH * Math.sin(t * 0.47 + 2.2);
    camera.quaternion.multiply(qq.setFromEuler(ee.set(pitch, yaw, roll)));
    if (!calm) {
      camera.position.addScaledVector(rt.set(1, 0, 0).applyQuaternion(camera.quaternion), k * SIDE * Math.sin(t * 0.42 + 1));   // sideways across the view
      camera.fov = sf * (1 + k * ZOOM * Math.sin(t * 0.8));
      camera.updateProjectionMatrix();
    }
  }
  function restore() {
    if (!saved) return;
    saved = false;
    camera.position.copy(sp); camera.quaternion.copy(sq);
    if (camera.fov !== sf) { camera.fov = sf; camera.updateProjectionMatrix(); }
  }

  // the render target and the full-screen pass, made at the first drink and dropped IDLE seconds after the last one wore off
  let post = null, idleAt = 0;
  const sz = new THREE.Vector2();
  function makePost(renderer) {
    const hf = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
    const target = new THREE.WebGLRenderTarget(4, 4, { type: hf ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4, depthBuffer: true, generateMipmaps: false });
    target.texture.wrapS = target.texture.wrapT = THREE.MirroredRepeatWrapping;
    const uniforms = { tDiffuse: { value: target.texture }, uTime: { value: 0 }, uAspect: { value: 1.78 }, uWave: { value: 0 }, uBlur: { value: 0 }, uGhost: { value: 0 }, uVig: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const scn = new THREE.Scene(); scn.add(quad);
    return { target, uniforms, mat, quad, scn, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }
  function dropPost() { idleAt = 0; if (!post) return; post.target.dispose(); post.mat.dispose(); post.quad.geometry.dispose(); post = null; }
  const smooth = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };

  // Draws the frame: the plain way when sober (nothing extra at all), through the target and the shader pass while drunk. Returns nothing.
  function render(renderer, scene, cam, skip) {
    if (skip || game.state !== 'play' || shown <= 0.002) {
      if (post && shown <= 0.002) { const now = performance.now(); if (!idleAt) idleAt = now; else if (now - idleAt > IDLE * 1000) dropPost(); }
      renderer.render(scene, cam);
      return;
    }
    idleAt = 0;
    // a floor under the first drink so it reads at once, then the stack takes it to full
    const k = shown, lvl = 0.5 + 0.5 * k, t = clock * (calm ? 0.6 : 1);
    apply(k);
    if (!post) post = makePost(renderer);
    renderer.getDrawingBufferSize(sz);
    if (post.target.width !== sz.x || post.target.height !== sz.y) post.target.setSize(sz.x, sz.y);
    // the blur comes in pulses: every few seconds the picture goes soft for a moment, more often and deeper with more drinks
    const wave = Math.sin(t * 0.8 + 0.7 * Math.sin(t * 0.23)), pulse = smooth(0.62 - 0.35 * k, 0.97, wave);
    const u = post.uniforms;
    u.uTime.value = t; u.uAspect.value = sz.x / sz.y;
    if (calm) { u.uWave.value = 0; u.uGhost.value = 0; u.uBlur.value = pulse * 0.0035 * lvl; u.uVig.value = 0; }
    else {
      u.uWave.value = lvl;
      u.uBlur.value = pulse * (0.004 + 0.014 * k) + 0.0012 * k;
      u.uGhost.value = smooth(0.4, 0.75, k) * (0.45 + 0.55 * smooth(-0.2, 0.7, Math.sin(t * 0.37 + 2))) * (0.004 + 0.018 * k);   // double vision from about three drinks, coming and going
      u.uVig.value = 0.5 * k * k * (0.5 + 0.5 * pulse);
    }
    const rtOld = renderer.getRenderTarget();
    renderer.setRenderTarget(post.target); renderer.render(scene, cam); restore();
    renderer.setRenderTarget(rtOld); renderer.render(post.scn, post.cam);
  }

  return { update, render, reset, drink, gift, setUnits(n) { units = Math.max(0, Math.min(MAX, n)); }, price: PRICE, get units() { return units; }, get post() { return !!post; }, get level() { return shown; }, get spot() { return spot; }, get visible() { return visible; }, get cool() { return cool; } };
}
