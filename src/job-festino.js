// The Festino di Santa Rosalia (a job module of the director, docs/missions-director.md): the night procession of the carro of the saint along the Cassaro, with the mayor on it, a dense crowd round it,
// fireworks at the Foro Italico, and the people who feel sick in the crowd, whom the lapa takes to the hospital. The owner: "tantissime persone in un posto, la santina, il sindaco sul carro che urla
// 'viva Palermo e santa Rosalia', e devo andare a prendere i cristiani ca si sientinu male"; it goes back and forth along its route.
// The real one (researched): the night of 14 July, from the Palazzo dei Normanni down the Cassaro (Corso Vittorio Emanuele) by the Cattedrale and the Quattro Canti, where the mayor climbs on the carro and shouts
// "Viva Palermo e Santa Rosalia!", to Porta Felice and the Foro Italico, where there are fireworks; the road is closed to cars. The carro that stands on the Foro Italico lawn all year (src/friend-stops.js)
// is another thing and stays (its builder is private to that file, so this carro is drawn here, in the same box and cylinder style: a boat shaped float, a tall stern tower, the saint on top, bulbs).
//
// When it is on: in the evening (19:30 to 03:00 game time) on about one night in three (a draw per night: the first night of a session from the real day number and a seed kept in localStorage, then one
// per game night, so that a reload the same day gives the same answer), always on the real 14 and 15 July, and always with ?festino=1 (any hour; ?time=22 for the evening). Off, nothing exists: tick()
// is one hour comparison. The cart's position is only a number (an arc length and a direction), moved every frame at WALK m/s: it walks the route (the Cassaro chained from the road data, D.roads,
// from the Palazzo Reale end to the Foro Italico, smoothed and resampled every STEP metres) and turns back at both ends after a pause, the whole night, wherever the lapa is. It starts each evening at the
// Quattro Canti, where the mayor climbs on.
// Built only when the lapa is within BUILD_R of the cart and dropped beyond DROP_R: the cart (2 draws: lit parts and bulbs, merged with vertex colours), the crowd (1 draw: the cast's own sprites through
// pedestrians.spriteCrowd, on the crowd's material and atlas, CROWD_N people on desktop, CROWD_PHONE on touch devices, positions worked out each frame from route coordinates), the
// mayor (a scripted pedestrian attached to the deck) and a solid box round the cart and the crowd behind it. The box is four segments of walls2d that sit out of play (at FAR) until built: the grid
// registers a segment by cell, so they are registered once in every cell along the route and then moved in place (the same way as src/rave.js and src/markets.js move theirs). The lapa never touches it
// and never rests in it: the procession waits while the lapa is within HOLD m of the box.
// The fireworks (one Points object, one shared shader, no JS per frame) burst over the sea at the Foro Italico end while it is night and the lapa is within SKY_R of it.
//
// The job, kind 'festino': while it is on and the lapa is within CALL_R of the cart, a call rings: somebody in the crowd feels sick. The caller waits on a kerb 40 to 80 m from the cart (a side street, or
// behind the procession); the sick person and a relative get in, then a timed run to the nearest hospital of the urgent runs (Civico, Policlinico or Villa Sofia, the ones the baked routes know), guided by
// X.guide.to. Pay by distance times PAY_X and a tip by the time left, as the urgent runs (src/event-fares.js, whose state is private: this is a small ride of its own).
// setup(X): called once by src/jobs.js. Words: [italian or palermitan, english]; the mayor's line is the owner's own, the rest is Palermitan in his spelling, drafted from his rulings and passed by him on 22 Nov 2026.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D } from './core.js';
import { JOBS, KIND_COLOR } from './event-calls.js';
import { PAY_X } from './economy.js';
import { esc } from './esc.js';

const WALK = 1.2, PAUSE = 14, STEP = 2;            // m/s of the carro, seconds it waits at each end, metres between the resampled points of the route
const BUILD_R = 500, DROP_R = 700, CALL_R = 1500, SKY_R = 2200;   // metres from the lapa: the cart and the crowd are built, dropped, a call may ring, the fireworks are drawn
const HOLD = 3.5, BOX = [-15, 9, 3.4];             // the carro waits while the lapa is this near its box; the box: metres behind, ahead (travel frame), half width
const CROWD_N = 250, CROWD_PHONE = 120;
const EVE0 = 19.5, EVE1 = 3, SHARE = 1 / 3;        // the evening (game hours, wrapping midnight) and the share of nights with a Festino
const FAR = 1e7;
const KERB = 0.9;                                  // metres the people along the kerbs stand beyond the half width of the street
const SPOT = [40, 80];                             // metres from the cart: where a sick person calls
const HOSPITALS = ['ospedale', 'policlinico', 'villasofia'];

// ---- words
const MAYOR = ['Viva Palermo e Santa Rosalia!', 'Long live Palermo and Santa Rosalia!'];   // the owner's line, letter for letter
const ANSWER = ['Viva!', 'Hooray!'];
const L = {
  call: [   // what the sick person shouts, and the card says (Palermitan: the owner passed these on 22 Nov 2026)
    ['Aiutu! Mmiazzu â fudda c’è un cristianu ca si sienti mali, puaittatilu ô spitali!', 'Help! A man feels sick in the crowd, take him to the hospital!'],
    ['Curri! Na signura sta mali cu stu cavuru, ô spitali!', 'Quick! A lady is ill in this heat, to the hospital!'],
    ['A un picciottu ci vinni un sintomu, puaittatilu ô spitali, curri!', 'A boy has fainted, take him to the hospital, quick!'],
  ],
  who: ['Un sintomu ô Fistinu', 'Taken ill at the Festino'],
  label: ['Un sintomu ô Fistinu', 'Taken ill at the Festino'],
  start: ['Curri, ô spitali!', 'Quick, to the hospital!'],
  board: ['Aiutatilu a acchianari!', 'Help them in!'],
  sick: [['Mi firria a testa...', 'My head is spinning...'], ['Chi cavuru, un puazzu ciatari...', 'So hot, I cannot breathe...'], ['Ahi, chi duluri...', 'Ow, it hurts...']],
  kin: [['Teni ruru, ci siemu quasi!', 'Hold on, nearly there!'], ['Cchiù lestu, pi favuri!', 'Faster, please!'], ['Ciata araciu, ciata.', 'Breathe slowly, breathe.']],
  arrive: ['Grazzi! A Santuzza ti binirici!', 'Thank you! May Santa Rosalia bless you!'],
  late: ['Ma unni stai iennu?! Stamu muriennu!', 'Where are you going?! We are dying!'],
  toast: ['U Fistinu râ Santuzza', 'Festino of Santa Rosalia'],
  toastSub: ['U carru camina pû Cassaru tutta a nuttata', 'The float walks the Cassaro all night'],
  fare: ['Cuoisa', 'Fare'], tipQ: ['Mancia lesta', 'Speed tip'], total: ['Tutali', 'Total'],   // the owner's words of src/event-fares.js
  timeUp: ['Tiempu scadutu!', 'Time is up!'], noPay: ['I passiggeri scinnunu e un pàganu', 'The passengers get out and do not pay'],   // the owner's words of src/event-fares.js
};
const LOOKS = ['nonno', 'signora', 'signora2', 'coppola', 'ragazzo', 'ragazzo2', 'borsa', 'shopper', 'teen'];   // who may be taken ill (cast ids of src/event-calls.js LOCAL_POOL)

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export default function setup(X) {
  const { scene, car, T, hud, eur, pedestrians, groundAt, walls2d, now } = X;
  const phone = !!X.phone, FORCE = !!X.params.get('festino') && X.params.get('festino') !== '0';
  const tx = (p) => T(p[0], p[1]);
  const real = (() => { const d = new Date(); return d.getMonth() === 6 && (d.getDate() === 14 || d.getDate() === 15); })();
  const hourNow = () => { const t = X.game && X.game.time; return t && Number.isFinite(t.hour) ? t.hour : -1; };

  // ---- the evening and the draw of the night
  let seed = 0; try { seed = +localStorage.getItem('palermoDrive.festino.seed') || 0; if (!seed) { seed = 1 + ((Math.random() * 1e9) | 0); localStorage.setItem('palermoDrive.festino.seed', String(seed)); } } catch (e) { seed = 7; }
  let nightN = Math.floor(Date.now() / 864e5), eve = null, tonight = false, on = false;
  const drawNight = () => real || mulberry(seed ^ (nightN * 2654435761))() < SHARE;

  // ---- the route: the Cassaro chained from the road data, smoothed, resampled (RX, RZ, TX, TZ every STEP metres)
  let RX = null, RZ = null, TX = null, TZ = null, RL = 0, N = 0, S_QC = 0, S_MIN = 0, S_MAX = 0, endSky = null;
  function buildRoute() {
    const ways = [];
    for (const r of D.roads) if (r.n && r.k !== 'footway' && r.k !== 'path') ways.push({ n: r.n, p: r.p, used: false });
    const ends = w => [[w.p[0], w.p[1]], [w.p[w.p.length - 2], w.p[w.p.length - 1]]];
    const cass = w => /^(Via|Corso) Vittorio Emanuele$/.test(w.n);
    let start = null, bx = 1e9;   // the west end of the Cassaro is where the chain begins
    for (const w of ways) if (cass(w)) for (const [i, e] of ends(w).entries()) if (e[0] < bx) { bx = e[0]; start = [w, i]; }
    if (!start) return false;
    const pts = [];   // the chain, flat x, z
    const append = (w, rev) => { const q = w.p; w.used = true; if (!rev) { for (let i = pts.length ? 2 : 0; i < q.length; i += 2) pts.push(q[i], q[i + 1]); } else { for (let i = q.length - (pts.length ? 4 : 2); i >= 0; i -= 2) pts.push(q[i], q[i + 1]); } };
    append(start[0], start[1] === 1);
    const grow = (pred, stop, front) => {   // the nearest unused way of pred starting within 30 m of the end of the chain, until the end is within `stop` metres of a place (or none is left)
      for (let n = 0; n < 60; n++) {
        const ex = pts[pts.length - 2], ez = pts[pts.length - 1];
        if (stop && Math.hypot(ex - stop[0], ez - stop[1]) < stop[2]) return;
        let best = null, bd = 30, brev = false;
        for (const w of ways) if (!w.used && pred(w)) for (const [i, e] of ends(w).entries()) { const d = Math.hypot(e[0] - ex, e[1] - ez); if (d < bd) { bd = d; best = w; brev = i === 1; } }
        if (!best) return;
        append(best, brev);
      }
    };
    grow(cass, null);
    // the west end: on to the Palazzo Reale, by the pieces of Corso Calatafimi (the Cassaro starts at Porta Nuova, which joins it); the east end: along the Foro Italico to the carro's lawn
    const pr = X.proj(38.1113, 13.3513), fo = X.proj(38.117952, 13.373192);
    pts.reverse(); for (let i = 0; i + 1 < pts.length; i += 2) { const a = pts[i], b = pts[i + 1]; pts[i] = b; pts[i + 1] = a; }   // reversed pairs: x, z order again (the array was reversed whole)
    grow(w => /Calatafimi/.test(w.n), [pr[0], pr[1], 60]);
    pts.reverse(); for (let i = 0; i + 1 < pts.length; i += 2) { const a = pts[i], b = pts[i + 1]; pts[i] = b; pts[i + 1] = a; }
    grow(w => /Foro Italico/.test(w.n), [fo[0], fo[1], 60]);
    // Chaikin twice, then the resample every STEP metres
    let P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    for (let k = 0; k < 2; k++) { const Q = [P[0]]; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; }
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    RL = cum[cum.length - 1]; N = Math.floor(RL / STEP) + 1;
    RX = new Float32Array(N); RZ = new Float32Array(N); TX = new Float32Array(N); TZ = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++) { const s = Math.min(i * STEP, RL); while (j < cum.length - 2 && cum[j + 1] < s) j++; const u = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1); RX[i] = P[j][0] + (P[j + 1][0] - P[j][0]) * u; RZ[i] = P[j][1] + (P[j + 1][1] - P[j][1]) * u; }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 3), b = Math.min(N - 1, i + 3), dx = RX[b] - RX[a], dz = RZ[b] - RZ[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
    const qc = X.proj(38.1158, 13.3616); let bd = 1e18; for (let i = 0; i < N; i++) { const d = (RX[i] - qc[0]) ** 2 + (RZ[i] - qc[1]) ** 2; if (d < bd) { bd = d; S_QC = i * STEP; } }
    S_MIN = 14; S_MAX = RL - 14;   // the carro turns back this far from the ends: the crowd round it needs the street
    // the sea side of the Foro Italico end: the side where the ground is lower
    const ex = RX[N - 1], ez = RZ[N - 1], nx = TZ[N - 1], nz = -TX[N - 1];
    const sd = groundAt(ex + nx * 80, ez + nz * 80) < groundAt(ex - nx * 80, ez - nz * 80) ? 1 : -1;
    endSky = { x: ex, z: ez, ox: nx * sd, oz: nz * sd, ax: TX[N - 1], az: TX[N - 1] === 0 ? 1 : TZ[N - 1] };
    return true;
  }
  const _p = { x: 0, z: 0, tx: 0, tz: 1 };
  function at(s, o = _p) {   // the route at arc length s: o.x, o.z, o.tx, o.tz (the unit tangent towards the Foro Italico)
    const f = clamp(s, 0, RL) / STEP, i = Math.min(N - 2, f | 0), u = f - i;
    o.x = RX[i] + (RX[i + 1] - RX[i]) * u; o.z = RZ[i] + (RZ[i + 1] - RZ[i]) * u;
    let a = TX[i] + (TX[i + 1] - TX[i]) * u, b = TZ[i] + (TZ[i + 1] - TZ[i]) * u; const l = Math.hypot(a, b) || 1; o.tx = a / l; o.tz = b / l;
    return o;
  }

  // ---- the carro itself: s (arc length), dir (+1 towards the Foro Italico), a pause at the ends
  const C = { s: 0, dir: 1, pause: 0, x: 0, z: 0, gy: 0, yaw: 0, dirVis: 1, k: 1, tx: 0, tz: 1, held: false, qcT: 0, shoutT: 8, toasted: false, d: 1e9 };
  let marker = null;
  const slot = { id: 'festino:1', kind: 'festino', sub: 'festino', name: 'Festino di Santa Rosalia', x: 0, z: 0, dx: 1, dz: 0, w: 6, callers: [], coolUntil: 0, shoutT: 0, holdT: 0, kerb: null, marker: null, ped: 'nonno', callLine: L.call,
    leash: () => ({ a: [slot.x, slot.z], b: slot.dest ? [slot.dest.x, slot.dest.z] : [slot.x, slot.z], r: 520 }), dest: null };

  // ---- a small kit: boxes, cylinders and spheres merged with their vertex colours
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  function Kit() {
    const bins = { lit: [], glow: [] };
    const add = (bin, geo, col, x, y, z, o = {}) => {
      geo.deleteAttribute('uv'); _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_v.set(x, y, z), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)); geo.applyMatrix4(_m);
      _c.set(col); const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); bins[bin].push(geo);
    };
    return {
      box: (col, w, h, d, x, y, z, o) => add('lit', new THREE.BoxGeometry(w, h, d), col, x, y, z, o),
      cyl: (col, rt, rb, h, x, y, z, o, seg = 10) => add('lit', new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o),
      sph: (col, r, x, y, z, o, seg = 8) => add('lit', new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), col, x, y, z, o),
      bulb: (col, x, y, z) => add('glow', new THREE.SphereGeometry(0.08, 5, 4), col, x, y, z),
      merged: bin => bins[bin].length ? mergeGeometries(bins[bin], false) : null,
    };
  }
  function statue(K, x, y, z, k) {   // Santa Rosalia: robe, shoulders, head, a crown of roses, arms open with roses in the hands, a gold halo
    K.cyl('#f1e8d2', 0.12 * k, 0.4 * k, 1.5 * k, x, y + 0.75 * k, z);
    K.cyl('#f1e8d2', 0.2 * k, 0.12 * k, 0.28 * k, x, y + 1.6 * k, z);
    K.sph('#f4f0e6', 0.15 * k, x, y + 1.88 * k, z);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; K.sph('#c9507a', 0.05 * k, x + Math.cos(a) * 0.16 * k, y + 2.0 * k, z + Math.sin(a) * 0.16 * k, {}, 6); }
    for (const sd of [-1, 1]) { K.cyl('#f1e8d2', 0.045 * k, 0.05 * k, 0.7 * k, x + sd * 0.3 * k, y + 1.45 * k, z, { rz: -sd * 0.9 }); K.sph('#e0668f', 0.08 * k, x + sd * 0.62 * k, y + 1.2 * k, z, {}, 6); }
    K.cyl('#d4a73c', 0.32 * k, 0.32 * k, 0.03 * k, x, y + 1.9 * k, z - 0.12 * k, { rx: Math.PI / 2 }, 14);
  }
  // local frame: x to the right, z along the travel (the bow), y up; the hull spans z -4.6 to 4.6, 4.4 m wide; the tower is at the stern; the deck is at DECK
  const DECK = 2.5, TOP = 10.4;
  function buildCart() {
    const K = Kit(), RED = '#a02a24', DRED = '#6e1b1b', GOLD = '#d4a73c', IVO = '#efe5cc', ROSE = '#e9a1bb', WOOD = '#6e4a2a';
    for (const sx of [-1, 1]) for (const sz of [-3, 3]) { K.cyl(WOOD, 0.85, 0.85, 0.4, sx * 2.05, 0.85, sz, { rz: Math.PI / 2 }, 14); K.cyl(GOLD, 0.3, 0.3, 0.46, sx * 2.05, 0.85, sz, { rz: Math.PI / 2 }, 8); }
    K.box(DRED, 3.6, 1.0, 8.4, 0, 1.2, 0);                                   // the lower hull
    K.box(RED, 4.4, 0.8, 9.0, 0, 2.1, 0);                                    // the upper hull, up to the deck
    K.box(GOLD, 4.5, 0.12, 9.1, 0, 2.5, 0); K.box(GOLD, 4.5, 0.12, 9.1, 0, 1.72, 0);   // gold trim
    K.box(RED, 3.6, 0.5, 1.3, 0, 2.85, 4.2); K.box(RED, 2.4, 0.5, 1.2, 0, 3.15, 5.0, { rx: -0.3 });   // the bow rises a little, like a prow
    K.box(GOLD, 0.4, 0.25, 1.2, 0, 3.55, 5.5, { rx: -0.5 }); K.sph(GOLD, 0.26, 0, 3.8, 5.9, {}, 8);
    for (let i = 0; i < 16; i++) for (const sx of [-1, 1]) { K.sph(i % 3 ? '#e0668f' : '#f3b6c9', 0.2, sx * 2.28, 2.2, -4.2 + i * 0.56, {}, 6); if (i % 2) K.sph('#4f7a3a', 0.14, sx * 2.28, 1.98, -3.95 + i * 0.56, {}, 5); }   // garlands of roses along the hull
    // the stern tower: two tiers, gilded columns, rose panels, an open temple with the saint
    K.box(IVO, 3.8, 2.2, 3.6, 0, 3.6, -2.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl(GOLD, 0.14, 0.14, 2.2, sx * 1.9, 3.6, -2.7 + sz * 1.8, {}, 8);
    for (const sx of [-1, 1]) { K.box(ROSE, 0.06, 1.5, 2.2, sx * 1.93, 3.6, -2.7); K.box(ROSE, 0.06, 1.5, 0.9, sx * 0.0 + 0, 3.6, -2.7 + 1.8 * (sx > 0 ? 1 : -1)); }
    K.box(ROSE, 2.6, 1.5, 0.06, 0, 3.6, -0.88); K.box(GOLD, 2.8, 0.1, 0.1, 0, 4.4, -0.84); K.box(GOLD, 2.8, 0.1, 0.1, 0, 2.8, -0.84); for (const sx of [-1, 1]) K.cyl(GOLD, 0.1, 0.1, 1.9, sx * 1.4, 3.6, -0.84, {}, 8);   // the front of the tower: a rose panel framed in gold
    K.box(GOLD, 3.9, 0.12, 3.7, 0, 3.0, -2.7); K.box(GOLD, 4.1, 0.25, 3.9, 0, 4.82, -2.7);
    K.box(IVO, 2.8, 1.9, 2.8, 0, 5.9, -2.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl(GOLD, 0.12, 0.12, 1.9, sx * 1.4, 5.9, -2.7 + sz * 1.4, {}, 8);
    for (const sx of [-1, 1]) K.box(ROSE, 0.06, 1.2, 1.6, sx * 1.43, 5.9, -2.7);
    K.box(GOLD, 3.1, 0.22, 3.1, 0, 6.97, -2.7);
    K.cyl(IVO, 0.55, 0.7, 0.5, 0, 7.3, -2.7, {}, 10); K.cyl(GOLD, 0.62, 0.62, 0.1, 0, 7.58, -2.7, {}, 10);   // the pedestal of the saint
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; K.cyl(GOLD, 0.07, 0.07, 2.5, Math.cos(a) * 1.25, 8.2, -2.7 + Math.sin(a) * 1.25, {}, 6); }   // the open temple round her
    K.cyl(GOLD, 1.45, 1.45, 0.14, 0, 9.5, -2.7, {}, 16); K.cyl(IVO, 1.2, 1.35, 0.3, 0, 9.7, -2.7, {}, 16); K.cyl(GOLD, 0.08, 0.08, 0.7, 0, 10.1, -2.7, {}, 6); K.sph(GOLD, 0.14, 0, 10.4, -2.7, {}, 6);
    statue(K, 0, 7.63, -2.7, 1.1);
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225; K.box(GOLD, 0.05, 0.7, 0.04, Math.sin(a) * 0.95, 9.0 + Math.cos(a) * 0.1, -2.95, { rz: -a }); }   // rays of the halo behind her head
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) statue(K, sx * 1.4, 4.95, -2.7 + sz * 1.55, 0.5);   // four little saints at the corners of the cornice
    // the foredeck: a gilded rail, the rostrum of the mayor, the tricolour
    for (const sx of [-1, 1]) { K.box(GOLD, 0.06, 0.06, 6.0, sx * 2.1, 3.3, 1.4); for (let i = 0; i < 7; i++) K.box(GOLD, 0.06, 0.8, 0.06, sx * 2.1, 2.9, -1.4 + i * 1.0); }
    K.box(GOLD, 1.5, 0.14, 1.2, 0, DECK + 0.07, 0.6); K.box(RED, 1.4, 0.04, 1.1, 0, DECK + 0.16, 0.6);
    for (const sx of [-1, 1]) { K.cyl('#3a3a3a', 0.04, 0.04, 2.6, sx * 1.9, 3.8, 3.7, {}, 5); K.box('#2f8a3f', 0.28, 0.5, 0.04, sx * 1.9 - 0.16, 4.8, 3.7); K.box('#f4f0e6', 0.28, 0.5, 0.04, sx * 1.9 + 0.12, 4.8, 3.7); K.box('#c42f2a', 0.28, 0.5, 0.04, sx * 1.9 + 0.4, 4.8, 3.7); }
    // bulbs along the cornices and the rail (they glow)
    for (let i = 0; i < 20; i++) for (const sx of [-1, 1]) { K.bulb('#ffe2a8', sx * 2.0, 4.82, -4.3 + i * 0.4); }
    for (let i = 0; i < 12; i++) for (const sx of [-1, 1]) K.bulb(i % 2 ? '#ffd27a' : '#ffe9c0', sx * 1.5, 6.97, -4.0 + i * 0.5);
    for (let i = 0; i < 16; i++) for (const sx of [-1, 1]) K.bulb('#ffe2a8', sx * 2.28, 2.5, -4.2 + i * 0.58);
    for (let i = 0; i < 10; i++) K.bulb('#fff0c8', Math.cos(i / 10 * 6.283) * 1.4, 9.42, -2.7 + Math.sin(i / 10 * 6.283) * 1.4);
    const g = new THREE.Group(), lit = new THREE.Mesh(K.merged('lit'), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#4a3a24') })), glow = new THREE.Mesh(K.merged('glow'), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    lit.castShadow = !phone; lit.receiveShadow = false; lit.frustumCulled = glow.frustumCulled = false; g.add(lit, glow);
    g.userData.tris = (lit.geometry.index.count + glow.geometry.index.count) / 3; g.userData.draws = 2;
    return g;
  }

  // ---- the crowd: the cast's own sprites (pedestrians.spriteCrowd: one draw call, the crowd's material and atlas), each placed in route coordinates (du along the travel from the
  // carro's centre, lv across). Those round the carro walk while it moves, those on the kerbs stand and watch; a cheer makes them hop.
  let cart = null, crowd = null, mayor = -1, built = false;
  const U = { uCheer: { value: 0 } };
  const people = { n: 0, du: null, lv: null, h: null, y: null, x: null, z: null, v: null, kind: null, jit: null };
  const CAST = ['nonna', 'nonna2', 'nonna3', 'coppola', 'coppola2', 'nonno', 'nonno_gilet', 'signora', 'signora2', 'suit', 'suit2', 'borsa', 'shopper', 'ragazzo', 'ragazzo2', 'teen', 'teen2', 'kid', 'kid2', 'tourist', 'tourist2', 'priest', 'fruttivendolo', 'pescivendolo'];
  function buildCrowd() {
    const n = phone ? CROWD_PHONE : CROWD_N;
    crowd = pedestrians.spriteCrowd ? pedestrians.spriteCrowd(n, CAST) : null; if (crowd && !crowd.cast.length) { crowd.dispose(); crowd = null; }
    const R = mulberry(14071), P = people; P.n = crowd ? n : 0; P.du = new Float32Array(n); P.lv = new Float32Array(n); P.h = new Float32Array(n); P.y = new Float32Array(n); P.x = new Float32Array(n); P.z = new Float32Array(n); P.v = new Uint16Array(n); P.kind = new Uint8Array(n); P.jit = new Float32Array(n);
    if (!crowd) return;
    for (let i = 0; i < n; i++) {
      const r = R(); let du, lv, kind;
      if (r < 0.40) { du = -(5.8 + R() * 8.5); lv = (R() - 0.5) * 2 * BOX[2] * 0.95; kind = 0; }          // the crowd that follows behind the carro
      else if (r < 0.52) { du = (R() - 0.5) * 7; lv = (R() < 0.5 ? -1 : 1) * (2.5 + R() * 0.9); kind = 1; }   // walking beside the hull
      else if (r < 0.62) { du = 5.8 + R() * 5.5; lv = (R() - 0.5) * 2 * BOX[2] * 0.95; kind = 2; }            // the first ones ahead
      else { du = (R() - 0.5) * 80; lv = (R() < 0.5 ? -1 : 1) * (BOX[2] + KERB * R()); kind = 3; }            // along the kerbs
      P.du[i] = du; P.lv[i] = lv; P.kind[i] = kind; P.h[i] = 0.95 + R() * 0.1; P.jit[i] = R() * 6.283; P.v[i] = crowd.cast[(R() * crowd.cast.length) | 0];
    }
  }
  // where everyone is, every frame: the carro's arc plus their own offset, folded by the direction the carro faces
  const _o = { x: 0, z: 0, tx: 0, tz: 1 };
  let frame = 0, groundCur = 0;
  function updateCrowd(t) {
    if (!crowd) return;
    const P = people, n = P.n, cheer = U.uCheer.value, walking = C.pause <= 0 && !C.held;
    const bump = Math.sin(Math.PI * C.k);   // while the carro turns round the people walk round it: they keep out of its width
    frame++;
    for (let i = 0; i < n; i++) {
      const kerb = P.kind[i] === 3, dv = P.du[i] * C.dirVis + (kerb ? 0 : Math.sin(t * 0.6 + P.jit[i]) * 0.3), lv0 = P.lv[i];
      const lv = lv0 + (lv0 < 0 ? -1 : 1) * bump * Math.max(0, 2.7 - Math.abs(lv0)) * (kerb ? 0 : 1);
      at(C.s + dv, _o);
      const x = _o.x - _o.tz * lv, z = _o.z + _o.tx * lv;   // (-tz, tx) is the left-hand side of the travel: the same sign for everyone on the route
      if ((i + frame) % 8 === 0) P.y[i] = groundAt(x, z);
      const yaw = kerb ? Math.atan2(_o.tx, _o.tz) + (lv0 < 0 ? 1 : -1) * (Math.PI / 2 + Math.sin(P.jit[i]) * 0.4) : Math.atan2(_o.tx * C.dirVis, _o.tz * C.dirVis) + Math.sin(P.jit[i]) * 0.3;   // the kerbs look in at the street, the rest the way the carro goes
      const hop = cheer > 0 ? Math.abs(Math.sin(t * 7 + P.jit[i])) * 0.16 * cheer : 0;
      P.x[i] = x; P.z[i] = z;
      crowd.put(i, x, P.y[i] + hop, z, P.v[i], yaw, !kerb && walking ? 1 + (((t * 3.2 + P.jit[i]) | 0) & 3) : 0, P.h[i]);
    }
    crowd.show(n);
  }

  // ---- the solid box (walls2d): registered along the route once, moved in place, out of play (FAR) when the cart is not drawn
  let wallSegs = null;
  function makeWalls() {
    wallSegs = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const cells = new Set(), c = 16, R = 22;
    for (let s = 0; s <= RL; s += 6) {
      at(s, _o);
      for (let ix = Math.floor((_o.x - R) / c); ix <= Math.floor((_o.x + R) / c); ix++) for (let iz = Math.floor((_o.z - R) / c); iz <= Math.floor((_o.z + R) / c); iz++) {
        const k = ix * 100003 + iz; if (cells.has(k)) continue; cells.add(k);
        for (const sg of wallSegs) walls2d.addSeg(sg, (ix + 0.5) * c, (iz + 0.5) * c, (ix + 0.5) * c, (iz + 0.5) * c);   // a degenerate box: exactly this cell
      }
    }
    wakeWalls(false);
  }
  function wakeWalls(onNow) {
    if (!wallSegs) return;
    if (!onNow) { for (const s of wallSegs) s[0] = s[1] = s[2] = s[3] = FAR; return; }
    const tx = C.tx * C.dir, tz = C.tz * C.dir, nx = -tz, nz = tx, b = BOX[0], a = BOX[1], w = BOX[2];   // the box is fixed to the carro's heading (travel frame): behind, ahead, half width
    const q = (u, v) => [C.x + tx * u + nx * v, C.z + tz * u + nz * v], k = [q(b, -w), q(a, -w), q(a, w), q(b, w)];
    for (let i = 0; i < 4; i++) { const p0 = k[i], p1 = k[(i + 1) % 4], s = wallSegs[i]; s[0] = p0[0]; s[1] = p0[1]; s[2] = p1[0]; s[3] = p1[1]; }
  }
  const nearBox = (m) => {   // the lapa within m of the box (in the travel frame)
    const tx = C.tx * C.dir, tz = C.tz * C.dir, dx = car.x - C.x, dz = car.z - C.z, u = dx * tx + dz * tz, v = -dx * tz + dz * tx;
    return u > BOX[0] - m && u < BOX[1] + m && Math.abs(v) < BOX[2] + m;
  };

  // ---- the mayor, on the deck
  const mayorHead = { x: 0, y: 0, z: 0 }, relPos = { x: 0, y: 0, z: 0 };
  const deckAt = (lx, lz, out) => { const s = Math.sin(C.yaw), c = Math.cos(C.yaw); out.x = C.x + lx * c + lz * s; out.z = C.z - lx * s + lz * c; out.y = C.gy + DECK + 0.2; out.th = C.yaw; };
  function mayorOn() {
    mayor = pedestrians.spawnScripted('suit', C.x, C.z);
    if (mayor >= 0) pedestrians.attachTo(mayor, out => { deckAt(0, 0.6, out); out.th = C.yaw + 0.0; });
  }
  const mayorPos = () => { deckAt(0, 0.6, relPos); mayorHead.x = relPos.x; mayorHead.y = relPos.y + 1.95; mayorHead.z = relPos.z; return mayorHead; };
  const crowdHead = i => { const o = { x: C.x, y: C.gy + 1.7, z: C.z }; return () => { if (!crowd || i >= people.n) return o; o.x = people.x[i]; o.y = people.y[i] + 1.9 * people.h[i]; o.z = people.z[i]; return o; }; };
  function shoutViva() {
    X.say(tx(MAYOR), mayorPos, 0, 6);
    U.uCheer.value = 1;
    const n = people.n, used = [];
    for (let k = 0; k < 3; k++) { let i = (Math.random() * n) | 0, t = 0; while ((people.kind[i] === 3 || used.includes(i)) && t++ < 20) i = (Math.random() * n) | 0; used.push(i); X.say(tx(ANSWER), crowdHead(i), 1.1 + k * 0.7, 4); }
  }

  // ---- fireworks: one Points, one shader, every burst a random place over the sea at the Foro Italico end (no JS per frame but the clock)
  let fw = null;
  const FW_K = 8, FW_S = 48, FW_PERIOD = 2.4, FW_LIFE = 3.4;
  function fireworksOn() {
    if (fw) return;
    const n = FW_K * FW_S, pos = new Float32Array(n * 3), seed4 = new Float32Array(n * 4), R = mulberry(77);
    for (let k = 0; k < FW_K; k++) for (let j = 0; j < FW_S; j++) { const i = k * FW_S + j; seed4[i * 4] = k; seed4[i * 4 + 1] = R(); seed4[i * 4 + 2] = R(); seed4[i * 4 + 3] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(seed4, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBase: { value: new THREE.Vector3(endSky.x, groundAt(endSky.x, endSky.z), endSky.z) }, uOut: { value: new THREE.Vector2(endSky.ox, endSky.oz) }, uAlong: { value: new THREE.Vector2(endSky.ax, endSky.az) }, uPx: { value: Math.min(2, window.devicePixelRatio || 1) } },
      vertexShader: `attribute vec4 aS; uniform float uTime; uniform vec3 uBase; uniform vec2 uOut; uniform vec2 uAlong; uniform float uPx; varying vec3 vC; varying float vA;
        float hh(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
        void main() {
          float cyc = ${(FW_K * FW_PERIOD).toFixed(1)}, ph = uTime - aS.x * ${FW_PERIOD.toFixed(1)}, n = floor(ph / cyc), t = ph - n * cyc;
          if (t > ${FW_LIFE.toFixed(1)} || ph < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vC = vec3(0.0); vA = 0.0; return; }
          float r1 = hh(aS.x * 7.1 + n * 3.3), r2 = hh(r1 * 91.7 + 1.3), r3 = hh(r2 * 17.9 + 2.1), r4 = hh(r3 * 53.3 + 0.7);
          vec2 xz = uBase.xz + uAlong * (r1 - 0.5) * 220.0 + uOut * (40.0 + r2 * 120.0);
          vec3 c = vec3(xz.x, uBase.y + 75.0 + r3 * 60.0, xz.y);
          float th = aS.y * 6.2831, cp = aS.z * 2.0 - 1.0, sp = sqrt(max(0.0, 1.0 - cp * cp));
          vec3 d = vec3(sp * cos(th), cp, sp * sin(th));
          float sv = 20.0 + 14.0 * aS.w;
          vec3 p = c + d * sv * (1.0 - exp(-1.6 * t)) / 1.6 - vec3(0.0, 3.2 * t * t, 0.0);
          vec3 hue = 0.5 + 0.5 * cos(6.2831 * (r4 + vec3(0.0, 0.33, 0.67)));
          vC = mix(hue, vec3(1.0, 0.95, 0.8), step(0.7, hh(r4 * 5.0)));
          float fade = pow(1.0 - t / ${FW_LIFE.toFixed(1)}, 1.4) * (0.7 + 0.3 * sin(t * 28.0 + aS.y * 40.0));
          vA = fade + step(t, 0.12) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(6000.0 * uPx / max(-mv.z, 1.0), 3.0 * uPx, 30.0 * uPx);
        }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float a = (1.0 - smoothstep(0.0, 0.5, length(q))) * vA; gl_FragColor = vec4(vC * a * 1.8, a); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, fog: false,
    });
    fw = new THREE.Points(g, mat); fw.frustumCulled = false; fw.renderOrder = 6; fw.name = 'festino_fireworks'; fw.userData.tris = 0;
    fw.onBeforeRender = () => { mat.uniforms.uTime.value = (now() % 1000) + 10; };
    scene.add(fw);
  }
  function fireworksOff() { if (!fw) return; scene.remove(fw); fw.geometry.dispose(); fw.material.dispose(); fw = null; }

  // ---- on and off
  function setOn(v) {
    if (v === on) return;
    on = v;
    dispatchEvent(new CustomEvent('pd-festino', { detail: on }));   // the carro on the Foro Italico lawn is away while this one walks (src/friend-stops.js): there is one carro
    if (on) {
      if (!RX && !buildRoute()) { on = false; dispatchEvent(new CustomEvent('pd-festino', { detail: false })); if (X.params.has('debug')) console.warn('[festino] no route'); return; }
      C.s = clamp(S_QC + 28, S_MIN, S_MAX); C.dir = 1; C.dirVis = 1; C.pause = 0; C.k = 1; C.shoutT = 6; C.toasted = false; C.qcT = 0;
      at(C.s, _o); C.x = _o.x; C.z = _o.z; C.tx = _o.tx; C.tz = _o.tz; C.yaw = Math.atan2(C.tx, C.tz); C.gy = groundAt(C.x, C.z);
      if (!X.slots.includes(slot)) X.slots.push(slot);
      marker = X.addMarker(C.x, C.z, '#f5d77a', 7, 'diamond');
    } else {
      unbuild(); fireworksOff(); wakeWalls(false);
      const i = X.slots.indexOf(slot); if (i >= 0) { if (X.director.state.slot === slot) X.director.cancel(); X.slots.splice(i, 1); }
      if (marker) { X.dropMarker(marker); marker = null; }
    }
  }
  function build() {
    if (built) return; built = true;
    cart = buildCart(); scene.add(cart);
    buildCrowd(); if (!wallSegs) makeWalls();
    mayorOn(); groundCur = groundAt(C.x, C.z); for (let i = 0; i < people.n; i++) people.y[i] = groundCur;
    C.shoutT = 3;
  }
  function unbuild() {
    if (!built) return; built = false;
    if (cart) { scene.remove(cart); cart.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); cart = null; }
    if (crowd) { crowd.dispose(); crowd = null; } people.n = 0;
    if (mayor >= 0) { pedestrians.remove(mayor); mayor = -1; }
    wakeWalls(false);
  }

  // ---- the cart each frame
  function moveCart(dt) {
    const hold = built && nearBox(HOLD);
    if (C.pause > 0) {   // at an end: it waits, and turns round (the crowd walks round it)
      C.pause -= dt; C.k = clamp(1 - C.pause / PAUSE, 0, 1);
      const q = clamp((C.k - 0.1) / 0.8, 0, 1); C.dirVis = C.dir * (1 - 2 * q * q * (3 - 2 * q));
      if (C.pause <= 0) { C.dir = -C.dir; C.dirVis = C.dir; C.k = 1; }
    } else if (!hold) {
      C.s += C.dir * WALK * dt;
      if ((C.dir > 0 && C.s >= S_MAX) || (C.dir < 0 && C.s <= S_MIN)) { C.s = clamp(C.s, S_MIN, S_MAX); C.pause = PAUSE; C.k = 0; }
    }
    C.held = hold;
    at(C.s, _o); C.x = _o.x; C.z = _o.z; C.tx = _o.tx; C.tz = _o.tz;
    const f = C.pause > 0 ? -C.dir : C.dir, rate = (C.pause > 0 ? 0.5 : 1.5) * dt;   // facing the way it goes next while it waits at an end
    C.yaw += clamp(angDiff(Math.atan2(C.tx * f, C.tz * f), C.yaw), -rate, rate);
    if (marker) { marker.x = C.x; marker.z = C.z; }
  }

  function tick(dt, idle) {
    // one hour comparison when it is off
    const h = hourNow(), ev = h >= 0 && (h >= EVE0 || h < EVE1);
    if (h >= 0 && ev !== eve) { if (ev) { nightN++; tonight = drawNight(); } else tonight = false; eve = ev; }
    const want = FORCE || (tonight && ev);
    if (want !== on && (want || !busy)) setOn(want);
    if (!on) return;
    dt = Math.min(dt, 0.1);
    moveCart(dt);
    const d = Math.hypot(car.x - C.x, car.z - C.z); C.d = d;
    if (!built && d < BUILD_R) build();
    else if (built && d > DROP_R) unbuild();
    if (built) {
      C.gy += (groundAt(C.x, C.z) - C.gy) * Math.min(1, dt * 6);
      const t = now();
      U.uCheer.value = Math.max(0, U.uCheer.value - dt * 0.5);
      cart.position.set(C.x, C.gy + Math.sin(t * 1.9) * 0.02, C.z); cart.rotation.y = C.yaw; cart.rotation.z = Math.sin(t * 1.3) * 0.008;
      updateCrowd(t);
      wakeWalls(!nearBox(-0.4));   // solid unless the lapa is already inside (it was put there, or the box grew over it): then it can drive out
      C.shoutT -= dt;
      const passQC = C.dir * (C.s - S_QC) > 0 && Math.abs(C.s - S_QC) < 1.5 && C.qcT <= 0;
      if (C.qcT > 0) C.qcT -= dt;
      if ((C.shoutT <= 0 && d < 160) || (passQC && d < 200)) { C.shoutT = rnd(16, 28); if (passQC) C.qcT = 60; shoutViva(); }
      if (!C.toasted && d < 320 && idle) { C.toasted = true; hud.toast(tx(L.toast), tx(L.toastSub)); }
    }
    const sky = d < SKY_R && h >= 0 && (h >= 19.5 || h < 3) || (FORCE && d < SKY_R && X.isNight());
    if (sky) { if (!fw && endSky) fireworksOn(); } else if (fw && d > SKY_R + 300) fireworksOff();
  }
  let busy = false;

  // ---- the job: somebody in the crowd feels sick
  const hosp = new Map();
  function hospitalFor(x, z) {   // the nearest of the hospitals the baked routes know
    let best = null, bd = 1e18;
    for (const id of HOSPITALS) { let d = hosp.get(id); if (d === undefined) { try { d = X.destInfo(id); } catch (e) { d = null; } hosp.set(id, d); } if (d) { const q = Math.hypot(d.x - x, d.z - z); if (q < bd) { bd = q; best = d; } } }
    return best ? { dest: best, d: bd } : null;
  }
  const _sn = { x: 0, z: 0 };
  function placeCall() {   // a road point 40 to 80 m from the cart, on a side street or, failing that, behind it on the Cassaro
    for (let n = 0; n < 40; n++) {
      const a = Math.random() * 6.283, r = rnd(SPOT[0], SPOT[1]), sn = X.snapRoad(C.x + Math.cos(a) * r, C.z + Math.sin(a) * r);
      if (sn.d > 3 || Math.hypot(sn.x - C.x, sn.z - C.z) < SPOT[0] - 5) continue;
      let onRoute = false; for (let s = C.s - 90; s <= C.s + 90 && !onRoute; s += 6) { at(s, _o); if (Math.hypot(_o.x - sn.x, _o.z - sn.z) < 9) onRoute = true; }
      if (!onRoute) return sn;
    }
    at(C.s - C.dir * rnd(50, 70), _o); return X.snapRoad(_o.x, _o.z);
  }
  X.director.add('festino', far => {
    if (!on || !RX || !X.slots.includes(slot)) return null;
    if (Math.hypot(car.x - C.x, car.z - C.z) > CALL_R) return null;
    const sn = placeCall(), hs = hospitalFor(sn.x, sn.z); if (!hs) return null;
    Object.assign(slot, { x: sn.x, z: sn.z, dx: sn.dx, dz: sn.dz, w: sn.w, kerb: null, coolUntil: 0, ped: pick(LOOKS), dest: hs.dest });
    const len = hs.d * 1.35, pay = Math.round((8 + len / 90) * PAY_X * 2) / 2; slot.len = len; slot.pay = pay;
    return { slot, ped: X.director.face(slot), col: KIND_COLOR.festino, pay, note: T('cchiù i manci', 'plus tips'), where: '→ ' + hs.dest.name, who: tx(L.who), line: X.calls.lineFor(slot),
      drop: () => { slot.offerPed = null; slot.offerV = -1; } };
  });
  let e = null;   // the ride: { chars, phase, dest, left, limit, base, tips, t, talkT }
  const fin = ok => {
    e.phase = 'drop'; e.dropT = ok ? 5.5 : 4; e.ok = ok; X.setPhase('done');
    X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off(); X.aim(0, 0, false);
    const d = e.dest, dx = d.vx - d.x, dz = d.vz - d.z, dl = Math.hypot(dx, dz) || 1, step = ok ? Math.min(dl, 7) : 9;
    e.chars.forEach((c, i) => { pedestrians.detach(c.id); c.seated = false; pedestrians.walkTo(c.id, ok ? d.x + dx / dl * step + i * 0.8 : car.x + Math.sin(car.th + 1.2 + i) * 9, ok ? d.z + dz / dl * step : car.z + Math.cos(car.th + 1.2 + i) * 9, ok ? 2.2 : 3.2); });
    if (!ok) { X.say(tx(L.late), X.seatPos, 0.4); hud.result(`<h3>${esc(tx(L.timeUp))}</h3><div class="row"><span>${esc(tx(L.noPay))}</span></div>`, 3); e.total = 0; return; }
    const frac = clamp(e.left / e.limit, 0, 1), speedTip = Math.round(e.base * 1.4 * frac * 2) / 2, total = e.base + e.tips + speedTip;
    e.total = total; X.addFare(total); X.say(tx(L.arrive), X.seatPos, 0.8);
    hud.result(`<h3>${esc(d.name)}</h3><div class="row"><span>${esc(tx(L.fare))}</span><span>${eur(e.base)}</span></div><div class="row"><span>${esc(tx(L.tipQ))}</span><span>+ ${eur(speedTip)}</span></div><div class="row tot"><span>${esc(tx(L.total))}</span><span>${eur(total)}</span></div>`, 4.2);
    if (total >= e.base * 1.4) hud.burst();
  };
  const ride = () => {
    e.phase = 'ride'; X.calls.hideBeacon(); X.guide.to(e.dest.x, e.dest.z);
    X.destBeacon.set(e.dest.x, e.dest.z); X.destBeacon.show(true); X.destMarker = X.addMarker(e.dest.x, e.dest.z, '#ffd24a', 8, 'target');
    X.say(tx(L.start), X.driverPos, 0.2); const s = pick(L.sick); X.say(tx(s), X.seatPos, 1.6);
  };
  X.kinds.festino = {
    start(s) {
      busy = true;
      const dest = s.dest || hospitalFor(s.x, s.z).dest, len = s.len || Math.hypot(dest.x - car.x, dest.z - car.z) * 1.35, base = s.pay || Math.round((8 + len / 90) * PAY_X * 2) / 2;
      e = { slot: s, dest, phase: 'board', chars: s.callers.slice().map((id, i) => ({ id, seated: false, slot: i, next: 0 })), base, tips: 0, limit: len / 12 + 25, left: 0, t: 0, talkT: rnd(9, 14), doorT: 0, total: 0, dropT: 0 };
      e.left = e.limit; s.callers = [];
      const i0 = e.chars[0] && pedestrians.info(e.chars[0].id);
      if (i0) { const id = pedestrians.spawnScripted(pick(LOOKS), i0.x + 0.8, i0.z + 0.4); if (id >= 0) e.chars.push({ id, seated: false, slot: 1, next: 0 }); }
      hud.toast(tx(L.start), dest.name);
    },
    update(dt) {
      if (!e) return;
      if (e.phase === 'board') {
        const sp = X.speed(), sn = Math.sin(car.th), cs = Math.cos(car.th);
        for (const c of e.chars) {
          if (c.seated) continue;
          const info = pedestrians.info(c.id); if (!info) continue;
          const side = ((info.x - car.x) * cs - (info.z - car.z) * sn) >= 0 ? 1 : -1, tx2 = car.x + sn * -1.0 + cs * side * 1.0, tz2 = car.z + cs * -1.0 - sn * side * 1.0;
          c.next -= dt; if (c.next <= 0) { pedestrians.walkTo(c.id, tx2, tz2, 2.8); c.next = 0.25; }
          if (Math.hypot(info.x - tx2, info.z - tz2) < 0.6) { c.seated = true; pedestrians.attachTo(c.id, X.seatFn(c.slot), { seated: true, blend: 0.4 }); }
        }
        if (e.chars.length && e.chars.every(c => c.seated)) { e.doorT += dt; if (e.doorT > 0.3) ride(); }
        else if (sp > 3.5 && Math.hypot(car.x - e.slot.x, car.z - e.slot.z) > 12) {   // pulling away: whoever is aboard is the fare
          if (e.chars.some(c => c.seated)) { for (const c of e.chars.filter(c => !c.seated)) pedestrians.remove(c.id); e.chars = e.chars.filter(c => c.seated); ride(); } else { X.endEvent(false, true); return; }
        }
        hud.set({ label: tx(L.label), title: e.dest.name, sub: tx(L.board), time: '', frac: null, target: null }); X.aim(0, 0, false);
      } else if (e.phase === 'ride') {
        e.left -= dt; e.t += dt; e.talkT -= dt;
        if (e.talkT <= 0) { e.talkT = rnd(10, 16); X.say(tx(pick(Math.random() < 0.5 ? L.sick : L.kin)), X.seatPos, 0); }
        const d = Math.hypot(car.x - e.dest.x, car.z - e.dest.z), m = Math.max(0, e.left), ds = d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 5) * 5 + ' m';
        hud.set({ label: tx(L.label), title: e.dest.name, sub: ds, time: Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), low: m < 12, frac: e.left / e.limit, target: e.dest, ledger: [tx(L.fare) + ' ' + eur(e.base + e.tips), ''] });
        X.aim(e.dest.x, e.dest.z, true);
        if (d < X.destBeacon.R && X.speed() < 2.0) fin(true); else if (e.left <= 0) fin(false);
      } else if (e.phase === 'drop') { e.dropT -= dt; if (e.dropT <= 0) X.endEvent(e.total > 0); }
    },
    stop() {
      if (!e) { busy = false; return; }
      for (const c of e.chars) { pedestrians.detach(c.id); pedestrians.remove(c.id); }
      X.destBeacon.show(false); X.dropMarker(X.destMarker); X.destMarker = null; X.guide.off();
      e = null; busy = false;
    },
    tick,
  };
  JOBS.add('festino'); KIND_COLOR.festino = '#f5d77a';
  if (X.params.has('debug')) window.__festino = { C, people, U, get on() { return on; }, get built() { return built; }, get route() { return { RL, S_QC, S_MIN, S_MAX, N }; }, setS(s) { C.s = s; }, forceOn() { setOn(true); }, share(n) { let k = 0; for (let i = 0; i < n; i++) { nightN++; if (drawNight()) k++; } return k / n; }, get tonight() { return tonight; }, at: s => { const o = {}; at(s, o); return o; }, get cart() { return cart; }, get mayor() { return mayor; },get bodies() { return bodies; }, get heads() { return heads; }, get fw() { return fw; }, get slot() { return slot; }, get endSky() { return endSky; }, shout: shoutViva, get e() { return e; } };
}
