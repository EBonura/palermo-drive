// Piazza Castelnuovo and Piazza Ruggero Settimo (Piazza Politeama), Palermo: everything fixed in the piazza outside the Teatro Politeama itself.
// Each model was drawn from Wikimedia Commons photographs (only proportions, colours and the lettering of the two inscriptions were read from them, no picture is copied into the game):
//   Tempietto / Palchetto della Musica (Salvatore Valenti, 1874-75, white Carrara marble, Corinthian): Palchetto della Musica, Palermo, Sicily, Italy (9455643959).jpg;
//     Piazza Castelnuovo - panoramio (1).jpg (front, the measuring photo); Palermo Sicily Italy - Creative Commons by gnuckx (3492485256), (3492486040), (3492486572).jpg (capitals, frieze);
//     Benedetto Civiletti Lavoro SAM 0166.JPG (the side colonnade); Palchetto della Musica at night, Palermo, Sicily, Italy (9458312090).jpg; roof colour from the Regione Siciliana orthophoto
//     The flights carry a sloping balustrade with a hand rail (the front photos), drawn as plain iron bars. Not matched: in those photos the flights leave the podium sideways and end in a low gate; here they
//     run along the side walls so as to stay inside the footprint.
//   Monumento a Ruggero Settimo (Benedetto De Lisi, 1865): Ruggero Settimo statua.jpg (front, pose and lettering); Politeama Garibaldi e monumento a Ruggiero Settimo.jpg (three quarters, railing and kerb)
//   Monumento a Carlo Cottone (Costantino, 1868): Carlo Cottone Monument (Palermo) 1.jpg, 3.jpg, 5.jpg; Piazza Politeama - panoramio.jpg (the platform, posts, lamps and railing)
//   Nautica (Mario Rutelli): Mario Rutelli Nautica SAM 0172.JPG (side); "Die Piazza Castelnuovo gehört zu den beliebtesten Plätzen Palermos" 03.jpg (front quarter, post and cloak);
//     Palermo Sicily Italy - Creative Commons by gnuckx (3491666519) and (3491666969).jpg (arms, colour)
//   Lavoro (Benedetto Civiletti): Benedetto Civiletti Lavoro SAM 0166.JPG; Il Lavoro, statua di Benedetto Civiletti di Palermo.jpg (the plaster model)
//   I Senzatetto (Pasquale Civiletti): Palchetto della Musica, Palermo, Sicily, Italy (9455643959).jpg
//   Chiosco Ribaudo (Liberty kiosk): Chiosco Ribaudo Palermo1.jpg; Chiosco Ribaudo Piazza Castelnuovo (Palermo).JPG (the whole kiosk and its crown). The red and grey kiosk of the same name
//     in other Commons files stands elsewhere and was not used.
// Not verified, and left plain or simplified: the backs of every statue, pedestal and the kiosk; faces and drapery; the date under the Cottone inscription (worn, painted as strokes); the heights,
// estimated from the photographs. Round the Settimo monument, on the map's four street lamps (src/props.js leaves them to this file), stand black cast iron posts with square glass lanterns, lower
// than the pedestal (Politeama Garibaldi e monumento a Ruggiero Settimo.jpg; Teatro Politeama "Garibaldi" - panoramio.jpg). Their exact height and the detail of the iron are not verified.
// Where things stand: the OSM building w194689842 "Palchetto della musica" is the Tempietto (its position, -580, -949, equals the Commons geotag 38.12430752 N 13.35463252 E to the metre, and the
// front of the model faces the Politeama along the axis that also carries the Settimo and Cottone monuments). The Settimo monument is the 5.8 m square railing in the OSM fences (-461.8, -1010.3).
// The Cottone monument has no OSM node: it stands on that axis at the centre of Piazza Castelnuovo (Commons geotag of the piazza 38.12456619 N 13.35530334 E).
import * as THREE from 'three';
import {
  PI, bx, box, cyl, lathe, sphere, cone, panel, extrude, gridMesh, part, begin, end, defMat, mul, tr, rotY, frame, initShared,
  noiseDots, streaks, RNG, groundRange, groundY, balus, gable,
} from './lmc-kit.js';

// ---------------------------------------------------------------------------------------------------
// textures (every key starts with 'pz')
// ---------------------------------------------------------------------------------------------------
function paintMarble(g, w, h, seed, base, vein) {
  const r = RNG(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {   // soft grey and cream clouds: the Carrara marble is not one white
    const x = r() * w, y = r() * h, rx = 20 + r() * 60, ry = 8 + r() * 30;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.fillStyle = r() < 0.5 ? 'rgba(120,125,135,0.07)' : 'rgba(238,224,190,0.12)'; g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, 7); g.fill(); }
  }
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {   // blue-grey veins
    let x = r() * w, y = r() * h; g.strokeStyle = vein; g.lineWidth = 0.8 + r() * 1.4; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 36; y += (r() - 0.5) * 36; g.lineTo(x, y); }
    g.stroke();
  }
  noiseDots(g, w, h, w * h / 120, 1.6, seed + 3, ['rgba(80,70,55,0.10)', 'rgba(255,255,248,0.12)']);
  streaks(g, w, h, 8, seed + 5, 0.07, 70, '60,52,40');   // soot under every ledge
}

// regions [x, y, w, h] of the two sheets, both laid out on 512 x 384 and painted at three quarters of that (the texture budget of phones)
const DW = 512, DH = 384, SH = 0.75;
const DET = { rail: [0, 0, 192, 128], lattice: [192, 0, 160, 128], iron: [360, 8, 16, 112], shield: [400, 0, 80, 112], setText: [0, 128, 256, 144], cotText: [256, 128, 256, 144], wreaths: [0, 272, 512, 48], medusa: [0, 320, 512, 64] };
const RIB = { door: [0, 0, 192, 384], cant: [192, 0, 80, 384], sign: [272, 0, 240, 64], soffit: [272, 64, 240, 192], lace: [272, 256, 128, 128] };
const region = (g, T, k, f) => { const [x, y, w, h] = T[k]; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); f(w, h); g.restore(); };
// uv scale and offset that show region k of a sheet W x H on a part whose own uv runs 0..1
const uvr = (T, W, H, k) => { const [x, y, w, h] = T[k]; return { uv: 'keep', uvk: [(w - 1) / W, (h - 1) / H], uvo: [(x + 0.5) / W, 1 - (y + h - 0.5) / H] }; };

function paintDetails(g) {
  g.clearRect(0, 0, DW, DH);
  // wrought iron round the Settimo monument, one post-to-post bay (1.5 x 1.3 m): crossing lyre arms between two rails, a garland hung across
  region(g, DET, 'rail', (w, h) => {
    g.strokeStyle = g.fillStyle = '#5c6470'; g.lineCap = 'round';
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, h - 12); g.lineTo(w, h - 12); g.stroke(); g.beginPath(); g.moveTo(0, 14); g.lineTo(w, 14); g.stroke();
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(8, h - 14); g.bezierCurveTo(60, h - 14, 70, 26, 96, 26); g.bezierCurveTo(122, 26, 132, h - 14, 184, h - 14); g.stroke();
    g.beginPath(); g.moveTo(8, 18); g.bezierCurveTo(60, 18, 70, h - 28, 96, h - 28); g.bezierCurveTo(122, h - 28, 132, 18, 184, 18); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(96, h / 2, 13, 0, 7); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#4b535e'; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(w / 2, 90, w, 30); g.stroke();
    for (const x of [4, w - 4]) g.fillRect(x - 3, 0, 6, h);
  });
  // the panels round the Cottone monument: a diagonal lattice with rosettes over a band of scrolls
  region(g, DET, 'lattice', (w, h) => {
    g.strokeStyle = g.fillStyle = '#666e78'; g.lineWidth = 6; g.strokeRect(3, 5, w - 6, h - 10);
    g.beginPath(); g.moveTo(0, h - 30); g.lineTo(w, h - 30); g.stroke();
    g.lineWidth = 4; for (let i = -2; i < 5; i++) { const x = i * 40; g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 88, h - 30); g.stroke(); g.beginPath(); g.moveTo(x + 88, 6); g.lineTo(x, h - 30); g.stroke(); }
    for (const [x, y] of [[44, 49], [124, 49], [84, 49], [4, 49]]) { g.beginPath(); g.arc(x, y, x === 84 ? 12 : 7, 0, 7); g.fill(); }
    g.lineWidth = 4; for (let x = 12; x < w; x += 28) { g.beginPath(); g.arc(x, h - 18, 9, 0.4, 5.6); g.stroke(); }
  });
  region(g, DET, 'iron', (w, h) => { g.fillStyle = '#5c6470'; g.fillRect(0, 0, w, h); });
  // the shield on each pillar of the Tempietto balustrade
  region(g, DET, 'shield', (w, h) => {
    const path = (k) => { g.beginPath(); g.moveTo(w / 2 - 34 * k, h / 2 - 44 * k); g.lineTo(w / 2 + 34 * k, h / 2 - 44 * k); g.quadraticCurveTo(w / 2 + 40 * k, h / 2 + 16 * k, w / 2, h / 2 + 50 * k); g.quadraticCurveTo(w / 2 - 40 * k, h / 2 + 16 * k, w / 2 - 34 * k, h / 2 - 44 * k); g.fill(); };
    g.fillStyle = '#cfc9ba'; path(1.05); g.fillStyle = '#55534e'; path(0.84); g.fillStyle = '#8a867c'; path(0.46);
  });
  // engraved lettering on the front of the two shafts, as read on the photographs (the date under the Cottone text could not be read: left as worn strokes)
  const slab = (k, lines, seed) => region(g, DET, k, (w, h) => {
    paintMarble(g, w, h, seed, '#e2ded2', 'rgba(110,122,140,0.14)');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#625e55';
    lines.forEach(([t, y, px]) => { g.font = px + 'px Georgia, "Times New Roman", serif'; const m = Math.min(1, (w - 14) / g.measureText(t).width); g.save(); g.translate(w / 2, y); g.scale(m, 1.1); g.fillText(t, 0, 0); g.restore(); });
  });
  slab('setText', [['A', 28, 22], ['RUGGIERO SETTIMO', 56, 24], ['GLI ITALIANI', 86, 22], ['NEL 1865', 115, 20]], 4431);
  slab('cotText', [['A CARLO COTTONE', 34, 24], ['PRINCIPE DI CASTELNUOVO', 64, 19], ['I SICILIANI', 92, 19]], 4432);
  region(g, DET, 'cotText', (w) => { const r = RNG(4433); g.fillStyle = 'rgba(98,94,85,0.55)'; for (let x = w / 2 - 62; x < w / 2 + 62; x += 5 + r() * 4) g.fillRect(x, 112 + r() * 3, 2 + r() * 2, 9 + r() * 4); });
  // the Settimo frieze: five wreaths joined by hanging garlands
  region(g, DET, 'wreaths', (w, h) => {
    g.fillStyle = '#dcd8cb'; g.fillRect(0, 0, w, h);
    const leaf = (x, y, a, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 6.5, 3, a, 0, 7); g.fill(); };
    for (let i = 0; i < 5; i++) { const cx = 34 + i * 111; for (let k = 0; k < 14; k++) { const a = k * PI / 7; leaf(cx + Math.cos(a) * 17 + 1.5, h / 2 + Math.sin(a) * 17 + 1.5, a + 2, '#8f8a7a'); leaf(cx + Math.cos(a) * 17, h / 2 + Math.sin(a) * 17, a + 2, '#f1ede0'); } g.fillStyle = '#aca695'; g.beginPath(); g.arc(cx, h / 2, 6, 0, 7); g.fill(); }
    for (let i = 0; i < 4; i++) { const x0 = 56 + i * 111; for (let k = 0; k <= 10; k++) { const t = k / 10, x = x0 + 68 * t, y = 12 + Math.sin(t * PI) * 22; leaf(x + 1.5, y + 2, t * 3, '#8f8a7a'); leaf(x, y, t * 3 + 1, k % 2 ? '#efebdd' : '#c9c4b3'); } }
  });
  // the Cottone frieze: a row of dentils over a head in the middle and two long ribbon scrolls
  region(g, DET, 'medusa', (w, h) => {
    g.fillStyle = '#dad6c9'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6f6b60'; for (let x = 4; x < w; x += 15) g.fillRect(x, 0, 8, 13); g.fillStyle = '#f0ecdf'; g.fillRect(0, 13, w, 4);
    g.lineCap = 'round';
    for (const [dx, dy, c, lw] of [[2, 2, '#8d887a', 6], [0, 0, '#f3efe2', 4]]) {
      g.strokeStyle = c; g.lineWidth = lw;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * 24 + dx, 42 + dy); for (let k = 1; k <= 5; k++) { const x = w / 2 + s * (24 + k * 36); g.quadraticCurveTo(x - s * 18 + dx, 42 + (k % 2 ? -17 : 17) + dy, x + dx, 42 + dy); } g.stroke(); g.beginPath(); g.arc(w / 2 + s * 212 + dx, 42 + dy, 9, 0, 5); g.stroke(); }
      for (let k = 0; k < 9; k++) { const a = PI * 0.75 + k * PI * 0.19; g.beginPath(); g.moveTo(w / 2 + dx, 40 + dy); g.lineTo(w / 2 + Math.cos(a) * 24 + dx, 40 + Math.sin(a) * 21 + dy); g.stroke(); }
    }
    g.fillStyle = '#c3bdac'; g.beginPath(); g.ellipse(w / 2, 40, 11, 14, 0, 0, 7); g.fill(); g.fillStyle = '#6f6b60'; g.fillRect(w / 2 - 7, 36, 4, 3); g.fillRect(w / 2 + 3, 36, 4, 3); g.fillRect(w / 2 - 4, 47, 8, 2);
  });
}

function paintRib(g) {
  g.clearRect(0, 0, 512, 384);
  const CRM = '#eaddbd', GILT = '#a58d57', SHD = 'rgba(80,62,38,0.45)';
  const ground = (w, h, seed) => { g.fillStyle = CRM; g.fillRect(0, 0, w, h); noiseDots(g, w, h, w * h / 60, 1.5, seed, ['rgba(120,95,60,0.10)', 'rgba(255,250,232,0.16)']); streaks(g, w, h, w / 12, seed + 1, 0.12, 90, '80,62,40'); };
  // door face, 2.0 x 3.45 m: grey marble at the sides below, the tall opening with a ribbed rolling shutter, the ogee arched upper light in three parts, carved spandrels, a band of tiles over it
  region(g, RIB, 'door', (w, h) => {
    const X = (m) => w / 2 + m * w / 2.0, Y = (m) => h - m * h / 3.45;
    ground(w, h, 4441);
    const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); };
    for (const s of [-1, 1]) { R(s * 0.97 - 0.015, 0.9, s * 0.97 + 0.015, 3.3, GILT); R(s * 0.72 - 0.012, 0.9, s * 0.72 + 0.012, 3.0, GILT); }
    const arch = (k) => { g.beginPath(); g.moveTo(X(-0.6 * k), Y(0)); g.lineTo(X(-0.6 * k), Y(2.45)); g.quadraticCurveTo(X(-0.6 * k), Y(2.75 + (k - 1) * 0.5), X(-0.32 * k), Y(2.78 + (k - 1) * 0.6)); g.quadraticCurveTo(X(-0.26), Y(3.0 + (k - 1) * 0.9), X(0), Y(3.04 + (k - 1) * 1.0)); g.quadraticCurveTo(X(0.26), Y(3.0 + (k - 1) * 0.9), X(0.32 * k), Y(2.78 + (k - 1) * 0.6)); g.quadraticCurveTo(X(0.6 * k), Y(2.75 + (k - 1) * 0.5), X(0.6 * k), Y(2.45)); g.lineTo(X(0.6 * k), Y(0)); g.closePath(); };
    for (const s of [-1, 1]) { g.fillStyle = '#c2a96f'; g.beginPath(); g.arc(X(s * 0.52), Y(2.88), 13, 0, 7); g.fill(); g.strokeStyle = '#7e8460'; g.lineWidth = 3; g.beginPath(); g.arc(X(s * 0.52), Y(2.88), 8, 0, 5); g.stroke(); g.beginPath(); g.arc(X(s * 0.34), Y(3.0), 6, 1, 6); g.stroke(); }
    arch(1.12); g.fillStyle = GILT; g.fill(); arch(1.06); g.fillStyle = '#f3e8ca'; g.fill(); arch(0.94); g.fillStyle = '#34332f'; g.fill();
    g.save(); arch(0.94); g.clip(); g.fillStyle = 'rgba(255,255,255,0.10)'; for (let y = 0; y < h; y += 5) g.fillRect(0, y, w, 1.5); g.restore();
    R(-0.6, 2.03, 0.6, 2.13, '#efe3c3'); R(-0.6, 2.38, 0.6, 2.45, '#efe3c3'); for (const x of [-0.34, 0.34]) R(x - 0.035, 2.13, x + 0.035, 2.9, '#efe3c3'); R(-0.02, 2.13, 0.02, 2.4, '#efe3c3'); R(-0.6, 2.01, 0.6, 2.03, SHD);
    R(-0.93, 3.14, 0.93, 3.17, GILT); for (const [x0, x1] of [[-0.9, -0.56], [-0.42, 0.42], [0.56, 0.9]]) { R(x0, 3.19, x1, 3.32, '#8aa39a'); for (let x = x0 + 0.03; x < x1; x += 0.07) R(x, 3.22, x + 0.025, 3.29, '#e4e6d4'); }
    R(-1, 3.36, 1, 3.39, GILT); R(-1, 3.39, 1, 3.45, SHD);
    // grey veined marble at the foot, either side of the door
    for (const s of [-1, 1]) { const a = s > 0 ? 0.62 : -1.0, b = s > 0 ? 1.0 : -0.62; R(a, 0, b, 0.9, '#b3b2ac'); R(a, 0.82, b, 0.9, '#cfcec8'); R(a + 0.08, 0.14, b - 0.08, 0.68, '#a2a19b'); }
  });
  // canted face, 0.78 x 3.45 m: two tall mosaic strips of white scrolls on blue green, one over the other, framed in gilt
  region(g, RIB, 'cant', (w, h) => {
    const Y = (m) => h - m * h / 3.45;
    ground(w, h, 4451);
    for (const [y0, y1] of [[1.05, 2.05], [2.2, 3.05]]) {
      g.fillStyle = GILT; g.fillRect(w * 0.24, Y(y1), w * 0.52, Y(y0) - Y(y1)); g.fillStyle = '#6f8f8a'; g.fillRect(w * 0.29, Y(y1) + 4, w * 0.42, Y(y0) - Y(y1) - 8);
      g.strokeStyle = '#e9ead9'; g.lineWidth = 2.5; for (let y = Y(y1) + 14, i = 0; y < Y(y0) - 10; y += 17, i++) { g.beginPath(); g.arc(w / 2 + (i % 2 ? 5 : -5), y, 8, i % 2 ? 1.6 : -1.5, i % 2 ? 6.3 : 3.2); g.stroke(); g.fillStyle = '#a8584a'; g.fillRect(w / 2 + (i % 2 ? -12 : 8), y - 1, 4, 4); }
    }
    for (const x of [0.08, 0.9]) { g.fillStyle = GILT; g.fillRect(w * x, 0, 3, Y(0.9)); }
    g.fillRect(0, Y(3.17), w, 3); g.fillStyle = '#8aa39a'; g.fillRect(w * 0.2, Y(3.32), w * 0.6, Y(3.19) - Y(3.32)); g.fillStyle = SHD; g.fillRect(0, 0, w, 6);
    g.fillStyle = '#b3b2ac'; g.fillRect(0, Y(0.9), w, Y(0) - Y(0.9));
  });
  // the name board
  region(g, RIB, 'sign', (w, h) => {
    g.fillStyle = CRM; g.fillRect(0, 0, w, h); g.fillStyle = '#6f6442'; g.fillRect(7, 6, w - 14, h - 12); g.strokeStyle = '#c9b274'; g.lineWidth = 3; g.strokeRect(11, 10, w - 22, h - 20);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 36px "Century Gothic", Futura, Verdana, sans-serif'; const m = Math.min(1, (w - 34) / g.measureText('RIBAUDO').width);
    g.save(); g.translate(w / 2, h / 2 + 1); g.scale(m, 1); g.fillStyle = '#3c321c'; g.fillText('RIBAUDO', 2, 2); g.fillStyle = '#e8cf8a'; g.fillText('RIBAUDO', 0, 0); g.restore();
  });
  // under the canopy: interlaced circles and ribs in cream over brown shadow
  region(g, RIB, 'soffit', (w, h) => {
    g.fillStyle = '#8c7c60'; g.fillRect(0, 0, w, h); noiseDots(g, w, h, 500, 2, 4461, ['rgba(50,38,22,0.25)', 'rgba(230,210,170,0.2)']);
    g.strokeStyle = '#e3d2a8'; g.lineWidth = 3.5; for (let x = 0; x <= w; x += 40) for (let y = 0; y <= h; y += 40) { g.beginPath(); g.arc(x, y, 27, 0, 7); g.stroke(); }
    g.lineWidth = 2.5; for (let x = 20; x <= w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 20; y <= h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#f0e2bc'; g.lineWidth = 12; g.strokeRect(46, 40, w - 92, h - 80);
  });
  // one bay of the openwork parapet: interlaced arcs between two rails (see through)
  region(g, RIB, 'lace', (w, h) => {
    const c = '#e9d2b8'; g.strokeStyle = g.fillStyle = c; g.fillRect(0, 0, w, 13); g.fillRect(0, h - 16, w, 16);
    g.lineWidth = 8; for (const x of [0, w / 2, w]) { g.beginPath(); g.arc(x, h - 14, 46, PI, 2 * PI); g.stroke(); g.beginPath(); g.arc(x, 12, 46, 0, PI); g.stroke(); }
    g.lineWidth = 7; for (const x of [w / 4, 3 * w / 4]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, h - 10); g.stroke(); g.beginPath(); g.arc(x, h / 2, 9, 0, 7); g.fill(); }
  });
}

function setup() {
  initShared();
  defMat('pzMar', 256, 256, [3, 3], (g, w, h) => paintMarble(g, w, h, 4411, '#e2ded2', 'rgba(110,122,140,0.16)'));
  // fluted shaft: the canvas is one turn of the column (cyl maps u round the circumference) and 1.8 m of height; twelve flutes
  defMat('pzCol', 192, 256, [0.94, 1.9], (g, w, h) => {
    paintMarble(g, w, h, 4412, '#e6e2d6', 'rgba(104,118,142,0.22)');
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = i * w / n; g.fillStyle = 'rgba(70,70,70,0.20)'; g.fillRect(x, 0, 3, h);
      const gr = g.createLinearGradient(x + 3, 0, x + w / n, 0); gr.addColorStop(0, 'rgba(60,60,60,0.16)'); gr.addColorStop(0.5, 'rgba(255,255,250,0.0)'); gr.addColorStop(1, 'rgba(255,255,250,0.10)'); g.fillStyle = gr; g.fillRect(x + 3, 0, w / n - 3, h);
    }
  });
  // pietra di Billiemi, the grey limestone of the podium: ashlar courses 0.55 m, long blocks, soot and damp at the foot
  defMat('pzLime', 256, 256, [2.8, 2.8], (g, w, h) => {
    const r = RNG(4413); g.fillStyle = '#7d7a70'; g.fillRect(0, 0, w, h);
    const rows = 5, bh = h / rows;
    for (let j = 0; j < rows; j++) { let x = -r() * 60; while (x < w) { const bw = 80 + r() * 70, k = 0.93 + r() * 0.12; g.fillStyle = `rgb(${Math.round(186 * k)},${Math.round(182 * k)},${Math.round(168 * k)})`; g.fillRect(x + 1, j * bh + 1, bw - 2, bh - 2); x += bw; } }
    noiseDots(g, w, h, 2200, 2, 4414, ['rgba(70,64,52,0.14)', 'rgba(235,228,205,0.18)', 'rgba(60,70,50,0.08)']);
    streaks(g, w, h, 22, 4415, 0.16, 110, '50,44,34');
  });
  // the ceiling of the Tempietto: coffers, cream with terracotta and ochre borders and a gilt rosette in each
  defMat('pzCeil', 256, 256, [2.4, 2.4], (g, w, h) => {
    g.fillStyle = '#efe4c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64, y = j * 64; g.fillStyle = '#c9a070'; g.fillRect(x + 4, y + 4, 56, 56); g.fillStyle = '#f2e8cb'; g.fillRect(x + 9, y + 9, 46, 46);
      g.fillStyle = '#c0735a'; g.fillRect(x + 13, y + 13, 38, 38); g.fillStyle = '#eddcab'; g.fillRect(x + 17, y + 17, 30, 30);
      g.fillStyle = '#c79a3a'; g.beginPath(); g.arc(x + 32, y + 32, 8, 0, 7); g.fill(); g.fillStyle = '#7e5a2a'; g.beginPath(); g.arc(x + 32, y + 32, 3, 0, 7); g.fill();
    }
    noiseDots(g, w, h, 900, 2, 4416, ['rgba(90,70,40,0.16)', 'rgba(255,245,215,0.14)']);
    streaks(g, w, h, 8, 4417, 0.14, 60, '70,60,40');
  });
  // bronze: a pale, near neutral skin with dark drips and runs; the hue comes from the tint of each face (mint verdigris on what faces the sky, dark metal below: see patina())
  defMat('pzBron', 128, 128, [1.1, 1.1], (g, w, h) => {
    const r = RNG(4418); g.fillStyle = '#dce6e1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = r() < 0.5 ? 'rgba(70,84,80,0.16)' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 18, 5 + r() * 13, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 46; i++) { const x = r() * w, y = r() * h, l = 16 + r() * 52, c = r() < 0.65 ? '34,48,46' : '244,255,250'; for (const dy of [0, -h]) { const gr = g.createLinearGradient(0, y + dy, 0, y + dy + l); gr.addColorStop(0, `rgba(${c},0.5)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x, y + dy, 1 + r() * 2.2, l); } }
    noiseDots(g, w, h, 420, 1.6, 4419, ['rgba(20,28,26,0.22)', 'rgba(255,255,255,0.22)']);
  });
  // one sheet for the details of the monuments: the two iron railings, a solid iron patch, the shield of the Tempietto balustrade, the two inscriptions and the two carved friezes
  defMat('pzDet', DW * SH, DH * SH, [1, 1], (g) => { g.save(); g.scale(SH, SH); paintDetails(g); g.restore(); }, { alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
  // the Liberty kiosk, one sheet: the door face, a canted face with its two mosaic strips, the name board, the coffered underside of the canopy, one bay of the openwork parapet
  defMat('pzRib', DW * SH, DH * SH, [1, 1], (g) => { g.save(); g.scale(SH, SH); paintRib(g); g.restore(); }, { alphaTest: 0.5, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------------------------------------------
// shared parts
// ---------------------------------------------------------------------------------------------------
const AX = [0.8883, -0.4592];   // front of the Tempietto and axis of the piazza (the Politeama is at the +z end); unit vector, bearing 63 degrees

const det = (k) => uvr(DET, DW, DH, k);
const SOLID = { noao: true, ...det('iron') };   // solid iron: the filled patch of the detail sheet
// a flat piece of the detail sheet, w x h metres, base centre at (x, y, z) of M, facing +z turned by ry
const decal = (k, M, w, h, x, y, z, ry = 0, rx = 0, c) => panel('pzDet', w, h, { M, p: [x, y, z], ry, rx, c, ...det(k) });
// a line of iron railing from (x0,z0) to (x1,z1) in frame M, h metres tall: one panel of the pattern `kind` per bay (about 1.5 m) and a post with a spear head between bays
function ironRun(M, x0, z0, x1, z1, h, y = 0, kind = 'rail') {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.5)), dx = (x1 - x0) / L, dz = (z1 - z0) / L, ry = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) decal(kind, M, L / n, h, x0 + dx * L * (i + 0.5) / n, y, z0 + dz * L * (i + 0.5) / n, ry);
  for (let i = 0; i <= n; i++) {
    const px = x0 + dx * L * i / n, pz = z0 + dz * L * i / n;
    box('pzDet', 0.07, h + 0.12, 0.07, { M, p: [px, y, pz], ...SOLID });
    cone('pzDet', 0.06, 0.22, 4, { M, p: [px, y + h + 0.1, pz], ...SOLID });
  }
}
// a square (or oblong) block that tapers from half sizes a0 x b0 at y0 to a1 x b1 at y1: the mouldings of the pedestals
function frustum(key, M, y0, y1, a0, b0, a1, b1, c) {
  const g = new THREE.CylinderGeometry(Math.SQRT2, Math.SQRT2, 1, 4, 1); g.rotateY(PI / 4);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? a1 : a0), top ? y1 : y0, p.getZ(i) * (top ? b1 : b0)); }
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); part(key, ng, { M, c, noao: true });
}
// a square block, half size a, from y0 to y1
const sqb = (M, a, y0, y1, c) => bx('pzMar', M, -a, a, y0, y1, -a, a, { c, noao: true });

// ---------------------------------------------------------------------------------------------------
// solids for the figures: tapered limbs, faceted balls and lofted bodies. `pal` is one colour, or [faces towards the sky, upright faces, faces towards the ground]
// ---------------------------------------------------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function solid(key, M, g, pal) {
  const n = g.index ? g.toNonIndexed() : g;
  if (!Array.isArray(pal)) { part(key, n, { M, c: pal, noao: true }); return; }
  const P = n.attributes.position, N = n.attributes.normal, out = [[[], []], [[], []], [[], []]];
  for (let i = 0; i < P.count; i += 3) {
    const ax = P.getX(i + 1) - P.getX(i), ay = P.getY(i + 1) - P.getY(i), az = P.getZ(i + 1) - P.getZ(i), bx_ = P.getX(i + 2) - P.getX(i), by = P.getY(i + 2) - P.getY(i), bz = P.getZ(i + 2) - P.getZ(i);
    const nx = ay * bz - az * by, ny = az * bx_ - ax * bz, nz = ax * by - ay * bx_, l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue;
    const k = ny / l > 0.35 ? 0 : ny / l < -0.3 ? 2 : 1;
    for (let j = i; j < i + 3; j++) { out[k][0].push(P.getX(j), P.getY(j), P.getZ(j)); out[k][1].push(N.getX(j), N.getY(j), N.getZ(j)); }
  }
  out.forEach(([p, q], k) => { if (!p.length) return; const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); h.setAttribute('normal', new THREE.Float32BufferAttribute(q, 3)); h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2), 2)); part(key, h, { M, c: pal[k], noao: true }); });
}
// the tools of one figure: frame M, material key
function sculptor(M, key) {
  return {
    // a round limb from a to b, radius ra at a and rb at b
    limb(a, b, ra, rb, pal, seg = 6) {
      _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _v.length(); if (len < 1e-4) return;
      const g = new THREE.CylinderGeometry(rb, ra, len, seg, 1, false); g.translate(0, len / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(UP, _v.multiplyScalar(1 / len))); g.translate(a[0], a[1], a[2]);
      solid(key, M, g, pal);
    },
    // a chain of limbs through the points, with radii at each: an arm or a leg (the joints are rounded off)
    chain(pts, radii, pal, seg = 6) {
      for (let i = 0; i < pts.length - 1; i++) this.limb(pts[i], pts[i + 1], radii[i], radii[i + 1], pal, seg);
      for (let i = 1; i < pts.length - 1; i++) this.ball(pts[i], radii[i], pal);
    },
    // an ellipsoid of few faces (det 0: 20 triangles, det 1: 80)
    ball(p, r, pal, det = 0, rx = 0, rz = 0) {
      const rr = typeof r === 'number' ? [r, r, r] : r, g = new THREE.IcosahedronGeometry(1, det); g.scale(rr[0], rr[1], rr[2]); g.rotateZ(rz); g.rotateX(rx); g.translate(p[0], p[1], p[2]);
      if (det) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { _v.set((P.getX(i) - p[0]) / (rr[0] * rr[0]), (P.getY(i) - p[1]) / (rr[1] * rr[1]), (P.getZ(i) - p[2]) / (rr[2] * rr[2])).normalize(); N.setXYZ(i, _v.x, _v.y, _v.z); } }   // smooth
      else g.computeVertexNormals();
      solid(key, M, g, pal);
    },
    // a body through elliptical rings [x, y, z, rx, rz] from the bottom up, capped; fold ripples the outline (drapery)
    loft(rings, pal, seg = 8, fold = 0) {
      const P = rings.map(([x, y, z, rx, rz], i) => Array.from({ length: seg }, (_, j) => { const a = j * 2 * PI / seg, f = 1 + fold * ((j % 2 ? 1 : -1) + 0.5 * Math.sin(a * 3 + i * 1.7)); return [x + Math.sin(a) * rx * f, y, z + Math.cos(a) * rz * f]; }));
      const pos = [], tri = (a, b, c) => pos.push(...a, ...b, ...c);
      for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < seg; j++) { const k = (j + 1) % seg; tri(P[i][j], P[i][k], P[i + 1][k]); tri(P[i][j], P[i + 1][k], P[i + 1][j]); }
      for (const [i, up] of [[0, false], [P.length - 1, true]]) for (let j = 1; j < seg - 1; j++) { if (up) tri(P[i][0], P[i][j], P[i][j + 1]); else tri(P[i][0], P[i][j + 1], P[i][j]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.computeVertexNormals();
      solid(key, M, g, pal);
    },
  };
}

function corinthian(M, x, y, z) {   // base, fluted shaft, Corinthian capital: 2.3 m in all
  const c = '#ebe7db';   // the shafts are slender, about a dozen diameters tall, under a tall leafy capital (front photo)
  cyl('pzMar', 0.175, 0.185, 0.08, 10, { M, p: [x, y, z], c });
  cyl('pzMar', 0.14, 0.16, 0.08, 10, { M, p: [x, y + 0.08, z], c });
  cyl('pzCol', 0.1, 0.118, 1.88, 12, { M, p: [x, y + 0.16, z], noao: false });
  cyl('pzMar', 0.125, 0.125, 0.035, 8, { M, p: [x, y + 2.04, z], c });
  lathe('pzMar', [[0, 0], [0.105, 0], [0.15, 0.07], [0.115, 0.11], [0.16, 0.2], [0.14, 0.22], [0.2, 0.32], [0, 0.32]], 8, { M, p: [x, y + 2.07, z], c: '#d9d3c2' });   // the acanthus bell, two tiers of leaves
  box('pzMar', 0.4, 0.05, 0.4, { M, p: [x, y + 2.39, z], c });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sphere('pzMar', 0.045, { M, p: [x + sx * 0.16, y + 2.34, z + sz * 0.16], seg: 6, c, noao: true });   // volutes
}
function ground4(pts) { return groundRange(pts); }
// the corners of a square of half size q round the centre C, turned to the front N
const squarePts = (C, N, q) => [[-q, -q], [q, -q], [q, q], [-q, q]].map(([x, z]) => [C[0] + x * N[1] + z * N[0], C[1] - x * N[0] + z * N[1]]);
const squareWalls = (C, N, q) => squarePts(C, N, q).map((p, i, a) => [...p, ...a[(i + 1) % 4]]);   // the same as collision segments

// ---------------------------------------------------------------------------------------------------
// the Tempietto
// ---------------------------------------------------------------------------------------------------
const TEMP = [[-581.6, -942.6], [-586.5, -951.9], [-582.4, -954.0], [-578.4, -956.1], [-573.5, -946.9], [-577.5, -944.8]];   // OSM w194689842
const TC = [(TEMP[0][0] + TEMP[3][0]) / 2, (TEMP[0][1] + TEMP[3][1]) / 2];
function buildTempietto() {
  setup();
  const gr = ground4(TEMP), gy = gr.lo;   // the ground falls 0.8 m towards the front: the deck stands 1.05 m over the front pavement, the back foundation runs down into the slope
  const W = 8.9, D = 9.1, H0 = 1.05;            // podium (stairs take the remaining 0.8 m each side inside the 10.5 m of the footprint), deck height
  const M = frame(TC[0], gy, TC[1], AX[0], AX[1]);
  begin(gy);
  const z0 = -D / 2, z1 = D / 2, x1 = W / 2;
  // podium: grey limestone, a plinth course and a cornice
  bx('pzLime', M, -x1, x1, -1.2, H0, z0, z1);
  bx('pzLime', M, -x1 - 0.12, x1 + 0.12, -1.2, 0.18, z0 - 0.12, z1 + 0.12, { c: '#cfcab8' });
  bx('pzMar', M, -x1 - 0.1, x1 + 0.1, H0 - 0.12, H0, z0 - 0.1, z1 + 0.1, { c: '#d6d2c4' });
  bx('pzLime', M, -x1 + 0.1, x1 - 0.1, H0, H0 + 0.01, z0 + 0.1, z1 - 0.1, { c: '#cbc6b6' });
  // balustrade round the deck: pillars carrying a shield medallion, baluster panels between (the deck is open at the stair heads)
  const bh = 0.62, pill = (x, z) => { bx('pzMar', M, x - 0.15, x + 0.15, H0, H0 + bh + 0.08, z - 0.15, z + 0.15, { c: '#e0dcd0' }); bx('pzMar', M, x - 0.19, x + 0.19, H0 + bh + 0.08, H0 + bh + 0.16, z - 0.19, z + 0.19, { c: '#e6e2d6' }); };
  const zf = z1 - 0.2;
  for (const x of [-x1 + 0.2, -3.2, -2.15, -0.77, 0.77, 2.15, 3.2, x1 - 0.2]) { pill(x, zf); decal('shield', M, 0.24, 0.36, x, H0 + 0.18, zf + 0.158); }
  const run = (xa, xb, z) => { for (let a = Math.min(xa, xb); a < Math.max(xa, xb) - 0.01; ) { const b = Math.min(a + 1.4, Math.max(xa, xb)); balus(mul(M, tr((a + b) / 2, H0, z)), b - a - 0.3, bh, { c: '#d8d4c6' }); a = b; } };
  run(-x1 + 0.2, -3.2, zf); run(-3.2, -2.15, zf); run(-2.15, -0.77, zf); run(-0.77, 0.77, zf); run(0.77, 2.15, zf); run(2.15, 3.2, zf); run(3.2, x1 - 0.2, zf);
  const zb = z0 + 0.2; for (const x of [-x1 + 0.2, 0, x1 - 0.2]) pill(x, zb);
  run(-x1 + 0.2, 0, zb); run(0, x1 - 0.2, zb);
  for (const sg of [-1, 1]) {   // side balustrades, open for the stair head between z = 0.6 and 2.0
    const xs = sg * (x1 - 0.2), side = (za, zc) => balus(mul(M, mul(tr(xs, H0, (za + zc) / 2), rotY(PI / 2))), Math.abs(zc - za) - 0.3, bh, { c: '#d8d4c6' });
    for (const z of [z0 + 2.5, 0.6, 2.0]) pill(xs, z);
    side(zb, z0 + 2.5); side(z0 + 2.5, 0.6); side(2.0, zf);
    // the lateral flight outside the side wall: climbs towards the back from the front corner, 0.8 m wide, with an iron-and-stone parapet
    const n = 6, run0 = 3.7, zA = z1 - 0.05, rise = H0 / n;
    for (let i = 0; i < n; i++) bx('pzLime', M, sg * x1, sg * (x1 + 0.8), 0, rise * (i + 1), zA - run0 * (i + 1) / n, zA - run0 * i / n, { c: '#d4cfbf' });
    bx('pzMar', M, sg * (x1 + 0.7), sg * (x1 + 0.82), 0, 0.3, zA - run0 - 0.02, zA + 0.02, { c: '#d8d4c6' });   // (2 cm proud of the steps' side and end faces, so the two do not flicker)
    // the iron balustrade on the outer edge: bars standing on the steps under one sloping hand rail
    const xr = sg * (x1 + 0.74), topY = z => rise + 0.85 + (H0 - rise) * (zA - z) / run0;
    for (let i = 0; i <= n * 2; i++) {
      const z = zA - 0.04 - (run0 - 0.08) * i / (n * 2), y = rise * Math.min(n, Math.floor((zA - z) / (run0 / n)) + 1), t = i % 4 ? 0.03 : 0.06;
      box('pzDet', t, topY(z) - y, t, { M, p: [xr, y, z], ...SOLID });
    }
    box('pzDet', 0.07, 0.06, Math.hypot(run0, H0 - rise), { M, p: [xr, (topY(zA) + topY(zA - run0)) / 2 - 0.03, zA - run0 / 2], rx: Math.atan2(H0 - rise, run0), ...SOLID });
  }
  // the colonnade (corner columns, a coupled pair each side of a wide central bay), set on the front edge of the deck
  const cxs = [-2.15, -1.37, -0.77, 0.77, 1.37, 2.15], zfc = 4.0 - 0.1, zbc = zfc - 6.8;
  const zs = [zfc, zfc - 0.8, zfc - 1.4, zbc + 1.4, zbc + 0.8, zbc];
  const cols = [];
  for (const x of cxs) cols.push([x, zfc], [x, zbc]);
  for (const z of zs) if (z !== zfc && z !== zbc) cols.push([-2.15, z], [2.15, z]);
  cols.push([-2.15, zfc], [2.15, zfc], [-2.15, zbc], [2.15, zbc]);
  const seen = new Set();
  for (const [x, z] of cols) { const k = x.toFixed(2) + ',' + z.toFixed(2); if (seen.has(k)) continue; seen.add(k); corinthian(mul(M, tr(0, H0, 0)), x, 0, z); }
  // entablature: architrave, a frieze with its panel, a dentilled cornice; then the flat roof with a dark cresting, and a pediment at each end
  const EY = H0 + 2.48, xe = 2.15 + 0.38, ze0 = zbc - 0.38, ze1 = zfc + 0.38;
  bx('pzMar', M, -xe, xe, EY, EY + 0.22, ze0, ze1, { c: '#e0dcd0' });
  bx('pzMar', M, -xe - 0.04, xe + 0.04, EY + 0.22, EY + 0.46, ze0 - 0.04, ze1 + 0.04, { c: '#d6d2c4' });
  bx('pzMar', M, -xe - 0.2, xe + 0.2, EY + 0.46, EY + 0.62, ze0 - 0.2, ze1 + 0.2, { c: '#e2ded2' });
  bx('pzMar', M, -xe - 0.2, xe + 0.2, EY + 0.62, EY + 0.70, ze0 - 0.2, ze1 + 0.2, { c: '#d4d0c2' });
  for (let i = -5; i <= 5; i++) {   // dentils under the cornice on the front and the back
    for (const z of [ze1 + 0.1, ze0 - 0.1]) box('pzMar', 0.1, 0.1, 0.1, { M, p: [i * 0.45, EY + 0.37, z], c: '#d8d4c6' });
  }
  box('pzCeil', xe * 2 - 0.1, 0.05, ze1 - ze0 - 0.1, { M, p: [0, H0 + 2.46, (ze0 + ze1) / 2], noao: true, uv: 'world' });   // the coffered ceiling under the beams
  for (const x of [-0.77 - 0.3, 0, 0.77 + 0.3]) bx('pzMar', M, x - 0.07, x + 0.07, H0 + 2.38, H0 + 2.48, ze0 + 0.3, ze1 - 0.3, { c: '#d6d2c4' });
  bx('flat', M, -xe - 0.12, xe + 0.12, EY + 0.70, EY + 0.76, ze0 - 0.12, ze1 + 0.12, { c: '#b9b6ac' });   // (pale from the air: orthophoto)
  for (const sg of [-1, 1]) for (let i = 0; i < 12; i++) {   // dark cresting of palmettes along the roof edge
    const x = sg * (xe + 0.05), z = ze0 + (ze1 - ze0) * (i + 0.5) / 12;
    cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, z], c: '#4a4a46', noao: true });
  }
  for (let i = 0; i < 9; i++) { const x = -xe + (2 * xe) * (i + 0.5) / 9; cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, ze1 + 0.08], c: '#4a4a46', noao: true }); cone('dark', 0.07, 0.26, 4, { M, p: [x, EY + 0.76, ze0 - 0.08], c: '#4a4a46', noao: true }); }
  // central gable over the four coupled columns: roof running front to back, a tympanum at each end
  const GW = 3.85, GR = 0.62;
  gable('lead', 'pzMar', mul(M, tr(0, 0, (ze0 + ze1) / 2)), GW, ze1 - ze0 + 0.1, EY + 0.76, GR, { ov: 0.1, th: 0.1, c: '#c4c8c2', wc: '#e0dcd0' });
  for (const z of [ze1 + 0.1, ze0 - 0.1]) bx('pzMar', M, -GW / 2 - 0.1, GW / 2 + 0.1, EY + 0.76, EY + 0.86, z - 0.14, z + 0.14, { c: '#d8d4c6' });
  sphere('pzMar', 0.13, { M, p: [0, EY + 0.76 + GR + 0.15, ze1 + 0.05], seg: 6, c: '#d6d2c4', noao: true }); cone('dark', 0.12, 0.3, 4, { M, p: [0, EY + 0.76 + GR + 0.15, ze1 + 0.05], c: '#4a4a46', noao: true });
  const o = end('Tempietto (Palchetto della Musica)');
  return o;
}
export const TEMPIETTO = { name: 'Tempietto (Palchetto della Musica)', x: TC[0], z: TC[1], radius: 16, skipIds: ['w194689842'], build: buildTempietto };

// ---------------------------------------------------------------------------------------------------
// Monumento a Ruggero Settimo: three steps, a plinth in two courses, the inscribed shaft, a frieze of wreaths under a flaring cornice, the marble statue; round it a stone kerb with the 5.8 m
// square of grey iron railing
// ---------------------------------------------------------------------------------------------------
const MW = '#e8e4d8', MS = '#cdc8b9';
const STATUE = [MW, MW, MS];   // statue marble: the undersides a shade darker
const scaled = (M, x, y, z, k, wide = 1) => mul(M, mul(tr(x, y, z), new THREE.Matrix4().makeScale(k * wide, k, k * wide)));
// the head and neck of the two marble gentlemen (units of the figure's height, facing +z)
function gentlemanHead(S) {
  S.limb([0, 0.78, 0.005], [0, 0.842, 0.012], 0.032, 0.028, STATUE);
  S.ball([0, 0.878, 0.016], [0.05, 0.066, 0.056], STATUE, 1);
  S.ball([0, 0.838, 0.045], [0.026, 0.017, 0.022], STATUE);   // chin
  S.limb([0, 0.892, 0.068], [0, 0.866, 0.082], 0.006, 0.011, STATUE, 4);   // nose
  for (const x of [-0.019, 0.019]) S.ball([x, 0.887, 0.067], [0.011, 0.0045, 0.004], '#c3beaf');   // the eyes in shadow
  for (const x of [-0.048, 0.048]) S.ball([x, 0.872, 0.008], [0.011, 0.02, 0.014], STATUE);   // ears and side hair
}
// Ruggero Settimo: a bald old man in a long double breasted frock coat, the right hand slipped into it at the breast, the left arm behind the back, one foot forward; a draped stump behind the legs
function settimoStatue(M) {
  const S = sculptor(M, 'pzMar'), C = STATUE;
  S.chain([[-0.085, 0.03, 0.09], [-0.075, 0.25, 0.04], [-0.05, 0.47, 0]], [0.028, 0.044, 0.062], C);   // the forward leg
  S.chain([[0.07, 0.03, 0.0], [0.068, 0.25, 0.0], [0.05, 0.47, 0]], [0.03, 0.045, 0.062], C);
  for (const [x, z] of [[-0.092, 0.105], [0.074, 0.025]]) S.ball([x, 0.022, z], [0.036, 0.024, 0.07], C);   // shoes
  S.loft([[0.025, 0.235, -0.03, 0.125, 0.07], [0.015, 0.34, -0.012, 0.12, 0.088], [0.005, 0.47, 0, 0.108, 0.084], [0, 0.55, 0, 0.096, 0.074], [0, 0.64, 0.008, 0.118, 0.087], [0, 0.715, 0.004, 0.14, 0.078], [0, 0.755, 0, 0.125, 0.064], [0, 0.79, 0, 0.05, 0.045]], C, 10, 0.025);
  S.limb([0.03, 0.56, 0.088], [0.075, 0.25, 0.058], 0.006, 0.012, MS, 4);   // the fall of the front of the coat
  for (const s of [-1, 1]) S.limb([s * 0.012, 0.645, 0.1], [s * 0.056, 0.758, 0.066], 0.006, 0.017, MS, 4);   // lapels
  for (const y of [0.54, 0.585, 0.63]) for (const x of [-0.025, 0.035]) S.ball([x, y, 0.086 + (y - 0.54) * 0.09], 0.007, '#bdb8a8');   // buttons
  S.chain([[-0.13, 0.735, -0.005], [-0.185, 0.6, 0.04], [-0.035, 0.66, 0.105]], [0.045, 0.034, 0.025], C);
  S.ball([-0.012, 0.667, 0.104], [0.022, 0.02, 0.014], C);   // the hand in the coat
  S.chain([[0.13, 0.735, -0.005], [0.175, 0.585, -0.04], [0.06, 0.52, -0.09]], [0.045, 0.034, 0.022], C);
  gentlemanHead(S);
  S.limb([-0.1, 0, -0.085], [-0.1, 0.27, -0.085], 0.055, 0.047, MS, 8);   // the support, its drapery thrown over the top
  S.loft([[-0.115, 0.17, -0.09, 0.035, 0.035], [-0.1, 0.27, -0.085, 0.082, 0.07], [-0.09, 0.32, -0.08, 0.05, 0.045]], C, 8, 0.1);
}
// Carlo Cottone: coat open and falling behind him to the heels, waistcoat and breeches, the left arm folded across the breast to the lapel, the right hand low with a scroll; curly hair
function cottoneStatue(M) {
  const S = sculptor(M, 'pzMar'), C = STATUE;
  S.chain([[-0.105, 0.03, 0.095], [-0.085, 0.25, 0.045], [-0.05, 0.49, 0]], [0.028, 0.045, 0.064], C);
  S.chain([[0.07, 0.03, 0.015], [0.072, 0.25, 0.012], [0.05, 0.49, 0]], [0.03, 0.045, 0.064], C);
  for (const [x, z] of [[-0.112, 0.115], [0.078, 0.042]]) S.ball([x, 0.022, z], [0.034, 0.024, 0.068], C);
  S.loft([[0, 0.025, -0.07, 0.13, 0.028], [0, 0.2, -0.065, 0.14, 0.035], [0, 0.4, -0.055, 0.128, 0.045], [0, 0.55, -0.035, 0.12, 0.055]], [MW, MS, MS], 12, 0.12);   // the coat behind
  S.loft([[0, 0.46, 0, 0.092, 0.07], [0, 0.55, 0, 0.087, 0.068], [0, 0.56, 0, 0.096, 0.076], [0, 0.585, 0, 0.09, 0.07], [0, 0.66, 0.006, 0.112, 0.084], [0, 0.72, 0.004, 0.14, 0.078], [0, 0.755, 0, 0.128, 0.064], [0, 0.79, 0, 0.052, 0.045]], C, 10, 0.012);
  for (const s of [-1, 1]) { S.limb([s * 0.108, 0.72, 0.045], [s * 0.093, 0.4, 0.02], 0.026, 0.018, C, 5); S.limb([s * 0.024, 0.66, 0.092], [s * 0.062, 0.765, 0.06], 0.007, 0.019, MS, 4); }   // the open fronts and the collar
  S.chain([[0.132, 0.735, -0.005], [0.2, 0.635, 0.065], [-0.008, 0.722, 0.1]], [0.046, 0.034, 0.023], C);
  S.ball([-0.018, 0.73, 0.1], [0.022, 0.022, 0.016], C);
  S.chain([[-0.132, 0.735, -0.005], [-0.168, 0.585, 0.012], [-0.15, 0.455, 0.07]], [0.044, 0.033, 0.022], C);
  S.limb([-0.2, 0.448, 0.072], [-0.09, 0.468, 0.1], 0.019, 0.019, C, 8);   // the scroll
  gentlemanHead(S);
  for (const [x, y, z, r] of [[-0.035, 0.935, 0.025, 0.028], [0.005, 0.948, 0.03, 0.028], [0.038, 0.933, 0.012, 0.027], [-0.04, 0.915, -0.025, 0.032], [0.035, 0.915, -0.028, 0.032], [0, 0.93, -0.025, 0.036]]) S.ball([x, y, z], r, STATUE);
  S.limb([0, 0, -0.05], [0, 0.18, -0.05], 0.045, 0.04, MS, 8);   // the post behind the legs
}

const SET = [-461.8, -1010.3], SETN = [-AX[0], -AX[1]];   // the inscription (and the statue) face away from the theatre
const SETQ = 2.9;
function buildSettimo() {
  setup();
  const gr = ground4(squarePts(SET, SETN, SETQ)), gy = gr.hi;
  const M = frame(SET[0], gy, SET[1], SETN[0], SETN[1]);
  begin(gy);
  const q = SETQ;
  sqb(M, q - 0.15, -0.8, 0.03, '#cfcbbf');   // the paving inside the railing
  for (let k = 0; k < 4; k++) bx('pzLime', mul(M, rotY(k * PI / 2)), -q - 0.05, q - 0.22, -0.8, 0.2, q - 0.22, q + 0.05, { c: '#c4c0b2', noao: true });   // the kerb
  for (let i = 0; i < 3; i++) sqb(M, 1.75 - i * 0.15, i ? i * 0.3 : -0.2, (i + 1) * 0.3, i % 2 ? '#c9c5b9' : '#d6d2c6');
  sqb(M, 1.5, 0.9, 1.64, '#dcd8cc'); sqb(M, 1.47, 1.64, 1.68, '#a8a498'); sqb(M, 1.5, 1.68, 2.4, '#dedacf');
  sqb(M, 1.55, 2.4, 2.47, '#e6e2d6'); frustum('pzMar', M, 2.47, 2.68, 1.42, 1.42, 1.09, 1.09, '#d8d4c8');
  sqb(M, 1.05, 2.68, 4.9, MW);
  decal('setText', M, 1.92, 1.08, 0, 3.4, 1.054, 0, 0, MW);
  sqb(M, 1.12, 4.9, 5.01, '#e6e2d6'); sqb(M, 1.05, 5.01, 5.42, '#dcd8cc');
  for (let k = 0; k < 4; k++) decal('wreaths', mul(M, rotY(k * PI / 2)), 2.06, 0.36, 0, 5.035, 1.056, 0, 0, MW);
  frustum('pzMar', M, 5.42, 5.72, 1.08, 1.08, 1.46, 1.46, '#d2cec1'); sqb(M, 1.53, 5.72, 5.9, MW); sqb(M, 1.42, 5.9, 5.98, '#cfcbbd');
  sqb(M, 0.9, 5.98, 6.13, '#e2ded2'); sqb(M, 0.74, 6.13, 6.32, '#dcd8cc');
  settimoStatue(scaled(M, 0, 6.32, 0, 3.35, 1.1));
  ironRun(M, -q, q, q, q, 1.15, 0.2); ironRun(M, q, q, q, -q, 1.15, 0.2); ironRun(M, q, -q, -q, -q, 1.15, 0.2); ironRun(M, -q, -q, -q, q, 1.15, 0.2);
  const lamps = [];
  for (const [x, z] of SETLAMPS) {
    const y = groundY(x, z), L = mul(tr(x, y, z), rotY(Math.atan2(SETN[0], SETN[1]))), IRON = '#262c2a';
    cone('pzDet', 0.3, 0.85, 6, { M: L, ...SOLID, c: IRON }); box('pzDet', 0.24, 0.2, 0.24, { M: L, p: [0, 0.55, 0], ry: PI / 4, ...SOLID, c: IRON });
    box('pzDet', 0.1, 2.75, 0.1, { M: L, p: [0, 0.7, 0], ...SOLID, c: IRON }); box('pzDet', 0.55, 0.06, 0.06, { M: L, p: [0, 3.05, 0], ...SOLID, c: IRON });
    frustum('pzMar', L, 3.42, 4.08, 0.15, 0.15, 0.28, 0.28, '#e6e4d4');
    box('pzDet', 0.62, 0.07, 0.62, { M: L, p: [0, 4.06, 0], ...SOLID, c: IRON }); cone('pzDet', 0.42, 0.28, 4, { M: L, p: [0, 4.12, 0], ry: PI / 4, ...SOLID, c: IRON }); cone('pzDet', 0.06, 0.24, 4, { M: L, p: [0, 4.36, 0], ...SOLID, c: IRON });
    lamps.push(x, y, z, 3.75);
  }
  const o = end('Monumento a Ruggero Settimo');
  o.userData.lampPts = new Float32Array(lamps);   // lit at night like the street lamps they are (src/daynight.js)
  setTimeout(() => dispatchEvent(new Event('pd-lamps-changed')), 0);
  return o;
}
const SETLAMPS = [[-467.3, -1014.2], [-461.8, -1017.0], [-461.8, -1003.4], [-456.3, -1006.1]];
export const SETTIMO = {
  name: 'Monumento a Ruggero Settimo', x: SET[0], z: SET[1], radius: 10, skipIds: [], build: buildSettimo,
  walls: [...squareWalls(SET, SETN, SETQ + 0.05), ...SETLAMPS.flatMap(([x, z]) => squareWalls([x, z], SETN, 0.22))],   // (a fence left out takes its collision with it; and the lantern posts)
  clearFences: (f) => f.filter(o => !(o.p && o.s === 1 && Math.hypot(o.p[0] - SET[0], o.p[1] - SET[1]) < 6)),   // the OSM square fence round it, which the railing of the model replaces
};

// ---------------------------------------------------------------------------------------------------
// Monumento a Carlo Cottone: statue of the Prince of Castelnuovo on a pedestal (a dark grey foot, the inscribed shaft, a frieze with a head and ribbons, dentils, a flaring cornice), on a low
// stone platform with steps front and back, stone posts with lanterns at the corners and lattice iron panels between them
// ---------------------------------------------------------------------------------------------------
const COT = [-526.95, -976.95];   // the centre of the 6.8 m square OSM fence round it, on the axis 59.8 m from the Tempietto
const COTQ = 3.42;
function buildCottone() {
  setup();
  const gr = ground4(squarePts(COT, AX, COTQ)), gy = gr.hi;
  const M = frame(COT[0], gy, COT[1], AX[0], AX[1]);
  begin(gy);
  const q = COTQ, P = 0.34;
  // the platform, with two steps let into the middle of the front and the back
  bx('pzMar', M, -q - 0.2, q + 0.2, -0.8, P, -q + 0.55, q - 0.55, { c: '#c6c2b6', noao: true });
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) bx('pzMar', M, sx * 0.9, sx * (q + 0.2), -0.8, P, sz * (q - 0.55), sz * (q + 0.2), { c: '#c6c2b6', noao: true });
    bx('pzMar', M, -0.9, 0.9, -0.8, P * 2 / 3, sz * (q - 0.55), sz * (q - 0.17), { c: '#d6d2c6', noao: true }); bx('pzMar', M, -0.9, 0.9, -0.8, P / 3, sz * (q - 0.17), sz * (q + 0.2), { c: '#d6d2c6', noao: true });
  }
  const B = mul(M, tr(0, P, 0));
  sqb(B, 1.48, 0, 0.9, '#8d8c87'); sqb(B, 1.34, 0.9, 1.45, '#dad6ca');
  frustum('pzMar', B, 1.45, 1.68, 1.31, 1.31, 0.99, 0.99, '#cfcbbf');
  frustum('pzMar', B, 1.68, 3.85, 0.97, 0.97, 0.9, 0.9, MW);
  decal('cotText', B, 1.7, 0.96, 0, 2.45, 0.949, 0, -0.032, MW);
  sqb(B, 0.98, 3.85, 3.96, '#e2ded2'); sqb(B, 0.92, 3.96, 4.36, '#d8d4c8');
  for (let k = 0; k < 4; k++) decal('medusa', mul(B, rotY(k * PI / 2)), 1.82, 0.4, 0, 3.96, 0.925, 0, 0, MW);
  frustum('pzMar', B, 4.36, 4.62, 0.96, 0.96, 1.34, 1.34, '#d2cec1'); sqb(B, 1.39, 4.62, 4.84, MW);
  sqb(B, 0.92, 4.84, 5.0, '#dcd8cc'); sqb(B, 0.74, 5.0, 5.2, '#e2ded2');
  cottoneStatue(scaled(B, 0, 5.2, 0, 3.15, 1.1));
  // the enclosure
  const hp = 1.15;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bx('pzMar', M, sx * q - 0.25, sx * q + 0.25, P, P + hp, sz * q - 0.25, sz * q + 0.25, { c: '#d6d2c6' });
    bx('pzMar', M, sx * q - 0.31, sx * q + 0.31, P + hp, P + hp + 0.12, sz * q - 0.31, sz * q + 0.31, { c: '#e0dcd0' });
    const L = mul(M, tr(sx * q, P + hp + 0.12, sz * q));   // a cast iron lamp: a swelling foot, a slim post, a four sided glass lantern under a little roof
    cone('pzDet', 0.22, 0.5, 6, { M: L, ...SOLID, c: '#8a9098' }); box('pzDet', 0.22, 0.16, 0.22, { M: L, p: [0, 0.3, 0], ry: PI / 4, ...SOLID, c: '#8a9098' });
    box('pzDet', 0.07, 1.35, 0.07, { M: L, p: [0, 0.4, 0], ...SOLID, c: '#7a808a' });
    frustum('pzMar', L, 1.75, 2.2, 0.11, 0.11, 0.2, 0.2, '#f4f1dc');
    cone('pzDet', 0.34, 0.2, 4, { M: L, p: [0, 2.2, 0], ry: PI / 4, ...SOLID, c: '#6a707a' }); cone('pzDet', 0.05, 0.22, 4, { M: L, p: [0, 2.36, 0], ...SOLID, c: '#6a707a' });
  }
  for (const sz of [-1, 1]) { ironRun(M, -q + 0.3, sz * q, -0.95, sz * q, 1.0, P, 'lattice'); ironRun(M, 0.95, sz * q, q - 0.3, sz * q, 1.0, P, 'lattice'); }
  for (const sx of [-1, 1]) ironRun(M, sx * q, q - 0.3, sx * q, -q + 0.3, 1.0, P, 'lattice');
  return end('Monumento a Carlo Cottone');
}
const sq = (cx, cz, r) => [[cx - r, cz - r, cx + r, cz - r], [cx + r, cz - r, cx + r, cz + r], [cx + r, cz + r, cx - r, cz + r], [cx - r, cz + r, cx - r, cz - r]];
export const COTTONE = { name: 'Monumento a Carlo Cottone', x: COT[0], z: COT[1], radius: 10, skipIds: [], build: buildCottone,
  walls: squareWalls(COT, AX, COTQ + 0.3),   // round the corner posts (a fence left out takes its collision with it)
  clearFences: (f) => f.filter(o => !(o.p && o.s === 1 && Math.hypot(o.p[0] - COT[0], o.p[1] - COT[1]) < 6)) };   // the OSM fence square round it, which the model's enclosure replaces

// ---------------------------------------------------------------------------------------------------
// the three bronzes of Piazza Castelnuovo (positions are the OSM nodes): Nautica, I Senzatetto, Lavoro, each on a block of white marble. src/props.js leaves their OSM nodes alone.
// Nautica and Lavoro are green with verdigris over dark metal; the Senzatetto is a dark brown black bronze.
// ---------------------------------------------------------------------------------------------------
// the marble pedestal: a foot, the die, a cornice and a bevelled top, half sizes a (across) x b (front to back), h tall; returns the frame on its top
function pedestal(M, a, b, h) {
  const m = (da, y0, y1, c) => bx('pzMar', M, -a - da, a + da, y0, y1, -b - da, b + da, { c, noao: true });
  m(0.14, -0.5, 0.16, '#c9c5b9'); m(0, 0.16, h - 0.22, '#e2ded2'); m(0.09, h - 0.22, h - 0.1, '#e8e4d8');
  frustum('pzMar', M, h - 0.1, h, a + 0.09, b + 0.09, a - 0.03, b - 0.03, '#d8d4c8');
  return mul(M, tr(0, h, 0));
}
const bronzeSite = (P) => { setup(); const gy = groundY(P[0], P[1]); begin(gy); return frame(P[0], gy, P[1], AX[0], AX[1]); };

// Nautica (Mario Rutelli): a young woman seated on a coil of rope, leaning forward, her right hand held open over her knee, the left elbow resting by a mooring post, her cloak blown out behind
const NAUT = [-568.7, -974.6];
function buildNautica() {
  const M = bronzeSite(NAUT), B = pedestal(M, 0.62, 0.8, 0.95), S = sculptor(B, 'pzBron');
  const SKIN = ['#e4fff2', '#b4e6d2', '#5f8a7e'], DRESS = ['#bcecd8', '#739d8e', '#3d574f'], DARK = ['#8cbcaa', '#4c6b61', '#31453f'], ROPE = ['#c4f0dc', '#7cb09d', '#46645b'];
  bx('pzBron', B, -0.58, 0.58, 0, 0.17, -0.7, 0.62, { c: '#8cbcaa', noao: true });
  for (let i = 0; i < 5; i++) part('pzBron', new THREE.TorusGeometry(0.34 - i * 0.018, 0.062, 4, 12), { M: B, p: [-0.02, 0.23 + i * 0.112, -0.3], rx: PI / 2, c: i % 2 ? ROPE[1] : ROPE[0], noao: true });
  // the long skirt: from the hem round the feet up to the knees, then the lap
  S.loft([[-0.02, 0.17, 0.17, 0.48, 0.42], [-0.03, 0.4, 0.16, 0.38, 0.33], [-0.02, 0.66, 0.15, 0.32, 0.29], [0, 0.86, 0.19, 0.31, 0.26], [0, 0.99, 0.22, 0.21, 0.15]], DRESS, 12, 0.1);
  S.loft([[0, 0.7, -0.18, 0.3, 0.27], [0, 0.88, -0.1, 0.31, 0.34], [0, 1.0, -0.13, 0.22, 0.25]], DRESS, 10, 0.06);
  for (const s of [-1, 1]) { S.chain([[s * 0.14, 0.92, -0.18], [s * 0.15, 0.94, 0.31]], [0.17, 0.12], DRESS); S.ball([s * 0.15, 0.93, 0.31], 0.125, DRESS, 1); }
  for (const [x0, x1, z] of [[-0.22, -0.31, 0.53], [-0.02, -0.08, 0.57], [0.18, 0.29, 0.51]]) S.limb([x0, 0.86, 0.41], [x1, 0.2, z], 0.018, 0.055, DARK, 4);   // folds
  S.chain([[-0.17, 0.34, 0.44], [-0.19, 0.23, 0.6]], [0.085, 0.045], SKIN); S.ball([-0.2, 0.205, 0.66], [0.062, 0.04, 0.12], SKIN, 1, 0.12);   // the bare foot over the edge
  // the body, bent forward
  S.loft([[0, 0.9, -0.2, 0.2, 0.17], [0, 1.08, -0.17, 0.15, 0.125], [0, 1.25, -0.11, 0.19, 0.15], [0, 1.38, -0.07, 0.2, 0.14]], DRESS, 10, 0.06);
  S.loft([[0, 1.37, -0.07, 0.2, 0.138], [0, 1.47, -0.05, 0.245, 0.115], [0, 1.54, -0.035, 0.19, 0.1], [0, 1.59, -0.02, 0.07, 0.065]], SKIN, 10);
  S.chain([[-0.17, 1.35, 0.045], [-0.02, 1.26, 0.07], [0.15, 1.34, 0.045]], [0.012, 0.022, 0.012], DARK, 4);   // the low neckline of the dress
  S.limb([0, 1.54, -0.025], [-0.03, 1.69, 0.06], 0.065, 0.052, DARK);
  S.ball([-0.04, 1.755, 0.095], [0.105, 0.135, 0.115], ['#c8f0de', '#7aa596', '#3f5a52'], 1, 0.3);
  S.limb([-0.04, 1.77, 0.2], [-0.045, 1.72, 0.228], 0.012, 0.02, SKIN, 4);
  S.ball([-0.035, 1.84, 0.045], [0.128, 0.085, 0.13], ['#a6d8c4', '#587f72', '#34493f'], 1);   // hair gathered in a knot
  S.ball([-0.03, 1.8, -0.085], [0.09, 0.085, 0.085], ['#a6d8c4', '#587f72', '#34493f']);
  // right arm: the open hand held out over the knee
  S.chain([[-0.22, 1.46, -0.05], [-0.36, 1.15, 0.08], [-0.23, 1.17, 0.46]], [0.09, 0.064, 0.038], SKIN, 7);
  S.ball([-0.21, 1.175, 0.52], [0.05, 0.022, 0.065], SKIN);
  for (const dx of [-0.045, 0, 0.045]) S.limb([-0.21 + dx * 0.6, 1.175, 0.56], [-0.21 + dx * 1.3, 1.225, 0.62], 0.013, 0.007, DARK, 4);
  // left arm: out to the side, the elbow resting on the post, the hand hanging forward
  S.chain([[0.22, 1.46, -0.05], [0.52, 1.34, -0.04], [0.46, 1.2, 0.27]], [0.09, 0.064, 0.036], SKIN, 7);
  S.ball([0.455, 1.15, 0.31], [0.035, 0.065, 0.04], DARK);
  cyl('pzBron', 0.14, 0.17, 0.2, 8, { M: B, p: [0.58, 0.17, -0.08], c: DRESS[1], noao: true }); cyl('pzBron', 0.075, 0.095, 0.82, 8, { M: B, p: [0.58, 0.36, -0.08], c: DRESS[1], noao: true });
  bx('pzBron', B, 0.45, 0.71, 1.17, 1.28, -0.21, 0.05, { c: DRESS[1], noao: true });
  // the cloak: from the post and the left arm round the back, billowing out behind the shoulders and falling to the rope
  S.loft([[-0.02, 0.2, -0.58, 0.18, 0.07], [0.06, 0.62, -0.58, 0.25, 0.09], [0.1, 0.98, -0.66, 0.36, 0.13], [0.07, 1.24, -0.7, 0.44, 0.19], [0.1, 1.43, -0.53, 0.37, 0.13], [0.12, 1.5, -0.27, 0.22, 0.07]], ['#d2f8e8', '#8ec2ae', '#45635a'], 12, 0.13);
  S.limb([0.2, 1.47, -0.22], [0.52, 1.3, -0.2], 0.07, 0.1, DRESS, 5); S.limb([0.5, 1.3, -0.2], [0.46, 0.7, -0.4], 0.1, 0.03, DRESS, 5);
  return end('Nautica');
}

// I Senzatetto (Pasquale Civiletti): two ragged boys on a bench of rough bronze: one sits up, his chin on his clasped hands; the other has fallen asleep doubled over, head on his arm
const SENZ = [-560.7, -960.7];
function buildSenzatetto() {
  const M = bronzeSite(SENZ), B = pedestal(M, 0.82, 0.62, 0.82), S = sculptor(B, 'pzBron');
  const SK = ['#c2b8a4', '#8e8474', '#524a40'], CL = ['#a29984', '#706859', '#433e35'], RK = ['#807a6c', '#4e4940', '#34312b'];
  bx('pzBron', B, -0.72, 0.72, 0, 0.16, -0.48, 0.5, { c: RK[1], noao: true });
  bx('pzBron', B, -0.66, 0.6, 0.16, 0.56, -0.36, 0.14, { c: RK[1], noao: true }); bx('pzBron', B, 0.44, 0.68, 0.16, 0.86, -0.28, 0.2, { c: RK[1], noao: true });
  // the boy awake (to the left as seen)
  for (const [x, k] of [[-0.45, -0.52], [-0.17, -0.2]]) { S.chain([[x * 0.3 + k * 0.4, 0.66, -0.08], [k, 0.8, 0.27], [x, 0.23, 0.33]], [0.145, 0.12, 0.068], CL, 7); S.ball([x, 0.2, 0.39], [0.065, 0.045, 0.11], SK); }
  S.loft([[-0.31, 0.56, -0.1, 0.25, 0.2], [-0.31, 0.82, -0.09, 0.22, 0.17], [-0.3, 1.05, -0.04, 0.25, 0.175], [-0.29, 1.19, -0.02, 0.26, 0.15], [-0.29, 1.29, 0, 0.1, 0.09]], CL, 10, 0.05);
  for (const s of [-1, 1]) S.chain([[-0.29 + s * 0.2, 1.17, -0.01], [-0.29 + s * 0.2, 0.9, 0.2], [-0.29 + s * 0.02, 1.2, 0.2]], [0.11, 0.088, 0.055], CL, 7);
  S.ball([-0.29, 1.24, 0.2], [0.075, 0.06, 0.06], SK);   // the clasped hands under the chin
  S.limb([-0.29, 1.25, 0], [-0.28, 1.34, 0.06], 0.06, 0.055, SK);
  S.ball([-0.28, 1.42, 0.085], [0.125, 0.145, 0.125], SK, 1);
  S.ball([-0.28, 1.5, 0.05], [0.145, 0.1, 0.14], CL, 1);
  S.limb([-0.28, 1.43, 0.19], [-0.28, 1.39, 0.225], 0.012, 0.022, SK, 4);
  // the boy asleep (to the right), curled over his knees
  S.chain([[0.08, 0.68, -0.08], [0.38, 0.76, 0.3], [0.27, 0.25, 0.3]], [0.17, 0.125, 0.068], CL, 7); S.ball([0.23, 0.21, 0.36], [0.1, 0.045, 0.07], SK, 0, 0);
  S.chain([[0.06, 0.64, -0.04], [0.14, 0.52, 0.31], [0.5, 0.26, 0.31]], [0.15, 0.12, 0.065], CL, 7); S.ball([0.57, 0.21, 0.35], [0.1, 0.045, 0.07], SK);
  S.chain([[0.04, 0.68, -0.11], [0.18, 0.89, -0.09], [0.4, 0.98, -0.02]], [0.19, 0.23, 0.17], CL, 8);   // the rounded back
  S.ball([0.18, 0.9, -0.09], [0.25, 0.22, 0.2], CL, 1);
  S.chain([[0.4, 1.0, 0.1], [0.62, 0.9, 0.17], [0.42, 0.9, 0.21]], [0.115, 0.085, 0.055], CL, 7);
  S.ball([0.51, 1.04, 0.13], [0.145, 0.125, 0.13], SK, 1, 0, -0.5);
  S.ball([0.54, 1.1, 0.09], [0.15, 0.085, 0.135], CL, 1, 0, -0.5);
  S.ball([0.45, 0.91, 0.22], [0.07, 0.04, 0.05], SK);
  return end('I Senzatetto');
}

// Lavoro (Benedetto Civiletti): a bare chested smith, the right knee up and the left on the ground, the hammer raised in his right hand, the left holding the work (a toothed wheel) on the anvil
const LAV = [-552.2, -943.8];
function buildLavoro() {
  const M = bronzeSite(LAV), B = pedestal(M, 0.72, 0.64, 0.85), S = sculptor(B, 'pzBron');
  const SK = ['#d6fae8', '#8cc6b0', '#46685e'], CL = ['#a8dac4', '#628c7e', '#364e46'], IR = ['#8ab4a4', '#466058', '#2c3d37'], ROCK = '#86b8a4';
  bx('pzBron', B, -0.7, 0.66, 0, 0.18, -0.6, 0.64, { c: ROCK, noao: true }); bx('pzBron', B, -0.66, -0.04, 0.18, 0.34, -0.5, 0.56, { c: ROCK, noao: true }); bx('pzBron', B, -0.04, 0.5, 0.18, 0.28, -0.55, 0.16, { c: ROCK, noao: true });
  // legs: right foot planted in front, left knee down
  S.chain([[-0.15, 0.82, -0.14], [-0.31, 0.97, 0.34], [-0.34, 0.4, 0.38]], [0.19, 0.14, 0.075], CL, 8);
  S.ball([-0.31, 0.98, 0.34], 0.145, CL, 1); S.ball([-0.33, 0.72, 0.34], [0.12, 0.17, 0.12], CL, 1); S.ball([-0.35, 0.385, 0.46], [0.08, 0.05, 0.14], SK);
  S.chain([[0.13, 0.78, -0.16], [0.4, 0.42, 0.02], [0.32, 0.37, -0.5]], [0.19, 0.145, 0.07], CL, 8);
  S.loft([[0.02, 0.5, -0.12, 0.25, 0.22], [0, 0.82, -0.13, 0.29, 0.23], [0, 1.0, -0.11, 0.21, 0.16]], CL, 10, 0.08);
  S.loft([[0.28, 0.28, -0.24, 0.2, 0.16], [0.2, 0.55, -0.24, 0.17, 0.14], [0.08, 0.85, -0.18, 0.14, 0.11]], CL, 9, 0.14);   // the apron's end falling behind
  // the bare torso, turned and bent to the work
  S.loft([[0, 0.93, -0.11, 0.2, 0.15], [0, 1.08, -0.09, 0.19, 0.14], [-0.01, 1.27, -0.05, 0.27, 0.18], [-0.02, 1.42, -0.035, 0.32, 0.17], [-0.02, 1.53, -0.03, 0.23, 0.13], [0, 1.6, -0.01, 0.085, 0.08]], SK, 12);
  S.limb([-0.015, 1.41, 0.14], [0.005, 1.08, 0.055], 0.011, 0.009, CL, 4); S.limb([-0.22, 1.33, 0.095], [0.17, 1.3, 0.105], 0.012, 0.012, CL, 4);   // the hollow of the breastbone and under the chest
  S.limb([0, 1.55, -0.01], [0.05, 1.68, 0.07], 0.095, 0.075, SK, 8);
  S.ball([0.07, 1.73, 0.1], [0.118, 0.14, 0.128], SK, 1, 0.35);
  S.limb([0.085, 1.74, 0.21], [0.095, 1.69, 0.245], 0.012, 0.022, SK, 4);
  S.ball([0.09, 1.655, 0.19], [0.075, 0.04, 0.045], CL);   // beard
  S.ball([0.06, 1.83, 0.055], [0.14, 0.095, 0.14], CL, 1);   // curly hair
  for (const [x, y, z] of [[-0.05, 1.84, 0.1], [0.07, 1.885, 0.11], [0.17, 1.82, 0.08], [0.02, 1.88, 0], [0.13, 1.87, 0.02]]) S.ball([x, y, z], 0.055, CL);
  // the raised right arm and the hammer
  S.chain([[-0.27, 1.45, -0.02], [-0.59, 1.76, 0.03], [-0.36, 2.13, 0.13]], [0.13, 0.095, 0.05], SK, 8); S.ball([-0.28, 1.46, -0.02], 0.14, SK, 1); S.ball([-0.43, 1.61, 0.005], [0.12, 0.12, 0.11], SK, 1);
  S.ball([-0.355, 2.15, 0.135], 0.055, SK);
  S.limb([-0.42, 2.34, 0.1], [-0.22, 1.88, 0.18], 0.027, 0.027, IR);
  box('pzBron', 0.27, 0.11, 0.11, { M: B, p: [-0.2, 1.8, 0.185], rz: 0.4, c: IR[1], noao: true });
  // the left arm down to the anvil
  S.chain([[0.27, 1.44, -0.02], [0.44, 1.13, 0.1], [0.25, 0.97, 0.41]], [0.125, 0.085, 0.048], SK, 8); S.ball([0.27, 1.45, -0.02], 0.135, SK, 1);
  S.ball([0.235, 0.955, 0.43], [0.055, 0.045, 0.06], SK);
  // the stump, the anvil with its horn, the toothed wheel on it
  bx('pzBron', B, -0.05, 0.37, 0.18, 0.48, 0.28, 0.62, { c: IR[1], noao: true }); bx('pzBron', B, 0.04, 0.28, 0.48, 0.7, 0.34, 0.55, { c: IR[1], noao: true });
  bx('pzBron', B, -0.1, 0.4, 0.69, 0.82, 0.3, 0.6, { c: IR[1], noao: true }); S.limb([0.39, 0.765, 0.45], [0.72, 0.775, 0.45], 0.075, 0.006, IR);
  cyl('pzBron', 0.22, 0.22, 0.075, 12, { M: B, p: [0.14, 0.83, 0.45], c: '#a2d6c0', noao: true });
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; box('pzBron', 0.06, 0.07, 0.07, { M: B, p: [0.14 + Math.sin(a) * 0.235, 0.832, 0.45 + Math.cos(a) * 0.235], ry: a, c: '#a2d6c0', noao: true }); }
  box('pzBron', 0.07, 0.07, 0.07, { M: B, p: [0.2, 0.9, 0.44], c: IR[1], noao: true });
  return end('Lavoro');
}
export const NAUTICA = { name: 'Nautica (Rutelli)', x: NAUT[0], z: NAUT[1], radius: 6, skipIds: [], build: buildNautica, walls: sq(NAUT[0], NAUT[1], 1.2) };
export const SENZATETTO = { name: 'I Senzatetto (Civiletti)', x: SENZ[0], z: SENZ[1], radius: 6, skipIds: [], build: buildSenzatetto, walls: sq(SENZ[0], SENZ[1], 1.2) };
export const LAVORO = { name: 'Lavoro (Civiletti)', x: LAV[0], z: LAV[1], radius: 6, skipIds: [], build: buildLavoro, walls: sq(LAV[0], LAV[1], 1.1) };

// ---------------------------------------------------------------------------------------------------
// Chiosco Ribaudo: the cream Liberty kiosk at the corner of the piazza (OSM w204272307, 5.0 x 3.9 m), its long side to the square and the palazzo behind it: an eight sided body with canted
// corners on a grey marble foot, a tall door under an ogee arch on the front (windows over the marble on the sides), the name board over them, a broad canopy with rounded ends on scrolled
// brackets, coffered underneath, and on top an openwork parapet between posts that carry carved balls
// ---------------------------------------------------------------------------------------------------
const KIO = [[-487.2, -943.8], [-482.7, -946.1], [-481.0, -942.6], [-485.5, -940.4]];
const KION = [-0.455, -0.89];   // the front, away from the palazzo
const rib = (k) => uvr(RIB, DW, DH, k);
const faceOn = (k, M, w, h, x, y, z, ry) => panel('pzRib', w, h, { M, p: [x, y, z], ry, ...rib(k) });
// the outline of a rounded rectangle, half sizes ax x az, corner radius r, as [x, z] in the frame
function rounded(ax, az, r) {
  const p = [];
  for (const [cx, cz, a] of [[ax - r, az - r, 0], [-ax + r, az - r, PI / 2], [-ax + r, -az + r, PI], [ax - r, -az + r, 3 * PI / 2]]) for (let k = 0; k <= 5; k++) { const t = a + k * PI / 10; p.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); }
  return p;
}
function buildRibaudo() {
  setup();
  const gr = ground4(KIO), gy = gr.hi, c = [(KIO[0][0] + KIO[2][0]) / 2, (KIO[0][1] + KIO[2][1]) / 2];
  const M = frame(c[0], gy, c[1], KION[0], KION[1]);
  begin(gy);
  const HX = 1.5, HZ = 1.12, C = 0.52, H = 3.45, CRM = '#efe2c0', CRM2 = '#d9c79c', STONE = '#b4b3ad';
  // a slab on a plan outline (local x, z) from y0 to y1
  const slab = (key, pts, y0, y1, o) => { const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-PI / 2); g.translate(0, y0, 0); part(key, g, { M, noao: true, ...o }); };
  const oct = (gx, gz, k) => [[-gx + k, -gz], [gx - k, -gz], [gx, -gz + k], [gx, gz - k], [gx - k, gz], [-gx + k, gz], [-gx, gz - k], [-gx, -gz + k]];
  slab('pzMar', oct(HX - 0.015, HZ - 0.015, C), -0.7, H + 0.62, { c: CRM });
  // the painted faces: front (door), the two sides (the same upper part, the marble foot covering the bottom: windows), the four canted corners
  const face = (k, w, h, x, z, ry) => panel('pzRib', w, h, { M, p: [x, 0, z], ry, ...rib(k) });
  face('door', 2 * (HX - C), H, 0, HZ, 0);
  face('door', 2 * (HZ - C), H, HX, 0, PI / 2); face('door', 2 * (HZ - C), H, -HX, 0, -PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) face('cant', C * Math.SQRT2, H, sx * (HX - C / 2), sz * (HZ - C / 2), Math.atan2(sx, sz));
  // the marble foot, proud of the faces; open where the front door comes down to the pavement
  for (const sx of [-1, 1]) {
    bx('pzMar', M, sx * 0.66, sx * (HX - C + 0.04), -0.7, 0.92, HZ - 0.1, HZ + 0.12, { c: STONE, noao: true });
    bx('pzMar', M, sx * (HX - 0.1), sx * (HX + 0.12), -0.7, 0.92, -HZ + C - 0.04, HZ - C + 0.04, { c: STONE, noao: true });
    bx('pzMar', M, sx * (HX - 0.1), sx * (HX + 0.17), 0.92, 1.0, -HZ + C - 0.06, HZ - C + 0.06, { c: '#cfcec8', noao: true });
    for (const sz of [-1, 1]) {
      const K = mul(M, mul(tr(sx * (HX - C / 2), 0, sz * (HZ - C / 2)), rotY(Math.atan2(sx, sz))));
      bx('pzMar', K, -C * 0.72, C * 0.72, -0.7, 0.92, -0.1, 0.1, { c: STONE, noao: true }); bx('pzMar', K, -C * 0.74, C * 0.74, 0.92, 1.0, -0.1, 0.14, { c: '#cfcec8', noao: true });
    }
  }
  // pilasters at the eight corners, each ending in a scroll
  for (const [x, z] of oct(HX, HZ, C)) {
    const a = Math.atan2(Math.abs(x) > HX - 0.01 ? x : x * 0.4, Math.abs(z) > HZ - 0.01 ? z : z * 0.4);
    box('pzMar', 0.13, H - 0.92, 0.1, { M, p: [x, 0.92, z], ry: a, c: CRM, noao: true });
    cyl('pzMar', 0.14, 0.14, 0.13, 8, { M: mul(M, mul(tr(x, H + 0.02, z), rotY(a))), p: [0, 0, -0.065], rx: PI / 2, c: CRM2, noao: true });
  }
  // the cornice over the faces, the name boards, a second cornice under the canopy
  slab('pzMar', oct(HX + 0.06, HZ + 0.06, C), H - 0.06, H + 0.03, { c: CRM2 });
  faceOn('sign', M, 1.84, 0.5, 0, H + 0.09, HZ + 0.012, 0);
  for (const sx of [-1, 1]) faceOn('sign', M, 1.14, 0.46, sx * (HX + 0.012), H + 0.11, 0, sx * PI / 2);
  slab('pzMar', oct(HX + 0.08, HZ + 0.08, C), H + 0.62, H + 0.72, { c: CRM2 });
  // the canopy: soffit, a moulded rim, a low roof of faded red
  const CY = H + 0.72;
  {
    const out = rounded(2.48, 1.9, 1.15), s = new THREE.Shape(out.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ShapeGeometry(s); g.rotateX(PI / 2);   // faces down
    const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) + 2.5) / 5, (P.getZ(i) + 1.92) / 3.84);
    part('pzRib', g, { M, p: [0, CY - 0.005, 0], noao: true, ...rib('soffit') });
  }
  slab('pzMar', rounded(2.48, 1.9, 1.15), CY, CY + 0.12, { c: CRM2 });
  slab('pzMar', rounded(2.52, 1.93, 1.18), CY + 0.12, CY + 0.22, { c: CRM });
  {
    const a = rounded(2.42, 1.84, 1.12), b = rounded(1.55, 1.12, 0.35), ring = [a.concat([a[0]]), b.concat([b[0]])];
    gridMesh('pzMar', [ring[0].map(([x, z]) => [x, CY + 0.22, z]), ring[1].map(([x, z]) => [x, CY + 0.46, z])], (i, j, p) => [p[0] / 3, p[2] / 3], { M, c: '#c79a86', noao: true, flip: true });
    slab('pzMar', b, CY + 0.2, CY + 0.46, { c: '#bf9483' });
  }
  // scrolled brackets: two over the front, two each side, two at the back
  const br = new THREE.Shape();
  br.moveTo(0, -0.62); br.quadraticCurveTo(0.12, -0.2, 0.44, -0.2); br.quadraticCurveTo(0.66, -0.2, 0.68, -0.34); br.quadraticCurveTo(0.86, -0.3, 0.8, -0.08); br.lineTo(0.76, 0); br.lineTo(0, 0); br.lineTo(0, -0.62);
  for (const [x, z, a] of [[-0.98, HZ, 0], [0.98, HZ, 0], [-0.98, -HZ, PI], [0.98, -HZ, PI], [HX, -0.66, PI / 2], [HX, 0.66, PI / 2], [-HX, -0.66, -PI / 2], [-HX, 0.66, -PI / 2]]) {
    const K = mul(M, mul(tr(x, CY, z), rotY(a - PI / 2)));   // the shape's x points out from the wall
    extrude('pzMar', br, 0.12, { M: K, p: [0, 0, -0.06], c: CRM, noao: true, cs: 3 });
    cyl('pzMar', 0.1, 0.1, 0.16, 8, { M: K, p: [0.68, -0.22, -0.08], rx: PI / 2, c: CRM2, noao: true });
  }
  // the openwork parapet and its four posts with carved balls
  const PY = CY + 0.46, px = 1.38, pz = 0.98, ph = 0.72;
  for (const [x0, z0, x1, z1] of [[-px, pz, px, pz], [px, pz, px, -pz], [px, -pz, -px, -pz], [-px, -pz, -px, pz]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.7)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) faceOn('lace', M, L / n, ph, x0 + (x1 - x0) * (i + 0.5) / n, PY, z0 + (z1 - z0) * (i + 0.5) / n, ry);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const K = mul(M, tr(sx * px, PY, sz * pz));
    cyl('pzMar', 0.07, 0.11, 0.92, 6, { M: K, c: '#e9d6bc', noao: true });
    lathe('pzMar', [[0, 0], [0.09, 0], [0.2, 0.1], [0.22, 0.2], [0.17, 0.32], [0.06, 0.38], [0.07, 0.44], [0, 0.46]], 8, { M: K, p: [0, 0.9, 0], c: '#ddc7a8', noao: true });
  }
  return end('Chiosco Ribaudo');
}
export const RIBAUDO = { name: 'Chiosco Ribaudo', x: (KIO[0][0] + KIO[2][0]) / 2, z: (KIO[0][1] + KIO[2][1]) / 2, radius: 8, skipIds: ['w204272307'], build: buildRibaudo };

export const PIAZZA = [TEMPIETTO, SETTIMO, COTTONE, NAUTICA, SENZATETTO, LAVORO, RIBAUDO];
