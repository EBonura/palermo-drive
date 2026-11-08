// The adverts on the roadside billboards (src/props.js): twelve posters for invented Palermo businesses, the owner's approved proposals, painted in code
// into one atlas. No photos, no real brands or people. The Palermitan lines are the owner's, letter for letter: never "correct" them, never translate them.
// Each poster is laid out in the proposal's own units (a 506 x 238 poster, 2.13:1); every line of text is fitted to the box its ink fills in the proposal,
// so the layout holds whatever font a device has. Headlines in Impact where there is one (Barlow Condensed, which the game ships, where there is not).
// No three.js here: tools can import it to paint a poster on its own.

export const DW = 506, DH = 238;                 // design units (the proposal's poster)
export const COLS = 4, ROWS = 3, COUNT = 12;     // the atlas: 4 x 3 posters
export const CELL_W = 512, CELL_H = 256;         // pixels per poster in the atlas (2048 x 768 in all)

let headF = null;
export const head = g => {
  if (!headF) {
    g.font = '40px monospace'; const a = g.measureText('MWMWiiii').width;
    g.font = '40px Impact, monospace'; const b = g.measureText('MWMWiiii').width;
    headF = a !== b ? s => `400 ${s}px Impact, sans-serif` : s => `700 ${s}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  }
  return headF;
};
const SANS = s => `700 ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const MONO = s => `700 ${s}px Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace`;
const SERIF = s => `700 ${s}px Georgia, "Times New Roman", serif`;
const SERIF_I = s => `italic 400 ${s}px Georgia, "Times New Roman", serif`;

// One line of text whose ink fills the box [left, top, right, bottom] (inclusive, design units): the height sets the size, the width a horizontal scale.
// sp: letter-spaced (the small capitals of the advertiser's name): the width is made up with spacing instead.
export function fit(g, text, font, [l, t, r, b], col, sp = false) {
  g.font = font(100); let m = g.measureText(text);
  const size = 100 * (b - t + 1) / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  g.font = font(size); m = g.measureText(text);
  g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const W = r - l + 1, base = t + m.actualBoundingBoxAscent, ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  if (sp && ink < W) {
    const ch = [...text], adv = ch.map(c => g.measureText(c).width), first = g.measureText(ch[0]), last = g.measureText(ch[ch.length - 1]);
    const natural = adv.slice(0, -1).reduce((s, v) => s + v, 0) + last.actualBoundingBoxRight + first.actualBoundingBoxLeft;
    const gap = (W - natural) / (ch.length - 1);
    let x = l + first.actualBoundingBoxLeft;
    ch.forEach((c, i) => { g.fillText(c, x, base); x += adv[i] + gap; });
    return;
  }
  const sx = W / ink;
  g.save(); g.translate(l + m.actualBoundingBoxLeft * sx, base); g.scale(sx, 1); g.fillText(text, 0, 0); g.restore();
}

const bg = (g, c) => { g.fillStyle = c; g.fillRect(0, 0, DW, DH); };
const disc = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const rrect = (g, x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); };

// In the order of the proposal sheet.
export const POSTERS = [
  // 1 driving school
  g => {
    const H = head(g), W = '#ffffff'; bg(g, '#c9271e');
    fit(g, 'U RUSSU È', H, [26, 48, 243, 100], W);
    fit(g, 'UN CUNSIGGHIU', H, [26, 108, 364, 153], W);
    fit(g, 'Patente in tri jorna. Frenu facultativu.', SANS, [26, 171, 288, 185], W);
    fit(g, 'AUTOSCUOLA U SEMAFORU', SANS, [288, 215, 489, 225], W, true);
    rrect(g, 431, 27, 50, 150, 6, '#141414');
    disc(g, 456, 52, 19.5, '#ff4b3a'); disc(g, 456, 96, 19.5, '#3b2b15'); disc(g, 456, 140, 19.5, '#143120');
  },
  // 2 horns
  g => {
    const H = head(g), K = '#151310'; bg(g, '#fdd221');
    fit(g, 'SONA PRIMA CA', H, [26, 56, 359, 100], K);
    fit(g, 'SCATTA U VIEIDDI', H, [26, 109, 393, 153], K);
    fit(g, 'Novu clacson a tri trummi. Si senti finu a Tràpani.', SANS, [26, 170, 375, 184], K);
    fit(g, 'CLACSON PRO', SANS, [384, 215, 489, 224], K, true);
  },
  // 3 parking attendant
  g => {
    const H = head(g), W = '#ffffff'; bg(g, '#0f426c');
    fit(g, 'UN EURU, CAPU?', H, [26, 64, 370, 114], W);
    fit(g, "Ora cu l'abbonamentu annuale", SANS, [26, 125, 388, 144], '#f8d22e');
    fit(g, 'Ci talìu iu â machina. Quasi sempri.', SANS, [25, 161, 276, 176], W);
    fit(g, 'PARCHEGGI U CAPU S.P.A.', SANS, [298, 215, 488, 225], W, true);
  },
  // 4 arancina
  g => {
    const H = head(g), K = '#2c1405'; bg(g, '#e7821f');
    fit(g, 'È ARANCINA.', H, [67, 62, 441, 137], K);
    fit(g, 'Finìu u discussu.', SANS, [154, 147, 354, 166], K);
    fit(g, 'COMITATO PÂ A FINALE', SANS, [320, 213, 489, 224], K, true);
  },
  // 5 lapa
  g => {
    const H = head(g), W = '#ffffff'; bg(g, '#417fac');
    fit(g, 'TRI ROTI.', H, [25, 56, 216, 100], W);
    fit(g, 'ZERU SCUSI.', H, [25, 109, 281, 153], W);
    fit(g, 'Lapa in leasing: anticipo zero, rumuri assai.', SANS, [26, 171, 335, 185], W);
    fit(g, 'LAPA LEASING', SANS, [384, 215, 489, 225], W, true);
  },
  // 6 insurance
  g => {
    const H = head(g), N = '#1b3349', R = '#c6281f'; bg(g, '#f2f0e4');
    fit(g, 'Assicuriamo tutto.', SANS, [26, 54, 347, 81], N);
    fit(g, 'TRANNE VIALE', H, [25, 99, 289, 138], R);
    fit(g, 'REGIONE', H, [26, 147, 188, 187], R);
    fit(g, 'ASSICURAZIONI TRI BOTTI', SANS, [298, 215, 489, 224], N, true);
  },
  // 7 hacked fridge
  g => {
    const G = '#3dea82'; bg(g, '#0c1912');
    fit(g, '> TI FUTTIERU', MONO, [26, 60, 289, 85], G);
    fit(g, 'U FRIGURIFERU?', MONO, [26, 96, 308, 122], G);
    fit(g, 'Inchilu ri panelli. Chiddi un si', MONO, [26, 144, 390, 163], '#f6faf7');
    fit(g, 'hàccanu.', MONO, [26, 166, 112, 182], '#f6faf7');
    fit(g, 'FRIGO ANTI-HACKER', SANS, [340, 216, 489, 224], '#52dc8f', true);
  },
  // 8 Hotel Catacombe
  g => {
    bg(g, '#191516');
    fit(g, 'Hotel Catacombe', SERIF, [61, 70, 447, 104], '#e8dfcc');
    fit(g, 'I clienti un si nni vannu chiù.', SERIF_I, [104, 127, 401, 145], '#e6ddd0');
    fit(g, 'Silenziu garantitu ra seculi. Colazioni nun inclusa.', SANS, [76, 161, 431, 175], '#a39a8d');
  },
  // 9 Festa dei Morti
  g => {
    const H = head(g), C = '#fde6b3', P = '#fedfc4'; bg(g, '#78204a');
    fit(g, 'ANIMI SANTI', H, [24, 60, 260, 100], C);
    fit(g, 'EXPRESS', H, [26, 107, 189, 147], C);
    fit(g, 'I rijali ri morti, cunsignati u dui ri novembri.', SANS, [26, 165, 393, 181], P);
    fit(g, 'FRUTTA MARTORANA INCLUSA', SANS, [268, 215, 489, 225], P, true);
  },
  // 10 Mondello
  g => {
    const H = head(g), T = '#053c46'; bg(g, '#22b6c4');
    fit(g, 'OMBRELLONI', H, [27, 56, 291, 100], T);
    fit(g, 'A MONDIELLU', H, [24, 109, 300, 153], T);
    fit(g, 'Prenota ora pû 2031.', SANS, [27, 162, 269, 186], '#ffffff');
    fit(g, 'VIAGGI BALLARÒ', SANS, [364, 212, 489, 224], T, true);
  },
  // 11 meme: nobody, absolutely nobody
  g => {
    const H = head(g), K = '#0b0b0b'; bg(g, '#ffffff');
    fit(g, 'NUDDU:', H, [26, 30, 106, 53], K);
    fit(g, 'ASSOLUTAMENTI NUDDU:', H, [24, 64, 290, 87], K);
    fit(g, 'U PALERMITANU, 0,2 SECONDI PRIMA', H, [26, 103, 471, 131], K);
    fit(g, 'DÛ VIEIDDI:', H, [26, 132, 164, 162], K);
    fit(g, 'PEEEEEEEEE', H, [26, 172, 202, 205], '#c6281f');
  },
  // 12 meme: the doctor and me
  g => {
    const H = head(g), K = '#2d2412', W = '#fdf8f2'; bg(g, '#ede6d0');
    g.fillStyle = '#a3331d'; g.fillRect(254, 0, DW - 254, DH);
    fit(g, 'U miedicu:', SANS, [20, 21, 124, 37], K);
    fit(g, 'MANCIA', H, [20, 59, 125, 87], K);
    fit(g, 'LIGGERU', H, [20, 95, 128, 123], K);
    fit(g, 'Iu:', SANS, [273, 21, 296, 37], W);
    fit(g, 'PANI CÂ', H, [273, 53, 388, 90], W);
    fit(g, 'MEUSA,', H, [273, 99, 381, 133], W);
    fit(g, 'MARITATA', H, [273, 139, 418, 169], W);
  },
];

// One poster into a w x h box at (x, y) of a 2D context.
export function paintPoster(g, i, x = 0, y = 0, w = DW, h = DH) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.setTransform(w / DW, 0, 0, h / DH, x, y);   // (the context's own transform is not kept: the atlas and the sheet paint on a fresh one)
  POSTERS[i](g);
  g.restore();
}

// The whole atlas; paint(g, w, h) for freeCanvas in src/core.js. Poster i sits in column i % COLS, row floor(i / COLS), from the top left.
export function paintAtlas(g, w = COLS * CELL_W, h = ROWS * CELL_H) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  const cw = w / COLS, ch = h / ROWS;
  for (let i = 0; i < COUNT; i++) paintPoster(g, i, (i % COLS) * cw, Math.floor(i / COLS) * ch, cw, ch);
}
