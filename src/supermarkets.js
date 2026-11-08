// The supermarkets' signs: every chain really open in Palermo (OSM shop=supermarket, see BRANDS) gets a parody of itself, painted in code into one atlas of
// sixteen 4:1 signs. Same family of colours as the real chain, never its mark: other shapes, other lettering, other name. src/props.js hangs them on the
// real buildings (a fascia over a glazed shopfront, a colour band, a totem at the car park). All names and slogans are DRAFTS for the owner to correct;
// the Palermitan lines follow the owner's spelling. No three.js here: tools can import it to paint a sign on its own.
import { head, fit } from './adverts.js';

export const DW = 512, DH = 128;                 // design units of one sign
export const COLS = 2, ROWS = 8, COUNT = 16;     // the atlas: 2 x 8 signs
export const CELL_W = 512, CELL_H = 128;         // pixels per sign (1024 x 1024 in all)

// The chains, in atlas order (most stores in the game's area first): the real name as OSM spells it (re, matched on the shop's or the building's name),
// the parody, its slogan, and the colour of its band (band) and of the trim round the sign (trim). Carrefour has no store in the game's area in OSM.
export const BRANDS = [
  { real: 'Conad', re: /conad/i, name: 'CUNZAD', slogan: 'Cunzamu tuttu, puru u prezzu.', band: '#d6202a', trim: '#f39a1e' },
  { real: 'Sisa', re: /\bsisa\b/i, name: 'SISAPI', slogan: 'Unni si spenni picca. Si sapi.', band: '#d2232a', trim: '#ffffff' },
  { real: 'Lidl', re: /\blidl\b/i, name: 'LIDDU', slogan: 'Trasi, pigghia, nesci.', band: '#0b4ea2', trim: '#ffd20a' },
  { real: 'Decò', re: /\bdec[oò](?![a-z])/i, name: 'RICÒ', slogan: 'Tuttu friscu. Quasi.', band: '#c8102e', trim: '#3c8d2f' },
  { real: 'Ard Discount', re: /\bard\b/i, name: 'ARRIDI DISCOUNT', slogan: "A cassa t'arridi.", band: '#e94e1b', trim: '#ffd400' },
  { real: 'Eurospin', re: /eurospin/i, name: 'EUROSPINGULA', slogan: 'Prezzi ca puncinu picca.', band: '#123f8f', trim: '#e3051b' },
  { real: 'Famila', re: /\bfamila\b/i, name: 'FAMI', slogan: 'Mai cchiù fami.', band: '#2e8b3a', trim: '#c4161c' },
  { real: 'Penny', re: /\bpenny\b/i, name: 'PINNICU MARKET', slogan: "Chiusu ra l'una ê quattru.", band: '#cd1719', trim: '#ffd400' },
  { real: 'Todis', re: /\btodis\b/i, name: 'TOTÒS', slogan: "U zu Totò t'u fa a menu.", band: '#0d7a3e', trim: '#ffd200' },
  { real: 'Paghi Poco', re: /paghi ?poco/i, name: 'PAGHI PICCA', slogan: 'Pigghi assai, paghi picca, ti lamienti u stissu.', band: '#ffd400', trim: '#1d3f8f' },
  { real: 'Coop', re: /\b(in|iper)?coop\b/i, name: 'CUOPPU', slogan: 'A cooperativa ru frittu.', band: '#e2001a', trim: '#ffffff' },
  { real: 'Prezzemolo & Vitale', re: /prezzemolo/i, name: 'PITRUSINU & VITALI', slogan: "'N tutti i minestri.", band: '#1f4a2c', trim: '#e9dfc4' },
  { real: 'MD', re: /^md\b/i, name: 'MZ MIZZICA DISCOUNT', slogan: 'Mizzica chi prezzi!', band: '#133a8a', trim: '#ffd400' },
  { real: 'Crai', re: /\bcrai\b/i, name: 'RUMANI', slogan: 'Apiertu. Rumani.', band: '#2f8f3a', trim: '#d71920' },
  { real: 'Despar', re: /despar|eurospar|interspar|^spar\b/i, name: 'SPARÌU', slogan: 'U stipendiu? Sparìu.', band: '#1b7a3a', trim: '#d71920' },
  { real: 'Sigma', re: /\bsigma\b/i, name: 'SÌ, MA', slogan: "Sì, ma unn'è u parcheggiu?", band: '#1a4fa0', trim: '#e30613' },
];
// The chain a shop or building name belongs to (index into BRANDS), or -1: an independent shop keeps its own front.
export const brandOf = n => { if (!n) return -1; for (let i = 0; i < BRANDS.length; i++) if (BRANDS[i].re.test(n)) return i; return -1; };

const SANS = s => `700 ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const SANS_I = s => `italic 700 ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const SERIF = s => `700 ${s}px Georgia, "Times New Roman", serif`;
const SERIF_I = s => `italic 700 ${s}px Georgia, "Times New Roman", serif`;
const bg = (g, c) => { g.fillStyle = c; g.fillRect(0, 0, DW, DH); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const disc = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const ell = (g, x, y, rx, ry, a, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); };
const poly = (g, pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
const line = (g, pts, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
const rrect = (g, x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };

// In BRANDS order. Each paints the whole 512 x 128 sign.
export const SIGNS = [
  // Conad: red lettering on white, an orange accent. Here a pane cunzato for an emblem.
  g => {
    bg(g, '#ffffff'); rect(g, 0, 118, DW, 10, '#f39a1e');
    ell(g, 66, 62, 50, 30, -0.12, '#e08a2a'); ell(g, 66, 56, 46, 22, -0.12, '#f4b860');
    for (const x of [44, 64, 84]) line(g, [[x - 6, 46], [x + 6, 66]], 5, '#b5651d');
    fit(g, 'CUNZAD', SANS, [134, 18, 492, 84], '#d6202a');
    fit(g, 'Cunzamu tuttu, puru u prezzu.', SANS_I, [136, 94, 492, 108], '#8a1a1e');
  },
  // Sisa: red with white lettering. A yellow speech bubble: si sapi.
  g => {
    bg(g, '#d2232a');
    rrect(g, 18, 18, 92, 70, 18, '#ffd23a'); poly(g, [[40, 84], [34, 108], [62, 86]], '#ffd23a');
    fit(g, '!', SANS, [57, 28, 71, 76], '#d2232a');
    fit(g, 'SISAPI', head(g), [128, 16, 494, 88], '#ffffff');
    fit(g, 'Unni si spenni picca. Si sapi.', SANS, [130, 98, 494, 112], '#ffe7a8');
  },
  // Lidl: blue, yellow, red. Here a yellow rhombus with a red edge, and the name in white italics beside it.
  g => {
    bg(g, '#0b4ea2');
    poly(g, [[64, 6], [122, 64], [64, 122], [6, 64]], '#e30613'); poly(g, [[64, 16], [112, 64], [64, 112], [16, 64]], '#ffd20a');
    fit(g, 'L', SANS_I, [52, 42, 78, 86], '#0b4ea2');
    fit(g, 'LIDDU', SANS_I, [140, 14, 492, 86], '#ffffff');
    fit(g, 'Trasi, pigghia, nesci.', SANS, [142, 98, 400, 112], '#ffd20a');
  },
  // Decò: red on white, a green leaf. Here a serif italic and a sprig over the accent.
  g => {
    bg(g, '#fbf7ee'); rect(g, 0, 0, DW, 8, '#c8102e'); rect(g, 0, 120, DW, 8, '#c8102e');
    fit(g, 'Ricò', SERIF_I, [96, 22, 346, 96], '#c8102e');
    ell(g, 368, 34, 22, 9, -0.6, '#3c8d2f'); ell(g, 392, 46, 20, 8, 0.5, '#57a845'); line(g, [[356, 58], [380, 40]], 3, '#2d6e23');
    fit(g, 'Tuttu friscu. Quasi.', SERIF_I, [356, 84, 494, 100], '#2d6e23');
  },
  // Ard: orange-red and yellow. A yellow grin.
  g => {
    bg(g, '#e94e1b');
    disc(g, 62, 64, 48, '#ffd400'); disc(g, 46, 50, 6, '#3a1a0a'); disc(g, 78, 50, 6, '#3a1a0a');
    g.strokeStyle = '#3a1a0a'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(62, 62, 28, 0.35, Math.PI - 0.35); g.stroke();
    fit(g, 'ARRIDI', head(g), [128, 12, 400, 80], '#ffffff');
    fit(g, 'DISCOUNT', SANS, [128, 88, 330, 104], '#ffd400', true);
    fit(g, "A cassa t'arridi.", SANS_I, [348, 88, 494, 104], '#fff1c2');
  },
  // Eurospin: blue lettering, red and yellow. A red safety pin (a spingula).
  g => {
    bg(g, '#ffffff'); rect(g, 0, 112, DW, 16, '#ffd400');
    line(g, [[20, 92], [104, 30]], 6, '#e3051b'); line(g, [[26, 100], [110, 38]], 6, '#e3051b');
    g.strokeStyle = '#e3051b'; g.lineWidth = 6; g.beginPath(); g.arc(18, 98, 9, 0, Math.PI * 2); g.stroke();
    rrect(g, 96, 22, 26, 22, 5, '#9aa3ad');
    fit(g, 'EUROSPINGULA', head(g), [134, 16, 494, 76], '#123f8f');
    fit(g, 'Prezzi ca puncinu picca.', SANS_I, [136, 84, 400, 100], '#123f8f');
  },
  // Famila: red lowercase, green. A fork and knife.
  g => {
    bg(g, '#ffffff'); rect(g, 0, 96, DW, 32, '#2e8b3a');
    line(g, [[30, 20], [80, 86]], 7, '#2e8b3a'); line(g, [[80, 20], [30, 86]], 7, '#2e8b3a');
    for (const d of [-7, 0, 7]) line(g, [[80 + d, 12], [80 + d, 30]], 3, '#2e8b3a');
    fit(g, 'fami', SANS, [150, 8, 360, 84], '#c4161c');
    fit(g, 'Mai cchiù fami.', SANS_I, [150, 103, 362, 120], '#ffffff');
  },
  // Penny: red, white, yellow. A yellow moon: the shop sleeps after lunch.
  g => {
    bg(g, '#cd1719');
    disc(g, 62, 62, 44, '#ffd400'); disc(g, 82, 50, 40, '#cd1719');
    fit(g, 'z', SANS, [86, 74, 100, 90], '#ffffff'); fit(g, 'z', SANS, [100, 50, 118, 70], '#ffffff');
    fit(g, 'PINNICU', head(g), [132, 12, 400, 80], '#ffffff');
    fit(g, 'MARKET', SANS, [410, 56, 494, 78], '#ffd400', true);
    fit(g, "Chiusu ra l'una ê quattru.", SANS_I, [134, 92, 400, 108], '#ffe7a8');
  },
  // Todis: green and yellow. A moustache: u zu Totò.
  g => {
    bg(g, '#0d7a3e');
    disc(g, 62, 64, 48, '#ffd200');
    ell(g, 46, 70, 20, 11, 0.35, '#2a1a10'); ell(g, 78, 70, 20, 11, -0.35, '#2a1a10'); disc(g, 62, 64, 7, '#2a1a10');
    fit(g, 'TOTÒS', head(g), [132, 10, 400, 84], '#ffd200');
    fit(g, "U zu Totò t'u fa a menu.", SANS_I, [134, 94, 400, 110], '#ffffff');
  },
  // Paghi Poco: yellow with blue and red. A red coin worn thin.
  g => {
    bg(g, '#ffd400');
    disc(g, 60, 64, 44, '#d71920'); disc(g, 60, 64, 34, '#f0434b'); fit(g, '€', SANS, [44, 42, 76, 86], '#ffd400');
    fit(g, 'PAGHI PICCA', head(g), [124, 12, 494, 76], '#1d3f8f');
    fit(g, 'Pigghi assai, paghi picca, ti lamienti u stissu.', SANS_I, [126, 88, 494, 102], '#d71920');
  },
  // Coop: red rounded lettering on white. A paper cone of panelle and crocchè.
  g => {
    bg(g, '#ffffff');
    poly(g, [[22, 38], [98, 38], [60, 118]], '#d9c9a3'); poly(g, [[22, 38], [98, 38], [92, 50], [28, 50]], '#bfa979');
    rect(g, 30, 18, 24, 22, '#e9b33c'); rect(g, 52, 12, 26, 26, '#f2c75a'); ell(g, 84, 28, 14, 9, 0.3, '#c98a2c');
    fit(g, 'Cuoppu', SANS, [124, 14, 440, 86], '#e2001a');
    fit(g, 'A cooperativa ru frittu.', SANS_I, [126, 96, 380, 112], '#a00012');
  },
  // Prezzemolo & Vitale: dark green and cream, a serif. A sprig of parsley.
  g => {
    bg(g, '#1f4a2c'); g.strokeStyle = '#e9dfc4'; g.lineWidth = 2; g.strokeRect(6, 6, DW - 12, DH - 12);
    line(g, [[48, 112], [56, 60]], 3, '#9ccf6e');
    for (const [x, y, a] of [[40, 40, -0.6], [66, 36, 0.5], [54, 22, 0], [34, 62, -0.9], [74, 58, 0.8]]) ell(g, x, y, 14, 10, a, '#7cbf4e');
    fit(g, 'Pitrusinu & Vitali', SERIF, [98, 24, 494, 72], '#e9dfc4');
    fit(g, "'N tutti i minestri.", SERIF_I, [180, 86, 420, 104], '#c9d9a4');
  },
  // MD: blue, yellow, red. A yellow rounded box with a red MZ.
  g => {
    bg(g, '#133a8a');
    rrect(g, 14, 18, 100, 92, 22, '#ffd400'); fit(g, 'MZ', head(g), [26, 38, 102, 90], '#e30613');
    fit(g, 'MIZZICA', head(g), [130, 14, 400, 72], '#ffffff');
    fit(g, 'DISCOUNT', SANS, [408, 46, 494, 64], '#ffd400', true);
    fit(g, 'Mizzica chi prezzi!', SANS_I, [132, 86, 360, 104], '#ffd400');
  },
  // Crai: red and green on white. A red sun coming up: crai, rumani, tomorrow.
  g => {
    bg(g, '#ffffff'); rect(g, 0, 92, 120, 36, '#2f8f3a');
    g.fillStyle = '#d71920'; g.beginPath(); g.arc(60, 92, 40, Math.PI, 0); g.fill();
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 7; line(g, [[60 + Math.cos(a) * 48, 92 + Math.sin(a) * 48], [60 + Math.cos(a) * 60, 92 + Math.sin(a) * 60]], 5, '#d71920'); }
    fit(g, 'RUMANI', head(g), [136, 14, 420, 84], '#2f8f3a');
    fit(g, 'Apiertu. Rumani.', SANS_I, [138, 94, 330, 110], '#d71920');
  },
  // Despar: green and red. A red puff of smoke where the wages were.
  g => {
    bg(g, '#1b7a3a');
    for (const [x, y, r] of [[40, 70, 26], [66, 52, 30], [92, 72, 24], [62, 84, 22]]) disc(g, x, y, r, '#d71920');
    for (const [x, y, r] of [[26, 30, 6], [110, 26, 5], [104, 104, 4]]) disc(g, x, y, r, '#f6b3b3');
    fit(g, 'SPARÌU', head(g), [134, 8, 400, 84], '#ffffff');
    fit(g, 'U stipendiu? Sparìu.', SANS_I, [136, 94, 360, 110], '#ffd5d5');
  },
  // Sigma: blue, red, white. A big red comma.
  g => {
    bg(g, '#1a4fa0');
    disc(g, 62, 50, 34, '#e30613'); poly(g, [[80, 70], [94, 54], [70, 116], [52, 112]], '#e30613');
    fit(g, 'SÌ, MA...', head(g), [130, 12, 420, 84], '#ffffff');
    fit(g, "Sì, ma unn'è u parcheggiu?", SANS_I, [132, 94, 420, 110], '#ffd0d0');
  },
];

// One sign into a w x h box at (x, y) of a 2D context.
export function paintSign(g, i, x = 0, y = 0, w = DW, h = DH) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.setTransform(w / DW, 0, 0, h / DH, x, y);
  SIGNS[i](g);
  g.restore();
}

// The whole atlas; paint(g, w, h) for freeCanvas in src/core.js. Sign i sits in column i % COLS, row floor(i / COLS), from the top left.
export function paintAtlas(g, w = COLS * CELL_W, h = ROWS * CELL_H) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  const cw = w / COLS, ch = h / ROWS;
  for (let i = 0; i < COUNT; i++) paintSign(g, i, (i % COLS) * cw, Math.floor(i / COLS) * ch, cw, ch);
}
