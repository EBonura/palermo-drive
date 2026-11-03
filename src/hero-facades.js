// Hand-drawn facades of the buildings the game knows best, drawn in code on the 256 px tile of the facade atlas, one tile per bay and floor, like the old-town tiles of
// src/buildings.js and in the same style (same render, same moulded surrounds, same shutters, so a drawn palace no longer stands out from its street).
// Each is drawn from a reference photo (Wikimedia Commons, study only: proportions and colours measured by eye, nothing sampled or traced), keeps what makes the building
// recognisable, and its windows are drawn dark glass, so they light up at night like every other window.
// assets/facades/specs.js names the layers of a wall: walls: { <edge>: { bays: n, bl: { ground: [layer per bay], nob: [...], up: [...], top: [...] } } } (src/buildings.js, `bl`).
// Tile units: x across the bay (a bay is 3 to 6 m, so a tile is stretched to it), y down the storey; the string course at the bottom is drawn by ofloor.
export function heroLayers(H) {
  const { T, obase, opatch, ofloor, owin, orust, ovouss, oskirt, archPath, oleaf, oshut, oshutOpen, oped, softNoise, wash, streak, SH } = H;
  const out = [];
  // a tile is drawn as the viewer reads the wall (left to right); the strips of the facade run the other way (right to left), so it is mirrored on the way into the atlas, lettering included
  const add = (name, fn) => out.push([name, (g, r) => { const c = document.createElement('canvas'); c.width = c.height = T; fn(c.getContext('2d'), r); g.save(); g.translate(T, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore(); }]);
  const dk = 'rgba(50,38,24,.34)', lt = 'rgba(255,252,238,.5)';
  const pier = (g, x, w, cap = true) => {   // a pilaster at the edge of the bay (the neighbour tile draws the other half): lit left edge, shaded right edge, a capital with two volutes
    g.fillStyle = 'rgba(255,250,236,.20)'; g.fillRect(x, 0, w, T); g.fillStyle = lt; g.fillRect(x, 0, 2, T); g.fillStyle = dk; g.fillRect(x + w - 3, 0, 3, T);
    if (cap) { g.fillStyle = 'rgba(255,250,236,.45)'; g.fillRect(x - 3, 8, w + 6, 12); g.fillStyle = dk; g.fillRect(x - 3, 20, w + 6, 3); g.strokeStyle = 'rgba(50,38,24,.5)'; g.lineWidth = 2; for (const cx of [x + 4, x + w - 4]) { g.beginPath(); g.arc(cx, 14, 4, 0, 7); g.stroke(); } }
  };
  const rail = (g, x0, x1, y, h, col = '#26262c') => {   // an iron rail: bars and two rails over a slab on two brackets
    g.fillStyle = '#ddd4bf'; g.fillRect(x0 - 4, y, x1 - x0 + 8, 8); g.fillStyle = 'rgba(255,255,250,.5)'; g.fillRect(x0 - 4, y, x1 - x0 + 8, 1.6); g.fillStyle = 'rgba(30,20,10,.4)'; g.fillRect(x0 - 4, y + 8, x1 - x0 + 8, 4);
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y - h); g.lineTo(x1, y - h); g.moveTo(x0, y - 2); g.lineTo(x1, y - 2); for (let x = x0 + 3; x < x1; x += 7) { g.moveTo(x, y - h); g.lineTo(x, y - 2); } g.stroke();
    for (const bx of [x0 + 6, x1 - 16]) { g.fillStyle = '#d4cab4'; g.beginPath(); g.moveTo(bx, y + 12); g.lineTo(bx + 10, y + 12); g.lineTo(bx + 6, y + 26); g.lineTo(bx + 2, y + 20); g.closePath(); g.fill(); }
  };
  const shield = (g, cx, cy, s) => {   // a coat of arms in stone: a shield with a crown and two scrolls
    g.fillStyle = '#e6dfcc'; g.strokeStyle = 'rgba(50,38,24,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - s, cy - s * .7); g.lineTo(cx + s, cy - s * .7); g.lineTo(cx + s, cy + s * .2); g.quadraticCurveTo(cx + s, cy + s * 1.1, cx, cy + s * 1.3); g.quadraticCurveTo(cx - s, cy + s * 1.1, cx - s, cy + s * .2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(60,46,30,.25)'; g.fillRect(cx - s * .8, cy - s * .5, s * 1.6, s * .6); g.fillStyle = '#e6dfcc'; g.fillRect(cx - s * .6, cy - s * 1.15, s * 1.2, s * .35); g.stroke(); for (const sg of [-1, 1]) { g.beginPath(); g.arc(cx + sg * (s + 6), cy + s * .2, 7, 0, 7); g.stroke(); }
  };
  const col = (g, x, w, y0, y1) => {   // a round column: a lit and a shaded side, a capital and a base
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#f3eddc'); gr.addColorStop(.35, '#e9e2cf'); gr.addColorStop(1, '#a89f8a'); g.fillStyle = gr; g.fillRect(x, y0, w, y1 - y0);
    g.fillStyle = '#e6dfcb'; g.fillRect(x - 4, y0, w + 8, 10); g.fillStyle = dk; g.fillRect(x - 4, y0 + 10, w + 8, 3); g.fillStyle = '#d8d0bb'; g.fillRect(x - 4, y1 - 10, w + 8, 10); g.fillStyle = 'rgba(50,38,24,.3)'; g.fillRect(x - 4, y1 - 2, w + 8, 2);
  };

  // ============================== Palazzo Belmonte Riso (Corso Vittorio Emanuele): golden stone, a rusticated arcade of five arches, a central portal between two columns, tall pedimented windows over a continuous balcony, smaller windows with iron balconies under a deep cornice
  add('hr_riso_ga', (g, r) => {   // a glazed arch of the arcade
    obase(g); orust(g, r, 0, 0, T, T, '#e6dbbd'); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, T - 24, T, 24);
    g.fillStyle = '#d8cba6'; archPath(g, 128, 112, 86, T - 24); g.fill(); ovouss(g, 128, 112, 72, 86);
    const gr = g.createLinearGradient(0, 40, 0, T - 24); gr.addColorStop(0, '#33444f'); gr.addColorStop(1, '#0f1720'); g.fillStyle = gr; archPath(g, 128, 114, 72, T - 24); g.fill();
    g.fillStyle = '#e4e0d2'; g.fillRect(56, 150, 144, 5); g.fillStyle = 'rgba(210,228,240,.13)'; g.beginPath(); g.moveTo(60, 190); g.lineTo(150, 60); g.lineTo(190, 60); g.lineTo(100, 200); g.fill();
    streak(g, 40, 130, 70, 10, .12);
  });
  add('hr_riso_gp', (g, r) => {   // the central portal: a wide arch with a fan light, a dark passage, two slender columns in front
    obase(g); orust(g, r, 0, 0, T, T, '#e6dbbd'); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(0, T - 24, T, 24);
    g.fillStyle = '#d8cba6'; archPath(g, 128, 104, 98, T - 24); g.fill(); ovouss(g, 128, 104, 84, 98);
    g.fillStyle = '#17130f'; archPath(g, 128, 106, 84, T - 24); g.fill();
    g.strokeStyle = 'rgba(210,190,150,.4)'; g.lineWidth = 2; for (let a = 0; a < 7; a++) { g.beginPath(); g.moveTo(128, 122); g.lineTo(128 + Math.cos(Math.PI + a / 6 * Math.PI) * 76, 122 + Math.sin(Math.PI + a / 6 * Math.PI) * 76); g.stroke(); }
    g.fillStyle = 'rgba(200,160,100,.35)'; g.fillRect(96, 150, 64, T - 24 - 150);
    col(g, 34, 20, 70, T - 24); col(g, 202, 20, 70, T - 24);
  });
  const risoN = (name, ped, arms) => add(name, (g, r) => {
    ofloor(g, r); pier(g, 0, 16); pier(g, T - 16, 16);
    owin(g, r, 92, 60, 72, 150, { st: 'closed', sh: 'b', ped, fr: 10, sill: 0 });
    g.fillStyle = 'rgba(70,58,44,.12)'; g.fillRect(24, 214, T - 48, 20);
    if (arms) { shield(g, 128, 24, 12); }
    g.strokeStyle = '#26262c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 226); g.lineTo(T, 226); g.moveTo(0, 214); g.lineTo(T, 214); for (let x = 3; x < T; x += 7) { g.moveTo(x, 214); g.lineTo(x, 226); } g.stroke();   // the balustrade of the continuous balcony
  });
  risoN('hr_riso_nt', 'tri', false); risoN('hr_riso_ns', 'seg', false); risoN('hr_riso_na', 'tri', true);
  add('hr_riso_t', (g, r) => {   // the top floor: a smaller window with an iron balcony on two brackets, the volute capitals of the piers
    ofloor(g, r, false); const gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, 'rgba(40,30,20,.32)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 40);
    pier(g, 0, 16); pier(g, T - 16, 16);
    owin(g, r, 102, 54, 52, 92, { st: 'closed', sh: 'b', fr: 8, hood: 1 }); rail(g, 78, 178, 172, 26);
  });

  // ============================== Palazzo Valguarnera-Gangi (Piazza Croce dei Vespri): cream plaster, terracotta pilasters and window frames, pedimented windows over iron balconies, a central portal with coat of arms and columns, a terracotta frieze with white swags
  const TC = '#bd6a48', TCD = '#8e4a32';
  const gFrame = (g, x, y, w, h) => { g.fillStyle = TC; g.fillRect(x - 10, y - 10, w + 20, h + 14); g.fillStyle = 'rgba(255,230,200,.3)'; g.fillRect(x - 10, y - 10, 2.5, h + 14); g.fillStyle = 'rgba(40,20,10,.3)'; g.fillRect(x + w + 7.5, y - 10, 2.5, h + 14); };
  const gBase = (g, r, plinth = true) => { obase(g); g.fillStyle = 'rgba(255,244,214,.35)'; g.fillRect(0, 0, T, T); if (plinth) { g.fillStyle = 'rgba(90,86,80,.55)'; g.fillRect(0, T - 22, T, 22); g.fillStyle = 'rgba(255,255,250,.3)'; g.fillRect(0, T - 22, T, 2); } };
  const gPier = (g) => { for (const x of [0, T - 14]) { g.fillStyle = TC; g.fillRect(x, 0, 14, T); g.fillStyle = 'rgba(255,230,200,.3)'; g.fillRect(x, 0, 2, T); g.fillStyle = 'rgba(40,20,10,.3)'; g.fillRect(x + 11, 0, 3, T); } };
  add('hr_gangi_gs', (g, r) => { gBase(g, r); opatch(g, r, 1, [0, .3]); g.fillStyle = TC; g.fillRect(40, 60, 176, 150); g.fillStyle = '#16100c'; g.fillRect(52, 72, 152, 138); g.fillStyle = '#8c1f2a'; g.fillRect(50, 28, 156, 24); g.fillStyle = '#f0e6d0'; g.fillRect(64, 36, 128, 3); g.fillRect(64, 43, 90, 3); g.fillStyle = 'rgba(230,190,120,.4)'; g.fillRect(60, 80, 136, 100); gPier(g); });   // the shop with its red sign
  add('hr_gangi_gw', (g, r) => { gBase(g, r); opatch(g, r, 1, [0, .3]); gFrame(g, 92, 76, 72, 96); g.fillStyle = '#1b1612'; g.fillRect(92, 76, 72, 96); g.strokeStyle = '#26262c'; g.lineWidth = 3; for (let x = 100; x < 164; x += 12) { g.beginPath(); g.moveTo(x, 76); g.lineTo(x, 172); g.stroke(); } g.fillStyle = '#ddd4bf'; g.fillRect(70, 190, 116, 22); g.fillStyle = 'rgba(60,46,30,.3)'; g.fillRect(78, 196, 100, 10); gPier(g); });   // a barred window with a stone plaque below
  add('hr_gangi_gp', (g, r) => {   // the portal: a round-arched door in a stone frame with two columns and a broken pediment
    gBase(g, r); g.fillStyle = '#d8cfb6'; g.fillRect(40, 20, 176, T); g.fillStyle = 'rgba(255,255,250,.3)'; g.fillRect(40, 20, 2, T);
    col(g, 46, 18, 56, T - 22); col(g, 192, 18, 56, T - 22);
    g.fillStyle = '#d0c6ac'; archPath(g, 128, 118, 56, T - 22); g.fill(); g.fillStyle = '#14110e'; archPath(g, 128, 120, 46, T - 22); g.fill(); oleaf(g, r, 84, 120, 44, T - 142, '#3a2b22'); oleaf(g, r, 130, 120, 44, T - 142, '#3a2b22');
    g.fillStyle = '#c8bda2'; g.fillRect(36, 40, 184, 10); shield(g, 128, 28, 11);
  });
  add('hr_gangi_gd', (g, r) => { gBase(g, r); opatch(g, r, 1, [0, .3]); gFrame(g, 100, 70, 56, 130); oleaf(g, r, 100, 70, 56, 130, '#3a2b22'); gPier(g); });
  const gN = (name, ped, mid) => add(name, (g, r) => {   // the piano nobile: terracotta pilasters, a pedimented window in a terracotta frame over an iron balcony (the middle bay: the arms and a small window over the portal)
    gBase(g, r, false); gPier(g);
    if (mid) { g.fillStyle = TC; g.fillRect(100, 90, 56, 70); g.fillStyle = '#16120f'; g.fillRect(110, 100, 36, 50); g.fillStyle = '#34414f'; g.fillRect(113, 103, 30, 44); shield(g, 128, 56, 14); return; }
    g.fillStyle = TC; g.beginPath(); if (ped === 'seg') { g.moveTo(56, 70); g.quadraticCurveTo(128, 22, 200, 70); } else { g.moveTo(56, 72); g.lineTo(128, 36); g.lineTo(200, 72); } g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,200,.3)'; g.fillRect(56, 68, 144, 3);
    gFrame(g, 92, 78, 72, 112); g.fillStyle = '#16120f'; g.fillRect(92, 78, 72, 112); const gr = g.createLinearGradient(0, 78, 0, 190); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; g.fillRect(97, 84, 62, 106); oshut(g, 92, 78, 37, 112, SH.o); oshut(g, 127, 78, 37, 112, SH.o);
    rail(g, 60, 196, 214, 28);
  });
  gN('hr_gangi_ns', 'seg', false); gN('hr_gangi_nt', 'tri', false); gN('hr_gangi_nm', 'tri', true);
  add('hr_gangi_u', (g, r) => {   // the top storey: plain cream wall between the pilasters under a terracotta frieze with white swags
    gBase(g, r, false); gPier(g); const sh = g.createLinearGradient(0, 0, 0, 90); sh.addColorStop(0, 'rgba(40,30,20,.20)'); sh.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = sh; g.fillRect(0, 0, T, 90);
    g.fillStyle = 'rgba(70,58,44,.14)'; g.fillRect(40, 0, 176, 70);
    g.fillStyle = TC; g.fillRect(0, 150, T, 76); g.fillStyle = 'rgba(255,230,200,.35)'; g.fillRect(0, 150, T, 3); g.fillStyle = 'rgba(40,20,10,.38)'; g.fillRect(0, 226, T, 5);
    g.fillStyle = '#f3ead2'; for (let x = 6; x < T; x += 62) { g.beginPath(); g.moveTo(x, 164); g.quadraticCurveTo(x + 31, 210, x + 62, 164); g.lineTo(x + 62, 174); g.quadraticCurveTo(x + 31, 222, x, 174); g.closePath(); g.fill(); }
  });

  // ============================== Grand Hotel Piazza Borsa (ex Cassa Centrale di Risparmio): rusticated ground floor with big round-arched windows behind iron grilles, a piano nobile of pedimented windows between pilasters over a balustrade,
  // a frieze with the bank's name in capitals, a heavy cornice with a balustrade. The name is one string drawn across six tiles, so it reads as a continuous band.
  add('hr_borsa_g', (g, r) => {
    obase(g); orust(g, r, 0, 0, T, T, '#e4dac0', 44, 64); g.fillStyle = 'rgba(40,30,20,.34)'; g.fillRect(0, T - 20, T, 20);
    g.fillStyle = '#d8cca8'; archPath(g, 128, 104, 78, T - 20); g.fill(); ovouss(g, 128, 104, 64, 78);
    const gr = g.createLinearGradient(0, 40, 0, T - 20); gr.addColorStop(0, '#33444f'); gr.addColorStop(1, '#0f1720'); g.fillStyle = gr; archPath(g, 128, 106, 64, T - 20); g.fill();
    g.strokeStyle = '#1a1a1e'; g.lineWidth = 3.5; for (let x = 80; x < 180; x += 13) { g.beginPath(); g.moveTo(x, 108 + Math.max(0, 60 - Math.sqrt(Math.max(0, 64 * 64 - (x - 128) * (x - 128))))); g.lineTo(x, T - 20); g.stroke(); } g.beginPath(); g.moveTo(64, 160); g.lineTo(192, 160); g.stroke();
  });
  add('hr_borsa_n', (g, r) => {
    ofloor(g, r); pier(g, 0, 14); pier(g, T - 14, 14);
    owin(g, r, 98, 70, 60, 118, { st: 'closed', sh: 'b', ped: 'tri', fr: 9 });
    g.fillStyle = '#e8e1ce'; g.fillRect(14, 206, T - 28, 22); g.strokeStyle = 'rgba(50,38,24,.4)'; g.lineWidth = 1.5; for (let x = 20; x < T - 20; x += 12) { g.beginPath(); g.moveTo(x, 208); g.lineTo(x, 226); g.stroke(); }   // a stone balustrade under the windows
    g.fillStyle = 'rgba(255,255,250,.5)'; g.fillRect(14, 206, T - 28, 2); g.fillStyle = dk; g.fillRect(14, 226, T - 28, 3);
  });
  add('hr_borsa_s', (g, r) => {   // the row of small windows under the frieze: square windows in plain frames between the pilasters
    ofloor(g, r); pier(g, 0, 14); pier(g, T - 14, 14); owin(g, r, 100, 78, 56, 74, { st: 'closed', sh: 'b', fr: 7 });
  });
  const text = 'CASSA CENTRALE DI RISPARMIO VITTORIO EMANUELE';
  for (let i = 0; i < 8; i++) add('hr_borsa_t' + i, (g, r) => {   // the frieze with the name in capitals (one string over the eight tiles, 1 px of it per metre fits the real inscription), and the cornice with its balustrade
    ofloor(g, r, false); const gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, 'rgba(40,30,20,.3)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 40);
    g.fillStyle = '#e8e1ce'; g.fillRect(0, 46, T, 74); g.fillStyle = 'rgba(255,255,250,.5)'; g.fillRect(0, 46, T, 2); g.fillStyle = dk; g.fillRect(0, 118, T, 4);
    if (i >= 1 && i <= 6) { g.font = '600 34px "Times New Roman", Georgia, serif'; const w = g.measureText(text).width, k = (6 * T - 36) / w; g.save(); g.beginPath(); g.rect(0, 50, T, 66); g.clip(); g.translate(-(i - 1) * T + 18, 0); g.scale(k, 1); g.fillStyle = 'rgba(46,38,28,.8)'; g.textBaseline = 'middle'; g.fillText(text, 0, 84); g.restore(); }
    g.fillStyle = '#d9d0b8'; g.fillRect(0, 134, T, 18); g.fillStyle = dk; g.fillRect(0, 150, T, 4); g.fillStyle = 'rgba(255,255,250,.5)'; g.fillRect(0, 134, T, 2);
    g.fillStyle = '#e4dcc6'; g.fillRect(0, 168, T, 60); for (let x = 5; x < T; x += 13) { g.fillStyle = 'rgba(255,255,250,.55)'; g.fillRect(x, 174, 5, 48); g.fillStyle = dk; g.fillRect(x + 5, 174, 2, 48); } g.fillStyle = '#d4ccb4'; g.fillRect(0, 164, T, 8); g.fillRect(0, 222, T, 8);   // the balustrade
  });

  // ============================== Teatro Biondo (Via Roma): grey-beige stone, a rusticated ground floor of arches (the middle ones glazed and lit), a piano nobile of tall round-arched windows between pilasters, a string course and a cornice
  add('hr_biondo_g', (g, r) => { obase(g); orust(g, r, 0, 0, T, T, '#dcd2bb', 44, 64); g.fillStyle = 'rgba(40,30,20,.34)'; g.fillRect(0, T - 20, T, 20); g.fillStyle = '#cfc4a8'; archPath(g, 128, 112, 70, T - 20); g.fill(); ovouss(g, 128, 112, 58, 70); const gr = g.createLinearGradient(0, 50, 0, T - 20); gr.addColorStop(0, '#33444f'); gr.addColorStop(1, '#0f1720'); g.fillStyle = gr; archPath(g, 128, 114, 58, T - 20); g.fill(); g.fillStyle = '#d8d4c6'; g.fillRect(70, 160, 116, 4); });
  add('hr_biondo_gc', (g, r) => { obase(g); orust(g, r, 0, 0, T, T, '#dcd2bb', 44, 64); g.fillStyle = 'rgba(40,30,20,.34)'; g.fillRect(0, T - 20, T, 20); g.fillStyle = '#cfc4a8'; archPath(g, 128, 96, 104, T - 20); g.fill(); ovouss(g, 128, 96, 90, 104); g.fillStyle = '#2a2018'; archPath(g, 128, 98, 90, T - 20); g.fill(); g.fillStyle = 'rgba(240,200,120,.45)'; g.fillRect(50, 100, 156, T - 20 - 100); col(g, 76, 14, 70, T - 20); col(g, 166, 14, 70, T - 20); });
  add('hr_biondo_n', (g, r) => {
    ofloor(g, r); pier(g, 0, 14); pier(g, T - 14, 14);
    g.fillStyle = '#d8ceb4'; archPath(g, 128, 98, 46, 214); g.fill(); g.strokeStyle = 'rgba(50,38,24,.45)'; g.lineWidth = 1.5; g.stroke();
    const gr = g.createLinearGradient(0, 56, 0, 212); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; archPath(g, 128, 100, 38, 212); g.fill();
    g.fillStyle = '#e4ddcc'; g.fillRect(126, 62, 3, 150); g.fillRect(90, 134, 76, 3);
    g.fillStyle = 'rgba(255,255,250,.35)'; g.fillRect(88, 100, 2, 112); ovouss(g, 128, 100, 38, 46);
    g.fillStyle = '#ddd4bf'; g.fillRect(60, 214, 136, 8); g.fillStyle = dk; g.fillRect(60, 222, 136, 3);
  });

  add('hr_biondo_u', (g, r) => {   // the attic under the cornice: pilasters, a plain band, small square windows in plain frames, dentils
    ofloor(g, r, false); const gr = g.createLinearGradient(0, 0, 0, 50); gr.addColorStop(0, 'rgba(40,30,20,.3)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 50);
    pier(g, 0, 14, false); pier(g, T - 14, 14, false); owin(g, r, 104, 70, 48, 62, { st: 'closed', sh: 'b', fr: 6 });
    g.fillStyle = '#e4dcc6'; g.fillRect(0, 196, T, 22); g.fillStyle = lt; g.fillRect(0, 196, T, 2); g.fillStyle = dk; for (let x = 0; x < T; x += 10) g.fillRect(x, 218, 5, 8);
  });

  // ============================== Grand Hotel et des Palmes (Via Mariano Stabile): a cream-yellow front of five storeys; the wings have a small window and an iron balcony in every bay on every floor,
  // the centre block (six bays) has plain windows with pediments on the first floor over a balustraded balcony, and a glazed entrance under a curved canopy.
  const CR = 'rgba(244,226,160,.34)';
  const pBase = (g, r) => { ofloor(g, r, true); g.fillStyle = CR; g.fillRect(0, 0, T, T); };
  add('hr_palm_w', (g, r) => { pBase(g, r); owin(g, r, 76, 50, 104, 126, { st: 'closed', sh: 'b', fr: 9, sill: 0 }); rail(g, 46, 210, 202, 34); });
  add('hr_palm_wt', (g, r) => { pBase(g, r); owin(g, r, 76, 50, 104, 126, { st: 'closed', sh: 'b', fr: 9, sill: 0 }); rail(g, 46, 210, 202, 34); g.fillStyle = '#e8dcb2'; g.fillRect(0, 0, T, 12); g.fillStyle = dk; g.fillRect(0, 12, T, 4); });
  add('hr_palm_c', (g, r) => { pBase(g, r); pier(g, 0, 12, false); pier(g, T - 12, 12, false); owin(g, r, 78, 50, 100, 130, { st: 'half', sh: 'b', fr: 7, ped: 'tri' }); });
  add('hr_palm_cb', (g, r) => { pBase(g, r); pier(g, 0, 12, false); pier(g, T - 12, 12, false); owin(g, r, 78, 50, 100, 130, { st: 'closed', sh: 'b', fr: 7, ped: 'seg' }); g.fillStyle = '#ecdfb8'; g.fillRect(0, 196, T, 34); g.fillStyle = 'rgba(40,30,20,.4)'; g.fillRect(0, 228, T, 3); for (let x = 5; x < T; x += 12) { g.fillStyle = 'rgba(255,255,250,.6)'; g.fillRect(x, 200, 5, 26); g.fillStyle = dk; g.fillRect(x + 5, 200, 2, 26); } });
  add('hr_palm_gw', (g, r) => { obase(g); g.fillStyle = CR; g.fillRect(0, 0, T, T); oskirt(g, 24, '#7b7366'); owin(g, r, 76, 54, 104, 110, { st: 'closed', sh: 'b', fr: 9, sill: 1 }); });
  add('hr_palm_gh', (g, r) => { obase(g); g.fillStyle = CR; g.fillRect(0, 0, T, T); oskirt(g, 24, '#7b7366'); g.fillStyle = '#e8dcb2'; archPath(g, 128, 100, 64, T - 24); g.fill(); const gr = g.createLinearGradient(0, 40, 0, T - 24); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; archPath(g, 128, 102, 54, T - 24); g.fill(); g.fillStyle = '#e4ddcc'; g.fillRect(126, 60, 3, T - 84); g.fillRect(74, 140, 108, 3); });
  add('hr_palm_ge', (g, r) => {   // the entrance: a door in a bronze frame, a curved glass canopy above it
    obase(g); g.fillStyle = CR; g.fillRect(0, 0, T, T); oskirt(g, 24, '#7b7366');
    g.fillStyle = '#2a2018'; g.fillRect(40, 80, 176, T - 104); g.fillStyle = 'rgba(240,200,120,.5)'; g.fillRect(52, 92, 152, T - 128); g.fillStyle = '#4a3a2a'; for (let x = 52; x < 204; x += 38) g.fillRect(x, 92, 3, T - 128);
    g.fillStyle = '#3a4a52'; g.beginPath(); g.moveTo(10, 78); g.quadraticCurveTo(128, 50, 246, 78); g.lineTo(246, 90); g.quadraticCurveTo(128, 62, 10, 90); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(14, 74, 228, 2);
  });
  const palC = 'hr_palm_c', palW = 'hr_palm_w';
  // ============================== Palazzo Jung (Via Abramo Lincoln): a long white front, brown shutters, an iron balcony on stone brackets under the windows of the first two floors, pediments over the first floor, a rusticated ground floor with green shopfronts and a central arched portal
  const jBase = (g, r) => { ofloor(g, r, true); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, T, T); };
  add('hr_jung_n', (g, r) => { jBase(g, r); owin(g, r, 76, 52, 104, 128, { st: 'half', sh: 'b', fr: 9, ped: 'tri' }); rail(g, 44, 212, 202, 32); });
  add('hr_jung_ns', (g, r) => { jBase(g, r); owin(g, r, 76, 52, 104, 128, { st: 'half', sh: 'b', fr: 9, ped: 'seg' }); rail(g, 44, 212, 202, 32); });
  add('hr_jung_u', (g, r) => { jBase(g, r); owin(g, r, 78, 56, 100, 120, { st: 'closed', sh: 'b', fr: 8, hood: 1 }); rail(g, 50, 206, 202, 28); });
  add('hr_jung_t', (g, r) => { ofloor(g, r, false); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, T, T); const sh = g.createLinearGradient(0, 0, 0, 40); sh.addColorStop(0, 'rgba(40,30,20,.3)'); sh.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = sh; g.fillRect(0, 0, T, 40); owin(g, r, 84, 66, 88, 96, { st: 'closed', sh: 'b', fr: 8, sill: 1 }); });
  add('hr_jung_g', (g, r) => { obase(g); orust(g, r, 0, 0, T, T, '#efece2', 44, 64); oskirt(g, 22, '#7b7468'); g.fillStyle = '#e6e2d4'; archPath(g, 128, 92, 70, T - 22); g.fill(); ovouss(g, 128, 92, 58, 70); g.fillStyle = '#1f3a2a'; g.fillRect(70, 92, 116, 26); const gr = g.createLinearGradient(0, 118, 0, T - 22); gr.addColorStop(0, 'rgba(230,200,140,.55)'); gr.addColorStop(1, 'rgba(120,90,50,.45)'); g.fillStyle = gr; g.fillRect(70, 118, 116, T - 22 - 118); g.fillStyle = '#1b1b1c'; g.fillRect(70, 118, 4, T - 140); g.fillRect(182, 118, 4, T - 140); });
  add('hr_jung_gp', (g, r) => { obase(g); orust(g, r, 0, 0, T, T, '#efece2', 44, 64); oskirt(g, 22, '#7b7468'); g.fillStyle = '#e6e2d4'; archPath(g, 128, 100, 74, T - 22); g.fill(); ovouss(g, 128, 100, 60, 74); g.fillStyle = '#17130f'; archPath(g, 128, 102, 60, T - 22); g.fill(); g.fillStyle = 'rgba(210,190,150,.3)'; g.fillRect(96, 150, 64, T - 22 - 150); col(g, 30, 16, 80, T - 22); col(g, 210, 16, 80, T - 22); });

  // ============================== Villa Malfitano (Via Pitre): pale stone, a four-column portico with a balustraded terrace over it, shuttered windows with moulded frames and quoins in the wings
  const mW = (g, r, up) => { ofloor(g, r, true); g.fillStyle = 'rgba(255,252,240,.22)'; g.fillRect(0, 0, 10, T); g.fillStyle = dk; g.fillRect(T - 8, 0, 8, T); owin(g, r, 94, up ? 54 : 64, 68, up ? 130 : 120, { st: up ? 'half' : 'closed', sh: 'b', fr: 9, sill: up ? 0 : 1, hood: up ? 1 : 0 }); };
  add('hr_malf_w', (g, r) => mW(g, r, false)); add('hr_malf_wu', (g, r) => mW(g, r, true));
  add('hr_malf_pl', (g, r) => { obase(g); g.fillStyle = 'rgba(40,30,20,.32)'; g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(210,200,176,.4)'; g.fillRect(0, 0, T, T); oskirt(g, 20, '#8f8878'); col(g, 214, 34, 22, T - 20); g.fillStyle = '#d4ccb6'; g.fillRect(0, 0, T, 22); });
  add('hr_malf_pc', (g, r) => { obase(g); g.fillStyle = 'rgba(40,30,20,.35)'; g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(200,190,166,.45)'; g.fillRect(0, 0, T, T); oskirt(g, 20, '#8f8878'); g.fillStyle = '#d4ccb6'; archPath(g, 128, 112, 54, T - 20); g.fill(); g.fillStyle = '#17120e'; archPath(g, 128, 114, 44, T - 20); g.fill(); oleaf(g, r, 84, 120, 44, T - 140, '#3d2c22'); oleaf(g, r, 130, 120, 42, T - 140, '#3d2c22'); g.fillStyle = 'rgba(230,200,140,.5)'; g.fillRect(100, 60, 56, 40); g.fillStyle = '#d4ccb6'; g.fillRect(0, 0, T, 22); });
  add('hr_malf_pr', (g, r) => { obase(g); g.fillStyle = 'rgba(40,30,20,.32)'; g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(210,200,176,.4)'; g.fillRect(0, 0, T, T); oskirt(g, 20, '#8f8878'); col(g, 8, 34, 22, T - 20); g.fillStyle = '#d4ccb6'; g.fillRect(0, 0, T, 22); });
  const mU = (name, mode) => add(name, (g, r) => {   // the terrace over the portico: a stone balustrade, a round-arched window in the middle, pilasters at the corners
    ofloor(g, r, true); g.fillStyle = '#e4dcc6'; g.fillRect(0, 190, T, 40); g.strokeStyle = 'rgba(50,38,24,.45)'; g.lineWidth = 2; for (let x = 6; x < T; x += 13) { g.beginPath(); g.moveTo(x, 194); g.lineTo(x, 226); g.stroke(); } g.fillStyle = lt; g.fillRect(0, 190, T, 3); g.fillStyle = '#d4ccb6'; g.fillRect(0, 186, T, 8);
    if (mode === 'c') { g.fillStyle = '#d8ceb4'; archPath(g, 128, 100, 40, 186); g.fill(); const gr = g.createLinearGradient(0, 60, 0, 186); gr.addColorStop(0, '#34414f'); gr.addColorStop(1, '#10161e'); g.fillStyle = gr; archPath(g, 128, 102, 32, 186); g.fill(); g.fillStyle = '#e4ddcc'; g.fillRect(126, 70, 3, 116); }
  });
  mU('hr_malf_ul', 'l'); mU('hr_malf_uc', 'c'); mU('hr_malf_ur', 'r');
  return out;
}
