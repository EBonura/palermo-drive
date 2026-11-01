// The first garage: a backstreet officina in Palermo. Owned by the driving work. Built by src/garage-scene.js (the list of garages lives there).
// An old ground-floor workshop: roller shutter half up with the street light coming in, a workbench with a radio, a pegboard of tools,
// stacked tyres, a Santa Rosalia picture, a calendar, a Vespa in the corner. Everything is drawn in code (canvas textures, vertex colours)
// and lit by baking the light into the vertices (src/garage-kit.js), so only the vehicle on the turntable costs real lighting.
//
// A room builder returns what src/garage-scene.js needs:
//   { group, extras, turntable, platform, top, radius, cam, bounds, lights, env(x, y, z), exposure, update(sec, dt), onLook(look), tris, texKB, dispose() }
//   group: the static room; turntable: a Group at the origin the scene turns, vehicle goes on its top (y = top); platform: the part of it the scene scales to the vehicle's size (radius is the size at scale 1);
//   cam: { az } where the camera stands (angle from +z, radians); bounds: the box the camera stays in; lights: real lights for the vehicle.
import * as THREE from 'three';
import { Bake, surface, canvasTex, disposeTree, rng, blot, soft, smooth, clamp } from './garage-kit.js';

const X0 = -4.6, X1 = 4.6, Z0 = -5, Z1 = 6.2, H = 3.8;       // the room
const DX0 = -3.3, DX1 = 0.3, DY = 2.7, OPEN = 1.5;           // the shutter door in the back wall, and how high its bottom bar is
const SUN = new THREE.Vector3(0.07, -0.46, 1).normalize();   // the way the light comes in through the door
const FONT = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif', HAND = '"Mr Dafoe", "Segoe Script", cursive';
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------------------------
// baked light: what every vertex of the room receives. day: street light through the shutter; night: orange street lamp, tubes on.
// ---------------------------------------------------------------------------------------------------------------------------
function makeLight(day) {
  const amb = day ? [0.34, 0.325, 0.31] : [0.2, 0.21, 0.28], spill = day ? [1, 0.82, 0.56] : [1, 0.55, 0.22], spillK = day ? 1.35 : 0.6;
  const SX = (DX0 + DX1) / 2, SY = OPEN / 2;
  const tubes = [[-1.2, 3.62, -1.6], [-1.2, 3.62, 2.4]], bulb = [-3.95, 2.3, -2.9], votive = [1.5, 1.32, -4.9];
  return (p, n, o) => {
    const up = 0.5 + 0.5 * n.y;
    let r = amb[0] * (0.78 + 0.45 * up), g = amb[1] * (0.78 + 0.45 * up), b = amb[2] * (0.78 + 0.45 * up);
    // the street light through the door: a beam that opens out a little as it comes in
    const vx = p.x - SX, vy = p.y - SY, vz = p.z - Z0;
    if (vz > 0.02) {
      const d = Math.hypot(vx, vy, vz), half = (DX1 - DX0) / 2 + vz * 0.1;
      const lat = 1 - smooth(half - 0.5, half + 1.1, Math.abs(vx));
      const face = Math.max(0, -(n.x * vx + n.y * vy + n.z * vz) / d);
      const a = spillK * lat * (0.25 + 0.75 * face) * smooth(0.05, 0.45, vz / d) / (1 + d * d / 36);
      r += spill[0] * a; g += spill[1] * a; b += spill[2] * a;
    }
    if (vz < 0.4 && Math.abs(p.z - Z0) < 0.45 && n.z > 0.5) {   // the wall around the door glows
      const a = (day ? 0.5 : 0.28) * Math.exp(-(vx * vx / 5 + vy * vy / 3));
      r += spill[0] * a; g += spill[1] * a; b += spill[2] * a;
    }
    for (const t of tubes) {   // fluorescent tubes
      const dx = t[0] - p.x, dy = t[1] - p.y, dz = t[2] - p.z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
      const a = (day ? 0.5 : 0.85) / (1 + d2 / 9) * (0.3 + 0.7 * Math.max(0, (n.x * dx + n.y * dy + n.z * dz) / d));
      r += 0.74 * a; g += 0.86 * a; b += 0.96 * a;
    }
    { const dx = bulb[0] - p.x, dy = bulb[1] - p.y, dz = bulb[2] - p.z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);   // the bare bulb over the bench
      const a = 1.05 / (1 + d2 / 1.6) * (0.25 + 0.75 * Math.max(0, (n.x * dx + n.y * dy + n.z * dz) / d));
      r += a; g += 0.7 * a; b += 0.4 * a; }
    { const dx = votive[0] - p.x, dy = votive[1] - p.y, dz = votive[2] - p.z, d2 = dx * dx + dy * dy + dz * dz;   // the votive candle
      const a = 0.55 / (1 + d2 / 0.45); r += a; g += 0.32 * a; b += 0.18 * a; }
    // shade in the corners and under things
    let ao = 1;
    const dw = Math.min(p.x - X0, X1 - p.x, p.z - Z0, Z1 - p.z);
    if (n.y > 0.5 && p.y < 0.2) ao *= 1 - 0.4 * Math.exp(-dw / 0.8);
    else if (Math.abs(n.y) < 0.9) ao *= 1 - 0.3 * Math.exp(-p.y / 0.3);
    if (p.y > 3.3) ao *= 1 - 0.28 * smooth(3.3, 3.8, p.y);
    o.r = Math.min(r * ao, 1.5); o.g = Math.min(g * ao, 1.5); o.b = Math.min(b * ao, 1.5);
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------------------------------------------------------
function floorTex() {   // concrete, with joints and cracks; tiles every 2.2 m
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(11); g.fillStyle = '#8e8a82'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 100 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v - 3},${v - 8},${0.25 + R() * 0.3})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
    for (let i = 0; i < 40; i++) soft(g, R() * w, R() * h, 14 + R() * 26, `rgba(${R() < 0.5 ? '70,66,60' : '170,166,156'},0.13)`);
    g.strokeStyle = 'rgba(40,38,34,0.55)'; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (R() - 0.5) * 22; y += (R() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(30,28,24,0.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  }, [1, 1]);
}
function wallTex() {   // limewash above, an oil-paint band below; tiles every 2.5 m across, runs the full 3.8 m up
  return canvasTex(256, 512, (g, w, h) => {
    const R = rng(23), band = h - 1.4 / H * h;
    g.fillStyle = '#d6c9ac'; g.fillRect(0, 0, w, band);
    g.fillStyle = '#3f6c62'; g.fillRect(0, band, w, h - band);
    for (let i = 0; i < 26; i++) soft(g, R() * w, R() * band, 26 + R() * 50, `rgba(${R() < 0.6 ? '120,96,60' : '250,240,215'},${0.1 + R() * 0.12})`);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(90,76,52,${R() * 0.16})`; g.fillRect(R() * w, R() * band, 1 + R() * 2, 1 + R() * 2); }
    for (let i = 0; i < 5; i++) { const x = R() * w, y = band - 14 - R() * 60; blot(g, w, x, y, 7 + R() * 10, 5 + R() * 7, R() * 3, '#b58a62'); }   // plaster fallen off, brick showing
    const gr = g.createLinearGradient(0, band - 50, 0, band); gr.addColorStop(0, 'rgba(130,110,70,0)'); gr.addColorStop(1, 'rgba(130,110,70,0.3)'); g.fillStyle = gr; g.fillRect(0, band - 50, w, 50);   // damp rising
    g.fillStyle = '#ece3c8'; g.fillRect(0, band, w, 3); g.fillStyle = 'rgba(20,40,36,0.5)'; g.fillRect(0, band + 3, w, 2);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '20,36,34' : '200,210,190'},${R() * 0.2})`; g.fillRect(R() * w, band + R() * (h - band), 1 + R() * 3, 1 + R() * 2); }
    for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(210,200,170,0.28)'; g.lineWidth = 2; const x = R() * w, y = band + R() * (h - band - 10); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + R() * 24, y + (R() - 0.5) * 6); g.stroke(); }   // scuffs
    const fl = g.createLinearGradient(0, h - 40, 0, h); fl.addColorStop(0, 'rgba(10,10,8,0)'); fl.addColorStop(1, 'rgba(10,10,8,0.5)'); g.fillStyle = fl; g.fillRect(0, h - 40, w, 40);
  }, [1, 1]);
}
function shutterTex() {   // corrugated steel slats, painted green long ago
  return canvasTex(128, 128, (g, w, h) => {
    const R = rng(5), n = 8, sh = h / n;
    for (let i = 0; i < n; i++) {
      const y = i * sh, gr = g.createLinearGradient(0, y, 0, y + sh);
      gr.addColorStop(0, '#8d9a8e'); gr.addColorStop(0.18, '#6f7e72'); gr.addColorStop(0.8, '#566558'); gr.addColorStop(1, '#2c352f');
      g.fillStyle = gr; g.fillRect(0, y, w, sh);
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,64,30' : '30,34,30'},${0.1 + R() * 0.25})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 3 + R() * 14); }
    g.fillStyle = 'rgba(190,190,170,0.5)'; g.fillRect(14, 22, 10, 7); g.fillStyle = 'rgba(200,80,120,0.7)'; g.fillRect(70, 70, 22, 4);   // a sticker, a scribble
  }, [1, 1]);
}
function streetTex(day) {   // the lane outside, seen through the door: the building opposite, laundry, cobbles
  return canvasTex(512, 256, (g, w, h) => {
    const R = rng(77);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, day ? '#8fc4ee' : '#0d1530'); sky.addColorStop(1, day ? '#d9eefa' : '#26305c'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const wall = g.createLinearGradient(0, 40, 0, h); wall.addColorStop(0, day ? '#f0c27a' : '#5a4636'); wall.addColorStop(1, day ? '#d79a52' : '#3c2f26');
    g.fillStyle = wall; g.fillRect(0, 40, w, h - 40);
    for (let i = 0; i < 20; i++) soft(g, R() * w, 40 + R() * 200, 30 + R() * 40, `rgba(${R() < 0.5 ? '255,240,200' : '120,70,30'},${day ? 0.16 : 0.1})`);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {   // windows with shutters
      const x = 24 + c * 82 + (r * 20), y = 62 + r * 80;
      g.fillStyle = day ? '#2a2420' : '#ffcb70'; g.fillRect(x, y, 34, 52);
      g.fillStyle = c % 2 ? '#3d7a52' : '#7a4a2a'; g.fillRect(x - 12, y - 2, 12, 56); g.fillRect(x + 34, y - 2, 12, 56);
    }
    g.fillStyle = '#4a4a4e'; g.fillRect(0, 118, w, 4); g.strokeStyle = '#2a2a2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 122); g.lineTo(w - 10, 122); g.stroke();
    g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(40, 70); g.quadraticCurveTo(250, 100, 470, 66); g.stroke();   // washing line
    ['#d83c3c', '#f2f2f2', '#2b6fc8', '#f2c200', '#e8559a', '#f2f2f2'].forEach((c, i) => { const x = 90 + i * 62, y = 78 + Math.sin(i / 5 * Math.PI) * 18; g.fillStyle = c; g.fillRect(x, y, 14, 24 + (i % 2) * 8); });
    g.fillStyle = day ? '#a89c88' : '#3a3630'; g.fillRect(0, h - 34, w, 34);   // the stone plinth of the building opposite
    g.fillStyle = day ? '#3a2e24' : '#17120e'; g.fillRect(150, h - 120, 70, 86); g.fillRect(330, h - 120, 70, 86);   // two doorways
    g.strokeStyle = 'rgba(30,26,22,0.4)'; g.lineWidth = 2; for (let y = h - 34; y < h; y += 17) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    if (day) { const sun = g.createLinearGradient(0, 0, w, 0); sun.addColorStop(0, 'rgba(255,248,220,0)'); sun.addColorStop(0.5, 'rgba(255,248,220,0.28)'); sun.addColorStop(1, 'rgba(255,248,220,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h); }
    else { soft(g, 420, 40, 90, 'rgba(255,170,60,0.55)'); }
  }, [1, 1]);
}

// one atlas for the things on the walls
const AT = { w: 1024, h: 320 };
const ATLAS = { peg: [0, 0, 512, 256], sign: [512, 0, 512, 128], cal: [512, 128, 128, 192], saint: [640, 128, 160, 200], note: [800, 128, 224, 128] };
const uvOf = k => { const [x, y, w, h] = ATLAS[k]; return [x / AT.w, 1 - (y + h) / AT.h, (x + w) / AT.w, 1 - y / AT.h]; };
function decorAtlas() {
  return canvasTex(AT.w, AT.h, (g, w, h) => {
    const R = rng(41);
    // pegboard: brown board, a grid of holes, white outlines where each tool lives
    { const [x, y, pw, ph] = ATLAS.peg; g.save(); g.translate(x, y);
      g.fillStyle = '#a58660'; g.fillRect(0, 0, pw, ph);
      for (let i = 0; i < 24; i++) soft(g, R() * pw, R() * ph, 20 + R() * 30, `rgba(${R() < 0.5 ? '70,48,24' : '200,170,120'},0.18)`);
      g.fillStyle = 'rgba(40,26,12,0.8)'; for (let yy = 8; yy < ph; yy += 16) for (let xx = 8; xx < pw; xx += 16) { g.beginPath(); g.arc(xx, yy, 2, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(250,246,230,0.92)'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 7; i++) { const cx = 28 + i * 30, L = 90 - i * 5; g.beginPath(); g.roundRect(cx - 6, 24, 12, L, 6); g.stroke(); g.beginPath(); g.arc(cx, 24, 11, 0.3 * Math.PI, 2.7 * Math.PI); g.stroke(); }   // spanners, small to big
      g.beginPath(); g.roundRect(262, 22, 12, 100, 4); g.stroke(); g.strokeRect(246, 22, 44, 22);                                                                  // hammer
      g.beginPath(); g.moveTo(312, 28); g.lineTo(344, 104); g.moveTo(344, 28); g.lineTo(312, 104); g.stroke(); g.strokeRect(306, 22, 44, 12);                      // pliers
      g.beginPath(); g.moveTo(376, 28); g.lineTo(470, 28); g.lineTo(470, 56); g.lineTo(376, 70); g.closePath(); g.stroke();                                          // saw
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(392 + i * 16, 90); g.lineTo(392 + i * 16, 150); g.stroke(); }                                            // screwdrivers
      g.beginPath(); g.arc(70, 190, 26, 0, TAU); g.stroke(); g.beginPath(); g.arc(150, 190, 18, 0, TAU); g.stroke(); g.strokeRect(210, 166, 90, 40);                // hose coil, spool, a box
      g.fillStyle = '#b3261e'; g.fillRect(330, 176, 160, 30); g.fillStyle = '#f6efe0'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('CHI PIGLIA, RIPORTA', 410, 198);
      g.restore(); }
    // painted sign over the shutter
    { const [x, y, sw, sh] = ATLAS.sign; g.save(); g.translate(x, y);
      g.fillStyle = '#d6c9ac'; g.fillRect(0, 0, sw, sh);
      g.strokeStyle = '#8a2a22'; g.lineWidth = 5; g.strokeRect(8, 8, sw - 16, sh - 16); g.lineWidth = 2; g.strokeRect(16, 16, sw - 32, sh - 32);
      g.fillStyle = '#8a2a22'; g.textAlign = 'center'; g.font = `900 58px ${FONT}`; g.fillText('OFFICINA  ZU TURIDDU', sw / 2, 72);
      g.font = `700 26px ${FONT}`; g.fillText('GOMME  ·  FRENI  ·  FRIZIONI  ·  SI RIPARA TUTTO', sw / 2, 104);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(214,201,172,${0.5 + R() * 0.4})`; g.beginPath(); g.ellipse(R() * sw, 18 + R() * (sh - 36), 3 + R() * 8, 2 + R() * 4, R() * 3, 0, TAU); g.fill(); }   // paint flaking off
      g.restore(); }
    // calendar: a sea view, a month with most of the days crossed out
    { const [x, y, cw, ch] = ATLAS.cal; g.save(); g.translate(x, y);
      g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, cw, ch);
      const sk = g.createLinearGradient(0, 0, 0, 64); sk.addColorStop(0, '#59a8e0'); sk.addColorStop(1, '#bfe4f2'); g.fillStyle = sk; g.fillRect(6, 6, cw - 12, 64);
      g.fillStyle = '#7d8a6a'; g.beginPath(); g.moveTo(6, 52); g.lineTo(34, 24); g.lineTo(66, 18); g.lineTo(94, 38); g.lineTo(cw - 6, 50); g.lineTo(cw - 6, 70); g.lineTo(6, 70); g.fill();   // Monte Pellegrino
      g.fillStyle = '#2d78c0'; g.fillRect(6, 52, cw - 12, 18); g.fillStyle = '#f7d36a'; g.beginPath(); g.arc(100, 22, 8, 0, TAU); g.fill();
      g.fillStyle = '#e8559a'; g.fillRect(40, 56, 20, 8); g.fillStyle = '#17131a'; g.fillRect(44, 62, 4, 4); g.fillRect(54, 62, 4, 4);   // a tiny vespa on the beach road
      g.fillStyle = '#b3261e'; g.fillRect(0, 74, cw, 20); g.fillStyle = '#f6efe0'; g.font = `700 16px ${FONT}`; g.textAlign = 'center'; g.fillText('AGOSTO', cw / 2, 90);
      g.fillStyle = '#2a2420'; g.font = `600 10px ${FONT}`;
      for (let d = 0; d < 31; d++) { const c = (d + 3) % 7, r = Math.floor((d + 3) / 7), px = 10 + c * 15, py = 108 + r * 14; g.fillText(String(d + 1), px + 6, py); if (d < 13 || d === 20) { g.strokeStyle = 'rgba(180,30,24,0.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py - 9); g.lineTo(px + 12, py + 2); g.stroke(); } }
      g.strokeStyle = '#b3261e'; g.lineWidth = 2; g.beginPath(); g.ellipse(10 + 5 * 15 + 6, 108 + 14 * 2 - 3, 10, 8, 0, 0, TAU); g.stroke();   // the 15th, circled
      g.fillStyle = '#b3261e'; g.font = `700 11px ${FONT}`; g.fillText('FERRAGOSTO: CHIUSO', cw / 2, ch - 6);
      g.restore(); }
    // Santa Rosalia, in a gilt frame: brown habit, crown of white roses, a skull, a crucifix
    { const [x, y, pw, ph] = ATLAS.saint; g.save(); g.translate(x, y);
      g.fillStyle = '#c9a23a'; g.fillRect(0, 0, pw, ph); g.fillStyle = '#7a5a1a'; g.fillRect(6, 6, pw - 12, ph - 12);
      const bg = g.createLinearGradient(0, 10, 0, ph - 10); bg.addColorStop(0, '#1b2f4a'); bg.addColorStop(1, '#4a6a60'); g.fillStyle = bg; g.fillRect(10, 10, pw - 20, ph - 20);
      g.fillStyle = '#f7e9a0'; for (let i = 0; i < 18; i++) g.fillRect(14 + R() * (pw - 28), 14 + R() * 70, 2, 2);
      soft(g, pw / 2, 70, 56, 'rgba(255,230,150,0.55)');
      g.fillStyle = '#6a4326'; g.beginPath(); g.moveTo(pw / 2 - 18, 88); g.lineTo(pw / 2 + 18, 88); g.lineTo(pw / 2 + 52, ph - 14); g.lineTo(pw / 2 - 52, ph - 14); g.fill();   // habit
      g.fillStyle = '#4e3018'; g.fillRect(pw / 2 - 3, 100, 6, ph - 114);
      g.fillStyle = '#e1b48a'; g.beginPath(); g.arc(pw / 2, 74, 15, 0, TAU); g.fill();   // face
      g.fillStyle = '#2a1a10'; g.fillRect(pw / 2 - 7, 72, 3, 3); g.fillRect(pw / 2 + 4, 72, 3, 3); g.fillRect(pw / 2 - 4, 82, 8, 2);
      for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; g.fillStyle = i % 2 ? '#fff6ec' : '#f3a6b8'; g.beginPath(); g.arc(pw / 2 + Math.cos(a) * 17, 70 + Math.sin(a) * 15, 5, 0, TAU); g.fill(); }   // roses
      g.fillStyle = '#f2ecd8'; g.beginPath(); g.arc(pw / 2 - 26, 140, 9, 0, TAU); g.fill(); g.fillStyle = '#2a1a10'; g.fillRect(pw / 2 - 30, 138, 3, 4); g.fillRect(pw / 2 - 24, 138, 3, 4);   // skull
      g.strokeStyle = '#e6d8a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(pw / 2 + 30, 118); g.lineTo(pw / 2 + 30, 160); g.moveTo(pw / 2 + 22, 128); g.lineTo(pw / 2 + 38, 128); g.stroke();   // crucifix
      g.restore(); }
    // a note taped to the wall
    { const [x, y, nw, nh] = ATLAS.note; g.save(); g.translate(x, y);
      g.fillStyle = '#f2edd8'; g.fillRect(8, 6, nw - 16, nh - 12); g.fillStyle = 'rgba(200,190,150,0.8)'; g.fillRect(nw / 2 - 20, 0, 40, 14);
      g.fillStyle = '#17131a'; g.textAlign = 'center'; g.font = `900 40px ${FONT}`; g.fillText('SI PAGA PRIMA', nw / 2, 60);
      g.font = `32px ${HAND}`; g.fillStyle = '#b3261e'; g.fillText('il credito è morto', nw / 2, 100);
      g.restore(); }
  });
}
function platformTex() {   // turntable top: steel plate, diamond tread, a hazard ring, tick marks
  return canvasTex(512, 512, (g, w, h) => {
    const R = rng(9), c = w / 2; g.fillStyle = '#6d7379'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,34,38,0.28)'; g.lineWidth = 2;
    for (let i = -w; i < w * 2; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    for (let i = 0; i < 40; i++) soft(g, R() * w, R() * h, 20 + R() * 40, `rgba(${R() < 0.5 ? '20,18,16' : '190,196,200'},0.14)`);
    g.fillStyle = '#d6b21a'; g.beginPath(); g.arc(c, c, c * 0.985, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(c, c, c * 0.985, 0, TAU); g.arc(c, c, c * 0.9, 0, TAU, true); g.clip();
    g.fillStyle = '#1a1a1c'; for (let a = 0; a < 36; a += 2) { g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a / 36 * TAU, (a + 1) / 36 * TAU); g.fill(); }
    g.restore();
    g.save(); g.beginPath(); g.arc(c, c, c * 0.9, 0, TAU); g.clip();
    g.fillStyle = '#6d7379'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,34,38,0.28)'; for (let i = -w; i < w * 2; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    for (let i = 0; i < 40; i++) soft(g, R() * w, R() * h, 20 + R() * 40, `rgba(${R() < 0.5 ? '20,18,16' : '190,196,200'},0.14)`);
    g.restore();
    g.strokeStyle = 'rgba(240,240,230,0.7)'; g.lineWidth = 5;
    for (let a = 0; a < 8; a++) { const t = a / 8 * TAU; g.beginPath(); g.moveTo(c + Math.cos(t) * c * 0.78, c + Math.sin(t) * c * 0.78); g.lineTo(c + Math.cos(t) * c * 0.86, c + Math.sin(t) * c * 0.86); g.stroke(); }
    g.beginPath(); g.arc(c, c, c * 0.1, 0, TAU); g.fillStyle = '#2a2d31'; g.fill();
  });
}
function stainTex() {   // oil and tyre marks on the floor (one texture over the whole floor)
  return canvasTex(256, 320, (g, w, h) => {
    const R = rng(3), X = x => (x - X0) / (X1 - X0) * w, Z = z => (z - Z0) / (Z1 - Z0) * h, M = w / (X1 - X0);
    for (let i = 0; i < 26; i++) { const x = X(-4 + R() * 7.5), z = Z(-4.6 + R() * 8); soft(g, x, z, (6 + R() * 22) * M / 8, `rgba(14,10,6,${0.25 + R() * 0.3})`); }
    soft(g, X(0), Z(0), 2.6 * M, 'rgba(10,8,4,0.55)'); soft(g, X(0.3), Z(-0.4), 1.7 * M, 'rgba(10,8,4,0.5)');
    for (let i = 0; i < 4; i++) soft(g, X(-3.5 + i * 0.4), Z(-1.9 + i * 0.3), (0.6 + R() * 0.4) * M, 'rgba(8,6,4,0.6)');
    g.strokeStyle = 'rgba(12,10,8,0.45)'; g.lineWidth = 4;
    for (const o of [-0.7, 0.7]) { g.beginPath(); g.moveTo(X(-1.5 + o), Z(Z0)); g.bezierCurveTo(X(-1.6 + o), Z(-3), X(-1 + o), Z(-1.2), X(0.2 + o), Z(2.5)); g.stroke(); }   // tyre tracks in from the door
    g.lineWidth = 2; g.strokeStyle = 'rgba(12,10,8,0.5)'; g.beginPath(); g.moveTo(X(-3.2), Z(-2.1)); g.lineTo(X(-2.3), Z(-0.6)); g.lineTo(X(-1.2), Z(0.1)); g.stroke();   // a drip trail
    g.strokeStyle = 'rgba(220,190,40,0.4)'; g.lineWidth = 3; g.setLineDash([11, 7]); g.beginPath(); g.moveTo(X(3.3), Z(-3.8)); g.lineTo(X(3.3), Z(5.6)); g.stroke(); g.setLineDash([]);   // a faded bay line
  });
}
function glowTex(kind) {   // 'patch': the lit patch on the floor. 'shaft': a soft vertical fade for the light beam
  return canvasTex(128, 128, (g, w, h) => {
    if (kind === 'patch') {
      const m = 12, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)');
      g.fillStyle = gr; g.fillRect(m, 0, w - 2 * m, h);
      const ed = g.createLinearGradient(0, 0, w, 0); ed.addColorStop(0, 'rgba(0,0,0,1)'); ed.addColorStop(0.12, 'rgba(0,0,0,0)'); ed.addColorStop(0.88, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = ed; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
      // the half-raised shutter's edge and a window cross cast a few darker bars
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(w * 0.48, 0, 3, h * 0.8);
    } else {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const ed = g.createLinearGradient(0, 0, w, 0); ed.addColorStop(0, 'rgba(0,0,0,0.9)'); ed.addColorStop(0.3, 'rgba(0,0,0,0)'); ed.addColorStop(0.7, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,0.9)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = ed; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
    }
  });
}
const blobTex = () => canvasTex(64, 64, g => { soft(g, 32, 32, 32, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'); });

// ---------------------------------------------------------------------------------------------------------------------------
// the room
// ---------------------------------------------------------------------------------------------------------------------------
export function buildOfficina({ vehicle, day = true } = {}) {
  const light = makeLight(day), texs = [];
  const T = t => (texs.push(t), t);
  const group = new THREE.Group(), meshes = [];
  const put = (bake, mat) => { const m = bake.mesh(mat); group.add(m); meshes.push(m); return m; };
  let tris = 0;

  // -- floor, the lane outside, walls, ceiling
  const floor = new Bake(light);
  floor.grid([X0, 0, Z1], [X1 - X0, 0, 0], [0, 0, Z0 - Z1], 23, 28, '#ffffff', p => [p.x / 2.2, p.z / 2.2]);
  floor.grid([X0 - 1, 0, Z0], [X1 - X0 + 2, 0, 0], [0, 0, -3.6], 1, 1, day ? '#ffe9bf' : '#6a4c30', p => [p.x / 2.2, p.z / 2.2], false);   // the lane, sunlit (or under the street lamp)
  tris += floor.tris; put(floor, surface(T(floorTex())));

  const wall = new Bake(light), uvW = p => [(p.x + p.z) / 2.5, p.y / H];
  wall.grid([X0, 0, Z0], [DX0 - X0, 0, 0], [0, H, 0], 4, 10, '#fff', uvW);                // back wall: left of the door
  wall.grid([DX1, 0, Z0], [X1 - DX1, 0, 0], [0, H, 0], 12, 10, '#fff', uvW);              // right of the door
  wall.grid([DX0, DY, Z0], [DX1 - DX0, 0, 0], [0, H - DY, 0], 9, 3, '#fff', uvW);         // above it
  wall.grid([DX0, 0, Z0], [0, 0, -0.4], [0, DY, 0], 1, 6, '#fff', uvW);                   // the reveals: 40 cm of wall
  wall.grid([DX1, 0, Z0 - 0.4], [0, 0, 0.4], [0, DY, 0], 1, 6, '#fff', uvW);
  wall.grid([DX0, DY, Z0 - 0.4], [DX1 - DX0, 0, 0], [0, 0, 0.4], 9, 1, '#fff', uvW);
  wall.grid([X0, 0, Z1], [0, 0, Z0 - Z1], [0, H, 0], 28, 10, '#fff', uvW);                // left wall
  wall.grid([X1, 0, Z0], [0, 0, Z1 - Z0], [0, H, 0], 28, 10, '#fff', uvW);                // right wall
  wall.grid([X1, 0, Z1], [X0 - X1, 0, 0], [0, H, 0], 23, 10, '#fff', uvW);                // behind the camera
  wall.grid([X0, H, Z0], [X1 - X0, 0, 0], [0, 0, Z1 - Z0], 12, 14, '#8a8272', [0, 0, 1, 1]);   // ceiling (the texture's plaster, darker)
  tris += wall.tris; put(wall, surface(T(wallTex())));

  // -- the roller shutter, half way up: curtain, bottom bar, casing, rails
  const shut = new Bake(light);
  shut.grid([DX0, OPEN, Z0 - 0.14], [DX1 - DX0, 0, 0], [0, DY - OPEN, 0], 6, 3, '#ffffff', [0, 0, (DX1 - DX0) / 0.6, (DY - OPEN) / 0.6]);
  tris += shut.tris; put(shut, surface(T(shutterTex())));
  const str = new THREE.MeshBasicMaterial({ map: T(streetTex(day)), fog: false });
  const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 8.4), str); street.position.set((DX0 + DX1) / 2, 4.2, Z0 - 3.6); group.add(street); meshes.push(street); tris += 2;

  // -- decor on the walls (one atlas)
  const dec = new Bake(light), quad = (k, cx, cy, cz, w, h, face = 'z', hang = 0) => {
    const [u0, v0, u1, v1] = uvOf(k);
    if (face === 'z') dec.grid([cx - w / 2, cy - h / 2, cz], [w, 0, 0], [0, h, 0], 3, 3, '#ffffff', [u0, v0, u1, v1]);
    else dec.grid([cx, cy - h / 2, cz + w / 2], [0, 0, -w], [0, h, 0], 3, 3, '#ffffff', [u0, v0, u1, v1]);   // facing +x (left wall)
  };
  quad('sign', (DX0 + DX1) / 2, 3.42, Z0 + 0.015, 2.7, 0.675);
  quad('saint', 1.6, 1.95, Z0 + 0.03, 0.62, 0.78);
  quad('cal', 2.62, 1.88, Z0 + 0.02, 0.5, 0.75);
  quad('peg', X0 + 0.02, 1.95, -2.55, 3.2, 1.6, 'x');
  quad('note', X0 + 0.015, 2.85, -0.9, 0.62, 0.35, 'x');
  tris += dec.tris; put(dec, surface(T(decorAtlas())));

  // -- the props: everything without a texture of its own, merged
  const P = new Bake(light);
  buildProps(P, day);
  tris += P.tris; put(P, surface(null));

  // -- tubes, bulb and the candle flame glow on their own (not lit): added to the same kind of mesh
  const G = new Bake(light);
  for (const z of [-1.6, 2.4]) { G.box('#f4f9ff', -1.2, 3.66, z, 0.1, 0.05, 1.5, 0, false); }
  G.sph('#fff0c0', -3.95, 2.27, -2.9, 0.07, 8, false);
  G.sph('#ffb040', 1.5, 1.37, Z0 + 0.1, 0.022, 6, false);
  G.box('#ffb347', X0 + 0.56, 1.1, -3.55, 0.01, 0.034, 0.16, 0, false);   // the radio's dial
  tris += G.tris; put(G, surface(null));

  // -- decals on the floor: stains, the patch of light, the beam
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: T(stainTex()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  stain.position.set((X0 + X1) / 2, 0.004, (Z0 + Z1) / 2); stain.renderOrder = 1; group.add(stain); meshes.push(stain); tris += 2;

  const col = day ? new THREE.Color('#ffd89a') : new THREE.Color('#ff8a30'), kI = day ? 1 : 0.4;
  const parallelogram = (pts, uvs, mat, order) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); const m = new THREE.Mesh(g, mat); m.renderOrder = order; m.frustumCulled = false; group.add(m); meshes.push(m); tris += 2; return m;
  };
  const addMat = (tex, op) => new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const pa = glowTex('patch'), sf = glowTex('shaft'); T(pa); T(sf);
  const run = OPEN / -SUN.y, sx = SUN.x * run, sz = SUN.z * run;   // how far the light travels over the floor from the bottom bar's height
  parallelogram([[DX0, 0.012, Z0], [DX1, 0.012, Z0], [DX1 + sx, 0.012, Z0 + sz], [DX0 + sx, 0.012, Z0 + sz]], [[0, 1], [1, 1], [1, 0], [0, 0]], addMat(pa, 0.62 * kI), 2);
  const beam = addMat(sf, 0.2 * kI);
  parallelogram([[DX0, OPEN, Z0], [DX1, OPEN, Z0], [DX1 + sx, 0.02, Z0 + sz], [DX0 + sx, 0.02, Z0 + sz]], [[0, 0], [1, 0], [1, 1], [0, 1]], beam, 3);   // the beam's upper face
  for (const x of [DX0, DX1]) parallelogram([[x, 0.02, Z0], [x, OPEN, Z0], [x + sx, 0.02, Z0 + sz], [x + sx, 0.02, Z0 + sz]], [[0, 1], [0, 0], [1, 1], [1, 1]], beam, 3);   // the two sides are triangles
  // dust floating in the beam
  const N = 46, dp = new Float32Array(N * 3), dr = rng(8), dv = [];
  for (let i = 0; i < N; i++) { dv.push([(dr() - 0.5) * 0.06, 0.01 + dr() * 0.03, 0.02 + dr() * 0.05]); }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dp, 3)), new THREE.PointsMaterial({ color: col, size: 0.035, transparent: true, opacity: 0.8 * kI, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const seedDust = i => { const u = dr(), v = dr(), w = dr(); dp[i * 3] = DX0 + (DX1 - DX0) * u + SUN.x * w * 4; dp[i * 3 + 1] = 0.1 + (OPEN - 0.1) * (1 - w) * v + 0.05; dp[i * 3 + 2] = Z0 + w * run * SUN.z; };
  for (let i = 0; i < N; i++) seedDust(i);
  dust.frustumCulled = false; dust.renderOrder = 4; group.add(dust); meshes.push(dust);

  // -- the turntable (it turns, the room does not)
  const turntable = new THREE.Group(), TOP = 0.14, RAD = 2.15;
  const pm = new THREE.MeshLambertMaterial({ map: T(platformTex()) });
  const top = new THREE.Mesh(new THREE.CircleGeometry(RAD, 48).rotateX(-Math.PI / 2), pm); top.position.y = TOP; const plat = new THREE.Group(); plat.add(top); turntable.add(plat);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD * 1.01, TOP, 48, 1, true), new THREE.MeshLambertMaterial({ color: '#2a2c30' })); rim.position.y = TOP / 2; plat.add(rim);
  tris += 96 + 96;

  // real lights, for the vehicles (the room itself is baked)
  const sun = new THREE.DirectionalLight(day ? '#ffddaa' : '#ff9a4a', day ? 2.6 : 0.9); sun.target.position.set(0, 0.6, 0); sun.position.copy(sun.target.position).addScaledVector(SUN, -12);
  const hemi = new THREE.HemisphereLight(day ? '#f4e6cc' : '#6a78b0', day ? '#4a4034' : '#1c1a22', day ? 1.0 : 0.75);
  const tube = new THREE.PointLight(day ? '#eaf3ff' : '#dbe8ff', day ? 26 : 34, 14, 1.6); tube.position.set(-0.4, 3.3, 2.2);
  const fill = new THREE.PointLight('#ffbe80', day ? 8 : 14, 10, 1.8); fill.position.set(-3.5, 2.0, 0.5);
  const lights = [sun, sun.target, hemi, tube, fill];

  // the Vespa in the corner (a real vehicle model, parked)
  const extras = new THREE.Group(); let corner = null;
  if (vehicle && vehicle.buildVehicleModel) {
    corner = vehicle.buildVehicleModel({ type: 'vespa', livery: 'crema', parts: {} });
    corner.root.position.set(2.75, 0, -3.35); corner.root.rotation.y = -0.85; corner.pose({}); extras.add(corner.root);
  }

  let texKB = 0;
  for (const t of texs) { const im = t.image; if (im) texKB += im.width * im.height * 4 * 1.33 / 1024; }

  return {
    id: 'officina', group, extras, turntable, platform: plat, top: TOP, radius: RAD, lights, tris, texKB: Math.round(texKB), draws: meshes.length + 2,
    cam: { az: 0.36 },
    bounds: { x0: X0 + 0.4, x1: X1 - 0.5, z0: Z0 + 1, z1: Z1 - 0.4, y1: H - 0.5 },
    exposure: 1.0,
    env(x, y, z) {   // the colour of the room in a direction, for the reflections on the paint and chrome
      const k = day ? 1 : 0.55;
      if (y < -0.15) return [0.2 * k, 0.19 * k, 0.18 * k];
      let r = 0.5 * k, g = 0.47 * k, b = 0.43 * k;
      if (z < -0.5 && y < 0.55) { const a = smooth(0.5, 0.95, -z) * (1 - smooth(0.2, 0.55, y)); const s = day ? [2.4, 2.0, 1.4] : [1.6, 0.9, 0.35]; r += s[0] * a; g += s[1] * a; b += s[2] * a; }   // the open door
      if (y > 0.7) { const a = smooth(0.7, 0.95, y); r += 0.9 * a * k; g += 1.0 * a * k; b += 1.1 * a * k; }   // tubes
      return [r, g, b];
    },
    onLook(look) { if (corner) corner.root.visible = look.type !== 'vespa'; },
    update(sec, dt) {
      for (let i = 0; i < N; i++) {
        dp[i * 3] += dv[i][0] * dt + Math.sin(sec * 0.7 + i) * 0.0015; dp[i * 3 + 1] += dv[i][1] * dt * Math.sin(sec * 0.5 + i * 2); dp[i * 3 + 2] += dv[i][2] * dt;
        if (dp[i * 3 + 2] > Z0 + run * SUN.z || dp[i * 3 + 1] < 0.04 || dp[i * 3 + 1] > OPEN + 0.2) seedDust(i);
      }
      dust.geometry.attributes.position.needsUpdate = true;
    },
    dispose() { disposeTree(group); disposeTree(turntable); if (corner) corner.dispose(); },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the things in the room
// ---------------------------------------------------------------------------------------------------------------------------
function buildProps(P, day) {
  const WOOD = '#8a6a44', STEEL = '#3d434a', GREY = '#9aa0a4', RUBBER = '#1c1c1e';
  // workbench along the left wall
  const bx = X0 + 0.42, bz = -2.65, bl = 3.5;
  P.box(WOOD, bx, 0.92, bz, 0.8, 0.07, bl);
  P.box('#6e5436', bx, 0.88, bz, 0.78, 0.03, bl - 0.04);
  for (const z of [bz - bl / 2 + 0.1, bz + bl / 2 - 0.1]) for (const x of [bx - 0.34, bx + 0.34]) P.box(STEEL, x, 0.45, z, 0.06, 0.9, 0.06);
  P.box('#5a564e', bx, 0.28, bz, 0.72, 0.04, bl - 0.16);
  P.box(STEEL, bx, 0.5, bz + bl / 2 - 0.1, 0.7, 0.04, 0.04); P.box(STEEL, bx, 0.5, bz - bl / 2 + 0.1, 0.7, 0.04, 0.04);
  const cans = ['#b3261e', '#2a63b0', '#d6b21a', '#3f7a52', '#e8e2d0'];
  for (let i = 0; i < 9; i++) P.cyl(cans[i % 5], bx - 0.12 + (i % 3) * 0.14, 0.4, bz - 1.4 + i * 0.3, 0.055, 0.055, 0.18, 8);     // paint and oil cans on the lower shelf
  for (let i = 0; i < 5; i++) P.box(i % 2 ? '#a58a60' : '#c8b88c', bx + 0.05, 0.37, bz + 0.2 + i * 0.28, 0.4, 0.12 + (i % 3) * 0.05, 0.22, 0.1 * i);   // boxes of spares
  P.cyl(RUBBER, bx, 0.18, bz + 1.45, 0.17, 0.17, 0.2, 12); P.cyl('#c8c8c0', bx, 0.18, bz + 1.45, 0.07, 0.07, 0.21, 8);                     // a spare tyre under the bench
  // on the bench: vice, radio, moka and a cup, a panino in foil, a jar of screws, rags
  P.box('#5c6268', bx + 0.1, 1.0, -1.35, 0.2, 0.1, 0.16); P.box(GREY, bx + 0.0, 1.07, -1.35, 0.06, 0.1, 0.16); P.cyl(GREY, bx + 0.25, 1.04, -1.35, 0.012, 0.012, 0.26, 6, true, { rx: Math.PI / 2 });
  P.box('#6b3f26', bx + 0.04, 1.06, -3.55, 0.17, 0.21, 0.4);                                              // radio
  P.box('#c9a56a', bx + 0.131, 1.06, -3.55, 0.012, 0.185, 0.36);                                           // its face
  P.box('#4a2c1a', bx + 0.14, 1.0, -3.68, 0.014, 0.1, 0.12);                                               // grille
  P.box('#1e1a14', bx + 0.14, 1.11, -3.55, 0.012, 0.04, 0.18);                                             // dial window
  P.cyl('#e6dcc0', bx + 0.14, 1.0, -3.43, 0.022, 0.022, 0.025, 8, true, { rz: Math.PI / 2 }); P.cyl('#e6dcc0', bx + 0.14, 1.06, -3.43, 0.022, 0.022, 0.025, 8, true, { rz: Math.PI / 2 });   // knobs
  P.cyl('#c8c8c8', bx - 0.02, 1.33, -3.4, 0.005, 0.005, 0.5, 4, true, { rz: -0.35, rx: 0.2 });              // antenna
  P.cyl('#b8bcc0', bx, 1.02, -2.95, 0.055, 0.04, 0.12, 8); P.cyl('#b8bcc0', bx, 1.1, -2.95, 0.035, 0.05, 0.05, 8); P.box('#17131a', bx + 0.075, 1.03, -2.95, 0.015, 0.07, 0.02);   // moka pot
  P.cyl('#f0ece0', bx + 0.16, 0.985, -2.78, 0.035, 0.028, 0.055, 8);                                      // espresso cup
  P.box('#c4c8cc', bx + 0.1, 0.97, -2.4, 0.11, 0.045, 0.17, 0.3);                                         // panino con la milza, in foil
  P.cyl('#d8e4e8', bx - 0.18, 1.0, -1.85, 0.05, 0.05, 0.12, 8); P.cyl('#8f8f8a', bx - 0.18, 1.07, -1.85, 0.052, 0.052, 0.02, 8);      // a jar of screws
  P.box('#b3261e', bx + 0.14, 0.965, -1.95, 0.14, 0.02, 0.12, 0.5);                                       // rag
  P.box('#2a63b0', bx - 0.2, 0.985, -3.1, 0.09, 0.07, 0.07, 0.2);                                         // a box of fuses
  // pegboard tools in front of the board (a few of the white outlines are filled)
  const tx = X0 + 0.07, tool = (col, y, z, h, w = 0.025, d = 0.012) => P.box(col, tx, y, z, d, h, w);
  for (let i = 0; i < 7; i++) { const z = -2.55 + 1.6 - (28 + i * 30) / 512 * 3.2 + 0.0; if (i === 3 || i === 5) continue; tool('#aeb4b8', 2.34 - (90 - i * 5) / 256 * 0.8 * 0.5, z, 0.3 - i * 0.012); P.sph('#aeb4b8', tx, 2.5, z, 0.028, 6); }   // spanners
  { const z = -2.55 + 1.6 - 262 / 512 * 3.2 - 0.02; tool('#7a4a26', 2.2, z, 0.5, 0.03); P.box('#6c7278', tx, 2.5, z, 0.03, 0.06, 0.16); }   // hammer
  { const z = -2.55 + 1.6 - 328 / 512 * 3.2; tool('#b3261e', 2.35, z, 0.26, 0.05); }                                                       // pliers
  for (let i = 0; i < 5; i++) if (i !== 2) { const z = -2.55 + 1.6 - (392 + i * 16) / 512 * 3.2; tool(i % 2 ? '#d6b21a' : '#e8e2d0', 2.32, z, 0.3, 0.018); }     // screwdrivers
  P.cyl('#2a2a2e', tx, 1.8, -2.55 + 1.6 - 70 / 512 * 3.2, 0.14, 0.14, 0.05, 12, true, { rz: Math.PI / 2 });                                  // hose coil
  // hanging bulb and cord over the bench
  P.cyl('#17131a', -3.95, 3.2, -2.9, 0.008, 0.008, 1.2, 4); P.cyl('#9a9a94', -3.95, 2.38, -2.9, 0.04, 0.04, 0.07, 8);
  // tyres: two stacks and one leaning, in the back corner
  const stack = (x, z, n, r = 0.3) => { for (let i = 0; i < n; i++) { P.tor(RUBBER, x, 0.11 + i * 0.205, z, r - 0.1, 0.1, { rx: Math.PI / 2, ry: i * 0.5 }); P.cyl('#8a8e92', x, 0.11 + i * 0.205, z, r - 0.17, r - 0.17, 0.12, 10); } };
  stack(4.05, -4.3, 5); stack(3.45, -4.55, 3); stack(4.1, -3.45, 4, 0.28);
  P.tor(RUBBER, 2.0, 0.34, -4.8, 0.24, 0.1, { rx: 1.25 }); P.cyl('#8a8e92', 2.0, 0.34, -4.77, 0.13, 0.13, 0.12, 10, true, { rx: 1.25 });
  stack(X0 + 0.5, 0.2, 2); stack(X0 + 0.5, 0.95, 3, 0.27);
  // oil drums, a rolling toolbox, a mop bucket, a jack, a plastic chair
  const drum = (x, z, c) => { P.cyl(c, x, 0.45, z, 0.29, 0.29, 0.9, 14); for (const y of [0.15, 0.45, 0.75]) P.cyl(c === '#2a63b0' ? '#1d4780' : '#8a1a14', x, y, z, 0.3, 0.3, 0.04, 14); P.cyl('#2a2a2e', x, 0.9, z, 0.2, 0.2, 0.01, 12); };
  drum(0.95, -4.5, '#2a63b0'); drum(X0 + 0.45, 2.2, '#b3261e'); drum(X0 + 0.45, 3.0, '#2a63b0');
  { const x = X0 + 0.45, z = -0.15; P.box('#b3261e', x, 0.45, z, 0.5, 0.9, 0.7); for (let i = 0; i < 4; i++) P.box('#7a1812', x + 0.255, 0.18 + i * 0.2, z, 0.012, 0.15, 0.62); P.box('#2a2a2e', x, 0.915, z, 0.52, 0.03, 0.72);
    for (const sx of [-1, 1]) P.cyl(RUBBER, x, 0.07, z + sx * 0.28, 0.07, 0.07, 0.05, 8, true, { rz: Math.PI / 2 }); }
  { const x = X0 + 0.5, z = 4.2; P.cyl('#e0b020', x, 0.17, z, 0.2, 0.15, 0.34, 10); P.cyl('#9a9a94', x, 0.3, z, 0.21, 0.21, 0.03, 10); P.cyl('#7a5a30', x + 0.12, 0.62, z - 0.05, 0.012, 0.012, 1.0, 5, true, { rz: 0.2 }); P.box('#d8d4c8', x + 0.2, 0.15, z - 0.05, 0.22, 0.04, 0.22); }
  { const x = -2.1, z = 2.3; P.box('#d8d6cc', x, 0.44, z, 0.44, 0.04, 0.44, 0.4); for (const [dx, dz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) P.box('#cfcdc3', x + dx * Math.cos(0.4) - dz * Math.sin(0.4), 0.21, z + dx * Math.sin(0.4) + dz * Math.cos(0.4), 0.035, 0.42, 0.035); P.box('#d8d6cc', x - 0.15, 0.7, z + 0.15, 0.44, 0.38, 0.03, 0.4, true, 0, 0); }
  { const x = 3.2, z = 1.0; P.box('#17171a', x, 0.012, z, 0.6, 0.02, 0.8); for (let i = 0; i < 6; i++) P.box('#3a3a3e', x, 0.024, z - 0.32 + i * 0.128, 0.56, 0.01, 0.04); }   // the drain
  // a shelf under the saint, with the votive candle, plastic flowers and a lucky horn
  P.box(WOOD, 1.5, 1.28, Z0 + 0.14, 0.62, 0.04, 0.26); P.box(STEEL, 1.28, 1.2, Z0 + 0.1, 0.03, 0.12, 0.14); P.box(STEEL, 1.72, 1.2, Z0 + 0.1, 0.03, 0.12, 0.14);
  P.cyl('#b01818', 1.5, 1.34, Z0 + 0.12, 0.04, 0.034, 0.09, 8);
  for (const [dx, c] of [[-0.2, '#e8559a'], [-0.14, '#f2c200'], [-0.26, '#f2f2f2']]) { P.cyl('#2f7a52', 1.5 + dx, 1.4, Z0 + 0.12, 0.004, 0.004, 0.2, 4); P.sph(c, 1.5 + dx, 1.52, Z0 + 0.12, 0.03, 6); }
  P.cyl('#d84a3a', 1.76, 1.33, Z0 + 0.12, 0.018, 0.03, 0.08, 6, true, { rz: 0.4 });
  // roof beams
  for (const z of [-3.2, 0.8, 4.8]) P.box('#5e4c38', 0, H - 0.18, z, X1 - X0, 0.36, 0.3);
  // the shutter's casing, bottom bar and rails
  P.box('#5a6a5e', (DX0 + DX1) / 2, DY + 0.2, Z0 + 0.2, DX1 - DX0 + 0.2, 0.4, 0.4); P.box('#2c332e', (DX0 + DX1) / 2, OPEN - 0.05, Z0 - 0.1, DX1 - DX0, 0.1, 0.12);
  P.box('#c9c4b0', (DX0 + DX1) / 2, OPEN - 0.04, Z0 + 0.0, 0.18, 0.04, 0.03);   // its handle
  for (const x of [DX0 + 0.04, DX1 - 0.04]) P.box('#3a403c', x, DY / 2, Z0 - 0.1, 0.08, DY, 0.16);
  // fluorescent tube housings
  for (const z of [-1.6, 2.4]) P.box('#8a8e8c', -1.2, 3.7, z, 0.18, 0.06, 1.6);
}
